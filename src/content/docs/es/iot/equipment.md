---
title: "El árbol de equipos y las etiquetas"
description: "Un solo árbol ISA-95 de empresa, sitio, área, línea, celda, unidad y equipo, más etiquetas, para que reglas y agentes hablen de la bomba y no del registro 40001"
---

Una planta ya tiene su propia forma de organizarse, y todo SCADA, MES e historian que posee la usa: ISA-95. Empresa, sitio, área, línea, celda, unidad, equipo. Eso es lo que usa HotLoop: un único árbol, y no una lista aparte para las plantas, otra para las áreas y una tercera para los dispositivos. Consulte [Entidades](/es/iot/entities/) para ver qué cuelga de él.

## Niveles

| Nivel | Qué suele ser |
|---|---|
| `enterprise` | La empresa |
| `site` | Una planta |
| `area` | Un departamento o un edificio: Empaquetado, Servicios auxiliares, Parque de tanques |
| `line` | Una línea de producción |
| `cell` | Una celda de trabajo de una línea, o una celda de proceso en una planta por lotes |
| `unit` | Una unidad de producción: un reactor, un enfriador, un horno |
| `equipment` | Una máquina o una parte de ella: una bomba, un skid, un motor |

Un hijo siempre es de un nivel inferior al de su padre, así que un sitio nunca va debajo de una línea. Puede saltarse niveles: una unidad directamente bajo un área es correcto, y también lo es una línea directamente bajo un sitio en una planta sin áreas. La única excepción es `equipment` dentro de `equipment`, porque un skid contiene bombas y una bomba contiene un motor, y ISA-95 deja de dar nombre a los niveles mucho antes de que una planta deje de anidar cosas. Un nodo puede estar en la raíz con cualquier nivel; la mayoría de las plantas empiezan en `site`.

Dos hermanos con el mismo nivel y el mismo nombre son el mismo lugar, así que el árbol rechaza el segundo.

Un nodo nunca puede llegar a ser su propio ancestro: mover un nodo bajo sí mismo o bajo cualquiera de sus descendientes se rechaza. La única forma de obtener un bucle es editar a mano la tabla `equipment`. Si alguien lo hace, nada de lo que recorre el árbol se queda colgado, y se rechaza cambiar un nodo del bucle con un mensaje que nombra los nodos y le dice que ponga el `parent_id` de uno de ellos en NULL.

## El texto de sitio, área y línea sigue funcionando

Todo dispositivo tiene campos de texto libre `site`, `area` y `line` desde antes de que existiera el árbol. No desaparecen. El editor de dispositivos de la 4.15 los escribe, `list_devices` y `describe_device` los leen, y también lo hacen todos los agentes y scripts que alguien haya escrito contra ellos. Por eso el texto y el árbol se mantienen sincronizados, en ambos sentidos, en la misma transacción que el cambio:

**Guardar un dispositivo con texto y sin `equipmentId`** busca el sitio, el área y la línea que nombra el texto, o los crea, cada uno bajo el anterior, y coloca el dispositivo en el más profundo. Dos dispositivos con el mismo texto caen en el mismo nodo; nunca se duplica nada. El texto que usted envió es exactamente el que se guarda: un cliente que no sabe nada del árbol recibe lo de siempre, más un `equipmentId` que puede ignorar.

**Guardar un dispositivo con un `equipmentId` que lo mueve** toma el texto de la ruta del nodo, sea cual sea el texto que llegó con él. Ponga un dispositivo en una celda bajo `Plant A / Packing / Line 2` y su texto pasa a ser `Plant A`, `Packing`, `Line 2`.

Dos detalles lo hacen seguro para los clientes que no conocen el árbol:

- El texto que sigue diciendo lo mismo que dice el nodo actual del dispositivo lo mantiene donde está. El texto solo tiene tres columnas, así que un dispositivo en una celda o en una máquina por debajo de su línea solo puede decir la línea. Guardarlo con ese mismo texto no lo sube a la línea.
- Un cliente que lee un dispositivo y lo devuelve entero, con su `equipmentId` y todo, con el texto editado, obtiene la edición del texto. El `equipmentId` que devolvió es el que el dispositivo ya tenía, así que no es un movimiento, y decide el texto.

Un sitio se encuentra esté donde esté, no solo en la raíz, así que poner `Plant A` bajo una empresa no hace que el siguiente dispositivo que diga `Plant A` cree un segundo sitio.

**Renombrar o mover un nodo** reescribe el texto de todos los dispositivos que están en él o debajo de él, en la misma transacción. Si algo de eso falla, no ocurre nada: un árbol que dice una cosa y un texto de dispositivo que dice otra es exactamente lo que se quería evitar al mantener ambos. La respuesta y el registro del sistema enumeran cada dispositivo cuyo texto cambió.

