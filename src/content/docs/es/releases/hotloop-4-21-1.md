---
title: "Notas de versión: HotLoop core 4.21.1"
description: "Qué trae HotLoop core 4.21.1, qué cambia al actualizar y qué leer antes de tocar una planta en marcha."
sidebar:
  label: "4.21.1"
---

Esta es la compilación multiarquitectura de la [4.21.0](/es/releases/hotloop-4-21-0/). El código del producto es el mismo que el de la 4.21.0: inicio de sesión X.509 para el servidor OPC UA, contraseñas de 72 bytes, las políticas de seguridad obsoletas desactivadas por defecto y la importación de alarmas de CODESYS ampliada. La 4.21.0 fue la compilación amd64, y `stable` conservó las imágenes arm que ya tenía.

La 4.21.1 compila el conjunto completo: el Gateway para amd64 y arm64, y Edge, IoT y el Edge Relay para amd64, arm64 y arm/v7. Lee [las notas de la 4.21.0](/es/releases/hotloop-4-21-0/) para todo lo que cambió desde la 4.20.2, incluido que `Basic128Rsa15` y `Basic256` también quedan desactivadas en las actualizaciones.

- Los cuatro charts (`hotloop`, `hotloop-iot`, `hotloop-edge`, `hotloop-edge-relay`) están en la 4.21.1, con todas las versiones anteriores aún en el índice.
