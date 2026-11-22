---
title: "Gobernar una instancia de Cascade"
description: "Variables, carpetas, ejecuciones anotadas, redacción, insights, secretos externos y envío de logs, para una planta con una pila creciente de flujos de trabajo."
---

Cómo mantiene una planta bajo control una pila creciente de flujos de trabajo: ajustes compartidos, carpetas, ejecuciones anotadas, redacción, números a lo largo del tiempo, secretos externos, envío de logs y dónde viven los datos grandes. Todo esto es gratis y está en todas las compilaciones.

Todos los endpoints que se nombran abajo están en el documento OpenAPI de `/api/v1/openapi.json`, y cada uno tiene una prueba que lo llama, en SQLite y en Postgres.

## Variables

En el editor: Variables, en la barra superior. Las de toda la instancia están arriba, y las de cada proyecto bajo su nombre. Solo se ofrece lo que permite su rol.

Una variable es un valor con nombre que un flujo de trabajo lee como `vars.NAME`: un tope de consigna, el nombre de una planta, una URL base que difiere entre la línea piloto y la real.

```yaml
- name: Check limit
  type: core.if
  version: 1
  params:
    condition: "{{ item.json.temp > toNumber(vars.TEMP_LIMIT) }}"
```

- Una variable es **de toda la instancia** o pertenece a **un proyecto**. Cuando las dos tienen un nombre, gana la del proyecto, y solo para los flujos de trabajo de ese proyecto.
- Un valor es texto, de hasta 8 KiB. Use `toNumber(vars.X)` cuando necesite un número.
- Un nombre son letras, dígitos y guiones bajos, empieza por una letra o un guion bajo y tiene hasta 64 caracteres, porque tiene que leerse como `vars.NAME`.
- **Las variables no son secretos.** Quien puede leer el proyecto lee sus variables, y el valor no se borra de los datos de las ejecuciones. Una contraseña, un token o una clave va en la bóveda de credenciales, o en un almacén de secretos externo (más abajo).
- Una ejecución lee sus variables cuando empieza, y otra vez si se reanuda tras una espera o un reinicio. Un cambio llega a la siguiente ejecución, no a una que ya está en medio de un paso. Un nombre que no existe se lee como nada, no como un error.

| Llamada | Qué hace |
|---|---|
| `GET /api/v1/variables` | Las variables de la instancia y las de los proyectos que puede leer; `?project=` limita a un proyecto. |
| `POST /api/v1/variables` | Crea una. Con `projectId` es del proyecto, sin él es de toda la instancia. |
| `PUT /api/v1/variables/{variable}` | Cambia su nombre y su valor. |
| `DELETE /api/v1/variables/{variable}` | La elimina. |

Quién puede: en un proyecto, el permiso `variable.read` las lista y `variable.create`, `variable.update` y `variable.delete` las cambian. Los viewers y los operators leen, los editors y los admins cambian. Las variables de toda la instancia las puede leer cualquier persona con sesión iniciada, porque el flujo de trabajo de cualquier proyecto puede leerlas, y solo las cambia un propietario o administrador de la instancia. Un rol a medida puede llevar cualquiera de esos cuatro permisos. Los cambios están en el registro de auditoría como `variable.created`, `variable.updated` y `variable.deleted`, con el nombre y nunca el valor.

## Carpetas

En el editor: la lista de flujos de trabajo son las carpetas. Cree una con Nueva carpeta, anídela con Añadir subcarpeta y mueva un flujo de trabajo desde su propia fila de la lista. Al elegir una carpeta cuando crea un flujo de trabajo, queda allí.

Las carpetas agrupan los flujos de trabajo de un proyecto y se anidan, como se organiza una planta: área, línea, celda.

- Una carpeta está en un proyecto. Los nombres son únicos entre las carpetas contiguas, y un nombre tiene hasta 100 caracteres.
- Las carpetas se anidan hasta 10 niveles.
- Un flujo de trabajo está en una carpeta o en la raíz de su proyecto. Guardar una versión nueva no lo mueve.
- Una carpeta con flujos de trabajo o carpetas dentro no se puede eliminar (409), así que eliminar una carpeta nunca es la forma en que desaparece un flujo de trabajo. Una carpeta no se puede mover dentro de sí misma ni de una de sus propias subcarpetas, ni a otro proyecto.

