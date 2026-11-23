---
title: "Descubrimiento MQTT"
description: "Apunte ESPHome, Zigbee2MQTT, Tasmota o un Shelly al broker y aparece solo, de solo lectura hasta que un admin lo acepta y arma cada punto."
---

Apunte un dispositivo al broker de HotLoop y aparece. Sus sensores leen, sus interruptores muestran su estado, sus entidades tienen los nombres, unidades y clases que anunció. Nadie teclea una lista de tags.

Y no puede ordenar nada. Cada punto que crea el descubrimiento es de solo lectura, y se queda así hasta que un admin acepta el dispositivo y luego arma cada punto a mano, mirando el topic exacto al que irá el comando. Un dispositivo que se anuncia es un dispositivo que le dice qué es. Eso es útil. No es un dispositivo que se gana el derecho de accionar un relé de su planta, y HotLoop no finge que lo sea.

## Quién lo habla

El formato es el de los topics como `homeassistant/sensor/kitchen/power/config`. Lleva el nombre del proyecto que lo definió; HotLoop lo habla porque los publicadores lo hacen, y esa es toda la relación.

| Publicador | Cómo llega aquí | Contra qué lo probamos |
|---|---|---|
| **ESPHome** (su componente `mqtt:`) | por componente, activado por defecto, retenido | salida grabada de nodos reales (véase abajo) |
| **Zigbee2MQTT** | por componente, con plantillas en casi todo | salida grabada de instalaciones reales |
| **Tasmota** | su propio formato, abajo | salida grabada de nueve dispositivos reales |
| **Shelly** (Gen2, Gen3, Gen4) | ningún anuncio; se aprende de los estados que publica, abajo | salida grabada de quince conjuntos de mensajes reales y la documentación del fabricante |
| Cualquier otra cosa que publique el formato | lo mismo | las reglas del propio formato |

ESPHome se somete a grabaciones de nodos reales, igual que Zigbee2MQTT.

Las grabaciones son mensajes que publicó una instalación real, capturados por quien la opera, con el publicador, la versión y el dispositivo anotados y nada cambiado salvo los espacios en blanco del JSON.

## Tasmota

El Tasmota actual no publica el formato `homeassistant/`. Su documentación dice que se quitó de todas las compilaciones. Lo que publica, retenido, es lo suyo:

- `tasmota/discovery/<MAC>/config`: el dispositivo (su topic, su patrón de full topic, sus relés y luces, sus palabras de encendido y apagado, sus palabras de última voluntad);
- `tasmota/discovery/<MAC>/sensors`: lo que leen sus sensores en ese momento.

Ambos los escribe `TasDiscovery` en `xdrv_12_discovery.ino` de Tasmota (leído en arendst/Tasmota `development` 5c295fb, 2026-10-12). HotLoop convierte los dos en los mismos componentes que crea cualquier otro publicador, así que todo lo posterior (la pantalla Descubiertos, aceptar, armar, la puerta de escritura, la lectura) es un único camino de código. La MAC es la identidad del dispositivo; un dispositivo que además se anuncia en el formato `homeassistant/` (un firmware antiguo con SetOption19) es el mismo dispositivo.

| Tasmota dice | HotLoop crea |
|---|---|
| un relé (`rl` 1) | un interruptor: lee `stat/<topic>/POWER` (`POWER1`, `POWER2` y así cuando hay más de uno), con las palabras de encendido y apagado del propio dispositivo; ordena `cmnd/<topic>/POWER[n]` con ON u OFF |
| una luz (`rl` 2) | una luz: encendido y apagado igual. Con un regulador, su nivel es la clave `Dimmer` de `tele/<topic>/STATE`, de 0 a 100, y se fija con `cmnd/<topic>/Dimmer` |
| cada número del mensaje de sensores | un sensor cada uno, leído de `tele/<topic>/SENSOR` por su ruta (`ENERGY` `Power`, `SCD40` `CarbonDioxide`), con la unidad y la clase que Tasmota da a ese nombre. La matriz de un medidor trifásico es un sensor por fase |
| su última voluntad | disponibilidad: `tele/<topic>/LWT`, con las palabras Online y Offline del propio dispositivo |

Los topics se construyen como los construye Tasmota: su full topic con `%prefix%` y `%topic%` rellenados, de modo que un dispositivo cuyo dueño cambió el full topic (`tasmota/35D7A0/%prefix%/`, o `bi/test/%topic%/%prefix%`) lee y ordena en los topics que realmente usa.

Lo que no lee, lo dice, en los problemas de la fuente y nunca callando: persianas, una entrada de interruptor, un botón, un iFan, una cámara, los colores de una luz de color y el brillo de un dispositivo con más de una luz. Nada en las grabaciones muestra que alguno de esos funcione, así que aquí no se afirma que se lean.

**Preguntar.** Tasmota informa de un relé cuando cambia y de todo cada cinco minutos. Así que cuando empieza a leerse un dispositivo, HotLoop envía un mensaje vacío a `cmnd/<topic>/POWER`, que Tasmota responde con el estado de cada relé sin mover nada; sin él, un dispositivo que no ha cambiado lee desconocido hasta cinco minutos después de que HotLoop arranque. El mensaje está vacío, va a un topic que termina en `POWER` y nada más, y una fuente solo de escucha no envía nada en absoluto.

**El brillo de una luz** llega con la telemetría de Tasmota (cada cinco minutos salvo que el `TelePeriod` del dispositivo sea menor), no en el momento en que cambia. El encendido y apagado llegan al instante.

**En cada broker** el formato es un interruptor (`tasmota` en el broker, en Ajustes, MQTT). Un broker añadido ahora lo tiene activado; el broker integrado siempre lo tiene; un broker que ya existía sigue escuchando exactamente como antes, así que está desactivado hasta que alguien lo active. Desactivado significa que HotLoop ni siquiera se suscribe a `tasmota/discovery/#` allí.

