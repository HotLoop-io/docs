---
title: "تثبيت HotLoop Edge {{hotloop}}"
description: "ثبّت HotLoop Edge {{hotloop}} على k3s باستخدام Helm أو على حاسوب صناعي باستخدام Podman Quadlet، ثم فعّل خادم OPC UA ونشر Sparkplug."
sidebar:
  label: "التثبيت"
---

صدر HotLoop Edge أول مرة في 4.18.10. الصورة هي `ghcr.io/hotloop-io/hotloop-edge:{{hotloop}}` مبنية لمعماريات amd64 وarm64 وarm/v7، والمخطط هو `hotloop-edge` في مستودع Helm نفسه الذي يضم بقية التشكيلة. يُسحب كلاهما دون تسجيل دخول. لا يوجد مسار Docker أو Compose، وهذا مقصود، وأمر `podman run` المجرد الذي يُنفَّذ من صدفة تموت مع الجلسة ليس تثبيتًا.

العنقود يستخدم Helm. الحاسوب الصناعي أو Pi بلا عنقود يستخدم Podman Quadlet. قاعدة البيانات خيار تتخذه مرة واحدة: TimescaleDB (الافتراضي) أو PostgreSQL العادي أو ملف SQLite بلا أي حاوية لقاعدة بيانات.

## Helm

```bash
helm repo add hotloop https://hotloop.io/hotloop
helm repo update
helm install hotloop hotloop/hotloop-edge --version {{hotloop}} \
  --namespace hotloop --create-namespace
```

سمِّ الإصدار `hotloop` أيًّا كان المنتج. اسم الإصدار هو الذي تُسمّى به وحدة تخزين قاعدة البيانات وSecrets وService، والاحتفاظ به هو ما يتيح للموقع أن ينتقل لاحقًا إلى منتج أكبر.

