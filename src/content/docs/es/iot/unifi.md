---
title: "Red UniFi"
description: "Switches, puertos, PoE, failover de WAN y clientes de una consola UniFi como tags normales, con pantallas, eventos y comandos apagados hasta que se arman."
---

La red de una planta también es equipo. Cuando un PLC se calla, la primera pregunta es «¿es el PLC o el puerto del switch donde está conectado?», y hasta ahora la respuesta vivía en la app de UniFi en el teléfono de alguien. Por eso HotLoop lee la propia consola UniFi: cada switch, cada puerto, el consumo PoE, los enlaces WAN y el estado del sitio, como tags normales. Así, las alarmas, las tendencias, las entidades, las automatizaciones, OPC UA y MCP funcionan sobre ellos sin saber que UniFi existe.

Esto es el driver, la vigilancia de OT que se apoya en él, las pantallas, el flujo de eventos y los primeros comandos (U1 a U5 en la [hoja de ruta](/es/roadmap/)). **Lee la red, y solo la cambia cuando una persona ha armado un tag para ello.** Todos los tags se crean de solo lectura. Los pocos puntos que son comandos (abajo, «Comandos») pasan por la puerta de escritura como cualquier tag: nada envía uno hasta que alguien marca ese tag como escribible, y una cuenta de consola que sea View Only es rechazada por la propia consola. Para todo salvo los comandos, la cuenta que usa puede ser View Only.

## Agregar una consola

Un dispositivo de HotLoop es **un sitio en una consola**. El Cloud Gateway y el Express que tiene detrás son dos consolas, es decir, dos dispositivos con dos inicios de sesión, porque cada consola tiene sus propias cuentas locales.

1. **Cree una cuenta local en la consola.** Settings, Admins & Users, Add Admin, marque **Restrict to Local Access Only**, rol **View Only**. Una cuenta en la nube de Ubiquiti solo puede iniciar sesión desde la app: exige MFA, y la consola responde 403 a un script. La nuestra se llama `hotloop-ro`.
2. **Agregue el dispositivo.** Protocolo `unifi`, y como dirección la URL de la consola: `https://host` para una consola con UniFi OS (Cloud Gateway, Dream Machine, UniFi OS Server), `https://host:8443` para la Network Application autoalojada. Un intervalo de sondeo de 15 s es razonable; el driver nunca lee una consola más de una vez cada 10 s, sea cual sea el valor configurado.
3. **Guarde sin huella.** La primera conexión falla, a propósito, con la huella del certificado que presentó la consola. Compruebe que es su consola (la consola muestra su certificado, o `openssl s_client -connect host:443` pasado por `openssl x509 -pubkey -noout | openssl pkey -pubin -outform der
   | sha256sum` da lo mismo), péguela en `certFingerprint` y guarde.
4. Los tags se crean solos en el siguiente sondeo. Vea más abajo.

