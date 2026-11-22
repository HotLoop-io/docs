---
title: "Destinos del historiador"
description: "Envíe cada lectura que guarda HotLoop también a la propia PostgreSQL, TimescaleDB, SQL Server, InfluxDB, MySQL o MariaDB de la planta."
---

HotLoop guarda su propio historial y eso no cambia. Pero una planta ya tiene una base de datos. TI la respalda, la actualiza, conecta Power BI a ella y responde por ella en una auditoría, y nadie va a adoptar la nuestra solo para ver una tendencia. Por eso HotLoop escribe el historial también en la suya.

Cada lectura que guarda el historiador integrado va a cada destino: las mismas lecturas, con la misma banda muerta y la misma calidad. Ni más ni menos. Una tendencia dibujada desde el destino y otra dibujada en HotLoop coinciden, porque son las mismas filas.

Los destinos están en HotLoop IoT, Edge y Gateway. No en el Edge Relay: no tiene historial propio desde el que poner al día a un destino, y todo el trabajo de un relay es llevar las lecturas a un Gateway, que puede escribirlas donde sea.

Bases de datos en las que escribe HotLoop:

| Tipo | Versiones probadas | <span class="sr-only">Details</span> |
|---|---|---|
| PostgreSQL y TimescaleDB | PostgreSQL 16 con TimescaleDB 2.30 | [abajo](#postgresql-y-timescaledb) |
| Microsoft SQL Server | SQL Server 2025 CU9 | [abajo](#microsoft-sql-server) |
| InfluxDB 2 y 3 | InfluxDB 2.9.1 e InfluxDB 3 Core 3.12.0 | [abajo](#influxdb-2-y-3) |
| MySQL y MariaDB | MySQL 26.7.0 y MariaDB 13.0.2 | [abajo](#mysql-y-mariadb) |
| API de Kafka (flujo de eventos) | Apache Kafka 4.4.0 y Redpanda 26.2.6 | [abajo](#api-de-kafka-flujo-de-eventos) |

## Añadir uno

**Ajustes, Destinos del historiador, Añadir un destino**, o `POST /api/historian/targets` (consulte [la API HTTP](/es/iot/api/#historian-targets)). Es solo para administradores, porque un destino es un lugar al que van los datos de la planta, y decidir cuál es cosa de un administrador. Quien pueda leer los ajustes ve los destinos y cómo va cada uno.

Un destino es un tipo, una dirección (`host` o `host:port`), una base de datos, una tabla y un inicio de sesión. La contraseña se cifra con la misma clave que las credenciales de los dispositivos (`HOTLOOP_SECRET_KEY_FILE`, consulte [Copias de seguridad y restauración](/es/iot/backup/)) y nunca sale de la API. Sin clave, se rechaza un destino con contraseña: un inicio de sesión de base de datos en claro dentro de una copia es justo lo que esa clave existe para evitar.

HotLoop crea la tabla si no existe. Si existe pero no es una que HotLoop haya creado (no tiene las seis columnas de abajo), el destino queda caído e indica qué columnas faltan, en lugar de rechazar las lecturas una por una.

## Qué llega a la tabla

Las mismas seis columnas que tiene el historial propio de HotLoop, de modo que una consulta escrita para uno sirve para el otro:

| Columna | <span class="sr-only">Details</span> |
|---|---|
| `ts` | Cuándo se tomó la lectura, en UTC, al microsegundo |
| `device_id` | El dispositivo |
| `tag_name` | El tag |
| `value` | El número, o vacío si la lectura es de texto |
| `string_val` | El texto, o vacío si la lectura es un número |
| `quality` | `good`, `bad` o `uncertain` |

La clave primaria es `(device_id, tag_name, ts)`, con dispositivo y tag primero porque una tendencia pide un tag a lo largo del tiempo. Esa clave es también la razón de que enviar una lectura dos veces sea inofensivo: es una sola fila. La puesta al día de abajo se apoya en eso a propósito.

## Cuando un destino está caído

Esta es la parte que importa, así que aquí está exactamente lo que ocurre.

**El sondeo nunca lo espera.** Las lecturas llegan a un destino por una cola en memoria, tan grande como la del historiador integrado (`HOTLOOP_HISTORIAN_QUEUE_SIZE`). Entregar una lectura nunca bloquea. Una cola llena descarta su lectura más antigua para hacer sitio, la misma regla que sigue el historiador integrado y por la misma razón: una cola sin límite en un pod con límite de memoria acaba en un OOM kill, y entonces se pierden el atraso, los datos en vivo y el proceso. Un destino detrás de un firewall que se traga cada paquete está probado para no retener nada: ni el sondeo, ni el historiador integrado, ni un apagado.

**Se pone al día cuando vuelve.** Lo que esperaba en la cola sale primero. Lo que la cola tuvo que descartar sale después, desde el historial propio de HotLoop, que ya contiene todas esas lecturas. No hay una segunda copia en disco que dimensionar ni llenar, y la puesta al día funciona mientras HotLoop conserve su historial (`HOTLOOP_HISTORIAN_RETENTION_DAYS`, 90 días salvo que lo haya cambiado), no mientras dure un búfer.

**Un reinicio a medias no olvida.** Lo que se le debe a un destino es un rango de tiempo escrito en su fila, no un montón de lecturas en memoria. Una parada limpia anota exactamente lo que se debe. Un fallo no puede, así que en cuanto un destino cae o empieza a descartar, HotLoop anota dónde empezó, con el final abierto. El siguiente arranque envía todo desde ahí.

**Dice en voz alta lo que no puede enviar.** Hay dos cosas que no se pueden poner al día, y ambas van al registro del sistema, con cuántas son y cuándo se tomaron:

- Lecturas más antiguas que la retención de HotLoop cuando el destino vuelve. También han desaparecido de HotLoop. El registro nombra el rango exacto.
- Lecturas que la base de datos del destino rechaza de plano: un valor que su columna no admite, una restricción check que alguien puso en la tabla. El lote se divide hasta encontrar las lecturas que no acepta, de modo que una lectura mala nunca retiene al resto, y se cuentan como rechazadas. Se avisa como máximo una vez por minuto, porque un tag que la base de datos no admite se rechaza en cada sondeo.

Una base de datos que no deja entrar a HotLoop en absoluto (contraseña incorrecta, sin permiso de inserción, a la tabla le falta una columna) está **caída**, nunca "rechazando". Las lecturas esperan, y en cuanto alguien lo arregla, llegan. Solo se da por perdida una lectura cuando el rechazo es sobre la lectura misma.

Cada paso queda en el registro del sistema, bajo el asunto `historian/<id>`:

```
warning  Historian target plant-pg (Plant historian) is down: dial tcp 10.20.0.9:5432: connect: connection refused.
         Readings wait in memory, up to 50000 of them; past that they're sent from HotLoop's own history when it's back.
info     Historian target plant-pg is back after 41m12s down. What waited in memory goes first.
warning  Historian target plant-pg couldn't keep up, and its queue dropped readings taken between
         2026-10-03T10:12:40Z and 2026-10-03T10:43:19Z (182211 readings dropped since HotLoop started).
         They go out from HotLoop's own history next.
info     Historian target plant-pg caught up: 182211 readings taken between 2026-10-03T10:12:40Z and
         2026-10-03T10:43:19Z went out from HotLoop's own history.
```

La tarjeta de Ajustes muestra lo mismo en vivo: el estado (`writing`, `catching up`, `down`, `off`), por qué está caído, cuánto está esperando y qué falta por enviar.

La puesta al día espera un minuto por detrás de la lectura más reciente que se debe, y a que el historiador integrado vaya al día, porque una lectura que sigue en esa cola todavía no está en la base de datos. Leer más allá la saltaría para siempre.

## Apagar uno, cambiarlo, eliminarlo

Apagado, un destino no recibe nada y no se le debe nada por el tiempo que está apagado. Lo que ya se le debía se le sigue debiendo. Un cambio (una contraseña nueva, una dirección nueva) lo reinicia con los nuevos ajustes, y lo que se le debía se le sigue debiendo. Eliminarlo borra lo que se le debía. Lo que ya contiene se queda en su base de datos.

Solo escribe en los destinos el HotLoop que sirve la interfaz. Un ayudante `--mcp-stdio` que corra a su lado no lo hace; si no, todo saldría dos veces.

## PostgreSQL y TimescaleDB

```json
{"id":"plant-pg","name":"Plant historian","kind":"postgres","address":"db.plant.local","database":"plant",
 "username":"hotloop","password":"...","useTls":true}
```

- El puerto por defecto es 5432. La tabla por defecto es `hotloop_history`, y puede llevar un esquema (`history.hotloop`). El esquema tiene que existir.
- Si la base de datos tiene la extensión TimescaleDB, la tabla que crea HotLoop es una hypertable sobre `ts`. Si no se consigue convertirla, la tabla queda normal, sigue aceptando todas las lecturas y el registro del sistema dice por qué.
- El inicio de sesión necesita conectarse, crear la tabla la primera vez (o la crea usted, con las seis columnas de arriba) e insertar en ella. Nada más. Un inicio de sesión que puede leer la tabla pero no insertar en ella es un destino caído, no uno que rechaza lecturas.
- `useTls` comprueba el certificado del servidor (`sslmode=verify-full`). `insecureSkipVerify` cifra sin comprobarlo (`sslmode=require`). Sin `useTls` la conexión no va cifrada (`sslmode=disable`).
- NaN y los infinitos entran tal cual: `double precision` los admite.
- Las sentencias no son preparadas, así que un PgBouncer en modo transacción delante de la base de datos funciona bien.

La tabla, si prefiere crearla usted:

```sql
CREATE TABLE hotloop_history (
    ts         timestamptz      NOT NULL,
    device_id  text             NOT NULL,
    tag_name   text             NOT NULL,
    value      double precision,
    string_val text,
    quality    text             NOT NULL,
    PRIMARY KEY (device_id, tag_name, ts)
);
```

## Microsoft SQL Server

```json
{"id":"plant-sql","name":"Plant historian","kind":"sqlserver","address":"sql.plant.local","database":"plant",
 "username":"hotloop","password":"...","useTls":true}
```

- El puerto por defecto es 1433, y la tabla `hotloop_history` en el esquema `dbo`. Un esquema delante (`history.hotloop`) se usa tal como se da, y tiene que existir.
- La base de datos tiene que existir. HotLoop crea la tabla, no la base de datos.
- La tabla que crea HotLoop tiene `ts` como `datetime2(6)`, los nombres como `nvarchar`, `value` como `float`, `string_val` como `nvarchar(max)` y la clave primaria `(device_id, tag_name, ts)`. Esa clave es la razón de que un nombre de tag pueda tener 380 caracteres como máximo, y uno más largo se rechaza como lectura y se avisa: una clave agrupada puede ocupar 900 bytes.
- El inicio de sesión necesita conectarse, crear la tabla la primera vez (o la crea usted, con esas seis columnas) e insertar en ella. Un inicio de sesión que puede leer la tabla pero no insertar es un destino caído, no uno que rechaza lecturas.
- **NaN y los infinitos entran con su hora y su calidad y sin número.** El `float` de SQL Server no los admite. La lectura está, y `value` es NULL.
- SQL Server cifra el propio inicio de sesión, así que la contraseña nunca viaja en claro. `useTls` cifra también las lecturas y comprueba el certificado del servidor; `insecureSkipVerify` cifra sin comprobarlo.
- Una lectura que ya está se omite, así que enviarla dos veces deja una sola fila.

La tabla, si prefiere crearla usted:

```sql
CREATE TABLE dbo.hotloop_history (
    ts         datetime2(6)  NOT NULL,
    device_id  nvarchar(64)  NOT NULL,
    tag_name   nvarchar(380) NOT NULL,
    value      float         NULL,
    string_val nvarchar(max) NULL,
    quality    varchar(16)   NOT NULL,
    CONSTRAINT PK_hotloop_history PRIMARY KEY CLUSTERED (device_id, tag_name, ts)
);
```

## MySQL y MariaDB

```json
{"id":"plant-mysql","name":"Plant historian","kind":"mysql","address":"mysql.plant.local","database":"plant",
 "username":"hotloop","password":"...","useTls":true}
```

Un solo tipo para ambos: hablan el mismo protocolo y aceptan las mismas sentencias aquí, y los dos se ejecutan en el conjunto de pruebas.

- El puerto por defecto es 3306, y la tabla `hotloop_history`. Un nombre con la base de datos delante (`other.hotloop`) se usa tal como se da. La base de datos tiene que existir; HotLoop crea la tabla, no la base de datos.
- La tabla que crea HotLoop es InnoDB con `ts` como `DATETIME(6)` en UTC, `value` como `DOUBLE`, `string_val` como `LONGTEXT` y la clave primaria `(device_id, tag_name, ts)`. Los nombres son `utf8mb4_bin`, porque los nombres de tag de HotLoop distinguen mayúsculas y la collation por defecto de los servidores no: `Temp` y `TEMP` serían una sola clave. Esa clave es la razón de que un nombre de tag pueda tener 512 caracteres como máximo, y uno más largo se rechaza como lectura y se avisa.
- **INSERT es el único privilegio que necesita** una vez que la tabla existe, y CREATE la primera vez si prefiere que la cree HotLoop. No lee la tabla y no usa `ON DUPLICATE KEY UPDATE`, que pediría también UPDATE: una lectura que ya está es un duplicado de la clave primaria, y se omite.
- **NaN y los infinitos entran con su hora y su calidad y sin número.** `DOUBLE` no los admite. `value` es NULL.
- Un duplicado en algún otro índice único que alguien haya añadido no es la misma lectura: se rechaza y se avisa, como una restricción check.
- `useTls` cifra y comprueba el certificado del servidor; `insecureSkipVerify` cifra sin comprobarlo. Sin `useTls` la contraseña tampoco viaja en claro (el inicio de sesión por defecto de MySQL 8 la envía cifrada con la clave del servidor), pero cualquiera en medio podría cambiar esa clave, así que indique `useTls` para todo lo que no esté en la red propia de la planta.

La tabla, si prefiere crearla usted:

```sql
CREATE TABLE hotloop_history (
    ts         DATETIME(6)  NOT NULL,
    device_id  VARCHAR(64)  CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
    tag_name   VARCHAR(512) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
    value      DOUBLE       NULL,
    string_val LONGTEXT     CHARACTER SET utf8mb4 NULL,
    quality    VARCHAR(16)  NOT NULL,
    PRIMARY KEY (device_id, tag_name, ts)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

## InfluxDB 2 y 3

```json
{"id":"plant-influx","name":"Plant historian","kind":"influxdb","address":"influx.plant.local:8086",
 "org":"plant","database":"hotloop","password":"<an API token>","useTls":true}
```

El mismo destino habla con InfluxDB 2 y con InfluxDB 3, por HTTP normal (`/api/v2/write`, line protocol, marcas de tiempo en microsegundos). Ambos lo responden, así que no hay un controlador que fijar ni nada que elegir.

- El puerto por defecto es 8086, el de InfluxDB 2. InfluxDB 3 escucha en el 8181 salvo que lo haya cambiado, así que indique el puerto.
- `database` es el bucket. `org` es la organización de InfluxDB 2, y InfluxDB 2 exige una: sin ella cada escritura es un 400 que lo dice, y el destino queda caído con ese mensaje. InfluxDB 3 no tiene organizaciones, así que omítala.
- `password` es el token de la API. Necesita permiso de escritura en el bucket (InfluxDB 2) o en la base de datos (InfluxDB 3). HotLoop no crea el bucket. Un bucket que no existe es un 404, que es el destino caído, no lecturas rechazadas. InfluxDB 3 crea una base de datos cuando se escribe en ella.
- `table` es la medición, `hotloop_history` salvo que indique otra.
- Una lectura es un punto. El dispositivo y el tag son tags, así que cada tag de HotLoop es una serie. El número (`value`) o el texto (`string_val`) y la calidad (`quality`) son campos. Enviar una lectura dos veces se sobrescribe a sí misma.
- **NaN y los infinitos entran con su hora y su calidad y sin campo `value`.** Line protocol no tiene forma de escribirlos.
- InfluxDB fija el tipo de un campo para siempre (por shard en la 2, por columna en la 3). Si otra cosa ya escribió un número en `string_val` o texto en `value`, las lecturas de HotLoop del otro tipo se rechazan, se cuentan y se nombran en el registro del sistema, y el resto entra.
- Un 401 o un 403 (un token que no conoce o que no puede escribir) es el destino caído, no un rechazo: no se tira nada, y las lecturas entran en cuanto el token es correcto.
- `useTls` cambia a `https` y comprueba el certificado; `insecureSkipVerify` no lo comprueba.

## API de Kafka (flujo de eventos)

No es una base de datos: es un flujo. Cada lectura que guarda el historiador va a un topic de Kafka y, si le da un segundo topic, también cada línea que HotLoop escribe en su propio registro del sistema (alarmas, dispositivos que se conectan y se caen, cambios de configuración). Habla la API de Kafka, así que la aceptan Apache Kafka, Redpanda y cualquier otro que responda a ese protocolo. La misma cola, la misma puesta al día desde el historial propio de HotLoop, el mismo "un broker caído no frena nada" que en cualquier otro destino.

```json
{"id":"plant-stream","name":"Plant event stream","kind":"kafka","address":"kafka1.plant.local:9093,kafka2.plant.local:9093",
 "table":"hotloop.tags","username":"hotloop","password":"...","useTls":true,
 "options":{"sasl":"scram-sha-512","caCert":"-----BEGIN CERTIFICATE-----...","eventsTopic":"hotloop.events"}}
```

- `address` es una lista de brokers separados por comas, puerto 9092 si no se indica. Basta con uno para empezar: el broker dice dónde están los demás.
- `table` es el topic de las lecturas (`hotloop.tags` salvo que indique otro). `options.eventsTopic` es el topic de los eventos, `hotloop.events` cuando añade el destino desde el formulario o lo omite en la llamada a la API, y vacío si no quiere eventos. Los dos no pueden ser el mismo topic.
- HotLoop crea los topics si no existen, con las particiones y la replicación por defecto del propio broker. Un inicio de sesión que no puede crearlos es un destino caído con el motivo del broker, así que créelos antes si el suyo no puede.
- `options.sasl` es `scram-sha-512`, `scram-sha-256` o `plain`, con el `username` y la `password`. PLAIN envía la contraseña tal cual, así que HotLoop la rechaza sin `useTls`. Un inicio de sesión que el broker rechaza está **caído**, con "the broker refused the login" en el estado, nunca "rechazando lecturas".
- `useTls` comprueba el certificado del broker. Si lo firmó su propia CA, ponga la CA en `options.caCert` como PEM. `insecureSkipVerify` cifra sin comprobar.
- No se admiten certificados de cliente (TLS mutuo), Kerberos ni inicios de sesión OAuth.

**Qué llega al topic de lecturas.** Un objeto JSON por lectura, con la clave `deviceId/tag` para que las lecturas de un tag se mantengan en orden en una partición:

```json
{"ts":"2026-10-31T12:00:00.123456Z","deviceId":"press-01","tag":"Zone1_Temp","value":21.5,"quality":"good","unit":"°C"}
{"ts":"2026-10-31T12:00:00Z","deviceId":"press-01","tag":"Program","value":null,"text":"Grade A","quality":"good"}
{"ts":"2026-10-31T12:00:00Z","deviceId":"press-01","tag":"Speed","value":null,"nonFinite":"NaN","quality":"bad"}
```

Un número es `value`; el texto es `text` con `value` nulo; JSON no puede llevar NaN ni un infinito, así que esos dicen `nonFinite` (`NaN`, `+Inf`, `-Inf`) y `value` es nulo. A este formato solo se le añaden campos, nunca se cambia. Cabeceras: `hotloop-type: reading` y `content-type: application/json`. La marca de tiempo del propio registro es cuándo se produjo; la hora de la lectura es `ts`.

**Qué llega al topic de eventos.** Un objeto JSON por línea del registro del sistema, con su asunto como clave (o su categoría cuando no tiene), `hotloop-type: event`:

```json
{"at":"2026-10-31T12:00:00.456Z","severity":"warning","category":"alarm","subject":"press-01/Zone1_Temp",
 "actor":"system","message":"Zone 1 is over 250","detail":{"limit":250,"value":251.5}}
```

`detail` es el JSON que llevaba la línea, como JSON, o texto cuando no era JSON. Las líneas sobre los propios destinos del historiador se dejan fuera; si no, un broker caído informaría de su propia caída a sí mismo.

**Es al menos una vez, y los eventos son de mejor esfuerzo.**
- Lecturas: la entrega la confirman todas las réplicas sincronizadas, y la puesta al día tras una caída solapa a propósito lo que ya salió, así que una lectura puede llegar dos veces. `deviceId`, `tag` y `ts` identifican un duplicado; un consumidor al que le importe descarta la repetida. Una lectura que nunca llega al broker se debe y se envía desde el historial propio de HotLoop, igual que con una base de datos.
- Los eventos son el flujo en vivo. No hay historial de ellos desde el que ponerse al día, así que uno producido mientras el broker no está, o más allá de un búfer lleno, se pierde, y el estado del destino lo cuenta (`eventsLost`) y la tarjeta de Ajustes lo dice.
- Un broker que desaparece en mitad de una escritura deja el destino **caído** en 25 segundos, y las lecturas de esa escritura se deben. (franz-go esperaría para siempre una escritura de la que no puede probar que no llegó; HotLoop le deja rendirse, y por eso es posible un duplicado.)
- Una lectura que el broker nunca aceptará (mayor de lo que puede ser un mensaje) se rechaza por sí sola, se cuenta y se nombra en el registro del sistema, y el resto de su lote sigue su camino.

HotLoop habla la API de Kafka a través de [franz-go](https://github.com/twmb/franz-go) (BSD-3-Clause), citado en `NOTICE`. Añadió unos 5 MiB al binario.

## Cómo se prueba

Cada tipo de destino se ha ejecutado contra la base de datos o el broker reales, con una caída cortada y restaurada de verdad: el destino acaba con exactamente lo que tiene HotLoop, un reinicio mientras está caído se pone al día en el siguiente arranque, y un destino que se cuelga no retiene ni el sondeo ni el historiador integrado.
