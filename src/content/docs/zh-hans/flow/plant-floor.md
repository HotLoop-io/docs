---
title: "工厂车间现场"
description: "Modbus TCP、OPC UA、Sparkplug B，以及其他与 PLC 和代理对话的节点，还有每一个都对着什么运行过。"
---

Flow 通过 Modbus TCP、S7、EtherNet/IP、OPC UA 和 Sparkplug B 与 PLC 和代理对话。每一种都是一个保存设备连接的配置节点，加上指向它的动作节点，形态与 InfluxDB 节点相同，编辑器和其他所有节点一样，根据描述文件构建每个对话框。

没有任何东西是从 HotLoop 的驱动里复制来的，那些驱动采用另一种许可证，并将保持如此。

**Modbus TCP** 是 `hotloop-flow-modbus` 服务器上的 `modbus read` 和 `modbus write`。支持保持寄存器、输入寄存器、线圈和离散输入。寄存器可按 uint16、int16、uint32、int32、float32、uint64、int64 或 float64 读取，字节顺序和字顺序做成了开关，因为你产线上的两台设备在这两项上不会一致，手册也不会写明。数量指的是值的个数，不是寄存器数，所以两个 float32 在线路上是四个寄存器。地址从零开始，与线路上传输的一致，对话框和错误信息都会明说：手册里的寄存器 40001 就是地址 0。

**S7** 是 `hotloop-flow-s7` 服务器上的 `s7 read` 和 `s7 write`，使用 TCP 之上的 ISO。gos7 是该协议的 Go 实现，里面没有 Snap7 的 C 库，这很重要，因为 Snap7 是 LGPL，我们不会把它链接进我们发布的产品。地址按西门子的写法书写：`DB1.DBX0.0`、`DB1.DBW4`、`M10.2`、`MW20`、`I0.0`、`QB4`，德文写法用 `E` 和 `A`。大小字母必须与数据类型一致，所以按 float32 读取的 `DB1.DBW0` 会在发往任何地方之前被拒绝，并附上你本意的地址。对位使用数量 3，是从你指定的那一位起的三位。字符串是 S7 的 STRING：写入先读它的最大长度，装不下的文本会被拒绝，而不是写过界。位用协议自己的位写入来写，只改变那一位，字节里另外七位不动。S7-1200 或 S7-1500 在允许 PUT/GET 并关闭数据块的 Optimized block access 之前，对一切都说不，错误信息也会这么说，因为这是每个人都会栽的地方。

**EtherNet/IP** 是 `hotloop-flow-ethernetip` 控制器上的 `ethernetip read` 和 `ethernetip write`，是 ControlLogix、CompactLogix 和 Micro800 上的标签访问。你按 Logix 的拼写方式指定标签，包括成员（`Pump1.Speed`）、数组元素（`Samples[4]`）和位（`Status.3`），以及它所持有的数据类型。数量大于 1 时，会从指定元素起移动相应数量的数组元素。用错误类型读取的标签会被拒绝，错误信息会让你使用标签自己的类型。到 CPU 的路径默认是 `1,0`，除非你修改，直接连接的控制器则留空。PLC-5、SLC 和 MicroLogix 说的是 PCCC，不是 CIP 标签，不在支持之列。没错，这个库被标为 beta。它是现有最新的版本，我们宁可告诉你，也不愿略过不提。

**OPC UA** 是 `hotloop-flow-opcua` 服务器上的 `opcua read`、`opcua write` 和 `opcua subscribe`。安全模式为 None、Sign 或 SignAndEncrypt，策略为 Basic256Sha256 或 Aes128_Sha256_RsaOaep，可用匿名或用户名加密码。客户端证书来自 `tls-config`（它需要在使用者备用名称里有一个应用 URI），没有它时，节点每次流程启动都会生成一个一次性证书并记录一条警告，因为这样每次都得告诉服务器去信任一个新的证书。如果你设置了服务器指纹，节点会拒绝任何其他证书。如果不设置，它会接受服务器出示的任何证书，这只是给对话加了密，并不能证明你在和谁交谈。请固定它。

