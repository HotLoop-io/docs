---
title: "CODESYS 0.3.0 发布说明"
description: "HotLoop for CODESYS 的首个已发布 chart:包含什么,封装什么,以及运行到了哪一步。"
sidebar:
  label: "0.3.0"
---

## 这是什么

0.3.0 是 HotLoop for CODESYS 在索引 `{{codesysChartRepo}}` 中的第一个 chart,发布于 2026-11-05:在 CODESYS 运行时旁边的 HotLoop Edge,由配置文件设置,无需任何人点击。它封装 HotLoop 4.19.4 并运行 provisioner 0.3.0。[0.3.1](/zh-hans/releases/codesys-0-3-1/) 在同一天发布,应安装的是它。

- **一个封装 HotLoop Edge 的 chart**,为同一节点上的运行时提供默认值:节点自身存储上的 SQLite,没有数据库 pod,一个副本,OPC UA 服务器、broker、Edge 发布和备份均关闭。
- **一个 provisioner**,一个静态 Go 二进制文件和一个公开镜像,读取[配置文件](/zh-hans/codesys/profile/)(设备、要保留的变量、报警和一个画面),一旦 PLC 的运行时应答就设置好一切。它每五分钟再看一次。
- **配置文件中的设备列表。** 配置文件可以携带 `devices`,任何 HotLoop 支持的协议都可以,所以 OPC UA PubSub 监听器无需 PLC 就能以配置好的状态恢复。只有一个 `device` 的配置文件读取方式与之前完全相同。
- **会跟随变化的 PLC。** 配置文件列出的变量,如果 PLC 此后新增了,就会被加入。PLC 丢失的变量会读为坏值,并附上服务器给出的原因。只有配置文件的修订号更高时,画面和报警才会被替换。
- **不向 PLC 写入任何内容。** provisioner 设置的每个标签都是只读的。
- **两个 pod 都能容忍无法访问或未就绪的节点,** 且没有时间限制。
- **hostNetwork**,默认关闭,用于需要在节点自身网卡上收听发布方组播的 pod。
- **来自 EmberCORE 仪表盘的登录** 来自 Edge chart 的 4.19 登录,本 chart 继承了它。

## 运行到了哪一步

已在裸机上运行(2026-11-17)。[现状](/zh-hans/codesys/where-it-stands/)说明了它针对什么运行。
