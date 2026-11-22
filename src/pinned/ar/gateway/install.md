---
title: "تثبيت HotLoop Gateway {{hotloop}} باستخدام Helm"
description: "ثبّت HotLoop Gateway {{hotloop}} من مخطط Helm المنشور على k3s أو أي Kubernetes، وسجّل الدخول، واضبط ما يهم قبل أن يراه مصنع حقيقي."
sidebar:
  label: "التثبيت"
---

يُسلَّم HotLoop Gateway {{hotloop}} كصورة حاوية لمعماريتي amd64 وarm64، بحجم نحو 37 ميغابايت على amd64 و35 على arm64، مع مخطط Helm. يُسحب كلاهما دون تسجيل دخول. يحتفظ بالأسماء التي صدر بها حتى 4.17.0، الصورة `ghcr.io/hotloop-io/hotloop` والمخطط `hotloop`، فلا يضطر أحد ممن يشغّله إلى تغيير شيء. هل يعمل لديك إصدار أقدم؟ لا تثبّت فوقه. [الترقية](/ar/gateway/upgrading/) فيها المسار من 4.17.0، وهو `helm upgrade` عادي، والمسارات من 4.16.0 و4.3.1 التي تسير على مراحل.

هناك طريقتان لتشغيله فعلًا: مخطط Helm على أي Kubernetes بما فيه k3s، وPodman Quadlet على صندوق ليس ضمن عنقود، وهو أدناه. لا يوجد مسار Docker أو Compose، وهذا مقصود، وأمر `podman run` المجرد الذي يُنفَّذ من صدفة تموت مع الجلسة ليس تثبيتًا.

## Helm

```bash
helm repo add hotloop https://hotloop.io/hotloop
helm repo update
helm install hotloop hotloop/hotloop --version {{hotloop}} \
  --namespace hotloop --create-namespace
```

