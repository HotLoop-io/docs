---
title: "FlowLab: bancos de prueba"
description: "Ejecute una pestaña como diagrama en bancos de prueba y registradores de datos: nodos con bucles, cable de error, puerto serie, panel y depurador."
---

FlowLab es la parte de Flow para bancos de prueba y registradores de datos, y su unidad es el diagrama: la otra forma en que Flow ejecuta una pestaña. En un flujo, un mensaje pasa por un nodo y cualquier entrada lo despierta. En un diagrama, cada nodo se ejecuta una vez por ejecución, cuando todas las entradas que tienen un cable contienen un valor. Dos nodos sin cable entre ellos se ejecutan a la vez. Así se construye un banco de pruebas o un registrador de datos: leer un equipo, interpretar la lectura, decidir si es estable, mostrarla y guardarla.

Los flujos no se ven afectados por nada de esto. Una pestaña que lleva `ew_diagram` queda fuera del runtime de mensajes, y todas las demás pestañas se ejecutan exactamente como antes.

Lo que significa para usted: dibuja la lógica una vez, pulsa Ejecutar y ve cómo se mueven los valores por los cables. Cualquiera con la dirección del panel puede ver la misma ejecución en un teléfono.

## El archivo

Un diagrama es una pestaña con un objeto `ew_diagram`. Sus nodos son entradas normales del archivo de flujo. `wires` nombra el nodo al que va un cable, como siempre, y `ew_in` en el nodo de origen indica a qué entrada del destino llega cada cable, con la misma forma:

```json
{ "id": "a", "type": "dia-const", "z": "d", "value": "1", "x": 100, "y": 80,
  "ew_in": [["a"], []], "wires": [["sum"], []] }
```

El archivo se carga y se guarda byte por byte con estas claves dentro. Ajustes de la pestaña:

| Clave | Qué hace |
|---|---|
| `autostart` | `true` inicia la ejecución cuando arranca Flow y después de cada despliegue, sin ningún navegador abierto. |
| `role` | `"body"` para un diagrama que ejecuta un bucle. Un cuerpo no se ejecuta por sí solo. |

Cada nodo tiene además una entrada opcional `after` y una salida `done`. Conecte el `done` de un nodo con el `after` de otro y el segundo espera al primero, sin nada entre ellos. El orden es un cable que se ve y se puede comparar con diff.

## Ejecución

Un diagrama se ejecuta a partir de lo desplegado. En el editor, abra una pestaña de diagrama y pulse Ejecutar. La barra sobre el lienzo tiene:

- **Resaltar la ejecución**: cada nodo espera un momento antes de ejecutarse, para que pueda seguirlo, y se ilumina el cable que cruzó un valor. Se desactiva solo a los diez minutos.
- **Pausar, Reanudar, Entrar, Saltar, Salir**: el paso a paso va nodo por nodo. Saltar ejecuta todo el cuerpo de un bucle. Entrar se detiene en el primer nodo de ese cuerpo.
- **Interrumpir en la selección**: un punto de interrupción en el nodo seleccionado. Pulse dos veces un cable para sondearlo, lo que guarda sus últimos 100 valores, o para interrumpir cuando se le ponga un valor. Una sonda nunca cambia una ejecución.
- **Abrir panel**: la página del operador.

Pase el cursor sobre cualquier cable tras una ejecución para ver el último valor que llevó. El botón de problemas enumera todos los motivos por los que un diagrama no puede ejecutarse, cada uno con el nodo y la entrada.

| Llamada | Qué hace |
|---|---|
| `GET /diagrams`, `GET /diagrams/{id}` | Lo que está desplegado, el panel y el último valor de cada cable. |
| `GET /diagrams/{id}/trace` | Lo que hizo la última ejecución, en orden: cada nodo que empezó o terminó y cada valor que cruzó un cable, con los milisegundos desde el inicio de la ejecución. Un diagrama que no se ha ejecutado desde que se desplegó responde 404. |
| `POST /diagrams/{id}/run`, `/stop`, `/debug` | Requiere `diagram.run`. Cada una queda en el registro de auditoría con quién la hizo. |
| `POST /diagrams/{id}/sub` | Envíe `{flows, nodes, name}` y recibirá el archivo de flujo con esos nodos convertidos en un subdiagrama. Solo lee y calcula; no se guarda ni se despliega nada. |
| `PUT /diagrams/{id}/controls/{node}` | Fija un control. Se comprueba según su tipo, rango y opciones. |
| `PUT /diagrams/{id}/breakpoints`, `/probes` | Las claves son un id de nodo, `wire:<wire key>` o `diagram:<tab>`. |

Los eventos de una ejecución salen por el mismo socket que los del editor, como `diagram/<id>/node`, `token`, `run`, `paused` y `values`.

## Nodos

