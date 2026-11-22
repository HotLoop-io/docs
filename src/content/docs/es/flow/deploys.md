---
title: "Cada despliegue deja un registro"
description: "Quién, cuándo, por qué y los bytes exactos de cada despliegue, comparados nodo a nodo en la API, la CLI y git, con una reversión que conserva las credenciales."
---

«Qué cambió, quién lo cambió, devuélvalo como estaba» es lo primero que pregunta cualquiera cuando una línea se detiene. Tres archivos `.bak` no responden nada de eso. No saben quién, se renuevan tras tres guardados, y el que necesita siempre es el cuarto.

Por eso cada despliegue escribe un registro inmutable en `data/deployments/`: quién lo desplegó (según su token, nunca según lo que afirme el cliente), desde dónde, cuándo, la nota que dejó, la revisión que reemplazó, el archivo de flujo byte por byte y las credenciales tal como quedaron tras el despliegue, cifradas exactamente igual que el archivo de credenciales. Los registros solo se añaden. El historial guarda los últimos 100 por defecto (`history.retain`, y 0 los conserva todos) y nunca elimina el más reciente, porque el más reciente es el que está en marcha.

```bash
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:1880/deployments
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:1880/deployments/42/flows > flows-42.json
```

La nota entra con el despliegue, como `"note"` en el documento envuelto (`{"rev": ..., "flows": [...], "note": "..."}`) o como cabecera `HotLoop-Flow-Deployment-Note`. La forma del documento existe porque un navegador no pone nada fuera de Latin-1 en una cabecera, y la gente escribe las notas en su propio idioma.

Hace dos cosas que solo echaría de menos cuando le hicieran falta:

- **Se detecta una edición a mano.** Si el archivo de flujo en disco no es lo último que registró el historial, porque alguien lo editó mientras el proceso estaba parado, el arranque lo registra como una entrada `baseline` que lo dice. Lo mismo en el primer arranque con un archivo de flujo ya presente. Si no, una edición a mano se convierte en silencio en un pasado que nadie anotó.
- **Un historial que no se puede escribir no detiene la línea.** El archivo de flujo ya está guardado en ese punto, así que rechazar el despliegue dejaría el disco y los flujos en marcha en desacuerdo hasta el siguiente reinicio. El despliegue sigue adelante, y la respuesta y el historial dicen, con palabras, que este no tiene registro.

La API nunca entrega las credenciales de un registro, cifradas o no. Se guardan para un solo trabajo, devolverlas a su sitio, y un endpoint de historial no es una forma de llevárselas.

## La comparación se lee como una revisión

Una comparación línea a línea de un archivo de flujo es honesta e inútil. Si arrastra un nodo veinte píxeles, es un cambio. Si cambia un umbral, es un cambio. El revisor no puede saber cuál de los dos está a punto de parar una prensa. Por eso Flow compara nodo a nodo:

```
1 changed, 2 moved

Tab "Line 3" (t1)
  ~ switch "Pressure check" (sw1)
      rules[1].v: "7.5" -> "8.0"
      wire added: port 1 -> change "set alarm" (alarm1)

Moved on the canvas only
  mqtt in "press 01" (in1)
  debug "ok" (ok1)
```

Añadidos, eliminados y modificados, propiedad por propiedad con el valor anterior y el nuevo, qué cables se movieron por puerto de salida, y **el diseño separado de la lógica**: mover, cambiar el tamaño u ocultar una etiqueta es «movido en el lienzo», nunca un cambio, de modo que un reordenado se lee como un reordenado. Una credencial se lee como «establecida» o «modificada», nunca con su valor. Las ediciones dentro de un subflujo aparecen en el subflujo, y arrastrar uno de sus puertos también es diseño.

La misma respuesta en todas partes, desde un solo paquete del motor:

- `GET /deployments/{from}/diff/{to}` compara dos despliegues.
- `POST /flows/diff` compara lo que está en marcha con un documento que nadie ha desplegado todavía, que es lo que se mira antes de pulsar desplegar.
- `hotloop-flow diff old.json new.json` en la línea de comandos. `-json` para un programa. Sale con 1 cuando algo difiere, como `diff`.
- **Dentro de git.** Conviértalo en el controlador de diff de git para archivos de flujo, y `git diff`, `git log -p` y `git show` imprimen la comparación semántica en lugar de un bloque JSON:

  ```bash
  git config diff.hotloop-flow.command 'hotloop-flow diff'
  echo 'flows.json diff=hotloop-flow' >> .gitattributes
  ```

  O como difftool: `git config difftool.hotloop-flow.cmd 'hotloop-flow diff "$LOCAL" "$REMOTE"'`, y después `git difftool -t hotloop-flow`.

Un flujo comparado consigo mismo no es ningún cambio, para cualquier documento que el analizador acepte.

## Devolverlo a como estaba

```bash
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "HotLoop-Flow-Deployment-Rev: $CURRENT_REV" \
  -d '{"note":"42 broke the label printer"}' \
  http://localhost:1880/deployments/41/rollback
```

Una reversión vuelve a desplegar un registro antiguo **como un registro nuevo**. El historial sigue siendo de solo añadir: el despliegue 41 no se toca, y la reversión es su propia entrada que dice «reversión al despliegue 41», quién la hizo y por qué. El archivo de flujo vuelve byte por byte, así que es la misma revisión de entonces.

**Las credenciales también vuelven.** Cada registro las lleva tal como estaban, así que un nodo que borró regresa con la contraseña de su broker en lugar de regresar y fallar al iniciar sesión. Eso está probado contra un Mosquitto real que rechaza clientes anónimos: borre el suscriptor, despliegue, revierta, y vuelve a iniciar sesión y los mensajes fluyen.

Se niega de tres maneras, antes de escribir nada. Un `HotLoop-Flow-Deployment-Rev` obsoleto recibe el mismo 409 que recibiría un despliegue, porque una reversión que compite con el despliegue de otra persona sigue siendo una carrera. Un despliegue que la retención ya eliminó es un 404. Y un registro cuyas credenciales no se pueden descifrar con el secreto de credenciales actual es un 422, porque unos flujos que no pueden iniciar sesión en nada son una reversión que solo lo parece.

## En el editor

**Deploy no despliega.** Abre una revisión: la comparación del motor con lo que está en marcha, dibujada en el lienzo y listada con palabras, con un cuadro para la nota. El verde es añadido, el ámbar es modificado, el azul es solo movido, y fantasmas rojos ocupan el sitio donde estaban los nodos y cables eliminados. Una pestaña con algo cambiado recibe un punto. El segundo botón Deploy es el que despliega, y la nota va al historial. Si edita cualquier cosa con la revisión abierta, esta se cierra, porque una revisión de algo que ya cambió es una mentira sobre lo que está a punto de enviar.

**El panel de historial** lista cada despliegue con quién, cuándo y la nota. *Changes* abre ese despliegue en un lienzo de solo lectura con lo que cambió dibujado encima, sobre su copia de trabajo, que queda exactamente como la dejó. *Roll back* pregunta por qué, le avisa si está a punto de perder ediciones sin guardar, y lo despliega.

**Un conflicto de despliegue muestra lo que hizo la otra persona.** Antes era un `confirm()` del navegador que le pedía sobrescribir lo de la otra persona o perder lo suyo sin decir qué era lo de ella. Ahora dice quién desplegó, cuándo, su nota y su cambio nodo a nodo, y luego le deja cargar lo suyo, sobrescribir con lo suyo o seguir editando.

