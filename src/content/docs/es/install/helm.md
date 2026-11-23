---
title: "k3s y Helm"
description: "Despliegue cualquier chart de HotLoop en k3s o en cualquier Kubernetes: los valores que conviene fijar, la base de datos, las actualizaciones y reversiones."
---

El chart despliega dos cargas de trabajo: el gateway (un Deployment, que no guarda ningún estado duradero propio) y TimescaleDB (un StatefulSet con un volumen). Ese es el valor por defecto. `database.type` elige otra base de datos: PostgreSQL simple, o SQLite, que no es una segunda carga de trabajo en absoluto ([SQLite](#sqlite), más abajo).

## Instalación

Desde la App Store del panel de EmberNet, o directamente:

```bash
helm install hotloop ./charts/hotloop \
  --namespace hotloop --create-namespace
```

O desde el repositorio de charts, que es también la URL a la que apunta la App Store:

```bash
helm repo add hotloop https://hotloop.io/hotloop
helm install hotloop hotloop/hotloop \
  --namespace hotloop --create-namespace
```

Esa segunda forma funciona desde la 4.16.0, la primera versión publicada como `hotloop`. La última anterior fue `industrial-iot` 4.3.1, con el nombre antiguo, y actualizar desde ella es un procedimiento aparte: consulte "Upgrading from 4.3.1" en las notas de la 4.16.0 del README. La dirección antigua del repositorio, `https://embernet-ai.github.io/industrial-iot/`, devuelve un 404.

Una instalación sin ajustes funciona. El chart genera una contraseña de base de datos y un token de MCP en el Secret de la versión y los reutiliza en cada actualización, así que no hay que aportar nada y una actualización no cambia la contraseña bajo una base de datos en marcha.

Llegar a él no requiere ingress ni subdominio. El panel descubre la aplicación por sus etiquetas de la tienda y la sirve mediante proxy en la dirección interna del clúster:

```
<release>.<namespace>.svc.cluster.local:8080
```

Para verlo directamente:

```bash
kubectl -n hotloop port-forward svc/hotloop 8080:8080
```

## Valores que conviene fijar

### Autenticación

Desde la 4.4.0. Consulte [Autenticación y usuarios](/es/iot/authentication/) para el modelo completo; esto es la parte del chart.

```yaml
auth:
  enabled: true    # the default; requires a login
  insecure: false  # set true only for a deployment truly isolated behind the
                    # dashboard's own NetworkPolicy -- see AUTH.md
```

Con `enabled: true` (el valor por defecto) el chart genera una cuenta de administrador en el Secret de la versión en la primera instalación, igual que genera la contraseña de la base de datos y el token de MCP, y la reutiliza en las actualizaciones:

```bash
kubectl get secret hotloop -n hotloop \
  -o jsonpath='{.data.admin-password}' | base64 -d
```

Fijar `auth.admin.password` explícitamente sustituye a la generada.

### Seguridad

Los valores que deciden si este pod puede mover maquinaria.

```yaml
safety:
  allowWrites: false      # the master switch -- off by default since 4.4.0
  allowMcpWrites: true    # agents (MCP) write wherever an operator could, once writes are on
  confirmWrites: true     # the UI asks before writing
```

Las escrituras están desactivadas por defecto. Una etiqueta es de solo lectura hasta que se activa su propia marca `writable`, un valor fuera del rango configurado de la etiqueta se rechaza (nunca se recorta: enviar 250 cuando alguien escribió 500 es hacer en silencio otra cosa), y cada intento, **incluidos todos los rechazos**, se registra con el actor y el origen. Pero una instalación nueva no debería necesitar que las tres cosas coincidan para ser segura, así que el interruptor general empieza cerrado.

Para activar las escrituras una vez revisado el despliegue:

```yaml
safety:
  allowWrites: true
```

Eso es todo: los clientes MCP leen y escriben como lo hace un operador, con los mismos permisos, etiquetas escribibles y rangos. `allowMcpWrites` viene activado en todos los charts; existe para un despliegue que decida otra cosa, y no es un valor por defecto en ninguna parte.

### Historiador

```yaml
historian:
  retentionDays: 90     # 0 keeps everything until the volume fills
  useTimescale: true

logbook:
  retentionDays: 90     # entity state changes; 0 keeps everything (see LOGBOOK.md)

database:
  postgresql:
    persistence:
      size: 20Gi
      storageClass: longhorn
```

El dimensionamiento depende del número de etiquetas, la frecuencia de lectura y las bandas muertas. Mil etiquetas a un segundo sin bandas muertas son unos 86 millones de filas al día; la misma planta con bandas muertas razonables suele tener un orden de magnitud menos. Fije las bandas muertas antes de comprar almacenamiento.

`useTimescale: false` fuerza la ruta de particionado nativo, que es como se ve ejecutarse contra un PostgreSQL simple. Útil para reproducir un despliegue en el borde.

**Cuando cambia la imagen de TimescaleDB.** La imagen lleva la biblioteca de todas las versiones anteriores, así que una base de datos creada con una imagen anterior sigue funcionando con la nueva, pero con la versión antigua de la extensión, y se queda ahí hasta que alguien ejecuta `ALTER EXTENSION timescaledb UPDATE`. El Gateway lo hace al arrancar: compara la versión instalada con la que trae el servidor y, si difieren, ejecuta la actualización como primera sentencia de una conexión nueva (TimescaleDB la rechaza en una sesión que ya cargó la versión antigua). El registro dice `timescaledb extension updated from=... to=...`. Eso necesita un superusuario, que lo es el usuario de la base de datos incluida. Con una base de datos externa o gestionada donde no lo es, aparece una advertencia con el comando que hay que ejecutar, y el historial sigue funcionando con la versión antigua mientras tanto. Solo ocurre con `useTimescale` activado y las migraciones ejecutándose al arrancar (`HOTLOOP_DB_MIGRATE`, activado por defecto).

### Sondeo

```yaml
runtime:
  defaultPollIntervalMs: 1000
  minPollIntervalMs: 100      # a floor applied to every device
  timeoutMs: 10000
  maxConcurrentPolls: 32
```

`minPollIntervalMs` se hace cumplir en lugar de confiar en él. Un sondeo de 10 ms contra un gateway serie es una denegación de servicio con pasos extra.

### Cliente OPC UA

```yaml
opcuaClient:
  persistence:
    enabled: true      # off by default
    size: 64Mi
```

Un dispositivo que se conecta a un servidor OPC UA seguro, o que inicia sesión con un usuario y una contraseña que el servidor exige cifradas, guarda un certificado y un almacén de confianza de certificados de servidor aprobados (`HOTLOOP_OPCUA_CLIENT_PKI_DIR`, `/data/opcua-client-pki`). Active esto antes de añadir un dispositivo así: el sistema de archivos raíz es de solo lectura, así que sin el volumen el dispositivo informa de un error que lo dice en lugar de conectarse con certificados que se perderían en el siguiente reinicio. Está desactivado por defecto porque añade un PersistentVolumeClaim a una instalación existente, que se queda en Pending en un clúster sin StorageClass por defecto. Los dispositivos anónimos en un canal sin protección no lo usan. Aprobar el certificado de un servidor, y todo lo demás sobre estos dispositivos, está en [Protocolos y drivers](/es/iot/protocols/#opc-ua-security-and-credentials).

### Red

```yaml
networkPolicy:
  enabled: true
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: dashboard-system
      ports:
        - protocol: TCP
          port: 8080
```

Limite el ingress al namespace del panel cuando lo conozca. El egress es deliberadamente ilimitado: esta aplicación existe para llegar a equipos en direcciones que nadie puede enumerar de antemano, y una política de egress que bloquea un sondeo en silencio parece un driver roto en lugar de una regla de firewall.

### Hardware: radios USB, adaptadores serie y Bluetooth

Desde la 4.19.7 todos los charts de HotLoop (Gateway, IoT, Edge y el Edge Relay) traen activado el acceso que necesita el hardware, de modo que una instalación simple desde la App Store o desde helm ve lo que está conectado al nodo sin ninguna edición a mano, en la red de pods. Es el bloque `hardware:` de `values.yaml`: tres interruptores activados por defecto y uno opcional desactivado:

| Valor | Por defecto | Qué hace |
|---|---|---|
| `hardware.privileged` | `true` | El contenedor de la aplicación se ejecuta privilegiado (`privileged: true`, `allowPrivilegeEscalation: true`) y como root (`runAsUser: 0`, `runAsNonRoot: false`, sin eliminar capacidades). Root porque un nodo serie USB es `root:dialout 0660` y la política D-Bus de BlueZ deja entrar a root y al grupo `bluetooth`; un usuario de contenedor que no esté en ninguno no abre nada. El sistema de archivos raíz sigue siendo de solo lectura, y el contenedor de inicio y la base de datos incluida mantienen su propio contexto sin root y sin capacidades. |
| `hardware.usbDevices.enabled` | `true` | El `/dev` del nodo (`hardware.usbDevices.hostPath`) se monta en `/dev`: adaptadores serie USB (`/dev/ttyUSB*`, `/dev/ttyACM*`, `/dev/serial/by-id/*`), incluso uno conectado después de arrancar el pod. A un contenedor privilegiado solo se le entregan los dispositivos que existían al arrancar; el montaje es lo que hace aparecer un adaptador reconectado. |
| `hardware.bluetooth.enabled` | `true` | El directorio D-Bus del nodo (`hardware.bluetooth.dbusPath`, `/run/dbus`, que contiene `system_bus_socket`) se monta en la misma ruta, de modo que un cliente llega al BlueZ del nodo. Se crea vacío en un nodo sin D-Bus, así que el pod arranca igualmente allí. |
| `hardware.bluetooth.hostNetwork` | `false` | La opción voluntaria, desactivada por defecto, para lo que necesita la red del nodo: los sockets Bluetooth del kernel (HCI, L2CAP) existen solo en el espacio de red del nodo, así que un cliente que abre uno directamente, y el descubrimiento que escucha en la red propia del nodo (mDNS, SSDP, el multicast de una radio), lo necesitan. Un cliente que usa la API D-Bus de BlueZ solo necesita el socket montado y funciona desde la red de pods. Activado, el pod se ejecuta en la red del nodo con las consecuencias descritas en [Red](#red). |

Qué hace HotLoop con ello hoy: todavía nada. HotLoop no tiene código propio de Bluetooth, Z-Wave ni serie USB (Zigbee llega por un puente Zigbee2MQTT sobre MQTT, consulte [el broker MQTT integrado](/es/iot/broker/)); es el acceso que necesita una función, o un sidecar que lea una radio, ya preparado antes de que se pida.

Lo que cuesta, a propósito y decidido: el pod es root en el nodo (privilegiado, con el `/dev` del nodo), y la NetworkPolicy por defecto del chart sigue activada para lo que cubre. El pod permanece en la red de pods. Desactive cualquier parte con `--set hardware.privileged=false --set hardware.usbDevices.enabled=false --set hardware.bluetooth.enabled=false`; con las tres desactivadas el resultado es, línea por línea, el pod que renderizaba la 4.19.6 (sin root, todas las capacidades eliminadas, raíz de solo lectura, red de pods). Para lo que necesita la red del nodo, fije `hardware.bluetooth.hostNetwork=true` (o `hostNetwork=true`): la página responde entonces en todas las direcciones del nodo en `service.targetPort`, un HotLoop por nodo y por puerto, una NetworkPolicy no se aplica al pod, y `nodeSelector` lo fija al nodo cuya radio debe ver.

### Despliegues en el borde

La imagen de la aplicación se construye para amd64 y arm64, y TimescaleDB 2.30.1-pg17 es multiarquitectura, así que el historiador no es lo que impide una instalación en el borde.

```yaml
resources:
  requests: {cpu: 100m, memory: 128Mi}
  limits:   {cpu: 500m, memory: 256Mi}

database:
  postgresql:
    persistence: {size: 5Gi}
    resources:
      requests: {cpu: 100m, memory: 256Mi}
      limits:   {cpu: 500m, memory: 512Mi}

historian:
  retentionDays: 30

nodeSelector:
  kubernetes.io/arch: arm64
```

### Publicar hacia arriba con Sparkplug

Un Gateway del borde también puede publicar todo lo que lee en uno central, como nodo de borde Sparkplug B. Consulte [Publicación en el borde y almacenamiento y reenvío](/es/edge/edge-publish/) para saber qué publica y cómo se comporta la cola de reenvío; esto es la parte del chart.

```yaml
edgePublish:
  enabled: true
  broker: tcp://central.example.local:1883
  group: Plant1
  node: press-line-3          # empty uses the release name
  username: press-line-3
  existingSecret: central-mqtt # key "password", or set secretKey
  tls: false
  queueMaxBytes: 536870912     # 512 MiB; the default is 64 MiB, and 0 is unbounded
  persistence:
    size: 1Gi
```

Qué cambia al activarlo, y por qué:

- **Un PVC de 1Gi para la cola de reenvío**, montado en `/data/edge-publish`. Ahí se acumulan las lecturas mientras el enlace ascendente está caído, así que tiene que sobrevivir al pod. `persistence.enabled: false` lo pone en un emptyDir, que sobrevive a un reinicio del contenedor y a nada más.
- **El Deployment se actualiza con `Recreate`.** La cola es un solo archivo con un bloqueo. Una actualización progresiva arranca primero el pod nuevo, el pod nuevo no puede abrir la cola, nunca queda listo y el despliegue se queda esperando para siempre. Recreate detiene primero el antiguo; se pierden unos segundos de sondeo por actualización.
- **`replicaCount` tiene que ser 1**, y el chart se niega a renderizar si no. Dos réplicas serían dos publicadores reclamando un mismo nodo Sparkplug.
- **El id del nodo es por defecto el nombre de la versión**, no el nombre de host del pod. El nombre de host cambia en cada despliegue, y un host Sparkplug vería un nodo de borde nuevo cada vez.

La contraseña nunca va en un valor por defecto en texto plano. Deje `password` y `existingSecret` vacíos para un broker anónimo y no se crea ningún Secret; fije `password` y el chart la pone en `<release>-edge-publish`; fije `existingSecret` para usar uno que gestione usted.

### Base de datos externa

```yaml
database:
  postgresql:
    enabled: false
    auth:
      existingSecret: my-db-credentials
      secretKey: password
  external:
    host: timescale.plant.local
    port: 5432
    database: industrial
    username: industrial
  sslMode: require
```

La aplicación detecta TimescaleDB y convierte `tag_history` en una hypertable cuando la extensión está presente. Contra un PostgreSQL simple recurre al particionado por rangos nativo en lugar de fallar.

La decisión queda registrada y es **fija**. Una base de datos creada como hypertable se niega a arrancar contra un servidor sin la extensión en lugar de escribir en silencio en otro sitio; si ve ese error, ha apuntado la aplicación a una base de datos distinta de aquella sobre la que se construyó.

### SQLite

La base de datos es un ajuste, no una imagen. Cada producto funciona con SQLite, Postgres o TimescaleDB desde el mismo binario (IoT omite TimescaleDB, véase más abajo):

| Variable | Por defecto | Qué hace |
|---|---|---|
| `HOTLOOP_DB_TYPE` | `postgres` | `postgres` o `sqlite`. TimescaleDB es `postgres` con la extensión en el servidor |
| `HOTLOOP_DB_PATH` | `/data/hotloop.db` | El archivo SQLite. Solo SQLite lo lee |

SQLite es la versión pura en Go (`modernc.org/sqlite`), compilada en cada imagen, así que no hay segundo contenedor, ni una imagen de Postgres de 300 MB en una tarjeta SD, y las compilaciones arm siguen siendo estáticas. Ponga el archivo en un volumen que sobreviva al contenedor, y en una Pi ponga ese volumen en un SSD USB. Un historiador escribiendo todo el día en una tarjeta SD es la forma de comprar muchas tarjetas SD.

Lo que es igual: cada tabla, cada columna, cada función. Lo que es distinto:

- El historial es una tabla con un índice, no particiones ni una hypertable, y la retención borra filas antiguas en lugar de descartar meses. Un sitio con años de historial a un segundo necesita Postgres o TimescaleDB, y pasar a ellos es una copia de seguridad y una restauración (BACKUP.md).
- Un solo escritor a la vez. SQLite se turna en las escrituras y lee junto a ellas (WAL), lo que sobra para un HotLoop y un ayudante `--mcp-stdio` a su lado en el mismo archivo. No es para dos réplicas en almacenamiento de red: SQLite en NFS se corrompe, así que un despliegue con SQLite es un pod con un volumen local.
- Las confirmaciones son `synchronous=FULL`: cuando la API dice que guardó, está en disco, haya o no un corte de energía.

**HotLoop IoT** usa por defecto 30 días de historial (`HOTLOOP_HISTORIAN_RETENTION_DAYS` sigue mandando cuando se fija) y nunca crea una hypertable: TimescaleDB forma parte de Edge y del Gateway. Si fija `HOTLOOP_HISTORIAN_TIMESCALE=true` en IoT, lo dice al arrancar y funciona con particiones simples. Una base de datos bajada desde un Edge o un Gateway que ya tiene una hypertable la conserva y sigue funcionando.

#### Elegir la base de datos en el chart

Un valor, `database.type`, y cada producto acepta aquellos sobre los que funciona:

| `database.type` | Qué se despliega | IoT | Edge | Gateway |
|---|---|---|---|---|
| `timescaledb` | La aplicación y TimescaleDB (un StatefulSet y su volumen). Historial en una hypertable | rechazado | por defecto | por defecto |
| `postgresql` | La aplicación y PostgreSQL 17 simple (un StatefulSet y su volumen). Historial en particiones nativas | por defecto | sí | sí |
| `sqlite` | La aplicación sola, con el archivo de base de datos en un volumen propio | sí | sí | sí |

```bash
helm install hotloop hotloop/hotloop-iot --namespace hotloop --create-namespace   --set database.type=sqlite
```

Pedir `timescaledb` a IoT hace fallar la instalación y dice sobre qué funciona IoT (`database.type is "timescaledb", and HotLoop IoT runs on sqlite, postgresql`), y el formulario de la App Store no lo ofrece. `helm lint` no lo detecta (helm 3.22 lo da por correcto), así que lo que lo rechaza es el renderizado. Omitir `database.type` es el valor por defecto del propio producto, así que una actualización con `--reuse-values` desde antes de que existiera la clave conserva la base de datos que tenía.

`sqlite` renderiza:

- `HOTLOOP_DB_TYPE=sqlite` y `HOTLOOP_DB_PATH=/data/db/hotloop.db`, y ninguno de los ajustes de conexión de Postgres. Sin pod de base de datos, sin contraseña de base de datos en el Secret, sin contenedor de inicio esperando una.
- Un PersistentVolumeClaim llamado `<release>-db` (`database.sqlite.persistence`: `size`, `storageClass`, `accessMode`, 10Gi y el valor por defecto del clúster para empezar), montado en `/data/db`. El directorio, no el archivo: SQLite guarda un `-wal` y un `-shm` junto a la base de datos. Póngalo en almacenamiento local; SQLite en NFS se corrompe.
- El Deployment en `Recreate`, no en actualización progresiva, porque el volumen es `ReadWriteOnce` y el archivo tiene un solo escritor. Un `replicaCount` superior a 1 hace fallar la instalación.

La NetworkPolicy no cambia y sigue activada: la política propia de la aplicación sigue aplicándose, y la política de la base de datos solo se renderiza cuando hay un pod de base de datos que proteger.

Cambiar `database.type` en una versión que ya tiene datos no mueve los datos. La nueva base de datos empieza vacía, así que pasar una planta de una base de datos a otra es una copia de seguridad y una restauración (BACKUP.md), igual que con la variable. En particular, una base de datos creada como hypertable de TimescaleDB se niega a arrancar contra PostgreSQL simple, así que no cambie un Edge o un Gateway existente de `timescaledb` a `postgresql` esperando que arranque.

#### Elegir la base de datos en Quadlet

El directorio de cada producto bajo `deploy/quadlet/` tiene los archivos de PostgreSQL o TimescaleDB como estaban, y un directorio `sqlite/` a su lado: `hotloop.container` y `hotloop-data.volume`, la aplicación sola con el archivo en `/data/hotloop.db` en el volumen `hotloop-data`. Sigue `:stable` y revierte una mala actualización de la misma manera. Instale esos dos archivos en lugar de los otros (usan los mismos nombres de unidad) y cree dos secretos en lugar de tres: no hay contraseña de base de datos. [`deploy/quadlet/README.md`](/es/install/quadlet/) tiene los pasos.

Para particiones simples de Postgres en Edge o en el Gateway con Quadlet, conserve la unidad de TimescaleDB y añada `Environment=HOTLOOP_HISTORIAN_TIMESCALE=false` a `hotloop.container`. La unidad de IoT ya ejecuta PostgreSQL simple.

### La clave de credenciales de dispositivos

```yaml
secretKey:
  enabled: true
  existingSecret: ""     # or a Secret you manage, with the key under secret.key
```

Las contraseñas de dispositivos (el acceso a una consola UniFi, una contraseña de OPC UA o MQTT, claves de API HTTP) se cifran en la base de datos con esta clave, así que un volcado o una copia de seguridad contiene texto cifrado. De fábrica el chart genera una en `<release>-secret-key` en la primera instalación, la conserva en las actualizaciones y también la conserva con `helm uninstall` (`helm.sh/resource-policy: keep`), porque una base de datos conservada en su volumen no sirve para sus credenciales sin ella. Se monta como archivo y se pasa como `HOTLOOP_SECRET_KEY_FILE`, nunca como variable de entorno.

Haga copia del Secret por separado de las copias de la base de datos: una clave junto a las copias que protege no protege nada. Para traer la suya, `hotloop gen-secret-key` imprime una. Fuera de Kubernetes, escríbala en un archivo que solo HotLoop pueda leer y apunte `HOTLOOP_SECRET_KEY_FILE` a él. Sin clave HotLoop funciona, dice en su registro de arranque que las contraseñas de dispositivos se guardan tal como se escribieron, y se niega a guardar una consola UniFi. Las credenciales ya guardadas se cifran la primera vez que arranca con una clave. Consulte [Copias de seguridad y restauración](/es/iot/backup/#credenciales-de-dispositivos-y-la-clave-secreta) para saber qué significa eso en una restauración.

## Configuración, y lo que puede cambiar la pantalla de Ajustes

Casi todos los ajustes vienen de una variable de entorno que el chart fija a partir de un valor de Helm. Ese es el lugar correcto: la configuración que decide si este proceso puede dar órdenes a maquinaria pertenece al despliegue, revisada, no a un formulario en una página web.

La pantalla de **Ajustes** los muestra todos, cada ajuste, su valor efectivo, si vino de la base de datos, de una variable de entorno o del valor integrado por defecto, y la variable que lo cambia. La mayor parte es de solo lectura, que es el objetivo: la pregunta que responde es "¿por qué hace eso y qué cambio?"

Cuatro ajustes son identidad de la planta y no comportamiento, y se pueden editar ahí. Se guardan en la base de datos y surten efecto de inmediato, porque una planta cambia de nombre con mucha más frecuencia de la que se vuelve a desplegar:

| ajuste | variable a la que sustituye |
|---|---|
| Nombre de la planta | `HOTLOOP_PLANT_NAME` |
| ID del sitio | `HOTLOOP_SITE_ID` |
| Zona horaria | `HOTLOOP_TIMEZONE` |
| Confirmar antes de escribir | `HOTLOOP_CONFIRM_WRITES` |

Bajo los ajustes hay tarjetas que son datos y no configuración, y son editables por la misma razón: **Usuarios** ([Autenticación y usuarios](/es/iot/authentication/)), **Escalado de alarmas**, que dice a quién se avisa a continuación cuando nadie reconoce una alarma y cuándo ([Notificaciones de alarmas](/es/iot/notifications/#escalation)), y los destinos del historiador y los accesos MQTT. Los canales que puede usar un escalado siguen siendo del despliegue, fijados con `HOTLOOP_NOTIFY_*`.

Un valor guardado gana a la variable de entorno, así que el valor del chart pasa a ser el punto de partida y no la última palabra. Una zona horaria que la máquina no puede resolver se rechaza en lugar de aceptarse e ignorarse en silencio, lo que dejaría todas las marcas de tiempo recurriendo a UTC sin que nada dijera por qué.

Lo mismo vale para el propio valor del despliegue. Si `HOTLOOP_TIMEZONE` (o `TZ`, cuando aquella no está fijada) nombra una zona que no se carga, HotLoop se niega a arrancar y el error nombra la variable y el valor. Antes se encogía de hombros y seguía en UTC. Los informes, las programaciones y los horarios de turno se rigen por el reloj de la planta, y una suposición con horas de diferencia es peor que un pod que dice por qué no arranca.

La ubicación del sitio es `HOTLOOP_SITE_LATITUDE` y `HOTLOOP_SITE_LONGITUDE` (chart: `plant.latitude`, `plant.longitude`), en grados decimales, con norte y este positivos. A partir de ellos se calculan en el equipo el amanecer, el atardecer y las entidades y disparadores del sol ([El sol](/es/iot/sun/)). Ambos o ninguno, y uno incorrecto detiene el arranque nombrando la variable. La pantalla de Ajustes los muestra de solo lectura: las reglas se disparan con un amanecer, así que moverlo es un despliegue.

**Los interruptores de seguridad no son editables y no lo serán.** `HOTLOOP_ALLOW_WRITES` es el control maestro de si este proceso puede dar órdenes al equipo; un control que se puede volver a activar desde la misma sesión de navegador que emite las escrituras no es un control. `HOTLOOP_HISTORIAN_RETENTION_DAYS` también es solo del despliegue: la política de retención se aplica a la base de datos al arrancar, así que un campo en una pantalla parecería funcionar y no movería ningún dato. El endpoint rechaza cualquier clave fuera del conjunto editable **por su nombre**, en lugar de ignorarla.

Una limitación, dicha porque la pantalla también la dice: el servidor MCP construye sus instrucciones al arrancar, así que anuncia el nombre de planta con el que arrancó hasta que el pod se reinicia. Todo lo demás recoge un cambio de nombre en la siguiente petición.

## PostgreSQL 17

La base de datos de HotLoop es PostgreSQL 17 (con TimescaleDB 2.30.1 para Edge y el Gateway, PostgreSQL 17.11 simple para IoT y para `database.type: postgresql`). Las versiones anteriores ejecutaban PostgreSQL 16, y PostgreSQL no abre el directorio de datos de otra versión mayor. Por eso el cambio se hace por usted, en la actualización, y no hay nada que ejecutar.

**En el chart,** el pod de la base de datos recibe dos contenedores de inicio. El primero ejecuta la imagen de PostgreSQL 16 y, solo cuando el volumen contiene datos de la 16, copia esa instalación a un volumen temporal. El segundo ejecuta la imagen nueva y hace `pg_upgrade` a un directorio nuevo junto al antiguo. Ambos dejan en paz un volumen nuevo o uno que ya está en la 17. La actualización es `helm upgrade`, nada más. Espere que el pod de la base de datos permanezca en `Init` el tiempo que tarde una copia de los datos, y que la aplicación lo espere; `kubectl logs <release>-postgresql-0 -c pg-upgrade` es el registro.

**En Quadlet,** `hotloop-db-upgrade.container` se ejecuta antes de `hotloop-db.service` y hace lo mismo en una unidad oneshot. Copie el nuevo `hotloop-db.container`, `hotloop-db-upgrade.container` y `hotloop-db-upgrade.sh` del directorio de su producto al directorio de unidades y reinicie la unidad de la base de datos; el [README de Quadlet](/es/install/quadlet/) tiene los comandos. La unidad de la base de datos requiere la unidad de actualización, así que un equipo que solo recibió la nueva unidad de base de datos no arranca sobre datos de la 16 y dice por qué: falla, no adivina. `journalctl -u hotloop-db-upgrade` es el registro. La unidad se ejecuta solo cuando el volumen contiene datos de la 16: en un equipo nuevo, y en cada arranque posterior a la actualización, systemd la omite (aparece como inactiva, no como fallida) y la imagen de PostgreSQL 16 nunca se descarga. Cuando el volumen sí contiene datos de la 16, la unidad descarga primero esa imagen.

Lo que hace, por orden, todo en `hotloop-pg-upgrade.sh` (un solo archivo, el mismo que ejecutan el chart y las unidades):

1. Sin directorio de datos, o con uno ya en la 17: nada, y lo dice. Cualquier otra versión mayor se rechaza, sin cambiar nada.
2. Arranca el servidor antiguo una vez en un socket privado y lo detiene limpiamente, lo que reproduce el registro tras un corte de energía y lee la codificación y la configuración regional que el nuevo clúster tiene que igualar.
3. Hace `initdb` de un directorio nuevo junto al antiguo con esos ajustes, ejecuta `pg_upgrade` en modo copia (el directorio antiguo solo se lee) y traslada `postgresql.conf`, `postgresql.auto.conf`, `pg_hba.conf` y `pg_ident.conf`.
4. Arranca el servidor nuevo una vez para demostrar que abre con los ajustes finales y reúne las estadísticas del planificador que `pg_upgrade` no traslada.
5. Solo entonces intercambia los nombres: el directorio antiguo pasa a ser `pgdata.pg16`, el nuevo `pgdata`.

Necesita aproximadamente tanto espacio libre junto a los datos como ocupan los datos, y lo comprueba antes de empezar. Si algo falla antes del paso 5, la actualización termina con código distinto de cero, los datos de la 16 quedan exactamente como estaban y la base de datos no arranca sobre un directorio a medio construir: en el chart el pod se queda en `Init:Error`, en Quadlet la unidad de actualización falla y la unidad de la base de datos que va detrás nunca arranca. Corrija lo que dice el registro y vuelva a iniciarla; un intento sin terminar se elimina y se rehace. La extensión TimescaleDB pasa con la versión que tenía, y la aplicación la actualiza a la entregada en su siguiente arranque, como siempre. La propia guía de TimescaleDB para una actualización de PostgreSQL in situ es `pg_upgrade` con los binarios antiguo y nuevo ([Tiger Data, "Upgrade PostgreSQL"](https://www.tigerdata.com/docs/deploy/self-hosted/upgrades/upgrade-pg)).

La copia de seguridad es el propio directorio antiguo. `pg_upgrade` en modo copia nunca escribe en él, así que `pgdata.pg16` es toda la base de datos de PostgreSQL 16 tal como estaba, que es mejor copia que un volcado y lo único que hace posible la vuelta atrás descrita abajo. La copia de seguridad propia de HotLoop ([Copias de seguridad y restauración](/es/iot/backup/)) la hace la aplicación en marcha a través de la base de datos en marcha, así que no puede hacerse en el paso que se ejecuta antes de que arranque la base de datos. Haga una igualmente con la versión anterior antes de actualizar, y cópiela fuera del equipo.

### Volver atrás

`helm rollback`, o volver a poner el `hotloop-db.container` anterior, devuelve la base de datos a la imagen de PostgreSQL 16 (la actualización automática de Podman no lo hace: solo mueve la aplicación), y PostgreSQL 16 no abre un directorio de la 17 (`database files are incompatible with server`, el registro dice que el directorio fue inicializado por la versión 16). No se pierde nada y nada queda a medio cambiar; la base de datos simplemente no arranca. Lo que necesita la versión anterior es su propio directorio 16, que es `pgdata.pg16`. Detenga la base de datos y devuelva los nombres:

```sh
# chart: after the rollback, stop the database, swap in a one-off pod, start it
kubectl -n hotloop scale statefulset/hotloop-postgresql --replicas=0
kubectl -n hotloop run pgswap --rm -it --restart=Never --image=busybox \
  --overrides='{"spec":{"securityContext":{"runAsUser":999,"fsGroup":999},"containers":[{"name":"pgswap","image":"busybox","command":["sh","-c","cd /d && mv pgdata pgdata.pg17 && mv pgdata.pg16 pgdata"],"volumeMounts":[{"name":"d","mountPath":"/d"}]}],"volumes":[{"name":"d","persistentVolumeClaim":{"claimName":"data-hotloop-postgresql-0"}}]}}'
kubectl -n hotloop scale statefulset/hotloop-postgresql --replicas=1

# Quadlet: the volume is named hotloop-db
sudo systemctl stop hotloop.service hotloop-db.service
d=$(sudo podman volume inspect hotloop-db --format '{{.Mountpoint}}')
sudo mv "$d/pgdata" "$d/pgdata.pg17" && sudo mv "$d/pgdata.pg16" "$d/pgdata"
```

Esa es la base de datos tal como estaba en la actualización, y nada de lo escrito desde entonces. La vuelta atrás solo funciona una vez: la actualización se niega a ejecutarse mientras haya un `pgdata.pg16` en el camino, así que el siguiente intento de actualización necesita antes `pgdata.pg17` y resolver el directorio antiguo. Avanzar es el camino, y una reversión es para un equipo que no puede ejecutar la 17 en absoluto. La regla de reversión de la propia aplicación no cambia: el esquema del directorio 16 es el que dejó la versión anterior a la actualización, y una versión que encuentra migraciones que no conoce lo dice, consulte [Las migraciones solo añaden](/es/iot/migrations/).

### Cuando esté satisfecho

`pgdata.pg16` permanece hasta que lo borre, porque borrarlo es borrar el único camino de vuelta. Ocupa tanto como la base de datos. Cuando el equipo haya funcionado en la 17 todo el tiempo que quiera:

```sh
# chart
kubectl -n hotloop exec hotloop-postgresql-0 -c postgresql -- rm -rf /var/lib/postgresql/data/pgdata.pg16
# Quadlet
sudo rm -rf "$(sudo podman volume inspect hotloop-db --format '{{.Mountpoint}}')/pgdata.pg16"
```

### Desactivarlo

`database.postgresql.upgrade.enabled: false` elimina los contenedores de inicio. Un volumen que aún esté en la 16 impide entonces que arranque la base de datos, y el cambio queda en sus manos. Déjelo activado: con él activado, una instalación nueva sigue descargando la imagen de PostgreSQL 16 una vez por nodo, porque la imagen de un contenedor de inicio se descarga antes de ejecutarse, y luego nunca la ejecuta.

## Actualizar desde la 3.x

**Esto es un reemplazo, no una actualización.** La 3.x era un producto distinto. No hay camino de migración para sus datos, porque no comparte ningún modelo de datos con un historiador de etiquetas.

```bash
helm uninstall hotloop -n hotloop
# keep or delete the old PVCs deliberately, they hold the HA recorder database
helm install hotloop ./charts/hotloop -n hotloop
```

Cosas que ya no existen y se rechazarán si se fijan: `sidecarProxy`, `homeassistant`, los complementos `mqtt`/`nodered`/`esphome`/`zigbee2mqtt`, `devices`, `cameras`, `customConfig`, `network.hostNetwork`.

## Revertir una actualización

`helm rollback hotloop -n hotloop` devuelve la imagen de la versión anterior. No devuelve la base de datos: una versión migra al arrancar, y eso queda hecho. La regla y la comprobación están en [Las migraciones solo añaden](/es/iot/migrations/).

Lo único que una reversión a través de la versión de PostgreSQL 17 sí devuelve es el motor de la base de datos: la imagen de base de datos del chart vuelve a la 16, que no abrirá el directorio actualizado. [Volver atrás](#volver-atrás) es la salida.

Es seguro una versión atrás. La base de datos registra qué versión aplicó cada migración, y una versión que encuentra migraciones de dos o más versiones más nuevas que ella se niega a arrancar:

```
refusing to start: this database's schema is more than one release ahead of
HotLoop 4.18.10. ...
```

Eso no es un fallo que sortear. Significa que la base de datos ha avanzado más de lo que esta versión llegó a ejecutarse. Avance a una versión que conozca el esquema, que es la más reciente, o restaure una copia de seguridad hecha por la versión en la que está ([Copias de seguridad y restauración](/es/iot/backup/)). Exactamente una versión atrás arranca, con una advertencia en el registro que nombra ambas versiones. Haga una copia de seguridad antes de actualizar; la reversión no puede deshacer los datos que escribió la versión más nueva.

## Verificar una instalación

```bash
kubectl -n hotloop get pods
kubectl -n hotloop logs deploy/hotloop | head -20
```

Un arranque sano dice los protocolos que habla, aplica las migraciones, informa del modo de historial y avisa de cualquier cosa que convenga saber:

```
msg=starting version=4.0.0 protocols="[ethernet-ip http modbus mqtt mtconnect opcua s7comm]"
msg="writes are ENABLED: the UI, API, automations and MCP can all command devices"
msg="tag_history promoted to a hypertable" timescale=2.30.1
msg="history schema ready" mode=timescale
msg=listening addr=:8080 mcp=/mcp writes=true
```

Después compruebe las etiquetas que necesita el panel. Esta es la comprobación que detecta la deriva: afirme el **conjunto**, no el recuento, porque una comprobación de recuento pasa mientras el conjunto es incorrecto:

```bash
kubectl -n hotloop get svc <release> -o json \
  | jq -r '.metadata.labels | keys[] | select(startswith("embernet.ai/"))'
```

Exactamente cuatro, en el Service y en el pod:

```
embernet.ai/app-name
embernet.ai/gui-port
embernet.ai/gui-type
embernet.ai/store-app
```

Si la aplicación está en marcha pero falta en Aplicaciones en ejecución, las etiquetas del Service son el primer sitio donde mirar: el panel consulta los Services por `embernet.ai/store-app`.

Un despliegue desde la App Store añade cinco más, a partir de las `tenantLabels` que pasa el panel: `embernet.ai/tenant`, `app-id`, `source`, `deployed-by` y `deployment-id`. Van en todos los recursos que renderiza el chart y en el pod del gateway. El panel lee el tenant del Service y de ningún otro sitio, así que un Gateway desplegado desde la tienda sin `embernet.ai/tenant` en su Service no pertenece a nadie. Un `helm install` simple no renderiza ninguna de las cinco.

## Sondas

- `/healthz`, liveness. Responde mientras el proceso está en marcha.
- `/readyz`, readiness. Además exige la base de datos, así que un pod que ha perdido su historiador deja de recibir tráfico en lugar de servir una interfaz que no puede responder nada.

La sonda de arranque permite dos minutos, porque una primera instalación ejecuta migraciones y la sonda de liveness no debe matarla a mitad de una migración.

## Apagado

`terminationGracePeriodSeconds: 45`. Con SIGTERM la aplicación deja de aceptar peticiones y luego vacía la cola del historiador para que las lecturas ya tomadas se escriban en lugar de tirarse. Acortar demasiado el periodo de gracia pierde lo que estuviera en vuelo.

## Solución de problemas

**Un dispositivo se queda en `connecting`.** Mire `lastError` en la tarjeta del dispositivo. Lo más habitual es un firewall entre el pod y el equipo, o un puerto equivocado. El chart no restringe el egress, así que una NetworkPolicy que lo bloquea es otra cosa del clúster.

**Las etiquetas leen calidad mala.** El dispositivo respondió pero el punto no. En Modbus, compruebe la base de direcciones, `oneBased` si sus planos usan numeración 40001. En OPC UA, compruebe que el id de nodo se resolvió; prefiera la forma `nsu=`.

**Los valores parecen verosímiles pero son erróneos.** En Modbus, eso es el orden de palabras, pruebe `CDAB`. Es el fallo que no se anuncia, porque el número no es obviamente erróneo.

**No se está historizando nada.** Compruebe el diagnóstico de la pantalla de Protocolos. `filtered` cuenta las lecturas suprimidas por banda muerta, lo que funciona como se pretende; `dropped` cuenta las lecturas perdidas porque la base de datos no pudo seguir el ritmo, lo que no.

**MCP devuelve 401.** El token bearer. Léalo del Secret de la versión.

**Cada petición a `/api/` devuelve 401.** Es lo esperado una vez que `auth.enabled` es true y nadie ha iniciado sesión todavía, ese es el sentido de la 4.4.0. Lea la contraseña de administrador generada del Secret de la versión (consulte [Autenticación](#autenticación)) e inicie sesión por la interfaz, o `POST /api/auth/login` directamente. Consulte [Autenticación y usuarios](/es/iot/authentication/).

**Ha perdido la contraseña de administrador y no hay otra cuenta de administrador.** Genere un hash nuevo y modifique el Secret, y luego reinicie el pod para que relea el entorno; `EnsureAdminUser` no toca una cuenta que ya existe, así que esto sustituye la fila directamente en lugar de pasar por el chart:

```bash
hotloop hash-password -password 'a-new-one'
kubectl exec -n hotloop deploy/hotloop -- \
  psql "$DATABASE_URL" -c \
  "UPDATE users SET password_hash = '<the hash>' WHERE username = 'admin'"
```

**Una automatización está activada pero no se ejecuta.** No compiló. La pantalla de Automatizaciones la muestra como NOT ARMED con el motivo, y el registro del sistema tiene el error.
