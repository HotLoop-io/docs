---
title: "与 Node-RED 的兼容性"
description: "逐个节点列出与 Node-RED 的每一处有意差异及其原因，让导入的流程得到与以前相同的结果。"
---

<!-- Generated from the node registry. Do not edit by hand, change the `Compatibility` field on the node's descriptor and regenerate: -->

一个只部分兼容却不说明哪里不兼容的节点，比一个明显缺失的节点更糟：流程看起来能运行，却悄悄做错事。下面的每个条目都必须说明缺少什么，如果有条目没有说明，测试会让构建失败。

## 各级别的含义

| 级别 | 含义 |
|---|---|
| **完全** | 行为与同类型的 Node-RED 节点一致。 |
| **部分** | 只支持一个子集。备注会准确说明缺少哪些部分。 |
| **有差异** | 有意采用不同的行为。备注会说明原因。 |
| **HotLoop Flow 专有** | Node-RED 中没有对应节点。 |

## 完全不支持的内容

**大多数 Node-RED 社区节点。** 它们是需要 Node.js 的 npm 包。需要 Node 的包不可能在这里运行。工厂实际依赖的 Modbus、仪表盘、PostgreSQL 和电子邮件，以各自的类型名称原生运行：参见 node-red-types.md。其他任何节点都会自行失败，并指明其类型，流程的其余部分照常启动。

## JSONata

每个类型为 `jsonata` 的属性都由 gnata 求值，gnata 是纯 Go 实现的 JSONata 2.x，并绑定了 Node-RED 自己的函数：`$flowContext`、`$globalContext`、`$env`、`$clone`，以及指明 `msg` 的旧形式。在已发布的 jsonata-js 2.2.2 测试套件中，1686 个用例通过 1673 个。

与 Node-RED 有三处差异。`$moment` 会被拒绝，并返回指明 `$fromMillis` 和 `$toMillis` 的错误，因为这里没有重新实现 moment.js。消息对象没有键顺序，所以 `$keys()` 以及任何遍历对象的操作看到的都是排序后的键。运行超过 10 秒的求值会以 D1012 停止，而不是拖住节点的整个队列。

## 汇总

共注册 117 种节点类型。

| 级别 | 数量 |
|---|---|
| 完全 | 12 |
| 部分 | 50 |
| 有差异 | 14 |
| HotLoop Flow 专有 | 41 |

## 通用

| 类型 | 级别 | 备注 |
|---|---|---|
| `catch` | 完全 | 不适用 |
| `comment` | 完全 | 不适用 |
| `complete` | 完全 | 与 Node-RED 一样，只监视在其范围内被明确选中的节点。 |
| `debug` | 完全 | 不适用 |
| `inject` | 部分 | 支持按间隔、启动时和 cron 计划注入。crontab 的读取方式与 Node-RED 自己的调度器 cronosjs 相同，使用进程的本地时间，包括时钟切换时缺失或重复的那一小时的处理方式。从管理 API 手动注入时总是发送已配置的属性：Node-RED 的使用这些值注入（msg.__user_inject_props__）没有实现。 |
| `junction` | 完全 | 不适用 |
| `link call` | 完全 | 调用一个 Link In，并把返回模式下的 Link Out 送回的内容继续发送，包括在调用内部发起的调用。静态目标按 id 选择。在动态模式下，msg.target 是 id 或名称，先在发起调用的流程中查找，然后在所有流程中查找，绝不会在子流程实例内部查找。在超时内没有返回的调用会抛出带有原始消息的错误；之后才到达的返回仍会发出，与 Node-RED 一致。 |
| `link in` | 完全 | 不适用 |
| `link out` | 有差异 | 两种模式都支持：发送到 Link In 节点，以及返回到发送消息的 Link Call。有一处有意的差异：未运行的 Link In，以及没有 Link Call 可返回的返回，会抛出 Catch 节点能看到的错误。Node-RED 对前者静默丢弃，对后者只记录一条警告，这使得被删除或写错的链接非常难以发现。 |
| `status` | 完全 | 不适用 |

## 配置

