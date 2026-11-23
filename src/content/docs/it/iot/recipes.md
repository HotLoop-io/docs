---
title: "Ricette di prodotto"
description: "I setpoint di un grado di prodotto applicati in un colpo solo: controllati per intero, rifiutati per intero, scritti in ordine e riletti dal dispositivo."
---

Una ricetta è un insieme di valori che vanno insieme verso lo stabilimento. Le temperature di zona, la velocità di linea e la luce della filiera del grado A. Il cambio alla bottiglia da 500 ml. L'abbassamento notturno. Ogni stabilimento ha queste cose, e ogni stabilimento ha da qualche parte un foglio plastificato con i numeri e un operatore che li digita uno alla volta, e ogni stabilimento ha la storia della notte in cui uno di loro è stato digitato sbagliato.

Quindi i numeri vivono qui, e partono in un colpo solo: controllati per interi prima, inviati in ordine, riletti dal dispositivo dopo, ciascuno registrato. Ogni ricetta è anche un'entità, `scene.<id>`. È pensata per apparecchiature che possono far male a qualcuno, ed è per questo che la maggior parte di questa pagina parla di ciò che succede quando qualcosa va storto.

## Com'è fatta una

```json
{
  "id": "grade_a",
  "name": "Grade A",
  "description": "The 2pm run. Die at 210, line at whatever the order says.",
  "equipment_id": 7,
  "apply_permission": "recipes.apply",
  "params": [
    {"name": "speed", "label": "Line speed", "type": "number", "min": 0, "max": 400, "step": 10, "unit": "rpm", "required": true}
  ],
  "precondition": "states['input_boolean.line_ready'] == 'on'",
  "targets": [
    {"entity_id": "loop.line_02_die_tic", "service": "set_mode", "data": {"mode": "auto"}},
    {"entity_id": "loop.line_02_die_tic", "service": "set_setpoint", "data": {"value": 210}},
    {"entity_id": "number.line_02_speed", "service": "set_value", "data_expressions": {"value": "vars.speed"}},
    {"entity_id": "switch.line_02_heater", "service": "turn_on"},
    {"entity_id": "input_select.product", "service": "select_option", "data": {"option": "Grade A"}}
  ],
  "verify_sec": 10
}
```

- **`id`** è composto da lettere minuscole, cifre e trattini bassi, e inizia con una lettera. È l'id oggetto della sua entità, `scene.grade_a`, e non cambia mai.
- **`equipment_id`** è il nodo dell'albero delle apparecchiature a cui appartiene la ricetta, per ritrovarla. La schermata Ricette raggruppa per esso. Omettilo per una ricetta dell'intero stabilimento.
- **`params`** sono ciò che prende un'applicazione: gli stessi campi tipizzati che ha uno script (`model.Field`: `number` con `min`, `max`, `step` e `unit`, `text`, `boolean`, `select`, `entity`, `duration`, `alarm`, `tag`). Una destinazione ne legge uno come `vars.<name>` in una voce di `data_expressions`.
- **`precondition`** è un'espressione nel linguaggio delle automazioni che deve essere vera perché la ricetta parta. Omettila e non ce n'è nessuna.
- **`targets`** sono i valori, **nell'ordine in cui partono**. Ognuno è un'entità, il servizio che la imposta e i dati di quel servizio, come valore (`data`) o calcolati dai parametri (`data_expressions`). Fino a 200.
- **`verify_sec`** è il tempo concesso a ogni valore scritto per comparire in una lettura del dispositivo. Da 1 a 600, di default 10.

### Che cosa può essere una destinazione

Una ricetta **imposta valori**. I servizi che accetta sono quelli che lasciano l'apparecchiatura con un valore:

| Dominio | Servizi |
|---|---|
| `switch`, `input_boolean` | `turn_on`, `turn_off` |
| `number`, `input_number`, `input_counter` | `set_value` |
| `text`, `input_text` | `set_value` |
| `select`, `input_select` | `select_option` |
| `valve` | `set_position` |
| `motor` | `set_speed` |
| `loop` | `set_setpoint`, `set_mode` |

