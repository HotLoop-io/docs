---
title: "MQTT 发现"
description: "把 ESPHome、Zigbee2MQTT、Tasmota 或 Shelly 指向代理，设备就会出现，在 admin 接受并逐点启用之前一律只读。"
---

把设备指向 HotLoop 的代理，它就会出现。它的传感器会读数，它的开关会显示状态，它的实体带有它声明的名称、单位和类别。没有人需要手敲变量列表。

而且它不能命令任何东西。发现创建的每个点都是只读的，一直如此，直到 admin 接受该设备，再逐个手动启用每个点，并查看命令将发往的确切主题。主动声明自己的设备，是在告诉你它是什么。这很有用。但这不是一个设备挣得了切换你工厂里继电器的权利，HotLoop 也不会假装如此。

## 谁在使用这种格式

这种格式的主题形如 `homeassistant/sensor/kitchen/power/config`。它带着定义它的项目的名字；HotLoop 使用它，是因为发布方都在使用，关系仅此而已。

| 发布方 | 如何到达这里 | 我们用什么来测试 |
|---|---|---|
| **ESPHome**（它的 `mqtt:` 组件） | 按组件，默认开启，retained | 真实节点的录制输出（见下文） |
| **Zigbee2MQTT** | 按组件，几乎处处用模板 | 真实安装的录制输出 |
| **Tasmota** | 它自己的格式，见下文 | 九台真实设备的录制输出 |
| **Shelly**（Gen2、Gen3、Gen4） | 完全没有声明；从它发布的状态中学习，见下文 | 十五组真实消息的录制输出和厂商文档 |
| 其他任何发布这种格式的设备 | 同上 | 格式本身的规则 |

ESPHome 与 Zigbee2MQTT 一样，以真实节点的录制内容为准。

录制内容是真实安装发布的消息，由运行它的人捕获，记录了发布方、版本和设备，除 JSON 空白外没有任何改动。

## Tasmota

当前的 Tasmota 不发布 `homeassistant/` 格式。它的文档说，这已从所有构建中移除。它以 retained 方式发布的是它自己的：

- `tasmota/discovery/<MAC>/config`：设备本身（它的主题、完整主题模式、继电器和灯、开与关的词、遗嘱词）；
- `tasmota/discovery/<MAC>/sensors`：它的传感器当时读到的内容。

这两者都由 Tasmota 的 `xdrv_12_discovery.ino` 中的 `TasDiscovery` 写出（读自 arendst/Tasmota `development` 5c295fb，2026-10-12）。HotLoop 把这两者变成其他所有发布方都会产生的同样组件，所以之后的一切（已发现画面、接受、启用、写入关口、读取）都是同一条代码路径。MAC 是设备的身份；同时也以 `homeassistant/` 格式声明自己的设备（带 SetOption19 的旧固件）是同一台设备。

| Tasmota 说 | HotLoop 创建 |
|---|---|
| 一个继电器（`rl` 1） | 一个开关：读取 `stat/<topic>/POWER`（有多个时为 `POWER1`、`POWER2` 等），用设备自己的开和关的词；用 ON 或 OFF 向 `cmnd/<topic>/POWER[n]` 发命令 |
| 一盏灯（`rl` 2） | 一盏灯：开和关方式相同。有一个调光器时，它的亮度是 `tele/<topic>/STATE` 的 `Dimmer` 键，0 到 100，用 `cmnd/<topic>/Dimmer` 设置 |
| 传感器消息中的每个数字 | 各自一个传感器，按路径（`ENERGY` `Power`、`SCD40` `CarbonDioxide`）从 `tele/<topic>/SENSOR` 读取，使用 Tasmota 赋予该名称的单位和类别。三相电表的数组是每相一个传感器 |
| 它的遗嘱 | 可用性：`tele/<topic>/LWT`，用设备自己的 Online 和 Offline 词 |

主题按 Tasmota 的方式构建：它的完整主题，把 `%prefix%` 和 `%topic%` 填好，所以主人修改过完整主题的设备（`tasmota/35D7A0/%prefix%/`，或 `bi/test/%topic%/%prefix%`）会在它实际使用的主题上读取和发命令。

它不读取的内容，它会说出来，写在数据源的问题里，绝不沉默：卷帘、开关输入、按钮、iFan、摄像头、彩灯的颜色，以及带多盏灯的设备的亮度。录制内容里没有任何迹象表明这些能用，所以这里不声称能读取它们。

**询问。** Tasmota 在继电器变化时报告它，并每五分钟报告一次所有内容。因此当一台设备开始被读取时，HotLoop 向 `cmnd/<topic>/POWER` 发送一条空消息，Tasmota 会用每个继电器的状态来回答，且不会移动任何东西；没有它，一台没有变化的设备在 HotLoop 启动后最多五分钟内读取为未知。这条消息是空的，发往以 `POWER` 结尾的主题，不发往别处，而只监听的数据源什么也不发送。

**灯的亮度**随 Tasmota 的遥测到达（每五分钟一次，除非设备的 `TelePeriod` 更短），而不是在变化的瞬间。开和关立刻到达。

**在每个代理上**，这种格式是一个开关（代理上的 `tasmota`，位于设置，MQTT）。现在新增的代理它是开着的；内置代理始终开着；已经存在的代理仍然完全按原来的方式监听，所以在有人打开之前它是关着的。关的意思是 HotLoop 在那里连 `tasmota/discovery/#` 都不订阅。

