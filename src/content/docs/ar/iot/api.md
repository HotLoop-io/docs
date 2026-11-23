---
title: "واجهة HTTP البرمجية"
description: "كل استدعاء يردّ عليه HotLoop عبر HTTP، وما يحتاجه وما يقبله وما يعيده. واجهة الويب لا تستخدم شيئاً غيره."
---

كل استدعاء يجيب عنه Gateway عبر HTTP، وما يحتاجه، وما يقبله، وما يعيده. واجهة الويب لا تستخدم شيئًا غير ذلك: لا توجد واجهة برمجية خاصة خلف الشاشات، فكل ما تستطيع الواجهة فعله يستطيع سكربت فعله بالاستدعاءات نفسها والصلاحيات نفسها.

تُفحص هذه الصفحة مقابل الشيفرة. لذلك فإن قائمة المسارات ومن يحق له استدعاؤها ليست وصفًا لواجهة برمجية كما كانت يومًا. أُخذت أشكال الطلبات والاستجابات أدناه من Gateway قيد التشغيل؛ والاختبارات لا تفحصها، فإذا غيّرت معالجًا فغيّر قسمه هنا أيضًا.

خلفية كل ميزة بتفصيل أكبر موجودة في صفحتها الخاصة: [المصادقة والمستخدمون](/ar/iot/authentication/) و[الكيانات](/ar/iot/entities/) و[شجرة المعدات والتسميات](/ar/iot/equipment/) و[الأتمتة](/ar/iot/automations/) و[التقارير المجدولة](/ar/gateway/reports/) و[إدارة أسطول الأجهزة](/ar/gateway/fleet/) و[إشعارات الإنذارات](/ar/iot/notifications/) و[النسخ الاحتياطية والاستعادة](/ar/iot/backup/) و[MCP](/ar/iot/mcp/). هذه الصفحة هي القائمة، وتلك الصفحات تشرح الأسباب.

## الاصطلاحات

### أين توجد

كل شيء على منفذ HTTP الوحيد للتطبيق (`HOTLOOP_LISTEN_ADDR`، والافتراضي `:8080`). خلف وكيل يقدّم التطبيق تحت مسار، اضبط `HOTLOOP_BASE_PATH` فيزيله Gateway، فيصبح `/hotloop/api/devices` و`/api/devices` الاستدعاء نفسه. المسارات أدناه مكتوبة بدونه.

### تسجيل الدخول: ملف تعريف ارتباط أو رمز bearer

يحتاج كل مسار `/api/` إلى جلسة، باستثناء تسجيل الدخول (بكلمة مرور، أو برمز PIN أو بطاقة على لوحة كشك)، وwebhooks الواردة، وروابط إقرار الإنذارات، وكلٌّ منها يحمل إثباته الخاص في الطلب. يردّ `POST /api/auth/login` برمز ويضبطه أيضًا في ملف تعريف الارتباط `iiot_session` (HttpOnly وSameSite=Lax وSecure عندما يصل الطلب عبر TLS أو مع `X-Forwarded-Proto: https`). يستخدم المتصفح ملف تعريف الارتباط ولا يرى الرمز أبدًا. أما السكربت فيرسل الرمز بدلًا منه:

```
Authorization: Bearer 3f9c...e1
```

كلاهما الجلسة نفسها وتُفحص بالطريقة نفسها. تدوم الجلسة `HOTLOOP_AUTH_SESSION_TTL` (12 ساعة افتراضيًا). وبدون جلسة، يردّ كل مسار `/api/` بما يلي:

```
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="hotloop"

{"error":"not logged in"}
```

أو `"the session is invalid or has expired"` للرمز الذي أُلغي أو انتهت صلاحيته، أو `"this account no longer has access"` للحساب الذي عُطّل.

