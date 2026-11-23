---
title: "k3s e Helm"
description: "Distribuisci qualsiasi chart HotLoop su k3s o su qualunque Kubernetes: i valori da impostare, la scelta del database, gli aggiornamenti e i rollback."
---

Il chart distribuisce due carichi di lavoro: il gateway (un Deployment, che non conserva alcuno stato durevole proprio) e TimescaleDB (uno StatefulSet con un volume). È l'impostazione predefinita. `database.type` sceglie un altro database: PostgreSQL semplice, oppure SQLite, che non è affatto un secondo carico di lavoro ([SQLite](#sqlite), più sotto).

## Installazione

Dall'App Store della dashboard EmberNet, oppure direttamente:

```bash
helm install hotloop ./charts/hotloop \
  --namespace hotloop --create-namespace
```

Oppure dal repository dei chart, che è anche l'URL a cui punta l'App Store:

```bash
helm repo add hotloop https://hotloop.io/hotloop
helm install hotloop hotloop/hotloop \
  --namespace hotloop --create-namespace
```

Quella seconda forma funziona dalla 4.16.0, la prima versione pubblicata come `hotloop`. L'ultima prima di essa era `industrial-iot` 4.3.1, con il vecchio nome, e l'aggiornamento da essa è una procedura a parte: vedi "Upgrading from 4.3.1" nelle note della 4.16.0 del README. Il vecchio indirizzo del repository, `https://embernet-ai.github.io/industrial-iot/`, restituisce un 404.

Un'installazione semplice funziona. Il chart genera una password del database e un token MCP nel Secret della release e li riutilizza a ogni aggiornamento, quindi non serve fornire nulla e un aggiornamento non cambia la password sotto un database in esecuzione.

Raggiungerlo non richiede ingress né sottodominio. La dashboard scopre l'app dalle sue etichette dello store e la serve tramite proxy all'indirizzo interno del cluster:

```
<release>.<namespace>.svc.cluster.local:8080
```

Per guardarlo direttamente:

```bash
kubectl -n hotloop port-forward svc/hotloop 8080:8080
```

## Valori da impostare

### Autenticazione

Dalla 4.4.0. Vedi [Autenticazione e utenti](/it/iot/authentication/) per il modello completo; questo è il lato del chart.

```yaml
auth:
  enabled: true    # the default; requires a login
  insecure: false  # set true only for a deployment truly isolated behind the
                    # dashboard's own NetworkPolicy -- see AUTH.md
```

Con `enabled: true` (il valore predefinito) il chart genera un account amministratore nel Secret della release alla prima installazione, come genera la password del database e il token MCP, e lo riutilizza a ogni aggiornamento:

```bash
kubectl get secret hotloop -n hotloop \
  -o jsonpath='{.data.admin-password}' | base64 -d
```

Impostare esplicitamente `auth.admin.password` sostituisce quella generata.

### Sicurezza

I valori che decidono se questo pod può muovere i macchinari.

```yaml
safety:
  allowWrites: false      # the master switch -- off by default since 4.4.0
  allowMcpWrites: true    # agents (MCP) write wherever an operator could, once writes are on
  confirmWrites: true     # the UI asks before writing
```

Le scritture sono disattivate per impostazione predefinita. Un tag è di sola lettura finché non viene impostato il suo flag `writable`, un valore fuori dall'intervallo configurato del tag viene rifiutato (mai troncato: inviare 250 quando qualcuno ha digitato 500 significa fare altro in silenzio), e ogni tentativo, **compreso ogni rifiuto**, viene registrato con l'attore e l'origine. Ma un'installazione nuova non dovrebbe aver bisogno che tutte e tre le cose coincidano per essere sicura, quindi l'interruttore generale parte chiuso.

Per attivare le scritture dopo che la distribuzione è stata verificata:

```yaml
safety:
  allowWrites: true
```

Basta questo: i client MCP leggono e scrivono come un operatore, con gli stessi permessi, tag scrivibili e intervalli. `allowMcpWrites` è attivo in ogni chart; esiste per una distribuzione che decida diversamente, e non è un valore predefinito da nessuna parte.

### Storico

```yaml
historian:
  retentionDays: 90     # 0 keeps everything until the volume fills
  useTimescale: true

logbook:
  retentionDays: 90     # entity state changes; 0 keeps everything (see LOGBOOK.md)

database:
  postgresql:
    persistence:
      size: 20Gi
      storageClass: longhorn
```

Il dimensionamento dipende dal numero di tag, dalla frequenza di lettura e dalle bande morte. Mille tag a un secondo senza bande morte sono circa 86 milioni di righe al giorno; lo stesso impianto con bande morte sensate ne ha di solito un ordine di grandezza in meno. Imposta le bande morte prima di comprare spazio di archiviazione.

`useTimescale: false` forza il percorso del partizionamento nativo, che è come appare il funzionamento su un PostgreSQL semplice. Utile per riprodurre una distribuzione edge.

