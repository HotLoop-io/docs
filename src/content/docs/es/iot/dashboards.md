---
title: "Dashboards por rol y pantalla"
description: "Páginas de tarjetas por rol o pantalla: indicadores, tendencias, listas de entidades y botones, con el mismo diseño en PC de panel, portátil y teléfono."
---

Un dashboard es una página de tarjetas que alguien construyó. Indicadores, tendencias, listas de entidades, un botón que arranca la bomba, un plano de planta con las temperaturas colocadas donde están las zonas. Construya tantos como necesite la planta, dé cada uno a los roles que lo necesitan o a la única pantalla en la que vive, y el antiguo Board es solo uno más.

Está en HotLoop IoT, Edge y Gateway. El Edge Relay no tiene interfaz ni dashboards. La HMI de Edge está construida con esta página y nada más, y esa es la razón de que el resto sea como es.

## Por qué está construido así

**Una tarjeta no ordena nada.** La primera pregunta de diseño para cualquier página de botones es si la página es una segunda forma de manejar la planta. No lo es. Una tarjeta nombra un tag, una entidad, un script o una receta, y el navegador hace con ellos lo que hace cualquier otra pantalla. Un botón de escritura envía `POST /api/write`. Los controles de una entidad llaman a `POST /api/services`. Un botón de script abre el aviso de ejecución de la pantalla Scripts y una tarjeta de receta abre el panel de aplicación de la pantalla Recetas. Cada una de esas acciones tiene su propio permiso y se encuentra con la puerta de escritura, así que un dashboard tampoco puede ser una forma de saltársela. Lo que protege `dashboards.write` es quién decide qué son los botones, que es una decisión de ingeniería y es solo de administrador por la misma razón que escribir un script.

La consecuencia: un dashboard guardado por un administrador no hace nada hasta que un operador pulsa algo, y lo que hace la pulsación es exactamente lo que hace pulsarlo en cualquier otra pantalla, hasta la fila de auditoría.

**Un diseño es un flujo, no coordenadas.** Las tarjetas van en orden de lectura. Cada una dice cuánto ocupa de ancho sobre doce columnas y cuánto de alto en filas, y no sabe nada de dónde aterriza. Doce columnas en un PC de panel, seis en un portátil con otra ventana al lado, dos en una tableta, una en un teléfono. Un diseño de posiciones en píxeles es correcto exactamente en la pantalla en la que se dibujó, y la HMI de Edge tiene que ser correcta en la pantalla que tenga la máquina.

La consecuencia: nadie construye nunca la versión para teléfono. No existe.

**Los guardados nombran la versión.** Que dos personas editen un mismo dashboard es algo que ocurre en el cambio de turno. Un guardado lleva la `version` con la que se abrió, y uno obsoleto se rechaza con un `409` que dice quién llegó primero. Sin eso, la segunda persona que pulsa Guardar borra la tarde de la primera sin que ninguna de las dos lo vea.

## El modelo

```json
{
  "id": "line-2",
  "name": "Line 2",
  "description": "The extruder, for the floor.",
  "kind": "cards",
  "roles": ["operator", "admin"],
  "homeFor": ["operator"],
  "screens": ["line-2-panel"],
  "position": 1,
  "version": 3,
  "cards": [
    {"id": "temp", "type": "gauge", "title": "Zone 1", "w": 3, "h": 3,
     "config": {"tag": "press-01/Zone1_Temp"}},
    {"id": "go", "type": "button", "w": 3, "h": 1,
     "config": {"tag": "line-02/Speed", "value": 250, "label": "Run at 250", "confirm": true}}
  ]
}
```

- **`id`** son letras minúsculas, dígitos, guiones y guiones bajos, empezando por una letra. Está en la dirección y nunca cambia. `wall` es el del tablero mural.
- **`kind`** es `cards`, o `wall` para el tablero mural.
- **`roles`** son los roles a los que se ofrece el dashboard. Vacío es todos los roles. Quien tiene `dashboards.write` ve todos los dashboards diga lo que diga, porque tiene que poder arreglar el que nadie más puede abrir. Un rol al que no se le ofrece uno recibe un `404` por su nombre, de modo que la lista de lo que existe no es algo que un visor pueda averiguar preguntando.
- **`homeFor`** son los roles para los que se abre cuando entran sin una dirección que pida nada. Un rol tiene como máximo uno; el dashboard tiene que ofrecerse a los roles de los que es la página de inicio.
- **`screens`** son las pantallas físicas a las que está destinado. Un nombre de pantalla pertenece a un solo dashboard.
- **`position`** ordena el selector. Los nuevos van al final.
- **`cards`** van en orden de lectura, hasta 60 por dashboard, 2 MB entre todas.
- **`version`** sube uno en cada guardado.

