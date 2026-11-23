---
title: "Il server OPC UA"
description: "Pubblica i dispositivi e i tag configurati come spazio degli indirizzi OPC UA in sola lettura: il tuo SCADA vede ogni tag senza un nuovo driver."
---

Il server OPC UA di HotLoop, dalla versione 4.13.0, pubblica i dispositivi e i tag configurati nel Gateway come spazio degli indirizzi OPC UA, così un client OPC UA di terze parti, un pacchetto SCADA, un HMI, uno storico o uno strumento di prova come UaExpert può leggere i tag in tempo reale del Gateway senza che nessuno scriva un driver HotLoop per l'altro lato.

Attivo per impostazione predefinita (`HOTLOOP_OPCUA_SERVER_ENABLED`), nel binario e nel chart Helm. Si avvia con l'autenticazione HotLoop attiva e un accesso tutto suo, `opcua-reader`, che HotLoop crea con una password generata che Impostazioni mostra a un amministratore (`GET /api/opcua/server`); può leggere tag e valori e nient'altro. Con l'autenticazione HotLoop disattivata non ci sono utenti con cui accedere, quindi il server resta in attesa e lo segnala (non si rifiuta di avviarsi). Se la 4840 è già occupata da un altro server OPC UA sulla macchina, resta in attesa e lo segnala; una porta che hai scelto e che non si può aprire è un errore: aprire un listener su una rete di stabilimento è una scelta che un deployment fa di proposito. Porta predefinita 4840.

**È in sola lettura.** Vedi [Perché è in sola lettura](#perché-è-in-sola-lettura). Serve anche lo storico di ogni tag: vedi [Storico](#storico).

## Che cosa viene esposto

Un nodo **Object** per ogni dispositivo abilitato, direttamente sotto la cartella standard *Objects*, e un nodo **Variable** per ogni tag abilitato sotto il suo dispositivo. I dispositivi e i tag disattivati non vengono pubblicati: non hanno worker né letture, e pubblicarli metterebbe soltanto davanti al client un nodo Bad permanente. Lo spazio degli indirizzi è esattamente ciò che il runtime sta interrogando.

Tutto vive in un unico namespace, `urn:hotloop:ua:gateway`. L'URI del namespace è una costante, non deriva dal nome dell'host né dall'URI dell'applicazione: un client memorizza un nodo come URI più identificatore e ritrova l'indice del namespace a ogni connessione, e un URI che cambiasse con il nome di un pod lascerebbe orfana ogni sottoscrizione configurata in un progetto SCADA. Ricava l'indice dall'array dei namespace del server tramite l'URI, come fa un client vero; non dare per scontato `ns=2`.

### NodeIds

Gli identificatori sono stringhe e sono stabili:

| Nodo | Identificatore NodeId |
|---|---|
| Dispositivo | `<deviceId>` |
| Tag | `<deviceId>/<tagName>` |
| Proprietà `EngineeringUnits` / `EURange` di un tag | `~EngineeringUnits/<deviceId>/<tagName>` e `~EURange/…` |

La forma del tag è `model.TagKey.String()`, la scrittura `device/tag` che il resto del codice usa già, così un NodeId e una chiave di tag si convertono l'uno nell'altra con `model.ParseTagKey`. Un separatore `.` non avrebbe funzionato: gli id dei dispositivi possono contenere punti, quindi `a.b.c` potrebbe essere il dispositivo `a` con il tag `b.c` oppure il dispositivo `a.b` con il tag `c`. Un id di dispositivo non può contenere una barra, quindi la prima barra è sempre il confine, e un nome di tag che contiene barre (lo fanno i percorsi di navigazione OPC UA e i topic MQTT) viene comunque ricondotto al dispositivo giusto. Gli id delle proprietà iniziano con `~`, cosa che un id di dispositivo non può fare, quindi una proprietà non può mai entrare in collisione con un tag, comunque si chiami.

### Attributi

| Attributo | Valore |
|---|---|
| `BrowseName` | l'id del dispositivo / il nome del tag, nel namespace di HotLoop |
| `DisplayName` | il nome del dispositivo / il nome del tag |
| `Description` | la descrizione del dispositivo o del tag |
| `DataType` | vedi sotto |
| `ValueRank` | scalare (-1) |
| `AccessLevel`, `UserAccessLevel` | solo `CurrentRead` (0x01) |
| `MinimumSamplingInterval` | l'intervallo di polling effettivo del dispositivo in ms; i valori non possono cambiare più in fretta di come il runtime li interroga, quindi un client che chiede una frequenza di campionamento più alta se la vede portare a quell'intervallo |
| `Historizing` | false |

Un tag con un'unità riceve una proprietà `EngineeringUnits` (`EUInformation`, id unità -1 = "non è un codice UNECE", il testo dell'unità in `DisplayName`), e un tag con un intervallo riceve una proprietà `EURange`. Un tag senza né l'una né l'altra non ne ha nessuna.

### Tipi di dato

Il runtime riduce ogni lettura numerica a un float64 in unità ingegneristiche, quindi il tipo dichiarato è una scelta di presentazione fatta in `kindForTag`, e deve essere un tipo in cui il valore si possa sempre esprimere:

| `dataType` del tag | Tipo OPC UA |
|---|---|
| `bool`, `boolean`, `bit`, `coil`, `discrete` | Boolean |
| `string`, `text`, `char` | String |
| `int16` | Int16 |
| `uint16`, `word` | UInt16 |
| `int32`, `dint` | Int32 |
| `uint32`, `dword` | UInt32 |
| `uint64` | UInt64 |
| `int`, `int64` | Int64 (il tipo con segno più ampio, così nulla va in overflow) |
| qualsiasi altro, incluso `float` | Double |
| **qualsiasi tipo intero con una scala o un offset** | **Double** |

L'ultima riga conta: un registro `int16` scalato di 0,1 legge 23,4, e troncarlo a Int16 darebbe al client un 23 con stato Good. Un valore che non rientra nel tipo dichiarato, un tag `int16` che consegna 70000, viene segnalato `BadOutOfRange` senza valore, mai avvolto o tagliato in qualcosa che sembri plausibile. Un tag numerico la cui lettura contiene testo è `BadTypeMismatch`.

