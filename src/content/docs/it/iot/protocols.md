---
title: "Protocolli e driver"
description: "OPC UA, Modbus, MQTT e Sparkplug B, EtherNet/IP, S7comm, MTConnect e HTTP, con quanto ogni driver è stato provato su apparecchiature reali."
---

Questo documento dice esattamente che cosa parla il gateway, fino a che punto è stato verificato ogni driver e che cosa fare per tutto il resto. È la prima cosa da leggere e quella di cui fidarsi quando qualcosa non coincide.

L'elenco dei protocolli nativi deriva dai driver compilati nel binario: `/api/protocols`, la schermata Protocolli e lo strumento MCP `describe_protocol` leggono tutti lo stesso registro. Il catalogo non può annunciare un protocollo che il binario non ha.

## Stato della verifica

Ogni protocollo che HotLoop parla in modo nativo ha spostato valori reali da un server o dispositivo reale ed è stato eseguito su hardware reale (2026-11-17). Dove esiste un'implementazione indipendente, HotLoop è stato eseguito contro di essa in entrambe le direzioni.

| Protocollo | Nativo | Stato |
|---|---|---|
| Modbus TCP/RTU | sì | **verificato dal vivo** |
| OPC UA | sì | **verificato dal vivo**, compreso Ignition 8.3.9 in entrambe le direzioni con nome utente e password su un canale protetto |
| MQTT / Sparkplug B | sì | **verificato dal vivo** |
| MTConnect | sì | **verificato dal vivo** |
| HTTP / REST | sì | **verificato dal vivo** |
| S7comm | sì | **verificato dal vivo** (hardware reale, 2026-11-17) |
| EtherNet/IP | sì | **verificato dal vivo** (hardware reale, 2026-11-17) |
| UniFi Network | sì | **verificato dal vivo**, in sola lettura, su console e switch reali, compresi i collegamenti WAN e il failover |
| SNMP | sì | **verificato dal vivo**, in sola lettura, su v1, v2c e v3 a ogni livello di sicurezza |
| CODESYS | sì | **verificato dal vivo**, letture e scritture, compreso un programma di oltre 100.000 variabili letto in 2,4 secondi |
| BACnet/IP | sì | **verificato dal vivo**, in sola lettura |
| OPC UA PubSub (UADP) | sì | **verificato dal vivo**, in entrambe le direzioni |
| API Kafka (uscita) | sì | **verificato dal vivo** con Apache Kafka e Redpanda, con TLS e un accesso SASL |

I produttori differiscono sui valori predefiniti: quali certificati e politiche di token offre un server OPC UA, che cosa mette un controller BACnet nel suo elenco di oggetti, quali MIB serve un dispositivo SNMP, come un PLC numera i propri dati. Un dispositivo nuovo in un sito nuovo resta un lavoro di messa in servizio, quindi confronta un valore noto sulla sonda dell'integrazione con il display del dispositivo prima di fidarti di una schermata.

## Protocolli nativi

### OPC UA

Preferisci questo quando un dispositivo offre una scelta. Esplora, è protetto correttamente e si sottoscrive.

Il driver **si sottoscrive invece di interrogare**. Il server invia un valore quando cambia, a una frequenza che può sostenere, invece di ricevere la stessa domanda a ogni ciclo da un client che non sa se qualcosa si è mosso. Se un server rifiuta una sottoscrizione, il driver ripiega su letture a blocchi invece di far fallire il dispositivo.

Ripiega anche quando una sottoscrizione non consegna proprio nulla. Un server invia il valore corrente di ogni nodo nella sua prima pubblicazione e non lo ripete finché non cambia, quindi una prima pubblicazione persa significa un setpoint che risulta errato per tutta la durata della sessione. Se passano dieci intervalli di pubblicazione (almeno cinque secondi) senza alcun valore dalla sottoscrizione, il driver registra un avviso, elimina la sottoscrizione e legge i tag a ogni interrogazione finché il dispositivo non si riconnette. La libreria client OPC UA su cui si basa questo driver può avviare il proprio ciclo di pubblicazione in pausa su un host carico e non inviare mai una richiesta di pubblicazione; esiste per questo caso.

Ripiega anche quando una sottoscrizione si ferma dopo che sono arrivati dei valori. La libreria tiene per sé i propri keep-alive, quindi un ciclo di pubblicazione fermo appare identico a un impianto in cui nulla cambia. Dopo che una sottoscrizione è rimasta silenziosa per dieci intervalli di pubblicazione (almeno trenta secondi), il driver legge ogni nodo una volta e lo confronta con quanto la sottoscrizione ha consegnato per ultimo. Se un nodo differisce in valore o qualità, il server sta trattenendo qualcosa che avrebbe inviato, quindi il driver registra un avviso, elimina la sottoscrizione e legge a ogni interrogazione finché il dispositivo non si riconnette. Se coincidono, prosegue e ricontrolla dopo lo stesso silenzio. Una sottoscrizione sana e silenziosa costa una lettura a blocchi ogni trenta secondi.

**Indirizza i nodi per URI dello spazio dei nomi.** Conta più di quanto sembri:

```
nsu=http://opcua.edge.server;s=Zone1_Temperature    good
ns=3;s=Zone1_Temperature                            works until it doesn't
```

Un *indice* dello spazio dei nomi viene assegnato nell'ordine in cui il server carica i propri spazi dei nomi. Aggiungi uno spazio dei nomi, aggiorna il firmware, e l'indice 3 diventa silenziosamente qualcos'altro: ogni lettura risulta allora errata senza alcun errore. L'URI fa parte del modello e non si sposta. `Browse` restituisce la forma URI proprio per questo motivo.

Una stringa semplice viene rifiutata come indirizzo. Letto come `ns=0;s=Temperature`, un errore di battitura verrebbe interpretato senza problemi come un nodo che non esiste e il tag risulterebbe errato per sempre. Si richiede una forma esplicita perché l'errore emerga al salvataggio.

