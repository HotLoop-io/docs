---
title: "Edge Publish e store-and-forward"
description: "Pubblica tutto ciò che un dispositivo legge su un Gateway centrale come nodo edge Sparkplug B, accoda su disco se il collegamento cade e riproduce in ordine."
---

Edge Publish, dalla 4.5.0, trasforma HotLoop in un **nodo edge** Sparkplug B che pubblica tutto ciò che legge su un Gateway centrale via MQTT, nella direzione opposta al driver MQTT esistente, che consuma Sparkplug come host primario. Ecco cosa significa eseguirlo.

La pubblicazione edge è attiva per impostazione predefinita nel Gateway e in Edge, e resta inattiva finché non ha un broker e un gruppo Sparkplug, dal chart o dall'ambiente, oppure inseriti da un amministratore in Impostazioni, "Dove vanno gli allarmi e le letture" (vedi [Notifiche di allarme](/it/iot/notifications/#where-alarms-go-settings)). Ciò che è salvato lì prevale, e viene letto all'avvio di HotLoop, perché il publisher possiede il file della coda e il nodo. Senza niente di impostato non pubblica nulla e non impedisce l'avvio di HotLoop.

Attivandolo, gira nello stesso processo del Gateway, ancora collegato a TimescaleDB, il che è utile quando un sito vuole in locale l'interfaccia e lo storico del Gateway completo oltre a un collegamento verso uno centrale. La gestione della flotta per molti Edge Relay è arrivata nella 4.7.0 (tracciamento, dai loro birth e death) e nella 4.8.0 (invio della configurazione); vedi la pagina sulla gestione della flotta.

## Attivarlo

```sh
export HOTLOOP_EDGE_PUBLISH_ENABLED=true
export HOTLOOP_EDGE_PUBLISH_BROKER=mqtt.example.local:1883
export HOTLOOP_EDGE_PUBLISH_GROUP=Plant1
export HOTLOOP_EDGE_PUBLISH_NODE=press-line-3   # defaults to the pod hostname
export HOTLOOP_EDGE_PUBLISH_QUEUE_PATH=/data/forward.db
```

