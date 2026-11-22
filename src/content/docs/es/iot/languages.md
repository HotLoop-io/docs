---
title: "Idiomas de la interfaz web"
description: "La interfaz web en inglés y trece idiomas más, con el árabe de derecha a izquierda, que se elige en la barra superior o en la tarjeta de inicio de sesión."
---

La interfaz web de HotLoop IoT, Edge y Gateway (y de HotLoop for CODESYS, que ejecuta la interfaz de Edge) viene en inglés y 13 idiomas más: español (es), francés (fr), italiano (it), alemán (de), noruego bokmål (nb), búlgaro (bg), griego (el), coreano (ko), japonés (ja), vietnamita (vi), hindi (hi), chino simplificado (zh-Hans) y árabe (ar, maquetado de derecha a izquierda).

Elija uno en el selector de idioma de la barra superior o en la tarjeta de inicio de sesión. La elección se guarda en este navegador. Si no se elige nada, la página usa el primero de los idiomas del navegador que HotLoop tenga, e inglés si ninguno coincide. Un idioma aparece en el selector solo cuando su archivo está completo.

Lo que sigue al idioma: cada palabra de cada pantalla, el orden y los signos de los números (una coma decimal en alemán, francés y español), las fechas y las horas (reloj de 24 horas), las formas del plural (el árabe tiene seis) y la dirección de la página. Los nombres de productos y protocolos (HotLoop, Modbus, OPC UA, MQTT, Sparkplug, CODESYS, UniFi) se quedan como están escritos. Los valores de la planta, como los nombres de tags, los nombres de dispositivos, los mensajes de alarma que alguien escribió y el texto de error que devuelve el servidor, se muestran tal cual.

## Cómo funciona

* [i18next](https://www.i18next.com/) 27 busca el mensaje, rellena `{{name}}` y elige la forma del plural. Pregunta a `Intl.PluralRules` del propio navegador, así que las reglas de plural son las de Unicode CLDR. Los números y las fechas usan `Intl.NumberFormat` e `Intl.DateTimeFormat` a través de `web/src/lib/format.ts`.
* Los mensajes están en `web/src/i18n/locales/<language>.json`, en una lista plana, una clave por mensaje. `en.json` es la fuente. Todos los demás archivos tienen exactamente sus claves.
* En una plantilla o en un script, escriba `tl('area.key')` o `tl('area.key', { name })`. Un mensaje con un recuento tiene una clave por cada forma del plural (`key_one`, `key_other`, y `key_few`, `key_many`, `key_two`, `key_zero` donde un idioma las tiene) y se pide con la clave sola y `count`: `tl('overview.tags_count', { count: n })`.
* El inglés forma parte de la página. Otro idioma es un archivo aparte, que se descarga cuando alguien lo elige.
* `web/src/i18n/index.svelte.ts` guarda el idioma; al cambiarlo se vuelven a dibujar todas las pantallas. Una palabra guardada en una constante al principio de un archivo `.ts` se lee una sola vez, cuando el archivo se carga, y no se traduce: escríbala como un getter (`get label() { return tl('x.y'); }`) o guarde la clave y llame a `tl()` donde se dibuja.
* La página fija `<html lang dir>`. El CSS usa propiedades lógicas (`margin-inline-start`, `inset-inline-end`, `text-align: start`), así que la maquetación se da la vuelta sola para el árabe.

## Añadir o cambiar una palabra

1. Añada el mensaje a `en.json` y escríbalo en el código con `tl()`.
2. Añádalo a todos los demás archivos de idioma, escrito por una persona que lea ese idioma, siguiendo la base de términos compartida del codex (`work/notes/i18n/glossary/`). Frases cortas y claras. Los nombres de productos y protocolos se quedan en inglés.
3. Ejecute `cd web && npm run check:i18n`. Falla cuando a un archivo de idioma le falta una clave, tiene un `{{placeholder}}` distinto del inglés o le falta una forma de plural que su idioma necesita; cuando una clave no se usa; y cuando hay inglés escrito en una plantilla o en el código sin pasar por `tl()`. Se ejecuta antes de cada `npm run build` y en `npm run typecheck`, así que la suite completa y la compilación de la versión se detienen con él. El inglés que debe quedarse (un nombre, un ejemplo de código) va en `web/i18n/allow.json` con el motivo.

Defina `HOTLOOP_TEST_BROWSER_GALLERY` y `HOTLOOP_TEST_BROWSER_ARTIFACTS` para conservar una captura de cada una.

## Lo que no se traduce

* El texto que envía el servidor: los mensajes de error de la API, los mensajes de notificación y de alarma, y la CLI. La interfaz los muestra tal como llegan.
* La documentación, los nombres del servidor OPC UA, el broker MQTT y los valores del chart de Helm.
