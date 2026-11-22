---
title: "تثبيت HotLoop Transmitter"
description: "ثبّت المكتبة في مستودع مكتبات CODESYS وأضفها إلى مشروع، وتعرّف على ما يجب فعله عندما تبلّغ الكتلة عن خطأ."
---

تحتاج إلى نظام تطوير CODESYS بالإصدار 3.5 SP22 أو أحدث، وبيئة تشغيل يحتوي هدفها على المكوّنين SysSocket وSysTimeRtc، وهما موجودان في بيئات تشغيل CODESYS Control لنظام Linux SL (والثاني جديد في 1.1.0 من أجل الطابع الزمني).

## من CODESYS Installer

منذ 1.1.0 تتضمن النسخة أيضًا `HotLoopTransmitter-1.1.0.package` على العنوان https://hotloop.io/hotloop-transmitter/1.1.0/HotLoopTransmitter-1.1.0.package. ثبّتها بواسطة CODESYS Installer (في بيئة التطوير: Tools, CODESYS Installer)، أو دون نافذة بواسطة سطر الأوامر الخاص به، `PackageManagerCLI.exe --profile="<your profile>" --install=<file>.package --targetProfiles="<your profile>"`. يضع Installer المكتبة في مستودع مكتبات ذلك الملف الشخصي تحت الشركة HotLoop، وتنتقل إلى الخطوة 3 أدناه. الحزمة هي نفسها مكتبة ملف `.library` داخل ملف ZIP يقرؤه Installer، فالطريقتان تعطيان المكتبة نفسها.

## من ملف المكتبة

1. نزّل `HotLoopTransmitter-1.1.0.library` من https://hotloop.io/hotloop-transmitter/1.1.0/HotLoopTransmitter-1.1.0.library وتحقق منه مقابل `SHA256SUMS` في المجلد نفسه (`sha256sum -c SHA256SUMS`).
2. في بيئة تطوير CODESYS: Tools, Library Repository, Install، ثم اختر الملف. صار الآن في المستودع تحت الشركة HotLoop.
3. في مشروعك، افتح Library Manager للتطبيق، ثم Add Library، واختر HotLoop Transmitter. تأتي SysSocket وSysTimeRtc ومكتبات واجهاتهما معها كاعتماديات ولا تحتاج منك إلى شيء.
4. عرّف `HLTX.FB_HLTX_Publisher`، وأضف حقولك، واستدعِه في كل دورة (المثال في README).
5. نزّل إلى وحدة التحكم. يجب أن يكون الوجهة قابلًا للوصول من شبكة وحدة التحكم؛ وفي multicast يجب أن تمرّر مبدّلات الشبكة المجموعة.

ملف `.compiled-library` هو المكتبة نفسها بلا شيفرتها المصدرية. ثبّته بدلًا من الآخر إن كنت لا تريد أن يظهر Structured Text في Library Manager. وهو في المجلد نفسه باسم `HotLoopTransmitter-1.1.0.compiled-library`.

للتحقق مما يصل، يصلح أي مستمع UDP على منفذ الوجهة. برنامج Go صغير يستمع على منفذ أو ينضم إلى مجموعة multicast ويطبع كل حزمة بيانات سطرَ JSON مع قيمتها السداسية عشرية يؤدي الغرض جيدًا.

## إذا أبلغت الكتلة عن خطأ

| `eError` | المعنى | ما يجب فعله |
|---|---|---|
| `NoFields` | لم تُضَف أي حقول | استدعِ طريقة `Add` قبل التفعيل |
| `BadInterval` | قيمة `tPublishingInterval` أقل من 1 ms | اضبطها |
| `BadAddress` | `sDestination` ليس عنوان IPv4 منقّطًا | صحّحه |
| `SocketCreate`, `SocketOption` | رفضت بيئة التشغيل استدعاء مقبس؛ رمزه في `diLastSocketResult` | تعيد الكتلة المحاولة بنفسها بعد `tRetry` |
| `TooBig` | الحقول لا تتسع في 1472 بايت | انشر عددًا أقل، أو استخدم ناشرَين بمعرّفي writer id مختلفين |
| `BadField` | مُسح عنوان محفوظ | نفّذ `Clear()` وأضف الحقول من جديد |
