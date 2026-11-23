---
title: "Cables tipados"
description: "Ponga un JSON Schema en el nodo json y compruebe los mensajes de un cable: una forma errónea llega a un nodo Catch e indica cada campo incorrecto."
---

Un mensaje con la forma equivocada es el fallo que menos queremos en una línea en marcha. Una temperatura que llega como la cadena `"hot"`, un `id` ausente, un número donde debía haber una lista: nada se cae, el flujo sigue, y algo más abajo hace en silencio lo que no debe. Flow aplica JSON Schema a ese problema en tres pasos.

## Esquema en el nodo `json`

Dé al nodo `json` un esquema en su configuración y cada valor que maneje se comprueba contra él. Un valor que coincide sigue adelante. Un valor que no coincide va a un nodo Catch, no continúa por el cable, y el error nombra cada campo incorrecto:

```
does not match the schema: payload.temp: got string, want number; payload.id: missing property "id"
```

`msg.schemaError` lleva lo mismo como una lista de objetos `{path, keyword, message}`, para un nodo Catch que quiera enrutar según ello. Las rutas se leen como las escribe un nodo Change: `payload.sensors[2].temp`.

Si el nodo no tiene esquema en su configuración y un mensaje lleva `msg.schema`, el nodo valida contra ese, como hace el nodo `json` de Node-RED. Un mensaje que pasa pierde su `msg.schema`. Uno que falla lo conserva. El esquema de la configuración gana cuando están los dos.

- El esquema es JSON Schema draft 2020-12 salvo que nombre otro borrador con `$schema`. Se aceptan los borradores 4, 6, 7 y 2019-09.
- Un esquema no válido en la configuración hace fallar el despliegue con el motivo del validador. Un `msg.schema` no válido es un error en ese mensaje.
- Un esquema es autocontenido. Un `$ref` a otra URL o a un archivo se rechaza, no se descarga, de modo que una caja de borde sin ruta de salida se comporta como cualquier otra.
- `format` se comprueba para los formatos que el validador conoce y se ignora para el resto, como en la mayoría de los validadores.
- Un flujo sin esquema en ningún sitio se comporta exactamente igual que antes.

Cualquier otra parte de Flow que necesite comprobar un valor contra un esquema usa el mismo paquete.

## Esquemas en los puertos

Cualquier nodo puede declarar qué acepta y qué promete cada puerto de salida. Son dos claves opcionales en el nodo, ambas en el archivo del flujo, ambas ignoradas por cualquier otra herramienta que lo lea, de modo que un flujo que las lleva sigue viajando de ida y vuelta byte a byte:

```json
{"id":"sensor","type":"function","outputs":2,"wires":[["limit"],[]],
 "ew_outSchemas":[{"type":"object","properties":{"payload":{"type":"object",
   "required":["temp"],"properties":{"temp":{"type":"number"}}}}}, null]},
{"id":"limit","type":"switch","wires":[[],[]],
 "ew_inSchema":{"type":"object","required":["topic"]}}
```

`ew_inSchema` es lo que el nodo recibe. `ew_outSchemas` es una lista con un esquema o `null` por cada puerto de salida. Un esquema describe el mensaje entero, así que el payload es `properties.payload`. Las claves que empiezan por guion bajo, `_msgid` y el resto de la contabilidad interna del runtime, quedan fuera de lo que ve, de modo que un esquema cerrado no tiene que nombrarlas. Son JSON Schema como el del nodo `json`, y las comprueba el mismo paquete.

**Una incompatibilidad que el editor puede ver se rechaza en el despliegue.** Cuando los dos extremos de un cable declaran un esquema y ningún mensaje podría satisfacer a ambos, el despliegue se rechaza antes de escribir un solo byte, igual que la compuerta de pruebas: un 422, nada reiniciado, nada guardado, y un registro en la auditoría como `deploy.refused` con el motivo `typed wires`.

```
the deploy was refused because of 1 typed wire problem, and the flows already running are untouched; junction "sensor" (sensor) output 1 -> "limit" (limit): payload.temp: the sender sends string and the receiver takes number
```