La pressione di un pulsante, l'avvio di un motore, l'azzeramento di un contatore, l'arresto di una valvola: rifiutati al salvataggio. Sono azioni, non valori, e appartengono a uno [script](/it/iot/scripts/). «Applica il grado A» che preme un pulsante di azzeramento ogni volta che qualcuno la applica non è ciò che nessuno intende per ricetta, e il giorno in cui succede durante una produzione è il giorno in cui lo scopri. Anche il toggle è rifiutato: una ricetta che inverte un interruttore fa il contrario una volta su due.

L'entità di una destinazione deve esistere al salvataggio, le sue espressioni devono compilare, e la stessa entità non può essere impostata due volte dallo stesso servizio (due valori per un'unica impostazione, e quale vincerebbe dipenderebbe da un ordine che nessuno legge). La modalità e il setpoint di un anello sono due impostazioni ed entrambe possono essere impostate; imposta prima la modalità, perché un setpoint per l'automatico non significa nulla per un anello rimasto in manuale.

## Applicarne una

Dalla schermata Ricette, dal riquadro della ricetta nella schermata Entità, da un passo `apply_recipe` di una regola o di uno script, dall'`apply_recipe` di MCP, o con `POST /api/services/scene/turn_on`. Ognuno di essi fa esattamente questo:

### 1. Controllata per intero, rifiutata per intero

Prima che un solo valore vada da qualche parte:

- I parametri vengono controllati rispetto ai loro campi. **Un valore non viene mai spostato per adattarlo.** 450 in un campo il cui massimo è 400 viene rifiutato, non ridotto a
  400. `"250"` per un numero viene rifiutato, non interpretato. 255 su un passo di 10 viene rifiutato, non arrotondato. Il numero che va allo stabilimento è esattamente quello che qualcuno ha inserito, oppure non va nulla.
- Il permesso proprio della ricetta, quando ne nomina uno (più sotto), e gli interruttori di scrittura di MCP, per un agente.
- La precondizione viene valutata rispetto allo stabilimento com'è adesso.
- Ogni espressione di dati viene valutata. Una che fallisce rifiuta la ricetta; una destinazione non viene mai inviata senza il valore che avrebbe dovuto avere.
- Nient'altro in questo processo può stare scrivendo su una delle sue entità (più sotto).
- **Ogni destinazione viene sottoposta ai controlli propri del cancello di scrittura**, gli stessi che incontrerà la sua scrittura: scritture attive, tag scrivibile, valore nell'intervallo del tag, entità abilitata e d'accordo con il valore (il suo passo, le sue opzioni, un anello in manuale per la sua uscita), dispositivo connesso. `Services.Check`, che per un tag è `runtime.Manager.CheckWrite`. Non viene scritto né registrato nulla.

**Se qualcosa fallisce, l'intera ricetta viene rifiutata e non viene scritto nulla.** Non le prime dieci destinazioni e poi un rifiuto. Nulla. E ricevi tutti i motivi, non solo il primo: a un operatore a cui si dice un problema, lo risolve e gli si dice il successivo, e una ricetta di quaranta destinazioni va sistemata in un colpo solo. Ogni destinazione dice quale era: `would_write`, `refused` con le parole del cancello, oppure `not_sent`.

### 2. Scritta in ordine, un id di chiamata, mai annullata

Poi le destinazioni partono in ordine, ognuna tramite `Services.Call` e quindi tramite `runtime.Manager.Write`, l'unico cancello di scrittura. Non c'è nessuna porta di servizio. Ogni scrittura porta l'**id di chiamata** dell'applicazione, quindi l'intera applicazione è `GET /api/writes?call=<id>`, nella traccia di audit, accanto a ogni altra scrittura che lo stabilimento abbia mai accettato.

Un controllo può passare e la scrittura fallire un attimo dopo. Un PLC risponde a una scrittura con un'eccezione. Qualcuno calcia un cavo. Qualcuno disarma un tag tra il controllo e la scrittura. **La prima destinazione che non passa ferma l'applicazione.** Quelle dopo non vengono inviate e riportano `skipped`.