**Sparkplug B** 是 `hotloop-flow-sparkplug` 连接上的 `sparkplug out`、`sparkplug in` 和 `sparkplug command`，这个连接要么是边缘节点，要么是主机应用，因为每一种都有一条遗嘱消息，而一个 MQTT 连接只有一条。作为边缘节点，连接在连上时诞生，把每个 `sparkplug out` 节点作为边缘节点自己的指标或某个设备的指标发布，被切断时带着它的遗嘱死亡（下一次诞生时使用新的 bdSeq，让主机能区分会话），在正常断开之前发送 NDEATH，并回应重生请求。每个指标都必须在节点上声明，因为一次诞生会在任何数据发送之前列出所有内容。边缘节点上的 `sparkplug in` 是流程对命令作出动作的方式。作为主机应用，它按规范要求发布 STATE，带着遗嘱、retain 标志和必须一致的时间戳，然后跟踪它能看到的每个边缘节点：名称和别名来自诞生，数据类型来自诞生，检查序列号，死亡会把诞生时列出的内容标记为过期，当缺口没有在重排超时内补上，或者出现来自它从未见过诞生的节点的数据时，就请求重生。`sparkplug command` 发送 NCMD 或 DCMD，类型取自诞生，诞生给出别名时按别名发送。通过 MQTT 客户端库使用 MQTT 3.1.1。线路格式是根据 Eclipse 的 schema 和 3.0 规范手写的，并对照用 Google 的 protobuf 编译的那份 schema 做了测试，那是与我写的不同的实现。它还对着真实的 Mosquitto 运行过，并手动对着一个独立的 Sparkplug 实现运行过，边缘节点和主机两个方向都有。

边缘节点可以指定一个**主要主机应用**。它订阅该主机的 STATE，在主机说自己在线之前，什么都不说，既不发 NBIRTH，也不发 DBIRTH。比最后一次在线 STATE 更早的死亡证书属于旧会话，会被忽略。当前的则会引发 NDEATH、断开和重新开始。**其他代理**列表就是它重新开始的地方：一次一个，轮流尝试，当某个代理连不上、主机在那里离线，以及有多个代理时主机从未在那里发布过，就转向下一个。只有一个代理时，主机离线只会让边缘节点保持连接地等着，直到主机恢复。边缘节点一次只在一个代理上，规范就是这么说的。数组类型、**DataSet**、**Template** 以及指标的 **PropertySet** 都支持双向传输：数组采用规范给出的紧凑小端形式，DataSet 为 `{columns, types, rows}`，Template 为定义或带参数和成员的实例，任何指标上的属性写作 `{"engUnit": "degC", "Quality": {"type": "Int32", "value": 192}}`。定义不在 NBIRTH 里的 Template 实例会在诞生时被拒绝，并说明要声明什么。Eclipse 的 schema 能从线路上读出它们每一个，而它自己的字节也能反向读回。未完成：指标的元数据（文件和多部分字节）、能与多个代理通信的主机应用，以及 MQTT 5。

**当设备沉默时。** 这是工厂车间一整天都在做的事，所以用难看的方式来测试，对着真实的模拟器，中间夹一条吞掉流量的线路（挂死的 PLC）或者猛地关门的线路（断电的 PLC）。没有得到响应的读或写会在超时内失败，并用文字说明（`no answer from 10.20.1.15:502 within 3s. The device is silent. Check that it is powered...`），关闭连接，并在下一条消息时打开新连接。OPC UA 订阅自己会发现，把徽标变红，每次中断为 Catch 节点抛出一个错误，而不是每次重试一个，先等 1 秒，再逐步延长到 30 秒，并在服务器回来时恢复订阅。无需重新部署。错误会指出要改的东西：Modbus 异常码及其通常含义，OPC UA 状态码以及它指向哪个设置，表示 PUT/GET 已关闭的 S7 拒绝，被拒绝的连接与沉默的连接的区别。一个接受连接却从不回应端点发现的 OPC UA 服务器，只会让发出询问的节点付出它的超时，对其他任何节点毫无代价：该服务器上的其他节点，以及一个正在停止的流程，都不会排在它后面。

