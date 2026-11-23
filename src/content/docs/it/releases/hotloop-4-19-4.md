---
title: "Note di rilascio: HotLoop core 4.19.4"
description: "Cosa porta HotLoop core 4.19.4, cosa cambia all'aggiornamento e cosa leggere prima di toccare un impianto in funzione."
sidebar:
  label: "4.19.4"
---

Le 4.19.0, 4.19.1, 4.19.2 e 4.19.3 sono state taggate e mai pubblicate, quindi non esiste nulla con uno di quei nomi e `stable` non si è mai spostato su nessuna. Questa è la prima versione con tutto ciò che elencano le loro note, e comprende una novità rispetto alla 4.19.1: i chart accettano `hostNetwork`.

- La 4.19.1 aggiungeva la correzione per questo e un'altra (un listener di discovery che dichiarava di essere attivo prima di poter sentire, più sotto) ed è stata saltata prima della release.
- La 4.19.2 aggiungeva `hostNetwork`.
- Entrambe sono corrette più sotto.
- Tutto ciò che c'era nelle note della 4.19.0 (MCP, scritture con scala, l'accesso dallo store, CODESYS, il flusso di eventi Kafka, OPC UA PubSub su UADP e le correzioni) è nelle note qui sotto.

Cosa c'è di nuovo rispetto alla 4.19.1: i chart hanno un'impostazione `hostNetwork`.

## hostNetwork

Ogni chart HotLoop con un pod (quelli del Gateway, di IoT e di Edge e quello dell'Edge Relay) accetta `hostNetwork: true`. È disattivato per impostazione predefinita, e disattivato il chart produce esattamente ciò che produceva quello della 4.19.1.

- **A cosa serve.** A un pod che deve sentire ciò che sente il suo nodo: multicast UDP sul loopback del nodo (un runtime PLC sullo stesso box che pubblica OPC UA PubSub verso un gruppo multicast sul loopback), o una seconda scheda di rete. Una rete di pod non porta né l'uno né l'altra.
- **Cosa fa.** Il Deployment riceve `hostNetwork: true` e `dnsPolicy: ClusterFirstWithHostNet`, così i nomi DNS del cluster continuano a risolversi.
- **Cosa significa per il pod.** Usa gli indirizzi e le porte del nodo: la pagina risponde su ogni indirizzo del nodo a `service.targetPort`, quindi scegli una porta che nulla sul nodo usi e tieni attiva l'autenticazione. Una NetworkPolicy non si applica a un pod in rete host (il plugin di rete del cluster le ignora). Fissa il pod al suo nodo con `nodeSelector`.
- **Un listener sul loopback.** Il sottoscrittore OPC UA PubSub entra in un gruppo su una scheda indicata per nome o per indirizzo: `"interface": "127.0.0.1"` nelle opzioni del dispositivo lo fa entrare sulla scheda di loopback.
- **Nient'altro.** Il codice è quello che avrebbe rilasciato la 4.19.1. La guardia della release ora rende ogni chart con e senza l'impostazione e fallisce se uno dei due rendering è sbagliato.

---

Il resto di questa versione, dalla 4.19.0 e dalla 4.19.1:

Due cose della 4.19.4 cambiano ciò che fa un impianto esistente, quindi leggile prima di toccarne uno in funzione. Gli agenti via MCP ora possono scrivere, e l'endpoint MCP ha sempre un token. E un valore che scrivi in un tag con scala finalmente arriva nel registro come intendevi, il che significa che chi aggirava il vecchio comportamento deve smettere. Tutto il resto è nuovo, o una correzione.

Le note complete sono nel README: Cosa è cambiato nella 4.19.4.

### MCP è attivo, scrive e ha sempre un token

- **Gli agenti ora possono scrivere, dove poteva un operatore.** MCP è attivo in ogni prodotto HotLoop e legge e scrive. `allowMcpWrites` vale true per impostazione predefinita nel codice e in tutti e tre i chart. Un deployment che ha `allowWrites` attivo e non ha mai impostato `allowMcpWrites` ottiene scritture degli agenti dopo questo aggiornamento, dalla stessa porta della schermata: i permessi dell'utente, il segno di scrivibile del tag e il suo intervallo valgono ancora.
- **`allowWrites` non è cambiato.** Resta disattivato per impostazione predefinita e decide ancora se qualcosa può scrivere, interfaccia e agenti insieme. Se è disattivato, nulla scrive, MCP compreso.
- **Un deployment che ha salvato `allowMcpWrites: false` resta disattivato.** Questo include uno installato dall'App Store, che salva ogni risposta. Cambialo se vuoi che gli agenti scrivano.
- **L'endpoint non è mai aperto.** I chart impostano sempre un token MCP. Un HotLoop avviato senza `HOTLOOP_MCP_TOKEN` (un'unità Quadlet, un binario nudo) serviva `/mcp` a chiunque potesse raggiungere la porta e registrava solo un avviso. Ora crea un token di 24 byte al primo avvio e lo tiene nel suo database, così ogni replica e ogni ripristino portano lo stesso. Una chiamata senza il token riceve un `401`. Un token che hai configurato non viene mai sostituito.
- **Per ottenere il token su un'installazione nuda o Quadlet:** `hotloop mcp-token` lo stampa. Se hai un agente puntato su `/mcp` su una di quelle installazioni senza token, smette di funzionare con questo aggiornamento finché non gli dai quel token. È voluto.
- **Chi ha fatto la chiamata.** Un token statico dice quale client ha chiamato, mai quale persona. Con le impostazioni OIDC attive, un accesso Vord o un'asserzione dell'hub su `/mcp` fa sì che l'audit nomini la persona (`mcp:pat@example.com`), e un ruolo di scrittura facoltativo restringe le scritture per chiamante oltre agli interruttori sopra. È disattivato finché non lo imposti, e il token continua a funzionare accanto. [La pagina MCP](/it/iot/mcp/) spiega la configurazione.

