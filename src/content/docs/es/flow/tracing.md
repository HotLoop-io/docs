---
title: "Rastreo y repetición"
description: "Haga clic en un mensaje de depuración y vea por dónde fue, repítalo en un borrador, convierta un rastreo en prueba y envíe spans a OpenTelemetry."
---

Un valor sale mal a las 2 de la madrugada y el panel de depuración le dice el valor. No le dice cuál de los nueve nodos por los que pasó lo cambió, cuánto tiempo lo retuvo el lento ni qué aspecto tenía al entrar. Eso se averigua repartiendo nodos Debug por el flujo, desplegando, esperando a que vuelva a ocurrir y quitándolos.

Por eso cada mensaje que entra en el flujo recibe un rastreo. Cada mensaje de depuración del panel tiene un botón **Trace**, y un clic ilumina en el lienzo el camino que siguió ese mensaje: los nodos por los que pasó, los cables que recorrió y, atenuado, todo lo que nunca tocó. Cada nodo del camino indica cuánto tiempo tuvo el mensaje (`8.3 µs`, o `8.3 µs ×3` cuando manejó tres piezas de él), y el panel Trace junto a él enumera cada salto en orden con el mensaje tal como ese nodo lo recibió. Haga clic en una fila y estará en el nodo. Un salto que falló aparece en rojo, con el error debajo.

Sigue el mensaje por donde realmente va:

- **A través de una división.** Una lectura se convierte en tres, y las tres están en el rastreo, cada una como su propio salto en todos los nodos posteriores a la división.
- **A través de una unión.** El salto posterior a una unión tiene como padres todos los mensajes que la unión recibió para él, no solo el que llegó el último. Las tres ramas que lo alimentaron quedan iluminadas.
- **A través de un subflujo.** Los nodos de su interior se ejecutan como copias con ids propios, y los saltos se anotan bajo esos ids. El lienzo ilumina la instancia del subflujo, porque es el nodo de la pestaña que está mirando.
- **Hasta un Catch.** El nodo que falló lleva el error en su salto, y el Catch que lo recibió es el salto siguiente, marcado como alcanzado por un error.

El rastreo viaja con el mensaje, pero no está en él. Ningún flujo puede leerlo ni romperlo con `msg = {...}`, y nunca aparece en un nodo Debug, en una prueba ni en un payload por el cable.

## No puede crecer

Esto se ejecuta en la línea que vigila, así que cada dirección tiene un límite, y los límites están en `trace:` dentro de la [configuración](/es/flow/configuration/):

| Límite | Valor por defecto |
|---|---|
| Rastreos conservados, los más recientes | 256 |
| Saltos que conserva un rastreo, para que un bucle no pueda anotarse eternamente | 512 |
| Mensaje más grande del que un salto guarda una copia | 16 KiB |
| Todo junto, contado de forma aproximada, se olvida primero lo más antiguo | 16 MiB |
| Rastreos nuevos iniciados por segundo | 1,000 |

Un mensaje de más de 16 KiB conserva sus tiempos y se marca como demasiado grande para mostrarse, y no se puede repetir ni convertir en prueba. Pasados los 1,000 rastreos nuevos por segundo, el resto de los mensajes de ese segundo queda sin rastrear, porque un sensor que habla cien mil veces por segundo pagaría de otro modo un rastreo por cada uno. Un mensaje que se omitió, o cuyo rastreo se desplazó mientras aún estaba en camino, permanece sin rastrear durante el resto de su viaje; iniciar un rastreo nuevo a mitad de camino solo llenaría el búfer con las colas de recorridos cuyas cabezas ya no están. Todo se cuenta en `/metrics`, así que puede ver cuándo ocurre.

