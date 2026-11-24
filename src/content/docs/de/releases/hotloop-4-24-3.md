---
title: "Versionshinweise: HotLoop core 4.24.3"
description: "Was HotLoop core 4.24.3 bringt, was sich beim Update ändert und was Sie lesen sollten, bevor Sie eine laufende Anlage anfassen."
sidebar:
  label: "4.24.3"
---

4.24.3 bringt alles aus [4.24.2](/de/releases/hotloop-4-24-2/) auf jede Plattform, für die wir bauen: Shelly jeder Generation, ONVIF-Kameras, Arduinos über Firmata, OPC-UA-Passwörter beliebiger Länge, eine Weiterleitungswarteschlange, die sich hinter einer langsamen Verbindung leert, `--version`, das seinen Commit nennt, und eine Standardinstallation von HotLoop Edge, die startet.

Das Gateway läuft auf amd64 und arm64, Edge, IoT und das Edge Relay laufen auf amd64, arm64 und arm/v7, sodass dieselbe Version Ihre Server, Ihre Pis und Ihre älteren ARM-Gateways abdeckt. Lesen Sie die [Notizen zu 4.24.2](/de/releases/hotloop-4-24-2/) für alles Neue seit 4.24.0.

- Alle vier Charts (`hotloop`, `hotloop-iot`, `hotloop-edge`, `hotloop-edge-relay`) stehen auf 4.24.3, und jede frühere Version bleibt im Index.
- Aktualisieren Sie wie immer: ein `helm upgrade` auf das Chart 4.24.3 oder das neue Tag in Ihrer Quadlet-Unit. Es muss nichts migriert werden.
