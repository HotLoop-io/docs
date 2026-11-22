---
title: "Script di procedura"
description: "Scrivi un ciclo una volta, dagli un nome e avvialo da una regola, una schermata o MCP. La prova a vuoto passa dal vero cancello di scrittura prima di tutto."
---

Uno script è una sequenza di passi con un nome. Il ciclo CIP. Lo spurgo della linea. Il cambio verso il prodotto B. Ogni stabilimento ha una manciata di procedure che esegue ogni volta esattamente allo stesso modo, e il giorno in cui qualcuno ne copia una in una quarta automazione e corregge un passo solo in tre di esse è il giorno in cui ti morde. Quindi la scrivi una volta, le dai un nome, e tutto ciò che ne ha bisogno la chiama con quel nome: un operatore dalla schermata Script, una regola con un passo `call_script`, un agente con `run_script`, qualunque cosa tramite `POST /api/services/script/turn_on`.

Uno script parla il linguaggio delle automazioni, gira sullo stesso esecutore di sequenze delle azioni di una regola, e ogni scrittura che fa passa dall'unico cancello di scrittura. Nessuna porta di servizio. Non ne ha mai avuta una.

## Com'è fatto

```json
{
  "id": "cip_cycle",
  "name": "CIP cycle",
  "description": "Caustic wash, rinse, done. Tank must be empty.",
  "fields": [
    {"name": "minutes", "label": "Wash time", "type": "number", "min": 5, "max": 60, "step": 5, "unit": "min", "required": true},
    {"name": "circuit", "type": "select", "options": ["tank_1", "tank_2"], "default": "tank_1"}
  ],
  "sequence": [
    {"type": "condition", "params": {"expression": "float(states['sensor.cip_tank_level']) < 5"}},
    {"type": "call_service", "params": {"entityId": "switch.cip_pump", "service": "switch.turn_on"}},
    {"type": "delay", "params": {"seconds": 5}},
    {"type": "wait", "params": {"expression": "float(states['sensor.cip_return_temp']) > 70", "timeoutSec": 900}},
    {"type": "log_event", "params": {"message": "CIP on {{ vars.circuit }} for {{ vars.minutes }} minutes"}},
    {"type": "call_service", "params": {"entityId": "switch.cip_pump", "service": "switch.turn_off"}}
  ],
  "mode": "skip",
  "maxRuntimeSec": 1800
}
```

- **`id`** è composto da lettere minuscole, cifre e trattini bassi, e inizia con una lettera. È anche l'id oggetto della sua entità, quindi questo è `script.cip_cycle`, e non cambia mai.
- **`fields`** sono ciò che prende un'esecuzione. Gli stessi ingressi tipizzati di tutto HotLoop (`model.Field`): `number` con `min`, `max`, `step` e `unit`, `text` con `max_length` e `pattern`, `boolean`, `select` con `options`, `entity` con i `domain` che accetta, `duration` (secondi, oppure `90s`, `1h30m`), `alarm` e `tag`. Ognuno può essere `required` o avere un `default`, e un valore predefinito che il suo stesso campo rifiuterebbe viene rifiutato al salvataggio. Un passo legge un campo come `vars.<name>`.
- **`sequence`** è il linguaggio delle automazioni, per intero: `call_service`, `write_tag`, `condition`, `wait`, `stop`, `call_script`, `set_variable`, `delay`, `log_event` e il resto. [Automazioni](/it/iot/automations/) ha ogni passo.
- **`mode`** e **`maxRuntimeSec`** sono più sotto.

Uno script viene compilato al salvataggio, come una regola: un passo che non si decodifica, un'espressione che non compila, un'attesa più lunga di quanto un'esecuzione possa durare, un campo che non ha senso, tutto viene rifiutato al salvataggio. Lo scopri nell'editor, non alle 3 di notte con la pompa a metà lavaggio.

## I campi vengono controllati, mai corretti

Prima che giri il primo passo, ciò che è stato dato all'esecuzione viene controllato rispetto ai campi: ogni valore deve essere uno che il suo campo accetta, ogni valore obbligatorio deve esserci, e un campo che lo script non ha è un errore, non qualcosa che si ignora in silenzio. **Un valore non viene mai spostato per adattarlo.** 70 minuti in un campo il cui massimo è 60 vengono rifiutati, non ridotti a 60; `"12"` per un numero viene rifiutato, non interpretato; 12,5 con un passo di 5 viene rifiutato, non arrotondato. Il valore che passa a comandare le apparecchiature è esattamente quello che qualcuno ha inserito, oppure non gira nulla. Un'esecuzione rifiutata non lascia alcuna esecuzione dietro di sé: non è partito nulla.

## Avviarne uno

| Da | Come | Richiede |
|---|---|---|
| La schermata Script | **Esegui** sulla sua scheda, compila il modulo | `scripts.run` |
| La sua entità | **Esegui** sul suo riquadro, oppure `POST /api/services/script/turn_on` con i campi come dati | `scripts.run` |
| L'API | `POST /api/scripts/{id}/run` con `{"fields": {...}, "reason": "..."}` | `scripts.run` |
| Una regola | un passo `call_script` | il permesso della regola stessa |
| Un agente | `run_script` tramite MCP | scritture MCP attive |

