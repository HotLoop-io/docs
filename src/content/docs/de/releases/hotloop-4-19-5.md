---
title: "Versionshinweise: HotLoop core 4.19.5"
description: "Was HotLoop core 4.19.5 bringt, was sich beim Update ändert und was Sie lesen sollten, bevor Sie eine laufende Anlage anfassen."
sidebar:
  label: "4.19.5"
---

Dies ist der Multi-Arch-Build der [4.19.4](/de/releases/hotloop-4-19-4/) und sonst nichts. Der Code ist der Code desselben Commits mit erhöhter Version: keine Korrektur, keine Funktion, keine Verhaltensänderung.

Die 4.19.4 wurde nur für amd64 gebaut, damit sie in Produktion gelangen und als stable gelten konnte, bevor die arm-Images gebaut waren. Die 4.19.5 baut den vollen Satz: das Gateway für amd64 und arm64 und Edge, IoT und den Edge Relay für amd64, arm64 und arm/v7. Eine arm-Box wechselt von den Images, die sie betrieb, zum Code der 4.19.4, indem sie `stable` zieht.

Lesen Sie [die Hinweise zur 4.19.4](/de/releases/hotloop-4-19-4/) für alles, was sich seit der letzten veröffentlichten Version geändert hat.

- Alle vier Charts (`hotloop`, `hotloop-iot`, `hotloop-edge`, `hotloop-edge-relay`) stehen auf 4.19.5, mit jeder früheren Version weiter im Index.
- Die nächste Version, die Änderungen trägt, stellt es zurück auf `linux/amd64`.
