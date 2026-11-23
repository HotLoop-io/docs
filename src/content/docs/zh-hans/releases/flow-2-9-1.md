---
title: "Flow 2.9.1 发布说明"
description: "HotLoop Flow 2.9.1 带来了什么，升级时有什么变化，以及动手改动运行中的工厂之前该读什么。"
sidebar:
  label: "2.9.1"
---

HotLoop Flow 2.9.1 让 `modbus-server` 节点可以在某个 VLAN 的接口上监听，所以一个 Flow 能在一个端口的每个 VLAN 上各运行一个服务器，地址和端口都相同。

## 新功能

- **`modbus-server` 接受网络接口。** 监听套接字在开始监听之前绑定到接口（`SO_BINDTODEVICE`），所以两个 VLAN 上各自位于 `192.168.1.9:10502` 的两个服务器不再冲突。设置与每个客户端相同：节点自己的**网络接口**，否则是其标签页环境变量中的 `FLOW_NETWORK_INTERFACE`。两者都没有时，它照常监听，同一地址和端口上的两个服务器仍然冲突，现在会报错，说明每个服务器都需要一个接口。

## 变更内容

- 未设置时，它的行为与上游一致。NOTICE 和 `HOTLOOP_PATCH.txt` 说明了改了什么。

## 新设置

除 `modbus-server` 上的**网络接口**字段外没有别的。图表值 `bindToInterface.netRaw` 和 2.9.0 的主机网络要求对它的适用方式与对客户端相同。

## 升级

只需对 2.9.1 的镜像和 chart 执行一次 `helm upgrade`，或在您的 Quadlet 单元里换上新标签。首次启动时不会发生任何事，也不需要迁移。没有设置接口的流程，行为与 2.9.0 上完全一样。

镜像：`ghcr.io/hotloop-io/hotloop-flow:2.9.1`，先发布 linux/amd64，arm64 在 2.9.2 中跟进。Chart：`https://hotloop.io/hotloop-flow/`。这个标签的 README 有其余内容，还配有图片：https://github.com/HotLoop-io/hotloop-flow/blob/v2.9.1/README.md
