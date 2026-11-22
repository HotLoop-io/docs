---
title: "Traiga sus flujos de Node-RED"
description: "Importe un flows.json de Node-RED sin cambios, vea a qué se asigna cada nodo y qué se niega a ejecutar Flow y por qué."
---

Flow lee el formato v1 de `flows.json` de Node-RED, el arreglo JSON plano en el que se escribe cada exportación y cada entrada de la biblioteca de flujos de Node-RED. Apúntelo a su archivo y se ejecuta.

**Se carga y se guarda byte por byte.** Cargue un archivo, guárdelo sin editar nada y obtendrá exactamente los mismos bytes: el mismo orden de claves, los mismos espacios, ningún escape reescrito por cuenta propia. Si edita una propiedad, la diferencia es una línea y no el nodo entero.

En Go eso es más difícil de lo que parece. Un objeto de JavaScript conserva el orden de inserción de las claves, así que un entorno JavaScript lo obtiene gratis con `JSON.parse` y `JSON.stringify` sin que nadie lo piense. Un mapa de Go no tiene ningún orden y `encoding/json` ordena las claves a propósito. En lugar de forzar un mapa que conserve el orden en cada ruta de lectura del código, se guardan los bytes originales de cada entrada y se vuelven a emitir cuando la forma analizada no cambia; si cambia, se vuelve a codificar según el orden original de las claves. `json.Compact` y `json.Indent` son transformaciones a nivel de byte, así que reindentan sin reordenar nada.

Importa por dos razones, ambas aburridas y ambas reales. Su archivo de flujos vive en un volumen y en git, y no debería cambiar solo porque se reinició un pod. Y cuando un operador revisa la diferencia de un despliegue antes de enviarlo a una línea, debe ver lo que cambió y absolutamente nada más. Esa regla se mantiene aunque las pruebas y los tipos lleguen al archivo: los datos nuevos van en claves que otras herramientas ignoran, y la prueba de ida y vuelta cubre los archivos que las llevan.

Un tipo de nodo que esta versión nunca ha visto sobrevive a una carga y un guardado con todas sus propiedades intactas, así que es seguro ejecutar un flujo aquí y devolverlo después. El `flows_cred.json` de Node-RED, cifrado con AES-256-CTR, se importa en modo de solo lectura, y lo que se lee así se vuelve a cifrar con GCM en el siguiente guardado.

**Antes de desplegar nada, pregunte qué va a pasar:**

```bash
hotloop-flow import flows.json
```

Informa de cada tipo de nodo del archivo, incluidos los de dentro de los subflujos, divididos en compatibles, parcialmente compatibles con la carencia explicada y no compatibles. Los componentes internos de un subflujo se cuentan contra el grafo expandido y no contra el archivo, de modo que una instancia nunca se informa como "compatible" mientras calla lo que hay dentro. Esa es la diferencia entre enterarse en su escritorio y enterarse cuando se detiene una línea.

Un nodo también puede apuntar a un nodo de configuración que no está en el archivo. Si borra un flujo, su propio broker MQTT se va con él, mientras que un subflujo que usaba ese broker sigue apuntando a un id que no nombra nada. Una edición a mano o una exportación copiada a medias produce lo mismo. Antes lo descubríamos cuando el primer mensaje llegaba al nodo, y los nodos que solo buscan su servidor entonces no decían nada. Ahora el informe de importación tiene una sección para esto que nombra cada nodo y el id que no encuentra, el editor pone las mismas líneas en el registro al cargar, y un despliegue responde con ellas y marca esos nodos como fallidos al iniciar, con la propiedad que contiene el id incorrecto. El resto del flujo sigue funcionando. Un nodo que usted desactivó, y un ajuste TLS en blanco o con `true` o `false`, no se informan, porque no son errores.

Que un id exista no significa que funcione. No lo vimos la primera vez. Si el ajuste apunta a una pestaña, un subflujo, un grupo o un nodo común, o a un nodo de configuración del tipo equivocado, como un ajuste TLS dirigido a un broker MQTT, recibe el mismo informe y el mismo fallo al iniciar, y la línea dice qué es realmente el id y de qué tipo lo quiere el ajuste. El editor solo le ofrece el tipo correcto, así que esto solo viene de una edición a mano o de un id pegado, que es justo donde duele.

