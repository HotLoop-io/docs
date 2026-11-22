---
title: "Podman Quadlet على Pi"
description: "شغّل HotLoop كخدمات systemd حقيقية على Pi أو حاسوب صناعي صغير باستخدام Podman Quadlet، بلا Docker وبلا Compose وبلا عنقود."
---

لجهاز Pi أو حاسوب صناعي صغير **ليس** جزءًا من عنقود k3s. إن كان جزءًا منه، فاستخدم chart المنتج بدلًا من ذلك. هذا المجلد والـ charts هما الطريقتان المدعومتان لتشغيل HotLoop.

بلا Docker، وبلا `podman run` منفرد من shell يموت مع الجلسة. يحوّل Quadlet الحاويات إلى خدمات systemd حقيقية: تبدأ عند الإقلاع دون مستخدم مسجّل الدخول، وتعيد التشغيل عند الفشل، وتكتب سجلاتها في journald.

| المجلد | المنتج | الصورة |
|---|---|---|
| `iot/` | HotLoop IoT، مع PostgreSQL 17 | `ghcr.io/hotloop-io/hotloop-iot` |
| `edge/` | HotLoop Edge، مع TimescaleDB | `ghcr.io/hotloop-io/hotloop-edge` |
| `gateway/` | HotLoop Gateway، مع TimescaleDB | `ghcr.io/hotloop-io/hotloop` |
| هذا المجلد | HotLoop Edge Relay، بلا قاعدة بيانات | `ghcr.io/hotloop-io/hotloop-edge-relay` |

[صفحة المنتجات](/ar/products/) تبيّن لك أيها تحتاج.

