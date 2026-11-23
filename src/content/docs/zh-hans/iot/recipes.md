---
title: "配方 Recipe"
description: "一次应用某个产品等级的全部设定值：整体检查、整体拒绝、按顺序写入，并从设备读回确认。"
---

配方是一组一起发往工厂的值。A 级的各区温度、线速度和模口间隙。切换到 500 ml 瓶。夜间设定值回调。每家工厂都有这些，每家工厂都在某处有一张塑封的纸，上面写着这些数字，由操作员逐个输入，而每家工厂也都有某天夜里其中一个被输错的故事。

所以这些数字改为放在这里，并且一次发出：先整体检查，按顺序发送，之后从设备读回，每一个都有记录。每个配方同时也是一个实体，`scene.<id>`。它是为可能伤人的设备而造的，这也是本页大部分内容都在讲出问题时会发生什么的原因。

## 它长什么样

```json
{
  "id": "grade_a",
  "name": "Grade A",
  "description": "The 2pm run. Die at 210, line at whatever the order says.",
  "equipment_id": 7,
  "apply_permission": "recipes.apply",
  "params": [
    {"name": "speed", "label": "Line speed", "type": "number", "min": 0, "max": 400, "step": 10, "unit": "rpm", "required": true}
  ],
  "precondition": "states['input_boolean.line_ready'] == 'on'",
  "targets": [
    {"entity_id": "loop.line_02_die_tic", "service": "set_mode", "data": {"mode": "auto"}},
    {"entity_id": "loop.line_02_die_tic", "service": "set_setpoint", "data": {"value": 210}},
    {"entity_id": "number.line_02_speed", "service": "set_value", "data_expressions": {"value": "vars.speed"}},
    {"entity_id": "switch.line_02_heater", "service": "turn_on"},
    {"entity_id": "input_select.product", "service": "select_option", "data": {"option": "Grade A"}}
  ],
  "verify_sec": 10
}
```

- **`id`** 由小写字母、数字和下划线组成，以字母开头。它是其实体的对象 id，`scene.grade_a`，并且永远不会改变。
- **`equipment_id`** 是配方所属的设备树节点，便于查找。配方屏幕按它分组。整个工厂的配方可不填。
- **`params`** 是一次应用所接收的内容：与脚本相同的带类型字段（`model.Field`：带 `min`、`max`、`step` 和 `unit` 的 `number`，`text`，`boolean`，`select`，`entity`，`duration`，`alarm`，`tag`）。目标在 `data_expressions` 条目中以 `vars.<name>` 读取其中一个。
- **`precondition`** 是自动化语言中的一个表达式，必须为真，配方才会开始。不填就是没有。
- **`targets`** 是各个值，**按发出的顺序**排列。每个目标是一个实体、设置它的服务，以及该服务的数据，数据可以是一个值（`data`），也可以由参数计算得出（`data_expressions`）。最多 200 个。
- **`verify_sec`** 是给每个已写入的值出现在设备读数中的时间。1 到 600，默认 10。

### 目标可以是什么

配方**设置值**。它接受的服务，是那些让设备保持某个值的服务：

| 域 | 服务 |
|---|---|
| `switch`、`input_boolean` | `turn_on`、`turn_off` |
| `number`、`input_number`、`input_counter` | `set_value` |
| `text`、`input_text` | `set_value` |
| `select`、`input_select` | `select_option` |
| `valve` | `set_position` |
| `motor` | `set_speed` |
| `loop` | `set_setpoint`、`set_mode` |

按下按钮、启动电机、复位计数器、停止阀门：保存时会被拒绝。这些是动作，不是值，它们属于[脚本](/zh-hans/iot/scripts/)。每次有人应用就按一下复位按钮的“应用 A 级”，不是任何人所说的配方，而它在生产中发生的那一天，就是您发现它的那一天。切换（toggle）也会被拒绝：翻转开关的配方，每隔一次就会做相反的事。

目标的实体在保存时必须存在，它的表达式必须能编译，并且同一个实体不能被同一个服务设置两次（一个设置对应两个值，哪个会生效取决于一个没有人去读的顺序）。回路的模式和设定值是两项设置，两者都可以设置；先设置模式，因为面向自动的设定值对停留在手动的回路毫无意义。

## 应用一个

