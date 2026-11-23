---
title: "Helper"
description: "I valori che appartengono alla gente dell'impianto, come l'obiettivo del lotto o il turno: interruttori, numeri, scelte, testi, contatori, timer, orari"
---

Un helper è un valore che appartiene alle persone dell'impianto e non a un PLC. «La linea 2 è in cambio formato.» «L'obiettivo del lotto di oggi è 1.250 kg.» «È in corso il turno B.» «Dodici pezzi scartati dall'ultimo azzeramento.» «Allo spurgo mancano nove minuti.» Niente di tutto questo sta in un registro, e tutto è esattamente ciò che regole e schermate devono sapere.

HotLoop ne ha sette tipi. Un helper è un'entità come le altre: ha un `entity_id`, uno stato, attributi e servizi, si colloca nell'albero delle apparecchiature, compare in `/api/states`, nella schermata Entità, in `list_entities` via MCP e nel trigger di stato di un'automazione. Ciò che cambia è dove vive il suo valore: lo conserva HotLoop, nel database, e **nessun servizio di un helper scrive mai un tag**.

## I sette

| Dominio | Stato | Opzioni | Servizi |
|---|---|---|---|
| `input_boolean` | `on` / `off` | `initial` (true/false), `restore` | `turn_on`, `turn_off`, `toggle` |
| `input_number` | il numero, `"1250"` | `min`, `max` (entrambi obbligatori), `step` (predefinito 1), `mode` (`slider` o `box`), `initial`, `restore` e una `unit_of_measurement` | `set_value {value}`, `increment`, `decrement` |
| `input_select` | la scelta | `choices` (obbligatorio, fino a 100), `initial`, `restore` | `select_option {option}`, `select_next {cycle}`, `select_previous {cycle}` |
| `input_text` | il testo | `max_length` (predefinito e massimo 255), `pattern`, `initial`, `restore` | `set_value {value}` |
| `input_counter` | un numero intero | `initial` (predefinito 0), `step` (predefinito 1), `min`, `max`, `restore` | `increment`, `decrement`, `reset`, `set_value {value}` |
| `timer` | `idle` / `active` / `paused` | `duration_sec` (obbligatorio, da 1 secondo a 7 giorni), `restore` | `start {duration}`, `pause`, `cancel`, `finish` |
| `schedule` | `on` / `off` | `schedule` (obbligatorio) | nessuno: segue l'orologio |

Il contatore è `input_counter`, non `counter`. `counter` è già il composito PLC il cui azzeramento scrive un tag, e resta esattamente ciò che è.

Ogni opzione viene controllata quando l'helper viene salvato, e `initial` rispetto a tutte le altre: un `input_number` da 0 a 100 che parte da 150 viene rifiutato, non avviato a 100. Un'opzione che un dominio non accetta è un errore, non un'impostazione ignorata in silenzio. Le opzioni degli helper (`initial`, `restore`, `choices`, `duration_sec`, `mode`, `schedule`) vengono rifiutate su ogni altro dominio per lo stesso motivo.

## Crearne uno

Un amministratore crea gli helper (`entities.write`). Nella schermata Entità, **Nuovo helper**, accanto a Nuova apparecchiatura. Tramite l'API:

```
POST /api/helpers
{"name": "Batch target", "domain": "input_number", "unit_of_measurement": "kg",
 "options": {"min": 0, "max": 5000, "step": 50, "initial": 1000}}
```