| Llamada | Qué hace |
|---|---|
| `GET /api/v1/folders` | Las carpetas de los proyectos que puede leer, en plano, cada una con su `parentId`; `?project=` limita. |
| `POST /api/v1/folders` | Crea una en `projectId`, dentro de `parentId` o en la raíz. |
| `PATCH /api/v1/folders/{folder}` | La renombra, o la mueve con `parentId` (cadena vacía para la raíz). |
| `DELETE /api/v1/folders/{folder}` | Elimina una carpeta vacía. |
| `PUT /api/v1/workflows/{workflow}/folder` | Pone un flujo de trabajo en una carpeta, o en la raíz con un `folderId` vacío. |
| `GET /api/v1/workflows?folder=` | Los flujos de trabajo de una carpeta, o `folder=none` para la raíz de cada proyecto. |

Cada flujo de trabajo que devuelve la API indica su `folderId`. Los permisos `folder.read`, `folder.create`, `folder.update` y `folder.delete` funcionan como los de las variables, y mover un flujo de trabajo requiere `workflow.update`. Los cambios de carpeta están en el registro de auditoría, y los movimientos como `workflow.moved`.

## Anotaciones de ejecuciones

En el editor: la página de cada ejecución tiene un cuadro de Anotación con un pulgar arriba o abajo, una nota y etiquetas, y la lista de ejecuciones filtra por etiqueta y por voto.

Una persona puede decir algo sobre una ejecución después de que ocurra: un pulgar arriba o abajo, una nota y etiquetas para encontrarla. "Primer lote bueno tras el cambio de matriz" y `scrap` son el tipo de cosas que van aquí.

```sh
curl -X PUT $CASCADE/api/v1/executions/$RUN/annotation -H "Authorization: Bearer $KEY" \
  -d '{"vote":"up","note":"first good batch after the die change","tags":["die-change","first-shift"]}'
```

- Un voto es `up`, `down` o vacío. Una nota tiene hasta 2000 caracteres. Una ejecución tiene hasta 20 etiquetas, de 1 a 40 caracteres cada una, sin caracteres de control, listadas una sola vez.
- `PUT` reemplaza toda la anotación, así que envíe todo lo que quiera conservar. Una anotación que no dice nada equivale a ninguna. `DELETE /api/v1/executions/{execution}/annotation` la borra.
- Cada ejecución que devuelve la API lleva su anotación, y el listado la lleva en cada fila. `GET /api/v1/executions?tag=scrap` y `?vote=down` filtran, y se combinan con los demás filtros.
- La anotación registra quién la dejó y cuándo, a partir de la misma identidad que usa el registro de auditoría.
- Anotar requiere el permiso `execution.annotate`, que tienen los operators, editors y admins y no los viewers. Los viewers leen las anotaciones.
- Una anotación desaparece cuando se elimina su ejecución. El registro de auditoría conserva `execution.annotated` y `execution.annotation_cleared` con el voto y las etiquetas, y registra solo que se dejó una nota, no lo que decía.

## Conservar las ejecuciones terminadas

En el editor: Ajustes, Conservar las ejecuciones terminadas durante (días). Por la API: `PATCH /api/v1/settings` con `{"retentionDays": 90}`, que requiere el permiso `instance.settings` como el resto de los ajustes.

De forma predeterminada se conserva para siempre cada ejecución terminada, como siempre ha sido. Defina un número de días y un main elimina las ejecuciones terminadas (correctas, fallidas o canceladas) que acabaron hace más que eso, con los datos de sus pasos, una vez por hora. 0 lo desactiva otra vez.

- Una ejecución en cola, en curso o en espera nunca se toca, ni tampoco una ejecución cuyo padre sigue activo, porque el padre va a preguntar qué hizo.
- Cada lote de hasta 500 ejecuciones es su propia transacción y escribe una fila `execution.pruned` en el registro de auditoría, con cuántas se fueron y la fecha de corte. Cambiar el ajuste escribe `instance.retention`.
- Todos los mains ejecutan la pasada, y dos a la vez solo encuentran menos que hacer.
- La limpieza de blobs sigue la misma pasada, y se ejecuta una vez por hora tenga o no activada la retención, así que una ejecución borrada a mano también se limpia. Vea "Limpieza de blobs" más abajo.

