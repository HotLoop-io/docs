---
title: "Конфигурация"
description: "Всяка настройка, която Flow чете, стойността ѝ по подразбиране, променливата на средата и какво прави грешна стойност при стартиране."
---

Декларативен YAML с презаписване чрез променливи на средата. Можете да го валидирате, сравнявате, генерирате от ConfigMap и да разсъждавате за него, без да го изпълнявате, а това е всичко, което един конфигурационен файл трябва да позволява, и нищо повече. Всяко поле по-долу е по избор и е показано със стойността си по подразбиране.

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

Грешка в изписването в този файл е грешка при стартиране, а не настройка, която тихо не прави нищо, защото непознатите полета се отхвърлят. Оператор, който напише `credentialSecret` неправилно, трябва да разбере веднага, а не след шест месеца, когато забележи, че файлът с идентификационните данни е в открит вид.

## Променливи на средата

Средата има предимство пред файла, което е единственото работещо разделение в Kubernetes: Helm чартът поставя обикновените настройки в ConfigMap и вмъква тайните от Secret.

| Променлива | Задава |
|---|---|
| `HOTLOOP_FLOW_CONFIG` | Път до YAML файла. |
| `HOTLOOP_FLOW_HOST`, `HOTLOOP_FLOW_PORT` | Слушателя. |
| `HOTLOOP_FLOW_ADMIN_ROOT`, `HOTLOOP_FLOW_HTTP_ROOT` | Префикси на пътя. |
| `HOTLOOP_FLOW_DATA_DIR`, `HOTLOOP_FLOW_FLOW_FILE` | Къде се намира състоянието. |
| `HOTLOOP_FLOW_CREDENTIAL_SECRET` | Тайната за криптиране на идентификационните данни. |
| `HOTLOOP_FLOW_ADMIN_USER`, `HOTLOOP_FLOW_ADMIN_PASSWORD_HASH` | Един-единствен администраторски акаунт с пълни права, който прави контейнера използваем при първо стартиране без монтиране на файл. И двете трябва да са зададени. |
| `HOTLOOP_FLOW_DEPLOY_TOKEN_HASH` | Токен за внедряване на име `deploy`, за CI/CD: `flows.read` и `flows.write`, нищо друго. Хешът, никога токенът. Токен, който изпраща и към станциите ([Изпращане към станциите на тенант](/bg/flow/stations/)), се нуждае и от `status.read`, затова го създайте в конфигурационния файл. |
| `HOTLOOP_FLOW_ASSERTION_PUBLIC_KEY_FILE`, `HOTLOOP_FLOW_ASSERTION_AUDIENCE` | Вход от таблото EmberCORE. Ключът е публичният ES256 ключ на таблото (PEM файл), а audience е `<tenant>/<release>`. Без файл с ключ е изключен, и стойността по подразбиране е изключен. |
| `HOTLOOP_FLOW_ASSERTION_ISSUER`, `HOTLOOP_FLOW_ASSERTION_HEADER`, `HOTLOOP_FLOW_ASSERTION_HIDE_LOGIN` | Издателят (`embernet-dashboard`), заглавката (`X-Embernet-Assertion`) и дали редакторът пропуска собствената си форма за вход (`true`). |
| `HOTLOOP_FLOW_GIT_URL`, `HOTLOOP_FLOW_GIT_USERNAME`, `HOTLOOP_FLOW_GIT_PASSWORD` | Git огледалото. Паролата (токен за достъп) се задава само чрез средата. |
| `HOTLOOP_FLOW_INBOX_CAPACITY`, `HOTLOOP_FLOW_OVERFLOW` | Стойности по подразбиране на планировчика. |
| `HOTLOOP_FLOW_STORE_PATH`, `HOTLOOP_FLOW_STORE_SYNCHRONOUS` | Базата данни за състоянието: къде е и дали всеки commit се синхронизира с fsync. |
| `HOTLOOP_FLOW_CONTEXT_PERSIST`, `HOTLOOP_FLOW_CONTEXT_FLUSH_INTERVAL` | Постоянен контекст. `false` го изключва; интервалът е продължителност като `30s`. |
| `HOTLOOP_FLOW_TRACE_OTLP_HEADERS` | Заглавки за колектора, двойки `Name=value`, разделени със запетаи, добавени към тези във файла. За API ключ, който няма място в ConfigMap. |
| `HOTLOOP_FLOW_DURABLE_MAX_BYTES`, `HOTLOOP_FLOW_DURABLE_ACK_FLUSH` | Дисковата квота за трайните връзки и колко дълго доставено съобщение чака да бъде отбелязано като готово. |
| `HOTLOOP_FLOW_TESTS_GATE` | `true` включва [портата за внедряване](/bg/flow/tests/#бариерата-на-внедряването). |
| `HOTLOOP_FLOW_LOG_LEVEL`, `HOTLOOP_FLOW_LOG_FORMAT` | Журналиране. |
| `HOTLOOP_FLOW_DISCOVERY_ENABLED`, `HOTLOOP_FLOW_DISCOVERY_CIDRS` | Възли за откриване. CIDR, разделени със запетаи. |
| `HOTLOOP_FLOW_EXEC_ENABLED`, `HOTLOOP_FLOW_EXEC_ALLOWED_COMMANDS` | Възелът exec. Команди, разделени със запетаи. |
| `HOTLOOP_FLOW_PLUGINS_DIR`, `HOTLOOP_FLOW_PLUGIN_TRUSTED_KEYS` | Къде са плъгините и ключовете на издателите, на които се вярва. Ключове, разделени със запетаи. |
| `HOTLOOP_FLOW_PLUGIN_GRANTS` | Какво могат да ползват плъгините: `name=cap,cap;name=cap`. |
| `HOTLOOP_FLOW_PLUGIN_MAX_MEMORY_MIB`, `HOTLOOP_FLOW_PLUGIN_MAX_TIMEOUT` | Горните граници на паметта и времето за съобщение на възел на плъгин. |
| `HOTLOOP_FLOW_FILE_ALLOWED_PATHS` | Допълнителни корени на възела file. Разделени със запетаи. |
| `HOTLOOP_FLOW_SECRET_ALLOWED_PATHS` | Допълнителни корени, от които може да се чете файл с тайна. Разделени със запетаи. |
| `HOTLOOP_FLOW_INSECURE` | `true` работи с изключена автентикация и нищо друго не го прави. Важат само `1`, `true`, `yes` и `on`, така че `false` или `0` не могат да я изключат случайно. За изолирана мрежа, за която сте решили да отговаряте. Не освобождава от тайната за идентификационните данни. |
| `HOTLOOP_FLOW_ALLOW_PLAINTEXT_CREDENTIALS` | Разрешава некриптирани идентификационни данни в покой. |

Променливите за включване и изключване приемат само `1`, `true`, `yes` и `on`, с произволни главни и малки букви. Всичко друго е изключено, така че `HOTLOOP_FLOW_ALLOW_PLAINTEXT_CREDENTIALS=0` значи не, а не „зададена е, значи да“. Предпазен превключвател, който се включва, защото някой е написал `=false`, е точно от нещата, които стигат до доклад за инцидент.

Всичко, което не е в тази таблица, е само във файла, и това е нарочно: TTL на сесията, поколенията резервни копия, ограниченията на размера на заявките и таймаутите на сървъра са решения, които някой трябва да прегледа в ConfigMap, а не да ги въвежда в shell в 3 часа сутринта, докато една линия е спряна.
