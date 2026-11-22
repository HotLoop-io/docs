---
title: "Descubrimiento de red"
description: "HotLoop escucha con mDNS, SSDP y DHCP y muestra lo que hay en la red de la planta, y no envía nada salvo que usted indique una red que sondear."
---

HotLoop escucha la red de la planta y le dice qué hay en ella: el nodo ESPHome del patio, el Shelly del compresor, el servidor OPC UA de la línea 3, la caja UPnP que alguien enchufó y olvidó, lo que acaba de pedir una dirección. Cada uno aparece en Devices, Discovered, bajo los dispositivos que se anunciaron por MQTT ([descubrimiento MQTT](/es/iot/mqtt-discovery/)), con lo que es y cómo podría hablar con él HotLoop.

Después decide una persona. Nada de lo que se oye en la red se añade nunca por sí solo, y nada se arma jamás.

## Escuchar, no escanear

En una red OT que usted lee, no se escanea. Un barrido de puertos ha tumbado más de un PLC que respondió a un paquete que nunca esperaba, y «es solo descubrimiento» no consuela a las tres de la madrugada. Por eso, por defecto, HotLoop no envía absolutamente nada:

- **mDNS** (activado): los dispositivos anuncian sus servicios al arrancar, y cada respuesta a la pregunta de cualquiera se envía por multicast a todo el segmento. Un teléfono que abre una app o un portátil que busca una impresora pregunta; HotLoop escucha por casualidad.
- **SSDP** (activado): los dispositivos UPnP envían por multicast `NOTIFY ssdp:alive` al unirse y cada pocos minutos después. HotLoop también escucha esos.
- **DHCP** (desactivado, vea más abajo): un dispositivo que se une a la red difunde una petición de dirección con su MAC y normalmente su nombre.

Preguntar es **sondear**, y se activa por red, por el despliegue, nunca con un botón:

| Variable | Por defecto | <span class="sr-only">Details</span> |
|---|---|---|
| `HOTLOOP_NETDISC_MDNS` | `true` | escuchar mDNS |
| `HOTLOOP_NETDISC_SSDP` | `true` | escuchar SSDP |
| `HOTLOOP_NETDISC_DHCP` | `false` | escuchar peticiones DHCP en el UDP 67 |
| `HOTLOOP_NETDISC_PROBE_NETWORKS` | vacío | las redes en las que está activado el sondeo, como CIDR: `10.20.0.0/24,192.168.7.0/24` |
| `HOTLOOP_NETDISC_PROBE_INTERVAL` | `15m` | cada cuánto se ejecuta un sondeo allí |

En una red indicada, un sondeo envía una pregunta mDNS por cada tipo de servicio y por los que HotLoop conoce, vuelve a preguntar por cada tipo que apareció, envía un `M-SEARCH` SSDP y lee del propio dispositivo la descripción de cada dispositivo UPnP (su nombre, fabricante y modelo). En cualquier otra red no envía nada, y el botón Probe now se rechaza donde no hay ninguna indicada. Indique las redes que quiere decir: una /8 son 16 millones de direcciones, y HotLoop preguntará en ella si se lo pide.

## Con qué sabe hablar

| Oído | Es | Al aceptarlo |
|---|---|---|
| mDNS `_opcua-tcp._tcp` | un servidor OPC UA (OPC 10000-12 Anexo C: el endpoint es la dirección y el puerto del SRV más el `path` del TXT) | crea un dispositivo OPC UA en ese endpoint, anónimo y sin seguridad al principio, sin tags. Explórelo con Discover tags y configure su seguridad antes de que lleve algo que importe |
| mDNS `_shelly._tcp`, o `_http._tcp` con `gen` | un Shelly, Gen2 o posterior (su TXT `gen`, `app` y `ver`) | crea un dispositivo HTTP que lee `http://<it>/rpc/Shelly.GetStatus`, la propia llamada de estado de Shelly, solo lectura, sin tags. Discover tags lista todos los valores. Un Shelly con el inicio de sesión activado quiere autenticación digest, que el driver HTTP no hace |
| mDNS `_esphomelib._tcp` | un nodo ESPHome (su TXT: `friendly_name`, `version`, `mac`, `platform`, `board`, `network`) | lo registra como conocido y no crea nada. HotLoop lee ESPHome por MQTT: dé al nodo un bloque `mqtt:` que apunte al broker de HotLoop y se anuncia solo, y la tarjeta lo dice (emparejado por MAC) |
| mDNS `_mqtt._tcp` | un broker MQTT | lo registra. Añádalo en Settings, MQTT para oír lo que se anuncia en él |
| mDNS `_http._tcp`, cualquier otro | una página web, o un servicio para el que HotLoop no tiene palabra | lo registra |
| SSDP | un dispositivo UPnP, por su uuid: tipos de dispositivo, `SERVER` y, con el sondeo activado, su descripción | lo registra |
| DHCP | un dispositivo que pide una dirección: MAC, nombre de host, clase de proveedor | lo registra |

