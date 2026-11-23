---
title: "Notas de versión: HotLoop core 4.19.4"
description: "Qué trae HotLoop core 4.19.4, qué cambia al actualizar y qué leer antes de tocar una planta en marcha."
sidebar:
  label: "4.19.4"
---

4.19.0, 4.19.1, 4.19.2 y 4.19.3 se etiquetaron y nunca se publicaron, así que no existe nada con ninguno de esos nombres y `stable` nunca se movió a ninguna. Esta es la primera versión con todo lo que listan sus notas, que incluye una cosa nueva desde la 4.19.1: los charts aceptan `hostNetwork`.

- La 4.19.1 añadió la corrección de eso y una más (un oyente de descubrimiento que decía estar activo antes de poder oír, más abajo) y se omitió antes de salir.
- La 4.19.2 añadió `hostNetwork`.
- Ambas están corregidas más abajo.
- Todo lo que había en las notas de la 4.19.0 (MCP, escrituras con escala, el inicio de sesión de la tienda, CODESYS, el flujo de eventos Kafka, OPC UA PubSub sobre UADP y las correcciones) está en las notas siguientes.

Lo nuevo desde la 4.19.1: los charts tienen un ajuste `hostNetwork`.

## hostNetwork

Todo chart de HotLoop con un pod (los del Gateway, IoT y Edge y el del Edge Relay) acepta `hostNetwork: true`. Está desactivado por defecto, y desactivado el chart genera exactamente lo mismo que el de la 4.19.1.

- **Para qué sirve.** Para un pod que tiene que oír lo que oye su nodo: multicast UDP en el loopback del nodo (un runtime de PLC en el mismo equipo que publica OPC UA PubSub a un grupo multicast por el loopback), o una segunda tarjeta de red. Una red de pods no lleva ninguna de las dos.
- **Qué hace.** El Deployment recibe `hostNetwork: true` y `dnsPolicy: ClusterFirstWithHostNet`, de modo que los nombres DNS del clúster siguen resolviéndose.
- **Qué significa para el pod.** Usa las direcciones y los puertos del nodo: la página responde en todas las direcciones del nodo en `service.targetPort`, así que elige un puerto que nada del nodo use y mantén la autenticación activada. Una NetworkPolicy no se aplica a un pod de red del host (el plugin de red del clúster las ignora). Fija el pod a su nodo con `nodeSelector`.
- **Un oyente en el loopback.** El suscriptor de OPC UA PubSub se une a un grupo en una tarjeta con nombre, por nombre o por dirección: `"interface": "127.0.0.1"` en las opciones del dispositivo lo une en la tarjeta de loopback.
- **Nada más.** El código es el que habría publicado la 4.19.1. La guarda de la versión ahora genera todos los charts con el ajuste y sin él y falla si alguna de las dos generaciones es incorrecta.

---

El resto de esta versión, de la 4.19.0 y la 4.19.1:

Dos cosas de la 4.19.4 cambian lo que hace una planta ya existente, así que léelas antes de tocar una en marcha. Los agentes por MCP ya pueden escribir, y el endpoint MCP siempre tiene un token. Y un valor que escribes en un tag con escala por fin llega al registro como querías, lo que significa que quien lo sorteaba con un apaño del comportamiento antiguo tiene que dejar de hacerlo. Todo lo demás es nuevo o una corrección.

Las notas completas están en el README: Qué cambió en 4.19.4.

### MCP está activado, escribe y siempre tiene un token

