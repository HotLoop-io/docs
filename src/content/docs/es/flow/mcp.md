---
title: "MCP, en las dos direcciones"
description: "Un agente puede llamar a un flujo como herramienta, y un flujo puede llamar a una herramienta de cualquier servidor MCP, con tres nodos y uno de configuración."
---

Un agente que habla el Model Context Protocol puede llamar a un flujo como herramienta, y un flujo puede llamar a una herramienta de cualquier servidor MCP, incluido el de HotLoop. Lo hacen tres nodos y un nodo de configuración: `mcp tool` y `mcp result` sirven un flujo, y `mcp client`, sobre una conexión `hotloop-flow-mcp-server`, llama hacia fuera. Si solo conecta sensores a paneles, puede saltarse todo esto: un flujo que no usa ninguno de estos nodos nunca hace una llamada MCP, y las únicas herramientas que Flow sirve por su cuenta son las que leen y cambian sus flujos ([más abajo](#las-herramientas-propias-de-flow)).

El protocolo es el del SDK de Go (`github.com/modelcontextprotocol/go-sdk` v1.8.0, con licencia permisiva, con algunos archivos aún bajo MIT mientras el proyecto termina de cambiar de licencia, mantenido por el proyecto MCP). Habla la revisión vigente de la especificación, 2026-07-28, que no tiene negociación inicial y lleva la versión en cada solicitud, y las revisiones con negociación hasta la 2025-11-25, en el mismo endpoint. Cada cliente recibe la que usa al abrir la conexión, así que no hay nada que configurar.

## Flujos como herramientas

Un nodo `mcp tool` declara una herramienta: un nombre, una descripción para el modelo que la lee y un esquema de entrada. Mientras el flujo está desplegado, Flow la sirve en `/mcp` (bajo la raíz de administración, si la movió). Una llamada se convierte en un mensaje que sale del nodo: `msg.payload` son los argumentos de la llamada, `msg.topic` es el nombre de la herramienta y `msg.mcp` contiene `tool`, `caller` y `callId`. Un nodo `mcp result` más adelante en el flujo devuelve la respuesta, igual que `http response` responde a `http in`. Todo lo que hay entre ambos es un flujo como cualquier otro.

```json
[
  {"id": "t1", "type": "tab", "label": "Line"},
  {"id": "tool", "type": "mcp tool", "z": "t1", "toolName": "line_status",
   "description": "Status of a production line: its state and speed.",
   "schema": "{\"type\":\"object\",\"properties\":{\"line\":{\"type\":\"string\",\"enum\":[\"L1\",\"L2\",\"L3\"]}},\"required\":[\"line\"],\"additionalProperties\":false}",
   "x": 100, "y": 100, "wires": [["status"]]},
  {"id": "status", "type": "function", "z": "t1", "name": "status", "outputs": 1,
   "func": "msg.payload = {line: msg.payload.line, state: 'running', askedBy: msg.mcp.caller};\nreturn msg;",
   "x": 300, "y": 100, "wires": [["answer"]]},
  {"id": "answer", "type": "mcp result", "z": "t1", "x": 500, "y": 100, "wires": []}
]
```

**El esquema se comprueba antes de que el flujo se ejecute.** Es JSON Schema, leído como lo lee el nodo `json` (borrador 2020-12 salvo que el esquema indique otro, y un `$ref` a otra URL es un error). Un esquema no válido, una raíz que no es un objeto, un nombre de herramienta que MCP no permite o dos nodos que sirven el mismo nombre hacen fallar el despliegue de ese nodo, con el motivo. Una llamada cuyos argumentos no encajan recibe como respuesta un error de herramienta que nombra el campo incorrecto, `arguments.line: value must be one of "L1", "L2", "L3"`, para que el modelo lo corrija y lo intente de nuevo, y el flujo nunca llega a verlo. Un payload de tipo objeto vuelve como objeto y como su texto JSON, el texto vuelve como texto, y un `mcp result` alimentado por un nodo Catch, o con "The work failed" marcado, responde con un error de herramienta con las palabras del propio error. Si nada responde a una llamada, se le avisa al terminar el tiempo de espera de respuesta, 30 segundos si no indica otro, y el error va a un nodo Catch. Un nuevo despliegue espera a las llamadas en curso.

**Un agente es un llamador como cualquier otro.** `/mcp` acepta los mismos tokens que la API de administración, un token de sesión o un token de API, y nada más. No existe la llamada anónima: sin token es un 401, un token que Flow no conoce es un 401, y un token sin el permiso `mcp.call` es un 403, antes de que el protocolo vea la solicitud. Una instancia que se ejecuta con `HOTLOOP_FLOW_INSECURE` responde 403 a cada solicitud a `/mcp`, porque una llamada a una herramienta necesita un llamador que registrar en el registro de auditoría. El token de un agente es un token como cualquier otro:

```yaml
auth:
  tokens:
    - name: agent
      hash: sha256:...          # from: hotloop-flow token -name agent
      permissions: ["mcp.call"]
      rateLimit: {calls: 60, per: 1m}   # optional; no rateLimit, no limit
```

La llamada se ejecuta con los derechos de esa identidad. Todo llamador necesita `mcp.call` (o `mcp.*`, o `*`). Si escribe otro permiso en el cuadro "Extra permission" de una herramienta, por ejemplo `mcp.line3`, el llamador necesita también ese, y sin él ni siquiera ve la herramienta en la lista. Dos agentes pueden compartir un Flow y ver herramientas distintas.

**Un token puede limitarse a un número de llamadas.** `rateLimit` en un token de API de `auth.tokens` es `calls` dentro de una ventana, `per`, un minuto si lo omite. La ventana empieza con la primera llamada del token, una llamada por encima del número se rechaza hasta que la ventana termina, y entonces el recuento empieza de nuevo. Una llamada rechazada nunca llega al flujo y recibe un error de herramienta que indica cuántos segundos esperar, de modo que a un agente atrapado en un bucle se le dice que vaya más despacio con palabras que entiende. La especificación no nombra ningún error para esto, así que se usa el error de herramienta que ya define para una llamada que no puede hacerse. Un token sin `rateLimit` nunca se frena, y un token de sesión tampoco se limita, porque es de una persona. Cada token cuenta por separado, y el recuento vive en memoria, de modo que un reinicio lo empieza de cero. Un rechazo es una fila `mcp.refused` con el motivo `rate limit exceeded`, así que una avalancha de llamadas también queda en el registro de auditoría.

**Cada llamada queda en el registro de auditoría, con el nombre del llamador.** `mcp.call` se escribe antes de que el flujo se ejecute, con la herramienta, el nodo y un id de llamada, y `mcp.result` después, con el resultado y los milisegundos. `mcp.refused` es un token incorrecto, uno que carece del permiso, una herramienta que no puede llamar o argumentos que no encajaban. Los argumentos en sí nunca se escriben. Una solicitud sin ningún token tampoco se escribe, porque no hay nadie al otro lado a quien nombrar. `GET /audit?event=mcp.` lee todo eso, y `?user=token:agent` lo acota a un solo agente.

Pruébelo con el inspector del propio proyecto MCP, que no necesita nada de Flow:

```bash
npx @modelcontextprotocol/inspector@2.12.0 --cli http://localhost:1880/mcp \
  --transport http --header "Authorization: Bearer $TOKEN" \
  --method tools/call --tool-name line_status --tool-arg line=L3
```

Una prueba de flujo coloca el mensaje que habría producido una llamada donde está el nodo `mcp tool`, y `mcp result` entrega a la prueba lo que habría respondido como `{isError, text, structuredContent}`, de modo que el flujo se prueba sin servidor.

## Las herramientas propias de Flow

Un agente que solo pudiera llamar a lo que el autor de un flujo cableó no podría ver los flujos ni cambiarlos, así que Flow sirve 45 herramientas propias en el mismo `/mcp`, junto a las de los flujos. Leen y escriben. Siete tratan de los flujos, en la tabla de abajo, y el resto son las demás rutas de la API de administración: los ajustes, la paleta, el registro de auditoría, el detalle y las diferencias de los despliegues, la exportación, las pruebas de flujo, las trazas de mensajes, las cifras del entorno de ejecución, el restablecimiento del segundo factor, y los diagramas y los instrumentos: listar y leer un diagrama, ejecutarlo y detenerlo, manejar su depurador, fijar un control de su panel y activar o desactivar las escrituras de un instrumento. La página de MCP tiene cada herramienta, su ruta y su permiso, y las pocas rutas que no son herramientas y por qué.

| Herramienta | Qué hace | Permiso |
|---|---|---|
| `list_flows` | cada pestaña y subflujo: id, etiqueta, desactivado, número de nodos y la revisión | `flows.read` |
| `get_flows` | todo el conjunto desplegado tal como lo lee el editor, con la revisión | `flows.read` |
| `get_flow` | una pestaña o subflujo con sus nodos, por id | `flows.read` |
| `deploy_flows` | **deploy**: sustituye todo el conjunto, con la revisión que leyó y una nota | `flows.write` |
| `list_deployments` | el historial de despliegues, del más reciente al más antiguo | `flows.read` |
| `rollback_deployment` | **roll back** a un despliegue anterior, como uno nuevo | `flows.write` |
| `inject_node` | **press** de un nodo inject, con un mensaje propio | `inject.write` |

Ninguna es una segunda implementación. Cada una ejecuta el propio manejador de la API de administración para el mismo trabajo, como el llamador que el endpoint autenticó, así que un despliegue se encuentra con todo lo que encuentra un despliegue desde el editor: el documento tiene que analizarse, la revisión tiene que ser la actual (una vacía sobrescribe a propósito), se rechazan los cables que no coinciden en lo que viaja por ellos, se rechazan los plugins no permitidos, y las pruebas de flujo que fallan rechazan el despliegue, cada una con las palabras de la propia ruta. El historial de despliegues registra al llamador y la nota, y el registro de auditoría tiene la fila `deploy` o `inject` con el nombre del llamador, además de las filas `mcp.call` y `mcp.result` que deja cada llamada a una herramienta. Un llamador necesita `mcp.call` y el permiso propio de la herramienta, y una herramienta que no puede llamar no aparece en su lista. Las herramientas siguen ahí tras un despliegue, que solo retira las herramientas de los flujos, y un flujo no puede servir ninguno de sus nombres.

`deploy_flows` sustituye todo el conjunto, así que un agente lee primero `get_flows` y lo devuelve modificado, con el `rev` que recibió.

## Llamar a herramientas de otros servidores

Un nodo `mcp client` llama a una herramienta cuando llega un mensaje, sobre una conexión `hotloop-flow-mcp-server`: la dirección MCP del servidor, un token de portador si lo pide y un tiempo de espera. La herramienta y sus argumentos son entradas con tipo, así que cualquiera de los dos puede venir del mensaje. `msg.payload` es la respuesta estructurada de la herramienta cuando la tiene, el texto cuando todo lo que dijo era texto, y el contenido tal como llegó cuando era cualquier otra cosa, y `msg.mcp` contiene el servidor, la herramienta y la respuesta completa. La otra operación, "List the tools", pone en `msg.payload` todas las herramientas del servidor con su descripción y su esquema de entrada.

Una herramienta que informa de un error lo lanza, con las palabras del servidor, de modo que un nodo Catch ve lo que habría visto el modelo. **Una llamada nunca se envía dos veces.** Una herramienta puede mover equipos, y una conexión caída no dice si el servidor la ejecutó, así que el error dice que la conexión falló y el siguiente mensaje vuelve a conectar. El token va a la dirección que indicó y a ningún otro sitio, no se sigue ninguna redirección, y un error nunca lo repite. La conexión confía en las raíces de certificados del sistema y en nada más.

Para HotLoop es la dirección de su `/mcp` y el `mcp-token` del Secret de su versión, y están ahí todas las herramientas de la documentación MCP de HotLoop:

```json
{"id": "plant", "type": "mcp client", "z": "t1", "server": "hotloop",
 "tool": "get_plant_status", "toolType": "str", "arguments": "{}", "argumentsType": "json",
 "x": 300, "y": 100, "wires": [["use"]]}
```

HotLoop ve la llamada como la de un cliente MCP, bajo sus propias reglas: MCP lee y escribe, por la misma puerta que todos los demás, así que un `write_tag` sobre una etiqueta armada y dentro de rango se ejecuta (una vez activadas las escrituras del propio HotLoop) y uno que rechaza, una etiqueta que nadie marcó como escribible, por ejemplo, vuelve como el error del nodo con las palabras de HotLoop. Para escribir por la puerta de HotLoop desde un flujo sin MCP, use los nodos de HotLoop de más arriba.

## Contra qué se probó

**El servidor** se prueba con el propio cliente del SDK de Go sobre HTTP real, en las dos épocas: listar, llamar, argumentos rechazados, un permiso rechazado, un token rechazado, las filas de auditoría, una herramienta que desaparece cuando su nodo se detiene, y todo el servidor de administración delante con tokens reales de API y de sesión y el registro de auditoría en disco. La CLI del Inspector del proyecto MCP 2.12.0 listó las herramientas de un Flow en marcha, las llamó, y fue rechazada sin token y con uno inventado. El nodo `mcp client` se ejecutó contra un HotLoop 4.18.10 real (la imagen IoT publicada): listó sus 27 herramientas, llamó a `get_plant_status`, `list_devices` y `get_states` y usó las respuestas, fue rechazado con un token incorrecto y sin ninguno, recibió el error propio de HotLoop por una herramienta que no existe y por una escritura que MCP no puede hacer, y una herramienta de Flow llamada por el Inspector ejecutó un flujo que llamó al MCP de HotLoop y respondió con lo que este dijo.

**No hecho:** OAuth (un token de portador es la única vía de entrada, en ambos sentidos), servidores stdio, recursos, prompts, muestreo, elicitación y notificaciones de progreso, y el esquema de salida de una herramienta. HotLoop 4.18.10 habla las revisiones con negociación inicial, así que el nodo lo atiende de ese modo; contra un servidor de la revisión actual solo se prueba con el propio de Flow. Un servidor con negociación que olvida una sesión (un reinicio) hace fallar la primera llamada posterior, una vez, y la siguiente vuelve a conectar. El límite de llamadas es por token de API y está desactivado hasta que lo establezca, así que un token sin `rateLimit` solo está acotado por las colas, que ya tienen un techo, y por el tamaño de la solicitud, 4 MiB.
