---
title: "MCP للوكلاء"
description: "دع وكيلاً يقرأ المصنع كله ولا يلمس إلا ما فعّلته، عبر بوابة الكتابة، مع تسجيل السبب المذكور بجانب كل عملية كتابة."
---

تتحدث البوابة بـ MCP في الاتجاهين: يستطيع الوكلاء قراءة المصنع وتشغيله، وتستطيع قاعدة أتمتة استدعاء أداة في مكان آخر.

قاعدة التصميم أن **الوكيل مستدعٍ كأي مستدعٍ آخر**. تقرأ الأدوات عبر الذاكرة المؤقتة نفسها التي تقرأ منها الواجهة وتكتب عبر البوابة نفسها التي تكتب عبرها الواجهة. لا مسار ذو امتياز، ولا تجاوز، ولا سياسة منفصلة. الكتابة التي كانت سترفض لمشغّل تُرفض؛ والكتابة التي تنجح تقع في جدول التدقيق نفسه و`mcp:` أمام الفاعل.

## التقديم

### عبر HTTP

مفعّل افتراضياً على `/mcp` في منفذ التطبيق، محمي برمز bearer يولّده المخطط في Secret الإصدار.

```bash
kubectl -n hotloop get secret <release> \
  -o jsonpath='{.data.mcp-token}' | base64 -d
```

داخل العنقود، نقطة النهاية هي:

```
http://<release>.<namespace>.svc.cluster.local:8080/mcp
```

يقع فحص الرمز أمام المعالج، فلا يستطيع مستدعٍ غير موثَّق حتى تعداد ما هو موجود. ترك `mcp.token` فارغاً يجعل المخطط يولّد رمزاً، فالنشر الافتراضي ليس المفتوح عن طريق الخطأ. اجمعه مع NetworkPolicy؛ الرمز خط دفاع ثانٍ، وليس الوحيد.

نقطة النهاية ليست مفتوحة أبداً. شغّل الملف التنفيذي بدون `HOTLOOP_MCP_TOKEN` (وحدة Quadlet، أو `hotloop` عارٍ) فيُنشئ رمزاً عند أول بدء ويحتفظ به في قاعدة بياناته، فيعود الرمز نفسه بعد إعادة التشغيل، وعلى كل نسخة، وبعد الاستعادة. يطبعه `hotloop mcp-token` (يقول السجل إنه أنشأ واحداً، ولا يقول أبداً ما هو). اضبط `HOTLOOP_MCP_TOKEN` لاختيار رمزك؛ ومع ضبط `HOTLOOP_MCP_OIDC_*` تقبل نقطة النهاية تسجيل دخول ولا تحتفظ برمز خاص بها. العميل الذي كان يتصل بملف تنفيذي عارٍ بلا شيء يحصل الآن على `401` إلى أن يرسل `Authorization: Bearer <that token>`.

### مع تسجيل دخول Vord أو إقرار من المحور

يقول الرمز الثابت أي عميل استدعى؛ ولا يستطيع أن يقول أي شخص. مع ضبط OIDC تقبل `/mcp` أيضاً `Authorization: Bearer <jwt>`، ويصبح بريد الشخص المتحقَّق منه هو فاعل التدقيق: تقع الكتابة بصيغة `mcp:pat@example.com` بدلاً من `mcp:<client name>`. السلوك بدونه لا يتغير، ويستمر الرمز الثابت في العمل بجانبه (وبدون رمز ثابت مضبوط لا يدخل إلا JWT متحقَّق منه).

| المتغير | قيمة المخطط | وظيفته |
|---|---|---|
| `HOTLOOP_MCP_OIDC_ISSUER` | `mcp.oidc.issuer` | عنوان URL لنطاق Vord؛ يقبل رموز الوصول الخاصة به |
| `HOTLOOP_MCP_OIDC_AUDIENCE` | `mcp.oidc.audience` | قيمة `aud` التي يجب أن يحملها كل رمز؛ مطلوبة مع أي من هذين |
| `HOTLOOP_MCP_OIDC_HUB_JWKS_URL` | `mcp.oidc.hubJwksUrl` | مفاتيح إقرارات محور الهوية؛ يقبل إقراراته |
| `HOTLOOP_MCP_OIDC_REQUIRED_ROLE` | `mcp.oidc.requiredRole` | دور في النطاق يجب أن يحمله المستدعي |
| `HOTLOOP_MCP_OIDC_WRITE_ROLE` | `mcp.oidc.writeRole` | يقيّد الكتابة لكل مستدعٍ، انظر أدناه |

يُفحص رمز وصول Vord مقابل JWKS الجهة المصدِرة (يُعثر عليه عبر وثيقة الاكتشاف الخاصة بها، ويُخزَّن عشر دقائق، ويُجلب مجدداً عند `kid` مجهول): RS256 أو ES256 فقط، و`iss` مساوٍ للمصدِر، و`aud` يحتوي الجمهور، و`exp` و`nbf` مع تفاوت 30 ث، ومطالبة `email` (أو `preferred_username`). يضع Vord افتراضياً `account` فقط في `aud`؛ أعطِ نطاق العميل مُخطِّط جمهور للجمهور الذي تضبطه.

إقرار المحور هو `typ` `fb-assert+jwt`، وEdDSA، و`iss` `fireball-hub`، و`aud` الجمهور المهيَّأ (تُرسل وحدة Hub القيمة `hotloop`)، غير منتهٍ، وموقَّع بمفتاح في JWKS الخاص بـ Hub. لا توجد ذاكرة مؤقتة ضد إعادة التشغيل لـ `jti`: استدعاء أداة واحد هو عدة طلبات HTTP (initialize ثم الاستدعاء) تحمل الإقرار نفسه، الذي يعيش 60 ث. وعندما يقول Hub إن الاستدعاء يعمل نيابة عن شخص آخر (`acting_as`)، يُقرأ الفاعل `mcp:<email> for <acting_as email>`.

ما زالت الكتابة تحتاج `HOTLOOP_ALLOW_WRITES`، المفتاح الرئيسي؛ والرمز لا يوسّعه أبداً. ويضيّقها `HOTLOOP_MCP_OIDC_WRITE_ROLE` لكل مستدعٍ: `hotloop:hotloop.write` تعني دور عميل Vord ‏`hotloop.write` على العميل `hotloop` (`resource_access.hotloop.roles`)، والاسم المجرد يعني دور نطاق، ويجب أن يحمل إقرار Hub اسم الدور في `abilities`. المستدعي الذي لا يملكه يستطيع القراءة لكن `write_tag` و`call_service` و`run_script` و`apply_recipe` و`trigger_automation` وكل أداة تغيّر الإعداد تُرفض. الرمز الثابت لا يقيّده.

