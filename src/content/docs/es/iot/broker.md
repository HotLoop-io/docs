---
title: "El broker MQTT integrado"
description: "Un broker en el mismo proceso, para que una caja pequeña sea toda la instalación, con sus listeners, cuentas y los ajustes que lo activan."
---

HotLoop puede ejecutar su propio broker MQTT dentro del proceso, desde 4.11.0, así que una instalación pequeña de HotLoop en una sola máquina no tiene nada extra que desplegar. Activado por defecto (`HOTLOOP_BROKER_ENABLED`), en el binario y en el chart de Helm. Escucha en :1883; si ese puerto lo ocupa otro broker de la máquina, el broker integrado queda inactivo y lo dice en el log, y HotLoop arranca (fije `HOTLOOP_BROKER_LISTEN_ADDR` a una dirección libre, o desactívelo). Un puerto que usted eligió y que no se puede abrir sigue siendo un error: un despliegue que ya ejecuta Mosquitto o EMQX no tiene nada a lo que apuntar esto, y arrancar un segundo broker junto a uno que ya existe no es un valor por defecto seguro que haya que adivinar.

## Por qué existe

La publicación en el edge (el Gateway actuando como nodo edge de Sparkplug) y la gestión de flota (el seguimiento de los edge relays registrados) se conectan ambas *hacia fuera* a un broker MQTT mediante `BrokerAddress`, y nunca han ejecutado uno ellas mismas. Eso está bien cuando un despliegue ya tiene un broker, ya sea una instancia de Mosquitto existente o una que corre junto a HotLoop por otros motivos. No está bien como la *única* opción: este proyecto existe para reducir el número de piezas móviles de las que depende una planta, y exigir una segunda pieza de infraestructura solo para tener un centro Sparkplug para un Gateway sería volver a meter una pieza móvil por la puerta de atrás.

Con `HOTLOOP_BROKER_ENABLED=true`, este mismo proceso escucha conexiones MQTT en su propia dirección. La publicación en el edge, la gestión de flota o el `HOTLOOP_EDGE_PUBLISH_BROKER` de un edge relay externo pueden apuntar todos a `localhost:1883` (dentro del clúster, a la dirección del Service del propio Gateway).

## Cuándo usarlo y cuándo no

**Úselo** para un solo Gateway, un puñado de edge relays y volúmenes de tráfico que un broker integrado, que comparte proceso con el historiador, el motor de alarmas y la API HTTP, pueda absorber con comodidad, el caso común al que apunta todo este proyecto: una planta, una caja, infraestructura mínima.

**No lo use** como sustituto de un broker de nivel de producción a escala real: varias aplicaciones host de Sparkplug independientes, una difusión muy alta, puenteo entre sitios o cargas que necesiten clustering, escalado horizontal o las herramientas operativas dedicadas de un broker (métricas detalladas, ACL dinámicas, ecosistemas de plugins) son motivos reales para ejecutar Mosquitto, EMQX u otro broker dedicado, y para apuntar a él los propios `EdgePublishConfig`/`FleetConfig` del Gateway como ya puede hacer cualquier otro despliegue. Este paquete no compite con ese caso de uso; existe para los despliegues que de otro modo no tendrían ningún broker.

## Inicios de sesión y a qué puede acceder cada uno

Entran tres tipos de inicio de sesión, y no son iguales.

**Los inicios de sesión creados en HotLoop** (Settings, MQTT, o `/api/broker/logins` en [La API HTTP](/es/iot/api/)) llevan reglas: los topics en los que el login puede publicar y los topics a los que puede suscribirse. `%u` en una regla es el nombre del propio login y `%p` el prefijo de descubrimiento. Parten de un perfil y usted puede editarlos después:

