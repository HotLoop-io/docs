---
title: "Edge Publish y almacenar y reenviar"
description: "Publica todo lo que lee un equipo en un Gateway central como nodo de borde Sparkplug B, guarda en disco cuando el enlace cae y reenvía en orden."
---

Edge Publish, desde la 4.5.0, convierte a HotLoop en un **nodo de borde** Sparkplug B que publica todo lo que lee en un Gateway central por MQTT, en el sentido opuesto al del controlador MQTT existente, que consume Sparkplug como host primario. Esto es lo que significa ejecutarlo.

La publicación en el edge viene activada por defecto en el Gateway y en Edge, y queda inactiva hasta que tiene un broker y un grupo Sparkplug, desde el chart o el entorno, o introducidos por un administrador en Ajustes, "Adónde van las alarmas y las lecturas" (vea [Notificaciones de alarma](/es/iot/notifications/#where-alarms-go-settings)). Lo que se guarda ahí prevalece, y se lee cuando HotLoop arranca, porque el publicador es el dueño del archivo de la cola y del nodo. Sin nada configurado no publica nada y no impide que HotLoop arranque.

Al activarlo se ejecuta dentro del mismo proceso del Gateway, todavía conectado a TimescaleDB, y resulta útil cuando una planta quiere la interfaz y el historial del Gateway completo en local y además un enlace ascendente a uno central. La gestión de flota para muchos Edge Relay llegó en la 4.7.0 (seguimiento, a partir de sus births y deaths) y la 4.8.0 (envío de configuración); consulta la página de gestión de flota.

## Activarlo

```sh
export HOTLOOP_EDGE_PUBLISH_ENABLED=true
export HOTLOOP_EDGE_PUBLISH_BROKER=mqtt.example.local:1883
export HOTLOOP_EDGE_PUBLISH_GROUP=Plant1
export HOTLOOP_EDGE_PUBLISH_NODE=press-line-3   # defaults to the pod hostname
export HOTLOOP_EDGE_PUBLISH_QUEUE_PATH=/data/forward.db
```

Cada lectura que llega al bus de tags (el mismo flujo que leen la interfaz en vivo y el evaluador de alarmas) se publica como un `NDATA` de Sparkplug B. Mientras el broker está accesible y confirma, eso ocurre directamente desde la memoria y no se toca el disco. Cuando el broker deja de confirmar, las lecturas pasan a la cola de reenvío en disco y salen de ella, en orden, cuando vuelve.

## Qué hace realmente

**Suscrito antes de nacer.** En cada conexión, la primera y cada reconexión, el nodo se suscribe a su tema `NCMD` (y a su tema de envío de configuración) y espera a que el broker confirme ambas suscripciones antes de publicar nada. Sparkplug B 3.0 lo exige ("Antes de enviar un mensaje NBIRTH, el cliente MQTT asociado al nodo de borde debe suscribirse para recibir mensajes NCMD"), y con razón: un host puede responder a un birth con una petición inmediata de rebirth o de reinicio, y un nodo que hace birth primero puede perderla. `Start()` no regresa hasta que las suscripciones están en su sitio. Si el broker rechaza una (una ACL que no deja a este nodo leer su propio tema `NCMD`), `Start()` falla con un error que lo dice; un nodo al que nadie puede dar órdenes no debería arrancar fingiendo lo contrario. Una reconexión que no puede volver a suscribirse no hace birth en esa sesión; las lecturas siguen yendo a la cola de reenvío.

**Un broker ausente no detiene el arranque.** Que lo rechace es un problema de configuración y hace fallar `Start()`. Que no se pueda alcanzar es una interrupción: `Start()` lo registra y regresa, y el nodo sigue intentándolo en segundo plano (un segundo, duplicando hasta un minuto) mientras cada lectura va a la cola de reenvío. Antes también fallaba en ese caso, y el Gateway y el Edge se cierran cuando Edge Publish no arranca, así que un equipo reiniciado durante una caída de la WAN entraba en bucle de fallos, sin pantallas, sin alarmas, sin automatizaciones y sin nada en búfer hasta que volvía la WAN.

**Un NBIRTH por conexión.** Cada tag conocido, anunciado por nombre con un alias estable, y su valor actual. Un birth ocurre en la primera conexión, en cada reconexión (una sesión Sparkplug empieza de nuevo, y su numeración de secuencia no tiene sentido entre reconexiones), cuando aparece en un lote un tag que nadie había visto, y a petición, ver más abajo.

**NDATA para todo lo posterior**, solo por alias, sin nombre. `seq` empieza en 0 con el birth y aumenta (módulo 256) con cada mensaje hasta el siguiente.

**NDEATH** de dos maneras: de forma ordenada en `Stop()`, y mediante el last-will de la propia conexión MQTT si el proceso muere sin oportunidad de hacerlo. Ambos llevan el mismo valor de `bdSeq`, que coincide con el birth al que ponen fin. Un host distingue un certificado de muerte antiguo, sobrante de una sesión anterior, del actual por ese número.

**`bdSeq` cuenta sesiones, y la cuenta sobrevive a un reinicio.** Cada MQTT CONNECT recibe el número siguiente: 0 en la primera sesión de una cola, uno más cada vez, y vuelta a 0 tras 255 (Sparkplug B 3.0, Operational Behavior, Edge Node Session Establishment: `tck-id-message-flow-edge-node-birth-publish-will-message-payload-bdSeq`), y el NBIRTH de esa conexión lleva el mismo número que el will que registró (`tck-id-message-flow-edge-node-birth-publish-nbirth-payload-bdSeq`). Vive en el archivo de la cola de reenvío, de modo que un nodo reiniciado sigue contando en lugar de empezar de nuevo en 1 y entregar al host un will que ya había visto, que un host tiene derecho a ignorar por obsoleto. Una reconexión es una sesión nueva, así que también recibe un número nuevo; el código anterior mantenía uno durante toda la vida del proceso porque la biblioteca cliente MQTT reutiliza el will con el que se creó, y ahora el nodo construye un cliente nuevo, y por tanto un will nuevo, en cada intento de conexión. La métrica es INT64, como pide la especificación (antes salía como UInt64; el valor viaja en el mismo campo, así que un host que lo lea por valor no lo nota).

**`NCMD` → `Node Control/Rebirth`.** Un host que pide un rebirth recibe un NBIRTH nuevo, con el mismo `bdSeq`. Un rebirth no es una sesión nueva, así que no recibe un número nuevo (`tck-id-operational-behavior-data-commands-rebirth-action-3`).

## Cuando el enlace ascendente está caído

**El disco es para las interrupciones, no para cada sondeo.** Mientras el enlace ascendente está activo y el broker confirma, las lecturas solo están en memoria hasta que el drenador las ha enviado y el broker las ha confirmado, y no se escribe nada en disco. En el momento en que no hay sesión, no llega una confirmación, o la memoria pasaría de 100.000 lecturas, todo lo que hay en memoria pasa a la cola de disco en orden, todo lo posterior se pone detrás, y el drenador lee del disco, lo más antiguo primero, retirando una lectura solo cuando el broker la ha confirmado. El nodo vuelve a la memoria únicamente cuando el disco está vacío, así que nunca hay un momento en que lecturas más nuevas adelanten a otras más antiguas.

Lo construimos dos veces, y la primera versión era incorrecta para el hardware. Escribía cada lectura en disco antes de enviarla, de modo que una terminación brusca no perdía nada de lo que el nodo había aceptado. Pero también escribía unos 5 MB por segundo a 2.000 lecturas por segundo, que son 450 GB al día, a partir de unos 160 commits de cola por segundo con ocho páginas cada uno. Eso mata una tarjeta SD y es un desgaste absurdo para cualquier memoria flash. El coste de disco en régimen estable es ahora nulo (las cifras están más abajo), y lo que cedimos a cambio se dice con claridad en la sección siguiente.

**Una terminación brusca con el enlace activo pierde lo que había en memoria.** Un SIGKILL, un corte de corriente o un kernel panic, mientras el enlace está activo y el broker confirma, se llevan las lecturas que aún no se habían confirmado. Eso es aproximadamente un sondeo: a 2.000 lecturas por segundo y con un viaje de ida y vuelta de confirmación de unos milisegundos, como mucho unos cientos de lecturas, y el mismo número de sondeos que el host habría visto un momento después. No se cuentan como descartadas, porque nada sabe que existieron. Una parada ordenada (`Stop`, un SIGTERM, un reinicio) escribe primero en disco lo que hay en memoria y no pierde nada. Un enlace cortado tampoco pierde nada en ningún caso, porque lo primero que hace el nodo cuando el enlace deja de confirmar es pasar la memoria al disco. El único caso que este diseño no cubre es que el proceso muera con el enlace activo, y no se cubre a propósito.

`HOTLOOP_EDGE_PUBLISH_QUEUE_MAX_BYTES` limita la cola de interrupción, y el valor por defecto es 64 MiB, unos dos minutos de interrupción a 2.000 lecturas por segundo (el banco de pruebas de abajo lo ejecuta ahí: caben unas 248.000 lecturas, medido en la 4.21.1). Superado el límite, las lecturas más antiguas salen primero y se cuentan. Ponlo en 0 y la cola no tiene límite: el proceso avisa de ello al arrancar, porque una interrupción muy larga con una cola sin límite llena el volumen en lugar de descartar lecturas antiguas, como ya hace la propia cola en memoria del historiador.

Una lectura que el drenador saca a los pocos segundos de ponerse en cola sale como el valor actual del tag, en un único `NDATA` con el resto de su sondeo. Una que esperó más, o que dejó atrás un proceso que murió, sale marcada con `is_historical`, para que un host no deje que sobrescriba lo que el tag está haciendo ahora. Al reconectar, la cola se drena **antes** de publicar nada más reciente, lo más antiguo primero, porque solo hay una salida de ella.

Una reproducción va empaquetada: hasta 200 lecturas históricas comparten un `NDATA`, y cada métrica lleva su propia marca de tiempo e `is_historical`. La especificación lo permite ("Se PUEDEN incluir varios cambios de valor de la misma métrica en el mismo mensaje Sparkplug NDATA ... siempre que tengan marcas de tiempo distintas", Sparkplug B 3.0, Operational Behavior, Data Publish), así que un mensaje nunca contiene un tag dos veces en el mismo milisegundo y empieza el siguiente. Los empaquetamos porque una lectura por mensaje era el cuello de botella, y el perfilado lo confirmó: el 57% de la CPU de la reproducción era la llamada al sistema write que la biblioteca cliente MQTT hace una vez por paquete, y 200.000 lecturas en cola tardaron 58,5 segundos, 3.418 por segundo, frente a una planta que produce 2.000 por segundo. Una reproducción más lenta que la planta es un retraso que nunca termina. Empaquetadas, las mismas 200.000 lecturas tardan 2,9 segundos, 68.237 por segundo, medido cuando el nodo aún estaba en QoS 1. Las lecturas en vivo siguen saliendo un sondeo por `NDATA`.

**QoS 0, como dice la especificación, y un viaje de ida y vuelta para saber que llegó.** NBIRTH y NDATA salen con QoS 0 y sin retained (`tck-id-topics-nbirth-mqtt`, `tck-id-topics-ndata-mqtt`, Sparkplug B 3.0, Topics and Messages, Edge Node). El will de NDEATH es QoS 1 y sin retained (`tck-id-payloads-ndeath-will-message-qos`, Payloads), y también lo es el NDEATH ordenado que publica `Stop`. El problema de QoS 0 es que no hay acuse de recibo: una publicación "se completa" cuando los bytes llegan al socket local, y eso funciona perfectamente hacia un enlace muerto, así que tratarlo como entrega retiraría lecturas del disco justo cuando más importan. En su lugar, el nodo envía una petición detrás de cada fragmento (un SUBSCRIBE a su propio tema NCMD, que de todos modos debe tener permitido hacer) y conserva el fragmento hasta que el broker la responde. Una conexión es un flujo de bytes ordenado y un broker procesa los paquetes de un cliente en el orden en que los lee, así que la respuesta significa que leyó todo lo anterior. Esa es la garantía que daba un PUBACK, un viaje de ida y vuelta por fragmento en lugar de un acuse por mensaje. Una prueba escribe en un enlace silencioso y comprueba que nada sale de la cola, ni de memoria ni de disco; sin el viaje de ida y vuelta, salieron las 30 lecturas que había.

**Una conexión que deja de responder se abandona, no se espera a que termine.** Si el broker no confirma un fragmento, o la biblioteca cliente MQTT no puede aceptar un mensaje, el nodo cierra esa conexión por sí mismo y empieza una sesión nueva (siguiente `bdSeq`, birth nuevo) conservando todo lo no confirmado (pasado a disco, si estaba en memoria). Tiene que hacerlo, porque un enlace que muere sin un reset sigue aceptando escrituras hasta que se llena el búfer de envío del kernel, y entonces la única goroutine de escritura de la biblioteca cliente MQTT queda atascada en un write. Esa es también la goroutine que envía el PING de keepalive, así que el keepalive nunca se dispara y el nodo se queda en la conexión muerta mientras dura la interrupción: un corte de prueba de seis minutos descubrió que no se había dado cuenta hasta que volvió el enlace. Peor aún, la pasada que estaba escribiendo despertó en la conexión nueva y siguió enviando el resto de su fragmento antiguo antes del NBIRTH de la sesión nueva, con los números de secuencia de la sesión anterior. Ahora cada pasada pertenece a la sesión en la que empezó y recibe un error, no el cable, cuando esa sesión ha terminado.

La entrega es **al menos una vez**. Un fragmento que el broker tomó pero nunca confirmó se envía de nuevo, como histórico, y una terminación brusca entre la entrega y el momento en que el nodo lo anota hace lo mismo. Un host que consuma esto debe tolerar un duplicado; nunca debe suponer que esta cola ya eliminó duplicados por él.

### Qué promete, y las cifras que lo respaldan

- **Orden exacto.** Cada lectura de cada tag llega al host en el orden en que se leyó, en vivo y reproducida a la vez, a través de un SIGKILL y de un reinicio.
- **Un archivo acotado.** El límite es sobre el archivo de la cola, lo que llena el volumen, no sobre los datos que contiene. El archivo de la cola son los datos más cabeceras de página, páginas de rama, una lista libre y holgura de crecimiento; con el límite antiguo (el recuento propio de la cola de bytes de hoja) el archivo salía del doble que los datos. Cualquier valor por debajo de 1 MiB funciona como 1 MiB, con un aviso al arrancar.
- **Nada se pierde en una interrupción.** En cuanto el enlace deja de confirmar, cada lectura está en disco y permanece allí hasta que el broker la confirma, de modo que cada lectura vuelve a salir tras una interrupción, una conexión muerta, una parada ordenada, y un SIGKILL o un corte de corriente en mitad de la interrupción. La excepción es la anterior: una terminación brusca o un corte de corriente con el enlace activo pierde aproximadamente un sondeo, las lecturas que seguían en memoria.
- **Descartes ruidosos y contados al superar el límite.** Las lecturas más antiguas salen primero, y cada una pasa a un contador de descartes que vive en el archivo de la cola, de modo que un reinicio no borra la evidencia. Está en `GET /api/diagnostics` bajo `edgePublish` (y en el `/status` del relay bajo `uplink`), junto a lo que hay en cola, el tamaño del archivo y si hay una reproducción en curso. El registro lo dice una vez por minuto mientras ocurre, nunca una vez por sondeo. El contador puede ir un poco por delante de la pérdida y nunca por detrás: las lecturas que el host recibió justo antes de un corte, cuya confirmación nunca llegó, siguen en el disco cuando el límite se las lleva, y se cuentan aunque el host las tiene.
- **Una lectura que solo se ha sondeado puede perderse en una terminación brusca con el enlace activo.** Entre el momento en que el controlador entrega una lectura y el broker la confirma, existe solo en el proceso, y un SIGKILL o un corte de corriente se la lleva. Ese es el precio de no escribir cada sondeo en disco, y lo elegimos frente a 450 GB al día. Termina el proceso cuando no hay nada en vuelo y la respuesta es exacta: cada lectura que entregó la planta se entregó o se contó.

Todo esto está medido con un HotLoop Edge real que sondea 20 dispositivos HTTP con 25 tags cada uno cada 250 ms (2000 lecturas por segundo), publicando en un Mosquitto real. Cada dispositivo responde a cada sondeo con un contador una unidad mayor que el anterior, de modo que un juez del lado del host sabe exactamente qué lectura faltó, cuál volvió dos veces y cuál salió desordenada. El enlace ascendente se corta desconectando el broker de la red: el socket del Edge se queda en silencio, sin reset ni colgado. Para terminar el proceso sin nada en vuelo, la planta se detiene unos segundos antes del SIGKILL ("quiesced"); las demás terminaciones caen donde esté el sondeo ("instant"). Las ejecuciones del 2026-10-12, con un límite de 64 MiB. "Before" es `15419f1`, la compilación anterior a este trabajo. "Write-ahead" es `165411f`, que escribía cada lectura en disco primero y que retiramos. "Now" es memoria mientras el enlace está activo y disco durante una interrupción:

| <span class="sr-only">Details</span> | Antes | Escritura previa | Ahora |
|---|---|---|---|
| Régimen estable, enlace ascendente activo, 2.000 readings/s | 2.018 readings/s, 0 bytes/s a disco, 9% de una CPU | 2.031 readings/s, 5,4 MB/s a disco (450 GB al día), 14% de una CPU | 10 minutos: 2.002 readings/s, 0 bytes escritos en disco (0 bytes al día), 0 páginas escritas del almacén de cola integrado, archivo de cola de 32.768 bytes antes y después, 9% de una CPU |
| Reproducción de una interrupción de 5 minutos, con lecturas que siguen llegando a 2.000 readings/s | 829.745 lecturas en 4 m 11 s, 3.308 por segundo | de 194.247 a 308.582 por segundo | 244.335 lecturas en 824 ms, 296.523 por segundo |
| Contabilidad tras una interrupción de 5 minutos | perdidas 441.255, contadas 441.255 | perdidas 474.978, contadas 474.978 | perdidas 599.165, contadas 599.165, todas las más antiguas, todas por el límite |
| Orden, alias, huecos de secuencia, en vivo dentro de una reproducción | 0, 0, 0, 0 | 0, 0, 0, 0 | 0, 0, 0, 0 |
| SIGKILL sin nada en vuelo, enlace ascendente activo | perdidas 0 | perdidas 0 | perdidas 0 |
| SIGKILL sin nada en vuelo a los 90 s de un corte silencioso de 5 minutos, superado el límite | no se ejecutó | perdidas 528.167, contadas 528.667 | perdidas 520.661, contadas 521.161 (las 500 de más se entregaron, nunca se confirmaron) |
| Diez SIGKILL instantáneos, enlace ascendente activo | perdidas 0 (una ejecución anterior: 50 en cuatro) | perdidas 0 (una ejecución anterior: 250) | perdidas 0 en esta ejecución; una terminación puede llevarse aproximadamente un sondeo, ver arriba |

El coste está en la primera fila. La escritura previa hacía unos 160 commits por segundo (uno por sondeo para ponerlo en disco, uno por fragmento para sacarlo) con unas ocho páginas de 4 KB cada uno, lo que son 5 MB/s y 450 GB al día, y una tarjeta SD no sobrevive a eso. En régimen estable el nodo ya no escribe nada en la cola: el contador `write_bytes` del Edge en `/proc` no se movió en diez minutos. Las diez terminaciones instantáneas no perdieron nada en esa ejecución, y eso es suerte, no una promesa: la ventana son las lecturas en memoria cuando muere el proceso, aproximadamente un sondeo.

Una compilación anterior encontró la otra mitad de aquello para lo que sirvió este trabajo: QoS 0 y una conexión que deja de responder. Ver "Una conexión que deja de responder se abandona" más arriba. El corte de cinco minutos anterior a esa corrección dejó al nodo sentado en una conexión muerta durante toda la interrupción y luego enviando un fragmento obsoleto por delante del birth de la sesión nueva; 100 lecturas llegaron desordenadas.

Una compilación anterior encontró la otra mitad de aquello para lo que sirvió este trabajo: QoS 0 y una conexión que deja de responder. Ver "Una conexión que deja de responder se abandona" más arriba. El corte de cinco minutos anterior a esa corrección dejó al nodo sentado en una conexión muerta durante toda la interrupción y luego enviando un fragmento obsoleto por delante del birth de la sesión nueva; 100 lecturas llegaron desordenadas.

A esa carga, una cola de 64 MiB contiene unos dos minutos de interrupción: unas 248.000 lecturas, que son unos 236 bytes por lectura con nombres de tag de nueve caracteres (medido en la 4.21.1, archivo de cola de 61,7 MB), y un nombre de tag más largo cuesta más. Dimensiona el límite según tu propia tasa y tus propios nombres de tag. Las filas del 2026-10-12 de arriba coinciden: la interrupción de 5 minutos reprodujo 244.335 lecturas, que son los mismos dos minutos. La reproducción ya no es un límite: funciona a más de cien veces la tasa a la que llegan las lecturas.

El juez solía informar de entre 4.000 y 6.000 duplicados en una ejecución sin interrupción. Capturamos el tráfico para averiguar de quién eran: todos eran un NBIRTH que repetía el último valor de un tag que un mensaje anterior ya había llevado, con la marca de tiempo propia de la lectura, y ni uno solo era un NDATA enviado dos veces. Un birth tiene que llevar el valor actual de cada métrica que tiene el nodo (para eso sirve un birth), y el nodo hace birth de nuevo cada vez que aparece un tag nuevo, así que los births posteriores repiten los anteriores. El publicador tenía razón y el juez estaba equivocado. Ahora los cuenta aparte como instantáneas y reserva "duplicado" para una lectura publicada otra vez como dato, que es el único tipo que un host podría confundir con una nueva. En la ejecución estable y en la de diez terminaciones, lo recibido es ahora exactamente igual a lo entregado: 1.296.275 y 916.350.

## Qué se ha verificado y qué no

HotLoop se ha ejecutado con equipos reales y servidores reales, y en hardware real el 2026-11-17.

## Configuración

| Variable | Por defecto | <span class="sr-only">Details</span> |
|---|---|---|
| `HOTLOOP_EDGE_PUBLISH_ENABLED` | `false` | La función está desactivada hasta que se establece |
| `HOTLOOP_EDGE_PUBLISH_BROKER` | n/d | Host solo, `host:port`, o una URL completa |
| `HOTLOOP_EDGE_PUBLISH_GROUP` | n/d | Id de grupo Sparkplug |
| `HOTLOOP_EDGE_PUBLISH_NODE` | nombre de host del pod | Id de nodo Sparkplug |
| `HOTLOOP_EDGE_PUBLISH_USER` / `_PASSWORD` | n/d | Credenciales del broker |
| `HOTLOOP_EDGE_PUBLISH_TLS` | `false` | |
| `HOTLOOP_EDGE_PUBLISH_TLS_SKIP_VERIFY` | `false` | Se activa por despliegue; nunca lo establezcas por defecto |
| `HOTLOOP_EDGE_PUBLISH_QUEUE_PATH` | `/data/forward.db` | El archivo de la cola de reenvío |
| `HOTLOOP_EDGE_PUBLISH_QUEUE_MAX_BYTES` | `67108864` (64 MiB) | El archivo de la cola nunca crece más allá de esto; las lecturas más antiguas se expulsan, y se cuentan, para mantenerse por debajo. `0` es sin límite, con un aviso. Cualquier otro valor por debajo de 1 MiB funciona como 1 MiB, con un aviso |

## En el chart de Helm

El chart del Gateway tiene un bloque `edgePublish:` que establece todo esto. Está desactivado por defecto, y desactivado produce exactamente lo que el chart producía antes de que existiera el bloque. Ya no establezcas esto mediante `extraEnv`.

```yaml
edgePublish:
  enabled: true
  broker: tcp://central.example.local:1883
  group: Plant1
  node: ""               # empty uses the release name
  username: ""
  password: ""           # goes into a chart-managed Secret
  existingSecret: ""     # or name your own Secret (key: secretKey)
  tls: false
  tlsSkipVerify: false
  queueMaxBytes: 67108864   # 64 MiB; 0 is unbounded
  persistence:
    enabled: true
    size: 1Gi
```

El chart decide algunas cosas por ti:

- El archivo de la cola es `/data/edge-publish/forward.db`, en su propio PVC. No es un valor, porque en cualquier otro punto del pod el sistema de archivos raíz es de solo lectura. Con `persistence.enabled: false` va a un emptyDir, que conserva las lecturas de una interrupción durante un reinicio del contenedor pero no durante un pod reprogramado.
- El id de nodo es por defecto el nombre de la release, no el nombre de host del pod. Un pod de Deployment recibe un nombre de host nuevo en cada despliegue, y el host vería un nodo de borde nuevo cada vez, con las lecturas almacenadas reproducidas bajo él.
- El Deployment pasa a `Recreate` y `replicaCount` debe ser 1. El archivo de la cola toma un bloqueo: en una actualización progresiva el pod nuevo no puede abrirlo, nunca queda listo, y el despliegue se queda colgado. Y dos réplicas serían dos publicadores en un mismo id de nodo.

El chart del Edge Relay (`charts/hotloop-edge-relay`) tiene su propio bloque `edgePublish:` en la misma línea, sin `enabled`: el relay siempre publica.
