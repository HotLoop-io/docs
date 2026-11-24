---
title: "Protocolos y controladores"
description: "OPC UA, Modbus, MQTT y Sparkplug B, EtherNet/IP, S7comm, MTConnect y HTTP, con el grado en que cada controlador se ha probado con equipos reales."
---

Este documento dice con exactitud qué habla el gateway, hasta dónde se ha verificado cada controlador y qué hacer con todo lo demás. Es lo primero que hay que leer y aquello en lo que hay que confiar cuando algo no coincide con él.

La lista de protocolos nativos se deriva de los controladores compilados en el binario: `/api/protocols`, la pantalla Protocolos y la herramienta MCP `describe_protocol` leen el mismo registro. El catálogo no puede anunciar un protocolo que el binario no tiene.

## Estado de verificación

Todo protocolo que HotLoop habla de forma nativa ha movido valores reales desde un servidor o dispositivo real y se ha ejecutado en hardware físico (2026-11-17). Donde existe una implementación independiente, HotLoop se ha ejecutado contra ella en ambos sentidos.

| Protocolo | Nativo | Estado |
|---|---|---|
| Modbus TCP/RTU | sí | **verificado en vivo** |
| OPC UA | sí | **verificado en vivo**, incluido Ignition 8.3.9 en ambos sentidos con nombre de usuario y contraseña por un canal protegido |
| MQTT / Sparkplug B | sí | **verificado en vivo** |
| MTConnect | sí | **verificado en vivo** |
| HTTP / REST | sí | **verificado en vivo** |
| S7comm | sí | **verificado en vivo** (hardware físico, 2026-11-17) |
| EtherNet/IP | sí | **verificado en vivo** (hardware físico, 2026-11-17) |
| UniFi Network | sí | **verificado en vivo**, solo lectura, en consolas y switches reales, incluidos los enlaces WAN y la conmutación por error |
| SNMP | sí | **verificado en vivo**, solo lectura, sobre v1, v2c y v3 en todos los niveles de seguridad |
| CODESYS | sí | **verificado en vivo**, lecturas y escrituras, incluido un programa de más de 100 000 variables leído en 2,4 segundos |
| BACnet/IP | sí | **verificado en vivo**, solo lectura |
| OPC UA PubSub (UADP) | sí | **verificado en vivo**, en ambos sentidos |
| API de Kafka (salida) | sí | **verificado en vivo** con Apache Kafka y Redpanda, con TLS y un inicio de sesión SASL |

Los fabricantes difieren en sus valores por defecto: qué certificados y políticas de token ofrece un servidor OPC UA, qué pone un controlador BACnet en su lista de objetos, qué MIB sirve un dispositivo SNMP, cómo numera sus datos un PLC. Un dispositivo nuevo en una planta nueva sigue siendo un trabajo de puesta en marcha, así que compare un valor conocido en la sonda de la integración con la pantalla del propio dispositivo antes de fiarse de una pantalla.

## Protocolos nativos

### OPC UA

Elíjalo a él cuando un dispositivo ofrezca varias opciones. Explora, está bien protegido y se suscribe.

El controlador **se suscribe en lugar de sondear**. El servidor envía un valor cuando cambia, a un ritmo que puede sostener, en vez de que un cliente le haga la misma pregunta en cada ciclo sin saber si algo se movió. Si un servidor rechaza una suscripción, el controlador recurre a lecturas por lotes en lugar de dar el dispositivo por fallido.

También recurre a ellas cuando una suscripción no entrega nada. Un servidor envía el valor actual de cada nodo en su primera publicación y no vuelve a hacerlo hasta que cambia, de modo que una primera publicación perdida significa un valor de consigna que se lee como malo mientras dure la sesión. Si pasan diez intervalos de publicación (cinco segundos como mínimo) sin ningún valor de la suscripción, el controlador registra una advertencia, elimina la suscripción y lee los tags en cada sondeo hasta que el dispositivo se reconecte. La biblioteca de cliente OPC UA sobre la que se construye este controlador puede iniciar su bucle de publicación en pausa en un host cargado y no enviar nunca una solicitud de publicación; para ese caso existe esto.

También recurre a ellas cuando una suscripción se detiene después de haber recibido valores. La biblioteca se queda con sus mensajes de keep-alive, así que un bucle de publicación detenido se ve igual que una planta donde nada cambia. Cuando una suscripción lleva callada diez intervalos de publicación (treinta segundos como mínimo), el controlador lee cada nodo una vez y lo compara con lo último que entregó la suscripción. Si algún nodo difiere en valor o calidad, el servidor guarda algo que habría enviado, así que el controlador registra una advertencia, elimina la suscripción y lee en cada sondeo hasta que el dispositivo se reconecte. Si coinciden, sigue adelante y vuelve a comprobar tras el mismo silencio. Una suscripción sana y silenciosa cuesta una lectura por lotes cada treinta segundos.

**Dirija los nodos por URI de espacio de nombres.** Importa más de lo que parece:

```
nsu=http://opcua.edge.server;s=Zone1_Temperature    good
ns=3;s=Zone1_Temperature                            works until it doesn't
```

Un *índice* de espacio de nombres se asigna en el orden en que el servidor carga sus espacios de nombres. Añada un espacio de nombres, actualice el firmware, y el índice 3 pasa a ser otra cosa sin avisar: todas las lecturas salen mal y no hay un solo error. La URI forma parte del modelo y no se mueve. `Browse` devuelve la forma URI precisamente por eso.

Una cadena simple se rechaza como dirección. Leída como `ns=0;s=Temperature`, una errata se analizaría sin problema como un nodo que no existe y el tag se leería malo para siempre. Se exige una forma explícita para que el error salga a la luz al guardar.

**Descubrir tags declara cada tag con el tipo que el servidor dice que tiene el nodo**: Boolean es `bool`, los tipos enteros conservan su ancho (`int16`, `uint16`, `int32`, `uint32`, `int64`, `uint64`; SByte y Byte pasan al tamaño siguiente), Float y Double son `float`, y String, DateTime, LocalizedText y los demás tipos que el controlador lee como texto son `string`. Un tipo que el servidor no indica, o uno sin mejor nombre (una enumeración, una estructura), sigue siendo `float`. Hasta el trabajo con Ignition que se describe más abajo, todo tag descubierto era `float`. El controlador seguía leyendo el texto de un nodo String, pero el tag decía float, y el servidor OPC UA del propio Gateway publica un tag con el tipo con que se declara, así que un cliente de ese servidor recibía `Bad_TypeMismatch`. Ignition mostró `System_Status` de Emberburn justo así. Los tags importados antes de la corrección conservan su tipo: cambie a mano un tag de texto a `string`.

