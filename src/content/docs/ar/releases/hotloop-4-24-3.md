---
title: "ملاحظات الإصدار: HotLoop core 4.24.3"
description: "ما الذي يقدمه HotLoop core 4.24.3، وما الذي يتغير عند الترقية، وما يجب قراءته قبل لمس مصنع قيد التشغيل."
sidebar:
  label: "4.24.3"
---

يحمل 4.24.3 كل ما في [4.24.2](/ar/releases/hotloop-4-24-2/) إلى كل لوحة نبني لها: Shelly من كل جيل، وكاميرات ONVIF، وArduino عبر Firmata، وكلمات مرور OPC UA بأي طول، وطابور إعادة إرسال يفرغ خلف رابط بطيء، و`--version` الذي يذكر الـ commit الخاص به، وتثبيت HotLoop Edge افتراضي يبدأ.

يعمل Gateway على amd64 وarm64، ويعمل Edge وIoT وEdge Relay على amd64 وarm64 وarm/v7، فيغطي الإصدار نفسه خوادمك وأجهزة Pi وبوابات ARM الأقدم لديك. اقرأ [ملاحظات 4.24.2](/ar/releases/hotloop-4-24-2/) لكل ما هو جديد منذ 4.24.0.

- جميع الـ charts الأربعة (`hotloop` و`hotloop-iot` و`hotloop-edge` و`hotloop-edge-relay`) على 4.24.3، وكل إصدار سابق ما زال في الفهرس.
- رقِّ كما تفعل دائمًا: `helm upgrade` إلى الـ chart 4.24.3، أو الوسم الجديد في وحدة Quadlet لديك. لا شيء يحتاج إلى ترحيل.