## Limitar una clave de API

En el editor: Ajustes, Peticiones de API por clave por minuto. Por la API: `PATCH /api/v1/settings` con `{"apiRateLimit": 120}`, con el permiso `instance.settings`.

De forma predeterminada una clave puede llamar tan a menudo como quiera. Defina un número y cada clave de API, y cada agente que haya iniciado sesión por MCP con una, puede hacer esa cantidad de peticiones por minuto. Una llamada por encima del límite recibe un `429` con una cabecera `Retry-After` que indica cuántos segundos esperar. Cada clave tiene su propio recuento, así que un script desbocado no puede agotar el de otra. Las personas con sesión iniciada en el editor no están sujetas a él.

El recuento es de cada proceso, porque eso es lo que protege al proceso: con tres mains, una clave puede hacer hasta el triple de ese número, repartido entre ellos. Un cambio en el ajuste llega a cada main en cinco segundos. Cambiarlo escribe `instance.api_rate_limit` en el registro de auditoría, con los números antiguo y nuevo.

Un webhook tiene su propio límite, definido en el disparador, y una cuenta se bloquea tras contraseñas incorrectas repetidas; ninguno de los dos cambia.

## Copia de seguridad y restauración

```
hotloop-cascade backup /backups/2026-11-20
hotloop-cascade restore /backups/2026-11-20
```

`backup` escribe un directorio nuevo con una copia consistente de la base de datos SQLite (tomada mientras el servidor funciona, con `VACUUM INTO`), el archivo de clave que sella cada credencial almacenada, los archivos de blobs y `manifest.json` con el SHA-256 de cada uno. Acepta los mismos ajustes `--database`, `--key-file` y `--blob-dir` que el servidor, desde las mismas variables de entorno. El directorio no debe existir todavía, o debe estar vacío; una copia de seguridad nunca se mezcla con una antigua. Sin archivo de clave no hay copia de seguridad, porque una base de datos sin su clave tiene credenciales que nadie puede leer.

`restore` los vuelve a poner, y antes hay que detener el servidor. Comprueba cada archivo contra el manifiesto antes de escribir nada, así que una copia dañada o incompleta no cambia nada. Se niega a sobrescribir una base de datos, o un archivo de clave distinto, que ya esté allí; `--replace` indica que lo quiere de verdad. Después arranque el servidor: pone el esquema al día, y rechaza una copia hecha por una versión más reciente que la suya.

PostgreSQL: `backup` escribe la clave, los blobs y el manifiesto, e imprime el comando `pg_dump --format=custom` que hace la parte de la base de datos, porque ese programa es el propio de PostgreSQL y la imagen de Cascade no lo incluye. `restore` vuelve a poner la clave y los blobs e imprime el comando `pg_restore`. Los blobs guardados en S3 o Azure no se copian; haga la copia de seguridad del bucket allí.

Antes de actualizar a una versión que migra, haga una: las migraciones solo van hacia delante, y volver a la imagen anterior necesita la copia de seguridad.

## Políticas de redacción de ejecuciones

En el editor: Ajustes, Redacción crea las políticas. Un flujo de trabajo elige una en el panel lateral del editor sin nada seleccionado, en Ajustes del flujo de trabajo.

La bóveda de credenciales ya mantiene los secretos fuera de todo lo que guarda una ejecución. Una política de redacción es para los datos que no son una credencial pero que tampoco deben estar en el historial de ejecuciones: un número de credencial de empleado, el nombre de un operario, un número de tarjeta que llegó por un webhook.

Una política es un nombre y unas reglas:

- **fields**: nombres de clave de los elementos. Una clave que nombra una política tiene todo su valor sustituido por `[redacted]`, a cualquier profundidad, sea cual sea el tipo del valor. La coincidencia ignora mayúsculas y minúsculas, y `*` y `?` funcionan como comodines, así que `*secret*` toma `plant_secret` y `SecretKey`.
- **patterns**: expresiones regulares, en la sintaxis RE2 de Go. Cada coincidencia dentro de cualquier texto se sustituye por `[redacted]`. Un patrón que coincide con el texto vacío se rechaza.
- **steps**: opcional. La política cubre solo los pasos listados. Vacío significa todos los pasos.
- **appliesToAll**: opcional. La política cubre todos los flujos de trabajo, la nombren o no.

