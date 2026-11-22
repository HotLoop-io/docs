---
title: "La paleta de nodos"
description: "Cada tipo de nodo que incluye Flow, marcado como completo, parcial, divergente o exclusivo de Flow, con la diferencia respecto a Node-RED por escrito."
---

**117 tipos de nodo para mensajes y 39 más para diagramas de FlowLab.**

| Categoría | Nodos |
|---|---|
| Común | inject, debug, complete, catch, status, link in, link out, comment, junction |
| Función | function, switch, change, range, template, delay, trigger, exec, rbe |
| Red | ntfy out, gotify out, discord out, discord bot out, kafka out, mqtt in/out, http in, http response, http request, websocket in/out, tcp in/out, tcp request, udp in/out, modbus read/write, s7 read/write, ethernetip read/write, opcua read/write/subscribe, sparkplug in/out/command, hotloop in/state/script/recipe, mcp tool/result/client, e-mail, y los nodos modbus-read/getter/flex-getter/write/flex-write/server de Node-RED |
| Secuencia | split, join, sort, batch |
| Analizador | csv, html, json, xml, yaml |
| Almacenamiento | file, file in, watch, influxdb out, postgres, postgresql |
| Panel | ui_text, ui_numeric, ui_button, ui_switch, ui_text_input, ui_led, ui_gauge, ui_chart, ui_template, y los ui_base, ui_tab, ui_group, ui_link y ui_spacer que organizan la página |
| Descubrimiento | scan, netinfo, para inventariar un segmento de OT |
| Configuración | hotloop-flow-ntfy, hotloop-flow-gotify, hotloop-flow-discord-bot, hotloop-flow-kafka, mqtt-broker, websocket-listener, websocket-client, influxdb, postgres, modbus, s7, ethernetip, opcua, sparkplug, hotloop, mcp-server, modbus-client, postgreSQLConfig |
| FlowLab | constant, math, compare, logic, wait, bundle, field, build array, while loop, for loop, body in, body out, serial port, serial read, serial write, parse reading, stable value, log to text file, log to TDMS file, statistics, integral, derivative, filter, read DAQ task, mqtt out, postgres out, control, indicator, chart |

La fila de FlowLab es un tipo distinto de nodo. Se ejecuta en una pestaña que es un diagrama, donde un nodo se ejecuta una vez cuando todas sus entradas tienen un valor, y nunca recibe un mensaje. Qué es FlowLab y cómo funcionan sus bucles, el cable de error, el panel y el depurador está en [FlowLab](/es/flow/flowlab/). Un archivo de flujo, y por tanto un conjunto de diagramas, puede enviarse a cada instalación de Flow que un inquilino ejecuta en EmberNet, cada una comprobada y con la fallida devuelta a su estado anterior: [Envío a las estaciones de un inquilino](/es/flow/stations/). Dos instalaciones pueden compartir el trabajo de una, con un arrendamiento y una barrera en cada escritura a equipos para que solo una escriba: [Una espera en caliente con arrendamiento](/es/flow/failover/).

## Avisar a las personas, y Kafka

Cinco nodos envían a otro lugar lo que lleva un mensaje y pasan el mensaje: **ntfy out**, **gotify out**, **discord out** (un webhook), **discord bot out** y **kafka out**. Usan los mismos ajustes con los que el núcleo de HotLoop envía sus alarmas y eventos, así que una planta que ya tiene un tema de ntfy, una aplicación de Gotify, un webhook de Discord o un clúster de Kafka apunta Flow a los mismos.

- **ntfy.** Un nodo de configuración de servidor (dirección, luego un token de acceso o un usuario y contraseña, o ninguno para un servidor que deja publicar a cualquiera), y por nodo un tema, un título, una prioridad (de mínima a máxima, o `msg.priority`), etiquetas y una dirección de clic. Un tema o título vacío toma `msg.topic` o `msg.title`. En un servidor público el tema es el único secreto que existe, así que se mantiene fuera de todo error y estado.
- **Gotify.** Un nodo de configuración de servidor con el token de la aplicación, y por nodo un título y una prioridad de 0 a 10.
- **Webhook de Discord.** La URL del webhook es toda la credencial, en el nodo, y nunca se muestra en un estado, un registro ni un error, ni siquiera en un error de red que nombre la dirección. Un título o un color convierte el mensaje en un embed. El contenido se corta en 2,000 caracteres y la descripción de un embed en 4,096, contados como los cuenta Discord, y nada en un mensaje puede mencionar a nadie.
- **Bot de Discord.** Un nodo de configuración de bot con su token, y por nodo un ID de canal (o `msg.channel`). Publica como el bot y necesita que el bot esté en el canal con permiso para enviar.
- **Kafka out.** Un nodo de configuración de clúster (brokers, SASL PLAIN o SCRAM-SHA-256 o SCRAM-SHA-512, TLS), y por nodo un tema y una clave opcional. El valor es `msg.payload`, como texto, o como JSON cuando no es texto, y el mensaje se pasa cuando el clúster lo ha confirmado desde todas las réplicas sincronizadas. Usa franz-go, el cliente que usa la salida de Kafka del núcleo.

Un servidor que rechaza el mensaje dice por qué en el error del nodo, sin nada de lo que se envió. Un límite de frecuencia se espera una vez, el tiempo que indique el servidor hasta un minuto, y después el mensaje falla. No hay nodo de Slack ni de Teams, ni nodo UADP: HotLoop recibe UADP y Flow lee esos valores a través de los nodos de HotLoop.

Probado contra un ntfy real, un Gotify real y un Redpanda real: el nodo publica y se le pregunta al servidor qué contiene. Los nodos de Discord siguen la API documentada de Discord para webhooks y bots.

`scan` recorre un rango CIDR e identifica endpoints Modbus y EtherNet/IP, y `netinfo` informa de las interfaces que el entorno de ejecución realmente puede ver, que en modo macvlan es como un flujo descubre su propia dirección en la VLAN de OT. Los nodos Modbus TCP, S7, EtherNet/IP, OPC UA y Sparkplug B ahora pueden hablar con lo que encuentra `scan`, y son la siguiente sección.

Un descriptor de Go por tipo de nodo declara sus propiedades, puertos, valores por defecto y texto de ayuda, y el editor genera el diálogo a partir de él, así que un nodo no puede salir con un diálogo que no coincida con su entorno de ejecución.
