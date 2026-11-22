---
title: "Ayudantes"
description: "Valores que son de la gente de planta, como el objetivo del lote o el turno: interruptores, números, listas, textos, contadores, temporizadores y horarios."
---

Un ayudante es un valor que pertenece a las personas de la planta y no a un PLC. «La línea 2 está en cambio de formato.» «El objetivo del lote de hoy es 1.250 kg.» «Está el turno B.» «Doce piezas desechadas desde el último reinicio.» «A la purga le quedan nueve minutos.» Nada de eso vive en un registro, y todo es justo lo que las reglas y las pantallas necesitan saber.

HotLoop tiene siete tipos. Un ayudante es una entidad como cualquier otra: tiene un `entity_id`, un estado, atributos y servicios, se sitúa en el árbol de equipos, aparece en `/api/states`, en la pantalla Entidades, en `list_entities` por MCP y en el disparador de estado de una automatización. Lo que cambia es dónde vive su valor: HotLoop lo guarda, en la base de datos, y **ningún servicio de un ayudante escribe jamás un tag**.

## Los siete

| Dominio | Estado | Opciones | Servicios |
|---|---|---|---|
| `input_boolean` | `on` / `off` | `initial` (true/false), `restore` | `turn_on`, `turn_off`, `toggle` |
| `input_number` | el número, `"1250"` | `min`, `max` (ambos obligatorios), `step` (por defecto 1), `mode` (`slider` o `box`), `initial`, `restore` y una `unit_of_measurement` | `set_value {value}`, `increment`, `decrement` |
| `input_select` | la opción elegida | `choices` (obligatorio, hasta 100), `initial`, `restore` | `select_option {option}`, `select_next {cycle}`, `select_previous {cycle}` |
| `input_text` | el texto | `max_length` (por defecto y tope 255), `pattern`, `initial`, `restore` | `set_value {value}` |
| `input_counter` | un número entero | `initial` (por defecto 0), `step` (por defecto 1), `min`, `max`, `restore` | `increment`, `decrement`, `reset`, `set_value {value}` |
| `timer` | `idle` / `active` / `paused` | `duration_sec` (obligatorio, de 1 segundo a 7 días), `restore` | `start {duration}`, `pause`, `cancel`, `finish` |
| `schedule` | `on` / `off` | `schedule` (obligatorio) | ninguno: sigue el reloj |

El contador es `input_counter`, no `counter`. `counter` ya es el compuesto de PLC cuyo reinicio escribe un tag, y sigue siendo exactamente lo que es.

Cada opción se comprueba al guardar el ayudante, y `initial` contra todas las demás: un `input_number` de 0 a 100 que empieza en 150 se rechaza, no se arranca en 100. Una opción que un dominio no admite es un error, no un ajuste que se ignora en silencio. Las opciones de ayudante (`initial`, `restore`, `choices`, `duration_sec`, `mode`, `schedule`) se rechazan en todos los demás dominios por la misma razón.

## Crear uno

Un administrador crea ayudantes (`entities.write`). En la pantalla Entidades, **Nuevo ayudante**, junto a Nuevo equipo. Por la API:

```
POST /api/helpers
{"name": "Batch target", "domain": "input_number", "unit_of_measurement": "kg",
 "options": {"min": 0, "max": 5000, "step": 50, "initial": 1000}}
```

