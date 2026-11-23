---
title: "Gestión de flota"
description: "Siga cada Edge Relay por sus nacimientos y muertes Sparkplug, y envíe rebirth, reinicio o un archivo de dispositivos nuevo sin ir hasta el equipo."
---

Gestión de flota, desde 4.7.0: el Gateway sigue a los edge relays registrados, sabe si están vivos y, para un operador autorizado, puede pedir a uno que haga rebirth, se reinicie o adopte una configuración recién enviada. Desactivada por defecto (`HOTLOOP_FLEET_ENABLED`): una instalación sin edge relays no tiene un broker al que apuntarla.

## Lo que no es

La gestión de flota tiene su propia conexión MQTT, separada, y responde a otra pregunta: si un edge relay *registrado* está vivo, no qué valor tiene uno de sus tags. Acoplarla al driver que sondea tags habría obligado a configurar un Dispositivo compatible solo para ver la flota, o a meterse en la contabilidad privada por nodo de ese paquete, que nunca se pensó para compartirse.

**No es automática.** Que un edge relay aparezca en el broker no lo convierte en miembro de la flota. La pertenencia se declara, con una fila en `fleet_members` creada mediante `POST /api/fleet`, la misma distinción que esta aplicación ya hace entre un tag que descubre un driver y un tag que alguien configura. Un NBIRTH de un grupo o nodo que nadie registró se anota en depuración y, por lo demás, se ignora.

## Cómo encaja todo

- **Presencia**, a partir de NBIRTH y NDEATH. Solo saliente desde el lado del relay: marca al broker, igual que siempre para publicar lecturas, así que funciona a través de NAT sin ninguna conexión entrante al relay.

Los comandos viajan en sentido contrario por Sparkplug NCMD, ampliando lo que un relay ya gestiona:

- Un empujón inocuo e idempotente.
- **Reinicio** (`Node Control/Reboot`, el nombre que usa la propia especificación Sparkplug, no uno inventado por esta aplicación): el relay publica su propio NDEATH ordenado y sale; su supervisor (el `Restart=always` de una unidad Quadlet, o el `restartPolicy: Always` por defecto de un Deployment) lo vuelve a levantar con lo que haya en disco en ese momento. No hay un camino de apagado nuevo: es la misma salida limpia que ya sigue el relay con su `SIGTERM`.

Como los comandos viajan por la misma conexión MQTT que el relay ya abre hacia fuera, enviar uno tampoco necesita ninguna conexión entrante al relay.

Un relay que aparece en línea se puede comandar, sin excepciones. Todo relay se suscribe a su tópico NCMD, y espera a que el broker lo confirme, antes de publicar un nacimiento, en cada conexión, de modo que "En línea" nunca va por delante de "alcanzable". El gestor se impone la misma regla de su lado: no se da por iniciado hasta que sus suscripciones NBIRTH y NDEATH están confirmadas, así que un relay que nace en el instante en que arranca el Gateway no se pierde. Si la ACL del broker rechaza la suscripción de cualquiera de los dos lados, ese lado se niega a arrancar y lo dice, en vez de funcionar medio sordo.

## Envío de configuración

Enviar lo que sondea un relay no va por NCMD, porque una métrica Sparkplug no está pensada para un archivo de dispositivos entero: va a un **tópico MQTT normal y retenido** por relay: `hotloop/edge-relay-config/<group>/<node>`. La entrega retenida es lo que hace que esto funcione sin una petición aparte de "ponme al día": lo último publicado allí se entrega de inmediato a cualquier cliente que se suscriba, incluido un relay que se reconecta tras estar desconectado o que arranca por primera vez.

El relay vuelve a validar al recibirlo: esta aplicación no puede dar por hecho que solo el Gateway publica en ese tópico, solo que ella misma debe negarse a publicar algo roto.

