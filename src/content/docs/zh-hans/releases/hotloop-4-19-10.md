---
title: "core 4.19.10 发布说明"
description: "HotLoop core 4.19.10 包含什么、升级时有哪些变化,以及动手处理一个正在运行的工厂之前应该先读什么。"
sidebar:
  label: "4.19.10"
---

这是 [4.19.8](/zh-hans/releases/hotloop-4-19-8/) 的多架构构建。产品代码与 4.19.8 相同。

4.19.10 构建完整的一套:Gateway 为 amd64 和 arm64,Edge、IoT 和 Edge Relay 为 amd64、arm64 和 arm/v7。关于自上一个多架构版本以来的所有变化,请读 [4.19.8 的说明](/zh-hans/releases/hotloop-4-19-8/)。

- 全部四个 chart(`hotloop`、`hotloop-iot`、`hotloop-edge`、`hotloop-edge-relay`)都在 4.19.10,之前的每个版本仍在索引里。
- 下一个带有变更的版本会把它设回 `linux/amd64`。