**Nulla di ciò che è già stato scritto viene annullato.** È voluto, ed è la regola che segue ogni scrittura di HotLoop. Annullare è di per sé una scrittura: fatta senza che nessuno la chieda, su apparecchiature che si sono già mosse, in base a ciò che crediamo fosse il valore prima, nell'esatto momento in cui qualcosa ha appena dimostrato che lo stabilimento non si comporta come ci aspettavamo. È così che una ricetta applicata a metà diventa una linea completamente confusa. Decidere che cosa fare di una ricetta applicata a metà è compito dell'operatore, e ottiene esattamente le informazioni per farlo:

```text
PARTIAL v3: 2 of 5 written before one failed, nothing undone
  1. set_mode loop.line_02_die_tic: written, verified
  2. set_setpoint loop.line_02_die_tic: written, verified
  3. set_value number.line_02_speed: failed: the device answered the write with an exception
  4. turn_on switch.line_02_heater: skipped
  5. select_option input_select.product: skipped
```

Una destinazione è `written`, `failed` (è partita e il dispositivo ha detto di no, o non ha detto nulla, quindi non si sa se l'abbia presa), `not_sent` (il cancello l'ha respinta all'ultimo momento) oppure `skipped`. L'applicazione è `applied` (ogni destinazione scritta), `partial` (alcune lo sono state) oppure `failed` (la prima no).

La schermata Ricette offre allora **Applica le destinazioni rimanenti**. È una nuova applicazione, delle destinazioni che non sono state scritte, con la stessa versione e gli stessi parametri, controllata di nuovo per intero prima, sottoposta ad audit con un id di chiamata proprio, con `application:<id>` come genitore così le due si trovano insieme. Non è mai automatica. Qualcuno guarda che cosa è successo, sistema ciò che l'ha fermata e preme il pulsante.

### 3. Riletta

Scritto non è la stessa cosa di preso. Un PLC può accettare una scrittura e la sua logica sovrascriverla alla scansione successiva. Un registro scalato può prendere 12,34 e tenere 12,3. Quindi, dopo l'ultima scrittura, ogni valore scritto viene riletto:

- per una destinazione su un dispositivo, solo da una lettura **fatta dopo la sua scrittura**, così la cache che ricorda ciò che il dispositivo aveva detto prima non può confermare nulla;
- dallo stato dell'entità o, per una valvola, un motore e un anello, dall'attributo che il servizio imposta (`current_position`, `speed`, `setpoint`, `mode`);
- un numero entro un milionesimo di sé stesso (un registro float restituisce 0,1 come 0,10000000149, che è lo stesso setpoint), qualsiasi altra cosa esattamente.

Ogni destinazione scritta è **`verified`** una volta riletta, oppure **`unconfirmed`** se non lo è stata entro `verify_sec`, con ciò che è stato letto al suo posto:

```text
  3. set_value number.line_02_speed: written, unconfirmed (not confirmed within 10s: read back 240, not 250)
```

Il non confermato è mostrato in **ambra**, mai in verde, nella schermata Ricette, ed è un avviso nel registro di bordo e nel log di sistema. Non è un fallimento: il valore è partito e il dispositivo l'ha accettato, e l'applicazione resta `applied`. È un segnale che dice vai a guardare, perché potrebbe non essere stato preso. Un ausiliario tiene il proprio valore, quindi una destinazione ausiliaria viene verificata direttamente da esso.

La risposta torna quando la rilettura è finita, quindi applicare una ricetta richiede fino a `verify_sec`.

## Sovrapposizione

Due ricette che intrecciano le loro scritture sullo stesso setpoint lo lasciano a quello che è arrivato per ultimo, che non è la ricetta di nessuno. Quindi, mentre un'applicazione scrive e rilegge, trattiene ogni entità che ha come destinazione, e un'altra applicazione che ne abbia una come destinazione viene rifiutata, `409`, con la ricetta che è di mezzo. Aspettala, poi applica.

Questo è trattenuto nel processo: un'applicazione dal Gateway e una da un processo `--mcp-stdio` accanto non si trattengono a vicenda. Usa un solo scrittore, oppure tieni le ricette dell'agente e quelle degli operatori su apparecchiature diverse.

## Versioni

Il nome, la descrizione, il nodo dell'apparecchiatura e il permesso di una ricetta sono della ricetta e cambiano sul posto. **Ciò che scrive è una versione, e una versione non viene mai modificata.** Salvare destinazioni diverse, parametri diversi, una precondizione diversa o un `verify_sec` diverso memorizza la versione successiva e la rende quella corrente. La versione 3 è esattamente ciò che era il giorno in cui è stata salvata, per sempre, e ogni applicazione registra la versione e i parametri con cui è stata eseguita. Ciò che è andato allo stabilimento martedì scorso ha sempre una risposta.

- Cambiare solo il nome, o solo la nota, non crea una versione.
- Un salvataggio fatto su una versione che qualcun altro ha nel frattempo sostituito viene rifiutato, `409`, invece di buttare via in silenzio la sua modifica. L'editor invia la versione che stava modificando.
- Una versione più vecchia può essere applicata di proposito: sceglila nel pannello di applicazione, oppure `"version": 2`. L'applicazione dice che era la versione 2.
- Il pannello Versioni mostra ogni versione con chi l'ha salvata, la sua nota e che cosa è cambiato rispetto alla precedente, destinazione per destinazione.

Eliminare una ricetta ne elimina le versioni. Le sue applicazioni vengono conservate: sono ciò che è stato inviato allo stabilimento, e quella cronologia sopravvive alla ricetta.

## Acquisirne una

Nessuno scrive a mano una ricetta di quaranta destinazioni quando la linea sta già producendo il grado A. **Acquisisci** prende le entità che scegli e prepara la bozza di una ricetta che reimposta ciascuna a ciò che contiene adesso, nell'ordine in cui le hai scelte: il valore di un numero, l'acceso o spento di un interruttore, l'opzione di un selettore, la posizione di una valvola, la velocità di un motore, la modalità di un anello e poi il suo setpoint. Le dai un nome, la sfoltisci, trasformi in parametri i numeri che cambiano a ogni ordine e la salvi.

Un'entità il cui valore non è noto, o non è affidabile, viene **rifiutata, non acquisita**: una lettura di qualità diversa da buona, `unknown`, `unavailable`, un'entità disabilitata. Una ricetta costruita da una lettura cattiva riscrive quella lettura cattiva nello stabilimento, ogni volta che qualcuno la applica.

## Chi può applicarne una

Gli operatori applicano le ricette (`recipes.apply`); gli amministratori le scrivono (`recipes.write`); tutti le leggono (`recipes.read`). Caricare il grado A è ciò per cui c'è l'operatore. Decidere che cos'è il grado A è una scelta da ingegnere.

Una ricetta può nominare un permesso proprio più ristretto: `"apply_permission": "recipes.apply.night_setback"`. Allora applicarla richiede anche quello, che il ruolo di operatore non possiede. Daglielo alle persone che possono applicare quella ricetta tramite il loro elenco di permessi:

```json
["recipes.read", "recipes.apply", "recipes.apply.night_setback"]
```

`recipes.apply.*` concede quello di ogni ricetta, e un amministratore possiede tutto. Un utente che non lo ha viene rifiutato, e **il rifiuto è a registro**: un'applicazione rifiutata nella cronologia della ricetta, con il suo nome, come ogni altra. Lo stesso vale tramite l'entità scene.

Un agente non possiede i permessi di alcun utente, quindi **un agente non applica mai una ricetta che nomina un permesso proprio**. Può leggerla e chiedere se verrebbe applicata; la risposta dice perché no.

## La precondizione

```json
"precondition": "states['input_boolean.line_ready'] == 'on' and float(states['sensor.line_02_die_temp']) < 250"
```

Il linguaggio delle automazioni, valutato rispetto allo stabilimento com'è quando qualcuno preme Applica, con i parametri come `vars`. Falso rifiuta la ricetta, dicendolo. È una protezione contro l'applicazione dei numeri giusti nel momento sbagliato, non un interblocco: un interblocco vive nel PLC, dove funziona ancora quando la rete no.

## Da una regola, uno script o un agente

Una regola o uno script ne applica una con un passo `apply_recipe` (vedi [Automazioni](/it/iot/automations/)):

```json
{"type": "apply_recipe", "params": {"recipeId": "grade_a", "params": {"speed": 250}}}
```

La applica come la regola, `automation:<id>`, o lo script, `script:<id>`, con la sorgente di quell'esecuzione su ogni scrittura, e il genitore dell'applicazione è l'esecuzione. Il passo fallisce a meno che ogni destinazione sia stata scritta; un valore non confermato non lo fa fallire, e la traccia dice `NOT confirmed by read-back`. Anche la prova a vuoto di uno script controlla la ricetta.

Tramite MCP, `list_recipes` mostra ogni ricetta con le sue destinazioni e i suoi parametri, `validate_recipe` chiede se una verrebbe applicata adesso e `apply_recipe` la applica, con un motivo **obbligatorio**. Le scritture di un agente portano la sorgente `mcp`, quindi il cancello si applica a ognuna di esse, e con le scritture disattivate (`HOTLOOP_ALLOW_WRITES`) `apply_recipe` viene rifiutato prima di controllare qualsiasi cosa. Vedi [MCP](/it/iot/mcp/#recipes).

## La sua entità

Ogni ricetta è un'entità `scene`, `scene.<id>`. Il suo stato è quando è stata applicata l'ultima volta (un'applicazione che ha scritto qualcosa), come marca temporale, e `unknown` finché non lo è mai stata. I suoi attributi dicono com'è andata l'applicazione più recente: `last_result`, `last_version`, `last_applied_by`, `last_application`, e `unconfirmed` quando altrettanti valori di una applicata non sono stati riletti. Il suo riquadro ha un pulsante Applica. `scene.turn_on` la applica, con `params` e `version` nei dati. Una regola può scattare sul suo stato, che cambia una volta per ogni applicazione che ha scritto qualcosa.

Eliminare una ricetta rende orfana la sua entità, come eliminare uno script.

## Il registro

Ogni applicazione, comprese quelle rifiutate, è una riga di `recipe_applications`: la ricetta, la versione, i parametri, chi, da dove, perché, l'id di chiamata, che cosa è successo a ogni destinazione e se è stata riletta. Viene aperta prima della prima scrittura e completata dopo la rilettura, quindi una in cui il processo muore a metà dice comunque che era iniziata. Il successivo avvio del Gateway la marca `failed`, `interrupted by restart`, puntando al suo id di chiamata nell'audit delle scritture. Nulla la riprende.

Ogni applicazione è una riga nel log di sistema sotto la scena, e una voce nel [registro di bordo](/it/iot/logbook/), di tipo `recipe`, accanto alle scritture che ha fatto. La cronologia di una ricetta conserva le sue 5000 applicazioni più recenti.

## Più di un processo

Ogni modifica a una ricetta e ogni applicazione viene annunciata a ogni processo sul database, quindi una ricetta salvata su un pod è quella che applica l'altro, e un'applicazione fatta da un processo `--mcp-stdio` muove l'entità scene del Gateway.

## Backup

Le ricette, ogni versione e ogni applicazione sono nei backup e tornano esattamente com'erano. Un'applicazione che il backup ha colto a metà torna come `applying` e viene marcata `failed` al primo avvio, come dopo un crash. Vedi [Backup e ripristino](/it/iot/backup/).

## L'API

[L'API HTTP](/it/iot/api/#ricette) ha ogni route. In breve:

| <span class="sr-only">Dettagli</span> | <span class="sr-only">Dettagli</span> |
|---|---|
| `GET /api/recipes` | ogni ricetta, il suo contenuto attuale e l'ultima applicazione |
| `POST /api/recipes` | crearne una, come versione 1 |
| `POST /api/recipes/capture` | una bozza da ciò che le entità contengono adesso |
| `PUT /api/recipes/{id}` | salvare; un nuovo contenuto è una nuova versione |
| `GET /api/recipes/{id}/versions` | ogni versione, com'è stata salvata |
| `POST /api/recipes/{id}/validate` | verrebbe applicata adesso? non viene scritto nulla |
| `POST /api/recipes/{id}/apply` | applicarla: `200` applicata, `409` rifiutata, `502` parziale o non riuscita |
| `GET /api/recipes/{id}/applications` | ogni applicazione, rifiuti compresi |
