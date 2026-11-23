---
title: "HotLoop 实体"
description: "实体注册表是每个自动化、辅助变量、脚本和画面的基础：永不改变的 ID、域、服务，以及读取它们的 API。"
---

实体注册表和计算实体状态的引擎，是 HotLoop 中每个自动化、辅助变量、脚本和画面的基础。

## 已经有变量了，为什么还要实体

变量是驱动程序谈论的对象：一个保持寄存器、一个 NodeId、一个 S7 DB 偏移量。它由设备和变量名确定，不能重命名，并且只对应线路上的一个点。

实体是人和规则谈论的对象：“1 号区温度”“输送带运行开关”。它有自己稳定的名称（`sensor.zone_1_temperature`），有一个类型来说明如何显示它、可以对它做什么，还有一组与组成它的变量的绑定。

实体包裹变量，而不是取代变量，为了给实体腾出位置，变量的任何东西都没有改变。没有第二条数值管道，也没有第二个历史库：实体的状态来自同一个实时缓存，`/api/values`、报警引擎和 OPC UA 服务器本来就读取它。实体出现之前就有的每个变量端点、看板、`/api/write`、MCP 工具和自动化规则，行为与以前完全一样；实体是加在它们旁边的，没有替换它们。

## 什么都不用做就能得到的

每个变量都会自动得到一个**读取实体**：

| 变量数据类型 | 读取实体的域 |
|---|---|
| `bool`, `boolean`, `bit`, `coil`, `discrete` | `binary_sensor` |
| 其他所有类型 | `sensor` |

变量第一次被设为可写时，还会得到一个**控制实体**：

| 变量数据类型 | 控制实体的域 |
|---|---|
| bool 系列 | `switch` |
| int 和 float 系列 | `number` |
| `string`, `text`, `char` | `text` |

即使变量被撤防，控制实体也绝不会被删除。写入闸门仍像从前一样拒绝对已撤防变量的写入，实体的 `armed` 属性变为 `false`，画面就可以把控件置灰。保留实体正是目的所在：引用 `switch.press_01_pump` 的自动化或看板，不应因为某人在一个班次里撤防了水泵而失效。

现有变量的实体在升级过程中就会生成：迁移 `0005_entities.sql` 在创建数据表的同一个事务中，为每个变量补上读取实体，并为每个已经可写的变量补上控制实体。新版本处理第一个请求时，要么每个变量都有了它的实体，要么什么都没有改变。

