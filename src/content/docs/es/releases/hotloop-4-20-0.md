---
title: "Notas de versión: HotLoop core 4.20.0"
description: "Qué trae HotLoop core 4.20.0, qué cambia al actualizar y qué leer antes de tocar una planta en marcha."
sidebar:
  label: "4.20.0"
---

La nueva interfaz web es ahora la que está en `/`, y un agente puede cambiar todo lo que puede leer a través de MCP. No hay migraciones, y un `helm upgrade` normal o la actualización automática de Quadlet la toma. La versión anterior, la [4.19.11](/es/releases/hotloop-4-19-11/), es la última cuyas pantallas por defecto eran las antiguas.

Esta compilación es solo amd64, y la siguiente versión es un pequeño aumento de versión que construye las imágenes arm, como van las dos tandas. Mientras tanto, `stable` conserva las imágenes arm que tiene.

## Qué cambió

- **La nueva interfaz web es la predeterminada y la antigua ha desaparecido.** Cada pantalla se reconstruyó como una página estática (Astro, con partes en Svelte), incrustada en el único binario, sin Node en el equipo y sin CDN. Estuvo en `/next` durante la 4.19.x. En `/` son las mismas diecinueve pantallas con los mismos controles, campos, columnas, formularios y palabras, para el visor, el operador y el administrador. Lo que se ve distinto, a propósito:
  - Los colores son el fondo cálido y el naranja de HotLoop, los mismos que el sitio, Flow y Cascade, y la marca es la oficial.
  - Las pantallas se agrupan en Operate, Plant, Build y System en un carril sobre un escritorio. En un teléfono hay una barra de cinco (Board, Alarms, Dashboards, Entities, More), y More abre todas las pantallas.
  - El control de tema dice Dark o Light, donde antes mostraba una luna.
  - Los iconos de la aplicación instalada, el color del tema y el color de la pantalla de inicio siguen el nuevo aspecto.
  - Un cajón reserva sitio para su barra de desplazamiento, así que una tarjeta dentro no se mueve cuando carga su historial.
- **Iniciar sesión con HotLoop inalcanzable dice por qué y se recupera solo.** Un teléfono que nunca inició sesión, o la cerró, y abre la página sin conexión recibe la pantalla de inicio de sesión con una frase que dice que HotLoop no responde desde aquí. La página vuelve a preguntar cada tres segundos, y cuando vuelve la conexión se recarga sin tocar nada. Es el comportamiento antiguo, conservado.
- **MCP puede cambiar todo lo que puede leer.** Había veintisiete herramientas que leían la planta y ordenaban a los equipos; ahora hay 128. Sesenta y cuatro más cambian la configuración: dispositivos y tags, descubrimiento y brokers, redes UniFi, entidades, helpers, equipos y etiquetas, alarmas, automatizaciones y blueprints (un agente ahora puede crear la regla a partir de un blueprint, que antes solo podía previsualizar), scripts, recetas, paneles y el resto de lo que una pantalla puede guardar. Treinta y siete llegan a las funciones propias del administrador: usuarios y PINs, ajustes, copias de seguridad, escalado, destinos de historian, logins del broker, la flota de edge relays e informes. Ninguna es una segunda implementación. Cada una es una ruta de la API REST ejecutada por el propio manejador de esa ruta, así que la validación, la comprobación de permisos, la recarga del runtime y la línea de auditoría son las de la ruta, con el agente como actor.
- **Qué hay delante de un cambio.** Debe estar activado el interruptor `HOTLOOP_ALLOW_MCP_WRITES` (activado por defecto), y un llamante con `HOTLOOP_MCP_OIDC_WRITE_ROLE` definido debe tener ese rol. La llamada lleva exactamente el único permiso que pide su ruta (`devices.write`, `alarms.write`, `users.manage`, `settings.write`, etc.) y se rechaza con las palabras de la propia ruta si no lo tiene. Todo cambio exige un `reason`, que se registra como una línea `config` en el registro del sistema junto a la de la propia ruta. Ordenar a los equipos sigue siendo `write_tag`, `call_service`, `run_script`, `apply_recipe` y `trigger_automation` tras `HOTLOOP_ALLOW_WRITES`, la marca de escribible del tag y su rango. Hacer escribible un tag, una regla o una receta es configuración y no ordena nada hasta que se usa; lo que ordena entonces pasa por la misma puerta. Los dos interruptores de escritura no tienen ruta, así que `save_settings` los rechaza para un agente igual que la pantalla Settings, y un agente no puede activar el interruptor del que dependen sus propias escrituras. La contraseña de un usuario pasa por la llamada igual que por la API, y la línea de auditoría nunca la lleva. Las herramientas existen también con `--mcp-stdio`. [MCP](/es/iot/mcp/#cambiar-la-configuración) tiene cada herramienta, su ruta y su permiso.

## Cambios en la API

- `GET /next` y `GET /next/` son un `301` a la raíz, así que un marcador hecho mientras la interfaz nueva estaba junto a la antigua sigue llegando. El `Location` es relativo, así que es correcto bajo una ruta base.
- `GET /static/` ha desaparecido, y con él `GET /next/manifest.webmanifest`. La página, sus archivos, los iconos, `/manifest.webmanifest` y `/sw.js` se sirven desde la raíz como antes; la hoja de estilo y los scripts antiguos no estaban enlazados desde ningún sitio y no se sirven.
- `HOTLOOP_UI` ya no se lee. Definirlo no hace nada.
- No cambió ninguna otra ruta. Las herramientas MCP son superficie nueva, no rutas REST.

## Actualizar desde 4.19.11

Un `helm upgrade` normal, o la actualización automática de Quadlet. No hay migraciones ni nada que configurar. La primera carga recoge la página nueva y el service worker sustituye la caché del anterior, así que un teléfono que tenía la aplicación instalada muestra las pantallas nuevas en su siguiente apertura. Nada se puede deshacer al actualizar, y un rollback a la 4.19.11 es seguro porque nada cambió en la base de datos.

## Conocido

- Nada nuevo. Lo que sigue abierto en Broken or missing de la [hoja de ruta](/es/roadmap/): los tokens de usuario X.509 de OPC UA, las políticas obsoletas `Basic128Rsa15` y `Basic256` que ofrece nuestro servidor OPC UA y las contraseñas de más de 64 bytes (ambas de la biblioteca), y las pruebas de dispositivo silencioso de S7comm y EtherNet/IP contra dispositivos reales.