Un dispositivo UniFi solo se puede guardar cuando HotLoop tiene una clave con la que cifrar la contraseña (`HOTLOOP_SECRET_KEY_FILE`, que el chart configura por su cuenta). Vea [Copias de seguridad y restauración](/es/iot/backup/#device-credentials-and-the-secret-key).

| Opción | Predeterminado | Qué hace |
|---|---|---|
| `site` | `default` | El nombre corto del sitio, el que aparece en las URL de la consola. `default` es el primer sitio de toda consola |
| `username`, `password` | obligatorios | La cuenta local. La contraseña es de solo escritura a través de la API y va cifrada en la base de datos |
| `certFingerprint` | ninguno | El SHA-256 de la clave pública del certificado de la consola, en hexadecimal. Los dos puntos, los espacios y las mayúsculas valen |
| `caFile` | ninguno | Confía en una CA en lugar de un pin, para consolas con certificados reales |
| `insecureSkipVerify` | `false` | Confía en cualquier certificado. Para un banco de pruebas, nunca para una planta |
| `clientTimeoutSec` | `90` | Cuánto tiempo después de que la consola viera por última vez a un cliente sigue contando como presente en la red. Mínimo 30. Vea [clientes](#clientes-redes-ot-y-dónde-está-conectado-un-plc) |

### Por qué se fija el certificado

Las consolas traen certificados autofirmados, y la respuesta perezosa es saltarse la verificación. Eso está bien para leer un medidor. No está bien para un inicio de sesión que puede ver toda la red de la planta y, desde los PR de escritura en adelante, reiniciar sus puertos. Una consola con pin que presenta otro certificado se rechaza durante el handshake TLS, **antes de enviar el usuario o la contraseña**, y el error nombra las dos huellas. El pin está sobre la clave pública, así que una consola que vuelve a emitir su certificado con la misma clave sigue funcionando.

No hay un «confiar en el primer uso» silencioso. El único momento en que confiar en un certificado significa algo es cuando una persona lo está mirando, y por eso ocurre entonces.

## Inicios de sesión: una vez, y no más a menos que haga falta

Iniciar sesión en cada comprobación hizo que nuestro propio Cloud Gateway respondiera 429 y bloqueara la cuenta. Dos veces. Por eso:

- **Una sesión por consola y por proceso.** Cada sondeo, y cada sitio de la consola, viaja por el mismo inicio de sesión. Dos dispositivos para dos sitios de una misma consola con la misma cuenta son una sola sesión.
- **Solo vuelve a iniciar sesión cuando la consola dice que la sesión ya no existe** (401), de un solicitante a la vez, y **nunca más de una vez por minuto**, pase lo que pase. Una sesión que muere dos veces en un minuto deja el dispositivo con lectura mala hasta que pasa el minuto, y ese es el compromiso que queremos.
- **Un inicio de sesión rechazado no se reintenta.** Una contraseña equivocada, una cuenta en la nube o un bloqueo 429 esperan al menos cinco minutos, más si lo indica el `Retry-After` de la consola, y el error del dispositivo dice cuál fue. Apagar y encender el dispositivo no da otro intento: el proceso lo recuerda.
- **Cierra la sesión** cuando se detiene el último dispositivo que usa una consola, para que los reinicios no acumulen sesiones en la consola.
- **Un ayudante `--mcp-stdio` nunca inicia sesión.** Corre junto al Gateway, que ya tiene la sesión, y un segundo inicio de sesión desde la misma caja es justo lo que provoca el 429. Sus dispositivos UniFi quedan caídos ahí mientras funcionan en el Gateway.

## Tags

Todos los tags los crea el driver, de solo lectura hasta que una persona los arma, y se nombran a partir de direcciones MAC y números de puerto, nunca de nombres para mostrar, así que cambiar el nombre de un switch en la app de UniFi no rompe nada. `<mac>` es la MAC del dispositivo en minúsculas y sin separadores, `<nn>` el número de puerto con dos dígitos.

| Tag | Tipo | Qué es |
|---|---|---|
| `d.<mac>.state` | texto | `connected`, `disconnected`, `pending`, `upgrading`, `provisioning`, `heartbeat_missed`, `adopting`, ... |
| `d.<mac>.online` | bool, connectivity | Conectado a la consola |
| `d.<mac>.uptime_s` | int, s | Tiempo de actividad |
| `d.<mac>.cpu_pct`, `.mem_pct` | float, % | CPU y memoria |
| `d.<mac>.temp_c` | float, °C | Temperatura, en los dispositivos que tienen sensor |
| `d.<mac>.clients` | int | Clientes conectados a través de él |
| `d.<mac>.fw` | texto | Versión de firmware |
| `d.<mac>.wan<N>.up` | bool, connectivity | La WAN N está **viva** según las comprobaciones de estado del propio gateway (`last_wan_interfaces`, luego `last_wan_status`). No el `up` del bloque WAN, que significa configurada. Una consola que no da ninguno de los dos lee mala, nunca activa |
| `d.<mac>.wan<N>.latency_ms` | float, ms | Su latencia, buena solo mientras la WAN está viva |
| `d.<mac>.wan<N>.availability_pct` | float, % | Disponibilidad según los monitores del propio gateway en su ventana (un día), cuando la informa |
| `d.<mac>.wan.active` | texto | Qué WAN lleva el tráfico: la WAN del uplink si está viva, si no la primera viva, `none` si no hay ninguna |
| `d.<mac>.wan.failover` | bool, problem | El tráfico va por cualquier WAN que no sea la primera: la planta está en el respaldo |
| `p.<mac>.<nn>.up` | bool, connectivity | Enlace del puerto |
| `p.<mac>.<nn>.speed_mbps` | int, Mbit/s | Velocidad del enlace; 0, válido, en un puerto sin enlace |
| `p.<mac>.<nn>.rx_bps`, `.tx_bps` | float, bit/s | Tráfico |
| `p.<mac>.<nn>.errors` | int | Errores de recepción más transmisión |
| `p.<mac>.<nn>.poe_w` | float, W, power | Consumo PoE, en los puertos que pueden suministrar PoE |
| `p.<mac>.<nn>.poe_mode` | texto | `auto`, `off`, `pasv24`, `passthrough` |
| `site.<subsystem>.status` | texto | El estado del sitio: `wan`, `www`, `lan`, `wlan`, `vpn` |
| `site.www.latency_ms` | float, ms | Latencia de internet, cuando se informa |
| `site.network_version` | texto | La versión de Network que ejecuta la consola |
| `site.events_live` | bool, connectivity | El websocket de eventos de la consola está conectado. 0 significa que HotLoop solo sondea, lo que cuesta velocidad y nada más |
| `site.last_event` | texto | El evento más reciente que la consola informó sobre el sitio, con sus propias palabras |
| `d.<mac>.last_event` | texto | El evento más reciente sobre ese dispositivo. Vacío hasta que haya tenido uno |

Las clases de dispositivo pasan a las entidades, de modo que el enlace de un puerto sale como sensor binario de conectividad y su consumo PoE como sensor de potencia sin que nadie lo configure.

**Los tags se agregan solos y nunca desaparecen por su cuenta.** Un switch adoptado la semana que viene aparece como tags en el siguiente sondeo, en la misma sesión, sin reiniciar nada. Un switch desconectado lee `online` 0 y sus puertos pasan a calidad mala, así que una alarma sobre él lo dice en lugar de desaparecer con él. Borrar sus tags es decisión de una persona. Un tag que alguien apagó sigue apagado: el driver no tiene voto.

Solo los dispositivos adoptados reciben tags. Un switch que alguien conectó y nadie adoptó todavía no forma parte de la red de la planta. Un punto que la consola no informa lee malo, nunca un cero inventado: un switch que no informa consumo PoE tiene sus tags `poe_w` con lectura mala.

El Edge Relay también puede sondear una consola. Lee los tags que declara su archivo de dispositivo y no agrega ninguno, porque no tiene dónde guardarlos.

## Comandos

Cinco tipos de punto son comandos. Cada uno se crea de solo lectura como cualquier otro tag, y no hace nada hasta que alguien lo marca como escribible. La cuenta con la que HotLoop inicia sesión tiene que ser Administrator local para esto; con View Only la consola responde HTTP 403, HotLoop lo dice y nada cambia.

| Tag | Escritura | Qué hace la consola |
|---|---|---|
| `d.<mac>.locate` | `true` o `false` | Hace parpadear el LED del dispositivo hasta que se apaga. Lee lo que dice la consola. |
| `d.<mac>.restart` | `true` | Reinicia el dispositivo la próxima vez que informe. `false` no hace nada. Lee 0. |
| `p.<mac>.<nn>.power_cycle` | `true` | Apaga y enciende el PoE del puerto. `false` no hace nada. Lee 0. |
| `w.<id>.enabled` | `true` o `false` | Enciende o apaga una red inalámbrica. Solo se envía ese campo, así que la contraseña y todos los demás ajustes se quedan. `<id>` es el id que la consola da a la red, y un cambio de nombre no lo altera. |
| `c.<mac>.blocked` | `true` o `false` | Bloquea a un cliente vigilado en la red, o lo deja volver a entrar. El punto existe para un cliente que la consola ha visto. |

Un ciclo de energía puede dañar una planta (una automatización que reinicie un PLC cada dos minutos le quema la fuente de alimentación), así que se cumplen dos reglas pida quien pida: un puerto se reinicia como máximo una vez cada 15 minutos (la hora del último ciclo se guarda en la base de datos, así que un reinicio no lo olvida, y un ciclo cuya hora no se puede comprobar se rechaza), y nunca se reinicia un puerto que lleva la red. Eso es un uplink, y cualquier puerto del que cuelga otro equipo, según la propia topología de la consola; el puerto que alimenta un respaldo 5G es uno de ellos. Un rechazo dice qué regla fue. Un comando que la propia consola rechaza no gasta el tiempo de espera.

## Clientes, redes OT y dónde está conectado un PLC

Dos trabajos, ambos de solo lectura.

**Dónde está conectado.** Un PLC se calla y la primera pregunta es si es el PLC o el puerto del switch. Vincule una vez el dispositivo de HotLoop con su cliente en la red, y su panel dice «en USW Lite 8 PoE puerto 5, enlace caído» antes de que nadie abra la app de UniFi. El vínculo también da tags de cliente en el dispositivo de la consola, así que el estado del puerto entra en tendencias y alarmas junto a los valores Modbus que dejaron de llegar.

**Qué hay en la red SCADA.** Marque una red como OT, acepte lo que le pertenece, y cualquier otra cosa que aparezca en ella genera una alarma que la nombra. Si alguien conecta un portátil al switch SCADA a las 2 de la madrugada, lo sabe a las 2 de la madrugada.

### Nada se identifica por IP

La lista de clientes de la consola va con retraso. Por eso:

- **Un cliente es su MAC.** Al vincular se propone un cliente por IP, porque es lo que usted sabe de su PLC, pero una persona lo confirma una vez y desde entonces la clave es la MAC. El tag de IP dice que es la opinión de la consola.
- **En línea no es «estar en la lista».** Un cliente está en línea cuando la consola lo vio dentro de `clientTimeoutSec` (90 s) **y**, si es por cable, el puerto de su switch tiene enlace. El puerto es la mitad rápida: se saca el cable y el puerto lee caído en la siguiente lectura, mientras la lista todavía se pone al día.

### Vincular un dispositivo

Abra el panel de un dispositivo. Si una consola UniFi que HotLoop lee tiene un cliente con la IP del dispositivo, la sección Network lo propone; un administrador pulsa **Link**. Si no hay IP de la que partir (un dispositivo direccionado por nombre), vincúlelo por MAC. O por la API, `PUT /api/devices/{id}/network`, vea [la API HTTP](/es/iot/api/#put-apidevicesidnetwork).

El cliente de un dispositivo vinculado recibe tags y una alarma, **«PLC-07 off the network»**, prioridad 1, con un retardo de activación de 120 s para que un PLC que se reinicia no avise a nadie.

### Redes OT y la lista de conocidos

Marque una red como OT (`PUT /api/unifi/{id}/networks/{network}` con `{"ot": true}`), y después acepte lo que hay en ella: todo tal como está ahora en una sola llamada (`POST .../accept-all`), o un dispositivo cada vez. Al marcarla se crea la alarma **«Unknown device on SCADA»**, prioridad 1, sobre `n.<network>.unknown`. El intruso más reciente se nombra en `n.<network>.unknown_last`, con su MAC, cómo se llama a sí mismo, su IP y el puerto del switch o el SSID por donde entró.

Un dispositivo conocido se puede **vigilar** (`"watch": true`): recibe los mismos tags y la misma alarma de «fuera de la red» que uno vinculado. Un PLC se vigila. Un portátil de mantenimiento que tiene permiso pero va y viene es conocido y no vigilado, o avisa a alguien cada vez que se va.

Las alarmas son definiciones de alarma normales. Pospóngalas, reconózcalas, envíelas a Discord, edite su retardo. Si quita la vigilancia, el vínculo o la marca OT, HotLoop quita la alarma que creó para ello, así que un tag que nadie lee ya no mantiene una alarma abierta. Una que escribió a mano un administrador no se toca nunca.

El registro es de HotLoop, en su propia base de datos (`unifi_networks`, `unifi_known`, `unifi_links`, todas en las copias de seguridad), nunca de la consola. Un cambio llega al driver en marcha en su siguiente lectura, en la sesión que ya tiene: no reinicia el dispositivo, porque un reinicio cierra la sesión y el presupuesto de un inicio de sesión por minuto lo dejaría fuera un minuto.

### Los tags

| Tag | Tipo | Qué es |
|---|---|---|
| `n.<network>.clients` | int | Clientes en la red ahora, en línea según la prueba anterior. Toda red LAN recibe uno |
| `n.<network>.unknown` | int | En una red OT: clientes en línea que no están en su lista de conocidos |
| `n.<network>.unknown_last` | texto | El más reciente de ellos, en palabras. Vacío cuando no hay ninguno |
| `c.<mac>.online` | bool, connectivity | Cliente vigilado o vinculado en la red |
| `c.<mac>.ip` | texto | Su IP, como la vio la consola por última vez |
| `c.<mac>.sw_mac`, `.sw_port` | texto, int | El switch y el puerto en que está un cliente por cable. Se conserva tras sacar el cable: dónde *estaba* es lo importante |
| `c.<mac>.port_up` | bool, connectivity | El enlace de ese puerto. Malo cuando el propio switch se ha caído de la consola, porque entonces nadie lo sabe |
| `c.<mac>.last_seen_s` | int, s | Segundos desde que la consola lo vio por última vez |

`<network>` es el ID de la red en la consola, así que cambiar el nombre de SCADA en la app no rompe nada. Una red marcada OT que la consola ha borrado después lee mala con ese motivo, nunca un cero silencioso. Un cliente que la consola nunca ha visto lee `online` 0 y el resto malo, y lo dice.

Solo los clientes vigilados y vinculados reciben tags `c.*`. Una red de invitados con 300 teléfonos entrando y saliendo no genera 300 conjuntos de tags.

### Leer sin preguntar a la consola

`GET /api/unifi/{id}/networks`, `/clients` y `/known`, el panel y la herramienta MCP `find_network_client` leen la última lectura del driver. Ninguna hace una petición propia, así que una pantalla que se deja abierta, o un agente que pregunta en bucle, no le cuesta nada a la consola y no puede ser lo que provoque el 429. La otra cara: un ayudante `--mcp-stdio`, que nunca inicia sesión, dice que no hay lectura de consola en su proceso.

## Las pantallas

La pestaña UniFi tiene seis vistas y un selector de consola. Todo lo que muestra es la última lectura del driver, así que dejarla abierta no le cuesta nada a la consola y no puede ser lo que provoque un 429. Vuelve a preguntar a HotLoop cada pocos segundos y solo se repinta cuando algo cambió, así que un mapa que alguien desplazó hasta una esquina se queda donde lo puso.

- **Resumen.** Una tarjeta por consola. Arriba, en la de un gateway, está la franja WAN: un segmento por WAN, verde cuando la comprobación de estado del propio gateway dice que está viva, rojo cuando no, y la que lleva el tráfico, con borde. Cuando el sitio funciona con un respaldo, toda la franja se pone ámbar y dice cuál y desde cuándo. Ese «desde» es cuando HotLoop lo leyó así por primera vez, no cuando el gateway cambió, y un HotLoop que arrancó cuando el sitio ya estaba en el 5G lo dice desde su propio arranque. No imprimimos una hora que no tenemos. Debajo: dispositivos en línea, clientes por cable e inalámbricos, clientes por red, los dispositivos que la consola ha perdido y los últimos eventos. Una WAN sobre la que la consola no dice nada es gris y dice «no liveness reported», nunca verde. Toda WAN que informa una latencia tiene una traza junto al número, la misma línea que dibujan las tarjetas de entidad, a partir del propio búfer de HotLoop para ese tag. Un administrador tiene **Create the usual alarms** al final de la tarjeta, vea [las alarmas iniciales](#las-alarmas-iniciales).
- **Mapa.** De izquierda a derecha desde el gateway. Se dibuja siempre igual (un árbol ordenado, sin física, misma lectura de entrada y mismos píxeles de salida), así que no tiembla en un panel de pared. Los cables son la propia `downlink_table` de la consola: un switch está conectado a otro solo porque la consola lo dice. Un dispositivo que nada indica como conectado a algo se queda solo y dice «no uplink listed». No lo vamos a colgar del gateway por una suposición para luego equivocarnos sobre por dónde va la red del PLC. Los clientes por cable se sitúan en el switch y el puerto donde la consola los aprendió, los inalámbricos en su AP y SSID, contados en una etiqueta de la tarjeta. Haga clic en un dispositivo y se atenúa todo lo que no está aguas abajo de él, y el panel lateral lista lo que sí lo está, sus clientes y las líneas del árbol de la planta que alimenta: los dispositivos de HotLoop vinculados a un cliente por debajo, cada uno con la ruta de equipo donde está. El mapa se amplía y se mueve: pellizque con dos dedos, arrastre con uno, ctrl y rueda o el pellizco de un trackpad sobre el puntero, o los botones más, menos y Fit, desde el mapa entero hasta ocho veces. Es SVG puro, así que se ve nítido a cualquier escala, y donde lo ponga se queda mientras la pantalla se actualiza. Un arrastre que termina sobre un dispositivo no lo selecciona. **Plant overlay** pone los dispositivos de HotLoop vinculados a un cliente en una caja punteada por línea del árbol de la planta, a la derecha de la red y rotulada con la ruta de la línea, cada uno con un cable al puerto del switch donde está conectado, lo que dice la red sobre él (activo, caído o no visto) y lo que dice HotLoop. Un dispositivo vinculado pero sin línea está en una caja llamada «Not on the Plant tree». Se queda activado una vez que lo enciende. Dos consolas son una sola imagen: una caja de otra consola que HotLoop lee y que esta consola lista como cliente por cable se dibuja aquí con su propio subárbol, punteado y marcado «separate console». El mapa se exporta como SVG para la carpeta del sitio.
- **Dispositivos.** Una tabla y, al hacer clic en uno, su frontal: los puertos dibujados como el panel delantero, una fila para un switch pequeño, dos para 24 y 48 puertos con los impares encima de los pares. Verde para un enlace, gris para ninguno, **rojo para un puerto que estaba activo y cayó** (HotLoop recuerda que estaba activo desde que empezó a vigilar), punteado para uno deshabilitado, un rayo de PoE (los vatios están en la ayuda emergente y el detalle del puerto), una flecha en el uplink. Haga clic en un puerto para ver quién está en él, qué hay conectado, el modo PoE, los vatios y el tráfico, con una traza de lo que ha estado recibiendo y enviando. Un dispositivo que la consola ha perdido no muestra números ni enlaces de puerto, porque lo último que dijo ya no está vigente.
- **Clientes.** Con búsqueda por nombre, MAC o IP, con dónde está, cuándo lo vio la consola por última vez, conocido o desconocido en una red OT, y el dispositivo de HotLoop vinculado a él. Los administradores aceptan uno desconocido desde la fila.
- **Redes.** El interruptor OT, por red, y «aceptar todo como está». Eso cambia el registro de HotLoop, no la consola.
- **WiFi.** Los SSID, si cada uno emite, en qué red está y cuántos clientes tiene. Si la consola no muestra a la cuenta sus redes inalámbricas, la pantalla lo dice en lugar de afirmar que no hay ninguna.

Las rutas que hay detrás son `GET /api/unifi/consoles`, `.../overview`, `.../topology`, `.../devices`, `.../wifi` y `.../events`, documentadas en [La API HTTP](/es/iot/api/).

### Las alarmas iniciales

Las alarmas que una planta quiere en su red antes de que nadie haya tenido que pensarlo, creadas a partir de lo que la consola tiene ahora. **Create the usual alarms** en el Resumen (o `POST /api/unifi/{id}/starter-alarms`, vea [la API HTTP](/es/iot/api/)) crea:

| Alarma | Sobre | Prioridad | Retardo de activación |
|---|---|---|---|
| un dispositivo desconectado | `d.<mac>.online`, para cada switch, AP y gateway adoptado | 2 | 60 s, para que un reinicio por firmware no avise a nadie |
| un uplink caído | `p.<mac>.<nn>.up` en el puerto por el que cada dispositivo se conecta a su upstream | 1 | 10 s |
| un gateway en una WAN de respaldo | `d.<mac>.wan.failover`, para un gateway con dos o más WAN | 2 | 30 s |
| un puerto PoE sobre un límite | `p.<mac>.<nn>.poe_w`, solo cuando usted da un límite en vatios | 3 | 30 s |

Son definiciones de alarma normales: pospóngalas, reconózcalas, envíelas a Discord, edite el retardo o el límite, borre una. Volver a pulsar tras adoptar más equipos agrega solo los equipos nuevos, y un tag que ya tiene una alarma, hecha a mano o por una pulsación anterior, se deja en paz. La alarma de PoE toma un límite que usted da en lugar de uno que elija HotLoop, porque ninguna consola que leemos dice cuál es el presupuesto de un puerto, y un número que hubiéramos adivinado sería un número en el que alguien confiaría. «Unknown device on an OT network» y «a watched client off the network» no están en el botón: se crean al marcar una red como OT y al vigilar o vincular un dispositivo, con el registro que les da sentido.

## Eventos

El websocket de eventos de la consola (`/proxy/network/wss/s/<site>/events` en UniFi OS, `/wss/s/<site>/events` en la aplicación autoalojada), en la misma sesión que todo lo demás. Nunca inicia sesión por su cuenta: un handshake rechazado con 401 pasa por el mismo presupuesto de inicios de sesión que una lectura, y un inicio de sesión rechazado se espera, no se reintenta.

**El sondeo sigue siendo la verdad.** Un evento nunca escribe un tag. Lo que hace:

1. Llega al **diario** en el momento en que se recibe, con la propia frase del controlador («Switch[...] was disconnected») y su clave. Un switch que se cae queda en la línea de tiempo cuando ocurre, no cuando el siguiente sondeo lo nota. Se archiva bajo el switch, el punto de acceso o el gateway del que trata, no bajo el propio dispositivo de la consola, porque la consola es la caja donde corre el controlador y no lo que se cayó. Un evento que nombra solo a un cliente (la consola dice quién se unió, no dónde) se archiva bajo el switch o el AP donde la última lectura tiene a ese cliente, y si el cliente es nuevo espera a la lectura que el evento acaba de pedir, hasta treinta segundos, y luego va bajo la consola si esa lectura sigue sin tenerlo. El filtro **Where** del diario encuentra un evento desde la planta: un dispositivo de HotLoop vinculado a su cliente, el switch donde la consola dice que está ese cliente y cada switch entre ahí y el gateway según la tabla de downlink de la propia consola. Un switch caído está en la línea de tiempo de cada línea que alimenta y en ninguna de las que no. Pedir la propia consola sigue funcionando como siempre: el registro del sistema por `subject` igual al id de la consola, y el diario con la consola entre los dispositivos del alcance, devuelven todos los eventos de esa consola, incluidos los de cada switch.
2. Entra en el registro que muestra el Resumen, y en `site.last_event` y `d.<mac>.last_event`, de modo que una automatización puede dispararse con uno.
3. Pide la siguiente lectura ya. El mínimo de lectura es de diez segundos; un evento lo acorta a cinco, así que los tags y las entidades se ponen al día en el siguiente sondeo en lugar de hasta diez segundos después. Una red WiFi ocupada envía un evento por cada teléfono que pasa, y la consola no se lee por cada uno.

El controlador marca los eventos que significan que algo fue mal (`is_negative`: un switch que pierde contacto es uno, un cliente que se desconecta no), y esos son advertencias en el diario. Todo lo demás es información, incluidas las claves que HotLoop nunca ha visto.

**Un websocket caído cuesta velocidad, nunca corrección.** Se reconecta con una espera de dos segundos hasta un minuto. Hace ping, y un flujo que no responde nada en 90 segundos está muerto diga lo que diga la red, así que se cierra y se vuelve a abrir. Mientras está caído, `site.events_live` lee 0, el Resumen dice «polling only» con el motivo, y el sondeo sigue exactamente como antes.
## Qué está verificado

El driver de UniFi y las pantallas se han ejecutado contra Network Applications de UniFi y consolas UniFi OS reales, solo lectura con una cuenta View Only, y en hardware real el 2026-11-17: el inicio de sesión y su única sesión, los tags de dispositivo, puerto, PoE, WAN y cliente, el flujo de eventos en vivo y las pantallas construidas sobre ellos.
