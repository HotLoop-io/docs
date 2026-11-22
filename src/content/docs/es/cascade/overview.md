---
title: "HotLoop Cascade: flujos de trabajo"
description: "Flujos de trabajo que conectan la planta con todo lo demás, con puntos de control: un reintento es una fila en la base de datos. Un único binario Go estático."
---

Cascade hace que la planta hable con todo lo demás. Una alarma, un webhook, una programación, una fila nueva o una ráfaga de MQTT se convierte en un lote de elementos, y los elementos pasan por pasos que llaman a sistemas reales con credenciales reales. Si una API deja de responder o el equipo se reinicia a mitad de camino, el trabajo termina igualmente, porque cada paso tiene un punto de control y un reintento es una fila en la base de datos.

Es un único binario Go estático. SQLite en una Raspberry Pi, o Postgres con todos los workers que quiera en k3s. Postgres es también la cola, así que no hay un Redis que vigilar en un clúster de planta.

## Lo que no hace

**No escribe en sus equipos.** Cascade lee y se suscribe. Todo lo que mueve una válvula o cambia una consigna pasa por la compuerta de escritura de HotLoop, de modo que la auditoría de la compuerta ve cada escritura, sea cual sea el flujo de trabajo que la inició. Un motor de flujos de trabajo con una puerta trasera al PLC es la forma en que un registro de auditoría deja de ser honesto.

**No ejecuta JavaScript en sus campos.** Las expresiones de campo usan expr, el mismo lenguaje pequeño que usan las automatizaciones de HotLoop. No pueden tocar el sistema operativo, la red ni el sistema de archivos, y siempre terminan. JavaScript vive en un solo lugar, el paso Code, que se ejecuta en un proceso aparte y aislado, sin secretos, sin red y sin sistema de archivos. Mantenerlo fuera de todos los demás campos mantiene también fuera de ellos la ejecución remota de código.

**No bloquea nada.** SSO, MFA obligatoria, RBAC, auditoría, historial de versiones, claves de API con alcance limitado y workers en alta disponibilidad están todos en el mismo binario. No hay ninguna comprobación de licencia en ningún punto del código.

**No envía nada a casa.** Sin servidor de licencias y sin dependencia de la nube. La telemetría es opcional, está desactivada por defecto y se documenta hasta el último campo cuando llegue.

## Adónde ir ahora

[Ejecutar Cascade](/es/cascade/running/), ejecutarlo [con Podman Quadlet](/es/cascade/quadlet/) o leer [la hoja de ruta de Cascade](/es/cascade/roadmap/). ¿Lo usa en una planta? [Usar HotLoop en una empresa](/es/business/) explica las licencias y cómo contactarnos.
