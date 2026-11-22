---
title: "Scripts de procedimientos"
description: "Escriba un ciclo una vez, póngale nombre y ejecútelo desde una regla, una pantalla o MCP. La prueba pasa por la puerta de escritura real antes de mover nada."
---

Un script es una secuencia de pasos con un nombre. El ciclo CIP. La purga de la línea. El cambio al producto B. Toda planta tiene un puñado de procedimientos que ejecuta exactamente igual cada vez, y el día que alguien copia uno en una cuarta automatización y corrige un paso en solo tres de ellas es el día en que le muerde. Así que se escribe una vez, se le da un nombre, y todo lo que lo necesita lo llama por ese nombre: un operador desde la pantalla Scripts, una regla con un paso `call_script`, un agente con `run_script`, cualquier cosa mediante `POST /api/services/script/turn_on`.

Un script habla el lenguaje de automatización, se ejecuta en el mismo ejecutor de secuencias que las acciones de una regla, y cada escritura que hace pasa por la única puerta de escritura. Sin puerta lateral. Nunca tuvo ninguna.

## Cómo es uno

```json
{
  "id": "cip_cycle",
  "name": "CIP cycle",
  "description": "Caustic wash, rinse, done. Tank must be empty.",
  "fields": [
    {"name": "minutes", "label": "Wash time", "type": "number", "min": 5, "max": 60, "step": 5, "unit": "min", "required": true},
    {"name": "circuit", "type": "select", "options": ["tank_1", "tank_2"], "default": "tank_1"}
  ],
  "sequence": [
    {"type": "condition", "params": {"expression": "float(states['sensor.cip_tank_level']) < 5"}},
    {"type": "call_service", "params": {"entityId": "switch.cip_pump", "service": "switch.turn_on"}},
    {"type": "delay", "params": {"seconds": 5}},
    {"type": "wait", "params": {"expression": "float(states['sensor.cip_return_temp']) > 70", "timeoutSec": 900}},
    {"type": "log_event", "params": {"message": "CIP on {{ vars.circuit }} for {{ vars.minutes }} minutes"}},
    {"type": "call_service", "params": {"entityId": "switch.cip_pump", "service": "switch.turn_off"}}
  ],
  "mode": "skip",
  "maxRuntimeSec": 1800
}
```

- **`id`** son letras minúsculas, dígitos y guiones bajos, empezando por una letra. Es también el id de objeto de su entidad, así que este es `script.cip_cycle`, y nunca cambia.
- **`fields`** son lo que recibe una ejecución. Las mismas entradas tipadas de todo HotLoop (`model.Field`): `number` con `min`, `max`, `step` y `unit`, `text` con `max_length` y `pattern`, `boolean`, `select` con `options`, `entity` con los `domain` que admite, `duration` (segundos, o `90s`, `1h30m`), `alarm` y `tag`. Cada uno puede ser `required` o tener un `default`, y un valor por defecto que su propio campo rechazaría se rechaza al guardar. Un paso lee un campo como `vars.<name>`.
- **`sequence`** es el lenguaje de automatización, entero: `call_service`, `write_tag`, `condition`, `wait`, `stop`, `call_script`, `set_variable`, `delay`, `log_event` y el resto. [Automatizaciones](/es/iot/automations/) tiene cada paso.
- **`mode`** y **`maxRuntimeSec`** se explican más abajo.

Un script se compila al guardarlo, como una regla: un paso que no se decodifica, una expresión que no compila, una espera más larga de lo que puede durar una ejecución, un campo que no tiene sentido, todo se rechaza al guardar. Usted lo descubre en el editor, no a las 3 de la madrugada con la bomba a mitad de un lavado.

## Los campos se comprueban, nunca se corrigen

Antes de que se ejecute el primer paso, lo que se entregó a la ejecución se comprueba contra los campos: cada valor debe ser uno que su campo admita, cada valor obligatorio debe estar presente, y un campo que el script no tiene es un error en lugar de algo que se ignora en silencio. **Un valor nunca se ajusta a la fuerza.** 70 minutos en un campo cuyo máximo es 60 se rechaza, no se recorta a 60; `"12"` para un número se rechaza, no se interpreta; 12,5 en un paso de 5 se rechaza, no se redondea. El valor que pasa a dar órdenes a los equipos es exactamente el que alguien introdujo, o no se ejecuta nada en absoluto. Una ejecución rechazada no deja ejecución alguna: no empezó nada.

## Ejecutar uno

| Desde | Cómo | Requiere |
|---|---|---|
| La pantalla Scripts | **Ejecutar** en su tarjeta, rellene el formulario | `scripts.run` |
| Su entidad | **Ejecutar** en su icono, o `POST /api/services/script/turn_on` con los campos como datos | `scripts.run` |
| La API | `POST /api/scripts/{id}/run` con `{"fields": {...}, "reason": "..."}` | `scripts.run` |
| Una regla | un paso `call_script` | el permiso de la propia regla |
| Un agente | `run_script` por MCP | escrituras de MCP activadas |

