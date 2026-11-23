---
title: "Reserva en caliente con concesión"
description: "Dos instalaciones de Flow comparten un trabajo: una concesión en PostgreSQL y una barrera en cada escritura a equipos, así solo una escribe a la vez."
---

Dos instalaciones de Flow pueden compartir el trabajo de una. Una de ellas es la que escribe: es la única que envía algo a los equipos. La otra es la de reserva: ejecuta los mismos flujos, lee, se suscribe y mantiene su contexto caliente, pero retiene toda escritura a equipos hasta que ocupa el lugar de la que escribe. Si la que escribe muere, se cuelga o pierde su enlace, la de reserva toma el relevo en aproximadamente la duración de una concesión, y la que escribía no puede volver a escribir hasta que recupere la concesión.

Esto es para el caso en que un reinicio no es lo bastante rápido y un segundo escritor es peor que una espera corta. Si un reinicio es lo bastante rápido, una sola instalación y una reprogramación de Kubernetes es más sencillo y es lo que hace el chart por defecto.

## Cómo funciona

La concesión es una fila en un PostgreSQL al que ambas instalaciones pueden llegar. La que escribe la renueva cada pocos segundos. La de reserva intenta obtenerla con el mismo ritmo y solo la consigue cuando ha caducado. Cada vez que cambia el titular, el número de barrera de la fila aumenta, y Flow lo informa.

Toda escritura a equipos hace la misma pregunta justo antes de enviar: ¿tengo la concesión, con más tiempo restante del que necesita una escritura? Si no, la escritura se rechaza con un error contabilizado que llega al nodo Catch del flujo, y no se envía nada, ni siquiera una conexión. Esa comprobación, hecha en el momento de cada escritura, es lo que impide que dos instalaciones escriban a la vez:

- El titular cuenta su concesión desde el momento en que la pidió, nunca desde el momento en que llegó la respuesta, así que nunca cree tener más tiempo que la base de datos.
- El titular deja de escribir cuando le queda menos concesión de la que necesita una escritura (`writeMargin`), es decir, antes de que la concesión caduque. La de reserva solo puede tomar la concesión después de que ha caducado. Hay, pues, un hueco, y no un solape.
- Un titular que se congela y se descongela, o que se queda aislado y se reconecta, encuentra su concesión perdida, rechaza sus escrituras y pide la concesión como cualquier otro.
- El reloj de la base de datos decide cuándo termina la concesión, de modo que dos equipos cuyos relojes no coinciden siguen de acuerdo en quién la tiene.

Las escrituras que preguntan son las que pueden dar órdenes a equipos: `modbus write`, `s7 write`, `opcua write` y `ethernetip write`, ya sea directamente o a través de la puerta de escritura de HotLoop, los nodos `hotloop script` y `hotloop recipe`, y en un diagrama de FlowLab la escritura serie, un comando de instrumento que escribe (junto con el propio interruptor de escritura de ese instrumento) y la escritura de HotLoop. Enviar un mensaje a un broker MQTT, a una base de datos o una notificación no tiene barrera: no es una orden a un equipo, y repetirlo es inofensivo donde un setpoint repetido podría no serlo. Una prueba de flujo sustituye al mundo exterior y nunca se retiene.

## Lo que cuesta y lo que no le da

- **El tiempo de relevo** es aproximadamente la duración de la concesión. Con los valores por defecto (concesión de 15 segundos, renovada cada 5 segundos, un margen de 5 segundos) una reserva tomó el relevo 14,7 segundos después de matar al escritor. Con una concesión de 6 segundos, 5,7 segundos. Un escritor que se detiene limpiamente cede la concesión, y la reserva tomó el relevo en 0,35 segundos.
- **Una escritura que tarda más que `writeMargin`** puede sobrevivir a la concesión. Mantenga los tiempos de espera de protocolo de los nodos que escriben por debajo. Una escritura ya en vuelo cuando se congela un proceso ya ha pasado su comprobación y aún puede llegar.
- **Al menos una vez.** Un PLC que aceptó una escritura cuyo acuse se perdió puede ver que el nuevo escritor la envía otra vez. Eso es seguro para un setpoint y no para un pulso o un incremento, así que escriba setpoints, no deltas.
- **Las colas siguen siendo locales.** Los cables duraderos y el contexto están en el disco de cada instalación. Lo que estaba en cola en un escritor que murió no está en la reserva.
- **La base de datos es una dependencia.** Un escritor que no puede llegar a ella no puede renovar, y deja de escribir cuando su concesión se acorta. Ponga la concesión en una base de datos al menos tan disponible como los equipos que protege.

