---
title: "Notas de versión: HotLoop Flow 2.7.0"
description: "Qué trae HotLoop Flow 2.7.0, qué cambia al actualizar y qué conviene leer antes de tocar una planta en marcha."
sidebar:
  label: "2.7.0"
---

HotLoop Flow 2.7.0 es el primer corte de FlowLab, una segunda forma de ejecutar una pestaña para bancos de pruebas y registradores de datos. Los flujos se ejecutan exactamente como antes, y un archivo de flujos que tiene hoy se carga y se guarda byte por byte. FlowLab solo arranca cuando le añade una pestaña, así que si no lo hace, lo único que cambia para usted es la corrección de sesiones, el último elemento de abajo.

## Novedades

**Diagramas de FlowLab.** Un diagrama es una pestaña donde cada nodo se ejecuta una vez, cuando cada entrada conectada tiene un valor, y dos nodos sin conexión entre ellos se ejecutan al mismo tiempo. Añada uno con el nuevo botón FlowLab junto al botón de subflujo. Recibe una barra sobre el lienzo con Ejecutar y Detener, y todo lo que dibuja está en las conexiones: el último valor de cada conexión tras una ejecución, una sonda en cualquier conexión que conserva los últimos 100 valores y un punto de interrupción en un nodo o una conexión. Pausa, entrar, saltar y salir funcionan nodo a nodo, y resaltar la ejecución la ralentiza lo suficiente para seguirla y se desactiva solo a los diez minutos. Nada de la depuración cambia lo que hace una ejecución, y una prueba comprueba que una ejecución con una sonda termina con el mismo valor en cada conexión que una sin ella.

**Qué hay en la caja.** Bucles while y for con valores que pasan de una vuelta a la siguiente, un bucle for sobre un recuento o una matriz, y una conexión de error: un nodo que recibe un error no hace nada y lo pasa, y un error conectado a un bucle lo detiene con el origen y un código en la salida de error del bucle. Una conexión `after` fija el orden de dos nodos que no comparten datos. Hay 21 tipos de nodo en la nueva sección FlowLab de la paleta: constante, matemáticas, comparar, lógica, esperar, agrupar, campo, construir matriz, los dos bucles con su entrada y salida del cuerpo, un puerto serie con lectura y escritura, un analizador de lecturas, un detector de valor estable, un registro en un archivo de texto, y un control, un indicador y un gráfico para el panel. docs/diagrams.md tiene cada uno.

**Un panel que un operador puede abrir en el teléfono.** `/panel/<diagram id>` inicia sesión como el editor y muestra los controles, indicadores y gráficos del diagrama mientras una ejecución está activa. Un gráfico conserva los últimos 1.024 puntos salvo que lo cambie y cuenta los que dejó pasar. Un control se comprueba en el servidor contra su tipo, rango y opciones, y quién lo fijó queda en el registro de auditoría.

**Un puerto serie que sobrevive a un cable desenchufado.** Una lectura que no recibe nada, o un puerto que desaparece, es un fallo en la conexión de error. La siguiente lectura intenta abrir el puerto de nuevo una vez por segundo, y cuenta la pérdida y la vuelta. El ejemplo de `examples/diagram-scale-logger` lee una báscula, analiza el peso y la unidad, avisa cuando las últimas cinco lecturas coinciden, lo muestra todo en el panel con un gráfico de tendencia y lo añade a un archivo CSV. Active `autostart` en la pestaña y se ejecuta sin ningún navegador abierto, y de nuevo tras cada despliegue.

**API nueva.** `GET /diagrams`, `GET /diagrams/{id}` y `POST` para `run`, `stop` y `debug`, `PUT` para `controls/{node}`, `breakpoints` y `probes`. Leer requiere `status.read`. Ejecutar, detener, fijar un control y depurar requieren un permiso nuevo, `diagram.run`, y cada uno queda en el registro de auditoría con quién lo hizo.

**Un archivo de sesiones ilegible ya no se sobrescribe.** Un archivo de sesiones que existe pero no se puede leer, un error de E/S o un volumen que apareció tarde, ya no es sustituido por el siguiente inicio de sesión, y un archivo con JSON ilegible se conserva junto al original en lugar de perderse.

## Qué cambió

- Una pestaña que lleva `ew_diagram` queda fuera del runtime de mensajes. Todas las demás pestañas se ejecutan como antes. Las claves nuevas son `ew_diagram` en la pestaña y `ew_in` en un nodo, y ambas sobreviven al viaje de ida y vuelta, que comprueban dos pruebas nuevas y la antigua.
- El README contaba 79 tipos de nodo y "unas 36.000 líneas de Go", y ambas cifras estaban desfasadas. Ahora dice 79 tipos de nodo para mensajes y 21 para FlowLab.
- La prueba del nodo cliente MCP de HotLoop ahora escribe a través de la puerta de HotLoop, porque HotLoop incluye sus escrituras MCP activadas.
- Un despliegue reinicia la ejecución de cada diagrama, incluso de uno que no cambió.
- FlowLab añadió unos 370 KB al binario, medidos en una máquina antes y después. El binario pesa 41,4 MB y la imagen amd64, 45,34 MB.
- Las imágenes del README se tomaron de nuevo para el botón nuevo y la sección nueva de la paleta.

## Ajustes nuevos

Ninguna. El permiso `diagram.run` es nuevo. Un usuario cuya lista de permisos es `["*"]` lo tiene. Quien tiene una lista explícita puede leer un diagrama y su panel con `status.read` y no puede ejecutar uno hasta que añada `diagram.run`.

## Actualización

En amd64, un simple `helm upgrade` a la imagen y el chart de la 2.7.0; en arm64, quédese donde está hasta la 2.7.1, o use la nueva etiqueta en su unidad Quadlet. No pasa nada en el primer arranque, no hay nada que migrar, y sus flujos, registros de despliegue y credenciales no se tocan. Si vuelve atrás después de guardar un archivo de flujos con un diagrama, la compilación anterior conserva el archivo byte por byte y dice `unknown node type` por cada nodo de FlowLab, que entonces no se ejecutan. Lo comprobamos contra la compilación anterior a esta.

Imagen: `ghcr.io/hotloop-io/hotloop-flow:2.7.0`, solo linux/amd64. Construimos primero amd64, dejamos que se lea como estable en producción y después una pequeña 2.7.1 sin nada más añade arm64. Hasta entonces, la etiqueta `2` contiene la nueva imagen amd64 y la imagen arm64 de la 2.6.0, así que una máquina en arm64 que siga `2` o `2.6` conserva lo que tiene, y una máquina fijada a `2.7.0` necesita amd64. Chart: `https://hotloop.io/hotloop-flow/`. El README de esta etiqueta tiene el resto, con imágenes: https://github.com/HotLoop-io/hotloop-flow/blob/v2.7.0/README.md