Una configuración no es de fiar, como cualquier otra. Una publicada bajo una MAC que no es la que dice ser, un full topic sin `%topic%` o con un comodín, un topic con una barra, una palabra de encendido con comillas, una versión que no conoce: cada una se rechaza con el motivo y no se crea nada. El nombre de un sensor con comillas nunca llega a una plantilla.

**Contra qué se probó.** Mensajes reales de nueve dispositivos, capturados de la propia consola de Tasmota:

| Grabación | Dispositivo | Fuente |
|---|---|---|
| esp32-8relay-13.4.0 | placa ESP32, 8 relés, Tasmota 13.4.0 | github.com/arendst/Tasmota/issues/20953 |
| esp32-zigbee-gateway-reboots-15.3.0.1 | ESP32 sin relés, tres arranques | github.com/arendst/Tasmota/issues/24487 |
| esp8266-sps30-scd40-airsensor-14.1.0 | sensor de CO2 y partículas, 14.1.0 | github.com/arendst/Tasmota/issues/24780 |
| esp8266-sps30-scd40-airsensor-15.4.0-invalid-json | la misma caja con 15.4.0, cuyo firmware publicaba JSON con una coma final | la misma incidencia |
| nous-a1t-energy-plug-14.5.0 | enchufe NOUS A1T con medición de energía | github.com/arendst/Tasmota/issues/23094 |
| olimex-esp32-poe-counter-custom-fulltopic-14.5.0 | contadores y un medidor trifásico, full topic cambiado | github.com/arendst/Tasmota/issues/23775 |
| shelly-dimmer2-15.3.0.3 | Shelly Dimmer 2 con Tasmota | github.com/arendst/Tasmota/issues/24560 |
| tuyamcu-energy-meter-custom-fulltopic-14.5.0 | medidor de energía TuyaMCU, full topic cambiado | github.com/arendst/Tasmota/issues/23165 |
| wemos-2relay-15.1.0.1 | dos relés, del registro de la propia consola del autor de Tasmota | github.com/arendst/Tasmota/issues/24006 |

Son grabaciones, no un dispositivo en el banco. Lo que las grabaciones no tienen es el brillo (la línea `tele/STATE` del propio regulador estaba ilegible en su registro de origen; su clave `Dimmer` está en el `STATUS11` de la misma grabación, que Tasmota construye con la misma función) y la consulta de potencia respondida (las grabaciones muestran la pregunta y la respuesta, desde la consola de Tasmota, no a HotLoop preguntando).

## Shelly

Un Shelly Gen2, Gen3 o Gen4 no anuncia nada. No hay topic de configuración que esperar. Lo que hace, una vez activado MQTT y activadas sus notificaciones de estado, es publicar el estado completo de cada componente en `<prefix>/status/<component>` (`switch:0`, `cover:0`, `light:0`, `input:0`, un virtual `boolean:200`) cada vez que cambia, y su última voluntad en `<prefix>/online`. Así que HotLoop conoce el dispositivo por lo que dice: los componentes que ha publicado, los campos que cada uno ha traído y la MAC de su estado `sys`. El prefijo es por defecto el id del dispositivo (`shellyplus2pm-485519968144`), que es su modelo y su MAC, así que un dispositivo con su prefijo por defecto ni siquiera espera a `sys`. Uno con un prefijo que alguien tecleó (`ShellyLichtGarten`) tiene que publicar `sys` antes de poder distinguirse de otro, y hasta entonces se nombra en los problemas de la fuente y no se crea.

Lo aprendido se guarda, por prefijo, y solo crece. Un componente que se queda callado no se ha eliminado, y un estado con menos contenido que el anterior no quita nada, así que un reinicio no hace que un dispositivo pierda partes. Todo lo que sigue es el mismo camino que con cualquier otro publicador: la pantalla Descubiertos, aceptar, armar cada punto, la puerta de escritura, la lectura.

| Shelly dice | HotLoop crea |
|---|---|
| `switch:n` con un `output` | un interruptor: lee `output` de `<prefix>/status/switch:n`; ordena `<prefix>/command/switch:n` con `on` u `off` |
| `light:n` | una luz igual, con `set,true` y `set,false`; con `brightness` en su estado, un nivel de 0 a 100, enviado como `set,true,<level>` |
| `cover:n` | una persiana: lee `state` (open, closed, opening, closing, stopped) y envía `open`, `close` y `stop`. Una persiana que dice `pos_control` está calibrada, así que también lee `current_pos` y se le envía `pos,<n>`; una que no lo está solo abre y cierra |
| `apower`, `voltage`, `current`, `freq`, `pf`, `aenergy.total`, `temperature.tC` en un switch, light o cover | un sensor cada uno, en W, V, A, Hz, Wh y grados C, con la clase que les da la documentación de Shelly |
| `input:n` | un sensor binario de su `state` |
| `devicepower:n`, `voltmeter:n`, `illuminance:n`, `presencezone:n` | sensores y sensores binarios de batería, alimentación externa, tensión, nivel de luz, presencia y número de objetos |
| `boolean:n`, `number:n`, `enum:n` (componentes virtuales) | sensores de solo lectura. Fijar un componente virtual es una llamada RPC, que esto no hace, y cada uno se dice en los problemas de la fuente |
| su última voluntad `online` | disponibilidad, con los `true` y `false` propios de Shelly |

Los comandos son los que la página MQTT del fabricante enumera en MQTT Control, y las pruebas obligan a HotLoop a ceñirse a esa lista: `on`, `off` y `toggle` para un interruptor; `set,<bool>,<brightness>` para una luz; `open`, `close`, `stop` y `pos,<n>` para una persiana. Cada uno es una escritura a través de la puerta, armada por una persona.

**Preguntar.** Un Shelly publica un componente cuando cambia, así que un dispositivo que no ha cambiado leería desconocido hasta que lo haga. Cuando empieza a leerse un dispositivo, HotLoop envía `status_update` a `<prefix>/command`, que según esa misma página hace que el dispositivo publique el estado de sus componentes y no mueve nada. Es esa palabra, a un topic que termina en `/command` y nada más, y una fuente solo de escucha no envía nada en absoluto. Ocurre cada vez que empieza la lectura del dispositivo, así que armar varios puntos seguidos pregunta varias veces.

