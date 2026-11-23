---
title: "Copias de seguridad y restauración"
description: "Instantáneas lógicas de la base de datos, restauraciones que rechazan un esquema más nuevo y por qué la clave de las contraseñas se guarda aparte."
---

HotLoop hace instantáneas lógicas, solo con los datos de las tablas, del historiador y las restaura, desde la 4.12.0. Está desactivado por defecto (`HOTLOOP_BACKUP_ENABLED`): un despliegue que no ha configurado un volumen de copias no debería tener este proceso escribiendo en silencio en el sistema de archivos efímero de un contenedor.

## Qué es esto

Una copia de seguridad es un directorio: un archivo por tabla más un pequeño `manifest.json` (versión de HotLoop, las migraciones de esquema que la base de datos tenía aplicadas, la marca de tiempo, y el número de filas y las columnas con sus tipos de cada tabla).

## Qué no es

- **No es `pg_dump`/`pg_restore`.** La imagen de ejecución del Gateway (`gcr.io/distroless/static-debian12:nonroot`) es a propósito un binario estático y nada más: sin shell, sin gestor de paquetes, sin binarios externos de ningún tipo. Todo lo de aquí pasa por la misma conexión a la base de datos que la aplicación ya tiene abierta.
- **No es una copia del esquema.** El esquema se reconstruye automáticamente en cada arranque (`HOTLOOP_DB_MIGRATE`, activado por defecto). Una copia solo captura los *datos* de las tablas, y una restauración siempre da por hecho que esas migraciones ya han reconstruido el esquema.
- **No es recuperación a un punto en el tiempo.** Aquí no hay archivado de WAL ni replicación continua. Una copia es una instantánea del momento en que se ejecutó; lo que se escriba después de ese momento y antes de la siguiente copia no queda cubierto.
- **No es almacenamiento fuera del equipo.** El directorio de copias (`HOTLOOP_BACKUP_DIR`, pensado para estar respaldado por el PVC `backup.persistence` que aprovisiona este chart) sigue siendo un único volumen dentro del mismo clúster. Llevar las copias a un almacenamiento realmente duradero, replicado o fuera de línea (copiar el volumen a almacenamiento de objetos, hacer una instantánea del PVC, lo que ofrezca la infraestructura real de quien opera) es trabajo de quien opera, igual que este proyecto ya trata el almacenamiento duradero como responsabilidad de la infraestructura y no como algo para lo que la aplicación reinventa un adaptador de copias multinube.

## Proteja los archivos de copia

Los archivos de copia son sensibles. El archivo `users.copy` contiene hashes bcrypt de contraseñas y de PIN de quiosco, y `sessions.copy` y `write_audit.copy` contienen registros de sesiones y el rastro de auditoría de escrituras. Los archivos se crean con modo `0640` (y el directorio de copias con `0750`), y un archivo que ya existe es un error en lugar de sobrescribirse, pero eso es un mínimo y no sustituye la protección del volumen: mantenga el volumen de copias en almacenamiento cifrado en reposo, restrinja quién y qué puede leerlo, y aplique el mismo cuidado a cualquier copia fuera del equipo que haga quien opera.

