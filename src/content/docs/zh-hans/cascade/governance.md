---
title: "管理 Cascade 实例"
description: "变量、文件夹、带批注的运行、脱敏、Insights、外部密钥和日志转发，适用于工作流越来越多的工厂。"
---

工厂如何管好不断增多的工作流：共享设置、文件夹、带批注的运行、脱敏、随时间变化的数字、外部密钥、日志转发，以及大数据存放在哪里。这里的一切都是免费的，并且包含在每个构建中。

下面提到的每个端点都在 `/api/v1/openapi.json` 的 OpenAPI 文档里，每个端点都有一个调用它的测试，在 SQLite 和 Postgres 上都有。

## 变量

在编辑器里：顶部栏的“变量”。整个实例范围的变量在最上面，每个项目的变量在其名称下面。只显示你的角色允许的内容。

变量是工作流以 `vars.NAME` 读取的一个有名称的值：设定值上限、工厂的名称、试点产线和正式产线之间不同的基础 URL。

```yaml
- name: Check limit
  type: core.if
  version: 1
  params:
    condition: "{{ item.json.temp > toNumber(vars.TEMP_LIMIT) }}"
```

- 变量要么是**实例范围**的，要么属于**某一个项目**。两者同名时，项目的变量生效，并且只对该项目的工作流生效。
- 值是文本，最多 8 KiB。需要数字时使用 `toNumber(vars.X)`。
- 名称由字母、数字和下划线组成，以字母或下划线开头，最长 64 个字符，因为它必须能读成 `vars.NAME`。
- **变量不是密钥。** 能读取项目的人都能读取它的变量，并且值不会从运行数据中清除。密码、令牌或密钥应放进凭据保险库，或放进外部密钥存储（见下文）。
- 运行在启动时读取变量，在等待或重启后恢复时会再读一次。改动会影响下一次运行，不会影响已经处于某一步中间的运行。不存在的名称读作空，而不是报错。

| 调用 | 作用 |
|---|---|
| `GET /api/v1/variables` | 实例变量，以及你能读取的项目中的变量；`?project=` 缩小到一个项目。 |
| `POST /api/v1/variables` | 创建一个变量。带 `projectId` 时属于该项目，不带则是实例范围的。 |
| `PUT /api/v1/variables/{variable}` | 修改它的名称和值。 |
| `DELETE /api/v1/variables/{variable}` | 删除它。 |

谁可以：在项目中，`variable.read` 权限可列出变量，`variable.create`、`variable.update` 和 `variable.delete` 可修改变量。viewer 和 operator 可读，editor 和 admin 可改。实例范围的变量任何已登录的人都能读取，因为任何项目的工作流都可以读取它们，只有实例所有者或管理员才能修改。自定义角色可以携带这四项权限中的任何一项。更改会以 `variable.created`、`variable.updated` 和 `variable.deleted` 记入审计日志，记录名称，从不记录值。

## 文件夹

在编辑器里：工作流列表就是文件夹。用“新建文件夹”创建一个，用“添加子文件夹”嵌套，并在列表中该工作流所在的那一行移动它。创建工作流时选择文件夹，它就放在那里。

文件夹把一个项目的工作流分组并且可以嵌套，就像工厂的布局：区域、产线、工位。

- 一个文件夹属于一个项目。相邻文件夹之间名称不能重复，名称最长 100 个字符。
- 文件夹最多可嵌套 10 层。
- 一个工作流在某个文件夹中，或在其项目的顶层。保存新版本不会移动它。
- 里面有工作流或文件夹的文件夹不能被删除（409），所以删除文件夹绝不会让工作流丢失。文件夹不能被移到它自己或它自己的子文件夹中，也不能被移到另一个项目。

| 调用 | 作用 |
|---|---|
| `GET /api/v1/folders` | 你能读取的项目中的文件夹，扁平列出，每个带有自己的 `parentId`；`?project=` 缩小范围。 |
| `POST /api/v1/folders` | 在 `projectId` 中创建一个，位于 `parentId` 内或顶层。 |
| `PATCH /api/v1/folders/{folder}` | 重命名它，或用 `parentId` 移动它（顶层用空字符串）。 |
| `DELETE /api/v1/folders/{folder}` | 删除一个空文件夹。 |
| `PUT /api/v1/workflows/{workflow}/folder` | 把工作流放入文件夹，或用空的 `folderId` 放到顶层。 |
| `GET /api/v1/workflows?folder=` | 某个文件夹的工作流，或用 `folder=none` 取每个项目的顶层。 |