### La actualización

La migración `0006_hierarchy.sql` construye el árbol a partir del texto que ya lleva cada dispositivo existente: un sitio por cada nombre de sitio distinto, un área por cada nombre de área distinto bajo su sitio, una línea por cada línea distinta bajo su área, y cada dispositivo en el nodo más profundo que nombra su texto. Un dispositivo con área y sin sitio recibe un área raíz; uno con línea y sin área recibe una línea directamente bajo su sitio. Un texto que solo son espacios no nombra nada. El texto se usa exactamente como está guardado, con sus espacios y sus mayúsculas, porque los nombres del árbol son lo que más adelante reescribe el texto, y recortar durante la actualización sería un cambio de nombre silencioso en todo dispositivo que tuviera un espacio suelto. Ningún texto de dispositivo cambia con la actualización.

El lado de Go coloca un dispositivo con las mismas reglas, y una prueba mantiene ambos lados de acuerdo: todo dispositivo colocado por la actualización, guardado de nuevo sin tocarlo, se queda donde está y no hace crecer el árbol en nada.

## Borrar un nodo

**Se rechaza borrar un nodo que tenga algo debajo**: nodos hijos o dispositivos colocados en él. Muévalos primero. El rechazo dice qué estorba.

La alternativa era reasignar los hijos al padre del nodo borrado. Eso mueve todos los dispositivos de debajo y reescribe su texto, bajo un nodo que nadie tocó, y puede poner una línea directamente bajo un sitio sin ningún área en medio, un árbol que nadie dibujó. Quitar la colocación de los dispositivos dejaría su texto nombrando un lugar que ya no existe, y el siguiente guardado de cualquiera de ellos volvería a crear el nodo sin avisar. Las dos opciones sorprenden. Un rechazo que dice qué mover no sorprende.

Las entidades colocadas en un nodo borrado pierden la colocación y vuelven a seguir a su dispositivo.

## Entidades en el árbol

Ahora toda respuesta de entidad lleva tres campos más:

| Campo | Qué |
|---|---|
| `equipment_id` | Dónde está colocada la propia entidad, o null cuando va simplemente donde va su dispositivo |
| `area_id` | El `area` más cercano en el nodo de la entidad o por encima de él, o el nodo de su dispositivo cuando no tiene ninguno. Todo lo que agrupa por área lee este campo. Es null cuando no hay ningún área por encima |
| `labels` | Los label_ids de la entidad |

El lugar propio de una entidad prevalece sobre el de su dispositivo. Eso importa en un dispositivo que es todo un PLC: su tag de temperatura pertenece al horno y su tag del enfriador a Servicios auxiliares. Coloque una entidad con `PUT /api/entities/{entity_id}`:

```json
{ "equipment_id": 42, "labels": ["critical"] }
```

`"equipment_id": null` vuelve a seguir al dispositivo. `labels` reemplaza el conjunto completo. Ambos necesitan `entities.write`, como cualquier otro campo del registro.

## Etiquetas

Una etiqueta es un tag en el sentido cotidiano: `critical`, `line 1 utilities`, `calibrate quarterly`. Los dispositivos y las entidades pueden llevar cualquier número de ellas.

Una etiqueta tiene un `label_id` y un `name`. El `label_id` se genera a partir del nombre la primera vez (letras minúsculas, dígitos y guiones bajos, con `_2`, `_3` si hay una colisión) y nunca cambia, porque es a lo que se refieren las automatizaciones y las pantallas. El nombre puede cambiar cuando quiera. También puede elegir usted mismo el `label_id` al crear una.

Borrar una etiqueta la quita de todo lo que la lleva.

Las etiquetas de un dispositivo se establecen con `PUT /api/devices/{id}/labels`, no con `POST /api/devices`. Todo cliente que hoy guarda un dispositivo envía el dispositivo entero sin etiquetas, y las borraría en cada guardado.

## API

Los endpoints de equipos y etiquetas usan nombres de campo en snake_case, como los endpoints de entidades, porque el árbol es el registro de áreas del modelo de entidades y tiene la forma que necesitan los mismos consumidores. El campo nuevo del dispositivo es `equipmentId`, en camelCase, como el resto de la API de dispositivos.

