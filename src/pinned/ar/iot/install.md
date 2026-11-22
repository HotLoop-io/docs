---
title: "تثبيت HotLoop IoT {{hotloop}}"
description: "ثبّت HotLoop IoT {{hotloop}} على k3s باستخدام Helm، أو على Pi أو حاسوب صغير كخدمات systemd باستخدام Podman Quadlet، مع PostgreSQL أو ملف SQLite."
sidebar:
  label: "التثبيت"
---

صدر HotLoop IoT أول مرة في 4.18.10. الصورة هي `ghcr.io/hotloop-io/hotloop-iot:{{hotloop}}` مبنية لمعماريات amd64 وarm64 وarm/v7، والمخطط هو `hotloop-iot` في مستودع Helm نفسه الذي يضم بقية التشكيلة. يُسحب كلاهما دون تسجيل دخول. لا يوجد مسار Docker أو Compose، وهذا مقصود، وأمر `podman run` المجرد الذي يُنفَّذ من صدفة تموت مع الجلسة ليس تثبيتًا.

هناك طريقتان. العنقود يستخدم Helm. جهاز Pi أو NUC أو حاسوب صناعي صغير بلا عنقود يستخدم Podman Quadlet. وفي الحالتين تختار قاعدة البيانات مرة واحدة: PostgreSQL 17 (الافتراضي) أو ملف SQLite بلا أي حاوية لقاعدة بيانات.

## Helm

```bash
helm repo add hotloop https://hotloop.io/hotloop
helm repo update
helm install hotloop hotloop/hotloop-iot --version {{hotloop}} \
  --namespace hotloop --create-namespace
```

سمِّ الإصدار `hotloop` أيًّا كان المنتج. اسم الإصدار هو الذي تُسمّى به وحدة تخزين قاعدة البيانات وSecrets وService، والاحتفاظ به هو ما يتيح للموقع أن ينتقل لاحقًا إلى منتج أكبر.

يؤدي هذا إلى نشر IoT مع PostgreSQL 17.11 بجانبه، على وحدة تخزين بسعة 10 Gi، مع الاحتفاظ بسجل 30 يومًا. ينشئ المخطط كلمة مرور قاعدة البيانات ورمز MCP وكلمة مرور المسؤول في Secret الإصدار، ويعيد استخدامها في كل ترقية، فلا يغيّر `helm upgrade` كلمة مرور من وراء ظهرك أبدًا.

لاستخدام ملف SQLite وبلا pod لقاعدة بيانات، اطلب ذلك عند التثبيت:

```bash
helm install hotloop hotloop/hotloop-iot --version {{hotloop}} \
  --namespace hotloop --create-namespace \
  --set database.type=sqlite
```

SQLite كاتب واحد على قرص محلي واحد، فهو نسخة واحدة، وتوضع وحدة التخزين على تخزين محلي ولا توضع أبدًا على NFS. الموقع الذي لديه سنوات من السجل بفاصل ثانية واحدة يحتاج إلى PostgreSQL. يقبل مخطط IoT القيمتين `postgresql` أو `sqlite` ولا شيء غيرهما: طلب `timescaledb` يُفشل التثبيت. الانتقال بينهما لاحقًا نسخ احتياطي واستعادة وليس تغيير قيمة، لأن القاعدة الجديدة تبدأ فارغة. [النسخ الاحتياطية](/ar/iot/backup/) فيها الاستعادة.

### انسخ المفتاح احتياطيًا

