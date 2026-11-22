---
title: "Rete UniFi"
description: "Switch, porte, PoE, failover WAN e client di una console UniFi letti come normali tag, con schermate, eventi e comandi spenti finché non vengono armati."
---

La rete di uno stabilimento è un'apparecchiatura. Quando un PLC tace, la prima domanda è «è il PLC o la porta dello switch a cui è collegato», e finora la risposta stava nell'app UniFi sul telefono di qualcuno. Per questo HotLoop legge la console UniFi stessa: ogni switch, ogni porta, l'assorbimento PoE, i collegamenti WAN e lo stato del sito, come normali tag. Così allarmi, trend, entità, automazioni, OPC UA e MCP funzionano su di essi senza sapere che UniFi esiste.

Questo è il driver, la sorveglianza OT che poggia su di esso, le schermate, il flusso di eventi e i primi comandi (da U1 a U5 nella [roadmap](/it/roadmap/)). **Legge la rete, e la modifica solo quando una persona ha armato un tag per farlo.** Ogni tag è creato in sola lettura. I pochi punti che sono comandi (sotto, «Comandi») passano dal gate di scrittura come qualsiasi tag: nulla ne invia uno finché qualcuno non segna quel tag come scrivibile, e un account di console View Only viene rifiutato dalla console stessa. Per tutto tranne i comandi l'account usato può essere View Only.

## Aggiungere una console

Un dispositivo HotLoop è **un sito su una console**. Il Cloud Gateway e l'Express che ha dietro sono due console, quindi due dispositivi, con due accessi, perché ogni console ha i propri account locali.

