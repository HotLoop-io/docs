---
title: "Dónde está Flow hoy"
description: "Contra qué equipo real se ha probado Flow, y de dónde venía antes de ser HotLoop Flow."
---

**Funciona.** Arranca, sirve la API y el editor, carga los flujos desde el volumen, mueve mensajes y vuelve tras un reinicio con sus flujos, credenciales y contexto. El chart lo despliega en los tres modos de red y toda la cadena de publicación se resuelve. Funciona en una planta real.

**Verificado contra infraestructura real**: Mosquitto, InfluxDB y PostgreSQL. El valor de etiqueta de InfluxDB salió de una base de datos real como `press 01,west` con el espacio y la coma intactos. Ese es el error de escape que, de otro modo, fragmenta una serie en silencio y le cuesta un día a alguien encontrarlo.

**Las cookies y multipart responden como las bibliotecas propias de Node-RED**, porque se compararon con ellas, en más de cien casos, y las respuestas pasaron a un archivo golden que las pruebas reproducen a través de sockets reales. Eso incluye los casos feos: un nombre de archivo UTF-8 sale mal formado exactamente como lo malforma la pila de Node-RED, y una cookie llamada `value` pierde su valor en `msg.responseCookies`, igual que allí. Igualar los errores es el objetivo. Un flujo que depende de uno se rompe el día en que deja de estar.

**Ejecutado en hardware real (2026-11-17):** los nodos S7 y EtherNet/IP, los cables duraderos (almacenar y reenviar y las escrituras en disco) y los plugins, con sus trampas y rechazos y un plugin firmado en un clúster real. Las cifras de escritura en disco y por llamada siguen etiquetadas con el lugar donde se midieron.

Lo que se construye a continuación, y en qué orden, está en [la hoja de ruta](/es/flow/roadmap/).

## Antes de ser HotLoop Flow

Se llamaba Emberwire, y `v0.1.0` sigue donde estaba, en `ghcr.io/embernet-ai/emberwire:0.1.0`. `2.0.0` fue la primera versión con este nombre, y 2.x no lee nada de lo que escribió el nombre anterior: las variables `EMBERWIRE_*`, los dos tipos de nodo de base de datos `emberwire-`, un módulo WASM compilado contra las exportaciones antiguas y el archivo de credenciales de 0.1.0 hay que rehacerlos. Es una ruptura limpia a propósito. Nadie había construido sobre 0.1.0, y una capa de compatibilidad para cero usuarios es solo más código que puede fallar. Desde 2.0.1, un archivo de credenciales antiguo recibe un mensaje claro que nombra el archivo, dice que lo escribió Emberwire y le indica que lo aparte y vuelva a introducir las credenciales.