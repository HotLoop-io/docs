---
title: "Configurazione"
description: "Ogni impostazione che Flow legge, il suo valore predefinito, la variabile d'ambiente e cosa fa un valore errato all'avvio."
---

YAML dichiarativo con sostituzioni tramite variabili d'ambiente. Si può validare, confrontare, generare da un ConfigMap e ragionarci sopra senza eseguirlo, che è tutto ciò che un file di configurazione deve permettere e niente di più. Ogni campo qui sotto è facoltativo ed è mostrato al suo valore predefinito.

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

Un errore di battitura in quel file è un errore all'avvio e non un'impostazione che non fa nulla in silenzio, perché i campi sconosciuti vengono rifiutati. Un operatore che scrive male `credentialSecret` deve scoprirlo subito, non sei mesi dopo, quando si accorge che il file delle credenziali è in chiaro.

## Variabili d'ambiente

L'ambiente prevale sul file, che è l'unica suddivisione praticabile su Kubernetes: un chart Helm mette le impostazioni ordinarie in un ConfigMap e inietta i segreti da un Secret.

| Variabile | Imposta |
|---|---|
| `HOTLOOP_FLOW_CONFIG` | Percorso del file YAML. |
| `HOTLOOP_FLOW_HOST`, `HOTLOOP_FLOW_PORT` | Il listener. |
| `HOTLOOP_FLOW_ADMIN_ROOT`, `HOTLOOP_FLOW_HTTP_ROOT` | Prefissi di percorso. |
| `HOTLOOP_FLOW_DATA_DIR`, `HOTLOOP_FLOW_FLOW_FILE` | Dove risiede lo stato. |
| `HOTLOOP_FLOW_CREDENTIAL_SECRET` | Il segreto di cifratura delle credenziali. |
| `HOTLOOP_FLOW_ADMIN_USER`, `HOTLOOP_FLOW_ADMIN_PASSWORD_HASH` | Un unico account amministratore con tutti i permessi, che rende utilizzabile un container al primo avvio senza montare un file. Vanno impostate entrambe. |
| `HOTLOOP_FLOW_DEPLOY_TOKEN_HASH` | Un token di deploy chiamato `deploy`, per la CI/CD: `flows.read` e `flows.write`, nient'altro. L'hash, mai il token. Un token che invia anche alle stazioni ([Invio alle stazioni di un tenant](/it/flow/stations/)) richiede anche `status.read`, quindi createlo nel file di configurazione. |
| `HOTLOOP_FLOW_ASSERTION_PUBLIC_KEY_FILE`, `HOTLOOP_FLOW_ASSERTION_AUDIENCE` | Accesso dalla dashboard EmberCORE. La chiave è la chiave pubblica ES256 della dashboard (un file PEM), l'audience è `<tenant>/<release>`. Senza file di chiave è disattivato, e il valore predefinito è disattivato. |
| `HOTLOOP_FLOW_ASSERTION_ISSUER`, `HOTLOOP_FLOW_ASSERTION_HEADER`, `HOTLOOP_FLOW_ASSERTION_HIDE_LOGIN` | L'emittente (`embernet-dashboard`), l'intestazione (`X-Embernet-Assertion`) e se l'editor omette il proprio modulo di accesso (`true`). |
| `HOTLOOP_FLOW_GIT_URL`, `HOTLOOP_FLOW_GIT_USERNAME`, `HOTLOOP_FLOW_GIT_PASSWORD` | Il mirror git. La password (un token di accesso) si imposta solo tramite ambiente. |
| `HOTLOOP_FLOW_INBOX_CAPACITY`, `HOTLOOP_FLOW_OVERFLOW` | Valori predefiniti dello scheduler. |
| `HOTLOOP_FLOW_STORE_PATH`, `HOTLOOP_FLOW_STORE_SYNCHRONOUS` | Il database di stato: dove si trova e se ogni commit viene sincronizzato con fsync. |
| `HOTLOOP_FLOW_CONTEXT_PERSIST`, `HOTLOOP_FLOW_CONTEXT_FLUSH_INTERVAL` | Contesto persistente. `false` lo disattiva; l'intervallo è una durata come `30s`. |
| `HOTLOOP_FLOW_TRACE_OTLP_HEADERS` | Intestazioni per il collector, coppie `Name=value` separate da virgole, aggiunte a quelle del file. Per una chiave API che non ha nulla da fare in un ConfigMap. |
| `HOTLOOP_FLOW_DURABLE_MAX_BYTES`, `HOTLOOP_FLOW_DURABLE_ACK_FLUSH` | La quota su disco dei fili durevoli e quanto a lungo un messaggio consegnato attende di essere segnato come completato. |
| `HOTLOOP_FLOW_TESTS_GATE` | `true` attiva il [deploy gate](/it/flow/tests/#il-gate-di-deploy). |
| `HOTLOOP_FLOW_LOG_LEVEL`, `HOTLOOP_FLOW_LOG_FORMAT` | Registrazione. |
| `HOTLOOP_FLOW_DISCOVERY_ENABLED`, `HOTLOOP_FLOW_DISCOVERY_CIDRS` | Nodi di discovery. CIDR separati da virgole. |
| `HOTLOOP_FLOW_EXEC_ENABLED`, `HOTLOOP_FLOW_EXEC_ALLOWED_COMMANDS` | Il nodo exec. Comandi separati da virgole. |
| `HOTLOOP_FLOW_PLUGINS_DIR`, `HOTLOOP_FLOW_PLUGIN_TRUSTED_KEYS` | Dove si trovano i plugin e le chiavi dei publisher di cui fidarsi. Chiavi separate da virgole. |
| `HOTLOOP_FLOW_PLUGIN_GRANTS` | Cosa possono usare i plugin: `name=cap,cap;name=cap`. |
| `HOTLOOP_FLOW_PLUGIN_MAX_MEMORY_MIB`, `HOTLOOP_FLOW_PLUGIN_MAX_TIMEOUT` | I limiti di memoria e di tempo per messaggio di un nodo plugin. |
| `HOTLOOP_FLOW_FILE_ALLOWED_PATHS` | Radici aggiuntive del nodo file. Separate da virgole. |
| `HOTLOOP_FLOW_SECRET_ALLOWED_PATHS` | Radici aggiuntive da cui si può leggere un file di segreti. Separate da virgole. |
| `HOTLOOP_FLOW_INSECURE` | `true` esegue con l'autenticazione disattivata, e nient'altro lo fa. Contano solo `1`, `true`, `yes` e `on`, quindi `false` o `0` non possono disattivarla per errore. Per una rete isolata che avete deciso di gestire. Non esonera dal segreto delle credenziali. |
| `HOTLOOP_FLOW_ALLOW_PLAINTEXT_CREDENTIALS` | Consente credenziali non cifrate a riposo. |

Le variabili on/off accettano solo `1`, `true`, `yes` e `on`, in qualsiasi combinazione di maiuscole e minuscole. Qualsiasi altro valore è off, quindi `HOTLOOP_FLOW_ALLOW_PLAINTEXT_CREDENTIALS=0` significa no, non "è impostata, quindi sì". Un interruttore di sicurezza che scatta perché qualcuno ha digitato `=false` è esattamente il genere di cosa che finisce in un rapporto di incidente.

Tutto ciò che non è in quella tabella è solo da file, ed è voluto: il TTL di sessione, le generazioni di backup, i limiti di dimensione delle richieste e i timeout del server sono decisioni che qualcuno dovrebbe rivedere in un ConfigMap, non digitare in una shell alle 3 di notte mentre una linea è ferma.
