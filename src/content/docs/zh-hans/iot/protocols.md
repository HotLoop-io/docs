---
title: "协议与驱动"
description: "支持 OPC UA、Modbus、MQTT 与 Sparkplug B、EtherNet/IP、S7comm、MTConnect 和 HTTP，并说明每个驱动已在真实设备上验证到什么程度。"
---

本文准确说明网关支持哪些协议、每个驱动已验证到什么程度，以及其余协议该怎么处理。请先读这一篇，与它不一致时，以它为准。

原生协议列表来自编译进二进制文件的驱动。`/api/protocols`、协议界面和 MCP 的 `describe_protocol` 工具读取的是同一个注册表，因此目录不会宣称二进制文件中没有的协议。

## 验证状态

HotLoop 原生支持的每个协议，都已从真实服务器或设备读取过真实数值，并在裸机上运行过(2026-11-17)。有独立实现的地方，HotLoop 已与其双向运行过。

| 协议 | 原生 | 状态 |
|---|---|---|
| Modbus TCP/RTU | 是 | **已在实机验证** |
| OPC UA | 是 | **已在实机验证**，包括与 Ignition 8.3.9 在加密通道上用用户名和密码双向连接 |
| MQTT / Sparkplug B | 是 | **已在实机验证** |
| MTConnect | 是 | **已在实机验证** |
| HTTP / REST | 是 | **已在实机验证** |
| S7comm | 是 | **已在实机验证**(裸机，2026-11-17) |
| EtherNet/IP | 是 | **已在实机验证**(裸机，2026-11-17) |
| UniFi Network | 是 | **已在实机验证**，只读，在真实控制台和交换机上，包括 WAN 和故障切换 |
| SNMP | 是 | **已在实机验证**，只读，覆盖 v1、v2c 和 v3 的所有安全级别 |
| CODESYS | 是 | **已在实机验证**，可读可写，包括 2.4 秒读完一个超过 100,000 个变量的程序 |
| BACnet/IP | 是 | **已在实机验证**，只读 |
| OPC UA PubSub (UADP) | 是 | **已在实机验证**，双向 |
| Kafka API(输出) | 是 | 已针对 Apache Kafka 和 Redpanda,**在实机验证**，支持 TLS 和 SASL 登录 |

各厂商的默认值不同：OPC UA 服务器提供哪些证书和令牌策略，BACnet 控制器在对象列表里放什么，SNMP 设备提供哪些 MIB,PLC 如何给数据编号。新现场的新设备仍然是调试工作，所以在信任某个界面之前，请把集成探针上的一个已知值与设备自己的显示对比。

## 原生协议

### OPC UA

设备提供多种选择时，优先用它。它可以浏览，安全措施完善，并且支持订阅。

驱动**使用订阅而不是轮询**。服务器在值变化时按它能承受的速率发送，而不是由客户端每次扫描都问同样的问题却不知道有没有变化。如果服务器拒绝订阅，驱动会改为批量读取，而不是让设备失败。

订阅什么都没送来时，驱动同样会改为读取。服务器在第一次 publish 时发送每个节点的当前值，之后在值变化前不再发送，所以第一次 publish 丢失，就意味着某个设定值在会话持续期间一直读为 bad。如果经过十个发布间隔(至少五秒)订阅仍没有任何值，驱动会记录警告、删除订阅，并在每次轮询时读取这些变量，直到设备下次重新连接。这个驱动所基于的 OPC UA 客户端库，在负载很高的主机上可能以暂停状态启动发布循环，而且从不发出 publish 请求；这个机制就是为这种情况准备的。

订阅在已有值到达之后停止时，驱动也会改为读取。库把 keep-alive 留在内部处理，所以发布循环停止看起来就像工厂里什么都没有变化。订阅安静了十个发布间隔(至少三十秒)后，驱动会读取每个节点一次，并与订阅最后送来的值比较。只要有任何节点的值或质量不同，就说明服务器压着本该发送的内容，驱动会记录警告、删除订阅，并在每次轮询时读取，直到设备重新连接。如果一致，它继续运行，并在同样的安静时间后再次检查。一个正常而安静的订阅，代价是每三十秒一次批量读取。

**请用命名空间 URI 来寻址节点。**这比看上去重要得多：

```
nsu=http://opcua.edge.server;s=Zone1_Temperature    good
ns=3;s=Zone1_Temperature                            works until it doesn't
```

命名空间*索引*按服务器碰巧加载命名空间的顺序分配。增加一个命名空间、升级固件，索引 3 就会悄悄变成别的东西，之后每个读数都是错的，却没有任何错误提示。URI 是模型的一部分，不会变。`Browse` 返回 URI 形式正是出于这个原因。

仅有字符串的地址会被拒绝。如果按 `ns=0;s=Temperature` 来读，一个拼写错误也能被干净地解析成一个不存在的节点，变量会永远读为 bad。必须使用明确的形式，这样错误在保存时就会暴露出来。

**Discover tags 会把每个变量声明为服务器所说的节点所持有的类型**:Boolean 是 `bool`，整数类型保持其宽度(`int16`、`uint16`、`int32`、`uint32`、`int64`、`uint64`;SByte 和 Byte 取更大的一档),Float 和 Double 是 `float`,String、DateTime、LocalizedText 以及驱动按文本读取的其他类型是 `string`。服务器没有说明的类型，或没有更合适名称的类型(枚举、结构体)仍为 `float`。在下面的 Ignition 工作之前，每个发现的变量都是 `float`。驱动仍然能读出 String 节点的文本，但变量声明为 float，而网关自己的 OPC UA 服务器按声明的类型发布变量，所以该服务器的客户端对它得到 `Bad_TypeMismatch`。Ignition 里 Emberburn 的 `System_Status` 恰好就是这样。修复前导入的变量保持原类型：请手动把文本变量改为 `string`。

