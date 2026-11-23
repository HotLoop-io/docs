---
title: "k3s und Helm"
description: "Jedes HotLoop-Chart auf k3s oder jedem Kubernetes bereitstellen: die wichtigen Werte, die Wahl der Datenbank, Upgrades und Rollbacks."
---

Das Chart stellt zwei Workloads bereit: das Gateway (ein Deployment, das selbst keinen dauerhaften Zustand hält) und TimescaleDB (ein StatefulSet mit einem Volume). Das ist der Standard. `database.type` wählt eine andere Datenbank: reines PostgreSQL oder SQLite, das gar keine zweite Workload ist ([SQLite](#sqlite), weiter unten).

## Installation

Über den App Store des EmberNet-Dashboards oder direkt:

```bash
helm install hotloop ./charts/hotloop \
  --namespace hotloop --create-namespace
```

Oder aus dem Chart-Repository, das zugleich die URL ist, auf die der App Store zeigt:

```bash
helm repo add hotloop https://hotloop.io/hotloop
helm install hotloop hotloop/hotloop \
  --namespace hotloop --create-namespace
```

Diese zweite Form funktioniert ab 4.16.0, dem ersten Release, das als `hotloop` veröffentlicht wurde. Das letzte davor war `industrial-iot` 4.3.1 unter dem alten Namen, und das Upgrade von dort ist ein eigenes Verfahren: siehe "Upgrading from 4.3.1" in den Hinweisen zu 4.16.0 in der README. Die alte Repository-Adresse, `https://embernet-ai.github.io/industrial-iot/`, liefert einen 404.

Eine einfache Installation funktioniert. Das Chart erzeugt ein Datenbankpasswort und ein MCP-Token im Secret des Release und verwendet sie bei Upgrades weiter, sodass nichts angegeben werden muss und ein Upgrade das Passwort nicht unter einer laufenden Datenbank austauscht.

Dafür braucht es weder Ingress noch Subdomain. Das Dashboard erkennt die App an ihren Store-Labels und leitet sie über einen Proxy an der Cluster-internen Adresse weiter:

```
<release>.<namespace>.svc.cluster.local:8080
```

Um sie direkt anzusehen:

```bash
kubectl -n hotloop port-forward svc/hotloop 8080:8080
```

## Werte, die man setzen sollte

### Authentifizierung

Seit 4.4.0. Das vollständige Modell steht unter [Authentifizierung und Benutzer](/de/iot/authentication/); hier die Seite des Charts.

```yaml
auth:
  enabled: true    # the default; requires a login
  insecure: false  # set true only for a deployment truly isolated behind the
                    # dashboard's own NetworkPolicy -- see AUTH.md
```

Mit `enabled: true` (dem Standard) erzeugt das Chart bei der ersten Installation ein Administratorkonto im Secret des Release, genauso wie das Datenbankpasswort und das MCP-Token, und verwendet es bei Upgrades weiter:

```bash
kubectl get secret hotloop -n hotloop \
  -o jsonpath='{.data.admin-password}' | base64 -d
```

Wird `auth.admin.password` ausdrücklich gesetzt, ersetzt es das erzeugte.

### Sicherheit

Die Werte, die entscheiden, ob dieser Pod Maschinen bewegen kann.

```yaml
safety:
  allowWrites: false      # the master switch -- off by default since 4.4.0
  allowMcpWrites: true    # agents (MCP) write wherever an operator could, once writes are on
  confirmWrites: true     # the UI asks before writing
```

Schreibzugriffe sind standardmäßig aus. Ein Tag ist schreibgeschützt, bis sein eigenes Flag `writable` gesetzt ist, ein Wert außerhalb des konfigurierten Bereichs des Tags wird abgelehnt (nie begrenzt: 250 zu senden, wenn jemand 500 eingegeben hat, heißt, stillschweigend etwas anderes zu tun), und jeder Versuch, **auch jede Ablehnung**, wird mit Akteur und Quelle protokolliert. Aber eine frische Installation soll nicht erst alle drei Bedingungen brauchen, um sicher zu sein, deshalb beginnt der Hauptschalter selbst geschlossen.

Um Schreibzugriffe nach der Prüfung der Bereitstellung einzuschalten:

```yaml
safety:
  allowWrites: true
```

Das ist alles: MCP-Clients lesen und schreiben wie ein Bediener, mit denselben Rechten, beschreibbaren Tags und Bereichen. `allowMcpWrites` ist in jedem Chart an; es gibt es für eine Bereitstellung, die anders entscheidet, und es ist nirgends ein Standard.

### Historian

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

Die Dimensionierung richtet sich nach Tag-Anzahl, Abtastrate und Totbändern. Tausend Tags im Sekundentakt ohne Totbänder sind etwa 86 Millionen Zeilen pro Tag; dieselbe Anlage mit sinnvollen Totbändern hat meist eine Größenordnung weniger. Setzen Sie Totbänder, bevor Sie Speicher kaufen.

`useTimescale: false` erzwingt den Pfad mit nativer Partitionierung, wie er bei reinem PostgreSQL aussieht. Nützlich, um eine Edge-Bereitstellung nachzustellen.

**Wenn sich das TimescaleDB-Image ändert.** Das Image enthält die Bibliothek jeder älteren Version, eine mit einem älteren Image erstellte Datenbank läuft daher auf dem neuen weiter, aber mit der alten Version der Erweiterung, und bleibt dort, bis jemand `ALTER EXTENSION timescaledb UPDATE` ausführt. Das Gateway tut das beim Start: Es vergleicht die installierte Version mit der, die der Server mitbringt, und führt bei Abweichung das Update als erste Anweisung einer frischen Verbindung aus (TimescaleDB lehnt es in einer Sitzung ab, die die alte Version schon geladen hat). Das Log sagt `timescaledb extension updated from=... to=...`. Dafür ist ein Superuser nötig, was der Benutzer der mitgelieferten Datenbank ist. Bei einer externen oder verwalteten Datenbank, bei der das nicht so ist, erhalten Sie eine Warnung mit dem auszuführenden Befehl, und der Verlauf läuft in der Zwischenzeit auf der alten Version weiter. Das geschieht nur bei eingeschaltetem `useTimescale` und Migrationen, die beim Start laufen (`HOTLOOP_DB_MIGRATE`, standardmäßig an).

### Abfrage

```yaml
runtime:
  defaultPollIntervalMs: 1000
  minPollIntervalMs: 100      # a floor applied to every device
  timeoutMs: 10000
  maxConcurrentPolls: 32
```

`minPollIntervalMs` wird durchgesetzt statt vorausgesetzt. Eine Abfrage alle 10 ms gegen ein serielles Gateway ist ein Denial of Service mit zusätzlichen Schritten.

### OPC-UA-Client

```yaml
opcuaClient:
  persistence:
    enabled: true      # off by default
    size: 64Mi
```

Ein Gerät, das sich mit einem gesicherten OPC-UA-Server verbindet oder sich mit Benutzername und Passwort anmeldet, die der Server verschlüsselt verlangt, hält ein Zertifikat und einen Vertrauensspeicher für freigegebene Serverzertifikate (`HOTLOOP_OPCUA_CLIENT_PKI_DIR`, `/data/opcua-client-pki`). Schalten Sie das ein, bevor Sie ein solches Gerät hinzufügen: Das Root-Dateisystem ist schreibgeschützt, ohne das Volume meldet das Gerät also einen Fehler, der das sagt, statt sich mit Zertifikaten zu verbinden, die beim nächsten Neustart verloren gingen. Es ist standardmäßig aus, weil es einer bestehenden Installation einen PersistentVolumeClaim hinzufügt, der auf einem Cluster ohne Standard-StorageClass in Pending bleibt. Anonyme Geräte auf einem ungesicherten Kanal nutzen es nicht. Das Freigeben eines Serverzertifikats und alles Weitere zu diesen Geräten steht unter [Protokolle und Treiber](/de/iot/protocols/#opc-ua-sicherheit-und-zugangsdaten).

### Netzwerk

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

Beschränken Sie den Ingress auf den Namespace des Dashboards, sobald er bekannt ist. Der Egress ist absichtlich unbeschränkt: Diese App existiert, um Anlagen unter Adressen zu erreichen, die niemand vorab aufzählen kann, und eine Egress-Policy, die eine Abfrage stillschweigend blockiert, sieht eher nach einem kaputten Treiber aus als nach einer Firewall-Regel.

### Hardware: USB-Funkmodule, serielle Adapter und Bluetooth

Ab 4.19.7 wird jedes HotLoop-Chart (Gateway, IoT, Edge und der Edge Relay) mit eingeschaltetem Zugriff für Hardware ausgeliefert, sodass eine einfache Installation aus dem App Store oder mit helm sieht, was am Node steckt, ohne Handarbeit, im Pod-Netzwerk. Es ist der Block `hardware:` in `values.yaml`: drei Schalter, die standardmäßig an sind, und eine Option, die standardmäßig aus ist:

| Wert | Standard | Was er bewirkt |
|---|---|---|
| `hardware.privileged` | `true` | Der App-Container läuft privilegiert (`privileged: true`, `allowPrivilegeEscalation: true`) und als root (`runAsUser: 0`, `runAsNonRoot: false`, ohne Wegnahme von Capabilities). Root, weil ein serieller USB-Knoten `root:dialout 0660` ist und die D-Bus-Richtlinie von BlueZ root und die Gruppe `bluetooth` hineinlässt; ein Container-Benutzer in keiner von beiden öffnet nichts. Das Root-Dateisystem bleibt schreibgeschützt, und der Init-Container und die mitgelieferte Datenbank behalten ihren eigenen Kontext ohne root und ohne Capabilities. |
| `hardware.usbDevices.enabled` | `true` | Das `/dev` des Nodes (`hardware.usbDevices.hostPath`) wird nach `/dev` eingehängt: serielle USB-Adapter (`/dev/ttyUSB*`, `/dev/ttyACM*`, `/dev/serial/by-id/*`), auch einer, der nach dem Start des Pods eingesteckt wurde. Ein privilegierter Container bekommt nur die Geräte, die beim Start existierten; das Einhängen lässt einen neu eingesteckten Stick erscheinen. |
| `hardware.bluetooth.enabled` | `true` | Das D-Bus-Verzeichnis des Nodes (`hardware.bluetooth.dbusPath`, `/run/dbus`, das `system_bus_socket` enthält) wird am selben Pfad eingehängt, sodass ein Client das BlueZ des Nodes erreicht. Es wird auf einem Node ohne D-Bus leer angelegt, damit der Pod dort trotzdem startet. |
| `hardware.bluetooth.hostNetwork` | `false` | Die Option zum Selbstaktivieren, standardmäßig aus, für alles, was das Netzwerk des Nodes braucht: Bluetooth-Sockets des Kernels (HCI, L2CAP) gibt es nur im Netzwerk-Namespace des Nodes, daher brauchen ein Client, der einen direkt öffnet, und eine Erkennung, die im eigenen Netzwerk des Nodes lauscht (mDNS, SSDP, das Multicast eines Funkmoduls), sie. Ein Client, der die D-Bus-API von BlueZ nutzt, braucht nur den eingehängten Socket und funktioniert aus dem Pod-Netzwerk. Eingeschaltet läuft der Pod im Netzwerk des Nodes mit den Folgen, die unter [Netzwerk](#netzwerk) stehen. |

Was HotLoop heute damit macht: noch nichts. HotLoop hat keinen eigenen Code für Bluetooth, Z-Wave oder serielles USB (Zigbee kommt über eine Zigbee2MQTT-Bridge per MQTT, siehe [den eingebetteten MQTT-Broker](/de/iot/broker/)); es ist der Zugriff, den eine Funktion oder ein Sidecar, der ein Funkmodul liest, braucht, bereitgestellt, bevor danach gefragt wird.

Was es kostet, absichtlich und entschieden: Der Pod ist root auf dem Node (privilegiert, mit dem `/dev` des Nodes), und die NetworkPolicy-Voreinstellung des Charts bleibt für das, was sie abdeckt, an. Der Pod bleibt im Pod-Netzwerk. Schalten Sie jeden Teil mit `--set hardware.privileged=false --set hardware.usbDevices.enabled=false --set hardware.bluetooth.enabled=false` ab; mit allen drei aus ist das Rendering Zeile für Zeile der Pod, den 4.19.6 erzeugte (ohne root, alle Capabilities entfernt, schreibgeschütztes Root, Pod-Netzwerk). Für alles, was das Netzwerk des Nodes braucht, setzen Sie `hardware.bluetooth.hostNetwork=true` (oder `hostNetwork=true`): Die Seite antwortet dann auf jeder Adresse des Nodes unter `service.targetPort`, ein HotLoop pro Node und Port, eine NetworkPolicy gilt für den Pod nicht, und `nodeSelector` heftet ihn an den Node, dessen Funkmodul er sehen soll.

### Edge-Bereitstellungen

Das App-Image wird für amd64 und arm64 gebaut, und TimescaleDB 2.30.1-pg17 ist multi-arch, daher ist der Historian nicht das, was eine Edge-Installation aufhält.

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

### Nach oben veröffentlichen über Sparkplug

Ein Edge-Gateway kann auch alles, was er liest, an einen zentralen veröffentlichen, als Sparkplug-B-Edge-Node. Siehe [Edge-Veröffentlichung und Store-and-Forward](/de/edge/edge-publish/) dazu, was er veröffentlicht und wie sich die Weiterleitungswarteschlange verhält; hier die Seite des Charts.

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

Was das Einschalten ändert, und warum:

- **Ein 1Gi-PVC für die Weiterleitungswarteschlange**, eingehängt unter `/data/edge-publish`. Dort sammeln sich die Messwerte, solange die Uplink-Verbindung ausfällt, also muss sie den Pod überleben. `persistence.enabled: false` legt sie auf ein emptyDir, das einen Container-Neustart überlebt und sonst nichts.
- **Das Deployment rollt mit `Recreate`.** Die Warteschlange ist eine Datei mit einer Sperre. Ein Rolling Update startet zuerst den neuen Pod, der neue Pod kann die Warteschlange nicht öffnen, wird nie bereit, und der Rollout hängt ewig. Recreate stoppt zuerst den alten; Sie verlieren pro Upgrade ein paar Sekunden Abfrage.
- **`replicaCount` muss 1 sein**, und das Chart weigert sich sonst zu rendern. Zwei Replikate wären zwei Publisher, die einen Sparkplug-Node beanspruchen.
- **Die Node-ID ist standardmäßig der Release-Name**, nicht der Hostname des Pods. Der Hostname ändert sich bei jedem Rollout, und ein Sparkplug-Host würde jedes Mal einen brandneuen Edge-Node sehen.

Das Passwort steht nie in einem Klartext-Standard. Lassen Sie `password` und `existingSecret` für einen anonymen Broker leer, dann wird kein Secret angelegt; setzen Sie `password`, und das Chart legt es in `<release>-edge-publish` ab; setzen Sie `existingSecret`, um eines zu verwenden, das Sie selbst verwalten.

### Externe Datenbank

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

Die App erkennt TimescaleDB und macht `tag_history` zur Hypertable, wenn die Erweiterung vorhanden ist. Gegen reines PostgreSQL fällt sie auf native Bereichspartitionierung zurück, statt zu scheitern.

Die Entscheidung wird festgehalten und ist **fest**. Eine als Hypertable erstellte Datenbank weigert sich, gegen einen Server ohne die Erweiterung zu starten, statt stillschweigend woanders zu schreiben; wenn Sie diesen Fehler sehen, haben Sie die App auf eine andere Datenbank gerichtet als die, auf der sie aufgebaut wurde.

### SQLite

Die Datenbank ist eine Einstellung, kein Image. Jedes Produkt läuft aus demselben Binary auf SQLite, Postgres oder TimescaleDB (IoT lässt TimescaleDB aus, siehe unten):

| Variable | Standard | Was sie bewirkt |
|---|---|---|
| `HOTLOOP_DB_TYPE` | `postgres` | `postgres` oder `sqlite`. TimescaleDB ist `postgres` mit der Erweiterung auf dem Server |
| `HOTLOOP_DB_PATH` | `/data/hotloop.db` | Die SQLite-Datei. Nur SQLite liest sie |

SQLite ist die reine Go-Variante (`modernc.org/sqlite`), in jedes Image einkompiliert, also kein zweiter Container, kein 300-MB-Postgres-Image auf einer SD-Karte, und die arm-Builds bleiben statisch. Legen Sie die Datei auf ein Volume, das den Container überlebt, und legen Sie dieses Volume auf einem Pi auf eine USB-SSD. Ein Historian, der den ganzen Tag auf eine SD-Karte schreibt, ist der Weg, viele SD-Karten zu kaufen.

Was gleich ist: jede Tabelle, jede Spalte, jede Funktion. Was anders ist:

- Der Verlauf ist eine Tabelle mit einem Index, keine Partitionen oder Hypertable, und die Aufbewahrung löscht alte Zeilen, statt Monate zu verwerfen. Ein Standort mit Jahren an Verlauf im Sekundentakt will Postgres oder TimescaleDB, und der Wechsel dorthin ist ein Backup und eine Wiederherstellung (BACKUP.md).
- Ein Schreiber zugleich. SQLite wechselt sich bei Schreibzugriffen ab und liest daneben (WAL), was für ein HotLoop und einen `--mcp-stdio`-Helfer daneben auf derselben Datei reichlich ist. Es ist nichts für zwei Replikate auf Netzwerkspeicher: SQLite auf NFS wird beschädigt, daher ist eine SQLite-Bereitstellung ein Pod mit einem lokalen Volume.
- Commits sind `synchronous=FULL`: Wenn die API sagt, dass sie gespeichert hat, ist es auf der Platte, mit oder ohne Stromausfall.

**HotLoop IoT** hat standardmäßig 30 Tage Verlauf (`HOTLOOP_HISTORIAN_RETENTION_DAYS` gewinnt weiterhin, wenn es gesetzt ist) und baut nie eine Hypertable: TimescaleDB ist Teil von Edge und Gateway. Setzen Sie `HOTLOOP_HISTORIAN_TIMESCALE=true` auf IoT, sagt es das beim Start und läuft auf einfachen Partitionen. Eine von einem Edge oder Gateway herabgestufte Datenbank, die schon eine Hypertable hat, behält sie und läuft weiter.

#### Die Datenbank im Chart wählen

Ein Wert, `database.type`, und jedes Produkt nimmt die, auf denen es läuft:

| `database.type` | Was bereitgestellt wird | IoT | Edge | Gateway |
|---|---|---|---|---|
| `timescaledb` | Die App und TimescaleDB (ein StatefulSet und sein Volume). Verlauf in einer Hypertable | abgelehnt | Standard | Standard |
| `postgresql` | Die App und reines PostgreSQL 17 (ein StatefulSet und sein Volume). Verlauf in nativen Partitionen | Standard | ja | ja |
| `sqlite` | Die App allein, mit der Datenbankdatei auf einem eigenen Volume | ja | ja | ja |

```bash
helm install hotloop hotloop/hotloop-iot --namespace hotloop --create-namespace   --set database.type=sqlite
```

Wird `timescaledb` für IoT verlangt, scheitert die Installation und nennt, worauf IoT läuft (`database.type is "timescaledb", and HotLoop IoT runs on sqlite, postgresql`), und das Formular im App Store bietet es nicht an. `helm lint` fängt es nicht ab (helm 3.22 lintet es fehlerfrei), also ist es das Rendering, das ablehnt. Wird `database.type` weggelassen, gilt der Standard des Produkts, sodass ein Upgrade mit `--reuse-values` aus der Zeit vor dem Schlüssel die Datenbank behält, die es hatte.

`sqlite` rendert:

- `HOTLOOP_DB_TYPE=sqlite` und `HOTLOOP_DB_PATH=/data/db/hotloop.db`, und keine der Postgres-Verbindungseinstellungen. Kein Datenbank-Pod, kein Datenbankpasswort im Secret, kein Init-Container, der auf eines wartet.
- Einen PersistentVolumeClaim namens `<release>-db` (`database.sqlite.persistence`: `size`, `storageClass`, `accessMode`, zum Start 10Gi und der Cluster-Standard), eingehängt unter `/data/db`. Das Verzeichnis, nicht die Datei: SQLite hält neben der Datenbank ein `-wal` und ein `-shm`. Legen Sie es auf lokalen Speicher; SQLite auf NFS wird beschädigt.
- Das Deployment auf `Recreate`, nicht als Rolling Update, weil das Volume `ReadWriteOnce` ist und die Datei einen Schreiber hat. Ein `replicaCount` über 1 lässt die Installation scheitern.

Die NetworkPolicy bleibt unverändert und an: Die eigene Policy der App gilt weiter, und die Datenbank-Policy wird nur gerendert, wenn es einen Datenbank-Pod zu schützen gibt.

Wer `database.type` bei einem Release ändert, das schon Daten hat, verschiebt die Daten nicht. Die neue Datenbank beginnt leer, ein Wechsel einer Anlage zwischen Datenbanken ist also ein Backup und eine Wiederherstellung (BACKUP.md), genau wie bei der Variablen. Insbesondere weigert sich eine als TimescaleDB-Hypertable erstellte Datenbank, gegen reines PostgreSQL zu starten, stellen Sie also einen bestehenden Edge oder ein Gateway nicht von `timescaledb` auf `postgresql` um und erwarten, dass er hochkommt.

#### Die Datenbank in Quadlet wählen

Das Verzeichnis jedes Produkts unter `deploy/quadlet/` hat die PostgreSQL- oder TimescaleDB-Dateien wie bisher und daneben ein Verzeichnis `sqlite/`: `hotloop.container` und `hotloop-data.volume`, die App allein mit der Datei unter `/data/hotloop.db` auf dem Volume `hotloop-data`. Sie folgt `:stable` und rollt ein schlechtes Update auf dieselbe Weise zurück. Installieren Sie diese zwei Dateien statt der anderen (sie nutzen dieselben Unit-Namen) und legen Sie zwei Secrets an statt drei: Es gibt kein Datenbankpasswort. [`deploy/quadlet/README.md`](/de/install/quadlet/) enthält die Schritte.

Für einfache Postgres-Partitionen auf Edge oder dem Gateway unter Quadlet behalten Sie die TimescaleDB-Unit und fügen `Environment=HOTLOOP_HISTORIAN_TIMESCALE=false` zu `hotloop.container` hinzu. Die Unit von IoT läuft bereits auf reinem PostgreSQL.

### Der Schlüssel für Gerätezugangsdaten

```yaml
secretKey:
  enabled: true
  existingSecret: ""     # or a Secret you manage, with the key under secret.key
```

Gerätepasswörter (eine UniFi-Konsolen-Anmeldung, ein OPC-UA- oder MQTT-Passwort, HTTP-API-Schlüssel) werden in der Datenbank mit diesem Schlüssel verschlüsselt, ein Dump oder ein Backup enthält also nur Chiffretext. Ab Werk erzeugt das Chart bei der ersten Installation einen in `<release>-secret-key`, behält ihn bei Upgrades und behält ihn auch bei `helm uninstall` (`helm.sh/resource-policy: keep`), weil eine auf ihrem Volume aufbewahrte Datenbank für ihre Zugangsdaten ohne ihn nutzlos ist. Er wird als Datei eingehängt und als `HOTLOOP_SECRET_KEY_FILE` übergeben, nie als Umgebungsvariable.

Sichern Sie das Secret getrennt von den Datenbank-Backups: Ein Schlüssel neben den Backups, die er schützt, schützt nichts. Um einen eigenen mitzubringen, gibt `hotloop gen-secret-key` einen aus. Außerhalb von Kubernetes schreiben Sie ihn in eine Datei, die nur HotLoop lesen kann, und zeigen `HOTLOOP_SECRET_KEY_FILE` darauf. Ohne Schlüssel läuft HotLoop, sagt im Startlog, dass Gerätepasswörter so gespeichert werden, wie sie eingegeben wurden, und weigert sich, eine UniFi-Konsole zu speichern. Bereits gespeicherte Zugangsdaten werden beim ersten Start mit einem Schlüssel verschlüsselt. Was das für eine Wiederherstellung bedeutet, steht unter [Backups und Wiederherstellung](/de/iot/backup/#gerätezugangsdaten-und-der-geheime-schlüssel).

## Konfiguration, und was der Bildschirm Einstellungen ändern kann

Fast jede Einstellung kommt aus einer Umgebungsvariablen, die das Chart aus einem Helm-Wert setzt. Das ist der richtige Ort: Konfiguration, die entscheidet, ob dieser Prozess Maschinen steuern kann, gehört in die Bereitstellung, geprüft, nicht in ein Formular auf einer Webseite.

Der Bildschirm **Einstellungen** zeigt alles, jede Einstellung, ihren wirksamen Wert, ob er aus der Datenbank, einer Umgebungsvariablen oder dem eingebauten Standard stammt, und die Variable, die ihn ändert. Das meiste ist schreibgeschützt, und das ist der Punkt: Die Frage, die er beantwortet, lautet "Warum tut es das, und was ändere ich?"

Vier Einstellungen sind Anlagenidentität und kein Verhalten und dort bearbeitbar. Sie werden in der Datenbank gespeichert und wirken sofort, weil eine Anlage viel öfter umbenannt als neu bereitgestellt wird:

| Einstellung | Variable, die sie überschreibt |
|---|---|
| Anlagenname | `HOTLOOP_PLANT_NAME` |
| Standort-ID | `HOTLOOP_SITE_ID` |
| Zeitzone | `HOTLOOP_TIMEZONE` |
| Vor dem Schreiben bestätigen | `HOTLOOP_CONFIRM_WRITES` |

Unter den Einstellungen gibt es Karten, die Daten sind und keine Konfiguration, und sie sind aus demselben Grund bearbeitbar: **Benutzer** ([Authentifizierung und Benutzer](/de/iot/authentication/)), **Alarm-Eskalation**, die sagt, wer als Nächstes informiert wird, wenn niemand einen Alarm quittiert, und wann ([Alarmbenachrichtigungen](/de/iot/notifications/#eskalation)), sowie die Historian-Ziele und MQTT-Anmeldungen. Die Kanäle, die eine Eskalation nutzen kann, bleiben die der Bereitstellung, gesetzt über `HOTLOOP_NOTIFY_*`.

Ein gespeicherter Wert hat Vorrang vor der Umgebungsvariablen, der Wert des Charts wird also zum Ausgangspunkt statt zum letzten Wort. Eine Zeitzone, die die Maschine nicht auflösen kann, wird abgelehnt, statt akzeptiert und stillschweigend ignoriert zu werden, was jeden Zeitstempel auf UTC zurückfallen ließe, ohne dass etwas sagt, warum.

Dasselbe gilt für den Wert der Bereitstellung selbst. Nennt `HOTLOOP_TIMEZONE` (oder `TZ`, wenn jene nicht gesetzt ist) eine Zone, die sich nicht laden lässt, weigert sich HotLoop zu starten, und der Fehler nennt die Variable und den Wert. Früher zuckte es mit den Schultern und lief auf UTC. Berichte, Zeitpläne und Schichtzeiten laufen nach der Uhr der Anlage, und eine um Stunden falsche Annahme ist schlimmer als ein Pod, der sagt, warum er nicht hochkommt.

Der Standort der Anlage sind `HOTLOOP_SITE_LATITUDE` und `HOTLOOP_SITE_LONGITUDE` (Chart: `plant.latitude`, `plant.longitude`), in Dezimalgrad, Nord und Ost positiv. Sonnenaufgang, Sonnenuntergang und die Sonnen-Entitäten und -Auslöser werden daraus auf dem Gerät berechnet ([Die Sonne](/de/iot/sun/)). Beide oder keiner, und ein fehlerhafter stoppt den Start mit Nennung der Variablen. Der Bildschirm Einstellungen zeigt sie schreibgeschützt: Regeln feuern auf einen Sonnenaufgang, ihn zu verschieben ist also eine Bereitstellung.

**Die Sicherheitsschalter sind nicht bearbeitbar und werden es nicht sein.** `HOTLOOP_ALLOW_WRITES` ist die Hauptkontrolle darüber, ob dieser Prozess Anlagen steuern kann; eine Kontrolle, die sich aus derselben Browsersitzung wieder einschalten lässt, die die Schreibzugriffe auslöst, ist keine Kontrolle. `HOTLOOP_HISTORIAN_RETENTION_DAYS` ist ebenfalls nur für die Bereitstellung: Die Aufbewahrungsrichtlinie wird beim Start auf die Datenbank angewandt, ein Feld auf einem Bildschirm würde also so aussehen, als funktioniere es, und keine Daten bewegen. Der Endpunkt lehnt jeden Schlüssel außerhalb der bearbeitbaren Menge **namentlich** ab, statt ihn zu ignorieren.

Eine Einschränkung, genannt, weil der Bildschirm sie auch nennt: Der MCP-Server baut seine Anweisungen beim Start, er meldet also den Anlagennamen, mit dem er gestartet ist, bis der Pod neu startet. Alles andere übernimmt eine Umbenennung bei der nächsten Anfrage.

## PostgreSQL 17

Die Datenbank von HotLoop ist PostgreSQL 17 (mit TimescaleDB 2.30.1 darauf für Edge und das Gateway, reines PostgreSQL 17.11 für IoT und für `database.type: postgresql`). Frühere Releases liefen auf PostgreSQL 16, und PostgreSQL öffnet das Datenverzeichnis einer anderen Hauptversion nicht. Der Wechsel wird deshalb beim Upgrade für Sie erledigt, und es gibt nichts auszuführen.

**Im Chart** bekommt der Datenbank-Pod zwei Init-Container. Der erste führt das PostgreSQL-16-Image aus und kopiert nur dann, wenn das Volume 16er-Daten enthält, diese Installation in ein Scratch-Volume. Der zweite führt das neue Image aus und macht `pg_upgrade` in ein neues Verzeichnis neben dem alten. Beide lassen ein frisches Volume oder eines, das schon auf 17 ist, in Ruhe. Das Upgrade ist `helm upgrade`, nichts weiter. Rechnen Sie damit, dass der Datenbank-Pod so lange in `Init` bleibt, wie eine Kopie der Daten dauert, und die App auf ihn wartet; `kubectl logs <release>-postgresql-0 -c pg-upgrade` ist das Log.

**Unter Quadlet** läuft `hotloop-db-upgrade.container` vor `hotloop-db.service` und tut dasselbe in einer Oneshot-Unit. Kopieren Sie die neuen `hotloop-db.container`, `hotloop-db-upgrade.container` und `hotloop-db-upgrade.sh` aus dem Verzeichnis Ihres Produkts in das Unit-Verzeichnis und starten Sie die Datenbank-Unit neu; die [Quadlet-README](/de/install/quadlet/) enthält die Befehle. Die Datenbank-Unit benötigt die Upgrade-Unit, sodass ein Gerät, das nur die neue Datenbank-Unit erhielt, nicht auf 16er-Daten startet und sagt, warum: Es schlägt fehl, es rät nicht. `journalctl -u hotloop-db-upgrade` ist das Log. Die Unit läuft nur, wenn das Volume 16er-Daten enthält: Auf einem neuen Gerät und bei jedem Start nach dem Upgrade überspringt sie systemd (sie erscheint als inaktiv, nicht als fehlgeschlagen), und das PostgreSQL-16-Image wird nie geladen. Enthält das Volume 16er-Daten, lädt die Unit zuerst dieses Image.

Was es tut, der Reihe nach, alles in `hotloop-pg-upgrade.sh` (eine Datei, dieselbe, die das Chart und die Units ausführen):

1. Kein Datenverzeichnis oder eines, das schon auf 17 ist: nichts, und es sagt das. Jede andere Hauptversion wird abgelehnt, ohne etwas zu ändern.
2. Startet den alten Server einmal auf einem privaten Socket und stoppt ihn sauber, was das Log nach einem Stromausfall abspielt und die Kodierung und das Locale liest, die der neue Cluster übernehmen muss.
3. Führt `initdb` für ein neues Verzeichnis neben dem alten mit diesen Einstellungen aus, führt `pg_upgrade` im Kopiermodus aus (das alte Verzeichnis wird nur gelesen) und überträgt `postgresql.conf`, `postgresql.auto.conf`, `pg_hba.conf` und `pg_ident.conf`.
4. Startet den neuen Server einmal, um zu beweisen, dass er sich mit den endgültigen Einstellungen öffnet, und sammelt die Planer-Statistiken, die `pg_upgrade` nicht überträgt.
5. Erst dann vertauscht es die Namen: Das alte Verzeichnis wird zu `pgdata.pg16`, das neue zu `pgdata`.

Es braucht neben den Daten etwa so viel freien Platz, wie die Daten belegen, und prüft das vor dem Start. Schlägt vor Schritt 5 etwas fehl, endet das Upgrade mit einem Wert ungleich null, die 16er-Daten sind genau wie vorher, und die Datenbank startet nicht auf einem halb gebauten Verzeichnis: Im Chart bleibt der Pod in `Init:Error`, unter Quadlet schlägt die Upgrade-Unit fehl, und die Datenbank-Unit dahinter startet nie. Beheben Sie, was das Log sagt, und starten Sie erneut; ein unfertiger Versuch wird entfernt und wiederholt. Die TimescaleDB-Erweiterung kommt in der Version mit, in der sie war, und die App aktualisiert sie beim nächsten Start auf die ausgelieferte, wie immer. Die eigene Empfehlung von TimescaleDB für ein PostgreSQL-Upgrade an Ort und Stelle ist `pg_upgrade` mit den alten und neuen Binaries ([Tiger Data, "Upgrade PostgreSQL"](https://www.tigerdata.com/docs/deploy/self-hosted/upgrades/upgrade-pg)).

Das Backup ist das alte Verzeichnis selbst. `pg_upgrade` im Kopiermodus schreibt nie hinein, `pgdata.pg16` ist also die ganze PostgreSQL-16-Datenbank, wie sie war, was ein besseres Backup ist als ein Dump und das Einzige, was den unten beschriebenen Weg zurück möglich macht. Das eigene Backup von HotLoop ([Backups und Wiederherstellung](/de/iot/backup/)) wird von der laufenden App über die laufende Datenbank erstellt und kann daher nicht in dem Schritt gemacht werden, der vor dem Start der Datenbank läuft. Machen Sie vor dem Upgrade trotzdem eines mit dem alten Release und kopieren Sie es vom Gerät herunter.

### Zurückgehen

`helm rollback` oder das Zurücklegen des vorherigen `hotloop-db.container` bringt die Datenbank auf das PostgreSQL-16-Image zurück (das automatische Update von Podman tut das nicht: Es bewegt nur die App), und PostgreSQL 16 öffnet kein 17er-Verzeichnis (`database files are incompatible with server`, das Log sagt, das Verzeichnis sei von Version 16 initialisiert worden). Nichts geht verloren und nichts ist halb geändert; die Datenbank startet nur nicht. Was das vorherige Release braucht, ist sein eigenes 16er-Verzeichnis, also `pgdata.pg16`. Stoppen Sie die Datenbank und legen Sie dann die Namen zurück:

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

Das ist die Datenbank, wie sie beim Upgrade war, und nichts von dem, was seitdem geschrieben wurde. Das Zurücktauschen funktioniert nur einmal: Das Upgrade weigert sich zu laufen, solange ein `pgdata.pg16` im Weg ist, der nächste Upgrade-Versuch braucht also zuerst `pgdata.pg17` und eine Lösung für das alte Verzeichnis. Vorwärts ist der Weg, und ein Rollback ist für ein Gerät, das 17 gar nicht ausführen kann. Die Rollback-Regel der App ist unverändert: Das Schema des 16er-Verzeichnisses ist das, was das Release vor dem Upgrade hinterlassen hat, und ein Release, das Migrationen findet, die es nicht kennt, sagt das, siehe [Migrationen fügen nur hinzu](/de/iot/migrations/).

### Wenn Sie zufrieden sind

`pgdata.pg16` bleibt, bis Sie es löschen, denn es zu löschen heißt, den einzigen Weg zurück zu löschen. Es ist so groß wie die Datenbank. Sobald das Gerät so lange auf 17 gelaufen ist, wie Sie möchten:

```sh
# chart
kubectl -n hotloop exec hotloop-postgresql-0 -c postgresql -- rm -rf /var/lib/postgresql/data/pgdata.pg16
# Quadlet
sudo rm -rf "$(sudo podman volume inspect hotloop-db --format '{{.Mountpoint}}')/pgdata.pg16"
```

### Ausschalten

`database.postgresql.upgrade.enabled: false` entfernt die Init-Container. Ein noch auf 16 stehendes Volume verhindert dann den Start der Datenbank, und der Wechsel ist Ihre Sache. Lassen Sie es an: Eingeschaltet lädt eine frische Installation das PostgreSQL-16-Image trotzdem einmal pro Node, weil das Image eines Init-Containers vor seiner Ausführung geladen wird, und führt es dann nie aus.

## Upgrade von 3.x

**Das ist ein Ersatz, kein Upgrade.** 3.x war ein anderes Produkt. Für seine Daten gibt es keinen Migrationspfad, weil es kein Datenmodell mit einem Tag-Historian teilt.

```bash
helm uninstall hotloop -n hotloop
# keep or delete the old PVCs deliberately, they hold the HA recorder database
helm install hotloop ./charts/hotloop -n hotloop
```

Dinge, die es nicht mehr gibt und die abgelehnt werden, wenn sie gesetzt sind: `sidecarProxy`, `homeassistant`, die Add-ons `mqtt`/`nodered`/`esphome`/`zigbee2mqtt`, `devices`, `cameras`, `customConfig`, `network.hostNetwork`.

## Ein Update zurückrollen

`helm rollback hotloop -n hotloop` setzt das Image des vorherigen Release zurück. Es setzt die Datenbank nicht zurück: Ein Release migriert beim Start, und das bleibt getan. Die Regel und die Prüfung stehen unter [Migrationen fügen nur hinzu](/de/iot/migrations/).

Das Einzige, was ein Rollback über das Release mit PostgreSQL 17 hinweg zurücksetzt, ist die Datenbank-Engine: Das Datenbank-Image des Charts geht auf 16 zurück, das das aktualisierte Verzeichnis nicht öffnet. [Zurückgehen](#zurückgehen) ist der Ausweg.

Es ist für ein Release zurück sicher. Die Datenbank hält fest, welches Release jede Migration angewandt hat, und ein Release, das Migrationen von zwei oder mehr Releases findet, die neuer sind als es selbst, weigert sich zu starten:

```
refusing to start: this database's schema is more than one release ahead of
HotLoop 4.18.10. ...
```

Das ist kein Fehler, den man umgehen soll. Es bedeutet, dass die Datenbank weiter gegangen ist, als dieses Release je betrieben wurde. Gehen Sie vorwärts auf ein Release, das das Schema kennt, also das neueste, oder stellen Sie ein Backup wieder her, das vom aktuellen Release erstellt wurde ([Backups und Wiederherstellung](/de/iot/backup/)). Genau ein Release zurück startet, mit einer Warnung im Log, die beide Versionen nennt. Machen Sie vor dem Upgrade ein Backup; das Rollback kann Daten, die das neuere Release geschrieben hat, nicht rückgängig machen.

## Eine Installation prüfen

```bash
kubectl -n hotloop get pods
kubectl -n hotloop logs deploy/hotloop | head -20
```

Ein gesunder Start nennt die Protokolle, die er spricht, wendet die Migrationen an, meldet den Verlaufsmodus und warnt vor allem, was man wissen sollte:

```
msg=starting version=4.0.0 protocols="[ethernet-ip http modbus mqtt mtconnect opcua s7comm]"
msg="writes are ENABLED: the UI, API, automations and MCP can all command devices"
msg="tag_history promoted to a hypertable" timescale=2.30.1
msg="history schema ready" mode=timescale
msg=listening addr=:8080 mcp=/mcp writes=true
```

Prüfen Sie dann die Labels, die das Dashboard braucht. Das ist die Prüfung, die Drift entdeckt, prüfen Sie die **Menge**, nicht die Anzahl, denn eine Anzahlprüfung besteht, während die Menge falsch ist:

```bash
kubectl -n hotloop get svc <release> -o json \
  | jq -r '.metadata.labels | keys[] | select(startswith("embernet.ai/"))'
```

Genau vier, am Service und am Pod:

```
embernet.ai/app-name
embernet.ai/gui-port
embernet.ai/gui-type
embernet.ai/store-app
```

Läuft die App, fehlt aber unter Laufende Apps, sind die Labels des Service die erste Stelle, an der man nachsieht: Das Dashboard fragt Services nach `embernet.ai/store-app` ab.

Eine Bereitstellung aus dem App Store fügt fünf weitere hinzu, aus den `tenantLabels`, die das Dashboard übergibt: `embernet.ai/tenant`, `app-id`, `source`, `deployed-by` und `deployment-id`. Sie landen auf jeder Ressource, die das Chart rendert, und auf dem Gateway-Pod. Das Dashboard liest den Tenant vom Service und sonst nirgends, ein aus dem Store bereitgestelltes Gateway ohne `embernet.ai/tenant` an seinem Service gehört also niemandem. Ein einfaches `helm install` rendert keines der fünf.

## Probes

- `/healthz`, Liveness. Antwortet, solange der Prozess läuft.
- `/readyz`, Readiness. Verlangt zusätzlich die Datenbank, sodass ein Pod, der seinen Historian verloren hat, keinen Verkehr mehr bekommt, statt eine Oberfläche auszuliefern, die nichts beantworten kann.

Die Startup-Probe erlaubt zwei Minuten, weil eine erste Installation Migrationen ausführt und die Liveness-Probe sie nicht mitten in der Migration beenden darf.

## Herunterfahren

`terminationGracePeriodSeconds: 45`. Bei SIGTERM nimmt die App keine Anfragen mehr an und leert dann die Historian-Warteschlange, damit bereits aufgenommene Messwerte geschrieben statt verworfen werden. Wird die Karenzzeit zu kurz gewählt, geht verloren, was gerade in Bearbeitung war.

## Fehlerbehebung

**Ein Gerät bleibt in `connecting`.** Sehen Sie `lastError` auf der Gerätekarte an. Meist ist es eine Firewall zwischen dem Pod und der Anlage oder der falsche Port. Das Chart beschränkt den Egress nicht, eine NetworkPolicy, die ihn blockiert, ist also etwas anderes im Cluster.

**Tags lesen schlechte Qualität.** Das Gerät hat geantwortet, aber der Punkt nicht. Prüfen Sie bei Modbus die Adressbasis, `oneBased`, wenn Ihre Zeichnungen die Nummerierung 40001 nutzen. Prüfen Sie bei OPC UA, ob die Node-ID aufgelöst wurde; bevorzugen Sie die Form `nsu=`.

**Werte wirken plausibel, sind aber falsch.** Bei Modbus ist das die Wortreihenfolge, versuchen Sie `CDAB`. Das ist der Fehler, der sich nicht ankündigt, weil die Zahl nicht offensichtlich falsch ist.

**Nichts wird historisiert.** Prüfen Sie die Diagnose des Bildschirms Protokolle. `filtered` zählt Messwerte, die das Totband unterdrückt hat, was wie gedacht funktioniert; `dropped` zählt Messwerte, die verloren gingen, weil die Datenbank nicht mitkam, was nicht so ist.

**MCP liefert 401.** Das Bearer-Token. Lesen Sie es aus dem Secret des Release.

**Jede `/api/`-Anfrage liefert 401.** Erwartet, sobald `auth.enabled` true ist und sich noch niemand angemeldet hat, das ist der Sinn von 4.4.0. Lesen Sie das erzeugte Administratorpasswort aus dem Secret des Release (siehe [Authentifizierung](#authentifizierung)) und melden Sie sich über die Oberfläche an, oder `POST /api/auth/login` direkt. Siehe [Authentifizierung und Benutzer](/de/iot/authentication/).

**Administratorpasswort verloren und kein anderes Administratorkonto.** Erzeugen Sie einen neuen Hash und patchen Sie das Secret, starten Sie dann den Pod neu, damit er die Umgebung neu liest; `EnsureAdminUser` fasst ein bereits vorhandenes Konto nicht an, dies ersetzt also die Zeile direkt, statt über das Chart zu gehen:

```bash
hotloop hash-password -password 'a-new-one'
kubectl exec -n hotloop deploy/hotloop -- \
  psql "$DATABASE_URL" -c \
  "UPDATE users SET password_hash = '<the hash>' WHERE username = 'admin'"
```

**Eine Automatisierung ist aktiviert, läuft aber nicht.** Sie wurde nicht kompiliert. Der Bildschirm Automatisierungen zeigt sie als NOT ARMED mit dem Grund, und das Systemlog enthält den Fehler.
