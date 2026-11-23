---
title: "基于租约的热备"
description: "两个 Flow 安装分担同一份工作：PostgreSQL 中的一份租约，加上对设备每次写入的围栏，因此同一时刻只有一个在写。"
---

两个 Flow 安装可以分担一个安装的工作。其中一个是写入方：只有它向设备发送任何内容。另一个是备用方：它运行同样的流程，读取、订阅并保持上下文处于热状态，但在取代写入方之前，扣留每一次对设备的写入。如果写入方死掉、挂起或失去连接，备用方大约在一个租约的时长内接手，而原来的写入方在夺回租约之前不能再写。

这适用于重启不够快、而第二个写入方比短暂等待更糟的情况。如果重启足够快，单个安装加上 Kubernetes 重新调度更简单，也是 chart 默认所做的。

## 工作原理

租约是两个安装都能访问的 PostgreSQL 中的一行。写入方每隔几秒续约一次。备用方以同样的节奏尝试获取，并且只有在租约过期之后才能得到。每当持有者变化，该行上的围栏编号就会增加，Flow 会报告它。

每次对设备的写入在发送之前都会问同样的问题：我是否持有租约，且剩余时间比一次写入所需的更多？如果不是，该写入会被拒绝，并产生一个计数的错误，送到流程的 Catch 节点，什么都不会发送，连连接都不会建立。这个在每次写入时刻做出的检查，就是阻止两个安装同时写入的原因：

- 持有者从它请求租约的那一刻开始计算租约，绝不从答复返回的那一刻开始，所以它永远不会以为自己拥有比数据库更长的时间。
- 当剩余租约少于一次写入所需（`writeMargin`）时，持有者停止写入，这发生在租约到期之前。备用方只能在租约到期之后获取它。所以存在一个间隙，而没有重叠。
- 被冻结后又恢复的持有者，或被切断后又重新连接的持有者，会发现自己的租约已经没了，拒绝自己的写入，并像其他任何人一样去申请租约。
- 租约何时结束由数据库的时钟决定，所以两台时钟不一致的机器仍然就谁持有租约达成一致。

会发问的写入是那些能向设备下达命令的写入：`modbus write`、`s7 write`、`opcua write` 和 `ethernetip write`，无论是直接写入还是通过 HotLoop 的写入门，还有 `hotloop script` 和 `hotloop recipe` 节点，以及在 FlowLab 图表中的串行写入、会写入的仪器命令（外加该仪器自己的写入开关）和 HotLoop 写入。向 MQTT 代理、数据库或通知发送消息不受围栏限制：它不是对设备的命令，重复发送是无害的，而重复的设定值可能并非如此。流程测试代表外部世界，永远不会被扣留。

## 它的代价，以及它不能给您什么

- **接管时间**大约是租约的时长。使用默认值（15 秒租约，每 5 秒续约一次，5 秒余量）时，备用方在写入方被杀掉之后 14.7 秒接管。租约为 6 秒时是 5.7 秒。正常停止的写入方会交出租约，备用方在 0.35 秒内接管。
- **耗时超过 `writeMargin` 的写入**可能比租约活得更久。请让执行写入的节点的协议超时低于它。进程被冻结时已经在途的写入已经通过了检查，仍然可能到达。
- **至少一次。** 收到了一次写入但确认丢失的 PLC，可能会看到新的写入方把它再发一遍。这对设定值是安全的，对脉冲或增量则不然，所以请写设定值，不要写增量。
- **队列保持在本地。** 持久连线和上下文位于每个安装自己的磁盘上。死掉的写入方上排队的内容不在备用方那里。
- **数据库是一项依赖。** 无法访问它的写入方无法续约，并在租约不足时停止写入。请把租约放在一个可用性至少和它所保护的设备一样高的数据库上。

## 设置

把 Flow 安装两次，作为两个 Helm release 或两个 Quadlet 单元，各有自己的卷，并让两者指向同一个租约。给第二个与第一个相同的流程文件，并通过推送到工作站（[推送到租户的工作站](/zh-hans/flow/stations/)）保持一致，因为 Flow 不会在两者之间复制流程。

| 设置 | 环境变量 | 说明 |
|---|---|---|
| `failover.urlFile` | `HOTLOOP_FLOW_FAILOVER_URL_FILE` | 存放租约数据库 PostgreSQL URL 的文件。设置它就会开启故障转移。 |
| `failover.name` | `HOTLOOP_FLOW_FAILOVER_NAME` | 租约。两者相同。默认 `flow`。 |
| `failover.holder` | `HOTLOOP_FLOW_FAILOVER_HOLDER` | 此安装自己的名称。两者之间必须不同，默认是主机名。 |
| `failover.ttl` | `HOTLOOP_FLOW_FAILOVER_TTL` | 一次授予持续多久，因此大约就是接管时间。默认 `15s`。 |
| `failover.renewEvery` | `HOTLOOP_FLOW_FAILOVER_RENEW_EVERY` | 持有者多久再次申请一次。默认是 ttl 的三分之一。 |
| `failover.writeMargin` | `HOTLOOP_FLOW_FAILOVER_WRITE_MARGIN` | 一次写入需要剩下多少租约。默认 `5s`。 |

当设置会使持有者在两次续约之间低于其余量时，例如余量与 ttl 一样长，Flow 拒绝启动。

在 chart 中它们是 `failover.urlSecret`（一个其键中存放 URL 的 Secret，作为文件挂载，绝不放进 ConfigMap）、`failover.name`、`failover.ttl`、`failover.renewEvery` 和 `failover.writeMargin`。使用 Quadlet 时它们是上面的环境变量，URL 是作为文件挂载的 Podman 密钥：

```ini
Environment=HOTLOOP_FLOW_FAILOVER_URL_FILE=/run/secrets/flow-lease-url
Environment=HOTLOOP_FLOW_FAILOVER_NAME=line3
Secret=hotloop-flow-lease-url,type=mount,target=flow-lease-url
```

## 如何查看

- `GET /failover`（以及 MCP 工具 `get_failover`）会说明此安装是 `active`、`standby` 还是 `lost`，谁持有租约，它持有的围栏编号，以及它按写入来源扣留了多少次写入。它需要 `status.read`，并且只有在设置了故障转移时才存在。
- 编辑器会在备用方以及已失去租约的持有者上显示横幅。
- 指标端点有 `hotloop_flow_failover_active`、`hotloop_flow_failover_epoch`、`hotloop_flow_failover_takeovers_total` 和 `hotloop_flow_failover_refused_total{op}`。
- 两个安装都会记录它们何时获得租约，以及何时被夺走。

## 已证实的内容，与未证实的内容

已在两个真实的 Flow 进程上，对着一个真实的 PostgreSQL 和一个记录每次写入的 Modbus TCP 服务器得到证实，每个安装每 200 ms 写入一个带标签的值：写入方在数据流中途被杀掉时，备用方在一个租约之后接管，备用方的任何写入都没有出现在写入方最后一次写入之前或之后（0 和 0）；写入方被冻结超过租约时长后恢复，它没有再写入；写入方正常停止时，备用方在 0.35 秒内接管。针对上述每条写入路径的测试表明，备用方或过期持有者的写入会在任何内容发送之前被拒绝，也表明在门打开时同样的写入会被发送。

未证实：真实 PLC 对重复写入的行为、租约之下的数据库故障转移，以及只在一个方向上被切断的网络。Modbus 服务器是一个会说该协议的模拟器。故障转移没有在集群上试过，chart 的值和 Quadlet 的行是渲染并检查过的，没有安装。编辑器横幅中的文字没有经过母语者审阅。