配置和其他任何东西一样不可信。以并非自称的那个 MAC 发布的配置、没有 `%topic%` 或带通配符的完整主题、含斜杠的主题、含引号的开词、它不认识的版本：每一种都会被拒绝并说明原因，不创建任何东西。含引号的传感器名称永远到不了模板。

**用什么测试过。** 九台设备的真实消息，从 Tasmota 自己的控制台捕获：

| 录制 | 设备 | 来源 |
|---|---|---|
| esp32-8relay-13.4.0 | ESP32 板，8 个继电器，Tasmota 13.4.0 | github.com/arendst/Tasmota/issues/20953 |
| esp32-zigbee-gateway-reboots-15.3.0.1 | 无继电器的 ESP32，三次启动 | github.com/arendst/Tasmota/issues/24487 |
| esp8266-sps30-scd40-airsensor-14.1.0 | CO2 和颗粒物传感器，14.1.0 | github.com/arendst/Tasmota/issues/24780 |
| esp8266-sps30-scd40-airsensor-15.4.0-invalid-json | 同一台设备在 15.4.0 上，其固件发布了末尾带逗号的 JSON | 同一个问题 |
| nous-a1t-energy-plug-14.5.0 | 带电能计量的 NOUS A1T 插座 | github.com/arendst/Tasmota/issues/23094 |
| olimex-esp32-poe-counter-custom-fulltopic-14.5.0 | 计数器和一台三相电表，完整主题已修改 | github.com/arendst/Tasmota/issues/23775 |
| shelly-dimmer2-15.3.0.3 | 运行 Tasmota 的 Shelly Dimmer 2 | github.com/arendst/Tasmota/issues/24560 |
| tuyamcu-energy-meter-custom-fulltopic-14.5.0 | TuyaMCU 电能表，完整主题已修改 | github.com/arendst/Tasmota/issues/23165 |
| wemos-2relay-15.1.0.1 | 两个继电器，来自 Tasmota 作者自己的控制台日志 | github.com/arendst/Tasmota/issues/24006 |

这些是录制内容，不是工作台上的设备。录制内容里没有的是亮度（调光器自己的 `tele/STATE` 行在它的源日志里是乱码；它的 `Dimmer` 键在同一份录制的 `STATUS11` 里，Tasmota 用同一个函数构建它），以及功率查询得到的回答（录制内容里是 Tasmota 控制台中的问与答，而不是 HotLoop 在询问）。

## Shelly

Shelly Gen2、Gen3 或 Gen4 不声明任何东西。没有可等待的配置主题。它在 MQTT 开启且状态通知开启后所做的，是每当变化时把每个组件的完整状态发布到 `<prefix>/status/<component>`（`switch:0`、`cover:0`、`light:0`、`input:0`，以及虚拟的 `boolean:200`），并把它的遗嘱发布到 `<prefix>/online`。所以 HotLoop 通过它说的话来了解设备：它发布过的组件、每个组件携带过的字段，以及来自它 `sys` 状态的 MAC。前缀默认是设备的 id（`shellyplus2pm-485519968144`），也就是它的型号和 MAC，所以使用默认前缀的设备甚至不用等 `sys`。使用某人手敲前缀（`ShellyLichtGarten`）的设备，必须先发布 `sys` 才能与另一台区分开，在那之前它会在数据源的问题里被点名，并且不会被创建。

学到的内容按前缀保存，只增不减。沉默的组件并没有被移除，状态里内容比上一次少也不会拿走任何东西，所以重启不会让设备丢失部件。之后的一切与其他发布方是同一条路径：已发现画面、接受、逐点启用、写入关口、读取。

| Shelly 说 | HotLoop 创建 |
|---|---|
| 带 `output` 的 `switch:n` | 一个开关：从 `<prefix>/status/switch:n` 读取 `output`；用 `on` 或 `off` 向 `<prefix>/command/switch:n` 发命令 |
| `light:n` | 同样的一盏灯，用 `set,true` 和 `set,false`；状态里带 `brightness` 时，一个 0 到 100 的亮度，以 `set,true,<level>` 发送 |
| `cover:n` | 一个遮蔽器：读取 `state`（open、closed、opening、closing、stopped），并发送 `open`、`close` 和 `stop`。说出 `pos_control` 的遮蔽器是已校准的，所以它还读取 `current_pos`，并接收 `pos,<n>`；没有的只能打开和关闭 |
| switch、light 或 cover 上的 `apower`、`voltage`、`current`、`freq`、`pf`、`aenergy.total`、`temperature.tC` | 各自一个传感器，单位为 W、V、A、Hz、Wh 和摄氏度，类别取自 Shelly 文档 |
| `input:n` | 其 `state` 的一个二进制传感器 |
| `devicepower:n`、`voltmeter:n`、`illuminance:n`、`presencezone:n` | 电池、外部电源、电压、光照水平、人员存在和物体数量的传感器与二进制传感器 |
| `boolean:n`、`number:n`、`enum:n`（虚拟组件） | 只读传感器。设置虚拟组件是 RPC 调用，这里不做，并且每一个都会在数据源的问题里说明 |
| 它的 `online` 遗嘱 | 可用性，用 Shelly 自己的 `true` 和 `false` |

命令就是厂商 MQTT 页面在 MQTT Control 下列出的那些，测试要求 HotLoop 严格遵守这份清单：开关用 `on`、`off` 和 `toggle`；灯用 `set,<bool>,<brightness>`；遮蔽器用 `open`、`close`、`stop` 和 `pos,<n>`。每一条都是经过关口的写入，由人启用。

