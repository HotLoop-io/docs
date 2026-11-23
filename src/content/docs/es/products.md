---
title: "Productos HotLoop: ocho en cinco líneas"
description: "Ocho productos en cinco líneas de versiones: qué incluye cada producto base, qué base de datos usa, cómo instalarlos y cómo pasar un sitio a uno mayor."
---

HotLoop son ocho productos para la planta: cuatro que crecen con el sitio (IoT, Edge, Gateway y Edge Relay), además de Flow para conectar, Cascade para los flujos de trabajo, HotLoop for CODESYS para la pantalla propia del PLC y Transmitter para poner en la red los valores de un PLC.

Se publican en cinco líneas de versiones. **HotLoop core** son IoT, Edge, Gateway y Edge Relay: cuatro productos, un código, una etiqueta. Cada versión del core publica los cuatro a la vez, con el mismo número de versión, cada uno con su imagen, su chart de Helm y sus unidades de Podman Quadlet. Elija el que encaja con el equipo. Todos hablan todos los protocolos que tiene HotLoop, así que nunca hay que subir de producto solo para leer el PLC que tiene en el banco. Lo que los separa son las funciones. Los protocolos no.

**Flow**, **Cascade**, **HotLoop for CODESYS** y **Transmitter** son líneas propias con versiones propias, así que una versión de Flow nunca mueve el core, y al revés. Todo lo que hay debajo de la tabla trata del core. Aquí empieza cada uno de los ocho:

| Producto | Línea de versiones | Documentación | Instalación | Notas de versión | Hoja de ruta |
|---|---|---|---|---|---|
| **HotLoop IoT** | HotLoop core | <a href="/es/iot/overview/">Documentación</a> | <a href="/es/iot/install/">Instalación</a> | <a href="/es/releases/#hotloop-core">Notas</a> | <a href="/es/roadmap/">Hoja de ruta</a> |
| **HotLoop Edge** | HotLoop core | <a href="/es/edge/overview/">Documentación</a> | <a href="/es/edge/install/">Instalación</a> | <a href="/es/releases/#hotloop-core">Notas</a> | <a href="/es/roadmap/">Hoja de ruta</a> |
| **HotLoop Gateway** | HotLoop core | <a href="/es/gateway/overview/">Documentación</a> | <a href="/es/gateway/install/">Instalación</a> | <a href="/es/releases/#hotloop-core">Notas</a> | <a href="/es/roadmap/">Hoja de ruta</a> |
| **HotLoop Edge Relay** | HotLoop core | <a href="/es/edge-relay/overview/">Documentación</a> | <a href="/es/edge-relay/install/">Instalación</a> | <a href="/es/releases/#hotloop-core">Notas</a> | <a href="/es/roadmap/">Hoja de ruta</a> |
| **HotLoop Flow** | Flow | <a href="/es/flow/overview/">Documentación</a> | <a href="/es/flow/install/">Instalación</a> | <a href="/es/releases/#hotloop-flow">Notas</a> | <a href="/es/flow/roadmap/">Hoja de ruta</a> |
| **HotLoop Cascade** | Cascade | <a href="/es/cascade/overview/">Documentación</a> | <a href="/es/cascade/running/">Instalación</a> | <a href="/es/releases/#hotloop-cascade">Notas</a> | <a href="/es/cascade/roadmap/">Hoja de ruta</a> |
| **HotLoop for CODESYS** | HotLoop for CODESYS | <a href="/es/codesys/overview/">Documentación</a> | <a href="/es/codesys/install/">Instalación</a> | <a href="/es/releases/codesys-0-3-10/">Notas</a> | <a href="/es/codesys/roadmap/">Hoja de ruta</a> |
| **HotLoop Transmitter** | Transmitter | <a href="/es/transmitter/overview/">Documentación</a> | <a href="/es/transmitter/install/">Instalación</a> | <a href="/es/releases/transmitter-1-2-0/">Notas</a> | <a href="/es/transmitter/roadmap/">Hoja de ruta</a> |

La tabla siguiente compara los cuatro productos del core.

