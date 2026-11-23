---
title: "Integraciones"
description: "Apunte HotLoop a un dispositivo con dirección conocida, vea lo que hay de verdad y conserve los puntos que quiera. SNMP, BACnet/IP y OPC UA, solo lectura."
---

Una integración es la forma de apuntar HotLoop a un tipo de dispositivo cuya dirección conoce, responder unas pocas preguntas, ver qué hay realmente en él y conservar los puntos que quiere. Crea el dispositivo y sus tags. Las entidades salen de los tags igual que con cualquier tag, así que los puntos nuevos están en la API de entidades, en las automatizaciones y en los paneles un minuto después.

Hay tres formas de que un dispositivo entre en HotLoop, y están pensadas para convivir:

| <span class="sr-only">Detalles</span> | Quién la inicia | Qué necesita |
|---|---|---|
| [Descubrimiento MQTT](/es/iot/mqtt-discovery/) | El dispositivo, anunciándose en un broker | Un publicador que hable uno de los formatos |
| [Descubrimiento de red](/es/iot/network-discovery/) | La red, por estar a la escucha | Nada del dispositivo; le dice lo que oyó y cómo podría hablar con él HotLoop |
| **Integraciones** (esta página) | Usted, con una dirección | Un dispositivo que responda a su propio protocolo |

Una integración nunca escribe en el dispositivo, y nada de lo que crea está armado. Un punto encontrado es un punto sobre el que nadie ha decidido todavía que se pueda mandar, así que todos los tags que crea una configuración son de solo lectura hasta que alguien los arma, uno por uno, en el editor de tags, igual que un tag de cualquier otro origen.

## Qué hay aquí

