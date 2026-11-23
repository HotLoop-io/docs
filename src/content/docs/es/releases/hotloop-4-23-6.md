---
title: "Notas de versión: HotLoop core 4.23.6"
description: "Qué trae HotLoop core 4.23.6, qué cambia al actualizar y qué leer antes de tocar una planta en marcha."
sidebar:
  label: "4.23.6"
---

Las casillas de la hoja de ruta Protect, Access y cajas de alimentación reciben código, el dispositivo Shelly habla con el Shelly directamente, y OPC UA PubSub recibe seguridad de mensajes y metadatos. Compilada solo para amd64; la compilación multiarquitectura sigue como la siguiente versión.

## Qué cambió

- **UniFi Protect, como dispositivo.** Protocolo `unifi-protect`, con una clave de API de la página Integrations de la consola, sellada como una contraseña de consola y con el certificado fijado. Las cámaras, sensores, luces y sirenas son tags que se añaden solos. El movimiento y las detecciones inteligentes de una cámara (persona, vehículo, paquete, matrícula, rostro, animal) vienen del websocket de eventos y se leen malos mientras está caído, nunca como «sin movimiento». Una sirena se puede armar para sonar, y `alarm.<trigger>.fire` envía el webhook del gestor de alarmas para que una alarma de HotLoop haga grabar a las cámaras. La instantánea de una cámara es una ruta. Cada evento está en el logbook. Mira [UniFi Network](/es/iot/unifi/#unifi-protect).
- **UniFi Access, como dispositivo.** Protocolo `unifi-access`, con un token de API. La posición y el cierre de cada puerta son tags, mantenidos al día por el websocket de notificaciones, y cada cambio está en el logbook. Desbloquear es una escritura que una persona arma, a través de la puerta de escritura, con auditoría. Mira [UniFi Network](/es/iot/unifi/#unifi-access).
- **Salidas de PDU SmartPower.** El relé, la potencia, la corriente, la tensión y el factor de potencia de una salida son tags del dispositivo UniFi Network, y el consumo total de una PDU es uno. Escribir `on` en una salida la conmuta y conserva el nombre de cada otra salida; `cycle` la apaga, espera y la vuelve a encender, como máximo una vez cada 15 minutos, y siempre termina encendida. Mira [UniFi Network](/es/iot/unifi/#salidas-de-pdu-smartpower).
- **Un dispositivo Shelly.** Protocolo `shelly`: RPC Gen2 y posterior con el inicio de sesión digest del propio dispositivo, tags para cada componente que informa, escrituras para un switch, una luz, una persiana y un termostato. Gen1 se rechaza con un mensaje que lo envía a MQTT.
- Respuestas de DataSetMetaData y de descubrimiento, en fragmentos cuando son grandes, leídas de mensajes capturados de un publicador de Siemens. El publicador anuncia sus metadatos cada diez intervalos por defecto (`HOTLOOP_UADP_PUBLISH_METADATA_EVERY`, 0 lo desactiva). Mira [Protocolos y drivers](/es/iot/protocols/).
- **El drenador de la cola de reenvío vuelve a mirar y dice cuándo falla.** Una pasada que no envió nada mientras había lecturas esperando antes esperaba un empujón que un sondeo tranquilo nunca envía, y una pasada fallida retrocedía medio minuto sin ninguna línea en el registro.
- **Las pruebas esperan lo que están esperando.** Seis pruebas de energía esperan las lecturas del banco en lugar de una pausa fija.

- **Un dispositivo Modbus callado se lee malo en cada punto.** En una línea serie, una petición que caducaba usaba todo el plazo del sondeo, así que solo el primer bloque se ponía malo y cada punto posterior conservaba su último valor bueno mientras el cable siguiera desconectado. Ahora un dispositivo que no responde nada marca malos todos los puntos en el mismo sondeo. Mira [Protocolos y drivers](/es/iot/protocols/).
- **Las funciones terminadas se entregan activadas.** En el chart de Helm y en el binario: el broker MQTT integrado (sus logins se crean en HotLoop), el servidor OPC UA (autenticación activada, con un login `opcua-reader` generado que Settings muestra a un administrador), los informes programados, la copia de seguridad local diaria (cada 24 horas, volumen de 5 Gi), el ServiceMonitor (que se genera solo donde existen los CRD del operador de Prometheus, así que un clúster sin ellos se instala como antes), y un Ingress sin nombre de host, que responde a cualquier host que sirva la clase hasta que se define `ingress.hosts[0].host`. Los informes, las copias de seguridad, los certificados OPC UA y la cola del edge usan por defecto un directorio escribible bajo el directorio de datos de HotLoop, y un puerto que otro servicio ya tiene queda inactivo y lo dice. Los charts `hotloop` y los charts generados de IoT y Edge lo llevan.
- **Los canales de alarma y el publicador del edge están activados, y esperan un destino.** Los canales de webhook, correo, ntfy, Gotify, webhook de Discord y bot de Discord, y `edgePublish`, están activados desde el primer arranque. Uno sin adónde enviar ya no detiene la instalación ni el arranque: espera y lo dice. Un administrador introduce cada destino en Settings, «Where alarms and readings go», y lo que se guarda allí prevalece sobre los valores del chart. Los canales de alarma se aplican al guardar; el destino del publicador del edge se aplica en el siguiente reinicio. Settings también tiene una tarjeta de servidor OPC UA con el endpoint y el login generado.
- **El destino Kafka espera a que un broker coloque un topic nuevo.** Un único broker que un host ocupado aísla un momento antes fallaba la primera consulta con `INVALID_REPLICATION_FACTOR`; el destino ahora espera hasta que se acaba su tiempo y dice lo que respondió el broker.
- **El drenador de la cola de reenvío vuelve a mirar y dice cuándo falla.** Una pasada que no envió nada mientras había lecturas esperando antes esperaba un empujón que un sondeo tranquilo nunca envía, y una pasada fallida retrocedía medio minuto sin ninguna línea en el registro.

- **Arrastrado de la 4.23.4 y la 4.23.5.** Las pantallas TwinCAT `.TcVIS` y las de cds-text-sync y codescribe se importan con sus botones, marcos, lámparas y reglas de expresión, y la actualización de la pantalla de UniFi espera a la vista que se está cargando. Ninguna de las dos versiones se publicó, así que ambas están aquí. Mira [4.23.4](/es/releases/hotloop-4-23-4/) y [4.23.5](/es/releases/hotloop-4-23-5/).

## Migraciones

Ninguno.

## Cambios en la API

`GET /api/unifi-protect/{id}/cameras/{camera}/snapshot` devuelve el JPEG actual de la cámara. La lista de protocolos tiene `unifi-protect` y `unifi-access`. Mira [la API HTTP](/es/iot/api/).

## Actualizar desde 4.23.5

Un `helm upgrade` normal. Sin migración y sin secreto nuevo. La 4.23.4 y la 4.23.5 se etiquetaron y sus ejecuciones de versión fallaron en el trabajo de pruebas antes de publicar nada, así que la última versión anterior a esta es la 4.23.3, y esta lleva los cambios de ambas. Un archivo de valores que defina cualquiera de las funciones anteriores sigue prevaleciendo; pon una a `false` y no genera listener, Service, volumen ni Ingress.

## Qué no está probado

- Protect, Access y las salidas de la PDU se construyeron según las API publicadas y se sometieron a consolas simuladas que guardan estado. Ninguna ha estado en una consola ni una PDU reales, así que sus casillas en la hoja de ruta no están marcadas.
- Una instantánea adjunta a una notificación de alarma no está construida.
- PubSub: un Security Key Service no está construido (las claves son estáticas), y ningún publicador de Siemens, CODESYS o Beckhoff ha estado en un banco.
- La desactivación de puertos de UniFi sigue esperando la petición de la interfaz web de una consola 10.6 real.
