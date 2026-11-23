---
title: "Notas de versión: HotLoop Flow 2.1.0"
description: "Qué trae HotLoop Flow 2.1.0, qué cambia al actualizar y qué conviene leer antes de tocar una planta en marcha."
sidebar:
  label: "2.1.0"
---

HotLoop Flow 2.1.0 son las fases 0 a 2 de la [hoja de ruta](/es/flow/roadmap/) más las carencias de cada día que impedían poner un flujo real en producción. Cada despliegue es ahora un registro que puede comparar, probar, revisar y restaurar. Un flujo puede tener pruebas que se ejecutan antes de que llegue un mal despliegue. Un guardado reinicia los nodos que cambió y deja en paz el resto de la planta.

Nada en esta versión cambia cómo se lee o se escribe un archivo de flujos. El viaje de ida y vuelta byte por byte no se toca, así que un `flows.json` que funcionaba en la 2.0.5 funciona en la 2.1.0.

## Novedades

**Despliegues**
- Cada despliegue es un registro: quién, desde dónde, cuándo, la nota, la revisión que sustituyó, el archivo de flujos byte por byte y las credenciales cifradas tal como estaban. `GET /deployments` los lee. `history.retain` conserva los últimos 100 por defecto.
- Una comparación que se lee como una revisión: nodo por nodo, propiedad por propiedad, con el diseño separado de la lógica y sin mostrar nunca las credenciales. En la API, en la línea de comandos (`hotloop-flow diff`) y como controlador de diff del propio git.
- La restauración devuelve un registro antiguo como un despliegue nuevo, con flujos y credenciales juntos, de modo que un nodo eliminado vuelve con la contraseña de su broker.
- Despliegue parcial: un guardado reinicia los nodos que cambiaron. Las sesiones MQTT, los oyentes y las colas de Delay de todo lo demás siguen funcionando. `HotLoop-Flow-Deployment-Type` (o la cabecera de Node-RED) elige nodos, flujos o completo.
- El editor revisa antes de desplegar, con la comparación dibujada sobre el lienzo y una nota, y muestra el historial con un botón de restauración.
- Flujos como código: `hotloop-flow deploy` imprime la diferencia con lo que está en marcha y despliega sobre la revisión de la que partió, de modo que una carrera es una canalización en rojo. `hotloop-flow export` devuelve el archivo en vivo byte por byte. `hotloop-flow token` crea un token de API y el hash que hay que configurar para él.
- Espejo git opcional: con `history.git` configurado, cada despliegue es un commit firmado por quien lo hizo.

**Pruebas**
- Pruebas de flujos: `flows.test.yaml` junto a `flows.json`, ejecutado por `hotloop-flow test` (JUnit con `-junit`) sobre el runtime real y los nodos reales. Delay, Trigger, Inject, Join y Batch se ejecutan con un reloj que mueve la prueba, así que cinco minutos de Delay son un solo paso. Todo lo que habla con el exterior, MQTT, HTTP, PostgreSQL, InfluxDB, TCP, UDP, WebSocket, archivos, exec, se sustituye, y la prueba comprueba lo que habría salido.
- La puerta de despliegue: active `tests.gate` y un despliegue cuyos flujos fallan la batería es un 422 con el informe completo. Las restauraciones no pasan por la puerta, porque una restauración es la salida.
- El editor convierte un mensaje de depuración en una prueba y la ejecuta.

**Nodos y protocolos**
- JSONata, probado con la suite publicada de jsonata-js 2.2.2: pasan 1673 de 1686 casos, y los 13 que no pasan están fijados por nombre con su motivo.
- Inject se dispara con un crontab, en el mismo minuto que lo haría Node-RED, con los cambios de hora de seis zonas comprobados.
- MQTT 5 (propiedades, opciones de suscripción, caducidad de sesión) y el último testamento. MQTT 3.1.1 sigue funcionando.
- TLS en TCP, en la petición HTTP y en MQTT mediante un nodo `tls-config`. El oyente y el cliente WebSocket arrancan, y el cliente usa TLS.
- Cookies y multipart en HTTP, comprobados con las bibliotecas que usa Node-RED.
- Split, Join y Batch funcionan como los de Node-RED: flujo continuo, tiempos de espera, reducción, intervalos. Link Call y el modo de retorno de Link Out.
- Una contraseña puede vivir en un Secret montado en lugar de en el flujo. El chart de Helm incorpora `secrets.mounts`.

**Inicio de sesión**
- Inicio de sesión en dos pasos (TOTP), gratuito, para cualquiera que lo active desde el editor.
- Bloqueos, sesiones que sobreviven a un reinicio y un registro de auditoría de quién hizo qué y desde dónde (`GET /audit`, `audit.read`).