Un flujo de trabajo elige una por su nombre en sus ajustes:

```yaml
settings:
  redaction: Badges
```

Qué hace y cuándo:

- Se ejecuta **cuando termina la ejecución**, en la misma transacción que la marca como terminada: correcta, fallida o detenida. Hasta entonces la ejecución tiene sus datos reales, porque el siguiente paso los necesita y un reinicio se reanuda desde ellos. Una ejecución en espera sigue teniendo sus datos reales.
- Depura la salida almacenada de cada paso, el mensaje de error almacenado de cada paso, el error propio de la ejecución y una respuesta de webhook almacenada. No toca el contenido de los archivos: una política lee datos de elementos, y un archivo es una referencia a bytes.
- Lo que se almacenó es de lo que parte una reproducción o un reintento desde la mitad de esa ejecución, así que una reproducción ve los valores depurados. Los elementos del disparador del flujo de trabajo están en la salida del primer paso, y también se depuran.
- Lee el flujo de trabajo tal como lo tenía esa ejecución, así que editar un flujo de trabajo, o la política, nunca cambia una ejecución que ya terminó.
- Un flujo de trabajo que nombra una política que no existe **falla cerrado**: sus ejecuciones no conservan ningún dato de elementos, como hace el ajuste de guardado `metadata`, y los `problems` del flujo de trabajo lo indican. Una política ausente nunca debe significar datos conservados que alguien quería depurar.
- Una política que nombran flujos de trabajo no se puede eliminar (409), y su nombre no puede cambiar. Las reglas sí.

| Llamada | Qué hace |
|---|---|
| `GET /api/v1/redaction-policies` | Todas las políticas. Cualquier persona con sesión iniciada puede leerlas, porque quienes escriben flujos de trabajo necesitan los nombres. |
| `POST /api/v1/redaction-policies` | Crea una. |
| `PUT /api/v1/redaction-policies/{policy}` | Reemplaza su descripción y sus reglas. |
| `DELETE /api/v1/redaction-policies/{policy}` | Elimina una que ningún flujo de trabajo nombre. |

Crear, cambiar y eliminar una política requiere el permiso de instancia `redaction.manage`, que tienen los propietarios y los administradores. Cada una está en el registro de auditoría como `redaction.created`, `redaction.updated` y `redaction.deleted`.

## Insights

En el editor: Insights, en la barra superior. Elija una ventana, un proyecto y un flujo de trabajo; muestra los totales, un gráfico y una tabla por día, y una tabla por flujo de trabajo.

`GET /api/v1/insights` suma las ejecuciones de una ventana: cómo terminaron, cuánto tardaron, por día y por flujo de trabajo.

```sh
curl "$CASCADE/api/v1/insights?from=2026-10-10&to=2026-10-14&project=$PROJECT" -H "Authorization: Bearer $KEY"
```

- `from` y `to` son una hora RFC 3339 o una fecha (medianoche UTC). Sin ninguno, son los últimos siete días hasta ahora. Lo máximo que responde son 366 días.
- `project` y `workflow` lo acotan. Sin ellos cuenta todos los proyectos en los que quien llama puede leer ejecuciones, así que los números de cada persona son los suyos.
- Una ejecución cuenta en el día UTC en que se creó.
- `totals` y cada fila de `days` y `workflows` llevan `total`, `succeeded`, `failed`, `canceled` y `unfinished` (en cola, en curso o en espera), el tiempo de ejecución medio y el más largo en milisegundos sobre las ejecuciones que tienen inicio y fin, y `failureRate`.
- `failureRate` es fallidas entre correctas más fallidas. Una ejecución cancelada no es un fallo y una sin terminar todavía no se ha decidido, así que ninguna entra. Es 0 cuando nada ha terminado en un sentido ni en otro.
- `days` lista cada día UTC de la ventana, con ceros en los días en que no se ejecutó nada, para que un gráfico no tenga huecos que adivinar. `workflows` son los 50 más activos, el más activo primero.

