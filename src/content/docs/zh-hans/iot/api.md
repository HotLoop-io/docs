---
title: "HTTP API 接口"
description: "HotLoop 通过 HTTP 响应的每个调用,它需要什么、接受什么、返回什么。Web 界面只使用这些调用,不使用其他任何接口。"
---

Gateway 通过 HTTP 响应的每一个调用，以及每个调用需要什么、接收什么、返回什么。Web 界面只用这些调用：界面背后没有私有 API，所以界面能做的事，脚本用同样的调用和同样的权限都能做。

本页会与代码对照检查。因此路由列表以及谁可以调用它们，并不是对某个旧版 API 的描述。下面的请求和响应格式取自一个正在运行的 Gateway，测试并不检查这些格式，所以如果您修改了某个处理程序，请同时修改本页中对应的部分。

每项功能更深入的背景见各自的页面：[认证与用户](/zh-hans/iot/authentication/)、[实体](/zh-hans/iot/entities/)、[设备树与标签](/zh-hans/iot/equipment/)、[自动化](/zh-hans/iot/automations/)、[计划报表](/zh-hans/gateway/reports/)、[设备群管理](/zh-hans/gateway/fleet/)、[报警通知](/zh-hans/iot/notifications/)、[备份与恢复](/zh-hans/iot/backup/)和 [MCP](/zh-hans/iot/mcp/)。本页是清单，那些页面讲原因。

## 约定

### 位置

一切都在应用唯一的 HTTP 端口上（`HOTLOOP_LISTEN_ADDR`，默认 `:8080`）。如果代理把应用放在某个路径下提供，请设置 `HOTLOOP_BASE_PATH`，Gateway 会去掉该路径，因此 `/hotloop/api/devices` 和 `/api/devices` 是同一个调用。下面的路径都不带它。

### 登录：Cookie 或 Bearer 令牌

每个 `/api/` 路由都需要会话，登录（用密码，或在自助终端面板上用 PIN 或工牌）、入站 Webhook 和报警确认链接除外，它们各自在请求中带有自己的凭证。`POST /api/auth/login` 返回一个令牌，同时把它设为 `iiot_session` Cookie（HttpOnly、SameSite=Lax，请求通过 TLS 或带 `X-Forwarded-Proto: https` 到达时为 Secure）。浏览器使用 Cookie，永远看不到令牌。脚本则改为发送令牌：

```
Authorization: Bearer 3f9c...e1
```

两者是同一个会话，检查方式也相同。会话持续 `HOTLOOP_AUTH_SESSION_TTL`（默认 12 小时）。没有会话时，每个 `/api/` 路由都会返回：

```
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="hotloop"

{"error":"not logged in"}
```

令牌已被撤销或已过期时返回 `"the session is invalid or has expired"`，账户已被禁用时返回 `"this account no longer has access"`。

