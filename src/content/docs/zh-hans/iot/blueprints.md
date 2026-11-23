---
title: "规则 Blueprint"
description: "规则只写一次，留出空白，再为每台水泵填写。每条规则都保留其创建时的 Blueprint 版本，因此一次编辑不会改动四十条规则。"
---

Blueprint 是只写一次、留有空白的规则。“当*这台电机*运行超过*这么长时间*时，通知我，并在*我要求时*将它停止。”知道规则该做什么的人只写一次。其他人只需为每台泵、每个水箱、每条产线填写空白，最终得到一条普通的自动化。

另一种做法是每家工厂早已有的：同一条规则复制到四十台泵上，等有人发现错误的那天，只改好了其中三十七台。副本会逐渐走样。一个 Blueprint 加四十组输入则不会。

产出的是一条普通规则。它与手写的规则并列显示在自动化屏幕上，由同一个引擎启用，它做的每一次写入都以 `automation:<id>` 的身份经过写入闸门，并留有审计记录，拒绝也包括在内。没有 Blueprint 专用的运行时，也没有旁门。只有一个表单和一条规则。

## 关于 Blueprint 的唯一规矩

**规则保留其创建时所用 Blueprint 的版本。**

编辑 Blueprint，它的版本号就会升高。由它创建的规则没有一条会改变。7 号泵上周二还正确的规则，不会因为周三有人想着 12 号泵编辑了它的 Blueprint，就悄悄变成另一条规则，因为淹地下室的恰恰是 7 号泵。

把规则移到新版本是一次**升级**，而升级是需要人来请求的：

1. 自动化屏幕在规则上写明：*来自 Blueprint 电机运行过久，版本 1*，以及*版本 2 可用*。
2. **审阅升级**会准确显示什么将改变，逐部分对比前后，以及如果规则现在触发会做什么，每一次写入都要经过闸门的检查。此时还没有任何改变。
3. **升级**会放入的正是审阅过的内容。如果期间 Blueprint 又更新了，或者别人升级了这条规则，操作会被拒绝，您需要重新查看。放入的就是您审阅过的内容，否则什么也不放入。

升级会连同执行者一起记录：*自动化已从 Blueprint pump_watch 版本 1 升级到 2*。

如果规则创建之后有人手动编辑过，审阅会把这次编辑显示为将被替换。任何人的改动都不会在没有先出现在屏幕上的情况下消失。

## 它长什么样

```json
{
  "id": "pump_watch",
  "name": "Pump start watch",
  "description": "Says when a pump starts, with the limit it runs to.",
  "inputs": [
    {"name": "pump", "label": "Pump", "type": "entity", "domain": ["switch"], "required": true},
    {"name": "limit", "label": "Limit", "type": "number", "min": 0, "max": 100, "step": 5, "unit": "%", "required": true}
  ],
  "template": {
    "triggers": [{"type": "state", "entityId": {"!input": "pump"}, "to": "on"}],
    "condition": "float(states['sensor.tank_level']) < ${limit}",
    "actions": [
      {"type": "log_event", "params": {"message": "${pump} started, running to ${limit}%"}}
    ],
    "mode": "skip"
  }
}
```

- **`id`** 由小写字母、数字和下划线组成，以字母开头。
- **`inputs`** 是空白，带有类型。字段与 HotLoop 其他地方相同：带 `min`、`max`、`step` 和 `unit` 的 `number`，带 `max_length` 和 `pattern` 的 `text`，`boolean`，带 `options` 的 `select`，带可接受 `domain` 的 `entity`，`duration`（秒，或 `90s`、`1h30m`），`alarm` 和 `tag`。每个都可以是 `required`，也可以有 `default`。
- **`template`** 就是规则：`description`、`triggers`、`condition`、`actions`、`mode`、`minIntervalSec`、`maxRuntimeSec`，使用自动化语言（[自动化](/zh-hans/iot/automations/)）编写。不含它的 `id`、`name` 或 `enabled`。这些属于由它创建的每一条规则。

### 空白

作为值使用的 **`{"!input": "pump"}`** 会被替换为该输入的值，并保留其类型：entity_id 以字符串的形式进入 `entityId`，时长以数字的形式进入 `forSec`。没有人填写的可选输入为 `null`。

