---
title: "Rilevamento MQTT"
description: "Puntate ESPHome, Zigbee2MQTT, Tasmota o uno Shelly al broker e compare da solo, in sola lettura finché un admin lo accetta e arma ogni punto."
---

Puntate un dispositivo al broker di HotLoop e compare. I suoi sensori leggono, i suoi interruttori mostrano il loro stato, le sue entità hanno i nomi, le unità e le classi che ha annunciato. Nessuno digita un elenco di tag.

E non può comandare nulla. Ogni punto che il rilevamento crea è in sola lettura, e resta tale finché un admin accetta il dispositivo e poi arma ogni punto a mano, guardando l'esatto topic a cui andrà il comando. Un dispositivo che si annuncia è un dispositivo che vi dice cos'è. È utile. Non è un dispositivo che si guadagna il diritto di azionare un relè del vostro impianto, e HotLoop non finge che lo sia.

## Chi lo parla

Il formato è quello dei topic come `homeassistant/sensor/kitchen/power/config`. Porta il nome del progetto che lo ha definito; HotLoop lo parla perché lo fanno i publisher, e questo è tutto il rapporto.

| Publisher | Come arriva qui | Contro cosa lo testiamo |
|---|---|---|
| **ESPHome** (il suo componente `mqtt:`) | per componente, attivo per impostazione predefinita, retained | output registrato di nodi reali (vedi sotto) |
| **Zigbee2MQTT** | per componente, con template su quasi tutto | output registrato di installazioni reali |
| **Tasmota** | il suo formato, sotto | output registrato di nove dispositivi reali |
| **Shelly** (Gen2, Gen3, Gen4) | nessun annuncio; appreso dagli stati che pubblica, sotto | output registrato di quindici serie di messaggi reali e la documentazione del costruttore |
| Qualsiasi altro che pubblica il formato | lo stesso | le regole del formato stesso |

ESPHome è vincolato a registrazioni di nodi reali, come Zigbee2MQTT.

Le registrazioni sono messaggi che un'installazione reale ha pubblicato, catturati da chi la gestisce, con publisher, versione e dispositivo annotati e nulla cambiato tranne gli spazi del JSON.

## Tasmota

L'attuale Tasmota non pubblica il formato `homeassistant/`. La sua documentazione dice che è stato rimosso da ogni build. Ciò che pubblica, retained, è il suo:

- `tasmota/discovery/<MAC>/config`: il dispositivo (il suo topic, il suo schema di full topic, i suoi relè e luci, le sue parole di acceso e spento, le sue parole di last will);
- `tasmota/discovery/<MAC>/sensors`: ciò che i suoi sensori leggono in quel momento.

Entrambi sono scritti da `TasDiscovery` in `xdrv_12_discovery.ino` di Tasmota (letto su arendst/Tasmota `development` 5c295fb, 2026-10-12). HotLoop trasforma i due negli stessi componenti che crea ogni altro publisher, quindi tutto ciò che segue (la schermata Rilevati, l'accettazione, l'armamento, il cancello di scrittura, la lettura) è un solo percorso di codice. Il MAC è l'identità del dispositivo; un dispositivo che si annuncia anche nel formato `homeassistant/` (un vecchio firmware con SetOption19) è lo stesso dispositivo.

| Tasmota dice | HotLoop crea |
|---|---|
| un relè (`rl` 1) | un interruttore: legge `stat/<topic>/POWER` (`POWER1`, `POWER2` e così via quando ce n'è più d'uno), con le parole di acceso e spento del dispositivo; comanda `cmnd/<topic>/POWER[n]` con ON oppure OFF |
| una luce (`rl` 2) | una luce: acceso e spento allo stesso modo. Con un solo dimmer, il suo livello è la chiave `Dimmer` di `tele/<topic>/STATE`, da 0 a 100, e si imposta con `cmnd/<topic>/Dimmer` |
| ogni numero nel messaggio dei sensori | un sensore ciascuno, letto da `tele/<topic>/SENSOR` dal suo percorso (`ENERGY` `Power`, `SCD40` `CarbonDioxide`), con l'unità e la classe che Tasmota dà a quel nome. L'array di un contatore trifase è un sensore per fase |
| il suo last will | disponibilità: `tele/<topic>/LWT`, con le parole Online e Offline del dispositivo |

I topic sono costruiti come li costruisce Tasmota: il suo full topic con `%prefix%` e `%topic%` compilati, così un dispositivo il cui proprietario ha cambiato il full topic (`tasmota/35D7A0/%prefix%/`, oppure `bi/test/%topic%/%prefix%`) legge e comanda sui topic che usa davvero.

Ciò che non legge, lo dice, nei problemi della sorgente e mai col silenzio: tapparelle, un ingresso interruttore, un pulsante, un iFan, una telecamera, i colori di una luce colorata e la luminosità di un dispositivo con più di una luce. Nelle registrazioni nulla mostra che uno di questi funzioni, quindi qui non si dichiara di leggerli.

**Chiedere.** Tasmota segnala un relè quando cambia e tutto ogni cinque minuti. Quindi quando un dispositivo inizia a essere letto, HotLoop invia un messaggio vuoto a `cmnd/<topic>/POWER`, a cui Tasmota risponde con lo stato di ogni relè senza muovere nulla; senza di esso un dispositivo che non è cambiato legge sconosciuto fino a cinque minuti dopo l'avvio di HotLoop. Il messaggio è vuoto, verso un topic che termina con `POWER` e nient'altro, e una sorgente in sola ascolto non invia nulla.

**La luminosità di una luce** arriva con la telemetria di Tasmota (ogni cinque minuti salvo che il `TelePeriod` del dispositivo sia più breve), non nel momento in cui cambia. Acceso e spento arrivano subito.

**Su ogni broker** il formato è un interruttore (`tasmota` sul broker, in Impostazioni, MQTT). Un broker aggiunto ora lo ha attivo; il broker integrato lo ha sempre; un broker già esistente continua ad ascoltare esattamente come prima, quindi è disattivato finché qualcuno lo attiva. Disattivato significa che HotLoop non si iscrive nemmeno a `tasmota/discovery/#` lì.

