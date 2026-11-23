---
title: "Notas de versión: HotLoop Cascade 1.5.0"
description: "Qué trae HotLoop Cascade 1.5.0, qué cambia al actualizar y qué conviene leer antes de tocar una planta en marcha."
sidebar:
  label: "1.5.0"
---

## Qué es esto

1.5.0 permite que un propietario elimine a una persona. El motor, el formato de archivo y todas las demás pantallas son los de 1.4.2, y no hay migraciones.

## Eliminar a una persona

Antes, la única forma de quitar una cuenta era desactivarla, y se quedaba en la lista para siempre. Ahora Usuarios tiene un botón Eliminar junto a Desactivar, visible para los propietarios en todas las cuentas salvo la suya, y pide confirmación antes de hacer nada. La misma llamada está en la API REST, `DELETE /api/v1/users/{user}`, y en el servidor MCP como `delete_user`, con la misma regla: solo un propietario de la instancia, nunca su propia cuenta y nunca el último propietario.

La cuenta, sus sesiones, passkeys, identidades de inicio de sesión y claves de API desaparecen de inmediato, de modo que todo lo que siga con la sesión iniciada como esa persona deja de funcionar en su siguiente solicitud. El registro de auditoría anota quién eliminó a quién, con el correo, el rol y cuántas sesiones y claves se fueron, y su cadena sigue verificándose.

Su trabajo se queda. Su proyecto personal pasa a ser un proyecto compartido con su nombre y "(removed)" detrás, que conserva todos los flujos de trabajo, credenciales y ejecuciones que tenía, y los propietarios y administradores pueden mover cualquiera de ellos a otro proyecto o dárselo a alguien. El mismo correo puede usarse después para crear una cuenta nueva, que empieza con un proyecto propio.

Desactivar no cambia y es la opción correcta cuando quiere conservar la cuenta. Una persona que su proveedor de identidad elimina por SCIM sigue desactivándose y ocultándose, no eliminándose.

## Volver atrás

No hay migración, así que la imagen anterior funciona con los mismos datos. Una cuenta eliminada no vuelve; restaure la copia de seguridad que hizo antes de eliminar si la necesita.

## Solo amd64, y por qué

Esta versión se compila solo para amd64. La multiarquitectura sale en su propia ejecución, así que la versión siguiente es un pequeño cambio de versión que compila ambas. `stable`, `latest`, `1.5` y `1` enumeran la nueva imagen amd64 junto a la imagen arm64 a la que ya apuntaban.
