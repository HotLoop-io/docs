---
title: "管理 API"
description: "编辑器和命令行使用的 HTTP 与 websocket 调用，每个调用需要什么，返回什么。"
---

| 方法和路径 | 权限 | 说明 |
|---|---|---|
| `GET /health` | 无 | 存活检查。kubelet 不带令牌，在这个路由上要求认证会让 Pod 永远陷入重启循环。 |
| `GET /ready` | 无 | 就绪检查，单独报告，这样启动失败的运行时会被移出 Service，而 kubelet 不会杀掉 Pod。 |
| `POST /auth/token` | 无 | 登录。锁定期间返回带 `Retry-After` 的 429。 |
| `POST /auth/revoke` | 无 | 登出。 |
| `GET /auth/mode` | 无需登录 | 此运行时是否从 EmberCORE 仪表板打开：`{"dashboard": bool, "hideLogin": bool}`。编辑器在任何人登录之前就会询问它。 |
| `GET /auth/mfa`, `POST /auth/mfa/setup`, `/confirm`, `/disable` | 已登录用户 | 你自己的两步登录。Setup 返回密钥、`otpauth://` 链接和二维码。Confirm 和 disable 接收 `{"code": ...}`。 |
| `POST /auth/mfa/reset` | `auth.admin` | 关闭别人的两步登录：`{"username": ...}`。 |
| `GET /metrics` | 无 | Prometheus。只有计数和节点 id，从不包含消息内容或配置。 |
| `GET /settings` | `settings.read` | |
| `GET /nodes` | `nodes.read` | 注册表，驱动编辑器的面板及其对话框。 |
| `GET /plugins` | `nodes.read` | 已加载的插件、每个插件请求了什么以及获得了什么，以及被拒绝的插件和原因。 |
| `GET /flows` | `flows.read` | |
| `GET /flows/export` | `flows.read` | 与磁盘上完全一致的流程文件，用于 git。 |
| `POST /flows` | `flows.write` | 部署。可带一条可选的备注，写入部署日志。 |
| `GET /deployments` | `flows.read` | 部署日志，最新的在前，不含负载。`?limit=N` 限制数量。 |
| `GET /audit` | `audit.read` | 谁从哪里做了什么，最新的在前。`?event=`、`?user=`、`?since=`、`?limit=`。 |
| `GET /deployments/{seq}` | `flows.read` | 一条记录，其流程已解析。绝不包含它的凭据。 |
| `GET /deployments/{seq}/flows` | `flows.read` | 该次部署的流程文件，逐字节一致。 |
| `GET /deployments/{from}/diff/{to}` | `flows.read` | 两次部署之间逐节点的差异，结构化形式和文本形式。 |
| `POST /flows/diff` | `flows.read` | 正在运行的内容与请求体中文档之间的差异。不部署任何东西。 |
| `POST /flows/types` | `flows.read` | 部署会进行的类型化连线检查，针对请求体中的文档：`{"wires": [...]}`，没有问题时为空。编辑器据此绘制结果。不部署任何东西。 |
| `POST /deployments/{seq}/rollback` | `flows.write` | 把该记录的流程和凭据作为一次新部署重新部署。接收 rev 头和可选的 `{"note": ...}`。 |
| `GET /tests` | `flows.read` | 与流程文件放在一起的流程测试套件、它的文件名，以及部署是否受它把关。 |
| `PUT /tests` | `flows.write` | 替换套件。请求体是 YAML；无法解析的会返回带原因的 400。 |
| `POST /tests/run` | `flows.read` | 针对请求体中的 `"flows"` 或正在运行的内容，运行套件或请求体中的 `"tests"`。返回报告。不部署任何东西。 |
| `POST /tests/from-debug` | `flows.read` | 根据 `{"node", "msgId"}`，也就是 Debug 节点显示过的一条消息，起草一个测试。不保存任何东西。 |
| `POST /tests/cases` | `flows.write` | 把请求体中的测试，也就是它们自己的测试文件，追加到套件末尾。 |
| `GET /traces` | `flows.read` | 保留的追踪，最新的在前，附带缓冲区的内容及其限制。`?limit=N`。`trace.enabled: false` 时返回 404。 |
| `GET /traces/find` | `flows.read` | 某条消息所在的追踪，根据 `?msgId=` 和 `?node=`，也就是侧边栏显示的 id 和 Debug 节点。返回每一跳以及到被查询那一跳的路径。 |
| `GET /traces/{id}` | `flows.read` | 一条追踪，每一跳带有耗时和节点收到时的消息。 |
| `POST /traces/{id}/test` | `flows.read` | 根据追踪起草一个流程测试。不保存任何东西。 |
| `POST /traces/{id}/replay` | `flows.read` | 在子进程中，把发起该追踪的消息送入请求体中的 `"flows"` 或正在运行的内容，并返回它这次到达的位置与上次到达位置的对比。不部署任何东西。 |
| `GET /runtime/stats` | `status.read` | |
| `POST /inject/{id}` | `inject.write` | 触发一个 Inject 节点。 |
| `GET /comms` | `status.read` | 编辑器的状态与调试 websocket。把令牌作为子协议 `hotloop-flow.bearer.<token>` 发送，与 `hotloop-flow` 一起提供。编辑器就是这样做的。URL 中的 `?access_token=<token>` 对已在使用它的脚本仍然有效，并且每个这样连接的请求都会记录一条警告，因为 URL 会留在代理和访问日志中。 |
| `POST /mcp`（以及用于旧版协议的 `GET` 和 `DELETE`） | `mcp.call` | [MCP 端点](/zh-hans/flow/mcp/)，流程在这里作为工具提供。和其他一样使用会话令牌或 API 令牌。提供给调用者并且它可以调用的工具，是它的权限所能触及的那些。关闭认证时返回 403。 |

