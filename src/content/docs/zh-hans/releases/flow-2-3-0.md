---
title: "Flow 2.3.0 发布说明"
description: "HotLoop Flow 2.3.0 带来了什么，升级时有什么变化，以及动手改动运行中的工厂之前该读什么。"
sidebar:
  label: "2.3.0"
---

HotLoop Flow 2.3.0 这个版本里，Flow 以三种新方式触达工厂的其余部分，并在形状不对的消息造成损害之前拦下它。它能与 HotLoop 通信，智能体可以通过 MCP 把流程当作工具来调用，而插件是一个签名的 WebAssembly 文件，不是 npm 包。JSON Schema 现在会在 `json` 节点、节点端口以及编辑器中的连线上检查消息。有一项变更可能影响已在运行的流程，它是“变化”下的第一条。

## 新功能

**HotLoop 节点**
- `hotloop-flow-hotloop` 连接，由一个 URL 和一个账户组成。它用 `POST /api/auth/login` 登录，发送 HotLoop 返回的 bearer 令牌，并在 HotLoop 说会话已失效时重新登录。以下所有功能，操作员账户就够用。
- `hotloop in` 跟随 HotLoop 的实时数据流，每当一个实体状态变化就发送一条消息：`msg.topic` 是实体 ID，`msg.payload` 是新状态，`msg.hotloop` 携带它之前的状态、属性、质量和时间戳。如果链路断开，徽标变红，一次中断只会有一个错误到达 Catch 节点，而不是每次重试一个。恢复后，期间发生变化的实体会被发送，没变的则不发送。
- `hotloop state` 在消息到达时读取一个实体。`hotloop script` 用你给出的字段运行一个 HotLoop 脚本。`hotloop recipe` 带着参数应用一个配方，你有意要求时也可以应用旧版本。HotLoop 检查每个字段和参数，让每次写入都经过它的写入关卡，并保留记录。Flow 发送原因 `flow:<node id>`，HotLoop 把它记录在写入审计和日志簿中。
- 被拒绝或失败的调用会带着 HotLoop 自己的原话和状态到达 Catch 节点。已写入的内容不会被撤销，因为这也是 HotLoop 的规则。

**通过 HotLoop 关卡写入**
- `modbus write`、`opcua write`、`s7 write` 和 `ethernetip write` 新增两个字段，**通过 HotLoop 写入**和 **HotLoop 标签**（`device/tag`）。选定 HotLoop 后，值会进入 HotLoop 的写入关卡，由它按顺序判断：写入已开启、标签已布防、值在范围内。
- 关卡拒绝的写入永远不会到达设备。无法连上的 HotLoop 同样会让写入失败。它绝不会退回到直接写入，因为那将是一次关卡从未见过的写入。
- 标签使用 HotLoop 自己的地址、数据类型和比例，所以 Flow 节点上的地址和数据类型不会被使用。清空 HotLoop 会让节点完全恢复原样。关卡每次写入只接受一个布尔值、数字或文本，所以寄存器列表会被拒绝，并附上说明这一点的消息。

**MCP，双向**
- `mcp tool` 和 `mcp result` 把一个流程作为工具对外提供。工具节点声明名称、描述和输入模式，Flow 在 `/mcp` 提供它，结果节点把流程的答案送回去。智能体像其他人一样用会话或 API 令牌登录，调用以该令牌的权限运行，每次调用和拒绝都以调用者的名字记入审计日志。没有令牌，就没有调用。
- `mcp client` 通过 `hotloop-flow-mcp-server` 连接，调用任何 MCP 服务器上的工具，包括 HotLoop 自己的，并使用返回的结果。它绝不会把一次调用发送两次，因为工具可能会移动设备，而断开的连接不会说明调用是否执行了。
- `auth.tokens` 中的 API 令牌可以带一个包含 `calls` 和时间窗口的 `rateLimit`，省略时窗口是一分钟。超出限制的调用永远不会到达流程，会作为工具错误返回并说明何时重试，同时写入一行带原因的 `mcp.refused`。没有 `rateLimit` 的令牌永远不会被限流。
- 它在同一端点上支持规范的当前修订版 2026-07-28，以及回溯到 2025-11-25 的握手修订版。不使用这些节点的流程从不发起 MCP 调用，Flow 也不会提供未被赋予的工具。

**无需 npm 的插件**
- 插件由一个 WebAssembly 模块、一个供编辑器绘制其对话框的描述文件，以及覆盖两者的 ed25519 签名组成。未签名和被篡改的插件拒绝加载并说明原因。`hotloop-flow plugin keygen` 生成密钥，其余内容见 `docs/plugins.md`。
- 超出内存上限或超时的来宾（guest）会触发陷阱并转到 Catch 节点，其他一切继续运行。请求操作员未授予的主机访问权限（`clock`、`random`、`context.flow`、`context.global`）的插件，会让使用它的任何流程的部署在写入任何字节之前就失败。
- 没有受信任的密钥时，每个插件都被拒绝；没有授权时，每个请求主机访问的插件都会失败。默认什么都不加载。
- 图表在 `plugins` 下接收所有这些，附带一个接受任意 Kubernetes 卷来源的卷。关闭时什么都不渲染，默认值的 `helm template` 与之前相同。

