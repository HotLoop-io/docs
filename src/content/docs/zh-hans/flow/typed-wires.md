---
title: "带类型的连线"
description: "在 json 节点上放一个 JSON Schema，检查连线上的消息：形状不对的消息会到达 Catch 节点，并指出每一个错误的字段。"
---

形状不对的消息，是我们在运行中的产线上最不想遇到的故障。温度以字符串 `"hot"` 的形式到来，缺了 `id`，本该是列表的地方来了一个数字：什么都不会崩溃，流程继续运行，而下游的某个环节悄悄地做了错事。Flow 分三步用 JSON Schema 来解决这个问题。

## `json` 节点上的 Schema

在 `json` 节点的设置里给它一个 Schema，它处理的每个值都会按它检查。匹配的值继续往下走。不匹配的值进入 Catch 节点，不会沿连线继续，错误会指出每一个错误的字段：

```
does not match the schema: payload.temp: got string, want number; payload.id: missing property "id"
```

`msg.schemaError` 以 `{path, keyword, message}` 对象列表的形式携带同样的内容，供想据此路由的 Catch 节点使用。路径的读法与 Change 节点的写法一致：`payload.sensors[2].temp`。

如果节点的设置里没有 Schema，而消息带有 `msg.schema`，节点就按它来验证，和 Node-RED 的 `json` 节点一样。通过的消息会去掉 `msg.schema`。失败的消息会保留它。两者都有时，设置里的 Schema 优先。

- 除非用 `$schema` 指明其他草案，否则 Schema 是 JSON Schema draft 2020-12。草案 4、6、7 和 2019-09 也都接受。
- 设置里的 Schema 无效时，部署会失败，并给出验证器的原因。无效的 `msg.schema` 是该消息上的一个错误。
- Schema 是自包含的。指向其他 URL 或文件的 `$ref` 会被拒绝，不会去获取，所以没有出口路由的边缘盒子和其他盒子表现一致。
- `format` 只对验证器认识的格式进行检查，其余忽略，和大多数验证器一样。
- 任何地方都没有 Schema 的流程，行为与以前完全一样。

Flow 里其他任何需要按 Schema 检查值的地方，用的都是同一个包。

## 端口上的 Schema

任何节点都可以声明它接受什么，以及每个输出端口承诺什么。节点上有两个可选的键，都写在流程文件里，读取该文件的其他工具都会忽略它们，所以带着它们的流程仍然可以逐字节地来回转换：

```json
{"id":"sensor","type":"function","outputs":2,"wires":[["limit"],[]],
 "ew_outSchemas":[{"type":"object","properties":{"payload":{"type":"object",
   "required":["temp"],"properties":{"temp":{"type":"number"}}}}}, null]},
{"id":"limit","type":"switch","wires":[[],[]],
 "ew_inSchema":{"type":"object","required":["topic"]}}
```

`ew_inSchema` 是节点接收的内容。`ew_outSchemas` 是一个列表，每个输出端口对应一个 Schema 或 `null`。Schema 描述整条消息，所以 payload 是 `properties.payload`。以下划线开头的键，即 `_msgid` 和运行时的其他内部记录，不在它看到的范围内，因此封闭的 Schema 不必列出它们。它们和 `json` 节点的一样是 JSON Schema，由同一个包检查。

**编辑器能看出来的不匹配，在部署时就被拒绝。** 当连线两端都声明了 Schema，而没有任何消息能同时满足两者时，部署会在写入任何一个字节之前被拒绝，和测试闸门一样：返回 422，什么都不重启，什么都不保存，审计记录里留下原因为 `typed wires` 的 `deploy.refused`。

```
the deploy was refused because of 1 typed wire problem, and the flows already running are untouched; junction "sensor" (sensor) output 1 -> "limit" (limit): payload.temp: the sender sends string and the receiver takes number
```

它只拒绝能够证明的情况。同一字段的类型不同，值超出另一端的 `enum` 或范围，接收方要求而发送方的封闭 Schema 排除了的字段，发送方总会发送而接收方的封闭 Schema 拒绝的字段。发送方只是没有提到接收方要求的字段，不会被拒绝，因为消息很可能带着它；使用 `$ref`、`allOf`、`anyOf`、`oneOf`、`not` 或 `if` 的 Schema，在那一部分不会被质疑。错误的拒绝会无谓地拦住一次部署，而它无法证明的情况仍会在运行时被捕获。无法编译的 Schema，或者比节点输出数更长的 `ew_outSchemas`，同样会被拒绝。回滚不做检查，原因和回滚不受测试把关相同。

**Inject 节点的字面量算作一种类型。** Inject 没有自己的 Schema，但它确定会设置的内容，价值不亚于一个 Schema。当 Inject 直接连到带有 `ew_inSchema` 的节点时，字面量 payload 以及它设置的其他字面量属性，会在部署时按该 Schema 检查，接收方永远无法接受的字面量会以同样的方式被拒绝，返回同样的 422，审计记录里留下同样的 `deploy.refused`：

```
inject "reading" (i1) output 1 -> "limit" (l1): payload: the inject sets "hot", which the receiver does not take: got string, want number
```

只检查字面量：字符串、数字、布尔值或 JSON。时间戳、环境变量、流程或全局上下文、另一个消息属性、JSONata、缓冲区或正则表达式，在节点触发之前是未知的，所以会被跳过，绝不猜测。Inject 没有设置的必填属性也不算冲突，因为非静态的值可能会设置它。只判断从 Inject 到节点的那条连线：先经过其他节点的字面量，留给运行时检查。编辑器会在那条连线上画出同样的冲突。

**它看不出来的，会交给 Catch 节点和一个指标。** 到达某节点并违反其 `ew_inSchema` 的消息，永远不会到达该节点。离开某端口并违反其 Schema 的消息，在发送方就被拦下，永远不会送达。无论哪种情况，都会作为持有该 Schema 的节点的错误抛出，Catch 节点收到它时，`msg.error.message` 里有每个错误字段的路径，`msg.error.violations` 里是列表，每项为 `{path, keyword, message}`：

```
the message does not match the schema of output 1: payload.temp: got string, want number
```

`hotloop_flow_node_schema_mismatches_total` 按节点统计这些情况，也统计 `json` 节点的不匹配。没有 Schema 的节点只多一次 nil 检查，完全没有 Schema 的流程行为与以前完全一样。

## 编辑器里连线上的类型

任一端带有类型的连线会带着这个类型。编辑器把类型写在连线上，位于曲线中点：发送方的类型用几个字符显示（`payload {temp: number}`），把鼠标悬停在连线上则显示完整信息。

- **两端都声明了类型且一致：** 绿色轮廓，显示发送方的类型。
- **只有一端声明了类型：** 虚线且颜色变淡，让你看出哪条连线还没有类型。
- **两端都声明了类型却永远无法一致：** 连线和它的标签变红并指出是哪个字段，`≠ payload.temp`，提示里有运行时给出的原因。部署会拒绝它，而现在你在点 Deploy 之前就能看到。

这个红色不是编辑器在猜。它向运行时发出询问，`POST /flows/types`，运行的正是部署用来拒绝的那个检查，所以画布和部署不可能不一致。只有当画布上有东西带 Schema 时，编辑器才会询问，在最后一次编辑之后稍等片刻。没有 Schema 的流程不会发出调用，也不会多画任何东西。

在节点的对话框里，**Types** 下设置类型：一个输入 Schema，以及每个输出端口各一个。留空表示没有类型，从没设置过类型的节点不会多出这些键。写入不是 JSON 或者不是对象的内容，会在对话框中被拒绝。
