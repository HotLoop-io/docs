---
title: "HotLoop Transmitter: نظرة عامة"
description: "مكتبة CODESYS مكتوبة بلغة Structured Text فوق SysSocket UDP، تنشر قيم PLC بصيغة OPC UA PubSub (UADP) دون أي مكتبة أخرى أو أداة إعداد."
---

يضع HotLoop Transmitter قيم PLC على الشبكة بصيغة OPC UA PubSub، كما ينص الجزء 14 من مواصفة OPC UA، من مكتبة تضيفها إلى مشروع CODESYS. وهو مرسِل بمعنى حلقة القياس: الجزء الذي يضع قيمة العملية على الخط ليقرأها جهاز آخر.

كُتب بلغة Structured Text فوق `SysSocket` UDP، ولا يحتاج إلى مكتبة أخرى ولا ترخيص إضافي ولا أداة إعداد. تضيف المكتبة، وتستدعي كتلة وظيفية واحدة مرة في كل دورة، فتخرج رسالة UADP NetworkMessage في كل فاصل نشر إلى عنوان unicast أو مجموعة multicast.

ما يعنيه هذا لك: يستطيع PLC بلا مكتبة PubSub أن يغذّي كل ما يشترك في OPC UA PubSub، بما في ذلك HotLoop نفسه، ببضعة أسطر من Structured Text. تحمل كل رسالة طابعًا زمنيًا من ساعة PLC، ما لم توقفه بـ `bTimestamp`.

## لماذا Structured Text وليس Go

كل أداة جديدة في HotLoop تُكتب بلغة Go ما لم يكن هناك سبب حقيقي. وهذا هو السبب الحقيقي: يجب أن تعمل داخل مسح PLC نفسه، في بيئة التشغيل IEC 61131-3، كمكتبة يشير إليها المبرمج من مشروعه. وبيئة تشغيل CODESYS تنفّذ Structured Text وليس Go. أما الاختبارات والأدوات حول المكتبة (أداة الالتقاط، أداة التحقق) فهي بلغة Go.

## طريقة الاستخدام

1. ثبّت `HotLoopTransmitter-1.2.0.library` في مستودع مكتبات CODESYS (Tools, Library Repository, Install)، أو ثبّت `HotLoopTransmitter-1.2.0.package` بواسطة CODESYS Installer، ثم أضفها إلى Library Manager في المشروع. تجد التنزيلات والتفاصيل في [صفحة التثبيت](/ar/transmitter/install/).
2. عرّف ناشرًا (publisher)، وأضف المتغيرات التي تريد نشرها مرة واحدة عند البدء، ثم استدعِه في كل دورة:

```iecst
PROGRAM PLC_PRG
VAR
    pub : HLTX.FB_HLTX_Publisher;
    bInit : BOOL;
END_VAR

IF NOT bInit THEN
    bInit := TRUE;
    pub.sDestination := '239.0.0.22';        // a unicast host or a multicast group
    pub.uiPort := 4840;
    pub.uiPublisherId := 1;
    pub.uiWriterGroupId := 1;
    pub.uiDataSetWriterId := 1;
    pub.tPublishingInterval := T#100MS;
    pub.AddReal(ADR(GVL.rTemperature));
    pub.AddBool(ADR(GVL.bRunning));
    pub.AddArray(ADR(GVL.aValues), HLTX.E_HLTX_Type.REAL_T, 250);
END_IF
pub.bEnable := TRUE;
pub();
```

تسرد [صفحة API](/ar/transmitter/api/) كل مدخل ومخرج وطريقة. أما [صفحة صيغة الإرسال](/ar/transmitter/wire-format/) فتعرض الحزمة بايتًا بايتًا، مع أقسام المواصفة التي تعرّف كل بايت.

## ما سيفعله بمسحك وما لن يفعله

* لا يحجب أبدًا. المقبس غير حاجب، وتُبنى الرسالة في مخزن مؤقت ثابت.
* تكلفة الاستدعاء هي تكلفة بناء رسالة واحدة، ولا تُدفع إلا في الدورات التي تخرج فيها رسالة. قيست على مهمة مدتها 20 ms مع ناشرَين وتفعيل الطوابع الزمنية: نحو 9.6 us إضافية في كل دورة في المتوسط، ومن 10 إلى 100 us في الدورات التي ترسل، وكانت أطول دورة في التشغيل 81 us. وقد مدّ مضيف مشغول عملية إرسال واحدة إلى ميلي ثانية. الأرقام المقيسة وحدودها في [صفحة التوقيت](/ar/transmitter/timing/).
* خطأ في المقبس أو عنوان خاطئ أو قائمة حقول كبيرة جدًا لا يتسبب أبدًا في عطل التطبيق. تبلّغ الكتلة عن `eState` و`eError`، وتعدّ الفشل، ويواصل البرنامج المسح.
* لا يجزّئ الرسائل. أقصى حجم للرسالة 1472 بايت. قائمة الحقول التي لا تتسع تضع الكتلة في `ConfigError` ولا يُرسل شيء.

## جرى اختباره مع

بيئة التشغيل CODESYS Control for Linux SL 4.22.0.0، وعلى عتاد مباشر بلا نظام تشغيل (2026-11-17). راجع [صفحة التوقيت](/ar/transmitter/timing/) و[صفحة الإثبات](/ar/transmitter/proof/) لمعرفة ما جرى تشغيله وما قُرئ عائدًا.

هل تشغّله في مصنع؟ تغطي صفحة [استخدام HotLoop في الأعمال](/ar/business/) الترخيص وطريقة التواصل معنا.

## الترخيص

HotLoop Source License Agreement 1.0، مثل كل منتجات HotLoop. الاستخدام مجاني والشيفرة المصدرية متاحة، وليس مفتوح المصدر بحسب OSI، ويتيح لك القسم 5 تضمين المكتبة في مشاريع PLC الخاصة بك وتسليم النتيجة المترجمة أو بيعها، وليس المكتبة نفسها أبدًا. تجد النص في [صفحة الترخيص](https://hotloop.io/license/).
