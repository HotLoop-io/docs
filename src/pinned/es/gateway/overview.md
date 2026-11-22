---
title: "Resumen de HotLoop Gateway"
description: "Un gateway industrial: doce drivers nativos, un historiador que guarda la calidad, alarmas ISA-18.2, MCP para agentes y una puerta de escritura sin atajos."
sidebar:
  label: "Resumen"
---

:::note[{{hotloop}} ya está disponible]
Cuatro productos desde una misma etiqueta: [IoT](/es/iot/overview/), [Edge](/es/edge/overview/), el Gateway y el [Edge Relay](/es/edge-relay/overview/), cada uno con su propia imagen y su propio chart. Los cuatro se compilan para amd64 y arm64 en {{hotloop}}, y los tres pequeños también para arm/v7. El Gateway conserva `ghcr.io/hotloop-io/hotloop:{{hotloop}}` y el chart `hotloop` de `https://hotloop.io/hotloop`, y ambos se descargan sin iniciar sesión. [Instálelo](/es/gateway/install/). ¿Está en 4.18.11? Es un `helm upgrade`, y después los agentes pueden escribir, así que lea los dos cambios. ¿Está en 4.17.0? Es un `helm upgrade` normal, pero sin `--reuse-values`, y un par de valores por defecto cambiaron. ¿Está en 4.16.0 o 4.3.1? Pase primero por 4.17.0. En cualquier caso, [lea antes la guía de actualización](/es/gateway/upgrading/). Mejor enterarse aquí que por un despliegue atascado.
:::

HotLoop Gateway lee su planta. Consulta PLC y servidores en su propio protocolo, guarda cada lectura con su calidad en un historiador, genera alarmas ISA-18.2 que pueden avisar a un teléfono, ejecuta automatizaciones sobre todo ello y entrega la planta completa a los agentes por MCP. Un sitio ejecuta un solo chart, el Gateway y su base de datos, en lugar de un historiador, un servidor de alarmas, un motor de reglas y un montón de código de enlace, cada uno fallando a su propio ritmo.

También puede dar órdenes a esos equipos, por eso todo valor que va hacia un dispositivo pasa por [una sola puerta de escritura](/es/gateway/write-gate/). Las escrituras salen desactivadas, cada tag es de solo lectura hasta que alguien lo arma, un valor fuera de su rango se rechaza en vez de recortarse, y cada intento se audita antes de tocar el cable, rechazos incluidos.

Está escrito en Go, desde cero: un binario estático sobre una base distroless, sin sidecar ni intérprete, que corre como usuario sin privilegios, con todas las capacidades eliminadas y un sistema de archivos raíz de solo lectura.

## Por dónde empezar

Lo básico, en {{hotloop}} y en todas las versiones hasta la 4.16.0:

- [Instalación](/es/gateway/install/) es Helm desde el chart publicado o Podman Quadlet en un equipo, la clave que debe respaldar y los pocos valores que conviene fijar antes de que una planta real lo vea.
- [Actualización](/es/gateway/upgrading/) es el procedimiento que conserva sus datos, desde 4.17.0, 4.16.0 o 4.3.1, y cada cambio de la API con el que tropezará un script.
- [La puerta de escritura](/es/gateway/write-gate/) recoge todas las comprobaciones entre una petición y una máquina, en el orden en que el código las ejecuta, y lo que responde cada rechazo.
- [Protocolos](/es/iot/protocols/) dice con exactitud hasta dónde se ha probado cada driver, incluidos los dos que se ejecutaron en equipos reales el 2026-11-17, S7comm y EtherNet/IP.
- [Automatizaciones](/es/iot/automations/) explica los disparadores, las condiciones y las acciones, y por qué una regla se compila al guardarla y no cuando se dispara a las 3 de la madrugada.
- [Model Context Protocol](/es/iot/mcp/) es el Gateway como servidor y cliente MCP, y cómo un solo Gateway lee todos los sitios.

Novedades de 4.19.4 respecto a 4.18.11: los agentes escriben por la misma puerta que la pantalla (MCP está activo en todos los productos y el endpoint siempre lleva un token), un valor escrito en un tag escalado llega al registro como usted quería, un runtime CODESYS se lee por los nombres de su Symbol Configuration, un flujo de eventos Kafka se suma a los destinos del historiador, OPC UA PubSub sobre UADP se suscribe y publica, y `hostNetwork` es un ajuste del chart. 4.19.5 es su compilación multiarquitectura, y 4.19.8 añade una corrección del Libro de registro y selectores de tags que buscan en toda la planta. [Las notas de la versión](/es/releases/hotloop-4-19-4/) dicen qué aporta cada cambio y qué cuesta.

