---
title: "报警通知与升级"
description: "支持 ntfy、Gotify、Discord、Webhook 和电子邮件。在手机上点按确认，报警即被确认，签名且仅限使用一次。"
---

报警通知自 4.10.0 起，会在凌晨 03:00 触发报警时给手机发出提醒。当报警被**触发**时，HotLoop 会通过每个已配置且已开启、且报警达到其优先级下限的渠道发送通知。自 4.23.6 起在 Helm chart 中默认开启（`HOTLOOP_NOTIFY_ENABLED`），在某个渠道连同其目的地一起被启用之前不会发送任何东西：没有人可通知的部署，在这里没有什么需要配置的。

## 为什么只在“触发”时通知

`alarm.Engine.OnTransition` 会在每一次 ISA-18.2 状态转换时触发：触发、恢复、确认、搁置、取消搁置。这个包监听所有转换，但只对其中一种采取行动。如果每次转换都通知，操作员确认自己的报警时、报警自行恢复时、有人把它搁置一个班次时，手机都会响。这会让人养成不读就划掉通知的习惯，就像反复抖动的报警会让人习惯于忽视报警一样。“触发”是唯一表示“需要一个可能没在看屏幕的人”的事件，这正是这个包存在的全部原因。

唯一的另一种通知是升级：报警已触发，没有人确认，而策略规定要通知下一个人。这仍是同一个需要人处理的报警，只是再次告知另一个人，并不是新事件。参见“升级”。

有一种情况看起来像取消搁置，实际上是触发。如果报警被搁置期间条件成立，没有人被告知，所以搁置结束时（超时或手动取消），引擎会先记录取消搁置，再记录一次触发，而这次触发会发出通知。搁置时已处于报警状态且仍然如此的报警，会以未确认状态回来，但不会再次通知：它第一次已经通知过了。

## 渠道

共六个，这就是全部清单（我们不做什么以及原因，参见 [HotLoop 路线图](/zh-hans/roadmap/)中的“通知”）。每个渠道都不需要厂商 SDK，也不需要付费账号，这符合本项目既定的方案：云集成是由操作员配置的可选出站连接，绝不是本应用运行所必需的东西。

- **ntfy**：推送到手机，带有**确认**按钮，可直接在 HotLoop 中确认报警。免费，并且您可以在工厂网络内运行服务器，完全不需要互联网。参见“设置 ntfy”。
- **Gotify**：推送到手机。免费、自托管，无需互联网即可使用。没有按钮，也没有 iPhone 应用，所以它是呼机，而不是双向渠道。参见“设置 Gotify”。
- **Discord Webhook**：Discord 频道中的一条嵌入消息，按优先级着色，包含变量、值、限值、区域和产线。粘贴一个 URL 就能用。严重报警可以提及某个角色。没有按钮。参见“Discord”。
- **Discord 机器人**：同样的消息，带有**确认**和**搁置**按钮，这些按钮会对报警执行操作并记录是谁按的。按键事件通过 HotLoop 主动向 Discord 打开的连接传回，所以工厂不需要公网地址。参见“Discord”。

- **Webhook**：向配置的 URL 发送 HotLoop 自己的 JSON 正文的 POST 请求（`alarmId`、`name`、`priority`、`priorityLabel`、`message`、`deviceId`、`tagName`、`raisedAt`、`event`，其值为 `raised`，升级时为 `escalated`）。它适用于任何接收您所发 JSON 的东西：放在小型 HTTP 监听器后面的您自己的脚本、Node-RED、n8n，或工作流工具里的“捕获任意 webhook”触发器。（如果指向 ntfy 主题，也会通知，但原始 JSON 会作为文本；请改用上面的 ntfy 渠道。）摘要（参见“速率限制与摘要”）的 `event` 为 `summary`，并带有一个列出其中每个报警名称的 `alarms` 列表。它不适用于要求正文采用其自有格式的服务。Discord 会返回 400，因为没有 `content` 或 `embeds`。Slack、Teams 和 Google Chat 需要它们自己的文本字段。Pushover 需要它的 `token`、`user` 和 `message` 字段，PagerDuty 的 Events API 需要 `routing_key`、`event_action` 和 `payload`。把 webhook 指向其中任何一个，每次通知都会失败。Discord 有专门的渠道来构造 Discord 期望的正文，请使用那些渠道。
- **通过 SMTP 发送电子邮件**：经由操作员已有的任何中继发送（企业邮件服务器、事务邮件服务商的 SMTP 端点、自托管中继）。不需要 API 密钥，不需要厂商库：只有 `net/smtp` 和一封手工构造的纯文本邮件。许多手机已经会把电子邮件显示为推送通知，许多呼叫工具也接受邮件转短信的桥接地址作为“联系方式”，所以仅这一个渠道，就无需任何付费依赖地覆盖了“呼叫手机”的相当一部分需求。

## 报警发往何处：设置

每个渠道默认开启，在有地方可发送之前保持空闲。已开启但没有目的地的渠道绝不会阻止 HotLoop 启动，它会等待并说明这一点。管理员在设置的“报警和读数发往何处”中为每个渠道指定目的地：Webhook URL、邮件中继和收件人、ntfy 服务器和主题、Gotify 服务器和令牌、Discord Webhook URL、Discord 机器人的令牌和频道，以及边缘发布器的 broker 和 Sparkplug 组。每个渠道都会显示它正在做什么（发送中、等待目的地、已关闭）以及缺少什么。

- 报警渠道在设置保存的那一刻生效：分发器就地重建，旧渠道扣留的内容先发出去，Discord 机器人的连接在打开新连接之前关闭。随后**发送测试**（`POST /api/notify/test`）会到达刚保存的渠道。
- 边缘发布器拥有一个队列文件和一个 Sparkplug 节点，所以它的目的地在 HotLoop 启动时读取。界面显示“Saved, applies when HotLoop restarts”。
- 那里保存的内容优先于 chart 或环境变量，后者只是提供初始值。留空的值会保留已存储的内容；清除会将其移除。密钥（Webhook URL、ntfy 主题、令牌、密码）绝不会再次显示，只显示是否已设置，并且在 HotLoop 有密钥时会在数据库中加密封存。
- 目的地在存储任何内容之前，会按启动时检查环境变量的方式检查，错误的目的地会被拒绝并说明哪里不对（绝不包含值）。
- 每个渠道有一个开关可将其彻底关闭：关闭意味着没有渠道，不发送。
- `GET /api/destinations` 和 `PUT /api/destinations/{kind}` 是相关路由；PUT 需要 `settings.write`。参见 [HTTP API](/zh-hans/iot/api/)。

## Webhook URL 永远不会被打印

对许多接收方来说，URL 就是密码。Discord 把令牌放在路径里（`/api/webhooks/{id}/{token}`），ntfy 以 `?auth=` 接收，Google Chat 以 `?key=` 和 `?token=` 接收。持有 URL 的人都可以向您的频道发帖。所以发送失败时，错误中只会写出协议和主机，别无其他：

