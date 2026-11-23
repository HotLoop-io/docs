---
title: "Recetas de producto"
description: "Las consignas de un grado de producto aplicadas de una vez: comprobadas enteras, rechazadas enteras, escritas en orden y releídas desde el dispositivo."
---

Una receta es un conjunto de valores que salen juntos hacia la planta. Las temperaturas de zona, la velocidad de línea y la abertura de matriz del grado A. El cambio a la botella de 500 ml. La bajada nocturna de consigna. Toda planta tiene esto, y toda planta tiene en algún sitio una hoja plastificada con los números y un operador tecleándolos uno a uno, y toda planta tiene la historia de la noche en que uno de ellos se tecleó mal.

Así que los números viven aquí, y salen de una vez: comprobados enteros primero, enviados en orden, releídos desde el dispositivo después, cada uno de ellos registrado. Toda receta es también una entidad, `scene.<id>`. Está pensada para equipos que pueden hacer daño a alguien, y por eso la mayor parte de esta página trata de lo que ocurre cuando algo sale mal.

## Cómo es una

```json
{
  "id": "grade_a",
  "name": "Grade A",
  "description": "The 2pm run. Die at 210, line at whatever the order says.",
  "equipment_id": 7,
  "apply_permission": "recipes.apply",
  "params": [
    {"name": "speed", "label": "Line speed", "type": "number", "min": 0, "max": 400, "step": 10, "unit": "rpm", "required": true}
  ],
  "precondition": "states['input_boolean.line_ready'] == 'on'",
  "targets": [
    {"entity_id": "loop.line_02_die_tic", "service": "set_mode", "data": {"mode": "auto"}},
    {"entity_id": "loop.line_02_die_tic", "service": "set_setpoint", "data": {"value": 210}},
    {"entity_id": "number.line_02_speed", "service": "set_value", "data_expressions": {"value": "vars.speed"}},
    {"entity_id": "switch.line_02_heater", "service": "turn_on"},
    {"entity_id": "input_select.product", "service": "select_option", "data": {"option": "Grade A"}}
  ],
  "verify_sec": 10
}
```

- **`id`** son letras minúsculas, dígitos y guiones bajos, empezando por una letra. Es el id de objeto de su entidad, `scene.grade_a`, y nunca cambia.
- **`equipment_id`** es el nodo del árbol de equipos al que pertenece la receta, para encontrarla. La pantalla Recetas agrupa por él. Omítalo para una receta de toda la planta.
- **`params`** son lo que recibe una aplicación: los mismos campos tipados que tiene un script (`model.Field`: `number` con `min`, `max`, `step` y `unit`, `text`, `boolean`, `select`, `entity`, `duration`, `alarm`, `tag`). Un destino lee uno como `vars.<name>` en una entrada de `data_expressions`.
- **`precondition`** es una expresión en el lenguaje de automatización que debe ser verdadera para que la receta empiece. Omítala y no hay ninguna.
- **`targets`** son los valores, **en el orden en que salen**. Cada uno es una entidad, el servicio que la establece y los datos de ese servicio, como valor (`data`) o calculados a partir de los parámetros (`data_expressions`). Hasta 200.
- **`verify_sec`** es el tiempo que se da a cada valor escrito para aparecer en una lectura del dispositivo. De 1 a 600, por defecto 10.

### Qué puede ser un destino

Una receta **establece valores**. Los servicios que admite son los que dejan al equipo con un valor:

| Dominio | Servicios |
|---|---|
| `switch`, `input_boolean` | `turn_on`, `turn_off` |
| `number`, `input_number`, `input_counter` | `set_value` |
| `text`, `input_text` | `set_value` |
| `select`, `input_select` | `select_option` |
| `valve` | `set_position` |
| `motor` | `set_speed` |
| `loop` | `set_setpoint`, `set_mode` |

Pulsar un botón, arrancar un motor, poner a cero un contador, parar una válvula: se rechaza al guardar. Eso son acciones, no valores, y pertenecen a un [script](/es/iot/scripts/). «Aplicar el grado A» pulsando un botón de reinicio cada vez que alguien lo aplica no es lo que nadie entiende por una receta, y el día que ocurra en plena producción es el día en que usted se entera. La conmutación (toggle) también se rechaza: una receta que invierte un interruptor hace lo contrario una de cada dos veces.

La entidad de un destino tiene que existir al guardar, sus expresiones tienen que compilar, y la misma entidad no puede establecerse dos veces con el mismo servicio (dos valores para un mismo ajuste, y cuál gana dependería de un orden que nadie lee). El modo y la consigna de un lazo son dos ajustes y ambos pueden establecerse; establezca primero el modo, porque una consigna para automático no significa nada para un lazo que se quedó en manual.

## Aplicar una

