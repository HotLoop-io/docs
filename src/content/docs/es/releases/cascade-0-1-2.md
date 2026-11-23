---
title: "Notas de versión: HotLoop Cascade 0.1.2"
description: "Qué trae HotLoop Cascade 0.1.2, qué cambia al actualizar y qué conviene leer antes de tocar una planta en marcha."
sidebar:
  label: "0.1.2"
---

## Qué es esto

0.1.2 es una corrección de compilación y nada más. El código es el mismo que el de 0.1.1, y también todo lo que usted ejecuta: el chart, las unidades Quadlet, los ajustes y la base de datos.

Cascade ya se compila y publica con Podman de principio a fin, y la imagen contiene exactamente amd64 y arm64.

## Actualizar desde 0.1.1

No hay nada que hacer. Ejecute `helm upgrade` a 0.1.2, o deje que `:stable` actualice las unidades Quadlet. Sin migraciones, sin ajustes nuevos, y la clave y sus flujos de trabajo siguen donde estaban.