### Valore, qualità e timestamp

Ogni lettura (e ogni campione di sottoscrizione) riceve risposta dalla cache in tempo reale del runtime, la stessa fonte che serve `/api/values`, mai dal database. Il codice di stato deriva da quella lettura **e dallo stato del collegamento del dispositivo che c'è dietro**, perché la cache da sola non basta: conserva l'ultima lettura restituita da un dispositivo, e un dispositivo che nel frattempo è uscito dalla rete ha ancora un'ultima lettura dall'aspetto perfettamente buono.

| Collegamento del dispositivo | Lettura | Stato | Valore |
|---|---|---|---|
| Connesso, almeno un polling consegnato in questa sessione | buona | **Good** | inviato |
| | incerta | Uncertain | inviato |
| | cattiva, o qualità non riconosciuta | Bad | nessuno |
| Connesso, nessun polling ancora consegnato in questa sessione | qualsiasi | BadWaitingForInitialData | nessuno |
| Connesso, nulla in cache | n/a | BadWaitingForInitialData | nessuno |
| Degradato (sessione attiva, polling che falliscono o parziali) | buona | **UncertainLastUsableValue** | inviato |
| | incerta | Uncertain | inviato |
| | cattiva | Bad | nessuno |
| Disconnesso, in connessione, disabilitato | qualsiasi | **BadNoCommunication** | nessuno |
| Nessun worker per il dispositivo | qualsiasi | BadOutOfService | nessuno |
| Tag o dispositivo rimosso | n/a | BadNodeIdUnknown | nessuno |

Good viene segnalato solo per un dispositivo connesso, su un polling della sessione corrente, la cui lettura è buona. Un tag di un dispositivo disconnesso legge Bad, non il suo ultimo valore con stato Good.

L'età non fa volutamente parte del calcolo. Le fonti guidate da eventi (un tag MQTT/Sparkplug, una sottoscrizione OPC UA) possono legittimamente tenere un valore per ore perché nulla è cambiato, e chiamarlo obsoleto in base all'orologio sarebbe sbagliato; stabilire se un dispositivo sta ancora consegnando dati è compito del collegamento.

Il **timestamp di origine** è il timestamp della lettura stessa, il momento in cui il dispositivo si è fatto sentire l'ultima volta, e viene segnalato anche con stato Bad. Il **timestamp del server** è il momento in cui la lettura ha ricevuto risposta. Entrambi sono in UTC.

## Sottoscrizioni

