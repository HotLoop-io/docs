---
title: "Notas de versión: HotLoop Flow 2.5.0"
description: "Qué trae HotLoop Flow 2.5.0, qué cambia al actualizar y qué conviene leer antes de tocar una planta en marcha."
sidebar:
  label: "2.5.0"
---

HotLoop Flow 2.5.0 es un editor nuevo. Los mismos flujos, el mismo motor, los mismos atajos, y por fin parece que pertenece junto al resto de HotLoop en lugar de venir de otra empresa. Si conecta plantas para ganarse la vida, lo que obtiene es una pantalla que encaja con lo que hace todo el día: poner la pieza en el lienzo, desplegarla y verla funcionar.

## Novedades

**El editor se ve como HotLoop.** Los mismos colores, la misma tipografía, claro y oscuro según su sistema, con un botón en la barra superior para cuando quiera el otro. El naranja significa "puede hacer clic aquí" y nada más. No significa una advertencia, una selección ni un camino que siguió un mensaje.

**La depuración y el runtime pasaron bajo el lienzo.** El registro de depuración y la tabla Runtime están ahora en un dock a lo largo de la parte inferior, uno junto al otro, de modo que una línea de depuración recibe todo el ancho del lienzo en lugar de una columna estrecha donde cada payload se partía cuatro veces. La tabla Runtime de al lado sigue contando lo que entró y salió de cada nodo, con una barra que muestra cuán llena está cada cola. Lo que eso significa para usted: ve llegar una lectura y el nodo del que vino sin desplazarse ni entrecerrar los ojos.

**Historial, Pruebas y Trazado se quedan a la derecha.** Aquel en el que está trabajando sube arriba. Pulse Desplegar y la revisión es lo primero de esa columna, con el cuadro de nota debajo. Haga clic en Trazado en una línea de depuración y el trazado ocupa el primer lugar.

**Un trazado ahora es azul.** El camino que siguió un mensaje se dibuja en azul sobre el lienzo, con el tiempo que pasó en cada nodo. La revisión previa a un despliegue marca los nodos añadidos, cambiados, movidos y eliminados en verde, ámbar, azul y rojo. Lo que eso significa para usted: ahora distingue de un vistazo un trazado de una selección, porque dejaron de compartir color.

**Un inicio de sesión que se ve como el resto de HotLoop.** Una tarjeta, el logotipo real y los mismos campos. Tras el panel EmberCORE sigue indicando que entre por el panel.

**La búsqueda muestra su atajo.** El botón dice Ctrl F, para que no tenga que adivinarlo.

**Un doble clic justo después de una edición ya funciona.** El editor comprueba los tipos de sus conexiones un momento después de cada edición, y antes volvía a dibujar todas las conexiones aunque la respuesta no hubiera cambiado, así que un doble clic en un nodo podía dar en una conexión que se estaba sustituyendo en pleno clic y no hacer nada. Ahora solo redibuja cuando algo cambia de verdad.

## Qué cambió

Nada sobre sus flujos. Un archivo de flujos se carga y se guarda byte por byte, exactamente como antes. Conectar, arrastrar, deshacer, copiar y pegar, Ctrl+Enter, Escape, empujar con las teclas de flecha, el zoom, la selección por recuadro y arrastrar desde la paleta funcionan como antes, y cada una de las 60 pruebas del navegador pasa sin tocar una línea. También recorrimos cada pantalla y cada diálogo en la 2.4.0 y en esta compilación con el mismo flujo de planta, 48 estados, y no faltó nada.

Cosas que se ven distintas a propósito: los paneles de depuración y runtime pasaron al dock, el mensaje vacío del panel Pruebas ahora dice "dock de depuración" porque ahí está el registro, un trazado y una revisión se dibujan en azul y en los colores de estado, el botón de tema dice Oscuro o Claro, y la búsqueda muestra su atajo.

**Una cosa es más lenta, y preferimos decirlo antes de que la descubra.** La página queda en blanco un instante hasta que el editor se ha cargado, mientras que el anterior pintaba primero su marco. Lo medimos con la caché del navegador desactivada, desde la petición de la página de inicio de sesión hasta el formulario en pantalla. En esta máquina son unos 12 ms más. Con un enlace de 20 Mbps son unos 100 ms más (230 ms pasaron a 335 ms), y con un enlace de 1,6 Mbps y 150 ms de latencia son aproximadamente medio segundo más (1,46 s pasaron a 1,96 s). En una LAN de planta son unos pocos milisegundos. En un mal enlace verá una página blanca un instante, y luego el editor. Es un coste único por carga de página, no por clic.

## Ajustes nuevos

Ninguna. No hay nada que activar, y nada aquí tiene un interruptor para desactivarlo.

## Actualización

Un simple `helm upgrade` a la imagen y el chart de la 2.5.0, o la nueva etiqueta en su unidad Quadlet. No pasa nada en el primer arranque, no hay nada que migrar, y los flujos, los registros de despliegue y las credenciales no se tocan. Recargue la pestaña del editor una vez después de que se reinicie el pod para que su navegador deje de mostrar el antiguo.

## Licencias

El editor incluye ahora dos tipografías, Inter y JetBrains Mono, bajo la SIL Open Font License 1.1. Sus licencias están en `/usr/share/doc/hotloop-flow/THIRD_PARTY_LICENSES` con las demás, y `NOTICE` explica cómo se genera ese archivo.

Imagen: `ghcr.io/hotloop-io/hotloop-flow:2.5.0`, linux/amd64 y linux/arm64. Chart: `https://hotloop.io/hotloop-flow/`. El README de esta etiqueta tiene el resto, con imágenes: https://github.com/HotLoop-io/hotloop-flow/blob/v2.5.0/README.md