| <span class="sr-only">Detalles</span> | HotLoop IoT | HotLoop Edge | HotLoop Gateway | HotLoop Edge Relay |
|---|---|---|---|---|
| Para qué sirve | La base de automatización. Una Pi, un NUC, una caja en un armario | Una caja junto a la máquina, que sigue funcionando aunque el enlace superior se caiga | El cerebro del sitio | Consultar, reenviar, sobrevivir. Sin base de datos y sin interfaz |
| Entidades, automatizaciones, ayudantes, scripts, recetas, plantillas, paneles, registro, notificaciones, MCP, MQTT con descubrimiento, alarmas ISA-18.2, copias de seguridad y todos los drivers | sí | sí | sí | solo drivers |
| Servidor OPC UA, publicación Sparkplug en el borde con almacenamiento y reenvío | | sí | sí | solo publicación |
| Flota, varios sitios, informes programados | | | sí | |
| Imagen | `ghcr.io/hotloop-io/hotloop-iot` | `ghcr.io/hotloop-io/hotloop-edge` | `ghcr.io/hotloop-io/hotloop` | `ghcr.io/hotloop-io/hotloop-edge-relay` |
| Chart | `hotloop-iot` | `hotloop-edge` | `hotloop` | `hotloop-edge-relay` |
| Unidades Quadlet | `deploy/quadlet/iot/` | `deploy/quadlet/edge/` | `deploy/quadlet/gateway/` | `deploy/quadlet/edge-relay.container` |
| Unidades Quadlet con SQLite | `deploy/quadlet/iot/sqlite/` | `deploy/quadlet/edge/sqlite/` | `deploy/quadlet/gateway/sqlite/` | ninguna |
| `database.type` en el chart | `postgresql` (predeterminado), `sqlite` | `timescaledb` (predeterminado), `postgresql`, `sqlite` | `timescaledb` (predeterminado), `postgresql`, `sqlite` | ninguno |
| Arquitecturas | amd64, arm64, arm/v7 | amd64, arm64, arm/v7 | amd64, arm64 | amd64, arm64, arm/v7 |
| Base de datos que ejecutan el chart y Quadlet | PostgreSQL 17 | TimescaleDB | TimescaleDB | ninguna |
| Historial que se conserva de forma predeterminada | 30 días | 90 días | 90 días | ninguno |
| Bases de datos sobre las que corre el binario | SQLite o Postgres | SQLite, Postgres o TimescaleDB | SQLite, Postgres o TimescaleDB | ninguna |

La base de datos es un ajuste, no una imagen: `HOTLOOP_DB_TYPE=sqlite` y `HOTLOOP_DB_PATH` ponen cualquiera de los tres sobre un archivo SQLite, sin ningún contenedor de base de datos (DEPLOYMENT.md, "SQLite"). Los charts aceptan la misma elección como `database.type` y las unidades Quadlet como los directorios `sqlite/`, y cada producto ofrece solo las bases de datos de la tabla anterior: pedirle `timescaledb` al chart de IoT hace fallar la instalación. Pasar de una base de datos a otra es una copia de seguridad y una restauración (BACKUP.md).

El Gateway conservó los nombres con los que salió hasta la 4.17.0: imagen `ghcr.io/hotloop-io/hotloop`, chart `hotloop`. Quien ya lo usa no tiene que cambiar nada.

## Lo que hay en un producto es lo que hay en el binario

Un producto es una compilación, no un ajuste. `-tags hotloop_iot` compila IoT, `-tags hotloop_edge` compila Edge, y sin etiqueta se compila el Gateway. Lo que un producto no tiene no está desactivado, no está: el servidor OPC UA no está en la imagen de IoT, así que ninguna variable de entorno, ningún archivo de valores y ningún mal día pueden encenderlo.

Por eso un producto menor responde por lo que no tiene en lugar de fingir:

- **La API** conserva todas las rutas en todos los productos. Una ruta de una función que este producto no tiene responde `404` y nombra el producto que sí la tiene: `{"error":"scheduled reports are part of HotLoop Gateway; this is HotLoop IoT","product":"iot","feature":"reports"}`. `GET /api/status` indica `product` y `features`, así que un script pregunta en lugar de probar a ciegas.
- **Un ajuste exclusivo del Gateway** en IoT o Edge (`HOTLOOP_REPORTS_ENABLED=true` arrastrado en un archivo de valores antiguo, por ejemplo) avisa al arrancar y en la pantalla de Ajustes, y HotLoop sigue funcionando. HotLoop mantiene la planta en marcha pese a un informe que no puede producir, y el aviso hace que alguien lo vea.
- **Los charts** ni siquiera tienen ese ajuste. `charts/hotloop-iot` no tiene bloques `reports`, `opcuaServer` ni `edgePublish`, y `hotloop-edge` no tiene `reports`. Si lo define de todos modos, no genera nada.
- **`hotloop --product`** imprime `iot`, `edge` o `gateway`. `--version` sigue imprimiendo solo la versión, porque los scripts la analizan.

## Cuál elegir

- **Una Pi, enchufes inteligentes, unos pocos sensores, un broker MQTT lleno de Tasmota y Zigbee2MQTT, o un PLC en un banco:** IoT. Es la imagen más pequeña (unos 29 MB en arm) y la imagen de PostgreSQL normal es una sexta parte de la de TimescaleDB, que en una tarjeta SD es la cifra que importa.
- **Una caja atornillada junto a una línea, que alimenta un SCADA por OPC UA o publica hacia arriba por Sparkplug y aguanta que el enlace se caiga:** Edge.
- **El sitio: todas las líneas, informes enviados por correo con programación, relés de borde que reportan, más de un sitio en una pantalla:** Gateway.
- **Una caja que solo debe consultar y reenviar, sin base de datos que vigilar:** Edge Relay. Vea la [referencia de Edge Relay](/es/edge-relay/reference/).

## Tamaños

La imagen es el binario más unos 3 MB de base.

