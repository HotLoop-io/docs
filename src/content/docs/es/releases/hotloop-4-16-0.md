---
title: "Notas de versión: HotLoop core 4.16.0"
description: "Qué trae HotLoop core 4.16.0, qué cambia al actualizar y qué leer antes de tocar una planta en marcha."
sidebar:
  label: "4.16.0"
---

La primera versión publicada desde la 4.3.1 de agosto. Todo lo que va de la 4.4.0 a la 4.15.3 se integró pero nunca se publicó, así que si estás en la 4.3.1 lo recibes todo de golpe, con un nombre nuevo, una imagen nueva, un chart nuevo y una licencia nueva. **Si vienes de la 4.3.1, no basta con un simple `helm upgrade`.** Lee «Actualizar desde 4.3.1» más abajo antes de tocar una planta en marcha.

Las notas completas están en el README: Qué cambió en 4.16.0 y, debajo, cada versión hasta la 4.4.0.

## En resumen

- **HotLoop Core: entidades.** Cada tag es una entidad con un id estable, colocada en un árbol de equipos ISA-95. Los motores, las válvulas, los lazos PID y el resto son compuestos hechos con sus tags, cada alarma es una entidad y cada comando de una entidad pasa por la misma puerta de escritura que una escritura de tag. Los agentes (MCP), las automatizaciones y las nuevas pantallas Entities y Plant las usan todas. Se puede preguntar antes por una llamada de servicio con `?dry_run=true`, y el aviso del comando te dice «Would be refused: ...» antes de confirmar.
- **Notificaciones que llegan al teléfono:** ntfy y el bot de Discord con botón Acknowledge, Gotify y un webhook de Discord, con límites de frecuencia que reúnen una avalancha en un solo resumen.
- **Correcciones que importan en una planta en marcha:** al quitar el aplazamiento (unshelve) se podía borrar una alarma sin reconocer; una suscripción OPC UA podía quedarse muda para siempre mientras la sesión decía conectada; un dispositivo Modbus que callaba tardaba hasta 15 minutos en darse por caído; un webhook fallido registraba su URL, que en Discord y ntfy es la contraseña; la restauración cargaba las columnas por posición; cada redespliegue cambiaba el certificado del servidor OPC UA, así que Ignition dejaba de confiar en él; Discover tags importaba cada nodo OPC UA como float; la pantalla Settings nombraba variables de sondeo que nadie lee.
- **Ignition 8.3.9 lee nuestro servidor OPC UA**, verificado de punta a punta, y ahora el servidor informa `HotLoop` como fabricante.
- **El Edge Relay llega** con su propia imagen y su propio chart, en sincronía con el Gateway. TimescaleDB 2.30.1, y la extensión se actualiza sola.

### Cambios en la API

- Las listas vacías son `[]`, nunca `null`, en todas partes, también en los streams.
- Los intervalos de `/api/history` sin una lectura buena son `null` (un hueco), y las lecturas malas quedan fuera de los promedios.
- Un error que la API no sabe ubicar es un 500 con una referencia de registro, no un 400. Un dispositivo que falla al escribir o al explorar es un 502.
- Un servicio que una entidad de alarma no admite (`alarm.turn_on`) es un 400. Antes respondía que bien y no hacía nada.
- Quitar el aplazamiento de una alarma que no está aplazada es un 409.
- El JSON de un tag siempre lleva `minValue`, `maxValue` y `hasRange`.
- Nuevo: `?dry_run=true` en `POST /api/services/{domain}/{service}`. Solo `true` o `false`; cualquier otra cosa es un 400.

### Actualizar desde 4.3.1

- Imagen `ghcr.io/hotloop-io/hotloop` (antes `ghcr.io/embernet-ai/industrial-iot`), repositorio de charts `https://hotloop.io/hotloop`, chart `hotloop` (antes `industrial-iot`), y cada variable `IIOT_` pasa a ser `HOTLOOP_`.
- El nombre del chart está en los selectores de las cargas de trabajo, que Kubernetes no cambia en el sitio. Conserva el nombre de la release y el namespace y después: haz `pg_dump` de la base de datos; borra el Deployment antiguo (`<release>`) y el StatefulSet (`<release>-postgresql`), que dejan el volumen de la base de datos donde está; ejecuta `helm upgrade <release> hotloop/hotloop -f your-4.3.1-values.yaml`. No con `--reuse-values`. Renombra cualquier `IIOT_` en `extraEnv` y quita un `image.repository` sobrescrito. El pod nuevo de la base de datos monta el volumen antiguo y el Gateway lo migra al arrancar.
- Licencia: los términos propios de HotLoop, no los que traía la 4.3.1. Gratis para uso doméstico y de laboratorio; las empresas se dan de alta gratis a través de EmberNet. Los términos vigentes están en LICENSE.
- Hay un inicio de sesión, las escrituras vienen desactivadas por defecto, y una zona horaria que no se puede cargar detiene el arranque en lugar de seguir con UTC.