Novedades de 4.18.11 respecto a 4.18.10: la base de datos es PostgreSQL 17 con una actualización que se ejecuta sola, SNMP y BACnet/IP mediante un único flujo de integraciones, inicio de sesión en quioscos con bloqueo, escalado de alarmas y una interfaz que se instala en el teléfono. [Las notas de la versión](/es/releases/hotloop-4-18-11/) dicen qué aporta cada cambio y qué cuesta.

Novedades de 4.18.10 respecto a 4.17.0: la gama de cuatro productos, la elección de base de datos, MQTT y descubrimiento de red, destinos del historiador y equipos que se actualizan solos. [Las notas de la versión](/es/releases/hotloop-4-18-10/) dicen qué aporta cada cambio.

Novedades de 4.17.0 respecto a 4.16.0:

- [Recetas](/es/iot/recipes/), [Scripts](/es/iot/scripts/), [Blueprints](/es/iot/blueprints/), [Ayudantes](/es/iot/helpers/), [Libro de registro](/es/iot/logbook/) y [UniFi Network](/es/iot/unifi/). [Las notas de la versión](/es/releases/hotloop-4-17-0/) dicen qué aporta cada cambio.

## Qué hace con los datos

**Historiador.** TimescaleDB por defecto (sobre PostgreSQL 17 desde 4.18.11), y también sirven PostgreSQL normal o un archivo SQLite, porque [la base de datos es un ajuste](/es/releases/hotloop-4-18-10/). La tabla de historial es una hypertable cuando existe la extensión y está particionada por rangos de forma nativa cuando no, así que un PostgreSQL normal funciona en vez de fallar. Fije una banda muerta por tag. Sin ella, un sensor que oscila en su último bit escribe una fila en cada escaneo para siempre, y mil tags leídos cada segundo son unos 86 millones de filas al día.

**Alarmas.** ISA-18.2, con el estado que se les escapa a casi todos los sistemas caseros: `rtn-unack`, una alarma que se normalizó sola antes de que nadie la viera. Reconocida y vuelta a la normalidad son ejes separados, así que el disparo momentáneo de las 03:00 sigue en la lista cuando entra el turno de la mañana, en vez de desaparecer sin que nadie se entere. Las bandas muertas asimétricas y los retardos de activación y desactivación evitan que un valor límite haga parpadear la lista hasta convertirla en ruido que nadie lee. Posponer tiene un máximo de 24 horas, porque una pausa sin fin es una supresión que nadie dejó escrita.

**Calidad.** Cada lectura lleva buena, dudosa o mala, y mala significa que el valor no se conoce. Nunca significa cero. Las alarmas mantienen su estado ante una lectura mala en vez de evaluarla, de modo que un instrumento muerto se ve como un instrumento muerto y no como una anomalía del proceso. Las tendencias y los informes agregan solo lecturas buenas, cuentan lo que dejaron fuera y no dan ningún valor a un periodo sin lecturas buenas. Cero es una lectura (una válvula cerrada, un caudal nulo), y aquí nadie se la quitó.

**Entidades.** La bomba de entrada, no el registro 40001. Cada tag recibe una entidad sin esfuerzo, un motor, una válvula o un lazo PID es una sola entidad construida con los tags que realmente la forman, y todo cuelga de un único árbol de equipos ISA-95. Las reglas, las pantallas y los agentes leen como la planta y no como un mapa de registros. Un motor está en marcha cuando lo dice su contacto de marcha, nunca porque le hayamos ordenado arrancar.

**Avisos.** ntfy, Gotify, Discord, webhook y correo electrónico. Pulse Reconocer en el teléfono y la alarma queda reconocida en el Gateway, con un enlace firmado, que caduca y funciona una sola vez. El bot de Discord se ha probado contra un sustituto que aplica el protocolo documentado de Discord.

## Las pantallas

**Panel** es la que se queda en la pared. Los tags fijados son indicadores con sus límites de alarma dibujados donde caen de verdad en el arco, y el último minuto de historial debajo. La disposición se guarda con la planta, no en un navegador, así que el PC de panel del taller y el portátil de la oficina muestran el mismo panel.

**Entidades** es la planta como la cuenta la gente, cada cosa bajo su lugar en el árbol. La calidad se dibuja antes que el valor: una lectura mala muestra su último valor bueno en gris y rayado, y nada que no se pueda creer parece algo creíble. Un operador que se fía de un número viejo es como se desborda un depósito. **Planta** es el editor del árbol.

