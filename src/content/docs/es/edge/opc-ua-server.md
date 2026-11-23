---
title: "El servidor OPC UA"
description: "Publica los dispositivos y tags configurados como un espacio de direcciones OPC UA de solo lectura, y su SCADA actual ve cada tag sin un controlador nuevo."
---

El servidor OPC UA de HotLoop, desde la versión 4.13.0, publica los dispositivos y tags configurados en el Gateway como un espacio de direcciones OPC UA, de modo que un cliente OPC UA de terceros, un paquete SCADA, un HMI, un historiador o una herramienta de pruebas como UaExpert pueda leer los tags en vivo del Gateway sin que nadie tenga que escribir un controlador de HotLoop para el otro lado.

Activado de forma predeterminada (`HOTLOOP_OPCUA_SERVER_ENABLED`), en el binario y en el chart de Helm. Arranca con la autenticación de HotLoop activada y un inicio de sesión propio, `opcua-reader`, que HotLoop crea con una contraseña generada que Ajustes muestra a un administrador (`GET /api/opcua/server`); puede leer etiquetas y valores y nada más. Con la autenticación de HotLoop desactivada no hay usuarios con los que iniciar sesión, así que el servidor queda en espera y lo indica (no se niega a arrancar). Si otro servidor OPC UA del equipo ya ocupa el 4840, queda en espera y lo indica; un puerto que usted eligió y que no se puede abrir es un error: abrir un listener en una red de planta es algo que un despliegue hace a propósito. Puerto predeterminado 4840.

