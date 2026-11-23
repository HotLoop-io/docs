---
title: "Notas de versión: HotLoop Flow 2.9.1"
description: "Qué trae HotLoop Flow 2.9.1, qué cambia al actualizar y qué conviene leer antes de tocar una planta en marcha."
sidebar:
  label: "2.9.1"
---

HotLoop Flow 2.9.1 permite que el nodo `modbus-server` escuche en la interfaz de una VLAN, así que un solo Flow puede ejecutar un servidor en cada VLAN de un puerto con la misma dirección y el mismo puerto.

## Novedades

- **`modbus-server` acepta una interfaz de red.** El socket de escucha se asocia a la interfaz (`SO_BINDTODEVICE`) antes de escuchar, así que dos servidores en `192.168.1.9:10502` en dos VLAN ya no chocan. El ajuste es el mismo que en cada cliente: la **Interfaz de red** del propio nodo, o si no `FLOW_NETWORK_INTERFACE` en las variables de entorno de su pestaña. Sin ninguna, escucha como siempre, y dos servidores en la misma dirección y puerto siguen chocando, ahora con un error que dice que cada uno necesita una interfaz.

## Qué cambió

- Sin configurar, se comporta como el original. NOTICE y `HOTLOOP_PATCH.txt` dicen qué cambió.

## Ajustes nuevos

Nada más allá del campo **Interfaz de red** en `modbus-server`. El valor del chart `bindToInterface.netRaw` y el requisito de red del host de la 2.9.0 se aplican a él igual que a los clientes.

## Actualización

Un simple `helm upgrade` a la imagen y el chart 2.9.1, o la nueva etiqueta en su unidad Quadlet. Al primer arranque no ocurre nada y no hay nada que migrar. Un flow que no fija ninguna interfaz se comporta exactamente igual que en la 2.9.0.

Imagen: `ghcr.io/hotloop-io/hotloop-flow:2.9.1`, primero linux/amd64, con arm64 a continuación en la 2.9.2. Chart: `https://hotloop.io/hotloop-flow/`. El README de esta etiqueta tiene el resto, con imágenes: https://github.com/HotLoop-io/hotloop-flow/blob/v2.9.1/README.md
