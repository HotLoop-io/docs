---
title: "ما يمر على الخط"
description: "رسالتا NetworkMessage وDataSetMessage اللتان يرسلهما HotLoop Transmitter، بايتًا بايتًا، مع أقسام OPC 10000-14 وOPC 10000-6 التي تعرّف كل بايت."
---

كل بايت أدناه مأخوذ من OPC 10000-14 (الجزء 14، PubSub) الإصدار 1.05 ومن OPC 10000-6 (الجزء 6، التعيينات)، وقد قُرئا على reference.opcfoundation.org بتاريخ 2026-10-31. أرقام الأقسام هي ما يجب فتحه حين يبدو بايت خاطئًا. ولم يُتعلَّم شيء هنا من النظر إلى حزم بيانات أي مورّد آخر.

ترسل كتلة ناشر واحدة رسالة NetworkMessage واحدة في كل فاصل نشر. وتحمل NetworkMessage رسالة DataSetMessage واحدة، هي Data Key Frame، فكل رسالة تحتوي كل حقل. ومنذ 1.1.0 تحمل كل رسالة طابعًا زمنيًا من ساعة PLC، في NetworkMessage وفي DataSetMessage معًا، ما لم تكن `bTimestamp` تساوي FALSE، وعندها تكون البايتات هي بايتات 1.0.0 تمامًا. تعرض الجداول الحالتين: الصفوف المعلَّمة بأنها مختومة لا توجد إلا حين يكون الطابع الزمني مفعّلًا.

كل القيم متعددة البايتات little endian، كما يعرّف ذلك OPC UA binary؛ وتكتبها الكتلة بايتًا بايتًا، فلا يهم ترتيب بايتات المضيف.

## NetworkMessage (الجزء 14، 7.2.4.4.2)

| البايتات | القيمة | المعنى |
|---|---|---|
| 1 | `F1` | UADPVersion 1 في البتات 0 إلى 3. UADPFlags في البتات 4 إلى 7: PublisherId (البت 4) وGroupHeader (البت 5) وPayloadHeader (البت 6) وExtendedFlags1 (البت 7)، وكلها موجودة |
| 1 | `21` مختومة، `01` غير مختومة | ExtendedFlags1: نوع PublisherId هو 001 = UInt16 في البتات 0 إلى 2، وTimestamp (البت 5) عند الختم. بلا DataSetClassId، وبلا ترويسة أمان، وبلا PicoSeconds، وبلا ExtendedFlags2 |
| 2 | PublisherId | `uiPublisherId` |
| 1 | `0F` | GroupFlags: WriterGroupId وGroupVersion وNetworkMessageNumber وSequenceNumber موجودة |
| 2 | WriterGroupId | `uiWriterGroupId` |
| 4 | GroupVersion | `udiGroupVersion` |
| 2 | NetworkMessageNumber | دائمًا 1، لأن 0 غير صالح |
| 2 | SequenceNumber | يعدّ الرسائل المرسلة، ويعود إلى الصفر بعد 65535 |
| 1 | Count | دائمًا 1 (ترويسة الحمولة، 7.2.4.5.2) |
| 2 | DataSetWriterId | `uiDataSetWriterId` |
| 8 | Timestamp، للمختومة فقط | Timestamp الخاص بـ NetworkMessage (7.2.4.4.2)، وهو DateTime (الجزء 6، 5.2.2.5): نبضات 100 ns منذ 1601-01-01 00:00:00 UTC بصيغة Int64. يأتي بعد ترويسة الحمولة وقبل DataSetMessage |

لأن Count يساوي 1، لا تحتوي الحمولة مصفوفة Sizes. ولا ترسل الكتلة رسائل مجزّأة ولا رسائل اكتشاف ولا حقولًا مرقّاة ولا ترويسة أمان، والمستقبِل الذي يشترط واحدًا منها لا تخدمه هذه النسخة.

## DataSetMessage (الجزء 14، 7.2.4.5.4 و7.2.4.5.5)

| البايتات | القيمة | المعنى |
|---|---|---|
| 1 | `69` Variant، `6B` RawData؛ ومختومة `E9` و`EB` | DataSetFlags1: صالح (البت 0)، وترميز الحقول (البتان 1 و2: 00 Variant، 01 RawData)، ورقم التسلسل (البت 3)، وConfigurationVersion major (البت 5) وminor (البت 6)، وDataSetFlags2 (البت 7) عند الختم. الحالة (Status) غائبة. وبلا ختم تغيب DataSetFlags2 أيضًا ويكون النوع هو الافتراضي، Data Key Frame |
| 1 | `10`، للمختومة فقط | DataSetFlags2: نوع الرسالة 0 (Data Key Frame) في البتات 0 إلى 3، وTimestamp (البت 4) |
| 2 | رقم تسلسل DataSetMessage | يعدّ الرسائل المرسلة، ويعود إلى الصفر بعد 65535 |
| 8 | Timestamp، للمختومة فقط | Timestamp الخاص بـ DataSetMessage (7.2.4.5.4)، وهو DateTime نفسه الخاص بـ NetworkMessage، بعد رقم التسلسل |
| 4 | ConfigurationVersion major | `udiConfigMajor` |
| 4 | ConfigurationVersion minor | `udiConfigMinor` |
| 2 | FieldCount | لـ Variant فقط. يُحذف مع RawData (7.2.4.5.5) |
| ... | الحقول | بالترتيب الذي أُضيفت به |