Lee las mismas filas de ejecuciones que la lista de ejecuciones, así que requiere el permiso `execution.read` y una clave con ese ámbito.

## Secretos externos

En el editor: Ajustes, Secretos externos. Añada un proveedor, pruébelo contra una ruta desde la misma tarjeta y vea cómo es la referencia para él.

El campo secreto de una credencial puede apuntar a un secreto guardado en HashiCorp Vault u OpenBao en lugar de contener el secreto. Rote la contraseña en el almacén y todos los flujos de trabajo usan la nueva en su siguiente ejecución, sin que nadie edite una credencial, y una copia de su base de datos nunca contiene la contraseña.

Una referencia se ve así, en cualquier campo secreto de una credencial:

```
secret://bao/plant/line-3/db#password
```

Ese es el proveedor llamado `bao`, el secreto en `plant/line-3/db` y su clave `password`. La credencial guarda ese texto, sellado como cualquier secreto. Nada a lo que apunta se almacena aquí: el valor se lee cuando una ejecución abre la credencial, se mantiene en memoria durante el tiempo de caché del proveedor y se depura de todo lo que guarda la ejecución, igual que una contraseña de la bóveda. Solo los campos secretos admiten referencias. Una referencia escrita en un campo que no es secreto es solo texto.

### Configurar un proveedor

Un proveedor es el servidor, cómo inicia sesión Cascade en él y dónde puede leer. Crearlo, cambiarlo y quitarlo es cosa de un propietario o administrador de la instancia, el permiso `secrets.manage`, y lo tiene que hacer una persona con sesión iniciada, no una clave de API.

```sh
curl -X POST $CASCADE/api/v1/secret-providers -H "X-CSRF-Token: ..." -d '{
  "name": "bao",
  "address": "https://bao.plant.example:8200",
  "authMethod": "approle", "roleId": "...", "secretId": "...",
  "allowedPaths": ["plant"]
}'
```

| Campo | Qué hace |
|---|---|
| `name` | De 1 a 40 letras minúsculas, dígitos y guiones. Está en cada referencia, así que no puede cambiar después. |
| `address` | La URL del servidor. |
| `mount`, `kvVersion` | Dónde está montado el motor KV (`secret` de forma predeterminada) y si es la versión 1 o 2 (2 de forma predeterminada). |
| `namespace` | Se envía como `X-Vault-Namespace`, para un espacio de nombres del servidor. |
| `authMethod` | `token` con `token`, o `approle` con `roleId` y `secretId`. `authMount` es donde está montado AppRole (`approle` de forma predeterminada). AppRole inicia sesión por sí mismo y otra vez cuando se agota su token. |
| `caCert` | Una autoridad certificadora PEM en la que confiar para el servidor, cuando su certificado no es de una en la que confíe el sistema. |
| `allowedPaths` | **Obligatorio.** Los únicos lugares desde los que puede leer una referencia. `plant` permite `plant` y todo lo que hay bajo él, y no `plantation`. |
| `projects` | Opcional. Los únicos proyectos que pueden usar el proveedor. Si se deja vacío, puede cualquier proyecto. |
| `cacheSeconds` | Cuánto tiempo se mantiene en memoria un secreto leído, de 0 a 3600. 30 de forma predeterminada. 0 lee cada vez. |

Cómo inicia sesión Cascade (el token, o el id y el secreto de AppRole) se sella bajo la clave de la instancia, se vuelve a envolver con una rotación de claves junto con todo lo demás y no lo muestra ninguna llamada. Omítalo en un cambio y se conserva el almacenado.

`POST /api/v1/secret-providers/{provider}/test` inicia sesión y, con un `path`, lo lee, y dice si funcionó. Nunca devuelve un valor. `GET /api/v1/secret-providers` lista los proveedores para cualquier persona con sesión iniciada, porque quienes crean credenciales necesitan los nombres. Las llamadas están en el registro de auditoría como `secrets.provider_created`, `_updated` y `_deleted`.

### Lo que no hará