Los operadores ejecutan scripts. Los administradores los escriben. Ejecutar el ciclo CIP es para lo que sirve el botón; decidir qué válvulas abre el ciclo CIP es una decisión de ingeniería y sigue siéndolo.

Una ejecución responde en cuanto ha empezado, con su id. Pídale que espere (`wait`) y responde cuando termina, con su resultado y la traza de cada paso. **Detener** (`POST /api/scripts/{id}/stop`, o `script.turn_off`) cancela cada ejecución de él en el punto en que esté, en cada proceso, incluida una espera o un retardo. Lo que un paso ya había escrito se queda escrito. Deshacerlo también es una escritura, hecha sin que nadie la pida, sobre equipos que ya se han movido, y eso es decisión del operador, no nuestra.

## Cada escritura pasa por la puerta

Un script se ejecuta como **`script:<id>`**. Cada escritura que hace, cada llamada a servicio, cada línea de registro lleva eso como su actor, y cada escritura se audita contra él en `GET /api/writes`, rechazada o no. El **origen** es quien lo inició: `ui` desde la pantalla, `automation` desde una regla, `mcp` desde un agente. Eso importa porque la puerta decide según el origen. Un script que inicia un agente escribe como `mcp`, y con `HOTLOOP_ALLOW_WRITES` desactivado cada una de sus escrituras se rechaza, exactamente como se rechazaría el `write_tag` del propio agente. `run_script` y el `script.turn_on` de un agente rechazan de entrada en ese caso, en lugar de ejecutar un script cuyas escrituras van a rebotar todas.

La ejecución registra quién la pidió (`actor`), cómo (`source`) y qué la llamó (`parent`: `automation_run:812`, `script_run:77`), de modo que puede ir de una escritura a la regla, al script y a la persona o al agente que hay detrás.

## Pregunte primero: la prueba

`POST /api/scripts/{id}/run?dry_run=true`, **Comprobar primero** en el panel de ejecución, o `run_script` con `dryRun`. Los campos se comprueban igual, y después cada paso se recorre contra la planta tal como está ahora mismo:

- cada `write_tag` y `call_service` se somete a las propias comprobaciones de la puerta de escritura (`CheckWrite`, `Services.Check`), el mismo código que ejecuta la escritura real, de modo que una prueba no puede decir que sí a algo que la escritura real rechazaría por un motivo que la prueba no comprobó. No se escribe nada, no se audita nada;
- una `condition` se evalúa ahora, y una falsa termina el recorrido donde terminaría la ejecución;
- un `set_variable` se enlaza, de modo que los pasos posteriores ven lo que verían;
- un `call_script` recorre el script al que llama, con sus pasos numerados bajo la llamada (`3.1`, `3.2`);
- un `wait`, un `delay` y cualquier cosa que no escriba en ningún equipo (un mensaje, una llamada HTTP, una alarma activada) es `not_checked`. Una prueba no espera quince minutos para decirle qué leerá entonces el depósito.

La primera escritura que sería rechazada termina el recorrido, porque terminaría la ejecución, y la respuesta lo dice con las palabras de la puerta: `step 2 (call_service): cip/pump: this tag is not marked writable`. Una prueba que sale limpia es un consejo, no una promesa. Un dispositivo puede caerse, alguien puede desarmar un tag, y una espera da a la planta todo el tiempo que necesite para cambiar de opinión entre su comprobación y el paso.

## Modos de ejecución

Lo que hace una ejecución solicitada mientras otra del mismo script está en marcha. Las mismas palabras que usa una regla, con una diferencia.

| Modo | Una segunda ejecución |
|---|---|
| `skip` | se rechaza, `409`, y queda una ejecución `skipped` en el historial que dice por qué. **El valor por defecto**, y la respuesta correcta para todo lo que da órdenes a equipos |
| `queue` | espera su turno y empieza cuando termina la que va delante. Una sola de profundidad: una tercera se rechaza |
| `restart` | cancela la que está en curso donde esté y luego empieza cuando se ha detenido. Dos ejecuciones nunca se solapan |
| `parallel` | se ejecuta a la vez |

La diferencia: la cola de una regla descarta en silencio la ejecución pendiente más antigua, y la cola de un script rechaza en voz alta la más nueva. Una regla la dispara un disparador al que no le importa. A un script lo pide alguien, o algo, que puede estar esperando la respuesta, y «su ejecución nunca ocurrió, sin más» no es una respuesta.

Un paso `call_script` que espera a un script ocupado falla (`script busy`); uno que no espera lo anota en la traza y sigue, porque todo lo que iba a hacer era iniciarlo.

