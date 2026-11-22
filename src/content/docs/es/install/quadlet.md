---
title: "Podman Quadlet en una Pi"
description: "Ejecute HotLoop como servicios systemd reales en una Pi o un PC industrial pequeño con Podman Quadlet, sin Docker, sin Compose y sin clúster."
---

Para una Pi o un PC industrial pequeño que **no** forma parte de un clúster k3s. Si lo forma, use el chart del producto. Este directorio y los charts son las dos formas admitidas de ejecutar HotLoop.

Sin Docker y sin `podman run` suelto desde un shell que muere con la sesión. Quadlet convierte los contenedores en servicios systemd reales: arrancan con el equipo sin ningún usuario conectado, se reinician ante un fallo y escriben en journald.

| Directorio | Producto | Imagen |
|---|---|---|
| `iot/` | HotLoop IoT, con PostgreSQL 17 | `ghcr.io/hotloop-io/hotloop-iot` |
| `edge/` | HotLoop Edge, con TimescaleDB | `ghcr.io/hotloop-io/hotloop-edge` |
| `gateway/` | HotLoop Gateway, con TimescaleDB | `ghcr.io/hotloop-io/hotloop` |
| este directorio | HotLoop Edge Relay, sin base de datos | `ghcr.io/hotloop-io/hotloop-edge-relay` |

[La página de productos](/es/products/) indica cuál necesita.