### Scritture su un tag con scala

- **Cosa non andava.** Un tag con una scala, diciamo 0.1 su un registro di temperatura che contiene decimi di grado, ti mostra il valore ingegneristico: il registro dice 555 e la schermata dice 55.5. La scrittura andava nell'altro verso senza la stessa cura. Scrivevi 55.5 per il setpoint e HotLoop metteva 55 nel registro, che poi si rileggeva come 5.5. Era lo stesso su ogni schermata, tramite l'API, da un'automazione, da uno script, da una ricetta, da un anello e via MCP, perché passano tutti dalla stessa porta di scrittura. La riga di audit diceva 55.5 da sempre, quindi nel log nulla sembrava sbagliato.
- **Cosa cambia.** Il numero che scrivi è nelle unità proprie del tag, come quello che leggi. HotLoop toglie scala e offset prima di inviare: 55.5 su un tag con scala 0.1 mette 555 nel registro e si rilegge come 55.5. Un tag senza scala e senza offset non viene toccato affatto. Bit, coil, stringhe e scritture Sparkplug e MQTT di un flag non sono scalati nemmeno loro.
- **Se lo aggiravi, smetti.** Se qualcuno scriveva conteggi grezzi in un tag con scala per ottenere il numero giusto, scrivendo 555 per ottenere 55.5, ora questo invia 5550 e si rilegge come 555. Scrivi il valore ingegneristico. Guarda i tuoi tag con scala prima di aggiornare: ogni tag con una scala diversa da 1, o con un offset, su cui qualcuno scrive a mano, da un'automazione o da una ricetta, merita un'occhiata. Le ricette e le automazioni che scrivevano conteggi devono avere i numeri cambiati in valori ingegneristici nello stesso passo dell'aggiornamento.
- **Un valore che il registro non può contenere viene rifiutato.** Tolta la scala, un conteggio che non entra nel registro, 7000 su un `uint16` con scala 0.1, viene rifiutato con un messaggio chiaro che nomina il conteggio e il registro, e non viene inviato nulla. Prima andava a capo in silenzio: 70000 su un registro a 16 bit usciva come 4464. Vale per i tipi interi di Modbus, S7, EtherNet/IP e OPC UA.
- **Una ricetta con un valore che non entra viene rifiutata per intero.** Prima della sua prima scrittura si controlla ogni destinazione, quindi una ricetta non si applica mai a metà per poi rifiutare. Per Modbus, S7 ed EtherNet/IP il controllo conosce il tipo di registro di ogni tag dal suo indirizzo. Per OPC UA, che è la via verso un runtime CODESYS, usa il tipo con cui è arrivata l'ultima lettura del tag. Un tag mai letto dall'avvio di HotLoop non ha ancora un tipo con cui confrontare, quindi una ricetta che lo prende di mira viene rifiutata alla scrittura di quel tag, dopo che le destinazioni precedenti sono state scritte, e l'applicazione registra quali. Leggerlo una volta, cosa che il polling fa entro un secondo dalla connessione, lo risolve.
- **Una frazione di conteggio viene tagliata.** Un registro contiene conteggi interi, quindi 12.34 su un registro con scala in decimi contiene 12.3, come sempre.
- **Cosa non è cambiato.** Il controllo dell'intervallo di un tag e la riga di audit usano il numero che hai scritto. La porta di scrittura, i permessi e le regole di rifiuto sono gli stessi.

