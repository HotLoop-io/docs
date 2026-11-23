---
title: "Notas de versión: HotLoop core 4.23.4"
description: "Qué trae HotLoop core 4.23.4, qué cambia al actualizar y qué leer antes de tocar una planta en marcha."
sidebar:
  label: "4.23.4"
---

La importación de pantallas pasa de CODESYS a TwinCAT. Un archivo `.TcVIS`, y las exportaciones de cds-text-sync y codescribe, llegan como una pantalla de HotLoop con sus botones, marcos y lámparas, y lo que no pudo llegar se lista con su texto antes de guardar nada.

## Qué cambió

- **Se importan pantallas de TwinCAT.** Un archivo TwinCAT `.TcVIS` es la misma visualización en el XML de archivo del IDE, así que pasa por el conversor de CODESYS. Comprobado con el ejemplo real TwinCAT PackML (tres pantallas, MIT, licencia conservada junto a ellas): 60 elementos asignados, ninguno sin asignar. Mira [Import a CODESYS screen](/es/iot/codesys-screen-import/).
- **Botones.** Cada asignación simple en la acción de entrada de un botón (`X := 5`, `X := TRUE`, un miembro de enumeración) se convierte en una tarjeta de botón que escribe ese valor, con el rótulo como etiqueta. Una entrada Toggle configurada se convierte en un botón de encendido y uno de apagado. El código que es más que una asignación (una condición, una llamada, aritmética) se informa con su texto. Las enumeraciones OMAC PackML se conocen; cualquier otra va en `enums` de la importación, y un miembro sin número conocido se escribe por nombre y se dice.
- **Lámparas y ocultación por una expresión.** La variable de una lámpara o una variable de invisibilidad puede ser una comparación de un tag con un número, TRUE, FALSE o un miembro de enumeración, unidas con NOT, AND y OR y paréntesis. Una comparación de dos tags, la aritmética y las llamadas no se pueden llevar y se informan.
- **Marcos.** Un marco muestra otra visualización. Envía los demás archivos del proyecto con el primero (`codesysRelated`; en el cuadro de diálogo, elige varios archivos y el primero es la pantalla) y la visualización del marco se coloca en el marco con cada entrada enlazada a la variable que se dio al marco.
- **Las reglas de símbolos se combinan.** Una regla `show` o `colors` puede ser `{"all": [...]}` o `{"any": [...]}`, el AND y el OR de un PLC, de tres niveles de profundidad y ocho partes, y un tag perdido hace que un `all` no se cumpla mientras un `any` se cumple por los demás. Una lámpara puede llevar una regla `lit` en lugar de su tag. Mira [Paneles](/es/iot/dashboards/).
- **Pruebas.** La prueba del medidor de energía acota lo que contaron los medidores por el tiempo que realmente pasó, no por diez segundos fijos.

## Migraciones

Ninguno.

## Cambios en la API

`POST /api/dashboards/import` acepta `codesysRelated` y `enums` junto a `codesys`. No cambió ninguna ruta. Mira [la API HTTP](/es/iot/api/).

## Actualizar desde 4.23.3

Un `helm upgrade` normal. Sin migración y sin secreto nuevo.

## Qué no está probado

- Los importadores se probaron con el ejemplo TwinCAT PackML y las exportaciones de muestra de cds-text-sync y codescribe, no con el proyecto propio de un cliente. Un proyecto que use más del lenguaje de visualización listará más que no pudo colocar.
- Las expresiones son comparaciones de un tag con una constante unidas por NOT, AND y OR. Todo lo demás se informa, no se adivina.