| Endpoint | Permiso | Qué |
|---|---|---|
| `GET /api/equipment` | `equipment.read` | Todos los nodos, con su `path` de nombres desde la raíz. Filtro: `?level=` |
| `GET /api/equipment/{id}` | `equipment.read` | `{"equipment", "children", "devices", "entities"}`: el nodo, los nodos que cuelgan directamente de él y lo que está colocado directamente en él |
| `POST /api/equipment` | `equipment.write` | `{"parent_id", "level", "name", "description"}` |
| `PUT /api/equipment/{id}` | `equipment.write` | Cualquiera de `name`, `description`, `level`, `parent_id` (null para la raíz). Responde `{"equipment", "devices_rewritten"}` |
| `DELETE /api/equipment/{id}` | `equipment.write` | Se rechaza con 409 mientras haya algo debajo |
| `GET /api/labels` | `equipment.read` | Todas las etiquetas |
| `GET /api/labels/{label_id}` | `equipment.read` | `{"label", "devices", "entities"}` que la llevan |
| `POST /api/labels` | `equipment.write` | `{"label_id"?, "name", "color", "icon", "description"}` |
| `PUT /api/labels/{label_id}` | `equipment.write` | Nombre, color, icono y descripción. Nunca el label_id |
| `DELETE /api/labels/{label_id}` | `equipment.write` | La quita de todo |
| `PUT /api/devices/{id}/labels` | `equipment.write` | `{"labels": [...]}`, el conjunto completo |
| `POST /api/devices` | `devices.write` | Incorpora el `equipmentId` opcional, como se explicó |
| `GET /api/devices/{id}` | `devices.read` | Incorpora `labels` junto a `device` y `tags` |

Todos los roles tienen `equipment.read`: dónde están las cosas es lo que el sitio y el área de un dispositivo ya le decían a un visor. Solo el administrador tiene `equipment.write`, porque renombrar o mover un nodo reescribe el sitio, el área y la línea de todos los dispositivos que hay debajo, y eso es configuración.

Todo cambio queda en el registro del sistema, categoría `config`, sujeto `equipment:<id>` o `label:<label_id>`.

## MCP

`list_devices` y `describe_device` responden a partir del texto, como siempre, y su salida no cambia. Una prueba la fija byte a byte a lo que respondía la versión anterior al árbol, y después reorganiza el árbol alrededor del dispositivo (una empresa sobre su sitio, una celda bajo su línea, una etiqueta) y comprueba que nada de lo que ve un agente se movió. Cuando el árbol sí cambia el texto, por ejemplo con un cambio de nombre, el agente ve el texto nuevo, igual que si alguien lo hubiera escrito en el dispositivo. `list_entities` es donde los agentes ven el árbol: filtra por un nodo y todo lo que hay bajo él, y da el lugar de cada entidad. Consulte [MCP](/es/iot/mcp/#entidades).

## Copia de seguridad y restauración

`equipment`, `labels`, `entity_labels` y `device_labels` están en la copia de seguridad, igual que las nuevas columnas `equipment_id`. `equipment` se referencia a sí misma (`parent_id`), algo que una restauración no puede ordenar: después de mover un nodo, es fácil que un padre se guarde después de su hijo. La restricción es `DEFERRABLE INITIALLY DEFERRED`, así que se comprueba cuando la restauración confirma, con todas las filas ya dentro, y lo mismo vale para cualquier otra cosa que reescriba el árbol en más de una sentencia. La prueba de protección de la copia solo permite que una tabla se referencie a sí misma cuando esa restricción es diferida, y la prueba de ida y vuelta guarda un hijo antes que su padre a propósito.

Una copia de seguridad hecha antes de esta versión sigue restaurándose. Sus archivos `devices` y `entities` tienen una columna menos; la restauración los carga en las primeras columnas de la tabla (una columna nueva siempre se añade al final) y la nueva toma su valor por defecto. Después, en la misma transacción, coloca cada dispositivo restaurado en el árbol según su texto, como habría hecho la actualización.

## La pantalla Planta

El árbol, al lado, con una tarjeta para el nodo elegido: su ruta, los dispositivos que hay en él, las entidades colocadas en él y lo que hay debajo. Un administrador puede añadir un nodo en la raíz o bajo el elegido, renombrarlo, cambiar su nivel, moverlo, borrarlo, colocar un dispositivo en él o sacar uno, y establecer las etiquetas de un dispositivo. La lista de niveles ofrece solo los que permiten las reglas, tanto respecto al padre como respecto a los hijos que ya hay debajo, y un movimiento ofrece solo los padres bajo los que puede ir un nodo de ese nivel, nunca el propio nodo ni nada que esté debajo de él. El servidor lo vuelve a comprobar todo, y un rechazo (un borrado con algo todavía debajo, por ejemplo) se muestra exactamente como lo escribió. Mover un dispositivo es el mismo guardado que hace el editor de dispositivos, con un `equipmentId`, así que el texto sigue al árbol como se describió arriba.

Las etiquetas se gestionan al final de la pantalla: un nombre, un color y una descripción, con el `label_id` elegido una sola vez y fijo. Las entidades reciben su lugar y sus etiquetas desde su panel en la pantalla Entidades.

Todos los demás ven la misma pantalla sin nada que pulsar.