| Integración | Protocolo | Verificada con |
|---|---|---|
| Servidor OPC UA (`opcua`) | [OPC UA](/es/iot/protocols/#opc-ua) | Un servidor OPC UA real |
| Dispositivo SNMP (`snmp`) | [SNMP](/es/iot/protocols/#snmp) | Un agente SNMP real, v1, v2c y v3 |
| Dispositivo BACnet/IP (`bacnet`) | [BACnet/IP](/es/iot/protocols/#bacnetip) | Una pila BACnet independiente |
| PLC CODESYS (`codesys`) | [CODESYS](/es/iot/protocols/#codesys) | CODESYS Control for Linux SL 4.22.0.0, con dos programas PLC reales, uno mucho más grande |

Se añaden más sobre este marco a medida que se pueden probar con un servidor real.

## En el sentido contrario

Una integración trae un dispositivo. Para enviar las lecturas y los eventos de HotLoop a un broker Kafka, vea [el flujo de eventos de la API Kafka](/es/iot/historian-targets/#api-de-kafka-flujo-de-eventos) en los destinos del historiador: Apache Kafka y Redpanda, TLS y SASL, las lecturas en un topic y el registro del sistema en otro. Para enviarlos como OPC UA PubSub (UADP sobre UDP), o para leer los de un publicador, vea [OPC UA PubSub](/es/iot/protocols/#opc-ua-pubsub-uadp): leer uno es un dispositivo con el protocolo `opcua-pubsub`, sin flujo de configuración, porque un datagrama lleva posiciones de campos y no nombres.

## SNMP

Para un switch, un SAI, una PDU, un medidor de energía o cualquier cosa que ejecute un agente SNMP. Las preguntas dependen de la versión: v2c pide una comunidad, v3 pide un usuario y solo las frases de paso que necesita su nivel de seguridad. No hay comunidad por defecto.

La sonda recorre el grupo system, las tablas de interfaces, los recursos del host, la tabla de carga y las salidas extend de un agente SNMP, los objetos que HotLoop sabe nombrar, y muestra cada uno con lo que el agente dijo que contiene ahora mismo. **Sugiere** los que quiere quien apunta a un dispositivo nuevo: el nombre, la ubicación y el tiempo de actividad del dispositivo (en segundos, no en las centésimas del agente), el estado operativo y el recuento de errores de cada interfaz, sus contadores de bytes (los de 64 bits cuando el agente los tiene), los promedios de carga y las filas extend. En sus notas dice cuántos de los puntos sugeridos son contadores, porque un contador en un gráfico necesita una tasa.

Todo lo demás que tenga el agente sigue siendo legible: configúrelo a mano como un tag cuya dirección es el OID. Vea [el driver SNMP](/es/iot/protocols/#snmp) para saber en qué se convierte un tag, qué hace un objeto que falta y por qué una comunidad v2c equivocada parece un dispositivo muerto.

Aquí SNMP es siempre de solo lectura. HotLoop no envía SET.

## BACnet/IP

Para un controlador de automatización de edificios, un medidor, un termostato: cualquier cosa de la red IP que hable BACnet. Las preguntas son la dirección del dispositivo, la instancia del dispositivo si la conoce (y entonces HotLoop rechaza que responda otro dispositivo en esa dirección) y desde qué tarjeta de red enviar si la máquina tiene dos.

La sonda pregunta al dispositivo quién es, lee su lista de objetos y lee todos los objetos analógicos, binarios y multiestado que encuentra (y los valores enteros, analógicos grandes, acumuladores y cadenas de caracteres): nombre, descripción, unidades, valor actual e indicadores de estado. Muestra cada uno con lo que leyó ahora mismo y sugiere los primeros cien. Las unidades llegan como etiqueta y, cuando significan una, como clase de dispositivo, de modo que una entrada `degrees-celsius` es una temperatura en `°C`.

En sus notas dice cuántos objetos informan de un fallo (leen mal hasta que el dispositivo lo borra) y cuántos están fuera de servicio (leen incierto, porque el valor es el que se les escribió). La descripción de un objeto multiestado enumera sus estados, y su muestra enseña el estado además del número.

Aquí BACnet es siempre de solo lectura. HotLoop no escribe una propiedad ni llega a un dispositivo detrás de un router BACnet: vea [el driver BACnet/IP](/es/iot/protocols/#bacnetip) para saber qué se cubre y qué no.

## CODESYS

Para un PLC que ejecuta un runtime CODESYS Control. Las preguntas son las de OPC UA (dirección, seguridad, un nombre de usuario y una contraseña si la gestión de usuarios del PLC está activada) y, solo si las necesita, la parte de la aplicación que listar, los nombres del PLC y de la aplicación y cuántos elementos de un array listar.

La sonda se conecta al servidor OPC UA del runtime, encuentra el PLC y su aplicación y lista las variables que exporta la aplicación (su Symbol Configuration) con los nombres que escribió el programador, con sus tipos y si cada una se puede escribir. Sugiere las variables propias de la aplicación, no los elementos de sus búferes, y dice en sus notas cuántos arrays listó en parte. A un PLC sin nada exportado se le explica cómo exportar algo.

Un dispositivo CODESYS se lee una vez por segundo, que es la frecuencia con la que el driver pide al servidor OPC UA del runtime que mire cada variable, así que una pantalla va como mucho un segundo por detrás del PLC. El valor por defecto del propio runtime son cinco segundos, lo cual es lento para una pantalla: una bomba arranca y la página lo dice cinco segundos después. Cambie el intervalo de sondeo del dispositivo, o su `samplingIntervalMs`, para pedir más; el mínimo al que se somete cada dispositivo y los OperationLimits del servidor siguen aplicándose.

Configure con `"dashboard": true` en la petición y los puntos que conserve también reciben un panel con el nombre del dispositivo: un encabezado, una tendencia de los números que se mueven, las alarmas del dispositivo y una tarjeta de valor para cada punto bajo un encabezado para su lista de variables. Es una primera pantalla hecha a partir del programa tal como está, y se edita como cualquier panel. Nada en ella manda nada, y todos los tags siguen siendo de solo lectura hasta que se arman.

Un PLC con un runtime que se reinicia o un programa nuevo descargado se recupera solo: vea [el driver CODESYS](/es/iot/protocols/#codesys).

## El flujo

Tres llamadas, en orden, y las dos primeras no guardan nada.

1. **Preguntar.** `GET /api/integrations` lista todas las integraciones y sus preguntas. Cada pregunta tiene un tipo (`text`, `number`, `bool`, `choice` o `secret`), un valor por defecto, si es obligatoria y, cuando solo importa tras otra respuesta, `showWhen`. Una pantalla se dibuja a partir de eso y nada más, y por eso una integración nueva no necesita una pantalla nueva.
2. **Mirar.** `POST /api/integrations/{id}/probe` recibe las respuestas, las comprueba, se conecta al dispositivo real con el propio driver de la integración e informa de qué es y qué tiene: un nombre sugerido, lo que dice de sí mismo, notas que vale la pena leer y cada punto que encontró como un registro con forma de tag con un `sample` de lo que leyó, para que pueda compararlo con el número de la pantalla de la propia máquina.
3. **Conservar.** `POST /api/integrations/{id}/setup` recibe las mismas respuestas y los nombres de los puntos que se conservan (si no se nombra ninguno, conserva los marcados como `suggested`), crea el dispositivo y sus tags y recarga el runtime. El dispositivo queda habilitado y sondeando. Una integración que puede preparar un primer panel (CODESYS) lo hace cuando la petición lleva `"dashboard": true`, y responde con el id del panel.

La configuración vuelve a mirar el dispositivo en lugar de fiarse de la sonda. Lo que un cliente cree que encontró hace un minuto es una afirmación, y los puntos se comprueban contra el dispositivo tal como está cuando se crea. Un nombre que no está en él es un `400`, no un punto omitido, porque alguien lo pidió por su nombre.

Una configuración que falla a medias (el dispositivo guardado, los tags no) elimina el dispositivo que acaba de crear. Un dispositivo que ya existe se rechaza con un `400` en lugar de sobrescribirse: para añadir puntos a un dispositivo que ya tiene, use su Browse e Import.

## Las respuestas se comprueban antes de intentar nada

El marco comprueba cada respuesta contra su pregunta antes de que la vea una integración, e informa de todos los problemas a la vez, de modo que un formulario se arregla una sola vez:

* una pregunta obligatoria en blanco es "X is required";
* un número debe ser entero y estar dentro del rango de la pregunta, una opción debe ser una de sus opciones, un bool debe ser un bool;
* una respuesta a una pregunta que la integración no hace se rechaza, no se ignora, porque un `pasword` mal escrito que se descarta sin avisar es un dispositivo que no puede iniciar sesión sin ninguna pista de por qué;
* un secreto no puede ser el marcador `[redacted]` que la API muestra en lugar de uno guardado. Devolverlo guardaría el marcador como contraseña;
* una pregunta que no se muestra (`showWhen`) se ignora y no es obligatoria.

Las credenciales se guardan como las de un dispositivo: selladas en reposo cuando HotLoop tiene una clave de sellado, y ocultas en toda respuesta de la API y en todo error. Una sonda nunca guarda lo que se le dio.

## Cuando el dispositivo no responde

`502`, con lo que falló: "could not reach the device: ..." cuando nada se conectó, "connected, but could not list its points: ..." cuando se conectó y luego no respondió. Es la respuesta del dispositivo que hay que leer, no un fallo de HotLoop ni una petición incorrecta. Un puerto cerrado, una comunidad equivocada o un cortafuegos acaban aquí, y el mensaje es el del propio driver.

## Dónde encaja en el producto

La sonda y la configuración alcanzan la red desde la caja de HotLoop, así que las dos necesitan `devices.write`, igual que guardar un dispositivo. Listar necesita `devices.read`. Todos los productos las incluyen. Las rutas están en [la API HTTP](/es/iot/api/#integraciones).

## Añadir una

* `Info()` dice qué es: id, nombre, el protocolo del driver, cómo pedir la dirección y las preguntas;
* `Configure()` convierte las respuestas comprobadas en una dirección y en el bloque de configuración propio del driver, y rechaza lo que una pregunta no puede expresar;
* `Discover()` llega al dispositivo real e informa de lo que hay en él.

Al arrancar, el marco rechaza una integración que no pueda ser una entrada del catálogo: un id duplicado, un protocolo que el modelo no declara, una pregunta sin etiqueta, una opción sin opciones, un valor por defecto que no es una respuesta válida o un `showWhen` que nombra una pregunta que no existe. Una prueba también obliga a toda integración a usar un protocolo con un driver compilado.

Donde no hay un servidor real que ejecutar, no hay integración, y la [hoja de ruta](/es/roadmap/) dice cuáles esperan hardware.
