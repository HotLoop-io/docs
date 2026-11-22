---
title: "HotLoop for CODESYS: resumen"
description: "HotLoop junto a un runtime de CODESYS: pantallas y alarmas para un PLC CODESYS, leídas por el servidor OPC UA del propio runtime, sin instalar nada en CODESYS."
sidebar:
  label: "Resumen"
editUrl: false
---

HotLoop for CODESYS es HotLoop funcionando en el mismo nodo que un runtime de CODESYS. Lee las variables del PLC por el servidor OPC UA del propio runtime, las pone en pantallas que funcionan en un panel PC, un teléfono o una pared, genera alarmas sobre ellas y guarda el histórico. No se instala nada en CODESYS y nada escribe en el PLC. Es la pantalla que de otro modo construiría en CODESYS WebVisu, dibujada fuera del runtime. Lo que le aporta: los operadores tienen una pantalla sin descargar nada al PLC, y el PLC gana un segundo par de ojos que no depende de nada más del nodo.

Es uno de los ocho productos de HotLoop y tiene su propia línea de versiones. El chart más reciente es el 0.3.8, publicado el 2026-11-16. Debajo está HotLoop Edge, así que todo lo de las [páginas de Edge](/es/edge/overview/) también es cierto aquí.

![La pantalla Line 2: cuatro tarjetas de valor, un indicador, una tendencia de quince minutos y una lista de alarmas](/codesys/screen.png)
![Lo mismo, en oscuro](/codesys/screen-dark.png)

Es una ejecución real: la interfaz predeterminada de HotLoop leyendo un runtime CODESYS Control for Linux SL 4.22.0.0. El programa del PLC es el programa de demostración de HotLoop, así que los números son los de la demo. Las etiquetas (Line 2, Mixer temperature, Riverside Bottling) son inventadas y las pone el [perfil](/es/codesys/profile/).

## Las tres partes

| Parte | Qué es | Dónde está |
|---|---|---|
| El chart, `hotloop-codesys` | Un envoltorio de `hotloop-edge` con valores predeterminados para un runtime en un nodo: SQLite, una réplica, y desactivado lo que no hace falta junto a un PLC. Todas las correcciones de los charts de HotLoop le llegan. | `https://hotloop.io/hotloop-codesys/` |
| El provisioner | Un único binario estático en Go que aplica un perfil a HotLoop y lo mantiene correcto. No guarda ningún perfil. | `ghcr.io/hotloop-io/hotloop-provision` |
| Un perfil | Un archivo JSON: el dispositivo, las variables que conservar, las alarmas y una pantalla. La única entrada que usted da. | Un Secret en el espacio de nombres de la instalación, [descrito aquí](/es/codesys/profile/) |

## Cómo lee el PLC

CODESYS documenta una sola forma de que un tercero lea las variables de un controlador, y es el servidor OPC UA del propio runtime. El PLC publica lo que usted quiere ver con una Symbol Configuration en el IDE, y HotLoop lee esas variables por los nombres que les dio el programador, como `Application.GVL_Line.rTemp`, no por un node id. La Symbol Configuration es el único cambio en el proyecto del PLC. El protocolo de canal del CODESYS Gateway no está documentado para terceros, y esto no lo habla.

La lectura la hace el conector CODESYS de HotLoop core, que es el driver OPC UA más lo que un PLC CODESYS necesita encima: descubrimiento de lo que exporta la aplicación, los tipos que tiene, arrays y estructuras recorridos hasta un punto por campo, una reconexión sin intervención tras un reinicio o una descarga, y cada petición ajustada a los límites que publica el runtime. La [página de protocolos](/es/iot/protocols/) incluye la referencia del conector desde HotLoop 4.19.4, e indica contra qué se verificó y contra qué no.

## Qué hace por sí solo

Cuando HotLoop y el propio runtime del nodo responden, el provisioner configura el dispositivo del perfil, sus variables, sus alarmas y su pantalla. Después vuelve a mirar cada cinco minutos. Una variable del perfil que el PLC haya incorporado desde entonces se añade. Una que el PLC ya no tiene se lee como mala con el motivo del servidor. La pantalla y las alarmas se crean cuando faltan y solo se reemplazan cuando el `revision` del perfil es mayor que el del que las creó, de modo que un cambio hecho por una persona sobrevive hasta que se entrega a propósito un perfil más nuevo.

## Qué no hará

- **No escribirá en su PLC.** Todos los tags que configura el provisioner son de solo lectura, y el perfil no marca ninguno como escribible. Una persona puede habilitar un tag más tarde, y entonces la [puerta de escritura](/es/gateway/write-gate/) y los propios derechos de símbolo del PLC tienen voz.
- **No pondrá nada en el runtime.** Ninguna biblioteca, ninguna tarea, ningún agente.
- **No necesitará un pod de base de datos.** SQLite en el almacenamiento propio del nodo, una réplica.
- **Está hecho para conservar sus pantallas ante un enlace perdido.** Ambos pods toleran un nodo inalcanzable o no listo sin límite de tiempo, y las tolerancias están en el chart. [Estado](/es/codesys/where-it-stands/) dice qué se ha ejecutado en un nodo real.

## Adónde ir ahora

[Instálelo](/es/codesys/install/), lea qué contiene un [perfil](/es/codesys/profile/), o vea [el estado](/es/codesys/where-it-stands/) y la [hoja de ruta](/es/codesys/roadmap/). ¿Lo va a usar en una planta? [Usar HotLoop en una empresa](/es/business/) explica las licencias y cómo contactarnos.