**Scopri i tag dichiara ogni tag con il tipo che il server dice che il nodo contiene**: Boolean è `bool`, i tipi interi mantengono la loro larghezza (`int16`, `uint16`, `int32`, `uint32`, `int64`, `uint64`; SByte e Byte passano alla dimensione successiva), Float e Double sono `float`, e String, DateTime, LocalizedText e gli altri tipi che il driver legge come testo sono `string`. Un tipo che il server non dichiara, o senza un nome migliore (un'enumerazione, una struttura), resta `float`. Fino al lavoro con Ignition descritto più avanti, ogni tag scoperto era `float`. Il driver leggeva comunque il testo di un nodo String, ma il tag diceva float, e il server OPC UA del Gateway pubblica un tag con il tipo con cui è dichiarato, quindi un client di quel server riceveva `Bad_TypeMismatch`. Ignition ha mostrato `System_Status` di Emberburn esattamente così. I tag importati prima della correzione mantengono il loro tipo: cambia a mano in `string` un tag di testo.

Configurazione: le opzioni di sicurezza, identità e certificato sono descritte in [OPC UA: sicurezza e credenziali](#opc-ua-sicurezza-e-credenziali). Le altre sono `subscribe`, `publishIntervalMs`, `samplingIntervalMs`, `queueSize`, `sessionTimeoutMs`, `browseMaxNodes`, `browseRoot` e `browseServerNodes`. Il nome di un'opzione che il driver non conosce è un errore che elenca quelle che conosce, non un'impostazione ignorata in silenzio: un errore di battitura in `securityMode` si connetterebbe senza alcuna sicurezza e sembrerebbe esattamente un dispositivo funzionante.

**Scopri i tag esclude l'oggetto `Server` del server stesso** (`i=2253`: il suo stato, le capacità, la diagnostica, l'array degli spazi dei nomi e la configurazione). Ogni server OPC UA ne ha uno, e possono essere centinaia di variabili mescolate a quelle dell'impianto. Imposta `browseServerNodes` su `true` sul dispositivo per riaverle, oppure imposta `browseRoot` su `i=2253` per guardarci dentro di proposito; un'esplorazione che parte da lì lo percorre comunque.

### OPC UA: sicurezza e credenziali

Fino alla 4.15.0 il driver sapeva fare solo una connessione anonima e non protetta, e non verso qualunque server conforme alla specifica: non chiedeva mai al server quali politiche di token di identità offrisse, quindi inviava un id di politica di token vuoto, che un server conforme rifiuta. Questo includeva il server OPC UA di HotLoop stesso. Ora il driver scopre gli endpoint del server, ne sceglie uno che corrisponde al dispositivo e restituisce l'id di politica che quell'endpoint ha elencato.

#### Opzioni del dispositivo

| Opzione | Valore predefinito | Che cosa fa |
|---|---|---|
| `securityMode` | `None` | `None`, `Sign` o `SignAndEncrypt`. Se omesso con un `securityPolicy` diverso da `None`, è `SignAndEncrypt`. |
| `securityPolicy` | la migliore che il server offre per la modalità | `None`, `Basic256Sha256`, `Aes128_Sha256_RsaOaep` o `Aes256_Sha256_RsaPss`. `Basic128Rsa15` e `Basic256` vengono rifiutate. |
| `username`, `password` | anonimo | Autenticazione con nome utente. |
| `userCertificate`, `userPrivateKey` | nessuno | Autenticazione utente X.509: la sessione accede come l'utente a cui il server associa questo certificato, senza password. Entrambi in PEM, da impostare insieme. La chiave è RSA (la libreria OPC UA firma solo con RSA; una chiave EC viene rifiutata dicendolo) ed è un segreto come la password: sigillata a riposo, oscurata in ogni risposta dell'API, mai registrata nei log. Il certificato è quello dell'utente, non il certificato dell'applicazione client in `certFile`. Se è impostato anche un `username`, si usa il certificato. Con il server di HotLoop stesso, il certificato deve prima essere associato a un utente ([Il server OPC UA](/it/edge/opc-ua-server/#certificati-utente-x509)). |
| `allowInsecureCredentials` | `false` | Consente l'invio di una password su un canale non protetto (`securityMode` `None`), o quando nulla la cifra. |
| `certFile`, `keyFile` | generati | Il certificato dell'applicazione di questo client e la sua chiave RSA, per una modalità protetta. Imposta entrambi o nessuno. |
| `pkiDir` | `HOTLOOP_OPCUA_CLIENT_PKI_DIR` (`/data/opcua-client-pki`) | Dove risiedono il certificato generato e gli archivi `trusted/` e `rejected/`. |
| `serverCertThumbprints` | nessuna | Impronte SHA-1 (40 cifre esadecimali) o SHA-256 (64) di certificati di server di cui fidarsi senza un file in `trusted/`. I due punti e gli spazi vengono ignorati. |
| `insecureSkipVerify` | `false` | Accetta qualsiasi certificato del server. |

Un dispositivo senza nessuna di queste opzioni è quello che è sempre stato: anonimo, su un canale non protetto.

#### Come il driver sceglie un endpoint

Il driver chiede al server i suoi endpoint su un canale non protetto, cosa che la specifica obbliga i server a consentire per la scoperta e che non trasporta nulla di segreto, dato che l'elenco degli endpoint è pubblico per progetto. Conserva gli endpoint la cui modalità e politica di sicurezza corrispondono al dispositivo e, tra questi, la politica di token per l'identità del dispositivo (anonimo, oppure nome utente quando è impostato un `username`). Il token di identità che invia poi porta l'id di politica che quell'endpoint ha elencato; non ne invia mai uno vuoto.

- **Non seleziona mai `Basic128Rsa15` né `Basic256`.** Entrambe sono deprecate dalla OPC Foundation. Questo vale quando una ha il livello di sicurezza più alto dell'elenco, che è il modo in cui i server le ordinano, e quando una è l'unica cosa che il server offre, nel qual caso la connessione fallisce con un errore che lo dice. Un dispositivo non può essere configurato per usarne una, e viene rifiutata anche una politica di token che cifrerebbe una password con una di esse. Il server di HotLoop stesso offre entrambe accanto alle politiche moderne e non può disattivarle, quindi questo viene esercitato contro un server reale, e i test verificano che l'URI di nessuna delle due compaia in ciò che il driver invia.
- **Quando il dispositivo non indica alcuna politica, preferisce `Basic256Sha256`, poi `Aes128_Sha256_RsaOaep`, poi `Aes256_Sha256_RsaPss`**, qualunque livello di sicurezza il server dia loro. L'ordine dipende da quanto ciascuna è diffusa, non dalla robustezza. Alcuni server non riescono ad aprire un canale con `Aes256_Sha256_RsaPss` e chiudono la connessione senza dire perché, quindi viene usata solo quando un dispositivo la indica.
- **Se nulla corrisponde, l'errore elenca ciò che il server offre davvero**, con la politica e l'id della politica di token di ogni endpoint, così la configurazione si può correggere dal solo messaggio.

#### Il certificato del client

Ogni modalità protetta richiede un certificato di applicazione. Se il dispositivo indica un `certFile` e un `keyFile`, vengono usati così come sono, dopo i controlli (RSA, almeno 2048 bit, non scaduto). Altrimenti ne viene generato uno autofirmato al primo utilizzo e conservato nella directory PKI: RSA-2048, cinque anni, l'URI di applicazione `urn:hotloop:client:<host name>` nei nomi alternativi del soggetto, la chiave con modo `0600`, il certificato con modo `0644` e le directory con `0750`. La struttura rispecchia quella del server OPC UA:

```
own/cert.pem, own/key.pem   this client's certificate
trusted/                    server certificates an operator has approved
rejected/                   server certificates the driver turned away
```

Non viene rigenerato a un avvio normale, quindi a un server a cui è stato detto di fidarsi non viene detto di nuovo. Viene sostituito, con un avviso che ogni server deve approvare quello nuovo, solo se non si può leggere, non è RSA di almeno 2048 bit o gli restano meno di 30 giorni. I dispositivi che partono nello stesso momento condividono un certificato invece di scriverne ciascuno uno proprio.

La directory deve essere scrivibile e persistente. Nel chart Helm è `opcuaClient.persistence.enabled` (disattivato per impostazione predefinita, perché aggiunge un volume a un'installazione esistente); sull'edge relay è il volume `/data` esistente. Senza una directory scrivibile, un dispositivo protetto segnala un errore che indica la variabile da impostare, invece di connettersi con certificati che andrebbero persi al riavvio successivo.

Anche il **server** deve fidarsi di questo certificato, e questa è un'impostazione del server stesso. Per il server di HotLoop è lo stesso gesto: il certificato del driver compare nella directory `rejected/` del server dopo il primo tentativo rifiutato, e spostarlo in `trusted/` lo approva. Quando un server chiude la connessione mentre si apre il canale protetto, che è il modo in cui molti server respingono un certificato di cui non si fidano, l'errore indica il file del certificato di questo client e la sua impronta, così l'operatore sa che cosa cercare sul server.

#### Approvare il certificato di un server

Per una modalità protetta, o per una password che deve essere cifrata con la chiave del server, **il driver non accetta qualsiasi certificato il server presenti.** Si fida del certificato solo se è fissato in `serverCertThumbprints` del dispositivo o è esattamente il certificato in `trusted/`. Qualsiasi altro viene scritto in `rejected/<thumbprint>.der` e la connessione fallisce, prima che venga inviata qualsiasi credenziale, con un messaggio come questo:

```
opcua: the server at opc.tcp://plc-01:4840 presented a certificate that is not
trusted (subject "CN=PLC01", SHA-1 thumbprint 5A6DB35A..., expires 2031-09-18).
It has been saved to /data/opcua-client-pki/rejected/5A6DB35A....der. To approve
it, first check that the thumbprint matches the one the server shows, then move
that file into /data/opcua-client-pki/trusted (the next connection attempt picks
it up; no restart is needed). Alternatively pin it by adding the thumbprint to
this device's serverCertThumbprints. Until then this device will not connect
```

Confronta l'impronta con il display del server stesso prima di approvare: quel confronto è l'intera decisione di fiducia. Poi esegui `mv` del file in `trusted/` (vengono letti sia file PEM sia DER) e il dispositivo si connette al tentativo successivo, che avviene entro l'intervallo di riconnessione del runtime. Alcuni dettagli:

- La fiducia è per il certificato esatto, non per una catena. Un server il cui certificato è emesso da una CA si approva mettendo in `trusted/` il certificato di quel server, come per uno autofirmato. Fidarsi di una CA non è supportato.
- Un certificato scaduto ma approvato da un operatore resta fidato, con un avviso nel log a ogni connessione. Rifiutarne uno che un operatore ha approvato di proposito lo spingerebbe soltanto verso `insecureSkipVerify`.
- Un file in `trusted/` che non è un certificato viene saltato e segnalato, e non rende irraggiungibili gli altri server approvati.
- `rejected/` contiene al massimo 256 file, quindi un server che presenta un certificato diverso a ogni connessione non può riempire il disco. Oltre questo limite la connessione viene comunque rifiutata, e il messaggio dice che il file non è stato conservato e come approvare comunque il certificato.
- `insecureSkipVerify` disattiva il controllo. Una parte lungo il percorso può allora impersonare il server e leggere ciò che gli viene inviato, password compresa. È disattivata per impostazione predefinita e avvisa, con l'impronta del certificato, a ogni connessione.

Un dispositivo anonimo su un canale non protetto non ha bisogno di nulla di tutto ciò, perché nulla viene firmato o cifrato con la chiave del server.

#### Credenziali

Una password viene rifiutata, prima di essere inviata, a meno che il canale sia protetto e qualcosa cifri la password. Ciò che il driver decide, in base a ciò che il server offre per l'endpoint scelto:

| Canale | Politica di token con nome utente del server | Risultato |
|---|---|---|
| `SignAndEncrypt` | cifra la password (il caso consueto) | si connette |
| `SignAndEncrypt` | non la cifra | si connette: il canale cifrato la trasporta, e il log lo dice |
| `Sign` | cifra la password | si connette |
| `Sign` | non la cifra | **rifiutato** salvo `allowInsecureCredentials`. `Sign` autentica i messaggi ma non li nasconde. |
| `None` | cifra la password | **rifiutato** salvo `allowInsecureCredentials`. Su un canale non protetto la chiave con cui la password è cifrata proviene da una risposta che nulla autentica, quindi chiunque possa alterare il traffico può recuperarla. Con l'opt-in si connette, con un avviso. |
| `None` | non la cifra | **rifiutato** salvo `allowInsecureCredentials` |

**Un nome utente su `securityMode` `None` viene rifiutato anche quando la politica di token del server cifra la password.** Una cifratura la cui chiave può essere scelta da un attaccante non protegge da quell'attaccante, e su un canale non protetto il certificato con cui la password è cifrata viene preso dalla risposta del server a `CreateSession`, che nulla autentica (il test qui sotto sostituisce un certificato e recupera la password). L'errore lo dice e indica la soluzione, `securityMode` `SignAndEncrypt`. Le sessioni anonime non sono interessate.

`allowInsecureCredentials` è l'unico interruttore che lascia partire una password a queste condizioni. È disattivato per impostazione predefinita e avvisa a ogni connessione quando è ciò che l'ha consentita. Quando la politica di token cifra la password, cambia ciò che può leggere chi ascolta, non ciò che può chi altera il traffico: vedi [che cosa transita sulla rete](#che-cosa-transita-sulla-rete). Anche con esso, il certificato del server deve essere approvato prima quando la password è cifrata con esso.

La password è un segreto ovunque il driver e l'API la gestiscano:

- **Risposte dell'API.** Viene sostituita da `[redacted]` in ogni risposta che restituisce un dispositivo (`GET /api/devices`, `GET /api/devices/{id}` e la risposta a un salvataggio), quindi un visualizzatore, che possiede `devices.read`, non può leggerla. Dalla 4.15.1 questo vale per ogni ruolo, amministratore compreso, e per le credenziali di ogni protocollo, non solo di questo. Salvare di nuovo un dispositivo con il segnaposto mantiene la password memorizzata; un nuovo valore la sostituisce; una stringa vuota la cancella; il segnaposto per un dispositivo senza password viene rifiutato invece di essere memorizzato. Omettere il campo ora la mantiene (nella 4.15.0 la cancellava). Le regole complete sono in [Autenticazione e utenti](/it/iot/authentication/#le-credenziali-dei-dispositivi-sono-in-sola-scrittura). L'editor dei dispositivi dell'interfaccia web mostra la configurazione come la restituisce l'API e salva ciò che mostra, cosa che questo gestisce, quindi modificare un dispositivo non ne fa perdere la password. (I test lo esercitano tramite l'API, non tramite un browser.)
- **Log ed errori.** Né le righe di log del driver né alcun errore che restituisce portano la password: i messaggi sono costruiti a partire da codici di stato e dalle impostazioni non segrete del dispositivo. I test catturano il log del processo, il log del server e gli errori, e vi cercano la password.
- **Strumenti e risorse MCP, il flusso di eventi in tempo reale, il log di sistema.** Nessuno restituisce la configurazione di un dispositivo (ciascuno descrive un dispositivo con un insieme fisso di campi), e i test chiamano ogni strumento e risorsa, aprono il flusso e leggono il log di sistema con una password configurata, e non la trovano da nessuna parte.
- **Il database e i backup.** La password è memorizzata nella colonna `config` del dispositivo, come quelle degli altri driver. Fino alla 4.16.0 è in chiaro, e un backup la contiene. Dalla 4.17.0 è cifrata con una chiave conservata fuori dal database (vedi "Encrypted at rest" più avanti), quindi un dump o un backup contiene testo cifrato. In entrambi i casi, vedi [Backup e ripristino](/it/iot/backup/#proteggere-i-file-di-backup) e proteggi il database e il volume dei backup di conseguenza.
- **L'edge relay.** Anche un file di dispositivo porta la password. Nel chart Helm, metti un file di dispositivo con credenziali in un Secret e indicalo in `devicesSecret`; i dispositivi impostati direttamente nei valori del chart finiscono in una ConfigMap. Un file di dispositivo inviato con fleet config push viene pubblicato, retained, su un topic MQTT, quindi il broker deve usare TLS e limitare chi può leggere quel topic.

Una password errata dà un errore chiaro, in un solo tentativo, senza blocchi e senza nuovi tentativi dentro il driver:

```
opcua: authentication rejected: the server at opc.tcp://plc-01:4840 rejected the
user name and password for "svc-hotloop" (StatusBadUserAccessDenied). ...
```

Il runtime attende poi **dieci minuti** (con variazione casuale tra cinque e dieci) prima del tentativo successivo, invece di salire lungo il suo consueto backoff di riconnessione (`HOTLOOP_RECONNECT_MAX`, 60 secondi per impostazione predefinita). Due cose rendono un accesso rifiutato più costoso da ripetere di un guasto di rete. Un server che blocca un account dopo pochi errori trasforma ogni nuovo tentativo rapido in un'interruzione per chiunque usi quell'account. E ogni accesso rifiutato può lasciare una **sessione creata e mai attivata** sul server, che conta nel suo limite di sessioni finché non scade (la libreria ne chiede venti minuti; `sessionTimeoutMs` la cambia): contro il server di HotLoop stesso, un dispositivo con password errata che riprovava ogni pochi secondi ha riempito il suo limite predefinito di venti sessioni, dopodiché il server ha rifiutato ogni altro client con `BadTooManySessions`. Un controller con una piccola tabella di sessioni è ancora più esposto. Il dispositivo non smette di riprovare, quindi un server la cui password viene corretta dal suo lato si riprende entro dieci minuti senza che nessuno tocchi HotLoop; correggere la password sul dispositivo, o spegnerlo e riaccenderlo, avvia un nuovo worker, che prova subito.

#### Che cosa transita sulla rete

Misurato, non ragionato: i test mettono un proxy registratore tra il driver e un server e cercano ogni byte in entrambe le direzioni. La ricerca trova byte che si sa essere presenti (l'elenco degli endpoint del server, inviato in chiaro), il che dimostra che il proxy ha registrato la conversazione.

| Configurazione | Password | Nome utente | ID dei nodi e valori dei tag |
|---|---|---|---|
| `SignAndEncrypt` | non visibile | non visibile | non visibile |
| `Sign` | non visibile (la politica di token la cifra) | **leggibile** | **leggibile** |
| `None`, nome utente, la politica di token del server cifra (richiede `allowInsecureCredentials`) | non visibile | **leggibile** | **leggibile** |
| `None`, anonimo | non applicabile | non applicabile | **leggibile** |
| un server che offre una password non cifrata, con `allowInsecureCredentials` | **leggibile** | **leggibile** | dipende dalla modalità |

L'ultima riga è provata contro un server che in realtà non offre questo: una parte davanti a un server reale riscrive il suo elenco di endpoint per dire che la password non è cifrata, sul canale usato dalla scoperta, che nulla autentica. È anche così che i test mostrano il rifiuto: senza l'opt-in il driver rifiuta, apre solo la connessione di scoperta e nessuna credenziale è sul filo. L'elenco degli endpoint è esattamente ciò che una parte lungo il percorso può riscrivere, ed è per questo che la regola del driver si applica a ciò che gli viene detto e non è lasciata al server perché la faccia rispettare.

Un canale non protetto con una password ha un limite che la tabella non mostra e che un test mostra; è il motivo per cui il driver rifiuta quella combinazione senza l'opt-in. La password è cifrata con il certificato del server, il che la tiene lontana da chi ascolta, e il driver non la invierà finché quel certificato non è approvato. Ma il certificato con cui la libreria OPC UA cifra è quello nella risposta del server alla creazione della sessione, e su un canale non protetto quella risposta non è autenticata. Una parte in grado di alterare il traffico vi inserisce il proprio certificato, e la password è allora cifrata con la chiave di quella parte: il test lo fa, decifra la password con la chiave sostituita e la ottiene. **Su `Sign` o `SignAndEncrypt` la stessa parte non può**, perché la risposta è protetta da chiavi che non possiede. Senza `allowInsecureCredentials` il driver si rifiuta di inviare la password, e il test mostra che la stessa parte non ottiene allora nulla; con esso, il driver avvisa a ogni connessione. Usa `SignAndEncrypt` ovunque il server lo offra; un canale non protetto con una password, abilitato con l'opt-in, protegge da chi ascolta e nulla più.

#### Riconnessione

La riconnessione propria della libreria OPC UA è disattivata, e il runtime si riconnette. La libreria, una volta persa la sessione, ne apre una nuova con le credenziali che le sono state date e, quando il server le rifiuta, riprova subito senza alcun ritardo: sono stati misurati circa venti accessi rifiutati in dodici secondi, contro un server la cui password era cambiata. È così che un account viene bloccato per tutti quelli che lo condividono. Ora una sessione persa fa segnalare un errore a `Poll`, il worker del runtime chiude il driver e ne apre uno nuovo, e il nuovo scopre gli endpoint, controlla il certificato del server e accede di nuovo, con il backoff a variazione casuale del runtime e l'attesa di dieci minuti dopo un errore di autenticazione. Un riavvio del server viene superato allo stesso modo: il dispositivo legge il nuovo valore dopo il riavvio, avendo effettuato di nuovo l'accesso, cosa che i test verificano contando gli accessi del server e cambiando il valore dopo il riavvio.

Un dispositivo senza tag non ha nulla da leggere, e fino alla 4.15.2 questo significava che la sua interrogazione non inviava assolutamente nulla. Il server chiudeva la sessione inattiva alla scadenza del suo timeout di sessione, il dispositivo continuava a dirsi connesso perché nessuno aveva chiesto nulla al server, e ogni esplorazione falliva con `BadSessionIDInvalid` finché il processo non veniva riavviato. È il caso di ogni dispositivo nell'istante esatto in cui qualcuno lo aggiunge e fa clic su Scopri i tag. Ignition l'ha individuato. Ora un dispositivo senza tag legge lo stato del server a ogni interrogazione, il che mantiene viva la sessione e si accorge di quando muore, e un'esplorazione che trova la sessione scomparsa lo segnala perché il runtime si riconnetta.

Un tag che non è cambiato da prima dell'inizio della sessione ora legge il suo valore corrente con buona qualità. Prima, la lettura segnaposto segnalata in attesa del primo valore era più recente del timestamp di origine del valore stesso, e il runtime conserva la lettura più recente e scartava il valore, quindi un tag stabile risultava errato finché non cambiava di nuovo.

#### Che cosa è stato provato, e che cosa no

OPC UA è stato eseguito contro Ignition 8.3.9 e contro server OPC UA indipendenti, con accesso anonimo e con nome utente e password su `None`, `Sign` e `SignAndEncrypt`, e su hardware reale il 2026-11-17. Ogni server di produzione ha le proprie abitudini su quali politiche offre e su come respinge un certificato, quindi tratta una prima connessione al server di un nuovo produttore come una messa in servizio.

Da sapere:

- Ogni connessione ora chiede prima al server i suoi endpoint, e un dispositivo senza opzioni di sicurezza ha bisogno di un endpoint non protetto che elenchi una politica di token anonimo con un id. Un server che accettava sessioni anonime senza elencarne una viene rifiutato con un errore che elenca ciò che offre.
- L'autenticazione utente con certificato X.509 e con token emesso non è implementata per il driver. Il `certFile` di un dispositivo è il suo certificato di applicazione.
- La fiducia è per il certificato esatto. Fidarsi di un'autorità di certificazione e la revoca dei certificati non sono supportate.
- Le politiche di sicurezza a curve ellittiche non sono supportate, e nemmeno i server che rifiutano la scoperta su un canale non protetto.
- Un percorso di rete che cade senza che nessuna delle due estremità veda la chiusura lascia il dispositivo sugli ultimi valori finché il sistema operativo non rinuncia alla connessione.
- Alcuni server non riescono ad aprire un canale con `Aes256_Sha256_RsaPss`.
- Il server di HotLoop stesso accetta password fino a 72 byte. Un altro server può avere un proprio limite.

#### Ignition 8.3

Verificato contro **Ignition 8.3.9**, l'attuale versione stabile, nell'immagine di container di Inductive Automation: il driver di HotLoop come client, il server OPC UA di Ignition dall'altra parte, `Basic256Sha256` con `SignAndEncrypt`, con accesso tramite nome utente e password. Browse ha trovato i tag di Ignition sotto `nsu=urn:inductiveautomation:ignition:opcua:tags`, e i tag `[System]/Gateway` di orologio, CPU, memoria e uptime sono stati importati e letti con buona qualità, inviati per sottoscrizione.

Un gateway Ignition 8.3 di serie ti fermerà quattro volte prima che HotLoop possa dire una parola:

1. **Il suo server OPC UA ascolta solo su localhost.** Di fabbrica, la 8.3 associa la porta 62541 a `localhost`, quindi un HotLoop situato altrove riceve connessione rifiutata e nient'altro. Nel Gateway, nelle impostazioni del server OPC UA, imposta Bind Addresses su `0.0.0.0`. Abbiamo anche aggiunto a Endpoint Addresses il nome host che HotLoop contatta; se il driver ne abbia bisogno non è stato provato.
2. **I tag non sono su OPC UA per impostazione predefinita.** Attiva Expose Tag Providers, o tutto ciò che trova un'esplorazione sono la diagnostica del server stesso e le cartelle dei dispositivi.
3. **Certificati, in entrambe le direzioni.** HotLoop rifiuta il certificato di Ignition finché non lo approvi, come sopra. Ignition rifiuta quello di HotLoop finché non ti fidi di esso nei certificati del server OPC UA del Gateway. Su disco significa spostarlo da `data/config/local/com.inductiveautomation.opcua/server/security/pki/rejected/certs` a `.../trusted/certs`, senza riavvio. **Ignition non dà a quel file il nome dell'impronta SHA-1 che HotLoop registra.** Apri il certificato e confronta la sua impronta digitale; il nome del file non corrisponderà e questo non è segno di un impostore.
4. **L'accesso OPC UA è `opcuauser` / `password`** nella sorgente utenti `opcua-module`, a ogni installazione nuova. Cambialo prima che si connetta qualcosa di reale.

In questa direzione è stato esercitato solo ciò che il server della 8.3 offre di fabbrica: `Basic256Sha256` e `SignAndEncrypt`.

**Anche l'altra direzione è verificata: il client OPC UA di Ignition 8.3.9 legge il server OPC UA di HotLoop**, con accesso come visualizzatore HotLoop, su ogni politica e modalità di sicurezza che Ignition offre. La configurazione, la fiducia dei certificati in entrambe le direzioni, le trappole e la matrice delle politiche sono in [Il server OPC UA](/it/edge/opc-ua-server/#ignition-83-come-client). Ha trovato due bug di HotLoop, entrambi corretti: il server generava un nuovo certificato ogni volta che il suo container veniva ricreato, il che rompeva la fiducia di Ignition dopo ogni aggiornamento, e Scopri i tag dichiarava ogni tag come float, quindi un tag di testo arrivava a Ignition come `Bad_TypeMismatch` (sopra).

Il nodo edge Sparkplug di HotLoop e l'Edge Relay contro l'MQTT Engine di Ignition sono i prossimi, e non sono fatti.

### OPC UA PubSub (UADP)

L'altro OPC UA: non un client che interroga un server, ma un publisher che invia DataSet come datagrammi UDP a chiunque ascolti, unicast o multicast (OPC 10000-14, la codifica UADP). HotLoop si sottoscrive, come dispositivo, e pubblica, come impostazione.

**Sottoscrivere.** Aggiungi un dispositivo con il protocollo `opcua-pubsub`. L'indirizzo è dove ascoltare: `udp://239.0.0.1:4840` si unisce a un gruppo multicast, `udp://:4840` ascolta in unicast. L'indirizzo di un tag è `<DataSetWriterId>/<field index>`, la posizione del campo nel DataSet del publisher contando da 0: `1000/3` è il quarto campo che pubblica il writer 1000. UADP non porta nomi di campo (vivono in un DataSetMetaData che il publisher serve in altro modo, o non serve affatto), quindi la posizione è ciò che un datagramma può dire. Un campo che è un array viene letto un elemento alla volta: `1000/3[17]` è il diciottesimo valore dell'array che è il quarto campo. Browse elenca i campi uditi, con i loro tipi, e un array come i suoi elementi (i primi 1000).

```json
{"publisherId":"2234","writerGroupId":100,"interface":"eth0","timeoutMs":30000,
 "dataSets":[{"writerId":62541,"types":["Float","UInt16","Boolean","Int32","Double"]}]}
```

- `publisherId` e `writerGroupId` limitano un dispositivo a un publisher e un gruppo. Vuoto e zero accettano tutto. È così che più dispositivi condividono un indirizzo: un publisher che invia due WriterGroup a `udp://:4840` corrisponde a due dispositivi lì, uno con `"writerGroupId":1` e uno con `"writerGroupId":2`.
- I dispositivi possono condividere indirizzo e porta. HotLoop apre un socket per esso (un'unica adesione, per un gruppo multicast su una scheda) e consegna ogni datagramma a ogni dispositivo che vi si trova. Ogni dispositivo applica poi i propri `publisherId`, `writerGroupId` e `dataSets`, quindi ciascuno vede l'intero flusso del suo publisher e nessuno viene diviso tra dispositivi. Il socket si chiude quando l'ultimo dispositivo che lo usa viene rimosso o fermato, e il successivo che parte lo riapre. I dispositivi sono abbinati sull'indirizzo come scritto: `udp://:4840`, `udp://0.0.0.0:4840` e `udp://[::]:4840` sono tre indirizzi per HotLoop, e se possano coesistere dipende dal sistema operativo, come sempre. Un gruppo multicast a cui ci si unisce su due schede diverse sono due socket. Nulla cambia per un dispositivo da solo sul suo indirizzo.
- Il gruppo, la porta e la scheda sono del dispositivo: nulla è fisso in HotLoop. `udp://239.192.0.1:4850` con `"interface":"eth0"` si unisce a quel gruppo su quella scheda, e `udp://127.0.0.1:4842` ascolta un publisher sulla stessa macchina. Più dispositivi possono ascoltare contemporaneamente su gruppi e porte diversi, o sullo stesso.
- `interface` è la scheda di rete su cui ci si unisce a un gruppo multicast, per nome (`eth0`, `lo`) o per uno dei suoi indirizzi IPv4 (`127.0.0.1`). Una macchina con più di una scheda ne ha bisogno. Un publisher sulla stessa macchina che invia a un gruppo via loopback (`IP_MULTICAST_IF` 127.0.0.1, TTL 0, loopback attivo, nessuna rotta) viene sentito da un dispositivo con `"interface":"lo"` o `"127.0.0.1"`; senza interfaccia indicata e senza rotta, l'adesione fallisce con `no such device` e lo dice.
- `dataSets` serve solo per RawData, che non porta tipi sul filo: i tipi di campo del publisher, in ordine, così i byte si possono leggere. I messaggi Variant e DataValue portano i propri. Ogni voce è un nome di tipo (`"Float"`), e può anche dire come è disposto un blocco di valori: `"Float*250"` sono 250 campi uno dopo l'altro senza lunghezza davanti, come scrive un PLC che invia un blocco di REAL come campi separati; `"Float[250]"` è un campo array di al massimo 250 valori, scritto come lo scrive lo stack della OPC Foundation per un array RawData (un conteggio Int32, i valori e zeri di riempimento fino a 250); e `"String(40)"` è una String riempita fino a 40 byte, da sola o come `"String(40)[4]"`.
- I key frame sostituiscono i campi di un DataSet; i delta frame cambiano quelli che nominano; i keep alive dimostrano che il publisher è vivo. Un messaggio perso (un buco nei numeri di sequenza) segna i tag di quel DataSetWriter come **incerti** fino al suo key frame successivo, dato che un delta potrebbe essersi perso con esso. Un cambiamento nella versione di configurazione del DataSet fa dimenticare ogni campo finché un key frame non dice che cosa significano ora.
- Un writer silenzioso per `timeoutMs` (30 secondi se non impostato) risulta **errato** con questa indicazione, e un dispositivo da cui non si è sentito nulla dal suo publisher entro il timeout è inattivo. Un campo che il publisher segna come Bad è errato, e uno che segna come Uncertain è incerto; il motivo è il codice di stato.
- L'ora della lettura è quella del publisher, presa dal campo, dal DataSetMessage o dal NetworkMessage, quando è impostata e non supera di più di un minuto questo orologio, e l'ora di arrivo altrimenti.
- Gli array vengono letti nei messaggi Variant e DataValue (un conteggio Int32 e i valori, OPC 10000-6 5.2.2.16; uno multidimensionale arriva appiattito, riga per riga) e, con un layout, in RawData. Un conteggio che il datagramma non può contenere viene rifiutato prima che venga creato qualcosa per esso.
- Sola lettura. La sicurezza dei messaggi (NetworkMessage firmati o cifrati), i messaggi frammentati, i messaggi di scoperta, gli eventi e i campi di struttura non sono supportati; un datagramma che ne contiene uno viene rifiutato, contato per motivo e mai indovinato.

**Pubblicare.** Disattivato finché non è impostato `HOTLOOP_UADP_PUBLISH_ENABLED`, in Edge e Gateway (i prodotti che hanno il server OPC UA). Invia i tag che un layout indica:

```json
{"dataSets":[{"writerId":1,"name":"press","configMajor":1,"fields":[
  {"device":"press-01","tag":"Zone1_Temp","type":"Float"},
  {"device":"press-01","tag":"Cycle","type":"UInt32"}]}]}
```

| Variabile | Valore predefinito | <span class="sr-only">Dettagli</span> |
|---|---|---|
| `HOTLOOP_UADP_PUBLISH_ADDRESS` | | `udp://239.0.0.1:4840` per un gruppo multicast, `udp://host:4840` per un singolo sottoscrittore |
| `HOTLOOP_UADP_PUBLISH_LAYOUT_FILE` o `_LAYOUT` | | il layout sopra, come file o inline (vince il file) |
| `HOTLOOP_UADP_PUBLISH_PUBLISHER_ID` | `1` | un numero o un testo |
| `HOTLOOP_UADP_PUBLISH_WRITER_GROUP_ID` | `1` | |
| `HOTLOOP_UADP_PUBLISH_INTERVAL` | `1s` | |
| `HOTLOOP_UADP_PUBLISH_KEY_FRAME_EVERY` | `10` | al massimo questo numero di intervalli tra i key frame |
| `HOTLOOP_UADP_PUBLISH_DATAVALUE` | `false` | campi DataValue (valore, stato, ora) invece di Variant |
| `HOTLOOP_UADP_PUBLISH_DELTA_FRAMES` | `false` | un DataSet che è cambiato esce come delta frame (solo i campi cambiati) tra i key frame |
| `HOTLOOP_UADP_PUBLISH_METADATA_EVERY` | `10` | i nomi e i tipi dei campi di ogni DataSet vengono annunciati ogni tot intervalli; `0` non ne invia nessuno |
| `HOTLOOP_UADP_PUBLISH_INTERFACE`, `_TTL` | quella del sistema, `1` | la scheda da cui esce il multicast e il suo limite di hop |

Ogni DataSet esce sul proprio DataSetWriter, un NetworkMessage ciascuno. Un DataSet i cui valori sono cambiati esce come key frame (tutti i campi), uno che non è cambiato come keep alive, e una key frame almeno ogni `KEY_FRAME_EVERY` intervalli così che un sottoscrittore arrivato in ritardo converga. Una key frame è completa, quindi un datagramma perso costa un intervallo e non un valore sbagliato. Con `HOTLOOP_UADP_PUBLISH_DELTA_FRAMES=true` un DataSet che è cambiato esce invece come delta frame, con solo i campi cambiati dall'ultimo messaggio e le loro posizioni, e la key frame arriva comunque almeno ogni `KEY_FRAME_EVERY` intervalli; un delta perso costa allora fino a quel numero di intervalli con un campo non aggiornato, che è il prezzo di un messaggio più piccolo su un collegamento lento. Il sottoscrittore di HotLoop legge i delta frame. value. Un tag cattivo viene pubblicato come il suo stato e mai come il suo ultimo valore; uno di cui non è ancora stato letto nulla viene pubblicato come `BadWaitingForInitialData`. I valori sono limitati al loro tipo pubblicato, non riavvolti. La sicurezza dei messaggi non è supportata, quindi questo va su una rete di cui lo stabilimento si fida. I tag della stessa disposizione possono essere letti dal sottoscrittore di HotLoop su un'altra macchina.

**Cosa è stato provato.** Uno stack OPC UA PubSub indipendente pubblica verso il sottoscrittore di HotLoop e si sottoscrive al publisher di HotLoop in multicast, e il publisher di HotLoop viene letto correttamente dal sottoscrittore di HotLoop. **Sicurezza dei messaggi.** Un dispositivo sottoscrittore può richiedere che i NetworkMessage del suo publisher siano firmati, oppure firmati e cifrati (OPC 10000-14 7.2.4.4.3), con le due policy che la specifica definisce, `PubSub-Aes128-CTR` e `PubSub-Aes256-CTR`:

```json
{"publisherId":"2234","security":{"mode":"signAndEncrypt","policy":"PubSub-Aes128-CTR",
 "keys":[{"keyId":1,"signingKey":"<64 hex digits>","encryptingKey":"<32 hex digits>","keyNonce":"<8 hex digits>"}]}}
```

Le chiavi sono statiche: impostate da entrambe le parti sotto un SecurityTokenId (`keyId`), in esadecimale o base64. Sono segreti, mostrati come `[redacted]` e mantenuti al salvataggio. Un dispositivo che tiene due chiavi accetta un publisher che passa dall'una all'altra. Con `security` impostato, un messaggio non firmato (o non cifrato, sotto `signAndEncrypt`), firmato con un'altra chiave o modificato lungo il percorso viene rifiutato e contato (`unsecured`, `signature`, `security_key`) prima che se ne legga qualcosa. Un Security Key Service (GetSecurityKeys, chiavi a rotazione) non è implementato. Il publisher firma con `HOTLOOP_UADP_PUBLISH_SECURITY_MODE` (`sign` o `signAndEncrypt`), `_POLICY`, `_KEY_ID`, `_SIGNING_KEY`, `_ENCRYPTING_KEY` e `_KEY_NONCE`.

**Metadati e scoperta.** Un publisher annuncia come si chiamano i suoi DataSet e di cosa sono fatti come risposta di scoperta che porta un DataSetMetaData, a pezzi quando è grande (7.2.4.4.4, 7.2.4.6). Un dispositivo sottoscrittore li legge: i campi sono nominati in Browse (`writer1001_<field name>`), un DataSet RawData non ha bisogno di tipi `dataSets` nella configurazione perché i metadati lo dispongono, e un DataSet che cambia la sua versione di configurazione riparte dalla sua prossima key frame. I `dataSets` della configurazione prevalgono ancora quando ci sono entrambi. La richiesta di scoperta di un sottoscrittore non viene inviata, e un publisher non ne risponde a nessuna.

**Campi struttura, eventi.** Un campo che i metadati dicono essere una struttura viene letto come i suoi membri, che un tag indirizza come `1001/0.Value` (e `1001/7[2].Angle` per un elemento di un array di strutture); una struttura inviata in un Variant viene letta quando i metadati la descrivono. Le strutture con campi opzionali e le unioni vengono segnalate per nome, non indovinate. Un DataSetMessage di Event viene applicato come i campi che porta e lascia in pace il resto (`Events` nelle statistiche del dispositivo); la sua disposizione è quella di una key frame (7.2.4.5.7), letta dalla specifica e non verificata contro un altro stack. Alcuni publisher scrivono un FieldCount prima di una key frame RawData, cosa che la specifica non fa; al dispositivo lo si dice con `"rawFieldCount":true`.

### CODESYS

Un PLC che esegue un runtime CODESYS Control (Linux SL, ARM64, Raspberry Pi, Windows, il PLC virtuale), letto e scritto con i nomi che il suo programmatore ha dato alle variabili: `Application.GVL_Line.rTemp`, non un id di nodo. È il driver OPC UA con ciò di cui un PLC CODESYS ha bisogno in più, quindi tutto ciò che sta in [OPC UA: sicurezza e credenziali](#opc-ua-sicurezza-e-credenziali) vale per esso e le sue opzioni sono quelle opzioni.

**Gli allarmi propri del PLC.** Un progetto con una Alarm Configuration tiene i suoi allarmi nell'alarm manager del PLC. Con il blocco della libreria HotLoop Alarms nel progetto (vedi CODESYS alarms), HotLoop mostra quegli allarmi nel suo elenco allarmi, dal momento in cui il dispositivo è connesso, e un riconoscimento fatto in HotLoop torna all'alarm manager. Verificato dal vivo contro un vero runtime CODESYS Control for Linux SL 4.22.0.0: scatto, riconoscimento, ripristino e conferma. Le liste di testo proprie dell'alarm manager e una classe diversa dalle due provate non sono verificate.

**Perché il server OPC UA, e che cosa significa per il PLC.** CODESYS documenta un solo modo per una terza parte di leggere le variabili di un controller, ed è il server OPC UA del runtime stesso: la Symbol Configuration dell'applicazione (o, da CODESYS 3.5 SP18, un IEC Symbol Set sotto il Communication Manager) dice quali variabili sono pubblicate e con quale accesso, e il server le serve. Il protocollo di canale del CODESYS Gateway non è documentato per terze parti e questo driver non lo parla. Quindi il PLC deve pubblicare ciò che vuoi vedere:

1. Nell'IDE aggiungi una **Symbol Configuration** all'applicazione, con *Support OPC UA features* attivo, e spunta le variabili, oppure contrassegnale nella dichiarazione con `{attribute 'symbol' := 'readwrite'}` (`'read'` per la sola lettura).
2. Scarica. Un PLC senza Symbol Configuration risponde alla configurazione con un messaggio che dice di aggiungerne una.
3. Una variabile è scrivibile da HotLoop solo quando il suo simbolo è `readwrite` e l'utente con cui si connette ha il permesso di scriverla (i *Symbol Rights* del dispositivo). HotLoop legge il livello di accesso e dice quale dei due ha rifiutato una scrittura.

Fonti: [CODESYS help, Symbol Configuration](https://content.helpme-codesys.com/en/CODESYS%20Communication/_cds_symbolconfiguration.html) e [IEC Symbol Set](https://content.helpme-codesys.com/en/CODESYS%20Communication/_comm_symbol_configuration.html) (il nome del simbolo è `<application>.<POU>.<variable>`, l'accesso è lettura, scrittura o esecuzione per simbolo, i diritti dei gruppi sono nella scheda Symbol Rights del dispositivo, e OPC UA richiede un certificato sul controller); il [PLCopen OPC UA information model for IEC 61131-3](https://plcopen.org/system/files/downloads/plcopen_opc_ua_information_model_for_iec61131-3_version1.02.pdf) (versione 1.02, il layout sotto); OPC UA Part 5 (OperationLimits). Gli id di nodo sono quelli a cui ha risposto un runtime 4.22.0.0, contro il quale questo driver è stato scritto; la grafia esatta di `|var|` è del runtime, non un contratto pubblicato, ed è per questo che un tag è indirizzato per simbolo e il driver costruisce l'id di nodo.

**Layout.** Il runtime pubblica, nel `DeviceSet` di OPC UA Device Integration, un dispositivo per il PLC, `Resources` sotto di esso, e l'applicazione sotto ancora, con `GlobalVars` (le liste di variabili) e `Programs` al di sotto. Il nodo di una variabile è `ns=<n>;s=|var|<device>.<application>.<list or program>.<variable>` nello spazio dei nomi `CODESYSSPV3/3S/IecVarAccess`. Il driver trova dispositivo e applicazione esplorando, quindi un tag sopravvive alla ridenominazione del progetto.

**Indirizzi.** Un simbolo IEC, con o senza l'applicazione:

```
Application.GVL_Line.rTemp        a variable of a variable list
GVL_Line.rTemp                    the same; the application is assumed
Application.PLC_PRG.nCount        a program's variable
GVL.motors[2].speed               a field of an element of an array of structures
nsu=CODESYSSPV3/3S/IecVarAccess;s=|var|CODESYS Control for Linux SL.Application.GVL.x
                                  a node id, if you have one
```

**Scopri i tag** elenca ciò che l'applicazione esporta, con i tipi che ha: una STRING è `string`, un BYTE `uint16`, un TIME `int64` (millisecondi), un'enumerazione `int32`, le larghezze intere mantengono la propria, REAL e LREAL sono `float`. Il runtime dichiara una STRING, un BYTE o un TIME come tipo del modello PLCopen (ad esempio `ns=3;i=3013`); il driver segue i suoi riferimenti `HasSubtype` fino al tipo standard di cui è una specie, ed è anche così che una scrittura su un BYTE viene inviata come Byte. Ogni variabile porta l'accesso dato al suo simbolo. Una struttura e un array vengono percorsi: un punto per campo e per elemento. Esclude le proprietà del runtime (`|vprop|`), l'elenco dei task e l'oggetto Server.

Un array elenca i suoi primi 32 elementi (`arrayElements`), perché un buffer di mille elementi non è mille cose per una dashboard, e un tag può comunque indirizzare qualsiasi elemento tramite il suo simbolo. L'elenco si ferma a `browseMaxNodes` e lo dice; `browseRoot` impostato su un simbolo (`Application.GVL_Demo`) elenca una parte dell'applicazione. L'esplorazione è in ampiezza, quindi le variabili di una lista vengono prima degli elementi dei suoi array, e le risposte sono mantenute a una dimensione che il runtime accetta (chiude la connessione davanti a una risposta di cento array da mille elementi).

Configurazione: le opzioni OPC UA, e `device` (il nome del PLC, solo se il runtime ne elenca più di uno), `application` (solo se nessuna si chiama Application), `arrayElements`, `alarmSymbol` (il blocco HotLoop Alarms, solo per saltarne la ricerca). Un'opzione scritta male è un errore che elenca quelle valide. La password è un segreto, memorizzata e oscurata come ogni segreto di dispositivo.

**Che cosa il runtime chiede a un client.** Pubblica `OperationLimits` di 100 per letture, esplorazioni ed elementi monitorati per richiesta, e rifiuta una richiesta più grande con `BadTooManyOperations`. Il driver legge quei limiti alla connessione e riduce ogni richiesta a essi, per ogni dispositivo OPC UA (un runtime CODESYS è stato il primo per cui è contato: prima di questo il driver segnalava ogni tag scoperto come float e non leggeva nessuno dei tag di un dispositivo con più di 100). Il campionamento è di un secondo per impostazione predefinita e la coda di un elemento, perché un PLC ha un ciclo da rispettare e un gateway Ignition che già lo legge non dovrebbe vederselo togliere; imposta `samplingIntervalMs` per chiederne di più.

**Download, riavvii e collegamento perso.** Un riavvio del runtime, o il caricamento di un nuovo programma, fa cadere la sessione. Il dispositivo passa a disconnesso, ogni tag risulta errato con il motivo "il runtime del PLC non risponde", e HotLoop si riconnette da solo con backoff e legge i simboli come sono ora. Un simbolo che veniva letto e viene rifiutato come scomparso due volte di seguito è preso per un download in cui il runtime ha mantenuto la sessione, e la sessione viene abbandonata per la stessa riconnessione. Un tag per una variabile che il programma non ha risulta errato con il motivo del server e non provoca una riconnessione.

**Proteggere il server OPC UA del runtime.** Un runtime CODESYS Control offre solo endpoint non protetti finché il suo server OPC UA non ha un certificato, e poi offre anche le politiche della sua `CommunicationPolicy` (AES128-SHA256-RSAOAEP per impostazione predefinita, Basic256Sha256, AES256-SHA256-RSAPSS) con Sign e SignAndEncrypt. CODESYS documenta come creare quel certificato nella Security Screen (CODESYS Security Agent, Devices, il controller, OPC UA Server) e come fidarsi di un client spostando il suo certificato da "Certificates in Quarantine" a "Trusted Certificates". La PLC shell del runtime Linux fa lo stesso senza l'IDE, con comandi che CODESYS elenca per la PLC shell dell'editor dei dispositivi (`cert-getapplist`, `cert-genselfsigned <n>`, `cert-getcertlist quarantine`, `cert-export`, `cert-import trusted`), tramite il socket Unix che il runtime Linux documenta per questo (`/var/opt/codesyscontrolapi/plcshell.sock`, "Accessing the PLC Shell"). Imposta il dispositivo su `securityMode` `SignAndEncrypt` con un `securityPolicy`, connettiti una volta (il certificato di HotLoop finisce nella quarantena del runtime e la connessione viene rifiutata, con un messaggio che lo dice), fidati di quel certificato e il dispositivo legge. Non mostrati: la Security Screen dell'IDE, un certificato firmato da una CA, la gestione utenti con un runtime protetto.

**Un runtime senza licenza si ferma da solo.** Un runtime CODESYS Control senza licenza gira in modalità demo e si arresta dopo circa due ore (il log del runtime dice `no runtime license - running in demo mode(~2 hours)` a ogni avvio). Dal lato di HotLoop è un riavvio del runtime come un altro: il dispositivo passa a disconnesso con "il runtime del PLC non risponde" e torna da solo quando qualcosa riavvia il runtime (la politica di riavvio di un container, un'unità systemd). Nulla in HotLoop conta le due ore né tratta l'arresto in modo diverso, e nulla riavvia il runtime al posto tuo; un runtime che non viene riavviato resta disconnesso. Provato con un runtime 4.22.0.0 in un container senza licenza: si è fermato da solo 2 ore e 5 minuti dopo l'avvio, con codice di uscita 0; la politica di riavvio del container lo ha riavviato 31 secondi dopo, la sua applicazione era in esecuzione 82 secondi più tardi, e il dispositivo ha letto di nuovo correttamente 35 secondi dopo l'avvio dell'applicazione (2 minuti e 28 secondi dall'arresto), senza alcun intervento manuale.

**Scritture.** Un tag è in sola lettura finché qualcuno non lo segna come scrivibile, come per ogni dispositivo, e nulla di ciò che crea una configurazione lo è. Poi la porta di scrittura è quella di OPC UA, con la parte del PLC davanti: una scrittura su un simbolo esportato in sola lettura, o che l'utente non può scrivere, viene rifiutata con le parole del PLC e mai inviata.

**Configurazione dal flusso delle integrazioni** (`codesys`): l'indirizzo del runtime, le domande di sicurezza OPC UA e, facoltativamente, una prima dashboard dei punti conservati (la schermata che sarebbe stata WebVisu; vedi [Integrazioni](/it/iot/integrations/#codesys)). Verificato contro un runtime 4.22.0.0 in un container; vedi la tabella di stato per ciò che questo non copre.

### Modbus TCP/RTU

Il cavallo di battaglia del 1979. PLC, inverter, misuratori di energia, RTU, e il ripiego di ogni gateway che non ha niente di meglio.

```
holding:100:float32:CDAB    a float across registers 100-101, word-swapped
holding:40:bit3             bit 3 of register 40
holding:200:string16        16 characters from register 200
input:12:int16              a signed input register
coil:5                      a single coil
```

**L'ordine delle parole** è l'impostazione che la gente sbaglia, e un float letto con l'ordine sbagliato non è ovviamente errato su una schermata: è un numero plausibile che non è la verità. Tutte e quattro le permutazioni sono supportate con i nomi che stampano i manuali dei produttori: `ABCD`, `CDAB`, `BADC`, `DCBA`. Imposta un valore predefinito del dispositivo con `byteOrder` e sovrascrivilo per tag con il quarto campo dell'indirizzo.

**L'indirizzamento** è grezzo e a base zero. Se i tuoi schemi usano la numerazione tradizionale in stile 40001, imposta `oneBased: true` e scrivi i numeri degli schemi. Sbagliare di uno è il più vecchio bug di Modbus.

Le letture vengono unite in blocchi: registri adiacenti e quasi adiacenti diventano una sola richiesta. `maxGap` controlla quanti registri inutilizzati conviene leggere per evitare un secondo giro (8 per impostazione predefinita), `maxBlock` limita una singola richiesta (120 per impostazione predefinita, limite del protocollo 125).

Scrivere un singolo bit di un registro holding è una lettura-modifica-scrittura, perché Modbus non ha un'impostazione atomica di bit lì. Gli altri quindici bit vengono preservati.

### MQTT e Sparkplug B

MQTT semplice, o Sparkplug B come **applicazione host primaria completa**.

Topic semplici:
```
mqtt:plant/line1/temperature              a scalar payload
mqtt:plant/line1/state|data.temperature   JSON, extracted by path
mqtt:plant/+/flow                         wildcards work
```

Metriche Sparkplug:
```
spb:GroupId|EdgeNodeId|DeviceId|Metric/Name
spb:Plant|Edge1||Node/Uptime               empty device = a node-level metric
```

Come host primario il driver fa ciò che la specifica richiede e che la maggior parte delle integrazioni salta:

- Pubblica una nascita `STATE` retained con un will corrispondente, così i nodi edge vedono cadere l'host invece di dedurlo da un timeout. Forma Sparkplug 3.0 (`spBv1.0/STATE/<host>` con JSON) per impostazione predefinita; imposta `legacyState` per la stringa `ONLINE`/`OFFLINE` precedente alla 3.0.
- Tiene traccia del numero di sequenza progressivo di ogni nodo e chiede a un nodo di rinascere quando ne salta uno, perché un buco significa che dei messaggi sono andati persi e la tabella degli alias non è più affidabile.
- Richiede una rebirth dopo la propria riconnessione. Un host rimasto assente non ha idea di che cosa sia cambiato mentre non c'era.
- Abbina `NDEATH` a `NBIRTH` tramite `bdSeq`, in modo che un certificato di morte rimasto da una sessione precedente non possa uccidere quella corrente.

L'ordine dei messaggi è garantito. Consegnare i messaggi Sparkplug in modo concorrente li riordina, il che fa sembrare un nodo sano come se perdesse messaggi e provoca una tempesta di rebirth.

### EtherNet/IP (CIP)

Allen-Bradley ControlLogix, CompactLogix e Micro820. I tag hanno nomi, quindi si può chiedere al controller che cosa contiene.

```
Temperature                    type from the tag's declared dataType
Speed:dint                     an explicit type wins
Program:MainProgram.Speed      a program-scoped tag, the colon is part of the path
Zones[0].Heater.On:bool        array elements and UDT members
```

CIP è fortemente tipizzato e il controller rifiuta una lettura il cui tipo dichiarato non corrisponde, quindi il tipo deve venire da qualche parte. Viene preso dal `dataType` del tag, o da un suffisso `:type` che ha la precedenza. Lo sconosciuto ripiega su `REAL`, che è ciò che sono la maggior parte dei valori di processo.

Le letture sono raggruppate in richieste multi-servizio, con ripiego su letture singole quando un blocco fallisce, così che un percorso di tag errato non accechi gli altri diciannove.

### S7comm

Siemens S7-300, 400, 1200 e 1500, su ISO-on-TCP per rack e slot.

```
db1:0:real        a REAL at DB1.DBD0
db1:4:dint        a DINT at DB1.DBD4
db1:8.3:bool      bit 3 of DB1.DBB8
db2:20:string32   a 32-character STRING
m:10:word         merker word MW10
i:0.1:bool        input I0.1
q:2:byte          output byte QB2
```

Il tipo è obbligatorio per tutto ciò che è più largo di un byte. Il protocollo non può dirti se quattro byte sono un REAL o un DINT: è un fatto sul programma del PLC, non sul filo.

Per impostazione predefinita rack 0, slot 1 (S7-1200/1500). Gli S7-300/400 sono di solito slot 2. `connectType` è 3 per impostazione predefinita (S7 Basic) così il gateway non occupa lo slot di connessione PG che un ingegnere vuole per TIA Portal.

Non c'è esplorazione. Una CPU S7 non pubblica la struttura dei suoi blocchi dati, che vive nel progetto TIA Portal.

### MTConnect

Telemetria di macchine utensili in sola lettura. In MTConnect non c'è un canale di comando, e questo driver non finge il contrario.

Indirizza per `dataItemId` o per nome; gli agenti sono incoerenti su quale sia stabile, e la documentazione delle macchine mostra l'uno o l'altro.

Due dettagli che separano un'integrazione che funziona da una soltanto plausibile: `UNAVAILABLE` è l'agente che dice esplicitamente di non avere una lettura, diventa qualità errata, non il testo "UNAVAILABLE" e non zero. E il significato di una Condition è il nome del suo elemento (`Normal`, `Warning`, `Fault`, `Unavailable`), non i suoi dati di carattere, che di solito sono vuoti.

`Browse` legge `/probe` e percorre l'albero dei componenti a qualsiasi profondità.

### HTTP / REST

Il jolly, per misuratori di energia, sensori ambientali, controller di costruttori di apparecchiature e il lato REST di un gateway che sotto parla qualcosa di proprietario.

```
power.kw                      nested fields
readings[0].value             array indexing
zones[name=Zone1].temp        select an array element by a field value
$.data.temperature            a leading $. is accepted
```

Quella terza forma è quella che conta: queste API adorano restituire un array non ordinato di oggetti `{name, value}`, e indicizzare per posizione è un bug in attesa di un aggiornamento firmware.

Una richiesta serve ogni tag del dispositivo. `Browse` percorre il documento e segnala ogni scalare con il percorso che lo raggiunge.

### Stato di salute della macchina

La macchina su cui gira HotLoop, come dispositivo di sola lettura: `cpu_util_pct` (tempo CPU non inattivo dall'ultima lettura), `mem_util_pct` (MemTotal rispetto a MemAvailable), `disk_util_pct` (il disco della macchina, uno statfs della radice dell'host montata in sola lettura in `diskPath`, `/host` per impostazione predefinita), `data_util_pct` (il volume in `dataPath`, `/data`, o la cartella esistente più vicina sopra di essa quando lì non è ancora montato nulla), e da `rtos_jitter_core1_us` a `core3_us` quando `jitterFile` nomina il file JSON `{"core1_us":3.2,"core2_us":2.9,"core3_us":4.1}` che un agente real-time riscrive (un file più vecchio di cinque minuti si legge come cattivo). CPU e memoria vengono da `procRoot` (`/proc`, o `/host/proc` quando è montato quello dell'host). Un valore che non può essere letto ha qualità cattiva con il motivo, mai zero. Il dispositivo è creato da `HOTLOOP_BOX_HEALTH_NODE` ([Il server OPC UA](/it/edge/opc-ua-server/#stato-di-salute-della-macchina-per-la-dashboard-embernet)).

### Shelly

Uno Shelly di qualsiasi generazione con cui si parla direttamente, senza broker in mezzo. Vedi SHELLY.md. Aggiungi un dispositivo con il protocollo `shelly` e l'indirizzo del dispositivo; se ha un accesso impostato, `{"password":"..."}` (l'utente è `admin`; un dispositivo Gen2 o successivo risponde con la sua sfida di digest SHA-256 e uno Gen1 con Basic). `/shelly` dice di che generazione è. Un dispositivo Gen2, Gen3 o Gen4 viene letto con `Shelly.GetStatus` (`POST /rpc`) e ogni componente che riporta diventa tag che si aggiungono da soli, di sola lettura finché una persona non li arma: `switch:0.output`, `switch:0.apower`, `switch:0.aenergy.total`, `switch:0.temperature.tC`, `input:0.state`, `cover:0.current_pos`, `pm1:0.apower`, `em:0.total_act_power`, `temperature:100.tC`, `humidity:100.rh`, e `sys.uptime` e `wifi.rssi` del dispositivo. Un campo che il dispositivo non ha inviato non diventa un tag. L'uscita di uno switch (`Switch.Set`), l'uscita e la luminosità di una luce, la posizione di una tapparella (`Cover.GoToPosition`) e il setpoint di un termostato possono essere armati per la scrittura.

Un dispositivo Gen2 o successivo ottiene anche un websocket (`ws://<device>/rpc`): il driver invia un frame di richiesta con un `src`, come richiede la pagina del canale RPC di Shelly prima che un dispositivo notifichi, risponde a un frame 401 con l'oggetto `auth` documentato (SHA-256 su `dummy_method:dummy_uri`), e integra `NotifyStatus` e `NotifyFullStatus` nella sua copia dello stato, così una modifica raggiunge subito il tag e il polling nel mezzo legge la copia invece del dispositivo. `NotifyEvent` (la pressione di un pulsante, una modifica di configurazione) viene archiviato nel registro sotto il dispositivo. Quando il websocket è giù, o non ha confermato lo stato di recente (45 secondi senza un frame o un pong, 2 minuti senza una lettura completa), il polling legge il dispositivo via HTTP.

Un dispositivo Gen1 (`/status` e semplici percorsi di controllo GET, accesso Basic) ottiene la stessa forma di tag dalle sue stesse parole: `relay:0.output`, `meter:0.power`, `meter:0.total` (watt-minuti convertiti in Wh), `light:0.output` e `.brightness`, `roller:0.current_pos`, `input:0.state`, `temperature:0.tC`, e per contatori di energia e sensori `emeter:0.power`, `humidity:0.rh`, `flood:0.alarm`. Un relè si scrive con `/relay/<id>?turn=on|off`, una luce con `/light/<id>?turn=&brightness=`, una tapparella con `/roller/<id>?go=to_pos&roller_pos=`. Costruito dalla documentazione pubblicata di Shelly per Gen1 e Gen2 e provato contro registrazioni di dispositivi reali (un Plus 1, un Plug S e una lampadina Vintage); non ancora contro un dispositivo sul banco. I campi di contatore di energia, umidità, batteria e allagamento di Gen1 vengono dalla documentazione e non hanno nessuna registrazione dietro.

### Firmata

Un Arduino, o qualsiasi scheda che esegue un firmware Firmata, via USB seriale o TCP, senza programma host in mezzo. Vedi FIRMATA.md. Aggiungi un dispositivo con il protocollo `firmata` e la porta seriale (`/dev/ttyACM0`, `serial:/dev/ttyUSB0`) o `host:port`; opzioni `{"baudRate":57600,"samplingMs":19,"bootWaitMs":5000}`. Il driver attende la versione del protocollo della scheda (chiedendola ogni 300 ms), ne interroga firmware, capacità e mappa analogica, e crea un tag di sola lettura per ogni pin digitale e ingresso analogico della scheda. L'indirizzo di un tag dice cosa fare con un pin: `D13`, `D2:in`, `D2:pullup`, `D13:out`, `D9:pwm`, `D10:servo`, `A0`, `I2C:0x48:0x00:2`. L'ingresso digitale è il report di porta che la scheda invia a un cambiamento, l'analogico è il report di ogni intervallo di campionamento, e ogni polling chiede la versione del protocollo così una scheda sparita si vede entro un polling; un report di firmware che arriva non richiesto è una scheda che si è riavviata. Un pin che i tag non menzionano non viene toccato, e un semplice tag `D<n>` imposta il suo pin come ingresso quando il driver si connette, e come uscita alla sua prima scrittura. Costruito dal protocollo 2.8.0 (protocol.md e i2c.md in github.com/firmata/protocol) ed eseguito contro StandardFirmata 2.5.9 su un ATmega328P simulato: i suoi pin digitali, pull-up, ingressi analogici a 0, 2,5 e 5 V, registri di confronto PWM, il pin di un servo e i registri di un dispositivo I2C sono stati riletti ciascuno dal chip, non dal driver. Non eseguito su una scheda fisica.

### ONVIF

Una telecamera IP, un encoder o un NVR. Vedi ONVIF.md. Aggiungi un dispositivo con il protocollo `onvif`, l'indirizzo della telecamera e `{"username":"...","password":"..."}`. Il driver legge prima GetSystemDateAndTime e timbra il suo UsernameToken WS-Security con l'orologio della telecamera stessa (Core Specification 5.12: il digest è `base64(SHA-1(nonce + created + password))`), legge GetDeviceInformation e GetServices (GetCapabilities per una telecamera più vecchia), usa Media2 quando la telecamera lo elenca e Media quando non lo fa, e legge encoder, risoluzione, indirizzo di stream e indirizzo di istantanea di ogni profilo. A una telecamera che vuole HTTP Digest o Basic sul POST SOAP si risponde con quello. Gli indirizzi dei servizi vengono raggiunti all'host con cui il dispositivo è stato aggiunto, salvo `"keepXAddrHosts":true`. Un profilo PTZ aggiunge `ptz.<token>.pan`, `.tilt`, `.zoom` e `.moving` da GetStatus, e i comandi armabili `.move` (ContinuousMove, con un timeout facoltativo), `.absolute` (AbsoluteMove), `.goto_preset` (GotoPreset, per token o nome), `.stop` e `.home`. Gli eventi vengono da un pull point (CreatePullPointSubscription, PullMessages, Renew, Unsubscribe) e diventano tag `event.<topic>|<source>|<item>` che si aggiungono da soli, con ogni cambiamento nel registro. Un'istantanea è `GET /api/onvif/<device>/profiles/<token>/snapshot` e la scoperta è `POST /api/onvif/discover` (WS-Discovery, un Probe multicast per `NetworkVideoTransmitter`).

Costruito dalle specifiche ONVIF Core, Media, Media2, PTZ ed Event (onvif.org/specs). Ogni richiesta che invia è valida rispetto ai file WSDL e XSD di ONVIF (xmllint, con i 33 tipi e un elemento che libxml2 rifiuta per attribuzione unica delle particelle rilassati, nessuno dei quali usato da una richiesta), ed è eseguito contro onvif_srvd, uno stack ONVIF indipendente che analizza l'intestazione WS-Security ma non la controlla, quindi il digest dell'accesso viene confrontato invece con quello di zeep 4.3.3. Il servizio eventi e WS-Discovery hanno solo script scritti dalla specifica contro cui eseguire. Non eseguito su una telecamera fisica.

### UniFi Network

La rete dell'impianto come dispositivo: un sito su una console UniFi, i suoi switch, ogni porta di switch, il consumo PoE, i collegamenti WAN e lo stato di salute del sito, come tag che si creano da soli man mano che l'apparato viene adottato, in sola lettura finché non viene armato. Un accesso per console, il certificato fissato e la password della console cifrata nel database. Modifica la console solo tramite i pochi tag di comando che una persona arma (un LED di localizzazione, un riavvio, un ciclo di alimentazione PoE di una porta; vedi UNIFI.md). Ascolta anche il websocket degli eventi della console, così uno switch che cade finisce nel registro di bordo nel momento in cui accade, con l'interrogazione che resta la verità di fondo, e la scheda UniFi disegna la panoramica, la mappa, i frontali, i client, le reti e il WiFi. Tutto su di esso è in [UniFi Network](/it/iot/unifi/).

### UniFi Protect

Telecamere, sensori, luci e sirene di un NVR Protect, tramite la Protect Integration API con una chiave API dalla pagina Integrations della console (la chiave va in `{"apiKey":"..."}`, sigillata come una password di console, e il certificato è fissato con `certFingerprint` come per UniFi Network). Aggiungi un dispositivo con il protocollo `unifi-protect` e l'indirizzo della console. I tag si aggiungono da soli, di sola lettura finché non vengono armati: `cam.<id>.online`, `.motion`, e `.smart_person`, `.smart_vehicle`, `.smart_package`, `.smart_licensePlate`, `.smart_face` e `.smart_animal` per i tipi che una telecamera supporta; `sen.<id>.online`, `.open`, `.motion`, `.leak`, `.tamper`, `.temp_c`, `.humidity_pct`, `.light_lux`; `light.<id>.online`, `.on`, `.motion`; `siren.<id>.online`. Il movimento e i rilevamenti intelligenti di una telecamera vengono dal websocket degli eventi della console, dato che il record REST non ne ha, quindi si leggono come cattivi, mai come "nessun movimento", finché è giù. Ogni evento è nel registro sotto il dispositivo. Il `.play` di una sirena è armato per la scrittura (`true` suona, `false` ferma), così come `alarm.<trigger>.fire`, che invia il webhook dell'alarm manager per l'id del trigger creato dalla persona in Protect, così un allarme HotLoop che lo scrive fa registrare le telecamere. L'istantanea di una telecamera è `GET /api/unifi-protect/<device>/cameras/<camera>/snapshot`, un JPEG prelevato quando richiesto. Costruito dal documento OpenAPI di Ubiquiti per Protect 7.4.102; non ancora eseguito contro una console. Vedi [UniFi Network](/it/iot/unifi/#unifi-protect).

### UniFi Access

Le porte di una console Access, tramite l'API sviluppatore di Access sulla porta 12445 con un token API dalle sue impostazioni avanzate (`{"token":"..."}`, sigillato). Aggiungi un dispositivo con il protocollo `unifi-access` e l'indirizzo della console. Per porta, `door.<id>.open` (il sensore di posizione; una porta che non ne ha si legge come cattiva, mai chiusa), `door.<id>.unlocked` (il relè della serratura), e `door.<id>.unlock`, che una persona arma e che sblocca la porta quando si scrive `true`, attraverso il varco di scrittura e sottoposto ad audit come ogni scrittura; la console la richiude con la propria regola. Il websocket delle notifiche mantiene aggiornati posizione e blocco tra un polling e l'altro, e ogni cambiamento ("1F - Front: opened", "unlocked") è nel registro sotto il dispositivo. Costruito dall'API così come la parla il client aperto mantenuto (py-unifi-access, MIT); non ancora eseguito contro una console. Vedi [UniFi Network](/it/iot/unifi/#unifi-access).

### SNMP

Qualsiasi cosa con un agente SNMP: switch, UPS, PDU, misuratori di energia e ogni macchina Linux che esegue un agente SNMP. Sola lettura. HotLoop non invia mai un SNMP SET, perché un SET può cambiare la configurazione di uno switch e lo scopo di questo driver è vedere la rete dell'impianto, non gestirla.

```
1.3.6.1.2.1.1.5.0             sysName
.1.3.6.1.2.1.1.3.0            sysUpTime, a leading dot is accepted
1.3.6.1.2.1.2.2.1.8.2         ifOperStatus of the interface with ifIndex 2
```

L'indirizzo di un tag è l'OID di una istanza, numeri separati da punti. Uno scalare termina con `.0`; una cella di tabella termina con l'indice della sua riga. Il `dataType` del tag decide che cosa diventa:

* Un numero inviato dall'agente (Integer, Gauge32, Counter32, Counter64, TimeTicks) è quel numero. Scala e offset si applicano come ovunque.
* Un OCTET STRING è testo, a meno che il tag sia un numero, e allora viene interpretato. È così che arriva un carico medio (`laLoad` è il testo `0.15`) o una temperatura dietro un agente. Un testo che non è un numero è una lettura errata che lo dice, mai zero.
* Un OCTET STRING non stampabile (un indirizzo MAC) è `0x` e esadecimale.

**I contatori sono grezzi.** Un Counter32 o Counter64 solo sale e va a capo. Il tag contiene ciò che l'agente ha inviato, e una frequenza spetta a ciò che legge il tag. Counter64 è tenuto come float, esatto fino a 2^53; una porta alla velocità di linea impiega decenni per arrivarci.

**TimeTicks sono centesimi di secondo**, quindi `sysUpTime` letto come tag semplice è in 1/100 s. L'integrazione lo converte in secondi per te; un tag creato a mano deve impostare `scale` su `0.01`.

**Un oggetto che l'agente non ha è una lettura errata con il motivo**, e gli altri nella stessa richiesta vengono comunque letti: v2c e v3 dicono quali mancavano, e per v1, che risponde a un oggetto mancante con un errore per l'intera richiesta, il driver toglie quello e chiede di nuovo il resto. Una risposta troppo grande per l'agente viene richiesta di nuovo a metà.

Opzioni del dispositivo (`config`):

| Opzione | Significato |
|---|---|
| `version` | `1`, `2c` o `3`. Predefinito `2c` |
| `community` | La community v1 e v2c. Obbligatoria per esse, e **non c'è un valore predefinito**: `public` è il modo in cui gli switch di un impianto vengono letti da chiunque chieda. Un segreto |
| `username` | L'utente v3 |
| `securityLevel` | `noAuthNoPriv`, `authNoPriv` o `authPriv`. Predefinito: `authPriv` con una passphrase di privacy, `authNoPriv` con solo una di autenticazione, altrimenti `noAuthNoPriv` |
| `authProtocol` | `MD5`, `SHA`, `SHA224`, `SHA256`, `SHA384` o `SHA512`. Predefinito `SHA` |
| `authPassword` | La passphrase di autenticazione. Un segreto |
| `privProtocol` | `DES`, `AES`, `AES192`, `AES256`, `AES192C` o `AES256C`. Predefinito `AES` |
| `privPassword` | La passphrase di privacy. Un segreto |
| `contextName` | Il contesto v3. Quasi sempre vuoto |
| `transport` | `udp` (predefinito) o `tcp` |
| `retries` | Quante volte viene reinviata una richiesta rimasta senza risposta, da 0 a 10. Predefinito 1 |
| `maxRepetitions` | Righe per GETBULK in una scansione. Predefinito 10, a cui rispondono anche gli agenti più piccoli |
| `browseRoots` | OID da percorrere durante la scoperta dei punti. Predefinito: system, le tabelle delle interfacce, host resources, la tabella del carico e le uscite extend di un agente SNMP |
| `browseMaxNodes` | Dove si ferma un'esplorazione. Predefinito 2000 |

L'indirizzo è `host` o `host:port`, porta 161 per impostazione predefinita.

**Una community errata non riceve risposta.** Un agente SNMPv1 o v2c scarta una richiesta con una community che non conosce, quindi una community errata, una porta errata, un firewall e un agente spento sembrano tutti un timeout, e il messaggio di HotLoop li cita tutti e quattro. SNMPv3 invece li distingue: una passphrase errata o un utente sconosciuto viene rifiutato come tale (`ErrAuthRejected`), e HotLoop attende a lungo prima di riprovare le stesse credenziali.

`Browse` percorre i sottoalberi che HotLoop sa nominare e dà un nome a ogni oggetto: quello della MIB, come `sysName`, `ifOperStatus.2`, `ifHCInOctets.2`, `laLoad.1`, oppure l'OID come `oid.1.3.6.1...` per uno che non conosce. I nomi, e gli OID, i tipi e le unità che ci stanno dietro, provengono dalle MIB che li definiscono: SNMPv2-MIB (RFC 3418), IF-MIB (RFC 2863), HOST-RESOURCES-MIB (RFC 2790) e UCD-SNMP-MIB e NET-SNMP-EXTEND-MIB di un agente SNMP. Tutto il resto che l'agente ha si legge comunque; aggiungilo come tag per OID.

L'integrazione (vedi [Integrazioni](/it/iot/integrations/#snmp)) fa le richieste per te.

### BACnet/IP

Un controller di automazione degli edifici, un contatore, un termostato: qualsiasi cosa sulla rete IP che parli BACnet. Sola lettura. HotLoop non scrive mai una proprietà BACnet, perché una scrittura atterra su un'uscita comandabile attraverso un array di priorità, e una priorità lasciata impostata tiene l'apparecchiatura dove è stata messa molto dopo che chi l'ha impostata è tornato a casa. È una funzione da progettare di proposito, non da lasciare in giro.

È tenuto a frame registrati da un dispositivo reale, decodificati da test che girano sempre, e a quel dispositivo nei collaudi.

```
analog-input:1                present value of analog input 1
ai:1                          the same, abbreviated
av:3.units                    a property other than the present value, by name
analog-input:1.117            or by number
multi-state-value:2           present value of a multi-state value
```

L'indirizzo di un tag è l'oggetto, `<type>:<instance>`, e un punto e una proprietà quando non è il valore corrente. I tipi, per nome o abbreviazione: `analog-input` (`ai`), `analog-output` (`ao`), `analog-value` (`av`), `binary-input` (`bi`), `binary-output` (`bo`), `binary-value` (`bv`), `multi-state-input` (`msi`), `multi-state-output` (`mso`), `multi-state-value` (`msv`), `accumulator` (`acc`), `integer-value` (`iv`), `positive-integer-value` (`piv`), `large-analog-value` (`lav`) e `characterstring-value` (`csv`). Le proprietà per nome sono `present-value`, `object-name`, `description`, `units`, `status-flags`, `out-of-service`, `reliability`, `number-of-states`, `state-text`, `object-type`, `object-identifier`, `object-list`, `vendor-name`, `vendor-identifier`, `model-name`, `firmware-revision` e `application-software-version`; qualsiasi altra proprietà è il suo numero.

Ciò che un tag diventa segue il suo `dataType`: un numero inviato dal dispositivo (real, double, unsigned, signed, enumerated, boolean) è quel numero, e l'`active` di un oggetto binario è 1 e l'`inactive` è 0; una stringa di caratteri è testo, o un numero se il tag lo è e il testo è un numero; un valore corrente `null` è una lettura errata che dice che il dispositivo non ha nulla da riportare. Una proprietà che contiene più di un valore (una lista di oggetti) non può essere un tag.

**I flag di stato fanno parte della lettura.** Ogni interrogazione chiede i flag di stato di un oggetto nella stessa richiesta del suo valore corrente, e un oggetto il cui flag di **guasto** è impostato risulta **errato**, con il motivo. Uno **fuori servizio** o **sovrascritto** risulta **incerto**: il suo valore corrente è qualcosa che una persona o un programma vi ha messo, non una misura, e i grafici di trend e i report escludono le letture incerte come quelle errate (la regola della qualità). **In allarme** da solo è una buona lettura di un punto che è in allarme.

**Ciò che il dispositivo non ha è una lettura errata con il motivo, e il resto viene comunque letto.** ReadPropertyMultiple risponde a ogni proprietà separatamente, quindi un oggetto che non c'è (`unknown-object`) o una proprietà che non ha (`unknown-property`) fa fallire quel tag e nessun altro. Un dispositivo che rifiuta ReadPropertyMultiple viene letto da allora una proprietà alla volta.

**Nulla è segmentato.** Il client dice al dispositivo di non poter accettare una risposta segmentata. Un dispositivo la cui risposta non starebbe in un frame abortisce (`segmentation-not-supported`), e HotLoop chiede metà degli oggetti alla volta; un dispositivo la cui lista di oggetti è troppo grande per essere inviata intera viene letto un elemento alla volta.

Opzioni del dispositivo (`config`):

| Opzione | Significato |
|---|---|
| `deviceInstance` | Il numero di istanza che il dispositivo a questo indirizzo dovrebbe avere. Quando è impostato e il dispositivo ne dichiara un altro, la connessione viene rifiutata: un dispositivo diverso che risponde a un indirizzo riutilizzato, o un controller sostituito, è il modo in cui un impianto ottiene un numero sbagliato dall'aspetto pulito |
| `localAddress` | L'indirizzo della scheda di rete di questa macchina da cui inviare, per un host con più di una. Di solito vuoto |
| `retries` | Quante volte viene reinviata una richiesta rimasta senza risposta, da 0 a 10. Predefinito 1 |
| `browseMaxObjects` | Dove si ferma un'esplorazione. Predefinito 1000 |

L'indirizzo è `host` o `host:port`, porta 47808 per impostazione predefinita. Nulla in BACnet/IP è una credenziale, quindi non ce ne sono da nascondere.

**La connessione chiede al dispositivo chi è.** HotLoop invia al dispositivo un Who-Is unicast e prende la sua istanza di dispositivo dall'I-Am. A un dispositivo che non risponde a quello viene chiesto il proprio oggetto dispositivo sotto l'istanza jolly (4194303), a cui lo standard dice che un dispositivo risponde come se stesso. Un dispositivo che non risponde a nessuno dei due viene segnalato con entrambi i tentativi, perché i motivi consueti si somigliano: un indirizzo o una porta errati, un firewall, un dispositivo spento, o un dispositivo su una rete dietro un router.

**Il routing non è realizzato.** HotLoop parla con un dispositivo a cui può inviare un datagramma UDP. Un controller su una dorsale MS/TP dietro un router BACnet, o su un'altra rete BACnet, non è raggiungibile, e nemmeno un dispositivo raggiungibile solo da un BBMD (registrazione come foreign device). Indirizza il lato BACnet/IP del router stesso, oppure metti un gateway davanti: vedi [modalità gateway](#tutto-il-resto-modalità-gateway).

`Browse` legge l'oggetto proprio del dispositivo (il suo nome, produttore, modello e firmware), la sua lista di oggetti, e ogni oggetto che HotLoop legge: nome, descrizione, unità, valore corrente e flag di stato, e il testo di stato di un oggetto multi-stato. Un tag prende il nome proprio dell'oggetto, con l'indirizzo aggiunto quando due oggetti lo condividono. Le unità diventano un'etichetta e, dove ne significano una, una classe di entità: i gradi Celsius sono `°C` e `temperature`, l'umidità relativa percentuale è `%` e `humidity`, il chilowattora è `kWh` e `energy`. Un'unità per cui HotLoop non ha etichetta viene lasciata senza etichetta e nominata nella descrizione dal suo numero. I numeri e i nomi di quelle unità sono verificati su un dispositivo reale, che invia il numero che la sua tabella dà a ciascun nome. L'integrazione (vedi [Integrazioni](/it/iot/integrations/#bacnetip)) fa le richieste per te.

## In uscita: l'API Kafka

Tutto quanto sopra porta dentro i valori di un dispositivo. HotLoop può anche inviarli a un broker Kafka come flusso di eventi: ogni lettura che l'historian conserva, e ogni riga del log di sistema (allarmi, dispositivi che cadono e tornano, modifiche), come JSON sui topic che indichi. È una destinazione dell'historian, configurata in Impostazioni, Destinazioni dello storico, e accetta Apache Kafka, Redpanda e qualsiasi altra cosa che parli l'API Kafka, su TLS con un accesso SASL. I formati dei record, che cosa significa qui "almeno una volta", e che cosa è e non è dimostrato sono in [Destinazioni dell'historian](/it/iot/historian-targets/#api-kafka-flusso-di-eventi). Il client è [franz-go](https://github.com/twmb/franz-go).

## Tutto il resto: modalità gateway

**PROFINET · EtherCAT · HART · DNP3 · FINS · MELSEC/SLMP · CANopen · FANUC FOCAS**

Questi non sono parlati in modo nativo e non c'è un driver per essi. È una scelta deliberata, non un vuoto in attesa di essere riempito con uno stub.

I siti che usano questi protocolli hanno quasi sempre già un gateway che ripubblica su OPC UA o Modbus: un controller PROFINET IO con un server OPC UA, un multiplexer HART con una mappa Modbus. Punta un dispositivo a quell'endpoint e configuralo come OPC UA o Modbus.

Scrivere altri otto driver che duplicano ciascuno ciò che il gateway esistente di un sito già fa aggiungerebbe altre otto cose da sbagliare in modo sottile, per protocolli le cui apparecchiature sono le più difficili da provare. Se un sito davvero non ha un gateway e ha bisogno di uno di questi in modo nativo, è un lavoro vero da pianificare, non un file da aggiungere che registra "not implemented".

**Non ci sono driver segnaposto in questo albero.** Un protocollo ha un'implementazione funzionante oppure è in questa sezione. Un test impone che ogni protocollo dichiarato dal modello abbia un driver compilato, e viceversa.

## Credenziali del dispositivo

Il `config` e l'`address` di un dispositivo sono dove un driver trova con che cosa accedere. Queste sono le credenziali che ogni protocollo legge, e tutte sono di sola scrittura tramite l'API (4.15.1): appaiono come `[redacted]` a ogni ruolo, un salvataggio che invia il segnaposto o omette la chiave mantiene il valore memorizzato, e una nuova stringa lo sostituisce. Le regole, e ciò che non passa dall'API, sono in [Autenticazione e utenti](/it/iot/authentication/#le-credenziali-dei-dispositivi-sono-in-sola-scrittura).

| Protocollo | Credenziali nella configurazione | Credenziali nell'indirizzo |
|---|---|---|
| OPC UA | `password` (con `username`) | nessuna: le informazioni utente nell'indirizzo sono nascoste e il driver le ignora |
| MQTT / Sparkplug B | `password` (con `username`) | `mqtt://user:pass@host`, che il client usa |
| HTTP / REST | `password` (con `username`, inviata come autenticazione basic); ogni valore in `headers` tranne quelli semplici come `Accept` e `Content-Type`, che è dove vanno una chiave API o un'intestazione `Authorization`; `body` e `writeBody` se menzionano una credenziale | `http://user:pass@host` e valori di query in stile `?api_key=`, nell'indirizzo e in `writeUrl` |
| MTConnect | `password` (con `username`); ogni valore in `headers`, con le stesse eccezioni | `http://user:pass@host` e valori di query |
| UniFi Network | `password` (con `username`). Memorizzata solo cifrata: senza una chiave (sotto) il dispositivo non può essere salvato | nessuna: l'indirizzo è l'URL `https://` della console |
| BACnet/IP | nessuna | nessuna: l'indirizzo è `host` o `host:port` |
| CODESYS | `password` (con `username`), come per OPC UA | nessuna: le informazioni utente nell'indirizzo sono nascoste e il driver le ignora |
| SNMP | `community` (v1, v2c); `authPassword` e `privPassword` (v3), con `username` | nessuna: l'indirizzo è `host` o `host:port` |
| Modbus, S7comm, EtherNet/IP | nessuna | nessuna: le informazioni utente nell'indirizzo sono nascoste e il driver le ignora |

**Cifrate a riposo.** Con `HOTLOOP_SECRET_KEY_FILE` impostato (lo imposta il chart, con una chiave che genera), ogni credenziale nella colonna di configurazione sopra è cifrata nel database con quella chiave, che vive fuori dal database, quindi un dump o un backup contiene testo cifrato. Il resto di HotLoop, e i driver, non vedono mai la differenza. Anche una credenziale scritta in un URL (`mqtt://user:pass@host`, `?api_key=`) o in testo libero come un `body` HTTP viene cifrata: l'intero indirizzo o l'intera opzione viene sigillato e torna esattamente come digitato, e un URL senza nulla di segreto resta leggibile. L'opzione `password` resta il posto più ordinato per una. Vedi [Backup e ripristino](/it/iot/backup/#credenziali-dei-dispositivi-e-chiave-segreta).

Qualsiasi altra opzione il cui nome somigli a una credenziale (contiene `password`, `token`, `secret`, `apikey`, `authorization`, `private`, `passphrase`, o termina con `key`, o ha una parola intera come `pass`, `pw`, `auth`, `cred` o `sig`, tra le altre) è nascosta anch'essa, qualunque sia il suo protocollo, quindi un'opzione aggiunta più tardi a un driver resta nascosta finché qualcuno non decide che non deve esserlo. Un test percorre le opzioni di ogni driver e fallisce finché ciascuna non è nell'elenco delle credenziali o in quello delle opzioni note per non esserlo. Vedi [Autenticazione e utenti](/it/iot/authentication/#le-credenziali-dei-dispositivi-sono-in-sola-scrittura) per le regole complete.

## Aggiungere un dispositivo

1. **Dispositivi → Aggiungi dispositivo.** Scegli il protocollo, dagli un indirizzo.
2. **Scopri i tag** dove il protocollo lo supporta: OPC UA, EtherNet/IP, MTConnect, MQTT (dopo una nascita Sparkplug), HTTP, SNMP, BACnet/IP, CODESYS. Modbus e S7comm non possono enumerare i propri punti, quindi dichiarali dalla documentazione del dispositivo.
3. I tag importati vengono creati **in sola lettura**. Un punto che il dispositivo espone non è un punto per cui qualcuno ha deciso che possa essere comandato. Segna i tag come scrivibili uno alla volta, deliberatamente.
4. Imposta `scale` e `offset` per i conteggi grezzi: `engineering = raw × scale + offset`. Se lo strumento invia un codice quando un canale è morto o fuori range, elencalo sotto [Valori senza dati](#valori-senza-dati) così risulta errato invece che come numero.
5. Imposta un `deadband` su tutto ciò che è rumoroso. Sopprime le scritture nell'historian per variazioni troppo piccole per contare, e senza di esso un sensore a 12 bit che oscilla sul suo ultimo bit scrive una riga a ogni ciclo per sempre.

## Valori senza dati

Un registratore con una termocoppia bruciata non tace. Continua a rispondere, e ciò che mette nel registro è un codice: 0x8005 per "undefined", 0x7FFF per "over range". Letto come int16 con una scala di 0,1, 0x8005 è -3276,3 gradi, e finché non lo abbiamo corretto tornava con qualità **buona**, entrava nell'historian come una vera temperatura e restava lì perché gli allarmi la giudicassero. Un sensore morto sembrava uno freddo.

Quindi un tag può elencare i valori grezzi che significano "nessuna misura". Ognuno ha un motivo. Quando il valore grezzo di una lettura è nell'elenco, la lettura è **errata**, il motivo è con essa, e scala e offset non la toccano mai.

```json
{
  "deviceId": "dx-1", "name": "ch01", "address": "input:1:int16",
  "dataType": "float", "unit": "C", "scale": 0.1, "enabled": true,
  "noData": [
    {"raw": "0x7FFF", "reason": "+over"},
    {"raw": "0x8001", "reason": "-over"},
    {"raw": "0x8002", "reason": "skip"},
    {"raw": "0x8004", "reason": "error"},
    {"raw": "0x8005", "reason": "undefined"},
    {"raw": "0x7F7F", "reason": "power fail"},
    {"raw": "0x7FFA", "reason": "burnout up"},
    {"raw": "0x8006", "reason": "burnout down"}
  ]
}
```

Quegli otto sono i codici della famiglia Yokogawa DX, dal manuale di comunicazione del DX (IM 04L41B01-17E, sezione 4.3, pagina 4-35). Non sono speciali per HotLoop: è lo stesso campo su ogni tag di ogni protocollo, e l'elenco del DX è solo quello che ci ha morso per primo. Ognuno è sul tag, quindi un canale di registratore che può davvero leggere 0x7F7F in qualche altra unità lo mantiene come lettura.

| Campo | <span class="sr-only">Dettagli</span> |
|---|---|
| `raw` | Il codice del dispositivo, scritto come lo stampa il suo manuale: `"0x8005"` (esadecimale), `"-32763"` o `32773` (decimale). Una stringa o un numero semplice. Obbligatorio |
| `reason` | Che cosa dice la qualità della lettura. Fino a 120 caratteri. Se omesso, dice `raw value 0x8005 means no measurement`, così una lettura non diventa mai errata senza dire perché |

Nell'editor dei tag è la casella **Valori senza dati**: un codice per riga, il codice, uno spazio, il motivo.

### Quale numero scrivere

Per un punto Modbus basato su registro, il codice è l'intero che il dispositivo contiene, dopo l'applicazione dell'ordine di byte e di parole del punto. È lo stesso numero in cui il punto si decodifica, quindi un manuale che dice "lo strumento restituisce 8005h" significa esattamente `"0x8005"` qui.

- **int16 e gli altri tipi con segno.** `0x8005` e `-32763` sono lo stesso registro, e lo è anche `32773`. Scrivi quello che scrive il manuale; tutti e tre corrispondono. Un codice che non sta nel tipo (`0x10000` su un int16) viene rifiutato quando il dispositivo si connette, perché una lista che non può mai corrispondere è peggio di un errore. Vengono rifiutate anche due grafie dello stesso valore sullo stesso tag.
- **uint16 e gli altri tipi senza segno.** Da `0` fino al massimo del tipo. Un numero negativo viene rifiutato.
- **int32, uint32, int64, uint64.** Le stesse regole a 32 e 64 bit. `0x7FFFFFFF` su un int32 con ordine di parole `CDAB` è il valore dopo che le parole sono state rimesse nel verso giusto, non l'ordine in cui sono uscite dal filo.
- **float32 e float64.** Il codice è il modello di bit del registro, quindi deve essere esadecimale: `0x7FC00000` per un NaN quieto. Un decimale viene rifiutato, perché 32773 come float e 32773 come modello di bit sono cose diverse e non indoviniamo.
- **Bit, coil, ingressi discreti e stringhe.** Nessun numero grezzo con cui confrontare, quindi `noData` su uno di essi viene rifiutato quando il dispositivo si connette.

Il controllo è sui bit grezzi, prima della decodifica, prima della scala, prima dell'offset.

### Altri protocolli

Ogni driver che consegna un numero già decodificato controlla la stessa lista: S7comm, EtherNet/IP, OPC UA, HTTP e MQTT (compresi i dispositivi scoperti). Ciò che confrontano è quel numero decodificato, come numero intero, quindi scrivilo come il numero che è. Un INT S7 che contiene 0x8005 è -32763, quindi scrivi `-32763`. L'esadecimale qui è solo un altro modo di scrivere lo stesso numero, perché un numero decodificato ha perso la sua larghezza e non può essere riletto come modello di bit. Un valore frazionario non corrisponde mai. Vale la pena impostare la lista solo dove il dispositivo invia codici di questo tipo; la maggior parte di ciò che riportano MTConnect e UniFi non lo fa mai.

### Che cosa fa un valore sentinella

- La **qualità** è `bad` e la lettura porta il motivo. Compare su `GET /api/values` e nel flusso in tempo reale (`reason`), accanto alla qualità nella schermata Tag, e sulle entità del tag come attributo `quality_reason`.
- Il **valore** è vuoto, non zero e non il codice scalato. Scala e offset non vengono applicati.
- L'**historian** registra la qualità come errata, come per qualsiasi altra lettura errata, e la sua colonna del valore non contiene nulla di significativo. Un intervallo senza alcuna lettura buona appare come un buco su un trend, come per qualsiasi lettura errata.
- **Allarmi.** Una lettura errata non fa mai scattare un allarme di valore: alto, basso, uguale, velocità di variazione mantengono tutti il loro stato precedente, come per qualsiasi lettura errata. Un allarme `bad-quality` sul tag scatta invece, e il suo messaggio predefinito porta il motivo (`dx-1/ch01 bad-quality: undefined`). Usa `{reason}` nel tuo messaggio per inserirlo.
- Il **registro di bordo** annota il passaggio a errata dell'entità del tag, e il motivo è l'attributo `quality_reason` dell'entità.

### Dove risiede

Sul tag, salvato con esso. Tramite l'API è la lista `noData` su `POST /api/tags` (vedi [l'API HTTP](/it/iot/api/#post-apitags)), nell'editor è la casella sopra, e in un Edge Relay è lo stesso JSON nel tag del file di dispositivo (vedi [Riferimento Edge Relay](/it/edge-relay/reference/)). Salvare il tag ricarica il dispositivo in esecuzione, quindi una modifica ha effetto alla successiva interrogazione e nulla si riavvia a mano. Una nuova scoperta lascia intatta la lista di un tag.

## Qualità

Ogni lettura porta `good`, `uncertain` o `bad`.

**Errato significa che il valore non è noto. Non significa zero.** Un driver che non riesce a leggere un punto emette comunque una lettura, segnata come errata, perché il silenzio non si distingue da un valore che non è cambiato, e su un trend la differenza tra "il sensore legge 0" e "il sensore ha smesso di rispondere" è la differenza tra un problema di processo e un problema di strumento.

La valutazione degli allarmi mantiene il suo stato precedente su una lettura errata invece di valutarla. Un sensore che si guasta a zero farebbe altrimenti scattare ogni allarme di minimo dell'unità e sembrerebbe un evento di processo.
