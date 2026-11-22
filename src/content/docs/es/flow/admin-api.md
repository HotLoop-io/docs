---
title: "La API de administración"
description: "Las llamadas HTTP y websocket que usan el editor y la línea de comandos, lo que necesita cada una y lo que devuelve."
---

| Método y ruta | Permiso | Notas |
|---|---|---|
| `GET /health` | ninguno | Vitalidad. El kubelet no lleva token, y exigir autenticación en esta ruta reiniciaría el pod en bucle para siempre. |
| `GET /ready` | ninguno | Disponibilidad, informada por separado, de modo que un entorno de ejecución que no pudo arrancar deja el Service sin que el kubelet mate el pod. |
| `POST /auth/token` | ninguno | Iniciar sesión. Un 429 con `Retry-After` mientras hay bloqueo. |
| `POST /auth/revoke` | ninguno | Cerrar sesión. |
| `GET /auth/mode` | sin inicio de sesión | Si este entorno de ejecución se abre desde el panel de EmberCORE: `{"dashboard": bool, "hideLogin": bool}`. El editor lo pregunta antes de que nadie haya iniciado sesión. |
| `GET /auth/mfa`, `POST /auth/mfa/setup`, `/confirm`, `/disable` | un usuario con sesión iniciada | Su propio inicio de sesión en dos pasos. Setup devuelve la clave, el enlace `otpauth://` y el código QR. Confirm y disable reciben `{"code": ...}`. |
| `POST /auth/mfa/reset` | `auth.admin` | Desactiva el inicio de sesión en dos pasos de otra persona: `{"username": ...}`. |
| `GET /metrics` | ninguno | Prometheus. Solo recuentos e ids de nodo, nunca el contenido de los mensajes ni la configuración. |
| `GET /settings` | `settings.read` | |
| `GET /nodes` | `nodes.read` | El registro, que es lo que alimenta la paleta del editor y sus diálogos. |
| `GET /plugins` | `nodes.read` | Los plugins que se cargaron, lo que pide cada uno y lo que se le ha concedido, y los que se rechazaron con el motivo. |
| `GET /flows` | `flows.read` | |
| `GET /flows/export` | `flows.read` | El archivo de flujos exactamente como está en disco, para git. |
| `POST /flows` | `flows.write` | Desplegar. Acepta una nota opcional para el registro de despliegues. |
| `GET /deployments` | `flows.read` | El registro de despliegues, del más nuevo al más antiguo, sin las cargas. `?limit=N` lo acota. |
| `GET /audit` | `audit.read` | Quién hizo qué y desde dónde, del más nuevo al más antiguo. `?event=`, `?user=`, `?since=`, `?limit=`. |
| `GET /deployments/{seq}` | `flows.read` | Un registro, con sus flujos analizados. Nunca sus credenciales. |
| `GET /deployments/{seq}/flows` | `flows.read` | El archivo de flujos de ese despliegue, byte por byte. |
| `GET /deployments/{from}/diff/{to}` | `flows.read` | Diferencia nodo por nodo entre dos despliegues, estructurada y como texto. |
| `POST /flows/diff` | `flows.read` | La diferencia entre lo que está en vivo y el documento del cuerpo. No despliega nada. |
| `POST /flows/types` | `flows.read` | La comprobación de cables tipados que hace un despliegue, sobre el documento del cuerpo: `{"wires": [...]}`, vacío cuando no hay nada mal. El editor dibuja la respuesta. No despliega nada. |
| `POST /deployments/{seq}/rollback` | `flows.write` | Vuelve a desplegar los flujos y credenciales de ese registro como un despliegue nuevo. Acepta la cabecera rev y un `{"note": ...}` opcional. |
| `GET /tests` | `flows.read` | El conjunto de pruebas del flujo guardado junto al archivo de flujos, su nombre de archivo y si los despliegues dependen de él. |
| `PUT /tests` | `flows.write` | Reemplaza el conjunto. El cuerpo es el YAML; uno que no se pueda analizar da un 400 con el motivo. |
| `POST /tests/run` | `flows.read` | Ejecuta el conjunto, o `"tests"` del cuerpo, contra `"flows"` del cuerpo o lo que está en ejecución. Devuelve el informe. No despliega nada. |
| `POST /tests/from-debug` | `flows.read` | Redacta una prueba a partir de `{"node", "msgId"}`, un mensaje que mostró un nodo Debug. No guarda nada. |
| `POST /tests/cases` | `flows.write` | Añade las pruebas del cuerpo, un archivo de pruebas propio, al final del conjunto. |
| `GET /traces` | `flows.read` | Las trazas conservadas, de la más nueva a la más antigua, con lo que contiene el búfer y sus límites. `?limit=N`. 404 con `trace.enabled: false`. |
| `GET /traces/find` | `flows.read` | La traza en la que estuvo un mensaje, a partir de `?msgId=` y `?node=`, el id y el nodo Debug que muestra la barra lateral. Devuelve cada salto y el camino hasta el consultado. |
| `GET /traces/{id}` | `flows.read` | Una traza, cada salto con su tiempo y el mensaje tal como se lo entregaron al nodo. |
| `POST /traces/{id}/test` | `flows.read` | Redacta una prueba de flujo a partir de la traza. No guarda nada. |
| `POST /traces/{id}/replay` | `flows.read` | Introduce el mensaje que inició la traza en `"flows"` del cuerpo, o lo que está en ejecución, en un proceso hijo, y devuelve dónde termina frente a dónde terminó. No despliega nada. |
| `GET /runtime/stats` | `status.read` | |
| `POST /inject/{id}` | `inject.write` | Dispara un nodo Inject. |
| `GET /comms` | `status.read` | El websocket de estado y depuración del editor. Envíe el token como el subprotocolo `hotloop-flow.bearer.<token>`, ofrecido junto a `hotloop-flow`. Eso es lo que hace el editor. `?access_token=<token>` en la URL sigue funcionando para los scripts que ya lo usan, y registra una advertencia por cada conexión que lo hace, porque una URL acaba en los registros de proxy y de acceso. |
| `POST /mcp` (y `GET` y `DELETE`, para las revisiones anteriores del protocolo) | `mcp.call` | El [endpoint MCP](/es/flow/mcp/), donde los flujos se sirven como herramientas. Un token de sesión o de API como cualquier otro. Las herramientas que se ofrecen a quien llama, y que puede invocar, son las que alcanzan sus permisos. 403 con la autenticación desactivada. |