**Un archivo de dispositivos puede llevar credenciales, y un envío lo publica.** El bloque `config` de un dispositivo contiene con lo que su driver inicia sesión, como el `username` y el `password` de OPC UA (4.15.0), y el archivo se publica tal cual, retenido. Quien pueda suscribirse a `hotloop/edge-relay-config/#` puede leerlo, así que el broker necesita TLS y una ACL sobre ese tópico antes de enviar un archivo con credenciales. La API del Gateway oculta las credenciales de los dispositivos a todos los roles desde 4.15.1, pero un archivo enviado no está detrás de la API y esto no lo cambia. Consulte la [referencia de Edge Relay](/es/edge-relay/reference/#credenciales-en-el-archivo-de-dispositivos-4150) y [Autenticación y usuarios](/es/iot/authentication/#dónde-siguen-las-credenciales-en-claro).

**Un envío se aplica en vivo y nunca reinicia nada.** Hasta 4.17 un envío solo dejaba el archivo preparado, y para que contara hacía falta una segunda acción, un `POST /api/fleet/{id}/restart`, que cortaba la sesión del relay con el broker y todas las sesiones de dispositivo que tenía, para cambiar un solo tag. Ahora:

- **Un relay en marcha** valida el archivo, lo guarda y lo aplica en caliente: los dispositivos nuevos se conectan, los eliminados se desconectan, los modificados se reconectan, y cada dispositivo que no cambió mantiene su sesión. La sesión Sparkplug y la cola de reenvío siguen activas todo el tiempo. El nodo hace rebirth con su nuevo conjunto de métricas y primero pone a nulo las que quitó, para que un host no siga mostrando el último valor bueno de un dispositivo eliminado. La [referencia de Edge Relay](/es/edge-relay/reference/#qué-conserva-una-aplicación-en-vivo-y-qué-cambia) explica exactamente qué sale por el cable y por qué.
- **Un archivo que el relay rechaza** (no se puede analizar, no valida, no se puede guardar) no cambia nada en el relay, y el `/status` del relay lo indica en `config.rejected`. `GET /api/fleet` lo muestra para cada miembro con `statusUrl`, junto al resumen del archivo que está ejecutando, de modo que "lo envié" y "lo está ejecutando" son dos cosas que se pueden comprobar, no una que se da por supuesta. El Gateway también valida antes de publicar, así que en la práctica esto es un relay de una versión más nueva o más antigua que discrepa sobre las reglas, o algo distinto del Gateway publicando en el tópico.
- **Un relay desconectado** recibe el envío retenido en cuanto se conecta. Al arrancar espera un par de segundos por él antes de cargar su archivo local, así que arranca con la lista enviada en vez de empezar con la antigua y cambiar después.

Un archivo enviado se guarda en el volumen de datos del relay, no sobre su archivo local de dispositivos, y prevalece sobre el local hasta que se borra el envío. La [referencia de Edge Relay](/es/edge-relay/reference/#dónde-vive-un-archivo-enviado-y-qué-archivo-gana) tiene las reglas de precedencia y el error de 4.16.0 que las hizo necesarias.

**Retirar un envío** es `DELETE /api/fleet/{id}/config` (`fleet.config`, igual que enviar). Publica un mensaje retenido vacío en el tópico de configuración del miembro, que es como MQTT borra un valor retenido, de modo que ningún arranque posterior aplique el envío. Un relay conectado en ese momento descarta su archivo enviado y vuelve al local en vivo, igual que se aplica un envío, salvo que su archivo local no cargue, en cuyo caso conserva el enviado y lo dice. Un relay que estaba desconectado nunca oye el borrado (un mensaje vacío no se retiene), así que envíelo de nuevo cuando el relay vuelva.

## Qué ejecuta cada relay, y cómo se actualiza

Cada relay pone su versión y el resumen de su imagen en cada nacimiento, y también lo hace un Edge o un Gateway con la publicación edge activada, así que un equipo registrado aquí como miembro muestra lo mismo (métricas de cadena llamadas `Node Info/Version` y `Node Info/ImageDigest`, sin alias, de modo que un host Sparkplug que no las conoce las ignora). `GET /api/fleet` las muestra como `release` en cada miembro: `version`, `imageDigest` y `since`, cuando el Gateway oyó por primera vez esa compilación. Un relay anterior no informa de nada, y el Gateway no dice nada al respecto en vez de inventar una "compilación desconocida".

Cuando cambia la compilación de un miembro, el Gateway lo escribe en el registro del sistema como un evento `config` de ese miembro, con la versión y el resumen antiguos y nuevos en su detalle (`{"kind":"fleet.release",...}`). La primera compilación que oye también se registra, como la referencia contra la que se mide la siguiente. Sobrevive a un reinicio del Gateway, porque el último registro se lee de vuelta del log: un reinicio nunca inventa una actualización. Es la pista de auditoría de cada actualización que recibe un relay, por la vía que sea (el temporizador de Podman, una aprobación, `helm upgrade`, alguien en el equipo), porque el Gateway no provoca una actualización y solo puede informar de ella. Una etiqueta móvil es como se actualiza `:stable`, así que un resumen distinto bajo la misma versión también se registra, como "una imagen distinta de la misma versión".

`POST /api/fleet/{id}/update` (`fleet.update`, solo administradores) aprueba la actualización que un relay tiene retenida. Solo hace algo en un relay configurado para retener actualizaciones; cualquier otro relay registra que la ignoró. La petición no nombra ninguna imagen. Lo que esto hace y no hace en cada tipo de instalación está en la [referencia de Edge Relay](/es/edge-relay/reference/#actualizar-un-relay).

## Autorización de comandos

Dos capas, deliberadamente no una:

- **En la API**, un operador necesita `fleet.rebirth` para pedir un rebirth; reiniciar, aprobar una actualización o enviar una configuración requieren cada uno `fleet.restart`, `fleet.update` o `fleet.config`, concedidos solo al administrador. Un reinicio altera más un ciclo de sondeo en marcha que un empujón de rebirth, y enviar lo que sondea un relay se trata igual, el mismo estrechamiento que `alarms.ack` y `automations.trigger` ya modelan para otras acciones de "hazlo ya".
- **En el broker**, esta aplicación no puede imponer nada: la publicación de NCMD y el tópico de configuración deben restringirse ambos, mediante las ACL propias del broker, a las credenciales MQTT del propio Gateway. Sin eso, cualquiera que llegue al broker y conozca el grupo y el nodo de un relay puede publicar el mismo comando o configuración que esta función. Configúrelo al desplegar; no es opcional por estar fuera del código de esta aplicación.

## API

| Ruta | Permiso | <span class="sr-only">Detalles</span> |
|---|---|---|
| `GET /api/fleet` | `fleet.read` | Cada miembro registrado, con su presencia en vivo y, donde está configurado, un `/status` sondeado |
| `POST /api/fleet` | `fleet.write` | Crea o actualiza un miembro (un cuerpo con un `id` existente lo actualiza) |
| `DELETE /api/fleet/{id}` | `fleet.write` | Elimina un miembro registrado |
| `POST /api/fleet/{id}/rebirth` | `fleet.rebirth` | Publica `Node Control/Rebirth` |
| `POST /api/fleet/{id}/restart` | `fleet.restart` | Publica `Node Control/Reboot` |
| `POST /api/fleet/{id}/update` | `fleet.update` | Aprueba la actualización de imagen que retiene un relay (no hace nada en uno que no la retiene) |
| `POST /api/fleet/{id}/config` | `fleet.config` | Envía un archivo de dispositivos nuevo (cuerpo JSON sin procesar, validado antes de publicar); un relay en marcha lo aplica en vivo |
| `DELETE /api/fleet/{id}/config` | `fleet.config` | Borra el envío, de modo que el relay vuelve a su archivo local de dispositivos, en vivo si está conectado |

## Configuración

| Variable | Valor por defecto | <span class="sr-only">Detalles</span> |
|---|---|---|
| `HOTLOOP_FLEET_ENABLED` | `false` | La función está desactivada hasta que se defina |
| `HOTLOOP_FLEET_BROKER` | n/a | Obligatoria si está activada. Un host a secas, `host:port` o una URL completa |
| `HOTLOOP_FLEET_USER` / `_PASSWORD` | n/a | Credenciales del broker |
| `HOTLOOP_FLEET_TLS` | `false` | |
| `HOTLOOP_FLEET_TLS_SKIP_VERIFY` | `false` | Opción de cada despliegue; nunca la active por defecto |

## Qué se ha verificado y qué no

HotLoop se ha ejecutado contra equipos y servidores reales, y en hardware real el 2026-11-17.
