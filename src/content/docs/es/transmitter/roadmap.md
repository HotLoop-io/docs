---
title: "Hoja de ruta de Transmitter"
description: "Lo que HotLoop Transmitter ya tiene construido, lo que viene después y lo que deliberadamente no está previsto."
---

Qué hay hoy en la caja, qué viene después y qué deliberadamente no está previsto. Una línea pasa a "Publicado" solo cuando se ha ejecutado en el runtime real 4.22.0.0 y un receptor la ha leído.

## Publicado en 1.1.0

* Marcas de tiempo de DataSetMessage y NetworkMessage tomadas del reloj de tiempo real del PLC, activadas por defecto; `bTimestamp` las desactiva.
* La biblioteca como `.package` de CODESYS, que se instala con el CODESYS Installer.

## Publicado en 1.0.0

* Un bloque publicador, `FB_HLTX_Publisher`: un NetworkMessage por intervalo de publicación, un DataSetMessage, un Data Key Frame, UADP sobre UDP, desde Structured Text sobre SysSocket.
* Codificaciones de campo Variant y RawData.
* Campos BOOL, SINT, USINT, INT, UINT, DINT, UDINT, LINT, ULINT, REAL, LREAL, STRING y TIME, y arrays de todos ellos salvo STRING, en ambas codificaciones.
* Destinos unicast y multicast, publisher id, writer group id, dataset writer id, intervalo de publicación, versión de grupo y versión de configuración, todos como entradas del bloque.
* Un envío no bloqueante, un coste acotado por llamada, contadores de enviados, rechazados y omitidos, y un estado de error que nunca provoca un fallo de la aplicación.

## Siguiente

* Marcas de tiempo por debajo del segundo. La marca de 1.1.0 son los segundos completos del reloj de tiempo real.
* Varios DataSetMessages en un NetworkMessage (el array Sizes), de modo que un datagrama pueda llevar más de un writer.
* Data Delta Frames y mensajes KeepAlive, para reducir los bytes de un conjunto de datos casi estable.
* Campos WSTRING.
* Un estado por campo, para poder enviar un valor Bad como Bad.

## No previsto

* Seguridad de mensajes (firma y cifrado). El bloque envía en claro, en una red en la que la planta ya confía.
* NetworkMessages fragmentados. Un mensaje que no cabe en una trama de 1500 bytes se rechaza, no se divide.
* El lado suscriptor. HotLoop core se suscribe a UADP; esta biblioteca publica.
* Transporte MQTT. UDP es lo que un runtime CODESYS alcanza sin más bibliotecas.
