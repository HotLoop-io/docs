---
title: "Almacenar y reenviar en HotLoop Flow"
description: "Marque un cable como duradero y los mensajes van al disco, en orden, cuando el nodo de detrás deja de responder, y sobreviven a un kill -9."
---

Marque un cable como duradero y, mientras el nodo del otro extremo sigue el ritmo, es un cable corriente y no escribe nada en disco. En cuanto ese nodo deja de aceptar mensajes, el cable los vuelca al mismo archivo SQLite antes de que el emisor continúe, y una bomba los entrega del más antiguo al más reciente hasta que el destino acepta cada uno, en lotes de hasta 256 si el destino escribe en una base de datos de una sola vez (InfluxDB lo hace), y de uno en uno para el resto. Así, el historiador se cae, las lecturas se acumulan en disco en lugar de bloquear el flujo o perderse, y entran, en orden, cuando vuelve. El precio de no escribir nada mientras todo está sano es que un `kill -9` pierde entonces lo que estaba en memoria, el equivalente a una consulta, y preferimos decirlo aquí a que lo descubra usted.

```json
{ "id": "count", "type": "function", "ew_durable": ["influx"], "wires": [["influx", "reply"]] }
```

No tiene que escribir la clave a mano. Haga doble clic en el cable en el editor y marque *Durable*.

Sobrevive a un reinicio, mantiene el orden, respeta una cuota de disco (256 MiB por defecto, y la política de desbordamiento del nodo del otro extremo decide qué cede cuando se llena) y muestra su profundidad como `hotloop_flow_durable_wire_depth`. Es al menos una vez, no exactamente una vez, y preferimos decírselo aquí a que lo descubra en un análisis posterior: las palabras exactas, y cómo `influxdb out` sigue siendo correcto igualmente, están en [docs/durable](/es/flow/durable-state/).

La prueba es `docs/durable/store-and-forward.sh`: un InfluxDB 2.9.1 real en Podman con veinte lecturas por segundo, detenido durante diez minutos y repuesto, con el runtime terminado con `kill -9` una vez a mitad de la caída y otra a mitad del vaciado. 15,982 lecturas aceptadas, 15,982 filas almacenadas, ninguna perdida, ninguna duplicada. Un cable duradero sano no escribe nada por su cuenta, y con el contexto volcado cada treinta segundos todo el proceso escribió 1.7 MiB por hora a veinte mensajes por segundo (0.04 GB al día). Las tablas y los comandos están en [docs/durable](/es/flow/durable-state/).

## Un mensaje que el destino rechaza para siempre

Por defecto un cable sigue reintentando un mensaje que su destino rechaza, con una pausa que crece hasta cinco segundos, y nada de lo que hay detrás de ese mensaje avanza. Para un historiador caído eso es exactamente lo correcto. Para una sola lectura malformada que el historiador nunca aceptará, es un cable atascado para siempre, así que hay una salida, y está desactivada hasta que la pida.

```json
{ "id": "count", "type": "function", "ew_durable": ["influx"], "ew_durable_attempts": { "influx": 20 }, "wires": [["influx", "reply"]] }
```

Dé al cable un número de intentos, en el cuadro de diálogo del cable del editor o como arriba, y cuando el destino haya rechazado un mensaje de la cola ese número de veces, el cable lo eleva al flujo como un error del nodo que lo rechazó, con el mensaje adjunto como lo lleva cualquier error de nodo, y pasa al siguiente. Un nodo Catch de ese flujo lo recibe y puede aparcarlo, avisar o escribirlo en otro sitio. Sin Catch el error aún aparece en la barra lateral de depuración y el mensaje se pierde, así que conecte uno. El primer rechazo, en memoria, llega al Catch como siempre, de modo que un Catch ve el mismo mensaje dos veces: cuando falló por primera vez y cuando el cable se dio por vencido. La cuenta es por mensaje y en memoria, así que un reinicio la empieza de nuevo. `hotloop_flow_durable_wire_given_up_total` los cuenta, junto a la profundidad. Un límite que no sea un número entero de 1 o más se notifica y el cable sigue reintentando, porque ignorarlo en silencio dejaría atascado un cable que alguien había dicho que parara.
