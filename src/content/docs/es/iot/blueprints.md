---
title: "Blueprints de reglas"
description: "Escriba una regla una vez, con huecos, y rellénela para cada bomba. Cada regla conserva su versión del blueprint, así que una edición no cambia cuarenta reglas."
---

Un blueprint es una regla escrita una sola vez con huecos. «Cuando *este motor* lleve funcionando más que *este tiempo*, avisa, y páralo si *yo te lo pido*». Alguien que sabe lo que la regla debe hacer la escribe una vez. Los demás rellenan los huecos, por bomba, por depósito, por línea, y obtienen una automatización normal al otro lado.

La alternativa es lo que ya tiene toda planta: la misma regla copiada en cuarenta bombas y corregida en treinta y siete el día que alguien encuentra el error. Las copias se desvían. Un blueprint y cuarenta juegos de entradas, no.

Lo que sale es una regla normal. Aparece en la pantalla de Automatizaciones junto a las escritas a mano, la arma el mismo motor y cada escritura que hace pasa por la puerta de escritura como `automation:<id>`, auditada, con las denegaciones incluidas. No hay un entorno de ejecución de blueprints ni una puerta lateral. Hay un formulario y hay una regla.

## La única regla sobre los blueprints

**Una regla conserva la versión del blueprint de la que se hizo.**

Edite un blueprint y su versión sube. Ninguna regla hecha con él cambia. La regla de la bomba 7 que era correcta el martes no se convierte en silencio en otra distinta porque alguien editó su blueprint el miércoles pensando en la bomba 12, cuando la bomba 7 es la que inunda el sótano.

Pasar una regla a la versión nueva es una **actualización**, y una actualización es algo que una persona pide:

1. La pantalla de Automatizaciones lo indica en la regla: *Desde el blueprint Motor funcionando demasiado tiempo, versión 1* y *versión 2 disponible*.
2. **Revisar actualización** muestra exactamente qué cambia, parte por parte, antes y después, y qué haría la regla si se disparara ahora mismo, con cada escritura sometida a las comprobaciones de la puerta. Todavía no ha cambiado nada.
3. **Actualizar** aplica exactamente lo que se revisó. Si el blueprint avanzó otra vez, o alguien más actualizó la regla entretanto, se rechaza y usted vuelve a mirar. Entra lo que revisó, o no entra nada.

Se registra con quién lo hizo: *automatización actualizada desde el blueprint pump_watch de la versión 1 a la 2*.

Si alguien editó la regla a mano desde que se hizo, la revisión muestra esa edición como sustituida. El cambio de nadie desaparece sin haber pasado antes por la pantalla.

## Cómo es uno

```json
{
  "id": "pump_watch",
  "name": "Pump start watch",
  "description": "Says when a pump starts, with the limit it runs to.",
  "inputs": [
    {"name": "pump", "label": "Pump", "type": "entity", "domain": ["switch"], "required": true},
    {"name": "limit", "label": "Limit", "type": "number", "min": 0, "max": 100, "step": 5, "unit": "%", "required": true}
  ],
  "template": {
    "triggers": [{"type": "state", "entityId": {"!input": "pump"}, "to": "on"}],
    "condition": "float(states['sensor.tank_level']) < ${limit}",
    "actions": [
      {"type": "log_event", "params": {"message": "${pump} started, running to ${limit}%"}}
    ],
    "mode": "skip"
  }
}
```

- **`id`** son letras minúsculas, dígitos y guiones bajos, empezando por una letra.
- **`inputs`** son los huecos, con tipo. Los mismos campos que en el resto de HotLoop: `number` con `min`, `max`, `step` y `unit`, `text` con `max_length` y `pattern`, `boolean`, `select` con `options`, `entity` con los `domain` que admite, `duration` (segundos, o `90s`, `1h30m`), `alarm` y `tag`. Cada uno puede ser `required` o tener un `default`.
- **`template`** es la regla: `description`, `triggers`, `condition`, `actions`, `mode`, `minIntervalSec`, `maxRuntimeSec`, en el lenguaje de automatización ([Automatizaciones](/es/iot/automations/)). No su `id`, `name` ni `enabled`. Esos pertenecen a cada regla hecha con él.

### Los huecos

**`{"!input": "pump"}`** como valor se sustituye por el valor de la entrada, con su tipo: un entity_id llega a `entityId` como cadena, una duración llega a `forSec` como número. Una entrada opcional que nadie rellenó es `null`.

**`${pump}`** dentro de una cadena también se sustituye, y cómo depende de dónde esté:

- En una expresión (la `condition` de una regla, la `expression` de una acción, un valor de `dataExpressions`, `argExpressions`, `fieldExpressions` o `paramExpressions`, y todo lo que haya entre `{{` y `}}` en un mensaje) entra como **literal**. Una cadena va entre comillas, un número es un número, `true`, `false`, `nil`. Así, la condición de arriba, con un límite de 40, es `float(states['sensor.tank_level']) < 40`.
- En cualquier otro sitio es texto sin más: `switch.pump_1 started, running to 40%`.

**`${counter.domain}`** es el dominio de una entrada de tipo entidad, para un nombre de servicio que debe coincidir con el tipo de entidad que se haya elegido: `"${counter.domain}.reset"` es `counter.reset` para un contador de PLC e `input_counter.reset` para un contador auxiliar.

Ese entrecomillado es la razón entera de que una entrada de texto sea segura en una expresión. Escriba `' || true || '` en una entrada de texto y la condición compara con esa cadena, tal como se escribió. Nunca pasa a formar parte de la expresión. Y una entrada de texto no puede contener `{{` en absoluto: cada mensaje que envía una regla ejecuta como expresión lo que haya entre `{{` y `}}` al enviarse, y un valor que alguien escribió en un formulario nunca llega a convertirse en una.

### Se comprueba al guardar

Un blueprint se comprueba antes de almacenarse, no cuando alguien lo prueba:

- cada hueco nombra una entrada, y `.domain` solo va después de una entrada de tipo entidad;
- cada entrada se usa en algún sitio. Una entrada que la plantilla ignora es un campo de formulario que no hace nada, y alguien perderá una tarde con él;
- rellenada con valores de muestra del tipo de cada entrada (su valor por defecto si lo tiene), la plantilla genera una regla que compila. Una entrada de texto que se convierte en una URL necesita un `pattern` que lo diga, `https?://\S+`, o la comprobación de URL rechaza la muestra.

## Rellenar uno

En la pantalla **Blueprints**, **Usar** abre el formulario: el id y el nombre de la regla, y cada entrada como el control adecuado, un número con su rango, una lista, un selector de entidad. Después:

- **Comprobar primero** responde qué regla se haría y qué haría esa regla si se disparara ahora mismo: la condición evaluada, cada escritura y llamada a servicio sometida a las propias comprobaciones de la puerta de escritura como `automation:<id>`, y la primera denegación con las palabras de la puerta. No se almacena, escribe ni audita nada.
- **Crear la regla** la crea, armada salvo que desmarque esa opción, y aparece en la pantalla de Automatizaciones indicando de dónde viene.

Cada entrada se comprueba primero y **nunca se ajusta a la fuerza**. 150 para una entrada cuyo máximo es 100 se rechaza, no se convierte en silencio en 100. `"12"` para un número se rechaza, no se interpreta. Todas las entradas incorrectas se comunican a la vez, de modo que el formulario vuelve con la lista completa. Un valor que la propia regla rechaza (una duración de dos días para una espera que puede ser de un día como máximo) se rechaza con las palabras de la propia regla. No se crea nada hasta que todo es correcto.

Crear una regla **nunca sustituye a otra**. Un id ya ocupado, por una regla escrita a mano o hecha con un blueprint, se rechaza.

