---
title: "La puerta de escritura: escritura segura"
description: "Toda escritura, de una pantalla, la API, una regla, un script, una receta o un agente, pasa por una función. Qué comprueba y qué responden los rechazos."
sidebar:
  label: "La puerta de escritura"
---

Esto puede mover maquinaria. Por eso aquí tiene exactamente lo que se interpone entre una petición y un dispositivo, en el orden en que lo ejecuta el código.

Todo valor que va a un dispositivo pasa por **una sola función que no se puede esquivar**: un clic en una pantalla, `POST /api/write`, una llamada a un servicio de entidad, una automatización, un script, una receta, un agente por MCP. La política vive ahí y solo ahí, porque una comprobación copiada en seis sitios es una comprobación que alguien olvida añadir en el séptimo, y el séptimo siempre es el que escribe en la prensa en producción. Una prueba hace fallar la compilación si algo del runtime puede llegar a la escritura de un dispositivo sin pasar por la puerta, y demuestra que puede fallar plantando cuatro tipos de desvío en una copia del paquete y detectando cada uno.

¿Prefiere sentirlo en lugar de leerlo? [hotloop.io tiene una versión interactiva](https://hotloop.io/gateway/#the-gate). Accione los interruptores, envíe una consigna y vea exactamente dónde rebota.

## Las comprobaciones, en orden

1. **El solicitante puede escribir.** Esto ocurre en la puerta de la API, antes de la puerta de escritura. Un usuario con sesión necesita `values.write` para llamar a `POST /api/write`: los operadores y administradores lo tienen, los visores no, y sin él la API responde 403. La puerta de un agente es el token bearer de MCP, y sin él recibe un 401 y ni siquiera ve la lista de herramientas. En ambos casos la puerta de escritura no se entera de nada, así que no aparece en la auditoría de escrituras. (Una llamada a un servicio de entidad funciona distinto, [más abajo](#todas-las-puertas-la-misma-puerta-de-escritura).)
2. **Las escrituras están activadas.** `safety.allowWrites`, el interruptor general. Desactivado por defecto desde 4.4.0.
3. **Las escrituras de agentes están activadas.** `safety.allowMcpWrites`, que se comprueba solo cuando la petición llegó por MCP. Estrecha el interruptor general y nunca puede saltárselo: con las escrituras activadas y este desactivado, un operador puede comandar un tag y un agente no. Si se activa con `safety.allowWrites` desactivado, el Gateway se niega a arrancar, en vez de dejarle adivinar cuál manda.
4. **El tag está armado.** Todo tag es de solo lectura hasta que alguien lo marca como `writable`, uno por uno y a propósito. Una importación por exploración de 4000 tags no arma ninguno. Un tag que no existe también se rechaza aquí.
5. **El valor está dentro del rango.** Cuando el tag tiene un rango y el valor es un número, un valor fuera de él **se rechaza, nunca se recorta**. Quien escribió 500 en un tag que llega como máximo a 400 cometió un error y necesita enterarse. Enviar 400 en silencio es hacer algo que nadie pidió, y nadie se entera.
6. **Pasa la comprobación propia del solicitante.** Una entidad añade lo que solo ella sabe: el paso y el rango más estrecho de un número, el patrón y la longitud de un texto, las opciones de una selección, la salida de un lazo, que se rechaza salvo que el lazo esté ahora en manual, o que la entidad se desactive o se elimine a mitad de la llamada. Se ejecuta dentro de la puerta, después de la política y el rango del tag, para que un operador siempre oiga primero lo del tag, y antes de la fila de auditoría, para que el rechazo de una entidad quede registrado igual que el de un tag. Solo puede rechazar. No puede cambiar el valor ni dejar pasar nada que la puerta habría detenido.
7. **El dispositivo está en marcha.** HotLoop tiene un worker en ejecución para él. Un dispositivo desactivado, o que nunca arrancó, se rechaza con `the device is not connected` en lugar de lanzar un valor al vacío.

**Solo entonces se abre la fila de auditoría, y solo entonces sale el valor.** Si la fila no se puede escribir, la escritura no se envía en absoluto. Una escritura sin auditoría es una de la que nadie puede dar cuenta después, y en equipos que se mueven no merece la pena ese trato. La fila se cierra con el resultado y la latencia en un contexto separado de la petición, de modo que una escritura que agota el tiempo o se cancela registra igualmente lo ocurrido.

Todo rechazo desde la comprobación 2 en adelante se audita como rechazo: una fila con el actor, el origen, el valor que se pidió, el valor al que habría sustituido y `refused:` con el motivo, además de un aviso en el registro del sistema. Quien intenta una y otra vez comandar un tag que no le corresponde pasa desapercibido si no queda escrito, y un ingeniero debe poder encontrarlo después. La comprobación 1 no está en la auditoría de escrituras, porque la puerta no llegó a verla.

### Por qué ese orden

La política se ejecuta antes de abrir la fila de auditoría, así que un rechazo se registra como rechazo y no como un intento que casualmente falló. La fila de auditoría se abre antes de que el valor llegue al cable, así que una escritura que se cuelga, o que tumba el proceso, deja constancia de que se intentó. En una planta, "no sabemos si ese comando salió" es la peor respuesta posible.

### Una cosa que la comprobación 7 no detecta

La comprobación 7 pregunta si el dispositivo tiene un worker, no si su sesión está activa en este mismo instante. Un dispositivo que se cayó de la red y se está reconectando la supera. Se abre la fila de auditoría, el driver no tiene sesión y la escritura falla como `the device is not connected`, registrada como intento fallido y no como rechazo. En ambos casos no llega nada al dispositivo. La [prueba en seco](#pregunte-antes-de-enviar-la-prueba-en-seco) comprueba también la sesión, y lo avisa desde el principio.

## Qué responde cada rechazo

El código de estado dice de quién es el problema, porque así lo lee un operador.

| Qué ocurrió | El error dice | HTTP |
|---|---|---|
| Sin permiso, en la puerta | `<user> does not have the "values.write" permission` | 403 |
| Las escrituras están desactivadas | `writes are disabled on this deployment` | 403 |
| Las escrituras de agentes están desactivadas | `writes from MCP clients are disabled on this deployment` | 403 |
| El tag no está armado | `this tag is not marked writable` | 403 |
| La entidad está desactivada | `the entity is disabled` | 403 |
| El tag no existe | el tag y `not found` | 404 |
| La entidad desapareció a mitad de la llamada, o no está en un estado que lo permita (un lazo que no está en manual) | lo que cambió | 409 |
| El valor está fuera del rango del tag | `value is outside the tag's configured range` | 422 |
| La entidad no acepta el valor (paso, patrón, opciones, su propio rango) | `the value is not one this entity accepts` y el motivo | 422 |
| El dispositivo no está conectado | `the device is not connected` | 503 |
| El dispositivo respondió que no | las palabras del propio dispositivo | 502 |
| La escritura no se pudo auditar, o cualquier otra cosa que la API no sepa ubicar | `internal error (ref …)`, con el detalle en el registro del servidor bajo esa referencia | 500 |

Todo lo que la API no sabe ubicar es un 500. Antes era un 400, lo que significaba que una caída de la base de datos le decía a un operador que había escrito algo mal, y se ponía a buscar una errata que no existía.

Por MCP no hay códigos de estado. Un rechazo vuelve como un resultado de herramienta marcado `isError`, con las palabras de la propia puerta:

```
> write_tag tag=press-01/Zone1_Temp value=99 reason="testing"
write refused: press-01/Zone1_Temp: this tag is not marked writable
```

Es una respuesta, no un fallo de transporte. La llamada se entendió y se rechazó a propósito, y reintentarla da la misma respuesta.

## Pregunte antes de enviar: la prueba en seco

La puerta tiene un segundo punto de entrada que pregunta sin hacer. Ejecuta las mismas comprobaciones, en el mismo orden, y da el mismo texto de error en un rechazo. No abre fila de auditoría, no genera eventos, no cuenta nada y nunca llega al dispositivo. Incluso va un paso más allá que la escritura real: un dispositivo cuyo worker está en marcha pero cuya sesión está caída se informa como no conectado, en lugar de "esto saldría".

Dónde encontrarla:

- **Llamadas a servicios de entidad**: `POST /api/services/{domain}/{service}?dry_run=true`. Responde 200 con el veredicto: cada escritura que haría como `would_write`, o la primera que se rechazaría como `not_sent`, con el motivo palabra por palabra. Una petición que ni siquiera se pudo planificar (no existe la entidad, un servicio que el dominio no admite, datos incorrectos) responde con el mismo estado que daría la llamada real. `dry_run` acepta `true` o `false` y nada más, y `yes` es un 400, porque adivinar mal convierte una pregunta en una orden.
- **El prompt de comandos** pregunta mientras escribe y muestra "Would be refused: ..." antes de que nadie confirme.
- **Scripts**, novedad en 4.17.0: `POST /api/scripts/{id}/run?dry_run=true`, **Check first** en el panel de ejecución, o `run_script` de MCP con `dryRun`. Cada paso se recorre contra la planta tal como está ahora mismo, y la primera escritura que se rechazaría termina el recorrido con las palabras de la puerta. Vea [Scripts](/es/iot/scripts/).
- **Recetas**, novedad en 4.17.0: cada destino se somete a estas comprobaciones antes de que salga el primer valor, y un solo valor incorrecto rechaza la receta entera sin escribir nada. `POST /api/recipes/{id}/validate` y `validate_recipe` de MCP preguntan sin aplicar. Vea [Recetas](/es/iot/recipes/).
- **Blueprints**, novedad en 4.17.0: **Check first** muestra lo que haría la regla si se disparara ahora mismo, con cada escritura sometida a estas comprobaciones, antes de que la regla exista. Vea [Blueprints](/es/iot/blueprints/).

Una prueba en seco limpia es un consejo, no una promesa. La puerta sigue decidiendo en la escritura real, porque un dispositivo puede caerse, o alguien puede desarmar un tag, entre su pregunta y su comando.

:::caution[¿Sigue en 4.16.0? El prompt puede tragarse un Set]
En 4.16.0 el veredicto de la prueba en seco aparece un cuarto de segundo después de dejar de escribir, justo cuando el ratón va hacia Set, y el prompt crece o se encoge bajo él. Set se mueve unos 30 px, así que el clic cae en el vacío, o en el fondo y cierra el prompt. El operador lo ve cerrarse, supone que la consigna salió y no se escribió nada. Corregido en 4.17.0: el veredicto queda junto a los botones y nada se mueve. Hasta que [actualice](/es/gateway/upgrading/), compruebe que el valor realmente cambió después de pulsar Set.
:::

## Todas las puertas, la misma puerta de escritura

- **Las pantallas y `POST /api/write`.** El actor es el nombre del usuario con sesión, no una cabecera que cualquiera podría poner.
- **Servicios de entidad**, `POST /api/services/{domain}/{service}`. `switch.turn_on` sobre `switch.press_01_pump` es una escritura de tag a través de esta puerta, auditada contra la entidad con su entity_id, el servicio y un id de llamada. La pulsación de un botón son dos escrituras bajo un mismo id de llamada. Aquí un usuario sin `values.write` no se detiene en la puerta: el permiso que falta se entrega a la puerta de escritura como la comprobación propia del solicitante, de modo que una llamada de entidad denegada se audita contra la entidad, con el valor que se pidió, como cualquier otro rechazo, y sigue respondiendo 403.
- **Las automatizaciones** escriben como `automation:<rule-id>`. Una regla no recibe más privilegios que una persona. Vea [Automatizaciones](/es/iot/automations/).
- **Los scripts**, novedad en 4.17.0, escriben como `script:<id>` y conservan el origen de quien los inició, de modo que un script que lanza un agente choca con el interruptor de agentes igual que el `write_tag` del propio agente.
- **Las recetas**, novedad en 4.17.0, escriben cada destino bajo un mismo id de llamada, así que `GET /api/writes?call=<id>` es la aplicación completa en el registro de auditoría.
- **Los agentes** escriben como `mcp:<client name>`. `write_tag` y `call_service` pasan las mismas comprobaciones que un operador, y ambos se niegan a ejecutarse sin un motivo declarado, que queda en el registro del sistema junto a la escritura. Una fila de auditoría que nadie sabe explicar seis meses después es solo una marca de tiempo con mala conciencia. `trigger_automation` se niega de plano mientras las escrituras de agentes están desactivadas, y también `run_script` y `apply_recipe`, porque una regla, un script o una receta pueden comandar equipos y de otro modo serían una forma de saltarse el interruptor. Vea [Model Context Protocol](/es/iot/mcp/).

## Por qué las escrituras están desactivadas por defecto

Antes de 4.4.0, `safety.allowWrites` y `safety.allowMcpWrites` eran `true` por defecto. Ahora son `false`. Un tag siempre fue de solo lectura hasta armarlo, pero una instalación nueva no debería estar a un flag `writable` de comandar equipos antes de que nadie la haya revisado.

Encima de la puerta, `safety.confirmWrites` (activado por defecto) hace que las pantallas pidan confirmación antes de enviar nada. Es un aviso en el navegador, no una comprobación en la puerta, y es el único ajuste de seguridad que puede cambiar desde la pantalla de Ajustes. `safety.allowWrites` y `safety.allowMcpWrites` son de solo lectura ahí a propósito: el control maestro sobre si este proceso puede comandar equipos no debe estar tras la misma sesión de navegador que emite las escrituras.

## Activar las escrituras, a propósito

1. Añada el dispositivo y descubra sus tags donde el protocolo pueda listarlos. Modbus y S7comm no pueden enumerar sus propios puntos, así que declárelos a partir de la documentación del dispositivo.
2. Marque los tags como escribibles uno por uno, y solo los que quiera.
3. Ponga `safety.allowWrites: true` en su archivo de valores y ejecute `helm upgrade`. Hasta que lo haga, nada de los pasos 1 y 2 puede mover una válvula.
4. Solo si los agentes también deben comandar equipos, ponga `safety.allowMcpWrites: true`.

## Lo que no hace

La aplicación no puede imponerlo todo, y es mejor decirlo que dejar que usted lo dé por hecho.

- **No es un enclavamiento.** Un disparo que protege a las personas o a la planta pertenece al PLC, cableado donde debe estar, no a nada que se ejecute en una red.
- **No vigila su broker.** Si envía comandos de nodo a edge relays por MQTT, el control de acceso del propio broker tiene que restringir quién puede publicarlos a las credenciales del Gateway.
- **El servidor OPC UA no puede escribir en absoluto.** Es de solo lectura, sin manejador de escritura ni ajuste que lo añada, así que el SCADA que lo lee no puede comandar nada a través de él.