配置：安全、身份和证书选项在 [OPC UA:安全与凭据](#opc-ua安全与凭据)中说明。其余为 `subscribe`、`publishIntervalMs`、`samplingIntervalMs`、`queueSize`、`sessionTimeoutMs`、`browseMaxNodes`、`browseRoot` 和 `browseServerNodes`。驱动不认识的选项名是一个列出已知选项的错误，而不是被悄悄忽略的设置：否则 `securityMode` 拼错后会在毫无安全保护的情况下连接，看上去和正常工作的设备一模一样。

**Discover tags 会省略服务器自己的 `Server` 对象**(`i=2253`:其状态、能力、诊断、命名空间数组和配置)。每个 OPC UA 服务器都有它，它可能是混在工厂自己变量中的数百个变量。在设备上把 `browseServerNodes` 设为 `true` 可以把它们找回来，或者把 `browseRoot` 设为 `i=2253` 来有意查看其内部；从那里开始的浏览仍会走完全部内容。

### OPC UA:安全与凭据

直到 4.15.0，驱动只能建立匿名的、不加密的连接，而且连不上任何遵循规范的服务器：它从不询问服务器提供哪些身份令牌策略，而是发送一个空的令牌策略 id，合规的服务器会拒绝它。这也包括 HotLoop 自己的 OPC UA 服务器。现在驱动会发现服务器的端点，选出与设备匹配的一个，并回送该端点列出的策略 id。

#### 设备选项

| 选项 | 默认值 | 作用 |
|---|---|---|
| `securityMode` | `None` | `None`、`Sign` 或 `SignAndEncrypt`。省略且 `securityPolicy` 不是 `None` 时，取 `SignAndEncrypt`。 |
| `securityPolicy` | 服务器为该模式提供的最佳策略 | `None`、`Basic256Sha256`、`Aes128_Sha256_RsaOaep` 或 `Aes256_Sha256_RsaPss`。`Basic128Rsa15` 和 `Basic256` 会被拒绝。 |
| `username`, `password` | 匿名 | 用户名认证。 |
| `userCertificate`, `userPrivateKey` | 无 | X.509 用户认证：会话以服务器将此证书映射到的用户身份登录，无需密码。两者均为 PEM，需一起设置。密钥是 RSA(OPC UA 库只用 RSA 签名；EC 密钥会被拒绝并说明原因)，并且与密码一样是机密：静态加密保存、在每个 API 响应中隐去、从不写入日志。证书属于用户，而不是 `certFile` 中的客户端应用证书。同时设置了 `username` 时，使用证书。对于 HotLoop 自己的服务器，证书必须先关联到一个用户([OPC UA 服务器](/zh-hans/edge/opc-ua-server/#x509-用户证书))。 |
| `allowInsecureCredentials` | `false` | 允许在不加密的通道(`securityMode` 为 `None`)上，或没有任何东西加密时发送密码。 |
| `certFile`, `keyFile` | 自动生成 | 此客户端的应用证书及其 RSA 密钥，用于加密模式。两者都设置或都不设置。 |
| `pkiDir` | `HOTLOOP_OPCUA_CLIENT_PKI_DIR` (`/data/opcua-client-pki`) | 生成的证书以及 `trusted/` 和 `rejected/` 存储所在的位置。 |
| `serverCertThumbprints` | 无 | 无需 `trusted/` 中的文件即可信任的服务器证书的 SHA-1(40 位十六进制)或 SHA-256(64 位)指纹。冒号和空格会被忽略。 |
| `insecureSkipVerify` | `false` | 接受任何服务器证书。 |

未设置以上任何选项的设备与以前一样：匿名，通过不加密的通道。

#### 驱动如何选择端点

驱动通过不加密的通道向服务器询问其端点。规范要求服务器为发现而允许这样做，而且不涉及任何机密，因为端点列表本来就是公开的。它保留安全模式和策略与设备匹配的端点，并在其中选择适合设备身份(匿名，或设置了 `username` 时的用户名)的令牌策略。随后发送的身份令牌带有该端点列出的策略 id;它从不发送空的 id。

- **它从不选择 `Basic128Rsa15` 或 `Basic256`。**两者都已被 OPC 基金会弃用。无论其中之一在列表上具有最高安全级别(服务器就是这样排序的)，还是服务器只提供这一种，都是如此，后一种情况下连接会失败，并给出说明此事的错误。设备无法被配置为使用它们，会用它们加密密码的令牌策略同样被拒绝。HotLoop 自己的服务器在现代策略之外也提供这两种，而且无法关闭，所以这一点是在真实服务器上验证的，测试还会检查驱动发送的内容中不出现这两种策略的 URI。
- **设备未指定策略时，它依次优先选择 `Basic256Sha256`、`Aes128_Sha256_RsaOaep`、`Aes256_Sha256_RsaPss`**，不论服务器给它们定的安全级别如何。顺序依据的是各自被支持的广泛程度，而不是强度。有些服务器无法用 `Aes256_Sha256_RsaPss` 打开通道，并且不说明原因就关闭连接，所以只有设备指定它时才会使用。
- **如果没有匹配项，错误会列出服务器实际提供的内容**，包括每个端点的策略和令牌策略 id，这样仅凭消息就能修正配置。

#### 客户端自己的证书

任何加密模式都需要应用证书。如果设备指定了 `certFile` 和 `keyFile`，在通过检查(RSA、至少 2048 位、未过期)后原样使用。否则在首次使用时生成自签名证书，保存在 PKI 目录中：RSA-2048，五年，主体备用名称中的应用 URI 为 `urn:hotloop:client:<host name>`，密钥权限为 `0600`，证书为 `0644`，目录为 `0750`。其布局与 OPC UA 服务器的相同：

```
own/cert.pem, own/key.pem   this client's certificate
trusted/                    server certificates an operator has approved
rejected/                   server certificates the driver turned away
```

常规启动不会重新生成它，所以已被告知信任它的服务器无需再次被告知。只有在它无法读取、不是至少 2048 位的 RSA 或剩余不足 30 天时才会替换，并发出警告：每个服务器都必须批准新证书。同一时刻启动的设备共用一个证书，而不是各写各的。

目录必须可写且持久。在 Helm chart 中对应 `opcuaClient.persistence.enabled`(默认关闭，因为它会给现有安装增加一个卷);在边缘中继上则是现有的 `/data` 卷。没有可写目录时，加密设备会报告一个指出需要设置哪个变量的错误，而不是用下次重启就会丢失的证书去连接。

**服务器**也必须信任这个证书，这是服务器自己的设置。对于 HotLoop 自己的服务器，操作相同：第一次被拒绝的尝试之后，驱动的证书会出现在服务器的 `rejected/` 目录中，把它移到 `trusted/` 即可批准。服务器在安全通道打开过程中关闭连接时(许多服务器就是这样拒绝它们不信任的证书)，错误会指出此客户端的证书文件和指纹，让操作员知道该在服务器上找什么。

#### 批准服务器的证书

对于加密模式，或需要用服务器密钥加密的密码，**驱动不会接受服务器出示的任何证书。**只有当证书被固定在设备的 `serverCertThumbprints` 中，或者就是 `trusted/` 中的那个证书时，才会信任它。其他情况会写入 `rejected/<thumbprint>.der`，并在发送任何凭据之前让连接失败，消息类似：

```
opcua: the server at opc.tcp://plc-01:4840 presented a certificate that is not
trusted (subject "CN=PLC01", SHA-1 thumbprint 5A6DB35A..., expires 2031-09-18).
It has been saved to /data/opcua-client-pki/rejected/5A6DB35A....der. To approve
it, first check that the thumbprint matches the one the server shows, then move
that file into /data/opcua-client-pki/trusted (the next connection attempt picks
it up; no restart is needed). Alternatively pin it by adding the thumbprint to
this device's serverCertThumbprints. Until then this device will not connect
```

批准之前，请把指纹与服务器自己的显示对比：这个比对就是整个信任决策。然后用 `mv` 把文件移到 `trusted/`(PEM 和 DER 文件都会被读取)，设备会在下一次尝试时连接，这在运行时的重连间隔之内。一些细节：

- 信任针对的是证书本身，而不是证书链。由 CA 签发证书的服务器，要把该服务器自己的证书放进 `trusted/` 才算批准，与自签名证书一样。不支持信任 CA。
- 已过期但曾被操作员批准的证书仍然受信任，每次连接时日志中会有一条警告。拒绝操作员有意批准的证书，只会把他们推向 `insecureSkipVerify`。
- `trusted/` 中不是证书的文件会被跳过并报告，不会让其他已批准的服务器无法访问。
- `rejected/` 最多保存 256 个文件，所以每次连接都出示不同证书的服务器无法写满磁盘。超过后连接仍被拒绝，消息会说明文件没有保留，以及如何仍然批准该证书。
- `insecureSkipVerify` 会关闭检查。此时路径上的任何一方都可以冒充服务器，并读取发给它的内容，包括密码。它默认关闭，并在每次连接时连同证书指纹一起发出警告。

在不加密通道上的匿名设备不需要这些，因为没有任何东西用服务器的密钥签名或加密。

#### 凭据

除非通道已加密且有东西为密码加密，否则密码在发送前就会被拒绝。驱动根据服务器对所匹配端点提供的内容，作出如下判断：

| 通道 | 服务器的用户名令牌策略 | 结果 |
|---|---|---|
| `SignAndEncrypt` | 加密密码(常见情形) | 连接 |
| `SignAndEncrypt` | 不加密 | 连接：由加密通道承载，日志会说明这一点 |
| `Sign` | 加密密码 | 连接 |
| `Sign` | 不加密 | 除非设置 `allowInsecureCredentials`，否则**拒绝**。`Sign` 会认证消息，但不会隐藏它们。 |
| `None` | 加密密码 | 除非设置 `allowInsecureCredentials`，否则**拒绝**。在不加密的通道上，加密密码所用的密钥来自一个没有任何东西认证的应答，所以任何能篡改流量的人都能还原密码。选择启用后会连接，并带有警告。 |
| `None` | 不加密 | 除非设置 `allowInsecureCredentials`，否则**拒绝** |

**在 `securityMode` 为 `None` 时使用用户名会被拒绝，即使服务器的令牌策略会加密密码。**密钥可由攻击者选择的加密，无法抵御那个攻击者；而在不加密的通道上，加密密码所用的证书取自服务器对 `CreateSession` 的应答，而这个应答没有任何东西认证(下面的测试会替换证书并还原密码)。错误消息会说明这一点，并指出解决办法 `securityMode` `SignAndEncrypt`。匿名会话不受影响。

`allowInsecureCredentials` 是唯一允许密码以这种条件发出的开关。它默认关闭，并且当连接正是由它允许时，每次连接都会发出警告。在令牌策略加密密码的情况下，它改变的是监听者能读到什么，而不是篡改流量的一方能读到什么：参见[网络上传输的内容](#网络上传输的内容)。即使启用它，当密码用服务器证书加密时，也必须先批准服务器的证书。

在驱动和 API 处理密码的任何地方，密码都是机密：

- **API 响应。**在每个返回设备的响应中(`GET /api/devices`、`GET /api/devices/{id}` 以及保存的响应)它都被替换为 `[redacted]`，所以拥有 `devices.read` 的 viewer 读不到它。从 4.15.1 起，这对每个角色都成立，包括管理员，也适用于每个协议的凭据，而不只是这一个协议。带着占位符保存设备会保留已存的密码；新值会替换它；空字符串会清除它；为没有密码的设备提交占位符会被拒绝而不是被保存。现在省略该字段会保留它(4.15.0 中会清除)。完整规则见[认证与用户](/zh-hans/iot/authentication/#设备凭据只写不读)。Web 界面的设备编辑器按 API 返回的内容显示配置，并保存它所显示的内容，这一点已被处理，所以编辑设备不会丢失其密码。(测试是通过 API 而不是浏览器来验证的。)
- **日志和错误。**驱动的日志行以及它返回的任何错误都不含密码：消息由状态码和设备的非机密设置构成。测试会捕获进程日志、服务器日志和错误，并在所有这些内容中搜索密码。
- **MCP 工具和资源、实时事件流、系统日志。**都不会返回设备的配置(每一个都通过一组固定字段来描述设备)，测试在配置了密码的情况下调用每个工具和资源、打开事件流并读取系统日志，哪里都找不到它。
- **数据库和备份。**密码与其他驱动一样保存在设备的 `config` 列中。到 4.16.0 为止是明文，备份中也包含它。从 4.17.0 起，它用保存在数据库之外的密钥加密(见下文"静态加密")，所以转储文件或备份里只有密文。无论哪种情况，请参阅[备份与恢复](/zh-hans/iot/backup/#保护备份文件)，并相应地保护数据库和备份卷。
- **边缘中继。**设备文件同样包含密码。在 Helm chart 中，把带凭据的设备文件放进 Secret，并在 `devicesSecret` 中指明；直接在 chart 的 values 里设置的设备会进入 ConfigMap。通过车队配置推送下发的设备文件会以 retained 方式发布到一个 MQTT 主题，所以代理必须启用 TLS，并限制谁可以读取该主题。

错误的密码会得到一个清晰的错误，只需一次尝试，驱动内部不会挂起，也不会重试：

```
opcua: authentication rejected: the server at opc.tcp://plc-01:4840 rejected the
user name and password for "svc-hotloop" (StatusBadUserAccessDenied). ...
```

之后运行时会等待**十分钟**(在五到十分钟之间抖动)再进行下一次尝试，而不是沿用通常的重连退避(`HOTLOOP_RECONNECT_MAX`，默认 60 秒)。有两件事使被拒绝的登录比网络故障更不宜重复。一是锁定失败几次账户的服务器，会把每次快速重试变成使用该账户的其他所有人的故障。二是每次被拒绝的登录都可能在服务器上留下一个**已创建但从未激活的会话**，在超时之前它会计入服务器的会话上限(库请求二十分钟；`sessionTimeoutMs` 可修改):在 HotLoop 自己的服务器上，一个密码错误的设备每隔几秒重试一次，就占满了二十个会话的默认上限，之后服务器以 `BadTooManySessions` 拒绝了其他所有客户端。会话表较小的控制器受到的影响更大。设备不会停止重试，所以服务器那边的密码修好后，无需任何人操作 HotLoop，十分钟内就会恢复；在设备上更正密码，或者把它关掉再打开，会启动一个新的工作线程，它会立即尝试。

#### 网络上传输的内容

这是实测，不是推理：测试在驱动与服务器之间放置一个录制代理，并在双向的每个字节中搜索。搜索会找到已知存在的字节(服务器以明文发送的端点列表)，这说明代理确实记录了对话。

| 配置 | 密码 | 用户名 | 变量节点 id 和值 |
|---|---|---|---|
| `SignAndEncrypt` | 不可见 | 不可见 | 不可见 |
| `Sign` | 不可见(令牌策略加密) | **可读** | **可读** |
| `None`、用户名、服务器的令牌策略加密(需要 `allowInsecureCredentials`) | 不可见 | **可读** | **可读** |
| `None`、匿名 | 不适用 | 不适用 | **可读** |
| 提供未加密密码的服务器，使用 `allowInsecureCredentials` | **可读** | **可读** | 取决于模式 |

最后一行是针对一个实际上并不这样提供的服务器测试的：位于真实服务器前面的一方，在发现所用且没有任何东西认证的通道上，改写其端点列表，声称密码未加密。测试也是这样展示拒绝的：没有选择启用时，驱动拒绝，只打开发现连接，线路上没有任何凭据。端点列表恰恰是路径上的一方可以改写的东西，所以驱动的规则是应用于它被告知的内容，而不是交给服务器去执行。

带密码的不加密通道有一个表中看不出的限制，有一个测试把它展示了出来；这就是驱动在没有选择启用时拒绝这种组合的原因。密码用服务器的证书加密，这使监听者看不到它，而且在该证书被批准之前，驱动不会发送。但 OPC UA 库用来加密的证书是创建会话时服务器应答中的那个，而在不加密的通道上，该应答没有被认证。能篡改流量的一方放入自己的证书，密码就会用那一方的密钥加密：测试就是这样做的，用被替换的密钥解密密码并拿回它。**在 `Sign` 或 `SignAndEncrypt` 下，同一方做不到**，因为应答由它没有的密钥保护。没有 `allowInsecureCredentials` 时，驱动根本不发送密码，测试表明此时同一方什么也得不到；有它时，驱动每次连接都会警告。凡是服务器提供 `SignAndEncrypt` 的地方，都请使用它；选择启用后的带密码不加密通道，只能防监听者，仅此而已。

#### 重新连接

OPC UA 库自带的重连已被关闭，由运行时负责重连。库在会话丢失后，会用所给的凭据打开新会话，服务器拒绝时又立即重试，没有任何延迟：对一个密码已被更改的服务器，曾测到十二秒内约二十次被拒绝的登录。共用账户的所有人就是这样被锁定的。现在会话丢失会让 `Poll` 报告错误，运行时的工作线程关闭驱动并打开一个新的，新驱动发现端点、检查服务器证书并重新登录，采用运行时带抖动的退避，以及认证失败后的十分钟等待。服务器重启也以同样方式度过：设备重新登录后读到重启后的新值，测试通过统计服务器的登录次数以及在重启后修改值来检查这一点。

没有变量的设备没有东西可读，直到 4.15.2，这意味着它的轮询什么也不发送。服务器在会话超时后关闭了空闲会话，设备因为没人向服务器询问任何事而一直说自己已连接，每次浏览都以 `BadSessionIDInvalid` 失败，直到进程重启。每台设备在刚被添加并点击 Discover tags 的那一刻都是这样。Ignition 发现了这个问题。现在没有变量的设备在每次轮询时读取服务器的状态，这会让会话保持活动并在其失效时察觉，发现会话已消失的浏览会报告这一点，让运行时重新连接。

一个在会话开始之前就没有变化的变量，现在以良好的质量读到其当前值。以前，等待第一个值时报告的占位读数比该值自己的源时间戳更新，运行时保留最新的读数而丢弃了该值，所以稳定的变量会一直读为 bad，直到它下次变化。

#### 测试过什么，没测试过什么

OPC UA 已针对 Ignition 8.3.9 和独立的 OPC UA 服务器运行，使用匿名以及用户名和密码登录，涵盖 `None`、`Sign` 和 `SignAndEncrypt`，并在 2026-11-17 于裸机上运行。每个生产服务器对提供哪些策略以及如何拒绝证书都有自己的习惯，所以请把首次连接新厂商的服务器视为调试工作。

需要了解：

- 现在每次连接都会先向服务器询问其端点，没有安全选项的设备需要一个列出带 id 的匿名令牌策略的不加密端点。接受匿名会话却没有列出该策略的服务器会被拒绝，并给出列出其所提供内容的错误。
- 驱动未实现 X.509 证书和 issued-token 用户认证。设备的 `certFile` 是其应用证书。
- 信任针对证书本身。不支持信任证书颁发机构和证书吊销。
- 不支持椭圆曲线安全策略，也不支持在不加密通道上拒绝发现的服务器。
- 如果网络路径中断而两端都没有看到连接关闭，设备会停留在最后的值上，直到操作系统放弃该连接。
- 有些服务器无法用 `Aes256_Sha256_RsaPss` 打开通道。
- HotLoop 自己的服务器接受最长 72 字节的密码。其他服务器可能有自己的限制。

#### Ignition 8.3

已针对 **Ignition 8.3.9**(当前稳定版)在 Inductive Automation 自己的容器镜像中验证：HotLoop 的驱动作为客户端，另一端是 Ignition 的 OPC UA 服务器，使用 `Basic256Sha256` 与 `SignAndEncrypt`，以用户名和密码登录。浏览在 `nsu=urn:inductiveautomation:ignition:opcua:tags` 下找到了 Ignition 的变量，`[System]/Gateway` 的时钟、CPU、内存和运行时间变量被导入，并以良好的质量读取，由订阅推送。

一个原装的 8.3 网关会在 HotLoop 开口之前拦你四次：

1. **它的 OPC UA 服务器只在 localhost 上监听。**开箱即用时，8.3 把端口 62541 绑定到 `localhost`，所以别处的 HotLoop 只会得到连接被拒绝，别无其他。在网关的 OPC UA 服务器设置中，把 Bind Addresses 设为 `0.0.0.0`。我们还把 HotLoop 拨号用的主机名加到了 Endpoint Addresses 中；驱动是否需要这一点没有测试过。
2. **变量默认不在 OPC UA 上。**请打开 Expose Tag Providers，否则浏览只能找到服务器自己的诊断信息和设备文件夹。
3. **证书是双向的。**如上所述，HotLoop 在你批准之前会拒绝 Ignition 的证书。Ignition 在你于网关的 OPC UA 服务器证书中信任它之前，会拒绝 HotLoop 的证书。在磁盘上，就是把它从 `data/config/local/com.inductiveautomation.opcua/server/security/pki/rejected/certs` 移到 `.../trusted/certs`，无需重启。**Ignition 不会用 HotLoop 记录的 SHA-1 指纹来命名该文件。**请打开证书并比对其指纹；文件名不会匹配，这并不是冒充者的迹象。
4. **OPC UA 登录是 `opcuauser` / `password`**，位于 `opcua-module` 用户源中，每次全新安装都是如此。请在任何真实设备连接之前修改它。

这个方向上只测试了 8.3 的服务器开箱提供的内容：`Basic256Sha256` 和 `SignAndEncrypt`。

**另一个方向也已验证：Ignition 8.3.9 的 OPC UA 客户端读取 HotLoop 的 OPC UA 服务器**，以 HotLoop viewer 身份登录，涵盖 Ignition 提供的每种安全策略和模式。配置、双向的证书信任、注意事项以及策略矩阵见 [OPC UA 服务器](/zh-hans/edge/opc-ua-server/#以-ignition-83-作为客户端)。它发现了两个 HotLoop 的缺陷，均已修复：每次容器重建服务器都会生成新证书，导致每次升级后 Ignition 的信任都被破坏；Discover tags 把每个变量都声明为 float，所以文本变量到达 Ignition 时是 `Bad_TypeMismatch`(见上文)。

HotLoop 的 Sparkplug 边缘节点和 Edge Relay 与 Ignition 的 MQTT Engine 的对接是下一步，尚未完成。

### OPC UA PubSub (UADP)

另一种 OPC UA:不是客户端向服务器发问，而是发布者把 DataSet 作为 UDP 数据报发给任何在监听的对象，单播或组播(OPC 10000-14,UADP 编码)。HotLoop 作为设备来订阅，作为设置来发布。

**订阅。**添加协议为 `opcua-pubsub` 的设备。地址是要监听的位置：`udp://239.0.0.1:4840` 加入一个组播组，`udp://:4840` 监听单播。变量的地址是 `<DataSetWriterId>/<field index>`，即字段在发布者 DataSet 中的位置，从 0 开始计数：`1000/3` 是 writer 1000 发布的第四个字段。UADP 不携带字段名(它们存在于发布者以其他方式提供的 DataSetMetaData 中，或者根本没有)，所以数据报能说明的是位置。数组字段按一个元素一个元素来读：`1000/3[17]` 是作为第四个字段的数组的第十八个值。Browse 会列出已收到的字段及其类型，数组则列出其元素(前 1000 个)。

```json
{"publisherId":"2234","writerGroupId":100,"interface":"eth0","timeoutMs":30000,
 "dataSets":[{"writerId":62541,"types":["Float","UInt16","Boolean","Int32","Double"]}]}
```

- `publisherId` 和 `writerGroupId` 让设备只对应一个发布者和组。留空和为零表示全部接收。多个设备就是靠它们共用一个地址：一个向 `udp://:4840` 发送两个 WriterGroup 的发布者，在那里就是两个设备，一个带 `"writerGroupId":1`，另一个带 `"writerGroupId":2`。
- 设备可以共用地址和端口。HotLoop 为它打开一个套接字(对一块网卡上的一个组播组只加入一次)，并把每个数据报交给该地址上的每个设备。然后每个设备应用自己的 `publisherId`、`writerGroupId` 和 `dataSets`，所以每个设备都能看到它的发布者的完整数据流，没有数据流被设备之间瓜分。当该地址上的最后一个设备被移除或停止时，套接字关闭，下一个启动的设备会再次打开它。设备按书写的地址匹配：`udp://:4840`、`udp://0.0.0.0:4840` 和 `udp://[::]:4840` 对 HotLoop 来说是三个地址，它们能否共存取决于操作系统，一向如此。在两块不同网卡上加入的同一个组播组是两个套接字。对独占自己地址的设备没有任何变化。
- 组、端口和网卡都由设备决定：HotLoop 中没有任何固定的东西。带 `"interface":"eth0"` 的 `udp://239.192.0.1:4850` 在那块网卡上加入该组，`udp://127.0.0.1:4842` 监听同一台机器上的一个发布者。多个设备可以同时监听不同的组和端口，也可以监听同一个。
- `interface` 是加入组播组所用的网卡，按名称(`eth0`、`lo`)或其某个 IPv4 地址(`127.0.0.1`)指定。有多块网卡的机器需要它。同一台机器上的发布者通过回环向某个组发送(`IP_MULTICAST_IF` 127.0.0.1、TTL 0、开启回环、无路由)时，带 `"interface":"lo"` 或 `"127.0.0.1"` 的设备可以收到；如果没有指定接口也没有路由，加入会以 `no such device` 失败并如此说明。
- `dataSets` 只用于 RawData，它在线路上不携带类型：按顺序给出发布者的字段类型，以便读取这些字节。Variant 和 DataValue 消息自带类型。每一项是一个类型名(`"Float"`)，也可以说明一块值是如何排布的：`"Float*250"` 是前面没有长度、一个接一个的 250 个字段，这是把一块 REAL 作为单独字段发送的 PLC 的写法；`"Float[250]"` 是一个最多 250 个值的数组字段，写法与 OPC 基金会协议栈写 RawData 数组的方式一致(一个 Int32 计数、若干值，以及补零到 250 个);`"String(40)"` 是补齐到 40 字节的 String，可单独使用，也可写成 `"String(40)[4]"`。
- 关键帧(key frame)替换 DataSet 的字段；增量帧(delta frame)只改它点名的那些字段；keep alive 证明发布者还活着。一条消息丢失(序号出现缺口)会把该 DataSetWriter 的变量标记为 **uncertain**，直到它的下一个关键帧，因为可能有一个增量帧随之丢失。DataSet 配置版本的变化会让所有字段被遗忘，直到关键帧说明它们现在的含义。
- writer 沉默超过 `timeoutMs`(未设置时为 30 秒)就读为 **bad** 并说明原因，而在超时时间内没有收到其发布者任何消息的设备则为离线。发布者标记为 Bad 的字段是 bad，标记为 Uncertain 的是 uncertain;原因是状态码。
- 读数的时间是发布者的，取自字段、DataSetMessage 或 NetworkMessage，前提是它已设置且不比本机时钟超前一分钟以上，否则取其到达的时间。
- 数组在 Variant 和 DataValue 消息中读取(一个 Int32 计数和若干值，OPC 10000-6 5.2.2.16;多维数组按行展平送来)，在 RawData 中则需要布局。数据报装不下的计数会在为它创建任何内容之前被拒绝。
- 只读。不支持消息安全(已签名或加密的 NetworkMessage)、分块消息、发现消息、事件和结构体字段；包含其中任何一种的数据报会被拒绝，按原因计数，绝不猜测。

**发布。**在 `HOTLOOP_UADP_PUBLISH_ENABLED` 被设置之前是关闭的，适用于 Edge 和 Gateway(带有 OPC UA 服务器的产品)。它发送布局所指定的变量：

```json
{"dataSets":[{"writerId":1,"name":"press","configMajor":1,"fields":[
  {"device":"press-01","tag":"Zone1_Temp","type":"Float"},
  {"device":"press-01","tag":"Cycle","type":"UInt32"}]}]}
```

| 变量 | 默认值 | <span class="sr-only">详情</span> |
|---|---|---|
| `HOTLOOP_UADP_PUBLISH_ADDRESS` | | 组播组用 `udp://239.0.0.1:4840`，单个订阅者用 `udp://host:4840` |
| `HOTLOOP_UADP_PUBLISH_LAYOUT_FILE` 或 `_LAYOUT` | | 上述布局，以文件或内联方式给出(文件优先) |
| `HOTLOOP_UADP_PUBLISH_PUBLISHER_ID` | `1` | 数字或文本 |
| `HOTLOOP_UADP_PUBLISH_WRITER_GROUP_ID` | `1` | |
| `HOTLOOP_UADP_PUBLISH_INTERVAL` | `1s` | |
| `HOTLOOP_UADP_PUBLISH_KEY_FRAME_EVERY` | `10` | 关键帧之间最多相隔这么多个间隔 |
| `HOTLOOP_UADP_PUBLISH_DATAVALUE` | `false` | 用 DataValue 字段(值、状态、时间)代替 Variant |
| `HOTLOOP_UADP_PUBLISH_DELTA_FRAMES` | `false` | 发生变化的 DataSet 在关键帧之间以增量帧(只含变化的字段)发出 |
| `HOTLOOP_UADP_PUBLISH_METADATA_EVERY` | `10` | 每个 DataSet 的字段名和类型每隔这么多个间隔通告一次；`0` 表示不发送 |
| `HOTLOOP_UADP_PUBLISH_INTERFACE`, `_TTL` | 系统默认，`1` | 组播发出所用的网卡，及其跳数限制 |

每个 DataSet 通过自己的 DataSetWriter 发出，每个一条 NetworkMessage。值发生变化的 DataSet 作为 key frame（每个字段）发出，没有变化的作为 keep alive 发出，并且至少每 `KEY_FRAME_EVERY` 个间隔发一次 key frame，使晚加入的订阅方能够趋于一致。key frame 是完整的，所以丢失一个数据报只损失一个间隔，而不会出现错误的值。设置 `HOTLOOP_UADP_PUBLISH_DELTA_FRAMES=true` 后，发生变化的 DataSet 改为作为 delta frame 发出，只携带自上一条消息以来变化的字段及其位置，key frame 仍至少每 `KEY_FRAME_EVERY` 个间隔出现一次；此时丢失一个 delta 最多会让某个字段过时这么多个间隔，这就是在慢速链路上换取更小消息的代价。HotLoop 自己的订阅方可以读取 delta frame。value。状态不好的变量会以其状态发布，绝不以其最后一个值发布；尚未读到任何内容的变量发布为 `BadWaitingForInitialData`。值会被限制在其发布的类型内，不会回绕。不支持消息安全，所以这应放在工厂信任的网络上。同一布局的变量可以由另一台设备上 HotLoop 自己的订阅方读取。

**已证明的内容。**一个独立的 OPC UA PubSub 协议栈向 HotLoop 的订阅方发布，并通过多播订阅 HotLoop 的发布方，而 HotLoop 的发布方可被 HotLoop 自己的订阅方正确读取。**消息安全。**订阅方设备可以要求其发布方的 NetworkMessage 经过签名，或经过签名和加密（OPC 10000-14 7.2.4.4.3），使用规范定义的两种策略，`PubSub-Aes128-CTR` 和 `PubSub-Aes256-CTR`：

```json
{"publisherId":"2234","security":{"mode":"signAndEncrypt","policy":"PubSub-Aes128-CTR",
 "keys":[{"keyId":1,"signingKey":"<64 hex digits>","encryptingKey":"<32 hex digits>","keyNonce":"<8 hex digits>"}]}}
```

密钥是静态的：在两端设置于一个 SecurityTokenId（`keyId`）之下，十六进制或 base64。它们是密钥，显示为 `[redacted]`，保存时保持不变。持有两个密钥的设备可以接受从一个切换到另一个的发布方。设置了 `security` 时，未签名（或在 `signAndEncrypt` 下未加密）、用另一个密钥签名或在途中被改动的消息，在读取其中任何内容之前就会被拒绝并计数（`unsecured`、`signature`、`security_key`）。未实现 Security Key Service（GetSecurityKeys，轮换密钥）。发布方用 `HOTLOOP_UADP_PUBLISH_SECURITY_MODE`（`sign` 或 `signAndEncrypt`）、`_POLICY`、`_KEY_ID`、`_SIGNING_KEY`、`_ENCRYPTING_KEY` 和 `_KEY_NONCE` 进行签名。

**元数据与发现。**发布方会以携带 DataSetMetaData 的发现响应通告其 DataSet 叫什么、由什么组成，较大时分块发送（7.2.4.4.4、7.2.4.6）。订阅方设备会读取它们：字段在 Browse 中被命名（`writer1001_<field name>`），RawData DataSet 无需在配置中写 `dataSets` 类型，因为元数据会给出其布局，而更改了配置版本的 DataSet 会从下一个 key frame 起重新开始。两者都有时，配置中的 `dataSets` 仍然优先。订阅方的发现请求不会发送，发布方也不会应答任何发现请求。

**结构体字段、事件。**元数据说明是结构体的字段会被读作其成员，变量把它们寻址为 `1001/0.Value`（结构体数组的元素则是 `1001/7[2].Angle`）；在 Variant 中发送的结构体在元数据对其有描述时会被读取。带可选字段的结构体和联合体按名称报告，而不是猜测。Event DataSetMessage 与其所携带的字段一样被应用，并且不动其余内容（设备统计中的 `Events`）；其布局是 key frame 的布局（7.2.4.5.7），是从规范中读出的，没有对照另一个协议栈检查过。有些发布方会在 RawData key frame 之前写一个 FieldCount，而规范并没有这样做；可用 `"rawFieldCount":true` 告知设备。

### CODESYS

运行 CODESYS Control 运行时(Linux SL、ARM64、Raspberry Pi、Windows、虚拟 PLC)的 PLC，按程序员给变量起的名字读写：`Application.GVL_Line.rTemp`，而不是节点 id。它是在 OPC UA 驱动之上加了 CODESYS PLC 所需内容的驱动，所以 [OPC UA:安全与凭据](#opc-ua安全与凭据)下的一切都适用于它，它的选项就是那些选项。

**PLC 自身的报警。**带有 Alarm Configuration 的项目把其报警保存在 PLC 的报警管理器中。当项目中有 HotLoop Alarms 库的功能块时（参见 CODESYS alarms），HotLoop 会从设备连接的那一刻起，在其报警列表中显示这些报警，并且在 HotLoop 中做出的确认会回传给报警管理器。已针对真实的 CODESYS Control for Linux SL 4.22.0.0 运行时现场验证：触发、确认、复位和确认完成。报警管理器自身的文本列表，以及已试过的两个之外的类，未经验证。

**为什么用 OPC UA 服务器，这对 PLC 意味着什么。**CODESYS 为第三方读取控制器变量只记载了一种方式，就是运行时自己的 OPC UA 服务器：应用的 Symbol Configuration(或从 CODESYS 3.5 SP18 起，Communication Manager 下的 IEC Symbol Set)指明哪些变量被发布以及访问权限，服务器负责提供它们。CODESYS Gateway 的通道协议没有面向第三方记载，这个驱动也不使用它。所以 PLC 必须发布你想看到的内容：

1. 在 IDE 中给应用添加一个 **Symbol Configuration**，并打开 *Support OPC UA features*，勾选变量，或在声明中用 `{attribute 'symbol' := 'readwrite'}` 标记它们(只读用 `'read'`)。
2. 下载。没有 Symbol Configuration 的 PLC 会用一条消息回应设置，提示去添加一个。
3. 只有当变量的符号为 `readwrite`，并且它所连接的用户被允许写入时(设备的 *Symbol Rights*)，变量才可以从 HotLoop 写入。HotLoop 会读取访问级别，并说明是两者中的哪一个拒绝了写入。

来源：[CODESYS 帮助，Symbol Configuration](https://content.helpme-codesys.com/en/CODESYS%20Communication/_cds_symbolconfiguration.html)和 [IEC Symbol Set](https://content.helpme-codesys.com/en/CODESYS%20Communication/_comm_symbol_configuration.html)(符号名为 `<application>.<POU>.<variable>`，访问权限按符号分为读、写或执行，各组的权限在设备的 Symbol Rights 选项卡上，OPC UA 需要控制器上有证书);[面向 IEC 61131-3 的 PLCopen OPC UA 信息模型](https://plcopen.org/system/files/downloads/plcopen_opc_ua_information_model_for_iec61131-3_version1.02.pdf)(1.02 版，下面的布局);OPC UA Part 5(OperationLimits)。节点 id 是 4.22.0.0 运行时所应答的，这个驱动就是据此编写的；`|var|` 的确切拼写是运行时自己的，并不是公布的契约，所以变量按符号寻址，由驱动来构造节点 id。

**布局。**运行时在 OPC UA Device Integration 的 `DeviceSet` 中发布一个代表 PLC 的设备，其下是 `Resources`，再往下是应用，应用之下有 `GlobalVars`(变量列表)和 `Programs`。变量的节点是命名空间 `CODESYSSPV3/3S/IecVarAccess` 中的 `ns=<n>;s=|var|<device>.<application>.<list or program>.<variable>`。驱动通过浏览找到设备和应用，所以项目改名后变量依然有效。

**地址。**一个 IEC 符号，带或不带应用名：

```
Application.GVL_Line.rTemp        a variable of a variable list
GVL_Line.rTemp                    the same; the application is assumed
Application.PLC_PRG.nCount        a program's variable
GVL.motors[2].speed               a field of an element of an array of structures
nsu=CODESYSSPV3/3S/IecVarAccess;s=|var|CODESYS Control for Linux SL.Application.GVL.x
                                  a node id, if you have one
```

**Discover tags** 按应用导出内容的类型列出它们：STRING 是 `string`,BYTE 是 `uint16`,TIME 是 `int64`(毫秒)，枚举是 `int32`，整数宽度保持不变，REAL 和 LREAL 是 `float`。运行时说某个 STRING、BYTE 或 TIME 是 PLCopen 模型的类型(例如 `ns=3;i=3013`);驱动顺着它的 `HasSubtype` 引用找到它所属的标准类型，向 BYTE 的写入也是这样作为 Byte 发送的。每个变量带有其符号被赋予的访问权限。结构体和数组会被展开：每个字段、每个元素各是一个点。它会省略运行时自己的属性(`|vprop|`)、任务列表和 Server 对象。

数组只列出前 32 个元素(`arrayElements`)，因为一千个元素的缓冲区对仪表板来说不是一千样东西，而变量仍可以按符号寻址任意元素。列表在 `browseMaxNodes` 处停止并说明这一点；把 `browseRoot` 设为某个符号(`Application.GVL_Demo`)会列出应用的一部分。浏览按广度优先，所以一个列表中的变量先于它的数组元素出现，应答的大小被控制在运行时可接受的范围内(对于一百个各有一千个元素的数组的应答，它会关闭连接)。

配置：OPC UA 选项，以及 `device`（PLC 的名称，仅当运行时列出不止一个时）、`application`（仅当没有一个叫 Application 时）、`arrayElements`、`alarmSymbol`（HotLoop Alarms 功能块，仅用于跳过对它的搜索）。拼错的选项会产生一个列出有效选项的错误。密码是密钥，像每个设备密钥一样被存储和隐藏。

**运行时对客户端的要求。**它发布的 `OperationLimits` 是每个请求 100 次读取、浏览和监控项，并以 `BadTooManyOperations` 拒绝更大的请求。驱动在连接时读取这些限制，并把每个请求切分到限制以内，对每个 OPC UA 设备都是如此(CODESYS 运行时是第一个有影响的：此前驱动把每个发现的变量都报告为 float，并且读不到变量超过 100 个的设备上的任何变量)。采样默认为一秒，队列为一项，因为 PLC 有自己的扫描要保证，已经在读取它的 Ignition 网关不应被抢走这一点；需要更多时，请设置 `samplingIntervalMs`。

**下载、重启和链路中断。**运行时重启或加载新程序会使会话断开。设备变为断开状态，每个变量以"PLC 的运行时没有应答"为原因读为 bad,HotLoop 会带退避地自行重新连接，并读取符号当前的样子。一个原本能读、却连续两次被拒绝为已消失的符号，会被认为是运行时保留了会话的一次下载，会话会被放弃，以便同样地重新连接。程序中没有的变量对应的变量会带着服务器给的原因读为 bad，不会引起重新连接。

**保护运行时的 OPC UA 服务器。**CODESYS Control 运行时在其 OPC UA 服务器拥有证书之前只提供不加密的端点，之后它还会以 Sign 和 SignAndEncrypt 提供其 `CommunicationPolicy` 的策略(默认 AES128-SHA256-RSAOAEP、Basic256Sha256、AES256-SHA256-RSAPSS)。CODESYS 记载了在 Security Screen(CODESYS Security Agent、Devices、控制器、OPC UA Server)中创建该证书，以及把客户端的证书从"Certificates in Quarantine"移到"Trusted Certificates"来信任客户端。Linux 运行时的 PLC shell 不需要 IDE 也能做同样的事，使用 CODESYS 为设备编辑器的 PLC shell 列出的命令(`cert-getapplist`、`cert-genselfsigned <n>`、`cert-getcertlist quarantine`、`cert-export`、`cert-import trusted`)，通过 Linux 运行时为它记载的 Unix 套接字(`/var/opt/codesyscontrolapi/plcshell.sock`,"Accessing the PLC Shell")。把设备设为 `securityMode` `SignAndEncrypt` 并指定 `securityPolicy`，连接一次(HotLoop 自己的证书会落入运行时的 quarantine，连接被拒绝，并带有说明此事的消息)，信任该证书，设备就能读取了。未展示：IDE 的 Security Screen、CA 签发的证书、带加密运行时的用户管理。

**没有许可证的运行时会自己停止。**没有许可证的 CODESYS Control 运行时以演示模式运行，约两小时后关闭(运行时日志在每次启动时都写 `no runtime license - running in demo mode(~2 hours)`)。从 HotLoop 一侧看，这与任何其他运行时重启一样：设备以"PLC 的运行时没有应答"变为断开，并在有东西再次启动运行时后(容器的重启策略、systemd 单元)自行恢复。HotLoop 里没有任何东西去计这两小时，也不会区别对待这次停止，更不会替你重启运行时；不再被启动的运行时会一直处于断开状态。针对没有许可证的容器中的 4.22.0.0 运行时运行的结果：它在启动 2 小时 5 分钟后自己停止，退出码为 0;容器的重启策略在 31 秒后重新启动了它，其应用在此之后 82 秒运行，设备在应用启动后 35 秒再次读到良好的值(从停止算起 2 分 28 秒)，全程没有手动步骤。

**写入。**与所有设备一样，变量在有人把它标记为可写之前都是只读的，设置过程创建的任何变量都不可写。之后写入的关卡与 OPC UA 相同，前面还多一道 PLC 一侧的关卡：对以只读方式导出的符号，或用户无权写入的符号的写入，会以 PLC 的说法被拒绝，并且从不发送。

**通过集成流程设置**(`codesys`):运行时的地址、OPC UA 安全问题，以及可选的由所保留的点组成的第一个仪表板(也就是 WebVisu 本来会显示的画面；参见[集成](/zh-hans/iot/integrations/#codesys))。已针对容器中的 4.22.0.0 运行时验证；它不涵盖的内容见状态表。

### Modbus TCP/RTU

1979 年的老牌主力。PLC、变频器、电表、RTU，以及每个没有更好选择的网关的退路。

```
holding:100:float32:CDAB    a float across registers 100-101, word-swapped
holding:40:bit3             bit 3 of register 40
holding:200:string16        16 characters from register 200
input:12:int16              a signed input register
coil:5                      a single coil
```

**字顺序**是人们最容易设错的设置，顺序错误的 float 在屏幕上并不明显错误，它是一个看似合理却不真实的数字。厂商手册所印的名称对应的四种排列都受支持：`ABCD`、`CDAB`、`BADC`、`DCBA`。用 `byteOrder` 设置设备的默认值，并用第四个地址字段为每个变量覆盖。

**寻址**是原始的、从零开始的。如果你的图纸使用传统的 40001 式编号，请设置 `oneBased: true` 并照图纸写数字。差一位是最古老的 Modbus 错误。

读取会合并成块：相邻和接近相邻的寄存器合并成一个请求。`maxGap` 控制为避免第二次往返而值得多读多少个未使用的寄存器(默认 8),`maxBlock` 限制单个请求的大小(默认 120，协议上限 125)。

向保持寄存器写入单个位是读取-修改-写入，因为 Modbus 在那里没有原子的置位操作。其余十五位会被保留。

### MQTT 与 Sparkplug B

普通 MQTT，或作为**完整 primary host application** 的 Sparkplug B。

普通主题：
```
mqtt:plant/line1/temperature              a scalar payload
mqtt:plant/line1/state|data.temperature   JSON, extracted by path
mqtt:plant/+/flow                         wildcards work
```

Sparkplug 指标：
```
spb:GroupId|EdgeNodeId|DeviceId|Metric/Name
spb:Plant|Edge1||Node/Uptime               empty device = a node-level metric
```

作为 primary host，驱动做规范要求而大多数集成都省略的事情：

- 发布带有对应 will 的 retained `STATE` birth，这样边缘节点能看到主机掉线，而不是靠超时去推断。默认是 Sparkplug 3.0 形式(携带 JSON 的 `spBv1.0/STATE/<host>`);设置 `legacyState` 可用 3.0 之前的 `ONLINE`/`OFFLINE` 字符串。
- 跟踪每个节点循环的序号，并在节点跳号时要求它 rebirth，因为出现缺口意味着消息丢失，别名表不再可信。
- 在自己重新连接之后要求 rebirth。离开过的主机并不知道期间发生了什么变化。
- 通过 `bdSeq` 把 `NDEATH` 与 `NBIRTH` 匹配，这样上一个会话遗留的 death certificate 不会终止当前会话。

消息顺序是强制的。并发投递 Sparkplug 消息会打乱它们的顺序，使健康的节点看起来像在丢消息，并引发 rebirth 风暴。

### EtherNet/IP (CIP)

Allen-Bradley ControlLogix、CompactLogix 和 Micro820。变量有名字，所以可以询问控制器它持有什么。

```
Temperature                    type from the tag's declared dataType
Speed:dint                     an explicit type wins
Program:MainProgram.Speed      a program-scoped tag, the colon is part of the path
Zones[0].Heater.On:bool        array elements and UDT members
```

CIP 是强类型的，控制器会拒绝所声明类型不匹配的读取，所以类型必须从某处获得。它取自变量的 `dataType`，或取自优先生效的 `:type` 后缀。未知时回退到 `REAL`，大多数过程值都是这个类型。

读取被批量合并成多服务请求，批量失败时回退为逐个读取，这样一个错误的变量路径不会让另外十九个也读不到。

### S7comm

西门子 S7-300、400、1200 和 1500，通过 ISO-on-TCP，按机架和槽位连接。

```
db1:0:real        a REAL at DB1.DBD0
db1:4:dint        a DINT at DB1.DBD4
db1:8.3:bool      bit 3 of DB1.DBB8
db2:20:string32   a 32-character STRING
m:10:word         merker word MW10
i:0.1:bool        input I0.1
q:2:byte          output byte QB2
```

任何宽于一个字节的数据都需要类型。协议无法告诉你四个字节是 REAL 还是 DINT，这是关于 PLC 程序的事实，而不是关于线路的。

默认机架 0、槽位 1(S7-1200/1500)。S7-300/400 通常是槽位 2。`connectType` 默认为 3(S7 Basic)，这样网关不会占用工程师想留给 TIA Portal 的 PG 连接槽位。

没有浏览功能。S7 CPU 不发布其数据块的布局，它保存在 TIA Portal 项目中。

### MTConnect

只读的机床遥测。MTConnect 没有命令通道，这个驱动也不假装有。

按 `dataItemId` 或名称寻址；代理对哪一个稳定并不一致，机器文档里只会出现其中一个。

区分可用的集成与看似合理的集成的两个细节：`UNAVAILABLE` 是代理明确说它没有读数，它会变成 bad 质量，而不是文本"UNAVAILABLE"，也不是零。另外，Condition 的含义是其元素名(`Normal`、`Warning`、`Fault`、`Unavailable`)，而不是通常为空的字符数据。

`Browse` 读取 `/probe` 并遍历任意深度的组件树。

### HTTP / REST

万能的接口，适用于电能表、环境传感器、OEM 控制器，以及底层使用私有协议的网关的 REST 一侧。

```
power.kw                      nested fields
readings[0].value             array indexing
zones[name=Zone1].temp        select an array element by a field value
$.data.temperature            a leading $. is accepted
```

第三种形式才是重要的：这些 API 喜欢返回由 `{name, value}` 对象组成的无序数组，按位置索引是一个等着固件更新来触发的缺陷。

一个请求服务设备上的每个变量。`Browse` 遍历文档，并报告每个标量及到达它的路径。

### 设备健康

HotLoop 运行所在的机器，作为只读设备：`cpu_util_pct`（自上次读取以来非空闲的 CPU 时间）、`mem_util_pct`（MemTotal 相对于 MemAvailable）、`disk_util_pct`（机器的磁盘，即以只读方式挂载在 `diskPath` 的主机根目录的 statfs，默认为 `/host`）、`data_util_pct`（位于 `dataPath` 的卷，即 `/data`，或者那里尚未挂载任何东西时上面最近的现有文件夹），以及当 `jitterFile` 指向实时代理重写的 JSON 文件 `{"core1_us":3.2,"core2_us":2.9,"core3_us":4.1}` 时的 `rtos_jitter_core1_us` 到 `core3_us`（超过五分钟的文件读作坏值）。CPU 和内存来自 `procRoot`（`/proc`，或在挂载了主机的 proc 时为 `/host/proc`）。无法读取的值是带原因的坏质量，绝不是零。该设备由 `HOTLOOP_BOX_HEALTH_NODE` 创建（[OPC UA 服务器](/zh-hans/edge/opc-ua-server/#设备健康面向-embernet-仪表板)）。

### Shelly

任意世代的 Shelly，直接与其通信，中间没有 broker。参见 SHELLY.md。用协议 `shelly` 和设备地址添加设备；如果设置了登录，则用 `{"password":"..."}`（用户是 `admin`；Gen2 及更高版本的设备用其 SHA-256 摘要质询应答，Gen1 设备用 Basic）。`/shelly` 会说明它是哪一代。Gen2、Gen3 或 Gen4 设备用 `Shelly.GetStatus`（`POST /rpc`）读取，它报告的每个组件都会变成自动添加的变量，在有人使其处于待命状态之前保持只读：`switch:0.output`、`switch:0.apower`、`switch:0.aenergy.total`、`switch:0.temperature.tC`、`input:0.state`、`cover:0.current_pos`、`pm1:0.apower`、`em:0.total_act_power`、`temperature:100.tC`、`humidity:100.rh`，以及设备的 `sys.uptime` 和 `wifi.rssi`。设备没有发送的字段不会成为变量。开关的输出（`Switch.Set`）、灯的输出和亮度、卷帘的位置（`Cover.GoToPosition`）以及恒温器的目标值可以被设为待命以便写入。

Gen2 及更高版本的设备还会得到一个 websocket（`ws://<device>/rpc`）：驱动按 Shelly 的 RPC 通道页面在设备发出通知之前所要求的，发送一个带 `src` 的请求帧，用文档说明的 `auth` 对象（对 `dummy_method:dummy_uri` 的 SHA-256）应答 401 帧，并把 `NotifyStatus` 和 `NotifyFullStatus` 合并进它自己的状态副本，因此变化会立即到达变量，而其间的轮询读取的是副本而不是设备。`NotifyEvent`（按键、配置更改）会记入该设备名下的日志。当 websocket 断开，或最近没有确认状态（45 秒没有帧或 pong，2 分钟没有完整读取）时，轮询会通过 HTTP 读取设备。

Gen1 设备（`/status` 和简单的 GET 控制路径，Basic 登录）用它自己的词汇得到同样形态的变量：`relay:0.output`、`meter:0.power`、`meter:0.total`（瓦分钟换算为 Wh）、`light:0.output` 和 `.brightness`、`roller:0.current_pos`、`input:0.state`、`temperature:0.tC`，对于电能表和传感器还有 `emeter:0.power`、`humidity:0.rh`、`flood:0.alarm`。继电器用 `/relay/<id>?turn=on|off` 写入，灯用 `/light/<id>?turn=&brightness=`，卷帘用 `/roller/<id>?go=to_pos&roller_pos=`。根据 Shelly 已发布的 Gen1 和 Gen2 文档构建，并针对真实设备（一个 Plus 1、一个 Plug S 和一个 Vintage 灯泡）的录制数据测试过；尚未针对测试台上的设备测试。Gen1 的电能表、湿度、电池和漏水字段来自文档，没有录制数据作为依据。

### Firmata

一块 Arduino，或任何运行 Firmata 固件的开发板，通过 USB 串口或 TCP，中间没有主机程序。参见 FIRMATA.md。用协议 `firmata` 和串口（`/dev/ttyACM0`、`serial:/dev/ttyUSB0`）或 `host:port` 添加设备；选项 `{"baudRate":57600,"samplingMs":19,"bootWaitMs":5000}`。驱动等待开发板的协议版本（每 300 ms 询问一次），询问其固件、能力和模拟映射，并为开发板上的每个数字引脚和模拟输入创建一个只读变量。变量的地址说明对引脚做什么：`D13`、`D2:in`、`D2:pullup`、`D13:out`、`D9:pwm`、`D10:servo`、`A0`、`I2C:0x48:0x00:2`。数字输入是开发板在变化时发送的端口报告，模拟输入是每个采样间隔的报告，并且每次轮询都会询问协议版本，所以消失的开发板在一次轮询内就能发现；未经询问而到达的固件报告说明开发板重启过。变量没有提到的引脚不会被触碰，简单的 `D<n>` 变量会在驱动连接时把其引脚设为输入，在第一次写入时设为输出。根据协议 2.8.0（github.com/firmata/protocol 中的 protocol.md 和 i2c.md）构建，并针对模拟的 ATmega328P 上的 StandardFirmata 2.5.9 运行：其数字引脚、上拉、0、2.5 和 5 V 的模拟输入、PWM 比较寄存器、舵机的引脚和 I2C 设备的寄存器都是从芯片读回的，而不是从驱动读回的。没有在实体板卡上运行过。

### ONVIF

IP 摄像头、编码器或 NVR。参见 ONVIF.md。用协议 `onvif`、摄像头地址和 `{"username":"...","password":"..."}` 添加设备。驱动先读取 GetSystemDateAndTime，并用摄像头自己的时钟给其 WS-Security UsernameToken 打时间戳（Core Specification 5.12：摘要是 `base64(SHA-1(nonce + created + password))`），读取 GetDeviceInformation 和 GetServices（较旧的摄像头用 GetCapabilities），摄像头列出 Media2 时使用 Media2，否则使用 Media，并读取每个配置文件的编码器、分辨率、流地址和快照地址。需要在 SOAP post 上使用 HTTP Digest 或 Basic 的摄像头会得到相应的应答。服务地址使用添加设备时用的主机访问，除非设置了 `"keepXAddrHosts":true`。PTZ 配置文件会从 GetStatus 添加 `ptz.<token>.pan`、`.tilt`、`.zoom` 和 `.moving`，以及可设为待命的命令 `.move`（ContinuousMove，带可选超时）、`.absolute`（AbsoluteMove）、`.goto_preset`（GotoPreset，按令牌或名称）、`.stop` 和 `.home`。事件来自 pull point（CreatePullPointSubscription、PullMessages、Renew、Unsubscribe），并变成自动添加的变量 `event.<topic>|<source>|<item>`，每次变化都记入日志。快照是 `GET /api/onvif/<device>/profiles/<token>/snapshot`，发现是 `POST /api/onvif/discover`（WS-Discovery，针对 `NetworkVideoTransmitter` 的多播 Probe）。

根据 ONVIF 的 Core、Media、Media2、PTZ 和 Event 规范（onvif.org/specs）构建。它发送的每个请求都符合 ONVIF 的 WSDL 和 XSD 文件（xmllint，放宽了 libxml2 因唯一粒子归属而拒绝的 33 个类型和一个元素，请求用到的没有一个在其中），并针对 onvif_srvd 运行，这是一个独立的 ONVIF 协议栈，它解析 WS-Security 标头但不检查它，所以登录的摘要改为对照 zeep 4.3.3 的摘要校验。事件服务和 WS-Discovery 只有根据规范编写的脚本可供运行。没有在实体摄像头上运行过。

### UniFi Network

把工厂网络作为一台设备：一个 UniFi 控制台上的一个站点，其交换机、每个交换机端口、PoE 功耗、WAN 链路以及站点健康状况，以随设备被纳管而自动创建的变量呈现，在启用之前为只读。每个控制台一次登录，证书被固定，控制台密码在数据库中加密。它只通过人启用的少数命令变量来改变控制台(定位 LED、重启、端口的 PoE 断电重启；参见 UNIFI.md)。它还会监听控制台的事件 websocket，所以交换机掉线会在发生时记入日志簿，底层仍以轮询为准，UniFi 选项卡会绘制概览、地图、面板示意图、客户端、网络和 WiFi。有关它的一切都在 [UniFi Network](/zh-hans/iot/unifi/) 中。

### UniFi Protect

Protect NVR 的摄像头、传感器、灯和警报器，通过 Protect Integration API，使用控制台 Integrations 页面中的 API 密钥（密钥放入 `{"apiKey":"..."}`，像控制台密码一样被封存，证书像 UniFi Network 一样用 `certFingerprint` 固定）。用协议 `unifi-protect` 和控制台地址添加设备。变量会自动添加，在被设为待命之前保持只读：`cam.<id>.online`、`.motion`，以及摄像头支持的类型对应的 `.smart_person`、`.smart_vehicle`、`.smart_package`、`.smart_licensePlate`、`.smart_face` 和 `.smart_animal`；`sen.<id>.online`、`.open`、`.motion`、`.leak`、`.tamper`、`.temp_c`、`.humidity_pct`、`.light_lux`；`light.<id>.online`、`.on`、`.motion`；`siren.<id>.online`。摄像头的移动和智能检测来自控制台的事件 websocket，因为 REST 记录中没有这些，所以在它断开期间它们读作坏值，绝不是“没有移动”。每个事件都在该设备名下的日志中。警报器的 `.play` 被设为待命以便写入（`true` 播放，`false` 停止），`alarm.<trigger>.fire` 也是如此，它为人在 Protect 中创建的触发器 id 发送报警管理器的 webhook，所以写入它的 HotLoop 报警会让摄像头录像。摄像头的快照是 `GET /api/unifi-protect/<device>/cameras/<camera>/snapshot`，在被请求时获取的 JPEG。根据 Ubiquiti 针对 Protect 7.4.102 的 OpenAPI 文档构建；尚未针对控制台运行。参见 [UniFi Network](/zh-hans/iot/unifi/#unifi-protect)。

### UniFi Access

Access 控制台的门，通过端口 12445 上的 Access 开发者 API，使用其高级设置中的 API 令牌（`{"token":"..."}`，已封存）。用协议 `unifi-access` 和控制台地址添加设备。每扇门有 `door.<id>.open`（位置传感器；没有传感器的门读作坏值，绝不是已关闭）、`door.<id>.unlocked`（锁继电器），以及 `door.<id>.unlock`，它由人设为待命，写入 `true` 时会开锁，经过写入关口，并像任何写入一样被审计；控制台会按自己的规则再次锁上。通知 websocket 在两次轮询之间让位置和锁保持最新，每次变化（“1F - Front: opened”、“unlocked”）都在该设备名下的日志中。根据维护中的开源客户端（py-unifi-access，MIT）所使用的 API 构建；尚未针对控制台运行。参见 [UniFi Network](/zh-hans/iot/unifi/#unifi-access)。

### SNMP

任何带有 SNMP 代理的东西：交换机、UPS、PDU、电表，以及每台运行 SNMP 代理的 Linux 设备。只读。HotLoop 从不发送 SNMP SET，因为 SET 可能改变交换机的配置，而这个驱动的目的是看到工厂网络，而不是去运行它。

```
1.3.6.1.2.1.1.5.0             sysName
.1.3.6.1.2.1.1.3.0            sysUpTime, a leading dot is accepted
1.3.6.1.2.1.2.2.1.8.2         ifOperStatus of the interface with ifIndex 2
```

变量的地址是一个实例的 OID，即以点分隔的数字。标量以 `.0` 结尾；表格单元以其行的索引结尾。变量的 `dataType` 决定它变成什么：

* 代理发送的数字(Integer、Gauge32、Counter32、Counter64、TimeTicks)就是那个数字。缩放和偏移的应用方式与其他地方相同。
* OCTET STRING 是文本，除非变量是数字，那时会对它进行解析。平均负载(`laLoad` 是文本 `0.15`)或代理背后的温度就是这样到达的。不是数字的文本是说明这一点的 bad 读数，绝不是零。
* 不可打印的 OCTET STRING(MAC 地址)是 `0x` 加十六进制。

**计数器是原始值。**Counter32 或 Counter64 只增不减，并且会回绕。变量保存代理所发送的内容，速率由读取该变量的一方去算。Counter64 以 float 保存，精确到 2^53;满线速的端口要几十年才能到达那里。

**TimeTicks 的单位是百分之一秒**，所以把 `sysUpTime` 当作普通变量读取时，单位是 1/100 秒。集成会替你把它换算成秒；手工创建的变量应把 `scale` 设为 `0.01`。

**代理没有的对象是带原因的 bad 读数**，同一请求中的其他对象仍会被读取：v2c 和 v3 会说明缺少哪些，而对 v1(它用整个请求的错误来回应缺失的对象)，驱动会把那一个去掉，再为其余的重新请求。对代理来说太大的应答会被对半拆分后重新请求。

设备选项(`config`):

| 选项 | 含义 |
|---|---|
| `version` | `1`、`2c` 或 `3`。默认 `2c` |
| `community` | v1 和 v2c 的团体字符串。这两个版本必须设置，而且**没有默认值**:`public` 就是工厂的交换机被任何人随便读取的原因。机密 |
| `username` | v3 用户 |
| `securityLevel` | `noAuthNoPriv`、`authNoPriv` 或 `authPriv`。默认：有隐私口令时为 `authPriv`，只有认证口令时为 `authNoPriv`，否则为 `noAuthNoPriv` |
| `authProtocol` | `MD5`、`SHA`、`SHA224`、`SHA256`、`SHA384` 或 `SHA512`。默认 `SHA` |
| `authPassword` | 认证口令。机密 |
| `privProtocol` | `DES`、`AES`、`AES192`、`AES256`、`AES192C` 或 `AES256C`。默认 `AES` |
| `privPassword` | 隐私口令。机密 |
| `contextName` | v3 的上下文。几乎总是留空 |
| `transport` | `udp`(默认)或 `tcp` |
| `retries` | 没有应答的请求重新发送的次数，0 到 10。默认 1 |
| `maxRepetitions` | 遍历(walk)时每个 GETBULK 的行数。默认 10，最小的代理也能应答 |
| `browseRoots` | 发现点时要遍历的 OID。默认：system、接口表、主机资源、负载表以及 SNMP 代理的 extend 输出 |
| `browseMaxNodes` | 浏览停止的位置。默认 2000 |

地址是 `host` 或 `host:port`，端口默认 161。

**错误的团体字符串不会有任何应答。**SNMPv1 或 v2c 代理会丢弃带有它不认识的团体字符串的请求，所以错误的团体字符串、错误的端口、防火墙和已关闭的代理看上去都像超时，HotLoop 的消息会把这四种都列出来。SNMPv3 则能区分它们：错误的口令或未知的用户会被如实拒绝(`ErrAuthRejected`),HotLoop 会等很长时间才会再次尝试同样的凭据。

`Browse` 遍历 HotLoop 能说出名称的子树，并给每个对象命名：使用 MIB 的名称，如 `sysName`、`ifOperStatus.2`、`ifHCInOctets.2`、`laLoad.1`，对于不认识的对象则是形如 `oid.1.3.6.1...` 的 OID。这些名称以及其背后的 OID、类型和单位，来自定义它们的 MIB:SNMPv2-MIB(RFC 3418)、IF-MIB(RFC 2863)、HOST-RESOURCES-MIB(RFC 2790)，以及 SNMP 代理的 UCD-SNMP-MIB 和 NET-SNMP-EXTEND-MIB。代理拥有的其他一切仍可读取；按 OID 把它添加为变量即可。

集成(参见[集成](/zh-hans/iot/integrations/#snmp))会替你完成询问。

### BACnet/IP

楼宇自动化控制器、电表、温控器：IP 网络上任何使用 BACnet 的设备。只读。HotLoop 从不写入 BACnet 属性，因为写入会通过优先级数组落到可命令的输出上，而一个遗留下来的优先级会让设备停在被设定的状态，哪怕设定的人早已回家。这是一项需要有意设计的功能，不是可以随手丢在那里的东西。

它与从真实设备录制的帧相符，由始终运行的测试解码，并在测试中与该设备相符。

```
analog-input:1                present value of analog input 1
ai:1                          the same, abbreviated
av:3.units                    a property other than the present value, by name
analog-input:1.117            or by number
multi-state-value:2           present value of a multi-state value
```

变量的地址是对象，即 `<type>:<instance>`，当它不是当前值(present value)时，再加一个点和一个属性。类型可用名称或缩写：`analog-input`(`ai`)、`analog-output`(`ao`)、`analog-value`(`av`)、`binary-input`(`bi`)、`binary-output`(`bo`)、`binary-value`(`bv`)、`multi-state-input`(`msi`)、`multi-state-output`(`mso`)、`multi-state-value`(`msv`)、`accumulator`(`acc`)、`integer-value`(`iv`)、`positive-integer-value`(`piv`)、`large-analog-value`(`lav`)和 `characterstring-value`(`csv`)。按名称给出的属性有 `present-value`、`object-name`、`description`、`units`、`status-flags`、`out-of-service`、`reliability`、`number-of-states`、`state-text`、`object-type`、`object-identifier`、`object-list`、`vendor-name`、`vendor-identifier`、`model-name`、`firmware-revision` 和 `application-software-version`;其他任何属性用它的编号。

变量变成什么取决于它的 `dataType`:设备发送的数字(real、double、unsigned、signed、enumerated、boolean)就是那个数字，二进制对象的 `active` 是 1,`inactive` 是 0;字符串是文本，如果变量是数字且文本是数字，则为数字；`null` 的当前值是说明设备没有可报告内容的 bad 读数。包含多个值的属性(对象列表)不能作为变量。

**状态标志是读数的一部分。**每次轮询都会在请求对象当前值的同一个请求中请求其状态标志，设置了 **fault** 标志的对象读为 **bad** 并带有原因。**out of service** 或 **overridden** 的对象读为 **uncertain**:其当前值是人或程序放进去的，而不是测量值，趋势图和报表会像对待 bad 一样省略 uncertain 的读数(质量规则)。仅有 **In alarm** 是对处于报警中的点的良好读数。

**设备没有的内容是带原因的 bad 读数，其余仍会被读取。**ReadPropertyMultiple 对每个属性分别应答，所以一个不存在的对象(`unknown-object`)或它没有的属性(`unknown-property`)只会让那个变量失败，不影响其他变量。拒绝 ReadPropertyMultiple 的设备此后改为一次读取一个属性。

**不进行分段。**客户端告知设备它不能接收分段应答。应答放不进一帧的设备会中止(`segmentation-not-supported`),HotLoop 随后每次请求的对象数减半；对象列表太大无法一次发完的设备则一次读取一个元素。

设备选项(`config`):

| 选项 | 含义 |
|---|---|
| `deviceInstance` | 此地址上的设备应有的实例号。设置之后，如果设备给出另一个编号，连接会被拒绝：在被复用的地址上应答的是另一台设备，或者控制器被更换了，工厂就是这样得到看似干净却错误的数字的 |
| `localAddress` | 用于发送的本机网卡地址，适用于有多块网卡的主机。通常留空 |
| `retries` | 没有应答的请求重新发送的次数，0 到 10。默认 1 |
| `browseMaxObjects` | 浏览停止的位置。默认 1000 |

地址是 `host` 或 `host:port`，端口默认 47808。BACnet/IP 中没有任何凭据，所以也没有需要隐藏的东西。

**连接时会询问设备它是谁。**HotLoop 向设备发送单播 Who-Is，并从 I-Am 中取得设备的实例号。对不回应它的设备，会用通配实例(4194303)询问它自己的设备对象，标准规定设备会以自己的身份应答。两者都不应答的设备会被报告为两种都试过，因为常见原因看起来都一样：地址或端口错误、防火墙、设备已关闭，或设备位于路由器后面的网络上。

**未实现路由。**HotLoop 与它能向其发送 UDP 数据报的设备通信。位于 BACnet 路由器后面 MS/TP 干线上的控制器，或位于另一个 BACnet 网络上的控制器，无法访问，只有 BBMD 才能到达的设备(foreign device registration)也一样。请寻址路由器自己的 BACnet/IP 一侧，或在前面放一个网关：参见[网关模式](#其他一切网关模式)。

`Browse` 读取设备自己的对象(其名称、厂商、型号和固件)、其对象列表，以及 HotLoop 所读取的每个对象：名称、描述、单位、当前值和状态标志，以及多状态对象的状态文本。变量以对象自己的名称命名，当两个对象同名时再加上地址。单位会变成标签，并且在有对应含义时变成实体类别：摄氏度是 `°C` 和 `temperature`，相对湿度百分比是 `%` 和 `humidity`，千瓦时是 `kWh` 和 `energy`。HotLoop 没有标签的单位保持无标签，并在描述中以其编号标明。这些单位的编号和名称与真实设备相符，设备发送的是它自己的表为每个名称给出的编号。集成(参见[集成](/zh-hans/iot/integrations/#bacnetip))会替你完成询问。

## 向外发送：Kafka API

以上所有内容都是把设备的值引入。HotLoop 也可以把它们作为事件流发送到 Kafka 代理：历史数据库保存的每个读数，以及系统日志的每一行(报警、设备上线和离线、变更)，以 JSON 形式发到你指定的主题上。它是一种历史数据库目标，在设置的历史数据库目标中配置，支持 Apache Kafka、Redpanda 以及任何使用 Kafka API 的系统，支持 TLS 和 SASL 登录。记录格式、这里的"at least once"是什么意思，以及哪些已证明、哪些没有，见[历史数据库目标](/zh-hans/iot/historian-targets/#kafka-api事件流)。客户端是 [franz-go](https://github.com/twmb/franz-go)。

## 其他一切：网关模式

**PROFINET · EtherCAT · HART · DNP3 · FINS · MELSEC/SLMP · CANopen · FANUC FOCAS**

这些协议不是原生支持的，也没有驱动。这是有意的选择，而不是等着用桩代码填补的缺口。

运行这些协议的现场几乎总是已经有一个把数据重新发布到 OPC UA 或 Modbus 的网关：带 OPC UA 服务器的 PROFINET IO 控制器，带 Modbus 映射的 HART 多路复用器。让设备指向那个端点，并把它配置为 OPC UA 或 Modbus。

再写八个驱动，每个都重复现场已有网关所做的事，只会多出八个容易出细微错误的东西，而且这些协议的设备又是最难测试的。如果某个现场确实没有网关，又需要其中某一种的原生支持，那是一项需要排期的真正工作，而不是添加一个日志写着"not implemented"的文件。

**这个代码树中没有占位驱动。**一个协议要么有可工作的实现，要么就在本节中。有一个测试强制要求模型声明的每个协议都有编译进来的驱动，反之亦然。

## 设备凭据

设备的 `config` 和 `address` 是驱动找到其登录所用信息的地方。以下是每个协议读取的凭据，所有这些通过 API 都是只写的(4.15.1):它们对每个角色都显示为 `[redacted]`，发送占位符或省略该键的保存会保留已存的值，新字符串会替换它。规则以及不经过 API 的内容见[认证与用户](/zh-hans/iot/authentication/#设备凭据只写不读)。

| 协议 | 配置中的凭据 | 地址中的凭据 |
|---|---|---|
| OPC UA | `password`(配合 `username`) | 无：地址中的用户信息被隐藏，驱动会忽略它 |
| MQTT / Sparkplug B | `password`(配合 `username`) | `mqtt://user:pass@host`，客户端会使用它 |
| HTTP / REST | `password`(配合 `username`，以基本认证发送);`headers` 中除 `Accept` 和 `Content-Type` 等普通值之外的每个值，API 密钥或 `Authorization` 头就放在这里；`body` 和 `writeBody`(如果提到了凭据) | 地址和 `writeUrl` 中的 `http://user:pass@host` 以及 `?api_key=` 这类查询值 |
| MTConnect | `password`(配合 `username`);`headers` 中的每个值，例外相同 | `http://user:pass@host` 和查询值 |
| UniFi Network | `password`(配合 `username`)。只以加密形式保存：没有密钥(见下文)就无法保存设备 | 无：地址是控制台的 `https://` URL |
| BACnet/IP | 无 | 无：地址是 `host` 或 `host:port` |
| CODESYS | `password`(配合 `username`)，与 OPC UA 相同 | 无：地址中的用户信息被隐藏，驱动会忽略它 |
| SNMP | `community`(v1、v2c);`authPassword` 和 `privPassword`(v3)，配合 `username` | 无：地址是 `host` 或 `host:port` |
| Modbus、S7comm、EtherNet/IP | 无 | 无：地址中的用户信息被隐藏，驱动会忽略它 |

**静态加密。**设置了 `HOTLOOP_SECRET_KEY_FILE`(chart 会设置它，并使用它自己生成的密钥)之后，上表配置列中的每个凭据都会在数据库中用该密钥加密，该密钥存放在数据库之外，所以转储文件或备份里只有密文。HotLoop 的其余部分和驱动完全察觉不到差别。写在 URL(`mqtt://user:pass@host`、`?api_key=`)或自由文本(如 HTTP 的 `body`)中的凭据同样会被加密：整个地址或选项被封存，并按输入时的原样返回，不含机密的 URL 则保持可读。放置凭据时，`password` 选项仍是更整洁的地方。参见[备份与恢复](/zh-hans/iot/backup/#设备凭据与密钥)。

任何名称看起来像凭据的其他选项(包含 `password`、`token`、`secret`、`apikey`、`authorization`、`private`、`passphrase`，或以 `key` 结尾，或含有 `pass`、`pw`、`auth`、`cred`、`sig` 等完整词语，以及其他情形)，无论属于哪个协议，也同样被隐藏，所以以后添加到某个驱动中的选项，在有人决定它不该被隐藏之前都会被隐藏。有一个测试会遍历每个驱动的选项，在每个选项都出现在凭据列表或已知不是凭据的选项列表之前，测试都会失败。完整规则参见[认证与用户](/zh-hans/iot/authentication/#设备凭据只写不读)。

## 添加设备

1. **Devices → Add device。**选择协议，给它一个地址。
2. 在协议支持的地方使用 **Discover tags**:OPC UA、EtherNet/IP、MTConnect、MQTT(Sparkplug birth 之后)、HTTP、SNMP、BACnet/IP、CODESYS。Modbus 和 S7comm 无法枚举自己的点，所以请根据设备文档来声明它们。
3. 导入的变量以**只读**方式创建。设备碰巧暴露出来的点，并不是有人决定可以对其下命令的点。请有意地、逐个把变量标记为可写。
4. 对原始计数设置 `scale` 和 `offset`:`engineering = raw × scale + offset`。如果仪表在通道失效或超量程时发送一个代码，请把它列在[无数据值](#无数据值)下，让它读为 bad，而不是一个数字。
5. 对任何有噪声的变量设置 `deadband`。它会抑制对小到无关紧要的变化的历史数据库写入；没有它，最低位抖动的 12 位传感器会永远在每次扫描时写入一行。

## 无数据值

热电偶烧断的记录仪不会安静下来。它继续应答，而它放进寄存器里的是一个代码："undefined"为 0x8005,"over range"为 0x7FFF。按缩放 0.1 的 int16 读取，0x8005 是 -3276.3 度，在我们修复这个问题之前，它以 **good** 质量返回，作为真实温度进入历史数据库，留在那里让报警去判断。失效的传感器看上去像一个冷的传感器。

所以变量可以列出表示"没有测量值"的原始值。每一个都有原因。当读数的原始值在列表中时，读数为 **bad**，原因附在上面，缩放和偏移绝不会碰它。

```json
{
  "deviceId": "dx-1", "name": "ch01", "address": "input:1:int16",
  "dataType": "float", "unit": "C", "scale": 0.1, "enabled": true,
  "noData": [
    {"raw": "0x7FFF", "reason": "+over"},
    {"raw": "0x8001", "reason": "-over"},
    {"raw": "0x8002", "reason": "skip"},
    {"raw": "0x8004", "reason": "error"},
    {"raw": "0x8005", "reason": "undefined"},
    {"raw": "0x7F7F", "reason": "power fail"},
    {"raw": "0x7FFA", "reason": "burnout up"},
    {"raw": "0x8006", "reason": "burnout down"}
  ]
}
```

这八个是 Yokogawa DX 系列的代码，出自 DX 通信手册(IM 04L41B01-17E，第 4.3 节，第 4-35 页)。它们并不是 HotLoop 特有的：这是每个协议的每个变量上同一个字段，DX 列表只是最先让我们栽跟头的那个。每个代码都在变量上，所以一个在其他单位下确实可能读到 0x7F7F 的记录仪通道，会把它当作读数保留。

| 字段 | <span class="sr-only">详情</span> |
|---|---|
| `raw` | 设备的代码，按其手册印的写法书写：`"0x8005"`(十六进制)、`"-32763"` 或 `32773`(十进制)。字符串或裸数字。必填 |
| `reason` | 读数的质量所说明的内容。最多 120 个字符。省略时读为 `raw value 0x8005 means no measurement`，所以读数绝不会在不说明原因的情况下变成 bad |

在变量编辑器中，它是 **无数据值** 框：每行一个代码，代码、一个空格、原因。

### 该写哪个数

对于基于寄存器的 Modbus 点，代码是设备所持有的整数，是在应用了该点的字节顺序和字顺序之后的值。它与该点解码出的数字相同，所以手册说"仪表返回 8005h"时，在这里就恰好是 `"0x8005"`。

- **int16 和其他有符号类型。**`0x8005` 和 `-32763` 是同一个寄存器，`32773` 也是。写手册怎么写就怎么写；三种都匹配。不适合该类型的代码(int16 上的 `0x10000`)会在设备连接时被拒绝，因为一个永远无法匹配的列表比一个错误更糟。同一变量上同一个值的两种写法也会被拒绝。
- **uint16 和其他无符号类型。**从 `0` 到该类型的最大值。负数会被拒绝。
- **int32、uint32、int64、uint64。**32 位和 64 位适用同样的规则。`CDAB` 字顺序的 int32 上的 `0x7FFFFFFF` 是把各字摆正之后的值，而不是它们从线路上来的顺序。
- **float32 和 float64。**代码是寄存器的位模式，所以必须是十六进制：安静 NaN 为 `0x7FC00000`。十进制会被拒绝，因为 32773 作为 float 和 32773 作为位模式是两回事，而我们不会去猜。
- **位、线圈、离散输入和字符串。**没有可比较的原始数字，所以在它们上设置 `noData` 会在设备连接时被拒绝。

检查针对的是原始位，在解码、缩放和偏移之前。

### 其他协议

每个交付已解码数字的驱动都检查同一个列表：S7comm、EtherNet/IP、OPC UA、HTTP 和 MQTT(包括被发现的设备)。它们比较的是那个已解码的数字，按整数比较，所以请按它本来的数字来写。一个保存 0x8005 的 S7 INT 是 -32763，所以写 `-32763`。这里的十六进制只是写同一个数的另一种方式，因为已解码的数字已丢失宽度，无法按位模式读回。带小数的值绝不会匹配。只有设备发送这类代码的地方才值得设置这个列表；MTConnect 和 UniFi 所报告的大部分内容从不这样。

### 哨兵值的作用

- **质量**为 `bad`，读数带有原因。它显示在 `GET /api/values` 和实时流(`reason`)中，显示在变量界面质量旁边，以及变量的实体上的 `quality_reason` 属性中。
- **值**为空，不是零，也不是缩放后的代码。不应用缩放和偏移。
- **历史数据库**把质量记录为 bad，与任何其他 bad 读数一样，其值列中没有任何有意义的内容。没有良好读数的时间桶在趋势图上显示为空缺，与任何 bad 读数一样。
- **报警。**bad 读数绝不会触发值报警：高、低、等于、变化率都保持之前的状态，与任何 bad 读数一样。变量上的 `bad-quality` 报警会触发，其默认消息带有原因(`dx-1/ch01 bad-quality: undefined`)。在你自己的消息中使用 `{reason}` 来放入它。
- **日志簿**记录变量的实体变为 bad，原因是该实体的 `quality_reason` 属性。

### 位置

在变量上，随变量一起保存。通过 API，它是 `POST /api/tags` 上的 `noData` 列表(参见 [HTTP API](/zh-hans/iot/api/#post-apitags))，在编辑器中是上面的那个框，在 Edge Relay 中是设备文件的变量中的同一段 JSON(参见 [Edge Relay 参考](/zh-hans/edge-relay/reference/))。保存变量会重新加载正在运行的设备，所以改动在下一次轮询时生效，无需手动重启任何东西。重新发现不会动变量的列表。

## 质量

每个读数都带有 `good`、`uncertain` 或 `bad`。

**Bad 的意思是值未知。它不表示零。**无法读取某个点的驱动仍会产生一个读数，并标记为 bad，因为沉默与没有变化的值无法区分，在趋势图上，"传感器读数为 0"与"传感器不再应答"的区别，就是过程问题与仪表问题的区别。

报警评估在遇到 bad 读数时保持其之前的状态，而不是对它进行评估。否则，一个失效归零的传感器会触发该单元上的每一个低报警，看起来像是一个过程事件。