`maxRuntimeSec` acota una ejecución, cinco minutos cuando vale cero. Una ejecución que lo agota queda `timed_out`, estuviera entre pasos o en mitad de una espera.

## Scripts que llaman a scripts

Un paso `call_script` ejecuta un script desde una regla o desde otro script. Con `wait`, el paso toma el resultado del script como propio, y el script forma parte de la ejecución que lo llamó: cancele al que llama, o deje que se le agote el tiempo, y el script por el que espera se detiene también. Sin `wait`, el script se inicia y se deja terminar por su cuenta.

Dos límites, ambos porque la alternativa es un script que da vueltas en bucle:

- **Un script que se llamaría a sí mismo se rechaza al guardarlo**, directamente o a través de cualquier cadena de otros scripts: `script b would call itself: b calls a calls b`. Lo mismo vale para una edición que cierra un bucle.
- **Cinco niveles de profundidad, en tiempo de ejecución.** Un sexto script en una cadena hace fallar el paso que lo habría llamado, y la cadena con él. Y si alguna vez un bucle pasa el guardado (dos procesos que guardan dos mitades a la vez), la ejecución lo detecta: un script que ya se está ejecutando en su propia cadena se rechaza, no se ejecuta por segunda vez.

## Su entidad

Todo script es una entidad, `script.<id>`, plataforma `script`. Su estado es `on` mientras hay una ejecución suya en marcha, en cualquier proceso, y `off` cuando no hay ninguna; sus atributos llevan su `mode`, cuántas ejecuciones hay en marcha (`current`), sus `fields`, y cuándo se inició por última vez y cómo terminó. Está en la pantalla Entidades con un botón **Ejecutar**, en `list_entities` por MCP, en `/api/states`, y una regla puede tener un disparador de estado sobre él: «cuando el ciclo CIP pase a off, registra el lote». Eliminar un script deja huérfana su entidad, igual que eliminar una definición de alarma: un administrador elimina la huérfana cuando nada se refiere ya a ella.

## El historial de ejecuciones

Cada ejecución es una fila de `script_runs`: quién, cómo, los campos que recibió una vez comprobados, la traza de cada paso (entradas resueltas, no plantillas), cómo terminó y por qué. `GET /api/scripts/{id}/runs`, el panel de ejecución y el [libro de registro](/es/iot/logbook/), donde las ejecuciones de scripts son del tipo `script`, que se encuentran por la entidad del script o por cualquier cosa en la que una ejecución escribió. El historial conserva las 500 ejecuciones más recientes de cada script, el mismo límite que tienen las ejecuciones de automatizaciones.

La fila de una ejecución se abre antes de su primer paso y se cierra después del último. Si el proceso se detiene, cancela cada ejecución en curso donde esté y la registra como `cancelled: interrupted by restart`. Una ejecución que un fallo cortó, sin nadie que cierre su fila, se marca igual en el siguiente arranque del Gateway. **Nada reanuda una ejecución.** Continuar desde el paso cuatro de un ciclo CIP una hora después, sin que nadie lo pida, sobre una planta que ha seguido adelante, es peor que decir que se detuvo.

## Más de un proceso

El Gateway y un proceso `--mcp-stdio` a su lado (o dos pods a mitad de un despliegue) ejecutan scripts los dos. El estado de una ejecución vive en la base de datos, y cada proceso escucha los cambios en `hotloop_script`, así que:

- un script iniciado en un proceso muestra `on` en la entidad de cada proceso;
- un script guardado en un pod es el script en el otro, y sus ejecuciones allí se cancelan si sus pasos cambiaron;
- **Detener** detiene cada ejecución de él, en cada proceso.

El modo de ejecución se mantiene por proceso. Dos procesos pueden iniciar cada uno una ejecución de un script `skip` en el mismo instante. Una planta que ejecuta el mismo procedimiento desde el proceso auxiliar de un agente y desde la pantalla del operador en el mismo segundo tiene una conversación pendiente que ningún bloqueo nuestro resolvería.

## Copias de seguridad

`scripts` y `script_runs` están en cada copia de seguridad y vuelven en una restauración, con el historial. Una ejecución que la copia pilló a medias vuelve como `running` y se marca como `interrupted by restart` en el primer arranque, como cualquier otra. Consulte [Copias de seguridad y restauración](/es/iot/backup/).

## La API

Cada ruta, su permiso y sus respuestas están en [la API HTTP](/es/iot/api/#scripts).

| Permiso | visor | operador | administrador |
|---|---|---|---|
| `scripts.read`: listarlos y sus ejecuciones | sí | sí | sí |
| `scripts.run`: ejecutar, probar, detener, `script.turn_on`/`turn_off` | no | sí | sí |
| `scripts.write`: crear, editar, eliminar | no | no | sí |
