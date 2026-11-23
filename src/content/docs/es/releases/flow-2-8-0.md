---
title: "Notas de versión: HotLoop Flow 2.8.0"
description: "Qué trae HotLoop Flow 2.8.0, qué cambia al actualizar y qué conviene leer antes de tocar una planta en marcha."
sidebar:
  label: "2.8.0"
---

HotLoop Flow 2.8.0 añade cuatro cosas a FlowLab, la pestaña de diagramas para bancos de pruebas y registradores de datos: nodos de análisis, un nodo de adquisición de datos para hardware de NI, una salida MQTT que conserva lo que el broker pierde y un registro TDMS. Los flows funcionan exactamente como antes, un archivo de flows que tiene hoy se carga y se guarda byte por byte, y una pestaña que no es un diagrama no ve nada de esto.

## Novedades

**Análisis.** Cuatro nodos trabajan sobre una matriz de lecturas: estadísticas (media, RMS, mínimo, máximo y desviación típica), integral (el área bajo la matriz por la regla del trapecio, como un solo número o como un área acumulada), derivada (la pendiente en cada muestra) y un filtro Butterworth de orden 1 a 10 como paso bajo, paso alto, paso de banda o rechazo de banda, con la frecuencia de corte en hercios.

**Un nodo de adquisición de datos.** `read DAQ task` lee muestras de hardware de NI, como un chasis CompactDAQ, a través del Device Server gRPC de NI. El cliente es tan pequeño como se puede: el HTTP/2 propio de Go con mensajes escritos a mano, así que el binario no incorporó una biblioteca gRPC.

**Una salida MQTT que no pierde nada.** `mqtt out` publica a través del broker que configura el archivo de flows, la misma conexión que usan los nodos MQTT. Márquela como duradera y un mensaje que el broker pierde se escribe en disco antes de que el nodo termine y se envía, el más antiguo primero, cuando el broker vuelve, incluso tras un reinicio. Nada adelanta a lo que espera por delante. Su salida de enviado indica si el mensaje salió directamente.

**Un registro TDMS.** `log to TDMS file` añade un registro a un archivo TDMS, un canal por campo, y el archivo se abre en las herramientas que un laboratorio ya tiene. Un archivo cuya última escritura quedó cortada por un corte de corriente sigue leyéndose hasta el último valor completo.

## Qué cambió

- Ahora hay 28 tipos de nodo en la sección FlowLab de la paleta, frente a 21, y el README lo dice.
- Un paso que falló una vez en la ejecución de la 2.7.1 no imprimió nada, y la causa fue la prueba del recolector comparando un intervalo antes de que el registro que lee lo tuviera completo; ahora espera al intervalo entero. Otras dos pruebas se hicieron esperar lo que comprueban. Nada de eso se incluye en la versión.
- Las imágenes del README se tomaron de nuevo para que la barra superior diga v2.8.0.
- Los tamaños del binario y de la imagen del README se volvieron a medir para esta versión.

## Ajustes nuevos

Ninguno.

## Actualización

En amd64, un simple `helm upgrade` a la imagen y el chart 2.8.0, o la nueva etiqueta en su unidad Quadlet. En arm64, quédese donde está hasta la 2.8.1, que es esta versión con arm64 añadido y nada más. Al primer arranque no ocurre nada y no hay nada que migrar.

Imagen: `ghcr.io/hotloop-io/hotloop-flow:2.8.0`, solo linux/amd64. Construimos primero amd64, dejamos que se lea como estable en producción y después una pequeña 2.8.1 sin nada más añade arm64. Hasta entonces, la etiqueta `2` contiene la nueva imagen amd64 y la imagen arm64 de la 2.7.1, así que una máquina en arm64 que siga `2` o `2.7` conserva lo que tiene, y una máquina fijada a `2.8.0` necesita amd64. Chart: `https://hotloop.io/hotloop-flow/`. El README de esta etiqueta tiene el resto, con imágenes: https://github.com/HotLoop-io/hotloop-flow/blob/v2.8.0/README.md
