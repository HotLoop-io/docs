---
title: "从源码构建 Flow"
description: "从源码构建 Flow 二进制文件：一个内置编辑器的静态二进制文件，底层没有 C 库。"
---

HotLoop Flow 是一个内置编辑器的静态二进制文件，所以大多数人直接拉取已发布的镜像，从不自己构建。如果您想要自己的构建，源码是公开的，构建需要 Go 和 Node。

```bash
cd web && npm install && npm run build && cd ..
CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o hotloop-flow ./cmd/hotloop-flow
```

构建结果是静态的，底层没有 C 库，因此可以运行在没有安装其他任何东西的 distroless 镜像上。每个 Flow 版本都只从版本标签构建，别无其他，所以您工厂里的镜像始终是一个可以说出名字、并追溯到某个版本的镜像。