API 返回的每个工作流都会给出它的 `folderId`。`folder.read`、`folder.create`、`folder.update` 和 `folder.delete` 权限的作用与变量的权限相同，移动工作流需要 `workflow.update`。文件夹的更改会记入审计日志，移动记为 `workflow.moved`。

## 运行批注

在编辑器里：每次运行的页面都有一个批注框，包含点赞或点踩、一条备注和标签，运行列表可按标签和投票筛选。

事后可以对某次运行说点什么：点赞或点踩、一条备注，以及用来找到它的标签。“换模后的第一个好批次”和 `scrap` 就是适合写在这里的内容。

```sh
curl -X PUT $CASCADE/api/v1/executions/$RUN/annotation -H "Authorization: Bearer $KEY" \
  -d '{"vote":"up","note":"first good batch after the die change","tags":["die-change","first-shift"]}'
```

- 投票是 `up`、`down` 或空。备注最多 2000 个字符。一次运行最多有 20 个标签，每个标签 1 到 40 个字符，不含控制字符，每个只列一次。
- `PUT` 会替换整个批注，所以请把想保留的内容全部发送。没有任何内容的批注等同于没有批注。`DELETE /api/v1/executions/{execution}/annotation` 会清除它。
- API 返回的每次运行都带有它的批注，列表在每一行也带有批注。`GET /api/v1/executions?tag=scrap` 和 `?vote=down` 可以筛选，并且能与其他筛选条件组合。
- 批注会记录是谁在何时留下的，使用的身份与审计日志相同。
- 添加批注需要 `execution.annotate` 权限，operator、editor 和 admin 拥有，viewer 没有。viewer 可以阅读批注。
- 批注会随其运行被删除而消失。审计日志保留 `execution.annotated` 和 `execution.annotation_cleared`，以及投票和标签，并且只记录留下过备注，不记录备注的内容。

## 保留已完成的运行

在编辑器里：设置，已完成运行保留天数。通过 API：用 `{"retentionDays": 90}` 调用 `PATCH /api/v1/settings`，与其他设置一样需要 `instance.settings` 权限。

默认情况下，每个已完成的运行都会永久保留，和以前一样。设置一个天数后，main 每小时一次删除结束时间早于该天数的已完成运行（成功、失败或已取消），连同它们的步骤数据。设为 0 则再次关闭。

- 排队中、运行中或等待中的运行绝不会被动到，父级仍在运行的运行也不会，因为父级会询问它做了什么。
- 每批最多 500 次运行，是一个独立事务，并向审计日志写入一行 `execution.pruned`，记录删除了多少以及截止时间。更改该设置会写入 `instance.retention`。
- 每个 main 都会执行这一遍，两个同时执行只会发现要做的事变少了。
- blob 清理跟随同一遍执行，无论保留是否开启都每小时运行一次，所以手动删除的运行也会被清理。见下文“blob 清理”。

## 限制 API 密钥

在编辑器里：设置，每个密钥每分钟的 API 请求数。通过 API：用 `{"apiRateLimit": 120}` 调用 `PATCH /api/v1/settings`，需要 `instance.settings` 权限。

默认情况下，密钥可以随意频繁调用。设置一个数字后，每个 API 密钥，以及每个通过 MCP 用密钥登录的代理，每分钟可以发出那么多请求。超过限制的调用会得到 `429`，并带有 `Retry-After` 头，说明要等待多少秒。每个密钥都有自己的计数，所以一个失控的脚本不会用光另一个密钥的额度。在编辑器中登录的人不受此限制。

计数是每个进程自己的，因为这样才能保护进程：有三个 main 时，一个密钥最多可以发出该数字的三倍，分散在它们之间。设置的更改会在五秒内到达每个 main。更改它会向审计日志写入 `instance.api_rate_limit`，附带旧数字和新数字。

