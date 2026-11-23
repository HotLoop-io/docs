---
title: "core 4.20.2 发布说明"
description: "HotLoop core 4.20.2 包含什么、升级时有哪些变化,以及动手处理一个正在运行的工厂之前应该先读什么。"
sidebar:
  label: "4.20.2"
---

在 [4.20.1](/zh-hans/releases/hotloop-4-20-1/) 之上的两项修复,以及许可证。这是第一个采用 EmberNet Source License 1.0(`LicenseRef-EmberNet-Source-1.0`)的核心版本:LICENSE、NOTICE、README、chart 注解和镜像标签都这样写。

- **批次中有多个 tag 的 EtherNet/IP。** 驱动向库的 `ReadMulti` 请求一个批次,它接受带标签字段的 struct 或 map,而普通的 tag 名称会让它在 reflect 里 panic,一个字节都还没发出。所以任何批次里有两个或更多 tag 的 EtherNet/IP 设备,其轮询都会 panic(批次默认是二十个)。没人在测试里看到,因为从没有测试把批次对着服务器跑过。现在测试在进程内运行一个 EtherNet/IP 服务器和一个 S7 服务器,驱动通过 TCP 读取它们,批次走 `ReadList`。带着打开的套接字沉默的控制器会在一次轮询加它的超时之内被判定为掉线,符合设计,并且不再被逐个 tag 重新询问,那种做法曾让轮询在每个 tag 上占用一个超时。S7comm 和 EtherNet/IP 仍未在实体 PLC 上得到验证。
- **`version` 是一个词。** `podman run ghcr.io/hotloop-io/hotloop:4.20.1 version` 过去会以“database password is not set”退出,因为在读取配置之前只处理了 `--version`。现在 `version` 在空环境下也会打印版本,适用于 Gateway、Edge 和 IoT,也适用于 Edge Relay。

- 没有迁移,没有新的 secret,没有 API 变更。普通的 `helm upgrade` 或 Quadlet 自动更新就能带上它。
- 全部四个 chart(`hotloop`、`hotloop-iot`、`hotloop-edge`、`hotloop-edge-relay`)都在 4.20.2,之前的每个版本仍在索引里。
- 这次构建只有 amd64,`stable` 保留它已有的 arm 镜像。下一个版本是一次小的版本号提升,用来构建 arm 镜像。
