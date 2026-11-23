---
title: "Notas de versión: HotLoop Cascade 1.5.1"
description: "Qué trae HotLoop Cascade 1.5.1, qué cambia al actualizar y qué conviene leer antes de tocar una planta en marcha."
sidebar:
  label: "1.5.1"
---

## Qué es esto

1.5.1 es 1.5.0 con la imagen arm64 añadida. El código es el de 1.5.0, el chart cambia solo su versión, y cada ajuste, ruta, pantalla y herramienta es lo que tiene 1.5.0, incluido que un propietario elimine a una persona.

## Por qué es una versión aparte

La multiarquitectura sale en su propia ejecución. 1.5.0 se compiló solo para amd64, y este es el pequeño cambio de versión que compila ambas. A partir de aquí, `stable`, `latest`, `1.5`, `1` y `1.5.1` enumeran amd64 y arm64.

## Actualizar y volver atrás

Sin migraciones. Ejecute `helm upgrade` a 1.5.1, o deje que `:stable` actualice las unidades Quadlet. Una máquina arm64 que venía descargando la imagen arm64 que incluyó 1.4.2 recibe ahora la de 1.5.1. Volver a poner 1.5.0 o 1.4.2 es seguro, porque nada cambió en la base de datos.