### Un'installazione dallo store ti fa accedere come te stesso

Il chart creava una password di amministratore casuale in un Secret che il tenant non può leggere, quindi un'installazione dallo store finiva su un login senza uscita. Con la chiave pubblica della dashboard configurata, una richiesta con un'asserzione firmata valida per questo tenant e questo Service fa accedere quella persona, crea il suo utente la prima volta, mantiene il suo ruolo allineato a ciò che ha inviato la dashboard, e la traccia di audit la nomina. Un'asserzione errata, scaduta, di un altro tenant o di un'altra app viene rifiutata, e il login locale non viene toccato. È disattivato finché non si imposta una chiave, e i tre chart di prodotto prendono la chiave dallo store. [Autenticazione e utenti](/it/iot/authentication/) ha le impostazioni.

### CODESYS, con i nomi che il programmatore ha dato alle variabili

HotLoop legge e scrive un PLC CODESYS tramite il server OPC UA del runtime stesso, come documenta CODESYS: la Symbol Configuration dell'applicazione, pubblicata sotto il modello PLCopen IEC 61131-3. La discovery elenca ciò che l'applicazione esporta con i tipi e l'accesso che il programmatore ha dato loro, scendendo in array e strutture, e un tag è un simbolo IEC che si trova sotto qualunque nome il progetto dia al suo PLC e alla sua applicazione. Un riavvio, un download o un collegamento perso si legge come cattivo con il motivo e torna senza interventi. L'abbiamo provato contro un vero runtime 4.22.0.0 nei test eseguendo il nostro programma, con una scrittura a cui risponde la logica stessa del PLC, e contro un secondo programma di oltre centomila variabili, letto in 2.4 secondi.

Questo tocca un driver che gli impianti eseguono, quindi chiaramente: il driver OPC UA chiedeva 200 nodi a richiesta e non leggeva mai ciò che il server consente. Un runtime CODESYS pubblica OperationLimits di 100 e rifiuta di più, e il driver rispondeva dichiarando float ogni tag scoperto e non leggendo nessun tag di un dispositivo con più di cento. Ora le richieste sono tagliate sui limiti che il server pubblica alla connessione, e dimezzate quando un server che non ne pubblica dice che sono troppe. Un tipo di dato che è sottotipo di uno standard (uno STRING, BYTE o TIME di CODESYS) viene seguito fino al tipo standard, quindi tipizzato e scritto come quello. Ogni dispositivo OPC UA lo riceve, non solo quelli CODESYS.

### Un flusso di eventi Kafka