**带类型的连线**
- 在 `json` 节点的设置中给它一个 JSON Schema，它处理的每个值都会据此检查。不匹配的值会进入 Catch 节点，而不是沿连线继续，错误会指明每个错误字段，比如 `payload.temp: got string, want number`。设置中没有模式时，节点按 `msg.schema` 验证，和 Node-RED 的 `json` 节点一样。除非模式指明了别的草案，否则使用 draft 2020-12，指向其他 URL 或文件的 `$ref` 会被拒绝，不会被获取。
- 节点可以用流程文件中的两个键声明它接受什么、每个输出承诺什么，其他工具会忽略这两个键，所以带有它们的流程依然逐字节往返。当连线两端都声明了模式，而没有任何消息能同时满足两者时，部署会在写入任何字节之前被拒绝。Flow 无法提前看出的不匹配会停在它们破坏模式的地方，带着每个错误字段的路径进入 Catch，并计入 `hotloop_flow_node_schema_mismatches_total`。
- 设定了下一个节点永远无法接受的字面值的 `inject`，比如把数字 250 送进只接受 0 到 100 的节点，在部署时同样会被拒绝。时间戳、`env`、上下文和 JSONata 会被跳过，从不猜测。
- 编辑器会在每条连线上写出发送方的类型。只有一端有类型时显示为淡色，两端永远无法一致时显示为红色，红色来自运行时自己的检查，所以画布和部署不会相互矛盾。在节点对话框的**类型**部分设置它们。

这是又增加的九种节点类型，共 79 种：五种属于 HotLoop 及其连接，四种属于 MCP 及其连接。

## 变更内容

- `json` 节点以前会忽略 `msg.schema`。现在，带有 `msg.schema` 的消息会据此验证，不匹配时会进入 Catch 节点，而不是沿连线继续。出于其他目的在消息上留着 `msg.schema` 的流程会注意到这一点。
- 现在部署可能因类型不匹配被拒绝（`deploy.refused`，原因 `typed wires`），但只针对在端口上声明了模式，或把 `inject` 字面值设入某个已声明模式的节点的流程。任何地方都没有模式的流程，行为与之前完全一样。
- 写入节点带有这两个新字段，默认为空。没有选择 HotLoop 时，写入节点的行为与 2.2.0 一致。
- 模式验证器是 `santhosh-tekuri/jsonschema` v6（宽松许可），MCP 使用 Go SDK `modelcontextprotocol/go-sdk` v1.8.0。两者都是新的 Go 模块，所以镜像在 `/usr/share/doc/hotloop-flow/` 中携带的许可证文本条目更多了。WebAssembly 运行时在 2.2.0 中就已存在。
- 持久队列的三项修复。被移除的持久连线现在会拒绝迟到的写入并把它计为丢弃，移除一条连线也不再为卡在某条消息上的目标等待整个关闭超时。以前，连线消失后被交回的消息会一直占用配额直到重启。丢弃最旧消息的连线不再挤掉已确认的消息或泵刚读取的消息，那会把同一块空间归还两次，使队列深度和配额低于磁盘上的实际量。`docs/durable/README.md` 中关于持久配额的文字现在说明，被转移的消息可能让配额暂时超出几条消息。
- README 和 `docs/bench/` 带有 Raspberry Pi 5 的结果，路线图勾掉了 Pi 5，保留 Pi 4、Zero 2 W 和 SD 卡写入为未完成。

## 升级说明

从 2.2.0 升级只需更换镜像（`helm upgrade`，或在你的 Quadlet 单元里换上新标签）。无需迁移，无需标志，首次启动没有新内容。在 2.2.0 上运行的 `flows.json` 和配置文件在 2.3.0 上照样运行，流程文件的逐字节往返保持不变。

- 对任何不使用新节点或新键的流程，回退到 2.2.0 是安全的。HotLoop、MCP 或插件节点在 2.2.0 上无法启动（未知节点类型），选了 HotLoop 的写入节点在 2.2.0 上会直接写入其设备，因为 2.2.0 不读取该字段。回退之前，先把这些写入节点上的 HotLoop 去掉。
- HotLoop 会记录 Flow 所登录的账户。API 没有给客户端提供指明自身操作者的办法，所以 Flow 节点 ID 作为原因写入，账户则是连接上的那个。如果想方便地找到它的写入，请使用专为 Flow 创建的账户。
- MCP 是进入 Flow 的新途径，需要令牌。在流程拥有 `mcp tool` 节点之前不会提供任何服务，没有令牌或使用伪造令牌的调用会被拒绝。

## 新设置

| YAML | 环境变量 | 默认值 |
|---|---|---|
| `plugins.dir` | `HOTLOOP_FLOW_PLUGINS_DIR` | 空，即 `data.dir` 中的 `plugins` |
| `plugins.trustedKeys` | `HOTLOOP_FLOW_PLUGIN_TRUSTED_KEYS` | 无。每一项是 `ed25519:<base64>`、PEM 公钥，或包含其中之一的文件。一项都没有时，每个插件都被拒绝。 |
| `plugins.grants` | `HOTLOOP_FLOW_PLUGIN_GRANTS` | 无。插件名称对应 `clock`、`random`、`context.flow`、`context.global`。变量格式为 `name=cap,cap;name=cap`。 |
| `plugins.maxMemoryMiB` | `HOTLOOP_FLOW_PLUGIN_MAX_MEMORY_MIB` | 64，范围 1 到 4095 |
| `plugins.maxTimeout` | `HOTLOOP_FLOW_PLUGIN_MAX_TIMEOUT` | `5s` |
| `auth.tokens[].rateLimit.calls`, `.per` | | 0 次调用，即不限制。设置了 `calls` 而没设 `per` 时，`per` 为 `1m`。 |

HotLoop 和 MCP 连接在编辑器中设置：URL、账户和超时。图表在 `values.yaml` 的 `plugins` 下包含所有插件设置，带有 `enabled: false`，此外没有任何新内容。

镜像：`ghcr.io/hotloop-io/hotloop-flow:2.3.0`，linux/amd64 和 linux/arm64。图表：`https://hotloop.io/hotloop-flow/`。此标签的 README 有其余内容：https://github.com/HotLoop-io/hotloop-flow/blob/v2.3.0/README.md