字符串中的 **`${pump}`** 同样会被替换，替换方式取决于它所在的位置：

- 在表达式中（规则的 `condition`、动作的 `expression`、`dataExpressions`、`argExpressions`、`fieldExpressions` 或 `paramExpressions` 中的值，以及消息里 `{{` 与 `}}` 之间的任何内容），它以**字面量**的形式进入。字符串带引号，数字就是数字，`true`、`false`、`nil`。所以上面的条件在限值为 40 时就是 `float(states['sensor.tank_level']) < 40`。
- 在其他任何地方它都是纯文本：`switch.pump_1 started, running to 40%`。

**`${counter.domain}`** 是实体输入的 domain，用于必须与所选实体种类匹配的服务名：`"${counter.domain}.reset"` 对 PLC 的计数器是 `counter.reset`，对计数器辅助项是 `input_counter.reset`。

这种加引号的处理，就是文本输入能安全用于表达式的全部原因。在文本输入里键入 `' || true || '`，条件就会与这串文字原样比较。它绝不会成为表达式的一部分。而且文本输入根本不能包含 `{{`：规则发送的每条消息，在发送时都会把 `{{` 与 `}}` 之间的内容当作表达式执行，而有人在表单里键入的值绝不允许变成表达式。

### 保存时检查

Blueprint 在存储之前就会被检查，而不是等有人试用时：

- 每个空白都指向一个输入，并且 `.domain` 只能跟在实体输入之后；
- 每个输入都在某处被用到。模板忽略的输入是一个什么都不做的表单字段，总会有人为它浪费一个下午；
- 用各输入类型的示例值填充后（有默认值的用默认值），模板生成的规则必须能编译。变成 URL 的文本输入需要一个说明这一点的 `pattern`，即 `https?://\S+`，否则 URL 检查会拒绝示例值。

## 填写

在 **Blueprints** 屏幕上，点击**使用**会打开表单：规则的 id 和名称，以及每个输入对应的合适控件，如带范围的数字、列表、实体选择器。然后：

- **先检查**会告诉您将生成什么规则，以及这条规则现在触发的话会做什么：求值后的条件、以 `automation:<id>` 的身份交给写入闸门自身检查的每一次写入和服务调用，以及用闸门自己的话给出的第一个拒绝原因。不会存储、写入或审计任何内容。
- **创建规则**会创建它，除非您取消勾选，否则会处于启用状态，并显示在自动化屏幕上，注明它的来源。

每个输入都会先经检查，且**绝不会被改动来迁就**。最大值为 100 的输入填 150 会被拒绝，而不是悄悄变成 100。数字填 `"12"` 会被拒绝，而不是被解析。所有错误的输入会一次全部报告，所以表单会带着完整的清单返回。规则自己拒绝的值（对最多一天的保持时间填两天）会用规则自己的话拒绝。在一切都正确之前，不会创建任何内容。

创建规则**绝不会替换已有的规则**。已被手写规则或 Blueprint 创建的规则占用的 id 会被拒绝。

