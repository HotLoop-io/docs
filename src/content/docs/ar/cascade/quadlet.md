---
title: "Cascade مع Podman Quadlet"
description: "شغّل Cascade كخدمات systemd عبر Podman Quadlet، على SQLite أو مع Postgres وworker منفصل، مع نافذة تحديث تتحكم بها أنت."
---

هناك طريقتان للتشغيل. تتطلب كلتاهما Podman 5.0 أو أحدث وتثبيتًا بصلاحية root، فتبدآن عند الإقلاع دون أن يسجّل أحد الدخول. وتتبع كلتاهما `ghcr.io/hotloop-io/hotloop-cascade:stable`، وتشغّلانه للقراءة فقط وبلا صلاحيات root مع إسقاط كل الإمكانات (capabilities)، وتتركان systemd يعيد تشغيله. التحديثات وكيفية التراجع عنها في النهاية.

## جهاز واحد، SQLite

`hotloop-cascade.container` و`hotloop-cascade-data.volume`. قاعدة البيانات ملف داخل المجلد (volume)، بجوار المفتاح الذي يشفّر بيانات الاعتماد المخزَّنة.

```sh
sudo cp hotloop-cascade.container hotloop-cascade-data.volume /etc/containers/systemd/
sudo install -D -m 600 /dev/null /etc/hotloop-cascade/cascade.env
sudo systemctl daemon-reload
sudo systemctl start hotloop-cascade
```

افتح `http://this-box:8080`. أول شخص يفتحه ينشئ الحساب الأول، فافعل ذلك قبل أن تشارك العنوان.

## PostgreSQL وخادم وworkers

`postgres/`. قاعدة البيانات والخادم، وعند الرغبة مزيد من الـ workers. Postgres هو الطابور، فتأخذ الـ workers عملها من المكان نفسه. تقع قاعدة البيانات على شبكة خاصة بها ولا تنشر أي منفذ.

أولًا ثلاثة أسرار تُنشأ مرة واحدة. الأوامر في أعلى `postgres/hotloop-cascade.container`. المفتاح هو الأهم: إن فقدته أصبحت كل بيانات الاعتماد المخزَّنة غير مقروءة. احتفظ بنسخة في مكان آخر غير هذا الجهاز.

```sh
cd postgres
sudo cp hotloop-cascade.network hotloop-cascade-db.container hotloop-cascade-db.volume \
  hotloop-cascade-data.volume hotloop-cascade.container /etc/containers/systemd/
sudo install -D -m 600 /dev/null /etc/hotloop-cascade/cascade.env
sudo systemctl daemon-reload
sudo systemctl start hotloop-cascade
```

مزيد من الـ workers: `hotloop-cascade-worker.container`. تتشارك الـ workers مجلد البيانات، لذلك يجب أن تكون على الجهاز نفسه. وإذا تجاوزت جهازًا واحدًا فاستخدم مخطط Helm.

## الإعدادات

`/etc/hotloop-cascade/cascade.env`، بمعدل `NAME=value` واحد في كل سطر، ويجب أن يكون الملف موجودًا حتى لو كان فارغًا (سطر `install` ينشئه). أكثر ما ستحتاج إليه:

| الإعداد | وظيفته |
|---|---|
| `HOTLOOP_CASCADE_PUBLIC_URL` | العنوان الذي يصل الناس به إلى Cascade. تُبنى منه روابط webhook وروابط الاستدعاء الراجع في OAuth. وقبل أن تضبطه يكون `http://localhost:8080`، وهو لا يعمل إلا من الجهاز نفسه. |
| `HOTLOOP_CASCADE_METRICS_TOKEN` | يشترط `Authorization: Bearer` على `/metrics`. |
| `HOTLOOP_CASCADE_FILES_DIR` | يفعّل خطوات الملفات في هذا الدليل. اربطه (mount) بالحاوية أيضًا. |

تضبط الوحدات دليل البيانات والمنافذ والمفتاح فقط، وتتغلب القيمة المضبوطة في وحدة على قيمة ملف env، فلا تلمس هذه. بعد أي تغيير: `sudo systemctl restart hotloop-cascade`.

## الفحص

```sh
sudo podman healthcheck run hotloop-cascade
curl -s http://127.0.0.1:8081/readyz
sudo podman exec hotloop-cascade /usr/local/bin/hotloop-cascade workflows import - < workflow.yaml
```

الصحة والمقاييس على المنفذ 8081، المنشور على loopback فقط. وإذا كان شيء آخر يستخدم 8080 أو 8081 فغيّر الجانب الأيسر من أسطر `PublishPort=`.

## الترقية

تتبع وحدات التطبيق `:stable` وتحمل `AutoUpdate=registry`. فعّل مؤقت Podman مرة واحدة لكل جهاز:

```sh
sudo systemctl enable --now podman-auto-update.timer
```