**Qué debe tener activado el dispositivo.** MQTT habilitado, con la dirección del broker; las notificaciones de estado activadas (`status_ntf`); y, para los comandos, el control activado (`enable_control`). El broker propio de HotLoop tiene un perfil de acceso `shelly`, con el nombre del prefijo del dispositivo, que le permite publicar sus estados y oír `<prefix>/command` y nada más.

**Lo que no lee.** Dicho, en los problemas de la fuente, nunca callando: un componente de un tipo que no se le ha mostrado (`lora:100` en un Gen4 con el complemento LoRa, un `pm1`, un `em`), un switch o un cover que ha omitido el campo del que se lee, y el ajuste de un componente virtual. Los eventos de entrada (una doble pulsación, una pulsación larga) llegan en el topic de notificaciones RPC, `<prefix>/events/rpc`, y no se leen; solo se lee el `state` de una entrada. Un prefijo con más de dos niveles (`home/garage/boiler`) no se oye; uno o dos sí. No se envía nada por RPC.

**En cada broker** es un interruptor (`shelly` en el broker, en Ajustes, MQTT). Un broker añadido ahora lo tiene activado; el broker integrado siempre lo tiene; un broker que ya existía sigue escuchando exactamente como antes, así que está desactivado hasta que alguien lo active. Es un interruptor porque los topics en los que escucha, `+/status/+`, son amplios, y un broker que lleva otra cosa bajo `*/status/*` lo quiere desactivado. Desactivado significa que HotLoop no se suscribe a ellos allí.

No es de fiar, como cualquier otro topic. Se ignoran un prefijo que no sea letras, dígitos y `_.-`, un componente que no sea `kind:number`, una carga que no sea un objeto o supere 64 KiB, un dispositivo que declare más de 64 componentes y más de 512 dispositivos aprendiéndose a la vez, y se rechaza una estructura guardada bajo un prefijo que dice ser otro.

**Contra qué se probó.** Quince conjuntos de mensajes reales y la documentación del propio fabricante.

| Grabación | Dispositivo | Fuente |
|---|---|---|
| plus-1-fw1.4.2-switch-rpc | Plus 1, firmware 1.4.2 | github.com/iobroker-community-adapters/ioBroker.shelly/issues/1055 |
| plus-2pm-cover-mode | Plus 2PM como persiana enrollable, calibrada | el mismo repositorio, issues/1088 |
| 1pm-mini-gen3-fw2.0.0-switch | 1PM Mini Gen3, 2.0.0 | el mismo, issues/1592 |
| 2pm-gen3-fw2.0.1-beta3-switch | 2PM Gen3, 2.0.1-beta3, dos canales | el mismo, issues/1627 |
| 2pm-gen4-lora-addon | 2PM Gen4 con el complemento LoRa | el mismo, issues/1349 |
| plug-s-gen3-fw2.0.1-beta1-switch | Plug S Gen3 | el mismo, issues/1594 |
| pro4pm-gen2-fw2.0.1-switch-set | Pro 4PM, 2.0.1, con la MAC del autor ocultada | el mismo, issues/1640 |
| pro-dimmer-2pm-fw1.3.0-light | Pro Dimmer 2PM | el mismo, issues/974 |
| dimmer-gen3-light-sys | Dimmer Gen3 | github.com/enesbcs/shellyteacher4domo/issues/65 |
| pill-gen3-fw1.8.99 | Pill, 1.8.99, con un voltímetro | el repositorio de ioBroker, issues/1232 |
| presence-gen4-fw2.1.99-dev | Presence Gen4, tres zonas | el mismo, issues/1228 |
| frankever-sprinkler-virtual-components | un controlador de riego con prefijo propio, componentes virtuales | el mismo, issues/1207 |
| official-docs-component-status | los ejemplos de componentes del fabricante: Plus 1PM, Plus 2PM, H&T, Pro 1, WDUS | shelly-api-docs.shelly.cloud |
| official-docs-mqtt-control | los comandos MQTT Control del fabricante | el mismo |
| official-docs-mqtt-page, official-docs-notifications | la página MQTT del fabricante y sus ejemplos de notificaciones | el mismo |

Dos de ellos no se pueden convertir en un dispositivo, y las pruebas lo dicen: el prefijo del Pro 4PM tiene la ocultación del autor (`xxxx`) y ningún `sys`, y el de la luz del jardín es un prefijo propio que tampoco lo tiene. Ambos esperan su MAC, como lo haría uno real.

**Esto está verificado contra grabaciones y la documentación, y no contra un Shelly en el banco.** Todavía no hay ninguno aquí. Los estados son lo que publicaron dispositivos reales, los topics que HotLoop lee son topics que esos dispositivos usaron, y los comandos tienen las formas que documenta el fabricante. Lo que las grabaciones no pueden mostrar: un comando que realmente mueva un relé, una persiana que realmente llegue a una posición y la respuesta a `status_update`. Cuando haya un Shelly en el banco, esas son las tres cosas que probar primero.

## Qué ocurre cuando algo se anuncia

