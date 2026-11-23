---
title: "Blueprint di regole"
description: "Scrivi una regola una volta, con degli spazi vuoti, e compilala per ogni pompa. Ogni regola tiene la sua versione del blueprint: una modifica non ne cambia 40."
---

Un blueprint è una regola scritta una volta sola, con degli spazi vuoti. «Quando *questo motore* è in funzione da più di *questo tempo*, segnalalo e fermalo se *te lo chiedo io*.» Chi sa che cosa deve fare la regola la scrive una volta. Tutti gli altri compilano gli spazi, per pompa, per serbatoio, per linea, e ottengono alla fine un'automazione normale.

L'alternativa è quella che ogni stabilimento ha già: la stessa regola copiata su quaranta pompe, poi corretta su trentasette il giorno in cui qualcuno trova l'errore. Le copie divergono. Un blueprint e quaranta serie di ingressi no.

Ciò che ne esce è una regola normale. Compare nella schermata Automazioni accanto a quelle scritte a mano, viene armata dallo stesso motore e ogni scrittura che fa passa dal cancello di scrittura come `automation:<id>`, sottoposta ad audit, rifiuti compresi. Non esiste un runtime dei blueprint né una porta di servizio. C'è un modulo, e c'è una regola.

## L'unica regola sui blueprint

**Una regola conserva la versione del blueprint da cui è stata creata.**

Modifica un blueprint e la sua versione aumenta. Nessuna regola creata da esso cambia. La regola della pompa 7, giusta il martedì, non diventa in silenzio un'altra regola perché mercoledì qualcuno ha modificato il suo blueprint pensando alla pompa 12, quando la pompa 7 è quella che allaga lo scantinato.

Portare una regola alla nuova versione è un **aggiornamento**, e un aggiornamento è qualcosa che una persona richiede:

1. La schermata Automazioni lo indica sulla regola: *Dal blueprint Motore in funzione troppo a lungo, versione 1* e *versione 2 disponibile*.
2. **Rivedi aggiornamento** mostra esattamente che cosa cambia, parte per parte, prima e dopo, e che cosa farebbe la regola se scattasse adesso, con ogni scrittura sottoposta ai controlli del cancello. Non è ancora cambiato nulla.
3. **Aggiorna** inserisce esattamente ciò che è stato rivisto. Se nel frattempo il blueprint è andato avanti ancora, o qualcun altro ha aggiornato la regola, l'operazione viene rifiutata e riguardi. Entra ciò che hai rivisto, oppure non entra nulla.

Viene registrato con chi l'ha fatto: *automazione aggiornata dal blueprint pump_watch dalla versione 1 alla 2*.

Se qualcuno ha modificato la regola a mano dopo la sua creazione, la revisione mostra quella modifica come sostituita. La modifica di nessuno scompare senza essere prima comparsa a schermo.

## Com'è fatto

```json
{
  "id": "pump_watch",
  "name": "Pump start watch",
  "description": "Says when a pump starts, with the limit it runs to.",
  "inputs": [
    {"name": "pump", "label": "Pump", "type": "entity", "domain": ["switch"], "required": true},
    {"name": "limit", "label": "Limit", "type": "number", "min": 0, "max": 100, "step": 5, "unit": "%", "required": true}
  ],
  "template": {
    "triggers": [{"type": "state", "entityId": {"!input": "pump"}, "to": "on"}],
    "condition": "float(states['sensor.tank_level']) < ${limit}",
    "actions": [
      {"type": "log_event", "params": {"message": "${pump} started, running to ${limit}%"}}
    ],
    "mode": "skip"
  }
}
```

- **`id`** è composto da lettere minuscole, cifre e trattini bassi, e inizia con una lettera.
- **`inputs`** sono gli spazi vuoti, tipizzati. Gli stessi campi che si trovano nel resto di HotLoop: `number` con `min`, `max`, `step` e `unit`, `text` con `max_length` e `pattern`, `boolean`, `select` con `options`, `entity` con i `domain` che accetta, `duration` (secondi, oppure `90s`, `1h30m`), `alarm` e `tag`. Ognuno può essere `required` o avere un `default`.
- **`template`** è la regola: `description`, `triggers`, `condition`, `actions`, `mode`, `minIntervalSec`, `maxRuntimeSec`, nel linguaggio delle automazioni ([Automazioni](/it/iot/automations/)). Non il suo `id`, `name` o `enabled`. Quelli appartengono a ogni regola creata da esso.

### Gli spazi vuoti

**`{"!input": "pump"}`** come valore viene sostituito dal valore dell'ingresso, con il suo tipo: un entity_id arriva in `entityId` come stringa, una durata arriva in `forSec` come numero. Un ingresso facoltativo che nessuno ha compilato è `null`.

**`${pump}`** dentro una stringa viene sostituito anch'esso, e il modo dipende da dove si trova:

- In un'espressione (la `condition` di una regola, l'`expression` di un'azione, un valore in `dataExpressions`, `argExpressions`, `fieldExpressions` o `paramExpressions`, e tutto ciò che sta tra `{{` e `}}` in un messaggio) entra come **letterale**. Una stringa è tra virgolette, un numero è un numero, `true`, `false`, `nil`. Quindi la condizione qui sopra, con un limite di 40, diventa `float(states['sensor.tank_level']) < 40`.
- Ovunque altrove è testo semplice: `switch.pump_1 started, running to 40%`.

**`${counter.domain}`** è il dominio di un ingresso di tipo entità, per un nome di servizio che deve corrispondere al tipo di entità scelto: `"${counter.domain}.reset"` è `counter.reset` per il contatore di un PLC e `input_counter.reset` per un contatore ausiliario.

Questo uso delle virgolette è l'intero motivo per cui un ingresso di testo è sicuro da usare in un'espressione. Scrivi `' || true || '` in un ingresso di testo e la condizione confronta con quella stringa, esattamente come digitata. Non diventa mai parte dell'espressione. E un ingresso di testo non può contenere `{{` per niente: ogni messaggio inviato da una regola esegue come espressione ciò che sta tra `{{` e `}}` al momento dell'invio, e un valore digitato in un modulo non arriva mai a diventarlo.

### Controllato al salvataggio

Un blueprint viene controllato prima di essere memorizzato, non quando qualcuno lo prova:

- ogni spazio vuoto nomina un ingresso, e `.domain` segue solo un ingresso di tipo entità;
- ogni ingresso è usato da qualche parte. Un ingresso che il modello ignora è un campo di modulo che non fa nulla, e qualcuno ci perderà un pomeriggio;
- compilato con valori di esempio del tipo di ciascun ingresso (il suo valore predefinito, se ne ha uno), il modello produce una regola che compila. Un ingresso di testo che diventa un URL richiede un `pattern` che lo dica, `https?://\S+`, altrimenti il controllo degli URL rifiuta l'esempio.

## Compilarne uno

Nella schermata **Blueprints**, **Usa** apre il modulo: l'id e il nome della regola, e ogni ingresso come il controllo giusto, un numero con il suo intervallo, un elenco, un selettore di entità. Poi:

- **Controlla prima** risponde con la regola che verrebbe creata e con ciò che farebbe se scattasse adesso: la condizione valutata, ogni scrittura e chiamata di servizio sottoposta ai controlli propri del cancello di scrittura come `automation:<id>`, e il primo rifiuto con le parole del cancello. Non viene memorizzato, scritto né sottoposto ad audit nulla.
- **Crea la regola** la crea, armata a meno che tu non tolga la spunta, e compare nella schermata Automazioni indicando da dove viene.

Ogni ingresso viene controllato per primo e **mai adattato a forza**. 150 per un ingresso con massimo 100 viene rifiutato, non portato in silenzio a 100. `"12"` per un numero viene rifiutato, non interpretato. Tutti gli ingressi errati vengono segnalati insieme, quindi il modulo torna con l'elenco completo. Un valore che la regola stessa rifiuta (una durata di due giorni per un'attesa che può essere di un giorno al massimo) viene rifiutato con le parole della regola. Non si crea nulla finché tutto non è giusto.

Creare una regola **non ne sostituisce mai una**. Un id già occupato, da una regola scritta a mano o creata da un blueprint, viene rifiutato.

