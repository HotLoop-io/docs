---
title: "Contrapresión, a la vista"
description: "Un techo en cada cola, una política para lo que ocurre en el techo y un gráfico de cada mensaje que no cupo, antes de que acabe en un cierre por memoria."
---

Este es todo el proyecto. El fallo típico de un motor de flujos en una caja de borde es un pod que se infla en silencio hasta que el kubelet lo mata, y el registro que deja no le explica nada a quien tiene el localizador. Por eso cada lugar donde pueden acumularse un mensaje o un byte tiene un techo, y cada techo es una decisión escrita y documentada en [Compatibilidad con Node-RED](/es/flow/compatibility/), no un límite que pusimos y nunca mencionamos.

| Qué puede acumularse | Qué lo detiene |
|---|---|
| La bandeja de entrada de un nodo | Un techo (1024 por defecto) y una de cuatro políticas de desbordamiento |
| Colas de retardo y de límite de frecuencia | Un techo; pasado ese punto se rechaza hacia un nodo Catch |
| Temporizadores de Trigger | Un techo |
| Salida de `exec` | Limitada por flujo; el truncamiento genera un error |
| Procesos de `exec` | Un límite de concurrencia; pasado ese punto se rechazan |
| Lecturas de archivos | Limitadas, con modos por línea y por bloques |
| Cuerpos de solicitudes HTTP | Limitados |
| Espera de una respuesta HTTP | Un 504 tras un tiempo de espera |
| Conexiones y tramas TCP | Acotadas |
| Colas de envío de WebSocket | Acotadas; un cliente lento se desconecta |

Las políticas de desbordamiento, definidas de forma global y modificables por nodo:

| Política | Qué ocurre |
|---|---|
| `block` | El emisor espera a que haya espacio, hasta `blockTimeout`. La contrapresión sube hacia arriba, que es la respuesta correcta casi siempre. |
| `drop-newest` | Se descarta el mensaje que llega. Se cuenta y se anuncia. |
| `drop-oldest` | Sale la cabeza de la cola para hacer sitio. Se cuenta y se anuncia. Para "solo importa la última lectura". |
| `error` | Se rechaza el envío y se eleva a un nodo Catch, para que el flujo decida. |

Nada se tira en silencio. Cada descarte se cuenta, se envía al editor como un evento y se exporta como una métrica sobre la que puede crear alertas. Cuando un límite se alcanza, se entera por un gráfico, no por un operador.

## Una goroutine por nodo

Cada instancia de nodo tiene su propia goroutine y su propia bandeja de entrada. Ordenado dentro de un nodo, en paralelo entre nodos. Un nodo Function que hace trabajo real ocupa un núcleo mientras el editor, la API, el websocket y todos los demás flujos siguen avanzando.

## Cada destinatario recibe su propia copia

Cuando un cable se bifurca, cada nodo al otro extremo recibe su propia copia del mensaje, de modo que dos ramas que creen que son dueñas de él no pueden corromperse entre sí, y una rama nunca se comporta distinto de sus hermanas de aspecto idéntico por el orden en que las conectó. Es un fallo que se reproduce los martes, y aquí no existe.

No es gratis. Copiar un mensaje pequeño (una lectura y un tema) cuesta de 411 a 453 ns y 680 bytes, y una cadena de cinco nodos mueve un mensaje cada 1,14 a 1,40 µs, copias incluidas. Donde copiar duele es en una carga útil binaria grande: un búfer de 1 MiB cuesta de 128 a 156 µs y otro megabyte en el heap por cada destinatario. Por eso las cargas útiles binarias grandes viajan como `ImmutableBytes`, que comparte el búfer en lugar de copiarlo: **de 250 a 279 ns y 360 bytes para el mismo mensaje de 1 MiB.** Los nodos de archivo y HTTP ya entregan así las cargas útiles binarias, de modo que lo obtiene sin pedirlo.

## Contexto que sabe contar

El contexto de flujo y el global tienen `get` y `set`, y también `CompareAndSwap`, `Increment` y `Update`. Dos ramas que hacen get-modify-set sobre un mismo contador compiten entre sí y pierden actualizaciones, y con get y set solos no hay nada que hacer. Con `Increment` no hay nada que compita.

Y sobrevive a un reinicio. El contexto de flujo, global y de nodo vive en un archivo SQLite en el volumen, se carga la primera vez que se usa un ámbito y se escribe con retraso, de modo que un contador o un pestillo en un flujo está donde lo dejó cuando el pod vuelve. Las operaciones atómicas son el mismo código de antes. Los cambios se agrupan en una escritura cada treinta segundos y un valor que se establece a lo que ya era no escribe nada, porque nos importa más lo que esto le hace a una tarjeta SD que lucirnos con ingenio. Una parada limpia lo escribe todo; un `kill -9` pierde hasta esos treinta segundos, y `store.context.flushInterval` es el ajuste. Los detalles, y lo que le cuesta a una tarjeta, están en [docs/durable](/es/flow/durable-state/).
