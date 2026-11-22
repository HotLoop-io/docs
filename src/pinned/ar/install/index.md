---
title: "تثبيت HotLoop"
description: "كيف يُثبَّت كل منتج من HotLoop: Helm على k3s أو أي Kubernetes، أو Podman Quadlet على جهاز، مع أجهزة تتبع وسم stable وتحدّث نفسها."
sidebar:
  label: "التثبيت"
---

هناك طريقتان لتشغيل منتج HotLoop فعليًا: Helm على k3s أو أي Kubernetes، أو Podman مع Quadlet على جهاز ليس ضمن عنقود. بلا Docker، وبلا Compose، وبلا أمر `podman run` منفرد من صَدَفة تموت بموت الجلسة. أمر `podman run` العادي مقبول للتجربة، وصفحة Flow تقول ذلك، لكنه ليس تثبيتًا.

## اختر الطريق

| لديك | استخدم | الصفحة |
|---|---|---|
| عنقود k3s أو Kubernetes | Helm | [k3s وHelm](/ar/install/helm/) |
| جهاز Pi أو NUC أو حاسوب صناعي صغير، بلا عنقود | Podman Quadlet | [Podman Quadlet](/ar/install/quadlet/) |
| أيًّا منهما، وتريد معرفة كيف تتصرف التحديثات | | [التحديث التلقائي لـ :stable](/ar/install/auto-update/) |

## ما يمكنك تثبيته اليوم

| المنتج | أحدث إصدار | Helm | Quadlet | ابدأ من هنا |
|---|---|---|---|---|
| [HotLoop IoT](/ar/iot/overview/) | {{hotloop}} | نعم | نعم | [تثبيت IoT](/ar/iot/install/) |
| [HotLoop Edge](/ar/edge/overview/) | {{hotloop}} | نعم | نعم | [تثبيت Edge](/ar/edge/install/) |
| [HotLoop Gateway](/ar/gateway/overview/) | {{hotloop}} | نعم | نعم | [تثبيت Gateway](/ar/gateway/install/) |
| [HotLoop Edge Relay](/ar/edge-relay/overview/) | {{hotloop}} | نعم | نعم | [تثبيت Edge Relay](/ar/edge-relay/install/) |
| [HotLoop Flow](/ar/flow/overview/) | {{flow}} | نعم | نعم | [تثبيت Flow](/ar/flow/install/) |
| [HotLoop Cascade](/ar/cascade/overview/) | {{cascade}} | نعم، دون تسجيل دخول | نعم، دون تسجيل دخول, انظر [Cascade مع Podman Quadlet](/ar/cascade/quadlet/) | [تشغيل Cascade](/ar/cascade/running/) |
| [HotLoop for CODESYS](/ar/codesys/overview/) | {{codesys}} | نعم، أو متجر تطبيقات EmberCORE | لا | [تثبيت HotLoop for CODESYS](/ar/codesys/install/) |
| [HotLoop Transmitter](/ar/transmitter/overview/) | 1.1.0 | لا، فهو مكتبة CODESYS | لا، فهو مكتبة CODESYS | [تثبيت Transmitter](/ar/transmitter/install/) |

تخرج HotLoop IoT وEdge وGateway وEdge Relay من وسم واحد، معًا، لذا تتشارك رقم إصدار واحدًا. أما Flow وCascade وHotLoop for CODESYS وTransmitter فلكل منها رقمه. وحدات Quadlet الخاصة بـ IoT وEdge وGateway تحتاج إلى Podman 5.0 أو أحدث، وقد شُغّلت وحدة المُمرِّر على Podman 4.9.3. يأتي Raspberry Pi OS Bookworm بالإصدار 4.3 الذي لا يدعم Quadlet إطلاقًا، لذا يحتاج Pi إلى Trixie أو أحدث.

## قبل وضع أحدها في مصنع حقيقي

- اقرأ [بوابة الكتابة](/ar/gateway/write-gate/). هي نفسها في كل منتج، وهذا سبب أن لا شيء يحرّك آلة لم تفعّلها.
- ضع قاعدة البيانات على قرص USB SSD وليس بطاقة SD، إن كان الجهاز Pi. يكتب السجل طوال اليوم كل يوم، وبطاقات SD تموت بسبب ذلك تحديدًا.
- احتفظ بنسخة من مفتاح كلمات مرور الأجهزة. إنه ليس في قاعدة البيانات ولا في النسخة الاحتياطية، فهو جزء من بياناتك. تشرح [النسخ الاحتياطية](/ar/iot/backup/) الطريقة.
- خذ نسخة احتياطية قبل أن ترقّي موقعًا إلى منتج أعلى أو تحدّث عبر إصدار، وانسخها إلى خارج الجهاز.