| 类型 | 级别 | 备注 |
|---|---|---|
| `hotloop-flow-discord-bot` | HotLoop Flow 专有 | HotLoop Flow 自带的 Discord 机器人，使用与 HotLoop core 的机器人相同的机器人令牌。 |
| `hotloop-flow-ethernetip` | HotLoop Flow 专有 | HotLoop Flow 自带的 EtherNet/IP 连接，用于访问 ControlLogix、CompactLogix 和 Micro800 控制器上的标签。它在第一次请求时连接，出现任何使连接不可信的故障时就断开，并在下一次请求时重新连接。 |
| `hotloop-flow-gotify` | HotLoop Flow 专有 | HotLoop Flow 自带的 Gotify 服务器，使用与 HotLoop core 发布报警时相同的设置。 |
| `hotloop-flow-hotloop` | HotLoop Flow 专有 | HotLoop Flow 自带的到 HotLoop 的连接。用账号登录，发送 HotLoop 返回的 bearer 令牌，并在令牌过期时重新登录。 |
| `hotloop-flow-influxdb` | HotLoop Flow 专有 | HotLoop Flow 自带的 InfluxDB 连接，目标是 App Store 的 influxdb-app。 |
| `hotloop-flow-kafka` | HotLoop Flow 专有 | HotLoop Flow 自带的 Kafka 连接，使用与 HotLoop core 的 Kafka 输出相同的设置。 |
| `hotloop-flow-mcp-server` | HotLoop Flow 专有 | HotLoop Flow 自带的到 Model Context Protocol 服务器的连接，基于 Streamable HTTP。如果有 bearer 令牌就发送，在第一次调用时连接，并在失败后的下一次调用时重新连接。 |
| `hotloop-flow-modbus` | HotLoop Flow 专有 | HotLoop Flow 自带的 Modbus TCP 连接。它在第一次请求时连接，出现任何使连接不可信的故障时就断开，并在下一次请求时重新连接。 |
| `hotloop-flow-ntfy` | HotLoop Flow 专有 | HotLoop Flow 自带的 ntfy 服务器，使用与 HotLoop core 发布报警时相同的设置。 |
| `hotloop-flow-opcua` | HotLoop Flow 专有 | HotLoop Flow 自带的 OPC UA 连接。它在首次使用时连接，能察觉服务器消失，并在下一次请求时开启新会话，对于订阅则自行开启，每次尝试之间的等待时间逐渐加长。 |
| `hotloop-flow-postgres` | HotLoop Flow 专有 | HotLoop Flow 自带的 PostgreSQL 连接。目标是 App Store 的 postgresql-app 和 timescale-db-pod，二者共用一个线路协议。 |
| `hotloop-flow-s7` | HotLoop Flow 专有 | HotLoop Flow 自带的 Siemens S7 连接，基于 TCP 上的 ISO。它在第一次请求时连接，出现任何使连接不可信的故障时就断开，并在下一次请求时重新连接。 |
| `hotloop-flow-sparkplug` | HotLoop Flow 专有 | HotLoop Flow 自带的 Sparkplug B 连接，在 MQTT 3.1.1 上既可作为边缘节点，也可作为主机应用。边缘节点可以在诞生前等待主要主机应用的 STATE，并可以依次尝试一个代理列表。主机应用只连接一个代理。指标携带数组以及 DataSet、Template 和 PropertySet 值。指标的 MetaData（文件和多部分字节）不会被携带。 |
| `modbus-client` | 部分 | TCP、TCP 上的 RTU 和串行 RTU 客户端。它在第一次请求时连接，出现任何使连接不可信的故障时就断开，并在下一次请求时重新连接，因此 reconnectOnTimeout 和 reconnectTimeout 没有什么可等待的。请求轮流使用这一个连接，因此 commandDelay、bufferCommands 以及队列和状态日志开关都不起作用。串行 ASCII（接受 RTU-BUFFERD，不接受 ASCII）不受支持。networkInterface（Node-RED 中没有）把 TCP 套接字绑定到一个网络接口，适用于端口承载多个相同子网 VLAN 的设备。被忽略的属性：`bufferCommands`、`stateLogEnabled`、`queueLogEnabled`、`failureLogEnabled`、`commandDelay`、`reconnectOnTimeout`、`reconnectTimeout`、`parallelUnitIdsAllowed`、`serialConnectionDelay`、`serialAsciiResponseStartDelimiter`。 |
| `modbustcp-server` | 部分 | 被接受，以便包含它的流程能原样加载和保存。从它读取的节点类型（modbustcp-read 和 modbustcp-write）没有提供，所以它不连接任何东西。请使用 modbus-client 配合 getter 和 write 节点。 |
| `mqtt-broker` | 部分 | MQTT 3.1、3.1.1 和 5。连接、凭据、TLS、干净会话、keepalive，以及带有 QoS、retain 标志的 birth、close 和 will 消息，在版本 5 中还包括它们的属性和 will 延迟。在版本 5 中还有会话过期间隔和连接用户属性。接收最大值、最大数据包大小和主题别名最大值设置没有实现，使用代理的默认值。TLS 是 Node-RED 的 usetls，配合用于 CA、客户端证书和服务器名称的 tls-config；由早期 HotLoop Flow 以 tls: true 保存的代理仍会使用系统根证书通过 TLS 连接。被忽略的属性：`receiveMaximum`、`maximumPacketSize`、`topicAliasMaximum`。 |
| `postgreSQLConfig` | 部分 | 基于 Flow 自带驱动的 PostgreSQL 或 TimescaleDB 连接池。每项设置都可以通过其 ...FieldType 配套项设为字符串、数字、布尔值或环境变量；其他类型（msg、flow、global）在配置节点里没有可读取的消息，会让节点停止。ssl true 会像 node-postgres 一样验证服务器证书，ssl 也可以是 disable、prefer、require、verify-full 或 no-verify。如果节点有凭据，密码就从凭据读取，否则从流程文件的 password 属性读取，与社区节点的存放方式相同。连接在第一次查询时打开，而不是在部署时，空闲连接无论 idle 设置如何至少保留一分钟，因此每秒读取一次的工厂不会每次读取都重新连接。networkInterface（Node-RED 中没有）把连接绑定到一个网络接口，节点请求的每个接口各有一个连接池。 |
| `tls-config` | 有差异 | 来自文件、环境变量、上传的 PEM 文本或 PKCS#12 包的证书、密钥和 CA，加密密钥或包可带口令，另有服务器名称、ALPN 协议和验证开关。有两处差异。路径通过机密范围读取，即数据目录加上 secrets.allowedPaths，因为能读取任意路径的 TLS 配置会成为从编辑器探测文件系统的途径。而且，损坏的配置，比如证书没有对应密钥或文件不存在，会导致部署失败。Node-RED 只是记录日志然后继续，于是连接会悄悄地不带你配置的客户端证书发出。 |
| `ui-base` | 部分 | Dashboard 2（FlowFuse）的配置，被接受，以便包含它的流程能原样加载和保存。Dashboard 2 的组件（ui-text、ui-button 等）没有提供，所以不会绘制任何内容。请使用 ui_ 节点。 |
| `ui-group` | 部分 | Dashboard 2（FlowFuse）的配置，被接受，以便包含它的流程能原样加载和保存。Dashboard 2 的组件（ui-text、ui-button 等）没有提供，所以不会绘制任何内容。请使用 ui_ 节点。 |
| `ui-page` | 部分 | Dashboard 2（FlowFuse）的配置，被接受，以便包含它的流程能原样加载和保存。Dashboard 2 的组件（ui-text、ui-button 等）没有提供，所以不会绘制任何内容。请使用 ui_ 节点。 |
| `ui-theme` | 部分 | Dashboard 2（FlowFuse）的配置，被接受，以便包含它的流程能原样加载和保存。Dashboard 2 的组件（ui-text、ui-button 等）没有提供，所以不会绘制任何内容。请使用 ui_ 节点。 |
| `ui_base` | 部分 | 仪表盘的主题：使用其名称（深色或浅色）和基础颜色。自定义字体、大小、组件颜色和站点标题会被接受，但不会应用。 |
| `ui_group` | 部分 | 标签页上的一张卡片，宽度为 width 列，按标签页的顺序排列。它的组件排布在这么多列的网格中。 |
| `ui_link` | 部分 | 一个打开其他地址的菜单项，仅限 http 或 https。图标被接受，但不会绘制。 |
| `ui_spacer` | 部分 | 分组网格中的一个空单元格，width 列乘 height 行。它不显示任何内容，也不发送任何内容。 |
| `ui_tab` | 部分 | 仪表盘的一个页面，按其顺序出现在菜单中。图标被接受，但不会绘制。被禁用或隐藏的标签页会被略过。 |
| `websocket-client` | 部分 | 向外连接，连接断开时自动重连，支持负载模式或整条消息模式。wss:// URL 与 Node-RED 一样，用系统根证书或 tls-config 的 CA，连同其客户端证书和服务器名称来检查服务器。 |
| `websocket-listener` | 部分 | 提供一个 websocket 路径，支持负载模式或整条消息模式。该路径与 HTTP In 节点共用流程的路由表，因此不能遮住编辑器或管理 API，也不会与其他节点的路径冲突。停止读取的客户端会被断开，而不是无限制地排队，这是 Node-RED 不做的。 |

