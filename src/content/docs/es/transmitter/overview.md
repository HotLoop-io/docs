---
title: "HotLoop Transmitter: resumen"
description: "Una biblioteca de CODESYS en Structured Text sobre SysSocket UDP que publica valores del PLC como OPC UA PubSub (UADP), sin otra biblioteca ni configurador."
---

HotLoop Transmitter pone los valores de un PLC en la red como OPC UA PubSub, tal como lo indica la Parte 14 de la especificación OPC UA, desde una biblioteca que se añade al proyecto de CODESYS. Es un transmisor en el sentido del lazo de instrumentación: la pieza que pone el valor del proceso en el cable para que otro equipo lo lea.

Está escrita en Structured Text sobre `SysSocket` UDP, y no necesita otra biblioteca, ni licencia adicional, ni configurador. Se añade la biblioteca, se llama a un bloque de función una vez por ciclo, y un UADP NetworkMessage sale en cada intervalo de publicación hacia una dirección unicast o un grupo multicast.

Lo que significa para usted: un PLC sin biblioteca PubSub puede alimentar cualquier cosa que se suscriba a OPC UA PubSub, incluido el propio HotLoop, con unas pocas líneas de Structured Text. Cada mensaje lleva una marca de tiempo del reloj del PLC, salvo que la desactive con `bTimestamp`.

## Por qué es Structured Text y no Go

Toda herramienta nueva de HotLoop se escribe en Go salvo que haya una razón real. Esta es la razón real: tiene que ejecutarse dentro del propio ciclo de escaneo del PLC, en el runtime IEC 61131-3, como una biblioteca que el programador referencia desde su proyecto. Un runtime de CODESYS ejecuta Structured Text, no Go. Las pruebas y herramientas que rodean la biblioteca (la herramienta de captura, el verificador) sí son Go.

## Cómo usarla

1. Instale `HotLoopTransmitter-1.3.0.library` en el repositorio de bibliotecas de CODESYS (Tools, Library Repository, Install), o instale `HotLoopTransmitter-1.3.0.package` con el CODESYS Installer, y añádala al Library Manager del proyecto. La [página de instalación](/es/transmitter/install/) tiene las descargas y los detalles.
2. Declare un publicador, añada una vez al arrancar las variables que quiere publicar, y llámelo en cada ciclo:

```iecst
PROGRAM PLC_PRG
VAR
    pub : HLTX.FB_HLTX_Publisher;
    bInit : BOOL;
END_VAR

IF NOT bInit THEN
    bInit := TRUE;
    pub.sDestination := '239.0.0.22';        // a unicast host or a multicast group
    pub.uiPort := 4840;
    pub.uiPublisherId := 1;
    pub.uiWriterGroupId := 1;
    pub.uiDataSetWriterId := 1;
    pub.tPublishingInterval := T#100MS;
    pub.AddReal(ADR(GVL.rTemperature));
    pub.AddBool(ADR(GVL.bRunning));
    pub.AddArray(ADR(GVL.aValues), HLTX.E_HLTX_Type.REAL_T, 250);
END_IF
pub.bEnable := TRUE;
pub();
```

La [página de la API](/es/transmitter/api/) enumera cada entrada, salida y método. La [página del formato en el cable](/es/transmitter/wire-format/) es el paquete, byte a byte, con las secciones de la especificación que definen cada byte.

## Lo que hará y lo que no hará con su ciclo

* Nunca bloquea. El socket no es bloqueante y el mensaje se construye en un búfer fijo.
* El coste de una llamada es el de construir un mensaje, y solo se paga en los ciclos en que sale un mensaje. Medido en una tarea de 20 ms con dos publicadores y marcas de tiempo activadas: unos 9,6 us añadidos por ciclo de media, de 10 a 100 us en los ciclos que envían, y el ciclo más largo de la prueba fue de 81 us. Un host ocupado ha alargado un solo envío hasta milisegundos. Las cifras medidas y sus límites están en la [página de tiempos](/es/transmitter/timing/).
* Un error de socket, una dirección incorrecta o una lista de campos demasiado grande nunca provoca un fallo de la aplicación. El bloque informa de un `eState` y un `eError`, cuenta el fallo, y el programa sigue escaneando.
* No fragmenta. Un mensaje ocupa como máximo 1472 bytes. Una lista de campos que no cabe deja el bloque en `ConfigError` y no envía nada.

## Probada con

El runtime CODESYS Control for Linux SL 4.22.0.0, y en hardware sin sistema operativo (2026-11-17). Consulte la [página de tiempos](/es/transmitter/timing/) y la [página de pruebas](/es/transmitter/proof/) para ver qué se ejecutó y qué se leyó de vuelta.

¿Lo va a usar en una planta? [Usar HotLoop en una empresa](/es/business/) explica las licencias y cómo contactarnos.

## Licencia

El HotLoop Source License Agreement 1.0, igual que todos los productos de HotLoop. Es de uso gratuito y de código disponible, no es código abierto según la OSI, y su sección 5 le permite integrar la biblioteca en sus propios proyectos de PLC y entregar o vender el resultado compilado, nunca la biblioteca en sí. La [página de licencia](https://hotloop.io/license/) tiene el texto.
