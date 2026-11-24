---
title: "Hoja de ruta de Cascade"
description: "Lo que Cascade ya tiene construido, lo que trajo cada versión y lo que todavía no está construido ni programado."
---

En ninguna parte del código existe una comprobación de licencia. Cada fase termina cuando su lista «real» se ha hecho contra sistemas reales, no cuando el código compila.

## 0.1.0, el MVP

Construido. El motor, las ejecuciones duraderas, la cola de Postgres y los workers, las expresiones, el paso Code en su jaula, la bóveda de credenciales y OAuth2, webhooks, programaciones y MQTT, usuarios con MFA obligatorio, OIDC, proyectos y RBAC, auditoría, historial de versiones, la API, el editor, los conectores de la lista aprobada, la importación de flujos de trabajo, métricas y trazas, el chart de Helm y las unidades Quadlet. Publicado con `RELEASE_CHECKLIST.md`, no antes.

## 0.2.0, identidad y gobernanza

Construido, y publicado dentro de 1.0.0 con el editor nuevo. SAML, LDAP y AD, SCIM, roles personalizados, secretos externos, envío de registros, variables, carpetas, análisis, anotaciones de ejecución, los almacenes de blobs en S3 y Azure, y políticas de redacción de ejecuciones. Cada una se prueba contra el servidor real con el que habla, y cada una tiene su pantalla en el editor.

## Lo que trajo 1.0.x

1.0.0 es 0.1.0 más 0.2.0 más el nuevo editor, todo en una sola versión. El editor era la última pieza que queríamos antes de poner nuestro nombre bajo el número.

1.0.1 corrigió un error en el inicio de sesión: una base de datos que no se podía leer respondía «no ha iniciado sesión» y borraba la cookie, así que una caída breve cerraba la sesión de todos y podía convertir un segundo factor correcto en un código erróneo. Ahora responde «vuelva a intentarlo» y conserva la sesión. 1.0.2 permitió que un paso Code firme y verifique con una clave HMAC guardada como credencial, y que un webhook indique los orígenes web que pueden llamarlo desde un navegador. Entre 1.0.0 y 1.0.2 no hubo nada que migrar.

Lo que un workflow guardado cumple hoy: el archivo dice de qué versión de su formato es (`cascade: 1`), cada paso lleva su propia versión, y un workflow que nombra un paso que ya no existe no pasa la validación y no arranca, en lugar de cambiarse en silencio. Así se quitaron los pasos de EmberOps en 1.0.0. Cada versión se arranca sobre los datos de la anterior antes de publicarse: el workflow sigue ahí y la credencial sigue abriéndose.

## 1.3.0, el editor en 14 idiomas

Construido. Inglés, español, francés, italiano, alemán, noruego bokmål, búlgaro, griego, coreano, japonés, vietnamita, hindi, chino simplificado y árabe. Un selector de idioma en la barra superior y en la página de inicio de sesión; se traducen todas las pantallas, los títulos y la ayuda de los pasos, y los rechazos del servidor; las fechas, los números y las duraciones siguen al idioma; el árabe se escribe de derecha a izquierda, con el lienzo y el código de izquierda a derecha. Cada idioma se prueba en todas las pantallas, en ancho de escritorio y de teléfono, en un navegador real, y la compilación rechaza un idioma al que le falte una línea. Las palabras salen del glosario compartido de HotLoop.

## 1.5.0, eliminar a una persona

Construido. Un propietario de la instancia puede eliminar a una persona desde Usuarios, la API REST (`DELETE /api/v1/users/{user}`) o el servidor MCP (`delete_user`). Su cuenta, sesiones, passkeys, identidades de inicio de sesión y claves de API desaparecen, y el registro de auditoría guarda quién lo hizo y qué se fue. Sus workflows, credenciales y ejecuciones se quedan: el proyecto personal pasa a ser un proyecto compartido con su nombre y "(removed)", para que un propietario o administrador traslade el trabajo o lo entregue a otra persona. Nadie puede eliminar su propia cuenta, y no se puede eliminar al último propietario. Desactivar a alguien sigue existiendo para cuando quiere conservar la cuenta.