Una configurazione non è attendibile, come ogni altra. Una pubblicata con un MAC che non è quello che dichiara, un full topic senza `%topic%` o con un carattere jolly, un topic con una barra, una parola di acceso con un apice, una versione che non conosce: ognuna viene rifiutata con il motivo e non viene creato nulla. Il nome di un sensore con un apice non raggiunge mai un template.

**Contro cosa è stato testato.** I messaggi reali di nove dispositivi, catturati dalla console stessa di Tasmota:

| Registrazione | Dispositivo | Fonte |
|---|---|---|
| esp32-8relay-13.4.0 | scheda ESP32, 8 relè, Tasmota 13.4.0 | github.com/arendst/Tasmota/issues/20953 |
| esp32-zigbee-gateway-reboots-15.3.0.1 | ESP32 senza relè, tre avvii | github.com/arendst/Tasmota/issues/24487 |
| esp8266-sps30-scd40-airsensor-14.1.0 | sensore di CO2 e particolato, 14.1.0 | github.com/arendst/Tasmota/issues/24780 |
| esp8266-sps30-scd40-airsensor-15.4.0-invalid-json | la stessa scatola con 15.4.0, il cui firmware pubblicava JSON con una virgola finale | la stessa segnalazione |
| nous-a1t-energy-plug-14.5.0 | presa NOUS A1T con misura dell'energia | github.com/arendst/Tasmota/issues/23094 |
| olimex-esp32-poe-counter-custom-fulltopic-14.5.0 | contatori e un contatore trifase, full topic modificato | github.com/arendst/Tasmota/issues/23775 |
| shelly-dimmer2-15.3.0.3 | Shelly Dimmer 2 con Tasmota | github.com/arendst/Tasmota/issues/24560 |
| tuyamcu-energy-meter-custom-fulltopic-14.5.0 | contatore di energia TuyaMCU, full topic modificato | github.com/arendst/Tasmota/issues/23165 |
| wemos-2relay-15.1.0.1 | due relè, dal log della console dell'autore stesso di Tasmota | github.com/arendst/Tasmota/issues/24006 |

Sono registrazioni, non un dispositivo sul banco. Ciò che le registrazioni non hanno è la luminosità (la riga `tele/STATE` del dimmer era illeggibile nel suo log di origine; la sua chiave `Dimmer` è nello `STATUS11` della stessa registrazione, che Tasmota costruisce con la stessa funzione) e la richiesta di potenza con la sua risposta (le registrazioni mostrano la domanda e la risposta, dalla console di Tasmota, non HotLoop che chiede).

## Shelly

Uno Shelly Gen2, Gen3 o Gen4 non annuncia nulla. Non c'è nessun topic di configurazione da attendere. Quello che fa, una volta attivato MQTT e attive le sue notifiche di stato, è pubblicare lo stato completo di ogni componente su `<prefix>/status/<component>` (`switch:0`, `cover:0`, `light:0`, `input:0`, un `boolean:200` virtuale) a ogni cambiamento, e il suo last will su `<prefix>/online`. Quindi HotLoop conosce il dispositivo da ciò che dice: i componenti che ha pubblicato, i campi che ciascuno ha portato e il MAC dal suo stato `sys`. Il prefisso è per impostazione predefinita l'id del dispositivo (`shellyplus2pm-485519968144`), che è il suo modello e il suo MAC, quindi un dispositivo con il prefisso predefinito non aspetta nemmeno `sys`. Uno con un prefisso digitato da qualcuno (`ShellyLichtGarten`) deve pubblicare `sys` prima di poter essere distinto da un altro, e finché non lo fa viene nominato nei problemi della sorgente e non viene creato.

Ciò che è stato appreso viene conservato, per prefisso, e può solo crescere. Un componente che tace non è stato rimosso, e uno stato con meno contenuto del precedente non toglie nulla, quindi un riavvio non fa perdere pezzi a un dispositivo. Tutto il resto è lo stesso percorso di ogni altro publisher: la schermata Rilevati, l'accettazione, l'armamento di ogni punto, il cancello di scrittura, la lettura.

| Shelly dice | HotLoop crea |
|---|---|
| `switch:n` con un `output` | un interruttore: legge `output` da `<prefix>/status/switch:n`; comanda `<prefix>/command/switch:n` con `on` oppure `off` |
| `light:n` | una luce allo stesso modo, con `set,true` e `set,false`; con `brightness` nel suo stato, un livello da 0 a 100, inviato come `set,true,<level>` |
| `cover:n` | una tapparella: legge `state` (open, closed, opening, closing, stopped) e invia `open`, `close` e `stop`. Una tapparella che dice `pos_control` è calibrata, quindi legge anche `current_pos` e riceve `pos,<n>`; una che non lo è apre e chiude soltanto |
| `apower`, `voltage`, `current`, `freq`, `pf`, `aenergy.total`, `temperature.tC` su un switch, light o cover | un sensore ciascuno, in W, V, A, Hz, Wh e gradi C, con la classe che la documentazione di Shelly dà loro |
| `input:n` | un sensore binario del suo `state` |
| `devicepower:n`, `voltmeter:n`, `illuminance:n`, `presencezone:n` | sensori e sensori binari di batteria, alimentazione esterna, tensione, livello di luce, presenza e numero di oggetti |
| `boolean:n`, `number:n`, `enum:n` (componenti virtuali) | sensori in sola lettura. Impostare un componente virtuale è una chiamata RPC, che questo non fa, e ciascuno è indicato nei problemi della sorgente |
| il suo last will `online` | disponibilità, con i `true` e `false` propri di Shelly |

I comandi sono quelli che la pagina MQTT del costruttore elenca sotto MQTT Control, e i test vincolano HotLoop a quell'elenco: `on`, `off` e `toggle` per un interruttore; `set,<bool>,<brightness>` per una luce; `open`, `close`, `stop` e `pos,<n>` per una tapparella. Ognuno è una scrittura attraverso il cancello, armata da una persona.

**Chiedere.** Uno Shelly pubblica un componente quando cambia, quindi un dispositivo che non è cambiato leggerebbe sconosciuto finché non cambia. Quando un dispositivo inizia a essere letto, HotLoop invia `status_update` a `<prefix>/command`, che secondo la stessa pagina fa pubblicare al dispositivo lo stato dei suoi componenti e non muove nulla. È quella sola parola, verso un topic che termina con `/command` e nient'altro, e una sorgente in sola ascolto non invia nulla. Accade ogni volta che la lettura del dispositivo inizia, quindi armare più punti di fila chiede più volte.