## عدة DataSetMessage في NetworkMessage واحدة

بعد `AddDataSet` يكون Count في PayloadHeader هو عدد DataSet ويسرد كل DataSetWriterId، ويبدأ الحمل بمصفوفة Sizes، حجم بالبايت UInt16 لكل DataSetMessage (7.2.4.5.3)، ثم DataSetMessage واحدة تلو الأخرى. يستخدم DataSet 1 معرّف writer ورقم التسلسل وConfigurationVersion الخاصة بالكتلة؛ ولكل DataSet آخر معرّف writer ونسخة رئيسية ورقم تسلسل DataSetMessage خاصة به. Timestamp لـ NetworkMessage ولكل DataSetMessage هو اللحظة نفسها. من دون `AddDataSet` تكون الرسالة كما كانت تمامًا، Count 1 ولا Sizes.

## إطارات delta وKeepAlive

مع `bDeltaFrames` يكون نوع DataSetMessage في DataSetFlags2 (البتات 0 إلى 3) هو 0 للإطار الرئيسي و1 لـ Data Delta Frame و3 لـ KeepAlive، ويبقى بت Timestamp كما كان. يخرج إطار رئيسي أولًا ثم كل `uiKeyFrameEvery` رسالة. وبينها تقارن الكتلة متغير كل حقل (وحالته) بما حملته الرسالة الأخيرة: إطار delta هو `FieldCount` للحقول التي تغيرت (UInt16)، ثم لكل حقل `FieldIndex` بدءًا من الصفر (UInt16) وVariant الخاص به؛ وإذا لم يتغير شيء تكون الرسالة KeepAlive، أي ترويسة DataSetMessage بلا حمل. تحمل KeepAlive رقم تسلسل DataSetMessage التالية ولا تستهلكه، بينما يحسبها رقم تسلسل NetworkMessage. تُرسل مجموعات RawData إطارات رئيسية دائمًا.

## الطابع الزمني

تقرأ الكتلة ساعة الزمن الحقيقي في PLC مرة لكل رسالة بـ `SysTimeRtcHighResGet` (مكتبة النظام SysTimeRtc التي يوفرها وقت التشغيل)، وهي مللي ثانية منذ 1970-01-01 UTC، وتكتب `milliseconds * 10000 + 11644473600 * 10000000` بوصفها DateTime. الطابعان الزمنيان في الرسالة هما هذه القيمة الواحدة. إذا لم يستطع وقت التشغيل الرد على الاستدعاء عالي الدقة، أو كان `bHighResTimestamp` يساوي FALSE، تقرأ `SysTimeRtcGet` (ثوانٍ كاملة) وتكتب `(seconds + 11644473600) * 10000000`، كما كان في 1.1.0. ويتبع ذلك أمران:

* الدقة مللي ثانية واحدة (يبيّن `bStampHighRes` أي ساعة استخدمتها الرسالة الأخيرة). مع الرجوع إلى الثواني الكاملة يرى المستقبل الطابع نفسه على كل رسالة خلال الثانية.
* الوقت صحيح بقدر صحة ساعة PLC. وحدة تحكم لم تُضبط ساعتها تختم رسالتها بعام 1970. وحين يتعذر قراءة الساعة (`diLastClockResult` لا يساوي 0) تخرج الرسالة دون ختم، وهو ما يسمح به الجزء 14، بدلًا من ألا تخرج أصلًا.

ارفع `udiConfigMajor` كلما تغيّرت قائمة الحقول. عندها يستطيع مستقبِل يحتفظ بتخطيط مرتبط بالإصدار أن يرفض رسالة بُنيت لقائمة مختلفة بدل أن يفكّها خطأً.

## الحقول، ترميز Variant (الجزء 6، 5.2.2.16)

كل حقل بايت EncodingMask ثم القيمة. البتات 0 إلى 5 من القناع هي معرّف النوع المضمَّن (الجزء 6، 5.1.2، الجدول 1)، والبت 7 يقول إن القيمة مصفوفة، وعندها يسبق العناصرَ عددُها بصيغة Int32.

