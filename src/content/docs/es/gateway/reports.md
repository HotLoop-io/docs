---
title: "Informes programados"
description: "Cifras del historian según un calendario, en CSV o HTML, guardadas y enviadas: solo cuentan las lecturas buenas y cada fila dice cuántas se descartaron."
---

Los informes programados, desde 4.14.0, ejecutan según un calendario informes definidos por el operador: consultan el historian, generan el resultado en CSV y HTML, lo guardan en un volumen y, opcionalmente, lo envían por correo. Es el equivalente del módulo Reporting de Ignition para la parte de ese módulo que una planta usa más a menudo, una tabla de números entregada a tiempo. Desactivados por defecto (`HOTLOOP_REPORTS_ENABLED`).

## Qué es y qué no es

- **Solo API.** En esta versión no hay pantalla para esto. Los informes se definen, ejecutan, listan y descargan mediante `/api/reports`. Una interfaz es un trabajo aparte.
- **Solo CSV y HTML.** Sin PDF. Producir un buen PDF en Go puro, sin ningún binario externo (la imagen de runtime no lleva ninguno, a propósito), implica elegir una biblioteca de PDF y un motor de maquetación, y eso es una decisión en sí misma. El archivo HTML es autocontenido y se imprime bien desde cualquier navegador, lo que cubre por ahora el "necesito un PDF".
- **Tablas de agregados, no maquetas libres.** Un informe es una lista de tags, una ventana, un tamaño de intervalo y un conjunto de agregaciones. No es un diseñador de páginas.
- **Una sola instancia de Gateway.** El planificador asume que es lo único que ejecuta informes contra esta base de datos. Con dos réplicas, cada una lanzaría todos los informes. Este chart ejecuta una réplica, y el volumen de informes es `ReadWriteOnce`.
- **No es una función de alarmas.** El correo de alarmas es otra función, las [notificaciones de alarma](/es/iot/notifications/). Los informes comparten con ella los ajustes del relé SMTP y nada más.

## Una definición de informe

Las definiciones son datos editados por el operador, guardados en la base de datos igual que los dispositivos, los tags, las definiciones de alarma y los miembros de la flota, y se gestionan mediante la API. Ejemplo:

```json
{
  "id": "line1-daily",
  "name": "Line 1 daily summary",
  "enabled": true,
  "tags": [
    {"deviceId": "press-01", "tagName": "Zone1_Temp"},
    {"deviceId": "press-01", "tagName": "Pressure"}
  ],
  "window": {"count": 1, "unit": "days", "end": "local_midnight"},
  "bucket": "hour",
  "aggregations": ["min", "max", "avg", "count"],
  "schedule": {"kind": "daily", "at": "03:00"},
  "format": "both",
  "recipients": ["ops@example.com"],
  "retain": 30
}
```

| Campo | Significado |
|---|---|
| `id` | De 1 a 64 caracteres entre letras, dígitos, punto, guion o guion bajo, empezando por una letra o un dígito. Da nombre al directorio del informe en el volumen, así que se valida como cualquier otro id de esta aplicación. |
| `name` | Se muestra en el título del HTML y en el asunto del correo. Sin caracteres de control. |
| `enabled` | Si el planificador lo ejecuta. Un informe desactivado aún puede ejecutarse a mano. |
| `tags` | De 1 a 50 pares de dispositivo y tag. Cada uno debe existir al guardar la definición y no puede ser un tag de texto. |
| `window` | El tramo de historial que cubre cada ejecución. Vea más abajo. |
| `bucket` | `window` (una fila por tag), `hour` o `day`. Por defecto `window`. |
| `aggregations` | Una o más de `min`, `max`, `avg`, `first`, `last` o `count`, cada una como máximo una vez. |
| `schedule` | Vea más abajo. |
| `format` | `csv`, `html` o `both`. Por defecto `csv`. |
| `recipients` | Opcional. Solo direcciones simples (`ops@example.com`, no `Ops <ops@example.com>`). Como máximo 20. |
| `retain` | Cuántas ejecuciones conservar. De 1 a 1000. Por defecto 30. |

