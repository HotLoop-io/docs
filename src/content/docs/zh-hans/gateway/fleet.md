---
title: "设备群管理"
description: "通过 Sparkplug 的出生与死亡消息跟踪每个 Edge Relay，无需跑到现场，就能发送 rebirth、重启或新的设备文件。"
---

设备群管理自 4.7.0 起，让 Gateway 跟踪已注册的边缘中继，了解它们是否在线，并让获得授权的操作员请求某个中继执行 rebirth、重启或采用刚推送的配置。默认关闭（`HOTLOOP_FLEET_ENABLED`）：没有边缘中继的部署没有可指向的代理。

## 它不是什么

设备群管理有自己独立的 MQTT 连接，回答的是另一个问题：某个*已注册*的边缘中继是否在线，而不是它的某个变量是什么值。把它挂到轮询变量的驱动上，要么得逼操作员仅为了看到设备群而配置一个兼容的设备，要么得去碰那个包里按节点记录的私有账目，而那从来不是为共享设计的。

**不是自动的。** 边缘中继出现在代理上并不会让它成为设备群成员。成员身份需要声明，即通过 `POST /api/fleet` 创建的 `fleet_members` 中的一行，这与本应用已经在驱动发现的变量和人工配置的变量之间所做的区分相同。来自无人注册的组或节点的 NBIRTH 会以 debug 级别记录，其余忽略。

## 各部分如何配合

- **在线状态**，来自 NBIRTH 和 NDEATH。从中继一侧看只有出站：它拨向代理，和平时发布读数一样，所以能穿过 NAT，不需要任何到中继的入站连接。

命令沿相反方向通过 Sparkplug NCMD 传送，扩展中继本来就处理的内容：

- 一个无害、重复执行结果相同的轻推。
- **重启**（`Node Control/Reboot`，Sparkplug 规范自己的名称，不是本应用发明的）：中继发布自己的正常 NDEATH 然后退出；它的守护者（Quadlet 单元的 `Restart=always`，或 Deployment 默认的 `restartPolicy: Always`）用那一刻磁盘上的内容把它重新拉起。没有新的关闭路径：这与中继在收到 `SIGTERM` 时已经走的干净退出路径完全一样。

因为命令走的是中继本来就向外拨出的同一条 MQTT 连接，发送命令同样不需要到中继的入站连接。

显示在线的中继一定可以下达命令。每个中继在每次连接时，都会先订阅自己的 NCMD 主题并等代理确认，然后才发布出生消息，所以“在线”绝不会先于“可达”。管理器在自己一侧遵守同样的规则：在 NBIRTH 和 NDEATH 的订阅确认之前，它不会报告自己已启动，所以在 Gateway 刚启动的瞬间出生的中继不会被漏掉。如果代理的 ACL 拒绝任何一侧的订阅，那一侧会拒绝启动并说明原因，而不是半聋地运行。

## 推送配置

推送中继所轮询的内容不走 NCMD，因为 Sparkplug 指标的大小装不下整个设备文件，它会发往每个中继专属的**保留、普通 MQTT 主题**：`hotloop/edge-relay-config/<group>/<node>`。保留消息的投递让这件事无需另行发出“帮我赶上进度”的请求：最后发布到那里的内容会立即交给任何订阅的客户端，包括离线后重新连接的中继，或第一次启动的中继。

中继在收到时会再次校验：本应用不能假定只有 Gateway 会发布到该主题，只能保证自己不发布有问题的内容。

