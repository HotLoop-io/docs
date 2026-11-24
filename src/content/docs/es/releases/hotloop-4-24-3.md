---
title: "Notas de versión: HotLoop core 4.24.3"
description: "Qué trae HotLoop core 4.24.3, qué cambia al actualizar y qué leer antes de tocar una planta en marcha."
sidebar:
  label: "4.24.3"
---

La 4.24.3 lleva todo lo de la [4.24.2](/es/releases/hotloop-4-24-2/) a cada placa para la que construimos: Shelly de cualquier generación, cámaras ONVIF, Arduino mediante Firmata, contraseñas OPC UA de cualquier longitud, una cola de reenvío que se vacía tras un enlace lento, `--version` que nombra su commit y una instalación predeterminada de HotLoop Edge que arranca.

La Gateway funciona en amd64 y arm64, y Edge, IoT y el Edge Relay funcionan en amd64, arm64 y arm/v7, de modo que la misma versión cubre sus servidores, sus Pi y sus pasarelas ARM más antiguas. Lea las [notas de la 4.24.2](/es/releases/hotloop-4-24-2/) para todo lo nuevo desde la 4.24.0.

- Los cuatro charts (`hotloop`, `hotloop-iot`, `hotloop-edge`, `hotloop-edge-relay`) están en la 4.24.3, con todas las versiones anteriores todavía en el índice.
- Actualice como siempre: un `helm upgrade` al chart 4.24.3, o la nueva etiqueta en su unidad Quadlet. No hay nada que migrar.
