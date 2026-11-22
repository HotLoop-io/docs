---
title: "Las migraciones solo añaden"
description: "Por qué una migración nunca elimina, renombra ni cambia el tipo de nada, y así una actualización fallida vuelve a la última versión sin perder una fila."
---

Una migración añade. Nunca elimina, renombra ni cambia el tipo de nada, nunca endurece una columna ni una restricción por las que escribe la versión anterior, y nunca borra datos. Esa es toda la regla, y una prueba rompe la compilación cuando una migración la incumple.

## Por qué

Todas las cajas siguen `:stable` y la actualización automática de Podman las mueve. Cuando una versión migra la base de datos y luego falla su comprobación de salud, la actualización se revierte y la versión anterior arranca sobre el esquema que dejó la nueva. Una migración no se puede revertir con ella. Así que la versión anterior tiene que funcionar con el esquema nuevo, y la única forma de prometerlo es que el esquema nuevo contenga todo lo que contenía el viejo, con la misma forma y aceptando las mismas escrituras.

Añada una columna y la versión anterior nunca la mira. Elimine una y la primera consulta de la versión anterior es un error, en una planta, a las tres de la madrugada, sin nada a lo que volver.

El chart de Helm tiene el mismo problema: `helm rollback` devuelve la imagen vieja y deja la base de datos donde la dejó la nueva.

## Los cambios que parecen necesitar más

No se puede eliminar, así que un cambio que parece necesitarlo se hace añadiendo y dejando en paz lo viejo.

- **Renombrar una columna.** Añada la columna nueva con un valor por defecto. La versión nueva lee la nueva y escribe en las dos. La columna vieja se queda, sin usar, para siempre.
- **Cambiar un tipo.** Igual: una columna nueva del tipo nuevo, la versión nueva escribe en las dos y la columna vieja se queda.
- **Una columna que ahora debe ser NOT NULL.** Se exige en la aplicación. Si de verdad hace falta una restricción, va en una tabla que sea nueva.
- **Retirar una tabla.** Se deja de usar. Se queda.
- **Limpiar datos antiguos.** Lo hace la aplicación en tiempo de ejecución (la retención ya lo hace), no una migración.

Las columnas muertas cuestan unos pocos bytes. Una migración que no se puede deshacer cuando la versión a la que pertenece sí se puede cuesta una planta.

## La protección: una aplicación rechaza un esquema en el que no se puede confiar

Añadir es seguro durante una versión, no para siempre. Una versión solo se ha probado sobre el esquema inmediatamente posterior, así que la aplicación cuenta cuánto se ha adelantado la base de datos.

`schema_migrations` registra, junto a cada migración, qué versión la aplicó (`app_version`). Al arrancar, antes de tocar nada, la aplicación compara las migraciones de la base de datos con las que lleva incorporadas:

| La base de datos tiene | Qué ocurre |
|---|---|
| Nada que esta versión no conozca | Arranca |
| Migraciones de una versión más nueva | Arranca, con una advertencia que nombra las dos versiones. Es una actualización revertida. No migra nada, y la versión más nueva encuentra su esquema ya puesto cuando vuelve |
| Migraciones de dos o más versiones más nuevas | Se niega a arrancar, y nombra esta versión, la migración más nueva que conoce, la más nueva de la base de datos y las versiones que las escribieron |

El rechazo dice:

```
refusing to start: this database's schema is more than one release ahead of
HotLoop 4.18.10. 0022_x.sql is the newest migration this release knows, and the
database has 2 it does not (up to 0024_z.sql), written by 4.19.0 and 4.20.0.
Only the release right after this one is known to work on that schema. Start
HotLoop 4.20.0 or newer against this database (an update to :stable gets
there), or restore a backup taken by HotLoop 4.18.10 or earlier
```

En una caja que sigue `:stable`, la siguiente actualización lo arregla, porque `:stable` pasa a la versión más nueva, que conoce todas las migraciones. Mientras tanto la unidad se queda en «activating». Es a propósito: una caja caída que dice por qué es mejor que una caja en marcha y equivocada.

La protección actúa tanto si el arranque migra como si no (`HOTLOOP_DB_MIGRATE`), y en una restauración, que abre la base de datos del mismo modo. Una base de datos anterior a la protección no tiene la columna `app_version` y no puede contener una migración más nueva que la versión que la lee, así que arranca; la columna se añade en el primer arranque de una versión que tenga la protección.

## Probarlo en una versión real

Antes de publicar una versión, se arranca la versión anterior sobre la base de datos que migró la nueva y se hace que inicie sesión, lea dispositivos y tags, escriba a través de la puerta y lea el historial. Si no puede, la versión no sale.