**Quando cambia l'immagine di TimescaleDB.** L'immagine contiene la libreria di ogni versione precedente, quindi un database creato con un'immagine più vecchia continua a funzionare con la nuova, ma sulla vecchia versione dell'estensione, e vi resta finché qualcuno non esegue `ALTER EXTENSION timescaledb UPDATE`. Il Gateway lo fa all'avvio: confronta la versione installata con quella fornita dal server e, se differiscono, esegue l'aggiornamento come prima istruzione di una connessione nuova (TimescaleDB lo rifiuta in una sessione che ha già caricato la vecchia versione). Il log riporta `timescaledb extension updated from=... to=...`. Serve un superutente, cosa che è l'utente del database incluso. Con un database esterno o gestito dove non lo è, ottieni un avviso con il comando da eseguire, e lo storico continua a funzionare sulla vecchia versione nel frattempo. Succede solo con `useTimescale` attivo e le migrazioni eseguite all'avvio (`HOTLOOP_DB_MIGRATE`, attivo per impostazione predefinita).

### Polling

```yaml
runtime:
  defaultPollIntervalMs: 1000
  minPollIntervalMs: 100      # a floor applied to every device
  timeoutMs: 10000
  maxConcurrentPolls: 32
```

`minPollIntervalMs` viene fatto rispettare invece di essere dato per scontato. Un polling a 10 ms verso un gateway seriale è un denial of service con qualche passaggio in più.

### Client OPC UA

```yaml
opcuaClient:
  persistence:
    enabled: true      # off by default
    size: 64Mi
```

Un dispositivo che si connette a un server OPC UA protetto, o che accede con un nome utente e una password che il server richiede cifrati, conserva un certificato e un archivio di fiducia dei certificati server approvati (`HOTLOOP_OPCUA_CLIENT_PKI_DIR`, `/data/opcua-client-pki`). Attivalo prima di aggiungere un dispositivo simile: il filesystem radice è di sola lettura, quindi senza il volume il dispositivo segnala un errore che lo dice invece di connettersi con certificati che andrebbero persi al riavvio successivo. È disattivato per impostazione predefinita perché aggiunge un PersistentVolumeClaim a un'installazione esistente, che resta in Pending su un cluster senza StorageClass predefinita. I dispositivi anonimi su un canale non protetto non lo usano. Approvare il certificato di un server, e tutto il resto su questi dispositivi, è in [Protocolli e driver](/it/iot/protocols/#opc-ua-sicurezza-e-credenziali).

### Rete

```yaml
networkPolicy:
  enabled: true
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: dashboard-system
      ports:
        - protocol: TCP
          port: 8080
```

Restringi l'ingress al namespace della dashboard una volta noto. L'egress è volutamente illimitato: questa app esiste per raggiungere apparecchiature a indirizzi che nessuno può elencare in anticipo, e una policy di egress che blocca in silenzio un polling sembra un driver rotto più che una regola di firewall.

### Hardware: radio USB, adattatori seriali e Bluetooth

Dalla 4.19.7 ogni chart HotLoop (Gateway, IoT, Edge ed Edge Relay) viene fornito con l'accesso di cui l'hardware ha bisogno, attivo, così un'installazione semplice dall'App Store o da helm vede ciò che è collegato al nodo senza alcuna modifica a mano, sulla rete dei pod. È il blocco `hardware:` di `values.yaml`: tre interruttori attivi per impostazione predefinita e uno facoltativo disattivato:

