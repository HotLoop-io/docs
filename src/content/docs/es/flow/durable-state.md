---
title: "Estado duradero, con mediciones"
description: "Contexto que sobrevive a un reinicio y cables duraderos que solo tocan el disco cuando el destino deja de responder, con las cifras de ambos."
---

Que un historiador se caiga una hora no debería costarle una hora de lecturas, siempre que la caída quepa en la cuota de disco (256 MiB por defecto: cerca de una hora a 100 lecturas por segundo con lecturas de 120 bytes, medido en 2.13.1), y un contador de un flujo no debería empezar de cero porque el pod se movió. Ambas cosas son un archivo SQLite en el volumen, y esta página explica qué se guarda en él, qué garantiza, qué no garantiza y cuánto le cuesta a una tarjeta flash.

Un solo archivo, `state.db`, en el directorio de datos. El contexto persistente y las colas de los cables duraderos lo comparten, porque dos almacenes serían dos cosas que dimensionar, respaldar y mantener sincronizadas.

## Contexto que sobrevive a un reinicio

El contexto de flujo, global y de nodo se carga desde el archivo la primera vez que se usa un ámbito y después vive en memoria, de modo que las lecturas nunca tocan el disco y `CompareAndSwap`, `Increment` y `Update` son el mismo código de antes, atómico bajo el mismo bloqueo. Un reinicio le devuelve su contador y sigue desde ahí, y un `CompareAndSwap` contra un valor que volvió del disco sigue funcionando, incluido el entero que guardó un nodo function.

Lo que se cede es a propósito: las escrituras van con retraso. Un valor modificado espera `store.context.flushInterval` (30 segundos) y todo lo que cambió en esa ventana pasa al archivo en una sola transacción. Diez mil incrementos de un contador en una ventana son una fila escrita. Un valor puesto a lo que ya valía no es ninguna escritura, que es el caso del flujo que guarda la misma temperatura cada segundo y de la tarjeta SD que, de otro modo, lo odiaría por ello. Una parada limpia lo escribe todo primero. Un `kill -9` o un corte de corriente pierde hasta el intervalo. Póngalo en `0s` y cada cambio se escribe antes de que vuelva la llamada, y la tarjeta lo paga.

Solo sobrevive a un reinicio lo que sobrevive a JSON: números, cadenas, booleanos, fechas y horas, búferes de bytes, listas y objetos. Si pone una función o un socket en el contexto, el `set` falla y nombra la clave, en lugar de guardar la mitad. El contexto de un nodo se va cuando se borra el nodo y el de un flujo cuando se borra la pestaña, en el despliegue, el mismo barrido que hace Node-RED.

## Cables duraderos

Marque un cable como duradero en el nodo de donde sale. La clave es `ew_durable`, una lista de los ids de los nodos a los que va ese cable, y el archivo del flujo sigue cargándose y guardándose byte por byte porque otras herramientas la ignoran:

```json
{
  "id": "count", "type": "function", "z": "line3", "x": 290, "y": 100,
  "ew_durable": ["influx"],
  "wires": [["influx", "reply"]]
}
```

Todos los cables de `count` a `influx` son ahora duraderos. El cable a `reply` sigue siendo uno corriente.

Lo que hace un cable duradero:

- **No escribe nada mientras el destino sigue el ritmo.** Los mensajes pasan de la memoria directamente al buzón del destino, igual que en un cable corriente, y la base de datos de estado no se toca. Fijamos esa regla después de que un diseño que escribía todo primero midiera cientos de gigabytes al día en una tarjeta flash por un fallo que ocurre unas pocas horas al año.
- **Vuelca a disco cuando no lo sigue.** El cable empieza a volcar en cuanto el manejador del destino devuelve un error, su buzón está lleno o no se está ejecutando. A partir de ahí cada mensaje se confirma en el archivo antes de que vuelva el `Send` del nodo emisor, así que, una vez que el emisor ha seguido adelante, un `kill -9` no puede llevárselo. Los mensajes que ya iban de camino al destino se desvían a disco detrás del que falló, en orden. En el ejemplo anterior `reply` va en segundo lugar en el cableado, así que mientras el cable vuelca, un HTTP 200 significa que la lectura está en disco.
- **Se vacía en orden, por lotes donde el destino los acepta.** Una bomba entrega al destino los mensajes más antiguos del disco y espera hasta que los acepta. Nada que vaya detrás de un mensaje lo adelanta. Un destino que escribe en una base de datos puede aceptar una tanda de hasta 256 mensajes como una sola escritura, y `influxdb out` lo hace: con el historiador respondiendo una escritura en 8 ms, una acumulación se vaciaba a unas 110 lecturas por segundo de una en una, algo que una planta que envía 100 por segundo apenas reducía, y se vacía a la velocidad que permiten las escrituras cuando cada una lleva unos cientos. Cualquier otro destino sigue recibiendo un mensaje cada vez. Si un lote no se acepta, los mensajes anteriores al primero que falló se marcan como hechos, ese se reintenta solo con el reintento que se describe más abajo y el resto se vuelve a enviar como lote. Cuando la cola está vacía, el cable vuelve a la memoria y deja de escribir.
- **Reintenta lo que el destino falla.** El mismo mensaje se vuelve a enviar a los 250 ms, luego a los 500 ms, duplicando hasta 5 segundos, durante todo el tiempo que haga falta. Los nodos Catch del flujo se enteran del primer fallo y no de cada reintento. Un destino que está parado, que un despliegue ha reemplazado o que no ha podido arrancar se espera, no se salta.
- **Sobrevive a un reinicio.** Lo que quede en disco cuando el proceso vuelva se entrega primero.
- **Respeta una cuota de disco.** `store.durable.maxBytes` (256 MiB) abarca todos los cables duraderos juntos, contando el cuerpo de cada mensaje más 64 bytes. Cuando se llena, decide el nodo al que va el cable según la política de desbordamiento que ya tiene: `block` espera hasta `blockTimeout` a que haya espacio y después da error, `drop-newest` rechaza el mensaje que llega, `drop-oldest` expulsa el mensaje más antiguo que no se esté entregando, `error` lanza el error a un nodo Catch. Cada caso se cuenta y se anuncia como un evento de descarte. Una excepción: un mensaje ya aceptado en memoria que el cable tiene que pasar a disco entra aunque supere la cuota, porque rechazarlo supondría descartar uno más antiguo y conservar otros más recientes. El exceso es como máximo lo que contiene el destino, su buzón más el mensaje que su goroutine ha tomado y aún no ha empezado, así que la cuota puede marcar unos pocos mensajes de más durante un momento. El archivo ocupa algo más que la cuota, por la sobrecarga de páginas de SQLite y el registro de escritura anticipada, y una prueba lo llena, lo vacía y lo vuelve a llenar seis veces para demostrar que no sigue creciendo.
- **Muestra su profundidad.** `hotloop_flow_durable_wire_depth{wire="..."}` son los mensajes en espera, con `_bytes`, `_delivered_total`, `_retries_total` y `_dropped_total` a su lado, y `hotloop_flow_durable_bytes` frente a `hotloop_flow_durable_max_bytes` es la cuota.
- **No reinicia el nodo.** Marcar un cable como duradero en un flujo en ejecución es un cambio de cableado, como mover un cable.

Un cable que deja de ser duradero, o que se borra, ve su cola purgada, contada como descartada y anunciada. Esos mensajes no tienen adónde ir, y conservarlos llenaría la cuota con una cola que nadie puede ver.

### Lo que promete y lo que no

