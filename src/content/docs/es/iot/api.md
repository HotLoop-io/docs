---
title: "La API HTTP"
description: "Cada llamada que HotLoop responde por HTTP, lo que necesita, lo que acepta y lo que devuelve. La interfaz web no usa nada más."
---

Todas las llamadas que atiende el Gateway por HTTP, lo que necesita cada una, lo que recibe y lo que devuelve. La interfaz web no usa nada más: no hay una API privada detrás de las pantallas, así que todo lo que puede hacer la interfaz lo puede hacer un script con las mismas llamadas y los mismos permisos.

Esta página se comprueba contra el código. Por eso la lista de rutas y de quién puede llamarlas no es una descripción de cómo era la API en otro momento. Las formas de las solicitudes y las respuestas de más abajo se tomaron de un Gateway en ejecución; las pruebas no las comprueban, así que si cambia un manejador, cambie también su sección aquí.

El contexto de cada función está en su propia página: [Autenticación y usuarios](/es/iot/authentication/), [Entidades](/es/iot/entities/), [el árbol de equipos y las etiquetas](/es/iot/equipment/), [Automatizaciones](/es/iot/automations/), [Informes programados](/es/gateway/reports/), [Gestión de flota](/es/gateway/fleet/), [Notificaciones de alarmas](/es/iot/notifications/), [Copias de seguridad y restauración](/es/iot/backup/) y [MCP](/es/iot/mcp/). Esta página es la lista; aquellas explican el porqué.

## Convenciones

### Dónde está

Todo está en el único puerto HTTP de la aplicación (`HOTLOOP_LISTEN_ADDR`, `:8080` por defecto). Detrás de un proxy que sirve la aplicación bajo una ruta, configure `HOTLOOP_BASE_PATH` y el Gateway la quita, de modo que `/hotloop/api/devices` y `/api/devices` son la misma llamada. Las rutas de más abajo se escriben sin ella.

### Iniciar sesión: una cookie o un token bearer

Toda ruta `/api/` necesita una sesión, salvo el inicio de sesión (con contraseña, o con PIN o credencial en un panel de quiosco), los webhooks entrantes y los enlaces para reconocer alarmas, y cada uno de ellos lleva su propia prueba en la solicitud. `POST /api/auth/login` responde con un token y además lo guarda en la cookie `iiot_session` (HttpOnly, SameSite=Lax, Secure cuando la solicitud llegó por TLS o con `X-Forwarded-Proto: https`). Un navegador usa la cookie y nunca ve el token. Un script envía el token en su lugar:

```
Authorization: Bearer 3f9c...e1
```

Ambos son la misma sesión y se comprueban igual. Una sesión dura `HOTLOOP_AUTH_SESSION_TTL` (12 horas por defecto). Sin ella, toda ruta `/api/` responde:

```
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="hotloop"

{"error":"not logged in"}
```

o `"the session is invalid or has expired"` para un token revocado o vencido, o `"this account no longer has access"` para una cuenta deshabilitada.

