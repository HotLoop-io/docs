---
title: "Actualizar HotLoop Gateway a {{hotloop}}"
description: "Desde 4.22.1 es un helm upgrade con tres migraciones nuevas. Desde 4.18.11 los agentes pueden escribir. Desde 4.18.10 la base de datos pasa a PostgreSQL 17."
sidebar:
  label: "Actualización"
---

Seis caminos hasta {{hotloop}}, y no se parecen en nada. Desde 4.22.1 es un simple `helm upgrade` que añade tres tablas y columnas y monta el host en solo lectura para el estado del equipo, así que revise su perfil de Pod Security. Desde 4.18.11 es un simple `helm upgrade`, pero dos cosas cambian lo que hace una planta en marcha, así que léalas antes. Desde 4.18.10 el motor de la base de datos cambia por debajo, y conviene saberlo antes de que ocurra. Desde 4.17.0 es un simple `helm upgrade`, con un par de valores por defecto que se movieron. Desde 4.16.0 se pasa primero por 4.17.0, y después un Secret nuevo forma parte de los datos de su planta tanto como la base de datos. Desde 4.3.1 es un chart con otro nombre que un simple `helm upgrade` no puede tocar, y por el camino se pasa por 4.16.0 y 4.17.0. Las notas de versión cubren un salto cada vez, y ninguna cubre saltarse una versión, así que esta página no promete que eso funcione. Busque el camino que es el suyo y léalo entero antes de tocar una planta en marcha.

:::caution[Si viene de 4.20.2 o anterior: un cliente OPC UA con Basic256 deja de conectarse]
4.21.0 desactivó `Basic128Rsa15` y `Basic256` por defecto, tanto en actualizaciones como en instalaciones nuevas. El servidor ya no los lista y rechaza a un cliente que pida uno por su nombre. Compruebe si algún cliente OPC UA suyo (la conexión de Ignition lo muestra) no habla nada más nuevo que `Basic256`, y pase ese cliente a `Basic256Sha256`. Si no puede pasarlo, `HOTLOOP_OPCUA_SERVER_ALLOW_DEPRECATED_POLICIES=true` (en el chart, `opcuaServer.allowDeprecatedPolicies: true`) devuelve las dos políticas, y el servidor lo avisa al arrancar. 4.21.0 añade además la migración 0027, una tabla nueva, así que por lo demás la actualización es un simple `helm upgrade`. La comprobación de la versión arrancó 4.20.2 sobre el esquema migrado y funcionó, así que la tabla no es motivo para que un rollback sea inseguro.
:::

:::note[Los charts antiguos se descargan por URL]
El índice del repositorio de charts conserva los charts del Gateway hasta 4.16.0, así que `hotloop/hotloop --version 4.17.0` se resuelve, y los paquetes también se sirven por URL. Los comandos de abajo para 4.16.0 y 4.17.0 nombran el chart por su URL, como `https://hotloop.io/hotloop/hotloop-4.17.0.tgz`, y funciona de las dos maneras. IoT y Edge empiezan en 4.18.10.
:::

## Actualizar desde 4.22.1

Un simple `helm upgrade`, y nada de lo que ya está en el equipo cambia. En el primer arranque se ejecutan tres migraciones y cada una solo añade: `0028_unifi_port_cycles`, `0029_energy` y `0030_energy_demand`. Una copia de seguridad hecha en 4.22.1 se restaura aquí, y una hecha aquí no se restaura en una versión anterior, así que haga una copia antes si puede volver atrás.