| Nodo | Qué hace |
|---|---|
| `dia-const`, `dia-math`, `dia-compare`, `dia-logic` | Valores y aritmética. Las operaciones matemáticas se aplican elemento por elemento en las matrices. |
| `dia-wait` | Espera y después pasa su entrada. |
| `dia-bundle`, `dia-field`, `dia-array` | Registros y matrices. |
| `dia-while`, `dia-for` | Bucles. El cuerpo es un diagrama propio, nombrado por su pestaña. Los valores arrastrados parten de un cable o de Start values y salen como estaban en la última pasada. Un bucle for toma un número o una matriz. Un bucle while se ejecuta al menos una vez. |
| `dia-case` | Estructura de casos. El valor en `selector` elige un cuerpo para ejecutar, y solo se ejecuta ese cuerpo. Un booleano elige `true` o `false`, un número elige el caso de ese valor sea cual sea su escritura, y una cadena o un enum elige el caso de ese nombre. Los casos son un objeto JSON de nombre de caso a diagrama, y un valor que ningún caso nombra ejecuta el predeterminado. Sin predeterminado, el nodo pone un error en su cable de error, y el despliegue avisa de que no hay predeterminado (un booleano con los dos casos está exento). Cada cuerpo debe devolver cada resultado con el mismo nombre, y un cuerpo que no lo hace es un problema al desplegar. `case` de salida indica qué caso se ejecutó. |
| `dia-body-in`, `dia-body-out` | Los dos extremos de un cuerpo. `iter` es el número de pasada. `stop` termina un bucle while. El nombre de un valor arrastrado lo envía a la pasada siguiente. |
| `dia-serial-open`, `dia-serial-read`, `dia-serial-write` | Un puerto serie. Las lecturas terminan en un terminador o con un número de bytes. |
| `dia-instr-open`, `dia-instr-query`, `dia-scpi-parse` | Un instrumento de prueba, por dirección. Vea Instrumentos más abajo. |
| `dia-parse-reading`, `dia-stable` | Extraen un número y una unidad de una línea, y dicen si las últimas lecturas coinciden. |
| `dia-log-text` | Añade un registro como una fila de un archivo de texto, con una columna de hora. |
| `dia-daq-read` | Lee muestras de una tarea de adquisición de datos en hardware de NI, a través del servidor gRPC Device Server de NI. Vea Adquisición de datos más abajo. |
| `dia-mqtt-out` | Publica su valor a través de un servidor MQTT que configura el archivo de flujo, la misma conexión que usan los nodos MQTT. Márquelo como durable y un mensaje que el broker no recibe se escribe en disco y se envía, en orden, cuando el broker vuelve, incluso tras un reinicio. |
| `dia-postgres-out` | Escribe un registro como una fila de una tabla de PostgreSQL o TimescaleDB, a través del servidor que configura el archivo de flujo, la misma conexión que usa el nodo postgres. Márquelo como durable y una fila que la base de datos no recibe se guarda en disco y se escribe, en orden, cuando vuelve. Vea Una base de datos que se cae más abajo. |
| `dia-log-tdms` | Añade un registro a un archivo TDMS, un canal por campo. Vea más abajo. |
| `dia-control`, `dia-indicator`, `dia-chart` | El panel. |
| `dia-stats` | La media, el valor RMS, el mínimo, el máximo y la desviación estándar de una matriz. La desviación estándar divide entre n menos uno, así que necesita dos lecturas. |
| `dia-integral` | El área bajo una matriz por la regla del trapecio, como un solo número o como el área acumulada en cada muestra. |
| `dia-derivative` | La pendiente en cada muestra de una matriz. |
| `dia-filter` | Un filtro Butterworth paso bajo, paso alto, paso banda o rechazo de banda, de orden 1 a 10, con una frecuencia de corte en hercios. |

### Filtros

El nodo de filtro es un filtro Butterworth: plano donde deja pasar, sin rizado, y 3 dB por debajo en la frecuencia de corte. Se diseña a partir del filtro analógico con la transformada bilineal y la frecuencia de corte precorregida, de modo que el punto de 3 dB cae en la frecuencia que usted escribió, y se ejecuta como una cadena de secciones de segundo orden para que un orden alto siga siendo preciso. Un paso banda o un rechazo de banda de orden n tiene 2n polos. La frecuencia de corte debe ser mayor que cero y menor que la mitad de la frecuencia de muestreo, y un diseño que no se puede construir aparece en los problemas antes de la ejecución. La frecuencia de muestreo es una propiedad, o una entrada que prevalece sobre ella. El filtro conserva su memoria de una llamada a otra dentro de una ejecución, de modo que una matriz cortada en trozos por un bucle sale como si se hubiera filtrado entera, y cada ejecución nueva parte del reposo.

Lo que no puede hacer: no es un filtro de fase lineal, así que retrasa cada frecuencia una cantidad distinta, y no tiene modo de fase cero que filtre hacia delante y hacia atrás. Si la sincronía entre dos señales debe mantenerse, o la forma de una onda debe sobrevivir, ese es el filtro equivocado. La integral y la derivada toman el tiempo entre muestras de una entrada `dt` en segundos, una entrada `rate` en hercios o la propiedad Samples per second.

### Registro en TDMS

`dia-log-tdms` escribe las mediciones de un banco de pruebas en un archivo TDMS, el formato que abren las herramientas de adquisición y análisis de datos. Conecte un registro a `row`. Cada campo del registro es un canal de un mismo grupo, así que un registro con `pressure`, `ok` y `operator` crea tres canales. Un número se guarda como flotante de 64 bits, verdadero o falso como booleano, y cualquier otra cosa como texto. Un campo que contiene una lista de números añade la lista entera, que es como entra un bloque de muestras. Ajustes:

| Ajuste | Significado |
|---|---|
| `path` | El archivo. Si el archivo ya existe se añade al final, de modo que una ejecución tras otra construye un solo archivo. |
| `group` | El grupo en el que van los canales. |
| `columns` | Los campos que se registran, en orden. Vacío registra todos los campos, por nombre. |
| `properties` | Un objeto JSON de propiedades del archivo, como `{"title": "bench 4", "station": 4}`, que se escribe cuando empieza la ejecución. |
| `sync` | Activado por defecto: cada fila llega al disco antes de que el nodo termine. |

Cada fila es un segmento, escrito de una sola vez. Si se va la corriente a mitad de una, el archivo muestra dónde se cortó, un lector devuelve todas las filas anteriores, y la siguiente ejecución repara el final del archivo y continúa. El tipo de un campo lo fija la primera fila de una ejecución. Una fila posterior que no encaja, como texto en una columna numérica, va al cable de error como entrada incorrecta y el archivo no se toca. Un número ausente se escribe como no-es-un-número.

Para abrir el archivo, use cualquier lector TDMS. La biblioteca admite propiedades de canal como `unit_string` y las propiedades de forma de onda `wf_start_time`, `wf_increment` y `wf_samples`; el nodo todavía no las establece.

Lo que acepta el lector: segmentos little endian y big endian, datos intercalados y contiguos, metadatos omitidos en un segmento cuando no han cambiado, una nueva lista de objetos, enteros de 8, 16, 32 y 64 bits, flotantes de 32 y 64 bits, booleanos, texto y marcas de tiempo. Lo que rechaza, por su nombre y sin leer el archivo a medias: datos sin procesar escritos por un controlador de adquisición de datos, datos escalados o comprimidos, flotantes de precisión extendida, números de punto fijo y complejos. Lo que escribe el escritor: little endian, datos contiguos y esos mismos tipos. No escribe big endian.

### El cable de error

Los nodos que hablan con el mundo exterior tienen `err` de entrada y `err` de salida. Un error es un registro: una marca, un código numérico, el texto de origen y el nodo del que viene. Un nodo que recibe un error no hace ningún trabajo y lo pasa, de modo que un fallo al principio de una cadena omite todo lo que sigue y aparece una sola vez al final. Conecte un error a la salida de cuerpo `err` de un bucle y el bucle se detiene con él, con el error en la salida de error del bucle. Un indicador de error en el panel se pone rojo ante un fallo y se borra cuando llega el siguiente valor sin error.

### Un destino que se cae

Un `dia-mqtt-out` durable envía directamente al broker mientras este responde. Cuando no responde, el mensaje se confirma en el almacén durable de Flow antes de que el nodo termine, y un bombeador entrega la cola, primero el más antiguo, cuando vuelve el enlace. Lo que se envía mientras otros esperan va detrás de ellos, así que nada adelanta a nada. La entrega desde la cola es al menos una vez: un mensaje cuyo envío agotó el tiempo porque el cliente no había notado la caída del enlace puede entregarse igualmente cuando el cliente se reconecta, así que puede llegar dos veces, una por cada envío agotado. La cola vive en el mismo almacén y bajo la misma cuota de disco que un cable durable, y se vacía tras un reinicio sin ejecución y sin navegador. Sin durable, un mensaje que el broker no recibe es un error en el cable de error.

### Una base de datos que se cae

`dia-postgres-out` escribe cada registro que recibe como una fila, en la tabla que usted nombra, a través de un servidor `hotloop-flow-postgres`. Los campos de un registro van a las columnas del mismo nombre, así que un registro con `n` y `sensor` rellena las columnas `n` y `sensor`. Enumere las columnas, separadas por comas, para escribir solo algunas o fijar su orden; deje la lista vacía y el nodo usa los campos del registro. El nodo se ejecuta una vez por cada pasada de un bucle, así que un bucle escribe una fila por pasada. Una tabla o una columna que no es un nombre simple es un problema al desplegar, nunca una sentencia en mitad de una ejecución. Un número entero entra igual en una columna integer, float o numeric, y un registro o una matriz entra tal cual, que es lo que toma una columna json o jsonb.

Ponga nombre a una **columna de hora** y cada fila recibe la hora a la que llegó al nodo. Es la hora en que se hizo la lectura, no la hora en que se escribió: una fila que esperó cinco minutos en disco conserva el minuto en que se hizo.

Sin **Conservar lo que la base de datos se pierde**, una fila que la base de datos no acepta es un error en el cable de error del nodo y se pierde. Con esa opción, la fila entra directamente mientras la base de datos responde. Cuando la base de datos no responde, la fila se confirma en el almacén durable de Flow antes de que el nodo termine, y la salida `sent` del nodo dice `false`. Las filas esperan en disco, sobreviven a un reinicio y se escriben en orden cuando la base de datos vuelve, sin que nada de lo que entra después las adelante. Una acumulación se escribe con muchas filas por sentencia, hasta 256, así que la que se formó mientras la base de datos estaba ausente se pone al día en segundos y no a la velocidad de un viaje de ida y vuelta por fila. La prueba deja 30.000 filas esperando en disco, el tamaño de cinco minutos a 100 por segundo, y todas se escriben en orden a los pocos segundos de volver la base de datos.

La entrega desde disco es al menos una vez. Una fila cuyo insert se envió cuando cayó el enlace puede haberse confirmado con la respuesta perdida, y se envía de nuevo, así que puede escribirse dos veces, como mucho un lote. Si eso importa, dé a la tabla una clave única y elija **Omitir la fila** en En caso de conflicto: la segunda la descarta entonces la base de datos.

