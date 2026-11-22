---
title: "Pruebas junto a los flujos"
description: "Escriba un archivo de pruebas junto a un flujo, ejecútelo con un reloj simulado, condicione el despliegue a que pase y nada sale de la prueba."
---

"¿Mi cambio rompió la línea?" debe responderse antes del despliegue, por quien hace el cambio, y no a las 3 de la madrugada por quien está de guardia. Por eso un flujo puede tener pruebas, que son YAML y viven junto al archivo del flujo y pasan por la misma revisión:

```yaml
# line3.test.yaml
flows: line3.json            # relative to this file; flows.json if you leave it out
tests:
  - name: a high reading raises the alarm and nothing else
    inject:
      - node: reading                  # by name or by id
        msg: {topic: line3/temp, payload: 92.5}
    expect:
      - node: over limit?              # the Switch
        port: 1
        msg: {payload: 92.5}
        within: 500ms
      - node: over limit?
        port: 2
        nothing: true
      - node: alarm out                # a Debug: checked on what it received
        msg: {payload: HIGH}

  - name: a negative reading is caught, not alarmed on
    inject:
      - node: reading
        msg: {payload: -4}
    expect:
      - node: errors                   # a Catch node
        error: "out of range"
```

```bash
hotloop-flow test -junit report.xml line3.test.yaml
```

```
--- PASS: a high reading raises the alarm and nothing else (0.00s)
--- PASS: a negative reading is caught, not alarmed on (0.00s)
ok	line3.test.yaml	2 passed, 0 failed, 0 errors (0.00s)
```

Eso es el runtime real y los nodos reales, dentro del proceso, sin servidor y sin editor. Cada prueba tiene su propio runtime, así que nada que una prueba deje en un Delay o en un contexto puede filtrarse a la siguiente.

- **`inject`** introduce mensajes, en orden, y cada uno se procesa antes de que entre el siguiente. Un nodo con entrada lo recibe ahí. Un origen como un Inject o un MQTT In lo envía por su primera salida como si lo hubiera producido, y a un nodo Inject sin mensaje se le pulsa el botón.
- **`expect`** observa la salida de un nodo, contando los puertos desde 1 como hace el editor. Un nodo sin salidas, como un Debug, se comprueba con lo que recibió. Una instancia de subflujo se observa en sus propias salidas, vengan de donde vengan dentro de ella.
- **`msg`** es lo que debe contener el mensaje. Cada propiedad que indique tiene que estar ahí con ese valor, hasta el fondo, y cualquier otra cosa del mensaje se ignora, de modo que una prueba sobre el payload no se rompe cuando alguien empieza a poner `msg.topic`. **`assert`** es una expresión JSONata que tiene que dar verdadero, para las comprobaciones que un literal no puede hacer. **`error`** es el texto que debe contener el error capturado por un nodo Catch.
- **`within`** es un plazo. Un mensaje que llega tarde falla, y el fallo dice cuánto se retrasó. **`nothing: true`** y **`count: N`** se comprueban cuando el flujo se ha quedado en silencio, que es el único momento en que "no salió nada" significa algo. Dos expectativas en un mismo puerto son dos mensajes, en ese orden.

Una prueba termina en cuanto ha ocurrido todo lo que espera y el flujo no tiene nada más que hacer. El `timeout` es de 5 segundos salvo que usted indique otro, en el reloj propio de la prueba, que es la sección siguiente.

Un fallo dice qué salió en su lugar y en qué se diferencia:

```
--- FAIL: the alarm says LOW (0.00s)
    expect 1: debug "alarm out" (alarm-out): 1 message(s) received and none matched; the first one differs at msg.payload: wanted "LOW", got "HIGH"
      at 0s: {"payload":"HIGH","topic":"line3/temp"}
```

Una prueba que no puede ejecutarse es un error, no un acierto: un nodo que nombra y no está en el flujo, un nombre que comparten dos nodos, un puerto que el nodo no tiene o un nodo del flujo que no arranca. Lo mismo ocurre con una clave mal escrita. `expcet:` se rechaza al leer el archivo, porque un error tipográfico omitido en silencio dejaría una prueba sin nada que comprobar, y una prueba sin nada que comprobar pasa. El estado de salida es 1 para cualquier resultado que no sea que todo pase, y `-junit` escribe el informe que lee cualquier sistema de CI.

## En el reloj de la prueba

Nadie ejecuta un conjunto de pruebas que espera un Delay de cinco minutos, así que una prueba no espera. Lleva su propio reloj y lo mueve directamente a lo siguiente que algo del flujo está esperando: un Delay que suelta, el segundo mensaje de un Trigger, un Inject con intervalo o crontab, un Join o un Batch que vence, un Link Call que se rinde. El temporizador se dispara, el flujo procesa lo que envió y solo entonces el reloj busca lo siguiente pendiente, en el mismo orden que habrían seguido los minutos reales. Cinco minutos de Delay son un paso y aproximadamente un milisegundo.