**HotLoop** 是 `hotloop-flow-hotloop` 连接上的 `hotloop in`、`hotloop state`、`hotloop script` 和 `hotloop recipe`，这个连接由一个 URL 和一个账户构成。Flow 与 HotLoop 并排运行，只从外部调用它的 HTTP API，别无其他，从不选择 HotLoop 的流程永远不会发起调用。连接用 `POST /api/auth/login` 登录，发送 HotLoop 返回的 bearer 令牌，并在 HotLoop 说会话已不存在时重新登录。一个操作员账户就足以供四个节点以及下面经过闸门的写入使用。只有当 HotLoop 完全不要求登录时，才把用户名留空。

`hotloop in` 跟随 HotLoop 的实时数据流（`GET /api/stream`），并为每个状态发生变化的实体发送一条消息：`msg.topic` 是实体 id，`msg.payload` 是新状态，`msg.hotloop` 包含实体 id、之前的状态、它的属性、质量和时间戳。它跟随你列出的实体 id 和模式（`sensor.tank_*` 或 `*`）。节点连上时 HotLoop 发来的当前画面不算变化，所以不会发送，除非你打开 "Send the current state when it connects"。状态没变而属性动了，也不算变化。如果链路断开，徽标变红，每次中断有一个错误到达 Catch 节点，而不是每次重试一个，等待时间从 1 秒增加到 30 秒，恢复后，期间发生变化的实体会被发送，没有变化的则不发送。HotLoop 把每个状态都作为文本发送，所以 "Numbers as numbers" 会把 `12.5` 变成数字，而不去动 `on` 和 `unknown`。

`hotloop state` 在消息到达时读取一个实体（`GET /api/states/{entity_id}`），并带着相同字段把消息传下去。不存在或被禁用的实体，会用 HotLoop 自己的话抛出错误，这些话会说明是哪一种。

`hotloop script` 用你给的字段运行一个脚本（`POST /api/scripts/{id}/run`），`hotloop recipe` 用它的参数，以及你有意指定的话，用较旧的版本应用一个配方（`POST /api/recipes/{id}/apply`）。两者都是 HotLoop 自己的：它检查每个字段和参数，绝不为了凑合而改动值，让每次写入都通过它的写入闸门，并保留记录。Flow 发送原因 `flow:<node id>`，如果节点有原因，后面会跟上你自己的话，HotLoop 把它记录在这次运行或应用旁边，记录在它的写入审计和日志簿里，归在 Flow 登录的账户名下。脚本会等待运行结束，除非你关掉它，只有在运行成功时，消息才会带着运行结果（包括追踪）继续。配方只有在每个目标都写入之后才会继续，并带着每个值的 `verification`。其他一切都会带着 HotLoop 的原因和状态到达 Catch 节点：忙碌的脚本、超出范围的字段、在第 2 步失败的运行、因为某个目标没有上膛而整体被拒绝的配方，或者做到一半停下的配方（会说明写入了多少个目标）。已写入的内容不会被撤销，因为这也是 HotLoop 的规则。

**写入会改变设备，而且没有任何仪式，除非 HotLoop 在场。** 我们在 Flow 里找过可遵循的确认模式，但设备方面没有。现有的防护限定了节点能够触及的范围（`scan` 的 `discovery.allowedCIDRs`、文件和密钥的范围），没有任何东西会在消息执行操作之前问一句“确定吗”。所以写入节点也不问。写入节点是有人刻意放在画布上、并像其他一切一样经过同一份部署记录的东西，消息到达它的输出端就意味着设备已经确认。

