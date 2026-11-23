---
title: "Notas de versión: HotLoop Cascade 1.0.1"
description: "Qué trae HotLoop Cascade 1.0.1, qué cambia al actualizar y qué conviene leer antes de tocar una planta en marcha."
sidebar:
  label: "1.0.1"
---

## Qué es esto

1.0.1 corrige un error en cómo el inicio de sesión trata una base de datos que no se puede leer. Nada más cambió respecto de 1.0.0.

## La corrección

Cuando la base de datos parpadeaba, Cascade leía "no pude consultarlo" como "no es válido" y respondía 401. Lo hacían una comprobación de sesión, una clave de API, un token SCIM y el usuario de una clave, y la comprobación de sesión además borraba la cookie, de modo que una caída breve cerraba la sesión de todos. Ahora solo una sesión que no existe o que pertenece a un usuario desactivado da 401. Un almacén que no se puede leer responde 503 con un Retry-After, y la cookie se queda.

El segundo factor tenía el mismo problema. Durante una caída, un código de autenticador, un código de recuperación o una passkey correctos se respondían como código incorrecto, lo que puede dejar a una persona fuera de su propia cuenta. Esos pasos responden ahora 503 ante un error del almacén o del servidor y reservan el 401 para un rechazo real: un código incorrecto, una passkey fallida, una solicitud caducada. El inicio de sesión con passkey tampoco interpreta ya un fallo en la búsqueda de usuario como "ninguna cuenta tiene esa passkey".

## Actualizar y volver atrás

Sin migraciones. Ejecute `helm upgrade` a 1.0.1, o deje que `:stable` actualice las unidades Quadlet. Como nada cambia en la base de datos, volver a poner 1.0.0 es seguro. Una copia de seguridad antes de cualquier actualización sigue siendo un buen hábito.
