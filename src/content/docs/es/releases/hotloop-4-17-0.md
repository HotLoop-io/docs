---
title: "Notas de versión: HotLoop core 4.17.0"
description: "Qué trae HotLoop core 4.17.0, qué cambia al actualizar y qué leer antes de tocar una planta en marcha."
sidebar:
  label: "4.17.0"
---

La fase 2 de la base de automatización, UniFi de solo lectura y las contraseñas de los dispositivos cifradas en reposo. Viniendo de la 4.16.0 basta con un `helm upgrade` normal, pero las contraseñas de tus dispositivos se cifran en el primer arranque y desde entonces la clave forma parte de tus datos. Lee «Actualizar desde 4.16.0» más abajo antes de tocar una planta en marcha.

Las notas completas están en el README: Qué cambió en 4.17.0.

## En resumen

- **La base de automatización, fase 2.** Helpers (los valores que son de la gente de la planta, que se rechazan y nunca se recortan), el logbook (una sola línea de tiempo de cambios de estado, escrituras, alarmas, ejecuciones y configuración), pasos de condición, espera y parada y `forSec` en un disparador de estado, scripts (escribe el ciclo CIP una vez y lánzalo desde donde quieras), recetas (todos los setpoints de un grado salen juntos o no sale ninguno, con lectura de vuelta desde el dispositivo) y blueprints (una regla escrita una vez, rellenada para cada bomba y fijada a su versión hasta que alguien revise la actualización). MCP pasa de 16 herramientas a 25.
- **UniFi Network, solo lectura.** Switches, puertos, PoE, WAN y clientes como tags, un inicio de sesión por consola y el certificado fijado. El panel de un PLC callado dice a qué puerto del switch está conectado y si el enlace está arriba, y un desconocido en una red marcada como OT dispara una alarma. Probado en solo lectura en consolas reales. **Aún sin probar:** desconectar un cable de verdad en un dispositivo vigilado y un teléfono que se une a una red marcada como OT. Esas dos alarmas están probadas en pruebas y en ningún otro sitio hasta que alguien haga las dos cosas en el rack.
- **Las contraseñas de los dispositivos se cifran** en la base de datos y en las copias de seguridad, con una clave que el chart genera en `<release>-secret-key` y conserva.
- **Correcciones con las que una planta en 4.16.0 puede tropezar:** un Edge Relay del chart o de la unidad Quadlet ignoraba cada configuración enviada, y uno con la persistencia desactivada no arrancaba; una edición manual en el editor de reglas reiniciaba el presupuesto de ejecuciones de la regla; el veredicto del aviso del comando podía mover Set justo debajo del clic; una actualización tardía podía devolver la pantalla Entities al pasado; una regla que nunca se ejecutó decía que se ejecutó hace 739887 días; los despliegues del App Store no llevaban tenant.

### Cambios en la API

- Una hora que aún no ha ocurrido se omite, no se envía como `0001-01-01T00:00:00Z`: `lastRun`, `lastPoll`, `lastGood`, `clearedAt`, `ackedAt`, `shelvedUntil`, `raisedAt` y el resto, también en el feed en vivo.
- Rutas nuevas: `/api/helpers`, `/api/logbook`, `/api/scripts`, `/api/recipes`, `/api/blueprints`, `POST /api/automations/{id}/blueprint-upgrade`, `/api/devices/{id}/network`, `/api/unifi/{id}/...` y `DELETE /api/fleet/{id}/config`. Todas en docs/API.md.
- Permisos nuevos, y el rol de operador los tiene: `helpers.write`, `scripts.run`, `recipes.apply`, `blueprints.apply`. Escribir scripts, recetas y blueprints es cosa del administrador.
- Los tags llevan `deviceClass`; las reglas llevan `blueprintId`, `blueprintVersion` y `blueprintInputs`.

### Actualizar desde 4.16.0

- `helm upgrade <release> hotloop/hotloop --version 4.17.0   --reset-then-reuse-values`. No con `--reuse-values`, que descarta los nuevos valores por defecto y falla al renderizar. Los selectores y los volume claims no cambian; el único objeto nuevo es el Secret de la clave.
- Las migraciones 0009 a 0015 se ejecutan al arrancar (helpers, logbook, scripts, clase de dispositivo del tag, recetas, blueprints, UniFi). Todas aditivas. Haz `pg_dump` antes.
- `HOTLOOP_SECRET_KEY_FILE`: el chart genera la clave en esta actualización y el Gateway cifra todas las contraseñas de dispositivos guardadas en ese arranque. Sin la clave después, esos dispositivos siguen caídos con un error que nombra la clave. Una copia de seguridad hecha tras la actualización solo se restaura con esa clave, o con `--restore-keep-unreadable-credentials`, que deja esos dispositivos caídos hasta que alguien vuelva a introducir las contraseñas. Guarda el Secret aparte de tus copias de seguridad. Volver a la 4.16.0 significa restaurar el volcado previo a la actualización.
- ¿Renderizas el chart con `helm template` en lugar de instalarlo? Trae tu propia clave en `secretKey.existingSecret`, o cada render crea una nueva.
- Edge Relay: un archivo de dispositivos enviado vive en `/data/pushed-devices.json` y gana a los `devices` del chart mientras exista; `DELETE   /api/fleet/{id}/config` lo borra. Un envío que falló en la 4.16.0 sigue retenido en el broker y llega en el primer arranque de la 4.17.0. Quienes usan Quadlet toman la unidad nueva. Con `persistence.enabled=false` ya arranca, pero pierde la cola de reenvío, cualquier archivo enviado y el certificado OPC UA cada vez que se sustituye el pod.
