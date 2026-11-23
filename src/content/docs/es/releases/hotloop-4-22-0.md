---
title: "Notas de versión: HotLoop core 4.22.0"
description: "Qué trae HotLoop core 4.22.0, qué cambia al actualizar y qué leer antes de tocar una planta en marcha."
sidebar:
  label: "4.22.0"
---

Una pantalla abierta como panel (`/?screen=<name>`) ahora llena su pantalla de borde a borde a cualquier tamaño, la pantalla Alarms puede importar un archivo de alarmas de CODESYS, y unas cuantas correcciones. Compilada solo para amd64; la compilación multiarquitectura sigue como la siguiente versión.

## Qué cambió

- **Una página de panel llena su pantalla.** A 1920x1080, 1366x768 y 3840x2160 cubre la pantalla sin espacio muerto. Tiene una cabecera con el nombre de la planta, un estado Live con cuántos dispositivos están en línea y un reloj de 24 horas con la fecha. Los números y los indicadores crecen con la pantalla, y también el eje y la leyenda de la tendencia. Solo cambia la página de panel; los paneles están como estaban y las tarjetas, tamaños y nombres de un cliente son suyos.
- **La pantalla Alarms importa un archivo Export Alarms de CODESYS.** Solo para administradores: elige el dispositivo, nombra la aplicación, elige el archivo, lee la vista previa de lo que pasa y lo que no, y luego importa. La ruta de la API ya existía.
- **Los dispositivos OPC UA PubSub en una misma dirección y puerto comparten un socket.** El segundo dispositivo nunca podía enlazar, y las opciones de reutilización repartían los datagramas de un publicador entre ellos.
- **Las respuestas lentas ya no se apilan.** Una tarjeta de cámara más lenta que su actualización ahora muestra su imagen, las tarjetas y la pantalla de UniFi vuelven a preguntar solo después de la última respuesta, un lote de descubrimiento que falló una vez se reintenta, y un dispositivo SNMP con nombre de host conserva su propia espera de la respuesta.
- **Los productos del núcleo están bajo la HotLoop Free Use License 1.0.** Las versiones anteriores conservan los términos bajo los que se publicaron. Mira NOTICE.
- **El icono del App Store** en las páginas de los charts es la marca de HotLoop.

## Cambios en la API

Ninguno.

## Actualizar desde 4.21.1

Un `helm upgrade` normal. Sin migración, sin secretos nuevos, nada que no se pueda deshacer.

## Probado

La página de panel se comprobó en pruebas con los tres tamaños anteriores, con Emberburn alimentando un Gateway.