**Copiar, cortar y pegar funcionan como espera, y hablan el archivo de flujo.** Seleccione nodos, Ctrl+C, y lo que hay en su portapapeles es el mismo JSON que lee cualquier otra herramienta de flujos, así que puede pegarlo en un chat, un ticket u otra máquina. Pegar lo coloca donde está el puntero, con ids nuevos cada vez, de modo que pegar dos veces da dos copias y nunca una colisión. Un cable hacia algo que no copió se corta en lugar de quedar apuntando a la nada, y un nodo de configuración que usan los nodos viene con ellos. Si ese nodo de configuración ya está en el flujo donde pega, la copia lo comparte en lugar de abrir una segunda conexión con algo que las cuenta. Las credenciales nunca van al portapapeles. Una contraseña en un búfer de pegado es como acaba en un informe de error.

**Import y Export** hacen lo mismo para una selección, un flujo o todo, con un cuadro para copiar, un botón Download y un selector de archivos al importar. La basura recibe un motivo («el id a aparece dos veces», «la entrada 1 no tiene id») y el diálogo sigue abierto. Un tipo de nodo que este runtime no tiene entra en gris y con trazo discontinuo, y la importación le dice cuáles, porque un nodo descartado en silencio es peor que uno ruidoso.

Una pantalla forma parte de ese archivo. El panel de control que dibuja un flujo (`ui_tab`, `ui_group` y los widgets) son nodos del flujo, así que las pantallas de un cliente viajan con sus flujos por Export e Import, y ninguna vive dentro de HotLoop Flow.

**Los subflujos se editan en su propio lienzo.** Pulse *+ subflow* y se abre con sus puertos de entrada y salida. Conéctelos a los nodos de dentro como cualquier otra cosa. *Subflow properties* fija el nombre, el color, cuántas salidas tiene y las propiedades que puede definir una instancia. Las instancias en los flujos acompañan cuando cambia la forma, y la paleta lista todos los subflujos para que suelte uno. Haga doble clic en una instancia para darle su propio nombre y su propio valor para cada propiedad. Un subflujo no puede colocarse dentro de sí mismo ni dentro de uno que lo contiene, y uno que aún está en uso no puede borrarse. El editor lo dice en lugar de dejar que lo descubra el siguiente despliegue.

**De la selección a un subflujo.** Seleccione nodos y pulse *Selection to subflow*. Pasan a un subflujo propio y una instancia ocupa su lugar. Cada cable que cruzaba el borde de la selección se convierte en un puerto: la única vía de entrada es la entrada del subflujo, y cada salida de un nodo seleccionado que iba a otra parte es una salida del subflujo, de modo que el flujo hace lo que hacía. Un subflujo tiene una entrada, así que si la selección está conectada a dos nodos distintos lo dice y no cambia nada, porque alimentar a ambos desde ambos sería otro flujo distinto. Seleccione un grupo y viene con todo lo que contiene. Un nodo de configuración que pertenece al flujo y que solo usa la selección pasa al subflujo con ella, junto con aquello a lo que apunta. Uno que también usa algo que se quedó fuera pasa a ser global, para que ambos extremos sigan compartiendo la misma conexión, porque una segunda conexión a un broker en una máquina que las cuenta es el tipo de sorpresa que no publicamos. Las variables de entorno que leen los nodos movidos (de tipo env, como `${NAME}` o `$(NAME)` en una cadena, o `env.get`) y que el flujo declara pasan a ser propiedades del subflujo que reenvían al flujo, de modo que el valor sigue viniendo de donde venía y la instancia puede sobrescribirlo. Ctrl+Z deshace todo.

**Flujos.** Haga doble clic en una pestaña, o pulse *Flow properties*, para renombrarla o eliminarla. Eliminar pregunta, se lleva todos los nodos del flujo, y corta los cables y enlaces que otros flujos tenían hacia él para que el archivo no quede apuntando a la nada. También quita los nodos eliminados de cualquier ámbito de Catch, Status o Complete que los nombrara. Un Catch o un Status cuya lista entera se eliminó conserva su último id, porque una lista vacía significa todo el flujo y no vamos a pasar un nodo de vigilar una cosa a vigilar todo a sus espaldas. Ctrl+Z lo recupera hasta que despliegue. El último flujo no se puede eliminar, porque un runtime sin flujo no tiene dónde poner un nodo.

