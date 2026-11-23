---
title: "Notas de versión: HotLoop Cascade 1.1.0"
description: "Qué trae HotLoop Cascade 1.1.0, qué cambia al actualizar y qué conviene leer antes de tocar una planta en marcha."
sidebar:
  label: "1.1.0"
---

## Qué es esto

1.1.0 da a Cascade un servidor MCP, las pantallas que le faltaban al editor y traslada el inicio de sesión al editor. El motor, el formato de archivo de los flujos de trabajo y la API REST son los de 1.0.2.

## El servidor MCP

Está en `/mcp`, en la misma dirección que la API, viene activado y escribe. Todos los MCP de la familia HotLoop leen y escriben, y Cascade era el último que no tenía MCP.

Un agente inicia sesión con una clave de API y obtiene lo que podría hacer quien tiene esa clave, reducido a los alcances de la clave. Hay 79 herramientas, y cada una es una ruta de la API REST: una llamada pasa por el controlador de la propia ruta, así que la comprobación de permisos, la validación, la escritura y la fila de auditoría son las de la ruta. No se copió nada al servidor MCP, así que nada puede desviarse, y no se dejó nada fuera, así que nada se omite.

- Una herramienta que cambia algo pide una `reason`, y el registro de auditoría la guarda junto al cambio, con la clave y el nombre que el cliente se dio a sí mismo.
- El secreto de una credencial nunca se devuelve, a nadie. Una credencial creada por MCP tiene sus secretos sellados en cuanto llegan.
- `HOTLOOP_CASCADE_MCP` y `HOTLOOP_CASCADE_MCP_WRITES` son los interruptores del despliegue, ambos activados por defecto. Ninguna herramienta ni ruta de la API puede cambiarlos, así que un agente que puede editar los ajustes de la instancia sigue sin poder volver a activar las escrituras.
- Las rutas que rechazan una clave por sí mismas (crear claves de API, tokens SCIM, proveedores de secretos y destinos de registro) no son herramientas, porque una clave que pudiera crear claves es una clave filtrada que se mantiene viva sola. La página de MCP las enumera todas, con cada herramienta y el permiso que pide.

## Las pantallas

Credenciales, Proyectos, su Cuenta y, para propietarios y administradores, Ajustes, Usuarios y el registro de auditoría. Cada una sigue los mismos permisos que la API: a cada persona solo se le ofrece lo que su rol permite, y el servidor sigue rechazando el resto.

- **Credenciales** se crean, abren, modifican, comparten con otros proyectos y eliminan. Un secreto se introduce una vez y la pantalla solo dice que está establecido.
- **Proyectos** tiene miembros y sus roles, y las claves de cuenta de servicio con las que inicia sesión una integración permanente, que se muestran una sola vez.
- **Cuenta** crea y revoca sus claves de API, con las que inician sesión la API y MCP, y cambia su contraseña.
- **Usuarios** crea personas y las desactiva o reactiva. El **registro de auditoría** se lee, se filtra y se comprueba contra manipulaciones. **Ajustes** tiene el requisito de segundo factor y el flujo de error.

El inicio de sesión es ahora la propia página del editor, en `/login`, con los colores del editor, claro y oscuro, tanto en un teléfono como en un escritorio. Hace todo lo que hacía la página anterior: configuración del primer uso, contraseñas, cuentas de directorio, inicio de sesión único, passkeys, el segundo factor y los códigos de recuperación.

## Solo amd64, y por qué

Esta versión se compila solo para amd64. La multiarquitectura sale en su propia ejecución, así que la versión siguiente es un pequeño cambio de versión que compila ambas. Hasta entonces, `stable`, `latest` y las etiquetas cortas enumeran esta imagen amd64 junto a la imagen arm64 a la que ya apuntaban, de modo que una máquina arm sigue descargando. La etiqueta de versión, `1.1.0`, es solo amd64.

## Actualizar y volver atrás

Sin migraciones. Ejecute `helm upgrade` a 1.1.0, o deje que `:stable` actualice las unidades Quadlet. Volver a poner 1.0.2 es seguro, porque nada cambió en la base de datos. Lo que una reversión no puede deshacer es lo que un agente ya hizo: sus cambios quedan hechos, y las filas de auditoría que escribió permanecen en el registro con el tipo de actor `mcp`. Una copia de seguridad antes de cualquier actualización sigue siendo un buen hábito.
