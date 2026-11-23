---
title: "Konfiguration"
description: "Jede Einstellung, die Flow liest, ihr Standardwert, ihre Umgebungsvariable und was ein falscher Wert beim Start bewirkt."
---

Deklaratives YAML mit Überschreibung per Umgebungsvariablen. Sie können es validieren, vergleichen, aus einer ConfigMap erzeugen und darüber nachdenken, ohne es auszuführen, und das ist alles, was eine Konfigurationsdatei erlauben sollte, und nicht mehr. Jedes Feld unten ist optional und mit seinem Standardwert dargestellt.

```yaml
server:
  host: 0.0.0.0
  port: 1880
  adminRoot: /              # where the editor and admin API live
  httpRoot: /               # where a flow's HTTP In nodes live
  readTimeout: 60s          # generous: a big deploy over a slow edge link is legitimate
  writeTimeout: 0s          # zero on purpose, the comms websocket is long-lived
  shutdownTimeout: 20s
  maxRequestBytes: 33554432 # 32 MiB, bounds a flow deploy

data:
  dir: /data                # the PVC. Flows, credentials, the deployment log and state.db live here
  flowFile: flows.json
  credentialsFile: credentials.json
  credentialSecret: ""      # empty means plaintext, which is refused by default
  allowPlaintextCredentials: false
  backupGenerations: 3

history:
  retain: 100               # deployment records kept under data.dir/deployments; 0 keeps all
  git:
    url: ""                 # empty is off; see "A git mirror"
    branch: main
    path: flows.json
    emailDomain: flow.invalid

auth:
  enabled: true             # off refuses to start unless HOTLOOP_FLOW_INSECURE=true
  sessionTTL: 168h          # sessions live in data.dir/sessions.json, hashed, and survive restarts
  lockout:
    attempts: 5             # failures for one account from one address before it locks there
    perAddress: 20          # failures from one address, any account, before the address locks
    window: 15m
    duration: 15m
  users:
    - username: admin
      passwordHash: "$2a$10$..."   # bcrypt only, never plaintext
      permissions: ["*"]
  tokens:                   # API tokens for machines; the hash only, from: hotloop-flow token
    - name: ci
      hash: "sha256:..."
      permissions: ["flows.read", "flows.write"]   # add "status.read" for a token that pushes to stations
      # rateLimit: {calls: 60, per: 1m}   # MCP tool calls per window; unset is no limit

runtime:
  inboxCapacity: 1024
  overflow: block           # block | drop-newest | drop-oldest | error
  blockTimeout: 30s
  closeTimeout: 15s

store:
  path: ""                  # empty is state.db in data.dir: persistent context and durable wires
  synchronous: normal       # normal | full. full fsyncs every commit, and wears the card
  context:
    persist: true           # false is memory only
    flushInterval: 30s      # a changed value waits this long; a kill -9 loses it. 0s writes at once
  durable:
    maxBytes: 268435456     # disk quota for every durable wire together
    ackFlush: 100ms         # how long a delivered message waits to be marked done; 0s marks each one first

discovery:
  enabled: false
  allowedCIDRs: []          # enabled with this empty is a startup error

exec:
  enabled: false
  allowedCommands: []       # enabled with this empty is a startup error

files:
  allowedPaths: []          # extra trees on top of data.dir, which is always allowed

plugins:
  dir: ""                   # empty means plugins/ inside data.dir
  trustedKeys: []           # publisher keys: ed25519:<base64>, a PEM public key, or a file holding one. Empty refuses every plugin
  grants: {}                # plugin name to the host access it may have: clock, random, context.flow, context.global
  maxMemoryMiB: 64          # the most memory any one plugin node can be given
  maxTimeout: 5s            # the longest any one plugin node can be given for a message

secrets:
  allowedPaths: []          # where a tls-config may read a certificate or key, on top of data.dir

logging:
  level: info               # error | warn | info | debug | trace
  format: text              # text for a terminal, json for a cluster

metrics:
  enabled: true
  path: /metrics

audit:
  maxBytes: 16777216        # data.dir/audit.log rotates at 16 MiB
  keep: 4                   # rotated files kept beside it

tests:
  gate: false               # refuse a deploy that fails data.dir/flows.test.yaml
  timeout: 2m               # wall clock for one run of the flow tests

trace:                      # where every message went, kept in memory, bounded
  enabled: true
  traces: 256               # journeys kept, newest
  maxHops: 512              # hops one journey keeps
  maxMessageBytes: 16384    # the biggest message a hop keeps a copy of
  maxBytes: 16777216        # everything together, oldest forgotten first
  perSecond: 1000           # new traces a second; 0 traces every message
  otlp:
    endpoint: ""            # http://collector:4318 sends every hop as a span
    serviceName: hotloop-flow
    interval: 2s            # the longest a finished hop waits to be sent
```

