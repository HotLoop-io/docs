---
title: "Notas de versión: HotLoop Cascade 1.4.2"
description: "Qué trae HotLoop Cascade 1.4.2, qué cambia al actualizar y qué conviene leer antes de tocar una planta en marcha."
sidebar:
  label: "1.4.2"
---

## Qué es esto

1.4.2 da a la página de inicio de sesión un aspecto más limpio. El motor, el formato de archivo, la API REST, el servidor MCP y todas las demás pantallas son los de 1.4.1.

## La página de inicio de sesión

La página es ahora una tarjeta sobre un fondo tranquilo, con la marca y el nombre de HotLoop Cascade centrados encima. Iniciar sesión es el único botón naranja. Iniciar sesión con una passkey y el inicio de sesión único son botones sencillos debajo, y el botón de inicio de sesión único muestra el icono de Vord cuando Vord es el proveedor. Se lee igual en claro y oscuro y en un teléfono, y los botones de idioma y tema siguen arriba a la derecha.

Nada de cómo inicia sesión cambió: los mismos campos, las mismas formas de entrar, la configuración del primer uso, el inicio de sesión con directorio, el segundo factor, añadir una passkey o una aplicación de autenticación. La página conserva sus identificadores, así que los gestores de contraseñas y los marcadores se comportan como antes.

## Solo amd64, y por qué

Esta versión se compila solo para amd64. La multiarquitectura sale en su propia ejecución, así que la versión siguiente es un pequeño cambio de versión que compila ambas. `stable`, `latest`, `1.4` y `1` enumeran la nueva imagen amd64 junto a la imagen arm64 a la que ya apuntaban.
