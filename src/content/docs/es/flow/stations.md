---
title: "Envío a las estaciones de un tenant"
description: "Un archivo de flujos y sus diagramas FlowLab en cada instalación de Flow de un tenant, una a una, con comprobación y reversión si falla."
---

Un tenant de EmberNet puede ejecutar varias instalaciones de HotLoop Flow, una en cada planta o línea. A cada una la llamamos estación. Esta página trata de poner un archivo de flujos, y con él un conjunto de diagramas FlowLab, en todas ellas, comprobar cada una y devolver una estación a su estado anterior si falla.

La versión corta: `hotloop-flow stations push -tenant acme -file flows.json` envía a las estaciones que EmberNet muestra como en ejecución para `acme`, una a una. Si una estación no queda bien después, esa estación vuelve a lo que tenía y el envío se detiene. Si el archivo reiniciara un registrador en marcha, no ocurre nada hasta que usted diga que puede hacerse.

## De dónde salen las estaciones

Nadie escribe una estación a mano. La lista es lo que el panel de EmberNet muestra como en ejecución para el tenant, la misma lista que su página Running Apps: cada aplicación con la etiqueta `hotloop-flow` que está en ejecución y pertenece al tenant. A una estación se llega por su dirección de Flux cuando el panel informa de una, y por su dirección de clúster en caso contrario, así que ejecute el envío desde un lugar donde esa dirección se resuelva.

El tenant se nombra siempre, y un envío es siempre para ese único tenant. Al panel se le consulta con su token del panel, que le limita a los tenants que puede ver, y comprobamos la respuesta otra vez: una fila que llega de cualquier otro tenant se descarta y se cuenta, nunca se usa. Un tenant sin ningún Flow en ejecución responde con un error.

## El comando

```bash
hotloop-flow stations list -tenant acme
hotloop-flow stations push -tenant acme -file flows.json -note "new line 3 logger"
```

La dirección del panel sale de `-dashboard` o de `HOTLOOP_FLOW_DASHBOARD_URL`, y su token de `-dashboard-token-file` o de `HOTLOOP_FLOW_DASHBOARD_TOKEN`. El token que aceptan las estaciones sale de `-token-file` o de `HOTLOOP_FLOW_TOKEN`, como en `hotloop-flow deploy`. Créelo con `hotloop-flow token`, y dé a cada estación ese token como token de API con `flows.read`, `flows.write` y `status.read` (un token de despliegue sencillo solo tiene los dos primeros): la comprobación necesita leer los diagramas de cada estación, y un token de despliegue sencillo no puede. Las estaciones de un mismo tenant aceptan el mismo token.

| Opción | Qué hace |
|---|---|
| `-dry-run` | Planifica todas las estaciones y no cambia ninguna. Muestra qué hay en vivo, qué reiniciaría cada una y cuáles no se pudieron planificar. |
| `-confirm-restart` | Usted acepta que este envío reinicie los registradores en marcha. |
| `-window 02:00-04:00` | Las horas en que se acepta un reinicio por adelantado, en `-window-zone` (un nombre IANA, UTC si se omite). Un envío dentro de la ventana sigue adelante. Puede pasar de medianoche, `22:00-02:00`. |
| `-settle 5s` | Cuánto tiempo tienen los diagramas de una estación para arrancar antes de que la comprobación los dé por no en ejecución. |
| `-json` | El informe en JSON. |

El código de salida 0 es que todas las estaciones están hechas. 3 es que una estación falló y el envío se detuvo. 4 es que el envío espera a que usted acepte los reinicios. 5 son estaciones omitidas porque no respondieron o no se pudieron planificar.

## Qué hace un envío

Primero planifica todas las estaciones sin cambiar ninguna. De cada una lee el archivo de flujos y la revisión en vivo, busca el registro de despliegue al que podría volver, enumera sus diagramas y calcula qué registradores en marcha reiniciaría el archivo. Después, si nada necesita un sí, avanza estación por estación en orden de nombre.

1. **Despliega** el archivo con la revisión que vio el plan, de modo que un despliegue hecho por otra persona entre medias se rechaza en lugar de sobrescribirse. Solo se reinicia lo que cambió. Las credenciales nunca viajan: cada estación conserva sus propias contraseñas, y las escrituras de un instrumento siguen desactivadas hasta que alguien de esa estación las active.
2. **Comprueba.** La estación debe responder con la revisión que deben tener todas las estaciones. La revisión sale del contenido del archivo, de modo que el mismo archivo es la misma revisión en todas partes, y el envío dice cuál es antes de empezar. Todo diagrama del archivo que arranca solo debe estar en la estación, sin problemas, y en ejecución o terminado dentro del tiempo de espera. Un nodo que no arrancó también hace fallar la comprobación.
3. **Una estación que no supera la comprobación vuelve atrás.** Se revierte al despliegue en el que estaba, como un despliegue propio, y se comprueba que está en su revisión anterior. El envío se detiene ahí.

