---
title: "Notas de versión: HotLoop Flow 2.4.0"
description: "Qué trae HotLoop Flow 2.4.0, qué cambia al actualizar y qué conviene leer antes de tocar una planta en marcha."
sidebar:
  label: "2.4.0"
---

HotLoop Flow 2.4.0 permite que el panel EmberCORE inicie sesión de las personas en Flow. Quien abre Flow desde el panel entra con el rol que su inquilino le dio, acceso completo o de solo lectura, sin un segundo inicio de sesión. Está desactivado salvo que se configure la clave del panel, y nada de lo que funcionaba antes cambia.

## Novedades

**Inicio de sesión desde el panel EmberCORE**
- El panel pone un token que firmó en `X-Embernet-Assertion` en cada petición que redirige a Flow, incluido el websocket del editor. Flow lo comprueba con la clave pública del panel: la firma (ES256), el emisor (`embernet-dashboard`), que se hizo para este Flow en este inquilino (la audiencia es `<tenant>/<release>`, así que un token para otra aplicación no abre nada aquí) y su caducidad, de aproximadamente un minuto. Un token que falla en cualquiera de esos puntos se rechaza, y nada más en la petición lo rescata.
- El rol viene del mapa de roles del inquilino en el panel. `*` es todo permiso. `read` son los flujos, la paleta, los ajustes y el estado, y nada que los cambie: ni despliegue, ni inject, ni registro de despliegues. Operadores y Visores reciben `read` por defecto. Un rol que no es ninguno de los dos, o ninguno, es sin acceso. Quien inicia sesión así aparece en el registro de despliegues y en la auditoría como `dashboard:<email>`.
- No hay sesión. El panel envía un token nuevo en cada petición, así que un rol cambiado allí surte efecto en la siguiente petición y no hay nada que revocar.
- El editor dice "Ábralo desde el panel EmberCORE" en lugar de ofrecer su propio formulario de inicio de sesión, y quita el botón Cerrar sesión cuando el panel le inició la sesión. `GET /auth/mode` es cómo lo pregunta, antes de que nadie haya iniciado sesión.
- El chart lo recoge bajo `embernetSignin`. La App Store pasa la clave pública del panel; el chart la monta, escribe los ajustes, reinicia el pod y anota el Service para que el panel sepa que debe iniciar sesión a las personas.

## Qué cambió

Nada, salvo que configure la clave. Sin archivo de clave, Flow no lee la cabecera en absoluto, y un `helm template` de los valores por defecto es el que era.

## Actualización

Un simple `helm upgrade` a la imagen y el chart de la 2.4.0. No ocurre nada en el primer arranque.

Para usarlo a mano, monte la clave pública del panel (un archivo PEM) y configure `auth.assertion.publicKeyFile` y `auth.assertion.audience`, o `HOTLOOP_FLOW_ASSERTION_PUBLIC_KEY_FILE` y `HOTLOOP_FLOW_ASSERTION_AUDIENCE`. Flow se niega a arrancar con una clave que no puede leer o sin audiencia. Los demás ajustes son `auth.assertion.issuer` (`embernet-dashboard`), `header` (`X-Embernet-Assertion`) y `hideLogin` (`true`).

El inicio de sesión de administrador y los tokens de API siguen funcionando a su lado. Son la salida de emergencia para el personal y la automatización, y que desaparezca el formulario del editor no los afecta.

Imagen: `ghcr.io/hotloop-io/hotloop-flow:2.4.0`, linux/amd64 y linux/arm64. Chart: `https://hotloop.io/hotloop-flow/`. El README de esta etiqueta tiene el resto: https://github.com/HotLoop-io/hotloop-flow/blob/v2.4.0/README.md