Webhook 有自己的限制，在触发器上设置，账号在多次输错密码后会被锁定；这两者都不变。

## 备份与恢复

```
hotloop-cascade backup /backups/2026-11-20
hotloop-cascade restore /backups/2026-11-20
```

`backup` 会写入一个新目录，里面有 SQLite 数据库的一致副本（在服务器运行时用 `VACUUM INTO` 获取）、封存所有已存凭据的密钥文件、blob 文件，以及带有每个文件 SHA-256 的 `manifest.json`。它接受与服务器相同的 `--database`、`--key-file` 和 `--blob-dir` 设置，来自相同的环境变量。目录必须尚不存在，或为空；备份绝不会与旧备份混在一起。没有密钥文件就没有备份，因为没有密钥的数据库里的凭据没有人能读取。

`restore` 把它们放回去，并且必须先停止服务器。它在写入任何内容之前，会对照清单检查每个文件，所以损坏或不完整的备份不会改变任何东西。它拒绝覆盖已经存在的数据库或不同的密钥文件；`--replace` 表示你确实要这样做。之后启动服务器：它会把架构更新到最新，并拒绝由比它更新的版本所做的备份。

PostgreSQL：`backup` 写入密钥、blob 和清单，并打印出生成数据库部分的 `pg_dump --format=custom` 命令，因为那个程序是 PostgreSQL 自己的，Cascade 镜像里没有。`restore` 把密钥和 blob 放回去，并打印 `pg_restore` 命令。保存在 S3 或 Azure 中的 blob 不会被复制；请在那里备份存储桶。

在升级到需要迁移的版本之前，先做一次备份：迁移只会向前，而退回旧镜像需要备份。

## 运行脱敏策略

在编辑器里：设置，脱敏用来创建策略。工作流在编辑器侧边面板中不选任何内容时，在“工作流设置”下选择一个策略。

凭据保险库已经让密钥远离运行保存的一切内容。脱敏策略针对的是那些不是凭据、但也不应出现在运行历史中的数据：工牌号、操作员的姓名、通过 webhook 传入的卡号。

策略由一个名称和若干规则组成：

- **fields**：条目的键名。策略点名的键，其整个值会被替换为 `[redacted]`，不论深度，也不论值是什么类型。匹配不区分大小写，`*` 和 `?` 可作通配符，所以 `*secret*` 会匹配 `plant_secret` 和 `SecretKey`。
- **patterns**：正则表达式，使用 Go 的 RE2 语法。任何文本中的每个匹配都会被替换为 `[redacted]`。匹配空文本的模式会被拒绝。
- **steps**：可选。策略只涵盖列出的步骤。为空表示每个步骤。
- **appliesToAll**：可选。策略涵盖每个工作流，无论它是否点名该策略。

工作流在其设置中按名称选择一个策略：

```yaml
settings:
  redaction: Badges
```

它做什么，以及何时做：

- 它在**运行结束时**执行，与把运行标记为已结束（成功、失败或已停止）的事务相同。在那之前，运行持有真实数据，因为下一步需要它，重启也从它恢复。等待中的运行仍持有真实数据。
- 它会清理每一步保存的输出、每一步保存的错误消息、运行自身的错误，以及保存的 webhook 应答。它不碰文件内容：策略读取的是条目数据，而文件是对字节的引用。
- 保存下来的内容，就是从该运行中途重放或重试时的起点，所以重放看到的是清理后的值。工作流的触发器条目在第一步的输出中，它们同样会被清理。
- 它读取的是该运行当时所用的工作流，所以编辑工作流或策略，绝不会改变已经结束的运行。
- 点名了不存在的策略的工作流会**以关闭方式失败**：它的运行完全不保留条目数据，就像 `metadata` 保存设置那样，并且工作流的 `problems` 会这样说明。缺失的策略绝不能意味着保留了某人想要清理的数据。
- 被工作流点名的策略不能被删除（409），它的名称也不能更改。规则可以更改。

