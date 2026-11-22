---
title: "Ejecutar Cascade"
description: "Ejecute Cascade con Podman Quadlet o con Helm en k3s, sobre SQLite o Postgres, con la comprobación de estado que usan las unidades y las sondas del chart."
---

En un host con Podman, `deploy/quadlet` contiene unidades de systemd. Un archivo y un volumen son Cascade sobre SQLite; `deploy/quadlet/postgres` es el servidor, un worker y PostgreSQL en una red propia. Ambos arrancan con el sistema, se reinician si fallan y se ejecutan en solo lectura, sin root y sin ninguna capability. Su README lo explica paso a paso.

Para descargar una versión a mano:

```sh
podman pull ghcr.io/hotloop-io/hotloop-cascade:{{cascade}}
```

Las unidades siguen `:stable` y el temporizador de actualización automática de Podman las mueve.

En k3s, `charts/hotloop-cascade` es el chart de Helm:

```sh
helm install cascade oci://ghcr.io/hotloop-io/charts/hotloop-cascade --version {{cascade}}
```

El chart incluye las etiquetas que lee el panel de EmberNet, en el Service y en los pods que sirven el editor, de modo que un Cascade desplegado desde el App Store aparece en Running Apps con un botón LAUNCH. `gui.appName`, `gui.port` y `gui.displayName` cambian lo que muestra.

Eso es un pod con SQLite y un volumen. `--set split=true` con PostgreSQL (`--set postgresql.enabled=true` para uno que ejecuta el chart, o `externalDatabase.existingSecret` para el suyo) lo divide en pods de API, de webhook y de worker que se escalan por separado. La clave que cifra las credenciales almacenadas se crea en la primera instalación y se conserva al desinstalar la release, porque una clave que se va con la release se lleva consigo todas las credenciales de una base de datos que se conserva. Haga una copia de seguridad.

`hotloop-cascade healthcheck` consulta el endpoint de estado del propio servidor en ejecución y termina con 0 o 1. Tanto las unidades de Quadlet como las sondas del chart usan los endpoints que hay detrás.