| Valore | Predefinito | Cosa fa |
|---|---|---|
| `hardware.privileged` | `true` | Il container dell'app viene eseguito privilegiato (`privileged: true`, `allowPrivilegeEscalation: true`) e come root (`runAsUser: 0`, `runAsNonRoot: false`, senza rimozione delle capability). Root perché un nodo seriale USB è `root:dialout 0660` e la policy D-Bus di BlueZ fa entrare root e il gruppo `bluetooth`; un utente del container in nessuno dei due non apre nulla. Il filesystem radice resta di sola lettura, e l'init container e il database incluso mantengono il proprio contesto non root, con tutte le capability rimosse. |
| `hardware.usbDevices.enabled` | `true` | Il `/dev` del nodo (`hardware.usbDevices.hostPath`) viene montato su `/dev`: adattatori seriali USB (`/dev/ttyUSB*`, `/dev/ttyACM*`, `/dev/serial/by-id/*`), anche uno collegato dopo l'avvio del pod. A un container privilegiato vengono consegnati solo i dispositivi esistenti al suo avvio; il montaggio è ciò che fa comparire una chiavetta ricollegata. |
| `hardware.bluetooth.enabled` | `true` | La directory D-Bus del nodo (`hardware.bluetooth.dbusPath`, `/run/dbus`, che contiene `system_bus_socket`) viene montata nello stesso percorso, così un client raggiunge il BlueZ del nodo. Viene creata vuota su un nodo senza D-Bus, quindi il pod parte comunque. |
| `hardware.bluetooth.hostNetwork` | `false` | L'opzione da attivare, disattivata per impostazione predefinita, per ciò che richiede la rete del nodo: i socket Bluetooth del kernel (HCI, L2CAP) esistono solo nel network namespace del nodo, quindi un client che ne apre uno direttamente, e la discovery che ascolta sulla rete propria del nodo (mDNS, SSDP, il multicast di una radio), ne hanno bisogno. Un client che passa dall'API D-Bus di BlueZ ha bisogno solo del socket montato e funziona dalla rete dei pod. Attivato, il pod gira sulla rete del nodo con le conseguenze descritte in [Rete](#rete). |

Cosa ne fa oggi HotLoop: ancora nulla. HotLoop non ha codice proprio per Bluetooth, Z-Wave o seriale USB (Zigbee arriva tramite un bridge Zigbee2MQTT su MQTT, vedi [il broker MQTT integrato](/it/iot/broker/)); è l'accesso di cui ha bisogno una funzione, o un sidecar che legge una radio, già pronto prima che venga richiesto.

Quanto costa, volutamente e per decisione: il pod è root sul nodo (privilegiato, con il `/dev` del nodo), e la NetworkPolicy predefinita del chart resta attiva per ciò che copre. Il pod resta sulla rete dei pod. Disattiva qualsiasi parte con `--set hardware.privileged=false --set hardware.usbDevices.enabled=false --set hardware.bluetooth.enabled=false`; con tutte e tre disattivate il rendering è, riga per riga, il pod che produceva la 4.19.6 (non root, ogni capability rimossa, radice di sola lettura, rete dei pod). Per ciò che richiede la rete del nodo, imposta `hardware.bluetooth.hostNetwork=true` (o `hostNetwork=true`): la pagina risponde allora su ogni indirizzo del nodo a `service.targetPort`, un HotLoop per nodo e per porta, una NetworkPolicy non si applica al pod, e `nodeSelector` lo fissa al nodo di cui deve vedere la radio.

### Distribuzioni edge

L'immagine dell'app è costruita per amd64 e arm64, e TimescaleDB 2.30.1-pg17 è multi-architettura, quindi non è lo storico a bloccare un'installazione edge.

```yaml
resources:
  requests: {cpu: 100m, memory: 128Mi}
  limits:   {cpu: 500m, memory: 256Mi}

database:
  postgresql:
    persistence: {size: 5Gi}
    resources:
      requests: {cpu: 100m, memory: 256Mi}
      limits:   {cpu: 500m, memory: 512Mi}

historian:
  retentionDays: 30

nodeSelector:
  kubernetes.io/arch: arm64
```

### Pubblicare a monte con Sparkplug

Un Gateway edge può anche pubblicare tutto ciò che legge verso uno centrale, come nodo edge Sparkplug B. Vedi [Pubblicazione edge e store-and-forward](/it/edge/edge-publish/) per cosa pubblica e come si comporta la coda di inoltro; questo è il lato del chart.

```yaml
edgePublish:
  enabled: true
  broker: tcp://central.example.local:1883
  group: Plant1
  node: press-line-3          # empty uses the release name
  username: press-line-3
  existingSecret: central-mqtt # key "password", or set secretKey
  tls: false
  queueMaxBytes: 536870912     # 512 MiB; the default is 64 MiB, and 0 is unbounded
  persistence:
    size: 1Gi
```

Cosa cambia attivandolo, e perché:

- **Un PVC da 1Gi per la coda di inoltro**, montato su `/data/edge-publish`. È lì che si accumulano le letture mentre il collegamento in uscita è interrotto, quindi deve sopravvivere al pod. `persistence.enabled: false` la mette su un emptyDir, che sopravvive al riavvio di un container e a nient'altro.
- **Il Deployment si aggiorna con `Recreate`.** La coda è un unico file con un lock. Un aggiornamento graduale avvia prima il nuovo pod, il nuovo pod non riesce ad aprire la coda, non diventa mai pronto e il rollout resta fermo per sempre. Recreate ferma prima il vecchio; si perdono pochi secondi di polling a ogni aggiornamento.
- **`replicaCount` deve essere 1**, e il chart si rifiuta di fare il rendering altrimenti. Due repliche sarebbero due publisher che rivendicano un solo nodo Sparkplug.
- **L'id del nodo è per impostazione predefinita il nome della release**, non l'hostname del pod. L'hostname cambia a ogni rollout, e un host Sparkplug vedrebbe ogni volta un nodo edge nuovo.

La password non finisce mai in un valore predefinito in chiaro. Lascia `password` ed `existingSecret` vuoti per un broker anonimo e non viene creato alcun Secret; imposta `password` e il chart la mette in `<release>-edge-publish`; imposta `existingSecret` per usarne uno che gestisci tu.

### Database esterno

```yaml
database:
  postgresql:
    enabled: false
    auth:
      existingSecret: my-db-credentials
      secretKey: password
  external:
    host: timescale.plant.local
    port: 5432
    database: industrial
    username: industrial
  sslMode: require
```

L'app rileva TimescaleDB e promuove `tag_history` a hypertable quando l'estensione è presente. Su un PostgreSQL semplice ripiega sul partizionamento nativo per intervalli invece di fallire.

La decisione viene registrata ed è **definitiva**. Un database creato come hypertable si rifiuta di avviarsi su un server senza l'estensione invece di scrivere in silenzio altrove; se vedi questo errore, hai puntato l'app a un database diverso da quello su cui era stata costruita.

### SQLite

Il database è un'impostazione, non un'immagine. Ogni prodotto funziona su SQLite, Postgres o TimescaleDB con lo stesso binario (IoT salta TimescaleDB, vedi sotto):

| Variabile | Predefinito | Cosa fa |
|---|---|---|
| `HOTLOOP_DB_TYPE` | `postgres` | `postgres` o `sqlite`. TimescaleDB è `postgres` con l'estensione sul server |
| `HOTLOOP_DB_PATH` | `/data/hotloop.db` | Il file SQLite. Lo legge solo SQLite |

SQLite è la versione pura Go (`modernc.org/sqlite`), compilata in ogni immagine, quindi niente secondo container, niente immagine Postgres da 300 MB su una scheda SD, e le build arm restano statiche. Metti il file su un volume che sopravvive al container, e su un Pi metti quel volume su un SSD USB. Uno storico che scrive tutto il giorno su una scheda SD è il modo di comprare molte schede SD.

Cosa è uguale: ogni tabella, ogni colonna, ogni funzione. Cosa è diverso:

- Lo storico è una tabella con un indice, non partizioni né una hypertable, e la retention elimina le righe vecchie invece di scartare interi mesi. Un sito con anni di storico a un secondo vuole Postgres o TimescaleDB, e passarci è un backup e un ripristino (BACKUP.md).
- Un solo scrittore alla volta. SQLite alterna le scritture e legge accanto a esse (WAL), più che sufficiente per un HotLoop e un helper `--mcp-stdio` accanto sullo stesso file. Non è per due repliche su storage di rete: SQLite su NFS si corrompe, quindi una distribuzione SQLite è un pod con un volume locale.
- I commit sono `synchronous=FULL`: quando l'API dice di aver salvato, è su disco, con o senza interruzione di corrente.

**HotLoop IoT** usa per impostazione predefinita 30 giorni di storico (`HOTLOOP_HISTORIAN_RETENTION_DAYS` prevale ancora quando è impostato) e non costruisce mai una hypertable: TimescaleDB fa parte di Edge e del Gateway. Imposta `HOTLOOP_HISTORIAN_TIMESCALE=true` su IoT e lo dice all'avvio e funziona su partizioni semplici. Un database spostato da un Edge o da un Gateway che ha già una hypertable la mantiene e continua a funzionare.

#### Scegliere il database nel chart

Un solo valore, `database.type`, e ogni prodotto accetta quelli su cui funziona:

| `database.type` | Cosa viene distribuito | IoT | Edge | Gateway |
|---|---|---|---|---|
| `timescaledb` | L'app e TimescaleDB (uno StatefulSet e il suo volume). Storico in una hypertable | rifiutato | predefinito | predefinito |
| `postgresql` | L'app e PostgreSQL 17 semplice (uno StatefulSet e il suo volume). Storico in partizioni native | predefinito | sì | sì |
| `sqlite` | La sola app, con il file del database su un volume proprio | sì | sì | sì |

```bash
helm install hotloop hotloop/hotloop-iot --namespace hotloop --create-namespace   --set database.type=sqlite
```

Chiedere `timescaledb` a IoT fa fallire l'installazione e dice su cosa funziona IoT (`database.type is "timescaledb", and HotLoop IoT runs on sqlite, postgresql`), e il modulo dell'App Store non lo offre. `helm lint` non lo coglie (helm 3.22 lo dà per pulito), quindi a rifiutarlo è il rendering. Omettere `database.type` dà il valore predefinito del prodotto, così un aggiornamento con `--reuse-values` da prima che la chiave esistesse mantiene il database che aveva.

`sqlite` produce:

- `HOTLOOP_DB_TYPE=sqlite` e `HOTLOOP_DB_PATH=/data/db/hotloop.db`, e nessuna delle impostazioni di connessione di Postgres. Nessun pod del database, nessuna password del database nel Secret, nessun init container che ne attende una.
- Un PersistentVolumeClaim chiamato `<release>-db` (`database.sqlite.persistence`: `size`, `storageClass`, `accessMode`, 10Gi e il valore predefinito del cluster per cominciare), montato su `/data/db`. La directory, non il file: SQLite tiene un `-wal` e un `-shm` accanto al database. Mettilo su storage locale; SQLite su NFS si corrompe.
- Il Deployment su `Recreate`, non un aggiornamento graduale, perché il volume è `ReadWriteOnce` e il file ha un solo scrittore. Un `replicaCount` superiore a 1 fa fallire l'installazione.

La NetworkPolicy non cambia ed è attiva: la policy propria dell'app si applica ancora, e la policy del database viene prodotta solo quando c'è un pod del database da proteggere.

Cambiare `database.type` su una release che ha già dati non sposta i dati. Il nuovo database parte vuoto, quindi spostare un impianto da un database all'altro è un backup e un ripristino (BACKUP.md), come con la variabile. In particolare un database creato come hypertable TimescaleDB si rifiuta di avviarsi su PostgreSQL semplice, quindi non passare un Edge o un Gateway esistente da `timescaledb` a `postgresql` aspettandoti che parta.

#### Scegliere il database in Quadlet

La directory di ogni prodotto sotto `deploy/quadlet/` ha i file PostgreSQL o TimescaleDB com'erano, e una directory `sqlite/` accanto: `hotloop.container` e `hotloop-data.volume`, la sola app con il file in `/data/hotloop.db` sul volume `hotloop-data`. Segue `:stable` e annulla un aggiornamento difettoso allo stesso modo. Installa quei due file al posto degli altri (usano gli stessi nomi di unit) e crea due secret invece di tre: non c'è password del database. [`deploy/quadlet/README.md`](/it/install/quadlet/) ha i passaggi.

Per partizioni Postgres semplici su Edge o sul Gateway con Quadlet, tieni l'unit TimescaleDB e aggiungi `Environment=HOTLOOP_HISTORIAN_TIMESCALE=false` a `hotloop.container`. L'unit di IoT esegue già PostgreSQL semplice.

### La chiave delle credenziali dei dispositivi

```yaml
secretKey:
  enabled: true
  existingSecret: ""     # or a Secret you manage, with the key under secret.key
```

Le password dei dispositivi (l'accesso a una console UniFi, una password OPC UA o MQTT, le chiavi API HTTP) sono cifrate nel database con questa chiave, quindi un dump o un backup contiene testo cifrato. Di serie il chart ne genera una in `<release>-secret-key` alla prima installazione, la mantiene a ogni aggiornamento e la mantiene anche con `helm uninstall` (`helm.sh/resource-policy: keep`), perché un database conservato sul suo volume non serve per le sue credenziali senza di essa. Viene montata come file e passata come `HOTLOOP_SECRET_KEY_FILE`, mai come variabile d'ambiente.

Fai il backup del Secret separatamente da quelli del database: una chiave accanto ai backup che protegge non protegge nulla. Per portare la tua, `hotloop gen-secret-key` ne stampa una. Fuori da Kubernetes, scrivila in un file che solo HotLoop può leggere e punta `HOTLOOP_SECRET_KEY_FILE` a esso. Senza chiave HotLoop funziona, dice nel log di avvio che le password dei dispositivi sono memorizzate come digitate e rifiuta di salvare una console UniFi. Le credenziali già memorizzate vengono cifrate al primo avvio con una chiave. Vedi [Backup e ripristino](/it/iot/backup/#credenziali-dei-dispositivi-e-chiave-segreta) per cosa significa per un ripristino.

## Configurazione, e cosa può cambiare la schermata Impostazioni

Quasi ogni impostazione viene da una variabile d'ambiente che il chart imposta a partire da un valore Helm. È il posto giusto: la configurazione che decide se questo processo può comandare macchinari appartiene alla distribuzione, rivista, non a un modulo su una pagina web.

La schermata **Impostazioni** le mostra tutte, ogni impostazione, il suo valore effettivo, se viene dal database, da una variabile d'ambiente o dal valore predefinito integrato, e la variabile che lo cambia. Per la maggior parte è di sola lettura, ed è il punto: la domanda a cui risponde è "perché fa così, e cosa cambio?"

Quattro impostazioni sono identità dell'impianto e non comportamento, e sono modificabili lì. Sono memorizzate nel database e hanno effetto subito, perché un impianto viene rinominato molto più spesso di quanto venga ridistribuito:

| impostazione | variabile che sostituisce |
|---|---|
| Nome impianto | `HOTLOOP_PLANT_NAME` |
| ID sito | `HOTLOOP_SITE_ID` |
| Fuso orario | `HOTLOOP_TIMEZONE` |
| Conferma prima di scrivere | `HOTLOOP_CONFIRM_WRITES` |

Sotto le impostazioni ci sono schede che sono dati e non configurazione, e sono modificabili per lo stesso motivo: **Utenti** ([Autenticazione e utenti](/it/iot/authentication/)), **Escalation degli allarmi**, che dice chi viene avvisato dopo quando nessuno riconosce un allarme e quando ([Notifiche degli allarmi](/it/iot/notifications/#escalation)), e le destinazioni dello storico e gli accessi MQTT. I canali che un'escalation può usare restano della distribuzione, impostati da `HOTLOOP_NOTIFY_*`.

Un valore memorizzato prevale sulla variabile d'ambiente, quindi il valore del chart diventa il punto di partenza e non l'ultima parola. Un fuso orario che la macchina non sa risolvere viene rifiutato invece di essere accettato e ignorato in silenzio, il che lascerebbe ogni marca temporale ripiegare su UTC senza che nulla dica perché.

Lo stesso vale per il valore della distribuzione. Se `HOTLOOP_TIMEZONE` (o `TZ`, quando quella non è impostata) indica un fuso che non si carica, HotLoop si rifiuta di avviarsi e l'errore nomina la variabile e il valore. Prima faceva spallucce e girava in UTC. Report, pianificazioni e orari dei turni seguono l'orologio dell'impianto, e una supposizione sbagliata di ore è peggio di un pod che dice perché non parte.

La posizione del sito è `HOTLOOP_SITE_LATITUDE` e `HOTLOOP_SITE_LONGITUDE` (chart: `plant.latitude`, `plant.longitude`), in gradi decimali, nord ed est positivi. Alba, tramonto e le entità e i trigger del sole sono calcolati da essi sulla macchina ([Il sole](/it/iot/sun/)). Entrambi o nessuno, e uno errato blocca l'avvio nominando la variabile. La schermata Impostazioni li mostra di sola lettura: le regole scattano su un'alba, quindi spostarla è una distribuzione.

**Gli interruttori di sicurezza non sono modificabili e non lo saranno.** `HOTLOOP_ALLOW_WRITES` è il controllo principale sul fatto che questo processo possa comandare le apparecchiature; un controllo che si può riattivare dalla stessa sessione del browser che emette le scritture non è un controllo. Anche `HOTLOOP_HISTORIAN_RETENTION_DAYS` è solo della distribuzione: la policy di retention viene applicata al database all'avvio, quindi un campo su una schermata sembrerebbe funzionare senza spostare alcun dato. L'endpoint rifiuta qualsiasi chiave fuori dall'insieme modificabile **per nome**, invece di ignorarla.

Un limite, dichiarato perché lo dichiara anche la schermata: il server MCP costruisce le proprie istruzioni all'avvio, quindi annuncia il nome dell'impianto con cui è partito finché il pod non viene riavviato. Tutto il resto recepisce una ridenominazione alla richiesta successiva.

## PostgreSQL 17

Il database di HotLoop è PostgreSQL 17 (con TimescaleDB 2.30.1 per Edge e il Gateway, PostgreSQL 17.11 semplice per IoT e per `database.type: postgresql`). Le release precedenti giravano su PostgreSQL 16, e PostgreSQL non apre la directory dati di un'altra versione maggiore. Quindi il passaggio è fatto per te, all'aggiornamento, e non c'è nulla da eseguire.

**Sul chart,** il pod del database riceve due init container. Il primo esegue l'immagine PostgreSQL 16 e, solo quando il volume contiene dati 16, copia quell'installazione in un volume temporaneo. Il secondo esegue la nuova immagine e fa `pg_upgrade` in una nuova directory accanto alla vecchia. Entrambi lasciano in pace un volume nuovo o già alla 17. L'aggiornamento è `helm upgrade`, nient'altro. Aspettati che il pod del database resti in `Init` per il tempo che richiede una copia dei dati, e che l'app lo attenda; `kubectl logs <release>-postgresql-0 -c pg-upgrade` è il log.

**Su Quadlet,** `hotloop-db-upgrade.container` viene eseguito prima di `hotloop-db.service` e fa la stessa cosa in una unit oneshot. Copia i nuovi `hotloop-db.container`, `hotloop-db-upgrade.container` e `hotloop-db-upgrade.sh` dalla directory del tuo prodotto nella directory delle unit e riavvia l'unit del database; il [README di Quadlet](/it/install/quadlet/) ha i comandi. L'unit del database richiede l'unit di aggiornamento, quindi una macchina che ha ricevuto solo la nuova unit del database non parte su dati 16 e dice perché: fallisce, non tira a indovinare. `journalctl -u hotloop-db-upgrade` è il log. L'unit viene eseguita solo quando il volume contiene dati 16: su una macchina nuova, e a ogni avvio dopo l'aggiornamento, systemd la salta (risulta inattiva, non fallita) e l'immagine PostgreSQL 16 non viene mai scaricata. Quando il volume contiene davvero dati 16, l'unit scarica prima quell'immagine.

Cosa fa, in ordine, tutto in `hotloop-pg-upgrade.sh` (un solo file, lo stesso che eseguono il chart e le unit):

1. Nessuna directory dati, o una già alla 17: nulla, e lo dice. Qualsiasi altra versione maggiore viene rifiutata, senza cambiare nulla.
2. Avvia una volta il vecchio server su un socket privato e lo ferma in modo pulito, il che riproduce il log dopo un'interruzione di corrente e legge la codifica e la locale che il nuovo cluster deve rispettare.
3. Esegue `initdb` di una nuova directory accanto alla vecchia con quelle impostazioni, esegue `pg_upgrade` in modalità copia (la vecchia directory viene solo letta) e riporta `postgresql.conf`, `postgresql.auto.conf`, `pg_hba.conf` e `pg_ident.conf`.
4. Avvia una volta il nuovo server per dimostrare che si apre con le impostazioni finali e raccoglie le statistiche del planner che `pg_upgrade` non riporta.
5. Solo allora scambia i nomi: la vecchia directory diventa `pgdata.pg16`, la nuova `pgdata`.

Serve all'incirca tanto spazio libero accanto ai dati quanto occupano i dati, e lo verifica prima di iniziare. Se qualcosa fallisce prima del passo 5, l'aggiornamento esce con codice diverso da zero, i dati 16 restano esattamente come erano e il database non parte su una directory costruita a metà: sul chart il pod resta in `Init:Error`, su Quadlet l'unit di aggiornamento fallisce e l'unit del database dietro di essa non parte mai. Correggi ciò che dice il log e riavvia; un tentativo incompleto viene rimosso e rifatto. L'estensione TimescaleDB passa alla versione in cui era, e l'app la aggiorna a quella fornita al successivo avvio, come sempre. L'indicazione di TimescaleDB per un aggiornamento di PostgreSQL sul posto è `pg_upgrade` con i binari vecchi e nuovi ([Tiger Data, "Upgrade PostgreSQL"](https://www.tigerdata.com/docs/deploy/self-hosted/upgrades/upgrade-pg)).

Il backup è la vecchia directory stessa. `pg_upgrade` in modalità copia non vi scrive mai, quindi `pgdata.pg16` è l'intero database PostgreSQL 16 com'era, che è un backup migliore di un dump e l'unica cosa che rende possibile il ritorno indietro descritto sotto. Il backup di HotLoop ([Backup e ripristino](/it/iot/backup/)) viene fatto dall'app in esecuzione attraverso il database in esecuzione, quindi non può essere preso nel passo che gira prima dell'avvio del database. Fanne comunque uno con la release precedente prima di aggiornare, e copialo fuori dalla macchina.

### Tornare indietro

`helm rollback`, o rimettere il precedente `hotloop-db.container`, riporta il database all'immagine PostgreSQL 16 (l'aggiornamento automatico di Podman non lo fa: sposta solo l'app), e PostgreSQL 16 non apre una directory 17 (`database files are incompatible with server`, il log dice che la directory è stata inizializzata dalla versione 16). Non si perde nulla e nulla resta cambiato a metà; il database semplicemente non parte. Ciò di cui ha bisogno la release precedente è la propria directory 16, cioè `pgdata.pg16`. Ferma il database, poi rimetti i nomi:

```sh
# chart: after the rollback, stop the database, swap in a one-off pod, start it
kubectl -n hotloop scale statefulset/hotloop-postgresql --replicas=0
kubectl -n hotloop run pgswap --rm -it --restart=Never --image=busybox \
  --overrides='{"spec":{"securityContext":{"runAsUser":999,"fsGroup":999},"containers":[{"name":"pgswap","image":"busybox","command":["sh","-c","cd /d && mv pgdata pgdata.pg17 && mv pgdata.pg16 pgdata"],"volumeMounts":[{"name":"d","mountPath":"/d"}]}],"volumes":[{"name":"d","persistentVolumeClaim":{"claimName":"data-hotloop-postgresql-0"}}]}}'
kubectl -n hotloop scale statefulset/hotloop-postgresql --replicas=1

# Quadlet: the volume is named hotloop-db
sudo systemctl stop hotloop.service hotloop-db.service
d=$(sudo podman volume inspect hotloop-db --format '{{.Mountpoint}}')
sudo mv "$d/pgdata" "$d/pgdata.pg17" && sudo mv "$d/pgdata.pg16" "$d/pgdata"
```

Quello è il database com'era all'aggiornamento, e nulla di ciò che è stato scritto dopo. Il ritorno funziona una sola volta: l'aggiornamento si rifiuta di partire finché c'è un `pgdata.pg16` di mezzo, quindi il tentativo successivo richiede prima `pgdata.pg17` e di sistemare la vecchia directory. Andare avanti è la strada, e un rollback è per una macchina che non può proprio eseguire la 17. La regola di rollback dell'app non cambia: lo schema della directory 16 è quello lasciato dalla release prima dell'aggiornamento, e una release che trova migrazioni che non conosce lo dice, vedi [Le migrazioni si limitano ad aggiungere](/it/iot/migrations/).

### Quando sei soddisfatto

`pgdata.pg16` resta finché non lo elimini, perché eliminarlo significa eliminare l'unica via di ritorno. È grande quanto il database. Quando la macchina ha girato sulla 17 per quanto vuoi:

```sh
# chart
kubectl -n hotloop exec hotloop-postgresql-0 -c postgresql -- rm -rf /var/lib/postgresql/data/pgdata.pg16
# Quadlet
sudo rm -rf "$(sudo podman volume inspect hotloop-db --format '{{.Mountpoint}}')/pgdata.pg16"
```

### Disattivarlo

`database.postgresql.upgrade.enabled: false` elimina gli init container. Un volume ancora alla 16 impedisce allora l'avvio del database, e il passaggio spetta a te. Lascialo attivo: attivo, un'installazione nuova scarica comunque l'immagine PostgreSQL 16 una volta per nodo, perché l'immagine di un init container viene scaricata prima di essere eseguita, e poi non la esegue mai.

## Aggiornare dalla 3.x

**Questa è una sostituzione, non un aggiornamento.** La 3.x era un prodotto diverso. Non c'è percorso di migrazione per i suoi dati, perché non condivide alcun modello di dati con uno storico di tag.

```bash
helm uninstall hotloop -n hotloop
# keep or delete the old PVCs deliberately, they hold the HA recorder database
helm install hotloop ./charts/hotloop -n hotloop
```

Cose che non esistono più e verranno rifiutate se impostate: `sidecarProxy`, `homeassistant`, i componenti aggiuntivi `mqtt`/`nodered`/`esphome`/`zigbee2mqtt`, `devices`, `cameras`, `customConfig`, `network.hostNetwork`.

## Annullare un aggiornamento

`helm rollback hotloop -n hotloop` rimette l'immagine della release precedente. Non rimette il database: una release migra all'avvio, e questo resta fatto. La regola e la verifica sono in [Le migrazioni si limitano ad aggiungere](/it/iot/migrations/).

L'unica cosa che un rollback attraverso la release PostgreSQL 17 rimette è il motore del database: l'immagine del database del chart torna alla 16, che non aprirà la directory aggiornata. [Tornare indietro](#tornare-indietro) è la via d'uscita.

È sicuro per una release indietro. Il database registra quale release ha applicato ogni migrazione, e una release che trova migrazioni di due o più release più recenti di sé si rifiuta di avviarsi:

```
refusing to start: this database's schema is more than one release ahead of
HotLoop 4.18.10. ...
```

Non è un difetto da aggirare. Significa che il database è andato più avanti di quanto questa release sia mai stata eseguita. Vai avanti a una release che conosce lo schema, cioè la più recente, oppure ripristina un backup fatto dalla release in uso ([Backup e ripristino](/it/iot/backup/)). Esattamente una release indietro parte, con un avviso nel log che nomina entrambe le versioni. Fai un backup prima di aggiornare; il rollback non può annullare i dati scritti dalla release più recente.

## Verificare un'installazione

```bash
kubectl -n hotloop get pods
kubectl -n hotloop logs deploy/hotloop | head -20
```

Un avvio sano dice i protocolli che parla, applica le migrazioni, riporta la modalità dello storico e avvisa di tutto ciò che vale la pena sapere:

```
msg=starting version=4.0.0 protocols="[ethernet-ip http modbus mqtt mtconnect opcua s7comm]"
msg="writes are ENABLED: the UI, API, automations and MCP can all command devices"
msg="tag_history promoted to a hypertable" timescale=2.30.1
msg="history schema ready" mode=timescale
msg=listening addr=:8080 mcp=/mcp writes=true
```

Poi controlla le etichette di cui la dashboard ha bisogno. È il controllo che coglie la deriva: verifica l'**insieme**, non il numero, perché un controllo sul numero passa mentre l'insieme è sbagliato:

```bash
kubectl -n hotloop get svc <release> -o json \
  | jq -r '.metadata.labels | keys[] | select(startswith("embernet.ai/"))'
```

Esattamente quattro, sul Service e sul pod:

```
embernet.ai/app-name
embernet.ai/gui-port
embernet.ai/gui-type
embernet.ai/store-app
```

Se l'app è in esecuzione ma manca da Applicazioni in esecuzione, le etichette del Service sono il primo posto dove guardare: la dashboard interroga i Service per `embernet.ai/store-app`.

Una distribuzione dall'App Store ne aggiunge altre cinque, dai `tenantLabels` che passa la dashboard: `embernet.ai/tenant`, `app-id`, `source`, `deployed-by` e `deployment-id`. Vanno su ogni risorsa che il chart produce e sul pod del gateway. La dashboard legge il tenant dal Service e da nessun'altra parte, quindi un Gateway distribuito dallo store senza `embernet.ai/tenant` sul suo Service non appartiene a nessuno. Un semplice `helm install` non ne produce nessuna delle cinque.

## Probe

- `/healthz`, liveness. Risponde finché il processo è in esecuzione.
- `/readyz`, readiness. Richiede inoltre il database, così un pod che ha perso il suo storico smette di ricevere traffico invece di servire un'interfaccia che non sa rispondere a nulla.

La probe di avvio concede due minuti, perché una prima installazione esegue le migrazioni e la probe di liveness non deve ucciderla a metà migrazione.

## Arresto

`terminationGracePeriodSeconds: 45`. Su SIGTERM l'app smette di accettare richieste, poi svuota la coda dello storico così le letture già acquisite vengono scritte invece di essere buttate. Accorciare troppo il periodo di grazia perde ciò che era in volo.

## Risoluzione dei problemi

**Un dispositivo resta in `connecting`.** Guarda `lastError` sulla scheda del dispositivo. Più spesso un firewall tra il pod e l'apparecchiatura, o la porta sbagliata. Il chart non limita l'egress, quindi una NetworkPolicy che lo blocca è qualcos'altro sul cluster.

**I tag leggono qualità pessima.** Il dispositivo ha risposto ma il punto no. Per Modbus, controlla la base degli indirizzi, `oneBased` se i tuoi disegni usano la numerazione 40001. Per OPC UA, controlla che il node id sia stato risolto; preferisci la forma `nsu=`.

**I valori sembrano plausibili ma sbagliati.** Su Modbus, è l'ordine delle parole, prova `CDAB`. È il guasto che non si annuncia, perché il numero non è ovviamente sbagliato.

**Non viene storicizzato nulla.** Controlla la diagnostica della schermata Protocolli. `filtered` conta le letture soppresse dalla banda morta, che funziona come previsto; `dropped` conta le letture perse perché il database non ha tenuto il passo, che non lo è.

**MCP restituisce 401.** Il token bearer. Leggilo dal Secret della release.

**Ogni richiesta a `/api/` restituisce 401.** Atteso una volta che `auth.enabled` è true e nessuno ha ancora effettuato l'accesso, è lo scopo della 4.4.0. Leggi la password amministratore generata dal Secret della release (vedi [Autenticazione](#autenticazione)) e accedi dall'interfaccia, oppure `POST /api/auth/login` direttamente. Vedi [Autenticazione e utenti](/it/iot/authentication/).

**Password amministratore persa e nessun altro account amministratore.** Genera un nuovo hash e correggi il Secret, poi riavvia il pod perché rilegga l'ambiente; `EnsureAdminUser` non toccherà un account che esiste già, quindi questo sostituisce direttamente la riga invece di passare dal chart:

```bash
hotloop hash-password -password 'a-new-one'
kubectl exec -n hotloop deploy/hotloop -- \
  psql "$DATABASE_URL" -c \
  "UPDATE users SET password_hash = '<the hash>' WHERE username = 'admin'"
```

**Un'automazione è abilitata ma non gira.** Non è stata compilata. La schermata Automazioni la mostra come NOT ARMED con il motivo, e il log di sistema contiene l'errore.