## 发现

| 类型 | 级别 | 备注 |
|---|---|---|
| `netinfo` | HotLoop Flow 专有 | HotLoop Flow 自带的节点。报告运行时能看到的接口，在 macvlan 模式下，流程就是通过它得知自己在 OT VLAN 上的地址。 |
| `scan` | HotLoop Flow 专有 | HotLoop Flow 自带的节点。扫描一个 CIDR 范围以查找 OT 设备，并识别 Modbus 和 EtherNet/IP 端点。受运行时配置中的发现允许列表限制，而不是受这个对话框限制。 |

## 函数

| 类型 | 级别 | 备注 |
|---|---|---|
| `change` | 部分 | 支持对 msg、flow 和 global 目标执行 set、change、delete 和 move，包括 JSONata 类型的值。深拷贝选项会被忽略：由另一个属性设置的值与它共享，与 Node-RED 关闭该选项时一样。被忽略的属性：`dc`。 |
| `delay` | 有差异 | 六种模式都已实现，即固定、可变、随机、速率限制、按主题排队和定时释放，另有 msg.reset、msg.flush 以及用于被丢弃消息的第二个输出。有两处有意的差异：队列有上限，超过上限的消息会被拒绝给 Catch 节点而不是被保留，因为 Node-RED 无限制的队列会让速度快于排空的来源变成没有任何解释的 OOM-kill；而流程停止时仍被保留的消息会被释放，而不是被丢弃。 |
| `exec` | 有差异 | 三个输出、缓冲模式和流式模式、超时以及附加的消息属性，行为都与 Node-RED 一致。有两点不同，而且都没有商量余地。没有 shell：命令行只按引号规则拆分，未加引号的 shell 元字符会被拒绝而不是被执行，因此一条被允许的命令不可能变成任意命令。并且在操作员指明流程可以运行哪些命令之前，该节点处于禁用状态。Node-RED 的 exec 节点什么都能运行，而 Node-RED 默认启动时没有身份验证；一家厂商出货了这个默认值，结果成了 CVE-2025-41656（Pilz IndustrialPI 4，VDE-2025-045），即设备上的未经认证命令执行。每个流的输出都有上限；超过上限的命令会被终止并报告，而不是任其填满堆。自己启动子进程的命令在被终止时可能留下这些子进程。 |
| `function` | 部分 | 在 JavaScript 解释器上运行，这是一个用 Go 写的 JavaScript 解释器，而不是 Node 的 vm 模块。语言是 ES2023；Node 标准库不存在。require() 和 npm 模块不能工作，不嵌入 Node 也无法让它们工作。始终有 CPU 时间限制，Node-RED 把它设为可选且默认关闭，而这里它对每个定时器回调同样适用。setTimeout、setInterval 及其清除函数可以使用，基于节点的时钟，并且在流程停止或重新部署时每一个都会被清除。Buffer 可用（alloc、from、concat，两种字节序的整数和浮点读写方法，slice、toString 和 toJSON）。消息中的字节切片以字节数组形式到达，所以请用 Buffer.from 包装它。被忽略的属性：`libs`、`require`。 |
| `range` | 完全 | 不适用 |
| `rbe` | 部分 | 支持除非变化否则阻止和死区模式。窄带模式在此版本中没有实现。 |
| `switch` | 部分 | 支持所有比较规则，包括 JSONata 表达式规则，对属于某个序列的消息，它能看到 $I 和 $N。序列规则 head、tail 和 index 没有实现，使用其中任何一个的规则会让每条消息都因未知运算符错误而失败。被忽略的属性：`head`、`tail`、`index`。 |
| `template` | 部分 | Mustache 模板按 mustache.js 的方言实现，包括它的 HTML 转义集合和独立行的处理，因此从 Node-RED 迁来的模板会渲染出相同的字节。局部模板（{{>name}}）和自定义分隔符会被拒绝而不是被忽略，因为流程文件里没有任何东西能提供这两者。 |
| `trigger` | 有差异 | 两条消息、再触发时延长、等待重置、msg.reset、msg.delay 覆盖、按主题分组和第二个输出都已实现。差异与 Delay 节点相同：同时被激活的定时器数量有上限，超过上限的消息会被拒绝给 Catch 节点，而不是悄悄再激活一个。流程停止时仍处于激活状态且有截止时间的定时器会立即触发，而不是被丢弃；等待重置的定时器会被丢弃，因为触发它会凭空制造一个从未发生的事件。 |
| `ui_button` | 部分 | 按下时发送负载和主题，各按其类型（字面值、flow 或 global 值、上一条消息的属性、时间）。图标被接受，但不会绘制。被忽略的属性：`icon`。 |
| `ui_chart` | 部分 | 数值随时间变化的折线图和柱状图，每个 msg.topic 一条线，保留 removeOlder 乘以其单位的时长，每条线最多 removeOlderPoints 个点。负载 [] 会清空图表。饼图、极坐标图、雷达图和横向柱状图会被画成折线。由系列对象数组构建的图表以及点击某个点时的输出没有提供。被忽略的属性：`cutout`、`useDifferentColor`、`outputs`。 |
| `ui_gauge` | 部分 | 仪表盘、环形图、罗盘和波形，绘制在画布上，使用三种扇区颜色。环形图的差值模式被接受，并绘制为普通环形图。 |
| `ui_led` | 部分 | 绘制一盏指示灯，其颜色是 colorForValue 中第一个等于 msg.payload 的条目（可以是布尔值、数字或文本），在允许时也可以是 msg.color。 |
| `ui_numeric` | 部分 | 带数字负载的消息会设置值，并且在开启 passthru 时原样继续传递。操作员的更改会在 min 和 max 范围内发送 {payload, topic}。wrap 被接受并被忽略：值在上下限处停止。 |
| `ui_switch` | 部分 | 点击会发送开值或关值。关闭 decouple 时开关立即移动，开启时只有收到带该值的消息才会移动。负载等于开值或关值的消息会设置开关。图标和 animate 被接受，但不会绘制。被忽略的属性：`onicon`、`officon`、`animate`。 |
| `ui_template` | 部分 | 带有一个小型 AngularJS 风格层的 HTML：{{ }}、ng-click、ng-class、ng-init、ng-show、ng-hide、ng-if、ng-bind、scope.msg、scope.$watch、scope.send 和 scope.$eval。超出这些的指令（ng-repeat、ng-model、ng-switch、控制器、Angular Material 组件）没有提供。模板在操作员的浏览器中以页面自己的权限运行，因此它的可信程度与流程作者相当。全局作用域按局部作用域处理。 |
| `ui_text` | 部分 | 通过值格式显示 msg.payload，支持 {{msg.x}} 和 {{value}} 以及数字过滤器（{{msg.payload \| number:1}}）。标签可以包含 <br>，不能包含其他标记。Angular 的其他过滤器不受支持。 |
| `ui_text_input` | 部分 | 停止输入 delay 毫秒后、按 Enter 时，或在开启 sendOnBlur 时离开输入框时，发送文本，数字模式下发送数字。消息可以设置文本。 |

