---
title: "Notas de versión: HotLoop Cascade 1.4.1"
description: "Qué trae HotLoop Cascade 1.4.1, qué cambia al actualizar y qué conviene leer antes de tocar una planta en marcha."
sidebar:
  label: "1.4.1"
---

## Qué es esto

1.4.1 corrige un problema de la página de Ajustes y ordena las carpetas de idiomas. El motor, el formato de archivo, la API REST, el servidor MCP y todas las demás pantallas son los de 1.4.0.

## La página de Ajustes conserva lo que cambió

Cada Guardar de la página de Ajustes recibe como respuesta los ajustes tal como los tiene el servidor. Si cambiaba un campo después de pulsar Guardar y antes de que llegara esa respuesta, la respuesta devolvía el campo al valor que acababa de dejar, sin ningún mensaje. Un administrador que guardaba y cambiaba enseguida el campo siguiente podía perder ese cambio.

Ahora un campo que aún contiene lo que se envió toma el valor del servidor, y un campo que usted editó desde entonces conserva su edición. Una prueba del navegador retiene la respuesta un segundo y medio y cambia un campo entretanto. En la página de 1.4.0 falla (muestra el primer valor donde se había fijado el segundo), y en esta página pasa.

## Las carpetas de idiomas

Las listas `_review.json` de cada carpeta de idioma ya no están, y tampoco la comprobación de compilación que las leía. Nada más las leía, y no hay prevista ninguna revisión por hablantes nativos. Las traducciones son las que envió 1.4.0.

## Solo amd64, y por qué

Esta versión se compila solo para amd64. La multiarquitectura sale en su propia ejecución, así que la versión siguiente es un pequeño cambio de versión que compila ambas. `stable`, `latest`, `1.4` y `1` enumeran la nueva imagen amd64 junto a la imagen arm64 a la que ya apuntaban.

## Actualizar y volver atrás

Sin migraciones: el esquema es el que tiene 1.4.0. Ejecute `helm upgrade` a 1.4.1, o deje que `:stable` actualice las unidades Quadlet. Volver a poner 1.4.0 es seguro, porque nada cambió en la base de datos.