1. **Creare un account locale sulla console.** Settings, Admins & Users, Add Admin, spuntare **Restrict to Local Access Only**, ruolo **View Only**. Un account cloud Ubiquiti non può accedere da nulla che non sia l'app: richiede MFA, e la console risponde 403 a uno script. Il nostro si chiama `hotloop-ro`.
2. **Aggiungere il dispositivo.** Protocollo `unifi`, indirizzo l'URL della console: `https://host` per una console con UniFi OS (Cloud Gateway, Dream Machine, UniFi OS Server), `https://host:8443` per la Network Application self-hosted. Un intervallo di polling di 15 s va bene; il driver non legge mai una console più di una volta ogni 10 s, qualunque sia il valore impostato.
3. **Salvare senza impronta.** La prima connessione fallisce, di proposito, con l'impronta del certificato presentato dalla console. Verificare che sia la vostra console (la console mostra il suo certificato, oppure `openssl s_client -connect host:443` passato in `openssl x509 -pubkey -noout | openssl pkey -pubin -outform der
   | sha256sum` dà lo stesso risultato), incollarla in `certFingerprint` e salvare.
4. I tag si creano da soli al polling successivo. Vedere sotto.

Un dispositivo UniFi si può salvare solo quando HotLoop ha una chiave con cui cifrare la password (`HOTLOOP_SECRET_KEY_FILE`, che il chart configura da solo). Vedere [Backup e ripristino](/it/iot/backup/#device-credentials-and-the-secret-key).

| Opzione | Predefinito | Cosa fa |
|---|---|---|
| `site` | `default` | Il nome breve del sito, quello degli URL della console. `default` è il primo sito di ogni console |
| `username`, `password` | obbligatori | L'account locale. La password è solo in scrittura tramite l'API e cifrata nel database |
| `certFingerprint` | nessuna | Lo SHA-256 della chiave pubblica del certificato della console, in esadecimale. Due punti, spazi e maiuscole vanno bene |
| `caFile` | nessuno | Si fida di una CA invece che di un pin, per console con certificati veri |
| `insecureSkipVerify` | `false` | Si fida di qualsiasi certificato. Per un banco di prova, mai per uno stabilimento |
| `clientTimeoutSec` | `90` | Quanto tempo dopo l'ultima volta in cui la console ha visto un client questo conta ancora come presente in rete. Minimo 30. Vedere [client](#client-reti-ot-e-dove-è-collegato-un-plc) |

### Perché il certificato è fissato

Le console arrivano con certificati autofirmati, e la risposta pigra è saltare la verifica. Va bene per leggere un contatore. Non va bene per un accesso che vede tutta la rete dello stabilimento e, dalle PR di scrittura in poi, riavvia le sue porte. Una console con pin che presenta un certificato diverso viene rifiutata durante l'handshake TLS, **prima che vengano inviati nome utente o password**, e l'errore riporta entrambe le impronte. Il pin è sulla chiave pubblica, quindi una console che riemette il certificato con la stessa chiave continua a funzionare.

Non esiste un «trust on first use» silenzioso. L'unico momento in cui fidarsi di un certificato ha un senso è quando una persona lo sta guardando, ed è allora che succede.

## Accessi: una volta, e non di più se non serve

Accedere a ogni controllo ha fatto rispondere 429 al nostro stesso Cloud Gateway, che ha bloccato l'account. Due volte. Quindi:

- **Una sessione per console e per processo.** Ogni polling, e ogni sito della console, viaggia sullo stesso accesso. Due dispositivi per due siti sulla stessa console con lo stesso account sono una sola sessione.
- **Rifà l'accesso solo quando la console dice che la sessione non c'è più** (401), un chiamante alla volta, e **mai più di una volta al minuto**, qualunque cosa accada. Una sessione che muore due volte nello stesso minuto lascia il dispositivo in lettura errata fino alla fine del minuto, ed è il compromesso che vogliamo.
- **Un accesso rifiutato non viene ritentato.** Una password sbagliata, un account cloud o un blocco 429 aspettano almeno cinque minuti, di più se lo dice il `Retry-After` della console, e l'errore del dispositivo dice quale caso era. Spegnere e riaccendere il dispositivo non compra un altro tentativo: il processo se lo ricorda.
- **Fa il logout** quando si ferma l'ultimo dispositivo che usa una console, così i riavvii non accumulano sessioni sulla console.
- **Un helper `--mcp-stdio` non accede mai.** Gira accanto al Gateway, che ha già la sessione, e un secondo accesso dalla stessa macchina è esattamente ciò che provoca il 429. I suoi dispositivi UniFi restano fermi lì mentre girano nel Gateway.

## Tag

Ogni tag è creato dal driver, in sola lettura finché una persona non lo arma, e prende il nome da indirizzi MAC e numeri di porta, mai da nomi visualizzati, quindi rinominare uno switch nell'app UniFi non rompe nulla. `<mac>` è il MAC del dispositivo in minuscolo senza separatori, `<nn>` il numero di porta a due cifre.

| Tag | Tipo | Cos'è |
|---|---|---|
| `d.<mac>.state` | testo | `connected`, `disconnected`, `pending`, `upgrading`, `provisioning`, `heartbeat_missed`, `adopting`, ... |
| `d.<mac>.online` | bool, connectivity | Collegato alla console |
| `d.<mac>.uptime_s` | int, s | Uptime |
| `d.<mac>.cpu_pct`, `.mem_pct` | float, % | CPU e memoria |
| `d.<mac>.temp_c` | float, °C | Temperatura, sui dispositivi che hanno un sensore |
| `d.<mac>.clients` | int | Client collegati tramite di esso |
| `d.<mac>.fw` | testo | Versione del firmware |
| `d.<mac>.wan<N>.up` | bool, connectivity | La WAN N è **viva** secondo i controlli di salute del gateway stesso (`last_wan_interfaces`, poi `last_wan_status`). Non l'`up` del blocco WAN, che significa configurata. Una console che non dà né l'uno né l'altro legge errato, mai attiva |
| `d.<mac>.wan<N>.latency_ms` | float, ms | La sua latenza, valida solo finché la WAN è viva |
| `d.<mac>.wan<N>.availability_pct` | float, % | Disponibilità secondo i monitor del gateway stesso sulla sua finestra (un giorno), quando ne fornisce una |
| `d.<mac>.wan.active` | testo | Quale WAN porta il traffico: quella dell'uplink se è viva, altrimenti la prima viva, `none` se nessuna lo è |
| `d.<mac>.wan.failover` | bool, problem | Il traffico passa da una WAN diversa dalla prima: lo stabilimento è sul backup |
| `p.<mac>.<nn>.up` | bool, connectivity | Collegamento della porta |
| `p.<mac>.<nn>.speed_mbps` | int, Mbit/s | Velocità del collegamento; 0, valido, su una porta senza collegamento |
| `p.<mac>.<nn>.rx_bps`, `.tx_bps` | float, bit/s | Traffico |
| `p.<mac>.<nn>.errors` | int | Errori in ricezione più in trasmissione |
| `p.<mac>.<nn>.poe_w` | float, W, power | Assorbimento PoE, sulle porte che possono erogare PoE |
| `p.<mac>.<nn>.poe_mode` | testo | `auto`, `off`, `pasv24`, `passthrough` |
| `site.<subsystem>.status` | testo | Lo stato del sito: `wan`, `www`, `lan`, `wlan`, `vpn` |
| `site.www.latency_ms` | float, ms | Latenza di internet, quando riportata |
| `site.network_version` | testo | La versione di Network che esegue la console |
| `site.events_live` | bool, connectivity | Il websocket degli eventi della console è connesso. 0 significa che HotLoop fa solo polling, il che costa velocità e nient'altro |
| `site.last_event` | testo | L'evento più recente che la console ha riportato sul sito, con le sue parole |
| `d.<mac>.last_event` | testo | L'evento più recente su quel dispositivo. Vuoto finché non ne ha avuto uno |

Le classi di dispositivo passano alle entità, quindi il collegamento di una porta esce come sensore binario di connettività e il suo assorbimento PoE come sensore di potenza senza che nessuno li imposti.

**I tag si aggiungono da soli e non spariscono mai da soli.** Uno switch adottato la settimana prossima compare come tag al polling successivo, sulla stessa sessione, senza riavviare nulla. Uno switch scollegato legge `online` 0 e le sue porte passano a qualità errata, così un allarme su di esso lo dice invece di sparire con lui. Cancellarne i tag è una decisione di una persona. Un tag che qualcuno ha spento resta spento: il driver non ha voce in capitolo.

Solo i dispositivi adottati ricevono tag. Uno switch collegato da qualcuno e adottato da nessuno non fa ancora parte della rete dello stabilimento. Un punto che la console non riporta legge errato, mai uno zero inventato: uno switch che non riporta assorbimento PoE ha i suoi tag `poe_w` in lettura errata.

Anche l'Edge Relay può fare polling di una console. Legge i tag che il suo file di dispositivo dichiara e non ne aggiunge, perché non ha dove tenerli.

## Comandi

Cinque tipi di punto sono comandi. Ognuno è creato in sola lettura come ogni altro tag, e non fa nulla finché qualcuno non lo segna come scrivibile. L'account con cui HotLoop accede deve essere Administrator locale per questi; con View Only la console risponde HTTP 403, HotLoop lo dice e nulla cambia.

| Tag | Scrittura | Cosa fa la console |
|---|---|---|
| `d.<mac>.locate` | `true` o `false` | Fa lampeggiare il LED del dispositivo finché non viene spento. Rilegge ciò che dice la console. |
| `d.<mac>.restart` | `true` | Riavvia il dispositivo alla sua prossima comunicazione. `false` non fa nulla. Legge 0. |
| `p.<mac>.<nn>.power_cycle` | `true` | Spegne e riaccende il PoE della porta. `false` non fa nulla. Legge 0. |
| `w.<id>.enabled` | `true` o `false` | Attiva o disattiva una rete wireless. Viene inviato solo quel campo, quindi la passphrase e ogni altra impostazione restano. `<id>` è l'id che la console dà alla rete, che una rinomina non cambia. |
| `c.<mac>.blocked` | `true` o `false` | Blocca un client sorvegliato dalla rete, o lo lascia rientrare. Il punto esiste per un client che la console ha visto. |

Un power cycle può danneggiare uno stabilimento (un'automazione che riavvia un PLC ogni due minuti ne brucia l'alimentatore), quindi valgono due regole chiunque lo chieda: una porta viene riavviata al massimo una volta ogni 15 minuti (l'ora dell'ultimo ciclo è conservata nel database, quindi un riavvio non la dimentica, e un ciclo la cui ora non si può verificare viene rifiutato), e una porta che porta la rete non viene mai riavviata. Quella è un uplink, e qualsiasi porta a cui è appeso un altro apparato, secondo la topologia della console stessa; la porta che alimenta un backup 5G è una di queste. Un rifiuto dice quale regola era. Un comando che la console stessa rifiuta non consuma il tempo di attesa.

## Client, reti OT e dove è collegato un PLC

Due compiti, entrambi in sola lettura.

**Dove è collegato.** Un PLC tace e la prima domanda è se sia il PLC o la porta dello switch. Collegate una volta il dispositivo HotLoop al suo client in rete, e il suo pannello dice «su USW Lite 8 PoE porta 5, collegamento giù» prima che qualcuno apra l'app UniFi. Il collegamento dà anche tag di client sul dispositivo della console, così lo stato della porta va in trend e in allarme accanto ai valori Modbus che si sono fermati.

**Cosa c'è sulla rete SCADA.** Segnate una rete come OT, accettate ciò che le appartiene, e qualsiasi altra cosa vi compaia genera un allarme che la nomina. Qualcuno collega un portatile allo switch SCADA alle 2 di notte, voi lo sapete alle 2 di notte.

### Nulla si identifica per IP

L'elenco dei client della console è in ritardo. Quindi:

- **Un client è il suo MAC.** Il collegamento propone un client per IP, perché è ciò che sapete del vostro PLC, ma una persona lo conferma una volta e da allora la chiave è il MAC. Il tag IP dice che è l'opinione della console.
- **Online non vuol dire «nell'elenco».** Un client è online quando la console lo ha visto entro `clientTimeoutSec` (90 s) **e**, per uno cablato, la porta del suo switch ha un collegamento. La porta è la metà veloce: si stacca il cavo e la porta legge giù alla lettura successiva, mentre l'elenco sta ancora recuperando.

### Collegare un dispositivo

Aprite il pannello di un dispositivo. Se una console UniFi letta da HotLoop elenca un client all'IP del dispositivo, la sezione Network lo propone; un amministratore fa clic su **Link**. Nessun IP da cui partire (un dispositivo indirizzato per nome): collegatelo per MAC. Oppure tramite l'API, `PUT /api/devices/{id}/network`, vedere [l'API HTTP](/it/iot/api/#put-apidevicesidnetwork).

Il client di un dispositivo collegato riceve dei tag e un allarme, **«PLC-07 off the network»**, priorità 1, con un ritardo di attivazione di 120 s così che un PLC che si riavvia non avvisi nessuno.

### Reti OT e l'elenco dei noti

Segnate una rete come OT (`PUT /api/unifi/{id}/networks/{network}` con `{"ot": true}`), poi accettate ciò che c'è: tutto com'è adesso in una sola chiamata (`POST .../accept-all`), oppure un dispositivo alla volta. Segnarla crea l'allarme **«Unknown device on SCADA»**, priorità 1, su `n.<network>.unknown`. L'ultimo estraneo è nominato in `n.<network>.unknown_last`, con il suo MAC, come si chiama, il suo IP e la porta dello switch o l'SSID da cui è entrato.

Un dispositivo noto può essere **sorvegliato** (`"watch": true`): riceve gli stessi tag e lo stesso allarme di uscita dalla rete di uno collegato. Un PLC è sorvegliato. Un portatile di manutenzione ammesso ma che va e viene è noto e non sorvegliato, altrimenti avvisa qualcuno ogni volta che se ne va.

Gli allarmi sono normali definizioni di allarme. Sospendetele, riconoscetele, inviatele a Discord, modificatene il ritardo. Togliete la sorveglianza, il collegamento o il segno OT e HotLoop toglie l'allarme che aveva creato per essi, così un tag che nessuno legge più non tiene aperto un allarme. Uno scritto a mano da un amministratore non viene mai toccato.

Il registro è di HotLoop, nel suo database (`unifi_networks`, `unifi_known`, `unifi_links`, tutti nei backup), mai della console. Una modifica raggiunge il driver in esecuzione alla sua lettura successiva, sulla sessione che ha già: non riavvia il dispositivo, perché un riavvio fa il logout e il budget di un accesso al minuto lo terrebbe fuori per un minuto.

### I tag

| Tag | Tipo | Cos'è |
|---|---|---|
| `n.<network>.clients` | int | Client sulla rete ora, online secondo il test sopra. Ogni rete LAN ne ha uno |
| `n.<network>.unknown` | int | Su una rete OT: client online che non sono nel suo elenco dei noti |
| `n.<network>.unknown_last` | testo | Il più recente di essi, a parole. Vuoto quando non ce ne sono |
| `c.<mac>.online` | bool, connectivity | Client sorvegliato o collegato in rete |
| `c.<mac>.ip` | testo | Il suo IP, come l'ha visto per ultima la console |
| `c.<mac>.sw_mac`, `.sw_port` | testo, int | Lo switch e la porta di un client cablato. Conservati dopo che il cavo è stato tolto: dove *era* è il punto |
| `c.<mac>.port_up` | bool, connectivity | Il collegamento di quella porta. Errato quando lo switch stesso è uscito dalla console, perché allora nessuno lo sa |
| `c.<mac>.last_seen_s` | int, s | Secondi da quando la console lo ha visto l'ultima volta |

`<network>` è l'ID della rete sulla console, quindi rinominare SCADA nell'app non rompe nulla. Una rete segnata OT che la console ha poi cancellato legge errata con quel motivo, mai uno zero silenzioso. Un client che la console non ha mai visto legge `online` 0 e il resto errato, dicendolo.

Solo i client sorvegliati e collegati ricevono tag `c.*`. Una rete ospiti che fa girare 300 telefoni non crea 300 serie di tag.

### Leggere senza chiedere alla console

`GET /api/unifi/{id}/networks`, `/clients` e `/known`, il pannello e lo strumento MCP `find_network_client` leggono tutti l'ultima lettura del driver. Nessuno fa una richiesta propria, quindi una schermata lasciata aperta, o un agente che chiede in loop, non costa nulla alla console e non può essere ciò che provoca il 429. Il rovescio: un helper `--mcp-stdio`, che non accede mai, dice che nel suo processo non c'è alcuna lettura della console.

## Le schermate

La scheda UniFi ha sei viste e un selettore di console. Tutto ciò che mostra è l'ultima lettura della console da parte del driver, quindi lasciarla aperta non costa nulla alla console e non può essere ciò che provoca un 429. Chiede a HotLoop di nuovo ogni pochi secondi e si ridisegna solo quando qualcosa è cambiato, così una mappa che qualcuno ha spostato in un angolo resta dove l'ha messa.

- **Panoramica.** Una scheda per console. In cima a quella di un gateway c'è la striscia WAN: un segmento per WAN, verde quando il controllo di salute del gateway dice che è viva, rosso quando non lo è, quella che porta il traffico con il contorno. Quando il sito gira su un backup l'intera striscia diventa ambra e dice quale e da quando. Quel «da quando» è il momento in cui HotLoop l'ha letto così la prima volta, non quando il gateway ha commutato, e un HotLoop avviato quando il sito era già sul 5G lo dice dal proprio avvio. Non stampiamo un'ora che non abbiamo. Sotto: dispositivi online, client cablati e wireless, client per rete, i dispositivi che la console ha perso e gli ultimi eventi. Una WAN di cui la console non dice nulla è grigia e dice «no liveness reported», mai verde. Ogni WAN che riporta una latenza ha una traccia accanto al numero, la stessa linea che disegnano le tessere delle entità, dal buffer di HotLoop per quel tag. Un amministratore ha **Create the usual alarms** in fondo alla scheda, vedere [gli allarmi iniziali](#gli-allarmi-iniziali).
- **Mappa.** Da sinistra a destra a partire dal gateway. Viene disegnata sempre allo stesso modo (un albero ordinato, niente fisica, stessa lettura in ingresso e stessi pixel in uscita), quindi non traballa su uno schermo a parete. I cavi sono la `downlink_table` della console stessa: uno switch è collegato a un altro solo perché lo dice la console. Un dispositivo che nulla elenca come collegato a qualcosa sta da solo e dice «no uplink listed». Non lo appendiamo al gateway per un'ipotesi per poi sbagliarci su dove va la rete del PLC. I client cablati stanno sullo switch e sulla porta dove la console li ha appresi, quelli wireless sul loro AP e SSID, contati in un'etichetta sulla scheda. Fate clic su un dispositivo e tutto ciò che non è a valle di esso si attenua, e il pannello laterale elenca ciò che lo è, i suoi client e le linee dell'albero Plant che alimenta: i dispositivi HotLoop collegati a un client sotto di esso, ognuno con il percorso dell'apparecchiatura in cui si trova. La mappa si ingrandisce e si sposta: pizzicare con due dita, trascinare con una, ctrl e rotella o il pizzico di un trackpad attorno al puntatore, o i pulsanti più, meno e Fit, dalla mappa intera fino a otto volte. È SVG puro, quindi resta nitida a qualsiasi scala, e dove la mettete resta mentre la schermata si aggiorna. Un trascinamento che finisce su un dispositivo non lo seleziona. **Plant overlay** mette i dispositivi HotLoop collegati a un client in un riquadro tratteggiato per linea dell'albero Plant, a destra della rete e con l'etichetta del percorso della linea, ognuno con un cavo verso la porta dello switch a cui è collegato, ciò che la rete dice di esso (su, giù o non visto) e ciò che ne dice HotLoop. Un dispositivo collegato ma su nessuna linea sta in un riquadro chiamato «Not on the Plant tree». Resta attivo una volta acceso. Due console sono una sola immagine: un apparato di un'altra console che HotLoop legge e che questa console elenca come client cablato viene disegnato qui con il proprio sottoalbero, tratteggiato, con l'indicazione «separate console». La mappa si esporta come SVG per il fascicolo del sito.
- **Dispositivi.** Una tabella, e facendo clic su uno si vede il suo frontale: le porte disegnate come il pannello anteriore, una riga per un piccolo switch, due per 24 e 48 porte con le dispari sopra le pari. Verde per un collegamento, grigio per nessuno, **rosso per una porta che era su ed è caduta** (HotLoop ricorda che era su da quando ha iniziato a osservare), tratteggiata per una disabilitata, un fulmine PoE (i watt sono nel suggerimento e nel dettaglio della porta), una freccia sull'uplink. Fate clic su una porta per vedere chi c'è, cosa c'è collegato, modalità PoE, watt e traffico, con una traccia di ciò che ha ricevuto e inviato. Un dispositivo che la console ha perso non mostra numeri né collegamenti di porta, perché ciò che ha detto per ultimo non è più attuale.
- **Client.** Con ricerca per nome, MAC o IP, con dove si trova, quando la console lo ha visto l'ultima volta, noto o sconosciuto su una rete OT, e il dispositivo HotLoop collegato ad esso. Gli amministratori accettano uno sconosciuto dalla riga.
- **Reti.** L'interruttore OT, per rete, e «accetta tutto com'è». Questo cambia il registro di HotLoop, non la console.
- **WiFi.** Gli SSID, se ciascuno trasmette, su quale rete si trova e quanti client ha. Se la console non mostra all'account le sue reti wireless, la schermata lo dice invece di affermare che non ce ne sono.

Le route dietro tutto questo sono `GET /api/unifi/consoles`, `.../overview`, `.../topology`, `.../devices`, `.../wifi` e `.../events`, documentate in [L'API HTTP](/it/iot/api/).

### Gli allarmi iniziali

Gli allarmi che uno stabilimento vuole sulla sua rete prima che qualcuno abbia dovuto pensarci, creati da ciò che la console ha ora. **Create the usual alarms** nella Panoramica (oppure `POST /api/unifi/{id}/starter-alarms`, vedere [l'API HTTP](/it/iot/api/)) crea:

| Allarme | Su | Priorità | Ritardo di attivazione |
|---|---|---|---|
| un dispositivo offline | `d.<mac>.online`, per ogni switch, AP e gateway adottato | 2 | 60 s, così il riavvio per un firmware non avvisa nessuno |
| un uplink giù | `p.<mac>.<nn>.up` sulla porta con cui ogni dispositivo è collegato al suo livello superiore | 1 | 10 s |
| un gateway su una WAN di backup | `d.<mac>.wan.failover`, per un gateway con due o più WAN | 2 | 30 s |
| una porta PoE oltre un limite | `p.<mac>.<nn>.poe_w`, solo quando indicate un limite in watt | 3 | 30 s |

Sono normali definizioni di allarme: sospendetele, riconoscetele, inviatele a Discord, modificate il ritardo o il limite, cancellatene una. Premere di nuovo dopo aver adottato altri apparati aggiunge solo i nuovi, e un tag che ha già un allarme, fatto a mano o da una pressione precedente, viene lasciato in pace. L'allarme PoE prende un limite che indicate voi invece di uno scelto da HotLoop, perché nessuna console che leggiamo dice quale sia il budget di una porta, e un numero che avessimo indovinato sarebbe un numero di cui qualcuno si fiderebbe. «Unknown device on an OT network» e «a watched client off the network» non sono nel pulsante: vengono creati quando una rete è segnata OT e quando un dispositivo è sorvegliato o collegato, con il registro che dà loro un significato.

## Eventi

Il websocket degli eventi della console (`/proxy/network/wss/s/<site>/events` su UniFi OS, `/wss/s/<site>/events` sull'applicazione self-hosted), sulla stessa sessione di tutto il resto. Non accede mai per conto suo: un handshake rifiutato con 401 passa dallo stesso budget di accessi di una lettura, e un accesso rifiutato viene atteso, non ritentato.

**Il polling resta la verità.** Un evento non scrive mai un tag. Cosa fa:

1. Arriva nel **registro** nel momento in cui arriva, con la frase del controller stesso («Switch[...] was disconnected») e la sua chiave. Uno switch che cade è sulla linea temporale quando accade, non quando il polling successivo se ne accorge. Viene archiviato sotto lo switch, il punto di accesso o il gateway di cui parla, non sotto il dispositivo della console stessa, perché la console è la macchina su cui gira il controller e non ciò che è caduto. Un evento che nomina solo un client (la console dice chi si è unito, non dove) viene archiviato sotto lo switch o l'AP su cui l'ultima lettura ha quel client, e se il client è nuovo aspetta la lettura che l'evento ha appena richiesto, fino a trenta secondi, poi va sotto la console se quella lettura non lo ha ancora. Il filtro **Where** del registro trova un evento a partire dallo stabilimento: un dispositivo HotLoop collegato al suo client, lo switch su cui la console dice che si trova quel client, e ogni switch tra lì e il gateway secondo la tabella di downlink della console stessa. Uno switch caduto è sulla linea temporale di ogni linea che alimenta e di nessuna che non alimenta. Chiedere la console stessa funziona come sempre: il log di sistema per `subject` uguale all'id della console, e il registro con la console tra i dispositivi nell'ambito, restituiscono tutti gli eventi di quella console, compresi quelli dei singoli switch.
2. Entra nel log che mostra la Panoramica, e in `site.last_event` e `d.<mac>.last_event`, così un'automazione può scattare su uno di essi.
3. Chiede subito la lettura successiva. Il minimo di lettura è di dieci secondi; un evento lo porta a cinque, così i tag e le entità si aggiornano entro il prossimo polling invece che fino a dieci secondi dopo. Una rete WiFi trafficata invia un evento per ogni telefono che passa, e la console non viene letta per ciascuno.

Il controller segnala gli eventi che significano che qualcosa è andato storto (`is_negative`: uno switch che perde il contatto lo è, un client che si disconnette no), e quelli sono avvisi nel registro. Tutto il resto è informazione, comprese le chiavi che HotLoop non ha mai visto.

**Un websocket morto costa velocità, mai correttezza.** Si riconnette con un backoff da due secondi fino a un minuto. Invia ping, e un flusso che non risponde nulla per 90 secondi è morto qualunque cosa dica la rete, quindi viene chiuso e riaperto. Finché è giù, `site.events_live` legge 0, la Panoramica dice «polling only» con il motivo, e il polling prosegue esattamente come prima.
## Cosa è verificato

Il driver UniFi e le schermate sono stati eseguiti su vere Network Application UniFi e console UniFi OS, in sola lettura con un account View Only, e su hardware reale il 2026-11-17: l'accesso e la sua sessione unica, i tag di dispositivo, porta, PoE, WAN e client, il flusso di eventi dal vivo e le schermate costruite su di essi.