Desde la pantalla Recetas, el icono de la receta en la pantalla Entidades, un paso `apply_recipe` de una regla o de un script, el `apply_recipe` de MCP o `POST /api/services/scene/turn_on`. Todos ellos hacen exactamente esto:

### 1. Comprobada entera, rechazada entera

Antes de que un solo valor vaya a ninguna parte:

- Los parámetros se comprueban contra sus campos. **Un valor nunca se ajusta a la fuerza.** 450 en un campo cuyo máximo es 400 se rechaza, no se recorta a
  400. `"250"` para un número se rechaza, no se interpreta. 255 en un paso de 10 se rechaza, no se redondea. El número que llega a la planta es exactamente el que alguien introdujo, o no llega nada.
- El permiso propio de la receta, cuando nombra uno (más abajo), y los interruptores de escritura de MCP, en el caso de un agente.
- La precondición se evalúa contra la planta tal como está ahora.
- Se evalúa cada expresión de datos. Una que falla rechaza la receta; un destino nunca se envía sin el valor que debía tener.
- Nada más en este proceso puede estar escribiendo en una de sus entidades (más abajo).
- **Cada destino se somete a las propias comprobaciones de la puerta de escritura**, las mismas que encontrará su escritura: escrituras activadas, el tag escribible, el valor dentro del rango del tag, la entidad habilitada y conforme con el valor (su paso, sus opciones, un lazo en manual para su salida), el dispositivo conectado. `Services.Check`, que para un tag es `runtime.Manager.CheckWrite`. No se escribe ni se audita nada.

**Si algo falla, se rechaza la receta entera y no se escribe nada.** No los diez primeros destinos y luego un rechazo. Nada. Y recibe todos los motivos, no solo el primero: a un operador al que se le dice un problema, lo corrige y se le dice el siguiente, y una receta de cuarenta destinos debe corregirse de una vez. Cada destino indica cuál fue: `would_write`, `refused` con las palabras de la puerta, o `not_sent`.

### 2. Escrita en orden, un id de llamada, nunca revertida

Después los destinos salen en orden, cada uno por `Services.Call` y por tanto por `runtime.Manager.Write`, la única puerta de escritura. No hay puerta lateral. Cada escritura lleva el **id de llamada** de la aplicación, así que toda la aplicación es `GET /api/writes?call=<id>`, en el registro de auditoría, junto a cualquier otra escritura que la planta haya aceptado.

Una comprobación puede pasar y la escritura fallar un momento después. Un PLC responde a una escritura con una excepción. Alguien patea un cable. Alguien desarma un tag entre la comprobación y la escritura. **El primer destino que no pasa detiene la aplicación.** Los siguientes no se envían y figuran como `skipped`.

**Nada de lo ya escrito se deshace.** Es deliberado, y es la regla que sigue toda escritura de HotLoop. Deshacer es en sí una escritura: hecha sin que nadie la pida, sobre equipos que ya se han movido, basada en lo que creemos que era el valor antes, en el preciso momento en que algo acaba de demostrar que la planta no se comporta como esperábamos. Así es como una receta aplicada a medias se convierte en una línea totalmente confundida. Decidir qué hacer con una receta aplicada a medias es trabajo del operador, y recibe exactamente la información para hacerlo:

```text
PARTIAL v3: 2 of 5 written before one failed, nothing undone
  1. set_mode loop.line_02_die_tic: written, verified
  2. set_setpoint loop.line_02_die_tic: written, verified
  3. set_value number.line_02_speed: failed: the device answered the write with an exception
  4. turn_on switch.line_02_heater: skipped
  5. select_option input_select.product: skipped
```

Un destino es `written`, `failed` (salió y el dispositivo dijo que no, o no dijo nada, de modo que no se sabe si lo tomó), `not_sent` (la puerta lo rechazó en el último momento) o `skipped`. La aplicación es `applied` (todos los destinos escritos), `partial` (algunos lo fueron) o `failed` (el primero no lo fue).

La pantalla Recetas ofrece entonces **Aplicar los destinos restantes**. Es una aplicación nueva, de los destinos que no se escribieron, con la misma versión y los mismos parámetros, comprobada entera otra vez primero, auditada con un id de llamada propio, con `application:<id>` como padre para que las dos se encuentren juntas. Nunca es automática. Alguien mira lo que pasó, arregla lo que la detuvo y pulsa el botón.

### 3. Releída

Escrito no es lo mismo que tomado. Un PLC puede aceptar una escritura y su propia lógica sobrescribirla en el siguiente escaneo. Un registro escalado puede tomar 12,34 y guardar 12,3. Por eso, tras la última escritura, cada valor escrito se relee:

- para un destino en un dispositivo, solo de una lectura **tomada después de su escritura**, de modo que la caché que recuerda lo que el dispositivo dijo antes no pueda confirmar nada;
- del estado de la entidad o, para una válvula, un motor y un lazo, del atributo que establece el servicio (`current_position`, `speed`, `setpoint`, `mode`);
- un número dentro de una millonésima de sí mismo (un registro de coma flotante devuelve 0,1 como 0,10000000149, que es la misma consigna), cualquier otra cosa exactamente.

Cada destino escrito queda **`verified`** cuando se relee, o **`unconfirmed`** si no lo ha hecho dentro de `verify_sec`, con lo que se leyó en su lugar:

```text
  3. set_value number.line_02_speed: written, unconfirmed (not confirmed within 10s: read back 240, not 250)
```

Lo no confirmado se muestra en **ámbar**, nunca en verde, en la pantalla Recetas, y es una advertencia en el libro de registro y en el registro del sistema. No es un fallo: el valor salió y el dispositivo lo aceptó, y la aplicación sigue siendo `applied`. Es una señal que dice vaya a mirar, porque puede que no se haya tomado. Un auxiliar guarda su propio valor, así que el destino de un auxiliar se verifica directamente a partir de él.

La respuesta vuelve cuando la relectura ha terminado, así que aplicar una receta tarda hasta `verify_sec`.

## Solapamiento

Dos recetas que entrelazan sus escrituras a la misma consigna la dejan en la que aterrizó última, que no es la receta de nadie. Por eso, mientras una aplicación escribe y relee, retiene cada entidad a la que apunta, y otra aplicación que apunte a cualquiera de ellas se rechaza, `409`, indicando qué receta está en el camino. Espere a que acabe y aplique.

Esto se retiene en el proceso: una aplicación desde el Gateway y otra desde un proceso `--mcp-stdio` a su lado no se retienen entre sí. Ejecute un solo escritor, o mantenga las recetas del agente y las de los operadores en equipos distintos.

## Versiones

El nombre, la descripción, el nodo de equipo y el permiso de una receta son de la receta y cambian en el sitio. **Lo que escribe es una versión, y una versión nunca se cambia.** Guardar otros destinos, otros parámetros, otra precondición u otro `verify_sec` almacena la siguiente versión y la convierte en la actual. La versión 3 es exactamente lo que era el día que se guardó, para siempre, y cada aplicación registra la versión y los parámetros con los que se ejecutó. Lo que salió hacia la planta el martes pasado siempre tiene respuesta.

- Cambiar solo el nombre, o solo la nota, no crea versión.
- Un guardado hecho sobre una versión que alguien más ha sustituido desde entonces se rechaza, `409`, en lugar de tirar su cambio en silencio. El editor envía la versión que estaba editando.
- Se puede aplicar a propósito una versión anterior: elíjala en el panel de aplicación, o `"version": 2`. La aplicación indica que fue la versión 2.
- El panel Versiones muestra cada versión con quién la guardó, su nota y qué cambió respecto a la anterior, destino por destino.

Eliminar una receta elimina sus versiones. Sus aplicaciones se conservan: son lo que se envió a la planta, y ese historial sobrevive a la receta.

## Capturar una

Nadie escribe a mano una receta de cuarenta destinos cuando la línea ya está produciendo el grado A. **Capturar** toma las entidades que usted elija y redacta una receta que vuelve a establecer cada una en lo que contiene ahora mismo, en el orden en que las eligió: el valor de un número, el encendido o apagado de un interruptor, la opción de un selector, la posición de una válvula, la velocidad de un motor, el modo de un lazo y luego su consigna. Usted le pone nombre, la recorta, convierte en parámetros los números que cambian con cada pedido y la guarda.

Una entidad cuyo valor no se conoce, o no es de fiar, **se rechaza, no se captura**: una lectura de calidad distinta de buena, `unknown`, `unavailable`, una entidad deshabilitada. Una receta construida a partir de una mala lectura escribe esa mala lectura de vuelta en la planta, cada vez que alguien la aplica.

## Quién puede aplicar una

Los operadores aplican recetas (`recipes.apply`); los administradores las escriben (`recipes.write`); todos las leen (`recipes.read`). Cargar el grado A es para lo que está el operador. Decidir qué es el grado A es una decisión de ingeniería.

Una receta puede nombrar un permiso propio más restringido: `"apply_permission": "recipes.apply.night_setback"`. Entonces aplicarla exige también ese permiso, que el rol de operador no tiene. Désela a las personas que pueden aplicar esa receta mediante su propia lista de permisos:

```json
["recipes.read", "recipes.apply", "recipes.apply.night_setback"]
```

`recipes.apply.*` concede el de cada receta, y un administrador lo tiene todo. A un usuario sin él se le rechaza, y **el rechazo queda registrado**: una aplicación rechazada en el historial de la receta, con su nombre, como cualquier otra. Lo mismo ocurre a través de la entidad scene.

