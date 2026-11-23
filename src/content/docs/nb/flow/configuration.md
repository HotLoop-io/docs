---
title: "Konfigurasjon"
description: "Hver innstilling Flow leser, standardverdien, miljøvariabelen som overstyrer den, og hva en ugyldig verdi gjør ved oppstart."
---

Deklarativ YAML med overstyring fra miljøvariabler. Du kan validere den, sammenligne den, generere den fra en ConfigMap og resonnere om den uten å kjøre den, og det er alt en konfigurasjonsfil skal la deg gjøre, og ikke mer. Alle feltene nedenfor er valgfrie og vist med standardverdien.

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

En skrivefeil i filen gir en oppstartsfeil, ikke en innstilling som stille ikke gjør noe, fordi ukjente felt avvises. En operatør som staver `credentialSecret` feil, skal oppdage det med en gang, ikke seks måneder senere når hun ser at legitimasjonsfilen ligger i klartekst.

## Overstyring med miljøvariabler

Miljøet går foran filen, som er den eneste fungerende delingen på Kubernetes: et Helm-chart legger de vanlige innstillingene i en ConfigMap og setter inn hemmelighetene fra en Secret.

| Variabel | Setter |
|---|---|
| `HOTLOOP_FLOW_CONFIG` | Sti til YAML-filen. |
| `HOTLOOP_FLOW_HOST`, `HOTLOOP_FLOW_PORT` | Lytteren. |
| `HOTLOOP_FLOW_ADMIN_ROOT`, `HOTLOOP_FLOW_HTTP_ROOT` | Stiprefikser. |
| `HOTLOOP_FLOW_DATA_DIR`, `HOTLOOP_FLOW_FLOW_FILE` | Hvor tilstanden ligger. |
| `HOTLOOP_FLOW_CREDENTIAL_SECRET` | Hemmeligheten for kryptering av legitimasjon. |
| `HOTLOOP_FLOW_ADMIN_USER`, `HOTLOOP_FLOW_ADMIN_PASSWORD_HASH` | Én enkelt administratorkonto med alle rettigheter, som gjør en container brukbar ved første oppstart uten å montere en fil. Begge må settes. |
| `HOTLOOP_FLOW_DEPLOY_TOKEN_HASH` | Et utrullingstoken som heter `deploy`, for CI: `flows.read` og `flows.write`, ingenting annet. Hashen, aldri tokenet. Et token som også sender til stasjoner ([Sending til en tenants stasjoner](/nb/flow/stations/)) trenger i tillegg `status.read`, så lag det i konfigurasjonsfilen. |
| `HOTLOOP_FLOW_ASSERTION_PUBLIC_KEY_FILE`, `HOTLOOP_FLOW_ASSERTION_AUDIENCE` | Pålogging fra EmberCORE-dashbordet. Nøkkelen er dashbordets offentlige ES256-nøkkel (en PEM-fil), og audience er `<tenant>/<release>`. Uten nøkkelfil er den av, og standarden er av. |
| `HOTLOOP_FLOW_ASSERTION_ISSUER`, `HOTLOOP_FLOW_ASSERTION_HEADER`, `HOTLOOP_FLOW_ASSERTION_HIDE_LOGIN` | Utstederen (`embernet-dashboard`), headeren (`X-Embernet-Assertion`) og om editoren utelater sitt eget påloggingsskjema (`true`). |
| `HOTLOOP_FLOW_GIT_URL`, `HOTLOOP_FLOW_GIT_USERNAME`, `HOTLOOP_FLOW_GIT_PASSWORD` | Git-speilet. Passordet (et tilgangstoken) settes bare i miljøet. |
| `HOTLOOP_FLOW_INBOX_CAPACITY`, `HOTLOOP_FLOW_OVERFLOW` | Standardverdier for planleggeren. |
| `HOTLOOP_FLOW_STORE_PATH`, `HOTLOOP_FLOW_STORE_SYNCHRONOUS` | Tilstandsdatabasen: hvor den ligger, og om hver commit synkroniseres med fsync. |
| `HOTLOOP_FLOW_CONTEXT_PERSIST`, `HOTLOOP_FLOW_CONTEXT_FLUSH_INTERVAL` | Vedvarende kontekst. `false` slår den av; intervallet er en varighet som `30s`. |
| `HOTLOOP_FLOW_TRACE_OTLP_HEADERS` | Headere for samleren, `Name=value`-par atskilt med komma, lagt til dem i filen. For en API-nøkkel som ikke har noe i en ConfigMap å gjøre. |
| `HOTLOOP_FLOW_DURABLE_MAX_BYTES`, `HOTLOOP_FLOW_DURABLE_ACK_FLUSH` | Diskkvoten for varige ledninger, og hvor lenge en levert melding venter på å bli markert som ferdig. |
| `HOTLOOP_FLOW_TESTS_GATE` | `true` slår på [utrullingsporten](/nb/flow/tests/#utrullingsporten). |
| `HOTLOOP_FLOW_LOG_LEVEL`, `HOTLOOP_FLOW_LOG_FORMAT` | Logging. |
| `HOTLOOP_FLOW_DISCOVERY_ENABLED`, `HOTLOOP_FLOW_DISCOVERY_CIDRS` | Oppdagelsesnoder. CIDR-er atskilt med komma. |
| `HOTLOOP_FLOW_EXEC_ENABLED`, `HOTLOOP_FLOW_EXEC_ALLOWED_COMMANDS` | Exec-noden. Kommandoer atskilt med komma. |
| `HOTLOOP_FLOW_PLUGINS_DIR`, `HOTLOOP_FLOW_PLUGIN_TRUSTED_KEYS` | Hvor pluginene ligger, og utgivernøklene som skal stoles på. Nøkler atskilt med komma. |
| `HOTLOOP_FLOW_PLUGIN_GRANTS` | Hva plugins kan bruke: `name=cap,cap;name=cap`. |
| `HOTLOOP_FLOW_PLUGIN_MAX_MEMORY_MIB`, `HOTLOOP_FLOW_PLUGIN_MAX_TIMEOUT` | Taket for minne og tid per melding i en plugin-node. |
| `HOTLOOP_FLOW_FILE_ALLOWED_PATHS` | Ekstra røtter for file-noden. Atskilt med komma. |
| `HOTLOOP_FLOW_SECRET_ALLOWED_PATHS` | Ekstra røtter en hemmelighetsfil kan leses fra. Atskilt med komma. |
| `HOTLOOP_FLOW_INSECURE` | `true` kjører uten autentisering, og ingenting annet gjør det. Bare `1`, `true`, `yes` og `on` gjelder, så `false` eller `0` kan ikke slå den av ved et uhell. For et isolert nettverk du har bestemt deg for å ta ansvar for. Den fritar ikke fra hemmeligheten for legitimasjon. |
| `HOTLOOP_FLOW_ALLOW_PLAINTEXT_CREDENTIALS` | Tillater ukryptert legitimasjon i hvile. |

På/av-variablene godtar bare `1`, `true`, `yes` og `on`, med hvilke som helst store og små bokstaver. Alt annet er av, så `HOTLOOP_FLOW_ALLOW_PLAINTEXT_CREDENTIALS=0` betyr nei, ikke «den er satt, altså ja». En sikkerhetsbryter som slår seg på fordi noen skrev `=false`, er akkurat typen ting som havner i en hendelsesrapport.

Alt som ikke står i tabellen, gjelder bare i filen, og det er med vilje: sesjons-TTL, antall sikkerhetskopigenerasjoner, grenser for forespørselsstørrelse og servertidsavbrudd er beslutninger noen bør gjennomgå i en ConfigMap, ikke skrive inn i et skall klokka 03 mens en linje står.