`PUT` reemplaza la definición completa. Un cliente puede leer un informe, cambiar un campo y devolverlo tal cual: los campos de solo lectura que añade el servidor (`nextRunAt`, `lastRun`, `lastRunAt`, `createdAt` y `updatedAt`) se aceptan y se ignoran.

Una definición que produjera más de 1000 intervalos se rechaza al guardarla (por ejemplo, intervalos de una hora en más de unos 41 días).

## Ventanas

Una ventana es relativa al momento en que se ejecuta.

| Lo que quiere | `count` | `unit` | `end` |
|---|---|---|---|
| Las 24 horas anteriores | 24 | `hours` | `run_time` |
| El día natural anterior | 1 | `days` | `local_midnight` |
| Los 7 días completos anteriores | 7 | `days` | `local_midnight` |
| Una semana móvil | 7 | `days` | `run_time` |

- `end` es el momento en que empieza la ejecución o, para `local_midnight`, la medianoche local más reciente igual o anterior a él. Una ejecución a las 03:00 que termina a la medianoche local cubre días naturales completos.
- **Las horas son tiempo transcurrido. Los días son días naturales** en la zona horaria de la planta. Una ventana de un día que termina a la medianoche local es un día local entero, que dura 23 horas el día en que se adelantan los relojes y 25 el día en que se atrasan. "Las 24 horas anteriores" son siempre exactamente 24 horas.
- **Una ventana es semiabierta**: incluye su inicio y excluye su final. Una lectura marcada exactamente a medianoche pertenece al día que empieza ahí. Dos informes diarios consecutivos nunca cuentan ambos una lectura ni se la pierden ambos.
- Una ejecución manual y una de recuperación calculan la ventana según el momento en que se ejecutan.

## Intervalos

- `window`: una fila por tag sobre toda la ventana.
- `hour`: una fila por tag por hora de reloj local. Una ventana que no empieza en punto comienza con un intervalo parcial más corto, y una que no termina en punto acaba con uno. Las horas siguen en punto a través de un cambio de hora y en zonas cuyo desfase no es un número entero de horas.
- `day`: una fila por tag por día natural local.

Cada tag tiene una fila por cada intervalo, incluidos los intervalos sin nada dentro. El informe nunca omite la hora en que un sensor estuvo en silencio, porque un informe que callara esa fila se vería igual que uno de un sensor que no tuvo nada que decir. Cada fila indica el tramo exacto que cubre (`period_start` y `period_end`, con sus desfases UTC), de modo que un día de 23 horas se ve como tal.

## Agregaciones y la regla de calidad

Las agregaciones son `min`, `max`, `avg`, `first` (la lectura más antigua del periodo según su marca de tiempo), `last` (la más reciente) y `count`.

Los informes siguen la regla de calidad, la misma que sigue el gráfico de tendencias, de modo que un informe y una tendencia de la misma hora coinciden. También se descarta una lectura sin valor numérico (una lectura de texto). No hay interruptor para esto: un promedio que mezcla en silencio lecturas que el propio historian marcó como no fiables es peor que un informe que dice cuántas no utilizó.

Por eso cada fila lleva una columna `excluded`: cuántas lecturas de ese periodo se dejaron fuera. `count` es cuántas se usaron. El registro de ejecución y el correo llevan los totales.

**No se inventa nada.** Un tag sin ninguna lectura utilizable en un periodo no tiene mínimo, y el informe lo dice: las celdas están vacías en el CSV y muestran `no data` en el HTML. Nunca son cero. El cero es una lectura (una válvula cerrada, un caudal nulo) y se agrega como cualquier otro valor. `count` es la única columna que es un número cuando no hay datos, porque el cero es un recuento verdadero de nada.

## Programaciones y hora

Una programación es una de estas:

```json
{"kind": "interval", "every": "6h"}
{"kind": "daily",    "at": "03:00"}
{"kind": "weekly",   "weekday": "monday", "at": "06:30"}
```

- Un **intervalo** es tiempo transcurrido (al menos un minuto) e ignora el reloj de pared.
- Las horas **diarias y semanales** son horas de reloj de pared en la zona horaria de la planta, que es `HOTLOOP_TIMEZONE` (el `global.timezone` del chart). Debe ser un nombre de zona real, como `America/Chicago`. Un nombre inutilizable hace que el arranque se rechace, con informes activados o no, en lugar de recurrir en silencio a UTC, porque un informe pensado para las 03:00 locales que se lanza a las 03:00 UTC es un error que nadie ve hasta que las cifras están mal.

### Horario de verano

La siguiente ejecución se calcula construyendo una hora de reloj de pared en la ubicación de la planta con `time.Date`. Nunca se calcula sumando 24 horas a la ejecución anterior, lo que dispara una hora antes o una hora después de un cambio de hora al siguiente. Dos horas de reloj de pared son incómodas el día del cambio, y la regla para cada una está fijada en el código en vez de dejarla a `time.Date`, cuyo comportamiento en ambos casos está documentado como no especificado:

- **Una hora que no existe** (las 02:30 del día en que se adelanta el reloj, cuando salta de las 02:00 a las 03:00) se lanza en el primer instante tras el salto, las 03:00. Se ejecuta tarde como mucho el tamaño del salto y no se salta el día.
- **Una hora que ocurre dos veces** (las 01:30 del día en que se atrasa el reloj) se lanza una sola vez, en su primera aparición.

### last_run_at, la siguiente ejecución y la recuperación

`last_run_at` es el momento en que el planificador **inició** por última vez el informe, tanto si esa ejecución acabó bien como si falló. Una ejecución manual no lo mueve, así que ejecutar un informe a mano a las 02:00 no cancela la ejecución de esta noche a las 03:00.

La siguiente ejecución es la primera hora programada posterior a la más reciente entre la creación de la definición, su última edición y su `last_run_at`. Medir desde la última edición significa que mover un informe de las 03:00 a las 09:00 a las 10:00 espera a mañana en vez de lanzarse de inmediato por una hora que ya había pasado.

**Recuperación.** Si la siguiente ejecución tras `last_run_at` ya está en el pasado cuando arranca el Gateway, es que el Gateway no estaba para hacerla, y el informe se ejecuta **una vez**, de inmediato, con la etiqueta `catchup`. No se ejecuta una vez por cada hora perdida: un informe diario que perdió tres días se ejecuta una vez, el día en que vuelve el Gateway, con la ventana que eso significa a partir de ahora. Los días perdidos no se rellenan. Después, el informe vuelve a su programación.

`last_run_at` se escribe **antes** de que empiece la ejecución, de modo que un Gateway que muere a mitad de una ejecución no la repite al reiniciar encima de un correo que quizá ya salió. En su lugar, la ejecución interrumpida se registra como fallida. Una ejecución programada fallida no se reintenta; la siguiente hora programada se ejecuta con normalidad, y `POST /api/reports/{id}/run` está ahí para cuando alguien quiera repetirla.

## Salida

Cada ejecución escribe sus archivos bajo `HOTLOOP_REPORTS_DIR` (`/data/reports`, un PVC en el chart):

```
/data/reports/<report id>/<UTC timestamp>-<run id>.csv
/data/reports/<report id>/<UTC timestamp>-<run id>.html
```