**询问。** Shelly 在组件变化时发布它，所以没有变化的设备在变化之前会读取为未知。当设备开始被读取时，HotLoop 向 `<prefix>/command` 发送 `status_update`，按同一页面的说法，它会让设备发布各组件的状态，并且不移动任何东西。就是这一个词，发往以 `/command` 结尾的主题，不发往别处，而只监听的数据源什么也不发送。每次设备开始读取时都会发生，所以连续启用多个点会询问多次。

**设备上必须开启什么。** 启用 MQTT 并填入代理地址；开启状态通知（`status_ntf`）；以及，为了命令，开启控制（`enable_control`）。HotLoop 自己的代理有一个 `shelly` 登录配置，以设备的前缀命名，只允许它发布自己的状态并监听 `<prefix>/command`，别的都不行。

**它不读取什么。** 在数据源的问题里说明，绝不沉默：没见过的种类的组件（带 LoRa 附加件的 Gen4 上的 `lora:100`、`pm1`、`em`）、省略了读取来源字段的 switch 或 cover，以及虚拟组件的设置。输入事件（双击、长按）到达 RPC 通知主题 `<prefix>/events/rpc`，不被读取；只读取输入的 `state`。超过两级的前缀（`home/garage/boiler`）听不到；一级或两级可以。不通过 RPC 发送任何内容。

**在每个代理上**它是一个开关（代理上的 `shelly`，位于设置，MQTT）。现在新增的代理它是开着的；内置代理始终开着；已经存在的代理仍然完全按原来的方式监听，所以在有人打开之前它是关着的。它之所以是开关，是因为它监听的主题 `+/status/+` 范围很宽，而在 `*/status/*` 下承载其他内容的代理希望把它关掉。关的意思是 HotLoop 在那里不订阅它们。

它和其他任何主题一样不可信。不是由字母、数字和 `_.-` 构成的前缀、不是 `kind:number` 的组件、不是对象或超过 64 KiB 的负载、声明超过 64 个组件的设备，以及同时被学习的超过 512 台设备，都会被忽略；保存在某个前缀下却自称是另一个前缀的结构会被拒绝。

**用什么测试过。** 十五组真实消息，以及厂商自己的文档。

| 录制 | 设备 | 来源 |
|---|---|---|
| plus-1-fw1.4.2-switch-rpc | Plus 1，固件 1.4.2 | github.com/iobroker-community-adapters/ioBroker.shelly/issues/1055 |
| plus-2pm-cover-mode | 作为卷帘使用的 Plus 2PM，已校准 | 同一个仓库，issues/1088 |
| 1pm-mini-gen3-fw2.0.0-switch | 1PM Mini Gen3，2.0.0 | 同上，issues/1592 |
| 2pm-gen3-fw2.0.1-beta3-switch | 2PM Gen3，2.0.1-beta3，两个通道 | 同上，issues/1627 |
| 2pm-gen4-lora-addon | 带 LoRa 附加件的 2PM Gen4 | 同上，issues/1349 |
| plug-s-gen3-fw2.0.1-beta1-switch | Plug S Gen3 | 同上，issues/1594 |
| pro4pm-gen2-fw2.0.1-switch-set | Pro 4PM，2.0.1，发帖人的 MAC 已涂抹 | 同上，issues/1640 |
| pro-dimmer-2pm-fw1.3.0-light | Pro Dimmer 2PM | 同上，issues/974 |
| dimmer-gen3-light-sys | Dimmer Gen3 | github.com/enesbcs/shellyteacher4domo/issues/65 |
| pill-gen3-fw1.8.99 | Pill，1.8.99，带电压表 | ioBroker 仓库，issues/1232 |
| presence-gen4-fw2.1.99-dev | Presence Gen4，三个区域 | 同上，issues/1228 |
| frankever-sprinkler-virtual-components | 使用自己前缀的灌溉控制器，虚拟组件 | 同上，issues/1207 |
| official-docs-component-status | 厂商的组件示例：Plus 1PM、Plus 2PM、H&T、Pro 1、WDUS | shelly-api-docs.shelly.cloud |
| official-docs-mqtt-control | 厂商的 MQTT Control 命令 | 同上 |
| official-docs-mqtt-page, official-docs-notifications | 厂商的 MQTT 页面及其通知示例 | 同上 |

其中有两个无法构建成设备，测试也这样说：Pro 4PM 的前缀里带着发帖人的涂抹（`xxxx`）且没有 `sys`，庭院灯的前缀是它自己的前缀，同样没有。两者都在等它们的 MAC，就像真实设备那样。

**这是根据录制内容和文档验证的，不是在工作台上的 Shelly 上验证的。** 目前这里还没有。状态是真实设备发布的内容，HotLoop 读取的主题是那些设备用过的主题，命令是厂商文档给出的形式。录制内容无法证明的是：命令真的让继电器动作、遮蔽器真的走到某个位置，以及 `status_update` 的回答。等工作台上有了 Shelly，这三件事是最先要试的。

## 有设备声明自己时会发生什么