Por la API es `POST /api/blueprints/{id}/instantiate`, con `?dry_run=true` para la comprobación. Consulte [la API HTTP](/es/iot/api/#blueprints).

## Los incorporados

Vienen en el binario. Son de solo lectura; **Copiar** crea uno propio con un id nuevo, desde la versión 1, para cambiarlo como quiera.

| Blueprint | Entradas | Qué hace la regla |
|---|---|---|
| `motor_running_too_long` | un motor, cuánto tiempo puede funcionar (por defecto una hora), si debe pararlo | Cuando el motor lleva en `running` ese tiempo de una vez, registra una advertencia. Si se pide, lo para con `motor.stop`. |
| `tank_high_level_stop_pump` | un sensor de nivel, el límite, la bomba (un motor) | Cuando el nivel está en el límite o por encima, la calidad de la lectura es buena y la bomba no está ya parada, para la bomba y lo registra. |
| `alarm_to_notify` | una alarma, el estado en el que actuar (por defecto `unack-active`), una URL de webhook | Cuando la alarma pasa a ese estado, envía por POST `{"text": "Alarm temp-hi is unack-active"}` a la URL. |
| `device_silent_cycle_its_port` | el sensor de conexión de un dispositivo, cuánto tiempo puede estar en silencio (por defecto 5 minutos), el tag de ciclo de alimentación del dispositivo UniFi y su puerto, cuánto esperar después (por defecto 3 minutos), una alarma, el intervalo mínimo entre ejecuciones (por defecto una hora) | Cuando el dispositivo lleva apagado ese tiempo, reinicia una vez la alimentación del puerto de su conmutador a través de la puerta de escritura, espera a que vuelva y, si no lo ha hecho, activa la alarma. El driver rechaza un segundo ciclo del mismo puerto en menos de 15 minutos y nunca reinicia un puerto que lleva la red. |
| `shift_schedule_counter_reset` | un auxiliar de programación, un contador (de PLC o auxiliar) | Cuando la programación se activa, pone a cero el contador y lo registra. |

Algunas notas sinceras sobre ellos:

- **`tank_high_level_stop_pump` es una comodidad, no un enclavamiento.** Un disparo que protege a las personas o a la planta pertenece al PLC, cableado donde debe estar, no a nada que funcione en una red. Este evita que alguien tenga que vigilar un nivel. No sustituye al interruptor de nivel alto.
- No actúa sobre una lectura en la que no puede confiar. Un nivel con mala calidad no para nada, porque una parada basada en un número basura sigue siendo una parada.
- **`shift_schedule_counter_reset` se dispara cuando la programación se activa**, y dos bloques de programación que se tocan son un solo tramo de activación. Por eso, dé a cada turno su propio bloque con la programación apagada entre ellos, aunque sea un minuto (06:00 a 13:59, 14:00 a 21:59), o solo el primer turno de la serie pone a cero el contador.
- **`alarm_to_notify`** es para una sala de chat o un sistema de tickets. Para avisar a un teléfono, con límites de frecuencia, reintentos y enlaces de confirmación, use las notificaciones que envía el propio HotLoop ([Notificaciones de alarma](/es/iot/notifications/)).

## Quién puede hacer qué

| <span class="sr-only">Detalles</span> | visor | operador | administrador |
|---|---|---|---|
| Ver blueprints (`blueprints.read`) | sí | sí | sí |
| Crear una regla con uno, actualizar uno (`blueprints.apply`) | no | sí | sí |
| Escribir, editar, copiar, eliminar uno (`blueprints.write`) | no | no | sí |

Por qué los operadores pueden crear reglas: el blueprint es donde un ingeniero decidió qué hace la regla, y elegir qué bomba vigila es justo la decisión que un operador toma todo el día. La parte peligrosa, lo que la regla ordena, se decidió al escribir el blueprint, por alguien con `blueprints.write`. Eliminar o editar a mano la regla después sigue siendo `automations.write`, de administrador.

Se rechaza eliminar un blueprint con el que se haya hecho alguna regla, y se nombran las reglas. Elimine esas primero. Un blueprint incorporado no se puede editar ni eliminar.

## Agentes

Un agente recibe `list_blueprints`, `preview_blueprint` e `instantiate_blueprint` (y `upgrade_blueprint_automation`, `create_blueprint`, `update_blueprint` y `delete_blueprint`): encuentra el blueprint adecuado, deduce las entradas, muestra lo que haría la regla y la crea, por la misma ruta que usa la pantalla, con las mismas comprobaciones de entradas y el nombre del agente anotado en el libro de registro. Una regla es una orden permanente de dar órdenes a los equipos cada vez que se dispara su disparador, así que la vista previa va primero, y cada escritura que la regla haga después se encuentra con la puerta de escritura. Consulte [MCP](/es/iot/mcp/#blueprints).

## Dónde queda todo

- **Los blueprints** que escribió la planta están en la tabla `blueprints`. Los incorporados están en el binario y nunca se almacenan.
- **Una regla hecha con uno** es una fila de `automations` como cualquier otra, con `blueprint_id`, `blueprint_version` y `blueprint_inputs` que indican de dónde viene. `GET /api/automations` los devuelve como `blueprintId`, `blueprintVersion` y `blueprintInputs`.
- **Cada cambio** está en el registro del sistema y en el libro de registro, con quién lo hizo: *blueprint creado*, *blueprint guardado, ahora versión 2*, *automatización creada desde el blueprint motor_running_too_long versión 1*, *automatización actualizada desde el blueprint pump_watch de la versión 1 a la 2*, *blueprint eliminado*.
- **Las copias de seguridad** incluyen tanto los blueprints como la versión fijada de cada regla, de modo que una planta restaurada ofrece exactamente las actualizaciones que ofrecía antes. Una copia anterior a la existencia de los blueprints restaura cada regla como escrita a mano.
- Una regla cuyo blueprint ya no existe (uno incorporado que una versión posterior retiró, por ejemplo) sigue funcionando exactamente como está. Simplemente no hay nada a lo que actualizarla.
