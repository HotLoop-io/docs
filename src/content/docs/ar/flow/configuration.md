---
title: "الإعدادات"
description: "كل إعداد تقرؤه Flow وقيمته الافتراضية ومتغير البيئة الذي يتجاوزه وما تفعله قيمة خاطئة عند بدء التشغيل."
---

ملف YAML تصريحي مع تجاوز عبر متغيرات البيئة. يمكنك التحقق منه ومقارنته وتوليده من ConfigMap والتفكير فيه دون تشغيله، وهذا كل ما ينبغي أن يتيحه ملف الإعدادات ولا شيء أكثر. كل حقل أدناه اختياري ومعروض بقيمته الافتراضية.

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

الخطأ المطبعي في هذا الملف فشل عند بدء التشغيل وليس إعدادًا لا يفعل شيئًا بصمت، لأن الحقول غير المعروفة تُرفض. على المشغّل الذي يخطئ في كتابة `credentialSecret` أن يكتشف ذلك فورًا، لا بعد ستة أشهر حين يلاحظ أن ملف بيانات الاعتماد نص عادي.

## التجاوز عبر متغيرات البيئة

تتقدم البيئة على الملف، وهذا هو التقسيم العملي الوحيد على Kubernetes: يضع مخطط Helm الإعدادات العادية في ConfigMap ويحقن الأسرار من Secret.