1. **它出现。** 在内置代理上，声明自己的设备立即成为 HotLoop 设备：协议 `mqtt`，不放入树中，以它自称的名字命名（`kitchen-plug`，冲突时加 `-2`），处于读取中。它的变量以它声明的内容命名（`power`、`relay`）。它的实体获得配置给出的名称、设备类别、状态类别、单位、分类和图标，配置标明默认关闭的实体会以禁用状态启动。
2. **没有任何东西被启用。** 每个变量都以只读方式创建。开关、数字或文本会立即得到它的控制实体，处于未启用状态（`armed: false`），所以画面或自动化从第一天起就可以引用 `switch.kitchen_plug_relay`。它从有人启用该点的那一刻起才开始生效，不会更早。
3. **由 admin 决定。** 设备，已发现。谁声明了它（在内置代理上，是发布其配置的登录和客户端 id）、它会创建的每个组件、它读取的每个主题、每个完整的命令主题，以及需要看什么：

   - 位于组件所读主题之外的命令主题（一盏“灯”的命令却发往 `cmnd/boiler/POWER`）；
   - 位于发现前缀之内的命令主题，或另一台设备也声称拥有的命令主题；
   - 要求 retained 命令的配置，因为 retained 命令会在设备每次重连时重放；
   - HotLoop 无法求值的模板，以及格式没有定义的配置键。

   **接受**会让它保持读取，并让它的各点可以在变量编辑器里逐个启用。它不会启用任何东西。如果设备建议了某个区域，而树中有一个节点恰好叫这个名字，接受对话框会预先填好。发布方无权把自己归到锅炉房名下；要由人点击接受。**忽略**会丢弃设备、变量和实体（历史会保留，和任何设备一样），并在它再次声明时保持丢弃。删除已发现的设备等同于忽略，因为一个不断声明自己的设备只会重新出现。

## 当它改变主意时

**不同的登录会被扣下等待审查，无论它说什么。** 在内置代理上，设备会记住它被接受时所用的登录。同一台设备由另一个登录声明时，即使配置逐字相同，也会被扣下审查，两个登录并排显示，日志里会有一条警告。要么有人把设备移到了新登录下，要么有登录在声明不属于它的设备。应用，新登录就成为它被接受所用的登录。拒绝，声明同样内容的那个登录仍保持被拒绝。

**已接受设备下发生变化的配置会被扣下等待审查。** 已接受的配置继续运行。已发现画面逐字段显示变化，运行中的对比已声明的，admin 应用或拒绝。单位从 °C 变成 °F，或者状态主题指向别处，恰恰就是一个错误数字获得可信面孔的方式。应用变更绝不会改变某个点是否已启用：那是人的决定，并且一直如此。

固件更新、新的设备名称、新的型号或不同的图标会自动应用。不该有人为一次版本号变化去点击。

在没有人接受设备之前，最新的声明总是生效：还没有人在它之上构建任何东西。

**空配置会撤回一个组件。** 它的点读取为不良，并说明“发布方于 14:02 撤回”，什么都不会被删除。该点上的报警保留其目标，并说明为什么不良。如果同一个组件回来，它会被恢复，在发送新值之前，它读取为“撤回后再次声明；等待下一个值”，而不是把离开之前的值冒充为当前值。一台无人接受并撤回了其全部组件的设备会消失，因为没有人在它之上构建过任何东西。

**Zigbee2MQTT 给设备改名**时，会清除它旧的配置主题，并用相同的唯一 ID 声明新的主题。HotLoop 以唯一 ID 为组件建立索引，所以这是相隔一秒的一次撤回加一次恢复，什么也不会丢失。

## 读取

状态会先经过组件的取值模板（如果有），再经过组件自己的匹配：二进制传感器用 `payload_on`/`payload_off`（默认 `ON`/`OFF`），开关用 `state_on`/`state_off`，数字用数字，select 用其中一个选项。**任何不匹配的内容都是带原因的不良读数**，显示在磁贴上：

- `"CLOSE" is neither payload_on "CLOSED" nor payload_off "OPEN"`
- `value_json has no key 'temperature'`
- `"unavailable" is not a number`
- `the publisher sent no value`（它发送了 `None`、`null`、空，或 `unknown`）
- `no update for 300 s (expire_after)`

第一条是真实的：Zigbee2MQTT 1.41.0 就是这样声明 Avatto TRV07 的窗户传感器的，捕获它的人因为窗户始终不显示而提交了问题。HotLoop 把它显示为不良并说明原因，而不是去猜。

**可用性**是设备的链路，不是读数。当设备在它的可用性主题上说自己离线时，它会以自己的话显示为已断开（“the device says it is offline (plug/status = offline)”），它的实体不可用。在第一条可用性消息到达之前，配置了可用性的设备是不可用的。这是格式的规则，也是正确的规则。代理会话不会因此被拆除：它与该代理上的其他所有设备共用。

`expire_after` 会让一个值在这么多秒没有更新后变为不良。`off_delay` 会在这么多秒后把二进制传感器关闭，因为配置说设备从不发送关闭。JSON 属性会落到实体上，最多 64 个键和 8 KiB，位于 HotLoop 自己的属性之下（`friendly_name`、`source`、`armed` 等始终优先）。

没有状态主题的组件永远读取为不良。HotLoop 绝不会从命令推断状态。

## 命令

在三件事按此顺序成立之前，不会命令任何东西：