**Los nodos de configuración** están en la paleta bajo *configuration*. No están en ningún lienzo, así que haga doble clic en el tipo, rellene el diálogo, y se añade a la lista bajo *configuration in use*, donde un doble clic lo edita y la cruz lo elimina. Uno que aún usa un nodo no se elimina, y dice cuántos lo usan. Ahí es adonde le lleva «Add one from the palette first» en el diálogo de un nodo.

**Eliminar un cable.** Alt y clic. Un clic normal no hace nada, así que rozar un cable al seleccionar no puede romper un flujo. Ctrl+Z lo devuelve.

**Cables duraderos.** Haga doble clic en un cable. Marque *Durable* y se dibuja más grueso y azul, y el nodo del que sale recibe `ew_durable` en el archivo. La marca está en el par de nodos, así que vale para todos los cables entre ellos. Es cableado hacia el runtime, así que marcar uno nunca reinicia el nodo.

**Grupos.** Ctrl+G envuelve la selección, Ctrl+Shift+G la deshace. Haga doble clic en la barra de título para ponerle nombre y color. Arrastre un grupo y todo lo que contiene va con él. Arrastre un nodo a uno y se une, arrástrelo fuera y se va. Los grupos se anidan. Eliminar un grupo elimina lo que contiene, y Ctrl+Z lo devuelve todo.

**La búsqueda** (Ctrl+F, o el botón) mira en todos los flujos y subflujos a la vez: nombres, tipos, ids y cada ajuste, incluida una línea en medio del cuerpo de una función. Una coincidencia le lleva a la pestaña correcta con el nodo seleccionado y en el centro de la vista. Los nodos de configuración también aparecen, y su coincidencia abre su diálogo, ya que no tienen sitio en un lienzo.

**Filtrado de depuración.** Reduzca la barra lateral a un flujo, a los nodos que tiene seleccionados, a una palabra o solo a los errores. Se aplica a lo que ya está en el registro, no solo a lo que llegue después, así que acotar nunca hace desaparecer la línea que estaba mirando.

Todo eso se recorre con clics en un navegador real en cada pull request, contra el binario real con el editor integrado. Eso incluye todos los diálogos de nodo que ofrece el runtime: la lista sale de `GET /nodes`, así que un nodo añadido el mes que viene está en la prueba el mes que viene sin que nadie se acuerde de añadirlo. Al escribir esas pruebas encontramos dos cosas que nunca habían funcionado en Chromium: el doble clic en un nodo para abrir su diálogo y arrastrar un cable sobre un nodo. El lienzo retiene el puntero durante todo el arrastre, así que el objetivo del evento era siempre el lienzo y un cable soltado sobre un nodo nunca encontraba el nodo. Los dos, tan vergonzosos como pueden ser unos errores en un editor visual. Los dos corregidos.

## Flujos como código

El repositorio es donde se revisan los flujos, así que el repositorio debería poder desplegarlos. Guarde el archivo de flujo en git, configure el controlador de diff de arriba para que el pull request se lea como una revisión, y deje que la fusión lo despliegue:

```bash
hotloop-flow export -o flows.json          # the live file, byte for byte, to commit
hotloop-flow deploy -file flows.json -note "PR #12: line 3 pressure check"
```

`deploy` imprime la comparación con lo que está en marcha, el mismo texto que en todas partes, y después despliega contra la revisión a partir de la cual se hizo esa comparación. Si alguien despliega entre medias, es un 409 y un pipeline en rojo, no una sobrescritura silenciosa. `-expect-rev` lo fija a la revisión contra la que se hizo un plan revisado, y `-dry-run` imprime la comparación y no despliega nada. Un archivo sin nada que cambiar no despliega nada y no añade nada al historial, así que una fusión que no tocó los flujos no ensucia el registro. Un nodo que no arranca se despliega y aun así hace fallar el trabajo, porque el resto del flujo está en marcha y alguien tiene que mirarlo. `export -deployment 41` saca cualquier despliegue del historial.