- **Los nombres de archivo se construyen solo a partir de un id validado, una marca de tiempo UTC y el id entero de la ejecución.** El recorrido de rutas queda cerrado por construcción: el id del informe debe cumplir la misma regla de identificador que en el resto, y un nombre de archivo leído de un registro de ejecución se compara con el patrón exacto anterior antes de abrirse. El `{run}` de una URL de descarga se interpreta como entero y solo se usa para buscar el registro de ejecución junto con el id del informe. El archivo que se abre es el que nombra ese registro. Nada de la URL pasa a formar parte de una ruta.
- Los archivos se crean con `O_EXCL` y modo `0640`, y los directorios con `0750`. Un archivo que ya existe es un error, nunca se sobrescribe. La salida contiene datos de planta y nombres de tags, así que el modo es un mínimo, no un sustituto de proteger el volumen.
- **Retención.** Tras cada ejecución se conservan las `retain` ejecuciones más recientes que guardaron archivos, y las más antiguas se eliminan con sus archivos. Las ejecuciones fallidas, que no tienen archivos, se conservan aparte (las `retain` más recientes de ellas), de modo que una racha de fallos no pueda desplazar el último buen informe. También se elimina cualquier archivo del directorio del informe que cumpla el patrón de nombres pero no esté referenciado por ningún registro de ejecución restante (el archivo parcial de una ejecución que murió). Un archivo que no cumpla el patrón, como uno que haya dejado allí un operador, se deja en paz.

### CSV

RFC 4180, de `encoding/csv`, con finales de línea CRLF. Las columnas son `device_id`, `tag_name`, `unit`, `period_start`, `period_end`, una columna por agregación en el orden en que las lista la definición y `excluded`. Las marcas de tiempo son RFC 3339 en la zona horaria de la planta con su desfase. Los números se escriben con precisión completa.

**Inyección de fórmulas en hojas de cálculo.** El nombre de un tag o una unidad es texto que alguien escribió, y una hoja de cálculo lee como fórmula una celda que empieza por `=`, `+`, `-` o `@`. Toda celda de texto que empiece por uno de ellos (o por un tabulador o retorno de carro, o por un espacio seguido de uno) lleva un apóstrofo delante, que las hojas de cálculo tratan como "esto es texto" y no muestran. Las columnas numéricas se escriben a partir de números, así que una lectura negativa se deja intacta y se sigue leyendo como número.

El archivo no lleva marca de orden de bytes. Excel abre un CSV UTF-8 sin ella como si fuera una página de códigos antigua, así que un nombre de tag con caracteres no ASCII puede necesitar importarse como UTF-8.

### HTML

Un único archivo autocontenido, generado con `html/template`, de modo que los nombres y valores de los tags se escapan según donde caen: un tag llamado `<script>` se escribe como texto. La hoja de estilos está en línea y no hay script, fuente, imagen ni enlace a ningún sitio, porque las instalaciones pueden estar aisladas de la red. También lleva una etiqueta meta `Content-Security-Policy` que prohíbe cargar cualquier cosa, y la API lo sirve con una política que añade `sandbox`, como adjunto.

## Envío por correo

Si un informe tiene `recipients`, cada ejecución envía los archivos por correo como adjuntos, a través del relé SMTP configurado en `HOTLOOP_NOTIFY_SMTP_*` (host, puerto, usuario, contraseña, remitente, TLS). Con el canal de alarmas solo se comparte el relé: que ese canal esté activado y a quién van las alarmas no afecta a los informes, así que una instalación puede enviar informes por correo sin avisar a nadie. El chart escribe las variables del relé solo para los informes cuando el canal de alarmas está desactivado.