```yaml
  - name: a reading at 4m pushes the watchdog's off out to 9m
    clock: 2026-10-05T06:00:00Z     # when the test starts; the real time if you leave it out
    timeout: 20m
    inject:
      - {node: watchdog, msg: {payload: reading}}
      - {node: watchdog, msg: {payload: reading}, at: 4m}   # at: on the test's clock
    expect:
      - {node: watchdog, msg: {payload: "on"}}
      - {node: watchdog, msg: {payload: "off"}, within: 9m}

  - name: and not a moment before
    timeout: 8m59s
    inject:
      - {node: watchdog, msg: {payload: reading}}
      - {node: watchdog, msg: {payload: reading}, at: 4m}
    expect:
      - {node: watchdog, count: 1}  # the "on", and nothing else yet
```

**`at`** coloca una inyección en un momento del reloj de la prueba, y todo lo que vence antes ocurre primero. **`within`** y **`timeout`** también van en ese reloj, así que `timeout: 1h` en un flujo con un Inject cada diez minutos son seis ticks y unos milisegundos. **`clock`** fija cuándo empieza la prueba, para un flujo que depende de la hora: un crontab que se dispara a las seis y media se dispara cuando el reloj de la prueba marca las seis y media. El `Date` de un nodo Function, la marca de tiempo de un Inject, un nodo Change que fija una fecha y el `Expires` de una cookie leen el mismo reloj, de modo que un flujo que marca y compara horas es coherente consigo mismo en una prueba.

El conjunto de pruebas verifica con él todos los nodos de temporización de la paleta, al milisegundo: Delay en sus modos fijo, aleatorio, de tasa y temporizado, Trigger con extend, Inject por intervalo, una vez al arrancar y con crontab, los vencimientos de Join y Batch y un Link Call que nunca recibe su respuesta. Todo, incluida una hora de tiempo de planta, se ejecuta en bastante menos de un segundo. Lo que una prueba no puede mover es la CPU: un flujo que sigue ocupado pasado un minuto de tiempo real hace fallar la prueba en lugar de bloquear el conjunto. `$now()` y `$millis()` de JSONata siguen leyendo el reloj real.

## Pruebas desde el editor

Nadie escribe una prueba para un flujo que funciona. La escribe el día en que deja de funcionar, que es un día tarde. Por eso el editor crea una a partir de lo que el flujo acaba de hacer, en dos clics.

Cada mensaje del panel de depuración tiene un botón **Test**. Púlselo y el editor redacta una prueba a partir de ese mismo mensaje: lo que entró por el origen por el que entró, vuelto a introducir, y lo que mostró este nodo Debug, esperado aquí. Cambie lo que quiera, porque una lectura con marca de tiempo se comprueba mejor con un `assert` que fijada al milisegundo. Pulse **Add to tests** y queda en el conjunto junto al archivo del flujo, al final, con todo lo que ya estaba escrito exactamente como estaba, comentarios incluidos. Un nombre que el conjunto ya tiene recibe un número al final en lugar de reemplazar nada.

Cómo sabe el editor qué entró: el runtime guarda los últimos 64 mensajes que entraron al flujo por un origen y los últimos 64 que llegaron a un nodo Debug, bajo el id que un mensaje lleva de un nodo al siguiente. Es un anillo con un tamaño máximo, y un mensaje de más de 64 KB no se guarda, así que nunca puede ser lo que haga crecer un pod. Un mensaje que ha sido desplazado, o que un nodo reemplazó por uno nuevo por el camino, no se puede redactar, y el editor lo dice en lugar de adivinar qué entró.

