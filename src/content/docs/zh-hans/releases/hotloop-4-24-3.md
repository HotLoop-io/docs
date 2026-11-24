---
title: "core 4.24.3 发布说明"
description: "HotLoop core 4.24.3 包含什么、升级时有哪些变化,以及动手处理一个正在运行的工厂之前应该先读什么。"
sidebar:
  label: "4.24.3"
---

4.24.3 把 [4.24.2](/zh-hans/releases/hotloop-4-24-2/) 的全部内容带到我们构建的每一种板卡上：各代 Shelly、ONVIF 摄像头、通过 Firmata 连接的 Arduino、任意长度的 OPC UA 密码、在慢速链路后能清空的转发队列、会给出提交的 `--version`，以及能启动的默认 HotLoop Edge 安装。

Gateway 运行在 amd64 和 arm64 上，Edge、IoT 和 Edge Relay 运行在 amd64、arm64 和 arm/v7 上，因此同一个版本覆盖您的服务器、您的 Pi 和较旧的 ARM 网关。请阅读 [4.24.2 的说明](/zh-hans/releases/hotloop-4-24-2/)了解自 4.24.0 以来的全部新内容。

- 四个 chart（`hotloop`、`hotloop-iot`、`hotloop-edge`、`hotloop-edge-relay`）都在 4.24.3，所有更早的版本仍在索引中。
- 像往常一样升级：对 4.24.3 chart 执行 `helm upgrade`，或在 Quadlet 单元中使用新标签。无需迁移。