Una tarjeta es `id` (único en su dashboard, generado por la página), `type`, un `title` opcional, `w` (1 a 12) y `h` (1 a 8), y un `config` que depende del tipo. Omita `w` y `h` y se usa el valor por defecto del tipo. Un config se comprueba de forma estricta: una clave que el tipo no tiene es un error, y lo que se almacena lleva todos los valores por defecto rellenados. Una tarjeta que nombra un tag, entidad, script o receta que no existe se rechaza al guardar el dashboard. Un botón sobre un tag que no está marcado como escribible, o un botón cuyo número está fuera del rango del tag, también se rechaza: la puerta rechazaría cada pulsación, y quien lo construye debe enterarse de eso, no quien lo pulsa.

## Las tarjetas

| Tipo | Qué es | Config | Tamaño por defecto |
|---|---|---|---|
| `status` | Dispositivos activos, tags que informan, alarmas, historiador, tiempo en marcha: la franja del Board | ninguna | 12 x 1 |
| `gauge` | Un tag como el dial del Board, con su rango y sus límites de alarma marcados | `tag` | 3 x 3 |
| `value` | Un tag como un número grande, coloreado según su estado de alarma | `tag`, `decimals` | 3 x 2 |
| `trend` | Hasta seis tags de 15 minutos a una semana | `tags`, `minutes`, `labels` | 6 x 3 |
| `entities` | Las entidades que elija, como sus propios iconos con sus propios controles | `entities` (hasta 30) | 6 x 3 |
| `alarms` | La lista de alarmas, con Confirmar para quien pueda | `outstanding`, `limit`, `devices`, `equipment` | 6 x 3 |
| `button` | Escribe un valor en un tag, tras preguntar | `tag`, `value`, `label`, `confirm` | 3 x 1 |
| `script` | Ejecuta un script mediante el aviso de la pantalla Scripts | `script`, `label` | 3 x 1 |
| `recipe` | Elige una de hasta ocho recetas y abre su panel de aplicación | `recipes` | 4 x 2 |
| `markdown` | Texto: títulos, listas, negrita, cursiva, código, enlaces http(s) | `text` | 4 x 2 |
| `camera` | Una instantánea que se actualiza, o una transmisión JPEG de movimiento | `url`, `stream`, `refreshSec` | 6 x 4 |
| `map` | Un plano de planta con tags en vivo colocados sobre él | `image`, `markers` | 6 x 5 |
| `setpoint` | Un número introducido para un tag, con límites, una unidad y una confirmación, y lo que el dispositivo comunica de vuelta | `tag`, `label`, `min`, `max`, `step`, `unit`, `decimals`, `confirm` | 3 x 3 |
| `symbols` | Una imagen de una máquina o de un proceso: símbolos colocados por píxel sobre un fondo, unidos por tuberías, dibujados a partir de sus tags | `image`, `width`, `height`, `symbols`, `pipes`, `view` | 8 x 5 |

Lo que conviene saber de las que no son obvias:

- **`button`** envía `value` con el tipo con el que se guardó. Un número es un número, `true` es un booleano, una cadena es texto. `1` y `1.0` son escrituras distintas en un PLC y la puerta decide por el tipo JSON, así que la tarjeta no convierte una en otra. `confirm` está activado salvo que se desactive, y entonces pregunta «esto da órdenes a equipos reales» con el valor actual y un motivo que va a la pista de auditoría (`dashboard <id> / <card>` si se deja vacío). Desactivarlo es para un panel en el que mantener pulsado el botón es el objetivo; es una decisión de ingeniería y la opción «Confirmar antes de escribir» de la pantalla Ajustes lo vuelve a activar.
- **`alarms`** lista las alarmas de toda la planta salvo que la apunte a otro sitio. `devices` es una lista de ids de dispositivo. `equipment` es una lista de ids de nodos de equipo de `GET /api/equipment`, de cualquier nivel (una sede, un área, una línea, una celda), y un nodo representa a todos los dispositivos colocados en él o debajo, de modo que la página de un área puede mostrar las alarmas del área y las de nadie más. Con ambos, una alarma se lista cuando está en cualquiera de los dos. Omítalos, o déjelos vacíos, y la tarjeta es la de toda la planta, que es lo que hacía toda tarjeta guardada antes de estos campos. El límite cuenta lo que queda tras el filtro, y `outstanding` sigue descartando lo que ha vuelto a la normalidad y está confirmado. Una tarjeta limitada a un lugar sin alarmas dice «aquí» para que nadie la lea como una planta tranquila, y una tarjeta cuyo equipo se ha eliminado desde entonces lo dice en lugar de mostrar una lista vacía. El equipo se almacena como el id del nodo, así que renombrar o mover un nodo no rompe la tarjeta. El dashboard se rechaza al guardar si un dispositivo o un nodo no existe. En el constructor usted escribe la ruta (`Plant 2 / Scrubbers / Kettle 3`) y él guarda el id. Esta tarjeta lee el árbol, así que un rol necesita `equipment.read` (los operadores y los visores lo tienen).

  ```json
  {
    "id": "kettle-alarms", "type": "alarms", "title": "Scrubber alarms", "w": 6, "h": 3,
    "config": { "outstanding": true, "limit": 10, "equipment": [14], "devices": ["oven-1"] }
  }
  ```
- **`trend`** dibuja la ventana que usted pidió, terminando ahora, y no solo el tramo que las lecturas llegaron a cubrir: `minutes: 480` es un eje de las últimas ocho horas con una marca en cada hora en punto, en la zona horaria de quien mira. Un tag que no se ha movido es una línea plana en su última lectura buena, porque eso es lo que parece un molino parado o una válvula cerrada, y el historiador solo conserva una lectura cuando un valor supera su banda muerta, de modo que puede haber una lectura en la ventana, o ninguna. Nada de lo que hay en la línea es inventado. Lo que el tag tenía cuando empezó la ventana es su última lectura buena anterior (`GET /api/history` lo indica con `carry=true`), y la línea es ese valor desde el principio de la ventana hasta la primera lectura dentro de ella. Después de la última lectura se mantiene hasta la última vez que se supo del tag, nunca más allá de ahora. No hay línea antes de la primera lectura que alguien tenga, y un tag cuya última lectura anterior a la ventana era mala no tiene arrastre alguno, porque no se sabe lo que tenía. Un tramo de lecturas malas es un hueco, igual que siempre. Una lectura sola es una línea hasta ahora, o un punto si no hay dónde dibujarla.

  La leyenda nombra cada línea con el propio nombre del tag, el mismo nombre que muestra la tarjeta de número, sin el dispositivo delante. Dos líneas con el mismo nombre de dispositivos distintos conservan sus ids completos para que pueda distinguirlas. `labels` es un objeto opcional que va de un tag de `tags` al texto que usted quiere en su lugar, de 1 a 80 caracteres, y una etiqueta para un tag que no se dibuja se rechaza. La información emergente al pasar el ratón siempre lleva el id completo junto a la etiqueta.

  ```json
  {
    "id": "mills", "type": "trend", "title": "Mill temperatures", "w": 6, "h": 3,
    "config": {
      "tags": ["plant-5-temperatures/Large Sand Mill Temperature", "plant-5-temperatures/Small Sand Mill Temperature"],
      "minutes": 480,
      "labels": { "plant-5-temperatures/Large Sand Mill Temperature": "Large mill" }
    }
  }
  ```