Tramite l'API è `POST /api/blueprints/{id}/instantiate`, con `?dry_run=true` per il controllo. Vedi [l'API HTTP](/it/iot/api/#blueprint).

## Quelli integrati

Sono inclusi nel binario. Sono di sola lettura; **Copia** ne crea uno tuo con un nuovo id, dalla versione 1, da modificare come vuoi.

| Blueprint | Ingressi | Che cosa fa la regola |
|---|---|---|
| `motor_running_too_long` | un motore, per quanto può restare in funzione (di default un'ora), se fermarlo | Quando il motore è rimasto `running` per quel tempo di fila, registra un avviso. Se richiesto, lo ferma con `motor.stop`. |
| `tank_high_level_stop_pump` | un sensore di livello, il limite, la pompa (un motore) | Quando il livello è al limite o sopra, la qualità della lettura è buona e la pompa non è già ferma, ferma la pompa e lo registra. |
| `alarm_to_notify` | un allarme, lo stato su cui agire (di default `unack-active`), un URL webhook | Quando l'allarme passa a quello stato, invia in POST `{"text": "Alarm temp-hi is unack-active"}` all'URL. |
| `device_silent_cycle_its_port` | il sensore di connessione di un dispositivo, per quanto può restare in silenzio (di default 5 minuti), il tag di spegnimento e riaccensione del dispositivo UniFi e della sua porta, quanto attendere dopo (di default 3 minuti), un allarme, l'intervallo minimo tra le esecuzioni (di default un'ora) | Quando il dispositivo è spento da quel tempo, spegne e riaccende una volta l'alimentazione della porta del suo switch tramite il cancello di scrittura, attende che torni e, se non è tornato, fa scattare l'allarme. Il driver rifiuta un secondo ciclo della stessa porta entro 15 minuti e non cicla mai una porta che porta la rete. |
| `shift_schedule_counter_reset` | un ausiliario di pianificazione, un contatore (di un PLC o ausiliario) | Quando la pianificazione si attiva, azzera il contatore e lo registra. |

Qualche nota sincera su di essi:

- **`tank_high_level_stop_pump` è una comodità, non un interblocco.** Uno scatto che protegge le persone o lo stabilimento va nel PLC, cablato dove deve stare, non in qualcosa che gira su una rete. Questo evita a qualcuno di sorvegliare un livello. Non sostituisce l'interruttore di livello alto.
- Non agisce su una lettura di cui non può fidarsi. Un livello con qualità cattiva non ferma nulla, perché un arresto basato su un numero spazzatura è comunque un arresto.
- **`shift_schedule_counter_reset` scatta quando la pianificazione si attiva**, e due blocchi di pianificazione che si toccano sono un unico tratto di attivo. Quindi dai a ogni turno il suo blocco, con la pianificazione spenta tra l'uno e l'altro, anche solo per un minuto (06:00 a 13:59, 14:00 a 21:59), altrimenti solo il primo turno della serie azzera il contatore.
- **`alarm_to_notify`** è per una chat o un sistema di ticket. Per chiamare un telefono, con limiti di frequenza, nuovi tentativi e link di conferma, usa le notifiche che HotLoop invia da sé ([Notifiche di allarme](/it/iot/notifications/)).

## Chi può fare cosa

| <span class="sr-only">Dettagli</span> | visualizzatore | operatore | amministratore |
|---|---|---|---|
| Vedere i blueprint (`blueprints.read`) | sì | sì | sì |
| Creare una regola da uno, aggiornarne uno (`blueprints.apply`) | no | sì | sì |
| Scrivere, modificare, copiare, eliminare uno (`blueprints.write`) | no | no | sì |

Perché gli operatori possono creare regole: il blueprint è il punto in cui un ingegnere ha deciso che cosa fa la regola, e scegliere quale pompa controlla è esattamente la scelta che un operatore fa tutto il giorno. La parte pericolosa, ciò che la regola comanda, è stata decisa quando il blueprint è stato scritto, da qualcuno che possiede `blueprints.write`. Eliminare o modificare a mano la regola dopo resta `automations.write`, da amministratore.

L'eliminazione di un blueprint da cui è stata creata una regola viene rifiutata, con i nomi delle regole. Eliminale prima. Un blueprint integrato non può essere modificato né eliminato.

## Agenti

Un agente ottiene `list_blueprints`, `preview_blueprint` e `instantiate_blueprint` (e `upgrade_blueprint_automation`, `create_blueprint`, `update_blueprint` e `delete_blueprint`): trova il blueprint giusto, ricava gli ingressi, mostra che cosa farebbe la regola e la crea, per la stessa via che usa la schermata, con gli stessi controlli sugli ingressi e il nome dell'agente accanto nel registro di bordo. Una regola è un ordine permanente di comandare le apparecchiature ogni volta che scatta il suo trigger, quindi l'anteprima viene prima, e ogni scrittura che la regola fa in seguito incontra il cancello di scrittura. Vedi [MCP](/it/iot/mcp/#blueprint).

## Dove finisce tutto

- **I blueprint** scritti dallo stabilimento sono nella tabella `blueprints`. Quelli integrati sono nel binario e non vengono mai memorizzati.
- **Una regola creata da uno** è una riga di `automations` come tutte le altre, con `blueprint_id`, `blueprint_version` e `blueprint_inputs` che indicano da dove viene. `GET /api/automations` li restituisce come `blueprintId`, `blueprintVersion` e `blueprintInputs`.
- **Ogni modifica** è nel log di sistema e nel registro di bordo, con chi l'ha fatta: *blueprint creato*, *blueprint salvato, ora versione 2*, *automazione creata dal blueprint motor_running_too_long versione 1*, *automazione aggiornata dal blueprint pump_watch dalla versione 1 alla 2*, *blueprint eliminato*.
- **I backup** contengono sia i blueprint sia la versione fissata di ogni regola, così uno stabilimento ripristinato offre esattamente gli aggiornamenti che offriva prima. Un backup precedente ai blueprint ripristina ogni regola come scritta a mano.
- Una regola il cui blueprint non c'è più (un blueprint integrato che una versione successiva ha tolto, per esempio) continua a funzionare esattamente com'è. Semplicemente non c'è nulla a cui aggiornarla.