El panel **Tests** ejecuta el conjunto contra la copia de trabajo, desplegada o no, que es lo importante: lo sabe antes del despliegue. Cada nodo por el que pasó una prueba correcta recibe una marca de verificación, cada nodo del que trata un fallo recibe una cruz con el motivo al pasar el cursor, y al pulsar un fallo va a su nodo. Edite cualquier cosa y las marcas desaparecen, porque describen un flujo que ya no existe. **Edit** abre el conjunto completo como YAML. Un despliegue que la [compuerta](#la-compuerta-de-despliegue) rechaza aparece en el mismo panel, con los fallos en los nodos.

Todo esto se ejecuta en un navegador real contra el binario real en cada pull request.

## La compuerta de despliegue

Las pruebas en el portátil de alguien demuestran el flujo que tenía en su portátil. La compuerta demuestra el que se está desplegando. Guarde el conjunto en la instancia, junto al archivo del flujo que prueba (`data/flows.test.yaml` junto a `data/flows.json`, mediante `PUT /tests` o el editor), active `tests.gate`, y cada despliegue lo ejecuta contra los flujos que va a poner en marcha. Uno que no pasa se rechaza, con un 422 y el informe completo:

```
$ hotloop-flow deploy -file flows.json -note "raise the alarm at 95"
1 changed

Tab "Line 3" (t1)
  ~ switch "over limit?" (chk)
      rules[0].v: "80" -> "95"
hotloop-flow: the deploy was refused: 1 of 2 flow tests didn't pass, and the flows already running are untouched; "a high reading raises the alarm and nothing else": expect 1: switch "over limit?" (chk): nothing sent from port 1

--- FAIL: a high reading raises the alarm and nothing else (0.00s)
    expect 1: switch "over limit?" (chk): nothing sent from port 1
    expect 2: switch "over limit?" (chk): expected nothing, and 1 message(s) sent from port 2
      at 0s: {"payload":92.5,"topic":"line3/temp"}
    expect 3: debug "alarm out" (alarm-out): nothing received
--- PASS: a negative reading is caught, not alarmed on (0.00s)
FAIL	flows.test.yaml	1 passed, 1 failed, 0 errors (0.00s)
```

Es una ejecución real: el binario con la compuerta activada, el conjunto del principio de esta sección guardado junto a su archivo de flujo y un token de despliegue.

**Los flujos que ya están en marcha no se enteran.** La compuerta se ejecuta antes de escribir un solo byte: ni archivo de flujos, ni credenciales, ni registro de despliegue, ni reinicio. El rechazo queda en el registro de auditoría como un `deploy.refused` que indica que fallaron las pruebas. Y las pruebas no se ejecutan en absoluto en el proceso del servidor. Se ejecutan en un proceso hijo, este mismo binario como `hotloop-flow test -stdin`, al que se entregan por stdin los flujos candidatos y el conjunto, porque una prueba arranca todos los nodos del flujo y algunos se registran donde todo el proceso los comparte: un Link In por su id, una ruta HTTP por su ruta. Ejecutado aquí dentro, el Link In del candidato respondería por el del flujo en marcha en cuanto arrancara. En un proceso hijo no puede tocar nada de lo que usa la línea, un nodo que entra en pánico en una goroutine propia derriba la prueba y no la planta, y la memoria se devuelve al terminar. La prueba lo demuestra por las malas: el candidato rechazado tiene el mismo Link In, y tras el rechazo un mensaje por el enlace del flujo en marcha sigue llegando.

Tres decisiones que conviene conocer. **Viene desactivada por defecto**, porque una compuerta que el operador no pidió es un despliegue que falla a las 3 de la madrugada por un motivo que nadie del turno conoce. **Las pruebas que no pueden ejecutarse no pasan**: un hijo que no arranca o una ejecución más larga que `tests.timeout` rechaza el despliegue y dice cuál de los dos. Y **los rollbacks no pasan por la compuerta.** Un rollback es la forma de salir de un mal estado hacia uno que ya funcionó, y retenerlo por las pruebas de hoy es la manera de alargar una caída. Con la compuerta activada y sin conjunto de pruebas no hay nada que pueda fallar, así que el despliegue sigue y el registro dice por qué no se comprobó.

## Contexto y credenciales

Toda prueba empieza con el contexto vacío, sea lo que sea lo que dejó la anterior. Un contador que una prueba llevó a 42 no es donde empieza la siguiente, porque un conjunto en el que la segunda prueba solo pasa si la primera se ejecutó antes es un conjunto que miente el día en que alguien ejecuta una sola prueba. Así que una prueba que necesita un contador en 41 lo dice, y dice qué debe contener el contexto al terminar:

```yaml
  - name: picks up where the line left off
    context:                        # what the test starts with
      global: {limit: 90}
      flow: {Line 3: {count: 41}}   # flow context, by tab label or id
    credentials:                    # by node name or id; never the real ones
      historian: {token: test-token}
      plc api: {password: s3cret}
    inject: [{node: count, msg: {payload: 95}}]
    expect:
      - {node: out, msg: {count: 42}}
      - context:                    # what it holds at the end
          global: {alarm: true}
          flow: {Line 3: {count: 42}}
          node: {count: {last: 95}} # node context, by node name or id
```

`context` en una expectativa se compara igual que `msg`, y `null` significa que la clave no debe estar definida. Un fallo dice qué contiene realmente el ámbito, porque lo habitual es un error tipográfico: `flow context of "Line 3" (t1): cuont: not set; it holds count`.

Una prueba nunca ve las credenciales reales. Se ejecuta con las que ella nombra, y eso es lo que hace seguro confirmarla en el repositorio, y llegan a un nodo exactamente como llegarían las reales: la contraseña de una petición HTTP aparece en la cabecera `Authorization` que habría enviado, y una configuración de InfluxDB que no arranca sin token arranca con el de la prueba. Un nodo que lee una contraseña de un archivo montado mediante `ew_credentialFiles` recibe en su lugar la credencial de la prueba para ese campo, porque una prueba no lee nada del disco, y una vacía cuando la prueba no nombra ninguna.

El contexto vive en memoria durante una prueba, nunca en la base de datos de estado, así que una prueba no puede leer lo que dejaron los flujos en marcha ni dejarles nada. Un fixture es YAML dentro de la prueba, no un archivo que finge ser una base de datos.

## Nada sale de la prueba

Una prueba que ejecutara de verdad su MQTT Out publicaría en el broker de la planta, y entonces ya no es una prueba, es un despliegue. Por eso, en una prueba, todo nodo que habla con el mundo fuera del proceso recibe un sustituto: MQTT de entrada y salida, HTTP in, response y request, PostgreSQL, InfluxDB, TCP y UDP de entrada, salida y petición, WebSocket de entrada y salida y el listener y el cliente que hay detrás, los nodos de archivo, `exec`, `scan` y `netinfo`.

El nodo sigue haciendo todo su trabajo hasta llegar al cable. El MQTT Out sigue calculando el tema, el QoS y los bytes; el HTTP Request sigue generando la URL, construyendo el cuerpo y siguiendo las redirecciones; el nodo PostgreSQL sigue construyendo el SQL y sus parámetros. Luego se lo entrega al sustituto, que lo registra y responde con lo que la prueba haya programado. Sin programar, la respuesta es nada y éxito: ninguna fila, un 200 vacío, un comando que terminó con 0. Los orígenes (MQTT In, HTTP In, TCP y UDP In, WebSocket In, Watch) no se suscriben, no escuchan ni consultan, así que lo que llega es lo que inyecta la prueba.

```yaml
  - name: the limit comes from the database and the alarm goes to the broker
    inject:
      - node: reading
        msg: {topic: "3", payload: 92.5}
    replies:
      - node: lookup limit                   # a PostgreSQL query
        reply: {rows: [{limit_c: 90}]}
      - node: maintenance api                # an HTTP Request
        reply: {statusCode: 503, payload: {error: down for maintenance}}
      - node: historian                      # InfluxDB, and it's down
        error: connection refused
    expect:
      - node: lookup limit
        sent: {query: "select limit_c from limits where line = $1", params: ["3"]}
      - node: to the plant                   # an MQTT Out
        sent: {topic: line3/alarm, payload: HIGH, qos: 1, retain: true}
      - node: errors
        error: connection refused
```

**`sent`** es lo que el nodo habría enviado, comparado como `msg`. **`replies`** programa lo que vuelve: la primera respuesta indicada para un nodo atiende su primera llamada, la siguiente la segunda, y la última sigue atendiendo, de modo que "respondió y luego dejó de hacerlo" son dos líneas. **`error`** hace que la llamada falle como lo haría la real, así que la ruta que sigue su flujo cuando el historiador está caído se prueba antes de que lo esté.

| Nodo | `sent` | `reply` |
|---|---|---|
| MQTT Out | `topic`, `payload`, `qos`, `retain` | |
| HTTP Request | `method`, `url`, `headers`, `payload` | `statusCode` (200), `headers`, `payload` |
| HTTP Response | `statusCode`, `headers`, `payload` | |
| PostgreSQL | `query`, `params` | `rows` para una consulta, `rowCount` para un insert |
| InfluxDB | `line`, el line protocol | |
| TCP Out, UDP Out | `host`, `port`, `payload` (`session` al responder) | |
| TCP Request | `host`, `port`, `payload` | `payload`, leído como el nodo lee una respuesta real |
| WebSocket Out | `payload` (`session` al responder) | |
| File | `filename`, `action`, `payload` | |
| File In | `filename` | `payload`, el contenido |
| exec | `command`, `args` | `stdout`, `stderr`, `code` (0) |
| scan | `range`, `ports` | `devices` |
| netinfo | | `interfaces` |

Hay algunas cosas que una prueba no comprueba, a propósito, porque pertenecen al equipo y no al flujo: la lista de permitidos de `exec`, los ámbitos de rutas y descubrimiento y los certificados de un `tls-config`. En una prueba nada se ejecuta, abre, sondea ni marca, así que no hay nada que acotar ni cifrar, y el despliegue sigue respondiendo ante todos ellos en el equipo donde aterriza.

La prueba que lo demuestra apunta todos esos nodos a un puerto TCP, un puerto UDP y un directorio que la propia prueba controla, pasa una lectura por todos ellos, comprueba byte a byte lo que cada uno habría enviado y después cuenta: cero conexiones, cero datagramas, ningún archivo escrito, nada ejecutado. Un nodo que sale al exterior y no tiene sustituto se rechaza por su nombre antes de que se ejecute nada, y la prueba de la paleta falla si alguien añade uno.