| <span class="sr-only">Detalles</span> | imagen / binario en amd64 | imagen / binario en arm64 | imagen / binario en arm/v7 |
|---|---|---|---|
| IoT | 31.2 / 28.0 MB | 29.1 / 26.0 MB | 29.2 / 26.0 MB |
| Edge | 36.5 / 33.3 MB | 34.2 / 31.0 MB | 34.3 / 31.1 MB |
| Gateway | 37.1 / 33.9 MB | 34.8 / 31.6 MB | no compilado |
| Edge Relay | 15.7 / 12.5 MB | 14.9 / 11.7 MB | 15.1 / 11.9 MB |

Estas son las cifras en disco. Sin dispositivos, HotLoop ronda los 10 MB de RSS y PostgreSQL unos 12 MB, y ese es el suelo, no la cifra real: lo que usa un producto con dispositivos consultándose depende de los dispositivos.

## Instalación

### Helm

Un repositorio, los cuatro charts:

```sh
helm repo add hotloop https://hotloop.io/hotloop/

helm install hotloop hotloop/hotloop-iot  --namespace hotloop --create-namespace
helm install hotloop hotloop/hotloop-edge --namespace hotloop --create-namespace
helm install hotloop hotloop/hotloop      --namespace hotloop --create-namespace
```

Llame `hotloop` a la versión desplegada, sea cual sea el producto. El nombre de la versión es el que llevan el volumen de la base de datos, los Secrets y el Service, y conservarlo es lo que permite que un sitio pase después a un producto mayor (más abajo).

En EmberNet, cada uno es su propia tarjeta en el App Store: "HotLoop IoT", "HotLoop Edge", "HotLoop Gateway" y "HotLoop Edge Relay". Un despliegue desde la tienda incorpora las etiquetas de inquilino del panel en todo lo que genera el chart, y Running Apps los muestra como `HotLoop-IoT`, `HotLoop-Edge`, `HotLoop-Gateway` y `HotLoop-Edge-Relay`.

### Podman Quadlet

Para una caja que no está en un clúster. Cada directorio de producto bajo `deploy/quadlet/` tiene cinco unidades: `hotloop.network`, `hotloop.container` (la aplicación), `hotloop-db.container` (su base de datos, la misma imagen y versión que ejecuta su chart), `hotloop-db.volume` y `hotloop-data.volume`. Los pasos de instalación están en la cabecera de cada `hotloop.container`, y [Podman Quadlet](/es/install/quadlet/) tiene el resto.

Necesitan Podman 5.0 o superior. Raspberry Pi OS Bookworm incluye la 4.3, que no tiene Quadlet en absoluto, así que una Pi necesita Raspberry Pi OS Trixie o posterior. La aplicación sigue `:stable` y la actualización automática de Podman la mueve, con la base de datos fija: [el README de Quadlet](/es/install/auto-update/) explica cómo y por qué. Se instale como se instale, ponga la base de datos en un SSD USB y no en la tarjeta SD. El historial escribe todo el día, todos los días, y las tarjetas SD mueren precisamente de eso.

## Pasar un sitio a un producto mayor

De IoT a Edge y al Gateway se conservan todos los dispositivos, tags, entidades, automatizaciones, alarmas, usuarios y horas de historial. Todos los productos ejecutan todas las migraciones, así que la base de datos tiene la misma forma en los tres, y el producto mayor arranca con sus funciones adicionales vacías.

- **Quadlet:** los nombres de las unidades, los volúmenes y los secretos son los mismos en todos los directorios de producto. Copie `hotloop.container` y `hotloop-db.container` del producto mayor sobre los suyos, ejecute `systemctl daemon-reload` y reinicie.
- **Helm:** `helm upgrade hotloop hotloop/hotloop-edge` (o `hotloop/hotloop`) sobre la misma versión desplegada. Los tres charts seleccionan sus pods con las mismas etiquetas y nombran igual el StatefulSet y el volumen de la base de datos, así que la actualización está permitida y el volumen sigue enlazado.

Haga antes una copia de seguridad (`POST /api/backup`, vea [Copias de seguridad y restauración](/es/iot/backup/)) y cópiela fuera de la caja. Este paso se ha probado en Quadlet, de IoT a Edge y al Gateway sobre un mismo volumen de base de datos con el mismo dispositivo presente en cada paso, con el directorio de PostgreSQL de IoT arrancando bajo la imagen TimescaleDB del Gateway, y como `helm upgrade` en un clúster real. Donde el directorio de IoT, sin la extensión TimescaleDB, no la tiene, el historial se queda en particiones nativas tras ese paso, y una hypertable exige una copia de seguridad y una restauración en una TimescaleDB nueva. Volver a un producto menor no es un paso para hacer en una caja que le importa.

## Cómo se publican

Una etiqueta `v` publica los cuatro, así que IoT, Edge, el Gateway y el Edge Relay comparten siempre la versión. Antes de compilar nada, se comprueba que la versión y la imagen de cada chart coincidan con la etiqueta, que cada unidad Quadlet de aplicación siga `:stable` con una comprobación de salud, y que cada unidad de base de datos coincida con su chart y no se actualice nunca de forma automática. Los charts de IoT y Edge se generan a partir del chart del Gateway, así que una corrección en uno llega a los tres.