«Lo registra» sigue mereciendo un clic. En una red de planta, cada caja debería ser una que alguien conoce, y un hallazgo aceptado es una decisión con nombre y hora. Lo siguiente desconocido destaca.

Una tarjeta indica cuándo dos hallazgos son la misma caja: el MAC mDNS de un nodo ESPHome y su anuncio MQTT, una petición DHCP y un host mDNS en la misma dirección.

Aceptar no arma nada. Un dispositivo que se crea al aceptar no tiene tags hasta que alguien los elige, y cada punto de él es de solo lectura hasta que alguien lo arma en el editor de tags, por la misma puerta de escritura que todo lo demás. La dirección de la propuesta procede del propio anuncio del dispositivo, y el diálogo de aceptación la muestra para que compruebe que es la caja que cree.

**Ignore** oculta un hallazgo y lo mantiene oculto cuando se vuelve a oír. **Un-ignore** lo recupera.

## Nada es de fiar

Cualquiera que pueda poner un paquete en el segmento puede afirmar ser cualquier cosa. Por eso:

- cada cadena se recorta y se le quitan los caracteres de control, y la pantalla la pone en la página como texto, nunca como HTML;
- una descripción UPnP solo se lee desde la dirección de la que vino el anuncio, solo en una red de sondeo, nunca a través de una redirección y nunca más de 64 KiB. Un `NOTIFY` falsificado que apunte `LOCATION` a la página web de un PLC, o a HotLoop mismo, no consigue que se descargue nada;
- cada listener acepta 500 datagramas por segundo y descarta y cuenta el resto;
- el registro guarda 1.024 hallazgos. Los nuevos que pasen de ahí se descartan y se cuentan hasta que alguien se ocupe de algunos, y la pantalla lo dice;
- una pregunta en el cable es la pregunta de alguien, no un anuncio: las respuestas conocidas que lleva son lo que cree quien pregunta, y no se hace nada con ellas.

## Dónde tiene que estar HotLoop para oír algo

El multicast y el broadcast no cruzan un router, un NAT ni una red de contenedores. HotLoop oye el segmento en el que está, y nada más:

- **Una caja en la red de la planta** (el binario, o Podman con `--network host`): lo oye todo.
- **Kubernetes con una red de pods**: no oye nada de la planta. La pantalla Discovered muestra las interfaces en las que escucha, que es como se averigua. Dé al pod `hostNetwork: true`, o una segunda interfaz en el segmento de la planta (Multus con macvlan), y oirá la planta. El chart no hace ninguna de las dos cosas por usted: poner un pod en la red del host es una decisión sobre el nodo, no un valor por defecto.

mDNS (5353) y SSDP (1900) son puertos corrientes por encima de 1024, así que no necesitan privilegios. HotLoop los comparte con lo que ya los tenga, un avahi-daemon del host incluido.

## DHCP

Es factible, con honestidad, pero necesita dos cosas que un contenedor no recibe por defecto, por lo que está desactivado:

1. **Los broadcasts de la planta.** Una petición DHCP va a 255.255.255.255, así que HotLoop tiene que estar en el segmento: red del host o una interfaz en él, igual que arriba.
2. **El puerto UDP 67**, que está por debajo de 1024. La imagen de HotLoop se ejecuta como uid 65532. O bien dé al binario `CAP_NET_BIND_SERVICE` (`setcap cap_net_bind_service=+ep /hotloop`), o bien ponga el `net.ipv4.ip_unprivileged_port_start` del host en 67 o menos. En Kubernetes, añadir `NET_BIND_SERVICE` a las capabilities de un contenedor no root no lo hace efectivo por sí solo; lo hace la capability del archivo o el sysctl.

Nunca necesita un socket raw ni un contenedor privilegiado: un socket UDP corriente en el puerto 67 recibe los broadcasts. Nunca responde, nunca ofrece una dirección, nunca envía un byte. Comparte el puerto, así que un servidor DHCP del mismo host que también lo comparta sigue funcionando; uno que se lo reserva para sí hace fallar el listener de HotLoop, y la pantalla dice por qué, sin tocar el servidor.

Lo que no puede ver: las renovaciones, que van por unicast al servidor. HotLoop oye a un dispositivo cuando se une, no cada hora después.

## Varias réplicas

Solo la réplica que tiene el bloqueo del descubrimiento de red escucha y sondea; las demás lo intentan de nuevo cada 30 segundos, así que una toma el relevo si el titular desaparece. Dos sondeando preguntarían dos veces a cada dispositivo.

## Copias de seguridad

`net_finds` está en todas las copias de seguridad: lo que se oyó y quién aceptó o ignoró qué. Las decisiones son lo que la red no vuelve a decir.

## Cómo se prueba

El descubrimiento se ha ejecutado en redes reales con anunciantes reales, nodos ESPHome, Shelly y OPC UA, un servidor multimedia UPnP y clientes DHCP, y en hardware real el 2026-11-17.