从配方屏幕、实体屏幕上配方的磁贴、规则或脚本的 `apply_recipe` 步骤、MCP 的 `apply_recipe`，或 `POST /api/services/scene/turn_on`。它们每一个做的事情完全一样：

### 1. 整体检查，整体拒绝

在任何一个值发往任何地方之前：

- 参数会对照其字段进行检查。**值绝不会被改动来迁就。** 在最大值为 400 的字段里填 450 会被拒绝，而不是被截成最大值，这个最大值是
  400. 数字填 `"250"` 会被拒绝，而不是被解析。步长为 10 时填 255 会被拒绝，而不是被四舍五入。发往工厂的数字，恰恰就是某人输入的那个数字，否则什么都不会发出。
- 配方自己的权限（如果它指明了一个，见下文），以及对于代理而言的 MCP 写入开关。
- 前置条件会对照工厂当前的状态求值。
- 每个数据表达式都会求值。一个失败就会使配方被拒绝；目标绝不会在缺少它本该有的值的情况下被发送。
- 此进程中不能有其他任何东西正在写入它的某个实体（见下文）。
- **每个目标都要交给写入闸门自身的检查**，也就是它的写入将会遇到的同样检查：写入已开启、变量可写、值在该变量的范围内、实体已启用且接受该值（它的步长、它的选项、用于其输出的处于手动的回路）、设备已连接。`Services.Check`，对于变量来说就是 `runtime.Manager.CheckWrite`。不会写入或审计任何内容。

**只要有任何一项失败，整个配方就会被拒绝，并且什么都不会写入。** 不是前十个目标写入之后才拒绝。是什么都不写。而且您会得到每一个原因，而不只是第一个：被告知一个问题的操作员修好它，然后再被告知下一个，而有四十个目标的配方应当一次修好。每个目标会说明它是哪一种：`would_write`、带有闸门原话的 `refused`，或 `not_sent`。

### 2. 按顺序写入，一个调用 id，绝不回滚

然后各目标按顺序发出，每个都通过 `Services.Call`，也就是通过 `runtime.Manager.Write`，唯一的写入闸门。没有旁门。每次写入都带有这次应用的**调用 id**，所以整个应用就是 `GET /api/writes?call=<id>`，在审计记录中，与工厂接受过的其他所有写入并列。

检查可能通过，而写入在片刻之后仍然失败。PLC 以异常回应一次写入。有人踢掉了电缆。有人在检查与写入之间解除了某个变量的启用。**第一个没有通过的目标会停止应用。** 在它之后的目标不会被发送，显示 `skipped`。

**已经写入的内容不会被撤销。** 这是有意为之，也是 HotLoop 每一次写入都遵循的规则。撤销本身就是一次写入：在没有人要求的情况下，对已经动作过的设备，依据我们认为之前的值是多少，而且恰好是在某件事刚刚证明工厂的表现不符合我们预期的那一刻。半途应用的配方就是这样变成一条完全混乱的产线的。决定如何处理半途应用的配方是操作员的工作，而他们会得到恰好足够做这件事的信息：

```text
PARTIAL v3: 2 of 5 written before one failed, nothing undone
  1. set_mode loop.line_02_die_tic: written, verified
  2. set_setpoint loop.line_02_die_tic: written, verified
  3. set_value number.line_02_speed: failed: the device answered the write with an exception
  4. turn_on switch.line_02_heater: skipped
  5. select_option input_select.product: skipped
```

目标可以是 `written`、`failed`（已发出，设备说不行，或什么也没说，所以不知道是否生效）、`not_sent`（闸门在最后一刻将它拒之门外）或 `skipped`。应用是 `applied`（每个目标都已写入）、`partial`（有些已写入）或 `failed`（第一个就没有写入）。

然后配方屏幕会提供**应用剩余目标**。这是一次新的应用，针对没有写入的目标，使用相同的版本和参数，先再次整体检查，以它自己的调用 id 审计，并以 `application:<id>` 为父级，以便把两者放在一起查找。它绝不会自动执行。有人查看发生了什么，修复使其停止的原因，然后按下按钮。

### 3. 读回

写入不等于生效。PLC 可以接受一次写入，而它自己的逻辑在下一个扫描周期把它覆盖。带比例的寄存器可以接收 12.34 却保持 12.3。因此在最后一次写入之后，每个已写入的值都会被读回：