I client possono creare sottoscrizioni ed elementi monitorati sulle variabili dei tag e ricevere notifiche di cambio dati, che è il modo in cui i client SCADA consumano davvero i tag. In questa libreria il monitoraggio avviene per campionamento: il server legge ogni elemento monitorato al suo intervallo di campionamento (almeno 100 ms, e almeno l'intervallo di polling del dispositivo) attraverso lo stesso gestore che usa una lettura, e notifica quando il valore o lo stato cambia. Quindi un cambio di *qualità*, un dispositivo che cade, viene annunciato come un cambio di valore.

Un elemento monitorato su un tag rimosso non resta in sospeso: riceve `BadNodeIdUnknown`.

## Che cosa vede un client mentre la configurazione cambia

Quando un tag viene rimosso, le letture e gli elementi monitorati su di esso ricevono subito `BadNodeIdUnknown`, e sparisce subito dalla navigazione del suo dispositivo. Il nodo stesso resta nella tabella dei nodi del server per circa 5 secondi, irraggiungibile, poi viene eliminato. Un dispositivo rimosso funziona allo stesso modo sotto la cartella Objects.

Una modifica non lascia mai un vuoto. Un tag o un dispositivo modificato viene sostituito dalla sua nuova versione sotto lo stesso NodeId in un solo passaggio, quindi una lettura o una navigazione in quel momento vede la versione vecchia o quella nuova, mai "sconosciuto". Le sottoscrizioni su di esso continuano.

Il ritardo prima dell'eliminazione non è decorativo. Il Browse della libreria legge l'elenco dei riferimenti di un nodo e poi cerca ogni destinazione senza tenere un blocco tra le due operazioni, e se una destinazione è sparita nel frattempo fa fallire la navigazione del *genitore* con `BadNodeIdUnknown`, come se il dispositivo o la cartella Objects non esistessero. Una volta eliminavamo i nodi subito, e un client che navigava un dispositivo mentre un tag veniva rimosso, o che leggeva un tag mentre il suo dispositivo veniva modificato, poteva sentirsi dire che un nodo perfettamente reale non esisteva.

## Perché è in sola lettura

Questo incremento non implementa le scritture, e lo dice in tre punti contemporaneamente perché nessuna modifica isolata possa aggiungerle senza che si noti:

- ogni nodo pubblicato ha `AccessLevel = CurrentRead | HistoryRead` e non è installato alcun gestore di scrittura, quindi una scrittura viene rifiutata con `BadNotWritable` e un client può vedere prima di provare che il nodo non è scrivibile;
- i test scrivono su un tag come viewer, operator e admin, e verificano che la risposta sia `BadNotWritable` **e che il registro del dispositivo dietro il tag non sia cambiato**.

Un percorso di scrittura OPC UA dovrebbe passare da quel varco, portare il suo principal nella traccia di audit e rispettare l'interruttore generale. È una modifica con una revisione sua, non qualcosa che arriva come sottoprodotto della pubblicazione dei tag, e in questa versione non esiste volutamente alcuna impostazione che la abiliti.

## Storico

Ogni nodo tag è storicizzato e porta il livello di accesso HistoryRead. Il server risponde al servizio HistoryRead di OPC UA con lo storico di HotLoop stesso, le stesse letture che serve `/api/history`, così un client all'altro capo di una connessione OPC UA legge ciò che il Gateway ha conservato senza un secondo database. Un utente ha bisogno di ciò che serve per leggere un valore (`tags.read` e `values.read`), controllato come per una lettura di valore, per l'utente della sessione, e non una volta sola all'accesso.

- **Raw** (`ReadRawModifiedDetails`): le letture in una finestra, ciascuna con la propria qualità come stato e il proprio timestamp. Un inizio precedente alla fine legge in avanti e un inizio successivo alla fine legge all'indietro, dalla più recente. L'inizio è incluso e la fine esclusa (OPC UA 10000-11, sezione 4.6), a meno che il client chieda i limiti, nel qual caso si aggiungono la lettura all'inizio o subito prima e la prima lettura fuori finestra alla fine. `NumValuesPerNode` è quanti ne restituisce una chiamata per un nodo; oltre quel numero, o oltre 10.000, arrivano a pagine, ciascuna con un punto di continuazione valido cinque minuti e per un solo uso (al massimo 1.000 tenuti insieme). Una finestra senza nulla è `Good_NoData`. Lo storico modificato viene rifiutato (`BadHistoryOperationUnsupported`): qui nulla viene mai modificato né eliminato.
- **Processed** (`ReadProcessedDetails`): Average, Minimum, Maximum, Count, Start, End e Total, su intervalli di `ProcessingInterval` dall'ora di inizio, secondo la regola di qualità (README, "The quality rule"): contano solo le letture buone con un numero finito. Un intervallo senza letture è `Good_NoData` (Count dice 0), e uno con letture escluse legge `Uncertain_DataSubNormal`, quindi il numero non è mai migliore di ciò che conteneva. Un altro aggregato viene rifiutato per quel nodo (`BadAggregateNotSupported`), un tag stringa non ne ha, e una finestra di più di 10.000 intervalli o di 500.000 letture viene rifiutata (`BadTooManyOperations`) invece di essere troncata. Si risponde solo a una finestra in avanti con entrambi gli estremi.
- **At time** (`ReadAtTimeDetails`): ciò che il tag valeva a ogni istante, cioè la sua ultima lettura a quell'istante o prima, con il timestamp richiesto. Non interpola mai, perché una lettura è un valore che qualcuno ha preso; un istante precedente alla prima lettura del tag è `Bad_NoData`.
- Gli **eventi** non vengono serviti: `BadHistoryOperationUnsupported`. Neanche un dispositivo o un altro oggetto ha storico, e un nodo proprietà (`EngineeringUnits`, `EURange`) non porta HistoryRead.

Lo storico conserva una lettura quando supera la banda morta, non a ogni polling, quindi un tag tranquillo ha poche righe: leggi At time, o una finestra Processed attorno all'ultima lettura di un tag, quando ti serve ciò che valeva e non solo quando è cambiato. `HistoryServerCapabilities` dice che lo storico può essere letto e che una chiamata restituisce al massimo 10.000 valori.

## Stato di salute della macchina, per la dashboard EmberNet

Il Task Manager della dashboard legge CPU, memoria, disco e jitter in tempo reale di una macchina dalla macchina stessa: HotLoop li pubblica come dispositivo e il server ne serve lo storico ([Storico](#storico)), così la dashboard non legge mai il proprio database per questi dati. Che cosa è costruito, e come si attiva:

* **Il dispositivo.** Con `HOTLOOP_BOX_HEALTH_NODE` impostato (il chart lo imposta al nome del nodo Kubernetes) HotLoop crea un dispositivo il cui id è esattamente quel nome, con il protocollo `boxhealth` ([Protocolli e driver](/it/iot/protocols/#stato-di-salute-della-macchina)). I suoi tag sono `cpu_util_pct`, `mem_util_pct`, `disk_util_pct` (il disco della macchina), `data_util_pct` (il volume su cui HotLoop tiene i suoi dati) e, solo quando `HOTLOOP_BOX_HEALTH_JITTER_FILE` indica il file JSON che scrive un agente real-time, `rtos_jitter_core1_us`, `rtos_jitter_core2_us` e `rtos_jitter_core3_us`. I loro id di nodo OPC UA sono nel namespace `urn:hotloop:ua:gateway` con l'identificatore stringa `<device id>/<tag>`.
* **I numeri della macchina.** Il chart monta la radice dell'host in `/host` e il suo `/proc` in `/host/proc`, entrambi in sola lettura, e imposta il nome del nodo, **per impostazione predefinita** (`opcuaServer.dashboard.boxHealth.enabled: true`), così il Task Manager della dashboard funziona appena HotLoop è installato. Vengono letti solo uno statfs di `/host` e i contatori di CPU e memoria, e non viene aggiunto alcun privilegio. Un cluster che impone il profilo restricted di Pod Security rifiuta un hostPath: lì, imposta `enabled: false` (nessun dispositivo e nessun mount) oppure `hostMount: false` (il dispositivo, ma disco e CPU della macchina leggono Bad e dicono che cosa montare). Il dispositivo non ha bisogno del server OPC UA.
* **Un accesso che può leggere e nient'altro.** Il chart crea l'utente `embernet-dashboard-read` con esattamente `tags.read` e `values.read` (un elenco esplicito di permessi, mai un ruolo) alla prima installazione, e tiene la sua password generata nel Secret `<release>-opcua-dashboard` (chiavi `username`, `password` e `password-hash`). Un aggiornamento non la ruota mai. Un account che esiste non viene mai modificato da un riavvio.
* **Il certificato della dashboard.** La dashboard crea il Secret `<release>-opcua-trust`, una chiave per certificato con nome `<sha1 thumbprint>.crt`. Il chart lo monta, facoltativo, in `/etc/hotloop/opcua-trust`, e il server tiene quei file in `trusted/` (`HOTLOOP_OPCUA_SERVER_TRUST_DIR`): all'avvio e ogni 30 secondi, un file nuovo viene aggiunto, uno modificato viene riscritto e uno che esce dal Secret viene tolto di nuovo. Un file che un operatore ha messo in `trusted/` non viene mai toccato, e prevale su una chiave del Secret con lo stesso nome.
* **La porta.** Il Service della release stessa (quello che la dashboard scopre) elenca la porta OPC UA 4840 quando il server è attivo, accanto al Service del server OPC UA.

Il server resta com'era: Basic256Sha256 SignAndEncrypt, nessuna sessione anonima, nessuna fiducia indiscriminata.

## Modello di sicurezza

### Trasporto

I canali sicuri usano le policy della libreria in Sign e SignAndEncrypt. **`Basic256Sha256` è offerta in entrambe le modalità**, ed è quella che un client dovrebbe scegliere.

**La policy di sicurezza None è una scelta esplicita** (`HOTLOOP_OPCUA_SERVER_ALLOW_INSECURE`, false per impostazione predefinita), con un avviso all'avvio quando è attiva. Con la scelta disattivata non viene annunciato alcun endpoint None, e un client che apre comunque un canale None può fare solo discovery: ogni altro servizio viene rifiutato. Anche con la scelta attiva, nome utente e password viaggiano comunque dentro un token cifrato (la policy del token è `Basic256Sha256`, mai None), anche se ogni valore che il client legge poi è senza protezione.

**Le policy obsolete sono disattivate per impostazione predefinita.** La OPC Foundation ha dichiarato obsolete `Basic128Rsa15` (RSA con padding PKCS#1 v1.5) e `Basic256` (SHA-1). Nelle versioni precedenti erano offerte entrambe in ogni elenco di endpoint senza modo di toglierle. `HOTLOOP_OPCUA_SERVER_ALLOW_DEPRECATED_POLICIES` (chart: `opcuaServer.allowDeprecatedPolicies`, `false` per impostazione predefinita) lo decide:

- **Disattivato (il valore predefinito, nelle nuove installazioni e negli aggiornamenti).** Nessuna delle due policy compare in alcun endpoint comunicato a un client, e un client che apre un canale sicuro con una di esse viene rifiutato all'apertura del canale, prima di qualsiasi sessione o accesso. I client su `Basic256Sha256`, `Aes128_Sha256_RsaOaep` o `Aes256_Sha256_RsaPss` non sono interessati.
- **Attivato.** Entrambe vengono offerte di nuovo in Sign e SignAndEncrypt, per un client datato che non parla nulla di più recente, con un avviso all'avvio. Attivalo solo finché quel client non è aggiornato.

Un client che ha smesso di connettersi dopo l'aggiornamento e usa una di queste due policy mostra il canale rifiutato; imposta l'opzione, oppure sposta il client su `Basic256Sha256`.

### Certificato del server

Se `HOTLOOP_OPCUA_SERVER_CERT_FILE` e `_KEY_FILE` sono impostati, quella coppia RSA viene usata così com'è. Altrimenti un **certificato autofirmato di istanza di applicazione viene generato al primo avvio e conservato** sotto `HOTLOOP_OPCUA_SERVER_PKI_DIR` (`own/cert.pem`, `own/key.pem`, chiave in modo 0600), così l'avvio successivo presenta lo stesso certificato e a un client a cui è stato detto una volta di fidarsi non viene chiesto di nuovo. A ogni avvio, finché il certificato è autofirmato, viene registrato un avviso con la sua impronta SHA-1, la forma che mostrano gli strumenti OPC UA, così un operatore può confrontarla con ciò che mostra un client.

Il certificato dice ciò che controllano i client OPC UA, cosa che un normale certificato TLS non fa: l'**URI dell'applicazione** (`HOTLOOP_OPCUA_SERVER_APPLICATION_URI`, per impostazione predefinita `urn:hotloop:gateway`, più `:<siteId>` quando ne è configurato uno) nei nomi alternativi del soggetto di tipo URI, i nomi host e gli indirizzi che i client usano (l'host dell'endpoint, `HOTLOOP_OPCUA_SERVER_CERT_HOSTS`, `localhost`, loopback, il nome host di questa macchina) come SAN DNS e IP, e gli usi della chiave che la Parte 6 elenca per un'istanza di applicazione. RSA-2048, cinque anni.

Un certificato conservato viene sostituito, con un avviso che i client devono fidarsi del nuovo, solo se non può più svolgere il suo compito: meno di 30 giorni residui, un URI di applicazione che non corrisponde più alla configurazione, un host configurato che non copre, o una chiave che non si può leggere.

**Il nome host della macchina non è un host configurato.** Entra in un nuovo certificato, ma un certificato conservato viene mantenuto quando il nome host cambia. In un container il nome host è l'id del container, e in Kubernetes è il nome del pod, quindi cambia a ogni redeploy. Finché questo non è stato corretto contava, e ogni aggiornamento di un Gateway in container generava un nuovo certificato: Ignition, a cui era stato detto di fidarsi del vecchio, rifiutava il server con `Bad_SecurityChecksFailed` finché qualcuno non si fidava di nuovo, su ogni client, dopo ogni deploy. I client raggiungono il server tramite `HOTLOOP_OPCUA_SERVER_ENDPOINT_HOST` e `_CERT_HOSTS`; impostali, e il certificato dura fino a che si avvicina la scadenza. (Un Gateway senza host dell'endpoint impostato usa il nome host della macchina come host dell'endpoint, e quello conta, perché è ciò che viene detto ai client. Un altro motivo per impostarlo.)

**Una chiave può essere inutilizzabile, e il server la rifiuta.** Circa una chiave RSA su venti non può portare un accesso OPC UA cifrato, e ogni accesso cifrato con quella chiave fallisce allora, ogni volta, con il client che vede solo "il canale sicuro è stato chiuso". Le sessioni anonime e non cifrate non sono toccate, ed è questo che rende facile diagnosticarlo male. Una chiave generata viene estratta di nuovo finché non è una di queste; una chiave fornita da un operatore che lo è viene rifiutata all'avvio con un errore che ne spiega il motivo.

### Certificati di applicazione dei client

OPC UA autentica l'applicazione oltre all'utente. Il server tiene un elenco di fiducia in `<PKI_DIR>/trusted/`: un client il cui certificato non è lì viene rifiutato sul canale sicuro, e il suo certificato viene scritto in `<PKI_DIR>/rejected/`. **Per approvare un client, sposta il suo certificato da `rejected/` a `trusted/`**, senza riavvio; la cartella viene letta a ogni connessione. `<PKI_DIR>/issuers/` e `<PKI_DIR>/crl` vengono passati così come sono per i certificati client emessi da una CA.

`HOTLOOP_OPCUA_SERVER_TRUST_ALL_CLIENT_CERTS` (false per impostazione predefinita, con un avviso all'avvio) salta questo passaggio. Toglie solo l'autenticazione dell'applicazione: un utente deve comunque autenticarsi con nome utente e password di HotLoop.

### Chi può accedere

**Nome utente e password, rispetto agli utenti propri di HotLoop.** C'è un solo database di utenti, non un secondo archivio di credenziali: l'autenticatore cerca l'utente con lo stesso `store.User` che usa l'accesso HTTP, confronta con gli stessi hash bcrypt (`auth.CheckPassword`), normalizza il nome utente allo stesso modo (minuscolo, senza spazi ai bordi), esegue un confronto bcrypt che l'utente esista o no, perché il tempo di risposta non riveli quali nomi sono reali, e rifiuta un account disabilitato. Utente sconosciuto, password errata, utente disabilitato e utente senza il permesso ricevono tutti la stessa risposta, `BadUserAccessDenied`.

**Un utente può leggere i tag solo se il suo ruolo concede `tags.read` e `values.read`**, la stessa coppia con cui l'API HTTP protegge `/api/tags` e `/api/values`, risolta con gli stessi `auth.Permissions` e `auth.Allows`, così un ruolo integrato e un elenco esplicito di permessi si comportano esattamente come lì. Servono entrambi perché un client OPC UA naviga l'elenco dei tag e legge i valori attraverso una sola connessione, e a un utente con uno solo dei due verrebbe dato l'altro gratis. Ogni ruolo integrato che ha `values.read` ha anche `tags.read`; la cosa vale solo per un utente con un elenco esplicito di permessi.

**I permessi si controllano all'uso, non solo all'accesso.** La libreria chiede i ruoli di una sessione a ogni navigazione, lettura e campione di sottoscrizione; la risposta viene da una cache di breve durata (10 s) del database utenti. Un utente disabilitato, eliminato o privato di permessi perde l'accesso su una sessione attiva entro quell'intervallo, con i suoi elementi monitorati che passano a Bad, e non quando il suo client si riconnette. Una ricerca che fallisce conta come "no".

**Le sessioni anonime sono disattivate** (`HOTLOOP_OPCUA_SERVER_ALLOW_ANONYMOUS`) e nessun token anonimo viene offerto se non lo si attiva, con un avviso all'avvio. Anche i token di identità utente X.509 sono disattivati, e vengono offerti quando è impostato `HOTLOOP_OPCUA_SERVER_ALLOW_X509` (vedi [Certificati utente X.509](#certificati-utente-x509)). Se l'autenticazione propria di HotLoop è disattivata (`HOTLOOP_AUTH_INSECURE`) non ci sono utenti con cui accedere, e il server si rifiuta di avviarsi a meno che si attivi l'accesso anonimo.

Un accesso riuscito viene registrato nel log di sistema come un accesso HTTP. Gli accessi falliti vengono registrati solo nel log del processo, con il motivo, perché un chiamante non autenticato non possa riempire la traccia di audit. Al massimo quattro controlli di password girano insieme, dato che ciascuno è un confronto bcrypt volutamente lento e OPC UA non ha un equivalente del limitatore di frequenza che sta davanti a HTTP; oltre questo non ci sono blocchi né limiti di frequenza, come per l'accesso HTTP.

La libreria tiene l'identità utente decifrata, password compresa, nell'oggetto sessione finché la sessione vive. Sta solo in memoria e non viene mai registrata, ma un dump della memoria di un Gateway in funzione conterrebbe le password degli utenti connessi in quel momento.

**Accedono le password di qualsiasi lunghezza che HotLoop accetta, fino a 72 byte (il limite di bcrypt).** Nelle versioni precedenti una password da 65 a 72 byte poteva accedere all'interfaccia web e non qui (`BadIdentityTokenRejected`). La lunghezza contava la password più il nonce del server di 32 byte, quindi la password arrivava al massimo a 64 byte. Nulla in RSA né nella specifica lo richiede: il token viene cifrato in tutti i blocchi che servono e il decodificatore li legge già tutti. Il controllo ora è che la lunghezza sia almeno 32 e non superi i byte realmente decifrati, che è ciò che il controllo doveva garantire, dato che dimensiona il buffer creato subito dopo. Una lunghezza che dichiara più di quanto è arrivato viene ancora rifiutata, quindi un client non può far allocare al server ciò che non ha inviato. Il ramo `main` originale (verificato il 2026-11-16) ha ancora il limite; la modifica è proposta all'origine come pull request da HotLoop-io/opcua.

### Certificati utente X.509

Un client può accedere con un certificato al posto di una password. Disattivato per impostazione predefinita: imposta `HOTLOOP_OPCUA_SERVER_ALLOW_X509=true` (chart `opcuaServer.allowX509`), e il server offre il token utente Certificate sui suoi endpoint sicuri e lo dice all'avvio. Senza questa impostazione nessun endpoint lo offre e un accesso con certificato viene rifiutato.

**Come un certificato viene associato a un utente.** Un admin collega il certificato a un utente HotLoop: Impostazioni, Certificati OPC UA, Collega un certificato (oppure l'API, `POST /api/users/{username}/certificates`, oppure lo strumento MCP `add_user_certificate`). Il registro conserva il certificato pubblico, la sua impronta SHA-256, chi lo ha collegato e quando, se è revocato e quando ha effettuato l'ultimo accesso. Un client che lo presenta e dimostra di possedere la chiave privata accede **come quell'utente**. Non si configura nient'altro e nulla del certificato stesso viene considerato affidabile: il common name non viene guardato, non c'è una CA da gestire, e un certificato che nessuno ha collegato non fa nulla.

**Che cosa porta il token.** Un client può inviare il suo certificato seguito da quelli che lo hanno emesso; il primo è il certificato che è stato collegato, e gli altri vengono ignorati.

**Prova della chiave.** La libreria controlla la firma del token sul certificato del server e sul nonce di sessione, che solo il possessore della chiave privata può produrre; un certificato presentato con la firma di un'altra chiave viene rifiutato.

**Che cosa può fare.** Esattamente ciò che può fare l'utente. L'accesso richiede che l'utente sia abilitato e abbia `tags.read` e `values.read`, la stessa coppia di un accesso con password, e la sessione viene controllata ogni 10 secondi come una di quelle: un utente disabilitato o che perde il permesso perde una sessione attiva con certificato entro quell'intervallo. È in sola lettura come ogni sessione qui; una sessione con certificato non può scrivere, qualunque sia il ruolo dell'utente.

**Rifiutato, con il motivo nel log.** Un certificato che non è registrato, è revocato, è scaduto, non è ancora valido, o il cui utente non esiste più, è disabilitato o senza il permesso, riceve `BadUserAccessDenied`, la stessa risposta per tutti, così un client non impara nulla su quale sia il caso. Il motivo va nel log del processo e nella traccia di audit.

**Revocare.** Revocalo nella stessa schermata (oppure con `POST .../{thumbprint}/revoke`). Smette di accedere subito e una sessione aperta con esso termina entro 10 secondi. Un certificato revocato resta in elenco, con chi lo ha revocato e quando, così un accesso rifiutato dice "revocato" e non "sconosciuto"; eliminalo per dimenticarlo. I backup portano il registro, revoche comprese.

**Audit.** Ogni accesso con certificato è una voce del registro (categoria auth) che nomina l'utente, l'impronta e il soggetto del certificato e l'applicazione client. Anche ogni rifiuto lo è, con il motivo. Un client che ritenta lo stesso rifiuto scrive una voce al minuto per quel certificato e quel motivo, non una per tentativo; ogni rifiuto resta comunque nel log del processo. Collegare, revocare ed eliminare un certificato sono voci con chi lo ha fatto. La chiave privata non è mai in nessuna di esse, e HotLoop non ne ha mai una: vengono inviati o conservati solo certificati pubblici.

**Non è l'elenco di fiducia delle applicazioni.** Il certificato di applicazione di un client in `<PKI_DIR>/trusted/` consente al client di aprire un canale sicuro; non è un accesso. Un certificato utente è un oggetto diverso: di una persona, collegato a un utente. Lo stesso certificato può servire per entrambi sul lato client, ma il server li tratta come due atti.

**Anche il client di HotLoop** accede in questo modo: vedi `userCertificate` e `userPrivateKey` in [Protocolli e driver](/it/iot/protocols/#opc-ua).

Non costruito: una autorità di certificazione di cui ci si fida per garantire i certificati client e una regola sui nomi che li associ agli utenti. Il registro copre uno stabilimento che collega i suoi certificati client uno alla volta; una CA sarebbe un'aggiunta al registro, non un sostituto.

### La diagnostica del server è rimossa

I nodi di diagnostica per sessione della libreria permetterebbero a qualsiasi utente connesso di navigare il nome utente e l'indirizzo client di tutte le altre sessioni, quindi sono disattivati, e l'oggetto `Server/ServerDiagnostics` è rimosso dallo spazio degli indirizzi (la libreria scrive inoltre i suoi contatori senza blocco).

## Modifiche allo spazio degli indirizzi a runtime

Dispositivi e tag vengono aggiunti, modificati e rimossi mentre il Gateway è in funzione, e lo spazio degli indirizzi li segue senza riavvio. **Meccanismo: una callback del runtime, più un timer come rete di sicurezza.**

- `runtime.Manager.OnReload` richiama dopo ogni `Reload` riuscito. Ogni modifica a un dispositivo o a un tag fatta dall'API termina in un `Reload`, quindi una modifica fatta dall'interfaccia o dall'API viene pubblicata in pochi istanti. La callback segnala soltanto una goroutine di riconciliazione; non fa mai il lavoro da sola, quindi una riconciliazione lenta non può bloccare la richiesta API che l'ha scatenata.
- Una riconciliazione periodica (`HOTLOOP_OPCUA_SERVER_RECONCILE_INTERVAL`, 30 s per impostazione predefinita) raccoglie tutto ciò che cambia la configurazione senza un `Reload`.

Entrambe eseguono lo stesso confronto idempotente con i dispositivi e i tag abilitati nel database. Tocca solo ciò che differisce: un tag modificato viene sostituito, uno rimosso viene eliminato, e tutto il resto, compresi gli elementi monitorati che i client tengono su di esso, resta esattamente com'era. I nodi di un nuovo dispositivo entrano nello spazio in una sola chiamata, quindi un client che naviga durante una riconciliazione vede un dispositivo con tutti i suoi tag oppure nessuno.

Si è preferita la callback al solo polling perché il runtime ha già il segnale pulito (`Reload`) e questo rende visibile una modifica in millisecondi invece che fino a un intervallo intero; il timer resta perché lo spazio degli indirizzi non deve dipendere dal fatto che ogni futuro scrittore di configurazione si ricordi di ricaricare.

## Collegare un client

L'endpoint è `opc.tcp://<HOTLOOP_OPCUA_SERVER_ENDPOINT_HOST>:<port>`. In un cluster il chart imposta per default come host il nome DNS del Service della release; fuori da un cluster, impostalo con il nome o l'indirizzo che i client useranno davvero (un indirizzo LoadBalancer, un record DNS): viene annunciato in ogni URL di endpoint e scritto nel certificato generato. **Non** è l'indirizzo su cui il server si lega: la libreria ascolta su tutte le interfacce e prende solo una porta.

Con UaExpert o qualsiasi altro client:

1. Aggiungi il server con quell'URL e scegli `Basic256Sha256` / `Sign & Encrypt`.
2. Scegli *Username* e accedi con un utente HotLoop che abbia `tags.read` e `values.read`; oppure, con `HOTLOOP_OPCUA_SERVER_ALLOW_X509` attivo, scegli *Certificate* e fornisci il certificato utente e la chiave che un admin ha collegato a un utente.
3. La prima connessione viene rifiutata perché il server non si fida ancora del certificato del client. Trovalo in `<PKI_DIR>/rejected/` (sul volume PKI in un cluster), spostalo in `trusted/` e connettiti di nuovo.
4. La prima volta il client chiede se fidarsi del certificato del server; confronta l'impronta con quella del log di avvio.
5. Naviga *Objects* → il dispositivo → i suoi tag, e trascina i tag nella vista di accesso ai dati; si sottoscrivono.

## Ignition 8.3 come client

**Verificato il 2026-09-27 con Ignition 8.3.9**, l'attuale versione stabile, nell'immagine container ufficiale di Inductive Automation (`inductiveautomation/ignition:8.3.9`, edizione standard in prova), contro un Gateway HotLoop il cui dispositivo demo `extruder-1` è alimentato da un simulatore. Che cosa è stato mostrato, da un capo all'altro:

- una connessione OPC UA di Ignition a `opc.tcp://<gateway>:4840` con `Basic256Sha256` e `SignAndEncrypt`, con accesso come **viewer** HotLoop;
- la fiducia tra certificati in entrambe le direzioni, come sotto;
- tag OPC nel provider `[default]` di Ignition che puntano a nodi HotLoop, letti con qualità Good e che cambiano mentre il simulatore si muove. Ogni valore mostrato da Ignition era uno che il `/api/values` di HotLoop aveva tenuto: lo stesso double attraversa il cavo senza modifiche, quindi si confrontano per uguaglianza, non per vicinanza. Un tag di testo dichiarato `string` in HotLoop ha letto "RUNNING" in un tag String di Ignition;
- una scrittura da Ignition rifiutata: Ignition ha inviato la scrittura, HotLoop ha risposto `Bad_NotWritable` (letto sul cavo su un canale solo Sign, dove la risposta è firmata ma non cifrata), e il valore di HotLoop non si è mosso;
- ogni policy e modalità di sicurezza che Ignition offre, sotto.

### Come configurarlo

Dal lato HotLoop, prima di Ignition:

1. Attiva il server e imposta `HOTLOOP_OPCUA_SERVER_ENDPOINT_HOST` con il nome con cui Ignition raggiunge il Gateway. Quel nome è in ogni URL di endpoint che il server annuncia e nel suo certificato.
2. Crea un utente HotLoop per Ignition con il ruolo **viewer** (un admin lo fa con `POST /api/users`; vedi [Autenticazione e utenti](/it/iot/authentication/)). Qualsiasi ruolo con `tags.read` e `values.read` può accedere; non si offre altro, dato che il server è in sola lettura.

Nel Gateway di Ignition (l'interfaccia web sulla porta 8088):

3. Nella pagina **OPC Connections** sotto Connections (`/app/connections/opc-client-connections`), crea una connessione **OPC UA**. URL dell'endpoint `opc.tcp://<gateway>:4840`; scegli l'endpoint `Basic256Sha256` / `SignAndEncrypt`; autenticazione **Username**, con utente e password HotLoop. La connessione va subito in Faulted, come previsto: passo 4.
4. **Approva Ignition in HotLoop.** Il certificato client di Ignition ora è in `<PKI_DIR>/rejected/` del Gateway (`/data/opcua-pki/rejected` nel container e nel chart), con il nome della sua impronta SHA-1, `<thumbprint>.crt`. Confronta l'impronta con il certificato client OPC UA di Ignition, mostrato nella pagina dei certificati OPC (`/app/connections/opc/security/certificates`). Poi sposta il file in `trusted/`. Nessun riavvio da nessuna delle due parti. HotLoop non registra il rifiuto; il file è l'unico segno.
5. **Approva HotLoop in Ignition.** La connessione ora fallisce nell'altro verso: lo stato dice `Bad_SecurityChecksFailed ... unable to find valid certification path`. Il certificato di HotLoop è nei certificati **client** rifiutati di Ignition, nella stessa pagina. Controlla la sua impronta con quella che HotLoop registra all'avvio (`generated a self-signed OPC UA application certificate ... thumbprint=`) e fidati. Nessun riavvio; la connessione sale entro pochi secondi.
6. **Tag.** Crea tag OPC con la connessione come server OPC e percorsi di elemento nella forma URI del namespace, che Ignition accetta così com'è:

   ```
   nsu=urn:hotloop:ua:gateway;s=extruder-1/Emberburn_Temperature
   ```

   Dichiara ciascuno come ciò che HotLoop pubblica (vedi [Tipi di dato](#tipi-di-dato)): Float8 per un float, Boolean, String, Int2 per un `int16`, Int4 per un `uint16` o `int32`, Int8 per gli interi più ampi. Si sottoscrivono alla frequenza del gruppo di tag, e HotLoop porta una frequenza di campionamento più alta fino all'intervallo di polling del dispositivo.

Lo stesso, come file o con l'API REST:

- La connessione è la risorsa `data/config/resources/core/ignition/opc-connection/<name>/config.json`, con tipo di profilo `com.inductiveautomation.OpcUaServerType`, oppure `POST /data/api/v1/resources/ignition/opc-connection`. Due cose non sono ovvie. La password è un secret incorporato, un JWE che `POST /data/api/v1/encryption/encrypt` ricava dal testo in chiaro; una stringa semplice non viene accettata. E il blocco `security` richiede l'alias del key store client del gateway e la sua password: se manca, la connessione fallisce con una NullPointerException, con un alias vuoto fallisce con `Unable to retrieve KeyPair for alias 'client'`. Copia il blocco dalla connessione loopback `Ignition OPC UA Server` di serie, che porta entrambi.
- I certificati sono in `data/config/local/com.inductiveautomation.opcua/client/security/pki/` (`rejected/certs`, `trusted/certs`), oppure con `GET /data/opc-ua/api/v1/client/pki/certificates/rejected` e `POST .../trusted/<sha1>` tramite l'API. **Ignition non dà ai file il nome dell'impronta**; il campo `signature` dell'API è l'impronta SHA-1, e corrisponde a ciò che HotLoop registra.
- I tag si importano con `POST /data/api/v1/tags/import?provider=default&type=json`.
- Ogni chiamata API richiede una chiave API (la pagina API Keys, `/app/platform/security/api-keys`), e una chiave passa solo se uno dei suoi livelli di sicurezza è nei permessi di lettura o scrittura del gateway (la risorsa `security-properties`).

### Che cosa aspettarsi

- **`Bad_SecurityChecksFailed` significa due cose diverse.** Ignition mostra lo stesso stato quando HotLoop rifiuta il certificato di Ignition (passo 4; il messaggio non ha motivo) e quando Ignition rifiuta quello di HotLoop (passo 5; il messaggio dice *unable to find valid certification path*). Guarda prima il `rejected/` di HotLoop.
- **Un redeploy di HotLoop mantiene il suo certificato.** Fino alla 4.15.3 non era così: il certificato doveva coprire il nome host del container, che cambia ogni volta che il container viene ricreato, quindi ogni aggiornamento generava un nuovo certificato e Ignition rifiutava il server finché qualcuno non si fidava di nuovo. Vedi [Certificato del server](#certificato-del-server). Il certificato cambia comunque se il volume PKI va perso.
- **Un tag di testo dichiarato numerico legge `Bad_TypeMismatch`.** HotLoop pubblica un tag come il tipo con cui è dichiarato, e un tag `float` che contiene "RUNNING" non può essere un Double. I tag creati da Discover tags fino alla 4.15.3 erano tutti dichiarati `float`; vedi [Protocolli e driver](/it/iot/protocols/#opc-ua). Dichiarali `string`.
- **Le scritture vengono rifiutate, e Ignition ne sfuma il motivo.** HotLoop risponde `Bad_NotWritable`. Il server OPC UA di Ignition stesso, a cui si chiede di scrivere lo stesso tag, passa solo un `Bad` generico (0x80000000). Il valore del tag Ignition non cambia.
- **Le policy obsolete funzionano solo se attivate.** Ignition offre `Basic128Rsa15` e `Basic256`. Scegli `Basic256Sha256` o una delle policy `Aes` nella connessione.
- **La prova.** Un gateway 8.3 senza licenza funziona per due ore e poi smette di eseguire finché la prova non viene reimpostata nell'interfaccia web del Gateway. I tag diventano obsoleti quando scade; è Ignition, non la connessione.

### Matrice delle policy

Ogni riga è una sessione nuova con quella policy e quella modalità, che legge valori in tempo reale. Le due righe obsolete sono state misurate con `HOTLOOP_OPCUA_SERVER_ALLOW_DEPRECATED_POLICIES` attivo; con l'opzione disattivata, come è per impostazione predefinita, quelle due policy non sono offerte e un canale che ne chiede una viene rifiutato:

| Policy | SignAndEncrypt | Sign |
|---|---|---|
| `Basic256Sha256` | funziona | funziona |
| `Aes128_Sha256_RsaOaep` | funziona | funziona |
| `Aes256_Sha256_RsaPss` | funziona | funziona |
| `Basic256` (obsoleta) | funziona | funziona |
| `Basic128Rsa15` (obsoleta) | funziona | funziona |

`None` non è offerta a meno che sia impostato `HOTLOOP_OPCUA_SERVER_ALLOW_INSECURE`, e non è stata provata.

## Configurazione

| Variabile | Predefinito | <span class="sr-only">Details</span> |
|---|---|---|
| `HOTLOOP_OPCUA_SERVER_ENABLED` | `true` | Attivo nel binario e nel chart; `false` spegne il server |
| `HOTLOOP_OPCUA_SERVER_PORT` | `4840` | Porta TCP, su tutte le interfacce |
| `HOTLOOP_OPCUA_SERVER_ENDPOINT_HOST` | il nome host di questa macchina | A che cosa si dice ai client di connettersi; viene anche scritto in un certificato generato. **Impostalo.** |
| `HOTLOOP_OPCUA_SERVER_APPLICATION_URI` | `urn:hotloop:gateway[:<siteId>]` | Deve restare stabile tra i riavvii; deve essere un URI |
| `HOTLOOP_OPCUA_SERVER_PKI_DIR` | `/data/opcua-pki` | Certificato, chiave, `trusted/`, `rejected/`. Appoggialo a un volume |
| `HOTLOOP_OPCUA_SERVER_CERT_FILE` / `_KEY_FILE` | n/a | Usa questa coppia RSA invece di generarne una; imposta entrambi o nessuno |
| `HOTLOOP_OPCUA_SERVER_CERT_HOSTS` | n/a | Nomi DNS / IP aggiuntivi per un certificato generato |
| `HOTLOOP_OPCUA_SERVER_ALLOW_INSECURE` | `false` | Offre la policy di sicurezza None. Segnalato all'avvio |
| `HOTLOOP_OPCUA_SERVER_ALLOW_ANONYMOUS` | `false` | Accetta sessioni senza identità. Segnalato all'avvio |
| `HOTLOOP_OPCUA_SERVER_TRUST_ALL_CLIENT_CERTS` | `false` | Salta l'approvazione dei certificati client. Segnalato all'avvio |
| `HOTLOOP_OPCUA_SERVER_ALLOW_X509` | `false` | Offre il token utente Certificate: un client accede con un certificato collegato a un utente ([Certificati utente X.509](#certificati-utente-x509)). Annotato all'avvio |
| `HOTLOOP_OPCUA_SERVER_ALLOW_DEPRECATED_POLICIES` | `false` | Offre le policy obsolete `Basic128Rsa15` e `Basic256` per un client datato ([Trasporto](#trasporto)). Segnalato all'avvio |
| `HOTLOOP_OPCUA_SERVER_MAX_SESSIONS` | `20` | 0 = illimitato |
| `HOTLOOP_OPCUA_SERVER_MAX_SUBSCRIPTIONS` | `200` | 0 = illimitato |
| `HOTLOOP_OPCUA_SERVER_RECONCILE_INTERVAL` | `30s` | Il periodo della riconciliazione di sicurezza |

Il server non viene avviato in modalità `--mcp-stdio`: lì un agente lancia questo binario come aiutante, e che un secondo processo si contenda la porta 4840 con il vero Gateway non deve poter accadere.

### Helm

`opcuaServer.*` in `charts/hotloop/values.yaml`. Attivarlo aggiunge un Service (`<release>-opcua`, ClusterIP per impostazione predefinita; LoadBalancer o NodePort è una scelta deliberata per un client fuori dal cluster), un PVC per la cartella PKI (`opcuaServer.persistence`; perderlo significa che ogni client deve fidarsi di un nuovo certificato), la porta del container e, perché `networkPolicy.enabled` e `opcuaServer.enabled` insieme non lascino in silenzio un server in ascolto che nulla può raggiungere, la porta nella regola di ingress della NetworkPolicy predefinita. Un `networkPolicy.ingress` personalizzato sostituisce quella regola, come per il broker, e deve poi elencare lui stesso la porta. `opcuaServer.tls.existingSecret` fornisce un Secret `kubernetes.io/tls` al posto di un certificato generato.

## Cosa è stato verificato e cosa no

HotLoop è stato eseguito su apparecchiature reali e server reali, e su hardware reale il 2026-11-17.