## 网络

| 类型 | 级别 | 备注 |
|---|---|---|
| `discord bot out` | HotLoop Flow 专有 | HotLoop Flow 自带的节点。 |
| `discord out` | HotLoop Flow 专有 | HotLoop Flow 自带的节点。 |
| `e-mail` | 部分 | 把 msg.payload 作为正文、msg.topic 作为主题，发送到节点的 To（name 属性），为空时发送到 msg.to。支持 msg.cc、msg.bcc、msg.from、msg.html 和 msg.attachments（[{filename, content, contentType}]），Buffer 负载会作为附件发送。secure 表示从第一个字节起就是加密连接（端口 465）。否则，当服务器提供时，节点会请求 STARTTLS。tls 表示只连接证书有效的服务器。身份验证为 BASIC（PLAIN，或回退到 LOGIN）、使用从 token 所指的消息属性中读取访问令牌的 XOAUTH2，或 NONE。除非服务器就是本主机，否则在未加密的连接上会拒绝发送密码。仅支持发送：读取邮箱的 e-mail in 节点没有提供。msg.header 和 saslformat 开关会被忽略。networkInterface（Node-RED 中没有）通过一个网络接口发送连接。被忽略的属性：`saslformat`。 |
| `ethernetip read` | HotLoop Flow 专有 | HotLoop Flow 自带的 EtherNet/IP 标签读取。配置与社区节点 node-red-contrib-cip-ethernet-ip 不同，后者在这里无法运行。 |
| `ethernetip write` | HotLoop Flow 专有 | HotLoop Flow 自带的 EtherNet/IP 标签写入。配置与社区节点 node-red-contrib-cip-ethernet-ip 不同，后者在这里无法运行。 |
| `gotify out` | HotLoop Flow 专有 | HotLoop Flow 自带的节点。 |
| `hotloop in` | HotLoop Flow 专有 | HotLoop Flow 自带的节点。跟随 HotLoop 的实时数据流（GET /api/stream），Node-RED 中没有对应功能。 |
| `hotloop recipe` | HotLoop Flow 专有 | HotLoop Flow 自带的节点。应用一个 HotLoop 配方（POST /api/recipes/{id}/apply）。 |
| `hotloop script` | HotLoop Flow 专有 | HotLoop Flow 自带的节点。运行一个 HotLoop 脚本（POST /api/scripts/{id}/run）。 |
| `hotloop state` | HotLoop Flow 专有 | HotLoop Flow 自带的节点。从 HotLoop 读取一个实体的状态（GET /api/states/{entity_id}）。 |
| `http in` | 有差异 | 提供一个路径，支持 Express 风格的 :params 和结尾的 *，并构建与 Node-RED 相同的 msg.req / msg.res / msg.payload 形态，包括 JSON、表单编码和原始请求体。有三处有意的差异。没有任何 HTTP Response 节点应答的请求，会在超时后以 504 关闭，而不是永远保持打开，因为 Node-RED 的版本每个请求会泄漏一个连接，直到进程耗尽套接字并停止应答，而日志里什么也没有。两个声明相同方法和路径的节点会在部署时被拒绝，而不是其中一个悄悄地永远不触发。会遮住编辑器或管理 API 的路径也因同样的原因被拒绝。上传的解析方式与 Node-RED 中的 multer 一致：文本字段进入 msg.payload，文件进入 msg.req.files，损坏的上传以 500 应答。有一个 multer 没有的限制：字段名中超过 10,000 的数组下标 a[99999999] 会被拒绝，而不是构建这么长的稀疏数组。msg.req.cookies 是 cookie-parser 的，包括 j: 值。被忽略的属性：`swaggerDoc`。 |
| `http request` | 部分 | 方法、URL、请求头、基本身份验证、重定向和三种返回类型，msg.url、msg.method 和 msg.headers 会覆盖节点的设置。响应体有大小上限，调用受超时约束，这两点 Node-RED 都没有。TLS 来自 tls-config，没有的话，msg.rejectUnauthorized = false 会像 Node-RED 一样，只对这一条消息跳过证书检查。msg.cookies 和 cookie 请求头通过 cookie jar 发出，重定向设置的 cookie 会跟随重定向，msg.responseCookies 和 msg.redirectList 会返回，这些都与 Node-RED 一致。带对象负载的 multipart/form-data 内容类型会把它作为表单发送。代理设置和连接保持在此版本中没有实现。没有出站允许列表：这个节点能到达 pod 能到达的一切，与 Node-RED 的节点完全一样，限制它的地方应是 NetworkPolicy，而不是一个集群之外无人能信任的编辑对话框。networkInterface（Node-RED 中没有）把连接绑定到一个网络接口。被忽略的属性：`proxy`、`persist`。 |
| `http response` | 部分 | 状态码和请求头来自节点，或来自 msg.statusCode 和 msg.headers，负载作为响应体。msg.cookies 设置和清除 cookie 的方式与 Express 为 Node-RED 所做的完全一致，包括各种选项；如果有多个，它们按名称顺序发出，而不是按对象构建的顺序。 |
| `kafka out` | HotLoop Flow 专有 | HotLoop Flow 自带的节点。 |
| `mcp client` | HotLoop Flow 专有 | HotLoop Flow 自带的节点。调用 Model Context Protocol 服务器上的工具，或列出它拥有的工具。 |
| `mcp result` | HotLoop Flow 专有 | HotLoop Flow 自带的节点。应答由 mcp tool 节点发起的调用。 |
| `mcp tool` | HotLoop Flow 专有 | HotLoop Flow 自带的节点。在 /mcp 把一个流程作为 Model Context Protocol 工具提供给调用方，调用方的认证方式与管理 API 相同，Node-RED 中没有对应节点。 |
| `modbus read` | HotLoop Flow 专有 | HotLoop Flow 自带的 Modbus TCP 读取。配置与社区节点 node-red-contrib-modbus 不同，后者在这里无法运行。 |
| `modbus write` | HotLoop Flow 专有 | HotLoop Flow 自带的 Modbus TCP 写入。配置与社区节点 node-red-contrib-modbus 不同，后者在这里无法运行。 |
| `modbus-flex-getter` | 部分 | 从 msg.payload 取得 {fc, unitid, address, quantity}。输出和失败的处理与 Getter 相同。不支持 I/O 文件（useIOFile），请求它的节点不会启动。networkInterface（Node-RED 中没有）把该节点的连接绑定到一个网络接口。没有它时，依次使用节点所在标签页的 FLOW_NETWORK_INTERFACE、客户端的接口，然后是主机的选择。被忽略的属性：`useIOFile`、`ioFile`、`useIOForPayload`、`logIOActivities`。 |
| `modbus-flex-write` | 部分 | 从 msg.payload 取得 {value, fc, unitid, address, quantity}。输出和失败的处理与 Write 节点相同。networkInterface（Node-RED 中没有）把该节点的连接绑定到一个网络接口。没有它时，依次使用节点所在标签页的 FLOW_NETWORK_INTERFACE、客户端的接口，然后是主机的选择。 |
| `modbus-getter` | 部分 | 收到消息时读取，使用节点自己的地址和数量。输出携带 msg.payload、msg.responseBuffer（{data, buffer}）、msg.input 和 msg.modbusRequest。失败会连同 msg.error 从第二个输出发出，设置了 emptyMsgOnFail 时还会从第一个输出发出一条空消息。不支持 I/O 文件（useIOFile），请求它的节点不会启动。networkInterface（Node-RED 中没有）把该节点的连接绑定到一个网络接口。没有它时，依次使用节点所在标签页的 FLOW_NETWORK_INTERFACE、客户端的接口，然后是主机的选择。被忽略的属性：`useIOFile`、`ioFile`、`useIOForPayload`、`logIOActivities`。 |
| `modbus-read` | 部分 | 流程启动后（设置了 delayOnStart 时在 startDelayTime 之后）每隔 rate rateUnit 轮询一次，并在消息到达时读取。输出与 Getter 相同，msg.topic 由节点设置。不支持 I/O 文件（useIOFile），请求它的节点不会启动。networkInterface（Node-RED 中没有）把该节点的连接绑定到一个网络接口。没有它时，依次使用节点所在标签页的 FLOW_NETWORK_INTERFACE、客户端的接口，然后是主机的选择。被忽略的属性：`useIOFile`、`ioFile`、`useIOForPayload`、`logIOActivities`。 |
| `modbus-server` | 部分 | 基于四个缓冲区（coils、holding registers、input registers、discrete inputs）的 Modbus TCP 服务器，缓冲区大小由节点设置。带有 msg.payload = {register, address, value} 的消息会设置值，其中 register 是 holding、coils、input 或 discrete，value 是一个值或一个列表。客户端的写入从第一个输出（holding registers）或第二个输出（coils）发出。第三个和第四个输出属于 input registers 和 discrete inputs，客户端无法写入它们，所以不发送任何内容，第五个输出携带错误。所有 unit id 上的请求都由同样的缓冲区应答。不支持串行。networkInterface（Node-RED 中没有）在开始监听之前把监听套接字绑定到一个网络接口，因此每台机器各有一个 VLAN 的设备可以在每个 VLAN 上用相同的地址和端口各运行一个服务器。节点自己的设置优先，其次是标签页的 FLOW_NETWORK_INTERFACE。被忽略的属性：`logEnabled`、`showStatusActivities`。 |
| `modbus-write` | 部分 | 用功能码 5、6、15 或 16（取合适的那个）写入 msg.payload（一个值，或长度为 quantity 的列表）。输出是带有 msg.responseBuffer 的传入消息，失败从第二个输出发出。networkInterface（Node-RED 中没有）把该节点的连接绑定到一个网络接口。没有它时，依次使用节点所在标签页的 FLOW_NETWORK_INTERFACE、客户端的接口，然后是主机的选择。被忽略的属性：`logIOActivities`。 |
| `mqtt in` | 部分 | 带 QoS 和负载解码的主题订阅，在 MQTT 5 上支持 no local、retain as published 和 retain handling 选项，消息的属性放在 msg.userProperties、msg.contentType、msg.responseTopic、msg.correlationData 和 msg.messageExpiryInterval 中，其内容类型像 Node-RED 的一样引导自动识别解码。通过控制消息进行动态订阅没有实现。 |
| `mqtt out` | 部分 | 使用来自节点或消息的主题、QoS 和 retain 发布，在 MQTT 5 上还有内容类型、响应主题、关联数据、消息过期和用户属性，来自节点或来自 msg.contentType、msg.responseTopic、msg.correlationData、msg.messageExpiryInterval 和 msg.userProperties，没有其他主题时以 msg.responseTopic 作为主题。不使用主题别名：始终发送完整主题。连接和断开连接的控制消息没有实现。被忽略的属性：`topicAlias`。 |
| `ntfy out` | HotLoop Flow 专有 | HotLoop Flow 自带的节点。 |
| `opcua read` | HotLoop Flow 专有 | HotLoop Flow 自带的 OPC UA 读取。配置与社区节点 node-red-contrib-opcua 不同，后者在这里无法运行。 |
| `opcua subscribe` | HotLoop Flow 专有 | HotLoop Flow 自带的 OPC UA 订阅。配置与社区节点 node-red-contrib-opcua 不同，后者在这里无法运行。 |
| `opcua write` | HotLoop Flow 专有 | HotLoop Flow 自带的 OPC UA 写入。配置与社区节点 node-red-contrib-opcua 不同，后者在这里无法运行。 |
| `s7 read` | HotLoop Flow 专有 | HotLoop Flow 自带的 Siemens S7 读取。配置与社区节点 node-red-contrib-s7 不同，后者在这里无法运行。 |
| `s7 write` | HotLoop Flow 专有 | HotLoop Flow 自带的 Siemens S7 写入。配置与社区节点 node-red-contrib-s7 不同，后者在这里无法运行。 |
| `sparkplug command` | HotLoop Flow 专有 | HotLoop Flow 自带的 Sparkplug B 命令发送器，作为主机应用。 |
| `sparkplug in` | HotLoop Flow 专有 | HotLoop Flow 自带的 Sparkplug B 监听器。在主机连接上，它跟随它能看到的每个边缘节点。在边缘连接上，它转交发给它的命令。 |
| `sparkplug out` | HotLoop Flow 专有 | HotLoop Flow 自带的 Sparkplug B 发布器，用于边缘节点或其某个设备。 |
| `tcp in` | 有差异 | 监听或向外连接，支持带分隔符的流模式，或收集直到对端关闭的单次模式，负载可为 buffer、字符串或 base64。每条消息都携带 msg._session，以便 TCP Out 节点可以在同一连接上回复。有三个 Node-RED 没有的限制：接受的连接数、一条带分隔符消息的大小，以及单次模式读取的总量。打开连接后从不关闭，或不断发送却从不发送分隔符的对端，否则会让堆不断增长直到 pod 终止。通过 tls-config 的 TLS 双向都可用：监听方出示配置的证书，客户端检查服务器的证书。 |
| `tcp out` | 部分 | 连接到一个主机并发送，或在 TCP In 节点接受的连接上回复，通过 msg._session 找到该连接。仅为了向入站连接写入而监听它们（Node-RED 的第三种模式所做的）没有实现：用 TCP In 节点负责监听那一半，再用回复模式的本节点。通过 tls-config 的 TLS 适用于客户端模式；回复沿着 TCP In 节点接受的连接返回，无论有没有 TLS。 |
| `tcp request` | 部分 | 连接、发送负载并等待回复，支持 Node-RED 的四种等待模式中的任意一种：固定时间、分隔符、字节数，或直到对端关闭。msg.host 和 msg.port 会覆盖节点的设置。每个请求都打开自己的连接，Node-RED 的连接复用模式没有实现，而复用连接会改变等待模式的语义，因为这些模式都在连接边界处结束。使用 tls-config 时，除非配置说不检查，否则会检查服务器的证书。Node-RED 的 TCP Request 无论配置怎么说都从不检查，这让它的 TLS 成了画在门上的一把锁。networkInterface（Node-RED 中没有）把连接绑定到一个网络接口。 |
| `udp in` | 部分 | 接收数据报，可选择加入一个多播组，负载可为 buffer、字符串或 base64，发送方的地址在 msg.ip 和 msg.port 中。IPv6 和按节点选择接口在此版本中没有实现。被忽略的属性：`ipv6`。 |
| `udp out` | 部分 | 向主机、广播地址或多播组发送数据报，msg.ip 和 msg.port 会覆盖节点的设置。IPv6 在此版本中没有实现。networkInterface（Node-RED 中没有）把套接字绑定到一个网络接口。被忽略的属性：`ipv6`。 |
| `websocket in` | 完全 | 每个帧发出一条消息，并携带 msg._session，以便 WebSocket Out 节点可以回复它来自的那个连接。 |
| `websocket out` | 有差异 | 回复 msg._session 指定的连接，没有指定时像 Node-RED 一样向每个打开的连接广播。差异在于连接跟不上时会发生什么：帧会被拒绝给 Catch 节点并关闭连接，而不是无限制地排队。如果改为阻塞，就会把慢速浏览器的背压推进流程的调度器，这比失去一个已经停止读取的连接更糟。 |

