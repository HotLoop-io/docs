---
title: "Notas de versión: HotLoop Transmitter 1.3.0"
description: "Marcas de tiempo al milisegundo, campos WSTRING, estado por campo, varios DataSets en un NetworkMessage y tramas delta con KeepAlive, desactivadas por defecto."
---

HotLoop Transmitter pone los valores de tu PLC en la red como OPC UA PubSub, desde una biblioteca que incorporas al proyecto CODESYS. 1.3.0 añade marcas de tiempo al milisegundo, campos WSTRING, un estado por campo para que un valor malo salga como malo, varios DataSets en un NetworkMessage, y Data Delta Frames con mensajes KeepAlive. Es la biblioteca 1.3.0.0, y HotLoop Alarms 1.0.0.0 viene con ella sin cambios.

Qué significa para ti: un proyecto de PLC que ya usa 1.2.0 envía los mismos bytes que antes, con una diferencia visible, la marca de tiempo ahora tiene milisegundos. Todo lo demás se activa con una llamada o una entrada.

## Novedades

* **Marcas de tiempo al milisegundo.** Tanto el NetworkMessage como el DataSetMessage llevan los milisegundos del reloj, de modo que un suscriptor ve cuándo se construyó cada mensaje y no el segundo en que cayó. `bStampHighRes` indica qué reloj usó el último mensaje.
* **Campos WSTRING.** `AddWString(ADR(wName), N)` publica un `WSTRING(N)` como un String de OPC UA, en Variant y en RawData. El texto sale como UTF-8: un carácter por encima de U+FFFF, que en el PLC es un par sustituto, sale como un carácter de cuatro bytes, y un sustituto suelto sale como U+FFFD, así que lo que lee un suscriptor es siempre texto válido. En RawData el MaxStringLength del campo es `3 * N` bytes.
* **Un estado por campo.** Tras añadir un campo, `SetStatus(ADR(udiStatus))` lo ata a un UDINT que contiene un OPC UA StatusCode. Mientras esa variable no sea 0, el campo sale como el StatusCode en lugar de su valor, y un suscriptor lo lee como calidad mala. Vuelve a ponerla a 0 y el valor sale otra vez. Un publicador RawData sigue enviando el valor, porque RawData no tiene forma de llevar un estado.
* **Varios DataSets en un NetworkMessage.** `AddDataSet(uiWriterId, udiConfigMajor)` inicia otro DataSet en el mismo bloque: los campos que añades después pertenecen a él. En cada intervalo de publicación un NetworkMessage lleva un DataSetMessage por DataSet, con el array Sizes que pide la Parte 14, de modo que más de un writer comparte un datagrama. Hasta 8 DataSets. Si nunca la llamas, el mensaje es el que enviaba 1.2.0.
* **Data Delta Frames y KeepAlive.** Un conjunto de datos estable ya no tiene que enviar cada campo en cada intervalo. Con las tramas delta activadas, un publicador envía primero una trama clave completa y luego cada `uiKeyFrameEvery` mensajes, un Data Delta Frame solo con los campos que cambiaron entre medias, y un KeepAlive cuando nada cambió. `bDeltaActive`, `udiDeltaSent` y `udiKeepAliveSent` muestran lo que está haciendo.

## Qué cambió para un proyecto que usa 1.2.0

* Tu lista de campos y tu formato de cable no cambiaron. La única diferencia en el cable es la parte de milisegundos de la marca de tiempo.
* HotLoop Alarms 1.0.0.0 está en la versión, sin cambios.

## Ajustes y valores por defecto

* `bHighResTimestamp` es `TRUE`: marca con los milisegundos del reloj. Ponlo a `FALSE` para marcar segundos completos, exactamente como hacía 1.2.0. Si el runtime no puede dar milisegundos, el bloque marca segundos completos por su cuenta.
* `bDeltaFrames` es `FALSE`. Las tramas delta son un ajuste que activas en un publicador, no algo que el bloque haga por su cuenta, así que todos los suscriptores que tienes siguen leyendo tramas clave completas. Para activarlo en un writer, pon `bDeltaFrames := TRUE` en ese publicador y, si quieres otro espaciado de tramas clave, `uiKeyFrameEvery` (10 si no lo cambias). Cada publicador decide por sí mismo, así que un writer puede enviar deltas mientras los demás no. Un suscriptor que descarta las tramas delta muestra un cambio en la siguiente trama clave, así que actívalo para suscriptores que las lean. Se aplica a publicadores Variant con un DataSet; un publicador RawData, o un bloque con más de un DataSet, envía tramas clave.
* `AddDataSet`, `AddWString` y `SetStatus` son llamadas que haces una vez al inicio, como las demás llamadas `Add`. Sin ellas no cambia nada.

## Actualización

Instala `HotLoopTransmitter-1.3.0.library` (o abre el `.package` con el CODESYS Installer), cambia la versión de la biblioteca en el Library Manager de tu proyecto a 1.3.0.0 y compila. Nada de tu código tiene que cambiar. Añade las llamadas nuevas cuando quieras lo que hacen.

## Volver atrás

Un proyecto fijado a 1.2.0 sigue funcionando y envía los mismos bytes que enviaba, con marcas de tiempo de segundos completos. HotLoop Alarms es una biblioteca aparte y no se ve afectada.

## No incluido en esta versión

Seguridad de mensajes, NetworkMessages fragmentados, el lado suscriptor y el transporte MQTT.

## Archivos

```
e68cfc88e599ddcf278eb208ff500f4f78d3faf74edf12e38f308a009f478594  HotLoopAlarms-1.0.0.0.compiled-library
68f704fc5662bbc67ec097016a741065d705af01913a2746296c17f9e6991118  HotLoopAlarms-1.0.0.0.library
5be90a88e9e0aae1de421628fb6ca8e810dda96b4562566df345d451ecd859cf  HotLoopTransmitter-1.3.0.compiled-library
0410b98578fd55775a97b27023a0b5f30111cac0587120894354d9edca1248fc  HotLoopTransmitter-1.3.0.library
3e791358e6dc628a2d2aae760e0c49c89f1c4490f0637b65864c335fcbb3e9a0  HotLoopTransmitter-1.3.0.package
```
