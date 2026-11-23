---
title: "Autenticación y usuarios"
description: "Inicios de sesión, roles, tokens y la pantalla de usuarios, y lo que debe declarar un despliegue detrás de un proxy de confianza para prescindir de ellos."
---

HotLoop tiene su propio inicio de sesión desde la 4.4.0, y todos los productos lo exigen por defecto. Funcionar sin él sigue siendo posible, a propósito, para un despliegue realmente aislado detrás del dashboard que quiere declararlo, véase [Funcionar sin inicio de sesión](#funcionar-sin-inicio-de-sesión), pero un simple `helm install` o una unidad de Podman Quadlet ahora arranca exigiéndolo.

## Resumen

- **Usuarios locales, contraseñas con bcrypt, sesiones en el servidor.** Todavía no hay un proveedor de identidad externo; consulte [MCP](/es/iot/mcp/) para el perímetro aparte de tokens bearer que protege la interfaz de agentes, y que esto no sustituye.
- **Tres roles: admin, operator, viewer.** El rol admin puede hacerlo todo, incluida la gestión de usuarios. El rol operator puede leer todo y escribir tags, reconocer alarmas y activar automatizaciones. El rol viewer puede leer todo y nada más. También se puede dar a un usuario una lista explícita de permisos en lugar de un rol, para cualquier caso más restringido.
- **Una sesión es una cookie o un token bearer**, el que le resulte más cómodo al cliente. La interfaz del navegador usa la cookie; un script u otro servicio usa `Authorization: Bearer <token>`.
- **Un panel compartido inicia sesión con un PIN o una credencial (badge)** y la cierra cuando nadie lo toca, de modo que cada escritura lleva el nombre de una persona. Véase [Paneles de quiosco](#paneles-de-quiosco-pin-o-credencial-y-cierre-de-sesión-por-inactividad).
- **Las sesiones caducan.** `HOTLOOP_AUTH_SESSION_TTL`, 12 horas por defecto. No existe "recordarme": una sesión que dura más que un turno de trabajo es una sesión que nadie vigila.

## Obtener la primera cuenta

El chart genera una en la primera instalación y la muestra una sola vez, en la salida NOTES de `helm install`:

```
helm install hotloop ./charts/hotloop \
  --namespace hotloop --create-namespace
```

Si ejecuta el binario directamente, genere un hash y defina dos variables:

```sh
hotloop hash-password
# Password: ********
# Confirm password: ********
# $2a$10$....................................................

export HOTLOOP_AUTH_ENABLED=true
export HOTLOOP_ADMIN_USER=admin
export HOTLOOP_ADMIN_PASSWORD_HASH='$2a$10$....................................................'
```

`hash-password` también acepta `-password` directamente, para un script que ya tiene una:

```sh
hotloop hash-password -password 'something-long'
```

La cuenta de administrador que se crea así es un **arranque inicial**, no un interruptor de restablecimiento. Una vez que existe, cambiar `HOTLOOP_ADMIN_PASSWORD_HASH` y reiniciar no hace nada: `EnsureAdminUser` solo crea la cuenta si ese nombre de usuario no existe, de modo que un valor aquí nunca puede sobrescribir una contraseña que un operador haya cambiado después desde la interfaz. Esto importa sobre todo en una actualización de Helm: volver a aplicar el mismo `values.yaml` no debe revertir en silencio la contraseña de nadie.

## Roles

| Rol | Qué puede hacer |
|---|---|
| **admin** | Todo: `*`. Incluido crear, desactivar y eliminar usuarios. |
| **operator** | Leer todas las pantallas. Escribir tags (`POST /api/write`) y dar órdenes a entidades (`POST /api/services/...`), definir helpers (`helpers.write`, véase [Helpers](/es/iot/helpers/)), ejecutar y detener scripts (`scripts.run`, véase [Scripts](/es/iot/scripts/)), aplicar recetas (`recipes.apply`, véase [Recetas](/es/iot/recipes/)), crear una regla a partir de un blueprint y actualizarla (`blueprints.apply`, véase [Blueprints](/es/iot/blueprints/)), ver los dashboards que se ofrecen al rol (`dashboards.read`, véase [Dashboards](/es/iot/dashboards/)), leer la energía consumida y lo que costó (`energy.read`, véase [Energía](/es/iot/energy/); crear un contador o una tarifa es `energy.write`, propio de un admin), reorganizar el tablero, reconocer, aplazar y reactivar alarmas, activar automatizaciones. No puede editar las *definiciones* de dispositivos, tags, alarmas, automatizaciones, scripts, recetas, blueprints ni dashboards, y no puede gestionar usuarios. |
| **viewer** | Leer todas las pantallas. Nada más. |

A un usuario se le puede dar una lista explícita de `permissions` en lugar de un rol, que **sustituye** por completo al rol en lugar de añadirse a él: un usuario es "el rol operator" o "exactamente estos permisos", nunca ambos, así que hay un único sitio donde mirar para saber qué puede hacer alguien.

Los permisos se escriben como `resource.action`, `tags.write`, `alarms.ack`, o un comodín de recurso, `tags.*`, o el comodín global `*`.

## Paneles de quiosco: PIN o credencial, y cierre de sesión por inactividad

En su propio ordenador usted ya ha iniciado sesión: escribió la contraseña una vez, y una escritura pasa directamente por la puerta de escritura y queda registrada a su nombre, como siempre. Eso no ha cambiado. Un panel en la pared no es el ordenador de nadie. Si ha iniciado sesión como `panel-3`, el registro de auditoría dice "panel-3 abrió la válvula", y eso no es un registro de auditoría. Por eso un panel inicia sesión con un PIN o una credencial, cada escritura es de esa persona, y el panel cierra su sesión cuando nadie lo toca.

### Lo que ve el operador

Un panel es una pantalla física: HotLoop abierto en `/?screen=<name>` (véase [Dashboards](/es/iot/dashboards/#roles-y-pantallas)). Sin nadie con la sesión iniciada, muestra un solo campo, "PIN o credencial", y nada de la planta. Escriba el PIN y pulse Intro, o pase la credencial. El panel abre su dashboard, con quién ha iniciado sesión y un botón **Cerrar sesión** en la esquina, porque la cabecera que normalmente lo indicaría no existe en un panel. Al pulsar un botón de escritura se pide la confirmación y el motivo como en cualquier otro sitio, y la escritura queda registrada a nombre de esa persona.

Pasado el límite de inactividad sin que nadie toque la pantalla, el panel cierra la sesión de la persona y vuelve al campo del PIN. Lo aplica el servidor además de la página: una sesión de quiosco que lleva inactiva todo ese tiempo se elimina, y una escritura enviada después con su cookie se rechaza con un `401`, de modo que cerrar la página, o una página bloqueada, no deja a nadie con la sesión abierta. Si hay que usar el panel con una contraseña, "Usar una contraseña" bajo el campo es el inicio de sesión normal, con las 12 horas habituales y sin límite de inactividad, porque es el inicio de sesión propio de alguien.

Cuenta como tocar: una pulsación, un clic, una tecla o una escritura. No cuenta: que el dashboard actualice sus cifras, ni el flujo en vivo, que continúan haya alguien o no.

### Configuración

Un admin da a cada persona un código en **Ajustes, Usuarios**: **PIN o credencial** en su fila, el código dos veces, **Guardar**. O por la API, que es lo que usaría un script que emita credenciales:

```sh
curl -X PUT -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"code":"482913"}' https://gateway/api/users/olga/pin

# Take it away (also signs them out of every panel)
curl -X DELETE -H "Authorization: Bearer $TOKEN" https://gateway/api/users/olga/pin
```

- **Un PIN es una credencial de acceso.** Se guarda como hash bcrypt con el mismo coste que una contraseña, nunca en claro, nunca en el registro del sistema y nunca en una respuesta. La lista de usuarios solo dice `hasPin`. Una copia de seguridad guarda los hashes exactamente igual que los de las contraseñas ([Copias de seguridad y restauración](/es/iot/backup/)).
- **Una credencial (badge) es un valor que escribe un lector tipo teclado.** No hay controlador de hardware. Un lector que actúa como teclado escribe el número de la credencial en el único campo del panel y pulsa Intro, que es el envío del formulario. Así que una credencial es un código como un PIN: lo que escriba el lector, de 6 a 72 caracteres sin espacios, definido en la cuenta en el mismo sitio. Leerla desde un lector que no actúe como teclado no está implementado.
- **Un código, una cuenta.** El panel identifica a la persona solo por el código, porque un lector de credenciales no escribe nombre de usuario, así que se rechaza definir un código que ya tiene otra cuenta.
- **El código se comprueba contra todas las cuentas que tienen uno,** con el mismo bcrypt que cuesta una contraseña, porque un hash con sal no se puede buscar por valor. Eso tarda tanto como cuentas con código haya, un par de segundos como máximo con decenas de ellas, y tarda lo mismo si el código es correcto o incorrecto.
- **Un código inicia sesión con el rol de la cuenta.** Désele a quien tenga el rol que debe tener en un panel. Una sesión de quiosco tiene los permisos propios de la cuenta y nada más estrecho, y el código de un viewer inicia sesión como viewer, cuyas escrituras la puerta rechaza como siempre.
- **Desactivar una cuenta** termina sus sesiones de panel junto con las demás, y el código de una cuenta desactivada no inicia sesión. **Quitar el código** cierra la sesión de la cuenta en los paneles y deja intactas su contraseña y la sesión de su propio ordenador.

### El tiempo de cierre por inactividad

Quince minutos por defecto. Es lo bastante largo para trabajar un cambio de turno en el panel con una carpeta en la mano, o para caminar hasta la válvula y ver cómo se mueve, y lo bastante corto para que un panel abandonado al final de un trabajo no siga siendo el nombre de alguien cuando llegue la siguiente persona. Es un criterio mío, no un número que fije el código ni una norma. Cámbielo en **Ajustes, Planta, Cierre de sesión del quiosco por inactividad (segundos)**, de 10 segundos a 12 horas, sin volver a desplegar, o defina un valor por defecto con `HOTLOOP_AUTH_KIOSK_IDLE` (una duración, `15m`). Lo definido en Ajustes prevalece sobre la variable. La sesión también termina en `HOTLOOP_AUTH_SESSION_TTL`, como cualquier sesión.

### El bloqueo tras contraseñas y PIN incorrectos

Una contraseña o un PIN incorrectos se cuentan contra la **cuenta** en la que se probaron. Diez fallos seguidos bloquean esa cuenta durante cinco minutos, y a ninguna otra. Una contraseña o un PIN correctos antes del décimo reinician la cuenta, y un bloqueo que ha terminado da diez intentos nuevos. Una cuenta bloqueada rechaza un inicio de sesión se escriba lo que se escriba, bien o mal, con un `429` que indica cuánto esperar. Un bloqueo detiene los inicios de sesión nuevos y nada más: una sesión que la cuenta ya tiene continúa, con sus peticiones y su flujo en vivo, de modo que diez intentos fallidos de otra persona no pueden dejar en blanco la pantalla de un operador en la línea. Se aplica por igual al inicio de sesión con contraseña y con PIN, y cada bloqueo queda en el registro del sistema (categoría `auth`).

- **De dónde salen los números.** NIST SP 800-63B dice que un verificador limita los intentos fallidos consecutivos en una sola cuenta: la revisión 3, sección 5.2.2, y la revisión 4, sección 3.2.2, fijan el máximo en 100 y dicen que un operador puede fijarlo más bajo. La revisión 4 también permite hacer esperar al solicitante tras los fallos. Esto es esa espera, no una desactivación permanente. Diez es una décima parte del techo de NIST, y más de lo que nadie se equivoca por accidente. Cinco minutos es lo bastante largo para que diez intentos cada cinco minutos mantengan fuera de alcance el millón de posibilidades de un PIN de seis caracteres (unos 350 días para probarlas todas), y lo bastante corto para que un operador que se equivocó al teclear la contraseña vuelva tras un café. Seis caracteres como mínimo para un PIN es el mínimo de la sección 5.1.1.2 de la revisión 3 para un secreto asignado, que es lo que es un PIN entregado por un admin. Diez y cinco son mi elección dentro del límite de NIST, no números de NIST.
- **Ambos son ajustes.** **Ajustes, Planta**: "Bloquear una cuenta tras este número de contraseñas o PIN incorrectos" (por defecto 10, de 1 a 100, y 0 lo desactiva) y "Cuánto tiempo permanece bloqueada una cuenta" (por defecto 5 minutos, de 10 segundos a un día). Las variables son `HOTLOOP_AUTH_LOCKOUT_ATTEMPTS` y `HOTLOOP_AUTH_LOCKOUT_DURATION` (una duración, `5m`). Lo definido en Ajustes prevalece sobre la variable.
- **Un admin puede desbloquear una cuenta.** **Ajustes, Usuarios** muestra una cuenta bloqueada como `locked` con un botón **Desbloquear**, o `DELETE /api/users/{username}/lockout`. El recuento vuelve a empezar desde cero.
- **Nunca el panel.** Un código incorrecto escrito en un panel nunca se cuenta contra el panel, de modo que los errores de una persona no frenan a la siguiente.
- **Un código solo no se puede contar, así que el panel se ralentiza.** Un lector de credenciales escribe solo la credencial, y un PIN escrito solo no coincide con ninguna cuenta cuando es incorrecto, así que no hay cuenta contra la que contarlo. Contarlo contra el panel dejaría fuera al siguiente trabajador por los errores del anterior, y el panel nunca se bloquea. En su lugar, cada fallo consecutivo hace que ese panel espere medio segundo más antes de comprobar el siguiente: 0,5 segundos tras el primer fallo, 1 tras el segundo, y así hasta el tope, 3 segundos por defecto. Uno correcto lo reinicia. Así el siguiente trabajador entra como mucho tras el tope, y quien adivine queda limitado a un intento por tope y panel: un millón de PIN de seis dígitos llevaría más de un mes. Los intentos enviados a la vez hacen cola y cada uno espera su turno. Un PIN escrito con su nombre de usuario no se ralentiza: es de la cuenta, y la bloquea como una contraseña incorrecta. La espera máxima está en **Ajustes, Planta, Espera máxima de un panel tras PIN incorrectos (segundos)**, de 0 a 30, con `HOTLOOP_AUTH_PANEL_DELAY_CAP` como valor por defecto (una duración, `3s`) y 0 para desactivarla. Tres segundos es una pausa que soporta un trabajador que se equivocó, y lo bastante lenta para importarle a quien prueba todos los códigos. El paso de medio segundo es fijo.
- **Qué panel es cuál.** La dirección del cliente: el primer salto de `X-Forwarded-For` cuando un proxy lo definió, o si no la propia conexión, que es también lo que registra la lista de sesiones. Antes de iniciar sesión no se conoce nada mejor: todavía no hay sesión, y una cookie entregada por el servidor es una que el cliente puede tirar para reiniciar la espera. Así que detrás de un proxy que define `X-Forwarded-For`, cada panel espera por su cuenta. Detrás de uno que no, todos los paneles comparten la dirección del proxy y se ralentizan entre sí, como mucho hasta el tope. Y un cliente que alcance el puerto directamente puede enviar su propio `X-Forwarded-For` y esquivar la espera. Por eso esto es una ralentización y el bloqueo de la cuenta es el control: para adivinar lo que importa, use la forma con nombre de usuario, o valores de credencial largos y aleatorios.
- **Dice que la cuenta existe.** El `429` es para una cuenta que existe, así que le dice a quien prueba nombres cuáles son. Eso es lo que es un bloqueo.

### Lo que no hace

- **Un código solo no se puede bloquear.** Véase [El bloqueo](#el-bloqueo-tras-contraseñas-y-pin-incorrectos), que explica por qué.
- **Sin aviso antes de cerrar la sesión.** El panel vuelve al campo del PIN cuando se acaba el tiempo.
- **Un panel dejado con la sesión iniciada con contraseña** (como había que usarlo antes de esto) sigue funcionando como antes y sigue escribiendo como esa cuenta. No dé a un panel compartido un inicio de sesión de operador permanente; dé PIN a las personas que lo usan.
- **Sin controlador de lector, sin SSO, sin permisos por panel.**

## Gestión de usuarios

Solo admin. En la interfaz es **Ajustes, Usuarios**: cada cuenta con su rol, si está activa y cuándo inició sesión por última vez, con Añadir un usuario, Editar (rol, y desactivarla), Nueva contraseña y Eliminar. No se dibuja nada para quien no tenga `users.manage`, ni cuando la autenticación está desactivada. Una cuenta cuyos permisos se enumeraron uno a uno aparece como `custom` con cuántos, y Editar conserva la lista a menos que elija un rol, que la sustituye. Lo mismo mediante la API REST:

Una contraseña tiene de 8 a 72 bytes: 72 es el límite propio de bcrypt, y una más larga se rechaza indicándolo. Funciona igual por OPC UA (véase [El servidor OPC UA](/es/edge/opc-ua-server/#who-may-log-in)); en versiones anteriores una contraseña de más de 64 bytes podía iniciar sesión aquí y no allí.

```sh
# List
curl -H "Authorization: Bearer $TOKEN" https://gateway/api/users

# Create
curl -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"username":"j.smith","password":"something-long","role":"operator"}' \
  https://gateway/api/users

# Disable (does not delete; also revokes every session that account holds)
curl -X PUT -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"role":"operator","disabled":true}' \
  https://gateway/api/users/j.smith

# Reset a password an operator forgot
curl -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"password":"a-new-one"}' \
  https://gateway/api/users/j.smith/password
```

Conviene conocer dos rechazos antes de que sorprendan a alguien:

- **No puede eliminar su propia cuenta mientras está conectado con ella.** Cambie antes a otra cuenta admin.
- **No puede desactivar ni eliminar la última cuenta admin activa.** Ascienda una segunda cuenta a admin, o deje una en paz, antes de quitar la primera. Sin esta comprobación, un solo error en una sincronización de usuarios con script es un bloqueo sin ninguna sesión admin desde la que deshacerlo.

Cualquier usuario con sesión iniciada puede cambiar su propia contraseña sin ninguna de las dos restricciones:

```sh
curl -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"currentPassword":"old","newPassword":"new"}' \
  https://gateway/api/auth/password
```

Un cambio de contraseña revoca todas las sesiones de esa cuenta, incluida la que hizo la petición. Se espera que el cliente vuelva a iniciar sesión.

## Las credenciales de dispositivo son de solo escritura

Añadido en la 4.15.1. Antes, `GET /api/devices` y `GET /api/devices/{id}` devolvían el `config` y el `address` de un dispositivo tal como estaban guardados, de modo que cualquier usuario con sesión, incluidos los viewer, podía leer la contraseña del broker MQTT, las credenciales HTTP y MTConnect, y cualquier otra cosa guardada en un dispositivo. La 4.15.0 ocultaba solo la contraseña de OPC UA. Desde la 4.15.1, ningún rol puede volver a leer por la API las credenciales de un dispositivo, **ni siquiera admin**. Para cambiar una se envía un valor nuevo.

### Qué cuenta como credencial

| Protocolo | Oculto en la configuración | También oculto |
|---|---|---|
| MQTT | `password` | la información de usuario y los valores secretos de la consulta en la dirección (`mqtt://user:pass@broker`) |
| HTTP | `password`; cada valor de `headers` salvo unos pocos sencillos (`Accept`, `Accept-Encoding`, `Accept-Language`, `Cache-Control`, `Content-Type`, `User-Agent`); `body` y `writeBody` cuando mencionan una credencial (`password`, `token`, `apiKey`, y similares); un valor de consulta con aspecto de secreto en `writeUrl` | la información de usuario y los valores secretos de la consulta en la dirección y en `writeUrl` |
| MTConnect | `password`; cada valor de `headers`, con las mismas excepciones | la información de usuario y los valores secretos de la consulta en la dirección |
| OPC UA | `password` | la información de usuario en la dirección también se oculta, y el controlador la ignora, ya que una URL de endpoint OPC UA no lleva credenciales |
| Modbus, S7comm, EtherNet/IP | ninguna de sus opciones es una credencial | la información de usuario en la dirección se oculta y el controlador la ignora, por la misma razón |

Una ruta a un archivo de clave (`keyFile`) no es material de clave y se muestra. Tampoco lo es un indicador como `allowInsecureCredentials`.

Las listas anteriores se comprueban en el código. Una prueba lee la estructura de opciones de cada controlador y falla cuando una opción no está ni en la lista de credenciales ni en la de opciones que se sabe que no lo son (`plainConfigKeys`), cuando un mapa de entradas libres o un campo de texto libre no está en la lista de credenciales, y cuando cualquiera de las dos listas nombra algo que ningún controlador lee. Así, una opción nueva no puede publicarse sin que alguien decida de cuál se trata.

Como red de seguridad bajo las listas, cualquier clave a cualquier profundidad de la configuración de un dispositivo se oculta por su nombre, en cualquier protocolo, cuando contiene `password`, `passwd`, `passphrase`, `pwd`, `secret`, `token`, `apikey`, `authorization`, `credential`, `private`, `bearer`, `cookie`, `basicauth`, `signature`, `jwt`, `oauth`, `sessionid` o `connectionstring`, o termina en `key`, o tiene como palabra completa una de `pass`, `pw`, `pwd`, `passwd`, `auth`, `cred`, `creds`, `sig`, `signature`, `sas`, `jwt`, `otp`, `pin` o `psk`. Las palabras se separan en la puntuación y en los límites de minúscula a mayúscula, así que `db_pass`, `smtp_pw`, `apiAuth` y `sasToken` cuentan, y `bypass`, `compass`, `passive`, `authority` y `pinned` no. Se ignoran las mayúsculas y la puntuación, y también las grafías que `encoding/json` seguiría leyendo como la misma clave (una s larga por s, el signo Kelvin por k). La regla de las palabras cortas es tajante a propósito: una clave que nadie ha revisado, como `authMode`, queda oculta hasta que se añade a `plainConfigKeys`.

Un valor oculto por su nombre, y todo lo que hay bajo una clave así, se sustituye sea cual sea su tipo (un número se oculta igual que una cadena), salvo un booleano, que no puede ser una credencial. Una cadena que lleva una credencial en su texto se oculta entera dondequiera que esté: una línea de comandos con `--password hunter2`, un par `password=...` o una cadena de conexión, `Authorization: Bearer ...`. Un dispositivo sin credencial definida no muestra ninguna, de modo que se distingue "sin contraseña" de "una contraseña que no puedo ver". Una configuración que no se puede leer como JSON se muestra como `{}` en lugar de tal cual.

Un valor oculto se muestra como `[redacted]`. En una dirección sustituye a la contraseña y conserva el nombre de usuario (`http://svc:[redacted]@meter/api`), o toda la información de usuario cuando no hay dos puntos, y el valor de cada parámetro con aspecto de secreto de la consulta y del fragmento (`?fmt=json&token=[redacted]`, `#access_token=[redacted]`). Los parámetros se separan por `&` o `;`, o por sus formas con porcentaje `%26` y `%3B`, y cada uno se juzga por separado, así que `?fmt=json` sigue legible. Un parámetro llamado `code` cuenta como secreto en una dirección, por la clave de Azure Functions en `?code=`, y en ningún otro sitio. Una consulta que no se puede leer limpiamente (un escape de porcentaje no válido, un carácter de control) se oculta entera en lugar de adivinarla.

### Guardar un dispositivo

`POST /api/devices` crea un dispositivo cuando el id es nuevo y lo sustituye cuando el id existe. No hay un `PUT` aparte. Para cada credencial de la dirección y de la configuración:

| Lo que envía la petición | Resultado |
|---|---|
| Un dispositivo nuevo con un valor real | El valor se guarda tal como se da. |
| Un dispositivo nuevo con `[redacted]` | Se rechaza con un 400. El marcador nunca se guarda como credencial. |
| Un dispositivo existente, `[redacted]` | Se conserva el valor guardado. |
| Un dispositivo existente, con la clave omitida | Se conserva el valor guardado. Un cliente que no sabe de secretos no puede borrar uno por accidente. |
| Un dispositivo existente, una cadena o un número nuevos | Sustituye al valor guardado. |
| Un dispositivo existente, una cadena vacía o `null` | Borra el valor guardado. Esta es la única forma de eliminar una credencial. |
| `[redacted]`, sin nada guardado que conservar | Se rechaza con un 400. |

El marcador nunca se guarda, aparezca donde aparezca en una configuración o una dirección: se sustituye por el valor guardado en el mismo lugar, o se rechaza cuando no hay ninguno.

Dos detalles. Dentro de `headers` (un mapa cuyas entradas eligió la persona) la unidad es el mapa: una entrada omitida se elimina, `{}` las borra todas, y omitir la clave `headers` entera las conserva. Una clave se compara sin distinguir mayúsculas, como la comparan los controladores. Y todo lo que no es una credencial se sustituye como siempre: un dispositivo guardado sin ningún `config` conserva sus credenciales y nada más.

El editor de dispositivos de la interfaz web muestra la configuración de un dispositivo tal como la devuelve la API, marcadores incluidos, y guarda lo que muestra. Por tanto, editar un dispositivo sin tocar una credencial la conserva. **Para cambiar un secreto en la interfaz, sustituya el `[redacted]` de la configuración (o de la dirección) por el valor nuevo.** No se rellena nada con el valor anterior, así que quien cambia un dispositivo debe conocer la credencial para cambiarla.

### Mover un dispositivo no arrastra sus secretos

Las credenciales conservadas se envían a lo que sea que señale el dispositivo. Si se conservaran al mover un dispositivo, cualquiera con permiso para guardar un dispositivo podría leer una credencial guardada apuntándolo a un oyente propio y dejando que el gateway la presente. Por eso, cuando un guardado cambia el host o el puerto de la dirección, o de `writeUrl`, y conservaría una credencial guardada (por marcador o por omisión), se rechaza con un 400 que nombra las credenciales. Introdúzcalas de nuevo, o envíe una cadena vacía para borrarlas. Cambiar la ruta, el esquema o cualquier otra cosa del dispositivo no cuenta como mover, y un dispositivo sin credencial guardada se puede mover libremente.

### Dónde no aparece una credencial

Para un dispositivo de cada protocolo, con una credencial en cada lugar posible, las pruebas la buscan en: cada endpoint de dispositivo (respuestas de listar, obtener, crear y actualizar) para un viewer, un operator y un admin; cada otro endpoint de lectura; `/api/diagnostics` y `/api/status`; `/api/sites` y los servidores MCP salientes que lista; el flujo de eventos en vivo; el registro del sistema y la auditoría de escrituras; las respuestas de error; cada herramienta y recurso MCP; y el registro del proceso en nivel de depuración, del runtime y de los controladores. El texto de error de un controlador y los eventos y registros del runtime se limpian de las credenciales de un dispositivo, por valor y por forma, porque un error puede repetir una dirección o la respuesta de un servidor. Una credencial de uno o dos caracteres se sustituye solo donde aparece como palabra independiente, ya que sustituirla en todas partes arruinaría el mensaje.

### Dónde siguen las credenciales en claro

De solo escritura se trata en la API. El gateway necesita los valores reales para conectarse, y estos lugares los guardan tal como están almacenados:

- **La base de datos.** Las credenciales de dispositivo están en las columnas `config` y `address`. Con `HOTLOOP_SECRET_KEY_FILE` definido, las que tienen clave en `config` (cada `password`, los valores de cabeceras) se cifran con una clave guardada fuera de la base de datos, y también una dirección o una opción con una credencial escrita en su texto (`mqtt://user:pass@host`, `?token=`), selladas enteras. Véase [Copias de seguridad y restauración](/es/iot/backup/#credenciales-de-dispositivos-y-la-clave-secreta).
- **Copias de seguridad.** `devices.copy` en una copia las contiene, cifradas o no exactamente como la base de datos. Véase [Copias de seguridad y restauración](/es/iot/backup/#proteja-los-archivos-de-copia).
- **Archivos de dispositivos del Edge Relay.** El relay lee un archivo JSON que lleva las credenciales de sus dispositivos. Véase [Referencia de Edge Relay](/es/edge-relay/reference/#credentials-in-the-device-file-4150).
- **Envío de configuración de la flota.** Un archivo de dispositivos enviado a un relay se publica en un topic MQTT, retenido, tal como es. Véase [Gestión de flotas](/es/gateway/fleet/).

Proteja en consecuencia la base de datos, el volumen de copias, el archivo de dispositivos del relay y el broker. Ocultar datos en la API no cambia ninguno de ellos.

### Si usuarios no fiables pudieran llegar a la API

Antes de la 4.15.1, cualquier usuario con sesión podía leer por la API las credenciales de dispositivo guardadas. Un operador cuyo gateway fuera accesible a usuarios que no debieron tenerlo (una cuenta viewer entregada a un contratista, por ejemplo) debe rotar las credenciales de los dispositivos que contiene: el broker MQTT, los endpoints HTTP y MTConnect, y las cuentas OPC UA. No ha habido ninguna versión pública desde la 4.3.1, así que la exposición se limita a despliegues de compilaciones no publicadas.

## Qué registra la auditoría

Toda escritura ya pasaba por `write_audit` con una columna `actor`, véase la puerta de escritura en el README principal. Esa columna ahora sale de la sesión, no de una cabecera, y en un panel de quiosco la sesión es la persona que inició sesión con su PIN o credencial:

```
> write_tag tag=press-01/Zone1_Temp value=99 reason="testing"
```

registra `j.smith`, el nombre de usuario de la sesión que hizo la llamada, no lo que `X-Forwarded-User` dijera. Los inicios de sesión, los inicios de sesión en quiosco, los cierres de sesión, los cambios de contraseña y cada acción de gestión de usuarios, incluido definir o borrar un PIN (nunca el PIN en sí), se registran en el registro del sistema (`GET /api/events`, categoría `auth`) por la misma razón por la que existe la auditoría de escrituras: un cambio dentro de seis meses debe poder explicarse, no solo verse.

## Funcionar sin inicio de sesión

Defina `HOTLOOP_AUTH_INSECURE=true` (o `auth.insecure: true` en el chart) para funcionar exactamente como todas las versiones anteriores a la 4.4.0: sin sesión obligatoria, el actor que se registra en una escritura sale de `X-EmberNET-User` u otras cabeceras de proxy similares, y vuelve a `"operator"` si no hay ninguna.

Es una elección real y defendible para un despliegue donde la NetworkPolicy del propio dashboard de EmberNet es el perímetro efectivo y nada más puede llegar al pod. Ya no es el valor por defecto porque es fácil creer que esa condición se cumple y difícil comprobarlo desde dentro del propio pod: todo el sentido de la 4.4.0 es que un error en una NetworkPolicy, o un despliegue que resulta no estar detrás del dashboard después de todo, no debe significar además que `actor(r)` devuelva algo que eligió un atacante.

`config.Validate` se niega a arrancar con la autenticación ni activada ni reconocida de esta forma, precisamente para que "sin autenticación" sea siempre una decisión que alguien tomó a propósito, escrita en la propia configuración del despliegue, y no un valor por defecto que nadie eligió.

## Iniciar sesión desde el dashboard de EmberNet

Un tenant que instala HotLoop desde la App Store de EmberNet entra con LAUNCH en la aplicación ya conectado como él mismo, sin que se reparta ninguna contraseña. El host de aplicaciones del dashboard añade `X-Embernet-Assertion` a cada petición que lleva a este pod: un token ES256, válido durante aproximadamente un minuto, firmado con una clave privada que solo tiene el dashboard. Nombra a la persona (`email`), el tenant, la única aplicación para la que se hizo (`aud`, `<tenant>/<Service name>`) y el rol de HotLoop al que el tenant asigna el rol de dashboard de esa persona (`role`: `admin`, `operator` o `viewer`).

Está desactivado salvo que se configure una clave pública, y entonces todo lo demás funciona como antes: cuentas locales, la cookie, el token bearer, el panel de quiosco.

| Variable | Valor del chart | Función |
|---|---|---|
| `HOTLOOP_AUTH_ASSERTION_PUBLIC_KEY` | `embernetSignin.publicKey` | la clave PÚBLICA del dashboard, PEM PKIX, ECDSA P-256. La tienda la rellena en un despliegue. |
| `HOTLOOP_AUTH_ASSERTION_AUDIENCE` | calculado a partir del namespace y del nombre de la release | `<tenant>/<Service name>`. Obligatorio con la clave; se rechaza un token hecho para otra aplicación o tenant. |
| `HOTLOOP_AUTH_ASSERTION_ISSUER` | `embernetSignin.issuer` | `embernet-dashboard` |
| `HOTLOOP_AUTH_ASSERTION_HEADER` | `embernetSignin.header` | `X-Embernet-Assertion` |

Lo que hace una aserción válida: la persona obtiene un usuario aquí la primera vez que el dashboard responde por ella (con nombre según su dirección, sin contraseña, de modo que no hay nada que adivinar), el rol del usuario sigue lo que envió el dashboard en cada petición, y la auditoría la nombra. Lo que hace una no válida: 401, y no se deja de lado en silencio a favor de una cookie de sesión que casualmente esté ahí. Se rechazan una firma incorrecta, cualquier algoritmo que no sea ES256, un token caducado o aún no válido, uno que dure más de diez minutos, un emisor incorrecto, la audiencia de otra aplicación o tenant, una declaración de tenant que no coincide con la audiencia, un rol que no es de los nuestros y un nombre sin dirección.

Un admin local tiene la última palabra sobre alguien a quien el dashboard dejó entrar: desactive al usuario y se queda fuera, y désele una lista de permisos explícita y la conserva. Las escrituras siguen necesitando los propios interruptores de escritura del pod; una aserción nunca los amplía. Cerrar sesión en una sesión que creó el dashboard no la termina: el acceso termina en la siguiente petición que el dashboard deja de firmar.

## Lo que esto aún no cubre

- **Sin OpenID Connect.** Cuentas locales, más la aserción firmada del dashboard de EmberNet descrita arriba. No hay integración con un proveedor de identidad.
- **Sin roles por tenant ni por sitio.** Los permisos de un usuario son los mismos en todos los lugares donde se ejecuta el Gateway, lo que está bien para una sola planta y exigiría más reflexión para el resumen de varios sitios en `Sites`.
- **Sin bloqueo para un PIN o credencial escrito solo,** únicamente para una contraseña y un PIN con su nombre de usuario; véase [El bloqueo](#el-bloqueo-tras-contraseñas-y-pin-incorrectos). La comparación de tiempo constante en `handleLogin` impide enumerar nombres de usuario por tiempo de respuesta. Sigue valiendo la pena tener una NetworkPolicy o un proxy anterior delante del endpoint de inicio de sesión.