**Mientras el cable está sano hay una ventana de pérdida.** Lo que está en memoria es el buzón del destino y la llamada que está haciendo, y un `kill -9` o un corte de corriente se lo lleva. Ese es el precio de no escribir nada, y lo aceptamos a propósito: con un buzón de 1024 y un destino rápido son los mensajes de más o menos un sondeo. Cuando el cable ya está volcando, que es cuando el destino está caído y los datos corren riesgo, no hay ventana. La prueba con kill -9 de más abajo se hace a mitad de la caída por esa razón, con la cola en disco. No matamos el runtime con el cable sano para contar, porque la respuesta es "se pierden unos pocos" y ese es el diseño.

**La entrega es al menos una vez.** El destino ha tomado un mensaje cuando su manejador vuelve sin error, y el cable lo marca como hecho en disco después. Un `kill -9` entre ambos pasos significa que el mensaje se vuelve a enviar tras el reinicio. Cuántos depende de `store.durable.ackFlush`: las marcas se escriben juntas, así que con el valor por defecto `100ms` son los mensajes terminados en los últimos 100 ms, y con `0s` cada marca se escribe antes de enviar el mensaje siguiente, de modo que son como mucho el que va en vuelo, o el lote en vuelo, hasta 256 mensajes, para un destino que acepta lotes.

Eso suena a agujero, así que esto es lo que lo cierra para el destino para el que se construyó. Un mensaje que cruza un cable duradero lleva el sello `msg._queuedAt` con la hora a la que entró en el cable, y `influxdb out`, sin marca de tiempo configurada, escribe el punto a esa hora. Una repetición es la misma serie a la misma hora, que InfluxDB trata como una sobrescritura, así que el número de filas no cambia. También corrige lo otro que sale mal con el almacenamiento y reenvío: sin él, cada lectura retenida durante una caída se sella cuando InfluxDB vuelve, y una hora de historial llega en un minuto. Un destino que sella al llegar, un `now()` en un insert de Postgres por ejemplo, guardaría una repetición dos veces, y además pondría la hora reproducida en el lugar equivocado. Use `msg._queuedAt`.

**"Tomado" solo es tan fuerte como el nodo.** `influxdb out` hace su escritura dentro del manejador, así que tomado significa escrito. Un nodo que pasa el trabajo a otra goroutine y vuelve ha prometido menos, y el cable no puede ser más duradero que aquello a lo que está conectado.

**Algunas propiedades no hacen el viaje.** Un manejador vivo no puede cruzar un reinicio ni recibir respuesta después, así que `msg.req` y `msg.res` (los del nodo HTTP In) y cualquier otra cosa que no se pueda serializar se dejan fuera de los mensajes de un cable duradero, y la primera vez que ocurre en un cable se registra en el log con el nombre de la propiedad. La carga útil nunca se deja fuera: si no se puede guardar, el mensaje se rechaza con un error que nombra la ruta.

**Un mensaje defectuoso puede retener un cable.** Un destino que falla siempre el mismo mensaje lo recibe siempre, con la pausa de 5 segundos entre intentos, y los mensajes de detrás esperan. El contador de reintentos y la profundidad son la forma de verlo. Es lo correcto para un historiador caído. Es lo incorrecto para un mensaje mal formado, así que a un cable se le puede dar un límite: `"ew_durable_attempts": {"influx": 20}` en el nodo de donde sale, o el cuadro de diálogo del cable en el editor. Cuando el destino ha rechazado un mensaje tantas veces desde la cola, este llega al flujo como un error del nodo que lo rechazó, con el mensaje adjunto, un nodo Catch puede apartarlo y el cable sigue. Sin la clave, nada cambia. Sigue sin haber una cola de mensajes fallidos: un nodo Catch es donde se construye, y `hotloop_flow_durable_wire_given_up_total` cuenta lo que fue allí.

## Ajustes

```yaml
store:
  path: ""              # empty is state.db in data.dir
  synchronous: normal   # normal | full
  context:
    persist: true
    flushInterval: 30s  # 0s writes every change at once
  durable:
    maxBytes: 268435456
    ackFlush: 100ms     # 0s marks each message before the next is sent
```

