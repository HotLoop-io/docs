---
title: "Configuración"
description: "Cada ajuste que lee Flow, su valor por defecto, su variable de entorno y qué hace un valor incorrecto al arrancar."
---

YAML declarativo con sustituciones por variables de entorno. Puede validarlo, compararlo, generarlo desde un ConfigMap y razonar sobre él sin ejecutarlo, que es todo lo que debe permitir un archivo de configuración y nada más. Todos los campos de abajo son opcionales y se muestran con su valor por defecto.

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

Un error tipográfico en ese archivo es un fallo de arranque, no un ajuste que no hace nada en silencio, porque los campos desconocidos se rechazan. Quien escriba mal `credentialSecret` lo descubrirá al instante, no seis meses después, cuando se dé cuenta de que el archivo de credenciales está en texto plano.

## Variables de entorno

El entorno prevalece sobre el archivo, que es la única división viable en Kubernetes: un chart de Helm pone los ajustes corrientes en un ConfigMap e inyecta los secretos desde un Secret.

| Variable | Establece |
|---|---|
| `HOTLOOP_FLOW_CONFIG` | Ruta del archivo YAML. |
| `HOTLOOP_FLOW_HOST`, `HOTLOOP_FLOW_PORT` | El listener. |
| `HOTLOOP_FLOW_ADMIN_ROOT`, `HOTLOOP_FLOW_HTTP_ROOT` | Prefijos de ruta. |
| `HOTLOOP_FLOW_DATA_DIR`, `HOTLOOP_FLOW_FLOW_FILE` | Dónde vive el estado. |
| `HOTLOOP_FLOW_CREDENTIAL_SECRET` | El secreto de cifrado de credenciales. |
| `HOTLOOP_FLOW_ADMIN_USER`, `HOTLOOP_FLOW_ADMIN_PASSWORD_HASH` | Una única cuenta de administración con todos los permisos, lo que permite usar un contenedor en el primer arranque sin montar un archivo. Deben definirse ambas. |
| `HOTLOOP_FLOW_DEPLOY_TOKEN_HASH` | Un token de despliegue llamado `deploy`, para CI/CD: `flows.read` y `flows.write`, nada más. El hash, nunca el token. Un token que además envíe a las estaciones ([Envío a las estaciones de un tenant](/es/flow/stations/)) necesita también `status.read`, así que créelo en el archivo de configuración. |
| `HOTLOOP_FLOW_ASSERTION_PUBLIC_KEY_FILE`, `HOTLOOP_FLOW_ASSERTION_AUDIENCE` | Inicio de sesión desde el panel de EmberCORE. La clave es la clave pública ES256 del panel (un archivo PEM), y la audiencia es `<tenant>/<release>`. Sin archivo de clave está desactivado, y por defecto está desactivado. |
| `HOTLOOP_FLOW_ASSERTION_ISSUER`, `HOTLOOP_FLOW_ASSERTION_HEADER`, `HOTLOOP_FLOW_ASSERTION_HIDE_LOGIN` | El emisor (`embernet-dashboard`), la cabecera (`X-Embernet-Assertion`) y si el editor omite su propio formulario de inicio de sesión (`true`). |
| `HOTLOOP_FLOW_GIT_URL`, `HOTLOOP_FLOW_GIT_USERNAME`, `HOTLOOP_FLOW_GIT_PASSWORD` | El espejo de git. La contraseña (un token de acceso) solo va por entorno. |
| `HOTLOOP_FLOW_INBOX_CAPACITY`, `HOTLOOP_FLOW_OVERFLOW` | Valores por defecto del planificador. |
| `HOTLOOP_FLOW_STORE_PATH`, `HOTLOOP_FLOW_STORE_SYNCHRONOUS` | La base de datos de estado: dónde está y si cada commit se sincroniza con fsync. |
| `HOTLOOP_FLOW_CONTEXT_PERSIST`, `HOTLOOP_FLOW_CONTEXT_FLUSH_INTERVAL` | Contexto persistente. `false` lo desactiva; el intervalo es una duración como `30s`. |
| `HOTLOOP_FLOW_TRACE_OTLP_HEADERS` | Cabeceras para el colector, pares `Name=value` separados por comas, añadidos a los del archivo. Para una clave de API que no tiene nada que hacer en un ConfigMap. |
| `HOTLOOP_FLOW_DURABLE_MAX_BYTES`, `HOTLOOP_FLOW_DURABLE_ACK_FLUSH` | La cuota de disco de los cables duraderos y cuánto espera un mensaje entregado antes de marcarse como terminado. |
| `HOTLOOP_FLOW_TESTS_GATE` | `true` activa la [puerta de despliegue](/es/flow/tests/#la-compuerta-de-despliegue). |
| `HOTLOOP_FLOW_LOG_LEVEL`, `HOTLOOP_FLOW_LOG_FORMAT` | Registro. |
| `HOTLOOP_FLOW_DISCOVERY_ENABLED`, `HOTLOOP_FLOW_DISCOVERY_CIDRS` | Nodos de descubrimiento. CIDR separados por comas. |
| `HOTLOOP_FLOW_EXEC_ENABLED`, `HOTLOOP_FLOW_EXEC_ALLOWED_COMMANDS` | El nodo exec. Comandos separados por comas. |
| `HOTLOOP_FLOW_PLUGINS_DIR`, `HOTLOOP_FLOW_PLUGIN_TRUSTED_KEYS` | Dónde están los plugins y las claves de editor en las que confiar. Claves separadas por comas. |
| `HOTLOOP_FLOW_PLUGIN_GRANTS` | Qué pueden usar los plugins: `name=cap,cap;name=cap`. |
| `HOTLOOP_FLOW_PLUGIN_MAX_MEMORY_MIB`, `HOTLOOP_FLOW_PLUGIN_MAX_TIMEOUT` | Los límites de memoria y de tiempo por mensaje de un nodo de plugin. |
| `HOTLOOP_FLOW_FILE_ALLOWED_PATHS` | Raíces adicionales del nodo file. Separadas por comas. |
| `HOTLOOP_FLOW_SECRET_ALLOWED_PATHS` | Raíces adicionales desde las que se puede leer un archivo de secretos. Separadas por comas. |
| `HOTLOOP_FLOW_INSECURE` | `true` ejecuta con la autenticación desactivada, y nada más lo hace. Solo `1`, `true`, `yes` y `on` cuentan, de modo que `false` o `0` no pueden desactivarla por accidente. Para una red aislada que ha decidido asumir. No exime del secreto de credenciales. |
| `HOTLOOP_FLOW_ALLOW_PLAINTEXT_CREDENTIALS` | Permite credenciales sin cifrar en reposo. |

Las variables de activar y desactivar solo aceptan `1`, `true`, `yes` y `on`, en cualquier combinación de mayúsculas y minúsculas. Cualquier otra cosa es desactivado, así que `HOTLOOP_FLOW_ALLOW_PLAINTEXT_CREDENTIALS=0` significa no, no "está definida, luego sí". Un interruptor de seguridad que se activa porque alguien escribió `=false` es justo el tipo de cosa que acaba en un informe de incidente.

Todo lo que no está en esa tabla es solo de archivo, y es deliberado: el TTL de sesión, las generaciones de copias de seguridad, los límites de tamaño de solicitud y los tiempos de espera del servidor son decisiones que alguien debería revisar en un ConfigMap, no teclear en un shell a las 3 de la madrugada con una línea parada.
