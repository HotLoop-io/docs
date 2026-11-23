---
title: "CODESYS 0.3.7 发布说明"
description: "HotLoop for CODESYS chart 0.3.7:封装 HotLoop 4.22.0 并运行 provisioner 0.3.2。"
sidebar:
  label: "0.3.7"
---

## 变更内容

0.3.7 在索引 `{{codesysChartRepo}}` 中,发布于 2026-11-19。

- **它封装 HotLoop 4.22.0,** 它让同一地址和端口上的每个 OPC UA PubSub 设备共用一个套接字,所以两个监听器可以放在同一个 UDP 端口上。
- **provisioner 接受同一端口上的两个监听器。** provisioner 0.3.2 不再拒绝把两个 `opcua-pubsub` 设备放在同一端口的配置文件。

这对您意味着什么:同一端口上有多个 PubSub 发布方的配置文件可以安装并读取。

## 检查了什么

全新安装,配置文件包含运行时自身的设备、同一 UDP 端口上的两个 PubSub 监听器、一个报警和一个画面,旁边是运行 Transmitter 库的真实 CODESYS Control for Linux SL 4.22.0.0 运行时:一切都无需手动步骤就已创建,PLC 的变量读取良好,报警在 PLC 自身的值上触发,两个监听器都读为已连接。针对两种编码的真实发布方,32 个字段全部读取良好且与 PLC 相等。两个 pod 都被删除,运行时重启:HotLoop 自行恢复,三个设备俱在。