لكل من الثلاثة الأولى مجلد `sqlite/` أيضًا: المنتج نفسه وقاعدة البيانات ملف، ودون حاوية لقاعدة البيانات. راجع [SQLite بدلًا من PostgreSQL](#sqlite-بدلًا-من-postgresql).

## IoT وEdge وGateway

لكل مجلد الوحدات نفسها وسكربت واحد:

- **`hotloop.network`**: الشبكة التي يتشاركها التطبيق وقاعدة بياناته. يصل التطبيق إلى قاعدة البيانات بالاسم (`hotloop-db:5432`) ولا شيء آخر على الجهاز يستطيع ذلك، لأن قاعدة البيانات لا تنشر أي منفذ. المنفذ 8080 للتطبيق وحده منشور.
- **`hotloop.container`**: التطبيق. يحتوي رأس الملف على خطوات التثبيت؛ اقرأه قبل نسخ أي شيء.
- **`hotloop-db.container`**: قاعدة البيانات، بالصورة والإصدار نفسيهما اللذين يشغّلهما chart ذلك المنتج. تُعلن أنها بدأت حين تستجيب، فينتظر التطبيق قاعدة بيانات يستطيع استخدامها.
- **`hotloop-db-upgrade.container`** و**`hotloop-db-upgrade.sh`**: انتقال قاعدة البيانات من PostgreSQL 16 إلى 17، مرة واحدة. يعمل قبل وحدة قاعدة البيانات وفقط حين يظل المجلد الحجمي يحوي بيانات 16؛ وعلى مجلد حجمي جديد، أو مجلد على 17 أصلًا، يتجاوزه systemd. راجع [PostgreSQL من 16 إلى 17](#postgresql-من-16-إلى-17).
- **`hotloop-db.volume`** و**`hotloop-data.volume`**: قاعدة البيانات، وكل ما يكتبه التطبيق تحت `/data` (النسخ الاحتياطية، والشهادات، وطابور الإعادة، والتقارير). مجلدات Podman حجمية مسمّاة، فلا يمسّها `podman system prune`.

ثلاثة أسرار Podman تحمل ما لا ينتمي إلى ملف: `hotloop-db-password`، و`hotloop-secret-key` (يشفّر كلمات مرور الأجهزة في قاعدة البيانات؛ احتفظ بنسخة خارج الجهاز)، و`hotloop-admin-password-hash` (تجزئة bcrypt لكلمة مرور المسؤول الأول، وليست كلمة المرور أبدًا).

**Podman 5.0 أو أحدث.** يأتي Raspberry Pi OS Bookworm مع Podman 4.3 الذي لا يحوي Quadlet إطلاقًا: استخدم Raspberry Pi OS Trixie (Podman 5.4) أو أحدث. جرى تشغيل التحديثات أدناه على Podman 6.1.3؛ ووحدة Edge Relay، التي تشترك في المفاتيح نفسها، على 4.9.3. وضع المجلد الحجمي لقاعدة البيانات على قرص SSD عبر USB، لا على بطاقة SD. يكتب السجل التاريخي طوال اليوم، وبطاقات SD تموت من ذلك تمامًا.

### لماذا تستخدم كل المنتجات الأسماء نفسها

أسماء الوحدات والمجلدات الحجمية والأسرار متطابقة في `iot/` و`edge/` و`gateway/`، عن قصد. الارتقاء بجهاز إلى منتج أكبر هو نسخ `hotloop.container` و`hotloop-db.container` من المنتج الأكبر فوق ملفاتك:

```sh
sudo cp gateway/hotloop.container gateway/hotloop-db.container \
  gateway/hotloop-db-upgrade.container gateway/hotloop-db-upgrade.sh /etc/containers/systemd/
sudo systemctl daemon-reload
sudo systemctl restart hotloop.service hotloop-db.service
```

تبقى المجلدات الحجمية والأسرار، ومعها كل جهاز ووسم وإنذار ومستخدم وكل ساعة من السجل التاريخي. ومع ذلك خذ نسخة احتياطية أولًا (`POST /api/backup`). هذه الخطوة جرى تنفيذها فعلًا، من IoT إلى Edge إلى Gateway على مجموعة المجلدات الحجمية نفسها. أما النزول إلى منتج أصغر فليس خطوة تُتّخذ على جهاز يهمك.

وهذا يعني أيضًا HotLoop واحدًا لكل جهاز. فاثنان سيتنازعان المنفذ 8080 على أي حال.

### تم التحقق

الملفات المسلّمة لـ IoT وEdge وGateway، دون مساس، تُولَّد بمولّد `quadlet` من Podman 6.1.3 بالبنية نفسها: يتطلب التطبيق قاعدة البيانات والشبكة، وينشر منفذه الخاص، ويحمل وسم التحديث التلقائي، بينما لا تحمل قاعدة البيانات أي وسم ولا تنشر شيئًا.

ثم شُغّلت وحدات Gateway فعلًا: دون صلاحيات root، تحت systemd، مع سجل محلي بدل ghcr.io وأمر `podman auto-update` الخاص بالمنتجات. تشغيل أول بقاعدة بيانات سليمة وتطبيق سليم بعدها؛ وتحديث إلى إصدار يضيف ترحيلًا إلى جدول يستخدمه التطبيق أصلًا، تم بوجود الجهاز القائم وبياناته سليمة ودون إعادة تشغيل حاوية قاعدة البيانات أبدًا؛ وتحديث إلى إصدار يرحّل قاعدة البيانات ثم لا يستطيع البدء، تراجع عنه Podman، فبدأ الإصدار السابق سليمًا على قاعدة البيانات التي كان الإصدار الفاشل قد رحّلها. يعمل Edge وIoT على الوحدات نفسها، وقد شُغّلا تحت systemd على جهاز Pi حقيقي، على عتاد فعلي (2026-11-17).

## PostgreSQL من 16 إلى 17

قاعدة بيانات HotLoop هي PostgreSQL 17 منذ هذا الإصدار. الجهاز الذي شغّل إصدارًا سابقًا لديه بيانات PostgreSQL 16، ولن يفتحها PostgreSQL 17، لذا فالانتقال وحدة تعمل قبل قاعدة البيانات. ضع الملفات الجديدة في مكانها وأعد تشغيل قاعدة البيانات، وهذا كل شيء:

```sh
sudo cp hotloop-db.container hotloop-db-upgrade.container hotloop-db-upgrade.sh \
  /etc/containers/systemd/
sudo systemctl daemon-reload
sudo systemctl restart hotloop-db.service
journalctl -u hotloop-db-upgrade.service      # what it did
```

يتطلب `hotloop-db.container` وحدة الترقية، فالجهاز الذي نُسخت إليه وحدة قاعدة البيانات الجديدة وحدها لا يبدأ على بيانات 16، ويذكر journal السبب. تشغّل وحدة الترقية `pg_upgrade` بوضع النسخ إلى مجلد جديد بجانب القديم، وتشغّل الخادم الجديد مرة واحدة لتثبت أنه يفتح، وعندها فقط تبدّل الأسماء؛ وتبقى البيانات القديمة على المجلد الحجمي باسم `pgdata.pg16`. وهي تسحب صورة PostgreSQL 16 فقط حين يحتاجها المجلد الحجمي. ويترك الفشل بيانات 16 كما كانت وقاعدة البيانات غير مشغّلة. الوصف الكامل وطريق العودة وطريقة حذف `pgdata.pg16` في [k3s وHelm](/ar/install/helm/#postgresql-17). في التثبيت دون root يكون مسار السكربت في الوحدة `~/.config/containers/systemd`، من `%E`.

## SQLite بدلًا من PostgreSQL

قاعدة البيانات إعداد، لا صورة (صفحة k3s وHelm، "SQLite"). في Quadlet يعني ذلك مجموعة ملفات ثانية، لا صورة ثانية. لمجلد `sqlite/` في كل منتج ملفان:

- **`sqlite/hotloop.container`**: التطبيق وحده. بلا `Requires=` على قاعدة بيانات، وبلا شبكة، وبلا كلمة مرور لقاعدة البيانات، مع `HOTLOOP_DB_TYPE=sqlite` والملف في `HOTLOOP_DB_PATH=/data/hotloop.db`. يتبع `:stable` ويتراجع عن التحديث السيئ تمامًا مثل وحدة PostgreSQL: فحص الصحة نفسه، و`--sdnotify=healthy` نفسه.
- **`sqlite/hotloop-data.volume`**: المجلد الحجمي `hotloop-data`، حيث يقيم ملف قاعدة البيانات و`-wal` و`-shm` الخاصان به. هو اسم المجلد الحجمي نفسه في ملفات PostgreSQL، فهو مجلد البيانات نفسه إن بدّلت يومًا.

| المجلد | التثبيت | الأسرار |
|---|---|---|
| `iot/` و`edge/` و`gateway/` | `hotloop.network` و`hotloop.container` و`hotloop-db.container` و`hotloop-db.volume` و`hotloop-data.volume` | ثلاثة |
| `iot/sqlite/` و`edge/sqlite/` و`gateway/sqlite/` | `hotloop.container` و`hotloop-data.volume` | اثنان: `hotloop-secret-key` و`hotloop-admin-password-hash` |

ثبّت مجموعة أو الأخرى، لا الاثنتين معًا: فهما تستخدمان أسماء الوحدات نفسها. رأس `sqlite/hotloop.container` فيه الخطوات الدقيقة. باختصار:

```sh
cd iot/sqlite        # or edge/sqlite, gateway/sqlite
sudo cp hotloop.container hotloop-data.volume /etc/containers/systemd/
# make hotloop-secret-key and hotloop-admin-password-hash as the header says
sudo systemctl daemon-reload
sudo systemctl start hotloop.service
curl -s localhost:8080/api/status
```

بضعة أمور تعرفها قبل أن تختاره. SQLite كاتب واحد على قرص محلي واحد: يضع Pi المجلد الحجمي على SSD عبر USB، وتخزين الشبكة ليس خيارًا لأن SQLite يتلف عليه. السجل التاريخي جدول واحد بفهرس واحد، لا أقسام ولا hypertable، فالموقع الذي له سنوات من السجل كل ثانية يحتاج ملفات PostgreSQL. ونقل الجهاز بين SQLite وPostgreSQL نسخ احتياطي واستعادة ([النسخ الاحتياطي والاستعادة](/ar/iot/backup/))، لا تبديل وحدات: تبدأ قاعدة البيانات الجديدة فارغة. لا تنسخ `sqlite/hotloop.container` فوق تثبيت PostgreSQL قيد التشغيل بغرض "التبديل"؛ فهو لا يقرأ بيانات المجلد الحجمي لـ PostgreSQL.

PostgreSQL العادي على Edge أو Gateway هو وحدة TimescaleDB مع إضافة `Environment=HOTLOOP_HISTORIAN_TIMESCALE=false` إلى `hotloop.container`. وحدة IoT هي PostgreSQL العادي أصلًا، ولا توجد لـ IoT وحدة TimescaleDB إطلاقًا.

### تم التحقق (SQLite)

شُغّل `iot/sqlite/hotloop.container` ومجلده الحجمي دون root على Podman 4.9.3 تحت systemd (`systemctl --user`) من الملفات المودعة، مع تغيير الأسماء والمنفذ والصورة (المبنية من الشجرة نفسها) ودليل التشغيل الذي يحتاجه مدير المستخدم فقط. بدأت الوحدة سليمة، وردّ `/healthz` و`/readyz` بالرمز 200، وسجّل المسؤول دخوله من سر التجزئة، وردّ `/api/status`، وظهرت `hotloop.db` و`hotloop.db-wal` و`hotloop.db-shm` على المجلد الحجمي، ولم تطبّق إعادة التشغيل أي ترحيل وسجّلت دخول المسؤول من جديد. وحدتا `sqlite/` في Edge وGateway هما الملف نفسه عدا الصورة والقيمة الافتراضية للاحتفاظ، وقد شُغّلتا تحت systemd بصلاحيات root على جهاز Pi حقيقي، على عتاد فعلي (2026-11-17).

## Edge Relay

- **`edge-relay-hold.conf`**: اختياري: يحجز تحديثات الصورة حتى يوافق عليها مشغّل. إضافة drop-in لـ systemd، وليست جزءًا من تثبيت افتراضي.
- **`edge-relay.container`**، الخدمة نفسها. خطوات التثبيت الكاملة في تعليق رأسها؛ اقرأه قبل نسخ أي شيء.
- **`edge-relay-data.volume`**، مجلد Podman حجمي مسمّى لطابور الإعادة، حتى تبقى القراءات المخزّنة مؤقتًا بعد إعادة تشغيل الحاوية. ينشئه Podman تلقائيًا أول مرة تبدأ فيها الخدمة.
- **`devices.example.json`**، نقطة انطلاق لملف الأجهزة. انسخه إلى `/etc/edge-relay/devices.json` وعدّله ليناسب الأجهزة الفعلية في هذا الموقع؛ والصيغة الكاملة في [مرجع Edge Relay](/ar/edge-relay/reference/).

### بداية سريعة

```sh
sudo mkdir -p /etc/containers/systemd /etc/edge-relay
sudo cp edge-relay.container edge-relay-data.volume /etc/containers/systemd/
sudo cp devices.example.json /etc/edge-relay/devices.json   # then edit it
sudo "$EDITOR" /etc/containers/systemd/edge-relay.container  # broker, group, node

# Skip this if the broker takes anonymous connections.
printf '%s' 'your-broker-password' | sudo podman secret create edge-relay-broker-password -

sudo systemctl daemon-reload
sudo systemctl start edge-relay.service
sudo systemctl status edge-relay.service
curl localhost:8081/status
```

**التحديثات.** تتبع الوحدة `:stable` وتحدّث نفسها بمجرد تشغيل مؤقّت Podman:

```sh
sudo systemctl enable --now podman-auto-update.timer
```

إن لم تجتز صورة جديدة فحص صحتها، يعيد Podman الصورة القديمة. تعرض قائمة الأسطول في Gateway إصدار كل مرحّل وملخّص صورته وتسجّل كل تغيير. ولحجز التحديثات حتى يوافق عليها مسؤول في Gateway، ثبّت `edge-relay-hold.conf` كما يقول التعليق في أعلى ذلك الملف، وأوقف المؤقّت. كل ما يفعله هذا، وما لا يستطيعه، في [مرجع Edge Relay](/ar/edge-relay/reference/#updating-a-relay).

لتطبيق تغيير على الملف المحلي: عدّله، ثم نفّذ `sudo systemctl restart edge-relay.service`. يقرأ المرحّل ذلك الملف عند الإقلاع ولا يراقبه.

ملف الأجهزة الذي يدفعه Gateway لا يحتاج إلى شيء من هذا: يُطبَّق مباشرة دون إعادة تشغيل. لا يمكن كتابته إلى `/etc/edge-relay/devices.json` (فهو مركّب `:ro` على جذر للقراءة فقط)، لذا يوضع على مجلد البيانات الحجمي باسم `/data/pushed-devices.json`، وما دام موجودًا فهو ما يشغّله المرحّل ويقلع منه. تبقى تعديلاتك على الملف المحلي دون استخدام حتى تمسح ما دُفع: `DELETE /api/fleet/{id}/config` على Gateway أثناء تشغيل المرحّل، فيعود إلى الملف المحلي فورًا. يذكر journal أي ملف يعمل عليه، فتحقق هناك قبل أن تشكّ في JSON الخاص بك.

تم التحقق مقابل ملف `quadlet` الثنائي الحقيقي (`/usr/libexec/podman/quadlet -dryrun` من `podman-5.8.6`): تُحلَّل الوحدتان دون أخطاء وتولّدان استدعاء `podman run` المتوقع، مع ربط تبعية المجلد الحجمي والسر تلقائيًا.