`/metrics` 和 `/health` 不需要认证是一个决定，而不是疏忽。Prometheus 采集器不带 bearer 令牌，所以要求令牌意味着要么把凭据交给你的监控系统，要么没有监控。

开启两步登录的用户在向 `POST /auth/token` 发送用户名和密码时附带 `"code"`。没有它，响应是带有 `"mfa": "required"` 的 401。

权限可以是代表全部的 `"*"`、像 `flows.read` 这样的精确字符串，或像 `flows.*` 这样的前缀授权。把流程作为 MCP 工具来调用的智能体需要 `mcp.call`。一个只想显示流程状态的仪表板，使用只读账户 `["flows.read", "status.read"]` 就够了，不需要更多。

部署可以带一个可选的 `HotLoop-Flow-Deployment-Rev` 头。发送你最后读取的修订版本，与另一个编辑器竞争的部署会被 409 拒绝，而不是悄悄覆盖某人的工作，这种故障你只会从丢掉了整个下午的人那里听说。

部署只重启你更改过的内容。当节点所依赖的东西都没有变化时，它保持运行：它的设置、标签页、分组、环境、凭据，以及它点名的每个配置节点。在画布上拖动它或重新连线不算，因为新的连线是接到正在运行的节点上的。所以修正一个函数节点里的拼写错误，不会再让盒子上所有的 MQTT 会话掉线，而保存着十分钟读数的 Delay 节点会继续保存。这就是它存在的全部原因：当每次保存都让工厂抖一下，操作员在班次期间就不再保存，修复要等到周六。

用 `HotLoop-Flow-Deployment-Type` 头选择重启范围。Node-RED 的 `Node-RED-Deployment-Type` 同样有效，所以你已有的部署脚本能得到它所要求的重启。

| 类型 | 重启的内容 |
|---|---|
| `nodes`（默认） | 你更改的节点，以及点名了你更改的配置节点的所有内容。 |
| `flows` | 任何包含更改的流程上的每个节点。 |
| `full` | 全部。等同于重启进程。 |

响应会说明它做了什么：`type`、`started`、`restarted`、`stopped` 和 `unchanged`。途中处理的内容不会丢失。已在被替换节点上排队的工作会在旧实例上完成，替换期间到达的内容等待新实例，发往你已删除节点的消息会被计数并显示为丢弃，而不是凭空消失。