يؤدي هذا إلى نشر Edge مع TimescaleDB 2.30.1 على PostgreSQL 17 بجانبه، على وحدة تخزين بسعة 20 Gi، مع الاحتفاظ بسجل 90 يومًا. ينشئ المخطط كلمة مرور قاعدة البيانات ورمز MCP وكلمة مرور المسؤول في Secret الإصدار، ويعيد استخدامها في كل ترقية. وينشئ أيضًا `<release>-secret-key`، وهو المفتاح الذي يشفّر كل كلمة مرور جهاز يحتفظ بها HotLoop. هذا المفتاح جزء من بياناتك، و[صفحة تثبيت Gateway](/ar/gateway/install/#انسخ-المفتاح-احتياطيًا-قبل-أن-تحتاج-إليه) تشرح السبب وطريقة نسخه احتياطيًا. إنه المفتاح نفسه.

لاستخدام PostgreSQL العادي أو ملف SQLite، اضبط `database.type` على `postgresql` أو `sqlite` عند التثبيت. ملف SQLite كاتب واحد على قرص محلي واحد، فهو نسخة واحدة ولا يوضع أبدًا على NFS. التبديل بين قواعد البيانات لاحقًا نسخ احتياطي واستعادة، لأن القاعدة الجديدة تبدأ فارغة. [النسخ الاحتياطية](/ar/iot/backup/) فيها الاستعادة.

### تسجيل الدخول

المستخدم هو `admin`. تطبع ملاحظات التثبيت الأمر الذي يقرأ كلمة المرور من جديد:

```bash
kubectl -n hotloop get secret hotloop \
  -o jsonpath='{.data.admin-password}' | base64 -d
kubectl -n hotloop port-forward svc/hotloop 8080:8080
```

افتح `http://localhost:8080`. تُسلَّم الكتابة معطلة: كل وسم للقراءة فقط إلى أن يفعّله أحد، ويبقى `safety.allowWrites` عند `false` إلى أن تقرر أن هذا الصندوق يحق له تحريك الآلات. [بوابة الكتابة](/ar/gateway/write-gate/) فيها كل فحص بالترتيب.

### ما يضيفه Edge وكيف تشغّله

كلاهما معطل افتراضيًا، لأن فتح منفذ استماع أو ارتباط صاعد في شبكة مصنع أمر يفعله النشر عن قصد.

**خادم OPC UA** هو `opcuaServer.enabled: true`، على المنفذ 4840. اضبط `opcuaServer.endpointHost` على الاسم الذي يصل به العميل إلى الصندوق، ليطابق الشهادة. [خادم OPC UA](/ar/edge/opc-ua-server/) فيه نموذج الأمان، وهو للقراءة فقط.

**صحة الصندوق وتركيب المضيف.** يقدّم خادم OPC UA في المخطط أيضًا صحة هذا الصندوق نفسه (المعالج والذاكرة والقرص، والاهتزاز في الزمن الحقيقي عندما يكتب وكيل الملف) للوحة معلومات EmberNet، وينشئ تسجيل دخول للوحة يقرأ الوسوم والقيم ولا شيء غير ذلك. وهو مفعّل افتراضيًا: يركّب المخطط جذر المضيف على `/host` و`/proc` الخاص به على `/host/proc`، وكلاهما للقراءة فقط، ولا يضيف أي امتياز. العنقود الذي يفرض ملف Pod Security المقيَّد يرفض hostPath، وهناك تضبط `opcuaServer.dashboard.boxHealth.enabled: false` بلا جهاز ولا تركيبات، أو `opcuaServer.dashboard.boxHealth.hostMount: false` للإبقاء على الجهاز مع وسم قراءتي القرص والمعالج بأنهما سيئتان وبيان ما يجب تركيبه. [خادم OPC UA](/ar/edge/opc-ua-server/#صحة-الجهاز-للوحة-تحكم-embernet) فيه الباقي.

**نشر Sparkplug** هو `edgePublish.enabled: true`، مع `edgePublish.broker` و`edgePublish.group` إلزاميين. اضبط `edgePublish.node` أيضًا، وإلا فمعرّف العقدة هو اسم الإصدار. يعيش طابور الإرسال على وحدة تخزين بسعة 1 Gi، وقيمة `edgePublish.queueMaxBytes` الافتراضية 64 MiB (نحو 248,000 قراءة بنحو 240 بايت للقراءة: نحو دقيقتين عند 2,000 قراءة في الثانية)، وبعدها تُحذف أقدم القراءات وتُحسب. `0` يعني بلا حد، وانقطاع طويل بما يكفي يملأ عندها وحدة التخزين. يتطلب نشر Edge أن يكون `replicaCount` يساوي 1، وإلا يرفض المخطط التوليد. [نشر Edge والتخزين والإرسال](/ar/edge/edge-publish/) يشرح ما يفعله عندما يموت الارتباط الصاعد.

### ما تضبطه قبل أن يراه مصنع حقيقي

| القيمة | الافتراضي | لماذا تغيّرها |
|---|---|---|
| `plant.name`, `plant.siteId` | `HotLoop`، فارغ | اسم المصنع على الشاشات وفي الصفحات وعند المواقع الأخرى. |
| `global.timezone` | `America/New_York` | تعمل الجداول وتبديلات الورديات وفقه. يجب أن يكون اسم منطقة زمنية حقيقيًا. |
| `publicUrl` | فارغ | العنوان الذي يصل به هاتف على Wi-Fi المصنع إلى HotLoop. من دونه لا يكون للإشعارات رابط للعودة. |
| `safety.allowWrites` | `false` | المفتاح الرئيسي. وهو مغلق لا يُكتب شيء إلى آلة، من أي مكان. |
| `historian.retentionDays` | `90` | عدد أيام السجل المحفوظة. |
| `database.postgresql.persistence.size` | `20Gi` | هنا يعيش سجلك. حدّد حجمه وفق عدد الوسوم ومدة الاحتفاظ أعلاه. |
| `opcuaClient.persistence.enabled` | `false` | فعّله قبل إضافة جهاز OPC UA مؤمَّن، لتبقى شهادات العميل بعد إعادة التشغيل. |
| `secretKey.existingSecret` | فارغ | Secret تديره بنفسك يحتوي مفتاح كلمات مرور الأجهزة. اضبطه إذا كنت تولّد المخطط بـ `helm template`. |

## Podman Quadlet

يحوّل Quadlet الحاويات إلى خدمات systemd حقيقية: تبدأ عند الإقلاع دون أن يكون أحد مسجّلًا، وتعيد التشغيل عندما تموت، وتسجّل في السجل. يحتاج **Podman 5.0 أو أحدث**. يأتي Raspberry Pi OS Bookworm بالإصدار 4.3 الذي لا يحتوي Quadlet إطلاقًا، لذا يحتاج Pi إلى Trixie أو أحدث. ضع وحدة تخزين قاعدة البيانات على قرص USB SSD وليس على بطاقة SD.

الوحدات في المجلد `edge/` من مستودع HotLoop، تحت `deploy/quadlet/`، ولها الأسماء نفسها كوحدات IoT وGateway. [Podman Quadlet](/ar/install/quadlet/) يشرح كل ملف.

```bash
sudo cp hotloop.network hotloop.container hotloop-db.container \
  hotloop-db.volume hotloop-data.volume /etc/containers/systemd/

openssl rand -hex 24 | sudo podman secret create hotloop-db-password -
sudo podman run --rm ghcr.io/hotloop-io/hotloop-edge:stable gen-secret-key \
  | sudo podman secret create hotloop-secret-key -
printf '%s' 'a long admin password' \
  | sudo podman run --rm -i ghcr.io/hotloop-io/hotloop-edge:stable hash-password \
  | sudo podman secret create hotloop-admin-password-hash -

sudo systemctl daemon-reload
sudo systemctl start hotloop.service
sudo systemctl status hotloop.service hotloop-db.service
curl -s localhost:8080/api/status
```

ثم افتح `http://<this box>:8080` وسجّل الدخول باسم `admin`. احتفظ بنسخة من المفتاح في مكان ليس هذا الصندوق، لأن فقدانه يعني إدخال كل كلمة مرور جهاز من جديد.

تنشر الوحدة المنفذ 8080 فقط. عندما تشغّل خادم OPC UA (4840) أو وسيط MQTT المضمّن (1883)، أضف سطر `PublishPort=` له في `hotloop.container`. تحتفظ وحدة Quadlet بسجل 90 يومًا افتراضيًا، مثل المخطط.

تريد PostgreSQL العادي على Edge؟ إنها وحدة TimescaleDB مع إضافة `Environment=HOTLOOP_HISTORIAN_TIMESCALE=false` إلى `hotloop.container`. تريد ملف SQLite؟ استخدم الملفات في `edge/sqlite/` ولا شيء من المجلد الأعلى، لأنها تتشارك أسماء الوحدات: هي `hotloop.container` و`hotloop-data.volume`، وسرّان هما `hotloop-secret-key` و`hotloop-admin-password-hash`.

تتبع الوحدة `:stable`، ويحرّكها Podman عندما يعمل المؤقت:

```bash
sudo systemctl enable --now podman-auto-update.timer
```

تُرحِّل الصورة الجديدة قاعدة البيانات أثناء الإقلاع، وإن لم تستطع البدء يعيد Podman الصورة السابقة. لا تتبع حاوية قاعدة البيانات `:stable`، وهذا مقصود. [التحديث التلقائي لـ :stable](/ar/install/auto-update/) يشرح ما يفعله التحديث، وما لا يستطيع التراجع إلغاءه، وكيف توقف التحديثات حتى تأمر. خذ نسخة احتياطية قبل تفعيل التحديثات.

## الانتقال إلى منتج أكبر

من IoT إلى Edge إلى Gateway يبقى كل جهاز ووسم وكيان وأتمتة وإنذار ومستخدم وكل ساعة من السجل. على Quadlet يعني ذلك نسخ `hotloop.container` و`hotloop-db.container` من المنتج الأكبر فوق ملفاتك، و[تشكيلة المنتجات](/ar/products/) فيها صيغة Helm. جرى تنفيذ الانتقال على Quadlet، من IoT إلى Edge إلى Gateway على وحدة تخزين واحدة لقاعدة البيانات، وبصيغة `helm upgrade` على عنقود حقيقي. العودة إلى منتج أصغر ليست انتقالًا تجريه على صندوق يهمك، لذا خذ نسخة احتياطية أولًا.

## إلى أي مدى جُرِّب

شُغِّلت وحدات Quadlet الخاصة بـ Edge تحت systemd بلا صلاحيات root، بما في ذلك تحديث يُرحِّل ولا يستطيع البدء ويُعاد إلى ما قبله. وشُغِّل Pi حقيقي تحت systemd بصلاحيات root وصور arm بنظام 32 بت على عتاد حقيقي، على جهاز فعلي بلا افتراضية (2026-11-17).

## الترخيص

HotLoop Edge تحت HotLoop Source License Agreement 1.0. هو مجاني ومتاح المصدر، وليس مفتوح المصدر وفق OSI. الاستخدام المنزلي والمخبري مجاني، وكذلك استخدام المدارس والمنظمات غير الربحية والجهات الحكومية لعملياتها الخاصة. راجع [صفحة الترخيص](/ar/license/) و[استخدام HotLoop في الأعمال](/ar/business/).
