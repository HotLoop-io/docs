---
title: "core 4.20.1 发布说明"
description: "HotLoop core 4.20.1 包含什么、升级时有哪些变化,以及动手处理一个正在运行的工厂之前应该先读什么。"
sidebar:
  label: "4.20.1"
---

这是 [4.20.0](/zh-hans/releases/hotloop-4-20-0/) 的多架构构建。产品代码与 4.20.0 相同:`/` 上的新 Web 界面和修改配置的 MCP 工具。4.20.0 是 amd64 构建,`stable` 保留了它已有的 arm 镜像。

4.20.1 构建完整的一套:Gateway 为 amd64 和 arm64,Edge、IoT 和 Edge Relay 为 amd64、arm64 和 arm/v7。关于自 4.19.11 以来的所有变化,请读 [4.20.0 的说明](/zh-hans/releases/hotloop-4-20-0/)。

- 全部四个 chart(`hotloop`、`hotloop-iot`、`hotloop-edge`、`hotloop-edge-relay`)都在 4.20.1,之前的每个版本仍在索引里。
