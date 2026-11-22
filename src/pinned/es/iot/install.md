---
title: "Instalar HotLoop IoT {{hotloop}}"
description: "Instale HotLoop IoT {{hotloop}} en k3s con Helm, o en una Pi o PC pequeño como servicios systemd con Podman Quadlet, con PostgreSQL o un archivo SQLite."
sidebar:
  label: "Instalación"
---

HotLoop IoT se lanzó por primera vez en la 4.18.10. La imagen es `ghcr.io/hotloop-io/hotloop-iot:{{hotloop}}`, compilada para amd64, arm64 y arm/v7, y el chart es `hotloop-iot` en el mismo repositorio Helm que el resto de la gama. Ambos se descargan sin iniciar sesión. No hay camino con Docker ni Compose, a propósito, y un simple `podman run` desde una shell que muere con la sesión no es una instalación.

Hay dos vías. Un clúster usa Helm. Una Pi, un NUC o un pequeño PC industrial sin clúster usa Podman Quadlet. En ambos casos la base de datos se elige una sola vez: PostgreSQL 17 (la predeterminada) o un archivo SQLite sin contenedor de base de datos.

## Helm

```bash
helm repo add hotloop https://hotloop.io/hotloop
helm repo update
helm install hotloop hotloop/hotloop-iot --version {{hotloop}} \
  --namespace hotloop --create-namespace
```

Llame a la versión `hotloop` sea cual sea el producto. El nombre de la versión es el que llevan el volumen de la base de datos, los Secrets y el Service, y mantenerlo es lo que permite a un sitio pasar después a un producto superior.

Eso despliega IoT más PostgreSQL 17.11 a su lado, en un volumen de 10 Gi, con 30 días de historial. El chart genera la contraseña de la base de datos, el token MCP y una contraseña de administrador en el Secret de la versión, y los reutiliza en cada actualización, así que un `helm upgrade` nunca cambia una contraseña a sus espaldas.

Para un archivo SQLite y ningún pod de base de datos, pídalo al instalar:

```bash
helm install hotloop hotloop/hotloop-iot --version {{hotloop}} \
  --namespace hotloop --create-namespace \
  --set database.type=sqlite
```

SQLite es un solo escritor en un solo disco local, así que es una réplica, y el volumen va en almacenamiento local, nunca NFS. Un sitio con años de historial a un segundo necesita PostgreSQL. El chart de IoT acepta `postgresql` o `sqlite` y nada más: pedirle `timescaledb` hace fallar la instalación. Pasar de una a otra más adelante es una copia de seguridad y una restauración, no un cambio de valores, porque la base nueva empieza vacía. [Copias de seguridad](/es/iot/backup/) tiene la restauración.

### Haga copia de la clave

