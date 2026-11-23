---
title: "Notas de versión: HotLoop Flow 2.9.0"
description: "Qué trae HotLoop Flow 2.9.0, qué cambia al actualizar y qué conviene leer antes de tocar una planta en marcha."
sidebar:
  label: "2.9.0"
---

HotLoop Flow 2.9.0 añade nodos conectores nativos para la migración de una planta real. Ejecuta los nodos de Node-RED en los que se apoyan los flows de una planta, Modbus, el panel, PostgreSQL y correo electrónico, además de `Buffer` y `setInterval`, que llaman las funciones que los rodean. Un flow capturado de un equipo con Node-RED que los usa se carga, se ejecuta y se guarda sin cambios. También permite que un solo Flow mantenga una pestaña por cada máquina en un equipo cuyo único puerto lleva una VLAN para cada una, incluso cuando todas las VLAN tienen la misma subred y las mismas direcciones de dispositivo.

## Novedades

- **Modbus de Node-RED.** `modbus-client`, `modbus-read`, `modbus-getter`, `modbus-flex-getter`, `modbus-write`, `modbus-flex-write`, `modbus-server` y el pasivo `modbustcp-server`. La salida es la que envían los nodos de la comunidad: `msg.payload` como la lista de valores, `msg.responseBuffer` como `{data, buffer}`, `msg.input` y los errores por la segunda salida.
- **El panel.** `ui_base`, `ui_tab`, `ui_group`, `ui_link`, `ui_spacer`, `ui_text`, `ui_numeric`, `ui_button`, `ui_switch`, `ui_text_input`, `ui_led`, `ui_gauge`, `ui_chart` y `ui_template`, servidos en `/ui` desde el binario, sin descargar nada de fuera de la planta. Lo que un operador hace en la página sale del nodo como un mensaje. `ui_template` ejecuta el subconjunto al estilo AngularJS que usan las plantas: `{{ }}`, `ng-click`, `ng-class`, `ng-init`, `ng-show`, `ng-hide`, `ng-if`, `ng-bind`, `scope.$watch`, `scope.send`.
- **PostgreSQL.** `postgreSQLConfig` y `postgresql`. La conexión se abre en la primera consulta, así que una base de datos que todavía no está en marcha no detiene el flow.
- **Correo electrónico.** El nodo de salida `e-mail` sobre SMTP, con STARTTLS, un interruptor de certificado y XOAUTH2.
- **`Buffer`, `setInterval` y `setTimeout` en el nodo de función.** Los temporizadores funcionan con el reloj del nodo, cada devolución de llamada tiene el mismo límite de CPU que un mensaje, y todos los temporizadores se detienen cuando el flow se detiene o se vuelve a desplegar.
- **Una interfaz de red para cada cliente.** Un nodo, una pestaña o una configuración de cliente puede indicar la interfaz a la que se enlazan sus conexiones (`SO_BINDTODEVICE`), así que una pestaña para la secadora 14 llega solo al `192.168.1.5` de la VLAN 14. En la pestaña se hace con la variable de entorno `FLOW_NETWORK_INTERFACE`, que heredan todos los nodos cliente de ella. Está en los nodos Modbus, PostgreSQL, correo electrónico, solicitud TCP, salida UDP y solicitud HTTP.

El README tiene una sección nueva, `docs/node-red-types.md` explica qué se ejecuta y en qué se diferencia, y `docs/compatibility.md` se regenera a partir del registro.

## Qué cambió

- El nodo de función tenía `Buffer`, `setTimeout` y `setInterval` ausentes a propósito, y dos pruebas lo fijaban. Ahora están presentes, porque las funciones de una planta los usan. Nada más del entorno aislado cambió: sigue sin haber `require`, ni `process`, ni la biblioteca estándar de Node.
- Con el gancho sin configurar se comporta como el original. NOTICE y `HOTLOOP_PATCH.txt` dicen qué cambió.
- El motivo son los nodos conectores nativos de Node-RED para la migración de una planta real.

## Ajustes nuevos

- `HOTLOOP_FLOW_UI_PATH`, por defecto `/ui`: dónde se sirve el panel.
- `FLOW_NETWORK_INTERFACE`, una variable de entorno de pestaña, subflujo o proceso: la interfaz a la que se asocian los clientes de esa pestaña. Vacía por defecto, lo que deja elegir al host, como antes.
- Un campo **Interfaz de red** en cada nodo cliente y configuración.
- Valor del chart `bindToInterface.netRaw`, por defecto `false`. Asociar un socket a una interfaz no requiere ninguna capacidad en Linux 5.7 y posteriores. En un kernel anterior requiere `CAP_NET_RAW`, y ponerlo en `true` añade esa única capacidad al pod y nada más. El pod también necesita la red del host (`network.mode: host`) para ver una interfaz VLAN.

## Actualización

Un simple `helm upgrade` a la imagen y el chart 2.9.0, o la nueva etiqueta en su unidad Quadlet. Al primer arranque no ocurre nada, no hay nada que migrar, y un flow que no usaba ninguno de los tipos nuevos funciona como antes. Un flow que ya tiene estos tipos (un archivo de Node-RED capturado) ahora los arranca, donde antes informaba de cada uno como un tipo de nodo desconocido.

## Un cambio en NOTICE y las licencias

NOTICE incorpora la entrada de la biblioteca Modbus, que ahora es una copia modificada. No hay ningún módulo de terceros nuevo en la imagen.

Imagen: `ghcr.io/hotloop-io/hotloop-flow:2.9.0`, primero linux/amd64, con arm64 a continuación en la 2.9.1. Chart: `https://hotloop.io/hotloop-flow/`. El README de esta etiqueta tiene el resto, con imágenes: https://github.com/HotLoop-io/hotloop-flow/blob/v2.9.0/README.md
