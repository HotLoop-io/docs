---
title: "Automatizaciones"
description: "Reglas con diez tipos de disparador, condiciones y secuencias, compiladas al guardar, con cada escritura pasando por la puerta de escritura."
---

Una regla son tres cosas: algo ocurre, una condición se cumple, se ejecutan acciones.

Las reglas pueden mandar sobre los equipos, así que dos propiedades no se negocian.

**Las condiciones se compilan al guardar la regla, no cuando se dispara.** Un error de sintaxis lo ve el autor mientras sigue mirando el editor, en lugar de una regla que nunca se ejecuta en silencio o, peor, una que falla a las 3 de la mañana a mitad de una secuencia ya ejecutada a medias. El editor valida mientras escribes; una regla que no compila se rechaza al guardar.

**Las condiciones se evalúan en un entorno aislado.** [expr-lang](https://expr-lang.org) no tiene E/S, no puede llegar al sistema de archivos ni a la red, comprueba los tipos al compilar y tiene garantizado que termina. Esa última propiedad es la que más importa: una condición se evalúa en el camino que lleva a una escritura, y un lenguaje de expresiones que puede girar para siempre es uno que puede bloquear el motor que tiene el bloqueo de escritura.

## Disparadores

Basta con que se dispare uno para que la regla se ejecute.

| Tipo | Se dispara cuando | Campos clave |
|---|---|---|
| `tag_change` | cambia el valor de un tag | `deviceId`, `tagName` |
| `threshold` | un valor **cruza** un límite | `deviceId`, `tagName`, `threshold`, `direction`, `hysteresis` |
| `state` | cambia el estado de una entidad, o mantiene un estado durante un tiempo | `entityId`, `from`, `to`, `forSec` |
| `schedule` | llega la hora de una expresión cron | `cron` |
| `interval` | cada N segundos | `intervalSec` |
| `alarm` | una alarma entra en un estado | `alarmId`, `alarmState` |
| `device_state` | un dispositivo se conecta o se cae | `deviceId`, `toState` |
| `webhook` | llega un POST entrante | `webhookPath` |
| `mqtt` | llega un mensaje a un tema | `topic` |
| `startup` | arranca el proceso | n/a |
| `sun` | amanecer, salida del sol, mediodía solar, puesta del sol o anochecer en el sitio, con un desfase si se quiere | `event`, `offsetSec` |

### Los umbrales se disparan al cruzar

`threshold` se dispara cuando un valor *cruza* el límite, no mientras se queda por encima. Disparar con "el valor está por encima de 200" significa que la regla se dispara en cada ciclo en que el valor sigue alto, lo que para una regla que manda sobre algo es una tormenta de órdenes.

`hysteresis` evita que un valor que oscila sobre el límite rearme la regla con cada vaivén: una vez por encima, el valor debe bajar de `threshold - hysteresis` antes de que el disparador pueda volver a dispararse.

```json
{
  "type": "threshold",
  "deviceId": "press-01", "tagName": "Zone1_Temp",
  "threshold": 200, "direction": "rising", "hysteresis": 5
}
```

`direction` es `rising`, `falling` o `either`. La primera lectura tras el arranque fija una referencia y no dispara; de lo contrario cada regla de umbral se dispararía una vez al arrancar, sea cual sea el valor.

### Los disparadores de estado siguen a las entidades

`state` se dispara cuando cambia la cadena de estado de una entidad: de `off` a `on`, de `212.5` a `213`, de `on` a `unavailable`. `from` y `to` lo acotan. Si omites ambos se dispara en cada cambio, incluidos los de y hacia `unavailable`, que suele ser lo que quieres para "avisar a alguien" y nunca lo que quieres para "mandar algo". Indica `to`.

```json
{
  "type": "state",
  "entityId": "binary_sensor.press_01_run",
  "from": "off", "to": "on"
}
```

Se dispara por el estado y por nada más. Que cambie un atributo, o que la calidad se vuelva mala mientras el estado conserva su último valor bueno, no es un cambio de estado.

Esto es exactamente cuándo se dispara, porque una regla que manda sobre equipos merece saberlo. El disparador sigue el registro propio del motor de entidades de lo que cambió, no el bus de tags. El motor calcula el estado de una entidad a medida que llegan las lecturas y, una vez por segundo, recalcula todo como respaldo para un lote que no pudo atender a tiempo. Cada cambio que calcula lo notifica una vez, en orden, y el disparador los ve todos. Por tanto:

- **Se dispara una vez por cambio.** El recálculo de cada segundo solo notifica lo que se movió desde la última vez que el motor miró, así que no puede notificar un cambio dos veces, y recargar una regla no reinicia nada de lo que depende un disparador de estado.
- **No se pierde un cambio que el motor vio.** Un bus lento cuesta un segundo de latencia, no el cambio.
- **No puede ver un cambio que nadie vio.** Una bobina que pasa a off, on, off entre dos sondeos nunca cambió en lo que respecta a la planta. Un disparador de estado es tan bueno como el ciclo de lectura que tiene detrás y no más. Si necesitas cada flanco de una señal rápida, engánchala en el PLC.
- **El arranque es una referencia.** Toda entidad que aparece cuando arranca el Gateway, o cuando se habilita una, no es un cambio y no dispara.

Si las reglas llegan a quedar 10.000 cambios atrasadas (la base de datos demasiado lenta para registrar las ejecuciones que inician), se descartan las más antiguas, se cuentan y se registran, y `GET /api/diagnostics` muestra `stateChangesPending` y `stateChangesDropped` bajo `automations`.

Si cambias el nombre de una entidad, toda regla que nombre su `entity_id` anterior deja de dispararse. Ese es el precio de los nombres con significado; renombra con intención y busca antes en las reglas.

### Mantener un estado: forSec

"La bomba lleva cinco minutos en marcha" es un disparador de estado con `forSec`. El cambio inicia un temporizador en lugar de disparar la regla; la regla se dispara cuando el estado al que cambió se ha mantenido durante esa cantidad de segundos.

```json
{
  "type": "state",
  "entityId": "binary_sensor.press_01_run",
  "from": "off", "to": "on",
  "forSec": 300
}
```

- **Cualquier cambio de estado lo cancela.** De on a off y de nuevo a on dentro de los cinco minutos son dos cambios: el primero termina la espera, el segundo inicia una nueva desde cero. No suma tiempo. Pasar a `unavailable` también es un cambio de estado, así que un dispositivo que se queda mudo a mitad de la espera la cancela.
- **Solo cuenta el estado.** Que cambie un atributo, o que la calidad se vuelva mala mientras el estado se mantiene, no la cancela, igual que no dispara un disparador de estado simple. Si una espera no debe sobrevivir a una lectura mala, protege la condición de la regla con `qualities`.
- **Se dispara una vez por espera.** Mantener el estado una hora dispara una vez una regla de cinco minutos, a los cinco minutos, no cada cinco minutos.
- **Cada regla tiene su propio temporizador**, uno por disparador. Dos reglas sobre la misma entidad con distinto `forSec` se disparan cada una a su hora.
- **La traza lo dice.** Una ejecución disparada por una espera dice `binary_sensor.press_01_run changed from off to on and held for 300s`, y `fromState`, `toState` y `entity` son los del cambio que inició la espera.
- **Una espera no sobrevive a un reinicio.** Se guarda en memoria y nada la rearma: los minutos que una prensa llevaba antes del reinicio no cuentan después. Lo que ve el proceso al volver es que todas las entidades aparecen (una referencia, no un cambio), normalmente como `unknown`, y luego la primera lectura del dispositivo las lleva a lo que lee. Con `"from": "off"` eso no coincide, así que una prensa que estaba en marcha antes del reinicio no inicia ninguna espera, y la regla se dispara la próxima vez que la prensa pase de off a on y funcione cinco minutos. Sin `from` depende de una carrera que no controlas. Si la primera lectura llega cuando las reglas ya escuchan, es un cambio, de `unknown` a `on`, e inicia una espera desde cero: la regla se dispara cinco minutos después, y su traza dice `changed from unknown to on`. Si el dispositivo responde antes de que el Gateway esté arriba, la prensa simplemente está `on` desde el principio, no cambió nada y no se dispara nada hasta que vuelva a hacerlo. Indica `from` cuando un reinicio no deba contar como un arranque, y no escribas una regla que necesite que cuente. Editar, desarmar o borrar la regla también descarta sus esperas; guardar otra regla no.
- **Una entidad que desaparece a mitad de la espera** (deshabilitada, o borrada con su dispositivo) nunca la dispara.

`forSec` es como máximo un día (86400), y solo lo admite un disparador `state`. Se comprueba al guardar como todo lo demás.

### Disparadores solares

Luces del patio, traza de calor, un aparcamiento, cualquier cosa a la que le importe si fuera está oscuro. `sun` se dispara en `dawn`, `sunrise`, `noon`, `sunset` o `dusk` en este sitio, desplazado por `offsetSec`: negativo es antes, así que esto es media hora antes de la puesta del sol.

```json
{"type": "sun", "event": "sunset", "offsetSec": -1800}
```

- **Se calcula en el equipo.** A partir de la latitud y la longitud del sitio (`HOTLOOP_SITE_LATITUDE`, `HOTLOOP_SITE_LONGITUDE`), con las ecuaciones solares de la NOAA, sin servicio y sin internet. Una planta que perdió su enlace sigue encendiendo las luces al anochecer. Consulta [el sol](/es/iot/sun/).
- **Sin ubicación, no se arma.** Una regla con un disparador solar en un sitio sin latitud ni longitud no se arma, y el registro del sistema dice qué dos variables configurar. Antes era de esas cosas que se quedan armadas y calladas para siempre, y nadie se entera hasta que el patio está a oscuras.
- **Se dispara una vez por evento del día,** a la hora de ese día. Las puestas de sol de octubre llegan un minuto antes cada tarde y el disparador las sigue.
- **El amanecer y el anochecer son crepúsculo civil**, con el centro del sol 6 grados bajo el horizonte. Esa es la línea de "está lo bastante oscuro para las luces" sobre la que se escribe el alumbrado exterior.
- **Bajo el sol de medianoche no hay puesta de sol en la que disparar**, así que un disparador de puesta de sol espera a la siguiente, aunque falten semanas, y se dispara entonces.
- `offsetSec` es como máximo seis horas a cada lado (21600). Más allá es un `schedule`.

La traza dice qué la disparó y cuándo: `30m before sunset at 2026-10-01T22:38:00Z`, y `trigger` es `sun` en la condición.

## Condiciones

Una expresión que devuelve un booleano. Vacía significa incondicional.

Lo que puede ver una expresión:

| Nombre | Significado |
|---|---|
| `value`, `string`, `quality` | la lectura que disparó la regla |
| `previous` | la lectura anterior |
| `tag`, `device` | lo que la disparó |
| `tags["device/tag"]` | cada lectura numérica actual |
| `strings["device/tag"]` | cada lectura de texto actual |
| `qualities["device/tag"]` | cada calidad actual |
| `states["sensor.x"]` | el estado de cada entidad habilitada, como cadena |
| `attrs["sensor.x"]["unit_of_measurement"]` | los atributos de cada entidad habilitada |
| `qualities["sensor.x"]` | la calidad de cada entidad, junto a la de los tags (un tag tiene un `/` en su clave, un entity_id nunca) |
| `entity`, `fromState`, `toState` | el cambio de estado que disparó la regla |
| `alarm`, `alarmState` | la alarma que disparó la regla |
| `deviceState` | el estado del dispositivo que la disparó |
| `now`, `hour`, `minute`, `weekday` | el reloj; weekday 0 es domingo |
| `trigger` | qué disparador se activó |
| `vars` | valores enlazados por pasos anteriores |

```
value > 200
value > 200 and quality == 'good'
tags['press-01/Zone1_Temp'] > 200 and tags['press-01/Pressure'] < 50
hour >= 6 and hour < 18 and weekday != 0 and weekday != 6
qualities['press-01/Zone1_Temp'] == 'good'
strings['cnc-01/Program'] == 'PART_4471.NC'
value > previous
states['switch.press_01_pump'] == 'off' and toState == 'on'
float(states['sensor.press_01_zone1_temp']) > 200 and qualities['sensor.press_01_zone1_temp'] == 'good'
attrs['switch.press_01_pump']['armed'] == true
```

**Protege con la calidad.** `value > 200` es verdadero para una lectura mala de 250, y una lectura mala es una que el sistema te dice que no conoce. En cualquier cosa que mande sobre equipos, escribe `value > 200 and quality == 'good'`. Lo mismo vale para las entidades: una entidad mala sigue mostrando su último valor bueno, y `qualities['sensor.x']` es como una regla lo distingue.

**Un estado es una cadena.** Es `"212.5"`, `"on"` o `"unavailable"`, nunca un número, así que `states['sensor.x'] > 200` se rechaza al guardar como error de tipo en lugar de guardarse como una comparación que en silencio es siempre falsa. Escribe `float(states['sensor.x']) > 200` y protégelo: `float('unavailable')` es un error, y una condición que da error hace fallar la ejecución.

`string` es la lectura que disparó la regla, lo que significa que no es además la función `string()` de expr-lang. Para poner un número en una cadena, usa `toJSON(value)`.

Una condición debe devolver un booleano. Una que devuelva un número o una cadena se rechaza al guardar en lugar de forzarse a una veracidad que nadie pretendía.

## Acciones

Las acciones se ejecutan en orden. Un paso fallido detiene la regla salvo que ponga `continueOnError`: un paso que debía cerrar una válvula y no lo hizo no debe ir seguido de pasos que dan por hecho que la válvula está cerrada.

### write_tag

```json
{
  "type": "write_tag",
  "params": {
    "deviceId": "press-01", "tagName": "Cooling",
    "value": true
  }
}
```

O calculado:

```json
{
  "type": "write_tag",
  "params": {
    "deviceId": "press-01", "tagName": "Setpoint",
    "expression": "tags['press-01/Zone1_Temp'] - 10"
  }
}
```

**Esto pasa por la misma puerta que todo lo demás.** Una automatización no recibe más privilegio que una persona: las escrituras deben estar habilitadas, el tag debe estar marcado como escribible, el valor debe estar en rango, y el intento se audita como `automation:<rule-id>`.

### call_service

Manda sobre una entidad mediante su servicio, igual que `POST /api/services/...` y la herramienta `call_service` de MCP. Consulta [Entidades](/es/iot/entities/#servicios) para ver qué admite cada dominio.

```json
{
  "type": "call_service",
  "params": {
    "entityId": "switch.press_01_pump",
    "service": "switch.turn_on"
  }
}
```

Con datos, literales o calculados:

```json
{
  "type": "call_service",
  "params": {
    "entityId": "number.press_01_zone1_sp",
    "service": "number.set_value",
    "dataExpressions": {"value": "float(states['sensor.press_01_zone1_temp']) - 10"}
  }
}
```

`service` es `domain.service` y su dominio debe ser el de la entidad, así que una regla que nombra un número con el servicio de un interruptor se rechaza al guardar. También se rechaza un servicio que el dominio no admite, y la lista de lo que admite cada dominio viene de la propia capa de entidades: cuando un dominio gana un servicio allí, las reglas pueden usarlo sin ningún cambio aquí. `data` son los datos literales del servicio; `dataExpressions` se evalúan al ejecutar y se combinan sobre ellos.

Es `write_tag` con un nombre encima. La llamada se convierte en escrituras de tags por la misma puerta, auditadas como `automation:<rule-id>` con la entidad, el servicio y el id de la llamada en cada fila. Un rechazo (escrituras desactivadas, el tag desarmado, un valor fuera del paso de la entidad) hace fallar el paso y la ejecución, con el rechazo en la traza, exactamente como lo hace un `write_tag` rechazado, y toda escritura que la llamada hizo o que le rechazaron está en la salida del paso. Una llamada nunca se deshace: un compuesto que logró dos escrituras de tres se detiene ahí y lo dice.

### condition

Una condición en medio de una secuencia. Cuando es falsa la secuencia termina ahí, y la ejecución **tuvo éxito**: la regla hizo lo que se escribió que hiciera, que era detenerse. La salida del paso dice `false; the steps after this one did not run`.

```json
{
  "type": "condition",
  "params": {
    "expression": "states['binary_sensor.press_01_run'] == 'on' and qualities['binary_sensor.press_01_run'] == 'good'"
  }
}
```

No es la `condition` de la regla. Esa se comprueba una vez, antes de que se ejecute nada, contra la planta tal como estaba cuando se disparó el disparador, y una falsa registra la ejecución como omitida. Un paso de condición lee la planta **tal como está cuando el paso se ejecuta**, que es el sentido de uno después de un `delay` o un `wait`: "¿sigue la prensa en marcha, treinta segundos después?" `entity`, `toState`, `value` y el resto de lo que disparó la regla se quedan como estaban, y también `vars`.

Una condición que no se puede evaluar (`float('unavailable')`) hace fallar el paso y la ejecución, igual que la condición de la regla. `continueOnError` se rechaza en una condición al guardar: seguir adelante tras una significaría que nunca detiene nada.

### wait

Retiene la secuencia hasta que una expresión sea verdadera, como máximo `timeoutSec`.

```json
{
  "type": "wait",
  "params": {
    "expression": "states['binary_sensor.press_01_valve_closed'] == 'on'",
    "timeoutSec": 30
  }
}
```

Mira de inmediato, de nuevo **cada vez que cambia una entidad que la expresión nombra** (su estado, su calidad o un atributo), y una vez por segundo en cualquier caso. Las entidades que vigila son las escritas como literales en `states['...']`, `attrs['...']` y `qualities['...']`; una lectura de tag, el reloj o una entidad nombrada de otro modo los capta la mirada de cada segundo. Una espera sobre una bobina Modbus es por tanto tan rápida como el sondeo que tiene detrás, no un segundo tarde.

Cuando se cumple, se ejecuta el paso siguiente, y los pasos posteriores ven la planta como la vio la espera por última vez. Si se agota el tiempo antes, el paso **falla**, y la ejecución con él, diciendo `still false after 30s`, salvo que la espera indique que se continúe:

```json
{
  "type": "wait",
  "params": {
    "expression": "float(states['sensor.press_01_zone1_temp']) < 60",
    "timeoutSec": 240,
    "continueOnTimeout": true
  }
}
```

En cualquier caso `vars.wait.completed` es verdadero o falso después, y `vars.wait.waitedSec` es cuánto esperó, de modo que un paso de condición tras una espera con continuación puede decidir: `vars.wait.completed == true`.

`timeoutSec` es obligatorio y como máximo una hora. Una espera sin fin retiene su hueco de ejecución hasta que el presupuesto de la ejecución se lo quita, lo que bajo `skip` significa que la regla deja de dispararse. También debe caber en el presupuesto de la ejecución (`maxRuntimeSec`, cinco minutos por defecto): una espera de diez minutos necesita `"maxRuntimeSec": 900` o similar en su regla, y sin ello la regla se rechaza al guardar en lugar de agotar el tiempo como ejecución. Una expresión que da error mientras espera hace fallar el paso.

### stop

Termina la secuencia. `reason` es obligatorio y admite sustitución con `{{ expression }}`; la traza lo muestra.

```json
{
  "type": "stop",
  "params": {"reason": "pump already running, nothing to do"}
}
```

Sin `error` la ejecución tuvo éxito. Con `"error": true` la ejecución falló, con el motivo como su error, y se registra y cuenta como un fallo como cualquier otro:

```json
{
  "type": "stop",
  "params": {"reason": "valve did not close in time", "error": true}
}
```

`continueOnError` se rechaza en un stop al guardar.

### call_script

Ejecuta un [script](/es/iot/scripts/): una secuencia con nombre que alguien escribió una vez para que cada regla que necesite un ciclo CIP o una purga de línea llame al mismo en lugar de llevar su propia copia. `fields` son sus entradas, `fieldExpressions` se evalúan cuando el paso se ejecuta y se combinan sobre ellas, y el script comprueba todo contra sus propios campos exactamente como hace con una ejecución desde la pantalla. Un valor que rechaza hace fallar este paso; nunca se ajusta para que encaje.

```json
{
  "type": "call_script",
  "params": {
    "scriptId": "cip_cycle",
    "fields": {"circuit": "tank_2"},
    "fieldExpressions": {"minutes": "states['input_number.cip_minutes']"},
    "wait": true
  }
}
```

Con `"wait": true` el paso espera hasta que la ejecución del script haya terminado y toma su resultado: un script que falla hace fallar el paso, y la regla se detiene ahí salvo que el paso diga `continueOnError`. La ejecución del script es parte de esta: si esta ejecución se cancela o agota su presupuesto, también el script. Sin `wait`, el script se inicia y la regla continúa; el script termina por su cuenta.

El script se ejecuta como `script:<id>`, con el origen de esta regla, `automation`, en cada escritura que hace, y su ejecución dice que `automation_run:<id>` fue su padre. Un script ocupado cuyo modo rechaza otra ejecución hace fallar un paso que espera (`script busy`) y queda anotado, no fallido, en uno que no espera. Los scripts que llaman a scripts llegan como máximo a cinco niveles, y un script que se llamaría a sí mismo se rechaza al guardarlo.

### apply_recipe

Aplica una [receta](/es/iot/recipes/): un conjunto de consignas que salen juntas, un grado de producto o un cambio de formato. `params` son sus parámetros y `paramExpressions` se evalúan cuando el paso se ejecuta y se combinan sobre ellos; `version` aplica una versión anterior a propósito, y si se omite es la actual.

```json
{
  "type": "apply_recipe",
  "params": {
    "recipeId": "grade_a",
    "params": {"line_speed": 120},
    "paramExpressions": {"batch": "states['input_number.next_batch']"}
  }
}
```

La receta hace lo que hace desde la pantalla Recetas, con esta regla como quien la aplica. Primero se comprueba entera, y si algún destino fuera a ser rechazado no se escribe nada y el paso falla con todos los motivos. Luego sus destinos salen en orden bajo un mismo id de llamada, como `automation:<id>` con el origen `automation`, y el primero que falla detiene el resto y hace fallar el paso; lo que se escribió queda escrito. El paso solo tiene éxito cuando se escribió cada destino. Un valor que salió y no se leyó de vuelta del dispositivo no es un fallo, porque sí salió, pero la traza dice `NOT confirmed by read-back`, y también la aplicación. El padre de la aplicación es esta ejecución, `automation_run:<id>`.

### El resto

| Acción | Hace |
|---|---|
| `mqtt_publish` | publica en la conexión existente de un dispositivo MQTT |
| `http_request` | llama a un endpoint; `bindTo` guarda el cuerpo en `vars` |
| `raise_alarm` / `clear_alarm` | maneja una alarma que el motor no puede ver por sí mismo |
| `log_event` | escribe en el registro del sistema |
| `set_variable` | enlaza un valor para pasos posteriores |
| `delay` | pausa, hasta una hora |
| `mcp_call` | invoca una herramienta en un servidor MCP configurado |

`mqtt_publish`, `http_request`, `log_event` y `stop` admiten sustitución con `{{ expression }}` en sus cadenas.

```json
{
  "type": "mcp_call",
  "params": {
    "server": "maintenance",
    "tool": "create_work_order",
    "args": {"priority": "high"},
    "argExpressions": {"note": "'Zone 1 reached ' + toJSON(value)"},
    "bindTo": "workOrder"
  }
}
```

## Modos de ejecución

Qué ocurre cuando una regla se dispara mientras una ejecución anterior sigue en curso.

| Modo | Comportamiento |
|---|---|
| `skip` | descarta el nuevo disparo, **el valor por defecto**, y la respuesta correcta cerca de un dispositivo |
| `queue` | lo ejecuta después, con un máximo de uno en espera |
| `restart` | abandona la ejecución actual y empieza de nuevo |
| `parallel` | ejecuta ambas |

`queue` está limitada a una ejecución pendiente a propósito. Una regla que no puede seguir el ritmo acumularía de otro modo una cola de órdenes que se disparan todas contra una planta cuyo estado ya cambió.

`minIntervalSec` limita la frecuencia sea cual sea la tasa de disparos, un respaldo contra un tag que vibra y machaca un dispositivo. Una ejecución manual desde la interfaz o MCP se salta el límite de frecuencia (alguien lo quiso así) pero no el modo de ejecución (dos ejecuciones simultáneas son igual de peligrosas las inicie quien las inicie).

`maxRuntimeSec` acota una ejecución completa; el valor por defecto es de cinco minutos. Sin él, una regla colgada de un endpoint inalcanzable retiene su hueco de ejecución para siempre, y bajo `skip` eso significa que no vuelve a dispararse. Una ejecución que se queda sin él se registra como agotada, ya estuviera entre pasos o en medio de un `delay` o un `wait`.

### Esperas, retardos y modos de ejecución

Una ejecución detenida en un `wait` o un `delay` es una ejecución en curso, y el modo de ejecución decide qué hace un disparo con ella:

| Modo | Un disparo mientras una ejecución espera |
|---|---|
| `skip` | se descarta y se registra como omitido. La ejecución en espera continúa. |
| `queue` | se ejecuta cuando la ejecución en espera ha terminado, termine como termine. |
| `restart` | cancela la ejecución en espera donde está y empieza una nueva. La ejecución antigua se registra como **cancelada**, `a newer trigger restarted the rule`. Este es el patrón de la "luz de movimiento": cada disparo retrasa el final. |
| `parallel` | inicia otra ejecución, que espera por su cuenta. |

Una ejecución se cancela donde está, incluida una espera o un retardo, y se registra como **cancelada** con el motivo, cuando:

- **su regla se desarma o se borra**: `the rule was disarmed or deleted`. Su ejecución en cola y sus esperas `forSec` también se descartan.
- **su regla se edita**: `the rule was edited`. Una ejecución que espera una condición que el autor acaba de cambiar no continúa como si nada hubiera pasado; la regla editada empieza limpia. Guardar *otra* regla no toca nada: las ejecuciones, esperas, ejecuciones en cola, el hueco de ejecución y los temporizadores de intervalo de cada regla sin cambios continúan como estaban.
- **el proceso se detiene**: `the process is stopping`. El apagado no espera a que termine una espera. Nada reanuda la ejecución en el siguiente arranque; una ejecución que el proceso no pudo registrar como cancelada (una caída, un corte de luz) se marca como cancelada en el siguiente arranque.

Un paso que se canceló o se quedó sin presupuesto detiene la ejecución incluso con `continueOnError`: esa marca es para un paso que falló, no para una ejecución que alguien detuvo. Todo lo que el paso ya había hecho queda hecho: una escritura que salió antes de la cancelación no se deshace, y está en la traza.

## Historial de ejecuciones

Cada ejecución se registra con una traza por paso: las entradas **resueltas**, las salidas, las duraciones y los errores. No las plantillas: cuando una regla falla a las 3 de la mañana, `wrote 212.5 to press-01/Setpoint` es lo que vale la pena saber y `wrote {{expression}}` no.

Expande una ejecución en la pantalla Automatizaciones para ver sus pasos. Una ejecución que seguía en curso cuando el proceso se detuvo se cancela al detenerse, y una que el proceso no llegó a registrar (una caída) se marca como cancelada en el siguiente arranque, en lugar de parecer que llevaba ejecutándose desde el martes pasado.

## Un ejemplo trabajado

Arrancar la refrigeración cuando una zona se calienta durante un turno, como máximo una vez cada diez minutos, y avisar a alguien.

```json
{
  "id": "cool-zone-1",
  "name": "Cool zone 1 when hot",
  "enabled": true,
  "mode": "skip",
  "minIntervalSec": 600,
  "triggers": [{
    "type": "threshold",
    "deviceId": "press-01", "tagName": "Zone1_Temp",
    "threshold": 200, "direction": "rising", "hysteresis": 5
  }],
  "condition": "quality == 'good' and hour >= 6 and hour < 18",
  "actions": [
    {"type": "write_tag", "params": {
      "deviceId": "press-01", "tagName": "Cooling", "value": true}},
    {"type": "delay", "params": {"seconds": 30}},
    {"type": "log_event", "params": {
      "severity": "warning",
      "message": "Cooling started, zone 1 at {{ value }}"}}
  ]
}
```

Lee las protecciones en orden: se dispara al cruzar y no de forma continua; la histéresis evita que se rearme con un vaivén; la condición se niega a actuar sobre una lectura en la que no puede confiar y solo se ejecuta durante el turno; y el límite de frecuencia hace que, aunque todo lo demás falle, no pueda mandar sobre la planta más de una vez cada diez minutos.

La misma idea con entidades: arrancar el extractor cuando la prensa empieza a funcionar, pero solo si nadie ha desarmado el extractor.

```json
{
  "id": "fan-with-press",
  "name": "Extraction fan follows the press",
  "enabled": true,
  "mode": "skip",
  "triggers": [{
    "type": "state",
    "entityId": "binary_sensor.press_01_run",
    "from": "off", "to": "on"
  }],
  "condition": "qualities['binary_sensor.press_01_run'] == 'good' and attrs['switch.press_01_fan']['armed'] == true",
  "actions": [
    {"type": "call_service", "params": {
      "entityId": "switch.press_01_fan", "service": "switch.turn_on"}},
    {"type": "log_event", "params": {
      "message": "{{ entity }} went {{ toState }}, fan started"}}
  ]
}
```

`from` y `to` hacen que una reconexión (`unavailable` a `on`) no arranque el extractor por sí sola; la condición hace que un extractor desarmado sea una ejecución omitida y no una escritura rechazada en la pista de auditoría cada vez que arranca la prensa.

Y una que usa los pasos de secuencia: cuando la prensa lleva diez minutos en marcha, abrir la válvula de refrigeración si no está ya abierta, esperar su final de carrera y fallar con claridad si nunca hace contacto.

```json
{
  "id": "cool-after-warmup",
  "name": "Open cooling after ten minutes of running",
  "enabled": true,
  "mode": "restart",
  "maxRuntimeSec": 120,
  "triggers": [{
    "type": "state",
    "entityId": "binary_sensor.press_01_run",
    "from": "off", "to": "on",
    "forSec": 600
  }],
  "actions": [
    {"type": "condition", "params": {
      "expression": "states['valve.press_01_cooling'] != 'open'"}},
    {"type": "call_service", "params": {
      "entityId": "valve.press_01_cooling", "service": "valve.open"}},
    {"type": "wait", "params": {
      "expression": "states['valve.press_01_cooling'] == 'open'",
      "timeoutSec": 60, "continueOnTimeout": true}},
    {"type": "condition", "params": {
      "expression": "vars.wait.completed == false"}},
    {"type": "stop", "params": {
      "reason": "cooling valve did not open within 60s, it is {{ states['valve.press_01_cooling'] }}",
      "error": true}}
  ]
}
```

Léela de arriba abajo: la espera hace que una prensa que dispara a los dos minutos nunca abra la válvula, y `from` hace que un reinicio del Gateway no sea un arranque de prensa; la primera condición hace que una válvula ya abierta sea una ejecución correcta que no manda nada; la espera despierta en el momento en que cambia la entidad de la válvula; y cuando nunca abre, la segunda condición deja que la ejecución siga hasta un stop que la hace fallar, con el estado real de la válvula en el motivo y un aviso en el registro del sistema. Cuando la válvula sí abre, esa misma condición es falsa y la ejecución termina ahí, con éxito.

## Webhooks

Un disparador `webhook` registra `POST /api/webhook/<path>`. El cuerpo está disponible como `vars.body`. Una ruta que ninguna regla reclama devuelve 404 en lugar de aceptar en silencio: un webhook que publica en la nada se ve exactamente igual que uno que funciona.

Dos reglas no pueden reclamar la misma ruta; la segunda se rechaza al cargar con una línea de registro que nombra a ambas.

## Cuando una regla no se arma

Una regla que está habilitada pero no compiló aparece como **NOT ARMED** en la pantalla Automatizaciones, con un punto rojo y una explicación, y un error en el registro del sistema. Es el estado del que más hay que avisar: el autor cree que se está ejecutando.

Una regla mala no desarma a las demás. Al recargar se descarta la que falló y se arma todo lo demás.