| 调用 | 作用 |
|---|---|
| `GET /api/v1/redaction-policies` | 所有策略。任何已登录的人都能读取，因为编写工作流的人需要这些名称。 |
| `POST /api/v1/redaction-policies` | 创建一个。 |
| `PUT /api/v1/redaction-policies/{policy}` | 替换它的描述和规则。 |
| `DELETE /api/v1/redaction-policies/{policy}` | 删除一个没有任何工作流点名的策略。 |

创建、更改和删除策略需要实例的 `redaction.manage` 权限，所有者和管理员拥有该权限。每项操作都会以 `redaction.created`、`redaction.updated` 和 `redaction.deleted` 记入审计日志。

## Insights

在编辑器里：顶部栏的 Insights。选择一个时间窗口、一个项目和一个工作流；它会显示总计、按天的图表和表格，以及按工作流的表格。

`GET /api/v1/insights` 汇总一个时间窗口内的运行：它们如何结束、耗时多久，按天和按工作流统计。

```sh
curl "$CASCADE/api/v1/insights?from=2026-10-10&to=2026-10-14&project=$PROJECT" -H "Authorization: Bearer $KEY"
```

- `from` 和 `to` 是 RFC 3339 时间或日期（UTC 午夜）。两者都没有时，为截至现在的最近七天。它最多回答 366 天。
- `project` 和 `workflow` 缩小范围。没有它们时，会统计调用者能读取运行的每个项目，所以每个人看到的数字都是自己的。
- 运行计入它创建当天的 UTC 日期。
- `totals` 以及 `days` 和 `workflows` 中的每一行都带有 `total`、`succeeded`、`failed`、`canceled` 和 `unfinished`（排队中、运行中或等待中）、同时有开始和结束时间的运行的平均和最长运行时间（毫秒），以及 `failureRate`。
- `failureRate` 是失败数除以成功数加失败数。已取消的运行不算失败，未结束的运行还没有结果，所以两者都不计入。当两种结果都还没有出现时，它为 0。
- `days` 列出窗口内的每个 UTC 日，没有运行的日子用零填充，所以图表没有需要猜测的空缺。`workflows` 是最繁忙的 50 个，最繁忙的排在前面。

它读取的运行行与运行列表相同，所以需要 `execution.read` 权限和一个具备该范围的密钥。

## 外部密钥

在编辑器里：设置，外部密钥。添加一个提供方，在同一张卡片上用一个路径试一试，并查看指向它的引用是什么样子。

凭据的密钥字段可以指向保存在 HashiCorp Vault 或 OpenBao 中的密钥，而不是自己保存密钥。在存储里轮换密码，每个工作流在下一次运行时都会使用新密码，不需要任何人编辑凭据，你的数据库副本也从不保存密码。

引用在凭据的任何密钥字段中都是这样的：

```
secret://bao/plant/line-3/db#password
```

这是名为 `bao` 的提供方、位于 `plant/line-3/db` 的密钥，以及它的 `password` 键。凭据保存的就是这段文本，像任何密钥一样被封存。它所指向的内容绝不会存在这里：值在运行打开凭据时读取，在提供方的缓存时间内保存在内存中，并且从运行保存的一切内容中清除，与保险库中的密码一样。只有密钥字段接受引用。在不是密钥的字段里输入的引用只是文本。

### 设置提供方

提供方包括服务器、Cascade 登录它的方式，以及它可以读取的位置。创建、更改和移除提供方是实例所有者或管理员的事，即 `secrets.manage` 权限，并且必须由已登录的人完成，不能用 API 密钥。

```sh
curl -X POST $CASCADE/api/v1/secret-providers -H "X-CSRF-Token: ..." -d '{
  "name": "bao",
  "address": "https://bao.plant.example:8200",
  "authMethod": "approle", "roleId": "...", "secretId": "...",
  "allowedPaths": ["plant"]
}'
```