Entorno: `HOTLOOP_FLOW_STORE_PATH`, `HOTLOOP_FLOW_STORE_SYNCHRONOUS`, `HOTLOOP_FLOW_CONTEXT_PERSIST`, `HOTLOOP_FLOW_CONTEXT_FLUSH_INTERVAL`, `HOTLOOP_FLOW_DURABLE_MAX_BYTES`, `HOTLOOP_FLOW_DURABLE_ACK_FLUSH`. El chart usa los mismos nombres bajo `store:` en `values.yaml`.

`synchronous: normal` ejecuta el archivo en modo de escritura anticipada sin un fsync en cada confirmación. Una confirmación sobrevive a que maten el proceso, que es la prueba con `kill -9` de más abajo. No sobrevive a un corte de corriente en todos los sistemas de archivos. `full` sí, y `full` es el que desgasta la tarjeta.

## La prueba

Medido con un InfluxDB 2.9.1 real en Podman. No se simula nada.

Un productor envía al flujo de flow.json una lectura numerada veinte veces por segundo. El flujo la cuenta en el contexto de flujo y la manda por un cable duradero a `influxdb out`. La lectura no lleva marca de tiempo, así que un mensaje entregado dos veces serían dos filas. Un pequeño paso intermedio entre el flujo e InfluxDB registra cada escritura que InfluxDB aceptó, porque InfluxDB trata un punto escrito dos veces a la misma hora como un solo punto y las filas por sí solas no pueden mostrar una repetición.

| Hora | Qué pasó |
|---|---|
| 00:13:53 | El flujo arrancó, 20 lecturas por segundo. |
| 00:14:53 | `podman kill` a InfluxDB. Permanece caído diez minutos. El cable vuelca a disco. |
| 00:19:54 | Cinco minutos después, profundidad de cola 5,989 en disco. `kill -9` al runtime. |
| 00:19:59 | El runtime arrancó de nuevo, InfluxDB sigue caído. Encuentra 5,992 mensajes en disco y sigue aceptando nuevos. |
| 00:24:59 | InfluxDB arrancó. Profundidad de cola 11,989. |
| 00:25:25 | Vaciando, profundidad de cola 5,987. `kill -9` al runtime otra vez, a mitad de la cola. |
| 00:25:30 | El runtime arrancó de nuevo con 5,948 en disco. |
| 00:25:53 | Acumulación vaciada. Noventa segundos más de entrada constante, luego un recuento. |

```
deliveries      15987 writes InfluxDB answered 204 to
delivered twice 5 [7829, 7830, 7831, 7832, 7833]
sent            16185
accepted (200)  15982
failed          203
rows stored     15982
distinct seqs   15982
missing         0 []
doubled         0 []
unacked stored  0 []
```

Cada lectura a la que el flujo respondió 200 está en InfluxDB, una vez. **Ninguna falta, ninguna duplicada.** Las 203 que fallaron fueron peticiones que llegaron mientras el runtime estaba caído, que es el productor al que se le dice que no, y ninguna se guardó.

