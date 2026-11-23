---
title: "ملاحظات الإصدار: HotLoop core 4.20.2"
description: "ما الذي يقدمه HotLoop core 4.20.2، وما الذي يتغير عند الترقية، وما يجب قراءته قبل لمس مصنع قيد التشغيل."
sidebar:
  label: "4.20.2"
---

إصلاحان فوق [4.20.1](/ar/releases/hotloop-4-20-1/)، والترخيص. هذا هو أول إصدار للنواة تحت EmberNet Source License 1.0 (`LicenseRef-EmberNet-Source-1.0`): تقول ذلك LICENSE وNOTICE وREADME وتعليقات charts وتسميات الصور.

- **EtherNet/IP مع أكثر من tag في دفعة.** كان driver يطلب دفعة من `ReadMulti` في المكتبة، وهي تأخذ struct من حقول موسومة أو map، واسم tag عادي يجعلها تدخل في panic في reflect قبل أن يخرج بايت. فكان كل جهاز EtherNet/IP فيه tag أو أكثر في دفعة يُحدث panic في استطلاعه (الدفعات عشرون افتراضيًا). لم يره أحد في اختبار لأن أي اختبار لم يضع قط دفعة أمام خادم. الآن تشغّل الاختبارات خادم EtherNet/IP وخادم S7 داخل العملية، وتقرؤهما drivers عبر TCP، وتمر الدفعة عبر `ReadList`. المتحكم الذي يصمت وsocket مفتوح يتوقف خلال استطلاع واحد زائد مهلته، كما كان مقصودًا، ولا يُسأل بعد الآن من جديد tag بعد tag، وهو ما كان يُبقي الاستطلاع مهلة واحدة لكل tag. S7comm وEtherNet/IP ما زالا غير مثبتين أمام PLC مادي.
- **`version` كلمة.** كان `podman run ghcr.io/hotloop-io/hotloop:4.20.1 version` يموت بـ «database password is not set»، لأن `--version` وحده كان يُعالَج قبل قراءة الإعداد. الآن يطبع `version` الإصدار ببيئة فارغة، لـ Gateway وEdge وIoT ولـ Edge Relay.

- لا ترحيلات ولا أسرار جديدة ولا تغييرات في API. يأخذها `helm upgrade` العادي أو التحديث التلقائي لـ Quadlet.
- charts الأربعة كلها (`hotloop` و`hotloop-iot` و`hotloop-edge` و`hotloop-edge-relay`) على 4.20.2، وكل إصدار أقدم ما زال في الفهرس.
- هذا البناء لـ amd64 فقط، ويحتفظ `stable` بصور arm التي لديه. الإصدار التالي رفع صغير للإصدار يبني صور arm.
