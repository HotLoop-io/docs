---
title: "Notas de versión: HotLoop Transmitter 1.0.0"
description: "La primera versión de HotLoop Transmitter: una biblioteca de CODESYS que publica valores del PLC como OPC UA PubSub, qué incluye, qué se ejecutó y qué no."
---

Primera versión. Una biblioteca de CODESYS, escrita en Structured Text sobre UDP de SysSocket, que pone los valores de su PLC en la red como OPC UA PubSub (Parte 14, UADP). Usted añade la biblioteca, declara un bloque de función, añade las variables que quiere enviar y lo llama una vez por ciclo. Cualquier cosa que se suscriba a OPC UA PubSub puede leerlo, incluido HotLoop core, desde 4.19.4.

Lo que esto significa para usted: un PLC sin biblioteca PubSub ya puede alimentar a un suscriptor PubSub con unas quince líneas de Structured Text, y no se instala nada más en el controlador.

## Qué incluye

* Un bloque, `HLTX.FB_HLTX_Publisher`. Un NetworkMessage por intervalo de publicación, un DataSetMessage, un Data Key Frame, de modo que cada mensaje lleva todos los campos.
* Codificaciones de campo Variant y RawData, elegidas por publicador. Variant lleva sus propios tipos. RawData no lleva ninguno, así que hay que indicar la disposición al receptor, lo que la [página del formato de transmisión](/es/transmitter/wire-format/) detalla byte a byte.
* Campos BOOL, SINT, USINT, INT, UINT, DINT, UDINT, LINT, ULINT, REAL, LREAL, STRING y TIME, y arrays de todos ellos salvo STRING, hasta 128 campos y 1472 bytes por mensaje. Un mensaje nunca se fragmenta.
* Unicast o multicast, con el id del publicador, el id del grupo de escritores, el id del escritor del conjunto de datos, el intervalo de publicación, la versión del grupo y la versión de la configuración como entradas.
* Un envío sin bloqueo. Una dirección incorrecta, un socket caído o una lista de campos demasiado grande ponen el bloque en un estado de error que usted puede leer y nunca provocan un fallo de su aplicación.

## Qué ejecutamos y qué mostró

Todo contra CODESYS Control for Linux SL 4.22.0.0, con los archivos de abajo.

* La biblioteca compila con 0 errores y 0 advertencias en CODESYS 3.5.22.30. La aplicación de ejemplo compila contra ella con 0 errores y 0 advertencias.
* Dos publicadores, uno Variant y otro RawData, de diecisiete campos cada uno. Cada valor en la red es igual a lo que el PLC informa por su propio servidor OPC UA, sin huecos en los números de secuencia.
* Una pila PubSub independiente decodifica el mensaje Variant completo y los escalares RawData. No puede leer en absoluto un array RawData ni una cadena RawData larga, lo que es su límite y no el de la biblioteca.
* El suscriptor de HotLoop core (de su rama main cuando se ejecutó esto, y en HotLoop core 4.19.4 y todas las versiones posteriores) lee ambos publicadores, incluidos la cadena, el TIME, los dos arrays y dos contadores que cambian entre lecturas, y no rechaza nada.
* Un segundo decodificador lee los 222 datagramas capturados.
* Coste en una tarea de 20 ms, con dos publicadores: unos 10,6 us añadidos por ciclo de media. Un ciclo que envía cuesta de 10 a 100 us. La cola es la llamada `sendto`, y en un host compartido ocupado llegó una vez a 14,3 ms en 12 000 ciclos. Ponga el publicador en su propia tarea de menor prioridad si eso importa para la lógica de su control. La [página de tiempos](/es/transmitter/timing/) tiene la tabla.

## Qué comprobar en su controlador

* El manejo del orden de bytes para un destino big endian está escrito, así que compruébelo en su propio controlador.
* Multicast: el bloque fija el TTL, el loopback y la interfaz de envío para el grupo, así que compruebe el grupo en su propia red.
* Si la red desaparece o una dirección no existe, el bloque cuenta el fallo y espera más entre intentos, y el programa sigue escaneando.
* En modo demo el runtime se detiene al final de su ventana de dos horas, como dice CODESYS.

## No incluido en esta versión

Marcas de tiempo de DataSetMessage y NetworkMessage, KeepAlive y Delta Frames, más de un DataSetMessage por NetworkMessage, WSTRING, un estado por campo, seguridad de los mensajes y el lado del suscriptor. La [hoja de ruta](/es/transmitter/roadmap/) dice cuáles vienen después.

## Si viene de otro publicador

Un receptor que insista en una marca de tiempo, un KeepAlive o un Delta Frame no quedará satisfecho con esta versión, porque no se envía ninguno. Cada mensaje es un Key Frame, que cualquier receptor puede leer en frío. Un array RawData aquí es una longitud Int32, los elementos y un relleno de ceros hasta el tamaño declarado, que es como lo escribe la pila de referencia de la OPC Foundation. A un receptor que espera un array como elementos seguidos sin longitud hay que indicarle que los campos son escalares separados.

## Para un proyecto que ya la usa

No hay una versión anterior. El formato de transmisión cambia solo cuando cambia `udiConfigMajor`, y un proyecto de PLC fijado a esta versión de la biblioteca conserva los mismos campos y bytes.

## Archivos

Descargue los dos archivos y `SHA256SUMS` desde https://hotloop.io/hotloop-transmitter/1.0.0/, y luego instale `HotLoopTransmitter-1.0.0.library` con Herramientas, Repositorio de bibliotecas, Instalar en CODESYS 3.5 SP22 o posterior. El `.compiled-library` es la misma biblioteca sin su código fuente.

```
91b8023a73870925082c170588feb43d363e6d07ce008e1471fa8f5ff8db2c0d  HotLoopTransmitter-1.0.0.library
b02b0b40e434f35e4af1def20d6cc38688463537c4800354931b8c6094a66686  HotLoopTransmitter-1.0.0.compiled-library
```