Una fila que la base de datos rechaza por lo que contiene, como un valor demasiado grande para su columna o una clave que ya existe con En caso de conflicto en Generar un error, se rechazaría siempre. Se descarta con un evento de auditoría, `diagram.row_rejected`, que lleva la fila, y se escriben las filas que van detrás. Sin eso, una sola fila mala detendría el registro. Una base de datos caída, una tabla que todavía no existe y una contraseña incorrecta no son eso: esas filas esperan.

### Instrumentos

`dia-instr-open` toma una dirección: `10.0.0.5:5025` para un instrumento de red en un socket sin procesar, `serial:///dev/ttyUSB0?baud=19200&data=8&parity=E&stop=1` para uno serie, o un simple `/dev/ttyUSB0` o `COM3` para 9600 8N1. La ejecución cierra la sesión cuando termina. Si el enlace se cae, la siguiente consulta lo abre de nuevo y la caída se cuenta en la sesión.

`dia-instr-query` escribe un comando y el terminador, y después lee la respuesta. Elija texto (una línea, en `reply`), none (una escritura simple) o block, que lee un bloque binario `#41024...` y entrega las muestras en `samples` como una matriz, como int8, uint8, int16, uint16, int32, float32 o float64, big o little endian. Un bloque indefinido `#0` termina en el primer fin de línea. Una respuesta que no llega a tiempo es un tiempo de espera agotado en el cable de error con la dirección.

`dia-scpi-parse` lee una respuesta de texto como una lista de números, un solo número, una identidad (`*IDN?` en fabricante, modelo, número de serie y firmware) o un byte de estado (`*STB?` o `*ESR?`) en los nombres de sus bits activos.

### Serie

Un puerto que desaparece, como un cable desconectado o un adaptador desenchufado, es un fallo en el cable de error de la lectura. La siguiente lectura intenta abrirlo de nuevo, una vez por segundo, y cuenta la pérdida y el regreso. Un puerto tiene control de flujo: ninguno, por hardware (RTS y CTS) o por software (XON y XOFF), en Linux, fijado en el propio terminal; un pseudoterminal muestra que el ajuste llegó, y lo que hacen las líneas en un adaptador real no se ha demostrado.

### Adquisición de datos

`dia-daq-read` lee una tarea de hardware de NI, como un chasis CompactDAQ, a través del propio servidor abierto gRPC Device Server de NI. Flow habla con ese servidor por la red, así que el hardware puede estar en una máquina distinta de Flow, y Flow no necesita ningún controlador de NI ni biblioteca de proveedor propia. Sigue siendo un único binario estático.