Ogni lettura che raggiunge il bus dei tag (lo stesso flusso che leggono l'interfaccia in tempo reale e il valutatore degli allarmi) viene pubblicata come `NDATA` Sparkplug B. Finché il broker è raggiungibile e conferma, ciò avviene direttamente dalla memoria e il disco non viene toccato. Quando il broker smette di confermare, le letture vanno nella coda di inoltro su disco e ne escono, in ordine, quando torna.

## Cosa fa davvero

**Sottoscritto prima di nascere.** A ogni connessione, la prima e ogni riconnessione, il nodo si sottoscrive al suo topic `NCMD` (e al suo topic di invio configurazione) e aspetta che il broker confermi entrambi prima di pubblicare qualsiasi cosa. Sparkplug B 3.0 lo richiede ("Prima di inviare un messaggio NBIRTH, il client MQTT associato al nodo edge deve sottoscriversi per ricevere i messaggi NCMD"), e per una buona ragione: a un host è consentito rispondere a un birth con una richiesta immediata di rebirth o di riavvio, e un nodo che fa il birth per primo può perderla. `Start()` non ritorna finché le sottoscrizioni non sono a posto. Se il broker ne rifiuta una (una ACL che non lascia a questo nodo leggere il proprio topic `NCMD`), `Start()` fallisce con un errore che lo dice; un nodo che nessuno può comandare non dovrebbe avviarsi fingendo il contrario. Una riconnessione che non riesce a sottoscriversi di nuovo non fa il birth su quella sessione; le letture continuano ad andare nella coda di inoltro.

**Un broker assente non ferma l'avvio.** Un rifiuto è un problema di configurazione e fa fallire `Start()`. Un broker irraggiungibile è un'interruzione: `Start()` la registra e ritorna, e il nodo continua a provare in background (un secondo, raddoppiando fino a un minuto) mentre ogni lettura va nella coda di inoltro. Prima falliva anche in questo caso, e il Gateway e l'Edge escono quando Edge Publish non si avvia, quindi un dispositivo riavviato durante un'interruzione della WAN andava in crash loop, senza schermate, senza allarmi, senza automazioni e senza nulla in coda fino al ritorno della WAN.

**Un NBIRTH per connessione.** Ogni tag noto, annunciato per nome con un alias stabile, e il suo valore attuale. Un birth avviene alla prima connessione, a ogni riconnessione (una sessione Sparkplug ricomincia, e la sua numerazione di sequenza non ha significato tra una riconnessione e l'altra), quando in un lotto compare un tag che nessuno aveva visto, e su richiesta, vedi sotto.

**NDATA per tutto il resto**, solo per alias, senza nome. `seq` parte da 0 con il birth e aumenta (modulo 256) a ogni messaggio fino al successivo.

**NDEATH** in due modi: in modo ordinato su `Stop()`, e tramite il last-will della stessa connessione MQTT se il processo muore senza averne la possibilità. Entrambi portano lo stesso valore `bdSeq`, corrispondente al birth che chiudono. Un host distingue un vecchio certificato di morte, rimasto da una sessione precedente, da quello attuale grazie a quel numero.

**`bdSeq` conta le sessioni, e il conteggio sopravvive a un riavvio.** Ogni MQTT CONNECT riceve il numero successivo: 0 alla prima sessione di una coda, uno in più ogni volta, ritorno a 0 dopo 255 (Sparkplug B 3.0, Operational Behavior, Edge Node Session Establishment: `tck-id-message-flow-edge-node-birth-publish-will-message-payload-bdSeq`), e l'NBIRTH su quella connessione porta lo stesso numero del will che ha registrato (`tck-id-message-flow-edge-node-birth-publish-nbirth-payload-bdSeq`). Vive nel file della coda di inoltro, così un nodo riavviato continua a contare invece di ripartire da 1 e consegnare all'host un will già visto, che un host ha il diritto di ignorare perché vecchio. Una riconnessione è una nuova sessione, quindi riceve anche un nuovo numero; il vecchio codice ne teneva uno per tutta la vita del processo perché la libreria client MQTT riutilizza il will con cui è stata creata, mentre ora il nodo costruisce un client nuovo, e quindi un will nuovo, a ogni tentativo di connessione. La metrica è INT64, come chiede la specifica (prima usciva come UInt64; il valore viaggia nello stesso campo, quindi un host che lo legge per valore non se ne accorge).

**`NCMD` → `Node Control/Rebirth`.** Un host che chiede un rebirth riceve un NBIRTH nuovo, con lo stesso `bdSeq`. Un rebirth non è una nuova sessione, quindi non riceve un nuovo numero (`tck-id-operational-behavior-data-commands-rebirth-action-3`).

## Quando il collegamento verso l'alto è interrotto

**Il disco serve per le interruzioni, non per ogni interrogazione.** Finché il collegamento è attivo e il broker conferma, le letture restano solo in memoria fino a quando lo svuotatore le ha inviate e il broker le ha confermate, e nulla viene scritto su disco. Nel momento in cui non c'è sessione, una conferma non arriva, o la memoria supererebbe 100.000 letture, tutto ciò che è in memoria va nella coda su disco in ordine, tutto ciò che segue si mette dietro, e lo svuotatore legge dal disco, il più vecchio per primo, togliendo una lettura solo quando il broker l'ha confermata. Il nodo torna alla memoria solo quando il disco è vuoto, quindi non c'è mai un momento in cui letture più recenti superino quelle più vecchie.

L'abbiamo costruito due volte, e la prima versione era sbagliata per l'hardware. Scriveva ogni lettura su disco prima di inviarla, quindi una terminazione brusca non perdeva nulla di ciò che il nodo aveva accettato. Ma scriveva anche circa 5 MB al secondo a 2.000 letture al secondo, cioè 450 GB al giorno, da circa 160 commit di coda al secondo con otto pagine ciascuno. Questo uccide una scheda SD ed è un'usura assurda per qualsiasi memoria flash. Il costo del disco a regime è ora nullo (i numeri sono più sotto), e ciò a cui abbiamo rinunciato in cambio è detto chiaramente nella sezione successiva.

**Una terminazione brusca con il collegamento attivo perde ciò che era in memoria.** Un SIGKILL, un'interruzione di corrente o un kernel panic, mentre il collegamento è attivo e il broker conferma, si portano via le letture non ancora confermate. È circa un'interrogazione: a 2.000 letture al secondo e con un andata e ritorno di conferma di pochi millisecondi, al massimo qualche centinaio di letture, e lo stesso numero di interrogazioni che l'host avrebbe visto un momento dopo. Non vengono contate come scartate, perché nulla sa che siano esistite. Un arresto ordinato (`Stop`, un SIGTERM, un riavvio) scrive prima su disco ciò che è in memoria e non perde nulla. Un collegamento tagliato non perde nulla in nessuno dei due casi, perché la prima cosa che fa il nodo quando il collegamento smette di confermare è spostare la memoria su disco. L'unico caso che questo progetto non copre è il processo che muore con il collegamento attivo, e non è coperto di proposito.

`HOTLOOP_EDGE_PUBLISH_QUEUE_MAX_BYTES` limita la coda di interruzione, e il valore predefinito è 64 MiB, circa due minuti di interruzione a 2.000 letture al secondo (il banco di prova qui sotto la fa girare lì: ci stanno circa 248.000 letture, misurato nella 4.21.1). Oltre il limite, le letture più vecchie escono per prime e vengono contate. Impostalo a 0 e la coda è illimitata: il processo ti avvisa all'avvio, perché un'interruzione molto lunga su una coda illimitata riempie il volume invece di scartare le vecchie letture come già fa la coda in memoria dello stesso historian.

Una lettura che lo svuotatore estrae entro un paio di secondi da quando è stata accodata esce come valore attuale del tag, in un solo `NDATA` con il resto della sua interrogazione. Una che ha aspettato più a lungo, o che è stata lasciata da un processo morto, esce contrassegnata `is_historical`, così un host non la lascia sovrascrivere ciò che il tag sta facendo ora. Alla riconnessione la coda viene svuotata **prima** che venga pubblicato qualcosa di più recente, il più vecchio per primo, perché c'è una sola uscita.

Una riproduzione è impacchettata: fino a 200 letture storiche condividono un `NDATA`, ogni metrica con il proprio timestamp e `is_historical`. La specifica lo consente ("Più variazioni di valore della stessa metrica POSSONO essere incluse nello stesso messaggio Sparkplug NDATA ... purché abbiano timestamp diversi", Sparkplug B 3.0, Operational Behavior, Data Publish), quindi un messaggio non contiene mai un tag due volte nello stesso millisecondo e ne inizia un altro. Le abbiamo impacchettate perché una lettura per messaggio era il collo di bottiglia, e il profiling lo ha confermato: il 57% della CPU della riproduzione era la chiamata di sistema write che la libreria client MQTT fa una volta per pacchetto, e 200.000 letture in coda hanno impiegato 58,5 secondi, 3.418 al secondo, contro un impianto che ne produce 2.000 al secondo. Una riproduzione più lenta dell'impianto è un arretrato che non finisce mai. Impacchettate, le stesse 200.000 letture richiedono 2,9 secondi, 68.237 al secondo, misurato quando il nodo era ancora in QoS 1. Le letture in tempo reale escono ancora un'interrogazione per `NDATA`.

**QoS 0, come dice la specifica, e un andata e ritorno per sapere che è arrivato.** NBIRTH e NDATA escono con QoS 0 e senza retained (`tck-id-topics-nbirth-mqtt`, `tck-id-topics-ndata-mqtt`, Sparkplug B 3.0, Topics and Messages, Edge Node). Il will di NDEATH è QoS 1 e senza retained (`tck-id-payloads-ndeath-will-message-qos`, Payloads), e lo stesso vale per l'NDEATH ordinato che pubblica `Stop`. Il problema del QoS 0 è che non c'è conferma di ricezione: una pubblicazione "si completa" quando i byte raggiungono il socket locale, e questo funziona benissimo anche verso un collegamento morto, quindi trattarlo come consegna toglierebbe le letture dal disco proprio quando contano. Invece il nodo invia una richiesta dietro ogni blocco (un SUBSCRIBE al proprio topic NCMD, che deve comunque poter fare) e tiene il blocco finché il broker non risponde. Una connessione è un flusso di byte ordinato e un broker elabora i pacchetti di un client nell'ordine in cui li legge, quindi la risposta significa che ha letto tutto ciò che la precede. È la garanzia che dava un PUBACK, un andata e ritorno per blocco invece di una conferma per messaggio. Un test scrive in un collegamento silenzioso e verifica che nulla lasci la coda, né dalla memoria né dal disco; senza l'andata e ritorno, tutte le 30 letture che conteneva sono uscite.

**Una connessione che smette di rispondere viene abbandonata, non attesa fino alla fine.** Se il broker non conferma un blocco, o la libreria client MQTT non riesce ad accettare un messaggio, il nodo chiude da sé quella connessione e avvia una nuova sessione (`bdSeq` successivo, nuovo birth) tenendo tutto ciò che non è confermato (spostato su disco, se era in memoria). Deve farlo, perché un collegamento che muore senza un reset accetta scritture finché il buffer di invio del kernel non è pieno, e poi l'unica goroutine di scrittura della libreria client MQTT resta bloccata in una write. È anche la goroutine che invia il PING di keepalive, quindi il keepalive non scatta mai e il nodo resta nella connessione morta per tutta la durata dell'interruzione: un taglio di prova di sei minuti ha scoperto che non se n'era accorto finché il collegamento non è tornato. Peggio ancora, il passaggio che stava scrivendo si è svegliato sulla nuova connessione e ha continuato a inviare il resto del suo vecchio blocco prima dell'NBIRTH della nuova sessione, con i numeri di sequenza della vecchia. Ora ogni passaggio appartiene alla sessione in cui è iniziato e riceve un errore, non il cavo, una volta che quella sessione è finita.

La consegna è **almeno una volta**. Un blocco che il broker ha preso ma non ha mai confermato viene inviato di nuovo, come storico, e una terminazione brusca tra la consegna e il momento in cui il nodo la annota fa lo stesso. Un host che consuma questi dati deve tollerare un duplicato; non deve mai presumere che questa coda abbia già deduplicato per lui.

### Cosa promette, e i numeri che lo sostengono

- **Ordine esatto.** Ogni lettura di ogni tag raggiunge l'host nell'ordine in cui è stata letta, in tempo reale e riprodotta insieme, attraverso un SIGKILL e un riavvio.
- **Un file limitato.** Il limite è sul file della coda, ciò che riempie il volume, non sui dati che contiene. Il file della coda è i dati più intestazioni di pagina, pagine di ramo, una lista libera e margine di crescita; con il vecchio limite (il conteggio della coda stessa dei byte foglia) il file risultava il doppio dei dati. Qualsiasi valore sotto 1 MiB funziona come 1 MiB, con un avviso all'avvio.
- **Nulla va perso in un'interruzione.** Appena il collegamento smette di confermare, ogni lettura è su disco e ci resta finché il broker non l'ha confermata, quindi ogni lettura riesce a uscire attraverso un'interruzione, una connessione morta, un arresto ordinato, e un SIGKILL o un'interruzione di corrente nel mezzo dell'interruzione. L'eccezione è quella sopra: una terminazione brusca o un'interruzione di corrente con il collegamento attivo perde circa un'interrogazione, le letture ancora in memoria.
- **Scarti rumorosi e contati oltre il limite.** Le letture più vecchie escono per prime, e ognuna va in un contatore di scarti che vive nel file della coda, così un riavvio non cancella la prova. È in `GET /api/diagnostics` sotto `edgePublish` (e nel `/status` del relay sotto `uplink`), accanto a ciò che è in coda, alla dimensione del file e a se una riproduzione è in corso. Il log lo dice una volta al minuto mentre accade, mai una volta per interrogazione. Il conteggio può essere un po' avanti rispetto alla perdita e mai dietro: le letture che l'host ha ricevuto poco prima di un taglio, la cui conferma non è mai arrivata, sono ancora su disco quando il limite le prende, e vengono contate anche se l'host le ha.
- **Una lettura che è stata solo interrogata può andare persa in una terminazione brusca con il collegamento attivo.** Tra il momento in cui il driver consegna una lettura e quello in cui il broker la conferma, esiste solo nel processo, e un SIGKILL o un'interruzione di corrente se la porta via. È il prezzo del non scrivere ogni interrogazione su disco, e l'abbiamo scelto al posto di 450 GB al giorno. Termina il processo quando nulla è in volo e la risposta è esatta: ogni lettura che l'impianto ha fornito è stata consegnata o contata.

Tutto questo è misurato con un vero HotLoop Edge che interroga 20 dispositivi HTTP con 25 tag ciascuno ogni 250 ms (2000 letture al secondo), pubblicando su un vero Mosquitto. Ogni dispositivo risponde a ogni interrogazione con un contatore maggiore di uno rispetto al precedente, così un giudice lato host sa esattamente quale lettura è mancata, quale è tornata due volte e quale è uscita fuori ordine. Il collegamento verso l'alto viene tagliato staccando il broker dalla rete: il socket dell'Edge diventa silenzioso, senza reset né chiusura. Per terminare con nulla in volo l'impianto si ferma per qualche secondo prima del SIGKILL ("quiesced"); le altre terminazioni cadono dove capita l'interrogazione ("instant"). Le esecuzioni del 2026-10-12, con un limite di 64 MiB. "Before" è `15419f1`, la build prima di questo lavoro. "Write-ahead" è `165411f`, che scriveva prima ogni lettura su disco e che abbiamo ritirato. "Now" è memoria finché il collegamento è attivo e disco durante un'interruzione:

| <span class="sr-only">Details</span> | Prima | Scrittura anticipata | Ora |
|---|---|---|---|
| Regime stabile, collegamento verso l'alto attivo, 2.000 readings/s | 2.018 readings/s, 0 bytes/s su disco, 9% di una CPU | 2.031 readings/s, 5,4 MB/s su disco (450 GB al giorno), 14% di una CPU | 10 minuti: 2.002 readings/s, 0 bytes scritti su disco (0 bytes al giorno), 0 pagine scritte dell'archivio di coda incorporato, file di coda di 32.768 bytes prima e dopo, 9% di una CPU |
| Riproduzione di un'interruzione di 5 minuti, con letture che continuano ad arrivare a 2.000 readings/s | 829.745 letture in 4 m 11 s, 3.308 al secondo | da 194.247 a 308.582 al secondo | 244.335 letture in 824 ms, 296.523 al secondo |
| Contabilità dopo un'interruzione di 5 minuti | perse 441.255, contate 441.255 | perse 474.978, contate 474.978 | perse 599.165, contate 599.165, tutte le più vecchie, tutte dal limite |
| Ordine, alias, buchi di sequenza, dati in tempo reale dentro una riproduzione | 0, 0, 0, 0 | 0, 0, 0, 0 | 0, 0, 0, 0 |
| SIGKILL con nulla in volo, collegamento verso l'alto attivo | perse 0 | perse 0 | perse 0 |
| SIGKILL con nulla in volo a 90 s da un taglio silenzioso di 5 minuti, oltre il limite | non eseguito | perse 528.167, contate 528.667 | perse 520.661, contate 521.161 (le 500 in più sono state consegnate, mai confermate) |
| Dieci SIGKILL istantanei, collegamento verso l'alto attivo | perse 0 (un'esecuzione precedente: 50 su quattro) | perse 0 (un'esecuzione precedente: 250) | perse 0 in questa esecuzione; una terminazione può portarsi via circa un'interrogazione, vedi sopra |

Il costo è nella prima riga. La scrittura anticipata faceva circa 160 commit al secondo (uno per interrogazione per metterla su disco, uno per blocco per toglierla) con circa otto pagine da 4 KB ciascuno, cioè 5 MB/s e 450 GB al giorno, e una scheda SD non sopravvive a questo. A regime il nodo ora non scrive affatto nella coda: il contatore `write_bytes` dell'Edge in `/proc` non si è mosso in dieci minuti. Le dieci terminazioni istantanee non hanno perso nulla in quell'esecuzione, e questa è fortuna, non una promessa: la finestra sono le letture in memoria quando il processo muore, circa un'interrogazione.

Una build precedente ha trovato l'altra metà dello scopo di questo lavoro: il QoS 0 e una connessione che smette di rispondere. Vedi "Una connessione che smette di rispondere viene abbandonata" sopra. Il taglio di cinque minuti prima di quella correzione ha lasciato il nodo in una connessione morta per tutta l'interruzione e poi gli ha fatto inviare un blocco vecchio davanti al birth della nuova sessione; 100 letture sono arrivate fuori ordine.

Una build precedente ha trovato l'altra metà dello scopo di questo lavoro: il QoS 0 e una connessione che smette di rispondere. Vedi "Una connessione che smette di rispondere viene abbandonata" sopra. Il taglio di cinque minuti prima di quella correzione ha lasciato il nodo in una connessione morta per tutta l'interruzione e poi gli ha fatto inviare un blocco vecchio davanti al birth della nuova sessione; 100 letture sono arrivate fuori ordine.

Con quel carico una coda da 64 MiB contiene circa due minuti di interruzione: circa 248.000 letture, cioè circa 236 byte per lettura con nomi di tag di nove caratteri (misurato nella 4.21.1, file di coda di 61,7 MB), e un nome di tag più lungo costa di più. Dimensiona il limite in base al tuo ritmo e ai tuoi nomi di tag. Le righe del 2026-10-12 qui sopra concordano: l'interruzione di 5 minuti ha riprodotto 244.335 letture, che sono gli stessi due minuti. La riproduzione non è più un limite: va a oltre cento volte la velocità con cui arrivano le letture.

Il giudice segnalava da 4.000 a 6.000 duplicati in un'esecuzione senza interruzioni. Abbiamo catturato il traffico per scoprire di chi fossero: ognuno era un NBIRTH che ripeteva l'ultimo valore di un tag già portato da un messaggio precedente, con il timestamp proprio della lettura, e nemmeno uno era un NDATA inviato due volte. Un birth deve portare il valore attuale di ogni metrica che il nodo ha (è a questo che serve un birth), e il nodo rifà il birth ogni volta che compare un tag nuovo, quindi i birth successivi ripetono i precedenti. Il publisher aveva ragione e il giudice torto. Ora li conta a parte come istantanee e riserva "duplicato" a una lettura pubblicata di nuovo come dato, l'unico tipo che un host potrebbe scambiare per nuovo. Nell'esecuzione stabile e in quella da dieci terminazioni, il ricevuto è ora esattamente uguale al consegnato: 1.296.275 e 916.350.

## Cosa è stato verificato e cosa no

HotLoop è stato eseguito su apparecchiature reali e server reali, e su hardware reale il 2026-11-17.

## Configurazione

| Variabile | Predefinito | <span class="sr-only">Details</span> |
|---|---|---|
| `HOTLOOP_EDGE_PUBLISH_ENABLED` | `false` | La funzione è disattivata finché non viene impostata |
| `HOTLOOP_EDGE_PUBLISH_BROKER` | n/d | Solo host, `host:port`, o un URL completo |
| `HOTLOOP_EDGE_PUBLISH_GROUP` | n/d | Id del gruppo Sparkplug |
| `HOTLOOP_EDGE_PUBLISH_NODE` | hostname del pod | Id del nodo Sparkplug |
| `HOTLOOP_EDGE_PUBLISH_USER` / `_PASSWORD` | n/d | Credenziali del broker |
| `HOTLOOP_EDGE_PUBLISH_TLS` | `false` | |
| `HOTLOOP_EDGE_PUBLISH_TLS_SKIP_VERIFY` | `false` | Da attivare per singola distribuzione; non impostarlo mai per impostazione predefinita |
| `HOTLOOP_EDGE_PUBLISH_QUEUE_PATH` | `/data/forward.db` | Il file della coda di inoltro |
| `HOTLOOP_EDGE_PUBLISH_QUEUE_MAX_BYTES` | `67108864` (64 MiB) | Il file della coda non cresce mai oltre questo valore; le letture più vecchie vengono espulse, e contate, per restare sotto. `0` significa illimitato, con un avviso. Qualsiasi altro valore sotto 1 MiB funziona come 1 MiB, con un avviso |

## Nel chart Helm

Il chart del Gateway ha un blocco `edgePublish:` che imposta tutto questo. È disattivato per impostazione predefinita, e disattivato produce esattamente ciò che il chart produceva prima che il blocco esistesse. Non impostare più questi valori tramite `extraEnv`.

```yaml
edgePublish:
  enabled: true
  broker: tcp://central.example.local:1883
  group: Plant1
  node: ""               # empty uses the release name
  username: ""
  password: ""           # goes into a chart-managed Secret
  existingSecret: ""     # or name your own Secret (key: secretKey)
  tls: false
  tlsSkipVerify: false
  queueMaxBytes: 67108864   # 64 MiB; 0 is unbounded
  persistence:
    enabled: true
    size: 1Gi
```

Alcune cose le decide il chart per te:

- Il file della coda è `/data/edge-publish/forward.db`, su un suo PVC. Non è un valore, perché ovunque altrove nel pod il filesystem radice è in sola lettura. Con `persistence.enabled: false` va su un emptyDir, che conserva le letture di un'interruzione attraverso il riavvio di un container ma non attraverso un pod ripianificato.
- L'id del nodo è per impostazione predefinita il nome della release, non l'hostname del pod. Un pod di un Deployment riceve un nuovo hostname a ogni rollout, e l'host vedrebbe ogni volta un nuovo nodo edge, con le letture accodate riprodotte sotto di esso.
- Il Deployment passa a `Recreate` e `replicaCount` deve essere 1. Il file della coda prende un lock: in un aggiornamento progressivo il nuovo pod non riesce ad aprirlo, non diventa mai pronto e il rollout si blocca. E due repliche sarebbero due publisher su un solo id di nodo.

Il chart dell'Edge Relay (`charts/hotloop-edge-relay`) ha un proprio blocco `edgePublish:` sulla stessa linea, senza `enabled`: il relay pubblica sempre.