- **`camera`** carga la dirección en el navegador, no en el servidor. El config de una tarjeta es legible por todos los roles que abren el dashboard, así que una dirección con un usuario o un token dentro se rechaza al guardar el dashboard. Use una dirección de la red de la planta que no necesite ninguno, o un proxy que añada el acceso. Una imagen fija se vuelve a pedir cada `refreshSec` segundos con un parámetro de consulta `_hl` para que el navegador no muestre la primera para siempre.
- **`map`** es una imagen y marcadores. La imagen es una dirección http(s) o una subida a la tarjeta (png, jpeg, webp o gif, hasta 500 KB, almacenada en la tarjeta). Los marcadores son tags, colocados en porcentaje del ancho y el alto de la imagen para que se queden donde se pusieron a cualquier tamaño. Esto es un plano de planta, no un mapa de calles: un mapa de teselas necesita un servidor de teselas en internet, y el PC de panel de una planta normalmente no puede llegar a uno.
- **`setpoint`** es para un número que alguien teclea: una temperatura, una velocidad, un nivel. El campo conoce la unidad del tag (o la `unit` de la tarjeta) y sus límites: `min` y `max` juntos, o el propio rango del tag cuando la tarjeta no da ninguno. Una tarjeta solo puede estrechar el rango del tag, nunca ampliarlo, porque la puerta de escritura rechaza un valor fuera del rango del tag diga lo que diga una tarjeta; una tarjeta que ofrece más se rechaza al guardar el dashboard, y también una tarjeta sobre un tag que guarda texto o un interruptor (use un `button` para esos). Fuera de los límites, fuera del `step` o sin ser un número, la entrada lo dice bajo el campo y **Establecer** sigue desactivado. **Establecer** pregunta primero, con el valor actual y un motivo para la pista de auditoría, salvo que la tarjeta se construyera con `confirm` desactivado y Ajustes no lo anule, y entonces pasa por `POST /api/write`: el interruptor general de escritura, el indicador de escribible del tag, el permiso del rol y la fila de auditoría son los mismos que en cualquier otra escritura. Después la tarjeta espera a que la lectura del dispositivo muestre el valor y lo vigila dos segundos más, y dice lo que tiene el dispositivo: «Leído de vuelta 70 C del dispositivo: es el valor enviado»; o, si el PLC tomó la escritura y la devolvió a su propio límite, «El dispositivo tomó 70 C y luego lo cambió a 60 C»; o, si la lectura nunca lo mostró, «El dispositivo informa 60 C, no 70 C». La línea «en el dispositivo ahora» es la lectura en vivo todo el tiempo, así que también muestra un programa del PLC sobrescribiendo el valor más tarde. Mientras el dispositivo no tiene una lectura buena (un PLC apagado o inalcanzable) el campo y Establecer están desactivados y la tarjeta dice que el dispositivo no responde, porque una escritura solo podría ser rechazada.
- **`symbols`** es una imagen de una máquina. `width` y `height` son el tamaño propio de la página en píxeles (800 por 450 si se omiten), `image` es un fondo opcional (una dirección http(s), o una imagen subida a la tarjeta, igual que en `map`), y `symbols` es una lista de elementos colocados por píxel desde la esquina superior izquierda: `{"id": "p1", "type": "pump", "x": 120, "y": 300, "tag": "plc/bPumpRun"}`. La página se dibuja como una sola imagen escalada, así que cada símbolo conserva su sitio a cualquier tamaño de tarjeta y en un teléfono. Los tipos son `pump`, `motor` y `fan` (giran mientras el tag está activo), `valve` (abierta o cerrada), `tank` (lleno entre `min` y `max`, o el rango del tag, o de 0 a 100), `heater` y `lamp` (encendidos mientras está activo), `pipe` (lo que lleva dentro se mueve mientras su tag opcional está activo), `readout` (el número, con `unit` y `decimals`) y `label` (texto fijo). `invert` lee un tag al revés, y el `tone` de una lámpara (`ok`, `warn`, `bad` o `info`) es el color con el que se enciende: una lámpara de marcha es verde y una de fallo es roja, y el tag dice solo cuándo está encendida. Cualquier símbolo puede llevar dos reglas que leen un tag. `show` hace que aparezca solo mientras la regla se cumple (`"show": {"tag": "plc/bDoorOpen", "op": "off"}`): mientras no se cumple el símbolo no se dibuja, y el constructor lo muestra atenuado para que se pueda seguir seleccionando. `colors` son hasta cuatro reglas, cada una con un `tone` (`ok`, `warn`, `bad` o `info`): la primera que se cumple pinta el símbolo con ese tono, diga lo que diga su propio tag, y cuando no se cumple ninguna se dibuja como era. Una regla es `tag`, un `op` y, para las comparaciones que lo necesitan, un `value`: `on` (el tag no es 0, el valor por defecto), `off`, `eq`, `ne`, `gt`, `ge`, `lt` y `le`. Una regla cuyo tag no tiene una lectura buena no se cumple y no oculta nada, así que una conexión perdida nunca hace desaparecer un símbolo. Una regla puede en cambio combinar reglas: `{"all": [...]}` se cumple mientras se cumplen todas ellas y `{"any": [...]}` mientras se cumple una (el AND y el OR de un PLC), hasta tres niveles y ocho partes, y no tiene tag propio. Un tag perdido hace que un `all` no se cumpla, y un `any` se cumple con las demás. Una lámpara también puede llevar una regla `lit` en lugar de su tag, para una lámpara que se enciende por una comparación o una combinación (`"lit": {"tag": "plc/Mode", "op": "eq", "value": 3}`); entonces no necesita tag. Los tags de las reglas son tags que nombra la pantalla, así que un archivo de pantalla los enumera y los mueve con todo lo demás. Un símbolo dice su estado con palabras además de con color (un texto y un título), se dibuja rojo o cálido cuando su tag está en alarma o ha vuelto de una, y se atenúa con "no reading" cuando el tag no tiene una lectura buena. El movimiento se detiene cuando la persona ha pedido a su sistema menos movimiento. Los símbolos los dibuja HotLoop para HotLoop; ninguno es prestado. Un símbolo con un tag abre ese tag al hacer clic, como una chincheta en un plano de planta. No manda nada: ponga una tarjeta `setpoint` o `button` a su lado para eso. En el constructor un símbolo se coge y se mueve con el puntero, o con las teclas de flecha (Mayús mueve diez píxeles), o se le dan sus píxeles con un número.

  **Símbolos de proceso y tuberías.** Una tarjeta symbols es también un P&ID. Además de los tipos anteriores coloca `controlvalve`, `checkvalve`, `compressor`, `heatexchanger`, `filter`, `vessel`, `flowmeter`, `instrument` (una burbuja ISA: su `label` son las letras, y muestra el número de su tag), `junction`, `source` y `sink`. Un símbolo tiene `rot` (`90`, `180` o `270`) para girarlo de cuarto en cuarto alrededor de su centro; el texto no gira. La mayoría de los símbolos tienen puntos de conexión: `in` y `out` en una bomba, `top`, `bottom`, de `left-1` a `left-3` y de `right-1` a `right-3` en un depósito, `w` y `e` en una válvula, y así sucesivamente. Una tubería une dos de ellos:

  ```json
  "pipes": [
    { "id": "tank-out", "from": { "symbol": "tank-1", "port": "bottom" },
      "to": { "symbol": "p1", "port": "in" }, "medium": "water", "tag": "plc/Flow" }
  ]
  ```

  Solo se guarda lo que se une. La página calcula la ruta dondequiera que dibuja la tubería: ángulos rectos, rodeando cada símbolo de la página con margen, con las menos esquinas posibles, y una tubería que sale de un símbolo sale hacia donde mira su punto de conexión. Mueva un símbolo y sus tuberías se re-enrutan mientras se mueve, en el constructor y en un archivo guardado. Una T es un símbolo `junction` con tres tuberías (sus puntos `n`, `e`, `s` y `w` están todos en su centro), y en el constructor soltar una tubería sobre otra la divide con una unión por usted. `medium` es uno de `process` (el valor por defecto), `water`, `wastewater`, `fuel`, `oil`, `air`, `steam`, `gas`, `chemical`, `coolant`, `hydraulic`, `vacuum`, `nitrogen`, `power` o `signal`. Cada uno tiene su color, y signal y power tienen además su propio patrón de línea, así que una tubería nunca se distingue solo por el color. `tag` (con `invert`) dice cuándo se mueve el medio por la tubería, de `from` a `to`, y `flow` lo dice con una regla, las mismas reglas que usan `show` y `colors` de un símbolo. Una tubería sin ninguno de los dos se dibuja llena y quieta. `label` tiene hasta 24 caracteres a lo largo de la tubería. Una tubería lleva un tag o una regla, no ambos. Una página admite hasta 120 símbolos y 240 tuberías.

  **La barra de herramientas.** Cada tarjeta symbols, al verse y al construirse, tiene una barra de herramientas arriba a la derecha: acercar, alejar, ajustar la página, el minimapa y la vista de alto rendimiento. El zoom también es Ctrl y la rueda (la rueda sola sigue desplazando el panel), `+`, `-` y `0` en la página; arrastre la página para moverla. Una vez ampliada, el minimapa muestra la página entera con un marco donde usted está, y pulsar o arrastrar en él le lleva allí. La vista de alto rendimiento es la página gris de ISA-101: equipos grises y tuberías grises, un relleno más oscuro para en marcha o abierto en lugar de verde, el medio de la tubería como un código corto a su lado (W para agua, S para vapor, SIG para señal), y un color solo en lo que está en alarma o pintado por una regla. `view` fijado a `hp` hace que una página se abra en ella; la barra de herramientas cambia de una a otra para quien mira, y con eso no se guarda nada. El flujo se anima solo cuando la persona no ha pedido a su sistema menos movimiento.
