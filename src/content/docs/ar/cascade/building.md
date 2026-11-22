---
title: "بناء Cascade"
description: "ابنِ الملف التنفيذي وصورة Cascade، واختر قاعدة البيانات التي يعمل عليها Cascade."
---

تحتاج إلى Go وPodman. ينشئ `make build` الملف التنفيذي لـ Cascade، وينشئ `make image` صورة الحاوية باستخدام Podman، مع تضمين المحرر في الملف التنفيذي فلا يلزم تثبيت أي شيء إلى جانبه.

قاعدة البيانات إعداد. قيمة `HOTLOOP_CASCADE_DATABASE` هي `sqlite:<path>` (الافتراضي، ضمن `HOTLOOP_CASCADE_DATA_DIR`) أو عنوان URL من نوع `postgres://`.

لا Docker ولا Compose. يُقدَّم Cascade لـ Podman (مع Quadlet) ولـ k3s (مع Helm).