Cada uno de los tres primeros tiene además un directorio `sqlite/`: el mismo producto con la base de datos como archivo y sin contenedor de base de datos. Consulte [SQLite en lugar de PostgreSQL](#sqlite-en-lugar-de-postgresql).

## IoT, Edge y el Gateway

Cada directorio tiene las mismas unidades y un script:

- **`hotloop.network`**: la red que comparten la aplicación y su base de datos. La aplicación llega a la base de datos por nombre (`hotloop-db:5432`) y nada más en el equipo puede hacerlo, porque la base de datos no publica ningún puerto. Solo se publica el 8080 de la aplicación.
- **`hotloop.container`**: la aplicación. Su cabecera trae los pasos de instalación; léala antes de copiar nada.
- **`hotloop-db.container`**: la base de datos, la misma imagen y versión que ejecuta el chart de ese producto. Se da por iniciada cuando responde, así la aplicación espera a una base de datos utilizable.
- **`hotloop-db-upgrade.container`** y **`hotloop-db-upgrade.sh`**: el paso de la base de datos de PostgreSQL 16 a 17, una sola vez. Se ejecuta antes de la unidad de la base de datos y solo cuando el volumen aún contiene datos de la 16; en un volumen nuevo, o uno que ya está en la 17, systemd la omite. Consulte [PostgreSQL 16 a 17](#postgresql-16-a-17).
- **`hotloop-db.volume`** y **`hotloop-data.volume`**: la base de datos y todo lo que la aplicación escribe bajo `/data` (copias de seguridad, certificados, la cola de reenvío, informes). Son volúmenes de Podman con nombre, así que `podman system prune` no los toca.

Tres secretos de Podman guardan lo que no debe ir en un archivo: `hotloop-db-password`, `hotloop-secret-key` (cifra las contraseñas de dispositivos en la base de datos; conserve una copia fuera del equipo) y `hotloop-admin-password-hash` (el hash bcrypt de la contraseña del primer administrador, nunca la contraseña).

**Podman 5.0 o posterior.** Raspberry Pi OS Bookworm incluye Podman 4.3, que no tiene Quadlet: use Raspberry Pi OS Trixie (Podman 5.4) o posterior. Las actualizaciones descritas abajo se ejecutaron en Podman 6.1.3; la unidad del Edge Relay, que comparte las mismas claves, en 4.9.3. Y ponga el volumen de la base de datos en un SSD USB, no en la tarjeta SD. El historial escribe todo el día, y las tarjetas SD mueren justo de eso.

### Por qué todos los productos usan los mismos nombres

Los nombres de unidad, de volumen y de secreto son idénticos en `iot/`, `edge/` y `gateway/`, a propósito. Subir un equipo de producto es copiar el `hotloop.container` y el `hotloop-db.container` del producto mayor sobre los suyos:

```sh
sudo cp gateway/hotloop.container gateway/hotloop-db.container \
  gateway/hotloop-db-upgrade.container gateway/hotloop-db-upgrade.sh /etc/containers/systemd/
sudo systemctl daemon-reload
sudo systemctl restart hotloop.service hotloop-db.service
```

Los volúmenes y los secretos se quedan, y con ellos cada dispositivo, etiqueta, alarma, usuario y hora de historial. Haga igualmente una copia de seguridad antes (`POST /api/backup`). Ese paso se ha ejecutado, de IoT a Edge y al Gateway sobre el mismo conjunto de volúmenes. Bajar de producto no es un paso que convenga dar en un equipo que le importe.

También significa un solo HotLoop por equipo. Dos se disputarían el puerto 8080 de todos modos.

### Verificado

Los archivos entregados de IoT, Edge y Gateway, sin tocar, se generan con el generador `quadlet` de Podman 6.1.3 con la misma estructura: la aplicación requiere la base de datos y la red, publica su propio puerto y lleva la etiqueta de actualización automática, mientras que la base de datos no lleva ninguna y no publica nada.

Después se ejecutaron de verdad las unidades del Gateway: sin privilegios, bajo systemd, con un registro local en lugar de ghcr.io y el propio `podman auto-update` de los productos. Un primer arranque con la base de datos sana y la aplicación sana tras ella; una actualización a una versión que añade una migración a una tabla que la aplicación ya usa, aplicada con el dispositivo existente y sus datos intactos y sin reiniciar nunca el contenedor de la base de datos; y una actualización a una versión que migra la base de datos y luego no puede arrancar, que Podman revirtió, con la versión anterior arrancando sana sobre la base de datos que la fallida ya había migrado. Edge e IoT funcionan con las mismas unidades y se han ejecutado bajo systemd en una Pi real, sobre hardware físico (2026-11-17).

## PostgreSQL 16 a 17

La base de datos de HotLoop es PostgreSQL 17 desde esta versión. Un equipo que ejecutaba una versión anterior tiene datos de PostgreSQL 16, que PostgreSQL 17 no abrirá, así que el paso es una unidad que se ejecuta antes que la base de datos. Ponga los archivos nuevos en su sitio y reinicie la base de datos, y no hace falta más:

```sh
sudo cp hotloop-db.container hotloop-db-upgrade.container hotloop-db-upgrade.sh \
  /etc/containers/systemd/
sudo systemctl daemon-reload
sudo systemctl restart hotloop-db.service
journalctl -u hotloop-db-upgrade.service      # what it did
```

`hotloop-db.container` requiere la unidad de actualización, así que un equipo que copió solo la nueva unidad de base de datos no arranca sobre datos de la 16 y el journal dice por qué. La unidad de actualización ejecuta `pg_upgrade` en modo copia hacia un directorio nuevo junto al antiguo, arranca el nuevo servidor una vez para comprobar que abre y solo entonces intercambia los nombres; los datos antiguos quedan en el volumen como `pgdata.pg16`. Descarga la imagen de PostgreSQL 16 solo cuando el volumen la necesita. Un fallo deja los datos de la 16 como estaban y la base de datos sin iniciar. La descripción completa, el camino de vuelta y cómo borrar `pgdata.pg16` están en [k3s y Helm](/es/install/helm/#postgresql-17). En una instalación sin privilegios, la ruta del script en la unidad es `~/.config/containers/systemd`, a partir de `%E`.

## SQLite en lugar de PostgreSQL

La base de datos es un ajuste, no una imagen (la página de k3s y Helm, "SQLite"). Con Quadlet eso significa un segundo conjunto de archivos, no una segunda imagen. El directorio `sqlite/` de cada producto tiene dos:

- **`sqlite/hotloop.container`**: solo la aplicación. Sin `Requires=` de una base de datos, sin red, sin contraseña de base de datos, y con `HOTLOOP_DB_TYPE=sqlite` y el archivo en `HOTLOOP_DB_PATH=/data/hotloop.db`. Sigue `:stable` y revierte una mala actualización exactamente como la unidad de PostgreSQL: la misma comprobación de estado, el mismo `--sdnotify=healthy`.
- **`sqlite/hotloop-data.volume`**: el volumen `hotloop-data`, donde viven el archivo de la base de datos y sus `-wal` y `-shm`. Es el mismo nombre de volumen que el de los archivos de PostgreSQL, así que es el mismo volumen de datos si alguna vez cambia.

| Directorio | Instalación | Secretos |
|---|---|---|
| `iot/`, `edge/`, `gateway/` | `hotloop.network`, `hotloop.container`, `hotloop-db.container`, `hotloop-db.volume`, `hotloop-data.volume` | tres |
| `iot/sqlite/`, `edge/sqlite/`, `gateway/sqlite/` | `hotloop.container`, `hotloop-data.volume` | dos: `hotloop-secret-key` y `hotloop-admin-password-hash` |

Instale un conjunto o el otro, nunca los dos: usan los mismos nombres de unidad. La cabecera de `sqlite/hotloop.container` tiene los pasos exactos. En resumen:

```sh
cd iot/sqlite        # or edge/sqlite, gateway/sqlite
sudo cp hotloop.container hotloop-data.volume /etc/containers/systemd/
# make hotloop-secret-key and hotloop-admin-password-hash as the header says
sudo systemctl daemon-reload
sudo systemctl start hotloop.service
curl -s localhost:8080/api/status
```

Conviene saber algunas cosas antes de elegirlo. SQLite es un único escritor sobre un único disco local: en una Pi el volumen va en un SSD USB, y el almacenamiento en red no es una opción porque SQLite se corrompe en él. El historial es una tabla con un índice, no particiones ni una hypertable, así que un sitio con años de historial a un segundo necesita los archivos de PostgreSQL. Y pasar un equipo entre SQLite y PostgreSQL es una copia de seguridad y una restauración ([Copias de seguridad y restauración](/es/iot/backup/)), no un cambio de unidades: la nueva base de datos empieza vacía. No copie un `sqlite/hotloop.container` sobre una instalación de PostgreSQL en marcha para "cambiar"; no lee los datos del volumen de PostgreSQL.

PostgreSQL simple en Edge o en el Gateway es la unidad de TimescaleDB con `Environment=HOTLOOP_HISTORIAN_TIMESCALE=false` añadido a `hotloop.container`. La unidad de IoT ya es PostgreSQL simple, e IoT no tiene ninguna unidad de TimescaleDB.

### Verificado (SQLite)

`iot/sqlite/hotloop.container` y su volumen se ejecutaron sin privilegios en Podman 4.9.3 bajo systemd (`systemctl --user`) a partir de los archivos confirmados, cambiados solo en los nombres, el puerto, la imagen (construida desde el mismo árbol) y el directorio de ejecución que necesita un gestor de usuario. La unidad arrancó sana, `/healthz` y `/readyz` respondieron 200, el administrador entró desde el secreto del hash, `/api/status` respondió, `hotloop.db`, `hotloop.db-wal` y `hotloop.db-shm` aparecieron en el volumen, y un reinicio no aplicó migraciones y volvió a iniciar la sesión del administrador. Las unidades `sqlite/` de Edge y Gateway son el mismo archivo salvo por la imagen y el valor por defecto de retención, y se han ejecutado bajo systemd como root en una Pi real, sobre hardware físico (2026-11-17).

## Edge Relay

- **`edge-relay-hold.conf`**: opcional: retiene las actualizaciones de imagen hasta que un operador las apruebe. Un complemento de systemd, no parte de una instalación por defecto.
- **`edge-relay.container`**, el servicio en sí. Los pasos completos de instalación están en el comentario de su propia cabecera; léalo antes de copiar nada.
- **`edge-relay-data.volume`**, un volumen de Podman con nombre para la cola de reenvío, de modo que las lecturas en búfer sobreviven a un reinicio del contenedor. Podman lo crea automáticamente la primera vez que arranca el servicio.
- **`devices.example.json`**, un punto de partida para el archivo de dispositivos. Cópielo a `/etc/edge-relay/devices.json` y edítelo para los dispositivos reales de este sitio; consulte [la referencia del Edge Relay](/es/edge-relay/reference/) para el formato completo.

### Inicio rápido

```sh
sudo mkdir -p /etc/containers/systemd /etc/edge-relay
sudo cp edge-relay.container edge-relay-data.volume /etc/containers/systemd/
sudo cp devices.example.json /etc/edge-relay/devices.json   # then edit it
sudo "$EDITOR" /etc/containers/systemd/edge-relay.container  # broker, group, node

# Skip this if the broker takes anonymous connections.
printf '%s' 'your-broker-password' | sudo podman secret create edge-relay-broker-password -

sudo systemctl daemon-reload
sudo systemctl start edge-relay.service
sudo systemctl status edge-relay.service
curl localhost:8081/status
```

**Actualizaciones.** La unidad sigue `:stable` y se actualiza sola en cuanto el temporizador de Podman está activado:

```sh
sudo systemctl enable --now podman-auto-update.timer
```

Si una nueva imagen no supera su comprobación de estado, Podman vuelve a poner la anterior. La lista de flota del Gateway muestra la versión y el digest de imagen de cada relay y registra cada cambio. Para retener las actualizaciones hasta que un administrador las apruebe en el Gateway, instale `edge-relay-hold.conf` como indica el comentario al principio de ese archivo y apague el temporizador. Todo lo que esto hace, y lo que no puede hacer, está en [la referencia del Edge Relay](/es/edge-relay/reference/#updating-a-relay).

Para aplicar un cambio al archivo local: edítelo y ejecute `sudo systemctl restart edge-relay.service`. El relay lee ese archivo al arrancar y no lo vigila.

Un archivo de dispositivos que envía el Gateway no necesita nada de eso: se aplica en vivo, sin reiniciar. No puede escribirse en `/etc/edge-relay/devices.json` (está montado `:ro` en una raíz de solo lectura), así que va en el volumen de datos como `/data/pushed-devices.json`, y mientras exista es el que el relay ejecuta y del que arranca. Sus ediciones al archivo local quedan sin usar hasta que borre el envío: `DELETE /api/fleet/{id}/config` en el Gateway mientras el relay está en marcha, y vuelve al archivo local al instante. El journal indica en qué archivo está, así que consúltelo antes de dudar de su JSON.

Verificado contra el binario `quadlet` real (`/usr/libexec/podman/quadlet -dryrun` de `podman-5.8.6`): ambas unidades se analizan sin errores y generan la invocación `podman run` esperada, con la dependencia del volumen y el secreto conectados automáticamente.
