---
title: "Compilar Cascade"
description: "Compile el binario y la imagen de Cascade y elija la base de datos en la que se ejecuta Cascade."
---

Necesita Go y Podman. `make build` compila el binario de Cascade y `make image` crea la imagen de contenedor con Podman, con el editor integrado en el binario, así que no hay nada que instalar aparte.

La base de datos es un ajuste. `HOTLOOP_CASCADE_DATABASE` es `sqlite:<path>` (el valor por defecto, dentro de `HOTLOOP_CASCADE_DATA_DIR`) o una URL `postgres://`.

Sin Docker y sin Compose. Cascade se entrega para Podman (con Quadlet) y para k3s (con Helm).