## Qué cambió

- El bloqueo viene activado por defecto: 5 fallos de una cuenta desde una dirección, o 20 desde una dirección, la bloquea 15 minutos con un 429. `auth.lockout` cambia las cifras.
- Las sesiones se guardan en `data/sessions.json` como hashes y siguen la configuración en cada petición, así que quitar un permiso o un usuario de la configuración surte efecto en la siguiente petición.
- Una restauración es un reinicio completo salvo que pida menos.
- La imagen incluye `LICENSE`, `NOTICE` y `THIRD_PARTY_LICENSES` en `/usr/share/doc/hotloop-flow/`. `THIRD_PARTY_LICENSES` enumera cada módulo de Go y paquete npm del binario con su versión y el texto de su licencia, generado en la compilación. La compilación falla ante una dependencia GPL, AGPL o LGPL o una que nadie pueda identificar.
- `NOTICE` era incorrecto. Decía que aquí no había código de Node-RED. Cron, Split, Join, Batch, Link Call, tls-config y el trabajo de cookies y multipart de HTTP son adaptaciones, y ahora enumera cada archivo adaptado con su procedencia, quién tiene el copyright y la licencia, con el texto completo de ISC para cronosjs y el de MIT para el resto. Cada archivo adaptado lo dice igual en su cabecera.
- Un despliegue rechazado ya no poda credenciales en memoria, y hacer doble clic en un nodo en Chromium abre su diálogo. Ambos fallos se encontraron al construir esto.

## Notas de actualización

Desde la 2.0.5 basta con cambiar la imagen (`helm upgrade`, o la nueva etiqueta en su unidad Quadlet). Sin migración, sin ninguna opción.

- El primer arranque crea `sessions.json`, `audit.log` y un directorio `deployments` bajo `data.dir`. Antes las sesiones estaban en memoria, así que todos inician sesión una vez tras la actualización.
- Todo lo nuevo de la configuración es opcional y está desactivado o es inofensivo por defecto. Nada de lo que tiene deja de funcionar.
- Tokens de WebSocket: el editor ahora envía su token como subprotocolo, `hotloop-flow.bearer.<token>`, ofrecido junto a `hotloop-flow`. Es la forma preferida para cualquier cosa que se conecte a `/comms`. Un script que envíe `?access_token=` en la URL sigue funcionando, y el servidor registra una advertencia por cada conexión así, explicando que se filtra en los registros de proxies y de acceso y qué enviar en su lugar. La URL nunca se escribe en el registro de Flow ni en la auditoría. Retirar la forma con URL espera a una versión mayor futura.

## Ajustes nuevos

| YAML | Entorno | Por defecto |
|---|---|---|
| `tests.gate` | `HOTLOOP_FLOW_TESTS_GATE` | `false`. `true` rechaza un despliegue cuyos flujos fallan `flows.test.yaml`. |
| `tests.timeout` | | `2m`, el tiempo máximo de reloj de una ejecución de las pruebas. Una ejecución que no puede terminar rechaza el despliegue. |
| `secrets.allowedPaths` | `HOTLOOP_FLOW_SECRET_ALLOWED_PATHS` | vacío. Árboles adicionales desde los que se puede leer un `tls-config` o un archivo de credenciales, además de `data.dir`. No es el ámbito de los nodos de archivo: un nodo File In sigue sin poder leerlos. |
| `secrets.mounts` (chart) | | vacío. Secrets de Kubernetes montados en solo lectura, cada uno añadido al ámbito de secretos. |
| `auth.tokens` | `HOTLOOP_FLOW_DEPLOY_TOKEN_HASH` | ninguno. Tokens de API para máquinas, guardados como hashes. La variable de entorno crea un token `deploy` que puede leer y desplegar y nada más. Cree uno con `hotloop-flow token`. |
| `auth.lockout` | | `attempts: 5`, `perAddress: 20`, `window: 15m`, `duration: 15m` |
| `history.retain` | | `100`. `0` conserva todos los registros. |
| `history.git` | `HOTLOOP_FLOW_GIT_URL`, `HOTLOOP_FLOW_GIT_USERNAME`, `HOTLOOP_FLOW_GIT_PASSWORD` | desactivado. |
| `audit.maxBytes`, `audit.keep` | | 16 MiB, 4 archivos. |

Imagen: `ghcr.io/hotloop-io/hotloop-flow:2.1.0`, linux/amd64 y linux/arm64. Chart: `https://hotloop.io/hotloop-flow/`. El README de esta etiqueta tiene el resto: https://github.com/HotLoop-io/hotloop-flow/blob/v2.1.0/README.md