1. **Aparece.** En el broker integrado, un dispositivo que se anuncia es de inmediato un dispositivo de HotLoop: protocolo `mqtt`, sin colocar en el árbol, con el nombre que se dio a sí mismo (`kitchen-plug`, y luego `-2` si hay colisión), leyendo. Sus tags llevan el nombre de lo que anunció (`power`, `relay`). Sus entidades reciben el nombre, la clase de dispositivo, la clase de estado, la unidad, la categoría y el icono que dio la configuración, y una entidad que la configuración marca como desactivada por defecto empieza deshabilitada.
2. **Nada está armado.** Cada tag se crea de solo lectura. Un interruptor, un número o un texto recibe de inmediato su entidad de control, sin armar (`armed: false`), así que una pantalla o una automatización puede nombrar `switch.kitchen_plug_relay` desde el primer día. Empieza a funcionar en el momento en que una persona arma el punto, y no antes.
3. **Decide un admin.** Dispositivos, Descubiertos. Quién lo anunció (en el broker integrado, el acceso y el id de cliente que publicaron su configuración), cada componente que crearía, cada topic que lee, cada topic de comando completo y qué mirar:

   - un topic de comando fuera de los topics que lee el componente (una "lámpara" cuyos comandos van a `cmnd/boiler/POWER`);
   - un topic de comando dentro del prefijo de descubrimiento, o uno que otro dispositivo también reclama;
   - una configuración que pide comandos retenidos, porque un comando retenido se repite cada vez que el dispositivo se reconecta;
   - plantillas que HotLoop no puede evaluar, y claves de configuración que el formato no define.

   **Aceptar** lo mantiene leyendo y hace que sus puntos se puedan armar, uno a uno, en el editor de tags. No arma nada. Si el dispositivo sugirió un área y un nodo del árbol tiene exactamente ese nombre, el diálogo de aceptar la rellena de antemano. Un publicador no puede archivarse a sí mismo bajo Sala de calderas; una persona pulsa aceptar. **Ignorar** descarta el dispositivo, los tags y las entidades (el historial se queda, como el de cualquier dispositivo) y lo mantiene descartado cuando vuelve a anunciarse. Eliminar un dispositivo descubierto equivale a ignorarlo, porque uno que sigue anunciándose simplemente volvería.

## Cuando cambia de opinión

**Un acceso distinto se retiene para revisión, diga lo que diga.** En el broker integrado, un dispositivo recuerda el acceso desde el que se aceptó. El mismo dispositivo anunciado por otro acceso se retiene para revisión con los dos accesos lado a lado, incluso cuando la configuración es palabra por palabra la misma, y el registro recibe una advertencia. O alguien movió el dispositivo a un acceso nuevo, o un acceso anuncia un dispositivo que no es suyo. Aplicar, y el nuevo acceso es desde el que se acepta. Rechazar, y ese acceso que anuncia lo mismo sigue rechazado.

**Una configuración que cambia bajo un dispositivo aceptado se retiene para revisión.** La configuración aceptada sigue funcionando. La pantalla Descubiertos muestra el cambio campo por campo, en ejecución frente a anunciado, y un admin lo aplica o lo rechaza. Una unidad que pasa de °C a °F, o un topic de estado apuntado a otra parte, es exactamente como un número equivocado gana una cara de confianza. Aplicar un cambio nunca cambia si un punto está armado: esa fue la decisión de una persona y sigue siéndolo.

Una actualización de firmware, un nombre de dispositivo nuevo, un modelo nuevo o un icono distinto se aplican solos. Nadie debería tener que pulsar nada por un cambio de versión.

Antes de que nadie acepte un dispositivo, el anuncio más reciente siempre se aplica: todavía nadie ha construido sobre él.

**Una configuración vacía retira un componente.** Sus puntos leen mal, diciendo "retirado por el publicador a las 14:02", y no se borra nada. Una alarma sobre ese punto conserva su objetivo y dice por qué es mala. Si el mismo componente vuelve, se restablece, y hasta que envíe un valor nuevo lee "anunciado de nuevo tras una retirada; esperando su siguiente valor" en lugar de hacer pasar el valor anterior a su salida. Un dispositivo que nadie aceptó y que retira todos sus componentes desaparece, porque nadie construyó sobre él.

**Zigbee2MQTT al renombrar un dispositivo** borra sus topics de configuración antiguos y anuncia otros nuevos con los mismos ID únicos. HotLoop identifica los componentes por el ID único, así que eso es una retirada y un restablecimiento con un segundo de diferencia, y no se pierde nada.

## Lectura

Un estado pasa por la plantilla de valor del componente, si la tiene, y luego por la coincidencia propia del componente: `payload_on`/`payload_off` para un sensor binario (`ON`/`OFF` por defecto), `state_on`/`state_off` para un interruptor, un número para un número, una de las opciones para un select. **Todo lo que no encaja es una lectura mala con el motivo**, mostrada en el mosaico:

- `"CLOSE" is neither payload_on "CLOSED" nor payload_off "OPEN"`
- `value_json has no key 'temperature'`
- `"unavailable" is not a number`
- `the publisher sent no value` (envió `None`, `null`, nada o `unknown`)
- `no update for 300 s (expire_after)`

El primero es real: Zigbee2MQTT 1.41.0 anuncia así el sensor de ventana de una Avatto TRV07, y quien lo capturó abrió una incidencia porque la ventana nunca aparecía. HotLoop lo muestra como malo y dice por qué en lugar de adivinar.

**La disponibilidad** es el enlace del dispositivo, no una lectura. Mientras el dispositivo diga que está desconectado en su topic de disponibilidad, aparece desconectado con sus propias palabras ("the device says it is offline (plug/status = offline)") y sus entidades no están disponibles. Hasta que llega el primer mensaje de disponibilidad, un dispositivo con disponibilidad configurada no está disponible. Esa es la regla del formato, y es la correcta. La sesión con el broker no se corta por ello: es compartida con todos los demás dispositivos de ese broker.

`expire_after` vuelve mala una lectura tras esos segundos sin actualización. `off_delay` apaga un sensor binario tras esos segundos, porque la configuración dice que el dispositivo nunca envía el apagado. Los atributos JSON llegan a la entidad, hasta 64 claves y 8 KiB, por debajo de los propios de HotLoop (`friendly_name`, `source`, `armed` y los demás siempre ganan).

Un componente sin topic de estado lee mal para siempre. HotLoop nunca supone un estado a partir de un comando.

## Comandos

No se ordena nada hasta que se cumplen tres cosas, en este orden:

1. **Una persona aceptó el dispositivo.** Hasta entonces el editor de tags no arma ningún punto en él ("acepte primero el dispositivo"), y la puerta de escritura rechaza por su cuenta sus comandos, así que una fila editada a mano o una copia de seguridad antigua con el punto armado tampoco llega a nada.
2. **Una persona armó el punto**, en el editor de tags, de uno en uno. Antes de la casilla, el editor dice adónde van los comandos y qué envían: "Commands go to `plug/relay/set`, sending ON or OFF."
3. **La puerta de escritura deja pasar el comando**, como cualquier otra escritura: escrituras activadas, el interruptor MCP para un agente, el rango del tag, las comprobaciones propias de la entidad, una sesión activa. Auditado con su id de llamada, rechazado o no. La simulación hace exactamente las mismas preguntas.

Lo que sale es lo que dice la configuración: `payload_on` y `payload_off` para un interruptor, `payload_press` para un botón, la opción para un select, el valor para un número o un texto (un entero como entero, `5` y no `5.0`), a través de la plantilla de comando de la configuración si la tiene. Un botón se pulsa una vez. Su "suelta" sería un segundo comando que el dispositivo nunca pidió, así que un botón descubierto es de un solo disparo.

Una luz recibe `payload_on`/`payload_off` (una luz de esquema JSON, `{"state":"ON"}`), y un brillo en porcentaje escalado a su propio `brightness_scale` y redondeado, en su topic de comando de brillo (una luz de esquema JSON, `{"state":"ON", "brightness":128}`). Una persiana recibe `payload_open`, `payload_close` o `payload_stop`, y una posición escalada del porcentaje a su propio `position_closed`..`position_open` mediante `set_position_template`. Una válvula recibe sus cargas de abrir y cerrar (una válvula que informa de una posición, sus `position_open` y `position_closed`), una posición en su topic de comando y `payload_stop` una vez: como un botón, la parada de una válvula descubierta es de un solo disparo. Una carga que la configuración desactiva con `null` (una persiana sin parada) es un comando que la puerta rechaza con el motivo.

La puerta rechaza un comando, con el motivo, cuando:

- nadie ha aceptado el dispositivo;
- el broker en el que está es de solo escucha;
- el publicador retiró el componente;
- su plantilla de comando está fuera del subconjunto ("command template not supported: filter `regex_replace` is not supported at column 12"). Nunca es "enviar el valor sin procesar";
- su configuración no tiene topic de comando;
- su configuración no tiene carga para lo pedido: una parada en una persiana cuya configuración dice `payload_stop: null`, una opción que un select no tiene, un brillo superior al 100 %. La carga se genera en la comprobación, así que la simulación también dice que no.

**Los comandos retenidos siguen la configuración.** Si una configuración pide `retain: true`, HotLoop publica retenidos los comandos de ese componente, y lo dice en todos los sitios en que una persona decide sobre él: la pantalla Descubiertos lo marca y el editor de tags lo dice con palabras claras. Entienda lo que eso significa antes de armar uno: el broker conserva el último comando y se lo entrega al dispositivo cada vez que se reconecta, a las tres de la mañana, sin la mano de nadie sobre nada. El comando pasó por la puerta y sigue en la pista de auditoría con un nombre al lado; simplemente vuelve a ocurrir.

En ningún sitio existe un "publicar esto en aquel topic": ni en automatizaciones, ni en scripts, ni en MCP. Eso sería una puerta lateral alrededor de la puerta con un nombre más bonito. En el código, dos cosas del descubrimiento publican: la escritura del driver, a la que solo llega la puerta, y el nacimiento. Una prueba de guarda comprueba los tipos del paquete del driver y rompe la compilación si cualquier otra cosa llama a cualquiera de los dos, con un bypass plantado para demostrar que muerde.

## Plantillas

Sin Python, sin motor Jinja. Sin bucles, así que una plantilla cuesta lo que cuesta su longitud.

`{% set name = value %}` está dentro, y solo con esa forma: Zigbee2MQTT escribe el modo de cada termostato como `{% set values = {'manual':'heat', ...} %}` y luego lo consulta, y un termostato cuyo modo no se puede leer es un termostato en el que no se puede confiar. Sin espacio de nombres, sin desempaquetado, sin forma de bloque. `.keys()` también está dentro, solo como lado derecho de `in`, porque es el único lugar donde esas plantillas lo usan.

| <span class="sr-only">Detalles</span> | <span class="sr-only">Detalles</span> |
|---|---|
| Estructura | texto, `{{ expr }}`, `{% if %}` / `{% elif %}` / `{% else %}`, `{% set name = value %}`, `{# comments #}`, control de espacios con `-` |
| Variables | plantillas de valor: `value`, `value_json` (solo cuando la carga es JSON), `entity_id`, `name`; plantillas de comando: `value`, `entity_id`, `name` |
| Expresiones | literales, `.attr`, `['key']`, `[0]`, rebanadas, `+ - * / // % **`, `~`, comparaciones, `and or not`, `in`, `x if c else y`, `.get(key, default)` en un mapa, `in mapping.keys()` |
| Pruebas | `defined`, `undefined`, `none`, `number`, `integer`, `float`, `boolean`, `string`, `mapping`, `sequence`, `true`, `false`, `eq`, `ne`, `lt`, `le`, `gt`, `ge`, `in`, `odd`, `even`, `divisibleby` |
| Filtros | `float`, `int`, `round`, `bool`, `default`/`d`, `string`, `lower`, `upper`, `capitalize`, `title`, `trim`, `replace`, `truncate`, `abs`, `length`/`count`, `min`, `max`, `tojson`, `to_json`, `from_json`, `is_defined`, `iif` |
| Funciones | `float()`, `int()`, `bool()`, `iif()`, `min()`, `max()` |

Donde el formato documenta un filtro de manera distinta del Jinja estándar, HotLoop sigue al formato. El que importa: **`float` e `int` sin valor por defecto fallan** ante algo que no es un número. El Jinja estándar devuelve `0` sin avisar, y ese es el cero que dice que el depósito está vacío cuando el sensor dejó de responder.

Los valores se representan como los representa el `str()` de Python, porque contra eso se escribieron las configuraciones de todos los publicadores: `True`, `None`, `21.0` sigue siendo `21.0`. No es cosmético. El sensor de contacto de Zigbee2MQTT anuncia `payload_on: false` y coincide con el `False` representado.

