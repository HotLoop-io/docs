---
title: "La actualización automática :stable"
description: "Cada equipo sigue la etiqueta stable. Qué hace una actualización, qué no deshace una reversión y cómo retenerlas hasta que usted decida."
---

Cada equipo sigue `:stable` y Podman lo actualiza. Es la regla para los cuatro productos y por eso ninguna unidad de aquí fija un número de versión: un equipo fijado en `4.17.0` tiene exactamente la edad del día en que alguien lo instaló, y nadie vuelve a la planta a cambiar una etiqueta. Cada etiqueta de versión mueve `:stable`, y se rechaza una versión cuyas unidades no la sigan.

Active el temporizador una sola vez por equipo:

```sh
sudo systemctl enable --now podman-auto-update.timer
```

## Qué hace una actualización

Podman descarga `:stable` cuando se dispara el temporizador y, si el digest cambió, reinicia la unidad de la aplicación con la nueva imagen. Solo la de la aplicación: el contenedor de la base de datos no se toca, así que una actualización no interrumpe el historiador. La unidad tiene una comprobación de estado que no necesita shell (la imagen no trae ninguno): `hotloop healthcheck` consulta el propio `/readyz` de la aplicación, que solo responde mientras responde la base de datos. La unidad permanece en "activating" hasta que lo supera, de modo que Podman distingue una actualización que arrancó de una que no, y si la nueva imagen nunca arranca, vuelve a poner la anterior bajo `:stable` y la inicia.

Arrancar la nueva imagen ejecuta primero sus migraciones, sobre la base de datos que ya existe, y una base grande tarda. La unidad da a la aplicación 15 minutos para responder antes de dar la actualización por fallida, y los fallos de los primeros cinco minutos no cuentan, porque una migración no es un fallo.

Se encontraron dos cosas ejecutándolo, no leyendo sobre ello, y las unidades llevan la corrección de cada una. Una cadena `HealthCmd` simple se ejecuta con `/bin/sh -c` y la imagen no tiene shell, así que la comprobación nunca podía pasar: por eso es un arreglo JSON. Y las versiones antiguas de Quadlet leen `Notify=healthy` como un simple `true` y pasan `--sdnotify=conmon`, que da la aplicación por arrancada en cuanto arranca su contenedor: una actualización que no podía iniciarse se informaba como éxito y no se revertía nada. Las unidades indican `--sdnotify=healthy` por sí mismas.

## Por qué no hay pod

La aplicación y la base de datos compartían un pod. Eso costaba la reversión, y se descubrió ejecutándola, no leyendo el manual. Para un contenedor dentro de un pod, la actualización automática de Podman reinicia la unidad **del pod**, y la unidad del pod arranca bien sea cual sea el problema de la aplicación que contiene. Una versión que no podía arrancar se informó como `UPDATED true`, la aplicación entró en un bucle de fallos con ella (veinte reinicios en los primeros minutos) y `:stable` en el equipo era la imagen rota. También reiniciaba la base de datos en cada actualización de la aplicación. Con una red en su lugar, la aplicación es su propia unidad, Podman reinicia esa, y la unidad permanece en "activating" hasta que la aplicación responde `/readyz`: la misma versión volvió como `UPDATED rolled back`.

## Lo que una reversión no puede deshacer

Una migración. Cuando una versión migra la base de datos y luego falla su comprobación de estado, Podman pone de nuevo la versión anterior, y esta arranca sobre el esquema que dejó la fallida. Es seguro, y se mantiene seguro de tres maneras ([Las migraciones solo añaden](/es/iot/migrations/) tiene el detalle):

- **Las migraciones solo añaden.** Una tabla, una columna con valor por defecto, un índice. Nunca un borrado, un cambio de nombre ni un cambio de tipo, de modo que la versión anterior encuentra todo lo que conocía donde estaba y nunca mira lo añadido.
- **Una aplicación rechaza un esquema en el que no puede confiar.** La base de datos registra qué versión aplicó cada migración. Una versión revertida que va un paso por detrás arranca y lo dice en su registro. Una que va dos o más versiones por detrás no arranca y explica por qué, nombrando ambas versiones. Es el caso en que un equipo falla una actualización, revierte, falla otra, y la base de datos ya ha avanzado dos veces. La aplicación termina de inmediato con el mensaje en `journalctl -u hotloop`, y el `Restart=always` de la unidad sigue intentándolo y sigue siendo rechazada. Lo que lo resuelve es una versión que conozca el esquema: la más reciente, que es lo que es `:stable` (`sudo podman auto-update`, o descárguela y reinicie). O restaure una copia de seguridad hecha por la versión que está ejecutando ([Copias de seguridad y restauración](/es/iot/backup/)).

Así, una reversión ya no tiene una salvedad en las notas de la versión. Lo que sigue sin poder deshacer son los datos: la versión fallida pudo escribir filas que la antigua ignora. Haga una copia de seguridad antes de activar las actualizaciones; es lo único que hay entre una mala versión y una restauración.

## Por qué la base de datos no sigue `:stable`

La aplicación lleva la etiqueta de actualización automática. El contenedor de la base de datos no, y su `Image=` es una etiqueta exacta. El motivo es que las actualizaciones de la aplicación se pueden deshacer y las de la base de datos no.