- **Los agentes ya pueden escribir, donde podía un operador.** MCP está activado en todos los productos HotLoop y lee y escribe. `allowMcpWrites` vale true por defecto en el código y en los tres charts. Un despliegue que tiene `allowWrites` activado y nunca definió `allowMcpWrites` recibe escrituras de agentes tras esta actualización, por la misma puerta que la pantalla: los permisos del usuario, la marca de escribible del tag y su rango siguen aplicándose.
- **`allowWrites` no cambió.** Sigue desactivado por defecto y sigue decidiendo si algo puede escribir, tanto la interfaz como los agentes. Si está desactivado, nada escribe, MCP incluido.
- **Un despliegue que guardó `allowMcpWrites: false` sigue desactivado.** Eso incluye uno instalado desde el App Store, que guarda cada respuesta. Cámbialo si quieres que los agentes escriban.
- **El endpoint nunca está abierto.** Los charts siempre fijan un token MCP. Un HotLoop iniciado sin `HOTLOOP_MCP_TOKEN` (una unidad Quadlet, un binario suelto) servía `/mcp` a cualquiera que pudiera llegar al puerto y solo registraba una advertencia. Ahora crea un token de 24 bytes en su primer arranque y lo guarda en su base de datos, de modo que cada réplica y cada restauración llevan el mismo. Una llamada sin el token es un `401`. Un token que hayas configurado nunca se sustituye.
- **Para obtener el token en una instalación suelta o con Quadlet:** `hotloop mcp-token` lo imprime. Si tienes un agente apuntando a `/mcp` en una de esas instalaciones sin token, deja de funcionar con esta actualización hasta que le des ese token. Es a propósito.
- **Quién hizo la llamada.** Un token estático dice qué cliente llamó, nunca qué persona. Con los ajustes OIDC activados, un inicio de sesión de Vord o una aserción del hub en `/mcp` hace que la auditoría nombre a la persona (`mcp:pat@example.com`), y un rol de escritura opcional restringe las escrituras por llamante además de los interruptores anteriores. Está desactivado salvo que lo configures, y el token sigue funcionando a su lado. [La página de MCP](/es/iot/mcp/) explica la configuración.

### Escrituras en un tag con escala

- **Qué estaba mal.** Un tag con escala, digamos 0.1 en un registro de temperatura que guarda décimas de grado, te muestra el valor de ingeniería: el registro dice 555 y la pantalla dice 55.5. Al escribir se iba en sentido contrario sin el mismo cuidado. Escribías 55.5 como consigna y HotLoop ponía 55 en el registro, que luego se leía como 5.5. Pasaba igual en todas las pantallas, por la API, desde una automatización, un script, una receta, un lazo y por MCP, porque todos pasan por la misma puerta de escritura. La fila de auditoría decía 55.5 todo el tiempo, así que nada parecía mal en el registro.
- **Qué cambia.** El número que escribes está en las unidades propias del tag, igual que el que lees. HotLoop quita la escala y el desplazamiento antes de enviar: 55.5 en un tag con escala 0.1 pone 555 en el registro y se lee como 55.5. Un tag sin escala ni desplazamiento no se toca en absoluto. Los bits, las bobinas, las cadenas y las escrituras Sparkplug y MQTT de un indicador tampoco se escalan.
- **Si lo sorteabas con un apaño, déjalo.** Si alguien ha estado escribiendo cuentas en bruto en un tag con escala para obtener el número correcto, escribiendo 555 para obtener 55.5, eso ahora envía 5550 y se lee como 555. Escribe el valor de ingeniería. Revisa tus tags con escala antes de actualizar: cualquier tag con una escala distinta de 1, o con desplazamiento, en el que alguien escriba a mano, desde una automatización o desde una receta, merece una mirada. Las recetas y automatizaciones que escribían cuentas necesitan que sus números pasen a valores de ingeniería en el mismo paso que la actualización.
- **Se rechaza un valor que el registro no puede contener.** Tras quitar la escala, una cuenta que no cabe en el registro, 7000 en un `uint16` con escala 0.1, se rechaza con un mensaje claro que nombra la cuenta y el registro, y no se envía nada. Antes se desbordaba en silencio: 70000 en un registro de 16 bits salía como 4464. Esto vale para los tipos enteros de Modbus, S7, EtherNet/IP y OPC UA.
- **Una receta con un valor que no cabe se rechaza entera.** Antes de su primera escritura se comprueba cada destino, así que una receta nunca se aplica a medias y luego se rechaza. En Modbus, S7 y EtherNet/IP la comprobación conoce el tipo de registro de cada tag por su dirección. En OPC UA, que es el camino a un runtime CODESYS, usa el tipo con el que llegó la última lectura del tag. Un tag que no se ha leído nunca desde que arrancó HotLoop aún no tiene tipo contra el que comprobar, así que una receta que lo apunte se rechaza en la escritura de ese tag, después de que se escribieran los destinos anteriores, y la aplicación registra cuáles. Leerlo una vez, cosa que el sondeo hace en el segundo siguiente a conectar, lo resuelve.
- **Una fracción de cuenta se corta.** Un registro guarda cuentas enteras, así que 12.34 en un registro con escala de décimas guarda 12.3, como siempre.
- **Lo que no cambió.** La comprobación de rango de un tag y la fila de auditoría usan el número que escribiste. La puerta de escritura, los permisos y las reglas de rechazo son los mismos.

