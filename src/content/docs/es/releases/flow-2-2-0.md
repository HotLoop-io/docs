---
title: "Notas de versión: HotLoop Flow 2.2.0"
description: "Qué trae HotLoop Flow 2.2.0, qué cambia al actualizar y qué conviene leer antes de tocar una planta en marcha."
sidebar:
  label: "2.2.0"
---

HotLoop Flow 2.2.0 es la versión en la que Flow habla con los PLC, recuerda lo que sabía al reiniciarse y le muestra por dónde fue un mensaje. También es la primera versión bajo la Business Source License de HotLoop, y lo pongo primero porque es la parte que tiene que leer.

## La licencia cambió

La 2.2.0 y todas las versiones posteriores están bajo la Business Source License 1.1 de HotLoop, la misma licencia que el resto de HotLoop. No es una licencia de código abierto y no voy a fingir que lo es. El código de Flow sigue siendo público, así que puede leer cada línea que ejecuta.

- El uso doméstico y de laboratorio es gratuito.
- Las escuelas e instituciones educativas acreditadas, las organizaciones sin ánimo de lucro y los organismos públicos lo usan gratis para sus propias operaciones y su misión.
- El uso empresarial es gratuito cuando pasa por [EmberNet](https://embernet.ai). Es la única vía empresarial.
- No se concede alojar Flow como servicio, revenderlo ni integrarlo en un producto que usted venda.
- Cada versión se convierte a GPL-3.0 o posterior cuatro años después de hacerse pública por primera vez.

`LICENSE` es el texto legal, byte por byte el de HotLoop-io/HotLoop-io. La 2.1.0 y todo lo anterior siguen bajo la licencia con la que salieron. Nada cambia en esas versiones. Los archivos portados de Node-RED conservan sus cabeceras de licencia y créditos originales, así que el texto de su licencia ahora se incluye en `LICENSES/` junto a `NOTICE`, y la imagen lleva ambos en `/usr/share/doc/hotloop-flow/`. `NOTICE` también cubre la copia parcheada de gos7 que Flow lleva ahora (más abajo).

## Novedades

**Trazado y reproducción**
- Cada mensaje tiene un trazado acotado. Haga clic en un mensaje de depuración y el editor ilumina el camino que siguió, con el tiempo y la carga útil en cada salto, a través de divisiones, uniones y subflujos.
- Un trazado se convierte en una prueba de flujo, o se reproduce en un borrador para probar una corrección con el mensaje que lo rompió.
- Cada salto puede enviarse a un colector OpenTelemetry como un span (`trace.otlp.endpoint`).

**Estado que sobrevive a un reinicio**
- El contexto de flujo, global y de nodo vive en un archivo SQLite, `state.db`, en el volumen de datos. Un reinicio ya no lo borra.
- Conexiones durables. Marque una conexión como durable y, mientras el nodo del otro extremo aguante el ritmo, es una conexión normal y no escribe nada. Cuando ese nodo deja de aceptar mensajes, la conexión vuelca en orden al mismo archivo y se vacía cuando el destino vuelve. Lo probamos contra un InfluxDB real detenido diez minutos, con el runtime muerto con `kill -9` en mitad de la caída y del vaciado: ninguno perdido, ninguno duplicado.

**Nodos de planta**
- Lectura y escritura Modbus TCP, lectura, escritura y suscripción OPC UA, lectura y escritura S7, lectura y escritura EtherNet/IP, y Sparkplug B como nodo de borde y como host. Flow ya puede hablar con lo que encuentra `scan`.
- Sparkplug hace los nacimientos, el testamento, `bdSeq`, las peticiones de renacimiento y los comandos que pide la especificación. Lo comprobamos contra una implementación independiente de Sparkplug en ambos sentidos, nodo de borde y host.
- Un dispositivo en silencio hace fallar la petición dentro del tiempo de espera y el siguiente mensaje se reconecta. Una suscripción OPC UA nota que se cayó, lo dice una sola vez y se recupera sola.

**El editor**
- Copiar y pegar, importar y exportar una selección, subflujos con su propio lienzo, grupos anidados, búsqueda en todos los flujos, filtros de depuración y Alt+clic para eliminar una conexión. Una prueba de navegador recorre cada diálogo de nodo de la lista que sirve el runtime, así que un nodo nuevo queda cubierto desde el día en que sale.
- Arrastrar una conexión a un nodo nunca funcionó en Chromium. Ahora funciona.

**Comprobaciones**
- Un nodo cuyo nodo de configuración no está en el archivo (un broker eliminado que un subflujo aún nombra, o una referencia a una pestaña o al tipo equivocado de nodo de configuración) se avisa al importar, al cargar y al desplegar, y no arranca. Antes simplemente nunca funcionaba.
- Eliminar un flujo o un nodo quita su id de los ámbitos de Catch, Status y Complete que lo nombraban.

## Qué cambió

- El contexto persiste por defecto. `store.context.persist` está activado, así que un valor fijado antes de un reinicio sigue ahí después, mientras que antes cada reinicio empezaba vacío. Un flujo que contaba con un contexto vacío al arrancar ahora debe limpiar lo que espera tener limpio. Ponga `persist` en `false` para el comportamiento anterior.
- El trazado está activado por defecto y acotado en todos los sentidos: 256 recorridos, 512 saltos cada uno, 16 MiB en total, 1000 recorridos nuevos por segundo. Es solo memoria, así que un reinicio empieza la lista de nuevo. `trace.enabled: false` lo desactiva.
- gos7 imprimía una línea sin procesar en el registro global de Go en cada tiempo de espera de S7, y nada en el nodo podía desactivarlo.
- La cola durable cuenta un mensaje como en espera después de que está en disco, no antes.
- La imagen se construye y se sube con Podman, no con Docker. La misma imagen, las mismas etiquetas (`2.2.0`, `2.2`, `2`), siempre linux/amd64 y linux/arm64.

## Notas de actualización

Desde la 2.1.0 basta con cambiar la imagen (`helm upgrade`, o la nueva etiqueta en su unidad Quadlet). Sin migración, sin ninguna opción. Un `flows.json` y un archivo de configuración que funcionaban en la 2.1.0 funcionan en la 2.2.0, y el viaje de ida y vuelta byte por byte del archivo de flujos no se toca.

- El primer arranque crea `state.db` en `data.dir`, en el volumen. Con `persistence.enabled` en false en el chart, sobrevive a un reinicio del contenedor y no a un reemplazo del pod.
- Volver a la 2.1.0 deja `state.db` donde está. La 2.1.0 no tiene código que lo lea.
- Cada escritura en `state.db` es una escritura en una tarjeta SD o un SSD, así que los valores por defecto agrupan. Los cambios de contexto esperan `flushInterval` (30 segundos) y se escriben juntos, y un valor fijado a lo que ya era no escribe nada. Un `kill -9` puede perder ese margen. `docs/durable/README.md` tiene las cifras y lo que le cuesta a una tarjeta.

## Ajustes nuevos

| YAML | Entorno | Por defecto |
|---|---|---|
| `store.path` | `HOTLOOP_FLOW_STORE_PATH` | vacío, que es `state.db` en `data.dir` |
| `store.synchronous` | `HOTLOOP_FLOW_STORE_SYNCHRONOUS` | `normal`. `full` hace fsync en cada commit y desgasta la tarjeta por ello. |
| `store.context.persist` | `HOTLOOP_FLOW_CONTEXT_PERSIST` | `true` |
| `store.context.flushInterval` | `HOTLOOP_FLOW_CONTEXT_FLUSH_INTERVAL` | `30s`. `0s` escribe cada cambio antes de que el flujo avance. |
| `store.durable.maxBytes` | `HOTLOOP_FLOW_DURABLE_MAX_BYTES` | 256 MiB para todas las conexiones durables juntas |
| `store.durable.ackFlush` | `HOTLOOP_FLOW_DURABLE_ACK_FLUSH` | `100ms`. `0s` marca cada mensaje antes de enviar el siguiente. |
| `trace.enabled`, `trace.traces`, `trace.maxHops`, `trace.maxMessageBytes`, `trace.maxBytes`, `trace.perSecond` | | `true`, 256, 512, 16384, 16 MiB, 1000. `perSecond: 0` traza cada mensaje. |
| `trace.otlp.endpoint`, `trace.otlp.serviceName`, `trace.otlp.interval` | `HOTLOOP_FLOW_TRACE_OTLP_ENDPOINT` | vacío (sin exportación), `hotloop-flow`, `2s` |
| `trace.otlp.headersSecret` (chart) | `HOTLOOP_FLOW_TRACE_OTLP_HEADERS` | ninguno. Una clave de Secret con pares `Name=value` separados por comas, para la clave de API de un colector alojado. |

El chart tiene todo esto bajo `store` y `trace` en `values.yaml`.

Imagen: `ghcr.io/hotloop-io/hotloop-flow:2.2.0`, linux/amd64 y linux/arm64. Chart: `https://hotloop.io/hotloop-flow/`. El README de esta etiqueta tiene el resto: https://github.com/HotLoop-io/hotloop-flow/blob/v2.2.0/README.md