**设备文件可能带有凭据，推送会把它发布出去。** 设备的 `config` 块包含其驱动登录所用的信息，例如 OPC UA 的 `username` 和 `password`（4.15.0），文件会原样以保留消息发布。任何能订阅 `hotloop/edge-relay-config/#` 的人都能读取，所以在推送带凭据的文件之前，代理需要对该主题启用 TLS 和 ACL。自 4.15.1 起，Gateway 的 API 对所有角色隐藏设备凭据，但推送的文件不在 API 之后，也不受此影响。参见 [Edge Relay 参考](/zh-hans/edge-relay/reference/#credentials-in-the-device-file-4150)和[认证与用户](/zh-hans/iot/authentication/#where-credentials-are-still-in-the-clear)。

**推送即时生效，而且绝不重启任何东西。** 到 4.17 为止，推送只是把文件备好，要让它生效还得再做一次操作，即 `POST /api/fleet/{id}/restart`，为了改一个变量，它会断开中继与代理的会话以及它持有的每个设备会话。现在：

- **正在运行的中继**会校验文件、保存并就地应用：新设备连接，被移除的设备断开，被改动的设备重连，没有变化的设备保持会话。Sparkplug 会话和转发队列全程保持。节点用新的指标集执行 rebirth，并先把去掉的指标置空，这样主机就不会继续显示已移除设备的最后一个良好值。[Edge Relay 参考](/zh-hans/edge-relay/reference/#what-a-live-apply-keeps-and-what-it-changes)准确说明了线路上发出什么以及原因。
- **中继拒绝的文件**（无法解析、无法校验、无法保存）不会改变中继上的任何东西，中继的 `/status` 会在 `config.rejected` 下说明。`GET /api/fleet` 会为每个带 `statusUrl` 的成员显示这一点，并列出它正在运行的文件的摘要，所以“我推送了”和“它在运行”是两件可以核对的事，而不是一件想当然的事。Gateway 在发布之前也会校验，所以实际上这是较新或较旧版本的中继对规则看法不一致，或者是 Gateway 之外的东西在向该主题发布。
- **离线的中继**在连接的那一刻就会收到保留的推送。启动时它会先等几秒钟，再加载本地文件，所以它直接以推送的列表启动，而不是先用旧列表再切换。

推送的文件落在中继的数据卷上，而不是覆盖它本地的设备文件，并且在推送被清除之前优先于本地文件。中继的 [Edge Relay 参考](/zh-hans/edge-relay/reference/#where-a-pushed-file-lives-and-which-file-wins)说明了优先级规则，以及促成这些规则的 4.16.0 缺陷。

**撤回推送**用 `DELETE /api/fleet/{id}/config`（`fleet.config`，与推送相同）。它向成员的配置主题发布一条空的保留消息，这是 MQTT 删除保留值的方式，此后的任何启动都不会应用该推送。此刻已连接的中继会丢弃推送的文件，并像应用推送一样即时回到本地文件，除非本地文件无法加载，那时它会保留推送的文件并说明。离线的中继永远收不到清除（空消息不会被保留），所以等中继恢复后请再发送一次。

## 每个中继运行什么，以及更新

每个中继都在每条出生消息里带上自己的版本和镜像摘要，开启了边缘发布的 Edge 或 Gateway 也是如此，所以在这里注册为成员的主机会显示同样的信息（名为 `Node Info/Version` 和 `Node Info/ImageDigest` 的字符串指标，没有别名，不认识它们的 Sparkplug 主机会忽略）。`GET /api/fleet` 把它们显示为每个成员的 `release`：`version`、`imageDigest` 和 `since`，即 Gateway 第一次听到该构建的时间。更早的中继不会报告，Gateway 对此保持沉默，而不是编造一个“未知构建”。

当成员的构建发生变化时，Gateway 会把它作为该成员的 `config` 事件写入系统日志，详情中带有旧版本、新版本和摘要（`{"kind":"fleet.release",...}`）。它听到的第一个构建也会被记录，作为衡量下一个构建的基线。这在 Gateway 重启后依然保留，因为最后一条记录是从日志读回来的：重启绝不会凭空造出一次更新。这是中继接受的每一次更新的审计轨迹，无论通过什么途径（Podman 的定时器、一次批准、`helm upgrade`、现场的某个人），因为 Gateway 不会引发更新，只能报告它。移动的标签是 `:stable` 更新的方式，所以同一版本下摘要变化也会被记录，记为“同一版本的另一个镜像”。

`POST /api/fleet/{id}/update`（`fleet.update`，仅限管理员）批准中继正在扣留的更新。它只对设置为扣留更新的中继有作用；其他中继会记录为已忽略。请求中不指定镜像。针对每种安装类型，它做什么和不做什么，见 [Edge Relay 参考](/zh-hans/edge-relay/reference/#updating-a-relay)。

## 命令授权

两层，刻意不是一层：

- **在 API 上**，操作员需要 `fleet.rebirth` 才能请求 rebirth；重启、批准更新或推送配置分别需要 `fleet.restart`、`fleet.update` 或 `fleet.config`，仅授予管理员。重启对正在运行的轮询周期的干扰比 rebirth 轻推更大，推送中继所轮询的内容也按同样方式对待，与 `alarms.ack` 和 `automations.trigger` 已经为其他“立即执行”操作所体现的收紧一致。
- **在代理上**，本应用无法强制任何东西：NCMD 发布和配置主题都必须通过代理自己的 ACL，限制为 Gateway 自己的 MQTT 凭据。否则，任何能连到代理并知道某个中继的组和节点的人，都能发布与此功能相同的命令或配置。请在部署时配置；它不会因为位于本应用自身的代码之外而变成可选项。

## API

| 路由 | 权限 | <span class="sr-only">详情</span> |
|---|---|---|
| `GET /api/fleet` | `fleet.read` | 每个已注册成员，带实时在线状态，以及在已配置时轮询到的 `/status` |
| `POST /api/fleet` | `fleet.write` | 创建或更新成员（请求体带已有 `id` 即更新） |
| `DELETE /api/fleet/{id}` | `fleet.write` | 移除已注册的成员 |
| `POST /api/fleet/{id}/rebirth` | `fleet.rebirth` | 发布 `Node Control/Rebirth` |
| `POST /api/fleet/{id}/restart` | `fleet.restart` | 发布 `Node Control/Reboot` |
| `POST /api/fleet/{id}/update` | `fleet.update` | 批准中继正在扣留的镜像更新（对没有扣留的中继不起作用） |
| `POST /api/fleet/{id}/config` | `fleet.config` | 推送新的设备文件（原始 JSON 请求体，发布前校验）；运行中的中继即时应用 |
| `DELETE /api/fleet/{id}/config` | `fleet.config` | 清除推送，让中继回到本地设备文件，已连接时即时生效 |

## 配置

| 变量 | 默认值 | <span class="sr-only">详情</span> |
|---|---|---|
| `HOTLOOP_FLEET_ENABLED` | `false` | 设置之前，该功能关闭 |
| `HOTLOOP_FLEET_BROKER` | n/a | 启用时必填。纯主机名、`host:port` 或完整 URL |
| `HOTLOOP_FLEET_USER` / `_PASSWORD` | n/a | 代理凭据 |
| `HOTLOOP_FLEET_TLS` | `false` | |
| `HOTLOOP_FLEET_TLS_SKIP_VERIFY` | `false` | 由各个部署自行选择；绝不要默认开启 |

## 已验证与未验证的内容

HotLoop 已在真实设备和真实服务器上运行，并于 2026-11-17 在真实硬件上运行过。
