---
title: "Plugins sin npm"
description: "Un plugin es un módulo WebAssembly firmado, con techo de memoria, tiempo límite y descriptor, y no recibe acceso al host salvo que usted se lo conceda."
---

Un nodo de la comunidad de Node-RED es un paquete npm. Necesita Node.js en la caja y, una vez instalado, se ejecuta dentro del propio proceso del runtime con todo lo que ese proceso puede alcanzar. Flow no ejecuta esos nodos y nunca lo hará, así que esto es lo que hace en su lugar: un plugin es un módulo WebAssembly en un sandbox con techo de memoria y tiempo límite, viene con un descriptor del que el editor dibuja su diálogo, está firmado y no recibe acceso al host salvo que lo pida y usted lo conceda.

Lo que eso significa para usted: puede leer el contrato completo de un plugin en un solo archivo JSON antes de que se ejecute, la caja rechaza todo lo que no esté firmado por una clave que usted eligió, y lo peor que puede hacer un plugin con errores es fallar sus propios mensajes.

## Qué es un plugin

Un directorio bajo `<data.dir>/plugins/` (o `plugins.dir`), con el nombre del plugin, con tres archivos:

```
plugins/
  moving-average/
    plugin.wasm     the module
    plugin.json     the descriptor: name, dialog, capabilities, limits
    plugin.sig      an ed25519 signature over both
```

Cada plugin se convierte en un tipo de nodo, `wasm-<name>`, en la sección Function de la paleta. Los plugins se leen cuando arranca Flow, así que añadir uno o cambiarlo requiere un reinicio. No se lee nada en el momento de procesar un mensaje.

### El módulo

La ABI es la del [README](/es/flow/sandboxes/): `hotloop_flow_process` y `hotloop_flow_alloc` son obligatorias, `hotloop_flow_free` es opcional, y todo cruza como JSON. Un invitado recibe `{"msg": {...}, "config": {...}}` y devuelve `{"send": [[msgs for output 0], [msgs for output 1]], "status": {...}, "error": "...", "logs": [...]}`. Una propiedad del mensaje que no es JSON simple, como el identificador de respuesta que adjunta un nodo HTTP In o un búfer binario, no se entrega al invitado. El nodo la retiene y la vuelve a poner en cada mensaje que envía el invitado, salvo que el propio invitado haya fijado esa propiedad, de modo que un plugin puede situarse entre un HTTP In y un HTTP Response. `config` es lo que contiene el diálogo del nodo. Un `error` hace fallar el mensaje hacia un nodo Catch, y lo que se hubiera enviado antes se envía igualmente.

El módulo puede importar WASI y, si declaró una capacidad de contexto, las dos funciones de contexto que siguen. Cualquier otra cosa que importe se rechaza al cargar el plugin, y el rechazo nombra la importación.

### El descriptor

`plugin.json` se lee de forma estricta. Un campo que Flow no conoce es un rechazo, así que un `"capabilites"` mal escrito se detecta en lugar de convertirse en un plugin que silenciosamente no pidió nada.

| Campo | <span class="sr-only">Detalles</span> |
|---|---|
| `format` | `1`. Obligatorio. |
| `name` | Letras minúsculas, dígitos y guiones, hasta 40, empezando por una letra. Debe coincidir con el nombre del directorio, porque es lo que usan `plugins.grants` y el archivo del flujo. |
| `version` | Obligatorio. Se muestra en la ayuda del nodo y en `GET /plugins`. |
| `label`, `description`, `help` | La etiqueta de la paleta, una línea, y Markdown para la barra lateral de información. |
| `inputs`, `outputs` | Las entradas deben ser 1. Las salidas, de 0 a 16, por defecto 1. |
| `props` | El diálogo. Las mismas declaraciones de propiedades que usan los nodos integrados, con los tipos `string`, `text`, `number`, `bool`, `select`, `json` y `list`. Las credenciales, las referencias a nodos de configuración y los tipos de editor de código se rechazan: un plugin no tiene nada que hacer con ellos. |
| `capabilities` | El acceso al host que solicita. |
| `limits` | `memoryMiB` y `timeoutMs` que quiere por defecto. |

El editor dibuja el diálogo a partir de `props` sin ningún código del plugin en el navegador. Cada nodo de plugin recibe además un campo de nombre, otro de límite de memoria y otro de tiempo límite. Esos tres nombres están reservados.

## Límites, y cómo es una trampa

Cada nodo de plugin tiene su propio techo de memoria y su propio tiempo límite. El descriptor del plugin fija los valores por defecto (16 MiB y un segundo cuando no dice nada), un nodo puede cambiarlos en su diálogo, y `plugins.maxMemoryMiB` (64) y `plugins.maxTimeout` (5s) son lo máximo que la caja permitirá. Un nodo que pide más de lo que la caja permite hace fallar el despliegue e indica qué ajuste subir.

