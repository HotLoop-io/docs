---
title: "Compilare Cascade"
description: "Come compilare il binario e l'immagine di Cascade e come scegliere il database su cui Cascade gira."
---

Servono Go e Podman. `make build` compila il binario di Cascade e `make image` crea l'immagine del container con Podman, con l'editor incluso nel binario, quindi non c'è nulla da installare a parte.

Il database è un'impostazione. `HOTLOOP_CASCADE_DATABASE` vale `sqlite:<path>` (il predefinito, sotto `HOTLOOP_CASCADE_DATA_DIR`) oppure un URL `postgres://`.

Niente Docker e niente Compose. Cascade viene distribuito per Podman (con Quadlet) e per k3s (con Helm).