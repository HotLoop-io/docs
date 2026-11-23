---
title: "Referencia de Edge Relay"
description: "El nodo Sparkplug B sin interfaz que consulta y reenvía: qué hace, cada ajuste, la cola en disco, la configuración de flota y cómo se despliega."
---

El Edge Relay, desde la 4.6.0, es un segundo binario y funciona por sí solo: un nodo edge Sparkplug B que consulta y reenvía, sin base de datos, sin interfaz web, sin autenticación y sin ruta de escritura. Está hecho para correr en una Pi o en un PC industrial pequeño en el borde, reenviando todo lo que lee a un Gateway completo que corre en otro sitio con una base de datos real, por el mismo publicador Sparkplug B que añadió la 4.5.0.

La propia nota de la 4.5.0 lo decía: la publicación en el borde existía como una función que se podía activar dentro del proceso del Gateway completo, "todavía no la edición independiente y más ligera del Edge Relay". Esta es esa edición.

## Lo que no es

**No es un Gateway más pequeño con menos opciones.** Es un binario distinto con un conjunto de dependencias mucho menor. No lleva base de datos, interfaz web, autenticación, servidor ni cliente MCP, motor de automatización ni registro de entidades.

**No puede servir una interfaz, aceptar una escritura ni responder a una llamada de herramienta MCP.** Las tres necesitan algo que este binario no tiene a propósito: una identidad autenticada a la que atribuir la acción. Un edge relay no decide nada y no confirma nada a una persona; lee y reenvía.

