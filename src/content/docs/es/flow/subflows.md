---
title: "Subflujos de HotLoop Flow"
description: "Agrupe un conjunto de nodos en un nodo reutilizable, con sus propias propiedades, y vea qué comparte un subflujo con el flujo que lo rodea."
---

Cada instancia recibe su propia copia de los nodos de la plantilla, su propio contexto de flujo y sus propias propiedades resueltas. La misma plantilla muestra `4.2 bar` en una instancia y `4.2 kPa` en la siguiente, comprobado de extremo a extremo con un despliegue real y no afirmado en una prueba unitaria.

La expansión produce un **grafo separado** en lugar de reescribir los flujos analizados, y esa es toda la decisión de diseño. El archivo del flujo nunca se toca, así que el viaje de ida y vuelta idéntico byte a byte se mantiene, y el grafo expandido es un grafo corriente, de modo que el planificador, el enrutamiento de Catch, las métricas y los eventos de estado del editor funcionan dentro de un subflujo sin casos especiales en ninguna parte.

La anidación funciona. Un error que nadie captura dentro de un subflujo sale hasta el nodo Catch de la pestaña que lo llama, porque de lo contrario un subflujo sería solo un lugar donde los errores desaparecen. Un nodo de configuración declarado dentro de una plantilla es **compartido** por todas las instancias en lugar de copiado, ya que un broker MQTT dentro de un subflujo es un autor que dice "comparte esto", y copiarlo abriría una conexión por instancia contra algo que casi seguro las está contando.