El `entity_id` se forma a partir del nombre (`input_number.batch_target`) a menos que usted indique uno. `PUT /api/helpers/{entity_id}` cambia su nombre, icono, unidad u opciones; `DELETE /api/helpers/{entity_id}` lo borra junto con su valor. Toda la API está en [la API HTTP](/es/iot/api/#helpers).

Se rechaza un cambio de opciones que dejaría el valor actual del ayudante fuera de ellas: estrechar un rango por debajo del valor, o quitar la opción que está seleccionada. Fije primero el valor, o elija opciones que lo incluyan. Un valor nunca se mueve para ajustarlo.

## Fijar uno

Cualquiera con `helpers.write` fija ayudantes. Los operadores lo tienen: manejar el selector de turno y contar el desecho es operación, no configuración. Los visores no. No es `values.write`, porque un ayudante no escribe ningún tag.

Fijar un ayudante es una llamada a un servicio de entidad, la misma llamada que admite cualquier otra entidad:

```
POST /api/services/input_counter/increment   {"entity_id": "input_counter.scrap", "reason": "short shot"}
POST /api/services/timer/start               {"entity_id": "timer.purge", "duration": "0:15:00"}
```

La respuesta dice qué es ahora el ayudante: `{"call_id": "...", "state": "13", "writes": []}`. `?dry_run=true` también funciona y responde con las mismas palabras que la llamada real, sin cambiar nada.

En la pantalla Entidades un ayudante tiene su propia ficha, nunca agrupada con otra (no tiene tags por los que agrupar), con sus controles para quien tenga `helpers.write`. Todo cambio se confirma primero, con un motivo, como cualquier otro comando.

Por MCP no hay ninguna herramienta nueva: `list_entities` encuentra ayudantes, `get_states` los lee y `call_service` los fija. Un agente solo cambia un ayudante en una instalación con `HOTLOOP_ALLOW_WRITES` activado, el mismo interruptor que necesita una escritura en un tag. Un ayudante no mueve ningún equipo, pero es aquello sobre lo que actúan las reglas, y un agente que pulsa el interruptor de cambio de formato es un agente que pone en marcha lo que haga la regla de cambio de formato.

## Rechazado, nunca recortado

Un valor que un ayudante no admite se rechaza y no cambia nada:

- un número fuera de `min`..`max`, o que no cae en su `step` (contado desde `min`);
- un `increment` que pasaría de `max`, un `decrement` que bajaría de `min` (se rechaza, no se detiene en el límite: «detenido en el límite» es un valor que nadie pidió);
- una opción que no figura entre las opciones disponibles; `select_next` más allá de la última opción con `cycle: false`;
- un texto más largo que `max_length`, o que no cumple `pattern` (debe cumplirlo el texto entero);
- una cuenta que no es un número entero, o que pasa del `min` o del `max` del contador;
- un temporizador pausado cuando no está en marcha, cancelado o finalizado cuando está inactivo, o iniciado por menos de un segundo o por más de siete días;
- un ayudante desactivado; quien llama sin `helpers.write`; un agente con las escrituras de MCP desactivadas.

Cada rechazo es una advertencia en el registro del sistema (`GET /api/events`) sobre el ayudante, con quién lo pidió y por qué se rechazó, exactamente como el rechazo de un reconocimiento de alarma. Un error en la propia petición (un campo que el servicio no admite, `"50"` donde va un número) es un error de quien llama, se responde con 400 y no cambia ni registra nada.

## Dónde se registran los cambios

Cada cambio es una línea en el registro del sistema sobre el ayudante: quién, de qué, a qué, el id de la llamada, de dónde vino y el motivo si se dio uno.

```
otto   input_counter.increment: 12 -> 13; reason: short shot
system timer finished: active -> idle, due at 2026-09-27T21:10:00Z
```

La línea se escribe en la misma transacción que el valor, así que nunca hay un cambio sin su línea ni una línea sin su cambio.

Un cambio de estado también es una línea en el [registro](/es/iot/logbook/), en esa misma transacción, con el mismo quién, origen e id de llamada. La escribe el proceso que hizo el cambio, sea cual sea, así que el cambio de un agente a través de `--mcp-stdio` también se registra, y una sola vez. Las líneas de los ayudantes nunca tienen límite de frecuencia: cada una es alguien que decide algo. Una llamada que deja el estado como estaba (un número fijado al valor que ya tiene) está en el registro del sistema pero no en el registro, porque nada cambió.

## Reinicios

Un ayudante conserva su valor tras un reinicio: el Gateway vuelve con el turno todavía en B y el contador todavía en 13. Ponga `restore: false` en uno que deba empezar de cero cada vez (un contador «desde el último reinicio»): el Gateway lo devuelve a su valor inicial al arrancar y lo anota en el registro. Eso solo lo hace el propio Gateway. Un proceso `--mcp-stdio` que un agente inicia junto a un Gateway en marcha tiene los mismos ayudantes y oye todos los cambios, pero nunca restablece nada, porque restablecer los valores de la planta porque se conectó un agente sería absurdo.

## Temporizadores

Un temporizador corre con el reloj de pared. Iniciado por diez minutos, termina diez minutos después pase lo que pase entre medias: un reinicio que duró dos minutos le deja ocho por correr. Un temporizador en pausa sigue en pausa, con el tiempo que le quedaba, tras cualquier número de reinicios, y `start` lo reanuda.

Un temporizador que se agotó **mientras HotLoop no estaba en marcha** vuelve a `idle` cuando HotLoop arranca de nuevo, con `finished_late_at` fijado a cuándo le tocaba, y una advertencia en el registro. **No se dispara nada por él.** Una regla que espere a que ese temporizador quede inactivo no se ejecuta, porque la primera mirada del motor tras un arranque es una línea base, no un cambio. Aquello que estuviera cronometrando (una purga, un curado) ocurrió hace mucho o no ocurrió, y hacerlo ahora, tarde y sin que nadie lo pida, es peor que decir que se perdió. Busque `finished_late_at` y decida.

Un temporizador no es un enclavamiento. Corre con el reloj de un proceso, a través de una base de datos y una red, al segundo y normalmente al milisegundo. Todo lo que deba parar a tiempo pertenece al PLC.

## Horarios

Un horario está activo dentro de sus bloques e inactivo fuera de ellos:

```json
{"schedule": {
  "mon": [{"from": "06:00", "to": "14:00", "data": {"crew": "A"}},
          {"from": "14:00", "to": "22:00", "data": {"crew": "B"}}],
  "fri": [{"from": "22:00", "to": "06:00", "data": {"crew": "C"}}]
}}
```

- Los días son de `mon` a `sun`. Una hora es `HH:MM` o `HH:MM:SS`; `24:00` es el final de un día.
- Un bloque cuyo `to` es anterior a su `from` pasa de medianoche: de las 22:00 a las 06:00 del viernes está activo hasta el sábado a las 06:00.
- Los bloques que se tocan son un único tramo activo; los bloques que se solapan se rechazan, porque decidir qué datos de qué bloque valen sería adivinar.
- Mientras un bloque está activo, su `data` está en los atributos de la entidad (`crew: "B"`), y `next_event` siempre dice cuándo cambiará el horario.
- Se lee con el reloj de pared de la zona horaria del sitio (`HOTLOOP_SITE_TIMEZONE`), porque un turno que empieza a las 06:00 empieza a las 06:00 también el día del cambio de hora. La noche en que se adelantan los relojes, la hora que no ocurre no está activa; la noche en que se atrasan, la hora que ocurre dos veces está activa las dos veces.

## Más de un proceso

Cada cambio se anuncia con `NOTIFY` de Postgres, y todos los procesos que tienen los ayudantes escuchan. Un ayudante fijado en un proceso muestra su nuevo valor en todos los demás en un viaje de ida y vuelta, un ayudante creado o borrado en uno aparece o desaparece en los otros, y un cambio hecho mediante `PUT /api/helpers/{entity_id}` se recoge del mismo modo (uno hecho mediante `PUT /api/entities/{entity_id}` llega a los demás en su siguiente sincronización del registro, como el de cualquier entidad). Toda escritura es condicional a la revisión de la fila, así que dos procesos que cuentan el mismo contador a la vez nunca pierden una cuenta, y un temporizador que ambos tienen lo finaliza exactamente uno de ellos.

## Copias de seguridad

Los ayudantes están en toda copia de seguridad: su configuración con las entidades, y sus valores en `helper_state`, revisiones incluidas. Una planta restaurada vuelve con el turno, los objetivos y las cuentas que tenía, y un temporizador que estaba en marcha sigue en marcha según el reloj de pared (o, si se agotó entretanto, inactivo y marcado como tardío, como se explicó arriba).

## En las automatizaciones

Un ayudante es aquello sobre lo que actúan las reglas y que las reglas fijan:

```json
{"triggers": [{"type": "state", "entityId": "input_boolean.changeover", "to": "on"}],
 "actions": [{"type": "call_service", "params": {"entityId": "number.line_2_speed_sp",
   "service": "number.set_value", "data": {"value": 0}}}]}
```

La escritura de la regla en el tag pasa por la puerta de escritura como cualquier otra, con la regla como actor. `states['input_select.shift'] == 'B'` funciona en una condición, y una regla puede fijar un ayudante con `call_service` del mismo modo que acciona un interruptor.