**Un pipeline nunca guarda una contraseña de administrador.** Recibe un token de API:

```bash
hotloop-flow token -name ci
```

imprime un token, una sola vez, para el almacén de secretos de pipeline, y el hash que se entrega al runtime: `HOTLOOP_FLOW_DEPLOY_TOKEN_HASH` para un token de despliegue, o `auth.tokens` en el archivo de configuración para cualquier otro. El runtime solo guarda el hash, igual que con una contraseña. Un token de despliegue puede leer los flujos y desplegar, lo que incluye revertir, y nada más: ni ajustes, ni inject, ni editor. Ambos comandos leen el token de `HOTLOOP_FLOW_TOKEN` (o `-token-file`) y la instancia de `HOTLOOP_FLOW_URL` (o `-url`), nunca un token en la línea de comandos, donde acabaría en la lista de procesos y en cada log de pipeline que repita el comando. El historial muestra el token como quien desplegó, `token:ci`, con la nota que pasó el pipeline.

Las credenciales nunca viajan así. No están en el archivo de flujo, así que un despliegue desde git deja cada contraseña de broker exactamente donde estaba.

## Un espejo en git, si lo quiere

El registro de despliegues vive en la máquina. Un repositorio es donde ya mira todo el mundo: tiene vista web, blame, copias de seguridad y gente que sabe leerlo. Apunte Flow a uno y cada despliegue se convierte en un commit del archivo de flujo en una rama en la que solo escribe Flow, **con autoría de quien lo desplegó**, a la hora en que lo desplegó, con su nota como mensaje:

```yaml
history:
  git:
    url: https://git.plant.example/line3/flows.git
    branch: main              # one nobody else pushes to
    path: flows.json
    emailDomain: plant.example  # dana deploys, the commit is from dana@plant.example
```

La contraseña es un token de acceso del servidor git, y va en `HOTLOOP_FLOW_GIT_PASSWORD` desde un Secret, nunca en el archivo (`HOTLOOP_FLOW_GIT_URL` y `HOTLOOP_FLOW_GIT_USERNAME` también funcionan). Una URL con contraseña se rechaza al arrancar, de modo que la URL siempre se puede registrar en el log. Solo `http://` y `https://`: la imagen no tiene binario de git para `file://` ni claves para `ssh://`, y un espejo que falla en cada push es peor que uno que se niega a arrancar. Las reversiones y las bases de arranque dicen lo que son en el commit, y cada commit lleva un trailer `Flow-Deployment: N`, que es como un proceso reiniciado, o uno cuyo clon se borró, retoma exactamente por donde dice el repositorio que iba, sin duplicados.

**Nunca retrasa un despliegue.** El push ocurre en su propia goroutine. Un servidor git caído, lento o que rechaza el push no le cuesta nada a un despliegue: los commits esperan en un clon local bajo `data/git-mirror` y salen en el siguiente push que funcione, reintentado cada minuto. `GET /deployments` dice hasta dónde llegó el espejo y el último error, y `hotloop_flow_git_mirror_behind_deployments` es el número sobre el que alertar. Probado contra el servidor smart-HTTP propio de git tras autenticación básica: tres despliegues hacen tres commits de tres autores, un push que el servidor rechaza espera y se pone al día cuando deja de rechazarlo, y un despliegue con un servidor git que tarda diez segundos en decir que no vuelve en milisegundos.

Es Go puro (go-git), así que el binario sigue siendo estático. Cuesta unos 3.8 MB de binario, por lo que se mide y no se da por supuesto. El binario pesaba 48,083,106 bytes antes de los catálogos.