**Cosa deve avere attivo il dispositivo.** MQTT abilitato, con l'indirizzo del broker; notifiche di stato attive (`status_ntf`); e, per i comandi, il controllo attivo (`enable_control`). Il broker di HotLoop ha un profilo di accesso `shelly`, che prende il nome dal prefisso del dispositivo, e gli permette di pubblicare i suoi stati e di sentire `<prefix>/command` e nient'altro.

**Ciò che non legge.** Detto, nei problemi della sorgente, mai col silenzio: un componente di un tipo che non gli è stato mostrato (`lora:100` su un Gen4 con il modulo LoRa, un `pm1`, un `em`), uno switch o un cover che ha omesso il campo da cui si legge, e l'impostazione di un componente virtuale. Gli eventi di ingresso (una doppia pressione, una pressione lunga) arrivano sul topic di notifica RPC, `<prefix>/events/rpc`, e non sono letti; si legge solo lo `state` di un ingresso. Un prefisso con più di due livelli (`home/garage/boiler`) non viene sentito; uno o due sì. Non si invia nulla via RPC.

**Su ogni broker** è un interruttore (`shelly` sul broker, in Impostazioni, MQTT). Un broker aggiunto ora lo ha attivo; il broker integrato lo ha sempre; un broker già esistente continua ad ascoltare esattamente come prima, quindi è disattivato finché qualcuno lo attiva. È un interruttore perché i topic su cui ascolta, `+/status/+`, sono ampi, e un broker che trasporta qualcos'altro sotto `*/status/*` lo vuole disattivato. Disattivato significa che HotLoop non vi si iscrive.

Non è attendibile, come ogni altro topic. Vengono ignorati un prefisso che non sia lettere, cifre e `_.-`, un componente che non sia `kind:number`, un payload che non sia un oggetto o superi 64 KiB, un dispositivo che dichiari più di 64 componenti e più di 512 dispositivi appresi contemporaneamente, e una struttura conservata sotto un prefisso che dichiara di essere un altro viene rifiutata.

**Contro cosa è stato testato.** Quindici serie di messaggi reali e la documentazione stessa del costruttore.

| Registrazione | Dispositivo | Fonte |
|---|---|---|
| plus-1-fw1.4.2-switch-rpc | Plus 1, firmware 1.4.2 | github.com/iobroker-community-adapters/ioBroker.shelly/issues/1055 |
| plus-2pm-cover-mode | Plus 2PM come tapparella, calibrata | lo stesso repository, issues/1088 |
| 1pm-mini-gen3-fw2.0.0-switch | 1PM Mini Gen3, 2.0.0 | lo stesso, issues/1592 |
| 2pm-gen3-fw2.0.1-beta3-switch | 2PM Gen3, 2.0.1-beta3, due canali | lo stesso, issues/1627 |
| 2pm-gen4-lora-addon | 2PM Gen4 con il modulo LoRa | lo stesso, issues/1349 |
| plug-s-gen3-fw2.0.1-beta1-switch | Plug S Gen3 | lo stesso, issues/1594 |
| pro4pm-gen2-fw2.0.1-switch-set | Pro 4PM, 2.0.1, con il MAC dell'autore oscurato | lo stesso, issues/1640 |
| pro-dimmer-2pm-fw1.3.0-light | Pro Dimmer 2PM | lo stesso, issues/974 |
| dimmer-gen3-light-sys | Dimmer Gen3 | github.com/enesbcs/shellyteacher4domo/issues/65 |
| pill-gen3-fw1.8.99 | Pill, 1.8.99, con un voltmetro | il repository ioBroker, issues/1232 |
| presence-gen4-fw2.1.99-dev | Presence Gen4, tre zone | lo stesso, issues/1228 |
| frankever-sprinkler-virtual-components | un controller di irrigazione con un prefisso proprio, componenti virtuali | lo stesso, issues/1207 |
| official-docs-component-status | gli esempi di componenti del costruttore: Plus 1PM, Plus 2PM, H&T, Pro 1, WDUS | shelly-api-docs.shelly.cloud |
| official-docs-mqtt-control | i comandi MQTT Control del costruttore | lo stesso |
| official-docs-mqtt-page, official-docs-notifications | la pagina MQTT del costruttore e i suoi esempi di notifica | lo stesso |

Due di questi non possono diventare un dispositivo, e i test lo dicono: il prefisso del Pro 4PM contiene l'oscuramento dell'autore (`xxxx`) e nessun `sys`, e quello della luce del giardino è un prefisso proprio che non ne ha nemmeno. Entrambi aspettano il loro MAC, come farebbe uno reale.

**Questo è verificato su registrazioni e sulla documentazione, e non su uno Shelly sul banco.** Qui non ce n'è ancora nessuno. Gli stati sono ciò che dispositivi reali hanno pubblicato, i topic che HotLoop legge sono topic che quei dispositivi hanno usato, e i comandi hanno le forme che il costruttore documenta. Ciò che le registrazioni non possono mostrare: un comando che muove davvero un relè, una tapparella che raggiunge davvero una posizione, e la risposta a `status_update`. Quando uno Shelly sarà sul banco, queste sono le tre cose da provare per prime.

## Cosa succede quando qualcosa si annuncia

