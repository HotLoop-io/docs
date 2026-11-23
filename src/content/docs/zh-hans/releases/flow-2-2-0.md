---
title: "Flow 2.2.0 发布说明"
description: "HotLoop Flow 2.2.0 带来了什么，升级时有什么变化，以及动手改动运行中的工厂之前该读什么。"
sidebar:
  label: "2.2.0"
---

HotLoop Flow 2.2.0 这个版本里，Flow 能与 PLC 通信，重启后记得自己知道的东西，还能告诉你一条消息去了哪里。它也是第一个采用 HotLoop 的 Business Source License 的版本，我把这点放在最前面，因为这是你必须读的部分。

## 许可证变了

2.2.0 及之后的每个版本都采用 HotLoop 的 Business Source License 1.1，与 HotLoop 其余部分是同一份许可证。它不是开源许可证，我也不打算假装它是。Flow 的源代码依然公开，所以你运行的每一行都可以阅读。

- 家庭和实验室使用免费。
- 经认证的学校和教育机构、非营利组织和政府机构，可为自身运营和使命免费使用。
- 通过 [EmberNet](https://embernet.ai) 运行的商业使用免费。这是唯一的商业途径。
- 将 Flow 作为服务托管、转售，以及嵌入你所销售的产品，均不在授权范围内。
- 每个版本在首次公开四年后转为 GPL-3.0 或更高版本。

`LICENSE` 是法律文本，与 HotLoop-io/HotLoop-io 中的逐字节一致。2.1.0 及之前的版本仍采用其发布时的许可证。这些版本没有任何变化。移植的 Node-RED 文件保留其原始许可证头部和署名，所以它们的许可证文本现在随 `LICENSES/` 一起发布，放在 `NOTICE` 旁边，镜像在 `/usr/share/doc/hotloop-flow/` 中同时带有两者。`NOTICE` 还涵盖 Flow 现在携带的 gos7 补丁副本（见下文）。

## 新功能

**追踪与回放**
- 每条消息都有一条有界的追踪。点击一条调试消息，编辑器会点亮它走过的路径，并显示每一跳的耗时和负载，穿过拆分、合并和子流程。
- 追踪可以变成一个流程测试，也可以回放到草稿中，让你在出问题的那条消息上试一个修复。
- 每一跳都可以作为 span 发送到 OpenTelemetry 收集器（`trace.otlp.endpoint`）。

**重启后仍保留的状态**
- 流程、全局和节点上下文保存在数据卷上的 SQLite 文件 `state.db` 中。重启不再清掉它们。
- 持久连线。把一条连线标记为持久，只要另一端的节点跟得上，它就是一条普通连线，什么都不写。当那个节点不再接收消息时，连线会按顺序溢出到同一个文件，目标恢复后再排空。我们用一个停了十分钟的真实 InfluxDB 证明过，并在中断中途和排空中途用 `kill -9` 杀掉运行时：没有丢失，也没有重复。

**工厂节点**
- Modbus TCP 读写，OPC UA 读取、写入和订阅，S7 读写，EtherNet/IP 读写，以及作为边缘节点和主机的 Sparkplug B。Flow 现在可以与 `scan` 找到的设备通信。
- Sparkplug 完成规范要求的出生、遗嘱、`bdSeq`、重生请求和命令。我们已用一个独立的 Sparkplug 实现双向核对过，边缘节点和主机两个方向。
- 沉默的设备会让请求在超时内失败，下一条消息会重新连接。OPC UA 订阅会察觉自己掉线，只报告一次，然后自行恢复。

**编辑器**
- 复制和粘贴、选区的导入和导出、带有自己画布的子流程、嵌套分组、跨所有流程的搜索、调试过滤器、Alt+点击删除连线。一个浏览器测试会点遍运行时提供的列表中的每个节点对话框，所以新节点在发布当天就被覆盖。
- 把连线拖到节点上在 Chromium 中从来没有成功过。现在可以了。

**检查**
- 配置节点不在文件里的节点（一个已删除、但子流程仍在引用的代理，或者对某个标签页或错误类型的配置节点的引用），会在导入、加载和部署时被报告，并且无法启动。以前它只是悄悄地从来不工作。
- 删除一个流程或节点，会把它的 ID 从点名过它的 Catch、Status 和 Complete 范围中移除。

## 变更内容

- 上下文默认持久化。`store.context.persist` 已开启，所以重启前设置的值在重启后依然存在，而以前每次重启都从空开始。依赖启动时上下文为空的流程，现在必须自己清除它希望为空的内容。设置 `persist` 为 `false` 可恢复旧行为。
- 追踪默认开启，并在各方面都有界：256 条行程，每条 512 跳，总共 16 MiB，每秒 1000 条新行程。它只存在于内存中，所以重启会让列表重新开始。`trace.enabled: false` 可关闭它。
- gos7 在每次 S7 超时时都会向 Go 的全局日志器打印一行原始内容，节点上没有任何办法关掉。
- 持久队列在消息写入磁盘之后才把它算作等待中，而不是之前。
- 镜像用 Podman 而不是 Docker 构建和推送。同一个镜像，同样的标签（`2.2.0`、`2.2`、`2`），仍然是 linux/amd64 和 linux/arm64。

## 升级说明

从 2.1.0 升级只需更换镜像（`helm upgrade`，或在你的 Quadlet 单元里换上新标签）。无需迁移，无需标志。在 2.1.0 上运行的 `flows.json` 和配置文件在 2.2.0 上照样运行，流程文件的逐字节往返保持不变。

- 首次启动会在数据卷上的 `data.dir` 中创建 `state.db`。图表中 `persistence.enabled` 为 false 时，它能熬过容器重启，但熬不过 Pod 被替换。
- 回退到 2.1.0 会把 `state.db` 留在原处。2.1.0 没有读取它的代码。
- 每次写入 `state.db` 都是对 SD 卡或 SSD 的一次写入，所以默认值会批量合并。上下文的改动等待 `flushInterval`（30 秒）后一起写入，把值设成它原来的值则什么都不写。`kill -9` 可能丢掉这么多。`docs/durable/README.md` 有具体数字，以及这对一张卡的代价。

## 新设置

| YAML | 环境变量 | 默认值 |
|---|---|---|
| `store.path` | `HOTLOOP_FLOW_STORE_PATH` | 空，即 `data.dir` 中的 `state.db` |
| `store.synchronous` | `HOTLOOP_FLOW_STORE_SYNCHRONOUS` | `normal`。`full` 在每次提交时 fsync，并因此磨损存储卡。 |
| `store.context.persist` | `HOTLOOP_FLOW_CONTEXT_PERSIST` | `true` |
| `store.context.flushInterval` | `HOTLOOP_FLOW_CONTEXT_FLUSH_INTERVAL` | `30s`。`0s` 在流程继续之前写入每一次改动。 |
| `store.durable.maxBytes` | `HOTLOOP_FLOW_DURABLE_MAX_BYTES` | 所有持久连线合计 256 MiB |
| `store.durable.ackFlush` | `HOTLOOP_FLOW_DURABLE_ACK_FLUSH` | `100ms`。`0s` 在发送下一条之前标记每条消息。 |
| `trace.enabled`, `trace.traces`, `trace.maxHops`, `trace.maxMessageBytes`, `trace.maxBytes`, `trace.perSecond` | | `true`, 256, 512, 16384, 16 MiB, 1000。`perSecond: 0` 追踪每一条消息。 |
| `trace.otlp.endpoint`, `trace.otlp.serviceName`, `trace.otlp.interval` | `HOTLOOP_FLOW_TRACE_OTLP_ENDPOINT` | 空（不导出），`hotloop-flow`，`2s` |
| `trace.otlp.headersSecret`（图表） | `HOTLOOP_FLOW_TRACE_OTLP_HEADERS` | 无。一个 Secret 键，内含以逗号分隔的 `Name=value` 对，用于托管收集器的 API 密钥。 |

图表在 `values.yaml` 的 `store` 和 `trace` 下包含所有这些项。

镜像：`ghcr.io/hotloop-io/hotloop-flow:2.2.0`，linux/amd64 和 linux/arm64。图表：`https://hotloop.io/hotloop-flow/`。此标签的 README 有其余内容：https://github.com/HotLoop-io/hotloop-flow/blob/v2.2.0/README.md