**En la máquina a la que está conectado el hardware**, instale el controlador DAQmx de NI y el gRPC Device Server de NI (https://github.com/ni/grpc-device, con licencia MIT). El servidor escucha solo en esa máquina (`localhost`, puerto 31763) hasta que su archivo de configuración diga otra cosa. Para llegar a él desde Flow en otra máquina, ponga `address` en su `server_config.json` a `[::]` o a la interfaz que quiera, y active TLS configurando `server_cert`, `server_key` y, para TLS mutuo, `root_cert`, con los archivos en la carpeta `certs` junto al archivo de configuración. El README de NI da los detalles de la versión que use. No deje abierto en una red de planta el puerto sin protección que el servidor trae por defecto: cualquiera que pueda llegar a él puede manejar el hardware.

**En el nodo**, configure:

* `address` con el `host:port` del servidor.
* `tls` en `off` (solo para un servidor en la misma máquina), `on` (Flow comprueba el certificado del servidor con `caFile`, o con las autoridades del sistema si está vacío) o `mutual` (Flow presenta además `certFile` y `keyFile`, que el servidor comprueba con su `root_cert`). `serverName` es el nombre que se busca en el certificado del servidor cuando no es el host de `address`.
* `device` y `channels` para nombrar el hardware, como `cDAQ1Mod1` y `ai0:3`, o una lista como `ai0, ai2`. `kind` es `voltage`, `current` o `thermocouple`, con `min` y `max` para el rango que espera y `terminal` para el cableado. Los termopares toman un `tcType` y una `unit` y usan la compensación de unión fría del propio módulo.
* `mode`, `rate` y `samples`. El modo finito toma una adquisición de `samples` por canal a `rate` en cada llamada, iniciándola de nuevo cada vez. El modo continuo inicia la tarea en la primera llamada y cada llamada lee las siguientes `samples`, de modo que un nodo en el cuerpo de un bucle lee un flujo bloque a bloque. `trigger` inicia la tarea con un flanco digital en un terminal como `/cDAQ1/PFI0`.

`y` son las muestras como una matriz para un canal, o una matriz de matrices, una por canal en el orden en que los nombró. `dt` son los segundos entre muestras, uno entre la frecuencia, de modo que la duración de un bloque en segundos es su número de muestras por `dt`: 1.000 muestras a 1.000 muestras por segundo cubren 1,000 s. El reloj propio del dispositivo marca el tiempo de las muestras, como siempre. Flow solo mueve los datos. Un rechazo del servidor o del controlador sale por `err` con el código y el texto del propio controlador, y un servidor que no responde en `callTimeoutSec` es un tiempo de espera agotado. La tarea vive durante la ejecución y se borra en el servidor cuando esta termina, de modo que el hardware queda libre de nuevo.

Lo que está hecho: entrada analógica de tensión, entrada analógica de corriente y temperatura de termopar, finita o continua, con reloj de muestreo y un disparador digital de inicio opcional. Lo que no: las entradas y salidas digitales y los contadores usan otras llamadas de lectura y no están construidos, como tampoco las escrituras, otros tipos de disparador ni el escalado más allá de lo que hace el módulo.

El nodo se ha ejecutado contra un servidor de prueba que habla las mismas llamadas y responde con una onda senoidal, y en hardware real (2026-11-17).

## El panel

`/panel/<diagram id>` en un runtime abre una página con los controles, indicadores y gráficos del diagrama, con la sesión iniciada igual que en el editor. Está hecha para usarse con el pulgar: nada en ella es más pequeño que un dedo. Un gráfico conserva sus últimos 1.024 puntos salvo que usted lo cambie, e indica cuántos ha descartado. Una gráfica reemplaza sus datos con cada matriz. Un gráfico XY representa x frente a y y también guarda historial. Un gráfico de intensidad toma una cuadrícula, una matriz de filas de números todas de la misma longitud (hasta 512 por 512), y dibuja cada valor como un color del menor al mayor que contiene, reemplazando la imagen con cada cuadrícula; una matriz plana o una cuadrícula irregular es un error en el cable de error del nodo.

Varias personas pueden ver una misma ejecución. Fijar un control desde el navegador requiere `diagram.run`, se comprueba en el servidor y se escribe en el registro de auditoría.

## Controles

Un `dia-control` tiene un **tipo** (lo que guarda) y un **aspecto** (cómo lo dibuja el panel). El servidor comprueba cada valor según el tipo, sea cual sea el aspecto, así que un script que llama a `PUT /diagrams/{id}/controls/{node}` queda sujeto a las mismas reglas que un dedo. Lo que un operador fija aparece en el panel en cuanto se despliega el diagrama, antes de la primera ejecución, y el nodo de control entrega al diagrama ese valor cada vez que se ejecuta.

| Tipo | Aspectos | Qué lee el diagrama |
|---|---|---|
| `number` | `entry` (escrito), `spin` (escrito, con un botón de menos y uno de más que avanzan según `step` y se detienen en el rango), `slider`, `knob` | un número, limitado a `min` y `max` cuando están fijados |
| `bool` | `switch`, `button` (una pulsación lo pone a true, y `latch` lo devuelve cuando el diagrama lo lee), `led` (un LED que se pulsa) | verdadero o falso |
| `string` | un cuadro de texto | texto |
| `enum` | una lista desplegable de `options` | una de las opciones |
| `array` | una lista a la que el operador añade y quita elementos | una lista de números, interruptores o texto, según `elem`; `min` y `max` limitan cada elemento numérico, y `maxlen` limita la longitud |
| `record` | una entrada por campo | un objeto con exactamente los `fields` (`rate:number, on:bool, note:string`), con todos los campos siempre presentes |

Un slider y un knob necesitan un valor mínimo y uno máximo. Un knob sin ambos es una advertencia al desplegar y se dibuja como una entrada escrita hasta que los tiene (un slider ya hacía lo mismo). El knob es un dial que recorre 270 grados: arrástrelo con un ratón o un dedo, púlselo para ponerlo ahí, o use las teclas de flecha (un `step`), Re Pág y Av Pág (diez pasos), Inicio y Fin. Escribe cuando lo suelta. El valor inicial de una matriz es JSON (`[1, 2, 3]`) o una lista simple separada por comas (`1, 2, 3`), y el valor inicial de un registro es un objeto JSON (`{"rate": 3}`); un campo que se omite empieza vacío. Un registro sin campos, un nombre de campo desconocido o un valor inicial que no encaja es un problema al desplegar.

Cada botón, entrada, interruptor y dial del panel mide al menos 44 píxeles en ambas direcciones, y la página no se desplaza lateralmente en un teléfono de 390 píxeles.

Un control se escribe cuando se cambia, y el diagrama lo lee cuando se ejecuta el nodo de control; no hay ningún control que inicie una ejecución o dispare un nodo por sí solo cuando cambia. Eso es la estructura de eventos, y no está construida.

## Qué no es

Un diagrama se ejecuta en un proceso de Go sobre un sistema operativo de propósito general. La recolección de basura y el planificador pueden retrasar un nodo unos milisegundos, así que un nodo no puede prometer un plazo. El trabajo que tiene que cumplir uno pertenece a un PLC o a un runtime construido para ello. La temporización de las muestras de un dispositivo de adquisición de datos no se ve afectada por nada de esto: la marca el reloj del propio dispositivo, y Flow solo mueve los datos.

## Pruebas de un diagrama

Un archivo de pruebas de flujo puede contener una prueba de un diagrama junto a las pruebas de mensajes. Fija los controles del diagrama, lo ejecuta una vez con el motor de diagramas real y dice qué contienen sus indicadores:

```yaml
tests:
  - name: weighs and flags a heavy load
    diagram:
      name: Scale logger          # the diagram's name or id
      controls: {Limit: 10}       # by label or id, checked like an operator's entry
      expect:
        Weight: 12.5              # a number matches to within a millionth
        Heavy: true
        Reading: {min: 12, max: 13}
```

Un control que el diagrama no tiene, un valor que rechaza, un indicador que no lo es, un nombre que comparten dos elementos y un diagrama que no puede ejecutarse son errores con su motivo. Un diagrama con un nodo que llegaría fuera de la prueba (un puerto serie, un instrumento, un dispositivo de adquisición de datos, MQTT de salida, una escritura en HotLoop, un archivo de registro) se rechaza, porque una prueba de diagrama no tiene sustituto para ellos. Un dispositivo serie con guion, para probar un cable desconectado o una serie de tramas basura, no está construido.

## La lista de errores en CI/CD

`hotloop-flow test` y la barrera de despliegue ejecutan la comprobación del editor en cada diagrama del archivo de flujo. Un diagrama que no puede ejecutarse aparece como `--- DIAGRAM: <diagram>: <node> input <port>: <reason>` y hace fallar el archivo aunque pasen todas las pruebas; el informe JUnit lleva cada uno como un error de tipo `diagram`. Una advertencia, como una estructura de casos sin predeterminado, aparece en la lista y no hace fallar.

## Formas de onda

Una forma de onda es un bloque de muestras igualmente espaciadas que sabe cuándo empezó y cuánto distan entre sí, como un registro en el cable: `{"type": "waveform", "t0": "2026-11-14T12:00:00Z", "dt": 0.001, "y": [...], "attrs": {"unit_string": "V"}}`. `dia-wave` construye una a partir de una matriz (el paso desde `dt`, si no `rate`, si no su ajuste; el inicio desde `t0`, si no el momento en que se ejecuta) y `dia-wave-parts` desarma una, incluida la duración que abarca. Una forma de onda contiene como máximo `maxSamples` muestras (1.048.576 por defecto); el resto se corta y se cuenta en `dropped`. Los nodos de análisis aceptan una forma de onda donde toman una matriz y usan su paso. `dia-log-tdms` escribe una columna de forma de onda como un canal con `wf_start_time`, `wf_increment`, `wf_samples` y los atributos como propiedades del canal.

## Subdiagramas

`dia-sub` es un diagrama usado como nodo: sus entradas y salidas son el conector, cada entrada un `dia-body-in` de ese nombre en su cuerpo y cada salida un `dia-body-out`. Una entrada es obligatoria salvo que su nombre termine en `?` (opcional) o `~` (recomendada: se ejecuta sin ella y el despliegue avisa cuando no está conectada). Seleccione nodos y cree un subdiagrama con ellos (`POST /diagrams/{id}/sub`) y los nodos pasan a una nueva pestaña de cuerpo, un `dia-sub` ocupa su lugar, y el conector se deduce de los cables que cruzan el borde de la selección: una entrada por cada salida de origen que alimenta la selección, una salida por cada salida seleccionada que alimenta los nodos de fuera. Los cables de fuera se reconectan, de modo que una ejecución da las respuestas que daba antes.

## Tipos de registro compartidos

Un tipo de registro se nombra una sola vez, en los ajustes de una pestaña de diagrama, bajo `types`, y cada `dia-bundle` o `dia-field` que pone `shape` con su nombre se comprueba contra esa única definición:

```json
{"types": {"Reading": {"fields": {"pressure": "number", "ok": "boolean", "state": {"enum": ["idle", "run"]}}}}}
```

Un campo es `number`, `integer`, `boolean`, `string`, `timestamp`, `array`, `waveform`, `record:Name` (otro tipo compartido) o un enum. Si cambia el nombre de un campo en la definición, todo bundle que siga usando el nombre antiguo es un problema en el siguiente despliegue, en la misma lista de errores que una entrada sin conectar, con el nodo y el campo. Un bundle sujeta cada valor al tipo de su campo cuando se ejecuta, y el cable de error lleva el valor que no encaja. `Set.Schema` da el mismo tipo como JSON Schema, que es lo que comprueban los cables tipados.

## Rotación y retención

`dia-log-text` y `dia-log-tdms` pueden empezar un archivo nuevo cuando el activo llega a `rotateMB` megabytes o `rotateHours` horas, y conservar solo los `keep` archivos terminados más recientes. El archivo terminado toma el nombre del registro con la hora en que se cerró antes de la extensión (`bench.csv` pasa a ser `bench-20261114T120000Z.csv`) y el registro continúa en `bench.csv`, con una cabecera nueva, o con las propiedades del archivo escritas de nuevo en el caso de TDMS. La retención elimina solo los archivos que coinciden con ese patrón, nunca el registro activo y nunca un archivo que simplemente está a su lado. La antigüedad cuenta desde que una ejecución escribe por primera vez en el archivo. El registro de texto se abre en una hoja de cálculo y el registro TDMS es el formato binario para datos grandes.

## Editar una estructura de casos y elegir un diagrama

Los casos de una estructura de casos son filas con un nombre de caso y un selector de diagrama, con un segundo selector para el caso predeterminado, y la propiedad que nombra el diagrama que ejecuta un bucle o un subdiagrama también es un selector. Los selectores muestran los diagramas FlowLab del archivo de flujo y guardan el id de la pestaña; un nombre escrito a mano en un archivo de flujo antiguo se muestra como esa pestaña y se guarda como su id, que el runtime lee del mismo modo. Los valores guardados son el mismo JSON de antes (`cases` es un objeto de nombre de caso a diagrama), así que un archivo de flujo editado en el diálogo y uno editado a mano son el mismo archivo.

## Abrir un subdiagrama en su sitio

Un nodo de subdiagrama tiene una pequeña casilla en su esquina superior derecha. Púlsela, o seleccione el nodo y pulse **Abrir en su sitio** en la barra del diagrama, y el nodo se dibuja abierto donde estaba: un marco con el nombre del subdiagrama, su conector nombrado en los dos bordes (las entradas a la izquierda, las salidas a la derecha, con los puertos `after` y `done` y el cable de error como cualquier nodo), y dentro los nodos y cables de su cuerpo. Nada se abre en una segunda ventana y la pestaña en la que está no cambia. Los cables que llevaban al nodo llevan al conector del marco, y una línea discontinua tenue va de cada nombre del conector al nodo body in o body out de ese nombre en el cuerpo. La casilla de la barra de título del marco (o **Cerrar en su sitio**) lo cierra de nuevo.

Lo que se dibuja dentro del marco son los nodos del propio cuerpo, no una copia. Seleccione uno, arrástrelo, haga doble clic para ver sus propiedades, cambie su valor o elimínelo, y habrá editado el cuerpo, como un paso que se puede deshacer, y un despliegue lo guarda. Mover el marco por su barra de título mueve el nodo del subdiagrama, y el cuerpo va con él. Un cable une dos nodos de un mismo diagrama, así que un cable de un nodo de fuera a un nodo de dentro se rechaza con palabras; conecte con el conector del marco. El zoom, el desplazamiento, el ajuste y el marco de selección funcionan como en cualquier otro sitio.

Qué subdiagramas están abiertos es la forma en que usted mira el diagrama. No está en el archivo de flujo, no es un paso de deshacer y una recarga los cierra todos, así que abrir uno nunca cambia lo que envía un despliegue. Un subdiagrama dentro de uno abierto tiene su propia casilla y también se puede abrir, hasta tres niveles. Un cuerpo que ya está abierto en otro lugar no se abre por segunda vez, y un subdiagrama cuyo cuerpo conduce a un diagrama que ya está abierto se dibuja cerrado, de modo que un diagrama que se contiene a sí mismo no puede hacer entrar el editor en un bucle. Un cuerpo no nombrado por nada, o nombrado por un nombre que comparten dos diagramas, no tiene casilla, porque el runtime tampoco lo encuentra. Los bucles y las estructuras de casos también tienen cuerpos y todavía no se abren en su sitio.

## Crear un subdiagrama en el editor

Con nodos seleccionados en un diagrama, **Selección a subdiagrama** de la barra pide un nombre, llama a `POST /diagrams/{id}/sub` con el archivo de flujo que tiene el editor y carga la respuesta como una edición que se puede deshacer: los nodos pasan a una pestaña propia y un nodo de subdiagrama ocupa su lugar, con sus entradas y salidas deducidas de los cables que cruzan la selección. No se guarda nada hasta que se despliega.

## Repetir una ejecución

Resaltar la ejecución frena una ejecución mientras avanza. **Repetir la última ejecución**, en la parte inferior del lienzo, reproduce una ejecución que ya terminó, a partir de lo que registró, para que pueda seguirla después. Ilumina los cables y marca los nodos como lo hizo la ejecución real, un evento cada vez, a la velocidad que elija (Lenta, Normal, Rápida o Muy rápida), y cuando termina el lienzo muestra lo que dejó la ejecución. **Detener la repetición** la termina antes. No cambia nada en el runtime y no inicia nada: el botón está desactivado mientras hay una ejecución en marcha, y la repetición termina cuando va a otra pestaña.

Cada ejecución registra los inicios y finales de sus nodos y cada valor que cruzó un cable, hasta 20.000 eventos. Una ejecución más larga conserva sus primeros 20.000, lo dice al repetirla, y la repetición muestra ese comienzo, porque una repetición que empezara por la mitad no tendría de dónde partir. Los valores se guardan como las vistas previas cortas que muestran los cables, así que una matriz de miles de muestras es su longitud y sus primeros valores. La grabación es la de la última ejecución, y una nueva la reemplaza; no se guarda tras un reinicio. `GET /diagrams/{id}/trace` es la misma grabación para un script.

## Diseño ordenado

**Ordenar diseño**, en la barra de pestañas, coloca los nodos a la vista de modo que los datos se lean de izquierda a derecha y ningún cable pase por un nodo. La columna de un nodo es la cadena de cables más larga que llega a él. Un cable que salta columnas recibe un carril a través de ellas, los nodos de una columna se ordenan para deshacer los cruces, y después cada cable largo se comprueba a lo largo de la curva con que se dibuja frente a los nodos de las columnas que cruza, y un nodo que estorba se aparta. El bloque conserva su esquina superior izquierda, y todo es una sola edición que se puede deshacer. En un bucle de cableado, el cable que lo cierra se deja fuera del orden, de modo que corre hacia atrás en lugar de hacer que el diseño entre en un bucle.

## Nombres de cable

Un cable de un diagrama se nombra en su punto medio, con la salida de la que viene (`sum`, `result`, `iterations`), junto a su tipo cuando alguno de los extremos lo declara, y al pasar el cursor sigue mostrándose el último valor que llevó.

## Zoom

El lienzo hace zoom de 5 % a 400 % alrededor del puntero, y lee su zoom como `data-zoom` en el lienzo.

## Fijar un objeto del panel por nombre

`dia-panel-set` cambia una propiedad de un control o un indicador mientras el diagrama se ejecuta, por la etiqueta del objeto (o su id): `visible` y `enabled` toman true o false, `color` toma red, amber, green, blue, gray o default, `label` toma texto, y `min` y `max` toman un número para un control numérico. Un control desactivado rechaza lo que fija un operador, un objeto oculto no se dibuja y el panel que un operador tiene abierto lo sigue. Un nombre que no coincide con ningún objeto, o con más de uno, es un problema al desplegar cuando se escribe en el nodo y un error en el cable cuando llega por un cable, y una ejecución parte del panel tal como fue diseñado.

## Símbolos

Cada tipo de nodo de FlowLab se dibuja con un símbolo propio en el centro de su cuerpo (un más para las matemáticas, una sigma para las estadísticas, una senoide para una forma de onda, un enchufe para un puerto serie), junto a su etiqueta de texto. Son trazos simples dibujados en `web/src/lib/symbols.ts`, no una fuente de iconos ni el arte de nadie, y una prueba falla cuando un tipo de nodo de diagrama nombra un icono que no está dibujado.

## Escribir en equipos: la puerta de escritura

Un diagrama da órdenes a un equipo de una sola manera: `dia-hotloop-write`. Envía su valor a una etiqueta de HotLoop (`device/tag`, fijada en el nodo o recibida por un cable) a través de la puerta de escritura de HotLoop, que decide, en su propio orden, que las escrituras están activadas, que la etiqueta está armada y que el valor está en rango. Flow nunca escribe en una máquina por sí mismo. HotLoop registra cada intento, rechazado o no, con el motivo `flow:<diagram>/<node id>`, de modo que su registro de auditoría nombra el diagrama y el nodo. Un rechazo es un error en el cable de error del nodo con el motivo de la propia puerta (código 5006), y también lo es un HotLoop que no se puede alcanzar; en ambos casos la escritura no se hace, y el nodo se niega a desplegarse sin un HotLoop seleccionado. Los nodos serie e instrumento sin procesar hablan con instrumentos de banco (polímetros, fuentes, cargas), que no tienen etiqueta en HotLoop, así que tienen su propio interruptor (más abajo).

## El interruptor de escritura de instrumentos

Leer un instrumento no cambia nada y siempre está abierto. Escribirle sí puede: la salida de una fuente, la alta tensión de un hipot, la corriente de una carga. Por eso todo instrumento empieza con sus escrituras **desactivadas**, y una escritura de un diagrama se rechaza hasta que alguien con el permiso `instrument.write` activa las escrituras de ese instrumento, de uno en uno.

- **Qué cuenta como escritura.** `dia-serial-write` es siempre una escritura. `dia-instr-query` es una lectura cuando su comando es una consulta (cada sentencia SCPI termina en `?`, como `*IDN?` o `MEAS:VOLT?;MEAS:CURR?`) y una escritura en caso contrario (`OUTP ON`, `VOLT 5`, `*RST` o `VOLT 5;MEAS:VOLT?`). Un comando recibido por un cable se cuenta como uno que puede escribir.
- **Qué instrumento.** El instrumento es su dirección: `tcp://host:port` o `serial:///dev/ttyUSB0`, sin los ajustes serie, de modo que un instrumento abierto de dos maneras es un solo interruptor.
- **Un rechazo** es un error en el cable de error del nodo (código 5007) que dice que las escrituras a ese instrumento están desactivadas, y el instrumento nunca recibe el comando.
- **Activarlo.** `PUT /instruments/writes` con `{"instrument": "tcp://10.0.0.5:5025", "allowed": true, "note": "bench 2"}`, que requiere `instrument.write` (un administrador lo tiene) y se guarda en `instrument-writes.json` en el directorio de datos, de modo que un reinicio no cambia nada. `GET /instruments` enumera cada instrumento con un interruptor o con un diagrama desplegado que escribiría en él, con quién lo fijó y los diagramas y nodos implicados.
- **Auditoría.** Cada cambio del interruptor es `instrument.switch`, y cada escritura de un diagrama es `instrument.write` o, cuando se rechaza, `instrument.refused`, con el diagrama, el nodo, el instrumento y el comando.
- **El despliegue avisa.** Un nodo que escribiría en un instrumento es una nota en el diagrama (las **notas** de la barra, y la lista que imprime `hotloop-flow test`), con el instrumento y la indicación de que sus escrituras están desactivadas hasta que alguien las active. Los archivos de flujo que solo leen no cambian.

## Traer un VI de LabVIEW

Importe un `.vi` en el diálogo Importar del editor (o `import_vi` por MCP, o `POST /flows/import-vi`) y FlowLab lee lo que puede y enumera, antes de añadir nada, lo que no pudo. Lea docs/labview-import.md: dice exactamente qué pasa y qué no. La versión corta: el nombre del VI, su descripción, su versión, los nombres del panel frontal y los VI a los que llama pasan, como una nota en un flujo propio. Los cables y las primitivas del diagrama de bloques no pasan, así que el diagrama lo dibuja usted con esos nombres al lado.