Un invitado que crece por encima de su techo cae en una trampa. Un invitado que sigue ejecutándose al llegar su tiempo límite se detiene. En ambos casos el mensaje va al nodo Catch más cercano, la instancia se descarta para que el siguiente mensaje empiece limpio, y ningún otro nodo se ve afectado. Lo que ve el nodo Catch en `msg.error.message`:

```
plugin hog: wasm guest exceeded its memory limit (calling hotloop_flow_process): wasm error: out of bounds memory access
plugin spin: wasm guest timed out while calling hotloop_flow_process
```

El techo se reserva por adelantado: un nodo con un techo de 64 MiB contabiliza 64 MiB del heap de Go mientras exista su instancia, lo toque el invitado o no, porque hacer crecer un búfer copiándolo permitiría que el host retuviera brevemente varias veces el techo. La prueba que lo demuestra mide lo que una llamada asignó en total (256 MiB para un techo de 256 MiB) y que el heap vuelve a donde estaba tras la trampa. Así que fije los techos en lo que un plugin necesita, no en el número más grande que pueda escribir.

## Capacidades

Sin capacidad, sin acceso. Cada una se conecta solo cuando el descriptor la pide y `plugins.grants` se la concede a ese plugin por su nombre.

| Capacidad | Qué da | Sin ella |
|---|---|---|
| `clock` | Los relojes reales, de pared y monotónico. | El invitado ve un reloj de sustitución que empieza el 2022-01-01 y no tiene nada que ver con el de la planta. |
| `random` | Los bytes aleatorios del sistema operativo. | La misma secuencia fija cada vez. |
| `context.flow` | Leer y escribir el contexto de flujo del propio flujo del nodo. | Las funciones de contexto no existen para él. |
| `context.global` | Leer y escribir el contexto global. | Igual. |

```yaml
plugins:
  trustedKeys: ["ed25519:..."]
  grants:
    stamp: [clock]
    remember: [context.flow]
```

Pedir algo que no está concedido no falla en el momento del mensaje. Hace fallar el despliegue: el flujo se rechaza con un 422 antes de escribir nada, los flujos en marcha ni se enteran, y el mensaje nombra el nodo y la línea que hay que añadir:

```
the deploy was refused because of its plugins: node stamp (n1) is a wasm-stamp: the plugin asks for host access the operator has not granted: clock. Add it to plugins.grants.stamp, or remove the capability from the plugin
```

Una reversión es un despliegue, así que una reversión a flujos que usan un plugin cuya concesión se ha retirado desde entonces se rechaza del mismo modo. Un plugin que está instalado pero no concedido sigue apareciendo en la paleta, con sus capacidades en su ayuda.

### Las funciones de contexto

Un invitado que declara una capacidad de contexto puede importar estas del módulo `hotloop_flow`. Los valores cruzan como JSON.

```
context_get(scope i32, keyPtr i32, keyLen i32, outPtr i32, outCap i32) -> i32
context_set(scope i32, keyPtr i32, keyLen i32, valPtr i32, valLen i32) -> i32
```

El ámbito es `0` para el flujo y `1` para el global. `context_get` devuelve la longitud del JSON y lo escribe solo si cabe en `outCap`, de modo que un invitado que recibe más de lo que ofreció reintenta con un búfer mayor. Una clave que no existe es `-1`, y `-2` significa denegado: no se concedió el ámbito, la clave o el JSON eran incorrectos, o el almacén dijo que no. Un invitado no puede leer un ámbito que no se le concedió probando.

## Firma, y confiar en un editor

Un plugin se firma con una clave ed25519. La firma cubre los dos archivos, no solo el módulo, porque el descriptor es donde un plugin pide acceso. Si solo se firma el módulo, cualquiera con acceso de escritura al directorio podría añadir una capacidad a un plugin firmado. El mensaje firmado es:

```
hotloop-flow-plugin-v1
module sha256 <hex of plugin.wasm>
descriptor sha256 <hex of plugin.json>
```

No se consulta nada cuando se carga un plugin: ni red, ni registro de transparencia, ni cadena de certificados. La comprobación es la firma, la clave que nombra y su lista de claves. Es una decisión deliberada para una caja en una red de planta que puede no tener salida. También significa que no hay servicio de revocación, así que revocar una clave es quitarla de `plugins.trustedKeys` y reiniciar.

### Como editor

```bash
hotloop-flow plugin keygen -out acme            # acme.key (private) and acme.pub
hotloop-flow plugin sign -key acme.key plugins/moving-average
hotloop-flow plugin verify -trust acme.pub plugins/moving-average
```

`keygen` escribe una clave privada PKCS #8 y una clave pública PKIX como PEM, los mismos archivos que generan `openssl genpkey -algorithm ed25519` y `openssl pkey -pubout`, y se niega a sobrescribir cualquiera de los dos. Imprime el id de la clave y la forma de una línea de la clave pública. Mantenga la clave privada fuera de git. Ninguna clave se sube.

