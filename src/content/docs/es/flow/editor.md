---
title: "El editor de HotLoop Flow"
description: "El editor de Flow en claro y oscuro: el lienzo, la revisión antes de desplegar, un mensaje rastreado y el inicio de sesión."
---

Sigue su sistema, claro u oscuro, y cada imagen de abajo se muestra de las dos maneras, primero la clara. Todas las imágenes de abajo salen de `web/shots/screenshots.sh`, que arranca el binario real y un navegador real, así que se vuelven a tomar cuando cambia el editor y no pueden derivar en una maqueta. La planta del lienzo es una línea de hornos con dos despliegues detrás.

## Cablear, ejecutar, vigilar

![El editor en una línea de hornos: el lienzo, el historial de despliegues y los paneles de depuración y de ejecución](/synced/flow/docs/screenshots/editor.png)
![Lo mismo, en oscuro](/synced/flow/docs/screenshots/editor-dark.png)

El lienzo es lo que está funcionando. El panel de depuración de debajo imprime lo que ven sus nodos de depuración, y la tabla Runtime de al lado cuenta lo que entró y salió de cada nodo, con una barra que indica cuán llena está su cola. Cuando una línea se porta mal, lo lee en la pantalla en vez de ponerse a escarbar en un registro.

## Revíselo antes de que llegue a la línea

![El panel de revisión con un nodo modificado y un cuadro de nota, junto al lienzo con ese nodo resaltado](/synced/flow/docs/screenshots/review.png)
![Lo mismo, en oscuro](/synced/flow/docs/screenshots/review-dark.png)

Desplegar no despliega. Dibuja el cambio en el lienzo, lo escribe con palabras y le pide una nota. La nota queda en el historial junto a su nombre, de modo que quien reciba la llamada a las 2 de la madrugada pueda ver qué cambió y por qué.

## Siga un mensaje por los cables

![Un mensaje rastreado iluminado a lo largo del lienzo con el tiempo que le dedicó cada nodo, y el panel de depuración debajo](/synced/flow/docs/screenshots/debug.png)
![Lo mismo, en oscuro](/synced/flow/docs/screenshots/debug-dark.png)

Pulse Trace en una línea de depuración y el camino que siguió ese mensaje se ilumina en el lienzo, salto a salto, con lo que hizo cada nodo y cuánto tardó. Conviértalo en una prueba, o reprodúzcalo en un borrador, desde el mismo panel.

## Inicio de sesión

![La tarjeta de inicio de sesión](/synced/flow/docs/screenshots/signin.png)
![Lo mismo, en oscuro](/synced/flow/docs/screenshots/signin-dark.png)

![El aviso que muestra un runtime cuando el panel inicia la sesión de las personas y esta página se abrió de otra forma](/synced/flow/docs/screenshots/dashboard-signin.png)
![Lo mismo, en oscuro](/synced/flow/docs/screenshots/dashboard-signin-dark.png)

No arranca sin protección, así que lo primero que cualquiera ve es un inicio de sesión. Cuando el panel de EmberCORE inicia la sesión de las personas, un runtime abierto de cualquier otra forma les dice que entren por el panel en vez de pedirles una segunda contraseña.
