---
title: "core 4.19.5 发布说明"
description: "HotLoop core 4.19.5 包含什么、升级时有哪些变化,以及动手处理一个正在运行的工厂之前应该先读什么。"
sidebar:
  label: "4.19.5"
---

这是 [4.19.4](/zh-hans/releases/hotloop-4-19-4/) 的多架构构建,没有别的。代码就是同一个提交的代码,只是版本号提升:没有修复,没有功能,没有行为变化。

4.19.4 只为 amd64 构建,这样它可以在 arm 镜像构建之前就到达生产环境并被读作 stable。4.19.5 构建完整的一套:Gateway 为 amd64 和 arm64,Edge、IoT 和 Edge Relay 为 amd64、arm64 和 arm/v7。arm 设备盒通过拉取 `stable`,从它原来运行的镜像换到 4.19.4 的代码。

关于自上一个已发布版本以来的所有变化,请读 [4.19.4 的说明](/zh-hans/releases/hotloop-4-19-4/)。

- 全部四个 chart(`hotloop`、`hotloop-iot`、`hotloop-edge`、`hotloop-edge-relay`)都在 4.19.5,之前的每个版本仍在索引里。
- 下一个带有变更的版本会把它设回 `linux/amd64`。