Con `HOTLOOP_AUTH_INSECURE=true` no hay inicio de sesión: no se comprueba nada, todos los permisos de abajo se conceden a todos, y el nombre que queda registrado en una escritura viene de la cabecera `X-EmberNET-User`, `X-Forwarded-User`, `X-Auth-Request-User`, `X-Remote-User` o `X-Forwarded-Email` del proxy, o es `operator` si no hay ninguna. Eso solo es razonable detrás de una NetworkPolicy que deje llegar al pod únicamente al proxy del panel. Consulte [Autenticación y usuarios](/es/iot/authentication/#funcionar-sin-inicio-de-sesión).

MCP va aparte: tiene su propio token bearer (`HOTLOOP_MCP_TOKEN`) y nunca mira una sesión. Consulte [MCP](#mcp).

### Permisos

Un usuario con sesión tiene una lista de permisos, que vienen de su rol o están fijados en la cuenta. Una ruta que exige uno que el usuario no tiene responde:

```
HTTP/1.1 403 Forbidden

{"error":"viewer1 does not have the \"values.write\" permission"}
```

La [tabla de permisos](#permisos) indica qué rol tiene cada permiso.

### Errores

Todo fallo que produce la propia API es un JSON con una sola forma:

```json
{"error": "value is outside the tag's configured range: 120 is outside 0..95"}
```

`/readyz` añade un `detail`, y una llamada de servicio fallida añade las escrituras que llegó a hacer. El mensaje está escrito para la persona que lo lee: dice qué falló y, cuando existe, qué hacer en su lugar. Muéstrelo tal cual.

| Estado | Cuándo |
|---|---|
| 400 | La solicitud es incorrecta: un cuerpo mal formado, un campo que no pasa la validación, un campo desconocido, un parámetro que falta, un servicio desconocido |
| 401 | No hay sesión, ha caducado, o la contraseña es incorrecta al iniciar sesión |
| 403 | El usuario no tiene el permiso, o la puerta de escritura rechazó la escritura por política: escrituras desactivadas, tag no armado, entidad deshabilitada |
| 404 | Lo que se nombra en la ruta o en el cuerpo no existe |
| 409 | Ya existe, o está en un estado que no admite esto: una alarma que no está pospuesta, un nodo que aún tiene hijos, una entidad sin estado conocido que alternar, un script que ya se está ejecutando, una receta que fue rechazada o que ya se está aplicando |
| 422 | Un valor que la puerta de escritura rechazó por su contenido: fuera del rango del tag, fuera del paso de una entidad |
| 502 | El dispositivo respondió con un error propio y el cuerpo son sus palabras; o una receta empezó y no todos los destinos se completaron, y el cuerpo dice cuáles salieron y cuáles no |
| 503 | El dispositivo no está conectado, o el motor de alarmas no está en marcha |
| 500 | Un fallo dentro del servidor. El cuerpo es `internal error (ref …); the server log has the detail under that ref` y nada más, y el registro tiene el error completo bajo esa referencia. El único 500 con un mensaje real es una pulsación de botón cuya liberación no salió, porque ese mensaje dice exactamente qué comprobar |

Todo lo que la API no sabe ubicar es un 500, nunca un 400. Una caída de la base de datos respondida como 400 le dice al operador que escribió algo mal, y se pone a buscar un error de tecleo que no existe.

Dos fallos no vienen de la API y son texto plano, no JSON: una ruta que no coincide con ninguna responde `404 page not found`, y una ruta conocida llamada con el método equivocado responde `405 method not allowed`.

Una escritura rechazada nunca es un 500. Una pantalla de planta que muestra un rechazo de política como un fallo del servidor enseña a los operadores a ignorar los errores.

### Cuerpos

Los cuerpos de las solicitudes son JSON, de 4 MiB como máximo (un webhook entrante, 1 MiB). **Los campos desconocidos se rechazan**, no se ignoran:

```json
{"error":"request body: json: unknown field \"x\""}
```

Un ajuste mal escrito que se descarta en silencio parece exactamente uno que funcionó, así que el decodificador responde que no.

`POST` y `PUT` sobre dispositivos, tags, alarmas, automatizaciones, miembros de la flota e informes reemplazan el objeto completo: un campo omitido toma su valor cero, y un booleano omitido es `false`. Lea, cambie y devuelva. Las excepciones son los `PUT` de entidades y de equipos, que cambian solo los campos que usted envía, y las credenciales de los dispositivos, que se conservan cuando se omiten (vea más abajo).

### Los secretos son de solo escritura

Una credencial guardada en un dispositivo (una contraseña de broker, una cabecera HTTP, una contraseña en la dirección) nunca se devuelve, a ningún rol, administrador incluido. Aparece como `[redacted]`:

```json
"config": {"clientId": "docs-api-tankfarm", "password": "[redacted]", "username": "tank"}
```

Al guardar el dispositivo, envíe el marcador (o deje fuera la clave) para conservar el valor guardado, envíe un valor nuevo para reemplazarlo, y envíe `""` o `null` para borrarlo. Un dispositivo nuevo no se puede guardar con el marcador, y se rechaza un guardado que pase el dispositivo a otro host con una credencial conservada, para que una contraseña guardada no se pueda llevar a un oyente ajeno. Las reglas completas están en [Autenticación y usuarios](/es/iot/authentication/#las-credenciales-de-dispositivo-son-de-solo-escritura). Lo mismo vale para cualquier otra credencial que guarda el Gateway: los ajustes muestran `set` o `not set`, el diagnóstico elimina las credenciales de los destinos MCP salientes, y nada en esta API devuelve un hash de contraseña ni un token de sesión, salvo el que le entrega el inicio de sesión.

### camelCase, salvo donde es snake_case

La mayor parte de la API es camelCase (`deviceId`, `pollIntervalMs`, `createdAt`), como desde la primera versión y como exige el contrato `TagValue` del panel de EmberNet.

Los endpoints de entidades, estados, servicios, equipos y etiquetas son snake_case (`entity_id`, `last_changed`, `parent_id`, `label_id`). Es a propósito: la API de entidades usa la forma habitual de entidad, estado y servicio, de modo que todo lo que ya la habla habla también esta, y el árbol de equipos es el registro de áreas del modelo de entidades, con la forma que esperan los mismos consumidores. Donde ambos se encuentran, cada lado conserva su estilo: un dispositivo tiene `equipmentId`, una entidad tiene `equipment_id`.

### Horas, duraciones y claves de tag

- **Las marcas de tiempo** son RFC 3339 en UTC, con segundos fraccionarios cuando los hay: `2026-09-27T20:21:58.255869Z`. El ajuste de zona horaria para mostrar cambia lo que enseña la interfaz, nunca lo que devuelve la API.
- **Una hora que no ha ocurrido se omite.** Una regla que nunca se ha ejecutado no tiene `lastRun`, un dispositivo que nunca se ha consultado no tiene `lastPoll` ni `lastGood`, una alarma que nadie reconoció no tiene `ackedAt`, un miembro de la flota que nunca se ha visto no tiene `lastSeen`. Un campo de hora ausente significa nunca. Nunca verá la hora cero de Go, `0001-01-01T00:00:00Z`, en una respuesta ni en un evento del flujo. Una docena de campos la enviaban, y la pantalla de automatizaciones mostraba una regla que nunca se había ejecutado como ejecutada por última vez hace 739887 días. Una prueba recorre cada ruta y cada campo de hora del código para que siga así.
- **Los sparklines** son la excepción: allí `timestamps` está en milisegundos Unix, porque va directo a un gráfico.
- **Las duraciones** llevan su unidad en el nombre: `pollIntervalMs`, `onDelaySec`, `minutes`, `durationMs`. `uptime` en el estado es una cadena de duración de Go (`11m13s`).
- **Una clave de tag** es `device/tag`, la forma que toman todos los parámetros `?tag=` y todos los campos `tag`. Los nombres de tag pueden contener barras (rutas OPC UA, topics MQTT), así que solo la primera barra separa: `plc-1/Line/Zone 1` es el tag `Line/Zone 1` del dispositivo `plc-1`.
- **Un parámetro de consulta numérico** que no es un número se ignora y se usa el valor por defecto, así que `?limit=abc` es lo mismo que no poner `?limit`.
- **Las listas vacías** son `[]`, nunca `null`, en toda respuesta y todo evento del flujo, a cualquier profundidad. No necesita comprobar null antes de `.length`. Un `null` que vea nunca es una lista: es uno de los campos documentados que admiten nulo, como el `equipment_id` de una entidad o el `parent_id` de un nodo raíz. Un campo de lista marcado como opcional aun así puede omitirse por completo.

### Funciones opcionales

La flota, las notificaciones, las copias de seguridad y los informes programados están desactivados salvo que se defina su variable `HOTLOOP_*_ENABLED`. Con la función desactivada, su ruta de listado sigue respondiendo 200, con `"configured": false` y una lista vacía, para que una pantalla pueda decir «no activado» en lugar de «aquí no hay nada». Todas las demás rutas de esa función responden 400 con un error que nombra la variable:

```json
{"error":"backups are not enabled (HOTLOOP_BACKUP_ENABLED)"}
```

`GET /api/sites` hace lo mismo cuando no hay servidores MCP salientes configurados.

### No está en este producto

HotLoop se entrega como IoT, Edge, Gateway y Edge Relay a partir de una sola base de código, y una función que un producto no tiene no está desactivada, sino que no está en el binario. En IoT, Edge y Gateway sus rutas siguen respondiendo, tras la misma comprobación de permisos, con un 404 que lo dice y nombra los dos extremos, de modo que un script distinga «caja equivocada» de «URL equivocada»:

```json
{"error":"scheduled reports are part of HotLoop Gateway; this is HotLoop IoT","product":"iot","feature":"reports"}
```

No es un 400, porque no hay variable que lo arregle, ni un 5xx, porque nada ha fallado. `GET /api/status` dice de entrada qué producto respondió y qué funciones tiene, para que un cliente pueda preguntar en lugar de sondear.

### Todo lo que cambia algo queda registrado

Cada alta, cambio, baja, escritura, reconocimiento e inicio de sesión queda en el registro del sistema (`GET /api/events`) con el nombre del usuario, y cada escritura en un tag, rechazada o no, queda en la auditoría de escrituras (`GET /api/writes`). La API no tiene un camino silencioso.

## Permisos

Quién tiene qué. Una cuenta con una lista de permisos explícita tiene exactamente lo que esa lista nombra, en lugar del conjunto de su rol. `*` concede todo y `resource.*` concede todo lo que hay bajo un recurso (`reports.*`). El rol admin es `*`.

| Permiso | viewer | operator | admin |
|---|---|---|---|
| `status.read` | sí | sí | sí |
| `devices.read` | sí | sí | sí |
| `devices.write` | no | no | sí |
| `tags.read` | sí | sí | sí |
| `tags.write` | no | no | sí |
| `values.read` | sí | sí | sí |
| `values.write` | no | sí | sí |
| `board.write` | no | sí | sí |
| `entities.read` | sí | sí | sí |
| `entities.write` | no | no | sí |
| `helpers.write` | no | sí | sí |
| `equipment.read` | sí | sí | sí |
| `equipment.write` | no | no | sí |
| `alarms.read` | sí | sí | sí |
| `alarms.write` | no | no | sí |
| `alarms.ack` | no | sí | sí |
| `automations.read` | sí | sí | sí |
| `automations.write` | no | no | sí |
| `automations.trigger` | no | sí | sí |
| `scripts.read` | sí | sí | sí |
| `scripts.run` | no | sí | sí |
| `scripts.write` | no | no | sí |
| `recipes.read` | sí | sí | sí |
| `recipes.apply` | no | sí | sí |
| `recipes.write` | no | no | sí |
| `blueprints.read` | sí | sí | sí |
| `blueprints.apply` | no | sí | sí |
| `blueprints.write` | no | no | sí |
| `dashboards.read` | sí | sí | sí |
| `dashboards.write` | no | no | sí |
| `energy.read` | sí | sí | sí |
| `energy.write` | no | no | sí |
| `fleet.read` | sí | sí | sí |
| `fleet.write` | no | sí | sí |
| `fleet.rebirth` | no | sí | sí |
| `fleet.restart` | no | no | sí |
| `fleet.update` | no | no | sí |
| `fleet.config` | no | no | sí |
| `notify.test` | no | no | sí |
| `notify.escalation` | no | no | sí |
| `backup.read` | no | no | sí |
| `backup.run` | no | no | sí |
| `reports.read` | sí | sí | sí |
| `reports.run` | no | sí | sí |
| `reports.write` | no | no | sí |
| `sites.read` | sí | sí | sí |
| `settings.read` | sí | sí | sí |
| `settings.write` | no | no | sí |
| `events.read` | sí | sí | sí |
| `logbook.read` | sí | sí | sí |
| `users.manage` | no | no | sí |

La línea es la misma en todas partes: un operador maneja la planta (escribe valores, reconoce alarmas, dispara automatizaciones, da un toque a un relé), y solo un administrador cambia cómo está configurada la planta, o hace algo hacia el exterior en nombre del Gateway (reiniciar un relé, enviarle su configuración, mandar una página de prueba, definir un informe que envía datos de la planta por correo a algún sitio).

## Índice de endpoints

La columna de permiso dice qué comprueba la ruta. `session` significa cualquier usuario con sesión, sin ningún permiso más. `none` significa que tampoco hay sesión, y la sección explica por qué. `(in handler)` significa que la comprobación se hace dentro del manejador y no delante de él, y la sección explica por qué.

La columna de producto indica el HotLoop más pequeño que tiene la ruta: `all` es IoT, Edge y Gateway, `edge` es Edge y Gateway, `gateway` es solo el Gateway. Todos los productos registran todas las rutas y comprueban en ellas el mismo permiso. En un producto que no la tiene, la ruta responde 404 e indica dónde está; consulte [No está en este producto](#no-está-en-este-producto).

| Método | Ruta | Permiso | Producto |
|---|---|---|---|
| `GET` | `/healthz` | none | all |
| `GET` | `/readyz` | none | all |
| `POST` | `/api/auth/login` | none | all |
| `POST` | `/api/auth/kiosk` | none | all |
| `POST` | `/api/auth/logout` | session | all |
| `POST` | `/api/auth/activity` | session | all |
| `GET` | `/api/auth/session` | session | all |
| `POST` | `/api/auth/password` | session | all |
| `GET` | `/api/users` | `users.manage` | all |
| `POST` | `/api/users` | `users.manage` | all |
| `PUT` | `/api/users/{username}` | `users.manage` | all |
| `DELETE` | `/api/users/{username}` | `users.manage` | all |
| `POST` | `/api/users/{username}/password` | `users.manage` | all |
| `DELETE` | `/api/users/{username}/lockout` | `users.manage` | all |
| `PUT` | `/api/users/{username}/pin` | `users.manage` | all |
| `DELETE` | `/api/users/{username}/pin` | `users.manage` | all |
| `GET` | `/api/opcua/certificates` | `users.manage` | all |
| `GET` | `/api/users/{username}/certificates` | `users.manage` | all |
| `POST` | `/api/users/{username}/certificates` | `users.manage` | all |
| `POST` | `/api/users/{username}/certificates/{thumbprint}/revoke` | `users.manage` | all |
| `DELETE` | `/api/users/{username}/certificates/{thumbprint}` | `users.manage` | all |
| `GET` | `/api/status` | `status.read` | all |
| `GET` | `/api/protocols` | `status.read` | all |
| `GET` | `/api/diagnostics` | `status.read` | all |
| `GET` | `/api/devices` | `devices.read` | all |
| `POST` | `/api/devices` | `devices.write` | all |
| `GET` | `/api/devices/{id}` | `devices.read` | all |
| `DELETE` | `/api/devices/{id}` | `devices.write` | all |
| `POST` | `/api/devices/{id}/enabled` | `devices.write` | all |
| `POST` | `/api/devices/{id}/browse` | `devices.read` | all |
| `POST` | `/api/devices/{id}/import` | `tags.write` | all |
| `GET` | `/api/devices/{id}/network` | `devices.read` | all |
| `PUT` | `/api/devices/{id}/network` | `devices.write` | all |
| `DELETE` | `/api/devices/{id}/network` | `devices.write` | all |
| `GET` | `/api/unifi/{id}/networks` | `devices.read` | all |
| `PUT` | `/api/unifi/{id}/networks/{network}` | `devices.write` | all |
| `POST` | `/api/unifi/{id}/networks/{network}/accept-all` | `devices.write` | all |
| `GET` | `/api/unifi/{id}/known` | `devices.read` | all |
| `PUT` | `/api/unifi/{id}/networks/{network}/known/{mac}` | `devices.write` | all |
| `DELETE` | `/api/unifi/{id}/networks/{network}/known/{mac}` | `devices.write` | all |
| `GET` | `/api/unifi/{id}/clients` | `devices.read` | all |
| `GET` | `/api/unifi/consoles` | `devices.read` | all |
| `GET` | `/api/unifi/{id}/overview` | `devices.read` | all |
| `GET` | `/api/unifi/{id}/topology` | `devices.read` | all |
| `GET` | `/api/unifi/{id}/devices` | `devices.read` | all |
| `GET` | `/api/unifi/{id}/wifi` | `devices.read` | all |
| `GET` | `/api/unifi/{id}/events` | `devices.read` | all |
| `POST` | `/api/unifi/{id}/starter-alarms` | `alarms.write` | all |
| `GET` | `/api/discovery` | `devices.read` | all |
| `GET` | `/api/discovery/{source}/{key}` | `devices.read` | all |
| `POST` | `/api/discovery/{source}/{key}/accept` | `devices.write` | all |
| `POST` | `/api/discovery/{source}/{key}/ignore` | `devices.write` | all |
| `POST` | `/api/discovery/{source}/{key}/unignore` | `devices.write` | all |
| `POST` | `/api/discovery/{source}/{key}/review/apply` | `devices.write` | all |
| `POST` | `/api/discovery/{source}/{key}/review/reject` | `devices.write` | all |
| `GET` | `/api/network-discovery` | `devices.read` | all |
| `GET` | `/api/network-discovery/{key}` | `devices.read` | all |
| `POST` | `/api/network-discovery/{key}/accept` | `devices.write` | all |
| `POST` | `/api/network-discovery/{key}/ignore` | `devices.write` | all |
| `POST` | `/api/network-discovery/{key}/unignore` | `devices.write` | all |
| `POST` | `/api/network-discovery/probe` | `devices.write` | all |
| `GET` | `/api/integrations` | `devices.read` | all |
| `POST` | `/api/integrations/{id}/probe` | `devices.write` | all |
| `POST` | `/api/integrations/{id}/setup` | `devices.write` | all |
| `GET` | `/api/broker/logins` | `users.manage` | all |
| `POST` | `/api/broker/logins` | `users.manage` | all |
| `PUT` | `/api/broker/logins/{name}` | `users.manage` | all |
| `DELETE` | `/api/broker/logins/{name}` | `users.manage` | all |
| `GET` | `/api/mqtt/brokers` | `devices.read` | all |
| `POST` | `/api/mqtt/brokers` | `devices.write` | all |
| `PUT` | `/api/mqtt/brokers/{id}` | `devices.write` | all |
| `DELETE` | `/api/mqtt/brokers/{id}` | `devices.write` | all |
| `GET` | `/api/tags` | `tags.read` | all |
| `POST` | `/api/tags` | `tags.write` | all |
| `DELETE` | `/api/tags/{device}/{name}` | `tags.write` | all |
| `GET` | `/api/values` | `values.read` | all |
| `GET` | `/api/sparkline` | `values.read` | all |
| `GET` | `/api/board` | `values.read` | all |
| `PUT` | `/api/board` | `board.write` | all |
| `POST` | `/api/write` | `values.write` | all |
| `GET` | `/api/history` | `values.read` | all |
| `GET` | `/api/writes` | `values.read` | all |
| `GET` | `/api/entities` | `entities.read` | all |
| `GET` | `/api/entities/composites` | `entities.read` | all |
| `GET` | `/api/entities/{entity_id}` | `entities.read` | all |
| `GET` | `/api/entities/{entity_id}/image` | `entities.read` | all |
| `PUT` | `/api/entities/{entity_id}` | `entities.write` | all |
| `POST` | `/api/entities` | `entities.write` | all |
| `DELETE` | `/api/entities/{entity_id}` | `entities.write` | all |
| `GET` | `/api/states` | `entities.read` | all |
| `GET` | `/api/states/{entity_id}` | `entities.read` | all |
| `GET` | `/api/energy/meters` | `energy.read` | all |
| `POST` | `/api/energy/meters` | `energy.write` | all |
| `GET` | `/api/energy/meters/{id}` | `energy.read` | all |
| `PUT` | `/api/energy/meters/{id}` | `energy.write` | all |
| `DELETE` | `/api/energy/meters/{id}` | `energy.write` | all |
| `GET` | `/api/energy/summary` | `energy.read` | all |
| `GET` | `/api/energy/summary/{period}` | `energy.read` | all |
| `GET` | `/api/energy/series` | `energy.read` | all |
| `GET` | `/api/energy/series/{meter}/{period}/{step}` | `energy.read` | all |
| `POST` | `/api/services/{domain}/{service}` | `values.write`, `alarms.ack`, `helpers.write`, `scripts.run`, `recipes.apply` (in handler) | all |
| `GET` | `/api/helpers` | `entities.read` | all |
| `POST` | `/api/helpers` | `entities.write` | all |
| `GET` | `/api/helpers/{entity_id}` | `entities.read` | all |
| `PUT` | `/api/helpers/{entity_id}` | `entities.write` | all |
| `DELETE` | `/api/helpers/{entity_id}` | `entities.write` | all |
| `GET` | `/api/equipment` | `equipment.read` | all |
| `POST` | `/api/equipment` | `equipment.write` | all |
| `GET` | `/api/equipment/{id}` | `equipment.read` | all |
| `PUT` | `/api/equipment/{id}` | `equipment.write` | all |
| `DELETE` | `/api/equipment/{id}` | `equipment.write` | all |
| `GET` | `/api/labels` | `equipment.read` | all |
| `POST` | `/api/labels` | `equipment.write` | all |
| `GET` | `/api/labels/{label_id}` | `equipment.read` | all |
| `PUT` | `/api/labels/{label_id}` | `equipment.write` | all |
| `DELETE` | `/api/labels/{label_id}` | `equipment.write` | all |
| `PUT` | `/api/devices/{id}/labels` | `equipment.write` | all |
| `GET` | `/api/alarms` | `alarms.read` | all |
| `POST` | `/api/alarms` | `alarms.write` | all |
| `POST` | `/api/alarms/import/codesys` | `alarms.write` | all |
| `DELETE` | `/api/alarms/{id}` | `alarms.write` | all |
| `POST` | `/api/alarms/{id}/ack` | `alarms.ack` | all |
| `POST` | `/api/alarms/{id}/shelve` | `alarms.ack` | all |
| `POST` | `/api/alarms/{id}/unshelve` | `alarms.ack` | all |
| `GET` | `/api/alarms/events` | `alarms.read` | all |
| `GET` | `/api/automations` | `automations.read` | all |
| `POST` | `/api/automations` | `automations.write` | all |
| `POST` | `/api/automations/validate` | `automations.write` | all |
| `DELETE` | `/api/automations/{id}` | `automations.write` | all |
| `POST` | `/api/automations/{id}/enabled` | `automations.write` | all |
| `POST` | `/api/automations/{id}/trigger` | `automations.trigger` | all |
| `GET` | `/api/runs` | `automations.read` | all |
| `POST` | `/api/automations/{id}/blueprint-upgrade` | `blueprints.apply` | all |
| `GET` | `/api/blueprints` | `blueprints.read` | all |
| `POST` | `/api/blueprints` | `blueprints.write` | all |
| `GET` | `/api/blueprints/{id}` | `blueprints.read` | all |
| `PUT` | `/api/blueprints/{id}` | `blueprints.write` | all |
| `DELETE` | `/api/blueprints/{id}` | `blueprints.write` | all |
| `POST` | `/api/blueprints/{id}/instantiate` | `blueprints.apply` | all |
| `GET` | `/api/dashboards` | `dashboards.read` | all |
| `POST` | `/api/dashboards` | `dashboards.write` | all |
| `GET` | `/api/dashboards/{id}` | `dashboards.read` | all |
| `PUT` | `/api/dashboards/{id}` | `dashboards.write` | all |
| `DELETE` | `/api/dashboards/{id}` | `dashboards.write` | all |
| `GET` | `/api/dashboards/{id}/export` | `dashboards.read` | all |
| `POST` | `/api/dashboards/import` | `dashboards.write` | all |
| `GET` | `/api/scripts` | `scripts.read` | all |
| `POST` | `/api/scripts` | `scripts.write` | all |
| `POST` | `/api/scripts/validate` | `scripts.write` | all |
| `GET` | `/api/scripts/{id}` | `scripts.read` | all |
| `PUT` | `/api/scripts/{id}` | `scripts.write` | all |
| `DELETE` | `/api/scripts/{id}` | `scripts.write` | all |
| `POST` | `/api/scripts/{id}/run` | `scripts.run` | all |
| `POST` | `/api/scripts/{id}/stop` | `scripts.run` | all |
| `GET` | `/api/scripts/{id}/runs` | `scripts.read` | all |
| `GET` | `/api/recipes` | `recipes.read` | all |
| `POST` | `/api/recipes` | `recipes.write` | all |
| `POST` | `/api/recipes/capture` | `recipes.write` | all |
| `GET` | `/api/recipes/{id}` | `recipes.read` | all |
| `PUT` | `/api/recipes/{id}` | `recipes.write` | all |
| `DELETE` | `/api/recipes/{id}` | `recipes.write` | all |
| `GET` | `/api/recipes/{id}/versions` | `recipes.read` | all |
| `GET` | `/api/recipes/{id}/versions/{version}` | `recipes.read` | all |
| `POST` | `/api/recipes/{id}/validate` | `recipes.apply` | all |
| `POST` | `/api/recipes/{id}/apply` | `recipes.apply` | all |
| `GET` | `/api/recipes/{id}/applications` | `recipes.read` | all |
| `POST` | `/api/webhook/{path}` | none | all |
| `GET` | `/api/fleet` | `fleet.read` | gateway |
| `POST` | `/api/fleet` | `fleet.write` | gateway |
| `DELETE` | `/api/fleet/{id}` | `fleet.write` | gateway |
| `POST` | `/api/fleet/{id}/rebirth` | `fleet.rebirth` | gateway |
| `POST` | `/api/fleet/{id}/restart` | `fleet.restart` | gateway |
| `POST` | `/api/fleet/{id}/update` | `fleet.update` | gateway |
| `POST` | `/api/fleet/{id}/config` | `fleet.config` | gateway |
| `DELETE` | `/api/fleet/{id}/config` | `fleet.config` | gateway |
| `POST` | `/api/notify/test` | `notify.test` | all |
| `GET` | `/api/notify/escalation` | `notify.escalation` | all |
| `PUT` | `/api/notify/escalation` | `notify.escalation` | all |
| `POST` | `/api/notify/ack/{token}` | none | all |
| `GET` | `/api/backup` | `backup.read` | all |
| `POST` | `/api/backup` | `backup.run` | all |
| `GET` | `/api/reports` | `reports.read` | gateway |
| `POST` | `/api/reports` | `reports.write` | gateway |
| `GET` | `/api/reports/{id}` | `reports.read` | gateway |
| `PUT` | `/api/reports/{id}` | `reports.write` | gateway |
| `DELETE` | `/api/reports/{id}` | `reports.write` | gateway |
| `POST` | `/api/reports/{id}/run` | `reports.run` | gateway |
| `GET` | `/api/reports/{id}/runs` | `reports.read` | gateway |
| `GET` | `/api/reports/{id}/runs/{run}/download` | `reports.read` | gateway |
| `GET` | `/api/sites` | `sites.read` | gateway |
| `GET` | `/api/settings` | `settings.read` | all |
| `PUT` | `/api/settings` | `settings.write` | all |
| `GET` | `/api/historian/targets` | `settings.read` | all |
| `POST` | `/api/historian/targets` | `settings.write` | all |
| `PUT` | `/api/historian/targets/{id}` | `settings.write` | all |
| `DELETE` | `/api/historian/targets/{id}` | `settings.write` | all |
| `GET` | `/api/events` | `events.read` | all |
| `GET` | `/api/logbook` | `logbook.read` | all |
| `GET` | `/api/stream` | `status.read` | all |
| cualquiera | `/mcp` | token MCP | all |
| cualquiera | `/mcp/` | token MCP | all |
| `GET` | `/manifest.webmanifest` | none | all |
| `GET` | `/sw.js` | none | all |
| `GET` | `/next` | none | all |
| `GET` | `/next/` | none | all |
| cualquiera | `/` | none | all |

## Salud

Para el kubelet y los balanceadores de carga. Ninguno necesita una sesión: una sonda no tiene cuenta, y ninguno dice nada sobre la planta.

### `GET /healthz`

Liveness. `200` con el texto `ok` mientras el proceso atienda HTTP. No toca la base de datos, a propósito: una caída de la base de datos debe sacar el pod de la rotación, no reiniciarlo en bucle.

### `GET /readyz`

Readiness. Hace ping a la base de datos con un margen de 5 segundos.

```json
{"status":"ready"}
```

`503` cuando no puede alcanzarla, con el motivo en `detail` (la forma viene del manejador; el texto del motivo es lo que haya dicho el controlador de la base de datos):

```json
{"error":"not ready","detail":"<why the database did not answer>"}
```

Una aplicación que no alcanza su historiador no debe recibir tráfico.

## Autenticación

Consulte [Autenticación y usuarios](/es/iot/authentication/) para las cuentas, los roles y el primer administrador.

### `POST /api/auth/login`

No necesita sesión, por construcción.

| Campo | Tipo | <span class="sr-only">Detalles</span> |
|---|---|---|
| `username` | string | Obligatorio. Se ignoran las mayúsculas y los espacios alrededor |
| `password` | string | Obligatorio |

```json
{"expiresAt":"2026-09-28T08:21:00.571794Z","permissions":["*"],"role":"admin","token":"<token>","username":"admin"}
```

También guarda el mismo token en la cookie `iiot_session`. `401` `"invalid username or password"` para un nombre incorrecto, una contraseña incorrecta o una cuenta deshabilitada por igual, y tarda lo mismo en todos los casos: cuál de las tres fue no es algo que se le diga a un extraño. `429` para una cuenta que ha acumulado demasiadas contraseñas o PIN incorrectos seguidos, se envíe lo que se envíe, con una cabecera `Retry-After`; consulte [Autenticación y usuarios](/es/iot/authentication/#el-bloqueo-tras-contraseñas-y-pin-incorrectos).

### `POST /api/auth/kiosk`

Inicie sesión en un panel compartido con un PIN o una credencial, como describe [Autenticación y usuarios](/es/iot/authentication/#paneles-de-quiosco-pin-o-credencial-y-cierre-de-sesión-por-inactividad). No necesita sesión, por construcción.

| Campo | Tipo | <span class="sr-only">Detalles</span> |
|---|---|---|
| `code` | string | Obligatorio. El PIN, o el valor que tecleó un lector de credenciales que actúa como teclado. Se ignoran los espacios alrededor |
| `username` | string | Opcional. Con él, solo se comprueba el PIN de esa cuenta y uno incorrecto cuenta para el bloqueo de esa cuenta. Sin él, el código se busca entre los de todas las cuentas |

```json
{"expiresAt":"2026-10-21T08:21:00.571794Z","idleSec":300,"permissions":["status.read","tags.read"],"role":"operator","username":"olga"}
```

Guarda la cookie `iiot_session` y, a diferencia de `POST /api/auth/login`, no responde con el token: una sesión de quiosco pertenece al navegador del panel. `idleSec` es el tiempo que sobrevive la sesión sin que nadie la toque. `401` `"that PIN or badge isn't recognized"` para un código incorrecto, un código demasiado corto y el código de una cuenta deshabilitada por igual, y tarda lo mismo en todos los casos. `429` cuando la cuenta está bloqueada (consulte [El bloqueo](/es/iot/authentication/#el-bloqueo-tras-contraseñas-y-pin-incorrectos)), con una cabecera `Retry-After`. Un código enviado sin `username` que no coincide con nadie no cuenta contra ninguna cuenta; el panel que lo envió, por dirección de cliente, espera medio segundo más antes de que se compruebe su siguiente intento de ese tipo, hasta `ui.panelDelaySeconds`, y uno correcto lo reinicia. El panel nunca se bloquea. `400` cuando el despliegue funciona sin inicio de sesión (`HOTLOOP_AUTH_INSECURE`), porque entonces no hay nadie con quien iniciar sesión.

### `POST /api/auth/activity`

Una persona tocó el panel. Sin cuerpo. `{"status":"ok"}`. En una sesión de quiosco, esto es lo que adelanta su límite de inactividad; también lo hace cualquier otra solicitud que no sea una lectura (una escritura, un reconocimiento). Un `GET`, el flujo en vivo y las cargas de fondo de la propia página no lo hacen: de lo contrario mantendrían iniciada la sesión de la última persona para siempre. Una sesión creada con contraseña no tiene límite de inactividad y no hay nada que adelantar.

### `POST /api/auth/logout`

Termina la sesión con la que llegó la solicitud (cookie o bearer) y borra la cookie. Sin cuerpo. `{"status":"logged out"}`.

### `GET /api/auth/session`

Quién soy. Para la secuencia de arranque de la interfaz.

```json
{"authenticated":true,"permissions":["*"],"role":"admin","username":"admin"}
```

Una sesión creada en un panel de quiosco añade `"idleSec"`, su límite de inactividad en segundos, que es como la página sabe que debe cerrar la sesión por sí sola.

Con la autenticación desactivada (`HOTLOOP_AUTH_INSECURE`), responde `{"authenticated":false,"insecure":true}` en lugar de un 401, para que la interfaz pueda decir por qué no hay inicio de sesión en vez de adivinarlo.

### `POST /api/auth/password`

Cambia su propia contraseña. Sin permiso: conocer su contraseña actual es la credencial.

| Campo | Tipo | <span class="sr-only">Detalles</span> |
|---|---|---|
| `currentPassword` | string | Obligatorio |
| `newPassword` | string | Obligatorio, de al menos 8 caracteres |

`{"status":"password changed; log in again"}`. **Termina toda sesión que tenga la cuenta, incluida esta**, y se borra la cookie: un cambio de contraseña que deja funcionando las sesiones antiguas es un cambio solo de nombre. `401` si la contraseña actual es incorrecta, `400` si la nueva es demasiado corta.

## Usuarios

Todo es solo para administradores (`users.manage`). Los hashes de contraseña nunca aparecen en una respuesta; el campo no tiene nombre JSON.

### `GET /api/users`

```json
[{"username":"admin","role":"admin","disabled":false,"hasPin":false,"locked":false,"createdAt":"2026-09-27T20:19:28.036228Z","updatedAt":"2026-09-27T20:19:28.036228Z","lastLogin":"2026-09-27T20:21:00.575455Z"}]
```

`permissions` aparece solo en una cuenta que tiene una lista explícita. `hasPin` dice si la cuenta tiene un PIN o una credencial de quiosco; el valor y su hash nunca aparecen.

### `POST /api/users`

| Campo | Tipo | <span class="sr-only">Detalles</span> |
|---|---|---|
| `username` | string | Obligatorio. Letras minúsculas, dígitos, punto, guion bajo y guion, empezando por una letra o un dígito, de 2 a 64 caracteres |
| `password` | string | Obligatorio, de al menos 8 caracteres |
| `role` | string | `admin`, `operator` o `viewer`. Por defecto `viewer` |
| `permissions` | string[] | Opcional. Reemplaza por completo el conjunto del rol |

Responde con el usuario nuevo. `400` para un nombre, rol o contraseña incorrectos, `409` si el nombre ya está en uso.

### `PUT /api/users/{username}`

| Campo | Tipo | <span class="sr-only">Detalles</span> |
|---|---|---|
| `role` | string | Obligatorio salvo que se indique `permissions` |
| `permissions` | string[] | Opcional. Vacío significa «usar el rol» |
| `disabled` | bool | `true` deshabilita la cuenta y termina todas las sesiones que tenga |

Responde con el usuario actualizado. `400` para un rol desconocido, o por deshabilitar al último administrador habilitado: eso es un bloqueo sin nadie que pueda deshacerlo. `404` para un usuario desconocido.

### `DELETE /api/users/{username}`

`{"status":"deleted"}`. `400` para su propia cuenta o para el último administrador habilitado, `404` para un usuario desconocido.

### `POST /api/users/{username}/password`

Un administrador fija la contraseña de otra persona sin conocer la anterior. `{"password": "..."}`, de al menos 8 caracteres. Responde `{"status":"password reset"}` y termina todas las sesiones de esa cuenta.

### `PUT /api/users/{username}/pin`

Un administrador da a una cuenta un PIN o un valor de credencial para iniciar sesión en un panel de quiosco, o reemplaza el que tiene. `{"code": "482913"}`: de 6 a 72 caracteres, sin espacios ni caracteres de control, dígitos o cualquier otra cosa que teclee un lector de credenciales. Responde `{"status":"PIN set","username":"olga","hasPin":true}`. El valor se guarda con hash bcrypt, como una contraseña, y nunca se registra ni se devuelve. `400` para un código demasiado corto, demasiado largo o con un espacio, y para un código que ya tiene otra cuenta: un panel encuentra la cuenta solo por el código, así que un código abre una sola cuenta. `404` para un usuario desconocido. No toca la contraseña ni ninguna sesión.

### `DELETE /api/users/{username}/lockout`

Deja volver a entrar a una cuenta bloqueada antes de que termine su bloqueo, y reinicia a cero su cuenta de contraseñas y PIN incorrectos. `{"status":"unlocked","username":"olga","locked":false}`. `404` para un usuario desconocido. Una cuenta bloqueada muestra `"locked":true` y `"lockedUntil"` en `GET /api/users`.

### `DELETE /api/users/{username}/pin`

Quita el PIN o la credencial y cierra la sesión de la cuenta en todos los paneles de quiosco en los que la tenga iniciada. Su contraseña, y sus sesiones en su propio ordenador, no se tocan. `{"status":"PIN cleared","username":"olga","hasPin":false}`. `404` para un usuario desconocido.

### `GET /api/opcua/certificates`

Todos los certificados X.509 asociados a un usuario para iniciar sesión en el servidor OPC UA (consulte [el servidor OPC UA](/es/edge/opc-ua-server/#certificados-de-usuario-x509)), del más reciente al más antiguo: `{"serverAcceptsCertificates":false,"certificates":[...]}`. Cada uno tiene `thumbprint` (SHA-256 de la forma DER, en hexadecimal minúscula), `username`, `label`, `subject`, `notBefore`, `notAfter`, `addedBy`, `addedAt`, `revokedAt` y `revokedBy` una vez revocado, `lastUsed` una vez usado, y `state`: `active`, `revoked`, `expired` o `not yet valid`. Solo un certificado activo permite iniciar sesión. `serverAcceptsCertificates` indica si el servidor OPC UA está activo y tiene `HOTLOOP_OPCUA_SERVER_ALLOW_X509` definido; los certificados se conservan en ambos casos. Solo se guarda o se envía el certificado público.

### `GET /api/users/{username}/certificates`

La misma lista para un usuario. `404` para un usuario desconocido.

### `POST /api/users/{username}/certificates`

Asocia un certificado a un usuario. `{"certificate": "<PEM text or base64 of the DER bytes>", "label": "Olga's laptop"}`; la etiqueta es opcional. Responde `201` con el certificado tal como se lista. El certificado debe ser RSA con una clave de al menos 2048 bits y no debe haber caducado. `400` dice cuál de esas condiciones falla, y también para algo que no es un certificado: una clave privada se rechaza por su nombre y nunca se guarda ni se devuelve, igual que una cadena. `404` para un usuario desconocido. `409` cuando el certificado ya está asociado, a este usuario o a otro: un certificado es una persona. El cambio queda en el libro de registro con quién lo hizo.

### `POST /api/users/{username}/certificates/{thumbprint}/revoke`

Revoca un certificado. Ya no puede iniciar sesión, una sesión abierta con él termina dentro de los 10 segundos de la caché de permisos, y los intentos posteriores se rechazan y se registran como revocados. Sigue en la lista como `revoked` con quién lo hizo y cuándo, y revocarlo de nuevo conserva el primer registro. `{thumbprint}` es el SHA-256 tal como se lista; se aceptan dos puntos, espacios y mayúsculas. `404` cuando el certificado no es de este usuario.

### `DELETE /api/users/{username}/certificates/{thumbprint}`

Olvida un certificado. Si se asocia de nuevo, vuelve a funcionar. `404` cuando no es de este usuario. Al eliminar al usuario se eliminan sus certificados.

## Estado y diagnóstico

### `GET /api/status`

La barra de cabecera: contadores del runtime, el resumen de alarmas, el nombre de la planta y qué producto es este. `product` es `iot`, `edge` o `gateway`, igual que `hotloop --product`. `features` indica cuáles de las funciones que difieren entre productos tiene este: `edge-publish`, `fleet`, `opcua-server`, `reports` y `sites` en un Gateway, la primera y la tercera en Edge, ninguna en IoT. `version` es la compilación, e `imageDigest` es el digest de la imagen con la que arrancó, algo que un número de versión no le dice en una caja que sigue `:stable`. Solo aparece cuando lo indicó el supervisor (las unidades Quadlet lo hacen, antes de cada arranque; un binario suelto y una instalación con Helm no pueden) y se omite en los demás casos.

```json
{
  "alarms": {"critical":0,"high":1,"medium":0,"low":0,"unacked":0,"total":1},
  "features": ["edge-publish","fleet","opcua-server","reports","sites"],
  "plantName": "Demo Plant",
  "product": "gateway",
  "runtime": {
    "startedAt": "2026-09-27T20:19:28.06635851Z", "uptime": "11m13s",
    "devices": 2, "connected": 2, "degraded": 0, "disconnected": 0,
    "tags": 5, "cachedTags": 5, "writesOk": 4, "writesRefused": 3,
    "bus": {"subscribers":4,"published":653,"dropped":0},
    "historian": {"queued":1085,"written":1085,"filtered":329,"dropped":0,"failed":0,"queueLen":0,"queueCap":50000},
    "writePolicy": {"allowWrites":true,"allowMcpWrites":true,"confirmWrites":true},
    "protocols": ["codesys","ethernet-ip","http","modbus","mqtt","mtconnect","opcua","s7comm","snmp","unifi"]
  },
  "siteId": "docs",
  "version": "4.23.2"
}
```

### `GET /api/protocols`

Todos los protocolos que conoce el Gateway, y si esta compilación tiene su controlador.

```json
[{"id":"opcua","name":"OPC UA","description":"The universal one. ...","transport":"opc.tcp binary","defaultPort":4840,"writable":true,"browsable":true,"deviceTypes":["plc","cnc","robot","ipc","hmi","historian","gateway"],"library":"...","available":true}]
```

### `GET /api/diagnostics`

Lo que muestra la pantalla de diagnóstico: el pool de la base de datos, la cola del historiador y el tamaño del historial, el bus de tags, el motor de entidades, el registrador del libro de registro, el runtime, MCP (servidor y conexiones salientes) y las reglas armadas del motor de automatizaciones, las rutas de webhook y la cola de cambios de estado.

```json
{
  "automations": {"armed":[],"stateChangesDropped":0,"stateChangesPending":0,"webhooks":[]},
  "bus": {"subscribers":4,"published":654,"dropped":0},
  "database": {"type":"postgres","totalConns":3,"idleConns":3,"acquiredConns":0,"maxConns":10,"historyMode":"timescale","timescaleVersion":"2.30.1"},
  "entities": {"entities":8,"droppedBatches":0,"pendingChanges":0,"droppedChanges":0},
  "historian": {"queued":1087,"written":1085,"filtered":329,"dropped":0,"failed":0,"queueLen":0,"queueCap":50000},
  "historyStats": {"mode":"timescale","rows":996,"distinctTags":5,"oldest":"2026-09-27T20:21:38.609853Z","newest":"2026-09-27T20:30:39.507987Z","sizeBytes":73728},
  "logbook": {"recording":true,"retentionDays":90,"queued":0,"dropped":0,"written":212,"suppressed":36,"writeErrors":0},
  "mcp": {"outbound":[],"path":"/mcp","serverEnabled":true,"tokenSet":true},
  "runtime": {"...": "the same block as /api/status"}
}
```

Con servidores MCP salientes configurados, `outbound` lista cada uno:

```json
{"name":"plant-a","target":"http://localhost:8080/mcp","connected":true,"tools":["ack_alarm","call_service","...","write_tag"],"connectedSince":"2026-09-27T20:45:50Z"}
```

Cualquier credencial en el `target` o el `lastError` de un servidor saliente se elimina, porque una URL o una línea de comandos puede llevar un token y todos los roles pueden leer esto. El propio token MCP solo es `tokenSet`.

## Dispositivos

Un dispositivo es una conexión por un protocolo. Lo que va en `config` y `address` depende del protocolo: consulte [Protocolos y controladores](/es/iot/protocols/).

### `GET /api/devices`

Todos los dispositivos, con su estado de conexión en vivo. Las credenciales aparecen como `[redacted]`. `?q=` conserva los dispositivos cuyo id, nombre, dirección o protocolo contiene el texto (sin distinguir mayúsculas), y `?limit=` (de 1 a 5000, cualquier otro valor da `400`) los primeros de ellos; con cualquiera de los dos, `X-Total-Count` indica cuántos coincidieron.

```json
[{"id":"tank-farm","name":"Tank farm","protocol":"mqtt","address":"base-mqtt:1883","enabled":true,
  "site":"Demo Plant","area":"Utilities","equipmentId":4,
  "config":{"clientId":"docs-api-tankfarm","password":"[redacted]","topics":["docs-api-example/#"],"username":"tank","writeTopic":"docs-api-example/{tag}/set"},
  "createdAt":"2026-09-27T20:21:01.637319Z","updatedAt":"2026-09-27T20:21:01.637319Z",
  "state":"connected","lastPoll":"2026-09-27T20:21:39.412Z",
  "latencyMs":0.002,"tagCount":3,"pollCount":1}]
```

`state` es `connected`, `connecting`, `degraded` (activo, pero con consultas que fallan), `disconnected` o `disabled`. `lastError`, `errorCount` y el resto aparecen cuando hay algo que decir.

### `POST /api/devices`

Crea el dispositivo si el `id` es nuevo y lo reemplaza si no. No hay `PUT`.

| Campo | Tipo | <span class="sr-only">Detalles</span> |
|---|---|---|
| `id` | string | Obligatorio. De 1 a 64 letras, dígitos, `.`, `_`, `-`, empezando por un carácter alfanumérico. Acaba en URL, topics MQTT y argumentos MCP |
| `name` | string | Obligatorio |
| `protocol` | string | Obligatorio. Uno para el que esta compilación tenga controlador (`GET /api/protocols`) |
| `address` | string | Obligatorio. Host y puerto, o una URL `opc.tcp://` o `http://`: lo decide el protocolo |
| `enabled` | bool | Si se omite, es `false` |
| `description` | string | |
| `pollIntervalMs`, `timeoutMs` | int | 0 toma el valor por defecto del runtime. El intervalo de consulta tiene como mínimo `HOTLOOP_MIN_POLL_INTERVAL` |
| `site`, `area`, `line` | string | Coloca el dispositivo en el árbol de equipos por nombre, creando los nodos que haga falta |
| `equipmentId` | int | Lo coloca en un nodo del árbol en su lugar; `site`, `area` y `line` salen entonces del nodo. Consulte [el árbol de equipos y las etiquetas](/es/iot/equipment/) |
| `config` | object | Las opciones propias del protocolo. Las credenciales siguen las [reglas de solo escritura](#los-secretos-son-de-solo-escritura) |

Los campos de runtime (`state`, `lastPoll`, `tagCount` y demás) son de solo lectura; si los devuelve, se ignoran. Responde con el dispositivo guardado, censurado. `400` para un protocolo sin controlador, una validación fallida o una regla de credenciales; el runtime se recarga con él de inmediato.

```json
{"error":"no driver for protocol \"profibus\"; this build speaks: ethernet-ip, http, modbus, mqtt, mtconnect, opcua, s7comm, snmp, unifi"}
```

### `GET /api/devices/{id}`

El dispositivo, sus tags y sus etiquetas.

```json
{"device":{"id":"tank-farm","name":"Tank farm","...":"..."},"labels":["critical"],"tags":[{"id":3,"deviceId":"tank-farm","name":"level","...":"..."}]}
```

`tags` es `[]` para un dispositivo que no tiene ninguno. `404` para un id desconocido.

### `DELETE /api/devices/{id}`

Elimina el dispositivo, sus tags y sus entidades. **Su historial se conserva.** `{"deleted":"tank-farm"}`, o `404`.

### `POST /api/devices/{id}/enabled`

`{"enabled": false}` detiene la consulta sin borrar nada. Responde `{"enabled":false,"id":"tank-farm"}`. `404` para un id desconocido.

### `POST /api/devices/{id}/browse`

Pregunta al dispositivo qué puntos tiene. Solo necesita `devices.read`, porque lee. Sin cuerpo.

```json
{"supported":true,"tags":[{"name":"Plant_Boiler_Temperature","address":"nsu=http://plant/;s=Temperature","dataType":"float","description":"Temperature","writable":true}]}
```

Un protocolo que no puede enumerar sus puntos (Modbus, S7comm, HTTP) responde `200` con `{"supported":false,"reason":"..."}`: es un hecho sobre el protocolo, no un error. `503` si el dispositivo no está conectado. `writable` aquí es lo que dice el dispositivo sobre el punto, no si el Gateway lo va a escribir.

### `POST /api/devices/{id}/import`

Convierte los resultados de la exploración en tags configurados. Necesita `tags.write`, porque crea tags.

```json
{"tags":[{"name":"Temperature","address":"nsu=http://emberburn/;s=Temperature","dataType":"float","unit":"C"}]}
```

Cada entrada acepta `name`, `address`, `dataType`, `unit`, `description`, `deviceClass` y `writable` (el resultado de la exploración tal como llegó). Responde `{"inserted":2,"updated":0}`. **Todo tag importado es de solo lectura**, diga lo que diga el dispositivo: un punto descubierto no es un punto que alguien haya decidido que se puede comandar, y hacerlo al revés por defecto armaría unos miles de ellos de golpe. Arme los que quiera con `POST /api/tags`. `404` para un dispositivo desconocido.

## UniFi: redes OT, clientes y dónde está un dispositivo en la red

El registro propio de HotLoop sobre los sitios UniFi. Consulte [UniFi Network](/es/iot/unifi/). `{id}` bajo `/api/unifi` es un dispositivo UniFi (un sitio en una consola); `{network}` es el ID que la propia consola da a una red, tal como lo entrega `GET .../networks`; `{mac}` admite cualquier grafía habitual y se guarda en minúsculas con dos puntos.

**Ninguna de estas llamadas le pregunta nada a la consola.** Leen la última lectura que el controlador hizo de ella, así que una pantalla abierta no le cuesta nada a la consola. Eso también significa que responden `503` hasta que el dispositivo se ha leído una vez, y siempre en un ayudante `--mcp-stdio`, que nunca inicia sesión en una consola. Tampoco ninguna de ellas escribe en una consola.

Un cambio que crea o elimina una alarma lo dice en `change`: `{"alarmsCreated":["unifi-unknown-3f2a9c01b7de"]}`. Son definiciones de alarma normales, bajo `/api/alarms`.

### `GET /api/devices/{id}/network`

Dónde está en la red un dispositivo de HotLoop (un PLC, un contador). Vinculado:

```json
{"deviceId":"plc-07","link":{"deviceId":"plc-07","consoleId":"plant-net","mac":"02:48:4c:00:00:07","confirmedBy":"hana","confirmedAt":"2026-09-28T18:02:05Z"},
 "consoleName":"Plant network","client":{"mac":"02:48:4c:00:00:07","ip":"10.77.0.7","switchMac":"00:27:22:e2:1d:6f","switchName":"USW Lite 8 PoE","port":5,"portUp":false,"online":false,"lastSeen":"2026-09-28T18:01:40Z","lastSeenSec":25,"why":"its switch port 5 has no link","...":"..."},
 "readAt":"2026-09-28T18:02:05Z","summary":"on USW Lite 8 PoE port 5, link down; the console last saw it 25s ago; off the network: its switch port 5 has no link","proposals":[]}
```

Si no está vinculado, `link` es `null` y `proposals` lista los clientes que cualquier consola que HotLoop lea tiene con la IP del dispositivo, del más reciente al más antiguo. Una propuesta es solo eso: las IP de la consola van con retraso, así que nada se vincula hasta que un administrador confirma una.

### `PUT /api/devices/{id}/network`

`{"consoleId":"plant-net","mac":"02:48:4c:00:00:07"}` confirma qué cliente es el dispositivo. Desde ese momento la clave es la MAC y la IP deja de ser de fiar. El cliente recibe tags (`c.<mac>.*` en la consola) y una alarma, «PLC-07 fuera de la red», de prioridad 1 con un retardo de activación de 120 s para que un reinicio no avise a nadie. Responde `{"link":{...},"change":{...}}`. `400` si `consoleId` no es un dispositivo UniFi o la MAC no es una MAC, `404` para un dispositivo desconocido.

### `DELETE /api/devices/{id}/network`

Quita el vínculo, y la alarma que HotLoop creó para él salvo que el cliente siga vigilado desde una lista de conocidos. `404` si no había vínculo.

### `GET /api/unifi/{id}/networks`

Las redes del sitio tal como las tiene la consola, con el registro de HotLoop: `ot`, `known` (cuántos dispositivos hay en su lista), `clients` (en ella ahora) y `unknown` (en ella ahora y no en la lista). Una red de la que HotLoop tiene registro y que la consola ya no tiene vuelve con `"onConsole":false`.

```json
[{"networkId":"6abb23d25a95f2636a5df29c","name":"SCADA","purpose":"corporate","vlan":122,"subnet":"10.122.0.1/24","onConsole":true,"ot":true,"clients":2,"known":1,"unknown":[{"mac":"02:9b:b1:69:88:f2","ip":"10.122.0.66","switchName":"USW Lite 8 PoE","port":6,"...":"..."}],"changedBy":"hana"}]
```

### `PUT /api/unifi/{id}/networks/{network}`

`{"ot": true}` marca una red como OT. Todo lo que haya en ella y no esté en su lista de conocidos cuenta en `n.<network>.unknown` y se nombra en `.unknown_last`, y HotLoop crea la alarma «Dispositivo desconocido en SCADA», de prioridad 1. `{"ot": false}` la desmarca y quita esa alarma; la lista de conocidos se conserva. `400` para una WAN o una red que la consola no tiene.

### `POST /api/unifi/{id}/networks/{network}/accept-all`

Acepta todo lo que hay ahora en la red, tal como está: el único clic después de marcarla. Los dispositivos que ya están en la lista conservan su nombre y su vigilancia. Sin cuerpo. Responde `{"accepted":[{known device}...]}`, los que añadió.

### `GET /api/unifi/{id}/known`

Todos los dispositivos conocidos en las redes del sitio: `[{"deviceId":"plant-net","networkId":"...","mac":"...","name":"PLC-07","watch":true,"acceptedBy":"hana","acceptedAt":"..."}]`.

### `PUT /api/unifi/{id}/networks/{network}/known/{mac}`

`{"name":"PLC-07","watch":true}` acepta un dispositivo en la red, o cambia su nombre o su vigilancia. `watch` le da tags y la alarma de desconexión; un dispositivo que tiene permiso pero va y viene (un portátil de mantenimiento) se acepta sin ella. `400` si la red nunca se marcó como OT.

### `DELETE /api/unifi/{id}/networks/{network}/known/{mac}`

Quita un dispositivo de la lista. Si está en la red, vuelve a ser desconocido en la siguiente lectura.

### `GET /api/unifi/{id}/clients`

Todos los clientes que lista la consola, más todos los vigilados que no lista, cada uno con dónde está, si está en línea, y `ot`, `known`, `watched`, `linkedTo` y un `summary` de una línea. `?q=` lo reduce a una MAC, IP o nombre.

### `GET /api/unifi/consoles`

Todos los dispositivos UniFi que tiene HotLoop, en marcha o no, para el selector de la pantalla de UniFi: `[{"id":"plant-net","name":"Plant network","address":"https://...","enabled":true,"running":true,"site":"default","version":"10.6.106","readAt":"...","devices":4,"online":4,"clients":12,"failover":false,"eventsLive":true}]`. Una consola que este proceso no ha leído dice por qué en `why`.

### `GET /api/unifi/{id}/overview`

La tarjeta de resumen: recuentos de dispositivos y clientes (un cliente cuenta cuando HotLoop cree que está en la red, la prueba que usan los tags `n.<id>.clients`, y no solo cuando la consola lo lista), clientes por red, el `health` de los subsistemas de la consola y, para cada gateway, su franja de WAN, `gateways[]`: una entrada `wans[]` por WAN con `alive` (las comprobaciones de salud del propio gateway, nunca el `up` del bloque de la WAN), `known`, `active`, `backup`, latencia y disponibilidad. `failover` es tráfico en una WAN que no es la primera, `down` es ninguna WAN viva, y `since` es la primera lectura en la que HotLoop vio tráfico en la WAN en la que está ahora, que es cuando HotLoop lo notó, no cuando el gateway cambió. `events` es el estado del websocket de eventos (`live`, `error`, `reconnects`) y los diez eventos más recientes.

### `GET /api/unifi/{id}/topology`

El mapa. `nodes[]` son los dispositivos adoptados con su lugar en la cuadrícula (`x`, `y`, `layer`: de izquierda a derecha desde el gateway, dispuestos igual para la misma lectura), `edges[]` los cables entre ellos según la propia `downlink_table` de la consola, `wired[]` y `wifi[]` los clientes que cuelgan de cada puerto de switch y de cada AP y SSID. Un dispositivo que nada lista como conectado a algo se dibuja solo con `noUplink` activado, sin colgarlo del gateway por suposición. Un dispositivo de otra consola UniFi que HotLoop lee y que esta consola lista como cliente se une como nodo con `external` activado y una arista con `stitched`. `feeds` es, por MAC de dispositivo, los dispositivos de HotLoop vinculados a un cliente aguas abajo de él, con su `equipmentId` para el árbol de planta, y `links` esos mismos dispositivos por MAC de cliente.

### `GET /api/unifi/{id}/devices`

Todos los dispositivos adoptados con sus números y su `ports[]` para la vista frontal: enlace, velocidad, modo y consumo de PoE, los clientes aprendidos en el puerto, el dispositivo conectado a él, y `dropped` para un puerto que estaba activo en una lectura anterior y ahora está caído. Un dispositivo que la consola ha perdido no informa de números ni de enlaces de puerto, porque lo último que dijo ya no está vigente.

### `GET /api/unifi/{id}/wifi`

Los SSID del sitio con `enabled`, la red en la que están y cuántos clientes hay en cada uno. Cuando la consola no muestra a esta cuenta sus redes inalámbricas, `error` dice por qué y `wlans` está vacío.

### `GET /api/unifi/{id}/events`

Los eventos más recientes que ha informado la consola desde que HotLoop se conectó, del más reciente al más antiguo (`?limit=` hasta 200, por defecto 50), y el estado del websocket de eventos. Cada evento tiene la `key` del controlador (`EVT_SW_Lost_Contact`), su propio `message`, `severity` (`warning` cuando el controlador lo marca como algo que va mal) y el dispositivo, cliente y puerto de que trata. También están en el libro de registro, archivados bajo el switch o punto de acceso de que tratan (consulte [UniFi Network](/es/iot/unifi/#eventos)).

### `POST /api/unifi/{id}/starter-alarms`

Crea las alarmas habituales del sitio a partir de lo que tiene ahora la consola, como definiciones de alarma normales bajo `/api/alarms`: todo dispositivo adoptado sin conexión (prioridad 2, retardo de 60 s), todo puerto de enlace ascendente caído (prioridad 1, 10 s), un gateway con dos o más WAN funcionando con una de respaldo (prioridad 2, 30 s). El cuerpo es opcional. `{"poeLimitW": 25}` añade una alarma de prioridad 3 sobre el consumo `poe_w` de cada puerto PoE por encima de esa cantidad de vatios, con 30 s de retardo; la consola no dice cuál es el presupuesto de un puerto, así que HotLoop no lo supone. Un límite negativo da `400`.

```json
{"created":[{"id":"unifi-devoffline-9c1e2a77b3d0","name":"USW Lite 8 PoE offline","kind":"offline","tag":"d.002722e2e633.online","priority":2}],
 "kept":[]}
```

`kept` son las alarmas que el conjunto pide y que ya estaban: las suyas de una pulsación anterior, o una alarma de alguien sobre el mismo tag. Por eso es seguro volver a pulsar tras adoptar más equipos, y solo añade los equipos nuevos. Las alarmas de red OT y de fuera de la red no forman parte de él; vienen al marcar una red como OT y vigilar un dispositivo. `503` hasta que la consola se haya leído una vez.

## Descubrimiento MQTT

Dispositivos que se anunciaron por MQTT, y lo que una persona decidió sobre cada uno. Consulte [Descubrimiento MQTT](/es/iot/mqtt-discovery/). El descubrimiento escucha en el broker integrado cuando funciona, y en cada broker configurado bajo `/api/mqtt/brokers`. Sin ninguno de los dos, `sources` está vacío. En un ayudante `--mcp-stdio`, que nunca escucha, `GET /api/discovery` responde `{"running":false,"sources":[],"devices":[]}` y todas las demás rutas `503`.

`{source}` es el broker en el que se anunció un dispositivo (`embedded` para el propio de HotLoop, y si no el id del broker); `{key}` es lo que unió sus anuncios: su primer identificador, su MAC como `mac:aa:bb:cc:dd:ee:ff`, o el id de su nodo. Codifíquelo como URL; los identificadores llevan caracteres que una ruta no admite.

**Ninguna de estas llamadas arma nada.** Aceptar un dispositivo hace que sus puntos se puedan armar, uno por uno, con `POST /api/tags` como cualquier otro punto.

### `GET /api/discovery`

Todas las fuentes, con lo que han visto y rechazado, y todos los dispositivos descubiertos:

```json
{"running":true,"sources":[{"id":"embedded","name":"the embedded broker","prefix":"homeassistant","listening":true,"connected":true,
  "received":42,"dropped":0,"refused":0,"problems":[],"autoCreate":true,"anonymousAllowed":false,
  "external":false,"listenOnly":false,"enabled":true}],
 "devices":[{"source":"embedded","deviceKey":"plug-0001","deviceId":"kitchen-plug","status":"discovered",
  "device":{"identifiers":["plug-0001"],"name":"Kitchen Plug","manufacturer":"Acme","model":"P1","swVersion":"1.0.0"},
  "origin":{"name":"test-publisher","swVersion":"0.1"},"firstSeen":"2026-10-02T09:12:04Z","lastSeen":"2026-10-02T09:12:04Z",
  "components":[{"key":"plug-0001-relay","component":"switch","name":"Relay","configTopic":"homeassistant/switch/plug-0001/relay/config",
   "stateTopic":"plug/relay","commandTopic":"plug/relay/set","commandTopics":["plug/relay/set"],"tag":"relay",
   "unsupported":[],"unknownKeys":[],"flags":[]}]}]}
```

Una fuente con `external` en true es un broker configurado bajo `/api/mqtt/brokers`, y `broker` dice dónde está. `autoCreate` en false es una fuente cuyos dispositivos esperan en la bandeja de entrada: aparecen como `discovered` sin `deviceId`, sin que se cree ni se lea nada hasta que alguien acepte uno. `listenOnly` es un broker en el que HotLoop nunca publica. `lastError` dice por qué una fuente no está conectada, incluida una contraseña que no se puede abrir.

`status` es `discovered`, `accepted` o `ignored`. Por componente, `unsupported` lista lo que HotLoop no puede usar y por qué («value template not supported: filter `regex_findall_index` is not supported at column 12»), `unknownKeys` las claves de configuración que el formato no define, `commandTopics` todos los topics a los que pueden ir sus comandos (el topic de velocidad de un ventilador además del principal), y `flags` lo que una persona debe mirar antes de aceptar: un topic de comando fuera de los topics que lee el componente, dentro del prefijo de descubrimiento o reclamado por otro dispositivo, y una configuración que pide comandos retenidos. `withdrawnAt` se establece en un componente que el publicador retiró. `suggestedEquipmentId` es el nodo del árbol que nombra el `suggested_area` del dispositivo, cuando exactamente un nodo tiene ese nombre; solo rellena de antemano el diálogo de aceptar. En el broker integrado, `announcedBy` y `announcedVia` son el login del broker y el id de cliente que publicaron su última configuración, y `acceptedLogin` el login desde el que se aceptó. Un dispositivo aceptado cuyo anuncio cambió, o que anunció un login distinto, tiene `review`:

```json
{"hash":"9a1c...","summary":["plug-0001-power: unit changed"],
 "changes":[{"key":"plug-0001-power","kind":"changed","fields":[{"field":"unit","running":"W","announced":"kW"}]}]}
```

### `GET /api/discovery/{source}/{key}`

Un dispositivo, con la misma forma. `404` para uno que HotLoop no ha visto.

### `POST /api/discovery/{source}/{key}/accept`

Acepta un dispositivo. Cuerpo opcional `{"equipmentId": 12}` lo coloca en el árbol en el mismo paso. No arma nada. Responde con el dispositivo. `400` para uno ignorado.

### `POST /api/discovery/{source}/{key}/ignore`

Descarta el dispositivo: su dispositivo de HotLoop, sus tags y sus entidades desaparecen (su historial se queda), y sigue ignorado cuando vuelve a anunciarse. Responde con el dispositivo. `DELETE /api/devices/{id}` sobre un dispositivo descubierto hace lo mismo, porque un dispositivo que sigue anunciándose simplemente volvería.

### `POST /api/discovery/{source}/{key}/unignore`

Devuelve un dispositivo ignorado a descubierto, a partir de lo último que anunció. `400` si no está ignorado.

### `POST /api/discovery/{source}/{key}/review/apply`

Hace que un dispositivo aceptado ejecute lo que anunció. Que cada punto esté armado o no sigue igual que estaba. `400` cuando no hay nada pendiente de revisión.

### `POST /api/discovery/{source}/{key}/review/reject`

Mantiene en marcha la configuración aceptada y deja de ofrecer este cambio. Un cambio distinto más adelante se vuelve a ofrecer. `400` cuando no hay nada pendiente.

Una revisión puede tratar de quién lo anunció: un cambio con `"kind":"publisher"` y la línea de resumen «announced by login garage-node; accepted from kitchen-node». Al aplicarlo, ese login pasa a ser aquel desde el que se acepta el dispositivo.

## Logins del broker

Los logins del broker integrado creados en HotLoop, cada uno con los topics en los que puede publicar y a los que puede suscribirse. Consulte [el broker MQTT integrado](/es/iot/broker/). Un login es una llave del broker de toda la planta, así que esto es `users.manage`, de un administrador. Nada de esto responde nunca con una contraseña ni su hash. Cada cambio queda en el registro y rige desde la siguiente publicación del cliente; nadie tiene que reconectarse.

### `GET /api/broker/logins`

```json
{"running":true,"anonymous":false,"prefix":"homeassistant","envLogins":["plant"],
 "profiles":[{"name":"shelly","about":"a Shelly Gen2 or later; name the login after its MQTT topic prefix",
   "publish":["%u/#","shellies/announce"],"subscribe":["%u/#","shellies/command","%p/status"]}],
 "logins":[{"name":"kitchen-node","profile":"esphome","publish":["%u/#","%p/+/%u/+/config","esphome/discover/%u"],
   "subscribe":["%u/#","%p/status","esphome/discover"],"createdBy":"admin","createdAt":"2026-10-02T09:12:04Z",
   "updatedAt":"2026-10-02T09:12:04Z","resolvedPublish":["kitchen-node/#","homeassistant/+/kitchen-node/+/config",
   "esphome/discover/kitchen-node"],"resolvedSubscribe":["kitchen-node/#","homeassistant/status","esphome/discover"]}]}
```

`running` es false cuando este proceso no ejecuta el broker; los logins se conservan igualmente, y el broker los lee al arrancar. `envLogins` son los nombres de `HOTLOOP_BROKER_USERS`, que pueden hacerlo todo. `%u` en una regla es el nombre del propio login y `%p` el prefijo de descubrimiento; `resolved*` son las reglas con ambos rellenados.

### `POST /api/broker/logins`

```json
{"name":"kitchen-node","password":"a-long-random-password","profile":"esphome"}
```

`name` es de 1 a 64 letras, dígitos, `-` y `_` (representa `%u` en los topics). `password` tiene al menos 12 caracteres. `profile` rellena las reglas; `publish` y `subscribe`, si se indican, las reemplazan. Hace falta una de las dos cosas. Una regla es un filtro de topic MQTT: `+` y `#` solo como niveles completos, `#` solo al final, nunca un topic `$`. `201` con el login; `400` por cualquiera de lo anterior o por un nombre que `HOTLOOP_BROKER_USERS` ya tiene; `409` para un nombre en uso.

### `PUT /api/broker/logins/{name}`

Cualquiera de `profile`, `publish`, `subscribe` y `password`; lo que no se envía se queda. `200` con el login, `404` para uno que no existe.

### `DELETE /api/broker/logins/{name}`

`200` `{"deleted":"kitchen-node"}`. Un cliente aún conectado con él no puede hacer nada desde entonces, y no puede volver a conectarse. `404` para uno que no existe.

## Descubrimiento de red

Dispositivos oídos en la red de la planta por mDNS, SSDP y DHCP, y lo que una persona decidió sobre cada uno. Consulte [Descubrimiento de red](/es/iot/network-discovery/). En un ayudante `--mcp-stdio`, que nunca escucha, `GET /api/network-discovery` responde `{"running":false,"finds":[]}` y todas las demás rutas `503`.

`{key}` es cómo se oyó un hallazgo y quién lo oyó: `mdns:` y su nombre de host mDNS, `ssdp:` y su uuid UPnP, `dhcp:` y su MAC. Codifíquelo como URL.

**Ninguna de estas llamadas arma nada**, y nada de esto se añade hasta que alguien lo acepte.

### `GET /api/network-discovery`

Los oyentes, el sondeo, las interfaces en las que están y todos los hallazgos:

```json
{"running":true,
 "status":{"leading":true,"interfaces":["eth0 10.20.0.15/24"],
  "listeners":[{"name":"mdns","enabled":true,"listening":true,"heard":120,"dropped":0,"refused":0},
   {"name":"ssdp","enabled":true,"listening":true,"heard":14,"dropped":0,"refused":0},
   {"name":"dhcp","enabled":false,"listening":false,"heard":0,"dropped":0,"refused":0}],
  "probe":{"networks":[]}},
 "finds":[{"key":"mdns:line3-ua.local","via":"mdns","kind":"opcua","name":"line3-ua","status":"discovered",
  "firstSeen":"2026-10-11T14:02:11Z","lastSeen":"2026-10-11T14:07:40Z",
  "find":{"key":"mdns:line3-ua.local","via":"mdns","kind":"opcua","name":"line3-ua",
   "summary":"OPC UA server, capabilities DA","host":"line3-ua.local","addresses":["10.20.0.31"],
   "services":[{"type":"_opcua-tcp._tcp.local","instance":"line3-ua._opcua-tcp._tcp.local","port":50000,
    "txt":{"caps":"DA","path":"/"}}],
   "proposal":{"protocol":"opcua","address":"opc.tcp://10.20.0.31:50000/","how":"Accepting makes an OPC UA device..."},
   "heard":"2026-10-11T14:07:40Z"}}]}
```

`kind` es `esphome`, `shelly`, `opcua`, `mqtt-broker`, `web`, `mdns` (anunció algo para lo que HotLoop no tiene palabra), `upnp` o `dhcp`. Un hallazgo cuya `proposal` tiene un `protocol` pasa a ser, al aceptarlo, un dispositivo de ese protocolo en `address`; uno que no lo tiene dice en `how` qué lo incorporaría. `also` lista los otros hallazgos y dispositivos descubiertos por MQTT que son la misma caja, por MAC o dirección. `status` es `discovered`, `accepted` o `ignored`, y `deviceId` el dispositivo que creó la aceptación. El `error` de un oyente dice por qué no está escuchando (puerto 67 ocupado o no permitido, ninguna interfaz multicast); `refused` cuenta los hallazgos nuevos descartados porque el registro está lleno.

### `GET /api/network-discovery/{key}`

Un hallazgo, con la misma forma. `404` para uno que HotLoop no ha oído.

### `POST /api/network-discovery/{key}/accept`

Acepta un hallazgo. Cuerpo opcional `{"equipmentId": 12}` coloca en el árbol el dispositivo que crea. Un hallazgo para el que HotLoop tiene controlador pasa a ser un dispositivo en la dirección propuesta, habilitado, sin tags y sin nada armado; cualquier otro se registra como conocido y no crea nada. Responde con el hallazgo. `400` para uno ya aceptado o ignorado.

### `POST /api/network-discovery/{key}/ignore`

Oculta un hallazgo sobre el que nadie ha decidido, y lo mantiene oculto cuando se vuelve a oír. `400` para uno ya decidido.

### `POST /api/network-discovery/{key}/unignore`

Devuelve un hallazgo ignorado para que se decida sobre él. `400` si no está ignorado.

### `POST /api/network-discovery/probe`

Sondea ahora: una consulta mDNS y una búsqueda SSDP en cada interfaz cuya red figure en `HOTLOOP_NETDISC_PROBE_NETWORKS`, y en ningún otro sitio. Responde `{"status": ...}`, con lo que no salió en `status.probe.lastError`. `400` cuando ninguna red tiene el sondeo activado: este botón no puede activarlo, solo el despliegue.

## Integraciones

El flujo de configuración para un tipo de dispositivo al que una persona apunta HotLoop: preguntar qué necesita la integración, mirar el dispositivo real con las respuestas y crear el dispositivo y sus tags a partir de lo encontrado. Consulte [Integraciones](/es/iot/integrations/).

**Nada de esto arma nada.** Todo tag que crea una configuración es de solo lectura. Armarlo es `POST /api/tags` como cualquier otro punto.

### `GET /api/integrations`

Todas las integraciones que tiene esta compilación, con las preguntas que hace:

```json
[{"id":"opcua","name":"OPC UA server","description":"A PLC, CNC, gateway or SCADA server ...",
  "protocol":"opcua","addressLabel":"Endpoint","addressPlaceholder":"opc.tcp://192.168.1.20:4840","writable":true,
  "fields":[{"key":"securityMode","label":"Security","kind":"choice","required":false,"default":"None",
             "choices":[{"value":"None","label":"None"},{"value":"Sign","label":"Sign"}]},
            {"key":"password","label":"Password","kind":"secret","required":false}]}]
```

`kind` es `text`, `number`, `bool`, `choice` o `secret`. Un campo con `showWhen` (`{"version":["3"]}`) solo se pregunta cuando otra respuesta tiene uno de esos valores, y se ignora la respuesta a una pregunta que no se muestra.

### `POST /api/integrations/{id}/probe`

Comprueba las respuestas y va a mirar el dispositivo real. No guarda nada.

```json
{"address":"opc.tcp://192.168.1.20:4840","options":{"securityMode":"None"}}
```

Responde `{"integration":"opcua","address":"opc.tcp://192.168.1.20:4840","found":{...}}`. `address` es la dirección tal como la resolvió la integración. `found` tiene `name` (cómo se llama a sí mismo el dispositivo), `identity` (qué dice que es), `notes` (cosas que conviene saber antes de aceptar) y `points`, cada uno con forma de tag `{name, address, dataType, unit, description, writable, deviceClass}` más `group`, `sample` (lo que leyó al encontrarlo) y `suggested`.

`400` para respuestas que no encajan con las preguntas, todos los problemas a la vez; una respuesta a una pregunta que la integración no hace también es `400`, no se ignora. `502` cuando el dispositivo no respondió o respondió con algo que no es su protocolo, con lo que fue mal. `404` para una integración que esta compilación no tiene. Un secreto nunca aparece en una respuesta ni en un error.

### `POST /api/integrations/{id}/setup`

Vuelve a mirar el dispositivo y luego lo crea junto con sus tags. El cuerpo es el del sondeo, más:

| Campo | Significado |
|---|---|
| `deviceId` | El id del dispositivo nuevo. Si se deja en blanco, se toma del nombre. `400` si ya lo tiene un dispositivo |
| `name` | El nombre del dispositivo. Si se deja en blanco, se toma cómo se llama a sí mismo el dispositivo |
| `points` | Nombres de `found.points` que configurar. Si se deja en blanco, se toman los marcados como `suggested`. Un nombre que el dispositivo no tiene es un `400` |
| `site`, `area`, `line` | Dónde va en el árbol de equipos, como en `POST /api/devices` |

Los puntos se comprueban contra el dispositivo tal como está ahora, no contra lo que un cliente dice que encontró hace un minuto. Responde `{"device":{...},"tags":3,"entities":["sensor.plc_sim_..."],"notes":[]}`. El dispositivo queda habilitado y consultándose, todo tag es de solo lectura y cada tag tiene su entidad de lectura. Una configuración que falla a medias no deja ningún dispositivo.

## Brokers MQTT

Brokers distintos del propio de HotLoop a los que escucha el descubrimiento: el Mosquitto de una planta, el broker que trajo una caja de Zigbee2MQTT. Consulte [Descubrimiento MQTT](/es/iot/mqtt-discovery/#otros-brokers). Sus contraseñas se sellan con la clave de credenciales de dispositivo (`HOTLOOP_SECRET_KEY_FILE`) y nunca se devuelven; `passwordSet` dice si hay una guardada, y `passwordProblem` por qué una guardada no se puede abrir. Cada cambio queda en el registro y surte efecto al instante: el oyente y los dispositivos de ese broker se vuelven a conectar.

### `GET /api/mqtt/brokers`

```json
{"secretKey":true,
 "brokers":[{"id":"plant-uns","name":"Plant UNS","broker":"tcp://10.20.0.5:1883","username":"hotloop","useTls":false,
   "insecureSkipVerify":false,"prefix":"homeassistant","listenOnly":true,"autoCreate":false,"tasmota":true,"shelly":true,"enabled":true,
   "createdBy":"admin","passwordSet":true,"createdAt":"2026-10-03T09:12:04Z","updatedAt":"2026-10-03T09:12:04Z"}]}
```

`secretKey` indica si este HotLoop tiene una clave con la que sellar una contraseña.

### `POST /api/mqtt/brokers`

```json
{"id":"plant-uns","name":"Plant UNS","broker":"tcp://10.20.0.5:1883","username":"hotloop",
 "password":"...","listenOnly":true}
```

`id` es de 1 a 63 letras minúsculas, dígitos y `-`, y no `embedded`: nombra al broker en todo dispositivo que vino de él y no puede cambiar. `broker` es `host:port` o una URL `tcp://`, `ssl://`, `tls://`, `mqtt://` o `mqtts://`, sin login. `prefix` es `homeassistant` por defecto; `autoCreate` es false (los dispositivos esperan en la bandeja de entrada); `listenOnly` es false; `tasmota` (oír también el descubrimiento propio de Tasmota, `tasmota/discovery/#`) es true; `shelly` (aprender los dispositivos Shelly Gen2 y posteriores a partir de los topics `<prefix>/status/<component>` que publican) es true; `enabled` es true. Una contraseña necesita un nombre de usuario y una clave: sin `HOTLOOP_SECRET_KEY_FILE` es un `400`, nunca se guarda en claro. `201` con el broker; `409` para un id en uso.

### `PUT /api/mqtt/brokers/{id}`

Cualquiera de los campos anteriores salvo `id`; lo que no se envía se queda. `"password":""` borra la contraseña. `200` con el broker.

### `DELETE /api/mqtt/brokers/{id}`

Elimina el broker y lo que anunció y nadie aceptó: la bandeja de entrada y todo dispositivo que creó por sí mismo. `409` que los nombra mientras sigan existiendo dispositivos aceptados desde él: ignórelos o elimínelos primero, o apague el broker con `"enabled":false`. `200` `{"deleted":"plant-uns"}`.

## Tags

### `GET /api/tags`

| Consulta | <span class="sr-only">Detalles</span> |
|---|---|
| `device` | Solo los tags de este dispositivo. Sin `limit`, responde con todos ellos |
| `q` | Búsqueda: una subcadena, sin distinguir mayúsculas, del id del dispositivo, el nombre del tag o la descripción. Funciona junto con `device` |
| `limit` | Un número entero de 1 a 5000. Por defecto 500 sin `device`. Cualquier otro valor, 5001 incluido, es `400`: se rechaza, nunca se responde con menos (hasta la 4.19.5 cualquier límite superior a 1000 se convertía en silencio en 200) |
| `writable` | `true` para solo los tags marcados como escribibles (lo que ofrecen los selectores de escritura) |
| `offset` | Dónde empieza la página, cero o más. Los tags se ordenan por dispositivo y luego por nombre |

La cabecera `X-Total-Count` de la respuesta indica cuántos tags coinciden en total, así que un cliente pagina con `offset` hasta tenerlos y sabe que los tiene. Una respuesta vacía es `[]`.

```json
[{"id":5,"deviceId":"tank-farm","name":"level_sp","address":"mqtt:docs-api-example/level_sp","dataType":"float","unit":"%","enabled":true,"writable":true,"maxValue":95,"hasRange":true,"scale":1,"createdAt":"2026-09-27T20:21:39.405164Z","updatedAt":"2026-09-27T20:21:39.405164Z"}]
```

### `POST /api/tags`

Crea el tag si `deviceId` y `name` son nuevos, y lo reemplaza si no.

| Campo | Tipo | <span class="sr-only">Detalles</span> |
|---|---|---|
| `deviceId` | string | Obligatorio. El dispositivo debe existir (`404` si no) |
| `name` | string | Obligatorio. Sin caracteres de control |
| `address` | string | Obligatorio. La dirección propia del protocolo |
| `dataType` | string | `bool`, `int`, `float` o `string` (y los alias habituales: `int16`, `word`, `coil`...). Decide cómo se codifica una escritura |
| `unit`, `description` | string | |
| `enabled` | bool | Si se omite, es `false` |
| `writable` | bool | **Arma el tag para escribir, desde todas las vías: interfaz, automatizaciones, entidades, MCP.** Si se omite, es `false` |
| `hasRange`, `minValue`, `maxValue` | bool, number, number | Con `hasRange`, una escritura fuera del rango se rechaza (nunca se recorta) |
| `scale`, `offset` | number | ingeniería = bruto x escala + desfase. Una escala de 0 vale 1 |
| `noData` | list | Valores brutos que significan «sin medición», cada uno `{"raw", "reason"}`. `raw` es una cadena (`"0x8005"`, `"-32763"`) o un número suelto, y se devuelve como cadena. Una lectura cuyo valor bruto está en la lista tiene calidad mala con ese `reason`, y se comprueba antes de `scale` y `offset`. Hasta 32 códigos. Un código que no es un número entero, que está dos veces en la lista o que no puede ser del tipo del punto es `400`. Consulte [Protocolos y controladores](/es/iot/protocols/#no-data-values) para saber qué escribir en cada tipo y el ejemplo de Yokogawa DX |
| `deadband`, `deadbandPercent` | number | Los cambios menores que esto no se escriben en el historial |
| `deviceClass` | string | La clase con la que empiezan las entidades del tag (`power`, `connectivity`, `temperature`...), cuando significa algo para su dominio. Se toma al crear el tag y se ignora al reemplazar: desde entonces la clase es de la entidad, así que cámbiela allí |

Responde con el tag guardado. Guardar uno con `writable: true` se registra como tal: armar un tag es una decisión de seguridad y lleva un nombre al lado. Las entidades del tag se crean o actualizan antes de la respuesta, así que un cliente puede pedirlas de inmediato.

Un tag de un dispositivo descubierto que nadie ha aceptado no se puede armar: `400`, «accept the device first». Consulte [Descubrimiento MQTT](/es/iot/mqtt-discovery/#comandos).

### `DELETE /api/tags/{device}/{name}`

`{"deleted":"tank-farm/level"}`, o `404`. El historial se conserva. Las entidades del tag quedan huérfanas (consulte [Entidades](/es/iot/entities/#tags-eliminados-huérfanas-y-readopción)).

## Valores, el tablero y escrituras

### `GET /api/values`

La última lectura de cada tag, desde memoria. `?device=` lo reduce a un dispositivo.

```json
[{"deviceId":"extruder-1","protocol":"opcua","tagName":"Temperature","tagValue":20.645294745260895,"unit":"C","quality":"good","timestamp":"2026-09-27T20:21:58.255722Z"}]
```

Esta forma es el `TagValue` del panel de EmberNet y es un contrato. `quality` es `good`, `uncertain` o `bad`; **una lectura mala significa que el valor no se conoce, no que sea cero**. Una lectura de texto lleva `stringVal`, y su `tagValue` no significa nada.

Una lectura que no es buena lleva `reason` cuando el controlador sabe por qué, para que una pantalla pueda decir más que «mala»:

```json
{"deviceId":"meter-01","protocol":"http","tagName":"power","tagValue":0,"quality":"bad","timestamp":"2026-09-30T09:12:04.51Z","reason":"no field at ENERGY.Power"}
```

Una lectura buena nunca lo tiene, así que el contrato anterior es byte por byte lo que era. El historiador no lo guarda: `/api/history` tiene la calidad, no el motivo.

### `GET /api/sparkline`

Las últimas lecturas de un tag guardadas en memoria (`HOTLOOP_RING_SIZE`, 30 por defecto), para los gráficos pequeños. `?tag=device/tag`, obligatorio.

```json
{"tag":"extruder-1/Temperature","timestamps":[1790540498609,1790540499246,1790540500246],"values":[0,20.06524581530632,19.933308705395785]}
```

`timestamps` son milisegundos Unix. Ambos son `[]` para un tag sin lecturas. `400` para una clave mal formada.

### `GET /api/board`

Qué tags están fijados al tablero, y en cuántas columnas. Se guarda en la base de datos, no en el navegador, porque un tablero pertenece a la planta: el PC de panel en el taller y el portátil de la oficina muestran el mismo.

```json
{"columns":2,"tags":["extruder-1/Temperature","tank-farm/level"],"rev":"9f2c41b07a6d3e58"}
```

`rev` nombra el tablero tal como está guardado. Envíelo de vuelta al guardar y el guardado se rechaza si el tablero ha cambiado desde entonces (más abajo).

### `PUT /api/board`

La misma forma. `columns` fuera de 1 a 4 pasa a 3; los duplicados se descartan. `rev` es opcional: con el `rev` del tablero que leyó, un guardado sobre un tablero que ha cambiado desde entonces es un `409` y no cambia nada, así que una página que nunca leyó el tablero, o leyó uno antiguo, no puede reemplazar el de la planta con su copia. Si lo omite, el guardado no se comprueba, lo que conviene a un cliente que define todo el tablero cada vez. La interfaz web lee el tablero al arrancar y envía el `rev` en cada guardado. Todo tag debe existir (`404` que nombra el que no existe): una entrada obsoleta es un indicador que nunca se mueve. Responde con el tablero tal como queda guardado. Los operadores tienen `board.write`: ordenar el tablero es manejar la planta, no configurarla.

### `POST /api/write`

Escribe un valor en un tag, a través de la puerta de escritura.

| Campo | Tipo | <span class="sr-only">Detalles</span> |
|---|---|---|
| `tag` | string | Obligatorio. `device/tag` |
| `value` | bool, number or string | Obligatorio. `true` es un bool, `42` un entero, `42.5` un decimal, `"42"` una cadena: el tipo JSON es el tipo que se escribe, porque una bobina, una palabra y un real son tres cosas distintas en el cable |
| `reason` | string | Opcional. Se registra con la escritura |

```json
{"tag":"tank-farm/level_sp","written":"72.5"}
```

**Un valor va en las unidades del tag, igual que una lectura.** En un tag con escala o desfase, lo que usted envía es lo que el tag devolvería al leerlo, y HotLoop envía al dispositivo la cuenta que lo produce: 55.5 en un registro con escala 0.1 pone 555 en el registro. (Hasta la 4.18, el número llegaba al dispositivo tal cual, así que 55.5 pasaba a 55 y se leía como 5.5.) La comprobación de rango y la fila de auditoría usan su número, en las unidades del tag. Una cuenta que después no cabe en el registro, como 7000 en un `uint16` con escala 0.1, se rechaza con la cuenta y el registro nombrados, y no se envía nada. Una fracción de cuenta se corta, como siempre hizo un registro de cuenta entera: 12.34 en un registro con escala de décimas guarda 12.3.

La puerta comprueba, en orden, que las escrituras están activadas (`HOTLOOP_ALLOW_WRITES`), que el tag está armado y que el valor está en rango. Todo intento, rechazado o no, está en `GET /api/writes`.

| Estado | Cuándo |
|---|---|
| 400 | Sin valor, un valor `null`, una clave mal formada |
| 403 | Las escrituras están desactivadas, o `"tank-farm/level: this tag is not marked writable"` |
| 404 | No existe ese tag |
| 422 | `"value is outside the tag's configured range: 120 is outside 0..95"` |
| 503 | El dispositivo no está conectado |

## Historial y auditoría

### `GET /api/history`

| Consulta | <span class="sr-only">Detalles</span> |
|---|---|
| `tag` | Obligatorio, repetible, hasta 50: `?tag=a/x&tag=b/y` |
| `minutes` | Hasta dónde hacia atrás desde ahora. Por defecto 60 |
| `bucket` | Tamaño del intervalo en segundos. Por defecto: se elige para que la ventana tenga unos 400 intervalos, en una escalera de 1 s a 1 día |
| `raw` | `true` para las lecturas mismas en lugar de intervalos |
| `limit` | Por defecto 5000, como máximo 100000 |
| `carry` | `true` para decir también qué valor tenía cada tag cuando empezó la ventana (solo intervalos) |

Por intervalos, del más antiguo al más reciente por tag. `badCount` es cuántas lecturas del intervalo no eran de buena calidad; se cuentan, no se promedian. `from` y `to` son la ventana a la que corresponde la respuesta, separadas exactamente `minutes` y terminando cuando se hizo la pregunta:

```json
{"buckets":[{"deviceId":"extruder-1","tagName":"Temperature","bucket":"2026-09-27T20:21:00Z","avg":18.986210570239944,"min":0,"max":20.83008050535897,"first":0,"last":20.83008050535897,"count":22,"badCount":1}],"from":"2026-09-27T19:22:00Z","raw":false,"to":"2026-09-27T20:22:00Z"}
```

El historiador guarda una lectura cuando un valor se mueve más allá de su banda muerta, no en cada consulta, así que un tag que se ha mantenido quieto no tiene nada en la ventana que dibujar. Con `carry=true` la respuesta también tiene `"carry":[{"deviceId":"extruder-1","tagName":"Temperature","ts":"2026-09-27T16:40:12Z","value":21.4}]`: la última lectura anterior a `from`, para cada tag cuya última lectura anterior era buena y tenía un número. Un tag cuya última lectura era mala o dudosa, que no tiene lectura anterior o que es texto, no tiene entrada, porque no se sabe qué tenía y no le daremos a un gráfico una suposición. La tarjeta de tendencia dibuja a partir de esto.

Sin procesar, del más reciente al más antiguo:

```json
{"raw":true,"readings":[{"deviceId":"extruder-1","protocol":"","tagName":"Temperature","tagValue":21.021559879601448,"quality":"good","timestamp":"2026-09-27T20:22:00.267463Z"}]}
```

`400` sin `tag`, con más de 50, o con una clave mal formada.

### `GET /api/writes`

La auditoría de escrituras, del más reciente al más antiguo. Todo intento está aquí, incluidos los rechazados, porque «no sabemos si ese comando salió» es la peor respuesta que puede recibir una planta.

| Consulta | <span class="sr-only">Detalles</span> |
|---|---|
| `tag` | Un tag, `device/tag` |
| `device` | Todos los tags de un dispositivo (se ignora si se indica `tag`) |
| `entity` | Toda escritura que una llamada de servicio sobre esta entidad hizo o vio rechazada, en lugar de lo anterior |
| `call` | Toda escritura de una llamada, en lugar de todo lo anterior: la pulsación y la liberación de un botón, o cada destino de la aplicación de una receta, que comparten su `call_id` |
| `limit` | Por defecto 100, como máximo 5000 |

```json
[{"id":2,"at":"2026-09-27T20:22:01.04226Z","deviceId":"tank-farm","tagName":"level_sp","value":"120","prior":"0 %","actor":"admin","source":"ui","succeeded":false,"error":"refused: value is outside the tag's configured range: 120 is outside 0..95"},
 {"id":4,"at":"2026-09-27T20:23:03.276962Z","deviceId":"tank-farm","tagName":"pump","value":"true","prior":"0","actor":"admin","source":"ui","succeeded":true,"latencyMs":0.317,"entityId":"switch.tank_farm_pump","service":"switch.turn_on","callId":"5c9f8545a93b5443"}]
```

`source` es `ui`, `api`, `automation` o `mcp`. `entityId`, `service` y `callId` solo aparecen en las escrituras que hizo una llamada de servicio.

## Entidades y estados

Cada tag recibe entidades sin que nadie lo pida; los compuestos (motores, válvulas, lazos, contadores, selectores, botones, estaciones meteorológicas) los construye un administrador a partir de tags. En snake_case, como todo endpoint de entidades. El modelo completo está en [Entidades](/es/iot/entities/).

### `GET /api/entities`

Todas las entidades, huérfanas incluidas.

| Consulta | <span class="sr-only">Detalles</span> |
|---|---|
| `domain` | `sensor`, `switch`, `motor`... |
| `device` | Entidades de un dispositivo |
| `orphaned` | `true` para solo las huérfanas, `false` para ninguna |
| `q`, `limit` | Búsqueda: una subcadena, sin distinguir mayúsculas, del id de la entidad, el nombre o el id del dispositivo, y como máximo `limit` de ellas (de 1 a 5000, cualquier otro valor es `400`, nunca se recorta en silencio) ordenadas por id de entidad. `X-Total-Count` es cuántas coincidieron. Si se omiten, la lista es completa |

```json
[{"id":5,"entity_id":"switch.tank_farm_pump","unique_id":"tag-control:tank-farm/pump","domain":"switch","platform":"tag","name":"pump","device_id":"tank-farm","options":{},"disabled":false,"hidden":false,"created_at":"2026-09-27T20:21:39.153197Z","updated_at":"2026-09-27T20:21:39.153197Z","bindings":[{"role":"command","device_id":"tank-farm","tag_name":"pump"},{"role":"state","device_id":"tank-farm","tag_name":"pump"}],"equipment_id":null,"area_id":4,"labels":[]}]
```

### `GET /api/entities/composites`

Lo que puede crear `POST /api/entities`: cada dominio, los roles a los que se enlazan sus tags y los servicios que admite. Un rol indica su `kind` de tag, si es `required`, si un servicio lo escribe (`command`) y si el estado se lee de él (`feedback`). Una estación meteorológica no admite ningún servicio.

```json
{"domains":[{"domain":"weather","roles":[{"role":"temperature","kind":"number","required":true,"command":false,"feedback":true},{"role":"humidity","kind":"number","required":false,"command":false,"feedback":true}],"services":[]}]}
```

### `GET /api/entities/{entity_id}`

`{"entity": {...}, "state": {...}}`. `state` es `null` para una entidad deshabilitada. `404` para una desconocida.

### `GET /api/entities/{entity_id}/image`

La última imagen de una cámara o de una imagen, como los bytes que guarda HotLoop: `Content-Type` es lo que son (`image/jpeg`, `image/png`, `image/gif` o `image/webp`), con `X-Content-Type-Options: nosniff`, una `Content-Security-Policy` de aislamiento y un `ETag` (`If-None-Match` recibe un `304`). `404` para una entidad que no es de ese tipo, o antes de que haya llegado una imagen. El atributo `entity_picture` del estado es esta ruta con el hash de la imagen.

### `PUT /api/entities/{entity_id}`

Cambia solo los campos que usted envía. Solo para administradores: el entity_id es el nombre con el que toda automatización, panel y agente se refiere a la entidad, y cambiarlo es configuración.

| Campo | Tipo | <span class="sr-only">Detalles</span> |
|---|---|---|
| `entity_id` | string | Un cambio de nombre. El `unique_id` no se mueve |
| `name`, `icon`, `device_class`, `state_class`, `unit_of_measurement`, `entity_category` | string | |
| `options` | object | Por dominio; consulte [Entidades](/es/iot/entities/#api) |
| `disabled`, `hidden` | bool | Una entidad deshabilitada no tiene estado y no se puede comandar |
| `equipment_id` | int or null | La coloca en el árbol; `null` vuelve a seguir a su dispositivo |
| `labels` | string[] | El conjunto completo |

`unique_id`, `domain`, `platform`, el dispositivo y los enlaces no se pueden cambiar aquí, y enviarlos es un 400.

```json
{"entity":{"id":3,"entity_id":"sensor.tank_1_level","name":"Tank 1 level","device_class":"moisture","icon":"mdi:water-percent","...":"..."},"warnings":[]}
```

`warnings` avisa cuando algo es legal pero raro (una unidad que la clase de dispositivo no suele tener). `400` para un cuerpo vacío (`"the update names no field to change"`) o un valor incorrecto, `404` para una entidad desconocida, `409` para un entity_id en uso.

### `POST /api/entities`

Crea un compuesto. El cuerpo nombra el dominio y enlaza tags a sus roles:

```json
{"name":"Transfer pump","domain":"motor","bindings":[{"role":"run_command","device_id":"tank-farm","tag_name":"pump"},{"role":"running","device_id":"tank-farm","tag_name":"pump"}]}
```

También `entity_id` (si no, se genera a partir del nombre), `device_class`, `unit_of_measurement`, `icon`, `entity_category` y `options`. Qué roles y opciones admite cada dominio está en [Entidades](/es/iot/entities/#equipos-compuestos). Responde `201` `{"entity": {...}, "warnings": [...]}`. `400` para un dominio que no se crea aquí (un `sensor` viene de su tag, una `alarm` de su definición), un rol que falta o un tag que no puede cubrirlo, `409` para un entity_id en uso.

### `DELETE /api/entities/{entity_id}`

Elimina un compuesto, o una huérfana cuyo tag o definición de alarma ya no existe. `{"deleted":"motor.transfer_pump","entity":{...}}`. Cualquier otra responde `409` diciendo cómo sí desaparece:

```json
{"error":"this entity cannot be deleted: sensor.tank_1_level is kept in step with its tag; delete the tag, and then this orphan, or hide or disable it: already exists"}
```

### `GET /api/states`

El estado de cada entidad habilitada, ordenado por entity_id. `?domain=` filtra.

```json
[{"entity_id":"number.tank_farm_level_sp","state":"unknown","attributes":{"armed":true,"friendly_name":"level_sp","max":95,"min":0,"source":["tank-farm/level_sp"],"unit_of_measurement":"%"},"quality":"bad","last_changed":"2026-09-27T20:21:39.417193755Z","last_updated":"2026-09-27T20:21:39.417193755Z","last_reported":"2026-09-27T20:22:04.423849496Z"}]
```

`state` es siempre una cadena, incluso para un número; `unknown` y `unavailable` significan lo que dicen. `last_reported` es la marca de tiempo del dispositivo de la lectura que hay detrás.

### `GET /api/states/{entity_id}`

Un estado. `404` para una entidad desconocida, y un `404` distinto para una deshabilitada, que dice cómo habilitarla: una entidad deshabilitada no falta, y darla por faltante manda a alguien a buscar un error de tecleo.

## Energía

Lo que consume la planta y lo que cuesta: kilovatios hora, gas, agua, aire comprimido y el coste de una unidad fabricada. Un contador es un tag leído como una cantidad consumida. El modelo completo, las tarifas y lo que hace la pantalla están en [Energía](/es/iot/energy/). Leer es `energy.read`, que tienen todos los roles; crear o cambiar un contador o una tarifa es `energy.write`, de un administrador.

### `GET /api/energy/meters`

Todos los contadores, por tipo y luego por nombre, cada uno con cómo se lee y lo que consumió hoy.

```json
[{"id":"main","name":"Main panel","kind":"electricity","mode":"counter","source":{"device_id":"pm-01","tag_name":"kWh"},"unit":"kWh","factor":0.001,"tariff":{"currency":"USD","price":0.12,"bands":[{"from":"22:00","to":"06:00","price":0.07}]},"enabled":true,"status":{"state":"ok","last_read_at":"2026-11-19T21:15:00Z","resets":0,"gap_seconds":0},"today":{"value":412.6,"cost":49.51,"covered_seconds":43200,"estimated":false}}]
```

`status.state` es `ok`, `waiting` (aún no se ha leído nada del tag), `bad` (la lectura del tag no es buena, y `reason` dice por qué) o `disabled`.

### `POST /api/energy/meters`

Crea un contador. `id` son letras minúsculas, dígitos, `-` y `_`. `kind` es `electricity`, `gas`, `water`, `air`, `heat` o `production`. `mode` es `counter` (un tag acumulativo: lo consumido es lo que avanzó, por `factor`) o `power` (una tasa: lo consumido es la tasa durante el tiempo que se mantuvo, con `power_unit` `W`, `kW` o `MW`, y `unit` `Wh`, `kWh` o `MWh`). `source` es el tag. `tariff` es un `price` fijo por unidad con una `currency` opcional, y `bands` opcionales (`from` y `to` en un cuarto de hora, `days`, `price`) para una tarifa por franjas horarias; un contador de producción no tiene ninguna. Un contador eléctrico en `Wh`, `kWh` o `MWh` también puede tener un `demand_price` en la tarifa: lo que cuesta un kilovatio de su cuarto de hora más alto en una ventana. Si se omite `enabled`, es `true`. `201` con `{"meter": {...}, "warnings": []}`. `400` diciendo qué falla: el tag no existe o no es un número, una franja no está en un cuarto de hora, un contador de potencia con un factor. `409` para un id en uso.

### `GET /api/energy/meters/{id}`

Un contador, tal como lo muestra la lista. `404` para uno desconocido.

### `PUT /api/energy/meters/{id}`

Reemplaza la definición de un contador. Lo que ya contó se queda, con el precio al que se hizo. Apuntarlo a otro tag o modo olvida dónde quedó la última lectura, porque la siguiente lectura es de otra cosa.

### `DELETE /api/energy/meters/{id}`

Elimina un contador y todo lo que contó. `404` para uno desconocido.

### `GET /api/energy/summary`

El consumo y el coste de cada contador en una ventana, y el coste de una unidad fabricada. La ventana es `?period=` (`today`, `yesterday`, `this_week`, `last_week`, `this_month`, `last_month`, `last_7_days`, `last_30_days`, o un turno escrito `shift:06:00-14:00` para el último que ha empezado y `last_shift:06:00-14:00` para el anterior; los días, los meses y los turnos son los del sitio) o `?from=&to=` en RFC 3339, con from incluido y to no, como máximo 400 días. `meters` es una lista separada por comas de los contadores cuyo coste entra en el coste por unidad, y `per` nombra el contador de producción por el que dividir.

```json
{"period":"today","from":"2026-11-19T05:00:00Z","to":"2026-11-20T05:00:00Z",
 "meters":[{"id":"main","name":"Main panel","kind":"electricity","unit":"kWh","currency":"USD","value":412.6,"cost":49.51,"covered_seconds":43200,"coverage":1,"estimated":false}],
 "costs":[{"currency":"USD","cost":49.51}],
 "per_unit":[{"production":"parts","units":9800,"currency":"USD","cost":49.51,"cost_per_unit":0.00505}]}
```

`coverage` es la parte de la ventana transcurrida que respaldan las lecturas. Los costes en dos monedas nunca se suman, así que hay una fila `per_unit` para cada una. `cost_per_unit` es `null` cuando no se fabricó nada (`reason` es `nothing_made`) o cuando se fabricó y ningún contador con precio ha contado aún consumo (`nothing_counted`): eso no es una respuesta, no es cero.

Un contador con `demand_price` tiene un `demand` en su fila: `peak_kw` (el cuarto de hora más alto de la ventana, como los kilovatios que promedió), `peak_at` (cuándo empezó), `peak_covered_seconds` (cuánto de ese cuarto de hora se leyó; por debajo de 900 el pico queda subestimado) y `cost` (el pico por el precio). El `cost` de la fila sigue siendo lo que costó la energía; `costs` y `per_unit` incluyen el cargo por demanda.

### `GET /api/energy/summary/{period}`

Lo mismo que el resumen, sobre un periodo (o turno) con nombre dado en la ruta. `meters` y `per` siguen yendo en la consulta.

### `GET /api/energy/series`

El consumo de un contador en una ventana, `?meter=<id>`, la ventana como arriba, y `step`: `quarter` (como máximo 8 días), `hour` (el valor por defecto), `day` o `month`. Un paso sin lecturas no aparece en la lista.

```json
{"meter":"main","unit":"kWh","currency":"USD","step":"day","points":[{"start":"2026-11-19T05:00:00Z","value":412.6,"cost":49.51,"estimated":false}]}
```

### `GET /api/energy/series/{meter}/{period}/{step}`

Lo mismo que la serie, con el contador, el periodo con nombre y el paso en la ruta, para quien solo tiene una ruta que dar.

## Servicios

### `POST /api/services/{domain}/{service}`

Comanda una entidad: `switch/turn_on`, `number/set_value`, `motor/start`, `alarm/acknowledge`. Una entidad, un servicio, una llamada. Por debajo no es más que escrituras de tags por la misma puerta de escritura que `POST /api/write`.

```json
{"entity_id":"switch.tank_farm_pump","reason":"start of shift"}
```

`entity_id` es obligatorio y es una entidad, no una lista; `reason` es opcional; todo lo demás son los datos del servicio (`value`, `option`, `position`, `mode`, `minutes`, `note`). Los números conservan el tipo con que se escribieron. El dominio de la ruta debe ser el de la entidad. Todos los servicios y sus datos están en [Entidades](/es/iot/entities/#qué-admite-cada-dominio).

```json
{"call_id":"5c9f8545a93b5443","entity_id":"switch.tank_farm_pump","service":"switch.turn_on","writes":[{"tag":"tank-farm/pump","value":"true","status":"written"}]}
```

Cada escritura es `written`, `not_sent` (rechazada antes de llegar al dispositivo), `failed` (salió y el dispositivo informó de un error, así que no se sabe si surtió efecto) o `skipped` (una escritura anterior de la llamada no tuvo éxito). Las escrituras ya hechas nunca se deshacen. Los servicios de una entidad de alarma no escriben ningún tag y responden con la `alarm` como la dejó el motor. Los de un helper tampoco escriben ningún tag y responden con el `state` en que lo dejaron:

```json
{"call_id":"0f3c2a1b9d8e7f60","entity_id":"input_number.batch_target","service":"input_number.set_value","writes":[],"state":"1250"}
```

El `turn_on` de un script lo ejecuta, con los datos como sus campos, y responde con el `script_run` que inició; las escrituras de sus pasos se auditan una a una como `script:<id>`, no aquí. `turn_off` detiene todas sus ejecuciones. Consulte [Scripts](#scripts).

El `turn_on` de una escena aplica su receta, con `params` y `version` de los datos, y responde con la `recipe_application` completa y, en `writes`, cada escritura que hicieron sus destinos, en orden. Falla salvo que se haya escrito en todos los destinos. Consulte [Recetas](#recetas).

Una llamada fallida responde con el estado del error y el mismo cuerpo más `error`, para que se vea exactamente dónde se detuvo:

```json
{"error":"value is outside the tag's configured range: 150 is outside 0..95","call_id":"3cd42f8275e5765e","entity_id":"number.tank_farm_level_sp","service":"number.set_value","writes":[{"tag":"tank-farm/level_sp","value":"150","status":"not_sent","error":"value is outside the tag's configured range: 150 is outside 0..95"}]}
```

| Estado | Cuándo |
|---|---|
| 400 | Sin `entity_id`, dominio equivocado, servicio desconocido, datos que el servicio no admite |
| 403 | El permiso, o la puerta rechazó por política |
| 404 | No existe esa entidad |
| 409 | Una alternancia sin estado conocido, un equipo en un estado equivocado para el servicio |
| 422 | Un valor rechazado por su contenido |
| 503 | El dispositivo no está conectado; el motor de alarmas no está en marcha |
| 500 | La pulsación de un botón salió y su liberación no. **El tag aún puede tener el valor de pulsación**: compruébelo y libérelo a mano |

**`?dry_run=true`** pregunta qué haría la llamada y no hace nada de ello: no se escribe, audita ni registra nada. La llamada se planifica como la real y cada escritura se somete a las comprobaciones de la propia puerta, en el mismo orden, ahora mismo. Un veredicto responde 200, rechazado o no: cada escritura `would_write`, o la primera que sería rechazada `not_sent` con el motivo y las demás `skipped`, y `error` es el error con el que fallaría la llamada real, palabra por palabra.

```json
{"dry_run":true,"error":"value is outside the tag's configured range: 150 is outside 0..95","entity_id":"number.tank_farm_level_sp","service":"number.set_value","writes":[{"tag":"tank-farm/level_sp","value":"150","status":"not_sent","error":"value is outside the tag's configured range: 150 is outside 0..95"}]}
```

Una solicitud que la llamada real rechazaría antes de cualquier comprobación (entidad inexistente, servicio desconocido, datos que el servicio no admite, una alternancia sin estado conocido) responde con el estado y el error de la llamada real; lo mismo ocurre con un permiso que falta. `dry_run` es `true` o `false` y nada más: `yes` es un 400, no una suposición, porque suponer mal convierte una pregunta en una orden. Consulte [Entidades](/es/iot/entities/#preguntar-primero-la-simulación).

**Por qué el permiso se comprueba en el manejador.** Necesita `values.write`, igual que escribir el tag directamente, porque eso es todo lo que es; los servicios de una entidad `alarm` necesitan `alarms.ack`, igual que la pantalla de alarmas, los de un helper necesitan `helpers.write`, que tiene un operador, los de un script necesitan `scripts.run`, igual que `POST /api/scripts/{id}/run`, y los de una escena necesitan `recipes.apply` y el permiso propio de la receta cuando lo nombra, igual que `POST /api/recipes/{id}/apply`. La comprobación se hace dentro del manejador y no delante para que un rechazo por falta de él pase por la puerta de escritura y se **audite contra la entidad** como cualquier otro rechazo, con el valor que se pidió. Un usuario sin el permiso recibe un 403 y una línea en `GET /api/writes?entity=...`, no un 403 y nada. Un helper no escribe ningún tag, así que el rechazo de un helper, este incluido, es en cambio un aviso en el registro del sistema (`GET /api/events`) contra el helper, y lo mismo el de un script. El rechazo de una escena es una aplicación rechazada en el historial de la receta, con el usuario.

## Ayudantes

Valores que son de las personas de la planta y no de un PLC: `input_boolean`, `input_number`, `input_select`, `input_text`, `input_counter`, `timer` y `schedule`. Un ayudante es una entidad (plataforma `helper`) y aparece en `/api/entities` y `/api/states` como cualquier otra; estas rutas son su configuración. Su valor se fija con los servicios de arriba, con `helpers.write`. Cada dominio, opción y servicio está en [Ayudantes](/es/iot/helpers/).

### `GET /api/helpers`

Todos los ayudantes, cada uno con los campos de su entidad y su `value`, la fila guardada para él:

```json
[{"id":41,"entity_id":"timer.purge","unique_id":"helper:6f1d...","domain":"timer","platform":"helper","name":"Purge","options":{"duration_sec":600},"...":"...","value":{"state":"active","finishes_at":"2026-09-27T21:10:00Z","duration_ms":600000,"changed_at":"2026-09-27T21:00:00Z","changed_by":"otto","source":"ui","call_id":"9a1b...","rev":4}}]
```

### `POST /api/helpers`

Crea un ayudante con su valor inicial. Solo para administradores.

```json
{"name":"Batch target","domain":"input_number","unit_of_measurement":"kg","options":{"min":0,"max":5000,"step":50,"initial":1000}}
```

También `entity_id` (si no, se genera a partir del nombre) e `icon`. Responde `201` `{"helper": {...}}`. `400` para un dominio que no es de un ayudante, una opción que el dominio no admite o un `initial` que sus propias opciones rechazarían; `409` para un entity_id ya usado.

### `GET /api/helpers/{entity_id}`

Un ayudante, como en la lista. `404` para una entidad desconocida o que no es un ayudante.

### `PUT /api/helpers/{entity_id}`

Cambia su `name`, `icon`, `unit_of_measurement`, `options`, `disabled`, `hidden`, `entity_id`, `equipment_id` o `labels`, los mismos campos que `PUT /api/entities/{entity_id}`. Solo para administradores. Unas opciones nuevas que no permitirían el valor que guarda ahora (un rango reducido por debajo de él, la opción seleccionada eliminada) dan un `400`: un valor nunca se mueve para que encaje. Responde `{"helper": {...}, "warnings": []}`.

### `DELETE /api/helpers/{entity_id}`

Elimina el ayudante y su valor. Solo para administradores. `{"deleted":"timer.purge"}`. `DELETE /api/entities/{entity_id}` rechaza un ayudante con un `409` que apunta aquí.

## Equipos y etiquetas

El árbol ISA-95 (empresa, sitio, área, línea, celda, unidad, equipo) y las etiquetas de formato libre. En snake_case. Todos los roles leen; solo un administrador cambia, porque renombrar o mover un nodo reescribe el sitio, el área y la línea de cada dispositivo que cuelga de él. Véase [el árbol de equipos y las etiquetas](/es/iot/equipment/).

### `GET /api/equipment`

Todos los nodos, ordenados por id, cada uno con su `path` de nombres desde la raíz. `?level=area` filtra. `?q=` conserva los nodos cuya ruta contiene el texto (sin distinguir mayúsculas), `?limit=` (de 1 a 5000, cualquier otro valor es `400`) los primeros de ellos; con cualquiera de los dos, `X-Total-Count` es cuántos coincidieron.

```json
[{"id":4,"parent_id":1,"level":"area","name":"Utilities","created_at":"2026-09-27T20:21:01.637319Z","updated_at":"2026-09-27T20:21:01.637319Z","path":["Demo Plant","Utilities"]}]
```

### `POST /api/equipment`

```json
{"parent_id":3,"level":"cell","name":"Die head","description":"Die and screen changer"}
```

`parent_id` nulo u omitido crea una raíz. Un hijo debe ser de un nivel inferior al de su padre (un equipo puede estar dentro de otro). Responde `{"equipment": {...}, "devices_rewritten": []}`. `400` para un nivel o una ubicación incorrectos, `409` para un hermano con el mismo nivel y nombre.

### `GET /api/equipment/{id}`

El nodo, los nodos que cuelgan directamente de él, y los dispositivos y entidades colocados directamente en él:

```json
{"children":[],"devices":["extruder-1"],"entities":[],"equipment":{"id":3,"parent_id":2,"level":"line","name":"Line 1","...":"...","path":["Demo Plant","Extrusion","Line 1"]}}
```

`400` para un id que no es un número positivo, `404` para uno desconocido.

### `PUT /api/equipment/{id}`

Cualquiera de `name`, `description`, `level`, `parent_id` (`null` lo mueve a la raíz). Solo cambian los campos enviados; un cuerpo vacío es un 400. Responde el nodo y **todos los dispositivos cuyo texto de sitio, área o línea cambió como consecuencia**, porque ese texto es el que leen los clientes más antiguos y las herramientas MCP:

```json
{"devices_rewritten":["tank-farm"],"equipment":{"id":4,"parent_id":1,"level":"area","name":"Utilities East","...":"..."}}
```

### `DELETE /api/equipment/{id}`

`{"deleted":5}`. `409` mientras haya algo debajo o colocado en él, e indica qué: borrar un nodo bajo los pies de un dispositivo no es una decisión que se tome por accidente.

### `GET /api/labels`

```json
[{"label_id":"critical","name":"Critical","color":"red","icon":"mdi:alert","description":"Stops the line if it fails","created_at":"2026-09-27T20:24:29.659126Z","updated_at":"2026-09-27T20:24:29.659126Z"}]
```

### `POST /api/labels`

`name` es obligatorio; `label_id` (de 1 a 64 letras minúsculas, dígitos y guiones bajos) se genera a partir del nombre si se omite, y nunca cambia después. `color`, `icon` (`mdi:...`) y `description` son opcionales. Responde la etiqueta. `409` para un nombre o id ya usado.

### `GET /api/labels/{label_id}`

`{"label": {...}, "devices": ["tank-farm"], "entities": []}`: la etiqueta y lo que la lleva. `404` para una desconocida.

### `PUT /api/labels/{label_id}`

Reemplaza `name`, `color`, `icon` y `description`; un campo omitido se borra. Un `label_id` en el cuerpo debe coincidir con la ruta: `400` en caso contrario, porque un label_id nunca cambia.

### `DELETE /api/labels/{label_id}`

La quita de todo lo que la lleva. `{"deleted":"critical"}`, o `404`.

### `PUT /api/devices/{id}/labels`

`{"labels": ["critical"]}` reemplaza todo el conjunto de un dispositivo. Responde `{"id":"tank-farm","labels":["critical"]}`. Toda etiqueta debe existir (`400` con los nombres de las que faltan) y el dispositivo también (`404`). Las etiquetas no forman parte de `POST /api/devices` a propósito: todo cliente que guarda un dispositivo envía el dispositivo completo sin ellas, y las borraría en cada guardado.

## Alarmas

ISA-18.2: activarse, reconocerse y volver a la normalidad son cosas distintas, y el registro puede decir cuál ocurrió.

### `GET /api/alarms`

Todas las definiciones, las alarmas activas y el resumen. `?outstanding=true` omite las normales y las silenciadas.

```json
{
  "alarms": [{"definitionId":"extruder-temp-hi","name":"Extruder temperature high","deviceId":"extruder-1","tagName":"Temperature","priority":2,"state":"unack-active","message":"extruder-1/Temperature at 22.80197037650447 C, limit 5","tripValue":22.80197037650447,"raisedAt":"2026-09-27T20:25:19.67042816Z","count":1,"updatedAt":"2026-09-27T20:25:19.67042816Z"}],
  "definitions": [{"id":"extruder-temp-hi","name":"Extruder temperature high","deviceId":"extruder-1","tagName":"Temperature","condition":"hi","limit":5,"priority":2,"enabled":true,"deadband":0.5,"message":"{device}/{tag} at {value}, limit {limit}","createdAt":"2026-09-27T20:25:19.055658Z","updatedAt":"2026-09-27T20:25:19.055658Z"}],
  "summary": {"critical":0,"high":1,"medium":0,"low":0,"unacked":1,"total":1}
}
```

`state` es `normal`, `unack-active`, `ack-active`, `rtn-unack` (se normalizó antes de que nadie la reconociera, y se queda en la lista para que un disparo a las 3 de la madrugada no desaparezca antes de que lo vea el turno de la mañana), `shelved` o `suppressed`. `tripValue` es la lectura que la activó, no la actual.

### `POST /api/alarms`

Crea o reemplaza una definición.

| Campo | Tipo | <span class="sr-only">Detalles</span> |
|---|---|---|
| `id`, `name` | string | Obligatorio. `id` sigue las reglas de id de dispositivo |
| `deviceId`, `tagName` | string | Obligatorio |
| `condition` | string | `hihi`, `hi`, `lo`, `lolo`, `eq`, `ne`, `true`, `false`, `bad-quality`, `stale` (sin lectura durante `limit` segundos), `roc` (velocidad de cambio superior a `limit` por segundo) |
| `limit` | number | |
| `priority` | int | 1 (crítica) a 4 (baja) |
| `enabled` | bool | Si se omite, es `false` |
| `deadband` | number | Cuánto debe retroceder el valor antes de normalizarse. Sin banda muerta, un valor situado justo en el límite oscila sin parar |
| `onDelaySec`, `offDelaySec` | int | Cuánto tiempo debe mantenerse la condición antes de activarse, o estar normal antes de volver a la normalidad |
| `message`, `description` | string | `message` admite `{value}`, `{limit}`, `{tag}`, `{device}`, `{unit}`, `{condition}` y `{reason}` (por qué es mala la lectura, vacío cuando es buena) |

`{value}` se escribe como lo escribe la tarjeta de valor, con la unidad incluida: los números enteros tal cual, dos decimales a partir de 1, uno a partir de 100, cuatro por debajo de 1, y notación científica por encima de diez millones o por debajo de 0.01 (`8.20 pH`, `212.5 F`, `1.235e+7`). Lo hicimos así porque un tag con escala 0.1 y un valor bruto de 82 es 8.200000000000001 como float, y el aviso solía decirlo así. Una lectura de texto se dice tal cual. El tag, las escrituras y las automatizaciones siguen viendo el número exacto; solo se redondea la frase. `{limit}` es el límite tal como lo escribió usted.

Responde la definición; el motor se recarga y la entidad de la alarma se crea antes de la respuesta. `400` si falla la validación (`"alarm x: priority must be 1-4, got 9"`).

### `POST /api/alarms/import/codesys`

Lee el archivo que escribe Export Alarms del IDE de CODESYS (la exportación de un grupo de alarmas, `.csv`) desde el cuerpo de la solicitud, tal como lo escribió el IDE (UTF-16 con marca de orden de bytes) o en UTF-8. `?deviceId=` es el dispositivo del PLC y es obligatorio. `?application=` es el nombre de la aplicación bajo la que están sus tags, `Application` si se omite: la exportación nombra una variable por su GVL (`GVL_Alarm.bPumpFault`) y el tag es `Application.GVL_Alarm.bPumpFault`. `?defaultPriority=` (de 1 a 4) es la prioridad de una alarma cuya clase no es Error, Warning ni Info. Sin `?apply=true` no se guarda nada: la respuesta dice qué se importaría.

La pantalla Alarmas lo ofrece como Importar desde CODESYS (solo administradores): elija el dispositivo, indique la aplicación, elija el archivo, revise la vista previa y luego importe.

Las alarmas digitales comparadas con `= TRUE` o `= FALSE` pasan a ser `true` y `false`, UpperLimit con `>` pasa a ser `hi`, LowerLimit con `<` pasa a ser `lo`, una alarma Outside range (`OutOfArea`, con ambos operadores `<`) pasa a ser dos alarmas, una `lo` en el límite inferior y una `hi` en el superior, el mensaje y los retardos de activación y desactivación (un tiempo IEC como `T#5s`) se conservan, y Error es prioridad 2, Warning 3, Info 4. Todo lo demás que el IDE puede escribir no se lee y vuelve en `skipped` con su fila y el motivo, porque CODESYS no documenta el formato y solo se lee lo que una exportación real ha mostrado. Eso incluye el resto de lo que ofrece el IDE: Inside the range (`ForbiddenArea`) es verdadero solo entre dos límites y aquí una alarma tiene uno, Change no tiene una duración documentada, y Event y Alarm (API) los activa el programa del PLC y no tienen variable que vigilar. `warnings` enumera lo que pasó solo en parte (una clase desconocida, el enclavamiento, una alarma de mayor prioridad).

```json
{"applied": false, "version": "2.0.0.0",
 "alarms": [{"id":"codesys-GVL_Alarm.rTemp-hi","name":"Temperature high","deviceId":"plc1","tagName":"Application.GVL_Alarm.rTemp","condition":"hi","limit":90,"priority":3,"enabled":true,"message":"Temperature high"}],
 "skipped": [{"row":5,"id":"3","reason":"the observation type \"Deviation\" has not been seen in an export, so it is not read"}],
 "warnings": []}
```

`404` para un dispositivo desconocido, `400` para un archivo que no es la exportación de un grupo de alarmas.

### `DELETE /api/alarms/{id}`

`{"deleted":"extruder-temp-hi"}`, o `404`.

### `POST /api/alarms/{id}/ack`

Cuerpo opcional `{"note": "checking the heater bands"}`. Responde la alarma tal como queda, con `ackedBy` y `ackNote`. `404` para una alarma desconocida.

### `POST /api/alarms/{id}/shelve`

`{"minutes": 30}`, obligatorio y positivo: un silencio indefinido es una supresión, que es algo distinto y no corresponde decidirlo a un operador. Responde la alarma, con `state` en `shelved`, `shelvedUntil` y `shelvedBy`.

### `POST /api/alarms/{id}/unshelve`

Sin cuerpo. Responde la alarma de vuelta en el estado que su condición le dé. `409` si no estaba pospuesta.

### `GET /api/alarms/events`

El registro de auditoría de alarmas, de la más reciente a la más antigua. `?alarm=` una definición, `?limit=` (200 por defecto, como máximo 5000).

```json
[{"id":2,"definitionId":"extruder-temp-hi","type":"acked","fromState":"unack-active","toState":"ack-active","value":23.192472931395088,"message":"extruder-1/Temperature at 22.80197037650447 C, limit 5","actor":"admin","note":"checking the heater bands","at":"2026-09-27T20:25:22.920251Z"}]
```

`type` es `raised`, `acked`, `cleared`, `shelved`, `unshelved`, `suppressed`, `unsuppressed`, `escalated` o `escalation-ended`. Los dos últimos los escribe la escalada de alarmas (`actor` es `escalation`), y su `note` dice a quién se avisó y por qué la cadena se detuvo. Véase [Notificaciones de alarmas](/es/iot/notifications/#escalado).

## Automatizaciones

Disparadores, una condición, acciones. El lenguaje de reglas está en [Automatizaciones](/es/iot/automations/).

### `GET /api/automations`

```json
{"armed":{"fill-tank":true},"automations":[{"id":"fill-tank","name":"Fill the tank","enabled":true,"triggers":[{"type":"threshold","deviceId":"tank-farm","tagName":"level","threshold":20,"direction":"falling","hysteresis":5},{"type":"webhook","webhookPath":"fill-now"}],"actions":[{"type":"call_service","name":"start the pump","params":{"service":"switch.turn_on","entityId":"switch.tank_farm_pump"}}],"mode":"skip","minIntervalSec":60,"createdAt":"2026-09-27T20:26:49.770826Z","updatedAt":"2026-09-27T20:26:49.770826Z"}],"webhooks":["fill-now"]}
```

`armed` indica qué reglas se están ejecutando de verdad, que no es lo mismo que `enabled`: una regla habilitada que dejó de compilar no está armada, y aquí es donde se entera.

### `POST /api/automations`

Crea o reemplaza una regla: `id`, `name`, `description`, `enabled`, `triggers` (al menos uno), `condition`, `actions` (al menos una), `mode` (`skip`, el predeterminado, `queue`, `restart` o `parallel`), `minIntervalSec`, `maxRuntimeSec`. La regla se compila antes de guardarse, y una que no compila da un 400 y nunca llega a la base de datos: una regla guardada que no se puede armar es una regla que su autor cree que está funcionando.

```json
{"error":"automation fill-tank action 1 (call_service): params: json: unknown field \"entity_id\""}
```

### `POST /api/automations/validate`

Compila una regla sin guardarla, para la comprobación en vivo del editor. Siempre `200`; la respuesta dice si compiló:

```json
{"valid":true}
{"error":"automation bad: at least one trigger is required","valid":false}
```

Necesita `automations.write` porque existe para ayudar a alguien a escribir una.

### `DELETE /api/automations/{id}`

`{"deleted":"fill-tank"}`, o `404`.

### `POST /api/automations/{id}/enabled`

`{"enabled": false}` la desarma sin eliminarla. Responde `{"enabled":false,"id":"fill-tank"}`, o `404`.

### `POST /api/automations/{id}/trigger`

La ejecuta ahora, como si se hubiera disparado un disparador. La condición sigue aplicándose (una falsa registra una ejecución `skipped`) y el modo de ejecución también; `minIntervalSec` no, porque una persona que pide una ejecución no es un tag que oscila. Sin cuerpo. `202` `{"triggered":"fill-tank"}`: la ejecución ocurre en segundo plano, y `GET /api/runs` tiene el resultado. `400` si la regla no está armada. Los operadores tienen `automations.trigger`; ejecutar una regla que escribió otra persona es operar, escribir una no lo es.

### `GET /api/runs`

Historial de ejecuciones, de la más reciente a la más antigua. `?automation=` una regla, `?limit=` (100 por defecto, como máximo 1000). `[]` cuando no hay ninguna.

```json
[{"id":1,"automationId":"fill-tank","status":"succeeded","triggerType":"manual","triggerDesc":"triggered by admin","actor":"admin","startedAt":"2026-09-27T20:26:50.269792Z","finishedAt":"2026-09-27T20:26:50.282129Z","durationMs":12.337,"steps":[{"index":1,"type":"call_service","name":"start the pump","input":"switch.turn_on switch.tank_farm_pump {}","output":"true to tank-farm/pump: written; call 8fb9538c82d532be","startedAt":"2026-09-27T20:26:50.272532641Z","durationMs":9.595}]}]
```

`status` es `running`, `succeeded`, `failed`, `skipped`, `timed_out` o `cancelled`. Los pasos guardan las entradas ya resueltas, no las plantillas, porque eso es lo que hay que leer a las 3 de la madrugada.

Una regla creada a partir de un blueprint lleva tres campos más en `GET /api/automations`: `blueprintId`, `blueprintVersion` (la versión a partir de la cual se creó, que es la versión en la que se queda) y `blueprintInputs`. Una regla escrita a mano no tiene ninguno. Los gestiona el servidor: `POST /api/automations` los acepta y los ignora, y una edición a mano conserva lo que la regla tuviera.

### `POST /api/automations/{id}/blueprint-upgrade`

Lleva una regla creada a partir de un blueprint a la versión más reciente del blueprint, conservando su id, su nombre y si está armada. Nunca se hace por usted. Los operadores tienen `blueprints.apply`, igual que para crear una. Mire primero: **`?dry_run=true`** no cambia nada y responde qué cambiaría, parte por parte, y qué haría la regla si se disparara ahora, con cada escritura sometida a las comprobaciones de la puerta de escritura:

```json
{"dry_run":true,"id":"pump_1_watch","blueprint":"pump_watch","from":1,"to":2,"changes":[{"field":"actions","before":[{"params":{"message":"switch.pump_1 started, v1"},"type":"log_event"}],"after":[{"params":{"message":"switch.pump_1 started, v2"},"type":"log_event"}]}],"automation":{"id":"pump_1_watch","...":"..."},"check":{"automation_id":"pump_1_watch","steps":[{"step":"1","type":"log_event","verdict":"not_checked","detail":"a dry run checks writes to equipment; this step writes to none and runs only for real"}]}}
```

Una edición hecha a mano desde que se creó la regla aparece en `changes` como reemplazada. Cuando la nueva versión necesita una entrada para la que la regla no tiene valor, o rechaza un valor con el que se creó, la prueba lo dice en `error` y nada más.

La real recibe `{"version": 2}`, la versión que mostró la prueba, e `inputs` para lo que necesite la nueva versión. Un blueprint que ha avanzado desde entonces, o una regla que alguien actualizó mientras tanto, da un `409`: lo que se revisó es lo que entra, o no entra nada. Una entrada que falta es un `400`. `200` con la misma forma, siendo `automation` la regla tal como queda guardada. Se registra como `automation upgraded from blueprint pump_watch version 1 to 2`. Con la misma versión y nuevos `inputs`, es la forma de cambiar las entradas de una regla. `400` para una regla escrita a mano; `404` si el blueprint del que salió ya no existe.

## Scripts

Secuencias de acciones con nombre, que se ejecutan a demanda: desde aquí, desde un paso `call_script` de una regla, desde `run_script` de MCP o mediante la entidad del script (`script.turn_on`). La secuencia es el lenguaje de automatización. Cada escritura que hace un paso pasa por la puerta de escritura como `script:<id>`, con el origen de quien lo inició. Todo está en [Scripts](/es/iot/scripts/).

### `GET /api/scripts`

Todos los scripts, con sus contadores de ejecución y cuántas ejecuciones suyas hay en marcha ahora, en cualquier proceso:

```json
[{"id":"cip_cycle","name":"CIP cycle","fields":[{"name":"minutes","type":"number","required":true,"min":1,"max":60,"unit":"min"}],"sequence":[{"type":"call_service","params":{"entityId":"switch.cip_pump","service":"switch.turn_on"}}],"mode":"skip","createdAt":"2026-09-28T10:00:00Z","updatedAt":"2026-09-28T10:00:00Z","lastRun":"2026-09-28T10:05:00Z","lastStatus":"succeeded","runCount":3,"running":0}]
```

### `POST /api/scripts`

Crea uno. Solo para administradores. `id` (letras minúsculas, dígitos y guiones bajos, empezando por una letra: es el id de objeto de la entidad, `script.<id>`), `name`, `description`, `icon`, `fields` (entradas con tipo), `sequence` (al menos una acción), `mode` (`skip`, el predeterminado, `queue`, `restart` o `parallel`) y `maxRuntimeSec`. Se compila antes de guardarse, como una regla, y se rechaza un script que se llamaría a sí mismo, directamente o a través de otros scripts. Responde `201` con el script. `400` para lo que no compila; `409` para un id ya usado.

### `POST /api/scripts/validate`

Comprueba un script sin guardarlo, para la comprobación en vivo del editor. `200` `{"valid":true}` o `{"valid":false,"error":"..."}`, con las palabras con las que se rechazaría un guardado.

### `GET /api/scripts/{id}`

Un script, como en la lista. `404` si no existe.

### `PUT /api/scripts/{id}`

Reemplaza su definición; el cuerpo es el mismo que para crearlo, y su `id` puede omitirse. Solo para administradores. Las ejecuciones en curso se cancelan cuando cambian sus pasos, campos o modo: se iniciaron con la definición anterior.

### `DELETE /api/scripts/{id}`

Lo elimina junto con su historial de ejecuciones, y cancela las ejecuciones en curso. Solo para administradores. `{"deleted":"cip_cycle"}`. Su entidad queda huérfana, no se elimina.

### `POST /api/scripts/{id}/run`

Lo ejecuta. Los operadores tienen `scripts.run`.

```json
{"fields":{"minutes":20},"reason":"end of shift clean","wait":false}
```

Todos los campos del cuerpo son opcionales, y el cuerpo también. Los campos se comprueban contra los del script antes de que se ejecute nada: un valor fuera de rango, fuera de su paso, que no sea una de las opciones o que sea de un tipo incorrecto da un `400`, y nunca se mueve para que encaje. `202` con la ejecución en cuanto ha empezado; con `"wait":true`, `200` con la ejecución una vez terminada, con su traza incluida.

```json
{"run":{"id":77,"scriptId":"cip_cycle","status":"running","actor":"otto","source":"ui","fields":{"minutes":20},"startedAt":"2026-09-28T10:05:00Z","durationMs":0}}
```

`409` cuando está ocupado: ya se está ejecutando y su modo es `skip`, o se está ejecutando con otra en cola y su modo es `queue`. No se ejecutó nada, y en el historial queda una ejecución `skipped` que dice por qué:

```json
{"error":"script busy: script cip_cycle was not started: it is already running, and its mode is skip","run":{"id":78,"scriptId":"cip_cycle","status":"skipped","...":"..."}}
```

**`?dry_run=true`** pregunta qué haría una ejecución ahora y no hace nada de eso. Los campos se comprueban igual; luego cada paso se recorre contra la planta tal como está: cada escritura y llamada a un servicio se somete a las comprobaciones propias de la puerta, se evalúa una condición, se enlaza una variable. Una espera, un retardo y todo lo que no escribe en ningún equipo son `not_checked`. La primera escritura que se rechazaría la termina, como terminaría la ejecución, y `error` lo dice con las palabras de la puerta. `200` con el veredicto, rechazada o no:

```json
{"dry_run":true,"check":{"script_id":"cip_cycle","fields":{"minutes":20},"steps":[{"step":"1","type":"call_service","input":"switch.turn_on switch.cip_pump {}","verdict":"refused","detail":"cip/pump: this tag is not marked writable"}],"error":"step 1 (call_service): cip/pump: this tag is not marked writable"}}
```

El `verdict` de cada paso es `would_write`, `refused`, `ends_here` (una condición falsa ahora, o una parada), `not_checked` u `ok`. Un paso de un script al que llama se numera bajo la llamada: `3.1`.

### `POST /api/scripts/{id}/stop`

Cancela todas sus ejecuciones en curso, en todos los procesos, estén donde estén. `{"cancelled":1,"stopped":"cip_cycle"}`, donde `cancelled` son las ejecuciones que tenía este proceso. Los operadores tienen `scripts.run`: detener lo que pueden iniciar forma parte de iniciarlo.

### `GET /api/scripts/{id}/runs`

Sus ejecuciones, de la más reciente a la más antigua, con sus trazas. `?limit=` (50 por defecto, como máximo 1000). `parent` es lo que llamó a una ejecución, cuando algo lo hizo: `automation_run:812`, `script_run:77`.

```json
[{"id":77,"scriptId":"cip_cycle","status":"succeeded","actor":"automation:shift-end","source":"automation","parent":"automation_run:812","fields":{"minutes":20},"startedAt":"2026-09-28T10:05:00Z","finishedAt":"2026-09-28T10:25:00Z","durationMs":1200012,"steps":[{"index":1,"type":"call_service","input":"switch.turn_on switch.cip_pump {}","output":"true to cip/pump: written; call 8fb9538c82d532be","startedAt":"2026-09-28T10:05:00Z","durationMs":9.6}]}]
```

## Recetas

Conjuntos de valores que se aplican juntos: los puntos de consigna de un grado de producto, un cambio de formato. Cada uno es también una entidad, `scene.<id>`. Una receta se comprueba entera antes de que salga nada y se rechaza entera por cualquier motivo; sus objetivos salen después en orden bajo un mismo id de llamada, el primero que falla detiene al resto y nada se deshace; cada valor escrito se vuelve a leer del dispositivo. Todo está en [Recetas](/es/iot/recipes/).

El nombre, la descripción, el nodo de equipo y el permiso de una receta cambian en el sitio. Lo que escribe (`targets`, `params`, `precondition`, `verify_sec`) es una versión, y las versiones nunca se modifican: guardar contenido nuevo almacena la siguiente.

### `GET /api/recipes`

Todas las recetas, con el contenido de su versión actual y su aplicación más reciente:

```json
[{"id":"grade_a","name":"Grade A","equipment_id":7,"apply_permission":"recipes.apply","current_version":3,"params":[{"name":"speed","type":"number","min":0,"max":400,"step":10,"unit":"rpm","required":true}],"precondition":"states['input_boolean.line_ready'] == 'on'","targets":[{"entity_id":"number.line_02_zone1_sp","service":"set_value","data":{"value":210}},{"entity_id":"number.line_02_speed","service":"set_value","data_expressions":{"value":"vars.speed"}}],"verify_sec":10,"note":"zone 1 up 5","created_at":"2026-09-28T10:00:00Z","updated_at":"2026-09-28T11:00:00Z","last_application":{"id":41,"recipe_id":"grade_a","version":3,"call_id":"7c1f0e2d9a8b6c54","actor":"otto","source":"ui","params":{"speed":250},"status":"applied","targets":[],"started_at":"2026-09-28T11:05:00Z","finished_at":"2026-09-28T11:05:01Z"}}]
```

`equipment_id` es `null` en una receta de toda la planta.

### `POST /api/recipes`

Crea una, como versión 1. Solo para administradores. `id` (letras minúsculas, dígitos y guiones bajos, empezando por una letra: es el id de objeto de la entidad, `scene.<id>`), `name`, `description`, `equipment_id`, `apply_permission` (`recipes.apply`, el predeterminado, o `recipes.apply.<name>`), `params` (entradas con tipo), `precondition` (una expresión que debe ser verdadera para empezar), `targets` (al menos uno, como máximo 200, cada uno con `entity_id`, `service` y `data` o `data_expressions`), `verify_sec` (de 1 a 600, 10 por defecto) y `note`. Un objetivo fija un valor: `set_value`, `select_option`, `set_position`, `set_speed`, `set_setpoint`, `set_mode`, `turn_on`, `turn_off`, en los dominios que los admiten. Un pulso o un arranque se rechaza: pertenece a un script. La entidad de cada objetivo debe existir, y cada expresión debe compilar. `201` con la receta; `400` para cualquier error, `409` para un id ya usado.

### `POST /api/recipes/capture`

Redacta una receta a partir de lo que las entidades tienen ahora, solo para administradores, y no guarda nada:

```json
{"entity_ids":["number.line_02_zone1_sp","switch.line_02_heater","loop.line_02_tic"]}
```

Cada una se convierte en un objetivo que la devuelve a su valor actual, en el orden indicado; un lazo se convierte en su modo y después su consigna. La respuesta es una receta sin id ni nombre, para el editor. Una entidad que no existe, está deshabilitada, se lee con una calidad distinta de buena, está `unknown` o `unavailable`, o no es algo que una receta fije, da un `400` que nombra cada una: una receta construida a partir de una mala lectura vuelve a escribir la mala lectura.

### `GET /api/recipes/{id}`

Una receta, como en la lista. `404` si no existe.

### `PUT /api/recipes/{id}`

La guarda. Solo para administradores. El cuerpo es la receta tal como la respondió `GET`, editada; su `id` puede omitirse. `current_version` es la versión sobre la que se hizo la edición: si alguien ha guardado otra desde entonces, el guardado da un `409` en lugar de sobrescribir en silencio la suya (`0` omite la comprobación). El contenido nuevo pasa a ser la versión siguiente, con `note` explicando por qué; un cambio solo del nombre, la descripción, el equipo o el permiso no crea ninguna.

### `DELETE /api/recipes/{id}`

La elimina junto con sus versiones. Solo para administradores. `{"deleted":"grade_a"}`. Sus aplicaciones se conservan, porque son lo que se envió a la planta, y su entidad queda huérfana.

### `GET /api/recipes/{id}/versions`

Todas las versiones, de la más reciente a la más antigua, cada una exactamente como se guardó, con quién la guardó y la nota:

```json
[{"recipe_id":"grade_a","version":3,"params":[],"targets":[{"entity_id":"number.line_02_zone1_sp","service":"set_value","data":{"value":210}}],"verify_sec":10,"note":"zone 1 up 5","created_by":"ada","created_at":"2026-09-28T11:00:00Z"}]
```

### `GET /api/recipes/{id}/versions/{version}`

Una versión. `404` si la receta no tiene esa versión, `400` si `{version}` no es un número.

### `POST /api/recipes/{id}/validate`

¿Se aplicaría ahora mismo? Los operadores tienen `recipes.apply`. El cuerpo es el de una aplicación, y no se escribe, registra ni anota nada. Se hace cada comprobación que una aplicación hace antes de escribir: los parámetros, el permiso propio de la receta, la precondición, las expresiones de datos, si otra aplicación está escribiendo en una de sus entidades, y cada objetivo sometido a las comprobaciones de la puerta de escritura. `200` con el veredicto, `would_apply` o `refused`, y el de cada objetivo: `would_write`, `refused` con el motivo, o `not_sent`.

```json
{"dry_run":true,"application":{"recipe_id":"grade_a","version":3,"params":{"speed":250},"status":"refused","targets":[{"index":1,"entity_id":"number.line_02_zone1_sp","service":"set_value","data":{"value":210},"status":"would_write"},{"index":2,"entity_id":"number.line_02_speed","service":"set_value","data":{"value":250},"status":"refused","error":"line-02/Speed: this tag is not marked writable"}],"started_at":"2026-09-28T11:04:00Z","error":"target 2 (set_value number.line_02_speed): line-02/Speed: this tag is not marked writable"}}
```

Los parámetros que no admite dan un `400`, como lo darían en la aplicación real.

### `POST /api/recipes/{id}/apply`

La aplica. Los operadores tienen `recipes.apply`. Una receta que nombra un permiso propio, `recipes.apply.<name>`, exige también ese, comprobado aquí contra la receta; un usuario que no lo tiene recibe un `403` y una aplicación rechazada en el historial con su nombre.

```json
{"params":{"speed":250},"reason":"grade A for the 2pm run","version":0,"resume":0}
```

Todo es opcional, y el cuerpo también. `version` aplica una versión anterior a propósito; si se omite, la actual. `resume` es el id de una aplicación anterior de esta receta que se detuvo a medias: sus objetivos que no se escribieron salen como una aplicación nueva, con su versión y sus parámetros, y `parent` dice cuál termina.

Responde cuando cada valor se ha escrito y vuelto a leer, lo que tarda como máximo el `verify_sec` de la receta:

```json
{"application":{"id":42,"recipe_id":"grade_a","version":3,"call_id":"9d2e4f6a8b0c1e3f","actor":"otto","source":"ui","reason":"grade A for the 2pm run","params":{"speed":250},"status":"applied","targets":[{"index":1,"entity_id":"number.line_02_zone1_sp","service":"set_value","data":{"value":210},"status":"written","writes":[{"tag":"line-02/Zone1_SP","value":"210","status":"written"}],"verification":"verified","verify_detail":"read back 210"},{"index":2,"entity_id":"number.line_02_speed","service":"set_value","data":{"value":250},"status":"written","writes":[{"tag":"line-02/Speed","value":"250","status":"written"}],"verification":"unconfirmed","verify_detail":"not confirmed within 10s: read back 240, not 250"}],"started_at":"2026-09-28T11:05:00Z","finished_at":"2026-09-28T11:05:10Z"}}
```

Un objetivo es `written`, `failed` (salió y el dispositivo dijo que no, o no dijo nada), `not_sent`, `skipped` (uno anterior no se completó) o `refused` (validación previa). Uno escrito es `verified` cuando el dispositivo devolvió, tras enviarlo, el valor que se le envió, y `unconfirmed` cuando no lo hizo en `verify_sec`: salió y puede que no haya surtido efecto. Cada escritura lleva el `call_id` de la aplicación, de modo que `GET /api/writes?call=<call_id>` las devuelve todas.

| Estado | Cuándo |
|---|---|
| 200 | `applied`: cada objetivo escrito. Compruebe la `verification` de cada uno |
| 400 | Un parámetro que la receta no admite, fuera de rango o de tipo incorrecto; un `resume` sin nada por aplicar |
| 403 | El permiso propio de la receta. Se registra como una aplicación rechazada |
| 404 | No existe esa receta, o no existe esa versión |
| 409 | `refused`: cualquier motivo para no empezar, todos en `error` y en su objetivo. O bien otra aplicación está escribiendo ahora en una de sus entidades. No se escribió nada |
| 502 | `partial` o `failed`: empezó, y no todos los objetivos salieron. `targets` dice exactamente cuáles. No se deshace nada |

Toda respuesta salvo un `400` por un cuerpo mal formado o un `404` lleva la aplicación, y toda aplicación salvo una prueba (dry run) está en `GET /api/recipes/{id}/applications`, incluidos los rechazos.

### `GET /api/recipes/{id}/applications`

Sus aplicaciones, de la más reciente a la más antigua, incluidas las rechazadas. `?limit=` (50 por defecto, como máximo 1000). `parent` es lo que la aplicó, cuando algo lo hizo: `automation_run:812`, `script_run:77`, `application:41`. Las aplicaciones de una receta eliminada se siguen respondiendo.

## Blueprints

Una automatización escrita una vez con huecos con tipo, que se rellenan para crear una regla corriente. La regla conserva la versión a partir de la cual se creó; editar el blueprint no cambia ninguna regla, y pasar una a una versión más reciente es [una actualización](#post-apiautomationsidblueprint-upgrade) que alguien pide. Cada escritura que hace la regla pasa por la puerta de escritura como `automation:<id>`. Todo está en [Blueprints](/es/iot/blueprints/).

### `GET /api/blueprints`

Todos los blueprints, primero los integrados, cada uno con cuántas reglas se crearon a partir de él:

```json
[{"id":"motor_running_too_long","name":"Motor running too long","description":"Says so when a motor has been running longer than it should...","source":"builtin","version":1,"inputs":[{"name":"motor","label":"Motor","type":"entity","required":true,"domain":["motor"]},{"name":"max_run","label":"Longest it may run","type":"duration","default":3600},{"name":"stop_it","label":"Stop it as well","type":"boolean","default":false}],"template":{"triggers":[{"type":"state","entityId":{"!input":"motor"},"to":"running","forSec":{"!input":"max_run"}}],"...":"..."},"instances":2}]
```

`source` es `builtin` (viene en el binario, solo lectura) o `user`.

### `POST /api/blueprints`

Escribe uno. Solo para administradores. `id` (letras minúsculas, dígitos y guiones bajos, empezando por una letra), `name`, `description`, `inputs` (con tipo, igual que los campos de un script) y `template`: la regla, con su `description`, `triggers`, `condition`, `actions`, `mode`, `minIntervalSec` y `maxRuntimeSec`, y los huecos que contiene. `{"!input": "motor"}` como valor se sustituye por la entrada; `${motor}` en una cadena también, como literal cuando la cadena es una expresión. Se comprueba antes de guardarse: cada hueco nombra una entrada, cada entrada se usa, y rellenado con valores de muestra produce una regla que compila. `201` con `version` 1. `400` para cualquier error, `409` para un id ya usado, incluido el de uno integrado.

### `GET /api/blueprints/{id}`

Uno, como en la lista. `404` si no existe.

### `PUT /api/blueprints/{id}`

Reemplaza su definición; el cuerpo es el mismo que para escribir uno, y su `id` puede omitirse. Solo para administradores. `version` sube en uno cuando cambian `inputs` o `template`, y no por un nombre o una descripción nuevos. **Ninguna regla creada a partir de él cambia.** Cada una conserva la versión a partir de la cual se creó, y `GET /api/automations` muestra cuál. Uno integrado da un `400`: cópielo con un id propio.

### `DELETE /api/blueprints/{id}`

Solo para administradores. `{"deleted":"pump_watch"}`. `409` mientras exista alguna regla creada a partir de él, nombrándolas: elimínelas primero. Uno integrado da un `400`.

### `POST /api/blueprints/{id}/instantiate`

Crea una regla a partir de él y la arma. Los operadores tienen `blueprints.apply`: qué bomba y cuánto tiempo les corresponde elegirlo a ellos, y lo que hace la regla se decidió cuando se escribió el blueprint.

```json
{"automationId":"infeed_too_long","name":"Infeed pump ran too long","enabled":true,"inputs":{"motor":"motor.infeed_pump","max_run":"90m","stop_it":true}}
```

`name` toma por defecto el del blueprint y `enabled` el valor `true`. Cada entrada se comprueba antes de crear nada: un valor fuera de rango, fuera de su paso, que no sea una de sus opciones, una entidad de otro dominio o de tipo incorrecto da un `400` que nombra cada una de las erróneas, y nunca se mueve para que encaje. Un `automationId` ya usado da un `409`: crear una regla nunca reemplaza otra. `201` con la regla, con `blueprintId`, `blueprintVersion` y `blueprintInputs` establecidos. Se registra como `automation made from blueprint motor_running_too_long version 1`.

**`?dry_run=true`** no crea nada. Responde la regla que crearía y lo que esa regla haría si se disparara ahora: la condición evaluada, cada escritura y llamada a un servicio sometida a las comprobaciones de la puerta como `automation:<id>`, y el primer rechazo en `check.error` con las palabras de la puerta. No se almacena, escribe ni audita nada.

```json
{"dry_run":true,"automation":{"id":"infeed_too_long","...":"..."},"check":{"automation_id":"infeed_too_long","steps":[{"step":"1","type":"log_event","verdict":"not_checked"},{"step":"2","type":"condition","input":"true","verdict":"ok","detail":"true now"},{"step":"3","type":"call_service","input":"motor.stop motor.infeed_pump {}","verdict":"would_write","detail":"would write false to line-02/M1_Run"}]}}
```

## Paneles

Páginas de tarjetas, para los roles y las pantallas que las necesitan. Un panel no ordena nada: una tarjeta nombra un tag, una entidad, un script o una receta, y su botón escribe a través de [`POST /api/write`](#post-apiwrite) como la persona que lo pulsó. El tablero mural es uno de ellos. Todo está en [Paneles](/es/iot/dashboards/).

### `GET /api/dashboards`

Los paneles que se le ofrecen a quien llama, en el orden en que los muestra el selector, incluido el tablero mural. Quien tiene `dashboards.write` ve todos.

```json
[{"id":"wall","name":"Wall board","description":"The tags pinned on the Board screen, as gauges.","kind":"wall","roles":[],"homeFor":[],"screens":["wall-tv"],"position":0,"cards":[],"version":2,"updatedBy":"ada"},
 {"id":"line-2","name":"Line 2","kind":"cards","roles":["operator","admin"],"homeFor":["operator"],"screens":["line-2-panel"],"position":1,"version":3,"updatedBy":"ada","cards":[{"id":"temp","type":"gauge","title":"Zone 1","w":3,"h":3,"config":{"tag":"press-01/Zone1_Temp"}}]}]
```

### `POST /api/dashboards`

Crea uno. Solo para administradores. `id` (letras minúsculas, dígitos, guiones y guiones bajos, empezando por una letra), `name`, y opcionalmente `description`, `roles`, `homeFor`, `screens`, `position` y `cards`. `201` con `version` 1, con el tamaño y la configuración de cada tarjeta tal como se guardaron.

Una tarjeta es `id`, `type`, `title`, `w` (de 1 a 12 columnas), `h` (de 1 a 8 filas) y un `config`. Los tipos y sus configuraciones están en [Paneles](/es/iot/dashboards/#las-tarjetas). Se comprueba antes de guardarse:

- una clave de configuración que el tipo no tiene, un número fuera de rango, una dirección de cámara o de plano con un usuario o un token, o más de 60 tarjetas da un `400`;
- una tarjeta que nombra un tag, una entidad, un script o una receta que no existe da un `400` que lo nombra;
- un `button` sobre un tag que no es escribible, o con un número fuera del rango del tag, da un `400`: la puerta rechazaría cada pulsación;
- un rol que no existe da un `400`;
- un `id` ya usado, una pantalla que otro panel ya tiene, o una página de inicio de un rol que ya es de otro panel, da un `409`.

### `GET /api/dashboards/{id}`

Uno, como en la lista. `404` si no existe, y también si a quien llama no se le ofrece.

### `PUT /api/dashboards/{id}`

Lo reemplaza. Solo para administradores. El cuerpo es el panel tal como lo respondió `GET`, con `version` fijada en la versión en que se leyó: **es obligatoria**, y un guardado que nombra una versión que ya no es la actual da un `409` que dice cuál es la actual, porque la alternativa es borrar en silencio lo que acaba de construir la última persona que guardó. El `id` puede omitirse del cuerpo, `kind` no puede cambiar, y `createdAt`, `updatedAt` y `updatedBy` son del servidor y se ignoran. `200` con el panel en la versión siguiente.

El tablero mural admite un `PUT` solo para sus asignaciones (`roles`, `homeFor`, `screens`, `position`) y nada más: no tiene tarjetas, así que uno con tarjetas da un `400`. Sus indicadores son los tags del tablero, `GET` y `PUT /api/board`.

### `DELETE /api/dashboards/{id}`

Solo para administradores. `{"deleted":"line-2"}`. Las tarjetas apuntan a cosas y no son dueñas de nada, así que no se toca nada más. El tablero mural da un `400`: siempre está ahí.

Crear, guardar y eliminar se registran como eventos `config` sobre el sujeto `dashboard:<id>`.

### `GET /api/dashboards/{id}/export`

El panel como archivo de pantalla: un documento JSON con versión que [`POST /api/dashboards/import`](#post-apidashboardsimport) carga en otra instalación. Responde como un adjunto llamado `<id>.hotloop-screen.json`. Quien llama necesita `dashboards.read` y que se le ofrezca el panel, como para `GET` de uno. El tablero mural da un `400`: son los indicadores fijados de una instalación, no una disposición. El formato está en [Archivos de pantalla](/es/iot/screen-file/).

### `POST /api/dashboards/import`

Lee un archivo de pantalla, lo comprueba contra esta instalación y lo guarda como un panel nuevo. Solo para administradores, y no puede guardar lo que `POST /api/dashboards` rechazaría. El cuerpo es el propio archivo, o `{"file": {...}}` con opciones al lado:

| Opción | <span class="sr-only">Detalles</span> |
|---|---|
| `id`, `name` | Guardarlo con otro id o nombre. |
| `replace` | Si el id está en uso, guardar sobre ese panel en su versión actual. Sin ella, un id en uso da un `409`. |
| `skipAssignments` | Omite los `screens` y `homeFor` del archivo, que pertenecen a la instalación que lo creó. Los `roles` se quedan. |
| `remap` | Cómo llamar a las cosas aquí: `tags` (clave completa a clave completa, tal como el archivo nombra el tag o como se lee una vez que `devices` lo ha movido), `devices` (id a id, lo que también mueve la parte de dispositivo de cada tag no nombrado en `tags`), `entities`, `scripts`, `recipes` y `equipment` (id a id). Una entrada que nada en la pantalla usó es una advertencia. |
| `dryRun` | Responder el informe y no guardar nada. Siempre `200`. |
| `codesys`, `visualization` | En lugar de `file`: el texto de una exportación nativa de CODESYS, y la visualización que tomar cuando contiene varias. El informe incluye entonces un `conversion` con lo que se convirtió cada elemento y lo que se dejó fuera. Véase [Importar una pantalla de CODESYS](/es/iot/codesys-screen-import/). |

La respuesta es un informe, se haya guardado algo o no:

```json
{"ok":false,"dryRun":true,"id":"line-2","name":"Line 2","cards":6,"replaces":false,
 "problems":[{"kind":"tag","ref":"press-01/Zone1_Temp","message":"tag press-01/Zone1_Temp does not exist here; map it to one that does, or add it on the Tags screen first"}],
 "warnings":[],"remapped":[],
 "requires":{"tags":[{"key":"press-01/Zone1_Temp","writable":false}],"entities":[],"scripts":[],"recipes":[],"devices":[],"equipment":[]}}
```

Se lista cada referencia que falta, no solo la primera. Un `kind` es `file` (no es un archivo de pantalla, el formato equivocado, una versión de formato más nueva de la que lee esta compilación, o un campo que no conoce), `screen` (las reglas propias del panel: una tarjeta incorrecta, un rol que no existe, demasiado grande), `tag`, `entity`, `script`, `recipe`, `device`, `equipment`, `writable` (un botón o consigna sobre un tag que no es escribible), `assignment` (un nombre de pantalla o una página de inicio de rol que tiene otro panel) o `exists` (el id está en uso). Una importación con cualquier problema no guarda nada: `400`, o `409` cuando el único problema es `exists` o `assignment`, con el mismo informe. El éxito es `201`, o `200` cuando reemplazó uno, con el informe y el `dashboard` guardado. Se registra como un evento `config` sobre el sujeto `dashboard:<id>`.

## Webhooks

### `POST /api/webhook/{path}`

Dispara cada automatización con un disparador `webhook` en esa ruta. **Sin sesión y sin permiso**: la ruta es el secreto que se le da a un tercero, el mismo modelo de confianza que este endpoint ha tenido siempre, y un sistema SCADA o un callback de un SaaS no tiene cuenta con la que iniciar sesión. Elija una ruta que nadie pueda adivinar.

El cuerpo, de hasta 1 MiB, se entrega a la regla. `202` `{"accepted":"fill-now"}`. `404` `"no automation is listening on this webhook path"` cuando no hay ninguna: un webhook que publica en el vacío se ve idéntico a uno que funciona, así que lo dice.

## Flota

Relés de borde registrados, su presencia en vivo sobre Sparkplug y los comandos hacia ellos. Necesita `HOTLOOP_FLEET_ENABLED`. Véase [Gestión de flota](/es/gateway/fleet/).

### `GET /api/fleet`

```json
{"configured":true,"members":[{"id":"press-relay-01","name":"Press line relay","group":"plant-a","nodeId":"press-relay-01","statusUrl":"http://press-relay-01:8081","enabled":true,"createdAt":"2026-09-27T20:28:49.448323Z","updatedAt":"2026-09-27T20:28:49.448323Z","online":false,"polled":true,"error":"Get \"http://press-relay-01:8081/status\": dial tcp: lookup press-relay-01 on 10.89.0.1:53: no such host"}]}
```

`online` procede de NBIRTH y NDEATH. `release` es la compilación que el relé dijo ejecutar en su último birth: `version`, `imageDigest` (cuando lo indica su supervisor; el chart de Helm no) y `since`, cuando el Gateway oyó por primera vez esa compilación. Un relé demasiado antiguo para informar de una no tiene ninguna. Para un miembro con `statusUrl`, `polled` es verdadero y `reachable`, `forwardQueueLen`, `devices`, `connected`, `config` y `updateMode` (`auto` o `approve`) vienen de su `/status`; no significan nada cuando no era alcanzable. Con la función desactivada: `{"members":[],"configured":false}`.

### `POST /api/fleet`

Crea o reemplaza un miembro: `id`, `name`, `group` y `nodeId` (su identidad Sparkplug) obligatorios; `description`, `statusUrl` (`http://` o `https://`) y `enabled` opcionales. Responde el miembro. Este funciona con la función desactivada, de modo que la flota puede declararse antes de activarla.

### `DELETE /api/fleet/{id}`

`{"deleted":"press-relay-01"}`, o `404`.

### `POST /api/fleet/{id}/rebirth`

Publica un `Node Control/Rebirth` al relé. Sin cuerpo. `{"status":"rebirth requested"}`. `404` para un miembro desconocido.

### `POST /api/fleet/{id}/restart`

Publica `Node Control/Reboot`. `{"status":"restart requested"}`. Solo para administradores: reiniciar un relé pierde sus datos hasta que vuelve.

### `POST /api/fleet/{id}/update`

Aprueba la actualización de imagen que un relé tiene retenida. Publica `Node Control/Update`. `{"status":"update approved"}`. Solo para administradores: el relé sale y su supervisor arranca la imagen que siga, de modo que pierde sus datos durante el tiempo que eso tarda. Solo hace algo en un relé configurado con `HOTLOOP_EDGE_RELAY_UPDATE_MODE=approve`; cualquier otro relé registra que lo ignoró. La solicitud no nombra ninguna imagen: no hay dónde ponerla, y ese es el objetivo. Véase la [referencia de Edge Relay](/es/edge-relay/reference/#actualizar-un-relay).

### `POST /api/fleet/{id}/config`

Envía un nuevo archivo de dispositivos al relé, que lo aplica en vivo: sin reinicio, conservando su sesión con el broker y su cola de reenvío, y dejando conectado cada dispositivo que el archivo no cambió. El cuerpo es **el propio archivo de dispositivos**, JSON sin procesar, sin envolver en nada. Se valida antes de publicar nada (`400` `"invalid device file: ..."` si no es válido). `{"status":"config pushed"}` significa que el broker lo aceptó; si el relé lo está ejecutando lo dice `config.digest` en ese miembro en `GET /api/fleet`, y un archivo que el relé rechazó aparece allí como `config.rejected`. Solo para administradores: cambia lo que consulta el relé. Véase [Gestión de flota](/es/gateway/fleet/#envío-de-configuración).

### `DELETE /api/fleet/{id}/config`

Retira el envío. Borra la configuración retenida en el broker para que ningún arranque posterior la aplique, y un relé conectado ahora mismo abandona su archivo enviado y vuelve en vivo a su archivo de dispositivos local. Sin cuerpo. `{"status":"config push cleared"}`, `404` para un miembro desconocido, `503` cuando el Gateway no está conectado al broker. Solo para administradores, como enviarlo. No reinicia nada. Envíelo mientras el relé está en línea: un relé desconectado nunca lo oye. Véase la [referencia de Edge Relay](/es/edge-relay/reference/#dónde-vive-un-archivo-enviado-y-qué-archivo-gana).

## Notificaciones

Avisar a un teléfono cuando se activa una alarma, por webhook, SMTP, ntfy o Gotify, y avisar a la siguiente persona cuando nadie la reconoce. Necesita `HOTLOOP_NOTIFY_ENABLED`.

### `POST /api/notify/test`

Envía ahora una notificación de alarma sintética por cada canal configurado, para que descubra que el relé SMTP le rechaza antes de que lo haga una alarma real. Sin cuerpo. Necesita `HOTLOOP_NOTIFY_ENABLED`. Solo para administradores: envía un mensaje real y gasta la cuota que permita el proveedor.

```json
{"results":[{"channel":"smtp","success":true}]}
```

`200` funcione o no cada canal; cada resultado lo dice. Uno que falló lleva `error`. Un webhook fallido nombra su esquema y su host y nada más, porque para la mayoría de los servicios de aviso la URL es la credencial. Véase [Notificaciones de alarmas](/es/iot/notifications/).

### `GET /api/notify/escalation`

La política de escalada de alarmas, los canales que un paso puede nombrar y las cadenas abiertas ahora mismo. `available` es `false`, con una política desactivada y sin canales, cuando `HOTLOOP_NOTIFY_ENABLED` no está definido; la respuesta sigue siendo `200`. Solo para administradores tanto para leer como para escribir: la política contiene los temas de ntfy de las personas, que en un servidor al que cualquiera llega son contraseñas.

```json
{"available":true,"policy":{"enabled":true,"minPriority":"high","contacts":[{"name":"Ana","ntfyTopic":"ana-phone-3f9c","emails":["ana@plant.test"]}],"steps":[{"afterMinutes":5,"contacts":["Ana"]},{"afterMinutes":10,"channels":["gotify"]}],"repeatEveryMinutes":15,"repeatTimes":2},"channels":["smtp","ntfy","gotify"],"active":[{"alarmId":"boiler-hi","name":"Boiler Trip","raisedAt":"2026-10-21T03:00:00Z","sent":1,"total":4,"nextAt":"2026-10-21T03:15:00Z"}],"limits":{"steps":10,"contacts":50,"repeats":20,"minutes":1440}}
```

`channels` son los que este HotLoop tiene configurados, que es todo lo que un paso puede nombrar. `active` es cada alarma que se está recorriendo por la cadena: cuántos envíos han salido de cuántos tiene la política (pasos, luego repeticiones), y cuándo toca el siguiente. Si no hay nada guardado todavía es `{"policy":{"enabled":false},...}`: desactivada, sin nada dentro.

### `PUT /api/notify/escalation`

Reemplaza la política entera, no es un parche, y responde lo que respondería `GET`. Se aplica a las alarmas que se activen a partir de ahora. `400` cuando las notificaciones no están habilitadas.

```json
{"enabled":true,"minPriority":"high",
 "contacts":[{"name":"Ana","ntfyTopic":"ana-phone-3f9c","emails":["ana@plant.test"]}],
 "steps":[{"afterMinutes":5,"contacts":["Ana"]},{"afterMinutes":10,"channels":["gotify"]}],
 "repeatEveryMinutes":15,"repeatTimes":2}
```

`minPriority` es `critical`, `high` (el predeterminado), `medium` o `low`. Un paso vence `afterMinutes` (de 1 a 1440) después del anterior, el primero tras la activación, y nombra `contacts` de la lista, `channels` que tenga el despliegue, o ambos. Como máximo 10 pasos, 50 contactos y 20 repeticiones. Los campos desconocidos se rechazan.

`400` con el motivo cuando la política no puede funcionar, con palabras que se pueden aplicar: un paso que no nombra a nadie, un contacto que no está en la lista, un canal que este HotLoop no ha configurado (la respuesta lista los que tiene), un tema de ntfy sin ntfy configurado o una dirección sin correo configurado, una dirección que no es sencilla, una repetición sin intervalo. No se guarda nada cuando se rechaza. Guardarla queda en el registro del sistema, sin los temas. Véase [Notificaciones de alarmas](/es/iot/notifications/#escalado).

### `POST /api/notify/ack/{token}`

El botón **Reconocer** de una notificación de ntfy. El teléfono que lo pulsa no tiene sesión que enviar, así que **no hay sesión ni permiso**: el token firmado de la ruta es la autorización, y lo único que autoriza es reconocer una aparición de una alarma, una vez, antes de que caduque (`HOTLOOP_NOTIFY_ACK_TTL`, 12 horas por defecto). Un botón del viaje de ayer no puede reconocer la de hoy. Es un `POST` a propósito: los previsualizadores de enlaces y los escáneres de seguridad abren enlaces por su cuenta, y una alarma nunca debe ser reconocida por un robot. Sin cuerpo. Responde con la alarma reconocida (la forma, tomada del manejador; los demás ejemplos de este documento se capturaron de un Gateway en ejecución, este no, porque ese Gateway no tenía ntfy):

```json
{"acknowledged":true,"alarmId":"extruder-temp-hi","name":"Extruder temperature high","state":"ack-active","ackedBy":"notify:ntfy"}
```

Con los enlaces de reconocimiento desactivados:

```json
{"error":"acknowledge links are not enabled on this HotLoop (they need HOTLOOP_PUBLIC_URL and a channel that carries a button)"}
```

Es un reconocimiento corriente a través del motor de alarmas, auditado bajo `notify:<channel>`. Cada rechazo se responde y se registra, porque un botón que no hace nada en silencio se ve exactamente igual que uno que nadie pulsó:

| Estado | Cuándo |
|---|---|
| 403 | Falsificado, alterado o firmado con otro secreto |
| 404 | La alarma ya no existe, o los enlaces de reconocimiento están desactivados (necesitan `HOTLOOP_PUBLIC_URL` y un canal con botón) |
| 409 | Ya usado, la alarma se volvió a activar desde entonces, o ya no queda nada por reconocer |
| 410 | Auténtico, pero caducado |
| 503 | No se pudo guardar el reconocimiento; el enlace se devuelve para que una segunda pulsación aún pueda funcionar |

La respuesta lleva `Access-Control-Allow-Origin: *` para que la aplicación web de ntfy pueda pulsarlo desde su propio origen; nada en esta ruta lee una cookie. El token nunca se registra ni se devuelve en ningún sitio. Véase [Notificaciones de alarmas](/es/iot/notifications/#enlaces-de-reconocimiento).

## Copias de seguridad

Instantáneas lógicas de la base de datos, solo con los datos de las tablas. Necesita `HOTLOOP_BACKUP_ENABLED`. Ambas solo para administradores: un listado muestra el número de filas de cada tabla, usuarios y sesiones incluidos. **No hay endpoint de restauración**, a propósito: restaurar es una opción del binario, que ejecuta una sola vez alguien que sabe que la base de datos está pensada para recibirla, nunca una llamada de red contra una en vivo. Véase [Copias de seguridad y restauración](/es/iot/backup/#restaurar-una-copia).

### `GET /api/backup`

Las copias de seguridad del volumen, cada una con su manifiesto.

```json
{"backups":[{"name":"20260927T202912Z","bytes":98567,"manifest":{"hotloopVersion":"4.16.0","schemaMigrations":["0001_core.sql","...","0007_service_audit.sql"],"createdAt":"2026-09-27T20:29:12.970721945Z","tables":[{"name":"devices","rows":2,"columns":[{"name":"id","type":"text"},{"name":"...","type":"..."}]}]}}],"configured":true}
```

### `POST /api/backup`

Hace una ahora y espera a que termine (hasta 30 minutos: un `tag_history` grande tarda un rato). Sin cuerpo. Responde el manifiesto: versión, migraciones, y las filas y columnas de cada tabla.

## Informes programados

Resúmenes del historiador en CSV y HTML, según un calendario, por correo o descarga. Necesita `HOTLOOP_REPORTS_ENABLED`. Los visores leen, los operadores ejecutan, los administradores definen: una definición nombra a dónde se envían por correo los datos de la planta. Véase [Informes programados](/es/gateway/reports/) para los campos de la definición.

### `GET /api/reports`

```json
{"configured":true,"reports":[{"id":"line1-hourly","name":"Line 1 hourly","enabled":true,"tags":[{"deviceId":"extruder-1","tagName":"Temperature"},{"deviceId":"extruder-1","tagName":"Pressure"}],"window":{"count":1,"unit":"hours","end":"run_time"},"bucket":"window","aggregations":["min","max","avg"],"schedule":{"kind":"daily","at":"06:00"},"format":"both","recipients":["shift-lead@example.com"],"retain":10,"createdAt":"2026-09-27T20:29:23.300978Z","updatedAt":"2026-09-27T20:29:23.300978Z","nextRunAt":"2026-09-28T06:00:00Z"}],"smtpConfigured":true,"timezone":"UTC"}
```

Cada definición lleva `nextRunAt` y su ejecución más reciente como `lastRun`.

### `POST /api/reports`

Crea una definición; el cuerpo es la definición anterior. `201`. `400` si falla la validación (`"report line1-hourly: window end \"now\" must be run_time or local_midnight"`), `409` si el id existe.

### `GET /api/reports/{id}`

Una definición, como en la lista. `404` para una desconocida.

### `PUT /api/reports/{id}`

Reemplaza la definición entera. El id no puede cambiar (`400` si el del cuerpo difiere). `nextRunAt` y `lastRun` se aceptan y se ignoran, así que puede devolver lo que leyó.

### `DELETE /api/reports/{id}`

La elimina con sus ejecuciones y archivos, cancelando una ejecución en curso. `{"deleted":"line1-hourly"}`, o `404`.

### `POST /api/reports/{id}/run`

La ejecuta ahora y espera. `?deliver=false` la genera y la guarda sin enviar correo a nadie, para probar una definición. `200` significa que la ejecución ocurrió; su propio `status` dice si el informe funcionó. Una ejecución que falla es un resultado, no una mala solicitud, y se registra en ambos casos.

```json
{"id":1,"reportId":"line1-hourly","trigger":"manual","actor":"admin","status":"succeeded","startedAt":"2026-09-27T20:29:54.06926Z","finishedAt":"2026-09-27T20:29:54.092456655Z","windowStart":"2026-09-27T19:29:54.06926Z","windowEnd":"2026-09-27T20:29:54.06926Z","tags":2,"rows":2,"readings":984,"excluded":2,"files":[{"format":"csv","name":"20260927T202954Z-1.csv","bytes":338},{"format":"html","name":"20260927T202954Z-1.html","bytes":2430}],"emailStatus":"skipped","emailTo":["shift-lead@example.com"]}
```

`400` para un `deliver` que no sea true o false, `404` para un informe desconocido.

### `GET /api/reports/{id}/runs`

`{"runs": [...]}`, de la más reciente a la más antigua, `?limit=` 50 por defecto, como máximo 500. `404` para un informe desconocido, no una lista vacía.

### `GET /api/reports/{id}/runs/{run}/download`

Transmite un archivo almacenado como adjunto. `?format=csv` o `html`.

```
HTTP/1.1 200 OK
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="20260927T202954Z-1.csv"
Cache-Control: private, no-store

device_id,tag_name,unit,period_start,period_end,min,max,avg,excluded
extruder-1,Temperature,C,2026-09-27T19:29:54+00:00,2026-09-27T20:29:54+00:00,19.50001230192043,23.499980145373126,21.508905654397623,1
```

El HTML se sirve con una Content-Security-Policy `sandbox`: un informe es un documento para leer, no una página a la que se le permita ejecutar nada. El archivo que se abre es el que nombra el registro de la ejecución; nada de la URL pasa a formar parte de una ruta. `400` para un número de ejecución que no lo es o un formato que no es ninguno de los dos, `404` para una ejecución o un archivo que no existe.

## Sitios

### `GET /api/sites`

Cada sitio que el Gateway federa, al que se le pide su estado de planta por MCP en paralelo, 6 segundos cada uno, para que un sitio caído no retenga a los demás. Los sitios son los servidores MCP salientes de la configuración. Véase [MCP](/es/iot/mcp/#federar-sitios).

```json
{"configured":true,
 "rollup":{"sites":2,"reachable":1,"devices":2,"connected":2,"tags":5,"outstandingAlarms":1,"unacknowledgedAlarms":1,"criticalAlarms":0},
 "sites":[{"name":"plant-a","reachable":true,"latencyMs":14,"plant":"Demo Plant","uptime":"1m25s","devices":2,"connected":2,"degraded":0,"disconnected":0,"tags":5,"outstandingAlarms":1,"unacknowledgedAlarms":1,"criticalAlarms":0,"writesEnabled":true},
          {"name":"plant-c","reachable":false,"error":"connect to MCP server \"plant-c\": calling \"initialize\": ... no such host","latencyMs":49,"devices":0,"connected":0,"degraded":0,"disconnected":0,"tags":0,"outstandingAlarms":0,"unacknowledgedAlarms":0,"criticalAlarms":0,"writesEnabled":false}]}
```

Los recuentos de un sitio inalcanzable no significan nada y se dejan fuera del total: contar como cero alarmas un sitio al que no se llega sería lo más peligroso que esta pantalla podría hacer. Sin sitios configurados: `{"configured":false,"sites":[]}`.

## Ajustes

### `GET /api/settings`

Cada ajuste, su valor efectivo, de dónde vino el valor y la variable que lo establece:

```json
{"groups":["Plant","Safety","Polling","Historian","Database","MCP","Server"],
 "settings":[{"key":"ui.plantName","group":"Plant","label":"Plant name","help":"...","value":"Demo Plant East","kind":"string","source":"stored","envVar":"HOTLOOP_PLANT_NAME","editable":true},
             {"key":"safety.allowWrites","group":"Safety","label":"Writes allowed","help":"...","value":true,"kind":"bool","source":"environment","envVar":"HOTLOOP_ALLOW_WRITES","editable":false},
             {"key":"database.password","group":"Database","label":"Password","help":"Never shown. It comes from the release Secret.","value":"set","kind":"secret","source":"environment","envVar":"HOTLOOP_DB_PASSWORD","editable":false}]}
```

`source` es `stored`, `environment` o `default`. Un `secret` solo es `set` o `not set`. `envVar` es la variable de la que vino el valor. Algunos ajustes recurren a una segunda variable cuando la `HOTLOOP_` está vacía (`TZ` para la zona horaria, `POSTGRES_HOST`, `POSTGRES_DB`, `POSTGRES_USER` y `POSTGRES_PASSWORD` para la base de datos), y cuando lo que está en vigor es la alternativa, `envVar` la nombra. Una variable definida como cadena vacía cuenta como no definida, igual que lo trata la configuración. Los ajustes de sondeo se muestran en milisegundos, pero sus variables aceptan una duración (`5s`, `500ms`) o un número simple de segundos.

`product` en el grupo `Server` dice de qué HotLoop se trata. Una función que este producto no tiene y que el despliegue activó de todos modos (por ejemplo `HOTLOOP_REPORTS_ENABLED=true` en IoT) no impide que arranque. Se registra como advertencia al arrancar y se lista aquí en un grupo adicional, `Not in this product`, con su variable y una línea que dice dónde vive. El ajuste se deja exactamente como está, de modo que la misma configuración en un producto que tiene la función la activa. Si no hay nada así definido, el grupo no aparece.

### `PUT /api/settings`

Cambia los ajustes de identidad de la planta, y solo esos:

| Clave | Tipo |
|---|---|
| `ui.plantName` | cadena, de hasta 200 caracteres |
| `ui.siteId` | cadena, de hasta 200 caracteres |
| `ui.timezone` | un nombre IANA que esta máquina conozca (`America/Chicago`) |
| `ui.confirmWrites` | bool |
| `ui.kioskIdleSeconds` | un número entero de segundos, de 10 a 43200: cuánto sobrevive el inicio de sesión de un quiosco sin que nadie toque el panel. Por defecto 900 |
| `ui.lockoutAttempts` | un número entero, de 0 a 100: contraseñas o PIN erróneos seguidos que bloquean una cuenta. Por defecto 10, y 0 es sin bloqueo |
| `ui.panelDelaySeconds` | un número entero de segundos, de 0 a 30: lo máximo que espera un panel de quiosco antes de comprobar el siguiente PIN escrito sin nombre de usuario, tras unos erróneos. Por defecto 3, y 0 es sin espera |
| `ui.lockoutSeconds` | un número entero de segundos, de 10 a 86400: cuánto tiempo sigue bloqueada una cuenta bloqueada. Por defecto 300 |

```json
{"ui.plantName":"Demo Plant East","ui.timezone":"America/Chicago"}
```

Responde los ajustes completos, como hace `GET`. Cualquier otra clave da un 400 que la nombra:

```json
{"error":"safety.allowWrites is set by the deployment and cannot be changed here"}
```

Es deliberado. Los interruptores de escritura deciden si este proceso puede mover maquinaria, y un control que se puede activar desde el mismo navegador que emite las escrituras no es un control. Cambiarlos es un despliegue.

## Destinos del historiador

Las bases de datos propias de la planta, en las que HotLoop escribe su historial además de en la suya. Véase [Destinos del historiador](/es/iot/historian-targets/). Todo rol que lee los ajustes los ve y ve cómo le va a cada uno. Cambiar uno es solo para administradores, porque un destino es un lugar al que van los datos de la planta. Las contraseñas se sellan con la clave de credenciales de dispositivo (`HOTLOOP_SECRET_KEY_FILE`) y nunca se devuelven; `passwordSet` dice si hay una almacenada, y `passwordProblem` por qué no se puede abrir una almacenada. Cada cambio queda en el registro y surte efecto de inmediato.

### `GET /api/historian/targets`

```json
{"secretKey":true,
 "kinds":[{"id":"postgres","title":"PostgreSQL or TimescaleDB","defaultPort":5432,"defaultTable":"hotloop_history",
    "databaseLabel":"Database","tableLabel":"Table","passwordLabel":"Password","usesUsername":true,"usesOrg":false},
   {"id":"sqlserver","title":"Microsoft SQL Server","defaultPort":1433,"defaultTable":"hotloop_history",
    "databaseLabel":"Database","tableLabel":"Table","passwordLabel":"Password","usesUsername":true,"usesOrg":false},
   {"id":"mysql","title":"MySQL or MariaDB","defaultPort":3306,"defaultTable":"hotloop_history",
    "databaseLabel":"Database","tableLabel":"Table","passwordLabel":"Password","usesUsername":true,"usesOrg":false},
   {"id":"influxdb","title":"InfluxDB 2 or 3","defaultPort":8086,"defaultTable":"hotloop_history",
    "databaseLabel":"Bucket (InfluxDB 3: database)","tableLabel":"Measurement","passwordLabel":"API token",
    "usesUsername":false,"usesOrg":true}],
 "targets":[{"id":"plant-pg","name":"Plant historian","kind":"postgres","address":"db.plant.local:5432",
   "database":"plant","username":"hotloop","table":"hotloop_history","useTls":true,"insecureSkipVerify":false,
   "enabled":true,"createdBy":"admin","passwordSet":true,"createdAt":"2026-10-03T09:12:04Z","updatedAt":"2026-10-03T09:12:04Z",
   "status":{"state":"down","since":"2026-10-03T10:02:11Z","queued":50000,"queueCap":50000,"written":182340,
     "backfilled":0,"dropped":1210,"refused":0,"lastWrite":"2026-10-03T10:02:10Z",
     "lastError":"failed to connect to `user=hotloop database=plant`: dial tcp 10.20.0.9:5432: connect: connection refused",
     "owedFrom":"2026-10-03T10:02:09Z"}}]}
```

`kinds` son las bases de datos en las que escribe este HotLoop, y cómo llama cada una a sus campos: InfluxDB tiene un token donde las demás tienen una contraseña (`password` lo lleva), un bucket donde tienen una base de datos (`database`), una medición donde tienen una tabla (`table`), y una organización (`org`) que ninguna de las otras tiene. `status.state` es `up`, `catching-up` (activo, y todavía enviando lo que se le debe del propio historial de HotLoop), `down`, `starting` u `off` (desactivado). `queued` es lo que espera en memoria, de `queueCap`. `written` cuenta las lecturas enviadas en vivo y `backfilled` las enviadas desde el propio historial de HotLoop. `dropped` cuenta las lecturas que la cola soltó mientras el destino no podía seguir el ritmo: se deben, no se pierden. `refused` cuenta las lecturas que la propia base de datos no quiso aceptar, con su motivo en `lastRefusal`. `owedFrom` y `owedTo` son lo que aún se debe; `owedTo` falta mientras el final sigue abierto, lo cual ocurre mientras el destino esté caído.

### `POST /api/historian/targets`

```json
{"id":"plant-pg","name":"Plant historian","kind":"postgres","address":"db.plant.local","database":"plant",
 "username":"hotloop","password":"...","useTls":true}
```

`id` son de 1 a 63 letras minúsculas, dígitos y `-`, y nombra el destino en el registro del sistema. `address` es `host` o `host:port`, sin usuario; el puerto predeterminado del tipo completa uno que falte. `table` toma por defecto el `defaultTable` del tipo y puede llevar un esquema (`history.hotloop`). `org` es la organización de InfluxDB 2. `enabled` es true por defecto. Una contraseña necesita una clave: sin `HOTLOOP_SECRET_KEY_FILE` da un `400`, nunca se almacena en claro. `201` con el destino y su estado; `409` para un id ya usado.

### `PUT /api/historian/targets/{id}`

Cualquiera de los campos anteriores salvo `id`; lo que no se envía se queda. `"password":""` borra la contraseña. Un cambio reinicia el destino con sus nuevos ajustes, y lo que se le debía se le sigue debiendo. `200` con el destino.

### `DELETE /api/historian/targets/{id}`

Deja de escribir en él y olvida lo que se le debía. Lo que ya contiene se queda en su base de datos. Desactívelo con `"enabled":false` en su lugar para conservar los ajustes. `200` `{"deleted":"plant-pg"}`.

## Registro del sistema

### `GET /api/events`

Cada cambio, escritura, inicio de sesión y transición de conexión, de lo más reciente a lo más antiguo.

| Consulta | <span class="sr-only">Detalles</span> |
|---|---|
| `category` | Repetible: `system`, `device`, `tag`, `write`, `alarm`, `automation`, `mcp`, `config`, `auth` |
| `severity` | Repetible: `debug`, `info`, `warning`, `error` |
| `subject` | Exacto: un id de dispositivo, una clave de tag, un entity_id, `equipment:4`, `label:critical` |
| `q` | Búsqueda sin distinguir mayúsculas |
| `minutes` | Solo los últimos N minutos |
| `limit` | 200 por defecto, como máximo 5000 |

```json
[{"id":61,"at":"2026-09-27T20:29:23.303795Z","severity":"info","category":"config","subject":"line1-hourly","actor":"admin","message":"report created"}]
```

`actor` es un usuario, `system`, `automation:<id>` o `mcp:<client>`. `detail`, cuando lo hay, es JSON adicional como cadena.

## Registro de actividad

### `GET /api/logbook`

Una sola cronología de lo que pasó, de lo más reciente a lo más antiguo: cambios de estado de entidades, escrituras, transiciones de alarmas, ejecuciones de automatizaciones y scripts, y cambios de configuración y llamadas a servicios del registro del sistema. Los rastros se leen donde están y se combinan, de modo que cada uno conserva su propia retención. Las lecturas numéricas no están en él: para eso sirve `GET /api/history`. Véase [el registro de actividad](/es/iot/logbook/).

| Consulta | <span class="sr-only">Detalles</span> |
|---|---|
| `entity` | Solo lo que tiene que ver con esta entidad: sus cambios de estado, las escrituras en ella y en sus tags, sus alarmas, las ejecuciones de automatizaciones que dispara o que escribieron en ella, los cambios de configuración que la afectan |
| `equipment_id` | Solo lo que ocurrió en este nodo del árbol de equipos o por debajo, con la misma regla. No junto con `entity` |
| `actor` | Parte, sin distinguir mayúsculas, de quién lo hizo: un usuario, `automation:<id>`, `mcp:<client>` |
| `kinds` | Separados por comas o repetidos: `state`, `write`, `alarm`, `automation`, `event`, `script`, `recipe` |
| `from`, `to` | Horas RFC 3339; `from` inclusive, `to` exclusivo |
| `limit` | 100 por defecto, como máximo 1000 |
| `before` | El `next` de la página anterior |

```json
{"entries":[
  {"at":"2026-09-28T09:14:02.51Z","kind":"state","id":41,"severity":"info","message":"changed to on (was off)","entity_id":"switch.tank_farm_pump","old_state":"off","state":"on","quality":"good"},
  {"at":"2026-09-28T09:14:02.18Z","kind":"write","id":88,"severity":"info","message":"wrote true to tank-farm/pump (switch.turn_on on switch.tank_farm_pump) (was 0)","actor":"admin","source":"ui","entity_id":"switch.tank_farm_pump","device_id":"tank-farm","tag":"tank-farm/pump","call_id":"5c9f8545a93b5443"},
  {"at":"2026-09-28T09:13:40.02Z","kind":"state","id":37,"severity":"info","message":"changed to closed (was open); 14 changes before this not logged, it was changing faster than the logbook records","entity_id":"valve.infeed","old_state":"open","state":"closed","quality":"good","suppressed":14}
 ],
 "next":"MjAyNi0wOS0yOFQwOToxMzo0MC4wMlp8c3RhdGV8Mzc"}
```

`id` es el id de la fila en su propio rastro (para un cambio de estado, el id inmutable de la entidad), y junto con `at` y `kind` es lo que codifica `next`: la página siguiente es todo lo estrictamente más antiguo en ese orden, sea lo que sea lo que se haya añadido entre tanto. `next` se omite en la última página. `suppressed` es cuántos cambios de esa entidad anteriores a este no se registraron, porque cambiaba más rápido que diez de golpe y luego uno cada dos segundos.

`400` para un tipo desconocido, una hora mal formada, `from` que no es anterior a `to`, un límite superior a 1000, un cursor inventado, o `entity` y `equipment_id` juntos; `404` para un nodo que no existe. `503` cuando el registro de actividad no se está ejecutando en el proceso que responde.

## Flujo en vivo

### `GET /api/stream`

Eventos enviados por el servidor, en un solo sentido, mientras lo mantenga abierto. SSE en lugar de un WebSocket porque el tráfico solo va en un sentido, y un flujo de eventos se reconecta solo cuando el pod se reinicia bajo un panel abierto. `EventSource` envía la cookie de sesión; un script envía el token bearer.

Al conectar recibe `retry: 3000` y luego la imagen actual, de modo que una pantalla se llena antes de que cambie nada:

```
retry: 3000

event: snapshot
data: [{"deviceId":"extruder-1","protocol":"opcua","tagName":"Temperature","tagValue":19.553128777917983,"unit":"C","quality":"good","timestamp":"2026-09-27T20:34:23.619589Z"}]

event: alarms
data: {"alarms":[...outstanding alarms...],"summary":{"critical":0,"high":1,"medium":0,"low":0,"unacked":0,"total":1}}

event: entities
data: {"changed":[...every entity state...],"removed":[]}
```

Después, a medida que ocurren las cosas:

| Evento | Datos | Cuándo |
|---|---|---|
| `values` | Una matriz de lecturas, con la forma de `GET /api/values`, la más reciente por tag, **solo los tags cuya lectura cambió** | Cada 250 ms, si alguno cambió. Un tag cuyo valor, texto, unidad, calidad y motivo son los mismos que los del último enviado se deja fuera, y se vuelve a enviar cuando lleva 30 segundos sin enviarse, de modo que el `timestamp` de un valor estable nunca tiene más antigüedad que eso. Un driver lee cada tag en cada sondeo; la 4.19.5 los enviaba todos cada vez (unos 150 KB cuatro veces por segundo para los 2232 tags de un tester) y una página con un enlace lento se quedaba minutos atrasada |
| `entities` | `{"changed": [states], "removed": [entity_ids]}` | Cada 250 ms, si cambió el estado de alguna entidad. `removed` es una entidad deshabilitada, eliminada o renombrada |
| `alarm` | `{"alarm": {...}, "event": "shelved"}`, la alarma y lo que le ocurrió (`raised`, `acked`, `cleared`, `shelved`, `unshelved`, `suppressed`, `unsuppressed`) | De inmediato: las transiciones de alarma son raras y cada una importa |
| `device` | `{"deviceId":"tank-farm","state":"connected"}` | De inmediato: la pantalla debe ponerse roja cuando un dispositivo se cae, no en el siguiente envío |
| `logbook` | `{"kinds":["state","write"]}`, qué tipos de entrada del registro de actividad tienen algo nuevo | Como máximo una vez por segundo. Sin entradas, porque lo que una pantalla debe mostrar depende de sus filtros: pide `GET /api/logbook` para su propia página |

```
event: alarm
data: {"alarm":{"definitionId":"extruder-temp-hi","state":"shelved","shelvedUntil":"2026-09-27T20:39:45.839983854Z","shelvedBy":"admin","...":"..."},"event":"shelved"}

event: device
data: {"deviceId":"tank-farm","state":"connected"}
```

Una línea de comentario (`: heartbeat 2026-09-27T20:35:00Z`) cada 20 segundos evita que los proxies cierren una conexión inactiva. Cada página abierta lleva su propio ritmo: su escritor descansa tanto como duró su último envío (como máximo cinco segundos), y lo que llega mientras tanto se retiene por tag y por entidad, solo lo más reciente, de modo que una página con un enlace lento va uno o dos envíos por detrás de la planta, nunca minutos, no pierde nada y no le quita nada a las demás páginas. El flujo se comprime con gzip cuando la solicitud dice `Accept-Encoding: gzip` (un navegador lo hace), lo que reduce la primera imagen de un tester de unos 326 KB a unos 11 KB en el cable. La respuesta establece `X-Accel-Buffering: no`, porque un proxy que almacena en búfer convierte un flujo en vivo en una descarga muy lenta.

El flujo vuelve a mirar su sesión cada cinco segundos y se cierra cuando la sesión ya no existe: cerrada, caducada, revocada, o con la cuenta deshabilitada o sin permiso ya para `status.read`. No envía ningún evento antes. El `EventSource` de un navegador se reconecta, recibe el `401` indicado arriba, y se detiene. Con `HOTLOOP_AUTH_INSECURE=true` no hay sesión ni nada que comprobar. La comprobación no cuenta como uso de la sesión, de modo que una pantalla que se deja abierta no mantiene fresca una sesión.

## MCP

### `/mcp` y `/mcp/`

El Model Context Protocol, transporte HTTP en streaming, para agentes. Cualquier método: el transporte usa `POST` para las llamadas, `GET` para el propio flujo del servidor y `DELETE` para terminar una sesión. La ruta es `HOTLOOP_MCP_PATH` (`/mcp` por defecto) y el endpoint solo está ahí cuando `HOTLOOP_MCP_ENABLED` está activado.

**No** está detrás del inicio de sesión. Tiene su propio token bearer, `HOTLOOP_MCP_TOKEN`, comprobado delante del manejador para que quien llama sin él ni siquiera pueda listar las herramientas:

```
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="hotloop"

unauthorized
```

Sin ningún token configurado, HotLoop crea uno en su primer arranque y lo guarda en su base de datos (`hotloop mcp-token` lo imprime), de modo que el endpoint nunca queda abierto. Un agente es un llamador como cualquier otro: lee y escribe, sus escrituras pasan por la misma puerta de escritura que las de todos, y se auditan como `mcp:<client name>`. Las herramientas y los recursos están en [MCP](/es/iot/mcp/).

```
POST /mcp
Authorization: Bearer <token>
Accept: application/json, text/event-stream

{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"1"}}}
```

responde con una cabecera `Mcp-Session-Id` y las capacidades e instrucciones del servidor.

## La interfaz

### `GET /manifest.webmanifest`

El manifiesto de aplicación web que permite a un teléfono instalar la interfaz como aplicación: el nombre del producto y de la planta, `display` `standalone`, los colores del tema, los iconos (PNG de 192 y 512 píxeles, uno enmascarable de 512 y el SVG) y accesos directos a Alarmas y Paneles. Cada URL que contiene es relativa a la del propio manifiesto, así que es correcta dondequiera que esté montado HotLoop. El nombre sigue el nombre de planta definido en Ajustes, y la respuesta es `Cache-Control: no-cache` para que un cambio de nombre se vea en la siguiente consulta. Sin sesión: un teléfono pregunta antes de que nadie haya iniciado sesión. Véase [Paneles](/es/iot/dashboards/#en-un-teléfono).

### `GET /sw.js`

El service worker, en la raíz de donde está montado HotLoop para que su alcance cubra toda la aplicación. Guarda la página y la última respuesta a las lecturas que mira una persona, y las responde marcadas como antiguas cuando no se puede llegar a HotLoop. Nunca responde, guarda ni pone en cola una escritura. La versión en ejecución está en él, de modo que cada versión tiene su propia caché de páginas. `Cache-Control: no-cache`; sin sesión. Solo lo ejecuta un navegador en un contexto seguro (https, o `localhost`).

### `GET /next` y `GET /next/`

Donde vivía la interfaz mientras la antigua era la predeterminada. Ambos son un `301` a la raíz, de modo que un marcador hecho entonces sigue llegando.

### `/`

La interfaz web, compilada desde `web/` dentro del binario: una página, sus scripts, estilos y fuentes, un service worker y los iconos de la aplicación instalable, con cada URL relativa a la página para que funcione en la raíz de un host, bajo una ruta, detrás de un proxy o dentro del iframe del dashboard de EmberNet. El servidor rellena el título y un bloque de datos, `<script type="application/json" id="iiot">`, con lo que solo él sabe: la planta, el sitio, el producto, las funciones, la política de escritura y la zona horaria. Solo `GET` y `HEAD`; cualquier otro método es `405`. Una ruta que no es uno de sus archivos es un `404`, porque servir la página ante un error de tecleo la haría parecer una pantalla que funciona, y un binario compilado sin la interfaz lo dice en texto plano y cómo compilarla. Sin sesión: la página es el formulario de inicio de sesión hasta que inicia sesión.