1. **Compare.** Sul broker integrato, un dispositivo che si annuncia è subito un dispositivo HotLoop: protocollo `mqtt`, non collocato nell'albero, con il nome che si è dato (`kitchen-plug`, poi `-2` in caso di collisione), in lettura. I suoi tag prendono il nome di ciò che ha annunciato (`power`, `relay`). Le sue entità ricevono il nome, la classe di dispositivo, la classe di stato, l'unità, la categoria e l'icona che la configurazione ha dato loro, e un'entità che la configurazione dichiara disattivata per impostazione predefinita parte disabilitata.
2. **Nulla è armato.** Ogni tag viene creato in sola lettura. Un interruttore, un numero o un testo riceve subito la sua entità di controllo, non armata (`armed: false`), così una schermata o un'automazione può nominare `switch.kitchen_plug_relay` dal primo giorno. Comincia a funzionare nel momento in cui una persona arma il punto, e non prima.
3. **Decide un admin.** Dispositivi, Rilevati. Chi l'ha annunciato (sul broker integrato, l'accesso e l'id client che hanno pubblicato la sua configurazione), ogni componente che creerebbe, ogni topic che legge, ogni topic di comando per intero, e cosa guardare:

   - un topic di comando al di fuori dei topic che il componente legge (una "lampada" i cui comandi vanno a `cmnd/boiler/POWER`);
   - un topic di comando all'interno del prefisso di rilevamento, o uno che anche un altro dispositivo rivendica;
   - una configurazione che chiede comandi retained, perché un comando retained si ripete a ogni riconnessione del dispositivo;
   - template che HotLoop non sa valutare, e chiavi di configurazione che il formato non definisce.

   **Accetta** lo mantiene in lettura e rende i suoi punti armabili, uno alla volta, nell'editor dei tag. Non arma nulla. Se il dispositivo ha suggerito un'area e un nodo dell'albero ha esattamente quel nome, la finestra di accettazione la precompila. Un publisher non può archiviarsi da solo sotto Locale caldaie; una persona fa clic su accetta. **Ignora** scarta il dispositivo, i tag e le entità (lo storico resta, come per qualunque dispositivo) e lo tiene scartato quando si annuncia di nuovo. Eliminare un dispositivo rilevato equivale a ignorarlo, perché uno che continua ad annunciarsi tornerebbe subito.

## Quando cambia idea

**Un accesso diverso viene trattenuto per revisione, qualunque cosa dica.** Sul broker integrato, un dispositivo ricorda l'accesso da cui è stato accettato. Lo stesso dispositivo annunciato da un altro accesso viene trattenuto per revisione con i due accessi affiancati, anche quando la configurazione è identica parola per parola, e il log riceve un avviso. O qualcuno ha spostato il dispositivo su un nuovo accesso, o un accesso annuncia un dispositivo che non è suo. Applica, e il nuovo accesso è quello da cui è accettato. Rifiuta, e quell'accesso che annuncia la stessa cosa resta rifiutato.

**Una configurazione che cambia sotto un dispositivo accettato viene trattenuta per revisione.** La configurazione accettata continua a funzionare. La schermata Rilevati mostra il cambiamento campo per campo, in esecuzione contro annunciato, e un admin lo applica o lo rifiuta. Un'unità che passa da °C a °F, o un topic di stato puntato altrove, è esattamente il modo in cui un numero sbagliato si guadagna una faccia affidabile. Applicare un cambiamento non cambia mai se un punto è armato: quella è stata la decisione di una persona e resta tale.

Un aggiornamento del firmware, un nuovo nome del dispositivo, un nuovo modello o un'icona diversa si applicano da soli. Nessuno dovrebbe dover fare clic per un cambio di versione.

Prima che qualcuno accetti un dispositivo, l'annuncio più recente si applica sempre: nessuno ci ha ancora costruito sopra.

**Una configurazione vuota ritira un componente.** I suoi punti leggono male, dicendo "ritirato dal publisher alle 14:02", e nulla viene eliminato. Un allarme su quel punto mantiene il suo obiettivo e dice perché è cattivo. Se lo stesso componente ritorna, viene ripristinato, e finché non invia un nuovo valore legge "annunciato di nuovo dopo un ritiro; in attesa del suo prossimo valore" invece di spacciare il valore di prima che se ne andasse. Un dispositivo che nessuno ha accettato e che ritira tutti i suoi componenti sparisce, perché nessuno ci ha costruito sopra.

**Zigbee2MQTT che rinomina un dispositivo** cancella i suoi vecchi topic di configurazione e ne annuncia di nuovi con gli stessi ID univoci. HotLoop identifica i componenti dall'ID univoco, quindi è un ritiro e un ripristino a un secondo di distanza, e nulla va perso.

## Lettura

Uno stato passa per il template di valore del componente, se ne ha uno, e poi per la corrispondenza propria del componente: `payload_on`/`payload_off` per un sensore binario (`ON`/`OFF` per impostazione predefinita), `state_on`/`state_off` per un interruttore, un numero per un numero, una delle opzioni per un select. **Tutto ciò che non combacia è una lettura errata con il motivo**, mostrato sulla tessera:

- `"CLOSE" is neither payload_on "CLOSED" nor payload_off "OPEN"`
- `value_json has no key 'temperature'`
- `"unavailable" is not a number`
- `the publisher sent no value` (ha inviato `None`, `null`, nulla, o `unknown`)
- `no update for 300 s (expire_after)`

Il primo è reale: Zigbee2MQTT 1.41.0 annuncia così il sensore finestra di un Avatto TRV07, e chi lo ha catturato ha aperto una segnalazione perché la finestra non compariva mai. HotLoop lo mostra come errato e dice perché invece di indovinare.

**La disponibilità** è il collegamento del dispositivo, non una lettura. Finché il dispositivo dice di essere offline sul suo topic di disponibilità, risulta disconnesso con le sue stesse parole ("the device says it is offline (plug/status = offline)") e le sue entità non sono disponibili. Finché non arriva il primo messaggio di disponibilità, un dispositivo con disponibilità configurata non è disponibile. È la regola del formato, ed è quella giusta. La sessione con il broker non viene interrotta per questo: è condivisa con ogni altro dispositivo su quel broker.

`expire_after` rende errato un valore dopo quel numero di secondi senza aggiornamento. `off_delay` spegne un sensore binario dopo quel numero di secondi, perché la configurazione dice che il dispositivo non invia mai lo spegnimento. Gli attributi JSON arrivano sull'entità, fino a 64 chiavi e 8 KiB, sotto quelli propri di HotLoop (`friendly_name`, `source`, `armed` e gli altri vincono sempre).

Un componente senza topic di stato legge male per sempre. HotLoop non assume mai uno stato da un comando.

## Comandi

Nulla viene comandato finché tre cose non sono vere, in quest'ordine:

1. **Una persona ha accettato il dispositivo.** Fino ad allora l'editor dei tag non arma alcun punto su di esso ("accept the device first"), e il cancello di scrittura rifiuta da solo i suoi comandi, quindi una riga modificata a mano o un vecchio backup con il punto armato non porta a nulla nemmeno così.
2. **Una persona ha armato il punto**, nell'editor dei tag, uno alla volta. Prima della casella, l'editor dice dove vanno i comandi e cosa inviano: "Commands go to `plug/relay/set`, sending ON or OFF."
3. **Il cancello di scrittura lascia passare il comando**, come ogni altra scrittura: scritture attivate, l'interruttore MCP per un agente, l'intervallo del tag, i controlli propri dell'entità, una sessione attiva. Sottoposto ad audit con il suo id di chiamata, rifiutato o no. La simulazione pone esattamente le stesse domande.

Ciò che esce è ciò che dice la configurazione: `payload_on` e `payload_off` per un interruttore, `payload_press` per un pulsante, l'opzione per un select, il valore per un numero o un testo (un numero intero come intero, `5` e non `5.0`), attraverso il template di comando della configurazione se ne ha uno. Un pulsante si preme una volta. Il suo "rilascio" sarebbe un secondo comando che il dispositivo non ha mai chiesto, quindi un pulsante rilevato è a colpo singolo.

Una luce riceve `payload_on`/`payload_off` (una luce con schema JSON, `{"state":"ON"}`), e una luminosità in percentuale scalata al proprio `brightness_scale` e arrotondata, sul suo topic di comando della luminosità (una luce con schema JSON, `{"state":"ON", "brightness":128}`). Una tapparella riceve `payload_open`, `payload_close` o `payload_stop`, e una posizione scalata dalla percentuale ai propri `position_closed`..`position_open` tramite `set_position_template`. Una valvola riceve i suoi payload di apertura e chiusura (una valvola che riporta una posizione, i suoi `position_open` e `position_closed`), una posizione sul suo topic di comando e `payload_stop` una volta: come un pulsante, lo stop di una valvola rilevata è a colpo singolo. Un payload che la configurazione disattiva con `null` (una tapparella senza stop) è un comando che il cancello rifiuta dicendo perché.

Il cancello rifiuta un comando, con il motivo, quando:

- nessuno ha accettato il dispositivo;
- il broker su cui si trova è in sola ascolto;
- il publisher ha ritirato il componente;
- il suo template di comando è fuori dal sottoinsieme ("command template not supported: filter `regex_replace` is not supported at column 12"). Non è mai "invia il valore grezzo";
- la sua configurazione non ha un topic di comando;
- la sua configurazione non ha un payload per ciò che è stato chiesto: uno stop su una tapparella la cui configurazione dice `payload_stop: null`, un'opzione che un select non ha, una luminosità oltre il 100%. Il payload viene generato nel controllo, quindi anche la simulazione dice di no.

**I comandi retained seguono la configurazione.** Se una configurazione chiede `retain: true`, HotLoop pubblica retained i comandi di quel componente, e lo dice ovunque una persona decide in merito: la schermata Rilevati lo segnala e l'editor dei tag lo dice con parole semplici. Capite cosa significa prima di armarne uno: il broker conserva l'ultimo comando e lo consegna al dispositivo a ogni riconnessione, alle tre di notte, senza la mano di nessuno su nulla. Il comando è comunque passato dal cancello ed è ancora nella traccia di audit con un nome accanto; semplicemente accade di nuovo.

Non esiste da nessuna parte un "pubblica questo su quel topic": non nelle automazioni, non negli script, non in MCP. Sarebbe una porta laterale intorno al cancello con un nome più carino. Nel codice, due cose nel rilevamento pubblicano: la scrittura del driver, che solo il cancello raggiunge, e la nascita. Un test di guardia controlla i tipi del pacchetto del driver e fa fallire la build se qualsiasi altra cosa chiama l'una o l'altra, con un bypass piantato per dimostrare che morde.

## Template

Niente Python, niente motore Jinja. Niente cicli, quindi un template costa quanto costa la sua lunghezza.

`{% set name = value %}` c'è, e solo in quella forma: Zigbee2MQTT scrive la modalità di ogni termostato come `{% set values = {'manual':'heat', ...} %}` e poi la consulta, e un termostato la cui modalità non si può leggere è un termostato di cui non ci si può fidare. Niente namespace, niente spacchettamento, niente forma a blocco. C'è anche `.keys()`, solo come lato destro di `in`, perché è l'unico posto in cui quei template lo usano.

| <span class="sr-only">Dettagli</span> | <span class="sr-only">Dettagli</span> |
|---|---|
| Struttura | testo, `{{ expr }}`, `{% if %}` / `{% elif %}` / `{% else %}`, `{% set name = value %}`, `{# comments #}`, controllo degli spazi con `-` |
| Variabili | template di valore: `value`, `value_json` (solo quando il payload è JSON), `entity_id`, `name`; template di comando: `value`, `entity_id`, `name` |
| Espressioni | letterali, `.attr`, `['key']`, `[0]`, slice, `+ - * / // % **`, `~`, confronti, `and or not`, `in`, `x if c else y`, `.get(key, default)` su una mappa, `in mapping.keys()` |
| Test | `defined`, `undefined`, `none`, `number`, `integer`, `float`, `boolean`, `string`, `mapping`, `sequence`, `true`, `false`, `eq`, `ne`, `lt`, `le`, `gt`, `ge`, `in`, `odd`, `even`, `divisibleby` |
| Filtri | `float`, `int`, `round`, `bool`, `default`/`d`, `string`, `lower`, `upper`, `capitalize`, `title`, `trim`, `replace`, `truncate`, `abs`, `length`/`count`, `min`, `max`, `tojson`, `to_json`, `from_json`, `is_defined`, `iif` |
| Funzioni | `float()`, `int()`, `bool()`, `iif()`, `min()`, `max()` |

Dove il formato documenta un filtro in modo diverso dal Jinja standard, HotLoop segue il formato. Quello che conta: **`float` e `int` senza valore predefinito falliscono** su qualcosa che non è un numero. Il Jinja standard restituisce in silenzio `0`, ed è lo zero che dice che il serbatoio è vuoto quando il sensore ha smesso di rispondere.

I valori vengono resi come li rende lo `str()` di Python, perché è contro quello che sono state scritte le configurazioni di ogni publisher: `True`, `None`, `21.0` resta `21.0`. Non è estetica. Il sensore di contatto di Zigbee2MQTT annuncia `payload_on: false` e corrisponde al `False` reso.