每个报警定义也会以同样的方式得到一个**报警实体**：参见[报警实体](#报警实体)。

向控制实体下达指令（打开开关、设置数值）是一次服务调用，而服务调用就是经由 `runtime.Manager.Write` 和写入闸门的变量写入，与其他所有写入一样。没有别的入口。参见[服务](#服务)。

由多个变量组成的设备（带运行指令、运行触点和故障的水泵；带限位开关的阀门；一个 PID 回路）是一个**复合实体**，由您有意用它所含的变量构建。参见[复合设备](#复合设备)。

## 实体 ID

`entity_id` 的格式是 `<domain>.<object_id>`：小写字母、数字和下划线，最长 255 个字符。变量的自动 ID 是 `<domain>.<device>_<tag>`，两部分都转为小写，每一段不是 ASCII 字母或数字的字符都变成一个下划线：

| 设备 | 变量 | 读取实体 |
|---|---|---|
| `press-01` | `Zone1_Temp` | `sensor.press_01_zone1_temp` |
| `Line.A-2` | `Motor/Speed.PV` | `sensor.line_a_2_motor_speed_pv` |
| `press-01` | `温度` | `sensor.press_01_tag` |

两个变量生成相同的 ID 时，按注册顺序加上 `_2`、`_3`，依此类推。超过 255 个字符的名称会在后缀之前被截断，绝不会截到后缀里。

**`entity_id` 只生成一次，保存下来，永不重新生成。** 修改变量的描述、更改数据类型、把它移到另一个寄存器：这些都不会触及 entity_id。唯一能改变它的是通过 `PUT /api/entities/{entity_id}` 进行的显式重命名，这是管理员操作，并会记入系统日志（类别 `config`，对象是新 ID，旧 ID 在消息和详情中）。

重命名会保留域。实体的身份是它在数据库中的 `id` 和它的 `unique_id`，两者都永不移动：

| 实体 | `unique_id` |
|---|---|
| 变量的读取实体 | `tag:<device>/<tag>` |
| 变量的控制实体 | `tag-control:<device>/<tag>` |
| 报警实体 | `alarm:<definition id>` |
| 复合实体 | `composite:<32 random hex digits>` |

前三种由实体所包裹的对象推导而来，因此被删除后又回来的变量或报警定义能重新接管它的实体。复合实体没有这样的依据可供推导：同一个 PLC 上的两台相同水泵绑定的是不同的变量，而同样的变量也可以有意支撑两个复合实体。所以它的 `unique_id` 是随机的，创建时生成一次。它绝不会与任何其他实体冲突，包括被删除后重新构建的复合实体，那是一个新实体，也理应如此。

## 被删除的变量、孤儿实体与重新接管

删除一个变量，它的实体不会被删除，而是成为**孤儿**：`orphaned_at` 被设置，状态变为 `unavailable`。通过变量编辑器或浏览重新导入把同一个变量找回来，注册表会凭 `unique_id` 找到这个孤儿并重新接管它。它的 entity_id、名称、设备类、图标以及其他所有自定义内容都会随之回来。

这是有意为之。在工厂现场，变量被删除再重新导入的次数，远多于有人真心想“忘掉关于这个点的一切”，而引用 `sensor.oven_temperature` 的自动化应当在这个过程中继续工作。

删除整个设备则不同：它的实体随它一起被删除，就像它的变量一样。这包括所有变量都在该设备上的复合实体。跨越多个设备的复合实体不属于其中任何一个，其中一个设备被删除时，它损失的只有状态。

报警实体按相同的规则跟随它们的报警定义：删除定义，它的实体成为孤儿；用相同的 id 保存定义，它就被重新接管。

复合实体永远不会成为孤儿。它是有意构建的，所以会一直保留到有人将其删除；在它的某个变量缺失期间，它处于 `unavailable`。

`DELETE /api/entities/{entity_id}` 删除复合实体或孤儿实体。对于所包裹的对象仍然存在的变量或报警定义的实体，它会拒绝（409），并说明它该如何消失：先删除变量或定义，再删除孤儿。删除一个仍在使用的实体，只会让下一次同步用新 ID 把它重新建起来，并在此期间破坏所有引用它名称的内容。若要把它从画面上拿掉，请隐藏或禁用它。

## 注册表如何保持同步

注册表不会在变量可能变化的每个地方都挂钩子，而是做对账：读取每个变量和每个实体，创建缺少的，让失去变量的成为孤儿，让变量回来的被重新接管。对账不会漏掉明年有人新增的路径，运行两次与运行一次效果相同。它在以下时机运行：

- 启动时，涵盖升级和从备份恢复；
- 每次运行时重新加载之后，每次变量和设备变更本来就会触发它；
- 在修改变量（`POST /api/tags`、`DELETE /api/tags/...`、`POST /api/devices/{id}/import`、`DELETE /api/devices/{id}`）和报警定义（`POST /api/alarms`、`DELETE /api/alarms/{id}`）的 API 处理程序中同步进行，这样创建变量或定义后立刻请求其实体的客户端就能找到它。

注册通过数据库咨询锁在各副本之间串行化，因此导入同一个设备的两个副本不会分发出同一个 `_2`。每次产生变化的对账只向系统日志写一行，而不是每个实体一行：导入五千个点就是一个事件。

## 状态

`GET /api/states/{entity_id}`：

```json
{
  "entity_id": "sensor.press_01_zone1_temp",
  "state": "212.5",
  "attributes": {
    "friendly_name": "Zone1_Temp",
    "unit_of_measurement": "F",
    "device_class": "temperature",
    "source": ["press-01/Zone1_Temp"]
  },
  "quality": "good",
  "last_changed": "2026-09-26T14:02:11.482Z",
  "last_updated": "2026-09-26T14:02:11.482Z",
  "last_reported": "2026-09-26T14:07:40.100Z"
}
```

`state` 是不带单位的值：数字按 `/api/values` 显示的方式，`binary_sensor` 和 `switch` 是 `on` 或 `off`，字符串则是文本本身。单位是一个属性。一个有时是 `212.5`、有时是 `212.5 F` 的状态，没有任何东西能拿来比较。

规则按应用顺序列出。它们与 OPC UA 服务器用于状态码的规则相同，原因也相同：**状态绝不会好于它的证据。**

| 条件 | `state` | `quality` |
|---|---|---|
| 实体成为孤儿，或其变量已不存在 | `unavailable` | `bad` |
| 设备被禁用、被删除，或其链路未连通 | `unavailable` | `bad` |
| 链路已连通，本次会话中尚未读取到任何值 | `unknown` | `bad` |
| 不良读数 | **最后一个良好值**，从未有过则为 `unknown` | `bad` |
| 读数良好，但设备上的其他点正在失败（降级） | 该值 | `uncertain` |
| 良好读数 | 该值 | `good` |

不良读数的规则比看上去更重要。驱动程序会把读不到的点报告为读数为零的不良读数，如果把这个零当作状态显示，“液位变送器不再应答”就变成了“罐是空的”。实体会继续显示它能信任的最后一个值，并通过 `quality` 说明它已不能再为该值担保。

请注意点失败与设备失败的区别。每个数据块都失败的 Modbus 设备会放弃会话并重新连接，所以它的实体变为 `unavailable`。对部分点应答、对其他点不应答的设备保持连接（降级），只有失败的点的实体显示 `bad`。

**Modbus 设备失效后多久会显示出来。** 拒绝或关闭连接的设备，到下一次轮询时就是 `unavailable`。只是停止应答的设备（被拔掉的线缆、卡死的 PLC、重启的交换机）会保持套接字打开，由它的轮询超时来判断：它的实体会在一个轮询间隔加上设备超时的两倍之内变为 `unavailable`，再加上引擎兜底重算最多一秒。通常是一个超时；两倍则出现在设备恰好死在一次轮询中途时，因为已经在线路上的请求仍会得到完整的超时。在此之前没有读到任何新数据，所以实体仍如实显示它最后一次的读数。一个卡死但仍接受连接的设备会被立即重新连接，因此之后它的实体会在 `unavailable` 和 `unknown`（已连接，尚未读取）之间交替，直到它再次应答；两者都不会被误认为是一个值。超时是可调的旋钮：超时为 20 秒的设备在失效后 20 到 40 秒内看起来可能一切正常，所以不要把它设得比设备应答所需的时间更长。

该表适用于单个变量的实体。复合实体更严格（不良读数绝不保留其最后的值，参见[复合实体的状态如何决定](#复合实体的状态如何决定)），而报警实体的状态由报警引擎决定（参见[报警实体](#报警实体)）。

### 时间戳

- `last_changed` 只在 `state` 变化时移动。
- `last_updated` 在 `state`、`quality` 或任何属性变化时移动。
- `last_reported` 是状态所依据的那次读数的时间戳。在有读数之前它不存在。

状态是计算出来的，不是存储的，但日志簿会保存每个实体的最新状态及其最后一次变化的时间（`entity_last_state`，参见[日志簿](/zh-hans/iot/logbook/)）。重启之后，状态恢复后保持不变的实体**保留它的 `last_changed`**：从周二起一直在运行的水泵，仍然显示周二。变量实体在设备重新连接期间经历的 unavailable 和 unknown 不算作变化。Gateway 停机期间确实发生了变化的状态会得到新的 `last_changed`，并在日志簿中记一行。数值型实体（传感器、数值、回路、计数器）和按钮不被跟踪，所以它们的 `last_updated`，和所有实体的 last_updated 一样，从重启起重新开始。

### 属性

每个实体都带有 `friendly_name` 和 `source`（它所绑定的变量键）。然后，在适用时：

| 属性 | 何时 |
|---|---|
| `unit_of_measurement` | `sensor` 和 `number`：实体自己的单位，或其变量的单位 |
| `device_class`, `state_class`, `icon` | 在实体上设置时 |
| `armed` | 控制实体：变量此刻是否可写 |
| `min`, `max` | `number`：实体的选项，否则为变量的量程（如果有） |
| `step` | `number`：实体的选项，否则整数变量为 1 |
| `max_length`, `pattern` | `text`：实体的选项，`max_length` 默认为 255 |
| `quality_reason` | 变量实体，当读数不良且驱动程序知道原因时：`no field at ENERGY.Power`、`payload is not JSON`。下一次良好读数时消失 |

### 禁用与隐藏

**禁用**的实体完全没有状态：它不会出现在 `/api/states` 中，按 id 请求它时，得到的回答是它已被禁用，而不是找不到。**隐藏**的实体状态照常，这个标志是让画面在默认视图中不显示它。

### 引擎如何运行

引擎以 `entities` 的名义订阅变量总线，队列长度为 256 个批次，遵循与报警引擎和自动化引擎相同的有损约定：慢的消费者会丢批次，但绝不会卡住轮询。这里丢掉一个批次最多损失一秒，因为引擎还会每秒从缓存重新计算一次所有实体。这个节拍也能捕捉到没有谁通知过的变化，例如设备第一次轮询的结果到达。

进程内的订阅者通过 `Engine.OnStateChanged` 注册。它们在引擎自己的 goroutine 上按变化发生的顺序被调用，这正是关心“从 X 到 Y”的规则所需要的。它们必须快。引擎从不等待它们；如果它们落后超过 10,000 次变化，最旧的会被丢弃并计数。

`GET /api/diagnostics` 在 `entities` 下报告它：

| 字段 | 含义 |
|---|---|
| `entities` | 有多少个实体拥有状态 |
| `droppedBatches` | 引擎太慢而没能接收的总线批次（在 `bus.droppedPerSubscriber.entities` 下也有） |
| `pendingChanges`, `droppedChanges` | 状态变化钩子队列。积压不断增长，或出现任何丢弃，都说明某个钩子太慢 |

## 设备类与单位

设备类说明一个值是什么（`temperature`、`pressure`、`volume_flow_rate`、`running`、`problem`），这样画面可以选择图标，统计的使用方也知道该如何处理它。每个类都有它通常使用的单位。完整的表在 `model.DeviceClasses` 中。

- 对该域而言未知的设备类会被拒绝。
- 该类通常不使用的单位会被**保存，并在响应中给出警告**。工厂按工厂的习惯来标注，因为温度上写了 `degF` 而阻止保存并不值得。温度可以不带警告地接受普通的 `F` 和 `C`，因为大多数 PLC 变量数据库实际用的就是它们。
- `state_class`（`measurement`、`total`、`total_increasing`）只用于传感器。
- **没有单位换算。** 单位只是一个标签。

## API

实体端点使用 snake_case 字段名（`entity_id`、`last_changed`），而不是这个 API 通常使用的 camelCase。这是有意的：实体 API 的存在，就是为了让任何已经理解那种形状的东西也能理解这一个。

| 端点 | 权限 | 作用 |
|---|---|---|
| `GET /api/entities` | `entities.read` | 所有实体，包括孤儿。过滤：`?domain=`、`?device=`、`?orphaned=true\|false` |
| `GET /api/entities/{entity_id}` | `entities.read` | `{"entity": ..., "state": ...}`；禁用实体的 `state` 为 null |
| `GET /api/entities/{entity_id}/image` | `entities.read` | 摄像头或图像的最新图片 |
| `PUT /api/entities/{entity_id}` | `entities.write` | 修改注册表字段，包括重命名。返回 `{"entity": ..., "warnings": [...]}` |
| `POST /api/entities` | `entities.write` | 创建复合实体。返回 201 `{"entity": ..., "warnings": [...]}`。参见[复合设备](#复合设备) |
| `DELETE /api/entities/{entity_id}` | `entities.write` | 删除复合实体或孤儿。其他情况为 409 |
| `GET /api/states` | `entities.read` | 所有已启用实体的状态，按 entity_id 排序。过滤：`?domain=` |
| `GET /api/states/{entity_id}` | `entities.read` | 一个状态 |
| `POST /api/services/{domain}/{service}` | `values.write`（`alarm` 为 `alarms.ack`） | 对一个实体调用服务。参见[服务](#服务)。`?dry_run=true` 询问它会做什么，而不是真的去做；参见[先问一下](#先问一下试运行) |
| `GET /api/writes?entity={entity_id}` | `values.read` | 服务调用对某个实体执行过或被拒绝的每一次写入，最新的在前 |

每个角色都拥有 `entities.read`：实体的状态就是换了个名字的变量值，查看者本来就可以读取。只有管理员拥有 `entities.write`：entity_id 是每个自动化、看板和智能体引用实体所用的名称，修改它属于配置，而不是操作。

`PUT` 的请求体只修改它点名的字段。未知字段会被拒绝，身份字段（`unique_id`、`domain`、`platform`、设备和绑定）也一样：

```json
{
  "entity_id": "sensor.zone_1_temperature",
  "name": "Zone 1 temperature",
  "device_class": "temperature",
  "state_class": "measurement",
  "unit_of_measurement": "°F",
  "icon": "mdi:thermometer",
  "entity_category": "",
  "options": {},
  "disabled": false,
  "hidden": false
}
```

`options` 在 `number` 上接受 `min`、`max` 和 `step`（它们收窄画面提供的范围；无论如何，写入闸门仍会检查变量自己的量程），在 `text` 上接受 `max_length` 和 `pattern`。复合实体的选项是它自己的（见下面的各个域），修改它们的 `PUT` 会像创建时一样，按它的变量进行检查。`sensor`、`binary_sensor`、`switch` 和 `alarm` 不接受任何选项。

实体在设备树上也有一个位置和一组标签：`equipment_id`（null 表示跟随其设备）、客户端用来分组的只读 `area_id`，以及 `labels`。`PUT` 像对待其他字段一样接受 `equipment_id` 和 `labels`。参见[设备树和标签](/zh-hans/iot/equipment/)。

## 服务

服务是您可以对实体做的事：`switch.turn_on`、`number.set_value`。它指明您希望对实体做什么，而它下面不过是变量写入。

```
POST /api/services/switch/turn_on
{"entity_id": "switch.press_01_pump", "reason": "start of shift"}

POST /api/services/number/set_value
{"entity_id": "number.press_01_zone1_sp", "value": 212.5}
```

请求体是 `entity_id`、可选的 `reason` 和服务数据。每次调用一个实体，从不接受列表，因为“发出了什么”的答案应当针对一个实体。

### 每个域接受什么

| 服务 | 数据 | 写入 |
|---|---|---|
| `switch.turn_on`, `switch.turn_off` | 无 | 向指令变量写入 `true` 或 `false` |
| `switch.toggle` | 无 | 与当前状态相反的值，按与状态本身相同的规则从实时缓存读取。如果状态是 `unknown`、`unavailable` 或质量不良，调用会被拒绝：对状态不明的东西执行切换，就是在猜该往哪个方向动。请明确说 `turn_on` 或 `turn_off` |
| `number.set_value` | `value`，一个数字 | 向指令变量写入该值 |
| `text.set_value` | `value`，一个字符串 | 向指令变量写入该字符串 |
| `select.select_option` | `option` | 向指令变量写入该选项的原始值 |
| `button.press` | 无 | 向指令变量写入 `press_value`，`pulse_ms` 之后写入 `release_value`；`single_shot` 按钮只写一次 `press_value`，此后不再写 |
| `motor.start`, `motor.stop` | 无 | 向 `run_command` 写入 `true` 或 `false` |
| `motor.reset` | 无 | 向 `reset_command` 发一个脉冲：`true`，`pulse_ms` 之后 `false` |
| `motor.set_speed` | `value`，一个数字 | 向 `speed_command` 写入该值 |
| `valve.open`, `valve.close` | 无 | 向 `command` 写入 `true` 或 `false`；对调节阀，向 `position_command` 写入 100 或 0 |
| `valve.stop` | 无 | 向 `stop_command` 发一个脉冲；`single_shot` 阀门只写一次 `true` |
| `valve.set_position` | `position`，0 到 100 | 向 `position_command` 写入该位置 |
| `loop.set_setpoint` | `value`，一个数字 | 向 `setpoint` 写入该值 |
| `loop.set_mode` | `mode`：`auto`、`manual` 或 `cascade` | 向 `mode` 写入该模式的原始值 |
| `loop.set_output` | `value`，一个数字 | 向 `output` 写入该值，**仅当回路读数为 manual 时** |
| `counter.reset` | 无 | 向数值型 `reset_command` 写入 0，或向 bool 型发一个脉冲 |
| `alarm.acknowledge` | `note`，可选 | 没有变量：报警引擎的确认 |
| `alarm.shelve` | `minutes`，1 到 1440 | 没有变量：报警引擎的搁置 |
| `alarm.unshelve` | 无 | 没有变量：报警引擎的取消搁置，仅对已搁置的报警有效 |
| `script.turn_on` | 脚本的字段 | 本身没有变量：运行[脚本](/zh-hans/iot/scripts/)，其步骤以 `script:<id>` 的身份经由闸门写入 |
| `script.turn_off` | 无 | 没有变量：停止该脚本的所有运行 |
| `scene.turn_on` | `params`（配方的参数）和 `version`，均可选 | 本身没有变量：应用[配方](/zh-hans/iot/recipes/)，其目标以同一个调用 id 经由闸门写入 |
| `light.turn_on` | `brightness`，0 到 100，可选 | 向 `command` 写入 `true`，再向 `brightness_command` 写入亮度 |
| `light.turn_off` | 无 | 向 `command` 写入 `false` |
| `light.toggle` | 无 | 与灯的状态反馈所示相反的值；读不到时被拒绝 |
| `cover.open`, `cover.close`, `cover.stop` | 无 | 向 `command` 写入 `open`、`close` 或 `stop` |
| `cover.set_position` | `position`，0 到 100 | 向 `position_command` 写入该位置 |
| `lock.lock`, `lock.unlock`, `lock.open` | 无 | 向 `state` 写入 `lock`、`unlock` 或 `open` |
| `fan.turn_on` | `percentage`、`preset_mode`，均可选 | 向 `state` 写入 `true`，再写入给定的每个值 |
| `fan.turn_off`, `fan.toggle` | 无 | 向 `state` 写入 `false`，或与其反馈所示相反的值 |
| `fan.set_percentage` | `percentage`，0 到 100 | 写入 `percentage` |
| `fan.set_preset_mode`, `fan.set_direction` | `preset_mode`、`direction` | 写入 `preset_mode`、`direction` |
| `fan.oscillate` | `oscillating`，true 或 false | 写入 `oscillating` |
| `siren.turn_on`, `siren.turn_off`, `siren.toggle` | 无 | 与开关相同，写入 `state` |
| `notify.send_message` | `message` | 向 `message` 写入该消息 |

角色未绑定的复合服务（没有 `speed_command` 的电机上的 `set_speed`）会在规划任何内容之前，被当作未知服务拒绝。

`sensor` 和 `binary_sensor` 是只读的，不接受任何服务。服务数据中带有该服务不接受的字段时会被拒绝，就像其他请求体里拼错的字段一样：悄悄忽略您想用的字段继续执行的调用，比直接说不的调用更糟。

是整数的数字会以整数形式到达整数变量：`42.0` 就是 `42`。

### 每次调用都经过写入闸门

一次服务调用会变成一个有序的写入列表，每次写入都经由 `runtime.Manager.Write`。因此，闸门对变量写入所强制的一切，对服务调用也以同样的顺序强制：

1. 写入已启用（`safety.allowWrites`），对智能体来说，智能体写入也已启用；
2. 变量已布防（`writable`）；
3. 值在变量的量程之内，超出则被拒绝，绝不截断；
4. 然后是只有实体才知道的内容，在闸门内部对此刻的实体和变量进行检查：
   - 实体未被禁用（向没有状态的对象下达指令是不允许的）；
   - `number` 自己的 `min` 和 `max`，它们只能收窄变量的量程；
   - `number` 的 `step`，从它的最小值开始计数（它自己的最小值，否则是变量量程的最小值，否则为零）。整数变量的 step 为 1，除非实体另有规定，所以向保持寄存器写入 `1.5` 会被拒绝，而不是由驱动程序悄悄截断成 `1`；
   - `text` 的 `max_length`（以字符计，未设置时为 255）及其 `pattern`，整个值都必须与之匹配；
   - 不属于该实体的 `select` 选项或回路模式。它会按所请求的选项或模式送到闸门并在那里被拒绝，因此尝试不存在选项的人会留下记录；
   - 超出 0 到 100 的阀门位置；
   - 当回路的模式变量（此刻从实时缓存读取）不是 manual 时的 `set_output`（auto、cascade、不属于任何模式的值，或读不到）。

以上任一步骤的每一次拒绝都会被**审计**：一行 `write_audit`，带有实体、服务和调用 id，`succeeded` 为 false，原因以 `refused:` 开头。这包括没有 `values.write` 的用户。API 并不是只回答 403 就了事：它把调用标记为已拒绝后送到闸门，闸门在写入任何内容之前拒绝它，这次拒绝连同被请求的值一起记录在该实体的档案中。

它匹配的是对设备写入的形态，而不是某个名称，所以通过新的包装器或临时声明的接口进行的绕过也会被抓住。

### 调用的应答

```json
{
  "call_id": "9f2c4e1a7b3d5c60",
  "entity_id": "switch.press_01_pump",
  "service": "switch.turn_on",
  "writes": [
    {"tag": "press-01/pump", "value": "true", "status": "written"}
  ]
}
```

每次写入都有一个状态：

| 状态 | 含义 |
|---|---|
| `written` | 设备已接受 |
| `not_sent` | 闸门在到达设备之前就把它挡了下来：拒绝、没有会话、无法打开的审计行 |
| `failed` | 它已发出，设备或连接报告了错误。不知道是否生效 |
| `skipped` | 从未尝试，因为同一次调用中前面的写入没有成功 |

失败的调用以该错误的状态码应答（403 因策略或权限被拒绝，422 值被拒绝，409 对状态未知的切换或设备状态不适用于该服务，503 设备未连接，502 设备接收了写入并报告了错误，404 没有这个实体，400 格式错误的调用，500 释放没有成功的按下，或 Gateway 内部故障，此时 `error` 只是指向服务器日志的引用），并带有同样的响应体，另加 `error`。

一次调用的写入按顺序发出，第一个没有成功的写入就结束这次调用，**已经写入的内容不会回滚**。撤销本身就是一次写入，是在没有人要求的情况下对已经动作的设备所做的写入。决定是否撤销是操作员的工作，而应答会准确告诉他们调用停在了哪里。一次调用的所有写入在审计记录和应答中共用同一个 `call_id`。

有一个例外，就是瞬时指令：按钮的按下、电机的复位、阀门的停止、位型计数器的复位。它们是两次写入，按下，以及 pulse_ms 之后的释放，而释放不能随便跳过，因为跳过会让按钮一直处于按下状态。因此：

- 当按下已发出并报告了错误（`failed`）时，释放仍会发送：它可能已经生效。只有按下是 `not_sent` 时才跳过，因为那时没有任何东西被按住。
- 即使调用方在脉冲期间挂断，释放也会发送。调用在没有它的情况下继续进行。
- 如果按下已写入而释放被拒绝或失败，调用以 500 失败并如实说明：变量**可能仍保持着按下的值**，请检查并手动释放。释放的拒绝或失败记录在同一个调用 id 下的审计记录中，该调用在该实体下以错误级别而不是警告级别记入日志。

脉冲长 `pulse_ms`，默认 500，最大 10,000。调用在释放完成后才应答，所以调用方要等待整个脉冲。

每次调用在系统日志中也是一行，位于 entity_id 之下，类别 `write`，带有原因，详情中包括调用 id、来源和每次写入及其状态。各个变量的写入照常在它们各自的变量下保留自己的行。

`GET /api/writes?entity=switch.press_01_pump` 就是该实体的审计记录，包含拒绝，最新的在前。这些行带有 `entityId`、`service` 和 `callId`；直接写入变量时没有这些字段，所以每一个现有的 `/api/writes` 读取方看到的与从前完全一样。迁移 `0007_service_audit.sql` 添加了这三列，对所有现有行均为空。

### 先问一下：试运行

`POST /api/services/{domain}/{service}?dry_run=true` 询问闸门它会如何处理一次调用，而不做其中任何事。相同的请求体，相同的权限。

```json
{"dry_run":true,"entity_id":"number.press_01_zone1_sp","service":"number.set_value","writes":[{"tag":"press-01/zone1_sp","value":"212.5","status":"would_write"}]}
```

```json
{"dry_run":true,"error":"press-01/zone1_sp: this tag is not marked writable","entity_id":"number.press_01_zone1_sp","service":"number.set_value","writes":[{"tag":"press-01/zone1_sp","value":"212.5","status":"not_sent","error":"press-01/zone1_sp: this tag is not marked writable"}]}
```

这次调用与真实调用完全一样地被规划，它将进行的每一次写入都按同样的顺序，对变量、实体和设备此刻的状态，送过闸门自己的检查：写入已开启、智能体开关、变量已布防、量程、只有实体才知道的一切（step、pattern、处于 manual 的回路、被禁用的实体），以及到设备的会话。第一个会被拒绝的写入是带原因的 `not_sent`，其余是 `skipped`，而 `error` 就是真实调用会失败的那个错误，**一字不差**。会发出的写入是 `would_write`。闸门里只有一个函数（`precheck`）同时回答两者，所以试运行不可能通过真实写入并不进行的检查。`alarm` 实体不写入任何变量，所以它的试运行改为进行报警检查（引擎在运行、定义仍然存在、实体已启用、只有已搁置的报警才能取消搁置），并且在没有写入的情况下应答；报警不会被触碰，报警记录中也不会增加任何内容。

这是一个提问，所以无论是否被拒绝，裁定都以 200 应答。真实调用会在任何检查之前就拦下的请求（没有这个实体、该域不接受的服务、不接受的数据、状态未知的切换、路径中的域错误），会得到真实调用会给出的同样状态和错误。没有权限的用户得到同样的 403。

试运行不写入任何内容，不打开审计行，不向系统日志写入任何内容，也不消耗调用 id：什么都没有被尝试，所以没有什么需要交代。

它说的是**此刻**会发生什么。在试运行和真实调用之间，设备可能掉线，也可能有人撤防变量；真实调用在写入的那一刻会被完整地重新检查。有一种情况的答案比真实调用自己的检查更精确：会话已断开、其工作线程正在重新连接的设备。真实写入会走到驱动程序并在那里失败（`failed`、503，以及这次尝试的审计行），而试运行一开始就以同样的错误说 `not_sent`。

实体画面和实体抽屉中的指令提示框使用它：提示框打开时和键入值时，它都会询问，拒绝会在有人按下确认之前，以闸门自己的话显示在提示框中。这是建议，不是锁：确认仍会交给闸门，由闸门重新决定。

## 复合设备

一个变量对应一个实体。水泵不对应一个变量：它有运行指令、运行触点、故障、复位，也许还有速度，而操作员把它当作一个整体来看。复合实体就是这个整体，按名为**角色**的方式与它的每个变量绑定。

管理员用 `POST /api/entities` 构建一个：

```json
{
  "domain": "motor",
  "name": "Infeed pump",
  "device_class": "pump",
  "options": {"pulse_ms": 500},
  "bindings": [
    {"role": "running",       "device_id": "press-01", "tag_name": "P101_Running"},
    {"role": "run_command",   "device_id": "press-01", "tag_name": "P101_RunCmd"},
    {"role": "fault",         "device_id": "press-01", "tag_name": "P101_Fault"},
    {"role": "reset_command", "device_id": "press-01", "tag_name": "P101_Reset"}
  ]
}
```

`entity_id` 是可选的。省略它，就会根据名称生成一个（`motor.infeed_pump`，然后是 `_2`，依此类推）。给出它，就会原样使用，已被占用的名称会得到 409，而不是悄悄变成 `_2`：您要求的就是那个名称。`name`、`device_class`、`unit_of_measurement`、`icon`、`entity_category` 和 `options` 是每个实体都有的那些注册表字段。之后用 `PUT` 把它放到设备树上并加上标签。

创建时会针对变量当前的状态检查所有能检查的内容，并拒绝（400，并说明要修正什么）任何不对的地方：

- 域是 `select`、`button`、`motor`、`valve`、`loop`、`counter`、`weather` 之一（`GET /api/entities/composites` 会告诉您有哪些，以及每个域的角色）。变量的域由变量为您生成，`alarm` 由报警定义生成；
- 每个必需的角色都已绑定，且没有该域不具备的角色；
- **每个被绑定的变量都存在**；
- **每个变量的类型都适合它的角色**：电机的 `running` 是 bool，阀门的 `position` 是数字，计数器的计数是整数；
- **服务写入的每个变量都已经布防**（`writable`）。复合实体绝不会布防任何东西。让一个点布防，仍然是某人针对变量逐个做出的决定，一如既往；
- 选项中的每个原始值（select 选项的值、按钮的按下和释放值、回路的模式）都是它的变量可以取的值。对整数寄存器写入 `1.5` 现在就被拒绝，而不是等到有人按下按钮时。

当所有变量都在一个设备上时，复合实体随该设备一起被删除；跨越多个设备时，它不属于任何设备。它的绑定是固定的：不同的变量组合就是不同的实体，所以请删除它再构建另一个。

每一次创建和删除都是系统日志中 entity_id 之下的一行，类别 `config`，带有绑定信息。

### 角色

| 域 | 角色 | 变量类型 | <span class="sr-only">详情</span> |
|---|---|---|---|
| `select` | `state` | any | 必需。反馈：读回以找出选项 |
| | `command` | any | 必需，已布防。以选项的原始值写入。可以与 `state` 是同一个变量 |
| `button` | `command` | any | 必需，已布防。发脉冲 |
| `motor` | `running` | bool | 必需。反馈：运行触点 |
| | `run_command` | bool | 必需，已布防。`start` 写 true，`stop` 写 false |
| | `fault` | bool | 反馈 |
| | `reset_command` | bool | 已布防。由 `reset` 发脉冲 |
| | `speed` | number | 反馈，`speed` 属性 |
| | `speed_command` | number | 已布防。由 `set_speed` 写入 |
| `valve` | `state` | any | 反馈：自行上报的阀门用文字说明它在哪里 |
| | `opened`, `closed` | bool | 反馈：限位开关 |
| | `position` | number | 反馈，0 到 100 百分比 |
| | `fault` | bool | 反馈 |
| | `command` | bool | 已布防。开关阀：`open` 写 true，`close` 写 false |
| | `position_command` | number | 已布防。调节阀：`set_position`，以及作为 100/0 的 `open`/`close` |
| | `stop_command` | bool | 已布防。由 `stop` 发脉冲 |
| `loop` | `pv` | number | 必需。状态 |
| | `setpoint` | number | 必需，已布防。为属性而读取，由 `set_setpoint` 写入 |
| | `output` | number | 必需，已布防。为属性而读取，由 `set_output` 写入 |
| | `mode` | any | 必需，已布防。读取以获知模式，由 `set_mode` 写入 |
| `counter` | `state` | integer | 必需。计数 |
| | `reset_command` | bool 或 number | 已布防。bool 则发脉冲，number 则写 0（可以就是计数寄存器本身） |
| `weather` | `temperature` | number | 必需。状态 |
| | `humidity`, `pressure`, `wind_speed`, `wind_gust`, `wind_bearing`, `rain_rate`, `rain_today`, `solar_radiation`, `uv_index` | number | 反馈，各为一个属性。没有一个需要布防：气象站只读取，绝不下达指令 |

阀门至少需要 `state`、`opened`、`closed` 和 `position` 中的一个（总得有东西说明它在哪里），并且 `command` 和 `position_command` 恰好要有一个。两者同时存在，就等于对“它被告知要去哪里”有两个答案，而限位之间的状态取决于这个答案。如果 PLC 确实两者都有，请构建两个实体。

### 选项

| 选项 | 域 | <span class="sr-only">详情</span> |
|---|---|---|
| `select_options` | `select` | 必需：`[{"option": "low", "value": 1}, ...]`，按画面提供的顺序。名称唯一，值唯一（两个选项共用一个值会让状态变成猜测），每个值是数字、bool 或字符串 |
| `press_value`, `release_value` | `button` | 要么一起给，要么都不给。在 bool 变量上省略时，它们是 `true` 和 `false`，会写入选项，使按钮的行为有据可查。任何其他变量类型都需要两者 |
| `pulse_ms` | `button`, `motor`, `valve`, `counter` | 瞬时指令保持多久。1 到 10,000，未设置时为 500 |
| `single_shot` | `button`, `valve` | `true` 表示只写一次 `press_value`，从不释放：按下就是全部指令。被发现的 MQTT 按钮就是这种，因为它的“释放”会是设备从未要求过的第二条指令。接受 `press_value`，不接受 `release_value` 或 `pulse_ms`。在阀门上，它的 `stop` 只写一次 `true`，而不是脉冲：被发现的阀门的停止本身就是一条独立的指令 |
| `event_types` | `event` | 它在告知时可以触发的事件类型 |
| `role_choices` | `lock`, `fan`, `siren`, `notify`, `update`, `device_tracker`, `climate`, `humidifier`, `water_heater` | 每个可下达指令的角色所提供的词，按角色列出，每个角色 1 到 64 个互不相同的词：恒温器的模式。发现功能根据配置设置它 |
| `modes` | `loop` | 必需：模式变量对每个模式的原始值，至少是 `{"auto": 1, "manual": 0}`，如果控制器有则加上 `cascade` |

### 复合实体的状态如何决定

复合实体的状态来自它的**反馈**。它绝不会由 HotLoop 发送过指令这一事实计算出来。被告知启动但运行触点尚未吸合的电机并没有在运行，而是在启动中，如果触点始终不吸合，它就一直保持启动中，直到有人去查看。指令变量的回读算作反馈：那是 PLC 在说它持有什么，而不是 HotLoop 在回忆自己写过什么。

复合实体**从不乐观**。单个传感器在读数不良时仍显示它最后的良好值；复合实体不会。每个决定状态的反馈角色都必须有良好的读数，否则：

| 条件 | `state` | `quality` |
|---|---|---|
| 某个决定性变量已不存在，或其设备已掉线 | `unavailable` | `bad` |
| 某个决定性变量尚无读数，或读数不良 | `unknown` | `bad` |
| 所有决定性变量均良好，其中之一不确定或位于降级设备上 | 该状态 | `uncertain` |
| 所有决定性变量均良好 | 该状态 | `good` |

故障输入不再应答的电机是 `unknown`，而不是它一秒前的 `running`。哪些角色起决定作用见下文；其他角色只填充属性，读不到的就直接省去。

复合实体的 `armed` 属性，只有当它的任何服务所写入的每个变量此刻都已布防时才为 true。一台在这里能启动但不能停止的电机，不是画面应该提供的东西。

### `motor`

决定性角色：`running`，以及已绑定时的 `fault`。状态按第一条匹配的规则确定：

1. `fault` 为开：**`fault`**，无论其他是否为真。运行和故障同时出现是矛盾的，需要人去处理的是故障；`running` 属性仍会说明它在转。
2. 在运行，且运行指令的回读为关：**`stopping`**。
3. 在运行：**`running`**。
4. 未运行，且运行指令的回读为开：**`starting`**。
5. 其他情况：**`stopped`**。

如果运行指令的回读读不到，它就不起决定作用：电机此时仅凭它的触点判定为 `running` 或 `stopped`。HotLoop 不会为一直没有成功的启动设置超时：那是启动失败，应属于 PLC，或属于运行触点上的报警定义。

属性：`running`、`fault`（已绑定时）、`command`（回读）、`speed`（已绑定且可读时）、`device_class`（`pump`、`fan`、`conveyor`、`compressor`、`agitator`）。

### `valve`

自行上报的阀门（MQTT 发现）在它的 `state` 角色上用文字说明自己在哪里：`open`、`closed`、`opening`、`closing` 或 `stopped`，这就是它的状态，当它报告位置时，`current_position` 取自 `position`。不属于其中任何一个的词是 `unknown`，它所说的内容放在 `raw_value` 中。本节其余部分讲的是由 PLC 变量构建的阀门。

决定性角色：已绑定的 `opened`、`closed`、`position`、`fault` 的每一个。状态按第一条匹配的规则确定：

1. `fault` 为开：**`fault`**。
2. 两个限位开关都吸合：**`fault`**，并带 `limit_conflict: true`。阀门不可能既开又关，所以有一个开关在说谎，而到底是哪一个，不是靠猜的。
3. 开限位吸合：**`open`**。关限位吸合：**`closed`**。
4. 没有限位开关，只有位置：不高于 1% 为 **`closed`**，不低于 99% 为 **`open`**。
5. 在两端之间，正在移动或按所收到的指令停止：位置指令回读比位置高出 1% 以上为 **`opening`**，低于 1% 以上为 **`closing`**，在 1% 以内为 **`stopped`**；开关指令回读为开则 **`opening`**，为关则 **`closing`**；没有可依据的信息则 **`stopped`**。

一个停在两个限位之间、却仍被指令打开的开关阀，读数为 `opening`。如果您需要看到它停在那里，请绑定 `position`。

`current_position` 在绑定时是位置反馈，否则在开限位上是 100，在关限位上是 0，两者之间则不存在。其他属性：`open_limit`、`closed_limit`、`fault`、`device_class`（`water`、`gas`、`steam`、`air`）。

### `loop`

状态是过程变量，像传感器一样显示，仅来自 `pv`。属性有 `setpoint` 和 `output`（可读时存在）、`mode`（模式变量所读到的模式名称，读不到或值不属于任何模式时为 `unknown`）、`modes`（已配置的名称），以及 `unit_of_measurement`（实体的，否则为 PV 变量的）。回路采用传感器的设备类：温度回路、压力回路。

除非回路在**写入的那一刻**读数为 manual，否则 `set_output` 在闸门内被拒绝。向处于 auto 的回路写入输出，就是在与控制器对抗，在 cascade 中则是与两个控制器对抗。读不到的模式不算 manual。这次拒绝和其他拒绝一样，是一行带有实体、服务、调用 id 和被请求值的 `write_audit`，调用以 409 应答。请先用 `set_mode` 把回路切到 manual。

### `counter`

状态是计数，一个整数变量。`reset` 向数值型 `reset_command` 写入 0（如果 PLC 就是这样复位的，请绑定计数寄存器本身），或向 bool 型发一个脉冲。没有 `reset_command` 的计数器是只读的。`unit_of_measurement` 是实体的，否则是变量的。

### `weather`

把屋顶气象站作为一个实体：参见[天气](/zh-hans/iot/weather/)。状态是温度；其他每个读数都是属性，只有在其传感器可读时才存在，露点、热指数和风寒由它们推算得出。已绑定但读不到的读数会在 `unavailable` 中列出名称，绝不显示为零。它不接受任何服务。

### `select`

状态是 `state` 变量所读到的原始值对应的选项。不属于任何选项的值是 `unknown`，原始值放在 `raw_value` 中，而不是最接近的选项或最后一个选项。`options` 属性按顺序列出选项名称。不属于该 select 的选项会在闸门被拒绝，并连同被请求的选项一起被审计。

### `button`

按钮没有反馈。它的状态是通过此 Gateway 最后一次按下的时间，如果自 Gateway 启动以来从未被按下，则为 `unknown`。当它的指令变量已不存在或其设备已掉线时，它是 `unavailable`，因为那时按它不可能起作用。最后一次按下保存在内存中，所以重启后会重置；审计记录中无论如何都有每一次按下，这也是日志簿不记录按钮状态的原因。

## 灯、窗帘和事件

由 [MQTT 发现](/zh-hans/iot/mqtt-discovery/)为已上报的设备创建，绑定到发现功能为它建立的变量。没有人用 PLC 变量来构建这些，所以 `POST /api/entities` 不接受它们。规则与每个复合实体相同：状态是反馈所说的，绝不是 HotLoop 上一次发送的，每个服务都是经由闸门的写入，每个变量先由人来布防。

| 域 | 角色 | 变量类型 | <span class="sr-only">详情</span> |
|---|---|---|---|
| `light` | `state` | bool | 反馈：开或关 |
| | `command` | bool | 已布防。`turn_on` 写 true，`turn_off` 写 false。与 `state` 是同一个变量 |
| | `brightness` | number | 反馈，0 到 100 百分比，`brightness` 属性 |
| | `brightness_command` | number | 已布防。带 `brightness` 的 `turn_on`。与 `brightness` 是同一个变量 |
| `cover` | `state` | any | 反馈：`open`、`closed`、`opening`、`closing` 或 `stopped` |
| | `command` | any | 已布防。`open`、`close` 或 `stop`。与 `state` 是同一个变量 |
| | `position` | number | 反馈，0（关）到 100（开），`current_position` |
| | `position_command` | number | 已布防。`set_position`。与 `position` 是同一个变量 |
| `event` | `state` | any | 它最后触发的事件类型 |
| `lock` | `state` | any | 读写：`locked`、`unlocked`、`locking`、`unlocking`、`jammed`、`open`、`opening`；接受 `lock`、`unlock`、`open` |
| `fan` | `state` | bool | 读写：开或关 |
| | `percentage` | number | 读写，0 到 100 |
| | `preset_mode`, `direction` | any | 读写 |
| | `oscillating` | bool | 读写 |
| `siren` | `state` | bool | 读写：开或关 |
| `notify` | `message` | any | 写入：消息。没有可读的内容 |
| `update` | `installed_version`, `latest_version` | any | 读取 |
| `device_tracker` | `state` | any | 读取：`home`、`not_home`，或它所指名的区域 |
| `climate` | `mode` | any | 读写：状态。带 `hvac_mode` 的 `set_hvac_mode` |
| | `temperature`, `target_temp_low`, `target_temp_high` | number | 读写。带其中任意一个的 `set_temperature` |
| | `target_humidity` | number | 读写。带 `humidity` 的 `set_humidity` |
| | `fan_mode`, `swing_mode`, `swing_horizontal_mode`, `preset_mode` | any | 读写，各通过自己的 `set_` 服务 |
| | `current_temperature`, `current_humidity`, `action` | number, number, any | 读取 |
| | `power` | bool | 写入：`turn_on` 写 true，`turn_off` 写 false。没有可读的内容 |
| `humidifier` | `state` | bool | 读写：开或关 |
| | `target_humidity` | number | 读写。带 `humidity` 的 `set_humidity` |
| | `mode` | any | 读写。带 `mode` 的 `set_mode` |
| | `current_humidity`, `action` | number, any | 读取 |
| `water_heater` | `mode` | any | 读写：状态。带 `operation_mode` 的 `set_operation_mode` |
| | `temperature` | number | 读写。`set_temperature` |
| | `current_temperature` | number | 读取 |
| | `power` | bool | 写入：`turn_on`、`turn_off` |
| `alarm_control_panel` | `state` | any | 读取：`disarmed`、`armed_home`、`armed_away`、`armed_night`、`armed_vacation`、`armed_custom_bypass`、`pending`、`triggered`、`arming`、`disarming`；通过 `alarm_arm_home`、`alarm_arm_away`、`alarm_arm_night`、`alarm_arm_vacation`、`alarm_arm_custom_bypass`、`alarm_disarm`、`alarm_trigger` 写入 |
| `vacuum` | `state` | any | 读取：`cleaning`、`docked`、`paused`、`idle`、`returning`、`error`；通过 `start`、`pause`、`stop`、`return_to_base`、`clean_spot`、`locate` 写入 |
| | `battery_level` | number | 读取 |
| | `fan_speed` | any | 读写。带 `fan_speed` 的 `set_fan_speed` |
| `lawn_mower` | `activity` | any | 读取：`mowing`、`paused`、`docked`、`error`、`returning` |
| `camera` | `image` | any | 读取：最新图片的哈希值。状态是它变化的时间；`entity_picture` 是获取它的地方 |
| `image` | `image` 或 `url` | any | 读取：与摄像头一样保存的图片，或一个链接（`url`，只限 http 或 https，从不抓取） |
| | `start_mowing`, `pause`, `dock` | bool | 写入：每个按一次，通过同名服务 |

状态是 state 角色的读数（bool 为开或关），读不到时为 `unknown`，其他每个可读的角色都以它自己的名称成为属性：风扇的 `percentage`、`preset_mode`、`oscillating` 和 `direction`。`toggle` 依据反馈，没有反馈时被拒绝。通知器没有可读的内容：它的状态是 `unknown`，带 `feedback: none`。更新在已安装的不是最新版本时为 `on`，且不接受任何服务：HotLoop 从不安装固件，因为刷写失败就是一次停机。被发现的场景是一个单次触发按钮，它的按下就是场景的负载。

可以向设备发送什么，写在它的属性中，由它的配置决定：恒温器的 `hvac_modes`、`fan_modes`、`preset_modes` 和 `swing_modes`，加湿器的 `available_modes`，热水器的 `operation_list`，风扇的 `preset_modes`，吸尘器的 `fan_speed_list`（来自实体的 `role_choices` 选项，发现功能使其与配置保持同步），以及设定值的 `min_temp`/`max_temp` 和 `min_humidity`/`max_humidity`（来自变量的量程）。这些是画面所提供的内容。它们并不制定规则：无论属性怎么说，闸门都把设定值限制在变量的量程之内，驱动程序都拒绝配置中未列出的词。不带三个键中任何一个的 `set_temperature` 会被拒绝，而不是一个什么都不做的调用。没有电源主题的恒温器上的 `turn_on` 同样被拒绝，而不是去猜“开”是指哪种模式。

### `light`

按它的 `state` 反馈为开或关；读不到时为 `unknown`，完全没有状态主题时则永远是 `unknown`，带 `feedback: none`。亮度是一个属性，JSON 模式灯的 `color_mode`、`color`、`color_temp` 和 `effect` 也是属性：只显示，不下达指令。`toggle` 依据反馈，没有可依据的反馈时被拒绝。

### `cover`

有 `state` 反馈时取该反馈。只有位置时：不高于 1% 为 `closed`，高于它的任何值为 `open`。不属于这五个值的词为 `unknown`，带 `raw_value`。`current_position` 在有位置时就是该位置。

### `event`

事件的状态是它最后一次触发的**时间**（RFC 3339），`event_type` 是它当时是什么；`event_types` 列出它可以触发的内容。自 HotLoop 开始读取它以来，在它触发之前一直是 `unknown`。它不接受任何服务：没有什么能向事件下达指令。一次轮询中的两个事件显示为后一个；日志簿和历史中保留了每次读数的原样。

## 报警实体

每个报警定义都是一个实体：`alarm.<definition id>`（按与变量相同的方式生成 slug，所以 `oven-temp-hi` 是 `alarm.oven_temp_hi`），平台为 `alarm`，`unique_id` 为 `alarm:<definition id>`，以定义命名。它没有绑定，也没有设备：它的状态来自报警引擎，而不是变量，并且定义不像变量那样属于它的设备（删除设备会保留它的报警定义）。它所监视的变量是它的 `source` 属性。

状态是报警引擎所持有的 ISA-18.2 状态，按实体状态的拼写方式书写：

| 报警引擎 | 实体状态 | <span class="sr-only">详情</span> |
|---|---|---|
| `normal` | `normal` | 条件已消除，没有未处理项 |
| `unack-active` | `active_unack` | 条件为真，无人确认 |
| `ack-active` | `active_ack` | 条件为真，已确认 |
| `rtn-unack` | `rtn_unack` | 在任何人确认之前已恢复 |
| `shelved` | `shelved` | 由操作员在限定时间内静音 |
| `suppressed` | `suppressed` | 按设计静音 |

质量为 `good`：引擎的状态不是读数。当实体成为孤儿，或 Gateway 没有报警引擎时，实体为 `unavailable`。它会在每次转换发生时跟随，包括确认。

属性：`definition_id`、`source`、`condition`、`limit`、`priority`（1 到 4）、`priority_label`、`enabled`、`message`、`count`、`active`、`needs_ack`、`trip_value`、`raised_at`、`cleared_at`、`acked_at`、`acked_by`、`shelved_until`、`shelved_by`，最后几个在适用时才存在。

它的服务 `acknowledge`、`shelve` 和 `unshelve` 不写入任何变量，所以不经过写入闸门。它们调用报警引擎自己的 `Ack`、`Shelve` 和 `Unshelve`，与报警画面和 `POST /api/alarms/{id}/ack` 所调用的相同，所以它们会和那些调用一样记入报警记录（`alarm_events`）和系统日志。它们需要的是 **`alarms.ack`**，而不是 `values.write`：确认报警的是操作员，不是查看者。被拒绝的调用以 403 应答，并连同尝试者记录在该实体之下。该调用在系统日志中该实体之下也是一行，带有原因。

对没有被搁置的报警调用 `unshelve` 会被拒绝（409）。报警引擎同样拒绝它，并且会让已搁置的报警回到其条件实际所处的状态，而不是盲目地回到 normal。报警不接受的服务（`turn_on`）会在靠近引擎之前，被当作未知服务（400）拒绝。

### 带提供方的平台

报警实体是第一个**提供方**平台：它们的真实数据来源在变量之外的某处。提供方说明它的平台此刻有哪些实体，生成它们的状态，运行它们的服务，并回答它们的试运行；注册表按 `unique_id` 推导、使其成为孤儿并重新接管它的实体，就像对变量的实体那样，状态引擎在提供方自己的事件和每秒一次的节拍上重新计算它们，对其中一个的服务调用会交给提供方，而不是被规划成变量写入。写入变量的提供方仍然经由闸门写入。

辅助变量是第二个：`input_boolean`、`input_number`、`input_select`、`input_text`、`input_counter`、`timer` 和 `schedule`，是工厂里的人而非 PLC 所拥有的值，由 HotLoop 保存，并用 `helpers.write` 设置。它们不写入任何变量。参见[辅助变量](/zh-hans/iot/helpers/)。

脚本是第三个：每个脚本都是一个 `script` 实体 `script.<id>`，当它在任何进程中有运行时为开，没有时为关。`turn_on` 以服务数据作为它的字段来运行它，`turn_off` 则停止它，两者都需要 `scripts.run`。删除脚本会让它的实体成为孤儿，就像删除报警定义一样。参见[脚本](/zh-hans/iot/scripts/)。

配方是第四个：每个配方都是一个 `scene` 实体 `scene.<id>`，它的状态是它最后一次向工厂写入的时间，它的属性说明其最新一次应用的进行情况。`turn_on` 用 `recipes.apply` 应用它，当配方指定了权限时，还要用配方自己的权限。删除配方会让它的实体成为孤儿。参见[配方](/zh-hans/iot/recipes/)。

太阳是第五个：`binary_sensor.sun_up`、`sensor.sun_elevation` 和 `sensor.sun_azimuth`，根据站点的纬度和经度在设备本机上每秒计算。它们只读，不接受任何服务。没有位置的站点没有它们，而在它曾有位置时遗留下来的那些读数为 unavailable，并说明应设置哪些变量。参见[太阳](/zh-hans/iot/sun/)。

## 其他各处的实体

### 实时数据流

`GET /api/stream` 在 `values` 旁边携带一个 `entities` 事件。它以相同的方式合并，每秒最多四次，每个实体取最新状态：

```
event: entities
data: {"changed":[{"entity_id":"sensor.press_01_zone1_temp","state":"212.5",...}],"removed":[]}
```

`changed` 是自上一个事件以来每个发生变化的实体的完整状态，形状与 `GET /api/states/{entity_id}` 相同。`removed` 是不再有任何状态的 entity_id：被禁用、随设备一起删除，或被重命名而离开（新名称在 `changed` 中到达）。新连接上的第一个 `entities` 事件携带每一个状态，就像 `snapshot` 携带每一个读数那样，这样画面在任何东西变化之前就已经有了数据。`values`、`snapshot`、`alarm` 和 `device` 事件与以前完全一样。

### MCP

智能体可以使用 `list_entities`、`get_states` 和 `call_service`。`call_service` 与 `POST /api/services/...` 走同一个服务运行器，所以智能体的调用像 `write_tag` 一样受 MCP 开关控制，并以来源 `mcp` 针对实体进行审计。参见 [MCP](/zh-hans/iot/mcp/#实体)。

### 自动化

`state` 触发器在实体状态变化时触发规则，条件可以读取 `states`、`attrs` 和实体的 `qualities`，`call_service` 动作通过闸门向实体下达指令，并以 `automation:<rule-id>` 的身份被审计。参见[自动化](/zh-hans/iot/automations/#状态触发器跟随实体)。

两者都跟随引擎的 `OnStateChanged` 钩子，这就是[引擎如何运行](#引擎如何运行)中的规则很重要的原因：state 触发器会按顺序、一次不漏地看到引擎计算出的每一次变化，而不会看到引擎从未见过的任何东西。

## 画面

**实体**按每个实体在设备树上的位置（它自己的位置，否则是其设备的位置）列出所有实体，树显示在一侧，并可按位置、域、标签、文本和质量过滤。在一个位置之内，设备排在最前面（报警、电机、阀门、回路、select、按钮、计数器），然后是可以下达指令的，再是原始读数。

默认情况下，画面把每个信号只显示一次。实体模型有意给一个点配了多个实体，每一个都保有自己的 id，但画成磁贴，就成了同一个信号出现两三次：已布防的变量既是传感器又是开关，绑定到电机里的变量仍然是它自己的传感器。在真实的产线上，这使磁贴大约翻了一倍，把设备埋没了。所以画面会合并：

- 变量的读取实体位于它的控制实体后面。开关或数值就是那块磁贴，因为它已经显示实时状态，它的抽屉会随传感器的 entity_id 一起说“也可作为 传感器 使用”，供正在把自动化或智能体接到它上面的人参考。
- 绑定到复合实体中的变量位于复合实体之内，它的两个实体都在其中。复合实体的抽屉列出它的信号：角色、变量、它此刻读到的值，以及它的读取和控制 entity_id。同时位于两个复合实体中的变量，按名称归入第一个。
- 只有既未被隐藏、也未被禁用的控制实体或复合实体才会收纳其他实体。隐藏或禁用开关，它的传感器就重新得到自己的磁贴。
- 位于已合并信号上的报警，会连同报警名称标记它被合并进的那块磁贴，并从那里打开报警。合并是为了整理画面；它绝不会隐藏报警。
- 质量条旁边的计数显示“显示 13 项 · 已合并 25 项”，包含其他实体的磁贴会在底部这样说明（“5 个信号”、“+ 传感器”）。域标签、树的计数和质量条统计的是显示出来的磁贴。
- 搜索和标签过滤会查看磁贴内部。搜索一个已被合并的 entity_id 或变量，就会得到包含它的那块磁贴，带轮廓，并带有“其中包含：”和 entity_id。我们选择这种方式，而不是把整个画面切换成所有实体：您直接找到要找的水泵，而不是面对一堵磁贴墙。

“显示所有实体”会关闭合并，给每个实体各自的磁贴，供需要原始注册表的工程师使用。它默认关闭，并且这个浏览器会记住它（本地存储；隐私窗口会忘记它）。其他人的画面不会改变。

状态通过实时数据流的 `entities` 事件到达；画面从不为此轮询。磁贴在状态变化时重绘，即使其中的按钮拥有焦点也会重绘，因为因此而保留旧状态的磁贴，会把过去当成现在来显示。质量先于值绘制：

| 质量 | 画面显示 |
|---|---|
| 良好 | 值，无标记 |
| 不确定 | 值，琥珀色边缘和“不确定”徽标 |
| 不良 | 最后一个良好值，在斜线背景上置灰，“不良”，以及“最后良好值，当前读数不良”，驱动程序给出原因时，原因附在其后 |
| 尚无读数 | 斜体的“未知”，有原因时还有带原因的“读数不良” |
| 不可用 | “不可用”，整块磁贴带斜线 |

控件跟随域和角色。查看者看不到任何控件。操作员能看到位于 `values.write` 之后的控件（报警的则位于 `alarms.ack` 之后），当本部署上写入已关闭，或实体所写入的变量未布防时，控件会被禁用，并带有原因。回路的输出只在它读数为 manual 时才提供，因为只有那时闸门才允许。每条指令都会打开一个提示框，说明是哪个服务、哪些变量，以及实体此刻读到什么，并接受一个用于审计记录的原因。拒绝会让提示框保持打开，显示闸门的话以及每一次已发出或未发出的写入。新状态绝不会根据指令来假定：它在设备回读时通过数据流回来，或者不回来。

抽屉里有状态及其时间戳、控件、所绑定变量一小时、六小时或一天的历史（阶梯式曲线，最后一个值延续到现在，不良读数有标记）、同一信号的其他实体、绑定（对复合实体是它的信号）、属性，以及通过该实体发出或被拒绝的每条指令。管理员还能看到 entity_id、名称、在树上的位置、标签、隐藏和禁用，以及对复合实体或孤儿的删除。

**新建设备**（管理员）构建复合实体：选择域，给它命名，并为每个角色选择一个变量。每个角色只提供类型合适的变量，指令角色会把尚未布防的变量显示为禁用，而不是隐藏它们。必填项会被标出，但表单不强制执行：由注册表来决定，它的拒绝会按它所写的原样显示。

**工厂**是设备树和标签。参见[设备树和标签](/zh-hans/iot/equipment/)。

## 备份与恢复

`entities` 和 `entity_bindings` 在备份中，包括 entity_id 和所有自定义内容。其中包括复合实体、每个角色和每个选项，这对复合实体比对任何东西都更重要：变量的实体可以由它的变量重建，但除了备份，没有任何东西能重建复合实体。报警实体随它们的定义一起恢复，已恢复但没有实体的定义会在第一次同步时得到一个。在此版本之前制作的备份没有这两张表；恢复它，启动 Gateway，注册表的第一次同步会给每个已恢复的变量配上它的实体。`entity_labels` 也在备份中，而恢复设备树出现之前制作的备份，在[设备树和标签](/zh-hans/iot/equipment/)中有说明。

迁移 0007 向 `write_audit` 添加了三列。在它之前制作的备份仍可恢复：恢复会把列数少于当前数据表的文件加载到前面的列中，并让新列取默认值，因为添加列的迁移总是把它追加在末尾。来自更新版本的备份仍会被拒绝。参见[备份与恢复](/zh-hans/iot/backup/)。

## 目前尚未提供的内容

核心、设备树、通过写入闸门向实体下达指令、复合设备、报警实体、MCP 中的实体、自动化和实时数据流，以及各个画面，现已全部具备。参见 [HotLoop 路线图](/zh-hans/roadmap/)。state 触发器的 `forSec`（“开启五分钟”）在[自动化](/zh-hans/iot/automations/#保持一个状态forsec)中。
