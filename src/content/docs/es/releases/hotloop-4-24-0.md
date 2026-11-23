---
title: "Notas de versión: HotLoop core 4.24.0"
description: "Qué trae HotLoop core 4.24.0, qué cambia al actualizar y qué leer antes de tocar una planta en marcha."
sidebar:
  label: "4.24.0"
---

Las pantallas de HotLoop son P&ID. Las propias alarmas de un PLC CODESYS aparecen en la lista de alarmas de HotLoop y un reconocimiento vuelve al PLC, una ejecución de script siempre termina, el volumen de datos de un equipo siempre se lee, y las líneas de la hoja de ruta de UniFi Protect, Access y alimentación están entregadas. Compilada solo para amd64; la compilación multiarquitectura sigue como la siguiente versión.

## Qué cambió

- **Las pantallas son P&ID.** Suelta tanques, bombas, válvulas, intercambiadores de calor, filtros, instrumentos y uniones en una página de símbolos, luego arrastra de un punto de conexión a otro: la tubería se traza sola en ángulos rectos alrededor de todo lo que hay en la página, se deriva con una unión donde la sueltas sobre otra tubería y se vuelve a trazar mientras mueves un símbolo. Cada tubería lleva su medio (agua, vapor, combustible, aire, energía, señal y más, cada uno con un color, un código y un patrón de línea, así que el color nunca es el único portador) y se mueve con su tag o una regla. Cada página de símbolos recibe una barra de herramientas para hacer zoom, desplazar, mostrar un minimapa y cambiar a la vista gris de alto rendimiento, y un P&ID se guarda, exporta e importa en el mismo archivo de pantalla. Mira [Paneles](/es/iot/dashboards/) y [Screen files](/es/iot/screen-file/).
- **Las propias alarmas de un PLC CODESYS aparecen en la lista de alarmas de HotLoop.** La Alarm Configuration de un proyecto guarda grupos y clases de alarmas, y alarmas que vigilan una variable. Un dispositivo CODESYS ahora lee las que guarda el gestor de alarmas de su PLC (activas, a la espera de reconocimiento, reconocidas mientras la condición sigue vigente), y un reconocimiento hecho en HotLoop vuelve al PLC. Un PLC que no tiene ninguna que dar se deja en paz. Necesita la biblioteca HotLoop Alarms y un bloque en el proyecto. Mira CODESYS-ALARMS.md.
- **El volumen de datos del equipo siempre se lee.** Un equipo sin nada montado bajo `/data` no tiene `/data`, y el tag `data_util_pct` de salud del equipo se leía malo con «no such file or directory». Ahora lee el volumen en el que se creará la carpeta de datos. Mira [Protocolos y drivers](/es/iot/protocols/#salud-del-equipo).
- **Una ejecución de script siempre termina.** Cuando la base de datos rechazaba la escritura del final de una ejecución de script, HotLoop lo registraba y se rendía, así que la ejecución se leía «running» durante toda la vida del proceso con su hueco libre desde hacía tiempo. Ahora la escritura se vuelve a pedir, hasta cinco veces con una breve espera entre ellas.
- **UniFi Protect, Access y las salidas de PDU SmartPower están entregados en la hoja de ruta.** Llegaron como dispositivos en la 4.23.6, construidos según las API publicadas, con cada ruta de Protect coincidiendo con el documento 7.4.102. Mira [la hoja de ruta de HotLoop](/es/roadmap/).
- **Una pantalla TwinCAT se prueba en un navegador.** El ejemplo TwinCAT PackML se importa con sus marcos, se renderiza, y una lámpara sigue un registro en vivo.
- **Las pruebas esperan lo que están esperando.** La espera del throttle del panel se comprueba como aritmética, el temporizador de la retención forSec está en manos de la prueba y no en una carrera contra una pausa, la prueba de topics de Apache Kafka borra sus topics enseguida y tiene el tiempo que necesita un equipo lento, y una prueba de API ya no acota un inicio de sesión con una sola muestra, porque un equipo cargado responde cuatro veces más lento que un segundo antes.

## Migraciones

Ninguno.

## Cambios en la API

Ninguno. No cambió ninguna ruta. La configuración de una página de símbolos acepta `pipes`, `view` y el `rot` de un símbolo, y un archivo de pantalla guardado los lleva.

## Actualizar desde 4.23.6

Un `helm upgrade` normal. Sin migración y sin secreto nuevo. Una página de símbolos sin tuberías se dibuja como antes.

## Qué no está probado

- La ruta de alarmas del PLC se ejecutó contra un runtime real CODESYS Control for Linux SL 4.22.0.0 con el programa de laboratorio de alarmas.
- Protect, Access y las salidas de la PDU siguen las API publicadas, y la prueba en banco con equipo real sigue en la oficina.