- **Un proveedor necesita rutas permitidas.** Un token de Vault suele poder leer mucho más de lo que debería poder nombrar quien edita credenciales, y sin una lista, cualquiera que pueda crear una credencial podría apuntar una a cualquier secreto al que llegue el token y hacer que un flujo de trabajo lo envíe a otra parte. Dele al proveedor las rutas que necesitan sus credenciales, y a su política lo mismo.
- **Una referencia se comprueba cuando se guarda la credencial**, no solo cuando la usa una ejecución: el proveedor tiene que existir, estar abierto al proyecto de la credencial y permitir la ruta. Una ruta con una parte vacía, un punto o un `..` se rechaza.
- **Una ejecución que no puede leer el secreto falla y dice por qué**, nombrando el proveedor, la ruta y la clave y nunca un valor: no existe ese proveedor, una ruta que el proveedor no permite, no hay secreto allí, no existe esa clave, o la propia negativa del servidor (una política que no permite la lectura es "permission denied").
- **Eliminar un proveedor no edita las credenciales.** Las que apuntan a él fallan cuando una ejecución las abre, diciendo que el proveedor ya no existe.
- Un valor secreto que de verdad empieza por `secret://` no se puede almacenar como secreto, porque se lee como una referencia.
- Los valores que son números o verdadero o falso se leen como texto. Un valor que es un objeto entero o una lista se rechaza.
## Envío de logs

En el editor: Ajustes, Envío de logs (propietarios y administradores). Cada destino muestra cuánto ha enviado, cuándo entregó por última vez y su último error, con un botón que envía un evento de prueba.

Envíe el registro de auditoría, y una línea por cada ejecución que termina, a los lugares donde una planta ya guarda sus logs: un servidor syslog, o cualquier cosa que acepte logs OTLP por HTTP (un colector de OpenTelemetry, Loki, una plataforma de logs). Los eventos salen según ocurren, así que un SIEM ve un inicio de sesión fallido en segundos, y la pista de auditoría existe en algún lugar donde un administrador de esta instancia no puede reescribirla.

Un destino es un lugar. Cree tantos como necesite:

```sh
curl -X POST $CASCADE/api/v1/log-destinations -H "X-CSRF-Token: ..." -d '{
  "name": "plant syslog", "kind": "syslog",
  "address": "syslog.plant.example:6514", "network": "tls",
  "caCert": "-----BEGIN CERTIFICATE-----..."
}'
curl -X POST $CASCADE/api/v1/log-destinations -H "X-CSRF-Token: ..." -d '{
  "name": "collector", "kind": "otlp", "endpoint": "https://otel.plant.example/v1/logs",
  "headers": {"Authorization": "Bearer ..."}
}'
```

Crear, cambiar y quitar destinos es cosa de propietarios y administradores de la instancia (`logstream.manage`), por una persona con sesión iniciada y no por una clave de API, porque un destino es adonde va el registro de auditoría. Las llamadas están en el registro de auditoría como `logstream.destination_created`, `_updated` y `_deleted`.

### Qué se envía

- **Eventos de auditoría**: cada fila del registro de auditoría, con su número de secuencia y su hash. El número de secuencia y el hash son la forma en que un receptor detecta una repetición, y el hash es el propio de la fila, así que la cadena se puede comprobar con lo que llegó. Un inicio de sesión fallido o rechazado es una advertencia, todo lo demás un aviso.
- **Eventos de ejecución**: uno por cada ejecución que termina, sea cual sea el modo en que acabe: el id de la ejecución, el id y el nombre del flujo de trabajo, su proyecto, estado, modo, cuándo se creó, empezó y terminó, cuánto duró, y su error y el paso en que falló. Una ejecución fallida es un error, una detenida un aviso, una correcta informativa. Se envían un par de segundos después de que termina la ejecución.
- **Nunca datos de elementos.** Lo que vieron y generaron los pasos de una ejecución se queda en la ejecución, donde lo protegen las políticas de redacción. El registro de auditoría nunca contiene un secreto.

`events` elige uno o ambos (`["audit"]`, `["execution"]`, ambos de forma predeterminada). `start` dice dónde empieza un destino nuevo: `now`, el valor predeterminado, envía lo que ocurre después de crearlo, y `beginning` envía primero todo el registro de auditoría y cada ejecución terminada.

### Syslog