| 字段 | 作用 |
|---|---|
| `name` | 1 到 40 个小写字母、数字和连字符。它出现在每个引用中，所以以后不能更改。 |
| `address` | 服务器的 URL。 |
| `mount`、`kvVersion` | KV 引擎挂载的位置（默认 `secret`），以及它是版本 1 还是 2（默认 2）。 |
| `namespace` | 作为 `X-Vault-Namespace` 发送，用于服务器的命名空间。 |
| `authMethod` | `token` 搭配 `token`，或 `approle` 搭配 `roleId` 和 `secretId`。`authMount` 是 AppRole 挂载的位置（默认 `approle`）。AppRole 自行登录，并在令牌到期时再次登录。 |
| `caCert` | 当服务器的证书不是来自系统所信任的机构时，用于信任该服务器的 PEM 证书颁发机构。 |
| `allowedPaths` | **必填。** 引用可以读取的唯一位置。`plant` 允许 `plant` 及其下的一切，不包括 `plantation`。 |
| `projects` | 可选。唯一可以使用该提供方的项目。留空则每个项目都可以。 |
| `cacheSeconds` | 读取的密钥在内存中保留多久，0 到 3600。默认 30。0 表示每次都读取。 |

Cascade 的登录方式（令牌，或 AppRole 的 id 和密钥）在实例密钥下被封存，在密钥轮换时与其他一切一起重新封装，并且任何调用都不会显示它。更改时省略它，已保存的值就会保留。

`POST /api/v1/secret-providers/{provider}/test` 登录，并在带有 `path` 时读取它，然后说明是否成功。它从不返回值。`GET /api/v1/secret-providers` 为任何已登录的人列出提供方，因为创建凭据的人需要这些名称。这些调用以 `secrets.provider_created`、`_updated` 和 `_deleted` 记入审计日志。

### 它不会做什么

- **提供方需要允许的路径。** Vault 的令牌通常能读取的内容，远多于编辑凭据的人应当能够指名的范围，没有列表的话，任何能创建凭据的人都可以让一个凭据指向令牌能触及的任何密钥，并让工作流把它发送到别处。请把凭据所需的路径给提供方，并给它的策略同样的路径。
- **引用在凭据保存时就会被检查**，而不只是在运行使用它时：提供方必须存在，对凭据所在项目开放，并允许该路径。包含空段、点或 `..` 的路径会被拒绝。
- **无法读取密钥的运行会失败并说明原因**，指出提供方、路径和键，绝不指出值：没有这个提供方、提供方不允许的路径、那里没有密钥、没有这个键，或服务器自己的拒绝（不允许读取的策略就是“permission denied”）。
- **删除提供方不会编辑凭据。** 指向它的凭据会在运行打开它们时失败，并说明提供方已经不在了。
- 真正以 `secret://` 开头的密钥值不能存为密钥，因为它会被当作引用读取。
- 是数字或 true 或 false 的值按文本读取。整个对象或列表的值会被拒绝。
## 日志转发

在编辑器里：设置，日志转发（所有者和管理员）。每个目标都会显示它已发送了多少、上次送达的时间，以及它最近的错误，并带有一个发送一个测试事件的按钮。

把审计日志，以及每个结束的运行的一行记录，发送到工厂本来就存放日志的地方：syslog 服务器，或任何通过 HTTP 接收 OTLP 日志的系统（OpenTelemetry 收集器、Loki、日志平台）。事件在发生时就发出，所以 SIEM 几秒内就能看到一次失败的登录，而审计记录存在于这个实例的管理员无法改写的地方。

一个目标就是一个地点。需要多少就创建多少：

```sh
curl -X POST $CASCADE/api/v1/log-destinations -H "X-CSRF-Token: ..." -d '{
  "name": "plant syslog", "kind": "syslog",
  "address": "syslog.plant.example:6514", "network": "tls",
  "caCert": "-----BEGIN CERTIFICATE-----..."
}'
curl -X POST $CASCADE/api/v1/log-destinations -H "X-CSRF-Token: ..." -d '{
  "name": "collector", "kind": "otlp", "endpoint": "https://otel.plant.example/v1/logs",
  "headers": {"Authorization": "Bearer ..."}
}'
```

创建、更改和移除目标是实例所有者和管理员（`logstream.manage`）的事，由已登录的人完成而不是 API 密钥，因为目标是审计日志的去向。这些调用以 `logstream.destination_created`、`_updated` 和 `_deleted` 记入审计日志。

### 发送什么

