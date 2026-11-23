---
title: "Notas de versión: HotLoop core 4.23.3"
description: "Qué trae HotLoop core 4.23.3, qué cambia al actualizar y qué leer antes de tocar una planta en marcha."
sidebar:
  label: "4.23.3"
---

Una pantalla de WebVisu conserva su ocultación y sus colores de alarma al llegar, y cualquier símbolo de cualquier pantalla ahora puede mostrarse y pintarse mediante una regla sobre un tag. Una pequeña corrección de la lista de copias de seguridad viaja con ella. Compilada solo para amd64; la compilación multiarquitectura sigue como la siguiente versión.

## Qué cambió

- **Un símbolo puede mostrarse y pintarse mediante reglas.** `show` dibuja un símbolo solo mientras se cumple una regla sobre un tag, de modo que una puerta, una protección o una bomba dibujadas para un estado solo están en ese estado. `colors` son hasta cuatro reglas, cada una con un tono (`ok`, `warn`, `bad` o `info`): la primera que se cumple pinta el símbolo en ese tono, y cuando ninguna se cumple se dibuja como era. Una regla es un tag y una comparación (`on`, `off`, `eq`, `ne`, `gt`, `ge`, `lt`, `le`). Una regla cuyo tag no tiene una buena lectura no cumple nada y no oculta nada, así que una conexión perdida nunca hace desaparecer un símbolo. El formulario de símbolos del constructor tiene ambas, y un archivo de pantalla lista y mueve los tags de las reglas con el resto. Mira [Paneles](/es/iot/dashboards/).
- **La importación de pantallas de CODESYS lleva Invisible y Toggle color.** La variable Invisible de un elemento (y la de su grupo) se convierte en una regla `show`, con `NOT x` invirtiéndola, y su variable Toggle color se convierte en una regla `colors` en el tono más cercano al color de alarma del propio elemento. Se encuentran en los ids que dan los propios árboles de elementos del IDE de CODESYS. Lo que no puede llevar se dice en la importación, con la variable: estas dos en una forma dibujada en la imagen de fondo (una tubería, un recipiente, un marco), porque la imagen es una sola imagen, y cada otro ajuste dirigido por variable (un relleno, un color de marco o de texto, un movimiento, un parpadeo, una lista de textos). Mira [Import a CODESYS screen](/es/iot/codesys-screen-import/).
- **La lista de copias de seguridad ya no falla mientras se depura una copia.** La copia programada depura las copias antiguas en su propia goroutine, y un listado que caía en medio fallaba por el archivo que faltaba, lo que la API respondía como error de servidor. Una copia que se fue ahora se deja fuera de la lista.

## Migraciones

Ninguno.

## Cambios en la API

La configuración de un símbolo acepta `show` y `colors`. No cambió ninguna ruta. Mira [la API HTTP](/es/iot/api/).

## Actualizar desde 4.23.2

Un simple `helm upgrade`. Sin migración y sin ningún secreto nuevo. Un símbolo sin ninguna de las dos reglas se dibuja como antes.

## Qué no está probado

- La importación de CODESYS se probó contra la exportación del propio IDE de una visualización y la variable de grupo del ejemplo Refrigerator de CODESYS. Una pantalla de otro proyecto puede listar más que no pudo colocar.
- Las nuevas reglas de símbolos se probaron con las pruebas de la suite, no en la pantalla de una planta.