**Una chiave mancante è un errore a meno che sia stata gestita.** `{{ value_json.temperature }}` su un payload che non la ha è una lettura errata che lo dice, non una stringa vuota. `default`, `is defined` e un semplice `{% if value_json.x %}` la gestiscono apposta, e vanno bene.

**Fuori dal sottoinsieme, rifiutato quando arriva la configurazione**, con il punto: "value template not supported: filter `regex_findall_index` is not supported at column 12". Il componente viene comunque creato, così si vede che esiste, e legge male con quel motivo. Non c'è un rendering parziale al meglio né un "usa il payload grezzo". Due template reali sono rifiutati apposta: `now()` (un valore che dipende da quando HotLoop lo ha valutato non è una lettura del dispositivo), e un template di evento di Zigbee2MQTT che costruisce pattern regex con namespace e `regex_findall`.

Limiti: 4 KiB di template, annidamento di 32 livelli, 64 KiB di output, interi a 64 bit (un overflow è un errore, non un wrap).

I filtri propri del formato, che non sono Jinja standard, hanno casi scritti a mano che citano il comportamento documentato a cui ciascuno ci vincola. Ogni template nelle registrazioni deve essere analizzato.

## Cosa costruisce HotLoop da cosa

| Componente | Tag | Entità |
|---|---|---|
| `sensor` | `float` quando ha un'unità, una classe di stato o una classe di dispositivo numerica, altrimenti `string` | sensor |
| `binary_sensor` | `bool` | binary_sensor |
| `switch` | `bool` | binary_sensor, e un'entità di controllo switch, non armata |
| `number` | `float`, con `min`/`max` della configurazione come intervallo del tag | sensor, e un'entità di controllo number, non armata, con minimo, massimo e passo |
| `text` | `string` | sensor, e un'entità di controllo text, non armata |
| `select` | `string`, che legge solo una delle sue opzioni | sensor, e un select con le opzioni della configurazione, non armato |
| `button` | `string`, che accetta una pressione e non legge nulla | un pulsante a colpo singolo, non armato (l'entità di lettura del tag stesso viene creata nascosta) |
| `light` | `bool` acceso/spento; `float` luminosità da 0 a 100 % quando ne ha una | una luce, non armata |
| `cover` | `string` di stato, che accetta anche `open`, `close` e `stop`; `float` posizione da 0 a 100 % quando ne ha una | una tapparella, non armata |
| `valve` | `string` di stato; `float` posizione da 0 a 100 % se ne riporta una; `bool` di comando (apri o chiudi) e `bool` di stop, comandati e mai letti | una valvola, non armata, con lo stop a colpo singolo |
| `event` | `string`, il tipo di evento | un evento |
| `device_automation` (un trigger) | `string`, `<type>_<subtype>` quando arriva il suo payload | un evento, uno per trigger |
| `lock` | `string`, letto con le sue parole e che accetta `lock`, `unlock`, `open` | una serratura, non armata |
| `fan` | `bool` acceso/spento; `float` velocità da 0 a 100 %; `string` preset e direzione; `bool` oscillazione, ciascuno quando ne ha uno | una ventola, non armata |
| `siren` | `bool` | una sirena, non armata |
| `scene` | `bool`, una pressione | un pulsante a colpo singolo, non armato |
| `notify` | `string`, un messaggio, comandato e mai letto | un notificatore, non armato |
| `update` | `string` delle versioni installata e più recente | un aggiornamento: attivo quando differiscono. Il suo comando di installazione non viene mai inviato |
| `device_tracker` | `string`, `home`, `not_home` o una zona | un tracker |
| `tag` | `string`, l'id del tag quando ne viene scansionato uno | un evento |
| `climate` | `string` di modalità; `float` di setpoint, setpoint basso e alto e setpoint di umidità, ciascuno con `min_temp`/`max_temp` della configurazione (o `min_humidity`/`max_humidity`) come intervallo; `float` di temperatura e umidità ambiente; `string` di modalità ventola, oscillazione e preset e di azione; `bool` di alimentazione, comandato e mai letto; ciascuno quando ne ha uno | un termostato, non armato |
| `humidifier` | `bool` acceso/spento; `float` setpoint di umidità nel suo intervallo; `string` di modalità e azione; `float` di umidità ambiente | un umidificatore, non armato |
| `water_heater` | `string` di modalità; `float` setpoint nel suo intervallo e temperatura attuale; `bool` di alimentazione, comandato e mai letto | uno scaldacqua, non armato |
| `alarm_control_panel` | `string` di stato, letto con le parole del formato e che accetta le azioni elencate in `supported_features`, ciascuna col proprio payload | un pannello di allarme, non armato |
| `vacuum` | `string` di stato, che accetta le azioni elencate in `supported_features`; `float` di batteria; `string` di velocità della ventola, ciascuno dal suo stato JSON | un aspirapolvere, non armato |
| `lawn_mower` | `string` di attività; `bool` di avvio del taglio, pausa e ritorno alla base, ciascuno una pressione sul proprio topic, comandato e mai letto | un tagliaerba, non armato |
| `camera` | `string`, un hash breve dell'ultima immagine; l'immagine stessa è tenuta in memoria | una telecamera |
| `image` | lo stesso, per un'immagine su `image_topic`; oppure `string`, l'URL da `url_topic` | un'immagine |

Per una luce, una tapparella, una valvola, un evento, un trigger e ogni componente nelle righe successive, le entità di lettura proprie dei tag vengono create nascoste: la cosa è una sola entità nelle schermate. Ogni tag viene comunque armato per conto suo, quindi una tapparella della cui posizione vi fidate e della cui apertura e chiusura no può essere esattamente quello. Una cosa che acquisisce un valore dopo l'accettazione (un firmware che inizia a riportare una luminosità) è un cambiamento da rivedere, e quando una persona lo applica l'entità riceve il ruolo insieme al tag.

I messaggi di stato di una luce con schema JSON vengono uniti, perché lo schema invia ciò che è cambiato: un messaggio con solo una luminosità, o il solo `last_seen` di Zigbee2MQTT, lascia la luce accesa. Il suo colore, la temperatura di colore e l'effetto sono mostrati come attributi, non comandati; acceso, spento e luminosità lo sono, e la schermata Rilevati lo dice per una luce che ha il colore. I topic di colore di una luce con schema predefinito sono uguali: non letti, non comandati, ed elencati. Lo schema template non è supportato e lo dice. L'inclinazione di una tapparella non è letta né comandata, e lo dice.

Un trigger di dispositivo scatta solo sul proprio `payload`: Zigbee2MQTT mette ogni azione di un pulsante su un solo topic, e ogni trigger ne è una. Un trigger senza `payload` scatta su qualsiasi cosa sul suo topic.

La velocità di una ventola si legge sul `speed_range_min`..`speed_range_max` proprio della configurazione come fa il formato: il primo gradino sopra lo spento è il primo percento. Un livello che la configurazione dice impossibile (una ventola ESPHome che annuncia quattro gradini e riporta 25) è una lettura errata che lo dice, non 625 percento.

La schermata Rilevati elenca ogni topic a cui possono andare i comandi di un componente: il topic della luminosità di una luce, quello della velocità di una ventola, oltre a quello principale, e segnala ognuno che è fuori da ciò che il componente legge, dentro il prefisso, o rivendicato da un altro dispositivo.

L'intervallo del setpoint di un termostato o di uno scaldacqua è quello della configurazione, e quello predefinito del formato quando non ne dà (da 7 a 35 °C per un termostato, da 43,3 a 60 °C per uno scaldacqua, in °F quando la configurazione dice `temperature_unit: F`). È l'intervallo del tag, quindi il cancello rifiuta 31 °C a una valvola di radiatore che arriva al massimo a 30 prima che venga inviato qualcosa. Le sue modalità sono l'elenco della configurazione, e una modalità che non elenca viene rifiutata allo stesso modo. Le schermate offrono esattamente quelle, e quando un cambiamento applicato porta una nuova modalità, anche le schermate la ricevono.

Il `code` di un pannello di allarme è ciò che la schermata di un consumatore chiede prima di inviare qualcosa. In HotLoop, chi può armare o disarmare è decisione del cancello, con il tag armato da una persona e ogni comando sottoposto ad audit, quindi l'azione esce come dice la configurazione. Un pannello il cui template di comando vuole il codice stesso (`{{ code }}`) non può essere comandato: HotLoop non ha un codice da metterci, e la schermata Rilevati lo dice. Il `send_command_topic` di un aspirapolvere non viene usato: un comando arbitrario è esattamente ciò che HotLoop non può verificare rispetto alla configurazione.

L'immagine di una camera o di un image è tenuta in memoria, l'ultima per componente, fino a 4 MiB, e servita da `GET /api/entities/{entity_id}/image`. HotLoop la conserva solo se i byte sono un JPEG, PNG, GIF o WebP, qualunque cosa dichiari il `content_type` della configurazione: un SVG è un documento che esegue script, e un'"immagine" che esegue script su chiunque apra la dashboard è una falla. Il suo tag contiene un hash breve, così lo storico dice quando l'immagine è cambiata senza un database pieno di JPEG. Un'immagine annunciata tramite URL è un collegamento: HotLoop lo mostra, solo se è http o https, e non lo scarica mai, perché un server che scarica qualunque indirizzo un dispositivo nomini può essere puntato su qualunque cosa nella rete. Nessuna è registrata nel registro eventi; una camera cambia ogni secondo e tag_history ha già ogni cambiamento.

Ogni componente che il formato definisce diventa qualcosa. Un componente che non definisce (un `kettle`) viene memorizzato con ciò che ha annunciato ed elencato come uno che non crea nulla. Il formato non ha un componente data, ora o datetime, quindi nemmeno questo elenco.

Gli ID delle entità sono di HotLoop, costruiti dal dispositivo e dal tag. L'`object_id` e il `default_entity_id` di una configurazione sono ignorati: una configurazione non sceglie un nome nello spazio dei nomi di HotLoop, e una ostile sceglierebbe `switch.boiler_main`.

## Tutto non affidabile

Tutto ciò che dice una configurazione viene da chiunque possa pubblicare sul prefisso. Quindi:

- nomi e testi hanno un limite e vengono ripuliti dai caratteri di controllo, e la schermata li mette nella pagina come testo, mai HTML;
- un topic con un carattere jolly, un topic `$`, o una `~` senza una base dove metterla viene rifiutato con il motivo;
- una configurazione oltre 64 KiB viene rifiutata; un dispositivo non può avere più di 512 componenti; non più di 256 dispositivi possono attendere una decisione su un broker; i messaggi di configurazione oltre 200 al secondo vengono scartati e contati. Ogni rifiuto viene contato e mostrato nella schermata Rilevati, mai scartato senza una parola;
- HotLoop si iscrive a `<prefix>/+/+/config` e `<prefix>/+/+/+/config`, mai a `#` sotto il prefisso, così un topic profondo vagante non può fargli analizzare nulla;
- un payload di stato oltre 256 KiB, o che non è UTF-8, è una lettura errata.

Con le connessioni anonime consentite sul broker integrato, chiunque nella rete può annunciare dispositivi e pubblicare su qualunque topic di comando, e la schermata Rilevati lo dice in rosso. Date a ogni dispositivo il proprio accesso creato in HotLoop, dal suo profilo, con il nome del suo topic ([Il broker MQTT integrato](/it/iot/broker/)): così può annunciarsi e nient'altro, e non può toccare il topic di comando di un altro dispositivo.

## Il lato broker

Il rilevamento gira sul broker integrato (vedi [il broker MQTT integrato](/it/iot/broker/)), attivo per impostazione predefinita ogni volta che lo è il broker. Il client di HotLoop accede con un accesso creato a ogni avvio e tenuto solo in memoria: non c'è nulla da configurare e nulla in un backup che possa trapelare. Pubblica una sola cosa sua, la nascita (`<prefix>/status` = `online`), che fa annunciare di nuovo i publisher che la ascoltano.

| Variabile | Predefinito | <span class="sr-only">Dettagli</span> |
|---|---|---|
| `HOTLOOP_BROKER_DISCOVERY` | `true` | Ascolta gli annunci sul broker integrato |
| `HOTLOOP_BROKER_DISCOVERY_PREFIX` | `homeassistant` | Il prefisso di topic sotto cui arrivano |

Un client per broker, `hotloop-disc-embedded`, condiviso dal listener e dal driver di ogni dispositivo rilevato. Un helper `--mcp-stdio` non ne apre nessuno: un secondo client con lo stesso id scalzerebbe quello del Gateway dal broker ogni pochi secondi. Con più repliche su un solo database, ascolta solo quella che detiene il blocco di rilevamento.

## Altri broker

Molti impianti hanno già un broker: un Mosquitto che è la UNS, quello che una scatola Zigbee2MQTT si è portata dietro. HotLoop ascolta anche quelli. Impostazioni, MQTT, aggiungi un broker: un id (che dà il nome al broker in ogni dispositivo che ne proviene), dove si trova, un accesso e il prefisso sotto cui i suoi publisher annunciano. Il broker non deve essere attivo, e HotLoop non ha bisogno di quello integrato per farlo.

Tre cose sono diverse dal broker di HotLoop, apposta:

- **I dispositivi aspettano nella casella.** Su un broker d'impianto molto attivo, "compaiono da soli" significa trecento dispositivi a schermo prima di pranzo. Quindi un dispositivo annunciato viene elencato nella schermata Rilevati, senza creare nulla e senza leggere, finché qualcuno lo accetta. Poi viene creato, legge, e i suoi punti si possono armare come ogni altro. Un broker di cui vi fidate abbastanza da scaricarci tutto si può passare a "i dispositivi compaiono da soli".
- **Nessun last will.** HotLoop si connette senza. Un will `offline` su un broker condiviso direbbe a ogni altro publisher che qualcosa se n'è andato, quando era solo HotLoop. I test controllano il pacchetto CONNECT stesso, e staccano la connessione per dimostrare che non viene detto nulla.
- **Le sue ACL sono sue.** HotLoop non può vedere chi ha pubblicato cosa sul broker di qualcun altro, quindi lì non esiste "annunciato da accesso", e ciò che ogni accesso può toccare è affare di quel broker. Date a HotLoop un accesso che legga il prefisso e i topic dei dispositivi che accettate, e scriva la nascita e i topic di comando, nient'altro. Per Mosquitto:

  ```
  user hotloop
  topic read homeassistant/+/+/config
  topic read homeassistant/+/+/+/config
  topic write homeassistant/status
  # the devices you accept, for example a Zigbee2MQTT bridge:
  topic read zigbee2mqtt/#
  topic write zigbee2mqtt/+/set
  ```

**Sola ascolto** è per un broker su cui HotLoop non deve parlare: la UNS di produzione, l'impianto di qualcun altro. HotLoop non vi pubblica mai nulla. Nessuna nascita, nessun comando. È la regola della sessione, non della schermata: la sua pubblicazione rifiuta, e il cancello di scrittura rifiuta ogni comando ai suoi dispositivi con "the broker plant-uns is listen-only", simulazione compresa, anche su un dispositivo che qualcuno ha accettato e un punto che qualcuno ha armato. Il suo accesso non ha bisogno d'altro che di righe `topic read`.

La password è sigillata con la chiave delle credenziali dei dispositivi (`HOTLOOP_SECRET_KEY_FILE`), come quella di una console UniFi, e non esce mai dall'API. Senza chiave un broker con password viene rifiutato, non memorizzato in chiaro. Un backup la porta sigillata e si ripristina con la stessa regola delle credenziali di un dispositivo ([Backup e ripristino](/it/iot/backup/)). Un broker la cui password non si può aprire viene elencato, non connesso, e dice perché.

Modificate un broker e il listener e ogni dispositivo che ne proviene si riconnettono con le nuove impostazioni. Disattivatene uno e i suoi dispositivi restano, leggono male e dicono che il loro broker qui non è in esecuzione. Rimuoverne uno porta via la casella, ed è rifiutato, nominandoli, finché esistono dispositivi che qualcuno ha accettato da lì.

## Su un Edge Relay

Anche un Edge Relay rileva, con lo stesso codice, ma non ha un database in cui conservare una decisione né una schermata su cui prenderla. Quindi prende ciò che sente, lo legge e lo inoltra via Sparkplug, e nulla di ciò che trova può essere armato: i suoi tag sono in sola lettura come ogni tag rilevato, i suoi dispositivi non vengono mai accettati, e il relay non ha alcun percorso di scrittura. Indicate i broker nel suo file dei dispositivi; vedi il [riferimento dell'Edge Relay](/it/edge-relay/reference/#discovery-41810). Un dispositivo che si può comandare arriva dall'altro lato: accettato e armato su un Gateway, in un file che quello invia. Dimentica ciò che ha sentito quando si ferma, e lo risente dal broker.

## Riavvii e riproduzioni

I dispositivi accettati funzionano dalle loro righe di dispositivo. HotLoop non ha bisogno di un solo messaggio retained per ripartire con il suo impianto.

Il broker integrato non conserva nulla attraverso un riavvio, quindi ogni configurazione "manca" dopo. **Una configurazione mancante non è un ritiro**: lo è solo una vuota esplicita. Qualsiasi altra cosa ritirerebbe l'intero impianto a ogni riavvio della macchina. Finché un dispositivo non invia il suo prossimo stato, le sue entità leggono sconosciuto, mai il valore di prima del riavvio spacciato per attuale.

Un broker che riproduce centinaia di configurazioni retained in una volta è un solo lotto: due secondi di quiete, un passaggio, un ricaricamento. Una riproduzione di ciò che è già registrato non cambia nulla e non ricarica nulla.

## Backup

`mqtt_devices` (chi ha accettato e ignorato cosa), `mqtt_configs` (ogni configurazione com'è arrivata, byte per byte) e `mqtt_discovered` (ogni componente, normalizzato) sono in ogni backup. Le decisioni sono la parte che nessun dispositivo può annunciare di nuovo.

## L'API

Sotto `/api/discovery`. Vedi [l'API HTTP](/it/iot/api/#rilevamento-mqtt).

## Trovato sulla rete

La stessa schermata elenca i dispositivi che HotLoop ha sentito sulla rete dell'impianto tramite mDNS, SSDP e DHCP, decisi allo stesso modo. Vedi [Rilevamento di rete](/it/iot/network-discovery/).