- **审计事件**：审计日志的每一行，带有它的序号和哈希。序号和哈希是接收方识别重复的办法，哈希是这一行自己的，所以可以根据收到的内容检查整条链。失败或被拒绝的登录是警告，其他一切是通知。
- **运行事件**：每个结束的运行一条，无论它以什么方式结束：运行的 id、工作流的 id 和名称、它的项目、状态、模式、创建、开始和结束的时间、运行了多久，以及它的错误和失败的那一步。失败的运行是错误，已停止的运行是通知，成功的运行是信息。它们在运行结束后几秒内发送。
- **绝不发送条目数据。** 运行各步骤看到和生成的内容留在运行里，由脱敏策略保护。审计日志从不包含密钥。

`events` 选择其一或两者（`["audit"]`、`["execution"]`，默认两者）。`start` 说明新目标从哪里开始：默认的 `now` 发送它创建之后发生的内容，`beginning` 先发送整个审计日志和每个已结束的运行。

### Syslog

消息遵循 RFC 5424：`<priority>1 time host hotloop-cascade pid msgid - {json}`，事件是一行 JSON。优先级是 facility 乘以八再加上严重程度。msgid 是审计动作（`workflow.saved`）或运行的状态。

| 字段 | 作用 |
|---|---|
| `address` | `host:port`。 |
| `network` | `tcp`（默认）、`udp` 或 `tls`。 |
| `framing` | 用于 `tcp` 和 `tls`：`octet`（RFC 6587 八位字节计数，默认）或 `newline`。UDP 每个事件一个数据报。 |
| `facility` | 默认 `local0`；任何 syslog facility 名称。 |
| `appName` | 头部的 APP-NAME，默认 `hotloop-cascade`。 |
| `caCert`、`serverName` | 用于 `tls`：要信任的证书颁发机构，以及当证书不是对应主机时它必须对应的名称。没有任何设置可以跳过这项检查。 |

### OTLP

日志以带 JSON 正文的 HTTP 上的 OTLP 发送到 `endpoint`：每个事件一条日志记录，正文是 JSON 形式的事件，它的各个部分作为属性（`cascade.event`、`cascade.action`、`cascade.status`、`cascade.project`、`cascade.actor.name` 等），这样接收方无需解析就能筛选。资源中包含 `service.name=hotloop-cascade`、它的版本和主机。`headers` 随每个请求发送，用于令牌或租户。它们在实例密钥下被封存，在密钥轮换时重新封装，并且从不显示：列表只显示它们的名称。`caCert` 和 `serverName` 的作用与 syslog 相同。

### 投递的行为

- **至少一次，按顺序。** 目标会记住它发送的最后一条审计行和最后一个已结束的运行。宕机的目标在恢复时会按顺序收到它错过的全部内容，重启后也会从停下的地方继续。如果发送方在发送和记录之间被切断，这些事件会被再次发送，序号就是为此而设。
- **失败的目标会退避**，从一秒开始翻倍直到五分钟，它的状态会说明出了什么问题以及何时：`lastError`、`lastErrorAt`。一次成功会清除它。它宕机期间不会丢弃任何内容，所以上限是审计日志，而不是一个队列。
- **同一时间只有一个发送方。** 有多个 main 时，持有某个目标租约的那个向它发送；其他的等待，并在它停止时接手。
- **更改目标会保留它的位置。** 把它移到另一个地址，绝不会重发或跳过任何内容。更改时省略的头部会保留，空对象会清除它们。名称和种类不能更改。
- `POST /api/v1/log-destinations/{destination}/test` 通过同一条路径发送一个虚构的事件，并说明它是否送达，未送达时给出原因。它不会移动任何东西。
- `GET /api/v1/log-destinations` 显示每个目标的状态：它已发送多少事件、最后送达的审计序号、上次成功的时间，以及它最近的错误。

## 大数据存放在哪里

运行携带的文件和大负载（下载的 PDF、相机画面、电子表格）作为 blob 存储，与数据库分开。默认存放在实例的磁盘上。设置 `HOTLOOP_CASCADE_BLOB_STORE`，可以把它们改放到 S3 存储桶或 Azure blob 容器中，这样重建 main 时不必带着它们，多个 main 也共用同一份副本。