| Perfil | Publicar | Suscribirse | Para |
|---|---|---|---|
| `shelly` | `%u/#`, `shellies/announce` | `%u/#`, `shellies/command`, `%p/status` | un Shelly Gen2 o posterior, con el login con el nombre del prefijo de su topic MQTT |
| `esphome` | `%u/#`, `%p/+/%u/+/config`, `esphome/discover/%u` | `%u/#`, `%p/status`, `esphome/discover` | un nodo ESPHome, con el login con el nombre del nodo |
| `tasmota` | `tele/%u/#`, `stat/%u/#`, `tasmota/discovery/+/config`, `tasmota/discovery/+/sensors` | `cmnd/%u/#`, `cmnd/tasmotas/#` | un dispositivo Tasmota, con el login con el nombre de su topic |
| `zigbee2mqtt` | `%u/#`, `%p/#` | `%u/#`, `%p/status` | un puente Zigbee2MQTT, con el login con el nombre de su topic base |
| `integration` | nada | `#` | un panel, un historiador, usted con MQTT Explorer |
| `full` | `#` | `#` | cualquier cosa, toda la planta |

Ponga a un Shelly un login con el nombre de su prefijo de topic y podrá anunciarse e informar como él mismo, y nada más. No puede publicar en `cmnd/boiler/POWER`, no puede anunciar un dispositivo a nombre de otro y no puede suscribirse a `#` y leer la planta. El broker comprueba cada publicación, cada suscripción y cada mensaje en su camino hacia un suscriptor, así que una regla no se puede estirar con un comodín ingenioso. También se comprueba el testamento (last will) cuando el cliente se conecta: la biblioteca del broker publica los testamentos sin preguntar a nadie, así que un login cuyo testamento apunta a algo donde no puede publicar no entra. De lo contrario, un enchufe barato podría dejar un `ON` retenido en la caldera y desconectarse él mismo.

Un cambio en un login rige desde el siguiente paquete de ese cliente. Si estrecha un login, su dispositivo conectado pierde los topics en ese mismo momento; si borra uno, el cliente que siga conectado no puede hacer nada y no puede volver a conectarse. Las contraseñas son hashes bcrypt en `broker_logins`, que está en todas las copias de seguridad; la API nunca responde con ninguno de los dos.

Zigbee2MQTT es el caso raro: un puente anuncia todos los dispositivos de su radio, así que su perfil puede publicar en cualquier sitio bajo el prefijo. Ese es el trabajo del puente, y por eso la pantalla Discovered muestra quién anunció qué.

**`HOTLOOP_BROKER_USERS`** es la antigua lista de pares `user:password` (solo el primer dos puntos separa, así que una contraseña puede contener uno). Estos pueden hacer cualquier cosa, en todos los topics, exactamente como en 4.16 y 4.17. Es a propósito: nadie actualiza hacia una planta cuyo tráfico Sparkplug de repente rebota contra una ACL que nunca escribió. También significa que cada uno de esos logins es una llave de toda la planta. Pase los dispositivos a logins creados en HotLoop y deje los de variables de entorno para lo que realmente necesite todo: la flota, un edge relay, el publicador edge. Se comprueban en tiempo constante; un nombre de usuario con la contraseña equivocada se rechaza.

**Anónimo** (`HOTLOOP_BROKER_ALLOW_ANONYMOUS`, por defecto `false`) es cualquier cosa, para cualquiera que pueda llegar al puerto. Es una opción por despliegue para una LAN de confianza o un banco de pruebas, nunca algo que este proceso decida por sí solo que está bien, y la pantalla Discovered lo dice en rojo mientras está activado. No relaja nada para un cliente que sí envía un nombre de usuario: una contraseña equivocada sigue siendo una contraseña equivocada.

Un broker sin `HOTLOOP_BROKER_USERS` y con el modo anónimo desactivado arranca sin problema. Hasta que alguien cree un login en HotLoop, lo único que puede conectarse es HotLoop.

Los demás brokers son asunto suyo. En Mosquitto o EMQX, las ACL las aplica ese broker, el mismo límite que traza [Gestión de flota](/es/gateway/fleet/), y [el descubrimiento MQTT](/es/iot/mqtt-discovery/) tiene una ACL para el login del propio HotLoop allí.

## Descubrimiento y el login propio de HotLoop