**Resumen, Dispositivos, Tags, Tendencias, Alarmas, Automatizaciones y Protocolos** son las pantallas de trabajo. 4.17.0 añade cuatro: **Libro de registro** es la línea de tiempo, **Scripts** ejecuta secuencias con nombre y un formulario para sus campos, **Recetas** aplica un conjunto de consignas y muestra exactamente lo que salió (un valor que no se leyó de vuelta se ve en ámbar, nunca en verde), y **Blueprints** convierte una regla con huecos en una regla real, con **Comprobar antes** para ver qué haría antes de que exista. Desde 4.18.10, **Dispositivos** también lista lo que encontró el descubrimiento, en solo lectura hasta que un administrador lo acepta. **Sitios** lee de varias plantas, y un sitio que no responde aparece como inaccesible, con el motivo, y queda fuera del resumen. Contar como cero alarmas una planta a la que no se llega es como una oficina central decide que todo va bien en la peor noche del año.

**Ajustes** es con lo que el Gateway funciona de verdad: cada ajuste, su valor efectivo y si viene de la base de datos, de una variable de entorno o del valor por defecto. Cuando hace algo inesperado, aquí se averigua el porqué. Los interruptores de seguridad son de solo lectura ahí a propósito, porque el control maestro de si este proceso puede mandar sobre los equipos no debe estar detrás de la misma sesión de navegador que emite las escrituras.

## Dónde encaja en la gama

HotLoop es una sola base de código que se entrega como cuatro productos, todos publicados juntos desde una misma etiqueta: IoT, Edge, el Gateway y el Edge Relay. El Gateway es la cima: todo lo de IoT y Edge, más gestión de flota, resúmenes multisitio e informes programados. Las funciones separan los productos. Los protocolos jamás: todos los productos hablan todos los protocolos que tenemos, para que nadie tenga que subir de nivel para leer el PLC de su banco de pruebas. [La gama](/es/products/) detalla qué incluye cada uno.

Los cuatro se pueden instalar hoy, todos en {{hotloop}}. El relay tiene su propia imagen y su propio chart, unos 15 MB frente a los 37 del Gateway, sin base de datos ni interfaz. La gestión de flota del Gateway sigue y ordena a cada relay registrado, y es solo API (`/api/fleet`): no hay pantalla de Flota en la interfaz.

¿Lo va a usar en una planta? [Usar HotLoop en una empresa](/es/business/) explica las licencias y cómo contactarnos.

## Qué cambió, versión por versión

Cada versión tiene sus propias notas, y ahí está el detalle, para que esté en un solo lugar y no en dos.