`/metrics` y `/health` sin autenticación es una decisión y no un descuido. Un recolector de Prometheus no lleva token de portador, así que exigir uno significa entregar una credencial a su sistema de monitoreo o quedarse sin monitoreo.

Un usuario con el inicio de sesión en dos pasos activado envía `"code"` junto con el usuario y la contraseña a `POST /auth/token`. Sin él, la respuesta es un 401 con `"mfa": "required"`.

Los permisos son `"*"` para todo, una cadena exacta como `flows.read`, o una concesión por prefijo como `flows.*`. Un agente que llama a flujos como herramientas MCP necesita `mcp.call`. Una cuenta de solo lectura para un panel que solo quiere mostrar el estado del flujo es `["flows.read", "status.read"]` y nada más.

Los despliegues aceptan una cabecera opcional `HotLoop-Flow-Deployment-Rev`. Envíe la revisión que leyó por última vez y un despliegue que compite con otro editor se rechaza con un 409 en lugar de sobrescribir en silencio el trabajo de alguien, que es el fallo del que solo se entera quien perdió su tarde.

Un despliegue reinicia solo lo que usted cambió. Un nodo sigue en marcha cuando no se movió nada de lo que lo sostiene: sus ajustes, su pestaña, su grupo, su entorno, sus credenciales y cada nodo de configuración que nombra. Arrastrarlo por el lienzo o volver a conectarlo no cuenta, porque los cables nuevos se montan sobre el nodo en ejecución. Así, corregir una errata en un nodo de función ya no tira todas las sesiones MQTT de la caja, y un nodo Delay que guarda diez minutos de lecturas sigue guardándolas. Esa es toda la razón de que exista: cuando cada guardado reinicia la planta, los operadores dejan de guardar durante un turno y la corrección espera al sábado.

Elija cuánto se reinicia con una cabecera `HotLoop-Flow-Deployment-Type`. El `Node-RED-Deployment-Type` de Node-RED también funciona, así que un script de despliegue que ya tiene obtiene el reinicio que pide.

| Tipo | Qué se reinicia |
|---|---|
| `nodes` (el predeterminado) | Los nodos que cambió, más todo lo que nombra un nodo de configuración que cambió. |
| `flows` | Cada nodo de cualquier flujo que tenga un cambio. |
| `full` | Todo. Igual que reiniciar el proceso. |

La respuesta dice lo que hizo: `type`, `started`, `restarted`, `stopped` y `unchanged`. Nada en tránsito se pierde por el camino. El trabajo ya en cola en un nodo que se reemplaza termina en la instancia anterior, lo que llega durante el cambio espera a la nueva, y un mensaje dirigido a un nodo que borró se cuenta y aparece como un descarte en lugar de desvanecerse.