1. **有人接受了设备。** 在那之前，变量编辑器不会在它上面启用任何点（“accept the device first”），写入关口也会自行拒绝它的命令，所以手工编辑的行或带有已启用点的旧备份同样到不了任何地方。
2. **有人启用了该点**，在变量编辑器里，一次一个。在复选框之前，编辑器会说明命令发往哪里、发送什么：“Commands go to `plug/relay/set`, sending ON or OFF.”
3. **写入关口放行该命令**，与其他所有写入一样：写入已开启、代理的 MCP 开关、变量的范围、实体自己的检查、一个有效会话。无论是否被拒绝，都会连同它的调用 id 一起审计。试运行问的正是同样的问题。

发出的内容就是配置所说的：开关用 `payload_on` 和 `payload_off`，按钮用 `payload_press`，select 用选项，数字或文本用值（整数就是整数，`5` 而不是 `5.0`），如果配置有命令模板就经过它。按钮只按一次。它的“松开”会是设备从未要求的第二条命令，所以已发现的按钮是单发的。

灯会得到 `payload_on`/`payload_off`（JSON 模式的灯，`{"state":"ON"}`），以及按其自身 `brightness_scale` 换算并取整的百分比亮度，发往它的亮度命令主题（JSON 模式的灯，`{"state":"ON", "brightness":128}`）。遮蔽器会得到 `payload_open`、`payload_close` 或 `payload_stop`，以及通过 `set_position_template` 从百分比换算到它自己 `position_closed`..`position_open` 的位置。阀门会得到它的打开和关闭负载（上报位置的阀门则是它的 `position_open` 和 `position_closed`）、发往其命令主题的位置，以及一次 `payload_stop`：和按钮一样，已发现阀门的停止是单发的。配置用 `null` 关闭的负载（没有停止的遮蔽器）是关口会带着原因拒绝的命令。

在下列情况下，关口会带着原因拒绝命令：

- 没有人接受该设备；
- 它所在的代理是只监听的；
- 发布方撤回了该组件；
- 它的命令模板超出了子集范围（“command template not supported: filter `regex_replace` is not supported at column 12”）。绝不会是“改为发送原始值”；
- 它的配置没有命令主题；
- 它的配置没有所要求操作的负载：对配置为 `payload_stop: null` 的遮蔽器发停止，select 没有的选项，超过 100% 的亮度。负载是在检查中生成的，所以试运行同样会说不。

**retained 命令遵循配置。** 如果配置要求 `retain: true`，HotLoop 就以 retained 方式发布该组件的命令，并在人需要对它做决定的每个地方都说明：已发现画面会标出，变量编辑器会用平实的话说出来。在启用之前先弄清这意味着什么：代理会保留最后一条命令，并在设备每次重连时交给设备，比如凌晨三点，没有任何人动手。命令仍然通过了关口，仍然带着名字留在审计轨迹里；只是它会再次发生。

任何地方都没有“把这个发布到那个主题”：自动化里没有，脚本里没有，MCP 里也没有。那会是绕过关口的旁门，只是名字好听些。在代码中，发现里只有两样东西会发布：驱动的写入（只有关口能到达它），以及 birth。一个守卫测试会对驱动包做类型检查，如果其他任何东西调用这两者之一，就让构建失败，并用一个预先埋下的绕过来证明它确实有效。

## 模板

没有 Python，没有 Jinja 引擎。没有循环，所以模板的开销就是它的长度。

`{% set name = value %}` 是支持的，而且只支持这种形式：Zigbee2MQTT 把每个温控器的模式写成 `{% set values = {'manual':'heat', ...} %}`，然后去查它，而模式无法读取的温控器是不可信的温控器。没有命名空间，没有解包，没有块形式。`.keys()` 也支持，只作为 `in` 的右侧，因为那些模板只在这一处用到它。

| <span class="sr-only">详情</span> | <span class="sr-only">详情</span> |
|---|---|
| 结构 | 文本、`{{ expr }}`、`{% if %}` / `{% elif %}` / `{% else %}`、`{% set name = value %}`、`{# comments #}`、`-` 空白控制 |
| 变量 | 取值模板：`value`、`value_json`（仅当负载是 JSON 时）、`entity_id`、`name`；命令模板：`value`、`entity_id`、`name` |
| 表达式 | 字面量、`.attr`、`['key']`、`[0]`、切片、`+ - * / // % **`、`~`、比较、`and or not`、`in`、`x if c else y`、映射上的 `.get(key, default)`、`in mapping.keys()` |
| 测试 | `defined`、`undefined`、`none`、`number`、`integer`、`float`、`boolean`、`string`、`mapping`、`sequence`、`true`、`false`、`eq`、`ne`、`lt`、`le`、`gt`、`ge`、`in`、`odd`、`even`、`divisibleby` |
| 过滤器 | `float`、`int`、`round`、`bool`、`default`/`d`、`string`、`lower`、`upper`、`capitalize`、`title`、`trim`、`replace`、`truncate`、`abs`、`length`/`count`、`min`、`max`、`tojson`、`to_json`、`from_json`、`is_defined`、`iif` |
| 函数 | `float()`、`int()`、`bool()`、`iif()`、`min()`、`max()` |

当格式对某个过滤器的文档说明与标准 Jinja 不同时，HotLoop 遵循格式。要紧的是这一条：**不带默认值的 `float` 和 `int` 会失败**，遇到不是数字的东西时。标准 Jinja 会悄悄返回 `0`，而当传感器停止应答时，这个零会告诉你水箱是空的。

值按 Python 的 `str()` 的方式渲染，因为每个发布方的配置都是照着它写的：`True`、`None`，`21.0` 仍是 `21.0`。这不是装饰。Zigbee2MQTT 的接触传感器声明 `payload_on: false`，并与渲染出的 `False` 匹配。

