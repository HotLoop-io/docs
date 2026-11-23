---
title: "Notificaciones de alarmas"
description: "ntfy, Gotify, Discord, webhooks y correo. Pulse Reconocer en su teléfono y la alarma queda reconocida, firmada y de un solo uso."
---

Las notificaciones de alarmas, desde la versión 4.10.0, avisan a un teléfono cuando se activa una alarma a las 03:00. Cuando una alarma se **activa**, HotLoop envía una notificación por cada canal configurado y habilitado cuyo umbral de prioridad cumpla la alarma. Está desactivado por defecto (`HOTLOOP_NOTIFY_ENABLED`): una instalación sin nadie a quien avisar no tiene nada que configurar aquí.

## Por qué solo "activada"

`alarm.Engine.OnTransition` se dispara en cada transición de ISA-18.2: activada, normalizada, reconocida, pospuesta, reactivada. Este paquete las escucha todas, pero actúa solo en una. Avisar en cada transición haría que el teléfono de un operador vibrara cuando reconoce su propia alarma, cuando se normaliza sola o cuando alguien la pospone durante un turno, y lo acostumbraría a descartar los avisos sin leerlos, igual que una alarma que oscila acostumbra a ignorar las alarmas. Activada es el único evento que significa "algo necesita a una persona que quizá no esté mirando una pantalla", y esa es la razón de ser de este paquete.

El único otro aviso es una escalada: la alarma se activó, nadie la ha reconocido y la política dice que hay que avisar a la siguiente persona. Es la misma alarma que sigue necesitando a alguien, comunicada de nuevo a otra persona, no un evento nuevo. Consulte "Escalado".

Hay un caso que parece una reactivación y en realidad es una activación. Si la condición aparece mientras una alarma está pospuesta, nadie ha sido avisado, así que cuando termina la pospuesta (por tiempo o porque se reactiva a mano) el motor registra la reactivación y después una activación, y esa activación avisa. Una alarma que ya estaba en alarma cuando se pospuso y lo sigue estando vuelve sin reconocer, pero no avisa otra vez: ya avisó la primera vez.

## Los canales

Son seis, y esa es la lista (consulte "Notificaciones" en la [hoja de ruta de HotLoop](/es/roadmap/) para ver lo que no vamos a hacer y por qué). Ninguno necesita un SDK de proveedor ni una cuenta de pago, de acuerdo con el plan de este proyecto: las integraciones en la nube son conexiones salientes opcionales que configura el operador, nunca algo que esta aplicación necesite para funcionar.

- **ntfy**: una notificación push al teléfono, con un botón **Reconocer** que reconoce la alarma directamente en HotLoop. Gratis, y puede ejecutar el servidor en la red de la planta sin internet. Consulte "Configurar ntfy".
- **Gotify**: una notificación push al teléfono. Gratis, autoalojado, funciona sin internet. Sin botones y sin app para iPhone, así que es un buscapersonas, no una vía de doble sentido. Consulte "Configurar Gotify".
- **Webhook de Discord**: un mensaje incrustado en un canal de Discord, con color según la prioridad, con el tag, el valor, el límite, el área y la línea. Pegue una URL y funciona. Las alarmas críticas pueden mencionar a un rol. Sin botones. Consulte "Discord".
- **Bot de Discord**: el mismo mensaje, con botones **Reconocer** y **Posponer** que actúan sobre la alarma y registran quién los pulsó. Las pulsaciones llegan por una conexión que HotLoop abre hacia Discord, así que la planta no necesita dirección pública. Consulte "Discord".

- **Webhook**: un POST con el cuerpo JSON propio de HotLoop (`alarmId`, `name`, `priority`, `priorityLabel`, `message`, `deviceId`, `tagName`, `raisedAt`, `event`, que vale `raised`, o `escalated` en una escalada) a una URL configurada. Funciona con cualquier cosa que acepte el JSON que le envíe: su propio script detrás de un pequeño receptor HTTP, Node-RED, n8n o un disparador "cualquier webhook" de una herramienta de flujos. (Si apunta a un tema de ntfy, avisa, con el JSON en bruto como texto; use mejor el canal de ntfy de arriba.) Un resumen (consulte "Límites de frecuencia y resúmenes") lleva `event` con el valor `summary` y una lista `alarms` con el nombre de cada alarma incluida. No funciona con servicios que quieren el cuerpo en su propio formato. Discord responde 400 porque no hay `content` ni `embeds`. Slack, Teams y Google Chat quieren su propio campo de texto. Pushover quiere sus campos `token`, `user` y `message`, y la API de eventos de PagerDuty quiere un `routing_key`, un `event_action` y un `payload`. Si apunta el webhook a uno de ellos, todos los avisos fallan. Discord tiene canales propios que construyen el cuerpo que Discord espera; úselos.
- **Correo por SMTP**: se envía por el relé que el operador ya tenga (un servidor de correo corporativo, el punto SMTP de un proveedor de correo transaccional, un relé autoalojado). Sin clave de API y sin librería de proveedor: `net/smtp` y un mensaje de texto plano construido a mano. Muchos teléfonos ya muestran el correo como notificación push por sí solos, y muchas herramientas de aviso aceptan una dirección de puente de correo a SMS como "método de contacto", así que este solo canal cubre una parte importante de "avisar a un teléfono" sin ninguna dependencia de pago.

## La URL del webhook nunca se imprime

Para muchos receptores la URL es la contraseña. Discord pone el token en la ruta (`/api/webhooks/{id}/{token}`), ntfy lo acepta como `?auth=`, Google Chat como `?key=` y `?token=`. Cualquiera que tenga la URL puede publicar en su canal. Por eso, cuando un envío falla, el error nombra el esquema y el host y nada más:

```
webhook request to https://discord.com failed: context deadline exceeded
webhook https://ntfy.example.com returned 401 Unauthorized
```

Es el mismo texto en el registro, en el evento de auditoría y en la respuesta de `POST /api/notify/test`. El host basta para saber qué receptor falló; la ruta y la consulta nunca salen del proceso. Una URL que no supera la validación al arrancar tampoco se repite en ese error. Si necesita ver la URL, búsquela en `HOTLOOP_NOTIFY_WEBHOOK_URL`, donde la configuró.

## Configurar ntfy

