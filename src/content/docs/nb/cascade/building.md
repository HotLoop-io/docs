---
title: "Bygg Cascade"
description: "Bygg binærfilen og containerbildet for Cascade, og velg databasen som Cascade kjører på."
---

Du trenger Go og Podman. `make build` bygger Cascade-binærfilen, og `make image` bygger containerbildet med Podman. Editoren er bygget inn i binærfilen, så det er ingenting å installere ved siden av.

Databasen er en innstilling. `HOTLOOP_CASCADE_DATABASE` er `sqlite:<path>` (standard, under `HOTLOOP_CASCADE_DATA_DIR`) eller en `postgres://`-URL.

Ingen Docker og ingen Compose. Cascade leveres for Podman (med Quadlet) og for k3s (med Helm).