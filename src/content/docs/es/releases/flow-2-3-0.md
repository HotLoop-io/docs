---
title: "Notas de versión: HotLoop Flow 2.3.0"
description: "Qué trae HotLoop Flow 2.3.0, qué cambia al actualizar y qué conviene leer antes de tocar una planta en marcha."
sidebar:
  label: "2.3.0"
---

HotLoop Flow 2.3.0 es la versión en la que Flow llega al resto de la planta de tres formas nuevas y detecta un mensaje con forma equivocada antes de que haga daño. Habla con HotLoop, un agente puede llamar a un flujo como herramienta mediante MCP, y un plugin es un archivo WebAssembly firmado y no un paquete npm. JSON Schema ahora comprueba los mensajes en el nodo `json`, en los puertos de un nodo y en las conexiones del editor. Un cambio puede afectar a un flujo que ya funciona, y es lo primero que aparece en Qué cambió.

## Novedades

**Nodos de HotLoop**
- Una conexión `hotloop-flow-hotloop`, que es una URL y una cuenta. Inicia sesión con `POST /api/auth/login`, envía el token de portador que devuelve HotLoop y vuelve a iniciar sesión cuando HotLoop dice que la sesión ya no existe. Una cuenta de operador basta para todo lo que sigue.
- `hotloop in` sigue el flujo en vivo de HotLoop y envía un mensaje por cada entidad que cambia de estado: `msg.topic` es el id de la entidad, `msg.payload` es el nuevo estado y `msg.hotloop` lleva el estado que tenía antes, sus atributos, su calidad y sus marcas de tiempo. Si el enlace se cae, la insignia se pone roja y un solo error llega a un nodo Catch por la caída, no uno por reintento. Cuando vuelve, se envía una entidad que cambió entretanto y no una que no cambió.
- `hotloop state` lee una entidad cuando llega un mensaje. `hotloop script` ejecuta un script de HotLoop con los campos que usted le da. `hotloop recipe` aplica una receta con sus parámetros, y una versión anterior si la pide a propósito. HotLoop comprueba cada campo y parámetro, pasa cada escritura por su puerta de escritura y guarda el registro. Flow envía el motivo `flow:<node id>`, y HotLoop lo anota en su auditoría de escrituras y en su bitácora.
- Una llamada rechazada o fallida llega a un nodo Catch con las palabras de HotLoop y su estado. Nada de lo escrito se deshace, porque esa también es la regla de HotLoop.

**Escrituras a través de la puerta de HotLoop**
- `modbus write`, `opcua write`, `s7 write` y `ethernetip write` tienen dos campos nuevos, **Escribir a través de HotLoop** y **Tag de HotLoop** (`device/tag`). Con un HotLoop elegido, el valor va a la puerta de escritura de HotLoop, que decide en su orden: escrituras activadas, tag armado, valor dentro de rango.
- Una escritura que la puerta rechaza nunca llega al equipo. Un HotLoop al que no se puede llegar también hace fallar la escritura. Nunca recurre a escribir directamente, porque sería una escritura que la puerta nunca vio.
- Se aplican la dirección, el tipo de dato y la escala propios de HotLoop para el tag, así que no se usan la dirección ni el tipo de dato del nodo de Flow. Quitar el HotLoop deja el nodo exactamente como estaba. La puerta acepta un booleano, un número o un texto por escritura, así que una lista de registros se rechaza con un mensaje que lo dice.

**MCP, en ambos sentidos**
- `mcp tool` y `mcp result` sirven un flujo como herramienta. El nodo de herramienta declara un nombre, una descripción y un esquema de entrada, Flow lo sirve en `/mcp` y el nodo de resultado devuelve la respuesta del flujo. Un agente inicia sesión con una sesión o un token de API como cualquier otro, la llamada se ejecuta con los permisos de ese token y cada llamada y rechazo queda en el registro de auditoría con el nombre de quien llama. Sin token, no hay llamada.
- `mcp client`, sobre una conexión `hotloop-flow-mcp-server`, llama a una herramienta de cualquier servidor MCP, incluido el propio de HotLoop, y usa lo que devuelve. Nunca envía una llamada dos veces, porque una herramienta puede mover equipos y una conexión caída no dice si se ejecutó.
- Un token de API en `auth.tokens` puede llevar un `rateLimit` con `calls` y una ventana, de un minuto si no se indica. Una llamada que lo supera nunca llega al flujo, vuelve como un error de herramienta que indica cuándo reintentar y escribe una fila `mcp.refused` con el motivo. Un token sin `rateLimit` nunca se limita.
- Habla la revisión actual de la especificación, 2026-07-28, y las revisiones del protocolo de enlace hasta la 2025-11-25, en el mismo endpoint. Un flujo que no usa ninguno de estos nodos nunca hace una llamada MCP, y Flow no sirve ninguna herramienta que no se le haya dado.