- Una **versión mayor de PostgreSQL** (16 a 17) no es un reinicio. La política de versiones de PostgreSQL indica que el directorio de datos no puede mantenerse compatible hacia atrás entre versiones mayores, y se requiere un volcado y recarga, o `pg_upgrade` ([postgresql.org/support/versioning](https://www.postgresql.org/support/versioning/)). Una etiqueta que flotara entre versiones mayores lo haría con el historiador de una planta durante un reinicio ajeno. Fijar la versión mayor es el mínimo, y no es una "fijación de endpoint" en el sentido de la regla anterior. El único salto que ha hecho HotLoop, de 16 a 17, es `hotloop-db-upgrade.container`, que se ejecuta a propósito cuando usted copia las nuevas unidades.
- Una **versión menor** (16.14 a 16.15) no necesita volcado ni restauración. La misma página añade que algunas "podrían requerir pasos adicionales, así que lea siempre primero las notas de la versión". Un equipo desatendido no lee notas de versión.
- **TimescaleDB** (el Gateway y el Edge) es la otra mitad. La aplicación ejecuta `ALTER EXTENSION timescaledb UPDATE` por sí misma al arrancar tras una imagen más nueva, y una actualización de extensión es un cambio sin retorno en la base de datos: volver a poner la imagen anterior no lo deshace. Una etiqueta flotante de Timescale haría que la actualización reversible de la aplicación arrastrara tras de sí una irreversible.
- Una imagen nueva de base de datos que arranca y funciona no es una imagen sana. La comprobación de estado distingue un contenedor que no arranca de uno que sí, y nada más. Si un historiador sobrevivió a una actualización del motor no es algo que responda `pg_isready`.

Por eso la etiqueta de la base de datos se mueve con una versión de HotLoop probada contra ella. `release_guard.sh` mantiene cada `hotloop-db.container` igual a la base de datos de su chart, de modo que un equipo Quadlet y una instalación con chart del mismo producto ejecutan la misma, y rechaza un `AutoUpdate=` sobre ella. El coste es que las versiones de parche de PostgreSQL llegan a un equipo cuando una versión las incluye, o cuando usted cambia la etiqueta a mano. Dentro de la misma versión mayor eso es editar `hotloop-db.container`, un `daemon-reload` y un reinicio del pod, tras leer las notas de la versión y hacer una copia de seguridad. Una versión mayor es `pg_upgrade`, que HotLoop ejecuta para 16 a 17 y que usted ejecuta por su cuenta, o restaura sobre ella, para cualquier otra.

## Retener las actualizaciones hasta que usted lo decida

Por defecto no hay retención: las actualizaciones ocurren cuando se dispara el temporizador. Un sitio que quiere que una persona decida tiene dos vías, y ninguna necesita que la aplicación sea accesible.

- **Retención.** Deje `podman-auto-update.timer` apagado. Nada se actualiza. Cuando esté listo, ejecute `sudo podman auto-update`: esa es la aprobación, con la misma comprobación de estado y la misma reversión. Podman actualiza todos los contenedores etiquetados de la máquina cuando se ejecuta, no solo estos, y no se le puede decir que omita uno, así que un equipo que debe ejecutar el temporizador para otros contenedores no puede además retener estos.
- **Una ventana.** `update-window.conf` es un complemento del temporizador que indica cuándo puede dispararse, por ejemplo el domingo a las 03:00, en lugar del valor por defecto de cada día a medianoche:

  ```sh
  sudo mkdir -p /etc/systemd/system/podman-auto-update.timer.d
  sudo cp update-window.conf /etc/systemd/system/podman-auto-update.timer.d/
  sudo systemctl daemon-reload && sudo systemctl restart podman-auto-update.timer
  ```

El Edge Relay es distinto en un punto: un Gateway puede aprobar su actualización desde la pantalla de flota, porque un relay ya escucha los comandos del Gateway al que reenvía. IoT, Edge y Gateway no tienen un canal así para alcanzarlos, y construirlo pondría un botón de "reiniciar este equipo" en una interfaz web para una función que `sudo podman auto-update` ya es. Consulte la [referencia del Edge Relay](/es/edge-relay/reference/#updating-a-relay) para la retención del relay, y `edge-relay-hold.conf`.

## Lo que ve el Gateway

`GET /api/status` en cualquiera de los tres indica su `version` y su `imageDigest` cuando la unidad lo comunicó (lo hace, antes de cada arranque). Un Edge o un Gateway con la publicación Edge activada es un nodo Sparkplug como un relay, y pone los mismos dos datos en cada nacimiento, de modo que un Gateway que lo tiene en su lista de flota muestra la versión y el digest y registra el cambio cuando una actualización automática lo mueve ([Gestión de flota](/es/gateway/fleet/)). IoT no tiene upstream, así que su digest está en su propio `/api/status` y en ningún otro sitio.

## Con Helm

Un pod no puede reemplazarse a sí mismo, así que no hay actualización desatendida para los charts: `helm upgrade` es la actualización, y el `image.tag` del chart tiene por defecto su `appVersion`, que es la versión.
