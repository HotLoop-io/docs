---
title: "Idiomas de la interfaz web"
description: "La interfaz web en inglés y trece idiomas más, con el árabe de derecha a izquierda, que se elige en la barra superior o en la tarjeta de inicio de sesión."
---

:::note[Incluye lo que viene]
Esta página también recoge algunas cosas más nuevas que HotLoop core 4.24.0, la última versión publicada. Es posible que parte de ello no esté en lo que usted tiene instalado. Las [notas de la versión](/es/releases/) dicen qué ha cambiado.
:::

La interfaz web de HotLoop IoT, Edge y Gateway (y de HotLoop for CODESYS, que ejecuta la interfaz de Edge) viene en inglés y 13 idiomas más: español (es), francés (fr), italiano (it), alemán (de), noruego bokmål (nb), búlgaro (bg), griego (el), coreano (ko), japonés (ja), vietnamita (vi), hindi (hi), chino simplificado (zh-Hans) y árabe (ar, maquetado de derecha a izquierda).

Elija uno en el selector de idioma de la barra superior o en la tarjeta de inicio de sesión. La elección se guarda en este navegador. Si no se elige nada, la página usa el primero de los idiomas del navegador que HotLoop tenga, e inglés si ninguno coincide. Un idioma aparece en el selector solo cuando su archivo está completo.

Lo que sigue al idioma: cada palabra de cada pantalla, el orden y los signos de los números (una coma decimal en alemán, francés y español), las fechas y las horas (reloj de 24 horas), las formas del plural (el árabe tiene seis) y la dirección de la página. Los nombres de productos y protocolos (HotLoop, Modbus, OPC UA, MQTT, Sparkplug, CODESYS, UniFi) se quedan como están escritos. Los valores de la planta, como los nombres de tags, los nombres de dispositivos, los mensajes de alarma que alguien escribió y el texto de error que devuelve el servidor, se muestran tal cual.

## Hecho para quienes lo usan

* Cada pantalla se dibuja a partir de un mensaje por frase, así que un idioma nunca es media página con sus propias palabras y media en inglés. Un idioma aparece en el selector solo cuando todas las pantallas están completas.
* Los plurales siguen las reglas CLDR de Unicode para cada idioma, así que "1 dispositivo", "2 dispositivos" y las seis formas del árabe se leen como espera un hablante nativo.
* Los números y las fechas vienen del formato del propio navegador para el idioma elegido, así que un lector alemán ve 1.234,5 y uno estadounidense ve 1,234.5.
* Cambiar de idioma redibuja todas las pantallas a la vez, sin recargar. El inglés forma parte de la página y se carga con ella; cada otro idioma se descarga solo cuando alguien lo elige, así que una planta que trabaja en un idioma nunca descarga los otros doce.
* La disposición se da la vuelta sola para el árabe: márgenes, alineación y espaciado se invierten con el idioma.

Una prueba de navegador de la suite completa lo demuestra en la página real. Abre HotLoop en cada idioma con un ancho de escritorio y de teléfono y recorre todas las pantallas. La dirección es correcta, nada se desplaza hacia los lados, ningún mensaje se ve como un marcador de posición, los números se leen como en ese idioma y la elección sobrevive a una recarga.

## Lo que no se traduce

* El texto que envía el servidor: los mensajes de error de la API, los mensajes de notificación y de alarma, y la CLI. La interfaz los muestra tal como llegan.
* La documentación, los nombres del servidor OPC UA, el broker MQTT y los valores del chart de Helm.