**缺少的键就是错误，除非已经处理。** 在没有它的负载上写 `{{ value_json.temperature }}` 是会说明这一点的不良读数，而不是空字符串。`default`、`is defined` 和单独的 `{% if value_json.x %}` 是有意处理它的，没有问题。

**超出子集的，在配置到达时被拒绝**，并指出位置：“value template not supported: filter `regex_findall_index` is not supported at column 12”。组件仍会被创建，让你看到它存在，并带着这个原因读取为不良。没有尽力而为的部分渲染，也没有“改用原始负载”。两个真实的模板被有意拒绝：`now()`（取决于 HotLoop 何时求值的值不是对设备的读数），以及一个用命名空间和 `regex_findall` 构建正则模式的 Zigbee2MQTT 事件模板。

限制：模板 4 KiB，嵌套 32 层，输出 64 KiB，64 位整数（溢出是错误，不是回绕）。

格式自己的过滤器不属于标准 Jinja，有手写的用例，引用了每个过滤器要求我们遵守的文档化行为。录制内容中的每个模板都必须能解析。

## HotLoop 用什么构建什么

| 组件 | 变量 | 实体 |
|---|---|---|
| `sensor` | 有单位、状态类别或数值设备类别时为 `float`，否则为 `string` | sensor |
| `binary_sensor` | `bool` | binary_sensor |
| `switch` | `bool` | binary_sensor，以及一个未启用的 switch 控制实体 |
| `number` | `float`，以配置的 `min`/`max` 作为变量的范围 | sensor，以及一个未启用的 number 控制实体，带最小值、最大值和步长 |
| `text` | `string` | sensor，以及一个未启用的 text 控制实体 |
| `select` | `string`，只读取它的某一个选项 | sensor，以及一个带配置选项的未启用 select |
| `button` | `string`，接受一次按下，不读取任何内容 | 一个未启用的单发按钮（变量自己的读取实体创建为隐藏） |
| `light` | `bool` 开/关；有亮度时为 `float` 0 到 100 % | 一盏未启用的灯 |
| `cover` | `string` 状态，同时接受 `open`、`close` 和 `stop`；有位置时为 `float` 0 到 100 % | 一个未启用的遮蔽器 |
| `valve` | `string` 状态；若上报位置则为 `float` 0 到 100 %；`bool` 命令（打开或关闭）和 `bool` 停止，只被命令、从不被读取 | 一个未启用的阀门，其停止为单发 |
| `event` | `string`，事件类型 | 一个事件 |
| `device_automation`（触发器） | `string`，其负载到达时为 `<type>_<subtype>` | 一个事件，每个触发器一个 |
| `lock` | `string`，以它自己的词读取，并接受 `lock`、`unlock`、`open` | 一把未启用的锁 |
| `fan` | `bool` 开/关；`float` 速度 0 到 100 %；`string` 预设和方向；`bool` 摆动，各自在有时 | 一个未启用的风扇 |
| `siren` | `bool` | 一个未启用的警报器 |
| `scene` | `bool`，一次按下 | 一个未启用的单发按钮 |
| `notify` | `string`，一条消息，只被命令、从不被读取 | 一个未启用的通知器 |
| `update` | 已安装版本和最新版本的 `string` | 一个更新：两者不同时为开。它的安装命令从不发送 |
| `device_tracker` | `string`，`home`、`not_home` 或一个区域 | 一个追踪器 |
| `tag` | `string`，扫描到标签时为标签的 id | 一个事件 |
| `climate` | `string` 模式；`float` 设定值、下限和上限设定值以及湿度设定值，各自以配置的 `min_temp`/`max_temp`（或 `min_humidity`/`max_humidity`）作为范围；`float` 室温和湿度；`string` 风扇、摆动和预设模式以及动作；`bool` 电源，只被命令、从不被读取；各自在有时 | 一个未启用的温控器 |
| `humidifier` | `bool` 开/关；其范围内的 `float` 湿度设定值；`string` 模式和动作；`float` 室内湿度 | 一个未启用的加湿器 |
| `water_heater` | `string` 模式；其范围内的 `float` 设定值和当前温度；`bool` 电源，只被命令、从不被读取 | 一个未启用的热水器 |
| `alarm_control_panel` | `string` 状态，以格式的词读取，并接受其 `supported_features` 列出的动作，各自带自己的负载 | 一个未启用的报警面板 |
| `vacuum` | `string` 状态，接受其 `supported_features` 列出的动作；`float` 电量；`string` 风扇速度，各自来自其 JSON 状态 | 一个未启用的吸尘器 |
| `lawn_mower` | `string` 活动；`bool` 开始修剪、暂停和回站，各自是自己主题上的一次按下，只被命令、从不被读取 | 一个未启用的割草机 |
| `camera` | `string`，最新图片的短哈希；图片本身保存在内存中 | 一个摄像头 |
| `image` | 同上，针对 `image_topic` 上的图片；或 `string`，来自 `url_topic` 的 URL | 一个图像 |

对于灯、遮蔽器、阀门、事件、触发器以及其后各行的每个组件，变量自己的读取实体会创建为隐藏：在画面上它就是一个实体。每个变量仍然单独启用，所以位置你信得过、而打开和关闭你信不过的遮蔽器，正可以是那个样子。接受之后才获得某个值的东西（开始上报亮度的固件）是需要审查的变更，当人应用它时，实体会连同变量一起获得该角色。