**Es de solo lectura.** Consulte [Por qué es de solo lectura](#por-qué-es-de-solo-lectura). También sirve el historial de cada tag: consulte [Historial](#historial).

## Qué se expone

Un nodo **Object** por cada dispositivo habilitado, directamente bajo la carpeta estándar *Objects*, y un nodo **Variable** por cada tag habilitado debajo de su dispositivo. Los dispositivos y tags desactivados no se publican: no tienen worker ni lectura, así que publicarlos solo pondría un nodo Bad permanente delante del cliente. El espacio de direcciones es exactamente lo que el runtime está sondeando.

Todo vive en un único espacio de nombres, `urn:hotloop:ua:gateway`. El URI del espacio de nombres es una constante, no se deriva del nombre del host ni del URI de la aplicación: un cliente guarda un nodo como URI más identificador y vuelve a encontrar el índice del espacio de nombres en cada conexión, y un URI que cambiara con el nombre de un pod dejaría huérfana cada suscripción configurada en un proyecto SCADA. Resuelva el índice a partir de la matriz de espacios de nombres del servidor por su URI, como hace un cliente real; no dé por hecho `ns=2`.

### NodeIds

Los identificadores son cadenas de texto y son estables:

| Nodo | Identificador NodeId |
|---|---|
| Dispositivo | `<deviceId>` |
| Tag | `<deviceId>/<tagName>` |
| Propiedad `EngineeringUnits` / `EURange` de un tag | `~EngineeringUnits/<deviceId>/<tagName>` y `~EURange/…` |

La forma del tag es `model.TagKey.String()`, la grafía `device/tag` que ya usa el resto del código, así que un NodeId y una clave de tag se convierten el uno en la otra con `model.ParseTagKey`. Un separador `.` no habría funcionado: los ids de dispositivo pueden contener puntos, de modo que `a.b.c` podría ser el dispositivo `a` con el tag `b.c` o el dispositivo `a.b` con el tag `c`. Un id de dispositivo no puede contener una barra, así que la primera barra es siempre el límite, y un nombre de tag que contenga barras (las rutas de exploración de OPC UA y los topics de MQTT las tienen) sigue dando el dispositivo correcto. Los ids de propiedad empiezan por `~`, algo que un id de dispositivo no puede, así que una propiedad nunca puede chocar con un tag, se llame como se llame.

### Atributos

| Atributo | Valor |
|---|---|
| `BrowseName` | el id del dispositivo / el nombre del tag, en el espacio de nombres de HotLoop |
| `DisplayName` | el nombre del dispositivo / el nombre del tag |
| `Description` | la descripción del dispositivo o del tag |
| `DataType` | véase más abajo |
| `ValueRank` | escalar (-1) |
| `AccessLevel`, `UserAccessLevel` | solo `CurrentRead` (0x01) |
| `MinimumSamplingInterval` | el intervalo de sondeo efectivo del dispositivo en ms; los valores no pueden cambiar más rápido de lo que el runtime los sondea, así que un cliente que pide una frecuencia de muestreo mayor la ve ajustada a ese intervalo |
| `Historizing` | false |

Un tag con unidad recibe una propiedad `EngineeringUnits` (`EUInformation`, id de unidad -1 = "no es un código UNECE", el texto de la unidad en `DisplayName`), y un tag con rango recibe una propiedad `EURange`. Un tag sin ninguna de las dos no tiene ninguna propiedad.

### Tipos de datos

El runtime reduce toda lectura numérica a un float64 en unidades de ingeniería, así que el tipo declarado es una decisión de presentación que se toma en `kindForTag`, y tiene que ser un tipo en el que el valor siempre se pueda expresar:

| `dataType` del tag | Tipo OPC UA |
|---|---|
| `bool`, `boolean`, `bit`, `coil`, `discrete` | Boolean |
| `string`, `text`, `char` | String |
| `int16` | Int16 |
| `uint16`, `word` | UInt16 |
| `int32`, `dint` | Int32 |
| `uint32`, `dword` | UInt32 |
| `uint64` | UInt64 |
| `int`, `int64` | Int64 (el tipo con signo más ancho, para que nada se desborde) |
| cualquier otro, incluido `float` | Double |
| **cualquier tipo entero con escala o con desplazamiento** | **Double** |

La última fila importa: un registro `int16` con escala 0,1 lee 23,4, y truncarlo a Int16 le entregaría al cliente un 23 con estado Good. Un valor que no cabe en su tipo declarado, por ejemplo un tag `int16` que entrega 70000, se informa como `BadOutOfRange` sin valor, nunca se envuelve ni se recorta hasta algo que parezca plausible. Un tag numérico cuya lectura trae texto es `BadTypeMismatch`.

### Valor, calidad y marcas de tiempo

Cada lectura (y cada muestra de una suscripción) se responde desde la caché en vivo del runtime, la misma fuente que sirve `/api/values`, nunca desde la base de datos. El código de estado se deriva de esa lectura **y del estado del enlace del dispositivo que hay detrás**, porque la caché sola no basta: conserva la última lectura que devolvió un dispositivo, y un dispositivo que después se cayó de la red sigue teniendo una última lectura de aspecto perfectamente bueno.

| Enlace del dispositivo | Lectura | Estado | Valor |
|---|---|---|---|
| Conectado, al menos un sondeo entregado en esta sesión | buena | **Good** | enviado |
| | dudosa | Uncertain | enviado |
| | mala, o una calidad no reconocida | Bad | ninguno |
| Conectado, todavía ningún sondeo entregado en esta sesión | cualquiera | BadWaitingForInitialData | ninguno |
| Conectado, nada en la caché | n/a | BadWaitingForInitialData | ninguno |
| Degradado (sesión activa, sondeos que fallan o llegan incompletos) | buena | **UncertainLastUsableValue** | enviado |
| | dudosa | Uncertain | enviado |
| | mala | Bad | ninguno |
| Desconectado, conectando, deshabilitado | cualquiera | **BadNoCommunication** | ninguno |
| Sin worker para el dispositivo | cualquiera | BadOutOfService | ninguno |
| Tag o dispositivo eliminado | n/a | BadNodeIdUnknown | ninguno |

Good solo se informa para un dispositivo conectado, en un sondeo de la sesión actual, cuya lectura es buena. Un tag de un dispositivo desconectado lee Bad, no su último valor con estado Good.

La antigüedad queda fuera a propósito. Las fuentes dirigidas por eventos (un tag MQTT/Sparkplug, una suscripción OPC UA) pueden mantener legítimamente un valor durante horas porque nada cambió, y llamarlo obsoleto según el reloj sería un error; saber si un dispositivo sigue entregando datos es tarea del enlace.

La **marca de tiempo de origen** es la marca propia de la lectura, el momento en que se supo por última vez del dispositivo, y se informa incluso con estado Bad. La **marca de tiempo del servidor** es el momento en que se respondió la lectura. Ambas están en UTC.

## Suscripciones

Los clientes pueden crear suscripciones y elementos monitorizados sobre las variables de los tags y recibir notificaciones de cambio de datos, que es como los clientes SCADA consumen realmente los tags. En esta biblioteca la monitorización funciona por muestreo: el servidor lee cada elemento monitorizado con su intervalo de muestreo (de al menos 100 ms, y de al menos el intervalo de sondeo del dispositivo) a través del mismo manejador que usa una lectura, y notifica cuando cambia el valor o el estado. Así, un cambio de *calidad*, como un dispositivo que se cae, se anuncia igual que un cambio de valor.

Un elemento monitorizado sobre un tag que se elimina no queda colgado: recibe `BadNodeIdUnknown`.

## Qué ve un cliente mientras cambia la configuración

Cuando se elimina un tag, las lecturas y los elementos monitorizados sobre él reciben `BadNodeIdUnknown` de inmediato, y desaparece de la exploración de su dispositivo también de inmediato. El nodo en sí permanece en la tabla de nodos del servidor unos 5 segundos más, inalcanzable, y después se borra. Un dispositivo eliminado funciona igual bajo la carpeta Objects.

Una edición nunca deja un hueco. Un tag o dispositivo editado se sustituye por su nueva versión bajo el mismo NodeId en un solo paso, así que una lectura o una exploración en ese instante ve la versión vieja o la nueva, nunca "desconocido". Las suscripciones sobre él continúan.

El retraso antes de borrar no es decoración. El Browse de la biblioteca lee la lista de referencias de un nodo y luego busca cada destino sin mantener un bloqueo entre las dos cosas, y si un destino ha desaparecido entre medias, falla la exploración del *padre* con `BadNodeIdUnknown`, como si el dispositivo o la carpeta Objects no existieran. Antes borrábamos los nodos de golpe, y un cliente que exploraba un dispositivo mientras se eliminaba un tag, o que leía un tag mientras se editaba su dispositivo, podía recibir la respuesta de que un nodo perfectamente real no existía.

## Por qué es de solo lectura

Este incremento no implementa escrituras, y lo dice en tres sitios a la vez para que ningún cambio aislado pueda añadirlas sin que se note:

- cada nodo publicado tiene `AccessLevel = CurrentRead | HistoryRead` y no se instala ningún manejador de escritura, así que una escritura se rechaza con `BadNotWritable` y un cliente puede ver antes de intentarlo que el nodo no se puede escribir;
- las pruebas escriben en un tag como viewer, como operator y como admin, y comprueban que la respuesta es `BadNotWritable` **y que el registro del dispositivo detrás del tag no cambió**.

Una vía de escritura OPC UA tendría que pasar por esa puerta, llevar su principal a la pista de auditoría y respetar el interruptor general. Eso es un cambio con su propia revisión, no algo que llegue como subproducto de publicar tags, y a propósito no hay en esta versión ningún ajuste que lo active.

## Historial

Cada nodo de tag es historizable y lleva el nivel de acceso HistoryRead. El servidor responde al servicio HistoryRead de OPC UA con el propio historial de HotLoop, las mismas lecturas que sirve `/api/history`, de modo que un cliente al otro lado de una conexión OPC UA lee lo que el Gateway guardó sin una segunda base de datos. Un usuario necesita lo mismo que para leer un valor (`tags.read` y `values.read`), comprobado como se comprueba en una lectura de valor, para el usuario de la sesión, y no solo una vez al iniciar sesión.

- **Raw** (`ReadRawModifiedDetails`): las lecturas de una ventana, cada una con su propia calidad como estado y su propia marca de tiempo. Un inicio anterior al final lee hacia delante y un inicio posterior al final lee hacia atrás, de la más reciente a la más antigua. El inicio se incluye y el final se deja fuera (OPC UA 10000-11, sección 4.6), salvo que el cliente pida límites, en cuyo caso se añaden la lectura en el inicio o justo antes y la primera lectura fuera de la ventana al final. `NumValuesPerNode` es cuántos devuelve una llamada para un nodo; si hay más que eso, o más de 10.000, llegan en páginas, cada una con un punto de continuación válido durante cinco minutos y para un solo uso (se mantienen como máximo 1.000 a la vez). Una ventana sin nada es `Good_NoData`. El historial modificado se rechaza (`BadHistoryOperationUnsupported`): aquí nada se modifica ni se borra jamás.
- **Processed** (`ReadProcessedDetails`): Average, Minimum, Maximum, Count, Start, End y Total, sobre intervalos de `ProcessingInterval` desde la hora de inicio, según la regla de calidad (README, "The quality rule"): solo cuentan las lecturas buenas con un número finito. Un intervalo sin ninguna es `Good_NoData` (Count dice 0), y uno con lecturas descartadas lee `Uncertain_DataSubNormal`, de modo que el número nunca es mejor que lo que había en él. Cualquier otro agregado se rechaza para ese nodo (`BadAggregateNotSupported`), un tag de texto no tiene ninguno, y una ventana de más de 10.000 intervalos o de 500.000 lecturas se rechaza (`BadTooManyOperations`) en lugar de recortarse. Solo se responde a una ventana hacia delante con los dos extremos.
- **At time** (`ReadAtTimeDetails`): lo que el tag tenía en cada instante, que es su última lectura en ese instante o antes, con la marca de tiempo pedida. Nunca interpola, porque una lectura es un valor que alguien tomó; un instante anterior a la primera lectura del tag es `Bad_NoData`.
- Los **eventos** no se sirven: `BadHistoryOperationUnsupported`. Un dispositivo o cualquier otro objeto tampoco tiene historial, y un nodo de propiedad (`EngineeringUnits`, `EURange`) no lleva HistoryRead.

El historiador guarda una lectura cuando supera la banda muerta, no en cada sondeo, así que un tag tranquilo tiene pocas filas: lea At time, o una ventana Processed alrededor de la última lectura de un tag, cuando necesite lo que tenía y no solo cuándo cambió. `HistoryServerCapabilities` indica que se puede leer el historial y que una llamada devuelve como máximo 10.000 valores.

## Salud del equipo, para el panel de EmberNet

El Administrador de tareas del panel lee de la propia máquina la CPU, la memoria, el disco y el jitter de tiempo real: HotLoop los publica como un dispositivo y el servidor sirve su historial ([Historial](#historial)), de modo que el panel nunca lee su propia base de datos para ellos. Qué está construido y cómo se activa:

* **El dispositivo.** Con `HOTLOOP_BOX_HEALTH_NODE` definido (el chart lo fija al nombre del nodo de Kubernetes), HotLoop crea un dispositivo cuyo id es exactamente ese nombre, con el protocolo `boxhealth` ([Protocolos y controladores](/es/iot/protocols/#salud-del-equipo)). Sus tags son `cpu_util_pct`, `mem_util_pct`, `disk_util_pct` (el disco propio de la máquina), `data_util_pct` (el volumen donde HotLoop guarda sus datos) y, solo cuando `HOTLOOP_BOX_HEALTH_JITTER_FILE` nombra el archivo JSON que escribe un agente de tiempo real, `rtos_jitter_core1_us`, `rtos_jitter_core2_us` y `rtos_jitter_core3_us`. Sus ids de nodo OPC UA están en el espacio de nombres `urn:hotloop:ua:gateway` con el identificador de texto `<device id>/<tag>`.
* **Los números de la máquina.** El chart monta la raíz del host en `/host` y su `/proc` en `/host/proc`, ambos de solo lectura, y define el nombre del nodo, **de forma predeterminada** (`opcuaServer.dashboard.boxHealth.enabled: true`), de modo que el Administrador de tareas del panel funciona en cuanto HotLoop se instala. Solo se lee un statfs de `/host` y los contadores de CPU y memoria, y no se añade ningún privilegio. Un clúster que aplica el perfil restringido de Pod Security rechaza un hostPath: ahí, ponga `enabled: false` (sin dispositivo y sin montajes) o `hostMount: false` (el dispositivo, pero el disco y la CPU de la máquina se leen como Bad y dicen qué hay que montar). El dispositivo no necesita el servidor OPC UA.
* **Un acceso que puede leer y nada más.** El chart crea el usuario `embernet-dashboard-read` con exactamente `tags.read` y `values.read` (una lista explícita de permisos, nunca un rol) en la primera instalación, y guarda su contraseña generada en el Secret `<release>-opcua-dashboard` (claves `username`, `password` y `password-hash`). Una actualización nunca la rota. Una cuenta que ya existe no se cambia nunca por un reinicio.
* **El certificado del panel.** El panel crea el Secret `<release>-opcua-trust`, con una clave por certificado llamada `<sha1 thumbprint>.crt`. El chart lo monta, como opcional, en `/etc/hotloop/opcua-trust`, y el servidor guarda esos archivos en `trusted/` (`HOTLOOP_OPCUA_SERVER_TRUST_DIR`): al arrancar y cada 30 segundos, un archivo nuevo se añade, uno cambiado se reescribe y uno que sale del Secret se vuelve a quitar. Un archivo que un operador puso en `trusted/` nunca se toca, y prevalece sobre una clave del Secret con el mismo nombre.
* **El puerto.** El Service propio de la release (el que descubre el panel) incluye el puerto OPC UA 4840 cuando el servidor está activado, junto al Service propio del servidor OPC UA.

El servidor sigue como estaba: Basic256Sha256 SignAndEncrypt, sin sesiones anónimas, sin confiar en todo.

## Modelo de seguridad

### Transporte

Los canales seguros usan las políticas de la biblioteca en Sign y SignAndEncrypt. **`Basic256Sha256` se ofrece en los dos modos**, y es la que debe elegir un cliente.

**La política de seguridad None es una activación explícita** (`HOTLOOP_OPCUA_SERVER_ALLOW_INSECURE`, false por defecto), con una advertencia al arrancar cuando está activa. Con ella desactivada no se anuncia ningún endpoint None, y un cliente que abre un canal None de todos modos solo puede hacer descubrimiento: cualquier otro servicio se rechaza. Incluso con ella activada, el nombre de usuario y la contraseña siguen viajando dentro de un token cifrado (la política del token es `Basic256Sha256`, nunca None), aunque todos los valores que el cliente lee después quedan sin protección.

**Las políticas obsoletas vienen desactivadas.** La OPC Foundation ha declarado obsoletas `Basic128Rsa15` (RSA con relleno PKCS#1 v1.5) y `Basic256` (SHA-1). En versiones anteriores se ofrecían las dos en todas las listas de endpoints sin forma de quitarlas. `HOTLOOP_OPCUA_SERVER_ALLOW_DEPRECATED_POLICIES` (en el chart: `opcuaServer.allowDeprecatedPolicies`, `false` por defecto) lo decide:

- **Desactivado (el valor predeterminado, en instalaciones nuevas y en actualizaciones).** Ninguna de las dos políticas aparece en ningún endpoint del que se informe a un cliente, y un cliente que abre un canal seguro con una de ellas se rechaza al abrir el canal, antes de cualquier sesión o inicio de sesión. Los clientes con `Basic256Sha256`, `Aes128_Sha256_RsaOaep` o `Aes256_Sha256_RsaPss` no se ven afectados.
- **Activado.** Las dos se ofrecen de nuevo en Sign y SignAndEncrypt, para un cliente antiguo que no habla nada más reciente, con una advertencia al arrancar. Actívelo solo hasta que ese cliente se actualice.

Un cliente que dejó de conectarse tras la actualización y usa una de esas dos políticas muestra que el canal se rechaza; cambie el ajuste, o pase el cliente a `Basic256Sha256`.

### Certificado del servidor

Si se definen `HOTLOOP_OPCUA_SERVER_CERT_FILE` y `_KEY_FILE`, ese par RSA se usa tal cual. En caso contrario, se **genera un certificado autofirmado de instancia de aplicación en el primer arranque y se conserva** en `HOTLOOP_OPCUA_SERVER_PKI_DIR` (`own/cert.pem`, `own/key.pem`, clave con modo 0600), de modo que el siguiente arranque presenta el mismo certificado y un cliente al que se le dijo una vez que confiara en él no vuelve a recibir el aviso. Se registra una advertencia en cada arranque mientras el certificado sea autofirmado, con su huella SHA-1, la forma que muestran las herramientas OPC UA, para que un operador pueda compararla con lo que muestra un cliente.

El certificado dice lo que comprueban los clientes OPC UA, algo que un certificado TLS corriente no hace: el **URI de la aplicación** (`HOTLOOP_OPCUA_SERVER_APPLICATION_URI`, por defecto `urn:hotloop:gateway`, más `:<siteId>` cuando hay uno configurado) en los nombres alternativos de sujeto de tipo URI, los nombres de host y las direcciones que usan los clientes (el host del endpoint, `HOTLOOP_OPCUA_SERVER_CERT_HOSTS`, `localhost`, loopback, el nombre de host de esta máquina) como SAN de DNS y de IP, y los usos de clave que enumera la Parte 6 para una instancia de aplicación. RSA-2048, cinco años.

Un certificado conservado se sustituye, con una advertencia de que los clientes deben confiar en el nuevo, solo si ya no puede cumplir su función: le quedan menos de 30 días, un URI de aplicación que ya no coincide con la configuración, un host configurado que no cubre, o una clave que no se puede leer.

**El nombre de host de la máquina no es un host configurado.** Entra en un certificado nuevo, pero un certificado conservado se mantiene cuando cambia el nombre de host. En un contenedor el nombre de host es el id del contenedor, y en Kubernetes es el nombre del pod, así que cambia en cada redespliegue. Hasta que se corrigió esto contaba, y cada actualización de un Gateway en contenedor generaba un certificado nuevo: Ignition, al que se le había dicho que confiara en el antiguo, rechazaba el servidor con `Bad_SecurityChecksFailed` hasta que alguien volvía a confiar en él, en cada cliente y tras cada despliegue. Los clientes llegan al servidor por `HOTLOOP_OPCUA_SERVER_ENDPOINT_HOST` y `_CERT_HOSTS`; defínalos, y el certificado dura hasta que se acerca su caducidad. (Un Gateway sin host de endpoint definido usa el nombre de host de la máquina como host del endpoint, y ese sí cuenta, porque es lo que se les dice a los clientes. Otra razón para definirlo.)

**Una clave puede ser inutilizable, y el servidor la rechaza.** Aproximadamente una de cada veinte claves RSA no puede llevar un inicio de sesión OPC UA cifrado, y entonces todos los inicios de sesión cifrados con esa clave fallan, siempre, y el cliente solo ve "el canal seguro se ha cerrado". Las sesiones anónimas y sin cifrar no se ven afectadas, y eso es lo que hace fácil diagnosticarlo mal. Una clave generada se vuelve a sacar hasta que no sea una de ellas; una clave aportada por un operador que lo sea se rechaza al arrancar con un error que explica el motivo.

### Certificados de aplicación de los clientes

OPC UA autentica tanto la aplicación como el usuario. El servidor mantiene una lista de confianza en `<PKI_DIR>/trusted/`: un cliente cuyo certificado no está ahí se rechaza en el canal seguro, y su certificado se escribe en `<PKI_DIR>/rejected/`. **Para aprobar un cliente, mueva su certificado de `rejected/` a `trusted/`**, sin reiniciar; el directorio se lee en cada conexión. `<PKI_DIR>/issuers/` y `<PKI_DIR>/crl` se pasan tal cual para los certificados de cliente emitidos por una CA.

`HOTLOOP_OPCUA_SERVER_TRUST_ALL_CLIENT_CERTS` (false por defecto, con una advertencia al arrancar) se salta este paso. Solo quita la autenticación de la aplicación: un usuario sigue teniendo que autenticarse con un nombre de usuario y una contraseña de HotLoop.

### Quién puede iniciar sesión

**Nombre de usuario y contraseña, contra los usuarios propios de HotLoop.** Hay una sola base de usuarios, no un segundo almacén de credenciales: el autenticador busca al usuario con el mismo `store.User` que usa el inicio de sesión HTTP, compara con los mismos hashes bcrypt (`auth.CheckPassword`), normaliza el nombre de usuario igual (minúsculas, sin espacios en los extremos), ejecuta una comparación bcrypt exista o no el usuario para que el tiempo de respuesta no revele qué nombres son reales, y rechaza una cuenta deshabilitada. Usuario desconocido, contraseña incorrecta, usuario deshabilitado y usuario sin el permiso reciben todos la misma respuesta, `BadUserAccessDenied`.

**Un usuario solo puede leer tags si su rol concede `tags.read` y `values.read`**, el mismo par con el que la API HTTP protege `/api/tags` y `/api/values`, resuelto con los mismos `auth.Permissions` y `auth.Allows`, de modo que un rol integrado y una lista explícita de permisos se comportan exactamente como allí. Se exigen los dos porque un cliente OPC UA explora la lista de tags y lee valores por una sola conexión, y a un usuario con solo uno de los dos se le daría el otro gratis. Todo rol integrado que tiene `values.read` tiene también `tags.read`; esto solo importa para un usuario con una lista explícita de permisos.

**Los permisos se comprueban al usar, no solo al iniciar sesión.** La biblioteca pide los roles de una sesión en cada exploración, lectura y muestra de suscripción; se responden desde una caché de corta duración (10 s) de la base de usuarios. Un usuario que se deshabilita, se elimina o pierde permisos pierde el acceso en una sesión activa dentro de ese intervalo, con sus elementos monitorizados pasando a Bad, y no cuando su cliente vuelva a conectarse. Una consulta que falla cuenta como "no".

**Las sesiones anónimas están desactivadas** (`HOTLOOP_OPCUA_SERVER_ALLOW_ANONYMOUS`) y no se ofrece ningún token anónimo salvo que se active, con una advertencia al arrancar. Los tokens de identidad de usuario X.509 también están desactivados, y se ofrecen cuando se define `HOTLOOP_OPCUA_SERVER_ALLOW_X509` (consulte [Certificados de usuario X.509](#certificados-de-usuario-x509)). Si la autenticación propia de HotLoop está desactivada (`HOTLOOP_AUTH_INSECURE`), no hay usuarios con los que iniciar sesión, y el servidor se niega a arrancar salvo que se active el acceso anónimo.

Un inicio de sesión correcto se registra en el registro del sistema igual que un inicio de sesión HTTP. Los inicios de sesión fallidos se registran solo en el registro del proceso, con el motivo, para que un llamante no autenticado no pueda llenar la pista de auditoría. Se ejecutan como máximo cuatro comprobaciones de contraseña a la vez, porque cada una es una comparación bcrypt deliberadamente lenta y OPC UA no tiene un equivalente del limitador de tasa que hay delante de HTTP; más allá de eso no hay bloqueo ni límite de tasa, igual que en el inicio de sesión HTTP.

La biblioteca guarda la identidad de usuario descifrada, contraseña incluida, en el objeto de sesión mientras la sesión viva. Solo está en memoria y nunca se registra, pero un volcado de memoria de un Gateway en marcha contendría las contraseñas de los usuarios conectados en ese momento.

**Entran las contraseñas de cualquier longitud que HotLoop acepta, hasta 72 bytes (el límite de bcrypt).** En versiones anteriores una contraseña de 65 a 72 bytes podía iniciar sesión en la interfaz web y no aquí (`BadIdentityTokenRejected`). La longitud contaba la contraseña más el nonce de 32 bytes del servidor, así que la contraseña llegaba como máximo a 64 bytes. Nada en RSA ni en la especificación pide eso: el token se cifra en tantos bloques como necesite y el decodificador ya los lee todos. Ahora la comprobación es que la longitud sea al menos 32 y no mayor que los bytes que realmente se descifraron, que es lo que la comprobación debía garantizar, porque dimensiona el búfer que se crea a continuación. Una longitud que afirma más de lo que llegó se sigue rechazando, así que un cliente no puede hacer que el servidor reserve lo que no envió. La rama `main` original (comprobada el 2026-11-16) todavía tiene el límite; el cambio se ofrece a la biblioteca original como pull request desde HotLoop-io/opcua.

### Certificados de usuario X.509

Un cliente puede iniciar sesión con un certificado en lugar de una contraseña. Viene desactivado: defina `HOTLOOP_OPCUA_SERVER_ALLOW_X509=true` (en el chart `opcuaServer.allowX509`), y el servidor ofrece el token de usuario Certificate en sus endpoints seguros y lo dice al arrancar. Sin eso ningún endpoint lo ofrece y un inicio de sesión con certificado se rechaza.

**Cómo se asigna un certificado a un usuario.** Un admin adjunta el certificado a un usuario de HotLoop: Ajustes, Certificados OPC UA, Adjuntar un certificado (o la API, `POST /api/users/{username}/certificates`, o la herramienta MCP `add_user_certificate`). El registro guarda el certificado público, su huella SHA-256, quién lo adjuntó y cuándo, si está revocado y cuándo inició sesión por última vez. Un cliente que lo presenta y demuestra que posee la clave privada inicia sesión **como ese usuario**. No se configura nada más y no se confía en nada del certificado en sí: no se mira el nombre común, no hay una CA que operar, y un certificado que nadie adjuntó no hace nada.

**Qué lleva el token.** Un cliente puede enviar su certificado seguido de los que lo emitieron; el primero es el certificado que se adjuntó, y los demás se ignoran.

**Prueba de la clave.** La biblioteca comprueba la firma del token sobre el certificado del servidor y el nonce de sesión, que solo puede hacer quien posee la clave privada; un certificado presentado con la firma de otra clave se rechaza.

**Qué puede hacer.** Exactamente lo que puede hacer el usuario. El inicio de sesión exige que el usuario esté habilitado y tenga `tags.read` y `values.read`, el mismo par que un inicio de sesión con contraseña, y la sesión se comprueba cada 10 segundos como una de contraseña: un usuario que se deshabilita o pierde el permiso pierde una sesión activa con certificado dentro de ese intervalo. Es de solo lectura como toda sesión aquí; una sesión con certificado no puede escribir, sea cual sea el rol del usuario.

**Rechazado, con el motivo en el registro.** Un certificado que no está registrado, está revocado, ha caducado, todavía no es válido, o cuyo usuario ya no existe, está deshabilitado o no tiene el permiso, recibe `BadUserAccessDenied`, la misma respuesta para todos ellos, de modo que un cliente no aprende nada sobre cuál fue. El motivo va al registro del proceso y a la pista de auditoría.

**Revocar.** Revóquelo en la misma pantalla (o con `POST .../{thumbprint}/revoke`). Deja de iniciar sesión al instante y una sesión abierta con él termina en 10 segundos. Un certificado revocado sigue en la lista, con quién lo revocó y cuándo, de modo que un inicio de sesión rechazado dice "revocado" y no "desconocido"; elimínelo para olvidarlo. Las copias de seguridad incluyen el registro, con las revocaciones.

**Auditoría.** Cada inicio de sesión con certificado es una entrada del libro de registro (categoría auth) con el usuario, la huella y el sujeto del certificado y la aplicación cliente. Cada rechazo también lo es, con el motivo. Un cliente que repite el mismo rechazo escribe una entrada por minuto para ese certificado y motivo, no una por intento; todos los rechazos siguen estando en el registro del proceso. Adjuntar, revocar y eliminar un certificado son entradas con quién lo hizo. La clave privada nunca está en ninguna de ellas, y HotLoop nunca tiene una: solo se envían o se guardan certificados públicos.

**No es la lista de confianza de aplicaciones.** El certificado de aplicación de un cliente en `<PKI_DIR>/trusted/` le permite abrir un canal seguro; no es un inicio de sesión. Un certificado de usuario es otro objeto: el de una persona, adjuntado a un usuario. Un mismo certificado puede servir para las dos cosas en el lado del cliente, pero el servidor las trata como dos actos.

**El propio cliente de HotLoop** también inicia sesión así: consulte `userCertificate` y `userPrivateKey` en [Protocolos y controladores](/es/iot/protocols/#opc-ua).

No está construido: una autoridad de certificación en la que se confíe para avalar certificados de cliente y una regla de nombres que los asigne a usuarios. El registro cubre una planta que adjunta sus certificados de cliente uno a uno; una CA sería una adición al registro, no un reemplazo.

### Se eliminan los diagnósticos del servidor

Los nodos de diagnóstico por sesión de la biblioteca permitirían a cualquier usuario con sesión iniciada explorar el nombre de usuario y la dirección de cliente de todas las demás sesiones, así que están desactivados, y el objeto `Server/ServerDiagnostics` se elimina del espacio de direcciones (la biblioteca además escribe sus contadores sin bloqueo).

## Cambios en el espacio de direcciones en ejecución

Los dispositivos y tags se añaden, editan y eliminan mientras el Gateway funciona, y el espacio de direcciones los sigue sin reiniciar. **Mecanismo: una llamada de retorno del runtime, más un temporizador como red de seguridad.**

- `runtime.Manager.OnReload` hace la llamada de retorno tras cada `Reload` correcto. Toda mutación de dispositivo o de tag que hace la API termina en un `Reload`, así que un cambio hecho desde la interfaz o la API se publica en cuestión de instantes. La llamada solo avisa a una goroutine de reconciliación; nunca hace el trabajo ella misma, de modo que una reconciliación lenta no puede bloquear la petición de la API que la provocó.
- Una reconciliación periódica (`HOTLOOP_OPCUA_SERVER_RECONCILE_INTERVAL`, 30 s por defecto) recoge todo lo que cambia la configuración sin un `Reload`.

Las dos ejecutan la misma diferencia idempotente contra los dispositivos y tags habilitados de la base de datos. Solo toca lo que difiere: un tag editado se sustituye, uno eliminado se borra, y todo lo demás, incluidos los elementos monitorizados que los clientes tienen sobre él, queda exactamente como estaba. Los nodos de un dispositivo nuevo entran en el espacio en una sola llamada, así que un cliente que explora durante una reconciliación ve un dispositivo con todos sus tags o con ninguno.

Se prefirió la llamada de retorno al sondeo por sí solo porque el runtime ya tiene la señal limpia (`Reload`) y hace visible un cambio en milisegundos en lugar de hasta un intervalo completo; el temporizador se queda porque el espacio de direcciones no debe depender de que cada futuro escritor de configuración se acuerde de recargar.

## Conectar un cliente

El endpoint es `opc.tcp://<HOTLOOP_OPCUA_SERVER_ENDPOINT_HOST>:<port>`. En un clúster el chart usa por defecto como host el nombre DNS del Service de la release; fuera de uno, defínalo con el nombre o la dirección que los clientes usarán de verdad (una dirección de LoadBalancer, un registro DNS): se anuncia en cada URL de endpoint y se escribe en el certificado generado. **No** es donde se enlaza el servidor: la biblioteca escucha en todas las interfaces y solo recibe un puerto.

Con UaExpert o cualquier otro cliente:

1. Añada el servidor con esa URL y elija `Basic256Sha256` / `Sign & Encrypt`.
2. Elija *Username* e inicie sesión con un usuario de HotLoop que tenga `tags.read` y `values.read`; o, con `HOTLOOP_OPCUA_SERVER_ALLOW_X509` activado, elija *Certificate* y aporte el certificado de usuario y la clave que un admin adjuntó a un usuario.
3. La primera conexión se rechaza porque el servidor aún no confía en el certificado del cliente. Búsquelo en `<PKI_DIR>/rejected/` (en el volumen de PKI dentro de un clúster), muévalo a `trusted/` y vuelva a conectar.
4. La primera vez, el cliente pregunta si se confía en el certificado del servidor; compare la huella con la del registro de arranque.
5. Explore *Objects* → el dispositivo → sus tags, y arrastre tags a la vista de acceso a datos; se suscriben.

## Ignition 8.3 como cliente

**Verificado el 2026-09-27 con Ignition 8.3.9**, la versión estable actual, en la imagen de contenedor oficial de Inductive Automation (`inductiveautomation/ignition:8.3.9`, edición estándar en su periodo de prueba), contra un Gateway de HotLoop cuyo dispositivo de demostración `extruder-1` lo alimenta un simulador. Lo que se demostró, de extremo a extremo:

- una conexión OPC UA de Ignition a `opc.tcp://<gateway>:4840` con `Basic256Sha256` y `SignAndEncrypt`, con sesión iniciada como **viewer** de HotLoop;
- la confianza entre certificados en los dos sentidos, como se explica más abajo;
- tags OPC en el proveedor `[default]` de Ignition que apuntan a nodos de HotLoop, con lecturas de calidad Good que cambian según se mueve el simulador. Cada valor que mostró Ignition era uno que el `/api/values` de HotLoop había guardado: el mismo double cruza el cable sin cambios, así que se comparan por igualdad, no por cercanía. Un tag de texto declarado `string` en HotLoop leyó "RUNNING" en un tag String de Ignition;
- una escritura desde Ignition rechazada: Ignition envió la escritura, HotLoop respondió `Bad_NotWritable` (leído en el cable sobre un canal solo Sign, donde la respuesta va firmada pero no cifrada), y el valor de HotLoop no se movió;
- todas las políticas y modos de seguridad que ofrece Ignition, más abajo.

### Cómo configurarlo

En el lado de HotLoop, antes de Ignition:

1. Active el servidor y defina `HOTLOOP_OPCUA_SERVER_ENDPOINT_HOST` con el nombre por el que Ignition llega al Gateway. Ese nombre está en cada URL de endpoint que anuncia el servidor y en su certificado.
2. Cree un usuario de HotLoop para Ignition con el rol **viewer** (un admin lo hace con `POST /api/users`; consulte [Autenticación y usuarios](/es/iot/authentication/)). Cualquier rol con `tags.read` y `values.read` inicia sesión; no se ofrece nada más, porque el servidor es de solo lectura.

En el Gateway de Ignition (la interfaz web en el puerto 8088):

3. En la página **OPC Connections**, bajo Connections (`/app/connections/opc-client-connections`), cree una conexión **OPC UA**. URL del endpoint `opc.tcp://<gateway>:4840`; elija el endpoint `Basic256Sha256` / `SignAndEncrypt`; autenticación **Username**, con el usuario y la contraseña de HotLoop. La conexión pasa a Faulted enseguida, lo cual es lo esperado: paso 4.
4. **Apruebe Ignition en HotLoop.** El certificado de cliente de Ignition ya está en `<PKI_DIR>/rejected/` del Gateway (`/data/opcua-pki/rejected` en el contenedor y en el chart), con el nombre de su huella SHA-1, `<thumbprint>.crt`. Compare la huella con el propio certificado de cliente OPC UA de Ignition, que aparece en la página de certificados OPC (`/app/connections/opc/security/certificates`). Después mueva el archivo a `trusted/`. Sin reiniciar en ninguno de los dos lados. HotLoop no registra el rechazo; el archivo es la única señal.
5. **Apruebe HotLoop en Ignition.** Ahora la conexión falla en el otro sentido: el estado dice `Bad_SecurityChecksFailed ... unable to find valid certification path`. El certificado de HotLoop está en los certificados de **cliente** rechazados de Ignition, en la misma página. Compruebe su huella con la que HotLoop registra al arrancar (`generated a self-signed OPC UA application certificate ... thumbprint=`) y confíe en él. Sin reiniciar; la conexión se levanta en unos segundos.
6. **Tags.** Cree tags OPC con la conexión como servidor OPC y rutas de elemento en la forma de URI del espacio de nombres, que Ignition acepta tal cual:

   ```
   nsu=urn:hotloop:ua:gateway;s=extruder-1/Emberburn_Temperature
   ```

   Declare cada uno como lo que publica HotLoop (consulte [Tipos de datos](#tipos-de-datos)): Float8 para un float, Boolean, String, Int2 para un `int16`, Int4 para un `uint16` o `int32`, Int8 para los enteros más anchos. Se suscriben con la frecuencia del grupo de tags, y HotLoop ajusta al alza una frecuencia de muestreo más rápida hasta el intervalo de sondeo del dispositivo.

Lo mismo, como archivos o por la API REST :

- La conexión es el recurso `data/config/resources/core/ignition/opc-connection/<name>/config.json`, con el tipo de perfil `com.inductiveautomation.OpcUaServerType`, o `POST /data/api/v1/resources/ignition/opc-connection`. Dos cosas no son obvias. La contraseña es un secreto incrustado, un JWE que `POST /data/api/v1/encryption/encrypt` genera a partir del texto sin cifrar; no se acepta una cadena simple. Y el bloque `security` necesita el alias del almacén de claves de cliente del gateway y su contraseña: si se omite, la conexión falla con una NullPointerException, y si el alias está vacío falla con `Unable to retrieve KeyPair for alias 'client'`. Copie el bloque de la conexión de bucle local `Ignition OPC UA Server` de serie, que lleva ambos.
- Los certificados están en `data/config/local/com.inductiveautomation.opcua/client/security/pki/` (`rejected/certs`, `trusted/certs`), o con `GET /data/opc-ua/api/v1/client/pki/certificates/rejected` y `POST .../trusted/<sha1>` por la API. **Ignition no nombra los archivos con la huella**; el campo `signature` de la API es la huella SHA-1, y coincide con lo que registra HotLoop.
- Los tags se importan con `POST /data/api/v1/tags/import?provider=default&type=json`.
- Toda llamada a la API necesita una clave de API (la página API Keys, `/app/platform/security/api-keys`), y una clave solo pasa si uno de sus niveles de seguridad está en los permisos de lectura o de escritura del gateway (el recurso `security-properties`).

### Qué esperar

- **`Bad_SecurityChecksFailed` significa dos cosas distintas.** Ignition muestra el mismo estado cuando HotLoop rechaza el certificado de Ignition (paso 4; el mensaje no da motivo) y cuando Ignition rechaza el de HotLoop (paso 5; el mensaje dice *unable to find valid certification path*). Mire primero el `rejected/` de HotLoop.
- **Un redespliegue de HotLoop conserva su certificado.** Hasta la 4.15.3 no era así: el certificado tenía que cubrir el nombre de host del contenedor, que cambia cada vez que se recrea el contenedor, así que cada actualización generaba un certificado nuevo e Ignition rechazaba el servidor hasta que alguien volvía a confiar en él. Consulte [Certificado del servidor](#certificado-del-servidor). El certificado sigue cambiando si se pierde el volumen de PKI.
- **Un tag de texto declarado numérico lee `Bad_TypeMismatch`.** HotLoop publica un tag con el tipo con el que está declarado, y un tag `float` que contiene "RUNNING" no puede ser un Double. Los tags creados por Discover tags hasta la 4.15.3 se declaraban todos `float`; consulte [Protocolos y controladores](/es/iot/protocols/#opc-ua). Declárelos `string`.
- **Las escrituras se rechazan, e Ignition difumina el motivo.** HotLoop responde `Bad_NotWritable`. El propio servidor OPC UA de Ignition, al pedirle escribir el mismo tag, solo transmite un `Bad` genérico (0x80000000). El valor del tag de Ignition no cambia.
- **Las políticas obsoletas funcionan solo si se activan.** Ignition ofrece `Basic128Rsa15` y `Basic256`. Elija `Basic256Sha256` o una de las políticas `Aes` en la conexión.
- **El periodo de prueba.** Un gateway 8.3 sin licencia funciona durante dos horas y después deja de ejecutarse hasta que se reinicia la prueba en la interfaz web del Gateway. Los tags se quedan sin actualizar cuando termina; eso es Ignition, no la conexión.

### Matriz de políticas

Cada fila es una sesión nueva con esa política y ese modo, leyendo valores en vivo. Las dos filas obsoletas se midieron con `HOTLOOP_OPCUA_SERVER_ALLOW_DEPRECATED_POLICIES` activado; con ella desactivada, como viene por defecto, esas dos políticas no se ofrecen y se rechaza un canal que pida una de ellas:

| Política | SignAndEncrypt | Sign |
|---|---|---|
| `Basic256Sha256` | funciona | funciona |
| `Aes128_Sha256_RsaOaep` | funciona | funciona |
| `Aes256_Sha256_RsaPss` | funciona | funciona |
| `Basic256` (obsoleta) | funciona | funciona |
| `Basic128Rsa15` (obsoleta) | funciona | funciona |

`None` no se ofrece salvo que se defina `HOTLOOP_OPCUA_SERVER_ALLOW_INSECURE`, y no se probó.

## Configuración

| Variable | Por defecto | <span class="sr-only">Details</span> |
|---|---|---|
| `HOTLOOP_OPCUA_SERVER_ENABLED` | `true` | Activado en el binario y en el chart; `false` apaga el servidor |
| `HOTLOOP_OPCUA_SERVER_PORT` | `4840` | Puerto TCP, en todas las interfaces |
| `HOTLOOP_OPCUA_SERVER_ENDPOINT_HOST` | el nombre de host de esta máquina | A qué se les dice a los clientes que se conecten; también se escribe en un certificado generado. **Defínalo.** |
| `HOTLOOP_OPCUA_SERVER_APPLICATION_URI` | `urn:hotloop:gateway[:<siteId>]` | Debe mantenerse estable entre reinicios; debe ser un URI |
| `HOTLOOP_OPCUA_SERVER_PKI_DIR` | `/data/opcua-pki` | Certificado, clave, `trusted/`, `rejected/`. Respáldelo con un volumen |
| `HOTLOOP_OPCUA_SERVER_CERT_FILE` / `_KEY_FILE` | n/a | Usa este par RSA en lugar de generar uno; defina los dos o ninguno |
| `HOTLOOP_OPCUA_SERVER_CERT_HOSTS` | n/a | Nombres DNS / IP adicionales para un certificado generado |
| `HOTLOOP_OPCUA_SERVER_ALLOW_INSECURE` | `false` | Ofrece la política de seguridad None. Se advierte al arrancar |
| `HOTLOOP_OPCUA_SERVER_ALLOW_ANONYMOUS` | `false` | Acepta sesiones sin identidad. Se advierte al arrancar |
| `HOTLOOP_OPCUA_SERVER_TRUST_ALL_CLIENT_CERTS` | `false` | Omite la aprobación de certificados de cliente. Se advierte al arrancar |
| `HOTLOOP_OPCUA_SERVER_ALLOW_X509` | `false` | Ofrece el token de usuario Certificate: un cliente inicia sesión con un certificado adjuntado a un usuario ([Certificados de usuario X.509](#certificados-de-usuario-x509)). Se indica al arrancar |
| `HOTLOOP_OPCUA_SERVER_ALLOW_DEPRECATED_POLICIES` | `false` | Ofrece las políticas obsoletas `Basic128Rsa15` y `Basic256` para un cliente antiguo ([Transporte](#transporte)). Se advierte al arrancar |
| `HOTLOOP_OPCUA_SERVER_MAX_SESSIONS` | `20` | 0 = sin límite |
| `HOTLOOP_OPCUA_SERVER_MAX_SUBSCRIPTIONS` | `200` | 0 = sin límite |
| `HOTLOOP_OPCUA_SERVER_RECONCILE_INTERVAL` | `30s` | El periodo de la reconciliación de red de seguridad |

El servidor no se inicia en el modo `--mcp-stdio`: ese es un agente que lanza este binario como ayudante, y que un segundo proceso compita con el Gateway real por el puerto 4840 no debería ser posible.

### Helm

`opcuaServer.*` en `charts/hotloop/values.yaml`. Activarlo añade un Service (`<release>-opcua`, ClusterIP por defecto; LoadBalancer o NodePort es una decisión deliberada para un cliente fuera del clúster), un PVC para el directorio de PKI (`opcuaServer.persistence`; perderlo significa que cada cliente debe confiar en un certificado nuevo), el puerto del contenedor y, para que `networkPolicy.enabled` y `opcuaServer.enabled` juntos no dejen en silencio un servidor escuchando al que nada llega, el puerto en la regla de ingress de la NetworkPolicy por defecto. Un `networkPolicy.ingress` personalizado reemplaza esa regla, igual que para el broker, y entonces debe listar él mismo el puerto. `opcuaServer.tls.existingSecret` aporta un Secret `kubernetes.io/tls` en lugar de un certificado generado.

## Qué se ha verificado y qué no

HotLoop se ha ejecutado con equipos reales y servidores reales, y en hardware real el 2026-11-17.
