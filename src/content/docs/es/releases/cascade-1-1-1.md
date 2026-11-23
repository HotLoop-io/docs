---
title: "Notas de versión: HotLoop Cascade 1.1.1"
description: "Qué trae HotLoop Cascade 1.1.1, qué cambia al actualizar y qué conviene leer antes de tocar una planta en marcha."
sidebar:
  label: "1.1.1"
---

## Qué es esto

1.1.1 es 1.1.0 con la imagen arm64 añadida, y una etiqueta. El código es el de 1.1.0, el chart cambia solo su versión, y cada ajuste, ruta y pantalla es lo que tiene 1.1.0.

La etiqueta es `org.opencontainers.image.version`. La imagen nunca la llevó, así que al leer la configuración de la imagen no aparecía ninguna versión. Ahora indica la versión de la publicación, tomada del mismo argumento de compilación del que sale la versión del binario.

## Por qué es una versión aparte

La multiarquitectura sale en su propia ejecución. 1.1.0 se compiló solo para amd64, pasó a producción y se leyó como estable allí, y este es el pequeño cambio de versión que compila ambas. A partir de aquí, `stable`, `latest`, `1.1`, `1` y `1.1.1` enumeran amd64 y arm64.

## Actualizar y volver atrás

Sin migraciones. Ejecute `helm upgrade` a 1.1.1, o deje que `:stable` actualice las unidades Quadlet. Una máquina arm64 que venía descargando la imagen arm64 que incluyó 1.0.2 recibe ahora la de 1.1.1. Volver a poner 1.1.0 o 1.0.2 es seguro, porque nada cambió en la base de datos.