[ntfy](https://ntfy.sh) es un servidor push de publicación y suscripción. HotLoop publica cada alarma en un tema; la app de ntfy en el teléfono se suscribe a él.

1. Ejecute un servidor o use ntfy.sh. En una red de planta, ejecute el suyo (`binwiederhier/ntfy`, un contenedor) y bloquéelo: configure `auth-default-access: deny-all`, cree un usuario para HotLoop que pueda escribir en el tema y uno por persona que pueda leerlo. En ntfy.sh, o en cualquier servidor al que cualquiera pueda llegar, **el nombre del tema es la contraseña**: quien lo adivine lee sus alarmas. Hágalo largo y aleatorio.
2. Dé a HotLoop un token de acceso (`ntfy token add hotloop`) o un nombre de usuario y una contraseña para ese usuario.
3. Configure `HOTLOOP_PUBLIC_URL` con la dirección a la que el teléfono llega a HotLoop, por ejemplo `https://hotloop.plant.example`. Sin ella la notificación llega igualmente, pero sin botón Reconocer y sin tocar para abrir, porque el teléfono no tendría adónde enviar ninguna de las dos cosas.
4. Configúrelo y reinicie:

```
HOTLOOP_NOTIFY_ENABLED=true
HOTLOOP_NOTIFY_NTFY_ENABLED=true
HOTLOOP_NOTIFY_NTFY_URL=https://ntfy.plant.example
HOTLOOP_NOTIFY_NTFY_TOPIC=boiler-house-alarms
HOTLOOP_NOTIFY_NTFY_TOKEN=tk_...
HOTLOOP_PUBLIC_URL=https://hotloop.plant.example
```

5. `POST /api/notify/test` envía una notificación de prueba. No tiene botón Reconocer, porque no hay ninguna alarma detrás que reconocer.

La URL es solo el servidor. El tema va en su propio ajuste, nunca en la URL: así HotLoop sabe qué parte es el secreto y la mantiene fuera de cada error, línea de registro y evento de auditoría.

Lo que llega:

| <span class="sr-only">Detalles</span> | <span class="sr-only">Detalles</span> |
|---|---|
| Título | El nombre de la alarma |
| Cuerpo | El mensaje de la alarma, su prioridad, de dónde viene (`device/tag`) y cuándo se activó |
| Prioridad | Crítica 5 (máx.: en Android puede saltarse el modo No molestar, si usted lo permite), Alta 4, Media 3, Baja 2 |
| Etiquetas | Un emoji según la gravedad y la prioridad en palabras, para poder recorrer la lista en el teléfono |
| Toque | Abre la lista de alarmas de HotLoop, cuando `HOTLOOP_PUBLIC_URL` está configurada |
| Botón | **Reconocer**, cuando `HOTLOOP_PUBLIC_URL` está configurada. Consulte "Enlaces de reconocimiento" |

### La advertencia del iPhone

Android funciona sin internet: la app de ntfy mantiene su propia conexión con su servidor y recibe cada mensaje al instante por el Wi-Fi de la planta.

Los iPhone no. Apple solo deja pasar una notificación push por sus propios servidores (APNs), y solo ntfy.sh puede hablar con APNs. Un servidor autoalojado debe configurarse con `upstream-base-url: https://ntfy.sh`, y entonces reenvía una solicitud de consulta (sin contenido del mensaje, solo "llegó algo a este tema") a ntfy.sh, que despierta el teléfono, que a su vez recoge el mensaje de su servidor. Así que en una planta sin internet, los iPhone no reciben notificaciones al instante de un ntfy autoalojado. Las ven cuando abren la app. Si su gente lleva iPhone y la planta está aislada de internet, ntfy no es su buscapersonas; lo es el correo por un relé, o Discord si la planta puede llegar a él. Gotify no tiene app para iPhone.

El botón Reconocer es una solicitud del teléfono a `HOTLOOP_PUBLIC_URL`, así que el teléfono tiene que poder llegar a esa dirección: por el Wi-Fi de la planta o por la VPN que use. Funciona igual en ambas plataformas.

## Configurar Gotify

[Gotify](https://gotify.net) es un pequeño servidor push autoalojado con app para Android. No necesita internet ni una cuenta en ningún sitio.

1. Ejecute `gotify/server` e inicie sesión en su interfaz web.
2. En **Apps**, cree una aplicación llamada HotLoop. Copie su token.
3. Configúrelo y reinicie:

```
HOTLOOP_NOTIFY_ENABLED=true
HOTLOOP_NOTIFY_GOTIFY_ENABLED=true
HOTLOOP_NOTIFY_GOTIFY_URL=https://gotify.plant.example
HOTLOOP_NOTIFY_GOTIFY_TOKEN=A...
HOTLOOP_PUBLIC_URL=https://hotloop.plant.example
```

El token va en la cabecera `X-Gotify-Key`, nunca como `?token=` en la URL, donde acabaría en el registro de acceso de todos los proxies.

Las prioridades se corresponden con lo que hace la app de Android con ellas: Crítica 10 y Alta 8 son de importancia alta (sonido y ventana emergente), Media 5 es una notificación normal con sonido, Baja 2 es silenciosa. El mensaje es Markdown (el nombre de la alarma en negrita, los detalles como lista, el texto propio de la alarma con caracteres escapados para que un nombre con un asterisco se lea tal cual), y al tocarlo se abre la lista de alarmas de HotLoop cuando `HOTLOOP_PUBLIC_URL` está configurada.

**Sin reconocimiento.** Las notificaciones de Gotify no tienen botones de acción, así que no hay forma de ponerles un botón Reconocer, y no lo vamos a simular con un enlace que reconozca con un simple GET: los visores de enlaces y los escáneres de seguridad abren los enlaces por su cuenta, y una alarma nunca debe ser reconocida por un robot. Reconozca en HotLoop. Tampoco hay **app para iPhone**.

## Discord

Hay dos vías. El webhook es un buscapersonas: pegue una URL y reciba alarmas en un canal. El bot es de doble sentido: los mismos mensajes con botones **Reconocer** y **Posponer**, y el registro de auditoría dice qué persona los pulsó. Ambos necesitan que la planta llegue a Discord por internet (HTTPS saliente a `discord.com` y, para el bot, un WebSocket a `*.discord.gg`). Ninguno necesita que Discord llegue a la planta.

### Lo que llega

| <span class="sr-only">Detalles</span> | <span class="sr-only">Detalles</span> |
|---|---|
| Texto | `[Critical] Boiler Trip`, que es lo que muestra la notificación push de un teléfono. En una alarma crítica, delante va una mención del rol configurado |
| Título del mensaje incrustado | El mismo, con un enlace a la lista de alarmas de HotLoop cuando `HOTLOOP_PUBLIC_URL` está configurada |
| Color | Crítica en rojo, alta en naranja, media en amarillo, baja en azul |
| Descripción | El mensaje de la alarma |
| Campos | Tag (`device/tag`), Valor (la lectura que la activó), Límite (`hi 90`, de la definición), Área / Línea (del dispositivo), Activada (en la zona horaria de cada lector) |
| Pie | `HotLoop | <HOTLOOP_PLANT_NAME>`, para que un servidor con varias plantas pueda distinguirlas (solo `HotLoop` cuando no se ha configurado el nombre de la planta) |
| Botones (solo bot) | Reconocer, Posponer 1 h, Abrir en HotLoop |

Una avalancha se convierte en un resumen, igual que en todos los demás canales: salen los cinco primeros y después un mensaje con el resto, con tantos nombres como quepan y un recuento de los demás, de modo que el recuento nunca se corta.

Discord rechaza un mensaje demasiado largo (2000 caracteres de texto, 256 de título, 4096 de descripción, 25 campos, 6000 en total), y un mensaje rechazado es un aviso que no salió. Por eso HotLoop recorta para que quepa, en un límite de carácter, con `...` donde cortó.

### Nadie recibe una mención por accidente

Cada mensaje sale con `allowed_mentions: {"parse": []}`. Sin eso, Discord avisa a quien mencione el texto, así que una alarma que alguien llamó "@everyone tank overflow" despertaría a todo el servidor. Con eso, nada del texto avisa a nadie. La única excepción es el rol que configure para Crítica (`..._CRITICAL_ROLE`), que se nombra explícitamente como la única mención permitida, y solo en una alarma crítica o en un resumen que incluya una alarma crítica. Una notificación de prueba nunca menciona a nadie. El texto de la alarma también se escapa como Markdown, así que un nombre con `*` se lee tal cual y un `<@&role>` en un nombre se muestra, no se usa.

Para que la mención funcione, el rol tiene que poder mencionarse: en los ajustes de roles del servidor active **Permitir que cualquiera mencione a este rol**, o dé al bot el permiso **Mencionar @everyone, @here y todos los roles**.

### Límites de frecuencia y bloqueos de Discord

Discord responde "demasiado rápido" con un 429 e indica cuánto esperar, en el cuerpo (`retry_after`, al milisegundo) y en `X-RateLimit-Reset-After`. Es lo que HotLoop espera antes de reintentar, dentro de los tres intentos y 30 segundos habituales (consulte "Reintentos"). Cuando Discord avisa de que el presupuesto se agotó antes de rechazar (`X-RateLimit-Remaining: 0`), el siguiente envío espera al reinicio en lugar de provocar un 429.

Discord bloquea la dirección de cualquier cosa que acumule 10 000 solicitudes rechazadas (401, 403, 429) en diez minutos, y el bloqueo arrastra a todas las integraciones de Discord de esa dirección. Por eso, cuando Discord responde **401, 403 o 404** (un webhook equivocado o borrado, un token de bot erróneo, un canal que el bot no ve), HotLoop **desactiva ese canal** tras esa única solicitud. Lo registra una vez, cada alarma posterior se rechaza sin hacer ninguna solicitud (y se audita como no enviada, así que "se avisó a alguien" sigue teniendo respuesta), y aparece en `GET /api/diagnostics` bajo `notify.channels`, con el motivo y desde cuándo:

```json
{"channel": "discord-webhook", "broken": true,
 "reason": "discord webhook https://discord.com returned 404 Not Found: Unknown Webhook (Discord error 10015)",
 "since": "2026-09-27T03:00:01Z"}
```

Corrija el ajuste y reinicie HotLoop. Un 500 o la ausencia total de respuesta no desactiva nada; se reintentan como en cualquier otro canal.

### Configurar el webhook

1. En Discord, abra los ajustes del canal (el engranaje), **Integraciones**, **Webhooks**, **Nuevo webhook**. Llámelo HotLoop. **Copiar URL del webhook**.
2. Opcional: un rol al que mencionar en Crítica. Active el **Modo desarrollador** (Ajustes de usuario, Avanzado), luego haga clic derecho en el rol en Ajustes del servidor, Roles, y **Copiar ID del rol**. Es un número, no un nombre.
3. Configúrelo y reinicie:

```
HOTLOOP_NOTIFY_ENABLED=true
HOTLOOP_NOTIFY_DISCORD_WEBHOOK_ENABLED=true
HOTLOOP_NOTIFY_DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/1234.../AbCd...
HOTLOOP_NOTIFY_DISCORD_WEBHOOK_CRITICAL_ROLE=123456789012345678
HOTLOOP_PUBLIC_URL=https://hotloop.plant.example
```

4. `POST /api/notify/test` envía un mensaje de prueba.

**Toda la URL es la contraseña.** Quien la tenga puede publicar en su canal como el webhook. HotLoop nunca la imprime: ni en el registro, ni en un error, ni en un evento de auditoría, ni en una respuesta de la API, y una URL que no supera la validación al arrancar tampoco se repite en ese error. En el chart de Helm va en un Secret. Si se filtra, borre el webhook en Discord y cree uno nuevo.

Un webhook no puede llevar un botón que haga algo, así que aquí no hay Reconocer. El título enlaza con la lista de alarmas de HotLoop. Para tener botones, use el bot.

### Configurar el bot

1. Vaya al [portal para desarrolladores de Discord](https://discord.com/developers/applications), **New Application**, y llámela HotLoop. El **Application ID** de la página General Information es lo que necesita el enlace de invitación.
2. Pestaña **Bot**: **Reset Token** y cópielo. Discord lo muestra una sola vez. Es `HOTLOOP_NOTIFY_DISCORD_BOT_TOKEN`. En la misma página desactive **Public Bot**, para que nadie más que usted pueda añadirlo a un servidor, y deje desactivados los tres **Privileged Gateway Intents**. HotLoop no pide a Discord ningún evento (intents 0); las pulsaciones de botón llegan igualmente.
3. Invítelo a su servidor con lo mínimo que necesita, View Channels, Send Messages y Embed Links (permisos `19456`), y ningún otro ámbito que `bot`:

```
https://discord.com/oauth2/authorize?client_id=<APPLICATION ID>&scope=bot&permissions=19456
```

   Añada **Mention @everyone, @here, and All Roles** (`permissions=150528`) solo si el rol Crítica no se puede mencionar y prefiere no cambiarlo. Editar su propio mensaje tras una pulsación no necesita permiso; eso pasa por la propia pulsación.
4. El canal: con el Modo desarrollador activado, haga clic derecho en él, **Copiar ID del canal**. Si el canal es privado, añada el rol del bot.
5. Los roles que pueden pulsar los botones. Cree un rol (por ejemplo, "Alarm ack"), désele a las personas que pueden reconocer desde Discord y copie su id. Posponer saca una alarma de la lista durante una hora, así que tiene su propio ajuste; puede ser el mismo rol u otro más restringido.
6. Configúrelo y reinicie:

```
HOTLOOP_NOTIFY_ENABLED=true
HOTLOOP_NOTIFY_DISCORD_BOT_ENABLED=true
HOTLOOP_NOTIFY_DISCORD_BOT_TOKEN=MTIz...
HOTLOOP_NOTIFY_DISCORD_BOT_CHANNEL=223456789012345678
HOTLOOP_NOTIFY_DISCORD_BOT_ACK_ROLES=323456789012345678
HOTLOOP_NOTIFY_DISCORD_BOT_SHELVE_ROLES=423456789012345678
HOTLOOP_NOTIFY_DISCORD_BOT_CRITICAL_ROLE=323456789012345678
HOTLOOP_PUBLIC_URL=https://hotloop.plant.example
```

7. El registro dice `connected to the Discord Gateway; Discord buttons work`, y `GET /api/diagnostics` muestra `"gateway": {"connected": true}` bajo el canal `discord`. `POST /api/notify/test` publica un mensaje de prueba (sin botones, no hay ninguna alarma detrás).

**Hasta que configure los roles, nadie puede pulsar nada.** Con `HOTLOOP_NOTIFY_DISCORD_BOT_ACK_ROLES` o `_SHELVE_ROLES` vacíos, cada pulsación de ese botón se rechaza, a la persona que pulsa se le dice qué ajuste está vacío, y HotLoop lo avisa al arrancar:

```
WARN NOBODY can acknowledge alarms from Discord, because HOTLOOP_NOTIFY_DISCORD_BOT_ACK_ROLES is empty...
```

Es a propósito. Un botón que pueda pulsar cualquiera del servidor no es un valor por defecto que se deba enviar: los servidores acumulan gente.

**Quién lo pulsó.** Un reconocimiento desde Discord se registra bajo `discord:<username>#<user id>` (el id, porque un nombre de usuario de Discord puede cambiar y el id no), con la nota "acknowledged from Discord by alice (1010...)". Para registrarlo bajo el usuario de HotLoop, asígnelos: `HOTLOOP_NOTIFY_DISCORD_BOT_USERS=101010101010101010=alice,202020202020202020=bob`. La asignación solo nombra al autor. No comprueba los permisos del usuario de HotLoop: el rol de Discord es lo que decide quién puede pulsar.

**Posponer** pospone durante `HOTLOOP_NOTIFY_DISCORD_BOT_SHELVE`, una hora por defecto, como máximo 24 horas como cualquier pospuesta. Es un tiempo fijo, no un menú: a las 03:00, un botón que hace una cosa conocida es mejor que un desplegable. Rechaza una alarma que ya ha vuelto a la normalidad (posponerla ocultaría lo que la active la próxima vez) y una que ya está pospuesta.

Tras una pulsación, el mensaje dice quién hizo qué y cuándo, y los dos botones se ponen en gris, para que la siguiente persona que mire el canal vea que está atendido. Una pulsación rechazada se responde solo a quien la pulsó, con el motivo, y se registra en el registro del sistema.

### Cómo se autoriza una pulsación

La misma maquinaria que el enlace Reconocer de ntfy (consulte "Enlaces de reconocimiento"), más la palabra de Discord sobre quién pulsó:

- **El botón está firmado.** Cada botón lleva un token firmado con el mismo secreto que los enlaces de reconocimiento, para esa acción (reconocer o posponer, incluida en la firma, de modo que una no pueda reutilizarse como la otra), sobre esa alarma, activada en ese momento. Discord permite 100 caracteres de datos en un botón y un id de alarma puede tener 64, así que esta es una forma compacta de la misma afirmación: 8 bytes de hora de activación, 4 de caducidad y un HMAC de 96 bits. Falsificar uno exige adivinar 96 bits, una pulsación de Discord por intento, desde dentro del servidor y con el rol adecuado.
- **La persona tiene un rol que usted nombró.** Discord informa al bot de los roles de quien pulsa junto con la pulsación, por la conexión autenticada del propio bot. Quien pueda repartir roles en su servidor puede repartir este, así que trate esos roles como el permiso que son.
- **La ocurrencia sigue vigente.** El motor comprueba, bajo su propio bloqueo, que la activación actual de la alarma es la que está en el botón. El mensaje de ayer no puede reconocer el disparo de hoy.
- **Una vez.** La primera acción sobre una ocurrencia desde cualquier notificación (ntfy o Discord) se registra y todas las posteriores se rechazan. Si dos personas pulsan a la vez: una gana y a la otra se le avisa.
- **Caduca.** Pasado el plazo de `HOTLOOP_NOTIFY_ACK_TTL` (12 horas), los botones dejan de funcionar; actúe en HotLoop.

El token del bot es una credencial de todo el bot. Nunca se registra, nunca aparece en un error, nunca aparece en una respuesta de la API; en el chart de Helm va en un Secret. Lo mismo vale para el token de interacción de cada pulsación, que Discord da al bot durante quince minutos para responderla. Si el token del bot se filtra, restablézcalo en el portal para desarrolladores.

### La conexión Gateway

Las pulsaciones llegan por el Gateway de Discord, un WebSocket que HotLoop abre hacia Discord y mantiene abierto. El cliente es el propio de HotLoop, sobre [gorilla/websocket](https://github.com/gorilla/websocket) (v1.5.3, fijada; ya estaba en el grafo de dependencias de este módulo, es pequeña y es la librería de WebSocket más usada en Go). No usamos una librería de Discord como discordgo: es un SDK completo de Discord (REST, voz, una caché de estado) para el único evento que necesitamos, y este proyecto no incluye SDK de proveedores. El cliente:

- se identifica con intents 0, así que Discord no le envía nada salvo las pulsaciones;
- envía latidos al intervalo que Discord indica, responde de inmediato a una solicitud de latido y trata un latido sin confirmar como una conexión caída;
- reanuda la sesión tras una caída, un Reconnect (op 7) o una Invalid Session reanudable (op 9), de modo que una pulsación hecha mientras reconectaba se reproduce, no se pierde; una sesión que no se puede reanudar espera de uno a cinco segundos y empieza una nueva;
- se identifica como máximo una vez cada cinco segundos, y ninguna cuando Discord dice que se agotaron los inicios de sesión del día, hasta que se reinicien;
- reconecta con una espera que se duplica de un segundo a un minuto;
- se detiene definitivamente ante un token rechazado o unos intents rechazados, desactiva el canal y lo muestra en `/api/diagnostics`, en lugar de reconectar sin fin.

Discord da al bot tres segundos para responder a una pulsación, así que lo primero que hace HotLoop es responder "recibido" (una actualización diferida) y después hace el trabajo. Esa respuesta es también lo que evita que dos réplicas de HotLoop actúen sobre una misma pulsación: ambas la reciben, Discord acepta la primera respuesta y rechaza la segunda, y la réplica rechazada se detiene. Ejecutado como ayudante MCP (`--mcp-stdio`), HotLoop no abre ninguna conexión Gateway; la real atiende las pulsaciones.

## Límites de frecuencia y resúmenes

Una caída de tensión o el reinicio de un PLC activa cuarenta alarmas en un segundo. Un envío por alarma hace que bloqueen la IP de un webhook de Discord, supera el límite por IP de ntfy y entierra la alarma que importa bajo treinta y nueve que no, en el teléfono que las recibe. Por eso cada canal tiene un presupuesto, un cubo de fichas: una ráfaga que puede salir de golpe y después una más en cada reposición.

| Canal | Ráfaga por defecto | Después una cada |
|---|---|---|
| ntfy | 10 | 5 s (bajo el límite propio de ntfy.sh de 60, y luego una cada 5 s, por IP) |
| Gotify | 10 | 5 s |
| Webhook | 10 | 5 s |
| SMTP | 5 | 12 s |
| Webhook de Discord | 5 | 2 s (Discord permite a un webhook unas 5 solicitudes cada 2 s, y a un canal 30 mensajes por minuto) |
| Bot de Discord | 5 | 2 s |

Cámbielos por canal con `HOTLOOP_NOTIFY_<CHANNEL>_BURST` y `HOTLOOP_NOTIFY_<CHANNEL>_REFILL` (`WEBHOOK`, `SMTP`, `NTFY`, `GOTIFY`, `DISCORD_WEBHOOK`, `DISCORD_BOT`).

Lo que permite el presupuesto sale solo, de inmediato. Lo que no, se retiene, y cuando toca el siguiente envío todo lo retenido sale como **un** resumen:

```
7 more alarms raised in the last 12 s:
- [High] Line 3 Stopped
- [Critical] Boiler Trip
...
```

No se pierde ninguna alarma: el resumen nombra todas, hasta 25, y cuenta el resto ("...and 13 more"). Es tan grave como la peor alarma que incluye, y el evento de auditoría lista el id de cada alarma que representó. No tiene botón Reconocer, porque no hay una sola alarma que pueda reconocer. Si solo se retuvo una alarma, sale como ella misma, con su botón y todo. Una vez que se están reteniendo alarmas, las nuevas se unen al lote aunque el presupuesto haya vuelto, de modo que un resumen nunca llega después de una alarma activada más tarde que todas las que contiene. Al apagar, todo lo que siga retenido sale de golpe, por encima del presupuesto: la elección entonces es entre un envío de más y alarmas de las que nadie llega a enterarse.

El presupuesto es por canal, así que una avalancha que deja el relé SMTP en cola no retrasa a ntfy, y el umbral de cada canal sigue aplicándose: una alarma Baja nunca acaba en el resumen de un canal configurado para Alta y superiores.

## Reintentos

Un envío que recibe un 429, un 5xx o ninguna respuesta (rechazado, reiniciado, agotado el tiempo) se reintenta, hasta tres intentos en total, todos dentro de los 30 segundos desde el primero. Cuando el receptor indica cuánto esperar (`Retry-After`, en segundos o como fecha), se espera ese tiempo; si no, un segundo y luego dos. Si un receptor pide más de los 30 segundos que quedan, no se espera: el fallo se informa ya, indicándolo. Pasados 30 segundos, es mejor informar de que un aviso que no salió ha fallado, en el registro y en la auditoría, que reintentarlo en silencio durante minutos mientras la alarma sigue ahí.

Cualquier otro 4xx (un token erróneo, un tema en el que el usuario no puede escribir, una solicitud mal formada) nunca se reintenta. Será la misma respuesta cada vez hasta que alguien corrija la configuración, y Discord bloquea la IP que sigue enviando solicitudes que ya rechazó.

`POST /api/notify/test` hace exactamente un intento por canal. Una prueba pregunta qué hace el canal ahora mismo, y un reintento haría que un receptor inestable pareciera estar bien.

## Enlaces de reconocimiento

El botón Reconocer de una notificación de ntfy es una solicitud a `POST /api/notify/ack/{token}` en `HOTLOOP_PUBLIC_URL`. La persona que lo pulsa a las 03:00 no ha iniciado sesión en nada, así que **el token es toda la autorización**. Eso solo funciona si el token es infalsificable, estrecho, de un solo uso y de corta vida, y cada una de esas cosas se aplica:

- **Infalsificable.** El token es una afirmación (qué alarma, cuándo se activó, qué canal, cuándo caduca el enlace) más un HMAC-SHA256 de ella con un secreto del servidor. Cambie un byte, o firme con cualquier otra clave, y se rechaza. El secreto es `HOTLOOP_NOTIFY_ACK_SECRET` si lo configura (32 caracteres como mínimo; `openssl rand -hex 32`). Si no, HotLoop genera 32 bytes aleatorios la primera vez que los necesita y los guarda en su base de datos (la tabla `settings`, clave `notify.ackSecret`), de modo que los enlaces siguen funcionando tras un reinicio y todas las réplicas coinciden. Nunca se muestra en la pantalla de ajustes ni en ninguna respuesta de la API. Está en las copias de seguridad de la base de datos, como todo lo demás que contiene; si eso es un problema para usted, configure la variable desde un Secret de Kubernetes (`notify.ackSecret.existingSecret` en el chart), y nunca toca la base de datos. Cambiar el secreto invalida todos los enlaces ya enviados, que es también la forma de revocarlos todos a la vez.
- **Estrecho.** La afirmación nombra una alarma **y el momento en que se activó**. Un botón del disparo de ayer de la misma alarma no puede reconocer el de hoy, que nadie ha visto aún: el motor comprueba, bajo el mismo bloqueo que el reconocimiento, que la activación actual de la alarma es la de la afirmación (`alarm.Engine.AckOccurrence`). El enlace puede reconocer y nada más. No puede posponer, normalizar, escribir un tag ni leer nada, así que lo peor que puede hacer un enlace filtrado es exactamente lo que habría hecho pulsar el botón.
- **De un solo uso.** El primer uso de un enlace para una ocurrencia se registra en la base de datos (`notify_ack_links`), y todos los usos posteriores se rechazan, incluso cuando la alarma necesita reconocerse otra vez sin una nueva activación (pospuesta mientras seguía en alarma y reactivada, vuelve sin reconocer). El estado propio de la alarma no basta para esto; el registro sí.
- **De corta vida.** Caduca, por defecto 12 horas después de enviarse (`HOTLOOP_NOTIFY_ACK_TTL`, como máximo 168 h). Lo bastante largo para "lo miro cuando llegue", lo bastante corto para que una captura de pantalla de una notificación no sea una credencial permanente.

Una pulsación correcta es un reconocimiento ISA-18.2 normal a través del motor de alarmas, auditado exactamente como uno hecho desde la pantalla de alarmas: un evento de alarma y una entrada del registro del sistema con el actor `notify:ntfy` y la nota "acknowledged from the ntfy notification". Las acciones HTTP de ntfy no dicen qué teléfono pulsó el botón, así que no hay ningún nombre de persona que añadir. Cuando varias personas comparten un tema, la auditoría dice que fue el teléfono, no quién. El bot de Discord conoce al usuario y lo anota (consulte "Discord").

Cada rechazo se responde con lo que salió mal y se registra en el registro del sistema bajo `notify:<channel>` (o `notify:ack-link` para un token demasiado dañado para decir qué canal lo envió), porque un botón que no hace nada en silencio no se distingue de uno que nadie pulsó:

| Respuesta | Motivo |
|---|---|
| 403 | Falsificado, alterado o firmado con otro secreto |
| 410 | Auténtico pero caducado |
| 409 | Ya usado, o la alarma se activó de nuevo desde entonces, o no queda nada por reconocer |
| 404 | La alarma ya no existe, o los enlaces de reconocimiento están desactivados |

El token nunca se registra, nunca se incluye en un evento de auditoría y nunca lo devuelve ninguna API: mientras es válido es una credencial. Sí está en el mensaje de ntfy, necesariamente, así que cualquiera que pueda leer su tema de ntfy puede pulsar el botón. Bloquee el tema.

El endpoint responde con `Access-Control-Allow-Origin: *` para que el botón funcione también desde la app web de ntfy, que lo pulsa desde su propio origen. Eso no regala nada: nada en esta ruta lee una cookie ni una sesión.

## Escalado

Nadie reconoció la alarma en N minutos, así que se avisa a la siguiente persona. El primer aviso sale exactamente como siempre, a cada canal cuyo umbral cumpla la alarma. El escalado es lo que pasa después, si la alarma sigue ahí sin reconocer. Un aviso que llegó a un teléfono que nadie tenía en la mano es el fallo para el que existe esto: a las 03:00 la persona de guardia duerme, y la alarma no debe esperarla.

Lo configura en **Ajustes, Escalado de alarmas**, o por la API (`GET` y `PUT /api/notify/escalation`). Es solo para administradores, porque guarda los temas de ntfy de las personas y decide a quién se despierta. A diferencia de los canales, que se leen del entorno cuando arranca HotLoop, la política son datos que usted edita y surte efecto al guardarla. Los canales que puede usar son los que la instalación ya configuró. No se añade nada nuevo a la lista de cuatro, más el webhook y el correo.

### La política

| Campo | <span class="sr-only">Detalles</span> |
|---|---|
| `enabled` | Desactivada hasta que la active. Una política desactivada no escala nada |
| `minPriority` | La alarma menos grave que escala: `critical`, `high`, `medium` o `low`. Por defecto `high`. Una alarma Media que lleva una hora parada es una orden de trabajo, no una llamada a las 03:00 |
| `contacts` | Las personas. Cada una tiene un `name` y un `ntfyTopic`, `emails`, o ambos. Hasta 50 |
| `steps` | Hasta 10. Cada uno tiene `afterMinutes` (de 1 a 1440) y a quién avisar: `contacts` por nombre, `channels` por nombre, o ambos |
| `repeatEveryMinutes`, `repeatTimes` | Tras el último paso, volver a enviarlo con esta frecuencia, tantas veces más (como máximo 20). Ambos en cero para no repetir |

Una **persona** recibe una notificación propia. Su `ntfyTopic` es un tema del servidor ntfy en el que este HotLoop ya publica, con el mismo acceso, así que su teléfono se suscribe a un tema que es solo suyo. Sus `emails` salen por el relé SMTP que HotLoop ya tiene. Una persona con tema necesita ntfy configurado, y una con dirección necesita el correo configurado, y la política se rechaza diciéndolo si no lo están. En un servidor al que cualquiera pueda llegar, un tema es una contraseña: hágalo largo y aleatorio. La API muestra los temas a los administradores y a nadie más, y nunca aparecen en el libro de registro, el registro del sistema ni un error.

Un **canal** en un paso es uno de la propia instalación (`ntfy`, `gotify`, `smtp`, `webhook`, `discord-webhook`, `discord`) y llega a quien esté en él: el canal de Discord compartido, una app de Gotify que comparte un equipo, un webhook hacia algo que avisa. La política se rechaza si un paso nombra uno que este HotLoop no ha configurado, y la respuesta lista los que sí tiene.

### Cuándo sale cada cosa

Un paso vence `afterMinutes` después del anterior, y el primer paso `afterMinutes` después de que se activó la alarma. Es una suma desde la activación, no desde que terminó el último envío, así que un relé lento o un reinicio no alargan el calendario que escribió. Con pasos de 5 y 10 y una repetición de 15 minutos, dos veces:

```
 0 min  alarm raised: the first page, as always
 5 min  step 1
15 min  step 2
30 min  step 2 again (repeat 1)
45 min  step 2 again (repeat 2), and that is the last
```

### Qué lo detiene

La cadena es para una ocurrencia de una alarma, y se detiene, con una fila que dice por qué, cuando ocurre cualquiera de estas cosas:

- **Alguien la reconoce.** Desde cualquier sitio: la pantalla de alarmas, el botón Reconocer de ntfy o Discord, la API, una automatización. Todos terminan en el motor de alarmas, y antes de que salga cada paso el escalador pregunta al motor si esta ocurrencia sigue sin reconocer. Un gancho que llegue tarde no puede hacer que avise de una alarma que alguien ya atendió.
- **Vuelve a la normalidad.** La alarma sigue en la lista necesitando que alguien la reconozca, pero nadie se despierta por algo que se arregló solo. Es una decisión que tomamos a propósito; cambie el umbral o los pasos si quiere otra.
- **Se pospone.**
- **Se activa otra vez.** Es una ocurrencia nueva con su propia cadena, contada desde su propia activación. La cadena de ayer nunca avisa de la alarma de hoy.

Una alarma que alguien atiende antes de que venza el paso 1 no deja ningún rastro en el historial de escalado, que es el sistema funcionando.

### Lo que llega

Un escalado es la propia notificación de la alarma con el título cambiado y una línea añadida:

```
NOT ACKNOWLEDGED 15 min: Boiler Trip
Nobody has acknowledged this alarm in 15 minutes (step 2 of 4). boiler/Pressure hi 90 (now 95)
```

Conserva la prioridad de la alarma, así que una Crítica sigue siendo prioridad máxima en Android. Lleva el mismo botón Reconocer firmado que el primer aviso en ntfy y Discord (consulte "Enlaces de reconocimiento"), de modo que la persona a la que despierta puede reconocer desde donde se le avisó. Gotify y el correo no tienen botón. Un webhook recibe el JSON habitual de HotLoop con `event` igual a `escalated`.

Un canal compartido tiene su ritmo como cualquier otro (consulte "Límites de frecuencia y resúmenes"), así que una caída de tensión que deja cuarenta alarmas sin reconocer escala como un solo resumen, "40 alarms nobody has acknowledged", no cuarenta avisos y un bloqueo. La notificación propia de una persona es un envío aparte.

### El registro de auditoría

Cada escalado es una fila en el historial propio de la alarma, que es lo que lee el [libro de registro](/es/iot/logbook/), así que aparece allí sin configurar nada más, archivada bajo la alarma con el actor `escalation`:

```
alarm Boiler Trip escalated: boiler/Pressure hi 90 (now 95) (note: step 1 of 2: nobody acknowledged it in 5 min; notified Ana (email), Ana (ntfy))
alarm Boiler Trip escalation-ended: boiler/Pressure hi 90 (now 95) (note: escalation stopped after 1 sent: acknowledged by notify:ntfy)
```

`GET /api/alarms/events` y el tipo `alarm` del libro de registro llevan las mismas filas como tipos `escalated` y `escalation-ended`. Un paso que no llegó a nadie lo dice en mayúsculas (`NOBODY WAS REACHED`) con cada fallo a continuación, y la cadena sigue al siguiente paso de todos modos: un relé caído no debe detener el aviso que sale por otra vía. Guardar la política queda en el registro del sistema sin los temas.

### Reinicios y dónde se ejecuta

Las cadenas viven en memoria, así que un reinicio a las 03:00 en mitad de una no puede hacerla perder. Cuando HotLoop arranca, mira cada alarma aún sin reconocer, lee cuántos pasos dicen las filas de auditoría que salieron para esa ocurrencia y sigue desde ahí: no vuelve a enviar el paso 1 y no se salta el paso 2. Un paso que venció mientras HotLoop estaba caído sale en los primeros segundos tras volver. Un paso que estaba en curso cuando se mató el proceso puede salir dos veces, que es el lado correcto del error para una alarma.

Una política guardada se aplica a las alarmas activadas después de guardarla. Un reinicio recoge todas las alarmas aún sin reconocer, se activaran cuando se activaran.

El Gateway lo ejecuta. Un ayudante `--mcp-stdio` no, así que una alarma nunca se escala desde dos procesos.

## TLS en el canal SMTP

El canal pasa a TLS mediante STARTTLS automáticamente siempre que el relé anuncie la extensión, sin importar ningún ajuste de abajo. No es un comportamiento opcional que haya que activar: `net/smtp.PlainAuth` de Go se niega a transmitir un usuario y una contraseña por una conexión que no sea ya TLS (o hacia un servidor que se llame literalmente `localhost`), y prácticamente todo proveedor real que exige autenticación, Gmail, SendGrid, Mailgun, el relé de un proveedor de internet, exige STARTTLS en el puerto 587 o TLS implícito en el 465 (véase abajo) para llegar a ese punto. Un relé sin autenticación configurada, accesible en una red aislada, puede no ofrecer STARTTLS en absoluto, y este canal no lo exige en ese caso.

`HOTLOOP_NOTIFY_SMTP_TLS` no activa la mejora, convierte su *ausencia* en un fallo duro: si está activado y el relé no anuncia STARTTLS, `Send` se niega antes de intentar `AUTH`, en lugar de autenticarse en texto plano contra un relé que simplemente resulta accesible como `localhost`. `HOTLOOP_NOTIFY_SMTP_TLS_SKIP_VERIFY` omite la verificación del certificado en la mejora, la misma salida de emergencia que ya ofrecen `HOTLOOP_EDGE_PUBLISH_TLS_SKIP_VERIFY` y `HOTLOOP_FLEET_TLS_SKIP_VERIFY` para sus propias conexiones MQTT, para un relé que presenta un certificado autofirmado.

### TLS implícito, puerto 465

Un relé en el puerto 465 espera que toda la conexión sea TLS desde el primer byte (RFC 8314), no un saludo en texto plano y una mejora. HotLoop antes solo hacía la mejora, así que en el 465 lo primero que decía era texto plano a un relé que esperaba un saludo TLS, y el envío moría. Ahora **el puerto 465 es TLS implícito** y todos los demás puertos son STARTTLS como antes, sin ningún ajuste que tocar:

```
HOTLOOP_NOTIFY_SMTP_PORT=465
```

Si un relé hace TLS implícito en un puerto propio, o habla STARTTLS en el 465, `HOTLOOP_NOTIFY_SMTP_IMPLICIT_TLS` indica cuál, `true` o `false`, y prevalece sobre el puerto. En el chart de Helm configúrelo en `extraEnv`. Todo lo demás es igual en ambos: el usuario y la contraseña van por la conexión cifrada, `HOTLOOP_NOTIFY_SMTP_TLS` se cumple con ella (no hay nada que exigir) y `HOTLOOP_NOTIFY_SMTP_TLS_SKIP_VERIFY` omite la comprobación del certificado en su acuerdo. El certificado del relé se comprueba salvo que lo desactive. Los informes programados usan los mismos ajustes de relé y, por tanto, la misma regla.

Si el acuerdo falla, el error lo dice y nombra `HOTLOOP_NOTIFY_SMTP_IMPLICIT_TLS=false`, que es lo que necesita un relé que empieza en texto plano.

Probado contra una librería de servidor SMTP real con un oyente solo TLS, y contra Mailpit ejecutado con `--smtp-require-tls`, la versión fijada del laboratorio v1.31.2. No verificado contra el punto 465 de un proveedor comercial.

## Una sola ruta SMTP, compartida con los informes programados

Desde la versión 4.14.0 el canal de alarmas envía mediante `notify.SendMessage`, una función general que envía un mensaje, con adjuntos opcionales, a una lista de destinatarios. Los informes programados (consulte [Informes programados](/es/gateway/reports/)) envían sus archivos CSV y HTML por la misma función y los mismos ajustes de relé (`HOTLOOP_NOTIFY_SMTP_HOST`, `_PORT`, `_USERNAME`, `_PASSWORD`, `_FROM`, `_TLS`, `_TLS_SKIP_VERIFY`), de modo que hay un único lugar que marca, mejora con STARTTLS, autentica y decide qué puede contener una cabecera. Solo se comparte el relé: `HOTLOOP_NOTIFY_ENABLED`, `HOTLOOP_NOTIFY_SMTP_ENABLED` y `HOTLOOP_NOTIFY_SMTP_TO` son de las alarmas, y un relé configurado para informes no activa el canal de alarmas.

Dos comportamientos del correo de alarma cambiaron, ambos hacia la seguridad. El remitente y cada destinatario se validan ahora como direcciones simples antes de marcar nada, cuando antes una mal formada fallaba en el relé. Y un asunto con caracteres no ASCII se envía como palabra codificada RFC 2047 en lugar de UTF-8 en bruto. Un nombre de alarma que contenga un carácter de control se aplana a espacios en lugar de rechazarse, porque un aviso tiene que salir se llame como se llame la alarma.

## Umbrales de prioridad

Cada canal tiene su propio `MinPriority`, la prioridad de alarma menos grave por la que todavía se dispara. `model.AlarmPriority` va de 1 (Crítica, la más grave) a 4 (Baja), así que "Alta y superiores" es `MinPriority = 2`: una alarma cumple el umbral de un canal cuando su propio número de prioridad es menor o igual que el umbral. Un webhook configurado solo para Crítica y un relé SMTP configurado para Media y superiores pueden vigilar el mismo motor de alarmas y dispararse con conjuntos de alarmas totalmente distintos; nada exige que coincidan.

## Lo que no es

**No es una recarga en caliente de los canales.** Los canales se leen una vez, de la configuración, al arrancar el proceso, igual que `EdgePublishConfig` y `FleetConfig`. Cambiar `HOTLOOP_NOTIFY_*` necesita un reinicio para surtir efecto, y en este MVP no hay API para añadir o quitar un canal en ejecución. La política de escalado es la excepción: a quién se avisa después, y cuándo, son datos que usted edita y surten efecto al guardarlos (consulte "Escalado").

**No es una tabla propia.** Cada intento de notificación, con éxito o fallido, se escribe mediante `runtime.Manager.Event`, el mismo mecanismo genérico de eventos de auditoría por el que ya pasan todas las acciones de alarmas y de flota. No hizo falta inventar una tabla `notifications` dedicada para una función de este tamaño; el registro del sistema ya responde a "se envió una notificación y funcionó".

**No es una cola duradera.** Los reintentos están acotados (tres intentos, 30 segundos, consulte "Reintentos") y las alarmas retenidas viven en memoria hasta que sale su resumen. Un aviso que sigue fallando se registra y se audita y el despachador sigue adelante. Una alarma que sigue activada porque nadie la reconoció sigue visible en la pantalla de alarmas y en `alarm_events` llegue o no un aviso: la notificación es una comodidad sobre el sistema de alarmas, no un sustituto.

## Configuración

| Variable | Por defecto | <span class="sr-only">Detalles</span> |
|---|---|---|
| `HOTLOOP_NOTIFY_ENABLED` | `false` | La función está desactivada hasta que se configure esto |
| `HOTLOOP_NOTIFY_WEBHOOK_ENABLED` | `false` | |
| `HOTLOOP_NOTIFY_WEBHOOK_URL` | n/a | Obligatoria cuando el canal de webhook está habilitado. Debe ser `http://` o `https://` |
| `HOTLOOP_NOTIFY_WEBHOOK_MIN_PRIORITY` | `high` | `critical`, `high`, `medium`, `low` o `1`-`4` |
| `HOTLOOP_NOTIFY_SMTP_ENABLED` | `false` | |
| `HOTLOOP_NOTIFY_SMTP_HOST` | n/a | Obligatoria cuando el canal SMTP está habilitado |
| `HOTLOOP_NOTIFY_SMTP_PORT` | `25` | |
| `HOTLOOP_NOTIFY_SMTP_USERNAME` / `_PASSWORD` | n/a | Opcional. Omita ambas para un relé anónimo |
| `HOTLOOP_NOTIFY_SMTP_FROM` | n/a | Obligatoria cuando el canal SMTP está habilitado |
| `HOTLOOP_NOTIFY_SMTP_TO` | n/a | Obligatoria cuando el canal SMTP está habilitado. Direcciones separadas por comas |
| `HOTLOOP_NOTIFY_SMTP_TLS` | `false` | Exige que el relé ofrezca STARTTLS; consulte "TLS en el canal SMTP" arriba, STARTTLS se usa automáticamente siempre que se ofrece, sin importar este ajuste |
| `HOTLOOP_NOTIFY_SMTP_TLS_SKIP_VERIFY` | `false` | Omite la verificación del certificado en la mejora STARTTLS, o en el acuerdo de TLS implícito. Opción por instalación; nunca la active por defecto |
| `HOTLOOP_NOTIFY_SMTP_IMPLICIT_TLS` | `true` en el puerto 465, si no `false` | TLS desde el primer byte en lugar de STARTTLS; consulte "TLS implícito, puerto 465". Configúrelo para anular el puerto |
| `HOTLOOP_NOTIFY_SMTP_MIN_PRIORITY` | `high` | Los mismos valores que los del webhook |
| `HOTLOOP_NOTIFY_NTFY_ENABLED` | `false` | |
| `HOTLOOP_NOTIFY_NTFY_URL` | none | Obligatoria. Solo el servidor, `https://ntfy.example.com`, sin ruta |
| `HOTLOOP_NOTIFY_NTFY_TOPIC` | none | Obligatoria. De 1 a 64 letras, dígitos, `-` y `_`. En un servidor público es la contraseña |
| `HOTLOOP_NOTIFY_NTFY_TOKEN` | none | Un token de acceso de ntfy (`tk_...`), enviado como token bearer |
| `HOTLOOP_NOTIFY_NTFY_USERNAME` / `_PASSWORD` | none | Autenticación básica en lugar de un token. No ambos |
| `HOTLOOP_NOTIFY_NTFY_ACK` | `true` | Pone un botón Reconocer en cada alarma (necesita `HOTLOOP_PUBLIC_URL`) |
| `HOTLOOP_NOTIFY_NTFY_MIN_PRIORITY` | `high` | Los mismos valores que los del webhook |
| `HOTLOOP_NOTIFY_GOTIFY_ENABLED` | `false` | |
| `HOTLOOP_NOTIFY_GOTIFY_URL` | none | Obligatoria. `https://gotify.example.com` |
| `HOTLOOP_NOTIFY_GOTIFY_TOKEN` | none | Obligatoria. El token de aplicación que Gotify le dio para HotLoop |
| `HOTLOOP_NOTIFY_GOTIFY_MIN_PRIORITY` | `high` | Los mismos valores que los del webhook |
| `HOTLOOP_NOTIFY_DISCORD_WEBHOOK_ENABLED` | `false` | |
| `HOTLOOP_NOTIFY_DISCORD_WEBHOOK_URL` | none | Obligatoria. La URL que da Copiar URL del webhook de Discord. Toda ella es la contraseña |
| `HOTLOOP_NOTIFY_DISCORD_WEBHOOK_CRITICAL_ROLE` | none | Un id de rol al que mencionar en alarmas críticas |
| `HOTLOOP_NOTIFY_DISCORD_WEBHOOK_MIN_PRIORITY` | `high` | Los mismos valores que los del webhook |
| `HOTLOOP_NOTIFY_DISCORD_BOT_ENABLED` | `false` | |
| `HOTLOOP_NOTIFY_DISCORD_BOT_TOKEN` | none | Obligatoria. El token del bot, solo, sin `Bot ` delante |
| `HOTLOOP_NOTIFY_DISCORD_BOT_CHANNEL` | none | Obligatoria. El id del canal en el que publicar |
| `HOTLOOP_NOTIFY_DISCORD_BOT_ACK_ROLES` | none | Ids de rol separados por comas cuyos miembros pueden pulsar Reconocer. **Vacío es nadie** |
| `HOTLOOP_NOTIFY_DISCORD_BOT_SHELVE_ROLES` | none | Lo mismo para Posponer. **Vacío es nadie** |
| `HOTLOOP_NOTIFY_DISCORD_BOT_USERS` | none | `discordUserId=hotloopUser`, separados por comas: cuyas acciones se registran con su nombre de HotLoop |
| `HOTLOOP_NOTIFY_DISCORD_BOT_SHELVE` | `1h` | Cuánto pospone Posponer. Como máximo `24h` |
| `HOTLOOP_NOTIFY_DISCORD_BOT_CRITICAL_ROLE` | none | Un id de rol al que mencionar en alarmas críticas |
| `HOTLOOP_NOTIFY_DISCORD_BOT_MIN_PRIORITY` | `high` | Los mismos valores que los del webhook |
| `HOTLOOP_NOTIFY_DISCORD_API_URL` | `https://discord.com/api/v10` | Solo para enviar las solicitudes del bot por un proxy |
| `HOTLOOP_NOTIFY_<CHANNEL>_BURST` / `_REFILL` | por canal | El límite de frecuencia; consulte "Límites de frecuencia y resúmenes". `<CHANNEL>` es `WEBHOOK`, `SMTP`, `NTFY`, `GOTIFY`, `DISCORD_WEBHOOK` o `DISCORD_BOT` |
| `HOTLOOP_PUBLIC_URL` | none | La dirección a la que un teléfono llega a HotLoop, con la ruta base incluida. Necesaria para tocar para abrir y para el botón Reconocer |
| `HOTLOOP_NOTIFY_ACK_SECRET` | generado | Firma los enlaces de reconocimiento. Al menos 32 caracteres. Sin configurar: se genera una vez y se guarda en la base de datos |
| `HOTLOOP_NOTIFY_ACK_TTL` | `12h` | Cuánto tiempo funciona un enlace de reconocimiento. Como máximo `168h` |

En el chart de Helm están bajo `notify.ntfy`, `notify.gotify`, `notify.discordWebhook`, `notify.discordBot`, `notify.ackSecret`, `notify.ackTtl` y el `publicUrl` de nivel superior. Los tokens, las contraseñas y la URL del webhook de Discord van a un Secret que gestiona el chart, o ponga el suyo con `existingSecret`.

## API

| Ruta | Permiso | <span class="sr-only">Detalles</span> |
|---|---|---|
| `POST /api/notify/test` | `notify.test` | Envía ahora mismo una notificación de prueba sintética por cada canal configurado |
| `POST /api/notify/ack/{token}` | ninguno; el token es la autorización | Reconoce la ocurrencia de alarma para la que se emitió el token. Consulte "Enlaces de reconocimiento" |
| `GET /api/notify/escalation` | `notify.escalation` | La política de escalado, los canales que un paso puede nombrar y las cadenas abiertas ahora mismo. Consulte "Escalado" |
| `PUT /api/notify/escalation` | `notify.escalation` | Sustituye toda la política. Se rechaza con el motivo si un paso no nombra a nadie o nombra un canal que no está configurado |
| `GET /api/diagnostics` | `status.read` | Bajo `notify.channels`, el estado de cada canal: si Discord lo ha rechazado (y por qué, y desde cuándo), y la conexión Gateway del bot de Discord |

`notify.escalation` es solo para administradores de la misma forma. Leer la política también lo necesita, porque guarda los temas de ntfy de las personas.

`notify.test` es solo para administradores, concedido por el comodín que el rol de administrador ya lleva y deliberadamente no añadido a la lista de permisos del rol de operador: enviar un mensaje externo real y gastar la cuota que permita un proveedor de avisos o un relé SMTP se parece más a `fleet.restart` y `fleet.config` (también solo para administradores, también "hacer algo al exterior ahora mismo") que a una lectura, el mismo estrechamiento que esta aplicación ya aplica a esos dos.

La respuesta informa del resultado propio de cada canal en lugar de un único éxito o fallo de la solicitud:

```json
{
  "results": [
    {"channel": "webhook", "success": true},
    {"channel": "smtp", "success": false, "error": "dial smtp server mail.example.com:587: i/o timeout"}
  ]
}
```

## Qué se ha verificado y qué no

HotLoop se ha ejecutado contra equipos y servidores reales, y en bare metal el 2026-11-17.
