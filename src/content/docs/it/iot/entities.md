---
title: "Entità"
description: "Il registro di entità su cui si basano automazioni, helper, script e schermate: id fissi, domini, servizi e l'API che li legge."
---

Il registro delle entità e il motore che ne calcola lo stato sono le fondamenta su cui si costruiscono tutte le automazioni, gli helper, gli script e le schermate di HotLoop.

## Perché le entità, se abbiamo già i tag

Un tag è ciò di cui parla un driver: un registro di mantenimento, un NodeId, un offset di DB S7. È identificato da dispositivo e nome del tag, non si può rinominare e indica esattamente un punto su un filo.

Un'entità è ciò di cui parlano le persone e le regole: "la temperatura della zona 1", "l'interruttore di marcia del nastro". Ha un nome stabile tutto suo (`sensor.zone_1_temperature`), un tipo che dice come mostrarla e che cosa si può fare con essa, e un insieme di associazioni ai tag di cui è fatta.

Le entità avvolgono i tag. Non li sostituiscono, e nulla nei tag è cambiato per fare spazio a loro. Non esiste una seconda pipeline di valori né un secondo storico: lo stato di un'entità è calcolato dalla stessa cache in tempo reale che già leggono `/api/values`, il motore degli allarmi e il server OPC UA. Ogni endpoint dei tag esistente, la board, `/api/write`, gli strumenti MCP e le regole di automazione che esistevano prima delle entità si comportano esattamente come prima; le entità si aggiungono accanto a loro, non al loro posto.

## Ciò che si ottiene senza muovere un dito

Ogni tag riceve automaticamente un' **entità di lettura**:

| Tipo di dato del tag | Dominio dell'entità di lettura |
|---|---|
| `bool`, `boolean`, `bit`, `coil`, `discrete` | `binary_sensor` |
| tutto il resto | `sensor` |

La prima volta che un tag diventa scrivibile riceve anche un' **entità di comando**:

| Tipo di dato del tag | Dominio dell'entità di comando |
|---|---|
| famiglia bool | `switch` |
| famiglie int e float | `number` |
| `string`, `text`, `char` | `text` |

Un'entità di comando non viene mai rimossa perché il suo tag è stato disarmato. Il write gate rifiuta le scritture su un tag disarmato come ha sempre fatto, e l'attributo `armed` dell'entità passa a `false` così che una schermata possa schiarire il comando. Mantenere l'entità è proprio lo scopo: un'automazione o una dashboard che nomina `switch.press_01_pump` non deve rompersi perché qualcuno ha disarmato la pompa per un turno.

I tag esistenti ricevono le loro entità nell'aggiornamento stesso: la migrazione `0005_entities.sql` crea un'entità di lettura per ogni tag e un'entità di comando per ogni tag già scrivibile, nella stessa transazione che crea le tabelle. O ogni tag ha la sua entità quando la nuova versione serve la prima richiesta, o non è cambiato nulla.

Anche ogni definizione di allarme riceve un' **entità di allarme**, allo stesso modo: vedi [Entità di allarme](#entità-di-allarme).