## 1.4.2, la página de inicio de sesión

Construido. La página de inicio de sesión es una tarjeta centrada sobre una página tranquila, con la marca y el nombre del producto encima, el botón principal en naranja HotLoop y las otras formas de entrar (una passkey, el inicio de sesión único) como botones sencillos a su lado, en claro y oscuro y en un teléfono. El botón de inicio de sesión único lleva el icono de su proveedor cuando el proveedor es Vord. Cada campo, id y ruta de inicio de sesión es el que era.

## 1.4.1, la página de ajustes

Construido. La página de ajustes ya no devuelve un campo a su valor anterior cuando la respuesta de un guardado llega después de que la persona lo haya cambiado: un campo que sigue teniendo lo que se envió toma el valor del servidor, y uno editado desde entonces conserva la edición. Y las listas de revisión de las carpetas de idiomas ya no están.

## 1.4.0, espera, retención, límites y copia de seguridad

Construido. Un pod que arranca antes que su base de datos, cosa que hace el chart en la variante dividida, ahora la espera y lo dice, en lugar de reiniciarse dos o tres veces (la instalación no mostró reinicios en la prueba del chart). Y la retención: un ajuste para cuántos días se conservan las ejecuciones terminadas, desactivado de forma predeterminada, y una pasada cada hora que elimina las más antiguas con los datos de sus pasos. La misma pasada elimina los archivos del almacén de blobs a los que ya no apunta ninguna ejecución: la salida demasiado grande para la base de datos y los adjuntos, y un archivo compartido solo cuando desaparece la última ejecución que lo usa. Y un límite de frecuencia para cada clave de API, a través de la API y de MCP, desactivado de forma predeterminada, que responde 429 e indica cuánto esperar. (Un webhook tiene su propio límite, y una cuenta se bloquea tras repetidas contraseñas erróneas, como antes.) Y `hotloop-cascade backup` y `restore`: la base de datos SQLite, la clave y los archivos de blobs con un manifiesto de hashes, y para PostgreSQL la clave y los blobs más el comando `pg_dump` para la parte de la base de datos.

## 1.2.0, las cuatro últimas herramientas del servidor MCP

Construido. Al servidor MCP le faltaban cuatro rutas que una clave puede llamar: listar y revocar sus propias claves, abrir el webhook de prueba de un flujo de trabajo y empezar un inicio de sesión OAuth2. Ahora son herramientas, 83 en total, cada una a través de su ruta, de modo que se aplican las mismas comprobaciones de permisos que en el editor. Las diez rutas que necesitan a una persona con sesión iniciada (crear claves, tokens SCIM, proveedores de secretos y destinos de registros, y su propia contraseña) siguen fuera, porque una clave que pudiera crearlas podría mantenerse viva a sí misma; la página de MCP dice cuáles y por qué.

## 1.1.0, MCP y las pantallas que faltaban

Construido, y esta es la versión. El servidor MCP en `/mcp`: 79 herramientas, cada una una ruta de la API REST, de modo que el propio manejador de la ruta comprueba el permiso, valida el cuerpo, hace el cambio y escribe la fila de auditoría. Se entrega activado, con lectura y escritura, como todos los MCP de la familia HotLoop, y los dos interruptores son los del propio despliegue (`HOTLOOP_CASCADE_MCP`, `HOTLOOP_CASCADE_MCP_WRITES`), que ninguna herramienta ni ruta puede cambiar. La página de MCP tiene todas las herramientas y lo que pide cada una.

Y las pantallas que le faltaban al editor: credenciales, proyectos (miembros y cuentas de servicio), usuarios, el registro de auditoría, los ajustes y una página de cuenta con claves de API, cada una con los mismos permisos que la API y probada en un navegador real con cada rol. La página de inicio de sesión ya es la del editor, con sus colores y su tipografía, y no la antigua página en Go.

## 1.6.0, aprobaciones, IA, Git y conectores

Hecho. Cuatro cosas que estaban en esta página como pendientes llegan en una sola versión: formularios con pasos de aprobación humana, pasos de IA, control de código con Git con entornos e instancias protegidas, y la especificación declarativa de conectores con las herramientas que la rodean. Cada una tiene su sección más abajo.