### Una instalación desde la tienda te inicia sesión como tú mismo

El chart creaba una contraseña de administrador aleatoria en un Secret que el tenant no puede leer, así que una instalación desde la tienda acababa en un inicio de sesión sin salida. Con la clave pública del panel configurada, una petición con una aserción firmada válida para este tenant y este Service inicia sesión a esa persona, crea su usuario la primera vez, mantiene su rol al día con lo que envió el panel y la auditoría la nombra. Una aserción mala, caducada, de otro tenant o de otra app se rechaza, y el inicio de sesión local no se toca. Está desactivado salvo que se configure una clave, y los tres charts de producto toman la clave de la tienda. [Autenticación y usuarios](/es/iot/authentication/) tiene los ajustes.

### CODESYS, con los nombres que el programador dio a las variables

HotLoop lee y escribe un PLC CODESYS a través del propio servidor OPC UA del runtime, como documenta CODESYS: la Symbol Configuration de la aplicación, publicada bajo el modelo PLCopen IEC 61131-3. El descubrimiento lista lo que la aplicación exporta con los tipos y el acceso que el programador les dio, entrando en arrays y estructuras, y un tag es un símbolo IEC que se encuentra bajo el nombre que el proyecto dé a su PLC y su aplicación. Un reinicio, una descarga o un enlace perdido se lee como malo con el motivo y vuelve sin intervención. Lo comprobamos contra un runtime real 4.22.0.0 en pruebas ejecutando nuestro propio programa, con una escritura que responde la propia lógica del PLC, y contra un segundo programa de más de cien mil variables, leído en 2.4 segundos.

Esto toca un driver que las plantas ejecutan, así que con claridad: el driver OPC UA pedía 200 nodos por petición y nunca leía lo que el servidor permite. Un runtime CODESYS publica OperationLimits de 100 y rechaza más, y el driver respondía declarando float cada tag descubierto y sin leer ninguno de los tags de un dispositivo con más de cien. Ahora las peticiones se cortan según los límites que el servidor publica al conectar, y se reducen a la mitad cuando un servidor que no publica ninguno dice que son demasiadas. Un tipo de datos que es subtipo de uno estándar (un STRING, BYTE o TIME de CODESYS) se sigue hasta el tipo estándar, así que se tipa y se escribe como ese. Todo dispositivo OPC UA recibe esto, no solo los CODESYS.

### Un flujo de eventos Kafka