Comandare un'entità di comando (accendere un interruttore, impostare un numero) è una chiamata di servizio, e una chiamata di servizio è una serie di scritture di tag tramite `runtime.Manager.Write` e il write gate, come ogni altra scrittura. Non esiste un'altra porta. Vedi [Servizi](#servizi).

Un'apparecchiatura che è più di un tag (una pompa con un comando di marcia, un contatto di marcia e un guasto; una valvola con i finecorsa; un anello PID) è un **composito** che si costruisce apposta con i tag di cui è fatta. Vedi [Apparecchiature composite](#apparecchiature-composite).

## ID delle entità

Un `entity_id` è `<domain>.<object_id>`: lettere minuscole, cifre e trattini bassi, al massimo 255 caratteri. Quello automatico di un tag è `<domain>.<device>_<tag>`, dove entrambe le metà sono portate in minuscolo e ogni serie di caratteri che non sia una lettera o una cifra ASCII diventa un solo trattino basso:

| Dispositivo | Tag | Entità di lettura |
|---|---|---|
| `press-01` | `Zone1_Temp` | `sensor.press_01_zone1_temp` |
| `Line.A-2` | `Motor/Speed.PV` | `sensor.line_a_2_motor_speed_pv` |
| `press-01` | `温度` | `sensor.press_01_tag` |

Due tag che danno lo stesso risultato ricevono `_2`, `_3` e così via, nell'ordine in cui sono stati registrati. Un nome troppo lungo per 255 caratteri viene tagliato prima del suffisso, mai attraverso di esso.

**Un `entity_id` viene generato una volta, salvato e mai rigenerato.** Cambiare la descrizione di un tag, modificarne il tipo di dato, spostarlo su un altro registro: niente di tutto ciò tocca l'entity_id. L'unica cosa che lo cambia è una rinomina esplicita tramite `PUT /api/entities/{entity_id}`, che è un'azione da amministratore e finisce nel log di sistema (categoria `config`, soggetto il nuovo id, il vecchio id nel messaggio e nel dettaglio).

Una rinomina mantiene il dominio. L'identità di un'entità è il suo `id` nel database e il suo `unique_id`, e nessuno dei due si sposta mai:

| Entità | `unique_id` |
|---|---|
| l'entità di lettura di un tag | `tag:<device>/<tag>` |
| l'entità di comando di un tag | `tag-control:<device>/<tag>` |
| un'entità di allarme | `alarm:<definition id>` |
| un composito | `composite:<32 random hex digits>` |

I primi tre derivano da ciò che l'entità avvolge, ed è questo che permette a un tag o a una definizione di allarme eliminati e poi tornati di riadottare la propria entità. Un composito non ha nulla da cui derivarlo: due pompe identiche su uno stesso PLC sono associate a tag diversi, e gli stessi tag possono sostenere apposta due compositi. Il suo `unique_id` è quindi casuale, creato una sola volta alla creazione. Non può mai coincidere con quello di nessun'altra entità, compreso un composito eliminato e ricostruito, che è una nuova entità e così deve essere.

## Tag eliminati, orfane e riadozione

Se si elimina un tag, le sue entità diventano **orfane**, non vengono eliminate: `orphaned_at` viene impostato e lo stato passa a `unavailable`. Se lo stesso tag torna, dall'editor dei tag o da una reimportazione dal browser, il registro trova l'orfana tramite `unique_id` e la riadotta. Con essa tornano il suo entity_id, il nome, la classe di dispositivo, l'icona e ogni altra personalizzazione.

È voluto. In uno stabilimento un tag viene eliminato e reimportato molto più spesso di quanto qualcuno voglia dire "dimentica tutto di questo punto", e un'automazione che nomina `sensor.oven_temperature` deve continuare a funzionare nonostante questo.

Eliminare un intero dispositivo è diverso: le sue entità se ne vanno con lui, come i suoi tag. Questo include un composito i cui tag sono tutti su quel dispositivo. Un composito che si estende su più dispositivi non appartiene a nessuno, e quando uno se ne va perde solo il suo stato.

Le entità di allarme seguono le loro definizioni di allarme con le stesse regole: eliminando la definizione la sua entità diventa orfana, salvando una definizione con lo stesso id viene riadottata.

Un composito non diventa mai orfano. È stato costruito apposta, quindi resta finché qualcuno non lo elimina; mentre manca uno dei suoi tag è `unavailable`.

`DELETE /api/entities/{entity_id}` elimina un composito o un'orfana. Rifiuta (409) l'entità di un tag o di una definizione di allarme che ha ancora ciò che avvolge, e dice come sparisce: si elimina il tag o la definizione, poi l'orfana. Eliminare un'entità viva farebbe solo sì che la sincronizzazione successiva la rimetta con un nuovo id, rompendo nel frattempo tutto ciò che la nomina. Per toglierla dalle schermate, nasconderla o disabilitarla.

## Come il registro resta aggiornato

Il registro non si aggancia a ogni punto in cui un tag può cambiare. Riconcilia: legge ogni tag e ogni entità, crea ciò che manca, rende orfano ciò che ha perso il tag, riadotta ciò che l'ha riavuto. Una riconciliazione non può perdere un percorso che qualcuno aggiungerà l'anno prossimo, ed eseguirla due volte equivale a eseguirla una. Viene eseguita:

- all'avvio, il che copre un aggiornamento e un ripristino da backup;
- dopo ogni ricaricamento del runtime, che ogni modifica di tag e dispositivo già innesca;
- in modo sincrono negli handler dell'API che modificano i tag (`POST /api/tags`, `DELETE /api/tags/...`, `POST /api/devices/{id}/import`, `DELETE /api/devices/{id}`) e le definizioni di allarme (`POST /api/alarms`, `DELETE /api/alarms/{id}`), così un client che crea un tag o una definizione e chiede subito la sua entità la trova.

La registrazione è serializzata tra le repliche con un blocco consultivo del database, quindi due repliche che importano lo stesso dispositivo non possono assegnare lo stesso `_2`. Ogni riconciliazione che cambia qualcosa scrive una riga nel log di sistema, non una per entità: l'importazione di cinquemila punti è un solo evento.

## Stato

`GET /api/states/{entity_id}`:

```json
{
  "entity_id": "sensor.press_01_zone1_temp",
  "state": "212.5",
  "attributes": {
    "friendly_name": "Zone1_Temp",
    "unit_of_measurement": "F",
    "device_class": "temperature",
    "source": ["press-01/Zone1_Temp"]
  },
  "quality": "good",
  "last_changed": "2026-09-26T14:02:11.482Z",
  "last_updated": "2026-09-26T14:02:11.482Z",
  "last_reported": "2026-09-26T14:07:40.100Z"
}
```

`state` è il valore reso senza la sua unità: un numero come lo mostra `/api/values`, `on` oppure `off` per `binary_sensor` e `switch`, il testo stesso per una stringa. L'unità è un attributo. Uno stato che a volte è `212.5` e a volte `212.5 F` è uno stato che nulla può confrontare.

Le regole, nell'ordine in cui vengono applicate. Sono le stesse che usa il server OPC UA per i suoi codici di stato, per lo stesso motivo: **uno stato non è mai migliore delle prove che lo sostengono.**

| Condizione | `state` | `quality` |
|---|---|---|
| Entità orfana, o il suo tag non esiste più | `unavailable` | `bad` |
| Dispositivo disabilitato, eliminato o con il collegamento non attivo | `unavailable` | `bad` |
| Collegamento attivo, ancora nulla letto in questa sessione | `unknown` | `bad` |
| Lettura cattiva | l'**ultimo valore buono**, oppure `unknown` se non ce n'è mai stato uno | `bad` |
| Lettura buona, ma altri punti del dispositivo falliscono (degradato) | il valore | `uncertain` |
| Lettura buona | il valore | `good` |

La regola della lettura cattiva conta più di quanto sembri. Un driver segnala un punto che non ha potuto leggere come una lettura cattiva di zero, e mostrare quello zero come stato trasforma "il trasmettitore di livello ha smesso di rispondere" in "il serbatoio è vuoto". L'entità continua a mostrare l'ultimo valore di cui ci si poteva fidare e dice, in `quality`, che non può più garantirlo.

Si noti la differenza tra un punto che fallisce e un dispositivo che fallisce. Un dispositivo Modbus i cui blocchi falliscono tutti abbandona la sessione e si riconnette, quindi le sue entità passano a `unavailable`. Un dispositivo che risponde per alcuni punti e non per altri resta connesso (degradato), e solo le entità dei punti in errore mostrano `bad`.

**Quanto ci mette a vedersi un dispositivo Modbus morto.** Uno che rifiuta o chiude la connessione è `unavailable` entro il polling successivo. Uno che semplicemente smette di rispondere (un cavo staccato, un PLC bloccato, uno switch che si è riavviato) tiene aperto il socket e viene giudicato dal suo timeout di polling: le sue entità sono `unavailable` entro un intervallo di polling più due volte il timeout del dispositivo, più al massimo un secondo per il ricalcolo di riserva del motore. Di solito è un timeout; due è quando il dispositivo muore a metà di un polling, perché la richiesta già sul filo riceve il suo timeout completo. Fino ad allora non è stato letto nulla di nuovo, quindi l'entità mostra ancora la sua ultima lettura così com'era. Un dispositivo bloccato che accetta ancora connessioni viene riconnesso subito, quindi dopo di ciò le sue entità alternano `unavailable` e `unknown` (connesso, nulla letto) finché non risponde di nuovo; nessuno dei due viene mai scambiato per un valore. Il timeout è la manopola: un dispositivo con un timeout di 20 secondi può sembrare a posto per 20-40 secondi dopo che è morto, quindi non impostarlo più lungo di quanto serve al dispositivo per rispondere.

Quella tabella vale per le entità di un solo tag. Un composito è più rigoroso (una lettura cattiva non mantiene mai l'ultimo valore, vedi [Come si decide lo stato di un composito](#come-si-decide-lo-stato-di-un-composito)), e lo stato di un'entità di allarme è quello del motore degli allarmi (vedi [Entità di allarme](#entità-di-allarme)).

### Timestamp

- `last_changed` si sposta solo quando cambia `state`.
- `last_updated` si sposta quando cambiano `state`, `quality` o un attributo qualsiasi.
- `last_reported` è il timestamp della lettura da cui è venuto lo stato. Manca finché non ce n'è una.

Lo stato è calcolato, non memorizzato, ma il registro delle attività conserva lo stato più recente di ogni entità e quando è cambiato l'ultima volta (`entity_last_state`, vedi [Il registro delle attività](/it/iot/logbook/)). Dopo un riavvio, un'entità il cui stato torna uguale **mantiene il suo `last_changed`**: una pompa in marcia da martedì dice ancora martedì. Gli stati unavailable e unknown che l'entità di un tag attraversa mentre il suo dispositivo si riconnette non contano come un cambiamento. Uno stato che è cambiato mentre il Gateway era fermo riceve un `last_changed` nuovo e una riga nel registro delle attività. Le entità numeriche (sensori, numeri, anelli, contatori) e i pulsanti non vengono tracciati, quindi i loro, come `last_updated` di ogni entità, ripartono dal riavvio.

### Attributi

Ogni entità porta `friendly_name` e `source` (le chiavi dei tag a cui è associata). Poi, quando si applicano:

| Attributo | Quando |
|---|---|
| `unit_of_measurement` | `sensor` e `number`: l'unità propria dell'entità, o quella del suo tag |
| `device_class`, `state_class`, `icon` | quando sono impostati sull'entità |
| `armed` | entità di comando: se il tag è scrivibile in questo momento |
| `min`, `max` | `number`: le opzioni dell'entità, altrimenti l'intervallo del tag se ne ha uno |
| `step` | `number`: l'opzione dell'entità, altrimenti 1 per un tag intero |
| `max_length`, `pattern` | `text`: le opzioni dell'entità, con `max_length` predefinito a 255 |
| `quality_reason` | entità dei tag, finché la lettura non è buona e il driver ne conosce il motivo: `no field at ENERGY.Power`, `payload is not JSON`. Sparisce con la lettura buona successiva |

### Disabilitate e nascoste

Un'entità **disabilitata** non ha alcuno stato: è assente da `/api/states`, e chiederla per id risponde che è disabilitata invece di dire che manca. Un'entità **nascosta** ha il suo stato come sempre; il flag serve alle schermate per lasciarla fuori dalle viste predefinite.

### Come gira il motore

Il motore si iscrive al bus dei tag come `entities` con una coda di 256 batch, lo stesso contratto con perdite dei motori di allarmi e di automazione: un consumatore lento perde dei batch, non blocca mai un polling. Un batch perso qui costa al massimo un secondo, perché il motore ricalcola comunque ogni entità dalla cache una volta al secondo. Quel ciclo coglie anche i cambiamenti che nulla annuncia, come l'arrivo del primo polling di un dispositivo.

I sottoscrittori dentro il processo si registrano con `Engine.OnStateChanged`. Vengono chiamati sulla goroutine propria del motore, nell'ordine in cui i cambiamenti sono avvenuti, che è ciò di cui ha bisogno una regola interessata a "da X a Y". Devono essere rapidi. Il motore non li aspetta mai; se accumulano più di 10.000 cambiamenti di ritardo, i più vecchi vengono scartati e contati.

`GET /api/diagnostics` lo riporta sotto `entities`:

| Campo | Significato |
|---|---|
| `entities` | quante entità hanno uno stato |
| `droppedBatches` | batch del bus che il motore è stato troppo lento a prendere (anche sotto `bus.droppedPerSubscriber.entities`) |
| `pendingChanges`, `droppedChanges` | la coda dell'hook dei cambi di stato. Un arretrato che cresce, o qualunque scarto, significa che un hook è troppo lento |

## Classi di dispositivo e unità

Una classe di dispositivo dice che cos'è un valore (`temperature`, `pressure`, `volume_flow_rate`, `running`, `problem`) così che una schermata possa scegliere un'icona e un consumatore di statistiche sappia che farne. Ogni classe ha le unità in cui di solito arriva. La tabella completa è `model.DeviceClasses`.

- Una classe di dispositivo sconosciuta per il dominio viene rifiutata.
- Un'unità che la classe di solito non ha viene **salvata, con un avviso** nella risposta. Gli stabilimenti etichettano le cose come le etichettano gli stabilimenti, e `degF` su una temperatura non vale il blocco di un salvataggio. `F` e `C` semplici sono accettate per la temperatura senza avviso, perché è ciò che portano davvero la maggior parte dei database di tag dei PLC.
- `state_class` (`measurement`, `total`, `total_increasing`) è solo per i sensori.
- **Non c'è conversione di unità.** L'unità è un'etichetta.

## API

Gli endpoint delle entità usano nomi di campo in snake_case (`entity_id`, `last_changed`) invece del camelCase abituale di questa API. È voluto: l'API delle entità esiste perché tutto ciò che già capisce quella forma capisca anche questa.

| Endpoint | Permesso | Funzione |
|---|---|---|
| `GET /api/entities` | `entities.read` | Ogni entità, orfane comprese. Filtri: `?domain=`, `?device=`, `?orphaned=true\|false` |
| `GET /api/entities/{entity_id}` | `entities.read` | `{"entity": ..., "state": ...}`; `state` è null per un'entità disabilitata |
| `GET /api/entities/{entity_id}/image` | `entities.read` | l'ultima immagine di una telecamera o di un'immagine |
| `PUT /api/entities/{entity_id}` | `entities.write` | Cambia i campi del registro, compresa una rinomina. Risponde `{"entity": ..., "warnings": [...]}` |
| `POST /api/entities` | `entities.write` | Crea un composito. Risponde 201 `{"entity": ..., "warnings": [...]}`. Vedi [Apparecchiature composite](#apparecchiature-composite) |
| `DELETE /api/entities/{entity_id}` | `entities.write` | Elimina un composito o un'orfana. Qualsiasi altra cosa è 409 |
| `GET /api/states` | `entities.read` | Lo stato di ogni entità abilitata, ordinato per entity_id. Filtro: `?domain=` |
| `GET /api/states/{entity_id}` | `entities.read` | Uno stato |
| `POST /api/services/{domain}/{service}` | `values.write` (`alarms.ack` per `alarm`) | Chiama un servizio su un'entità. Vedi [Servizi](#servizi). `?dry_run=true` chiede che cosa farebbe invece di farlo; vedi [Chiedere prima](#chiedere-prima-la-simulazione) |
| `GET /api/writes?entity={entity_id}` | `values.read` | Ogni scrittura che le chiamate di servizio hanno fatto o si sono viste rifiutare su un'entità, dalla più recente |

Ogni ruolo ha `entities.read`: lo stato di un'entità è il valore di un tag sotto un altro nome, che un visualizzatore può già leggere. Solo l'amministratore ha `entities.write`: l'entity_id è il nome con cui ogni automazione, dashboard e agente si riferisce all'entità, e cambiarlo è configurazione, non operatività.

Un corpo `PUT` cambia solo i campi che nomina. I campi sconosciuti sono rifiutati, come i campi di identità (`unique_id`, `domain`, `platform`, il dispositivo e le associazioni):

```json
{
  "entity_id": "sensor.zone_1_temperature",
  "name": "Zone 1 temperature",
  "device_class": "temperature",
  "state_class": "measurement",
  "unit_of_measurement": "°F",
  "icon": "mdi:thermometer",
  "entity_category": "",
  "options": {},
  "disabled": false,
  "hidden": false
}
```

`options` accetta `min`, `max` e `step` su un `number` (restringono ciò che offre una schermata; il write gate controlla comunque l'intervallo proprio del tag) e `max_length` e `pattern` su un `text`. Le opzioni di un composito sono sue (vedi ogni dominio più avanti), e un `PUT` che le cambia viene controllato contro i suoi tag esattamente come la creazione. `sensor`, `binary_sensor`, `switch` e `alarm` non ne accettano.

Un'entità ha anche un posto nell'albero delle apparecchiature e un insieme di etichette: `equipment_id` (null per seguire il suo dispositivo), l'`area_id` di sola lettura con cui i client raggruppano, e `labels`. `PUT` accetta `equipment_id` e `labels` come ogni altro campo. Vedi [l'albero delle apparecchiature e le etichette](/it/iot/equipment/).

## Servizi

Un servizio è ciò che si può fare a un'entità: `switch.turn_on`, `number.set_value`. Nomina ciò che si vuole far fare all'entità, e sotto non è altro che scritture di tag.

```
POST /api/services/switch/turn_on
{"entity_id": "switch.press_01_pump", "reason": "start of shift"}

POST /api/services/number/set_value
{"entity_id": "number.press_01_zone1_sp", "value": 212.5}
```

Il corpo è `entity_id`, un `reason` facoltativo e i dati del servizio. Un'entità per chiamata, mai un elenco, perché la risposta a "che cosa è uscito" deve riguardare una sola entità.

### Che cosa accetta ogni dominio

| Servizio | Dati | Scrive |
|---|---|---|
| `switch.turn_on`, `switch.turn_off` | nessuno | `true` o `false` nel tag di comando |
| `switch.toggle` | nessuno | l'opposto dello stato attuale, letto dalla cache in tempo reale con le stesse regole dello stato stesso. Se lo stato è `unknown`, `unavailable` o di qualità cattiva, la chiamata viene rifiutata: commutare qualcosa di cui non si conosce lo stato significa tirare a indovinare in che verso muoverlo. Dire `turn_on` o `turn_off` |
| `number.set_value` | `value`, un numero | il valore, nel tag di comando |
| `text.set_value` | `value`, una stringa | la stringa, nel tag di comando |
| `select.select_option` | `option` | il valore grezzo dell'opzione, nel tag di comando |
| `button.press` | nessuno | `press_value`, poi, `pulse_ms` dopo, `release_value`, nel tag di comando; un pulsante `single_shot` scrive `press_value` una volta e nient'altro dopo |
| `motor.start`, `motor.stop` | nessuno | `true` o `false` in `run_command` |
| `motor.reset` | nessuno | un impulso su `reset_command`: `true`, poi, `pulse_ms` dopo, `false` |
| `motor.set_speed` | `value`, un numero | il valore, in `speed_command` |
| `valve.open`, `valve.close` | nessuno | `true` o `false` in `command`; su una valvola modulante, 100 o 0 in `position_command` |
| `valve.stop` | nessuno | un impulso su `stop_command`; una valvola `single_shot` scrive `true` una volta |
| `valve.set_position` | `position`, da 0 a 100 | la posizione, in `position_command` |
| `loop.set_setpoint` | `value`, un numero | il valore, in `setpoint` |
| `loop.set_mode` | `mode`: `auto`, `manual` o `cascade` | il valore grezzo della modalità, in `mode` |
| `loop.set_output` | `value`, un numero | il valore, in `output`, **solo mentre l'anello legge manuale** |
| `counter.reset` | nessuno | 0 in un `reset_command` numerico, oppure un impulso su uno bool |
| `alarm.acknowledge` | `note`, facoltativa | nessun tag: il riconoscimento del motore degli allarmi |
| `alarm.shelve` | `minutes`, da 1 a 1440 | nessun tag: la sospensione del motore degli allarmi |
| `alarm.unshelve` | nessuno | nessun tag: la fine della sospensione del motore degli allarmi, solo su un allarme sospeso |
| `script.turn_on` | i campi dello script | nessun tag direttamente: esegue lo [script](/it/iot/scripts/), i cui passi scrivono attraverso il gate come `script:<id>` |
| `script.turn_off` | nessuno | nessun tag: ferma ogni esecuzione dello script |
| `scene.turn_on` | `params`, i parametri della ricetta, e `version`, entrambi facoltativi | nessun tag direttamente: applica la [ricetta](/it/iot/recipes/), i cui bersagli scrivono attraverso il gate con un solo id di chiamata |
| `light.turn_on` | `brightness`, da 0 a 100, facoltativo | `true` in `command`, poi la luminosità in `brightness_command` |
| `light.turn_off` | nessuno | `false` in `command` |
| `light.toggle` | nessuno | l'opposto di ciò che dice il feedback di stato della luce; rifiutato quando non si può leggere |
| `cover.open`, `cover.close`, `cover.stop` | nessuno | `open`, `close` o `stop` in `command` |
| `cover.set_position` | `position`, da 0 a 100 | la posizione, in `position_command` |
| `lock.lock`, `lock.unlock`, `lock.open` | nessuno | `lock`, `unlock` o `open` in `state` |
| `fan.turn_on` | `percentage`, `preset_mode`, entrambi facoltativi | `true` in `state`, poi ciascuno di quelli indicati |
| `fan.turn_off`, `fan.toggle` | nessuno | `false`, oppure l'opposto di ciò che dice il suo feedback, in `state` |
| `fan.set_percentage` | `percentage`, da 0 a 100 | in `percentage` |
| `fan.set_preset_mode`, `fan.set_direction` | `preset_mode`, `direction` | in `preset_mode`, `direction` |
| `fan.oscillate` | `oscillating`, true o false | in `oscillating` |
| `siren.turn_on`, `siren.turn_off`, `siren.toggle` | nessuno | come un interruttore, in `state` |
| `notify.send_message` | `message` | il messaggio, in `message` |

Un servizio composito il cui ruolo non è associato (`set_speed` su un motore senza `speed_command`) viene rifiutato prima di pianificare qualunque cosa, come servizio sconosciuto.

`sensor` e `binary_sensor` sono di sola lettura e non accettano servizi. I dati di servizio con un campo che il servizio non accetta vengono rifiutati, come un campo scritto male in qualunque altro corpo: una chiamata che va avanti senza il campo che si intendeva è peggio di una che dice di no.

Un numero intero arriva a un tag intero come intero: `42.0` è `42`.

### Ogni chiamata passa dal write gate

Una chiamata di servizio diventa un elenco ordinato di scritture, e ognuna passa da `runtime.Manager.Write`. Quindi tutto ciò che il gate impone a una scrittura su un tag, lo impone a una chiamata di servizio, nello stesso ordine:

1. scritture abilitate (`safety.allowWrites`) e, per un agente, scritture degli agenti abilitate;
2. il tag armato (`writable`);
3. il valore dentro l'intervallo del tag, rifiutato, mai limitato;
4. poi ciò che sa solo l'entità, controllato dentro il gate contro l'entità e il tag come sono in quel momento:
   - l'entità non è disabilitata (comandare qualcosa che non ha stato non è permesso);
   - il `min` e il `max` propri di un `number`, che possono solo restringere l'intervallo del tag;
   - lo `step` di un `number`, contato dal suo minimo (il proprio, altrimenti il minimo dell'intervallo del tag, altrimenti zero). Un tag intero ha un passo di 1 a meno che l'entità dica altro, quindi `1.5` su un registro di mantenimento viene rifiutato invece di essere troncato in silenzio a `1` da un driver;
   - il `max_length` di un `text` (caratteri, 255 se non impostato) e il suo `pattern`, a cui l'intero valore deve corrispondere;
   - un'opzione di `select` o una modalità di anello che non è dell'entità. Viene inviata al gate come l'opzione o la modalità richiesta e rifiutata lì, così chi prova opzioni inesistenti resta a verbale;
   - una posizione della valvola fuori da 0-100;
   - un `set_output` di un anello mentre il suo tag di modalità, letto dalla cache in tempo reale in quel momento, è qualunque cosa tranne manuale (auto, cascade, un valore che non è nessuna delle modalità, o illeggibile).

Ogni rifiuto, a uno qualsiasi di questi passi, viene **sottoposto ad audit**: una riga `write_audit` con l'entità, il servizio e l'id della chiamata, `succeeded` false e il motivo che inizia con `refused:`. Questo include un utente senza `values.write`. L'API non si limita a rispondere 403 e dimenticare: manda la chiamata al gate marcata come negata, il gate la rifiuta prima di scrivere qualsiasi cosa, e il rifiuto resta nella cronologia dell'entità con il valore richiesto.

Corrisponde alla forma di una scrittura su un dispositivo, non a un nome, quindi viene intercettato anche un aggiramento tramite un nuovo wrapper o un'interfaccia dichiarata al volo.

### Che cosa risponde una chiamata

```json
{
  "call_id": "9f2c4e1a7b3d5c60",
  "entity_id": "switch.press_01_pump",
  "service": "switch.turn_on",
  "writes": [
    {"tag": "press-01/pump", "value": "true", "status": "written"}
  ]
}
```

Ogni scrittura ha uno stato:

| Stato | Significato |
|---|---|
| `written` | il dispositivo l'ha accettata |
| `not_sent` | il gate l'ha respinta prima che arrivasse al dispositivo: un rifiuto, nessuna sessione, una riga di audit che non si è potuta aprire |
| `failed` | è partita e il dispositivo o la connessione hanno segnalato un errore. Non si sa se ha avuto effetto |
| `skipped` | mai tentata, perché una scrittura precedente della stessa chiamata non è riuscita |

Una chiamata fallita risponde con il codice di stato dell'errore (403 rifiutata da criterio o permesso, 422 valore rifiutato, 409 una commutazione senza stato noto o un'apparecchiatura nello stato sbagliato per il servizio, 503 dispositivo non connesso, 502 il dispositivo ha preso la scrittura e ha segnalato un errore, 404 nessuna entità del genere, 400 chiamata malformata, 500 una pressione il cui rilascio non è andato a buon fine, o un guasto dentro il Gateway, il cui `error` è solo un riferimento al log del server) e lo stesso corpo con `error` aggiunto.

Le scritture di una chiamata partono in ordine, la prima che non riesce chiude la chiamata, e **nulla di ciò che è già stato scritto viene annullato**. Annullare è a sua volta una scrittura, fatta senza che nessuno l'abbia chiesta, su un'apparecchiatura che si è già mossa. Deciderlo spetta all'operatore, e la risposta gli dice esattamente dove si è fermata la chiamata. Tutte le scritture di una chiamata condividono il suo `call_id`, nell'audit e nella risposta.

C'è un'eccezione, ed è il comando momentaneo: la pressione di un pulsante, il reset di un motore, lo stop di una valvola, il reset di un contatore su un bit. Sono due scritture, la pressione e, pulse_ms dopo, il rilascio, e il rilascio non è qualcosa da saltare a cuor leggero, perché saltarlo lascia un pulsante premuto. Quindi:

- Il rilascio viene comunque inviato quando la pressione è partita e ha segnalato un errore (`failed`): potrebbe aver avuto effetto. Viene saltato solo quando la pressione era `not_sent`, perché allora nulla è tenuto premuto.
- Il rilascio viene inviato anche se chi chiama riaggancia durante l'impulso. La chiamata prosegue senza di lui.
- Se la pressione è stata scritta e il rilascio è stato rifiutato o è fallito, la chiamata fallisce con un 500 e lo dice: il tag **potrebbe ancora contenere il valore di pressione**, controllarlo e rilasciarlo a mano. Il rifiuto o il fallimento del rilascio è nell'audit con lo stesso id di chiamata, e la chiamata viene registrata sotto l'entità con severità errore, non avviso.

Un impulso dura `pulse_ms`, 500 per impostazione predefinita, al massimo 10.000. La chiamata risponde quando il rilascio è fatto, quindi chi chiama aspetta l'impulso.

Ogni chiamata è anche una riga nel log di sistema, sotto l'entity_id, categoria `write`, con il motivo e, nel dettaglio, l'id della chiamata, l'origine e ogni scrittura con il suo stato. Le singole scritture di tag mantengono le proprie righe sotto i loro tag, come sempre.

`GET /api/writes?entity=switch.press_01_pump` è l'audit di quell'entità, rifiuti compresi, dal più recente. Le righe hanno `entityId`, `service` e `callId`; una scrittura diretta a un tag li omette, così ogni lettore esistente di `/api/writes` vede esattamente ciò che vedeva prima. La migrazione `0007_service_audit.sql` aggiunge le tre colonne, vuote per ogni riga esistente.

### Chiedere prima: la simulazione

`POST /api/services/{domain}/{service}?dry_run=true` chiede al gate che cosa farebbe con una chiamata, e non ne fa nulla. Stesso corpo, stesso permesso.

```json
{"dry_run":true,"entity_id":"number.press_01_zone1_sp","service":"number.set_value","writes":[{"tag":"press-01/zone1_sp","value":"212.5","status":"would_write"}]}
```

```json
{"dry_run":true,"error":"press-01/zone1_sp: this tag is not marked writable","entity_id":"number.press_01_zone1_sp","service":"number.set_value","writes":[{"tag":"press-01/zone1_sp","value":"212.5","status":"not_sent","error":"press-01/zone1_sp: this tag is not marked writable"}]}
```

La chiamata viene pianificata esattamente come quella reale, e ogni scrittura che farebbe viene sottoposta ai controlli propri del gate, nello stesso ordine, contro i tag, l'entità e il dispositivo come sono adesso: scritture attive, l'interruttore degli agenti, il tag armato, il suo intervallo, tutto ciò che sa solo l'entità (passo, pattern, un anello in manuale, un'entità disabilitata) e una sessione verso il dispositivo. La prima scrittura che verrebbe rifiutata è `not_sent` con il motivo, le altre `skipped`, e `error` è l'errore con cui fallirebbe la chiamata reale, **parola per parola**. Una scrittura che partirebbe è `would_write`. È una sola funzione del gate (`precheck`) a rispondere a entrambe, quindi una simulazione non può superare controlli che la scrittura reale fa. Un'entità `alarm` non scrive alcun tag, quindi la sua simulazione fa i controlli sugli allarmi (il motore in funzione, la definizione ancora presente, l'entità abilitata, solo un allarme sospeso può essere ripreso) e risponde senza scritture; l'allarme non viene toccato e il registro degli allarmi non riceve nulla.

È una domanda, quindi un verdetto, rifiutato o no, risponde 200. Una richiesta che la chiamata reale respingerebbe prima di qualsiasi controllo (nessuna entità del genere, un servizio che il dominio non accetta, dati che non accetta, una commutazione senza stato noto, il dominio sbagliato nel percorso) risponde con lo stesso stato e lo stesso errore della chiamata reale. Un utente senza il permesso riceve lo stesso 403.

Una simulazione non scrive nulla, non apre alcuna riga di audit, non mette nulla nel log di sistema e non consuma alcun id di chiamata: non è stato tentato nulla, quindi non c'è nulla da rendicontare.

Dice che cosa accadrebbe **adesso**. Tra la simulazione e la chiamata reale il dispositivo può cadere e qualcuno può disarmare il tag; la chiamata reale viene controllata di nuovo, per intero, al momento della scrittura. Un caso viene risposto con più precisione dei controlli della chiamata reale: un dispositivo la cui sessione è caduta mentre il suo worker si riconnette. La scrittura reale arriva fino al driver e lì fallisce (`failed`, 503, e una riga di audit per il tentativo); la simulazione dice subito `not_sent`, con lo stesso errore.

Il prompt di comando della schermata Entità e del pannello dell'entità la usa: all'apertura del prompt e mentre si digita un valore, chiede, e un rifiuto compare nel prompt, con le parole del gate, prima che qualcuno prema conferma. È un consiglio, non un blocco: la conferma va comunque al gate, che decide di nuovo.

## Apparecchiature composite

Un tag corrisponde a un'entità. Una pompa non corrisponde a un tag: ha un comando di marcia, un contatto di marcia, un guasto, un reset e magari una velocità, e l'operatore la vede come una cosa sola. Un composito è quella cosa sola, associata a ciascuno dei suoi tag con un **ruolo** con nome.

Un amministratore ne costruisce uno con `POST /api/entities`:

```json
{
  "domain": "motor",
  "name": "Infeed pump",
  "device_class": "pump",
  "options": {"pulse_ms": 500},
  "bindings": [
    {"role": "running",       "device_id": "press-01", "tag_name": "P101_Running"},
    {"role": "run_command",   "device_id": "press-01", "tag_name": "P101_RunCmd"},
    {"role": "fault",         "device_id": "press-01", "tag_name": "P101_Fault"},
    {"role": "reset_command", "device_id": "press-01", "tag_name": "P101_Reset"}
  ]
}
```

`entity_id` è facoltativo. Se lo si omette ne viene creato uno dal nome (`motor.infeed_pump`, poi `_2` e così via). Se lo si indica viene usato esattamente, e uno già preso è un 409, non un `_2` silenzioso: si è chiesto proprio quel nome. `name`, `device_class`, `unit_of_measurement`, `icon`, `entity_category` e `options` sono gli stessi campi di registro che ha ogni entità. Lo si colloca nell'albero delle apparecchiature e lo si etichetta con `PUT` in seguito.

La creazione controlla tutto ciò che può contro i tag come sono adesso, e rifiuta (400, dicendo che cosa correggere) tutto ciò che non va:

- il dominio è uno tra `select`, `button`, `motor`, `valve`, `loop`, `counter`, `weather` (`GET /api/entities/composites` dice quali, e i ruoli di ciascuno). I domini dei tag vengono creati per voi dai tag, e `alarm` dalle definizioni di allarme;
- ogni ruolo obbligatorio è associato, e nessun ruolo che il dominio non ha;
- **ogni tag associato esiste**;
- **il tipo di ogni tag è adatto al suo ruolo**: il `running` di un motore è un bool, il `position` di una valvola è un numero, il conteggio di un contatore è un intero;
- **ogni tag su cui scrive un servizio è già armato** (`writable`). Un composito non arma mai nulla. Armare un punto resta una decisione che qualcuno prende sul tag, uno alla volta, come è sempre stato;
- ogni valore grezzo nelle opzioni (il valore di un'opzione select, i valori di pressione e rilascio di un pulsante, le modalità di un anello) è uno che il suo tag può assumere. `1.5` viene rifiutato ora per un registro intero, non quando qualcuno preme il pulsante.

Un composito se ne va con il suo dispositivo quando tutti i suoi tag sono su un solo dispositivo, e non appartiene a nessuno quando ne coprono diversi. Le sue associazioni sono fisse: un insieme diverso di tag è un'entità diversa, quindi si elimina e se ne costruisce un'altra.

Ogni creazione ed eliminazione è una riga nel log di sistema sotto l'entity_id, categoria `config`, con le associazioni.

### Ruoli

| Dominio | Ruolo | Tipo di tag | <span class="sr-only">Dettagli</span> |
|---|---|---|---|
| `select` | `state` | qualsiasi | obbligatorio. Feedback: riletto per trovare l'opzione |
| | `command` | qualsiasi | obbligatorio, armato. Scritto con il valore grezzo dell'opzione. Può essere lo stesso tag di `state` |
| `button` | `command` | qualsiasi | obbligatorio, armato. A impulso |
| `motor` | `running` | bool | obbligatorio. Feedback: il contatto di marcia |
| | `run_command` | bool | obbligatorio, armato. `start` scrive true, `stop` false |
| | `fault` | bool | feedback |
| | `reset_command` | bool | armato. A impulso con `reset` |
| | `speed` | numero | feedback, l'attributo `speed` |
| | `speed_command` | numero | armato. Scritto da `set_speed` |
| `valve` | `state` | qualsiasi | feedback: dove dice di essere, a parole, una valvola che si è annunciata |
| | `opened`, `closed` | bool | feedback: i finecorsa |
| | `position` | numero | feedback, da 0 a 100 per cento |
| | `fault` | bool | feedback |
| | `command` | bool | armato. Una valvola on/off: `open` scrive true, `close` false |
| | `position_command` | numero | armato. Una valvola modulante: `set_position`, e `open`/`close` come 100/0 |
| | `stop_command` | bool | armato. A impulso con `stop` |
| `loop` | `pv` | numero | obbligatorio. Lo stato |
| | `setpoint` | numero | obbligatorio, armato. Letto per l'attributo, scritto da `set_setpoint` |
| | `output` | numero | obbligatorio, armato. Letto per l'attributo, scritto da `set_output` |
| | `mode` | qualsiasi | obbligatorio, armato. Letto per conoscere la modalità, scritto da `set_mode` |
| `counter` | `state` | intero | obbligatorio. Il conteggio |
| | `reset_command` | bool o numero | armato. A impulso se bool, scritto con 0 se numero (può essere il registro del conteggio stesso) |
| `weather` | `temperature` | numero | obbligatorio. Lo stato |
| | `humidity`, `pressure`, `wind_speed`, `wind_gust`, `wind_bearing`, `rain_rate`, `rain_today`, `solar_radiation`, `uv_index` | numero | feedback, ciascuno un attributo. Nessuno è armato: una stazione si legge, non si comanda mai |

Una valvola ha bisogno di almeno uno tra `state`, `opened`, `closed` e `position` (qualcosa deve dire dove si trova) e di esattamente uno tra `command` e `position_command`. Entrambi insieme sarebbero due risposte a "dove le è stato detto di andare", e lo stato tra i finecorsa dipende da quella risposta. Se il PLC li ha davvero entrambi, si creano due entità.

### Opzioni

| Opzione | Dominio | <span class="sr-only">Dettagli</span> |
|---|---|---|
| `select_options` | `select` | obbligatorio: `[{"option": "low", "value": 1}, ...]`, nell'ordine in cui una schermata le offre. Nomi unici, valori unici (due opzioni con lo stesso valore renderebbero lo stato una congettura), ogni valore un numero, un bool o una stringa |
| `press_value`, `release_value` | `button` | insieme o per niente. Se omessi su un tag bool, sono `true` e `false`, scritti nelle opzioni così che ciò che fa il pulsante resti a verbale. Ogni altro tipo di tag ha bisogno di entrambi |
| `pulse_ms` | `button`, `motor`, `valve`, `counter` | per quanto tempo viene tenuto un comando momentaneo. Da 1 a 10.000, 500 se non impostato |
| `single_shot` | `button`, `valve` | `true` scrive `press_value` una volta e non rilascia mai: la pressione è l'intero comando. Un pulsante MQTT scoperto lo è, perché il suo "rilascio" sarebbe un secondo comando che il dispositivo non ha mai chiesto. Accetta `press_value` e non `release_value` né `pulse_ms`. Su una valvola, il suo `stop` scrive `true` una volta invece di un impulso: lo stop di una valvola scoperta è un comando a sé |
| `event_types` | `event` | i tipi di evento che può generare, quando lo dice |
| `role_choices` | `lock`, `fan`, `siren`, `notify`, `update`, `device_tracker`, `climate`, `humidifier`, `water_heater` | le parole che ogni ruolo comandato offre, per ruolo, da 1 a 64 distinte ciascuna: le modalità di un termostato. La scoperta lo imposta dalla configurazione |
| `modes` | `loop` | obbligatorio: il valore grezzo del tag di modalità per ogni modalità, `{"auto": 1, "manual": 0}` come minimo, `cascade` se il controllore ce l'ha |

### Come si decide lo stato di un composito

Lo stato di un composito viene dal suo **feedback**. Non è mai calcolato dal fatto che HotLoop abbia inviato un comando. Un motore a cui è stato detto di partire e il cui contatto di marcia non si è chiuso non è in marcia, sta partendo, e se il contatto non si chiude mai resta in partenza finché qualcuno non guarda. La rilettura di un tag di comando conta come feedback: è il PLC che dice che cosa contiene, non HotLoop che ricorda ciò che ha scritto.

Un composito **non è mai ottimista**. Un sensore singolo continua a mostrare il suo ultimo valore buono attraverso una lettura cattiva; un composito no. Ogni ruolo di feedback che decide lo stato deve avere una lettura buona, altrimenti:

| Condizione | `state` | `quality` |
|---|---|---|
| un tag decisivo non esiste più, o il suo dispositivo è fuori servizio | `unavailable` | `bad` |
| un tag decisivo non ha ancora una lettura, o ne ha una cattiva | `unknown` | `bad` |
| tutti i tag decisivi buoni, uno di essi incerto o su un dispositivo degradato | lo stato | `uncertain` |
| tutti i tag decisivi buoni | lo stato | `good` |

Un motore il cui ingresso di guasto ha smesso di rispondere è `unknown`, non il `running` che era un secondo prima. Quali ruoli decidono è indicato più avanti; gli altri riempiono solo attributi, e uno illeggibile viene semplicemente lasciato fuori.

L'attributo `armed` di un composito è true solo quando ogni tag su cui scrive uno qualsiasi dei suoi servizi è armato in questo momento. Un motore che si può avviare ma non fermare da qui non è uno che una schermata debba offrire.

### `motor`

Ruoli decisivi: `running`, e `fault` se associato. Stato, la prima regola che corrisponde:

1. `fault` attivo: **`fault`**, qualunque altra cosa sia vera. Marcia e guasto insieme sono contraddittori, e ciò che richiede una persona è il guasto; l'attributo `running` dice comunque che sta girando.
2. in marcia, e il comando di marcia riletto è spento: **`stopping`**.
3. in marcia: **`running`**.
4. non in marcia, e il comando di marcia riletto è acceso: **`starting`**.
5. altrimenti: **`stopped`**.

Se la rilettura del comando di marcia è illeggibile non decide nulla: il motore è allora `running` o `stopped` solo in base al suo contatto. HotLoop non pone un timeout a un avviamento che non si compie: è un mancato avviamento, e appartiene al PLC o a una definizione di allarme sul contatto di marcia.

Attributi: `running`, `fault` (se associato), `command` (la rilettura), `speed` (se associato e leggibile), `device_class` (`pump`, `fan`, `conveyor`, `compressor`, `agitator`).

### `valve`

Una valvola che si è annunciata (scoperta MQTT) dice a parole dove si trova sul suo ruolo `state`: `open`, `closed`, `opening`, `closing` o `stopped`, e quello è il suo stato, con `current_position` tratto da `position` quando ne riporta una. Una parola che non è nessuna di queste è `unknown`, con ciò che ha detto in `raw_value`. Il resto di questa sezione riguarda una valvola costruita da tag di PLC.

Ruoli decisivi: ognuno di quelli associati tra `opened`, `closed`, `position`, `fault`. Stato, la prima regola che corrisponde:

1. `fault` attivo: **`fault`**.
2. entrambi i finecorsa raggiunti: **`fault`**, con `limit_conflict: true`. Una valvola non può essere aperta e chiusa, quindi un finecorsa mente, e quale non è cosa da indovinare.
3. finecorsa di apertura raggiunto: **`open`**. Finecorsa di chiusura raggiunto: **`closed`**.
4. nessun finecorsa, solo una posizione: all'1% o meno **`closed`**, al 99% o più **`open`**.
5. tra gli estremi, in movimento o ferma secondo ciò che le viene comandato: un comando di posizione riletto più dell'1% sopra la posizione è **`opening`**, più dell'1% sotto **`closing`**, entro l'1% **`stopped`**; un comando on/off riletto acceso è **`opening`**, spento **`closing`**; senza nulla su cui basarsi, **`stopped`**.

Una valvola on/off ferma tra i suoi finecorsa mentre è ancora comandata aperta si legge `opening`. Se serve vederla ferma lì, associare `position`.

`current_position` è il feedback di posizione quando è associato, altrimenti 100 sul finecorsa di apertura e 0 su quello di chiusura, e assente nel mezzo. Altri attributi: `open_limit`, `closed_limit`, `fault`, `device_class` (`water`, `gas`, `steam`, `air`).

### `loop`

Lo stato è la variabile di processo, resa come quella di un sensore, da `pv` soltanto. Gli attributi sono `setpoint` e `output` (presenti quando leggibili), `mode` (il nome della modalità che legge il tag di modalità, oppure `unknown` quando non si può leggere o contiene un valore che non è nessuna delle modalità), `modes` (i nomi configurati) e `unit_of_measurement` (quella dell'entità, altrimenti quella del tag PV). Un anello prende le classi di dispositivo dei sensori: un anello di temperatura, un anello di pressione.

`set_output` viene rifiutato dentro il gate a meno che l'anello legga manuale **nel momento della scrittura**. Un'uscita scritta su un anello in auto lotta contro il controllore, e in cascade contro due. Una modalità che non si può leggere non è manuale. Il rifiuto è una riga `write_audit` come le altre, con l'entità, il servizio, l'id della chiamata e il valore richiesto, e la chiamata risponde 409. Prima mettere l'anello in manuale con `set_mode`.

### `counter`

Lo stato è il conteggio, un tag intero. `reset` scrive 0 in un `reset_command` numerico (associare il registro del conteggio stesso se è così che il PLC lo azzera) oppure dà un impulso su uno bool. Un contatore senza `reset_command` è di sola lettura. `unit_of_measurement` è quella dell'entità, altrimenti quella del tag.

### `weather`

Una stazione da tetto come un'unica entità: vedi [Meteo](/it/iot/weather/). Lo stato è la temperatura; ogni altra lettura è un attributo, presente solo quando il suo sensore può essere letto, con il punto di rugiada, l'indice di calore e il wind chill calcolati da esse. Una lettura associata che non si può leggere è nominata in `unavailable`, mai mostrata come zero. Non accetta servizi.

### `select`

Lo stato è l'opzione il cui valore grezzo legge il tag `state`. Un valore che non è nessuna delle opzioni è `unknown`, con il valore grezzo in `raw_value`, invece dell'opzione più vicina o dell'ultima. L'attributo `options` elenca i nomi delle opzioni in ordine. Un'opzione che non è del select viene rifiutata nel gate e sottoposta ad audit con l'opzione richiesta.

### `button`

Un pulsante non ha feedback. Il suo stato è l'ora dell'ultima pressione tramite questo Gateway, oppure `unknown` se non è stato premuto dall'avvio del Gateway. È `unavailable` quando il suo tag di comando non esiste più o il suo dispositivo è fuori servizio, perché allora premerlo non può funzionare. L'ultima pressione è tenuta in memoria, quindi si azzera a un riavvio; l'audit ha comunque ogni pressione, ed è anche per questo che il registro delle attività non registra lo stato di un pulsante.

## Luci, tapparelle ed eventi

Create dalla [scoperta MQTT](/it/iot/mqtt-discovery/) per un dispositivo che si è annunciato, associate ai tag che la scoperta ha creato per lui. Nessuno le costruisce da tag di PLC, quindi `POST /api/entities` non le accetta. Stesse regole di ogni composito: lo stato è ciò che dice il feedback, mai ciò che HotLoop ha inviato per ultimo, e ogni servizio è una serie di scritture attraverso il gate, con ogni tag armato prima da una persona.

| Dominio | Ruolo | Tipo di tag | <span class="sr-only">Dettagli</span> |
|---|---|---|---|
| `light` | `state` | bool | feedback: accesa o spenta |
| | `command` | bool | armato. `turn_on` scrive true, `turn_off` false. Lo stesso tag di `state` |
| | `brightness` | numero | feedback, da 0 a 100 per cento, l'attributo `brightness` |
| | `brightness_command` | numero | armato. `turn_on` con un `brightness`. Lo stesso tag di `brightness` |
| `cover` | `state` | qualsiasi | feedback: `open`, `closed`, `opening`, `closing` o `stopped` |
| | `command` | qualsiasi | armato. `open`, `close` o `stop`. Lo stesso tag di `state` |
| | `position` | numero | feedback, da 0 (chiusa) a 100 (aperta), `current_position` |
| | `position_command` | numero | armato. `set_position`. Lo stesso tag di `position` |
| `event` | `state` | qualsiasi | il tipo di evento che ha generato per ultimo |
| `lock` | `state` | qualsiasi | letto e scritto: `locked`, `unlocked`, `locking`, `unlocking`, `jammed`, `open`, `opening`; accetta `lock`, `unlock`, `open` |
| `fan` | `state` | bool | letto e scritto: acceso o spento |
| | `percentage` | numero | letto e scritto, da 0 a 100 |
| | `preset_mode`, `direction` | qualsiasi | letto e scritto |
| | `oscillating` | bool | letto e scritto |
| `siren` | `state` | bool | letto e scritto: accesa o spenta |
| `notify` | `message` | qualsiasi | scritto: il messaggio. Nulla da leggere |
| `update` | `installed_version`, `latest_version` | qualsiasi | letto |
| `device_tracker` | `state` | qualsiasi | letto: `home`, `not_home`, o la zona che nomina |
| `climate` | `mode` | qualsiasi | letto e scritto: lo stato. `set_hvac_mode` con `hvac_mode` |
| | `temperature`, `target_temp_low`, `target_temp_high` | numero | letto e scritto. `set_temperature` con uno qualsiasi di essi |
| | `target_humidity` | numero | letto e scritto. `set_humidity` con `humidity` |
| | `fan_mode`, `swing_mode`, `swing_horizontal_mode`, `preset_mode` | qualsiasi | letto e scritto, ciascuno con il proprio servizio `set_` |
| | `current_temperature`, `current_humidity`, `action` | numero, numero, qualsiasi | letto |
| | `power` | bool | scritto: `turn_on` true, `turn_off` false. Nulla da leggere |
| `humidifier` | `state` | bool | letto e scritto: acceso o spento |
| | `target_humidity` | numero | letto e scritto. `set_humidity` con `humidity` |
| | `mode` | qualsiasi | letto e scritto. `set_mode` con `mode` |
| | `current_humidity`, `action` | numero, qualsiasi | letto |
| `water_heater` | `mode` | qualsiasi | letto e scritto: lo stato. `set_operation_mode` con `operation_mode` |
| | `temperature` | numero | letto e scritto. `set_temperature` |
| | `current_temperature` | numero | letto |
| | `power` | bool | scritto: `turn_on`, `turn_off` |
| `alarm_control_panel` | `state` | qualsiasi | letto: `disarmed`, `armed_home`, `armed_away`, `armed_night`, `armed_vacation`, `armed_custom_bypass`, `pending`, `triggered`, `arming`, `disarming`; scritto da `alarm_arm_home`, `alarm_arm_away`, `alarm_arm_night`, `alarm_arm_vacation`, `alarm_arm_custom_bypass`, `alarm_disarm`, `alarm_trigger` |
| `vacuum` | `state` | qualsiasi | letto: `cleaning`, `docked`, `paused`, `idle`, `returning`, `error`; scritto da `start`, `pause`, `stop`, `return_to_base`, `clean_spot`, `locate` |
| | `battery_level` | numero | letto |
| | `fan_speed` | qualsiasi | letto e scritto. `set_fan_speed` con `fan_speed` |
| `lawn_mower` | `activity` | qualsiasi | letto: `mowing`, `paused`, `docked`, `error`, `returning` |
| `camera` | `image` | qualsiasi | letto: un hash dell'ultima immagine. Lo stato è quando è cambiata; `entity_picture` è dove ottenerla |
| `image` | `image` o `url` | qualsiasi | letto: un'immagine conservata come per una telecamera, o un link (`url`, solo http o https, mai scaricato) |
| | `start_mowing`, `pause`, `dock` | bool | scritto: una pressione ciascuno, con il servizio dello stesso nome |

Lo stato è la lettura del ruolo di stato (acceso o spento per un bool), `unknown` quando non si può leggere, e ogni altro ruolo che si può leggere è un attributo con il proprio nome: il `percentage`, `preset_mode`, `oscillating` e `direction` di un ventilatore. `toggle` si regola sul feedback e viene rifiutato quando non ce n'è. Un notificatore non ha nulla da leggere: il suo stato è `unknown` con `feedback: none`. Un aggiornamento è `on` quando ciò che è installato non è l'ultimo, e non accetta servizi: HotLoop non installa mai firmware, perché un flash fallito è un fermo. Una scena scoperta è un pulsante a colpo singolo, la sua pressione è il payload della scena.

Ciò che si può inviare a un'apparecchiatura è nei suoi attributi, secondo la sua configurazione: gli `hvac_modes`, `fan_modes`, `preset_modes` e `swing_modes` di un termostato, gli `available_modes` di un umidificatore, l'`operation_list` di uno scaldacqua, i `preset_modes` di un ventilatore, la `fan_speed_list` di un aspirapolvere (dall'opzione `role_choices` dell'entità, che la scoperta tiene allineata alla configurazione), e i `min_temp`/`max_temp` e `min_humidity`/`max_humidity` del setpoint (dall'intervallo del tag). È ciò che offrono le schermate. Non è ciò che fa la regola: il gate tiene il setpoint nell'intervallo del tag e il driver rifiuta una parola che la configurazione non elenca, qualunque cosa dica un attributo. `set_temperature` senza nessuna delle sue tre chiavi viene rifiutato, non è una chiamata che non fa nulla. Anche `turn_on` su un termostato senza topic di alimentazione viene rifiutato, invece di indovinare quale modalità significhi "acceso".

### `light`

Accesa o spenta secondo il suo feedback `state`; `unknown` quando non si può leggere, e senza alcun topic di stato, `unknown` per sempre con `feedback: none`. La luminosità è un attributo, e anche `color_mode`, `color`, `color_temp` e `effect` di una luce con schema JSON sono attributi: mostrati, non comandati. `toggle` si regola sul feedback e viene rifiutato quando non ce n'è.

### `cover`

Il suo feedback `state` quando ne ha uno. Con solo una posizione: all'1% o meno `closed`, qualsiasi valore sopra `open`. Una parola che non è nessuna delle cinque è `unknown`, con `raw_value`. `current_position` è la posizione quando ce n'è una.

### `event`

Lo stato di un evento è **quando** è stato generato l'ultima volta (RFC 3339), e `event_type` che cos'era; `event_types` elenca ciò che può generare. `unknown` finché non è stato generato da quando HotLoop ha iniziato a leggerlo. Non accetta servizi: nulla comanda un evento. Due eventi in un solo polling compaiono come il più recente; il registro delle attività e lo storico hanno ogni lettura come è arrivata.

## Entità di allarme

Ogni definizione di allarme è un'entità: `alarm.<definition id>` (con lo stesso slug di un tag, quindi `oven-temp-hi` è `alarm.oven_temp_hi`), piattaforma `alarm`, `unique_id` `alarm:<definition id>`, con il nome della definizione. Non ha associazioni né dispositivo: il suo stato è quello del motore degli allarmi, non di un tag, e una definizione non appartiene al suo dispositivo come un tag (eliminando un dispositivo le sue definizioni di allarme restano). Il tag che osserva è il suo attributo `source`.

Lo stato è lo stato ISA-18.2 che tiene il motore degli allarmi, scritto come si scrive lo stato di un'entità:

| Motore degli allarmi | Stato dell'entità | <span class="sr-only">Dettagli</span> |
|---|---|---|
| `normal` | `normal` | condizione rientrata, nulla in sospeso |
| `unack-active` | `active_unack` | condizione vera, nessuno l'ha riconosciuta |
| `ack-active` | `active_ack` | condizione vera, riconosciuta |
| `rtn-unack` | `rtn_unack` | rientrata prima che qualcuno la riconoscesse |
| `shelved` | `shelved` | silenziata da un operatore, per un tempo limitato |
| `suppressed` | `suppressed` | silenziata per progetto |

La qualità è `good`: lo stato del motore non è una lettura. L'entità è `unavailable` quando è orfana o il Gateway non ha un motore degli allarmi. Segue ogni transizione mentre avviene, riconoscimenti compresi.

Attributi: `definition_id`, `source`, `condition`, `limit`, `priority` (da 1 a 4), `priority_label`, `enabled`, `message`, `count`, `active`, `needs_ack`, `trip_value`, `raised_at`, `cleared_at`, `acked_at`, `acked_by`, `shelved_until`, `shelved_by`, gli ultimi presenti quando si applicano.

I suoi servizi, `acknowledge`, `shelve` e `unshelve`, non scrivono alcun tag, quindi non passano dal write gate. Chiamano i `Ack`, `Shelve` e `Unshelve` del motore degli allarmi stesso, gli stessi che chiamano la schermata degli allarmi e `POST /api/alarms/{id}/ack`, così finiscono nel registro degli allarmi (`alarm_events`) e nel log di sistema esattamente come loro. Richiedono **`alarms.ack`**, non `values.write`: un operatore riconosce gli allarmi, un visualizzatore no. Una chiamata rifiutata risponde 403 e viene registrata sotto l'entità con chi ha provato. La chiamata è anche una riga nel log di sistema sotto l'entità, con il motivo.

`unshelve` viene rifiutato (409) su un allarme che non è sospeso. Lo rifiuta anche il motore degli allarmi, e riporta un allarme sospeso nello stato in cui la sua condizione è davvero, non ciecamente a normal. Un servizio che gli allarmi non accettano (`turn_on`) viene rifiutato come servizio sconosciuto (400) prima di avvicinarsi al motore.

### Piattaforme con un provider

Le entità di allarme sono la prima piattaforma con **provider**: entità la cui fonte di verità è altrove rispetto a un tag. Un provider dice quali entità ha ora la sua piattaforma, rende il loro stato, esegue i loro servizi e risponde alle loro simulazioni; il registro deriva, rende orfane e riadotta le sue entità tramite `unique_id` esattamente come fa con quelle di un tag, il motore degli stati le ricalcola sugli eventi del provider stesso e sul suo ciclo di una volta al secondo, e una chiamata di servizio su una va al provider invece di essere pianificata in scritture di tag. Un provider che scrive un tag lo scrive comunque attraverso il gate.

Gli helper sono la seconda: `input_boolean`, `input_number`, `input_select`, `input_text`, `input_counter`, `timer` e `schedule`, valori che appartengono alle persone dello stabilimento e non a un PLC, tenuti da HotLoop e impostati con `helpers.write`. Non scrivono alcun tag. Vedi [Helper](/it/iot/helpers/).

Gli script sono la terza: ogni script è un'entità `script`, `script.<id>`, accesa mentre è in corso un'esecuzione in qualunque processo e spenta quando non ce n'è nessuna. `turn_on` lo esegue con i dati del servizio come suoi campi, `turn_off` lo ferma, entrambi con `scripts.run`. Eliminare uno script rende orfana la sua entità, come eliminare una definizione di allarme. Vedi [Script di procedura](/it/iot/scripts/).

Le ricette sono la quarta: ogni ricetta è un'entità `scene`, `scene.<id>`, il cui stato è quando ha scritto per l'ultima volta sull'impianto e i cui attributi dicono com'è andata la sua applicazione più recente. `turn_on` la applica, con `recipes.apply` e il permesso proprio della ricetta quando ne nomina uno. Eliminare una ricetta rende orfana la sua entità. Vedi [Ricette di prodotto](/it/iot/recipes/).

Il sole è la quinta: `binary_sensor.sun_up`, `sensor.sun_elevation` e `sensor.sun_azimuth`, calcolati ogni secondo dalla latitudine e longitudine del sito, sulla macchina. Si leggono e non accettano servizi. Un sito senza posizione non li ha, e quelli rimasti da quando ce l'aveva risultano non disponibili e dicono quali variabili impostare. Vedi [il sole](/it/iot/sun/).

## Le entità ovunque

### Il flusso in tempo reale

`GET /api/stream` porta un evento `entities` accanto a `values`. Viene aggregato nello stesso modo, al massimo quattro volte al secondo, lo stato più recente per entità:

```
event: entities
data: {"changed":[{"entity_id":"sensor.press_01_zone1_temp","state":"212.5",...}],"removed":[]}
```

`changed` è lo stato completo di ogni entità cambiata dall'ultimo evento, nella stessa forma di `GET /api/states/{entity_id}`. `removed` sono gli entity_id che non hanno più alcuno stato: disabilitati, eliminati con il loro dispositivo, o rinominati (il nuovo nome arriva in `changed`). Il primo evento `entities` di una nuova connessione porta ogni stato, come `snapshot` porta ogni lettura, così una schermata è popolata prima che cambi qualcosa. Gli eventi `values`, `snapshot`, `alarm` e `device` sono esattamente quelli di prima.

### MCP

Gli agenti dispongono di `list_entities`, `get_states` e `call_service`. `call_service` passa dallo stesso esecutore di servizi di `POST /api/services/...`, quindi la chiamata di un agente è controllata dall'interruttore MCP come `write_tag` e sottoposta ad audit contro l'entità con origine `mcp`. Vedi [MCP](/it/iot/mcp/#entità).

### Automazioni

Un trigger `state` fa scattare una regola quando cambia lo stato di un'entità, le condizioni possono leggere `states`, `attrs` e le `qualities` delle entità, e un'azione `call_service` comanda un'entità attraverso il gate, sottoposta ad audit come `automation:<rule-id>`. Vedi [Automazioni](/it/iot/automations/#i-trigger-di-stato-seguono-le-entità).

Entrambi seguono l'hook `OnStateChanged` del motore, ed è per questo che contano le regole di [Come gira il motore](#come-gira-il-motore): un trigger di stato vede ogni cambiamento che il motore calcola, una volta, in ordine, e nulla che il motore non abbia mai visto.

## Schermate

**Entità** elenca ogni entità sotto il suo posto nell'albero delle apparecchiature (il proprio, altrimenti quello del suo dispositivo), con l'albero a lato, e filtra per posto, dominio, etichetta, testo e qualità. All'interno di un posto prima vengono le apparecchiature (allarmi, motori, valvole, anelli, select, pulsanti, contatori), poi ciò che si può comandare, poi le letture grezze.

Per impostazione predefinita la schermata mostra ogni segnale una volta sola. Il modello delle entità dà apposta più entità a uno stesso punto, e ognuna mantiene il proprio id, ma disegnate come tessere sono lo stesso segnale due o tre volte: un tag armato è un sensore e un interruttore, e un tag associato a un motore è comunque il proprio sensore. Su una linea reale questo raddoppiava più o meno le tessere e seppelliva le apparecchiature. Quindi la schermata raggruppa:

- L'entità di lettura di un tag sta dietro la sua entità di comando. L'interruttore o il numero è la tessera, visto che mostra già lo stato in tempo reale, e il suo pannello dice "disponibile anche come" con l'entity_id del sensore, per chi sta collegando un'automazione o un agente.
- Un tag associato a un composito sta dentro il composito, con entrambe le sue entità. Il pannello del composito elenca i suoi segnali: i ruoli, il tag, ciò che legge ora, e i suoi entity_id di lettura e di comando. Un tag in due compositi va nel primo per nome.
- Solo un comando o un composito che non sia né nascosto né disabilitato accoglie qualcosa. Si nasconde o si disabilita l'interruttore e il suo sensore riottiene la sua tessera.
- Un allarme su un segnale raggruppato segnala la tessera in cui è raggruppato, con il nome dell'allarme, e apre l'allarme da lì. Raggruppare riordina la schermata; non nasconde mai un allarme.
- Il conteggio accanto alla barra della qualità dice "13 visualizzati · 25 raggruppate", e una tessera che ne contiene altre lo dice nel suo piede ("5 segnali", "+ sensor"). I chip di dominio, i conteggi dell'albero e la barra della qualità contano le tessere mostrate.
- La ricerca e il filtro per etichetta guardano dentro le tessere. Cercando un entity_id o un tag che è raggruppato si ottiene la tessera che lo contiene, evidenziata, con "Trovato qui:" e l'entity_id. L'abbiamo preferito a ribaltare l'intera schermata su ogni entità: si arriva alla pompa che si cercava, non a un muro di tessere.

"Mostra ogni entità" disattiva il raggruppamento e dà a ogni entità la sua tessera, per un ingegnere che vuole il registro grezzo. È disattivato per impostazione predefinita e questo browser lo ricorda (archiviazione locale; una finestra privata lo dimentica). La schermata di nessun altro cambia.

Gli stati arrivano con l'evento `entities` del flusso in tempo reale; la schermata non li interroga mai. Una tessera si ridisegna quando cambia il suo stato, e si ridisegna anche mentre un pulsante al suo interno ha il focus, perché una tessera che mantenesse un vecchio stato per questo motivo mostrerebbe il passato come presente. La qualità viene disegnata prima del valore:

| Qualità | Sullo schermo |
|---|---|
| buona | il valore, nessun segno |
| incerta | il valore, un bordo ambra e un badge "incerto" |
| cattiva | l'ultimo valore buono, in grigio su una trama, "cattivo", e "ultimo valore buono, lettura cattiva", con il motivo dopo quando il driver lo ha dato |
| ancora nessuna lettura | "Sconosciuto", in corsivo, e "lettura cattiva" con il motivo quando c'è |
| non disponibile | "Non disponibile", l'intera tessera tratteggiata |

I controlli seguono il dominio e il ruolo. Un visualizzatore non ne vede nessuno. Un operatore vede quelli dietro `values.write` (e quelli di un allarme, dietro `alarms.ack`), disabilitati con il motivo indicato quando le scritture sono spente su questa installazione o un tag su cui scrive l'entità non è armato. L'uscita di un anello viene offerta solo mentre legge manuale, perché è l'unico momento in cui il gate la permette. Ogni comando apre un prompt che dice quale servizio, quali tag e che cosa legge ora l'entità, e chiede un motivo per l'audit. Un rifiuto tiene il prompt aperto con le parole del gate e ogni scrittura che è partita o no. Il nuovo stato non è mai dato per scontato dal comando: torna sul flusso quando il dispositivo lo rilegge, oppure non torna.

Il pannello ha lo stato e i suoi timestamp, i controlli, un'ora, sei ore o un giorno di storico del tag associato (un tracciato a gradini, l'ultimo valore portato fino a ora, le letture cattive marcate), le altre entità dello stesso segnale, le associazioni (per un composito, i suoi segnali), gli attributi, e ogni comando dato o rifiutato tramite l'entità. Un amministratore ottiene anche l'entity_id, il nome, il posto nell'albero, le etichette, nascosta e disabilitata, ed elimina per un composito o un'orfana.

**Nuova apparecchiatura** (amministratore) costruisce un composito: si sceglie il dominio, gli si dà un nome e si sceglie un tag per ogni ruolo. A ogni ruolo vengono offerti solo tag di un tipo adatto, e un ruolo di comando mostra i tag non armati come disabilitati invece di nasconderli. Ciò che è obbligatorio è segnato ma non imposto dal modulo: decide il registro, e il suo rifiuto viene mostrato come l'ha scritto.

**Stabilimento** è l'albero delle apparecchiature e le etichette. Vedi [L'albero delle apparecchiature e le etichette](/it/iot/equipment/).

## Backup e ripristino

`entities` e `entity_bindings` sono nel backup, entity_id, personalizzazioni e tutto. Questo include i compositi, con ogni ruolo e ogni opzione, il che conta più per loro che per qualsiasi altra cosa: l'entità di un tag si potrebbe ricostruire dal suo tag, ma nulla può ricostruire un composito tranne il backup. Le entità di allarme tornano con le loro definizioni, e una definizione ripristinata senza entità ne riceve una alla prima sincronizzazione. Un backup fatto prima di questa versione non ha nessuna delle due tabelle; lo si ripristina, si avvia il Gateway, e la prima sincronizzazione del registro dà a ogni tag ripristinato la sua entità. Anche `entity_labels` è nel backup, e il ripristino di un backup precedente all'albero delle apparecchiature è trattato in [L'albero delle apparecchiature e le etichette](/it/iot/equipment/).

La migrazione 0007 aggiunge tre colonne a `write_audit`. Un backup fatto prima di essa si ripristina comunque: il ripristino carica un file con meno colonne della tabella di oggi nelle colonne iniziali e lascia che le nuove prendano i valori predefiniti, perché una migrazione che aggiunge una colonna la aggiunge sempre in coda. Un backup di una versione più recente viene ancora rifiutato. Vedi [Backup e ripristino](/it/iot/backup/).

## Che cosa non c'è ancora

Il nucleo, l'albero delle apparecchiature, il comando delle entità attraverso il write gate, le apparecchiature composite, le entità di allarme, le entità in MCP, le automazioni e il flusso in tempo reale, e le schermate ci sono tutti. Vedi la [roadmap di HotLoop](/it/roadmap/). Il `forSec` di un trigger di stato ("acceso per cinque minuti") è in [Automazioni](/it/iot/automations/#mantenere-uno-stato-forsec).