- **`markdown`** se construye en nodos DOM y nunca en HTML, de modo que nada de lo que se escriba en él puede convertirse en marcado ni en un script.
- **`gauge`, `value`, `map`, `setpoint`** muestran «ya no está en este gateway» si su tag se elimina después de guardar el dashboard, en lugar de un dial que nunca se mueve.

## El tablero mural

El tablero mural es el dashboard `wall`, de tipo `wall`. Siempre está ahí, no se puede eliminar y no tiene tarjetas: sus indicadores son los tags fijados en la pantalla Board, guardados en el propio ajuste del tablero donde siempre estuvieron. `GET` y `PUT /api/board`, la dirección `#board`, el selector de fijados y el arrastre para ordenar siguen intactos.

Lo que obtiene por ser un dashboard es el selector (es la primera píldora en cada dashboard y el Board también tiene la barra) y las asignaciones: puede ofrecerse a algunos roles, ser la página de inicio de un rol y ser la de una pantalla física. Un televisor en la pared abre `/?screen=wall-tv` y obtiene el Board sin la cabecera ni las pestañas.

## Roles y pantallas

**Por rol.** `roles` decide a quién se ofrece un dashboard. `homeFor` decide dónde aterriza un rol. Un operador cuya página de inicio es `line-2` abre HotLoop en la Línea 2. Con un fragmento de URL en la dirección (`#alarms`) la página se abre donde dice la dirección.

