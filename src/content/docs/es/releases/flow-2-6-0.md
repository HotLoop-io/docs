---
title: "Notas de versión: HotLoop Flow 2.6.0"
description: "Qué trae HotLoop Flow 2.6.0, qué cambia al actualizar y qué conviene leer antes de tocar una planta en marcha."
sidebar:
  label: "2.6.0"
---

HotLoop Flow 2.6.0 da a una conexión durable una forma de avisarle de que ha dejado de entregar. Nada de cómo funcionan sus flujos cambia. Si usa conexiones durables en una línea de planta, lo que obtiene es un contador sobre el que puede alertar para el único fallo que antes parecía una cola tranquila.

## Novedades

**Una conexión durable atascada se cuenta y se describe.** La bomba de una conexión durable ahora detecta cuando la conexión dice que hay mensajes esperando y la cola no tiene nada que pueda leer, y sigue así tras una breve nueva comprobación. Suma uno a `hotloop_flow_durable_wire_stranded_total{wire=...}` y escribe una advertencia en el registro del runtime, una vez por tipo de fallo, con los contadores de la conexión junto a lo que contiene su tabla: hasta dónde llegó la bomba, la profundidad, las filas en disco, lo que está en vuelo y cuántos se añadieron, entregaron y descartaron. En una conexión sana el contador es cero y sigue en cero, así que cualquier valor por encima de cero merece un aviso.

Lo añadimos porque una conexión que descarta lo más antiguo falló al vaciarse una vez cada unos miles de ejecuciones de prueba y no pudimos atrapar el motivo. Esta versión es el instrumento, no una corrección. Si alguna vez salta en su línea, la línea de registro es lo que necesitamos.

## Qué cambió

- El texto de licencia que incluye la imagen escribe EmberNet como lo hace la copia canónica. Tres líneas, solo ortografía.
- Las imágenes del README son imágenes normales, primero claras y luego oscuras, así que se ven en docs.hotloop.io.

## Ajustes nuevos

Ninguna. La métrica está activada y no hay interruptor.

## Actualización

Un simple `helm upgrade` a la imagen y el chart de la 2.6.0, o la nueva etiqueta en su unidad Quadlet. No pasa nada en el primer arranque, no hay nada que migrar, y los flujos, los registros de despliegue y las credenciales no se tocan.

Imagen: `ghcr.io/hotloop-io/hotloop-flow:2.6.0`, linux/amd64 y linux/arm64. Chart: `https://hotloop.io/hotloop-flow/`. El README de esta etiqueta tiene el resto, con imágenes: https://github.com/HotLoop-io/hotloop-flow/blob/v2.6.0/README.md
