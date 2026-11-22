---
title: "ملف التعريف"
description: "المُدخَل الوحيد لـ HotLoop for CODESYS: ملف JSON فيه مراجعة والجهاز ومتغيراته والإنذارات وشاشة واحدة، وكيف يطبّقه المُهيِّئ."
sidebar:
  label: "ملف التعريف"
---

ملف التعريف ملف JSON واحد في Secret ضمن namespace التثبيت، تحت المفتاح `profile.json`. وهو ليس في الـ chart ولا في صورة المُهيِّئ، فكلاهما عام ومفتوح، ولا يذكر أي منهما أسماء متغيرات أحد. يقدّمه من يثبّت التطبيق. وعلى EmberNet يكتبه Store باسم `<release>-profile`.

يقرؤه المُهيِّئ من جديد في كل جولة، فيصل ملف تعريف أحدث إلى تثبيت قيد التشغيل دون إعادة تشغيل.

## الشكل

| المفتاح | ما يحتويه |
|---|---|
| `revision` | عدد صحيح يبدأ من 1. لا تُستبدل الشاشة والإنذارات إلا حين يكون أعلى من المراجعة التي أنشأتها. |
| `device` | `id` و`name` و`options` (خيارات الموصّل، مثل `browseRoot` و`arrayElements` و`browseMaxNodes`) و`points`، أسماء المتغيرات التي يحتفظ بها HotLoop من PLC. |
| `alarms` | تعريفات إنذارات HotLoop، لكل منها `id`. |
| `dashboard` | شاشة HotLoop واحدة، لها `id`. و[لوحة التحكم](/ar/iot/dashboards/) قائمة من البطاقات. |

ينشئ ملف تعريف واحد شاشة واحدة. وينشئ جهازًا واحدًا من `device`، أو عدة أجهزة من `devices`، وهو ما يُوصف تاليًا.

## قائمة أجهزة

يستطيع ملف التعريف أن يحمل `devices` إلى جانب `device` أو بدلًا منه. كل إدخال هو جسم `POST /api/devices` في HotLoop (`id` و`name` و`protocol` و`address` و`enabled` و`pollIntervalMs` و`timeoutMs` و`config`، وهي كتلة البروتوكول نفسه) مع `tags` الخاصة به، وهي الواصفات التي يستوردها HotLoop للجهاز: `name` و`address` و`dataType` واختياريًا `unit` و`description` و`deviceClass`. ويغطي ذلك مستمع OPC UA PubSub (UADP) مع `dataSets` من نوع RawData، وعميل OPC UA، وعدة أجهزة في ملف تعريف واحد. في كل جولة:

- يُنشأ جهاز ليس لدى HotLoop، ويُترك جهاز موجود عنده، فيبقى تعديل شخص ما حتى تصبح `revision` في ملف التعريف أعلى من التي أنشأت الجهاز؛
- يُستورد كل tag في ملف التعريف ينقص الجهاز، للقراءة فقط؛
- لا شيء من ذلك ينتظر خادم OPC UA في العقدة، فالمستمع يستمع فقط، وبيئة تشغيل متوقفة أو تعيد التشغيل لا تعطّل أي شيء آخر (يظل `device` المفرد يقرأ بيئة التشغيل، وجولة وهي متوقفة تقول ذلك وتعيد المحاولة)؛
- من دون `devices` يعمل ملف التعريف تمامًا كما كان، ومع وجود الاثنين يُطبَّقان معًا.

ما يعنيه لك: مستمع PubSub، مثل مستمع تغذّيه [HotLoop Transmitter](/ar/transmitter/overview/)، يعود مهيّأً من تلقاء نفسه دون PLC يُقرأ منه.

## مثال

هذا ملف التعريف الذي وراء لقطات الشاشة في [النظرة العامة](/ar/codesys/overview/)، مقابل برنامج HotLoop التجريبي. و`GVL_Demo` هو قائمة متغيرات البرنامج التجريبي، والتسميات مختلقة.

```json
{
  "revision": 2,
  "device": {
    "id": "line-2",
    "name": "Line 2 PLC",
    "options": {"browseRoot": "Application.GVL_Demo", "arrayElements": 4, "browseMaxNodes": 500},
    "points": ["GVL_Demo.bRun", "GVL_Demo.rTemp", "GVL_Demo.udiCycles", "GVL_Demo.nEcho", "GVL_Demo.rEcho", "GVL_Demo.rReadOnly"]
  },
  "alarms": [
    {"id": "line-2-mixer-hot", "name": "Mixer temperature high", "tagName": "GVL_Demo.rTemp", "condition": "hi", "limit": 20, "deadband": 0.5, "priority": 2, "message": "{device}/{tag} at {value}, limit {limit}"}
  ],
  "dashboard": {
    "id": "line-2-screen", "name": "Line 2", "description": "The Line 2 screen.", "kind": "cards", "roles": [], "homeFor": [], "screens": [],
    "cards": [
      {"id": "t", "type": "value", "title": "Mixer temperature", "w": 3, "h": 2, "config": {"tag": "line-2/GVL_Demo.rTemp", "decimals": 1}},
      {"id": "tr", "type": "trend", "title": "Mixer temperature, last 15 minutes", "w": 6, "h": 3, "config": {"tags": ["line-2/GVL_Demo.rTemp"], "minutes": 15}},
      {"id": "al", "type": "alarms", "title": "Line 2 alarms", "w": 6, "h": 3, "config": {"outstanding": true, "limit": 8}}
    ]
  }
}
```

الـ `tag` لبطاقة هو معرّف الجهاز وشرطة مائلة واسم النقطة. أنواع البطاقات وشروط الإنذارات وبقية مفاتيح الشاشة هي نفسها في [لوحات التحكم](/ar/iot/dashboards/) في HotLoop و[واجهة HTTP API](/ar/iot/api/).

## ما يفعله المُهيِّئ به

- **ينشئ الجهاز** إن لم يكن هناك جهاز، ويضيف كل متغير في `points` لدى PLC وليس لدى الجهاز.
- **لا يكتب أبدًا في PLC.** كل tag ينشئه للقراءة فقط، وليس لملف التعريف طريقة لوسم واحد منها بأنه قابل للكتابة.
- **ينشئ الإنذارات والشاشة** حين تكون مفقودة، ولا يستبدلها إلا حين تكون `revision` أعلى من التي أنشأتها. فيبقى تغيير أجراه شخص على الشاشة في HotLoop إلى أن يصدر ملف تعريف أحدث عن قصد.
- **يواصل النظر.** كل خمس دقائق، وبوقت أبكر بعد جولة لم تستطع الانتهاء، لأن بيئة التشغيل أو HotLoop لم تكن قد ردّت بعد.