当 HotLoop 在网络上时，保护设备是它的职责。每个设备写入节点（`modbus write`、`opcua write`、`s7 write` 和 `ethernetip write`）都有默认为空的 **Write through HotLoop**，以及 **HotLoop tag**，即这次写入所对应的 HotLoop 里的标签，写成 `device/tag`。选中某个 HotLoop 后，值会发往 `POST /api/write`，而不是 PLC。HotLoop 的写入闸门按顺序判断：写入是否已开启，标签是否已上膛，值是否在标签的范围内。该标签采用 HotLoop 自己的地址、数据类型和缩放，所以 Flow 节点上的地址和数据类型不会被使用。节点的设备连接仍然保持选中，所以清除 HotLoop 后节点会恢复得和原来完全一样。被闸门拒绝的写入永远不会到达设备，并带着闸门的原话到达 Catch 节点（`HotLoop's gate refused the write to plc-1/sp: value is outside the tag's configured range: 120 is outside 0..95 (HTTP 422)`）。无法连通的 HotLoop 也会让写入失败。它绝不会退回到直接写入，因为那会变成一次闸门从未见过的写入。闸门每次写入只接受一个布尔值、数字或文本，所以寄存器列表会被拒绝，并附一条说明这一点的消息。

测试通过 HotLoop 自己的 API 创建设备、标签、脚本、配方和操作员账户，然后检查两端：HotLoop 说了什么，以及之后模拟的 PLC 里有什么。经过闸门的写入会落到寄存器里。超出标签范围的写入、写向未上膛标签的写入、写向 HotLoop 里没有的标签的写入，以及 HotLoop 无法连通时的写入，全都带着闸门的原话失败，并让寄存器保持原样。脚本和配方通过闸门运行并写入，超出范围的字段被拒绝，`hotloop state` 读取 HotLoop 所持有的内容，`hotloop in` 发送经闸门的写入所造成的变化，并带着它之前的状态。HotLoop 的写入审计和日志簿都已核对过账户和原因。HotLoop 忘记会话之后重新登录已经测试，被拒绝的登录也测试了。重连和对数据流的差异比较，是对照一个按文档形式应答的小型 HotLoop 替身测试的，因为按指令切断真实 HotLoop 的连接不是我们能做到的。未完成：HotLoop 记录的是 Flow 登录的账户，`flow:<node id>` 作为原因写入，因为 API 没有给客户端任何方式来指定自己的操作者。连接只信任系统的证书根，所以使用私有 CA 的 `https` HotLoop 不在覆盖范围内。没有节点会直接调用 HotLoop 的服务，比如 `switch.turn_on`：那是脚本或配方来做的，并带有 HotLoop 的检查。

S7 是对照 python-snap7 3.2.1（MIT）里的服务器测试的，它用纯 Python 编写，是与 gos7 不同的协议实现。

S7 和 EtherNet/IP 节点都还没有遇到过西门子或罗克韦尔的真机。python-snap7 的服务器不像 CPU 那样做位写入（它会覆盖整个字节），所以位写入是在线路上逐个请求检查的，而不是通过读回字节。`ab_server` 匹配标签名时区分大小写，而 Logix 不区分，gologix 发送的是小写，所以模拟器里的标签是小写的。

**`Aes256_Sha256_RsaPss` 不在 OPC UA 下拉列表里。** 有些服务器对它回复 `BadSecurityChecksFailed`，所以 Flow 不提供在它们那里会失败的策略。Basic256 和 Basic128Rsa15 已被弃用，模拟器也不提供它们，所以同样不在其中。我们无法测试的设置，不会获得下拉条目。

未完成：没有 Modbus RTU，没有基于 TLS 的 Modbus，没有 OPC UA 事件、历史或方法调用，没有浏览，没有 S7 定时器或计数器，没有 PCCC 控制器，而超过 2^53 的 64 位整数会以精确数字的字符串形式给出，因为流程里的数字无法容纳它们。
