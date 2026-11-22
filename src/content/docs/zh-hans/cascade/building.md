---
title: "构建 Cascade"
description: "构建 Cascade 的二进制文件和镜像，并选择 Cascade 运行所用的数据库。"
---

需要安装 Go 和 Podman。`make build` 构建 Cascade 二进制文件，`make image` 用 Podman 构建容器镜像，编辑器已内置在二进制文件中，无需另外安装任何东西。

数据库是一项设置。`HOTLOOP_CASCADE_DATABASE` 的值是 `sqlite:<path>`（默认，位于 `HOTLOOP_CASCADE_DATA_DIR` 下）或一个 `postgres://` URL。

不使用 Docker，也不使用 Compose。Cascade 为 Podman（配合 Quadlet）和 k3s（配合 Helm）提供。