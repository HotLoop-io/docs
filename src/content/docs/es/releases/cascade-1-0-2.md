---
title: "Notas de versión: HotLoop Cascade 1.0.2"
description: "Qué trae HotLoop Cascade 1.0.2, qué cambia al actualizar y qué conviene leer antes de tocar una planta en marcha."
sidebar:
  label: "1.0.2"
---

## Qué es esto

1.0.2 permite que un flujo de trabajo firme y verifique cosas sin que un secreto esté nunca en los datos de un elemento, y que un formulario público en otro sitio web llame a un webhook desde el navegador. Nada más cambió respecto de 1.0.1.

## Novedades del paso Código

- **Funciones criptográficas.** `sha256(text)`, `hmacSHA256(key, text)`, `randomHex(bytes)`, `base64Encode(text)`, `base64Decode(text)` y `safeEqual(a, b)`. Se calculan en Go, así que las respuestas son las de la biblioteca estándar, y el script sigue sin `require`, sin red y sin archivos.
- **Una credencial para el paso.** El paso Código tiene una ranura de credencial `secret`. Dele una credencial `HMAC key` (un nuevo tipo de credencial integrado con un único campo secreto, `key`) y el script la lee como `credential.key`. La clave vive en la bóveda como cualquier otro secreto, y la bóveda la oculta en todo lo que guarda la ejecución, aunque el script la devuelva. Un paso sin credencial ve un objeto `credential` vacío.

El motivo: un formulario público comprueba una prueba de trabajo con un HMAC. Antes, la única forma de hacerlo en un flujo de trabajo era poner la clave en un elemento o en una variable, y ambos acaban en ejecuciones almacenadas o en texto plano. Ahora la clave es una credencial y la ejecución almacenada tiene la firma y nada más.

## Novedades en un webhook

- **`corsOrigins`.** Un disparador de webhook acepta una lista de orígenes web (`https://example.com`, o `*`) cuyas páginas pueden llamarlo desde un navegador. Cascade responde él mismo a la comprobación previa del navegador, sin iniciar una ejecución, y añade `Access-Control-Allow-Origin` a la respuesta para un origen de la lista. Un webhook que no enumera ninguno se comporta exactamente como antes: sin cabeceras CORS, de modo que una página del navegador no puede leer la respuesta. Una entrada tiene que ser un origen, sin ruta.

## Actualizar y volver atrás

Sin migraciones. Ejecute `helm upgrade` a 1.0.2, o deje que `:stable` actualice las unidades Quadlet. Los flujos de trabajo que nunca usan las nuevas funciones se comportan exactamente como antes, así que volver a poner 1.0.1 es seguro para ellos; un flujo que llame a una función nueva falla en 1.0.1 con la función sin definir. Una copia de seguridad antes de cualquier actualización sigue siendo un buen hábito.