**Una clave que falta es un error salvo que se haya tratado.** `{{ value_json.temperature }}` sobre una carga que no la tiene es una lectura mala que lo dice, no una cadena vacía. `default`, `is defined` y un `{% if value_json.x %}` a secas lo tratan a propósito, y están bien.

**Fuera del subconjunto, se rechaza cuando llega la configuración**, con el lugar: "value template not supported: filter `regex_findall_index` is not supported at column 12". El componente se crea igualmente, para que se vea que existe, y lee mal con ese motivo. No hay un renderizado parcial de mejor esfuerzo ni un "usar la carga sin procesar". Dos plantillas reales se rechazan a propósito: `now()` (un valor que depende de cuándo lo evaluó HotLoop no es una lectura del dispositivo), y una plantilla de evento de Zigbee2MQTT que construye patrones regex con espacios de nombres y `regex_findall`.

Límites: 4 KiB de plantilla, anidamiento de 32 niveles, 64 KiB de salida, enteros de 64 bits (un desbordamiento es un error, no un envolvimiento).

Los propios filtros del formato, que no son Jinja estándar, tienen casos escritos a mano que citan el comportamiento documentado al que cada uno nos obliga. Cada plantilla de las grabaciones tiene que analizarse.

## Qué construye HotLoop a partir de qué

| Componente | Tag | Entidades |
|---|---|---|
| `sensor` | `float` cuando tiene unidad, clase de estado o una clase de dispositivo numérica, si no `string` | sensor |
| `binary_sensor` | `bool` | binary_sensor |
| `switch` | `bool` | binary_sensor, y una entidad de control switch, sin armar |
| `number` | `float`, con el `min`/`max` de la configuración como rango del tag | sensor, y una entidad de control number, sin armar, con mínimo, máximo y paso |
| `text` | `string` | sensor, y una entidad de control text, sin armar |
| `select` | `string`, que lee solo una de sus opciones | sensor, y un select con las opciones de la configuración, sin armar |
| `button` | `string`, que acepta una pulsación y no lee nada | un botón de un solo disparo, sin armar (la entidad de lectura del propio tag se crea oculta) |
| `light` | `bool` encendido/apagado; `float` brillo de 0 a 100 % cuando lo tiene | una luz, sin armar |
| `cover` | `string` de estado, que también acepta `open`, `close` y `stop`; `float` posición de 0 a 100 % cuando la tiene | una persiana, sin armar |
| `valve` | `string` de estado; `float` posición de 0 a 100 % si informa de una; `bool` de comando (abrir o cerrar) y `bool` de parada, ordenados y nunca leídos | una válvula, sin armar, con su parada de un solo disparo |
| `event` | `string`, el tipo de evento | un evento |
| `device_automation` (un disparador) | `string`, `<type>_<subtype>` cuando llega su carga | un evento, uno por disparador |
| `lock` | `string`, leído con sus propias palabras y que acepta `lock`, `unlock`, `open` | una cerradura, sin armar |
| `fan` | `bool` encendido/apagado; `float` velocidad de 0 a 100 %; `string` preajuste y dirección; `bool` oscilación, cada uno cuando lo tiene | un ventilador, sin armar |
| `siren` | `bool` | una sirena, sin armar |
| `scene` | `bool`, una pulsación | un botón de un solo disparo, sin armar |
| `notify` | `string`, un mensaje, ordenado y nunca leído | un notificador, sin armar |
| `update` | `string` de versiones instalada y más reciente | una actualización: activa cuando difieren. Su comando de instalación nunca se envía |
| `device_tracker` | `string`, `home`, `not_home` o una zona | un rastreador |
| `tag` | `string`, el id del tag cuando se escanea uno | un evento |
| `climate` | `string` de modo; `float` de consigna, consignas baja y alta y consigna de humedad, cada una con el `min_temp`/`max_temp` de la configuración (o `min_humidity`/`max_humidity`) como rango; `float` de temperatura y humedad de la sala; `string` de modos de ventilador, oscilación y preajuste y de acción; `bool` de encendido, ordenado y nunca leído; cada uno cuando lo tiene | un termostato, sin armar |
| `humidifier` | `bool` encendido/apagado; `float` consigna de humedad en su rango; `string` de modo y acción; `float` de humedad de la sala | un humidificador, sin armar |
| `water_heater` | `string` de modo; `float` consigna en su rango y temperatura actual; `bool` de encendido, ordenado y nunca leído | un calentador de agua, sin armar |
| `alarm_control_panel` | `string` de estado, leído con las palabras del formato y que acepta las acciones que lista su `supported_features`, cada una con su propia carga | un panel de alarma, sin armar |
| `vacuum` | `string` de estado, que acepta las acciones que lista su `supported_features`; `float` de batería; `string` de velocidad del ventilador, cada uno de su estado JSON | una aspiradora, sin armar |
| `lawn_mower` | `string` de actividad; `bool` de iniciar el corte, pausar y volver a la base, cada uno una pulsación en su propio topic, ordenado y nunca leído | un cortacésped, sin armar |
| `camera` | `string`, un hash corto de la última imagen; la imagen en sí se guarda en memoria | una cámara |
| `image` | lo mismo, para una imagen en `image_topic`; o `string`, la URL de `url_topic` | una imagen |

Para una luz, una persiana, una válvula, un evento, un disparador y cada componente de las filas siguientes, las entidades de lectura propias de los tags se crean ocultas: la cosa es una sola entidad en las pantallas. Cada tag sigue armándose por su cuenta, así que una persiana en cuya posición usted confía y cuyo abrir y cerrar no, puede ser exactamente eso. Algo que gana un valor después de aceptarse (un firmware que empieza a informar de un brillo) es un cambio para revisión, y cuando una persona lo aplica la entidad recibe el rol junto con el tag.