Gli operatori eseguono gli script. Gli amministratori li scrivono. Eseguire il ciclo CIP è ciò per cui serve il pulsante; decidere quali valvole apre il ciclo CIP è una scelta da ingegnere e tale resta.

Un'esecuzione risponde appena è partita, con il suo id. Chiedile di attendere (`wait`) e risponde quando finisce, con il suo esito e la traccia di ogni passo. **Ferma** (`POST /api/scripts/{id}/stop`, oppure `script.turn_off`) annulla ogni esecuzione dello script dov'è, in ogni processo, attesa o ritardo compresi. Ciò che un passo aveva già scritto resta scritto. Annullare è anch'esso una scrittura, fatta senza che nessuno la chieda, su apparecchiature che si sono già mosse, e quella è una decisione dell'operatore, non nostra.

## Ogni scrittura passa dal cancello

Uno script gira come **`script:<id>`**. Ogni scrittura che fa, ogni chiamata di servizio, ogni riga di log porta quel nome come attore, e ogni scrittura viene sottoposta ad audit a suo nome in `GET /api/writes`, rifiutata o no. La **sorgente** è chi l'ha avviato: `ui` dalla schermata, `automation` da una regola, `mcp` da un agente. È importante perché il cancello decide in base alla sorgente. Uno script avviato da un agente scrive come `mcp`, e con `HOTLOOP_ALLOW_WRITES` disattivato ogni sua scrittura viene rifiutata, esattamente come lo sarebbe il `write_tag` dell'agente stesso. `run_script` e il `script.turn_on` di un agente rifiutano subito in quel caso, invece di eseguire uno script le cui scritture rimbalzeranno tutte.

L'esecuzione registra chi l'ha chiesta (`actor`), come (`source`) e che cosa l'ha chiamata (`parent`: `automation_run:812`, `script_run:77`), così puoi risalire da una scrittura alla regola, allo script e alla persona o all'agente dietro.

## Chiedi prima: la prova a vuoto

`POST /api/scripts/{id}/run?dry_run=true`, **Controlla prima** nel pannello di esecuzione, oppure `run_script` con `dryRun`. I campi vengono controllati allo stesso modo, poi ogni passo viene percorso rispetto allo stabilimento com'è in questo momento:

- ogni `write_tag` e `call_service` viene sottoposto ai controlli propri del cancello di scrittura (`CheckWrite`, `Services.Check`), lo stesso codice che esegue la scrittura vera, così una prova a vuoto non può dire sì a qualcosa che la scrittura vera rifiuterebbe per un motivo che la prova non ha controllato. Non viene scritto nulla, non viene registrato nulla;
- una `condition` viene valutata adesso, e una falsa termina il percorso dove terminerebbe l'esecuzione;
- un `set_variable` viene associato, così i passi successivi vedono ciò che vedrebbero;
- un `call_script` percorre lo script che chiama, con i suoi passi numerati sotto la chiamata (`3.1`, `3.2`);
- un `wait`, un `delay` e qualsiasi cosa che non scriva su alcuna apparecchiatura (un messaggio, una chiamata HTTP, un allarme sollevato) è `not_checked`. Una prova a vuoto non aspetta quindici minuti per dirti che cosa leggerà allora il serbatoio.

La prima scrittura che verrebbe rifiutata termina il percorso, perché terminerebbe l'esecuzione, e la risposta lo dice con le parole del cancello: `step 2 (call_service): cip/pump: this tag is not marked writable`. Una prova a vuoto che torna pulita è un consiglio, non una promessa. Un dispositivo può cadere, qualcuno può disarmare un tag, e un'attesa dà allo stabilimento tutto il tempo che gli serve per cambiare idea tra il tuo controllo e il passo.

## Modalità di esecuzione

Che cosa succede a un'esecuzione richiesta mentre un'altra dello stesso script è in corso. Le stesse parole che usa una regola, con una differenza.

| Modalità | Una seconda esecuzione |
|---|---|
| `skip` | rifiutata, `409`, e una esecuzione `skipped` nella cronologia che dice perché. **Il valore predefinito**, e la risposta giusta per qualunque cosa comandi apparecchiature |
| `queue` | aspetta il suo turno e parte quando quella davanti è finita. Un solo posto: una terza viene rifiutata |
| `restart` | annulla quella in corso dov'è, poi parte quando si è fermata. Due esecuzioni non si sovrappongono mai |
| `parallel` | gira in parallelo |

La differenza: la coda di una regola scarta in silenzio l'esecuzione in attesa più vecchia, e la coda di uno script rifiuta ad alta voce la più recente. Una regola è fatta scattare da un trigger a cui non importa. Uno script è richiesto da qualcuno, o qualcosa, che può restare in attesa della risposta, e «la tua esecuzione semplicemente non è avvenuta» non è una risposta.

Un passo `call_script` che attende uno script occupato fallisce (`script busy`); uno che non attende lo annota nella traccia e prosegue, perché tutto ciò che doveva fare era avviarlo.