**Plugins sin npm**
- Un plugin es un módulo WebAssembly, un descriptor a partir del cual el editor dibuja su diálogo y una firma ed25519 sobre ambos. Los plugins sin firmar o manipulados se niegan a cargarse y dicen por qué. `hotloop-flow plugin keygen` crea una clave, y `docs/plugins.md` tiene el resto.
- Un invitado que supera su límite de memoria o su tiempo de espera cae en una trampa hacia un nodo Catch mientras todo lo demás sigue funcionando. Un plugin que pide acceso al host que el operador no ha concedido (`clock`, `random`, `context.flow`, `context.global`) hace fallar el despliegue de cualquier flujo que lo use, antes de escribir un solo byte.
- Sin claves de confianza se rechaza todo plugin, y sin permisos falla todo plugin que pida acceso al host. Por defecto no se carga nada.
- El chart lo recoge todo en `plugins`, con un volumen que acepta cualquier origen de volumen de Kubernetes. Desactivado no renderiza nada, y un `helm template` de los valores por defecto es el que era.

**Cables tipados**
- Dé al nodo `json` un JSON Schema en su configuración y cada valor que maneja se comprueba contra él. Un valor que no coincide va a un nodo Catch en lugar de seguir por la conexión, y el error nombra cada campo incorrecto, como `payload.temp: got string, want number`. Sin esquema en la configuración, el nodo valida contra `msg.schema`, como hace el nodo `json` de Node-RED. Es el borrador 2020-12 salvo que el esquema nombre otro, y un `$ref` a otra URL o a un archivo se rechaza, no se descarga.
- Un nodo puede declarar lo que acepta y lo que promete cada salida, en dos claves del archivo de flujos que cualquier otra herramienta ignora, así que un flujo que las lleva sigue haciendo el viaje de ida y vuelta byte por byte. Cuando los dos extremos de una conexión declaran un esquema y ningún mensaje podría satisfacer a ambos, el despliegue se rechaza antes de escribir un solo byte. Las discrepancias que Flow no puede ver de antemano se detienen donde rompen el esquema, van a Catch con la ruta de cada campo incorrecto y se cuentan en `hotloop_flow_node_schema_mismatches_total`.
- Un `inject` que fija un literal que el siguiente nodo nunca puede aceptar, como el número 250 en un nodo que acepta de 0 a 100, se rechaza al desplegar de la misma manera. Las marcas de tiempo, `env`, el contexto y JSONata se omiten, nunca se adivinan.
- El editor escribe el tipo del emisor en cada conexión. Se atenúa cuando solo un extremo tiene tipo y se pone rojo cuando los dos nunca pueden coincidir, y el rojo viene de la propia comprobación del runtime, así que el lienzo y el despliegue no pueden discrepar. La sección **Tipos** del diálogo de un nodo es donde se configuran.

Son nueve tipos de nodo más, 79 en total: cinco para HotLoop con su conexión, y cuatro para MCP con su conexión.

## Qué cambió