### Como operador

En el chart de Helm son `plugins.trustedKeys`, `plugins.grants` y `plugins.volume`, en [Desplegar Flow](/es/flow/deploying/).

Usted confía en un editor poniendo su clave pública en `plugins.trustedKeys`, o en `HOTLOOP_FLOW_PLUGIN_TRUSTED_KEYS`, separadas por comas. Cada entrada es la línea `ed25519:<base64>`, una clave pública PEM o la ruta de un archivo que contiene una, que es como entra un Secret o un ConfigMap montado:

```yaml
plugins:
  trustedKeys:
    - ed25519:/iYdLE7lAGb2YFglPYjhoPItgdiQ9xEPVMqQNrD8Hqg=
    - /etc/hotloop-flow/keys/acme.pub
```

Sin claves de confianza, todos los plugins se rechazan. Una clave que no se puede analizar es un error de arranque. La confianza es por clave y no por plugin, así que confiar en un editor es confiar en todo lo que firma. Lo que un plugin puede usar después es una decisión aparte, tomada en `plugins.grants` por nombre.

## Cuando rechaza

Un plugin que no carga se registra al arrancar, aparece con su motivo en `GET /plugins`, no está en la paleta y se nombra en el rechazo cuando se despliega un flujo que lo usa. Un plugin defectuoso nunca impide que el resto de Flow arranque. `hotloop-flow plugin verify` ejecuta las mismas comprobaciones, así que un editor ve lo que vería un operador.

| Qué falla | Qué dice |
|---|---|
| Sin `plugin.sig` | `unsigned: plugin.sig is missing` |
| Módulo o descriptor editado tras la firma | `signature does not match: plugin.wasm or plugin.json was changed after it was signed with key <id>, or the signature is damaged` |
| Firmado con una clave en la que no confía | `signing key is not trusted: it was signed with key <id>, which is not in plugins.trustedKeys` |
| Ninguna clave configurada | `signing key is not trusted: no trusted keys are configured, so no plugin can load (plugins.trustedKeys)` |
| Archivo de firma dañado | `signature file is malformed: ...` |
| Descriptor con un campo desconocido, un tipo incorrecto o una capacidad incorrecta | `plugin.json is not valid: ...` nombrando el campo |
| El módulo importa algo que el host no proporciona | `the module is not usable: guest imports env.reach_out, which the host does not provide` |
| El módulo usa las funciones de contexto sin declarar una capacidad | `the module is not usable: guest imports hotloop_flow.context_set but was not given a context capability` |
| El nombre del directorio y `name` difieren | `the directory is called "x" and plugin.json says the plugin is "y"; they have to match` |

La firma se comprueba antes de analizar el descriptor y antes de compilar el módulo, así que el código sin firmar nunca se compila.

## Los dos ejemplos

* `moving-average` es Rust. Promedia una lectura sobre los últimos N mensajes y guarda su ventana en su propia memoria. No pide nada. `cargo build --locked --release --target wasm32-wasip1`, y luego `plugin.wasm` es el `moving_average.wasm` que se construye.
* `stamp` es TinyGo. Añade la hora a cada mensaje, así que pide `clock`. Se construye con el propio contenedor de TinyGo, usando Podman: `podman run --rm -v "$PWD/stamp:/src:ro" -v "$PWD/out:/out" -w /src docker.io/tinygo/tinygo:0.43.0 tinygo build -target=wasip1 -buildmode=c-shared -o /out/plugin.wasm .`

Flow es una casa Go. El host, la firma, la CLI y cada prueba están en Go, y el ejemplo de TinyGo es Go. El ejemplo de Rust está porque un formato de plugin que solo funcionara con el lenguaje en que está escrito el host no sería un formato de plugin, y porque Rust es en lo que es más probable que ya esté escrita una biblioteca de procesamiento de señales. Esa es la razón escrita del único ejemplo que no es Go. Los crates con que se construye son `serde` y `serde_json`, ambos con licencia permisiva, compilados dentro del módulo de ejemplo y no dentro de Flow.

## Lo que no está probado

* Los plugins se han ejecutado en hardware real (2026-11-17).
* En Kubernetes los archivos del plugin llegan mediante `plugins.volume`, cualquier origen de volumen. Un ConfigMap solo contiene un plugin hasta su límite de 1 MiB, así que un plugin del tamaño del ejemplo de TinyGo requiere un claim.
* No hay capacidad de red. Un plugin no puede hacer una petición, y es a propósito hasta que alguien tenga un motivo con una lista de hosts permitidos que lo acompañe.
* Las pruebas de Flow ejecutan plugins de verdad, en el mismo proceso hijo que cualquier otro nodo. Las capacidades de un plugin son las mismas que le daría el despliegue.
* `hotloop-flow test` ejecutado a mano desde una shell no carga plugins. La compuerta de despliegue y las pruebas del editor sí.