Es el mismo código SMTP que el del canal de alarmas, no una segunda copia. El canal de alarmas ahora también envía a través de él. La gestión de la conexión no cambia (el puerto 465 ahora habla TLS desde el primer byte, vea [Notificaciones de alarma](/es/iot/notifications/#tls-implícito-puerto-465)): STARTTLS siempre que el relé lo ofrece, `AUTH` cuando hay credenciales, y un fallo duro antes de `AUTH` cuando `HOTLOOP_NOTIFY_SMTP_TLS` está definido y el relé no ofrece STARTTLS. Para una alarma ASCII el mensaje son los mismos bytes que antes, salvo la cabecera `Date`, y una prueba lo fija. El asunto de una alarma no ASCII ahora se envía como palabra codificada RFC 2047 en lugar de UTF-8 sin procesar.

El mensaje es `multipart/mixed`: una parte de texto quoted-printable y luego cada archivo en base64. **La inyección de cabeceras se rechaza, no se limpia.** Los destinatarios, el remitente, el asunto y los nombres de los archivos adjuntos se validan: un valor con CR, LF u otro carácter de control, un destinatario en forma de nombre visible o que contenga una lista, o un nombre de archivo con una comilla o una ruta hace que el mensaje falle antes de enviar nada al relé. El asunto propio del canal de alarmas es la única excepción, porque un aviso debe salir se llame como se llame la alarma: primero convierte los caracteres de control en espacios.

- **Sin relé configurado.** Un informe con destinatarios se ejecuta igualmente y guarda sus archivos, y la ejecución se registra como `failed`, con `emailStatus` `failed` y un error que dice que el relé no está configurado. No tiene éxito en silencio.
- **Demasiado grande.** `HOTLOOP_REPORTS_MAX_EMAIL_BYTES` (10 MiB) limita los datos adjuntos de un correo. Un informe que lo supere se guarda y se puede descargar, y su ejecución registra por qué no se envió por correo.
- Una ejecución hecha a mano puede omitir el correo con `?deliver=false`.

## Registros de ejecución y la pista de auditoría

Cada ejecución se registra en `report_runs` desde el momento en que empieza: cuándo empezó y terminó, el disparador (`schedule`, `catchup` o `manual`), quién lo pidió, la ventana, el resultado y el texto del error, el número de tags, filas, lecturas agregadas y lecturas excluidas, los archivos guardados, el resultado del correo y sus destinatarios, y notas (por ejemplo, que un tag se ha eliminado desde entonces y se informa a partir de su historial registrado). El éxito y el fallo también se escriben mediante `rt.Event`, la misma pista de auditoría que usan las alarmas y las acciones de flota, con el id del informe como sujeto.

Una ejecución interrumpida por el apagado, por su límite de tiempo (`HOTLOOP_REPORTS_RUN_TIMEOUT`) o por la eliminación del informe se registra como fallida con ese motivo. Una ejecución que un proceso muerto dejó en `running` se marca como fallida cuando el Gateway vuelve a arrancar. Solo hay una ejecución de un informe en curso a la vez; una segunda petición mientras hay una en marcha es un `409`.

## API

| Ruta | Permiso | <span class="sr-only">Detalles</span> |
|---|---|---|
| `GET /api/reports` | `reports.read` | Todas las definiciones, cada una con su `nextRunAt` y su ejecución más reciente |
| `POST /api/reports` | `reports.write` | Crear. `409` si el id existe |
| `GET /api/reports/{id}` | `reports.read` | Una definición |
| `PUT /api/reports/{id}` | `reports.write` | Reemplazar. El id no puede cambiar |
| `DELETE /api/reports/{id}` | `reports.write` | Eliminar, con sus ejecuciones y archivos. Una ejecución en curso se cancela primero |
| `POST /api/reports/{id}/run` | `reports.run` | Ejecutar ahora y esperar. `?deliver=false` omite el correo |
| `GET /api/reports/{id}/runs` | `reports.read` | Registros de ejecución, los más recientes primero (`?limit=`, hasta 500) |
| `GET /api/reports/{id}/runs/{run}/download?format=csv\|html` | `reports.read` | Transmitir un archivo guardado como adjunto |

`POST .../run` devuelve el registro de ejecución con `200` haya funcionado o no la ejecución. El estado dice si la petición se llevó a cabo, y el `status` del propio registro dice si lo hizo el informe. Una ejecución que falla es un resultado, y se registra en cualquier caso. La ejecución no está atada a la conexión del cliente: colgar no aborta un informe que quizá ya haya iniciado un correo.

Con la función desactivada, la lista responde `{"reports": [], "configured": false}` y todas las demás rutas responden con un error que nombra `HOTLOOP_REPORTS_ENABLED`.

### Quién puede hacer qué

| Rol | `reports.read` | `reports.run` | `reports.write` |
|---|---|---|---|
| visor | sí | no | no |
| operador | sí | sí | no |
| administrador | sí | sí | sí |

- **Leer** es para los visores porque un informe guardado son agregados de un historial que un visor ya puede leer mediante `values.read`, así que leerlo o descargarlo no concede nada nuevo.
- **Ejecutar** es para los operadores porque ejecutar un informe solo entrega a los destinatarios que un administrador ya eligió, y puede ejecutarse sin entregar.
- **Escribir es solo para administradores.** Una definición nombra las direcciones a las que se envía su salida, así que poder definir una es poder enviar datos de planta a una dirección arbitraria según un calendario. Eso se parece más a `notify.test` y `fleet.config` (también solo para administradores, también "hacer algo hacia el mundo exterior") que a una lectura. Es una decisión de criterio, y podría revisarse si un flujo de trabajo real necesita que los operadores creen informes.
- Un operador aún puede provocar que se envíe un correo a los destinatarios de un informe ejecutándolo, y repetidamente. Hay una protección de una ejecución a la vez y `?deliver=false`, pero no un límite de frecuencia.
- Un usuario con una lista de permisos explícita tiene exactamente lo que nombra; el comodín `reports.*` cubre los tres.

## Configuración

| Variable | Por defecto | <span class="sr-only">Detalles</span> |
|---|---|---|
| `HOTLOOP_REPORTS_ENABLED` | `false` | La función está desactivada, planificador incluido, hasta que se define esto |
| `HOTLOOP_REPORTS_DIR` | `/data/reports` | Dónde se escriben los archivos de cada ejecución. Pensado para ser un PVC (`reports.persistence` en el chart) |
| `HOTLOOP_REPORTS_RUN_TIMEOUT` | `5m` | Acota una ejecución: consulta, generación, escritura y correo |
| `HOTLOOP_REPORTS_MAX_EMAIL_BYTES` | `10485760` | La mayor cantidad de datos adjuntos en un correo |
| `HOTLOOP_TIMEZONE` | `UTC` | La zona horaria de la planta. Debe ser un nombre de zona real, o HotLoop no arranca |
| `HOTLOOP_NOTIFY_SMTP_HOST`, `_PORT`, `_USERNAME`, `_PASSWORD`, `_FROM`, `_TLS`, `_TLS_SKIP_VERIFY` | | El relé por el que los informes envían correo. Vea [Notificaciones de alarma](/es/iot/notifications/) |

El bloque `reports` del chart tiene `enabled`, `runTimeout`, `maxEmailBytes` y `persistence` (tamaño, clase de almacenamiento, modo de acceso). `notify.smtp` aporta el relé. Los informes no se inician en el modo `--mcp-stdio`, que es un agente que lanza el binario como ayudante, y un segundo planificador junto al Gateway real ejecutaría cada informe pendiente dos veces.

## Copias de seguridad

Las definiciones de informes y los registros de ejecución son datos de usuario y forman parte de la copia de seguridad de la base de datos. Los archivos de salida no: están en el volumen de informes, y restaurar una copia en un despliegue nuevo trae de vuelta los registros pero no los archivos, así que descargar allí una ejecución antigua responde que el archivo ya no está en disco. Copie el volumen de informes si los archivos importan.

Añadir estas dos tablas a la lista de copias es el tipo de cambio que es fácil olvidar, así que el paquete de copias de seguridad ahora tiene protecciones para ello. Una prueba lista todas las tablas del esquema y falla si alguna no está ni en `backup.Tables` ni en una lista de exclusión explícita con su motivo. Otra comprueba que `Tables` esté en orden de claves foráneas, leyendo las claves foráneas de la base de datos. La prueba de ida y vuelta siembra una definición de informe y una ejecución y comprueba los valores restaurados y la secuencia.

## Qué se ha verificado y qué no

HotLoop se ha ejecutado con equipos reales y servidores reales, y en hardware real el 2026-11-17.