### عبر stdio

يخدم الملف التنفيذي نفسه MCP على stdin وstdout بـ `--mcp-stdio`، لعميل يشغّله مباشرة. ويبدأ كل شيء آخر أيضاً، فيرى الوكيل مصنعاً حياً لا خادماً أجوف.

```json
{
  "mcpServers": {
    "hotloop": {
      "command": "/usr/local/bin/hotloop",
      "args": ["--mcp-stdio"],
      "env": {
        "HOTLOOP_DB_HOST": "timescale.plant.local",
        "HOTLOOP_DB_PASSWORD": "…"
      }
    }
  }
}
```

في وضع stdio يذهب كل التسجيل إلى stderr. أي شيء يُكتب إلى stdout سيُفسد تدفق البروتوكول.

## الأدوات

مئة وواحد وسبعون: سبع وعشرون تقرأ المصنع وتأمره، وتسع وستون تغيّر إعداده ([أدناه](#تغيير-الإعداد))، وثلاث وثلاثون عملية قراءة وتشغيل تجريبي تصاحبها ([أدناه](#القراءات-والتشغيلات-التجريبية))، واثنتان وأربعون للإدارة ([أدناه](#الإدارة)).

| الأداة | ما تفعله |
|---|---|
| `get_plant_status` | الأجهزة المتصلة، والإنذارات المعلقة، وهل الكتابة مفعّلة |
| `list_devices` | كل جهاز مع البروتوكول والعنوان والحالة وعدد الوسوم |
| `describe_device` | جهاز واحد بالتفصيل، مع وسومه وإحصاءات الاستطلاع |
| `list_tags` | البحث في الفهرس بحسب الجهاز أو الاسم أو الوصف |
| `read_tag` | القيم الحالية، مع الجودة |
| `query_history` | قراءات تاريخية، خام أو مجمّعة |
| `write_tag` | **يأمر وسماً** |
| `list_alarms` | الإنذارات وحالاتها بحسب ISA-18.2 |
| `ack_alarm` | يقرّ نيابة عن مشغّل |
| `list_automations` | القواعد، وعدد مرات التشغيل، وآخر نتيجة |
| `trigger_automation` | يشغّل قاعدة الآن |
| `describe_protocol` | ما يتحدث به هذا الإصدار فعلاً |
| `recent_events` | سجل النظام، لاستنتاج ما حدث وبأي ترتيب |
| `list_entities` | يجد الكيانات بحسب المجال أو عقدة المعدات أو الوسم، مع الخدمات التي يقبلها كل منها |
| `get_states` | الحالة الحالية لكيان أو أكثر، مع الجودة والسمات |
| `call_service` | **يأمر كياناً**: `switch.turn_on` و`number.set_value` |
| `get_logbook` | خط زمني واحد لتغيّرات الحالة والكتابات والإنذارات وعمليات التشغيل وتغييرات الإعداد، بحسب الكيان أو عقدة المعدات أو الفاعل أو النوع |
| `list_scripts` | سكربتات المصنع، والحقول التي يقبلها كل منها، وهل يعمل، وآخر تشغيل له |
| `run_script` | **يشغّل سكربتاً**، أو يسأل بـ `dryRun` عما كان سيفعله الآن |
| `list_recipes` | وصفات المصنع: الأهداف بالترتيب، والمعاملات، والشرط المسبق، والإصدار، وآخر تطبيق |
| `validate_recipe` | هل ستُطبَّق وصفة الآن؟ كل سبب يجعلها تُرفض؛ لا يُكتب شيء |
| `apply_recipe` | **يطبّق وصفة**: تُفحص كاملة، وتُكتب بالترتيب، وتُقرأ مجدداً |
| `list_blueprints` | المخططات الجاهزة التي يملؤها الناس لإنشاء القواعد، ومدخلاتها وإصداراتها |
| `preview_blueprint` | القاعدة التي سينشئها مخطط جاهز بمدخلات معطاة، وما ستفعله الآن؛ لا ينشئ شيئاً |
| `find_network_client` | مكان جهاز على شبكة المصنع: منفذ المبدّل الخاص به، وهل للمنفذ رابط، ومتى رآه مركز تحكم UniFi آخر مرة |
| `get_network_topology` | شبكة المصنع كما ترسمها وحدة تحكم UniFi: ما المتصل بماذا، وحالة كل جهاز، وأجهزة HotLoop التي تفقد شبكتها إن سقط |
| `get_network_events` | أحدث الأحداث التي أبلغت عنها وحدة تحكم UniFi، وهل websocket الأحداث الخاص بها حي |

### الكيانات

الكيان هو ما يسميه الناس شيئاً في المصنع، `sensor.zone_1_temperature` أو `switch.conveyor_run`، يغلّف وسماً واحداً أو أكثر. انظر [الكيانات](/ar/iot/entities/). وبالنسبة إلى الوكيل هي عادةً المقبض الأفضل: الاسم يعني شيئاً، والكيان يعرف ما يمكن فعله به.

يرشّح `list_entities` بحسب `domain`، وبحسب `equipment` (عقدة من شجرة المعدات بالمعرّف أو الاسم أو مسار الأسماء مثل `Plant A/Packing`، ويطابق كل ما فيها أو تحتها، ويغلب مكان الكيان نفسه على مكان جهازه)، وبحسب `label` (label_id أو الاسم؛ يطابق الكيان إن حمل الوسم أو حمله جهازه) وبحسب `query`، وهو جزء من entity_id أو الاسم. يحمل كل نتيجة حالتها وجودتها الحاليتين والخدمات التي تقبلها، بصيغة `domain.service`. الكيان بلا خدمات للقراءة فقط. تأتي الخدمات من طبقة الكيانات، فالمجال الذي يكتسب واحدة هناك يظهر هنا دون أي تغيير.

يأخذ `get_states` قيمة `entity_ids` ويجيب عن كل منها بحالته وجودته وسماته و`last_changed`. ويحافظ على الخط نفسه الذي يحافظ عليه `read_tag`: الحالة `unknown` أو `unavailable` يُجاب عنها بملاحظة تقول إنها ليست قيمة، والكيان المعطَّل يقول إنه معطَّل بدلاً من أن يكون مفقوداً، والجودة السيئة تُكتب صراحةً.

يأخذ `call_service` القيم `domain` و`service` و`entity_id` و`data` و`reason` **المطلوب**:

```
> call_service domain=number service=set_value entity_id=number.press_01_sp
    data={"value": 212.5} reason="operator asked for 212.5 on zone 1"
Called number.set_value on number.press_01_sp (was 210). Writes: 212.5 to press-01/Setpoint: written
```

يمر عبر `entity.Services`، المنفّذ نفسه الذي يستخدمه `POST /api/services/...`، الذي يحوّل الاستدعاء إلى كتابات عبر بوابة الكتابة. انظر [الكتابة](#الكتابة).

### الشبكة

يجيب `find_network_client` عن السؤال الأول حول PLC صمت: هل هو PLC أم منفذ المبدّل الخاص به؟ أعطه `deviceId` فيتتبع رابط ذلك الجهاز المؤكَّد حتى عميل UniFi الخاص به؛ وأعطه `query` (عنوان MAC أو IP أو جزءاً من اسم) فيبحث في كل وحدة تحكم يقرؤها HotLoop. يقرأ آخر قراءة لمشغّل UniFi، ولا يقرأ وحدة التحكم أبداً، فالوكيل الذي يسأل في حلقة لا يكلّف وحدة التحكم شيئاً. وهذا يعني أيضاً أن مساعد `--mcp-stdio` يجيب بأنه لا تُقرأ أي وحدة تحكم في عمليته: فهو لا يسجّل الدخول إلى أي منها، لأن Gateway المجاور له يمسك الجلسة أصلاً. اسأل نقطة نهاية Gateway. انظر [UniFi Network](/ar/iot/unifi/).

`get_network_topology` هو الخريطة: كل مبدّل ونقطة وصول وبوابة تحت ما هو موصول به، مع المنفذ في الطرفين، والرابط، وعدد العملاء عليه، وأجهزة HotLoop المرتبطة بعميل تحته. وهذا الجزء الأخير هو نطاق الأثر: فهو يسمّي الـ PLC التي تفقد شبكتها إن سقط ذلك المبدّل. المبدّل الذي تسرده وحدة التحكم على أنه غير موصول بأي شيء يقول ذلك ولا يُعلَّق ببوابة. و`get_network_events` هي أحدث أحداث وحدة التحكم، الأحدث أولاً، بجملتها الخاصة، وعلامة تحذير حيث تصفها وحدة التحكم بأنها سلبية، وهل websocket الأحداث حي. يأخذ كلاهما `deviceId` الخاص بوحدة التحكم، ويمكن حذفه حين لا يقرأ HotLoop سوى واحدة، ويقرأ كلاهما آخر قراءة للمشغّل مثل `find_network_client`، فلا يكلّفان وحدة التحكم شيئاً ويقولان الشيء نفسه في مساعد `--mcp-stdio`: لا تُقرأ أي وحدة تحكم في تلك العملية. والأحداث الأقدم في `get_logbook`، مصنّفة تحت المبدّل أو نقطة الوصول التي تخصها.

### دفتر السجل

`get_logbook` هو الخط الزمني الذي يخدمه `GET /api/logbook` (انظر [دفتر السجل](/ar/iot/logbook/)): تغيّرات الحالة، والكتابات، وانتقالات الإنذارات، وتشغيلات الأتمتة، وتغييرات الإعداد، الأحدث أولاً. ويضيّق بحسب `entity`، وبحسب `equipment` (المعرّف أو الاسم أو المسار، وكل ما تحته؛ والاسم الذي يطابق عقدتين خطأ يسرد كلتيهما)، وبحسب `actor` (جزء منه: `mcp:` يجد كل ما فعله أي وكيل)، وبحسب `kinds`، وبحسب `minutes` إلى الخلف (الافتراضي يوم). والصفحة التي يليها المزيد تنتهي بقول ما يُمرَّر على أنه `before` للتالية. وفي سؤال "ماذا حدث قبل أن يسوء هذا" هو `recent_events` الأفضل: فيه تغيّرات حالة المعدات نفسها، وأسطر بوابة الكتابة ليست فيه مرتين.

### السكربتات

السكربت تسلسل مسمّى من الخطوات كتبه أحدهم مرة واحدة، دورة CIP أو تطهير الخط، فينفّذ الوكيل إجراء المصنع نفسه بدلاً من اختراع إجراء. انظر [السكربتات](/ar/iot/scripts/). يقول `list_scripts` ما يقبله كل سكربت. يأخذ `run_script` القيم `scriptId` و`fields` و`reason` **المطلوب** ومفتاحين:

- يمر `dryRun: true` على السكربت مقابل المصنع كما هو ويقول، خطوة بخطوة، ما الذي سيُكتب وأول ما سترفضه البوابة، بكلمات البوابة. لا يُكتب ولا يُدقَّق شيء. اسأل هذا أولاً.
- يجيب `wait: true` بعد انتهاء التشغيل، بنتيجته وأثره. وبدونه تكون الإجابة معرّف التشغيل، ويقول `list_scripts` أو `get_logbook` مع `kinds: ["script"]` كيف انتهى.

التشغيل ملك السكربت، بصيغة `script:<id>`، بالمصدر `mcp`، فتلاقي كل كتابة يجريها البوابة تماماً مثل `write_tag`. ومع إيقاف الكتابة (`HOTLOOP_ALLOW_WRITES`) يرفض `run_script` قبل أن يعمل أي شيء، كما يفعل `trigger_automation`؛ ويُجاب عن التشغيل التجريبي مع ذلك، ويقول إن السبب هو المفتاح.

### الوصفات

الوصفة مجموعة من القيم المضبوطة يطبّقها المصنع معاً، درجة منتج أو تبديل إنتاج، فيحمّل الوكيل أرقام المصنع نفسها بدلاً من كتابتها واحداً واحداً. انظر [الوصفات](/ar/iot/recipes/). يعرض `list_recipes` أهداف كل وصفة بالترتيب والمعاملات التي تقبلها. ويسأل `validate_recipe` هل ستُطبَّق وصفة الآن ويعطي كل سبب لا تُطبَّق من أجله، دون كتابة شيء. ويأخذ `apply_recipe` القيم `recipeId` و`params` و`version` الاختياري و`reason` **المطلوب**.

تُفحص كاملة أولاً وتُرفض كاملة، دون كتابة شيء، إن كانت أي قيمة ستُرفض؛ والقيم خارج النطاق تُرفض، ولا تُعدَّل أبداً. ثم تخرج الأهداف بالترتيب تحت معرّف استدعاء واحد، وأول ما يفشل يوقف الباقي، ولا يُتراجع عن شيء. وتقول الإجابة، هدفاً هدفاً، ما الذي خرج وهل قرأ الجهاز القيمة مجدداً. والكتابات ملك الوكيل، بالمصدر `mcp`، فتنطبق البوابة على كل منها؛ ومع إيقاف الكتابة (`HOTLOOP_ALLOW_WRITES`) يرفض `apply_recipe` قبل أن يُفحص أي شيء. والوصفة التي تسمّي صلاحية تطبيق خاصة بها هي لمن مُنحوها، والوكيل ليس واحداً منهم.

### المخططات الجاهزة

المخطط الجاهز قاعدة كُتبت مرة واحدة بفراغات مضبوطة النوع: أي محرك، ولكم من الوقت، وأي حد. انظر [المخططات الجاهزة](/ar/iot/blueprints/). يقول `list_blueprints` ما يقبله كل منها. ويأخذ `preview_blueprint` القيم `blueprintId` و`automationId` و`inputs` ويجيب بالقاعدة التي سينشئها وما ستفعله تلك القاعدة لو أُطلقت الآن، مع عرض كل كتابة على فحوص البوابة. وتُفحص المدخلات تماماً كما تفحصها الشاشة: خارج النطاق يُرفض ولا يُعدَّل.

ينشئ `instantiate_blueprint` القاعدة، عبر المسار الذي تستخدمه شاشة المخططات الجاهزة: الفحوص نفسها، وتقع القاعدة في دفتر السجل والوكيل هو من أنشأها. والقاعدة أمر دائم بتشغيل المعدات في كل مرة يُطلَق فيها مشغّلها، لذا ينظر الوكيل أولاً: لا يخزّن `preview_blueprint` شيئاً ولا يكتب شيئاً، ويُجاب عنه سواء كانت الكتابة مفعّلة أم لا. وكل كتابة تقوم بها القاعدة المنشأة بعد ذلك تلاقي بوابة الكتابة، كما لقاعدة أنشأها شخص. انظر [تغيير الإعداد](#تغيير-الإعداد).

## تغيير الإعداد

كل ما يستطيع الوكيل قراءته يستطيع تغييره. للأدوات أعلاه التي تقرأ المصنع نظائر تغيّره، تسع وستون، ولا واحدة منها تنفيذ ثانٍ: كل منها مسار واحد من REST API، ويجري الاستدعاء عبر معالج ذلك المسار نفسه. التحقق وفحص الصلاحية وإعادة تحميل وقت التشغيل وسطر التدقيق كلها للمسار، والوكيل هو الفاعل (`mcp:<client>`، أو `mcp:<email>` مع تسجيل دخول Vord)، فالجهاز بلا مشغّل، والقاعدة التي لا تُترجم، ومدخل المخطط الجاهز خارج النطاق، أو الوسم الذي لم يُقبل الجهاز المكتشَف من أجله تُرفض بالكلمات التي تعرضها الشاشة، ولم يتغير شيء.

يأخذ كل منها قيم مسار المسار بالاسم (`id` و`device` و`name`...)، و`body`، وهو JSON نفسه الذي يأخذه API ([واجهة HTTP API](/ar/iot/api/) فيها كل body)، و`reason` **المطلوب**. يُسجَّل السبب سطر `config` في سجل النظام بجانب سطر المسار نفسه، مقابل الشيء الذي تغيّر.

```
> save_tag reason="the setpoint, writable between 0 and 100" body={"deviceId":"press-01",
    "name":"Setpoint","address":"holding:5:uint16","dataType":"int16","enabled":true,
    "writable":true,"hasRange":true,"minValue":0,"maxValue":100}
save_tag done.
{ ...the tag as stored... }
```

ما يقف أمامها هو ما يقف أمام `write_tag`، ناقص المفتاح الرئيسي، لأن الشاشات أيضاً لا تحتاجه لتغيير الإعداد:

1. يجب أن يكون `HOTLOOP_ALLOW_MCP_WRITES`، المفعَّل افتراضياً، مفعَّلاً.
2. يجب أن يملكه المستدعي الذي ضُبط له `HOTLOOP_MCP_OIDC_WRITE_ROLE`.
3. يحمل الاستدعاء صلاحية واحدة، التي يطلبها مساره (العمود الثالث أدناه)، ولا شيء غيرها. يجيب المسار الوكيل كما يجيب شخصاً بلا تلك الصلاحية، ويربط اختبار كل صف في الجدول بمسار حقيقي وبالصلاحية التي يطلبها ذلك المسار.
4. سبب.

يبقى تشغيل المعدات `write_tag` و`call_service` و`run_script` و`apply_recipe` و`trigger_automation` مع `HOTLOOP_ALLOW_WRITES` مفعّلاً وعلامة قابلية الكتابة ونطاق الوسم مستوفيين. وجعل وسم أو قاعدة أو سكربت أو وصفة قابلاً للكتابة هو إعداد: لا يأمر بشيء إلى أن يُستخدم، وما يأمر به حينها يمر عبر البوابة.

وظائف المسؤول نفسها أدوات أيضاً، تحت [الإدارة](#الإدارة) أدناه. وقبول جهاز مكتشَف هنا، كما على الشاشة؛ وما زال يجب تفعيل النقاط عليه للكتابة واحدة واحدة.

الأدوات موجودة في `--mcp-stdio` أيضاً: تبني العملية خادم API نفسه ولا تفتح منفذه أبداً.

**الأجهزة والوسوم**

| الأداة | المسار | الصلاحية |
|---|---|---|
| `save_device` | `POST /api/devices` | `devices.write` |
| `delete_device` | `DELETE /api/devices/{id}` | `devices.write` |
| `set_device_enabled` | `POST /api/devices/{id}/enabled` | `devices.write` |
| `import_device_tags` | `POST /api/devices/{id}/import` | `tags.write` |
| `save_tag` | `POST /api/tags` | `tags.write` |
| `delete_tag` | `DELETE /api/tags/{device}/{name}` | `tags.write` |
| `set_device_labels` | `PUT /api/devices/{id}/labels` | `equipment.write` |
| `set_device_network` | `PUT /api/devices/{id}/network` | `devices.write` |
| `clear_device_network` | `DELETE /api/devices/{id}/network` | `devices.write` |

**الاكتشاف والوسطاء**

| الأداة | المسار | الصلاحية |
|---|---|---|
| `accept_discovered_device` | `POST /api/discovery/{source}/{key}/accept` | `devices.write` |
| `ignore_discovered_device` | `POST /api/discovery/{source}/{key}/ignore` | `devices.write` |
| `unignore_discovered_device` | `POST /api/discovery/{source}/{key}/unignore` | `devices.write` |
| `apply_discovery_review` | `POST /api/discovery/{source}/{key}/review/apply` | `devices.write` |
| `reject_discovery_review` | `POST /api/discovery/{source}/{key}/review/reject` | `devices.write` |
| `accept_network_find` | `POST /api/network-discovery/{key}/accept` | `devices.write` |
| `ignore_network_find` | `POST /api/network-discovery/{key}/ignore` | `devices.write` |
| `unignore_network_find` | `POST /api/network-discovery/{key}/unignore` | `devices.write` |
| `probe_network` | `POST /api/network-discovery/probe` | `devices.write` |
| `create_mqtt_broker` | `POST /api/mqtt/brokers` | `devices.write` |
| `update_mqtt_broker` | `PUT /api/mqtt/brokers/{id}` | `devices.write` |
| `delete_mqtt_broker` | `DELETE /api/mqtt/brokers/{id}` | `devices.write` |
| `probe_integration` | `POST /api/integrations/{id}/probe` | `devices.write` |
| `setup_integration` | `POST /api/integrations/{id}/setup` | `devices.write` |

**UniFi**

| الأداة | المسار | الصلاحية |
|---|---|---|
| `mark_unifi_network_ot` | `PUT /api/unifi/{id}/networks/{network}` | `devices.write` |
| `accept_unifi_known_device` | `PUT /api/unifi/{id}/networks/{network}/known/{mac}` | `devices.write` |
| `forget_unifi_known_device` | `DELETE /api/unifi/{id}/networks/{network}/known/{mac}` | `devices.write` |
| `accept_all_unifi_known_devices` | `POST /api/unifi/{id}/networks/{network}/accept-all` | `devices.write` |
| `create_unifi_starter_alarms` | `POST /api/unifi/{id}/starter-alarms` | `alarms.write` |

**الكيانات والمساعدات والمعدات والوسوم**

| الأداة | المسار | الصلاحية |
|---|---|---|
| `create_entity` | `POST /api/entities` | `entities.write` |
| `update_entity` | `PUT /api/entities/{entity_id}` | `entities.write` |
| `delete_entity` | `DELETE /api/entities/{entity_id}` | `entities.write` |
| `create_energy_meter` | `POST /api/energy/meters` | `energy.write` |
| `update_energy_meter` | `PUT /api/energy/meters/{id}` | `energy.write` |
| `delete_energy_meter` | `DELETE /api/energy/meters/{id}` | `energy.write` |
| `create_helper` | `POST /api/helpers` | `entities.write` |
| `update_helper` | `PUT /api/helpers/{entity_id}` | `entities.write` |
| `delete_helper` | `DELETE /api/helpers/{entity_id}` | `entities.write` |
| `create_equipment` | `POST /api/equipment` | `equipment.write` |
| `update_equipment` | `PUT /api/equipment/{id}` | `equipment.write` |
| `delete_equipment` | `DELETE /api/equipment/{id}` | `equipment.write` |
| `create_label` | `POST /api/labels` | `equipment.write` |
| `update_label` | `PUT /api/labels/{label_id}` | `equipment.write` |
| `delete_label` | `DELETE /api/labels/{label_id}` | `equipment.write` |

**الإنذارات**

| الأداة | المسار | الصلاحية |
|---|---|---|
| `save_alarm` | `POST /api/alarms` | `alarms.write` |
| `delete_alarm` | `DELETE /api/alarms/{id}` | `alarms.write` |
| `shelve_alarm` | `POST /api/alarms/{id}/shelve` | `alarms.ack` |
| `unshelve_alarm` | `POST /api/alarms/{id}/unshelve` | `alarms.ack` |

**الأتمتة والمخططات الجاهزة**

| الأداة | المسار | الصلاحية |
|---|---|---|
| `save_automation` | `POST /api/automations` | `automations.write` |
| `delete_automation` | `DELETE /api/automations/{id}` | `automations.write` |
| `set_automation_enabled` | `POST /api/automations/{id}/enabled` | `automations.write` |
| `upgrade_blueprint_automation` | `POST /api/automations/{id}/blueprint-upgrade` | `blueprints.apply` |
| `instantiate_blueprint` | `POST /api/blueprints/{id}/instantiate` | `blueprints.apply` |
| `create_blueprint` | `POST /api/blueprints` | `blueprints.write` |
| `update_blueprint` | `PUT /api/blueprints/{id}` | `blueprints.write` |
| `delete_blueprint` | `DELETE /api/blueprints/{id}` | `blueprints.write` |

**السكربتات والوصفات**

| الأداة | المسار | الصلاحية |
|---|---|---|
| `create_script` | `POST /api/scripts` | `scripts.write` |
| `update_script` | `PUT /api/scripts/{id}` | `scripts.write` |
| `delete_script` | `DELETE /api/scripts/{id}` | `scripts.write` |
| `stop_script` | `POST /api/scripts/{id}/stop` | `scripts.run` |
| `create_recipe` | `POST /api/recipes` | `recipes.write` |
| `capture_recipe` | `POST /api/recipes/capture` | `recipes.write` |
| `update_recipe` | `PUT /api/recipes/{id}` | `recipes.write` |
| `delete_recipe` | `DELETE /api/recipes/{id}` | `recipes.write` |

**لوحات المعلومات واللوحة**

| الأداة | المسار | الصلاحية |
|---|---|---|
| `create_dashboard` | `POST /api/dashboards` | `dashboards.write` |
| `update_dashboard` | `PUT /api/dashboards/{id}` | `dashboards.write` |
| `delete_dashboard` | `DELETE /api/dashboards/{id}` | `dashboards.write` |
| `save_board` | `PUT /api/board` | `board.write` |

**الاستيراد**

| الأداة | المسار | الصلاحية |
|---|---|---|
| `import_codesys_alarms` | `POST /api/alarms/import/codesys` | `alarms.write` |
| `screen_import` | `POST /api/dashboards/import` | `dashboards.write` |

يأخذ `import_codesys_alarms` الملف الذي كتبه Export Alarms في بيئة CODESYS، على أنه `contentBase64` (البايتات كما هي على القرص، التي تكتبها البيئة بترميز UTF-16) أو `content` (النص، إن كان لديك نصاً)، مع `deviceId` الذي تنتمي إليه الإنذارات، وإن أردتها `application` و`defaultPriority`. وإن تُرك على حاله فإنه يعاين فقط: يقول أي الإنذارات ستُنقل وأيها لن تُنقل، ولا يحفظ شيئاً ولا يحتاج سبباً. ومع `apply` true يحفظها تعريفات إنذارات، وعندها يحتاج سبباً ومفتاح كتابة MCP كأي أداة تغيّر الإعداد.

يجيب `screen_export` بلوحة معلومات على أنها ملف شاشة HotLoop ([ملفات الشاشة](/ar/iot/screen-file/))، ويقبل `screen_import` واحداً، على هذا التثبيت أو على آخر. ويسأل أولاً: `dryRun` يكون true ما لم تقل false، والتشغيل التجريبي لا يحفظ شيئاً ويجيب بالتقرير مع سرد كل مشكلة والمراجع لـ `remap`. والاستيراد الحقيقي يحتاج `dryRun` false وسبباً ومفتاح كتابة MCP، والمعرّف الموجود يُرفض ما لم يكن `replace` هو true. الشاشة بيانات العميل، فالملف هو الطريقة التي تنتقل بها بين التثبيتات، وليس شيفرة أبداً.

### القراءات والتشغيلات التجريبية

الوكيل الذي يستطيع تغيير لوحة معلومات أو وسيط أو عقدة من شجرة المعدات يجب أن يستطيع قراءة ما هو موجود أولاً، لذا فلكل كائن تغيّره أداة أعلاه قراءة هنا، والتشغيلات التجريبية للمحررات أدوات أيضاً. كل منها مسار واحد يجري عبر معالجه الخاص بصلاحية القراءة التي يطلبها ذلك المسار. القراءة تجيب بلا سبب وبلا مفتاح الكتابة، والمستدعي الذي يستبعده دور الكتابة يستطيع مع ذلك إجراءها، لأنها تحمل صلاحية قراءة ولا شيء أكثر. أما التشغيلات التجريبية الثلاثة (`validate_automation` و`validate_script` و`browse_device`) فلا تغيّر شيئاً؛ والاثنان اللذان يفحصان جسماً يحملان صلاحية الكتابة التي يطلبها مساراهما، فيبقيان خلف دور الكتابة.

| الأداة | المسار | الصلاحية |
|---|---|---|
| `list_alarm_definitions` | `GET /api/alarms` | `alarms.read` |
| `list_composite_entities` | `GET /api/entities/composites` | `entities.read` |
| `list_energy_meters` | `GET /api/energy/meters` | `energy.read` |
| `get_energy_meter` | `GET /api/energy/meters/{id}` | `energy.read` |
| `get_energy_summary` | `GET /api/energy/summary/{period}` | `energy.read` |
| `get_energy_series` | `GET /api/energy/series/{meter}/{period}/{step}` | `energy.read` |
| `list_alarm_events` | `GET /api/alarms/events` | `alarms.read` |
| `screen_export` | `GET /api/dashboards/{id}/export` | `dashboards.read` |
| `list_dashboards` | `GET /api/dashboards` | `dashboards.read` |
| `get_dashboard` | `GET /api/dashboards/{id}` | `dashboards.read` |
| `get_board` | `GET /api/board` | `values.read` |
| `list_equipment` | `GET /api/equipment` | `equipment.read` |
| `get_equipment` | `GET /api/equipment/{id}` | `equipment.read` |
| `list_labels` | `GET /api/labels` | `equipment.read` |
| `get_label` | `GET /api/labels/{label_id}` | `equipment.read` |
| `list_discovered_devices` | `GET /api/discovery` | `devices.read` |
| `get_discovered_device` | `GET /api/discovery/{source}/{key}` | `devices.read` |
| `list_network_finds` | `GET /api/network-discovery` | `devices.read` |
| `get_network_find` | `GET /api/network-discovery/{key}` | `devices.read` |
| `list_integrations` | `GET /api/integrations` | `devices.read` |
| `list_mqtt_brokers` | `GET /api/mqtt/brokers` | `devices.read` |
| `get_blueprint` | `GET /api/blueprints/{id}` | `blueprints.read` |
| `get_script` | `GET /api/scripts/{id}` | `scripts.read` |
| `list_automation_runs` | `GET /api/runs` | `automations.read` |
| `list_script_runs` | `GET /api/scripts/{id}/runs` | `scripts.read` |
| `list_unifi_consoles` | `GET /api/unifi/consoles` | `devices.read` |
| `list_unifi_networks` | `GET /api/unifi/{id}/networks` | `devices.read` |
| `list_unifi_known_devices` | `GET /api/unifi/{id}/known` | `devices.read` |
| `get_device_network` | `GET /api/devices/{id}/network` | `devices.read` |
| `get_diagnostics` | `GET /api/diagnostics` | `status.read` |
| `browse_device` | `POST /api/devices/{id}/browse` | `devices.read` |
| `validate_automation` | `POST /api/automations/validate` | `automations.write` |
| `validate_script` | `POST /api/scripts/validate` | `scripts.write` |

### الإدارة

حسابات المستخدمين، والإعدادات، والنسخ الاحتياطية، وسياسة التصعيد، وأهداف المؤرشف التاريخي، وحسابات دخول الوسيط، وأسطول مرحّلات edge، والتقارير المجدولة هي للمسؤول، وهي أدوات أيضاً: اثنتان وأربعون، بالنمط نفسه كالباقي. كل منها مسار واحد يجري عبر معالجه الخاص بالصلاحية التي يطلبها ذلك المسار (`users.manage` و`settings.write` و`backup.run` و`fleet.restart`...)، وسبب لكل تغيير والوكيل في سطر التدقيق. والمسار الذي يرفض يرفض الوكيل بالكلمات نفسها. وقراءاتها (أدوات `list_` و`get_`) لا تحتاج سبباً ولا مفتاح كتابة، وما زالت تحتاج دور الكتابة للمستدعي حين يكون مضبوطاً، لأن الصلاحية التي تحملها هي صلاحية مسؤول. وأدوات الأسطول والتقارير موجودة فقط في منتج فيه الميزة.

أمران خاصان بالمسارات نفسها ويستحقان المعرفة قبل الاعتماد على أداة:

- **مفاتيح الكتابة ليس لها مسار.** `safety.allowWrites` و`safety.allowMcpWrites` للنشر (`HOTLOOP_ALLOW_WRITES` و`HOTLOOP_ALLOW_MCP_WRITES`)، ويرفضها `PUT /api/settings` على أنها مضبوطة من النشر. لذا يغيّر `save_settings` ما تستطيع شاشة الإعدادات تغييره ويجيب بذلك الرفض بالنسبة إلى المفاتيح، بتلك الكلمات. لا يستطيع الوكيل تشغيل المفتاح الذي تنتظره كتاباته هو.
- **كلمة مرور المستخدم تمر عبر الاستدعاء.** تأخذ `create_user` و`reset_user_password` وأدوات PIN سراً في وسائطها، كما يفعل API. ويسمّي سطر التدقيق التغيير والسبب ولا يسمّي السر أبداً.

**حسابات المستخدمين**

| الأداة | المسار | الصلاحية |
|---|---|---|
| `list_users` | `GET /api/users` | `users.manage` |
| `create_user` | `POST /api/users` | `users.manage` |
| `update_user` | `PUT /api/users/{username}` | `users.manage` |
| `delete_user` | `DELETE /api/users/{username}` | `users.manage` |
| `reset_user_password` | `POST /api/users/{username}/password` | `users.manage` |
| `unlock_user` | `DELETE /api/users/{username}/lockout` | `users.manage` |
| `set_user_pin` | `PUT /api/users/{username}/pin` | `users.manage` |
| `clear_user_pin` | `DELETE /api/users/{username}/pin` | `users.manage` |
| `list_opcua_certificates` | `GET /api/opcua/certificates` | `users.manage` |
| `list_user_certificates` | `GET /api/users/{username}/certificates` | `users.manage` |
| `add_user_certificate` | `POST /api/users/{username}/certificates` | `users.manage` |
| `revoke_user_certificate` | `POST /api/users/{username}/certificates/{thumbprint}/revoke` | `users.manage` |
| `delete_user_certificate` | `DELETE /api/users/{username}/certificates/{thumbprint}` | `users.manage` |

**الإعدادات والنسخ الاحتياطية والإشعارات**

| الأداة | المسار | الصلاحية |
|---|---|---|
| `get_settings` | `GET /api/settings` | `settings.read` |
| `save_settings` | `PUT /api/settings` | `settings.write` |
| `list_backups` | `GET /api/backup` | `backup.read` |
| `run_backup` | `POST /api/backup` | `backup.run` |
| `get_escalation` | `GET /api/notify/escalation` | `notify.escalation` |
| `save_escalation` | `PUT /api/notify/escalation` | `notify.escalation` |
| `send_test_notification` | `POST /api/notify/test` | `notify.test` |

**أهداف المؤرشف التاريخي وحسابات دخول الوسيط**

| الأداة | المسار | الصلاحية |
|---|---|---|
| `list_historian_targets` | `GET /api/historian/targets` | `settings.read` |
| `create_historian_target` | `POST /api/historian/targets` | `settings.write` |
| `update_historian_target` | `PUT /api/historian/targets/{id}` | `settings.write` |
| `delete_historian_target` | `DELETE /api/historian/targets/{id}` | `settings.write` |
| `list_broker_logins` | `GET /api/broker/logins` | `users.manage` |
| `create_broker_login` | `POST /api/broker/logins` | `users.manage` |
| `update_broker_login` | `PUT /api/broker/logins/{name}` | `users.manage` |
| `delete_broker_login` | `DELETE /api/broker/logins/{name}` | `users.manage` |

**أسطول مرحّلات edge ‏(Gateway)**

| الأداة | المسار | الصلاحية |
|---|---|---|
| `list_fleet` | `GET /api/fleet` | `fleet.read` |
| `register_relay` | `POST /api/fleet` | `fleet.write` |
| `delete_relay` | `DELETE /api/fleet/{id}` | `fleet.write` |
| `rebirth_relay` | `POST /api/fleet/{id}/rebirth` | `fleet.rebirth` |
| `restart_relay` | `POST /api/fleet/{id}/restart` | `fleet.restart` |
| `update_relay` | `POST /api/fleet/{id}/update` | `fleet.update` |
| `set_relay_config` | `POST /api/fleet/{id}/config` | `fleet.config` |
| `clear_relay_config` | `DELETE /api/fleet/{id}/config` | `fleet.config` |

**التقارير المجدولة (Gateway)**

| الأداة | المسار | الصلاحية |
|---|---|---|
| `list_reports` | `GET /api/reports` | `reports.read` |
| `get_report` | `GET /api/reports/{id}` | `reports.read` |
| `create_report` | `POST /api/reports` | `reports.write` |
| `update_report` | `PUT /api/reports/{id}` | `reports.write` |
| `delete_report` | `DELETE /api/reports/{id}` | `reports.write` |
| `run_report` | `POST /api/reports/{id}/run` | `reports.run` |

## الموارد

| URI | المحتويات |
|---|---|
| `iiot://devices` | شجرة الأجهزة مع الوسوم، بصيغة JSON |
| `iiot://tags` | فهرس الوسوم مع القيم الحالية |
| `iiot://alarms` | تعريفات الإنذارات، والحالة الحية، ومرجع للحالات |
| `iiot://protocols` | البروتوكولات المدعومة، من المشغّلات المترجمة |

توجد الموارد ليستطيع العميل سحب مساحة الأسماء كلها بقراءة واحدة بدلاً من اكتشافها استدعاء أداة تلو آخر.

## ما لن تفعله الأدوات

كُتبت الأدوات بحيث لا يستطيع نموذج تقريب عدم اليقين بالخطأ.

**الوسم بلا قراءة ليس وسماً يقرأ صفراً.** يقول `read_tag` ‏`no reading has been taken for this tag yet`، أو `this tag is not configured` إن لم يكن موجوداً. ولا يعيد أي منهما قيمة.

**الجودة السيئة تُذكر صراحة ولا تُلمَّح.** تعود القراءات بصيغة `[quality: bad (the value is NOT known; do not treat it as a measurement)]`. وتكرر تعليمات الخادم ذلك. لا تأخذ متوسطاً عبر قراءات سيئة ولا تبلغ عن واحدة منها على أنها قياس.

**`describe_protocol` لا يستطيع الكذب.** تأتي الإتاحة من المشغّلات المترجمة داخل الملف التنفيذي، فلا تستطيع الأداة ادعاء بروتوكول لا تملكه البوابة.

**الرفض إجابة وليس عطلاً في النقل.** تعود الكتابة المرفوضة نتيجة أداة مع `isError`، ما يعني أن الاستدعاء كان سليم الصياغة ورُفض عمداً. وهو ليس خطأ بروتوكول يُعاد.

## الكتابة

يقرأ MCP ويكتب: يأمر المعدات، ويغيّر الإعداد ([أعلاه](#تغيير-الإعداد)). يحرّك `write_tag` معدات حقيقية، لذا فالأشياء نفسها التي تقف بين نقرة مشغّل وآلة تقف بين استدعاء أداة وآلة:

1. يجب أن يكون `HOTLOOP_ALLOW_WRITES`، المفتاح الرئيسي للنشر كله، مفعّلاً. ومع إيقافه لا يكتب شيء: لا الواجهة ولا API ولا وكيل.
2. يجب أن يكون الوسم معلَّماً بأنه قابل للكتابة. الوسوم للقراءة فقط إلى أن يقول أحدهم غير ذلك، واحداً واحداً.
3. يجب أن تكون القيمة ضمن نطاق الوسم المهيَّأ. وهي **تُرفض ولا تُقصّ**: إرسال 400 حين طلب أحدهم 500 هو فعل شيء مختلف عما طُلب بصمت.

**السبب مطلوب** ويُسجَّل بجانب الكتابة. سطر التدقيق الذي لا يستطيع أحد تفسيره بعد ستة أشهر ليس أفضل من لا شيء إلا قليلاً.

يحصل `call_service` على الثلاثة نفسها بالضبط، لأنه لا شيء غير كتابات عبر البوابة نفسها، ثم فحوص الكيان نفسه فوقها (خطوة الرقم ونطاقه الأضيق، ونمط النص، وألا يكون الكيان معطَّلاً). والرفض عند أي منها يُدقَّق مقابل الكيان وكذلك الوسم: المصدر `mcp`، والعميل بالاسم، وentity_id، والخدمة، ومعرّف الاستدعاء، وهو السطر نفسه الذي يتركه `write_tag` مرفوض زائداً الكيان. والاستدعاء بلا سبب يُرفض قبل أن يُحاوَل أي شيء، مثل `write_tag`.

`trigger_automation` مقيَّد بالطريقة نفسها، لأن إجراءات القاعدة تستطيع أمر المعدات؛ وإلا لكان طريقاً للالتفاف على الفحوص التي يلاقيها `write_tag`.

```
> write_tag tag=press-01/Zone1_Temp value=99 reason="testing"
write refused: press-01/Zone1_Temp: this tag is not marked writable
```

عندما تكون الكتابة موقوفة تقول تعليمات الخادم ذلك مقدماً، فلا يضيع الوكيل دوراً في اكتشافه.

## الاستدعاء إلى الخارج

يستدعي إجراء `mcp_call` في الأتمتة أداة على خادم MCP آخر. هيّئ الخوادم في المخطط:

```yaml
mcp:
  outboundServers:
    - name: maintenance
      url: http://maintenance-mcp.default.svc.cluster.local:8080/mcp
      existingSecret: maintenance-mcp-token
      secretKey: token
```

تُجمَّع الجلسات وتُعاد استخدامها؛ فالاتصال عند كل استدعاء يعني مصافحة وinitialize وسرد أدوات في كل مرة تُطلَق قاعدة. والجلسة التي ماتت يُعاد وصلها عند الاستدعاء التالي لا بمؤقّت، لأن الاستدعاء التالي هو أول لحظة يهتم فيها أحد. والخادم المهيَّأ المتوقف لا يوقف مراقبة المصنع، فلا يُطلب شيء حتى تحتاجه قاعدة.

تعرض شاشة MCP كل خادم مهيَّأ، وهل هو متصل، والأدوات التي يعلنها.

## توحيد المواقع

بوابة واحدة لكل مصنع هي الطريقة المقصود أن يعمل بها هذا. يحتفظ كل موقع بقاعدة بياناته ولوحته واسمه، ولا يعتمد أي منها على بقاء رابط إلى مكان آخر قائماً، فالمصنع لا يتوقف عن المراقبة لأن الـ WAN سقطت.

رؤيتها كلها دفعة واحدة تستخدم البروتوكول الذي تتحدث به المواقع أصلاً. هيّئ بوابة في السحابة مع المواقع بوصفها خوادم MCP صادرة، تماماً كما في إجراء `mcp_call`:

```
HOTLOOP_MCP_SERVER_1_NAME=akron
HOTLOOP_MCP_SERVER_1_URL=https://akron.example/mcp
HOTLOOP_MCP_SERVER_1_TOKEN=…
HOTLOOP_MCP_SERVER_2_NAME=ashtabula
HOTLOOP_MCP_SERVER_2_URL=https://ashtabula.example/mcp
HOTLOOP_MCP_SERVER_2_TOKEN=…
```

ثم تستدعي شاشة المواقع `get_plant_status` على كل منها بالتوازي وتجمع الإجابات. لا شيء يُنشر في موقع ليظهر، ولا يحتاج أي موقع إلى معرفة أنه موحَّد، ولا شيء يتصل إلى الداخل نحو شبكة مصنع.

سلوكان مقصودان ويمكن الاعتماد عليهما:

- الموقع الذي لا يجيب يظهر على أنه **غير قابل للوصول، مع السبب**، ويُترك خارج التجميع. أن يُحتسب مصنع لا تصل إليه على أنه صفر إنذارات هو أسوأ ما يمكن أن تفعله شاشة كهذه.
- الأرقام التي أبلغ عنها موقع آخر مرة لا تُعرض أبداً. تبدو حالية وليست كذلك.

يحصل كل موقع على مهلة قصيرة خاصة به، فلا يستطيع مصنع على رابط ميت أن يؤخّر المصانع العاملة.

## ما يستحق أن يُقال لوكيل

تغطي تعليمات الخادم نفسها هذا، لكن لمن يكتب موجِّهاً حوله:

- تتبع حالات الإنذارات ISA-18.2. تعني `rtn-unack` إنذاراً عاد إلى الوضع الطبيعي من تلقاء نفسه قبل أن يراه أحد، ولا يزال يستحق الإبلاغ، وهي الحالة التي تثبت أن الإقرار والعودة إلى الطبيعي مستقلان.
- استخدم `query_history` مع التجميع، لا الخام، لأي شيء أطول من بضع دقائق. يوم من بيانات الثانية الواحدة هو 86,400 نقطة لكل وسم. وتتبع المجموعات قاعدة الجودة: تُحصى القراءات السيئة وغير المؤكدة في `badReadings` ولا تدخل المتوسط أبداً، والمجموعة التي ليس فيها شيء جيد متوسطها null.
- `recent_events` هو الطريقة لإعادة بناء حادثة: اتصالات الأجهزة، والكتابات، وانتقالات الإنذارات، وتشغيلات الأتمتة، وتغييرات الإعداد، بالترتيب، كل منها مع الفاعل الذي سببه.
