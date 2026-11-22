---
title: "Qué se ejecutó"
description: "Con qué se compiló la biblioteca, dónde se ejecutó, quién la leyó de vuelta, y el único punto en que dos lectores discrepan."
---

Esta página es la ejecución de 1.0.0. La ejecución de 1.1.0, con marcas de tiempo y el `.package`, está en las [notas de la versión 1.1.0](/es/releases/transmitter-1-1-0/). Desde entonces la biblioteca se ha ejecutado en hardware sin sistema operativo (2026-11-17).

## La compilación

* Biblioteca: compila con 0 errores y 0 advertencias en el ScriptEngine de CODESYS 3.5.22.30 (SP22 Patch 3).
* Aplicación de ejemplo, compilada contra la biblioteca instalada, para el dispositivo CODESYS Control for Linux SL (4102, 0000 0005, 4.20.0.0): 0 errores, 0 advertencias, lista para descargar.

## El runtime

CODESYS Control for Linux SL 4.22.0.0 carga la aplicación como proyecto de arranque e informa `Application started`, `CODESYS Control ready`. Funciona en modo demo, porque no hay licencia de runtime.

## Lo que pasó por el cable y quién lo leyó

La aplicación de ejemplo tiene dos publicadores: writer group 1 y dataset writer 1 en codificación Variant (1142 bytes), y writer group 2 y dataset writer 2 en codificación RawData (1144 bytes). Diecisiete campos cada uno: uno de cada tipo que admite la biblioteca, un array REAL de 250 elementos, un array INT de 4 elementos y dos contadores.

Lo leyeron cuatro lectores independientes.

| Lector | Qué es | Variant | RawData |
|---|---|---|---|
| Un decodificador escrito a partir de la especificación | escrito solo a partir de OPC 10000-14 y 10000-6, que además lee las mismas variables del servidor OPC UA del runtime y las compara | todos los campos iguales a los del PLC, sin huecos en las secuencias de NetworkMessage y DataSetMessage durante la captura | lo mismo |
| Una pila OPC UA PubSub independiente | un suscriptor con metadatos de DataSet de los 17 campos | los 15 valores comprobados son iguales, incluidos la cadena, ambos arrays y el TIME | los 11 escalares numéricos son iguales. Esa pila no lee cadenas RawData de ninguna longitud ni arrays RawData |
| El suscriptor UADP de HotLoop core | el driver de HotLoop core 4.19.4 y de todas las versiones posteriores, ejecutado contra un runtime activo y con el diseño RawData indicado en sus tipos de DataSet | 21 valores comprobados iguales, incluidos la cadena, el TIME y los elementos 0, 1, 124 y 249 del array REAL de 250 y los cuatro del array INT, y ambos contadores avanzando entre dos lecturas separadas 3 segundos | los mismos 21 valores y los mismos dos contadores. 62 key frames recibidos, ninguno rechazado |
| Un segundo decodificador | el decodificador UADP de nuestro propio código receptor, ejecutado sobre 222 datagramas capturados con el diseño de los 17 campos | los 111 mensajes decodificados, todos los valores comprobados correctos | los 111 mensajes decodificados, todos los valores comprobados correctos, los arrays con su longitud Int32 y su relleno |

## Arrays y cadenas RawData

Esta biblioteca escribe un recuento de elementos Int32 antes de cada array RawData, y una cadena como una longitud Int32, sus bytes y después relleno de ceros hasta MaxStringLength. Eso es lo que hace la pila de referencia de la OPC Foundation, y sigue el texto de la especificación: OPC 10000-14 7.2.4.5.11 ("handled like a Structure DataType", relleno "to the maximum size indicated by ArrayDimensions or MaxStringLength") con OPC 10000-6 5.2.5 ("One dimensional Arrays are encoded as a sequence of elements preceded by the number of elements encoded as an Int32 value").

El suscriptor de HotLoop core y el segundo decodificador leen los arrays RawData de este modo, con la longitud y el relleno, y ambos decodifican el RawData de esta biblioteca.

Una diferencia con la pila de referencia: donde esta lanza una excepción cuando una cadena es más larga que MaxStringLength, esta biblioteca la corta en un límite de carácter, porque una tarea de PLC no tiene a dónde lanzar.

## Qué debe saber

* La ejecución fue en CODESYS Control for Linux SL 4.22.0.0 sobre x86-64. La biblioteca es Structured Text, y el tratamiento del orden de bytes para un destino big endian está escrito, pero usted lo comprueba en su propio controlador.
* Multicast: el bloque fija el TTL, el loopback y la interfaz de envío para un grupo multicast. Compruebe el grupo en su propia red.
* El bloque cuenta los fallos de envío y espera cuando la red desaparece o una dirección no existe, y el programa sigue escaneando.
* En modo demo el runtime se detiene al final de su ventana de dos horas, tal como dice CODESYS.