La prueba de resistencia: **un millón de mensajes por cinco nodos, 2026-10-18**, en la misma máquina que [las cifras de arriba](/es/flow/overview/#las-cifras). Heap tras un GC forzado, medido cada cien mil mensajes:

| Rastreo | Heap, en cada punto de control | Mensajes por segundo |
|---|---|---|
| Rastreo desactivado | **1.3 MiB** | 192,596 |
| Rastreo de cada mensaje (`perSecond: 0`) | **2.7 MiB** | 115,770 |
| Límites por defecto | **4.0 MiB** | 195,199 |

Es la misma cifra en los diez puntos de control. El rastreador mantuvo 808,448 bytes en 256 rastreos desde el primer punto de control hasta el último, olvidó 999,744 del millón por el camino y nunca se acercó a sus 16 MiB. Rastrear cada mensaje sí cuesta: llevó esta cadena de 192k por segundo a 116k. Por eso existe el límite por defecto. A 1,000 rastreos por segundo el costo se pierde en el ruido, y por debajo de eso un rastreo ocupa unos 3 KB. Si aun así quiere cada mensaje, ponga `perSecond: 0` y lea la primera fila de esa tabla antes de decidir. Reprodúzcalo con:

Si el heap deja de ser plano, la prueba falla.

## Repítalo en un borrador

Encontró el valor erróneo, cree saber cómo arreglarlo y ha cambiado un nodo en el lienzo. No despliegue para averiguarlo. **Replay into draft** toma el mensaje que inició el rastreo, lo introduce en el flujo tal como está ahora mismo en su lienzo, desplegado o no, y le dice dónde termina en comparación con dónde terminó la primera vez.

"Termina" se refiere a los lugares donde el mensaje se detuvo: un nodo Debug, un MQTT Out, un Switch que no coincidió con nada, un Join que sigue esperando. Para cada uno, la comparación dice que es igual, o qué propiedades cambiaron (`payload: "HIGH" -> "CRITICAL"`), o que el original terminó ahí y la repetición no, o al revés. El camino de la propia repetición se ilumina en el lienzo, así que puede ver adónde lo envió el borrador. **Back to the original trace** devuelve el primero.

Se ejecuta como se ejecuta una [prueba de flujo](/es/flow/tests/), en un proceso hijo con el runtime real y los nodos reales, y por la misma razón: su borrador arranca todos los nodos y nada de lo que hay en él puede tocar la planta. Eso significa que un nodo que habría llamado a un servicio web responde con nada, así que un flujo cuya salida depende de una respuesta aparece como una diferencia. Es el resultado honesto. No fingirá haber hablado con un PLC con el que nunca habló.

## Un rastreo se convierte en prueba

**Make test** en el panel Trace redacta una [prueba de flujo](/es/flow/tests/#pruebas-desde-el-editor) a partir de todo el rastreo: el mensaje que lo inició, introducido por la fuente por la que entró, y cada lugar donde terminó que una prueba puede vigilar, con lo que ese nodo recibió como valor esperado. Son los mismos dos clics que una prueba a partir de un mensaje de depuración, y es mejor para los flujos complicados, porque un rastreo recuerda cada extremo al que llegó un mensaje. Una división en tres nodos Debug son tres expectativas, donde un mensaje de depuración era una.

Dice por qué cuando no puede. Un rastreo que empezó dentro de un subflujo, desde la segunda salida de una fuente o desde un mensaje demasiado grande para conservarse no se puede reintroducir como una prueba necesita. Y un mensaje que un Switch descartó no termina en ningún lugar que una prueba pueda vigilar, así que se rechaza en lugar de escribirse como una prueba vacía, porque una prueba sin nada que comprobar pasa.

## OpenTelemetry

Apúntelo a un colector y cada salto sale como un span:

```yaml
trace:
  otlp:
    endpoint: http://collector:4318   # OTLP over HTTP; /v1/traces is added
    headers: {x-api-key: ...}         # if the collector wants one
    serviceName: hotloop-flow
```

Un rastreo es un rastreo de OpenTelemetry y un salto es un span, con el salto que envió el mensaje como su padre. El span de una unión tiene al primero como padre y al resto como enlaces. Cada span lleva el id del nodo, el tipo de nodo, el id del mensaje, cuántos mensajes envió el nodo y el puerto de salida por el que se llegó a él, y un error es un span con estado de error. **Los mensajes nunca salen.** Un payload son datos de una planta y un colector es el servidor de otra persona, así que lo que sale es la forma del recorrido y sus tiempos.

Habla OTLP/HTTP con la codificación JSON que define la especificación, escrita a mano en un solo archivo, en lugar de incorporar el SDK de OpenTelemetry con su protobuf y gRPC para hacer el mismo POST. El binario tiene un presupuesto de tamaño y no lo gastamos en eso. Cada id de span, padre, enlace, nombre, atributo y estado de error tiene que coincidir. No hay ningún mock en esa prueba. Si el colector está caído, la exportación descarta spans y los cuenta, y el flujo ni se entera; que `hotloop_flow_otlp_spans_failed_total` supere cero es como usted lo averigua.