- **Qué es.** HotLoop puede enviar sus lecturas y su registro del sistema a cualquier broker que hable la API de Kafka: Apache Kafka, Redpanda y el resto de esa familia. Es un nuevo tipo de destino de historian, en Settings, Historian targets, así que tiene la cola, la puesta al día desde el historial propio de HotLoop y el estado que tienen esos. Las lecturas van a un topic y el registro del sistema (alarmas, dispositivos que suben y bajan, cambios) a otro, como JSON.
- **TLS y SASL.** SCRAM-SHA-256, SCRAM-SHA-512 y PLAIN (PLAIN solo sobre TLS), con tu propia CA si el certificado del broker no es de una pública. Los certificados de cliente, Kerberos y los inicios de sesión OAuth aún no son compatibles.
- **Es al menos una vez.** Una lectura puede llegar dos veces tras una caída, porque la puesta al día solapa a propósito lo que ya salió. `deviceId`, `tag` y `ts` identifican un duplicado. Los eventos son el feed en vivo y no tienen historial con el que ponerse al día, así que uno producido mientras el broker no está se pierde, y el estado del destino lo cuenta.
- **Un broker que desaparece a mitad de una escritura.** El destino se marca caído en 25 segundos y las lecturas de esa escritura quedan pendientes, en lugar de seguir activo con su cola desbordándose.
- **Un topic recién creado.** La primera consulta a un topic que se acaba de crear, por ti o por el último intento del propio destino, espera a que exista y tenga líder en lugar de informar que el destino está caído.
- **Lo que cuesta.** Unos 5 MiB en el binario de cada producto con base de datos. El Edge Relay no tiene destinos de historian y no lo lleva. El cliente es franz-go, citado en `NOTICE`.
- **Actualizar.** La migración 0026 añade una columna `options` a los destinos de historian, vacía para cada destino existente. Nada cambia para ellos. [Destinos de historian](/es/iot/historian-targets/#api-de-kafka-flujo-de-eventos) tiene los formatos de registro y lo que está y no está probado.

### OPC UA PubSub sobre UADP

- **Suscripción.** Un dispositivo con el protocolo `opcua-pubsub` escucha los DataSets de un publicador enviados como UADP sobre UDP, unicast o multicast. La dirección de un tag es `<DataSetWriterId>/<field index>`. Campos Variant, DataValue y RawData, tramas key, delta y keep alive. Un mensaje perdido marca los tags de ese writer como inciertos hasta su siguiente trama key, y un writer silencioso se lee como malo.
- **Publicación.** Edge y Gateway pueden publicar como UADP los tags que nombra un layout, desactivado hasta que se define `HOTLOOP_UADP_PUBLISH_ENABLED`. Tramas key cuando los valores cambian y keep alive cuando no. Un tag malo se publica como su estado, nunca como su último valor.
- **Todavía no.** La seguridad de mensajes (mensajes firmados o cifrados) se rechaza por su nombre, igual que los mensajes fragmentados, el descubrimiento, los eventos y los campos de estructura. Las tramas delta se leen pero no se envían.
- **Arrays.** Un campo que es un array se lee en mensajes Variant y DataValue, y en RawData cuando el DataSet del dispositivo dice cómo está dispuesto (`"Float[250]"` para un array con su recuento, `"Float*250"` para 250 campos separados). Un tag nombra un elemento, `1000/3[17]`, y Browse los lista.
- **Dónde escucha.** El grupo, el puerto y la tarjeta de red son del propio dispositivo. Funcionan un grupo multicast en una tarjeta con nombre y un puerto unicast en esta máquina.
- [Protocolos y drivers](/es/iot/protocols/#opc-ua-pubsub-uadp) tiene la configuración y los límites.

### Imágenes y un segundo conjunto de pantallas

- **Solo amd64, esta vez.** Las imágenes de la 4.19.4 están compiladas para amd64. La etiqueta de versión lista solo amd64, y `stable` y `latest` llevan la nueva imagen amd64 junto a las imágenes arm64 y arm/v7 que ya tenían, que son las de la versión anterior. Un equipo arm que sigue `stable` sigue descargando y ejecutando lo que ejecutaba. La siguiente versión vuelve a compilar todas las arquitecturas y es un aumento de versión sin nada más.
- **Las pantallas nuevas están en `/next`.** Una interfaz web reconstruida va en cada imagen detrás de la antigua, que sigue siendo la que recibes en `/`. Pruébala en `/next` en cualquier instalación; nada cambia en la predeterminada.

### Correcciones

- **Un proceso ya no detiene la siguiente ejecución de un script con su propia parada que le vuelve.** Detener un script se anuncia a todos los procesos, incluido el que hizo la parada, y el anuncio oído de nuevo un momento después cancelaba la ejecución de ese script que estuviera en marcha: bajo carga una ejecución esperada se cancelaba 8 ms después de empezar, y otra nunca terminaba. Un proceso ignora la parada que él mismo anunció, y una parada que anunció otro proceso sigue deteniéndolo.
- **Un oyente de descubrimiento está activo cuando el broker ha respondido a sus suscripciones, y solo entonces.** Una espera agotada contaba como respuesta, y también una respuesta en una conexión que ya se había ido; ya no cuenta ninguna, y una respuesta que llega tarde sigue contando.
- **Un oyente de descubrimiento dice que está activo cuando puede oír.** La sesión MQTT se daba por conectada en cuanto el broker la aceptaba, y solo entonces enviaba sus suscripciones y esperaba a que el broker las concediera. Un oyente que se declaraba activo con eso enviaba el siguiente mensaje al hueco, y el estado o la configuración de un dispositivo que no se retiene se perdía. Ahora se declara activo cuando se conceden las suscripciones, en la primera conexión y en cada reconexión.
- **Un pin en el tablero ya no borra el tablero.** La página solo leía el tablero cuando se abría la pantalla del tablero, así que una recarga en la pantalla de tags tenía una lista vacía y el primer pin sustituía el tablero guardado por ese único tag. Ahora la página lee el tablero al arrancar, un pin se rechaza hasta que lo ha hecho, y un guardado lleva el `rev` del tablero, de modo que el servidor responde `409` a un guardado sobre un tablero que cambió desde que se leyó. El `rev` es opcional en la API: si lo omites, el guardado no se comprueba.
- **Se detecta una suscripción OPC UA bloqueada.** La biblioteca se queda con sus keep alives, así que un bucle de publicación detenido parecía una planta tranquila y servía sus últimos valores como buenos. Tras diez intervalos de publicación en silencio (treinta segundos como mínimo) el driver lee los nodos una vez, los compara con lo que tiene y vuelve a lecturas si alguno difiere.
- **Un PLC que calla con su socket abierto está caído, no degradado.** Modbus, S7 y EtherNet/IP conservaban sus últimos valores hasta que TCP se rendía, porque el sondeo volvía antes de juzgar la sesión. Ahora la juzgan. Todavía no hay ningún servidor S7 ni CIP en el cable en las pruebas, y la hoja de ruta lo dice.
- **Una credencial escrita en una URL o en texto libre se cifra en reposo.** Cada pantalla ya ocultaba `mqtt://user:pass@host` y `?token=` a las personas, pero la base de datos y las copias de seguridad los guardaban tal como se escribieron. Una cadena que lleva uno, según la misma prueba con la que la redacción lo oculta, se sella entera y vuelve exactamente como se escribió, así que el driver sigue recibiendo la URL que se le dio. Una clave activada más tarde sella lo guardado antes, y una restauración pide la clave solo cuando solo hace falta una dirección.
- **Toda hora que escribe la API es UTC.** Una planta configurada en Nueva York escribía `-04:00` donde una en UTC escribía `Z`, en unos treinta campos: `created_at`, `updated_at`, el `raisedAt` de una alarma, la hora de un evento, el `lastPoll` de un dispositivo, la marca de tiempo de un tag, una entrada del logbook, la siguiente ejecución de un informe. Ahora se leen igual en ambas. Si las analizas en un script que esperaba tu desplazamiento local, ahora recibe `Z`.
- **Las particiones mensuales se saltaban el día 31.** Las tablas de historial y de logbook creaban su siguiente partición sumando un mes a hoy, y el 31 eso se saltaba un mes, de modo que las filas de un mes quedaban en la partición por defecto. Ahora parten del día uno del mes.
- **El registro de eventos de UniFi se ordena por cuándo ocurrió el evento,** no por cuándo llegó el fotograma aquí, así que una reproducción tras una reconexión deja de quedarse encima.
- **La placa frontal de un switch cabe en un teléfono.** Ocho puertos eran más anchos que una pantalla de 390 píxeles y la página se desplazaba 113 píxeles hacia el lado. Ahora los puertos son mosaicos compactos, con los vatios PoE en el detalle del puerto, y una placa que aún desborda su tarjeta se desplaza dentro de ella.
- **Un teléfono sin sesión y sin conexión recibe la pantalla de inicio de sesión y el motivo** en lugar de una aplicación vacía, y se recarga cuando HotLoop responde.
- **Un rollback es un solo comando.** El índice del chart se fusiona con el vivo en lugar de reconstruirse a partir de los charts de la propia versión, así que una versión anterior se sigue resolviendo.

### Actualizar desde 4.18.11

- Lee las dos primeras secciones anteriores antes de hacer nada en una planta en marcha.
- La migración 0026 es la única. Es aditiva y toda fila existente sigue funcionando.
- Una instalación suelta o con Quadlet recibe un token MCP en su primer arranque. `hotloop mcp-token` lo imprime.
- `helm upgrade` como siempre. Las unidades Quadlet siguen `:stable` y no necesitan nada. `helm rollback` a la 4.18.11 es correcto para esta versión: la base de datos ya es PostgreSQL 17 y nada de aquí la cambia.