Un agente no tiene los permisos de ningún usuario, así que **un agente nunca aplica una receta que nombra un permiso propio**. Puede leerla y preguntar si se aplicaría; la respuesta dice por qué no.

## La precondición

```json
"precondition": "states['input_boolean.line_ready'] == 'on' and float(states['sensor.line_02_die_temp']) < 250"
```

El lenguaje de automatización, evaluado contra la planta tal como está cuando alguien pulsa Aplicar, con los parámetros como `vars`. Si es falsa, rechaza la receta y lo dice. Es una protección contra aplicar los números correctos en el momento equivocado, no un enclavamiento: un enclavamiento vive en el PLC, donde sigue funcionando cuando la red no.

## Desde una regla, un script o un agente

Una regla o un script aplica una con un paso `apply_recipe` (consulte [Automatizaciones](/es/iot/automations/)):

```json
{"type": "apply_recipe", "params": {"recipeId": "grade_a", "params": {"speed": 250}}}
```

La aplica como la regla, `automation:<id>`, o el script, `script:<id>`, con el origen de esa ejecución en cada escritura, y el padre de la aplicación es la ejecución. El paso falla a menos que se haya escrito cada destino; un valor sin confirmar no lo hace fallar, y la traza dice `NOT confirmed by read-back`. La prueba de un script también comprueba la receta.

Por MCP, `list_recipes` muestra cada receta con sus destinos y parámetros, `validate_recipe` pregunta si una se aplicaría ahora mismo y `apply_recipe` la aplica, con un motivo **obligatorio**. Las escrituras de un agente llevan el origen `mcp`, así que la puerta se aplica a cada una de ellas, y con las escrituras desactivadas (`HOTLOOP_ALLOW_WRITES`) `apply_recipe` se rechaza antes de comprobar nada. Consulte [MCP](/es/iot/mcp/#recipes).

## Su entidad

Toda receta es una entidad `scene`, `scene.<id>`. Su estado es cuándo se aplicó por última vez (una aplicación que escribió algo), como marca de tiempo, y `unknown` hasta que se haya aplicado alguna vez. Sus atributos dicen cómo fue la aplicación más reciente: `last_result`, `last_version`, `last_applied_by`, `last_application` y `unconfirmed` cuando esa cantidad de valores de una aplicada no se releyó. Su icono tiene un botón Aplicar. `scene.turn_on` la aplica, con `params` y `version` en los datos. Una regla puede dispararse con su estado, que cambia una vez por aplicación que escribió algo.

Eliminar una receta deja huérfana su entidad, igual que eliminar un script.

## El registro

Cada aplicación, las rechazadas incluidas, es una fila de `recipe_applications`: la receta, la versión, los parámetros, quién, desde dónde, por qué, el id de llamada, qué fue de cada destino y si se releyó. Se abre antes de la primera escritura y se cierra tras la relectura, así que una en la que el proceso muere a medias sigue diciendo que empezó. El siguiente arranque del Gateway la marca `failed`, `interrupted by restart`, apuntando a su id de llamada en la auditoría de escrituras. Nada la reanuda.

Cada aplicación es una línea en el registro del sistema bajo la escena, y una entrada en el [libro de registro](/es/iot/logbook/), de tipo `recipe`, junto a las escrituras que hizo. El historial de una receta conserva sus 5000 aplicaciones más recientes.

## Más de un proceso

Cada cambio de una receta y cada aplicación se anuncia a todos los procesos de la base de datos, así que una receta guardada en un pod es la que aplica el otro, y una aplicación que hace un proceso `--mcp-stdio` mueve la entidad scene del Gateway.

## Copias de seguridad

Las recetas, cada versión y cada aplicación están en las copias de seguridad y vuelven exactamente como estaban. Una aplicación que la copia pilló a medias vuelve como `applying` y se marca `failed` en el primer arranque, como una caída. Consulte [Copias de seguridad y restauración](/es/iot/backup/).

## La API

[La API HTTP](/es/iot/api/#recetas) tiene cada ruta. En resumen:

| <span class="sr-only">Detalles</span> | <span class="sr-only">Detalles</span> |
|---|---|
| `GET /api/recipes` | cada receta, su contenido actual y su última aplicación |
| `POST /api/recipes` | crear una, como versión 1 |
| `POST /api/recipes/capture` | un borrador a partir de lo que las entidades contienen ahora |
| `PUT /api/recipes/{id}` | guardar; un contenido nuevo es una versión nueva |
| `GET /api/recipes/{id}/versions` | cada versión, tal como se guardó |
| `POST /api/recipes/{id}/validate` | ¿se aplicaría ahora? no se escribe nada |
| `POST /api/recipes/{id}/apply` | aplicarla: `200` aplicada, `409` rechazada, `502` parcial o fallida |
| `GET /api/recipes/{id}/applications` | cada aplicación, rechazos incluidos |