Configuración: las opciones de seguridad, identidad y certificados se describen en [OPC UA: seguridad y credenciales](#opc-ua-seguridad-y-credenciales). Las demás son `subscribe`, `publishIntervalMs`, `samplingIntervalMs`, `queueSize`, `sessionTimeoutMs`, `browseMaxNodes`, `browseRoot` y `browseServerNodes`. Un nombre de opción que el controlador no conoce es un error que enumera los que sí conoce, no un ajuste ignorado en silencio: una errata en `securityMode` conectaría sin seguridad alguna y se vería exactamente igual que un dispositivo que funciona.

**Descubrir tags deja fuera el propio objeto `Server` del servidor** (`i=2253`: su estado, capacidades, diagnóstico, matriz de espacios de nombres y configuración). Todo servidor OPC UA tiene uno, y pueden ser cientos de variables mezcladas con las de la planta. Ponga `browseServerNodes` en `true` en el dispositivo para recuperarlas, o ponga `browseRoot` en `i=2253` para mirar dentro a propósito; una exploración que empieza ahí sigue recorriéndolo.

### OPC UA: seguridad y credenciales

Hasta la 4.15.0 el controlador solo podía hacer una conexión anónima y sin protección, y no a cualquier servidor que siga la especificación: nunca preguntaba al servidor qué políticas de token de identidad ofrecía, así que enviaba un id de política de token vacío, que un servidor conforme rechaza. Eso incluía el propio servidor OPC UA de HotLoop. Ahora el controlador descubre los endpoints del servidor, elige uno que coincida con el dispositivo y devuelve el id de política que ese endpoint indicó.

#### Opciones del dispositivo

| Opción | Valor por defecto | Qué hace |
|---|---|---|
| `securityMode` | `None` | `None`, `Sign` o `SignAndEncrypt`. Si se omite con un `securityPolicy` distinto de `None`, es `SignAndEncrypt`. |
| `securityPolicy` | la mejor que ofrezca el servidor para el modo | `None`, `Basic256Sha256`, `Aes128_Sha256_RsaOaep` o `Aes256_Sha256_RsaPss`. `Basic128Rsa15` y `Basic256` se rechazan. |
| `username`, `password` | anónimo | Autenticación con nombre de usuario. |
| `userCertificate`, `userPrivateKey` | ninguno | Autenticación de usuario X.509: la sesión inicia como el usuario al que el servidor asigne este certificado, sin contraseña. Ambos en PEM, definidos juntos. La clave es RSA (la biblioteca OPC UA firma solo con RSA; una clave EC se rechaza diciéndolo) y es un secreto como la contraseña: sellada en reposo, ocultada en toda respuesta de la API, nunca registrada. El certificado es el del usuario, no el certificado de la aplicación cliente de `certFile`. Si también se define un `username`, se usa el certificado. Con el propio servidor de HotLoop, el certificado debe asociarse antes a un usuario ([El servidor OPC UA](/es/edge/opc-ua-server/#certificados-de-usuario-x509)). |
| `allowInsecureCredentials` | `false` | Permite enviar una contraseña por un canal sin protección (`securityMode` `None`), o cuando nada la cifra. |
| `certFile`, `keyFile` | generado | El certificado de aplicación de este cliente y su clave RSA, para un modo protegido. Defina ambos o ninguno. |
| `pkiDir` | `HOTLOOP_OPCUA_CLIENT_PKI_DIR` (`/data/opcua-client-pki`) | Dónde viven el certificado generado y los almacenes `trusted/` y `rejected/`. |
| `serverCertThumbprints` | ninguno | Huellas SHA-1 (40 dígitos hexadecimales) o SHA-256 (64) de certificados de servidor en los que confiar sin un archivo en `trusted/`. Los dos puntos y los espacios se ignoran. |
| `insecureSkipVerify` | `false` | Acepta cualquier certificado de servidor. |

Un dispositivo sin ninguna de estas opciones es lo que siempre fue: anónimo, por un canal sin protección.

#### Cómo elige el controlador un endpoint

El controlador pide al servidor sus endpoints por un canal sin protección, algo que la especificación obliga a permitir a los servidores para el descubrimiento y que no transporta nada secreto, porque la lista de endpoints es pública por diseño. Se queda con los endpoints cuyo modo y política de seguridad coinciden con el dispositivo y, entre ellos, con la política de token para la identidad del dispositivo (anónimo, o nombre de usuario cuando hay un `username`). El token de identidad que envía después lleva el id de política que ese endpoint indicó; nunca envía uno vacío.

- **Nunca selecciona `Basic128Rsa15` ni `Basic256`.** La OPC Foundation ha declarado obsoletas a ambas. Esto se cumple aunque una tenga el nivel de seguridad más alto de la lista, que es como los servidores las ordenan, y cuando una es lo único que ofrece el servidor, en cuyo caso la conexión falla con un error que lo dice. No se puede configurar un dispositivo para usar una, y también se rechaza una política de token que cifraría una contraseña con una de ellas. El propio servidor de HotLoop ofrece ambas junto a las políticas modernas y no puede desactivarlas, así que esto se ejercita contra un servidor real, y las pruebas comprueban que la URI de ninguna de las dos aparece en lo que envía el controlador.
- **Cuando el dispositivo no nombra ninguna política, prefiere `Basic256Sha256`, luego `Aes128_Sha256_RsaOaep`, luego `Aes256_Sha256_RsaPss`**, sea cual sea el nivel de seguridad que el servidor les dé. El orden responde a lo extendida que está cada una, no a su fortaleza. Algunos servidores no pueden abrir un canal con `Aes256_Sha256_RsaPss` y cierran la conexión sin decir por qué, así que solo se usa cuando un dispositivo la nombra.
- **Si nada coincide, el error enumera lo que el servidor sí ofrece**, con la política y el id de política de token de cada endpoint, de modo que la configuración se pueda corregir solo con el mensaje.

#### El certificado propio del cliente

Todo modo protegido necesita un certificado de aplicación. Si el dispositivo nombra un `certFile` y un `keyFile`, se usan tal cual, tras unas comprobaciones (RSA, al menos 2048 bits, no caducado). Si no, se genera uno autofirmado en el primer uso y se guarda en el directorio PKI: RSA-2048, cinco años, el URI de aplicación `urn:hotloop:client:<host name>` en los nombres alternativos del sujeto, la clave con modo `0600`, el certificado con modo `0644` y los directorios con `0750`. La estructura refleja la del servidor OPC UA:

```
own/cert.pem, own/key.pem   this client's certificate
trusted/                    server certificates an operator has approved
rejected/                   server certificates the driver turned away
```

No se regenera en un arranque normal, así que un servidor al que se le dijo que confíe en él no vuelve a recibir el aviso. Se sustituye, con una advertencia de que todos los servidores deben aprobar el nuevo, solo si no se puede leer, no es RSA de al menos 2048 bits o le quedan menos de 30 días. Los dispositivos que arrancan en el mismo momento comparten un certificado en lugar de escribir cada uno el suyo.

El directorio debe ser escribible y persistente. En el chart de Helm eso es `opcuaClient.persistence.enabled` (desactivado por defecto, porque añade un volumen a una instalación existente); en el edge relay es el volumen `/data` existente. Sin un directorio escribible, un dispositivo protegido informa de un error que nombra la variable que hay que definir, en lugar de conectar con certificados que se perderían en el siguiente reinicio.

El **servidor** también debe confiar en este certificado, que es un ajuste del propio servidor. Para el servidor de HotLoop es el mismo gesto: el certificado del controlador aparece en el directorio `rejected/` del servidor tras el primer intento rechazado, y moverlo a `trusted/` lo aprueba. Cuando un servidor cierra la conexión mientras se abre el canal seguro, que es como muchos servidores rechazan un certificado en el que no confían, el error nombra el archivo de certificado de este cliente y su huella para que el operador sepa qué buscar en el servidor.

#### Aprobar el certificado de un servidor

Para un modo protegido, o para una contraseña que se cifrará con la clave del servidor, **el controlador no acepta cualquier certificado que presente el servidor.** Solo confía en el certificado si está fijado en `serverCertThumbprints` del dispositivo o es exactamente el certificado de `trusted/`. Todo lo demás se escribe en `rejected/<thumbprint>.der` y la conexión falla, antes de enviar ninguna credencial, con un mensaje como este:

```
opcua: the server at opc.tcp://plc-01:4840 presented a certificate that is not
trusted (subject "CN=PLC01", SHA-1 thumbprint 5A6DB35A..., expires 2031-09-18).
It has been saved to /data/opcua-client-pki/rejected/5A6DB35A....der. To approve
it, first check that the thumbprint matches the one the server shows, then move
that file into /data/opcua-client-pki/trusted (the next connection attempt picks
it up; no restart is needed). Alternatively pin it by adding the thumbprint to
this device's serverCertThumbprints. Until then this device will not connect
```

Compare la huella con la pantalla del propio servidor antes de aprobar: esa comparación es toda la decisión de confianza. Después haga `mv` del archivo a `trusted/` (se leen tanto archivos PEM como DER) y el dispositivo conecta en su siguiente intento, que cae dentro del intervalo de reconexión del runtime. Algunos detalles:

- La confianza es por el certificado exacto, no por una cadena. Un servidor cuyo certificado emite una CA se aprueba colocando el certificado propio de ese servidor en `trusted/`, igual que uno autofirmado. Confiar en una CA no está soportado.
- Un certificado caducado pero aprobado por un operador sigue siendo de confianza, con una advertencia en el registro en cada conexión. Rechazar uno que un operador aprobó a propósito solo lo empujaría hacia `insecureSkipVerify`.
- Un archivo de `trusted/` que no es un certificado se omite y se informa, y no impide llegar a los demás servidores aprobados.
- `rejected/` guarda como máximo 256 archivos, de modo que un servidor que presenta un certificado distinto en cada conexión no puede llenar el disco. Pasado ese límite la conexión se sigue rechazando, y el mensaje dice que el archivo no se guardó y cómo aprobar el certificado de todos modos.
- `insecureSkipVerify` desactiva la comprobación. Un tercero en el camino puede entonces suplantar al servidor y leer lo que se le envía, contraseña incluida. Está desactivado por defecto y advierte, con la huella del certificado, en cada conexión.

Un dispositivo anónimo en un canal sin protección no necesita nada de esto, porque nada se firma ni se cifra con la clave del servidor.

#### Credenciales

Una contraseña se rechaza, antes de enviarla, salvo que el canal esté protegido y algo cifre la contraseña. Lo que el controlador decide, a partir de lo que el servidor ofrece para el endpoint que coincidió:

| Canal | Política de token de nombre de usuario del servidor | Resultado |
|---|---|---|
| `SignAndEncrypt` | cifra la contraseña (el caso habitual) | conecta |
| `SignAndEncrypt` | no la cifra | conecta: el canal cifrado la transporta, y el registro lo dice |
| `Sign` | cifra la contraseña | conecta |
| `Sign` | no la cifra | **rechazado** salvo con `allowInsecureCredentials`. `Sign` autentica los mensajes pero no los oculta. |
| `None` | cifra la contraseña | **rechazado** salvo con `allowInsecureCredentials`. En un canal sin protección, la clave con la que se cifra la contraseña procede de una respuesta que nada autentica, así que cualquiera que pueda alterar el tráfico puede recuperarla. Con la aceptación expresa conecta, con una advertencia. |
| `None` | no la cifra | **rechazado** salvo con `allowInsecureCredentials` |

**Un nombre de usuario sobre `securityMode` `None` se rechaza incluso cuando la política de token del servidor cifra la contraseña.** Un cifrado cuya clave puede elegir un atacante no protege frente a ese atacante, y en un canal sin protección el certificado con el que se cifra la contraseña se toma de la respuesta del servidor a `CreateSession`, que nada autentica (la prueba de más abajo sustituye un certificado y recupera la contraseña). El error lo dice y nombra la solución, `securityMode` `SignAndEncrypt`. Las sesiones anónimas no se ven afectadas.

`allowInsecureCredentials` es el único interruptor que deja salir una contraseña en esas condiciones. Está desactivado por defecto y advierte en cada conexión cuando es lo que permitió la conexión. Cuando la política de token cifra la contraseña, cambia lo que puede leer quien escucha, no lo que puede un tercero que altera el tráfico: consulte [qué cruza la red](#qué-cruza-la-red). Incluso con él, el certificado del servidor debe aprobarse antes cuando la contraseña se cifra con él.

La contraseña es un secreto en todo lugar donde el controlador y la API la manejan:

- **Respuestas de la API.** Se sustituye por `[redacted]` en toda respuesta que devuelve un dispositivo (`GET /api/devices`, `GET /api/devices/{id}` y la respuesta a un guardado), de modo que un visor, que tiene `devices.read`, no puede leerla. Desde la 4.15.1 esto vale para todos los roles, administrador incluido, y para las credenciales de todos los protocolos, no solo de este. Guardar un dispositivo con el marcador conserva la contraseña almacenada; un valor nuevo la sustituye; una cadena vacía la borra; el marcador de un dispositivo sin contraseña se rechaza en lugar de almacenarse. Omitir el campo ahora la conserva (en la 4.15.0 la borraba). Las reglas completas están en [Autenticación y usuarios](/es/iot/authentication/#las-credenciales-de-dispositivo-son-de-solo-escritura). El editor de dispositivos de la interfaz web muestra la configuración tal como la devuelve la API y guarda lo que muestra, lo cual esto resuelve, así que editar un dispositivo no pierde su contraseña. (Las pruebas lo ejercitan a través de la API, no de un navegador.)
- **Registros y errores.** Ni las líneas de registro del controlador ni ningún error que devuelva llevan la contraseña: los mensajes se construyen a partir de códigos de estado y de los ajustes no secretos del dispositivo. Las pruebas capturan el registro del proceso, el registro del servidor y los errores, y buscan la contraseña en todos ellos.
- **Herramientas y recursos MCP, el flujo de eventos en vivo, el registro del sistema.** Ninguno devuelve la configuración de un dispositivo (cada uno describe un dispositivo mediante un conjunto fijo de campos), y las pruebas llaman a cada herramienta y recurso, abren el flujo y leen el registro del sistema con una contraseña configurada, y no la encuentran en ninguna parte.
- **La base de datos y las copias de seguridad.** La contraseña se almacena en la columna `config` del dispositivo, igual que las de los demás controladores. Hasta la 4.16.0 está en claro, y una copia de seguridad la contiene. Desde la 4.17.0 se cifra con una clave guardada fuera de la base de datos (véase "Encrypted at rest" más abajo), así que un volcado o una copia contiene texto cifrado. En cualquier caso, consulte [Copias de seguridad y restauración](/es/iot/backup/#proteja-los-archivos-de-copia) y proteja la base de datos y el volumen de copias en consecuencia.
- **El edge relay.** Un archivo de dispositivo también lleva la contraseña. En el chart de Helm, ponga un archivo de dispositivo con credenciales en un Secret y nómbrelo en `devicesSecret`; los dispositivos definidos directamente en los valores del chart acaban en un ConfigMap. Un archivo de dispositivo enviado con fleet config push se publica, retenido, en un tema MQTT, así que el broker debe llevar TLS y restringir quién puede leer ese tema.

Una contraseña incorrecta es un error claro, en un solo intento, sin bloqueos y sin reintentos dentro del controlador:

```
opcua: authentication rejected: the server at opc.tcp://plc-01:4840 rejected the
user name and password for "svc-hotloop" (StatusBadUserAccessDenied). ...
```

Después el runtime espera **diez minutos** (con variación aleatoria entre cinco y diez) antes del siguiente intento, en lugar de recorrer su retroceso de reconexión habitual (`HOTLOOP_RECONNECT_MAX`, 60 segundos por defecto). Dos cosas hacen que un inicio de sesión rechazado sea más caro de repetir que un fallo de red. Un servidor que bloquea una cuenta tras unos pocos fallos convierte cada reintento rápido en una caída para cualquier otro que use esa cuenta. Y cada inicio de sesión rechazado puede dejar una **sesión creada y nunca activada** en el servidor, que cuenta contra su límite de sesiones hasta que caduca (la biblioteca pide veinte minutos; `sessionTimeoutMs` lo cambia): contra el propio servidor de HotLoop, un dispositivo con contraseña incorrecta que reintentaba cada pocos segundos llenó su límite por defecto de veinte sesiones, tras lo cual el servidor rechazó a todos los demás clientes con `BadTooManySessions`. Un controlador con una tabla de sesiones pequeña está más expuesto aún. El dispositivo no deja de reintentar, así que un servidor cuya contraseña se corrige de su lado se recupera en diez minutos sin que nadie toque HotLoop; corregir la contraseña en el dispositivo, o apagarlo y encenderlo, inicia un worker nuevo, que lo intenta de inmediato.

#### Qué cruza la red

Medido, no deducido: las pruebas colocan un proxy grabador entre el controlador y un servidor y buscan cada byte en ambos sentidos. La búsqueda encuentra bytes que se sabe que están ahí (la lista de endpoints del servidor, enviada en claro), lo que demuestra que el proxy grabó la conversación.

| Configuración | Contraseña | Nombre de usuario | IDs de nodo y valores de tags |
|---|---|---|---|
| `SignAndEncrypt` | no visible | no visible | no visible |
| `Sign` | no visible (la política de token la cifra) | **legible** | **legible** |
| `None`, nombre de usuario, la política de token del servidor cifra (requiere `allowInsecureCredentials`) | no visible | **legible** | **legible** |
| `None`, anónimo | no aplica | no aplica | **legible** |
| un servidor que ofrece una contraseña sin cifrar, con `allowInsecureCredentials` | **legible** | **legible** | depende del modo |

La última fila se prueba contra un servidor que en realidad no ofrece eso: un tercero situado delante de un servidor real reescribe su lista de endpoints para decir que la contraseña no está cifrada, en el canal que usa el descubrimiento, que nada autentica. Así es también como las pruebas muestran el rechazo: sin la aceptación expresa el controlador rechaza, abre solo la conexión de descubrimiento y ninguna credencial viaja por el cable. La lista de endpoints es justo lo que un tercero en el camino puede reescribir, y por eso la regla del controlador se aplica a lo que se le dice y no se deja que la haga cumplir el servidor.

Un canal sin protección con una contraseña tiene un límite que la tabla no muestra y que una prueba sí muestra; por eso el controlador rechaza esa combinación sin la aceptación expresa. La contraseña se cifra con el certificado del servidor, lo que la protege de quien escucha, y el controlador no la enviará hasta que ese certificado se apruebe. Pero el certificado con el que cifra la biblioteca OPC UA es el de la respuesta del servidor cuando se crea la sesión, y en un canal sin protección esa respuesta no está autenticada. Un tercero que pueda alterar el tráfico pone en ella su propio certificado, y la contraseña queda entonces cifrada con la clave de ese tercero: la prueba lo hace, descifra la contraseña con la clave sustituida y la recupera. **Sobre `Sign` o `SignAndEncrypt` el mismo tercero no puede**, porque la respuesta está protegida por claves que no tiene. Sin `allowInsecureCredentials` el controlador se niega a enviar la contraseña, y la prueba muestra que entonces el mismo tercero no obtiene nada; con él, el controlador advierte en cada conexión. Use `SignAndEncrypt` siempre que el servidor lo ofrezca; un canal sin protección con una contraseña, aceptado expresamente, protege frente a quien escucha y nada más.

#### Reconexión

La reconexión propia de la biblioteca OPC UA está desactivada, y es el runtime quien reconecta. La biblioteca, una vez perdida la sesión, abre una nueva con las credenciales que se le dieron y, cuando el servidor las rechaza, lo vuelve a intentar enseguida sin ninguna pausa: se midieron unos veinte inicios de sesión rechazados en doce segundos contra un servidor cuya contraseña había cambiado. Así es como una cuenta queda bloqueada para todos los que la comparten. Ahora una sesión perdida hace que `Poll` informe de un error, el worker del runtime cierra el controlador y abre uno nuevo, y el nuevo descubre los endpoints, comprueba el certificado del servidor e inicia sesión de nuevo, con el retroceso con variación aleatoria del runtime y la espera de diez minutos tras un fallo de autenticación. Un reinicio del servidor se supera del mismo modo: el dispositivo lee el valor nuevo tras el reinicio, habiendo iniciado sesión otra vez, lo que las pruebas comprueban contando los inicios de sesión del servidor y cambiando el valor tras el reinicio.

Un dispositivo sin tags no tiene nada que leer, y hasta la 4.15.2 eso significaba que su sondeo no enviaba absolutamente nada. El servidor cerraba la sesión inactiva al agotarse su tiempo de sesión, el dispositivo seguía diciendo que estaba conectado porque nadie había preguntado nada al servidor, y toda exploración fallaba con `BadSessionIDInvalid` hasta reiniciar el proceso. Es lo que le pasaba a todo dispositivo justo cuando alguien lo añade y pulsa Descubrir tags. Ignition lo detectó. Ahora un dispositivo sin tags lee el estado del servidor en cada sondeo, lo que mantiene viva la sesión y detecta cuándo muere, y una exploración que encuentra la sesión caída lo comunica para que el runtime reconecte.

Un tag que no ha cambiado desde antes de que empezara la sesión ahora lee su valor actual con buena calidad. Antes, la lectura provisional que se informaba mientras se esperaba el primer valor era más reciente que la marca de tiempo de origen del propio valor, y el runtime se queda con la lectura más reciente y descartaba el valor, de modo que un tag estable se leía malo hasta que volvía a cambiar.

#### Qué se probó y qué no

OPC UA se ha ejecutado contra Ignition 8.3.9 y contra servidores OPC UA independientes, con inicio de sesión anónimo y con nombre de usuario y contraseña sobre `None`, `Sign` y `SignAndEncrypt`, y en hardware físico el 2026-11-17. Cada servidor de producción tiene sus propias costumbres sobre qué políticas ofrece y cómo rechaza un certificado, así que trate una primera conexión con el servidor de un fabricante nuevo como una puesta en marcha.

Lo que hay que saber:

- Toda conexión pregunta ahora primero al servidor por sus endpoints, y un dispositivo sin opciones de seguridad necesita un endpoint sin protección que liste una política de token anónimo con un id. Un servidor que aceptaba sesiones anónimas sin listar una se rechaza con un error que enumera lo que ofrece.
- La autenticación de usuario con certificado X.509 y con token emitido no está implementada para el controlador. El `certFile` de un dispositivo es su certificado de aplicación.
- La confianza es por certificado exacto. Confiar en una autoridad de certificación y la revocación de certificados no están soportadas.
- Las políticas de seguridad de curva elíptica no están soportadas, ni tampoco los servidores que rechazan el descubrimiento en un canal sin protección.
- Una ruta de red que se corta sin que ningún extremo vea el cierre deja el dispositivo con sus últimos valores hasta que el sistema operativo da por perdida la conexión.
- Algunos servidores no pueden abrir un canal con `Aes256_Sha256_RsaPss`.
- El propio servidor de HotLoop acepta contraseñas de hasta 72 bytes. Otro servidor puede tener su propio límite.

#### Ignition 8.3

Verificado contra **Ignition 8.3.9**, la versión estable actual, en la imagen de contenedor propia de Inductive Automation: el controlador de HotLoop como cliente, el servidor OPC UA de Ignition al otro lado, `Basic256Sha256` con `SignAndEncrypt`, iniciando sesión con nombre de usuario y contraseña. Browse encontró los tags de Ignition bajo `nsu=urn:inductiveautomation:ignition:opcua:tags`, y los tags `[System]/Gateway` de reloj, CPU, memoria y tiempo de actividad se importaron y leyeron con buena calidad, enviados por suscripción.

Un gateway Ignition 8.3 de serie le pondrá cuatro obstáculos antes de que HotLoop pueda decir nada:

1. **Su servidor OPC UA escucha solo en localhost.** De fábrica, la 8.3 enlaza el puerto 62541 a `localhost`, de modo que un HotLoop en cualquier otro sitio recibe conexión rechazada y nada más. En el Gateway, en los ajustes del servidor OPC UA, ponga Bind Addresses en `0.0.0.0`. También añadimos el nombre de host que marca HotLoop a Endpoint Addresses; no se probó si el controlador lo necesita.
2. **Los tags no están en OPC UA por defecto.** Active Expose Tag Providers, o lo único que encontrará una exploración son los diagnósticos del propio servidor y las carpetas de dispositivos.
3. **Certificados, en ambos sentidos.** HotLoop rechaza el certificado de Ignition hasta que usted lo apruebe, como se explicó antes. Ignition rechaza el de HotLoop hasta que usted confíe en él en los certificados del servidor OPC UA del Gateway. En disco, eso es moverlo de `data/config/local/com.inductiveautomation.opcua/server/security/pki/rejected/certs` a `.../trusted/certs`, sin reiniciar. **Ignition no nombra ese archivo con la huella SHA-1 que registra HotLoop.** Abra el certificado y compare su huella digital; el nombre del archivo no coincidirá y eso no es señal de un impostor.
4. **El inicio de sesión OPC UA es `opcuauser` / `password`** en el origen de usuarios `opcua-module`, en toda instalación nueva. Cámbielo antes de conectar nada real.

Solo se ejercitó en este sentido lo que el servidor de la 8.3 ofrece de fábrica: `Basic256Sha256` y `SignAndEncrypt`.

**El otro sentido también está verificado: el cliente OPC UA de Ignition 8.3.9 lee el servidor OPC UA de HotLoop**, con sesión iniciada como visor de HotLoop, con todas las políticas y modos de seguridad que ofrece Ignition. La configuración, la confianza de certificados en ambos sentidos, las trampas y la matriz de políticas están en [El servidor OPC UA](/es/edge/opc-ua-server/#ignition-83-como-cliente). Encontró dos errores de HotLoop, ambos corregidos: el servidor generaba un certificado nuevo cada vez que se recreaba su contenedor, lo que rompía la confianza de Ignition tras cada actualización, y Descubrir tags declaraba todos los tags como float, de modo que un tag de texto llegaba a Ignition como `Bad_TypeMismatch` (más arriba).

El nodo edge de Sparkplug de HotLoop y el Edge Relay contra el MQTT Engine de Ignition son lo siguiente, y no están hechos.

### OPC UA PubSub (UADP)

El otro OPC UA: no un cliente que pregunta a un servidor, sino un publicador que envía DataSets como datagramas UDP a quien escuche, unicast o multicast (OPC 10000-14, la codificación UADP). HotLoop se suscribe, como dispositivo, y publica, como ajuste.

**Suscribirse.** Añada un dispositivo con el protocolo `opcua-pubsub`. La dirección es dónde escuchar: `udp://239.0.0.1:4840` se une a un grupo multicast, `udp://:4840` escucha unicast. La dirección de un tag es `<DataSetWriterId>/<field index>`, la posición del campo en el DataSet del publicador contando desde 0: `1000/3` es el cuarto campo que publica el writer 1000. UADP no lleva nombres de campo (viven en un DataSetMetaData que el publicador sirve por otra vía, o no sirve), así que la posición es lo que un datagrama puede decir. Un campo que es una matriz se lee elemento a elemento: `1000/3[17]` es el decimoctavo valor de la matriz que es el cuarto campo. Browse lista los campos que se han oído, con sus tipos, y una matriz como sus elementos (los primeros 1000).

```json
{"publisherId":"2234","writerGroupId":100,"interface":"eth0","timeoutMs":30000,
 "dataSets":[{"writerId":62541,"types":["Float","UInt16","Boolean","Int32","Double"]}]}
```

- `publisherId` y `writerGroupId` limitan un dispositivo a un publicador y un grupo. Vacío y cero lo admiten todo. Así es como varios dispositivos comparten una dirección: un publicador que envía dos WriterGroups a `udp://:4840` son dos dispositivos ahí, uno con `"writerGroupId":1` y otro con `"writerGroupId":2`.
- Los dispositivos pueden compartir dirección y puerto. HotLoop abre un socket para ella (una unión, para un grupo multicast en una tarjeta) y entrega cada datagrama a todos los dispositivos que hay en él. Cada dispositivo aplica entonces sus propios `publisherId`, `writerGroupId` y `dataSets`, de modo que cada uno ve el flujo completo de su publicador y ninguno queda dividido entre dispositivos. El socket se cierra cuando se retira o se detiene el último dispositivo que lo usa, y el siguiente que arranque lo vuelve a abrir. Los dispositivos se emparejan por la dirección tal como está escrita: `udp://:4840`, `udp://0.0.0.0:4840` y `udp://[::]:4840` son tres direcciones para HotLoop, y que puedan coexistir depende del sistema operativo, como siempre. Un grupo multicast unido en dos tarjetas distintas son dos sockets. Nada cambia para un dispositivo que está solo en su dirección.
- El grupo, el puerto y la tarjeta son del dispositivo: nada está fijado en HotLoop. `udp://239.192.0.1:4850` con `"interface":"eth0"` se une a ese grupo en esa tarjeta, y `udp://127.0.0.1:4842` escucha a un publicador en la misma máquina. Varios dispositivos pueden escuchar a la vez en grupos y puertos distintos, o en el mismo.
- `interface` es la tarjeta de red en la que se une un grupo multicast, por nombre (`eth0`, `lo`) o por una de sus direcciones IPv4 (`127.0.0.1`). Una máquina con más de una tarjeta lo necesita. Un publicador en la misma máquina que envía a un grupo por loopback (`IP_MULTICAST_IF` 127.0.0.1, TTL 0, loopback activado, sin ruta) es oído por un dispositivo con `"interface":"lo"` o `"127.0.0.1"`; sin interfaz indicada y sin ruta, la unión falla con `no such device` y lo dice.
- `dataSets` es solo para RawData, que no lleva tipos en el cable: los tipos de campo del publicador, en orden, para poder leer los bytes. Los mensajes Variant y DataValue llevan los suyos. Cada entrada es un nombre de tipo (`"Float"`), y también puede indicar cómo se dispone un bloque de valores: `"Float*250"` son 250 campos uno tras otro sin longitud delante, que es como escribe un PLC que envía un bloque de REAL como campos separados; `"Float[250]"` es un campo matriz de como máximo 250 valores, escrito como lo escribe la pila de la OPC Foundation para una matriz RawData (un contador Int32, los valores y relleno de ceros hasta 250 de ellos); y `"String(40)"` es un String relleno hasta 40 bytes, solo o como `"String(40)[4]"`.
- Los key frames reemplazan los campos de un DataSet; los delta frames cambian los que nombran; los keep alives demuestran que el publicador está vivo. Un mensaje perdido (un hueco en los números de secuencia) marca los tags de ese DataSetWriter como **inciertos** hasta su siguiente key frame, ya que un delta puede haberse perdido con él. Un cambio en la versión de configuración del DataSet olvida todos los campos hasta que un key frame diga qué significan ahora.
- Un writer en silencio durante `timeoutMs` (30 segundos si no se define) se lee **malo** diciéndolo así, y un dispositivo sin nada oído de su publicador dentro del tiempo límite está caído. Un campo que el publicador marca como Bad es malo, y uno que marca como Uncertain es incierto; el motivo es el código de estado.
- La hora de la lectura es la del publicador, tomada del campo, del DataSetMessage o del NetworkMessage, cuando está definida y no adelanta en más de un minuto a este reloj, y la hora de llegada en caso contrario.
- Las matrices se leen en mensajes Variant y DataValue (un contador Int32 y los valores, OPC 10000-6 5.2.2.16; una multidimensional llega aplanada, fila a fila) y, con una disposición, en RawData. Un contador que el datagrama no puede contener se rechaza antes de crear nada para él.
- Solo lectura. La seguridad de mensajes (NetworkMessages firmados o cifrados), los mensajes fragmentados, los mensajes de descubrimiento, los eventos y los campos de estructura no están soportados; un datagrama con cualquiera de ellos se rechaza, se cuenta por motivo y nunca se adivina.

**Publicar.** Desactivado hasta que se define `HOTLOOP_UADP_PUBLISH_ENABLED`, en Edge y Gateway (los productos que tienen el servidor OPC UA). Envía los tags que nombra una disposición:

```json
{"dataSets":[{"writerId":1,"name":"press","configMajor":1,"fields":[
  {"device":"press-01","tag":"Zone1_Temp","type":"Float"},
  {"device":"press-01","tag":"Cycle","type":"UInt32"}]}]}
```

| Variable | Valor por defecto | <span class="sr-only">Detalles</span> |
|---|---|---|
| `HOTLOOP_UADP_PUBLISH_ADDRESS` | | `udp://239.0.0.1:4840` para un grupo multicast, `udp://host:4840` para un suscriptor |
| `HOTLOOP_UADP_PUBLISH_LAYOUT_FILE` o `_LAYOUT` | | la disposición anterior, como archivo o en línea (gana el archivo) |
| `HOTLOOP_UADP_PUBLISH_PUBLISHER_ID` | `1` | un número o un texto |
| `HOTLOOP_UADP_PUBLISH_WRITER_GROUP_ID` | `1` | |
| `HOTLOOP_UADP_PUBLISH_INTERVAL` | `1s` | |
| `HOTLOOP_UADP_PUBLISH_KEY_FRAME_EVERY` | `10` | como máximo este número de intervalos entre key frames |
| `HOTLOOP_UADP_PUBLISH_DATAVALUE` | `false` | campos DataValue (valor, estado, hora) en lugar de Variants |
| `HOTLOOP_UADP_PUBLISH_DELTA_FRAMES` | `false` | un DataSet que cambió sale como delta frame (solo los campos que cambiaron) entre key frames |
| `HOTLOOP_UADP_PUBLISH_METADATA_EVERY` | `10` | los nombres y tipos de campo de cada DataSet se anuncian cada tantos intervalos; `0` no envía ninguno |
| `HOTLOOP_UADP_PUBLISH_INTERFACE`, `_TTL` | la del sistema, `1` | la tarjeta por la que sale el multicast y su límite de saltos |

Cada DataSet sale en su propio DataSetWriter, un NetworkMessage cada uno. Un DataSet cuyos valores cambiaron sale como key frame (todos los campos), uno que no cambió como keep alive, y un key frame al menos cada `KEY_FRAME_EVERY` intervalos para que un suscriptor que se unió tarde converja. Un key frame es completo, así que un datagrama perdido cuesta un intervalo y no un valor erróneo. Con `HOTLOOP_UADP_PUBLISH_DELTA_FRAMES=true` un DataSet que cambió sale en cambio como delta frame, con solo los campos que cambiaron desde el último mensaje y sus posiciones, y el key frame sigue llegando al menos cada `KEY_FRAME_EVERY` intervalos; un delta perdido cuesta entonces hasta esa cantidad de intervalos con un campo desactualizado, que es el precio de un mensaje más pequeño en un enlace lento. El suscriptor de HotLoop lee delta frames. value. Un tag erróneo se publica como su estado y nunca como su último valor; uno del que todavía no se ha leído nada se publica como `BadWaitingForInitialData`. Los valores se limitan a su tipo publicado, no se desbordan. La seguridad de mensajes no está soportada, así que esto pertenece a una red de confianza de la planta. Los tags de la misma disposición los puede leer el suscriptor de HotLoop en otra máquina.

**Lo que se demostró.** Una pila OPC UA PubSub independiente publica en el suscriptor de HotLoop y se suscribe al publicador de HotLoop por multicast, y el publicador de HotLoop es leído correctamente por el suscriptor de HotLoop. **Seguridad de mensajes.** Un dispositivo suscriptor puede exigir que los NetworkMessages de su publicador estén firmados, o firmados y cifrados (OPC 10000-14 7.2.4.4.3), con las dos políticas que define la especificación, `PubSub-Aes128-CTR` y `PubSub-Aes256-CTR`:

```json
{"publisherId":"2234","security":{"mode":"signAndEncrypt","policy":"PubSub-Aes128-CTR",
 "keys":[{"keyId":1,"signingKey":"<64 hex digits>","encryptingKey":"<32 hex digits>","keyNonce":"<8 hex digits>"}]}}
```

Las claves son estáticas: se fijan en ambos lados bajo un SecurityTokenId (`keyId`), en hexadecimal o base64. Son secretos, se muestran como `[redacted]` y se conservan al guardar. Un dispositivo que tiene dos claves admite un publicador que pasa de una a otra. Con `security` fijado, un mensaje que no está firmado (o no está cifrado, bajo `signAndEncrypt`), que está firmado con otra clave o que fue modificado en el camino se rechaza y se cuenta (`unsecured`, `signature`, `security_key`) antes de leer nada de él. No está implementado un Security Key Service (GetSecurityKeys, claves rotativas). El publicador firma con `HOTLOOP_UADP_PUBLISH_SECURITY_MODE` (`sign` o `signAndEncrypt`), `_POLICY`, `_KEY_ID`, `_SIGNING_KEY`, `_ENCRYPTING_KEY` y `_KEY_NONCE`.

**Metadatos y descubrimiento.** Un publicador anuncia cómo se llaman y de qué se componen sus DataSets como una respuesta de descubrimiento que lleva un DataSetMetaData, en fragmentos cuando es grande (7.2.4.4.4, 7.2.4.6). Un dispositivo suscriptor los lee: los campos se nombran en Browse (`writer1001_<field name>`), un DataSet RawData no necesita tipos de `dataSets` en la configuración porque los metadatos lo disponen, y un DataSet que cambia su versión de configuración empieza de nuevo desde su siguiente key frame. Los `dataSets` de la configuración siguen prevaleciendo cuando están ambos. No se envía la solicitud de descubrimiento de un suscriptor, y un publicador no responde a ninguna.

**Campos de estructura, eventos.** Un campo que los metadatos dicen que es una estructura se lee como sus miembros, que un tag direcciona como `1001/0.Value` (y `1001/7[2].Angle` para un elemento de un array de estructuras); una estructura enviada en un Variant se lee cuando los metadatos la describen. Las estructuras con campos opcionales y las uniones se informan por nombre, no se adivinan. Un DataSetMessage de Event se aplica como los campos que lleva y deja el resto en paz (`Events` en las estadísticas del dispositivo); su disposición es la de un key frame (7.2.4.5.7), leída de la especificación y no comprobada con otra pila. Algunos publicadores escriben un FieldCount antes de un key frame RawData, lo que la especificación no hace; al dispositivo se le indica con `"rawFieldCount":true`.

### CODESYS

Un PLC que ejecuta un runtime CODESYS Control (Linux SL, ARM64, Raspberry Pi, Windows, el PLC virtual), leído y escrito por los nombres que su programador dio a las variables: `Application.GVL_Line.rTemp`, no un id de nodo. Es el controlador OPC UA con lo que un PLC CODESYS necesita además, así que todo lo que figura en [OPC UA: seguridad y credenciales](#opc-ua-seguridad-y-credenciales) vale para él y sus opciones son esas opciones.

**Las alarmas propias del PLC.** Un proyecto con una Alarm Configuration guarda sus alarmas en el gestor de alarmas del PLC. Con el bloque de la biblioteca HotLoop Alarms en el proyecto (vea CODESYS alarms), HotLoop muestra esas alarmas en su lista de alarmas, desde el momento en que el dispositivo se conecta, y un reconocimiento hecho en HotLoop vuelve al gestor de alarmas. Verificado en vivo contra un runtime CODESYS Control for Linux SL 4.22.0.0 real: disparo, reconocimiento, reinicio y confirmación. Las listas de texto propias del gestor de alarmas y una clase distinta de las dos probadas no están verificadas.

**Por qué el servidor OPC UA, y qué significa eso para el PLC.** CODESYS documenta una sola vía para que un tercero lea las variables de un controlador, y es el propio servidor OPC UA del runtime: la Symbol Configuration de la aplicación (o, desde CODESYS 3.5 SP18, un IEC Symbol Set bajo el Communication Manager) dice qué variables se publican y con qué acceso, y el servidor las sirve. El protocolo de canal del CODESYS Gateway no está documentado para terceros y este controlador no lo habla. Así que el PLC tiene que publicar lo que usted quiere ver:

1. En el IDE añada una **Symbol Configuration** a la aplicación, con *Support OPC UA features* activado, y marque las variables, o márquelas en la declaración con `{attribute 'symbol' := 'readwrite'}` (`'read'` para solo lectura).
2. Descargue. Un PLC sin Symbol Configuration responde a la configuración con un mensaje que dice que hay que añadir una.
3. Una variable es escribible desde HotLoop solo cuando su símbolo es `readwrite` y el usuario con el que se conecta tiene permiso para escribirla (los *Symbol Rights* del dispositivo). HotLoop lee el nivel de acceso y dice cuál de las dos cosas rechazó una escritura.

Fuentes: [CODESYS help, Symbol Configuration](https://content.helpme-codesys.com/en/CODESYS%20Communication/_cds_symbolconfiguration.html) e [IEC Symbol Set](https://content.helpme-codesys.com/en/CODESYS%20Communication/_comm_symbol_configuration.html) (el nombre del símbolo es `<application>.<POU>.<variable>`, el acceso es lectura, escritura o ejecución por símbolo, los derechos de los grupos están en la pestaña Symbol Rights del dispositivo, y OPC UA necesita un certificado en el controlador); el [PLCopen OPC UA information model for IEC 61131-3](https://plcopen.org/system/files/downloads/plcopen_opc_ua_information_model_for_iec61131-3_version1.02.pdf) (versión 1.02, la disposición de abajo); OPC UA Part 5 (OperationLimits). Los ids de nodo son los que respondió un runtime 4.22.0.0, contra el que se escribió este controlador; la grafía exacta de `|var|` es del runtime, no un contrato publicado, y por eso un tag se direcciona por símbolo y el controlador construye el id de nodo.

**Disposición.** El runtime publica, en el `DeviceSet` de OPC UA Device Integration, un dispositivo para el PLC, `Resources` debajo, y la aplicación debajo de eso, con `GlobalVars` (las listas de variables) y `Programs` por debajo. El nodo de una variable es `ns=<n>;s=|var|<device>.<application>.<list or program>.<variable>` en el espacio de nombres `CODESYSSPV3/3S/IecVarAccess`. El controlador encuentra el dispositivo y la aplicación explorando, así que un tag sobrevive a que se cambie el nombre del proyecto.

**Direcciones.** Un símbolo IEC, con o sin la aplicación:

```
Application.GVL_Line.rTemp        a variable of a variable list
GVL_Line.rTemp                    the same; the application is assumed
Application.PLC_PRG.nCount        a program's variable
GVL.motors[2].speed               a field of an element of an array of structures
nsu=CODESYSSPV3/3S/IecVarAccess;s=|var|CODESYS Control for Linux SL.Application.GVL.x
                                  a node id, if you have one
```

**Descubrir tags** lista lo que exporta la aplicación, con los tipos que tiene: un STRING es `string`, un BYTE `uint16`, un TIME `int64` (milisegundos), una enumeración `int32`, los anchos enteros conservan el suyo, REAL y LREAL son `float`. El runtime dice que un STRING, BYTE o TIME es un tipo del modelo PLCopen (por ejemplo `ns=3;i=3013`); el controlador sigue sus referencias `HasSubtype` hasta el tipo estándar del que es una variante, que es también como una escritura a un BYTE se envía como Byte. Cada variable lleva el acceso que se dio a su símbolo. Una estructura y una matriz se recorren: un punto por campo y por elemento. Deja fuera las propiedades propias del runtime (`|vprop|`), la lista de tareas y el objeto Server.

Una matriz lista sus primeros 32 elementos (`arrayElements`), porque un búfer de mil elementos no son mil cosas para un dashboard, y un tag puede direccionar cualquier elemento por su símbolo de todos modos. La lista se detiene en `browseMaxNodes` y lo dice; `browseRoot` puesto en un símbolo (`Application.GVL_Demo`) lista una parte de la aplicación. La exploración es en anchura, así que las variables de una lista salen antes que los elementos de sus matrices, y las respuestas se mantienen en un tamaño que el runtime acepta (cierra la conexión ante una respuesta de cien matrices de mil elementos).

Configuración: las opciones de OPC UA, y `device` (el nombre del PLC, solo si el runtime lista más de uno), `application` (solo si ninguna se llama Application), `arrayElements`, `alarmSymbol` (el bloque HotLoop Alarms, solo para omitir su búsqueda). Una opción mal escrita es un error que lista las válidas. La contraseña es un secreto, almacenado y ocultado como todo secreto de dispositivo.

**Lo que el runtime pide a un cliente.** Publica `OperationLimits` de 100 para lecturas, exploraciones y elementos monitorizados por solicitud, y rechaza una mayor con `BadTooManyOperations`. El controlador lee esos límites al conectar y ajusta cada solicitud a ellos, para todo dispositivo OPC UA (un runtime CODESYS fue el primero en que importó: antes de esto el controlador informaba de todo tag descubierto como float y no leía ninguno de los tags de un dispositivo con más de 100). El muestreo es de un segundo por defecto y la cola de un elemento, porque un PLC tiene un ciclo que cuidar y un gateway Ignition que ya lo lee no debería perderlo; defina `samplingIntervalMs` para pedir más.

**Descargas, reinicios y un enlace perdido.** Un reinicio del runtime, o cargar un programa nuevo, corta la sesión. El dispositivo pasa a desconectado, todo tag se lee malo con el motivo "el runtime del PLC no responde", y HotLoop reconecta por sí solo con retroceso y lee los símbolos tal como están ahora. Un símbolo que se leía y se rechaza como desaparecido dos veces seguidas se toma por una descarga en la que el runtime mantuvo la sesión, y la sesión se abandona para la misma reconexión. Un tag de una variable que el programa no tiene se lee malo con el motivo del servidor y no provoca una reconexión.

**Proteger el servidor OPC UA del runtime.** Un runtime CODESYS Control ofrece solo endpoints sin protección hasta que su servidor OPC UA tiene un certificado, y entonces ofrece también las políticas de su `CommunicationPolicy` (AES128-SHA256-RSAOAEP por defecto, Basic256Sha256, AES256-SHA256-RSAPSS) con Sign y SignAndEncrypt. CODESYS documenta cómo crear ese certificado en el Security Screen (CODESYS Security Agent, Devices, el controlador, OPC UA Server) y cómo confiar en un cliente moviendo su certificado de "Certificates in Quarantine" a "Trusted Certificates". El PLC shell del runtime Linux lo hace igual sin el IDE, con comandos que CODESYS lista para el PLC shell del editor de dispositivos (`cert-getapplist`, `cert-genselfsigned <n>`, `cert-getcertlist quarantine`, `cert-export`, `cert-import trusted`), por el socket Unix que documenta el runtime Linux para ello (`/var/opt/codesyscontrolapi/plcshell.sock`, "Accessing the PLC Shell"). Ponga el dispositivo en `securityMode` `SignAndEncrypt` con un `securityPolicy`, conecte una vez (el certificado propio de HotLoop acaba en la cuarentena del runtime y la conexión se rechaza, con un mensaje que lo dice), confíe en ese certificado y el dispositivo lee. No se muestra: el Security Screen del IDE, un certificado firmado por una CA, la gestión de usuarios con un runtime protegido.

**Un runtime sin licencia se detiene solo.** Un runtime CODESYS Control sin licencia funciona en modo demo y se apaga a las dos horas aproximadamente (el registro del runtime dice `no runtime license - running in demo mode(~2 hours)` en cada arranque). Desde el lado de HotLoop eso es un reinicio del runtime como cualquier otro: el dispositivo pasa a desconectado con "el runtime del PLC no responde" y vuelve solo en cuanto algo arranca de nuevo el runtime (la política de reinicio de un contenedor, una unidad de systemd). Nada en HotLoop cuenta las dos horas ni trata la parada de otra manera, y nada reinicia el runtime por usted; un runtime que no se vuelve a arrancar sigue desconectado. Probado con un runtime 4.22.0.0 en un contenedor sin licencia: se detuvo solo 2 horas y 5 minutos después de arrancar, con código de salida 0; la política de reinicio del contenedor lo arrancó de nuevo 31 segundos después, su aplicación estaba en marcha 82 segundos más tarde y el dispositivo volvió a leer bien 35 segundos después de arrancar la aplicación (2 minutos y 28 segundos desde la parada), sin ningún paso manual.

**Escrituras.** Un tag es de solo lectura hasta que alguien lo marca como escribible, como en todo dispositivo, y nada de lo que crea una configuración lo es. Después la puerta de escritura es la de OPC UA, con la parte del PLC delante: una escritura a un símbolo exportado como solo lectura, o que el usuario no puede escribir, se rechaza con las palabras del PLC y nunca se envía.

**Configuración desde el flujo de integraciones** (`codesys`): la dirección del runtime, las preguntas de seguridad de OPC UA y, opcionalmente, un primer dashboard de los puntos guardados (la pantalla que habría sido WebVisu; consulte [Integraciones](/es/iot/integrations/#codesys)). Verificado contra un runtime 4.22.0.0 en un contenedor; consulte la tabla de estado para lo que eso no cubre.

### Modbus TCP/RTU

El caballo de batalla de 1979. PLCs, variadores, medidores de energía, RTUs, y el recurso de todo gateway que no tiene nada mejor.

```
holding:100:float32:CDAB    a float across registers 100-101, word-swapped
holding:40:bit3             bit 3 of register 40
holding:200:string16        16 characters from register 200
input:12:int16              a signed input register
coil:5                      a single coil
```

**El orden de palabras** es el ajuste que más se equivoca la gente, y un float leído con el orden equivocado no es obviamente erróneo en una pantalla: es un número plausible que no es la verdad. Se admiten las cuatro permutaciones con los nombres que imprimen los manuales de los fabricantes: `ABCD`, `CDAB`, `BADC`, `DCBA`. Defina un valor por defecto del dispositivo con `byteOrder` y sobrescríbalo por tag con el cuarto campo de la dirección.

**El direccionamiento** es en bruto y base cero. Si sus planos usan la numeración tradicional al estilo 40001, ponga `oneBased: true` y escriba los números de los planos. Equivocarse en uno es el error más antiguo de Modbus.

Las lecturas se fusionan en bloques: registros adyacentes y casi adyacentes se convierten en una sola solicitud. `maxGap` controla cuántos registros sin usar compensa leer para evitar un segundo viaje (8 por defecto), `maxBlock` limita una sola solicitud (120 por defecto, techo del protocolo 125).

Escribir un solo bit de un registro de retención es una lectura-modificación-escritura, porque Modbus no tiene un establecimiento atómico de bits ahí. Los otros quince bits se conservan.

### MQTT y Sparkplug B

MQTT simple, o Sparkplug B como **aplicación host primaria completa**.

Topics simples:
```
mqtt:plant/line1/temperature              a scalar payload
mqtt:plant/line1/state|data.temperature   JSON, extracted by path
mqtt:plant/+/flow                         wildcards work
```

Métricas de Sparkplug:
```
spb:GroupId|EdgeNodeId|DeviceId|Metric/Name
spb:Plant|Edge1||Node/Uptime               empty device = a node-level metric
```

Como host primario, el controlador hace lo que pide la especificación y la mayoría de las integraciones omiten:

- Publica un nacimiento `STATE` retenido con su will correspondiente, para que los nodos edge vean caerse al host en lugar de deducirlo de un tiempo de espera. Forma de Sparkplug 3.0 (`spBv1.0/STATE/<host>` con JSON) por defecto; defina `legacyState` para la cadena `ONLINE`/`OFFLINE` anterior a la 3.0.
- Sigue el número de secuencia móvil de cada nodo y pide a un nodo que renazca cuando se salta uno, porque un hueco significa que se perdieron mensajes y ya no se puede confiar en la tabla de alias.
- Pide un rebirth tras su propia reconexión. Un host que estuvo ausente no tiene idea de qué cambió mientras no estaba.
- Empareja `NDEATH` con `NBIRTH` por `bdSeq`, de modo que un certificado de muerte sobrante de una sesión anterior no pueda matar la actual.

El orden de los mensajes se garantiza. Entregar mensajes Sparkplug de forma concurrente los reordena, lo que hace que un nodo sano parezca estar perdiendo mensajes y provoca una tormenta de rebirth.

### EtherNet/IP (CIP)

Allen-Bradley ControlLogix, CompactLogix y Micro820. Los tags tienen nombres, así que se puede preguntar al controlador qué contiene.

```
Temperature                    type from the tag's declared dataType
Speed:dint                     an explicit type wins
Program:MainProgram.Speed      a program-scoped tag, the colon is part of the path
Zones[0].Heater.On:bool        array elements and UDT members
```

CIP es estrictamente tipado y el controlador rechaza una lectura cuyo tipo declarado no coincide, así que el tipo tiene que venir de algún sitio. Se toma del `dataType` del tag, o de un sufijo `:type` que prevalece. Lo desconocido cae a `REAL`, que es lo que son la mayoría de los valores de proceso.

Las lecturas se agrupan en solicitudes de servicio múltiple, y recurren a lecturas individuales cuando falla un lote, para que una ruta de tag errónea no deje ciegos a los otros diecinueve.

### S7comm

Siemens S7-300, 400, 1200 y 1500, sobre ISO-on-TCP por rack y slot.

```
db1:0:real        a REAL at DB1.DBD0
db1:4:dint        a DINT at DB1.DBD4
db1:8.3:bool      bit 3 of DB1.DBB8
db2:20:string32   a 32-character STRING
m:10:word         merker word MW10
i:0.1:bool        input I0.1
q:2:byte          output byte QB2
```

El tipo es obligatorio para todo lo que sea más ancho que un byte. El protocolo no puede decirle si cuatro bytes son un REAL o un DINT, eso es un hecho sobre el programa del PLC, no sobre el cable.

Por defecto rack 0, slot 1 (S7-1200/1500). Los S7-300/400 suelen ser slot 2. `connectType` es 3 por defecto (S7 Basic) para que el gateway no ocupe la ranura de conexión PG que un ingeniero quiere para TIA Portal.

No hay exploración. Una CPU S7 no publica la estructura de sus bloques de datos, que vive en el proyecto de TIA Portal.

### MTConnect

Telemetría de máquina herramienta de solo lectura. MTConnect no tiene canal de comandos, y este controlador no finge lo contrario.

Direccione por `dataItemId` o por nombre; los agentes son inconsistentes sobre cuál es estable, y la documentación de las máquinas muestra uno u otro.

Dos detalles que separan una integración que funciona de una que solo lo parece: `UNAVAILABLE` es el agente diciendo explícitamente que no tiene lectura, se convierte en calidad mala, no en el texto "UNAVAILABLE" y no en cero. Y el significado de una Condition es el nombre de su elemento (`Normal`, `Warning`, `Fault`, `Unavailable`), no sus datos de carácter, que suelen estar vacíos.

`Browse` lee `/probe` y recorre el árbol de componentes a cualquier profundidad.

### HTTP / REST

El comodín, para medidores de energía, sensores ambientales, controladores de fabricantes de equipos y la parte REST de un gateway que habla algo propietario por debajo.

```
power.kw                      nested fields
readings[0].value             array indexing
zones[name=Zone1].temp        select an array element by a field value
$.data.temperature            a leading $. is accepted
```

Esa tercera forma es la que importa: estas API adoran devolver una matriz desordenada de objetos `{name, value}`, e indexar por posición es un error esperando a una actualización de firmware.

Una solicitud sirve a todos los tags del dispositivo. `Browse` recorre el documento e informa de cada escalar con la ruta que lleva a él.

### Salud del equipo

La máquina en la que se ejecuta HotLoop, como dispositivo de solo lectura: `cpu_util_pct` (tiempo de CPU no inactivo desde la última lectura), `mem_util_pct` (MemTotal frente a MemAvailable), `disk_util_pct` (el disco de la máquina, un statfs de la raíz del host montada de solo lectura en `diskPath`, `/host` por defecto), `data_util_pct` (el volumen en `dataPath`, `/data`, o la carpeta existente más cercana por encima cuando todavía no hay nada montado ahí), y `rtos_jitter_core1_us` a `core3_us` cuando `jitterFile` nombra el archivo JSON `{"core1_us":3.2,"core2_us":2.9,"core3_us":4.1}` que reescribe un agente en tiempo real (un archivo de más de cinco minutos se lee como erróneo). La CPU y la memoria vienen de `procRoot` (`/proc`, o `/host/proc` cuando está montado el del host). Un valor que no se puede leer es calidad errónea con el motivo, nunca cero. El dispositivo lo crea `HOTLOOP_BOX_HEALTH_NODE` ([El servidor OPC UA](/es/edge/opc-ua-server/#salud-del-equipo-para-el-panel-de-embernet)).

### Shelly

Un Shelly de cualquier generación con el que se habla directamente, sin broker de por medio. Vea SHELLY.md. Añada un dispositivo con el protocolo `shelly` y la dirección del dispositivo; si tiene un inicio de sesión, `{"password":"..."}` (el usuario es `admin`; un dispositivo Gen2 o posterior responde con su desafío de resumen SHA-256 y uno Gen1 con Basic). `/shelly` dice de qué generación es. Un dispositivo Gen2, Gen3 o Gen4 se lee con `Shelly.GetStatus` (`POST /rpc`) y cada componente que informa se convierte en tags que se añaden solos, de solo lectura hasta que una persona los arma: `switch:0.output`, `switch:0.apower`, `switch:0.aenergy.total`, `switch:0.temperature.tC`, `input:0.state`, `cover:0.current_pos`, `pm1:0.apower`, `em:0.total_act_power`, `temperature:100.tC`, `humidity:100.rh`, y el `sys.uptime` y el `wifi.rssi` del dispositivo. Un campo que el dispositivo no envió no se convierte en tag. La salida de un switch (`Switch.Set`), la salida y el brillo de una luz, la posición de una cubierta (`Cover.GoToPosition`) y el objetivo de un termostato se pueden armar para escribir.

Un dispositivo Gen2 o posterior también obtiene un websocket (`ws://<device>/rpc`): el driver envía una trama de solicitud con un `src`, como exige la página del canal RPC de Shelly antes de que un dispositivo notifique, responde a una trama 401 con el objeto `auth` documentado (SHA-256 sobre `dummy_method:dummy_uri`), e incorpora `NotifyStatus` y `NotifyFullStatus` a su copia del estado, de modo que un cambio llega al tag de inmediato y el sondeo intermedio lee la copia en lugar del dispositivo. `NotifyEvent` (una pulsación de botón, un cambio de configuración) se archiva en el libro de registro bajo el dispositivo. Cuando el websocket está caído, o no ha confirmado el estado últimamente (45 segundos sin una trama o pong, 2 minutos sin una lectura completa), el sondeo lee el dispositivo por HTTP.

Un dispositivo Gen1 (`/status` y rutas de control GET sencillas, inicio de sesión Basic) obtiene la misma forma de tags a partir de sus propias palabras: `relay:0.output`, `meter:0.power`, `meter:0.total` (vatios-minuto convertidos a Wh), `light:0.output` y `.brightness`, `roller:0.current_pos`, `input:0.state`, `temperature:0.tC`, y para medidores de energía y sensores `emeter:0.power`, `humidity:0.rh`, `flood:0.alarm`. Un relé se escribe con `/relay/<id>?turn=on|off`, una luz con `/light/<id>?turn=&brightness=`, una persiana con `/roller/<id>?go=to_pos&roller_pos=`. Construido a partir de la documentación publicada de Shelly para Gen1 y Gen2 y probado con grabaciones de dispositivos reales (un Plus 1, un Plug S y una bombilla Vintage); todavía no con un dispositivo en el banco. Los campos de medidor de energía, humedad, batería e inundación de Gen1 salen de la documentación y no tienen ninguna grabación detrás.

### Firmata

Un Arduino, o cualquier placa que ejecute un firmware Firmata, por USB serie o TCP, sin programa anfitrión de por medio. Vea FIRMATA.md. Añada un dispositivo con el protocolo `firmata` y el puerto serie (`/dev/ttyACM0`, `serial:/dev/ttyUSB0`) o `host:port`; opciones `{"baudRate":57600,"samplingMs":19,"bootWaitMs":5000}`. El driver espera la versión de protocolo de la placa (preguntando cada 300 ms), consulta su firmware, sus capacidades y su mapa analógico, y crea un tag de solo lectura para cada pin digital y entrada analógica que tiene la placa. La dirección de un tag dice qué hacer con un pin: `D13`, `D2:in`, `D2:pullup`, `D13:out`, `D9:pwm`, `D10:servo`, `A0`, `I2C:0x48:0x00:2`. La entrada digital es el informe de puerto que la placa envía ante un cambio, la analógica es el informe de cada intervalo de muestreo, y cada sondeo pide la versión de protocolo para que una placa desaparecida se vea en un sondeo; un informe de firmware que llega sin pedirlo es una placa que se reinició. Un pin que los tags no mencionan no se toca, y un tag `D<n>` sencillo pone su pin como entrada cuando el driver se conecta, y como salida en su primera escritura. Construido a partir del protocolo 2.8.0 (protocol.md e i2c.md en github.com/firmata/protocol) y ejecutado contra StandardFirmata 2.5.9 en un ATmega328P simulado: sus pines digitales, pull-ups, entradas analógicas a 0, 2,5 y 5 V, registros de comparación PWM, el pin de un servo y los registros de un dispositivo I2C se leyeron cada uno desde el chip, no desde el driver. No se ha ejecutado en una placa física.

### ONVIF

Una cámara IP, codificador o NVR. Vea ONVIF.md. Añada un dispositivo con el protocolo `onvif`, la dirección de la cámara y `{"username":"...","password":"..."}`. El driver lee primero GetSystemDateAndTime y sella su UsernameToken de WS-Security con el reloj de la propia cámara (Core Specification 5.12: el resumen es `base64(SHA-1(nonce + created + password))`), lee GetDeviceInformation y GetServices (GetCapabilities para una cámara antigua), usa Media2 cuando la cámara lo lista y Media cuando no, y lee el codificador, la resolución, la dirección de stream y la dirección de instantánea de cada perfil. A una cámara que quiere HTTP Digest o Basic en el envío SOAP se le responde con eso. Las direcciones de servicio se alcanzan en el host con el que se añadió el dispositivo salvo `"keepXAddrHosts":true`. Un perfil PTZ añade `ptz.<token>.pan`, `.tilt`, `.zoom` y `.moving` a partir de GetStatus, y los comandos armables `.move` (ContinuousMove, con un tiempo límite opcional), `.absolute` (AbsoluteMove), `.goto_preset` (GotoPreset, por token o nombre), `.stop` y `.home`. Los eventos vienen de un pull point (CreatePullPointSubscription, PullMessages, Renew, Unsubscribe) y se convierten en tags `event.<topic>|<source>|<item>` que se añaden solos, con cada cambio en el libro de registro. Una instantánea es `GET /api/onvif/<device>/profiles/<token>/snapshot` y el descubrimiento es `POST /api/onvif/discover` (WS-Discovery, un Probe multicast para `NetworkVideoTransmitter`).

Construido a partir de las especificaciones ONVIF Core, Media, Media2, PTZ y Event (onvif.org/specs). Cada solicitud que envía es válida frente a los archivos WSDL y XSD de ONVIF (xmllint, con los 33 tipos y un elemento que libxml2 rechaza por atribución única de partículas relajados, ninguno de los cuales usa una solicitud), y se ejecuta contra onvif_srvd, una pila ONVIF independiente que analiza la cabecera WS-Security pero no la comprueba, así que el resumen del inicio de sesión se contrasta en cambio con zeep 4.3.3. El servicio de eventos y WS-Discovery solo tienen scripts escritos a partir de la especificación contra los que ejecutarse. No se ha ejecutado en una cámara física.

### UniFi Network

La red de la planta como dispositivo: un sitio en una consola UniFi, sus switches, cada puerto de switch, el consumo PoE, los enlaces WAN y la salud del sitio, como tags que se crean solos a medida que se adopta el equipo, de solo lectura hasta que se arma. Un inicio de sesión por consola, el certificado fijado y la contraseña de la consola cifrada en la base de datos. Solo cambia la consola mediante los pocos tags de comando que una persona arma (un LED de localización, un reinicio, un ciclo de apagado y encendido PoE de un puerto; véase UNIFI.md). También escucha el websocket de eventos de la consola, de modo que un switch que se cae queda en el libro de registro cuando ocurre, con el sondeo como verdad de fondo, y la pestaña UniFi dibuja la vista general, el mapa, los frontales, los clientes, las redes y el WiFi. Todo sobre él está en [UniFi Network](/es/iot/unifi/).

### UniFi Protect

Las cámaras, sensores, luces y sirenas de un NVR Protect, mediante la Protect Integration API con una clave de API de la página Integrations de la consola (la clave va en `{"apiKey":"..."}`, sellada como una contraseña de consola, y el certificado se fija con `certFingerprint` como en UniFi Network). Añada un dispositivo con el protocolo `unifi-protect` y la dirección de la consola. Los tags se añaden solos, de solo lectura hasta que se arman: `cam.<id>.online`, `.motion`, y `.smart_person`, `.smart_vehicle`, `.smart_package`, `.smart_licensePlate`, `.smart_face` y `.smart_animal` para los tipos que admite una cámara; `sen.<id>.online`, `.open`, `.motion`, `.leak`, `.tamper`, `.temp_c`, `.humidity_pct`, `.light_lux`; `light.<id>.online`, `.on`, `.motion`; `siren.<id>.online`. El movimiento y las detecciones inteligentes de una cámara vienen del websocket de eventos de la consola, ya que el registro REST no tiene ninguno, así que se leen como erróneos, nunca como "sin movimiento", mientras está caído. Cada evento está en el libro de registro bajo el dispositivo. El `.play` de una sirena está armado para escribir (`true` reproduce, `false` detiene), y también `alarm.<trigger>.fire`, que envía el webhook del gestor de alarmas para el id de disparador que la persona creó en Protect, de modo que una alarma de HotLoop que lo escribe hace que las cámaras graben. La instantánea de una cámara es `GET /api/unifi-protect/<device>/cameras/<camera>/snapshot`, un JPEG obtenido cuando se pide. Construido a partir del documento OpenAPI de Ubiquiti para Protect 7.4.102; todavía no ejecutado contra una consola. Vea [UniFi Network](/es/iot/unifi/#unifi-protect).

### UniFi Access

Las puertas de una consola Access, mediante la API de desarrollador de Access en el puerto 12445 con un token de API de sus ajustes avanzados (`{"token":"..."}`, sellado). Añada un dispositivo con el protocolo `unifi-access` y la dirección de la consola. Por puerta, `door.<id>.open` (el sensor de posición; una puerta sin él se lee como errónea, nunca como cerrada), `door.<id>.unlocked` (el relé de la cerradura), y `door.<id>.unlock`, que una persona arma y que desbloquea la puerta cuando se escribe `true`, a través de la compuerta de escritura y auditado como cualquier escritura; la consola la vuelve a bloquear según su propia regla. El websocket de notificaciones mantiene la posición y el bloqueo al día entre sondeos, y cada cambio ("1F - Front: opened", "unlocked") está en el libro de registro bajo el dispositivo. Construido a partir de la API tal como la habla el cliente abierto mantenido (py-unifi-access, MIT); todavía no ejecutado contra una consola. Vea [UniFi Network](/es/iot/unifi/#unifi-access).

### SNMP

Cualquier cosa con un agente SNMP: switches, SAI, PDU, medidores de energía y todo equipo Linux que ejecute un agente SNMP. Solo lectura. HotLoop nunca envía un SNMP SET, porque un SET puede cambiar la configuración de un switch y el objetivo de este controlador es ver la red de la planta, no gestionarla.

```
1.3.6.1.2.1.1.5.0             sysName
.1.3.6.1.2.1.1.3.0            sysUpTime, a leading dot is accepted
1.3.6.1.2.1.2.2.1.8.2         ifOperStatus of the interface with ifIndex 2
```

La dirección de un tag es el OID de una instancia, números separados por puntos. Un escalar acaba en `.0`; una celda de tabla acaba en el índice de su fila. El `dataType` del tag decide en qué se convierte:

* Un número que envió el agente (Integer, Gauge32, Counter32, Counter64, TimeTicks) es ese número. La escala y el desplazamiento se aplican como en todas partes.
* Un OCTET STRING es texto, salvo que el tag sea un número, y entonces se analiza. Así llega una carga media (`laLoad` es el texto `0.15`) o una temperatura detrás de un agente. El texto que no es un número es una lectura mala que lo dice, nunca cero.
* Un OCTET STRING que no es imprimible (una dirección MAC) es `0x` y hexadecimal.

**Los contadores son en bruto.** Un Counter32 o Counter64 solo sube y se desborda. El tag guarda lo que envió el agente, y la tasa corresponde a lo que lea el tag. Counter64 se guarda como float, que es exacto hasta 2^53; un puerto a velocidad de línea tarda décadas en llegar ahí.

**TimeTicks son centésimas de segundo**, así que `sysUpTime` leído como un tag simple está en 1/100 s. La integración lo escala a segundos por usted; un tag hecho a mano debe poner `scale` en `0.01`.

**Un objeto que el agente no tiene es una lectura mala con el motivo**, y los demás de la misma solicitud se siguen leyendo: v2c y v3 dicen cuáles faltaban, y para v1, que responde a un objeto ausente con un error para toda la solicitud, el controlador lo quita y pregunta de nuevo por el resto. Una respuesta demasiado grande para el agente se pide de nuevo por mitades.

Opciones del dispositivo (`config`):

| Opción | Significado |
|---|---|
| `version` | `1`, `2c` o `3`. Por defecto `2c` |
| `community` | La comunidad v1 y v2c. Obligatoria para ellas, y **no hay valor por defecto**: `public` es como lee los switches de una planta cualquiera que pregunte. Un secreto |
| `username` | El usuario v3 |
| `securityLevel` | `noAuthNoPriv`, `authNoPriv` o `authPriv`. Por defecto: `authPriv` con una frase de privacidad, `authNoPriv` con solo una de autenticación, y en otro caso `noAuthNoPriv` |
| `authProtocol` | `MD5`, `SHA`, `SHA224`, `SHA256`, `SHA384` o `SHA512`. Por defecto `SHA` |
| `authPassword` | La frase de autenticación. Un secreto |
| `privProtocol` | `DES`, `AES`, `AES192`, `AES256`, `AES192C` o `AES256C`. Por defecto `AES` |
| `privPassword` | La frase de privacidad. Un secreto |
| `contextName` | El contexto v3. Casi siempre en blanco |
| `transport` | `udp` (por defecto) o `tcp` |
| `retries` | Cuántas veces se reenvía una solicitud que no obtuvo respuesta, de 0 a 10. Por defecto 1 |
| `maxRepetitions` | Filas por GETBULK en un recorrido. Por defecto 10, que es lo que responden los agentes más pequeños |
| `browseRoots` | OIDs que recorrer al descubrir puntos. Por defecto: system, las tablas de interfaces, host resources, la tabla de carga y las salidas extend de un agente SNMP |
| `browseMaxNodes` | Dónde se detiene una exploración. Por defecto 2000 |

La dirección es `host` o `host:port`, con el puerto 161 por defecto.

**Una comunidad incorrecta no obtiene respuesta.** Un agente SNMPv1 o v2c descarta una solicitud con una comunidad que no conoce, así que una comunidad incorrecta, un puerto incorrecto, un firewall y un agente caído se ven igual que un tiempo de espera agotado, y el mensaje de HotLoop dice las cuatro. SNMPv3 sí los distingue: una frase incorrecta o un usuario desconocido se rechaza como tal (`ErrAuthRejected`), y HotLoop espera mucho tiempo antes de volver a probar las mismas credenciales.

`Browse` recorre los subárboles que HotLoop puede nombrar y da un nombre a cada objeto: el de la MIB, como `sysName`, `ifOperStatus.2`, `ifHCInOctets.2`, `laLoad.1`, o el OID como `oid.1.3.6.1...` para uno que no conoce. Los nombres, y los OID, tipos y unidades que hay detrás, proceden de las MIB que los definen: SNMPv2-MIB (RFC 3418), IF-MIB (RFC 2863), HOST-RESOURCES-MIB (RFC 2790) y UCD-SNMP-MIB y NET-SNMP-EXTEND-MIB de un agente SNMP. Todo lo demás que tiene el agente se sigue leyendo; añádalo como tag por OID.

La integración (consulte [Integraciones](/es/iot/integrations/#snmp)) hace las consultas por usted.

### BACnet/IP

Un controlador de automatización de edificios, un medidor, un termostato: cualquier cosa de la red IP que hable BACnet. Solo lectura. HotLoop nunca escribe una propiedad BACnet, porque una escritura aterriza en una salida comandable a través de una matriz de prioridades, y una prioridad que se deja puesta mantiene el equipo donde se dejó mucho después de que quien la puso se haya ido a casa. Eso es una función que se diseña a propósito, no algo que se deja por ahí.

Se somete a tramas grabadas de un dispositivo real, decodificadas por pruebas que se ejecutan siempre, y a ese dispositivo en las pruebas.

```
analog-input:1                present value of analog input 1
ai:1                          the same, abbreviated
av:3.units                    a property other than the present value, by name
analog-input:1.117            or by number
multi-state-value:2           present value of a multi-state value
```

La dirección de un tag es el objeto, `<type>:<instance>`, y un punto y una propiedad cuando no es el valor actual. Los tipos, por nombre o abreviatura: `analog-input` (`ai`), `analog-output` (`ao`), `analog-value` (`av`), `binary-input` (`bi`), `binary-output` (`bo`), `binary-value` (`bv`), `multi-state-input` (`msi`), `multi-state-output` (`mso`), `multi-state-value` (`msv`), `accumulator` (`acc`), `integer-value` (`iv`), `positive-integer-value` (`piv`), `large-analog-value` (`lav`) y `characterstring-value` (`csv`). Las propiedades por nombre son `present-value`, `object-name`, `description`, `units`, `status-flags`, `out-of-service`, `reliability`, `number-of-states`, `state-text`, `object-type`, `object-identifier`, `object-list`, `vendor-name`, `vendor-identifier`, `model-name`, `firmware-revision` y `application-software-version`; cualquier otra propiedad es su número.

Lo que se convierte un tag depende de su `dataType`: un número que envió el dispositivo (real, double, unsigned, signed, enumerated, boolean) es ese número, y el `active` de un objeto binario es 1 y el `inactive` es 0; una cadena de caracteres es texto, o un número si el tag lo es y el texto es un número; un valor actual `null` es una lectura mala que dice que el dispositivo no tiene nada que informar. Una propiedad que contiene más de un valor (una lista de objetos) no puede ser un tag.

**Los indicadores de estado forman parte de la lectura.** Cada sondeo pide los indicadores de estado de un objeto en la misma solicitud que su valor actual, y un objeto cuyo indicador de **fallo** está activo se lee **malo**, con el motivo. Uno **fuera de servicio** o **anulado** se lee **incierto**: su valor actual es algo que puso una persona o un programa, no una medición, y los gráficos de tendencia y los informes dejan fuera las lecturas inciertas igual que las malas (la regla de calidad). **En alarma** por sí solo es una lectura buena de un punto que está en alarma.

**Lo que el dispositivo no tiene es una lectura mala con el motivo, y el resto se sigue leyendo.** ReadPropertyMultiple responde cada propiedad por separado, así que un objeto que no existe (`unknown-object`) o una propiedad que no tiene (`unknown-property`) hace fallar ese tag y ningún otro. Un dispositivo que rechaza ReadPropertyMultiple se lee desde entonces una propiedad cada vez.

**Nada se segmenta.** El cliente le dice al dispositivo que no puede admitir una respuesta segmentada. Un dispositivo cuya respuesta no cabría en una trama aborta (`segmentation-not-supported`), y HotLoop pide la mitad de objetos a la vez; un dispositivo cuya lista de objetos es demasiado grande para enviarse entera se lee un elemento cada vez.

Opciones del dispositivo (`config`):

| Opción | Significado |
|---|---|
| `deviceInstance` | El número de instancia que se espera que tenga el dispositivo en esta dirección. Cuando está definido y el dispositivo dice otro, se rechaza la conexión: un dispositivo distinto que responde en una dirección reutilizada, o un controlador que se sustituyó, es como una planta acaba con un número limpio en apariencia pero equivocado |
| `localAddress` | La dirección de la tarjeta de red de esta máquina desde la que enviar, para un host con más de una. Normalmente en blanco |
| `retries` | Cuántas veces se reenvía una solicitud que no obtuvo respuesta, de 0 a 10. Por defecto 1 |
| `browseMaxObjects` | Dónde se detiene una exploración. Por defecto 1000 |

La dirección es `host` o `host:port`, con el puerto 47808 por defecto. Nada en BACnet/IP es una credencial, así que no hay ninguna que ocultar.

**Al conectar se pregunta al dispositivo quién es.** HotLoop envía al dispositivo un Who-Is unicast y toma su instancia de dispositivo del I-Am. A un dispositivo que no responde a uno se le pide su propio objeto de dispositivo bajo la instancia comodín (4194303), a la que según el estándar un dispositivo responde como él mismo. Un dispositivo que no responde a ninguno se informa con ambos intentados, porque los motivos habituales se ven igual: una dirección o puerto incorrectos, un firewall, un dispositivo caído, o un dispositivo en una red detrás de un router.

**El enrutamiento no está construido.** HotLoop habla con un dispositivo al que puede enviar un datagrama UDP. Un controlador en un tronco MS/TP detrás de un router BACnet, o en otra red BACnet, no es alcanzable, ni tampoco un dispositivo al que solo llega un BBMD (registro de dispositivo foráneo). Direccione el lado BACnet/IP del propio router, o ponga un gateway delante: consulte [modo gateway](#todo-lo-demás-modo-gateway).

`Browse` lee el objeto propio del dispositivo (su nombre, fabricante, modelo y firmware), su lista de objetos y todo objeto que HotLoop lee: nombre, descripción, unidades, valor actual e indicadores de estado, y el texto de estado de un objeto multiestado. Un tag recibe el nombre del propio objeto, con la dirección añadida cuando dos objetos lo comparten. Las unidades se convierten en una etiqueta y, donde significan una, una clase de entidad: grados Celsius es `°C` y `temperature`, porcentaje de humedad relativa es `%` y `humidity`, kilovatios hora es `kWh` y `energy`. Una unidad para la que HotLoop no tiene etiqueta se deja sin etiquetar y se nombra en la descripción por su número. Los números y nombres de esas unidades se contrastan con un dispositivo real, que envía el número que su propia tabla da a cada nombre. La integración (consulte [Integraciones](/es/iot/integrations/#bacnetip)) hace las consultas por usted.

## Hacia fuera: la API de Kafka

Todo lo anterior trae los valores de un dispositivo hacia dentro. HotLoop también puede enviarlos a un broker de Kafka como flujo de eventos: cada lectura que guarda el historiador y cada línea del registro del sistema (alarmas, dispositivos que se caen y se levantan, cambios), como JSON en los topics que usted nombre. Es un destino del historiador, configurado en Ajustes, Destinos de historial, y admite Apache Kafka, Redpanda y cualquier otro que hable la API de Kafka, sobre TLS con un inicio de sesión SASL. Los formatos de registro, lo que significa "al menos una vez" aquí y lo que está y no está probado se explican en [Destinos del historiador](/es/iot/historian-targets/#api-de-kafka-flujo-de-eventos). El cliente es [franz-go](https://github.com/twmb/franz-go).

## Todo lo demás: modo gateway

**PROFINET · EtherCAT · HART · DNP3 · FINS · MELSEC/SLMP · CANopen · FANUC FOCAS**

Estos no se hablan de forma nativa y no hay un controlador para ellos. Es una decisión deliberada, no un hueco a la espera de rellenarse con un stub.

Las plantas que usan estos protocolos casi siempre ya tienen un gateway que republica en OPC UA o Modbus: un controlador PROFINET IO con un servidor OPC UA, un multiplexor HART con un mapa Modbus. Apunte un dispositivo a ese endpoint y configúrelo como OPC UA o Modbus.

Escribir ocho controladores más que dupliquen cada uno lo que ya hace el gateway existente de una planta añadiría ocho cosas más que pueden salir sutilmente mal, para protocolos donde el equipo es el más difícil de probar. Si una planta de verdad no tiene gateway y necesita uno de estos de forma nativa, eso es un trabajo real que programar, no un archivo que añadir que registre "not implemented".

**No hay controladores de relleno en este árbol.** Un protocolo tiene una implementación que funciona o está en esta sección. Una prueba exige que todo protocolo que declara el modelo tenga un controlador compilado, y viceversa.

## Credenciales de dispositivo

El `config` y la `address` de un dispositivo son donde un controlador encuentra con qué inicia sesión. Estas son las credenciales que lee cada protocolo, y todas son de solo escritura a través de la API (4.15.1): se muestran como `[redacted]` a todos los roles, un guardado que envía el marcador o omite la clave conserva el valor almacenado, y una cadena nueva lo sustituye. Las reglas, y lo que no pasa por la API, están en [Autenticación y usuarios](/es/iot/authentication/#las-credenciales-de-dispositivo-son-de-solo-escritura).

| Protocolo | Credenciales en la configuración | Credenciales en la dirección |
|---|---|---|
| OPC UA | `password` (con `username`) | ninguna: la información de usuario en la dirección se oculta y el controlador la ignora |
| MQTT / Sparkplug B | `password` (con `username`) | `mqtt://user:pass@host`, que usa el cliente |
| HTTP / REST | `password` (con `username`, enviada como autenticación básica); todo valor de `headers` salvo los simples como `Accept` y `Content-Type`, que es donde van una clave de API o una cabecera `Authorization`; `body` y `writeBody` si mencionan una credencial | `http://user:pass@host` y valores de consulta al estilo `?api_key=`, en la dirección y en `writeUrl` |
| MTConnect | `password` (con `username`); todo valor de `headers`, con las mismas excepciones | `http://user:pass@host` y valores de consulta |
| UniFi Network | `password` (con `username`). Solo se almacena cifrada: sin una clave (más abajo) el dispositivo no se puede guardar | ninguna: la dirección es la URL `https://` de la consola |
| BACnet/IP | ninguna | ninguna: la dirección es `host` o `host:port` |
| CODESYS | `password` (con `username`), como para OPC UA | ninguna: la información de usuario en la dirección se oculta y el controlador la ignora |
| SNMP | `community` (v1, v2c); `authPassword` y `privPassword` (v3), con `username` | ninguna: la dirección es `host` o `host:port` |
| Modbus, S7comm, EtherNet/IP | ninguna | ninguna: la información de usuario en la dirección se oculta y el controlador la ignora |

**Cifrado en reposo.** Con `HOTLOOP_SECRET_KEY_FILE` definido (el chart lo define, con una clave que genera), toda credencial de la columna de configuración anterior se cifra en la base de datos con esa clave, que vive fuera de la base de datos, de modo que un volcado o una copia contiene texto cifrado. El resto de HotLoop, y los controladores, nunca notan la diferencia. Una credencial escrita en una URL (`mqtt://user:pass@host`, `?api_key=`) o en texto libre como un `body` HTTP también se cifra: la dirección u opción completa se sella y vuelve exactamente como se escribió, y una URL sin nada secreto se deja legible. La opción `password` sigue siendo el sitio más ordenado para una. Consulte [Copias de seguridad y restauración](/es/iot/backup/#credenciales-de-dispositivos-y-la-clave-secreta).

Cualquier otra opción cuyo nombre parezca una credencial (contiene `password`, `token`, `secret`, `apikey`, `authorization`, `private`, `passphrase`, o termina en `key`, o tiene una palabra completa como `pass`, `pw`, `auth`, `cred` o `sig`, entre otras) también se oculta, sea cual sea su protocolo, de modo que una opción añadida a un controlador más adelante queda oculta hasta que alguien decida que no debe estarlo. Una prueba recorre las opciones de todos los controladores y falla hasta que cada una figura en la lista de credenciales o en la de opciones que se sabe que no lo son. Consulte [Autenticación y usuarios](/es/iot/authentication/#las-credenciales-de-dispositivo-son-de-solo-escritura) para las reglas completas.

## Añadir un dispositivo

1. **Dispositivos → Añadir dispositivo.** Elija el protocolo, déle una dirección.
2. **Descubrir tags** donde el protocolo lo admita: OPC UA, EtherNet/IP, MTConnect, MQTT (tras un nacimiento Sparkplug), HTTP, SNMP, BACnet/IP, CODESYS. Modbus y S7comm no pueden enumerar sus propios puntos, así que declárelos a partir de la documentación del dispositivo.
3. Los tags importados se crean **de solo lectura**. Un punto que el dispositivo expone no es un punto que alguien haya decidido que se pueda comandar. Marque los tags como escribibles uno a uno, deliberadamente.
4. Defina `scale` y `offset` para cuentas en bruto: `engineering = raw × scale + offset`. Si el instrumento envía un código cuando un canal está muerto o fuera de rango, inclúyalo en [Valores sin datos](#valores-sin-datos) para que se lea malo en vez de como un número.
5. Defina un `deadband` en todo lo que sea ruidoso. Suprime las escrituras en el historiador por cambios demasiado pequeños para importar, y sin él un sensor de 12 bits que fluctúa en su último bit escribe una fila en cada ciclo para siempre.

## Valores sin datos

Un registrador con un termopar quemado no se queda callado. Sigue respondiendo, y lo que pone en el registro es un código: 0x8005 para "undefined", 0x7FFF para "over range". Leído como int16 con una escala de 0,1, 0x8005 son -3276,3 grados, y hasta que lo arreglamos volvía con calidad **buena**, entraba en el historiador como una temperatura real y se quedaba ahí para que la juzgaran las alarmas. Un sensor muerto parecía uno frío.

Así que un tag puede enumerar los valores en bruto que significan "sin medición". Cada uno tiene un motivo. Cuando el valor en bruto de una lectura está en la lista, la lectura es **mala**, el motivo va con ella, y la escala y el desplazamiento nunca la tocan.

```json
{
  "deviceId": "dx-1", "name": "ch01", "address": "input:1:int16",
  "dataType": "float", "unit": "C", "scale": 0.1, "enabled": true,
  "noData": [
    {"raw": "0x7FFF", "reason": "+over"},
    {"raw": "0x8001", "reason": "-over"},
    {"raw": "0x8002", "reason": "skip"},
    {"raw": "0x8004", "reason": "error"},
    {"raw": "0x8005", "reason": "undefined"},
    {"raw": "0x7F7F", "reason": "power fail"},
    {"raw": "0x7FFA", "reason": "burnout up"},
    {"raw": "0x8006", "reason": "burnout down"}
  ]
}
```

Esos ocho son los códigos de la familia Yokogawa DX, del manual de comunicación del DX (IM 04L41B01-17E, sección 4.3, página 4-35). No son especiales de HotLoop: es el mismo campo en todo tag de todo protocolo, y la lista del DX es solo la que nos mordió primero. Cada uno está en el tag, así que un canal de registrador que de verdad puede leer 0x7F7F en alguna otra unidad lo conserva como lectura.

| Campo | <span class="sr-only">Detalles</span> |
|---|---|
| `raw` | El código del dispositivo, escrito como lo imprime su manual: `"0x8005"` (hexadecimal), `"-32763"` o `32773` (decimal). Una cadena o un número simple. Obligatorio |
| `reason` | Lo que dice la calidad de la lectura. Hasta 120 caracteres. Si se omite, dice `raw value 0x8005 means no measurement`, de modo que una lectura nunca sale mala sin decir por qué |

En el editor de tags es la casilla **Valores sin datos**: un código por línea, el código, un espacio, el motivo.

### Qué número escribir

Para un punto Modbus respaldado por registro, el código es el entero que contiene el dispositivo, una vez aplicado el orden de bytes y de palabras del punto. Es el mismo número en que se decodifica el punto, así que un manual que dice "el instrumento devuelve 8005h" significa exactamente `"0x8005"` aquí.

- **int16 y los demás tipos con signo.** `0x8005` y `-32763` son el mismo registro, y también `32773`. Escriba el que escriba el manual; los tres coinciden. Un código que no cabe en el tipo (`0x10000` en un int16) se rechaza cuando el dispositivo conecta, porque una lista que nunca puede coincidir es peor que un error. Dos grafías de un mismo valor en un mismo tag también se rechazan.
- **uint16 y los demás tipos sin signo.** De `0` hasta el máximo del tipo. Un número negativo se rechaza.
- **int32, uint32, int64, uint64.** Las mismas reglas a 32 y 64 bits. `0x7FFFFFFF` en un int32 con orden de palabras `CDAB` es el valor después de poner las palabras en el orden correcto, no el orden en que salieron del cable.
- **float32 y float64.** El código es el patrón de bits del registro, así que tiene que ser hexadecimal: `0x7FC00000` para un NaN silencioso. Un decimal se rechaza, porque 32773 como float y 32773 como patrón de bits son cosas distintas y no vamos a adivinar.
- **Bits, coils, entradas discretas y cadenas.** No hay número en bruto con el que comparar, así que `noData` en uno se rechaza cuando el dispositivo conecta.

La comprobación se hace sobre los bits en bruto, antes de decodificar, antes de la escala, antes del desplazamiento.

### Otros protocolos

Todo controlador que entrega un número ya decodificado comprueba la misma lista: S7comm, EtherNet/IP, OPC UA, HTTP y MQTT (incluidos los dispositivos descubiertos). Lo que comparan es ese número decodificado, como número entero, así que escríbalo como el número que es. Un INT de S7 que contiene 0x8005 es -32763, así que escriba `-32763`. El hexadecimal aquí es solo otra forma de escribir el mismo número, porque un número decodificado ha perdido su ancho y no se puede leer de vuelta como patrón de bits. Un valor fraccionario nunca coincide. Solo vale la pena definir la lista donde el dispositivo envía códigos así; la mayor parte de lo que informan MTConnect y UniFi nunca lo hace.

### Qué hace un valor centinela

- La **calidad** es `bad` y la lectura lleva el motivo. Se muestra en `GET /api/values` y en el flujo en vivo (`reason`), junto a la calidad en la pantalla Tags, y en las entidades del tag como el atributo `quality_reason`.
- El **valor** está vacío, ni cero ni el código escalado. No se aplican la escala ni el desplazamiento.
- El **historiador** registra la calidad como mala, igual que cualquier otra lectura mala, y su columna de valor no contiene nada significativo. Un intervalo sin ninguna lectura buena se muestra como un hueco en una tendencia, como con cualquier lectura mala.
- **Alarmas.** Una lectura mala nunca dispara una alarma de valor: alta, baja, igual, tasa de cambio mantienen todas su estado anterior, igual que con cualquier lectura mala. Una alarma `bad-quality` en el tag sí se dispara, y su mensaje por defecto lleva el motivo (`dx-1/ch01 bad-quality: undefined`). Use `{reason}` en su propio mensaje para ponerlo ahí.
- El **libro de registro** anota que la entidad del tag pasa a mala, y el motivo es el atributo `quality_reason` de la entidad.

### Dónde vive

En el tag, guardado con él. Por la API es la lista `noData` en `POST /api/tags` (consulte [la API HTTP](/es/iot/api/#post-apitags)), en el editor es la casilla de arriba, y en un Edge Relay es el mismo JSON en el tag del archivo de dispositivo (consulte [Referencia de Edge Relay](/es/edge-relay/reference/)). Guardar el tag recarga el dispositivo en ejecución, así que un cambio surte efecto en el siguiente sondeo y nada se reinicia a mano. Un redescubrimiento deja intacta la lista de un tag.

## Calidad

Toda lectura lleva `good`, `uncertain` o `bad`.

**Malo significa que el valor no se conoce. No significa cero.** Un controlador que no puede leer un punto emite igualmente una lectura, marcada como mala, porque el silencio no se distingue de un valor que no ha cambiado, y en una tendencia la diferencia entre "el sensor lee 0" y "el sensor dejó de responder" es la diferencia entre un problema de proceso y un problema de instrumento.

La evaluación de alarmas mantiene su estado anterior ante una lectura mala en lugar de evaluarla. Un sensor que falla a cero dispararía de otro modo todas las alarmas de mínima de la unidad y parecería un evento de proceso.
