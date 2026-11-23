---
title: "Notas de versión: HotLoop core 4.21.0"
description: "Qué trae HotLoop core 4.21.0, qué cambia al actualizar y qué leer antes de tocar una planta en marcha."
sidebar:
  label: "4.21.0"
---

Esta versión añade el inicio de sesión X.509 al servidor OPC UA, le quita el límite de contraseñas de 64 bytes y desactiva por defecto las políticas de seguridad obsoletas. También amplía la importación de alarmas de CODESYS. Construida sobre la [4.20.2](/es/releases/hotloop-4-20-2/).

## Qué cambió

- **Un cliente puede iniciar sesión en el servidor OPC UA con un certificado X.509.** Un administrador adjunta el certificado público del cliente a un usuario de HotLoop (Settings, OPC UA certificates, o la API, o las herramientas MCP), y un cliente que tenga la clave privada inicia sesión como ese usuario con sus permisos. Revocar un certificado termina su sesión activa en diez segundos, y cada inicio de sesión con certificado y cada rechazo queda en el logbook. Está desactivado hasta que `HOTLOOP_OPCUA_SERVER_ALLOW_X509=true` (chart `opcuaServer.allowX509`). El driver de dispositivo puede iniciar sesión del mismo modo con `userCertificate` y `userPrivateKey` (RSA, la clave sellada como una contraseña). No está construida una CA de confianza con una regla de nombre.
- **Las contraseñas de 65 a 72 bytes ya inician sesión por OPC UA.** Siempre funcionaron en la interfaz web. La biblioteca sobre la que se construye el servidor rechazaba cualquier token de nombre de usuario cuya contraseña superara los 64 bytes.
- **Las políticas de seguridad obsoletas `Basic128Rsa15` y `Basic256` están desactivadas por defecto.** El servidor ya no las lista y un cliente que pide una por su nombre es rechazado cuando se abre el canal. Esto vale para instalaciones nuevas y para actualizaciones. Un cliente heredado que no habla nada más nuevo vuelve a conectar con `HOTLOOP_OPCUA_SERVER_ALLOW_DEPRECATED_POLICIES=true` (chart `opcuaServer.allowDeprecatedPolicies: true`), y el servidor lo dice al arrancar. La opción de desactivarlas también está abierta aguas arriba (pull request 66).
- **La importación de alarmas de CODESYS lee una alarma Outside range.** Export Alarms del IDE escribe `OutOfArea` para ella, y pasa como dos alarmas, una `lo` en el límite inferior y una `hi` en el superior. Inside the range, Change, Event y Alarm (API) se listan como omitidas con el motivo: nada aquí las dice con honestidad. El importador se amplió a partir de una exportación de todos los tipos de observación que ofrece el IDE, conservada como fixture de prueba.

## Cambios en la API

- Nuevo: `GET /api/opcua/certificates`, `GET` y `POST /api/users/{username}/certificates`, `POST /api/users/{username}/certificates/{thumbprint}/revoke`, `DELETE /api/users/{username}/certificates/{thumbprint}`, todas `users.manage`. Cinco herramientas MCP nuevas, 133 en total.
- Una migración, la 0027: la tabla `user_certificates` (solo certificados públicos). Está en la copia de seguridad.

## Actualizar

Un `helm upgrade` normal, o la actualización automática de Quadlet. Comprueba primero si alguno de tus clientes OPC UA usa `Basic256` o `Basic128Rsa15` (la conexión de Ignition lo muestra): ese cliente deja de conectar tras la actualización hasta que lo pases a `Basic256Sha256` o actives el interruptor heredado de arriba. No se probó un rollback a la versión anterior con la nueva tabla en su sitio.

- Los cuatro charts (`hotloop`, `hotloop-iot`, `hotloop-edge`, `hotloop-edge-relay`) están en la 4.21.0, con todas las versiones anteriores aún en el índice.

- Esta compilación es solo amd64, y `stable` conserva las imágenes arm que tiene. La siguiente versión es un pequeño aumento de versión que construye las imágenes arm.
