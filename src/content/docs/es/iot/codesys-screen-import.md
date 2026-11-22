---
title: "Importar una pantalla de CODESYS"
description: "Exporte una visualización de CODESYS desde el IDE e impórtela como pantalla de HotLoop sobre las variables del PLC, con los elementos no colocados primero."
---

Sus operadores ya tienen una pantalla de CODESYS. Expórtela desde el IDE, impórtela en HotLoop y se abre como una pantalla de HotLoop sobre las variables del mismo PLC. Es el camino para dejar WebVisu: el PLC sigue ejecutando su programa, HotLoop lo lee a través del conector OPC UA y la pantalla es de HotLoop. HotLoop for CODESYS ejecuta Edge, así que esta también es su importación.

## Cómo usarlo

En el IDE de CODESYS, seleccione la visualización en el árbol del proyecto y use **Proyecto, Exportar** (la exportación nativa de CODESYS, un archivo `.export`). No **Exportar PLCopenXML**: ese archivo no lleva ninguna visualización, y HotLoop lo dice si lo elige.

En la pantalla Paneles, **Importar**, elija el archivo `.export` y **Leer el archivo**. Le dice:

* la visualización que encontró (un archivo con varias le pregunta cuál),
* cada tag que la pantalla lee y que esta instalación no tiene. Las variables llegan como `plc/<GVL>.<variable>`: asigne el dispositivo `plc` al dispositivo de HotLoop en el que está el PLC y todos los tags se mueven a la vez, o asigne los tags uno por uno,
* **conviene revisar**: cada elemento que no pudo poner en la pantalla, con el motivo, antes de guardar nada.

No se guarda nada hasta que no haya nada en el camino. Importar requiere `dashboards.write`, y aquí se rechaza un botón o una consigna sobre un tag que no está marcado como escribible, igual que en una construcción, de modo que la pantalla nunca tiene un control que la puerta rechazaría.

Por la API es `POST /api/dashboards/import` con `codesys` (el texto del archivo) en lugar de `file`, y `visualization` para nombrar una de varias:

```json
{"codesys": "<ExportFile>...", "visualization": "Overview", "dryRun": true,
 "remap": {"devices": {"plc": "line-3"}}}
```

El informe lleva los habituales `problems`, `warnings` y `remapped`, y un `conversion` con `mapped` (cada elemento y en qué se convirtió) y `unmapped` (cada elemento y por qué no).

## Lo que pasa a HotLoop

| Elemento de CODESYS | En HotLoop |
|---|---|
| Rectángulo, rectángulo redondeado, elipse con texto y una variable (`Temperature: %2.1f C`) | una lectura: el tag de la variable, el texto anterior como título, el texto posterior como unidad y los decimales del formato |
| Lo mismo con texto y sin variable | una etiqueta |
| Lámpara | una lámpara, encendida por la variable y coloreada con el color propio de la lámpara (rojo es un fallo, amarillo una advertencia, azul información, cualquier otro una lámpara de marcha). `NOT x` lee el tag al revés |
| Medidor, potenciómetro | una lectura de la variable. Un mando que fijaba un valor recibe además una tarjeta de consigna con la escala del dial como límites |
| Interruptor basculante, interruptor de palanca, pulsador | una lámpara que muestra el estado y una tarjeta de botón: encendido y apagado para un interruptor, el valor único para una pulsación |
| Polígono, polilínea y formas sin texto y sin variable (las tuberías, el recipiente, los marcos) | la imagen de fondo de los símbolos, dibujada a partir de sus puntos y colores |
| Grupo | sus miembros, colocados desde la esquina del grupo |

Cada elemento conserva su posición en píxeles: la página es la tarjeta de símbolos, dibujada como una sola imagen escalada, así que la pantalla mantiene su forma a cualquier tamaño y en un teléfono.

## Lo que no pasa a HotLoop

Se dice en la importación, una línea por cada uno, y nunca se descarta en silencio:

* un tipo de elemento sin símbolo en HotLoop (una gráfica de trazas, una tabla, un deslizador, un elemento de imagen y el resto de la caja de herramientas),
* una variable que es una expresión (`Temp * 2`, `a AND b`, un elemento de matriz): HotLoop muestra un tag, así que añada un tag para la expresión y apunte una lectura hacia él,
* una regla de visibilidad, color o movimiento gobernada por un valor del PLC: el símbolo está ahí todo el tiempo y no cambia de color,
* una curva de Bézier se dibuja como líneas rectas entre sus puntos, y un elemento girado no se gira,
* el tamaño de la página, que la exportación no contiene: la página es tan grande como el elemento más exterior, más un margen,
* el texto de más de 40 caracteres se corta, y los diales son números, no diales.

Los estilos de texto, las fuentes y los colores del estilo de CODESYS son los de HotLoop: la pantalla sigue el tema de HotLoop.

## Cómo lee el archivo

CODESYS documenta que la exportación nativa existe y que es XML, y no documenta lo que contiene. El lector de aquí sigue lo que escribe el propio IDE (CODESYS 3.5 SP22, Visualization 4.10): cada elemento guarda sus ajustes como una lista de miembros numerados, y el número es el CRC-32 de la ruta del miembro en la descripción del elemento, como `m_StaticPosition.iX`, que el IDE instala a su lado. Las pruebas contienen valores leídos de la exportación del propio IDE. Un ajuste que lleva una variable y no se lee se notifica como se dijo arriba, así que una pantalla nunca se importa como completa cuando no lo es.

## El siguiente paso

Abra la pantalla, compruebe las lecturas con la planta y ponga las tarjetas de consigna y de botón donde sus operadores las esperan. Una pantalla que construyó a mano y una que importó son lo mismo a partir de aquí: se exporta como [archivo de pantalla](/es/iot/screen-file/), se versiona con cada guardado y pasa a otra instalación del mismo modo.
