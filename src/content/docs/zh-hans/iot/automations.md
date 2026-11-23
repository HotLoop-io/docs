---
title: "自动化规则"
description: "支持十种触发器、条件和步骤序列的规则，保存时编译，每一次写入都要经过写入闸门。"
---

一条规则由三部分组成：有事发生，条件成立，动作执行。

规则可以控制设备，所以有两条性质没有商量余地。

**条件在保存规则时编译，而不是在规则触发时。** 语法错误会在作者还盯着编辑器时就被发现，而不是变成一条悄悄从不运行的规则，或者更糟，一条在凌晨 3 点、序列已经执行到一半时报错的规则。编辑器在你输入时就会校验；编译不通过的规则在保存时会被拒绝。

**条件在沙箱中求值。** [expr-lang](https://expr-lang.org) 没有 I/O，无法访问文件系统或网络，在编译时检查类型，并且保证会终止。最后一条最重要：条件是在通往写入的路径上求值的，能无限循环的表达式语言，就可能卡住持有写锁的引擎。

## 触发器

任何一个触发器触发，规则就会运行。

| 类型 | 触发时机 | 关键字段 |
|---|---|---|
| `tag_change` | 变量的值发生变化 | `deviceId`, `tagName` |
| `threshold` | 某个值**越过**限值 | `deviceId`, `tagName`, `threshold`, `direction`, `hysteresis` |
| `state` | 实体的状态变化，或某个状态保持了一段时间 | `entityId`, `from`, `to`, `forSec` |
| `schedule` | cron 表达式到点 | `cron` |
| `interval` | 每 N 秒 | `intervalSec` |
| `alarm` | 报警进入某个状态 | `alarmId`, `alarmState` |
| `device_state` | 设备连接或掉线 | `deviceId`, `toState` |
| `webhook` | 收到一个入站 POST | `webhookPath` |
| `mqtt` | 某个主题上来了一条消息 | `topic` |
| `startup` | 进程启动 | n/a |
| `sun` | 现场的黎明、日出、正午、日落或黄昏，可加偏移 | `event`, `offsetSec` |

### 阈值在越过时触发

`threshold` 在值*越过*限值时触发，而不是在它停在限值之上时触发。按"值高于 200"触发，意味着只要值保持在高位，每次扫描规则都会触发，对于控制设备的规则来说，这就是一场命令风暴。

`hysteresis` 防止在限值附近徘徊的值每次抖动都重新触发规则：一旦升到限值之上，值必须降到 `threshold - hysteresis` 以下，触发器才能再次触发。

```json
{
  "type": "threshold",
  "deviceId": "press-01", "tagName": "Zone1_Temp",
  "threshold": 200, "direction": "rising", "hysteresis": 5
}
```

`direction` 取 `rising`、`falling` 或 `either`。启动后的第一次读数只建立基线，不触发，否则无论值是多少，每条阈值规则都会在开机时触发一次。

### 状态触发器跟随实体

`state` 在实体的状态字符串变化时触发：`off` 变 `on`，`212.5` 变 `213`，`on` 变 `unavailable`。`from` 和 `to` 用来收窄范围。两个都省略，则每次变化都会触发，包括变为 `unavailable` 以及从它变回，这通常是"通知某人"想要的，却永远不是"控制某个设备"想要的。请指定 `to`。

```json
{
  "type": "state",
  "entityId": "binary_sensor.press_01_run",
  "from": "off", "to": "on"
}
```

它只对状态触发，别的都不算。属性变化，或者状态保持最后一个好值而质量变差，都不算状态变化。

下面说明它究竟何时触发，因为控制设备的规则值得知道。触发器跟随的是实体引擎自己对"什么变了"的记录，而不是变量总线。引擎在读数到达时计算实体的状态，并且每秒把所有实体重新算一遍，作为对来不及处理的一批数据的兜底。它算出的每一次变化都会按顺序只上报一次，触发器能看到每一次。因此：

- **每次变化只触发一次。** 每秒一次的重算只上报自引擎上次查看以来发生变动的内容，所以不可能把同一次变化上报两次，而且重新加载规则不会重置状态触发器所依赖的任何东西。
- **引擎看到的变化不会漏掉。** 总线慢只会多花一秒延迟，不会丢掉变化。
- **没人看到的变化它也看不到。** 一个线圈在两次轮询之间变成 off、on、off，对工厂来说就是从没变过。状态触发器的好坏取决于它背后的扫描，不会更好。如果你需要快速信号的每一个边沿，请在 PLC 里锁存。
- **启动是基线。** Gateway 启动时出现的每个实体，或启用某个实体时出现的实体，都不算变化，也不触发。

如果规则落后了 10,000 次变化（数据库太慢，来不及记录它们启动的运行），最旧的会被丢弃、计数并写入日志，`GET /api/diagnostics` 会在 `automations` 下显示 `stateChangesPending` 和 `stateChangesDropped`。

给实体改名后，所有写着它旧 `entity_id` 的规则都会停止触发。这是用有意义的名字所付出的代价；改名要深思熟虑，并先搜索一遍规则。

### 保持一个状态：forSec

"水泵已经运行五分钟"是带 `forSec` 的状态触发器。变化会启动一个计时器，而不是直接触发规则；当它变成的那个状态保持了这么多秒，规则才触发。

```json
{
  "type": "state",
  "entityId": "binary_sensor.press_01_run",
  "from": "off", "to": "on",
  "forSec": 300
}
```

- **任何状态变化都会取消它。** 五分钟内从 on 到 off 再回到 on 是两次变化：第一次结束保持，第二次从零开始新的保持。时间不会累加。变为 `unavailable` 也是状态变化，所以保持期间突然没了声息的设备会取消保持。
- **只有状态才算数。** 属性变化，或状态保持期间质量变差，都不会取消它，就像它们不会触发普通状态触发器一样。如果保持不应该熬过一次坏读数，请在规则的条件里用 `qualities` 把关。
- **每次保持只触发一次。** 保持一个小时，五分钟的规则只在第五分钟触发一次，而不是每五分钟触发一次。
- **每条规则有自己的计时器**，每个触发器一个。同一个实体上 `forSec` 不同的两条规则，各自在自己的时间触发。
- **跟踪记录会说明。** 由保持触发的运行会显示为 `binary_sensor.press_01_run changed from off to on and held for 300s`，`fromState`、`toState` 和 `entity` 是开启这次保持的那次变化的。
- **保持撑不过重启。** 它保存在内存里，没有任何东西会重新启用它：重启前压机已经保持的那几分钟，在重启后一分也不算。进程回来时看到的是每个实体都出现了（基线，不是变化），通常是 `unknown`，然后设备的第一次读数把它推到读到的值。对于 `"from": "off"`，这并不匹配，所以重启前正在运行的压机不会开启任何保持，规则要等到压机下一次从 off 变为 on 并运行五分钟才触发。不写 `from` 则取决于一场你无法控制的竞速。如果第一次读数在规则开始监听之后才到，它就是一次变化，`unknown` 变 `on`，并从零开始保持：规则在那之后五分钟触发，它的跟踪记录显示 `changed from unknown to on`。如果设备比 Gateway 起来得更快，压机从一开始就是 `on`，没有任何变化，在它下一次变化之前什么也不会触发。当重启不应被算作启动时，请写上 `from`，也不要写需要它被算作启动的规则。编辑、停用或删除规则也会丢弃它的保持；保存别的规则则不会。
- **保持期间消失的实体**（被停用，或随设备一起删除）永远不会触发它。

`forSec` 最长一天（86400），而且只有 `state` 触发器接受它。它和其他一切一样在保存时检查。

### 太阳触发器

庭院灯、伴热带、停车场，任何在意外面是否天黑的东西。`sun` 在本站点的 `dawn`、`sunrise`、`noon`、`sunset` 或 `dusk` 触发，并按 `offsetSec` 偏移：负数表示提前，所以这是日落前半小时。

```json
{"type": "sun", "event": "sunset", "offsetSec": -1800}
```

- **在设备本机计算。** 根据站点的纬度和经度（`HOTLOOP_SITE_LATITUDE`、`HOTLOOP_SITE_LONGITUDE`），使用 NOAA 的太阳方程，不需要任何服务，也不需要互联网。上行链路断了的工厂，黄昏时照样开灯。参见[太阳](/zh-hans/iot/sun/)。
- **没有位置就不会武装。** 在没有纬度和经度的站点上，带太阳触发器的规则不会武装，系统日志会告诉你要设置哪两个变量。过去这是那种永远武装着却一声不响的东西，等到庭院一片漆黑才有人发现。
- **每个当天的事件触发一次，** 在当天的时刻。十月的日落每晚大约早一分钟，触发器会跟着走。
- **黎明和黄昏是民用晨昏蒙影**，太阳中心位于地平线下 6 度。这就是户外照明所围绕的"天黑到该开灯"那条线。
- **在极昼的午夜太阳下没有日落可触发**，所以日落触发器会等下一次，不管还有几周，到时再触发。
- `offsetSec` 在前后各最多六小时（21600）。再远就是 `schedule` 了。

跟踪记录会说明是什么触发的、什么时间：`30m before sunset at 2026-10-01T22:38:00Z`，条件里的 `trigger` 是 `sun`。

## 条件

返回布尔值的表达式。为空表示无条件。

表达式能看到的内容：

| 名称 | 含义 |
|---|---|
| `value`, `string`, `quality` | 触发规则的那次读数 |
| `previous` | 它之前的读数 |
| `tag`, `device` | 触发它的对象 |
| `tags["device/tag"]` | 所有当前的数值读数 |
| `strings["device/tag"]` | 所有当前的文本读数 |
| `qualities["device/tag"]` | 所有当前的质量 |
| `states["sensor.x"]` | 每个已启用实体的状态，字符串形式 |
| `attrs["sensor.x"]["unit_of_measurement"]` | 每个已启用实体的属性 |
| `qualities["sensor.x"]` | 每个实体的质量，与变量的质量并列（变量的键里有 `/`，entity_id 里永远没有） |
| `entity`, `fromState`, `toState` | 触发规则的状态变化 |
| `alarm`, `alarmState` | 触发规则的报警 |
| `deviceState` | 触发它的设备状态 |
| `now`, `hour`, `minute`, `weekday` | 时钟；weekday 为 0 是星期日 |
| `trigger` | 哪个触发器触发了 |
| `vars` | 前面步骤绑定的值 |

```
value > 200
value > 200 and quality == 'good'
tags['press-01/Zone1_Temp'] > 200 and tags['press-01/Pressure'] < 50
hour >= 6 and hour < 18 and weekday != 0 and weekday != 6
qualities['press-01/Zone1_Temp'] == 'good'
strings['cnc-01/Program'] == 'PART_4471.NC'
value > previous
states['switch.press_01_pump'] == 'off' and toState == 'on'
float(states['sensor.press_01_zone1_temp']) > 200 and qualities['sensor.press_01_zone1_temp'] == 'good'
attrs['switch.press_01_pump']['armed'] == true
```

**用质量把关。** `value > 200` 对 250 这个坏读数也为真，而坏读数就是系统在告诉你它不知道的读数。凡是控制设备的，请写 `value > 200 and quality == 'good'`。实体也一样：坏实体仍然显示它最后一个好值，规则靠 `qualities['sensor.x']` 来分辨。

**状态是字符串。** 它是 `"212.5"`、`"on"` 或 `"unavailable"`，从来不是数字，所以 `states['sensor.x'] > 200` 在保存时会作为类型错误被拒绝，而不是被保存成一个悄悄永远为假的比较。请写 `float(states['sensor.x']) > 200`，并加以把关：`float('unavailable')` 是错误，报错的条件会让这次运行失败。

`string` 是触发规则的那次读数，这意味着它不同时是 expr-lang 的 `string()` 函数。要把数字放进字符串，请用 `toJSON(value)`。

条件必须返回布尔值。返回数字或字符串的条件会在保存时被拒绝，而不是被强行转成没人想要的真假值。

## 动作

动作按顺序运行。失败的步骤会让规则停下，除非它设置了 `continueOnError`；本该关阀却没关上的步骤，后面不应该跟着假定阀门已关的步骤。

### write_tag

```json
{
  "type": "write_tag",
  "params": {
    "deviceId": "press-01", "tagName": "Cooling",
    "value": true
  }
}
```

或者用计算：

```json
{
  "type": "write_tag",
  "params": {
    "deviceId": "press-01", "tagName": "Setpoint",
    "expression": "tags['press-01/Zone1_Temp'] - 10"
  }
}
```

**它和其他一切走同一个闸门。** 自动化得到的权限不会比一个人多：必须启用写入，变量必须标记为可写，值必须在范围内，这次尝试会以 `automation:<rule-id>` 记入审计。

### call_service

通过实体的服务来控制它，就像 `POST /api/services/...` 和 MCP 的 `call_service` 工具那样。每个域接受什么，参见[实体](/zh-hans/iot/entities/#services)。

```json
{
  "type": "call_service",
  "params": {
    "entityId": "switch.press_01_pump",
    "service": "switch.turn_on"
  }
}
```

带数据，字面值或计算值均可：

```json
{
  "type": "call_service",
  "params": {
    "entityId": "number.press_01_zone1_sp",
    "service": "number.set_value",
    "dataExpressions": {"value": "float(states['sensor.press_01_zone1_temp']) - 10"}
  }
}
```

`service` 是 `domain.service`，它的域必须是该实体的域，所以用开关的服务去调用数值实体的规则会在保存时被拒绝。该域不接受的服务同样如此，而每个域接受哪些服务的清单来自实体层本身：当某个域在那里新增一个服务，规则无需在这里做任何改动就能使用。`data` 是字面的服务数据；`dataExpressions` 在运行时求值并合并覆盖其上。

它就是挂了名字的 `write_tag`。调用会变成经过同一个闸门的变量写入，以 `automation:<rule-id>` 记入审计，每一行都带有实体、服务和调用 id。被拒绝（写入关闭、变量被解除武装、值偏离实体的步长）会让步骤和运行失败，并把拒绝原因写入跟踪记录，与被拒绝的 `write_tag` 完全一样，调用已经做出或被拒绝的每一次写入都在该步骤的输出里。调用永远不会回滚：三次写入完成了两次的复合调用会停在那里，并如实说明。

### condition

序列中间的一个条件。它为假时序列到此结束，而这次运行**成功**：规则做了它被写出来要做的事，也就是停下。该步骤的输出写着 `false; the steps after this one did not run`。

```json
{
  "type": "condition",
  "params": {
    "expression": "states['binary_sensor.press_01_run'] == 'on' and qualities['binary_sensor.press_01_run'] == 'good'"
  }
}
```

它不是规则的 `condition`。那一个在任何东西运行之前检查一次，针对触发器触发时的工厂状态，为假则把这次运行记为跳过。条件步骤读取的是**步骤运行时**的工厂状态，这正是把一个条件放在 `delay` 或 `wait` 之后的意义："三十秒后压机还在运行吗？" `entity`、`toState`、`value` 以及触发规则的其余内容保持原样，`vars` 也一样。

无法求值的条件（`float('unavailable')`）会让步骤和运行失败，与规则的条件一样。`continueOnError` 在条件上保存时会被拒绝：越过一个条件继续执行，就意味着它永远拦不住任何东西。

### wait

让序列停住，直到某个表达式为真，最多等 `timeoutSec`。

```json
{
  "type": "wait",
  "params": {
    "expression": "states['binary_sensor.press_01_valve_closed'] == 'on'",
    "timeoutSec": 30
  }
}
```

它立刻看一次，在**表达式中提到的实体每次变化时**（状态、质量或某个属性）再看一次，并且无论如何每秒看一次。它盯着的实体是那些在 `states['...']`、`attrs['...']` 和 `qualities['...']` 中以字面值写出的；变量读数、时钟，或以其他方式指代的实体，则由每秒一次的查看捕获。所以对 Modbus 线圈的 wait 和它背后的轮询一样快，不会晚一秒。

一旦为真，下一步就运行，之后的步骤看到的是 wait 最后一次看到的工厂状态。如果超时先到，该步骤**失败**，连同这次运行一起，并写着 `still false after 30s`，除非 wait 指明继续：

```json
{
  "type": "wait",
  "params": {
    "expression": "float(states['sensor.press_01_zone1_temp']) < 60",
    "timeoutSec": 240,
    "continueOnTimeout": true
  }
}
```

无论哪种情况，之后 `vars.wait.completed` 为真或假，`vars.wait.waitedSec` 是等了多久，所以继续型 wait 之后的条件步骤可以据此判断：`vars.wait.completed == true`。

`timeoutSec` 必填，最长一小时。没有终点的 wait 会一直占着运行名额，直到运行的预算把它收走，在 `skip` 下这意味着规则不再触发。它也必须放得进运行的预算（`maxRuntimeSec`，默认五分钟）：十分钟的 wait 需要在它的规则上写 `"maxRuntimeSec": 900` 左右，否则规则在保存时就会被拒绝，而不是在运行中超时。表达式在等待期间报错会让步骤失败。

### stop

结束序列。`reason` 必填，并支持 `{{ expression }}` 替换；跟踪记录会显示它。

```json
{
  "type": "stop",
  "params": {"reason": "pump already running, nothing to do"}
}
```

没有 `error`，这次运行成功。带 `"error": true`，这次运行失败，原因作为它的错误，并像其他失败一样被记入日志并计数：

```json
{
  "type": "stop",
  "params": {"reason": "valve did not close in time", "error": true}
}
```

`continueOnError` 在 stop 上保存时会被拒绝。

### call_script

运行一个[脚本](/zh-hans/iot/scripts/)：一个有名字的序列，由某人写一次，这样每条需要 CIP 清洗周期或管线吹扫的规则都调用同一个，而不是各带一份自己的副本。`fields` 是它的输入，`fieldExpressions` 在步骤运行时求值并合并覆盖其上，脚本会对照自己的字段检查整体，与从界面运行时完全一样。它拒绝的值会让这个步骤失败，永远不会为了迁就而被改动。

```json
{
  "type": "call_script",
  "params": {
    "scriptId": "cip_cycle",
    "fields": {"circuit": "tank_2"},
    "fieldExpressions": {"minutes": "states['input_number.cip_minutes']"},
    "wait": true
  }
}
```

带 `"wait": true` 时，步骤会一直等到脚本的运行结束，并采用它的结果：失败的脚本让步骤失败，规则在那里停下，除非步骤写了 `continueOnError`。脚本的运行是这次运行的一部分：如果这次运行被取消或用尽预算，脚本也一样。没有 `wait` 时，脚本启动后规则继续往下走，脚本自己结束。

脚本以 `script:<id>` 运行，它做的每一次写入都带有这条规则的来源 `automation`，它的运行记录写明 `automation_run:<id>` 是它的父级。一个忙碌的、其模式拒绝再运行一次的脚本，会让等待型步骤失败（`script busy`），而对不等待的步骤只做记录，不算失败。脚本调用脚本最多嵌套五层，会调用自己的脚本在保存时就会被拒绝。

### apply_recipe

应用一个[配方](/zh-hans/iot/recipes/)：一组一起下发的设定值，一个产品牌号或一次换产。`params` 是它的参数，`paramExpressions` 在步骤运行时求值并合并覆盖其上；`version` 会刻意应用较旧的版本，省略则表示当前版本。

```json
{
  "type": "apply_recipe",
  "params": {
    "recipeId": "grade_a",
    "params": {"line_speed": 120},
    "paramExpressions": {"batch": "states['input_number.next_batch']"}
  }
}
```

配方做的事与在配方界面里做的一样，由这条规则作为应用者。它会先被整体检查，只要有任何一个目标会被拒绝，就一个都不写，步骤带着所有原因失败。然后它的目标按顺序在同一个调用 id 下发出，作为带来源 `automation` 的 `automation:<id>`，第一个失败的会终止其余的并让步骤失败；已经写入的保持已写入。只有每个目标都写入时步骤才成功。一个已发出但没有从设备读回的值不算失败，因为它确实发出了，但跟踪记录会写 `NOT confirmed by read-back`，应用记录也一样。这次应用的父级是这次运行，`automation_run:<id>`。

### 其余动作

| 动作 | 作用 |
|---|---|
| `mqtt_publish` | 在 MQTT 设备已有的连接上发布 |
| `http_request` | 调用一个端点；`bindTo` 把响应体存入 `vars` |
| `raise_alarm` / `clear_alarm` | 驱动引擎自己看不到的报警 |
| `log_event` | 写入系统日志 |
| `set_variable` | 为后面的步骤绑定一个值 |
| `delay` | 暂停，最长一小时 |
| `mcp_call` | 调用已配置的 MCP 服务器上的工具 |

`mqtt_publish`、`http_request`、`log_event` 和 `stop` 在它们的字符串中支持 `{{ expression }}` 替换。

```json
{
  "type": "mcp_call",
  "params": {
    "server": "maintenance",
    "tool": "create_work_order",
    "args": {"priority": "high"},
    "argExpressions": {"note": "'Zone 1 reached ' + toJSON(value)"},
    "bindTo": "workOrder"
  }
}
```

## 运行模式

规则在上一次运行仍在进行时被触发，会发生什么。

| 模式 | 行为 |
|---|---|
| `skip` | 丢弃新的触发，**这是默认值**，也是靠近设备时的正确答案 |
| `queue` | 在之后运行，最多排一个 |
| `restart` | 放弃当前运行并重新开始 |
| `parallel` | 两个一起运行 |

`queue` 被刻意限制为最多一个待运行。跟不上的规则否则会攒下一堆命令，全部砸向一个状态早已变化的工厂。

`minIntervalSec` 不管触发频率如何都限制速率，防止抖动的变量把设备折腾坏。从界面或 MCP 手动运行会绕过速率限制（有人是故意的），但不会绕过运行模式（两次并发运行同样危险，不管是谁启动的）。

`maxRuntimeSec` 限定整次运行；默认是五分钟。没有它，卡在一个不可达端点上的规则会永远占着运行名额，在 `skip` 下这意味着它再也不会触发。用尽它的运行会被记为超时，不管它当时是在步骤之间，还是在 `delay` 或 `wait` 中间。

### Wait、delay 与运行模式

停在 `wait` 或 `delay` 里的运行就是一次进行中的运行，运行模式决定触发会对它做什么：

| 模式 | 运行在等待时来的触发 |
|---|---|
| `skip` | 被丢弃，记为跳过。正在等待的运行继续。 |
| `queue` | 等正在等待的运行结束后再运行，不管它是怎么结束的。 |
| `restart` | 就地取消正在等待的运行并启动新的。旧的运行记为**已取消**，`a newer trigger restarted the rule`。这就是"感应灯"模式：每次触发都把结束时间往后推。 |
| `parallel` | 再启动一次运行，各自独立等待。 |

运行会在原地被取消，包括正在 wait 或 delay 的，并连同原因记为**已取消**，在以下情况：

- **它的规则被停用或删除**：`the rule was disarmed or deleted`。它排队的运行和它的 `forSec` 保持也会被丢弃。
- **它的规则被编辑**：`the rule was edited`。一个等着作者刚改过的条件的运行，不会若无其事地继续；编辑后的规则从头干净地开始。保存*别的*规则则什么都不动：每条未改动规则的运行、保持、排队运行、运行名额和间隔计时器都照常继续。
- **进程停止**：`the process is stopping`。关机不会等 wait 结束。下次启动时没有任何东西会恢复这次运行；进程没来得及记为已取消的运行（崩溃、断电），会在下次启动时被标记为已取消。

被取消或用尽预算的步骤，即使带有 `continueOnError` 也会停止运行：那个标志是给失败的步骤用的，不是给被人停掉的运行用的。步骤已经做过的事保持已做：取消之前发出的写入不会被撤销，并且会出现在跟踪记录里。

## 运行历史

每次运行都会记录逐步骤的跟踪：**已解析**的输入、输出、耗时和错误。不是模板：规则在凌晨 3 点出错时，值得知道的是 `wrote 212.5 to press-01/Setpoint`，而不是 `wrote {{expression}}`。

在自动化界面展开一次运行即可看到它的步骤。进程停止时仍在进行的运行会在停止时被取消，进程没来得及记录的运行（崩溃）会在下次启动时被标记为已取消，而不会看起来像是从上周二一直在运行。

## 一个完整示例

当某个区域在班次期间过热时启动冷却，最多每十分钟一次，并通知某人。

```json
{
  "id": "cool-zone-1",
  "name": "Cool zone 1 when hot",
  "enabled": true,
  "mode": "skip",
  "minIntervalSec": 600,
  "triggers": [{
    "type": "threshold",
    "deviceId": "press-01", "tagName": "Zone1_Temp",
    "threshold": 200, "direction": "rising", "hysteresis": 5
  }],
  "condition": "quality == 'good' and hour >= 6 and hour < 18",
  "actions": [
    {"type": "write_tag", "params": {
      "deviceId": "press-01", "tagName": "Cooling", "value": true}},
    {"type": "delay", "params": {"seconds": 30}},
    {"type": "log_event", "params": {
      "severity": "warning",
      "message": "Cooling started, zone 1 at {{ value }}"}}
  ]
}
```

按顺序读这些保护：它在越过时触发，而不是持续触发；迟滞让它不会在抖动时重新武装；条件拒绝对它无法信任的读数采取行动，并且只在班次期间运行；速率限制意味着即使其他一切都错了，它也不可能每十分钟控制工厂多于一次。

同样的思路用到实体上：压机开始运行时启动排风扇，但前提是没有人停用过这台风扇。

```json
{
  "id": "fan-with-press",
  "name": "Extraction fan follows the press",
  "enabled": true,
  "mode": "skip",
  "triggers": [{
    "type": "state",
    "entityId": "binary_sensor.press_01_run",
    "from": "off", "to": "on"
  }],
  "condition": "qualities['binary_sensor.press_01_run'] == 'good' and attrs['switch.press_01_fan']['armed'] == true",
  "actions": [
    {"type": "call_service", "params": {
      "entityId": "switch.press_01_fan", "service": "switch.turn_on"}},
    {"type": "log_event", "params": {
      "message": "{{ entity }} went {{ toState }}, fan started"}}
  ]
}
```

`from` 和 `to` 的作用是重新连接（`unavailable` 变 `on`）不会自己启动风扇；条件的作用是被停用的风扇只是一次被跳过的运行，而不是压机每次启动时在审计记录里留下一条被拒绝的写入。

再来一个用到序列步骤的：压机运行十分钟后，如果冷却阀还没开就打开它，等它的限位开关，如果始终没有动作就大声地失败。

```json
{
  "id": "cool-after-warmup",
  "name": "Open cooling after ten minutes of running",
  "enabled": true,
  "mode": "restart",
  "maxRuntimeSec": 120,
  "triggers": [{
    "type": "state",
    "entityId": "binary_sensor.press_01_run",
    "from": "off", "to": "on",
    "forSec": 600
  }],
  "actions": [
    {"type": "condition", "params": {
      "expression": "states['valve.press_01_cooling'] != 'open'"}},
    {"type": "call_service", "params": {
      "entityId": "valve.press_01_cooling", "service": "valve.open"}},
    {"type": "wait", "params": {
      "expression": "states['valve.press_01_cooling'] == 'open'",
      "timeoutSec": 60, "continueOnTimeout": true}},
    {"type": "condition", "params": {
      "expression": "vars.wait.completed == false"}},
    {"type": "stop", "params": {
      "reason": "cooling valve did not open within 60s, it is {{ states['valve.press_01_cooling'] }}",
      "error": true}}
  ]
}
```

从上往下读：保持意味着两分钟就跳闸的压机永远不会打开阀门，`from` 意味着 Gateway 重启不算压机启动；第一个条件让已经打开的阀门成为一次不控制任何东西的成功运行；wait 在阀门实体变化的那一刻就醒来；而当它始终没打开时，第二个条件让运行继续走到一个让它失败的 stop，原因里写着阀门的实际状态，系统日志里也有一条警告。阀门打开时，同一个条件为假，运行就在那里成功结束。

## Webhook

`webhook` 触发器会注册 `POST /api/webhook/<path>`。请求体可用作 `vars.body`。没有任何规则认领的路径返回 404，而不是默默接受；往空处发送的 webhook 看起来和正常工作的 webhook 一模一样。

两条规则不能认领同一个路径；第二条在加载时被拒绝，日志里有一行同时写出两者的名字。

## 规则无法武装时

已启用但没有编译通过的规则会在自动化界面显示为 **NOT ARMED**，带有红点和说明，系统日志里也有一条错误。这是最值得大声提醒的状态：作者以为它在运行。

一条坏规则不会让其他规则失效。重新加载会丢掉失败的那条，并武装其余所有规则。
