---
title: "Notas de versión: HotLoop Flow 2.7.1"
description: "Qué trae HotLoop Flow 2.7.1, qué cambia al actualizar y qué conviene leer antes de tocar una planta en marcha."
sidebar:
  label: "2.7.1"
---

HotLoop Flow 2.7.1 es la 2.7.0 con la imagen arm64 añadida, y nada más. La 2.7.0 salió solo para amd64 para llegar primero a producción y figurar como estable, y esta es la pequeña versión que compila las dos. No cambia el código, el chart, los ajustes ni sus flows.

## Qué cambió

- La imagen se construye de nuevo para linux/amd64 y linux/arm64. Las etiquetas `2.7.1`, `2.7` y `2` contienen ambas.
- El README y las páginas de instalación nombran la 2.7.1 y dicen amd64 y arm64, como antes de la 2.7.0.

## Ajustes nuevos

Ninguno.

## Actualización

Un simple `helm upgrade` a la imagen y el chart de la 2.7.1, o la nueva etiqueta en su unidad Quadlet. Si está en arm64 y se quedó en la 2.6.0 mientras la 2.7.0 era solo amd64, este es su paso a FlowLab: lea las notas de la 2.7.0 para saber qué es y qué aún no es. No pasa nada en el primer arranque y no hay nada que migrar.

Imagen: `ghcr.io/hotloop-io/hotloop-flow:2.7.1`, linux/amd64 y linux/arm64. Chart: `https://hotloop.io/hotloop-flow/`. El README de esta etiqueta tiene el resto, con imágenes: https://github.com/HotLoop-io/hotloop-flow/blob/v2.7.1/README.md
