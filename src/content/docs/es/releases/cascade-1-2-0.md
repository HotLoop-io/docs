---
title: "Notas de versión: HotLoop Cascade 1.2.0"
description: "Qué trae HotLoop Cascade 1.2.0, qué cambia al actualizar y qué conviene leer antes de tocar una planta en marcha."
sidebar:
  label: "1.2.0"
---

## Qué es esto

1.2.0 completa la lista de herramientas del servidor MCP. El motor, el formato de archivo de los flujos de trabajo, las pantallas y la API REST son los de 1.1.1.

## Las cuatro herramientas

Todos los MCP de la familia HotLoop leen y escriben, y al de Cascade le faltaban cuatro rutas que una clave puede llamar. Ahora son herramientas, 83 en total:

- `list_keys` y `revoke_key`: las claves de la persona a la que pertenece la clave, y revocar una. Una clave puede revocarse a sí misma, que es lo primero que debería poder hacer quien tiene una clave filtrada. Las comprobaciones de la propia ruta deciden las claves de quién puede revocar quien llama, igual que en el editor.
- `listen_workflow`: abre la URL del webhook de prueba de un flujo de trabajo para una llamada, durante 1 a 600 segundos.
- `start_oauth`: devuelve la dirección que una persona abre para iniciar sesión en una credencial OAuth2. La persona sigue teniendo que decir que sí.

Cada una pasa por su ruta, así que la comprobación de permisos, la validación y la fila de auditoría son las de la ruta, y una escritura pide una razón como cualquier otra herramienta de escritura.

## Lo que queda fuera

Diez rutas rechazan una clave por sí mismas, porque quieren una persona con sesión iniciada: crear una clave de API o una clave de cuenta de servicio, crear un token SCIM, añadir, cambiar o eliminar un proveedor de secretos o un destino de registro, y su propia contraseña. Una clave que pudiera crear claves, o cambiar adónde va el registro de auditoría, es una clave filtrada que se mantiene viva sola. La página de MCP tiene la lista y el motivo.

## Solo amd64, y por qué

Esta versión se compila solo para amd64. La multiarquitectura sale en su propia ejecución, así que la versión siguiente es un pequeño cambio de versión que compila ambas.

## Actualizar y volver atrás

Sin migraciones. Ejecute `helm upgrade` a 1.2.0, o deje que `:stable` actualice las unidades Quadlet. Volver a poner 1.1.1 es seguro, porque nada cambió en la base de datos. Lo que una reversión no puede deshacer es lo que un agente ya hizo con las herramientas nuevas.