El informe dice qué pasó con cada estación:

| Estado | Significado |
|---|---|
| `done` | Desplegada y con la comprobación superada. |
| `unchanged` | Ya está en esta revisión, y sus diagramas están como deben. |
| `failed` | No desplegada (la estación lo rechazó, u otra persona desplegó entre medias), o ya en esta revisión y no correcta. No se cambió nada. |
| `reverted` | No superó la comprobación y ha vuelto a la revisión que tenía. |
| `revert-failed` | No superó la comprobación y no se pudo devolver. Esta necesita a una persona. |
| `skipped` | Sin tocar. No respondió, o no tiene registro de despliegue de su revisión en vivo, de modo que un envío fallido no se habría podido deshacer allí. Despliegue en ella una vez a mano, o arregle el enlace, y vuelva a enviar. |
| `not-started` | El envío se detuvo antes de esta estación. Está como estaba. |
| `planned` | La respuesta de una simulación. |

Las estaciones omitidas no detienen el envío. Un envío es repetible: una estación que ya está en la revisión es `unchanged`, así que un segundo envío termina solo lo que el primero no hizo.

## Reinicios

Un diagrama que arranca solo es un registrador. Desplegar uno modificado lo reinicia, y uno eliminado se detiene. Un envío que haría eso a un registrador en ejecución se detiene antes de tocar nada, y el informe nombra cada estación y cada registrador. Después, una de tres cosas le deja continuar:

- usted responde sí en el aviso, cuando el comando se ejecuta en un terminal;
- usted pasa `-confirm-restart`;
- la hora está dentro de la ventana que indicó con `-window`.

Nada se reinicia sin una de ellas. Un diagrama que no cambió conserva su ejecución, y uno nuevo simplemente arranca.

## Desde una instancia, y para un agente

Una instancia puede enviar a las estaciones de su propio tenant mediante su API de administración, que es lo que usan las herramientas MCP `list_stations` y `push_to_stations`. Defina los cuatro siguientes, en el archivo de configuración bajo `stations:` o por entorno, y aparecen las rutas `GET /stations` y `POST /stations/push`. Sin ellos no existen.

| Ajuste | Entorno | Qué es |
|---|---|---|
| `stations.dashboardUrl` | `HOTLOOP_FLOW_STATIONS_DASHBOARD_URL` | El panel de EmberNet que conoce las instalaciones del tenant. |
| `stations.tenant` | `HOTLOOP_FLOW_STATIONS_TENANT` | El único tenant para el que esta instancia envía. Una solicitud no puede nombrar otro. |
| `stations.dashboardTokenFile` | `HOTLOOP_FLOW_STATIONS_DASHBOARD_TOKEN_FILE` | Un archivo que contiene el token del panel. |
| `stations.deployTokenFile` | `HOTLOOP_FLOW_STATIONS_DEPLOY_TOKEN_FILE` | Un archivo que contiene el token de despliegue que aceptan las estaciones. |

En el chart son `stations.dashboardUrl`, `stations.tenant`, `stations.dashboardTokenSecret` y `stations.deployTokenSecret`, cada Secret con un solo token y montado como archivo; con Podman y Quadlet son las cuatro variables de entorno y los dos secretos montados de [Despliegue de Flow](/es/flow/deploying/). Defina los cuatro o ninguno: se rechaza un render del chart con algunos, y también un arranque con algunos.

`POST /stations/push` necesita `flows.write` y toma `{flows, note, confirmRestart, window, windowZone, dryRun}`. Si omite `flows`, envía lo que ejecuta esta instancia. Responde con el mismo informe, más `ok`, y un envío queda en el registro de auditoría como `stations.push`. `GET /stations` necesita `flows.read`. Un envío que espera un sí responde con `needsConfirm` en true y no ha cambiado nada: vuelva a enviarlo con `confirmRestart` o una ventana.

## Lo que no está demostrado

La forma de la lista del panel se leyó del panel en vivo para un tenant real. No se ha enviado a las estaciones de un tenant a través de Flux, así que comprobar si la dirección que da el panel es accesible desde donde ejecuta el envío es cosa suya, con `stations list` y un `-dry-run`.