L'`entity_id` viene ricavato dal nome (`input_number.batch_target`) a meno che non ne indichiate uno. `PUT /api/helpers/{entity_id}` ne cambia nome, icona, unità o opzioni; `DELETE /api/helpers/{entity_id}` lo elimina insieme al suo valore. L'intera API è in [l'API HTTP](/it/iot/api/#helper).

Una modifica delle opzioni che lascerebbe il valore attuale dell'helper fuori da esse viene rifiutata: restringere un intervallo oltre il valore, o togliere la scelta selezionata. Impostate prima il valore, oppure scegliete opzioni che lo comprendano. Un valore non viene mai spostato per adattarlo.

## Impostarne uno

Chiunque abbia `helpers.write` imposta gli helper. Gli operatori lo hanno: gestire il selettore del turno e contare gli scarti è operatività, non configurazione. I visualizzatori no. Non è `values.write`, perché un helper non scrive alcun tag.

Impostare un helper è una chiamata a un servizio di entità, la stessa chiamata che accetta ogni altra entità:

```
POST /api/services/input_counter/increment   {"entity_id": "input_counter.scrap", "reason": "short shot"}
POST /api/services/timer/start               {"entity_id": "timer.purge", "duration": "0:15:00"}
```

La risposta dice che cos'è ora l'helper: `{"call_id": "...", "state": "13", "writes": []}`. Funziona anche `?dry_run=true`, che risponde con le stesse parole della chiamata vera, senza cambiare nulla.

Nella schermata Entità un helper ha un riquadro suo, mai accorpato ad altri (non ha tag con cui accorpare), con i suoi controlli per chi ha `helpers.write`. Ogni modifica viene prima confermata, con un motivo, come ogni altro comando.

Da MCP non c'è nessuno strumento nuovo: `list_entities` trova gli helper, `get_states` li legge, `call_service` li imposta. Un agente modifica un helper solo in un'installazione con `HOTLOOP_ALLOW_WRITES` attivo, lo stesso interruttore che serve per scrivere un tag. Un helper non muove nessuna apparecchiatura, ma è ciò su cui agiscono le regole, e un agente che commuta l'interruttore del cambio formato è un agente che avvia qualunque cosa faccia la regola del cambio formato.

## Rifiutato, mai limitato

Un valore che un helper non accetta viene rifiutato e non cambia nulla:

- un numero fuori da `min`..`max`, o fuori dal suo `step` (contato a partire da `min`);
- un `increment` che supererebbe `max`, un `decrement` che scenderebbe sotto `min` (rifiutato, non fermato al limite: «fermato al limite» è un valore che nessuno ha chiesto);
- un'opzione che non è tra le scelte possibili; `select_next` oltre l'ultima scelta con `cycle: false`;
- un testo più lungo di `max_length`, o che non corrisponde a `pattern` (deve corrispondere tutto il testo);
- un conteggio che non è un numero intero, o che supera `min` o `max` del contatore;
- un timer messo in pausa quando non è in esecuzione, annullato o terminato quando è inattivo, o avviato per meno di un secondo o più di sette giorni;
- un helper disabilitato; un chiamante senza `helpers.write`; un agente con le scritture MCP disattivate.

Ogni rifiuto è un avviso nel log di sistema (`GET /api/events`) a carico dell'helper, con chi l'ha chiesto e perché è stato rifiutato, esattamente come il rifiuto del riconoscimento di un allarme. Un errore nella richiesta stessa (un campo che il servizio non accetta, `"50"` dove va un numero) è un errore del chiamante, riceve risposta 400 e non cambia né registra nulla.

## Dove vengono registrate le modifiche

Ogni modifica è una riga nel log di sistema a carico dell'helper: chi, da che cosa, a che cosa, l'id della chiamata, da dove proveniva e il motivo, se ne è stato dato uno.

```
otto   input_counter.increment: 12 -> 13; reason: short shot
system timer finished: active -> idle, due at 2026-09-27T21:10:00Z
```

La riga viene scritta nella stessa transazione del valore, quindi non c'è mai una modifica senza la sua riga né una riga senza la sua modifica.

Una variazione di stato è anche una riga nel [registro](/it/iot/logbook/), in quella stessa transazione, con lo stesso chi, la stessa origine e lo stesso id di chiamata. La scrive il processo che ha fatto la modifica, qualunque sia, quindi anche la modifica di un agente tramite `--mcp-stdio` viene registrata, e una volta sola. Le righe degli helper non hanno mai un limite di frequenza: ognuna è qualcuno che decide qualcosa. Una chiamata che lascia lo stato com'era (un numero impostato al valore che ha già) è nel log di sistema ma non nel registro, perché non è cambiato nulla.

## Riavvii

Un helper conserva il suo valore dopo un riavvio: il Gateway torna con il turno ancora B e il contatore ancora a 13. Impostate `restore: false` su uno che deve ripartire da zero ogni volta (un contatore «dall'ultimo riavvio»): il Gateway lo riporta al valore iniziale all'avvio e lo scrive nel log. Lo fa solo il Gateway stesso. Un processo `--mcp-stdio` che un agente avvia accanto a un Gateway in esecuzione ha gli stessi helper e sente ogni modifica, ma non azzera mai nulla, perché azzerare i valori dell'impianto perché si è collegato un agente sarebbe assurdo.

## Timer

Un timer corre sull'orologio a muro. Avviato per dieci minuti, termina dieci minuti dopo qualunque cosa accada nel frattempo: un riavvio durato due minuti gli lascia otto minuti da correre. Un timer in pausa resta in pausa, con il tempo che gli restava, attraverso un numero qualsiasi di riavvii, e `start` lo riprende.

Un timer scaduto **mentre HotLoop non era in esecuzione** torna a `idle` al successivo avvio di HotLoop, con `finished_late_at` impostato a quando era dovuto, e un avviso nel log. **Per lui non scatta nulla.** Una regola che aspetta che quel timer diventi inattivo non viene eseguita, perché la prima occhiata del motore dopo un avvio è un riferimento, non una variazione. Ciò che stava misurando (uno spurgo, una polimerizzazione) è avvenuto molto tempo fa o non è avvenuto affatto, e farlo adesso, in ritardo e senza che nessuno lo chieda, è peggio che dire che è stato perso. Cercate `finished_late_at` e decidete.

Un timer non è un interblocco. Corre sull'orologio di un processo, attraverso un database e una rete, al secondo e di solito al millisecondo. Tutto ciò che deve fermarsi in tempo appartiene al PLC.

## Pianificazioni

Una pianificazione è attiva dentro i suoi blocchi e inattiva fuori:

```json
{"schedule": {
  "mon": [{"from": "06:00", "to": "14:00", "data": {"crew": "A"}},
          {"from": "14:00", "to": "22:00", "data": {"crew": "B"}}],
  "fri": [{"from": "22:00", "to": "06:00", "data": {"crew": "C"}}]
}}
```

- I giorni vanno da `mon` a `sun`. Un orario è `HH:MM` o `HH:MM:SS`; `24:00` è la fine di un giorno.
- Un blocco il cui `to` è precedente al suo `from` supera la mezzanotte: dalle 22:00 alle 06:00 del venerdì è attivo fino alle 06:00 di sabato.
- I blocchi che si toccano sono un unico tratto attivo; i blocchi che si sovrappongono vengono rifiutati, perché decidere quali dati valgano sarebbe tirare a indovinare.
- Finché un blocco è attivo, il suo `data` è negli attributi dell'entità (`crew: "B"`), e `next_event` dice sempre quando la pianificazione cambierà.
- Viene letta sull'orologio a muro del fuso orario del sito (`HOTLOOP_SITE_TIMEZONE`), perché un turno che inizia alle 06:00 inizia alle 06:00 anche nel giorno del cambio d'ora. La notte in cui le lancette vanno avanti, l'ora che non avviene non è attiva; la notte in cui tornano indietro, l'ora che avviene due volte è attiva entrambe le volte.

## Più di un processo

Ogni modifica viene annunciata con un `NOTIFY` di Postgres, e ogni processo che detiene gli helper ascolta. Un helper impostato in un processo mostra il suo nuovo valore in tutti gli altri entro un andata e ritorno, un helper creato o eliminato in uno compare o sparisce negli altri, e una modifica fatta con `PUT /api/helpers/{entity_id}` viene recepita allo stesso modo (una fatta con `PUT /api/entities/{entity_id}` raggiunge gli altri alla loro successiva sincronizzazione del registro, come quella di qualsiasi entità). Ogni scrittura è condizionata alla revisione della riga, quindi due processi che incrementano lo stesso contatore insieme non perdono mai un conteggio, e un timer che entrambi detengono viene terminato da uno solo dei due.

## Backup

Gli helper sono in ogni backup: la loro configurazione con le entità e i loro valori in `helper_state`, revisioni comprese. Un impianto ripristinato torna con il turno, gli obiettivi e i conteggi che aveva, e un timer che era in esecuzione è ancora in esecuzione sull'orologio a muro (oppure, se nel frattempo è scaduto, inattivo e contrassegnato come in ritardo, come sopra).

## Nelle automazioni

Un helper è ciò su cui le regole agiscono e che le regole impostano:

```json
{"triggers": [{"type": "state", "entityId": "input_boolean.changeover", "to": "on"}],
 "actions": [{"type": "call_service", "params": {"entityId": "number.line_2_speed_sp",
   "service": "number.set_value", "data": {"value": 0}}}]}
```

La scrittura della regola sul tag passa dal write gate come ogni altra, con la regola come attore. `states['input_select.shift'] == 'B'` funziona in una condizione, e una regola può impostare un helper con `call_service` nello stesso modo in cui aziona un interruttore.
