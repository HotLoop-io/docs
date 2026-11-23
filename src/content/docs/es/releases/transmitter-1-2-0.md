---
title: "Notas de versión: HotLoop Transmitter 1.2.0"
description: "HotLoop Alarms se une a la versión: una biblioteca que pone las alarmas propias de un PLC donde HotLoop las lee. El publicador no cambia."
---

Esta versión añade HotLoop Alarms, una segunda biblioteca que pone las alarmas propias de su PLC donde HotLoop las lee, y entrega el Transmitter como 1.2.0.0 con el mismo publicador que tenía en 1.1.0.

Lo que esto significa para usted: las alarmas que su proyecto CODESYS ya genera aparecen en la lista de alarmas de HotLoop, y reconocer una en HotLoop la reconoce en el PLC. Si solo usa el publicador, no hay nada que cambiar.

## Qué cambia para un proyecto que usa 1.1.0

* **HotLoop Alarms 1.0.0.0, nueva.** `HotLoopAlarms-1.0.0.0.library` y `.compiled-library` están en la versión. El bloque, `HLAL.FB_HLAL_Alarms`, es un cliente del gestor de alarmas de CODESYS. Llamado una vez por ciclo, copia las alarmas activas, en espera y reconocidas en una tabla de variables simples (`aAlarms`, 64 filas) que el servidor OPC UA del runtime exporta como cualquier otra variable. `udiChanges` cuenta hacia arriba cuando la tabla cambió, y `uiDropped` cuenta las alarmas activas que no cupieron en lugar de perderlas en silencio. No necesita ninguna biblioteca conectora de alarmas generada, solo la propia Alarm Configuration del proyecto.
* **El reconocimiento vuelve.** Una escritura de las variables de comando (`uiAckGroupId`, `uiAckAlarmId`, `udiAckInternalId` o `bAckAll`, y luego un número nuevo en `udiAckRequest`) hace que el bloque reconozca esa alarma, o todas, a través del gestor de alarmas. HotLoop 4.23.6 y posteriores encuentra el bloque por lo que contiene y hace todo esto por usted.
* **El publicador del Transmitter no cambió.** La lista de campos y el formato de transmisión no se movieron, y `bTimestamp` funciona como antes. La biblioteca se recompila como 1.2.0.0, y el `.package` la lleva.
* **La licencia es la HotLoop Source License Agreement 1.0,** la misma que la de todos los productos de HotLoop.

## Qué ejecuté y qué mostró

Todo en el laboratorio, contra CODESYS Control for Linux SL 4.22.0.0 en un contenedor.

* La biblioteca Transmitter compila con 0 errores y 0 advertencias en CODESYS 3.5.22.30, y también las aplicaciones de ejemplo compiladas contra ella.
* El laboratorio: dos publicadores, Variant y RawData, 114 mensajes de cada uno decodificados, cada valor igual a lo que el PLC informa por su propio servidor OPC UA, sin huecos en los números de secuencia, ambas marcas de tiempo en cada mensaje, y los bytes de 1.0.0 con `bTimestamp := FALSE`. Una implementación independiente de OPC UA PubSub lee los valores y las marcas de tiempo de cada mensaje. Pasaron 128 comprobaciones y no falló ninguna.
* El suscriptor UADP de HotLoop core lee ambos publicadores contra un runtime en vivo: cada valor igual, ambos contadores avanzando, 62 key frames recibidos y ninguno rechazado.
* El `.package` se instala con `PackageManagerCLI --install`, la biblioteca aparece en el repositorio System, y el ejemplo compila contra ella con 0 errores y 0 advertencias.
* HotLoop Alarms: contra un runtime real con una Alarm Configuration de dos alarmas, un disparo en el PLC se ve en HotLoop, un reconocimiento en HotLoop deja la tabla del PLC en reconocida con la hora, un rearme la deja en espera de la confirmación, y una confirmación en HotLoop vacía la tabla del PLC. La segunda alarma sigue el orden contrario, y reconocer todas reconoció las dos alarmas activas.
* Coste del publicador en una tarea de 20 ms, con dos publicadores, fijado a cuatro núcleos: unos 15 us añadidos por ciclo de media y el ciclo más largo de 144 us, sin turnos de publicación saltados ni envíos rechazados. Una biblioteca 1.1.0 recompilada en la misma hora midió 15,2 us y 261 us.

## Qué no ejecuté

* Ningún controlador físico, ningún runtime de CODESYS salvo Control for Linux SL 4.22.0.0, y ninguna CPU salvo x86-64.
* HotLoop Alarms con una clase de alarma distinta de la que reconoce y pide confirmación, ni con más de 64 alarmas activas a la vez.
* El `.package` en la ventana del CODESYS Installer. Se instaló sin interfaz con PackageManagerCLI.
* Un controlador cuyo reloj de tiempo real no está puesto o está mal, multicast, un runtime que pierde y recupera su red, y el final de la ventana demo de dos horas.

## No incluido en esta versión

KeepAlive y Delta Frames, más de un DataSetMessage por NetworkMessage, WSTRING, un estado por campo, marcas de tiempo de menos de un segundo, seguridad de los mensajes y el lado del suscriptor. La [hoja de ruta](/es/transmitter/roadmap/) dice cuáles vienen después.

## Volver atrás

Un proyecto de PLC fijado a 1.1.0 sigue funcionando y envía los mismos bytes. HotLoop Alarms es una biblioteca aparte: un proyecto que no la añade no se ve afectado.

## Archivos

Descárguelos de https://hotloop.io/hotloop-transmitter/1.2.0/ y compárelos con `SHA256SUMS` en la misma carpeta.

```
e68cfc88e599ddcf278eb208ff500f4f78d3faf74edf12e38f308a009f478594  HotLoopAlarms-1.0.0.0.compiled-library
68f704fc5662bbc67ec097016a741065d705af01913a2746296c17f9e6991118  HotLoopAlarms-1.0.0.0.library
a404f20fc35c4a3d804aa194f29def3f8193e26e696357899d3ae5b3d44948c1  HotLoopTransmitter-1.2.0.compiled-library
05200d0279ac120fd69d2dc3eeba99d9b40cb76eba2d15d1431b94c5e8f3fc32  HotLoopTransmitter-1.2.0.library
d6b6606a5919e18d2d6d31a5529af4d76bc7058003fb26032ec1a578f78ea57d  HotLoopTransmitter-1.2.0.package
```
