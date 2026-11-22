---
title: "Flow 节点面板"
description: "Flow 自带的每一种节点类型，标注为完全、部分、有差异或 Flow 独有，并写明与 Node-RED 的差异。"
---

**117 种消息节点类型，另有 39 种用于 FlowLab 图。**

| 类别 | 节点 |
|---|---|
| 通用 | inject, debug, complete, catch, status, link in, link out, comment, junction |
| 函数 | function, switch, change, range, template, delay, trigger, exec, rbe |
| 网络 | ntfy out, gotify out, discord out, discord bot out, kafka out, mqtt in/out, http in, http response, http request, websocket in/out, tcp in/out, tcp request, udp in/out, modbus read/write, s7 read/write, ethernetip read/write, opcua read/write/subscribe, sparkplug in/out/command, hotloop in/state/script/recipe, mcp tool/result/client, e-mail，以及 Node-RED 的 modbus-read/getter/flex-getter/write/flex-write/server 节点 |
| 序列 | split, join, sort, batch |
| 解析器 | csv, html, json, xml, yaml |
| 存储 | file, file in, watch, influxdb out, postgres, postgresql |
| 仪表板 | ui_text, ui_numeric, ui_button, ui_switch, ui_text_input, ui_led, ui_gauge, ui_chart, ui_template，以及用于布局页面的 ui_base, ui_tab, ui_group, ui_link 和 ui_spacer |
| 发现 | scan, netinfo，用于盘点一个 OT 网段 |
| 配置 | hotloop-flow-ntfy, hotloop-flow-gotify, hotloop-flow-discord-bot, hotloop-flow-kafka, mqtt-broker, websocket-listener, websocket-client, influxdb, postgres, modbus, s7, ethernetip, opcua, sparkplug, hotloop, mcp-server, modbus-client, postgreSQLConfig |
| FlowLab | constant, math, compare, logic, wait, bundle, field, build array, while loop, for loop, body in, body out, serial port, serial read, serial write, parse reading, stable value, log to text file, log to TDMS file, statistics, integral, derivative, filter, read DAQ task, mqtt out, postgres out, control, indicator, chart |

FlowLab 这一行是另一类节点。它运行在作为图的标签页上，节点在每个输入都有值时运行一次，从不接收消息。FlowLab 是什么，以及它的循环、错误连线、面板和调试器如何工作，见 [FlowLab](/zh-hans/flow/flowlab/)。一个流程文件，也就是一组图，可以推送到租户在 EmberNet 中运行的每一个 Flow 安装，每个都会被检查，失败的会被还原：[推送到租户的工作站](/zh-hans/flow/stations/)。两个安装可以分担一个的工作，对设备的每次写入都带有租约和围栏，只有一个能写：[带租约的热备](/zh-hans/flow/failover/)。

## 通知相关人员，以及 Kafka

五个节点把消息携带的内容发送到别处，并把消息继续传下去：**ntfy out**、**gotify out**、**discord out**（一个 webhook）、**discord bot out** 和 **kafka out**。它们使用 HotLoop 核心发送报警和事件时所用的同样设置，所以已经有 ntfy 主题、Gotify 应用、Discord webhook 或 Kafka 集群的工厂，可以让 Flow 指向同样的这些。

- **ntfy。** 一个服务器配置节点（地址，然后是访问令牌，或用户名和密码，对允许任何人发布的服务器则两者都不需要），每个节点有一个主题、一个标题、一个优先级（从 min 到 max，或 `msg.priority`）、标签和一个点击地址。空的主题或标题会取 `msg.topic` 或 `msg.title`。在公共服务器上，主题是唯一的秘密，所以它不会出现在任何错误和状态中。
- **Gotify。** 一个带有应用令牌的服务器配置节点，每个节点有一个标题和 0 到 10 的优先级。
- **Discord webhook。** webhook URL 就是全部凭据，保存在节点上，绝不会显示在状态、日志或错误中，即使是点名该地址的网络错误也不会。设置标题或颜色会使消息成为 embed。内容在 2,000 个字符处截断，embed 的描述在 4,096 处截断，按 Discord 的方式计数，而且消息里的任何内容都不能提及任何人。
- **Discord 机器人。** 一个带有令牌的机器人配置节点，每个节点有一个频道 ID（或 `msg.channel`）。它以机器人身份发布，需要机器人在该频道中并有发送权限。
- **Kafka out。** 一个集群配置节点（broker、SASL PLAIN 或 SCRAM-SHA-256 或 SCRAM-SHA-512、TLS），每个节点有一个主题和一个可选的键。值是 `msg.payload`，作为文本，不是文本时作为 JSON，消息在集群从每个同步副本确认之后才继续传递。它使用 franz-go，也就是核心的 Kafka 输出所用的客户端。

拒绝的服务器会在节点的错误中说明原因，其中不含任何已发送的内容。速率限制会等待一次，服务器说多久就等多久，最多一分钟，之后消息失败。没有 Slack 节点和 Teams 节点，也没有 UADP 节点：HotLoop 接收 UADP，Flow 通过 HotLoop 节点读取这些值。

已针对真实的 ntfy、真实的 Gotify 和真实的 Redpanda 验证：节点发布后，会向服务器询问它保存了什么。Discord 节点遵循 Discord 为 webhook 和机器人公布的 API。

`scan` 扫描一个 CIDR 范围并识别 Modbus 和 EtherNet/IP 端点，`netinfo` 报告运行时实际能看到的接口，在 macvlan 模式下，流程就是用它在 OT VLAN 上发现自己的地址。Modbus TCP、S7、EtherNet/IP、OPC UA 和 Sparkplug B 节点现在可以与 `scan` 找到的设备通信，它们就是下一节。

每种节点类型有一个 Go 描述符，声明其属性、端口、默认值和帮助文本，编辑器根据它渲染对话框，所以节点不可能带着与其运行时不一致的对话框发布。
