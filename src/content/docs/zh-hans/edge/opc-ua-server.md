---
title: "OPC UA 服务器"
description: "把配置好的设备和变量发布为只读的 OPC UA 地址空间，让您现有的 SCADA 无需新驱动就能看到每个变量。"
---

HotLoop 的 OPC UA 服务器自 4.13.0 起，把 Gateway 中配置的设备和变量发布为 OPC UA 地址空间。第三方 OPC UA 客户端、SCADA 软件包、HMI、历史数据库，或 UaExpert 这类测试工具，都可以读取 Gateway 的实时变量，无需任何人为另一端编写 HotLoop 驱动。

默认开启（`HOTLOOP_OPCUA_SERVER_ENABLED`），二进制文件和 Helm chart 都是如此。它在 HotLoop 认证开启的状态下启动，并有自己的登录账号 `opcua-reader`，HotLoop 用生成的密码创建该账号，设置页面会向管理员显示这个密码（`GET /api/opcua/server`）；它只能读取变量和数值，别的都不能做。HotLoop 认证关闭时没有可登录的用户，因此服务器会等待并说明原因（它不会拒绝启动）。如果设备上另一个 OPC UA 服务器已占用 4840，它会等待并说明；您自己选择的端口无法打开则是错误：在工厂网络上打开监听器，是部署方有意去做的事。默认端口 4840。

