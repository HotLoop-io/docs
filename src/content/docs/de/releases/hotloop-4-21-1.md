---
title: "Versionshinweise: HotLoop core 4.21.1"
description: "Was HotLoop core 4.21.1 bringt, was sich beim Update ändert und was Sie lesen sollten, bevor Sie eine laufende Anlage anfassen."
sidebar:
  label: "4.21.1"
---

Dies ist der Multi-Arch-Build der [4.21.0](/de/releases/hotloop-4-21-0/). Der Produktcode ist derselbe wie der der 4.21.0: X.509-Anmeldung für den OPC-UA-Server, Passwörter mit 72 Byte, die veralteten Sicherheitsrichtlinien standardmäßig aus und der erweiterte CODESYS-Alarmimport. Die 4.21.0 war der amd64-Build, und `stable` behielt die arm-Images, die es schon hielt.

Die 4.21.1 baut den vollen Satz: das Gateway für amd64 und arm64 und Edge, IoT und den Edge Relay für amd64, arm64 und arm/v7. Lesen Sie [die Hinweise zur 4.21.0](/de/releases/hotloop-4-21-0/) für alles, was sich seit der 4.20.2 geändert hat, auch dass `Basic128Rsa15` und `Basic256` bei Updates ebenfalls aus sind.

- Alle vier Charts (`hotloop`, `hotloop-iot`, `hotloop-edge`, `hotloop-edge-relay`) stehen auf 4.21.1, mit jeder früheren Version weiter im Index.
