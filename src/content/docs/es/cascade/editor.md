---
title: "El editor de Cascade"
description: "El editor viene en el binario de Cascade: carpetas, un lienzo con ejecutar hasta aquí, ejecuciones paso a paso, credenciales, proyectos, usuarios y auditoría."
---

:::note[Incluye lo que viene]
Esta página también recoge algunas cosas más nuevas que HotLoop Cascade 1.4.2, la última versión publicada. Es posible que parte de ello no esté en lo que usted tiene instalado. Las [notas de la versión](/es/releases/) dicen qué ha cambiado.
:::

El editor está integrado en el binario, así que no hay nada más que ejecutar y no descarga nada de ningún sitio: abra la dirección en la que escucha el servidor e inicie sesión. Es una aplicación Astro con islas de Svelte, compilada a archivos estáticos al construir la imagen, con los mismos colores y tipografía que cualquier otra pantalla de HotLoop, en claro u oscuro según su sistema hasta que elija.

![Flujos de trabajo, en carpetas](/synced/cascade/docs/screenshots/workflows.png)

Los flujos de trabajo viven en proyectos, y los de un proyecto viven en carpetas que se anidan tan hondo como su planta: área, línea, celda. Un flujo de trabajo se mueve entre carpetas desde su propia fila.

![El lienzo, con un paso seleccionado y sus ajustes al lado](/synced/cascade/docs/screenshots/editor.png)
![Lo mismo, en oscuro](/synced/cascade/docs/screenshots/editor-dark.png)

El lienzo está donde siempre: arrastre de una salida a una entrada, mueva un paso, `Ctrl+S` para guardar, `Delete` para quitar un paso. Ejecutar hasta aquí ejecuta lo que hay en pantalla, sin guardar, hasta el paso que eligió y muestra lo que produjo como tabla, como campos o como JSON, y puede fijar esa salida para que el paso deje de ejecutarse mientras construye los siguientes. Cada campo admite una expresión y muestra a qué equivale con la última ejecución de prueba. Un guardado sobre el de otra persona se avisa, no se impone.

![Una ejecución fallida, dibujada tal como se ejecutó](/synced/cascade/docs/screenshots/run.png)

Una ejecución se dibuja con el resultado de cada paso. Reinténtela desde el paso que falló, desde cualquier paso, o depúrela en el editor frente a los cambios: los pasos anteriores al que vuelve a ejecutar conservan lo que hicieron, de modo que una escritura que ya ocurrió no ocurre dos veces. Una persona puede dejar un pulgar arriba o abajo, una nota y etiquetas en una ejecución después de los hechos, y la lista de ejecuciones encuentra ejecuciones por ellos.

![Ejecuciones, con lo que dijeron las personas sobre ellas](/synced/cascade/docs/screenshots/executions.png)
![Análisis de los últimos siete días](/synced/cascade/docs/screenshots/insights.png)
![Roles](/synced/cascade/docs/screenshots/roles.png)
![Políticas de redacción](/synced/cascade/docs/screenshots/redaction.png)

El resto del trabajo de gobernanza está en Ajustes: roles y quién los tiene, políticas de redacción (un flujo de trabajo elige una en sus ajustes, desde el editor), proveedores de secretos externos, envío de registros, e inicio de sesión y SCIM. Un propietario o administrador cambia esos ajustes; todos los demás leen lo que se les permite, nunca ven un botón que el servidor vaya a rechazar, y el servidor lo sigue rechazando.

Cuatro pantallas acompañan a los workflows. Las credenciales se crean, se abren, se cambian, se comparten con otros proyectos y se eliminan en su propio proyecto; un campo secreto se introduce una sola vez y la pantalla solo dice que está definido. Proyectos recoge quién está en cada uno y con qué rol, y las claves de cuenta de servicio con las que inicia sesión una integración permanente. Su cuenta (la dirección de la barra superior) crea y revoca sus claves de API, con las que inician sesión la API REST y el servidor MCP, y cambia su contraseña. Para propietarios y administradores, Ajustes tiene los ajustes generales (segundo factor, el workflow de error), Usuarios crea personas, las desactiva y deja que un propietario elimine a una (sus inicios de sesión y claves desaparecen, sus workflows se quedan), y el registro de auditoría se lee, se filtra y se comprueba contra manipulaciones ahí. El inicio de sesión es el mismo editor, en `/login`, y mantiene el inicio de sesión único, el inicio de sesión con directorio, las passkeys y los códigos de recuperación.

![Credenciales, sin mostrar nunca el secreto](/synced/cascade/docs/screenshots/credentials.png)
![Proyectos y quién está en uno](/synced/cascade/docs/screenshots/projects.png)
![El registro de auditoría y la comprobación de que está íntegro](/synced/cascade/docs/screenshots/audit.png)
![Su cuenta y sus claves de API](/synced/cascade/docs/screenshots/account.png)

Qué significa esto para usted: todo lo que Cascade puede hacer lo puede hacer desde esta pantalla, en un equipo de planta sin internet, sin una sola línea de curl.

El editor habla el idioma de quien lo tiene delante. El selector de la barra superior (y de la página de inicio de sesión) lista cada idioma con su propio nombre, recuerda la elección en ese navegador y arranca en el idioma de su navegador la primera vez. Los títulos de los pasos y su ayuda, los tipos de credencial, los botones, los rechazos que envía el servidor, las fechas, los números y las duraciones salen en el idioma elegido, y el árabe va de derecha a izquierda, con el lienzo del flujo de trabajo dibujado aún de izquierda a derecha como para todos. Un idioma solo se ofrece cuando está cada palabra: `web/src/i18n/check.mjs` hace fallar la compilación cuando le falta una línea, un marcador de posición o una forma plural, y `web/scripts/i18n-scan.mjs` la hace fallar con el texto escrito directamente en una pantalla. Las palabras viven en `web/src/i18n/locales/<language>/`, y una prueba de Go comprueba contra ellas cada tipo de paso o rechazo nuevo del servidor. La propia salida de una ejecución, y todo lo que dijo un programa al que llamó un paso, se muestra tal como se registró.

Qué significa esto para usted: sus operadores leen la pantalla en su propio idioma, y una pantalla nueva no puede salir con una línea en inglés que nadie tradujo.