- **El chart ahora monta el host en solo lectura para el estado del equipo.** Los charts de Gateway y Edge montan la raíz del host y `/proc` para que el panel de EmberNet pueda leer el disco, la CPU y la memoria del equipo. No se añade ningún privilegio. Un clúster con el perfil Pod Security restringido rechaza un hostPath, así que ponga `opcuaServer.dashboard.boxHealth.enabled: false` allí antes de actualizar. [Instalar el Gateway](/es/gateway/install/#salud-de-la-caja-y-el-montaje-del-host) tiene los valores.
- **Las funciones terminadas ahora vienen activadas.** Donde un chart tiene la función, `broker.enabled`, `opcuaServer.enabled`, `reports.enabled`, `backup.enabled` (diaria, `backup.interval: 24h`), `notify.enabled` con todos los canales de alarma, `edgePublish.enabled`, `monitoring.serviceMonitor.enabled` (solo se genera donde están instalados los CRD del operador de Prometheus) e `ingress.enabled` valen true. El Ingress no tiene nombre de host, así que responde a cualquier host que sirva su clase de ingress: ponga `ingress.hosts[0].host` para fijarlo a un solo nombre. Un canal de alarma o el publicador de Edge sin destino espera y lo dice, y un administrador le da un destino en Ajustes, "Adónde van las alarmas y las lecturas". Un valor que ponga su propio archivo sigue mandando, y cada uno puesto a `false` no genera escucha, Service, volumen ni Ingress.
- **Un acceso nuevo que puede leer y nada más.** El chart crea `embernet-dashboard-read` y su Secret `<release>-opcua-dashboard` en la primera instalación de esta versión y nunca lo rota.
- **Los comandos de UniFi existen y están desactivados.** Cinco tipos de punto pueden dar órdenes a una consola, y cada uno sigue en solo lectura hasta que una persona arma ese tag. La cuenta de la consola tiene que ser Administrador local para que funcionen.
- **La unidad de actualización de Quadlet se omite sola.** `hotloop-db-upgrade` solo se ejecuta cuando el volumen aún contiene datos de PostgreSQL 16, así que en un equipo que ya está en 17 aparece inactiva, no fallida. Tome los archivos de unidad nuevos de `deploy/quadlet/`.
- **Los charts conservan el Secret de credenciales al desinstalar,** igual que el volumen de la base de datos. Para empezar de cero, borre el Secret a mano junto con el volumen.

## Actualizar desde 4.18.11

Por qué hacerlo: los agentes por MCP ya pueden escribir, un valor que escribe en un tag con escala llega al registro como usted quería, un runtime de CODESYS se lee por los nombres que su programador dio a las variables, HotLoop puede enviar lecturas y el registro del sistema a un broker Kafka, OPC UA PubSub sobre UADP funciona en los dos sentidos, y una instalación desde la tienda le inicia sesión como usted mismo. [Las notas de la versión 4.19.4](/es/releases/hotloop-4-19-4/) tienen la lista completa, [4.19.5](/es/releases/hotloop-4-19-5/) es la compilación multiarquitectura de esa versión, y [4.19.8](/es/releases/hotloop-4-19-8/) añade una corrección del Libro de registro y selectores de tags que buscan en toda la planta. 4.19.0 a 4.19.3, 4.19.6 y 4.19.7 se etiquetaron y nunca se publicaron, así que ninguna existe como origen de una actualización.

```bash
helm repo update
helm upgrade hotloop hotloop/hotloop --version {{hotloop}} \
  --namespace hotloop --reset-then-reuse-values
```

Lo mismo para `hotloop-edge`, `hotloop-iot` y `hotloop-edge-relay`. La base de datos ya es PostgreSQL 17 desde 4.18.11, y nada de aquí la cambia, así que `helm rollback` a 4.18.11 no da problemas.

- **Los agentes pueden escribir.** `allowMcpWrites` viene activado por defecto en el código y en los tres charts. Un despliegue que tiene `allowWrites` activado y nunca puso `allowMcpWrites` recibe escrituras de agentes en esta actualización, por la misma compuerta que la pantalla. Un despliegue que guardó `allowMcpWrites: false` sigue desactivado. Si quiere a los agentes en solo lectura, póngalo en `false` antes de actualizar.
- **El endpoint MCP siempre tiene token.** Un binario suelto o una unidad Quadlet que nunca puso uno genera el suyo en el primer arranque y lo guarda en su base de datos. `hotloop mcp-token` lo imprime, y un agente apuntado a `/mcp` sin token deja de funcionar hasta que le dé ese.
- **Tags con escala.** Escriba 55.5 en un tag con escala 0.1 y en el registro entra 555, donde antes entraba 55. Si alguien escribía cuentas en bruto para evitarlo, ahora eso envía diez veces demasiado. Revise cada tag con escala o desfase que alguien escriba a mano, desde una automatización o una receta, y cambie esos números a valores de ingeniería en el mismo paso que la actualización.
- **Las horas van en `Z`.** Toda hora que escribe la API es UTC. Un script que leía su desfase local ahora recibe `Z`.
- **Una migración,** `0026`, añade una columna `options` a los destinos del historiador, vacía en todos los destinos que existen.

## Actualizar desde 4.18.10

Por qué hacerlo: la base de datos ahora es PostgreSQL 17, y el equipo se mueve solo. Además obtiene [integraciones](/es/iot/integrations/) con SNMP y BACnet/IP, inicio de sesión de quiosco, escalado de alarmas y una interfaz que se instala en el teléfono. [Las notas de la versión 4.18.11](/es/releases/hotloop-4-18-11/) tienen la lista. Lo que sigue es la parte que muerde.

PostgreSQL no abre el directorio de datos de otra versión mayor, así que un simple cambio de imagen habría dejado a cada equipo existente con una base de datos que no puede arrancar. HotLoop no le pide volcar y recargar. El primer arranque después de la actualización ejecuta un script antes de la base de datos, y el script hace el traslado.

```bash
helm repo update hotloop
helm upgrade <release> hotloop/hotloop --version {{hotloop}} --reset-then-reuse-values
```

Lo mismo para `hotloop-edge` y `hotloop-iot`. Haga primero una copia de seguridad en 4.18.10 y cópiela fuera del equipo. La copia de HotLoop la hace la aplicación en marcha a través de la base de datos en marcha, así que no se puede hacer en el paso que se ejecuta antes de que arranque la base de datos.

### Qué pasa en el primer arranque desde 4.18.10

- **El pod de la base de datos se queda en `Init`, y la aplicación lo espera.** En el chart son dos contenedores init del pod de la base de datos: la imagen antigua entrega su instalación de PostgreSQL 16 y la imagen nueva ejecuta `pg_upgrade`, en modo copia, hacia un directorio nuevo junto al antiguo. Arranca el servidor nuevo una vez para comprobar que abre, y solo entonces cambia los nombres. Cuánto tarda depende de sus datos, así que en uno grande vigile el registro la primera vez: `kubectl logs <release>-postgresql-0 -c pg-upgrade`. En Quadlet es `hotloop-db-upgrade.container`, una unidad oneshot que requiere la unidad de la base de datos: `journalctl -u hotloop-db-upgrade`.
- **Necesita casi tanto espacio libre como ocupan sus datos, y lo comprueba antes de empezar.** Si no hay sitio, se detiene con los datos de 16 exactamente como estaban y la base de datos sin arrancar. Libere disco y vuelva a arrancarlo.
- **`pgdata.pg16` se queda en el volumen, y borrarlo es cosa suya.** El directorio antiguo se renombra y se deja ahí. Es toda la base de datos PostgreSQL 16 tal como estaba en la actualización, es decir, su copia de seguridad y su camino de vuelta, y es tan grande como la base de datos. Cuando el equipo lleve en 17 todo el tiempo que quiera:

  ```bash
  # chart
  kubectl -n hotloop exec hotloop-postgresql-0 -c postgresql -- rm -rf /var/lib/postgresql/data/pgdata.pg16
  # Quadlet
  sudo rm -rf "$(sudo podman volume inspect hotloop-db --format '{{.Mountpoint}}')/pgdata.pg16"
  ```

- **Un fallo le deja donde estaba.** Si algo falla antes del cambio, los datos de 16 quedan intactos y la base de datos no arranca sobre un directorio a medio construir. En el chart el pod se queda en `Init:Error`. En Quadlet la unidad de actualización falla y la unidad de la base de datos que va detrás nunca arranca. Corrija lo que diga el registro y vuelva a arrancarlo.
- **`helm rollback` a 4.18.10 no arrancará su base de datos.** Esta es la advertencia. Un rollback devuelve la imagen de la base de datos a PostgreSQL 16, y 16 no abre un directorio 17. No se pierde nada y nada queda a medias, solo que la base de datos no arranca. Recuperarla pide el intercambio de [Volver atrás](/es/install/helm/#volver-atrás) en la página de k3s y Helm: detener la base de datos, mover `pgdata` a `pgdata.pg17` y `pgdata.pg16` a `pgdata`. **Eso descarta todas las escrituras hechas en 17 desde la actualización,** porque `pgdata.pg16` es la base de datos tal como estaba en ese momento. Avance cuando pueda. El intercambio de vuelta funciona una vez, y la siguiente actualización se niega a ejecutarse mientras haya un `pgdata.pg16` en medio. Está documentado, no lo ejecuta ninguna prueba.
- **Los equipos con Quadlet no sufren eso.** La actualización automática de Podman revierte solo la aplicación, nunca la base de datos, y la aplicación 4.18.10 lee sin problema una base de datos PostgreSQL 17, porque las migraciones solo añaden. Un equipo Quadlet que revierte una actualización sigue funcionando.
- **Una migración nueva, `0025_kiosk_pin`.** Solo añade columnas, todas con valor por defecto, así que 4.18.10 funciona con el esquema que deja.
- **Ahora hay un bloqueo, en toda instalación.** Diez contraseñas o PIN incorrectos seguidos bloquean esa cuenta durante 5 minutos, y un administrador puede desbloquearla. Un script que reintenta una contraseña incorrecta más de diez veces empieza a recibir `429`. `HOTLOOP_AUTH_LOCKOUT_ATTEMPTS=0` lo desactiva.
- **Desactivar la actualización.** `database.postgresql.upgrade.enabled: false` quita los contenedores init, y un volumen que aún está en 16 impide entonces que la base de datos arranque. Déjelo activado. Con él activado, una instalación nueva sigue descargando la imagen de PostgreSQL 16 una vez por nodo, porque la imagen de un contenedor init se descarga antes de ejecutarse.

### Quadlet y el Edge Relay

Copie los nuevos `hotloop-db.container`, `hotloop-db-upgrade.container` y `hotloop-db-upgrade.sh` del directorio de su producto en `deploy/quadlet/` al directorio de unidades, ejecute `systemctl daemon-reload` y reinicie `hotloop-db.service`. La unidad de la base de datos requiere la unidad de actualización, así que un equipo que solo recibió la unidad nueva de la base de datos no arranca sobre datos de 16, y dice por qué. El Edge Relay no tiene base de datos ni nada que hacer. Se publica en {{hotloop}} porque todos los productos salen sincronizados.

### Cambios de la API desde 4.18.10

- **Rutas nuevas:** `GET` y `PUT /api/notify/escalation`, `GET /manifest.webmanifest` y `GET /sw.js` (sin sesión, porque un teléfono las pide antes de que nadie haya iniciado sesión), `GET /api/integrations` con `POST /api/integrations/{id}/probe` y `/setup`, `POST /api/auth/kiosk`, `POST /api/auth/activity`, `PUT` y `DELETE /api/users/{username}/pin`, y `DELETE /api/users/{username}/lockout`.
- **Un permiso nuevo, `notify.escalation`,** solo para administradores. Los roles de visor y operador no lo recibieron.
- **Dos protocolos nuevos,** `snmp` y `bacnet`, en `GET /api/protocols`. El registro de alarmas tiene dos tipos de evento nuevos, `escalated` y `escalation-ended`, y un script que suponga la lista antigua se los encontrará.
- **Las horas vuelven en UTC,** todas las que devuelve el historial. Un script que comparaba las cadenas ve el desfase convertido en `Z`. Uno que compara instantes no nota nada.

## Actualizar desde 4.17.0

Por qué hacerlo: el Gateway deja de ser la única imagen. IoT y Edge son nuevos, la base de datos es un ajuste, los dispositivos que se anuncian por MQTT aparecen solos, el historial se puede escribir en la base de datos propia de la planta, y un equipo que sigue `:stable` revierte solo una mala actualización. Esto último solo funciona porque las migraciones solo añaden. [Las notas de la versión 4.18.10](/es/releases/hotloop-4-18-10/) tienen la lista.

Es un simple `helm upgrade`. Generamos los charts de Gateway 4.17.0 y {{hotloop}} lado a lado con los mismos valores: los mismos ocho objetos, los mismos selectores, los mismos volume claims.

```bash
helm repo update hotloop
helm upgrade <release> hotloop/hotloop --version {{hotloop}} --reset-then-reuse-values
```

`--reset-then-reuse-values`, o su archivo de valores con `-f`. `--reuse-values` a secas se genera bien esta vez, pero repite los valores de 4.17.0 y descarta todos los valores por defecto que añadió esta versión, que es como acaba en el límite de cola antiguo de abajo sin querer.

### Qué pasa en el primer arranque desde 4.17.0

- **Se ejecutan las migraciones 0016 a 0025:** `0016_mqtt_discovery`, `0017_broker_logins`, `0018_mqtt_sources`, `0019_historian_targets`, `0020_net_finds`, `0021_mqtt_source_dialects`, `0022_mqtt_source_shelly`, `0023_dashboards` (la tabla donde se guardan los paneles que usted construye) y `0024_tag_no_data` (una columna `no_data` en los tags, vacía en todos los tags que ya existen, que es lo que esos tags ya hacían) y `0025_kiosk_pin` (columnas para un hash de PIN, el límite de inactividad de una sesión y los contadores de bloqueo). Todas aditivas. `pg_dump` primero, como siempre.
- **`edgePublish.queueMaxBytes` vale por defecto 64 MiB, no ilimitado.** Solo importa si publica hacia arriba por Sparkplug. Pasado el límite se descartan las lecturas más antiguas y se cuentan. Una cola ilimitada llena el volumen en una caída lo bastante larga, que es peor, pero es un valor por defecto cambiado. 64 MiB son unas 248,000 lecturas, unos dos minutos a 2,000 lecturas por segundo, así que dimensiónelo con su propia tasa (unos 240 bytes por lectura), o póngalo en `0` para el comportamiento antiguo. HotLoop avisa al arrancar cuando lo hace. Una versión actualizada con `--reuse-values` conserva lo que tuviera.
- **Accesos al broker.** Los accesos de `HOTLOOP_BROKER_USERS` siguen sirviendo para todo, como antes, porque nadie debería actualizar hacia una planta cuyo tráfico Sparkplug rebota contra reglas que nunca escribió. Los accesos que crea en Ajustes, MQTT llevan reglas de tema de un perfil. Un broker sin `HOTLOOP_BROKER_USERS` ahora arranca, y solo entran HotLoop y los accesos creados en él.
- **La base de datos pasa de PostgreSQL 16 a 17 en este primer arranque,** por sí sola, y necesita espacio libre en disco. [La sección de 4.18.10](#actualizar-desde-41810) cuenta cómo va, y esa es la parte que hay que leer primero.
- **Volver a 4.17.0 ahora es un intercambio de base de datos, no un `helm rollback`.** El esquema solo creció y 4.17.0 funciona con él, pero la base de datos de 4.17.0 es PostgreSQL 16 y no abre el directorio 17 que dejó la actualización; el intercambio de vuelta está en la sección de 4.18.10. Haga una copia de seguridad antes de actualizar de todos modos. A partir de aquí la aplicación también cuenta cuánto se adelanta su base de datos, y se niega a arrancar, nombrando las dos versiones, cuando la base de datos va dos versiones por delante.
- **¿Quiere otro producto?** De IoT a Edge y al Gateway se conservan todos los dispositivos, tags, entidades, automatizaciones, alarmas, usuarios y horas de historial. Haga una copia de seguridad y luego `helm upgrade hotloop hotloop/hotloop-edge` sobre la misma release. [La gama](/es/products/) tiene el cómo. Bajar de producto no es un movimiento para hacer en un equipo que le importa.

### El Edge Relay y Quadlet

Actualice también el chart del relé con `--reset-then-reuse-values`. Los usuarios de Quadlet toman el nuevo `edge-relay.container`: sigue `:stable` en lugar de fijar 4.17.0, y lleva el healthcheck y `--sdnotify=healthy` que hacen que una mala actualización se revierta. Sin esos dos, una actualización muerta se informa como un éxito. Un archivo de dispositivos enviado desde el Gateway se aplica en vivo ahora, sin reinicio, mientras que en 4.17.0 esperaba uno. [La página de instalación del Edge Relay](/es/edge-relay/install/) tiene la unidad completa.

El Gateway tiene ahora unidades Quadlet, que 4.17.0 no tenía. Están en el directorio `gateway/` de [Podman Quadlet](/es/install/quadlet/), y [la página de instalación del Gateway](/es/gateway/install/#podman-quadlet) tiene los pasos.

### Cambios de la API desde 4.17.0

- **Rutas nuevas:** `/api/discovery` y sus acciones `accept`, `ignore`, `unignore` y `review`, `/api/network-discovery` y sus `probe`, `accept`, `ignore` y `unignore`, `/api/mqtt/brokers`, `/api/broker/logins`, `/api/historian/targets`, `GET /api/entities/{entity_id}/image` y `POST /api/fleet/{id}/update`, que aprueba la actualización de imagen que retiene un relé. No se quitó nada.
- **`GET /api/status` dice `product` y `features`,** y el digest de la imagen. Un script pregunta en lugar de sondear. Una ruta de una función que el producto no tiene responde `404` con `{"error":...,"product":...,"feature":...}`.
- **Permiso nuevo:** `fleet.update`, solo administrador. El rol de operador no cambió.

## Actualizar desde 4.16.0

Este es el salto a 4.17.0, y desde 4.17.0 se sigue a {{hotloop}} con [la sección de arriba](#actualizar-desde-4170). Todo lo de abajo se probó contra 4.17.0.

Por qué hacerlo: 4.16.0 tiene errores con los que una planta en marcha puede tropezar, y 4.17.0 los corrige. La línea de comandos puede tragarse un Set, así que un operador ve cerrarse la línea, da por enviado el setpoint, y no se escribió nada. Guardar una regla en el editor, aunque solo sea para renombrarla, restablece sin avisar su presupuesto de ejecución a cinco minutos. Un archivo de dispositivos enviado a un Edge Relay nunca llega, mientras el Gateway dice `config pushed`. Y un despliegue desde la App Store de EmberNet pierde su tenant. Además de las correcciones obtiene [recetas](/es/iot/recipes/), [scripts](/es/iot/scripts/), [blueprints](/es/iot/blueprints/), [ayudantes](/es/iot/helpers/), el [libro de registro](/es/iot/logbook/), los nuevos pasos de [automatización](/es/iot/automations/), [UniFi](/es/iot/unifi/) en solo lectura, y [MCP](/es/iot/mcp/) pasando de 16 herramientas a 25.

Es un simple `helm upgrade`. Generamos los dos charts en las dos versiones: todos los selectores y todos los volume claims son idénticos, y el único objeto nuevo es el Secret de la clave.

```bash
helm upgrade <release> https://hotloop.io/hotloop/hotloop-4.17.0.tgz --reset-then-reuse-values
```

`--reset-then-reuse-values`, o su archivo de valores con `-f`. **No `--reuse-values`.** Eso repite los valores de 4.16.0 y descarta todos los valores por defecto que añadió este chart, y la generación muere en el primero que necesita (`nil pointer evaluating interface {}.enabled`, por `secretKey`). No cambia nada en el clúster cuando pasa, así que ejecútelo de nuevo de la forma correcta.

### Qué pasa en el primer arranque

Lo comprobamos ejecutando la imagen publicada de 4.16.0 sobre una base de datos, y luego 4.17.0 sobre la misma.

- **Se ejecutan las migraciones 0009 a 0015:** `0009_helpers`, `0010_logbook`, `0011_scripts`, `0012_tag_device_class`, `0013_recipes`, `0014_blueprints` y `0015_unifi`. Todas aditivas. En una planta vacía tardaron una quinta parte de un segundo. En la suya tardan lo que tarde su base de datos. `pg_dump` primero, como siempre.
- **Las contraseñas de sus dispositivos se cifran.** El chart crea `<release>-secret-key` en esta actualización (no existía en 4.16.0), y el Gateway sella todas las credenciales guardadas en ese arranque y lo dice en su registro: `encrypted stored device credentials devices=N`. Los dispositivos siguen conectando, y nadie tiene que volver a escribir nada.
- **Desde entonces, esa clave es parte de sus datos.** Si arranca el Gateway sin ella, todo dispositivo con una contraseña sellada se queda caído, reintentando, con un error que nombra la clave que necesita. Una copia de seguridad hecha después de la actualización solo se restaura donde esa clave está montada, y `--restore-from` la rechaza por su nombre en cualquier otro sitio. Si la clave se pierde para siempre, `--restore-keep-unreadable-credentials` recupera todo lo demás y deja esos dispositivos caídos hasta que alguien vuelva a escribir las contraseñas. Una copia de 4.16.0 se restaura en cualquier sitio, y sus credenciales se sellan en cuanto termina la restauración.
- **Volver a 4.16.0** sobre la misma base de datos arranca (lo probamos), pero 4.16.0 no sabe nada del sellado. Entrega a cada dispositivo el texto sellado como contraseña, así que todo lo que comprueba una contraseña la rechaza. Si tiene que volver, restaure el `pg_dump` que hizo antes de la actualización. Para eso lo hizo.
- **¿Genera el chart en lugar de instalarlo?** La clave la genera un `lookup` que solo puede hacer un `helm install` o `helm upgrade` de verdad. Todo lo que ejecuta `helm template` y aplica el resultado obtiene una clave nueva en cada generación, y la siguiente sincronización deja fuera todas las contraseñas selladas. Cree su propia clave con `hotloop gen-secret-key`, métala en un Secret que usted gestione y ponga `secretKey.existingSecret`. Helm, Fleet y la App Store de EmberNet instalan de verdad y no necesitan esto.

Así que el trabajo nuevo tras esta actualización: respalde `<release>-secret-key` como respalda el resto de los secretos del clúster, y guárdela en un sitio distinto de al lado de sus copias de seguridad. Una clave junto a las copias que protege no protege nada. [Instalar](/es/gateway/install/#haga-copia-de-la-clave-antes-de-necesitarla) tiene el resto de lo que cubre la clave.

### El Edge Relay

El relé también es 4.17.0, publicado desde la misma etiqueta. Actualice su chart a 4.17.0, por el mismo tipo de URL, `https://hotloop.io/hotloop/hotloop-edge-relay-4.17.0.tgz`, y con la misma regla de opción: `--reset-then-reuse-values` o su archivo de valores. `--reuse-values` en el relé ni siquiera falla. Descarta el nuevo valor por defecto `pushedDevicesFile` del chart, genera la variable vacía, y un envío vuelve a morir en el montaje de solo lectura. Luego sepa cuatro cosas.

- **Un archivo de dispositivos enviado vive en `/data/pushed-devices.json`** (`HOTLOOP_EDGE_RELAY_PUSHED_FILE`, el `pushedDevicesFile` del chart), en el volumen del relé. Gana a los `devices` del chart mientras exista, a través de reinicios, reprogramaciones y un `helm upgrade` que cambie `devices`. El relé registra de qué archivo arrancó. Para volver al archivo local, `DELETE /api/fleet/{id}/config` en el Gateway (`fleet.config`) mientras el relé está conectado, y luego reinícielo. Ese reinicio es de 4.17.0. Desde 4.18.10 un relé conectado vuelve al instante.
- **Un envío antiguo puede volver.** Un envío que hizo a un relé 4.16.0 nunca llegó, pero el broker aún lo guarda, retenido, y un relé 4.17.0 lo recoge en su primer arranque y lo ejecuta. Si está obsoleto, bórrelo con el mismo `DELETE` justo después de la actualización y reinicie el relé. Desde 4.18.10 el borrado se aplica en vivo y no hace falta el reinicio.
- **Quadlet: tome el nuevo `edge-relay.container`.** La unidad de 4.17.0 fijaba 4.17.0 y ponía `HOTLOOP_EDGE_RELAY_PUSHED_FILE`, y la actual también lo pone, pero sigue `:stable` en su lugar. Sin esa línea un envío sigue fallando en la raíz de solo lectura. [La página de instalación del Edge Relay](/es/edge-relay/install/#quadlet) tiene la unidad completa.
- **`persistence.enabled=false` arranca ahora,** sobre un emptyDir limitado a `persistence.size`. Sepa lo que cuesta antes de elegirlo: cada vez que se reemplaza el pod pierde la cola de reenvío, cualquier archivo de dispositivos enviado y el certificado de cliente OPC UA. Todo lo que le importe se queda en un PVC, que es lo habitual.

### Qué notará un script contra la API

- **Una hora que no ha ocurrido se omite.** No `null`, se omite. 4.16.0 enviaba `0001-01-01T00:00:00Z` en `lastRun` de una regla o script que nunca se ejecutó, `lastPoll` y `lastGood` de un dispositivo nunca consultado, `clearedAt`, `ackedAt` y `shelvedUntil` de una alarma vigente, `raisedAt` de una nunca activada, los mismos campos en el evento `alarm` del flujo en vivo, y alguno más. Así es como una regla que nunca se había ejecutado decía "Última ejecución hace 739887d". Si su código comprueba el año uno, compruebe que el campo esté presente.
- **Los operadores reciben permisos nuevos en cuanto actualiza:** `helpers.write`, `scripts.run`, `recipes.apply` y `blueprints.apply`. Así que sus operadores pueden fijar ayudantes, ejecutar scripts, aplicar recetas y crear reglas desde blueprints enseguida. Escribir scripts, recetas y blueprints (`scripts.write`, `recipes.write`, `blueprints.write`) es de administrador. Todos los leen. Una receta también puede nombrar su propio `recipes.apply.<name>`.
- **Rutas nuevas:** `/api/helpers`, `/api/logbook`, `/api/scripts`, `/api/recipes`, `/api/blueprints`, `POST /api/automations/{id}/blueprint-upgrade`, las de UniFi (`/api/devices/{id}/network` y `/api/unifi/{id}/...`) y `DELETE /api/fleet/{id}/config`.
- **Los tags llevan `deviceClass`**, y pasa a sus entidades.
- **Las reglas llevan `blueprintId`, `blueprintVersion` y `blueprintInputs`.** Una regla escrita a mano no tiene ninguno. Guardar una regla sigue reemplazándola entera, y un cuerpo no puede mover una regla a otro blueprint ni a otra versión.

## Actualizar desde 4.3.1

4.3.1 se publicó en agosto, y nada después se publicó hasta 4.16.0. Todo desde 4.4.0 hasta 4.15.3 se integró y nunca se publicó, así que al dejar 4.3.1 lo recibe todo en un solo salto, con un nombre nuevo, una imagen nueva, un chart nuevo y una licencia nueva. Esta sección le lleva a 4.16.0, la versión contra la que se probó este procedimiento. Desde ahí, [Actualizar desde 4.16.0](#actualizar-desde-4160) arriba es la actualización simple a 4.17.0, y [Actualizar desde 4.17.0](#actualizar-desde-4170) es la siguiente. Lea las tres antes de tocar una planta en marcha. Son cortas, y más cortas que explicarle al jefe de planta por qué el historiador está vacío.

### Nombre nuevo en todo

| Qué | 4.3.1 | 4.16.0 y posteriores |
|---|---|---|
| Imagen | `ghcr.io/embernet-ai/industrial-iot` | `ghcr.io/hotloop-io/hotloop` |
| Repositorio de charts | la dirección antigua, ahora un 404 | `https://hotloop.io/hotloop` |
| Chart | `industrial-iot` | `hotloop` |
| Variables de entorno | `IIOT_*` | `HOTLOOP_*` (desde 4.9.0) |

### No es un simple helm upgrade

El nombre del chart está metido en los selectores del Deployment y del StatefulSet, y Kubernetes se niega rotundamente a cambiar un selector en el sitio. Apunte la release antigua al chart nuevo y simplemente falla. Conserve el nombre de la release y el namespace, y:

1. Haga `pg_dump` de la base de datos. Cinturón y tirantes. Se alegrará de haberlo hecho.
2. Borre el Deployment antiguo (`<release>`) y el StatefulSet (`<release>-postgresql`). El volumen de la base de datos es su propio claim, y se queda donde está.
3. Añada el repositorio y actualice con el archivo de valores con el que ejecutaba 4.3.1:

   ```bash
   helm upgrade <release> https://hotloop.io/hotloop/hotloop-4.16.0.tgz \
     -n <namespace> -f your-4.3.1-values.yaml
   ```

   Ese es el chart 4.16.0 por su URL, que funciona antes de añadir el repositorio. Una vez en 4.16.0, añada el repositorio (`helm repo add hotloop https://hotloop.io/hotloop`) para los saltos siguientes.

   Nada de ese archivo se quitó del chart. Renombre todo `IIOT_` de `extraEnv` a `HOTLOOP_`, y quite un override de `image.repository` si lo tenía. No use `--reuse-values`. Se salta todos los valores por defecto que este chart añadió desde 4.3.1, que son más de la mitad de sus claves, y acabaría ejecutando un chart que es casi todo agujeros.

Los nombres, la contraseña de la base de datos del Secret y el volume claim se generan idénticos a los de 4.3.1, así que el nuevo pod de la base de datos monta los datos antiguos. El Gateway migra el esquema hacia delante al arrancar, y de paso actualiza TimescaleDB de 2.29.1 a 2.30.1.

Lo comprobamos generando los dos charts lado a lado. El paso 1 es su camino de vuelta: si la actualización le sorprende, tiene un volcado de hace cinco minutos, y queremos saberlo en [helpdesk@fireballz.ai](mailto:helpdesk@fireballz.ai).

### Qué se comporta distinto

- **Hay un inicio de sesión.** Antes de 4.4.0 no había ninguno. El chart crea una cuenta `admin` en la primera instalación; [Instalar](/es/gateway/install/#iniciar-sesión) tiene el comando que lee la contraseña.
- **Las escrituras vienen desactivadas por defecto**, agentes incluidos, desde 4.4.0. Si su archivo de valores de 4.3.1 nunca puso `safety.allowWrites`, toda escritura que hacían sus operadores y reglas se rechaza tras la actualización hasta que lo ponga. Es deliberado, y es la señal para revisar qué está armado antes de volver a activarlo.
- **Una zona horaria que no carga detiene el arranque.** `HOTLOOP_TIMEZONE` o `TZ` con algo inválido antes funcionaba en UTC sin decir nada, lo que desplaza en silencio cada informe, programación y cambio de turno por horas.
- **Las credenciales de dispositivos se leen como `[redacted]`** para todos los roles, administrador incluido (4.15.1). Guardar un dispositivo con el marcador conserva la contraseña guardada.
- **Los ajustes de sondeo son `HOTLOOP_POLL_INTERVAL`, `HOTLOOP_MIN_POLL_INTERVAL` y `HOTLOOP_POLL_TIMEOUT`.** La antigua pantalla de Ajustes decía que pusiera `HOTLOOP_POLL_INTERVAL_MS`, `HOTLOOP_MIN_POLL_INTERVAL_MS` y `HOTLOOP_TIMEOUT_MS`, que nada leía nunca. Si los puso, no hacían nada. Renómbrelos.
- **Los tags OPC UA que importó conservan el tipo con el que se importaron.** Discover tags llamaba float a todos los nodos. Ahora lee el tipo real de cada nodo, pero los tags importados antes conservan `float`, y el propio servidor OPC UA de HotLoop publica un tag con su tipo declarado, así que un tag de texto llega a Ignition como `Bad_TypeMismatch`. Declare sus tags de texto como `string`.
- **Edge publish tiene ahora un bloque de valores.** Si lo puso por `extraEnv`, páselo a `edgePublish:` y quite las variables, o quedan puestos dos veces.
- **El servidor OPC UA dice `HotLoop`** como fabricante, donde versiones anteriores usaban otro nombre de fabricante. Si un cliente o un script de inventario compara con esa cadena, cámbielo antes de que deje de coincidir.
- **La licencia.** Las condiciones cambiaron después de 4.3.1. Las actuales están en [la página de Licencia]({{LICENSE_URL}}).

### Cambios de la API desde 4.3.1

Si tiene un script o una integración contra la API, esta es la lista. Todo lo demás son adiciones. Los cambios de 4.16.0 a 4.17.0 [de arriba](#qué-notará-un-script-contra-la-api) se suman a estos, y los de 4.17.0 a {{hotloop}} [por encima de ellos](#cambios-de-la-api-desde-4170) también.

- **Las listas vacías son `[]`, nunca `null`,** en toda respuesta y todo evento de flujo, a cualquier profundidad. `GET /api/runs`, las automatizaciones, los tags de un dispositivo, la auditoría de escrituras, los usuarios, los eventos de alarma, las sparklines y una ventana de historial vacía respondían `null`. Un `null` que siga viendo nunca es una lista; es un campo documentado que admite null, como el `equipment_id` de una entidad.
- **Los intervalos de `/api/history` sin ninguna lectura buena son `null`,** y se dibujan como huecos, y las lecturas malas quedan fuera de los promedios de tendencia. Una tendencia y un informe sobre la misma hora ahora dicen lo mismo.
- **Un error que la API no sabe ubicar es un 500** con una referencia al registro del servidor, no un 400. Un dispositivo que da error en una escritura o una exploración es un 502. [La compuerta de escritura](/es/gateway/write-gate/#qué-responde-cada-rechazo) tiene todos los estados que puede recibir una escritura.
- **`alarm.turn_on`, y cualquier otro servicio que una entidad de alarma no admite, es un 400** ("unknown service"). Antes respondía éxito y no hacía nada, que es la peor respuesta posible.
- **Quitar de pospuesta una alarma que no está pospuesta es un 409.** Antes ponía la alarma en normal fuera cual fuera su estado, y eso podía borrar de la lista una alarma desaparecida y sin reconocer, justo la alarma que ISA-18.2 existe para mantener en ella.
- **El JSON de un tag siempre lleva `minValue`, `maxValue` y `hasRange`,** y solo `hasRange` dice si hay un rango. Un rango que empezaba en 0 antes parecía no tener mínimo.
- **Nuevo: `?dry_run=true` en `POST /api/services/{domain}/{service}`.** Ejecuta las comprobaciones de la compuerta, no escribe nada, no audita nada y responde con el rechazo que daría la llamada real. `dry_run` admite `true` o `false` y nada más; `yes` es un 400, porque una suposición equivocada convierte una pregunta en una orden.
- **`GET /api/settings`** nombra en `envVar` la variable de la que vino realmente un valor, incluidos los respaldos, y una variable puesta a una cadena vacía cuenta como no puesta.

Las [notas de versión](https://hotloop.io/releases/core/) tienen el resto de lo que cambió, versión por versión hasta 4.4.0. Cuando esté en 4.16.0 y el historiador siga lleno, vaya a [Actualizar desde 4.16.0](#actualizar-desde-4160), y luego a [Actualizar desde 4.17.0](#actualizar-desde-4170).
