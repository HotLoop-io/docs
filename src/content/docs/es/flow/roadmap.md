---
title: "Hoja de ruta de Flow"
description: "Las fases de Flow, lo que ya está hecho y lo que viene, incluida la reescritura del editor en Astro."
---

Lo que HotLoop Flow va a ser, en el orden en que se construye. Si no está en esta lista, no se va a hacer, así que póngalo en la lista.

Flow se construye junto a HotLoop y sigue siendo un producto propio. FlowLab y sus diagramas, la Fase 9, son un paquete aparte que convive con el motor de mensajes.

## Para qué sirve Flow

Un motor de flujos visual para la planta. Cada despliegue se compara, se prueba y queda a un clic de la reversión. Cuando algo sale mal a las 3 de la madrugada, puede ver exactamente por qué camino fue un mensaje y cómo era en cada salto. Corre en un único binario estático, tan pequeño que cabe en una Pi, y no se cae cuando un sensor se pone charlatán.

También lee sus `flows.json` existentes sin cambios. Eso es una ventaja, no el objetivo.

Las reglas bajo las que sale cada punto de abajo:

- Nada de maquetas. Si no está construido, probado contra lo real y funcionando, no se marca.
- Todo lo que pueda dar órdenes a un equipo pasa por una puerta que puede decir que no, y dice por qué.
- Nada se tira en silencio. Cada descarte, rechazo y desbordamiento se cuenta y aparece en las métricas.
- El archivo de flujos sigue cargándose y guardándose byte por byte. Los datos nuevos van en claves que otras herramientas ignoran, y la prueba de ida y vuelta cubre los archivos que las llevan.

---

### Fase 0: decir la verdad

El README afirma cosas que el código no respalda. Eso se corrige antes de prometer nada nuevo, porque un README que miente una vez se lee como si mintiera siempre.

- [x] El sandbox WASM es real y está probado, pero ningún nodo lo usa y no va en el binario. Se dice así hasta que la Fase 6 lo haga cierto
- [x] Dos comentarios del código apuntan a un almacén de contexto embebido que no existe. Se borran
- [x] Volver a medir la memoria en reposo y bajo carga del mismo modo y en la misma máquina, publicar el comando junto con la cifra y descartar toda cifra que nadie pueda reproducir
- [x] CVE-2025-41656 es un fabricante que entrega otro motor de flujos con la autenticación desactivada, no un CVE de ese motor. Se corrige la atribución en el README y en la fila de `exec` de `docs/compatibility.md`
- [x] Reescribir el inicio del README en torno a lo que hace Flow. Importar flujos existentes pasa a su propia sección más abajo, con la ida y vuelta exacta al byte y `hotloop-flow import` como prueba
- [x] La documentación de despliegue habla de Kubernetes, Podman y Quadlet, no de la App Store de una sola empresa
- [x] Pruebas para los paquetes que no tienen ninguna: `api` (inicio de sesión, permisos, el 409 ante un despliegue obsoleto), `config` (cada rechazo al arrancar que lista el README) y `cmd` (el despliegue escribe el archivo de flujos antes de detener el runtime anterior), más `js`, el sandbox del nodo Function, que tampoco tenía

### Fase 1: historial, diferencias, reversión

Cada despliegue es un registro: quién, cuándo, una nota, los bytes exactos y qué cambió. «Qué cambió, quién lo cambió, ponlo como estaba» es lo primero que todo el mundo pregunta cuando se para una línea, y hoy la respuesta son tres archivos `.bak`.

