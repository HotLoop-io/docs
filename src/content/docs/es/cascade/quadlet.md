---
title: "Cascade en Podman Quadlet"
description: "Ejecute Cascade como servicios systemd con Podman Quadlet, sobre SQLite o con Postgres y un worker aparte, con una ventana de actualización que usted controla."
---

Hay dos formas de ejecutarlo. Las dos piden Podman 5.0 o superior y una instalación como root, para que arranquen con el equipo sin que nadie haya iniciado sesión. Las dos siguen `ghcr.io/hotloop-io/hotloop-cascade:stable`, lo ejecutan en modo de solo lectura, sin privilegios de root y con todas las capacidades retiradas, y dejan que systemd lo reinicie. Las actualizaciones y cómo se revierten están al final.

## Un equipo, SQLite

`hotloop-cascade.container` y `hotloop-cascade-data.volume`. La base de datos es un archivo en el volumen, junto a la clave que cifra las credenciales guardadas.

```sh
sudo cp hotloop-cascade.container hotloop-cascade-data.volume /etc/containers/systemd/
sudo install -D -m 600 /dev/null /etc/hotloop-cascade/cascade.env
sudo systemctl daemon-reload
sudo systemctl start hotloop-cascade
```

Abra `http://this-box:8080`. La primera persona que lo abre crea la primera cuenta, así que hágalo antes de compartir la dirección.

## PostgreSQL, un servidor y workers

`postgres/`. La base de datos, el servidor y, si quiere, más workers. Postgres es la cola, así que los workers toman el trabajo del mismo sitio. La base de datos está en una red propia y no publica ningún puerto.

Primero, tres secretos, que se crean una sola vez. Los comandos están al principio de `postgres/hotloop-cascade.container`. El de la clave es el más importante: si lo pierde, todas las credenciales guardadas quedan ilegibles. Guarde una copia en un lugar que no sea este equipo.

```sh
cd postgres
sudo cp hotloop-cascade.network hotloop-cascade-db.container hotloop-cascade-db.volume \
  hotloop-cascade-data.volume hotloop-cascade.container /etc/containers/systemd/
sudo install -D -m 600 /dev/null /etc/hotloop-cascade/cascade.env
sudo systemctl daemon-reload
sudo systemctl start hotloop-cascade
```

Más workers: `hotloop-cascade-worker.container`. Los workers comparten el volumen de datos, así que tienen que estar en el mismo equipo. Para pasar de un equipo, use el chart de Helm.

## Ajustes

`/etc/hotloop-cascade/cascade.env`, un `NAME=value` por línea, y tiene que existir aunque esté vacío (la línea `install` lo crea). Los que más va a querer:

| Ajuste | Qué hace |
|---|---|
| `HOTLOOP_CASCADE_PUBLIC_URL` | La dirección con la que la gente llega a Cascade. Con ella se construyen los enlaces de los webhooks y de las devoluciones de llamada de OAuth. Hasta que la defina vale `http://localhost:8080`, que solo funciona desde el propio equipo. |
| `HOTLOOP_CASCADE_METRICS_TOKEN` | Exige `Authorization: Bearer` en `/metrics`. |
| `HOTLOOP_CASCADE_FILES_DIR` | Activa los pasos de archivos, en este directorio. Móntelo también en el contenedor. |

Las unidades solo fijan el directorio de datos, los puertos y la clave, y un valor puesto en una unidad prevalece sobre el del archivo env, así que no los toque. Después de un cambio: `sudo systemctl restart hotloop-cascade`.

## Comprobarlo

```sh
sudo podman healthcheck run hotloop-cascade
curl -s http://127.0.0.1:8081/readyz
sudo podman exec hotloop-cascade /usr/local/bin/hotloop-cascade workflows import - < workflow.yaml
```

La salud y las métricas están en el puerto 8081, publicado solo en el loopback. Si otra cosa ya usa el 8080 o el 8081, cambie la parte izquierda de las líneas `PublishPort=`.

## Actualizar

Las unidades de la aplicación siguen `:stable` y llevan `AutoUpdate=registry`. Active el temporizador de Podman una vez por equipo:

```sh
sudo systemctl enable --now podman-auto-update.timer
```

Cuando se dispara, Podman descarga `:stable` y, si el digest cambió, reinicia la unidad con la imagen nueva. La unidad no cuenta como iniciada hasta que el contenedor pasa su comprobación de salud (`Notify=healthy`; la comprobación es el propio binario preguntando a su `/readyz`, como una matriz JSON porque la imagen no tiene shell). Si la imagen nueva no llega a ese punto, Podman devuelve la anterior a `:stable` y la arranca. La espera es de hasta 15 minutos, porque una imagen nueva migra la base de datos al arrancar.

Para retener las actualizaciones hasta que usted diga, deje el temporizador apagado y ejecute `sudo podman auto-update` cuando esté listo. Para que ocurran solo dentro de una ventana, instale `update-window.conf` (su cabecera explica cómo).

Dos cosas que una reversión no puede deshacer. Las migraciones solo van hacia delante, así que haga una copia de seguridad antes de activar las actualizaciones. Una versión que cambia una tabla de un modo que la anterior no puede leer lo dice en sus notas de la versión. Y la base de datos: su imagen está fijada a una etiqueta exacta y no lleva etiqueta de actualización, a propósito. Un servidor nuevo que no arranca se deshace volviendo a la imagen anterior, mientras que una imagen nueva de la base de datos puede arrancar, cambiar el directorio de datos y solo después resultar un error. Dentro de PostgreSQL 18 eso es editar la etiqueta, después de leer las notas de la versión y de hacer una copia de seguridad.

En la variante con PostgreSQL, el servidor y cada worker son unidades separadas, así que una actualización que no arranca revierte esa unidad y no la de al lado.

## Qué se probó

Las unidades se ejecutaron de verdad en Podman 6.1.3, sin root bajo systemd, con un registro local en lugar de ghcr.io y las unidades entregadas sin editar salvo los puertos del equipo. En la variante independiente y en la de PostgreSQL: un primer arranque que espera a un contenedor sano; una actualización a un digest nuevo, que volvió sano con los datos intactos y, en la variante con PostgreSQL, con el contenedor de la base de datos sin tocar; y una actualización a una imagen que se cierra al arrancar, que `podman auto-update` informó como `rolled back`, con el digest anterior sano de nuevo y el flujo de trabajo anterior todavía en marcha. Como instalación root en Podman 4.9.3, la versión anterior de las unidades arrancó y se reinició bajo systemd; y `Notify=healthy` no lo respeta Quadlet 4.9, por eso las unidades llevan además `--sdnotify=healthy`.

Después se repitieron las dos variantes como instalación root, que es como indican las unidades que se ejecuten, en Podman 5.8.7 bajo systemd dentro de un contenedor privilegiado desechable, con el mismo registro local en lugar de ghcr.io como réplica y las unidades sin editar. Independiente: el arranque esperó a un contenedor sano, un contenedor terminado a la fuerza volvió sano, una actualización a una imagen buena subió sana con el digest nuevo, una actualización a una imagen que se cierra al arrancar se informó como `rolled back` con la buena en marcha otra vez, y después de cada paso se ejecutó un flujo de trabajo. PostgreSQL, con el servidor y un worker adicional: `systemctl start` sobre el servidor esperó a la base de datos y luego al servidor sanos, un servidor terminado a la fuerza volvió, una actualización a una imagen buena movió el servidor y el worker y dejó en paz el contenedor de la base de datos, una actualización a una imagen que se cierra al arrancar volvió como `rolled back` con los dos otra vez en la imagen buena y la base de datos sin tocar, y se ejecutó un flujo de trabajo antes, entre medias y después. Una cosa que conviene saber al leer esa salida: el servidor y el worker comparten una imagen, y cuando el primero se revirtió, el otro mostró `true` en su lugar, con un reinicio, y acabó en la imagen buena de todos modos. Cuál se revierte primero cambió de una ejecución a otra.

Ejecutado en hardware real (2026-11-17), en una Raspberry Pi de verdad y con una actualización automática de Quadlet contra el propio ghcr.io.
