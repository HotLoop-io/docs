---
title: "Transmitter 路线图"
description: "HotLoop Transmitter 已经做成的功能、接下来要做的，以及刻意不计划的内容。"
---

如今包里有什么，接下来是什么，以及刻意不计划什么。一条内容只有在真实的 4.22.0.0 运行时上运行过、并有接收端读取过之后，才会移到“已发布”。

## 1.1.0 中已发布

* DataSetMessage 和 NetworkMessage 的时间戳取自 PLC 的实时时钟，默认开启，`bTimestamp` 可关闭。
* 库以 CODESYS `.package` 形式提供，通过 CODESYS Installer 安装。

## 1.0.0 中已发布

* 一个发布器功能块 `FB_HLTX_Publisher`：每个发布间隔一条 NetworkMessage，一条 DataSetMessage，一个 Data Key Frame，通过 SysSocket 上的 Structured Text 实现 UDP 上的 UADP。
* Variant 和 RawData 两种字段编码。
* BOOL、SINT、USINT、INT、UINT、DINT、UDINT、LINT、ULINT、REAL、LREAL、STRING 和 TIME 字段，以及除 STRING 外各类型的数组，两种编码都支持。
* 单播和组播目标、publisher id、writer group id、dataset writer id、发布间隔、组版本和配置版本，全部作为功能块的输入设置。
* 非阻塞发送，每次调用的开销有上限，已发送、被拒绝和被跳过的计数器，以及永远不会让应用出现故障的错误状态。

## 下一步

* 亚秒级时间戳。1.1.0 的时间戳是实时时钟的整秒。
* 一条 NetworkMessage 中放多条 DataSetMessage（Sizes 数组），让一个数据报能携带多个 writer。
* Data Delta Frame 和 KeepAlive 消息，减少基本不变的数据集所占的字节。
* WSTRING 字段。
* 每个字段的状态，让 Bad 的值能以 Bad 发送。

## 不计划

* 消息安全（签名和加密）。功能块以明文发送，用于工厂本来就信任的网络。
* 分块的 NetworkMessage。放不进一个 1500 字节帧的消息会被拒绝，而不是拆分。
* 订阅端。HotLoop core 订阅 UADP，而这个库负责发布。
* MQTT 传输。UDP 是 CODESYS 运行时无需更多库就能用到的方式。
