---
title: "Изграждане на Cascade"
description: "Изградете двоичния файл и образа на Cascade и изберете базата данни, на която работи Cascade."
---

Трябват ви Go и Podman. `make build` изгражда двоичния файл на Cascade, а `make image` изгражда контейнерния образ с Podman, като редакторът е вграден в двоичния файл, така че няма какво да се инсталира допълнително.

Базата данни е настройка. `HOTLOOP_CASCADE_DATABASE` е `sqlite:<path>` (по подразбиране, в `HOTLOOP_CASCADE_DATA_DIR`) или URL адрес `postgres://`.

Без Docker и без Compose. Cascade се доставя за Podman (с Quadlet) и за k3s (с Helm).