通过 API 是 `POST /api/blueprints/{id}/instantiate`，检查时加 `?dry_run=true`。参见 [HTTP API](/zh-hans/iot/api/#蓝图)。

## 内置的 Blueprint

它们随二进制文件一起提供，只读；**复制**会以新 id 生成一份您自己的，从版本 1 开始，可随意修改。

| Blueprint | 输入 | 规则的作用 |
|---|---|---|
| `motor_running_too_long` | 一台电机，允许运行多久（默认一小时），是否停止它 | 当电机一次性 `running` 达到该时间时，记录一条警告。如有要求，用 `motor.stop` 停止它。 |
| `tank_high_level_stop_pump` | 一个液位传感器，限值，泵（一台电机） | 当液位达到或超过限值、读数质量良好且泵尚未停止时，停止该泵并记录。 |
| `alarm_to_notify` | 一个报警，要处理的状态（默认 `unack-active`），一个 webhook URL | 当报警进入该状态时，向该 URL 发送 POST `{"text": "Alarm temp-hi is unack-active"}`。 |
| `device_silent_cycle_its_port` | 一台设备的在线传感器，允许沉默多久（默认 5 分钟），UniFi 设备及端口电源重启变量，之后等待多久（默认 3 分钟），一个报警，两次运行之间的最短间隔（默认一小时） | 当设备关闭达到该时间时，通过写入闸门对其交换机端口断电再通电一次，等待它恢复，如果没有恢复，则触发报警。驱动程序会拒绝 15 分钟内对同一端口的第二次重启，并且从不重启承载网络的端口。 |
| `shift_schedule_counter_reset` | 一个计划辅助项，一个计数器（PLC 的或辅助项） | 当计划开启时，将计数器清零并记录。 |

关于它们的几点坦率说明：

- **`tank_high_level_stop_pump` 是一种便利，不是联锁。** 保护人员或工厂的跳闸应当放在 PLC 里，硬接线在该在的地方，而不是放在任何运行于网络上的东西里。它只是让人不必盯着液位。它不能取代高液位开关。
- 它不会依据无法信任的读数行动。质量差的液位不会停止任何东西，因为基于垃圾数字的停止仍然是一次停止。
- **`shift_schedule_counter_reset` 在计划开启时触发**，两个相接的计划块算作一段连续的开启。因此请为每个班次设置各自的块，中间让计划关闭，哪怕只关一分钟（06:00 到 13:59，14:00 到 21:59），否则这一连串里只有第一个班次会把计数器清零。
- **`alarm_to_notify`** 适用于聊天室或工单系统。若要呼叫手机，并带有频率限制、重试和确认链接，请使用 HotLoop 自己发送的通知（[报警通知](/zh-hans/iot/notifications/)）。

## 谁能做什么

| <span class="sr-only">详情</span> | 查看者 | 操作员 | 管理员 |
|---|---|---|---|
| 查看 Blueprint（`blueprints.read`） | 是 | 是 | 是 |
| 用某个 Blueprint 创建规则，升级规则（`blueprints.apply`） | 否 | 是 | 是 |
| 编写、编辑、复制、删除 Blueprint（`blueprints.write`） | 否 | 否 | 是 |

为什么操作员可以创建规则：Blueprint 是工程师决定规则做什么的地方，而选择它监视哪台泵，恰恰是操作员一整天都在做的判断。危险的部分，也就是规则控制什么，是在编写 Blueprint 时由持有 `blueprints.write` 的人决定的。之后删除或手动编辑规则仍然是 `automations.write`，属于管理员。

已有任何规则由其创建的 Blueprint 无法删除，系统会列出这些规则的名称。请先删除这些规则。内置 Blueprint 不能编辑或删除。

## 代理

代理会获得 `list_blueprints`、`preview_blueprint` 和 `instantiate_blueprint`（以及 `upgrade_blueprint_automation`、`create_blueprint`、`update_blueprint` 和 `delete_blueprint`）：它找到合适的 Blueprint，推算出各个输入，展示规则会做什么，并创建规则，走的是屏幕所用的同一条路径，使用相同的输入检查，并在事件日志中记下代理的名字。规则是每当触发器触发就对设备下发命令的长期指令，所以预览在先，规则之后做的每一次写入都要面对写入闸门。参见 [MCP](/zh-hans/iot/mcp/#蓝图)。

## 一切存放在哪里

- 工厂编写的 **Blueprint** 在 `blueprints` 表中。内置的在二进制文件里，从不存储。
- **由 Blueprint 创建的规则**与其他规则一样，是 `automations` 中的一行，用 `blueprint_id`、`blueprint_version` 和 `blueprint_inputs` 说明来源。`GET /api/automations` 将它们返回为 `blueprintId`、`blueprintVersion` 和 `blueprintInputs`。
- **每一次变更**都记录在系统日志和事件日志中，并注明执行者：*Blueprint 已创建*、*Blueprint 已保存，现为版本 2*、*自动化已由 Blueprint motor_running_too_long 版本 1 创建*、*自动化已从 Blueprint pump_watch 版本 1 升级到 2*、*Blueprint 已删除*。
- **备份**同时包含 Blueprint 和每条规则所固定的版本，因此恢复后的工厂提供的升级与之前完全一致。Blueprint 出现之前的备份会把每条规则恢复为手写规则。
- 其 Blueprint 已不存在的规则（例如后来的版本去掉了的某个内置 Blueprint）会照原样继续运行。只是没有可以升级到的目标了。