- 对设备上的目标，只依据**其写入之后取得的**读数，这样缓存里记着的设备之前所说的内容就无法确认任何东西；
- 依据实体的状态，或者对阀门、电机和回路而言，依据该服务所设置的属性（`current_position`、`speed`、`setpoint`、`mode`）；
- 数字在其自身的百万分之一以内即视为一致（浮点寄存器会把 0.1 返回为 0.10000000149，这是同一个设定值），其他内容必须完全一致。

每个已写入的目标在读回之后为 **`verified`**，如果在 `verify_sec` 内没有读回则为 **`unconfirmed`**，并附上读到的内容：

```text
  3. set_value number.line_02_speed: written, unconfirmed (not confirmed within 10s: read back 240, not 250)
```

未确认在配方屏幕上显示为**琥珀色**，绝不是绿色，并且在事件日志和系统日志中是一条警告。这不是失败：值已发出，设备已接受，而应用仍然是 `applied`。这是一个提醒您去看看的标记，因为它可能没有生效。辅助项保存自己的值，所以辅助项目标直接从它那里验证。

读回完成后才会返回答复，所以应用一个配方最多需要 `verify_sec`。

## 重叠

两个配方把对同一设定值的写入交错进行，会让它停在后到的那个值上，而那不是任何人的配方。所以在一次应用写入并读回期间，它会占住它所针对的每个实体，另一次针对其中任何一个的应用会被拒绝，返回 `409`，并说明是哪个配方挡了路。等它结束，再应用。

这种占用是在进程内的：来自 Gateway 的一次应用和旁边 `--mcp-stdio` 进程的一次应用不会互相阻止。请只运行一个写入方，或者把代理的配方和操作员的配方放在不同的设备上。

## 版本

配方的名称、描述、设备节点和权限属于配方本身，就地更改。**它写入的内容是一个版本，而版本绝不会被更改。** 保存不同的目标、不同的参数、不同的前置条件或不同的 `verify_sec`，会存下下一个版本并使它成为当前版本。版本 3 永远恰好是它保存当天的样子，而每次应用都记录它所用的版本和参数。上周二发往工厂的内容，始终有答案。

- 只更改名称，或只更改备注，不会产生版本。
- 对某人此后已替换的版本进行保存，会被拒绝，返回 `409`，而不是悄悄丢弃对方的更改。编辑器会发送它正在编辑的版本。
- 可以有意应用较旧的版本：在应用抽屉中选择它，或使用 `"version": 2`。应用会说明它是版本 2。
- 版本抽屉显示每个版本，包括保存者、他们的备注，以及与上一个版本相比的变化，逐个目标列出。

删除配方会删除它的版本。它的应用记录会保留：它们是发往工厂的内容，这份历史会比配方活得更久。

## 捕获一个

当产线已经在运行 A 级时，没有人会手写一个有四十个目标的配方。**捕获**会取您选择的实体，起草一个配方，把每一个都设回它此刻持有的值，顺序就是您选择的顺序：数字的值、开关的开或关、选择项的选项、阀门的位置、电机的速度、回路的模式，然后是它的设定值。您给它命名，修剪一下，把每个订单都会变的数字改成参数，然后保存。

值未知或不可信的实体会被**拒绝，而不是捕获**：质量不是良好的读数、`unknown`、`unavailable`、已禁用的实体。用错误读数建成的配方，每次有人应用，都会把这个错误读数写回工厂。

## 谁可以应用

操作员应用配方（`recipes.apply`）；管理员编写配方（`recipes.write`）；所有人都可以读取配方（`recipes.read`）。装载 A 级是操作员存在的意义。决定 A 级是什么，是工程师的判断。

配方可以指明一个更窄的专属权限：`"apply_permission": "recipes.apply.night_setback"`。这样应用它时还需要这个权限，而操作员角色并不持有。通过他们各自的权限列表，把它授予可以应用该配方的人：

```json
["recipes.read", "recipes.apply", "recipes.apply.night_setback"]
```

`recipes.apply.*` 授予每个配方的权限，管理员拥有一切。没有它的用户会被拒绝，并且**这次拒绝会留有记录**：在配方的历史中有一条带着其名字的被拒绝的应用，和其他任何应用一样。通过 scene 实体也是如此。

代理不持有任何用户的权限，所以**代理绝不会应用指明了专属权限的配方**。它可以读取它，并询问是否会被应用；答复会说明为什么不会。