Los mensajes de estado de una luz de esquema JSON se combinan, porque el esquema envía lo que cambió: un mensaje con solo un brillo, o el `last_seen` de Zigbee2MQTT solo, deja la luz encendida. Su color, temperatura de color y efecto se muestran como atributos, no se ordenan; el encendido, el apagado y el brillo sí, y la pantalla Descubiertos lo dice para una luz que tiene color. Los topics de color de una luz de esquema por defecto son igual: no se leen, no se ordenan y se listan. El esquema de plantilla no está soportado y lo dice. La inclinación de una persiana no se lee ni se ordena, y lo dice.

Un disparador de dispositivo se activa solo con su propio `payload`: Zigbee2MQTT pone todas las acciones de un botón en un topic, y cada disparador es una de ellas. Un disparador sin `payload` se activa con cualquier cosa en su topic.

La velocidad de un ventilador se lee en el `speed_range_min`..`speed_range_max` propio de la configuración como lo hace el formato: el primer paso por encima de apagado es el primer porcentaje. Un nivel que la configuración dice que no puede darse (un ventilador ESPHome que anuncia cuatro pasos e informa de 25) es una lectura mala que lo dice, no 625 por ciento.

La pantalla Descubiertos lista cada topic al que pueden ir los comandos de un componente: el topic de brillo de una luz, el de velocidad de un ventilador, además del principal, y marca cada uno que esté fuera de lo que lee el componente, dentro del prefijo o reclamado por otro dispositivo.

El rango de la consigna de un termostato o un calentador de agua es el de la propia configuración, y el predeterminado del formato cuando no da ninguno (de 7 a 35 °C para un termostato, de 43,3 a 60 °C para un calentador de agua, en °F cuando la configuración dice `temperature_unit: F`). Es el rango del tag, así que la puerta rechaza 31 °C para una válvula de radiador que llega como máximo a 30 antes de enviar nada. Sus modos son la lista de la configuración, y un modo que no figura se rechaza igual. Las pantallas ofrecen exactamente esos, y cuando un cambio aplicado trae un modo nuevo, las pantallas también lo reciben.

El `code` de un panel de alarma es lo que la pantalla de un consumidor pide antes de enviar nada. En HotLoop, quién puede armar o desarmar es decisión de la puerta, con el tag armado por una persona y cada comando auditado, así que la acción sale como dice la configuración. Un panel cuya plantilla de comando quiere el código en sí (`{{ code }}`) no puede ordenarse: HotLoop no tiene código que poner ahí, y la pantalla Descubiertos lo dice. El `send_command_topic` de una aspiradora no se usa: un comando arbitrario es exactamente lo que HotLoop no puede comprobar contra la configuración.

La imagen de una cámara o de un image se guarda en memoria, la última de cada componente, hasta 4 MiB, y se sirve por `GET /api/entities/{entity_id}/image`. HotLoop la conserva solo si los bytes son un JPEG, PNG, GIF o WebP, diga lo que diga el `content_type` de la configuración: un SVG es un documento que ejecuta script, y una "imagen" que ejecuta script en quien abre el panel es un agujero. Su tag guarda un hash corto, así que el historial dice cuándo cambió la imagen sin una base de datos llena de JPEG. Una imagen anunciada por URL es un enlace: HotLoop la muestra, solo si es http o https, y nunca la descarga, porque un servidor que descarga cualquier dirección que un dispositivo nombre puede apuntarse a cualquier cosa de la red. Ninguna se registra en el libro de registro; una cámara cambia cada segundo y tag_history ya tiene cada cambio.

Cada componente que define el formato se convierte en algo. Un componente que no define (un `kettle`) se guarda con lo que anunció y se lista como que no crea nada. El formato no tiene componente de fecha, hora ni fecha y hora, así que esta lista tampoco.

Los ID de entidad son de HotLoop, hechos con el dispositivo y el tag. El `object_id` y el `default_entity_id` de una configuración se ignoran: una configuración no elige un nombre en el espacio de nombres de HotLoop, y una hostil elegiría `switch.boiler_main`.

## Nada es de fiar

Todo lo que dice una configuración vino de quien pueda publicar en el prefijo. Por eso:

- los nombres y textos tienen un tope y se les quitan los caracteres de control, y la pantalla los pone en la página como texto, nunca como HTML;
- un topic con comodín, un topic `$` o un `~` sin base donde ponerlo se rechaza con el motivo;
- una configuración de más de 64 KiB se rechaza; un dispositivo no puede tener más de 512 componentes; no pueden esperar decisión más de 256 dispositivos en un broker; los mensajes de configuración que pasen de 200 por segundo se descartan y se cuentan. Cada rechazo se cuenta y se muestra en la pantalla Descubiertos, nunca se descarta sin decirlo;
- HotLoop se suscribe a `<prefix>/+/+/config` y `<prefix>/+/+/+/config`, nunca a `#` bajo el prefijo, así que un topic profundo perdido no puede hacer que analice nada;
- una carga de estado de más de 256 KiB, o que no sea UTF-8, es una lectura mala.

Con las conexiones anónimas permitidas en el broker integrado, cualquiera de la red puede anunciar dispositivos y publicar en cualquier topic de comando, y la pantalla Descubiertos lo dice en rojo. Dé a cada dispositivo su propio acceso, creado en HotLoop, a partir de su perfil, con el nombre de su topic ([El broker MQTT integrado](/es/iot/broker/)): así puede anunciarse y nada más, y no puede tocar el topic de comando de otro dispositivo.

## El lado del broker

El descubrimiento se ejecuta en el broker integrado (véase [el broker MQTT integrado](/es/iot/broker/)), activado por defecto siempre que lo esté el broker. El cliente propio de HotLoop inicia sesión con un acceso creado en cada arranque y guardado solo en memoria: no hay nada que configurar y nada en una copia de seguridad que pueda filtrarse. Publica una sola cosa propia, el nacimiento (`<prefix>/status` = `online`), que hace que los publicadores que lo escuchan se anuncien de nuevo.

| Variable | Por defecto | <span class="sr-only">Detalles</span> |
|---|---|---|
| `HOTLOOP_BROKER_DISCOVERY` | `true` | Escuchar anuncios en el broker integrado |
| `HOTLOOP_BROKER_DISCOVERY_PREFIX` | `homeassistant` | El prefijo de topic bajo el que llegan |

