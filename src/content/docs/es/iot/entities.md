---
title: "Entidades"
description: "El registro de entidades en el que se apoyan automatizaciones, ayudantes, scripts y pantallas: ids fijos, dominios, servicios y la API que los lee."
---

El registro de entidades y el motor que calcula su estado son la base sobre la que se construyen todas las automatizaciones, ayudantes, scripts y pantallas de HotLoop.

## Por qué entidades, si ya tenemos tags

Un tag es de lo que habla un driver: un registro de retención, un NodeId, un desplazamiento de DB de S7. Se identifica por dispositivo y nombre de tag, no se puede renombrar y significa exactamente un punto en un cable.

Una entidad es de lo que hablan las personas y las reglas: "la temperatura de la zona 1", "el interruptor de marcha de la cinta". Tiene un nombre estable propio (`sensor.zone_1_temperature`), un tipo que dice cómo mostrarla y qué se puede hacer con ella, y un conjunto de vínculos con los tags de los que está hecha.

Las entidades envuelven a los tags. No los sustituyen, y nada en los tags ha cambiado para hacerles sitio. No hay una segunda canalización de valores ni un segundo historiador: el estado de una entidad se calcula desde la misma caché en vivo que ya leen `/api/values`, el motor de alarmas y el servidor OPC UA. Todos los endpoints de tags existentes, el tablero, `/api/write`, las herramientas MCP y las reglas de automatización que existían antes de las entidades se comportan exactamente igual que antes; las entidades se añaden junto a ellos, no en su lugar.

## Lo que obtiene sin mover un dedo

Cada tag recibe automáticamente una **entidad de lectura**:

| Tipo de dato del tag | Dominio de la entidad de lectura |
|---|---|
| `bool`, `boolean`, `bit`, `coil`, `discrete` | `binary_sensor` |
| todo lo demás | `sensor` |

La primera vez que un tag se hace escribible, recibe también una **entidad de control**:

| Tipo de dato del tag | Dominio de la entidad de control |
|---|---|
| familia bool | `switch` |
| familias int y float | `number` |
| `string`, `text`, `char` | `text` |

Una entidad de control nunca se elimina porque su tag se haya desarmado. La puerta de escritura rechaza las escrituras a un tag desarmado como siempre lo ha hecho, y el atributo `armed` de la entidad pasa a `false` para que una pantalla pueda atenuar el control. Conservar la entidad es el objetivo: una automatización o un panel que nombra `switch.press_01_pump` no debe romperse porque alguien haya desarmado la bomba durante un turno.

Los tags existentes reciben sus entidades en la propia actualización: la migración `0005_entities.sql` crea una entidad de lectura para cada tag y una entidad de control para cada tag que ya es escribible, en la misma transacción que crea las tablas. O bien cada tag tiene su entidad cuando la nueva versión atiende su primera petición, o bien no ha cambiado nada.

