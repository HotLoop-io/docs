---
title: "Cascade bauen"
description: "So bauen Sie die Cascade-Binärdatei und das Image und wählen die Datenbank, auf der Cascade läuft."
---

Sie brauchen Go und Podman. `make build` baut die Cascade-Binärdatei, und `make image` baut das Container-Image mit Podman. Der Editor steckt in der Binärdatei, daher muss daneben nichts installiert werden.

Die Datenbank ist eine Einstellung. `HOTLOOP_CASCADE_DATABASE` ist `sqlite:<path>` (der Standard, unter `HOTLOOP_CASCADE_DATA_DIR`) oder eine `postgres://`-URL.

Kein Docker und kein Compose. Cascade wird für Podman (mit Quadlet) und für k3s (mit Helm) ausgeliefert.