- [x] Registro de despliegues: cada despliegue es un registro inmutable con el usuario, la hora, una nota opcional, los bytes del flujo y las credenciales cifradas tal como estaban. La retención es un ajuste. `GET /deployments`
- [x] Diferencias semánticas: nodo a nodo, propiedad a propiedad. Añadido, eliminado, cambiado, recableado. Mover un nodo por el lienzo aparece como diseño, nunca como un cambio de lógica. Por la API y como `hotloop-flow diff a.json b.json`
- [x] La comparación funciona como difftool de git, de modo que una pull request sobre un flujo dice «umbral de la regla 2 de 7,5 a 8,0» en lugar de un bloque de JSON
- [x] Reversión: vuelve a desplegar un registro antiguo como uno nuevo, credenciales incluidas, así que un nodo que borró regresa con la contraseña de su broker. El historial solo se añade, nunca se reescribe
- [x] Editor: panel de historial, la diferencia dibujada en el lienzo, «revisar y desplegar» con una nota y un botón de reversión. Un conflicto de despliegue muestra lo que cambió la otra persona en lugar de una caja de sí o no
- [x] Flujos como código: `hotloop-flow deploy` y `hotloop-flow export` para CI/CD, con un token solo de despliegue, para que una canalización nunca tenga una contraseña de administrador
- [x] Espejo git opcional: cada despliegue enviado como un commit firmado por quien lo desplegó. Go puro, y la comprobación del tamaño del binario sigue pasando
- [x] Registro de auditoría: inicios de sesión, inicios fallidos, despliegues, reversiones e inyecciones, cada uno con quién y desde dónde. El registro de despliegues es su primera tabla
- [x] MFA (TOTP), gratis y activable para quien la quiera. Nada de lo que tenga que ver con iniciar sesión de forma segura se cobra, nunca
- [x] Limitación de intentos de inicio de sesión y bloqueo, sesiones que sobreviven a un reinicio, y el token del websocket enviado como subprotocolo en lugar de en la URL. Un token en la URL sigue funcionando para los scripts existentes y registra una advertencia, porque romperlos en una actualización era peor que la fuga; quitarlo espera a una versión mayor

### Fase 2: pruebas de flujos

«¿Mi cambio rompió la línea?» se responde antes del despliegue, no después. Las pruebas son YAML junto a los flujos, así que se comparan y se revisan igual.

- [x] `hotloop-flow test`: el runtime real y los nodos reales, en proceso. Inyecte un mensaje, espere lo que sale de un puerto dentro de un plazo, espere nada, espere que un error llegue a un Catch. Salida JUnit para CI/CD
- [x] E/S virtualizada: un MQTT de salida, una escritura en base de datos o una petición HTTP en una prueba registran lo que habrían enviado y nunca tocan la red
- [x] Reloj virtual: un Delay de cinco minutos corre en milisegundos, y cada nodo de temporización se prueba contra él
- [x] Fixtures de contexto y de credenciales, y aserciones sobre el contexto después. Una prueba no puede apoyarse en lo que dejó otra
- [x] Puerta de despliegue: con ella activada, un despliegue que no pasa sus pruebas se rechaza con las aserciones que fallan, y los flujos que ya están corriendo ni lo notan
- [x] Editor: convierta un mensaje de depuración capturado en una prueba con dos clics, ejecute la batería desde el editor, con aprobado y fallo sobre los nodos

### Fase 3: rastreo y repetición

- [x] Haga clic en un mensaje de depuración y el lienzo ilumina el camino que siguió, con el tiempo y la carga útil en cada salto, a través de divisiones, uniones y subflujos
- [x] Búfer de rastreo acotado. La memoria se mantiene plana en una prueba de resistencia de un millón de mensajes, y la cifra se publica
- [x] Repetir un mensaje capturado en un borrador del flujo y comparar la salida
- [x] Un rastreo capturado se convierte en una prueba de la Fase 2
- [x] Exportación a OpenTelemetry, probada contra un colector real

### Fase 4: estado duradero

Que un historiador se caiga una hora no debería costarle una hora de lecturas.