**No se configura con una base de datos y no tiene API de configuración propia.** Los dispositivos y las etiquetas vienen de un archivo JSON local que se lee al arrancar, o de un archivo que el Gateway envía por el broker y que se aplica en vivo (vea [Envío de configuración](#envío-de-configuración-480)). Nada escucha en el relay una configuración nueva: la única entrada es la conexión al broker que ya abre hacia fuera.

## Cómo encaja todo

Por dentro reutiliza el motor de consulta real del Gateway, no una reimplementación: el mismo worker, la misma reconexión con espera progresiva y el mismo bucle de consulta que ya funcionan en producción dentro del Gateway corren aquí sin cambios. Lo que cambia es *adónde van la configuración y el historial*.

Todo lo que sigue a una consulta, el controlador, el bus de etiquetas, el publicador Sparkplug y la cola de reenvío en disco, es exactamente el mismo código que usa el Gateway cuando `HOTLOOP_EDGE_PUBLISH_ENABLED` está activo. En la página Edge publish se explica qué hace ese publicador: births, números de secuencia, almacenamiento durante una caída y reproducción al reconectar. Nada de eso cambió aquí; este binario es solo otra forma de llegar a la misma llamada `Offer()`.

## El archivo de dispositivos

```json
{
  "devices": [
    {
      "id": "press-01",
      "name": "Press 1",
      "protocol": "opcua",
      "address": "opc.tcp://press-01.local:4840",
      "enabled": true,
      "pollIntervalMs": 1000
    }
  ],
  "tags": [
    {
      "deviceId": "press-01",
      "name": "Zone1_Temp",
      "address": "ns=2;s=Zone1.Temp",
      "dataType": "float",
      "enabled": true
    }
  ]
}
```

Una etiqueta admite todo lo que admiten las del Gateway, `noData` incluido: una lista de valores crudos que significan "sin medición" (el 0x8005 de un registrador), cada uno con su motivo, de modo que un canal muerto aparece como erróneo en el relay y en el flujo Sparkplug en vez de como un número. Vea [Valores sin datos](/es/iot/protocols/#valores-sin-datos).

Los siete controladores de protocolo del Gateway vienen compilados: OPC UA, Modbus, MQTT/Sparkplug B, EtherNet/IP, S7comm, MTConnect y HTTP. Nada del formato del archivo de dispositivos es específico del edge relay.

### Discovery (4.18.10)

Un relay puede escuchar un broker MQTT en busca de dispositivos que se anuncian solos, igual que el Gateway (vea [Descubrimiento MQTT](/es/iot/mqtt-discovery/)), y leer y reenviar lo que oiga. Indique los brokers en el archivo de dispositivos:

```json
{
  "devices": [],
  "tags": [],
  "discovery": [
    {
      "id": "yard",
      "broker": "10.0.0.5:1883",
      "username": "hotloop",
      "password": "...",
      "prefix": "homeassistant",
      "listenOnly": true,
      "tasmota": true,
      "shelly": true
    }
  ]
}
```

`id` son de 1 a 63 letras minúsculas, dígitos y `-`, y no es `embedded`. `broker`, `username`, `password`, `useTls` y `insecureSkipVerify` son lo que admiten los ajustes MQTT del Gateway, comprobados por el mismo código. `prefix` vale `homeassistant` por defecto, y `tasmota` y `shelly` están activados. Un archivo que no nombra ningún broker no cambia nada en cómo funciona un relay.

Lo que oye se convierte en dispositivos y etiquetas, creados por el mismo código que ejecuta el Gateway (el formato `homeassistant/`, el propio de Tasmota, los estados de Shelly), y se consultan y reenvían por Sparkplug como cualquier otro. El id de un dispositivo se forma con el id del broker y con quién dice ser el dispositivo, siempre igual (`disc-<identity>-<hash>`), así que un relay que se reinicia nombra sus métricas igual. Un dispositivo aparece un par de segundos después de anunciarse, uno retirado sale del birth del nodo en un rebirth, y ninguno de los dos cuesta la sesión Sparkplug ni la cola de reenvío. Un archivo enviado que añada o quite un broker también se aplica en vivo.

**Nada de lo que descubre puede armarse.** No porque lo diga una comprobación. Toda etiqueta que crea el descubrimiento es de solo lectura, como en el Gateway; todo dispositivo que crea queda sin aceptar; en un relay no hay nadie que pueda aceptarlo; y un relay no tiene ruta de escritura alguna, así que un comando a un punto descubierto, o a cualquier punto, se rechaza antes de acercarse a un dispositivo. La prueba le pide a un relay con escrituras permitidas que accione una bomba descubierta y comprueba que el topic de comando de la bomba siguió en silencio.

Un dispositivo que sí puede mandar llega a un relay por el camino contrario: lo acepta en un Gateway, arma los puntos que quiera y envía el archivo. Cuando un archivo tiene un dispositivo que el relay también oye (el mismo id de broker, o la misma dirección, y la misma identidad), gana el archivo y no se crea la copia descubierta, así que un dispositivo nunca se reenvía dos veces.

`listenOnly` está activo salvo que lo desactive, y entonces el relay no publica nada en ese broker: ni el mensaje de birth que hace que un publicador se anuncie de nuevo, ni el `status_update` de un Shelly, ni la consulta de energía de un Tasmota. Un dispositivo que solo habla cuando cambia figura como desconocido hasta que lo hace. Si lo desactiva, eso es lo único que envía, a los topics que nombra DISCOVERY.md.

Un relay no guarda nada de lo que oyó. Las configuraciones de `homeassistant/` y de Tasmota quedan retenidas en su broker y vuelven al arrancar; un Shelly dice sus estados cuando algo cambia, así que un dispositivo que está callado desde que arrancó el relay no aparece hasta que habla. Eso, y no tener una base de datos donde recordar un dispositivo aceptado, es la diferencia con el Gateway.

`/status` indica, bajo `discovery`, para cada broker: si está escuchando y conectado, cuántos mensajes recibió, descartó y rechazó, cuántos problemas tiene, y el número de dispositivos y etiquetas que creó el descubrimiento. No dice dónde está un broker ni en qué topic ocurrió un problema.

### Credenciales en el archivo de dispositivos (4.15.0)

El controlador OPC UA del relay es el del Gateway, así que un dispositivo puede llevar un `username` y `password` de OPC UA (y las opciones de seguridad de [Protocolos y controladores](/es/iot/protocols/#opc-ua-seguridad-y-credenciales)) en su bloque `config`, y lo mismo uno de cualquier otro protocolo (contraseñas MQTT y HTTP, cabeceras HTTP, credenciales en una dirección). Están en claro en el archivo de dispositivos, y el relay no tiene API tras la que ocultarlas (la redacción de la API que se añadió al Gateway en la 4.15.1 no se aplica aquí; vea [Autenticación y usuarios](/es/iot/authentication/#dónde-siguen-las-credenciales-en-claro)), así que importa dónde está el archivo:

- **En el chart de Helm, use `devicesSecret`.** Los dispositivos definidos en los valores `devices` y `tags` del chart se renderizan en un ConfigMap, que puede leer cualquiera con permiso para leer ConfigMaps en el namespace, y quedan en el registro de la release de Helm. Para dispositivos con credenciales, ponga el archivo de dispositivos completo en un Secret bajo la clave `devices.json` y nómbrelo en `devicesSecret`; el Secret se monta en lugar del ConfigMap, que entonces no se crea.
- **Un archivo de dispositivos enviado también las lleva.** Un archivo enviado con `POST /api/fleet/{id}/config` se publica, retenido, en un topic MQTT, así que el broker debe llevar TLS y restringir quién puede leer `hotloop/edge-relay-config/#`; si no, quien pueda suscribirse a él puede leer todas las credenciales que contiene. El relay escribe el archivo enviado con modo `0600` en su volumen de datos (`/data/pushed-devices.json` en el chart y en la unidad Quadlet), así que también está en el PVC, no en un Secret.
- **Un dispositivo OPC UA seguro guarda un certificado y un almacén de confianza.** Viven en `/data/opcua-client-pki` (`HOTLOOP_OPCUA_CLIENT_PKI_DIR`), en el mismo volumen de persistencia que la cola de reenvío. Con la persistencia del chart desactivada es un emptyDir, de modo que cada pod nuevo crea un certificado nuevo y cada servidor seguro tiene que volver a confiar en él (vea "Persistence off" más abajo); un dispositivo anónimo en un canal sin seguridad no se ve afectado. Aprobar el certificado de un servidor es el mismo paso que en el Gateway, de `rejected/` a `trusted/`, hecho en el volumen del relay.

## Comandos remotos (4.7.0)

Dos comandos Sparkplug NCMD, ambos por la misma conexión que este relay ya abre hacia fuera, sin conexión entrante:

- **Restart** (`Node Control/Reboot`), desde la 4.7.0: el relay publica su propio NDEATH ordenado y sale, confiando en su supervisor (el `Restart=always` de una unidad Quadlet, o el `restartPolicy: Always` por defecto de un Deployment) para volver a levantarlo.

- **Update** (`Node Control/Update`): un operador que aprueba la actualización de imagen que un relay tiene retenida. Solo hace algo en un relay configurado para retener actualizaciones; vea [Actualizar un relay](#actualizar-un-relay).

Nada del lado del relay decide quién puede enviarlos; vea la página de gestión de flota para el gestor de flota del lado del Gateway que los envía, y el requisito de ACL del broker, que es el verdadero límite de autorización.

## Actualizar un relay

El Gateway no actualiza un relay. No puede: no tiene forma de entrar en la máquina, y el relay no puede reemplazar su propio contenedor, así que "actualización remota" significa cosas distintas según las dos formas de instalarlo, y esta página dice cuál, porque una promesa que la plataforma no puede cumplir es peor que ninguna.

**La regla es la que sigue toda caja HotLoop: seguir `:stable`, nunca fijar.** Un relay fijado a `4.17.0` es tan viejo como el día en que alguien lo instaló, y nadie se acuerda de volver a la planta a subirlo. Por eso la imagen que sigue un relay es `ghcr.io/hotloop-io/hotloop-edge-relay:stable`, y cada release mueve esa etiqueta. Lo que cambia es quién reinicia el relay con ella.

### Quadlet (una Pi o un PC industrial pequeño): se actualiza solo

La unidad de [`deploy/quadlet`](/es/install/quadlet/) sigue `:stable` y lleva la etiqueta que busca la actualización automática de Podman. Active el temporizador una vez por máquina:

```sh
sudo systemctl enable --now podman-auto-update.timer
```

Cuando salta el temporizador, Podman descarga `:stable` y, si el digest cambió, reinicia la unidad con la imagen nueva. Tres cosas hacen que sea seguro dejarlo solo, y las tres se comprobaron ejecutándolas, no leyendo:

- **Un relay que no puede volver se repone.** La unidad tiene un healthcheck (`/edge-relay --healthcheck`, porque la imagen no tiene shell ni curl para ejecutar uno) y le dice a systemd que no está arriba hasta que pasa. Si la imagen nueva nunca lo pasa, Podman devuelve la imagen anterior a `:stable` y arranca esa. Una release que no arranca cuesta unos minutos en una caja, no un relay que se queda caído. En Podman 4.9 (Ubuntu 24.04) `Notify=healthy` solo no lo consigue: se lee como un simple `true`, el relay se da por arriba en cuanto arranca su contenedor y Podman informa de la actualización como correcta mientras el relay está muerto. La unidad fija `--sdnotify=healthy` explícitamente por esa razón.
- **El Gateway ve cada actualización.** Un relay incluye su versión y el digest de su imagen en cada birth. La lista de flota del Gateway muestra ambos por relay y escribe una línea en el registro del sistema cuando cambia uno: lo que era, lo que es ahora y ambos digests. Esa es la pista de auditoría, y cubre una actualización por cualquier causa, incluido un operador en la caja.
- **Una actualización no toca los datos.** La cola de reenvío y un archivo de dispositivos enviado viven en el volumen de datos, que una imagen nueva no toca. Lo que se pierde es la consulta mientras el relay se reinicia, unos segundos como mucho.

El digest que informa un relay es lo que imprime `podman image inspect --format '{{.Digest}}'` en esa caja, que es lo que sigue la actualización automática. Podman puede conocer una imagen por más de un digest (los lista en `RepoDigests`) cuando un registro guarda un formato de manifiesto distinto del que usa, así que compárelo igual en todos los relays y no con la cabecera de un registro.

### Quadlet, reteniendo actualizaciones hasta que un operador apruebe (opcional)

Algunos sitios prefieren decidir cuándo: un relay en una línea que no puede parpadear durante un turno. Eso es `edge-relay-hold.conf`, un drop-in de systemd, y nunca es lo predeterminado. Con él el relay informa `"updateMode": "approve"`, el temporizador está apagado y nada se actualiza hasta que un admin envía `POST /api/fleet/{id}/update` desde el Gateway. Entonces el relay sale con estado 75, systemd lo arranca de nuevo con la imagen que tiene, y un trabajo aparte espera a que esté sano y ejecuta `podman auto-update`: la imagen nueva si la hay, con el mismo rollback, y un relay que parpadeó para nada si no la hay. Probado con una actualización real retenida 30 segundos mientras el relay seguía sin tocar, y luego tomada al aprobarla.

Sepa lo que cuesta. El temporizador tiene que estar apagado en toda la máquina, porque la actualización automática de Podman actúa sobre cada contenedor etiquetado y no se le puede decir que se salte uno; una caja que deba usarlo para otras cosas no puede retener este relay. Y el Gateway no puede decirle que hay una actualización esperando, solo lo que ejecuta cada relay ahora, así que compare la lista de flota con lo que es `:stable` antes de aprobar. Una aprobación no lleva imagen: al relay solo se le puede decir que se actualice a lo que sigue su propia unidad.

### Helm: usted ejecuta `helm upgrade`

Un pod no puede reemplazarse a sí mismo, y un Deployment lo cambia Helm, así que no hay actualización remota para el chart. El `image.tag` del chart es por defecto su `appVersion`, que es la release, de modo que:

```sh
helm repo update
helm upgrade edge-relay hotloop/hotloop-edge-relay --reuse-values
```

pasa el pod a la release nueva. La estrategia del chart detiene el pod viejo antes de arrancar el nuevo (`maxSurge: 0`, porque la cola de reenvío es un archivo de un solo escritor en un volumen), así que hay un hueco mientras sube. El Gateway sigue viendo la versión nueva en el siguiente birth del relay y registra el cambio. Con Helm un relay no informa de un digest de imagen (un contenedor no ve el suyo y Kubernetes no se lo da), solo de su versión. `Node Control/Update` no hace nada aquí y el relay lo dice en su registro; Helm es la aprobación.

### Lo que no está aquí, y por qué

- **Imágenes firmadas y una lista de digests permitidos.** El Gateway no puede imponer ninguna de las dos en una caja a la que no tiene acceso, y una comprobación que el relay hace sobre sí mismo es una que un relay comprometido se salta. Podman puede verificar firmas al descargar (`policy.json`), que es el lugar donde funciona; nada aquí configura esa política por usted, y `:stable` es de fiar como lo es cualquier etiqueta.
- **Despliegue escalonado.** Cada relay de una caja sigue la misma etiqueta con su propio temporizador, así que una flota se actualiza repartida en el tiempo del temporizador, no en oleadas, y el rollback de arriba es lo que limita una release mala. Para escalonar a propósito, retenga los sitios que deban esperar con el drop-in de retención y apruébelos en el orden que quiera.

## Envío de configuración (4.8.0)

Se puede enviar un archivo de dispositivos nuevo por un topic MQTT aparte, simple (no Sparkplug) y retenido. Vea la sección "Config push" de la página de gestión de flota para el lado del Gateway. Hasta la 4.17 un envío solo dejaba el archivo preparado y el relay seguía consultando la lista vieja hasta que algo lo reiniciaba. Eso convertía cada cambio de lo que consulta un relay en un reinicio del relay, de su sesión con el broker y de cada sesión de dispositivo que tenía, en una caja que debe estar meses sin que nadie la toque. Ahora un envío se aplica en el momento en que llega.

- Enviado mientras este relay está **en marcha**: los bytes se validan con las mismas reglas que aplica `LoadDeviceFile` al arrancar, se guardan en `HOTLOOP_EDGE_RELAY_PUSHED_FILE` (o sobre `HOTLOOP_EDGE_RELAY_DEVICES_FILE` cuando no está definido; vea más abajo) y se aplican en vivo. Guardado primero, a propósito: una lista que funcionó pero nunca se guardó volvería en silencio a la anterior en el siguiente arranque.
- **Un envío erróneo se rechaza y la lista vieja sigue funcionando.** Uno que no se pueda analizar, que no valide (un dispositivo duplicado, una etiqueta en un dispositivo que nadie declaró, un protocolo desconocido) o que no se pueda guardar no cambia nada: ni los dispositivos en marcha ni el archivo en disco. El registro dice por qué, y `/status` también, en `config.rejected`, de donde lo toma la pantalla de flota del Gateway.
- Enviado mientras el relay estaba **sin conexión**: no hay nada que lo reciba hasta el siguiente arranque, y entonces el relay da un par de segundos a un envío retenido para llegar *antes* de cargar su archivo de dispositivos local, así que arranca directamente con él. Un envío que llega pasados esos dos segundos se aplica en vivo como cualquier otro.
- El broker devuelve el envío retenido en cada reconexión. El relay conoce el archivo que ejecuta por su sha256, así que los mismos bytes al volver a llegar no cambian nada.

### Qué conserva una aplicación en vivo y qué cambia

El relay calcula qué cambió entre el archivo que ejecuta y el nuevo, dispositivo por dispositivo, y toca solo eso:

- **Un dispositivo que no cambió conserva su sesión.** La misma conexión TCP con el PLC, la misma suscripción OPC UA, sin huecos en sus lecturas.
- **Un dispositivo cambiado** (su dirección, protocolo, intervalo de consulta, timeout, bloque de configuración o etiquetas) se reconecta con la definición nueva.
- **Un dispositivo nuevo** se conecta y empieza a consultarse.
- **Un dispositivo eliminado** (o uno que ahora tiene `"enabled": false`) se desconecta.
- **La sesión Sparkplug sigue arriba.** Sin NDEATH, sin reconexión, el mismo bdSeq, y la cola de reenvío no se toca. Una recarga durante una caída del broker deja en la cola cada lectura almacenada; se vacían cuando vuelve el broker, igual que sin recarga.

En el cable, según Sparkplug B. El relay es un nodo edge y cada etiqueta es una métrica de nodo llamada `device/tag`, así que lo que cambia es el conjunto de métricas del nodo, y Sparkplug da a un nodo una sola forma de cambiarlo: un NBIRTH nuevo, que reemplaza al último por completo. Por tanto:

- **Las métricas que desaparecieron** (un dispositivo eliminado, una etiqueta eliminada o desactivada) se envían una vez más en un NDATA como null, y luego el nodo hace un rebirth sin ellas: misma sesión, mismo bdSeq, seq de vuelta a 0, el mismo rebirth que provoca `Node Control/Rebirth`. El null está porque un host puede conservar el último valor de una métrica que un birth nuevo omite, y el host Sparkplug del propio Gateway hace exactamente eso. Sin el null, una válvula que quitó del relay se quedaría para siempre en su última lectura buena, con aspecto sano.
- **Las métricas nuevas** entran en un birth con la primera consulta de su dispositivo, igual que toda métrica al arrancar. Un birth nunca nombra una métrica antes de que haya una lectura detrás.
- **Las lecturas de una etiqueta eliminada que aún están en la cola de reenvío** se descartan al vaciar la cola, con una línea de registro que las cuenta. El birth del nodo ya no lleva esa métrica, y Sparkplug no tiene una forma legal de enviar una que no lleva; enviarlas significaría usar un alias que ningún host conoció.

Editar a mano el archivo de dispositivos local sigue necesitando un reinicio: el relay lo lee al arrancar y cuando se borra un envío, y no lo vigila. Con el chart, eso es lo que hace de todos modos un `helm upgrade` que cambie `devices`.

### Dónde vive un archivo enviado y qué archivo gana

Las dos instalaciones admitidas montan el archivo de dispositivos local en solo lectura: el chart desde un ConfigMap (o Secret), la unidad Quadlet como bind `:ro`, y ambas con un sistema de archivos raíz de solo lectura. Hasta la 4.16.0 el relay escribía un envío justo al lado de ese archivo, así que en ambas instalaciones cada envío moría con

```
a pushed config was rejected; keeping the current one and continuing to run
error="write /etc/edge-relay/devices.json.tmp: open /etc/edge-relay/devices.json.tmp: read-only file system"
```

y el relay seguía consultando la lista vieja. El Gateway decía `config pushed`, el reinicio pasaba y nada cambiaba. Se arregló dándole al envío su propio sitio:

- **`HOTLOOP_EDGE_RELAY_PUSHED_FILE`** es donde se escribe un envío. El chart lo fija en `/data/pushed-devices.json` en el PVC (`pushedDevicesFile` en values.yaml), y la unidad Quadlet fija la misma ruta en su volumen de datos con nombre. Ambos sobreviven al contenedor, y el PVC sobrevive a una reprogramación. Esto último es deliberado: un emptyDir también sería escribible, pero desaparece en cuanto el pod se mueve, y un relay que vuelve en silencio a su lista de dispositivos vieja tras drenar un nodo es el mismo fallo con pasos extra.
- **El archivo enviado gana.** Al arrancar, el relay carga el archivo enviado si existe, y el local solo si no. Eso vale tras un reinicio, tras una reprogramación, tras perder el broker el envío retenido (un reinicio de Mosquitto sin persistencia) y tras un `helm upgrade` que cambie `devices` o `tags`. El envío es el cambio más nuevo y deliberado, y el broker devolvería la copia retenida en el siguiente arranque de todos modos, así que dejar ganar al archivo local solo duraría un reinicio. Las primeras líneas del registro dicen de qué archivo arrancó: `booting from the pushed device file; the local one is ignored until the push is cleared`.
- **Volver al archivo local** (los `devices` del chart, o `/etc/edge-relay/devices.json` con Quadlet) es `DELETE /api/fleet/{id}/config` en el Gateway. El borrado limpia el envío retenido en el broker, así que ningún arranque posterior lo aplica, y un relay conectado en ese momento carga su archivo local, borra su archivo enviado, registra `the config push was cleared; the local device file takes over` y aplica el archivo local en vivo, igual que se aplica un envío. Si el archivo local no carga, el relay mantiene el archivo enviado en marcha y en disco y lo dice en el registro y en `/status`: borrarlo antes dejaría un relay que en su siguiente reinicio arranca con un archivo roto. Corrija el archivo local y envíe el borrado de nuevo. Hágalo con el relay **en línea**. Un borrado no es retenido, así que un relay que estaba sin conexión nunca se entera y conserva su archivo enviado; levántelo y envíe el borrado otra vez. Es seguro repetirlo.
- Un archivo enviado que existe pero no carga (un fallo de disco, o una release posterior con reglas más estrictas) se registra como error y el relay arranca con el archivo local en vez de quedarse caído por ello.
- Con `HOTLOOP_EDGE_RELAY_PUSHED_FILE` sin definir, un envío sobrescribe el propio `HOTLOOP_EDGE_RELAY_DEVICES_FILE`, el comportamiento de la 4.8.0. Eso solo sirve para un binario suelto con un archivo de dispositivos escribible, y entonces no hay copia aparte que un borrado pueda descartar.

Si un envío "no tomó", mire el registro del relay antes que nada. O dice de qué archivo arrancó, o dice por qué se rechazó el envío.

## La superficie HTTP

Dos endpoints, ambos sin autenticación, ambos de solo lectura:

- `GET /healthz`: el proceso está en marcha. Nada más; que un dispositivo esté desconectado no significa que este proceso no esté sano.
- `GET /status`, una instantánea: recuento de dispositivos por estado de conexión, número de etiquetas, la profundidad actual de la cola de reenvío, la lista de protocolos compilados y `uplink`: si el broker está conectado, si hay una reproducción en curso y qué contiene la cola de reenvío, cuánto pesa en disco y cuánto ha descartado en su límite (vea la página Edge publish, "When the uplink is down"). Sin valores de etiquetas, sin direcciones de dispositivos, sin configuración: es una superficie de monitorización, no una copia menor del panel del Gateway. `version`, `imageDigest` y `updateMode` dicen qué build es y si retiene actualizaciones. También dice, en `config`, qué archivo de dispositivos está en marcha: `source` (`local` o `pushed`), `path`, su `digest` sha256, `appliedAt` y `rejected`, el último archivo que el relay rechazó y por qué, hasta que se aplica un envío posterior. El digest, no el archivo: el Gateway puede cotejarlo con lo que envió sin que las direcciones y credenciales del archivo salgan por un puerto sin autenticación. Con un broker `discovery` en el archivo también dice, en `discovery`, cómo va cada uno y cuántos dispositivos encontró (vea [Discovery](#discovery-41810)).

Deliberadamente sin autenticación delante de ninguno: un edge relay no tiene base de datos de usuarios, almacén de sesiones ni sistema de identidad con el que montar una, y añadir un único token compartido sería teatro y no seguridad para dos endpoints que no exponen nada sensible. Ejecútelo detrás del perímetro de red del propio dispositivo, la misma expectativa que ya documenta el modo `auth.insecure` del Gateway para un despliegue tras un proxy de confianza.

## Configuración

| Variable | Por defecto | <span class="sr-only">Details</span> |
|---|---|---|
| `HOTLOOP_EDGE_RELAY_DEVICES_FILE` | n/a | Obligatorio. Ruta al archivo de dispositivos descrito arriba |
| `HOTLOOP_EDGE_RELAY_PUSHED_FILE` | unset | Dónde se guarda un archivo de dispositivos enviado; gana al de arriba mientras exista. Debe ser escribible y persistente; el chart y la unidad Quadlet usan `/data/pushed-devices.json`. Vea [Dónde vive un archivo enviado](#dónde-vive-un-archivo-enviado-y-qué-archivo-gana) |
| `HOTLOOP_EDGE_RELAY_LISTEN_ADDR` | `:8081` | El servidor de `/healthz` y `/status` |
| `HOTLOOP_EDGE_RELAY_UPDATE_MODE` | `auto` | `auto` deja la actualización al supervisor e ignora una aprobación del Gateway; `approve` retiene las actualizaciones hasta que llegue una. Vea [Actualizar un relay](#actualizar-un-relay) |
| `HOTLOOP_IMAGE_DIGEST` | unset | El digest de la imagen con la que corre este relay, tal como lo conoce su supervisor. La unidad Quadlet lo fija antes de cada arranque. Se informa en `/status` y en cada birth; vacío está bien |
| `HOTLOOP_LOG_LEVEL` | `info` | |
| `HOTLOOP_POLL_INTERVAL` | `5s` | Intervalo de consulta por defecto; el `pollIntervalMs` propio de un dispositivo lo anula |
| `HOTLOOP_MIN_POLL_INTERVAL` | `100ms` | Mínimo que se impone a todos los dispositivos, sea cual sea su propio ajuste |
| `HOTLOOP_POLL_TIMEOUT` | `10s` | Timeout por consulta por defecto; el `timeoutMs` propio de un dispositivo lo anula |
| `HOTLOOP_MAX_CONCURRENT_POLLS` | `32` | Dispositivos que pueden estar a mitad de consulta a la vez |
| `HOTLOOP_RECONNECT_MIN` / `HOTLOOP_RECONNECT_MAX` | `1s` / `60s` | Límites de espera entre intentos de reconexión, con jitter |
| `HOTLOOP_RING_SIZE` | `120` | Muestras por etiqueta que se guardan para diagnósticos cercanos a `/status` |
| `HOTLOOP_OPCUA_CLIENT_PKI_DIR` | `/data/opcua-client-pki` | El certificado del controlador OPC UA y sus almacenes `trusted/` y `rejected/`; el `pkiDir` propio de un dispositivo lo anula. Solo lo toca un dispositivo OPC UA seguro |

Los nombres de variable y los valores por defecto son idénticos a los de la `RuntimeConfig` del propio Gateway; vea su sección "Polling" en la página de k3s y Helm para los mismos ajustes expresados como valores de Helm, porque ambos binarios cargan esta configuración con la misma función `config.LoadRuntimeConfig()`, no con dos copias que puedan divergir.

Más cada variable `HOTLOOP_EDGE_PUBLISH_*` que documenta la página Edge publish, con una diferencia: `HOTLOOP_EDGE_PUBLISH_ENABLED` se ignora y el reenvío está siempre activo; publicar lo que lee es todo el propósito de este binario, no una función opcional como en el Gateway.

## Qué se ha verificado y qué no

HotLoop se ha ejecutado con equipos reales y servidores reales, y en hardware real el 2026-11-17.

## Despliegue

Dos caminos admitidos, ambos con contenedores, ningún `podman run` suelto lanzado desde una shell que muere con la sesión, y sin Docker:

- **`charts/hotloop-edge-relay`**, un chart de Helm para k3s, separado del chart propio del Gateway (`charts/hotloop`), porque un edge relay es un artefacto realmente distinto que suele correr en un clúster distinto y más pequeño que el del Gateway al que reenvía. Los dispositivos y etiquetas se declaran en `values.yaml` y se renderizan en un ConfigMap; la cola de reenvío vive en un PVC pequeño (vea "Persistence off" más abajo antes de desactivarlo).
- **`deploy/quadlet`**, una unidad Podman Quadlet para una Pi o un PC industrial pequeño que no forma parte de ningún clúster k3s. Quadlet convierte el contenedor en un servicio systemd de verdad: arranca con la máquina, se reinicia si falla y escribe en journald; vea el README de ese directorio para los pasos de instalación.

Ambos usan la misma imagen y las mismas variables de entorno documentadas arriba.

Cada release publica ambos, desde la 4.16.0. La imagen es `ghcr.io/hotloop-io/hotloop-edge-relay`, etiquetada con la versión de la release (más `major.minor`, `major`, `latest` y `stable`; la unidad Quadlet sigue `stable`, vea [Actualizar un relay](#actualizar-un-relay)). Es amd64 y arm64, y arm de 32 bits (arm/v7) desde la primera release posterior a la 4.17.0, porque una Pi 3 o una instalación de Pi OS de 32 bits es justo la caja en la que acaba un relay. El chart está en el mismo repositorio de Helm que el del Gateway:

```sh
helm repo add hotloop https://hotloop.io/hotloop/
helm install edge-relay hotloop/hotloop-edge-relay \
  --namespace hotloop --create-namespace \
  --set edgePublish.broker=tcp://gateway.example.local:1883 \
  --set edgePublish.group=Plant1
```

### Persistence off

`persistence.enabled=false` le da un relay que corre sin PVC, y exactamente eso. En la 4.16.0 ni siquiera arrancaba: no había nada montado en `/data`, la raíz es de solo lectura y el relay moría al arrancar con `open forward queue at /data/forward.db: no such file or directory`. Ahora `/data` es un emptyDir, limitado a `persistence.size`, y todo lo que escribe el relay va ahí.

Un emptyDir vive lo que vive el pod. Un reinicio de contenedor dentro del mismo pod lo conserva. Un pod nuevo no, y se obtiene un pod nuevo al drenar un nodo, al caer un nodo, en una expulsión, con un `kubectl delete pod` y con cualquier `helm upgrade` que renueve el Deployment. Cada vez, pierde:

- **La cola de reenvío.** Cada lectura almacenada mientras el broker estaba caído desaparece, y nada en el lado del Gateway sabe que falta.
- **Un archivo de dispositivos enviado.** El relay vuelve a arrancar con los `devices` del chart sin protestar, hasta que el Gateway envía de nuevo o el broker reproduce un envío retenido. Es exactamente el fallo que el PVC está para evitar, y desactivarlo le expone otra vez.
- **El certificado de cliente OPC UA y el almacén de confianza.** Cada servidor seguro tiene que confiar en el certificado nuevo, y el operador tiene que aprobar de nuevo el certificado de cada servidor.

Llenar el tope, lo que hará una cola sin límite (`queueMaxBytes: 0`; el valor por defecto es 64 MiB) en una caída lo bastante larga, hace que se expulse el pod y se pierdan los tres a la vez. Aun así es mejor que llenar el disco del nodo bajo todo lo demás que corre en él. Las notas de instalación imprimen una advertencia cuando la persistencia está desactivada. Sirve para una prueba. Para un relay cuyas lecturas importan, dele el PVC.

### Desde la App Store de EmberNet

La tienda lista el relay como HotLoop Edge Relay, uno por nodo. Un despliegue desde la tienda entrega al chart tres cosas: el nombre visible (el nombre de la release), un selector de nodo y las etiquetas del tenant. No tiene formulario para pedir nada más, y el relay no puede funcionar sin un broker y un grupo Sparkplug. Por eso un despliegue del relay desde la tienda se detiene en el renderizado, a propósito, con un error en el registro del job helm-install que nombra lo que falta e imprime el comando exacto para arreglarlo.

No le dimos un broker por defecto, porque no hay ninguno que sea cierto para la planta de nadie, y un relay apuntando a una dirección inventada parecería desplegado mientras no reenvía nada. Tampoco puede quedarse esperando un archivo de dispositivos enviado: un envío llega por la conexión al broker que todavía no tiene.

La solución es poner los dos valores en lo que escribió la tienda, y la instalación se reintenta sola:

```sh
# a node on the local cluster: add them under spec.valuesContent
kubectl -n default edit helmchart hotloop-edge-relay-<node>

# a tenant on its own cluster (Fleet): add them under spec.helm.values
kubectl -n fleet-default edit helmop hotloop-edge-relay-<node>
```

```yaml
edgePublish:
  broker: tcp://<gateway-or-broker>:1883
  group: <sparkplug group id>
```

Una vez en marcha aparece en Apps en ejecución con el nombre que le dio la tienda, con el icono de HotLoop, limitado al tenant que lo desplegó, y sin botón de LANZAR. Esto último es deliberado: el chart lo etiqueta `embernet.ai/gui-type: none`, porque `/healthz` y `/status` son para una sonda y el curl de un operador, no una página en un iframe.

El relay y el Gateway comparten número de versión. Una release no arranca a menos que ambos charts lleven la versión del tag y la unidad Quadlet del relay siga `:stable`, así que el relay recibe una versión nueva en cada release haya cambiado o no su propio código. Es a propósito: un número por el que preguntar, y ningún chart de relay apuntando a una imagen de relay que nadie publicó. La unidad Quadlet antes fijaba el número de la release, que es lo contrario de cómo funciona una caja que se actualiza sola.