هذا ينشر Gateway، ومعه TimescaleDB 2.30.1 بجانبه على وحدة تخزين بسعة 20 Gi، ويحتفظ بتاريخ 90 يومًا. قاعدة البيانات إعداد، `database.type`: القيمة `timescaledb` هي الافتراضية، و`postgresql` يشغّل PostgreSQL 17 عاديًا، و`sqlite` يشغّل Gateway على ملف دون أي pod لقاعدة بيانات، بنسخة واحدة وتخزين محلي، وليس NFS أبدًا. الانتقال بينها لاحقًا نسخ احتياطي واستعادة، لأن قاعدة البيانات الجديدة تبدأ فارغة. الصندوق الذي يحمل أصلًا بيانات PostgreSQL 16 ينتقل إلى 17 عند ترقيته التالية دون أن تفعل شيئًا، لذا [اقرأ كيف يجري ذلك](/ar/gateway/upgrading/#upgrading-from-41810) قبل أن تلمس مصنعًا يعمل. يولّد المخطط كلمة مرور قاعدة البيانات ورمز MCP وكلمة مرور المسؤول في Secret الإصدار ويعيد استخدامها في كل ترقية، فلا يغيّر `helm upgrade` كلمة مرور من وراء ظهرك ولا يُخرجك من مصنعك.

## انسخ المفتاح احتياطيًا قبل أن تحتاج إليه

يولّد المخطط أيضًا Secret ثانيًا، `<release>-secret-key` (و`hotloop-secret-key` مع الأمر أعلاه). يحمل المفتاح الذي يشفّر كل كلمة مرور يحتفظ بها HotLoop لجهاز: `password` لجهاز OPC UA أو MQTT أو HTTP أو MTConnect أو UniFi، وقيم ترويسات HTTP وMTConnect مثل مفاتيح API، وكلمة مرور كل وسيط MQTT آخر يستمع إليه الاكتشاف، وكلمة مرور كل هدف للمؤرشف. المفتاح ليس في قاعدة البيانات أبدًا ولا في أي نسخة احتياطية، لذا فإن تفريغًا يخرج من الباب على حاسوب محمول يحوي نصًا مشفّرًا لا مفاتيح المصنع.

يحتفظ المخطط بهذا Secret عبر الترقيات، وعبر `helm uninstall` أيضًا، لأن قاعدة بيانات تُترك على وحدة تخزينها لا نفع منها لبيانات اعتمادها دونه. وهذا يعني أيضًا أن **المفتاح جزء من بياناتك.** شغّل Gateway من دونه فيبقى كل جهاز ذي كلمة مرور مختومة متوقفًا يعيد المحاولة، مع خطأ يسمّي المفتاح الذي يحتاج إليه. لا تُستعاد النسخة الاحتياطية إلا حيث يكون ذلك المفتاح مثبّتًا، ويرفضها `--restore-from` باسمها في أي مكان آخر.

لذا انسخ Secret احتياطيًا كما تنسخ بقية أسرار العنقود، واحفظه في مكان غير بجانب نسخك الاحتياطية. مفتاح بجانب النسخ التي يحميها لا يحمي شيئًا.

**هل تعرض المخطط بدل أن تثبّته؟ أحضر مفتاحك الخاص.** يُولَّد المفتاح بواسطة `lookup` لا يستطيع تنفيذه إلا `helm install` أو `helm upgrade` حقيقي. كل ما يشغّل `helm template` ويطبّق الناتج يحصل على مفتاح جديد في كل عرض، وتقفل المزامنة التالية كل كلمة مرور مختومة. أنشئ مفتاحًا بالأمر `hotloop gen-secret-key`، وضعه في Secret تديره أنت تحت المفتاح `secret.key`، وسمِّ ذلك Secret في `secretKey.existingSecret`. Helm وFleet وApp Store في EmberNet كلها تثبّت فعليًا ولا تحتاج إلى هذا.

بيانات الاعتماد المكتوبة داخل عنوان URL (`mqtt://user:pass@host`) أو في نص حر تبقى واضحة. ضعها في `password`. [بيانات اعتماد الأجهزة](/ar/iot/protocols/#device-credentials) فيها القائمة الكاملة لما يُشفَّر.

## تسجيل الدخول

المستخدم هو `admin`. تطبع ملاحظات التثبيت الأمر الذي يقرأ كلمة المرور من جديد:

```bash
kubectl -n hotloop get secret hotloop \
  -o jsonpath='{.data.admin-password}' | base64 -d
kubectl -n hotloop port-forward svc/hotloop 8080:8080
```

افتح `http://localhost:8080`. حساب admin هذا حساب تهيئة وليس مفتاح إعادة ضبط. بعد وجوده، لا يفعل تغيير `auth.admin.password` مع الترقية شيئًا، فلا تُمحى كلمة مرور ضبطها أحدهم في الواجهة بالنشر التالي.

الآن أضف جهازًا، واكتشف وسومه، وجرّب الكتابة إلى أحدها. لن تستطيع. وهذا مقصود. يبدأ كل وسم للقراءة فقط ويُفعَّل واحدًا واحدًا، ويبقى `safety.allowWrites` معطلًا حتى تقرر أن هذا الـ pod يحق له تحريك الآلات. يجب ألا ينتهي أول يوم لأحد مع HotLoop بمكبس يفعل شيئًا لم يطلبه أحد.

## سلامة الصندوق وتركيب المضيف

يقدّم خادم OPC UA في المخطط أيضًا سلامة هذا الصندوق نفسه (المعالج والذاكرة والقرص واهتزاز الزمن الحقيقي عندما يكتب وكيل الملف) للوحة EmberNet، وينشئ لها تسجيل دخول يقرأ الوسوم والقيم ولا شيء غير ذلك، وتُحفظ كلمة مروره في Secret `<release>-opcua-dashboard` عبر الترقيات. التركيبات مفعّلة افتراضيًا: يركّب المخطط جذر المضيف على `/host` و`/proc` الخاص به على `/host/proc`، كلاهما للقراءة فقط، ولا يضيف أي امتياز. العنقود الذي يفرض ملف Pod Security المقيَّد يرفض hostPath، فهناك تضبط `opcuaServer.dashboard.boxHealth.enabled: false` فلا جهاز ولا تركيبات، أو `opcuaServer.dashboard.boxHealth.hostMount: false` لإبقاء الجهاز مع ظهور القرص والمعالج غير صالحين وبيان ما يجب تركيبه. ملف Quadlet الإضافي هو `deploy/quadlet/opcua-dashboard.conf`.

## ما تضبطه قبل أن يراه مصنع حقيقي

ضع هذه في ملف قيم وثبّت باستخدام `-f`. لا تعتمد على `--set` في أي شيء ستحتاج إليه عند الترقية التالية، لأنك لن تتذكره والترقية لن تتذكره.

| القيمة | الافتراضي | لماذا تغيّرها |
|---|---|---|
| `plant.name`, `plant.siteId` | `HotLoop`، فارغ | اسم المصنع على الشاشات وفي الصفحات وعند المواقع الأخرى. |
| `global.timezone` | `America/New_York` | تعمل الجداول والتقارير وتبديل الورديات وفقها. يجب أن يكون اسم منطقة حقيقيًا (`America/Chicago` وليس `CST`)، لأن منطقة زمنية لا تُحمَّل توقف التشغيل بدل أن يعمل بصمت على UTC. |
| `publicUrl` | فارغ | العنوان الذي يصل به هاتف على Wi-Fi المصنع إلى HotLoop. من دونه لا يكون للإشعارات رابط للعودة ولا يحصل ntfy على زر التأكيد. |
| `safety.allowWrites` | `false` | المفتاح الرئيسي. إذا كان معطلًا فلا شيء يكتب إلى آلة، من أي مكان. فعّله بعد مراجعة النشر. |
| `safety.allowMcpWrites` | `true` | يتيح للوكلاء الكتابة عبر البوابة نفسها، مفعّل منذ 4.19.4. يتبع المفتاح الرئيسي: مع تعطيل `safety.allowWrites` لا شيء يكتب، ولا حتى الوكلاء. اضبطه على `false` فيظل الوكلاء قادرين على قراءة المصنع كله ولا يكتبون أبدًا. تضبط المخططات دائمًا رمز MCP، فلا يكون `/mcp` مفتوحًا أبدًا. |
| `database.postgresql.persistence.size` | `20Gi` | هنا يعيش تاريخك. حدّد حجمه بحسب عدد الوسوم و`historian.retentionDays` (90). |
| `logbook.retentionDays` | `90` | أيام تغيّرات حالة الكيانات التي يحتفظ بها [سجل الأحداث](/ar/iot/logbook/). `0` يحتفظ بكل شيء حتى تمتلئ وحدة التخزين، وينبّهك Gateway إلى ذلك عند البدء. |
| `secretKey.existingSecret` | فارغ | Secret تديره أنت يحمل مفتاح كلمات مرور الأجهزة. اتركه فارغًا ينشئ المخطط واحدًا. اضبطه إذا كنت تعرض المخطط بالأمر `helm template`. |
| `database.type` | `timescaledb` | على أي قاعدة بيانات يعمل التطبيق: `timescaledb` أو `postgresql` أو `sqlite`. إعداد وليس صورة أخرى. |
| `plant.latitude`, `plant.longitude` | فارغ | أين يقع المصنع، بالدرجات العشرية، ليُحسب [موضع الشمس](/ar/iot/sun/) على الصندوق. كلاهما أو لا شيء. |
| `edgePublish.queueMaxBytes` | `67108864` | حد طابور الانقطاع عند النشر إلى الأعلى عبر Sparkplug، 64 MiB. وما بعده تُهمل أقدم القراءات وتُحصى. `0` يعني بلا حد، وانقطاع طويل بما يكفي يملأ حينها وحدة التخزين. |
| `database.postgresql.enabled` | `true` | اضبطه على `false` واملأ `database.external` لاستخدام PostgreSQL الخاص بك. مع إضافة TimescaleDB تحصل على hypertable، وبدونها على تقسيم أصلي. |
| `opcuaClient.persistence.enabled` | `false` | فعّله قبل أن تضيف جهاز OPC UA مؤمَّنًا. من دونه لا يجد العميل مكانًا تنجو فيه شهاداته من إعادة التشغيل، ويرفض الجهاز الاتصال بدل أن يجعلك تعيد الموافقة على الثقة في الطرفين بعد كل إعادة نشر. |
| `ingress` | معطّل | فقط إذا أردته متاحًا من خارج العنقود باسم. |

تُسلَّم الكتابة معطلة، وهذا هو المقصود. حتى مع تفعيل `safety.allowWrites` يبقى الوسم للقراءة فقط حتى تفعّله على حدة، وتُفحص كل قيمة مقابل نطاق الوسم وتُرفض ولا تُقص أبدًا. [بوابة الكتابة](/ar/gateway/write-gate/) فيها كل فحص بالترتيب.

## Podman Quadlet

لصندوق ليس ضمن عنقود. يحوّل Quadlet الحاويات إلى خدمات systemd حقيقية: تبدأ عند الإقلاع دون أن يسجّل أحد دخوله، وتُعاد عندما تتوقف، وتكتب في السجل. يتطلب **Podman 5.0 أو أحدث**. يأتي Raspberry Pi OS Bookworm بالإصدار 4.3 الذي لا يحوي Quadlet إطلاقًا، لذا يحتاج Pi إلى Trixie أو أحدث. ضع وحدة تخزين قاعدة البيانات على SSD عبر USB لا على بطاقة SD.

الوحدات في الدليل `gateway/` من مستودع HotLoop، تحت `deploy/quadlet/`. [Podman Quadlet](/ar/install/quadlet/) يشرح كل ملف.

```bash
sudo cp hotloop.network hotloop.container hotloop-db.container \
  hotloop-db.volume hotloop-data.volume /etc/containers/systemd/

openssl rand -hex 24 | sudo podman secret create hotloop-db-password -
sudo podman run --rm ghcr.io/hotloop-io/hotloop:stable gen-secret-key \
  | sudo podman secret create hotloop-secret-key -
printf '%s' 'a long admin password' \
  | sudo podman run --rm -i ghcr.io/hotloop-io/hotloop:stable hash-password \
  | sudo podman secret create hotloop-admin-password-hash -

sudo systemctl daemon-reload
sudo systemctl start hotloop.service
sudo systemctl status hotloop.service hotloop-db.service
curl -s localhost:8080/api/status
```

ثم افتح `http://<this box>:8080` وسجّل الدخول باسم `admin`. الأسرار الثلاثة هي كلمة مرور قاعدة البيانات، ومفتاح كلمات مرور الأجهزة (انسخه احتياطيًا في مكان غير هذا الصندوق، للسبب نفسه أعلاه)، وتجزئة bcrypt لكلمة مرور المسؤول، وليس كلمة المرور نفسها أبدًا. تحتفظ الوحدة بتاريخ 90 يومًا وتتبع `:stable`.

PostgreSQL العادي بدل TimescaleDB هو الوحدة نفسها مع إضافة `Environment=HOTLOOP_HISTORIAN_TIMESCALE=false` إلى `hotloop.container`. ملف SQLite هو الملفات الموجودة في `gateway/sqlite/` ولا شيء من الدليل الأعلى، لأنها تتشارك أسماء الوحدات: `hotloop.container` و`hotloop-data.volume`، وسرّان، `hotloop-secret-key` و`hotloop-admin-password-hash`.

فعّل مؤقّت Podman مرة واحدة لكل صندوق فيحدّث Gateway نفسه:

```bash
sudo systemctl enable --now podman-auto-update.timer
```

لا تتبع حاوية قاعدة البيانات `:stable`، وهذا مقصود، والتحديث الذي لا يستطيع البدء يُتراجع عنه. [التحديث التلقائي لـ :stable](/ar/install/auto-update/) يبيّن ما يفعله التحديث، وما لا يستطيع التراجع إلغاءه، وكيف توقف التحديثات حتى تقول. هذه هي الوحدات التي شُغّلت فعلًا: دون صلاحيات root تحت systemd، بما فيها تحديث ينقل البيانات ثم لا يستطيع البدء فيُتراجع عنه. وقد شُغّلت منذ ذلك على عتاد فعلي (2026-11-17).

## بعد ذلك

أضف جهازًا، واكتشف وسومه، وشاهدها تصل. [البروتوكولات](/ar/iot/protocols/) يبيّن إلى أي مدى اختُبر كل مشغّل، بما فيهما اللذان شُغّلا على عتاد فعلي في 2026-11-17، S7comm وEtherNet/IP. إذا شغّلته تحت EmberCORE فإن EmberCORE يجده بنفسه ويمرّره عبر العنوان داخل العنقود، دون ingress.

## الترخيص

يخضع HotLoop Gateway لاتفاقية HotLoop Source License Agreement 1.0. استخدامه مجاني ومصدره متاح، وليس مفتوح المصدر بحسب OSI. الاستخدام المنزلي والمخبري مجاني، وكذلك استخدام المدارس والمنظمات غير الربحية والجهات الحكومية لعملياتها الخاصة. راجع [صفحة الترخيص](/ar/license/) و[استخدام HotLoop في الأعمال](/ar/business/).