| 设置 | 含义 |
| --- | --- |
| `HOTLOOP_CASCADE_BLOB_STORE` | `fs`（默认）、`s3` 或 `azure`。 |
| `HOTLOOP_CASCADE_BLOB_SPOOL_DIR` | blob 在上传前计算哈希时等待的位置。默认是数据目录中的 `blob-spool`。 |
| `HOTLOOP_CASCADE_BLOB_S3_BUCKET`、`_ACCESS_KEY`、`_SECRET_KEY` | `s3` 必填。密钥也读取 `_SECRET_KEY_FILE`。 |
| `HOTLOOP_CASCADE_BLOB_S3_ENDPOINT`、`_REGION` | AWS 不设置端点。Garage、MinIO 或 Ceph 需要设置。 |
| `HOTLOOP_CASCADE_BLOB_S3_PATH_STYLE` | `true` 或 `false`。只要设置了端点，默认就是路径风格。 |
| `HOTLOOP_CASCADE_BLOB_S3_CA_FILE` | 用于使用私有证书的端点的 CA 证书包。 |
| `HOTLOOP_CASCADE_BLOB_S3_PREFIX` | 存储桶内的一个文件夹，这样一个存储桶可以容纳多个实例。 |
| `HOTLOOP_CASCADE_BLOB_AZURE_CONTAINER` | `azure` 必填。 |
| `HOTLOOP_CASCADE_BLOB_AZURE_CONNECTION_STRING`，或 `_ACCOUNT` 搭配 `_KEY`，或 `_SAS` | 一种登录方式。密钥也读取 `_FILE` 形式。 |
| `HOTLOOP_CASCADE_BLOB_AZURE_ENDPOINT`、`_PREFIX` | 用于 Azurite 或私有云的端点，以及容器内的一个文件夹。 |

在 Chart 上，通过 `env` 和 `extraEnv` 设置这些，密钥来自 Kubernetes Secret。

- **按内容寻址。** blob 以其 SHA-256（`sha256/ab/cdef...`）存储，所以同一个文件无论有多少次运行携带它，都只存一份。再次放入它不会有任何作用，两次运行在同一时刻这样做也一样。
- **上传前计算哈希。** 数据先被读入一次 spool 文件，计算哈希，然后再发送，所以无论大小，内存占用都保持平稳。超过大小限制的 blob 会被拒绝，被取消的上传不会在存储桶里留下任何东西。
- **读出时校验。** 读取在流式传输时会对照其哈希校验，所以损坏的对象会明确失败，而不是把错误数据交给运行。
- **大小。** 单次上传在 S3 上以分段传输方式进行，在 Azure 上按块进行，所以通常每个请求 5 GiB 的限制并不适用。
- **blob 清理。** 每小时一遍，清除没有任何行指向的 blob：因为对数据库来说太大而存成文件的步骤输出，以及条目携带的附件。只要仍有任何步骤运行、部分输出、保存的应答或工作流直接，或通过包含该附件的已存输出，点名这个 blob，它就会被保留，所以两次输出相同的运行共享的文件会保留到最后一次运行消失为止。只检查上次写入已超过 24 小时的 blob，而放入已经存储的字节，在第一个小时之后会算作再次写入，所以某一步刚刚存储、尚未记录的文件绝不会被清除。无法读取某个已存输出的那一遍不会清除任何东西。它会向审计日志写入一行 `blobs.collected`，记录清除了多少文件和字节。这一遍假定 blob 存储属于一个实例（一个安装的 worker 和 main 共用它）；指向同一个存储桶或文件夹的两个安装会各自清除对方的文件，所以请给每个安装自己的存储（`HOTLOOP_CASCADE_BLOB_S3_PREFIX` 就是为此而设）。
- **以后更换存储。** 已有的 blob 留在它们被写入的地方。切换之前请把它们移到新存储，因为指向新存储里没有的 blob 的引用，就是一个缺失的文件。

这两个后端在测试环境中针对 Garage 和 Azurite 进行试验，使用与磁盘存储相同的一致性测试集：写入和读取、空 blob、并发下的去重、损坏、限制、错误的 id、删除、列出、被取消的写入，以及带堆检查的 192 MiB 流式上传。

对你的意义：重建或替换后的 main 能找到它的运行所携带的每一个文件，无需复制。