```
webhook request to https://discord.com failed: context deadline exceeded
webhook https://ntfy.example.com returned 401 Unauthorized
```

日志、审计事件和 `POST /api/notify/test` 的响应里都是同样的文字。主机已足以判断是哪个接收方出了问题；路径和查询参数绝不会离开进程。启动时校验失败的 URL 也不会在该错误中重复出现。如需查看 URL，请到您设置它的地方查看 `HOTLOOP_NOTIFY_WEBHOOK_URL`。

## 设置 ntfy

[ntfy](https://ntfy.sh) 是一个发布与订阅式的推送服务器。HotLoop 把每个报警发布到一个主题；手机上的 ntfy 应用订阅该主题。

1. 运行一台服务器，或使用 ntfy.sh。在工厂网络里请自己运行一台（`binwiederhier/ntfy`，一个容器）并加以锁定：设置 `auth-default-access: deny-all`，为 HotLoop 创建一个可写入该主题的用户，再为每个人创建一个可读取的用户。在 ntfy.sh 或任何人都能访问的服务器上，**主题名称就是密码**：任何猜到它的人都能读取您的报警。请把它设得又长又随机。
2. 给 HotLoop 一个访问令牌（`ntfy token add hotloop`），或该用户的用户名和密码。
3. 把 `HOTLOOP_PUBLIC_URL` 设置为手机访问 HotLoop 所用的地址，例如 `https://hotloop.plant.example`。没有它，通知仍会到达，但没有确认按钮，也不能点按打开，因为手机没有地方可以发送这两者。
4. 完成配置并重启：

```
HOTLOOP_NOTIFY_ENABLED=true
HOTLOOP_NOTIFY_NTFY_ENABLED=true
HOTLOOP_NOTIFY_NTFY_URL=https://ntfy.plant.example
HOTLOOP_NOTIFY_NTFY_TOPIC=boiler-house-alarms
HOTLOOP_NOTIFY_NTFY_TOKEN=tk_...
HOTLOOP_PUBLIC_URL=https://hotloop.plant.example
```

5. `POST /api/notify/test` 会发送一条测试通知。它没有确认按钮，因为背后没有可确认的报警。

URL 只是服务器。主题放在它自己的设置里，绝不放进 URL：这样 HotLoop 知道哪一部分是机密，并把它排除在每条错误、日志行和审计事件之外。

收到的内容：

| <span class="sr-only">详情</span> | <span class="sr-only">详情</span> |
|---|---|
| 标题 | 报警的名称 |
| 正文 | 报警的消息、它的优先级、来源（`device/tag`）以及触发时间 |
| 优先级 | 严重 5（最高：在 Android 上，如果您允许，它可以突破勿扰模式），高 4，中 3，低 2 |
| 标签 | 按严重程度选择的表情符号，以及用文字表示的优先级，方便在手机上快速浏览列表 |
| 点按 | 设置了 `HOTLOOP_PUBLIC_URL` 时，打开 HotLoop 的报警列表 |
| 按钮 | **确认**，设置了 `HOTLOOP_PUBLIC_URL` 时出现。参见“确认链接” |

### iPhone 的限制

Android 完全无需互联网也能工作：ntfy 应用保持自己与您服务器的连接，通过工厂 Wi-Fi 即时收到每条消息。

iPhone 则不行。苹果只允许推送通过它自己的服务器（APNs），而只有 ntfy.sh 能与 APNs 通信。自托管服务器必须配置 `upstream-base-url: https://ntfy.sh`，这样它会把一个轮询请求（不含消息内容，只是“这个主题上有东西到了”）转发给 ntfy.sh，由 ntfy.sh 唤醒手机，再由手机从您的服务器获取消息。所以在没有互联网的工厂里，iPhone 无法从自托管的 ntfy 即时收到通知，只有打开应用时才会看到。如果您的人员使用 iPhone，而工厂又与互联网隔离，ntfy 就不是您的呼机；通过中继发送的电子邮件才是，或者在工厂能访问 Discord 时用 Discord。Gotify 则根本没有 iPhone 应用。

确认按钮是从手机发往 `HOTLOOP_PUBLIC_URL` 的请求，所以手机必须能访问该地址：在工厂 Wi-Fi 上，或通过您使用的任何 VPN。它在两个平台上的行为相同。

## 设置 Gotify

[Gotify](https://gotify.net) 是一个小型自托管推送服务器，带有 Android 应用。不需要互联网，也无需在任何地方注册账号。

1. 运行 `gotify/server` 并登录它的 Web 界面。
2. 在 **Apps** 下创建一个名为 HotLoop 的应用。复制它的令牌。
3. 完成配置并重启：

```
HOTLOOP_NOTIFY_ENABLED=true
HOTLOOP_NOTIFY_GOTIFY_ENABLED=true
HOTLOOP_NOTIFY_GOTIFY_URL=https://gotify.plant.example
HOTLOOP_NOTIFY_GOTIFY_TOKEN=A...
HOTLOOP_PUBLIC_URL=https://hotloop.plant.example
```

令牌放在 `X-Gotify-Key` 头里，绝不能以 `?token=` 放进 URL，否则它会出现在每个代理的访问日志中。

优先级会对应到 Android 应用对它们的处理：严重 10 和高 8 是高重要性（有声音和弹出提示），中 5 是带声音的普通通知，低 2 是静音。消息是 Markdown（报警名称加粗，详情为列表，报警自身的文本经过转义，所以名称中带星号也会按该名称显示），设置了 `HOTLOOP_PUBLIC_URL` 时，点按它会打开 HotLoop 的报警列表。

**不能确认。** Gotify 通知没有操作按钮，所以没有办法在上面放确认按钮，我们也不会用一个仅凭普通 GET 就确认的链接去假装：链接预览器和安全扫描器会自己打开链接，而报警绝不能被机器人确认。请在 HotLoop 中确认。**也没有 iPhone 应用。**

## Discord

有两种方式。Webhook 是呼机：粘贴一个 URL，就能在频道里收到报警。机器人是双向的：同样的消息带有**确认**和**搁置**按钮，审计记录会写明是哪个人按的。两者都需要工厂能通过互联网访问 Discord（向 `discord.com` 的出站 HTTPS，机器人还要连到 `*.discord.gg` 的 WebSocket）。两者都不需要 Discord 访问工厂。

### 收到的内容

| <span class="sr-only">详情</span> | <span class="sr-only">详情</span> |
|---|---|
| 文本 | `[Critical] Boiler Trip`，即手机推送通知显示的内容。严重报警时，前面会加上对所配置角色的提及 |
| 嵌入标题 | 同上，设置了 `HOTLOOP_PUBLIC_URL` 时链接到 HotLoop 的报警列表 |
| 颜色 | 严重为红色，高为橙色，中为黄色，低为蓝色 |
| 描述 | 报警的消息 |
| 字段 | 变量（`device/tag`）、值（触发报警的读数）、限值（定义中的 `hi 90`）、区域 / 产线（来自设备）、触发时间（按每位读者各自的时区） |
| 页脚 | `HotLoop | <HOTLOOP_PLANT_NAME>`，这样包含多个工厂的服务器可以区分它们（未设置工厂名称时只有 `HotLoop`） |
| 按钮（仅机器人） | 确认、搁置 1 小时、在 HotLoop 中打开 |

报警洪峰会变成摘要，与其他每个渠道一样：前五条照常发出，然后用一条消息列出其余的，在放得下的范围内列出名称，并给出其他报警的数量，所以数量永远不会被截断。

Discord 会拒绝过长的消息（文本 2000 个字符，标题 256，描述 4096，字段 25 个，总共 6000），而被拒绝的消息就是没发出去的通知。所以 HotLoop 会在字符边界处截断以适应，并在截断处加上 `...`。

### 不会有人被误提及

每条消息发出时都带有 `allowed_mentions: {"parse": []}`。没有它，Discord 会提及文本中出现的任何对象，这样一个被人命名为“@everyone tank overflow”的报警会叫醒整个服务器。有了它，文本中的任何内容都不会提及任何人。唯一的例外是您为严重级别配置的角色（`..._CRITICAL_ROLE`），它被明确指定为唯一允许的提及，并且只在严重报警，或包含严重报警的摘要时才会提及。测试通知从不提及任何人。报警自身的文本也会做 Markdown 转义，所以名称中带 `*` 也按该名称显示，名称中的 `<@&role>` 只是显示出来，不会被使用。

要让提及生效，该角色必须允许被提及：在服务器的角色设置中打开 **Allow anyone to @mention this role**，或者授予机器人 **Mention @everyone, @here, and All Roles** 权限。

### Discord 的速率限制与封禁

Discord 用 429 回答“太快了”，并在响应体（`retry_after`，精确到毫秒）和 `X-RateLimit-Reset-After` 中说明要等多久。HotLoop 在重试前等待相应的时间，并且在通常的三次尝试和 30 秒之内（参见“重试”）。当 Discord 在拒绝之前告知配额已用完（`X-RateLimit-Remaining: 0`）时，下一次发送会等待重置，而不是去换一个 429。

Discord 会封禁在十分钟内累计 10,000 次被拒请求（401、403、429）的地址，封禁会连带该地址上的所有 Discord 集成。所以当 Discord 返回 **401、403 或 404**（webhook 错误或已删除、机器人令牌错误、机器人看不到的频道）时，HotLoop 会在那一次请求之后**关闭该渠道**。它只记录一次日志，之后的每个报警都不再发出请求就被拒绝（并在审计中记为未发送，这样“有没有人被通知”仍有答案），并在 `GET /api/diagnostics` 的 `notify.channels` 下显示，附上原因和时间：

```json
{"channel": "discord-webhook", "broken": true,
 "reason": "discord webhook https://discord.com returned 404 Not Found: Unknown Webhook (Discord error 10015)",
 "since": "2026-09-27T03:00:01Z"}
```

请修正设置并重启 HotLoop。500 或根本没有响应不会关闭任何东西；它们会像其他渠道一样被重试。

### 设置 webhook

1. 在 Discord 中，打开频道设置（齿轮），**Integrations**，**Webhooks**，**New Webhook**。命名为 HotLoop。**Copy Webhook URL**。
2. 可选：严重级别时要提及的角色。打开 **Developer Mode**（User Settings，Advanced），然后在 Server Settings，Roles 中右键点击该角色，选择 **Copy Role ID**。它是一个数字，不是名称。
3. 完成配置并重启：

```
HOTLOOP_NOTIFY_ENABLED=true
HOTLOOP_NOTIFY_DISCORD_WEBHOOK_ENABLED=true
HOTLOOP_NOTIFY_DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/1234.../AbCd...
HOTLOOP_NOTIFY_DISCORD_WEBHOOK_CRITICAL_ROLE=123456789012345678
HOTLOOP_PUBLIC_URL=https://hotloop.plant.example
```

4. `POST /api/notify/test` 会发送一条测试消息。

**整个 URL 就是密码。** 持有它的人都可以以该 webhook 的身份向您的频道发帖。HotLoop 绝不会打印它：不在日志里，不在错误里，不在审计事件里，不在 API 响应里，启动时校验失败的 URL 也不会在该错误中重复出现。在 Helm chart 中，它放在 Secret 里。如果泄露，请在 Discord 里删除该 webhook 并新建一个。

Webhook 不能带有能执行操作的按钮，所以这里没有确认。标题会链接到 HotLoop 中的报警列表。需要按钮，请使用机器人。

### 设置机器人

1. 进入 [Discord 开发者门户](https://discord.com/developers/applications)，**New Application**，命名为 HotLoop。General Information 页面上的 **Application ID** 是邀请链接所需要的。
2. **Bot** 标签页：**Reset Token** 并复制。Discord 只显示一次。这就是 `HOTLOOP_NOTIFY_DISCORD_BOT_TOKEN`。在同一页面关闭 **Public Bot**，这样除您之外没有人能把它添加到服务器，并让三个 **Privileged Gateway Intents** 全部保持关闭。HotLoop 完全不向 Discord 请求任何事件（intents 0）；按键事件无论如何都会到达。
3. 用它所需的最小权限邀请它进入您的服务器：View Channels、Send Messages 和 Embed Links（权限 `19456`），并且除 `bot` 外不加其他 scope：

```
https://discord.com/oauth2/authorize?client_id=<APPLICATION ID>&scope=bot&permissions=19456
```

   只有当严重角色不允许被提及，而您又不想改成允许时，才添加 **Mention @everyone, @here, and All Roles**（`permissions=150528`）。按键之后编辑它自己的消息不需要权限；那是通过按键本身完成的。
4. 频道：打开 Developer Mode 后，右键点击它，选择 **Copy Channel ID**。如果频道是私有的，请把机器人的角色加进去。
5. 可以按按钮的角色。创建一个角色（比如“Alarm ack”），授予可以在 Discord 里确认的人，并复制它的 id。搁置会把报警从列表中拿掉一小时，所以它有自己的设置；可以是同一个角色，也可以是范围更窄的角色。
6. 完成配置并重启：

```
HOTLOOP_NOTIFY_ENABLED=true
HOTLOOP_NOTIFY_DISCORD_BOT_ENABLED=true
HOTLOOP_NOTIFY_DISCORD_BOT_TOKEN=MTIz...
HOTLOOP_NOTIFY_DISCORD_BOT_CHANNEL=223456789012345678
HOTLOOP_NOTIFY_DISCORD_BOT_ACK_ROLES=323456789012345678
HOTLOOP_NOTIFY_DISCORD_BOT_SHELVE_ROLES=423456789012345678
HOTLOOP_NOTIFY_DISCORD_BOT_CRITICAL_ROLE=323456789012345678
HOTLOOP_PUBLIC_URL=https://hotloop.plant.example
```

7. 日志里会显示 `connected to the Discord Gateway; Discord buttons work`，`GET /api/diagnostics` 会在 `discord` 渠道下显示 `"gateway": {"connected": true}`。`POST /api/notify/test` 会发布一条测试消息（没有按钮，背后没有报警）。

**在您设置角色之前，没有人能按任何按钮。** 当 `HOTLOOP_NOTIFY_DISCORD_BOT_ACK_ROLES` 或 `_SHELVE_ROLES` 为空时，对应按钮的每一次按下都会被拒绝，按的人会被告知哪个设置是空的，HotLoop 也会在启动时说明：

```
WARN NOBODY can acknowledge alarms from Discord, because HOTLOOP_NOTIFY_DISCORD_BOT_ACK_ROLES is empty...
```

这是有意为之。服务器里任何人都能按的按钮，不是应该作为默认值交付的东西：服务器总是会不断积累人。

**是谁按的。** 来自 Discord 的确认会记录在 `discord:<username>#<user id>` 之下（用 id 是因为 Discord 用户名可以更改而 id 不能），备注为“acknowledged from Discord by alice (1010...)”。要记录在 HotLoop 用户名下，请建立映射：`HOTLOOP_NOTIFY_DISCORD_BOT_USERS=101010101010101010=alice,202020202020202020=bob`。映射只是指明操作者是谁。它不会检查该 HotLoop 用户的权限：谁能按由 Discord 角色决定。

**搁置**会搁置 `HOTLOOP_NOTIFY_DISCORD_BOT_SHELVE` 的时长，默认一小时，与任何搁置一样最长 24 小时。它是固定时间，不是菜单：在 03:00，一个做一件已知事情的按钮，比一个下拉菜单更好。它会拒绝已恢复正常的报警（搁置它会隐藏下一次触发它的原因）以及已被搁置的报警。

按下之后，消息会写明谁在何时做了什么，两个按钮都会变灰，这样下一个查看频道的人就能看到已经有人处理了。被拒绝的按键只会向按键的人答复，并附上原因，同时记录到系统日志中。

### 一次按键如何获得授权

与 ntfy 确认链接（参见“确认链接”）的机制相同，再加上 Discord 自己对谁按下的说明：

- **按钮是经过签名的。** 每个按钮都带有一个令牌，用与确认链接相同的密钥签名，针对该操作（确认或搁置，写进签名里，所以一个不能被当作另一个重放），针对该报警，针对它被触发的那一刻。Discord 允许一个按钮携带 100 个字符的数据，而报警 id 可以有 64 个，所以这是同一个声明的紧凑形式：8 字节触发时间、4 字节有效期和 96 位 HMAC。伪造它意味着要猜 96 位，每猜一次就是一次 Discord 按键，而且要从服务器内部、持有正确角色。
- **按键的人持有您指定的角色。** Discord 会通过机器人自己的已认证连接，把按键者的角色与按键一起告知机器人。能在您的服务器里分配角色的人，也能分配这个角色，所以请把这些角色当作它们实际代表的权限来对待。
- **该次触发仍是当前的。** 引擎在自己的锁之下检查，报警当前的这次触发是不是按钮上的那一次。昨天的消息不能确认今天的跳闸。
- **仅一次。** 任何通知（ntfy 或 Discord）对某次触发的第一个操作会被记录，之后所有操作都会被拒绝。两个人同时按：一个成功，另一个会被告知。
- **会过期。** 过了 `HOTLOOP_NOTIFY_ACK_TTL`（12 小时）后，按钮失效；请在 HotLoop 中操作。

机器人令牌是整个机器人的凭据。它从不写入日志，从不出现在错误中，从不出现在 API 响应里；在 Helm chart 中，它放在 Secret 里。每次按键自己的交互令牌也是如此，Discord 会给机器人十五分钟来答复它。如果机器人令牌泄露，请在开发者门户中重置它。

### Gateway 连接

按键事件通过 Discord Gateway 到达，这是 HotLoop 向 Discord 打开并保持的一个 WebSocket。客户端是 HotLoop 自己的，基于 [gorilla/websocket](https://github.com/gorilla/websocket)（v1.5.3，已固定版本；它本来就在这个模块的依赖图中，体积小，并且是 Go 里使用最广泛的 WebSocket 库）。我们没有采用 discordgo 这样的 Discord 库：它是一整套 Discord SDK（REST、语音、状态缓存），而我们只需要一个事件，并且本项目不携带厂商 SDK。该客户端：

- 以 intents 0 标识自己，所以 Discord 除按键事件外什么都不会发给它；
- 按 Discord 给出的间隔发送心跳，立即回应心跳请求，并把未被确认的心跳视为连接已断；
- 在断线、Reconnect（op 7）或可恢复的 Invalid Session（op 9）之后恢复会话，所以重连期间发生的按键会被重放而不是丢失；无法恢复的会话会等待一到五秒再开始新的会话；
- 每五秒最多标识一次，当 Discord 说明当天的会话启动次数已用完时则完全不标识，直到重置；
- 以从一秒翻倍到一分钟的退避时间重连；
- 在令牌或 intents 被拒绝时永久停止，关闭该渠道并显示在 `/api/diagnostics` 中，而不是一直重连下去。

Discord 给机器人三秒钟来答复一次按键，所以 HotLoop 首先做的是答复“收到”（一个延迟更新），然后再去做事。这个答复也是防止两个 HotLoop 副本都对同一次按键采取行动的原因：两者都会收到它，Discord 接受第一个答复并拒绝第二个，被拒绝的副本就会停止。当作为 MCP 辅助进程（`--mcp-stdio`）运行时，HotLoop 完全不打开 Gateway 连接；由真正的那个实例处理按键。

## 速率限制与摘要

一次电压骤降或 PLC 重启，会在一秒内触发四十个报警。每个报警发一条，会让 Discord webhook 的 IP 被封，触发 ntfy 的按 IP 限制，并让那个重要的报警被淹没在接收它们的手机上的三十九个不重要的报警之下。所以每个渠道都有一份预算，即令牌桶：一个可以一次发出的突发量，然后每次补充再多发一条。

| 渠道 | 默认突发量 | 之后每隔 |
|---|---|---|
| ntfy | 10 | 5 s（低于 ntfy.sh 自身 60 的限制，之后按 IP 每 5 s 一条） |
| Gotify | 10 | 5 s |
| Webhook | 10 | 5 s |
| SMTP | 5 | 12 s |
| Discord webhook | 5 | 2 s（Discord 允许一个 webhook 约每 2 s 发 5 个请求，一个频道每分钟 30 条消息） |
| Discord 机器人 | 5 | 2 s |

可以按渠道用 `HOTLOOP_NOTIFY_<CHANNEL>_BURST` 和 `HOTLOOP_NOTIFY_<CHANNEL>_REFILL` 修改（`WEBHOOK`、`SMTP`、`NTFY`、`GOTIFY`、`DISCORD_WEBHOOK`、`DISCORD_BOT`）。

预算允许的部分会立即自行发出。不允许的部分会被暂存，等到下次发送的时间，所有暂存的内容会作为**一条**摘要发出：

```
7 more alarms raised in the last 12 s:
- [High] Line 3 Stopped
- [Critical] Boiler Trip
...
```

没有报警会被丢弃：摘要会列出每一个，最多 25 个，并统计其余的（“...and 13 more”）。它的严重程度与其中最严重的报警一致，它的审计事件会列出它所代表的每个报警 id。它没有确认按钮，因为没有哪个单独的报警可供它确认。如果只暂存了一个报警，它就以报警本身的形式发出，连按钮一起。一旦有报警被暂存，即使预算已经恢复，新的报警也会加入这一批，这样摘要永远不会晚于其中任何一个报警之后才触发的报警到达。关闭时，仍被暂存的内容会立即发出，超出预算：此时要在多发一次，和有报警永远没人被告知之间做选择。

预算是按渠道计的，所以让 SMTP 中继排队的洪峰不会拖慢 ntfy，每个渠道的下限也仍然适用：低优先级的报警永远不会进入设为高及以上的渠道的摘要。

## 重试

收到 429、5xx 或根本没有响应（被拒绝、被重置、超时）的发送会被重试，总共最多三次，全部在首次尝试后的 30 秒内。当接收方说明要等多久（`Retry-After`，以秒或日期表示）时，我们就等那么久；否则先等一秒，再等两秒。要求等待超过剩余 30 秒的接收方不会被等待：失败会立即报告，并说明原因。30 秒后，一条没有发出的通知，最好在日志和审计记录中报告为失败，而不是在报警一直挂着的时候悄悄重试好几分钟。

任何其他 4xx（令牌错误、用户无法写入的主题、格式错误的请求）永远不会重试。在有人修正配置之前，每次答案都一样，而 Discord 会封禁不断发送已被拒绝请求的 IP。

`POST /api/notify/test` 对每个渠道只尝试一次。测试是在问渠道此刻的行为，而重试会让不稳定的接收方看起来正常。

## 确认链接

ntfy 通知上的确认按钮，是向 `HOTLOOP_PUBLIC_URL` 上的 `POST /api/notify/ack/{token}` 发出的请求。在 03:00 按它的人没有登录任何东西，所以**令牌就是全部授权**。这只有在令牌不可伪造、范围狭窄、仅可使用一次且有效期短的情况下才成立，并且这些都得到了强制执行：

- **不可伪造。** 令牌是一个声明（哪个报警、何时触发、哪个渠道、链接何时过期）加上用服务器密钥对它计算的 HMAC-SHA256。改动一个字节，或用任何其他密钥签名，都会被拒绝。如果您设置了，密钥就是 `HOTLOOP_NOTIFY_ACK_SECRET`（至少 32 个字符；`openssl rand -hex 32`）。如果没有设置，HotLoop 会在第一次需要时生成 32 个随机字节，并保存在它的数据库中（`settings` 表，键 `notify.ackSecret`），所以链接在重启后仍然有效，并且每个副本都一致。它从不在设置界面或任何 API 响应中显示。它在数据库备份里，和数据库中的其他一切一样；如果这对您是个问题，请从 Kubernetes Secret 设置该变量（chart 中的 `notify.ackSecret.existingSecret`），这样它就永远不会接触数据库。更改密钥会使已发出的每个链接失效，这也是一次性撤销它们全部的方法。
- **范围狭窄。** 声明指明一个报警**以及它被触发的时刻**。同一个报警昨天跳闸时的按钮，不能确认今天那次还没有人看过的跳闸：引擎在与确认相同的锁之下检查，报警当前的这次触发是否就是声明里的那一次（`alarm.Engine.AckOccurrence`）。链接只能确认，别无其他。它不能搁置、恢复、写入变量或读取任何内容，所以泄露的链接最坏能做的，恰好就是按下按钮所能做的。
- **仅可使用一次。** 某次触发的链接第一次使用会记录在数据库里（`notify_ack_links`），之后每次使用都会被拒绝，即使报警在没有新触发的情况下需要再次确认（仍处于报警时被搁置，又被取消搁置，于是以未确认状态回来）。仅靠报警自身的状态做不到这一点；需要有这条记录。
- **有效期短。** 默认在发送 12 小时后过期（`HOTLOOP_NOTIFY_ACK_TTL`，最长 168h）。长到足以应对“我到了再看”，短到通知的截图不会成为一直有效的凭据。

一次成功的按键，是通过报警引擎进行的普通 ISA-18.2 确认，审计方式与从报警界面确认完全相同：一个报警事件和一条系统日志条目，操作者为 `notify:ntfy`，备注为“acknowledged from the ntfy notification”。ntfy 的 HTTP 操作不会说明是哪部手机按的按钮，所以没有可以添加的人名。当多个人共用一个主题时，审计记录说的是手机做了这件事，而不是谁做的。Discord 机器人知道用户，并会把它写在那里（参见“Discord”）。

每次拒绝都会附上出了什么问题作为答复，并记录到系统日志的 `notify:<channel>` 之下（或对于损坏到无法说明是哪个渠道发出的令牌，记录到 `notify:ack-link`），因为一个悄悄什么都没做的按钮，与一个没人按过的按钮无法区分：

| 响应 | 原因 |
|---|---|
| 403 | 被伪造、被篡改，或用了不同的密钥签名 |
| 410 | 真实但已过期 |
| 409 | 已被使用，或此后报警再次触发，或已没有可确认的内容 |
| 404 | 报警已不存在，或确认链接已关闭 |

令牌本身从不写入日志，从不放进审计事件，也从不被任何 API 返回：只要它有效，它就是一个凭据。它必然存在于 ntfy 消息里，所以任何能读取您 ntfy 主题的人都能按下按钮。请锁定主题。

该端点以 `Access-Control-Allow-Origin: *` 响应，这样按钮也能从 ntfy Web 应用里使用，后者是从它自己的来源按下的。这不会泄露任何东西：这条路由上没有任何内容读取 cookie 或会话。

## 升级

在 N 分钟内没有人确认报警，所以下一个人会收到它。第一次通知照常发出，发到该报警达到其下限的每个渠道。升级是在那之后发生的事，如果报警仍然未被确认地挂在那里。发到没人拿着的手机上的通知，正是这个功能要防止的失败：在 03:00，值班的人在睡觉，报警不应该等他。

您可以在 **Settings，Alarm escalation** 中设置，或通过 API（`GET` 和 `PUT /api/notify/escalation`）。它仅限管理员，因为它包含人们的 ntfy 主题，并决定谁会被叫醒。与 HotLoop 启动时从环境读取的渠道不同，策略是您编辑的数据，保存后立即生效。它可以使用的渠道是部署已经配置好的那些。在这四个渠道之外，加上 webhook 和电子邮件，不会增加任何新的渠道。

### 策略

| 字段 | <span class="sr-only">详情</span> |
|---|---|
| `enabled` | 在您打开之前为关闭。关闭的策略不会升级任何内容 |
| `minPriority` | 会升级的最轻的报警：`critical`、`high`、`medium` 或 `low`。默认 `high`。一个挂了一小时的中级报警是工单，不是 03:00 的电话 |
| `contacts` | 联系人。每个有一个 `name`，以及 `ntfyTopic`、`emails`，或两者都有。最多 50 个 |
| `steps` | 最多 10 步。每步有 `afterMinutes`（1 到 1440）以及要通知的对象：按名称指定的 `contacts`、按名称指定的 `channels`，或两者都有 |
| `repeatEveryMinutes`、`repeatTimes` | 最后一步之后，按这个间隔再发送，再重复这么多次（最多 20）。两者都为零表示不重复 |

一个**联系人**会收到自己的通知。他的 `ntfyTopic` 是这个 HotLoop 已在发布的 ntfy 服务器上的一个主题，使用相同的登录，所以他的手机订阅的是只属于他的主题。他的 `emails` 通过 HotLoop 已有的 SMTP 中继发送。有主题的联系人需要已配置 ntfy，有地址的联系人需要已配置电子邮件，如果没有，策略会被拒绝并说明原因。在任何人都能访问的服务器上，主题就是密码：请把它设得又长又随机。API 只向管理员显示主题，不向任何其他人显示，它们也从不出现在日志簿、系统日志或错误中。

步骤里的**渠道**是部署自己的渠道之一（`ntfy`、`gotify`、`smtp`、`webhook`、`discord-webhook`、`discord`），会触达其上的所有人：共享的 Discord 频道、一个班组共用的 Gotify 应用、接入某个呼叫系统的 webhook。如果某一步指定了这个 HotLoop 没有配置的渠道，策略会被拒绝，答复中会列出它已有的渠道。

### 何时发出

一个步骤在前一步之后 `afterMinutes` 到期，第一步在报警触发之后 `afterMinutes` 到期。它是从触发时刻起累加的，而不是从上一次发送结束时起算，所以中继变慢或重启都不会拉长您写下的时间表。以 5 分钟和 10 分钟的步骤、每 15 分钟重复两次为例：

```
 0 min  alarm raised: the first page, as always
 5 min  step 1
15 min  step 2
30 min  step 2 again (repeat 1)
45 min  step 2 again (repeat 2), and that is the last
```

### 什么会让它停止

这条链针对的是一个报警的一次触发，当下面任何一件事发生时，它会停止，并留下一行说明原因：

- **有人确认了它。** 无论从哪里：报警界面、ntfy 或 Discord 上的确认按钮、API、自动化。它们都会汇入报警引擎，在每一步发出之前，升级器都会询问引擎这次触发是否仍未确认。迟到的钩子不能让它去通知一个已经有人处理的报警。
- **它恢复正常了。** 该报警仍在报警列表上，需要有人确认，但不会为一件自己好了的事叫醒任何人。这是我们有意做出的决定；如果您想要不同的结果，请更改下限或步骤。
- **它被搁置了。**
- **它再次跳闸。** 那是一次新的触发，有它自己的链，从它自己的触发时刻开始计时。昨天的链永远不会为今天的报警发出通知。

如果有人在第 1 步到期之前就处理了报警，升级记录里不会留下任何痕迹，这就是系统在正常运作。

### 收到的内容

一次升级就是报警自己的通知，标题有所改动，并多了一行：

```
NOT ACKNOWLEDGED 15 min: Boiler Trip
Nobody has acknowledged this alarm in 15 minutes (step 2 of 4). boiler/Pressure hi 90 (now 95)
```

它保留报警的优先级，所以严重报警在 Android 上仍是最高优先级。它带有与 ntfy 和 Discord 上第一次通知相同的已签名确认按钮（参见“确认链接”），这样被叫醒的人可以在收到通知的地方直接确认。Gotify 和电子邮件没有按钮。Webhook 会收到 HotLoop 通常的 JSON，其中 `event` 设为 `escalated`。

共享渠道与其他任何渠道一样会被调节节奏（参见“速率限制与摘要”），所以一次电压骤降使四十个报警未被确认时，会作为一条摘要升级，“40 alarms nobody has acknowledged”，而不是四十次通知再加一次封禁。个人自己的通知是单独的一次发送。

### 审计记录

每次升级都是报警自身记录中的一行，[日志簿](/zh-hans/iot/logbook/)读取的就是它，所以无需额外设置就会出现在那里，归在该报警之下，操作者为 `escalation`：

```
alarm Boiler Trip escalated: boiler/Pressure hi 90 (now 95) (note: step 1 of 2: nobody acknowledged it in 5 min; notified Ana (email), Ana (ntfy))
alarm Boiler Trip escalation-ended: boiler/Pressure hi 90 (now 95) (note: escalation stopped after 1 sent: acknowledged by notify:ntfy)
```

`GET /api/alarms/events` 和日志簿的 `alarm` 类型以 `escalated` 和 `escalation-ended` 类型携带同样的行。没有触达任何人的步骤会用大写字母说明（`NOBODY WAS REACHED`），后面附上每次失败，而链仍会继续执行下一步：一个失效的中继不应该阻止通过其他方式发出的通知。保存策略会记入系统日志，但不含主题。

### 重启，以及它在哪里运行

链存在于内存中，所以 03:00 时在链中途发生的重启不能让它丢失。HotLoop 启动时，会查看每个仍未确认的报警，读取审计行显示这次触发已发出多少步，并从那里继续：它不会再次发送第 1 步，也不会跳过第 2 步。HotLoop 停机期间到期的步骤，会在它恢复后的头几秒内发出。进程被终止时正在发送的步骤可能会发出两次，对报警来说，这是正确的出错方向。

保存的策略适用于保存之后触发的报警。重启会接管每个仍未确认的报警，无论它是何时触发的。

由 Gateway 运行它。`--mcp-stdio` 辅助进程不运行，所以一个报警永远不会被两个进程升级。

## SMTP 渠道上的 TLS

只要中继声明支持该扩展，渠道就会通过 STARTTLS 自动升级到 TLS，与下面任何设置无关。这不是需要您选择启用的行为：Go 自己的 `net/smtp.PlainAuth` 拒绝在尚未使用 TLS 的连接上（或发往名字恰为 `localhost` 的服务器）传输用户名和密码，而几乎所有要求身份验证的真实服务商，Gmail、SendGrid、Mailgun、运营商的中继，都要求在 587 端口使用 STARTTLS，或在 465 端口使用隐式 TLS（见下文）才能做到。没有配置身份验证、可在隔离网络上访问的中继，可能根本不提供 STARTTLS，在这种情况下，此渠道不会要求它。

`HOTLOOP_NOTIFY_SMTP_TLS` 不是开启升级，而是把没有升级变成硬性失败：如果设置了它而中继没有声明 STARTTLS，`Send` 会在尝试 `AUTH` 之前就拒绝，而不是悄悄向一个碰巧可作为 `localhost` 访问的中继以明文进行身份验证。`HOTLOOP_NOTIFY_SMTP_TLS_SKIP_VERIFY` 会在升级时跳过证书验证，这与 `HOTLOOP_EDGE_PUBLISH_TLS_SKIP_VERIFY` 和 `HOTLOOP_FLEET_TLS_SKIP_VERIFY` 已为各自的 MQTT 连接提供的出口相同，适用于出示自签名证书的中继。

### 隐式 TLS，465 端口

465 端口上的中继期望整个连接从第一个字节起就是 TLS（RFC 8314），而不是明文问候再升级。HotLoop 以前只做升级，所以在 465 上它说的第一句话是对着等待 TLS 握手的中继发出的明文，发送就失败了。现在 **465 端口是隐式 TLS**，其他所有端口仍与以前一样使用 STARTTLS，无需改动任何设置：

```
HOTLOOP_NOTIFY_SMTP_PORT=465
```

如果某个中继在它自己的端口上使用隐式 TLS，或者在 465 上使用 STARTTLS，`HOTLOOP_NOTIFY_SMTP_IMPLICIT_TLS` 可以指明是哪一种，`true` 或 `false`，并且优先于端口。在 Helm chart 中，请在 `extraEnv` 下设置。其他一切在两种情况下都相同：用户名和密码通过加密连接发送，`HOTLOOP_NOTIFY_SMTP_TLS` 由它满足（没有什么需要强制要求的），`HOTLOOP_NOTIFY_SMTP_TLS_SKIP_VERIFY` 会跳过它握手时的证书检查。除非您关闭，否则会检查中继的证书。定时报告使用相同的中继设置，因此遵循相同的规则。

如果握手失败，错误会说明这一点，并点出 `HOTLOOP_NOTIFY_SMTP_IMPLICIT_TLS=false`，这正是以明文开始的中继所需要的。

已针对一个带有仅 TLS 监听器的真实 SMTP 服务器库，以及用 `--smtp-require-tls` 运行的 Mailpit（实验室固定版本 v1.31.2）验证。未针对商业服务商的 465 端点验证。

## 与定时报告共用的同一条 SMTP 路径

自 4.14.0 起，报警渠道通过 `notify.SendMessage` 发送，这是一个通用函数，向一个收件人列表发送一封邮件，可带可选附件。定时报告（参见[定时报告](/zh-hans/gateway/reports/)）通过同一个函数和相同的中继设置（`HOTLOOP_NOTIFY_SMTP_HOST`、`_PORT`、`_USERNAME`、`_PASSWORD`、`_FROM`、`_TLS`、`_TLS_SKIP_VERIFY`）发送它们的 CSV 和 HTML 文件，所以只有一个地方负责拨号、用 STARTTLS 升级、身份验证，并决定邮件头可以包含什么。只有中继是共用的：`HOTLOOP_NOTIFY_ENABLED`、`HOTLOOP_NOTIFY_SMTP_ENABLED` 和 `HOTLOOP_NOTIFY_SMTP_TO` 是针对报警的，为报告配置的中继不会打开报警渠道。

报警邮件的两项行为发生了变化，都朝着更安全的方向。发件人和每个收件人现在会在拨号之前被校验为普通地址，而以前格式错误的地址要到中继那里才失败。另外，含有非 ASCII 字符的主题会作为 RFC 2047 编码字发送，而不是原始 UTF-8。含有控制字符的报警名称会被替换为空格而不是被拒绝，因为无论报警叫什么，通知都必须发出去。

## 优先级下限

每个渠道有自己的 `MinPriority`，即它仍会触发的最轻的报警优先级。`model.AlarmPriority` 从 1（严重，最严重）到 4（低），所以“高及以上”就是 `MinPriority = 2`：当报警自己的优先级数字小于或等于下限时，就达到了该渠道的下限。一个配置为仅严重的 webhook，和一个配置为中及以上的 SMTP 中继，可以监视同一个报警引擎，却针对完全不同的报警集合触发，没有任何要求它们必须一致。

## 它不是什么

**不是渠道的实时重载。** 渠道在进程启动时从配置中读取一次，与 `EdgePublishConfig` 和 `FleetConfig` 相同。更改 `HOTLOOP_NOTIFY_*` 需要重启才能生效，在这个 MVP 中没有 API 可以在运行时添加或删除渠道。升级策略是例外：接下来通知谁、何时通知，是您编辑的数据，保存后立即生效（参见“升级”）。

**不是它自己的表。** 每次通知尝试，无论成功还是失败，都通过 `runtime.Manager.Event` 写入，这与每个报警和机队操作已有的通用审计事件机制相同。没有必要为这样规模的功能发明专门的 `notifications` 表；系统日志已经能回答“通知有没有发出，有没有成功”。

**不是持久队列。** 重试是有限的（三次尝试，30 秒，参见“重试”），被暂存的报警在其摘要发出前保存在内存里。仍然失败的通知会被记录日志和审计，调度器继续前进。因为没人确认而仍处于触发状态的报警，无论通知有没有到达，仍会显示在报警界面和 `alarm_events` 中：通知是建立在报警系统之上的便利功能，不是它的替代品。

## 配置

| 变量 | 默认值 | <span class="sr-only">详情</span> |
|---|---|---|
| `HOTLOOP_NOTIFY_ENABLED` | `false` | 在设置它之前，该功能处于关闭状态 |
| `HOTLOOP_NOTIFY_WEBHOOK_ENABLED` | `false` | |
| `HOTLOOP_NOTIFY_WEBHOOK_URL` | n/a | 启用 webhook 渠道时必填。必须是 `http://` 或 `https://` |
| `HOTLOOP_NOTIFY_WEBHOOK_MIN_PRIORITY` | `high` | `critical`、`high`、`medium`、`low`，或 `1`-`4` |
| `HOTLOOP_NOTIFY_SMTP_ENABLED` | `false` | |
| `HOTLOOP_NOTIFY_SMTP_HOST` | n/a | 启用 SMTP 渠道时必填 |
| `HOTLOOP_NOTIFY_SMTP_PORT` | `25` | |
| `HOTLOOP_NOTIFY_SMTP_USERNAME` / `_PASSWORD` | n/a | 可选。匿名中继请两者都省略 |
| `HOTLOOP_NOTIFY_SMTP_FROM` | n/a | 启用 SMTP 渠道时必填 |
| `HOTLOOP_NOTIFY_SMTP_TO` | n/a | 启用 SMTP 渠道时必填。以逗号分隔的地址 |
| `HOTLOOP_NOTIFY_SMTP_TLS` | `false` | 要求中继提供 STARTTLS；参见上面的“SMTP 渠道上的 TLS”，只要提供就会自动使用 STARTTLS，与此设置无关 |
| `HOTLOOP_NOTIFY_SMTP_TLS_SKIP_VERIFY` | `false` | 在 STARTTLS 升级时或隐式 TLS 握手时跳过证书验证。按部署选择启用；绝不要默认设置 |
| `HOTLOOP_NOTIFY_SMTP_IMPLICIT_TLS` | 465 端口为 `true`，否则为 `false` | 从第一个字节起使用 TLS，而不是 STARTTLS；参见“隐式 TLS，465 端口”。设置它可覆盖端口判断 |
| `HOTLOOP_NOTIFY_SMTP_MIN_PRIORITY` | `high` | 取值与 webhook 的相同 |
| `HOTLOOP_NOTIFY_NTFY_ENABLED` | `false` | |
| `HOTLOOP_NOTIFY_NTFY_URL` | none | 必填。仅服务器，`https://ntfy.example.com`，不带路径 |
| `HOTLOOP_NOTIFY_NTFY_TOPIC` | none | 必填。1 到 64 个字母、数字、`-` 和 `_`。在公共服务器上它就是密码 |
| `HOTLOOP_NOTIFY_NTFY_TOKEN` | none | ntfy 访问令牌（`tk_...`），以 bearer 令牌发送 |
| `HOTLOOP_NOTIFY_NTFY_USERNAME` / `_PASSWORD` | none | 用 Basic 认证代替令牌。不能两者都用 |
| `HOTLOOP_NOTIFY_NTFY_ACK` | `true` | 在每个报警上放置确认按钮（需要 `HOTLOOP_PUBLIC_URL`） |
| `HOTLOOP_NOTIFY_NTFY_MIN_PRIORITY` | `high` | 取值与 webhook 的相同 |
| `HOTLOOP_NOTIFY_GOTIFY_ENABLED` | `false` | |
| `HOTLOOP_NOTIFY_GOTIFY_URL` | none | 必填。`https://gotify.example.com` |
| `HOTLOOP_NOTIFY_GOTIFY_TOKEN` | none | 必填。Gotify 为 HotLoop 提供的应用令牌 |
| `HOTLOOP_NOTIFY_GOTIFY_MIN_PRIORITY` | `high` | 取值与 webhook 的相同 |
| `HOTLOOP_NOTIFY_DISCORD_WEBHOOK_ENABLED` | `false` | |
| `HOTLOOP_NOTIFY_DISCORD_WEBHOOK_URL` | none | 必填。Discord 的 Copy Webhook URL 给出的 URL。它的全部都是密码 |
| `HOTLOOP_NOTIFY_DISCORD_WEBHOOK_CRITICAL_ROLE` | none | 严重报警时要提及的角色 id |
| `HOTLOOP_NOTIFY_DISCORD_WEBHOOK_MIN_PRIORITY` | `high` | 取值与 webhook 的相同 |
| `HOTLOOP_NOTIFY_DISCORD_BOT_ENABLED` | `false` | |
| `HOTLOOP_NOTIFY_DISCORD_BOT_TOKEN` | none | 必填。机器人的令牌，单独一个，前面不带 `Bot ` |
| `HOTLOOP_NOTIFY_DISCORD_BOT_CHANNEL` | none | 必填。要发帖的频道 id |
| `HOTLOOP_NOTIFY_DISCORD_BOT_ACK_ROLES` | none | 以逗号分隔的角色 id，其成员可以按确认。**为空表示没有人** |
| `HOTLOOP_NOTIFY_DISCORD_BOT_SHELVE_ROLES` | none | 搁置的同样设置。**为空表示没有人** |
| `HOTLOOP_NOTIFY_DISCORD_BOT_USERS` | none | `discordUserId=hotloopUser`，以逗号分隔：其操作记录在他们的 HotLoop 名称之下的人 |
| `HOTLOOP_NOTIFY_DISCORD_BOT_SHELVE` | `1h` | 搁置会搁置多久。最长 `24h` |
| `HOTLOOP_NOTIFY_DISCORD_BOT_CRITICAL_ROLE` | none | 严重报警时要提及的角色 id |
| `HOTLOOP_NOTIFY_DISCORD_BOT_MIN_PRIORITY` | `high` | 取值与 webhook 的相同 |
| `HOTLOOP_NOTIFY_DISCORD_API_URL` | `https://discord.com/api/v10` | 仅用于让机器人的请求经过代理发送 |
| `HOTLOOP_NOTIFY_<CHANNEL>_BURST` / `_REFILL` | 按渠道 | 速率限制；参见“速率限制与摘要”。`<CHANNEL>` 是 `WEBHOOK`、`SMTP`、`NTFY`、`GOTIFY`、`DISCORD_WEBHOOK` 或 `DISCORD_BOT` |
| `HOTLOOP_PUBLIC_URL` | none | 手机访问 HotLoop 所用的地址，包含基础路径。点按打开和确认按钮需要它 |
| `HOTLOOP_NOTIFY_ACK_SECRET` | 自动生成 | 为确认链接签名。至少 32 个字符。未设置时：生成一次并保存在数据库中 |
| `HOTLOOP_NOTIFY_ACK_TTL` | `12h` | 确认链接有效多久。最长 `168h` |

在 Helm chart 中，这些位于 `notify.ntfy`、`notify.gotify`、`notify.discordWebhook`、`notify.discordBot`、`notify.ackSecret`、`notify.ackTtl` 和顶层的 `publicUrl` 之下。令牌、密码和 Discord webhook URL 放入 chart 管理的 Secret，或者用 `existingSecret` 指定您自己的。

## API

| 路由 | 权限 | <span class="sr-only">详情</span> |
|---|---|---|
| `POST /api/notify/test` | `notify.test` | 立即通过每个已配置的渠道发送一条合成的测试通知 |
| `POST /api/notify/ack/{token}` | 无；令牌即授权 | 确认该令牌所签发的那次报警触发。参见“确认链接” |
| `GET /api/notify/escalation` | `notify.escalation` | 升级策略、某个步骤可以指定的渠道，以及此刻打开的链。参见“升级” |
| `PUT /api/notify/escalation` | `notify.escalation` | 替换整个策略。如果某一步没有指定任何人，或指定了未配置的渠道，会被拒绝并说明原因 |
| `GET /api/diagnostics` | `status.read` | 在 `notify.channels` 下，每个渠道的状态：Discord 是否拒绝了它（以及原因和起始时间），以及 Discord 机器人的 Gateway 连接 |

`notify.escalation` 同样仅限管理员。读取策略也需要它，因为其中包含人们的 ntfy 主题。

`notify.test` 仅限管理员，由管理员角色已有的通配符授予，并有意没有加入操作员角色的权限列表，因为发送真实的外部消息并消耗寻呼服务商或 SMTP 中继允许的配额，在性质上更接近 `fleet.restart` 和 `fleet.config`（同样仅限管理员，同样是“立刻对外部世界做点什么”），而不是读取，这与本应用已对这两者采用的收窄方式相同。

响应会报告每个渠道各自的结果，而不是针对整个请求的单一成功或失败：

```json
{
  "results": [
    {"channel": "webhook", "success": true},
    {"channel": "smtp", "success": false, "error": "dial smtp server mail.example.com:587: i/o timeout"}
  ]
}
```

## 已验证与未验证的内容

HotLoop 已针对真实设备和真实服务器运行，并于 2026-11-17 在裸机上运行。
