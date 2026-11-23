---
title: "Notas de versión: HotLoop Cascade 0.1.1"
description: "Qué trae HotLoop Cascade 0.1.1, qué cambia al actualizar y qué conviene leer antes de tocar una planta en marcha."
sidebar:
  label: "0.1.1"
---

## Qué es esto

0.1.1 es la primera versión que no es candidata. Existió una etiqueta 0.1.0 que nunca publicó nada: se canceló antes de llegar al registro. Una etiqueta no se mueve, así que este es el mismo código, ya publicado.

Qué es: el motor de flujos de trabajo que queríamos para una planta. Un único binario estático en Go, SQLite en una sola máquina o Postgres con workers cuando hace falta más, y el editor integrado en el binario, así que no hay nada más que ejecutar.

## Qué incluye

El motor, con cada paso guardado en un punto de control, de modo que un `kill -9` en mitad de una ejecución retoma justo donde se quedó. Esperas duraderas, reintentos, puertos de error y flujos de error. Expresiones y un paso de Código que ejecuta JavaScript aislado, en su propio proceso.

Webhooks con bandeja de entrada duradera, programaciones que se disparan exactamente una vez por intervalo sin importar cuántos nodos principales la vigilen, MQTT y un disparador para archivos que llegan a un directorio. Un paso HTTP para cualquier cosa con API y conectores para HotLoop, Postgres, EmberOps, correo, ntfy, Gotify y Discord. Ninguno más, a propósito.

Una bóveda de credenciales con rotación de claves, OAuth2 para todas las concesiones que necesita una planta, inicio de sesión con contraseña, TOTP, passkeys o su proveedor OpenID Connect, MFA obligatoria, proyectos y roles, un registro de auditoría verificable, cada guardado conservado como versión y una API con alcances y documento OpenAPI. Métricas, trazas y sondas, para que alguien más que yo pueda saber cuándo algo se atasca.

## Cómo se ejecuta

La imagen es amd64 y arm64. Descárguela por el digest indicado arriba si quiere un despliegue que no pueda moverse.

En k3s: el chart de Helm, independiente o dividido en servidor y workers.

En una máquina normal: las unidades Quadlet de `deploy/quadlet`, con SQLite en una sola máquina o Postgres con workers adicionales. Siguen `:stable` y el temporizador de actualización automática de Podman las mueve. Una actualización que no arranca sana vuelve a la imagen que estaba en marcha. Lo probamos de verdad, en las dos variantes, con Podman 5.8.7 bajo systemd: el arranque espera a que esté sano, un contenedor detenido vuelve a levantarse, una buena actualización se aplica, una mala se revierte y un flujo se ejecuta después de cada una.

## Qué debe saber

Las migraciones solo avanzan. Una reversión devuelve la imagen anterior, pero no deshace la migración de su base de datos, así que haga una copia de seguridad antes de activar las actualizaciones.

El registro era privado en esta versión, por lo que primero hacía falta un `podman login ghcr.io` como root. La imagen y el chart son públicos desde 0.1.2 y se descargan sin iniciar sesión.

Si pierde la clave que sella las credenciales almacenadas, todas quedan ilegibles. Guarde una copia en un lugar que no sea la propia máquina.

## Licencia

Cascade usa la Business Source License 1.1 (`BUSL-1.1`) de HotLoop, igual que el resto de la familia HotLoop. No es código abierto y no voy a fingir que lo es. Cada versión pasa a GPL-3.0 o posterior cuatro años después de hacerse pública por primera vez. El uso doméstico y de laboratorio es gratuito, igual que el uso en producción de escuelas, organizaciones sin ánimo de lucro y gobiernos. El uso empresarial pasa por EmberNet, donde registrarse es gratis y el uso empresarial también. No se concede alojarlo como servicio para terceros, revenderlo ni integrarlo en algo que usted venda. El archivo `LICENSE` es el texto legal y prevalece sobre este párrafo.

## Lo que todavía no está

SAML, LDAP, SCIM, entornos, el programador de alta disponibilidad con arrendamientos, más conectores, pasos de IA. Eso es de la 0.2.0 en adelante, y todo está en la hoja de ruta.