## 前置条件

```json
"precondition": "states['input_boolean.line_ready'] == 'on' and float(states['sensor.line_02_die_temp']) < 250"
```

自动化语言，对照有人按下应用时工厂的状态求值，参数作为 `vars`。为假就拒绝配方，并说明这一点。它防止的是在错误的时刻应用正确的数字，而不是联锁：联锁存在于 PLC 中，在网络失效时它依然有效。

## 从规则、脚本或代理

规则或脚本用 `apply_recipe` 步骤应用一个配方（参见[自动化](/zh-hans/iot/automations/)）：

```json
{"type": "apply_recipe", "params": {"recipeId": "grade_a", "params": {"speed": 250}}}
```

它以规则 `automation:<id>` 或脚本 `script:<id>` 的身份应用，每次写入都带有该次运行的来源，应用的父级就是那次运行。除非每个目标都已写入，否则该步骤会失败；未确认的值不会使它失败，跟踪中会写明 `NOT confirmed by read-back`。脚本的试运行也会检查该配方。

通过 MCP，`list_recipes` 显示每个配方及其目标和参数，`validate_recipe` 询问某个配方现在能否应用，`apply_recipe` 应用它，并带有一个**必填**的原因。代理的写入带有来源 `mcp`，所以闸门对其中的每一次都适用，并且在写入关闭（`HOTLOOP_ALLOW_WRITES`）时，`apply_recipe` 会在检查任何内容之前就被拒绝。参见 [MCP](/zh-hans/iot/mcp/#配方)。

## 它的实体

每个配方都是一个 `scene` 实体，`scene.<id>`。它的状态是上次应用的时间（写入了内容的应用），以时间戳表示，在从未应用过之前是 `unknown`。它的属性说明最近一次应用的情况：`last_result`、`last_version`、`last_applied_by`、`last_application`，以及当一次已应用的配方有这么多值没有读回时的 `unconfirmed`。它的磁贴上有应用按钮。`scene.turn_on` 会应用它，数据中带有 `params` 和 `version`。规则可以根据它的状态触发，该状态每次写入了内容的应用变化一次。

删除配方会使其实体成为孤儿，就像删除脚本一样。

## 记录

每一次应用，包括被拒绝的，都是 `recipe_applications` 中的一行：配方、版本、参数、谁、从哪里、为什么、调用 id、每个目标的结果，以及是否读回。它在第一次写入之前打开，在读回之后完成，所以进程在中途死掉的那一次，仍会说明它已经开始。Gateway 下次启动时会把它标记为 `failed`、`interrupted by restart`，并指向写入审计中的调用 id。没有任何东西会恢复它。

每次应用是 scene 下系统日志中的一行，也是[事件日志](/zh-hans/iot/logbook/)中的一条，类型为 `recipe`，与它做的写入并列。配方的历史保留它最近的 5000 次应用。

## 不止一个进程

对配方的每一次更改和每一次应用，都会通知数据库上的每个进程，所以在一个 pod 上保存的配方就是另一个 pod 所应用的那个，而由 `--mcp-stdio` 进程发起的应用会让 Gateway 的 scene 实体发生变化。

## 备份

配方、每个版本和每次应用都包含在备份中，并按原样恢复。备份在中途捕获的应用会以 `applying` 状态回来，并在第一次启动时像崩溃一样被标记为 `failed`。参见[备份与恢复](/zh-hans/iot/backup/)。

## API

[HTTP API](/zh-hans/iot/api/#配方) 列有每个路由。简述如下：

| <span class="sr-only">详情</span> | <span class="sr-only">详情</span> |
|---|---|
| `GET /api/recipes` | 每个配方，其当前内容和最近一次应用 |
| `POST /api/recipes` | 创建一个，作为版本 1 |
| `POST /api/recipes/capture` | 根据实体此刻持有的值生成的草稿 |
| `PUT /api/recipes/{id}` | 保存；新内容即新版本 |
| `GET /api/recipes/{id}/versions` | 每个版本，按保存时的样子 |
| `POST /api/recipes/{id}/validate` | 现在能应用吗？不写入任何内容 |
| `POST /api/recipes/{id}/apply` | 应用：`200` 已应用，`409` 被拒绝，`502` 部分或失败 |
| `GET /api/recipes/{id}/applications` | 每次应用，包括被拒绝的 |
