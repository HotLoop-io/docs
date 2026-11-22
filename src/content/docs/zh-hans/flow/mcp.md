---
title: "双向 MCP"
description: "智能体可以把流程当作工具来调用，流程也可以调用任何 MCP 服务器上的工具，只需三个节点和一个配置节点。"
---

能说 Model Context Protocol 的智能体可以把流程当作工具来调用，流程也可以调用任何 MCP 服务器上的工具，包括 HotLoop 自己的。三个节点加一个配置节点就能做到：`mcp tool` 和 `mcp result` 对外提供流程，`hotloop-flow-mcp-server` 连接上的 `mcp client` 向外调用。如果您只是把传感器接到仪表板上，可以跳过这一切：不使用这些节点的流程从不发起 MCP 调用，Flow 自己提供的工具只有读取和修改其流程的那些（[见下文](#flow-自己的工具)）。

协议采用 Go SDK（`github.com/modelcontextprotocol/go-sdk` v1.8.0，宽松许可，项目完成许可证变更前部分文件仍为 MIT，由 MCP 项目维护）。它在同一个端点上同时支持规范的当前修订版 2026-07-28（没有握手，每个请求都带版本）和直到 2025-11-25 的握手修订版。客户端用哪个版本打开连接就得到哪个版本，因此无需配置。

## 作为工具的流程

`mcp tool` 节点声明一个工具：名称、给读取它的模型看的说明，以及输入模式。流程部署期间，Flow 在 `/mcp` 提供该工具（如果您移动了管理根路径，则在其下）。一次调用会变成从节点发出的消息，`msg.payload` 是调用的参数，`msg.topic` 是工具名称，`msg.mcp` 包含 `tool`、`caller` 和 `callId`。下游某处的 `mcp result` 节点把答案送回，就像 `http response` 回应 `http in` 一样。两者之间的一切都是普通的流程。

```json
[
  {"id": "t1", "type": "tab", "label": "Line"},
  {"id": "tool", "type": "mcp tool", "z": "t1", "toolName": "line_status",
   "description": "Status of a production line: its state and speed.",
   "schema": "{\"type\":\"object\",\"properties\":{\"line\":{\"type\":\"string\",\"enum\":[\"L1\",\"L2\",\"L3\"]}},\"required\":[\"line\"],\"additionalProperties\":false}",
   "x": 100, "y": 100, "wires": [["status"]]},
  {"id": "status", "type": "function", "z": "t1", "name": "status", "outputs": 1,
   "func": "msg.payload = {line: msg.payload.line, state: 'running', askedBy: msg.mcp.caller};\nreturn msg;",
   "x": 300, "y": 100, "wires": [["answer"]]},
  {"id": "answer", "type": "mcp result", "z": "t1", "x": 500, "y": 100, "wires": []}
]
```

**模式会在流程运行之前检查。** 它是 JSON Schema，读取方式与 `json` 节点相同（除非模式指定了别的草案，否则为草案 2020-12，指向其他 URL 的 `$ref` 是错误）。模式无效、根不是对象、工具名称不被 MCP 允许，或两个节点提供同一个名称，都会使该节点的部署失败，并给出原因。参数不符的调用会收到指出错误字段的工具错误，`arguments.line: value must be one of "L1", "L2", "L3"`，模型据此修正后可以重试，而流程根本看不到这次调用。对象载荷会以对象和其 JSON 文本两种形式返回，文本则以文本返回，由 Catch 节点供给的 `mcp result`，或勾选了 "The work failed" 的，会以带有该错误原话的工具错误作答。无人应答的调用会在应答超时（不设置则为 30 秒）后被告知，错误则交给 Catch 节点。重新部署会等待进行中的调用完成。

**智能体和其他调用者一样。** `/mcp` 只接受管理 API 接受的令牌，即会话令牌或 API 令牌，别的都不行。没有匿名调用：没有令牌是 401，Flow 不认识的令牌是 401，没有 `mcp.call` 权限的令牌是 403，这些都发生在协议看到请求之前。以 `HOTLOOP_FLOW_INSECURE` 运行的实例对每个 `/mcp` 请求都返回 403，因为工具调用必须有调用者才能写入审计日志。智能体的令牌和其他令牌一样：

```yaml
auth:
  tokens:
    - name: agent
      hash: sha256:...          # from: hotloop-flow token -name agent
      permissions: ["mcp.call"]
      rateLimit: {calls: 60, per: 1m}   # optional; no rateLimit, no limit
```

调用以该身份的权限运行。每个调用者都需要 `mcp.call`（或 `mcp.*`，或 `*`）。如果在工具的 "Extra permission" 框里填入另一个权限，比如 `mcp.line3`，调用者还需要那一个，没有它，列表里也看不到这个工具。两个智能体可以共用一个 Flow，看到不同的工具。

**可以限制令牌的调用次数。** `auth.tokens` 中 API 令牌的 `rateLimit` 是一个时间窗口 `per` 内的 `calls`，省略则为一分钟。窗口从该令牌的第一次调用开始，超出次数的调用会被拒绝，直到窗口结束，然后重新计数。被拒绝的调用不会到达流程，并以一个告知需要等待多少秒的工具错误作答，这样陷入循环的智能体会用它能读懂的话被告知放慢速度。规范没有为此定义错误，所以用它已为无法完成的调用定义的工具错误。没有 `rateLimit` 的令牌从不被限流，会话令牌也不受限制，因为它属于某个人。每个令牌各自计数，计数保存在内存中，因此重启后重新开始。一次拒绝是一条原因为 `rate limit exceeded` 的 `mcp.refused` 记录，所以调用洪水也会留在审计日志中。

**每次调用都以调用者的名义记入审计日志。** `mcp.call` 在流程运行前写入，包含工具、节点和调用 ID，`mcp.result` 在运行后写入，包含结果和耗时毫秒数。`mcp.refused` 表示令牌错误、令牌缺少权限、调用了不允许调用的工具，或参数不符。参数本身从不写入。完全没有令牌的请求也不写入，因为对端没有可以署名的人。`GET /audit?event=mcp.` 可读取全部记录，`?user=token:agent` 可缩小到某一个智能体。

用 MCP 项目自己的检查器试一试，它不需要 Flow 提供任何东西：

```bash
npx @modelcontextprotocol/inspector@2.12.0 --cli http://localhost:1880/mcp \
  --transport http --header "Authorization: Bearer $TOKEN" \
  --method tools/call --tool-name line_status --tool-arg line=L3
```

流程测试会把一次调用本应产生的消息放在 `mcp tool` 节点所在的位置，`mcp result` 则把它本应作出的回答以 `{isError, text, structuredContent}` 的形式交给测试，因此无需服务器就能测试流程。

## Flow 自己的工具

如果智能体只能调用流程作者接好的东西，它就看不到流程，也无法修改流程，所以 Flow 在同一个 `/mcp` 上，在流程的工具之外，提供 45 个自己的工具。它们既能读也能写。其中七个与流程有关，见下表，其余是管理 API 的其他路由：设置、面板、审计日志、部署详情与差异、导出、流程测试、消息跟踪、运行时数据、第二因素重置，以及图表和仪器：列出和读取图表、运行和停止它、操作它的调试器、设置其面板上的控件，以及切换仪器的写入。MCP 页面列出每个工具、其路由和权限，以及少数不是工具的路由及原因。

| 工具 | 作用 | 权限 |
|---|---|---|
| `list_flows` | 每个标签页和子流程：ID、标签、是否禁用、节点数和修订号 | `flows.read` |
| `get_flows` | 编辑器读取到的整个已部署集合，附修订号 | `flows.read` |
| `get_flow` | 按 ID 取得一个标签页或子流程及其节点 | `flows.read` |
| `deploy_flows` | **deploy**：用您读取的修订号和一条备注替换整个集合 | `flows.write` |
| `list_deployments` | 部署历史，最新的在前 | `flows.read` |
| `rollback_deployment` | **回滚**到较早的部署，记为一次新的部署 | `flows.write` |
| `inject_node` | 用您自己的消息**触发**一个 inject 节点 | `inject.write` |

它们都不是第二套实现。每个工具都以端点已认证的调用者身份，运行管理 API 中负责同一工作的处理程序，因此一次部署会遇到从编辑器部署时遇到的一切：文档必须能解析，修订号必须是当前的（空修订号是有意覆盖），在传输内容上不一致的连线会被拒绝，不允许的插件会被拒绝，失败的流程测试会拒绝部署，每种情况都用该路由自己的话说明。部署历史记录调用者和备注，审计日志中除了每次工具调用留下的 `mcp.call` 和 `mcp.result` 记录外，还有以调用者名义写入的 `deploy` 或 `inject` 记录。调用者需要 `mcp.call` 和该工具自己的权限，不允许调用的工具不会出现在其列表中。这些工具在部署后依然存在，部署只会撤下流程自己的工具，流程也不能提供与它们同名的工具。

`deploy_flows` 会替换整个集合，所以智能体要先读取 `get_flows`，修改后连同拿到的 `rev` 一起发回。

## 调用其他服务器上的工具

`mcp client` 节点在消息到达时，通过 `hotloop-flow-mcp-server` 连接调用工具：服务器的 MCP 地址、如果需要则填承载令牌，以及超时。工具和它的参数是有类型的输入，所以两者都可以来自消息。当工具有结构化答复时，`msg.payload` 就是该答复；当它说的全是文本时是文本；是其他内容时则是原样的内容，`msg.mcp` 包含服务器、工具和完整的答复。另一个操作 "List the tools" 会把服务器拥有的每个工具连同说明和输入模式放进 `msg.payload`。

报告错误的工具会抛出错误，附上服务器的原话，因此 Catch 节点看到的就是模型会看到的内容。**调用绝不会发送两次。** 工具可能会让设备动作，而断开的连接并不能说明服务器是否执行了它，所以错误只说连接失败，下一条消息会重新连接。令牌只发往您给定的地址，不会去别处，不跟随重定向，错误中也绝不重复令牌。该连接只信任系统的证书根，不信任其他。

对 HotLoop 来说，就是它的 `/mcp` 地址和其发布版 Secret 中的 `mcp-token`，HotLoop MCP 文档中的每个工具都在其中：

```json
{"id": "plant", "type": "mcp client", "z": "t1", "server": "hotloop",
 "tool": "get_plant_status", "toolType": "str", "arguments": "{}", "argumentsType": "json",
 "x": 300, "y": 100, "wires": [["use"]]}
```

HotLoop 把这次调用视为 MCP 客户端的调用，按它自己的规则处理：MCP 能读能写，与其他所有人走同一道关口，所以对已布防且在范围内的变量执行 `write_tag` 会通过（在开启 HotLoop 自己的写入之后），而它拒绝的调用，比如无人标记为可写的变量，会以 HotLoop 的话作为节点的错误返回。若要不经 MCP、从流程中通过 HotLoop 的关口写入，请使用上面的 HotLoop 节点。

## 测试对象

**服务器**使用 Go SDK 自带的客户端，在真实 HTTP 上对两个时代都做了测试：列出、调用、被拒绝的参数、被拒绝的权限、被拒绝的令牌、审计记录、节点停止后消失的工具，以及前面放着完整管理服务器、使用真实 API 令牌和会话令牌、审计日志落盘的整套环境。MCP 项目的 Inspector CLI 2.12.0 列出了一个运行中的 Flow 的工具，调用了它们，并在没有令牌和使用伪造令牌时被拒绝。`mcp client` 节点针对真实的 HotLoop 4.18.10（已发布的 IoT 镜像）运行：它列出了全部 27 个工具，调用了 `get_plant_status`、`list_devices` 和 `get_states` 并使用了答复，使用错误令牌和没有令牌时被拒绝，对不存在的工具和 MCP 不允许进行的写入收到了 HotLoop 自己的错误，而由 Inspector 调用的一个 Flow 工具运行了一个调用 HotLoop MCP 的流程，并以 HotLoop 的答复作答。

**未完成：** OAuth（承载令牌是唯一的进入方式，两个方向都是）、stdio 服务器、资源、提示、采样、征询和进度通知，以及工具的输出模式。HotLoop 4.18.10 使用握手修订版，所以节点以那种方式与它连接；对于当前修订版的服务器，只用 Flow 自己的服务器测试过。忘记会话的握手服务器（重启后）会使之后的第一次调用失败一次，下一次调用会重新连接。限流按 API 令牌计，设置之前是关闭的，所以没有 `rateLimit` 的令牌只受已有上限的队列和请求大小 4 MiB 的约束。
