---
title: "Notas de versión: HotLoop Cascade 1.3.0"
description: "Qué trae HotLoop Cascade 1.3.0, qué cambia al actualizar y qué conviene leer antes de tocar una planta en marcha."
sidebar:
  label: "1.3.0"
---

## Qué es esto

1.3.0 pone el editor en 14 idiomas: inglés, español, francés, italiano, alemán, noruego bokmål, búlgaro, griego, coreano, japonés, vietnamita, hindi, chino simplificado y árabe. El motor, el formato de archivo de los flujos de trabajo, la API REST y el servidor MCP son los de 1.2.1.

## Los idiomas

- Un selector de idioma está en la barra superior del editor y en la página de inicio de sesión. La elección se guarda en el navegador, y la primera visita sigue el idioma del navegador.
- Todas las pantallas están traducidas: flujos de trabajo, ejecuciones, informes, variables, credenciales, proyectos, usuarios, roles, el registro de auditoría, ajustes, su cuenta, secretos, transmisión de registros y el editor de pasos. También los títulos de los pasos y su ayuda, los tipos de credencial y los rechazos que envía el servidor cuando se deniega un guardado, un borrado o un inicio de sesión.
- Las fechas, los números, las duraciones y las listas usan el formato propio del navegador para el idioma elegido. El árabe se escribe de derecha a izquierda, con el lienzo, el código y las expresiones aún de izquierda a derecha. El árabe usa los dígitos del 0 al 9 y el calendario gregoriano.
- Los nombres de producto, de nodo y de protocolo y los valores de ejemplo permanecen en inglés en todos los idiomas. Un mensaje sobre cómo quien administra la instancia configuró un directorio, un proveedor SAML u OpenID, un almacén de secretos o un archivo de claves se muestra tal como lo escribió el servidor, porque el operador busca ese texto.
- Las palabras proceden del glosario compartido de HotLoop. Las líneas que un hablante nativo debería confirmar primero figuran en el `_review.json` de cada idioma, en `web/src/i18n/locales`. Todavía no las ha revisado nadie que lea estos idiomas de forma nativa.
- Un idioma se ofrece solo cuando están todas sus líneas. La compilación comprueba que cada idioma tiene todas las claves del inglés, que los marcadores y las etiquetas se conservan y que las formas plurales son correctas. Una prueba de Go mantiene las palabras de los pasos y los mensajes del servidor en inglés iguales a lo que el servidor puede decir, de modo que un paso o un rechazo nuevos no pueden salir sin una línea que traducir.

## También en esta versión

- La prueba del editor que comprueba que los archivos compilados nunca apuntan a otro host ahora admite cuatro direcciones de ejemplo (`https://ntfy.sh`, `https://example.com`, `https://hotloop.plant` y `http://hotloop:8080`). Aparecen en el texto de ayuda de los pasos, que ahora se incluye en el editor para todos los idiomas, y son palabras dentro de una frase que nada descarga. La prueba del navegador sigue fallando si el editor solicita algo a otro host.
- El navegador de pruebas tiene las fuentes Noto para coreano, japonés, chino e hindi, de modo que esas pantallas dibujan letras y no cuadros vacíos.
- El ayudante de pruebas de OpenBao repite una escritura mientras OpenBao dice que un nuevo montaje de clave-valor aún se está actualizando (26e1e13).
- HotLoop LLC figura como licenciante y responsable de mantenimiento de Cascade (0ea9cd5).

## Solo amd64, y por qué

Esta versión se compila solo para amd64. La multiarquitectura sale en su propia ejecución, así que la versión siguiente es un pequeño cambio de versión que compila ambas. `stable`, `latest`, `1.3` y `1` enumeran la nueva imagen amd64 junto a la imagen arm64 a la que ya apuntaban.

## Un problema conocido

En la instalación dividida (pods de servidor, worker y webhook sobre PostgreSQL), los pods arrancan antes de que se resuelva el nombre de la base de datos y se reinician dos o tres veces antes de estar listos. Llegan a arrancar y la instalación pasa, pero hace ruido. 1.2.1 hace lo mismo, así que no es nuevo. La solución es conectar con reintentos hasta que la base de datos esté lista, y sale en la próxima versión.

## Actualizar y volver atrás

Sin migraciones. Ejecute `helm upgrade` a 1.3.0, o deje que `:stable` actualice las unidades Quadlet. Volver a poner 1.2.1 es seguro, porque nada cambió en la base de datos. El idioma elegido vive en el navegador, así que volver atrás no pierde nada salvo el selector.