- El nodo `json` solía ignorar `msg.schema`. Ahora un mensaje que lleva `msg.schema` se valida contra él y, si no coincide, va a un nodo Catch y no sigue por la conexión. Un flujo que deja un `msg.schema` en sus mensajes por otro motivo lo notará.
- Un despliegue ahora puede rechazarse por una discrepancia de tipos (`deploy.refused`, motivo `typed wires`), pero solo para un flujo que declara esquemas en sus puertos o fija un literal de `inject` en un nodo que declara uno. Un flujo sin esquemas en ninguna parte se comporta exactamente como antes.
- Los nodos de escritura llevan los dos campos nuevos, vacíos por defecto. Sin un HotLoop elegido, un nodo de escritura se comporta como en la 2.2.0.
- El validador de esquemas es `santhosh-tekuri/jsonschema` v6 (de licencia permisiva) y MCP es el SDK de Go, `modelcontextprotocol/go-sdk` v1.8.0. Ambos son módulos de Go nuevos, así que el texto de licencia que la imagen lleva en `/usr/share/doc/hotloop-flow/` tiene más entradas. El runtime de WebAssembly ya estaba en la 2.2.0.
- Tres correcciones de la cola durable. Una conexión durable eliminada ahora rechaza una escritura tardía y la cuenta como descartada, y eliminar una ya no espera todo el tiempo de cierre a un destino atascado en un mensaje. Antes, un mensaje devuelto después de que la conexión desapareciera seguía cargado en la cuota hasta un reinicio. Una conexión que descarta lo más antiguo ya no expulsa un mensaje que ya estaba confirmado o que la bomba acababa de leer, lo que devolvía el mismo espacio dos veces y dejaba la profundidad de la cola y la cuota por debajo de lo que había en disco. El texto sobre la cuota durable en `docs/durable/README.md` ahora dice que un mensaje desviado puede superar la cuota unos pocos mensajes durante un momento.
- El README y `docs/bench/` incluyen los resultados de la Raspberry Pi 5, y la hoja de ruta marca la Pi 5 como hecha y deja abiertas la Pi 4, la Zero 2 W y las escrituras en la tarjeta SD.

## Notas de actualización

Desde la 2.2.0 basta con cambiar la imagen (`helm upgrade`, o la nueva etiqueta en su unidad Quadlet). Sin migración, sin ninguna opción, nada nuevo en el primer arranque. Un `flows.json` y un archivo de configuración que funcionaban en la 2.2.0 funcionan en la 2.3.0, y el viaje de ida y vuelta byte por byte del archivo de flujos no se toca.

- Volver a la 2.2.0 es seguro para cualquier flujo que no use los nodos o claves nuevos. Un nodo de HotLoop, MCP o plugin no arranca en la 2.2.0 (tipo de nodo desconocido), y un nodo de escritura con un HotLoop elegido escribe directamente en su equipo allí, porque la 2.2.0 no lee el campo. Quite el HotLoop de esos nodos de escritura antes de volver atrás.
- HotLoop registra la cuenta con la que Flow inicia sesión. La API no da al cliente forma de nombrar a su propio actor, así que el id del nodo de Flow entra como motivo y la cuenta es la de la conexión. Use una cuenta creada para Flow si quiere encontrar fácilmente sus escrituras.
- MCP es una nueva forma de entrar en Flow, y requiere un token. No se sirve nada hasta que un flujo tiene un nodo `mcp tool`, y una llamada sin token o con uno inventado se rechaza.

## Ajustes nuevos

| YAML | Entorno | Por defecto |
|---|---|---|
| `plugins.dir` | `HOTLOOP_FLOW_PLUGINS_DIR` | vacío, que es `plugins` en `data.dir` |
| `plugins.trustedKeys` | `HOTLOOP_FLOW_PLUGIN_TRUSTED_KEYS` | ninguna. Cada una es `ed25519:<base64>`, una clave pública PEM o un archivo que contenga una. Sin ninguna, se rechaza todo plugin. |
| `plugins.grants` | `HOTLOOP_FLOW_PLUGIN_GRANTS` | ninguno. El nombre de un plugin hacia `clock`, `random`, `context.flow`, `context.global`. La variable es `name=cap,cap;name=cap`. |
| `plugins.maxMemoryMiB` | `HOTLOOP_FLOW_PLUGIN_MAX_MEMORY_MIB` | 64, de 1 a 4095 |
| `plugins.maxTimeout` | `HOTLOOP_FLOW_PLUGIN_MAX_TIMEOUT` | `5s` |
| `auth.tokens[].rateLimit.calls`, `.per` | | 0 llamadas, que es sin límite. `per` es `1m` cuando se indica `calls` y no `per`. |

Las conexiones de HotLoop y MCP se configuran en el editor: URL, cuenta y un tiempo de espera. El chart tiene todos los ajustes de plugins bajo `plugins` en `values.yaml`, con `enabled: false`, y nada más nuevo.

Imagen: `ghcr.io/hotloop-io/hotloop-flow:2.3.0`, linux/amd64 y linux/arm64. Chart: `https://hotloop.io/hotloop-flow/`. El README de esta etiqueta tiene el resto: https://github.com/HotLoop-io/hotloop-flow/blob/v2.3.0/README.md