Cada definición de alarma recibe también una **entidad de alarma**, del mismo modo: consulte [Entidades de alarma](#entidades-de-alarma).

Dar una orden a una entidad de control (encender un interruptor, fijar un número) es una llamada a un servicio, y una llamada a un servicio son escrituras de tags a través de `runtime.Manager.Write` y la puerta de escritura, como cualquier otra escritura. No hay otra puerta. Consulte [Servicios](#servicios).

Un equipo que es más de un tag (una bomba con una orden de marcha, un contacto de marcha y un fallo; una válvula con finales de carrera; un lazo PID) es un **compuesto** que usted construye a propósito con los tags de los que está hecho. Consulte [Equipos compuestos](#equipos-compuestos).

## ID de entidad

Un `entity_id` es `<domain>.<object_id>`: letras minúsculas, dígitos y guiones bajos, como máximo 255 caracteres. El automático de un tag es `<domain>.<device>_<tag>`, donde ambas mitades se pasan a minúsculas y cada serie de caracteres que no sea una letra o un dígito ASCII se convierte en un solo guion bajo:

| Dispositivo | Tag | Entidad de lectura |
|---|---|---|
| `press-01` | `Zone1_Temp` | `sensor.press_01_zone1_temp` |
| `Line.A-2` | `Motor/Speed.PV` | `sensor.line_a_2_motor_speed_pv` |
| `press-01` | `温度` | `sensor.press_01_tag` |

Dos tags que dan el mismo resultado reciben `_2`, `_3` y así sucesivamente, en el orden en que se registraron. Un nombre demasiado largo para 255 caracteres se corta antes del sufijo, nunca a través de él.

**Un `entity_id` se genera una vez, se guarda y nunca se regenera.** Cambiar la descripción de un tag, su tipo de dato o moverlo a otro registro: nada de eso toca el entity_id. Lo único que lo cambia es un renombrado explícito mediante `PUT /api/entities/{entity_id}`, que es una acción de administrador y queda en el registro del sistema (categoría `config`, asunto el nuevo id, el id anterior en el mensaje y en el detalle).

Un renombrado conserva el dominio. La identidad de una entidad es su `id` de base de datos y su `unique_id`, y ninguno de los dos se mueve nunca:

| Entidad | `unique_id` |
|---|---|
| la entidad de lectura de un tag | `tag:<device>/<tag>` |
| la entidad de control de un tag | `tag-control:<device>/<tag>` |
| una entidad de alarma | `alarm:<definition id>` |
| un compuesto | `composite:<32 random hex digits>` |

Los tres primeros se derivan de lo que envuelve la entidad, y eso es lo que permite que un tag o una definición de alarma que se elimina y vuelve a aparecer recupere su entidad. Un compuesto no tiene nada de lo que derivarlo: dos bombas idénticas en un PLC están vinculadas a tags distintos, y los mismos tags pueden respaldar dos compuestos a propósito. Por eso su `unique_id` es aleatorio, creado una sola vez al crearlo. Nunca puede coincidir con el de ninguna otra entidad, ni siquiera con el de un compuesto que se eliminó y se volvió a construir, que es una entidad nueva y así debe ser.

## Tags eliminados, huérfanas y readopción

Si elimina un tag, sus entidades quedan **huérfanas**, no eliminadas: se establece `orphaned_at` y el estado pasa a `unavailable`. Si trae de vuelta el mismo tag, desde el editor de tags o con una reimportación del explorador, el registro encuentra la huérfana por `unique_id` y la readopta. Su entity_id, nombre, clase de dispositivo, icono y todas las demás personalizaciones vuelven con ella.

Es deliberado. En una planta, un tag se elimina y se reimporta con mucha más frecuencia de la que alguien quiere decir "olvida todo sobre este punto", y una automatización que nombra `sensor.oven_temperature` debe seguir funcionando a través de ello.

Eliminar un dispositivo entero es distinto: sus entidades se van con él, igual que sus tags. Eso incluye un compuesto cuyos tags están todos en ese dispositivo. Un compuesto que abarca varios dispositivos no pertenece a ninguno, y cuando uno desaparece solo pierde su estado.

Las entidades de alarma siguen a sus definiciones de alarma con las mismas reglas: si elimina la definición, su entidad queda huérfana; si guarda una definición con el mismo id, se readopta.

Un compuesto nunca queda huérfano. Se construyó a propósito, así que permanece hasta que alguien lo elimine; mientras falta uno de sus tags, está `unavailable`.

`DELETE /api/entities/{entity_id}` elimina un compuesto o una huérfana. Rechaza (409) la entidad de un tag o de una definición de alarma que todavía tiene lo que envuelve, y dice cómo se retira: elimine el tag o la definición y después la huérfana. Eliminar una entidad viva solo haría que la siguiente sincronización la volviera a poner con un id nuevo, y rompería entretanto todo lo que la nombra. Para quitarla de las pantallas, ocúltela o deshabilítela.

## Cómo se mantiene al día el registro

El registro no engancha cada lugar donde puede cambiar un tag. Reconcilia: lee todos los tags y todas las entidades, crea lo que falta, deja huérfano lo que perdió su tag y readopta lo que lo recuperó. Una reconciliación no puede pasar por alto una vía que alguien añada el año que viene, y ejecutarla dos veces es lo mismo que ejecutarla una. Se ejecuta:

- al arrancar, lo que cubre una actualización y una restauración desde una copia de seguridad;
- después de cada recarga del runtime, que desencadena todo cambio de tag y de dispositivo;
- de forma síncrona en los manejadores de la API que cambian tags (`POST /api/tags`, `DELETE /api/tags/...`, `POST /api/devices/{id}/import`, `DELETE /api/devices/{id}`) y definiciones de alarma (`POST /api/alarms`, `DELETE /api/alarms/{id}`), de modo que un cliente que crea un tag o una definición y pide su entidad de inmediato la encuentra.

El registro se serializa entre réplicas con un bloqueo asesor de la base de datos, así que dos réplicas que importan el mismo dispositivo no pueden repartir el mismo `_2`. Cada reconciliación que cambia algo escribe una línea en el registro del sistema, no una por entidad: una importación de cinco mil puntos es un solo evento.

## Estado

`GET /api/states/{entity_id}`:

```json
{
  "entity_id": "sensor.press_01_zone1_temp",
  "state": "212.5",
  "attributes": {
    "friendly_name": "Zone1_Temp",
    "unit_of_measurement": "F",
    "device_class": "temperature",
    "source": ["press-01/Zone1_Temp"]
  },
  "quality": "good",
  "last_changed": "2026-09-26T14:02:11.482Z",
  "last_updated": "2026-09-26T14:02:11.482Z",
  "last_reported": "2026-09-26T14:07:40.100Z"
}
```

`state` es el valor mostrado sin su unidad: un número tal como lo muestra `/api/values`, `on` u `off` para `binary_sensor` y `switch`, el propio texto para una cadena. La unidad es un atributo. Un estado que unas veces es `212.5` y otras `212.5 F` es un estado que nada puede comparar.

Las reglas, en el orden en que se aplican. Son las mismas que usa el servidor OPC UA para sus códigos de estado, por la misma razón: **un estado nunca es mejor que la evidencia que lo respalda.**

| Condición | `state` | `quality` |
|---|---|---|
| Entidad huérfana, o su tag ya no existe | `unavailable` | `bad` |
| Dispositivo deshabilitado, eliminado o con el enlace caído | `unavailable` | `bad` |
| Enlace activo, aún no se ha leído nada en esta sesión | `unknown` | `bad` |
| Lectura mala | el **último valor correcto**, o `unknown` si nunca lo hubo | `bad` |
| Lectura buena, pero fallan otros puntos del dispositivo (degradado) | el valor | `uncertain` |
| Lectura buena | el valor | `good` |

La regla de la lectura mala importa más de lo que parece. Un driver informa de un punto que no pudo leer como una lectura mala de cero, y mostrar ese cero como estado convierte "el transmisor de nivel ha dejado de responder" en "el depósito está vacío". La entidad sigue mostrando el último valor en el que se podía confiar y dice, en `quality`, que ya no puede responder de él.

Fíjese en la diferencia entre que falle un punto y que falle un dispositivo. Un dispositivo Modbus cuyos bloques fallan todos pierde su sesión y se reconecta, así que sus entidades pasan a `unavailable`. Un dispositivo que responde en unos puntos y en otros no sigue conectado (degradado), y solo las entidades de los puntos que fallan muestran `bad`.

**Qué tarda en verse un dispositivo Modbus caído.** Uno que rechaza o cierra la conexión pasa a `unavailable` en su siguiente sondeo. Uno que simplemente deja de responder (un cable desconectado, un PLC colgado, un switch que se reinició) mantiene su socket abierto y se juzga por su tiempo de espera del sondeo: sus entidades pasan a `unavailable` dentro de un intervalo de sondeo más el doble del tiempo de espera del dispositivo, más como máximo un segundo del recálculo de respaldo del motor. Lo habitual es un tiempo de espera; dos es cuando el dispositivo cae a mitad de un sondeo, porque la petición que ya está en el cable recibe su tiempo de espera completo. Hasta entonces no se ha leído nada nuevo, así que la entidad sigue mostrando su última lectura tal como estaba. Un dispositivo colgado que aún acepta conexiones se reconecta de inmediato, así que después sus entidades alternan entre `unavailable` y `unknown` (conectado, sin lectura) hasta que vuelve a responder; ninguno de los dos se confunde nunca con un valor. El tiempo de espera es el mando: un dispositivo con 20 segundos de tiempo de espera puede parecer normal entre 20 y 40 segundos después de caer, así que no lo fije más largo de lo que el dispositivo necesita para responder.

Esa tabla es para entidades de un solo tag. Un compuesto es más estricto (una lectura mala nunca conserva su último valor, consulte [Cómo se decide el estado de un compuesto](#cómo-se-decide-el-estado-de-un-compuesto)), y el estado de una entidad de alarma es el del motor de alarmas (consulte [Entidades de alarma](#entidades-de-alarma)).

### Marcas de tiempo

- `last_changed` solo se mueve cuando cambia `state`.
- `last_updated` se mueve cuando cambian `state`, `quality` o cualquier atributo.
- `last_reported` es la marca de tiempo de la lectura de la que salió el estado. No existe hasta que hay una.

El estado se calcula, no se almacena, pero el libro de registro guarda el estado más reciente de cada entidad y cuándo cambió por última vez (`entity_last_state`, consulte [El registro de actividad](/es/iot/logbook/)). Tras un reinicio, una entidad cuyo estado vuelve igual **conserva su `last_changed`**: una bomba en marcha desde el martes sigue diciendo martes. Los estados unavailable y unknown por los que pasa la entidad de un tag mientras su dispositivo se reconecta no cuentan como un cambio. Un estado que sí cambió mientras el Gateway estaba parado recibe un `last_changed` nuevo y una línea en el libro de registro. Las entidades numéricas (sensores, números, lazos, contadores) y los botones no se siguen, así que las suyas, como el `last_updated` de todas las entidades, empiezan de nuevo desde el reinicio.

### Atributos

Toda entidad lleva `friendly_name` y `source` (las claves de tag a las que está vinculada). Después, cuando corresponde:

| Atributo | Cuándo |
|---|---|
| `unit_of_measurement` | `sensor` y `number`: la unidad propia de la entidad, o la de su tag |
| `device_class`, `state_class`, `icon` | cuando están definidos en la entidad |
| `armed` | entidades de control: si el tag es escribible ahora mismo |
| `min`, `max` | `number`: las opciones de la entidad o, si no, el rango del tag si lo tiene |
| `step` | `number`: la opción de la entidad o, si no, 1 para un tag entero |
| `max_length`, `pattern` | `text`: las opciones de la entidad, con `max_length` en 255 por defecto |
| `quality_reason` | entidades de tag, mientras la lectura no es buena y el driver sabe por qué: `no field at ENERGY.Power`, `payload is not JSON`. Desaparece con la siguiente lectura buena |

### Deshabilitadas y ocultas

Una entidad **deshabilitada** no tiene ningún estado: no aparece en `/api/states`, y al pedirla por id responde que está deshabilitada en lugar de decir que no existe. Una entidad **oculta** tiene su estado como de costumbre; la marca sirve para que las pantallas la dejen fuera de las vistas por defecto.

### Cómo funciona el motor

El motor se suscribe al bus de tags como `entities` con una cola de 256 lotes, el mismo contrato con pérdidas que los motores de alarmas y de automatización: un consumidor lento pierde lotes, nunca bloquea un sondeo. Un lote perdido aquí cuesta como máximo un segundo, porque el motor también recalcula todas las entidades desde la caché una vez por segundo. Ese ciclo también detecta los cambios que nada anuncia, como la llegada del primer sondeo de un dispositivo.

Los suscriptores dentro del proceso se registran con `Engine.OnStateChanged`. Se les llama en la propia goroutine del motor, en el orden en que ocurrieron los cambios, que es lo que necesita una regla que se fija en "de X a Y". Deben ser rápidos. El motor nunca los espera; si se atrasan más de 10 000 cambios, los más antiguos se descartan y se cuentan.

`GET /api/diagnostics` lo informa bajo `entities`:

| Campo | Significado |
|---|---|
| `entities` | cuántas entidades tienen un estado |
| `droppedBatches` | lotes del bus que el motor fue demasiado lento para tomar (también bajo `bus.droppedPerSubscriber.entities`) |
| `pendingChanges`, `droppedChanges` | la cola del gancho de cambios de estado. Una acumulación creciente, o cualquier descarte, significa que un gancho es demasiado lento |

## Clases de dispositivo y unidades

Una clase de dispositivo dice qué es un valor (`temperature`, `pressure`, `volume_flow_rate`, `running`, `problem`) para que una pantalla pueda elegir un icono y un consumidor de estadísticas sepa qué hacer con él. Cada clase tiene las unidades en que suele venir. La tabla completa es `model.DeviceClasses`.

- Se rechaza una clase de dispositivo desconocida para el dominio.
- Una unidad que la clase no suele tener se **guarda, con una advertencia** en la respuesta. Las plantas rotulan las cosas como las rotulan las plantas, y `degF` en una temperatura no vale un bloqueo al guardar. `F` y `C` a secas se aceptan para la temperatura sin advertencia, porque es lo que llevan en realidad la mayoría de las bases de datos de tags de PLC.
- `state_class` (`measurement`, `total`, `total_increasing`) es solo para sensores.
- **No hay conversión de unidades.** La unidad es una etiqueta.

## API

Los endpoints de entidades usan nombres de campo en snake_case (`entity_id`, `last_changed`) en lugar del camelCase habitual de esta API. Es a propósito: la API de entidades existe para que cualquier cosa que ya entienda esa forma entienda esta.

| Endpoint | Permiso | Qué hace |
|---|---|---|
| `GET /api/entities` | `entities.read` | Todas las entidades, huérfanas incluidas. Filtros: `?domain=`, `?device=`, `?orphaned=true\|false` |
| `GET /api/entities/{entity_id}` | `entities.read` | `{"entity": ..., "state": ...}`; `state` es null para una entidad deshabilitada |
| `GET /api/entities/{entity_id}/image` | `entities.read` | la última imagen de una cámara o de una imagen |
| `PUT /api/entities/{entity_id}` | `entities.write` | Cambia campos del registro, incluido un renombrado. Responde `{"entity": ..., "warnings": [...]}` |
| `POST /api/entities` | `entities.write` | Crea un compuesto. Responde 201 `{"entity": ..., "warnings": [...]}`. Consulte [Equipos compuestos](#equipos-compuestos) |
| `DELETE /api/entities/{entity_id}` | `entities.write` | Elimina un compuesto o una huérfana. Cualquier otra cosa es 409 |
| `GET /api/states` | `entities.read` | El estado de cada entidad habilitada, ordenado por entity_id. Filtro: `?domain=` |
| `GET /api/states/{entity_id}` | `entities.read` | Un estado |
| `POST /api/services/{domain}/{service}` | `values.write` (`alarms.ack` para `alarm`) | Llama a un servicio sobre una entidad. Consulte [Servicios](#servicios). `?dry_run=true` pregunta qué haría en lugar de hacerlo; consulte [Preguntar primero](#preguntar-primero-la-simulación) |
| `GET /api/writes?entity={entity_id}` | `values.read` | Todas las escrituras que las llamadas a servicios hicieron o vieron rechazadas sobre una entidad, de la más reciente a la más antigua |

Todos los roles tienen `entities.read`: el estado de una entidad es el valor de un tag con otro nombre, que un visor ya puede leer. Solo el administrador tiene `entities.write`: el entity_id es el nombre con el que se refieren a la entidad todas las automatizaciones, paneles y agentes, y cambiarlo es configuración, no operación.

Un cuerpo `PUT` cambia solo los campos que nombra. Los campos desconocidos se rechazan, y también los campos de identidad (`unique_id`, `domain`, `platform`, el dispositivo y los vínculos):

```json
{
  "entity_id": "sensor.zone_1_temperature",
  "name": "Zone 1 temperature",
  "device_class": "temperature",
  "state_class": "measurement",
  "unit_of_measurement": "°F",
  "icon": "mdi:thermometer",
  "entity_category": "",
  "options": {},
  "disabled": false,
  "hidden": false
}
```

`options` admite `min`, `max` y `step` en un `number` (acotan lo que ofrece una pantalla; la puerta de escritura sigue comprobando el rango propio del tag) y `max_length` y `pattern` en un `text`. Las opciones de un compuesto son suyas (consulte cada dominio más abajo), y un `PUT` que las cambia se comprueba contra sus tags exactamente igual que la creación. `sensor`, `binary_sensor`, `switch` y `alarm` no admiten ninguna.

Una entidad también tiene un lugar en el árbol de equipos y un conjunto de etiquetas: `equipment_id` (null para seguir a su dispositivo), el `area_id` de solo lectura con el que agrupan los clientes, y `labels`. `PUT` admite `equipment_id` y `labels` como cualquier otro campo. Consulte [el árbol de equipos y las etiquetas](/es/iot/equipment/).

## Servicios

Un servicio es lo que se puede hacer con una entidad: `switch.turn_on`, `number.set_value`. Nombra lo que quiere que se haga con la entidad, y por debajo no es más que escrituras de tags.

```
POST /api/services/switch/turn_on
{"entity_id": "switch.press_01_pump", "reason": "start of shift"}

POST /api/services/number/set_value
{"entity_id": "number.press_01_zone1_sp", "value": 212.5}
```

El cuerpo es `entity_id`, un `reason` opcional y los datos del servicio. Una entidad por llamada, nunca una lista, porque la respuesta a "qué salió" debe ser sobre una sola entidad.

### Qué admite cada dominio

| Servicio | Datos | Escribe |
|---|---|---|
| `switch.turn_on`, `switch.turn_off` | ninguno | `true` o `false` en el tag de orden |
| `switch.toggle` | ninguno | lo contrario del estado actual, leído de la caché en vivo con las mismas reglas que el propio estado. Si el estado es `unknown`, `unavailable` o de calidad mala, la llamada se rechaza: alternar algo cuyo estado no conoce es adivinar hacia dónde moverlo. Diga `turn_on` o `turn_off` |
| `number.set_value` | `value`, un número | el valor, en el tag de orden |
| `text.set_value` | `value`, una cadena | la cadena, en el tag de orden |
| `select.select_option` | `option` | el valor en bruto de la opción, en el tag de orden |
| `button.press` | ninguno | `press_value` y, `pulse_ms` después, `release_value`, en el tag de orden; un botón `single_shot` escribe `press_value` una vez y nada después |
| `motor.start`, `motor.stop` | ninguno | `true` o `false` en `run_command` |
| `motor.reset` | ninguno | un pulso en `reset_command`: `true` y, `pulse_ms` después, `false` |
| `motor.set_speed` | `value`, un número | el valor, en `speed_command` |
| `valve.open`, `valve.close` | ninguno | `true` o `false` en `command`; en una válvula modulante, 100 o 0 en `position_command` |
| `valve.stop` | ninguno | un pulso en `stop_command`; una válvula `single_shot` escribe `true` una vez |
| `valve.set_position` | `position`, de 0 a 100 | la posición, en `position_command` |
| `loop.set_setpoint` | `value`, un número | el valor, en `setpoint` |
| `loop.set_mode` | `mode`: `auto`, `manual` o `cascade` | el valor en bruto del modo, en `mode` |
| `loop.set_output` | `value`, un número | el valor, en `output`, **solo mientras el lazo lee manual** |
| `counter.reset` | ninguno | 0 en un `reset_command` numérico, o un pulso en uno bool |
| `alarm.acknowledge` | `note`, opcional | ningún tag: el reconocimiento del motor de alarmas |
| `alarm.shelve` | `minutes`, de 1 a 1440 | ningún tag: el aplazamiento del motor de alarmas |
| `alarm.unshelve` | ninguno | ningún tag: la anulación del aplazamiento del motor de alarmas, solo sobre una alarma pospuesta |
| `script.turn_on` | los campos del script | ningún tag directamente: ejecuta el [script](/es/iot/scripts/), cuyos pasos escriben a través de la puerta como `script:<id>` |
| `script.turn_off` | ninguno | ningún tag: detiene todas las ejecuciones del script |
| `scene.turn_on` | `params`, los parámetros de la receta, y `version`, ambos opcionales | ningún tag directamente: aplica la [receta](/es/iot/recipes/), cuyos destinos escriben a través de la puerta bajo un solo id de llamada |
| `light.turn_on` | `brightness`, de 0 a 100, opcional | `true` en `command` y después el brillo en `brightness_command` |
| `light.turn_off` | ninguno | `false` en `command` |
| `light.toggle` | ninguno | lo contrario de lo que dice la realimentación de estado de la luz; se rechaza cuando no se puede leer |
| `cover.open`, `cover.close`, `cover.stop` | ninguno | `open`, `close` o `stop` en `command` |
| `cover.set_position` | `position`, de 0 a 100 | la posición, en `position_command` |
| `lock.lock`, `lock.unlock`, `lock.open` | ninguno | `lock`, `unlock` u `open` en `state` |
| `fan.turn_on` | `percentage`, `preset_mode`, ambos opcionales | `true` en `state` y después cada uno de los indicados |
| `fan.turn_off`, `fan.toggle` | ninguno | `false`, o lo contrario de lo que dice su realimentación, en `state` |
| `fan.set_percentage` | `percentage`, de 0 a 100 | en `percentage` |
| `fan.set_preset_mode`, `fan.set_direction` | `preset_mode`, `direction` | en `preset_mode`, `direction` |
| `fan.oscillate` | `oscillating`, true o false | en `oscillating` |
| `siren.turn_on`, `siren.turn_off`, `siren.toggle` | ninguno | como un interruptor, en `state` |
| `notify.send_message` | `message` | el mensaje, en `message` |

Un servicio compuesto cuyo rol no está vinculado (`set_speed` en un motor sin `speed_command`) se rechaza antes de planificar nada, como un servicio desconocido.

`sensor` y `binary_sensor` son de solo lectura y no admiten servicios. Los datos de servicio con un campo que el servicio no admite se rechazan, igual que un campo mal escrito en cualquier otro cuerpo: una llamada que sigue adelante sin el campo que usted quería es peor que una que dice que no.

Un número que es entero llega a un tag entero como entero: `42.0` es `42`.

### Cada llamada pasa por la puerta de escritura

Una llamada a un servicio se convierte en una lista ordenada de escrituras, y cada una pasa por `runtime.Manager.Write`. Así, todo lo que la puerta exige a una escritura en un tag, lo exige a una llamada a un servicio, en el mismo orden:

1. escrituras habilitadas (`safety.allowWrites`) y, para un agente, escrituras de agentes habilitadas;
2. el tag armado (`writable`);
3. el valor dentro del rango del tag, rechazado, nunca recortado;
4. después, lo que solo la entidad sabe, comprobado dentro de la puerta contra la entidad y el tag tal como están en ese momento:
   - la entidad no está deshabilitada (dar órdenes a algo que no tiene estado no está permitido);
   - el `min` y el `max` propios de un `number`, que solo pueden estrechar el rango del tag;
   - el `step` de un `number`, contado desde su mínimo (el propio, si no el mínimo del rango del tag, si no cero). Un tag entero tiene un paso de 1 salvo que la entidad diga otra cosa, así que `1.5` en un registro de retención se rechaza en lugar de que un driver lo trunque en silencio a `1`;
   - el `max_length` de un `text` (caracteres, 255 si no se indica) y su `pattern`, que el valor completo debe cumplir;
   - una opción de `select` o un modo de lazo que no sea de la entidad. Se envía a la puerta como la opción o el modo pedidos y se rechaza allí, de modo que quien prueba opciones que no existen queda registrado;
   - una posición de válvula fuera de 0 a 100;
   - un `set_output` de lazo mientras su tag de modo, leído de la caché en vivo en ese momento, sea cualquier cosa menos manual (auto, cascade, un valor que no es ninguno de los modos, o ilegible).

Todo rechazo, en cualquiera de esos pasos, queda **auditado**: una fila `write_audit` con la entidad, el servicio y el id de llamada, `succeeded` en false y el motivo empezando por `refused:`. Eso incluye a un usuario sin `values.write`. La API no se limita a responder 403 y olvidarse: envía la llamada a la puerta marcada como denegada, la puerta la rechaza antes de escribir nada, y el rechazo queda en el historial de la entidad con el valor que se pidió.

Coincide con la forma de una escritura en un dispositivo, no con un nombre, de modo que también se detecta un rodeo mediante un envoltorio nuevo o una interfaz declarada en el momento.

### Qué responde una llamada

```json
{
  "call_id": "9f2c4e1a7b3d5c60",
  "entity_id": "switch.press_01_pump",
  "service": "switch.turn_on",
  "writes": [
    {"tag": "press-01/pump", "value": "true", "status": "written"}
  ]
}
```

Cada escritura tiene un estado:

| Estado | Significado |
|---|---|
| `written` | el dispositivo la aceptó |
| `not_sent` | la puerta la rechazó antes de que llegara al dispositivo: un rechazo, ninguna sesión, una fila de auditoría que no se pudo abrir |
| `failed` | salió y el dispositivo o la conexión informó de un error. No se sabe si surtió efecto |
| `skipped` | nunca se intentó, porque una escritura anterior de la misma llamada no tuvo éxito |

Una llamada fallida responde con el código de estado del error (403 rechazada por política o permiso, 422 valor rechazado, 409 un toggle sin estado conocido o un equipo en un estado incorrecto para el servicio, 503 dispositivo no conectado, 502 el dispositivo tomó la escritura e informó de un error, 404 no existe esa entidad, 400 llamada mal formada, 500 una pulsación cuya liberación no se completó, o un fallo dentro del Gateway, cuyo `error` es solo una referencia al registro del servidor) y el mismo cuerpo con `error` añadido.

Las escrituras de una llamada salen en orden, la primera que no tiene éxito termina la llamada, y **no se deshace nada de lo ya escrito**. Deshacer es en sí una escritura, hecha sin que nadie la pida, sobre un equipo que ya se ha movido. Decidirlo es trabajo del operador, y la respuesta le dice exactamente dónde se detuvo la llamada. Todas las escrituras de una llamada comparten su `call_id`, en el historial de auditoría y en la respuesta.

Hay una excepción, y es la orden momentánea: la pulsación de un botón, el reset de un motor, el stop de una válvula, el reset de un contador en un bit. Son dos escrituras, la pulsación y, pulse_ms después, la liberación, y la liberación no es algo que se omita a la ligera, porque omitirla deja un pulsador mantenido. Por eso:

- La liberación se envía igualmente cuando la pulsación salió y notificó un error (`failed`): puede que haya surtido efecto. Solo se omite cuando la pulsación fue `not_sent`, porque entonces no hay nada pulsado.
- La liberación se envía aunque quien llama cuelgue durante el pulso. La llamada continúa sin él.
- Si la pulsación se escribió y la liberación se rechazó o falló, la llamada falla con un 500 y lo dice: el tag **puede seguir con el valor de pulsación**, compruébelo y libérelo a mano. El rechazo o el fallo de la liberación queda en el historial de auditoría con el mismo id de llamada, y la llamada se registra bajo la entidad con gravedad error, no advertencia.

Un pulso dura `pulse_ms`, 500 por defecto, como máximo 10 000. La llamada responde cuando termina la liberación, así que quien llama espera al pulso.

Cada llamada es además una línea en el registro del sistema, bajo el entity_id, categoría `write`, con el motivo y, en el detalle, el id de llamada, el origen y cada escritura con su estado. Las escrituras de tag individuales conservan sus propias líneas bajo sus tags, como siempre.

`GET /api/writes?entity=switch.press_01_pump` es el historial de auditoría de esa entidad, rechazos incluidos, de la más reciente a la más antigua. Las filas tienen `entityId`, `service` y `callId`; una escritura directa a un tag los omite, así que todo lector existente de `/api/writes` ve exactamente lo que veía antes. La migración `0007_service_audit.sql` añade las tres columnas, vacías en todas las filas existentes.

### Preguntar primero: la simulación

`POST /api/services/{domain}/{service}?dry_run=true` pregunta a la puerta qué haría con una llamada, y no hace nada de ello. Mismo cuerpo, mismo permiso.

```json
{"dry_run":true,"entity_id":"number.press_01_zone1_sp","service":"number.set_value","writes":[{"tag":"press-01/zone1_sp","value":"212.5","status":"would_write"}]}
```

```json
{"dry_run":true,"error":"press-01/zone1_sp: this tag is not marked writable","entity_id":"number.press_01_zone1_sp","service":"number.set_value","writes":[{"tag":"press-01/zone1_sp","value":"212.5","status":"not_sent","error":"press-01/zone1_sp: this tag is not marked writable"}]}
```

La llamada se planifica exactamente como la real, y cada escritura que haría se somete a las comprobaciones propias de la puerta, en el mismo orden, contra los tags, la entidad y el dispositivo tal como están ahora mismo: escrituras activadas, el interruptor de agentes, el tag armado, su rango, todo lo que solo sabe la entidad (paso, patrón, un lazo en manual, una entidad deshabilitada) y una sesión con el dispositivo. La primera escritura que se rechazaría es `not_sent` con el motivo, las demás `skipped`, y `error` es el error con el que fallaría la llamada real, **palabra por palabra**. Las que saldrían son `would_write`. Es una sola función de la puerta (`precheck`) la que responde a ambas, así que una simulación no puede pasar por alto comprobaciones que la escritura real sí hace. Una entidad `alarm` no escribe ningún tag, así que su simulación hace las comprobaciones de alarma (el motor en marcha, la definición todavía presente, la entidad habilitada, solo una alarma pospuesta puede dejar de estarlo) y responde sin escrituras; la alarma no se toca y el historial de alarmas no recibe nada.

Es una pregunta, así que un veredicto, rechazado o no, responde 200. Una petición que la llamada real rechazaría antes de cualquier comprobación (no existe la entidad, un servicio que el dominio no admite, datos que no acepta, un toggle sin estado conocido, el dominio equivocado en la ruta) responde con el mismo estado y el mismo error que la llamada real. Un usuario sin el permiso recibe el mismo 403.

Una simulación no escribe nada, no abre ninguna fila de auditoría, no pone nada en el registro del sistema y no gasta ningún id de llamada: no se intentó nada, así que no hay nada que justificar.

Dice qué pasaría **ahora mismo**. Entre la simulación y la llamada real el dispositivo puede caerse y alguien puede desarmar el tag; la llamada real se comprueba de nuevo, entera, en el momento de la escritura. Un caso se responde con más precisión que las comprobaciones de la propia llamada real: un dispositivo cuya sesión se ha caído mientras su trabajador se reconecta. La escritura real llega hasta el driver y falla allí (`failed`, 503 y una fila de auditoría del intento); la simulación dice `not_sent` desde el principio, con el mismo error.

El cuadro de órdenes de la pantalla Entidades y del panel de la entidad la usa: al abrirse el cuadro y a medida que se escribe un valor, pregunta, y un rechazo aparece en el cuadro, con las palabras de la puerta, antes de que nadie pulse confirmar. Es un consejo, no un cerrojo: confirmar sigue yendo a la puerta, que decide de nuevo.

## Equipos compuestos

Un tag corresponde a una entidad. Una bomba no corresponde a un tag: tiene una orden de marcha, un contacto de marcha, un fallo, un reset y quizá una velocidad, y el operador la ve como una sola cosa. Un compuesto es esa única cosa, vinculada a cada uno de sus tags con un **rol** con nombre.

Un administrador construye uno con `POST /api/entities`:

```json
{
  "domain": "motor",
  "name": "Infeed pump",
  "device_class": "pump",
  "options": {"pulse_ms": 500},
  "bindings": [
    {"role": "running",       "device_id": "press-01", "tag_name": "P101_Running"},
    {"role": "run_command",   "device_id": "press-01", "tag_name": "P101_RunCmd"},
    {"role": "fault",         "device_id": "press-01", "tag_name": "P101_Fault"},
    {"role": "reset_command", "device_id": "press-01", "tag_name": "P101_Reset"}
  ]
}
```

`entity_id` es opcional. Si lo omite, se crea uno a partir del nombre (`motor.infeed_pump`, luego `_2` y así sucesivamente). Si lo indica, se usa tal cual, y uno ya ocupado es un 409, no un `_2` silencioso: usted pidió ese nombre. `name`, `device_class`, `unit_of_measurement`, `icon`, `entity_category` y `options` son los mismos campos de registro que tiene toda entidad. Colóquelo en el árbol de equipos y póngale etiquetas con `PUT` después.

La creación comprueba todo lo que puede contra los tags tal como están ahora, y rechaza (400, diciendo qué corregir) todo lo que no esté bien:

- el dominio es uno de `select`, `button`, `motor`, `valve`, `loop`, `counter`, `weather` (`GET /api/entities/composites` dice cuáles son y los roles de cada uno). Los dominios de tag se crean solos a partir de los tags, y `alarm` a partir de las definiciones de alarma;
- todos los roles obligatorios están vinculados, y ningún rol que el dominio no tenga;
- **todos los tags vinculados existen**;
- **el tipo de cada tag encaja con su rol**: el `running` de un motor es bool, el `position` de una válvula es un número, la cuenta de un contador es un entero;
- **todos los tags en los que escribe un servicio ya están armados** (`writable`). Un compuesto nunca arma nada. Armar un punto sigue siendo una decisión que alguien toma sobre el tag, de uno en uno, como siempre;
- todo valor en bruto de las opciones (el valor de una opción de select, los valores de pulsación y liberación de un botón, los modos de un lazo) es uno que su tag puede tomar. `1.5` se rechaza ahora para un registro entero, no cuando alguien pulsa el botón.

Un compuesto se va con su dispositivo cuando todos sus tags están en un solo dispositivo, y no pertenece a ninguno cuando abarcan varios. Sus vínculos son fijos: un conjunto distinto de tags es una entidad distinta, así que elimínelo y construya otro.

Cada creación y cada eliminación es una línea en el registro del sistema bajo el entity_id, categoría `config`, con los vínculos.

### Roles

| Dominio | Rol | Tipo de tag | <span class="sr-only">Detalles</span> |
|---|---|---|---|
| `select` | `state` | cualquiera | obligatorio. Realimentación: se lee para encontrar la opción |
| | `command` | cualquiera | obligatorio, armado. Se escribe con el valor en bruto de la opción. Puede ser el mismo tag que `state` |
| `button` | `command` | cualquiera | obligatorio, armado. Se pulsa |
| `motor` | `running` | bool | obligatorio. Realimentación: el contacto de marcha |
| | `run_command` | bool | obligatorio, armado. `start` escribe true, `stop` false |
| | `fault` | bool | realimentación |
| | `reset_command` | bool | armado. Pulsado por `reset` |
| | `speed` | número | realimentación, el atributo `speed` |
| | `speed_command` | número | armado. Escrito por `set_speed` |
| `valve` | `state` | cualquiera | realimentación: dónde dice, con palabras, que está una válvula que se anunció a sí misma |
| | `opened`, `closed` | bool | realimentación: los finales de carrera |
| | `position` | número | realimentación, de 0 a 100 por ciento |
| | `fault` | bool | realimentación |
| | `command` | bool | armado. Una válvula todo o nada: `open` escribe true, `close` false |
| | `position_command` | número | armado. Una válvula modulante: `set_position`, y `open`/`close` como 100/0 |
| | `stop_command` | bool | armado. Pulsado por `stop` |
| `loop` | `pv` | número | obligatorio. El estado |
| | `setpoint` | número | obligatorio, armado. Se lee para el atributo, se escribe con `set_setpoint` |
| | `output` | número | obligatorio, armado. Se lee para el atributo, se escribe con `set_output` |
| | `mode` | cualquiera | obligatorio, armado. Se lee para conocer el modo, se escribe con `set_mode` |
| `counter` | `state` | entero | obligatorio. La cuenta |
| | `reset_command` | bool o número | armado. Se pulsa si es bool, se escribe con 0 si es número (puede ser el propio registro de la cuenta) |
| `weather` | `temperature` | número | obligatorio. El estado |
| | `humidity`, `pressure`, `wind_speed`, `wind_gust`, `wind_bearing`, `rain_rate`, `rain_today`, `solar_radiation`, `uv_index` | número | realimentación, cada uno un atributo. Ninguno está armado: una estación se lee, nunca se le dan órdenes |

Una válvula necesita al menos uno de `state`, `opened`, `closed` y `position` (algo tiene que decir dónde está) y exactamente uno de `command` y `position_command`. Los dos a la vez serían dos respuestas a "adónde se le ha dicho que vaya", y el estado entre los finales de carrera depende de esa respuesta. Si el PLC realmente tiene ambos, cree dos entidades.

### Opciones

| Opción | Dominio | <span class="sr-only">Detalles</span> |
|---|---|---|
| `select_options` | `select` | obligatorio: `[{"option": "low", "value": 1}, ...]`, en el orden en que una pantalla las ofrece. Nombres únicos, valores únicos (dos opciones con un mismo valor harían del estado una conjetura), cada valor un número, un bool o una cadena |
| `press_value`, `release_value` | `button` | juntos o ninguno. Si se omiten en un tag bool, son `true` y `false`, escritos en las opciones para que lo que hace el botón quede registrado. Cualquier otro tipo de tag necesita ambos |
| `pulse_ms` | `button`, `motor`, `valve`, `counter` | cuánto se mantiene una orden momentánea. De 1 a 10 000, 500 si no se indica |
| `single_shot` | `button`, `valve` | `true` escribe `press_value` una vez y no libera nunca: la pulsación es la orden entera. Un botón MQTT descubierto es uno, porque su "liberación" sería una segunda orden que el dispositivo nunca pidió. Admite `press_value` y no `release_value` ni `pulse_ms`. En una válvula, su `stop` escribe `true` una vez en lugar de un pulso: el stop de una válvula descubierta es una orden propia |
| `event_types` | `event` | los tipos de evento que puede disparar, cuando lo dice |
| `role_choices` | `lock`, `fan`, `siren`, `notify`, `update`, `device_tracker`, `climate`, `humidifier`, `water_heater` | las palabras que ofrece cada rol con órdenes, por rol, de 1 a 64 distintas cada una: los modos de un termostato. El descubrimiento lo define a partir de la configuración |
| `modes` | `loop` | obligatorio: el valor en bruto del tag de modo para cada modo, `{"auto": 1, "manual": 0}` como mínimo, `cascade` si el controlador lo tiene |

### Cómo se decide el estado de un compuesto

El estado de un compuesto sale de su **realimentación**. Nunca se calcula a partir del hecho de que HotLoop enviara una orden. Un motor al que se ha ordenado arrancar y cuyo contacto de marcha no se ha cerrado no está en marcha, está arrancando, y si el contacto no se cierra nunca sigue arrancando hasta que alguien lo mire. La lectura de vuelta de un tag de orden sí cuenta como realimentación: es el PLC diciendo qué tiene, no HotLoop recordando lo que escribió.

Un compuesto **nunca es optimista**. Un sensor individual sigue mostrando su último valor correcto a través de una lectura mala; un compuesto no. Todo rol de realimentación que decide el estado debe tener una lectura buena, o:

| Condición | `state` | `quality` |
|---|---|---|
| un tag decisivo ya no existe, o su dispositivo está caído | `unavailable` | `bad` |
| un tag decisivo aún no tiene lectura, o tiene una mala | `unknown` | `bad` |
| todos los tags decisivos buenos, uno de ellos dudoso o en un dispositivo degradado | el estado | `uncertain` |
| todos los tags decisivos buenos | el estado | `good` |

Un motor cuya entrada de fallo dejó de responder está `unknown`, no el `running` que era hace un segundo. Más abajo se indica qué roles deciden; los demás solo rellenan atributos, y uno ilegible simplemente se omite.

El atributo `armed` de un compuesto es true solo cuando todos los tags en los que escribe cualquiera de sus servicios están armados ahora mismo. Un motor que se puede arrancar pero no parar desde aquí no es uno que una pantalla deba ofrecer.

### `motor`

Roles decisivos: `running` y `fault` si está vinculado. Estado, la primera regla que coincide:

1. `fault` activo: **`fault`**, sea lo que sea lo demás. Marcha y fallo a la vez es contradictorio, y lo que necesita a una persona es el fallo; el atributo `running` sigue diciendo que está girando.
2. en marcha, y la orden de marcha se lee desactivada: **`stopping`**.
3. en marcha: **`running`**.
4. no está en marcha, y la orden de marcha se lee activada: **`starting`**.
5. en cualquier otro caso: **`stopped`**.

Si la lectura de vuelta de la orden de marcha es ilegible, no decide nada: el motor está entonces `running` o `stopped` solo por su contacto. HotLoop no pone límite de tiempo a un arranque que no se completa: eso es un fallo de arranque, y corresponde al PLC o a una definición de alarma sobre el contacto de marcha.

Atributos: `running`, `fault` (si está vinculado), `command` (la lectura de vuelta), `speed` (si está vinculado y legible), `device_class` (`pump`, `fan`, `conveyor`, `compressor`, `agitator`).

### `valve`

Una válvula que se anunció a sí misma (descubrimiento MQTT) dice con palabras dónde está en su rol `state`: `open`, `closed`, `opening`, `closing` o `stopped`, y ese es su estado, con `current_position` tomado de `position` cuando informa de uno. Una palabra que no es ninguna de esas es `unknown`, con lo que dijo en `raw_value`. El resto de esta sección trata de una válvula construida con tags de PLC.

Roles decisivos: todos los vinculados entre `opened`, `closed`, `position`, `fault`. Estado, la primera regla que coincide:

1. `fault` activo: **`fault`**.
2. los dos finales de carrera activados: **`fault`**, con `limit_conflict: true`. Una válvula no puede estar abierta y cerrada, así que un final de carrera miente, y cuál no es cosa que se deba adivinar.
3. final de abierto activado: **`open`**. Final de cerrado activado: **`closed`**.
4. sin finales de carrera, solo posición: al 1 % o menos **`closed`**, al 99 % o más **`open`**.
5. entre los extremos, en movimiento o detenida según lo que se le ordena: una orden de posición leída más de un 1 % por encima de la posición es **`opening`**, más de un 1 % por debajo **`closing`**, dentro del 1 % **`stopped`**; una orden todo o nada leída activada es **`opening`**, desactivada **`closing`**; sin nada en lo que basarse, **`stopped`**.

Una válvula todo o nada detenida entre sus finales de carrera mientras sigue con orden de abrir se lee `opening`. Si necesita verla detenida ahí, vincule `position`.

`current_position` es la realimentación de posición cuando está vinculada; si no, 100 en el final de abierto y 0 en el de cerrado, y no existe entre ambos. Otros atributos: `open_limit`, `closed_limit`, `fault`, `device_class` (`water`, `gas`, `steam`, `air`).

### `loop`

El estado es la variable de proceso, mostrada como la de un sensor, solo a partir de `pv`. Los atributos son `setpoint` y `output` (presentes cuando son legibles), `mode` (el nombre del modo que lee el tag de modo, o `unknown` cuando no se puede leer o contiene un valor que no es ninguno de los modos), `modes` (los nombres configurados) y `unit_of_measurement` (el de la entidad, si no el del tag PV). Un lazo admite las clases de dispositivo de los sensores: un lazo de temperatura, un lazo de presión.

`set_output` se rechaza dentro de la puerta salvo que el lazo lea manual **en el momento de la escritura**. Una salida escrita en un lazo en auto pelea con el controlador, y en cascade pelea con dos. Un modo que no se puede leer no es manual. El rechazo es una fila `write_audit` como cualquier otra, con la entidad, el servicio, el id de llamada y el valor pedido, y la llamada responde 409. Ponga primero el lazo en manual con `set_mode`.

### `counter`

El estado es la cuenta, un tag entero. `reset` escribe 0 en un `reset_command` numérico (vincule el propio registro de la cuenta si así es como lo reinicia el PLC) o pulsa uno bool. Un contador sin `reset_command` es de solo lectura. `unit_of_measurement` es el de la entidad, si no el del tag.

### `weather`

Una estación de tejado como una sola entidad: consulte [Meteorología](/es/iot/weather/). El estado es la temperatura; todas las demás lecturas son atributos, presentes solo cuando su sensor se puede leer, con el punto de rocío, el índice de calor y la sensación térmica por viento calculados a partir de ellas. Una lectura que está vinculada y no se puede leer se nombra en `unavailable`, nunca se muestra como cero. No admite ningún servicio.

### `select`

El estado es la opción cuyo valor en bruto lee el tag `state`. Un valor que no es ninguna de las opciones es `unknown`, con el valor en bruto en `raw_value`, en lugar de la opción más cercana o la última. El atributo `options` enumera los nombres de las opciones en orden. Una opción que no es del select se rechaza en la puerta y se audita con la opción que se pidió.

### `button`

Un botón no tiene realimentación. Su estado es la hora de su última pulsación a través de este Gateway, o `unknown` si no se ha pulsado desde que arrancó el Gateway. Está `unavailable` cuando su tag de orden ya no existe o su dispositivo está caído, porque entonces pulsarlo no puede funcionar. La última pulsación se guarda en memoria, así que se pierde en un reinicio; el historial de auditoría tiene todas las pulsaciones de todos modos, y por eso el libro de registro no registra el estado de un botón.

## Luces, persianas y eventos

Los crea el [descubrimiento MQTT](/es/iot/mqtt-discovery/) para un dispositivo que se anunció, vinculados a los tags que el descubrimiento creó para él. Nadie construye esto con tags de PLC, así que `POST /api/entities` no los admite. Mismas reglas que todo compuesto: el estado es lo que dice la realimentación, nunca lo último que envió HotLoop, y todo servicio son escrituras a través de la puerta, con cada tag armado antes por una persona.

| Dominio | Rol | Tipo de tag | <span class="sr-only">Detalles</span> |
|---|---|---|---|
| `light` | `state` | bool | realimentación: encendida o apagada |
| | `command` | bool | armado. `turn_on` escribe true, `turn_off` false. El mismo tag que `state` |
| | `brightness` | número | realimentación, de 0 a 100 por ciento, el atributo `brightness` |
| | `brightness_command` | número | armado. `turn_on` con un `brightness`. El mismo tag que `brightness` |
| `cover` | `state` | cualquiera | realimentación: `open`, `closed`, `opening`, `closing` o `stopped` |
| | `command` | cualquiera | armado. `open`, `close` o `stop`. El mismo tag que `state` |
| | `position` | número | realimentación, de 0 (cerrada) a 100 (abierta), `current_position` |
| | `position_command` | número | armado. `set_position`. El mismo tag que `position` |
| `event` | `state` | cualquiera | el tipo de evento que disparó por última vez |
| `lock` | `state` | cualquiera | se lee y se escribe: `locked`, `unlocked`, `locking`, `unlocking`, `jammed`, `open`, `opening`; admite `lock`, `unlock`, `open` |
| `fan` | `state` | bool | se lee y se escribe: encendido o apagado |
| | `percentage` | número | se lee y se escribe, de 0 a 100 |
| | `preset_mode`, `direction` | cualquiera | se lee y se escribe |
| | `oscillating` | bool | se lee y se escribe |
| `siren` | `state` | bool | se lee y se escribe: encendida o apagada |
| `notify` | `message` | cualquiera | se escribe: el mensaje. Nada que leer |
| `update` | `installed_version`, `latest_version` | cualquiera | se lee |
| `device_tracker` | `state` | cualquiera | se lee: `home`, `not_home` o la zona que nombra |
| `climate` | `mode` | cualquiera | se lee y se escribe: el estado. `set_hvac_mode` con `hvac_mode` |
| | `temperature`, `target_temp_low`, `target_temp_high` | número | se lee y se escribe. `set_temperature` con cualquiera de ellos |
| | `target_humidity` | número | se lee y se escribe. `set_humidity` con `humidity` |
| | `fan_mode`, `swing_mode`, `swing_horizontal_mode`, `preset_mode` | cualquiera | se lee y se escribe, cada uno con su propio servicio `set_` |
| | `current_temperature`, `current_humidity`, `action` | número, número, cualquiera | se lee |
| | `power` | bool | se escribe: `turn_on` true, `turn_off` false. Nada que leer |
| `humidifier` | `state` | bool | se lee y se escribe: encendido o apagado |
| | `target_humidity` | número | se lee y se escribe. `set_humidity` con `humidity` |
| | `mode` | cualquiera | se lee y se escribe. `set_mode` con `mode` |
| | `current_humidity`, `action` | número, cualquiera | se lee |
| `water_heater` | `mode` | cualquiera | se lee y se escribe: el estado. `set_operation_mode` con `operation_mode` |
| | `temperature` | número | se lee y se escribe. `set_temperature` |
| | `current_temperature` | número | se lee |
| | `power` | bool | se escribe: `turn_on`, `turn_off` |
| `alarm_control_panel` | `state` | cualquiera | se lee: `disarmed`, `armed_home`, `armed_away`, `armed_night`, `armed_vacation`, `armed_custom_bypass`, `pending`, `triggered`, `arming`, `disarming`; se escribe con `alarm_arm_home`, `alarm_arm_away`, `alarm_arm_night`, `alarm_arm_vacation`, `alarm_arm_custom_bypass`, `alarm_disarm`, `alarm_trigger` |
| `vacuum` | `state` | cualquiera | se lee: `cleaning`, `docked`, `paused`, `idle`, `returning`, `error`; se escribe con `start`, `pause`, `stop`, `return_to_base`, `clean_spot`, `locate` |
| | `battery_level` | número | se lee |
| | `fan_speed` | cualquiera | se lee y se escribe. `set_fan_speed` con `fan_speed` |
| `lawn_mower` | `activity` | cualquiera | se lee: `mowing`, `paused`, `docked`, `error`, `returning` |
| `camera` | `image` | cualquiera | se lee: un hash de la última imagen. El estado es cuándo cambió; `entity_picture` es dónde obtenerla |
| `image` | `image` o `url` | cualquiera | se lee: una imagen guardada como en una cámara, o un enlace (`url`, solo http o https, nunca se descarga) |
| | `start_mowing`, `pause`, `dock` | bool | se escribe: una pulsación cada uno, con el servicio del mismo nombre |

El estado es la lectura del rol de estado (encendido o apagado para un bool), `unknown` cuando no se puede leer, y todo otro rol que se pueda leer es un atributo con su propio nombre: el `percentage`, `preset_mode`, `oscillating` y `direction` de un ventilador. `toggle` se guía por la realimentación y se rechaza cuando no hay ninguna. Un notificador no tiene nada que leer: su estado es `unknown` con `feedback: none`. Una actualización está `on` cuando lo instalado no es lo último, y no admite servicios: HotLoop nunca instala firmware, porque un flasheo fallido es una parada. Una escena descubierta es un botón de un solo disparo, y su pulsación es la carga de la escena.

Lo que se le puede enviar a un equipo está en sus atributos, según su configuración: los `hvac_modes`, `fan_modes`, `preset_modes` y `swing_modes` de un termostato, los `available_modes` de un humidificador, la `operation_list` de un calentador de agua, los `preset_modes` de un ventilador, la `fan_speed_list` de una aspiradora (de la opción `role_choices` de la entidad, que el descubrimiento mantiene al día con la configuración), y los `min_temp`/`max_temp` y `min_humidity`/`max_humidity` de la consigna (del rango del tag). Es lo que ofrecen las pantallas. No es lo que hace la regla: la puerta mantiene la consigna dentro del rango del tag y el driver rechaza una palabra que la configuración no enumera, diga lo que diga un atributo. `set_temperature` sin ninguna de sus tres claves se rechaza, no es una llamada que no hace nada. `turn_on` en un termostato sin topic de alimentación también se rechaza, en lugar de adivinar qué modo significa "encendido".

### `light`

Encendida o apagada según su realimentación de `state`; `unknown` cuando no se puede leer, y sin ningún topic de estado, `unknown` para siempre con `feedback: none`. El brillo es un atributo, y el `color_mode`, `color`, `color_temp` y `effect` de una luz de esquema JSON son también atributos: se muestran, no se les dan órdenes. `toggle` se guía por la realimentación y se rechaza cuando no hay ninguna en que basarse.

### `cover`

Su realimentación de `state` cuando la tiene. Con solo una posición: al 1 % o menos `closed`, cualquier valor por encima `open`. Una palabra que no es ninguna de las cinco es `unknown`, con `raw_value`. `current_position` es la posición cuando la hay.

### `event`

El estado de un evento es **cuándo** se disparó por última vez (RFC 3339), y `event_type` qué fue; `event_types` enumera lo que puede disparar. `unknown` hasta que se ha disparado desde que HotLoop empezó a leerlo. No admite servicios: nada da órdenes a un evento. Dos eventos en un mismo sondeo se muestran como el más reciente; el libro de registro y el historial tienen cada lectura tal como llegó.

## Entidades de alarma

Toda definición de alarma es una entidad: `alarm.<definition id>` (con el mismo slug que el de un tag, así que `oven-temp-hi` es `alarm.oven_temp_hi`), plataforma `alarm`, `unique_id` `alarm:<definition id>`, con el nombre de la definición. No tiene vínculos ni dispositivo: su estado es el del motor de alarmas, no el de un tag, y una definición no pertenece a su dispositivo como un tag (eliminar un dispositivo deja sus definiciones de alarma). El tag que vigila es su atributo `source`.

El estado es el estado ISA-18.2 que tiene el motor de alarmas, escrito como se escribe el estado de una entidad:

| Motor de alarmas | Estado de la entidad | <span class="sr-only">Detalles</span> |
|---|---|---|
| `normal` | `normal` | condición despejada, nada pendiente |
| `unack-active` | `active_unack` | condición verdadera, nadie la ha reconocido |
| `ack-active` | `active_ack` | condición verdadera, reconocida |
| `rtn-unack` | `rtn_unack` | despejada antes de que nadie la reconociera |
| `shelved` | `shelved` | silenciada por un operador, durante un tiempo limitado |
| `suppressed` | `suppressed` | silenciada por diseño |

La calidad es `good`: el estado del motor no es una lectura. La entidad está `unavailable` cuando es huérfana o el Gateway no tiene motor de alarmas. Sigue cada transición según ocurre, reconocimientos incluidos.

Atributos: `definition_id`, `source`, `condition`, `limit`, `priority` (de 1 a 4), `priority_label`, `enabled`, `message`, `count`, `active`, `needs_ack`, `trip_value`, `raised_at`, `cleared_at`, `acked_at`, `acked_by`, `shelved_until`, `shelved_by`, los últimos presentes cuando corresponden.

Sus servicios, `acknowledge`, `shelve` y `unshelve`, no escriben ningún tag, así que no pasan por la puerta de escritura. Llaman a los `Ack`, `Shelve` y `Unshelve` del propio motor de alarmas, los mismos que llaman la pantalla de alarmas y `POST /api/alarms/{id}/ack`, de modo que quedan en el historial de alarmas (`alarm_events`) y en el registro del sistema exactamente igual que ellos. Necesitan **`alarms.ack`**, no `values.write`: un operador reconoce alarmas, un visor no. Una llamada rechazada responde 403 y se registra bajo la entidad con quién lo intentó. La llamada es también una línea en el registro del sistema bajo la entidad, con el motivo.

`unshelve` se rechaza (409) en una alarma que no está pospuesta. El motor de alarmas también la rechaza, y devuelve una alarma pospuesta al estado en que realmente está su condición, no a normal a ciegas. Un servicio que las alarmas no admiten (`turn_on`) se rechaza como servicio desconocido (400) antes de acercarse siquiera al motor.

### Plataformas con proveedor

Las entidades de alarma son la primera plataforma con **proveedor**: entidades cuya fuente de verdad está en otro sitio que un tag. Un proveedor dice qué entidades tiene ahora su plataforma, muestra su estado, ejecuta sus servicios y responde a sus simulaciones; el registro deriva, deja huérfanas y readopta sus entidades por `unique_id` exactamente como hace con las de un tag, el motor de estado las recalcula con los eventos del propio proveedor y con su ciclo de una vez por segundo, y una llamada a un servicio sobre una va al proveedor en lugar de planificarse como escrituras de tags. Un proveedor que escribe un tag lo sigue escribiendo a través de la puerta.

Los ayudantes son la segunda: `input_boolean`, `input_number`, `input_select`, `input_text`, `input_counter`, `timer` y `schedule`, valores que son de las personas de la planta y no de un PLC, guardados por HotLoop y fijados con `helpers.write`. No escriben ningún tag. Consulte [Ayudantes](/es/iot/helpers/).

Los scripts son la tercera: todo script es una entidad `script`, `script.<id>`, activa mientras hay una ejecución suya en marcha en cualquier proceso e inactiva cuando no hay ninguna. `turn_on` lo ejecuta con los datos del servicio como sus campos, `turn_off` lo detiene, ambos con `scripts.run`. Eliminar un script deja huérfana su entidad, como eliminar una definición de alarma. Consulte [Scripts de procedimientos](/es/iot/scripts/).

Las recetas son la cuarta: toda receta es una entidad `scene`, `scene.<id>`, cuyo estado es cuándo escribió por última vez en la planta y cuyos atributos dicen cómo fue su aplicación más reciente. `turn_on` la aplica, con `recipes.apply` y el permiso propio de la receta cuando lo nombra. Eliminar una receta deja huérfana su entidad. Consulte [Recetas de producto](/es/iot/recipes/).

El sol es la quinta: `binary_sensor.sun_up`, `sensor.sun_elevation` y `sensor.sun_azimuth`, calculados cada segundo a partir de la latitud y la longitud del sitio, en el propio equipo. Se leen y no admiten servicios. Un sitio sin ubicación no los tiene, y los que quedan de cuando la tuvo aparecen como no disponibles e indican qué variables definir. Consulte [el sol](/es/iot/sun/).

## Entidades en todas partes

### El flujo en vivo

`GET /api/stream` lleva un evento `entities` junto a `values`. Se agrupa del mismo modo, cuatro veces por segundo como máximo, el estado más reciente de cada entidad:

```
event: entities
data: {"changed":[{"entity_id":"sensor.press_01_zone1_temp","state":"212.5",...}],"removed":[]}
```

`changed` es el estado completo de cada entidad que cambió desde el último evento, con la misma forma que `GET /api/states/{entity_id}`. `removed` son los entity_id que ya no tienen ningún estado: deshabilitados, eliminados con su dispositivo, o renombrados (el nombre nuevo llega en `changed`). El primer evento `entities` de una conexión nueva lleva todos los estados, igual que `snapshot` lleva todas las lecturas, de modo que una pantalla se llena antes de que cambie nada. Los eventos `values`, `snapshot`, `alarm` y `device` son exactamente lo que eran.

### MCP

Los agentes disponen de `list_entities`, `get_states` y `call_service`. `call_service` pasa por el mismo ejecutor de servicios que `POST /api/services/...`, así que la llamada de un agente queda controlada por el interruptor MCP como `write_tag` y auditada contra la entidad con el origen `mcp`. Consulte [MCP](/es/iot/mcp/#entidades).

### Automatizaciones

Un disparador `state` activa una regla cuando cambia el estado de una entidad, las condiciones pueden leer `states`, `attrs` y las `qualities` de las entidades, y una acción `call_service` da órdenes a una entidad a través de la puerta, auditada como `automation:<rule-id>`. Consulte [Automatizaciones](/es/iot/automations/#los-disparadores-de-estado-siguen-a-las-entidades).

Ambos siguen el gancho `OnStateChanged` del motor, y por eso importan las reglas de [Cómo funciona el motor](#cómo-funciona-el-motor): un disparador de estado ve todos los cambios que calcula el motor, una vez, en orden, y nada de lo que el motor nunca vio.

## Pantallas

**Entidades** enumera todas las entidades bajo su lugar en el árbol de equipos (el suyo propio o, si no, el de su dispositivo), con el árbol al lado, y filtra por lugar, dominio, etiqueta, texto y calidad. Dentro de un lugar va primero el equipo (alarmas, motores, válvulas, lazos, selects, botones, contadores), luego lo que admite órdenes y por último las lecturas en bruto.

Por defecto la pantalla muestra cada señal una sola vez. El modelo de entidades da a propósito varias entidades a un mismo punto, y cada una conserva su id, pero dibujadas como tarjetas son la misma señal dos o tres veces: un tag armado es un sensor y un interruptor, y un tag vinculado a un motor sigue siendo su propio sensor. En una línea real eso duplicaba aproximadamente las tarjetas y sepultaba los equipos. Por eso la pantalla las agrupa:

- La entidad de lectura de un tag queda detrás de su entidad de control. El interruptor o el número es la tarjeta, ya que muestra el estado en vivo, y su panel dice "también disponible como" con el entity_id del sensor, para quien esté conectando una automatización o un agente.
- Un tag vinculado a un compuesto queda dentro del compuesto, con sus dos entidades. El panel del compuesto enumera sus señales: los roles, el tag, lo que lee ahora y los entity_id de lectura y de control. Un tag que está en dos compuestos entra en el primero por nombre.
- Solo un control o un compuesto que no esté oculto ni deshabilitado admite algo en su interior. Oculte o deshabilite el interruptor y su sensor recupera su tarjeta.
- Una alarma sobre una señal agrupada marca la tarjeta en la que está agrupada, con el nombre de la alarma, y abre la alarma desde ahí. Agrupar ordena la pantalla; nunca oculta una alarma.
- El recuento junto a la barra de calidad dice "13 mostrados · 25 agrupadas", y una tarjeta que contiene otras lo dice en su pie ("5 señales", "+ sensor"). Los chips de dominio, los recuentos del árbol y la barra de calidad cuentan las tarjetas mostradas.
- La búsqueda y el filtro de etiquetas miran dentro de las tarjetas. Busque un entity_id o un tag que está agrupado y obtendrá la tarjeta que lo contiene, resaltada, con "Se encontró aquí:" y el entity_id. Lo preferimos a cambiar toda la pantalla a todas las entidades: usted llega a la bomba que buscaba, no a un muro de tarjetas.

"Mostrar todas las entidades" desactiva la agrupación y da a cada entidad su propia tarjeta, para un ingeniero que quiere el registro en bruto. Viene desactivado por defecto y este navegador lo recuerda (almacenamiento local; una ventana privada lo olvida). La pantalla de nadie más cambia.

Los estados llegan con el evento `entities` del flujo en vivo; la pantalla nunca los sondea. Una tarjeta se repinta cuando cambia su estado, y se repinta incluso mientras un botón de ella tiene el foco, porque una tarjeta que conservara un estado antiguo por ese motivo mostraría el pasado como si fuera el presente. La calidad se dibuja antes que el valor:

| Calidad | En pantalla |
|---|---|
| buena | el valor, sin marca |
| dudosa | el valor, un borde ámbar y una insignia "dudoso" |
| mala | el último valor correcto, atenuado sobre un trazado rayado, "malo", y "último valor correcto, lectura mala", con el motivo detrás cuando el driver lo dio |
| aún sin lectura | "Desconocido", en cursiva, y "lectura mala" con el motivo cuando lo hay |
| no disponible | "No disponible", toda la tarjeta rayada |

Los controles siguen el dominio y el rol. Un visor no ve ninguno. Un operador ve los que dependen de `values.write` (y los de una alarma, de `alarms.ack`), deshabilitados y con el motivo indicado cuando las escrituras están desactivadas en esta instalación o un tag en el que escribe la entidad no está armado. La salida de un lazo solo se ofrece mientras lee manual, porque es el único momento en que la puerta lo permite. Cada orden abre un cuadro que dice qué servicio, qué tags y qué lee ahora la entidad, y pide un motivo para el historial de auditoría. Un rechazo mantiene abierto el cuadro con las palabras de la puerta y todas las escrituras que salieron o no. El estado nuevo nunca se da por supuesto a partir de la orden: vuelve por el flujo cuando el dispositivo lo lee de vuelta, o no vuelve.

El panel tiene el estado y sus marcas de tiempo, los controles, una hora, seis horas o un día del historial del tag vinculado (un trazo escalonado, el último valor extendido hasta ahora, lecturas malas marcadas), las otras entidades de la misma señal, los vínculos (para un compuesto, sus señales), los atributos y todas las órdenes dadas o rechazadas a través de la entidad. Un administrador obtiene además el entity_id, el nombre, el lugar en el árbol, las etiquetas, oculta y deshabilitada, y eliminar para un compuesto o una huérfana.

**Nuevo equipo** (administrador) construye un compuesto: elija el dominio, póngale nombre y elija un tag para cada rol. A cada rol solo se le ofrecen tags de un tipo que le encaje, y un rol de orden muestra los tags que no están armados como deshabilitados en lugar de ocultarlos. Lo obligatorio está marcado pero el formulario no lo impone: decide el registro, y su rechazo se muestra tal como lo escribió.

**Planta** es el árbol de equipos y las etiquetas. Consulte [El árbol de equipos y las etiquetas](/es/iot/equipment/).

## Copia de seguridad y restauración

`entities` y `entity_bindings` están en la copia de seguridad, con el entity_id, las personalizaciones y todo. Eso incluye los compuestos, con todos sus roles y todas sus opciones, que importa más para ellos que para cualquier otra cosa: la entidad de un tag se podría reconstruir desde su tag, pero nada puede reconstruir un compuesto salvo la copia de seguridad. Las entidades de alarma vuelven con sus definiciones, y una definición restaurada sin entidad recibe una en la primera sincronización. Una copia de seguridad hecha antes de esta versión no tiene ninguna de las dos tablas; restáurela, arranque el Gateway, y la primera sincronización del registro da a cada tag restaurado su entidad. `entity_labels` también está en la copia de seguridad, y la restauración de una copia anterior al árbol de equipos se explica en [El árbol de equipos y las etiquetas](/es/iot/equipment/).

La migración 0007 añade tres columnas a `write_audit`. Una copia de seguridad hecha antes de ella sigue restaurándose: la restauración carga un archivo con menos columnas que la tabla de hoy en las columnas iniciales y deja que las nuevas tomen sus valores por defecto, porque una migración que añade una columna siempre la añade al final. Una copia de una versión más nueva sigue siendo rechazada. Consulte [Copias de seguridad y restauración](/es/iot/backup/).

## Lo que todavía no está aquí

El núcleo, el árbol de equipos, las órdenes a entidades a través de la puerta de escritura, los equipos compuestos, las entidades de alarma, las entidades en MCP, las automatizaciones y el flujo en vivo, y las pantallas ya están aquí. Consulte la [hoja de ruta de HotLoop](/es/roadmap/). El `forSec` de un disparador de estado ("activo durante cinco minutos") está en [Automatizaciones](/es/iot/automations/#mantener-un-estado-forsec).