- [x] Contexto persistente en SQLite, Go puro sin cgo, con las operaciones atómicas (comparar e intercambiar, incrementar, actualizar). Un solo almacén para el contexto ahora y las colas duraderas después, no dos. Hoy el contexto del flujo y el global se pierden en cada reinicio, que es el hueco con más probabilidad de morder primero a alguien. Se escribe en diferido en una transacción cada treinta segundos, y un valor puesto a lo que ya era no escribe nada
- [x] Cables duraderos: marque un cable como duradero y su cola se vuelca a ese mismo almacén en lugar de bloquearse o descartar. Sobrevive a un reinicio, mantiene el orden, respeta una cuota de disco y la profundidad es una métrica. Se marca en el archivo de flujos con `ew_durable`, así que la ida y vuelta sigue siendo exacta al byte. Haga doble clic en un cable en el editor para marcarlo
- [x] Almacenar y reenviar probado por las malas: matar el InfluxDB real durante diez minutos con una entrada constante, volver a levantarlo, contar filas. Ninguna falta, ninguna duplicada. Luego kill -9 al runtime a mitad de la cola y contar otra vez. El script, los conteos y las escrituras en disco por hora están en [durable/](/es/flow/durable-state/)
- [x] Probado en una Pi 5 real: memoria, tiempo de arranque y rendimiento sostenido, en [docs/bench](/es/flow/benchmarks/#resultados-en-una-raspberry-pi-5), con la limitación térmica que mostró
- [ ] Probado en una Pi 4 y una Zero 2 W, y las escrituras por hora en una tarjeta SD, porque un almacén de contexto que se come una tarjeta SD es un fallo. Abierto porque necesita las placas. La Pi 5 está medida; una cifra de cualquier otra máquina sería inventada

### Fase 5: la planta

`scan` encuentra hoy un PLC y nada en la paleta puede hablar con él. Es el mayor hueco de un producto hecho para plantas.

- [x] Modbus TCP lectura y escritura
- [x] OPC UA lectura, suscripción y escritura
- [x] S7 lectura y escritura
- [x] Sparkplug B, como nodo de borde y como host
- [x] EtherNet/IP lectura y escritura
- Todo con simuladores. Ninguna CPU Siemens ni controlador Logix ha estado delante de nada de esto
- [x] Nodos de HotLoop: cambios de entidad de entrada, estado de entidad, llamar a un script, aplicar una receta. Cada orden pasa por la puerta de escritura de HotLoop y queda en su cuaderno de registro como `flow:<node id>`, y una escritura que la puerta rechaza llega a un nodo Catch con el motivo de la puerta
- [x] Cuando HotLoop está presente, las escrituras de Flow en equipos pasan por la puerta de HotLoop en lugar de ir directas al PLC. Ambas llegaron en la 2.3.0. Una escritura a través de la puerta real está probada para Modbus contra una imagen publicada de HotLoop; los nodos de escritura OPC UA, S7 y EtherNet/IP envían por el mismo código y una prueba comprueba que cada uno ofrece la puerta.

### Fase 6: plugins sin npm

- [x] Un nodo `wasm` en el host que ya existe: techo de memoria estricto, un tiempo límite, y un invitado que pase de cualquiera de los dos se detiene sin llevarse nada más por delante
- [x] Formato de plugin: el módulo, un descriptor para que el editor dibuje su diálogo, y una firma. Los plugins sin firmar o alterados se niegan a cargar y dicen por qué
- [x] Capacidades: un plugin no tiene acceso al host a menos que su manifiesto lo pida y el operador lo conceda. Pedir algo no concedido hace fallar el despliegue

### Fase 7: cables con tipos y MCP

- [x] Validación de esquemas en el nodo `json`, la primera parte
- [x] Esquemas opcionales en los puertos. Una discrepancia que el editor ve se rechaza al desplegar; una que no ve va a un nodo Catch con la ruta del campo erróneo, y a una métrica
- [x] Tipos dibujados sobre los cables en el editor
- [x] Flujos como herramientas MCP: un nodo de herramienta declara un nombre, una descripción y un esquema de entrada, y Flow sirve `/mcp`. Un agente que llama a un flujo obtiene los mismos permisos y el mismo registro de auditoría que una persona
- [x] Un nodo cliente MCP, para que un flujo pueda llamar a herramientas de otros servidores, incluido el de HotLoop
- [x] Las herramientas MCP propias de Flow: listar, leer, desplegar y revertir flujos, listar los despliegues y pulsar un nodo inject, a través de los propios manejadores de la API de administración con los mismos permisos, comprobaciones de despliegue y rastro de auditoría, porque un MCP que solo pudiera llamar a lo que escribió el autor de un flujo no podría leer ni escribir el propio Flow
- [x] Las herramientas MCP propias de Flow para diagramas e instrumentos: listar y leer los diagramas, ejecutar y detener uno, manejar su depurador, ajustar un control de su panel, poner puntos de interrupción y sondas, hacer un subdiagrama, y leer y cambiar las escrituras de un instrumento, cada una como una ruta de administración ejecutada por su propio manejador con el permiso que esa ruta pide (`status.read`, `diagram.run`, `instrument.write`). Hasta ahora las rutas de diagramas no tenían herramienta, así que un agente podía desplegar un diagrama y no ejecutarlo. Cada ruta de administración es ahora una herramienta o se nombra en una prueba como una que debe hacer una persona, y la prueba falla cuando se añade una ruta nueva sin una. Ahora hay 44 herramientas, con las de estaciones, conmutación y rastreo

### Fase 8: el editor, reescrito en Astro

Hecho, y adelantado. Iba a ir el último, y lo pasamos por delante de las primeras capturas de Flow, porque nadie debería ver las primeras en un editor que parece de otra empresa.

Cada proyecto de HotLoop está recibiendo una interfaz moderna única, y este editor era el que no encajaba. Era TypeScript puro hecho a mano sobre SVG nativo, que fue la decisión correcta cuando el objetivo era un binario estático pequeño sin nada que auditar. Ahora es Astro con islas de Svelte, la misma pila que el editor de Cascade, con los mismos tokens de HotLoop, claro y oscuro.

- [x] Primero una pasada de diseño, antes de una sola línea de Astro. Cómo debe verse y sentirse el editor junto al resto de HotLoop, resuelto sobre el papel y en los tokens compartidos, para que la reescritura construya algo que alguien ya decidió en lugar de decidir sobre la marcha
- [x] El editor reconstruido en Astro con el lienzo, los diálogos, el historial, la revisión, las pruebas, el rastreo, la búsqueda y los grupos trasladados, sin dejar que ninguno empeore. Las pruebas de navegador de `web/e2e` son el listón: pasan contra el nuevo editor sin cambios
- [x] Sigue embebido en el único binario estático, sigue sin necesitar red en una caja de borde, sigue dentro del presupuesto de tamaño del binario, y la puerta de licencias sigue cubriendo todo lo que va en el paquete

El lienzo y el grafo que lleva debajo no se reescribieron. Pasaron a `web/src/lib` como el TypeScript que eran, con un aspecto nuevo, así que el cableado, el arrastre, deshacer y la ida y vuelta exacta al byte del archivo de flujos son el código que ya estaba probado. Todo lo que lo rodea es Svelte.

Flow sigue siendo un producto propio durante todo esto. Comparte el aspecto con HotLoop, no el código, y nunca va embebido en HotLoop.

### Fase 9: FlowLab, diagramas

Una segunda forma de ejecutar una pestaña, junto a los mensajes y nunca en su lugar. En un diagrama cada nodo se ejecuta una vez, cuando cada una de sus entradas cableadas tiene un valor, y las ramas sin cable entre ellas se ejecutan a la vez. Eso es lo que necesita un banco de pruebas o un registrador de datos: bucles que llevan un valor de una pasada a la siguiente, un error que viaja por un cable propio, un panel que un operador puede abrir en el teléfono y un depurador que puede pausar una ejecución y mostrar qué hay en cada cable. Los flujos existentes no cambian, y el archivo de flujos sigue cargándose y guardándose byte por byte: un diagrama es una pestaña con una clave `ew_diagram`, y la entrada en la que aterriza un cable se guarda en `ew_in` en el nodo de donde sale. [FlowLab](/es/flow/flowlab/) tiene el resto.

- [x] El planificador: todas las entradas cableadas listas, ramas independientes en paralelo, y un cable `after` para el orden donde no fluyen datos
- [x] Bucles while y for con valores arrastrados, y un cable de error que salta los nodos posteriores a un fallo, detiene un bucle y lleva su origen y su código
- [x] Un puerto serie, con lecturas hasta un terminador o un número de bytes, un tiempo límite en el cable de error, y un puerto que se vuelve a abrir tras un cable desconectado y se cuenta
- [x] Un analizador de lecturas, detección de valor estable y un registro de texto con una columna de hora
- [x] Un panel servido por Flow: controles, indicadores y una gráfica, abierto en un teléfono mientras la ejecución está en vivo, con un segundo observador en un escritorio, cada uno siguiendo la ejecución en menos de un segundo
- [x] Ejecutar, detener, resaltar la ejecución, sondas en cualquier cable, puntos de interrupción en nodos, cables y pasadas, y entrar, pasar por encima y salir
- [x] El editor dibuja puertos con nombre y cables hasta el que usted suelta, y la misma página ejecuta y depura
- [x] Estructura Case, registros y tipos compartidos, formas de onda
- [x] Registro TDMS y binario, y salida a base de datos y a MQTT
- [x] Sesiones de instrumento, por socket sin procesar y por puerto serie, probadas contra un simulador y un pty
- [ ] Un cliente de adquisición de datos probado contra el propio servidor de NI. Está construido y entregado, y probado solo contra un servidor de pega, así que sigue abierto hasta que haya corrido contra el servidor de NI y un dispositivo
- [x] Análisis: estadísticas y filtros
- [x] Subdiagramas, una lista de errores en CI/CD, y el trabajo de zoom y disposición del editor
- [x] Repetición de una ejecución terminada: se registran el inicio y el final de cada nodo y cada valor de cable, y la barra del diagrama reproduce la última ejecución sobre el lienzo. `GET /diagrams/{id}/trace`, la herramienta `get_diagram_trace`
- [x] Un destino de base de datos que conserva lo que una base de datos pierde: `postgres out`, duradero, escrito en orden y por lotes cuando la base de datos vuelve, probado en un TimescaleDB real
- [x] Enviar un archivo de flujos, y con él un conjunto de diagramas, a cada instalación de Flow que un tenant ejecuta en EmberNet, con una comprobación después de cada una y una fallida devuelta a su estado ([Envío a las estaciones de un tenant](/es/flow/stations/)), probado en tres procesos Flow reales
- [ ] Probado en una Pi durante un día, lo que necesita la placa y una ejecución larga

---

## Carencias de todos los días

Van en paralelo a las fases. Nadie elige un motor de flujos por tenerlas, pero mucha gente deja uno que no las tiene.

- [x] Despliegue parcial: solo se reinician los nodos que cambiaron y sus cables. Hoy cada guardado tira todas las sesiones MQTT y todos los mensajes en vuelo, lo que enseña a los operadores a no desplegar durante un turno
- [x] JSONata, probado contra los ejemplos publicados, porque es lo más común en lo que tropieza un flujo importado
- [x] Inject con programación tipo cron
- [x] Modo de retorno de Link Call y Link Out
- [x] Join por tiempo límite y reduce, batch por tiempo, split en streaming
- [x] MQTT v5 y last will
- [x] TLS sobre TCP, cookies y multipart en HTTP
- [x] Editor: copiar y pegar, importar y exportar una selección, edición de subflujos y grupos, búsqueda entre flujos, filtrado de depuración
- [x] Carencias del editor que dejó la primera pasada: añadir un nodo de configuración desde la paleta (el diálogo lo pedía y no se podía), convertir una selección en un subflujo, renombrar y eliminar un flujo, y marcar un cable como duradero con doble clic
- [x] Una salida para un mensaje que el destino de un cable duradero rechaza para siempre: un límite de intentos opcional por cable. Pasado ese número de rechazos, el mensaje va al Catch del flujo como un error con el mensaje adjunto y el cable sigue. Desactivado por defecto, así que un cable aguanta y reintenta exactamente como antes
- `store.*` ya estaba desde el trabajo duradero y ahora tiene la misma comprobación
- [x] Un nodo que apunta a un nodo de configuración que no está en el archivo (un flujo borrado con su propio broker mientras un subflujo, una edición a mano o una importación aún lo nombran) lo informa `hotloop-flow import`, el editor al cargar y al desplegar, y la respuesta del despliegue, y el nodo es un fallo de arranque en lugar de un nodo que en silencio nunca funciona
- [x] Las carencias que dejó esa: una referencia de configuración que nombra una pestaña, un subflujo, un grupo, un nodo normal o el tipo equivocado de nodo de configuración se informa y falla al arrancar igual que una que no nombra nada, una reversión pone las advertencias del archivo en el registro del editor una vez y no dos, y `hotloop-flow import` escribe su informe en un writer como lo hace `deploy`, para que sus pruebas dejen de cambiar la salida estándar
- El proyecto original todavía tiene la línea; no les pedimos que aceptaran el cambio
- [x] La prueba de purga del cable duradero podía contar uno más de descartados de los que había muestreado como en cola. La prueba estaba mal, no la cola: esperaba 28 de 30 mensajes en disco y luego exigía a la purga exactamente lo que había visto, mientras el spool aún contaba los últimos. Cuántos de los 30 están en disco cuando se va el cable depende del momento, así que ahora exige a la purga lo que vio como mínimo y los 30 enviados como máximo
- [x] La prueba de matar el cable duradero pasaba en local y fallaba en un runner más lento. La cola contaba un mensaje como en espera antes de que estuviera en disco, así que una copia tomada en el momento en que la cuenta llegaba a 100 podía quedarse corta por uno. Ahora cuenta después del commit
- [x] El editor, el texto de los nodos y la página del panel en 13 idiomas además del inglés, con un glosario compartido
- [x] Kafka de salida, y ntfy, gotify y discord de salida, con los ajustes de notificación que ya tiene core
- [x] Un cable duradero a InfluxDB se pone al día en lotes de hasta 256, así que una hora de atraso se vacía en segundos y no en minutos
- [x] Los nodos conectores de Node-RED que necesita una migración de planta (servidor Modbus en una interfaz de red, correo, postgres y los nodos del panel), ejecutados de forma nativa
- [x] Valores del chart y una comprobación de renderizado para el envío a estaciones
- [x] Secretos por referencia: un nodo lee una contraseña de un Secret de Kubernetes montado o de un archivo, así que nunca vive en el archivo de flujos
- [x] Traiga sus flujos: `hotloop-flow import` sigue informando exactamente qué se ejecutará y qué no antes de desplegar nada. Lista los tipos de nodo que se ejecutan, los que se ejecutan con una diferencia y cuál es, los que no arrancarán, y un nodo que apunta a un nodo de configuración que no está en el archivo

## Más adelante

- [x] Activo/en espera: una concesión en un PostgreSQL con un número de vallado, un vallado en cada escritura a equipos, y un nodo en espera que retiene sus escrituras hasta que toma la concesión ([Reserva en caliente con concesión](/es/flow/failover/)). Probado en dos procesos Flow reales contra un PostgreSQL real y un servidor Modbus que registra cada escritura: matado a mitad de flujo, congelado y descongelado, y detenido limpiamente, sin ninguna escritura desde los dos a la vez. El contexto permanece en el disco de cada instalación y no en Postgres, que fue el primer boceto y no hace falta para mantener separados a dos escritores

## Decidido

Cada pregunta que llevaba esta lista tiene respuesta. Se quedan aquí con sus respuestas, porque las razones son lo que impide que alguien las reabra.

Decidido el 2026-10-03:

- **Los nodos industriales se construyen en Flow,** sobre las mismas bibliotecas de código abierto que usan los drivers de HotLoop. Los drivers de HotLoop siguen siendo de HotLoop. Flow conserva su propia licencia, que era otra cuando esto se decidió y ahora es el HotLoop Source License Agreement 1.0, que sustituyó al EmberNet Source License 1.0 y, antes, al Business Source License 1.1 que llevaba desde la 2.2.0.
- **Flow sigue siendo un producto propio y nunca va embebido en HotLoop.** Corre junto a HotLoop y habla con la API de HotLoop desde fuera, que es lo que hacen los nodos HotLoop de la Fase 5, y esa es toda la relación.
- **El README empieza por lo que hace Flow.** «Conecte la planta. Revísela como código». Importar flujos existentes vive más abajo en «Traiga sus flujos», y nada al principio compara Flow con nada. Flow se sostiene solo.
- **El contexto persistente es SQLite desde el principio,** Go puro sin cgo. Un solo almacén para el contexto ahora y las colas duraderas después, no un almacén de archivos primero y un segundo almacén después.
- **El producto de automatización de flujos de trabajo es otra cosa** y no comparte el motor de Flow. El historial, las diferencias y lo demás siguen siendo paquetes del motor aquí, porque la API, la CLI, el editor y git tienen que recibir la misma respuesta.

Decidido antes de empezar la Fase 1:

- **MFA y el registro de auditoría salen en la Fase 1,** por delante de lo divertido. Los dos salieron.
- **La ida y vuelta exacta al byte de los archivos de flujos existentes sigue siendo una regla firme,** incluso con tipos y pruebas en el archivo. Los datos nuevos van en claves que otras herramientas ignoran, y la prueba de ida y vuelta cubre los archivos que las llevan.
- **Los benchmarks son solo cifras absolutas,** cada una con el comando que la produjo. Una tabla comparativa cambia cada vez que cambia la máquina, y acaba describiendo el otro motor más que este.