## 解析器

| 类型 | 级别 | 备注 |
|---|---|---|
| `csv` | 部分 | 支持解析为对象和从对象渲染，分隔符和表头处理可配置。跨越不同消息的多行带引号字段不会被重新拼接。 |
| `html` | 部分 | 用 CSS 选择器提取元素，返回内部 HTML、文本或属性，每个匹配一条消息，或一条包含数组的消息。选择器引擎涵盖类型、id、类、属性、后代、子元素和逗号分组。伪类、伪元素、兄弟组合器以及属性运算符 ~= 和 \|= 会在部署时被拒绝，而不是被忽略，因为悄悄丢掉 :nth-child 的选择器会匹配到错误的元素却继续工作。返回的 HTML 由解析树重新渲染，因此是规范化后的标记，而不是原始字节。 |
| `json` | 部分 | 支持双向转换。支持模式验证，既可对照 msg.schema（与 Node-RED 一样），也可对照节点设置中的模式。验证器不是 Ajv：除非模式指明了其他草案，否则读取草案 2020-12，拒绝指向模式之外任何内容的 $ref，并忽略它不认识的 format 关键字。 |
| `xml` | 部分 | 双向转换，使用 xml2js 的对象约定：属性放在 "attr" 所指的键下（默认 $），元素文本放在 "chr" 下（默认 _），每个子元素都是数组，这是 xml2js 自己的 explicitArray 默认值。把 ew_explicitArray 设为 false 可折叠单个子元素。Node-RED 传给 xml2js 的每条消息的 msg.options 不被采纳，xml2js 的其他选项会改变输出的形态，悄悄忽略其中一个会产生流程意想不到的对象，看起来却像是成功了。命名空间保留为元素名称的一部分，而不是被解析。被忽略的属性：`options`。 |
| `yaml` | 完全 | 双向转换，没有设置动作时根据值的类型切换，与 Node-RED 的一样。 |