Un cliente por broker, `hotloop-disc-embedded`, compartido por el oyente y el driver de cada dispositivo descubierto. Un ayudante `--mcp-stdio` no abre ninguno: un segundo cliente con el mismo id sacaría el del Gateway del broker cada pocos segundos. Con varias réplicas sobre una misma base de datos, solo escucha la que tiene el bloqueo de descubrimiento.

## Otros brokers

Muchas plantas ya tienen un broker: un Mosquitto que es la UNS, el que trajo consigo una caja con Zigbee2MQTT. HotLoop también escucha esos. Ajustes, MQTT, añadir un broker: un id (que da nombre al broker en cada dispositivo que vino de él), dónde está, un acceso y el prefijo bajo el que anuncian sus publicadores. El broker no tiene que estar activado, y HotLoop no necesita el integrado para hacer esto.

Tres cosas son distintas del broker propio de HotLoop, a propósito:

- **Los dispositivos esperan en la bandeja.** En un broker de planta con mucha actividad, "aparecer solos" significa trescientos dispositivos en pantalla antes de comer. Así que un dispositivo anunciado se lista en la pantalla Descubiertos, sin crear nada y sin leer, hasta que alguien lo acepta. Entonces se crea, lee, y sus puntos se pueden armar como cualquier otro. Un broker en el que confíe para volcarle todo puede cambiarse a "los dispositivos aparecen solos".
- **Sin última voluntad.** HotLoop se conecta sin ella. Una voluntad `offline` en un broker compartido diría a todos los demás publicadores que algo desapareció, cuando solo era HotLoop. Las pruebas comprueban el propio paquete CONNECT, y cortan la conexión para demostrar que no se dice nada.
- **Sus ACL son suyas.** HotLoop no puede ver quién publicó qué en el broker de otro, así que allí no existe "anunciado por acceso", y lo que cada acceso puede tocar es asunto de ese broker. Dé a HotLoop un acceso que lea el prefijo y los topics de los dispositivos que acepte, y escriba el nacimiento y los topics de comando, nada más. Para Mosquitto:

  ```
  user hotloop
  topic read homeassistant/+/+/config
  topic read homeassistant/+/+/+/config
  topic write homeassistant/status
  # the devices you accept, for example a Zigbee2MQTT bridge:
  topic read zigbee2mqtt/#
  topic write zigbee2mqtt/+/set
  ```

**Solo escucha** es para un broker en el que HotLoop no debe hablar: la UNS de producción, la planta de otro. HotLoop nunca publica nada allí. Ni nacimiento ni comando. Esa es la regla de la sesión, no de la pantalla: su publicación se rechaza, y la puerta de escritura rechaza cada comando a sus dispositivos con "the broker plant-uns is listen-only", simulación incluida, incluso en un dispositivo que alguien aceptó y un punto que alguien armó. Su acceso no necesita más que líneas `topic read`.

La contraseña se sella con la clave de credenciales de dispositivo (`HOTLOOP_SECRET_KEY_FILE`), como la de una consola UniFi, y nunca sale de la API. Sin clave, un broker con contraseña se rechaza, no se guarda en claro. Una copia de seguridad la lleva sellada y se restaura con la misma regla que las credenciales de un dispositivo ([Copias de seguridad y restauración](/es/iot/backup/)). Un broker cuya contraseña no se puede abrir se lista, no se conecta, y dice por qué.

Cambie un broker y el oyente y cada dispositivo suyo se reconectan con los nuevos ajustes. Desactive uno y sus dispositivos se quedan, leyendo mal y diciendo que su broker no está en ejecución aquí. Eliminar uno se lleva consigo la bandeja, y se rechaza, nombrándolos, mientras sigan existiendo dispositivos que alguien aceptó de él.

## En un Edge Relay

Un Edge Relay también descubre, con el mismo código, pero no tiene base de datos donde guardar una decisión ni pantalla donde tomarla. Así que toma lo que oye, lo lee y lo reenvía por Sparkplug, y nada de lo que encuentra se puede armar: sus tags son de solo lectura como cada tag descubierto, sus dispositivos nunca se aceptan y el relay no tiene ninguna ruta de escritura. Nombre los brokers en su archivo de dispositivos; véase la [referencia de Edge Relay](/es/edge-relay/reference/#discovery-41810). Un dispositivo que se puede ordenar llega por el otro lado: aceptado y armado en un Gateway, en un archivo que este envía. Olvida lo que oyó cuando se detiene, y lo oye de nuevo desde el broker.

## Reinicios y repeticiones

Los dispositivos aceptados funcionan desde sus filas de dispositivo. HotLoop no necesita ni un solo mensaje retenido para volver a arrancar con su planta.

El broker integrado no conserva nada entre reinicios, así que cada configuración "falta" después. **Una configuración que falta no es una retirada**: solo lo es una vacía explícita. Cualquier otra cosa retiraría toda la planta cada vez que se reinicie la máquina. Hasta que un dispositivo envía su siguiente estado, sus entidades leen desconocido, nunca el valor de antes del reinicio disfrazado de actual.

Un broker que repite cientos de configuraciones retenidas de golpe es un solo lote: dos segundos de calma, una pasada, una recarga. Una repetición de lo que ya consta no cambia nada ni recarga nada.

## Copias de seguridad

`mqtt_devices` (quién aceptó e ignoró qué), `mqtt_configs` (cada configuración tal como llegó, byte por byte) y `mqtt_discovered` (cada componente, normalizado) están en cada copia de seguridad. Las decisiones son la parte que ningún dispositivo puede volver a anunciar.

## La API

Bajo `/api/discovery`. Véase [la API HTTP](/es/iot/api/#descubrimiento-mqtt).

## Encontrado en la red

La misma pantalla lista los dispositivos que HotLoop oyó en la red de la planta por mDNS, SSDP y DHCP, con la misma forma de decidir. Véase [Descubrimiento de red](/es/iot/network-discovery/).