- [4.23.2](/es/releases/hotloop-4-23-2/): una visualización CODESYS se importa como pantalla, el equipo informa de su propia salud al panel de EmberNet con un acceso que puede leer y nada más, y un contador de energía puede llevar un cargo por demanda. Esta compilación es solo amd64, y la siguiente versión es la pequeña que genera las imágenes arm.
- [4.23.1](/es/releases/hotloop-4-23-1/): estaciones meteorológicas y contadores de energía, la interfaz web en trece idiomas más, paneles que se exportan a un archivo y se importan en otra instalación, y los primeros comandos hacia una consola UniFi. 4.23.0 se etiquetó y nunca se publicó, así que esta versión incluye lo que listan sus notas. Esta compilación es solo amd64.
- [4.22.1](/es/releases/hotloop-4-22-1/): la compilación multiarquitectura de 4.22.0, sin cambios en el producto.
- [4.22.0](/es/releases/hotloop-4-22-0/): una página de panel llena la pantalla de borde a borde a cualquier tamaño, la pantalla Alarmas importa un archivo Export Alarms de CODESYS, y los dispositivos OPC UA PubSub en una misma dirección y puerto comparten un socket. Esta compilación es solo amd64, y 4.22.1 es la pequeña versión que genera las imágenes arm.
- [4.21.1](/es/releases/hotloop-4-21-1/): la compilación multiarquitectura de 4.21.0, sin cambios en el producto.
- [4.21.0](/es/releases/hotloop-4-21-0/): un cliente puede iniciar sesión en el servidor OPC UA con un certificado X.509 que un administrador asignó a un usuario (desactivado hasta `HOTLOOP_OPCUA_SERVER_ALLOW_X509=true`), entran las contraseñas OPC UA de 65 a 72 bytes, y las políticas de seguridad obsoletas `Basic128Rsa15` y `Basic256` quedan desactivadas por defecto, también al actualizar (`HOTLOOP_OPCUA_SERVER_ALLOW_DEPRECATED_POLICIES=true` las devuelve para un cliente antiguo). La importación de alarmas de CODESYS lee una alarma Outside range como un lo y un hi. Una migración, 0027, que solo añade una tabla.
- [4.20.2](/es/releases/hotloop-4-20-2/): un dispositivo EtherNet/IP con dos o más tags en un lote ya no hace entrar en pánico su sondeo, y `version` muestra la versión sin necesidad de configuración. La primera versión del núcleo bajo la EmberNet Source License 1.0.
- [4.20.1](/es/releases/hotloop-4-20-1/): la compilación multiarquitectura de 4.20.0, sin cambios en el producto.
- [4.20.0](/es/releases/hotloop-4-20-0/): la nueva interfaz web es la página de `/` y la antigua desaparece, con las mismas pantallas y controles, los colores de HotLoop, las pantallas agrupadas en Operar, Planta, Construir y Sistema, y una barra de cinco en el teléfono. MCP puede cambiar todo lo que puede leer: 128 herramientas, sesenta y cuatro que cambian la configuración y treinta y siete para las funciones propias del administrador, cada una es una ruta de la API ejecutada con su propio manejador y el permiso de esa ruta, un motivo obligatorio y el agente en la línea de auditoría, detrás de `allowMcpWrites`. Esta compilación es solo amd64, y la siguiente versión genera las imágenes arm.
- [4.19.11](/es/releases/hotloop-4-19-11/): las tarjetas de panel de consigna y de página de símbolo, una escritura en un tag CODESYS u OPC UA releída desde el PLC, un dispositivo CODESYS leído una vez por segundo, alarmas importadas desde un proyecto CODESYS, las pantallas UniFi que dibujan una traza antes del número, y un destino Kafka o Redpanda que dice por qué un broker rechaza las escrituras. Esta compilación es solo amd64, y la siguiente versión es la pequeña que genera las imágenes arm.
- [4.19.10](/es/releases/hotloop-4-19-10/): la compilación multiarquitectura de 4.19.8, sin cambios en el producto. No existe 4.19.9.
- [4.19.8](/es/releases/hotloop-4-19-8/): el botón Entradas anteriores del Libro de registro conserva su página, y todos los selectores de tags buscan en toda la planta. Incluye también los cambios de 4.19.6 y 4.19.7, porque ninguna se publicó.
- [4.19.5](/es/releases/hotloop-4-19-5/): la compilación multiarquitectura de 4.19.4, sin nada más.
- [4.19.4](/es/releases/hotloop-4-19-4/): escrituras de agentes y un token en cada endpoint MCP, escrituras escaladas que aterrizan bien, CODESYS por nombre de símbolo, un flujo de eventos Kafka, OPC UA PubSub sobre UADP y `hostNetwork`. No hay de 4.19.0 a 4.19.3, y las notas explican por qué.
- [4.18.11](/es/releases/hotloop-4-18-11/): PostgreSQL 17 con una actualización que se ejecuta sola (lea esta antes de actualizar una planta en marcha), SNMP y BACnet/IP mediante un único flujo de integraciones, inicio de sesión en quioscos con bloqueo, escalado de alarmas y una interfaz que se instala en el teléfono.
- [4.18.10](/es/releases/hotloop-4-18-10/): la gama de cuatro productos, la elección de base de datos, MQTT y descubrimiento de red, destinos del historiador y equipos que se actualizan solos. No hay de 4.18.0 a 4.18.9, y las notas explican por qué.
- [4.17.0](/es/releases/hotloop-4-17-0/): recetas, scripts, blueprints, ayudantes, el libro de registro y UniFi Network, solo lectura.

## Licencia

HotLoop Gateway está bajo la HotLoop Source License Agreement 1.0, como todos los productos de HotLoop. Es de uso gratuito y de código disponible, no código abierto según la OSI, y cada versión pasa a AGPL-3.0 o posterior cuatro años después de su publicación. El uso doméstico y de laboratorio es gratuito, y también el de escuelas, organizaciones sin ánimo de lucro y organismos públicos para sus propias operaciones. No hay claves de licencia ni nada que se desbloquee en tiempo de ejecución. [La página de licencia](/es/license/) incluye el texto, y [Usar HotLoop en una empresa](/es/business/) explica las dos formas de ejecutarlo en el trabajo.
