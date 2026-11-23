---
title: "Notas de versión: HotLoop Cascade 1.4.0-rc.1"
description: "Qué trae HotLoop Cascade 1.4.0-rc.1, qué cambia al actualizar y qué conviene leer antes de tocar una planta en marcha."
sidebar:
  label: "1.4.0-rc.1"
---

Esta es una versión candidata de 1.4.0. No mueve ninguna etiqueta `stable`, `latest`, `1.4` ni `1` y no está en el índice de la App Store, así que nada la descarga por defecto. Es el código que enviará 1.4.0, descargado y ejecutado en un host Podman real antes de la etiqueta definitiva, y 1.4.0 será este código con solo sus cadenas de versión cambiadas. Lea las notas de 1.4.0 para ver qué incluye.

## Qué es esto

1.4.0 hace que una instalación de Cascade sea más fácil de mantener a largo plazo: el servidor espera a su base de datos en lugar de caerse, las ejecuciones terminadas pueden conservarse durante un número de días y limpiarse junto con sus archivos, un propietario puede limitar la frecuencia con que una clave de API hace llamadas, y toda la instancia puede respaldarse y restaurarse. También cierra la única prueba de escala que la hoja de ruta tenía pendiente. El motor, el formato de archivo de los flujos de trabajo, la API REST, el servidor MCP (83 herramientas) y los 14 idiomas son los de 1.3.0.

## Espera a su base de datos

En la instalación dividida (pods de servidor, worker y webhook sobre PostgreSQL), los pods arrancaban antes de que se resolviera el nombre de la base de datos y se reiniciaban dos o tres veces antes de estar listos. 1.2.1 y 1.3.0 hacían lo mismo. Un servidor, worker o webhook que no puede llegar a su base de datos ahora lo dice en su registro ("waiting for the database", con el tiempo que lleva esperando) y lo vuelve a intentar durante hasta cinco minutos, y luego se conecta cuando la base de datos responde. Una contraseña incorrecta, una dirección mal formada o una base de datos que no existe siguen deteniéndolo de inmediato, porque esperar no puede arreglarlo. La sonda de arranque del chart espera tanto como el programa. Una instalación dividida nueva en un k3s real no mostró reinicios, en las tres ejecuciones de la prueba del chart.

## Conservar las ejecuciones terminadas

Ajustes tiene un campo nuevo, Conservar las ejecuciones terminadas durante (días), y `PATCH /api/v1/settings` acepta `retentionDays`. Está desactivado por defecto (0), y todas las ejecuciones se conservan como siempre. Si fija un número, una vez por hora un nodo principal elimina las ejecuciones correctas, fallidas y canceladas que terminaron hace más tiempo que eso, con sus datos de paso. Una ejecución que sigue en curso nunca se toca, ni tampoco una ejecución cuyo padre lo está. Cada lote escribe `execution.pruned` en el registro de auditoría, y cambiar el ajuste escribe `instance.retention`.

La misma pasada horaria limpia ahora el almacén de blobs, tenga o no activada la retención: las salidas demasiado grandes para la base de datos y los adjuntos a los que ya no apunta ninguna ejecución. Un archivo que comparten dos ejecuciones permanece hasta que se va la última, y solo se miran los archivos escritos hace más de 24 horas, de modo que nunca se elimina un archivo que un paso acaba de guardar. Esto es nuevo también para las ejecuciones que borra a mano; antes, una ejecución borrada dejaba sus salidas grandes en el disco para siempre. Una pasada que no puede leer lo que necesita no elimina nada, y cada pasada escribe `blobs.collected` en el registro de auditoría.

## Un límite para cada clave de API

Ajustes tiene un campo nuevo, Solicitudes de API por clave por minuto, y `PATCH /api/v1/settings` acepta `apiRateLimit`. Está desactivado por defecto. Si fija un número, cada clave de API, y cada agente que inicia sesión por MCP con una, puede hacer esa cantidad de solicitudes por minuto. Una llamada que supera el límite recibe 429 con un `Retry-After`. Cada clave tiene su propia cuenta, y las personas que inician sesión en el editor no están sujetas a ella. La cuenta es la de cada proceso, así que con tres nodos principales una clave puede hacer hasta tres veces esa cantidad. Cambiarlo escribe `instance.api_rate_limit` en el registro de auditoría.

## Copia de seguridad y restauración

`hotloop-cascade backup DIR` escribe un directorio nuevo con una copia consistente de la base de datos SQLite tomada mientras el servidor funciona, el archivo de clave que sella todas las credenciales almacenadas, los archivos de blobs y un `manifest.json` con sus hashes. `hotloop-cascade restore DIR` los devuelve a su sitio, tras comprobar cada archivo contra el manifiesto, y se niega a sobrescribir una base de datos o una clave distinta salvo que indique `--replace`. Con PostgreSQL, la copia contiene la clave, los blobs y el manifiesto, e imprime el comando `pg_dump` para la parte de la base de datos; la restauración imprime el de `pg_restore`. Los blobs guardados en S3 o Azure no se copian. `docs/GOVERNANCE.md` tiene los detalles.

## Las pruebas que lo respaldan

- La prueba de escala que fijó la hoja de ruta está hecha. Dos nodos principales sobre un mismo PostgreSQL ejecutaron durante una hora un flujo de trabajo que se dispara cada minuto mientras uno de ellos se detenía con SIGKILL en el límite del intervalo, siete veces seguidas y caído unos 25 segundos cada vez: 61 ejecuciones para 61 intervalos de minuto, ninguna perdida, ninguna duplicada.
- El servidor OAuth de la pila de pruebas (Hydra) ahora funciona sobre Postgres. Antes fallaba en ejecuciones en paralelo, pasó después y volvió a fallar con el cambio revertido. Ningún código de Cascade introspecciona tokens.
- La prueba del chart ahora falla si un pod se reinicia durante la instalación.
- Los dos nuevos rechazos de ajustes están traducidos en todos los idiomas, y la ayuda de los ajustes dice que las salidas grandes se van con sus ejecuciones.

## Solo amd64, y por qué

Esta versión se compila solo para amd64. La multiarquitectura sale en su propia ejecución, así que la versión siguiente es un pequeño cambio de versión que compila ambas. `stable`, `latest`, `1.4` y `1` enumeran la nueva imagen amd64 junto a la imagen arm64 a la que ya apuntaban.

## Actualizar y volver atrás

Sin migraciones: el esquema es el que tiene 1.3.0. Ejecute `helm upgrade` a 1.4.0, o deje que `:stable` actualice las unidades Quadlet. Volver a poner 1.3.1 es seguro, porque nada cambió en la base de datos. Lo que una reversión no puede deshacer es una poda: las ejecuciones que eliminó la retención ya no están, y tampoco los blobs que quitó la limpieza horaria. La retención está desactivada hasta que usted la active, así que haga antes una copia de seguridad; la limpieza de blobs funciona sin ella.