El chart también genera `<release>-secret-key` (`hotloop-secret-key` con los comandos de arriba). Contiene la clave que cifra cada contraseña que HotLoop guarda de un dispositivo. La clave nunca está en la base de datos ni en una copia de seguridad, así que es parte de sus datos: una copia restaura las credenciales solo donde esa clave esté montada. El chart conserva el Secret tras un `helm uninstall`. Guárdela en otro lugar que no sea junto a sus copias, porque una clave junto a las copias que protege no protege nada. [Instalar el Gateway](/es/gateway/install/#haga-copia-de-la-clave-antes-de-necesitarla) cuenta toda la historia, y es la misma clave.

### Iniciar sesión

El usuario es `admin`. Las notas de instalación imprimen el comando que lee la contraseña:

```bash
kubectl -n hotloop get secret hotloop \
  -o jsonpath='{.data.admin-password}' | base64 -d
kubectl -n hotloop port-forward svc/hotloop 8080:8080
```

Abra `http://localhost:8080`. Esa cuenta de administrador es un arranque, no un interruptor de restablecimiento: una vez que existe, cambiar `auth.admin.password` y actualizar no hace nada, así que una contraseña puesta por alguien en la interfaz nunca la pisa el siguiente despliegue.

Ahora añada un dispositivo, descubra sus tags e intente escribir en uno. No puede. Las escrituras vienen desactivadas, cada tag es de solo lectura hasta que alguien lo arma, y `safety.allowWrites` sigue en `false` hasta que usted decida que este despliegue puede mover maquinaria. [La puerta de escritura](/es/gateway/write-gate/) tiene cada comprobación, en orden.

### Qué configurar antes de que lo vea una planta real

Póngalos en un archivo de valores e instale con `-f`.

| Valor | Predeterminado | Por qué tocarlo |
|---|---|---|
| `plant.name`, `plant.siteId` | `HotLoop`, vacío | Cómo se llama la planta en las pantallas, en las páginas y para otros sitios. |
| `plant.latitude`, `plant.longitude` | vacío | Dónde está la planta, en grados decimales. [El sol](/es/iot/sun/) se calcula con ellos en la propia caja. Los dos o ninguno. |
| `global.timezone` | `America/New_York` | Las programaciones y los cambios de turno se rigen por ella. Tiene que ser un nombre de zona real, porque uno que no cargue detiene el arranque. |
| `publicUrl` | vacío | La dirección con la que un teléfono en el Wi-Fi de la planta llega a HotLoop. Sin ella, las notificaciones no tienen enlace de vuelta y ntfy no recibe botón de confirmar. |
| `safety.allowWrites` | `false` | El interruptor general. Apagado, nada escribe en una máquina, desde ningún sitio. |
| `safety.allowMcpWrites` | `true` | Deja que los agentes escriban por la misma puerta, activado desde la 4.19.4. Sigue al interruptor general: con `safety.allowWrites` apagado, nada escribe, agentes incluidos. Póngalo en `false` y los agentes siguen pudiendo leer toda la planta y nunca escribir. |
| `historian.retentionDays` | `30` | Días de historial que se conservan. El Gateway y Edge conservan 90, porque el disco de una Pi es pequeño. |
| `logbook.retentionDays` | `90` | Días de cambios de estado de entidades que conserva el [registro](/es/iot/logbook/). |
| `database.postgresql.persistence.size` | `10Gi` | Aquí vive su historial. Dimensiónelo según el número de tags y la retención anterior. |
| `secretKey.existingSecret` | vacío | Un Secret que usted gestiona con la clave de contraseñas de dispositivo. Póngalo si genera el chart con `helm template`, que no puede generar una clave estable. |
| `opcuaClient.persistence.enabled` | `false` | Actívelo antes de añadir un dispositivo OPC UA seguro, para que los certificados del cliente sobrevivan a un reinicio. |
| `ingress` | desactivado | Solo si lo quiere accesible desde fuera del clúster por un nombre. |

## Podman Quadlet

Para una caja que no está en un clúster. Quadlet convierte los contenedores en verdaderos servicios de systemd: arrancan al iniciar sin nadie conectado, se reinician cuando mueren y registran en el journal. Necesita **Podman 5.0 o posterior**. Raspberry Pi OS Bookworm trae la 4.3, que no tiene Quadlet en absoluto, así que una Pi necesita Trixie o posterior. Ponga el volumen de la base de datos en un SSD USB y no en la tarjeta SD, porque el historial escribe todo el día y las tarjetas SD mueren justo de eso.

Las unidades están en el directorio `iot/` del repositorio de HotLoop, dentro de `deploy/quadlet/`. [Podman Quadlet](/es/install/quadlet/) explica qué es cada archivo. La versión corta para PostgreSQL:

```bash
sudo cp hotloop.network hotloop.container hotloop-db.container \
  hotloop-db.volume hotloop-data.volume /etc/containers/systemd/

openssl rand -hex 24 | sudo podman secret create hotloop-db-password -
sudo podman run --rm ghcr.io/hotloop-io/hotloop-iot:stable gen-secret-key \
  | sudo podman secret create hotloop-secret-key -
printf '%s' 'a long admin password' \
  | sudo podman run --rm -i ghcr.io/hotloop-io/hotloop-iot:stable hash-password \
  | sudo podman secret create hotloop-admin-password-hash -

sudo systemctl daemon-reload
sudo systemctl start hotloop.service
sudo systemctl status hotloop.service hotloop-db.service
curl -s localhost:8080/api/status
```

Después abra `http://<this box>:8080` e inicie sesión como `admin`. Los tres secrets son la contraseña de la base de datos, la clave que cifra las contraseñas de dispositivo (si la pierde hay que volver a escribirlas todas, así que guarde una copia en un lugar que no sea esta caja) y el hash bcrypt de la contraseña del administrador, nunca la contraseña en sí.

Para un archivo SQLite en su lugar, use los archivos de `iot/sqlite/` y nada del directorio superior. Tienen los mismos nombres de unidad, así que es un conjunto u otro, nunca ambos. Son dos archivos, `hotloop.container` y `hotloop-data.volume`, y dos secrets, `hotloop-secret-key` y `hotloop-admin-password-hash`. La base de datos es `/data/hotloop.db` en el volumen `hotloop-data`.

La unidad sigue `:stable`, y Podman la actualiza cuando el temporizador está activado:

```bash
sudo systemctl enable --now podman-auto-update.timer
```

Una imagen nueva migra la base de datos al arrancar, y si no puede arrancar, Podman vuelve a poner la anterior. El contenedor de la base de datos no sigue `:stable`, a propósito. [La actualización automática de :stable](/es/install/auto-update/) explica qué hace una actualización, qué no puede deshacer un retroceso y cómo retener las actualizaciones hasta que usted diga. Haga una copia de seguridad antes de activar las actualizaciones.

## Pasar a un producto superior

De IoT a Edge y al Gateway se conserva cada dispositivo, tag, entidad, automatización, alarma, usuario y hora de historial, y [la gama](/es/products/) explica cómo. El cambio se ha probado en Quadlet y como `helm upgrade` en un clúster real. Volver a un producto inferior no es un cambio que convenga hacer en una caja que le importa, así que haga antes una copia de seguridad.

## Hasta dónde se ha probado

Las unidades Quadlet de IoT con SQLite y con PostgreSQL se han ejecutado bajo systemd, sin root, desde los archivos confirmados, y una Pi real bajo systemd como root y las imágenes arm de 32 bits se han ejecutado en hardware real, en bare metal (2026-11-17).

## Licencia

HotLoop IoT está bajo el HotLoop Source License Agreement 1.0. Es gratuito y de código disponible, no de código abierto según la OSI. El uso doméstico y de laboratorio es gratuito, y también el de escuelas, organizaciones sin ánimo de lucro y organismos públicos para su propia actividad. Consulte [la página de licencia](/es/license/) y [Usar HotLoop en una empresa](/es/business/).
