---
title: "Notas de versión: HotLoop for CODESYS 0.3.4"
description: "Chart 0.3.4 de HotLoop for CODESYS: envuelve HotLoop 4.20.1, la versión que trae las imágenes multiarquitectura."
sidebar:
  label: "0.3.4"
---

## Qué cambió

0.3.4 está en el índice `{{codesysChartRepo}}`, publicada el 2026-11-16.

- **Envuelve HotLoop 4.20.1,** la versión que trae las imágenes arm que descargan los testers. El provisioner sigue en 0.3.1.

Lo que esto significa para usted: un nodo arm64 descarga la imagen arm de HotLoop con el chart, y nada más se mueve.

## Qué se comprobó

Una actualización desde 0.3.3 con un perfil aplicado a 0.3.4, junto a un runtime CODESYS Control for Linux SL 4.22.0.0: arrancó un pod nuevo en 4.20.1, el dispositivo y sus 44 tags seguían allí y ninguno era escribible, la página respondió, y el registro de HotLoop no tenía advertencias ni errores. Con el runtime en la red del nodo, el provisioner lo alcanzó en el 4840 y el runtime lo rechazó como usuario anónimo, tal como está configurado ese runtime, así que su propio dispositivo quedó pendiente y se crearon el dispositivo oyente y sus tags. Se ha ejecutado en hardware real (2026-11-17).