## Configuración

Instale Flow dos veces, como dos releases de Helm o dos unidades de Quadlet, cada una con su propio volumen, y apunte ambas a la misma concesión. Dé a la segunda el mismo archivo de flujos que a la primera y manténgalo ahí con un envío a estaciones ([Envío a las estaciones de un tenant](/es/flow/stations/)), porque Flow no copia flujos entre las dos.

| Ajuste | Entorno | Qué es |
|---|---|---|
| `failover.urlFile` | `HOTLOOP_FLOW_FAILOVER_URL_FILE` | Un archivo con la URL de PostgreSQL de la base de datos de la concesión. Definirlo activa el failover. |
| `failover.name` | `HOTLOOP_FLOW_FAILOVER_NAME` | La concesión. La misma en ambas. Por defecto `flow`. |
| `failover.holder` | `HOTLOOP_FLOW_FAILOVER_HOLDER` | El nombre propio de esta instalación. Tiene que ser distinto en las dos, y por defecto es el nombre del host. |
| `failover.ttl` | `HOTLOOP_FLOW_FAILOVER_TTL` | Cuánto dura una concesión y, por tanto, aproximadamente el tiempo de relevo. Por defecto `15s`. |
| `failover.renewEvery` | `HOTLOOP_FLOW_FAILOVER_RENEW_EVERY` | Con qué frecuencia vuelve a pedirla el titular. Por defecto, un tercio del ttl. |
| `failover.writeMargin` | `HOTLOOP_FLOW_FAILOVER_WRITE_MARGIN` | Cuánta concesión necesita que le quede una escritura. Por defecto `5s`. |

Flow se niega a arrancar cuando los ajustes harían que el titular bajara de su margen entre renovaciones, por ejemplo un margen tan largo como el ttl.

En el chart son `failover.urlSecret` (un Secret cuya clave contiene la URL, montado como archivo y nunca puesto en el ConfigMap), `failover.name`, `failover.ttl`, `failover.renewEvery` y `failover.writeMargin`. Con Quadlet son las variables de entorno anteriores, y la URL es un secreto de Podman montado como archivo:

```ini
Environment=HOTLOOP_FLOW_FAILOVER_URL_FILE=/run/secrets/flow-lease-url
Environment=HOTLOOP_FLOW_FAILOVER_NAME=line3
Secret=hotloop-flow-lease-url,type=mount,target=flow-lease-url
```

## Cómo verlo

- `GET /failover` (y la herramienta MCP `get_failover`) indica si esta instalación está `active`, `standby` o `lost`, quién tiene la concesión, el número de barrera que mantiene y cuántas escrituras ha retenido, según qué estaba escribiendo. Necesita `status.read` y solo existe cuando el failover está configurado.
- El editor muestra un banner en una reserva y en un titular que ha perdido su concesión.
- El endpoint de métricas tiene `hotloop_flow_failover_active`, `hotloop_flow_failover_epoch`, `hotloop_flow_failover_takeovers_total` y `hotloop_flow_failover_refused_total{op}`.
- Ambas instalaciones registran cuándo toman la concesión y cuándo se la quitan.

## Qué está demostrado y qué no

Demostrado con dos procesos reales de Flow contra un PostgreSQL real y un servidor Modbus TCP que registra cada escritura, cada instalación escribiendo un valor etiquetado cada 200 ms: con el escritor muerto en pleno flujo, la reserva tomó el relevo tras una concesión, y ninguna escritura de la reserva llegó antes de la última del escritor ni después de ella (0 y 0); con el escritor congelado más tiempo que la concesión y descongelado, no volvió a escribir; con el escritor detenido limpiamente, la reserva tomó el relevo en 0,35 segundos. Una prueba para cada vía de escritura anterior muestra que la escritura de una reserva o de un titular caducado se rechaza antes de enviar nada, y que la misma escritura se envía cuando la puerta está abierta.

No demostrado: el comportamiento de un PLC real ante una escritura repetida, una conmutación de la base de datos bajo la concesión y una red cortada en una sola dirección. El servidor Modbus es un simulador que habla el protocolo. El failover no se ha probado en un clúster, y los valores del chart y las líneas de Quadlet están renderizados y comprobados, no instalados. Los textos del banner del editor no han tenido revisión de un hablante nativo.