- **Che cos'è.** HotLoop può inviare le sue letture e il suo log di sistema a qualsiasi broker che parli l'API Kafka: Apache Kafka, Redpanda e il resto di quella famiglia. È un nuovo tipo di destinazione historian, sotto Settings, Historian targets, quindi ha la coda, il recupero dallo storico di HotLoop e lo stato che hanno quelle. Le letture vanno a un topic e il log di sistema (allarmi, dispositivi che salgono e scendono, modifiche) a un altro, come JSON.
- **TLS e SASL.** SCRAM-SHA-256, SCRAM-SHA-512 e PLAIN (PLAIN solo su TLS), con la tua CA se il certificato del broker non è di una pubblica. Certificati client, Kerberos e login OAuth non sono ancora supportati.
- **È almeno una volta.** Una lettura può arrivare due volte dopo un'interruzione, perché il recupero sovrappone di proposito ciò che è già uscito. `deviceId`, `tag` e `ts` identificano un duplicato. Gli eventi sono il feed in diretta e non hanno storico da recuperare, quindi uno prodotto mentre il broker è assente va perso, e lo stato della destinazione lo conta.
- **Un broker che sparisce a metà scrittura.** La destinazione va giù entro 25 secondi e le letture di quella scrittura risultano dovute, invece di restare su con la coda che trabocca.
- **Un topic creato un attimo fa.** La prima occhiata a un topic appena creato, da te o dall'ultimo tentativo della destinazione stessa, aspetta che esista e abbia un leader invece di segnalare la destinazione giù.
- **Quanto costa.** Circa 5 MiB sul binario di ogni prodotto con un database. L'Edge Relay non ha destinazioni historian e non lo include. Il client è franz-go, citato in `NOTICE`.
- **Aggiornamento.** La migrazione 0026 aggiunge una colonna `options` alle destinazioni historian, vuota per ogni destinazione esistente. Nulla cambia per loro. [Destinazioni historian](/it/iot/historian-targets/#api-kafka-flusso-di-eventi) ha i formati dei record e cosa è provato e cosa no.

### OPC UA PubSub su UADP

- **Sottoscrizione.** Un dispositivo con il protocollo `opcua-pubsub` ascolta i DataSet di un publisher inviati come UADP su UDP, unicast o multicast. L'indirizzo di un tag è `<DataSetWriterId>/<field index>`. Campi Variant, DataValue e RawData, frame key, delta e keep alive. Un messaggio perso segna i tag di quel writer come incerti fino al suo prossimo frame key, e un writer silenzioso si legge come cattivo.
- **Pubblicazione.** Edge e Gateway possono pubblicare come UADP i tag che un layout nomina, disattivato finché non si imposta `HOTLOOP_UADP_PUBLISH_ENABLED`. Frame key quando i valori cambiano e keep alive quando non cambiano. Un tag cattivo viene pubblicato come il suo stato, mai come il suo ultimo valore.
- **Non ancora.** La sicurezza dei messaggi (messaggi firmati o cifrati) viene rifiutata per nome, così come i messaggi frammentati, la discovery, gli eventi e i campi struttura. I frame delta vengono letti ma non inviati.
- **Array.** Un campo che è un array viene letto nei messaggi Variant e DataValue, e in RawData quando il DataSet del dispositivo dice come è disposto (`"Float[250]"` per un array con il suo conteggio, `"Float*250"` per 250 campi separati). Un tag nomina un elemento, `1000/3[17]`, e Browse li elenca.
- **Dove ascolta.** Il gruppo, la porta e la scheda di rete sono del dispositivo. Funzionano sia un gruppo multicast su una scheda indicata sia una porta unicast su questa macchina.
- [Protocolli e driver](/it/iot/protocols/#opc-ua-pubsub-uadp) ha la configurazione e i limiti.

### Immagini e un secondo set di schermate

- **Solo amd64, questa volta.** Le immagini della 4.19.4 sono costruite per amd64. Il tag di versione elenca solo amd64, e `stable` e `latest` portano la nuova immagine amd64 accanto alle immagini arm64 e arm/v7 che avevano già, che sono quelle della versione precedente. Un box arm che segue `stable` continua a scaricare e a eseguire ciò che eseguiva. La prossima versione ricostruisce tutte le architetture ed è un semplice incremento di versione senza altro.
- **Le nuove schermate sono su `/next`.** Un'interfaccia web ricostruita è in ogni immagine dietro la vecchia, che è ancora quella che ottieni su `/`. Provala su `/next` su qualsiasi installazione; nulla cambia per quella predefinita.

### Correzioni

- **Un processo non ferma più la run successiva di uno script con il proprio stop che gli torna indietro.** L'arresto di uno script viene annunciato a ogni processo, compreso quello che lo ha fatto, e l'annuncio risentito poco dopo annullava la run di quello script in corso: sotto carico una run attesa veniva annullata 8 ms dopo l'inizio, e un'altra non finiva mai. Un processo ignora lo stop che ha annunciato lui stesso, e uno stop annunciato da un altro processo lo ferma ancora.
- **Un listener di discovery è attivo quando il broker ha risposto alle sue sottoscrizioni, e solo allora.** Un'attesa scaduta contava come risposta, e così una risposta su una connessione nel frattempo caduta; nessuna delle due conta più, e una risposta che arriva in ritardo conta ancora.
- **Un listener di discovery dice di essere attivo quando può sentire.** La sessione MQTT si contava connessa nel momento in cui il broker la accettava, e solo dopo emetteva le sottoscrizioni e aspettava che il broker le concedesse. Un listener che si dichiarava attivo su quello inviava il messaggio successivo nel vuoto, e lo stato o la configurazione di un dispositivo non trattenuti andavano persi. Ora si dichiara attivo quando le sottoscrizioni sono concesse, alla prima connessione e a ogni riconnessione.
- **Un pin sulla board non cancella più la board.** La pagina leggeva la board solo quando si apriva la schermata della board, quindi un ricaricamento sulla schermata dei tag teneva una lista vuota e il primo pin sostituiva la board salvata con quel solo tag. La pagina ora legge la board all'avvio, un pin viene rifiutato finché non l'ha fatto, e un salvataggio porta il `rev` della board, così il server risponde `409` a un salvataggio su una board cambiata dalla lettura. Il `rev` è facoltativo nell'API: se lo ometti, il salvataggio non viene controllato.
- **Una sottoscrizione OPC UA bloccata viene notata.** La libreria tiene i suoi keep alive per sé, quindi un ciclo di pubblicazione fermo sembrava un impianto tranquillo e serviva i suoi ultimi valori come buoni. Dopo dieci intervalli di pubblicazione di silenzio (almeno trenta secondi) il driver legge i nodi una volta, li confronta con ciò che ha e ripiega sulle letture se qualcuno differisce.
- **Un PLC che tace con il socket aperto è giù, non degradato.** Modbus, S7 ed EtherNet/IP tenevano i loro ultimi valori finché TCP non si arrendeva, perché il polling tornava prima di giudicare la sessione. Ora la giudicano. Nei test non c'è ancora nessun server S7 o CIP sul cavo, e la roadmap lo dice.
- **Una credenziale scritta in un URL o in testo libero viene cifrata a riposo.** Ogni schermata nascondeva già `mqtt://user:pass@host` e `?token=` alle persone, ma il database e i backup li tenevano come digitati. Una stringa che ne porta uno, secondo lo stesso test con cui la redazione lo nasconde, viene sigillata per intero e torna esattamente come scritta, così il driver riceve ancora l'URL che gli è stato dato. Una chiave attivata più tardi sigilla ciò che era salvato prima, e un ripristino chiede la chiave solo quando serve solo un indirizzo.
- **Ogni orario che l'API scrive è in UTC.** Un impianto impostato su New York scriveva `-04:00` dove uno in UTC scriveva `Z`, in una trentina di campi: `created_at`, `updated_at`, il `raisedAt` di un allarme, l'orario di un evento, il `lastPoll` di un dispositivo, il timestamp di un tag, una voce del logbook, la prossima esecuzione di un report. Ora si leggono uguali in entrambi. Se li analizzi in uno script che si aspettava il tuo offset locale, ora riceve `Z`.
- **Le partizioni mensili venivano saltate il 31.** Le tabelle di storico e logbook creavano la partizione successiva aggiungendo un mese a oggi, e il 31 questo saltava un mese, così le righe di un mese finivano nella partizione predefinita. Ora partono dal primo del mese.
- **Il registro eventi di UniFi è ordinato per quando l'evento è avvenuto,** non per quando il frame è arrivato qui, così un replay dopo una riconnessione smette di stare in cima.
- **Il pannello frontale di uno switch sta su un telefono.** Otto porte erano più larghe di uno schermo di 390 pixel e la pagina scorreva di lato di 113 pixel. Ora le porte sono tessere strette, con i watt PoE nel dettaglio della porta, e un pannello che sfora ancora la sua card scorre al suo interno.
- **Un telefono senza sessione e senza connessione riceve la schermata di accesso e il motivo** invece di un'app vuota, e si ricarica quando HotLoop risponde.
- **Un rollback è un solo comando.** L'indice dei chart si fonde in quello attivo invece di essere ricostruito dai chart della release stessa, così una versione più vecchia si risolve ancora.

### Aggiornare dalla 4.18.11

- Leggi le prime due sezioni sopra prima di fare qualsiasi cosa su un impianto in funzione.
- La migrazione 0026 è l'unica. È additiva e ogni riga esistente continua a funzionare.
- Un'installazione nuda o Quadlet riceve un token MCP al primo avvio. `hotloop mcp-token` lo stampa.
- `helm upgrade` come al solito. Le unità Quadlet seguono `:stable` e non hanno bisogno di nulla. `helm rollback` alla 4.18.11 va bene per questa versione: il database è già PostgreSQL 17 e nulla qui lo cambia.