Un mensaje es RFC 5424: `<priority>1 time host hotloop-cascade pid msgid - {json}`, con el evento como una línea de JSON. La prioridad es la facility por ocho más la severidad. El msgid es la acción de auditoría (`workflow.saved`) o el estado de la ejecución.

| Campo | Qué hace |
|---|---|
| `address` | `host:port`. |
| `network` | `tcp` (el valor predeterminado), `udp` o `tls`. |
| `framing` | Para `tcp` y `tls`: `octet` (el conteo de octetos de RFC 6587, el valor predeterminado) o `newline`. UDP es un datagrama cada uno. |
| `facility` | `local0` de forma predeterminada; cualquier nombre de facility de syslog. |
| `appName` | El APP-NAME de la cabecera, `hotloop-cascade` de forma predeterminada. |
| `caCert`, `serverName` | Para `tls`: la autoridad en la que confiar, y el nombre para el que tiene que ser el certificado cuando no es el host. No existe ningún ajuste que se salte la comprobación. |

### OTLP

Los logs van a `endpoint` como OTLP por HTTP con un cuerpo JSON: un registro de log por cada evento, con el evento como JSON en su cuerpo y sus partes como atributos (`cascade.event`, `cascade.action`, `cascade.status`, `cascade.project`, `cascade.actor.name` y así sucesivamente) para que un receptor pueda filtrar sin analizar. El recurso dice `service.name=hotloop-cascade`, su versión y el host. `headers` se envían con cada petición, para un token o un tenant. Se sellan bajo la clave de la instancia, se vuelven a envolver con una rotación de claves y nunca se muestran: la lista solo dice sus nombres. `caCert` y `serverName` funcionan como en syslog.

### Cómo se comporta la entrega

- **Al menos una vez, en orden.** Un destino recuerda la última fila de auditoría y la última ejecución terminada que envió. Uno que está caído recibe todo lo que se perdió cuando vuelve, en orden, y un reinicio continúa donde se detuvo. Si el emisor se corta entre enviar y anotarlo, esos eventos se envían otra vez, y para eso están los números de secuencia.
- **Un destino que falla espera cada vez más**, un segundo y doblando hasta cinco minutos, y su estado dice qué falló y cuándo: `lastError`, `lastErrorAt`. Un éxito lo borra. No se descarta nada mientras está caído, así que el límite es el registro de auditoría, no una cola.
- **Un solo emisor a la vez.** Con varios mains, el que tiene el arrendamiento de un destino le envía; los demás esperan y toman el relevo si se detiene.
- **Cambiar un destino conserva su posición.** Moverlo a otra dirección nunca reenvía ni omite nada. Las cabeceras que se dejan fuera de un cambio se conservan, y un objeto vacío las borra. El nombre y el tipo no pueden cambiar.
- `POST /api/v1/log-destinations/{destination}/test` envía un evento inventado por la misma ruta y dice si llegó, con el motivo cuando no. No mueve nada.
- `GET /api/v1/log-destinations` muestra el estado de cada uno: cuántos eventos ha enviado, el último número de secuencia de auditoría entregado, cuándo tuvo éxito por última vez y su último error.

## Dónde viven los datos grandes

Los archivos y las cargas grandes que lleva una ejecución (un PDF descargado, un fotograma de cámara, una hoja de cálculo) se guardan como blobs, aparte de la base de datos. De forma predeterminada están en el disco de la instancia. Defina `HOTLOOP_CASCADE_BLOB_STORE` para ponerlos en un bucket de S3 o en un contenedor de blobs de Azure, de modo que el main se pueda reconstruir sin llevarlos y varios mains compartan una sola copia.

