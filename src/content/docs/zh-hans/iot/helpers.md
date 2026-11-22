---
title: "辅助项与现场数值"
description: "属于工厂人员自己的数值，比如批次目标或当前班次：开关、数字、选项、文本、计数器、定时器和计划。"
---

辅助项是一种属于工厂里的人、而不属于 PLC 的数值。“2 号产线正在换型。”“今天的批次目标是 1,250 kg。”“B 班在岗。”“自上次复位以来报废了十二个零件。”“吹扫还剩九分钟。”这些都不存在于任何寄存器里，而规则和画面需要知道的恰恰就是这些。

HotLoop 有七种辅助项。辅助项和其他实体一样是实体：它有 `entity_id`、状态、属性和服务，放在设备树上，出现在 `/api/states`、实体画面、通过 MCP 调用的 `list_entities`，以及自动化的状态触发器中。不同的是它的值存放在哪里：HotLoop 把它保存在数据库中，而且**辅助项的任何服务都不会写入变量**。

## 七种

| 域 | 状态 | 选项 | 服务 |
|---|---|---|---|
| `input_boolean` | `on` / `off` | `initial` (true/false)、`restore` | `turn_on`、`turn_off`、`toggle` |
| `input_number` | 数字，`"1250"` | `min`、`max` (两者必填)、`step` (默认 1)、`mode` (`slider` 或 `box`)、`initial`、`restore`，以及 `unit_of_measurement` | `set_value {value}`、`increment`、`decrement` |
| `input_select` | 所选项 | `choices` (必填，最多 100 个)、`initial`、`restore` | `select_option {option}`、`select_next {cycle}`、`select_previous {cycle}` |
| `input_text` | 文本 | `max_length` (默认值和上限均为 255)、`pattern`、`initial`、`restore` | `set_value {value}` |
| `input_counter` | 一个整数 | `initial` (默认 0)、`step` (默认 1)、`min`、`max`、`restore` | `increment`、`decrement`、`reset`、`set_value {value}` |
| `timer` | `idle` / `active` / `paused` | `duration_sec` (必填，1 秒到 7 天)、`restore` | `start {duration}`、`pause`、`cancel`、`finish` |
| `schedule` | `on` / `off` | `schedule` (必填) | 无：它跟随时钟 |

计数器是 `input_counter`，不是 `counter`。`counter` 已经是复位时会写入变量的 PLC 复合实体，它保持原样不变。

每个选项在保存辅助项时都会检查，`initial` 则与其他所有选项对照：一个范围 0 到 100、初始值却是 150 的 `input_number` 会被拒绝，而不是被启动在 100。某个域不接受的选项是错误，而不是被悄悄忽略的设置。辅助项的选项（`initial`、`restore`、`choices`、`duration_sec`、`mode`、`schedule`）出于同样的原因，在所有其他域上都会被拒绝。

## 创建

管理员创建辅助项（`entities.write`）。在实体画面上，点击“新建设备”旁边的**新建辅助项**。通过 API：

```
POST /api/helpers
{"name": "Batch target", "domain": "input_number", "unit_of_measurement": "kg",
 "options": {"min": 0, "max": 5000, "step": 50, "initial": 1000}}
```