设置 `HOTLOOP_AUTH_INSECURE=true` 后完全没有登录：什么都不检查，下面的每项权限都授予所有人，写入时记录的名称取自代理的 `X-EmberNET-User`、`X-Forwarded-User`、`X-Auth-Request-User`、`X-Remote-User` 或 `X-Forwarded-Email` 头，都没有设置则为 `operator`。只有在 NetworkPolicy 保证除仪表板代理外没有任何东西能访问该 Pod 时，这样做才合理。参见[认证与用户](/zh-hans/iot/authentication/#不登录运行)。

MCP 是独立的：它有自己的 Bearer 令牌（`HOTLOOP_MCP_TOKEN`），从不查看会话。参见 [MCP](#mcp)。

### 权限

已登录的用户持有一份权限列表，来自其角色，或直接设置在账户上。路由需要用户没有的权限时，返回：

```
HTTP/1.1 403 Forbidden

{"error":"viewer1 does not have the \"values.write\" permission"}
```

哪个角色拥有哪些权限，见[权限表](#权限)。

### 错误

API 自身产生的每一个失败都是同一种形状的 JSON：

```json
{"error": "value is outside the tag's configured range: 120 is outside 0..95"}
```

`/readyz` 会增加一个 `detail`，失败的服务调用会增加它已经执行的写入。消息是写给阅读它的人的：说明哪里出了问题，有办法时还说明该怎么做。请原样显示。

| 状态 | 何时 |
|---|---|
| 400 | 请求有误：格式错误的请求体、未通过校验的字段、未知字段、缺少的参数、未知的服务 |
| 401 | 没有会话、会话已过期，或登录时密码错误 |
| 403 | 用户没有该权限，或写入门按策略拒绝了写入：写入已关闭、变量未启用、实体已禁用 |
| 404 | 路径或请求体中指明的对象不存在 |
| 409 | 已经存在，或所处状态不允许此操作：未被搁置的报警、仍有子节点的节点、没有已知状态可切换的实体、已在运行的脚本、已被拒绝或正在应用的配方 |
| 422 | 写入门因值本身而拒绝：超出变量的范围、不符合实体的步长 |
| 502 | 设备以自己的错误作出了响应，请求体就是它的原话；或者配方已开始但并非所有目标都送达，请求体会说明哪些已发出、哪些没有 |
| 503 | 设备未连接，或报警引擎没有运行 |
| 500 | 服务器内部故障。请求体是 `internal error (ref …); the server log has the detail under that ref`，不再有别的内容，完整的错误在日志中该编号之下。唯一带有真实消息的 500 是按钮按下后释放信号没有发出，因为这条消息会准确说明该检查什么 |

API 无法归类的一切都是 500，绝不是 400。数据库故障若以 400 返回，就等于告诉操作员他输入错了，于是他去找一个根本不存在的笔误。

有两种失败并非来自 API，是纯文本而不是 JSON：路径没有匹配任何路由时返回 `404 page not found`，已知路径用错误的方法调用时返回 `405 method not allowed`。

被拒绝的写入绝不会是 500。把策略拒绝显示成服务器故障的工厂界面，会教会操作员无视错误。

### 请求体

请求体是 JSON，最大 4 MiB（入站 Webhook 为 1 MiB）。**未知字段会被拒绝**，而不是被忽略：

```json
{"error":"request body: json: unknown field \"x\""}
```

拼错的设置如果被悄悄丢掉，看起来就和生效的设置一模一样，所以解码器会拒绝。

对设备、变量、报警、自动化、设备群成员和报表执行 `POST` 和 `PUT` 会替换整个对象：省略的字段取零值，省略的布尔值是 `false`。先读取，修改，再发回。例外是实体和设备树的 `PUT`，它们只修改您发送的字段，以及设备凭据，省略时会保留（见下文）。

### 机密只写不读

存放在设备中的凭据（代理密码、HTTP 头、地址中的密码）绝不会返回给任何角色，管理员也不例外。它显示为 `[redacted]`：

```json
"config": {"clientId": "docs-api-tankfarm", "password": "[redacted]", "username": "tank"}
```

保存设备时，发送占位符（或省略该键）可保留已存的值，发送新值可替换，发送 `""` 或 `null` 可清除。新设备不能用占位符保存；如果保存会让设备改到另一台主机而仍保留凭据，会被拒绝，这样已存的密码就不会被带到别人的监听端。完整规则见[认证与用户](/zh-hans/iot/authentication/#设备凭据只写不读)。Gateway 持有的其他凭据也一样：设置里显示 `set` 或 `not set`，诊断信息会从出站 MCP 目标中去掉凭据，除登录交给您的那一个令牌外，此 API 中没有任何内容会返回密码哈希或会话令牌。

### camelCase，snake_case 处除外

API 的大部分是 camelCase（`deviceId`、`pollIntervalMs`、`createdAt`），从第一个版本起就是如此，EmberNet 仪表板的 `TagValue` 约定也这样要求。

实体、状态、服务、设备树和标签的端点是 snake_case（`entity_id`、`last_changed`、`parent_id`、`label_id`）。这是有意为之：实体 API 使用通行的实体、状态和服务形式，因此凡是已经会说这种形式的东西也会说这个 API，而设备树就是实体模型的区域注册表，形状是为同样的使用方准备的。两者交汇的地方，各自保留自己的写法：设备有 `equipmentId`，实体有 `equipment_id`。

### 时间、时长和变量键

- **时间戳**是 UTC 的 RFC 3339，有小数秒时带上小数秒：`2026-09-27T20:21:58.255869Z`。显示时区设置改变的是界面显示的内容，绝不改变 API 返回的内容。
- **尚未发生的时间会被省略。** 从未运行过的规则没有 `lastRun`，从未轮询过的设备没有 `lastPoll` 或 `lastGood`，没人确认过的报警没有 `ackedAt`，从未见到过的设备群成员没有 `lastSeen`。缺少时间字段就表示从未发生。您在响应或流事件中绝不会看到 Go 的零时间 `0001-01-01T00:00:00Z`。过去有十几个字段会发送它，自动化界面曾把从未运行过的规则显示成上次运行于 739887 天前。现在有一个测试会读取代码里的每个路由和每个时间字段，以保证这一点。
- **迷你趋势图**是例外：那里的 `timestamps` 是 Unix 毫秒，因为它直接送入图表。
- **时长**在名称里写明单位：`pollIntervalMs`、`onDelaySec`、`minutes`、`durationMs`。状态中的 `uptime` 是 Go 时长字符串（`11m13s`）。
- **变量键**是 `device/tag`，所有 `?tag=` 参数和 `tag` 字段都采用这种形式。变量名可以包含斜杠（OPC UA 路径、MQTT 主题），所以只有第一个斜杠起分隔作用：`plc-1/Line/Zone 1` 是设备 `plc-1` 上的变量 `Line/Zone 1`。
- **数值类查询参数**如果不是数字，会被忽略并使用默认值，所以 `?limit=abc` 等同于没有设置 `?limit`。
- **空列表**在每个响应和每个流事件中，不论嵌套多深，都是 `[]`，绝不是 `null`。在 `.length` 之前不需要做空值检查。您看到的 `null` 绝不会是列表：它是文档中列出的可为空字段之一，比如实体的 `equipment_id` 或根节点的 `parent_id`。标为可选的列表字段仍然可能整个被省略。

### 可选功能

设备群、通知、备份和计划报表默认关闭，除非设置了各自的 `HOTLOOP_*_ENABLED` 变量。功能关闭时，它的列表路由仍然返回 200，带 `"configured": false` 和一个空列表，这样界面可以显示“未启用”而不是“这里什么都没有”。该功能的其他每个路由都返回 400，并给出指明该变量的错误：

```json
{"error":"backups are not enabled (HOTLOOP_BACKUP_ENABLED)"}
```

未配置任何出站 MCP 服务器时，`GET /api/sites` 的行为相同。

### 本产品中没有的功能

HotLoop 以 IoT、Edge、Gateway 和 Edge Relay 的形式由同一套代码发布，产品没有的功能不是被关闭，而是不在二进制文件里。在 IoT、Edge 和 Gateway 上，它的路由经过同样的权限检查后仍会应答，返回一个说明情况并指明两端的 404，这样脚本能分清“设备不对”和“URL 不对”：

```json
{"error":"scheduled reports are part of HotLoop Gateway; this is HotLoop IoT","product":"iot","feature":"reports"}
```

不是 400，因为没有哪个变量能解决它；也不是 5xx，因为没有出任何故障。`GET /api/status` 一开始就会说明是哪个产品作答、有哪些功能，客户端可以直接询问，而不用试探。

### 一切改变内容的操作都会被记录

每一次创建、修改、删除、写入、确认和登录，都会带着用户名记入系统日志（`GET /api/events`），对变量的每一次写入，不论被拒绝与否，都会记入写入审计（`GET /api/writes`）。API 没有悄悄进行的路径。

## 权限

谁拥有什么。带有明确权限列表的账户，只拥有该列表中列出的权限，而不是其角色的权限集合。`*` 授予全部权限，`resource.*` 授予某个资源下的全部权限（`reports.*`）。admin 角色是 `*`。

| 权限 | viewer | operator | admin |
|---|---|---|---|
| `status.read` | 是 | 是 | 是 |
| `devices.read` | 是 | 是 | 是 |
| `devices.write` | 否 | 否 | 是 |
| `tags.read` | 是 | 是 | 是 |
| `tags.write` | 否 | 否 | 是 |
| `values.read` | 是 | 是 | 是 |
| `values.write` | 否 | 是 | 是 |
| `board.write` | 否 | 是 | 是 |
| `entities.read` | 是 | 是 | 是 |
| `entities.write` | 否 | 否 | 是 |
| `helpers.write` | 否 | 是 | 是 |
| `equipment.read` | 是 | 是 | 是 |
| `equipment.write` | 否 | 否 | 是 |
| `alarms.read` | 是 | 是 | 是 |
| `alarms.write` | 否 | 否 | 是 |
| `alarms.ack` | 否 | 是 | 是 |
| `automations.read` | 是 | 是 | 是 |
| `automations.write` | 否 | 否 | 是 |
| `automations.trigger` | 否 | 是 | 是 |
| `scripts.read` | 是 | 是 | 是 |
| `scripts.run` | 否 | 是 | 是 |
| `scripts.write` | 否 | 否 | 是 |
| `recipes.read` | 是 | 是 | 是 |
| `recipes.apply` | 否 | 是 | 是 |
| `recipes.write` | 否 | 否 | 是 |
| `blueprints.read` | 是 | 是 | 是 |
| `blueprints.apply` | 否 | 是 | 是 |
| `blueprints.write` | 否 | 否 | 是 |
| `dashboards.read` | 是 | 是 | 是 |
| `dashboards.write` | 否 | 否 | 是 |
| `energy.read` | 是 | 是 | 是 |
| `energy.write` | 否 | 否 | 是 |
| `fleet.read` | 是 | 是 | 是 |
| `fleet.write` | 否 | 是 | 是 |
| `fleet.rebirth` | 否 | 是 | 是 |
| `fleet.restart` | 否 | 否 | 是 |
| `fleet.update` | 否 | 否 | 是 |
| `fleet.config` | 否 | 否 | 是 |
| `notify.test` | 否 | 否 | 是 |
| `notify.escalation` | 否 | 否 | 是 |
| `backup.read` | 否 | 否 | 是 |
| `backup.run` | 否 | 否 | 是 |
| `reports.read` | 是 | 是 | 是 |
| `reports.run` | 否 | 是 | 是 |
| `reports.write` | 否 | 否 | 是 |
| `sites.read` | 是 | 是 | 是 |
| `settings.read` | 是 | 是 | 是 |
| `settings.write` | 否 | 否 | 是 |
| `events.read` | 是 | 是 | 是 |
| `logbook.read` | 是 | 是 | 是 |
| `users.manage` | 否 | 否 | 是 |

界线在哪里都一样：operator 负责运行工厂（写入值、确认报警、触发自动化、点动一个继电器），只有 admin 才能改变工厂被配置成什么样，或代表 Gateway 对外做某件事（重启中继、推送它的配置、发送测试页、定义把工厂数据通过电子邮件发往某处的报表）。

## 端点索引

权限列说明该路由检查什么。`session` 表示任何已登录的用户，不需要其他权限。`none` 表示连会话也不需要，原因见对应章节。`(in handler)` 表示检查是在处理程序内部而不是在它前面进行的，原因见对应章节。

产品列给出拥有该路由的最小 HotLoop：`all` 是 IoT、Edge 和 Gateway，`edge` 是 Edge 和 Gateway，`gateway` 仅是 Gateway。每个产品都会注册每个路由，并对它检查同样的权限。在没有该路由的产品上，路由返回 404 并说明它在哪里；参见[本产品中没有的功能](#本产品中没有的功能)。

| 方法 | 路径 | 权限 | 产品 |
|---|---|---|---|
| `GET` | `/healthz` | none | all |
| `GET` | `/readyz` | none | all |
| `POST` | `/api/auth/login` | none | all |
| `POST` | `/api/auth/kiosk` | none | all |
| `POST` | `/api/auth/logout` | session | all |
| `POST` | `/api/auth/activity` | session | all |
| `GET` | `/api/auth/session` | session | all |
| `POST` | `/api/auth/password` | session | all |
| `GET` | `/api/users` | `users.manage` | all |
| `POST` | `/api/users` | `users.manage` | all |
| `PUT` | `/api/users/{username}` | `users.manage` | all |
| `DELETE` | `/api/users/{username}` | `users.manage` | all |
| `POST` | `/api/users/{username}/password` | `users.manage` | all |
| `DELETE` | `/api/users/{username}/lockout` | `users.manage` | all |
| `PUT` | `/api/users/{username}/pin` | `users.manage` | all |
| `DELETE` | `/api/users/{username}/pin` | `users.manage` | all |
| `GET` | `/api/opcua/certificates` | `users.manage` | all |
| `GET` | `/api/users/{username}/certificates` | `users.manage` | all |
| `POST` | `/api/users/{username}/certificates` | `users.manage` | all |
| `POST` | `/api/users/{username}/certificates/{thumbprint}/revoke` | `users.manage` | all |
| `DELETE` | `/api/users/{username}/certificates/{thumbprint}` | `users.manage` | all |
| `GET` | `/api/status` | `status.read` | all |
| `GET` | `/api/protocols` | `status.read` | all |
| `GET` | `/api/diagnostics` | `status.read` | all |
| `GET` | `/api/devices` | `devices.read` | all |
| `POST` | `/api/devices` | `devices.write` | all |
| `GET` | `/api/devices/{id}` | `devices.read` | all |
| `DELETE` | `/api/devices/{id}` | `devices.write` | all |
| `POST` | `/api/devices/{id}/enabled` | `devices.write` | all |
| `POST` | `/api/devices/{id}/browse` | `devices.read` | all |
| `POST` | `/api/devices/{id}/import` | `tags.write` | all |
| `GET` | `/api/devices/{id}/network` | `devices.read` | all |
| `PUT` | `/api/devices/{id}/network` | `devices.write` | all |
| `DELETE` | `/api/devices/{id}/network` | `devices.write` | all |
| `GET` | `/api/unifi/{id}/networks` | `devices.read` | all |
| `PUT` | `/api/unifi/{id}/networks/{network}` | `devices.write` | all |
| `POST` | `/api/unifi/{id}/networks/{network}/accept-all` | `devices.write` | all |
| `GET` | `/api/unifi/{id}/known` | `devices.read` | all |
| `PUT` | `/api/unifi/{id}/networks/{network}/known/{mac}` | `devices.write` | all |
| `DELETE` | `/api/unifi/{id}/networks/{network}/known/{mac}` | `devices.write` | all |
| `GET` | `/api/unifi/{id}/clients` | `devices.read` | all |
| `GET` | `/api/unifi/consoles` | `devices.read` | all |
| `GET` | `/api/unifi/{id}/overview` | `devices.read` | all |
| `GET` | `/api/unifi/{id}/topology` | `devices.read` | all |
| `GET` | `/api/unifi/{id}/devices` | `devices.read` | all |
| `GET` | `/api/unifi/{id}/wifi` | `devices.read` | all |
| `GET` | `/api/unifi/{id}/events` | `devices.read` | all |
| `POST` | `/api/unifi/{id}/starter-alarms` | `alarms.write` | all |
| `GET` | `/api/discovery` | `devices.read` | all |
| `GET` | `/api/discovery/{source}/{key}` | `devices.read` | all |
| `POST` | `/api/discovery/{source}/{key}/accept` | `devices.write` | all |
| `POST` | `/api/discovery/{source}/{key}/ignore` | `devices.write` | all |
| `POST` | `/api/discovery/{source}/{key}/unignore` | `devices.write` | all |
| `POST` | `/api/discovery/{source}/{key}/review/apply` | `devices.write` | all |
| `POST` | `/api/discovery/{source}/{key}/review/reject` | `devices.write` | all |
| `GET` | `/api/network-discovery` | `devices.read` | all |
| `GET` | `/api/network-discovery/{key}` | `devices.read` | all |
| `POST` | `/api/network-discovery/{key}/accept` | `devices.write` | all |
| `POST` | `/api/network-discovery/{key}/ignore` | `devices.write` | all |
| `POST` | `/api/network-discovery/{key}/unignore` | `devices.write` | all |
| `POST` | `/api/network-discovery/probe` | `devices.write` | all |
| `GET` | `/api/integrations` | `devices.read` | all |
| `POST` | `/api/integrations/{id}/probe` | `devices.write` | all |
| `POST` | `/api/integrations/{id}/setup` | `devices.write` | all |
| `GET` | `/api/broker/logins` | `users.manage` | all |
| `POST` | `/api/broker/logins` | `users.manage` | all |
| `PUT` | `/api/broker/logins/{name}` | `users.manage` | all |
| `DELETE` | `/api/broker/logins/{name}` | `users.manage` | all |
| `GET` | `/api/mqtt/brokers` | `devices.read` | all |
| `POST` | `/api/mqtt/brokers` | `devices.write` | all |
| `PUT` | `/api/mqtt/brokers/{id}` | `devices.write` | all |
| `DELETE` | `/api/mqtt/brokers/{id}` | `devices.write` | all |
| `GET` | `/api/tags` | `tags.read` | all |
| `POST` | `/api/tags` | `tags.write` | all |
| `DELETE` | `/api/tags/{device}/{name}` | `tags.write` | all |
| `GET` | `/api/values` | `values.read` | all |
| `GET` | `/api/sparkline` | `values.read` | all |
| `GET` | `/api/board` | `values.read` | all |
| `PUT` | `/api/board` | `board.write` | all |
| `POST` | `/api/write` | `values.write` | all |
| `GET` | `/api/history` | `values.read` | all |
| `GET` | `/api/writes` | `values.read` | all |
| `GET` | `/api/entities` | `entities.read` | all |
| `GET` | `/api/entities/composites` | `entities.read` | all |
| `GET` | `/api/entities/{entity_id}` | `entities.read` | all |
| `GET` | `/api/entities/{entity_id}/image` | `entities.read` | all |
| `PUT` | `/api/entities/{entity_id}` | `entities.write` | all |
| `POST` | `/api/entities` | `entities.write` | all |
| `DELETE` | `/api/entities/{entity_id}` | `entities.write` | all |
| `GET` | `/api/states` | `entities.read` | all |
| `GET` | `/api/states/{entity_id}` | `entities.read` | all |
| `GET` | `/api/energy/meters` | `energy.read` | all |
| `POST` | `/api/energy/meters` | `energy.write` | all |
| `GET` | `/api/energy/meters/{id}` | `energy.read` | all |
| `PUT` | `/api/energy/meters/{id}` | `energy.write` | all |
| `DELETE` | `/api/energy/meters/{id}` | `energy.write` | all |
| `GET` | `/api/energy/summary` | `energy.read` | all |
| `GET` | `/api/energy/summary/{period}` | `energy.read` | all |
| `GET` | `/api/energy/series` | `energy.read` | all |
| `GET` | `/api/energy/series/{meter}/{period}/{step}` | `energy.read` | all |
| `POST` | `/api/services/{domain}/{service}` | `values.write`, `alarms.ack`, `helpers.write`, `scripts.run`, `recipes.apply` (in handler) | all |
| `GET` | `/api/helpers` | `entities.read` | all |
| `POST` | `/api/helpers` | `entities.write` | all |
| `GET` | `/api/helpers/{entity_id}` | `entities.read` | all |
| `PUT` | `/api/helpers/{entity_id}` | `entities.write` | all |
| `DELETE` | `/api/helpers/{entity_id}` | `entities.write` | all |
| `GET` | `/api/equipment` | `equipment.read` | all |
| `POST` | `/api/equipment` | `equipment.write` | all |
| `GET` | `/api/equipment/{id}` | `equipment.read` | all |
| `PUT` | `/api/equipment/{id}` | `equipment.write` | all |
| `DELETE` | `/api/equipment/{id}` | `equipment.write` | all |
| `GET` | `/api/labels` | `equipment.read` | all |
| `POST` | `/api/labels` | `equipment.write` | all |
| `GET` | `/api/labels/{label_id}` | `equipment.read` | all |
| `PUT` | `/api/labels/{label_id}` | `equipment.write` | all |
| `DELETE` | `/api/labels/{label_id}` | `equipment.write` | all |
| `PUT` | `/api/devices/{id}/labels` | `equipment.write` | all |
| `GET` | `/api/alarms` | `alarms.read` | all |
| `POST` | `/api/alarms` | `alarms.write` | all |
| `POST` | `/api/alarms/import/codesys` | `alarms.write` | all |
| `DELETE` | `/api/alarms/{id}` | `alarms.write` | all |
| `POST` | `/api/alarms/{id}/ack` | `alarms.ack` | all |
| `POST` | `/api/alarms/{id}/shelve` | `alarms.ack` | all |
| `POST` | `/api/alarms/{id}/unshelve` | `alarms.ack` | all |
| `GET` | `/api/alarms/events` | `alarms.read` | all |
| `GET` | `/api/automations` | `automations.read` | all |
| `POST` | `/api/automations` | `automations.write` | all |
| `POST` | `/api/automations/validate` | `automations.write` | all |
| `DELETE` | `/api/automations/{id}` | `automations.write` | all |
| `POST` | `/api/automations/{id}/enabled` | `automations.write` | all |
| `POST` | `/api/automations/{id}/trigger` | `automations.trigger` | all |
| `GET` | `/api/runs` | `automations.read` | all |
| `POST` | `/api/automations/{id}/blueprint-upgrade` | `blueprints.apply` | all |
| `GET` | `/api/blueprints` | `blueprints.read` | all |
| `POST` | `/api/blueprints` | `blueprints.write` | all |
| `GET` | `/api/blueprints/{id}` | `blueprints.read` | all |
| `PUT` | `/api/blueprints/{id}` | `blueprints.write` | all |
| `DELETE` | `/api/blueprints/{id}` | `blueprints.write` | all |
| `POST` | `/api/blueprints/{id}/instantiate` | `blueprints.apply` | all |
| `GET` | `/api/dashboards` | `dashboards.read` | all |
| `POST` | `/api/dashboards` | `dashboards.write` | all |
| `GET` | `/api/dashboards/{id}` | `dashboards.read` | all |
| `PUT` | `/api/dashboards/{id}` | `dashboards.write` | all |
| `DELETE` | `/api/dashboards/{id}` | `dashboards.write` | all |
| `GET` | `/api/dashboards/{id}/export` | `dashboards.read` | all |
| `POST` | `/api/dashboards/import` | `dashboards.write` | all |
| `GET` | `/api/scripts` | `scripts.read` | all |
| `POST` | `/api/scripts` | `scripts.write` | all |
| `POST` | `/api/scripts/validate` | `scripts.write` | all |
| `GET` | `/api/scripts/{id}` | `scripts.read` | all |
| `PUT` | `/api/scripts/{id}` | `scripts.write` | all |
| `DELETE` | `/api/scripts/{id}` | `scripts.write` | all |
| `POST` | `/api/scripts/{id}/run` | `scripts.run` | all |
| `POST` | `/api/scripts/{id}/stop` | `scripts.run` | all |
| `GET` | `/api/scripts/{id}/runs` | `scripts.read` | all |
| `GET` | `/api/recipes` | `recipes.read` | all |
| `POST` | `/api/recipes` | `recipes.write` | all |
| `POST` | `/api/recipes/capture` | `recipes.write` | all |
| `GET` | `/api/recipes/{id}` | `recipes.read` | all |
| `PUT` | `/api/recipes/{id}` | `recipes.write` | all |
| `DELETE` | `/api/recipes/{id}` | `recipes.write` | all |
| `GET` | `/api/recipes/{id}/versions` | `recipes.read` | all |
| `GET` | `/api/recipes/{id}/versions/{version}` | `recipes.read` | all |
| `POST` | `/api/recipes/{id}/validate` | `recipes.apply` | all |
| `POST` | `/api/recipes/{id}/apply` | `recipes.apply` | all |
| `GET` | `/api/recipes/{id}/applications` | `recipes.read` | all |
| `POST` | `/api/webhook/{path}` | none | all |
| `GET` | `/api/fleet` | `fleet.read` | gateway |
| `POST` | `/api/fleet` | `fleet.write` | gateway |
| `DELETE` | `/api/fleet/{id}` | `fleet.write` | gateway |
| `POST` | `/api/fleet/{id}/rebirth` | `fleet.rebirth` | gateway |
| `POST` | `/api/fleet/{id}/restart` | `fleet.restart` | gateway |
| `POST` | `/api/fleet/{id}/update` | `fleet.update` | gateway |
| `POST` | `/api/fleet/{id}/config` | `fleet.config` | gateway |
| `DELETE` | `/api/fleet/{id}/config` | `fleet.config` | gateway |
| `POST` | `/api/notify/test` | `notify.test` | all |
| `GET` | `/api/notify/escalation` | `notify.escalation` | all |
| `PUT` | `/api/notify/escalation` | `notify.escalation` | all |
| `POST` | `/api/notify/ack/{token}` | none | all |
| `GET` | `/api/backup` | `backup.read` | all |
| `POST` | `/api/backup` | `backup.run` | all |
| `GET` | `/api/reports` | `reports.read` | gateway |
| `POST` | `/api/reports` | `reports.write` | gateway |
| `GET` | `/api/reports/{id}` | `reports.read` | gateway |
| `PUT` | `/api/reports/{id}` | `reports.write` | gateway |
| `DELETE` | `/api/reports/{id}` | `reports.write` | gateway |
| `POST` | `/api/reports/{id}/run` | `reports.run` | gateway |
| `GET` | `/api/reports/{id}/runs` | `reports.read` | gateway |
| `GET` | `/api/reports/{id}/runs/{run}/download` | `reports.read` | gateway |
| `GET` | `/api/sites` | `sites.read` | gateway |
| `GET` | `/api/settings` | `settings.read` | all |
| `PUT` | `/api/settings` | `settings.write` | all |
| `GET` | `/api/historian/targets` | `settings.read` | all |
| `POST` | `/api/historian/targets` | `settings.write` | all |
| `PUT` | `/api/historian/targets/{id}` | `settings.write` | all |
| `DELETE` | `/api/historian/targets/{id}` | `settings.write` | all |
| `GET` | `/api/events` | `events.read` | all |
| `GET` | `/api/logbook` | `logbook.read` | all |
| `GET` | `/api/stream` | `status.read` | all |
| 任意 | `/mcp` | MCP 令牌 | all |
| 任意 | `/mcp/` | MCP 令牌 | all |
| `GET` | `/manifest.webmanifest` | none | all |
| `GET` | `/sw.js` | none | all |
| `GET` | `/next` | none | all |
| `GET` | `/next/` | none | all |
| 任意 | `/` | none | all |

## 健康

供 kubelet 和负载均衡器使用。二者都不需要会话：探针没有账户，也不透露任何有关工厂的信息。

### `GET /healthz`

Liveness。只要进程在提供 HTTP 服务，就返回 `200` 和文本 `ok`。它有意不碰数据库：数据库故障应当让 Pod 退出轮转，而不是让它不停重启。

### `GET /readyz`

Readiness。用 5 秒的时间预算对数据库做 ping。

```json
{"status":"ready"}
```

无法连上数据库时返回 `503`，原因在 `detail` 中（格式来自处理程序；原因文字是数据库驱动所说的原话）：

```json
{"error":"not ready","detail":"<why the database did not answer>"}
```

连不上自己的历史数据库的应用，不应该接收流量。

## 认证

关于账户、角色和第一个管理员，参见[认证与用户](/zh-hans/iot/authentication/)。

### `POST /api/auth/login`

按设计不需要会话。

| 字段 | 类型 | <span class="sr-only">详细信息</span> |
|---|---|---|
| `username` | string | 必填。忽略大小写和前后的空格 |
| `password` | string | 必填 |

```json
{"expiresAt":"2026-09-28T08:21:00.571794Z","permissions":["*"],"role":"admin","token":"<token>","username":"admin"}
```

同时把 `iiot_session` Cookie 设为同一个令牌。名称错误、密码错误或账户已禁用，都同样返回 `401` `"invalid username or password"`，耗时也相同：具体是三者中的哪一个，不该告诉陌生人。账户连续输错密码或 PIN 过多时，不论发送什么，都返回 `429`，并带 `Retry-After` 头；参见[认证与用户](/zh-hans/iot/authentication/#密码和-pin-输错后的锁定)。

### `POST /api/auth/kiosk`

按[认证与用户](/zh-hans/iot/authentication/#自助终端面板pin-或工牌以及空闲退出)所述，在共用面板上用 PIN 或工牌登录。按设计不需要会话。

| 字段 | 类型 | <span class="sr-only">详细信息</span> |
|---|---|---|
| `code` | string | 必填。PIN，或键盘模拟式工牌读卡器输入的值。忽略前后的空格 |
| `username` | string | 可选。带上它时，只检查该账户的 PIN，输错会计入该账户的锁定次数。不带时，会在所有账户的代码中查找 |

```json
{"expiresAt":"2026-10-21T08:21:00.571794Z","idleSec":300,"permissions":["status.read","tags.read"],"role":"operator","username":"olga"}
```

设置 `iiot_session` Cookie，并且与 `POST /api/auth/login` 不同，不返回令牌：自助终端的会话属于面板上的浏览器。`idleSec` 是会话在无人触碰时能保持多久。代码错误、代码太短和已禁用账户的代码，都同样返回 `401` `"that PIN or badge isn't recognized"`，耗时也相同。账户被锁定时返回 `429`（参见[锁定](/zh-hans/iot/authentication/#密码和-pin-输错后的锁定)），并带 `Retry-After` 头。没带 `username` 发送、又不匹配任何人的代码，不会计入任何账户；发送它的面板按客户端地址计，在检查它下一次同类尝试前会多等半秒，最多到 `ui.panelDelaySeconds`，输对一次就重新开始。面板本身永远不会被锁定。部署在没有登录的状态下运行时（`HOTLOOP_AUTH_INSECURE`）返回 `400`，因为此时没有可以登录的对象。

### `POST /api/auth/activity`

有人触碰了面板。没有请求体。`{"status":"ok"}`。在自助终端会话上，这会把它的空闲期限往后推；其他所有不是读取的请求（写入、确认）也一样。`GET`、实时数据流和页面自己的后台加载则不会：否则它们会让最后一个人永远保持登录。用密码创建的会话没有空闲期限，也就没有什么可推的。

### `POST /api/auth/logout`

结束请求所带的会话（Cookie 或 Bearer）并清除 Cookie。没有请求体。`{"status":"logged out"}`。

### `GET /api/auth/session`

我是谁。供界面的启动流程使用。

```json
{"authenticated":true,"permissions":["*"],"role":"admin","username":"admin"}
```

在自助终端面板上创建的会话会增加 `"idleSec"`，即以秒计的空闲期限，页面据此知道要自行退出登录。

关闭认证时（`HOTLOOP_AUTH_INSECURE`），它返回 `{"authenticated":false,"insecure":true}` 而不是 401，这样界面可以说明为什么没有登录，而不是去猜。

### `POST /api/auth/password`

修改您自己的密码。不需要权限：知道当前密码本身就是凭证。

| 字段 | 类型 | <span class="sr-only">详细信息</span> |
|---|---|---|
| `currentPassword` | string | 必填 |
| `newPassword` | string | 必填，至少 8 个字符 |

`{"status":"password changed; log in again"}`。**账户的每个会话都会结束，包括当前这个**，Cookie 也会被清除：改了密码却让旧会话继续有效，只是名义上的修改。当前密码错误返回 `401`，新密码太短返回 `400`。

## 用户

全部仅限管理员（`users.manage`）。密码哈希绝不会出现在响应中；该字段没有 JSON 名称。

### `GET /api/users`

```json
[{"username":"admin","role":"admin","disabled":false,"hasPin":false,"locked":false,"createdAt":"2026-09-27T20:19:28.036228Z","updatedAt":"2026-09-27T20:19:28.036228Z","lastLogin":"2026-09-27T20:21:00.575455Z"}]
```

`permissions` 只出现在有明确列表的账户上。`hasPin` 说明账户是否有自助终端 PIN 或工牌；其值及其哈希绝不会出现。

### `POST /api/users`

| 字段 | 类型 | <span class="sr-only">详细信息</span> |
|---|---|---|
| `username` | string | 必填。小写字母、数字、点、下划线、连字符，以字母或数字开头，2 到 64 个字符 |
| `password` | string | 必填，至少 8 个字符 |
| `role` | string | `admin`、`operator` 或 `viewer`。默认为 `viewer` |
| `permissions` | string[] | 可选。完全替换该角色的权限集合 |

返回新用户。名称、角色或密码不合法时返回 `400`，名称已被占用时返回 `409`。

### `PUT /api/users/{username}`

| 字段 | 类型 | <span class="sr-only">详细信息</span> |
|---|---|---|
| `role` | string | 必填，除非设置了 `permissions` |
| `permissions` | string[] | 可选。为空表示“使用角色” |
| `disabled` | bool | `true` 会禁用该账户并结束它的所有会话 |

返回更新后的用户。角色未知，或要禁用最后一个已启用的管理员时返回 `400`：那会造成无人能撤销的锁定。用户未知时返回 `404`。

### `DELETE /api/users/{username}`

`{"status":"deleted"}`。对您自己的账户或最后一个已启用的管理员返回 `400`，用户未知时返回 `404`。

### `POST /api/users/{username}/password`

管理员在不知道旧密码的情况下设置他人的密码。`{"password": "..."}`，至少 8 个字符。返回 `{"status":"password reset"}` 并结束该账户的所有会话。

### `PUT /api/users/{username}/pin`

管理员为账户设置用于在自助终端面板登录的 PIN 或工牌值，或替换已有的那个。`{"code": "482913"}`：6 到 72 个字符，不含空格或控制字符，可以是数字或读卡器输入的任何其他字符。返回 `{"status":"PIN set","username":"olga","hasPin":true}`。该值像密码一样用 bcrypt 哈希，绝不记入日志，也不会返回。代码太短、太长、含空格或已被另一个账户使用时返回 `400`：面板仅凭代码找到账户，所以一个代码只能打开一个账户。用户未知时返回 `404`。它不会改动密码或任何会话。

### `DELETE /api/users/{username}/lockout`

在锁定到期之前让被锁定的账户重新进入，并把它输错密码和 PIN 的计数清零。`{"status":"unlocked","username":"olga","locked":false}`。用户未知时返回 `404`。被锁定的账户在 `GET /api/users` 中显示 `"locked":true` 和 `"lockedUntil"`。

### `DELETE /api/users/{username}/pin`

移除 PIN 或工牌，并让账户从它已登录的所有自助终端面板退出。它的密码，以及它在自己电脑上的会话，都不受影响。`{"status":"PIN cleared","username":"olga","hasPin":false}`。用户未知时返回 `404`。

### `GET /api/opcua/certificates`

为登录 OPC UA 服务器而附加到用户的每一张 X.509 证书，最新的在前（参见 [OPC UA 服务器](/zh-hans/edge/opc-ua-server/#x509-user-certificates)）：`{"serverAcceptsCertificates":false,"certificates":[...]}`。每张证书包含 `thumbprint`（DER 形式的 SHA-256，小写十六进制）、`username`、`label`、`subject`、`notBefore`、`notAfter`、`addedBy`、`addedAt`，吊销后有 `revokedAt` 和 `revokedBy`，使用后有 `lastUsed`，以及 `state`：`active`、`revoked`、`expired` 或 `not yet valid`。只有有效的证书才能让人登录。`serverAcceptsCertificates` 表示 OPC UA 服务器是否已开启并设置了 `HOTLOOP_OPCUA_SERVER_ALLOW_X509`；无论哪种情况，证书都会保留。只存储和发送公开证书。

### `GET /api/users/{username}/certificates`

同样的列表，只针对一个用户。用户未知时返回 `404`。

### `POST /api/users/{username}/certificates`

给用户附加一张证书。`{"certificate": "<PEM text or base64 of the DER bytes>", "label": "Olga's laptop"}`；标签可选。返回 `201`，内容是列表中所示的证书。证书必须是密钥至少 2048 位的 RSA，且不能已过期。`400` 会说明是其中哪一条，对于不是证书的东西也一样：私钥会被点名拒绝，绝不保存也不回显，证书链同样如此。用户未知时返回 `404`。证书已附加到本用户或其他用户时返回 `409`：一张证书对应一个人。这项更改连同操作者记录在工作日志中。

### `POST /api/users/{username}/certificates/{thumbprint}/revoke`

吊销一张证书。它不能再用于登录，用它打开的会话会在权限缓存的 10 秒内结束，之后的尝试会被拒绝并记录为已吊销。它仍以 `revoked` 状态保留在列表中，附带操作者和时间，再次吊销会保留第一条记录。`{thumbprint}` 是列表中所示的 SHA-256；接受冒号、空格和大写。证书不属于该用户时返回 `404`。

### `DELETE /api/users/{username}/certificates/{thumbprint}`

让系统忘记一张证书。再次附加后它又会生效。不属于该用户时返回 `404`。删除用户会删除它的证书。

## 状态与诊断

### `GET /api/status`

顶部栏：运行时计数器、报警摘要、工厂名称，以及这是哪个产品。`product` 是 `iot`、`edge` 或 `gateway`，与 `hotloop --product` 相同。`features` 说明各产品之间有差异的功能中，本产品拥有哪些：Gateway 中是 `edge-publish`、`fleet`、`opcua-server`、`reports` 和 `sites`，Edge 中是第一项和第三项，IoT 中没有。`version` 是构建版本，`imageDigest` 是启动所用镜像的摘要，在跟随 `:stable` 的设备上，仅凭版本号无法得知这一点。只有监督程序告知时才有（Quadlet 单元每次启动前都会告知；裸二进制和 Helm 安装做不到），否则省略。

```json
{
  "alarms": {"critical":0,"high":1,"medium":0,"low":0,"unacked":0,"total":1},
  "features": ["edge-publish","fleet","opcua-server","reports","sites"],
  "plantName": "Demo Plant",
  "product": "gateway",
  "runtime": {
    "startedAt": "2026-09-27T20:19:28.06635851Z", "uptime": "11m13s",
    "devices": 2, "connected": 2, "degraded": 0, "disconnected": 0,
    "tags": 5, "cachedTags": 5, "writesOk": 4, "writesRefused": 3,
    "bus": {"subscribers":4,"published":653,"dropped":0},
    "historian": {"queued":1085,"written":1085,"filtered":329,"dropped":0,"failed":0,"queueLen":0,"queueCap":50000},
    "writePolicy": {"allowWrites":true,"allowMcpWrites":true,"confirmWrites":true},
    "protocols": ["codesys","ethernet-ip","http","modbus","mqtt","mtconnect","opcua","s7comm","snmp","unifi"]
  },
  "siteId": "docs",
  "version": "4.23.2"
}
```

### `GET /api/protocols`

Gateway 知道的每一种协议，以及本构建是否带有它的驱动。

```json
[{"id":"opcua","name":"OPC UA","description":"The universal one. ...","transport":"opc.tcp binary","defaultPort":4840,"writable":true,"browsable":true,"deviceTypes":["plc","cnc","robot","ipc","hmi","historian","gateway"],"library":"...","available":true}]
```

### `GET /api/diagnostics`

诊断界面显示的内容：数据库连接池、历史数据库队列和历史大小、变量总线、实体引擎、工作日志的记录器、运行时、MCP（服务器和出站连接），以及自动化引擎已启用的规则、Webhook 路径和状态变化队列。

```json
{
  "automations": {"armed":[],"stateChangesDropped":0,"stateChangesPending":0,"webhooks":[]},
  "bus": {"subscribers":4,"published":654,"dropped":0},
  "database": {"type":"postgres","totalConns":3,"idleConns":3,"acquiredConns":0,"maxConns":10,"historyMode":"timescale","timescaleVersion":"2.30.1"},
  "entities": {"entities":8,"droppedBatches":0,"pendingChanges":0,"droppedChanges":0},
  "historian": {"queued":1087,"written":1085,"filtered":329,"dropped":0,"failed":0,"queueLen":0,"queueCap":50000},
  "historyStats": {"mode":"timescale","rows":996,"distinctTags":5,"oldest":"2026-09-27T20:21:38.609853Z","newest":"2026-09-27T20:30:39.507987Z","sizeBytes":73728},
  "logbook": {"recording":true,"retentionDays":90,"queued":0,"dropped":0,"written":212,"suppressed":36,"writeErrors":0},
  "mcp": {"outbound":[],"path":"/mcp","serverEnabled":true,"tokenSet":true},
  "runtime": {"...": "the same block as /api/status"}
}
```

配置了出站 MCP 服务器时，`outbound` 会列出每一个：

```json
{"name":"plant-a","target":"http://localhost:8080/mcp","connected":true,"tools":["ack_alarm","call_service","...","write_tag"],"connectedSince":"2026-09-27T20:45:50Z"}
```

出站服务器的 `target` 或 `lastError` 中的任何凭据都会被清除，因为 URL 或命令行可能带有令牌，而所有角色都能读到这些内容。MCP 令牌本身永远只显示为 `tokenSet`。

## 设备

设备是通过一种协议建立的一个连接。`config` 和 `address` 里放什么取决于协议：参见[协议与驱动](/zh-hans/iot/protocols/)。

### `GET /api/devices`

每台设备，附带实时连接状态。凭据显示为 `[redacted]`。`?q=` 保留 id、名称、地址或协议中包含该文本的设备（不区分大小写），`?limit=`（1 到 5000，其他值返回 `400`）保留其中靠前的若干台；用到其中任何一个时，`X-Total-Count` 表示匹配了多少台。

```json
[{"id":"tank-farm","name":"Tank farm","protocol":"mqtt","address":"base-mqtt:1883","enabled":true,
  "site":"Demo Plant","area":"Utilities","equipmentId":4,
  "config":{"clientId":"docs-api-tankfarm","password":"[redacted]","topics":["docs-api-example/#"],"username":"tank","writeTopic":"docs-api-example/{tag}/set"},
  "createdAt":"2026-09-27T20:21:01.637319Z","updatedAt":"2026-09-27T20:21:01.637319Z",
  "state":"connected","lastPoll":"2026-09-27T20:21:39.412Z",
  "latencyMs":0.002,"tagCount":3,"pollCount":1}]
```

`state` 是 `connected`、`connecting`、`degraded`（已连接，但轮询失败）、`disconnected` 或 `disabled`。`lastError`、`errorCount` 等在有内容可说时才出现。

### `POST /api/devices`

如果 `id` 是新的就创建设备，否则替换它。没有 `PUT`。

| 字段 | 类型 | <span class="sr-only">详细信息</span> |
|---|---|---|
| `id` | string | 必填。1 到 64 个字母、数字、`.`、`_`、`-`，以字母或数字开头。它会出现在 URL、MQTT 主题和 MCP 参数里 |
| `name` | string | 必填 |
| `protocol` | string | 必填。本构建带有驱动的协议之一（`GET /api/protocols`） |
| `address` | string | 必填。主机和端口，或 `opc.tcp://`、`http://` 开头的 URL：由协议决定 |
| `enabled` | bool | 省略时为 `false` |
| `description` | string | |
| `pollIntervalMs`, `timeoutMs` | int | 0 表示取运行时默认值。轮询间隔的下限是 `HOTLOOP_MIN_POLL_INTERVAL` |
| `site`, `area`, `line` | string | 按名称把设备放入设备树，必要时创建节点 |
| `equipmentId` | int | 改为把它放在树的某个节点上；此时 `site`、`area` 和 `line` 取自该节点。参见[设备树与标签](/zh-hans/iot/equipment/) |
| `config` | object | 协议自己的选项。凭据遵循[只写规则](#机密只写不读) |

运行时字段（`state`、`lastPoll`、`tagCount` 等）是只读的；发回去也会被忽略。返回已保存的设备，已作脱敏处理。协议没有驱动、校验失败或违反凭据规则时返回 `400`；运行时会立即带着它重新加载。

```json
{"error":"no driver for protocol \"profibus\"; this build speaks: ethernet-ip, http, modbus, mqtt, mtconnect, opcua, s7comm, snmp, unifi"}
```

### `GET /api/devices/{id}`

设备及其变量和标签。

```json
{"device":{"id":"tank-farm","name":"Tank farm","...":"..."},"labels":["critical"],"tags":[{"id":3,"deviceId":"tank-farm","name":"level","...":"..."}]}
```

没有变量的设备，`tags` 是 `[]`。id 未知时返回 `404`。

### `DELETE /api/devices/{id}`

删除设备、它的变量及这些变量的实体。**它的历史数据会保留。** `{"deleted":"tank-farm"}`，或 `404`。

### `POST /api/devices/{id}/enabled`

`{"enabled": false}` 停止轮询，但不删除任何东西。返回 `{"enabled":false,"id":"tank-farm"}`。id 未知时返回 `404`。

### `POST /api/devices/{id}/browse`

询问设备有哪些点。因为只是读取，只需要 `devices.read`。没有请求体。

```json
{"supported":true,"tags":[{"name":"Plant_Boiler_Temperature","address":"nsu=http://plant/;s=Temperature","dataType":"float","description":"Temperature","writable":true}]}
```

无法枚举其点的协议（Modbus、S7comm、HTTP）返回 `200` 和 `{"supported":false,"reason":"..."}`：这是关于协议的事实，不是错误。设备未连接时返回 `503`。这里的 `writable` 是设备对该点的说法，不是 Gateway 是否会写它。

### `POST /api/devices/{id}/import`

把浏览结果变成已配置的变量。因为要创建变量，所以需要 `tags.write`。

```json
{"tags":[{"name":"Temperature","address":"nsu=http://emberburn/;s=Temperature","dataType":"float","unit":"C"}]}
```

每个条目接受 `name`、`address`、`dataType`、`unit`、`description`、`deviceClass` 和 `writable`（浏览结果原样）。返回 `{"inserted":2,"updated":0}`。**无论设备怎么说，每个导入的变量都是只读的**：发现的点并不是有人决定可以下发命令的点，默认反过来会一次启用几千个。请用 `POST /api/tags` 启用您确实想要的那些。设备未知时返回 `404`。

## UniFi：OT 网络、客户端，以及设备在网络中的位置

HotLoop 自己关于 UniFi 站点的记录。参见 [UniFi Network](/zh-hans/iot/unifi/)。`/api/unifi` 下的 `{id}` 是一个 UniFi 设备（一个控制台上的一个站点）；`{network}` 是控制台给网络起的 ID，与 `GET .../networks` 给出的一致；`{mac}` 接受任何常见写法，并以小写加冒号的形式保存。

**这些调用都不会向控制台询问任何东西。** 它们读取驱动上一次从控制台读到的内容，所以开着不关的界面不会给控制台增加负担。这也意味着，在设备被读取一次之前它们返回 `503`，在从不登录控制台的 `--mcp-stdio` 辅助进程中则始终如此。它们也都不会向控制台写入。

创建或删除报警的更改会在 `change` 中说明：`{"alarmsCreated":["unifi-unknown-3f2a9c01b7de"]}`。这些是 `/api/alarms` 下的普通报警定义。

### `GET /api/devices/{id}/network`

HotLoop 设备（PLC、电表）在网络中的位置。已关联时：

```json
{"deviceId":"plc-07","link":{"deviceId":"plc-07","consoleId":"plant-net","mac":"02:48:4c:00:00:07","confirmedBy":"hana","confirmedAt":"2026-09-28T18:02:05Z"},
 "consoleName":"Plant network","client":{"mac":"02:48:4c:00:00:07","ip":"10.77.0.7","switchMac":"00:27:22:e2:1d:6f","switchName":"USW Lite 8 PoE","port":5,"portUp":false,"online":false,"lastSeen":"2026-09-28T18:01:40Z","lastSeenSec":25,"why":"its switch port 5 has no link","...":"..."},
 "readAt":"2026-09-28T18:02:05Z","summary":"on USW Lite 8 PoE port 5, link down; the console last saw it 25s ago; off the network: its switch port 5 has no link","proposals":[]}
```

未关联时，`link` 是 `null`，`proposals` 按从新到旧列出 HotLoop 所读取的任一控制台在该设备 IP 上的客户端。提案只是提案：控制台里的 IP 会滞后，所以在管理员确认其中一个之前，不会有任何东西被关联。

### `PUT /api/devices/{id}/network`

`{"consoleId":"plant-net","mac":"02:48:4c:00:00:07"}` 确认该设备是哪个客户端。从此 MAC 是键，不再信任 IP。该客户端会得到变量（控制台上的 `c.<mac>.*`）和一个报警“PLC-07 脱离网络”，优先级 1，带 120 秒的开启延时，这样重启不会惊动任何人。返回 `{"link":{...},"change":{...}}`。`consoleId` 不是 UniFi 设备或 MAC 不是 MAC 时返回 `400`，设备未知时返回 `404`。

### `DELETE /api/devices/{id}/network`

移除关联，以及 HotLoop 为它创建的报警，除非该客户端仍通过已知列表被监视。没有关联时返回 `404`。

### `GET /api/unifi/{id}/networks`

控制台所掌握的站点网络，附带 HotLoop 的记录：`ot`、`known`（其列表中有多少台设备）、`clients`（此刻在其上的数量）和 `unknown`（此刻在其上但不在列表中的数量）。HotLoop 有记录而控制台已不再拥有的网络，会带着 `"onConsole":false` 返回。

```json
[{"networkId":"6abb23d25a95f2636a5df29c","name":"SCADA","purpose":"corporate","vlan":122,"subnet":"10.122.0.1/24","onConsole":true,"ot":true,"clients":2,"known":1,"unknown":[{"mac":"02:9b:b1:69:88:f2","ip":"10.122.0.66","switchName":"USW Lite 8 PoE","port":6,"...":"..."}],"changedBy":"hana"}]
```

### `PUT /api/unifi/{id}/networks/{network}`

`{"ot": true}` 把网络标记为 OT。其上任何不在已知列表中的东西都会计入 `n.<network>.unknown`，并在 `.unknown_last` 中报出自己的名字，HotLoop 会创建优先级 1 的报警“SCADA 上有未知设备”。`{"ot": false}` 取消标记并移除该报警；已知列表会保留。对 WAN 或控制台没有的网络返回 `400`。

### `POST /api/unifi/{id}/networks/{network}/accept-all`

按现状接受此刻网络上的所有设备：标记网络之后的一次点击。已在列表中的设备保留它们的名称和监视设置。没有请求体。返回 `{"accepted":[{known device}...]}`，即它添加的设备。

### `GET /api/unifi/{id}/known`

站点网络上的每一台已知设备：`[{"deviceId":"plant-net","networkId":"...","mac":"...","name":"PLC-07","watch":true,"acceptedBy":"hana","acceptedAt":"..."}]`。

### `PUT /api/unifi/{id}/networks/{network}/known/{mac}`

`{"name":"PLC-07","watch":true}` 接受一台设备进入网络，或更改它的名称或监视设置。`watch` 会给它变量和离线报警；被允许但时有时无的设备（维护用笔记本电脑）则不带它被接受。网络从未被标记为 OT 时返回 `400`。

### `DELETE /api/unifi/{id}/networks/{network}/known/{mac}`

把一台设备从列表中移除。如果它在网络上，下一次读取时它又成为未知设备。

### `GET /api/unifi/{id}/clients`

控制台列出的每个客户端，再加上它没有列出的每个受监视客户端，每个都带有位置、是否在线，以及 `ot`、`known`、`watched`、`linkedTo` 和一行的 `summary`。`?q=` 可按 MAC、IP 或名称缩小范围。

### `GET /api/unifi/consoles`

HotLoop 拥有的每个 UniFi 设备，无论是否在运行，供 UniFi 界面的选择器使用：`[{"id":"plant-net","name":"Plant network","address":"https://...","enabled":true,"running":true,"site":"default","version":"10.6.106","readAt":"...","devices":4,"online":4,"clients":12,"failover":false,"eventsLive":true}]`。本进程尚未读取的控制台会在 `why` 中说明原因。

### `GET /api/unifi/{id}/overview`

概览卡片：设备数和客户端数（客户端在 HotLoop 认为它在网络上时才计数，这是 `n.<id>.clients` 变量所用的判断，而不只是控制台列出它的时候）、各网络的客户端数、控制台各子系统的 `health`，以及每个网关的 WAN 条 `gateways[]`：每个 WAN 一个 `wans[]` 条目，含 `alive`（网关自己的健康检查，绝不是 WAN 块的 `up`）、`known`、`active`、`backup`、延迟和可用性。`failover` 表示流量走在不是第一个的 WAN 上，`down` 表示没有存活的 WAN，`since` 是 HotLoop 第一次看到流量走在它现在所用 WAN 上的那次读取，也就是 HotLoop 注意到的时间，而不是网关切换的时间。`events` 是事件 websocket 的状态（`live`、`error`、`reconnects`）和最新的十个事件。

### `GET /api/unifi/{id}/topology`

拓扑图。`nodes[]` 是已纳管的设备及其在网格中的位置（`x`、`y`、`layer`：从网关起自左向右，同一次读取的排布方式相同），`edges[]` 是它们之间的线缆，来自控制台自己的 `downlink_table`，`wired[]` 和 `wifi[]` 是挂在每个交换机端口、每个 AP 和 SSID 下的客户端。没有任何信息表明接在哪里的设备会单独绘出，并设置 `noUplink`，而不会凭猜测挂到网关上。HotLoop 所读取的另一台 UniFi 控制台的设备，如果本控制台把它列为客户端，就会作为设置了 `external` 的节点接入，并带一条有 `stitched` 的边。`feeds` 按设备 MAC 给出与其下游某个客户端关联的 HotLoop 设备，附带用于工厂树的 `equipmentId`，`links` 则按客户端 MAC 给出同样的设备。

### `GET /api/unifi/{id}/devices`

每个已纳管设备及其数值，以及用于面板图的 `ports[]`：链路、速度、PoE 模式和功耗、端口上学到的客户端、接在其上的设备，以及 `dropped`，表示端口在更早的读取中是通的、现在断了。被控制台丢失的设备不报告任何数值和端口链路，因为它最后说的内容已不是当前的。

### `GET /api/unifi/{id}/wifi`

站点的 SSID，含 `enabled`、所在网络，以及每个 SSID 上有多少客户端。当控制台不向此账户显示无线网络时，`error` 会说明原因，`wlans` 为空。

### `GET /api/unifi/{id}/events`

自 HotLoop 连接以来控制台报告的最新事件，最新的在前（`?limit=` 最多 200，默认 50），以及事件 websocket 的状态。每个事件有控制器的 `key`（`EVT_SW_Lost_Contact`）、它自己的 `message`、`severity`（控制器将其标为出了问题时为 `warning`），以及它所涉及的设备、客户端和端口。它们也在工作日志中，归在所涉及的交换机或接入点之下（参见 [UniFi Network](/zh-hans/iot/unifi/#事件)）。

### `POST /api/unifi/{id}/starter-alarms`

根据控制台此刻的内容，为站点创建常用报警，作为 `/api/alarms` 下的普通报警定义：每个离线的已纳管设备（优先级 2，开启延时 60 秒）、每个断开的上行端口（优先级 1，10 秒）、有两个或更多 WAN 却运行在备用 WAN 上的网关（优先级 2，30 秒）。请求体可选。`{"poeLimitW": 25}` 会对每个 PoE 端口 `poe_w` 功耗超过该瓦数的情况增加一个优先级 3 的报警，开启延时 30 秒；控制台不会告知端口的功率预算，所以 HotLoop 不去猜测。负的限值返回 `400`。

```json
{"created":[{"id":"unifi-devoffline-9c1e2a77b3d0","name":"USW Lite 8 PoE offline","kind":"offline","tag":"d.002722e2e633.online","priority":2}],
 "kept":[]}
```

`kept` 是这组报警要求而已经存在的那些：它自己上一次点击创建的，或别人在同一变量上建的报警。因此在纳管更多设备后再次点击是安全的，它只会为新设备添加。OT 网络报警和脱离网络报警不属于它；它们随着把网络标记为 OT 和监视设备而来。控制台被读取一次之前返回 `503`。

## MQTT 发现

通过 MQTT 自我通告的设备，以及人对每一台所做的决定。参见 [MQTT 发现](/zh-hans/iot/mqtt-discovery/)。发现功能在内置代理运行时监听它，并监听在 `/api/mqtt/brokers` 下设置的每个代理。两者都没有时，`sources` 为空。在从不监听的 `--mcp-stdio` 辅助进程中，`GET /api/discovery` 返回 `{"running":false,"sources":[],"devices":[]}`，其他所有路由返回 `503`。

`{source}` 是设备发出通告所在的代理（HotLoop 自己的是 `embedded`，其他则是该代理的 id）；`{key}` 是把它的各条通告联系起来的东西：它的第一个标识符、形如 `mac:aa:bb:cc:dd:ee:ff` 的 MAC，或它的节点 id。请对它做 URL 编码；标识符含有路径不接受的字符。

**这些调用都不会启用任何东西。** 接受一台设备会让它的点可以被启用，一次一个，通过 `POST /api/tags`，和其他所有点一样。

### `GET /api/discovery`

每个来源，及其所见和所拒绝的内容，以及每台被发现的设备：

```json
{"running":true,"sources":[{"id":"embedded","name":"the embedded broker","prefix":"homeassistant","listening":true,"connected":true,
  "received":42,"dropped":0,"refused":0,"problems":[],"autoCreate":true,"anonymousAllowed":false,
  "external":false,"listenOnly":false,"enabled":true}],
 "devices":[{"source":"embedded","deviceKey":"plug-0001","deviceId":"kitchen-plug","status":"discovered",
  "device":{"identifiers":["plug-0001"],"name":"Kitchen Plug","manufacturer":"Acme","model":"P1","swVersion":"1.0.0"},
  "origin":{"name":"test-publisher","swVersion":"0.1"},"firstSeen":"2026-10-02T09:12:04Z","lastSeen":"2026-10-02T09:12:04Z",
  "components":[{"key":"plug-0001-relay","component":"switch","name":"Relay","configTopic":"homeassistant/switch/plug-0001/relay/config",
   "stateTopic":"plug/relay","commandTopic":"plug/relay/set","commandTopics":["plug/relay/set"],"tag":"relay",
   "unsupported":[],"unknownKeys":[],"flags":[]}]}]}
```

`external` 为 true 的来源是在 `/api/mqtt/brokers` 下设置的代理，`broker` 说明它在哪里。`autoCreate` 为 false 的来源，其设备在收件箱里等待：以 `discovered` 列出，没有 `deviceId`，在有人接受一台之前不会创建任何东西，也不会读取任何东西。`listenOnly` 是 HotLoop 从不向其发布的代理。`lastError` 说明来源为何未连接，包括无法打开的密码。

`status` 是 `discovered`、`accepted` 或 `ignored`。按组件，`unsupported` 列出 HotLoop 无法使用的内容及原因（“value template not supported: filter `regex_findall_index` is not supported at column 12”），`unknownKeys` 列出格式未定义的配置键，`commandTopics` 列出其命令可以发往的每个主题（风扇的速度主题以及主主题），`flags` 列出人在接受之前应该看一看的内容：位于组件所读主题之外的命令主题、位于发现前缀之内的，或被另一台设备声称的，以及要求保留命令的配置。`withdrawnAt` 设置在发布者撤回的组件上。`suggestedEquipmentId` 是设备的 `suggested_area` 所指的树节点，前提是恰好有一个节点叫这个名字；它只是预先填好接受对话框。在内置代理上，`announcedBy` 和 `announcedVia` 是发布其最新配置的代理登录名和客户端 id，`acceptedLogin` 是它被接受时所用的登录名。通告发生变化、或由不同登录名发出通告的已接受设备会带有 `review`：

```json
{"hash":"9a1c...","summary":["plug-0001-power: unit changed"],
 "changes":[{"key":"plug-0001-power","kind":"changed","fields":[{"field":"unit","running":"W","announced":"kW"}]}]}
```

### `GET /api/discovery/{source}/{key}`

一台设备，格式相同。HotLoop 没见过的返回 `404`。

### `POST /api/discovery/{source}/{key}/accept`

接受一台设备。可选请求体 `{"equipmentId": 12}` 会在同一步把它放入树中。不启用任何东西。返回该设备。已被忽略的返回 `400`。

### `POST /api/discovery/{source}/{key}/ignore`

丢弃该设备：它在 HotLoop 中的设备、变量和实体都会消失（历史数据保留），再次发出通告时它仍保持被忽略。返回该设备。对已发现的设备调用 `DELETE /api/devices/{id}` 效果相同，因为一台持续发出通告的设备只会再回来。

### `POST /api/discovery/{source}/{key}/unignore`

根据设备最近一次通告的内容，把被忽略的设备恢复为已发现。未被忽略时返回 `400`。

### `POST /api/discovery/{source}/{key}/review/apply`

让已接受的设备按它通告的内容运行。每个点是否已启用保持原样。没有待审核内容时返回 `400`。

### `POST /api/discovery/{source}/{key}/review/reject`

让已接受的配置继续运行，并不再提出这项更改。之后的另一项更改会再次提出。没有待处理内容时返回 `400`。

审核可能与是谁发出通告有关：带有 `"kind":"publisher"` 的更改，以及摘要行“announced by login garage-node; accepted from kitchen-node”。应用它会让该登录名成为接受该设备时所用的登录名。

## 代理登录

在 HotLoop 中创建的内置代理登录，每个都带有它可以发布和订阅的主题。参见[内置 MQTT 代理](/zh-hans/iot/broker/)。登录是整个工厂代理的钥匙，所以这些属于 `users.manage`，是管理员的权限。这里绝不会返回密码或其哈希。每项更改都会记入日志，并从客户端的下一次发布起生效；无需任何人重新连接。

### `GET /api/broker/logins`

```json
{"running":true,"anonymous":false,"prefix":"homeassistant","envLogins":["plant"],
 "profiles":[{"name":"shelly","about":"a Shelly Gen2 or later; name the login after its MQTT topic prefix",
   "publish":["%u/#","shellies/announce"],"subscribe":["%u/#","shellies/command","%p/status"]}],
 "logins":[{"name":"kitchen-node","profile":"esphome","publish":["%u/#","%p/+/%u/+/config","esphome/discover/%u"],
   "subscribe":["%u/#","%p/status","esphome/discover"],"createdBy":"admin","createdAt":"2026-10-02T09:12:04Z",
   "updatedAt":"2026-10-02T09:12:04Z","resolvedPublish":["kitchen-node/#","homeassistant/+/kitchen-node/+/config",
   "esphome/discover/kitchen-node"],"resolvedSubscribe":["kitchen-node/#","homeassistant/status","esphome/discover"]}]}
```

在本进程不运行代理的地方，`running` 为 false；登录仍会保留，代理启动时会读取它们。`envLogins` 是来自 `HOTLOOP_BROKER_USERS` 的名称，它们可以做任何事。规则中的 `%u` 是登录自己的名称，`%p` 是发现前缀；`resolved*` 是两者都已填入的规则。

### `POST /api/broker/logins`

```json
{"name":"kitchen-node","password":"a-long-random-password","profile":"esphome"}
```

`name` 是 1 到 64 个字母、数字、`-` 和 `_`（它在主题中代表 `%u`）。`password` 至少 12 个字符。`profile` 会填入规则；给出 `publish` 和 `subscribe` 时会替换它们。两者需要其一。规则是 MQTT 主题过滤器：`+` 和 `#` 只能作为完整的层级，`#` 只能在最后，绝不能是 `$` 主题。成功时返回登录并带 `201`；上述任一情况或 `HOTLOOP_BROKER_USERS` 已有的名称返回 `400`；名称已被占用返回 `409`。

### `PUT /api/broker/logins/{name}`

可以是 `profile`、`publish`、`subscribe` 和 `password` 中的任意几个；没发送的保持不变。成功时返回登录并带 `200`，不存在的返回 `404`。

### `DELETE /api/broker/logins/{name}`

`200` `{"deleted":"kitchen-node"}`。仍用它连接的客户端此后什么也做不了，也无法再次连接。不存在的返回 `404`。

## 网络发现

通过 mDNS、SSDP 和 DHCP 在工厂网络上听到的设备，以及人对每一台所做的决定。参见[网络发现](/zh-hans/iot/network-discovery/)。在从不监听的 `--mcp-stdio` 辅助进程中，`GET /api/network-discovery` 返回 `{"running":false,"finds":[]}`，其他所有路由返回 `503`。

`{key}` 表示一个发现是怎样被听到的以及由谁听到：`mdns:` 加它的 mDNS 主机名，`ssdp:` 加它的 UPnP uuid，`dhcp:` 加它的 MAC。请对它做 URL 编码。

**这些调用都不会启用任何东西**，在有人接受之前，这里不会添加任何东西。

### `GET /api/network-discovery`

监听器、探测、它们所在的接口，以及每个发现：

```json
{"running":true,
 "status":{"leading":true,"interfaces":["eth0 10.20.0.15/24"],
  "listeners":[{"name":"mdns","enabled":true,"listening":true,"heard":120,"dropped":0,"refused":0},
   {"name":"ssdp","enabled":true,"listening":true,"heard":14,"dropped":0,"refused":0},
   {"name":"dhcp","enabled":false,"listening":false,"heard":0,"dropped":0,"refused":0}],
  "probe":{"networks":[]}},
 "finds":[{"key":"mdns:line3-ua.local","via":"mdns","kind":"opcua","name":"line3-ua","status":"discovered",
  "firstSeen":"2026-10-11T14:02:11Z","lastSeen":"2026-10-11T14:07:40Z",
  "find":{"key":"mdns:line3-ua.local","via":"mdns","kind":"opcua","name":"line3-ua",
   "summary":"OPC UA server, capabilities DA","host":"line3-ua.local","addresses":["10.20.0.31"],
   "services":[{"type":"_opcua-tcp._tcp.local","instance":"line3-ua._opcua-tcp._tcp.local","port":50000,
    "txt":{"caps":"DA","path":"/"}}],
   "proposal":{"protocol":"opcua","address":"opc.tcp://10.20.0.31:50000/","how":"Accepting makes an OPC UA device..."},
   "heard":"2026-10-11T14:07:40Z"}}]}
```

`kind` 是 `esphome`、`shelly`、`opcua`、`mqtt-broker`、`web`、`mdns`（它通告了 HotLoop 没有名称的东西）、`upnp` 或 `dhcp`。`proposal` 带有 `protocol` 的发现，在接受后会成为位于 `address` 的该协议的设备；没有的则在 `how` 中说明怎样才能把它纳入。`also` 按 MAC 或地址列出属于同一台设备的其他发现和通过 MQTT 发现的设备。`status` 是 `discovered`、`accepted` 或 `ignored`，`deviceId` 是接受后创建的设备。监听器的 `error` 说明它为何没有监听（67 端口被占用或不被允许、没有多播接口）；`refused` 统计因记录已满而被丢弃的新发现。

### `GET /api/network-discovery/{key}`

一个发现，格式相同。HotLoop 没听到过的返回 `404`。

### `POST /api/network-discovery/{key}/accept`

接受一个发现。可选请求体 `{"equipmentId": 12}` 会把它创建的设备放入树中。HotLoop 有驱动的发现会成为位于所提议地址的设备，已启用，没有变量，也没有任何东西被启用；其他的只被记录为已知，不创建任何东西。返回该发现。已被接受或忽略的返回 `400`。

### `POST /api/network-discovery/{key}/ignore`

隐藏一个还没有人做决定的发现，再次听到时仍保持隐藏。已有决定的返回 `400`。

### `POST /api/network-discovery/{key}/unignore`

把被忽略的发现带回来等待决定。未被忽略时返回 `400`。

### `POST /api/network-discovery/probe`

立即探测：在网络列于 `HOTLOOP_NETDISC_PROBE_NETWORKS` 的每个接口上发出一次 mDNS 查询和一次 SSDP 搜索，其他地方不发。返回 `{"status": ...}`，未发出的内容在 `status.probe.lastError` 中。没有任何网络开启探测时返回 `400`：这个按钮无法开启它，只有部署才能。

## 集成

针对人让 HotLoop 去对接的某一类设备的配置流程：询问该集成需要什么，用答案去查看真实设备，并根据发现的内容创建设备及其变量。参见[集成](/zh-hans/iot/integrations/)。

**这里没有任何东西会启用任何东西。** 一次设置创建的每个变量都是只读的。启用它是 `POST /api/tags`，和其他所有点一样。

### `GET /api/integrations`

本构建拥有的每个集成，以及它提出的问题：

```json
[{"id":"opcua","name":"OPC UA server","description":"A PLC, CNC, gateway or SCADA server ...",
  "protocol":"opcua","addressLabel":"Endpoint","addressPlaceholder":"opc.tcp://192.168.1.20:4840","writable":true,
  "fields":[{"key":"securityMode","label":"Security","kind":"choice","required":false,"default":"None",
             "choices":[{"value":"None","label":"None"},{"value":"Sign","label":"Sign"}]},
            {"key":"password","label":"Password","kind":"secret","required":false}]}]
```

`kind` 是 `text`、`number`、`bool`、`choice` 或 `secret`。带有 `showWhen`（`{"version":["3"]}`）的字段只在另一个答案取这些值之一时才询问，对未显示的问题给出的答案会被忽略。

### `POST /api/integrations/{id}/probe`

检查答案并去查看真实设备。不保存任何东西。

```json
{"address":"opc.tcp://192.168.1.20:4840","options":{"securityMode":"None"}}
```

返回 `{"integration":"opcua","address":"opc.tcp://192.168.1.20:4840","found":{...}}`。`address` 是集成解析后的地址。`found` 包含 `name`（设备对自己的称呼）、`identity`（它自称是什么）、`notes`（接受前需要知道的事）和 `points`，每个点都是变量的形状 `{name, address, dataType, unit, description, writable, deviceClass}`，外加 `group`、`sample`（发现时读到的值）和 `suggested`。

答案与问题不符时返回 `400`，一次列出所有问题；对集成没有提出的问题给出的答案同样是 `400`，不会被忽略。设备没有应答或应答的内容不是它自己的协议时返回 `502`，并说明出了什么问题。本构建没有的集成返回 `404`。机密绝不会出现在答案或错误中。

### `POST /api/integrations/{id}/setup`

再次查看设备，然后创建它及其变量。请求体是探测所用的请求体，另外加上：

| 字段 | 含义 |
|---|---|
| `deviceId` | 新设备的 id。留空则根据名称生成。已有设备使用它时返回 `400` |
| `name` | 设备的名称。留空则取设备对自己的称呼 |
| `points` | 要设置的 `found.points` 中的名称。留空则取标为 `suggested` 的那些。设备没有的名称是 `400` |
| `site`, `area`, `line` | 它在设备树中的位置，与 `POST /api/devices` 相同 |

各点是对照设备此刻的状态来检查的，而不是对照客户端一分钟前声称发现的内容。返回 `{"device":{...},"tags":3,"entities":["sensor.plc_sim_..."],"notes":[]}`。设备已启用并在轮询，每个变量都是只读的，每个变量都有它的读取实体。中途失败的设置不会留下任何设备。

## MQTT 代理

除 HotLoop 自己的之外、发现功能所监听的代理：工厂的 Mosquitto，或 Zigbee2MQTT 盒子自带的代理。参见 [MQTT 发现](/zh-hans/iot/mqtt-discovery/#其他代理)。它们的密码用设备凭据密钥（`HOTLOOP_SECRET_KEY_FILE`）加封，绝不会返回；`passwordSet` 说明是否存有密码，`passwordProblem` 说明已存的密码为何无法打开。每项更改都会记入日志并立即生效：该代理的监听器和来自它的设备会重新连接。

### `GET /api/mqtt/brokers`

```json
{"secretKey":true,
 "brokers":[{"id":"plant-uns","name":"Plant UNS","broker":"tcp://10.20.0.5:1883","username":"hotloop","useTls":false,
   "insecureSkipVerify":false,"prefix":"homeassistant","listenOnly":true,"autoCreate":false,"tasmota":true,"shelly":true,"enabled":true,
   "createdBy":"admin","passwordSet":true,"createdAt":"2026-10-03T09:12:04Z","updatedAt":"2026-10-03T09:12:04Z"}]}
```

`secretKey` 表示这个 HotLoop 是否有可用来加封密码的密钥。

### `POST /api/mqtt/brokers`

```json
{"id":"plant-uns","name":"Plant UNS","broker":"tcp://10.20.0.5:1883","username":"hotloop",
 "password":"...","listenOnly":true}
```

`id` 是 1 到 63 个小写字母、数字和 `-`，不能是 `embedded`：它在来自该代理的每台设备中给代理命名，且不能更改。`broker` 是 `host:port` 或以 `tcp://`、`ssl://`、`tls://`、`mqtt://`、`mqtts://` 开头的 URL，其中不含登录。`prefix` 默认是 `homeassistant`；`autoCreate` 默认 false（设备在收件箱里等待）；`listenOnly` 默认 false；`tasmota`（同时监听 Tasmota 自己的发现 `tasmota/discovery/#`）默认 true；`shelly`（根据 Shelly Gen2 及更新设备发布的 `<prefix>/status/<component>` 主题来识别它们）默认 true；`enabled` 默认 true。密码需要用户名和密钥：没有 `HOTLOOP_SECRET_KEY_FILE` 时返回 `400`，绝不以明文存储。成功时返回代理并带 `201`；id 已被占用返回 `409`。

### `PUT /api/mqtt/brokers/{id}`

除 `id` 外的上述任意字段；没发送的保持不变。`"password":""` 会清除密码。返回代理并带 `200`。

### `DELETE /api/mqtt/brokers/{id}`

移除该代理，以及它通告过但无人接受的内容：收件箱，以及它自己创建的任何设备。只要仍有从它接受的设备存在，就返回 `409` 并指出它们：请先忽略或删除这些设备，或者改用 `"enabled":false` 关闭该代理。`200` `{"deleted":"plant-uns"}`。

## 变量

### `GET /api/tags`

| 查询 | <span class="sr-only">详细信息</span> |
|---|---|
| `device` | 仅该设备的变量。没有 `limit` 时返回全部 |
| `q` | 搜索：设备 id、变量名或描述中包含的子串，不区分大小写。可与 `device` 一起使用 |
| `limit` | 1 到 5000 的整数。没有 `device` 时默认 500。其他任何值，包括 5001，都返回 `400`：会被拒绝，而不会悄悄少返回（4.19.5 及之前，超过 1000 的限制会被悄悄改成 200） |
| `writable` | `true` 表示只要标为可写的变量（写入选择器提供的那些） |
| `offset` | 分页的起点，0 或更大。变量按设备排序，再按名称排序 |

响应的 `X-Total-Count` 头给出一共匹配多少个变量，所以客户端用 `offset` 翻页直到取全，并且知道自己已取全。空响应是 `[]`。

```json
[{"id":5,"deviceId":"tank-farm","name":"level_sp","address":"mqtt:docs-api-example/level_sp","dataType":"float","unit":"%","enabled":true,"writable":true,"maxValue":95,"hasRange":true,"scale":1,"createdAt":"2026-09-27T20:21:39.405164Z","updatedAt":"2026-09-27T20:21:39.405164Z"}]
```

### `POST /api/tags`

如果 `deviceId` 和 `name` 是新的就创建变量，否则替换它。

| 字段 | 类型 | <span class="sr-only">详细信息</span> |
|---|---|---|
| `deviceId` | string | 必填。设备必须存在（不存在则返回 `404`） |
| `name` | string | 必填。不含控制字符 |
| `address` | string | 必填。协议自己的地址 |
| `dataType` | string | `bool`、`int`、`float` 或 `string`（以及常见别名：`int16`、`word`、`coil` 等）。决定写入如何编码 |
| `unit`, `description` | string | |
| `enabled` | bool | 省略时为 `false` |
| `writable` | bool | **从所有途径（界面、自动化、实体、MCP）启用该变量的写入。** 省略时为 `false` |
| `hasRange`, `minValue`, `maxValue` | bool, number, number | 设置了 `hasRange` 时，超出范围的写入会被拒绝（绝不截断） |
| `scale`, `offset` | number | 工程值 = 原始值 x 比例 + 偏移。比例为 0 时按 1 处理 |
| `noData` | list | 表示“没有测量值”的原始值，每项是 `{"raw", "reason"}`。`raw` 是字符串（`"0x8005"`、`"-32763"`）或裸数字，并以字符串形式返回。原始值在该列表中的读数，质量为坏并带该 `reason`，在 `scale` 和 `offset` 之前检查。最多 32 个代码。不是整数、被列出两次或不可能是该点类型的代码返回 `400`。每种类型该怎么写以及 Yokogawa DX 的示例，参见[协议与驱动](/zh-hans/iot/protocols/#no-data-values) |
| `deadband`, `deadbandPercent` | number | 小于该值的变化不会写入历史数据 |
| `deviceClass` | string | 变量的实体起始所用的类别（`power`、`connectivity`、`temperature` 等），在对其领域有意义时使用。创建变量时采用，替换时忽略：此后类别归实体所有，请在那里修改 |

返回已保存的变量。用 `writable: true` 保存会如实记入日志：启用变量是一项安全决定，会记下是谁做的。变量的实体在响应之前就已创建或更新，所以客户端可以立即请求它们。

尚无人接受的已发现设备上的变量不能被启用：返回 `400`，“accept the device first”。参见 [MQTT 发现](/zh-hans/iot/mqtt-discovery/#命令)。

### `DELETE /api/tags/{device}/{name}`

`{"deleted":"tank-farm/level"}`，或 `404`。历史数据保留。变量的实体变成孤儿（参见[实体](/zh-hans/iot/entities/#deleted-tags-orphans-and-re-adoption)）。

## 值、看板和写入

### `GET /api/values`

每个变量的最新读数，来自内存。`?device=` 把范围缩小到一台设备。

```json
[{"deviceId":"extruder-1","protocol":"opcua","tagName":"Temperature","tagValue":20.645294745260895,"unit":"C","quality":"good","timestamp":"2026-09-27T20:21:58.255722Z"}]
```

这个格式就是 EmberNet 仪表板的 `TagValue`，是一项约定。`quality` 是 `good`、`uncertain` 或 `bad`；**坏的读数表示值未知，而不是零**。字符串读数带有 `stringVal`，它的 `tagValue` 没有意义。

不好的读数在驱动知道原因时带有 `reason`，这样界面能说出比“坏”更多的内容：

```json
{"deviceId":"meter-01","protocol":"http","tagName":"power","tagValue":0,"quality":"bad","timestamp":"2026-09-30T09:12:04.51Z","reason":"no field at ENERGY.Power"}
```

好的读数永远没有它，所以上面的约定逐字节与以前一致。历史数据库不保存它：`/api/history` 有质量，没有原因。

### `GET /api/sparkline`

内存中保留的某个变量的最近读数（`HOTLOOP_RING_SIZE`，默认 30），用于小图表。`?tag=device/tag`，必填。

```json
{"tag":"extruder-1/Temperature","timestamps":[1790540498609,1790540499246,1790540500246],"values":[0,20.06524581530632,19.933308705395785]}
```

`timestamps` 是 Unix 毫秒。对没有读数的变量，两者都是 `[]`。键格式错误时返回 `400`。

### `GET /api/board`

哪些变量固定在看板上，以及分几列。它存在数据库中而不是浏览器里，因为看板属于工厂：现场的面板 PC 和办公室的笔记本电脑显示的是同一个。

```json
{"columns":2,"tags":["extruder-1/Temperature","tank-farm/level"],"rev":"9f2c41b07a6d3e58"}
```

`rev` 是已存储看板的标识。保存时把它发回来，如果看板此后已变化，保存会被拒绝（见下文）。

### `PUT /api/board`

格式相同。`columns` 超出 1 到 4 时变为 3；重复项会被去掉。`rev` 可选：带上您所读取看板的 `rev`，对此后已变化的看板保存会返回 `409` 且不改变任何东西，所以从未读取过看板、或读取的是旧看板的页面，无法用自己的副本替换工厂的看板。省略它则不检查保存，适合每次都设置整个看板的客户端。Web 界面启动时读取看板，并在每次保存时发送 `rev`。每个变量都必须存在（返回 `404` 并指出不存在的那个）：陈旧的条目是一个永远不动的仪表。返回已存储的看板。operator 拥有 `board.write`：整理看板是在运行工厂，而不是配置它。

### `POST /api/write`

通过写入门向一个变量写入一个值。

| 字段 | 类型 | <span class="sr-only">详细信息</span> |
|---|---|---|
| `tag` | string | 必填。`device/tag` |
| `value` | bool, number or string | 必填。`true` 是布尔值，`42` 是整数，`42.5` 是浮点数，`"42"` 是字符串：JSON 类型就是写入的类型，因为线圈、字和实数在线路上是三种不同的东西 |
| `reason` | string | 可选。随写入一起记入日志 |

```json
{"tag":"tank-farm/level_sp","written":"72.5"}
```

**值使用变量的单位，与读数一样。** 对于带比例或偏移的变量，您发送的是变量读回时的值，HotLoop 会把能得到该值的计数发给设备：在比例为 0.1 的寄存器上写 55.5，寄存器里放进 555。（4.18 及之前，数字原样发给设备，所以 55.5 变成 55，读回来是 5.5。）范围检查和审计行使用您的数字，单位是变量的单位。之后装不进寄存器的计数，比如比例为 0.1 的 `uint16` 上写 7000，会被拒绝，并指明计数和寄存器，不会发送任何东西。计数的小数部分会被截去，整数计数寄存器一直如此：在十分之一比例的寄存器上写 12.34，存下的是 12.3。

写入门按顺序检查：写入已开启（`HOTLOOP_ALLOW_WRITES`），变量已启用，值在范围内。每一次尝试，无论是否被拒绝，都在 `GET /api/writes` 中。

| 状态 | 何时 |
|---|---|
| 400 | 没有值、值为 `null`、键格式错误 |
| 403 | 写入已关闭，或 `"tank-farm/level: this tag is not marked writable"` |
| 404 | 没有这个变量 |
| 422 | `"value is outside the tag's configured range: 120 is outside 0..95"` |
| 503 | 设备未连接 |

## 历史与审计

### `GET /api/history`

| 查询 | <span class="sr-only">详细信息</span> |
|---|---|
| `tag` | 必填，可重复，最多 50 个：`?tag=a/x&tag=b/y` |
| `minutes` | 从现在往回多久。默认 60 |
| `bucket` | 以秒为单位的桶大小。默认：按使窗口约有 400 个桶来选取，在 1 秒到 1 天的档位中 |
| `raw` | `true` 表示返回读数本身而不是桶 |
| `limit` | 默认 5000，最大 100000 |
| `carry` | `true` 表示同时给出窗口开始时每个变量保持的值（仅限桶） |

按桶返回，每个变量最旧的在前。`badCount` 是桶中质量不好的读数个数；它们被单独计数，不计入平均。`from` 和 `to` 是该响应对应的窗口，两者恰好相差 `minutes`，并在提问的时刻结束：

```json
{"buckets":[{"deviceId":"extruder-1","tagName":"Temperature","bucket":"2026-09-27T20:21:00Z","avg":18.986210570239944,"min":0,"max":20.83008050535897,"first":0,"last":20.83008050535897,"count":22,"badCount":1}],"from":"2026-09-27T19:22:00Z","raw":false,"to":"2026-09-27T20:22:00Z"}
```

历史数据库在值越过死区时保存读数，而不是每次轮询都保存，所以一直没变的变量在窗口内没有可画的东西。带 `carry=true` 时，响应还有 `"carry":[{"deviceId":"extruder-1","tagName":"Temperature","ts":"2026-09-27T16:40:12Z","value":21.4}]`：对于 `from` 之前最后一次读数良好且带有数字的每个变量，给出这最后一次读数。最后一次读数为坏或不确定的、没有更早读数的、或是文本的变量没有条目，因为它保持的值未知，我们不会给图表一个猜测。趋势卡片据此绘制。

原始数据，最新的在前：

```json
{"raw":true,"readings":[{"deviceId":"extruder-1","protocol":"","tagName":"Temperature","tagValue":21.021559879601448,"quality":"good","timestamp":"2026-09-27T20:22:00.267463Z"}]}
```

没有 `tag`、超过 50 个或键格式错误时返回 `400`。

### `GET /api/writes`

写入审计，最新的在前。每一次尝试都在这里，包括被拒绝的，因为“我们不知道那条命令有没有发出去”是工厂能得到的最糟的答案。

| 查询 | <span class="sr-only">详细信息</span> |
|---|---|
| `tag` | 一个变量，`device/tag` |
| `device` | 一台设备的所有变量（设置了 `tag` 时忽略） |
| `entity` | 针对该实体的服务调用所做或被拒绝的每一次写入，取代上述条件 |
| `call` | 一次调用的每一次写入，取代上述所有条件：按钮的按下和释放，或配方应用的每个目标，它们共用同一个 `call_id` |
| `limit` | 默认 100，最大 5000 |

```json
[{"id":2,"at":"2026-09-27T20:22:01.04226Z","deviceId":"tank-farm","tagName":"level_sp","value":"120","prior":"0 %","actor":"admin","source":"ui","succeeded":false,"error":"refused: value is outside the tag's configured range: 120 is outside 0..95"},
 {"id":4,"at":"2026-09-27T20:23:03.276962Z","deviceId":"tank-farm","tagName":"pump","value":"true","prior":"0","actor":"admin","source":"ui","succeeded":true,"latencyMs":0.317,"entityId":"switch.tank_farm_pump","service":"switch.turn_on","callId":"5c9f8545a93b5443"}]
```

`source` 是 `ui`、`api`、`automation` 或 `mcp`。`entityId`、`service` 和 `callId` 只出现在服务调用所做的写入上。

## 实体与状态

每个变量都会自动得到实体，无需有人请求；复合实体（电机、阀门、回路、计数器、选择器、按钮、气象站）由管理员用变量构建。与所有实体端点一样使用 snake_case。完整模型见[实体](/zh-hans/iot/entities/)。

### `GET /api/entities`

每个实体，包括孤儿实体。

| 查询 | <span class="sr-only">详细信息</span> |
|---|---|
| `domain` | `sensor`、`switch`、`motor` 等 |
| `device` | 一台设备上的实体 |
| `orphaned` | `true` 表示只要孤儿实体，`false` 表示不要 |
| `q`, `limit` | 搜索：实体 id、名称或设备 id 中包含的子串，不区分大小写，并按实体 id 排序，最多返回 `limit` 个（1 到 5000，其他值返回 `400`，绝不悄悄截断）。`X-Total-Count` 是匹配的个数。省略时返回完整列表 |

```json
[{"id":5,"entity_id":"switch.tank_farm_pump","unique_id":"tag-control:tank-farm/pump","domain":"switch","platform":"tag","name":"pump","device_id":"tank-farm","options":{},"disabled":false,"hidden":false,"created_at":"2026-09-27T20:21:39.153197Z","updated_at":"2026-09-27T20:21:39.153197Z","bindings":[{"role":"command","device_id":"tank-farm","tag_name":"pump"},{"role":"state","device_id":"tank-farm","tag_name":"pump"}],"equipment_id":null,"area_id":4,"labels":[]}]
```

### `GET /api/entities/composites`

`POST /api/entities` 能创建什么：每个域、其变量所绑定的角色，以及它接受的服务。角色会说明变量的 `kind`、是否 `required`、是否有服务写入它（`command`），以及状态是否从它读取（`feedback`）。气象站不接受任何服务。

```json
{"domains":[{"domain":"weather","roles":[{"role":"temperature","kind":"number","required":true,"command":false,"feedback":true},{"role":"humidity","kind":"number","required":false,"command":false,"feedback":true}],"services":[]}]}
```

### `GET /api/entities/{entity_id}`

`{"entity": {...}, "state": {...}}`。已禁用的实体，`state` 为 `null`。未知的返回 `404`。

### `GET /api/entities/{entity_id}/image`

摄像头或图像的最新图片，以 HotLoop 保存的字节原样返回：`Content-Type` 就是它们的实际类型（`image/jpeg`、`image/png`、`image/gif` 或 `image/webp`），并带有 `X-Content-Type-Options: nosniff`、沙箱用的 `Content-Security-Policy` 和 `ETag`（`If-None-Match` 得到 `304`）。不是此类的实体，或图片尚未到达时返回 `404`。状态的 `entity_picture` 属性就是这个路径加上图片的哈希。

### `PUT /api/entities/{entity_id}`

只修改您发送的字段。仅限管理员：entity_id 是每个自动化、仪表板和代理引用该实体所用的名称，修改它属于配置。

| 字段 | 类型 | <span class="sr-only">详细信息</span> |
|---|---|---|
| `entity_id` | string | 重命名。`unique_id` 不会改变 |
| `name`, `icon`, `device_class`, `state_class`, `unit_of_measurement`, `entity_category` | string | |
| `options` | object | 按域而定；参见[实体](/zh-hans/iot/entities/#api) |
| `disabled`, `hidden` | bool | 已禁用的实体没有状态，也不能被下发命令 |
| `equipment_id` | int or null | 把它放在设备树上；`null` 则重新跟随它的设备 |
| `labels` | string[] | 整个集合 |

`unique_id`、`domain`、`platform`、设备和绑定不能在这里更改，发送它们会返回 400。

```json
{"entity":{"id":3,"entity_id":"sensor.tank_1_level","name":"Tank 1 level","device_class":"moisture","icon":"mdi:water-percent","...":"..."},"warnings":[]}
```

`warnings` 说明某件事合法但奇怪（设备类别通常没有的单位）。请求体为空（`"the update names no field to change"`）或值不对时返回 `400`，实体未知返回 `404`，entity_id 已被占用返回 `409`。

### `POST /api/entities`

创建复合实体。请求体给出域，并把变量绑定到它的角色上：

```json
{"name":"Transfer pump","domain":"motor","bindings":[{"role":"run_command","device_id":"tank-farm","tag_name":"pump"},{"role":"running","device_id":"tank-farm","tag_name":"pump"}]}
```

还可以有 `entity_id`（否则根据名称生成）、`device_class`、`unit_of_measurement`、`icon`、`entity_category` 和 `options`。每个域接受哪些角色和选项见[实体](/zh-hans/iot/entities/#composite-equipment)。返回 `201` `{"entity": {...}, "warnings": [...]}`。不在这里创建的域（`sensor` 来自它的变量，`alarm` 来自它的定义）、缺少的角色或无法填充它的变量返回 `400`，entity_id 已被占用返回 `409`。

### `DELETE /api/entities/{entity_id}`

删除复合实体，或变量、报警定义已不存在的孤儿实体。`{"deleted":"motor.transfer_pump","entity":{...}}`。其他任何实体返回 `409`，并说明它该怎样才会消失：

```json
{"error":"this entity cannot be deleted: sensor.tank_1_level is kept in step with its tag; delete the tag, and then this orphan, or hide or disable it: already exists"}
```

### `GET /api/states`

每个已启用实体的状态，按 entity_id 排序。`?domain=` 进行过滤。

```json
[{"entity_id":"number.tank_farm_level_sp","state":"unknown","attributes":{"armed":true,"friendly_name":"level_sp","max":95,"min":0,"source":["tank-farm/level_sp"],"unit_of_measurement":"%"},"quality":"bad","last_changed":"2026-09-27T20:21:39.417193755Z","last_updated":"2026-09-27T20:21:39.417193755Z","last_reported":"2026-09-27T20:22:04.423849496Z"}]
```

`state` 永远是字符串，即使是数字；`unknown` 和 `unavailable` 的意思就是字面意思。`last_reported` 是它背后读数的设备时间戳。

### `GET /api/states/{entity_id}`

一个状态。实体未知时返回 `404`，已禁用的实体返回另一种 `404`，其中说明如何启用它：已禁用的实体并不是不存在，把它报告为不存在会让人去找一个根本没有的笔误。

## 能源

工厂用了什么以及花了多少：千瓦时、燃气、水、压缩空气，以及生产一个单位的成本。仪表是作为用量来读取的变量。完整模型、电价和界面的行为见[能源](/zh-hans/iot/energy/)。读取是 `energy.read`，每个角色都有；创建或修改仪表或电价是 `energy.write`，属于管理员。

### `GET /api/energy/meters`

每块仪表，先按类型再按名称排序，每块带有读取方式和今天的用量。

```json
[{"id":"main","name":"Main panel","kind":"electricity","mode":"counter","source":{"device_id":"pm-01","tag_name":"kWh"},"unit":"kWh","factor":0.001,"tariff":{"currency":"USD","price":0.12,"bands":[{"from":"22:00","to":"06:00","price":0.07}]},"enabled":true,"status":{"state":"ok","last_read_at":"2026-11-19T21:15:00Z","resets":0,"gap_seconds":0},"today":{"value":412.6,"cost":49.51,"covered_seconds":43200,"estimated":false}}]
```

`status.state` 是 `ok`、`waiting`（还没有从变量读到任何东西）、`bad`（变量的读数不好，`reason` 说明原因）或 `disabled`。

### `POST /api/energy/meters`

创建一块仪表。`id` 是小写字母、数字、`-` 和 `_`。`kind` 是 `electricity`、`gas`、`water`、`air`、`heat` 或 `production`。`mode` 是 `counter`（累计变量：用量是它前进了多少，乘以 `factor`）或 `power`（速率：用量是速率乘以它保持的时间，`power_unit` 为 `W`、`kW` 或 `MW`，`unit` 为 `Wh`、`kWh` 或 `MWh`）。`source` 是变量。`tariff` 是每单位固定的 `price`，带可选的 `currency`，以及用于分时电价的可选 `bands`（以一刻钟为单位的 `from` 和 `to`、`days`、`price`）；生产仪表没有。单位为 `Wh`、`kWh` 或 `MWh` 的电力仪表还可以在电价中有 `demand_price`：它在一个窗口内最高那一刻钟的每千瓦费用。省略 `enabled` 则为 `true`。返回 `201` 和 `{"meter": {...}, "warnings": []}`。出错时返回 `400` 并说明问题：变量不存在或不是数字、某个时段不在一刻钟边界上、功率仪表带有系数。id 已被占用返回 `409`。

### `GET /api/energy/meters/{id}`

一块仪表，与列表中显示的一致。未知的返回 `404`。

### `PUT /api/energy/meters/{id}`

替换仪表的定义。它已经计的数会保留，并保持当时的价格。把它指向另一个变量或模式，会忘记上一次读数停在哪里，因为下一次读数是另一样东西。

### `DELETE /api/energy/meters/{id}`

删除一块仪表及它计的所有数。未知的返回 `404`。

### `GET /api/energy/summary`

每块仪表在一个窗口内的用量和成本，以及生产一个单位的成本。窗口由 `?period=` 给出（`today`、`yesterday`、`this_week`、`last_week`、`this_month`、`last_month`、`last_7_days`、`last_30_days`，或写成 `shift:06:00-14:00` 的班次表示最近开始的那一班，`last_shift:06:00-14:00` 表示再前一班；日、月和班次以站点为准），或用 RFC 3339 的 `?from=&to=`，包含 from 不包含 to，最长 400 天。`meters` 是成本计入单位成本的仪表的逗号分隔列表，`per` 指定用来相除的那一块生产仪表。

```json
{"period":"today","from":"2026-11-19T05:00:00Z","to":"2026-11-20T05:00:00Z",
 "meters":[{"id":"main","name":"Main panel","kind":"electricity","unit":"kWh","currency":"USD","value":412.6,"cost":49.51,"covered_seconds":43200,"coverage":1,"estimated":false}],
 "costs":[{"currency":"USD","cost":49.51}],
 "per_unit":[{"production":"parts","units":9800,"currency":"USD","cost":49.51,"cost_per_unit":0.00505}]}
```

`coverage` 是到目前为止窗口中有读数支撑的比例。两种货币的成本永远不会相加，所以每种货币有一行 `per_unit`。当什么都没生产时（`reason` 为 `nothing_made`），或生产了东西而没有带价格的仪表计到用量时（`nothing_counted`），`cost_per_unit` 为 `null`：这表示没有答案，而不是零。

带 `demand_price` 的仪表，其行中有 `demand`：`peak_kw`（窗口内最高的一刻钟，以其平均千瓦数表示）、`peak_at`（它何时开始）、`peak_covered_seconds`（那一刻钟中有多少被读到；低于 900 时峰值被低估）和 `cost`（峰值乘以价格）。该行的 `cost` 仍是电量的成本；`costs` 和 `per_unit` 包含需量电费。

### `GET /api/energy/summary/{period}`

与汇总相同，针对路径中给出的一个命名周期（或班次）。`meters` 和 `per` 仍放在查询中。

### `GET /api/energy/series`

一块仪表在一个窗口内的用量，`?meter=<id>`，窗口同上，以及 `step`：`quarter`（最长 8 天）、`hour`（默认）、`day` 或 `month`。没有读数的步长不在列表中。

```json
{"meter":"main","unit":"kWh","currency":"USD","step":"day","points":[{"start":"2026-11-19T05:00:00Z","value":412.6,"cost":49.51,"estimated":false}]}
```

### `GET /api/energy/series/{meter}/{period}/{step}`

与序列相同，仪表、命名周期和步长都在路径里，供只能提供路径的调用方使用。

## 服务

### `POST /api/services/{domain}/{service}`

向一个实体下发命令：`switch/turn_on`、`number/set_value`、`motor/start`、`alarm/acknowledge`。一个实体，一个服务，一次调用。其底层只是通过与 `POST /api/write` 相同的写入门进行变量写入。

```json
{"entity_id":"switch.tank_farm_pump","reason":"start of shift"}
```

`entity_id` 必填，且是一个实体，而不是列表；`reason` 可选；其他一切都是服务的数据（`value`、`option`、`position`、`mode`、`minutes`、`note`）。数字保持输入时的类型。路径中的域必须是该实体的域。每个服务及其数据见[实体](/zh-hans/iot/entities/#what-each-domain-takes)。

```json
{"call_id":"5c9f8545a93b5443","entity_id":"switch.tank_farm_pump","service":"switch.turn_on","writes":[{"tag":"tank-farm/pump","value":"true","status":"written"}]}
```

每次写入是 `written`、`not_sent`（在到达设备前被拒绝）、`failed`（已发出，设备报告了错误，因此不知道是否生效）或 `skipped`（调用中较早的一次写入没有成功）。已经完成的写入绝不会回滚。报警实体的服务不写入任何变量，并返回引擎留下的 `alarm`。辅助量的服务同样不写入任何变量，并返回它们留下的 `state`：

```json
{"call_id":"0f3c2a1b9d8e7f60","entity_id":"input_number.batch_target","service":"input_number.set_value","writes":[],"state":"1250"}
```

脚本的 `turn_on` 会运行它，数据作为它的字段，并返回它启动的 `script_run`；它各步骤的写入作为 `script:<id>` 逐条审计，而不是在这里。`turn_off` 会停止它的所有运行。参见[脚本](#脚本)。

场景的 `turn_on` 会应用它的配方，使用数据中的 `params` 和 `version`，并返回完整的 `recipe_application`，以及 `writes` 中各目标所做的每一次写入，按顺序排列。除非每个目标都写入了，否则它会失败。参见[配方](#配方)。

失败的调用以错误的状态和相同的请求体外加 `error` 作答，这样可以准确看到它停在哪里：

```json
{"error":"value is outside the tag's configured range: 150 is outside 0..95","call_id":"3cd42f8275e5765e","entity_id":"number.tank_farm_level_sp","service":"number.set_value","writes":[{"tag":"tank-farm/level_sp","value":"150","status":"not_sent","error":"value is outside the tag's configured range: 150 is outside 0..95"}]}
```

| 状态 | 何时 |
|---|---|
| 400 | 没有 `entity_id`、域不对、服务未知、服务不接受的数据 |
| 403 | 权限，或写入门按策略拒绝 |
| 404 | 没有这个实体 |
| 409 | 没有已知状态的切换、设备所处状态不适用于该服务 |
| 422 | 因值本身被拒绝 |
| 503 | 设备未连接；报警引擎没有运行 |
| 500 | 按钮的按下已发出而释放没有。**变量可能仍保持按下的值**：请检查并手动释放 |

**`?dry_run=true`** 询问这次调用会做什么，而不做其中任何事：不写入、不审计、不记日志。调用会像真实调用一样被规划，每次写入都会立刻按相同顺序接受写入门自己的检查。结论以 200 作答，无论是否被拒绝：每次写入是 `would_write`，或第一个会被拒绝的是带原因的 `not_sent`，其余是 `skipped`，而 `error` 是真实调用会失败时的错误，一字不差。

```json
{"dry_run":true,"error":"value is outside the tag's configured range: 150 is outside 0..95","entity_id":"number.tank_farm_level_sp","service":"number.set_value","writes":[{"tag":"tank-farm/level_sp","value":"150","status":"not_sent","error":"value is outside the tag's configured range: 150 is outside 0..95"}]}
```

真实调用会在任何检查之前就拒绝的请求（没有这个实体、服务未知、服务不接受的数据、没有已知状态的切换），会以真实调用的状态和错误作答；缺少权限时同样如此。`dry_run` 只能是 `true` 或 `false`，别无其他：`yes` 是 400，而不是猜测，因为猜错会把一个问题变成一条命令。参见[实体](/zh-hans/iot/entities/#asking-first-the-dry-run)。

**为什么权限在处理程序中检查。** 它需要 `values.write`，与直接写入变量相同，因为它本来就只是这样；`alarm` 实体的服务改为需要 `alarms.ack`，与报警界面相同，辅助量的服务需要 operator 拥有的 `helpers.write`，脚本的服务需要 `scripts.run`，与 `POST /api/scripts/{id}/run` 相同，场景的服务需要 `recipes.apply`，以及配方指定时配方自己的权限，与 `POST /api/recipes/{id}/apply` 相同。检查放在处理程序内部而不是前面，是为了让因缺少权限而被拒绝的请求也被送到写入门，并像其他所有拒绝一样，连同被请求的值一起**按实体被审计**。没有权限的用户会得到 403 和 `GET /api/writes?entity=...` 中的一行，而不是只有 403 而什么也没有。辅助量不写入任何变量，所以辅助量的拒绝（包括这一次）改为针对该辅助量记入系统日志（`GET /api/events`）的一条警告，脚本也一样。场景的拒绝是配方历史中带有用户的一次被拒绝的应用。

## 辅助项

不属于 PLC、而属于工厂里的人的值：`input_boolean`、`input_number`、`input_select`、`input_text`、`input_counter`、`timer` 和 `schedule`。辅助项是一个实体（平台为 `helper`），与其他实体一样出现在 `/api/entities` 和 `/api/states` 中；下面这些路由是它的配置。它的值通过上面的服务设置，需要 `helpers.write`。所有域、选项和服务都在[辅助项](/zh-hans/iot/helpers/)中。

### `GET /api/helpers`

所有辅助项，每个都带有其实体的字段和 `value`（为它保存的那一行）：

```json
[{"id":41,"entity_id":"timer.purge","unique_id":"helper:6f1d...","domain":"timer","platform":"helper","name":"Purge","options":{"duration_sec":600},"...":"...","value":{"state":"active","finishes_at":"2026-09-27T21:10:00Z","duration_ms":600000,"changed_at":"2026-09-27T21:00:00Z","changed_by":"otto","source":"ui","call_id":"9a1b...","rev":4}}]
```

### `POST /api/helpers`

以初始值创建一个辅助项。仅限管理员。

```json
{"name":"Batch target","domain":"input_number","unit_of_measurement":"kg","options":{"min":0,"max":5000,"step":50,"initial":1000}}
```

还可以带 `entity_id`（省略则由名称生成）和 `icon`。返回 `201` `{"helper": {...}}`。域不属于辅助项、域不接受的选项，或其自身选项会拒绝的 `initial`，返回 `400`；entity_id 已被占用，返回 `409`。

### `GET /api/helpers/{entity_id}`

一个辅助项，与列表中的相同。实体未知或不是辅助项，返回 `404`。

### `PUT /api/helpers/{entity_id}`

修改它的 `name`、`icon`、`unit_of_measurement`、`options`、`disabled`、`hidden`、`entity_id`、`equipment_id` 或 `labels`，字段与 `PUT /api/entities/{entity_id}` 相同。仅限管理员。新选项若不允许它当前持有的值（范围收窄到值以下、选中的选项被移除），返回 `400`：值绝不会为了迁就选项而被移动。返回 `{"helper": {...}, "warnings": []}`。

### `DELETE /api/helpers/{entity_id}`

删除辅助项及其值。仅限管理员。`{"deleted":"timer.purge"}`。`DELETE /api/entities/{entity_id}` 会拒绝辅助项，返回指向这里的 `409`。

## 设备与标签

ISA-95 树（企业、站点、区域、产线、单元、设备单元、设备）以及自由格式的标签。使用 snake_case。所有角色都可读取；只有管理员可以修改，因为重命名或移动一个节点会重写其下每台设备的站点、区域和产线。参见[设备树与标签](/zh-hans/iot/equipment/)。

### `GET /api/equipment`

所有节点，按 id 排序，每个都带有从根开始的名称路径 `path`。`?level=area` 用于筛选。`?q=` 保留路径中包含该文本的节点（不区分大小写），`?limit=`（1 到 5000，其他值为 `400`）保留其中靠前的节点；使用其中任何一个时，`X-Total-Count` 是匹配的数量。

```json
[{"id":4,"parent_id":1,"level":"area","name":"Utilities","created_at":"2026-09-27T20:21:01.637319Z","updated_at":"2026-09-27T20:21:01.637319Z","path":["Demo Plant","Utilities"]}]
```

### `POST /api/equipment`

```json
{"parent_id":3,"level":"cell","name":"Die head","description":"Die and screen changer"}
```

`parent_id` 为 null 或省略则创建根节点。子节点的层级必须低于其父节点（设备可以放在设备之内）。返回 `{"equipment": {...}, "devices_rewritten": []}`。层级或位置不对，返回 `400`；已有同级、同名的节点，返回 `409`。

### `GET /api/equipment/{id}`

该节点、它正下方的节点，以及直接放在它上面的设备和实体：

```json
{"children":[],"devices":["extruder-1"],"entities":[],"equipment":{"id":3,"parent_id":2,"level":"line","name":"Line 1","...":"...","path":["Demo Plant","Extrusion","Line 1"]}}
```

id 不是正数，返回 `400`；id 未知，返回 `404`。

### `PUT /api/equipment/{id}`

`name`、`description`、`level`、`parent_id` 中的任意几项（`null` 把它移到根）。只有发送的字段会改变；空请求体为 400。返回该节点，以及**因此站点、区域或产线文本发生变化的每台设备**，因为旧客户端和 MCP 工具读取的正是这段文本：

```json
{"devices_rewritten":["tank-farm"],"equipment":{"id":4,"parent_id":1,"level":"area","name":"Utilities East","...":"..."}}
```

### `DELETE /api/equipment/{id}`

`{"deleted":5}`。只要其下或其上还有东西，就返回 `409` 并说明是什么：把节点从设备脚下删掉，不是可以随手做出的决定。

### `GET /api/labels`

```json
[{"label_id":"critical","name":"Critical","color":"red","icon":"mdi:alert","description":"Stops the line if it fails","created_at":"2026-09-27T20:24:29.659126Z","updated_at":"2026-09-27T20:24:29.659126Z"}]
```

### `POST /api/labels`

`name` 必填；`label_id`（1 到 64 个小写字母、数字和下划线）省略时由名称生成，此后永不改变。`color`、`icon`（`mdi:...`）和 `description` 可选。返回该标签。名称或 id 已被占用，返回 `409`。

### `GET /api/labels/{label_id}`

`{"label": {...}, "devices": ["tank-farm"], "entities": []}`：该标签以及带有它的对象。未知标签返回 `404`。

### `PUT /api/labels/{label_id}`

替换 `name`、`color`、`icon` 和 `description`；省略的字段会被清空。请求体中的 `label_id` 必须与路径一致，否则返回 `400`，因为 label_id 永不改变。

### `DELETE /api/labels/{label_id}`

把它从所有带有它的对象上移除。`{"deleted":"critical"}`，或 `404`。

### `PUT /api/devices/{id}/labels`

`{"labels": ["critical"]}` 替换设备上的整个标签集合。返回 `{"id":"tank-farm","labels":["critical"]}`。每个标签都必须存在（`400` 并列出缺少的标签名称），设备也必须存在（`404`）。标签有意不属于 `POST /api/devices`：每个保存设备的客户端发送的都是不含标签的完整设备，每次保存都会把标签清掉。

## 报警

ISA-18.2：触发、确认和恢复正常是三件不同的事，日志能分清发生的是哪一件。

### `GET /api/alarms`

所有定义、当前报警和汇总。`?outstanding=true` 会略去正常的和被静音的报警。

```json
{
  "alarms": [{"definitionId":"extruder-temp-hi","name":"Extruder temperature high","deviceId":"extruder-1","tagName":"Temperature","priority":2,"state":"unack-active","message":"extruder-1/Temperature at 22.80197037650447 C, limit 5","tripValue":22.80197037650447,"raisedAt":"2026-09-27T20:25:19.67042816Z","count":1,"updatedAt":"2026-09-27T20:25:19.67042816Z"}],
  "definitions": [{"id":"extruder-temp-hi","name":"Extruder temperature high","deviceId":"extruder-1","tagName":"Temperature","condition":"hi","limit":5,"priority":2,"enabled":true,"deadband":0.5,"message":"{device}/{tag} at {value}, limit {limit}","createdAt":"2026-09-27T20:25:19.055658Z","updatedAt":"2026-09-27T20:25:19.055658Z"}],
  "summary": {"critical":0,"high":1,"medium":0,"low":0,"unacked":1,"total":1}
}
```

`state` 为 `normal`、`unack-active`、`ack-active`、`rtn-unack`（在有人确认之前就已恢复，并保留在列表中，这样凌晨 3 点的跳闸不会在早班人员看到之前消失）、`shelved` 或 `suppressed`。`tripValue` 是触发报警的读数，不是当前读数。

### `POST /api/alarms`

创建或替换一个定义。

| 字段 | 类型 | <span class="sr-only">详细信息</span> |
|---|---|---|
| `id`, `name` | string | 必填。`id` 遵循设备 id 规则 |
| `deviceId`, `tagName` | string | 必填 |
| `condition` | string | `hihi`, `hi`, `lo`, `lolo`, `eq`, `ne`, `true`, `false`, `bad-quality`, `stale`（`limit` 秒内没有读数）, `roc`（每秒变化率超过 `limit`） |
| `limit` | number | |
| `priority` | int | 1（严重）到 4（低） |
| `enabled` | bool | 省略时为 `false` |
| `deadband` | number | 值需要回退多远，报警才会恢复。没有死区时，正好停在限值上的值会反复抖动 |
| `onDelaySec`, `offDelaySec` | int | 条件需要持续多久才会触发，或需要消失多久才会恢复正常 |
| `message`, `description` | string | `message` 可使用 `{value}`、`{limit}`、`{tag}`、`{device}`、`{unit}`、`{condition}` 和 `{reason}`（读数为何不良，良好时为空） |

`{value}` 的写法与数值卡片相同，带单位：整数原样，从 1 起保留两位小数，从 100 起保留一位，1 以下保留四位，超过一千万或小于 0.01 时用科学计数法（`8.20 pH`、`212.5 F`、`1.235e+7`）。这样做是因为量程系数为 0.1、原始值为 82 的变量，以 float 表示是 8.200000000000001，而横幅过去就是这样显示的。文本读数按原样给出。变量本身、写入和自动化看到的仍是精确数值；只有句子里的数字会被舍入。`{limit}` 是您输入的限值原样。

返回该定义；引擎会重新加载，并且在响应之前就创建好报警实体。验证失败返回 `400`（`"alarm x: priority must be 1-4, got 9"`）。

### `POST /api/alarms/import/codesys`

从请求体中读取 CODESYS IDE 的 Export Alarms 写出的文件（报警组导出，`.csv`），可以是 IDE 写出的原样（带字节顺序标记的 UTF-16），也可以是 UTF-8。`?deviceId=` 是 PLC 设备，必填。`?application=` 是其变量所在的应用名称，省略时为 `Application`：导出文件用变量的 GVL 来命名变量（`GVL_Alarm.bPumpFault`），而变量是 `Application.GVL_Alarm.bPumpFault`。`?defaultPriority=`（1 到 4）是类别不是 Error、Warning 或 Info 的报警所用的优先级。没有 `?apply=true` 时不会保存任何内容：响应会说明将导入什么。

报警界面把这项功能叫作从 CODESYS 导入（仅限管理员）：选择设备，填写应用名称，选择文件，查看预览，然后导入。

与 `= TRUE` 或 `= FALSE` 比较的数字报警变为 `true` 和 `false`，带 `>` 的 UpperLimit 变为 `hi`，带 `<` 的 LowerLimit 变为 `lo`，Outside range 报警（`OutOfArea`，两个运算符都是 `<`）变为两个报警，下限一个 `lo`、上限一个 `hi`，消息以及开启和关闭延时（如 `T#5s` 这样的 IEC 时间）会保留，Error 对应优先级 2，Warning 为 3，Info 为 4。IDE 能写出的其他内容不会被读取，会连同所在行和原因一起放回 `skipped`，因为 CODESYS 没有公开这种格式，只读取真实导出已经展示过的内容。IDE 提供的其余内容也是如此：Inside the range（`ForbiddenArea`）只在两个限值之间为真，而这里的报警只有一个限值，Change 没有文档记载的持续时间，Event 和 Alarm (API) 由 PLC 程序触发，没有可监视的变量。`warnings` 列出只部分保留的内容（未知的类别、锁存、更高优先级的报警）。

```json
{"applied": false, "version": "2.0.0.0",
 "alarms": [{"id":"codesys-GVL_Alarm.rTemp-hi","name":"Temperature high","deviceId":"plc1","tagName":"Application.GVL_Alarm.rTemp","condition":"hi","limit":90,"priority":3,"enabled":true,"message":"Temperature high"}],
 "skipped": [{"row":5,"id":"3","reason":"the observation type \"Deviation\" has not been seen in an export, so it is not read"}],
 "warnings": []}
```

`404` 表示未知设备,`400` 表示该文件不是报警组导出文件。

### `DELETE /api/alarms/{id}`

`{"deleted":"extruder-temp-hi"}`,或 `404`。

### `POST /api/alarms/{id}/ack`

可选请求体 `{"note": "checking the heater bands"}`。返回报警当前的状态,带 `ackedBy` 和 `ackNote`。未知报警返回 `404`。

### `POST /api/alarms/{id}/shelve`

`{"minutes": 30}`,必填且为正数:无限期静音属于抑制,那是另一回事,也不该由操作员来做。返回报警,`state` 为 `shelved`,带 `shelvedUntil` 和 `shelvedBy`。

### `POST /api/alarms/{id}/unshelve`

无请求体。返回报警,并让它回到其条件决定的状态。如果它没有被搁置,返回 `409`。

### `GET /api/alarms/events`

报警审计记录,最新的在前。`?alarm=` 指定一个定义,`?limit=`(默认 200,最多 5000)。

```json
[{"id":2,"definitionId":"extruder-temp-hi","type":"acked","fromState":"unack-active","toState":"ack-active","value":23.192472931395088,"message":"extruder-1/Temperature at 22.80197037650447 C, limit 5","actor":"admin","note":"checking the heater bands","at":"2026-09-27T20:25:22.920251Z"}]
```

`type` 是 `raised`、`acked`、`cleared`、`shelved`、`unshelved`、`suppressed`、`unsuppressed`、`escalated` 或 `escalation-ended`。最后两个由报警升级写入(`actor` 为 `escalation`),其 `note` 说明通知了谁,以及链条为什么停止。参见[报警通知](/zh-hans/iot/notifications/#escalation)。

## 自动化

触发器、条件、动作。规则语言见[自动化](/zh-hans/iot/automations/)。

### `GET /api/automations`

```json
{"armed":{"fill-tank":true},"automations":[{"id":"fill-tank","name":"Fill the tank","enabled":true,"triggers":[{"type":"threshold","deviceId":"tank-farm","tagName":"level","threshold":20,"direction":"falling","hysteresis":5},{"type":"webhook","webhookPath":"fill-now"}],"actions":[{"type":"call_service","name":"start the pump","params":{"service":"switch.turn_on","entityId":"switch.tank_farm_pump"}}],"mode":"skip","minIntervalSec":60,"createdAt":"2026-09-27T20:26:49.770826Z","updatedAt":"2026-09-27T20:26:49.770826Z"}],"webhooks":["fill-now"]}
```

`armed` 表示哪些规则真正在运行,这和 `enabled` 不是一回事:一条已启用但不再能编译的规则没有进入 armed 状态,你可以在这里发现。

### `POST /api/automations`

创建或替换一条规则:`id`、`name`、`description`、`enabled`、`triggers`(至少一个)、`condition`、`actions`(至少一个)、`mode`(默认 `skip`,另有 `queue`、`restart`、`parallel`)、`minIntervalSec`、`maxRuntimeSec`。规则在保存前先编译,无法编译的会返回 400,绝不会进入数据库:一条无法 armed 的已保存规则,正是作者以为在运行的规则。

```json
{"error":"automation fill-tank action 1 (call_service): params: json: unknown field \"entity_id\""}
```

### `POST /api/automations/validate`

编译一条规则但不保存,用于编辑器的实时检查。始终返回 `200`,响应会说明它是否编译通过:

```json
{"valid":true}
{"error":"automation bad: at least one trigger is required","valid":false}
```

它需要 `automations.write`,因为它的存在就是为了帮助人写规则。

### `DELETE /api/automations/{id}`

`{"deleted":"fill-tank"}`,或 `404`。

### `POST /api/automations/{id}/enabled`

`{"enabled": false}` 会让它解除 armed,但不删除。返回 `{"enabled":false,"id":"fill-tank"}`,或 `404`。

### `POST /api/automations/{id}/trigger`

立即运行它,就像触发器触发了一样。条件仍然适用(条件为假会记录一次 `skipped` 运行),运行模式也一样;`minIntervalSec` 不适用,因为请求运行的人不是一个抖动的变量。无请求体。`202` `{"triggered":"fill-tank"}`:运行在后台进行,结果可在 `GET /api/runs` 查看。规则未 armed 时返回 `400`。操作员拥有 `automations.trigger`;运行别人写的规则属于操作,编写规则则不是。

### `GET /api/runs`

运行历史,最新的在前。`?automation=` 指定一条规则,`?limit=`(默认 100,最多 1000)。没有时为 `[]`。

```json
[{"id":1,"automationId":"fill-tank","status":"succeeded","triggerType":"manual","triggerDesc":"triggered by admin","actor":"admin","startedAt":"2026-09-27T20:26:50.269792Z","finishedAt":"2026-09-27T20:26:50.282129Z","durationMs":12.337,"steps":[{"index":1,"type":"call_service","name":"start the pump","input":"switch.turn_on switch.tank_farm_pump {}","output":"true to tank-farm/pump: written; call 8fb9538c82d532be","startedAt":"2026-09-27T20:26:50.272532641Z","durationMs":9.595}]}]
```

`status` 是 `running`、`succeeded`、`failed`、`skipped`、`timed_out` 或 `cancelled`。各步骤保留的是解析后的输入,而不是模板,因为凌晨 3 点你需要读的正是这个。

由蓝图创建的规则在 `GET /api/automations` 中多出三个字段:`blueprintId`、`blueprintVersion`(创建它所用的版本,也是它保持的版本)和 `blueprintInputs`。手写的规则没有这些字段。它们归服务器管:`POST /api/automations` 接受它们但忽略它们,手工编辑会保留规则原有的值。

### `POST /api/automations/{id}/blueprint-upgrade`

把由蓝图创建的规则升级到该蓝图的最新版本,保留它的 id、名称以及是否 armed。它绝不会自动进行。操作员拥有 `blueprints.apply`,与创建规则时相同。先看一看:**`?dry_run=true`** 不改变任何东西,会按部分回答将发生哪些变化,以及规则此刻触发会做什么,每一次写入都会经过写入门的检查:

```json
{"dry_run":true,"id":"pump_1_watch","blueprint":"pump_watch","from":1,"to":2,"changes":[{"field":"actions","before":[{"params":{"message":"switch.pump_1 started, v1"},"type":"log_event"}],"after":[{"params":{"message":"switch.pump_1 started, v2"},"type":"log_event"}]}],"automation":{"id":"pump_1_watch","...":"..."},"check":{"automation_id":"pump_1_watch","steps":[{"step":"1","type":"log_event","verdict":"not_checked","detail":"a dry run checks writes to equipment; this step writes to none and runs only for real"}]}}
```

规则创建之后手工做的编辑,会在 `changes` 中显示为被替换。当新版本需要一个规则没有值的输入,或拒绝规则创建时用的某个值时,试运行会在 `error` 中说明,不会有别的内容。

真正的升级接受 `{"version": 2}`(试运行所显示的版本),以及新版本所需的 `inputs`。蓝图在此期间已更新,或有人在此期间升级了这条规则,会返回 `409`:审查过的才会进入,否则什么都不会进入。缺少输入返回 `400`。返回 `200`,结构相同,其中 `automation` 是保存后的规则。它被记录为 `automation upgraded from blueprint pump_watch version 1 to 2`。用相同版本加新的 `inputs`,就是修改规则输入的方法。手写的规则返回 `400`;规则所来自的蓝图已不存在则返回 `404`。

## 脚本

有名称的动作序列,按需运行:从这里运行、从规则的 `call_script` 步骤运行、从 MCP 的 `run_script` 运行,或通过脚本的实体(`script.turn_on`)运行。这个序列就是自动化语言。步骤的每一次写入都以 `script:<id>` 经过写入门,并带有启动者的来源。全部内容见[脚本](/zh-hans/iot/scripts/)。

### `GET /api/scripts`

每个脚本,附带它的运行计数以及当前正在进行的运行数,涵盖所有进程:

```json
[{"id":"cip_cycle","name":"CIP cycle","fields":[{"name":"minutes","type":"number","required":true,"min":1,"max":60,"unit":"min"}],"sequence":[{"type":"call_service","params":{"entityId":"switch.cip_pump","service":"switch.turn_on"}}],"mode":"skip","createdAt":"2026-09-28T10:00:00Z","updatedAt":"2026-09-28T10:00:00Z","lastRun":"2026-09-28T10:05:00Z","lastStatus":"succeeded","runCount":3,"running":0}]
```

### `POST /api/scripts`

创建一个脚本。仅限管理员。`id`(小写字母、数字和下划线,以字母开头:它是实体的对象 id,`script.<id>`)、`name`、`description`、`icon`、`fields`(带类型的输入)、`sequence`(至少一个动作)、`mode`(默认 `skip`,另有 `queue`、`restart`、`parallel`)和 `maxRuntimeSec`。它和规则一样在保存前编译,直接或通过其他脚本调用自己的脚本会被拒绝。返回 `201` 和该脚本。无法编译的返回 `400`;id 已被占用返回 `409`。

### `POST /api/scripts/validate`

检查一个脚本但不保存,用于编辑器的实时检查。`200` `{"valid":true}` 或 `{"valid":false,"error":"..."}`,措辞与保存被拒绝时相同。

### `GET /api/scripts/{id}`

一个脚本,与列表中的相同。不存在则返回 `404`。

### `PUT /api/scripts/{id}`

替换它的定义;请求体与创建时相同,`id` 可以省略。仅限管理员。当它的步骤、字段或模式改变时,正在进行的运行会被取消:它们是用旧定义启动的。

### `DELETE /api/scripts/{id}`

删除它及其运行历史,并取消正在进行的运行。仅限管理员。`{"deleted":"cip_cycle"}`。它的实体变成孤立实体,不会被删除。

### `POST /api/scripts/{id}/run`

运行它。操作员拥有 `scripts.run`。

```json
{"fields":{"minutes":20},"reason":"end of shift clean","wait":false}
```

请求体中的每个字段都是可选的,请求体本身也是。在任何内容运行之前,会先对照脚本的字段检查这些字段:超出范围、不在其步长上、不是选项之一或类型错误的值会返回 `400`,绝不会为了凑合而被挪动。运行一开始就返回 `202` 和该运行;带 `"wait":true` 时,运行结束后返回 `200` 和该运行,包括它的轨迹。

```json
{"run":{"id":77,"scriptId":"cip_cycle","status":"running","actor":"otto","source":"ui","fields":{"minutes":20},"startedAt":"2026-09-28T10:05:00Z","durationMs":0}}
```

忙碌时返回 `409`:已在运行且其模式为 `skip`,或已在运行且有一个排队、其模式为 `queue`。什么都没有运行,历史中会有一条 `skipped` 运行说明原因:

```json
{"error":"script busy: script cip_cycle was not started: it is already running, and its mode is skip","run":{"id":78,"scriptId":"cip_cycle","status":"skipped","...":"..."}}
```

**`?dry_run=true`** 询问现在运行会做什么,而不做其中任何一件。字段以同样方式检查;然后每一步都对照现场的实际情况走一遍:每次写入和服务调用都要经过写入门自己的检查,条件会被求值,变量会被绑定。等待、延时以及任何不写入设备的内容都是 `not_checked`。第一个会被拒绝的写入会结束它,就像它会结束这次运行一样,`error` 用写入门的措辞说明。返回 `200` 和结论,无论是否被拒绝:

```json
{"dry_run":true,"check":{"script_id":"cip_cycle","fields":{"minutes":20},"steps":[{"step":"1","type":"call_service","input":"switch.turn_on switch.cip_pump {}","verdict":"refused","detail":"cip/pump: this tag is not marked writable"}],"error":"step 1 (call_service): cip/pump: this tag is not marked writable"}}
```

每一步的 `verdict` 是 `would_write`、`refused`、`ends_here`(此刻为假的条件,或一次停止)、`not_checked` 或 `ok`。它所调用脚本的步骤在调用之下编号:`3.1`。

### `POST /api/scripts/{id}/stop`

取消它所有正在进行的运行,涵盖所有进程,无论在哪里。`{"cancelled":1,"stopped":"cip_cycle"}`,其中 `cancelled` 是本进程持有的运行数。操作员拥有 `scripts.run`:停止自己能启动的东西,是启动的一部分。

### `GET /api/scripts/{id}/runs`

它的运行,最新的在前,带轨迹。`?limit=`(默认 50,最多 1000)。`parent` 是调用某次运行的对象,如果有的话:`automation_run:812`、`script_run:77`。

```json
[{"id":77,"scriptId":"cip_cycle","status":"succeeded","actor":"automation:shift-end","source":"automation","parent":"automation_run:812","fields":{"minutes":20},"startedAt":"2026-09-28T10:05:00Z","finishedAt":"2026-09-28T10:25:00Z","durationMs":1200012,"steps":[{"index":1,"type":"call_service","input":"switch.turn_on switch.cip_pump {}","output":"true to cip/pump: written; call 8fb9538c82d532be","startedAt":"2026-09-28T10:05:00Z","durationMs":9.6}]}]
```

## 配方

一起应用的一组值:某个产品等级的设定值,一次换型。每一组同时也是一个实体,`scene.<id>`。配方在任何内容发出之前会被整体检查,并因任何原因被整体拒绝;它的目标随后在同一个调用 id 下按顺序发出,第一个失败的会停止其余的,且不会撤销任何东西;写入的每个值都会从设备读回。全部内容见[配方](/zh-hans/iot/recipes/)。

配方的名称、描述、设备节点和权限就地更改。它所写入的内容(`targets`、`params`、`precondition`、`verify_sec`)是一个版本,而版本永远不会被修改:保存新内容会存为下一个版本。

### `GET /api/recipes`

每一个配方,附带其当前版本的内容和最近一次应用:

```json
[{"id":"grade_a","name":"Grade A","equipment_id":7,"apply_permission":"recipes.apply","current_version":3,"params":[{"name":"speed","type":"number","min":0,"max":400,"step":10,"unit":"rpm","required":true}],"precondition":"states['input_boolean.line_ready'] == 'on'","targets":[{"entity_id":"number.line_02_zone1_sp","service":"set_value","data":{"value":210}},{"entity_id":"number.line_02_speed","service":"set_value","data_expressions":{"value":"vars.speed"}}],"verify_sec":10,"note":"zone 1 up 5","created_at":"2026-09-28T10:00:00Z","updated_at":"2026-09-28T11:00:00Z","last_application":{"id":41,"recipe_id":"grade_a","version":3,"call_id":"7c1f0e2d9a8b6c54","actor":"otto","source":"ui","params":{"speed":250},"status":"applied","targets":[],"started_at":"2026-09-28T11:05:00Z","finished_at":"2026-09-28T11:05:01Z"}}]
```

对于整个工厂的配方,`equipment_id` 为 `null`。

### `POST /api/recipes`

创建一个配方,版本为 1。仅限管理员。`id`(小写字母、数字和下划线,以字母开头:它是实体的对象 id,`scene.<id>`)、`name`、`description`、`equipment_id`、`apply_permission`(默认 `recipes.apply`,或 `recipes.apply.<name>`)、`params`(带类型的输入)、`precondition`(开始时必须为真的表达式)、`targets`(至少一个,最多 200 个,每个包含 `entity_id`、`service` 以及 `data` 或 `data_expressions`)、`verify_sec`(1 到 600,默认 10)和 `note`。目标设置一个值:在接受它们的域上使用 `set_value`、`select_option`、`set_position`、`set_speed`、`set_setpoint`、`set_mode`、`turn_on`、`turn_off`。脉冲或启动会被拒绝:它属于脚本。每个目标的实体必须存在,每个表达式必须能编译。返回 `201` 和该配方;任何错误返回 `400`,id 已被占用返回 `409`。

### `POST /api/recipes/capture`

根据实体当前持有的值起草一个配方,仅限管理员,不保存任何内容:

```json
{"entity_ids":["number.line_02_zone1_sp","switch.line_02_heater","loop.line_02_tic"]}
```

每个实体变成一个把它设回当前值的目标,按给定顺序排列;一个回路变成它的模式,然后是它的设定值。响应是一个没有 id 和名称的配方,供编辑器使用。不存在、已禁用、读取质量不是良好、为 `unknown` 或 `unavailable`、或不是配方所能设置之物的实体,会返回 `400` 并逐一指出:用不良读数构建的配方会把不良读数写回去。

### `GET /api/recipes/{id}`

一个配方,与列表中的相同。不存在则返回 `404`。

### `PUT /api/recipes/{id}`

保存它。仅限管理员。请求体是 `GET` 所返回的配方,经过编辑;其 `id` 可以省略。`current_version` 是此次编辑所基于的版本:如果此后有人保存了另一个版本,保存会返回 `409`,而不是悄悄覆盖他们的版本(`0` 跳过检查)。新内容成为下一个版本,`note` 说明原因;仅更改名称、描述、设备或权限不会产生新版本。

### `DELETE /api/recipes/{id}`

删除它及其各个版本。仅限管理员。`{"deleted":"grade_a"}`。它的应用记录会保留,因为那是发送到工厂的内容,而它的实体会成为孤立实体。

### `GET /api/recipes/{id}/versions`

每个版本,最新的在前,每个都与保存时完全一致,附带保存者和备注:

```json
[{"recipe_id":"grade_a","version":3,"params":[],"targets":[{"entity_id":"number.line_02_zone1_sp","service":"set_value","data":{"value":210}}],"verify_sec":10,"note":"zone 1 up 5","created_by":"ada","created_at":"2026-09-28T11:00:00Z"}]
```

### `GET /api/recipes/{id}/versions/{version}`

一个版本。配方没有该版本则返回 `404`,`{version}` 不是数字则返回 `400`。

### `POST /api/recipes/{id}/validate`

它现在会被应用吗?操作员拥有 `recipes.apply`。请求体与一次应用相同,不会写入、记录或写日志。一次应用在写入之前所做的每项检查都会执行:参数、配方自身的权限、前置条件、数据表达式、是否有另一次应用正在写入它的某个实体,以及每个目标都要经过写入门的检查。返回 `200` 和结论 `would_apply` 或 `refused`,以及每个目标自己的结论:`would_write`、带原因的 `refused`,或 `not_sent`。

```json
{"dry_run":true,"application":{"recipe_id":"grade_a","version":3,"params":{"speed":250},"status":"refused","targets":[{"index":1,"entity_id":"number.line_02_zone1_sp","service":"set_value","data":{"value":210},"status":"would_write"},{"index":2,"entity_id":"number.line_02_speed","service":"set_value","data":{"value":250},"status":"refused","error":"line-02/Speed: this tag is not marked writable"}],"started_at":"2026-09-28T11:04:00Z","error":"target 2 (set_value number.line_02_speed): line-02/Speed: this tag is not marked writable"}}
```

它不接受的参数会返回 `400`,与真实应用一样。

### `POST /api/recipes/{id}/apply`

应用它。操作员拥有 `recipes.apply`。指定了自身权限 `recipes.apply.<name>` 的配方还需要该权限,在这里针对该配方检查;没有该权限的用户会得到 `403`,并在历史中留下一条带其姓名的被拒绝的应用记录。

```json
{"params":{"speed":250},"reason":"grade A for the 2pm run","version":0,"resume":0}
```

一切都是可选的,请求体也是。`version` 有意应用较早的版本;省略则为当前版本。`resume` 是此配方一次中途停止的先前应用的 id:它尚未写入的目标会作为一次新的应用发出,使用它的版本和参数,`parent` 说明它完成的是哪一次。

它在每个值都已写入并读回之后才响应,最多耗时配方的 `verify_sec`:

```json
{"application":{"id":42,"recipe_id":"grade_a","version":3,"call_id":"9d2e4f6a8b0c1e3f","actor":"otto","source":"ui","reason":"grade A for the 2pm run","params":{"speed":250},"status":"applied","targets":[{"index":1,"entity_id":"number.line_02_zone1_sp","service":"set_value","data":{"value":210},"status":"written","writes":[{"tag":"line-02/Zone1_SP","value":"210","status":"written"}],"verification":"verified","verify_detail":"read back 210"},{"index":2,"entity_id":"number.line_02_speed","service":"set_value","data":{"value":250},"status":"written","writes":[{"tag":"line-02/Speed","value":"250","status":"written"}],"verification":"unconfirmed","verify_detail":"not confirmed within 10s: read back 240, not 250"}],"started_at":"2026-09-28T11:05:00Z","finished_at":"2026-09-28T11:05:10Z"}}
```

目标为 `written`、`failed`(已发出但设备说不或没有回应)、`not_sent`、`skipped`(它之前的某个没有通过)或 `refused`(预验证)。已写入的目标在发送后设备读回了发给它的值时为 `verified`,在 `verify_sec` 内没有读回时为 `unconfirmed`:它已发出,但可能没有生效。每次写入都带有该应用的 `call_id`,所以 `GET /api/writes?call=<call_id>` 就是全部写入。

| 状态 | 何时 |
|---|---|
| 200 | `applied`:每个目标都已写入。请检查每个目标的 `verification` |
| 400 | 配方不接受的参数,超出范围或类型错误;没有剩余内容可应用的 `resume` |
| 403 | 配方自身的权限。记录为一次被拒绝的应用 |
| 404 | 没有这个配方,或没有这个版本 |
| 409 | `refused`:任何不启动的原因,每个都在 `error` 和它的目标上。或另一次应用此刻正在写入它的某个实体。没有写入任何内容 |
| 502 | `partial` 或 `failed`:已启动,但并非每个目标都已发出。`targets` 精确说明是哪些。不会撤销任何东西 |

除了请求体格式错误的 `400` 或 `404` 之外,每个响应都带有该应用,并且除试运行之外的每次应用都在 `GET /api/recipes/{id}/applications` 中,包括被拒绝的。

### `GET /api/recipes/{id}/applications`

它的应用记录,最新的在前,包括被拒绝的。`?limit=`(默认 50,最多 1000)。`parent` 是应用它的对象,如果有的话:`automation_run:812`、`script_run:77`、`application:41`。已删除配方的应用记录仍会返回。

## 蓝图

只写一次、其中带有类型化空位的自动化,填入后就成为一条普通规则。规则保留创建它时的版本;编辑蓝图不会改变任何规则,把规则升级到更新的版本是某人提出的[一次升级](#post-apiautomationsidblueprint-upgrade)。规则所做的每次写入都以 `automation:<id>` 经过写入门。全部内容见[蓝图](/zh-hans/iot/blueprints/)。

### `GET /api/blueprints`

每个蓝图,内置的在前,每个附带由它创建的规则数量:

```json
[{"id":"motor_running_too_long","name":"Motor running too long","description":"Says so when a motor has been running longer than it should...","source":"builtin","version":1,"inputs":[{"name":"motor","label":"Motor","type":"entity","required":true,"domain":["motor"]},{"name":"max_run","label":"Longest it may run","type":"duration","default":3600},{"name":"stop_it","label":"Stop it as well","type":"boolean","default":false}],"template":{"triggers":[{"type":"state","entityId":{"!input":"motor"},"to":"running","forSec":{"!input":"max_run"}}],"...":"..."},"instances":2}]
```

`source` 为 `builtin`(随二进制文件发布,只读)或 `user`。

### `POST /api/blueprints`

写入一个蓝图。仅限管理员。`id`(小写字母、数字和下划线,以字母开头)、`name`、`description`、`inputs`(带类型,与脚本的字段相同)和 `template`:规则本身,包含它的 `description`、`triggers`、`condition`、`actions`、`mode`、`minIntervalSec` 和 `maxRuntimeSec`,以及其中的空位。作为值的 `{"!input": "motor"}` 会被输入替换;字符串中的 `${motor}` 也一样,在字符串是表达式的地方作为字面量。它在保存前会被检查:每个空位都指向一个输入,每个输入都被用到,并且用示例值填充后能生成可编译的规则。`version` 为 1 时返回 `201`。有任何问题返回 `400`,id 被占用返回 `409`,包括内置蓝图的 id。

### `GET /api/blueprints/{id}`

一个蓝图,与列表中的相同。不存在则返回 `404`。

### `PUT /api/blueprints/{id}`

替换它的定义;请求体与写入一个蓝图相同,其 `id` 可以省略。仅限管理员。当 `inputs` 或 `template` 改变时 `version` 加一,新名称或新描述不会增加。**由它创建的规则一个都不会改变。** 每个规则保留创建它时的版本,`GET /api/automations` 会显示是哪个版本。内置蓝图返回 `400`:请以你自己的 id 复制它。

### `DELETE /api/blueprints/{id}`

仅限管理员。`{"deleted":"pump_watch"}`。只要还存在由它创建的规则,就返回 `409` 并指出这些规则:请先删除它们。内置蓝图返回 `400`。

### `POST /api/blueprints/{id}/instantiate`

由它创建一条规则并使其 armed。操作员拥有 `blueprints.apply`:用哪台泵、用多久由他们来选,而规则做什么是在蓝图编写时决定的。

```json
{"automationId":"infeed_too_long","name":"Infeed pump ran too long","enabled":true,"inputs":{"motor":"motor.infeed_pump","max_run":"90m","stop_it":true}}
```

`name` 默认为蓝图的名称,`enabled` 默认为 `true`。在创建任何内容之前会检查每个输入:超出范围、不在其步长上、不是选项之一、属于其他域的实体或类型错误的值,会返回 `400` 并逐一指出错误的输入,而且绝不会被挪动以求匹配。已被占用的 `automationId` 返回 `409`:创建规则绝不会替换已有的规则。返回 `201` 和该规则,其 `blueprintId`、`blueprintVersion` 和 `blueprintInputs` 已设置。它被记录为 `automation made from blueprint motor_running_too_long version 1`。

**`?dry_run=true`** 不创建任何内容。它回答它将创建的规则,以及该规则此刻触发会做什么:条件被求值,每次写入和服务调用都以 `automation:<id>` 经过写入门的检查,第一个拒绝以写入门的措辞出现在 `check.error` 中。不会存储、写入或审计任何内容。

```json
{"dry_run":true,"automation":{"id":"infeed_too_long","...":"..."},"check":{"automation_id":"infeed_too_long","steps":[{"step":"1","type":"log_event","verdict":"not_checked"},{"step":"2","type":"condition","input":"true","verdict":"ok","detail":"true now"},{"step":"3","type":"call_service","input":"motor.stop motor.infeed_pump {}","verdict":"would_write","detail":"would write false to line-02/M1_Run"}]}}
```

## 仪表板

由卡片组成的页面,供需要它们的角色和屏幕使用。仪表板不下达任何命令:卡片指向一个变量、实体、脚本或配方,它的按钮以按下它的人的身份通过 [`POST /api/write`](#post-apiwrite) 写入。墙板就是其中之一。全部内容见[仪表板](/zh-hans/iot/dashboards/)。

### `GET /api/dashboards`

提供给调用者的仪表板,按切换器显示的顺序,包括墙板。拥有 `dashboards.write` 的人会被提供全部。

```json
[{"id":"wall","name":"Wall board","description":"The tags pinned on the Board screen, as gauges.","kind":"wall","roles":[],"homeFor":[],"screens":["wall-tv"],"position":0,"cards":[],"version":2,"updatedBy":"ada"},
 {"id":"line-2","name":"Line 2","kind":"cards","roles":["operator","admin"],"homeFor":["operator"],"screens":["line-2-panel"],"position":1,"version":3,"updatedBy":"ada","cards":[{"id":"temp","type":"gauge","title":"Zone 1","w":3,"h":3,"config":{"tag":"press-01/Zone1_Temp"}}]}]
```

### `POST /api/dashboards`

构建一个。仅限管理员。`id`(小写字母、数字、连字符和下划线,以字母开头)、`name`,以及可选的 `description`、`roles`、`homeFor`、`screens`、`position` 和 `cards`。`version` 为 1 时返回 `201`,每张卡片的大小和配置都是其被存储的形式。

一张卡片包含 `id`、`type`、`title`、`w`(1 到 12 列)、`h`(1 到 8 行)和一个 `config`。类型及其配置见[仪表板](/zh-hans/iot/dashboards/#卡片)。它在保存前会被检查:

- 类型中没有的配置键、超出范围的数字、带有登录信息或令牌的摄像头或平面图地址,或超过 60 张卡片,会返回 `400`;
- 指向不存在的变量、实体、脚本或配方的卡片,会返回 `400` 并指出它;
- 指向不可写变量的 `button`,或数字超出变量范围,会返回 `400`:写入门会拒绝每一次按下;
- 不存在的角色会返回 `400`;
- 已被占用的 `id`、另一个仪表板已有的屏幕,或另一个仪表板已经是的角色主页,会返回 `409`。

### `GET /api/dashboards/{id}`

一个仪表板,与列表中的相同。不存在,或未提供给调用者时,返回 `404`。

### `PUT /api/dashboards/{id}`

替换它。仅限管理员。请求体是 `GET` 所返回的仪表板,`version` 设为读取时的版本:**它是必填的**,保存时指定的版本若已不是当前版本,会返回 `409` 并说明当前版本是什么,因为另一种做法是悄悄删除最后一位保存者刚刚构建的内容。请求体中的 `id` 可以省略,`kind` 不能更改,`createdAt`、`updatedAt` 和 `updatedBy` 由服务器管理,会被忽略。返回 `200` 和下一个版本的仪表板。

墙板只接受针对它的分配(`roles`、`homeFor`、`screens`、`position`)的 `PUT`,别无其他:它没有卡片,所以带卡片的请求会返回 `400`。它的仪表是墙板的变量,`GET` 和 `PUT /api/board`。

### `DELETE /api/dashboards/{id}`

仅限管理员。`{"deleted":"line-2"}`。卡片只指向事物,不拥有任何东西,所以不会触碰其他内容。墙板返回 `400`:它始终存在。

构建、保存和删除都会作为 `config` 事件记录在主体 `dashboard:<id>` 上。

### `GET /api/dashboards/{id}/export`

作为屏幕文件的仪表板:一份带版本的 JSON 文档,[`POST /api/dashboards/import`](#post-apidashboardsimport) 会把它加载到另一个安装中。它以名为 `<id>.hotloop-screen.json` 的附件响应。调用者需要 `dashboards.read`,并且必须被提供该仪表板,与 `GET` 单个仪表板相同。墙板返回 `400`:它是一个安装的固定仪表,而不是布局。格式见[屏幕文件](/zh-hans/iot/screen-file/)。

### `POST /api/dashboards/import`

读取一个屏幕文件,对照此安装进行检查,并保存为新的仪表板。仅限管理员,并且它不能保存 `POST /api/dashboards` 会拒绝的内容。请求体是文件本身,或带有选项的 `{"file": {...}}`:

| 选项 | <span class="sr-only">详情</span> |
|---|---|
| `id`, `name` | 以另一个 id 或名称保存。 |
| `replace` | 如果 id 已被占用,就在该仪表板的当前版本上覆盖保存。没有它时,已被占用的 id 返回 `409`。 |
| `skipAssignments` | 去掉文件中的 `screens` 和 `homeFor`,它们属于创建该文件的安装。`roles` 保留。 |
| `remap` | 在这里如何称呼各项:`tags`(整键到整键,按文件指出变量的方式,或在 `devices` 移动它之后读取的方式)、`devices`(id 到 id,同时也会移动 `tags` 中未指明的每个变量的设备部分)、`entities`、`scripts`、`recipes` 和 `equipment`(id 到 id)。屏幕上没有任何东西使用的条目是一条警告。 |
| `dryRun` | 返回报告,不保存任何内容。始终为 `200`。 |
| `codesys`, `visualization` | 代替 `file`:CODESYS 原生导出的文本,以及它包含多个时要取用的可视化。此时报告中带有一个 `conversion`,说明每个元素变成了什么、什么被舍弃。参见[导入 CODESYS 屏幕](/zh-hans/iot/codesys-screen-import/)。 |

无论是否保存了内容,响应都是一份报告:

```json
{"ok":false,"dryRun":true,"id":"line-2","name":"Line 2","cards":6,"replaces":false,
 "problems":[{"kind":"tag","ref":"press-01/Zone1_Temp","message":"tag press-01/Zone1_Temp does not exist here; map it to one that does, or add it on the Tags screen first"}],
 "warnings":[],"remapped":[],
 "requires":{"tags":[{"key":"press-01/Zone1_Temp","writable":false}],"entities":[],"scripts":[],"recipes":[],"devices":[],"equipment":[]}}
```

每个缺失的引用都会被列出,而不仅仅是第一个。`kind` 为 `file`(不是屏幕文件、格式错误、比此版本所能读取的更新的格式版本,或它不认识的字段)、`screen`(仪表板自身的规则:错误的卡片、不存在的角色、过大)、`tag`、`entity`、`script`、`recipe`、`device`、`equipment`、`writable`(不可写变量上的按钮或设定值)、`assignment`(另一个仪表板持有的屏幕名称或角色主页)或 `exists`(id 已被占用)。有任何问题的导入不会保存任何内容:返回 `400`,当唯一的问题是 `exists` 或 `assignment` 时返回 `409`,报告相同。成功为 `201`,替换了已有仪表板时为 `200`,带有报告和已保存的 `dashboard`。它会作为 `config` 事件记录在主体 `dashboard:<id>` 上。

## Webhook

### `POST /api/webhook/{path}`

在该路径上触发每个带有 `webhook` 触发器的自动化。**没有会话,也没有权限**:路径就是交给第三方的秘密,这是此端点一贯的信任模型,而 SCADA 系统或 SaaS 回调没有可登录的账户。请选一个没人能猜到的路径。

请求体最大 1 MiB,会交给规则。`202` `{"accepted":"fill-now"}`。没有任何自动化在监听时返回 `404` `"no automation is listening on this webhook path"`:向虚空发送的 Webhook 看起来与正常工作的一模一样,所以它会这样说明。

## 设备群

已注册的边缘中继,它们通过 Sparkplug 的实时在线状态,以及发给它们的命令。需要 `HOTLOOP_FLEET_ENABLED`。参见[设备群管理](/zh-hans/gateway/fleet/)。

### `GET /api/fleet`

```json
{"configured":true,"members":[{"id":"press-relay-01","name":"Press line relay","group":"plant-a","nodeId":"press-relay-01","statusUrl":"http://press-relay-01:8081","enabled":true,"createdAt":"2026-09-27T20:28:49.448323Z","updatedAt":"2026-09-27T20:28:49.448323Z","online":false,"polled":true,"error":"Get \"http://press-relay-01:8081/status\": dial tcp: lookup press-relay-01 on 10.89.0.1:53: no such host"}]}
```

`online` 来自 NBIRTH 和 NDEATH。`release` 是中继在其最近一次 birth 中声明正在运行的构建:`version`、`imageDigest`(当其监督程序提供时;Helm chart 不提供)和 `since`,即 Gateway 第一次听到该构建的时间。过旧而无法报告的中继没有这些。对于带有 `statusUrl` 的成员,`polled` 为真,`reachable`、`forwardQueueLen`、`devices`、`connected`、`config` 和 `updateMode`(`auto` 或 `approve`)来自它的 `/status`;不可达时它们没有意义。功能关闭时:`{"members":[],"configured":false}`。

### `POST /api/fleet`

创建或替换一个成员:`id`、`name`、`group` 和 `nodeId`(它的 Sparkplug 身份)必填;`description`、`statusUrl`(`http://` 或 `https://`)和 `enabled` 可选。返回该成员。此操作在功能关闭时也能使用,因此可以在开启之前先声明设备群。

### `DELETE /api/fleet/{id}`

`{"deleted":"press-relay-01"}`,或 `404`。

### `POST /api/fleet/{id}/rebirth`

向中继发布 `Node Control/Rebirth`。无请求体。`{"status":"rebirth requested"}`。未知成员返回 `404`。

### `POST /api/fleet/{id}/restart`

发布 `Node Control/Reboot`。`{"status":"restart requested"}`。仅限管理员:重启中继会让它在恢复之前丢失数据。

### `POST /api/fleet/{id}/update`

批准中继暂扣的镜像更新。发布 `Node Control/Update`。`{"status":"update approved"}`。仅限管理员:中继退出,其监督程序启动它所跟随的镜像,所以在这段时间内它会丢失数据。它只对设置为 `HOTLOOP_EDGE_RELAY_UPDATE_MODE=approve` 的中继起作用;其他任何中继会记录它已忽略。请求不指定任何镜像:没有地方可以放一个,这正是关键所在。参见 [Edge Relay 参考](/zh-hans/edge-relay/reference/#更新-relay)。

### `POST /api/fleet/{id}/config`

向中继推送新的设备文件,中继会实时应用:无需重启,它的 broker 会话和转发队列得以保留,文件没有改变的每个设备保持连接。请求体是**设备文件本身**,原始 JSON,不包裹任何内容。在发布任何内容之前会先验证(否则返回 `400` `"invalid device file: ..."`)。`{"status":"config pushed"}` 表示 broker 已收到;中继是否在运行它,可看 `GET /api/fleet` 中该成员的 `config.digest`,中继拒绝的文件会在那里显示为 `config.rejected`。仅限管理员:它会改变中继所轮询的内容。参见[设备群管理](/zh-hans/gateway/fleet/#推送配置)。

### `DELETE /api/fleet/{id}/config`

撤回推送。清除 broker 上保留的配置,使之后的任何启动都不会应用它,而此刻已连接的中继会放弃推送来的文件,实时回到本地的设备文件。无请求体。`{"status":"config push cleared"}`,未知成员返回 `404`,Gateway 未连接 broker 时返回 `503`。与推送一样仅限管理员。它不会重启任何东西。请在中继在线时发送:离线的中继永远收不到。参见 [Edge Relay 参考](/zh-hans/edge-relay/reference/#推送的文件放在哪里以及哪个文件优先)。

## 通知

在报警被触发时通过 Webhook、SMTP、ntfy 或 Gotify 呼叫手机,并在无人确认时通知下一个人。需要 `HOTLOOP_NOTIFY_ENABLED`。

### `POST /api/notify/test`

立即通过每个已配置的渠道发送一条合成的报警通知,让你在真实报警之前发现 SMTP 中继拒绝了你。无请求体。需要 `HOTLOOP_NOTIFY_ENABLED`。仅限管理员:它会发送真实的消息,并消耗服务商允许的配额。

```json
{"results":[{"channel":"smtp","success":true}]}
```

无论每个渠道是否成功都返回 `200`;每个结果会各自说明。失败的会带有 `error`。失败的 Webhook 只指出它的方案和主机,不含其他内容,因为对大多数呼叫服务来说,URL 就是凭据。参见[报警通知](/zh-hans/iot/notifications/)。

### `GET /api/notify/escalation`

报警升级策略、某个步骤可以指定的渠道,以及此刻打开的链条。当未设置 `HOTLOOP_NOTIFY_ENABLED` 时,`available` 为 `false`,策略关闭且没有渠道;响应仍为 `200`。读取和写入都仅限管理员:策略中包含人们的 ntfy 主题,在任何人都能访问的服务器上它们就是密码。

```json
{"available":true,"policy":{"enabled":true,"minPriority":"high","contacts":[{"name":"Ana","ntfyTopic":"ana-phone-3f9c","emails":["ana@plant.test"]}],"steps":[{"afterMinutes":5,"contacts":["Ana"]},{"afterMinutes":10,"channels":["gotify"]}],"repeatEveryMinutes":15,"repeatTimes":2},"channels":["smtp","ntfy","gotify"],"active":[{"alarmId":"boiler-hi","name":"Boiler Trip","raisedAt":"2026-10-21T03:00:00Z","sent":1,"total":4,"nextAt":"2026-10-21T03:15:00Z"}],"limits":{"steps":10,"contacts":50,"repeats":20,"minutes":1440}}
```

`channels` 是此 HotLoop 已配置的渠道,这也是一个步骤能指定的全部。`active` 是每个正沿链条推进的报警:策略总共有多少次发送,已发出了几次(步骤,然后是重复),以及下一次何时到期。尚未保存任何内容时为 `{"policy":{"enabled":false},...}`:关闭,里面什么都没有。

### `PUT /api/notify/escalation`

替换整个策略,不是补丁,并返回 `GET` 会返回的内容。它适用于从现在起触发的报警。通知未启用时返回 `400`。

```json
{"enabled":true,"minPriority":"high",
 "contacts":[{"name":"Ana","ntfyTopic":"ana-phone-3f9c","emails":["ana@plant.test"]}],
 "steps":[{"afterMinutes":5,"contacts":["Ana"]},{"afterMinutes":10,"channels":["gotify"]}],
 "repeatEveryMinutes":15,"repeatTimes":2}
```

`minPriority` 为 `critical`、`high`(默认)、`medium` 或 `low`。一个步骤在前一个步骤之后 `afterMinutes`(1 到 1440)到期,第一个在触发之后,并指定列表中的 `contacts`、部署所具有的 `channels`,或两者兼有。最多 10 个步骤、50 个联系人和 20 次重复。未知字段会被拒绝。

策略无法工作时返回 `400` 并附原因,措辞便于据此采取行动:没有指定任何人的步骤、不在列表中的联系人、此 HotLoop 未配置的渠道(响应会列出它已有的渠道)、未配置 ntfy 却有 ntfy 主题,或未配置邮件却有地址、不是普通地址的地址、没有间隔的重复。被拒绝时不会存储任何内容。保存它会记录在系统日志中,不含主题。参见[报警通知](/zh-hans/iot/notifications/#escalation)。

### `POST /api/notify/ack/{token}`

ntfy 通知上的**确认**按钮。按下它的手机没有会话可发送,所以**没有会话,也没有权限**:路径中的签名令牌就是授权,它所授权的仅是在过期之前(`HOTLOOP_NOTIFY_ACK_TTL`,默认 12 小时)确认某个报警的一次出现,且只确认一次。昨天出行时的按钮无法确认今天的报警。它有意设计为 `POST`:链接预览器和安全扫描器会自己打开链接,而报警绝不能被机器人确认。无请求体。它返回已确认的报警(形状取自处理程序;本文档中的其他示例是从运行中的 Gateway 捕获的,这一个不是,因为那个 Gateway 没有 ntfy):

```json
{"acknowledged":true,"alarmId":"extruder-temp-hi","name":"Extruder temperature high","state":"ack-active","ackedBy":"notify:ntfy"}
```

关闭确认链接时:

```json
{"error":"acknowledge links are not enabled on this HotLoop (they need HOTLOOP_PUBLIC_URL and a channel that carries a button)"}
```

这是通过报警引擎进行的普通确认,在 `notify:<channel>` 下被审计。每一次拒绝都会有响应并被记录,因为一个悄悄什么都不做的按钮,与一个没人按过的按钮看起来完全一样:

| 状态 | 何时 |
|---|---|
| 403 | 伪造、被篡改,或用另一个密钥签名 |
| 404 | 报警已不存在,或确认链接已关闭(它们需要 `HOTLOOP_PUBLIC_URL` 和带按钮的渠道) |
| 409 | 已被使用、此后报警又被触发,或没有剩余可确认的内容 |
| 410 | 真实,但已过期 |
| 503 | 无法保存确认;链接会被退还,让第二次按下仍然有效 |

响应带有 `Access-Control-Allow-Origin: *`,让 ntfy 网页应用可以从它自己的来源按下它;此路由上没有任何东西会读取 Cookie。令牌永远不会被记录,也不会在任何地方返回。参见[报警通知](/zh-hans/iot/notifications/#acknowledge-links)。

## 备份

逻辑的、仅含表数据的数据库快照。需要 `HOTLOOP_BACKUP_ENABLED`。两者都仅限管理员:列表会显示每张表的行数,包括用户和会话。**没有恢复端点**,这是有意的:恢复是二进制文件上的一个标志,由知道数据库就是为接收它而设的人运行一次,绝不是针对运行中数据库的网络调用。参见[备份与恢复](/zh-hans/iot/backup/#恢复备份)。

### `GET /api/backup`

卷上的备份,每个附带其清单。

```json
{"backups":[{"name":"20260927T202912Z","bytes":98567,"manifest":{"hotloopVersion":"4.16.0","schemaMigrations":["0001_core.sql","...","0007_service_audit.sql"],"createdAt":"2026-09-27T20:29:12.970721945Z","tables":[{"name":"devices","rows":2,"columns":[{"name":"id","type":"text"},{"name":"...","type":"..."}]}]}}],"configured":true}
```

### `POST /api/backup`

立即做一份并等待它完成(最多 30 分钟:较大的 `tag_history` 需要一段时间)。无请求体。返回清单:版本、迁移,以及每张表的行和列。

## 定时报表

历史库摘要,以 CSV 和 HTML 形式,按计划,通过邮件或下载提供。需要 `HOTLOOP_REPORTS_ENABLED`。查看者读取,操作员运行,管理员定义:定义会指出工厂数据通过邮件发往何处。定义的字段参见[定时报表](/zh-hans/gateway/reports/)。

### `GET /api/reports`

```json
{"configured":true,"reports":[{"id":"line1-hourly","name":"Line 1 hourly","enabled":true,"tags":[{"deviceId":"extruder-1","tagName":"Temperature"},{"deviceId":"extruder-1","tagName":"Pressure"}],"window":{"count":1,"unit":"hours","end":"run_time"},"bucket":"window","aggregations":["min","max","avg"],"schedule":{"kind":"daily","at":"06:00"},"format":"both","recipients":["shift-lead@example.com"],"retain":10,"createdAt":"2026-09-27T20:29:23.300978Z","updatedAt":"2026-09-27T20:29:23.300978Z","nextRunAt":"2026-09-28T06:00:00Z"}],"smtpConfigured":true,"timezone":"UTC"}
```

每个定义都带有 `nextRunAt` 以及它最近一次运行 `lastRun`。

### `POST /api/reports`

创建一个定义;请求体就是上述定义。`201`。验证失败时返回 `400`(`"report line1-hourly: window end \"now\" must be run_time or local_midnight"`),id 已存在时返回 `409`。

### `GET /api/reports/{id}`

一个定义,与列表中的相同。未知的返回 `404`。

### `PUT /api/reports/{id}`

替换整个定义。id 不能更改(请求体中的 id 不同则返回 `400`)。`nextRunAt` 和 `lastRun` 会被接受并忽略,所以你可以把读到的内容原样送回。

### `DELETE /api/reports/{id}`

删除它连同其运行和文件,并取消正在进行的运行。`{"deleted":"line1-hourly"}`,或 `404`。

### `POST /api/reports/{id}/run`

立即运行它并等待。`?deliver=false` 生成并存储它,但不给任何人发邮件,用于试验一个定义。`200` 表示运行已经发生;它自己的 `status` 说明报表是否成功。失败的运行是一个结果,而不是错误的请求,并且两种情况都会被记录。

```json
{"id":1,"reportId":"line1-hourly","trigger":"manual","actor":"admin","status":"succeeded","startedAt":"2026-09-27T20:29:54.06926Z","finishedAt":"2026-09-27T20:29:54.092456655Z","windowStart":"2026-09-27T19:29:54.06926Z","windowEnd":"2026-09-27T20:29:54.06926Z","tags":2,"rows":2,"readings":984,"excluded":2,"files":[{"format":"csv","name":"20260927T202954Z-1.csv","bytes":338},{"format":"html","name":"20260927T202954Z-1.html","bytes":2430}],"emailStatus":"skipped","emailTo":["shift-lead@example.com"]}
```

`deliver` 不是 true 或 false 时返回 `400`,未知报表返回 `404`。

### `GET /api/reports/{id}/runs`

`{"runs": [...]}`,最新的在前,`?limit=` 默认 50,最多 500。未知报表返回 `404`,而不是空列表。

### `GET /api/reports/{id}/runs/{run}/download`

以附件形式流式返回一个已存储的文件。`?format=csv` 或 `html`。

```
HTTP/1.1 200 OK
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="20260927T202954Z-1.csv"
Cache-Control: private, no-store

device_id,tag_name,unit,period_start,period_end,min,max,avg,excluded
extruder-1,Temperature,C,2026-09-27T19:29:54+00:00,2026-09-27T20:29:54+00:00,19.50001230192043,23.499980145373126,21.508905654397623,1
```

HTML 以 `sandbox` Content-Security-Policy 提供:报表是用来阅读的文档,不是允许运行任何内容的页面。打开的文件是运行记录所指明的那个;URL 中没有任何内容会成为路径的一部分。运行编号不是数字、或格式两者都不是时返回 `400`,运行或文件不存在时返回 `404`。

## 站点

### `GET /api/sites`

Gateway 联合的每个站点,通过 MCP 并行询问其工厂状态,每个 6 秒,这样一个失联的站点就不会拖住其余站点。站点就是配置中的出站 MCP 服务器。参见 [MCP](/zh-hans/iot/mcp/#federating-sites)。

```json
{"configured":true,
 "rollup":{"sites":2,"reachable":1,"devices":2,"connected":2,"tags":5,"outstandingAlarms":1,"unacknowledgedAlarms":1,"criticalAlarms":0},
 "sites":[{"name":"plant-a","reachable":true,"latencyMs":14,"plant":"Demo Plant","uptime":"1m25s","devices":2,"connected":2,"degraded":0,"disconnected":0,"tags":5,"outstandingAlarms":1,"unacknowledgedAlarms":1,"criticalAlarms":0,"writesEnabled":true},
          {"name":"plant-c","reachable":false,"error":"connect to MCP server \"plant-c\": calling \"initialize\": ... no such host","latencyMs":49,"devices":0,"connected":0,"degraded":0,"disconnected":0,"tags":0,"outstandingAlarms":0,"unacknowledgedAlarms":0,"criticalAlarms":0,"writesEnabled":false}]}
```

无法到达的站点的计数没有意义,会从汇总中去掉:把一个联系不上的站点算作零个报警,将是这个屏幕能做的最危险的事。未配置任何站点时:`{"configured":false,"sites":[]}`。

## 设置

### `GET /api/settings`

每项设置、它的有效值、值的来源,以及设置它的变量:

```json
{"groups":["Plant","Safety","Polling","Historian","Database","MCP","Server"],
 "settings":[{"key":"ui.plantName","group":"Plant","label":"Plant name","help":"...","value":"Demo Plant East","kind":"string","source":"stored","envVar":"HOTLOOP_PLANT_NAME","editable":true},
             {"key":"safety.allowWrites","group":"Safety","label":"Writes allowed","help":"...","value":true,"kind":"bool","source":"environment","envVar":"HOTLOOP_ALLOW_WRITES","editable":false},
             {"key":"database.password","group":"Database","label":"Password","help":"Never shown. It comes from the release Secret.","value":"set","kind":"secret","source":"environment","envVar":"HOTLOOP_DB_PASSWORD","editable":false}]}
```

`source` 为 `stored`、`environment` 或 `default`。`secret` 只会是 `set` 或 `not set`。`envVar` 是值所来自的变量。少数设置在 `HOTLOOP_` 变量为空时会回退到第二个变量(时区用 `TZ`,数据库用 `POSTGRES_HOST`、`POSTGRES_DB`、`POSTGRES_USER` 和 `POSTGRES_PASSWORD`),当生效的是回退变量时,`envVar` 会指明它。设为空字符串的变量视为未设置,与配置对待它的方式相同。轮询设置以毫秒显示,但它们的变量接受时长(`5s`、`500ms`)或单纯的秒数。

`Server` 分组中的 `product` 说明这是哪个 HotLoop。此产品没有、但部署仍然启用的功能(比如在 IoT 上设置 `HOTLOOP_REPORTS_ENABLED=true`)不会阻止它启动。它会在启动时记为警告,并在此处列在一个额外分组 `Not in this product` 中,附带它的变量和一行说明它在哪里。该设置保持原样,所以在具有该功能的产品上使用相同的配置就会启用它。没有设置这类内容时,该分组不存在。

### `PUT /api/settings`

更改工厂身份设置,并且只能更改这些:

| 键 | 类型 |
|---|---|
| `ui.plantName` | 字符串,最多 200 个字符 |
| `ui.siteId` | 字符串,最多 200 个字符 |
| `ui.timezone` | 这台机器认识的 IANA 名称(`America/Chicago`) |
| `ui.confirmWrites` | bool |
| `ui.kioskIdleSeconds` | 整数秒,10 到 43200:无人触碰面板时,看板登录能保持多久。默认 900 |
| `ui.lockoutAttempts` | 整数,0 到 100:连续输错密码或 PIN 多少次会锁定一个账户。默认 10,0 表示不锁定 |
| `ui.panelDelaySeconds` | 整数秒,0 到 30:输错之后,看板面板在检查下一个不带用户名输入的 PIN 之前最多等待多久。默认 3,0 表示不等待 |
| `ui.lockoutSeconds` | 整数秒,10 到 86400:被锁定的账户保持锁定多久。默认 300 |

```json
{"ui.plantName":"Demo Plant East","ui.timezone":"America/Chicago"}
```

返回完整设置,与 `GET` 一样。任何其他键都会返回 400 并指出它:

```json
{"error":"safety.allowWrites is set by the deployment and cannot be changed here"}
```

这是有意的。写入开关决定这个进程能否驱动机器,而一个可以从发出写入的同一个浏览器里打开的控制,就不是控制。更改它们属于部署。

## 历史库目标

工厂自己的数据库,HotLoop 除了写入自己的数据库之外,也把历史写入其中。参见[历史库目标](/zh-hans/iot/historian-targets/)。每个能读取设置的角色都能看到它们以及每个的状态。更改一个仅限管理员,因为目标是工厂数据的去处。密码以设备凭据密钥(`HOTLOOP_SECRET_KEY_FILE`)封存,绝不会在响应中返回;`passwordSet` 说明是否存有密码,`passwordProblem` 说明已存的密码为什么无法打开。每次更改都会进入日志并立即生效。

### `GET /api/historian/targets`

```json
{"secretKey":true,
 "kinds":[{"id":"postgres","title":"PostgreSQL or TimescaleDB","defaultPort":5432,"defaultTable":"hotloop_history",
    "databaseLabel":"Database","tableLabel":"Table","passwordLabel":"Password","usesUsername":true,"usesOrg":false},
   {"id":"sqlserver","title":"Microsoft SQL Server","defaultPort":1433,"defaultTable":"hotloop_history",
    "databaseLabel":"Database","tableLabel":"Table","passwordLabel":"Password","usesUsername":true,"usesOrg":false},
   {"id":"mysql","title":"MySQL or MariaDB","defaultPort":3306,"defaultTable":"hotloop_history",
    "databaseLabel":"Database","tableLabel":"Table","passwordLabel":"Password","usesUsername":true,"usesOrg":false},
   {"id":"influxdb","title":"InfluxDB 2 or 3","defaultPort":8086,"defaultTable":"hotloop_history",
    "databaseLabel":"Bucket (InfluxDB 3: database)","tableLabel":"Measurement","passwordLabel":"API token",
    "usesUsername":false,"usesOrg":true}],
 "targets":[{"id":"plant-pg","name":"Plant historian","kind":"postgres","address":"db.plant.local:5432",
   "database":"plant","username":"hotloop","table":"hotloop_history","useTls":true,"insecureSkipVerify":false,
   "enabled":true,"createdBy":"admin","passwordSet":true,"createdAt":"2026-10-03T09:12:04Z","updatedAt":"2026-10-03T09:12:04Z",
   "status":{"state":"down","since":"2026-10-03T10:02:11Z","queued":50000,"queueCap":50000,"written":182340,
     "backfilled":0,"dropped":1210,"refused":0,"lastWrite":"2026-10-03T10:02:10Z",
     "lastError":"failed to connect to `user=hotloop database=plant`: dial tcp 10.20.0.9:5432: connect: connection refused",
     "owedFrom":"2026-10-03T10:02:09Z"}}]}
```

`kinds` 是此 HotLoop 写入的数据库,以及各自对字段的称呼:InfluxDB 在其他数据库有密码的地方有令牌(`password` 承载它),在它们有数据库的地方有 bucket(`database`),在它们有表的地方有 measurement(`table`),还有它们都没有的组织(`org`)。`status.state` 为 `up`、`catching-up`(已连通,仍在发送它从 HotLoop 自己的历史中应得的数据)、`down`、`starting` 或 `off`(已关闭)。`queued` 是内存中等待的数量,总量为 `queueCap`。`written` 统计实时发送的读数,`backfilled` 统计从 HotLoop 自己的历史发送的读数。`dropped` 统计目标跟不上时队列放弃的读数:它们是应补的,并未丢失。`refused` 统计数据库自己不肯接受的读数,原因在 `lastRefusal` 中。`owedFrom` 和 `owedTo` 是仍然应补的范围;当终点仍然开放时没有 `owedTo`,只要目标处于停止状态就是如此。

### `POST /api/historian/targets`

```json
{"id":"plant-pg","name":"Plant historian","kind":"postgres","address":"db.plant.local","database":"plant",
 "username":"hotloop","password":"...","useTls":true}
```

`id` 为 1 到 63 个小写字母、数字和 `-`,并在系统日志中指明该目标。`address` 为 `host` 或 `host:port`,其中不含登录信息;缺失的端口由该类型的默认端口补上。`table` 默认为该类型的 `defaultTable`,可以带模式(`history.hotloop`)。`org` 是 InfluxDB 2 的组织。`enabled` 默认为 true。密码需要密钥:没有 `HOTLOOP_SECRET_KEY_FILE` 时返回 `400`,绝不以明文存储。返回 `201` 以及该目标及其状态;id 已被占用返回 `409`。

### `PUT /api/historian/targets/{id}`

上面除 `id` 之外的任何字段;没有发送的保持不变。`"password":""` 清除密码。更改会用新设置重新启动该目标,它应补的数据仍然应补。返回 `200` 和该目标。

### `DELETE /api/historian/targets/{id}`

停止向它写入,并忘掉它应补的数据。它已经持有的内容保留在它的数据库中。如果要保留设置,请改用 `"enabled":false` 将它关闭。`200` `{"deleted":"plant-pg"}`。

## 系统日志

### `GET /api/events`

每一次更改、写入、登录和连接转换,最新的在前。

| 查询 | <span class="sr-only">详情</span> |
|---|---|
| `category` | 可重复:`system`、`device`、`tag`、`write`、`alarm`、`automation`、`mcp`、`config`、`auth` |
| `severity` | 可重复:`debug`、`info`、`warning`、`error` |
| `subject` | 精确匹配:设备 id、变量键、entity_id、`equipment:4`、`label:critical` |
| `q` | 不区分大小写的搜索 |
| `minutes` | 仅最近 N 分钟 |
| `limit` | 默认 200,最多 5000 |

```json
[{"id":61,"at":"2026-09-27T20:29:23.303795Z","severity":"info","category":"config","subject":"line1-hourly","actor":"admin","message":"report created"}]
```

`actor` 是用户、`system`、`automation:<id>` 或 `mcp:<client>`。`detail` 如果有,是作为字符串的额外 JSON。

## 日志簿

### `GET /api/logbook`

一条关于发生了什么的时间线,最新的在前:实体状态变化、写入、报警转换、自动化和脚本的运行,以及来自系统日志的配置更改和服务调用。各条轨迹在原处被读取并合并,所以每条保留自己的保留期。数值读数不在其中:那是 `GET /api/history` 的用途。参见[日志簿](/zh-hans/iot/logbook/)。

| 查询 | <span class="sr-only">详情</span> |
|---|---|
| `entity` | 仅与此实体有关的内容:它的状态变化、对它及其变量的写入、它的报警、它所触发或写入过它的自动化运行、对它的配置更改 |
| `equipment_id` | 仅在设备树的此节点或其下发生的内容,规则相同。不能与 `entity` 同时使用 |
| `actor` | 操作者的不区分大小写的一部分:用户、`automation:<id>`、`mcp:<client>` |
| `kinds` | 逗号分隔或重复:`state`、`write`、`alarm`、`automation`、`event`、`script`、`recipe` |
| `from`, `to` | RFC 3339 时间;`from` 包含,`to` 不包含 |
| `limit` | 默认 100,最多 1000 |
| `before` | 上一页的 `next` |

```json
{"entries":[
  {"at":"2026-09-28T09:14:02.51Z","kind":"state","id":41,"severity":"info","message":"changed to on (was off)","entity_id":"switch.tank_farm_pump","old_state":"off","state":"on","quality":"good"},
  {"at":"2026-09-28T09:14:02.18Z","kind":"write","id":88,"severity":"info","message":"wrote true to tank-farm/pump (switch.turn_on on switch.tank_farm_pump) (was 0)","actor":"admin","source":"ui","entity_id":"switch.tank_farm_pump","device_id":"tank-farm","tag":"tank-farm/pump","call_id":"5c9f8545a93b5443"},
  {"at":"2026-09-28T09:13:40.02Z","kind":"state","id":37,"severity":"info","message":"changed to closed (was open); 14 changes before this not logged, it was changing faster than the logbook records","entity_id":"valve.infeed","old_state":"open","state":"closed","quality":"good","suppressed":14}
 ],
 "next":"MjAyNi0wOS0yOFQwOToxMzo0MC4wMlp8c3RhdGV8Mzc"}
```

`id` 是该行在其自身轨迹中的 id(对状态变化而言,是实体不可变的 id),它与 `at` 和 `kind` 一起就是 `next` 所编码的内容:此页之后的一页是在该顺序下严格更早的全部内容,不管这期间添加了什么。`next` 在最后一页省略。`suppressed` 是该实体在这次变化之前没有被记录的变化数,因为它的变化速度快过一次十个、之后每两秒一个。

未知的类型、格式错误的时间、`from` 不早于 `to`、超过 1000 的 limit、编造的游标,或同时给出 `entity` 和 `equipment_id`,返回 `400`;不存在的节点返回 `404`。当日志簿没有在响应的进程中运行时返回 `503`。

## 实时推送

### `GET /api/stream`

服务器发送事件,单向,只要你保持它打开。使用 SSE 而不是 WebSocket,因为流量只朝一个方向走,而且事件流在 pod 于打开的仪表板下重启时会自行重连。`EventSource` 发送会话 Cookie;脚本发送 bearer 令牌。

连接时你会收到 `retry: 3000`,然后是当前的画面,这样屏幕在任何东西变化之前就已填满:

```
retry: 3000

event: snapshot
data: [{"deviceId":"extruder-1","protocol":"opcua","tagName":"Temperature","tagValue":19.553128777917983,"unit":"C","quality":"good","timestamp":"2026-09-27T20:34:23.619589Z"}]

event: alarms
data: {"alarms":[...outstanding alarms...],"summary":{"critical":0,"high":1,"medium":0,"low":0,"unacked":0,"total":1}}

event: entities
data: {"changed":[...every entity state...],"removed":[]}
```

之后,随着事情发生:

| 事件 | 数据 | 何时 |
|---|---|---|
| `values` | 读数数组,`GET /api/values` 的形状,每个变量最新的一条,**仅限读数发生变化的变量** | 如果有变化,每 250 ms 一次。值、文本、单位、质量和原因都与上次发送的相同的变量会被省略,并在未发送满 30 秒后重新发送,所以稳定值的 `timestamp` 不会比这更旧。驱动在每次轮询读取每个变量;4.19.5 每次都发送全部(一台测试机的 2232 个变量,每秒四次,约 150 KB),慢速链路上的页面会落后数分钟 |
| `entities` | `{"changed": [states], "removed": [entity_ids]}` | 如果有实体状态变化,每 250 ms 一次。`removed` 是被禁用、删除或改名而消失的实体 |
| `alarm` | `{"alarm": {...}, "event": "shelved"}`,报警及其发生的事情(`raised`、`acked`、`cleared`、`shelved`、`unshelved`、`suppressed`、`unsuppressed`) | 立即:报警转换很少见,每一次都很重要 |
| `device` | `{"deviceId":"tank-farm","state":"connected"}` | 立即:设备掉线时屏幕应当变红,而不是在下一次刷新时 |
| `logbook` | `{"kinds":["state","write"]}`,哪些类型的日志簿条目有新内容 | 最多每秒一次。其中没有条目,因为屏幕应当显示什么取决于它的过滤器:它向 `GET /api/logbook` 请求自己的那一页 |

```
event: alarm
data: {"alarm":{"definitionId":"extruder-temp-hi","state":"shelved","shelvedUntil":"2026-09-27T20:39:45.839983854Z","shelvedBy":"admin","...":"..."},"event":"shelved"}

event: device
data: {"deviceId":"tank-farm","state":"connected"}
```

每 20 秒一行注释(`: heartbeat 2026-09-27T20:35:00Z`)可防止代理关闭空闲连接。每个打开的页面各自控制节奏:它的写入方休息的时间等于它上一次发送所用的时间(最多五秒),期间到达的内容按变量和实体保留,只保留最新的,所以慢速链路上的页面只落后工厂一两次发送,绝不会落后数分钟,不会丢失任何内容,也不会占用其他页面的任何东西。当请求带有 `Accept-Encoding: gzip`(浏览器会带)时,流会用 gzip 压缩,这会把一台测试机的第一幅画面在线路上从约 326 KB 降到约 11 KB。响应设置 `X-Accel-Buffering: no`,因为带缓冲的代理会把实时推送变成非常慢的下载。

流每五秒重新检查一次它的会话,会话消失时就关闭:已登出、过期、被撤销,或账户被禁用或不再被允许 `status.read`。它不会先发送任何事件。浏览器的 `EventSource` 会重连,收到上面的 `401`,然后停止。使用 `HOTLOOP_AUTH_INSECURE=true` 时没有会话,也没有可检查的东西。这项检查不算作会话被使用,所以一直开着的屏幕不会让会话保持新鲜。

## MCP

### `/mcp` 和 `/mcp/`

Model Context Protocol,可流式传输的 HTTP 传输,供智能体使用。任何方法:传输用 `POST` 发起调用,用 `GET` 获取服务器自己的流,用 `DELETE` 结束会话。路径是 `HOTLOOP_MCP_PATH`(默认 `/mcp`),只有当 `HOTLOOP_MCP_ENABLED` 开启时端点才存在。

它**不**在会话登录之后。它有自己的 bearer 令牌 `HOTLOOP_MCP_TOKEN`,在处理程序之前检查,所以没有令牌的调用者甚至无法列出工具:

```
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="hotloop"

unauthorized
```

未配置令牌时,HotLoop 会在首次启动时生成一个并保存在它的数据库中(`hotloop mcp-token` 会打印它),所以端点永远不会敞开。智能体和其他调用者一样:它读取和写入,它的写入与所有人的写入一样经过同一个写入门,并以 `mcp:<client name>` 被审计。工具和资源见 [MCP](/zh-hans/iot/mcp/)。

```
POST /mcp
Authorization: Bearer <token>
Accept: application/json, text/event-stream

{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"1"}}}
```

响应带有 `Mcp-Session-Id` 头以及服务器的能力和说明。

## 界面

### `GET /manifest.webmanifest`

Web 应用清单,让手机能把界面安装为应用:产品和工厂名称、`display` `standalone`、主题颜色、图标(192 和 512 像素的 PNG、一个可遮罩的 512 以及 SVG),以及指向报警和仪表板的快捷方式。其中每个 URL 都相对于清单自身的 URL,所以无论 HotLoop 挂载在哪里都是正确的。名称跟随在设置中设定的工厂名称,响应为 `Cache-Control: no-cache`,这样改名在下次查看时就会显示。没有会话:手机在任何人登录之前就会请求。参见[仪表板](/zh-hans/iot/dashboards/#在手机上)。

### `GET /sw.js`

Service worker,位于 HotLoop 挂载位置的根部,因此它的范围覆盖整个应用。它保留页面以及人们查看的读取的最近一次响应,并在 HotLoop 无法访问时将它们标记为旧数据后返回。它绝不会响应、保留或排队任何写入。运行的版本就在其中,所以每个版本都有自己的页面缓存。`Cache-Control: no-cache`;没有会话。只有处于安全上下文(https 或 `localhost`)的浏览器才会运行它。

### `GET /next` 和 `GET /next/`

旧界面还是默认界面时,界面所在的位置。两者都是指向根的 `301`,所以当时留下的书签仍然有效。

### `/`

Web 界面,从 `web/` 构建进二进制文件:一个页面,它的脚本、样式和字体,一个 service worker,以及可安装应用的图标,其中每个 URL 都相对于页面,因此它能运行在主机的根上、某个路径下、代理之后,或 EmberNet 仪表板的 iframe 内。服务器填入标题和一个数据块 `<script type="application/json" id="iiot">`,内容是只有它知道的:工厂、站点、产品、功能、写入策略和时区。只支持 `GET` 和 `HEAD`;任何其他方法返回 `405`。不属于它的文件的路径返回 `404`,因为为一个拼写错误提供该页面会让它看起来像一个正常工作的屏幕,而不带界面构建的二进制文件会用纯文本说明这一点以及如何构建。没有会话:在你登录之前,页面就是登录表单。