| Ajuste | Significado |
| --- | --- |
| `HOTLOOP_CASCADE_BLOB_STORE` | `fs` (el valor predeterminado), `s3` o `azure`. |
| `HOTLOOP_CASCADE_BLOB_SPOOL_DIR` | Dónde espera un blob mientras se calcula su hash antes de subirlo. Por defecto `blob-spool` en el directorio de datos. |
| `HOTLOOP_CASCADE_BLOB_S3_BUCKET`, `_ACCESS_KEY`, `_SECRET_KEY` | Obligatorios para `s3`. El secreto también lee `_SECRET_KEY_FILE`. |
| `HOTLOOP_CASCADE_BLOB_S3_ENDPOINT`, `_REGION` | Omita el endpoint para AWS. Defínalo para Garage, MinIO o Ceph. |
| `HOTLOOP_CASCADE_BLOB_S3_PATH_STYLE` | `true` o `false`. El estilo de ruta es el predeterminado siempre que se define un endpoint. |
| `HOTLOOP_CASCADE_BLOB_S3_CA_FILE` | Un paquete de CA para un endpoint con certificado privado. |
| `HOTLOOP_CASCADE_BLOB_S3_PREFIX` | Una carpeta dentro del bucket, para que un bucket pueda contener más de una instancia. |
| `HOTLOOP_CASCADE_BLOB_AZURE_CONTAINER` | Obligatorio para `azure`. |
| `HOTLOOP_CASCADE_BLOB_AZURE_CONNECTION_STRING`, o `_ACCOUNT` con `_KEY`, o `_SAS` | Una forma de iniciar sesión. Los secretos también leen una forma `_FILE`. |
| `HOTLOOP_CASCADE_BLOB_AZURE_ENDPOINT`, `_PREFIX` | Un endpoint para Azurite o una nube privada, y una carpeta dentro del contenedor. |

En el chart, defínalos mediante `env` y `extraEnv`, con los secretos procedentes de un Secret de Kubernetes.

- **Direccionado por contenido.** Un blob se guarda bajo su SHA-256 (`sha256/ab/cdef...`), así que el mismo archivo se guarda una sola vez, sin importar cuántas ejecuciones lo lleven. Volver a ponerlo no hace nada, incluso cuando dos ejecuciones lo hacen al mismo tiempo.
- **Con hash antes de subir.** Los datos se leen una vez en el archivo de spool, se calcula su hash y luego se envían, así que la memoria se mantiene plana para cualquier tamaño. Un blob por encima del límite de tamaño se rechaza, y una subida cancelada no deja nada en el bucket.
- **Comprobado al salir.** Una lectura se verifica contra su hash mientras se transmite, así que un objeto dañado falla de forma ruidosa en lugar de entregar datos incorrectos a una ejecución.
- **Tamaño.** Una sola subida se hace como transferencia multiparte en S3 y por bloques en Azure, así que no se aplica el límite habitual de 5 GiB por petición.
- **Limpieza de blobs.** Una vez por hora una pasada elimina los blobs a los que no apunta ninguna fila: una salida de paso que se guardó como archivo porque era demasiado grande para la base de datos, y los adjuntos que llevan los elementos. Un blob se conserva mientras cualquier ejecución de paso, salida parcial, respuesta guardada o flujo de trabajo siga nombrándolo, directamente o a través de una salida almacenada que contiene el adjunto, así que un archivo compartido por dos ejecuciones con salida idéntica permanece hasta que desaparece la última. Solo se examinan los blobs escritos por última vez hace más de 24 horas, y poner bytes que ya están almacenados cuenta como escribirlos de nuevo tras la primera hora, así que un archivo que un paso acaba de almacenar y todavía no registró nunca se elimina. Una pasada que no puede leer una salida almacenada no elimina nada. Escribe una fila `blobs.collected` en el registro de auditoría con cuántos archivos y bytes se fueron. La pasada da por hecho que el almacén de blobs pertenece a una instancia (los workers y el main de una instalación lo comparten); dos instalaciones apuntadas al mismo bucket o carpeta eliminarían cada una los archivos de la otra, así que dele a cada una el suyo (`HOTLOOP_CASCADE_BLOB_S3_PREFIX` existe para esto).
- **Cambiar de almacén más adelante.** Los blobs existentes se quedan donde se escribieron. Muévalos al nuevo almacén antes de cambiar, porque una referencia a un blob que el nuevo almacén no tiene es un archivo que falta.

Estos dos backends se prueban contra Garage y Azurite en la pila de pruebas, con la misma suite de conformidad que el almacén en disco: poner y leer, blobs vacíos, deduplicación bajo concurrencia, corrupción, el límite, ids incorrectos, eliminar, listar, una subida cancelada y una subida en streaming de 192 MiB con una comprobación del heap.

Lo que significa para usted: un main reconstruido o sustituido encuentra todos los archivos que llevaban sus ejecuciones, sin copiar nada.
