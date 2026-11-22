---
title: "内置 MQTT broker"
description: "与主程序在同一进程中的 broker，一台小设备就能是完整安装，包括监听器、账户和启用它的设置。"
---

HotLoop 从 4.11.0 起可以在进程内运行自己的 MQTT broker，所以单台设备上的小型 HotLoop 安装不需要再部署任何额外的东西。默认关闭（`HOTLOOP_BROKER_ENABLED`）：已经运行 Mosquitto 或 EMQX 的部署没有地方可以指向它，而在已有的 broker 旁边再启动第二个 broker，并不是可以随意假定的安全默认值。

## 为什么有它

边缘发布（Gateway 作为 Sparkplug 边缘节点）和机群管理（跟踪已注册的边缘中继）都通过 `BrokerAddress` *向外*连接到 MQTT broker，它们自己从来没有运行过 broker。当部署已经有 broker 时，这没有问题，无论那是已有的 Mosquitto 实例，还是因其他原因与 HotLoop 并行运行的实例。但把它作为*唯一*的选择就不行：这个项目的目的是减少工厂所依赖的运动部件数量，而仅仅为了给一个 Gateway 提供 Sparkplug 枢纽就要求再增加一套基础设施，等于从后门又把一个运动部件加了回来。

设置 `HOTLOOP_BROKER_ENABLED=true` 后，同一个进程会在自己的地址上监听 MQTT 连接。边缘发布、机群管理，或外部边缘中继的 `HOTLOOP_EDGE_PUBLISH_BROKER`，都可以指向 `localhost:1883`（在集群内，则是 Gateway 自己的 Service 地址）。

## 什么时候用，什么时候不用

**适合用**：一个 Gateway、少量边缘中继，以及与历史库、报警引擎和 HTTP API 共用进程的内置 broker 能轻松承受的流量，这正是整个项目所针对的常见情形：一个工厂，一台设备，最少的基础设施。

**不要用**：不要把它当作真实规模下生产级 broker 的替代品：多个独立的 Sparkplug 主机应用、很高的扇出、站点之间的桥接，或需要集群、水平扩展或 broker 自身专用运维工具（详细指标、动态 ACL、插件生态）的负载，都是运行 Mosquitto、EMQX 或其他专用 broker 的正当理由，并像其他任何部署已经能做到的那样，把 Gateway 自己的 `EdgePublishConfig`/`FleetConfig` 指向它。这个软件包不与那种用法竞争；它是为那些原本根本没有 broker 的部署而存在的。

## 登录，以及每种登录能碰什么

有三种登录可以接入，它们并不相同。

**在 HotLoop 中创建的登录**（Settings、MQTT，或 [HTTP API](/zh-hans/iot/api/) 中的 `/api/broker/logins`）带有规则：该登录可以发布的主题和可以订阅的主题。规则中的 `%u` 是登录自己的名称，`%p` 是发现前缀。它们从一个配置文件开始，之后可以由您编辑：

| 配置文件 | 发布 | 订阅 | 适用于 |
|---|---|---|---|
| `shelly` | `%u/#`, `shellies/announce` | `%u/#`, `shellies/command`, `%p/status` | Shelly Gen2 或更新的型号，登录名按其 MQTT 主题前缀命名 |
| `esphome` | `%u/#`, `%p/+/%u/+/config`, `esphome/discover/%u` | `%u/#`, `%p/status`, `esphome/discover` | ESPHome 节点，登录名按节点命名 |
| `tasmota` | `tele/%u/#`, `stat/%u/#`, `tasmota/discovery/+/config`, `tasmota/discovery/+/sensors` | `cmnd/%u/#`, `cmnd/tasmotas/#` | Tasmota 设备，登录名按其主题命名 |
| `zigbee2mqtt` | `%u/#`, `%p/#` | `%u/#`, `%p/status` | Zigbee2MQTT 桥接，登录名按其基础主题命名 |
| `integration` | 无 | `#` | 仪表板、历史库，或使用 MQTT Explorer 的您 |
| `full` | `#` | `#` | 任何用途，整个工厂 |

把 Shelly 的登录按其主题前缀命名，它就能宣告自己并以自己的身份上报，仅此而已。它不能发布到 `cmnd/boiler/POWER`，不能以别人的名义宣告设备，也不能订阅 `#` 来读取整个工厂。broker 会检查每一次发布、每一次订阅，以及发往订阅者途中的每一条消息，所以规则无法被巧妙的通配符撑大。遗嘱（last will）也会在客户端连接时被检查：broker 库发布遗嘱时不会询问任何人，所以遗嘱指向其无权发布之处的登录无法接入。否则，一个廉价的插座可能会在锅炉上留下一条保留的 `ON`，然后自己拔掉电源线。

对登录的更改从该客户端的下一个数据包起生效。收窄一个登录，它已连接的设备会立即失去这些主题；删除一个登录，仍挂着的客户端什么也做不了，也无法再次连接。密码是 `broker_logins` 中的 bcrypt 哈希，而它包含在每一份备份中；API 绝不会返回其中任何一个。

Zigbee2MQTT 是特例：一个桥接会宣告其无线电上的每个设备，所以它的配置文件可以在前缀之下任意发布。这是桥接的职责，也是 Discovered 屏幕显示谁宣告了什么的原因。

