---
title: "Notas de versión: HotLoop Transmitter 1.1.0"
description: "Cada mensaje lleva una marca de tiempo del reloj del PLC y la biblioteca se instala desde un paquete de CODESYS: qué cambió, qué se ejecutó y qué no."
---

Cada mensaje lleva ahora una marca de tiempo del reloj del PLC, y la biblioteca se instala desde un `.package` de CODESYS.

Lo que esto significa para usted: un suscriptor que quiera saber cuándo se muestreó un valor lo obtiene del paquete en vez de adivinarlo por el momento en que llegó, y usted puede instalar la biblioteca con el CODESYS Installer como cualquier otro complemento.

## Qué cambia para un proyecto que usa 1.0.0

* **Marcas de tiempo, activadas por defecto.** El NetworkMessage y el DataSetMessage llevan cada uno un Timestamp (Parte 14, 7.2.4.4.2 y 7.2.4.5.4), el mismo DateTime, leído del reloj de tiempo real del PLC una vez por mensaje. ExtendedFlags1 pasa de `01` a `21`, DataSetFlags1 de `69` o `6B` a `E9` o `EB`, y se añade un byte DataSetFlags2 `10`. Un mensaje es 17 bytes más largo. La lista de campos y los valores no cambiaron, y `udiConfigMajor` es el mismo.
* **`bTimestamp := FALSE` envía exactamente los bytes de 1.0.0.** Fíjelo si un receptor suyo rechaza las marcas de tiempo. Se comprobó: mensajes de 1142 y 1144 bytes, ninguno con marca, los tamaños que enviaba 1.0.0.
* **La resolución es de un segundo.** El reloj se lee con `SysTimeRtcGet`, que da segundos enteros, así que un receptor ve la misma marca en todos los mensajes dentro de un segundo y puede ir hasta un segundo por detrás del instante en que se construyó el mensaje. Las marcas de menos de un segundo están en la hoja de ruta.
* **Una salida nueva, `diLastClockResult`.** Si no se puede leer el reloj, el mensaje sale sin marca, lo que la Parte 14 permite, y esto dice por qué.
* **Una biblioteca de sistema nueva, SysTimeRtc.** La biblioteca la nombra como marcador de posición, igual que SysSocket, y el runtime la proporciona. Control for Linux SL 4.22.0.0 la tiene. Un destino que no la tenga no puede usar 1.1.0 con marcas de tiempo; quédese en 1.0.0.
* **El `.package`.** `HotLoopTransmitter-1.1.0.package` lo hizo el propio PackageManagerCLI de CODESYS y pone la misma biblioteca en el repositorio de bibliotecas a través del Installer. Vea la [página de instalación](/es/transmitter/install/).

## Qué ejecutamos y qué mostró

Todo contra CODESYS Control for Linux SL 4.22.0.0, con los archivos de abajo.

* La biblioteca compila con 0 errores y 0 advertencias en CODESYS 3.5.22.30. La aplicación de ejemplo compila contra ella con 0 errores y 0 advertencias.
* Dos publicadores, Variant y RawData, con marcas de tiempo. Un decodificador independiente escrito a partir de la especificación decodifica cada mensaje y cada valor es igual a lo que el PLC informa por su propio servidor OPC UA. Cada mensaje tiene ambas marcas, son el mismo instante, nunca retroceden, están dentro de la tolerancia de segundo entero del reloj en que se hizo la captura, y en una captura de 11 segundos la marca avanzó 11 segundos. El contenedor comparte el reloj del host, así que esto demuestra que la marca es la lectura del reloj del PLC y no una inventada; no prueba un controlador con el reloj mal puesto.
* Una pila PubSub independiente lee el Timestamp del NetworkMessage y del DataSetMessage de los 113 mensajes de cada escritor con sus propios decodificadores de cabecera, y decodifica los valores como hizo con 1.0.0.
* El suscriptor de HotLoop core (de su rama main cuando se ejecutó esto, y en HotLoop core 4.19.4 y todas las versiones posteriores) lee ambos publicadores contra un runtime en vivo: 21 valores cada uno, ambos contadores avanzando, nada rechazado. Cada lectura lleva como hora la marca de segundo entero del publicador, y la marca avanzó con el reloj del PLC durante una espera de 3 segundos.
* El `.package` se instala con `PackageManagerCLI --install`, la biblioteca aparece en el repositorio System (antes no estaba), y el ejemplo compila contra la biblioteca tal como la dejó el Installer, con 0 errores y 0 advertencias.
* Coste en una tarea de 20 ms, con dos publicadores: unos 9,6 us añadidos por ciclo de media, de 10 a 100 us en los ciclos que envían, y el ciclo más largo de la prueba 81 us. En esa prueba se saltaron tres turnos de publicación y no se rechazó ningún envío. La marca de tiempo en sí no se nota en las cifras. La [página de tiempos](/es/transmitter/timing/) tiene la tabla.

## Qué comprobar en su controlador

* El manejo del orden de bytes para un destino big endian está escrito, así que compruébelo en su propio controlador.
* Multicast: el bloque fija el TTL, el loopback y la interfaz de envío para el grupo, así que compruebe el grupo en su propia red.
* Si la red desaparece o una dirección no existe, el bloque cuenta el fallo y espera más entre intentos, y el programa sigue escaneando.
* En modo demo el runtime se detiene al final de su ventana de dos horas, como dice CODESYS.
* Un controlador cuyo reloj de tiempo real no está puesto o está mal pondrá la marca que diga el reloj.

## No incluido en esta versión

KeepAlive y Delta Frames, más de un DataSetMessage por NetworkMessage, WSTRING, un estado por campo, marcas de tiempo de menos de un segundo, seguridad de los mensajes y el lado del suscriptor. La [hoja de ruta](/es/transmitter/roadmap/) dice cuáles vienen después.

## Volver atrás

Un proyecto de PLC fijado a 1.0.0 sigue funcionando y sigue enviando los bytes de 1.0.0. Dentro de 1.1.0, `bTimestamp := FALSE` da los mismos bytes.

## Archivos

Descárguelos de https://hotloop.io/hotloop-transmitter/1.1.0/ y compárelos con `SHA256SUMS` en la misma carpeta.

```
5ec021b23f5d57460016834a03b2b196d6dbc83aeb5d0ad60ace8d7b4fbbb4a7  HotLoopTransmitter-1.1.0.library
e172f4674f6cbfce2aeaf017d5a6c733245b1b9aa3e527369c753bf07b6ce0c2  HotLoopTransmitter-1.1.0.compiled-library
b3686bdebd052f1ddea46d1f1ff409f3b6c9a016ca5f3e8f4cd6f7922ccb479c  HotLoopTransmitter-1.1.0.package
```