Ein Tippfehler in dieser Datei führt zu einem Startfehler und nicht zu einer Einstellung, die stillschweigend nichts bewirkt, denn unbekannte Felder werden abgelehnt. Wer `credentialSecret` falsch schreibt, soll es sofort merken und nicht sechs Monate später, wenn auffällt, dass die Zugangsdatendatei im Klartext vorliegt.

## Überschreibung per Umgebungsvariablen

Die Umgebung hat Vorrang vor der Datei, und das ist die einzige praktikable Aufteilung auf Kubernetes: Ein Helm-Chart legt die gewöhnlichen Einstellungen in eine ConfigMap und fügt die Geheimnisse aus einem Secret ein.

| Variable | Setzt |
|---|---|
| `HOTLOOP_FLOW_CONFIG` | Pfad zur YAML-Datei. |
| `HOTLOOP_FLOW_HOST`, `HOTLOOP_FLOW_PORT` | Den Listener. |
| `HOTLOOP_FLOW_ADMIN_ROOT`, `HOTLOOP_FLOW_HTTP_ROOT` | Pfadpräfixe. |
| `HOTLOOP_FLOW_DATA_DIR`, `HOTLOOP_FLOW_FLOW_FILE` | Wo der Zustand liegt. |
| `HOTLOOP_FLOW_CREDENTIAL_SECRET` | Das Geheimnis für die Verschlüsselung der Zugangsdaten. |
| `HOTLOOP_FLOW_ADMIN_USER`, `HOTLOOP_FLOW_ADMIN_PASSWORD_HASH` | Ein einzelnes Administratorkonto mit allen Berechtigungen, wodurch ein Container beim ersten Start ohne eingehängte Datei nutzbar wird. Beide müssen gesetzt sein. |
| `HOTLOOP_FLOW_DEPLOY_TOKEN_HASH` | Ein Deploy-Token namens `deploy`, für CI/CD: `flows.read` und `flows.write`, sonst nichts. Der Hash, nie das Token. Ein Token, das auch an Stationen pusht ([Senden an die Stationen eines Tenants](/de/flow/stations/)), braucht zusätzlich `status.read`, legen Sie es also in der Konfigurationsdatei an. |
| `HOTLOOP_FLOW_ASSERTION_PUBLIC_KEY_FILE`, `HOTLOOP_FLOW_ASSERTION_AUDIENCE` | Anmeldung über das EmberCORE-Dashboard. Der Schlüssel ist der öffentliche ES256-Schlüssel des Dashboards (eine PEM-Datei), die Audience ist `<tenant>/<release>`. Ohne Schlüsseldatei ist sie aus, und der Standard ist aus. |
| `HOTLOOP_FLOW_ASSERTION_ISSUER`, `HOTLOOP_FLOW_ASSERTION_HEADER`, `HOTLOOP_FLOW_ASSERTION_HIDE_LOGIN` | Der Aussteller (`embernet-dashboard`), der Header (`X-Embernet-Assertion`) und ob der Editor sein eigenes Anmeldeformular weglässt (`true`). |
| `HOTLOOP_FLOW_GIT_URL`, `HOTLOOP_FLOW_GIT_USERNAME`, `HOTLOOP_FLOW_GIT_PASSWORD` | Der Git-Mirror. Das Passwort (ein Zugriffstoken) gibt es nur per Umgebung. |
| `HOTLOOP_FLOW_INBOX_CAPACITY`, `HOTLOOP_FLOW_OVERFLOW` | Standardwerte des Schedulers. |
| `HOTLOOP_FLOW_STORE_PATH`, `HOTLOOP_FLOW_STORE_SYNCHRONOUS` | Die Zustandsdatenbank: wo sie liegt und ob jeder Commit per fsync gesichert wird. |
| `HOTLOOP_FLOW_CONTEXT_PERSIST`, `HOTLOOP_FLOW_CONTEXT_FLUSH_INTERVAL` | Persistenter Kontext. `false` schaltet ihn aus; das Intervall ist eine Dauer wie `30s`. |
| `HOTLOOP_FLOW_TRACE_OTLP_HEADERS` | Header für den Collector, `Name=value`-Paare, durch Kommas getrennt, zusätzlich zu denen in der Datei. Für einen API-Schlüssel, der nichts in einer ConfigMap zu suchen hat. |
| `HOTLOOP_FLOW_DURABLE_MAX_BYTES`, `HOTLOOP_FLOW_DURABLE_ACK_FLUSH` | Das Plattenkontingent für dauerhafte Leitungen und wie lange eine zugestellte Nachricht darauf wartet, als erledigt markiert zu werden. |
| `HOTLOOP_FLOW_TESTS_GATE` | `true` schaltet das [Deploy-Gate](/de/flow/tests/#das-deploy-gate) ein. |
| `HOTLOOP_FLOW_LOG_LEVEL`, `HOTLOOP_FLOW_LOG_FORMAT` | Protokollierung. |
| `HOTLOOP_FLOW_DISCOVERY_ENABLED`, `HOTLOOP_FLOW_DISCOVERY_CIDRS` | Discovery-Knoten. CIDRs, durch Kommas getrennt. |
| `HOTLOOP_FLOW_EXEC_ENABLED`, `HOTLOOP_FLOW_EXEC_ALLOWED_COMMANDS` | Der exec-Knoten. Befehle, durch Kommas getrennt. |
| `HOTLOOP_FLOW_PLUGINS_DIR`, `HOTLOOP_FLOW_PLUGIN_TRUSTED_KEYS` | Wo die Plugins liegen und welchen Herausgeberschlüsseln vertraut wird. Schlüssel, durch Kommas getrennt. |
| `HOTLOOP_FLOW_PLUGIN_GRANTS` | Was Plugins nutzen dürfen: `name=cap,cap;name=cap`. |
| `HOTLOOP_FLOW_PLUGIN_MAX_MEMORY_MIB`, `HOTLOOP_FLOW_PLUGIN_MAX_TIMEOUT` | Die Obergrenzen für Speicher und Zeit pro Nachricht eines Plugin-Knotens. |
| `HOTLOOP_FLOW_FILE_ALLOWED_PATHS` | Zusätzliche Wurzeln des file-Knotens. Durch Kommas getrennt. |
| `HOTLOOP_FLOW_SECRET_ALLOWED_PATHS` | Zusätzliche Wurzeln, aus denen eine Geheimnisdatei gelesen werden darf. Durch Kommas getrennt. |
| `HOTLOOP_FLOW_INSECURE` | `true` läuft ohne Authentifizierung, und nichts sonst bewirkt das. Nur `1`, `true`, `yes` und `on` zählen, sodass `false` oder `0` sie nicht versehentlich abschalten können. Für ein isoliertes Netz, dessen Verantwortung Sie übernommen haben. Es entbindet nicht vom Zugangsdaten-Geheimnis. |
| `HOTLOOP_FLOW_ALLOW_PLAINTEXT_CREDENTIALS` | Erlaubt unverschlüsselte Zugangsdaten im Ruhezustand. |

Die Ein/Aus-Variablen akzeptieren nur `1`, `true`, `yes` und `on`, in beliebiger Groß- und Kleinschreibung. Alles andere ist aus, also bedeutet `HOTLOOP_FLOW_ALLOW_PLAINTEXT_CREDENTIALS=0` nein und nicht „sie ist gesetzt, also ja“. Ein Sicherheitsschalter, der umspringt, weil jemand `=false` getippt hat, ist genau die Art von Ding, die in einem Vorfallbericht endet.

Alles, was nicht in dieser Tabelle steht, gibt es nur in der Datei, und das ist Absicht: Sitzungs-TTL, Backup-Generationen, Größenlimits für Anfragen und die Server-Timeouts sind Entscheidungen, die jemand in einer ConfigMap prüfen sollte und nicht nachts um 3 Uhr in eine Shell tippen, während eine Linie steht.