مع `HOTLOOP_AUTH_INSECURE=true` لا يوجد تسجيل دخول إطلاقًا: لا يُفحص شيء، وكل صلاحية أدناه تُمنح للجميع، والاسم المسجَّل مع الكتابة يأتي من ترويسة الوكيل `X-EmberNET-User` أو `X-Forwarded-User` أو `X-Auth-Request-User` أو `X-Remote-User` أو `X-Forwarded-Email`، أو هو `operator` إن لم تُضبط أي منها. لا يصح ذلك إلا خلف NetworkPolicy لا تسمح لأحد بالوصول إلى الـ Pod سوى وكيل لوحة المعلومات. راجع [المصادقة والمستخدمون](/ar/iot/authentication/#التشغيل-بدون-تسجيل-دخول).

MCP منفصل: له رمز bearer خاص به (`HOTLOOP_MCP_TOKEN`) ولا ينظر أبدًا في جلسة. راجع [MCP](#mcp).

### الصلاحيات

يملك المستخدم الذي سجّل الدخول قائمة صلاحيات، من دوره أو مضبوطة صراحةً على حسابه. المسار الذي يتطلب صلاحية لا يملكها المستخدم يردّ بما يلي:

```
HTTP/1.1 403 Forbidden

{"error":"viewer1 does not have the \"values.write\" permission"}
```

يبيّن [جدول الصلاحيات](#الصلاحيات) أي دور يملك ماذا.

### الأخطاء

كل إخفاق تنتجه الواجهة البرمجية نفسها هو JSON بشكل واحد:

```json
{"error": "value is outside the tag's configured range: 120 is outside 0..95"}
```

يضيف `/readyz` حقل `detail`، وتضيف استدعاءات الخدمة الفاشلة عمليات الكتابة التي أجرتها. الرسالة مكتوبة للشخص الذي يقرؤها: تقول ما الخطأ، وعند وجود بديل تقول ما الذي يجب فعله بدلًا منه. اعرضها كما هي.

| الحالة | متى |
|---|---|
| 400 | الطلب خاطئ: جسم مشوّه، أو حقل لا يجتاز التحقق، أو حقل غير معروف، أو معامل ناقص، أو خدمة غير معروفة |
| 401 | لا توجد جلسة، أو انتهت صلاحيتها، أو كلمة المرور خاطئة عند تسجيل الدخول |
| 403 | المستخدم لا يملك الصلاحية، أو رفضت بوابة الكتابة الكتابة بحكم السياسة: الكتابة معطلة، أو الوسم غير مفعّل، أو الكيان معطّل |
| 404 | ما ذُكر في المسار أو الجسم غير موجود |
| 409 | موجود بالفعل، أو في حالة لا تسمح بهذا: إنذار غير مؤجَّل، أو عقدة ما زال لها أبناء، أو كيان بلا حالة معروفة للتبديل، أو سكربت يعمل بالفعل، أو وصفة رُفضت أو تُطبَّق بالفعل |
| 422 | قيمة رفضتها بوابة الكتابة لذاتها: خارج نطاق الوسم، أو خارج خطوة الكيان |
| 502 | ردّ الجهاز بخطأ من عنده والجسم هو كلماته؛ أو بدأت وصفة ولم تصل كل الأهداف، ويبيّن الجسم ما أُرسل وما لم يُرسل |
| 503 | الجهاز غير متصل، أو محرك الإنذارات لا يعمل |
| 500 | عطل داخل الخادم. الجسم هو `internal error (ref …); the server log has the detail under that ref` ولا شيء غيره، وفي السجل الخطأ كاملًا تحت ذلك المرجع. الـ 500 الوحيد الذي يحمل رسالة حقيقية هو ضغطة زر لم يخرج تحريرها، لأن تلك الرسالة تقول بالضبط ما الذي يجب فحصه |

كل ما لا تستطيع الواجهة البرمجية تصنيفه هو 500، وليس 400 أبدًا. انقطاع قاعدة البيانات إذا أُجيب عنه بـ 400 قال للمشغّل إنه كتب شيئًا خاطئًا، فيذهب يبحث عن خطأ طباعي غير موجود.

هناك إخفاقان لا يأتيان من الواجهة البرمجية وهما نص عادي وليسا JSON: المسار الذي لا يطابق أي مسار معرّف يردّ `404 page not found`، والمسار المعروف المستدعى بطريقة خاطئة يردّ `405 method not allowed`.

الكتابة المرفوضة ليست 500 أبدًا. شاشة المصنع التي تعرض رفض السياسة كأنه عطل في الخادم تعلّم المشغّلين تجاهل الأخطاء.

### الأجسام

أجسام الطلبات بصيغة JSON، وحجمها أقصاه 4 MiB (وwebhook الوارد 1 MiB). **الحقول غير المعروفة تُرفض** ولا تُتجاهل:

```json
{"error":"request body: json: unknown field \"x\""}
```

الإعداد المكتوب بخطأ إملائي، إذا أُسقط بصمت، يبدو تمامًا كإعداد نجح، لذلك يرفضه المفكّك.

تستبدل `POST` و`PUT` على الأجهزة والوسوم والإنذارات والأتمتة وأعضاء الأسطول والتقارير الكائن كله: الحقل المحذوف يأخذ قيمته الصفرية، والمنطقي المحذوف يكون `false`. اقرأ، غيّر، أعد الإرسال. الاستثناءات هي `PUT` الخاصة بالكيانات والمعدات، وهي تغيّر الحقول التي ترسلها فقط، وبيانات اعتماد الأجهزة، وتُحفظ عند حذفها (انظر أدناه).

### الأسرار للكتابة فقط

بيانات الاعتماد المخزَّنة في جهاز (كلمة مرور وسيط، أو ترويسة HTTP، أو كلمة مرور في العنوان) لا تُرسل مرة أخرى أبدًا، إلى أي دور، حتى المسؤول. وتظهر هكذا `[redacted]`:

```json
"config": {"clientId": "docs-api-tankfarm", "password": "[redacted]", "username": "tank"}
```

عند حفظ الجهاز، أرسل العنصر النائب (أو احذف المفتاح) للإبقاء على القيمة المخزَّنة، وأرسل قيمة جديدة لاستبدالها، وأرسل `""` أو `null` لمسحها. لا يمكن حفظ جهاز جديد بالعنصر النائب، ويُرفض أي حفظ ينقل الجهاز إلى مضيف مختلف مع إبقاء بيانات اعتماد، حتى لا تُحمَل كلمة مرور مخزَّنة إلى مستمع لدى شخص آخر. القواعد الكاملة في [المصادقة والمستخدمون](/ar/iot/authentication/#بيانات-اعتماد-الأجهزة-للكتابة-فقط). وينطبق الأمر نفسه على كل بيانات اعتماد أخرى يحتفظ بها Gateway: تعرض الإعدادات `set` أو `not set`، وتزيل التشخيصات بيانات الاعتماد من أهداف MCP الصادرة، ولا يُرجع أي شيء في هذه الواجهة البرمجية تجزئة كلمة مرور أو رمز جلسة، سوى الرمز الواحد الذي يسلّمه لك تسجيل الدخول.

### camelCase، إلا حيث يكون snake_case

معظم الواجهة البرمجية بصيغة camelCase (`deviceId` و`pollIntervalMs` و`createdAt`)، كما كانت منذ الإصدار الأول وكما يتطلب عقد `TagValue` للوحة معلومات EmberNet.

نقاط النهاية الخاصة بالكيانات والحالات والخدمات والمعدات والتسميات بصيغة snake_case (`entity_id` و`last_changed` و`parent_id` و`label_id`). وهذا مقصود: تستخدم واجهة الكيانات الشكل الشائع للكيان والحالة والخدمة، فكل ما يتكلمه أصلًا يتكلم هذه أيضًا، وشجرة المعدات هي سجل المناطق في نموذج الكيانات، بشكل مناسب للمستهلكين أنفسهم. وحيث يلتقي الاثنان، يحتفظ كل جانب بصيغته: للجهاز `equipmentId` وللكيان `equipment_id`.

### الأوقات والمدد ومفاتيح الوسوم

- **الطوابع الزمنية** بصيغة RFC 3339 بالتوقيت العالمي المنسّق، مع كسور الثواني عند وجودها: `2026-09-27T20:21:58.255869Z`. يغيّر إعداد المنطقة الزمنية للعرض ما تعرضه الواجهة، ولا يغيّر أبدًا ما تعيده الواجهة البرمجية.
- **الوقت الذي لم يحدث بعد يُحذف.** القاعدة التي لم تعمل قط ليس لها `lastRun`، والجهاز الذي لم يُستطلَع قط ليس له `lastPoll` ولا `lastGood`، والإنذار الذي لم يُقرّ به أحد ليس له `ackedAt`، وعضو الأسطول الذي لم يُرَ قط ليس له `lastSeen`. غياب حقل الوقت يعني أنه لم يحدث قط. لن ترى أبدًا وقت Go الصفري `0001-01-01T00:00:00Z` في استجابة أو حدث تدفق. كان دزينة من الحقول ترسله، وكانت شاشة الأتمتة تعرض قاعدة لم تعمل قط على أنها آخر تشغيل قبل 739887 يومًا. ويقرأ اختبار كل مسار وكل حقل وقت في الشيفرة ليبقى الأمر كذلك.
- **الرسوم المصغّرة** استثناء: فيها `timestamps` بالميلي ثانية يونكس، لأنه يذهب مباشرة إلى المخطط.
- **المدد** تذكر وحدتها في الاسم: `pollIntervalMs` و`onDelaySec` و`minutes` و`durationMs`. و`uptime` في الحالة سلسلة مدة بصيغة Go (`11m13s`).
- **مفتاح الوسم** هو `device/tag`، وهي الصيغة التي يأخذها كل معامل `?tag=` وكل حقل `tag`. يجوز أن تحتوي أسماء الوسوم على شرطات مائلة (مسارات OPC UA وموضوعات MQTT)، لذا لا تفصل إلا أول شرطة: `plc-1/Line/Zone 1` هو الوسم `Line/Zone 1` على الجهاز `plc-1`.
- **معامل الاستعلام الرقمي** الذي ليس رقمًا يُتجاهل ويُستخدم الافتراضي، فيكون `?limit=abc` كأن `?limit` غير مضبوط.
- **القوائم الفارغة** هي `[]` وليست `null` أبدًا، في كل استجابة وكل حدث تدفق وعلى أي عمق. لا تحتاج إلى فحص null قبل `.length`. و`null` الذي تراه ليس قائمة أبدًا: إنه أحد الحقول الموثّقة القابلة لأن تكون null، مثل `equipment_id` للكيان أو `parent_id` للعقدة الجذر. أما حقل القائمة المعلَّم اختياريًا فقد يُحذف كليًا مع ذلك.

### الميزات الاختيارية

الأسطول والإشعارات والنسخ الاحتياطية والتقارير المجدولة معطّلة ما لم يُضبط متغيرها `HOTLOOP_*_ENABLED`. وعندما تكون الميزة معطّلة، يظل مسار القائمة فيها يردّ 200، مع `"configured": false` وقائمة فارغة، ليستطيع العرض أن يقول «غير مفعّل» بدل «لا شيء هنا». وكل مسار آخر في تلك الميزة يردّ 400 مع خطأ يسمّي المتغير:

```json
{"error":"backups are not enabled (HOTLOOP_BACKUP_ENABLED)"}
```

يفعل `GET /api/sites` الشيء نفسه عندما لا يكون أي خادم MCP صادر مُعدًّا.

### غير موجود في هذا المنتج

يُقدَّم HotLoop بصيغة IoT وEdge وGateway وEdge Relay من قاعدة شيفرة واحدة، والميزة التي لا يملكها منتج ليست معطّلة، بل غير موجودة في الملف التنفيذي. وفي IoT وEdge وGateway تظل مساراتها تردّ، بعد فحص الصلاحية نفسه، بـ 404 يقول ذلك ويسمّي الطرفين، ليميّز السكربت «الجهاز الخطأ» من «العنوان الخطأ»:

```json
{"error":"scheduled reports are part of HotLoop Gateway; this is HotLoop IoT","product":"iot","feature":"reports"}
```

ليس 400، لأنه لا يوجد متغير يصلحه، وليس 5xx، لأن شيئًا لم يتعطل. يقول `GET /api/status` منذ البداية أي منتج أجاب وما الميزات التي يملكها، ليسأل العميل بدل أن يتحسّس.

### كل ما يغيّر شيئًا يُسجَّل

كل إنشاء وتغيير وحذف وكتابة وإقرار وتسجيل دخول يصل إلى سجل النظام (`GET /api/events`) مع اسم المستخدم، وكل كتابة على وسم، سواء رُفضت أم لا، تصل إلى تدقيق الكتابة (`GET /api/writes`). ليس في الواجهة البرمجية مسار صامت.

## الصلاحيات

من يملك ماذا. الحساب الذي له قائمة صلاحيات صريحة يملك بالضبط ما تسمّيه، بدل مجموعة دوره. يمنح `*` كل شيء، ويمنح `resource.*` كل شيء تحت مورد (`reports.*`). دور admin هو `*`.

| الصلاحية | viewer | operator | admin |
|---|---|---|---|
| `status.read` | نعم | نعم | نعم |
| `devices.read` | نعم | نعم | نعم |
| `devices.write` | لا | لا | نعم |
| `tags.read` | نعم | نعم | نعم |
| `tags.write` | لا | لا | نعم |
| `values.read` | نعم | نعم | نعم |
| `values.write` | لا | نعم | نعم |
| `board.write` | لا | نعم | نعم |
| `entities.read` | نعم | نعم | نعم |
| `entities.write` | لا | لا | نعم |
| `helpers.write` | لا | نعم | نعم |
| `equipment.read` | نعم | نعم | نعم |
| `equipment.write` | لا | لا | نعم |
| `alarms.read` | نعم | نعم | نعم |
| `alarms.write` | لا | لا | نعم |
| `alarms.ack` | لا | نعم | نعم |
| `automations.read` | نعم | نعم | نعم |
| `automations.write` | لا | لا | نعم |
| `automations.trigger` | لا | نعم | نعم |
| `scripts.read` | نعم | نعم | نعم |
| `scripts.run` | لا | نعم | نعم |
| `scripts.write` | لا | لا | نعم |
| `recipes.read` | نعم | نعم | نعم |
| `recipes.apply` | لا | نعم | نعم |
| `recipes.write` | لا | لا | نعم |
| `blueprints.read` | نعم | نعم | نعم |
| `blueprints.apply` | لا | نعم | نعم |
| `blueprints.write` | لا | لا | نعم |
| `dashboards.read` | نعم | نعم | نعم |
| `dashboards.write` | لا | لا | نعم |
| `energy.read` | نعم | نعم | نعم |
| `energy.write` | لا | لا | نعم |
| `fleet.read` | نعم | نعم | نعم |
| `fleet.write` | لا | نعم | نعم |
| `fleet.rebirth` | لا | نعم | نعم |
| `fleet.restart` | لا | لا | نعم |
| `fleet.update` | لا | لا | نعم |
| `fleet.config` | لا | لا | نعم |
| `notify.test` | لا | لا | نعم |
| `notify.escalation` | لا | لا | نعم |
| `backup.read` | لا | لا | نعم |
| `backup.run` | لا | لا | نعم |
| `reports.read` | نعم | نعم | نعم |
| `reports.run` | لا | نعم | نعم |
| `reports.write` | لا | لا | نعم |
| `sites.read` | نعم | نعم | نعم |
| `settings.read` | نعم | نعم | نعم |
| `settings.write` | لا | لا | نعم |
| `events.read` | نعم | نعم | نعم |
| `logbook.read` | نعم | نعم | نعم |
| `users.manage` | لا | لا | نعم |

الخط واحد في كل مكان: المشغّل يدير المصنع (يكتب القيم، ويُقرّ بالإنذارات، ويشغّل الأتمتة، ويحرّك مرحّلًا)، والمسؤول وحده يغيّر ما يُهيَّأ المصنع ليكون، أو يفعل شيئًا نحو العالم الخارجي نيابةً عن Gateway (إعادة تشغيل relay، أو دفع إعداداته، أو إرسال صفحة اختبار، أو تعريف تقرير يرسل بيانات المصنع بالبريد الإلكتروني إلى مكان ما).

## فهرس نقاط النهاية

يوضح عمود الصلاحية ما الذي يفحصه المسار. يعني `session` أي مستخدم سجّل الدخول، بلا أي صلاحية أخرى. ويعني `none` أنه لا حاجة إلى جلسة أيضًا، ويشرح القسم السبب. ويعني `(in handler)` أن الفحص يتم داخل المعالج لا قبله، ويشرح القسم السبب.

يبيّن عمود المنتج أصغر HotLoop يملك المسار: `all` هو IoT وEdge وGateway، و`edge` هو Edge وGateway، و`gateway` هو Gateway وحده. يسجّل كل منتج كل مسار ويفحص عليه الصلاحية نفسها. وفي منتج لا يملكه، يردّ المسار بـ 404 ويقول أين يوجد؛ راجع [غير موجود في هذا المنتج](#غير-موجود-في-هذا-المنتج).

| الطريقة | المسار | الصلاحية | المنتج |
|---|---|---|---|
| `GET` | `/healthz` | none | all |
| `GET` | `/readyz` | none | all |
| `POST` | `/api/auth/login` | none | all |
| `POST` | `/api/auth/kiosk` | none | all |
| `POST` | `/api/auth/logout` | session | all |
| `POST` | `/api/auth/activity` | session | all |
| `GET` | `/api/auth/session` | session | all |
| `POST` | `/api/auth/password` | session | all |
| `GET` | `/api/users` | `users.manage` | all |
| `POST` | `/api/users` | `users.manage` | all |
| `PUT` | `/api/users/{username}` | `users.manage` | all |
| `DELETE` | `/api/users/{username}` | `users.manage` | all |
| `POST` | `/api/users/{username}/password` | `users.manage` | all |
| `DELETE` | `/api/users/{username}/lockout` | `users.manage` | all |
| `PUT` | `/api/users/{username}/pin` | `users.manage` | all |
| `DELETE` | `/api/users/{username}/pin` | `users.manage` | all |
| `GET` | `/api/opcua/certificates` | `users.manage` | all |
| `GET` | `/api/users/{username}/certificates` | `users.manage` | all |
| `POST` | `/api/users/{username}/certificates` | `users.manage` | all |
| `POST` | `/api/users/{username}/certificates/{thumbprint}/revoke` | `users.manage` | all |
| `DELETE` | `/api/users/{username}/certificates/{thumbprint}` | `users.manage` | all |
| `GET` | `/api/status` | `status.read` | all |
| `GET` | `/api/protocols` | `status.read` | all |
| `GET` | `/api/diagnostics` | `status.read` | all |
| `GET` | `/api/devices` | `devices.read` | all |
| `POST` | `/api/devices` | `devices.write` | all |
| `GET` | `/api/devices/{id}` | `devices.read` | all |
| `DELETE` | `/api/devices/{id}` | `devices.write` | all |
| `POST` | `/api/devices/{id}/enabled` | `devices.write` | all |
| `POST` | `/api/devices/{id}/browse` | `devices.read` | all |
| `POST` | `/api/devices/{id}/import` | `tags.write` | all |
| `GET` | `/api/devices/{id}/network` | `devices.read` | all |
| `PUT` | `/api/devices/{id}/network` | `devices.write` | all |
| `DELETE` | `/api/devices/{id}/network` | `devices.write` | all |
| `GET` | `/api/unifi/{id}/networks` | `devices.read` | all |
| `PUT` | `/api/unifi/{id}/networks/{network}` | `devices.write` | all |
| `POST` | `/api/unifi/{id}/networks/{network}/accept-all` | `devices.write` | all |
| `GET` | `/api/unifi/{id}/known` | `devices.read` | all |
| `PUT` | `/api/unifi/{id}/networks/{network}/known/{mac}` | `devices.write` | all |
| `DELETE` | `/api/unifi/{id}/networks/{network}/known/{mac}` | `devices.write` | all |
| `GET` | `/api/unifi/{id}/clients` | `devices.read` | all |
| `GET` | `/api/unifi/consoles` | `devices.read` | all |
| `GET` | `/api/unifi/{id}/overview` | `devices.read` | all |
| `GET` | `/api/unifi/{id}/topology` | `devices.read` | all |
| `GET` | `/api/unifi/{id}/devices` | `devices.read` | all |
| `GET` | `/api/unifi/{id}/wifi` | `devices.read` | all |
| `GET` | `/api/unifi/{id}/events` | `devices.read` | all |
| `POST` | `/api/unifi/{id}/starter-alarms` | `alarms.write` | all |
| `GET` | `/api/discovery` | `devices.read` | all |
| `GET` | `/api/discovery/{source}/{key}` | `devices.read` | all |
| `POST` | `/api/discovery/{source}/{key}/accept` | `devices.write` | all |
| `POST` | `/api/discovery/{source}/{key}/ignore` | `devices.write` | all |
| `POST` | `/api/discovery/{source}/{key}/unignore` | `devices.write` | all |
| `POST` | `/api/discovery/{source}/{key}/review/apply` | `devices.write` | all |
| `POST` | `/api/discovery/{source}/{key}/review/reject` | `devices.write` | all |
| `GET` | `/api/network-discovery` | `devices.read` | all |
| `GET` | `/api/network-discovery/{key}` | `devices.read` | all |
| `POST` | `/api/network-discovery/{key}/accept` | `devices.write` | all |
| `POST` | `/api/network-discovery/{key}/ignore` | `devices.write` | all |
| `POST` | `/api/network-discovery/{key}/unignore` | `devices.write` | all |
| `POST` | `/api/network-discovery/probe` | `devices.write` | all |
| `GET` | `/api/integrations` | `devices.read` | all |
| `POST` | `/api/integrations/{id}/probe` | `devices.write` | all |
| `POST` | `/api/integrations/{id}/setup` | `devices.write` | all |
| `GET` | `/api/broker/logins` | `users.manage` | all |
| `POST` | `/api/broker/logins` | `users.manage` | all |
| `PUT` | `/api/broker/logins/{name}` | `users.manage` | all |
| `DELETE` | `/api/broker/logins/{name}` | `users.manage` | all |
| `GET` | `/api/mqtt/brokers` | `devices.read` | all |
| `POST` | `/api/mqtt/brokers` | `devices.write` | all |
| `PUT` | `/api/mqtt/brokers/{id}` | `devices.write` | all |
| `DELETE` | `/api/mqtt/brokers/{id}` | `devices.write` | all |
| `GET` | `/api/tags` | `tags.read` | all |
| `POST` | `/api/tags` | `tags.write` | all |
| `DELETE` | `/api/tags/{device}/{name}` | `tags.write` | all |
| `GET` | `/api/values` | `values.read` | all |
| `GET` | `/api/sparkline` | `values.read` | all |
| `GET` | `/api/board` | `values.read` | all |
| `PUT` | `/api/board` | `board.write` | all |
| `POST` | `/api/write` | `values.write` | all |
| `GET` | `/api/history` | `values.read` | all |
| `GET` | `/api/writes` | `values.read` | all |
| `GET` | `/api/entities` | `entities.read` | all |
| `GET` | `/api/entities/composites` | `entities.read` | all |
| `GET` | `/api/entities/{entity_id}` | `entities.read` | all |
| `GET` | `/api/entities/{entity_id}/image` | `entities.read` | all |
| `PUT` | `/api/entities/{entity_id}` | `entities.write` | all |
| `POST` | `/api/entities` | `entities.write` | all |
| `DELETE` | `/api/entities/{entity_id}` | `entities.write` | all |
| `GET` | `/api/states` | `entities.read` | all |
| `GET` | `/api/states/{entity_id}` | `entities.read` | all |
| `GET` | `/api/energy/meters` | `energy.read` | all |
| `POST` | `/api/energy/meters` | `energy.write` | all |
| `GET` | `/api/energy/meters/{id}` | `energy.read` | all |
| `PUT` | `/api/energy/meters/{id}` | `energy.write` | all |
| `DELETE` | `/api/energy/meters/{id}` | `energy.write` | all |
| `GET` | `/api/energy/summary` | `energy.read` | all |
| `GET` | `/api/energy/summary/{period}` | `energy.read` | all |
| `GET` | `/api/energy/series` | `energy.read` | all |
| `GET` | `/api/energy/series/{meter}/{period}/{step}` | `energy.read` | all |
| `POST` | `/api/services/{domain}/{service}` | `values.write`, `alarms.ack`, `helpers.write`, `scripts.run`, `recipes.apply` (in handler) | all |
| `GET` | `/api/helpers` | `entities.read` | all |
| `POST` | `/api/helpers` | `entities.write` | all |
| `GET` | `/api/helpers/{entity_id}` | `entities.read` | all |
| `PUT` | `/api/helpers/{entity_id}` | `entities.write` | all |
| `DELETE` | `/api/helpers/{entity_id}` | `entities.write` | all |
| `GET` | `/api/equipment` | `equipment.read` | all |
| `POST` | `/api/equipment` | `equipment.write` | all |
| `GET` | `/api/equipment/{id}` | `equipment.read` | all |
| `PUT` | `/api/equipment/{id}` | `equipment.write` | all |
| `DELETE` | `/api/equipment/{id}` | `equipment.write` | all |
| `GET` | `/api/labels` | `equipment.read` | all |
| `POST` | `/api/labels` | `equipment.write` | all |
| `GET` | `/api/labels/{label_id}` | `equipment.read` | all |
| `PUT` | `/api/labels/{label_id}` | `equipment.write` | all |
| `DELETE` | `/api/labels/{label_id}` | `equipment.write` | all |
| `PUT` | `/api/devices/{id}/labels` | `equipment.write` | all |
| `GET` | `/api/alarms` | `alarms.read` | all |
| `POST` | `/api/alarms` | `alarms.write` | all |
| `POST` | `/api/alarms/import/codesys` | `alarms.write` | all |
| `DELETE` | `/api/alarms/{id}` | `alarms.write` | all |
| `POST` | `/api/alarms/{id}/ack` | `alarms.ack` | all |
| `POST` | `/api/alarms/{id}/shelve` | `alarms.ack` | all |
| `POST` | `/api/alarms/{id}/unshelve` | `alarms.ack` | all |
| `GET` | `/api/alarms/events` | `alarms.read` | all |
| `GET` | `/api/automations` | `automations.read` | all |
| `POST` | `/api/automations` | `automations.write` | all |
| `POST` | `/api/automations/validate` | `automations.write` | all |
| `DELETE` | `/api/automations/{id}` | `automations.write` | all |
| `POST` | `/api/automations/{id}/enabled` | `automations.write` | all |
| `POST` | `/api/automations/{id}/trigger` | `automations.trigger` | all |
| `GET` | `/api/runs` | `automations.read` | all |
| `POST` | `/api/automations/{id}/blueprint-upgrade` | `blueprints.apply` | all |
| `GET` | `/api/blueprints` | `blueprints.read` | all |
| `POST` | `/api/blueprints` | `blueprints.write` | all |
| `GET` | `/api/blueprints/{id}` | `blueprints.read` | all |
| `PUT` | `/api/blueprints/{id}` | `blueprints.write` | all |
| `DELETE` | `/api/blueprints/{id}` | `blueprints.write` | all |
| `POST` | `/api/blueprints/{id}/instantiate` | `blueprints.apply` | all |
| `GET` | `/api/dashboards` | `dashboards.read` | all |
| `POST` | `/api/dashboards` | `dashboards.write` | all |
| `GET` | `/api/dashboards/{id}` | `dashboards.read` | all |
| `PUT` | `/api/dashboards/{id}` | `dashboards.write` | all |
| `DELETE` | `/api/dashboards/{id}` | `dashboards.write` | all |
| `GET` | `/api/dashboards/{id}/export` | `dashboards.read` | all |
| `POST` | `/api/dashboards/import` | `dashboards.write` | all |
| `GET` | `/api/scripts` | `scripts.read` | all |
| `POST` | `/api/scripts` | `scripts.write` | all |
| `POST` | `/api/scripts/validate` | `scripts.write` | all |
| `GET` | `/api/scripts/{id}` | `scripts.read` | all |
| `PUT` | `/api/scripts/{id}` | `scripts.write` | all |
| `DELETE` | `/api/scripts/{id}` | `scripts.write` | all |
| `POST` | `/api/scripts/{id}/run` | `scripts.run` | all |
| `POST` | `/api/scripts/{id}/stop` | `scripts.run` | all |
| `GET` | `/api/scripts/{id}/runs` | `scripts.read` | all |
| `GET` | `/api/recipes` | `recipes.read` | all |
| `POST` | `/api/recipes` | `recipes.write` | all |
| `POST` | `/api/recipes/capture` | `recipes.write` | all |
| `GET` | `/api/recipes/{id}` | `recipes.read` | all |
| `PUT` | `/api/recipes/{id}` | `recipes.write` | all |
| `DELETE` | `/api/recipes/{id}` | `recipes.write` | all |
| `GET` | `/api/recipes/{id}/versions` | `recipes.read` | all |
| `GET` | `/api/recipes/{id}/versions/{version}` | `recipes.read` | all |
| `POST` | `/api/recipes/{id}/validate` | `recipes.apply` | all |
| `POST` | `/api/recipes/{id}/apply` | `recipes.apply` | all |
| `GET` | `/api/recipes/{id}/applications` | `recipes.read` | all |
| `POST` | `/api/webhook/{path}` | none | all |
| `GET` | `/api/fleet` | `fleet.read` | gateway |
| `POST` | `/api/fleet` | `fleet.write` | gateway |
| `DELETE` | `/api/fleet/{id}` | `fleet.write` | gateway |
| `POST` | `/api/fleet/{id}/rebirth` | `fleet.rebirth` | gateway |
| `POST` | `/api/fleet/{id}/restart` | `fleet.restart` | gateway |
| `POST` | `/api/fleet/{id}/update` | `fleet.update` | gateway |
| `POST` | `/api/fleet/{id}/config` | `fleet.config` | gateway |
| `DELETE` | `/api/fleet/{id}/config` | `fleet.config` | gateway |
| `POST` | `/api/notify/test` | `notify.test` | all |
| `GET` | `/api/notify/escalation` | `notify.escalation` | all |
| `PUT` | `/api/notify/escalation` | `notify.escalation` | all |
| `POST` | `/api/notify/ack/{token}` | none | all |
| `GET` | `/api/backup` | `backup.read` | all |
| `POST` | `/api/backup` | `backup.run` | all |
| `GET` | `/api/reports` | `reports.read` | gateway |
| `POST` | `/api/reports` | `reports.write` | gateway |
| `GET` | `/api/reports/{id}` | `reports.read` | gateway |
| `PUT` | `/api/reports/{id}` | `reports.write` | gateway |
| `DELETE` | `/api/reports/{id}` | `reports.write` | gateway |
| `POST` | `/api/reports/{id}/run` | `reports.run` | gateway |
| `GET` | `/api/reports/{id}/runs` | `reports.read` | gateway |
| `GET` | `/api/reports/{id}/runs/{run}/download` | `reports.read` | gateway |
| `GET` | `/api/sites` | `sites.read` | gateway |
| `GET` | `/api/settings` | `settings.read` | all |
| `PUT` | `/api/settings` | `settings.write` | all |
| `GET` | `/api/historian/targets` | `settings.read` | all |
| `POST` | `/api/historian/targets` | `settings.write` | all |
| `PUT` | `/api/historian/targets/{id}` | `settings.write` | all |
| `DELETE` | `/api/historian/targets/{id}` | `settings.write` | all |
| `GET` | `/api/events` | `events.read` | all |
| `GET` | `/api/logbook` | `logbook.read` | all |
| `GET` | `/api/stream` | `status.read` | all |
| أي طريقة | `/mcp` | رمز MCP | all |
| أي طريقة | `/mcp/` | رمز MCP | all |
| `GET` | `/manifest.webmanifest` | none | all |
| `GET` | `/sw.js` | none | all |
| `GET` | `/next` | none | all |
| `GET` | `/next/` | none | all |
| أي طريقة | `/` | none | all |

## الصحة

لـ kubelet وموازنات الحمل. لا يحتاج أي منهما إلى جلسة: المسبار ليس له حساب، ولا يقول أي منهما شيئًا عن المصنع.

### `GET /healthz`

Liveness. `200` مع النص `ok` ما دامت العملية تخدم HTTP. لا تلمس قاعدة البيانات، عن قصد: انقطاع قاعدة البيانات يجب أن يُخرج الـ Pod من التدوير، لا أن يعيد تشغيله في حلقة.

### `GET /readyz`

Readiness. يرسل ping إلى قاعدة البيانات بمهلة 5 ثوانٍ.

```json
{"status":"ready"}
```

`503` حين لا يستطيع الوصول إليها، والسبب في `detail` (الشكل من المعالج؛ ونص السبب هو ما قاله مشغّل قاعدة البيانات):

```json
{"error":"not ready","detail":"<why the database did not answer>"}
```

التطبيق الذي لا يصل إلى أرشيف بياناته التاريخية لا ينبغي أن يستقبل حركة.

## المصادقة

راجع [المصادقة والمستخدمون](/ar/iot/authentication/) للحسابات والأدوار وأول مسؤول.

### `POST /api/auth/login`

لا حاجة إلى جلسة، بحكم التصميم.

| الحقل | النوع | <span class="sr-only">التفاصيل</span> |
|---|---|---|
| `username` | string | مطلوب. تُتجاهل حالة الأحرف والمسافات المحيطة |
| `password` | string | مطلوب |

```json
{"expiresAt":"2026-09-28T08:21:00.571794Z","permissions":["*"],"role":"admin","token":"<token>","username":"admin"}
```

يضبط أيضًا ملف تعريف الارتباط `iiot_session` على الرمز نفسه. `401` `"invalid username or password"` للاسم الخاطئ أو كلمة المرور الخاطئة أو الحساب المعطّل على حد سواء، ويستغرق الوقت نفسه في كل حال: أيٌّ من الثلاثة كان ليس مما يُقال لغريب. `429` لحساب أخطأ في كلمات المرور أو رموز PIN مرات كثيرة متتالية، أيًّا كان ما يُرسل، مع ترويسة `Retry-After`؛ راجع [المصادقة والمستخدمون](/ar/iot/authentication/#القفل-بعد-كلمات-المرور-وأرقام-pin-الخاطئة).

### `POST /api/auth/kiosk`

تسجيل الدخول عند لوحة مشتركة برمز PIN أو بطاقة، كما تصفه [المصادقة والمستخدمون](/ar/iot/authentication/#لوحات-الكشك-رمز-pin-أو-بطاقة-وتسجيل-خروج-عند-الخمول). لا حاجة إلى جلسة، بحكم التصميم.

| الحقل | النوع | <span class="sr-only">التفاصيل</span> |
|---|---|---|
| `code` | string | مطلوب. رمز PIN، أو القيمة التي كتبها قارئ بطاقات يعمل كلوحة مفاتيح. تُتجاهل المسافات المحيطة |
| `username` | string | اختياري. معه يُفحص رمز PIN لذلك الحساب فقط، ويُحتسب الخاطئ ضمن حظر ذلك الحساب. وبدونه يُبحث عن الرمز بين رموز كل الحسابات |

```json
{"expiresAt":"2026-10-21T08:21:00.571794Z","idleSec":300,"permissions":["status.read","tags.read"],"role":"operator","username":"olga"}
```

يضبط ملف تعريف الارتباط `iiot_session` ولا يردّ، بخلاف `POST /api/auth/login`، بالرمز: جلسة الكشك تخص المتصفح عند اللوحة. `idleSec` هو المدة التي تبقاها الجلسة دون أن يلمسها أحد. `401` `"that PIN or badge isn't recognized"` للرمز الخاطئ والرمز القصير جدًا ورمز الحساب المعطّل على حد سواء، ويستغرق الوقت نفسه في كل حال. `429` حين يكون الحساب محظورًا (راجع [الحظر](/ar/iot/authentication/#القفل-بعد-كلمات-المرور-وأرقام-pin-الخاطئة))، مع ترويسة `Retry-After`. الرمز المرسل بلا `username` ولا يطابق أحدًا لا يُحتسب على أي حساب؛ واللوحة التي أرسلته، بحسب عنوان العميل، تنتظر نصف ثانية إضافية قبل فحص محاولتها التالية من هذا النوع، حتى `ui.panelDelaySeconds`، ويعيد الرمز الصحيح العدّ من البداية. اللوحة لا تُحظر أبدًا. `400` حين يعمل النشر بلا تسجيل دخول (`HOTLOOP_AUTH_INSECURE`)، إذ لا يوجد حينئذ من يُسجَّل الدخول باسمه.

### `POST /api/auth/activity`

لمس شخص اللوحة. بلا جسم. `{"status":"ok"}`. في جلسة الكشك هذا ما يؤجل حد الخمول فيها؛ وكذلك كل طلب آخر ليس قراءة (كتابة، إقرار). أما `GET` والتدفق المباشر وعمليات التحميل الخلفية للصفحة نفسها فلا: وإلا لأبقت آخر شخص مسجّلًا للدخول إلى الأبد. الجلسة المنشأة بكلمة مرور ليس لها حد خمول ولا شيء يُؤجَّل.

### `POST /api/auth/logout`

ينهي الجلسة التي جاء بها الطلب (ملف تعريف الارتباط أو bearer) ويمسح ملف تعريف الارتباط. بلا جسم. `{"status":"logged out"}`.

### `GET /api/auth/session`

من أنا. لتسلسل إقلاع الواجهة.

```json
{"authenticated":true,"permissions":["*"],"role":"admin","username":"admin"}
```

الجلسة المنشأة عند لوحة كشك تضيف `"idleSec"`، وهو حد الخمول بالثواني، وبه تعرف الصفحة أنها يجب أن تسجّل خروجها بنفسها.

مع إيقاف المصادقة (`HOTLOOP_AUTH_INSECURE`) يردّ بـ `{"authenticated":false,"insecure":true}` بدل 401، ليستطيع المستخدم أن يرى لماذا لا يوجد تسجيل دخول بدل أن يخمّن.

### `POST /api/auth/password`

تغيير كلمة مرورك أنت. بلا صلاحية: معرفة كلمة المرور الحالية هي بيانات الاعتماد.

| الحقل | النوع | <span class="sr-only">التفاصيل</span> |
|---|---|---|
| `currentPassword` | string | مطلوب |
| `newPassword` | string | مطلوب، 8 أحرف على الأقل |

`{"status":"password changed; log in again"}`. **تنتهي كل جلسة يملكها الحساب، بما فيها هذه**، ويُمسح ملف تعريف الارتباط: تغيير كلمة المرور الذي يترك الجلسات القديمة تعمل هو تغيير بالاسم فقط. `401` إن كانت كلمة المرور الحالية خاطئة، و`400` إن كانت الجديدة قصيرة جدًا.

## المستخدمون

كل شيء للمسؤولين فقط (`users.manage`). لا تظهر تجزئات كلمات المرور في أي استجابة؛ والحقل ليس له اسم JSON.

### `GET /api/users`

```json
[{"username":"admin","role":"admin","disabled":false,"hasPin":false,"locked":false,"createdAt":"2026-09-27T20:19:28.036228Z","updatedAt":"2026-09-27T20:19:28.036228Z","lastLogin":"2026-09-27T20:21:00.575455Z"}]
```

يظهر `permissions` فقط على حساب له قائمة صريحة. يبيّن `hasPin` هل للحساب رمز PIN أو بطاقة كشك؛ ولا تظهر القيمة ولا تجزئتها أبدًا.

### `POST /api/users`

| الحقل | النوع | <span class="sr-only">التفاصيل</span> |
|---|---|---|
| `username` | string | مطلوب. أحرف صغيرة وأرقام ونقطة وشرطة سفلية وشرطة، يبدأ بحرف أو رقم، من 2 إلى 64 حرفًا |
| `password` | string | مطلوب، 8 أحرف على الأقل |
| `role` | string | `admin` أو `operator` أو `viewer`. والافتراضي `viewer` |
| `permissions` | string[] | اختياري. يستبدل مجموعة الدور بالكامل |

يردّ بالمستخدم الجديد. `400` للاسم أو الدور أو كلمة المرور غير الصالحة، و`409` إن كان الاسم مأخوذًا.

### `PUT /api/users/{username}`

| الحقل | النوع | <span class="sr-only">التفاصيل</span> |
|---|---|---|
| `role` | string | مطلوب ما لم تُضبط `permissions` |
| `permissions` | string[] | اختياري. الفارغ يعني «استخدم الدور» |
| `disabled` | bool | `true` يعطّل الحساب وينهي كل جلسة يملكها |

يردّ بالمستخدم المحدَّث. `400` لدور غير معروف، أو لتعطيل آخر مسؤول مفعّل: فذلك حظر لا يبقى معه أحد يتراجع عنه. `404` لمستخدم غير معروف.

### `DELETE /api/users/{username}`

`{"status":"deleted"}`. `400` لحسابك أنت أو لآخر مسؤول مفعّل، و`404` لمستخدم غير معروف.

### `POST /api/users/{username}/password`

يضبط مسؤول كلمة مرور شخص آخر دون معرفة القديمة. `{"password": "..."}`، 8 أحرف على الأقل. يردّ بـ `{"status":"password reset"}` وينهي كل جلسة لذلك الحساب.

### `PUT /api/users/{username}/pin`

يعطي مسؤول حسابًا رمز PIN أو قيمة بطاقة لتسجيل الدخول عند لوحة كشك، أو يستبدل ما لديه. `{"code": "482913"}`: من 6 إلى 72 حرفًا، بلا مسافات أو أحرف تحكم، أرقام أو أي شيء آخر يكتبه قارئ البطاقات. يردّ بـ `{"status":"PIN set","username":"olga","hasPin":true}`. تُجزَّأ القيمة بـ bcrypt كما تُجزَّأ كلمة المرور، ولا تُسجَّل ولا تُرسل مرة أخرى أبدًا. `400` لرمز قصير جدًا أو طويل جدًا أو فيه مسافة، ولرمز يملكه حساب آخر بالفعل: تجد اللوحة الحساب بالرمز وحده، فرمز واحد يفتح حسابًا واحدًا. `404` لمستخدم غير معروف. لا يمسّ كلمة المرور ولا أي جلسة.

### `DELETE /api/users/{username}/lockout`

يسمح لحساب محظور بالعودة قبل انتهاء حظره، ويبدأ عدّ كلمات المرور ورموز PIN الخاطئة من الصفر. `{"status":"unlocked","username":"olga","locked":false}`. `404` لمستخدم غير معروف. يعرض الحساب المحظور `"locked":true` و`"lockedUntil"` في `GET /api/users`.

### `DELETE /api/users/{username}/pin`

يزيل رمز PIN أو البطاقة ويُخرج الحساب من كل لوحة كشك هو مسجَّل الدخول فيها. لا تُمَسّ كلمة مروره ولا جلساته على حاسوبه. `{"status":"PIN cleared","username":"olga","hasPin":false}`. `404` لمستخدم غير معروف.

### `GET /api/opcua/certificates`

كل شهادة X.509 مرتبطة بمستخدم لتسجيل الدخول إلى خادم OPC UA (راجع [خادم OPC UA](/ar/edge/opc-ua-server/#شهادات-المستخدم-x509))، الأحدث أولًا: `{"serverAcceptsCertificates":false,"certificates":[...]}`. لكل شهادة `thumbprint` (SHA-256 لصيغة DER، بالست عشري بأحرف صغيرة) و`username` و`label` و`subject` و`notBefore` و`notAfter` و`addedBy` و`addedAt`، و`revokedAt` و`revokedBy` بعد الإبطال، و`lastUsed` بعد الاستخدام، و`state`: `active` أو `revoked` أو `expired` أو `not yet valid`. لا تُدخل أحدًا إلا الشهادة الفعّالة. يبيّن `serverAcceptsCertificates` هل خادم OPC UA يعمل وقد ضُبط فيه `HOTLOOP_OPCUA_SERVER_ALLOW_X509`؛ وتُحفظ الشهادات في الحالتين. لا تُخزَّن أو تُرسل إلا الشهادة العامة.

### `GET /api/users/{username}/certificates`

القائمة نفسها لمستخدم واحد. `404` لمستخدم غير معروف.

### `POST /api/users/{username}/certificates`

يربط شهادة بمستخدم. `{"certificate": "<PEM text or base64 of the DER bytes>", "label": "Olga's laptop"}`؛ والتسمية اختيارية. يردّ بـ `201` مع الشهادة كما تُعرض في القائمة. يجب أن تكون الشهادة RSA بمفتاح لا يقل عن 2048 بت وألا تكون منتهية الصلاحية. يوضّح `400` أيًّا من ذلك هو، وكذلك لما ليس شهادة: يُرفض المفتاح الخاص بالاسم ولا يُحفظ ولا يُردَّد أبدًا، وكذلك السلسلة. `404` لمستخدم غير معروف. `409` حين تكون الشهادة مرتبطة بالفعل، بهذا المستخدم أو بغيره: الشهادة الواحدة شخص واحد. يُسجَّل التغيير في دفتر السجل مع من أجراه.

### `POST /api/users/{username}/certificates/{thumbprint}/revoke`

يُبطل شهادة. لا تعود تستطيع تسجيل الدخول، وتنتهي الجلسة المفتوحة بها خلال 10 ثوانٍ من ذاكرة الصلاحيات المؤقتة، وتُرفض المحاولات اللاحقة وتُسجَّل على أنها مُبطلة. وتبقى في القائمة بحالة `revoked` مع من فعل ذلك ومتى، والإبطال مرة أخرى يُبقي السجل الأول. `{thumbprint}` هو SHA-256 كما في القائمة؛ وتُقبل النقطتان الرأسيتان والمسافات والأحرف الكبيرة. `404` حين لا تكون الشهادة لهذا المستخدم.

### `DELETE /api/users/{username}/certificates/{thumbprint}`

ينسى شهادة. ربطها من جديد يجعلها تعمل من جديد. `404` حين لا تكون لهذا المستخدم. حذف المستخدم يحذف شهاداته.

## الحالة والتشخيص

### `GET /api/status`

شريط الترويسة: عدّادات وقت التشغيل، وملخص الإنذارات، واسم المصنع، وأي منتج هذا. `product` هو `iot` أو `edge` أو `gateway`، مثل `hotloop --product`. يبيّن `features` أيًّا من الميزات التي تختلف بين المنتجات يملكها هذا المنتج: `edge-publish` و`fleet` و`opcua-server` و`reports` و`sites` في Gateway، والأولى والثالثة في Edge، ولا شيء في IoT. `version` هو الإصدار المبني، و`imageDigest` هو digest الصورة التي بدأ منها، وهو ما لا يخبرك به رقم الإصدار على جهاز يتبع `:stable`. لا يوجد إلا حين يذكره المشرف (تفعل وحدات Quadlet ذلك قبل كل بدء؛ أما الملف التنفيذي المجرد وتثبيت Helm فلا يستطيعان) ويُحذف خلاف ذلك.

```json
{
  "alarms": {"critical":0,"high":1,"medium":0,"low":0,"unacked":0,"total":1},
  "features": ["edge-publish","fleet","opcua-server","reports","sites"],
  "plantName": "Demo Plant",
  "product": "gateway",
  "runtime": {
    "startedAt": "2026-09-27T20:19:28.06635851Z", "uptime": "11m13s",
    "devices": 2, "connected": 2, "degraded": 0, "disconnected": 0,
    "tags": 5, "cachedTags": 5, "writesOk": 4, "writesRefused": 3,
    "bus": {"subscribers":4,"published":653,"dropped":0},
    "historian": {"queued":1085,"written":1085,"filtered":329,"dropped":0,"failed":0,"queueLen":0,"queueCap":50000},
    "writePolicy": {"allowWrites":true,"allowMcpWrites":true,"confirmWrites":true},
    "protocols": ["codesys","ethernet-ip","http","modbus","mqtt","mtconnect","opcua","s7comm","snmp","unifi"]
  },
  "siteId": "docs",
  "version": "4.23.2"
}
```

### `GET /api/protocols`

كل بروتوكول يعرفه Gateway، وهل لهذا الإصدار مشغّله.

```json
[{"id":"opcua","name":"OPC UA","description":"The universal one. ...","transport":"opc.tcp binary","defaultPort":4840,"writable":true,"browsable":true,"deviceTypes":["plc","cnc","robot","ipc","hmi","historian","gateway"],"library":"...","available":true}]
```

### `GET /api/diagnostics`

ما تعرضه شاشة التشخيص: مجمّع قاعدة البيانات، وطابور أرشيف البيانات وحجم السجل التاريخي، وناقل الوسوم، ومحرك الكيانات، ومسجِّل دفتر السجل، ووقت التشغيل، وMCP (الخادم والاتصالات الصادرة)، والقواعد المفعّلة في محرك الأتمتة، ومسارات webhook، وطابور تغيّرات الحالة.

```json
{
  "automations": {"armed":[],"stateChangesDropped":0,"stateChangesPending":0,"webhooks":[]},
  "bus": {"subscribers":4,"published":654,"dropped":0},
  "database": {"type":"postgres","totalConns":3,"idleConns":3,"acquiredConns":0,"maxConns":10,"historyMode":"timescale","timescaleVersion":"2.30.1"},
  "entities": {"entities":8,"droppedBatches":0,"pendingChanges":0,"droppedChanges":0},
  "historian": {"queued":1087,"written":1085,"filtered":329,"dropped":0,"failed":0,"queueLen":0,"queueCap":50000},
  "historyStats": {"mode":"timescale","rows":996,"distinctTags":5,"oldest":"2026-09-27T20:21:38.609853Z","newest":"2026-09-27T20:30:39.507987Z","sizeBytes":73728},
  "logbook": {"recording":true,"retentionDays":90,"queued":0,"dropped":0,"written":212,"suppressed":36,"writeErrors":0},
  "mcp": {"outbound":[],"path":"/mcp","serverEnabled":true,"tokenSet":true},
  "runtime": {"...": "the same block as /api/status"}
}
```

مع إعداد خوادم MCP صادرة، يسرد `outbound` كلًّا منها:

```json
{"name":"plant-a","target":"http://localhost:8080/mcp","connected":true,"tools":["ack_alarm","call_service","...","write_tag"],"connectedSince":"2026-09-27T20:45:50Z"}
```

تُحذف أي بيانات اعتماد في `target` أو `lastError` لخادم صادر، لأن عنوان URL أو سطر أوامر قد يحمل رمزًا ويستطيع كل دور قراءة هذا. أما رمز MCP نفسه فلا يكون إلا `tokenSet`.

## الأجهزة

الجهاز اتصال واحد عبر بروتوكول واحد. ما يوضع في `config` و`address` يعتمد على البروتوكول: راجع [البروتوكولات والمشغّلات](/ar/iot/protocols/).

### `GET /api/devices`

كل جهاز، مع حالة اتصاله الحية. بيانات الاعتماد `[redacted]`. يُبقي `?q=` الأجهزة التي يحتوي معرّفها أو اسمها أو عنوانها أو بروتوكولها على النص (دون تمييز حالة الأحرف)، ويُبقي `?limit=` (من 1 إلى 5000، وأي قيمة أخرى `400`) الأوائل منها؛ ومع أيٍّ منهما يبيّن `X-Total-Count` كم جهازًا طابق.

```json
[{"id":"tank-farm","name":"Tank farm","protocol":"mqtt","address":"base-mqtt:1883","enabled":true,
  "site":"Demo Plant","area":"Utilities","equipmentId":4,
  "config":{"clientId":"docs-api-tankfarm","password":"[redacted]","topics":["docs-api-example/#"],"username":"tank","writeTopic":"docs-api-example/{tag}/set"},
  "createdAt":"2026-09-27T20:21:01.637319Z","updatedAt":"2026-09-27T20:21:01.637319Z",
  "state":"connected","lastPoll":"2026-09-27T20:21:39.412Z",
  "latencyMs":0.002,"tagCount":3,"pollCount":1}]
```

`state` هي `connected` أو `connecting` أو `degraded` (يعمل، لكن الاستطلاعات تفشل) أو `disconnected` أو `disabled`. وتظهر `lastError` و`errorCount` وبقية الحقول عندما يكون هناك ما يُقال.

### `POST /api/devices`

ينشئ الجهاز إذا كان `id` جديدًا، ويستبدله إن لم يكن. لا يوجد `PUT`.

| الحقل | النوع | <span class="sr-only">التفاصيل</span> |
|---|---|---|
| `id` | string | مطلوب. من 1 إلى 64 حرفًا أو رقمًا أو `.` أو `_` أو `-`، يبدأ بحرف أو رقم. ينتهي في عناوين URL وموضوعات MQTT ووسائط MCP |
| `name` | string | مطلوب |
| `protocol` | string | مطلوب. بروتوكول لهذا الإصدار مشغّل له (`GET /api/protocols`) |
| `address` | string | مطلوب. مضيف ومنفذ، أو عنوان URL يبدأ بـ `opc.tcp://` أو `http://`: يقرر البروتوكول |
| `enabled` | bool | إذا حُذف فهو `false` |
| `description` | string | |
| `pollIntervalMs`, `timeoutMs` | int | القيمة 0 تأخذ الافتراضي من وقت التشغيل. الحد الأدنى لفاصل الاستطلاع هو `HOTLOOP_MIN_POLL_INTERVAL` |
| `site`, `area`, `line` | string | يضع الجهاز في شجرة المعدات بالاسم، وينشئ العقد عند الحاجة |
| `equipmentId` | int | يضعه بدلًا من ذلك على عقدة في الشجرة؛ وعندها تأتي `site` و`area` و`line` من العقدة. راجع [شجرة المعدات والتسميات](/ar/iot/equipment/) |
| `config` | object | الخيارات الخاصة بالبروتوكول. تتبع بيانات الاعتماد [قواعد الكتابة فقط](#الأسرار-للكتابة-فقط) |

حقول وقت التشغيل (`state` و`lastPoll` و`tagCount` وغيرها) للقراءة فقط؛ وإن أعدت إرسالها تُتجاهل. يردّ بالجهاز المحفوظ مع حجب المعلومات الحساسة. `400` لبروتوكول بلا مشغّل أو تحقق فاشل أو قاعدة بيانات اعتماد؛ ويُعاد تحميل وقت التشغيل به فورًا.

```json
{"error":"no driver for protocol \"profibus\"; this build speaks: ethernet-ip, http, modbus, mqtt, mtconnect, opcua, s7comm, snmp, unifi"}
```

### `GET /api/devices/{id}`

الجهاز ووسومه وتسمياته.

```json
{"device":{"id":"tank-farm","name":"Tank farm","...":"..."},"labels":["critical"],"tags":[{"id":3,"deviceId":"tank-farm","name":"level","...":"..."}]}
```

`tags` هي `[]` لجهاز لا وسوم له. `404` لمعرّف غير معروف.

### `DELETE /api/devices/{id}`

يحذف الجهاز ووسومه وكياناتها. **يُحتفظ بسجله التاريخي.** `{"deleted":"tank-farm"}`، أو `404`.

### `POST /api/devices/{id}/enabled`

`{"enabled": false}` يوقف الاستطلاع دون حذف أي شيء. يردّ بـ `{"enabled":false,"id":"tank-farm"}`. `404` لمعرّف غير معروف.

### `POST /api/devices/{id}/browse`

يسأل الجهاز عن النقاط التي لديه. لا يحتاج إلا إلى `devices.read` لأنه يقرأ. بلا جسم.

```json
{"supported":true,"tags":[{"name":"Plant_Boiler_Temperature","address":"nsu=http://plant/;s=Temperature","dataType":"float","description":"Temperature","writable":true}]}
```

البروتوكول الذي لا يستطيع تعداد نقاطه (Modbus وS7comm وHTTP) يردّ بـ `200` مع `{"supported":false,"reason":"..."}`: هذه حقيقة عن البروتوكول وليست خطأ. `503` إن كان الجهاز غير متصل. `writable` هنا هو ما يقوله الجهاز عن النقطة، لا ما إذا كان Gateway سيكتب إليها.

### `POST /api/devices/{id}/import`

يحوّل نتائج الاستعراض إلى وسوم مُعدّة. يحتاج إلى `tags.write` لأنه ينشئ وسومًا.

```json
{"tags":[{"name":"Temperature","address":"nsu=http://emberburn/;s=Temperature","dataType":"float","unit":"C"}]}
```

يقبل كل إدخال `name` و`address` و`dataType` و`unit` و`description` و`deviceClass` و`writable` (نتيجة الاستعراض كما جاءت). يردّ بـ `{"inserted":2,"updated":0}`. **كل وسم مستورد للقراءة فقط**، أيًّا كان ما قاله الجهاز: النقطة المكتشفة ليست نقطة قرر أحد أنه يجوز التحكم بها، وجعل الافتراضي معكوسًا سيفعّل بضعة آلاف منها دفعة واحدة. فعّل ما تقصده بـ `POST /api/tags`. `404` لجهاز غير معروف.

## UniFi: شبكات OT والعملاء وموقع الجهاز في الشبكة

سجل HotLoop الخاص بمواقع UniFi. راجع [UniFi Network](/ar/iot/unifi/). `{id}` تحت `/api/unifi` هو جهاز UniFi (موقع واحد على وحدة تحكم واحدة)؛ و`{network}` هو المعرّف الذي تعطيه وحدة التحكم نفسها للشبكة، كما يقدّمه `GET .../networks`؛ و`{mac}` يقبل أي صيغة كتابة معتادة ويُحفظ بأحرف صغيرة مع نقطتين رأسيتين.

**لا يسأل أي من هذه الاستدعاءات وحدة التحكم عن شيء.** إنها تقرأ آخر قراءة أجراها المشغّل منها، فلا تكلّف الشاشة المفتوحة وحدة التحكم شيئًا. وهذا يعني أيضًا أنها تردّ بـ `503` إلى أن يُقرأ الجهاز مرة واحدة، وفي مساعد `--mcp-stdio` دائمًا، فهو لا يسجّل الدخول إلى وحدة تحكم أبدًا. ولا يكتب أي منها إلى وحدة تحكم.

التغيير الذي ينشئ إنذارًا أو يزيله يقول ذلك في `change`: `{"alarmsCreated":["unifi-unknown-3f2a9c01b7de"]}`. وهذه تعريفات إنذارات عادية، تحت `/api/alarms`.

### `GET /api/devices/{id}/network`

أين يقع جهاز HotLoop (PLC أو عدّاد) في الشبكة. عند الربط:

```json
{"deviceId":"plc-07","link":{"deviceId":"plc-07","consoleId":"plant-net","mac":"02:48:4c:00:00:07","confirmedBy":"hana","confirmedAt":"2026-09-28T18:02:05Z"},
 "consoleName":"Plant network","client":{"mac":"02:48:4c:00:00:07","ip":"10.77.0.7","switchMac":"00:27:22:e2:1d:6f","switchName":"USW Lite 8 PoE","port":5,"portUp":false,"online":false,"lastSeen":"2026-09-28T18:01:40Z","lastSeenSec":25,"why":"its switch port 5 has no link","...":"..."},
 "readAt":"2026-09-28T18:02:05Z","summary":"on USW Lite 8 PoE port 5, link down; the console last saw it 25s ago; off the network: its switch port 5 has no link","proposals":[]}
```

إن لم يكن مرتبطًا فإن `link` هي `null` وتسرد `proposals` العملاء الذين تملكهم أي وحدة تحكم يقرؤها HotLoop على عنوان IP الجهاز، الأحدث أولًا. الاقتراح ليس إلا اقتراحًا: عناوين IP في وحدة التحكم تتأخر، فلا يُربط شيء إلى أن يؤكد مسؤول واحدًا منها.

### `PUT /api/devices/{id}/network`

`{"consoleId":"plant-net","mac":"02:48:4c:00:00:07"}` يؤكد أي عميل هو الجهاز. ومن ذلك الحين يكون عنوان MAC هو المفتاح ولا يُوثق بعنوان IP مرة أخرى. يحصل العميل على وسوم (`c.<mac>.*` على وحدة التحكم) وإنذار «PLC-07 خارج الشبكة» بأولوية 1 وتأخير تفعيل 120 ثانية حتى لا تنبّه إعادة التشغيل أحدًا. يردّ بـ `{"link":{...},"change":{...}}`. `400` إن لم يكن `consoleId` جهاز UniFi أو لم يكن MAC عنوان MAC، و`404` لجهاز غير معروف.

### `DELETE /api/devices/{id}/network`

يزيل الربط، والإنذار الذي أنشأه HotLoop له ما لم يكن العميل لا يزال مراقَبًا من قائمة المعروفين. `404` إن لم يكن هناك ربط.

### `GET /api/unifi/{id}/networks`

شبكات الموقع كما لدى وحدة التحكم، مع سجل HotLoop: `ot` و`known` (كم جهازًا في قائمتها) و`clients` (عليها الآن) و`unknown` (عليها الآن وليست في القائمة). الشبكة التي لدى HotLoop سجل عنها ولم تعد عند وحدة التحكم تعود مع `"onConsole":false`.

```json
[{"networkId":"6abb23d25a95f2636a5df29c","name":"SCADA","purpose":"corporate","vlan":122,"subnet":"10.122.0.1/24","onConsole":true,"ot":true,"clients":2,"known":1,"unknown":[{"mac":"02:9b:b1:69:88:f2","ip":"10.122.0.66","switchName":"USW Lite 8 PoE","port":6,"...":"..."}],"changedBy":"hana"}]
```

### `PUT /api/unifi/{id}/networks/{network}`

`{"ot": true}` يعلّم شبكة على أنها OT. أي شيء عليها ليس في قائمة المعروفين يُحتسب في `n.<network>.unknown` ويسمّي نفسه في `.unknown_last`، وينشئ HotLoop الإنذار «جهاز غير معروف على SCADA» بأولوية 1. `{"ot": false}` يزيل التعليم ويزيل ذلك الإنذار؛ وتُحفظ قائمة المعروفين. `400` لشبكة WAN أو لشبكة ليست عند وحدة التحكم.

### `POST /api/unifi/{id}/networks/{network}/accept-all`

يقبل كل ما على الشبكة الآن كما هو: النقرة الواحدة بعد تعليمها. الأجهزة الموجودة أصلًا في القائمة تحتفظ باسمها ومراقبتها. بلا جسم. يردّ بـ `{"accepted":[{known device}...]}`، وهي التي أضافها.

### `GET /api/unifi/{id}/known`

كل جهاز معروف على شبكات الموقع: `[{"deviceId":"plant-net","networkId":"...","mac":"...","name":"PLC-07","watch":true,"acceptedBy":"hana","acceptedAt":"..."}]`.

### `PUT /api/unifi/{id}/networks/{network}/known/{mac}`

`{"name":"PLC-07","watch":true}` يقبل جهازًا على الشبكة، أو يغيّر اسمه أو مراقبته. تعطيه `watch` وسومًا وإنذار انقطاع الاتصال؛ والجهاز المسموح به لكنه يأتي ويذهب (حاسوب صيانة محمول) يُقبل بدونها. `400` إن لم تُعلَّم الشبكة OT قط.

### `DELETE /api/unifi/{id}/networks/{network}/known/{mac}`

يزيل جهازًا من القائمة. وإن كان على الشبكة فهو غير معروف مرة أخرى عند القراءة التالية.

### `GET /api/unifi/{id}/clients`

كل عميل تسرده وحدة التحكم، إضافة إلى كل عميل مراقَب لا تسرده، ولكلٍّ منها مكانه وهل هو متصل، و`ot` و`known` و`watched` و`linkedTo` و`summary` من سطر واحد. يضيّق `?q=` النتائج إلى عنوان MAC أو IP أو اسم.

### `GET /api/unifi/consoles`

كل جهاز UniFi لدى HotLoop، يعمل أو لا، لمحدِّد شاشة UniFi: `[{"id":"plant-net","name":"Plant network","address":"https://...","enabled":true,"running":true,"site":"default","version":"10.6.106","readAt":"...","devices":4,"online":4,"clients":12,"failover":false,"eventsLive":true}]`. وحدة التحكم التي لم تقرأها هذه العملية تذكر السبب في `why`.

### `GET /api/unifi/{id}/overview`

بطاقة النظرة العامة: أعداد الأجهزة والعملاء (يُحتسب العميل حين يعتقد HotLoop أنه على الشبكة، وهو الاختبار الذي تستخدمه وسوم `n.<id>.clients`، لا مجرد أن تسرده وحدة التحكم)، والعملاء لكل شبكة، و`health` للأنظمة الفرعية في وحدة التحكم، ولكل بوابة شريط WAN الخاص بها، `gateways[]`: مدخل `wans[]` واحد لكل WAN مع `alive` (فحوص السلامة الخاصة بالبوابة نفسها، لا `up` الخاص بكتلة WAN أبدًا) و`known` و`active` و`backup` والكمون والتوفر. `failover` هو حركة على WAN ليست الأولى، و`down` هو عدم وجود أي WAN حيّة، و`since` هي أول قراءة رأى فيها HotLoop حركة على الـ WAN الذي هو عليه الآن، أي حين لاحظ HotLoop الأمر، لا حين انتقلت البوابة. `events` هو حالة websocket الأحداث (`live` و`error` و`reconnects`) وأحدث عشرة أحداث.

### `GET /api/unifi/{id}/topology`

الخريطة. `nodes[]` هي الأجهزة المعتمدة مع موضعها على الشبكة (`x` و`y` و`layer`: من اليسار إلى اليمين بدءًا من البوابة، وبالترتيب نفسه للقراءة نفسها)، و`edges[]` الكابلات بينها من `downlink_table` الخاص بوحدة التحكم نفسها، و`wired[]` و`wifi[]` العملاء المعلّقون على كل منفذ مبدّل وكل AP وSSID. الجهاز الذي لا يذكر شيء أنه موصول بأي شيء يُرسم وحده مع ضبط `noUplink`، ولا يُعلَّق بالبوابة بالتخمين. وجهاز من وحدة تحكم UniFi أخرى يقرؤها HotLoop وتسرده هذه الوحدة عميلًا يُخاط كعقدة مع ضبط `external` وحافة فيها `stitched`. `feeds` هي، بحسب MAC الجهاز، أجهزة HotLoop المرتبطة بعميل في الاتجاه اللاحق له، مع `equipmentId` الخاص بها لشجرة المصنع، و`links` هي الأجهزة نفسها بحسب MAC العميل.

### `GET /api/unifi/{id}/devices`

كل جهاز معتمد مع أرقامه و`ports[]` الخاص به للوحة الأمامية: الرابط والسرعة ووضع PoE واستهلاكه والعملاء الذين عُلموا على المنفذ والجهاز الموصول به، و`dropped` لمنفذ كان يعمل في قراءة سابقة وهو الآن معطل. الجهاز الذي فقدته وحدة التحكم لا يبلّغ عن أرقام ولا عن روابط منافذ، لأن ما قاله آخر مرة لم يعد حاليًا.

### `GET /api/unifi/{id}/wifi`

معرّفات SSID في الموقع مع `enabled` والشبكة التي تقع عليها وكم عميلًا على كلٍّ منها. حين لا تُظهر وحدة التحكم لهذا الحساب شبكاتها اللاسلكية، يقول `error` السبب وتكون `wlans` فارغة.

### `GET /api/unifi/{id}/events`

أحدث الأحداث التي أبلغت عنها وحدة التحكم منذ اتصال HotLoop، الأحدث أولًا (`?limit=` حتى 200، والافتراضي 50)، وحالة websocket الأحداث. لكل حدث `key` الخاص بالمتحكم (`EVT_SW_Lost_Contact`) و`message` الخاصة به و`severity` (`warning` حين يعلّمه المتحكم على أنه شيء يسير على نحو خاطئ) والجهاز والعميل والمنفذ الذي يخصّه. وهي موجودة أيضًا في دفتر السجل، مؤرشفة تحت المبدّل أو نقطة الوصول التي تخصّها (راجع [UniFi Network](/ar/iot/unifi/#الأحداث)).

### `POST /api/unifi/{id}/starter-alarms`

ينشئ الإنذارات المعتادة للموقع مما لدى وحدة التحكم الآن، كتعريفات إنذارات عادية تحت `/api/alarms`: كل جهاز معتمد غير متصل (أولوية 2، تأخير تفعيل 60 ثانية)، وكل منفذ ربط صاعد معطل (أولوية 1، 10 ثوانٍ)، وبوابة لها WAN اثنان أو أكثر تعمل على احتياطي (أولوية 2، 30 ثانية). الجسم اختياري. يضيف `{"poeLimitW": 25}` إنذارًا بأولوية 3 على استهلاك `poe_w` لكل منفذ PoE فوق هذا العدد من الواطات، بتأخير 30 ثانية؛ ووحدة التحكم لا تقول ما ميزانية المنفذ، فلا يخمّن HotLoop واحدة. الحد السالب هو `400`.

```json
{"created":[{"id":"unifi-devoffline-9c1e2a77b3d0","name":"USW Lite 8 PoE offline","kind":"offline","tag":"d.002722e2e633.online","priority":2}],
 "kept":[]}
```

`kept` هي الإنذارات التي تطلبها المجموعة وكانت موجودة أصلًا: الخاصة بها من ضغطة سابقة، أو إنذار لشخص ما على الوسم نفسه. لذلك فمن الآمن الضغط مرة أخرى بعد اعتماد مزيد من المعدات، ولا يضيف إلا ما يخص المعدات الجديدة. إنذارات شبكة OT والإنذارات الخاصة بالخروج من الشبكة ليست جزءًا منها؛ فهي تأتي مع تعليم شبكة على أنها OT ومراقبة جهاز. `503` إلى أن تُقرأ وحدة التحكم مرة واحدة.

## اكتشاف MQTT

الأجهزة التي أعلنت عن نفسها عبر MQTT، وما قرره شخص بشأن كل منها. راجع [اكتشاف MQTT](/ar/iot/mqtt-discovery/). يستمع الاكتشاف على الوسيط المدمج عندما يعمل، وعلى كل وسيط مُعدّ تحت `/api/mqtt/brokers`. وبدون أيٍّ منهما تكون `sources` فارغة. في مساعد `--mcp-stdio`، الذي لا يستمع أبدًا، يردّ `GET /api/discovery` بـ `{"running":false,"sources":[],"devices":[]}` ويردّ كل مسار آخر بـ `503`.

`{source}` هو الوسيط الذي أعلن عليه الجهاز (`embedded` لوسيط HotLoop نفسه، وإلا فمعرّف الوسيط)؛ و`{key}` هو ما ربط إعلاناته معًا: أول معرّف له، أو عنوان MAC الخاص به بصيغة `mac:aa:bb:cc:dd:ee:ff`، أو معرّف عقدته. رمّزه كعنوان URL؛ فالمعرّفات تحمل أحرفًا لا يقبلها المسار.

**لا يفعّل أي من هذه الاستدعاءات شيئًا.** قبول الجهاز يجعل نقاطه قابلة للتفعيل، واحدة تلو الأخرى، عبر `POST /api/tags` كأي نقطة أخرى.

### `GET /api/discovery`

كل مصدر، مع ما رآه ورفضه، وكل جهاز مكتشف:

```json
{"running":true,"sources":[{"id":"embedded","name":"the embedded broker","prefix":"homeassistant","listening":true,"connected":true,
  "received":42,"dropped":0,"refused":0,"problems":[],"autoCreate":true,"anonymousAllowed":false,
  "external":false,"listenOnly":false,"enabled":true}],
 "devices":[{"source":"embedded","deviceKey":"plug-0001","deviceId":"kitchen-plug","status":"discovered",
  "device":{"identifiers":["plug-0001"],"name":"Kitchen Plug","manufacturer":"Acme","model":"P1","swVersion":"1.0.0"},
  "origin":{"name":"test-publisher","swVersion":"0.1"},"firstSeen":"2026-10-02T09:12:04Z","lastSeen":"2026-10-02T09:12:04Z",
  "components":[{"key":"plug-0001-relay","component":"switch","name":"Relay","configTopic":"homeassistant/switch/plug-0001/relay/config",
   "stateTopic":"plug/relay","commandTopic":"plug/relay/set","commandTopics":["plug/relay/set"],"tag":"relay",
   "unsupported":[],"unknownKeys":[],"flags":[]}]}]}
```

المصدر الذي فيه `external` بقيمة true هو وسيط مُعدّ تحت `/api/mqtt/brokers`، و`broker` يقول أين هو. و`autoCreate` بقيمة false هو مصدر تنتظر أجهزته في صندوق الوارد: تُسرد بحالة `discovered` بلا `deviceId`، ولا يُنشأ شيء ولا يُقرأ شيء إلى أن يقبل أحد واحدًا منها. و`listenOnly` هو وسيط لا ينشر عليه HotLoop أبدًا. ويقول `lastError` لماذا لا يكون المصدر متصلًا، بما في ذلك كلمة مرور لا يمكن فتحها.

`status` هي `discovered` أو `accepted` أو `ignored`. وبحسب المكوّن، تسرد `unsupported` ما لا يستطيع HotLoop استخدامه ولماذا («value template not supported: filter `regex_findall_index` is not supported at column 12»)، و`unknownKeys` مفاتيح الإعداد التي لا يعرّفها التنسيق، و`commandTopics` كل موضوع يمكن أن تذهب إليه أوامره (موضوع سرعة المروحة إضافة إلى الموضوع الرئيسي)، و`flags` ما ينبغي أن ينظر فيه شخص قبل القبول: موضوع أمر خارج المواضيع التي يقرؤها المكوّن، أو داخل بادئة الاكتشاف، أو يطالب به جهاز آخر، وإعداد يطلب أوامر محتفَظًا بها. وتُضبط `withdrawnAt` على مكوّن سحبه الناشر. و`suggestedEquipmentId` هي عقدة الشجرة التي يسمّيها `suggested_area` الخاص بالجهاز، حين تحمل عقدة واحدة بالضبط هذا الاسم؛ ولا تفعل أكثر من ملء مربع حوار القبول مسبقًا. على الوسيط المدمج، `announcedBy` و`announcedVia` هما تسجيل دخول الوسيط ومعرّف العميل اللذان نشرا أحدث إعداد له، و`acceptedLogin` هو تسجيل الدخول الذي قُبل منه. الجهاز المقبول الذي تغيّر إعلانه، أو الذي أعلن عنه تسجيل دخول مختلف، فيه `review`:

```json
{"hash":"9a1c...","summary":["plug-0001-power: unit changed"],
 "changes":[{"key":"plug-0001-power","kind":"changed","fields":[{"field":"unit","running":"W","announced":"kW"}]}]}
```

### `GET /api/discovery/{source}/{key}`

جهاز واحد، بالشكل نفسه. `404` لجهاز لم يره HotLoop.

### `POST /api/discovery/{source}/{key}/accept`

يقبل جهازًا. جسم اختياري `{"equipmentId": 12}` يضعه في الشجرة في الخطوة نفسها. لا يفعّل شيئًا. يردّ بالجهاز. `400` لجهاز متجاهَل.

### `POST /api/discovery/{source}/{key}/ignore`

يُسقط الجهاز: يزول جهازه في HotLoop ووسومه وكياناته (ويبقى سجله التاريخي)، ويظل متجاهَلًا حين يعلن عن نفسه مرة أخرى. يردّ بالجهاز. و`DELETE /api/devices/{id}` على جهاز مكتشف يفعل الشيء نفسه، لأن الجهاز الذي يواصل الإعلان سيعود ببساطة.

### `POST /api/discovery/{source}/{key}/unignore`

يعيد جهازًا متجاهَلًا إلى حالة مكتشف، مما أعلنه آخر مرة. `400` إن لم يكن متجاهَلًا.

### `POST /api/discovery/{source}/{key}/review/apply`

يجعل جهازًا مقبولًا يشغّل ما أعلنه. وتبقى حالة تفعيل كل نقطة كما كانت. `400` حين لا يكون شيء ينتظر المراجعة.

### `POST /api/discovery/{source}/{key}/review/reject`

يُبقي الإعداد المقبول عاملًا ويتوقف عن عرض هذا التغيير. أما التغيير المختلف لاحقًا فيُعرض من جديد. `400` حين لا يكون شيء ينتظر.

قد تتعلق المراجعة بمن أعلن عنه: تغيير فيه `"kind":"publisher"` وسطر الملخص «announced by login garage-node; accepted from kitchen-node». وتطبيقه يجعل ذلك الدخول هو الذي يُقبل منه الجهاز.

## تسجيلات دخول الوسيط

تسجيلات دخول الوسيط المدمج التي أُنشئت في HotLoop، ولكلٍّ منها المواضيع التي يجوز له النشر عليها والاشتراك فيها. راجع [وسيط MQTT المدمج](/ar/iot/broker/). تسجيل الدخول مفتاح إلى وسيط المصنع كله، لذا فهذه `users.manage`، أي لمسؤول. ولا يردّ شيء هنا أبدًا بكلمة مرور أو تجزئتها. يدخل كل تغيير في السجل ويسري من النشر التالي للعميل؛ ولا يحتاج أحد إلى إعادة الاتصال.

### `GET /api/broker/logins`

```json
{"running":true,"anonymous":false,"prefix":"homeassistant","envLogins":["plant"],
 "profiles":[{"name":"shelly","about":"a Shelly Gen2 or later; name the login after its MQTT topic prefix",
   "publish":["%u/#","shellies/announce"],"subscribe":["%u/#","shellies/command","%p/status"]}],
 "logins":[{"name":"kitchen-node","profile":"esphome","publish":["%u/#","%p/+/%u/+/config","esphome/discover/%u"],
   "subscribe":["%u/#","%p/status","esphome/discover"],"createdBy":"admin","createdAt":"2026-10-02T09:12:04Z",
   "updatedAt":"2026-10-02T09:12:04Z","resolvedPublish":["kitchen-node/#","homeassistant/+/kitchen-node/+/config",
   "esphome/discover/kitchen-node"],"resolvedSubscribe":["kitchen-node/#","homeassistant/status","esphome/discover"]}]}
```

تكون `running` بقيمة false حيث لا تشغّل هذه العملية الوسيط؛ وتُحفظ تسجيلات الدخول مع ذلك، ويقرؤها الوسيط عند بدء تشغيله. و`envLogins` هي الأسماء من `HOTLOOP_BROKER_USERS`، وهي تستطيع فعل أي شيء. و`%u` في قاعدة هو اسم تسجيل الدخول نفسه و`%p` بادئة الاكتشاف؛ و`resolved*` هي القواعد وقد مُلئ كلاهما.

### `POST /api/broker/logins`

```json
{"name":"kitchen-node","password":"a-long-random-password","profile":"esphome"}
```

`name` من 1 إلى 64 حرفًا أو رقمًا أو `-` أو `_` (وهو يقوم مقام `%u` في المواضيع). و`password` 12 حرفًا على الأقل. يملأ `profile` القواعد؛ و`publish` و`subscribe`، إن أُعطيتا، تستبدلانها. أحد الاثنين مطلوب. والقاعدة مرشّح موضوع MQTT: `+` و`#` كمستويات كاملة فقط، و`#` أخيرًا فقط، ولا موضوع `$` أبدًا. `201` مع تسجيل الدخول؛ و`400` لأي مما سبق أو لاسم يملكه `HOTLOOP_BROKER_USERS` بالفعل؛ و`409` لاسم مأخوذ.

### `PUT /api/broker/logins/{name}`

أي من `profile` و`publish` و`subscribe` و`password`؛ وما لا يُرسل يبقى. `200` مع تسجيل الدخول، و`404` لتسجيل غير موجود.

### `DELETE /api/broker/logins/{name}`

`200` `{"deleted":"kitchen-node"}`. العميل الذي لا يزال متصلًا به لا يستطيع فعل شيء بعد ذلك، ولا يستطيع الاتصال مرة أخرى. `404` لتسجيل غير موجود.

## اكتشاف الشبكة

الأجهزة التي سُمعت على شبكة المصنع عبر mDNS وSSDP وDHCP، وما قرره شخص بشأن كل منها. راجع [اكتشاف الشبكة](/ar/iot/network-discovery/). في مساعد `--mcp-stdio`، الذي لا يستمع أبدًا، يردّ `GET /api/network-discovery` بـ `{"running":false,"finds":[]}` ويردّ كل مسار آخر بـ `503`.

`{key}` هو كيف سُمع الاكتشاف ومن سمعه: `mdns:` واسم المضيف في mDNS، و`ssdp:` ومعرّف uuid في UPnP، و`dhcp:` وعنوان MAC. رمّزه كعنوان URL.

**لا يفعّل أي من هذه الاستدعاءات شيئًا**، ولا يُضاف هنا شيء إلى أن يقبله أحد.

### `GET /api/network-discovery`

المستمعون والفحص والواجهات التي هم عليها وكل اكتشاف:

```json
{"running":true,
 "status":{"leading":true,"interfaces":["eth0 10.20.0.15/24"],
  "listeners":[{"name":"mdns","enabled":true,"listening":true,"heard":120,"dropped":0,"refused":0},
   {"name":"ssdp","enabled":true,"listening":true,"heard":14,"dropped":0,"refused":0},
   {"name":"dhcp","enabled":false,"listening":false,"heard":0,"dropped":0,"refused":0}],
  "probe":{"networks":[]}},
 "finds":[{"key":"mdns:line3-ua.local","via":"mdns","kind":"opcua","name":"line3-ua","status":"discovered",
  "firstSeen":"2026-10-11T14:02:11Z","lastSeen":"2026-10-11T14:07:40Z",
  "find":{"key":"mdns:line3-ua.local","via":"mdns","kind":"opcua","name":"line3-ua",
   "summary":"OPC UA server, capabilities DA","host":"line3-ua.local","addresses":["10.20.0.31"],
   "services":[{"type":"_opcua-tcp._tcp.local","instance":"line3-ua._opcua-tcp._tcp.local","port":50000,
    "txt":{"caps":"DA","path":"/"}}],
   "proposal":{"protocol":"opcua","address":"opc.tcp://10.20.0.31:50000/","how":"Accepting makes an OPC UA device..."},
   "heard":"2026-10-11T14:07:40Z"}}]}
```

`kind` هو `esphome` أو `shelly` أو `opcua` أو `mqtt-broker` أو `web` أو `mdns` (أعلن عن شيء ليس لدى HotLoop كلمة له) أو `upnp` أو `dhcp`. الاكتشاف الذي في `proposal` الخاصة به `protocol` يصبح عند القبول جهازًا بذلك البروتوكول على `address`؛ والذي ليس فيه يقول في `how` ما الذي سيُدخله. وتسرد `also` الاكتشافات الأخرى والأجهزة المكتشفة عبر MQTT التي هي الصندوق نفسه، بحسب MAC أو العنوان. و`status` هي `discovered` أو `accepted` أو `ignored`، و`deviceId` الجهاز الذي أنشأه القبول. ويقول `error` الخاص بالمستمع لماذا لا يستمع (المنفذ 67 مشغول أو غير مسموح، لا توجد واجهة multicast)؛ ويعدّ `refused` الاكتشافات الجديدة التي أُسقطت لأن السجل ممتلئ.

### `GET /api/network-discovery/{key}`

اكتشاف واحد، بالشكل نفسه. `404` لاكتشاف لم يسمعه HotLoop.

### `POST /api/network-discovery/{key}/accept`

يقبل اكتشافًا. جسم اختياري `{"equipmentId": 12}` يضع الجهاز الذي ينشئه في الشجرة. الاكتشاف الذي لدى HotLoop مشغّل له يصبح جهازًا على العنوان المقترح، مفعّلًا، بلا وسوم ولا شيء مفعّل؛ وأي اكتشاف آخر يُسجَّل معروفًا ولا ينشئ شيئًا. يردّ بالاكتشاف. `400` لاكتشاف مقبول أو متجاهَل بالفعل.

### `POST /api/network-discovery/{key}/ignore`

يُخفي اكتشافًا لم يقرر فيه أحد، ويُبقيه مخفيًا حين يُسمع مرة أخرى. `400` لاكتشاف حُسم أمره.

### `POST /api/network-discovery/{key}/unignore`

يعيد اكتشافًا متجاهَلًا ليُقرَّر بشأنه. `400` إن لم يكن متجاهَلًا.

### `POST /api/network-discovery/probe`

يفحص الآن: استعلام mDNS وبحث SSDP على كل واجهة تُذكر شبكتها في `HOTLOOP_NETDISC_PROBE_NETWORKS`، ولا شيء في مكان آخر. يردّ بـ `{"status": ...}`، وما لم يخرج في `status.probe.lastError`. `400` حين لا تكون الفحوص مفعّلة في أي شبكة: لا يستطيع هذا الزر تفعيلها، بل النشر وحده.

## التكاملات

مسار الإعداد لنوع من الأجهزة يوجّه إليه شخص HotLoop: يسأل عما يحتاجه التكامل، وينظر إلى الجهاز الحقيقي بالإجابات، وينشئ الجهاز ووسومه مما وُجد. راجع [التكاملات](/ar/iot/integrations/).

**لا يفعّل شيء هنا شيئًا.** كل وسم ينشئه الإعداد للقراءة فقط. وتفعيله هو `POST /api/tags` كأي نقطة أخرى.

### `GET /api/integrations`

كل تكامل يملكه هذا الإصدار، مع الأسئلة التي يطرحها:

```json
[{"id":"opcua","name":"OPC UA server","description":"A PLC, CNC, gateway or SCADA server ...",
  "protocol":"opcua","addressLabel":"Endpoint","addressPlaceholder":"opc.tcp://192.168.1.20:4840","writable":true,
  "fields":[{"key":"securityMode","label":"Security","kind":"choice","required":false,"default":"None",
             "choices":[{"value":"None","label":"None"},{"value":"Sign","label":"Sign"}]},
            {"key":"password","label":"Password","kind":"secret","required":false}]}]
```

`kind` هو `text` أو `number` أو `bool` أو `choice` أو `secret`. الحقل الذي فيه `showWhen` (`{"version":["3"]}`) لا يُسأل عنه إلا حين تكون لإجابة أخرى إحدى هذه القيم، وتُتجاهل الإجابة عن سؤال غير ظاهر.

### `POST /api/integrations/{id}/probe`

يفحص الإجابات ويذهب لينظر إلى الجهاز الحقيقي. لا يحفظ شيئًا.

```json
{"address":"opc.tcp://192.168.1.20:4840","options":{"securityMode":"None"}}
```

يردّ بـ `{"integration":"opcua","address":"opc.tcp://192.168.1.20:4840","found":{...}}`. `address` هو العنوان كما حلّه التكامل. وفي `found`: `name` (ما يسمّي به الجهاز نفسه) و`identity` (ما يقول إنه) و`notes` (أمور يجب معرفتها قبل القبول) و`points`، وكل منها بشكل وسم `{name, address, dataType, unit, description, writable, deviceClass}` إضافة إلى `group` و`sample` (ما قرأه حين وُجد) و`suggested`.

`400` لإجابات لا تلائم الأسئلة، مع كل المشكلات دفعة واحدة؛ والإجابة عن سؤال لا يطرحه التكامل هي أيضًا `400`، ولا تُتجاهل. `502` حين لا يردّ الجهاز أو يردّ بشيء ليس بروتوكوله، مع ما حدث من خطأ. `404` لتكامل ليس في هذا الإصدار. ولا يظهر سر أبدًا في إجابة أو خطأ.

### `POST /api/integrations/{id}/setup`

ينظر إلى الجهاز مرة أخرى، ثم ينشئه مع وسومه. الجسم هو جسم الفحص، إضافة إلى:

| الحقل | المعنى |
|---|---|
| `deviceId` | معرّف الجهاز الجديد. إن ترك فارغًا أُخذ من الاسم. `400` إن كان لجهاز |
| `name` | اسم الجهاز. إن ترك فارغًا أُخذ ما يسمّي به الجهاز نفسه |
| `points` | أسماء من `found.points` لإعدادها. إن ترك فارغًا أُخذت المعلَّمة بـ `suggested`. والاسم الذي ليس عند الجهاز هو `400` |
| `site`, `area`, `line` | أين يوضع في شجرة المعدات، كما في `POST /api/devices` |

تُفحص النقاط مقابل الجهاز كما هو الآن، لا مقابل ما يقول عميل إنه وجده قبل دقيقة. يردّ بـ `{"device":{...},"tags":3,"entities":["sensor.plc_sim_..."],"notes":[]}`. الجهاز مفعّل ويُستطلَع، وكل وسم للقراءة فقط، ولكل وسم كيان قراءته. والإعداد الذي يفشل في منتصفه لا يترك جهازًا.

## وسطاء MQTT

وسطاء غير وسيط HotLoop نفسه يستمع إليهم الاكتشاف: Mosquitto في مصنع، والوسيط الذي جاء مع صندوق Zigbee2MQTT. راجع [اكتشاف MQTT](/ar/iot/mqtt-discovery/#وسطاء-آخرون). تُختم كلمات مرورهم بمفتاح بيانات اعتماد الجهاز (`HOTLOOP_SECRET_KEY_FILE`) ولا يُردّ بها أبدًا؛ و`passwordSet` يبيّن هل هناك كلمة مرور مخزّنة، و`passwordProblem` لماذا لا يمكن فتح المخزّنة. يدخل كل تغيير في السجل ويسري فورًا: يعيد المستمع وأجهزة ذلك الوسيط الاتصال.

### `GET /api/mqtt/brokers`

```json
{"secretKey":true,
 "brokers":[{"id":"plant-uns","name":"Plant UNS","broker":"tcp://10.20.0.5:1883","username":"hotloop","useTls":false,
   "insecureSkipVerify":false,"prefix":"homeassistant","listenOnly":true,"autoCreate":false,"tasmota":true,"shelly":true,"enabled":true,
   "createdBy":"admin","passwordSet":true,"createdAt":"2026-10-03T09:12:04Z","updatedAt":"2026-10-03T09:12:04Z"}]}
```

`secretKey` يبيّن هل لدى HotLoop هذا مفتاح لختم كلمة المرور به.

### `POST /api/mqtt/brokers`

```json
{"id":"plant-uns","name":"Plant UNS","broker":"tcp://10.20.0.5:1883","username":"hotloop",
 "password":"...","listenOnly":true}
```

`id` من 1 إلى 63 حرفًا صغيرًا أو رقمًا أو `-`، وليس `embedded`: يسمّي الوسيط في كل جهاز جاء منه، ولا يمكن تغييره. و`broker` هو `host:port` أو عنوان URL يبدأ بـ `tcp://` أو `ssl://` أو `tls://` أو `mqtt://` أو `mqtts://`، بلا تسجيل دخول فيه. و`prefix` افتراضيه `homeassistant`؛ و`autoCreate` false (تنتظر الأجهزة في صندوق الوارد)؛ و`listenOnly` false؛ و`tasmota` (الاستماع أيضًا إلى اكتشاف Tasmota نفسه، `tasmota/discovery/#`) true؛ و`shelly` (تعلّم أجهزة Shelly Gen2 وما بعده من المواضيع `<prefix>/status/<component>` التي تنشرها) true؛ و`enabled` true. تحتاج كلمة المرور إلى اسم مستخدم ومفتاح: وبدون `HOTLOOP_SECRET_KEY_FILE` تكون `400`، ولا تُخزَّن أبدًا بنص صريح. `201` مع الوسيط؛ و`409` لمعرّف مأخوذ.

### `PUT /api/mqtt/brokers/{id}`

أي من الحقول أعلاه عدا `id`؛ وما لا يُرسل يبقى. `"password":""` يمسح كلمة المرور. `200` مع الوسيط.

### `DELETE /api/mqtt/brokers/{id}`

يزيل الوسيط وما أعلن عنه ولم يقبله أحد: صندوق الوارد وأي جهاز أنشأه بنفسه. `409` يسمّيها ما دامت أجهزة مقبولة منه لا تزال موجودة: تجاهلها أو احذفها أولًا، أو أوقف الوسيط بـ `"enabled":false` بدلًا من ذلك. `200` `{"deleted":"plant-uns"}`.

## الوسوم

### `GET /api/tags`

| الاستعلام | <span class="sr-only">التفاصيل</span> |
|---|---|
| `device` | وسوم هذا الجهاز فقط. بدون `limit` يردّ بكلها |
| `q` | بحث: سلسلة جزئية، دون تمييز حالة الأحرف، من معرّف الجهاز أو اسم الوسم أو الوصف. يعمل مع `device` |
| `limit` | عدد صحيح من 1 إلى 5000. الافتراضي 500 بدون `device`. أي قيمة أخرى، بما فيها 5001، هي `400`: تُرفض ولا يُردّ أبدًا بأقل (حتى 4.19.5 كان أي حد فوق 1000 يتحول بصمت إلى 200) |
| `writable` | `true` للوسوم المعلَّمة قابلة للكتابة فقط (ما تعرضه محدّدات الكتابة) |
| `offset` | أين تبدأ الصفحة، صفر أو أكثر. تُرتَّب الوسوم بحسب الجهاز ثم الاسم |

ترويسة `X-Total-Count` في الاستجابة تبيّن كم وسمًا يطابق في المجموع، فيتصفح العميل بـ `offset` إلى أن يحصل عليها كلها ويعرف أنه حصل عليها. الاستجابة الفارغة هي `[]`.

```json
[{"id":5,"deviceId":"tank-farm","name":"level_sp","address":"mqtt:docs-api-example/level_sp","dataType":"float","unit":"%","enabled":true,"writable":true,"maxValue":95,"hasRange":true,"scale":1,"createdAt":"2026-09-27T20:21:39.405164Z","updatedAt":"2026-09-27T20:21:39.405164Z"}]
```

### `POST /api/tags`

ينشئ الوسم إذا كان `deviceId` و`name` جديدين، ويستبدله إن لم يكونا.

| الحقل | النوع | <span class="sr-only">التفاصيل</span> |
|---|---|---|
| `deviceId` | string | مطلوب. يجب أن يكون الجهاز موجودًا (`404` إن لم يكن) |
| `name` | string | مطلوب. بلا أحرف تحكم |
| `address` | string | مطلوب. عنوان البروتوكول الخاص |
| `dataType` | string | `bool` أو `int` أو `float` أو `string` (والأسماء البديلة المعتادة: `int16` و`word` و`coil`...). يقرر كيف تُرمَّز الكتابة |
| `unit`, `description` | string | |
| `enabled` | bool | إذا حُذف فهو `false` |
| `writable` | bool | **يفعّل الوسم للكتابة، من كل مسار: الواجهة والأتمتة والكيانات وMCP.** إذا حُذف فهو `false` |
| `hasRange`, `minValue`, `maxValue` | bool, number, number | مع `hasRange` تُرفض الكتابة خارج النطاق (ولا تُقتطع أبدًا) |
| `scale`, `offset` | number | القيمة الهندسية = الخام x المعامل + الإزاحة. المعامل 0 يُعامَل على أنه 1 |
| `noData` | list | قيم خام تعني «لا قياس»، كلٌّ منها `{"raw", "reason"}`. `raw` سلسلة (`"0x8005"` و`"-32763"`) أو رقم مجرد، ويعود كسلسلة. القراءة التي قيمتها الخام في القائمة تكون رديئة الجودة مع ذلك `reason`، وتُفحص قبل `scale` و`offset`. حتى 32 رمزًا. الرمز الذي ليس عددًا صحيحًا أو المدرج مرتين أو الذي لا يمكن أن يكون من نوع النقطة هو `400`. راجع [البروتوكولات والمشغّلات](/ar/iot/protocols/#no-data-values) لمعرفة ما يُكتب لكل نوع ومثال Yokogawa DX |
| `deadband`, `deadbandPercent` | number | التغيرات الأصغر من هذا لا تُكتب في السجل التاريخي |
| `deviceClass` | string | الفئة التي تبدأ بها كيانات الوسم (`power` و`connectivity` و`temperature`...)، حين يكون لها معنى في مجالها. تُؤخذ عند إنشاء الوسم وتُتجاهل عند الاستبدال: من ذلك الحين يملك الكيان فئته، فغيّرها هناك |

يردّ بالوسم المحفوظ. حفظ وسم مع `writable: true` يُسجَّل على هذا النحو: تفعيل الوسم قرار يخص السلامة ويُسجَّل باسم صاحبه. تُنشأ كيانات الوسم أو تُحدَّث قبل الاستجابة، فيستطيع العميل طلبها فورًا.

الوسم على جهاز مكتشف لم يقبله أحد لا يمكن تفعيله: `400`، «accept the device first». راجع [اكتشاف MQTT](/ar/iot/mqtt-discovery/#الأوامر).

### `DELETE /api/tags/{device}/{name}`

`{"deleted":"tank-farm/level"}`، أو `404`. يبقى السجل التاريخي. تصبح كيانات الوسم يتيمة (راجع [الكيانات](/ar/iot/entities/#الوسوم-المحذوفة-والكيانات-اليتيمة-وإعادة-التبنّي)).

## القيم واللوحة وعمليات الكتابة

### `GET /api/values`

أحدث قراءة لكل وسم، من الذاكرة. يضيّقها `?device=` إلى جهاز واحد.

```json
[{"deviceId":"extruder-1","protocol":"opcua","tagName":"Temperature","tagValue":20.645294745260895,"unit":"C","quality":"good","timestamp":"2026-09-27T20:21:58.255722Z"}]
```

هذا الشكل هو `TagValue` الخاص بلوحة معلومات EmberNet وهو عقد. `quality` هي `good` أو `uncertain` أو `bad`؛ **القراءة الرديئة تعني أن القيمة غير معروفة، لا أنها صفر**. قراءة السلسلة تحمل `stringVal`، و`tagValue` الخاص بها لا معنى له.

القراءة غير الجيدة تحمل `reason` حين يعرف المشغّل السبب، ليستطيع العرض أن يقول أكثر من «رديئة»:

```json
{"deviceId":"meter-01","protocol":"http","tagName":"power","tagValue":0,"quality":"bad","timestamp":"2026-09-30T09:12:04.51Z","reason":"no field at ENERGY.Power"}
```

القراءة الجيدة لا يكون لها ذلك أبدًا، فالعقد أعلاه بايتًا ببايت كما كان. ولا يحتفظ به أرشيف البيانات التاريخية: `/api/history` فيه الجودة لا السبب.

### `GET /api/sparkline`

آخر قراءات وسم واحد المحفوظة في الذاكرة (`HOTLOOP_RING_SIZE`، والافتراضي 30)، للمخططات الصغيرة. `?tag=device/tag`، مطلوب.

```json
{"tag":"extruder-1/Temperature","timestamps":[1790540498609,1790540499246,1790540500246],"values":[0,20.06524581530632,19.933308705395785]}
```

`timestamps` هي ميلي ثانية يونكس. كلاهما `[]` لوسم بلا قراءات. `400` لمفتاح مشوّه.

### `GET /api/board`

أي الوسوم مثبّتة على اللوحة، وفي كم عمودًا. تُخزَّن في قاعدة البيانات لا في المتصفح، لأن اللوحة تخص المصنع: حاسوب اللوحة في الورشة والحاسوب المحمول في المكتب يعرضان اللوحة نفسها.

```json
{"columns":2,"tags":["extruder-1/Temperature","tank-farm/level"],"rev":"9f2c41b07a6d3e58"}
```

`rev` يسمّي اللوحة كما هي مخزَّنة. أعده مع الحفظ فيُرفض الحفظ إذا تغيرت اللوحة منذ ذلك الحين (أدناه).

### `PUT /api/board`

الشكل نفسه. `columns` خارج 1 إلى 4 تصبح 3؛ وتُسقط التكرارات. `rev` اختياري: مع `rev` اللوحة التي قرأتها، يكون الحفظ فوق لوحة تغيرت منذ ذلك الحين `409` ولا يغيّر شيئًا، فلا تستطيع صفحة لم تقرأ اللوحة قط، أو قرأت قديمة، أن تستبدل لوحة المصنع بنسختها. وإن حذفته فلا يُفحص الحفظ، وهذا يناسب عميلًا يضبط اللوحة كلها في كل مرة. تقرأ واجهة الويب اللوحة عند بدئها وترسل `rev` مع كل حفظ. يجب أن يكون كل وسم موجودًا (`404` يسمّي الوسم غير الموجود): المدخل القديم مؤشر لا يتحرك أبدًا. يردّ باللوحة كما خُزِّنت. يملك المشغّلون `board.write`: ترتيب اللوحة تشغيل للمصنع لا تهيئة له.

### `POST /api/write`

يكتب قيمة واحدة إلى وسم واحد، عبر بوابة الكتابة.

| الحقل | النوع | <span class="sr-only">التفاصيل</span> |
|---|---|---|
| `tag` | string | مطلوب. `device/tag` |
| `value` | bool, number or string | مطلوب. `true` قيمة منطقية، و`42` عدد صحيح، و`42.5` عدد عشري، و`"42"` سلسلة: نوع JSON هو النوع المكتوب، لأن الملف (coil) والكلمة (word) والعدد الحقيقي ثلاثة أشياء مختلفة على الخط |
| `reason` | string | اختياري. يُسجَّل مع الكتابة |

```json
{"tag":"tank-farm/level_sp","written":"72.5"}
```

**تكون القيمة بوحدات الوسم، كما هي القراءة.** في وسم له معامل أو إزاحة، ما ترسله هو ما سيقرؤه الوسم عائدًا، ويرسل HotLoop إلى الجهاز العدّ الذي ينتجه: القيمة 55.5 على سجل معامله 0.1 تضع 555 في السجل. (حتى 4.18 كان الرقم يذهب إلى الجهاز كما هو، فيصبح 55.5 هو 55 ويُقرأ عائدًا 5.5.) يستخدم فحص النطاق وصف التدقيق رقمك، بوحدات الوسم. أما العدّ الذي لا يتسع بعد ذلك في السجل، مثل 7000 على `uint16` معامله 0.1، فيُرفض مع تسمية العدّ والسجل، ولا يُرسل شيء. وكسر العدّ يُقتطع، كما كان سجل العدّ الصحيح يفعل دائمًا: القيمة 12.34 على سجل معامله العُشر تحمل 12.3.

تفحص البوابة بالترتيب أن الكتابة مفعّلة (`HOTLOOP_ALLOW_WRITES`) وأن الوسم مفعّل وأن القيمة ضمن النطاق. كل محاولة، مرفوضة أو لا، في `GET /api/writes`.

| الحالة | متى |
|---|---|
| 400 | لا قيمة، أو قيمة `null`، أو مفتاح مشوّه |
| 403 | الكتابة معطلة، أو `"tank-farm/level: this tag is not marked writable"` |
| 404 | لا يوجد وسم كهذا |
| 422 | `"value is outside the tag's configured range: 120 is outside 0..95"` |
| 503 | الجهاز غير متصل |

## السجل التاريخي والتدقيق

### `GET /api/history`

| الاستعلام | <span class="sr-only">التفاصيل</span> |
|---|---|
| `tag` | مطلوب، قابل للتكرار، حتى 50: `?tag=a/x&tag=b/y` |
| `minutes` | إلى أي مدى للخلف من الآن. الافتراضي 60 |
| `bucket` | حجم الفترة بالثواني. الافتراضي: يُختار بحيث تضم النافذة نحو 400 فترة، على سلّم من ثانية واحدة إلى يوم |
| `raw` | `true` للقراءات نفسها بدل الفترات |
| `limit` | الافتراضي 5000، والحد الأقصى 100000 |
| `carry` | `true` ليذكر أيضًا ما كان يحمله كل وسم عند بدء النافذة (للفترات فقط) |

مقسَّمة إلى فترات، الأقدم أولًا لكل وسم. `badCount` هو عدد القراءات في الفترة التي لم تكن بجودة جيدة؛ وهي تُعدّ ولا تدخل في المتوسط. `from` و`to` هما النافذة التي تخصها الاستجابة، بينهما `minutes` بالضبط وتنتهي حين طُرح السؤال:

```json
{"buckets":[{"deviceId":"extruder-1","tagName":"Temperature","bucket":"2026-09-27T20:21:00Z","avg":18.986210570239944,"min":0,"max":20.83008050535897,"first":0,"last":20.83008050535897,"count":22,"badCount":1}],"from":"2026-09-27T19:22:00Z","raw":false,"to":"2026-09-27T20:22:00Z"}
```

يحتفظ أرشيف البيانات التاريخية بقراءة حين تتحرك القيمة خارج نطاقها الميت، لا في كل استطلاع، فالوسم الذي بقي ثابتًا ليس لديه في النافذة ما يُرسم. مع `carry=true` يكون في الاستجابة أيضًا `"carry":[{"deviceId":"extruder-1","tagName":"Temperature","ts":"2026-09-27T16:40:12Z","value":21.4}]`: آخر قراءة قبل `from`، لكل وسم كانت آخر قراءة سابقة له جيدة وفيها رقم. أما الوسم الذي كانت آخر قراءته رديئة أو غير مؤكدة، أو الذي لا قراءة سابقة له، أو الذي هو نص، فليس له مدخل، لأن ما كان يحمله غير معروف ولن نعطي مخططًا تخمينًا. وتُرسَم بطاقة الاتجاه من هذا.

الخام، الأحدث أولًا:

```json
{"raw":true,"readings":[{"deviceId":"extruder-1","protocol":"","tagName":"Temperature","tagValue":21.021559879601448,"quality":"good","timestamp":"2026-09-27T20:22:00.267463Z"}]}
```

`400` بدون `tag`، أو بأكثر من 50، أو بمفتاح مشوّه.

### `GET /api/writes`

تدقيق الكتابة، الأحدث أولًا. كل محاولة هنا، بما فيها المرفوضة، لأن «لا نعرف هل خرج ذلك الأمر» هو أسوأ جواب يمكن أن يتلقاه مصنع.

| الاستعلام | <span class="sr-only">التفاصيل</span> |
|---|---|
| `tag` | وسم واحد، `device/tag` |
| `device` | كل وسم على جهاز واحد (يُتجاهل إن ضُبط `tag`) |
| `entity` | كل كتابة أجراها استدعاء خدمة على هذا الكيان أو رُفضت له، بدل ما سبق |
| `call` | كل كتابة لاستدعاء واحد، بدل كل ما سبق: ضغط زر وتحريره، أو كل هدف من تطبيق وصفة، وهي تشترك في `call_id` الخاص به |
| `limit` | الافتراضي 100، والحد الأقصى 5000 |

```json
[{"id":2,"at":"2026-09-27T20:22:01.04226Z","deviceId":"tank-farm","tagName":"level_sp","value":"120","prior":"0 %","actor":"admin","source":"ui","succeeded":false,"error":"refused: value is outside the tag's configured range: 120 is outside 0..95"},
 {"id":4,"at":"2026-09-27T20:23:03.276962Z","deviceId":"tank-farm","tagName":"pump","value":"true","prior":"0","actor":"admin","source":"ui","succeeded":true,"latencyMs":0.317,"entityId":"switch.tank_farm_pump","service":"switch.turn_on","callId":"5c9f8545a93b5443"}]
```

`source` هي `ui` أو `api` أو `automation` أو `mcp`. و`entityId` و`service` و`callId` موجودة فقط في الكتابات التي أجراها استدعاء خدمة.

## الكيانات والحالات

كل وسم يحصل على كيانات دون أن يطلبها أحد؛ أما الكيانات المركّبة (المحركات والصمامات والحلقات والعدّادات والمحدّدات والأزرار ومحطات الطقس) فيبنيها مسؤول من الوسوم. بصيغة snake_case، كأي نقطة نهاية للكيانات. النموذج كاملًا في [الكيانات](/ar/iot/entities/).

### `GET /api/entities`

كل كيان، بما فيها اليتيمة.

| الاستعلام | <span class="sr-only">التفاصيل</span> |
|---|---|
| `domain` | `sensor` أو `switch` أو `motor`... |
| `device` | كيانات جهاز واحد |
| `orphaned` | `true` لليتيمة فقط، و`false` لعدم إدراج أي منها |
| `q`, `limit` | بحث: سلسلة جزئية، دون تمييز حالة الأحرف، من معرّف الكيان أو الاسم أو معرّف الجهاز، وعدد أقصاه `limit` منها (من 1 إلى 5000، وأي قيمة أخرى `400`، ولا تُقتطع بصمت أبدًا) مرتبة بمعرّف الكيان. `X-Total-Count` هو عدد المطابقات. وإن حُذفا فالقائمة كاملة |

```json
[{"id":5,"entity_id":"switch.tank_farm_pump","unique_id":"tag-control:tank-farm/pump","domain":"switch","platform":"tag","name":"pump","device_id":"tank-farm","options":{},"disabled":false,"hidden":false,"created_at":"2026-09-27T20:21:39.153197Z","updated_at":"2026-09-27T20:21:39.153197Z","bindings":[{"role":"command","device_id":"tank-farm","tag_name":"pump"},{"role":"state","device_id":"tank-farm","tag_name":"pump"}],"equipment_id":null,"area_id":4,"labels":[]}]
```

### `GET /api/entities/composites`

ما يستطيع `POST /api/entities` إنشاءه: كل مجال، والأدوار التي تُربط بها وسومه، والخدمات التي يقبلها. يذكر الدور `kind` الخاص بالوسم، وهل هو `required`، وهل تكتب إليه خدمة (`command`)، وهل تُقرأ الحالة منه (`feedback`). ومحطة الطقس لا تقبل أي خدمة.

```json
{"domains":[{"domain":"weather","roles":[{"role":"temperature","kind":"number","required":true,"command":false,"feedback":true},{"role":"humidity","kind":"number","required":false,"command":false,"feedback":true}],"services":[]}]}
```

### `GET /api/entities/{entity_id}`

`{"entity": {...}, "state": {...}}`. تكون `state` هي `null` لكيان معطّل. `404` لكيان غير معروف.

### `GET /api/entities/{entity_id}/image`

أحدث صورة لكاميرا أو لصورة، بالبايتات التي يحتفظ بها HotLoop: `Content-Type` هو ما هي عليه (`image/jpeg` أو `image/png` أو `image/gif` أو `image/webp`)، مع `X-Content-Type-Options: nosniff` و`Content-Security-Policy` للعزل و`ETag` (يتلقى `If-None-Match` الرمز `304`). `404` لكيان ليس كذلك، أو قبل وصول صورة. سمة `entity_picture` في الحالة هي هذا المسار مع تجزئة الصورة عليه.

### `PUT /api/entities/{entity_id}`

يغيّر الحقول التي ترسلها فقط. للمسؤولين فقط: entity_id هو الاسم الذي تشير به كل أتمتة ولوحة وعميل إلى الكيان، وتغييره تهيئة.

| الحقل | النوع | <span class="sr-only">التفاصيل</span> |
|---|---|---|
| `entity_id` | string | إعادة تسمية. لا يتحرك `unique_id` |
| `name`, `icon`, `device_class`, `state_class`, `unit_of_measurement`, `entity_category` | string | |
| `options` | object | بحسب المجال؛ راجع [الكيانات](/ar/iot/entities/#واجهة-api) |
| `disabled`, `hidden` | bool | الكيان المعطّل لا حالة له ولا يمكن إصدار أوامر إليه |
| `equipment_id` | int or null | يضعه في الشجرة؛ و`null` يجعله يتبع جهازه من جديد |
| `labels` | string[] | المجموعة كاملة |

لا يمكن تغيير `unique_id` و`domain` و`platform` والجهاز والروابط هنا، وإرسالها هو 400.

```json
{"entity":{"id":3,"entity_id":"sensor.tank_1_level","name":"Tank 1 level","device_class":"moisture","icon":"mdi:water-percent","...":"..."},"warnings":[]}
```

تقول `warnings` متى يكون شيء ما مشروعًا لكنه غريب (وحدة لا تملكها فئة الجهاز عادة). `400` لجسم فارغ (`"the update names no field to change"`) أو قيمة سيئة، و`404` لكيان غير معروف، و`409` لـ entity_id مأخوذ.

### `POST /api/entities`

ينشئ كيانًا مركّبًا. يسمّي الجسم المجال ويربط الوسوم بأدواره:

```json
{"name":"Transfer pump","domain":"motor","bindings":[{"role":"run_command","device_id":"tank-farm","tag_name":"pump"},{"role":"running","device_id":"tank-farm","tag_name":"pump"}]}
```

وكذلك `entity_id` (وإلا يُولَّد من الاسم) و`device_class` و`unit_of_measurement` و`icon` و`entity_category` و`options`. الأدوار والخيارات التي يقبلها كل مجال في [الكيانات](/ar/iot/entities/#المعدات-المركّبة). يردّ بـ `201` `{"entity": {...}, "warnings": [...]}`. `400` لمجال لا يُنشأ هنا (`sensor` يأتي من وسمه و`alarm` من تعريفه) أو دور ناقص أو وسم لا يستطيع ملأه، و`409` لـ entity_id مأخوذ.

### `DELETE /api/entities/{entity_id}`

يحذف كيانًا مركّبًا، أو كيانًا يتيمًا اختفى وسمه أو تعريف إنذاره. `{"deleted":"motor.transfer_pump","entity":{...}}`. وأي شيء آخر يردّ بـ `409` ويقول كيف يزول فعلًا:

```json
{"error":"this entity cannot be deleted: sensor.tank_1_level is kept in step with its tag; delete the tag, and then this orphan, or hide or disable it: already exists"}
```

### `GET /api/states`

حالة كل كيان مفعّل، مرتبة بحسب entity_id. يرشّح `?domain=`.

```json
[{"entity_id":"number.tank_farm_level_sp","state":"unknown","attributes":{"armed":true,"friendly_name":"level_sp","max":95,"min":0,"source":["tank-farm/level_sp"],"unit_of_measurement":"%"},"quality":"bad","last_changed":"2026-09-27T20:21:39.417193755Z","last_updated":"2026-09-27T20:21:39.417193755Z","last_reported":"2026-09-27T20:22:04.423849496Z"}]
```

`state` سلسلة دائمًا، حتى للرقم؛ و`unknown` و`unavailable` تعنيان ما تقولان. و`last_reported` هو الطابع الزمني للجهاز للقراءة التي وراءها.

### `GET /api/states/{entity_id}`

حالة واحدة. `404` لكيان غير معروف، و`404` مختلف لكيان معطّل، يقول كيف يُفعَّل: الكيان المعطّل ليس مفقودًا، والإبلاغ عنه مفقودًا يرسل أحدًا للبحث عن خطأ طباعي.

## الطاقة

ما يستهلكه المصنع وكم يكلّف: كيلوواط ساعة والغاز والماء والهواء المضغوط وتكلفة الوحدة المنتَجة. العدّاد وسم يُقرأ بوصفه كمية مستهلكة. النموذج كاملًا والتعرفات وما تفعله الشاشة في [الطاقة](/ar/iot/energy/). القراءة هي `energy.read`، وكل دور يملكها؛ وإنشاء عدّاد أو تعرفة أو تغييرهما هو `energy.write`، لمسؤول.

### `GET /api/energy/meters`

كل عدّاد، بحسب النوع ثم الاسم، ولكلٍّ منها كيف يُقرأ وما استهلكه اليوم.

```json
[{"id":"main","name":"Main panel","kind":"electricity","mode":"counter","source":{"device_id":"pm-01","tag_name":"kWh"},"unit":"kWh","factor":0.001,"tariff":{"currency":"USD","price":0.12,"bands":[{"from":"22:00","to":"06:00","price":0.07}]},"enabled":true,"status":{"state":"ok","last_read_at":"2026-11-19T21:15:00Z","resets":0,"gap_seconds":0},"today":{"value":412.6,"cost":49.51,"covered_seconds":43200,"estimated":false}}]
```

`status.state` هي `ok` أو `waiting` (لم يُقرأ شيء من الوسم بعد) أو `bad` (قراءة الوسم ليست جيدة، ويقول `reason` السبب) أو `disabled`.

### `POST /api/energy/meters`

ينشئ عدّادًا. `id` أحرف صغيرة وأرقام و`-` و`_`. `kind` هو `electricity` أو `gas` أو `water` أو `air` أو `heat` أو `production`. `mode` هو `counter` (وسم تراكمي: ما استُهلك هو مقدار ما تحرّك، مضروبًا في `factor`) أو `power` (معدّل: ما استُهلك هو المعدّل في المدة التي استمر فيها، مع `power_unit` وهي `W` أو `kW` أو `MW`، و`unit` وهي `Wh` أو `kWh` أو `MWh`). `source` هو الوسم. `tariff` هو `price` ثابت لكل وحدة مع `currency` اختيارية، و`bands` اختيارية (`from` و`to` على ربع ساعة، و`days`، و`price`) لتعرفة بحسب أوقات الاستخدام؛ وعدّاد الإنتاج ليس له شيء منها. وعدّاد الكهرباء بوحدة `Wh` أو `kWh` أو `MWh` يمكن أن يكون له أيضًا `demand_price` في التعرفة: ما يكلّفه كيلوواط واحد من أعلى ربع ساعة له في نافذة. وإن حُذف `enabled` فهو `true`. `201` مع `{"meter": {...}, "warnings": []}`. `400` يقول ما الخطأ: الوسم غير موجود أو ليس رقمًا، أو نطاق ليس على ربع ساعة، أو عدّاد قدرة له معامل. `409` لمعرّف مأخوذ.

### `GET /api/energy/meters/{id}`

عدّاد واحد، كما تعرضه القائمة. `404` لعدّاد غير معروف.

### `PUT /api/energy/meters/{id}`

يستبدل تعريف عدّاد. وما عدّه من قبل يبقى، ويحتفظ بالسعر الذي حُسب به. وتوجيهه إلى وسم أو وضع آخر ينسى أين توقفت آخر قراءة، لأن القراءة التالية لشيء آخر.

### `DELETE /api/energy/meters/{id}`

يزيل عدّادًا وكل ما عدّه. `404` لعدّاد غير معروف.

### `GET /api/energy/summary`

استهلاك كل عدّاد وتكلفته على نافذة، وتكلفة الوحدة المنتَجة. النافذة هي `?period=` (`today` و`yesterday` و`this_week` و`last_week` و`this_month` و`last_month` و`last_7_days` و`last_30_days`، أو وردية تُكتب `shift:06:00-14:00` لأحدث وردية بدأت و`last_shift:06:00-14:00` للتي قبلها؛ والأيام والأشهر والورديات هي للموقع) أو `?from=&to=` بصيغة RFC 3339، مع تضمين from واستبعاد to، وبحد أقصى 400 يوم. `meters` قائمة مفصولة بفواصل بالعدّادات التي تدخل تكلفتها في التكلفة لكل وحدة، و`per` يسمّي عدّاد الإنتاج الواحد الذي يُقسَّم عليه.

```json
{"period":"today","from":"2026-11-19T05:00:00Z","to":"2026-11-20T05:00:00Z",
 "meters":[{"id":"main","name":"Main panel","kind":"electricity","unit":"kWh","currency":"USD","value":412.6,"cost":49.51,"covered_seconds":43200,"coverage":1,"estimated":false}],
 "costs":[{"currency":"USD","cost":49.51}],
 "per_unit":[{"production":"parts","units":9800,"currency":"USD","cost":49.51,"cost_per_unit":0.00505}]}
```

`coverage` هي حصة النافذة حتى الآن التي تدعمها القراءات. لا تُجمع التكاليف بعملتين أبدًا، ولذلك يوجد صف `per_unit` لكل عملة. و`cost_per_unit` هي `null` حين لم يُصنع شيء (`reason` هي `nothing_made`) أو حين صُنعت أشياء ولم يعدّ أي عدّاد له سعر استهلاكًا بعد (`nothing_counted`): هذا ليس جوابًا، وليس صفرًا.

العدّاد الذي له `demand_price` فيه `demand` في صفه: `peak_kw` (أعلى ربع ساعة في النافذة، بعدد الكيلوواط الذي بلغه في المتوسط)، و`peak_at` (متى بدأ)، و`peak_covered_seconds` (كم من ذلك الربع ساعة قُرئ؛ وما دون 900 تكون الذروة مقدَّرة بأقل من حقيقتها)، و`cost` (الذروة مضروبة في السعر). ويبقى `cost` الخاص بالصف ما كلّفته الطاقة؛ أما `costs` و`per_unit` فتشمل رسم الطلب.

### `GET /api/energy/summary/{period}`

مثل الملخص، على فترة مسمّاة واحدة (أو وردية) تُعطى في المسار. وتبقى `meters` و`per` في الاستعلام.

### `GET /api/energy/series`

استهلاك عدّاد واحد على نافذة، `?meter=<id>`، والنافذة كما سبق، و`step`: `quarter` (بحد أقصى 8 أيام) أو `hour` (الافتراضي) أو `day` أو `month`. والخطوة التي لا قراءات فيها لا تظهر في القائمة.

```json
{"meter":"main","unit":"kWh","currency":"USD","step":"day","points":[{"start":"2026-11-19T05:00:00Z","value":412.6,"cost":49.51,"estimated":false}]}
```

### `GET /api/energy/series/{meter}/{period}/{step}`

مثل السلسلة، مع العدّاد والفترة المسمّاة والخطوة كلها في المسار، لمن لا يملك سوى مسار يعطيه.

## الخدمات

### `POST /api/services/{domain}/{service}`

يصدر أمرًا إلى كيان واحد: `switch/turn_on` و`number/set_value` و`motor/start` و`alarm/acknowledge`. كيان واحد، وخدمة واحدة، واستدعاء واحد. وتحت ذلك ليس إلا عمليات كتابة وسوم عبر بوابة الكتابة نفسها التي يمر بها `POST /api/write`.

```json
{"entity_id":"switch.tank_farm_pump","reason":"start of shift"}
```

`entity_id` مطلوب وهو كيان واحد، لا قائمة؛ و`reason` اختياري؛ وكل ما عدا ذلك بيانات الخدمة (`value` و`option` و`position` و`mode` و`minutes` و`note`). تحتفظ الأرقام بالنوع الذي كُتبت به. ويجب أن يكون المجال في المسار هو مجال الكيان. كل خدمة وبياناتها في [الكيانات](/ar/iot/entities/#ما-يقبله-كل-نطاق).

```json
{"call_id":"5c9f8545a93b5443","entity_id":"switch.tank_farm_pump","service":"switch.turn_on","writes":[{"tag":"tank-farm/pump","value":"true","status":"written"}]}
```

كل كتابة هي `written` أو `not_sent` (رُفضت قبل أن تصل إلى الجهاز) أو `failed` (خرجت وأبلغ الجهاز عن خطأ، فلا يُعرف هل نفذت) أو `skipped` (كتابة سابقة في الاستدعاء لم تنجح). ولا تُتراجع الكتابات التي تمت أبدًا. وخدمات كيان الإنذار لا تكتب وسمًا وتردّ بـ `alarm` كما تركه المحرك. وخدمات الـ helper لا تكتب وسمًا كذلك وتردّ بـ `state` الذي تركته عليه:

```json
{"call_id":"0f3c2a1b9d8e7f60","entity_id":"input_number.batch_target","service":"input_number.set_value","writes":[],"state":"1250"}
```

يشغّل `turn_on` الخاص بسكربت السكربت، مع البيانات كحقوله، ويردّ بـ `script_run` الذي بدأه؛ وتُدقَّق كتابات خطواته واحدة واحدة بوصفها `script:<id>`، لا هنا. ويوقف `turn_off` كل تشغيل له. راجع [السكربتات](#السكربتات).

يطبّق `turn_on` الخاص بمشهد وصفته، مع `params` و`version` من البيانات، ويردّ بـ `recipe_application` كاملًا، وفي `writes` بكل كتابة أجرتها أهدافه، بالترتيب. ويفشل ما لم تُكتب كل الأهداف. راجع [الوصفات](#الوصفات).

الاستدعاء الفاشل يردّ بحالة الخطأ والجسم نفسه مضافًا إليه `error`، لترى بالضبط أين توقف:

```json
{"error":"value is outside the tag's configured range: 150 is outside 0..95","call_id":"3cd42f8275e5765e","entity_id":"number.tank_farm_level_sp","service":"number.set_value","writes":[{"tag":"tank-farm/level_sp","value":"150","status":"not_sent","error":"value is outside the tag's configured range: 150 is outside 0..95"}]}
```

| الحالة | متى |
|---|---|
| 400 | لا `entity_id`، أو مجال خاطئ، أو خدمة غير معروفة، أو بيانات لا تقبلها الخدمة |
| 403 | الصلاحية، أو رفضت البوابة بحكم السياسة |
| 404 | لا يوجد كيان كهذا |
| 409 | تبديل بلا حالة معروفة، أو معدات في حالة خاطئة للخدمة |
| 422 | قيمة رُفضت لذاتها |
| 503 | الجهاز غير متصل؛ محرك الإنذارات لا يعمل |
| 500 | خرجت ضغطة زر ولم يخرج تحريرها. **قد يظل الوسم يحمل قيمة الضغط**: افحصه وحرّره يدويًا |

**`?dry_run=true`** يسأل ماذا سيفعل الاستدعاء ولا يفعل شيئًا من ذلك: لا يُكتب ولا يُدقَّق ولا يُسجَّل شيء. يُخطَّط الاستدعاء كما يُخطَّط الحقيقي وتُعرض كل كتابة على فحوص البوابة نفسها، بالترتيب نفسه، الآن. ويردّ الحكم بـ 200، رُفض أو لا: كل كتابة `would_write`، أو أول كتابة كانت ستُرفض `not_sent` مع السبب والبقية `skipped`، و`error` هو الخطأ الذي كان سيفشل به الاستدعاء الحقيقي، كلمة بكلمة.

```json
{"dry_run":true,"error":"value is outside the tag's configured range: 150 is outside 0..95","entity_id":"number.tank_farm_level_sp","service":"number.set_value","writes":[{"tag":"tank-farm/level_sp","value":"150","status":"not_sent","error":"value is outside the tag's configured range: 150 is outside 0..95"}]}
```

الطلب الذي كان الاستدعاء الحقيقي سيرده قبل أي فحص (لا كيان كهذا، أو خدمة غير معروفة، أو بيانات لا تقبلها الخدمة، أو تبديل بلا حالة معروفة) يردّ بحالة الاستدعاء الحقيقي وخطئه؛ وكذلك غياب الصلاحية. و`dry_run` هي `true` أو `false` ولا شيء غير ذلك: `yes` هي 400، لا تخمين، لأن التخمين الخاطئ يحوّل السؤال إلى أمر. راجع [الكيانات](/ar/iot/entities/#السؤال-أولًا-التشغيل-التجريبي).

**لماذا تُفحص الصلاحية في المعالج.** يحتاج إلى `values.write`، كما في الكتابة المباشرة على الوسم، لأن هذا هو كل ما هو عليه؛ وخدمات كيان `alarm` تحتاج بدلًا من ذلك إلى `alarms.ack`، كشاشة الإنذارات، وخدمات الـ helper تحتاج إلى `helpers.write` الذي يملكه المشغّل، وخدمات السكربت تحتاج إلى `scripts.run`، كما في `POST /api/scripts/{id}/run`، وخدمات المشهد تحتاج إلى `recipes.apply` وإلى صلاحية الوصفة نفسها حين تسمّي واحدة، كما في `POST /api/recipes/{id}/apply`. يُجرى الفحص داخل المعالج لا أمامه حتى يُرسَل الرفض بسبب غيابها إلى بوابة الكتابة و**يُدقَّق مقابل الكيان** كأي رفض آخر، مع القيمة التي طُلبت. والمستخدم الذي لا يملك الصلاحية يحصل على 403 وسطر في `GET /api/writes?entity=...`، لا 403 ولا شيء. والـ helper لا يكتب وسمًا، فرفض الـ helper، بما فيه هذا، تحذير بدلًا من ذلك في سجل النظام (`GET /api/events`) بحق الـ helper، وكذلك السكربت. ورفض المشهد تطبيق مرفوض في سجل الوصفة، مع المستخدم عليه.

## المساعدات

قيم تخص العاملين في المصنع لا وحدة PLC: `input_boolean` و`input_number` و`input_select` و`input_text` و`input_counter` و`timer` و`schedule`. المساعد كيان (المنصة `helper`) ويظهر في `/api/entities` و`/api/states` مثل أي كيان آخر؛ وهذه المسارات هي إعداداته. تُضبط قيمته عبر الخدمات أعلاه، بالصلاحية `helpers.write`. كل نطاق وخيار وخدمة موجود في [المساعدات](/ar/iot/helpers/).

### `GET /api/helpers`

كل المساعدات، ومع كل واحد حقول كيانه و`value`، أي الصف المخزَّن له:

```json
[{"id":41,"entity_id":"timer.purge","unique_id":"helper:6f1d...","domain":"timer","platform":"helper","name":"Purge","options":{"duration_sec":600},"...":"...","value":{"state":"active","finishes_at":"2026-09-27T21:10:00Z","duration_ms":600000,"changed_at":"2026-09-27T21:00:00Z","changed_by":"otto","source":"ui","call_id":"9a1b...","rev":4}}]
```

### `POST /api/helpers`

ينشئ مساعدًا بقيمته الابتدائية. للمسؤولين فقط.

```json
{"name":"Batch target","domain":"input_number","unit_of_measurement":"kg","options":{"min":0,"max":5000,"step":50,"initial":1000}}
```

وأيضًا `entity_id` (يُولَّد من الاسم إن حُذف) و`icon`. يردّ `201` `{"helper": {...}}`. و`400` لنطاق ليس لمساعد، أو خيار لا يقبله النطاق، أو `initial` كانت خياراته نفسها سترفضه؛ و`409` لـ entity_id مستخدم.

### `GET /api/helpers/{entity_id}`

مساعد واحد، كما في القائمة. `404` لكيان غير معروف أو ليس مساعدًا.

### `PUT /api/helpers/{entity_id}`

يغيّر `name` أو `icon` أو `unit_of_measurement` أو `options` أو `disabled` أو `hidden` أو `entity_id` أو `equipment_id` أو `labels`، وهي الحقول نفسها في `PUT /api/entities/{entity_id}`. للمسؤولين فقط. الخيارات الجديدة التي لا تسمح بالقيمة التي يحملها الآن (نطاق ضُيّق إلى ما دونها، أو أُزيل الخيار المحدد) تعطي `400`: فالقيمة لا تُنقل أبدًا لتلائم. يردّ `{"helper": {...}, "warnings": []}`.

### `DELETE /api/helpers/{entity_id}`

يحذف المساعد وقيمته. للمسؤولين فقط. `{"deleted":"timer.purge"}`. يرفض `DELETE /api/entities/{entity_id}` مساعدًا برمز `409` يشير إلى هنا.

## المعدات والتسميات

شجرة ISA-95 (المؤسسة، الموقع، المنطقة، الخط، الخلية، الوحدة، المعدّة) والتسميات الحرة. بصيغة snake_case. تقرأ كل الأدوار؛ ولا يغيّر إلا المسؤول، لأن إعادة تسمية عقدة أو نقلها تعيد كتابة الموقع والمنطقة والخط لكل جهاز تحتها. راجع [شجرة المعدات والتسميات](/ar/iot/equipment/).

### `GET /api/equipment`

كل العقد، مرتبة حسب id، ومع كل عقدة `path` من الأسماء من الجذر. `?level=area` يصفّي. `?q=` يُبقي العقد التي يحوي مسارها النص (دون تمييز بين الحروف الكبيرة والصغيرة)، و`?limit=` (من 1 إلى 5000، وأي قيمة أخرى هي `400`) أول ما يطابق منها؛ ومع أي منهما يكون `X-Total-Count` عدد ما طابق.

```json
[{"id":4,"parent_id":1,"level":"area","name":"Utilities","created_at":"2026-09-27T20:21:01.637319Z","updated_at":"2026-09-27T20:21:01.637319Z","path":["Demo Plant","Utilities"]}]
```

### `POST /api/equipment`

```json
{"parent_id":3,"level":"cell","name":"Die head","description":"Die and screen changer"}
```

`parent_id` بقيمة null أو محذوفًا ينشئ جذرًا. يجب أن يكون الابن في مستوى أدنى من أبيه (يمكن أن توجد معدّة داخل معدّة). يردّ `{"equipment": {...}, "devices_rewritten": []}`. `400` لمستوى أو موضع غير صحيح، و`409` لشقيق بالمستوى والاسم نفسيهما.

### `GET /api/equipment/{id}`

العقدة، والعقد الواقعة مباشرة تحتها، والأجهزة والكيانات الموضوعة مباشرة عليها:

```json
{"children":[],"devices":["extruder-1"],"entities":[],"equipment":{"id":3,"parent_id":2,"level":"line","name":"Line 1","...":"...","path":["Demo Plant","Extrusion","Line 1"]}}
```

`400` لـ id ليس عددًا موجبًا، و`404` لمعرّف غير معروف.

### `PUT /api/equipment/{id}`

أي من `name` أو `description` أو `level` أو `parent_id` (`null` ينقلها إلى الجذر). تتغير الحقول المرسلة فقط؛ والجسم الفارغ هو 400. يردّ العقدة و**كل جهاز تغيّر نص موقعه أو منطقته أو خطه نتيجة لذلك**، لأن هذا النص هو ما تقرؤه العملاء الأقدم وأدوات MCP:

```json
{"devices_rewritten":["tank-farm"],"equipment":{"id":4,"parent_id":1,"level":"area","name":"Utilities East","...":"..."}}
```

### `DELETE /api/equipment/{id}`

`{"deleted":5}`. `409` ما دام تحتها أو عليها شيء، مع بيان ما هو: حذف عقدة من تحت قدمي جهاز ليس قرارًا يُتخذ بالخطأ.

### `GET /api/labels`

```json
[{"label_id":"critical","name":"Critical","color":"red","icon":"mdi:alert","description":"Stops the line if it fails","created_at":"2026-09-27T20:24:29.659126Z","updated_at":"2026-09-27T20:24:29.659126Z"}]
```

### `POST /api/labels`

`name` مطلوب؛ و`label_id` (من 1 إلى 64 حرفًا صغيرًا وأرقامًا وشرطات سفلية) يُولَّد من الاسم إن حُذف، ولا يتغير بعد ذلك أبدًا. `color` و`icon` (`mdi:...`) و`description` اختيارية. يردّ التسمية. `409` لاسم أو id مستخدم.

### `GET /api/labels/{label_id}`

`{"label": {...}, "devices": ["tank-farm"], "entities": []}`: التسمية وما يحملها. `404` لتسمية غير معروفة.

### `PUT /api/labels/{label_id}`

يستبدل `name` و`color` و`icon` و`description`؛ والحقل المحذوف يُمسح. يجب أن يطابق `label_id` في الجسم المسار: وإلا `400`، لأن label_id لا يتغير أبدًا.

### `DELETE /api/labels/{label_id}`

يزيلها من كل ما يحملها. `{"deleted":"critical"}`، أو `404`.

### `PUT /api/devices/{id}/labels`

`{"labels": ["critical"]}` يستبدل المجموعة كلها على جهاز. يردّ `{"id":"tank-farm","labels":["critical"]}`. يجب أن توجد كل تسمية (`400` مع أسماء الناقصة)، وأن يوجد الجهاز أيضًا (`404`). التسميات ليست جزءًا من `POST /api/devices` عن قصد: فكل عميل يحفظ جهازًا يرسل الجهاز كاملًا بدونها، وكان سيمسحها عند كل حفظ.

## الإنذارات

ISA-18.2: التفعيل والإقرار والعودة إلى الوضع الطبيعي أمور منفصلة، ويستطيع السجل أن يبيّن أيّها حدث.

### `GET /api/alarms`

كل التعريفات والإنذارات الحية والملخص. `?outstanding=true` يستبعد الإنذارات الطبيعية والمكتومة.

```json
{
  "alarms": [{"definitionId":"extruder-temp-hi","name":"Extruder temperature high","deviceId":"extruder-1","tagName":"Temperature","priority":2,"state":"unack-active","message":"extruder-1/Temperature at 22.80197037650447 C, limit 5","tripValue":22.80197037650447,"raisedAt":"2026-09-27T20:25:19.67042816Z","count":1,"updatedAt":"2026-09-27T20:25:19.67042816Z"}],
  "definitions": [{"id":"extruder-temp-hi","name":"Extruder temperature high","deviceId":"extruder-1","tagName":"Temperature","condition":"hi","limit":5,"priority":2,"enabled":true,"deadband":0.5,"message":"{device}/{tag} at {value}, limit {limit}","createdAt":"2026-09-27T20:25:19.055658Z","updatedAt":"2026-09-27T20:25:19.055658Z"}],
  "summary": {"critical":0,"high":1,"medium":0,"low":0,"unacked":1,"total":1}
}
```

`state` هو `normal` أو `unack-active` أو `ack-active` أو `rtn-unack` (عاد إلى الوضع الطبيعي قبل أن يقرّ به أحد، ويبقى في القائمة كي لا يختفي إنذار الساعة الثالثة فجرًا قبل أن تراه وردية الصباح) أو `shelved` أو `suppressed`. `tripValue` هي القراءة التي فعّلته، لا القراءة الحالية.

### `POST /api/alarms`

ينشئ تعريفًا أو يستبدله.

| الحقل | النوع | <span class="sr-only">التفاصيل</span> |
|---|---|---|
| `id`, `name` | string | مطلوب. يتبع `id` قواعد معرّفات الأجهزة |
| `deviceId`, `tagName` | string | مطلوب |
| `condition` | string | `hihi` و`hi` و`lo` و`lolo` و`eq` و`ne` و`true` و`false` و`bad-quality` و`stale` (لا قراءة طوال `limit` ثانية) و`roc` (معدل تغير يتجاوز `limit` في الثانية) |
| `limit` | number | |
| `priority` | int | من 1 (حرجة) إلى 4 (منخفضة) |
| `enabled` | bool | إن حُذف فهو `false` |
| `deadband` | number | إلى أي مدى يجب أن تتراجع القيمة قبل أن يعود الإنذار إلى طبيعته. وبدون نطاق ميت تتذبذب القيمة الواقفة على الحد |
| `onDelaySec`, `offDelaySec` | int | كم يجب أن يستمر الشرط قبل أن يُفعَّل الإنذار، أو أن يغيب قبل أن يعود إلى الوضع الطبيعي |
| `message`, `description` | string | يقبل `message` القيم `{value}` و`{limit}` و`{tag}` و`{device}` و`{unit}` و`{condition}` و`{reason}` (سبب سوء القراءة، وهو فارغ إذا كانت جيدة) |

تُكتب `{value}` بالطريقة التي تكتبها بها بطاقة القيمة، مع الوحدة: الأعداد الصحيحة كما هي، ومنزلتان عشريتان من 1 فصاعدًا، ومنزلة واحدة من 100 فصاعدًا، وأربع منازل دون 1، والتدوين العلمي فوق عشرة ملايين أو دون 0.01 (`8.20 pH` و`212.5 F` و`1.235e+7`). فعلنا ذلك لأن وسمًا بمقياس 0.1 وقيمة خام 82 هو 8.200000000000001 كعدد عشري، وكانت اللافتة تعرضه هكذا. وتُذكر القراءة النصية كما هي. يرى الوسم وعمليات الكتابة والأتمتة العدد الدقيق دائمًا؛ والجملة وحدها هي التي تُقرَّب. `{limit}` هو الحد كما كتبته.

يردّ التعريف؛ يُعاد تحميل المحرك ويُنشأ كيان الإنذار قبل الرد. `400` عند فشل التحقق (`"alarm x: priority must be 1-4, got 9"`).

### `POST /api/alarms/import/codesys`

يقرأ من جسم الطلب الملف الذي يكتبه Export Alarms في CODESYS IDE (تصدير مجموعة إنذارات، `.csv`)، كما كتبته الـ IDE (UTF-16 مع علامة ترتيب البايتات) أو بصيغة UTF-8. `?deviceId=` هو جهاز PLC وهو مطلوب. `?application=` هو اسم التطبيق الذي تقع وسومه تحته، و`Application` إن حُذف: يسمّي التصدير المتغير بحسب GVL الخاص به (`GVL_Alarm.bPumpFault`) والوسم هو `Application.GVL_Alarm.bPumpFault`. `?defaultPriority=` (من 1 إلى 4) هي أولوية إنذار ليست فئته Error أو Warning أو Info. بدون `?apply=true` لا يُحفظ شيء: يبيّن الرد ما كان سيُستورد.

تعرض شاشة الإنذارات هذا باسم الاستيراد من CODESYS (للمسؤولين فقط): اختر الجهاز، وسمِّ التطبيق، واختر الملف، واقرأ المعاينة، ثم استورد.

تصبح الإنذارات الرقمية المقارنة بـ `= TRUE` أو `= FALSE` هي `true` و`false`، ويصبح UpperLimit مع `>` هو `hi`، ويصبح LowerLimit مع `<` هو `lo`، ويصبح إنذار Outside range (`OutOfArea`، بالمشغّلين `<` معًا) إنذارين، `lo` عند الحد الأدنى و`hi` عند الحد الأعلى، وتُنقل الرسالة وتأخيرا التشغيل والإيقاف (زمن IEC مثل `T#5s`)، ويكون Error بالأولوية 2 وWarning بالأولوية 3 وInfo بالأولوية 4. أي شيء آخر تستطيع الـ IDE كتابته لا يُقرأ ويعود في `skipped` مع صفّه وسببه، لأن CODESYS لا توثّق التخطيط ولا يُقرأ إلا ما أظهره تصدير حقيقي. ويشمل ذلك بقية ما تقدمه الـ IDE: Inside the range (`ForbiddenArea`) صحيح فقط بين حدّين وللإنذار هنا حد واحد، وChange ليس له مدة موثقة، وEvent وAlarm (API) يفعّلهما برنامج PLC وليس لهما متغير يُراقب. يسرد `warnings` ما نُقل جزئيًا فقط (فئة غير معروفة، أو التثبيت، أو إنذار ذي أولوية أعلى).

```json
{"applied": false, "version": "2.0.0.0",
 "alarms": [{"id":"codesys-GVL_Alarm.rTemp-hi","name":"Temperature high","deviceId":"plc1","tagName":"Application.GVL_Alarm.rTemp","condition":"hi","limit":90,"priority":3,"enabled":true,"message":"Temperature high"}],
 "skipped": [{"row":5,"id":"3","reason":"the observation type \"Deviation\" has not been seen in an export, so it is not read"}],
 "warnings": []}
```

`404` لجهاز غير معروف، و`400` لملف ليس تصدير مجموعة إنذارات.

### `DELETE /api/alarms/{id}`

`{"deleted":"extruder-temp-hi"}`، أو `404`.

### `POST /api/alarms/{id}/ack`

جسم اختياري `{"note": "checking the heater bands"}`. يُرجع الإنذار بحالته الآن، مع `ackedBy` و`ackNote`. `404` لإنذار غير معروف.

### `POST /api/alarms/{id}/shelve`

`{"minutes": 30}`، مطلوب وموجب: الإسكات غير المحدد هو كبت، وهذا شيء آخر وليس من شأن المشغّل. يُرجع الإنذار، مع `state` بقيمة `shelved`، ومعه `shelvedUntil` و`shelvedBy`.

### `POST /api/alarms/{id}/unshelve`

بلا جسم. يُرجع الإنذار إلى الحالة التي يحددها شرطه. `409` إذا لم يكن مؤجلاً.

### `GET /api/alarms/events`

سجل تدقيق الإنذارات، الأحدث أولاً. `?alarm=` تعريف واحد، `?limit=` (الافتراضي 200، بحد أقصى 5000).

```json
[{"id":2,"definitionId":"extruder-temp-hi","type":"acked","fromState":"unack-active","toState":"ack-active","value":23.192472931395088,"message":"extruder-1/Temperature at 22.80197037650447 C, limit 5","actor":"admin","note":"checking the heater bands","at":"2026-09-27T20:25:22.920251Z"}]
```

`type` هو `raised` أو `acked` أو `cleared` أو `shelved` أو `unshelved` أو `suppressed` أو `unsuppressed` أو `escalated` أو `escalation-ended`. الأخيران يكتبهما تصعيد الإنذارات (`actor` هو `escalation`)، وتذكر `note` فيهما من أُبلغ ولماذا توقفت السلسلة. راجع [إشعارات الإنذارات](/ar/iot/notifications/#التصعيد).

## الأتمتة

المشغّلات، وشرط، وإجراءات. لغة القواعد موجودة في [الأتمتة](/ar/iot/automations/).

### `GET /api/automations`

```json
{"armed":{"fill-tank":true},"automations":[{"id":"fill-tank","name":"Fill the tank","enabled":true,"triggers":[{"type":"threshold","deviceId":"tank-farm","tagName":"level","threshold":20,"direction":"falling","hysteresis":5},{"type":"webhook","webhookPath":"fill-now"}],"actions":[{"type":"call_service","name":"start the pump","params":{"service":"switch.turn_on","entityId":"switch.tank_farm_pump"}}],"mode":"skip","minIntervalSec":60,"createdAt":"2026-09-27T20:26:49.770826Z","updatedAt":"2026-09-27T20:26:49.770826Z"}],"webhooks":["fill-now"]}
```

`armed` يبيّن القواعد التي تعمل فعلاً، وهذا ليس مثل `enabled`: القاعدة الممكّنة التي توقفت عن التجميع ليست مسلّحة، وهنا تكتشف ذلك.

### `POST /api/automations`

ينشئ قاعدة أو يستبدلها: `id` و`name` و`description` و`enabled` و`triggers` (واحد على الأقل) و`condition` و`actions` (إجراء واحد على الأقل) و`mode` (`skip` الافتراضي، أو `queue` أو `restart` أو `parallel`) و`minIntervalSec` و`maxRuntimeSec`. تُجمَّع القاعدة قبل حفظها، والتي لا تُجمَّع تعطي 400 ولا تصل أبداً إلى قاعدة البيانات: القاعدة المحفوظة التي لا يمكن تسليحها هي قاعدة يظن كاتبها أنها تعمل.

```json
{"error":"automation fill-tank action 1 (call_service): params: json: unknown field \"entity_id\""}
```

### `POST /api/automations/validate`

يجمّع قاعدة دون حفظها، للفحص المباشر في المحرر. دائماً `200`؛ والرد يقول إن كانت قد جُمّعت:

```json
{"valid":true}
{"error":"automation bad: at least one trigger is required","valid":false}
```

يحتاج إلى `automations.write` لأنه موجود لمساعدة أحدهم على كتابة قاعدة.

### `DELETE /api/automations/{id}`

`{"deleted":"fill-tank"}`، أو `404`.

### `POST /api/automations/{id}/enabled`

`{"enabled": false}` ينزع تسليحها دون حذفها. يُرجع `{"enabled":false,"id":"fill-tank"}`، أو `404`.

### `POST /api/automations/{id}/trigger`

يشغّلها الآن، كأن مشغّلاً قد انطلق. يظل الشرط سارياً (الشرط الخاطئ يسجّل تشغيلاً `skipped`) وكذلك وضع التشغيل؛ أما `minIntervalSec` فلا ينطبق، لأن شخصاً يطلب تشغيلاً ليس وسماً يتذبذب. بلا جسم. `202` `{"triggered":"fill-tank"}`: يجري التشغيل في الخلفية، وتجد النتيجة في `GET /api/runs`. `400` إذا لم تكن القاعدة مسلّحة. يملك المشغّلون `automations.trigger`؛ تشغيل قاعدة كتبها غيرك هو تشغيل للمصنع، وكتابة قاعدة ليست كذلك.

### `GET /api/runs`

سجل التشغيلات، الأحدث أولاً. `?automation=` قاعدة واحدة، `?limit=` (الافتراضي 100، بحد أقصى 1000). `[]` عندما لا يوجد شيء.

```json
[{"id":1,"automationId":"fill-tank","status":"succeeded","triggerType":"manual","triggerDesc":"triggered by admin","actor":"admin","startedAt":"2026-09-27T20:26:50.269792Z","finishedAt":"2026-09-27T20:26:50.282129Z","durationMs":12.337,"steps":[{"index":1,"type":"call_service","name":"start the pump","input":"switch.turn_on switch.tank_farm_pump {}","output":"true to tank-farm/pump: written; call 8fb9538c82d532be","startedAt":"2026-09-27T20:26:50.272532641Z","durationMs":9.595}]}]
```

`status` هو `running` أو `succeeded` أو `failed` أو `skipped` أو `timed_out` أو `cancelled`. تحتفظ الخطوات بالمدخلات بعد حلها، لا بالقوالب، لأن هذا ما تحتاج إلى قراءته في الثالثة فجراً.

القاعدة المنشأة من blueprint تحمل ثلاثة حقول إضافية في `GET /api/automations`: `blueprintId` و`blueprintVersion` (الإصدار الذي أُنشئت منه، وهو الإصدار الذي تبقى عليه) و`blueprintInputs`. والقاعدة المكتوبة يدوياً لا تحمل أياً منها. هي من شأن الخادم: يقبلها `POST /api/automations` ويتجاهلها، والتعديل اليدوي يحتفظ بما كان للقاعدة.

### `POST /api/automations/{id}/blueprint-upgrade`

ينقل قاعدة منشأة من blueprint إلى أحدث إصدار من الـ blueprint، مع الإبقاء على معرّفها واسمها وكونها مسلّحة. لا يحدث ذلك من تلقاء نفسه أبداً. يملك المشغّلون `blueprints.apply`، مثل إنشاء واحدة. انظر أولاً: **`?dry_run=true`** لا يغيّر شيئاً ويجيب عمّا سيتغير، جزءاً جزءاً، وما الذي ستفعله القاعدة لو انطلقت الآن، مع عرض كل كتابة على فحوص بوابة الكتابة:

```json
{"dry_run":true,"id":"pump_1_watch","blueprint":"pump_watch","from":1,"to":2,"changes":[{"field":"actions","before":[{"params":{"message":"switch.pump_1 started, v1"},"type":"log_event"}],"after":[{"params":{"message":"switch.pump_1 started, v2"},"type":"log_event"}]}],"automation":{"id":"pump_1_watch","...":"..."},"check":{"automation_id":"pump_1_watch","steps":[{"step":"1","type":"log_event","verdict":"not_checked","detail":"a dry run checks writes to equipment; this step writes to none and runs only for real"}]}}
```

التعديل اليدوي الذي جرى منذ إنشاء القاعدة يظهر في `changes` على أنه سيُستبدل. وعندما يحتاج الإصدار الجديد إلى مدخل لا توجد له قيمة في القاعدة، أو يرفض قيمة أُنشئت بها، تقول التجربة ذلك في `error` ولا شيء غيره.

التنفيذ الفعلي يأخذ `{"version": 2}`، وهو الإصدار الذي أظهرته التجربة، و`inputs` لكل ما يحتاجه الإصدار الجديد. blueprint تقدّم منذ ذلك الحين، أو قاعدة رقّاها أحدهم في الأثناء، يعطي `409`: ما روجع هو ما يدخل، وإلا فلا يدخل شيء. المدخل الناقص يعطي `400`. `200` بالشكل نفسه، حيث `automation` هي القاعدة كما حُفظت. يُسجَّل بصيغة `automation upgraded from blueprint pump_watch version 1 to 2`. مع الإصدار نفسه و`inputs` جديدة، هذه هي طريقة تغيير مدخلات القاعدة. `400` لقاعدة مكتوبة يدوياً؛ و`404` إذا لم يعد الـ blueprint الذي جاءت منه موجوداً.

## السكربتات

تسلسلات إجراءات مسمّاة، تُشغَّل عند الطلب: من هنا، أو من خطوة `call_script` في قاعدة، أو من `run_script` في MCP، أو عبر كيان السكربت (`script.turn_on`). التسلسل هو لغة الأتمتة. كل كتابة تجريها خطوة تمر عبر بوابة الكتابة بصيغة `script:<id>`، مع مصدر من بدأها. كل شيء في [السكربتات](/ar/iot/scripts/).

### `GET /api/scripts`

كل سكربت، مع عدّادات تشغيله وعدد تشغيلاته الجارية الآن، في أي عملية:

```json
[{"id":"cip_cycle","name":"CIP cycle","fields":[{"name":"minutes","type":"number","required":true,"min":1,"max":60,"unit":"min"}],"sequence":[{"type":"call_service","params":{"entityId":"switch.cip_pump","service":"switch.turn_on"}}],"mode":"skip","createdAt":"2026-09-28T10:00:00Z","updatedAt":"2026-09-28T10:00:00Z","lastRun":"2026-09-28T10:05:00Z","lastStatus":"succeeded","runCount":3,"running":0}]
```

### `POST /api/scripts`

ينشئ واحداً. للمسؤولين فقط. `id` (أحرف صغيرة وأرقام وشرطات سفلية، يبدأ بحرف: هو معرّف كائن الكيان، `script.<id>`) و`name` و`description` و`icon` و`fields` (مدخلات ذات أنواع) و`sequence` (إجراء واحد على الأقل) و`mode` (`skip` الافتراضي، أو `queue` أو `restart` أو `parallel`) و`maxRuntimeSec`. يُجمَّع قبل حفظه، مثل القاعدة، ويُرفض سكربت قد يستدعي نفسه، مباشرة أو عبر سكربتات أخرى. يرد بـ `201` مع السكربت. `400` لما لا يُجمَّع؛ و`409` لمعرّف مأخوذ.

### `POST /api/scripts/validate`

يفحص سكربتاً دون حفظه، للفحص المباشر في المحرر. `200` `{"valid":true}` أو `{"valid":false,"error":"..."}`، بالكلمات نفسها التي كان سيُرفض بها الحفظ.

### `GET /api/scripts/{id}`

سكربت واحد، كما في القائمة. `404` إن لم يوجد.

### `PUT /api/scripts/{id}`

يستبدل تعريفه؛ الجسم هو نفسه عند الإنشاء، ويمكن حذف `id`. للمسؤولين فقط. تُلغى تشغيلاته الجارية عندما تتغير خطواته أو حقوله أو وضعه: فقد بدأت من التعريف القديم.

### `DELETE /api/scripts/{id}`

يحذفه مع سجل تشغيلاته، ويلغي تشغيلاته الجارية. للمسؤولين فقط. `{"deleted":"cip_cycle"}`. يصبح كيانه يتيماً ولا يُحذف.

### `POST /api/scripts/{id}/run`

يشغّله. يملك المشغّلون `scripts.run`.

```json
{"fields":{"minutes":20},"reason":"end of shift clean","wait":false}
```

كل حقل في الجسم اختياري، والجسم نفسه كذلك. تُفحص الحقول مقابل حقول السكربت قبل أن يعمل أي شيء: القيمة خارج النطاق، أو خارج خطوتها، أو ليست من الخيارات، أو من نوع خاطئ تعطي `400`، ولا تُحرَّك أبداً لتناسب. `202` مع التشغيل بمجرد أن يبدأ؛ ومع `"wait":true` يرد `200` مع التشغيل بعد انتهائه، بما فيه أثره.

```json
{"run":{"id":77,"scriptId":"cip_cycle","status":"running","actor":"otto","source":"ui","fields":{"minutes":20},"startedAt":"2026-09-28T10:05:00Z","durationMs":0}}
```

`409` عندما يكون مشغولاً: يعمل بالفعل ووضعه `skip`، أو يعمل ومعه تشغيل في الانتظار ووضعه `queue`. لم يعمل شيء، ويوجد في السجل تشغيل `skipped` يذكر السبب:

```json
{"error":"script busy: script cip_cycle was not started: it is already running, and its mode is skip","run":{"id":78,"scriptId":"cip_cycle","status":"skipped","...":"..."}}
```

**`?dry_run=true`** يسأل ماذا سيفعل التشغيل الآن ولا يفعل شيئاً منه. تُفحص الحقول بالطريقة نفسها؛ ثم تُمرَّر كل خطوة على المصنع كما هو: كل كتابة وكل استدعاء خدمة يُعرض على فحوص البوابة نفسها، ويُقيَّم الشرط، ويُربط المتغير. الانتظار والتأخير وكل ما لا يكتب على أي معدات هو `not_checked`. أول كتابة سيُرفضها البوابة تنهيه، كما كانت ستنهي التشغيل، و`error` يقول ذلك بكلمات البوابة. `200` مع الحكم، سواء رُفض أم لا:

```json
{"dry_run":true,"check":{"script_id":"cip_cycle","fields":{"minutes":20},"steps":[{"step":"1","type":"call_service","input":"switch.turn_on switch.cip_pump {}","verdict":"refused","detail":"cip/pump: this tag is not marked writable"}],"error":"step 1 (call_service): cip/pump: this tag is not marked writable"}}
```

`verdict` لكل خطوة هو `would_write` أو `refused` أو `ends_here` (شرط خاطئ الآن، أو توقف) أو `not_checked` أو `ok`. وتُرقَّم خطوة من سكربت يستدعيه تحت الاستدعاء: `3.1`.

### `POST /api/scripts/{id}/stop`

يلغي كل تشغيلاته الجارية، في كل عملية، أينما كانت. `{"cancelled":1,"stopped":"cip_cycle"}`، حيث `cancelled` هي التشغيلات التي كانت لدى هذه العملية. يملك المشغّلون `scripts.run`: إيقاف ما يمكنهم بدؤه جزء من بدئه.

### `GET /api/scripts/{id}/runs`

تشغيلاته، الأحدث أولاً، مع آثارها. `?limit=` (الافتراضي 50، بحد أقصى 1000). `parent` هو ما استدعى التشغيل، عندما استدعاه شيء: `automation_run:812`، `script_run:77`.

```json
[{"id":77,"scriptId":"cip_cycle","status":"succeeded","actor":"automation:shift-end","source":"automation","parent":"automation_run:812","fields":{"minutes":20},"startedAt":"2026-09-28T10:05:00Z","finishedAt":"2026-09-28T10:25:00Z","durationMs":1200012,"steps":[{"index":1,"type":"call_service","input":"switch.turn_on switch.cip_pump {}","output":"true to cip/pump: written; call 8fb9538c82d532be","startedAt":"2026-09-28T10:05:00Z","durationMs":9.6}]}]
```

## الوصفات

مجموعات من القيم تُطبَّق معاً: القيم المطلوبة لدرجة منتج، أو تغيير إنتاج. كل مجموعة هي أيضاً كيان، `scene.<id>`. تُفحص الوصفة كاملة قبل أن يخرج أي شيء وتُرفض كاملة لأي سبب؛ ثم تخرج أهدافها بالترتيب تحت معرّف استدعاء واحد، وأول هدف يفشل يوقف الباقي، ولا يُتراجع عن أي شيء؛ وكل قيمة مكتوبة تُقرأ مرة أخرى من الجهاز. كل شيء في [الوصفات](/ar/iot/recipes/).

اسم الوصفة ووصفها وعقدة المعدات وصلاحيتها تتغير في مكانها. أما ما تكتبه (`targets` و`params` و`precondition` و`verify_sec`) فهو إصدار، والإصدارات لا تُعدَّل أبداً: حفظ محتوى جديد يخزّن الإصدار التالي.

### `GET /api/recipes`

كل وصفة، مع محتوى إصدارها الحالي وأحدث تطبيق لها:

```json
[{"id":"grade_a","name":"Grade A","equipment_id":7,"apply_permission":"recipes.apply","current_version":3,"params":[{"name":"speed","type":"number","min":0,"max":400,"step":10,"unit":"rpm","required":true}],"precondition":"states['input_boolean.line_ready'] == 'on'","targets":[{"entity_id":"number.line_02_zone1_sp","service":"set_value","data":{"value":210}},{"entity_id":"number.line_02_speed","service":"set_value","data_expressions":{"value":"vars.speed"}}],"verify_sec":10,"note":"zone 1 up 5","created_at":"2026-09-28T10:00:00Z","updated_at":"2026-09-28T11:00:00Z","last_application":{"id":41,"recipe_id":"grade_a","version":3,"call_id":"7c1f0e2d9a8b6c54","actor":"otto","source":"ui","params":{"speed":250},"status":"applied","targets":[],"started_at":"2026-09-28T11:05:00Z","finished_at":"2026-09-28T11:05:01Z"}}]
```

`equipment_id` هو `null` لوصفة المصنع كله.

### `POST /api/recipes`

ينشئ واحدة، بالإصدار 1. للمسؤولين فقط. `id` (أحرف صغيرة وأرقام وشرطات سفلية، يبدأ بحرف: هو معرّف كائن الكيان، `scene.<id>`) و`name` و`description` و`equipment_id` و`apply_permission` (`recipes.apply` الافتراضي، أو `recipes.apply.<name>`) و`params` (مدخلات ذات أنواع) و`precondition` (تعبير يجب أن يكون صحيحاً للبدء) و`targets` (واحد على الأقل، و200 على الأكثر، كل منها فيه `entity_id` و`service` و`data` أو `data_expressions`) و`verify_sec` (من 1 إلى 600، الافتراضي 10) و`note`. الهدف يضبط قيمة: `set_value` و`select_option` و`set_position` و`set_speed` و`set_setpoint` و`set_mode` و`turn_on` و`turn_off`، على النطاقات التي تقبلها. النبضة أو البدء يُرفضان: مكانهما في سكربت. يجب أن يكون كيان كل هدف موجوداً، ويجب أن يُجمَّع كل تعبير. `201` مع الوصفة؛ `400` لأي خطأ، `409` لمعرّف مأخوذ.

### `POST /api/recipes/capture`

يصوغ مسودة وصفة مما تحمله الكيانات الآن، للمسؤولين فقط، ولا يحفظ شيئاً:

```json
{"entity_ids":["number.line_02_zone1_sp","switch.line_02_heater","loop.line_02_tic"]}
```

كل كيان يصبح هدفاً يعيده إلى قيمته الحالية، بالترتيب المعطى؛ والحلقة تصبح وضعها ثم قيمتها المطلوبة. الرد وصفة بلا معرّف وبلا اسم، للمحرر. الكيان غير الموجود، أو المعطّل، أو المقروء بجودة غير جيدة، أو `unknown` أو `unavailable`، أو الذي ليس مما تضبطه الوصفة، يعطي `400` يسمّي كل واحد منها: وصفة مبنية على قراءة سيئة تكتب القراءة السيئة مرة أخرى.

### `GET /api/recipes/{id}`

وصفة واحدة، كما في القائمة. `404` إن لم توجد.

### `PUT /api/recipes/{id}`

يحفظها. للمسؤولين فقط. الجسم هو الوصفة كما ردّ بها `GET`، بعد تعديلها؛ ويمكن حذف `id`. `current_version` هو الإصدار الذي أُجري عليه التعديل: إذا كان أحدهم قد حفظ إصداراً آخر منذ ذلك، يعطي الحفظ `409` بدلاً من الكتابة فوق إصداره بصمت (`0` يتخطى الفحص). المحتوى الجديد يصبح الإصدار التالي، مع `note` تقول السبب؛ وتغيير الاسم أو الوصف أو المعدات أو الصلاحية فقط لا ينشئ إصداراً.

### `DELETE /api/recipes/{id}`

يحذفها مع إصداراتها. للمسؤولين فقط. `{"deleted":"grade_a"}`. تُحفظ تطبيقاتها، لأنها ما أُرسل إلى المصنع، ويصبح كيانها يتيماً.

### `GET /api/recipes/{id}/versions`

كل الإصدارات، الأحدث أولاً، كل منها تماماً كما حُفظ، مع من حفظه والملاحظة:

```json
[{"recipe_id":"grade_a","version":3,"params":[],"targets":[{"entity_id":"number.line_02_zone1_sp","service":"set_value","data":{"value":210}}],"verify_sec":10,"note":"zone 1 up 5","created_by":"ada","created_at":"2026-09-28T11:00:00Z"}]
```

### `GET /api/recipes/{id}/versions/{version}`

إصدار واحد. `404` إذا لم يكن للوصفة هذا الإصدار، `400` إذا لم يكن `{version}` رقماً.

### `POST /api/recipes/{id}/validate`

هل ستُطبَّق الآن؟ يملك المشغّلون `recipes.apply`. الجسم هو جسم تطبيق، ولا يُكتب أو يُسجَّل أو يُدوَّن في السجل شيء. تُجرى كل فحوص يجريها التطبيق قبل الكتابة: المعاملات، وصلاحية الوصفة نفسها، والشرط المسبق، وتعبيرات البيانات، وهل يكتب تطبيق آخر في أحد كياناتها، وكل هدف يُعرض على فحوص بوابة الكتابة. `200` مع الحكم، `would_apply` أو `refused`، وحكم كل هدف: `would_write` أو `refused` مع السبب، أو `not_sent`.

```json
{"dry_run":true,"application":{"recipe_id":"grade_a","version":3,"params":{"speed":250},"status":"refused","targets":[{"index":1,"entity_id":"number.line_02_zone1_sp","service":"set_value","data":{"value":210},"status":"would_write"},{"index":2,"entity_id":"number.line_02_speed","service":"set_value","data":{"value":250},"status":"refused","error":"line-02/Speed: this tag is not marked writable"}],"started_at":"2026-09-28T11:04:00Z","error":"target 2 (set_value number.line_02_speed): line-02/Speed: this tag is not marked writable"}}
```

المعاملات التي لا تقبلها تعطي `400`، كما كانت ستفعل في التطبيق الحقيقي.

### `POST /api/recipes/{id}/apply`

يطبّقها. يملك المشغّلون `recipes.apply`. الوصفة التي تسمّي صلاحية خاصة بها، `recipes.apply.<name>`، تطلبها هي أيضاً، وتُفحص هنا مقابل الوصفة؛ والمستخدم الذي لا يملكها يحصل على `403` وتطبيق مرفوض في السجل باسمه.

```json
{"params":{"speed":250},"reason":"grade A for the 2pm run","version":0,"resume":0}
```

كل شيء اختياري، والجسم كذلك. `version` يطبّق إصداراً أقدم عن قصد؛ وإن حُذف فالإصدار الحالي. `resume` هو معرّف تطبيق سابق لهذه الوصفة توقف في منتصفه: أهدافه التي لم تُكتب تخرج كتطبيق جديد، بإصداره ومعاملاته، و`parent` يقول أيّ تطبيق يُتمّ.

يردّ بعد أن تُكتب كل قيمة وتُقرأ مرة أخرى، وهذا يستغرق حتى `verify_sec` الخاص بالوصفة:

```json
{"application":{"id":42,"recipe_id":"grade_a","version":3,"call_id":"9d2e4f6a8b0c1e3f","actor":"otto","source":"ui","reason":"grade A for the 2pm run","params":{"speed":250},"status":"applied","targets":[{"index":1,"entity_id":"number.line_02_zone1_sp","service":"set_value","data":{"value":210},"status":"written","writes":[{"tag":"line-02/Zone1_SP","value":"210","status":"written"}],"verification":"verified","verify_detail":"read back 210"},{"index":2,"entity_id":"number.line_02_speed","service":"set_value","data":{"value":250},"status":"written","writes":[{"tag":"line-02/Speed","value":"250","status":"written"}],"verification":"unconfirmed","verify_detail":"not confirmed within 10s: read back 240, not 250"}],"started_at":"2026-09-28T11:05:00Z","finished_at":"2026-09-28T11:05:10Z"}}
```

الهدف هو `written` أو `failed` (خرج وقال الجهاز لا، أو لم يقل شيئاً) أو `not_sent` أو `skipped` (هدف قبله لم يمرّ) أو `refused` (تحقق مسبق). والمكتوب هو `verified` عندما يقرأ الجهاز بعد الإرسال القيمة التي أُرسلت إليه، و`unconfirmed` عندما لا يفعل ذلك خلال `verify_sec`: خرج وربما لم يُعتمد. كل كتابة تحمل `call_id` الخاص بالتطبيق، فـ `GET /api/writes?call=<call_id>` هي كلها.

| الحالة | متى |
|---|---|
| 200 | `applied`: كل هدف كُتب. افحص `verification` لكل منها |
| 400 | معامل لا تقبله الوصفة، خارج النطاق أو من نوع خاطئ؛ `resume` بلا شيء متبقٍّ للتطبيق |
| 403 | صلاحية الوصفة نفسها. تُسجَّل كتطبيق مرفوض |
| 404 | لا توجد وصفة كهذه، أو لا يوجد إصدار كهذا |
| 409 | `refused`: أي سبب لعدم البدء، كل منها في `error` وعلى هدفه. أو تطبيق آخر يكتب الآن في أحد كياناتها. لم يُكتب شيء |
| 502 | `partial` أو `failed`: بدأ، ولم يخرج كل هدف. `targets` تقول بالضبط أيها. لا يُتراجع عن شيء |

كل رد عدا `400` لجسم مشوّه أو `404` يحمل التطبيق، وكل تطبيق عدا التجربة موجود في `GET /api/recipes/{id}/applications`، بما فيه حالات الرفض.

### `GET /api/recipes/{id}/applications`

تطبيقاتها، الأحدث أولاً، بما فيها المرفوضة. `?limit=` (الافتراضي 50، بحد أقصى 1000). `parent` هو ما طبّقها، عندما طبّقها شيء: `automation_run:812` و`script_run:77` و`application:41`. تطبيقات وصفة محذوفة ما زالت تُرجَع.

## Blueprints

أتمتة تُكتب مرة واحدة وفيها فراغات ذات أنواع، تُملأ لإنشاء قاعدة عادية. تحتفظ القاعدة بالإصدار الذي أُنشئت منه؛ وتعديل الـ blueprint لا يغيّر أي قاعدة، ونقل قاعدة إلى إصدار أحدث هو [ترقية](#post-apiautomationsidblueprint-upgrade) يطلبها أحدهم. كل كتابة تجريها القاعدة تمرّ عبر بوابة الكتابة بصيغة `automation:<id>`. كل شيء في [Blueprints](/ar/iot/blueprints/).

### `GET /api/blueprints`

كل blueprint، المدمجة أولاً، ومع كل واحد عدد القواعد المنشأة منه:

```json
[{"id":"motor_running_too_long","name":"Motor running too long","description":"Says so when a motor has been running longer than it should...","source":"builtin","version":1,"inputs":[{"name":"motor","label":"Motor","type":"entity","required":true,"domain":["motor"]},{"name":"max_run","label":"Longest it may run","type":"duration","default":3600},{"name":"stop_it","label":"Stop it as well","type":"boolean","default":false}],"template":{"triggers":[{"type":"state","entityId":{"!input":"motor"},"to":"running","forSec":{"!input":"max_run"}}],"...":"..."},"instances":2}]
```

`source` هو `builtin` (يأتي في الملف التنفيذي، للقراءة فقط) أو `user`.

### `POST /api/blueprints`

يكتب واحداً. للمسؤولين فقط. `id` (أحرف صغيرة وأرقام وشرطات سفلية، يبدأ بحرف) و`name` و`description` و`inputs` (ذات أنواع، مثل حقول السكربت) و`template`: القاعدة، مع `description` و`triggers` و`condition` و`actions` و`mode` و`minIntervalSec` و`maxRuntimeSec` الخاصة بها، والفراغات فيها. `{"!input": "motor"}` كقيمة يُستبدل بالمدخل؛ وكذلك `${motor}` داخل سلسلة نصية، كقيمة حرفية حيث تكون السلسلة تعبيراً. يُفحص قبل حفظه: كل فراغ يسمّي مدخلاً، وكل مدخل يُستخدم، ومملوءاً بقيم عيّنة ينتج قاعدة تُجمَّع. `201` عند `version` 1. `400` لأي خطأ فيه، `409` لمعرّف مأخوذ، بما فيه معرّف blueprint مدمج.

### `GET /api/blueprints/{id}`

واحد، كما في القائمة. `404` إن لم يوجد.

### `PUT /api/blueprints/{id}`

يستبدل تعريفه؛ والجسم هو نفسه عند كتابة واحد، ويمكن حذف `id`. للمسؤولين فقط. يزداد `version` بواحد عندما يتغير `inputs` أو `template`، ولا يزداد عند اسم أو وصف جديد. **لا تتغير أي قاعدة منشأة منه.** كل قاعدة تحتفظ بالإصدار الذي أُنشئت منه، و`GET /api/automations` يبيّن أيّ إصدار. الـ blueprint المدمج يعطي `400`: انسخه تحت معرّف خاص بك.

### `DELETE /api/blueprints/{id}`

للمسؤولين فقط. `{"deleted":"pump_watch"}`. `409` ما دامت توجد أي قاعدة منشأة منه، مع تسميتها: احذفها أولاً. الـ blueprint المدمج يعطي `400`.

### `POST /api/blueprints/{id}/instantiate`

ينشئ منه قاعدة ويسلّحها. يملك المشغّلون `blueprints.apply`: أي مضخة وكم من الوقت من اختيارهم، وما تفعله القاعدة تقرّر عند كتابة الـ blueprint.

```json
{"automationId":"infeed_too_long","name":"Infeed pump ran too long","enabled":true,"inputs":{"motor":"motor.infeed_pump","max_run":"90m","stop_it":true}}
```

`name` افتراضياً هو اسم الـ blueprint و`enabled` هو `true`. يُفحص كل مدخل قبل إنشاء أي شيء: قيمة خارج النطاق، أو خارج خطوتها، أو ليست من خياراتها، أو كيان من نطاق آخر، أو من نوع خاطئ تعطي `400` يسمّي كل خطأ، ولا تُحرَّك أبداً لتناسب. `automationId` مأخوذ يعطي `409`: إنشاء قاعدة لا يستبدل قاعدة أخرى أبداً. `201` مع القاعدة، وقد ضُبطت `blueprintId` و`blueprintVersion` و`blueprintInputs`. يُسجَّل بصيغة `automation made from blueprint motor_running_too_long version 1`.

**`?dry_run=true`** لا ينشئ شيئاً. يجيب بالقاعدة التي كان سينشئها وبما كانت ستفعله لو انطلقت الآن: الشرط مقيَّم، وكل كتابة واستدعاء خدمة يُعرضان على فحوص البوابة بصيغة `automation:<id>`، وأول رفض في `check.error` بكلمات البوابة. لا يُخزَّن أو يُكتب أو يُدقَّق شيء.

```json
{"dry_run":true,"automation":{"id":"infeed_too_long","...":"..."},"check":{"automation_id":"infeed_too_long","steps":[{"step":"1","type":"log_event","verdict":"not_checked"},{"step":"2","type":"condition","input":"true","verdict":"ok","detail":"true now"},{"step":"3","type":"call_service","input":"motor.stop motor.infeed_pump {}","verdict":"would_write","detail":"would write false to line-02/M1_Run"}]}}
```

## لوحات المعلومات

صفحات من البطاقات، للأدوار والشاشات التي تحتاجها. لوحة المعلومات لا تأمر بشيء: البطاقة تسمّي وسماً أو كياناً أو سكربتاً أو وصفة، وزرّها يكتب عبر [`POST /api/write`](#post-apiwrite) باسم الشخص الذي ضغطه. لوحة الحائط واحدة منها. كل شيء في [لوحات المعلومات](/ar/iot/dashboards/).

### `GET /api/dashboards`

لوحات المعلومات المعروضة على المتصل، بالترتيب الذي يعرضها به المبدّل، بما فيها لوحة الحائط. من يملك `dashboards.write` تُعرض عليه كلها.

```json
[{"id":"wall","name":"Wall board","description":"The tags pinned on the Board screen, as gauges.","kind":"wall","roles":[],"homeFor":[],"screens":["wall-tv"],"position":0,"cards":[],"version":2,"updatedBy":"ada"},
 {"id":"line-2","name":"Line 2","kind":"cards","roles":["operator","admin"],"homeFor":["operator"],"screens":["line-2-panel"],"position":1,"version":3,"updatedBy":"ada","cards":[{"id":"temp","type":"gauge","title":"Zone 1","w":3,"h":3,"config":{"tag":"press-01/Zone1_Temp"}}]}]
```

### `POST /api/dashboards`

يبني واحدة. للمسؤولين فقط. `id` (أحرف صغيرة وأرقام وشرطات وشرطات سفلية، يبدأ بحرف) و`name`، واختيارياً `description` و`roles` و`homeFor` و`screens` و`position` و`cards`. `201` عند `version` 1، مع حجم كل بطاقة وإعداداتها بالصيغة التي خُزّنت بها.

البطاقة هي `id` و`type` و`title` و`w` (من 1 إلى 12 عموداً) و`h` (من 1 إلى 8 صفوف) و`config`. الأنواع وإعداداتها في [لوحات المعلومات](/ar/iot/dashboards/#البطاقات). تُفحص قبل حفظها:

- مفتاح إعداد ليس في النوع، أو رقم خارج النطاق، أو عنوان كاميرا أو مخطط طابق فيه بيانات دخول أو رمز، أو أكثر من 60 بطاقة يعطي `400`؛
- بطاقة تسمّي وسماً أو كياناً أو سكربتاً أو وصفة غير موجودة تعطي `400` يسمّيها؛
- `button` على وسم غير قابل للكتابة، أو برقم خارج نطاق الوسم، يعطي `400`: ستردّ البوابة كل ضغطة؛
- دور غير موجود يعطي `400`؛
- `id` مأخوذ، أو شاشة تملكها لوحة أخرى بالفعل، أو صفحة رئيسية لدور هي بالفعل لوحة أخرى، يعطي `409`.

### `GET /api/dashboards/{id}`

واحدة، كما في القائمة. `404` إن لم توجد، وكذلك إن لم تُعرض على المتصل.

### `PUT /api/dashboards/{id}`

يستبدلها. للمسؤولين فقط. الجسم هو لوحة المعلومات كما ردّ بها `GET`، مع ضبط `version` على الإصدار الذي قُرئت عنده: **هو مطلوب**، والحفظ الذي يسمّي إصداراً لم يعد الحالي يعطي `409` يقول ما هو الحالي، لأن البديل هو حذف ما بناه آخر شخص حفظ للتو بصمت. يمكن حذف `id` من الجسم، ولا يمكن تغيير `kind`، و`createdAt` و`updatedAt` و`updatedBy` من شأن الخادم وتُتجاهل. `200` مع لوحة المعلومات في الإصدار التالي.

لوحة الحائط تقبل `PUT` لتعييناتها فقط (`roles` و`homeFor` و`screens` و`position`) ولا شيء غير ذلك: ليست لها بطاقات، فما فيه بطاقات يعطي `400`. مقاييسها هي وسوم اللوحة، `GET` و`PUT /api/board`.

### `DELETE /api/dashboards/{id}`

للمسؤولين فقط. `{"deleted":"line-2"}`. البطاقات تشير إلى أشياء ولا تملك شيئاً، فلا يُمسّ شيء آخر. لوحة الحائط تعطي `400`: هي موجودة دائماً.

يُسجَّل البناء والحفظ والحذف كأحداث `config` على الموضوع `dashboard:<id>`.

### `GET /api/dashboards/{id}/export`

لوحة المعلومات كملف شاشة: مستند JSON له إصدار يحمّله [`POST /api/dashboards/import`](#post-apidashboardsimport) في تثبيت آخر. يردّ كمرفق باسم `<id>.hotloop-screen.json`. يحتاج المتصل إلى `dashboards.read` ويجب أن تُعرض عليه اللوحة، كما في `GET` لواحدة. لوحة الحائط تعطي `400`: هي مقاييس مثبّتة لتثبيت، لا تخطيط. الصيغة في [ملفات الشاشات](/ar/iot/screen-file/).

### `POST /api/dashboards/import`

يقرأ ملف شاشة ويفحصه مقابل هذا التثبيت ويحفظه كلوحة معلومات جديدة. للمسؤولين فقط، ولا يستطيع حفظ ما سيرفضه `POST /api/dashboards`. الجسم هو الملف نفسه، أو `{"file": {...}}` مع خيارات بجانبه:

| الخيار | <span class="sr-only">التفاصيل</span> |
|---|---|
| `id`, `name` | احفظه تحت معرّف أو اسم آخر. |
| `replace` | إذا كان المعرّف مأخوذاً، احفظ فوق تلك اللوحة عند إصدارها الحالي. بدونه يعطي المعرّف المأخوذ `409`. |
| `skipAssignments` | اترك `screens` و`homeFor` الخاصة بالملف، فهي تخص التثبيت الذي أنشأه. تبقى `roles`. |
| `remap` | ماذا نسمّي الأشياء هنا: `tags` (مفتاح كامل إلى مفتاح كامل، كما يسمّي الملف الوسم أو كما يُقرأ بعد أن ينقله `devices`) و`devices` (معرّف إلى معرّف، وهذا ينقل أيضاً جزء الجهاز من كل وسم لم يُذكر في `tags`) و`entities` و`scripts` و`recipes` و`equipment` (معرّف إلى معرّف). مدخل لم يستخدمه شيء على الشاشة هو تحذير. |
| `dryRun` | أجب بالتقرير ولا تحفظ شيئاً. دائماً `200`. |
| `codesys`, `visualization` | بدلاً من `file`: نص تصدير CODESYS الأصلي، والتصوّر الذي يؤخذ عندما يحوي عدة تصورات. يكون في التقرير حينئذٍ `conversion` فيه ما صار إليه كل عنصر وما تُرك. راجع [استيراد شاشة CODESYS](/ar/iot/codesys-screen-import/). |

الرد تقرير سواء حُفظ شيء أم لا:

```json
{"ok":false,"dryRun":true,"id":"line-2","name":"Line 2","cards":6,"replaces":false,
 "problems":[{"kind":"tag","ref":"press-01/Zone1_Temp","message":"tag press-01/Zone1_Temp does not exist here; map it to one that does, or add it on the Tags screen first"}],
 "warnings":[],"remapped":[],
 "requires":{"tags":[{"key":"press-01/Zone1_Temp","writable":false}],"entities":[],"scripts":[],"recipes":[],"devices":[],"equipment":[]}}
```

تُسرد كل إشارة مفقودة، لا الأولى فقط. `kind` هو `file` (ليس ملف شاشة، أو صيغة خاطئة، أو إصدار صيغة أحدث مما يقرؤه هذا البناء، أو حقل لا يعرفه) أو `screen` (قواعد اللوحة نفسها: بطاقة سيئة، دور غير موجود، حجم كبير جداً) أو `tag` أو `entity` أو `script` أو `recipe` أو `device` أو `equipment` أو `writable` (زر أو قيمة مطلوبة على وسم غير قابل للكتابة) أو `assignment` (اسم شاشة أو صفحة رئيسية لدور تحتفظ بها لوحة أخرى) أو `exists` (المعرّف مأخوذ). الاستيراد الذي فيه أي مشكلة لا يحفظ شيئاً: `400`، أو `409` عندما تكون المشكلة الوحيدة `exists` أو `assignment`، مع التقرير نفسه. النجاح `201`، أو `200` عندما استبدل لوحة، مع التقرير و`dashboard` المحفوظة. يُسجَّل كحدث `config` على الموضوع `dashboard:<id>`.

## Webhooks

### `POST /api/webhook/{path}`

يطلق كل أتمتة لها مشغّل `webhook` على ذلك المسار. **لا جلسة ولا صلاحية**: المسار هو السر الذي يُعطى لطرف ثالث، وهو نموذج الثقة نفسه الذي كانت لهذه النقطة دائماً، ونظام SCADA أو callback لخدمة SaaS ليس لديه حساب يسجّل به الدخول. اختر مساراً لا يستطيع أحد تخمينه.

يُسلَّم الجسم، حتى 1 MiB، إلى القاعدة. `202` `{"accepted":"fill-now"}`. `404` `"no automation is listening on this webhook path"` عندما لا يستمع شيء: webhook يرسل إلى لا شيء يبدو مطابقاً لواحد يعمل، لذلك يقول ذلك.

## أسطول الأجهزة

المرحّلات الطرفية المسجّلة، وحضورها المباشر عبر Sparkplug، والأوامر الموجّهة إليها. يحتاج إلى `HOTLOOP_FLEET_ENABLED`. راجع [إدارة أسطول الأجهزة](/ar/gateway/fleet/).

### `GET /api/fleet`

```json
{"configured":true,"members":[{"id":"press-relay-01","name":"Press line relay","group":"plant-a","nodeId":"press-relay-01","statusUrl":"http://press-relay-01:8081","enabled":true,"createdAt":"2026-09-27T20:28:49.448323Z","updatedAt":"2026-09-27T20:28:49.448323Z","online":false,"polled":true,"error":"Get \"http://press-relay-01:8081/status\": dial tcp: lookup press-relay-01 on 10.89.0.1:53: no such host"}]}
```

`online` يأتي من NBIRTH وNDEATH. `release` هو البناء الذي قال المرحّل إنه يعمل به في آخر birth له: `version` و`imageDigest` (عندما يذكره المشرف عليه؛ وHelm chart لا يفعل) و`since`، وهو متى سمع Gateway هذا البناء أول مرة. المرحّل القديم جداً بحيث لا يبلّغ عن واحد لا يملك شيئاً. بالنسبة لعضو له `statusUrl`، يكون `polled` صحيحاً، و`reachable` و`forwardQueueLen` و`devices` و`connected` و`config` و`updateMode` (`auto` أو `approve`) تأتي من `/status` الخاص به؛ ولا معنى لها عندما لم يكن متاحاً. مع إيقاف الميزة: `{"members":[],"configured":false}`.

### `POST /api/fleet`

ينشئ عضواً أو يستبدله: `id` و`name` و`group` و`nodeId` (هويته في Sparkplug) مطلوبة؛ و`description` و`statusUrl` (`http://` أو `https://`) و`enabled` اختيارية. يردّ بالعضو. هذا يعمل مع إيقاف الميزة، فيمكن إعلان الأسطول قبل تشغيلها.

### `DELETE /api/fleet/{id}`

`{"deleted":"press-relay-01"}`، أو `404`.

### `POST /api/fleet/{id}/rebirth`

ينشر `Node Control/Rebirth` إلى المرحّل. بلا جسم. `{"status":"rebirth requested"}`. `404` لعضو غير معروف.

### `POST /api/fleet/{id}/restart`

ينشر `Node Control/Reboot`. `{"status":"restart requested"}`. للمسؤولين فقط: إعادة تشغيل مرحّل تُفقده بياناته حتى يعود.

### `POST /api/fleet/{id}/update`

يوافق على تحديث الصورة الذي يحتجزه مرحّل. ينشر `Node Control/Update`. `{"status":"update approved"}`. للمسؤولين فقط: يخرج المرحّل ويبدأ المشرف عليه أي صورة يتبعها، فيفقد بياناته خلال المدة التي يستغرقها ذلك. لا يفعل شيئاً إلا مع مرحّل مضبوط على `HOTLOOP_EDGE_RELAY_UPDATE_MODE=approve`؛ وأي مرحّل آخر يسجّل أنه تجاهله. الطلب لا يسمّي أي صورة: لا يوجد مكان لوضع واحدة، وهذا هو المقصود. راجع [مرجع Edge Relay](/ar/edge-relay/reference/#تحديث-relay).

### `POST /api/fleet/{id}/config`

يدفع ملف أجهزة جديداً إلى المرحّل، الذي يطبّقه مباشرة: بلا إعادة تشغيل، مع بقاء جلسته مع الـ broker وطابور إعادة التوجيه، وبقاء كل جهاز لم يغيّره الملف متصلاً. الجسم هو **ملف الأجهزة نفسه**، JSON خام، غير ملفوف في شيء. يُتحقق منه قبل نشر أي شيء (`400` `"invalid device file: ..."` إن لم يكن صالحاً). `{"status":"config pushed"}` يعني أن الـ broker قبله؛ وهل المرحّل يشغّله يقوله `config.digest` لذلك العضو في `GET /api/fleet`، والملف الذي رفضه المرحّل يظهر هناك كـ `config.rejected`. للمسؤولين فقط: يغيّر ما يستطلعه المرحّل. راجع [إدارة أسطول الأجهزة](/ar/gateway/fleet/#إرسال-الإعداد).

### `DELETE /api/fleet/{id}/config`

يسحب الدفع. يمسح الإعداد المحتفظ به على الـ broker حتى لا يطبّقه أي إقلاع لاحق، ويتخلى مرحّل متصل الآن عن الملف المدفوع ويعود مباشرة إلى ملف الأجهزة المحلي. بلا جسم. `{"status":"config push cleared"}`، `404` لعضو غير معروف، `503` عندما لا يكون Gateway متصلاً بالـ broker. للمسؤولين فقط، مثل الدفع. لا يعيد تشغيل أي شيء. أرسله والمرحّل متصل: المرحّل غير المتصل لا يسمعه أبداً. راجع [مرجع Edge Relay](/ar/edge-relay/reference/#أين-يوجد-الملف-المدفوع-وأي-ملف-يغلب).

## الإشعارات

استدعاء هاتف عند إطلاق إنذار، عبر webhook أو SMTP أو ntfy أو Gotify، وإبلاغ الشخص التالي عندما لا يقرّ به أحد. يحتاج إلى `HOTLOOP_NOTIFY_ENABLED`.

### `POST /api/notify/test`

يرسل الآن إشعار إنذار اصطناعياً عبر كل قناة مضبوطة، لتكتشف أن مرحّل SMTP يرفضك قبل أن يفعل ذلك إنذار حقيقي. بلا جسم. يحتاج إلى `HOTLOOP_NOTIFY_ENABLED`. للمسؤولين فقط: يرسل رسالة حقيقية ويستهلك ما يسمح به المزوّد من حصة.

```json
{"results":[{"channel":"smtp","success":true}]}
```

`200` سواء عملت كل قناة أم لا؛ وكل نتيجة تقول ذلك. التي فشلت تحمل `error`. الـ webhook الفاشل يسمّي مخططه ومضيفه ولا شيء غير ذلك، لأن عنوان URL هو بيانات الاعتماد في معظم خدمات الاستدعاء. راجع [إشعارات الإنذارات](/ar/iot/notifications/).

### `GET /api/notify/escalation`

سياسة تصعيد الإنذارات، والقنوات التي يمكن لخطوة أن تسمّيها، والسلاسل المفتوحة الآن. `available` هو `false`، مع سياسة متوقفة وبلا قنوات، عندما لا يكون `HOTLOOP_NOTIFY_ENABLED` مضبوطاً؛ ويبقى الرد `200`. للمسؤولين فقط قراءةً وكتابةً: السياسة تحمل مواضيع ntfy الخاصة بالأشخاص، وهي على خادم يصل إليه أي أحد كلمات مرور.

```json
{"available":true,"policy":{"enabled":true,"minPriority":"high","contacts":[{"name":"Ana","ntfyTopic":"ana-phone-3f9c","emails":["ana@plant.test"]}],"steps":[{"afterMinutes":5,"contacts":["Ana"]},{"afterMinutes":10,"channels":["gotify"]}],"repeatEveryMinutes":15,"repeatTimes":2},"channels":["smtp","ntfy","gotify"],"active":[{"alarmId":"boiler-hi","name":"Boiler Trip","raisedAt":"2026-10-21T03:00:00Z","sent":1,"total":4,"nextAt":"2026-10-21T03:15:00Z"}],"limits":{"steps":10,"contacts":50,"repeats":20,"minutes":1440}}
```

`channels` هي التي ضبطها هذا HotLoop، وهذا كل ما يمكن لخطوة أن تسمّيه. `active` هو كل إنذار يُمرَّر على السلسلة: كم إرسالاً خرج من عدد ما في السياسة (الخطوات ثم التكرارات)، ومتى يحين التالي. ما لم يُحفظ شيء بعد فهو `{"policy":{"enabled":false},...}`: متوقفة، وبلا شيء فيها.

### `PUT /api/notify/escalation`

يستبدل السياسة كلها، وليس تصحيحاً جزئياً، ويردّ بما كان `GET` سيردّ به. تُطبَّق على الإنذارات التي تُطلق من الآن فصاعداً. `400` عندما لا تكون الإشعارات مفعّلة.

```json
{"enabled":true,"minPriority":"high",
 "contacts":[{"name":"Ana","ntfyTopic":"ana-phone-3f9c","emails":["ana@plant.test"]}],
 "steps":[{"afterMinutes":5,"contacts":["Ana"]},{"afterMinutes":10,"channels":["gotify"]}],
 "repeatEveryMinutes":15,"repeatTimes":2}
```

`minPriority` هو `critical` أو `high` (الافتراضي) أو `medium` أو `low`. تحين الخطوة بعد `afterMinutes` (من 1 إلى 1440) من التي قبلها، والأولى بعد الإطلاق، وتسمّي `contacts` من القائمة، أو `channels` التي لدى النشر، أو كليهما. 10 خطوات و50 جهة اتصال و20 تكراراً على الأكثر. الحقول غير المعروفة تُرفض.

`400` مع السبب عندما لا تستطيع السياسة العمل، بكلمات يمكنك التصرف بناءً عليها: خطوة لا تسمّي أحداً، أو جهة اتصال ليست في القائمة، أو قناة لم يضبطها هذا HotLoop (يسرد الرد التي يملكها)، أو موضوع ntfy دون ضبط ntfy أو عنوان دون ضبط البريد، أو عنوان ليس بسيطاً، أو تكرار بلا فاصل. لا يُخزَّن شيء عند الرفض. حفظها مسجَّل في سجل النظام، بدون المواضيع. راجع [إشعارات الإنذارات](/ar/iot/notifications/#التصعيد).

### `POST /api/notify/ack/{token}`

زر **إقرار** في إشعار ntfy. الهاتف الذي يضغطه ليست لديه جلسة ليرسلها، فـ **لا جلسة ولا صلاحية**: الرمز الموقَّع في المسار هو التفويض، وكل ما يفوّض به هو الإقرار بحدوث واحد لإنذار واحد، مرة واحدة، قبل أن ينتهي (`HOTLOOP_NOTIFY_ACK_TTL`، افتراضياً 12 ساعة). زر من رحلة الأمس لا يستطيع الإقرار بإنذار اليوم. هو `POST` عن قصد: معاينات الروابط وماسحات الأمان تفتح الروابط من تلقاء نفسها، ولا يجوز أبداً أن يُقرَّ بإنذار بواسطة روبوت. بلا جسم. يردّ بالإنذار بعد الإقرار (الشكل، من المعالج؛ أمثلة هذا المستند الأخرى التُقطت من Gateway يعمل، أما هذا فلا، لأن ذلك Gateway لم يكن فيه ntfy):

```json
{"acknowledged":true,"alarmId":"extruder-temp-hi","name":"Extruder temperature high","state":"ack-active","ackedBy":"notify:ntfy"}
```

مع إيقاف روابط الإقرار:

```json
{"error":"acknowledge links are not enabled on this HotLoop (they need HOTLOOP_PUBLIC_URL and a channel that carries a button)"}
```

هو إقرار عادي عبر محرك الإنذارات، يُدقَّق تحت `notify:<channel>`. كل رفض يُردّ عليه ويُسجَّل، لأن زراً لا يفعل شيئاً بصمت يبدو تماماً كزر لم يضغطه أحد:

| الحالة | متى |
|---|---|
| 403 | مزوَّر أو معدَّل أو موقَّع بسر آخر |
| 404 | الإنذار لم يعد موجوداً، أو روابط الإقرار متوقفة (تحتاج `HOTLOOP_PUBLIC_URL` وقناة بها زر) |
| 409 | استُخدم من قبل، أو أُطلق الإنذار مرة أخرى منذ ذلك، أو لم يبقَ شيء للإقرار به |
| 410 | أصلي، لكنه منتهي الصلاحية |
| 503 | تعذّر حفظ الإقرار؛ يُعاد الرابط حتى تبقى الضغطة الثانية قادرة على العمل |

يحمل الرد `Access-Control-Allow-Origin: *` حتى يستطيع تطبيق ntfy على الويب الضغط عليه من أصله الخاص؛ ولا شيء في هذا المسار يقرأ كوكي. لا يُسجَّل الرمز ولا يُرجَع في أي مكان أبداً. راجع [إشعارات الإنذارات](/ar/iot/notifications/#روابط-الإقرار).

## النسخ الاحتياطية

لقطات منطقية لقاعدة البيانات، لبيانات الجداول فقط. يحتاج إلى `HOTLOOP_BACKUP_ENABLED`. كلاهما للمسؤولين فقط: القائمة تعرض عدد صفوف كل جدول، بما فيها المستخدمون والجلسات. **لا توجد نقطة نهاية للاستعادة**، عن قصد: الاستعادة علم على الملف التنفيذي، يشغّله مرة واحدة من يعرف أن قاعدة البيانات مقصود بها أن تستقبلها، وليست أبداً استدعاءً شبكياً على قاعدة تعمل. راجع [النسخ الاحتياطية والاستعادة](/ar/iot/backup/#استعادة-نسخة-احتياطية).

### `GET /api/backup`

النسخ الاحتياطية على وحدة التخزين، كل منها مع بيانها.

```json
{"backups":[{"name":"20260927T202912Z","bytes":98567,"manifest":{"hotloopVersion":"4.16.0","schemaMigrations":["0001_core.sql","...","0007_service_audit.sql"],"createdAt":"2026-09-27T20:29:12.970721945Z","tables":[{"name":"devices","rows":2,"columns":[{"name":"id","type":"text"},{"name":"...","type":"..."}]}]}}],"configured":true}
```

### `POST /api/backup`

يأخذ نسخة الآن وينتظرها (حتى 30 دقيقة: `tag_history` كبير يستغرق وقتاً). بلا جسم. يردّ بالبيان: الإصدار وعمليات الترحيل، وصفوف كل جدول وأعمدته.

## تقارير مجدولة

ملخصات من مؤرشف البيانات بصيغتي CSV وHTML، وفق جدول، عبر البريد أو التنزيل. يحتاج إلى `HOTLOOP_REPORTS_ENABLED`. المشاهدون يقرؤون، والمشغّلون يشغّلون، والمسؤولون يعرّفون: التعريف يسمّي أين تُرسل بيانات المصنع بالبريد. راجع [التقارير المجدولة](/ar/gateway/reports/) لحقول التعريف.

### `GET /api/reports`

```json
{"configured":true,"reports":[{"id":"line1-hourly","name":"Line 1 hourly","enabled":true,"tags":[{"deviceId":"extruder-1","tagName":"Temperature"},{"deviceId":"extruder-1","tagName":"Pressure"}],"window":{"count":1,"unit":"hours","end":"run_time"},"bucket":"window","aggregations":["min","max","avg"],"schedule":{"kind":"daily","at":"06:00"},"format":"both","recipients":["shift-lead@example.com"],"retain":10,"createdAt":"2026-09-27T20:29:23.300978Z","updatedAt":"2026-09-27T20:29:23.300978Z","nextRunAt":"2026-09-28T06:00:00Z"}],"smtpConfigured":true,"timezone":"UTC"}
```

كل تعريف يحمل `nextRunAt` وأحدث تشغيل له كـ `lastRun`.

### `POST /api/reports`

ينشئ تعريفاً؛ والجسم هو التعريف كما أعلاه. `201`. `400` عند فشل التحقق (`"report line1-hourly: window end \"now\" must be run_time or local_midnight"`)، `409` إذا كان المعرّف موجوداً.

### `GET /api/reports/{id}`

تعريف واحد، كما في القائمة. `404` لتعريف غير معروف.

### `PUT /api/reports/{id}`

يستبدل التعريف كله. لا يمكن تغيير المعرّف (`400` إذا اختلف معرّف الجسم). يُقبل `nextRunAt` و`lastRun` ويُتجاهلان، فيمكنك إعادة إرسال ما قرأته.

### `DELETE /api/reports/{id}`

يحذفه مع تشغيلاته وملفاته، ويلغي تشغيلاً جارياً. `{"deleted":"line1-hourly"}`، أو `404`.

### `POST /api/reports/{id}/run`

يشغّله الآن وينتظر. `?deliver=false` ينشئه ويخزّنه دون إرسال بريد لأحد، لتجربة تعريف. `200` تعني أن التشغيل حدث؛ و`status` الخاص به يقول هل نجح التقرير. التشغيل الذي يفشل نتيجة، وليس طلباً سيئاً، ويُسجَّل في الحالتين.

```json
{"id":1,"reportId":"line1-hourly","trigger":"manual","actor":"admin","status":"succeeded","startedAt":"2026-09-27T20:29:54.06926Z","finishedAt":"2026-09-27T20:29:54.092456655Z","windowStart":"2026-09-27T19:29:54.06926Z","windowEnd":"2026-09-27T20:29:54.06926Z","tags":2,"rows":2,"readings":984,"excluded":2,"files":[{"format":"csv","name":"20260927T202954Z-1.csv","bytes":338},{"format":"html","name":"20260927T202954Z-1.html","bytes":2430}],"emailStatus":"skipped","emailTo":["shift-lead@example.com"]}
```

`400` لـ `deliver` ليس true أو false، `404` لتقرير غير معروف.

### `GET /api/reports/{id}/runs`

`{"runs": [...]}`، الأحدث أولاً، `?limit=` الافتراضي 50، بحد أقصى 500. `404` لتقرير غير معروف، وليس قائمة فارغة.

### `GET /api/reports/{id}/runs/{run}/download`

يبثّ ملفاً مخزناً كمرفق. `?format=csv` أو `html`.

```
HTTP/1.1 200 OK
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="20260927T202954Z-1.csv"
Cache-Control: private, no-store

device_id,tag_name,unit,period_start,period_end,min,max,avg,excluded
extruder-1,Temperature,C,2026-09-27T19:29:54+00:00,2026-09-27T20:29:54+00:00,19.50001230192043,23.499980145373126,21.508905654397623,1
```

يُقدَّم HTML مع Content-Security-Policy من نوع `sandbox`: التقرير مستند للقراءة، وليس صفحة يُسمح لها بتشغيل أي شيء. الملف المفتوح هو الذي يسمّيه سجل التشغيل؛ ولا يصبح شيء في عنوان URL جزءاً من مسار. `400` لرقم تشغيل ليس رقماً أو صيغة ليست أياً من الاثنتين، `404` لتشغيل أو ملف غير موجود.

## المواقع

### `GET /api/sites`

كل موقع يوحّده Gateway، يُسأل عن حالة مصنعه عبر MCP بالتوازي، 6 ثوانٍ لكل موقع، حتى لا يعطّل موقع متوقف بقية المواقع. المواقع هي خوادم MCP الصادرة في الإعداد. راجع [MCP](/ar/iot/mcp/#توحيد-المواقع).

```json
{"configured":true,
 "rollup":{"sites":2,"reachable":1,"devices":2,"connected":2,"tags":5,"outstandingAlarms":1,"unacknowledgedAlarms":1,"criticalAlarms":0},
 "sites":[{"name":"plant-a","reachable":true,"latencyMs":14,"plant":"Demo Plant","uptime":"1m25s","devices":2,"connected":2,"degraded":0,"disconnected":0,"tags":5,"outstandingAlarms":1,"unacknowledgedAlarms":1,"criticalAlarms":0,"writesEnabled":true},
          {"name":"plant-c","reachable":false,"error":"connect to MCP server \"plant-c\": calling \"initialize\": ... no such host","latencyMs":49,"devices":0,"connected":0,"degraded":0,"disconnected":0,"tags":0,"outstandingAlarms":0,"unacknowledgedAlarms":0,"criticalAlarms":0,"writesEnabled":false}]}
```

أعداد موقع لا يمكن الوصول إليه لا معنى لها وتُترك خارج المجموع: عدّ موقع لا تصل إليه كأنه صفر إنذارات سيكون أخطر ما يمكن أن تفعله هذه الشاشة. مع عدم ضبط أي مواقع: `{"configured":false,"sites":[]}`.

## الإعدادات

### `GET /api/settings`

كل إعداد، وقيمته الفعلية، ومن أين جاءت القيمة، والمتغيّر الذي يضبطه:

```json
{"groups":["Plant","Safety","Polling","Historian","Database","MCP","Server"],
 "settings":[{"key":"ui.plantName","group":"Plant","label":"Plant name","help":"...","value":"Demo Plant East","kind":"string","source":"stored","envVar":"HOTLOOP_PLANT_NAME","editable":true},
             {"key":"safety.allowWrites","group":"Safety","label":"Writes allowed","help":"...","value":true,"kind":"bool","source":"environment","envVar":"HOTLOOP_ALLOW_WRITES","editable":false},
             {"key":"database.password","group":"Database","label":"Password","help":"Never shown. It comes from the release Secret.","value":"set","kind":"secret","source":"environment","envVar":"HOTLOOP_DB_PASSWORD","editable":false}]}
```

`source` هو `stored` أو `environment` أو `default`. و`secret` لا يكون إلا `set` أو `not set`. `envVar` هو المتغيّر الذي جاءت منه القيمة. بعض الإعدادات تعود إلى متغيّر ثانٍ عندما يكون متغيّر `HOTLOOP_` فارغاً (`TZ` للمنطقة الزمنية، و`POSTGRES_HOST` و`POSTGRES_DB` و`POSTGRES_USER` و`POSTGRES_PASSWORD` لقاعدة البيانات)، وعندما يكون البديل هو النافذ، يسمّيه `envVar`. المتغيّر المضبوط على سلسلة فارغة يُعدّ غير مضبوط، كما يعامله الإعداد. تُعرض إعدادات الاستطلاع بالميلي ثانية، لكن متغيراتها تقبل مدة (`5s` و`500ms`) أو عدداً مجرداً من الثواني.

`product` في المجموعة `Server` يقول أيّ HotLoop هذا. ميزة ليست في هذا المنتج لكن النشر شغّلها على أي حال (لنقل `HOTLOOP_REPORTS_ENABLED=true` على IoT) لا تمنعه من البدء. تُسجَّل كتحذير عند البدء وتُسرد هنا في مجموعة إضافية، `Not in this product`، مع متغيّرها وسطر يقول أين تعيش. يُترك الإعداد كما هو تماماً، فيشغّل الإعداد نفسه الميزة على منتج يملكها. وعندما لا يكون شيء من ذلك مضبوطاً، لا تظهر المجموعة.

### `PUT /api/settings`

يغيّر إعدادات هوية المصنع، وهذه فقط:

| المفتاح | النوع |
|---|---|
| `ui.plantName` | سلسلة، بحد أقصى 200 حرف |
| `ui.siteId` | سلسلة، بحد أقصى 200 حرف |
| `ui.timezone` | اسم IANA تعرفه هذه الآلة (`America/Chicago`) |
| `ui.confirmWrites` | bool |
| `ui.kioskIdleSeconds` | عدد صحيح من الثواني، من 10 إلى 43200: كم يبقى تسجيل دخول الكشك قائماً دون أن يلمس أحد اللوحة. الافتراضي 900 |
| `ui.lockoutAttempts` | عدد صحيح، من 0 إلى 100: كلمات مرور أو أرقام PIN خاطئة متتالية تقفل حساباً. الافتراضي 10، و0 يعني بلا قفل |
| `ui.panelDelaySeconds` | عدد صحيح من الثواني، من 0 إلى 30: أقصى ما تنتظره لوحة الكشك قبل فحص رقم PIN التالي المُدخل بلا اسم مستخدم، بعد أرقام خاطئة. الافتراضي 3، و0 يعني بلا انتظار |
| `ui.lockoutSeconds` | عدد صحيح من الثواني، من 10 إلى 86400: كم يبقى الحساب المقفل مقفلاً. الافتراضي 300 |

```json
{"ui.plantName":"Demo Plant East","ui.timezone":"America/Chicago"}
```

يردّ بالإعدادات الكاملة، كما يفعل `GET`. أي مفتاح آخر يعطي 400 يسمّيه:

```json
{"error":"safety.allowWrites is set by the deployment and cannot be changed here"}
```

هذا مقصود. مفاتيح الكتابة تقرّر هل تستطيع هذه العملية تحريك الآلات، والتحكم الذي يمكن تشغيله من المتصفح نفسه الذي يصدر الكتابات ليس تحكماً. تغييرها نشر.

## وجهات المؤرشف

قواعد بيانات المصنع الخاصة، التي يكتب HotLoop تاريخه فيها إضافة إلى قاعدته. راجع [وجهات المؤرشف](/ar/iot/historian-targets/). كل دور يقرأ الإعدادات يراها ويرى حال كل واحدة. تغيير واحدة للمسؤولين فقط، لأن الوجهة مكان تذهب إليه بيانات المصنع. تُختم كلمات المرور بمفتاح بيانات اعتماد الجهاز (`HOTLOOP_SECRET_KEY_FILE`) ولا يُردّ بها أبداً؛ و`passwordSet` يقول هل واحدة مخزّنة، و`passwordProblem` لماذا لا يمكن فتح المخزّنة. كل تغيير يدخل السجل ويسري فوراً.

### `GET /api/historian/targets`

```json
{"secretKey":true,
 "kinds":[{"id":"postgres","title":"PostgreSQL or TimescaleDB","defaultPort":5432,"defaultTable":"hotloop_history",
    "databaseLabel":"Database","tableLabel":"Table","passwordLabel":"Password","usesUsername":true,"usesOrg":false},
   {"id":"sqlserver","title":"Microsoft SQL Server","defaultPort":1433,"defaultTable":"hotloop_history",
    "databaseLabel":"Database","tableLabel":"Table","passwordLabel":"Password","usesUsername":true,"usesOrg":false},
   {"id":"mysql","title":"MySQL or MariaDB","defaultPort":3306,"defaultTable":"hotloop_history",
    "databaseLabel":"Database","tableLabel":"Table","passwordLabel":"Password","usesUsername":true,"usesOrg":false},
   {"id":"influxdb","title":"InfluxDB 2 or 3","defaultPort":8086,"defaultTable":"hotloop_history",
    "databaseLabel":"Bucket (InfluxDB 3: database)","tableLabel":"Measurement","passwordLabel":"API token",
    "usesUsername":false,"usesOrg":true}],
 "targets":[{"id":"plant-pg","name":"Plant historian","kind":"postgres","address":"db.plant.local:5432",
   "database":"plant","username":"hotloop","table":"hotloop_history","useTls":true,"insecureSkipVerify":false,
   "enabled":true,"createdBy":"admin","passwordSet":true,"createdAt":"2026-10-03T09:12:04Z","updatedAt":"2026-10-03T09:12:04Z",
   "status":{"state":"down","since":"2026-10-03T10:02:11Z","queued":50000,"queueCap":50000,"written":182340,
     "backfilled":0,"dropped":1210,"refused":0,"lastWrite":"2026-10-03T10:02:10Z",
     "lastError":"failed to connect to `user=hotloop database=plant`: dial tcp 10.20.0.9:5432: connect: connection refused",
     "owedFrom":"2026-10-03T10:02:09Z"}}]}
```

`kinds` هي قواعد البيانات التي يكتب إليها هذا HotLoop، وما تسمّيه كل منها حقولها: InfluxDB فيه رمز حيث تملك الأخرى كلمة مرور (`password` يحمله)، وbucket حيث تملك الأخرى قاعدة بيانات (`database`)، وmeasurement حيث تملك جدولاً (`table`)، ومنظمة (`org`) لا تملكها أي من الأخرى. `status.state` هو `up` أو `catching-up` (يعمل، وما زال يرسل ما هو مدين به من تاريخ HotLoop نفسه) أو `down` أو `starting` أو `off` (مُطفأ). `queued` هو ما ينتظر في الذاكرة، من `queueCap`. `written` يعدّ القراءات المرسلة مباشرة و`backfilled` المرسلة من تاريخ HotLoop نفسه. `dropped` يعدّ القراءات التي تركها الطابور بينما لم تستطع الوجهة اللحاق: هي مستحقة، لا ضائعة. `refused` يعدّ القراءات التي رفضت قاعدة البيانات نفسها قبولها، مع سببها في `lastRefusal`. `owedFrom` و`owedTo` هما المستحق بعد؛ و`owedTo` غائب ما دامت النهاية مفتوحة، وهذا ما دامت الوجهة متوقفة.

### `POST /api/historian/targets`

```json
{"id":"plant-pg","name":"Plant historian","kind":"postgres","address":"db.plant.local","database":"plant",
 "username":"hotloop","password":"...","useTls":true}
```

`id` هو من 1 إلى 63 حرفاً صغيراً ورقماً و`-`، ويسمّي الوجهة في سجل النظام. `address` هو `host` أو `host:port`، بلا بيانات دخول فيه؛ والمنفذ الافتراضي للنوع يملأ المنفذ الناقص. `table` افتراضياً هو `defaultTable` للنوع ويمكن أن يحمل مخططاً (`history.hotloop`). `org` هي منظمة InfluxDB 2. `enabled` افتراضياً true. كلمة المرور تحتاج مفتاحاً: بدون `HOTLOOP_SECRET_KEY_FILE` يكون `400`، ولا تُخزَّن أبداً كنص صريح. `201` مع الوجهة وحالتها؛ `409` لمعرّف مأخوذ.

### `PUT /api/historian/targets/{id}`

أي من الحقول أعلاه عدا `id`؛ وما لا يُرسل يبقى. `"password":""` تمسح كلمة المرور. التغيير يعيد تشغيل الوجهة بإعداداتها الجديدة، وما كان مستحقاً لها يبقى مستحقاً. `200` مع الوجهة.

### `DELETE /api/historian/targets/{id}`

يتوقف عن الكتابة إليها وينسى ما كان مستحقاً لها. ما تحمله بالفعل يبقى في قاعدة بياناتها. أطفئها بـ `"enabled":false` بدلاً من ذلك للإبقاء على الإعدادات. `200` `{"deleted":"plant-pg"}`.

## سجل النظام

### `GET /api/events`

كل تغيير وكتابة وتسجيل دخول وانتقال اتصال، الأحدث أولاً.

| الاستعلام | <span class="sr-only">التفاصيل</span> |
|---|---|
| `category` | قابل للتكرار: `system` و`device` و`tag` و`write` و`alarm` و`automation` و`mcp` و`config` و`auth` |
| `severity` | قابل للتكرار: `debug` و`info` و`warning` و`error` |
| `subject` | مطابقة تامة: معرّف جهاز، أو مفتاح وسم، أو entity_id، أو `equipment:4`، أو `label:critical` |
| `q` | بحث لا يميّز حالة الأحرف |
| `minutes` | آخر N دقيقة فقط |
| `limit` | الافتراضي 200، بحد أقصى 5000 |

```json
[{"id":61,"at":"2026-09-27T20:29:23.303795Z","severity":"info","category":"config","subject":"line1-hourly","actor":"admin","message":"report created"}]
```

`actor` هو مستخدم أو `system` أو `automation:<id>` أو `mcp:<client>`. `detail`، عندما يوجد، هو JSON إضافي كسلسلة.

## سجل الأحداث

### `GET /api/logbook`

خط زمني واحد لما حدث، الأحدث أولاً: تغيّرات حالة الكيانات، والكتابات، وانتقالات الإنذارات، وتشغيلات الأتمتة والسكربتات، وتغييرات الإعداد واستدعاءات الخدمات من سجل النظام. تُقرأ المسارات حيث هي وتُدمج، فيحتفظ كل منها بمدة احتفاظه الخاصة. القراءات الرقمية ليست فيه: هذا ما يُستخدم `GET /api/history` من أجله. راجع [سجل الأحداث](/ar/iot/logbook/).

| الاستعلام | <span class="sr-only">التفاصيل</span> |
|---|---|
| `entity` | فقط ما يخص هذا الكيان: تغيّرات حالته، والكتابات إليه وإلى وسومه، وإنذاراته، وتشغيلات الأتمتة التي يطلقها أو التي كتبت إليه، وتغييرات الإعداد عليه |
| `equipment_id` | فقط ما حدث عند هذه العقدة من شجرة المعدات أو تحتها، بالقاعدة نفسها. لا مع `entity` |
| `actor` | جزء، لا يميّز حالة الأحرف، ممن فعله: مستخدم، أو `automation:<id>`، أو `mcp:<client>` |
| `kinds` | مفصولة بفواصل أو مكرّرة: `state` و`write` و`alarm` و`automation` و`event` و`script` و`recipe` |
| `from`, `to` | أوقات RFC 3339؛ `from` شاملة، و`to` غير شاملة |
| `limit` | الافتراضي 100، بحد أقصى 1000 |
| `before` | قيمة `next` من الصفحة السابقة |

```json
{"entries":[
  {"at":"2026-09-28T09:14:02.51Z","kind":"state","id":41,"severity":"info","message":"changed to on (was off)","entity_id":"switch.tank_farm_pump","old_state":"off","state":"on","quality":"good"},
  {"at":"2026-09-28T09:14:02.18Z","kind":"write","id":88,"severity":"info","message":"wrote true to tank-farm/pump (switch.turn_on on switch.tank_farm_pump) (was 0)","actor":"admin","source":"ui","entity_id":"switch.tank_farm_pump","device_id":"tank-farm","tag":"tank-farm/pump","call_id":"5c9f8545a93b5443"},
  {"at":"2026-09-28T09:13:40.02Z","kind":"state","id":37,"severity":"info","message":"changed to closed (was open); 14 changes before this not logged, it was changing faster than the logbook records","entity_id":"valve.infeed","old_state":"open","state":"closed","quality":"good","suppressed":14}
 ],
 "next":"MjAyNi0wOS0yOFQwOToxMzo0MC4wMlp8c3RhdGV8Mzc"}
```

`id` هو معرّف الصف في مساره الخاص (لتغيّر الحالة، المعرّف الثابت للكيان)، ومع `at` و`kind` هو ما يرمّزه `next`: الصفحة التي بعد هذه هي كل ما هو أقدم تماماً بهذا الترتيب، مهما أُضيف في الأثناء. يُحذف `next` في الصفحة الأخيرة. `suppressed` هو عدد تغيّرات ذلك الكيان قبل هذا التغيّر التي لم تُسجَّل، لأنه كان يتغير أسرع من عشرة دفعة واحدة ثم واحد كل ثانيتين.

`400` لنوع غير معروف، أو وقت مشوّه، أو `from` ليس قبل `to`، أو حد يزيد على 1000، أو مؤشر مختلَق، أو `entity` و`equipment_id` معاً؛ `404` لعقدة غير موجودة. `503` عندما لا يعمل سجل الأحداث في العملية التي تردّ.

## البث المباشر

### `GET /api/stream`

أحداث مرسلة من الخادم، في اتجاه واحد، ما دمت تبقيه مفتوحاً. SSE بدلاً من WebSocket لأن الحركة تسير في اتجاه واحد فقط، ويعيد تدفق الأحداث الاتصال من تلقاء نفسه عندما يُعاد تشغيل الـ pod تحت لوحة معلومات مفتوحة. يرسل `EventSource` كوكي الجلسة؛ ويرسل السكربت رمز bearer.

عند الاتصال تحصل على `retry: 3000` ثم الصورة الحالية، فتمتلئ الشاشة قبل أن يتغير أي شيء:

```
retry: 3000

event: snapshot
data: [{"deviceId":"extruder-1","protocol":"opcua","tagName":"Temperature","tagValue":19.553128777917983,"unit":"C","quality":"good","timestamp":"2026-09-27T20:34:23.619589Z"}]

event: alarms
data: {"alarms":[...outstanding alarms...],"summary":{"critical":0,"high":1,"medium":0,"low":0,"unacked":0,"total":1}}

event: entities
data: {"changed":[...every entity state...],"removed":[]}
```

ثم، كلما حدثت الأمور:

| الحدث | البيانات | متى |
|---|---|---|
| `values` | مصفوفة قراءات، بشكل `GET /api/values`، الأحدث لكل وسم، **فقط الوسوم التي تغيّرت قراءتها** | كل 250 ms، إذا تغيّر أي منها. الوسم الذي قيمته ونصه ووحدته وجودته وسببه هي نفسها في آخر ما أُرسل يُترك، ويُرسل مجدداً بعد أن يمرّ 30 ثانية دون إرسال، فلا يكون `timestamp` لقيمة ثابتة أقدم من ذلك أبداً. يقرأ المشغّل كل وسم في كل استطلاع؛ وكان 4.19.5 يرسلها جميعاً في كل مرة (نحو 150 KB أربع مرات في الثانية لـ 2232 وسماً لجهاز اختبار) وتتأخر صفحة على وصلة بطيئة دقائق |
| `entities` | `{"changed": [states], "removed": [entity_ids]}` | كل 250 ms، إذا تغيّرت حالة أي كيان. `removed` هو كيان عُطّل أو حُذف أو أُعيدت تسميته |
| `alarm` | `{"alarm": {...}, "event": "shelved"}`، الإنذار وما حدث له (`raised` و`acked` و`cleared` و`shelved` و`unshelved` و`suppressed` و`unsuppressed`) | فوراً: انتقالات الإنذارات نادرة وكل واحد منها مهم |
| `device` | `{"deviceId":"tank-farm","state":"connected"}` | فوراً: يجب أن تحمرّ الشاشة عندما ينقطع جهاز، لا عند التفريغ التالي |
| `logbook` | `{"kinds":["state","write"]}`، أي أنواع مدخلات سجل الأحداث فيها شيء جديد | مرة واحدة في الثانية على الأكثر. بلا مدخلات فيه، لأن ما يجب أن تعرضه الشاشة يعتمد على مرشحاتها: تطلب من `GET /api/logbook` صفحتها الخاصة |

```
event: alarm
data: {"alarm":{"definitionId":"extruder-temp-hi","state":"shelved","shelvedUntil":"2026-09-27T20:39:45.839983854Z","shelvedBy":"admin","...":"..."},"event":"shelved"}

event: device
data: {"deviceId":"tank-farm","state":"connected"}
```

سطر تعليق (`: heartbeat 2026-09-27T20:35:00Z`) كل 20 ثانية يمنع الوكلاء من إغلاق اتصال خامل. تُنظَّم وتيرة كل صفحة مفتوحة على حدة: كاتبها يستريح بقدر ما استغرق إرساله الأخير (خمس ثوانٍ على الأكثر)، وما يصل في الأثناء يُحتفظ به لكل وسم ولكل كيان، الأحدث فقط، فتبقى صفحة على وصلة بطيئة متأخرة عن المصنع بإرسال أو إرسالين، لا بدقائق، ولا تفقد شيئاً، ولا تأخذ شيئاً من الصفحات الأخرى. يُضغط التدفق بـ gzip عندما يقول الطلب `Accept-Encoding: gzip` (والمتصفح يفعل)، وهذا يخفض أول صورة لجهاز اختبار من نحو 326 KB إلى نحو 11 KB على الخط. يضبط الرد `X-Accel-Buffering: no`، لأن الوكيل الذي يخزّن مؤقتاً يحوّل البث المباشر إلى تنزيل بطيء جداً.

يعيد التدفق النظر في جلسته كل خمس ثوانٍ ويُغلق عندما تزول الجلسة: بتسجيل الخروج، أو الانتهاء، أو الإلغاء، أو تعطيل الحساب أو عدم السماح له بعد الآن بـ `status.read`. لا يرسل أي حدث قبل ذلك. يعيد `EventSource` في المتصفح الاتصال، فيتلقى `401` المذكور أعلاه، ويتوقف. مع `HOTLOOP_AUTH_INSECURE=true` لا توجد جلسة ولا شيء للفحص. لا يُحسب الفحص استخداماً للجلسة، فلا تُبقي شاشة متروكة مفتوحة جلسةً حديثة.

## MCP

### `/mcp` و`/mcp/`

بروتوكول Model Context Protocol، نقل HTTP قابل للبث، للوكلاء. أي أسلوب: يستخدم النقل `POST` للاستدعاءات، و`GET` لتدفق الخادم نفسه، و`DELETE` لإنهاء جلسة. المسار هو `HOTLOOP_MCP_PATH` (`/mcp` افتراضياً) ولا توجد نقطة النهاية إلا عندما يكون `HOTLOOP_MCP_ENABLED` مفعّلاً.

هي **ليست** خلف تسجيل دخول الجلسة. لها رمز bearer خاص بها، `HOTLOOP_MCP_TOKEN`، يُفحص أمام المعالج بحيث لا يستطيع المتصل الذي لا يملكه حتى سرد الأدوات:

```
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="hotloop"

unauthorized
```

عند عدم ضبط رمز، ينشئ HotLoop واحداً عند أول بدء ويحتفظ به في قاعدة بياناته (`hotloop mcp-token` يطبعه)، فلا تكون نقطة النهاية مفتوحة أبداً. الوكيل متصل كأي متصل آخر: يقرأ ويكتب، وتمرّ كتاباته عبر بوابة الكتابة نفسها التي تمرّ بها كتابات الجميع، وتُدقَّق بصيغة `mcp:<client name>`. الأدوات والموارد في [MCP](/ar/iot/mcp/).

```
POST /mcp
Authorization: Bearer <token>
Accept: application/json, text/event-stream

{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"1"}}}
```

يردّ برأس `Mcp-Session-Id` وبقدرات الخادم وتعليماته.

## الواجهة

### `GET /manifest.webmanifest`

بيان تطبيق الويب الذي يتيح لهاتف تثبيت الواجهة كتطبيق: اسم المنتج والمصنع، و`display` `standalone`، وألوان السمة، والأيقونات (ملفات PNG بحجم 192 و512 بكسل، وواحدة 512 قابلة للإخفاء، وSVG) واختصارات إلى الإنذارات ولوحات المعلومات. كل عنوان URL فيه نسبي إلى عنوان البيان نفسه، فهو صحيح أينما رُكّب HotLoop. يتبع الاسم اسم المصنع المضبوط في الإعدادات، والرد هو `Cache-Control: no-cache` حتى يظهر تغيير الاسم عند النظرة التالية. بلا جلسة: الهاتف يسأل قبل أن يسجّل أي أحد الدخول. راجع [لوحات المعلومات](/ar/iot/dashboards/#على-الهاتف).

### `GET /sw.js`

الـ service worker، عند جذر المكان الذي رُكّب فيه HotLoop حتى يغطي نطاقه التطبيق كله. يحتفظ بالصفحة وآخر رد على القراءات التي ينظر إليها شخص، ويردّ بها معلَّمة بأنها قديمة عندما لا يمكن الوصول إلى HotLoop. لا يردّ أبداً على كتابة ولا يحتفظ بها ولا يضعها في طابور. الإصدار الجاري داخله، فيكون لكل إصدار ذاكرة تخزين مؤقت للصفحات خاصة به. `Cache-Control: no-cache`؛ بلا جلسة. لا يشغّله إلا متصفح في سياق آمن (https أو `localhost`).

### `GET /next` و`GET /next/`

المكان الذي كانت الواجهة فيه عندما كانت القديمة هي الافتراضية. كلاهما `301` إلى الجذر، فتظل الإشارة المرجعية المصنوعة حينها تصل.

### `/`

واجهة الويب، مبنية من `web/` داخل الملف التنفيذي: صفحة وسكربتاتها وأنماطها وخطوطها، وservice worker وأيقونات التطبيق القابل للتثبيت، وكل عنوان URL فيها نسبي إلى الصفحة فتعمل عند جذر مضيف، أو تحت مسار، أو خلف وكيل، أو داخل iframe لوحة معلومات EmberNet. يملأ الخادم العنوان وكتلة بيانات واحدة، `<script type="application/json" id="iiot">`، بما لا يعرفه سواه: المصنع والموقع والمنتج والميزات وسياسة الكتابة والمنطقة الزمنية. `GET` و`HEAD` فقط؛ وأي أسلوب آخر `405`. المسار الذي ليس أحد ملفاتها هو `404`، لأن تقديم الصفحة عند خطأ مطبعي سيجعلها تبدو كشاشة تعمل، والملف التنفيذي المبني بدون الواجهة يقول ذلك بنص عادي وكيفية بنائها. بلا جلسة: الصفحة هي نموذج تسجيل الدخول حتى تسجّل الدخول.
