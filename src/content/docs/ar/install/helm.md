---
title: "k3s وHelm"
description: "انشر أي chart من HotLoop على k3s أو أي Kubernetes: القيم التي تستحق الضبط، واختيار قاعدة البيانات، والترقيات والتراجع، وكيف يبدو التثبيت السليم."
---

ينشر الـ chart حملي عمل: الـ gateway (وهو Deployment لا يحتفظ بأي حالة دائمة خاصة به) وTimescaleDB (وهو StatefulSet مع مجلد حجمي). هذا هو الافتراضي. يختار `database.type` قاعدة بيانات أخرى: PostgreSQL العادي، أو SQLite الذي لا يمثل حمل عمل ثانيًا على الإطلاق ([SQLite](#sqlite)، أدناه).

## التثبيت

عبر App Store في لوحة EmberNet، أو مباشرة:

```bash
helm install hotloop ./charts/hotloop \
  --namespace hotloop --create-namespace
```

أو من مستودع الـ charts، وهو أيضًا العنوان الذي يشير إليه App Store:

```bash
helm repo add hotloop https://hotloop.io/hotloop
helm install hotloop hotloop/hotloop \
  --namespace hotloop --create-namespace
```

يعمل هذا الشكل الثاني من 4.16.0، أول إصدار نُشر باسم `hotloop`. وكان الإصدار الأخير قبله `industrial-iot` 4.3.1 بالاسم القديم، والترقية منه إجراء مستقل: راجع "Upgrading from 4.3.1" في ملاحظات 4.16.0 في README. عنوان المستودع القديم، `https://embernet-ai.github.io/industrial-iot/`، يعيد 404.

التثبيت المجرد يعمل. يولّد الـ chart كلمة مرور لقاعدة البيانات ورمز MCP في Secret الإصدار ويعيد استخدامهما عبر الترقيات، فلا حاجة لتقديم شيء، ولا تغيّر الترقية كلمة المرور من تحت قاعدة بيانات قيد التشغيل.

الوصول إليه لا يحتاج ingress ولا نطاقًا فرعيًا. تكتشف اللوحة التطبيق من تسميات المتجر وتمرّره عبر وكيل على العنوان الداخلي في العنقود:

```
<release>.<namespace>.svc.cluster.local:8080
```

لعرضه مباشرة:

```bash
kubectl -n hotloop port-forward svc/hotloop 8080:8080
```

## القيم التي تستحق الضبط

### المصادقة

منذ 4.4.0. راجع [المصادقة والمستخدمون](/ar/iot/authentication/) للنموذج الكامل؛ وهذا جانب الـ chart منه.

```yaml
auth:
  enabled: true    # the default; requires a login
  insecure: false  # set true only for a deployment truly isolated behind the
                    # dashboard's own NetworkPolicy -- see AUTH.md
```

مع `enabled: true` (الافتراضي) يولّد الـ chart حساب مسؤول في Secret الإصدار عند أول تثبيت، بالطريقة نفسها التي يولّد بها كلمة مرور قاعدة البيانات ورمز MCP، ويعيد استخدامه عبر الترقيات:

```bash
kubectl get secret hotloop -n hotloop \
  -o jsonpath='{.data.admin-password}' | base64 -d
```

ضبط `auth.admin.password` صراحةً يتجاوز القيمة المولّدة.

### السلامة

القيم التي تقرر ما إذا كان هذا الـ pod يستطيع تحريك الآلات.

```yaml
safety:
  allowWrites: false      # the master switch -- off by default since 4.4.0
  allowMcpWrites: true    # agents (MCP) write wherever an operator could, once writes are on
  confirmWrites: true     # the UI asks before writing
```

عمليات الكتابة معطلة افتراضيًا. الوسم للقراءة فقط حتى يُضبط علمه `writable` الخاص به، وتُرفض القيمة خارج نطاق الوسم المضبوط (لا تُقتطع أبدًا: إرسال 250 حين كتب أحدهم 500 هو فعل شيء آخر بصمت)، وتُسجَّل كل محاولة، **بما فيها كل رفض**، مع الفاعل والمصدر. لكن التثبيت الجديد لا ينبغي أن يحتاج إلى توافق الثلاثة معًا ليكون آمنًا، لذا يبدأ المفتاح الرئيسي نفسه مغلقًا.

لتشغيل الكتابة بعد مراجعة النشر:

```yaml
safety:
  allowWrites: true
```

هذا كل ما يلزم: عملاء MCP يقرأون ويكتبون كما يفعل المشغّل، بالصلاحيات نفسها والوسوم القابلة للكتابة والنطاقات. يأتي `allowMcpWrites` مفعّلًا في كل chart؛ وهو موجود لنشر يقرر غير ذلك، وليس افتراضيًا في أي مكان.

### المؤرِّخ

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

يتحدد الحجم بعدد الوسوم ومعدل المسح والنطاقات الميتة. ألف وسم كل ثانية دون نطاقات ميتة تعني نحو 86 مليون صف في اليوم؛ والمصنع نفسه بنطاقات ميتة معقولة يكون عادةً أقل بمرتبة واحدة. اضبط النطاقات الميتة قبل شراء التخزين.

يفرض `useTimescale: false` مسار التقسيم الأصلي، وهو ما يبدو عليه التشغيل على PostgreSQL العادي. مفيد لإعادة إنتاج نشر على الحافة.

**عندما تتغير صورة TimescaleDB.** تحمل الصورة مكتبة كل إصدار أقدم، فتستمر قاعدة بيانات أُنشئت بصورة أقدم في العمل على الجديدة، لكن بإصدار الامتداد القديم، وتبقى هناك حتى ينفّذ أحدهم `ALTER EXTENSION timescaledb UPDATE`. يفعل الـ Gateway ذلك عند البدء: يقارن الإصدار المثبّت بالإصدار الذي يأتي مع الخادم، وإن اختلفا ينفّذ التحديث كأول عبارة في اتصال جديد (يرفضه TimescaleDB في جلسة حمّلت الإصدار القديم بالفعل). يقول السجل `timescaledb extension updated from=... to=...`. وهذا يحتاج إلى مستخدم متميز، وهو ما عليه مستخدم قاعدة البيانات المضمّنة. مع قاعدة بيانات خارجية أو مُدارة لا يكون فيها كذلك، تحصل على تحذير مع الأمر المطلوب تنفيذه، ويواصل السجل التاريخي العمل بالإصدار القديم في الأثناء. لا يحدث إلا مع `useTimescale` مفعّلًا وترحيلات تعمل عند البدء (`HOTLOOP_DB_MIGRATE`، مفعّل افتراضيًا).

### الاستطلاع

```yaml
runtime:
  defaultPollIntervalMs: 1000
  minPollIntervalMs: 100      # a floor applied to every device
  timeoutMs: 10000
  maxConcurrentPolls: 32
```

يُفرض `minPollIntervalMs` بدل الوثوق به. استطلاع كل 10 مللي ثانية على gateway تسلسلي هو حجب خدمة بخطوات إضافية.

### عميل OPC UA

```yaml
opcuaClient:
  persistence:
    enabled: true      # off by default
    size: 64Mi
```

الجهاز الذي يتصل بخادم OPC UA مؤمَّن، أو يسجّل الدخول باسم مستخدم وكلمة مرور يتطلبهما الخادم مشفّرين، يحتفظ بشهادة ومخزن ثقة لشهادات الخوادم المعتمدة (`HOTLOOP_OPCUA_CLIENT_PKI_DIR`، `/data/opcua-client-pki`). فعّل هذا قبل إضافة جهاز كهذا: نظام الملفات الجذري للقراءة فقط، فبدون المجلد الحجمي يبلّغ الجهاز عن خطأ يقول ذلك بدل أن يتصل بشهادات ستضيع عند إعادة التشغيل التالية. وهو معطل افتراضيًا لأنه يضيف PersistentVolumeClaim إلى تثبيت قائم، ويبقى في Pending على عنقود بلا StorageClass افتراضي. لا تستخدمه الأجهزة المجهولة على قناة غير مؤمَّنة. اعتماد شهادة خادم، وكل ما عدا ذلك عن هذه الأجهزة، في [البروتوكولات والمشغّلات](/ar/iot/protocols/#opc-ua-الأمان-وبيانات-الاعتماد).

### الشبكة

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

ضيّق ingress إلى namespace اللوحة متى عُرف. الـ egress غير مقيّد عمدًا: هذا التطبيق موجود للوصول إلى معدات على عناوين لا يستطيع أحد حصرها مسبقًا، وسياسة egress تحجب استطلاعًا بصمت تبدو كمشغّل معطّل لا كقاعدة جدار ناري.

### العتاد: أجهزة راديو USB ومحوّلات تسلسلية وBluetooth

منذ 4.19.7 يأتي كل chart من HotLoop (Gateway وIoT وEdge وEdge Relay) والوصول الذي يحتاجه العتاد مفعّل، فيرى تثبيت مجرد من App Store أو من helm ما هو موصول بالعقدة دون تعديل يدوي، على شبكة الـ pod. وهو الكتلة `hardware:` في `values.yaml`: ثلاثة مفاتيح مفعّلة افتراضيًا، وخيار اختياري معطل افتراضيًا:

| القيمة | الافتراضي | ما تفعله |
|---|---|---|
| `hardware.privileged` | `true` | تعمل حاوية التطبيق بصلاحيات مميّزة (`privileged: true` و`allowPrivilegeEscalation: true`) وكـ root (`runAsUser: 0` و`runAsNonRoot: false` ودون إسقاط capabilities). root لأن عقدة USB التسلسلية هي `root:dialout 0660` وسياسة D-Bus في BlueZ تسمح لـ root ومجموعة `bluetooth` بالدخول؛ ومستخدم الحاوية الذي ليس في أي منهما لا يفتح شيئًا. يبقى نظام الملفات الجذري للقراءة فقط، وتحتفظ حاوية init وقاعدة البيانات المضمّنة بسياقهما الخاص دون root ومع إسقاط كل الـ capabilities. |
| `hardware.usbDevices.enabled` | `true` | يُركَّب `/dev` الخاص بالعقدة (`hardware.usbDevices.hostPath`) على `/dev`: محوّلات USB التسلسلية (`/dev/ttyUSB*` و`/dev/ttyACM*` و`/dev/serial/by-id/*`)، بما فيها ما وُصل بعد بدء الـ pod. الحاوية المميّزة لا تُمنح إلا الأجهزة التي كانت موجودة عند بدئها؛ والتركيب هو ما يجعل الجهاز الموصول من جديد يظهر. |
| `hardware.bluetooth.enabled` | `true` | يُركَّب مجلد D-Bus الخاص بالعقدة (`hardware.bluetooth.dbusPath`، وهو `/run/dbus` الذي يحوي `system_bus_socket`) على المسار نفسه، فيصل العميل إلى BlueZ الخاص بالعقدة. يُنشأ فارغًا على عقدة بلا D-Bus، فيبدأ الـ pod هناك أيضًا. |
| `hardware.bluetooth.hostNetwork` | `false` | الخيار الاختياري، المعطل افتراضيًا، لما يحتاج شبكة العقدة: مقابس Bluetooth في النواة (HCI وL2CAP) موجودة فقط في network namespace الخاص بالعقدة، فيحتاجه عميل يفتح أحدها مباشرة، والاكتشاف الذي يستمع على شبكة العقدة نفسها (mDNS وSSDP والبث المتعدد لراديو). أما العميل الذي يمر عبر واجهة D-Bus في BlueZ فيحتاج المقبس المركّب فقط ويعمل من شبكة الـ pod. عند التفعيل يعمل الـ pod على شبكة العقدة بالعواقب المذكورة في [الشبكة](#الشبكة). |

ما يفعله HotLoop به اليوم: لا شيء بعد. ليس لدى HotLoop شيفرة خاصة بـ Bluetooth أو Z-Wave أو USB التسلسلي (يأتي Zigbee عبر جسر Zigbee2MQTT فوق MQTT، راجع [وسيط MQTT المضمّن](/ar/iot/broker/))؛ هذا هو الوصول الذي تحتاجه ميزة، أو sidecar يقرأ راديو، جاهزًا قبل أن يُطلب.

ثمنه، عمدًا وبقرار: الـ pod هو root على العقدة (مميّز، مع `/dev` الخاص بالعقدة)، وتبقى NetworkPolicy الافتراضية في الـ chart مفعّلة لما تغطيه. يبقى الـ pod على شبكة الـ pods. عطّل أي جزء بـ `--set hardware.privileged=false --set hardware.usbDevices.enabled=false --set hardware.bluetooth.enabled=false`؛ وحين تُعطَّل الثلاثة يكون الناتج، سطرًا بسطر، الـ pod الذي أنتجه 4.19.6 (دون root، وكل الـ capabilities مُسقطة، وجذر للقراءة فقط، وشبكة pods). لما يحتاج شبكة العقدة، اضبط `hardware.bluetooth.hostNetwork=true` (أو `hostNetwork=true`): فتستجيب الصفحة حينها على كل عنوان في العقدة عند `service.targetPort`، وHotLoop واحد لكل عقدة لكل منفذ، ولا تنطبق NetworkPolicy على الـ pod، ويثبّته `nodeSelector` على العقدة التي يجب أن يرى راديوها.

### عمليات النشر على الحافة

صورة التطبيق مبنية لـ amd64 وarm64، وTimescaleDB 2.30.1-pg17 متعدد المعماريات، لذا فالمؤرِّخ ليس ما يعيق تثبيتًا على الحافة.

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

### النشر إلى الأعلى عبر Sparkplug

يستطيع Gateway على الحافة أيضًا أن ينشر كل ما يقرؤه إلى Gateway مركزي، كعقدة حافة Sparkplug B. راجع [النشر على الحافة والتخزين ثم الإعادة](/ar/edge/edge-publish/) لمعرفة ما ينشره وكيف يتصرف طابور الإعادة؛ وهذا جانب الـ chart.

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

ما الذي يتغير بتفعيله، ولماذا:

- **PVC بحجم 1Gi لطابور الإعادة**، مركّب عند `/data/edge-publish`. هناك تتراكم القراءات بينما الرابط الصاعد معطل، فلا بد أن يعيش أطول من الـ pod. يضعه `persistence.enabled: false` على emptyDir، الذي ينجو من إعادة تشغيل الحاوية ولا شيء غيرها.
- **يتدحرج الـ Deployment بـ `Recreate`.** الطابور ملف واحد عليه قفل. التحديث المتدرج يبدأ الـ pod الجديد أولًا، والـ pod الجديد لا يستطيع فتح الطابور، فلا يصبح جاهزًا أبدًا، ويبقى الطرح عالقًا إلى الأبد. يوقف Recreate القديم أولًا؛ وتخسر بضع ثوانٍ من الاستطلاع في كل ترقية.
- **يجب أن يكون `replicaCount` يساوي 1**، ويرفض الـ chart التصيير بخلاف ذلك. نسختان تعنيان ناشرَين يطالبان بعقدة Sparkplug واحدة.
- **معرّف العقدة افتراضيًا اسم الإصدار**، لا اسم مضيف الـ pod. يتغير اسم المضيف في كل طرح، وسيرى مضيف Sparkplug عقدة حافة جديدة تمامًا في كل مرة.

لا تدخل كلمة المرور أبدًا في قيمة افتراضية بنص صريح. اترك `password` و`existingSecret` فارغين لوسيط مجهول فلا يُنشأ أي Secret؛ اضبط `password` فيضعها الـ chart في `<release>-edge-publish`؛ اضبط `existingSecret` لاستخدام واحد تديره بنفسك.

### قاعدة بيانات خارجية

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

يكتشف التطبيق TimescaleDB ويرقّي `tag_history` إلى hypertable عندما يكون الامتداد موجودًا. وعلى PostgreSQL العادي يعود إلى التقسيم الأصلي بالنطاقات بدل أن يفشل.

يُسجَّل القرار و**يثبت**. قاعدة البيانات التي أُنشئت كـ hypertable ترفض البدء على خادم بلا الامتداد بدل أن تكتب في مكان آخر بصمت؛ فإن رأيت ذلك الخطأ، فقد وجّهت التطبيق إلى قاعدة بيانات غير التي بُني عليها.

### SQLite

قاعدة البيانات إعداد، لا صورة. يعمل كل منتج على SQLite أو Postgres أو TimescaleDB من الملف الثنائي نفسه (يتجاوز IoT قاعدة TimescaleDB، انظر أدناه):

| المتغير | الافتراضي | ما يفعله |
|---|---|---|
| `HOTLOOP_DB_TYPE` | `postgres` | `postgres` أو `sqlite`. TimescaleDB هو `postgres` مع الامتداد على الخادم |
| `HOTLOOP_DB_PATH` | `/data/hotloop.db` | ملف SQLite. لا يقرؤه إلا SQLite |

SQLite هو نسخة Go الخالصة (`modernc.org/sqlite`)، مُجمَّعة في كل صورة، فلا حاوية ثانية، ولا صورة Postgres بحجم 300 MB على بطاقة SD، وتبقى بنى arm ساكنة. ضع الملف على مجلد حجمي يعيش أطول من الحاوية، وعلى Pi ضع ذلك المجلد الحجمي على SSD عبر USB. مؤرِّخ يكتب على بطاقة SD طوال اليوم هو طريقة لشراء الكثير من بطاقات SD.

ما هو متطابق: كل جدول وكل عمود وكل ميزة. وما هو مختلف:

- السجل التاريخي جدول واحد بفهرس واحد، لا أقسام ولا hypertable، ويحذف الاحتفاظ الصفوف القديمة بدل إسقاط أشهر. الموقع الذي له سنوات من السجل كل ثانية يريد Postgres أو TimescaleDB، والانتقال إليهما نسخ احتياطي واستعادة (BACKUP.md).
- كاتب واحد في كل مرة. يتناوب SQLite على الكتابة ويقرأ بجانبها (WAL)، وهذا أكثر من كافٍ لـ HotLoop واحد ومساعد `--mcp-stdio` بجانبه على الملف نفسه. وليس لنسختين على تخزين شبكي: يتلف SQLite على NFS، لذا فنشر SQLite هو pod واحد بمجلد حجمي محلي.
- عمليات الإيداع هي `synchronous=FULL`: حين تقول الواجهة إنها حفظت، يكون على القرص، سواء انقطع التيار أم لا.

**HotLoop IoT** يحتفظ افتراضيًا بـ 30 يومًا من السجل (ويظل `HOTLOOP_HISTORIAN_RETENTION_DAYS` هو الغالب إذا ضُبط) ولا يبني hypertable أبدًا: TimescaleDB جزء من Edge وGateway. اضبط `HOTLOOP_HISTORIAN_TIMESCALE=true` على IoT فيقول ذلك عند البدء ويعمل على أقسام عادية. وقاعدة بيانات نُقلت إلى أسفل من Edge أو Gateway ولديها hypertable بالفعل تحتفظ بها وتواصل العمل.

#### اختيار قاعدة البيانات في الـ chart

قيمة واحدة، `database.type`، ويقبل كل منتج تلك التي يعمل عليها:

| `database.type` | ما يُنشر | IoT | Edge | Gateway |
|---|---|---|---|---|
| `timescaledb` | التطبيق وTimescaleDB (StatefulSet ومجلده الحجمي). السجل في hypertable | مرفوض | افتراضي | افتراضي |
| `postgresql` | التطبيق وPostgreSQL 17 العادي (StatefulSet ومجلده الحجمي). السجل في أقسام أصلية | افتراضي | نعم | نعم |
| `sqlite` | التطبيق وحده، مع ملف قاعدة البيانات على مجلد حجمي خاص به | نعم | نعم | نعم |

```bash
helm install hotloop hotloop/hotloop-iot --namespace hotloop --create-namespace   --set database.type=sqlite
```

طلب `timescaledb` لـ IoT يُفشل التثبيت ويقول على ماذا يعمل IoT (`database.type is "timescaledb", and HotLoop IoT runs on sqlite, postgresql`)، ولا يعرضه نموذج App Store. لا يلتقطه `helm lint` (فـ helm 3.22 يفحصه سليمًا)، فالتصيير هو الذي يرفض. وترك `database.type` يعطي الافتراضي الخاص بالمنتج، فترقية بـ `--reuse-values` من قبل وجود المفتاح تحتفظ بقاعدة البيانات التي كانت لديها.

يُصيّر `sqlite`:

- `HOTLOOP_DB_TYPE=sqlite` و`HOTLOOP_DB_PATH=/data/db/hotloop.db`، ولا شيء من إعدادات اتصال Postgres. لا pod لقاعدة بيانات، ولا كلمة مرور لقاعدة البيانات في Secret، ولا حاوية init تنتظر واحدة.
- PersistentVolumeClaim باسم `<release>-db` (`database.sqlite.persistence`: `size` و`storageClass` و`accessMode`، و10Gi وافتراضي العنقود للبداية)، مركّب عند `/data/db`. المجلد لا الملف: يحتفظ SQLite بـ `-wal` و`-shm` بجانب قاعدة البيانات. ضعه على تخزين محلي؛ يتلف SQLite على NFS.
- الـ Deployment على `Recreate`، لا تحديث متدرج، لأن المجلد الحجمي `ReadWriteOnce` والملف له كاتب واحد. و`replicaCount` فوق 1 يُفشل التثبيت.

تبقى NetworkPolicy دون تغيير ومفعّلة: سياسة التطبيق الخاصة به ما زالت سارية، ولا تُصيَّر سياسة قاعدة البيانات إلا عند وجود pod لقاعدة بيانات يجب حمايته.

تغيير `database.type` على إصدار فيه بيانات لا ينقل البيانات. تبدأ قاعدة البيانات الجديدة فارغة، فنقل مصنع بين قواعد البيانات نسخ احتياطي واستعادة (BACKUP.md)، كما مع المتغير. وبوجه خاص ترفض قاعدة بيانات أُنشئت كـ hypertable في TimescaleDB البدء على PostgreSQL العادي، فلا تحوّل Edge أو Gateway قائمًا من `timescaledb` إلى `postgresql` وتتوقع أن يعمل.

#### اختيار قاعدة البيانات في Quadlet

مجلد كل منتج تحت `deploy/quadlet/` فيه ملفات PostgreSQL أو TimescaleDB كما كانت، ومجلد `sqlite/` بجانبها: `hotloop.container` و`hotloop-data.volume`، التطبيق وحده مع الملف عند `/data/hotloop.db` على المجلد الحجمي `hotloop-data`. يتبع `:stable` ويتراجع عن التحديث السيئ بالطريقة نفسها. ثبّت هذين الملفين بدل الأخرى (فهي تستخدم أسماء الوحدات نفسها)، وأنشئ سرّين بدل ثلاثة: لا توجد كلمة مرور لقاعدة البيانات. الخطوات في [`deploy/quadlet/README.md`](/ar/install/quadlet/).

لأقسام Postgres العادية على Edge أو Gateway تحت Quadlet، احتفظ بوحدة TimescaleDB وأضف `Environment=HOTLOOP_HISTORIAN_TIMESCALE=false` إلى `hotloop.container`. وحدة IoT تعمل بالفعل على PostgreSQL العادي.

### مفتاح بيانات اعتماد الأجهزة

```yaml
secretKey:
  enabled: true
  existingSecret: ""     # or a Secret you manage, with the key under secret.key
```

تُشفَّر كلمات مرور الأجهزة (تسجيل الدخول إلى وحدة تحكم UniFi، وكلمة مرور OPC UA أو MQTT، ومفاتيح HTTP API) في قاعدة البيانات بهذا المفتاح، فلا يحتوي التفريغ أو النسخة الاحتياطية إلا نصًا مشفّرًا. يولّد الـ chart مفتاحًا جاهزًا في `<release>-secret-key` عند أول تثبيت، ويحتفظ به عبر الترقيات، ويحتفظ به أيضًا عند `helm uninstall` (`helm.sh/resource-policy: keep`)، لأن قاعدة بيانات محفوظة على مجلدها الحجمي لا تنفع لبيانات اعتمادها بدونه. يُركَّب كملف ويُمرَّر كـ `HOTLOOP_SECRET_KEY_FILE`، ولا يُمرَّر كمتغير بيئة أبدًا.

احتفظ بنسخة احتياطية من الـ Secret منفصلة عن النسخ الاحتياطية لقاعدة البيانات: مفتاح موضوع بجانب النسخ التي يحميها لا يحمي شيئًا. لإحضار مفتاحك الخاص، يطبع `hotloop gen-secret-key` واحدًا. خارج Kubernetes، اكتبه في ملف لا يقرؤه إلا HotLoop ووجّه `HOTLOOP_SECRET_KEY_FILE` إليه. بدون مفتاح يعمل HotLoop، ويقول في سجل البدء إن كلمات مرور الأجهزة تُخزَّن كما كُتبت، ويرفض حفظ وحدة تحكم UniFi. وتُشفَّر بيانات الاعتماد المخزَّنة سابقًا عند أول بدء بمفتاح. راجع [النسخ الاحتياطي والاستعادة](/ar/iot/backup/#بيانات-اعتماد-الأجهزة-والمفتاح-السري) لمعرفة ما يعنيه ذلك للاستعادة.

## الإعداد، وما يمكن لشاشة الإعدادات تغييره

تأتي كل إعدادات تقريبًا من متغير بيئة يضبطه الـ chart من قيمة Helm. وهذا هو المكان الصحيح: الإعداد الذي يقرر ما إذا كانت هذه العملية تستطيع إصدار أوامر للآلات ينتمي إلى النشر، بعد مراجعته، لا إلى نموذج في صفحة ويب.

تعرض شاشة **الإعدادات** كل شيء، كل إعداد، وقيمته الفعلية، وهل جاءت من قاعدة البيانات أو من متغير بيئة أو من الافتراضي المضمّن، والمتغير الذي يغيّرها. معظمها للقراءة فقط، وهذا هو المقصود: السؤال الذي تجيب عنه هو "لماذا يفعل هذا، وماذا أغيّر؟"

أربعة إعدادات هي هوية المصنع لا سلوكه، وتُحرَّر هناك. تُخزَّن في قاعدة البيانات وتسري فورًا، لأن المصنع يُعاد تسميته أكثر بكثير مما يُعاد نشره:

| الإعداد | المتغير الذي يتجاوزه |
|---|---|
| اسم المصنع | `HOTLOOP_PLANT_NAME` |
| معرّف الموقع | `HOTLOOP_SITE_ID` |
| المنطقة الزمنية | `HOTLOOP_TIMEZONE` |
| التأكيد قبل الكتابة | `HOTLOOP_CONFIRM_WRITES` |

تحت الإعدادات بطاقات هي بيانات لا إعداد، وتُحرَّر للسبب نفسه: **المستخدمون** ([المصادقة والمستخدمون](/ar/iot/authentication/))، و**تصعيد الإنذارات**، الذي يحدد من يُبلَّغ بعد ذلك حين لا يقرّ أحد بإنذار ومتى ([إشعارات الإنذارات](/ar/iot/notifications/#التصعيد))، ووجهات المؤرِّخ وعمليات تسجيل دخول MQTT. القنوات التي يستطيع التصعيد استخدامها تبقى من شأن النشر، وتُضبط بـ `HOTLOOP_NOTIFY_*`.

القيمة المخزَّنة تغلب متغير البيئة، فتصبح قيمة الـ chart نقطة البداية لا الكلمة الأخيرة. تُرفض المنطقة الزمنية التي لا تستطيع الآلة حلّها بدل أن تُقبل ويُتجاهل أمرها بصمت، وهو ما كان سيترك كل ختم زمني يعود إلى UTC دون أن يقول شيء لماذا.

وينطبق الأمر نفسه على قيمة النشر ذاته. إذا سمّى `HOTLOOP_TIMEZONE` (أو `TZ` حين يكون غير مضبوط) منطقة لا تُحمَّل، يرفض HotLoop البدء ويذكر الخطأ المتغير والقيمة. كان في السابق يهز كتفيه ويعمل على UTC. التقارير والجداول وأوقات الورديات كلها تجري على ساعة المصنع، وتخمين بفارق ساعات أسوأ من pod يقول لماذا لا يعمل.

موقع الموقع هو `HOTLOOP_SITE_LATITUDE` و`HOTLOOP_SITE_LONGITUDE` (في الـ chart: `plant.latitude` و`plant.longitude`)، بالدرجات العشرية، والشمال والشرق موجبان. تُحسب منهما على الجهاز الشروق والغروب وكيانات الشمس ومحفّزاتها ([الشمس](/ar/iot/sun/)). كلاهما أو لا شيء، والقيمة الخاطئة توقف البدء مع ذكر المتغير. تعرضهما شاشة الإعدادات للقراءة فقط: القواعد تُطلَق عند شروق، فنقله نشر.

**مفاتيح السلامة غير قابلة للتحرير ولن تكون.** `HOTLOOP_ALLOW_WRITES` هو التحكم الرئيسي في ما إذا كانت هذه العملية تستطيع إصدار أوامر للمعدات؛ والتحكم الذي يمكن إعادة تشغيله من جلسة المتصفح نفسها التي تصدر الكتابة ليس تحكمًا. و`HOTLOOP_HISTORIAN_RETENTION_DAYS` كذلك خاص بالنشر: تُطبَّق سياسة الاحتفاظ على قاعدة البيانات عند البدء، فحقل على شاشة سيبدو فاعلًا ولن ينقل أي بيانات. ترفض نقطة النهاية أي مفتاح خارج المجموعة القابلة للتحرير **بالاسم**، بدل تجاهله.

قيد واحد، يُذكر لأن الشاشة تذكره أيضًا: يبني خادم MCP تعليماته عند البدء، فيعلن اسم المصنع الذي بدأ به حتى يُعاد تشغيل الـ pod. وكل ما عداه يلتقط إعادة التسمية عند الطلب التالي.

## PostgreSQL 17

قاعدة بيانات HotLoop هي PostgreSQL 17 (وعليها TimescaleDB 2.30.1 لـ Edge وGateway، وPostgreSQL 17.11 العادي لـ IoT ولـ `database.type: postgresql`). كانت الإصدارات قبل هذا تعمل على PostgreSQL 16، ولا يفتح PostgreSQL مجلد بيانات إصدار رئيسي آخر. لذا يُنجز الانتقال عنك، عند الترقية، ولا شيء لتشغيله.

**على الـ chart،** يحصل pod قاعدة البيانات على حاويتي init. الأولى تشغّل صورة PostgreSQL 16 وتنسخ ذلك التثبيت إلى مجلد حجمي مؤقت، وفقط حين يحوي المجلد الحجمي بيانات 16. والثانية تشغّل الصورة الجديدة وتجري `pg_upgrade` إلى مجلد جديد بجانب القديم. وكلتاهما تترك مجلدًا جديدًا، أو مجلدًا على 17 أصلًا، وشأنه. الترقية هي `helm upgrade`، لا أكثر. توقّع أن يبقى pod قاعدة البيانات في `Init` ما دام نسخ البيانات يستغرق، وأن ينتظره التطبيق؛ و`kubectl logs <release>-postgresql-0 -c pg-upgrade` هو السجل.

**على Quadlet،** يعمل `hotloop-db-upgrade.container` قبل `hotloop-db.service` ويفعل الشيء نفسه في وحدة oneshot. انسخ `hotloop-db.container` و`hotloop-db-upgrade.container` و`hotloop-db-upgrade.sh` الجديدة من مجلد منتجك إلى مجلد الوحدات وأعد تشغيل وحدة قاعدة البيانات؛ والأوامر في [README الخاص بـ Quadlet](/ar/install/quadlet/). تتطلب وحدة قاعدة البيانات وحدة الترقية، فالجهاز الذي لم يحصل إلا على وحدة قاعدة البيانات الجديدة لا يبدأ على بيانات 16 ويقول لماذا: يفشل، ولا يخمّن. و`journalctl -u hotloop-db-upgrade` هو السجل. لا تعمل الوحدة إلا حين يحوي المجلد الحجمي بيانات 16: على جهاز جديد، وفي كل بدء بعد الترقية، يتجاوزها systemd (تظهر غير نشطة لا فاشلة) ولا تُسحب صورة PostgreSQL 16 أبدًا. وحين يحوي المجلد الحجمي بيانات 16، تسحب الوحدة تلك الصورة أولًا.

ما تفعله، بالترتيب، كله في `hotloop-pg-upgrade.sh` (ملف واحد، هو نفسه الذي يشغّله الـ chart والوحدات):

1. لا مجلد بيانات، أو مجلد على 17 أصلًا: لا شيء، وتقول ذلك. وأي إصدار رئيسي آخر يُرفض دون تغيير أي شيء.
2. يبدأ الخادم القديم مرة واحدة على مقبس خاص ويوقفه نظيفًا، وهو ما يعيد تشغيل السجل بعد انقطاع التيار ويقرأ الترميز والإعدادات المحلية اللذين يجب أن يطابقهما العنقود الجديد.
3. ينفّذ `initdb` لمجلد جديد بجانب القديم بتلك الإعدادات، ويشغّل `pg_upgrade` بوضع النسخ (يُقرأ المجلد القديم فقط)، وينقل `postgresql.conf` و`postgresql.auto.conf` و`pg_hba.conf` و`pg_ident.conf`.
4. يبدأ الخادم الجديد مرة واحدة ليثبت أنه يُفتح بالإعدادات النهائية ويجمع إحصاءات المخطِّط التي لا ينقلها `pg_upgrade`.
5. عندها فقط يبدّل الأسماء: يصبح المجلد القديم `pgdata.pg16` والجديد `pgdata`.

يحتاج مساحة حرة بجانب البيانات تقارب ما تشغله البيانات، ويتحقق من ذلك قبل أن يبدأ. وإذا فشل أي شيء قبل الخطوة 5، تنتهي الترقية برمز غير صفري، وتبقى بيانات 16 كما كانت تمامًا، ولا تبدأ قاعدة البيانات على مجلد نصف مبني: على الـ chart يبقى الـ pod في `Init:Error`، وعلى Quadlet تفشل وحدة الترقية ولا تبدأ وحدة قاعدة البيانات التي خلفها أبدًا. أصلح ما يقوله السجل وابدأ من جديد؛ فالمحاولة غير المكتملة تُزال وتُعاد. ينتقل امتداد TimescaleDB بالإصدار الذي كان عليه، ويحدّثه التطبيق إلى الإصدار المرفق عند بدئه التالي، كما كان دائمًا. إرشاد TimescaleDB نفسه لترقية PostgreSQL في المكان هو `pg_upgrade` بالملفات الثنائية القديمة والجديدة ([Tiger Data، "Upgrade PostgreSQL"](https://www.tigerdata.com/docs/deploy/self-hosted/upgrades/upgrade-pg)).

النسخة الاحتياطية هي المجلد القديم نفسه. لا يكتب `pg_upgrade` بوضع النسخ فيه أبدًا، فـ `pgdata.pg16` هو قاعدة بيانات PostgreSQL 16 كاملة كما كانت، وهي نسخة احتياطية أفضل من التفريغ والشيء الوحيد الذي يجعل طريق العودة أدناه ممكنًا. أما النسخة الاحتياطية الخاصة بـ HotLoop ([النسخ الاحتياطي والاستعادة](/ar/iot/backup/)) فيجريها التطبيق العامل عبر قاعدة البيانات العاملة، فلا يمكن أخذها في الخطوة التي تعمل قبل أن تبدأ قاعدة البيانات. خذ واحدة على الإصدار القديم قبل أن ترقّي مع ذلك، وانسخها خارج الجهاز.

### العودة

`helm rollback`، أو إعادة `hotloop-db.container` السابق، يعيد قاعدة البيانات إلى صورة PostgreSQL 16 (التحديث التلقائي في Podman لا يفعل ذلك: فهو يحرّك التطبيق فقط)، ولا يفتح PostgreSQL 16 مجلد 17 (`database files are incompatible with server`، ويقول السجل إن المجلد هُيّئ بالإصدار 16). لا يضيع شيء ولا يتغير شيء نصف تغيير؛ قاعدة البيانات فقط لا تبدأ. ما يحتاجه الإصدار السابق هو مجلد 16 الخاص به، وهو `pgdata.pg16`. أوقف قاعدة البيانات، ثم أعد الأسماء:

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

هذه هي قاعدة البيانات كما كانت عند الترقية، ولا شيء مما كُتب منذئذ. لا ينفع تبديل العودة إلا مرة واحدة: ترفض الترقية العمل ما دام `pgdata.pg16` في الطريق، فمحاولة الترقية التالية تحتاج أولًا إلى `pgdata.pg17` وإلى معالجة المجلد القديم. الطريق إلى الأمام هو الحل، والتراجع لجهاز لا يستطيع تشغيل 17 أصلًا. قاعدة التراجع الخاصة بالتطبيق لم تتغير: مخطط مجلد 16 هو ما تركه الإصدار الذي سبق الترقية، والإصدار الذي يجد ترحيلات لا يعرفها يقول ذلك، راجع [الترحيلات تضيف فقط](/ar/iot/migrations/).

### عندما تطمئن

يبقى `pgdata.pg16` حتى تحذفه، لأن حذفه هو حذف طريق العودة الوحيد. وهو بحجم قاعدة البيانات. بعد أن يعمل الجهاز على 17 المدة التي تريدها:

```sh
# chart
kubectl -n hotloop exec hotloop-postgresql-0 -c postgresql -- rm -rf /var/lib/postgresql/data/pgdata.pg16
# Quadlet
sudo rm -rf "$(sudo podman volume inspect hotloop-db --format '{{.Mountpoint}}')/pgdata.pg16"
```

### إيقافه

يزيل `database.postgresql.upgrade.enabled: false` حاويات init. فيمنع مجلد حجمي ما زال على 16 قاعدة البيانات من البدء، ويصبح الانتقال عليك. اتركه مفعّلًا: وهو مفعّل، يسحب التثبيت الجديد صورة PostgreSQL 16 مرة لكل عقدة لأن صورة حاوية init تُسحب قبل تشغيلها، ثم لا يشغّلها أبدًا.

## الترقية من 3.x

**هذا استبدال، لا ترقية.** كان 3.x منتجًا مختلفًا. لا يوجد مسار ترحيل لبياناته، لأنه لا يشترك في نموذج بيانات مع مؤرِّخ وسوم.

```bash
helm uninstall hotloop -n hotloop
# keep or delete the old PVCs deliberately, they hold the HA recorder database
helm install hotloop ./charts/hotloop -n hotloop
```

أشياء لم تعد موجودة وسيُرفض ضبطها: `sidecarProxy` و`homeassistant` والإضافات `mqtt`/`nodered`/`esphome`/`zigbee2mqtt` و`devices` و`cameras` و`customConfig` و`network.hostNetwork`.

## التراجع عن تحديث

يعيد `helm rollback hotloop -n hotloop` صورة الإصدار السابق. ولا يعيد قاعدة البيانات: فالإصدار يرحّل عند البدء، ويبقى ذلك منجزًا. القاعدة والفحص في [الترحيلات تضيف فقط](/ar/iot/migrations/).

الشيء الوحيد الذي يعيده التراجع عبر إصدار PostgreSQL 17 هو محرك قاعدة البيانات: تعود صورة قاعدة بيانات الـ chart إلى 16، وهي لن تفتح المجلد المرقّى. [العودة](#العودة) هي المخرج.

هو آمن لإصدار واحد إلى الوراء. تسجّل قاعدة البيانات أي إصدار طبّق كل ترحيل، والإصدار الذي يجد ترحيلات من إصدارين أحدث منه أو أكثر يرفض البدء:

```
refusing to start: this database's schema is more than one release ahead of
HotLoop 4.18.10. ...
```

هذا ليس عطلًا يُلتفّ حوله. إنه يعني أن قاعدة البيانات تقدمت أبعد مما شُغّل هذا الإصدار عليه. تقدّم إلى إصدار يعرف المخطط، وهو الأحدث، أو استعد نسخة احتياطية أخذها الإصدار الذي أنت عليه ([النسخ الاحتياطي والاستعادة](/ar/iot/backup/)). إصدار واحد بالضبط إلى الوراء يبدأ، مع تحذير في السجل يذكر الإصدارين. خذ نسخة احتياطية قبل الترقية؛ لا يستطيع التراجع إلغاء بيانات كتبها الإصدار الأحدث.

## التحقق من تثبيت

```bash
kubectl -n hotloop get pods
kubectl -n hotloop logs deploy/hotloop | head -20
```

يقول البدء السليم البروتوكولات التي يتحدثها، ويطبّق الترحيلات، ويبلّغ عن وضع السجل، ويحذّر من كل ما يستحق العلم:

```
msg=starting version=4.0.0 protocols="[ethernet-ip http modbus mqtt mtconnect opcua s7comm]"
msg="writes are ENABLED: the UI, API, automations and MCP can all command devices"
msg="tag_history promoted to a hypertable" timescale=2.30.1
msg="history schema ready" mode=timescale
msg=listening addr=:8080 mcp=/mcp writes=true
```

ثم تحقق من التسميات التي تحتاجها اللوحة. هذا هو الفحص الذي يلتقط الانحراف، تحقق من **المجموعة**، لا من العدد، لأن فحص العدد ينجح بينما المجموعة خاطئة:

```bash
kubectl -n hotloop get svc <release> -o json \
  | jq -r '.metadata.labels | keys[] | select(startswith("embernet.ai/"))'
```

أربع بالضبط، على الـ Service وعلى الـ pod:

```
embernet.ai/app-name
embernet.ai/gui-port
embernet.ai/gui-type
embernet.ai/store-app
```

إذا كان التطبيق يعمل لكنه غائب عن التطبيقات قيد التشغيل، فتسميات الـ Service هي أول مكان تنظر فيه: تستعلم اللوحة عن الـ Services بـ `embernet.ai/store-app`.

ينشر النشر من App Store خمس تسميات أخرى، من `tenantLabels` التي تمررها اللوحة: `embernet.ai/tenant` و`app-id` و`source` و`deployed-by` و`deployment-id`. تُوضع على كل مورد يصيّره الـ chart وعلى pod الـ gateway. تقرأ اللوحة المستأجر من الـ Service ولا من أي مكان آخر، فالـ Gateway المنشور من المتجر دون `embernet.ai/tenant` على الـ Service الخاص به لا ينتمي إلى أحد. و`helm install` العادي لا يصيّر أيًا من الخمس.

## المجسّات

- `/healthz`، liveness. يستجيب ما دامت العملية تعمل.
- `/readyz`، readiness. يتطلب قاعدة البيانات إضافةً، فالـ pod الذي فقد مؤرِّخه يتوقف عن استقبال الحركة بدل أن يقدّم واجهة لا تستطيع الإجابة عن شيء.

يسمح مجسّ البدء بدقيقتين، لأن أول تثبيت ينفّذ الترحيلات ولا يجوز لمجسّ liveness أن يقتله في منتصف ترحيل.

## الإيقاف

`terminationGracePeriodSeconds: 45`. عند SIGTERM يتوقف التطبيق عن قبول الطلبات، ثم يفرّغ طابور المؤرِّخ حتى تُكتب القراءات المأخوذة بالفعل بدل أن تُرمى. تقصير مهلة السماح أكثر من اللازم يضيّع ما كان قيد التنفيذ.

## استكشاف الأخطاء

**جهاز عالق في `connecting`.** انظر `lastError` على بطاقة الجهاز. غالبًا جدار ناري بين الـ pod والمعدات، أو منفذ خاطئ. لا يقيّد الـ chart الـ egress، فـ NetworkPolicy التي تحجبه شيء آخر في العنقود.

**الوسوم تقرأ جودة سيئة.** استجاب الجهاز لكن النقطة لم تستجب. في Modbus تحقق من أساس العناوين، `oneBased` إذا كانت رسوماتك تستخدم ترقيم 40001. وفي OPC UA تحقق من أن معرّف العقدة جرى حلّه؛ وفضّل الصيغة `nsu=`.

**القيم تبدو معقولة لكنها خاطئة.** في Modbus هذا ترتيب الكلمات، جرّب `CDAB`. هذا هو العطل الذي لا يعلن عن نفسه، لأن الرقم ليس خاطئًا بوضوح.

**لا شيء يُؤرَّخ.** تحقق من تشخيصات شاشة البروتوكولات. يعدّ `filtered` القراءات التي كبتها النطاق الميت، وهذا يعمل كما هو مقصود؛ ويعدّ `dropped` القراءات التي ضاعت لأن قاعدة البيانات لم تلحق، وهذا ليس كذلك.

**MCP يعيد 401.** رمز bearer. اقرأه من Secret الإصدار.

**كل طلب إلى `/api/` يعيد 401.** متوقع متى كان `auth.enabled` يساوي true ولم يسجّل أحد الدخول بعد، وهذا هو المقصود من 4.4.0. اقرأ كلمة مرور المسؤول المولّدة من Secret الإصدار (راجع [المصادقة](#المصادقة)) وسجّل الدخول عبر الواجهة، أو `POST /api/auth/login` مباشرة. راجع [المصادقة والمستخدمون](/ar/iot/authentication/).

**فُقدت كلمة مرور المسؤول ولا يوجد حساب مسؤول آخر.** ولّد تجزئة جديدة وعدّل الـ Secret، ثم أعد تشغيل الـ pod ليعيد قراءة البيئة؛ لا يمس `EnsureAdminUser` حسابًا موجودًا، فهذا يستبدل الصف مباشرة بدل المرور عبر الـ chart:

```bash
hotloop hash-password -password 'a-new-one'
kubectl exec -n hotloop deploy/hotloop -- \
  psql "$DATABASE_URL" -c \
  "UPDATE users SET password_hash = '<the hash>' WHERE username = 'admin'"
```

**أتمتة مفعّلة لكنها لا تعمل.** فشل تصريفها. تعرضها شاشة الأتمتة بحالة NOT ARMED مع السبب، وفي سجل النظام الخطأ.