**Por pantalla.** Una pantalla es un monitor físico. Abra HotLoop en `/?screen=<name>` y muestra el dashboard cuyo `screens` tiene ese nombre, sin cabecera, sin pestañas y con zonas táctiles más grandes, porque quien pasa junto a un PC de panel no tiene uso para una salida de la página. Un nombre que ningún dashboard tiene lo dice en lugar de mostrar otra cosa.

**Un panel identifica a las personas, no a sí mismo.** Sin nadie identificado muestra un solo campo «PIN o tarjeta». Un operador teclea su PIN, o escanea su tarjeta (un lector de tipo teclado la teclea en el campo), y el panel abre el dashboard. Su nombre y un botón **Cerrar sesión** quedan en la esquina, ya que la cabecera que los mostraría no está. Cada escritura que hace un botón de ese dashboard pasa por la puerta de escritura como esa persona, y la pista de auditoría y el libro de registro la nombran: «olga escribió 250 en line-02/Speed», no «panel-3». Tras quince minutos sin que nadie toque la pantalla (un ajuste) el panel cierra su sesión y vuelve al campo, y una escritura enviada después se rechaza. Un administrador da a cada persona un código en **Ajustes, Usuarios**. El conjunto, qué es una tarjeta, cómo se almacena el código y qué no hace, está en [Autenticación y usuarios](/es/iot/authentication/#paneles-de-quiosco-pin-o-credencial-y-cierre-de-sesión-por-inactividad).

En su propio ordenador nada de esto se aplica: usted está identificado con su contraseña, la escritura de un botón pasa directamente por la puerta y lo registra a usted, y no hay cierre de sesión por inactividad. Un panel que se identificó con una cuenta de operador permanente, como había que manejar un panel antes de los PIN, sigue funcionando y sigue escribiendo como esa cuenta. No dé a un panel compartido un acceso así.

Esto es lo que es la HMI de Edge: un dashboard con `screens` establecido, en una máquina que abre esa dirección, con las personas que la usan identificándose por PIN o tarjeta.

## Construir

Quien tiene `dashboards.write` (los administradores) ve **Editar** en un dashboard y **Nuevo dashboard** en la barra. Mientras se edita:

- las tarjetas están inertes, así que agarrar un botón para moverlo no puede pulsarlo;
- arrastre una tarjeta sobre otra para ponerla allí, o use las flechas de su barra de herramientas, que es lo que tiene un teléfono, porque una pantalla táctil no inicia un arrastre;
- arrastre la esquina para cambiar el tamaño: el ancho se ajusta a una columna de doce, el alto a una fila;
- el engranaje edita la tarjeta, el botón de copia la duplica, la cruz la elimina;
- **Ajustes** es el nombre, a quién se ofrece, para quién se abre primero, sus pantallas físicas y su lugar en el selector.

No se guarda nada hasta **Guardar**. **Descartar** tira los cambios. Un `409` al guardar significa que alguien guardó primero: la página ofrece cargar lo suyo.

**Exportar** (junto a Editar) guarda el dashboard en pantalla como un archivo, e **Importar** (en la barra junto a Nuevo dashboard, para quien tiene `dashboards.write`) carga uno en esta instalación, de modo que una pantalla es un dato del cliente y se mueve entre instalaciones sin que nadie la reconstruya. Consulte [Archivos de pantalla](/es/iot/screen-file/).

## Diseño

| Ancho | Columnas | Una tarjeta de `w` ocupa |
|---|---|---|
| Más de 1100 px | 12 | `w` |
| De 700 a 1100 px | 6 | la mitad de `w`, redondeada hacia arriba |
| De 480 a 700 px | 2 | una, o las dos cuando `w` es mayor que 4 |
| Menos de 480 px | 1 | todo |

Las filas miden 76 px con un hueco de 16 px en los diseños anchos. En un teléfono una tarjeta es tan alta como su contenido con un mínimo según sus filas, de modo que nada queda cortado. El selector se desplaza lateralmente dentro de sí mismo y la página nunca lo hace.

## En un teléfono

La interfaz web se instala en un teléfono y se abre sin conexión. Es la misma página con un manifiesto, iconos y un service worker, servida por el propio HotLoop, así que no hay nada que construir ni nada que instalar en el servidor.

**Instalarla.** En Android, el menú de Chrome tiene **Instalar aplicación**. En un iPhone, la hoja Compartir de Safari tiene **Añadir a pantalla de inicio**. Se abre a pantalla completa, con el nombre de la planta, y en Android una pulsación larga en su icono ofrece Alarmas y Dashboards. Un navegador solo instala una página y ejecuta un service worker sobre **https**, o en `localhost`. En la dirección `http://` simple de una planta HotLoop se sigue abriendo en una pestaña exactamente como siempre, pero no se puede instalar y no funcionará sin conexión. Ponga un certificado delante para los teléfonos (el ingress o el proxy inverso que ya tenga). El navegador le dice por qué no se instala: herramientas de desarrollo de Chrome, Aplicación, Manifiesto.

**Lo que conserva.** La propia página y la última respuesta a las lecturas que mira una persona: la lista de alarmas, los dashboards, las lecturas y estados de entidades, los dispositivos y tags, el estado, el árbol de equipos y el board. Mientras la página está abierta y conectada los pide una vez por minuto para que haya algo que abrir, y no mientras el teléfono está en el bolsillo. Ábrala sin conexión y la página carga, la lista de alarmas y los dashboards muestran lo que el teléfono vio por última vez, y una barra en la parte inferior lo dice, con la hora:

```
Offline. This is what this phone last saw as of 10/22/2026, 05:42:23. Nothing you
do here is sent until the connection is back.
```

Cuando vuelve la conexión, en pocos segundos, la barra desaparece, la pantalla se actualiza con respuestas en vivo y la transmisión en vivo se reconecta.

**Sin conexión y sin haber iniciado sesión.** Un teléfono que tiene la aplicación pero no tiene la sesión iniciada (nunca la tuvo, o la cerró, lo que vacía lo que guardó) no tiene nada que mostrar sin conexión, así que muestra la pantalla de inicio de sesión y dice por qué: HotLoop no responde desde aquí, y sigue intentándolo. En el momento en que HotLoop responde, la página se recarga sola en el inicio de sesión real. Nunca muestra una aplicación vacía.

**Lo que nunca hace.** Nada que cambie algo se envía desde una página sin conexión. Una escritura, sea un valor a un tag, un script, una receta o una confirmación, se rechaza antes de salir de la página, con el motivo:

```
You are offline, so nothing was sent. Everything here is as of 10/22/2026, 05:42:23.
Try again when the connection is back.
```

El service worker no responde, conserva ni encola una escritura, y no tiene sincronización en segundo plano. Una orden a un equipo solo la envía una persona que mira una respuesta en vivo, y un botón pulsado sin conexión no está esperando en algún sitio para salir más tarde. Confirmar desde una notificación es otra cosa y necesita la red igualmente: la aplicación ntfy pulsa su propio botón.

**Lo que no conserva.** La transmisión en vivo, las tendencias y el historial, el libro de registro, los ajustes, los usuarios, la política de escalado y cualquier cosa sobre notificaciones. Algunas son demasiado grandes y distintas cada vez para que valga la pena conservarlas, y otras contienen cosas (los temas ntfy de las personas, las cuentas) que no pertenecen a la caché de un teléfono, así que esas pantallas necesitan que HotLoop responda.

**En el teléfono.** Lo que se conserva vive en el almacenamiento de caché del navegador de ese teléfono, como máximo 200 respuestas, descartando primero las más antiguas. **Cerrar sesión lo vacía**, y también lo hace una sesión que ha caducado o se ha revocado (el primer `401` lo vacía). Solo se conserva una sesión iniciada, de modo que un teléfono sin conexión nunca se abre con los datos de otra persona. Una versión nueva de HotLoop obtiene una caché de páginas propia y se elimina la antigua; la página se pide en vivo siempre que hay conexión, así que una versión nueva o una planta renombrada aparece en la siguiente apertura.

La misma prueba quita el servidor, para la página y el worker por igual, y recarga: la página se abre, la lista de alarmas y un dashboard muestran lo que se conservó, una escritura a un tag y una confirmación se rechazan las dos, la alarma sigue sin confirmar y la auditoría de escrituras vacía cuando vuelve la conexión, y cerrar sesión vacía lo conservado. Se ejecutó en hardware real (2026-11-17), incluida la instalación en un teléfono real, Safari en un iPhone, y la caída del Wi-Fi de una planta real.

## Permisos

| Permiso | Visor | Operador | Administrador |
|---|---|---|---|
| `dashboards.read` | sí | sí | sí |
| `dashboards.write` | no | no | sí |

Leer es de todos los roles, filtrado por `roles`. Escribir es del administrador. Lo que puede hacer una tarjeta al pulsarla son los permisos de la persona que la pulsa: un visor ve desactivado un botón de escritura, y el servidor lo rechazaría si pasara de eso.

## La API

| Método | Ruta | Permiso |
|---|---|---|
| `GET` | `/api/dashboards` | `dashboards.read` |
| `POST` | `/api/dashboards` | `dashboards.write` |
| `GET` | `/api/dashboards/{id}` | `dashboards.read` |
| `PUT` | `/api/dashboards/{id}` | `dashboards.write` |
| `DELETE` | `/api/dashboards/{id}` | `dashboards.write` |
| `GET` | `/api/dashboards/{id}/export` | `dashboards.read` |
| `POST` | `/api/dashboards/import` | `dashboards.write` |

La referencia con cuerpos y errores está en [la API HTTP](/es/iot/api/#paneles). Cada creación, guardado y eliminación queda registrada como un evento `config` sobre el sujeto `dashboard:<id>`, así que el libro de registro dice quién cambió lo que muestra un panel.

La tabla es `dashboards`, añadida en la migración 0023 para PostgreSQL, TimescaleDB y SQLite. Solo añade ([Las migraciones solo añaden](/es/iot/migrations/)). La fila del tablero mural la crea la aplicación la primera vez que se le pide, no la migración, de modo que una base de datos restaurada desde una copia anterior a los dashboards la vuelve a tener.

## Lo que no hay

- **Diseños exactos al píxel.** A propósito, arriba. Si la HMI de una máquina necesita de verdad un control en un lugar fijo, eso es una pantalla construida para esa máquina, y no es lo que es esto.
- **Visibilidad por tarjeta.** Un dashboard se ofrece a roles; una tarjeta no. Dos audiencias con tarjetas distintas son dos dashboards.
- **Un mapa de teselas.** Consulte la tarjeta `map`.
- **Mantener un botón pulsado.** Un botón escribe una vez al pulsarlo. Un control momentáneo que escribe al pulsar y otra vez al soltar es una tarjeta distinta y no está construida.
- **Dashboards en el Edge Relay.** No tiene interfaz.