除非您指定，`entity_id` 由名称生成（`input_number.batch_target`）。`PUT /api/helpers/{entity_id}` 修改它的名称、图标、单位或选项；`DELETE /api/helpers/{entity_id}` 把它连同它的值一起删除。完整的 API 在 [HTTP API](/zh-hans/iot/api/#helpers)中。

如果某次选项更改会让辅助项的当前值落在选项之外，就会被拒绝：比如把范围收窄到值以下，或者删除当前被选中的选项。请先设置值，或者选择包含该值的选项。值永远不会为了适应而被挪动。

## 设置

任何拥有 `helpers.write` 的人都可以设置辅助项。操作员拥有它：操作班次选择器和统计报废数量属于运行，不属于配置。查看者没有。它不是 `values.write`，因为辅助项不写任何变量。

设置辅助项是一次实体服务调用，与其他所有实体接受的调用相同：

```
POST /api/services/input_counter/increment   {"entity_id": "input_counter.scrap", "reason": "short shot"}
POST /api/services/timer/start               {"entity_id": "timer.purge", "duration": "0:15:00"}
```

响应会说明辅助项现在是什么：`{"call_id": "...", "state": "13", "writes": []}`。`?dry_run=true` 也可以使用，它用与真实调用相同的说法作答，但不改变任何东西。

在实体画面上，辅助项有自己的卡片，绝不会并入别的卡片（它没有可用来合并的变量），并为拥有 `helpers.write` 的人提供它的控件。每次更改都像其他命令一样，先附上理由确认。

MCP 没有新工具：`list_entities` 查找辅助项，`get_states` 读取它们，`call_service` 设置它们。智能体只有在开启了 `HOTLOOP_ALLOW_WRITES` 的部署上才能更改辅助项，这与写入变量所需的开关相同。辅助项不会移动任何设备，但它是规则所依据的对象，智能体拨动换型开关，就等于启动换型规则所做的一切。

## 一律拒绝，绝不截断

辅助项不接受的值会被拒绝，且不会有任何改变：

- 超出 `min`..`max`，或偏离其 `step` 的数字（从 `min` 开始计）；
- 会超过 `max` 的 `increment`，会低于 `min` 的 `decrement`（会被拒绝，而不是停在限值上：“停在限值上”是一个没人要求过的值）；
- 不在可选项之内的选项；`cycle: false` 时越过最后一个选项的 `select_next`；
- 长度超过 `max_length` 的文本，或不符合 `pattern` 的文本（整段文本都必须符合）；
- 不是整数的计数，或超出计数器 `min` 或 `max` 的计数；
- 在未运行时暂停的定时器，在空闲时取消或结束的定时器，或以不足一秒或超过七天启动的定时器；
- 已停用的辅助项；没有 `helpers.write` 的调用方；关闭了 MCP 写入的智能体。

每次拒绝都会在系统日志（`GET /api/events`）中针对该辅助项记一条警告，写明是谁提出的、为什么被拒绝，与拒绝报警确认的方式完全相同。请求本身的错误（服务不接受的字段，应填数字的地方写了 `"50"`）属于调用方的错误，以 400 作答，不更改也不记录任何东西。

## 更改记录在哪里

每次更改都是系统日志中针对该辅助项的一行：谁、从什么、改为什么、调用 id、来自哪里，以及给出的话还有理由。

```
otto   input_counter.increment: 12 -> 13; reason: short shot
system timer finished: active -> idle, due at 2026-09-27T21:10:00Z
```

这一行与值写在同一个事务中，所以不会有没有记录的更改，也不会有没有更改的记录。

状态变化在同一个事务中，也会作为一行记入[日志簿](/zh-hans/iot/logbook/)，带有同样的操作人、来源和调用 id。它由做出更改的进程写入，不管是哪一个，所以智能体通过 `--mcp-stdio` 做出的更改同样会被记录，而且只记录一次。辅助项的记录从不限速：每一行都是有人在做决定。让状态保持原样的调用（把数字设置成它已有的值）会出现在系统日志中，但不会出现在日志簿里，因为什么都没变。

## 重启

辅助项在重启后保留它的值：Gateway 回来时，班次仍是 B，计数器仍是 13。对每次都应该重新开始的辅助项（“自上次重启以来”的计数器）设置 `restore: false`：Gateway 启动时会把它放回初始值，并在日志中说明。只有 Gateway 自己会这样做。智能体在运行中的 Gateway 旁启动的 `--mcp-stdio` 进程持有同样的辅助项并能听到每次更改，但绝不会复位任何东西，因为仅仅因为某个智能体连上来就复位工厂的数值是荒谬的。

## 定时器

定时器按挂钟时间运行。启动十分钟，不管中间发生什么，十分钟后就结束：一次耗时两分钟的重启，会让它还剩八分钟要走。暂停的定时器保持暂停，并带着剩下的时间，无论重启多少次，`start` 会让它继续。

**HotLoop 没在运行期间**到期的定时器，会在 HotLoop 下次启动时回到 `idle`，`finished_late_at` 设为它本应到期的时间，并在日志中记一条警告。**不会因它触发任何东西。**等待该定时器变为空闲的规则不会运行，因为引擎在启动后第一次看到它时得到的是基线，而不是变化。它原先计时的事（吹扫、固化）要么早就发生了，要么根本没发生，现在才补做，既迟又没人要求，比说它被错过了更糟。请查找 `finished_late_at` 并做出决定。

定时器不是联锁。它按某个进程的时钟运行，经过数据库和网络，精确到秒，通常精确到毫秒。任何必须按时停止的事情都属于 PLC。

## 计划

计划在它的时间段内为开，在时间段外为关：

```json
{"schedule": {
  "mon": [{"from": "06:00", "to": "14:00", "data": {"crew": "A"}},
          {"from": "14:00", "to": "22:00", "data": {"crew": "B"}}],
  "fri": [{"from": "22:00", "to": "06:00", "data": {"crew": "C"}}]
}}
```

- 日期是 `mon` 到 `sun`。时间写作 `HH:MM` 或 `HH:MM:SS`；`24:00` 是一天的结束。
- `to` 早于 `from` 的时间段会跨过午夜：周五 22:00 到 06:00 会一直开到周六 06:00。
- 首尾相接的时间段是连续的一段开；重叠的时间段会被拒绝，因为用哪个的数据将是一种猜测。
- 时间段处于开的期间，它的 `data` 在实体的属性中（`crew: "B"`），而 `next_event` 总是说明计划下一次何时变化。
- 它按站点时区（`HOTLOOP_SITE_TIMEZONE`）的挂钟时间读取，因为 06:00 开始的班次在时钟调整的那天也是 06:00 开始。在时钟拨快的那一夜，不存在的那一小时不是开；在时钟拨回的那一夜，出现两次的那一小时两次都是开。

## 多个进程

每次更改都通过 Postgres `NOTIFY` 通告，每个持有辅助项的进程都在监听。在一个进程中设置的辅助项，会在一次往返之内在其他所有进程中显示新值，在一个进程中创建或删除的辅助项会在其他进程中出现或消失，通过 `PUT /api/helpers/{entity_id}` 做出的更改也以同样方式被获取（通过 `PUT /api/entities/{entity_id}` 做出的更改，则在其他进程下次同步注册表时到达，和任何实体一样）。每次写入都以该行的修订号为条件，所以两个进程同时对同一个计数器计数，永远不会丢掉一次计数，而两者都持有的定时器恰好由其中一个结束。

## 备份

辅助项在每个备份中：它们的配置与实体在一起，它们的值在 `helper_state` 中，包括修订号。恢复后的工厂会带着它原有的班次、目标和计数回来，正在运行的定时器仍按挂钟时间继续运行（如果其间已经到期，则为空闲并标记为迟到，如上所述）。

## 在自动化中

辅助项是规则所依据并设置的对象：

```json
{"triggers": [{"type": "state", "entityId": "input_boolean.changeover", "to": "on"}],
 "actions": [{"type": "call_service", "params": {"entityId": "number.line_2_speed_sp",
   "service": "number.set_value", "data": {"value": 0}}}]}
```

规则对变量的写入与其他写入一样经过写入关卡，规则本身作为执行者。`states['input_select.shift'] == 'B'` 可以用在条件中，规则可以用 `call_service` 设置辅助项，方式和它操作开关一样。
