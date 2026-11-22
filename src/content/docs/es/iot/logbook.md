---
title: "El registro de actividad"
description: "Cambios de estado, escrituras, alarmas, ejecuciones de reglas y cambios de configuración en una sola línea de tiempo, para la planta, un área o una entidad."
---

Una sola línea de tiempo de lo que pasó en la planta, lo más reciente primero: la bomba arrancó, alguien escribió 180 en la consigna de la zona 1, se disparó y se reconoció la alarma de temperatura alta, se ejecutó la automatización de enfriamiento, se reconfiguró un dispositivo. Para toda la planta, un lugar del árbol de equipos y todo lo que hay debajo, o una sola entidad. Es la pestaña Registro, una sección del panel de cada entidad, `GET /api/logbook` (consulte [la API HTTP](/es/iot/api/#logbook)) y la herramienta MCP `get_logbook` (consulte [MCP](/es/iot/mcp/)).

La primera pregunta cuando algo sale mal es «¿qué pasó justo antes?», y hasta ahora la respuesta estaba en cinco sitios: la auditoría de escrituras, el historial de alarmas, las ejecuciones de automatizaciones, el registro del sistema y la memoria de nadie sobre lo que hizo el propio equipo. El registro de actividad es esos cinco en una sola lista.

## Qué contiene

| Tipo | Origen | Qué dice una línea |
|---|---|---|
| `state` | `entity_state_log` | cambió el estado de una entidad: `changed to on (was off)` |
| `write` | `write_audit` | una escritura en un tag, realizada, rechazada o fallida, por quién y por qué puerta |
| `alarm` | `alarm_events` | una alarma activada, reconocida, desactivada o aplazada, con la nota que se dio |
| `automation` | `automation_runs` | se ejecutó una regla, cómo terminó y qué la inició |
| `event` | `events` | cambios de configuración, resúmenes de llamadas de servicio y motivos dados para las escrituras, y lo que informa una consola UniFi en el momento en que ocurre, archivado bajo el conmutador o punto de acceso al que se refiere (un conmutador que pierde contacto es una advertencia) |
| `script` | `script_runs` | se ejecutó un [script](/es/iot/scripts/), cómo terminó, quién lo inició y qué lo llamó |
| `recipe` | `recipe_applications` | se aplicó o se rechazó una [receta](/es/iot/recipes/): qué versión, quién, cuántos destinos recibieron el valor y se leyeron de vuelta |

Solo `state` es nuevo. Los demás se leen donde ya están, en el momento de la consulta, y se combinan. Nada se escribe dos veces, así que nada puede contradecir el rastro del que procede, y cada rastro conserva su propia retención (abajo).

Del registro del sistema, el registro de actividad toma la categoría `config` y las líneas propias de la categoría `write`: el resumen de una llamada de servicio, una llamada de servicio de alarma, el motivo dado para una escritura. Las líneas «wrote ...» y «write of ... refused» de la propia puerta de escritura se dejan fuera, porque dicen exactamente lo que ya contiene la auditoría de escrituras y cada escritura aparecería dos veces.

### Lo que deliberadamente no contiene

**Lecturas numéricas.** Un sensor, un número, un lazo o un contador de PLC cambia en cada sondeo, y cada lectura ya está en el historian. Registrarlas de nuevo enterraría cada línea que alguien quiere leer bajo un millón al día que nadie quiere. Haga tendencias con ellas.

**Botones.** El estado de un botón es la hora de su última pulsación, y cada pulsación ya es una escritura en la auditoría. Además vuelve a desconocido en cada reinicio, lo que sería una línea por botón y reinicio sin decir nada.

**Los estados de las entidades de alarma.** El historial propio de la alarma está en el registro de actividad como líneas `alarm`, con más contenido (el valor, la nota, quién la reconoció).

Todo lo demás se registra: sensores binarios, interruptores, texto, selecciones, motores, válvulas, ayudantes y scripts según llegan.

**Los ayudantes los registra quien los cambió.** El cambio de un ayudante se escribe en el registro de actividad en la misma transacción que su valor, por el proceso que hizo el cambio, con quién lo hizo, desde dónde y bajo qué id de llamada, y sin límite de frecuencia. El registrador no toca los ayudantes: solo se ejecuta en el Gateway, así que el cambio de un agente a través de `--mcp-stdio` se le escaparía, y cada proceso que tiene el ayudante ve el cambio, así que se registraría una vez por proceso. El horario es la excepción, porque nadie lo fija y lo mueve el reloj: el registrador lo anota como a cualquier otra entidad.

## Rebote

Un contacto que rebota a 10 Hz es un solo hecho («rebotó, tantas veces»), no treinta y seis mil líneas por hora. Cada entidad tiene diez cambios seguidos y después uno cada dos segundos. Un cambio más allá de eso no se registra, y se cuenta en la siguiente línea de la entidad:

```
changed to closed (was open); 14 changes before this not logged, it was changing faster than the logbook records
```

La cuenta es exacta: las líneas más sus cuentas son todos los cambios que hizo la entidad. Cuando el rebote cesa, el estado final de la entidad siempre se registra, en menos de dos segundos, así que el registro de actividad nunca termina en un estado que el equipo ya ha dejado. El número de cambios suprimidos desde el arranque es `suppressed` en `/api/diagnostics`, bajo `logbook`.

## last_changed sobrevive a un reinicio

El estado de una entidad se calcula a partir de los tags en vivo y nunca se almacena, así que antes del registro de actividad cada reinicio hacía que todas las entidades parecieran recién cambiadas. El registro de actividad guarda el estado más reciente de cada entidad seguida y cuándo cambió por última vez (`entity_last_state`), y el motor de entidades lo lee al arrancar. Una entidad cuyo estado vuelve igual conserva su `last_changed`.

Un reinicio se ve así desde dentro: un dispositivo todavía no está conectado, así que sus entidades pasan a no disponibles, después a desconocidas y luego muestran su lectura. Esos pasos son este proceso poniéndose al día, no la planta cambiando, por lo que se espera a que pasen. Un estado que sí cambió mientras el Gateway estaba caído recibe un `last_changed` nuevo y una línea que dice cómo era antes. Por la misma razón, el registro de actividad retiene un cambio a no disponible o desconocido durante el primer minuto tras un arranque: un dispositivo que sigue caído pasado ese tiempo se registra entonces, con la hora en que se vio caído por primera vez.

## Filtros

- **Dónde:** un nodo del árbol de equipos y todo lo que hay debajo. Un lugar se convierte en todos los nombres con que lo conocen los rastros: las entidades que hay allí (por su propio lugar o, si no tienen, el de su dispositivo, la misma regla que usa la pantalla Entidades), los dispositivos que hay allí y todos sus tags, las alarmas de esos tags, las automatizaciones con un disparador en cualquiera de ellos y el propio nodo para sus cambios de configuración. Una ejecución de automatización también está en un lugar si escribió allí mientras se ejecutaba, sea cual sea lo que la disparó. Los eventos de una consola UniFi se encuentran por la red, no por nada que una persona haya colocado en el árbol: el conmutador del que cuelga un dispositivo enlazado y todos los conmutadores entre él y la puerta de enlace, de modo que la caída de un conmutador aparece bajo cada línea que alimenta. Una consola colocada en el árbol encuentra los eventos sobre todo lo que adoptó. Consulte [UniFi Network](/es/iot/unifi/#eventos).
- **Entidad:** lo mismo, para una entidad: sus cambios de estado, las escrituras en ella y en sus tags, sus alarmas, las reglas que dispara o que escribieron en ella, y los cambios de configuración en ella o en sus tags. Una entidad que se ha borrado después se sigue encontrando por el nombre que tenía.
- **Quién:** parte del actor, sin distinguir mayúsculas: `alice`, `automation:cooldown` (las ejecuciones de la regla y cada escritura que hizo), `mcp:` (todo lo que hizo cualquier agente). Un cambio de estado que hizo el equipo por sí solo no tiene actor.
- **Tipos:** cualquiera de los cinco.
- **Cuándo:** `from` y `to`.

La paginación es por cursor, la hora, el tipo y el id de la última línea, de modo que una página nunca se desplaza por las líneas añadidas desde la anterior.

La pantalla se actualiza en vivo. La fuente en vivo mira los rastros una vez por segundo mientras alguien está mirando, y envía un evento `logbook` con los tipos que tienen algo nuevo; la pantalla entonces vuelve a pedir su página. Vigila las tablas, no este proceso, así que una escritura que hace un agente a través de `--mcp-stdio`, que es otro proceso, aparece igualmente.

## Cuánto tiempo se conserva

`entity_state_log` está particionada por mes, en los dos modos de historial (es una tabla particionada normal de PostgreSQL sea o no `tag_history` una hypertable), y un mes se elimina entero cuando todas sus líneas son más antiguas que `HOTLOOP_LOGBOOK_RETENTION_DAYS`. Por defecto **90**. Eliminar un mes es instantáneo; borrar sus filas una a una no lo es, y por eso está particionada. Así que una línea se conserva entre 90 días y 90 días más un mes. `0` lo conserva todo, y el Gateway lo dice al arrancar, porque entonces la tabla crece hasta que se llena el volumen.

El propio mantenimiento del registro de actividad hace esto, una vez al arrancar y a diario después. Crea la partición del mes pasado y las de los tres meses siguientes por adelantado, para que una línea siempre tenga dónde caer; una línea de un mes sin partición cae en la partición por defecto, y el mantenimiento las traslada a su mes cuando lo crea (que es lo que ocurre tras una restauración, consulte [Copias de seguridad y restauración](/es/iot/backup/)) o las borra cuando pasan la retención.

Los otros rastros conservan lo que siempre conservaron:

| Rastro | Se conserva |
|---|---|
| `write_audit` | todo, hasta que alguien lo recorte |
| `alarm_events` | todo, hasta que alguien lo recorte |
| `automation_runs` | las 500 ejecuciones más recientes de cada automatización |
| `events` | las 100.000 líneas más recientes |

Así que en una planta con mucha actividad, las escrituras y las alarmas del registro pueden remontarse más atrás que sus cambios de estado, y sus ejecuciones de automatizaciones y cambios de configuración menos. El registro de actividad muestra lo que tienen los rastros.

## Un solo proceso registra

El Gateway registra. Un segundo proceso iniciado con `--mcp-stdio` (el ayudante de un agente junto al Gateway) lee el registro de actividad y su línea base, de modo que lo que dice sobre `last_changed` coincide con lo del Gateway, pero no escribe nada y no mantiene nada: dos registradores anotarían cada cambio dos veces.

El registrador es un gancho en el motor de entidades que solo encola. Una vez por segundo, una goroutine convierte lo encolado en líneas, aplica el límite de frecuencia y las escribe con un `COPY` y un upsert de los estados más recientes, en una transacción. La cola admite 50.000 cambios; pasado eso se descartan los más antiguos y se cuentan. Una base de datos caída mantiene las líneas en cola, hasta el mismo límite, y entran cuando vuelve. `/api/diagnostics` lo muestra todo bajo `logbook`:

```json
{"recording":true,"retentionDays":90,"queued":0,"dropped":0,"written":212,"suppressed":36,"writeErrors":0}
```

`dropped` por encima de cero significa que faltan cambios en el registro de actividad; `queued` que sigue creciendo significa que la base de datos no da abasto; `lastError` dice por qué falló la última escritura.

## Copias de seguridad

Las dos tablas están en toda copia de seguridad: `entity_last_state` después de las tablas de entidades, `entity_state_log` justo antes de `tag_history`. Consulte [Copias de seguridad y restauración](/es/iot/backup/).