## 序列

| 类型 | 级别 | 备注 |
|---|---|---|
| `batch` | 有差异 | 按数量分组，支持重叠并遵守传入序列的结尾；按时间间隔分组，可带或不带空序列；以及按主题连接序列，支持 msg.reset，与 Node-RED 一致。Node-RED 接受的两种配置会被拒绝：小于一的数量，它会悄悄当作一来读取；以及为零的间隔，这会让每条消息永远被保留。 |
| `join` | 有差异 | 与 Node-RED 一样的自动、手动和 reduce 模式：按 msg.parts.index 放置、Split 记录的分隔符、嵌套序列、数组、字符串、缓冲区、以消息属性为键的对象、合并的对象、accumulate、msg.complete、msg.reset、msg.restartTimeout、超时，以及带有 $A、$I 和 $N 以及可选 fixup 的 reduce 表达式。有一处有意的差异：收到没有 msg.parts 的消息的自动 join 会抛出错误，而不是记录一条警告。 |
| `sort` | 完全 | 按元素本身或对每个元素求值的 JSONata 键对数组属性排序，并按属性或对每条消息求值的 JSONata 键对消息序列排序。 |
| `split` | 有差异 | 按分隔符、字节序列或长度拆分数组、对象、字符串和缓冲区，包括流模式，它会把未完成的片段带到下一条消息。msg.parts 与 Node-RED 的一致，包括分隔符和嵌套序列。有三处有意的差异：对象按排序后的键顺序拆分，因为 Go 的 map 没有顺序；字符串按字符数而不是 UTF-16 码元数拆分，所以不会有字符被切成两半；无法拆分的负载会抛出错误，而不是凭空消失。 |