Con el broker activado, HotLoop escucha en él a los dispositivos que se anuncian (vea [el descubrimiento MQTT](/es/iot/mqtt-discovery/)). El broker anota qué login y qué cliente publicó cada configuración de descubrimiento. La pantalla Discovered lo muestra, y un dispositivo aceptado desde un login que es anunciado por otro queda retenido para una persona, con una advertencia en el registro ("Kitchen re-announced by login garage-node; it was accepted from kitchen-node"). O alguien movió el dispositivo a un login nuevo, o un login se hace pasar por un dispositivo que no es. Una persona decide cuál.

El propio cliente de HotLoop en este broker (el listener de descubrimiento y los drivers de los dispositivos descubiertos) inicia sesión con un login que el broker crea en cada arranque y guarda solo en memoria. Puede hacer cualquier cosa. No hay nada que configurar para él, nada en disco y nada en una copia de seguridad; es uno distinto tras cada reinicio.

## TLS

Un listener TCP en claro (`HOTLOOP_BROKER_LISTEN_ADDR`, por defecto `:1883`) está siempre disponible una vez activado el broker. Definir `HOTLOOP_BROKER_TLS_ENABLED=true` con `HOTLOOP_BROKER_TLS_CERT_FILE` y `HOTLOOP_BROKER_TLS_KEY_FILE` añade un segundo listener independiente (`HOTLOOP_BROKER_TLS_LISTEN_ADDR`, por defecto `:8883`) que termina con ese certificado. Ambos listeners funcionan a la vez cuando TLS está activado, nada cierra el de texto en claro, así que un operador que quiera accesibilidad solo por TLS lo aplica en la capa de red (una NetworkPolicy, una regla de cortafuegos), igual que este chart ya deja las decisiones de exposición de red más amplias a `networkPolicy.ingress` en lugar de que la aplicación decida por su cuenta cuál de sus propios puertos puede alcanzarse.

A diferencia de la actualización STARTTLS dentro de la conexión del canal SMTP, el listener TLS del broker es un segundo socket independiente, la misma forma que usan Mosquitto, EMQX y la mayoría de los brokers MQTT para un puerto en claro junto a uno TLS, y el encaje más natural para MQTT, que (a diferencia de SMTP) no tiene una actualización dentro de la conexión ampliamente implementada.

Este paquete no genera un certificado propio, autofirmado ni de ningún otro tipo, porque nada aguas abajo acabaría confiando en uno que se inventara, así que un certificado real (de una CA interna, `cert-manager` o cualquier otra fuente) siempre lo aporta el operador.

## Configuración

| Variable | Por defecto | <span class="sr-only">Detalles</span> |
|---|---|---|
| `HOTLOOP_BROKER_ENABLED` | `false` | La función está desactivada hasta que se defina |
| `HOTLOOP_BROKER_LISTEN_ADDR` | `:1883` | El listener TCP en claro |
| `HOTLOOP_BROKER_TLS_ENABLED` | `false` | Añade un segundo listener TLS independiente |
| `HOTLOOP_BROKER_TLS_LISTEN_ADDR` | `:8883` | Solo se usa cuando TLS está activado |
| `HOTLOOP_BROKER_TLS_CERT_FILE` / `_KEY_FILE` | n/a | Obligatorios cuando TLS está activado |
| `HOTLOOP_BROKER_ALLOW_ANONYMOUS` | `false` | Opción por despliegue; nunca lo active por defecto |
| `HOTLOOP_BROKER_USERS` | ninguno | `user:password,user2:password2`. Cada uno puede hacer cualquier cosa; vea más arriba. Los logins con reglas se crean en HotLoop |
| `HOTLOOP_BROKER_DISCOVERY` | `true` | Escucha a los dispositivos que se anuncian; vea [el descubrimiento MQTT](/es/iot/mqtt-discovery/) |
| `HOTLOOP_BROKER_DISCOVERY_PREFIX` | `homeassistant` | El prefijo de topic bajo el que llegan los anuncios |

## Qué se ha verificado y qué no

HotLoop se ha ejecutado con equipos reales y servidores reales, y en hardware real el 2026-11-17.
