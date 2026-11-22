---
title: "Compiler Cascade"
description: "Compilez le binaire et l'image de Cascade, et choisissez la base de données sur laquelle Cascade s'exécute."
---

Il vous faut Go et Podman. `make build` compile le binaire de Cascade, et `make image` crée l'image de conteneur avec Podman, l'éditeur étant intégré au binaire : il n'y a rien d'autre à installer.

La base de données est un réglage. `HOTLOOP_CASCADE_DATABASE` vaut `sqlite:<path>` (la valeur par défaut, dans `HOTLOOP_CASCADE_DATA_DIR`) ou une URL `postgres://`.

Pas de Docker, pas de Compose. Cascade est livré pour Podman (avec Quadlet) et pour k3s (avec Helm).