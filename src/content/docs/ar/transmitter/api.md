---
title: "واجهة HotLoop Transmitter البرمجية"
description: "كل مدخل ومخرج وطريقة في الكتلة الوظيفية الناشرة في HotLoop Transmitter."
---

كل شيء في فضاء الأسماء `HLTX`. والكتلة هي `HLTX.FB_HLTX_Publisher`.

## المداخل

| المدخل | النوع | الافتراضي | المعنى |
|---|---|---|---|
| `bEnable` | BOOL | FALSE | TRUE يفتح المقبس ويبدأ النشر. FALSE يغلقه ويعيد الكتلة إلى `Disabled`، وهذا يمسح أيضًا `ConfigError` |
| `sDestination` | STRING(15) | `127.0.0.1` | عنوان IPv4 منقّط: مضيف unicast، أو مجموعة multicast من 224.0.0.0 إلى 239.255.255.255 |
| `uiPort` | UINT | 4840 | منفذ UDP للوجهة. 4840 هو المنفذ الذي سجّله OPC UA |
| `sLocalAddress` | STRING(15) | فارغ | لـ multicast فقط: عنوان الواجهة التي يُرسَل منها. تركه فارغًا يدع نظام التشغيل يختار |
| `usiMulticastTTL` | USINT | 1 | multicast time to live |
| `uiPublisherId` | UINT | 1 | PublisherId، يُرسل بصيغة UInt16 |
| `uiWriterGroupId` | UINT | 1 | WriterGroupId |
| `uiDataSetWriterId` | UINT | 1 | DataSetWriterId |
| `tPublishingInterval` | TIME | T#100MS | الزمن بين الرسائل. الحد الأدنى T#1MS. لا تستطيع الكتلة الإرسال إلا في دورة، فالمعدل الفعلي هو الفاصل مقرَّبًا إلى الأعلى إلى عدد صحيح من دورات المهمة التي تستدعيها |
| `eEncoding` | `E_HLTX_Encoding` | `Variant` | `Variant` أو `RawData`. غيّره والكتلة معطّلة |
| `udiGroupVersion` | UDINT | 1 | GroupVersion في ترويسة المجموعة |
| `udiConfigMajor`, `udiConfigMinor` | UDINT | 1, 0 | ConfigurationVersion لـ DataSet. ارفع major كلما تغيّرت قائمة الحقول |
| `bTimestamp` | BOOL | TRUE | يضع على كل رسالة طابع ساعة PLC، في NetworkMessage وDataSetMessage (بدقة المللي ثانية، انظر `WIRE-FORMAT.md`). FALSE يرسل بايتات 1.0.0، أقصر بـ 17 بايت |
| `bDeltaFrames` | BOOL | FALSE | ترميز Variant فقط. يرسل Data Delta Frame (الحقول التي تغيرت فقط، لكل منها فهرسه) بين الإطارات الرئيسية، وKeepAlive عند عدم تغير شيء. FALSE يرسل إطارًا رئيسيًا كاملًا في كل مرة، ويقرؤه كل مشترك. المشترك الذي يتجاهل إطارات delta يرى التغيير عند الإطار الرئيسي التالي |
| `uiKeyFrameEvery` | UINT | 10 | مع `bDeltaFrames`: إطار رئيسي كامل كل هذا العدد من الرسائل، ليحصل المشترك الذي انضم متأخرًا على الصورة الكاملة خلال ذلك |
| `bHighResTimestamp` | BOOL | TRUE | يضع الطابع بوقت الساعة بالمللي ثانية عندما يتوفر في وقت التشغيل. FALSE يضع ثواني كاملة، كما كان في 1.1.0 |
| `tRetry` | TIME | T#2S | مدة الانتظار قبل إعادة فتح المقبس بعد فشل عشر عمليات إرسال متتالية |

## المخارج

