---
title: "Notas de versión: HotLoop core 4.23.1"
description: "Qué trae HotLoop core 4.23.1, qué cambia al actualizar y qué leer antes de tocar una planta en marcha."
sidebar:
  label: "4.23.1"
---

Esta versión lleva todo lo que listan las notas de la 4.23.0. Meteorología y energía, la interfaz web en trece idiomas más, pantallas que pasan entre instalaciones como archivos y los primeros comandos a una consola UniFi. Compilada solo para amd64; la compilación multiarquitectura sigue como la siguiente versión.

## Qué cambió

- **Una estación meteorológica es una sola entidad.** Se construye con los tags que una estación de tejado ya publica (temperatura, humedad, presión, viento, lluvia, solar), con el punto de rocío, el índice de calor y la sensación térmica por viento calculados en el equipo. Un sensor que no se dio a la estación no tiene fila, y uno que dejó de responder se lee Unavailable, nunca cero. No se llama a ningún servicio en la nube. Mira [Weather](/es/iot/weather/).
- **Medidores de energía.** Un medidor es un tag leído como una cantidad consumida (un contador acumulado como kWh, gas, agua o aire, o una potencia). Lo consumido se guarda en tramos de 15 minutos, así que un reinicio no pierde nada y un turno, un día o un mes es una suma. Una tarifa da a cada tramo un coste cuando se crea el tramo, así que un precio cambiado después no cambia lo que costó el mes pasado, y el coste de una unidad fabricada se calcula a partir de un medidor de producción. Hay una pantalla Energy, la API y herramientas MCP. Mira [Energy](/es/iot/energy/).
- **La interfaz web llega en trece idiomas más** junto al inglés: español, francés, italiano, alemán, noruego, búlgaro, griego, coreano, japonés, vietnamita, hindi, chino simplificado y árabe, dispuesto de derecha a izquierda. Elige uno en la barra superior o en la tarjeta de inicio de sesión. Mira [Languages](/es/iot/languages/).
- **Un panel se exporta a un archivo y se importa en otra instalación.** Las pantallas de un cliente son suyas y nunca forman parte del producto: el archivo lista cada tag, dispositivo, script y receta que nombra, y una importación informa de todos los problemas a la vez, con una correspondencia para los nombres que difieren, antes de guardar nada. Export e Import son botones en la pantalla Dashboards, y `screen_export` y `screen_import` son herramientas MCP. Mira [Screen files](/es/iot/screen-file/).
- **Lecturas de MCP que acompañan a sus escrituras**, las pruebas en seco de los editores y la importación de alarmas de CODESYS.
- **Los primeros comandos a una consola UniFi.** Se pueden ordenar cinco tipos de punto, cada uno de solo lectura hasta que una persona arma ese tag, a través de la puerta de escritura como cualquier tag: el LED de localización de un dispositivo, el reinicio de un dispositivo, el ciclo de alimentación PoE de un puerto de switch, una red inalámbrica activada o desactivada, un cliente vigilado bloqueado o readmitido, y el modo PoE de un puerto. Un ciclo de alimentación está sujeto a un enfriamiento de 15 minutos que se guarda en la base de datos, de modo que un reinicio no lo olvida, y un puerto que lleva la red (un uplink, un switch, un gateway, una copia de seguridad 5G, un par que la consola no lista) nunca se cicla. La cuenta de la consola con la que inicia sesión HotLoop tiene que ser Administrator local para esto; una cuenta View Only es rechazada por la consola y HotLoop lo dice. Un blueprint integrado cicla una vez el puerto de un dispositivo callado y luego levanta una alarma. Mira [UniFi Network](/es/iot/unifi/).
- **El servidor OPC UA responde a HistoryRead** a partir del historial que guarda el Gateway, en bruto y procesado.
- **Tramas delta de OPC UA PubSub, como opción.** `HOTLOOP_UADP_PUBLISH_DELTA_FRAMES=true` envía solo los campos que cambiaron entre tramas key. Desactivado por defecto.
- **Una tarjeta de imagen en una página de panel se ajusta a su tarjeta** y ya no fija la altura de la fila.
- **La unidad de actualización de la base de datos de una instalación Quadlet se omite a sí misma** cuando el volumen no tiene nada que actualizar, porque Podman 5.7 no arranca un contenedor sin nada que ejecutar, y el nombre de la base de datos incluida se ajusta a los 52 caracteres que puede tener un StatefulSet.
- **Los charts conservan su Secret de credenciales al desinstalar**, como el volumen de la base de datos: una reinstalación con el mismo nombre generaba una contraseña nueva que la base de datos conservada rechazaba. Para empezar de cero, borra el Secret a mano junto con el volumen.
- **La salida Kafka espera** al broker por un topic creado hace un momento tanto como lo permita su conexión, y las cifras documentadas de cola de caída del Edge Relay son las medidas (unos dos minutos a 2,000 lecturas por segundo).
- Correcciones que encontró la suite de pruebas: los usuarios de prueba de OPC UA se cifran con el coste más bajo de bcrypt, así que un inicio de sesión en la suite ya no supera lo que el cliente de prueba espera en un runner lento (el servidor y su inicio de sesión no cambian), el feed en vivo olvida lo que envió en el momento en que sale su última página, el servidor OPC UA dice cuándo su listener tiene el puerto, y varias pruebas ya no duermen por cosas que ocurren a su propio ritmo.

## Migraciones

Dos, cada una solo añade: `0028_unifi_port_cycles` (cuándo se cicló la alimentación de cada puerto de switch por última vez) y `0029_energy` (tres tablas para medidores y sus tramos). Ambas están en las copias de seguridad. Una copia tomada en la 4.22.1 se restaura aquí, y una tomada aquí no se restaura en una versión anterior.

## Cambios en la API

Rutas nuevas: `GET /api/energy/meters`, `POST /api/energy/meters`, `GET`, `PUT` y `DELETE /api/energy/meters/{id}`, `GET /api/energy/summary` y `/api/energy/summary/{period}`, `GET /api/energy/series` y `/api/energy/series/{meter}/{period}/{step}`, `GET /api/dashboards/{id}/export`, `POST /api/dashboards/import` y `GET /api/entities/composites`. Dos permisos nuevos: `energy.read`, que tiene todo rol, y `energy.write`, que tiene un administrador. Herramientas MCP nuevas para cada una. Una estación meteorológica es un dominio de entidad nuevo, `weather`. Mira [la API HTTP](/es/iot/api/).

## Actualizar desde 4.22.1

Un `helm upgrade` normal. Las migraciones se ejecutan en el primer arranque y añaden tablas; ningún secreto nuevo. Nada que estuviera desactivado se activa.

## Qué no está probado

- Los demás comandos no se han ejecutado contra una consola real.
- Meteorología y energía se ejecutaron contra grabaciones, un banco Modbus y los contadores simulados de Emberburn, no contra una estación de tejado real ni los medidores de una planta.
- Los trece catálogos de idiomas nuevos se escribieron a partir del glosario compartido y ningún hablante nativo los ha revisado.