JSON 模式灯的状态消息会被合并，因为该模式只发送变化的部分：只含亮度的消息，或者单独一条 Zigbee2MQTT 的 `last_seen`，会让灯保持开着。它的颜色、色温和效果以属性显示，不被命令；开、关和亮度会被命令，已发现画面会对带颜色的灯说明这一点。默认模式灯的颜色主题也一样：不读取、不命令，并被列出。模板模式不受支持，并会这样说明。遮蔽器的倾斜既不读取也不命令，并会这样说明。

设备触发器只在它自己的 `payload` 上触发：Zigbee2MQTT 把按钮的每个动作放在一个主题上，每个触发器就是其中之一。没有 `payload` 的触发器会在其主题上的任何内容上触发。

风扇的速度按配置自己的 `speed_range_min`..`speed_range_max` 读取，就像格式所做的那样：高于关闭的第一档是第一个百分点。配置说不可能出现的等级（声明四档却上报 25 的 ESPHome 风扇）是会说明这一点的不良读数，而不是 625%。

已发现画面会列出组件的命令可能发往的每一个主题：灯的亮度主题、风扇的速度主题，以及主主题，并标出每个位于组件所读范围之外、位于前缀之内、或被另一台设备声称拥有的主题。

温控器或热水器的设定值范围是配置自己的，配置没有给出时采用格式的默认值（温控器 7 到 35 °C，热水器 43.3 到 60 °C，配置写 `temperature_unit: F` 时按 °F）。这是变量的范围，所以关口会在发送任何东西之前，拒绝给最高只到 30 的散热器阀门发 31 °C。它的模式是配置的列表，列表中没有的模式同样被拒绝。画面提供的正是这些，当应用的变更带来新模式时，画面也会得到它。

报警面板的 `code` 是消费方画面在发送任何东西之前要求的内容。在 HotLoop 中，谁可以布防或撤防由关口决定，变量由人启用，每条命令都经审计，所以动作按配置所说发出。命令模板需要代码本身（`{{ code }}`）的面板不能被命令：HotLoop 没有可填在那里的代码，已发现画面会这样说明。吸尘器的 `send_command_topic` 不被使用：任意命令正是 HotLoop 无法对照配置检查的东西。

摄像头或图像的图片保存在内存中，每个组件最新的一张，最大 4 MiB，由 `GET /api/entities/{entity_id}/image` 提供。HotLoop 只在这些字节是 JPEG、PNG、GIF 或 WebP 时才保留它，无论配置的 `content_type` 如何声称：SVG 是会运行脚本的文档，而一张会在打开仪表板的人那里运行脚本的“图片”就是漏洞。它的变量保存一个短哈希，所以历史能说明图片何时变化，而数据库里不用塞满 JPEG。通过 URL 声明的图像是一个链接：HotLoop 显示它，仅当它是 http 或 https，并且从不抓取它，因为会抓取设备所指任意地址的服务器，可能被指向网络上的任何东西。两者都不记入日志簿；摄像头每秒都在变，而 tag_history 已经有每一次变化。

格式定义的每个组件都会变成某种东西。它没有定义的组件（`kettle`）会连同它声明的内容一起保存，并被列为不创建任何东西。该格式没有日期、时间或 datetime 组件，所以这个列表里也没有。

实体 ID 是 HotLoop 的，由设备和变量构成。配置的 `object_id` 和 `default_entity_id` 会被忽略：配置无权在 HotLoop 的命名空间里挑名字，而恶意的配置会去挑 `switch.boiler_main`。

## 一切都不可信

配置所说的一切都来自任何能在该前缀上发布的人。因此：

- 名称和文本有长度上限，并去除控制字符，画面把它们作为文本放到页面上，绝不作为 HTML；
- 带通配符的主题、`$` 主题，或没有基准可放的 `~`，会带着原因被拒绝；
- 超过 64 KiB 的配置会被拒绝；一台设备的组件不能超过 512 个；一个代理上等待决定的设备不能超过 256 台；每秒超过 200 条的配置消息会被丢弃并计数。每一次拒绝都会被计数并显示在已发现画面上，绝不会不声不响地丢弃；
- HotLoop 订阅 `<prefix>/+/+/config` 和 `<prefix>/+/+/+/config`，从不订阅前缀下的 `#`，所以游离的深层主题不可能让它去解析任何东西；
- 超过 256 KiB 或不是 UTF-8 的状态负载是不良读数。

在内置代理上允许匿名连接时，网络上的任何人都可以声明设备并发布到任何命令主题，已发现画面会用红色说明这一点。给每台设备它自己的登录，在 HotLoop 里按其配置创建，以其主题命名（[内置 MQTT 代理](/zh-hans/iot/broker/)）：这样它只能声明自己，别的什么都做不了，也碰不到另一台设备的命令主题。

## 代理一侧

发现运行在内置代理上（见[内置 MQTT 代理](/zh-hans/iot/broker/)），只要代理开着，它就默认开启。HotLoop 自己的客户端用每次启动时创建、只保存在内存中的登录来登录：没有需要配置的东西，备份里也没有可泄露的东西。它只发布自己的一件东西，即 birth（`<prefix>/status` = `online`），它会让监听它的发布方重新声明。

| 变量 | 默认值 | <span class="sr-only">Details</span> |
|---|---|---|
| `HOTLOOP_BROKER_DISCOVERY` | `true` | 在内置代理上监听声明 |
| `HOTLOOP_BROKER_DISCOVERY_PREFIX` | `homeassistant` | 它们到达时所用的主题前缀 |