## 存储

| 类型 | 级别 | 备注 |
|---|---|---|
| `file` | 有差异 | 追加、覆盖和删除，文件名来自字面值、消息属性、上下文或环境，支持 utf8、base64、hex 或 raw 编码。差异在于路径范围：文件节点只能访问数据目录和操作员另外列出的位置，并通过符号链接解析，所以放在 PVC 上的链接无法指向其外部。Node-RED 的文件节点接受任何路径，这使得编辑流程等同于读取进程能读到的任何文件。写入默认会 fsync，Node-RED 则不会。 |
| `file in` | 有差异 | 整文件、按行和分块读取，输出为 utf8、base64、hex 或 raw。路径范围与 File 节点相同，原因也相同。读取同样有大小上限：Node-RED 把整个文件读入内存而没有限制，所以把节点指向错误路径会导致 OOM-kill 而不是错误。超过上限时，节点会说明触及了哪个限制，以及按行或分块模式本来可行。 |
| `influxdb out` | HotLoop Flow 专有 | HotLoop Flow 自带的节点。类型名称与社区节点 node-red-contrib-influxdb 一致，让导入的流程能找到它，但配置并不完全相同：导入后请检查各字段。 |
| `postgres` | HotLoop Flow 专有 | HotLoop Flow 自带的节点。写入和读取 PostgreSQL 或 TimescaleDB，对消息序列支持批量插入。 |
| `postgresql` | 部分 | 把查询作为针对消息的 Mustache 模板运行（{{{msg.topic}}} 和 {{{topic}}} 都可用，并以文本形式放入值，所以更推荐使用 $1、$2 配合 msg.params，它们会作为参数发送给数据库）。msg.payload 是行的列表，msg.pgsql 是 {command, rowCount}。开启 split 时，行按每次 rowsPerMsg 行发出（为 1 时是行对象，否则是列表），并带 msg.parts，有两个输出时，第二个输出会在最后一组发出后发送一条消息。msg.queryParameters（命名参数）不受支持。失败的查询会为 Catch 节点抛出错误。networkInterface（Node-RED 中没有）通过一个网络接口发送该节点的查询。 |
| `watch` | 有差异 | 报告文件和目录的出现、变化和删除，消息形态与 Node-RED 产生的相同。它采用轮询，而不是使用内核的通知接口，因此变化会在轮询间隔内被发现而不是立即发现，同一间隔内的两次变化只报告一次。这是有意的取舍：fsnotify 意味着要写各平台的代码，以及一个属于构建限制的文件名后缀，这已经让这个代码库损失了一天。路径范围与其他文件节点相同，被监视的条目数有上限，使得对大型目录树的递归监视不会拖住运行时。 |
