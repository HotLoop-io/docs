---
title: "Configuration"
description: "Chaque réglage que lit Flow, sa valeur par défaut, sa variable d'environnement et ce que fait une mauvaise valeur au démarrage."
---

Du YAML déclaratif avec des surcharges par variables d'environnement. Vous pouvez le valider, le comparer, le générer à partir d'un ConfigMap et raisonner dessus sans l'exécuter, ce qui est tout ce qu'un fichier de configuration doit permettre, et rien de plus. Chaque champ ci-dessous est facultatif et indiqué avec sa valeur par défaut.

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

Une faute de frappe dans ce fichier provoque un échec au démarrage plutôt qu'un réglage qui ne fait rien en silence, car les champs inconnus sont rejetés. Un opérateur qui écrit mal `credentialSecret` doit le découvrir tout de suite, pas six mois plus tard en s'apercevant que le fichier d'identifiants est en clair.

## Surcharges par variables d'environnement

L'environnement l'emporte sur le fichier, ce qui est le seul partage viable sur Kubernetes : un chart Helm place les réglages courants dans un ConfigMap et injecte les secrets depuis un Secret.

| Variable | Définit |
|---|---|
| `HOTLOOP_FLOW_CONFIG` | Chemin du fichier YAML. |
| `HOTLOOP_FLOW_HOST`, `HOTLOOP_FLOW_PORT` | Le listener. |
| `HOTLOOP_FLOW_ADMIN_ROOT`, `HOTLOOP_FLOW_HTTP_ROOT` | Préfixes de chemin. |
| `HOTLOOP_FLOW_DATA_DIR`, `HOTLOOP_FLOW_FLOW_FILE` | L'emplacement de l'état. |
| `HOTLOOP_FLOW_CREDENTIAL_SECRET` | Le secret de chiffrement des identifiants. |
| `HOTLOOP_FLOW_ADMIN_USER`, `HOTLOOP_FLOW_ADMIN_PASSWORD_HASH` | Un seul compte administrateur avec tous les droits, ce qui rend utilisable un conteneur au premier démarrage sans monter de fichier. Les deux doivent être définis. |
| `HOTLOOP_FLOW_DEPLOY_TOKEN_HASH` | Un jeton de déploiement nommé `deploy`, pour la CI : `flows.read` et `flows.write`, rien d'autre. Le hash, jamais le jeton. Un jeton qui pousse aussi vers les stations ([Envoi vers les stations d'un tenant](/fr/flow/stations/)) a besoin aussi de `status.read`, créez-le donc dans le fichier de configuration. |
| `HOTLOOP_FLOW_ASSERTION_PUBLIC_KEY_FILE`, `HOTLOOP_FLOW_ASSERTION_AUDIENCE` | Connexion depuis le tableau de bord EmberCORE. La clé est la clé publique ES256 du tableau de bord (un fichier PEM), l'audience est `<tenant>/<release>`. Sans fichier de clé, elle est désactivée, et la valeur par défaut est désactivée. |
| `HOTLOOP_FLOW_ASSERTION_ISSUER`, `HOTLOOP_FLOW_ASSERTION_HEADER`, `HOTLOOP_FLOW_ASSERTION_HIDE_LOGIN` | L'émetteur (`embernet-dashboard`), l'en-tête (`X-Embernet-Assertion`) et si l'éditeur omet son propre formulaire de connexion (`true`). |
| `HOTLOOP_FLOW_GIT_URL`, `HOTLOOP_FLOW_GIT_USERNAME`, `HOTLOOP_FLOW_GIT_PASSWORD` | Le miroir git. Le mot de passe (un jeton d'accès) ne passe que par l'environnement. |
| `HOTLOOP_FLOW_INBOX_CAPACITY`, `HOTLOOP_FLOW_OVERFLOW` | Valeurs par défaut du planificateur. |
| `HOTLOOP_FLOW_STORE_PATH`, `HOTLOOP_FLOW_STORE_SYNCHRONOUS` | La base de données d'état : où elle se trouve et si chaque commit est synchronisé avec fsync. |
| `HOTLOOP_FLOW_CONTEXT_PERSIST`, `HOTLOOP_FLOW_CONTEXT_FLUSH_INTERVAL` | Contexte persistant. `false` le désactive ; l'intervalle est une durée comme `30s`. |
| `HOTLOOP_FLOW_TRACE_OTLP_HEADERS` | En-têtes pour le collecteur, des paires `Name=value` séparées par des virgules, ajoutées à celles du fichier. Pour une clé d'API qui n'a rien à faire dans un ConfigMap. |
| `HOTLOOP_FLOW_DURABLE_MAX_BYTES`, `HOTLOOP_FLOW_DURABLE_ACK_FLUSH` | Le quota disque des fils durables et la durée pendant laquelle un message livré attend d'être marqué comme terminé. |
| `HOTLOOP_FLOW_TESTS_GATE` | `true` active la [barrière de déploiement](/fr/flow/tests/#la-barrière-de-déploiement). |
| `HOTLOOP_FLOW_LOG_LEVEL`, `HOTLOOP_FLOW_LOG_FORMAT` | Journalisation. |
| `HOTLOOP_FLOW_DISCOVERY_ENABLED`, `HOTLOOP_FLOW_DISCOVERY_CIDRS` | Nœuds de découverte. CIDR séparés par des virgules. |
| `HOTLOOP_FLOW_EXEC_ENABLED`, `HOTLOOP_FLOW_EXEC_ALLOWED_COMMANDS` | Le nœud exec. Commandes séparées par des virgules. |
| `HOTLOOP_FLOW_PLUGINS_DIR`, `HOTLOOP_FLOW_PLUGIN_TRUSTED_KEYS` | L'emplacement des plugins et les clés d'éditeur à approuver. Clés séparées par des virgules. |
| `HOTLOOP_FLOW_PLUGIN_GRANTS` | Ce que les plugins peuvent utiliser : `name=cap,cap;name=cap`. |
| `HOTLOOP_FLOW_PLUGIN_MAX_MEMORY_MIB`, `HOTLOOP_FLOW_PLUGIN_MAX_TIMEOUT` | Les plafonds de mémoire et de temps par message d'un nœud de plugin. |
| `HOTLOOP_FLOW_FILE_ALLOWED_PATHS` | Racines supplémentaires du nœud file. Séparées par des virgules. |
| `HOTLOOP_FLOW_SECRET_ALLOWED_PATHS` | Racines supplémentaires depuis lesquelles un fichier de secret peut être lu. Séparées par des virgules. |
| `HOTLOOP_FLOW_INSECURE` | `true` exécute avec l'authentification désactivée, et rien d'autre ne le fait. Seuls `1`, `true`, `yes` et `on` comptent, si bien que `false` ou `0` ne peuvent pas la désactiver par accident. Pour un réseau isolé que vous avez décidé d'assumer. Cela ne dispense pas du secret d'identifiants. |
| `HOTLOOP_FLOW_ALLOW_PLAINTEXT_CREDENTIALS` | Autorise les identifiants non chiffrés au repos. |

Les variables d'activation n'acceptent que `1`, `true`, `yes` et `on`, quelle que soit la casse. Tout le reste vaut désactivé, donc `HOTLOOP_FLOW_ALLOW_PLAINTEXT_CREDENTIALS=0` veut dire non, pas « elle est définie, donc oui ». Un interrupteur de sécurité qui s'active parce que quelqu'un a tapé `=false` est exactement le genre de chose qui finit dans un rapport d'incident.

Tout ce qui ne figure pas dans ce tableau relève du seul fichier, et c'est voulu : la durée de vie des sessions, les générations de sauvegardes, les limites de taille des requêtes et les délais d'expiration du serveur sont des décisions qu'on doit relire dans un ConfigMap, pas taper dans un shell à 3 h du matin pendant qu'une ligne est à l'arrêt.