| نوع PLC | معرّف النوع | بايتات القيمة |
|---|---|---|
| BOOL | 1 Boolean | 1، `00` أو `01` |
| SINT | 2 SByte | 1 |
| USINT, BYTE | 3 Byte | 1 |
| INT | 4 Int16 | 2 |
| UINT, WORD | 5 UInt16 | 2 |
| DINT | 6 Int32 | 4 |
| UDINT, DWORD | 7 UInt32 | 4 |
| LINT | 8 Int64 | 8 |
| ULINT, LWORD | 9 UInt64 | 8 |
| REAL | 10 Float | 4، IEEE 754 |
| LREAL | 11 Double | 8، IEEE 754 |
| STRING | 12 String | طول Int32 بالبايتات، ثم UTF-8 (5.2.2.4) |
| حقل بحالة Bad أو Uncertain (`SetStatus`) | 19 StatusCode | 4، حالة UInt32 بدل القيمة (Variant فقط) |
| WSTRING | 12 String | طول Int32 بالبايت، ثم UTF-8 (5.2.2.4) |
| TIME | 7 UInt32 | ميلي ثانية، وهكذا يُخزَّن TIME في CODESYS |

تخزّن STRING في CODESYS بايتًا واحدًا لكل حرف. البايتات حتى `7F` هي ASCII وتخرج دون تغيير. أما البايتات فوق `7F` فتُقرأ على أنها ISO 8859-1 وتُكتب بصيغتها UTF-8 ذات البايتين. وهذا افتراض عن صفحة رموز PLC، وهو الموضع الوحيد الذي تفسّر فيه الكتلة نصًا.

WSTRING في CODESYS هو UTF-16 ولا يحتاج إلى أي افتراض: تُكتب كل وحدة من 16 بت بترميز UTF-8 (بايت واحد أو اثنان أو ثلاثة)، ويصبح زوج البدائل السليم حرفًا واحدًا من أربعة بايتات، ويصبح البديل المنفرد U+FFFD، فيكون النص دائمًا UTF-8 صالحًا. في RawData يكون MaxStringLength لـ `WSTRING(N)` هو `3 * N` بايت، أقصى ما يمكن أن يشغله.

## الحقول، ترميز RawData (الجزء 14، 7.2.4.5.11)

بلا قناع وبلا عدّ: كل حقل هو قيمته فقط، بالترتيب، لذا يجب أن يعرف المستقبِل التخطيط. يقول الجزء 14 إن الحقول "handled like a Structure DataType"، فتُرمَّز كل قيمة كما يُرمَّز حقل Structure في الجزء 6.

* **القيم الأحادية** هي بايتات قيمتها، كما في جدول Variant، بلا قناع.
* **المصفوفات** هي عدد عناصر بصيغة Int32 ثم العناصر (الجزء 6، 5.2.5: "One dimensional Arrays are encoded as a sequence of elements preceded by the number of elements encoded as an Int32 value"). ترسل الكتلة دائمًا كل عنصر أُعطيته، فالعدد يساوي الحجم المعلن للمصفوفة ولا حشو بعدها.
* **السلاسل** هي طول Int32 بالبايتات وبايتات UTF-8، ثم بايتات صفرية حتى MaxStringLength، فيكون الحقل دائمًا 4 + MaxStringLength بايتًا (7.2.4.5.11: "the field shall be padded with bytes with value zero"). تستخدم الكتلة N من `STRING(N)` على أنه MaxStringLength بالبايتات. ويُقطع النص الأطول عند حدّ حرف، لأن الحقل لا يستطيع أن ينمو. ويجب أن تحمل بيانات الحقول الوصفية لدى المستقبِل MaxStringLength نفسه ومدخل ArrayDimensions لكل مصفوفة.

هذه هي قراءة حزمة المرجع التابعة لـ OPC Foundation نفسها. في UA-.NETStandard (الإيداع `fcfc84eab5c105780d7268474a47d344d100aca1`) يقول `src/Opc.Ua.PubSub/Encoding/Uadp/UadpBinaryReader.cs`، السطور 389 إلى 403، إن السلسلة "read like a Structure field (Int32 length prefix and value) from a fixed-size 4 + MaxStringLength byte block whose remainder is zero padding"، وإنه بالنسبة إلى المصفوفة "the array's Part 6 length (or dimensions) prefix gives the actual element count and the block is padded to product(arrayDimensions) elements". ينفذ `TryReadPaddedArray` في السطور 593 إلى 648 ذلك، ويتحقق منه `tests/Opc.Ua.PubSub.Tests/Encoding/Uadp/UadpRawDataPaddingTests.cs`. ويحتوي `docs/PROOF.md` على الباقي.

## الحجم

تبني الكتلة الرسالة في مخزن مؤقت من 1472 بايتًا: 1500 بايت حمولة Ethernet ناقص 20 لـ IP و8 لـ UDP، فلا تتجزأ الرسالة أبدًا. قائمة الحقول التي لا تتسع تضع الكتلة في `ConfigError` مع الخطأ `TooBig`؛ ولا تقتطع. ومصفوفة REAL من 250 عنصرًا بترميز Variant حجمها 1005 بايت، فتتسع رسالة تحوي تلك المصفوفة مع الترويسة، ولا تتسع رسالتان منها.