**它是只读的。** 参见[为什么只读](#为什么只读)。它也提供每个变量的历史：参见[历史](#历史)。

## 暴露的内容

每个已启用的设备对应一个 **Object** 节点，直接位于标准的 *Objects* 文件夹下；每个已启用的变量对应一个 **Variable** 节点，位于其设备之下。已关闭的设备和变量不会发布：它们没有工作线程，也没有读数，发布出来只会在客户端面前放一个永久的 Bad 节点。地址空间正是运行时正在轮询的内容。

所有内容都在同一个命名空间 `urn:hotloop:ua:gateway` 中。命名空间 URI 是常量，不由主机名或应用 URI 推导：客户端把节点保存为 URI 加标识符，并在每次连接时重新找到命名空间索引，而随 Pod 名称变化的 URI 会让 SCADA 工程中配置的每个订阅成为孤儿。请像真正的客户端那样，按 URI 在服务器的命名空间数组中解析索引，不要假定是 `ns=2`。

### NodeIds

标识符是字符串，并且是稳定的：

| 节点 | NodeId 标识符 |
|---|---|
| 设备 | `<deviceId>` |
| 变量 | `<deviceId>/<tagName>` |
| 变量的 `EngineeringUnits` / `EURange` 属性 | `~EngineeringUnits/<deviceId>/<tagName>` 和 `~EURange/…` |

变量的形式是 `model.TagKey.String()`，即代码其余部分已经在用的 `device/tag` 写法，因此 NodeId 和变量键可以用 `model.ParseTagKey` 互相转换。用 `.` 做分隔符行不通：设备 ID 可能含点，所以 `a.b.c` 既可能是设备 `a` 的变量 `b.c`，也可能是设备 `a.b` 的变量 `c`。设备 ID 不能含斜杠，所以第一个斜杠始终是边界，而名称里含斜杠的变量（OPC UA 浏览路径和 MQTT 主题都有）也仍能解析到正确的设备。属性 ID 以设备 ID 不可能使用的 `~` 开头，所以无论变量叫什么，属性都不会与变量冲突。

### 属性

| 属性 | 值 |
|---|---|
| `BrowseName` | 设备 ID / 变量名称，位于 HotLoop 命名空间 |
| `DisplayName` | 设备的名称 / 变量的名称 |
| `Description` | 设备或变量的描述 |
| `DataType` | 见下文 |
| `ValueRank` | 标量（-1） |
| `AccessLevel`, `UserAccessLevel` | 仅 `CurrentRead`（0x01） |
| `MinimumSamplingInterval` | 设备的有效轮询间隔，单位 ms；值的变化不会快于运行时的轮询，所以请求更快采样率的客户端会被上调到该间隔 |
| `Historizing` | false |

带单位的变量会得到 `EngineeringUnits` 属性（`EUInformation`，单位 ID -1 = “不是 UNECE 代码”，单位文本在 `DisplayName` 中），带范围的变量会得到 `EURange` 属性。两者都没有的变量则两个属性都没有。

### 数据类型

运行时把每个数值读数归约为工程单位的 float64，所以声明的类型是在 `kindForTag` 中做出的呈现选择，而且必须是该值始终能够表达的类型：

| 变量的 `dataType` | OPC UA 类型 |
|---|---|
| `bool`, `boolean`, `bit`, `coil`, `discrete` | Boolean |
| `string`, `text`, `char` | String |
| `int16` | Int16 |
| `uint16`, `word` | UInt16 |
| `int32`, `dint` | Int32 |
| `uint32`, `dword` | UInt32 |
| `uint64` | UInt64 |
| `int`, `int64` | Int64（最宽的有符号类型，所以不会溢出） |
| 其他所有类型，包括 `float` | Double |
| **任何带缩放或偏移的整数类型** | **Double** |

最后一行很重要：缩放 0.1 的 `int16` 寄存器读出 23.4，若截断为 Int16，客户端会拿到状态为 Good 的 23。放不进声明类型的值，例如交付 70000 的 `int16` 变量，会以 `BadOutOfRange` 报告且不带值，绝不会被回绕或截断成看起来合理的数。读数里带文本的数值变量是 `BadTypeMismatch`。

### 值、质量和时间戳

每次读取（以及每个订阅样本）都从运行时的实时缓存应答，与 `/api/values` 使用同一来源，绝不查数据库。状态码由该读数**以及它背后设备链路的状态**决定，因为只有缓存是不够的：缓存保留设备最后一次返回的读数，而一个后来掉出网络的设备，仍然有一个看起来完全正常的最后读数。

| 设备链路 | 读数 | 状态 | 值 |
|---|---|---|---|
| 已连接，本会话中至少交付过一次轮询 | 良好 | **Good** | 已发送 |
| | 不确定 | Uncertain | 已发送 |
| | 不良，或无法识别的质量 | Bad | 无 |
| 已连接，本会话中尚未交付任何轮询 | 任意 | BadWaitingForInitialData | 无 |
| 已连接，缓存中什么都没有 | n/a | BadWaitingForInitialData | 无 |
| 性能下降（会话在线，轮询失败或不完整） | 良好 | **UncertainLastUsableValue** | 已发送 |
| | 不确定 | Uncertain | 已发送 |
| | 不良 | Bad | 无 |
| 已断开、正在连接、已禁用 | 任意 | **BadNoCommunication** | 无 |
| 该设备没有工作线程 | 任意 | BadOutOfService | 无 |
| 变量或设备已移除 | n/a | BadNodeIdUnknown | 无 |

只有当设备已连接、读数来自当前会话的轮询且读数良好时，才会报告 Good。已断开设备上的变量读出 Bad，而不是带 Good 状态的最后一个值。

时效有意不计入。事件驱动的数据源（MQTT/Sparkplug 变量、OPC UA 订阅）因为没有变化而持续数小时保持同一个值是正常的，按时钟称其过期是错误的；设备是否仍在交付数据，是链路的职责。

**源时间戳**是读数自身的时间戳，即最后一次收到设备消息的时间，即使状态是 Bad 也会报告。**服务器时间戳**是应答该读取的时间。两者都是 UTC。

## 订阅

客户端可以在变量上创建订阅和监控项，并接收数据变化通知，SCADA 客户端实际就是这样使用变量的。这个库的监控采用采样方式：服务器按每个监控项的采样间隔（至少 100 ms，且至少为设备的轮询间隔），通过与读取相同的处理程序读取它，并在值或状态变化时通知。因此*质量*的变化，比如设备掉线，与值的变化以同样的方式通知。

已移除变量上的监控项不会被悬置：它会收到 `BadNodeIdUnknown`。

## 配置变化时客户端看到什么

移除变量时，对它的读取和监控项会立即收到 `BadNodeIdUnknown`，它也会立即从所属设备的浏览中消失。节点本身在其后约 5 秒内仍留在服务器的节点表中，不可访问，然后被删除。被移除的设备在 Objects 文件夹下同样处理。

编辑从不留下空档。被编辑的变量或设备会在一步之内，以同一个 NodeId 换成新版本，所以此刻的读取或浏览看到的是旧版本或新版本，绝不会是“未知”。其上的订阅继续有效。

删除前的延迟不是摆设。库的 Browse 先读取节点的引用列表，再逐个查找目标，两步之间不持有锁，如果其间有目标消失，就会让*父节点*的浏览以 `BadNodeIdUnknown` 失败，仿佛设备或 Objects 文件夹不存在。我们以前直接删除节点，于是在移除变量时浏览设备的客户端，或在编辑设备时读取变量的客户端，可能被告知一个完全真实的节点并不存在。

## 为什么只读

这一版不实现写入，并且在三个地方同时这样声明，使任何单独的改动都无法悄悄把写入加进来：

- 每个已发布节点都是 `AccessLevel = CurrentRead | HistoryRead`，且没有安装写入处理程序，因此写入会被 `BadNotWritable` 拒绝，客户端在尝试之前就能看出该节点不可写；
- 测试以 viewer、operator 和 admin 身份向变量写入，并断言应答是 `BadNotWritable`，**且变量背后设备上的寄存器没有变化**。

OPC UA 写入路径必须经过那道关口，把其主体带入审计追踪，并遵守总开关。那是一个需要独立评审的改动，不能作为发布变量的副产品出现，而且这个版本有意没有任何设置可以启用它。

## 历史

每个变量节点都会记录历史，并带有 HistoryRead 访问级别。服务器用 HotLoop 自己的历史应答 OPC UA 的 HistoryRead 服务，也就是 `/api/history` 所提供的同样读数，因此 OPC UA 连接另一端的客户端无需第二个数据库，就能读到 Gateway 保存的内容。用户需要的权限与读取值相同（`tags.read` 和 `values.read`），检查方式也与读取值相同，针对会话的用户进行，而不只是登录时检查一次。

- **Raw**（`ReadRawModifiedDetails`）：窗口内的读数，每个读数以自己的质量作为状态，并带有自己的时间戳。起点早于终点时向前读取，起点晚于终点时向后读取，最新的在前。起点包含在内，终点不含（OPC UA 10000-11，第 4.6 节），除非客户端请求边界，此时会加上起点处或之前的读数，以及终点处窗口外的第一个读数。`NumValuesPerNode` 是一次调用为一个节点返回的数量；超过它，或超过 10,000，则分页返回，每页带有一个有效期五分钟、仅能使用一次的续传点（同时最多保留 1,000 个）。什么都没有的窗口是 `Good_NoData`。修改过的历史会被拒绝（`BadHistoryOperationUnsupported`）：这里的任何内容都不会被修改或删除。
- **Processed**（`ReadProcessedDetails`）：Average、Minimum、Maximum、Count、Start、End 和 Total，按从起始时间开始的 `ProcessingInterval` 间隔计算，遵循质量规则（README，“The quality rule”）：只有数值有限的良好读数才计入。没有读数的间隔是 `Good_NoData`（Count 为 0），有读数被排除的间隔读出 `Uncertain_DataSubNormal`，所以这个数绝不会比其中的内容更好。其他聚合对该节点会被拒绝（`BadAggregateNotSupported`），字符串变量没有聚合，超过 10,000 个间隔或 500,000 个读数的窗口会被拒绝（`BadTooManyOperations`），而不是被截断。只有两端齐全的向前窗口才会应答。
- **At time**（`ReadAtTimeDetails`）：变量在每个时刻所持有的值，即该时刻或之前的最后一个读数，并盖上所请求时刻的时间戳。它从不插值，因为读数是有人取到的值；早于变量第一个读数的时刻是 `Bad_NoData`。
- **事件**不提供：`BadHistoryOperationUnsupported`。设备或其他对象同样没有历史，属性节点（`EngineeringUnits`、`EURange`）也不带 HistoryRead。

历史数据库在读数越过死区时保存读数，而不是每次轮询都保存，所以安静的变量行数很少：当您需要的是它当时持有什么而不只是何时变化时，请读取 At time，或围绕变量最后一个读数的 Processed 窗口。`HistoryServerCapabilities` 说明历史可以读取，且一次调用最多返回 10,000 个值。

## 设备健康，面向 EmberNet 仪表板

仪表板的任务管理器直接从机器本身读取其 CPU、内存、磁盘和实时抖动：HotLoop 把它们发布为一个设备，服务器提供它们的历史（[历史](#历史)），所以仪表板从不为此读取自己的数据库。已构建的内容，以及如何开启：

* **设备。** 设置了 `HOTLOOP_BOX_HEALTH_NODE`（Chart 把它设为 Kubernetes 节点的名称）时，HotLoop 会创建一个 ID 恰为该名称的设备，协议为 `boxhealth`（[协议和驱动](/zh-hans/iot/protocols/#设备健康)）。它的变量是 `cpu_util_pct`、`mem_util_pct`、`disk_util_pct`（机器自己的磁盘）、`data_util_pct`（HotLoop 存放数据的卷），并且仅当 `HOTLOOP_BOX_HEALTH_JITTER_FILE` 指向实时代理写入的 JSON 文件时，才有 `rtos_jitter_core1_us`、`rtos_jitter_core2_us` 和 `rtos_jitter_core3_us`。它们的 OPC UA 节点 ID 位于命名空间 `urn:hotloop:ua:gateway` 中，字符串标识符为 `<device id>/<tag>`。
* **机器的数据。** Chart 把主机根目录挂载到 `/host`，把其 `/proc` 挂载到 `/host/proc`，均为只读，并且**默认**设置节点名称（`opcuaServer.dashboard.boxHealth.enabled: true`），所以 HotLoop 一安装，仪表板的任务管理器就能工作。只读取 `/host` 的 statfs 以及 CPU 和内存计数器，不增加任何特权。强制执行 restricted Pod Security 配置的集群会拒绝 hostPath：在那里请设置 `enabled: false`（没有设备，没有挂载）或 `hostMount: false`（有设备，但机器的磁盘和 CPU 读出 Bad，并说明需要挂载什么）。该设备不需要 OPC UA 服务器。
* **只能读取、别无其他的登录。** Chart 在首次安装时创建用户 `embernet-dashboard-read`，恰好拥有 `tags.read` 和 `values.read`（明确的权限列表，绝不是角色），并把其生成的密码保存在 Secret `<release>-opcua-dashboard` 中（键为 `username`、`password` 和 `password-hash`）。升级从不轮换它。已存在的账户从不会因重启而改变。
* **仪表板的证书。** 仪表板创建 Secret `<release>-opcua-trust`，每个证书一个键，名为 `<sha1 thumbprint>.crt`。Chart 以可选方式把它挂载到 `/etc/hotloop/opcua-trust`，服务器把这些文件保存在 `trusted/` 中（`HOTLOOP_OPCUA_SERVER_TRUST_DIR`）：启动时以及每 30 秒，新文件会被添加，变化的文件会被重写，离开 Secret 的文件会再次被移除。操作员放进 `trusted/` 的文件从不被触碰，并且优先于同名的 Secret 键。
* **端口。** 发布本身的 Service（仪表板发现的那个）在服务器开启时会列出 OPC UA 端口 4840，与 OPC UA 服务器自己的 Service 并列。

服务器保持原样：Basic256Sha256 SignAndEncrypt，没有匿名会话，不信任一切。

## 安全模型

### 传输

安全通道使用库的策略，模式为 Sign 和 SignAndEncrypt。**两种模式都提供 `Basic256Sha256`**，客户端应当选择它。

**安全策略 None 需要明确选择开启**（`HOTLOOP_OPCUA_SERVER_ALLOW_INSECURE`，默认 false），开启时启动会有警告。关闭时不会通告 None 端点，仍然打开 None 通道的客户端只能做发现：其他所有服务都会被拒绝。即使开启，用户名和密码仍然在加密令牌内传输（令牌策略是 `Basic256Sha256`，绝不是 None），尽管客户端随后读取的每个值都不受保护。

**已弃用的策略默认关闭。** OPC Foundation 已弃用 `Basic128Rsa15`（使用 PKCS#1 v1.5 填充的 RSA）和 `Basic256`（SHA-1）。在更早的版本中，二者出现在每个端点列表中，且无法移除。`HOTLOOP_OPCUA_SERVER_ALLOW_DEPRECATED_POLICIES`（Chart：`opcuaServer.allowDeprecatedPolicies`，默认 `false`）决定：

- **关闭（默认，新安装和升级都是）。** 这两个策略都不在告知客户端的任何端点中，用其中之一打开安全通道的客户端会在通道打开时被拒绝，先于任何会话或登录。使用 `Basic256Sha256`、`Aes128_Sha256_RsaOaep` 或 `Aes256_Sha256_RsaPss` 的客户端不受影响。
- **开启。** 两者都会再次在 Sign 和 SignAndEncrypt 中提供，供不会说任何更新协议的旧客户端使用，启动时有警告。只在该客户端更新之前开启。

升级后不再连接、且使用这两个策略之一的客户端，会显示通道被拒绝；请设置该选项，或把客户端改用 `Basic256Sha256`。

### 服务器证书

如果设置了 `HOTLOOP_OPCUA_SERVER_CERT_FILE` 和 `_KEY_FILE`，则原样使用该 RSA 密钥对。否则，**首次启动时会生成并保存一个自签名的应用实例证书**，位于 `HOTLOOP_OPCUA_SERVER_PKI_DIR` 下（`own/cert.pem`、`own/key.pem`，密钥模式 0600），所以下次启动呈现同一个证书，曾被告知信任它的客户端不会再被提示。只要证书是自签名的，每次启动都会记录一条警告，附带其 SHA-1 指纹（OPC UA 工具显示的形式），方便操作员与客户端显示的内容比对。

该证书写明了 OPC UA 客户端会检查的内容，这是普通 TLS 证书所没有的：URI 类型的使用者备用名称中的**应用 URI**（`HOTLOOP_OPCUA_SERVER_APPLICATION_URI`，默认 `urn:hotloop:gateway`，配置了站点时再加 `:<siteId>`）、作为 DNS 和 IP SAN 的客户端所用主机名与地址（端点主机、`HOTLOOP_OPCUA_SERVER_CERT_HOSTS`、`localhost`、回环地址、本机主机名），以及第 6 部分为应用实例列出的密钥用途。RSA-2048，五年。

已保存的证书只有在无法再履行职责时才会被替换，并带有客户端必须信任新证书的警告：剩余不足 30 天、应用 URI 与配置不再匹配、有配置的主机它没有覆盖，或密钥无法读取。

**本机主机名不是配置的主机。** 它会写入新证书，但主机名变化时，已保存的证书会被保留。在容器中，主机名是容器 ID，在 Kubernetes 中是 Pod 名称，所以每次重新部署都会变。在这个问题修复之前，它会被计入，容器化 Gateway 的每次升级都会产生新证书：被告知信任旧证书的 Ignition 会以 `Bad_SecurityChecksFailed` 拒绝服务器，直到有人再次信任，每个客户端、每次部署都如此。客户端通过 `HOTLOOP_OPCUA_SERVER_ENDPOINT_HOST` 和 `_CERT_HOSTS` 访问服务器；设置好它们，证书就会一直使用到临近过期。（没有设置端点主机的 Gateway 会把本机主机名用作端点主机，这个会被计入，因为那是告诉客户端的内容。这是设置它的又一个理由。）

**密钥可能无法使用，服务器会拒绝它。** 大约每二十个 RSA 密钥中有一个无法承载加密的 OPC UA 登录，此后用该密钥进行的每次加密登录都会失败，每次都是如此，客户端只会看到“安全通道已关闭”。匿名和未加密的会话不受影响，这正是它容易被误诊的原因。生成的密钥会一直重抽，直到不是这类密钥；操作员提供的密钥若是这类，启动时会被拒绝，并给出说明原因的错误。

### 客户端应用证书

OPC UA 既认证用户，也认证应用。服务器在 `<PKI_DIR>/trusted/` 中保存信任列表：证书不在其中的客户端会在安全通道上被拒绝，其证书会被写入 `<PKI_DIR>/rejected/`。**要批准一个客户端，请把它的证书从 `rejected/` 移到 `trusted/`**，无需重启；该目录在每次连接时读取。`<PKI_DIR>/issuers/` 和 `<PKI_DIR>/crl` 会原样传递，供 CA 签发的客户端证书使用。

`HOTLOOP_OPCUA_SERVER_TRUST_ALL_CLIENT_CERTS`（默认 false，启动时有警告）会跳过这一步。它只去掉应用认证：用户仍然必须用 HotLoop 的用户名和密码认证。

### 谁可以登录

**用户名和密码，对照 HotLoop 自己的用户。** 只有一个用户数据库，没有第二个凭据存储：认证器用与 HTTP 登录相同的 `store.User` 查找用户，用相同的 bcrypt 哈希（`auth.CheckPassword`）比较，以相同方式规范化用户名（小写、去掉首尾空白），无论用户是否存在都执行一次 bcrypt 比较，使响应时间不会泄露哪些名称是真实的，并拒绝已禁用的账户。未知用户、错误密码、已禁用用户和没有权限的用户都得到同样的应答 `BadUserAccessDenied`。

**用户只有在其角色授予 `tags.read` 和 `values.read` 时才能读取变量**，这与 HTTP API 保护 `/api/tags` 和 `/api/values` 的是同一对权限，通过相同的 `auth.Permissions` 和 `auth.Allows` 解析，所以内置角色和明确的权限列表的行为与那边完全一致。两者都需要，因为 OPC UA 客户端通过一个连接浏览变量列表并读取值，只被授予其中之一的用户否则会白白得到另一个。每个拥有 `values.read` 的内置角色也拥有 `tags.read`；这只对带明确权限列表的用户有影响。

**权限在使用时检查，而不只是在登录时。** 库在每次浏览、读取和订阅采样时都会请求会话的角色；这些由用户数据库的短期缓存（10 s）应答。被禁用、被删除或被收回权限的用户会在该间隔内失去在线会话的访问权，其监控项变为 Bad，而不是等到其客户端下次重连。查询失败视为“否”。

**匿名会话是关闭的**（`HOTLOOP_OPCUA_SERVER_ALLOW_ANONYMOUS`），除非选择开启，否则不提供匿名令牌，开启时启动会有警告。X.509 用户身份令牌同样关闭，设置 `HOTLOOP_OPCUA_SERVER_ALLOW_X509` 后提供（参见 [X.509 用户证书](#x509-用户证书)）。如果 HotLoop 自己的认证关闭（`HOTLOOP_AUTH_INSECURE`），就没有可登录的用户，除非选择开启匿名访问，否则服务器拒绝启动。

成功的登录会像 HTTP 登录一样记入系统日志。失败的登录只连同原因记入进程日志，这样未认证的调用方就无法塞满审计追踪。同一时间最多运行四次密码检查，因为每次都是有意放慢的 bcrypt 比较，而 OPC UA 没有 HTTP 前面那种限速器的对应物；除此之外没有锁定或速率限制，与 HTTP 登录相同。

库在会话存续期间，把解密后的用户身份（包括密码）保存在会话对象中。它只在内存里，从不记录日志，但正在运行的 Gateway 的堆转储会包含当时已连接用户的密码。

**HotLoop 接受的任何长度的密码，最长 72 字节（bcrypt 的上限），都可以登录。** 在更早的版本中，65 到 72 字节的密码可以登录 Web 界面，却不能在这里登录（`BadIdentityTokenRejected`）。长度把密码加上 32 字节的服务器 nonce 一起计算，所以密码最多只能到 64 字节。RSA 和规范中都没有这样的要求：令牌按需要加密成任意多个块，而解码器本来就读取全部块。现在的检查是长度至少为 32，且不超过实际解密的字节数，这正是该检查本应保证的，因为它决定了随后创建的缓冲区大小。声称比实际到达的更多的长度仍然会被拒绝，所以客户端无法让服务器分配它并未发送的内容。上游 `main`（2026-11-16 检查）仍有这个上限；该改动已作为来自 HotLoop-io/opcua 的拉取请求提交给上游。

### X.509 用户证书

客户端可以用证书代替密码登录。默认关闭：设置 `HOTLOOP_OPCUA_SERVER_ALLOW_X509=true`（Chart `opcuaServer.allowX509`），服务器就会在其安全端点上提供 Certificate 用户令牌，并在启动时说明。不设置时没有端点提供它，证书登录会被拒绝。

**证书如何对应到用户。** 管理员把证书附加到某个 HotLoop 用户：设置，OPC UA 证书，附加证书（或使用 API `POST /api/users/{username}/certificates`，或 MCP 工具 `add_user_certificate`）。注册表保存公钥证书、其 SHA-256 指纹、谁在何时附加的、是否已撤销，以及最近一次登录的时间。出示该证书并证明持有私钥的客户端，会**以该用户**登录。不需要配置其他任何内容，证书本身的任何内容都不被信任：不看通用名称，没有需要运营的 CA，没有人附加的证书什么也不做。

**令牌携带什么。** 客户端可以先发送自己的证书，再发送签发它的那些证书；第一个是已被附加的证书，其余的会被忽略。

**密钥证明。** 库会检查令牌对服务器证书和会话 nonce 的签名，只有私钥持有者才能生成；用另一把密钥的签名出示的证书会被拒绝。

**它能做什么。** 恰好是该用户能做的。登录要求用户已启用，并持有 `tags.read` 和 `values.read`，与密码登录是同一对权限，会话也像密码会话一样每 10 秒检查一次：被禁用或失去权限的用户会在该间隔内失去在线的证书会话。它与这里的每个会话一样是只读的；无论用户的角色是什么，证书会话都不能写入。

**被拒绝，原因记入日志。** 未注册、已撤销、已过期、尚未生效的证书，或其用户已不存在、已禁用或没有权限的证书，都会收到 `BadUserAccessDenied`，对所有这些情况应答相同，所以客户端无法得知属于哪一种。原因会记入进程日志和审计追踪。

**撤销。** 在同一界面撤销它（或使用 `POST .../{thumbprint}/revoke`）。它会立即停止登录，用它打开的会话会在 10 秒内结束。已撤销的证书仍会保留在列表中，并注明谁在何时撤销，所以被拒绝的登录读作“已撤销”而不是“未知”；删除它即可忘记它。备份会带上注册表，包括撤销记录。

**审计。** 每次证书登录都是一条日志簿条目（类别 auth），写明用户、证书的指纹和使用者，以及客户端应用。每次拒绝同样如此，并附原因。反复重试同一拒绝的客户端，对该证书和原因每分钟写一条，而不是每次尝试写一条；每次拒绝仍然都在进程日志中。附加、撤销和删除证书是带有操作者的条目。私钥从不在其中任何一条里，HotLoop 也从不持有私钥：只发送或保存公钥证书。

**不是应用信任列表。** `<PKI_DIR>/trusted/` 中的客户端应用证书让客户端能够打开安全通道，它不是登录。用户证书是另一种对象：属于某个人，附加到某个用户。同一个证书在客户端一侧可以两用，但服务器把它们视为两种行为。

**HotLoop 自己的客户端**也以这种方式登录：参见[协议和驱动](/zh-hans/iot/protocols/#opc-ua)中的 `userCertificate` 和 `userPrivateKey`。

未构建的内容：被信任为客户端证书担保的认证机构，以及把它们映射到用户的名称规则。注册表适用于逐个附加客户端证书的工厂；CA 会是对它的补充，而不是替代。

**RsaEncryptedSecret，OPC UA 对超过 64 字节的密码所要求的格式。** OPC 10000-4 7.40.4 规定，客户端在 RSA 安全策略下，把超过 64 字节的密码加密为 RsaEncryptedSecret（7.40.2.4），而不是旧格式。OPC Foundation 自己的客户端正是这样做的，现在 HotLoop 的 OPC UA 客户端也是这样。服务器两种都读。它先看令牌的开头：对 RsaEncryptedSecret，会检查其安全策略、证书、签名时间、签名、填充和会话的 nonce，只有全部成立才交出密码；其他情况都交给旧解码器，因此以旧格式发送超过 64 字节密码的客户端仍然可以登录。所有 RSA 策略都在覆盖范围内，即 `Basic256Sha256`、`Aes128_Sha256_RsaOaep` 和 `Aes256_Sha256_RsaPss`，以及启用时的 `Basic128Rsa15` 和 `Basic256`。已对照 OPC Foundation 的 Reference Server 和 ConsoleReferenceClient（UA-.NETStandard 2.0.2）在两个方向上验证，所用用户的密码长度分别为 10、64、65、72、100 和 200 字节。

### 服务器诊断已移除

库的逐会话诊断节点会让任何已登录用户浏览其他所有会话的用户名和客户端地址，所以已将其关闭，`Server/ServerDiagnostics` 对象也已从地址空间中移除（库还在没有加锁的情况下写入其计数器）。

## 运行时地址空间的变化

设备和变量在 Gateway 运行时被添加、编辑和移除，地址空间无需重启即可跟随。**机制：运行时回调，外加一个定时器作为安全网。**

- `runtime.Manager.OnReload` 在每次成功的 `Reload` 之后回调。API 所做的每一次设备和变量变更都以 `Reload` 结束，所以通过界面或 API 做出的变更会在片刻之内发布。回调只向一个对账 goroutine 发信号，从不自己做事，因此缓慢的对账不会阻塞触发它的 API 请求。
- 周期性对账（`HOTLOOP_OPCUA_SERVER_RECONCILE_INTERVAL`，默认 30 s）会捕获任何不经 `Reload` 就改变配置的情况。

两者对数据库中已启用的设备和变量运行同一个幂等的差异比对。它只触碰有差异的部分：被编辑的变量被替换，被移除的被删除，其余一切，包括客户端在其上持有的监控项，都保持原样。新设备的节点一次调用就进入空间，所以在对账过程中浏览的客户端，看到的要么是带全部变量的设备，要么什么都没有。

选择回调而不是单靠轮询，是因为运行时本来就有干净的信号（`Reload`），它让变更在毫秒内可见，而不是最多等待一个完整间隔；保留定时器，是因为地址空间不应取决于未来每个写入配置的组件是否记得重新加载。

## 连接客户端

端点是 `opc.tcp://<HOTLOOP_OPCUA_SERVER_ENDPOINT_HOST>:<port>`。在集群内，Chart 默认把主机设为发布的 Service DNS 名称；在集群外，请设为客户端实际会使用的名称或地址（LoadBalancer 地址、DNS 记录）：它会在每个端点 URL 中通告，并写入生成的证书。它**不是**服务器绑定的位置：库监听所有接口，只接受一个端口。

使用 UaExpert 或任何其他客户端：

1. 用该 URL 添加服务器，并选择 `Basic256Sha256` / `Sign & Encrypt`。
2. 选择 *Username*，并用拥有 `tags.read` 和 `values.read` 的 HotLoop 用户登录；或者，在 `HOTLOOP_OPCUA_SERVER_ALLOW_X509` 开启时，选择 *Certificate*，并提供管理员附加到某个用户的用户证书及其密钥。
3. 第一次连接会被拒绝，因为服务器还不信任客户端的证书。在 `<PKI_DIR>/rejected/`（集群中位于 PKI 卷上）找到它，移到 `trusted/`，然后再次连接。
4. 第一次，客户端会询问是否信任服务器证书；请把指纹与启动日志中的比对。
5. 浏览 *Objects* → 设备 → 其变量，并把变量拖入数据访问视图；它们会被订阅。

## 以 Ignition 8.3 作为客户端

**于 2026-09-27 对 Ignition 8.3.9 完成验证**，即当前稳定版，使用 Inductive Automation 自己的容器镜像（`inductiveautomation/ignition:8.3.9`，试用中的标准版），对接一个演示设备 `extruder-1` 由模拟器提供数据的 HotLoop Gateway。端到端演示的内容如下：

- Ignition 到 `opc.tcp://<gateway>:4840` 的 OPC UA 连接，使用 `Basic256Sha256` 和 `SignAndEncrypt`，以 HotLoop **viewer** 身份登录；
- 双向的证书信任，如下文所述；
- Ignition 的 `[default]` 提供程序中指向 HotLoop 节点的 OPC 变量，以 Good 质量读取，并随模拟器变动而变化。Ignition 显示的每个值都是 HotLoop 自己的 `/api/values` 所保存的：同一个 double 原样通过线路，所以它们按相等而不是接近来比较。HotLoop 中声明为 `string` 的文本变量，在 Ignition 的 String 变量中读出“RUNNING”；
- 来自 Ignition 的写入被拒绝：Ignition 发送了写入，HotLoop 应答 `Bad_NotWritable`（在仅 Sign 的通道上从线路读取，那里应答已签名但未加密），HotLoop 的值没有变动；
- Ignition 提供的每种安全策略和模式，见下文。

### 设置方法

在 HotLoop 一侧，先于 Ignition 完成：

1. 开启服务器，并把 `HOTLOOP_OPCUA_SERVER_ENDPOINT_HOST` 设为 Ignition 访问 Gateway 所用的名称。该名称出现在服务器通告的每个端点 URL 以及它的证书中。
2. 为 Ignition 创建一个 **viewer** 角色的 HotLoop 用户（管理员用 `POST /api/users` 完成；参见[认证和用户](/zh-hans/iot/authentication/)）。任何拥有 `tags.read` 和 `values.read` 的角色都可以登录；不提供更多权限，因为服务器是只读的。

在 Ignition Gateway 中（端口 8088 上的 Web 界面）：

3. 在 Connections 下的 **OPC Connections** 页面（`/app/connections/opc-client-connections`），创建一个 **OPC UA** 连接。端点 URL 为 `opc.tcp://<gateway>:4840`；选择 `Basic256Sha256` / `SignAndEncrypt` 端点；认证选 **Username**，填 HotLoop 用户和密码。连接会立即变为 Faulted，这是预期的：见第 4 步。
4. **在 HotLoop 中批准 Ignition。** Ignition 的客户端证书现在位于 Gateway 的 `<PKI_DIR>/rejected/`（容器和 Chart 中是 `/data/opcua-pki/rejected`），以其 SHA-1 指纹命名，即 `<thumbprint>.crt`。把指纹与 Ignition 自己的 OPC UA 客户端证书比对，该证书显示在 OPC 证书页面（`/app/connections/opc/security/certificates`）上。然后把文件移到 `trusted/`。两边都不需要重启。HotLoop 不记录这次拒绝；这个文件是唯一的迹象。
5. **在 Ignition 中批准 HotLoop。** 现在连接以另一个方向失败：状态显示 `Bad_SecurityChecksFailed ... unable to find valid certification path`。HotLoop 的证书位于同一页面上 Ignition 被拒绝的**客户端**证书中。把它的指纹与 HotLoop 启动时记录的指纹（`generated a self-signed OPC UA application certificate ... thumbprint=`）比对，然后信任它。无需重启；连接会在几秒内建立。
6. **变量。** 以该连接作为 OPC 服务器，用命名空间 URI 形式的条目路径创建 OPC 变量，Ignition 原样接受这种形式：

   ```
   nsu=urn:hotloop:ua:gateway;s=extruder-1/Emberburn_Temperature
   ```

   按 HotLoop 发布的类型声明每一个（参见[数据类型](#数据类型)）：float 用 Float8，Boolean，String，`int16` 用 Int2，`uint16` 或 `int32` 用 Int4，更宽的整数用 Int8。它们按变量组的速率订阅，HotLoop 会把更快的采样率上调到设备的轮询间隔。

同样的事情，也可以通过文件或 REST API 完成：

- 连接是资源 `data/config/resources/core/ignition/opc-connection/<name>/config.json`，配置文件类型为 `com.inductiveautomation.OpcUaServerType`，或 `POST /data/api/v1/resources/ignition/opc-connection`。其中有两点不显而易见。密码是内嵌的密钥，是一个 JWE，由 `POST /data/api/v1/encryption/encrypt` 从明文生成；不接受普通字符串。并且 `security` 块需要网关客户端密钥库的别名及其密码：省略它，连接会以 NullPointerException 失败，别名为空则以 `Unable to retrieve KeyPair for alias 'client'` 失败。请从自带的 `Ignition OPC UA Server` 回环连接复制该块，它同时带有这两项。
- 证书位于 `data/config/local/com.inductiveautomation.opcua/client/security/pki/`（`rejected/certs`、`trusted/certs`），或通过 API 使用 `GET /data/opc-ua/api/v1/client/pki/certificates/rejected` 和 `POST .../trusted/<sha1>`。**Ignition 不用指纹给文件命名**；API 的 `signature` 字段就是 SHA-1 指纹，与 HotLoop 记录的一致。
- 变量用 `POST /data/api/v1/tags/import?provider=default&type=json` 导入。
- 每次 API 调用都需要 API 密钥（API Keys 页面，`/app/platform/security/api-keys`），并且只有密钥的某个安全级别在网关的读取或写入权限中（`security-properties` 资源）时，该密钥才能通过。

### 预期的情况

- **`Bad_SecurityChecksFailed` 有两种不同的含义。** 当 HotLoop 拒绝 Ignition 的证书时（第 4 步；消息里没有原因），以及当 Ignition 拒绝 HotLoop 的证书时（第 5 步；消息说 *unable to find valid certification path*），Ignition 显示同样的状态。请先看 HotLoop 的 `rejected/`。
- **重新部署 HotLoop 会保留其证书。** 到 4.15.3 之前并非如此：证书必须覆盖容器的主机名，而每次重新创建容器它都会变，所以每次升级都会产生新证书，Ignition 会拒绝服务器，直到有人再次信任它。参见[服务器证书](#服务器证书)。如果 PKI 卷丢失，证书仍会改变。
- **声明为数值的文本变量读出 `Bad_TypeMismatch`。** HotLoop 按变量声明的类型发布它，而保存着“RUNNING”的 `float` 变量不可能是 Double。到 4.15.3 之前，由 Discover tags 创建的变量全都声明为 `float`；参见[协议和驱动](/zh-hans/iot/protocols/#opc-ua)。请把它们声明为 `string`。
- **写入被拒绝，而 Ignition 模糊了原因。** HotLoop 应答 `Bad_NotWritable`。Ignition 自己的 OPC UA 服务器被要求写入同一个变量时，只传回一个通用的 `Bad`（0x80000000）。Ignition 变量的值不会改变。
- **已弃用的策略只有在开启后才能使用。** Ignition 提供 `Basic128Rsa15` 和 `Basic256`。请在连接中选择 `Basic256Sha256` 或某个 `Aes` 策略。
- **试用期。** 未授权的 8.3 网关运行两小时后停止执行，直到在 Gateway 的 Web 界面中重置试用。试用到期时变量会过期；这是 Ignition 的行为，不是连接的问题。

### 策略矩阵

每一行都是使用该策略和模式的全新会话，读取实时值。两个已弃用的行是在 `HOTLOOP_OPCUA_SERVER_ALLOW_DEPRECATED_POLICIES` 开启时测得的；关闭时（这是默认状态），这两个策略不会提供，请求其中之一的通道会被拒绝：

| 策略 | SignAndEncrypt | Sign |
|---|---|---|
| `Basic256Sha256` | 可用 | 可用 |
| `Aes128_Sha256_RsaOaep` | 可用 | 可用 |
| `Aes256_Sha256_RsaPss` | 可用 | 可用 |
| `Basic256`（已弃用） | 可用 | 可用 |
| `Basic128Rsa15`（已弃用） | 可用 | 可用 |

除非设置了 `HOTLOOP_OPCUA_SERVER_ALLOW_INSECURE`，否则不提供 `None`，也未测试过。

## 配置

| 变量 | 默认值 | <span class="sr-only">详情</span> |
|---|---|---|
| `HOTLOOP_OPCUA_SERVER_ENABLED` | `true` | 二进制文件和 chart 中均开启；设为 `false` 即关闭服务器 |
| `HOTLOOP_OPCUA_SERVER_PORT` | `4840` | TCP 端口，在所有接口上 |
| `HOTLOOP_OPCUA_SERVER_ENDPOINT_HOST` | 本机主机名 | 告诉客户端连接什么；也会写入生成的证书。**请设置它。** |
| `HOTLOOP_OPCUA_SERVER_APPLICATION_URI` | `urn:hotloop:gateway[:<siteId>]` | 必须在重启之间保持稳定；必须是 URI |
| `HOTLOOP_OPCUA_SERVER_PKI_DIR` | `/data/opcua-pki` | 证书、密钥、`trusted/`、`rejected/`。请用卷来支撑 |
| `HOTLOOP_OPCUA_SERVER_CERT_FILE` / `_KEY_FILE` | n/a | 使用这对 RSA 密钥而不是生成新的；两个都设置，或都不设置 |
| `HOTLOOP_OPCUA_SERVER_CERT_HOSTS` | n/a | 生成证书时额外加入的 DNS 名称 / IP |
| `HOTLOOP_OPCUA_SERVER_ALLOW_INSECURE` | `false` | 提供安全策略 None。启动时有警告 |
| `HOTLOOP_OPCUA_SERVER_ALLOW_ANONYMOUS` | `false` | 接受没有身份的会话。启动时有警告 |
| `HOTLOOP_OPCUA_SERVER_TRUST_ALL_CLIENT_CERTS` | `false` | 跳过客户端证书批准。启动时有警告 |
| `HOTLOOP_OPCUA_SERVER_ALLOW_X509` | `false` | 提供 Certificate 用户令牌：客户端用附加到用户的证书登录（[X.509 用户证书](#x509-用户证书)）。启动时有提示 |
| `HOTLOOP_OPCUA_SERVER_ALLOW_DEPRECATED_POLICIES` | `false` | 为旧客户端提供已弃用的 `Basic128Rsa15` 和 `Basic256` 策略（[传输](#传输)）。启动时有警告 |
| `HOTLOOP_OPCUA_SERVER_MAX_SESSIONS` | `20` | 0 = 不限 |
| `HOTLOOP_OPCUA_SERVER_MAX_SUBSCRIPTIONS` | `200` | 0 = 不限 |
| `HOTLOOP_OPCUA_SERVER_RECONCILE_INTERVAL` | `30s` | 作为安全网的对账周期 |

在 `--mcp-stdio` 模式下不会启动该服务器：那是智能体把这个二进制文件作为辅助程序启动，不应出现第二个进程与真正的 Gateway 争用端口 4840 的情况。

### Helm

`charts/hotloop/values.yaml` 中的 `opcuaServer.*`。启用它会增加一个 Service（`<release>-opcua`，默认 ClusterIP；LoadBalancer 或 NodePort 是面向集群外客户端的有意选择）、一个用于 PKI 目录的 PVC（`opcuaServer.persistence`；丢失它意味着每个客户端都必须信任新证书）、容器端口，并且为了让 `networkPolicy.enabled` 和 `opcuaServer.enabled` 同时开启时不会悄悄留下一个无人可达的监听服务器，还会把该端口加入默认 NetworkPolicy 的 ingress 规则。自定义的 `networkPolicy.ingress` 会像对 broker 那样替换该规则，此时必须自己列出该端口。`opcuaServer.tls.existingSecret` 提供一个 `kubernetes.io/tls` Secret，以代替生成的证书。

## 哪些已验证，哪些没有

HotLoop 已经在真实设备和真实服务器上运行过，并于 2026-11-17 在真实硬件上运行过。
