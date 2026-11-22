---
title: "Resumen de HotLoop IoT"
description: "HotLoop IoT es la base de automatización: entidades, automatizaciones, paneles, alarmas, MQTT y todos los drivers de protocolo, en Go, con SQLite o PostgreSQL."
sidebar:
  label: "Resumen"
---

:::note[IoT ya está disponible, desde la versión 4.18.10]
La imagen es `ghcr.io/hotloop-io/hotloop-iot:{{hotloop}}`, compilada para amd64, arm64 y arm/v7, de unos 31 MB en amd64 y 29 MB en una Pi, y el chart es `hotloop-iot` de `https://hotloop.io/hotloop`. Ambos se descargan sin iniciar sesión. Las unidades Quadlet están en el directorio `iot/` de [Podman Quadlet](/es/install/quadlet/). [Instálelo](/es/iot/install/). Las páginas de esta sección dicen contra qué se ha probado cada función, y donde una página sigue a `main` y no a la versión, también lo dice.
:::

IoT es la base sobre la que se construyen Edge y el Gateway. Si la caja que tiene delante es una Pi, un NUC en un armario, un conjunto de enchufes y sensores inteligentes o un PLC en un banco, este es el producto. Es la imagen más pequeña de los tres productos completos, y aun así lleva todo lo que hace útil a HotLoop: las entidades, las reglas, las alarmas y la única puerta de escritura que nada esquiva.

Un producto mayor nunca le quita nada. [Edge](/es/edge/overview/) es IoT más la capa de máquina. El [Gateway](/es/gateway/overview/) es Edge más la capa de sitio. Todo lo de estas páginas está en ambos.

## Lo que tiene IoT

- **Entidades y el árbol de equipos.** Cada tag recibe una entidad con un id que nunca cambia, colgada de un único árbol ISA-95. [Entidades](/es/iot/entities/), [el árbol de equipos](/es/iot/equipment/).
- **Automatizaciones, plantillas, scripts y recetas.** Reglas compiladas al guardar, secuencias con nombre y conjuntos de consignas que pasan por la puerta de escritura. [Automatizaciones](/es/iot/automations/), [plantillas](/es/iot/blueprints/), [scripts](/es/iot/scripts/), [recetas](/es/iot/recipes/).
- **Ayudantes, el registro y el sol.** Los valores que son de su gente, una sola cronología de todo lo ocurrido y la salida del sol calculada en la propia caja. [Ayudantes](/es/iot/helpers/), [registro](/es/iot/logbook/), [el sol](/es/iot/sun/).
- **Paneles, notificaciones y MCP.** Pantallas construidas por rol, alarmas que avisan a un teléfono y un agente que puede leer la planta y tocar solo lo que usted armó. [Paneles](/es/iot/dashboards/), [notificaciones](/es/iot/notifications/), [MCP](/es/iot/mcp/).
- **Todos los drivers de protocolo (incluidos un runtime CODESYS por nombre de símbolo y OPC UA PubSub sobre UADP), MQTT con descubrimiento y un broker integrado.** [Protocolos](/es/iot/protocols/), [el broker](/es/iot/broker/), [descubrimiento MQTT](/es/iot/mqtt-discovery/), [descubrimiento de red](/es/iot/network-discovery/).
- **UniFi, de solo lectura hasta que arme un comando,** y **el historial escrito en su propia base de datos o en un broker Kafka.** UniFi lee la red, y los pocos puntos que son comandos (un LED de localización, un reinicio, un ciclo de alimentación PoE, activar o desactivar una red inalámbrica, bloquear un cliente) no hacen nada hasta que alguien marca ese tag como escribible. [UniFi](/es/iot/unifi/), [destinos del historian](/es/iot/historian-targets/).
- **Meteorología, energía, pantallas que viajan y trece idiomas más.** Una estación en el tejado es una entidad. Un contador es un tag leído como energía consumida, guardada en intervalos de 15 minutos con tarifa y cargo por demanda. Un panel se exporta a un archivo y se importa en otra instalación, y una visualización de CODESYS se importa como pantalla. La interfaz web habla inglés y trece idiomas más. [Energía](/es/iot/energy/), [meteorología](/es/iot/weather/), [archivos de pantalla](/es/iot/screen-file/), [pantallas de CODESYS](/es/iot/codesys-screen-import/), [idiomas](/es/iot/languages/).
- **Usuarios, copias de seguridad y migraciones que solo añaden.** [Autenticación](/es/iot/authentication/), [copias de seguridad](/es/iot/backup/), [migraciones](/es/iot/migrations/) y [la API HTTP](/es/iot/api/).

[La puerta de escritura](/es/gateway/write-gate/) es la página que hay que leer antes de que una planta real vea nada de esto. Se aplica a todos los productos.

## Lo que no tiene

Ni servidor OPC UA, ni publicación Sparkplug con almacenamiento y reenvío, ni flota, ni varios sitios, ni informes programados. En IoT no están desactivados, no están en el binario, así que ninguna variable de entorno y ningún mal día puede activarlos. La API conserva todas las rutas de todos modos, y una ruta de algo que IoT no tiene responde `404` y nombra el producto que sí lo tiene.

## Bases de datos

SQLite o PostgreSQL. El chart y las unidades Quadlet ejecutan PostgreSQL 17 por defecto, con 30 días de historial, y `HOTLOOP_DB_TYPE=sqlite` deja todo en un archivo sin contenedor de base de datos. En el chart es `database.type`, y pedir `timescaledb` al chart de IoT hace fallar la instalación. Pasar a otra base de datos es una copia de seguridad y una restauración. [La gama](/es/products/) tiene la tabla y [Copias de seguridad](/es/iot/backup/) tiene la restauración.

## Instalarlo

Helm o Podman Quadlet, las mismas dos vías que el resto de la gama, y [la página de instalación de IoT](/es/iot/install/) tiene los comandos de ambas. Las cajas siguen `:stable` y se actualizan solas, y [esa página](/es/install/auto-update/) explica qué pasa cuando una actualización no puede arrancar.

¿Lo va a usar en una planta? [Usar HotLoop en una empresa](/es/business/) explica la licencia y cómo contactarnos.