`maxRuntimeSec` limita un'esecuzione, cinque minuti quando vale zero. Un'esecuzione che lo esaurisce passa a `timed_out`, che fosse tra due passi o nel mezzo di un'attesa.

## Script che chiamano script

Un passo `call_script` esegue uno script da una regola o da un altro script. Con `wait` il passo prende l'esito dello script come proprio, e lo script fa parte dell'esecuzione che l'ha chiamato: annulla il chiamante, o lascia che finisca il tempo, e si ferma anche lo script su cui sta aspettando. Senza `wait` lo script viene avviato e lasciato finire per conto suo.

Due limiti, entrambi presenti perché l'alternativa è uno script che va in ciclo:

- **Uno script che chiamerebbe sé stesso viene rifiutato al salvataggio**, direttamente o attraverso qualsiasi catena di altri script: `script b would call itself: b calls a calls b`. Lo stesso vale per una modifica che chiude un ciclo.
- **Cinque livelli, a runtime.** Un sesto script in una catena fa fallire il passo che l'avrebbe chiamato, e la catena con esso. E se un ciclo dovesse mai superare il salvataggio (due processi che salvano due metà nello stesso istante), l'esecuzione lo intercetta: uno script già in esecuzione nella propria catena viene rifiutato, non eseguito una seconda volta.

## La sua entità

Ogni script è un'entità, `script.<id>`, piattaforma `script`. Il suo stato è `on` mentre una sua esecuzione è in corso, in qualsiasi processo, e `off` quando non ce n'è nessuna; i suoi attributi riportano il suo `mode`, quante esecuzioni sono in corso (`current`), i suoi `fields`, e quando è partito l'ultima volta e come è finito. È nella schermata Entità con un pulsante **Esegui**, in `list_entities` tramite MCP, in `/api/states`, e una regola può avere un trigger di stato su di esso: «quando il ciclo CIP passa a off, registra il lotto». Eliminare uno script rende orfana la sua entità, come eliminare la definizione di un allarme: un amministratore elimina l'orfana quando nulla vi fa più riferimento.

## La cronologia delle esecuzioni

Ogni esecuzione è una riga di `script_runs`: chi, come, i campi ricevuti dopo il controllo, la traccia di ogni passo (ingressi risolti, non modelli), come è finita e perché. `GET /api/scripts/{id}/runs`, il pannello di esecuzione e il [registro di bordo](/it/iot/logbook/), dove le esecuzioni degli script sono di tipo `script`, trovate dall'entità dello script o da qualsiasi cosa su cui un'esecuzione ha scritto. La cronologia conserva le 500 esecuzioni più recenti di ogni script, lo stesso limite delle esecuzioni delle automazioni.

La riga di un'esecuzione viene aperta prima del suo primo passo e chiusa dopo l'ultimo. L'arresto del processo annulla ogni esecuzione in corso dov'è e la registra come `cancelled: interrupted by restart`. Un'esecuzione interrotta da un crash, senza nessuno che ne chiuda la riga, viene marcata allo stesso modo al successivo avvio del Gateway. **Nulla riprende un'esecuzione.** Proseguire dal passo quattro di un ciclo CIP un'ora dopo, senza che nessuno lo chieda, su uno stabilimento che è andato avanti, è peggio che dire che si è fermato.

## Più di un processo

Il Gateway e un processo `--mcp-stdio` accanto a esso (o due pod a metà aggiornamento) eseguono entrambi script. Lo stato di un'esecuzione vive nel database, e ogni processo ascolta le modifiche su `hotloop_script`, quindi:

- uno script avviato in un processo mostra `on` nell'entità di ogni processo;
- uno script salvato su un pod è lo script sull'altro, e le sue esecuzioni lì vengono annullate se i suoi passi sono cambiati;
- **Ferma** ferma ogni esecuzione dello script, in ogni processo.

La modalità di esecuzione è mantenuta per processo. Due processi possono avviare ciascuno un'esecuzione di uno script `skip` nello stesso istante. Uno stabilimento che esegue la stessa procedura dal processo ausiliario di un agente e dalla schermata dell'operatore nello stesso secondo ha una conversazione da fare che nessun nostro blocco risolverebbe.

## Backup

`scripts` e `script_runs` sono in ogni backup e tornano con un ripristino, insieme alla cronologia. Un'esecuzione che il backup ha colto a metà torna come `running` e viene marcata `interrupted by restart` al primo avvio, come ogni altra. Vedi [Backup e ripristino](/it/iot/backup/).

## L'API

Ogni route, il suo permesso e le sue risposte sono in [l'API HTTP](/it/iot/api/#scripts).

| Permesso | visualizzatore | operatore | amministratore |
|---|---|---|---|
| `scripts.read`: elencarli, le loro esecuzioni | sì | sì | sì |
| `scripts.run`: eseguire, prova a vuoto, fermare, `script.turn_on`/`turn_off` | no | sì | sì |
| `scripts.write`: creare, modificare, eliminare | no | no | sì |