## Formularios con pasos de aprobación humana

Hecho. El paso Pedir aprobación detiene una ejecución y se lo pregunta a una persona. Abre en el teléfono el enlace de aprobación de la ejecución, lee lo que escribiste, rellena un formulario si lo hay y pulsa Aprobar o Rechazar; la ejecución sigue por Aprobada o Rechazada con quién respondió, cuándo y qué dijo, y Cascade guarda la respuesta como un registro que puedes leer en el editor, en la API (`GET /api/v1/approvals`) y en el servidor MCP (`list_approvals`), con una fila de auditoría por cada una. La página es HTML sencillo sin scripts, en los catorce idiomas del editor. Nombra al aprobador por el nombre que escribe o por su cuenta con sesión iniciada.

## Control de código con Git, entornos e instancias protegidas

Hecho. Los workflows de un proyecto viven en un repositorio Git, un archivo cada uno, con el nombre del workflow y su id. Push los escribe y los confirma como la persona que lo hizo; pull hace que el proyecto coincida con el repositorio, conservando los ids, dejando desactivados los workflows nuevos, convirtiendo los cambiados en versiones nuevas y dejando intacto un cambio hecho en ambos lados salvo que digas quién gana. Es una pantalla del proyecto, seis rutas de la API y seis herramientas MCP. Una instancia puede recibir un nombre, que se muestra arriba en cada pantalla, y una instancia protegida no deja crear, editar, restaurar ni eliminar sus workflows a mano en el editor, la API o MCP: llegan haciendo pull desde Git, y las credenciales, las variables, las ejecuciones y activar o desactivar un workflow siguen abiertos.

## Escala

Construido de esta fase: el rol de webhook (su propio Deployment en la variante dividida del chart), un límite de concurrencia por flujo de trabajo y varios mains contra una misma base de datos. Lo que no hemos hecho es la prueba que fijamos para esta fase: matar un main durante una programación de nivel de minuto y no encontrar ninguna ejecución duplicada ni perdida en una hora.

## Conectores

Los conectores de la lista aprobada que se construyeron ya están: HTTP, ntfy, Discord, Gotify, correo electrónico, HotLoop, MQTT, bases de datos, archivos y los almacenes de blobs en S3 y Azure. El conector de EmberOps estaba en 0.1.x y se retiró en 1.0.0.

Y ahora un conector puede ser un archivo: la especificación declarativa de conectores está publicada (un formato versionado con un JSON Schema), y cualquier API que describa un archivo se convierte en pasos sin código. Las herramientas para escribir, probar, publicar e instalar uno vienen en el binario (`connector init`, `validate`, `call`, `index` e `install`), y un índice es un archivo estático que cualquiera puede alojar, con un hash por cada archivo.

## Pasos de IA

Hecho. Preguntar a un modelo y Ejecutar un agente. El modelo es tuyo, un servidor local como Ollama o un servicio alojado con tu clave, indicado por una credencial, y se hablan tanto el protocolo de OpenAI como el de Anthropic. Un agente usa otros workflows como herramientas y espera entre turnos en la base de datos.

Pendiente, sin fecha: un asistente que escriba workflows con tu modelo. No hay servicio alojado y no lo habrá. (El servidor MCP, que permite a un agente manejar Cascade desde fuera, está hecho: véase 1.1.0.)

## La nueva interfaz del editor

Construido, y en 1.0.0. El editor está reescrito en Astro con islas de Svelte, compilado a recursos estáticos e incrustado en el binario Go como el anterior, así que es la misma historia de un solo binario sin nada nuevo que ejecutar. Toma sus colores, su tipografía y su marca de los archivos de la marca HotLoop, y sigue el modo claro u oscuro del sistema. Tiene todas las pantallas del editor anterior y hacen lo que hacían (el código del lienzo pasó sin cambios), las funciones de 0.2.0 tienen sus pantallas, y una prueba de navegador maneja cada una contra el servidor real en un Chrome real. Nada de esto cambió la API, el formato de archivo ni la parte de Go.
