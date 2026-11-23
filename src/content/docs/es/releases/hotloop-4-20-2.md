---
title: "Notas de versión: HotLoop core 4.20.2"
description: "Qué trae HotLoop core 4.20.2, qué cambia al actualizar y qué leer antes de tocar una planta en marcha."
sidebar:
  label: "4.20.2"
---

Dos correcciones sobre la [4.20.1](/es/releases/hotloop-4-20-1/), y la licencia. Esta es la primera versión del núcleo bajo la EmberNet Source License 1.0 (`LicenseRef-EmberNet-Source-1.0`): lo dicen LICENSE, NOTICE, el README, las anotaciones de los charts y las etiquetas de las imágenes.

- **EtherNet/IP con más de un tag en un lote.** El driver pedía a `ReadMulti` de la biblioteca un lote, que toma una estructura de campos con etiqueta o un mapa, y un simple nombre de tag la hace entrar en pánico en reflect antes de que salga un solo byte. Así que cualquier dispositivo EtherNet/IP con dos o más tags en un lote hacía entrar en pánico su sondeo (los lotes son de veinte por defecto). Nadie lo vio en una prueba porque ninguna prueba puso nunca un lote contra un servidor. Ahora las pruebas ejecutan un servidor EtherNet/IP y un servidor S7 en el proceso, los drivers los leen por TCP, y el lote pasa por `ReadList`. Un controlador que se queda callado con su socket abierto está caído dentro de un sondeo más su timeout, como se pretendía, y ya no se le vuelve a preguntar tag por tag, lo que mantenía el sondeo un timeout por cada tag. S7comm y EtherNet/IP siguen sin probarse contra un PLC físico.
- **`version` es una palabra.** `podman run ghcr.io/hotloop-io/hotloop:4.20.1 version` moría con «database password is not set», porque solo se manejaba `--version` antes de leer la configuración. Ahora `version` imprime la versión con un entorno vacío, para el Gateway, Edge e IoT, y para el Edge Relay.

- Sin migraciones, sin secretos nuevos, sin cambios de API. Un `helm upgrade` normal o la actualización automática de Quadlet la toma.
- Los cuatro charts (`hotloop`, `hotloop-iot`, `hotloop-edge`, `hotloop-edge-relay`) están en la 4.20.2, con todas las versiones anteriores aún en el índice.
- Esta compilación es solo amd64, y `stable` conserva las imágenes arm que tiene. La siguiente versión es un pequeño aumento de versión que construye las imágenes arm.