每个代理一个客户端，即 `hotloop-disc-embedded`，由监听器和每台已发现设备的驱动共用。`--mcp-stdio` 辅助进程不会打开任何客户端：第二个同 id 的客户端会每隔几秒把 Gateway 的客户端从代理上踢掉。同一个数据库上有多个副本时，只有持有发现锁的那个会监听。

## 其他代理

很多工厂已经运行着代理：一台作为 UNS 的 Mosquitto，或是一个 Zigbee2MQTT 盒子自带的那台。HotLoop 也监听它们。设置，MQTT，添加代理：一个 id（它在来自该代理的每台设备中为代理命名）、它在哪里、一个登录，以及它的发布方所用的声明前缀。代理不必开着，HotLoop 做这件事也不需要内置代理。

有三点与 HotLoop 自己的代理不同，是有意为之：

- **设备在收件箱里等待。** 在繁忙的工厂代理上，“自己出现”意味着午饭前屏幕上有三百台设备。所以已声明的设备会列在已发现画面上，不创建任何东西、也不读取，直到有人接受它。然后它被创建、开始读取，它的各点可以像其他任何点一样被启用。你信得过、可以任由其倾倒一切的代理，可以切换为“设备自己出现”。
- **没有遗嘱。** HotLoop 连接时不带遗嘱。共享代理上的 `offline` 遗嘱会告诉那里的其他所有发布方有东西消失了，而其实只是 HotLoop。测试会检查 CONNECT 数据包本身，并拔掉连接来证明什么也没有说。
- **它的 ACL 是它自己的。** HotLoop 看不到别人的代理上谁发布了什么，所以那里没有“由登录声明”，每个登录能碰什么是那个代理自己的事。给 HotLoop 一个能读取前缀和你所接受设备的主题、并能写入 birth 和命令主题的登录，别的都不要。对于 Mosquitto：

  ```
  user hotloop
  topic read homeassistant/+/+/config
  topic read homeassistant/+/+/+/config
  topic write homeassistant/status
  # the devices you accept, for example a Zigbee2MQTT bridge:
  topic read zigbee2mqtt/#
  topic write zigbee2mqtt/+/set
  ```

**只监听**用于 HotLoop 不能发言的代理：生产 UNS、别人的工厂。HotLoop 在那里从不发布任何东西。没有 birth，没有命令。这是会话的规则，不是画面的规则：它的发布会被拒绝，写入关口会以“the broker plant-uns is listen-only”拒绝发往它的设备的每条命令，包括试运行，即使设备是有人接受的、点是有人启用的。它的登录只需要 `topic read` 行。

密码用设备凭据密钥（`HOTLOOP_SECRET_KEY_FILE`）封存，和 UniFi 控制台的一样，并且绝不会从 API 再出来。没有密钥时，带密码的代理会被拒绝，而不是以明文保存。备份以封存形式携带它，并遵循与设备凭据相同的规则来恢复（[备份与恢复](/zh-hans/iot/backup/)）。密码无法打开的代理会被列出，但不会连接，并说明原因。

更改一个代理，监听器和来自它的每台设备都会以新设置重新连接。关闭一个，它的设备保留，读取为不良，并说明它们的代理没有在这里运行。移除一个会连同它的收件箱一起带走，并且只要有人从它那里接受的设备仍然存在，就会被拒绝，并点出这些设备的名字。

## 在 Edge Relay 上

Edge Relay 也用同样的代码进行发现，但它没有用来保存决定的数据库，也没有用来做决定的画面。所以它接收听到的任何内容，读取并通过 Sparkplug 转发，而它发现的任何东西都不能被启用：它的变量和每个已发现的变量一样是只读的，它的设备永远不会被接受，中继根本没有写入路径。在它的设备文件里写明代理；见 [Edge Relay 参考](/zh-hans/edge-relay/reference/#发现-41810)。你可以命令的设备从另一侧到达那里：在 Gateway 上被接受并启用，通过它推送的文件。它停止时会忘掉听到的内容，并从代理那里重新听到。

## 重启与重放

已接受的设备从它们的设备行运行。HotLoop 不需要任何一条 retained 消息就能随它的工厂一起恢复。

内置代理在重启后不保留任何东西，所以之后每个配置都是“缺失”的。**缺失的配置不是撤回**：只有明确的空配置才是。任何别的做法都会在设备每次重启时撤回整个工厂。在设备发送它的下一个状态之前，它的实体读取为未知，绝不会把重启之前的值冒充为当前值。

一个代理一次重放数百条 retained 配置，就是一个批次：两秒的安静，一次处理，一次重新加载。重放已有记录的内容，不会改变任何东西，也不会重新加载任何东西。

## 备份

`mqtt_devices`（谁接受和忽略了什么）、`mqtt_configs`（每条配置的到达原样，逐字节）和 `mqtt_discovered`（每个组件，已规范化）都在每份备份里。这些决定，是任何设备都无法再次声明回来的部分。

## API

位于 `/api/discovery` 之下。见 [HTTP API](/zh-hans/iot/api/#mqtt-发现)。

## 在网络上发现

同一个画面还会列出 HotLoop 通过 mDNS、SSDP 和 DHCP 在工厂网络上听到的设备，决定方式相同。见[网络发现](/zh-hans/iot/network-discovery/)。