| المتغير | يضبط |
|---|---|
| `HOTLOOP_FLOW_CONFIG` | مسار ملف YAML. |
| `HOTLOOP_FLOW_HOST`, `HOTLOOP_FLOW_PORT` | المستمع. |
| `HOTLOOP_FLOW_ADMIN_ROOT`, `HOTLOOP_FLOW_HTTP_ROOT` | بادئات المسارات. |
| `HOTLOOP_FLOW_DATA_DIR`, `HOTLOOP_FLOW_FLOW_FILE` | مكان حفظ الحالة. |
| `HOTLOOP_FLOW_CREDENTIAL_SECRET` | سر تشفير بيانات الاعتماد. |
| `HOTLOOP_FLOW_ADMIN_USER`, `HOTLOOP_FLOW_ADMIN_PASSWORD_HASH` | حساب مسؤول واحد بكامل الصلاحيات، وهو ما يجعل الحاوية في أول تشغيل قابلة للاستخدام دون تركيب ملف. يجب ضبط الاثنين معًا. |
| `HOTLOOP_FLOW_DEPLOY_TOKEN_HASH` | رمز نشر اسمه `deploy`، للتكامل المستمر: `flows.read` و`flows.write` فقط. المجزّأ، لا الرمز أبدًا. والرمز الذي يدفع إلى المحطات أيضًا ([الدفع إلى محطات مستأجر](/ar/flow/stations/)) يحتاج إلى `status.read` كذلك، فأنشئه في ملف الإعدادات. |
| `HOTLOOP_FLOW_ASSERTION_PUBLIC_KEY_FILE`, `HOTLOOP_FLOW_ASSERTION_AUDIENCE` | تسجيل الدخول من لوحة معلومات EmberCORE. المفتاح هو مفتاح ES256 العام للوحة المعلومات (ملف PEM)، والجمهور هو `<tenant>/<release>`. بلا ملف مفتاح يكون معطّلًا، والافتراضي معطّل. |
| `HOTLOOP_FLOW_ASSERTION_ISSUER`, `HOTLOOP_FLOW_ASSERTION_HEADER`, `HOTLOOP_FLOW_ASSERTION_HIDE_LOGIN` | المُصدِر (`embernet-dashboard`)، والترويسة (`X-Embernet-Assertion`)، وهل يحذف المحرر نموذج تسجيل الدخول الخاص به (`true`). |
| `HOTLOOP_FLOW_GIT_URL`, `HOTLOOP_FLOW_GIT_USERNAME`, `HOTLOOP_FLOW_GIT_PASSWORD` | مرآة git. كلمة المرور (رمز وصول) تُضبط عبر البيئة فقط. |
| `HOTLOOP_FLOW_INBOX_CAPACITY`, `HOTLOOP_FLOW_OVERFLOW` | القيم الافتراضية للمجدوِل. |
| `HOTLOOP_FLOW_STORE_PATH`, `HOTLOOP_FLOW_STORE_SYNCHRONOUS` | قاعدة بيانات الحالة: أين توجد، وهل يُجرى fsync لكل commit. |
| `HOTLOOP_FLOW_CONTEXT_PERSIST`, `HOTLOOP_FLOW_CONTEXT_FLUSH_INTERVAL` | السياق الدائم. `false` يوقفه؛ والفاصل مدة مثل `30s`. |
| `HOTLOOP_FLOW_TRACE_OTLP_HEADERS` | ترويسات الجامع، أزواج `Name=value` مفصولة بفواصل، تُضاف إلى ما في الملف. لمفتاح API لا مكان له في ConfigMap. |
| `HOTLOOP_FLOW_DURABLE_MAX_BYTES`, `HOTLOOP_FLOW_DURABLE_ACK_FLUSH` | حصة القرص للأسلاك الدائمة، ومدة انتظار الرسالة المسلَّمة قبل أن تُعلَّم منتهية. |
| `HOTLOOP_FLOW_TESTS_GATE` | `true` يشغّل [بوابة النشر](/ar/flow/tests/#بوابة-النشر). |
| `HOTLOOP_FLOW_LOG_LEVEL`, `HOTLOOP_FLOW_LOG_FORMAT` | التسجيل. |
| `HOTLOOP_FLOW_DISCOVERY_ENABLED`, `HOTLOOP_FLOW_DISCOVERY_CIDRS` | عقد الاكتشاف. نطاقات CIDR مفصولة بفواصل. |
| `HOTLOOP_FLOW_EXEC_ENABLED`, `HOTLOOP_FLOW_EXEC_ALLOWED_COMMANDS` | عقدة exec. أوامر مفصولة بفواصل. |
| `HOTLOOP_FLOW_PLUGINS_DIR`, `HOTLOOP_FLOW_PLUGIN_TRUSTED_KEYS` | أين توجد الإضافات، ومفاتيح الناشرين الموثوقة. مفاتيح مفصولة بفواصل. |
| `HOTLOOP_FLOW_PLUGIN_GRANTS` | ما يمكن للإضافات استخدامه: `name=cap,cap;name=cap`. |
| `HOTLOOP_FLOW_PLUGIN_MAX_MEMORY_MIB`, `HOTLOOP_FLOW_PLUGIN_MAX_TIMEOUT` | الحدود القصوى لذاكرة عقدة الإضافة ولوقتها لكل رسالة. |
| `HOTLOOP_FLOW_FILE_ALLOWED_PATHS` | جذور إضافية لعقدة file. مفصولة بفواصل. |
| `HOTLOOP_FLOW_SECRET_ALLOWED_PATHS` | جذور إضافية يمكن قراءة ملف سر منها. مفصولة بفواصل. |
| `HOTLOOP_FLOW_INSECURE` | `true` يشغّل بلا مصادقة، ولا شيء آخر يفعل ذلك. لا تُحتسب إلا `1` و`true` و`yes` و`on`، فلا يمكن لـ `false` أو `0` أن يعطّلها عن طريق الخطأ. لشبكة معزولة قررت أن تتحمل مسؤوليتها. وهو لا يعفي من سر بيانات الاعتماد. |
| `HOTLOOP_FLOW_ALLOW_PLAINTEXT_CREDENTIALS` | يسمح ببيانات اعتماد غير مشفرة أثناء التخزين. |

تقبل متغيرات التشغيل والإيقاف `1` و`true` و`yes` و`on` فقط، بأي حالة أحرف. وأي شيء آخر يعني الإيقاف، فـ `HOTLOOP_FLOW_ALLOW_PLAINTEXT_CREDENTIALS=0` تعني لا، وليس «مضبوطة إذن نعم». ومفتاح الأمان الذي ينقلب إلى التشغيل لأن أحدًا كتب `=false` هو بالضبط من الأمور التي تنتهي في تقرير حادثة.

كل ما ليس في ذلك الجدول للملف فقط، وهذا مقصود: مدة صلاحية الجلسة، وأجيال النسخ الاحتياطي، وحدود حجم الطلب، ومهلات الخادم، قرارات ينبغي أن يراجعها أحد في ConfigMap، لا أن تُكتب في صدفة أوامر في الثالثة فجرًا بينما خط الإنتاج متوقف.