A InfluxDB se le entregaron cinco mensajes dos veces. Son los que la segunda parada con kill atrapó entre que InfluxDB los tomó y que la marca de "hecho" llegó al disco, dentro de la ventana de `ackFlush`. Cada uno llevaba el mismo `_queuedAt`, así que la segunda escritura sobrescribió la primera y el número de filas no se movió. Así es [al menos una vez](#lo-que-promete-y-lo-que-no) cuando funciona. También es lo que un destino que sella al llegar habría guardado dos veces.

Lo que esto no cubre: un `kill -9` con el cable sano. Las lecturas que están en memoria en ese momento se pierden, por diseño, y no las contamos.

## Lo que escribe en disco

`write_bytes` de `/proc/<pid>/io` es lo que se le pidió al kernel que enviara al almacenamiento del proceso, descontadas las escrituras canceladas. Ese es el número que le importa a una tarjeta flash. Cada fila son 300 segundos de un escenario, tras 30 segundos para estabilizarse, con disk-writes.sh. El flujo es el flujo de la prueba con InfluxDB detrás, así que la carga es real.

```bash
BIN=./hotloop-flow SECS=300 bash docs/durable/disk-writes.sh
```

| Escenario | Tasa | Vaciado de contexto | Escrito por hora | Por día |
|---|---|---|---|---|
| Inactivo, un cable duradero en el flujo | ninguna | 5 s | 0 bytes | 0 |
| Cable duradero sano, carga constante | 20 msg/s | 30 s | 1.7 MiB | 0.04 GB |
| Cable duradero sano, carga constante | 50 msg/s | 30 s | 1.2 MiB | 0.03 GB |
| Igual, contexto vaciado cada 5 s | 20 msg/s | 5 s | 5.1 MiB | 0.12 GB |
| Igual, contexto vaciado cada 5 s | 50 msg/s | 5 s | 4.2 MiB | 0.10 GB |
| Solo contexto, cable corriente | 20 msg/s | 30 s | 1.2 MiB | 0.03 GB |
| Cable volcando, InfluxDB caído | 20 msg/s | 5 s | 728 MiB | 17 GB |
| Cable volcando, `synchronous: full` | 20 msg/s | 5 s | 1,011 MiB | 24 GB |

Léalo en tres partes.

**Inactivo no escribe nada.** Cero bytes en cinco minutos.

**Un cable sano no escribe nada propio.** Las filas sanas son contexto persistente, un contador incrementado en cada mensaje, y nada más. La fila de solo contexto con un cable corriente está dentro del ruido de ellas. El vaciado de contexto por defecto fue de cinco segundos hasta esta tabla: a veinte mensajes por segundo eran 5.1 MiB por hora, 0.12 GB al día, y con treinta segundos baja a 1.7 MiB, y por eso el valor por defecto es treinta. Un kill -9 pierde entonces hasta treinta segundos de contexto.

**Un cable que vuelca es caro, y solo mientras vuelca.** Cada mensaje es su propia confirmación, unos 10 KB de escrituras cada uno, porque el emisor espera al disco. Diez minutos de caída a veinte por segundo son unos 120 MiB, una caída de un día entero unos 17 GB. Ese es el coste de "en disco antes de que el emisor siga", que se paga solo mientras el historiador está caído. La confirmación en grupo comparte una transacción entre emisores concurrentes, pero un emisor hace una confirmación.

Una cifra más, porque me sorprendió. A 100 mensajes por segundo este banco de pruebas no mantuvo sano el cable: el destino dejó de seguir el ritmo, el cable volcó y siguió volcando durante toda la prueba, 3,548 MiB por hora. No averiguamos si lo lento era el paso intermedio o InfluxDB. Es el diseño funcionando como está escrito, porque "acumulando" cuenta como no seguir el ritmo, y significa que un destino más lento que su entrada pone un cable duradero en el disco. A 50 mensajes por segundo siguió sano.

El diseño anterior a este escribía cada mensaje en disco primero. Con el primer esquema (páginas de 4 KiB, una tabla y un índice) midió 632 MiB por hora a 20 mensajes por segundo incluso con InfluxDB sano, y 1,163 MiB con cada marca de "hecho" escrita al instante. De ahí viene "disco solo durante una caída".

### En hardware real

Estas cifras se midieron en una máquina x86 bajo WSL2, y desde entonces el almacén duradero se ha ejecutado en hardware real (2026-11-17). Los bytes escritos son una propiedad del código y del tamaño de página, así que las cifras anteriores se mantienen. Lo que una tarjeta hace con ellos (amplificación de escritura, desgaste) no, y tampoco la memoria, el tiempo de arranque y los mensajes por segundo sostenidos, así que esos números siguen indicando dónde se midieron.
