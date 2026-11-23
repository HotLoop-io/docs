---
title: "Automazioni"
description: "Regole con dieci tipi di trigger, condizioni e sequenze, compilate al salvataggio, con ogni scrittura che passa dal gate di scrittura."
---

Una regola è fatta di tre cose: succede qualcosa, una condizione è vera, vengono eseguite delle azioni.

Le regole possono comandare le apparecchiature, quindi due proprietà non sono negoziabili.

**Le condizioni vengono compilate quando la regola viene salvata, non quando scatta.** Un errore di sintassi lo vede l'autore mentre ha ancora davanti l'editor, invece di una regola che non gira mai in silenzio o, peggio, che va in errore alle 3 di notte a metà di una sequenza già eseguita in parte. L'editor valida mentre scrivi; una regola che non compila viene rifiutata al salvataggio.

**Le condizioni vengono valutate in una sandbox.** [expr-lang](https://expr-lang.org) non ha I/O, non può raggiungere il filesystem né la rete, controlla i tipi in fase di compilazione e ha la garanzia di terminare. Quest'ultima proprietà conta più di tutte: una condizione viene valutata sul percorso che porta a una scrittura, e un linguaggio di espressioni che può girare all'infinito è uno che può bloccare il motore che tiene il lock di scrittura.

## Trigger

Basta che scatti un solo trigger per eseguire la regola.

| Tipo | Scatta quando | Campi chiave |
|---|---|---|
| `tag_change` | il valore di un tag cambia | `deviceId`, `tagName` |
| `threshold` | un valore **supera** un limite | `deviceId`, `tagName`, `threshold`, `direction`, `hysteresis` |
| `state` | lo stato di un'entità cambia, o mantiene uno stato per un certo tempo | `entityId`, `from`, `to`, `forSec` |
| `schedule` | scade un'espressione cron | `cron` |
| `interval` | ogni N secondi | `intervalSec` |
| `alarm` | un allarme entra in uno stato | `alarmId`, `alarmState` |
| `device_state` | un dispositivo si connette o cade | `deviceId`, `toState` |
| `webhook` | arriva un POST in ingresso | `webhookPath` |
| `mqtt` | un messaggio arriva su un topic | `topic` |
| `startup` | il processo parte | n/a |
| `sun` | alba, sorgere del sole, mezzogiorno solare, tramonto o crepuscolo nel sito, con uno scarto a piacere | `event`, `offsetSec` |

### Le soglie scattano all'attraversamento

`threshold` scatta quando un valore *attraversa* il limite, non finché resta sopra. Scattare su "il valore è sopra 200" significa che la regola scatta a ogni scansione in cui il valore resta alto, il che per una regola che comanda qualcosa è una tempesta di comandi.

`hysteresis` impedisce a un valore che oscilla sul limite di riarmare la regola a ogni ondeggiamento: una volta sopra, il valore deve scendere sotto `threshold - hysteresis` prima che il trigger possa scattare di nuovo.

```json
{
  "type": "threshold",
  "deviceId": "press-01", "tagName": "Zone1_Temp",
  "threshold": 200, "direction": "rising", "hysteresis": 5
}
```

`direction` è `rising`, `falling` o `either`. La prima lettura dopo l'avvio stabilisce un riferimento e non scatta, altrimenti ogni regola a soglia scatterebbe una volta all'avvio, qualunque sia il valore.

### I trigger di stato seguono le entità

`state` scatta quando cambia la stringa di stato di un'entità: da `off` a `on`, da `212.5` a `213`, da `on` a `unavailable`. `from` e `to` lo restringono. Se li ometti entrambi scatta a ogni cambio, compresi quelli da e verso `unavailable`, che di solito è ciò che vuoi per "avvisare qualcuno" e mai ciò che vuoi per "comandare qualcosa". Indica `to`.

```json
{
  "type": "state",
  "entityId": "binary_sensor.press_01_run",
  "from": "off", "to": "on"
}
```

Scatta sullo stato e su nient'altro. Un attributo che cambia, o la qualità che peggiora mentre lo stato tiene il suo ultimo valore buono, non è un cambio di stato.

Ecco esattamente quando scatta, perché una regola che comanda apparecchiature merita di saperlo. Il trigger segue il registro proprio del motore delle entità di ciò che è cambiato, non il bus dei tag. Il motore calcola lo stato di un'entità man mano che arrivano le letture e una volta al secondo ricalcola tutto come rete di sicurezza per un lotto che non è riuscito a prendere in tempo. Ogni cambio che calcola viene segnalato una volta, in ordine, e il trigger li vede tutti. Quindi:

- **Scatta una volta per cambio.** Il ricalcolo al secondo segnala solo ciò che si è mosso dall'ultima volta che il motore ha guardato, quindi non può segnalare un cambio due volte, e il ricaricamento di una regola non azzera nulla da cui un trigger di stato dipende.
- **Non perde un cambio che il motore ha visto.** Un bus lento costa un secondo di latenza, non il cambio.
- **Non può vedere un cambio che nessuno ha visto.** Una bobina che va off, on, off tra due interrogazioni non è mai cambiata per quanto riguarda l'impianto. Un trigger di stato vale quanto la scansione che c'è dietro e non di più. Se ti serve ogni fronte di un segnale veloce, fallo agganciare nel PLC.
- **L'avvio è un riferimento.** Ogni entità che compare quando il Gateway parte, o quando ne viene abilitata una, non è un cambio e non scatta.

Se le regole restano indietro di 10.000 cambi (il database troppo lento per registrare le esecuzioni che avviano), i più vecchi vengono scartati, contati e registrati, e `GET /api/diagnostics` mostra `stateChangesPending` e `stateChangesDropped` sotto `automations`.

Rinomina un'entità e ogni regola che nomina il suo vecchio `entity_id` smette di scattare. È il prezzo di nomi che hanno un significato; rinomina con consapevolezza e cerca prima nelle regole.

### Mantenere uno stato: forSec

"La pompa è in marcia da cinque minuti" è un trigger di stato con `forSec`. Il cambio avvia un timer invece di far scattare la regola; la regola scatta quando lo stato a cui è passato è rimasto tale per quel numero di secondi.

```json
{
  "type": "state",
  "entityId": "binary_sensor.press_01_run",
  "from": "off", "to": "on",
  "forSec": 300
}
```

- **Qualsiasi cambio di stato lo annulla.** Da on a off e di nuovo a on entro i cinque minuti sono due cambi: il primo chiude l'attesa, il secondo ne avvia una nuova da zero. Il tempo non si somma. Un passaggio a `unavailable` è anch'esso un cambio di stato, quindi un dispositivo che tace a metà attesa la annulla.
- **Conta solo lo stato.** Un attributo che cambia, o la qualità che peggiora mentre lo stato tiene, non la annulla, come non fa scattare un semplice trigger di stato. Se un'attesa non deve sopravvivere a una lettura cattiva, proteggi la condizione della regola con `qualities`.
- **Scatta una volta per attesa.** Tenere lo stato per un'ora fa scattare una regola da cinque minuti una sola volta, ai cinque minuti, non ogni cinque minuti.
- **Ogni regola ha il suo timer**, uno per trigger. Due regole sulla stessa entità con `forSec` diversi scattano ciascuna al proprio momento.
- **La traccia lo dice.** Un'esecuzione fatta scattare da un'attesa riporta `binary_sensor.press_01_run changed from off to on and held for 300s`, e `fromState`, `toState` e `entity` sono quelli del cambio che ha avviato l'attesa.
- **Un'attesa non sopravvive a un riavvio.** Sta in memoria e nulla la riarma: i minuti che una pressa aveva già fatto prima del riavvio non contano dopo. Ciò che il processo vede al ritorno è ogni entità che compare (un riferimento, non un cambio), di solito come `unknown`, e poi la prima lettura del dispositivo che la porta a ciò che legge. Con `"from": "off"` non corrisponde, quindi una pressa che girava prima del riavvio non avvia nessuna attesa, e la regola scatta la prossima volta che la pressa passa da off a on e gira cinque minuti. Senza `from` dipende da una corsa che non controlli. Se la prima lettura arriva dopo che le regole sono in ascolto, è un cambio, da `unknown` a `on`, e avvia un'attesa da zero: la regola scatta cinque minuti dopo, e la sua traccia dice `changed from unknown to on`. Se il dispositivo risponde prima che il Gateway sia su, la pressa è semplicemente `on` fin dall'inizio, non è cambiato nulla, e non scatta nulla finché non cambia di nuovo. Indica `from` quando un riavvio non deve contare come un avvio, e non scrivere una regola che ne ha bisogno. Modificare, disarmare o eliminare la regola scarta anche le sue attese; salvare un'altra regola no.
- **Un'entità che sparisce a metà attesa** (disabilitata, o eliminata insieme al suo dispositivo) non la fa mai scattare.

`forSec` è al massimo un giorno (86400), e solo un trigger `state` lo accetta. Viene controllato al salvataggio come tutto il resto.

### Trigger solari

Luci del cortile, cavo scaldante, un parcheggio, qualsiasi cosa a cui importi se fuori è buio. `sun` scatta a `dawn`, `sunrise`, `noon`, `sunset` o `dusk` in questo sito, spostato da `offsetSec`: negativo vuol dire prima, quindi questo è mezz'ora prima del tramonto.

```json
{"type": "sun", "event": "sunset", "offsetSec": -1800}
```

- **Si calcola sulla macchina.** Dalla latitudine e longitudine del sito (`HOTLOOP_SITE_LATITUDE`, `HOTLOOP_SITE_LONGITUDE`), con le equazioni solari della NOAA, senza servizi e senza internet. Un impianto che ha perso il collegamento accende comunque le luci al crepuscolo. Vedi [il sole](/it/iot/sun/).
- **Senza posizione, non si arma.** Una regola con un trigger solare in un sito senza latitudine e longitudine non è armata, e il log di sistema dice quali due variabili impostare. Era il genere di cosa che resta armata e muta per sempre, e nessuno se ne accorge finché il cortile è al buio.
- **Scatta una volta per evento del giorno,** all'ora di quel giorno. I tramonti di ottobre arrivano circa un minuto prima ogni sera e il trigger li segue.
- **Alba e crepuscolo sono crepuscolo civile**, con il centro del sole a 6 gradi sotto l'orizzonte. È la soglia "è abbastanza buio per le luci" attorno a cui si scrive l'illuminazione esterna.
- **Sotto il sole di mezzanotte non c'è un tramonto su cui scattare**, quindi un trigger di tramonto aspetta il prossimo, anche fra settimane, e scatta allora.
- `offsetSec` è al massimo sei ore per parte (21600). Oltre è uno `schedule`.

La traccia dice cosa l'ha fatta scattare e quando: `30m before sunset at 2026-10-01T22:38:00Z`, e `trigger` è `sun` nella condizione.

## Condizioni

Un'espressione che restituisce un booleano. Vuota significa incondizionata.

Cosa può vedere un'espressione:

| Nome | Significato |
|---|---|
| `value`, `string`, `quality` | la lettura che ha fatto scattare la regola |
| `previous` | la lettura precedente |
| `tag`, `device` | ciò che l'ha fatta scattare |
| `tags["device/tag"]` | ogni lettura numerica attuale |
| `strings["device/tag"]` | ogni lettura testuale attuale |
| `qualities["device/tag"]` | ogni qualità attuale |
| `states["sensor.x"]` | lo stato di ogni entità abilitata, come stringa |
| `attrs["sensor.x"]["unit_of_measurement"]` | gli attributi di ogni entità abilitata |
| `qualities["sensor.x"]` | la qualità di ogni entità, accanto a quella dei tag (la chiave di un tag ha un `/`, un entity_id mai) |
| `entity`, `fromState`, `toState` | il cambio di stato che ha fatto scattare la regola |
| `alarm`, `alarmState` | l'allarme che ha fatto scattare la regola |
| `deviceState` | lo stato del dispositivo che l'ha fatta scattare |
| `now`, `hour`, `minute`, `weekday` | l'orologio; weekday 0 è domenica |
| `trigger` | quale trigger è scattato |
| `vars` | valori associati dai passi precedenti |

```
value > 200
value > 200 and quality == 'good'
tags['press-01/Zone1_Temp'] > 200 and tags['press-01/Pressure'] < 50
hour >= 6 and hour < 18 and weekday != 0 and weekday != 6
qualities['press-01/Zone1_Temp'] == 'good'
strings['cnc-01/Program'] == 'PART_4471.NC'
value > previous
states['switch.press_01_pump'] == 'off' and toState == 'on'
float(states['sensor.press_01_zone1_temp']) > 200 and qualities['sensor.press_01_zone1_temp'] == 'good'
attrs['switch.press_01_pump']['armed'] == true
```

**Proteggi con la qualità.** `value > 200` è vero per una lettura cattiva di 250, e una lettura cattiva è una che il sistema ti dice di non conoscere. Su qualsiasi cosa comandi apparecchiature, scrivi `value > 200 and quality == 'good'`. Lo stesso vale per le entità: un'entità cattiva continua a mostrare il suo ultimo valore buono, e `qualities['sensor.x']` è il modo in cui una regola lo capisce.

**Uno stato è una stringa.** È `"212.5"`, `"on"` o `"unavailable"`, mai un numero, quindi `states['sensor.x'] > 200` viene rifiutato al salvataggio come errore di tipo invece di essere salvato come un confronto silenziosamente sempre falso. Scrivi `float(states['sensor.x']) > 200`, e proteggilo: `float('unavailable')` è un errore, e una condizione che dà errore fa fallire l'esecuzione.

`string` è la lettura che ha fatto scattare la regola, il che significa che non è anche la funzione `string()` di expr-lang. Per mettere un numero in una stringa, usa `toJSON(value)`.

Una condizione deve restituire un booleano. Una che restituisce un numero o una stringa viene rifiutata al salvataggio invece di essere forzata in una veridicità che nessuno intendeva.

## Azioni

Le azioni vengono eseguite in ordine. Un passo fallito ferma la regola a meno che imposti `continueOnError`: un passo che doveva chiudere una valvola e non l'ha fatto non deve essere seguito da passi che danno per chiusa la valvola.

### write_tag

```json
{
  "type": "write_tag",
  "params": {
    "deviceId": "press-01", "tagName": "Cooling",
    "value": true
  }
}
```

Oppure calcolato:

```json
{
  "type": "write_tag",
  "params": {
    "deviceId": "press-01", "tagName": "Setpoint",
    "expression": "tags['press-01/Zone1_Temp'] - 10"
  }
}
```

**Passa dallo stesso gate di tutto il resto.** Un'automazione non ha più privilegi di una persona: le scritture devono essere abilitate, il tag deve essere marcato scrivibile, il valore deve essere nell'intervallo, e il tentativo viene sottoposto ad audit come `automation:<rule-id>`.

### call_service

Comanda un'entità tramite il suo servizio, come fanno `POST /api/services/...` e lo strumento MCP `call_service`. Vedi [Entità](/it/iot/entities/#servizi) per cosa accetta ogni dominio.

```json
{
  "type": "call_service",
  "params": {
    "entityId": "switch.press_01_pump",
    "service": "switch.turn_on"
  }
}
```

Con dati, letterali o calcolati:

```json
{
  "type": "call_service",
  "params": {
    "entityId": "number.press_01_zone1_sp",
    "service": "number.set_value",
    "dataExpressions": {"value": "float(states['sensor.press_01_zone1_temp']) - 10"}
  }
}
```

`service` è `domain.service` e il suo dominio deve essere quello dell'entità, quindi una regola che nomina un numero con il servizio di un interruttore viene rifiutata al salvataggio. Lo stesso vale per un servizio che il dominio non accetta, e l'elenco di ciò che ogni dominio accetta viene dal livello delle entità stesso: quando un dominio ci guadagna un servizio, le regole possono usarlo senza cambiare nulla qui. `data` sono i dati letterali del servizio; `dataExpressions` vengono valutate all'esecuzione e fuse sopra.

È `write_tag` con un nome sopra. La chiamata diventa scritture di tag attraverso lo stesso gate, sottoposte ad audit come `automation:<rule-id>` con l'entità, il servizio e l'id della chiamata su ogni riga. Un rifiuto (scritture disattivate, tag disarmato, un valore fuori dal passo dell'entità) fa fallire il passo e l'esecuzione, con il rifiuto nella traccia, esattamente come un `write_tag` rifiutato, e ogni scrittura che la chiamata ha fatto o si è vista rifiutare è nell'output del passo. Una chiamata non viene mai annullata: un composto che ha messo a segno due scritture su tre si ferma lì e lo dice.

### condition

Una condizione in mezzo a una sequenza. Quando è falsa la sequenza finisce lì, e l'esecuzione **è riuscita**: la regola ha fatto ciò per cui è stata scritta, cioè fermarsi. L'output del passo dice `false; the steps after this one did not run`.

```json
{
  "type": "condition",
  "params": {
    "expression": "states['binary_sensor.press_01_run'] == 'on' and qualities['binary_sensor.press_01_run'] == 'good'"
  }
}
```

Non è la `condition` della regola. Quella viene controllata una volta, prima che qualsiasi cosa giri, rispetto all'impianto com'era quando il trigger è scattato, e una falsa registra l'esecuzione come saltata. Un passo di condizione legge l'impianto **com'è quando il passo gira**, che è il senso di averne una dopo un `delay` o un `wait`: "la pressa è ancora in marcia, trenta secondi dopo?" `entity`, `toState`, `value` e il resto di ciò che ha fatto scattare la regola restano com'erano, e così `vars`.

Una condizione che non può essere valutata (`float('unavailable')`) fa fallire il passo e l'esecuzione, come la condizione della regola. `continueOnError` viene rifiutato su una condizione al salvataggio: andare avanti oltre una significherebbe che non ferma mai nulla.

### wait

Trattiene la sequenza finché un'espressione è vera, al massimo `timeoutSec`.

```json
{
  "type": "wait",
  "params": {
    "expression": "states['binary_sensor.press_01_valve_closed'] == 'on'",
    "timeoutSec": 30
  }
}
```

Guarda subito, di nuovo **ogni volta che un'entità nominata dall'espressione cambia** (il suo stato, la sua qualità o un attributo), e una volta al secondo comunque. Le entità che osserva sono quelle scritte come letterali in `states['...']`, `attrs['...']` e `qualities['...']`; una lettura di tag, l'orologio o un'entità nominata in altro modo vengono colti dall'occhiata al secondo. Un'attesa su una bobina Modbus è quindi veloce quanto l'interrogazione che c'è dietro, non un secondo in ritardo.

Quando diventa vera il passo successivo gira, e i passi dopo vedono l'impianto come l'attesa l'ha visto per ultimo. Quando il timeout scade per primo il passo **fallisce**, e l'esecuzione con lui, dicendo `still false after 30s`, a meno che l'attesa dica di proseguire:

```json
{
  "type": "wait",
  "params": {
    "expression": "float(states['sensor.press_01_zone1_temp']) < 60",
    "timeoutSec": 240,
    "continueOnTimeout": true
  }
}
```

In ogni caso `vars.wait.completed` è vero o falso dopo, e `vars.wait.waitedSec` è quanto ha atteso, quindi un passo di condizione dopo un'attesa con prosecuzione può decidere: `vars.wait.completed == true`.

`timeoutSec` è obbligatorio e al massimo un'ora. Un'attesa senza fine tiene il suo slot di esecuzione finché il budget dell'esecuzione glielo toglie, il che sotto `skip` significa che la regola smette di scattare. Deve anche stare nel budget dell'esecuzione (`maxRuntimeSec`, cinque minuti di default): un'attesa di dieci minuti richiede `"maxRuntimeSec": 900` o simile sulla sua regola, e senza di esso la regola viene rifiutata al salvataggio invece di andare in timeout come esecuzione. Un'espressione che dà errore mentre aspetta fa fallire il passo.

### stop

Termina la sequenza. `reason` è obbligatorio e accetta la sostituzione `{{ expression }}`; la traccia lo mostra.

```json
{
  "type": "stop",
  "params": {"reason": "pump already running, nothing to do"}
}
```

Senza `error` l'esecuzione è riuscita. Con `"error": true` l'esecuzione è fallita, con il motivo come errore, ed è registrata e contata come un fallimento come qualsiasi altro:

```json
{
  "type": "stop",
  "params": {"reason": "valve did not close in time", "error": true}
}
```

`continueOnError` viene rifiutato su uno stop al salvataggio.

### call_script

Esegue uno [script](/it/iot/scripts/): una sequenza con nome che qualcuno ha scritto una volta perché ogni regola che ha bisogno di un ciclo CIP o di uno spurgo di linea chiami sempre lo stesso invece di portarsi la propria copia. `fields` sono i suoi ingressi, `fieldExpressions` vengono valutate quando il passo gira e fuse sopra, e lo script controlla tutto rispetto ai propri campi esattamente come per un'esecuzione dalla schermata. Un valore che rifiuta fa fallire questo passo; non viene mai spostato per farlo rientrare.

```json
{
  "type": "call_script",
  "params": {
    "scriptId": "cip_cycle",
    "fields": {"circuit": "tank_2"},
    "fieldExpressions": {"minutes": "states['input_number.cip_minutes']"},
    "wait": true
  }
}
```

Con `"wait": true` il passo attende che l'esecuzione dello script sia finita e ne prende l'esito: uno script che fallisce fa fallire il passo, e la regola si ferma lì a meno che il passo dica `continueOnError`. L'esecuzione dello script fa parte di questa: se questa esecuzione viene annullata o esaurisce il budget, lo stesso vale per lo script. Senza `wait`, lo script viene avviato e la regola prosegue; lo script finisce per conto suo.

Lo script gira come `script:<id>`, con l'origine di questa regola, `automation`, su ogni scrittura che fa, e la sua esecuzione dice che `automation_run:<id>` era suo genitore. Uno script occupato, il cui modo rifiuta un'altra esecuzione, fa fallire un passo che attende (`script busy`) ed è annotato, non fallito, da uno che non attende. Gli script che chiamano script arrivano al massimo a cinque livelli, e uno script che chiamerebbe se stesso viene rifiutato quando viene salvato.

### apply_recipe

Applica una [ricetta](/it/iot/recipes/): un insieme di setpoint che partono insieme, un grado di prodotto o un cambio formato. `params` sono i suoi parametri e `paramExpressions` vengono valutate quando il passo gira e fuse sopra; `version` applica volutamente una versione più vecchia, e se omessa è quella corrente.

```json
{
  "type": "apply_recipe",
  "params": {
    "recipeId": "grade_a",
    "params": {"line_speed": 120},
    "paramExpressions": {"batch": "states['input_number.next_batch']"}
  }
}
```

La ricetta fa ciò che fa dalla schermata Ricette, con questa regola come chi la applica. Viene prima controllata per intero, e se un qualsiasi obiettivo venisse rifiutato non viene scritto nulla e il passo fallisce con tutti i motivi. Poi i suoi obiettivi partono in ordine con un unico id di chiamata, come `automation:<id>` con l'origine `automation`, e il primo che fallisce ferma gli altri e fa fallire il passo; ciò che è stato scritto resta scritto. Il passo riesce solo quando ogni obiettivo è stato scritto. Un valore partito e non riletto dal dispositivo non è un fallimento, perché è partito, ma la traccia dice `NOT confirmed by read-back`, e lo dice anche l'applicazione. Il genitore dell'applicazione è questa esecuzione, `automation_run:<id>`.

### Il resto

| Azione | Fa |
|---|---|
| `mqtt_publish` | pubblica sulla connessione esistente di un dispositivo MQTT |
| `http_request` | chiama un endpoint; `bindTo` salva il corpo in `vars` |
| `raise_alarm` / `clear_alarm` | gestisce un allarme che il motore non può vedere da sé |
| `log_event` | scrive nel log di sistema |
| `set_variable` | associa un valore per i passi successivi |
| `delay` | mette in pausa, fino a un'ora |
| `mcp_call` | invoca uno strumento su un server MCP configurato |

`mqtt_publish`, `http_request`, `log_event` e `stop` supportano la sostituzione `{{ expression }}` nelle loro stringhe.

```json
{
  "type": "mcp_call",
  "params": {
    "server": "maintenance",
    "tool": "create_work_order",
    "args": {"priority": "high"},
    "argExpressions": {"note": "'Zone 1 reached ' + toJSON(value)"},
    "bindTo": "workOrder"
  }
}
```

## Modi di esecuzione

Cosa succede quando una regola viene attivata mentre un'esecuzione precedente è ancora in corso.

| Modo | Comportamento |
|---|---|
| `skip` | scarta il nuovo trigger, **il predefinito**, e la risposta giusta vicino a un dispositivo |
| `queue` | lo esegue dopo, al massimo uno in coda |
| `restart` | abbandona l'esecuzione corrente e riparte |
| `parallel` | esegue entrambe |

`queue` è limitata a un'esecuzione in sospeso di proposito. Una regola che non riesce a stare al passo accumulerebbe altrimenti un arretrato di comandi che partono tutti contro un impianto il cui stato è nel frattempo cambiato.

`minIntervalSec` limita la frequenza a prescindere dal ritmo dei trigger, una protezione contro un tag che vibra e martella un dispositivo fino a distruggerlo. Un'esecuzione manuale dalla UI o da MCP aggira il limite di frequenza (qualcuno lo voleva) ma non il modo di esecuzione (due esecuzioni concorrenti sono ugualmente pericolose chiunque le abbia avviate).

`maxRuntimeSec` limita un'intera esecuzione; il predefinito è cinque minuti. Senza di esso una regola bloccata su un endpoint irraggiungibile tiene il suo slot di esecuzione per sempre, e sotto `skip` ciò significa che non scatta mai più. Un'esecuzione che lo esaurisce viene registrata come scaduta, che fosse tra due passi o nel mezzo di un `delay` o di un `wait`.

### Attese, ritardi e modi di esecuzione

Un'esecuzione ferma in un `wait` o in un `delay` è un'esecuzione in corso, e il modo di esecuzione decide cosa le fa un trigger:

| Modo | Un trigger mentre un'esecuzione attende |
|---|---|
| `skip` | viene scartato e registrato come saltato. L'esecuzione in attesa prosegue. |
| `queue` | gira quando l'esecuzione in attesa è finita, comunque sia finita. |
| `restart` | annulla l'esecuzione in attesa dov'è e ne avvia una nuova. La vecchia esecuzione è registrata come **annullata**, `a newer trigger restarted the rule`. È lo schema della "luce a sensore di movimento": ogni trigger sposta in avanti la fine. |
| `parallel` | avvia un'altra esecuzione, che attende per conto suo. |

Un'esecuzione viene annullata dov'è, attesa o ritardo compresi, e registrata come **annullata** con il motivo, quando:

- **la sua regola viene disarmata o eliminata**: `the rule was disarmed or deleted`. Anche la sua esecuzione in coda e le sue attese `forSec` vengono scartate.
- **la sua regola viene modificata**: `the rule was edited`. Un'esecuzione in attesa di una condizione che l'autore ha appena cambiato non prosegue come se nulla fosse; la regola modificata riparte pulita. Salvare *un'altra* regola non tocca nulla: esecuzioni, attese, esecuzioni in coda, slot di esecuzione e timer di intervallo di ogni regola invariata proseguono com'erano.
- **il processo si ferma**: `the process is stopping`. L'arresto non aspetta la fine di un'attesa. Niente riprende l'esecuzione al prossimo avvio; un'esecuzione che il processo non ha potuto registrare come annullata (un crash, un'interruzione di corrente) viene marcata annullata al prossimo avvio.

Un passo annullato o rimasto senza budget ferma l'esecuzione anche con `continueOnError`: quel flag è per un passo fallito, non per un'esecuzione che qualcuno ha fermato. Tutto ciò che il passo aveva già fatto resta fatto: una scrittura partita prima dell'annullamento non viene annullata, ed è nella traccia.

## Cronologia delle esecuzioni

Ogni esecuzione viene registrata con una traccia per passo: gli ingressi **risolti**, le uscite, le durate e gli errori. Non i modelli: quando una regola sbaglia alle 3 di notte, `wrote 212.5 to press-01/Setpoint` è ciò che vale la pena sapere e `wrote {{expression}}` no.

Espandi un'esecuzione nella schermata Automazioni per vederne i passi. Un'esecuzione ancora in corso quando il processo si è fermato viene annullata all'arresto, e una che il processo non è riuscito a registrare (un crash) viene marcata annullata al prossimo avvio, invece di sembrare in esecuzione da martedì scorso.

## Un esempio completo

Avviare il raffreddamento quando una zona scalda durante un turno, al massimo una volta ogni dieci minuti, e avvisare qualcuno.

```json
{
  "id": "cool-zone-1",
  "name": "Cool zone 1 when hot",
  "enabled": true,
  "mode": "skip",
  "minIntervalSec": 600,
  "triggers": [{
    "type": "threshold",
    "deviceId": "press-01", "tagName": "Zone1_Temp",
    "threshold": 200, "direction": "rising", "hysteresis": 5
  }],
  "condition": "quality == 'good' and hour >= 6 and hour < 18",
  "actions": [
    {"type": "write_tag", "params": {
      "deviceId": "press-01", "tagName": "Cooling", "value": true}},
    {"type": "delay", "params": {"seconds": 30}},
    {"type": "log_event", "params": {
      "severity": "warning",
      "message": "Cooling started, zone 1 at {{ value }}"}}
  ]
}
```

Leggi le protezioni in ordine: scatta all'attraversamento e non in continuo; l'isteresi le impedisce di riarmarsi a ogni ondeggiamento; la condizione si rifiuta di agire su una lettura di cui non può fidarsi e gira solo durante il turno; e il limite di frequenza fa sì che, anche se tutto il resto è sbagliato, non possa comandare l'impianto più di una volta ogni dieci minuti.

La stessa idea con le entità: avviare il ventilatore di estrazione quando la pressa si mette in marcia, ma solo se nessuno ha disarmato il ventilatore.

```json
{
  "id": "fan-with-press",
  "name": "Extraction fan follows the press",
  "enabled": true,
  "mode": "skip",
  "triggers": [{
    "type": "state",
    "entityId": "binary_sensor.press_01_run",
    "from": "off", "to": "on"
  }],
  "condition": "qualities['binary_sensor.press_01_run'] == 'good' and attrs['switch.press_01_fan']['armed'] == true",
  "actions": [
    {"type": "call_service", "params": {
      "entityId": "switch.press_01_fan", "service": "switch.turn_on"}},
    {"type": "log_event", "params": {
      "message": "{{ entity }} went {{ toState }}, fan started"}}
  ]
}
```

`from` e `to` fanno sì che una riconnessione (`unavailable` a `on`) non avvii il ventilatore da sola; la condizione fa sì che un ventilatore disarmato sia un'esecuzione saltata e non una scrittura rifiutata nel registro di audit ogni volta che la pressa parte.

E una che usa i passi di sequenza: quando la pressa è in marcia da dieci minuti, aprire la valvola di raffreddamento se non è già aperta, attendere il suo finecorsa e fallire in modo evidente se non scatta mai.

```json
{
  "id": "cool-after-warmup",
  "name": "Open cooling after ten minutes of running",
  "enabled": true,
  "mode": "restart",
  "maxRuntimeSec": 120,
  "triggers": [{
    "type": "state",
    "entityId": "binary_sensor.press_01_run",
    "from": "off", "to": "on",
    "forSec": 600
  }],
  "actions": [
    {"type": "condition", "params": {
      "expression": "states['valve.press_01_cooling'] != 'open'"}},
    {"type": "call_service", "params": {
      "entityId": "valve.press_01_cooling", "service": "valve.open"}},
    {"type": "wait", "params": {
      "expression": "states['valve.press_01_cooling'] == 'open'",
      "timeoutSec": 60, "continueOnTimeout": true}},
    {"type": "condition", "params": {
      "expression": "vars.wait.completed == false"}},
    {"type": "stop", "params": {
      "reason": "cooling valve did not open within 60s, it is {{ states['valve.press_01_cooling'] }}",
      "error": true}}
  ]
}
```

Leggila dall'alto in basso: l'attesa fa sì che una pressa che scatta dopo due minuti non apra mai la valvola, e `from` fa sì che un riavvio del Gateway non sia un avvio della pressa; la prima condizione fa di una valvola già aperta un'esecuzione riuscita che non comanda nulla; l'attesa si sveglia nel momento in cui l'entità della valvola cambia; e quando non si apre mai, la seconda condizione lascia proseguire l'esecuzione fino a uno stop che la fa fallire, con lo stato reale della valvola nel motivo e un avviso nel log di sistema. Quando la valvola si apre, quella stessa condizione è falsa e l'esecuzione finisce lì, riuscita.

## Webhook

Un trigger `webhook` registra `POST /api/webhook/<path>`. Il corpo è disponibile come `vars.body`. Un percorso che nessuna regola rivendica restituisce 404 invece di accettare in silenzio: un webhook che pubblica nel vuoto sembra identico a uno che funziona.

Due regole non possono rivendicare lo stesso percorso; la seconda viene rifiutata al caricamento con una riga di log che le nomina entrambe.

## Quando una regola non si arma

Una regola abilitata ma che non ha compilato appare come **NOT ARMED** nella schermata Automazioni, con un punto rosso e una spiegazione, e un errore nel log di sistema. È lo stato su cui conviene essere più rumorosi: l'autore crede che stia girando.

Una regola difettosa non disarma le altre. Il ricaricamento scarta quella che è fallita e arma tutto il resto.
