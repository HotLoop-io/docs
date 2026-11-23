---
title: "ملاحظات الإصدار: HotLoop for CODESYS 0.3.8"
description: "الـ chart 0.3.8 من HotLoop for CODESYS: صورة provisioner التي يشغّلها هي 0.3.3، مبنية لـ amd64 وarm64."
sidebar:
  label: "0.3.8"
---

## ما الذي تغيّر

0.3.8 في الفهرس `{{codesysChartRepo}}`، نُشر في 2026-11-19.

- **يشغّل provisioner 0.3.3،** أول صورة provisioner مبنية لـ amd64 ولـ arm64، فيُثبَّت الـ chart على عقدة arm64.
- **لم يتغير شيء آخر.** القوالب والقيم وHotLoop الذي يغلّفه (4.22.0) هي نفسها في [0.3.7](/ar/releases/codesys-0-3-7/).

ما يعنيه ذلك لك: ثبّت هذا. على عقدة amd64 لا شيء يختلف.

## ما الذي جرى التحقق منه

تقرأ قيم الـ chart المنشور provisioner 0.3.3 وHotLoop 4.22.0، ويسرد فهرس الصورة 0.3.3 amd64 وarm64. لم يُعَد تثبيت الـ chart على عنقود لهذا الإصدار، لأن وسم الصورة وحده هو الذي تحرك.