Solo rechaza lo que puede demostrar. Tipos distintos en el mismo campo, un valor fuera del `enum` o del rango del otro extremo, un campo que el receptor exige y que el esquema cerrado del emisor excluye, un campo que el emisor envía siempre y que el esquema cerrado del receptor rechaza. Un emisor que simplemente no menciona un campo que el receptor exige no se rechaza, porque el mensaje bien podría llevarlo, y un esquema que usa `$ref`, `allOf`, `anyOf`, `oneOf`, `not` o `if` no se pone en duda en esa parte. Un rechazo falso detiene un despliegue para nada, y todo lo que no puede demostrar se sigue detectando en tiempo de ejecución. Un esquema que no compila, o un `ew_outSchemas` más largo que las salidas del nodo, se rechaza del mismo modo. Las reversiones no se comprueban, por la razón por la que las pruebas no las condicionan.

**Los literales de un nodo Inject cuentan como un tipo.** Un Inject no tiene esquema propio, pero lo que fija con certeza vale lo mismo. Cuando un Inject está conectado directamente a un nodo con `ew_inSchema`, el payload literal, y cualquier otra propiedad literal que fije, se comprueba contra ese esquema en el despliegue, y un literal que el receptor nunca podrá aceptar se rechaza del mismo modo, con el mismo 422 y el mismo `deploy.refused` en la auditoría:

```
inject "reading" (i1) output 1 -> "limit" (l1): payload: the inject sets "hot", which the receiver does not take: got string, want number
```

Solo se comprueba un literal: una cadena, un número, un booleano o JSON. Una marca de tiempo, una variable de entorno, el contexto de flujo o global, otra propiedad del mensaje, JSONata, un búfer o una expresión regular no se conocen hasta que el nodo se dispara, así que se omiten, nunca se adivinan. Una propiedad requerida que el Inject no fija tampoco es un choque, porque un valor que no es estático puede fijarla. Solo se juzga el cable del Inject al nodo: un literal que pasa antes por otro nodo se deja para la comprobación en ejecución. El editor dibuja el mismo choque en ese cable.

**Lo que no puede ver va a un nodo Catch y a una métrica.** Un mensaje que llega a un nodo y rompe su `ew_inSchema` nunca llega al nodo. Un mensaje que sale por un puerto y rompe su esquema se detiene en el emisor y nunca se entrega. En ambos casos se genera como un error del nodo que tenía el esquema, y el nodo Catch lo recibe con la ruta de cada campo incorrecto en `msg.error.message` y como lista en `msg.error.violations`, cada una `{path, keyword, message}`:

```
the message does not match the schema of output 1: payload.temp: got string, want number
```

`hotloop_flow_node_schema_mismatches_total` los cuenta por nodo, y cuenta también las incompatibilidades del nodo `json`. Un nodo sin esquemas cuesta una comprobación de nil, y un flujo sin ninguno se comporta exactamente igual que antes.

## Tipos en los cables, en el editor

Un cable con un tipo en cualquiera de sus extremos lo lleva consigo. El editor escribe el tipo sobre el cable, en la mitad de la curva: el del emisor, en pocos caracteres (`payload {temp: number}`), y la historia completa al pasar el cursor por el cable.

- **Ambos extremos declaran un tipo y coinciden:** contorno verde, el tipo del emisor.
- **Solo un extremo lo declara:** discontinuo y atenuado, para que vea dónde un cable sigue sin tipo.
- **Ambos declaran uno y nunca pueden coincidir:** el cable y su etiqueta se ponen rojos e indican qué campo, `≠ payload.temp`, y la información emergente trae el motivo del runtime. El despliegue lo rechazaría, y ahora puede verlo antes de pulsar Deploy.

El rojo no es el editor adivinando. Le pregunta al runtime, `POST /flows/types`, que ejecuta la misma comprobación con la que rechaza el despliegue, de modo que el lienzo y el despliegue no pueden discrepar. El editor solo pregunta cuando algo en el lienzo tiene un esquema, poco después de la última edición. Un flujo sin esquemas no hace ninguna llamada y no dibuja nada nuevo.

Fije los tipos en el cuadro de diálogo de un nodo, bajo **Types**: un esquema de entrada y uno para cada puerto de salida. Vacío significa sin tipo, y un nodo que nunca tipó no gana las claves. Escribir algo que no es JSON, o que no es un objeto, se rechaza en el cuadro de diálogo.