**`HOTLOOP_BROKER_USERS`** 是 `user:password` 对的旧列表（只有第一个冒号起分隔作用，所以密码可以包含冒号）。它们可以在所有主题上做任何事，与 4.16 和 4.17 完全一样。这是有意的：没有人会升级到这样的工厂，其 Sparkplug 流量突然被一条自己从未写过的 ACL 挡回。这也意味着这些登录中的每一个都是通往整个工厂的钥匙。请把设备迁移到在 HotLoop 中创建的登录，把环境变量中的登录留给真正需要全部权限的对象：机群、边缘中继、边缘发布者。以恒定时间检查；用户名对而密码错的会被拒绝。

**匿名**（`HOTLOOP_BROKER_ALLOW_ANONYMOUS`，默认 `false`）对任何能访问该端口的人开放一切。它是按部署选择启用的，用于可信的 LAN 或试验台，绝不是这个进程自己认定没问题的东西，并且在开启期间 Discovered 屏幕会用红色说明。对于确实发送了用户名的客户端，它不会放宽任何限制：错误的密码仍然是错误的密码。

没有 `HOTLOOP_BROKER_USERS` 且关闭匿名的 broker 也能正常启动。在有人于 HotLoop 中创建登录之前，唯一能连接的就是 HotLoop 自己。

其他 broker 各管各的。在 Mosquitto 或 EMQX 上，ACL 由那个 broker 执行，这与[机群管理](/zh-hans/gateway/fleet/)划定的边界相同，[MQTT 发现](/zh-hans/iot/mqtt-discovery/)中有一条用于 HotLoop 自己登录的 ACL。

## 发现，以及 HotLoop 自己的登录

broker 开启后，HotLoop 会在其上监听自我宣告的设备（参见 [MQTT 发现](/zh-hans/iot/mqtt-discovery/)）。broker 会记录是哪个登录和哪个客户端发布了每条发现配置。Discovered 屏幕会显示它，而从一个登录接受的设备如果被另一个登录宣告，就会被扣留，交给人处理，并在日志中给出警告（"Kitchen re-announced by login garage-node; it was accepted from kitchen-node"）。要么是有人把设备迁移到了新的登录，要么是某个登录在冒充一个并非它自己的设备。由人来决定是哪种。

HotLoop 在该 broker 上自己的客户端（发现监听器，以及已发现设备的驱动）使用 broker 在每次启动时创建、并只保存在内存中的登录来登录。它可以做任何事。不需要为它配置任何东西，磁盘上没有，备份中也没有；每次重启之后它都不同。

## TLS

broker 启用后，明文 TCP 监听器（`HOTLOOP_BROKER_LISTEN_ADDR`，默认 `:1883`）始终可用。设置 `HOTLOOP_BROKER_TLS_ENABLED=true` 并提供 `HOTLOOP_BROKER_TLS_CERT_FILE` 和 `HOTLOOP_BROKER_TLS_KEY_FILE`，会增加第二个独立的监听器（`HOTLOOP_BROKER_TLS_LISTEN_ADDR`，默认 `:8883`），用该证书终结。启用 TLS 时两个监听器同时运行，没有任何东西会关闭明文的那个，所以想只允许 TLS 访问的运维人员要在网络层落实（NetworkPolicy、防火墙规则），就像这个 chart 已经把更宽泛的网络暴露决定交给 `networkPolicy.ingress`，而不是让应用自己决定它的哪些端口可以被访问。

与 SMTP 通道在单个连接内的 STARTTLS 升级不同，broker 的 TLS 监听器是第二个独立的套接字，与 Mosquitto、EMQX 和大多数 MQTT broker 把明文端口与 TLS 端口并列使用的形式相同，也更适合 MQTT，因为（与 SMTP 不同）MQTT 没有广泛实现的连接内升级。

这个软件包不会生成自己的证书，无论是自签名的还是其他，因为下游没有哪个组件会信任它自己编造的证书，所以真实的证书（来自内部 CA、`cert-manager` 或其他来源）始终由运维人员提供。

## 配置

| 变量 | 默认值 | <span class="sr-only">Details</span> |
|---|---|---|
| `HOTLOOP_BROKER_ENABLED` | `false` | 在设置它之前，该功能处于关闭状态 |
| `HOTLOOP_BROKER_LISTEN_ADDR` | `:1883` | 明文 TCP 监听器 |
| `HOTLOOP_BROKER_TLS_ENABLED` | `false` | 增加第二个独立的 TLS 监听器 |
| `HOTLOOP_BROKER_TLS_LISTEN_ADDR` | `:8883` | 仅在启用 TLS 时使用 |
| `HOTLOOP_BROKER_TLS_CERT_FILE` / `_KEY_FILE` | n/a | 启用 TLS 时必填 |
| `HOTLOOP_BROKER_ALLOW_ANONYMOUS` | `false` | 按部署选择启用；切勿默认设置 |
| `HOTLOOP_BROKER_USERS` | 无 | `user:password,user2:password2`。每一个都可以做任何事；见上文。带规则的登录在 HotLoop 中创建 |
| `HOTLOOP_BROKER_DISCOVERY` | `true` | 监听自我宣告的设备；参见 [MQTT 发现](/zh-hans/iot/mqtt-discovery/) |
| `HOTLOOP_BROKER_DISCOVERY_PREFIX` | `homeassistant` | 宣告所使用的主题前缀 |

## 哪些已验证，哪些没有

HotLoop 已经在真实设备和真实服务器上运行过，并于 2026-11-17 在真实硬件上运行过。