El archivo `devices.copy` contiene la dirección y la configuración de protocolo de cada dispositivo tal como están guardadas, lo que incluye las credenciales con las que se conectan los controladores. Lo legibles que sean depende de la clave, más abajo. Desde la 4.15.1 la API oculta toda credencial de dispositivo a todos los roles, administrador incluido; un archivo de copia no está detrás de la API. Consulte [Autenticación y usuarios](/es/iot/authentication/#dónde-siguen-las-credenciales-en-claro).

## Credenciales de dispositivos y la clave secreta

Una copia de seguridad es el archivo que acaba copiado en un portátil, en un recurso compartido y en un ticket. Por eso las credenciales que lleva van cifradas, con una clave que nunca está en la base de datos ni en una copia.

- **Con `HOTLOOP_SECRET_KEY_FILE` definido** (el chart lo define, con una clave que genera al instalar y conserva entre actualizaciones y desinstalaciones), toda credencial con clave (la `password` de los dispositivos OPC UA, CODESYS, MQTT, HTTP, MTConnect y UniFi, la `community` y las frases de paso de los dispositivos SNMP, los valores de cabecera de HTTP y MTConnect como las claves de API, la contraseña de cada otro broker MQTT que escucha el descubrimiento y la contraseña de cada destino del historiador) se cifra en la base de datos, y `devices.copy`, `mqtt_sources.copy` y `historian_targets.copy` contienen el texto cifrado. El manifiesto indica con qué clave se cifró como `secretKeyIds`: un identificador, nunca la clave.
- **Sin ella**, esas credenciales están en la base de datos y en `devices.copy` en claro, y HotLoop lo dice en su registro de arranque. Las consolas UniFi, los brokers MQTT con contraseña y los destinos del historiador con contraseña no se pueden guardar en absoluto sin una clave. Defina una y reinicie: todo lo ya almacenado se cifra en ese arranque.
- **Una credencial escrita dentro de una URL o de un texto también se sella** (`mqtt://user:pass@host`, un valor de consulta `?token=` o `?api_key=`, un `body` HTTP que mencione una contraseña). La dirección u opción de un dispositivo que contenga una se sella entera, y los controladores la reciben exactamente como se escribió. Una URL sin nada secreto se deja legible. Sin clave estas están en claro como el resto, y el registro de arranque lo dice; con una, todo lo ya almacenado se sella en ese arranque. La opción de contraseña sigue siendo el mejor lugar para una.

**Restaurar necesita la misma clave.** `--restore-from` comprueba el manifiesto antes de cargar una fila: una copia cifrada con una clave que el HotLoop que restaura no tiene se rechaza, y el error nombra la clave que necesita. Restaure con ese archivo de clave montado. Si la clave se ha perdido para siempre, añada `--restore-keep-unreadable-credentials`: todo lo demás vuelve, y cada dispositivo cuya credencial no se puede abrir se queda caído, indicando qué clave necesita, hasta que alguien vuelva a introducir la credencial. Una copia hecha antes de que existiera una clave se restaura en cualquier sitio, y sus credenciales se cifran en cuanto termina la restauración.

**Guarde la clave donde no estén las copias.** Una clave guardada junto a sus copias no protege nada. Con el chart es el Secret `<release>-secret-key`; haga copia de él como hace con el resto de los secretos del clúster, por separado.

## Qué se copia y en qué orden

Cada tabla de datos de usuario, en el orden de dependencia de claves foráneas (una tabla va siempre después de todas las tablas a las que apuntan sus propias claves foráneas):

```
devices → tags → tag_latest → alarm_definitions → alarm_state →
alarm_events → automations → automation_runs → blueprints → scripts → script_runs →
recipes → recipe_versions → recipe_applications → events → write_audit →
settings → users → sessions → user_certificates → energy_meters → energy_meter_state →
energy_buckets → fleet_members → report_definitions →
report_runs → entity_state_log → tag_history
```

(Abreviado; `backup.Tables` es la lista completa, con las tablas de entidades y equipos y `entity_last_state` incluidas.) El `entity_state_log` del libro de registro está particionado por mes en ambos modos de historial y va justo antes de `tag_history`, la única tabla mayor. Una restauración carga sus filas antes de que exista ninguna de sus particiones mensuales, así que caen en su partición por defecto. El mantenimiento del libro de registro, cuando arranca un Gateway que registra, crea las particiones del mes pasado y de este mes alrededor de las filas que les corresponden, y borra las filas más antiguas de la partición por defecto a medida que superan la retención, de modo que la retención alcanza a todas las filas restauradas. Consulte [el libro de registro](/es/iot/logbook/).

Los scripts vuelven con su historial. Una ejecución que la copia pilló a medias vuelve como `running`, y el primer arranque del Gateway la marca como cancelada, `interrupted by restart`, igual que una ejecución que cortó un fallo: nada reanuda una ejecución. Consulte [Scripts](/es/iot/scripts/).

Las recetas vuelven con todas sus versiones y todas sus aplicaciones. Una aplicación que la copia pilló a medias vuelve como `applying`, y el primer arranque del Gateway la marca como `failed`, apuntando a su id de llamada en la auditoría de escrituras: nada reanuda una, y nada deshace una. Consulte [Recetas](/es/iot/recipes/).

`schema_migrations` se excluye a propósito: `store.Migrate` la reconstruye, junto con el DDL de cada tabla, a partir de las migraciones incluidas. Es la única entrada de `backup.ExcludedTables`, que registra por qué se excluye cada tabla excluida.

La lista se mantiene a mano, y así es como una migración puede añadir una tabla y que quede fuera de todas las copias sin que nadie lo note. Dos pruebas lo evitan, y ambas se ejecutan contra una base de datos real en los dos modos de almacenamiento. Las tablas de informes programados (`report_definitions`, `report_runs`) son las primeras tablas añadidas bajo estas protecciones. Los archivos de salida de los informes están en el volumen de informes y no forman parte de una copia de la base de datos. `tag_history` se carga la última al restaurar: no tiene clave foránea propia y es con diferencia la tabla más grande, de modo que todas las tablas pequeñas de configuración fallan pronto, si es que van a fallar, antes de que ese largo paso siquiera empiece.

**`settings` tiene una excepción deliberada.** La fila `history_mode` la escribe el propio `store.ensureHistorySchema`, una sola vez, en el momento en que `Migrate` construye un esquema desde cero: registra si *este servidor* construyó `tag_history` como hypertable de TimescaleDB o como tabla particionada de forma nativa, que es un hecho sobre la base de datos en la que `Migrate` acaba de ejecutarse, no sobre la planta. Se excluye tanto de la copia como de la restauración de `settings`: restaurar la decisión histórica de una instalación de origen en un destino cuyas capacidades difieren (o incluso en una ejecución nueva de `Migrate` contra el mismo tipo de servidor) podría reescribir esta fila para describir una forma que el destino en realidad no tiene. El `Migrate` del propio destino ya ha tomado la decisión correcta antes de que `Restore` mire siquiera `settings`, y esa decisión se deja como está.

## Copias bajo demanda

- `POST /api/backup` (`backup.run`, solo para administradores) hace una copia ahora mismo y devuelve el manifiesto.
- `GET /api/backup` (`backup.read`, solo para administradores) lista lo que hay en el volumen de copias: nombre, tamaño en disco y el manifiesto (lista de tablas, número de filas, versión de HotLoop, marca de tiempo) de cada una.

Ambas son solo para administradores por omisión del rol de operador, el mismo recorte que `fleet.restart`/`fleet.config`/`notify.test` ya aplican a otras acciones operativas, de "hágalo ahora" o de alcance administrativo. Los números de filas de un listado de copias, incluidos `users` y `sessions`, se parecen más a un diagnóstico administrativo que a las lecturas de planta (dispositivos, tags, alarmas) que el rol de operador debe ver, así que `backup.read` no se separó en un permiso más bajo como algunas lecturas; es una decisión de criterio, no una restricción técnica, y podría revisarse si un flujo de trabajo real de operador lo necesita.

## Programación y retención

`HOTLOOP_BACKUP_INTERVAL` (p. ej. `24h`) ejecuta una copia a intervalos fijos. Es a propósito un intervalo simple, no un intérprete de expresiones cron: la necesidad realista es "haga copia de esto cada cierto tiempo", y la convención de este proyecto es no construir para una necesidad que nadie tiene todavía. Dejarlo sin definir (o en `0`) desactiva el planificador; el endpoint bajo demanda sigue funcionando, para un operador o un cron externo que prefiera lanzarla por su cuenta.

`HOTLOOP_BACKUP_RETAIN` (por defecto `7`) conserva los N directorios de copia más recientes y borra los más antiguos tras cada copia correcta. `0` o menos conserva todo, una decisión que quien opera debe tomar deliberadamente en un volumen pequeño.

## Restaurar una copia

**Restaurar no es a propósito un endpoint de la API.** Automatizar "restaurar ahora" como una acción en vivo, disparable por red, contra una base de datos que puede estar sirviendo tráfico de producción es un riesgo real: un clic equivocado, o una sesión de administrador comprometida, sobrescribe datos en producción, y este proyecto no lo construye sin que se lo pidan expresamente. La restauración es una opción del propio binario, que se ejecuta una vez, a mano, por quien opera y ya ha decidido que la base de datos de destino debe recibirla:

```sh
hotloop --restore-from=/data/backups/20260918T220000Z
```

Lo que hace, por orden:

1. Carga la configuración y se conecta a la base de datos exactamente como un arranque normal: `store.Open` ejecuta las mismas migraciones y construye el esquema en el que la restauración va a cargar los datos.
2. **Rechaza una copia que no puede cargar sin perder algo**: una hecha con un esquema más nuevo que el de esta base de datos, o una con una tabla o columna que esta versión ya no tiene. Ambas cosas se comprueban antes de cargar una sola fila. Consulte "Restaurar en una versión distinta" más abajo.
3. **Rechaza si alguna tabla de destino ya tiene datos** más allá de lo que el propio `Migrate` acaba de sembrar (la única fila `history_mode` de `settings`): la restauración solo se ejecuta contra una base de datos que todavía no tiene nada. Esta es la comprobación de seguridad: una tabla con una sola fila existente detiene toda la restauración antes de que se ejecute ningún `COPY FROM STDIN`.
4. Carga cada tabla, en orden de dependencia, dentro de una única transacción, en las columnas que nombra el manifiesto.
5. Reinicia la secuencia de respaldo de cada tabla con clave primaria `bigserial` (`tags`, `alarm_events`, `automation_runs`, `events`, `write_audit`, `sessions`) a uno más que el id restaurado más alto: `COPY FROM STDIN` carga valores de id explícitos sin tocar la secuencia, así que omitir esto dejaría que la siguiente inserción normal chocase con una fila restaurada.
6. Vuelve a contar cada tabla y compara con el número de filas del manifiesto, dentro de la misma transacción todavía abierta.
7. Confirma solo si todos los recuentos coincidieron. Una discrepancia, o cualquier error en un paso anterior, revierte toda la transacción y deja la base de datos de destino exactamente tan vacía como estaba, nunca cargada a medias.
8. Termina. Nada más en el proceso arranca: ni planificador de sondeo, ni motor de alarmas, ni servidor de API. Una restauración no tiene uso para ninguno de ellos, y arrancar el entorno de ejecución contra una base de datos a mitad de restauración sería un riesgo en sí mismo.

### Pasar a PostgreSQL 17

Esta copia la hace la aplicación en ejecución, por su conexión a la base de datos en ejecución, así que no puede ser la copia para el paso de PostgreSQL 16 a 17: ese paso ocurre antes de que arranque la base de datos. La seguridad de la propia actualización es que nunca escribe en el directorio de PostgreSQL 16, que conserva entero como `pgdata.pg16` (la página de k3s y Helm, "PostgreSQL 17"). Haga igualmente esta copia en la versión antigua antes de actualizar, porque es la copia que vive fuera del equipo. Restaurarla en la nueva base de datos es la restauración normal de abajo: lleva filas, no el motor, así que no le importa qué versión mayor las escribió.

### Restaurar en una versión distinta

La versión con la que restaura rara vez es la que hizo la copia. La copia se hizo hace meses con lo que hubiera entonces, y el equipo que está reconstruyendo ejecuta la de hoy. Así que esto es lo que se restaura sobre qué.

**Una copia antigua en un HotLoop más nuevo: sí.** Es el caso que importa, y está probado desde todos los niveles de esquema que ha habido, desde `0001_core` hasta hoy, en TimescaleDB y en PostgreSQL normal, con la aplicación arrancada después.

- Cada manifiesto registra las columnas de cada tabla, nombres y tipos. La restauración carga cada archivo exactamente en esas columnas, por nombre. Una columna añadida desde la copia toma su valor por defecto. `entity_id`, `service` y `call_id` de `write_audit` vuelven vacíos en cada fila de auditoría anterior a los servicios de entidad, que es lo que eran esas filas: simples escrituras de tags.
- Una tabla añadida desde la copia queda vacía, y la aplicación rellena lo que puede al arrancar. La primera sincronización del registro de entidades da a cada tag restaurado su entidad de lectura, a cada tag armado su entidad de control y a cada definición de alarma su entidad de alarma, con los nombres que les habría dado el registro. Los dispositivos de una copia anterior al árbol de equipos se colocan en él según el texto de su sitio, área y línea durante la propia restauración, igual que los colocó la actualización. Lo que nunca estuvo en la copia no puede volver: etiquetas, entidades compuestas y nombres de entidad que un operador personalizó después de hacer la copia.

**Una copia más nueva en un HotLoop más antiguo: no, se rechaza.** El manifiesto registra todas las migraciones que tenía aplicadas la base de datos de la copia. Si tiene alguna que esta base de datos nunca ha ejecutado, la restauración se detiene antes de cargar una fila y lo dice:

```
refusing to restore: this backup was taken by HotLoop <its version> with the
database schema at <its newest migration>, which is newer than this database's
schema at <this database's newest migration> (HotLoop <this version>). ...
Restore it with HotLoop <its version> or a later release
```

"Más nueva" significa migraciones, no cadenas de versión. Una cadena de versión dice qué binario hizo la copia, y las compilaciones de desarrollo, las versiones candidatas y las ramas de corrección hacen que compararlas sea una conjetura. Las migraciones dicen cómo era realmente el esquema, y se comparan como conjunto, de modo que una migración que falta se detecta en cualquier lugar del orden. Las versiones aparecen en el mensaje porque la versión es lo que usted puede aplicar: con qué versión restaurar.

**Una copia con una columna que esta versión ya no tiene: se rechaza, por nombre.** El día que una migración elimina, renombra o cambia el tipo de una columna, una copia anterior tiene datos para los que la nueva tabla no tiene sitio. La restauración no adivina. Nombra todas esas columnas, de todas las tablas, antes de cargar nada:

- una columna que la tabla en ejecución no tiene se rechaza, salvo que `backup.columnRenames` la asigne a su nuevo nombre. Una migración que renombra una columna añade esa entrada, y una prueba que restaura una copia anterior a ella, en el mismo cambio. Hoy no hay renombrados, así que el mapa está vacío;
- una columna cuyo tipo cambió se rechaza. El COPY binario no lleva tipos, así que los bytes se leerían como el nuevo tipo o se rechazarían a medias;
- una columna que la tabla en ejecución ha añadido como `NOT NULL` sin valor por defecto se rechaza, porque nada podría rellenarla.

La salida es la misma para los tres casos: restaurar con la versión que hizo la copia y luego actualizar esa base de datos en el sitio, que es como la migración estaba pensada para encontrarse con esos datos.

Cargar por nombre cubre también el cambio que nadie nota: una columna eliminada y vuelta a añadir, o una tabla reconstruida, de modo que las columnas quedan en otro orden. Cargar por posición metería los valores de una columna en otra sin ningún error siempre que los tipos coincidan. Por nombre, cada uno cae donde le corresponde.

**Las copias hechas antes de que los manifiestos registraran nada de esto** (toda copia hecha antes de esta versión) no tienen listas de columnas ni esquema. Aun así se restauran:

- Sin listas de columnas, la restauración recurre a la posición. Un archivo con menos columnas que la tabla va a las primeras columnas de la tabla, y el resto toma sus valores por defecto. Eso es correcto para todos los esquemas hasta ahora, porque todas las migraciones hasta la fecha solo han añadido columnas, y `ALTER TABLE ADD COLUMN` siempre añade al final. Un archivo con más columnas que la tabla lo rechaza el propio PostgreSQL.
- Sin esquema, la restauración supone que la copia es tan nueva como pudiera ser: `0007_service_audit.sql`, la migración más nueva que había cuando los manifiestos empezaron a registrarla. Esa suposición solo puede rechazar una restauración que habría funcionado, nunca dejar pasar una que no. En la práctica no rechaza nada, porque cualquier HotLoop con esta comprobación ya ha ejecutado todas las migraciones hasta esa.

La primera copia que haga esta versión lo registra todo, así que la alternativa solo importa para las copias que ya están en un volumen de copias.

### Procedimiento de restauración, paso a paso

1. Lleve el directorio de la copia al equipo o volumen que pueda leer el binario `hotloop` del despliegue de destino: este es el punto en que vuelve a entrar en juego la copia que quien opera haya hecho del volumen de copias fuera del equipo.
2. Apunte `HOTLOOP_DB_*` a la base de datos de **destino**. Debe ser accesible y no tener datos todavía en ninguna de las tablas de la copia (una base de datos nueva y vacía es lo normal; el esquema se construirá en el paso 3).
3. Ejecute `hotloop --restore-from=<path to the backup directory>`.
4. Lea la última línea del registro: `restore complete` con el número de tablas y de filas, o un error que explique exactamente qué se rechazó y por qué.
5. Arranque `hotloop` normalmente contra esa misma base de datos.

## Pasar de una base de datos a otra

Una copia es lo mismo con independencia de la base de datos que la hizo: archivos COPY binarios de PostgreSQL y un manifiesto que nombra el tipo de Postgres de cada columna. Por eso pasar una planta de una base de datos a otra es una copia en la antigua y una restauración en la nueva. Nada más.

- **De SQLite a Postgres o TimescaleDB.** La Pi que se quedó pequeña con su archivo. Haga una copia, apunte `HOTLOOP_DB_*` al nuevo servidor (`HOTLOOP_DB_TYPE=postgres`) y restaure. En un servidor TimescaleDB el historial cae en una hypertable.
- **De Postgres o TimescaleDB a SQLite.** Una planta que se reduce a un equipo pequeño. Lo mismo en sentido contrario, con `HOTLOOP_DB_TYPE=sqlite`.
- **De Postgres normal a TimescaleDB, y viceversa.** El modo de historial es persistente, así que apuntar un Gateway al Postgres normal de una caja IoT mantiene sus particiones. Para obtener una hypertable, restaure en un TimescaleDB nuevo. Al revés se obtienen particiones.

Lo que se comprueba al entrar es lo que se comprueba en cualquier restauración: cada columna por nombre y tipo frente al destino, leyendo las columnas de SQLite como sus tipos de Postgres, de modo que una copia de uno se restaura en el otro o se rechaza por la misma razón que en cualquier otro sitio. `history_mode` nunca se copia: el destino conserva lo que decidieron sus propias migraciones. Las secuencias quedan bien en ambos: en Postgres las mueve `fixSequences`, y el AUTOINCREMENT de SQLite avanza solo más allá de cualquier id restaurado en él.

## Configuración

| Variable | Valor por defecto | <span class="sr-only">Details</span> |
|---|---|---|
| `HOTLOOP_BACKUP_ENABLED` | `false` | La función está desactivada, incluidas las rutas de la API, hasta que se define esto |
| `HOTLOOP_BACKUP_DIR` | `/data/backups` | Dónde se escriben las copias; pensado para ser un PVC (`backup.persistence` en el chart) |
| `HOTLOOP_BACKUP_RETAIN` | `7` | Se conservan las N copias más recientes; `0` o menos conserva todo |
| `HOTLOOP_BACKUP_INTERVAL` | sin definir | p. ej. `24h`; sin definir significa solo bajo demanda |

`--restore-from=<dir>` es una opción de línea de comandos del binario `hotloop`, no una variable de entorno; consulte "Restaurar una copia" más arriba.

## Qué se ha verificado y qué no

HotLoop se ha ejecutado con equipos reales y servidores reales, y en bare metal el 2026-11-17.