ينشئ المخطط أيضًا `<release>-secret-key` (وهو `hotloop-secret-key` مع الأوامر أعلاه). يحمل المفتاح الذي يشفّر كل كلمة مرور يحتفظ بها HotLoop لجهاز. المفتاح ليس أبدًا في قاعدة البيانات ولا في نسخة احتياطية، فهو جزء من بياناتك: النسخة الاحتياطية تستعيد بيانات الاعتماد فقط حيث يكون ذلك المفتاح مركّبًا. يحتفظ المخطط بالـ Secret بعد `helm uninstall`. احفظه في مكان غير مجاور لنسخك الاحتياطية، لأن مفتاحًا موضوعًا بجانب النسخ التي يحميها لا يحمي شيئًا. [تثبيت Gateway](/ar/gateway/install/#انسخ-المفتاح-احتياطيًا-قبل-أن-تحتاج-إليه) فيه القصة كاملة، وهو المفتاح نفسه.

### تسجيل الدخول

المستخدم هو `admin`. تطبع ملاحظات التثبيت الأمر الذي يقرأ كلمة المرور من جديد:

```bash
kubectl -n hotloop get secret hotloop \
  -o jsonpath='{.data.admin-password}' | base64 -d
kubectl -n hotloop port-forward svc/hotloop 8080:8080
```

افتح `http://localhost:8080`. حساب المسؤول هذا للتهيئة الأولى وليس مفتاح إعادة ضبط: بعد أن يوجد، لا يفعل تغيير `auth.admin.password` والترقية شيئًا، فلا تُمحى أبدًا كلمة مرور ضبطها أحدهم في الواجهة بالنشر التالي.

الآن أضف جهازًا، واكتشف وسومه، وحاول الكتابة إلى أحدها. لن تستطيع. تُسلَّم الكتابة معطلة: كل وسم للقراءة فقط إلى أن يفعّله أحد، ويبقى `safety.allowWrites` عند `false` إلى أن تقرر أن هذا النشر يحق له تحريك الآلات. [بوابة الكتابة](/ar/gateway/write-gate/) فيها كل فحص بالترتيب.

### ما تضبطه قبل أن يراه مصنع حقيقي

ضعها في ملف قيم وثبّت باستخدام `-f`.

| القيمة | الافتراضي | لماذا تغيّرها |
|---|---|---|
| `plant.name`, `plant.siteId` | `HotLoop`، فارغ | اسم المصنع على الشاشات وفي الصفحات وعند المواقع الأخرى. |
| `plant.latitude`, `plant.longitude` | فارغ | موقع المصنع بالدرجات العشرية. يُحسب منهما [الشمس](/ar/iot/sun/) على الصندوق. كلاهما أو لا شيء. |
| `global.timezone` | `America/New_York` | تعمل الجداول وتبديلات الورديات وفقه. يجب أن يكون اسم منطقة زمنية حقيقيًا، لأن اسمًا لا يُحمَّل يوقف البدء. |
| `publicUrl` | فارغ | العنوان الذي يصل به هاتف على Wi-Fi المصنع إلى HotLoop. من دونه لا يكون للإشعارات رابط للعودة ولا يحصل ntfy على زر التأكيد. |
| `safety.allowWrites` | `false` | المفتاح الرئيسي. وهو مغلق لا يُكتب شيء إلى آلة، من أي مكان. |
| `safety.allowMcpWrites` | `true` | يتيح للوكلاء الكتابة عبر البوابة نفسها، وهو مفعّل منذ 4.19.4. يتبع المفتاح الرئيسي: عند إغلاق `safety.allowWrites` لا يكتب شيء، ومنهم الوكلاء. اضبطه على `false` فيظل الوكلاء قادرين على قراءة المصنع كله ولا يكتبون أبدًا. |
| `historian.retentionDays` | `30` | عدد أيام السجل المحفوظة. يحتفظ Gateway وEdge بـ 90 يومًا لأن قرص Pi صغير. |
| `logbook.retentionDays` | `90` | أيام تغيّرات حالة الكيانات التي يحتفظ بها [السجل](/ar/iot/logbook/). |
| `database.postgresql.persistence.size` | `10Gi` | هنا يعيش سجلك. حدّد حجمه وفق عدد الوسوم ومدة الاحتفاظ أعلاه. |
| `secretKey.existingSecret` | فارغ | Secret تديره بنفسك يحتوي مفتاح كلمات مرور الأجهزة. اضبطه إذا كنت تولّد المخطط بـ `helm template`، الذي لا يستطيع توليد مفتاح ثابت. |
| `opcuaClient.persistence.enabled` | `false` | فعّله قبل إضافة جهاز OPC UA مؤمَّن، لتبقى شهادات العميل بعد إعادة التشغيل. |
| `ingress` | معطّل | فقط إذا أردته متاحًا من خارج العنقود باسم. |

## Podman Quadlet

لصندوق ليس في عنقود. يحوّل Quadlet الحاويات إلى خدمات systemd حقيقية: تبدأ عند الإقلاع دون أن يكون أحد مسجّلًا، وتعيد التشغيل عندما تموت، وتسجّل في السجل. يحتاج **Podman 5.0 أو أحدث**. يأتي Raspberry Pi OS Bookworm بالإصدار 4.3 الذي لا يحتوي Quadlet إطلاقًا، لذا يحتاج Pi إلى Trixie أو أحدث. ضع وحدة تخزين قاعدة البيانات على قرص USB SSD وليس على بطاقة SD، لأن السجل يكتب طوال اليوم والبطاقات SD تموت من ذلك بالضبط.

الوحدات في المجلد `iot/` من مستودع HotLoop، تحت `deploy/quadlet/`. [Podman Quadlet](/ar/install/quadlet/) يشرح ما هو كل ملف. والخلاصة لـ PostgreSQL:

```bash
sudo cp hotloop.network hotloop.container hotloop-db.container \
  hotloop-db.volume hotloop-data.volume /etc/containers/systemd/

openssl rand -hex 24 | sudo podman secret create hotloop-db-password -
sudo podman run --rm ghcr.io/hotloop-io/hotloop-iot:stable gen-secret-key \
  | sudo podman secret create hotloop-secret-key -
printf '%s' 'a long admin password' \
  | sudo podman run --rm -i ghcr.io/hotloop-io/hotloop-iot:stable hash-password \
  | sudo podman secret create hotloop-admin-password-hash -

sudo systemctl daemon-reload
sudo systemctl start hotloop.service
sudo systemctl status hotloop.service hotloop-db.service
curl -s localhost:8080/api/status
```

ثم افتح `http://<this box>:8080` وسجّل الدخول باسم `admin`. الأسرار الثلاثة هي كلمة مرور قاعدة البيانات، والمفتاح الذي يشفّر كلمات مرور الأجهزة (إن فقدته وجب إدخال كل واحدة من جديد، فاحتفظ بنسخة في مكان ليس هذا الصندوق)، وتجزئة bcrypt لكلمة مرور المسؤول، وليست كلمة المرور نفسها أبدًا.

لاستخدام ملف SQLite بدلًا من ذلك، استعمل الملفات في `iot/sqlite/` ولا شيء من المجلد الأعلى. لها أسماء الوحدات نفسها، فهي مجموعة أو أخرى ولا تُستخدمان معًا أبدًا. هما ملفان، `hotloop.container` و`hotloop-data.volume`، وسرّان، `hotloop-secret-key` و`hotloop-admin-password-hash`. قاعدة البيانات هي `/data/hotloop.db` على وحدة التخزين `hotloop-data`.

تتبع الوحدة `:stable`، ويحرّكها Podman عندما يعمل المؤقت:

```bash
sudo systemctl enable --now podman-auto-update.timer
```

تُرحِّل الصورة الجديدة قاعدة البيانات أثناء الإقلاع، وإن لم تستطع البدء يعيد Podman الصورة السابقة. لا تتبع حاوية قاعدة البيانات `:stable`، وهذا مقصود. [التحديث التلقائي لـ :stable](/ar/install/auto-update/) يشرح ما يفعله التحديث، وما لا يستطيع التراجع إلغاءه، وكيف توقف التحديثات حتى تأمر. خذ نسخة احتياطية قبل تفعيل التحديثات.

## الانتقال إلى منتج أكبر

من IoT إلى Edge إلى Gateway يبقى كل جهاز ووسم وكيان وأتمتة وإنذار ومستخدم وكل ساعة من السجل، و[تشكيلة المنتجات](/ar/products/) فيها الطريقة. جرى تنفيذ الانتقال على Quadlet وبصيغة `helm upgrade` على عنقود حقيقي. العودة إلى منتج أصغر ليست انتقالًا تجريه على صندوق يهمك، لذا خذ نسخة احتياطية أولًا.

## إلى أي مدى جُرِّب

شُغِّلت وحدات Quadlet الخاصة بـ IoT لكل من SQLite وPostgreSQL تحت systemd بلا صلاحيات root، من الملفات المودَعة، وشُغِّل Pi حقيقي تحت systemd بصلاحيات root وصور arm بنظام 32 بت على عتاد حقيقي، على جهاز فعلي بلا افتراضية (2026-11-17).

## الترخيص

HotLoop IoT تحت HotLoop Source License Agreement 1.0. هو مجاني ومتاح المصدر، وليس مفتوح المصدر وفق OSI. الاستخدام المنزلي والمخبري مجاني، وكذلك استخدام المدارس والمنظمات غير الربحية والجهات الحكومية لعملياتها الخاصة. راجع [صفحة الترخيص](/ar/license/) و[استخدام HotLoop في الأعمال](/ar/business/).