Por nivel de compatibilidad, los 108 tipos de nodo de mensajes son 12 completos, 50 parciales, 14 deliberadamente divergentes y 32 propios de Flow. Cada nodo declara cómo se relaciona con el nodo de Node-RED del mismo nombre, y **una prueba hace fallar la compilación si un nodo afirma compatibilidad parcial sin decir por escrito qué le falta.** Un nodo compatible al 90 % que calla el otro 10 % es más peligroso que uno claramente ausente, porque el primero deja que un flujo parezca funcionar. La matriz completa es [Compatibilidad con Node-RED](/es/flow/compatibility/), generada a partir del registro y no mantenida a mano, porque un documento de compatibilidad mantenido a mano es una mentira con fecha.

Las divergencias son deliberadas y cada una está escrita allí: cada destinatario de una bifurcación recibe su propia copia, el nodo `exec` tiene una lista de permitidos y no usa shell, los nodos de archivo tienen un alcance limitado, y todo lo que figura en [Contrapresión, a la vista](/es/flow/back-pressure/) tiene un techo.

**La mayoría de los nodos de la comunidad de Node-RED no se ejecutan aquí.** Son paquetes de npm que necesitan Node.js, y no habrá una versión futura en la que un paquete que necesita Node funcione de repente. Ese es el precio de la huella pequeña y del sandbox, dicho con claridad para que pueda decidir en contra. Los plugins WASM firmados son la respuesta de Flow para lo que escribe usted mismo: vea [Plugins sin npm](/es/flow/plugins/).

Los nodos de la comunidad en los que se apoya una planta son otra cosa. Flow ejecuta de forma nativa, en Go, los tipos de Node-RED para Modbus, panel, PostgreSQL y correo electrónico, con sus propios nombres de tipo, así que un flujo que los usa se carga y se ejecuta sin cambios, igual que `Buffer` y `setInterval`, que los nodos de función que los rodean llaman. Qué se ejecuta, en qué difiere y qué se comprobó está en docs/node-red-types.md. Cualquier otro nodo de la comunidad en un flujo falla por sí solo con su tipo nombrado, y el resto del flujo arranca.

JSONata solía encabezar la lista de lo que tropieza un flujo importado. Los 13 que no funcionan están fijados en una prueba con el motivo de cada uno, y diez de ellos todavía lanzan un error, solo que con otro código. `$moment` es la única función de Node-RED que echará de menos, y le dice qué usar en su lugar en vez de fallar en silencio.

Los nodos Inject programados con cron eran los siguientes de esa lista. Ahora se disparan, y en el mismo minuto que los de Node-RED: el crontab lo lee un port de cronosjs 1.7.1, el planificador del propio nodo Inject de Node-RED, y se comprobó con 22 620 disparos que el propio cronosjs produjo en seis zonas horarias, a ambos lados de cambios de hora reales. Eso importa a las 2 de la madrugada. El inicio de un turno que cae en la hora que desaparece en primavera se ejecuta en el instante en que se adelantan los relojes, y la hora que se repite en otoño se ejecuta una vez, no dos. La programación además vuelve a leer el reloj de pared cada minuto, así que una caja que arranca con la hora equivocada y que NTP corrige más tarde empieza a disparar a la hora correcta en vez de con horas de retraso.

Link Call fue el último de los tres. Ahora funciona, con el modo de retorno de Link Out: una sola lógica, "buscar este lote", "comprobar este enclavamiento", escrita una vez en su propia pestaña y llamada desde cada línea, con el camino de vuelta guardado en el mensaje como una pila, de modo que un flujo llamado pueda hacer sus propias llamadas. Una llamada que nunca vuelve genera un error tras su tiempo de espera en lugar de quedarse colgada. Un retorno que llega tarde igualmente sale, como en Node-RED. Y un retorno sin nada a lo que volver es un error que ve un nodo Catch, en vez del aviso que Node-RED registra y que nadie lee.