عندما يعمل، ينزّل Podman الوسم `:stable`، وإذا تغيّر الـ digest أعاد تشغيل الوحدة على الصورة الجديدة. لا تُحسب الوحدة بدأت حتى تجتاز الحاوية فحص الصحة (`Notify=healthy`؛ الفحص هو الملف التنفيذي نفسه وهو يسأل `/readyz` الخاص به، بصيغة مصفوفة JSON لأن الصورة بلا shell). وإذا لم تصل الصورة الجديدة إلى ذلك أبدًا، يعيد Podman الصورة السابقة تحت `:stable` ويشغّلها. الانتظار يصل إلى 15 دقيقة، لأن الصورة الجديدة تُرحّل قاعدة البيانات أثناء صعودها.

لإبقاء التحديثات معلّقة حتى تأذن، اترك المؤقت متوقفًا وشغّل `sudo podman auto-update` عندما تكون جاهزًا. ولتحدث داخل نافذة زمنية فقط، ثبّت `update-window.conf` (يشرح رأس الملف كيف).

هناك أمران لا يستطيع التراجع إلغاءهما. الترحيلات تمضي إلى الأمام فقط، لذلك خذ نسخة احتياطية قبل تفعيل التحديثات. وأي إصدار يغيّر جدولًا بطريقة لا تستطيع النسخة القديمة قراءتها يذكر ذلك في ملاحظات إصداره. والثاني قاعدة البيانات: صورتها مثبّتة على وسم محدد وبلا وسم تحديث، عن قصد. الخادم الجديد الذي لا يبدأ يُلغى بإعادة الصورة القديمة، أما صورة قاعدة بيانات جديدة فقد تبدأ وتغيّر دليل البيانات ثم يتبيّن بعد ذلك أنها خطأ. داخل PostgreSQL 18 يكون ذلك بتعديل الوسم، بعد قراءة ملاحظات الإصدار وأخذ نسخة احتياطية.

في نمط PostgreSQL يكون الخادم وكل worker وحدات منفصلة، فالتحديث الذي لا يبدأ يتراجع عن تلك الوحدة وحدها وليس عن التي بجانبها.

## ما جرى اختباره

شُغّلت الوحدات فعلًا على Podman 6.1.3 بلا root تحت systemd، مع سجل محلي بدل ghcr.io والوحدات المرفقة دون تعديل عدا منافذ المضيف. في النمط المستقل ونمط PostgreSQL معًا: أول تشغيل ينتظر حاوية سليمة؛ وتحديث إلى digest جديد عاد سليمًا والبيانات سليمة، وفي نمط PostgreSQL دون المساس بحاوية قاعدة البيانات؛ وتحديث إلى صورة تنتهي عند البدء، أبلغ عنه `podman auto-update` بأنه `rolled back`، وعاد الـ digest السابق سليمًا وبقي سير العمل السابق يعمل. وكتثبيت root على Podman 4.9.3 بدأت الإصدارات السابقة من الوحدات وأعادت التشغيل تحت systemd؛ ولا يدعم Quadlet 4.9 الخيار `Notify=healthy`، ولهذا تحمل الوحدات أيضًا `--sdnotify=healthy`.

ثم جرى النمطان مرة أخرى كتثبيت root، وهي الطريقة التي تنص عليها الوحدات، على Podman 5.8.7 تحت systemd داخل حاوية ذات امتيازات تُرمى بعد الاستعمال، مع السجل المحلي نفسه بدل ghcr.io كمرآة والوحدات دون تعديل. المستقل: انتظر البدء حاوية سليمة، وعادت حاوية أُنهيت قسرًا سليمة، وصعد تحديث إلى صورة جيدة سليمًا على الـ digest الجديد، وأُبلغ عن تحديث إلى صورة تنتهي عند البدء بأنه `rolled back` مع عودة الجيدة إلى العمل، وجرى سير عمل بعد كل خطوة. PostgreSQL، مع الخادم وworker إضافي: انتظر `systemctl start` على الخادم قاعدة البيانات ثم الخادم حتى صارا سليمين، وعاد خادم أُنهي قسرًا، ونقل تحديث إلى صورة جيدة الخادم والـ worker وترك حاوية قاعدة البيانات وشأنها، وعاد تحديث إلى صورة تنتهي عند البدء بـ `rolled back` مع عودة الاثنين إلى الصورة الجيدة وقاعدة البيانات دون مساس، وجرى سير عمل قبل ذلك وبينه وبعده. شيء يجب معرفته عند قراءة ذلك الناتج: يتشارك الخادم والـ worker صورة واحدة، وعندما تراجع الأول ظهر `true` عند الآخر بدلًا من ذلك، مع إعادة تشغيل، وانتهى على الصورة الجيدة على أي حال. أيهما يتراجع أولًا كان يتغير من تشغيل إلى آخر.

شُغّل على جهاز فعلي (2026-11-17)، على Raspberry Pi حقيقي ومع تحديث تلقائي من Quadlet أمام ghcr.io نفسه.
