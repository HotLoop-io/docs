---
title: "Notas de versión: HotLoop core 4.24.2"
description: "Qué trae HotLoop core 4.24.2, qué cambia al actualizar y qué leer antes de tocar una planta en marcha."
sidebar:
  label: "4.24.2"
---

HotLoop lee y controla directamente dispositivos Shelly de cualquier generación, encuentra cámaras ONVIF y sirve sus flujos, instantáneas y el giro, la inclinación y el zoom, habla con Arduinos por Firmata y envía una contraseña de OPC UA de cualquier longitud como pide la especificación. Un enlace lento ya no mantiene a un nodo de borde en su disco, y `--version` nombra el commit con el que se compiló una imagen. Una instalación por defecto de HotLoop Edge arranca. Compilada solo para amd64; la compilación multiarquitectura sigue como la siguiente versión.

## Qué cambió

- **Shelly, de cualquier generación.** Gen2 y posteriores por RPC con un websocket en vivo, de modo que un cambio y una pulsación de botón llegan en el momento en que ocurren, y Gen1 por su propia interfaz HTTP. Una pulsación de botón se anota en el registro bajo el dispositivo. Ver SHELLY.md.
- **Cámaras ONVIF.** Encuentra cámaras en la red (WS-Discovery), lee la información de cada dispositivo, la dirección del flujo y de la instantánea de cada perfil de medios (Media y Media2), el giro, la inclinación y el zoom, y los eventos propios de la cámara como tags y líneas del registro. La imagen actual de un perfil está a una ruta de distancia. Ver ONVIF.md.
- **Arduinos por Firmata.** USB serie o TCP, con pines digitales y analógicos, PWM, servos y dispositivos I2C como tags. Ver FIRMATA.md.
- **Contraseñas de OPC UA de cualquier longitud.** Las contraseñas de más de 64 bytes ahora viajan por OPC UA como pide la especificación (RsaEncryptedSecret, parte 4, 7.40.4), desde el cliente y hacia el servidor, y los servidores más antiguos siguen aceptando el inicio de sesión. Probado contra la pila propia de la OPC Foundation. Ver [el servidor OPC UA](/es/edge/opc-ua-server/).
- **Un enlace lento ya no ata el nodo a su disco.** La pasada que toma lo último del disco ahora envía desde la memoria lo que entra detrás, de modo que una cola de reenvío tras un enlace lento se vacía y el nodo sale del disco en lugar de hacer fsync en cada sondeo.
- **`--version` nombra el commit.** Cada imagen indica el commit con el que se compiló además de su versión.
- **Una pantalla CODESYS junto a su WebVisu.** La importación de una visualización CODESYS se ejecuta contra un WebVisu real, impulsada por las mismas variables del PLC, y ambas se comparan en un navegador.
- **Se marca la línea de la hoja de ruta de docs/legacy.**
- **Una instalación por defecto de HotLoop Edge arranca.** El pod ya no lee el token de Gotify, la URL del webhook de Discord ni el token del bot de Discord de un Secret que no existe: cada uno se envía solo cuando su credencial está definida, y la comprobación del chart falla ante cualquier referencia a ese Secret que el render no crea. Un chart con un destino definido, o con un Secret existente indicado, se renderiza como antes.
- **El laboratorio de Ignition, en ambas direcciones.** La prueba de HotLoop con Ignition ahora también funciona en sentido inverso, se suma una prueba de UADP multicast a través de un router y se mide el informe más grande. Ver [Informes programados](/es/gateway/reports/).
- **Las pruebas esperan lo que están esperando.** El calentamiento de la app del teléfono espera una página con sesión iniciada, y el formulario de energía rellena sus campos de una sola vez.

## Migraciones

Ninguno.

## Cambios en la API

Dos rutas, ambas nuevas. `POST /api/onvif/discover` (`devices.write`) sondea la red en busca de cámaras ONVIF y no añade nada. `GET /api/onvif/{id}/profiles/{profile}/snapshot` (`devices.read`) devuelve el JPEG actual de un perfil de cámara. Ninguna ruta existente cambió. Ver [la API HTTP](/es/iot/api/).

## Actualizar desde 4.24.0

Un `helm upgrade` normal. Sin migración y sin secreto nuevo.

## Qué no está probado

- Shelly, ONVIF y Firmata se ejecutaron contra grabaciones de dispositivos reales, la pila generada del propio ONVIF y el StandardFirmata del propio proyecto Arduino en un Uno simulado. Todavía no ha pasado por el banco ningún Shelly, cámara ni Arduino físico.
- La comparación lado a lado con WebVisu se ejecuta en pruebas contra un runtime CODESYS Control for Linux SL 4.22.0.0.
