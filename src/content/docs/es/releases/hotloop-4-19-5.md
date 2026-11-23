---
title: "Notas de versión: HotLoop core 4.19.5"
description: "Qué trae HotLoop core 4.19.5, qué cambia al actualizar y qué leer antes de tocar una planta en marcha."
sidebar:
  label: "4.19.5"
---

Esta es la compilación multiarquitectura de [4.19.4](/es/releases/hotloop-4-19-4/) y nada más. El código es el del mismo commit con la versión aumentada: ninguna corrección, ninguna función, ningún cambio de comportamiento.

La 4.19.4 se compiló solo para amd64, para que pudiera llegar a producción y leerse como stable antes de compilar las imágenes arm. La 4.19.5 compila el conjunto completo: el Gateway para amd64 y arm64, y Edge, IoT y el Edge Relay para amd64, arm64 y arm/v7. Un equipo arm pasa de las imágenes que ejecutaba al código de la 4.19.4 descargando `stable`.

Lee [las notas de la 4.19.4](/es/releases/hotloop-4-19-4/) para todo lo que cambió desde la última versión publicada.

- Los cuatro charts (`hotloop`, `hotloop-iot`, `hotloop-edge`, `hotloop-edge-relay`) están en la 4.19.5, con todas las versiones anteriores aún en el índice.
- La siguiente versión que lleve cambios lo vuelve a poner en `linux/amd64`.