| المخرج | النوع | المعنى |
|---|---|---|
| `eState` | `E_HLTX_State` | `Disabled` أو `Running` أو `Backoff` (في انتظار إعادة فتح المقبس) أو `ConfigError` (انظر `eError`؛ لا يُرسل شيء) |
| `eError` | `E_HLTX_Error` | `None`, `NoFields`, `BadInterval`, `BadAddress`, `SocketCreate`, `SocketOption`, `TooBig`, `BadField` |
| `bActive` | BOOL | TRUE ما دامت الرسائل تخرج |
| `udiSent` | UDINT | الرسائل المسلَّمة إلى الشبكة |
| `udiSendErrors` | UDINT | عمليات الإرسال التي رفضها نظام التشغيل أو قطعها |
| `udiSkipped` | UDINT | فتحات النشر الفائتة لأن المهمة تأخرت |
| `uiMessageSize` | UINT | بايتات الرسالة الأخيرة |
| `diLastSocketResult` | UDINT | آخر رمز خطأ من بيئة التشغيل لاستدعاء مقبس، و0 يعني سليم |
| `diLastClockResult` | UDINT | آخر نتيجة لقراءة ساعة PLC من أجل طابع زمني، و0 يعني سليم. وعندما لا يكون 0 تخرج الرسالة دون ختم |
| `bDeltaActive` | BOOL | TRUE أثناء استخدام إطارات delta: `bDeltaFrames` مفعّل، وDataSet من نوع Variant، وتتسع الحقول في نسخة القيم السابقة البالغة 4096 بايت |
| `udiDeltaSent`, `udiKeepAliveSent` | UDINT | عدد إطارات Data Delta Frame ورسائل KeepAlive المرسلة |
| `bStampHighRes` | BOOL | TRUE عندما حمل طابع آخر رسالة وقت الساعة بالمللي ثانية، وFALSE عندما رجع إلى الثواني الكاملة أو خرج بلا طابع |
| `udiLastCallUs`, `udiMaxCallUs` | UDINT | الميكروثواني المستغرقة في آخر استدعاء للكتلة، وأطولها منذ التفعيل أو `Clear()` |
| `udiMaxEncodeUs`, `udiMaxSendUs` | UDINT | أطول زمن استُغرق في بناء رسالة واحدة وفي استدعاء الإرسال نفسه، منذ التفعيل أو `Clear()` |

## الطرائق

أضف الحقول مرة واحدة، قبل أول استدعاء، بالترتيب الذي ينبغي أن يقرأها به المستقبِل. تُرجع كل طريقة TRUE عند قبول الحقل. حتى 128 حقلًا.

| الطريقة | تضيف |
|---|---|
| `AddBool(pValue)`, `AddSInt`, `AddUSInt`, `AddInt`, `AddUInt`, `AddDInt`, `AddUDInt`, `AddLInt`, `AddULInt`, `AddReal`, `AddLReal`, `AddTime` | قيمة أحادية. و`pValue` هو `ADR(variable)` |
| `AddString(pValue, uiMaxLen)` | STRING واحدة. و`uiMaxLen` هو N في `STRING(N)` |
| `AddWString(pValue, uiMaxLen)` | WSTRING واحد، يُرسل بترميز UTF-8. `uiMaxLen` هو N في `WSTRING(N)` |
| `AddDataSet(uiWriterId, udiConfigMajor)` | يبدأ DataSet آخر في NetworkMessage نفسها: الحقول المضافة بعده تنتمي إليه. في كل فاصل نشر تحمل NetworkMessage واحدة DataSetMessage لكل DataSet، فيتشارك عدة writer في datagram واحد. حتى 8 DataSet؛ وتتوقف إطارات delta عند وجود أكثر من واحد |
| `SetStatus(pStatus)` | يعطي الحقل المضاف أخيرًا حالة. `pStatus` هو `ADR` لـ UDINT يحمل OPC UA StatusCode. ما دام غير 0 يخرج الحقل بهذا الـ StatusCode بدل قيمته (ترميز Variant)، ويقرؤه المستقبل بجودة سيئة. 0 يرسل القيمة. لا حالة في RawData، فيواصل ناشر RawData إرسال القيمة |
| `AddArray(pFirst, eType, uiCount)` | مصفوفة من `uiCount` عنصرًا من أي نوع عدا STRING وWSTRING. `pFirst` هو `ADR(array[first])` |
| `AddField(pData, eType, uiCount, uiMaxLen)` | الصيغة العامة التي تستدعيها الطرائق الأخرى |
| `Clear()` | تنسى قائمة الحقول وأطول زمن استدعاء |

تحتفظ الكتلة بالعناوين التي تعطيها إياها، لذا بعد تغيير متصل يحرّك المتغيرات استدعِ `Clear()` وأضف الحقول من جديد. تدخل WORD وDWORD وLWORD على أنها UINT وUDINT وULINT عبر الطريقة ذات الحجم نفسه.

## طريقة الاستدعاء

استدعِ النسخة مرة واحدة في كل دورة من مهمة واحدة. لا تستدعِ نسخة واحدة من مهمتين. لا بأس بوجود عدة ناشرين في برنامج واحد، ولكل منهم مقبسه الخاص؛ أعطِ كلًّا منهم writer group id وdataset writer id خاصَّين به.
