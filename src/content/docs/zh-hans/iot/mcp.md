---
title: "面向代理的 MCP"
description: "让代理读取整个工厂，只触碰你已启用的内容，经由写入关口，并在每次写入旁记录所述原因。"
---

网关双向使用 MCP：代理可以读取并驱动工厂，自动化规则也可以调用别处的工具。

设计规则是：**代理和其他任何调用方一样，只是一个调用方**。工具通过界面读取所用的同一份缓存来读，通过界面写入所用的同一个关口来写。没有特权路径，没有绕过，也没有单独的策略。操作员会被拒绝的写入会被拒绝；成功的写入会落入同一张审计表，操作者前面带 `mcp:`。

## 提供方式

### 通过 HTTP

默认在应用端口的 `/mcp` 上启用，由图表在发布的 Secret 中生成的 Bearer 令牌保护。

```bash
kubectl -n hotloop get secret <release> \
  -o jsonpath='{.data.mcp-token}' | base64 -d
```

在集群内，端点是：

```
http://<release>.<namespace>.svc.cluster.local:8080/mcp
```

令牌检查位于处理程序之前，所以未认证的调用方甚至无法枚举有什么。把 `mcp.token` 留空，图表会生成一个，所以默认部署不会无意中成为开放的那一个。请与 NetworkPolicy 配合使用；令牌是第二道防线，不是唯一一道。

端点从不开放。不设置 `HOTLOOP_MCP_TOKEN` 运行二进制文件（Quadlet 单元、裸 `hotloop`），它会在首次启动时生成一个令牌并保存在自己的数据库中，所以重启后、在每个副本上、恢复之后都会回到同一个。`hotloop mcp-token` 会打印它（日志只说它生成了一个，绝不说它是什么）。设置 `HOTLOOP_MCP_TOKEN` 可以自己选择；设置了 `HOTLOOP_MCP_OIDC_*` 后，端点接受登录，自己不保存令牌。以前什么都不带就连接裸二进制文件的客户端，现在会得到 `401`，直到它发送 `Authorization: Bearer <that token>`。

### 使用 Vord 登录或枢纽断言

静态令牌能说明是哪个客户端调用的，却说明不了是哪个人。设置 OIDC 后，`/mcp` 也接受 `Authorization: Bearer <jwt>`，经过验证的人的邮箱成为审计操作者：写入会记为 `mcp:pat@example.com`，而不是 `mcp:<client name>`。未设置时行为不变，静态令牌继续在它旁边工作（没有设置静态令牌时，只有经过验证的 JWT 才能进入）。

| 变量 | 图表值 | 作用 |
|---|---|---|
| `HOTLOOP_MCP_OIDC_ISSUER` | `mcp.oidc.issuer` | Vord realm 的 URL；接受它的访问令牌 |
| `HOTLOOP_MCP_OIDC_AUDIENCE` | `mcp.oidc.audience` | 每个令牌必须携带的 `aud`；使用这两者中任意一个时必填 |
| `HOTLOOP_MCP_OIDC_HUB_JWKS_URL` | `mcp.oidc.hubJwksUrl` | 身份枢纽的断言密钥；接受它的断言 |
| `HOTLOOP_MCP_OIDC_REQUIRED_ROLE` | `mcp.oidc.requiredRole` | 调用方必须持有的 realm 角色 |
| `HOTLOOP_MCP_OIDC_WRITE_ROLE` | `mcp.oidc.writeRole` | 按调用方限制写入，见下文 |

Vord 访问令牌会对照签发方的 JWKS 检查（通过它的发现文档找到，缓存十分钟，遇到未知 `kid` 时重新获取）：只接受 RS256 或 ES256，`iss` 等于签发方，`aud` 包含受众，`exp` 和 `nbf` 允许 30 s 偏差，并带有 `email`（或 `preferred_username`）声明。Vord 默认只把 `account` 放进 `aud`；请为你设置的受众给客户端作用域加一个受众映射器。

枢纽断言是 `typ` 为 `fb-assert+jwt`，EdDSA，`iss` 为 `fireball-hub`，`aud` 为配置的受众（Hub 模块发送 `hotloop`），未过期，并由 Hub 的 JWKS 中的某个密钥签名。没有 `jti` 重放缓存：一次工具调用是几个携带同一断言的 HTTP 请求（initialize，然后是调用），断言存活 60 s。当 Hub 说这次调用是替别人执行的（`acting_as`）时，操作者显示为 `mcp:<email> for <acting_as email>`。

写入仍然需要 `HOTLOOP_ALLOW_WRITES`，即总开关；令牌绝不会扩大它。`HOTLOOP_MCP_OIDC_WRITE_ROLE` 按调用方收窄写入：`hotloop:hotloop.write` 表示客户端 `hotloop` 上的 Vord 客户端角色 `hotloop.write`（`resource_access.hotloop.roles`），单独的名字表示 realm 角色，Hub 断言必须在 `abilities` 中带有该角色的名字。没有它的调用方可以读取，但 `write_tag`、`call_service`、`run_script`、`apply_recipe`、`trigger_automation` 以及每一个更改配置的工具都会拒绝。静态令牌不受它限制。

### 通过 stdio

同一个二进制文件用 `--mcp-stdio` 在 stdin 和 stdout 上提供 MCP，供直接启动它的客户端使用。其他一切也会启动，所以代理看到的是一个运转中的工厂，而不是一个空壳服务器。

```json
{
  "mcpServers": {
    "hotloop": {
      "command": "/usr/local/bin/hotloop",
      "args": ["--mcp-stdio"],
      "env": {
        "HOTLOOP_DB_HOST": "timescale.plant.local",
        "HOTLOOP_DB_PASSWORD": "…"
      }
    }
  }
}
```

在 stdio 模式下，所有日志都输出到 stderr。写入 stdout 的任何内容都会破坏协议流。

## 工具

共一百七十一个：二十七个读取并命令工厂，六十九个更改它的配置（[见下文](#更改配置)），三十三个与之配套的读取和试运行（[见下文](#读取与试运行)），以及四十二个用于管理（[见下文](#管理)）。

| 工具 | 作用 |
|---|---|
| `get_plant_status` | 在线设备、未处理的报警、写入是否启用 |
| `list_devices` | 每台设备及其协议、地址、状态、变量数量 |
| `describe_device` | 一台设备的详情，包含它的变量和轮询统计 |
| `list_tags` | 按设备、名称或描述搜索目录 |
| `read_tag` | 当前值，带质量 |
| `query_history` | 历史读数，原始的或按时间桶汇总的 |
| `write_tag` | **命令一个变量** |
| `list_alarms` | 报警及其 ISA-18.2 状态 |
| `ack_alarm` | 代表操作员确认 |
| `list_automations` | 规则、运行次数、上次结果 |
| `trigger_automation` | 立即运行一条规则 |
| `describe_protocol` | 此版本实际使用的协议 |
| `recent_events` | 系统日志，用来弄清什么按什么顺序发生 |
| `list_entities` | 按域、设备节点或标签查找实体，并显示每个实体接受的服务 |
| `get_states` | 一个或多个实体的当前状态，带质量和属性 |
| `call_service` | **命令一个实体**：`switch.turn_on`、`number.set_value` |
| `get_logbook` | 一条时间线，涵盖状态变化、写入、报警、运行和配置变更，可按实体、设备节点、操作者或类型筛选 |
| `list_scripts` | 工厂的脚本、每个脚本接受的字段、是否在运行、上次运行 |
| `run_script` | **运行一个脚本**，或用 `dryRun` 询问它现在会做什么 |
| `list_recipes` | 工厂的配方：按顺序的目标、参数、前置条件、版本、上次应用 |
| `validate_recipe` | 配方现在能应用吗？它会被拒绝的每一个原因；不写入任何东西 |
| `apply_recipe` | **应用一个配方**：整体检查，按顺序写入，读回 |
| `list_blueprints` | 人们填写以创建规则的蓝图，它们的输入和版本 |
| `preview_blueprint` | 给定输入时蓝图会创建的规则，以及它现在会做什么；不创建任何东西 |
| `find_network_client` | 设备在工厂网络上的位置：它的交换机端口、端口是否有链路、UniFi 控制台上次看到它的时间 |
| `get_network_topology` | UniFi 控制台绘制的工厂网络：什么接在什么上、每台设备的状态，以及一旦它宕机就会失去网络的 HotLoop 设备 |
| `get_network_events` | UniFi 控制台报告的最新事件，以及它的事件 websocket 是否在线 |

### 实体

实体是人们对工厂中某样东西的称呼，比如 `sensor.zone_1_temperature` 或 `switch.conveyor_run`，它包着一个或多个变量。见[实体](/zh-hans/iot/entities/)。对代理来说，它们通常是更好的抓手：名字有意义，而且实体知道能对它做什么。

`list_entities` 可按 `domain`、`equipment`（设备树的一个节点，用 id、名称或名称路径如 `Plant A/Packing`，匹配它及其下的一切，实体自己的位置优先于它所属设备的位置）、`label`（label_id 或名称；实体带有该标签或其设备带有该标签时匹配）以及 `query`（entity_id 或名称的子串）过滤。每个结果都带有它的当前状态和质量，以及它接受的服务，形式为 `domain.service`。没有服务的实体是只读的。服务来自实体层，所以某个域在那里新增一个服务，在这里不用改动就会出现。

`get_states` 接受 `entity_ids`，对每一个回答它的状态、质量、属性和 `last_changed`。它与 `read_tag` 守同一条线：`unknown` 或 `unavailable` 状态会得到一条说明它不是值的注释，被禁用的实体会说它被禁用而不是缺失，不良质量会被明确写出。

`call_service` 接受 `domain`、`service`、`entity_id`、`data` 和**必填的** `reason`：

```
> call_service domain=number service=set_value entity_id=number.press_01_sp
    data={"value": 212.5} reason="operator asked for 212.5 on zone 1"
Called number.set_value on number.press_01_sp (was 210). Writes: 212.5 to press-01/Setpoint: written
```

它经过 `entity.Services`，也就是 `POST /api/services/...` 使用的同一个执行器，把调用变成经过写入关口的写入。见[写入](#写入)。

### 网络

`find_network_client` 回答关于一台沉默的 PLC 的第一个问题：是 PLC 出了问题，还是它的交换机端口？给它 `deviceId`，它会沿着该设备已确认的链路找到它的 UniFi 客户端；给它 `query`（MAC、IP 或名称的一部分），它会搜索 HotLoop 读取的每个控制台。它读取 UniFi 驱动上次的读数，从不读取控制台，所以代理循环询问不会给控制台带来任何开销。这也意味着 `--mcp-stdio` 辅助进程会回答说它的进程里没有读取任何控制台：它从不登录任何一个，因为旁边的 Gateway 已经持有会话。请询问 Gateway 的端点。见 [UniFi Network](/zh-hans/iot/unifi/)。

`get_network_topology` 是地图：每台交换机、接入点和网关都列在它所接入的设备之下，带有两端的端口、链路、其上有多少客户端，以及链接到下面某个客户端的 HotLoop 设备。最后这一部分就是影响范围：它点出那台交换机一旦宕机就会失去网络的 PLC。控制台列为没有接入任何设备的交换机会这样说，并且不会被挂到网关上。`get_network_events` 是控制台的最新事件，最新的在前，带有它自己的一句话、控制台称之为负面时的警告标志，以及事件 websocket 是否在线。两者都接受控制台的 `deviceId`，当 HotLoop 只读取一个时可以省略，两者都像 `find_network_client` 一样读取驱动上次的读数，所以不给控制台带来开销，并且在 `--mcp-stdio` 辅助进程里说同样的话：那个进程里没有读取任何控制台。更早的事件在 `get_logbook` 中，归在它们所涉及的交换机或接入点之下。

### 日志簿

`get_logbook` 是 `GET /api/logbook` 提供的时间线（见[日志簿](/zh-hans/iot/logbook/)）：状态变化、写入、报警转换、自动化运行和配置变更，最新的在前。可以按 `entity`、`equipment`（id、名称或路径，以及其下的一切；匹配两个节点的名称会产生一个列出两者的错误）、`actor`（其中一部分：`mcp:` 能找到任何代理做过的一切）、`kinds` 以及向前回溯的 `minutes`（默认一天）来缩小范围。后面还有更多内容的一页，会在末尾说明下一页该传什么作为 `before`。对于“出问题之前发生了什么”，它是更好的 `recent_events`：设备自己的状态变化在里面，写入关口的行不会重复出现两次。

### 脚本

脚本是某人一次写好的有名字的步骤序列，比如 CIP 循环或产线吹扫，这样代理运行的是工厂自己的流程，而不是自己编一个。见[脚本](/zh-hans/iot/scripts/)。`list_scripts` 说明每个脚本接受什么。`run_script` 接受 `scriptId`、`fields`、**必填的** `reason`，以及两个开关：

- `dryRun: true` 对照工厂当前的样子走一遍脚本，逐步说明会写入什么，以及关口最先会拒绝的是什么，用的是关口自己的话。不会写入也不会审计任何东西。请先问这个。
- `wait: true` 在运行结束后回答，带有结果和轨迹。没有它时，答案是运行 id，而 `list_scripts` 或带 `kinds: ["script"]` 的 `get_logbook` 会说明它如何结束。

这次运行属于脚本，以 `script:<id>` 表示，来源为 `mcp`，所以它做的每一次写入都像 `write_tag` 一样遇到关口。写入被关闭时（`HOTLOOP_ALLOW_WRITES`），`run_script` 会在任何东西运行之前拒绝，就像 `trigger_automation` 那样；试运行仍然会得到回答，并说明原因是这个开关。

### 配方

配方是工厂一起应用的一组设定值，比如一个产品等级或一次换产，这样代理加载的是工厂自己的数字，而不是逐个写入。见[配方](/zh-hans/iot/recipes/)。`list_recipes` 按顺序显示每个配方的目标和它接受的参数。`validate_recipe` 询问某个配方现在能否应用，并给出它不能的每一个原因，不写入任何东西。`apply_recipe` 接受 `recipeId`、`params`、可选的 `version` 和**必填的** `reason`。

它先被整体检查，如果有任何值会被拒绝，就整体拒绝，不写入任何东西；超出范围的值会被拒绝，绝不调整。然后各目标在同一个调用 id 下按顺序发出，第一个失败的会停止其余的，并且不撤销任何东西。答案逐个目标说明发出了什么，以及设备是否读回了该值。写入属于代理，来源为 `mcp`，所以关口对每一次都适用；写入被关闭时（`HOTLOOP_ALLOW_WRITES`），`apply_recipe` 会在检查任何东西之前拒绝。指明了自己应用权限的配方是给被授予该权限的人用的，代理不在其中。

### 蓝图

蓝图是只写一次、带有类型化空白的规则：哪台电机、多长时间、什么限值。见[蓝图](/zh-hans/iot/blueprints/)。`list_blueprints` 说明每个蓝图接受什么。`preview_blueprint` 接受 `blueprintId`、`automationId` 和 `inputs`，回答它会创建的规则，以及该规则如果现在触发会做什么，每一次写入都要经过关口的检查。输入的检查与界面完全一致：超出范围会被拒绝，不会被调整。

`instantiate_blueprint` 通过蓝图界面所用的路径创建规则：同样的检查，规则会落入日志簿，创建者是该代理。规则是一条常驻指令，每次触发器触发都要命令设备，所以代理要先看：`preview_blueprint` 不存储任何东西，也不写入任何东西，无论写入是否开启都会得到回答。所创建的规则随后做的每一次写入都会遇到写入关口，就像人创建的规则一样。见[更改配置](#更改配置)。

## 更改配置

代理能读取的一切，它都能更改。上面读取工厂的工具都有对应的更改它的工具，共六十九个，而且没有一个是第二套实现：每一个都是 REST API 的一个路由，调用会经过该路由自己的处理程序运行。验证、权限检查、运行时重载和审计行都属于路由，操作者是代理（`mcp:<client>`，使用 Vord 登录时为 `mcp:<email>`），所以没有驱动的设备、无法编译的规则、超出范围的蓝图输入，或者已发现设备尚未被接受的变量，都会用界面显示的话被拒绝，并且什么都没有被更改。

每一个按名称接受路由的路径值（`id`、`device`、`name`...）、`body`（API 接受的同样的 JSON，[HTTP API](/zh-hans/iot/api/) 列出了每个 body）以及**必填的** `reason`。原因会作为一行 `config` 记录在系统日志中，紧挨着路由自己的那一行，针对被更改的对象。

```
> save_tag reason="the setpoint, writable between 0 and 100" body={"deviceId":"press-01",
    "name":"Setpoint","address":"holding:5:uint16","dataType":"int16","enabled":true,
    "writable":true,"hasRange":true,"minValue":0,"maxValue":100}
save_tag done.
{ ...the tag as stored... }
```

它们前面站着的，就是 `write_tag` 前面站着的，只是少了总开关，因为界面更改配置也不需要它：

1. `HOTLOOP_ALLOW_MCP_WRITES`，默认开启，必须开启。
2. 设置了 `HOTLOOP_MCP_OIDC_WRITE_ROLE` 的调用方必须持有它。
3. 调用带有一个权限，即它的路由所要求的权限（下表第三列），不多也不少。路由回答代理的方式，与回答没有该权限的人的方式一样，并且有一个测试把表中的每一行都对应到一个真实路由及该路由所要求的权限。
4. 一个原因。

命令设备仍然是 `write_tag`、`call_service`、`run_script`、`apply_recipe` 和 `trigger_automation`，需要 `HOTLOOP_ALLOW_WRITES` 开启，并满足变量的可写标记和范围。把变量、规则、脚本或配方设为可写是配置：在被使用之前它不命令任何东西，而它那时所命令的内容要经过关口。

管理员自己的功能也是工具，见下面的[管理](#管理)。接受已发现的设备在这里，和在界面上一样；其上的点仍然必须逐个启用才能写入。

这些工具在 `--mcp-stdio` 中同样存在：该进程构建同一个 API 服务器，并且从不打开它的端口。

**设备和变量**

| 工具 | 路由 | 权限 |
|---|---|---|
| `save_device` | `POST /api/devices` | `devices.write` |
| `delete_device` | `DELETE /api/devices/{id}` | `devices.write` |
| `set_device_enabled` | `POST /api/devices/{id}/enabled` | `devices.write` |
| `import_device_tags` | `POST /api/devices/{id}/import` | `tags.write` |
| `save_tag` | `POST /api/tags` | `tags.write` |
| `delete_tag` | `DELETE /api/tags/{device}/{name}` | `tags.write` |
| `set_device_labels` | `PUT /api/devices/{id}/labels` | `equipment.write` |
| `set_device_network` | `PUT /api/devices/{id}/network` | `devices.write` |
| `clear_device_network` | `DELETE /api/devices/{id}/network` | `devices.write` |

**发现与代理**

| 工具 | 路由 | 权限 |
|---|---|---|
| `accept_discovered_device` | `POST /api/discovery/{source}/{key}/accept` | `devices.write` |
| `ignore_discovered_device` | `POST /api/discovery/{source}/{key}/ignore` | `devices.write` |
| `unignore_discovered_device` | `POST /api/discovery/{source}/{key}/unignore` | `devices.write` |
| `apply_discovery_review` | `POST /api/discovery/{source}/{key}/review/apply` | `devices.write` |
| `reject_discovery_review` | `POST /api/discovery/{source}/{key}/review/reject` | `devices.write` |
| `accept_network_find` | `POST /api/network-discovery/{key}/accept` | `devices.write` |
| `ignore_network_find` | `POST /api/network-discovery/{key}/ignore` | `devices.write` |
| `unignore_network_find` | `POST /api/network-discovery/{key}/unignore` | `devices.write` |
| `probe_network` | `POST /api/network-discovery/probe` | `devices.write` |
| `create_mqtt_broker` | `POST /api/mqtt/brokers` | `devices.write` |
| `update_mqtt_broker` | `PUT /api/mqtt/brokers/{id}` | `devices.write` |
| `delete_mqtt_broker` | `DELETE /api/mqtt/brokers/{id}` | `devices.write` |
| `probe_integration` | `POST /api/integrations/{id}/probe` | `devices.write` |
| `setup_integration` | `POST /api/integrations/{id}/setup` | `devices.write` |

**UniFi**

| 工具 | 路由 | 权限 |
|---|---|---|
| `mark_unifi_network_ot` | `PUT /api/unifi/{id}/networks/{network}` | `devices.write` |
| `accept_unifi_known_device` | `PUT /api/unifi/{id}/networks/{network}/known/{mac}` | `devices.write` |
| `forget_unifi_known_device` | `DELETE /api/unifi/{id}/networks/{network}/known/{mac}` | `devices.write` |
| `accept_all_unifi_known_devices` | `POST /api/unifi/{id}/networks/{network}/accept-all` | `devices.write` |
| `create_unifi_starter_alarms` | `POST /api/unifi/{id}/starter-alarms` | `alarms.write` |

**实体、辅助项、设备、标签**

| 工具 | 路由 | 权限 |
|---|---|---|
| `create_entity` | `POST /api/entities` | `entities.write` |
| `update_entity` | `PUT /api/entities/{entity_id}` | `entities.write` |
| `delete_entity` | `DELETE /api/entities/{entity_id}` | `entities.write` |
| `create_energy_meter` | `POST /api/energy/meters` | `energy.write` |
| `update_energy_meter` | `PUT /api/energy/meters/{id}` | `energy.write` |
| `delete_energy_meter` | `DELETE /api/energy/meters/{id}` | `energy.write` |
| `create_helper` | `POST /api/helpers` | `entities.write` |
| `update_helper` | `PUT /api/helpers/{entity_id}` | `entities.write` |
| `delete_helper` | `DELETE /api/helpers/{entity_id}` | `entities.write` |
| `create_equipment` | `POST /api/equipment` | `equipment.write` |
| `update_equipment` | `PUT /api/equipment/{id}` | `equipment.write` |
| `delete_equipment` | `DELETE /api/equipment/{id}` | `equipment.write` |
| `create_label` | `POST /api/labels` | `equipment.write` |
| `update_label` | `PUT /api/labels/{label_id}` | `equipment.write` |
| `delete_label` | `DELETE /api/labels/{label_id}` | `equipment.write` |

**报警**

| 工具 | 路由 | 权限 |
|---|---|---|
| `save_alarm` | `POST /api/alarms` | `alarms.write` |
| `delete_alarm` | `DELETE /api/alarms/{id}` | `alarms.write` |
| `shelve_alarm` | `POST /api/alarms/{id}/shelve` | `alarms.ack` |
| `unshelve_alarm` | `POST /api/alarms/{id}/unshelve` | `alarms.ack` |

**自动化与蓝图**

| 工具 | 路由 | 权限 |
|---|---|---|
| `save_automation` | `POST /api/automations` | `automations.write` |
| `delete_automation` | `DELETE /api/automations/{id}` | `automations.write` |
| `set_automation_enabled` | `POST /api/automations/{id}/enabled` | `automations.write` |
| `upgrade_blueprint_automation` | `POST /api/automations/{id}/blueprint-upgrade` | `blueprints.apply` |
| `instantiate_blueprint` | `POST /api/blueprints/{id}/instantiate` | `blueprints.apply` |
| `create_blueprint` | `POST /api/blueprints` | `blueprints.write` |
| `update_blueprint` | `PUT /api/blueprints/{id}` | `blueprints.write` |
| `delete_blueprint` | `DELETE /api/blueprints/{id}` | `blueprints.write` |

**脚本与配方**

| 工具 | 路由 | 权限 |
|---|---|---|
| `create_script` | `POST /api/scripts` | `scripts.write` |
| `update_script` | `PUT /api/scripts/{id}` | `scripts.write` |
| `delete_script` | `DELETE /api/scripts/{id}` | `scripts.write` |
| `stop_script` | `POST /api/scripts/{id}/stop` | `scripts.run` |
| `create_recipe` | `POST /api/recipes` | `recipes.write` |
| `capture_recipe` | `POST /api/recipes/capture` | `recipes.write` |
| `update_recipe` | `PUT /api/recipes/{id}` | `recipes.write` |
| `delete_recipe` | `DELETE /api/recipes/{id}` | `recipes.write` |

**仪表板与看板**

| 工具 | 路由 | 权限 |
|---|---|---|
| `create_dashboard` | `POST /api/dashboards` | `dashboards.write` |
| `update_dashboard` | `PUT /api/dashboards/{id}` | `dashboards.write` |
| `delete_dashboard` | `DELETE /api/dashboards/{id}` | `dashboards.write` |
| `save_board` | `PUT /api/board` | `board.write` |

**导入**

| 工具 | 路由 | 权限 |
|---|---|---|
| `import_codesys_alarms` | `POST /api/alarms/import/codesys` | `alarms.write` |
| `screen_import` | `POST /api/dashboards/import` | `dashboards.write` |

`import_codesys_alarms` 接受 CODESYS IDE 的 Export Alarms 写出的文件，形式为 `contentBase64`（磁盘上的原样字节，IDE 以 UTF-16 写出）或 `content`（如果你有文本形式的话），以及这些报警所属的 `deviceId`，如果需要，还有 `application` 和 `defaultPriority`。放着不管时它只做预览：说明哪些报警会被导入、哪些不会，不保存任何东西，也不需要原因。`apply` 为 true 时，它把这些报警保存为报警定义，此时它需要原因和 MCP 写入开关，就像每个更改配置的工具一样。

`screen_export` 把仪表板作为 HotLoop 画面文件回答（[画面文件](/zh-hans/iot/screen-file/)），`screen_import` 在本次安装或另一次安装上接收一个。它先询问：`dryRun` 为 true，除非你说 false，试运行不保存任何东西，并以列出每个问题的报告和用于 `remap` 的引用来回答。真正的导入需要 `dryRun` 为 false、一个原因和 MCP 写入开关，已存在的 id 会被拒绝，除非 `replace` 为 true。画面是客户的数据，所以文件就是它在各次安装之间迁移的方式，绝不是代码。

### 读取与试运行

能够更改仪表板、代理或设备树节点的代理，必须先能读取那里有什么，所以上面某个工具更改的每种对象在这里都有一个读取，编辑器的试运行也是工具。每一个都是一个经过自己处理程序运行的路由，使用该路由所要求的读取权限。读取回答时不需要原因，也不需要写入开关，被写入角色排除在外的调用方仍然可以进行，因为它们只带有读取权限，别无其他。三个试运行（`validate_automation`、`validate_script` 和 `browse_device`）不改变任何东西；检查请求体的那两个带有它们的路由所要求的写入权限，所以仍处于写入角色之后。

| 工具 | 路由 | 权限 |
|---|---|---|
| `list_alarm_definitions` | `GET /api/alarms` | `alarms.read` |
| `list_composite_entities` | `GET /api/entities/composites` | `entities.read` |
| `list_energy_meters` | `GET /api/energy/meters` | `energy.read` |
| `get_energy_meter` | `GET /api/energy/meters/{id}` | `energy.read` |
| `get_energy_summary` | `GET /api/energy/summary/{period}` | `energy.read` |
| `get_energy_series` | `GET /api/energy/series/{meter}/{period}/{step}` | `energy.read` |
| `list_alarm_events` | `GET /api/alarms/events` | `alarms.read` |
| `screen_export` | `GET /api/dashboards/{id}/export` | `dashboards.read` |
| `list_dashboards` | `GET /api/dashboards` | `dashboards.read` |
| `get_dashboard` | `GET /api/dashboards/{id}` | `dashboards.read` |
| `get_board` | `GET /api/board` | `values.read` |
| `list_equipment` | `GET /api/equipment` | `equipment.read` |
| `get_equipment` | `GET /api/equipment/{id}` | `equipment.read` |
| `list_labels` | `GET /api/labels` | `equipment.read` |
| `get_label` | `GET /api/labels/{label_id}` | `equipment.read` |
| `list_discovered_devices` | `GET /api/discovery` | `devices.read` |
| `get_discovered_device` | `GET /api/discovery/{source}/{key}` | `devices.read` |
| `list_network_finds` | `GET /api/network-discovery` | `devices.read` |
| `get_network_find` | `GET /api/network-discovery/{key}` | `devices.read` |
| `list_integrations` | `GET /api/integrations` | `devices.read` |
| `list_mqtt_brokers` | `GET /api/mqtt/brokers` | `devices.read` |
| `get_blueprint` | `GET /api/blueprints/{id}` | `blueprints.read` |
| `get_script` | `GET /api/scripts/{id}` | `scripts.read` |
| `list_automation_runs` | `GET /api/runs` | `automations.read` |
| `list_script_runs` | `GET /api/scripts/{id}/runs` | `scripts.read` |
| `list_unifi_consoles` | `GET /api/unifi/consoles` | `devices.read` |
| `list_unifi_networks` | `GET /api/unifi/{id}/networks` | `devices.read` |
| `list_unifi_known_devices` | `GET /api/unifi/{id}/known` | `devices.read` |
| `get_device_network` | `GET /api/devices/{id}/network` | `devices.read` |
| `get_diagnostics` | `GET /api/diagnostics` | `status.read` |
| `browse_device` | `POST /api/devices/{id}/browse` | `devices.read` |
| `validate_automation` | `POST /api/automations/validate` | `automations.write` |
| `validate_script` | `POST /api/scripts/validate` | `scripts.write` |

### 管理

用户账号、设置、备份、升级策略、历史库目标、代理登录、edge relay 机群和计划报表属于管理员，它们同样是工具：共四十二个，模式与其余的相同。每一个都是一个经过自己处理程序运行的路由，使用该路由所要求的权限（`users.manage`、`settings.write`、`backup.run`、`fleet.restart`...），每次更改都有原因，审计行里有该代理。拒绝的路由用同样的话拒绝代理。读取（`list_` 和 `get_` 工具）不需要原因和写入开关，在设置了调用方的写入角色时仍然需要它，因为它们所带的权限是管理员的。机群和报表工具只存在于具有该功能的产品中。

有两件事是路由自己的，在依赖某个工具之前值得了解：

- **写入开关没有路由。** `safety.allowWrites` 和 `safety.allowMcpWrites` 属于部署（`HOTLOOP_ALLOW_WRITES`、`HOTLOOP_ALLOW_MCP_WRITES`），`PUT /api/settings` 以由部署设置为由拒绝它们。所以 `save_settings` 更改设置画面能更改的内容，对于这些开关，则用那些话回答这个拒绝。代理无法打开它自己的写入所等待的那个开关。
- **用户的密码经过调用传递。** `create_user`、`reset_user_password` 和 PIN 工具在参数里接受一个密钥，和 API 一样。审计行会写明变更和原因，绝不写密钥。

**用户账号**

| 工具 | 路由 | 权限 |
|---|---|---|
| `list_users` | `GET /api/users` | `users.manage` |
| `create_user` | `POST /api/users` | `users.manage` |
| `update_user` | `PUT /api/users/{username}` | `users.manage` |
| `delete_user` | `DELETE /api/users/{username}` | `users.manage` |
| `reset_user_password` | `POST /api/users/{username}/password` | `users.manage` |
| `unlock_user` | `DELETE /api/users/{username}/lockout` | `users.manage` |
| `set_user_pin` | `PUT /api/users/{username}/pin` | `users.manage` |
| `clear_user_pin` | `DELETE /api/users/{username}/pin` | `users.manage` |
| `list_opcua_certificates` | `GET /api/opcua/certificates` | `users.manage` |
| `list_user_certificates` | `GET /api/users/{username}/certificates` | `users.manage` |
| `add_user_certificate` | `POST /api/users/{username}/certificates` | `users.manage` |
| `revoke_user_certificate` | `POST /api/users/{username}/certificates/{thumbprint}/revoke` | `users.manage` |
| `delete_user_certificate` | `DELETE /api/users/{username}/certificates/{thumbprint}` | `users.manage` |

**设置、备份、通知**

| 工具 | 路由 | 权限 |
|---|---|---|
| `get_settings` | `GET /api/settings` | `settings.read` |
| `save_settings` | `PUT /api/settings` | `settings.write` |
| `list_backups` | `GET /api/backup` | `backup.read` |
| `run_backup` | `POST /api/backup` | `backup.run` |
| `get_escalation` | `GET /api/notify/escalation` | `notify.escalation` |
| `save_escalation` | `PUT /api/notify/escalation` | `notify.escalation` |
| `send_test_notification` | `POST /api/notify/test` | `notify.test` |

**历史库目标与代理登录**

| 工具 | 路由 | 权限 |
|---|---|---|
| `list_historian_targets` | `GET /api/historian/targets` | `settings.read` |
| `create_historian_target` | `POST /api/historian/targets` | `settings.write` |
| `update_historian_target` | `PUT /api/historian/targets/{id}` | `settings.write` |
| `delete_historian_target` | `DELETE /api/historian/targets/{id}` | `settings.write` |
| `list_broker_logins` | `GET /api/broker/logins` | `users.manage` |
| `create_broker_login` | `POST /api/broker/logins` | `users.manage` |
| `update_broker_login` | `PUT /api/broker/logins/{name}` | `users.manage` |
| `delete_broker_login` | `DELETE /api/broker/logins/{name}` | `users.manage` |

**edge relay 机群（Gateway）**

| 工具 | 路由 | 权限 |
|---|---|---|
| `list_fleet` | `GET /api/fleet` | `fleet.read` |
| `register_relay` | `POST /api/fleet` | `fleet.write` |
| `delete_relay` | `DELETE /api/fleet/{id}` | `fleet.write` |
| `rebirth_relay` | `POST /api/fleet/{id}/rebirth` | `fleet.rebirth` |
| `restart_relay` | `POST /api/fleet/{id}/restart` | `fleet.restart` |
| `update_relay` | `POST /api/fleet/{id}/update` | `fleet.update` |
| `set_relay_config` | `POST /api/fleet/{id}/config` | `fleet.config` |
| `clear_relay_config` | `DELETE /api/fleet/{id}/config` | `fleet.config` |

**计划报表（Gateway）**

| 工具 | 路由 | 权限 |
|---|---|---|
| `list_reports` | `GET /api/reports` | `reports.read` |
| `get_report` | `GET /api/reports/{id}` | `reports.read` |
| `create_report` | `POST /api/reports` | `reports.write` |
| `update_report` | `PUT /api/reports/{id}` | `reports.write` |
| `delete_report` | `DELETE /api/reports/{id}` | `reports.write` |
| `run_report` | `POST /api/reports/{id}/run` | `reports.run` |

## 资源

| URI | 内容 |
|---|---|
| `iiot://devices` | 带变量的设备树，JSON 格式 |
| `iiot://tags` | 带当前值的变量目录 |
| `iiot://alarms` | 报警定义、实时状态和状态参考 |
| `iiot://protocols` | 受支持的协议，来自编译进去的驱动 |

资源的存在，是为了让客户端一次读取就能拉取整个命名空间，而不是一次工具调用一次地去发现它。

## 工具不会做什么

工具的编写方式，使得模型不会无意中把不确定性四舍五入。

**没有读数的变量不是读数为零的变量。** `read_tag` 说 `no reading has been taken for this tag yet`，如果它不存在则说 `this tag is not configured`。两者都不返回值。

**不良质量是明确说出来的，而不是暗示。** 读数以 `[quality: bad (the value is NOT known; do not treat it as a measurement)]` 的形式返回。服务器指令会重复这一点。不要对不良读数求平均，也不要把其中一个当作测量值报告。

**`describe_protocol` 不会说谎。** 可用性来自编译进二进制文件的驱动，所以这个工具不可能声称网关没有的协议。

**拒绝是一种回答，不是传输故障。** 被拒绝的写入作为带 `isError` 的工具结果返回，意思是调用格式正确，并被有意拒绝。这不是需要重试的协议错误。

## 写入

MCP 既读又写：它命令设备，也更改配置（[见上](#更改配置)）。`write_tag` 会移动真实的设备，所以工具调用和机器之间所隔的东西，与操作员的点击和机器之间所隔的一样：

1. `HOTLOOP_ALLOW_WRITES`，整个部署的总开关，必须开启。它关闭时什么都不能写：界面不行，API 不行，代理也不行。
2. 变量必须被标记为可写。变量是只读的，直到有人另行说明，逐个设置。
3. 值必须在变量配置的范围内。它会被**拒绝，而不是被截断**：有人要求 500 却发送 400，就是悄悄做了与所要求的不同的事。

**原因是必填的**，并记录在写入旁边。六个月后没人能解读的审计行，几乎不比没有强。

`call_service` 得到的恰恰是同样三条，因为它不过是经过同一个关口的写入，然后再加上实体自己的检查（数字的步长和更窄的范围、文本的模式、实体未被禁用）。其中任何一处的拒绝，既针对变量也针对实体进行审计：来源 `mcp`，按名称的客户端，entity_id，服务和调用 id，与被拒绝的 `write_tag` 所留下的是同一行，外加该实体。没有原因的调用会在尝试任何事情之前被拒绝，和 `write_tag` 一样。

`trigger_automation` 受到同样的把关，因为规则的动作可以命令设备；否则它就会成为绕过 `write_tag` 所遇检查的一条途径。

```
> write_tag tag=press-01/Zone1_Temp value=99 reason="testing"
write refused: press-01/Zone1_Temp: this tag is not marked writable
```

写入被关闭时，服务器指令会在一开始就这样说，这样代理就不会浪费一轮去发现它。

## 对外调用

自动化的 `mcp_call` 动作会调用另一个 MCP 服务器上的工具。在图表中配置这些服务器：

```yaml
mcp:
  outboundServers:
    - name: maintenance
      url: http://maintenance-mcp.default.svc.cluster.local:8080/mcp
      existingSecret: maintenance-mcp-token
      secretKey: token
```

会话会被池化并复用；每次调用都重新连接，意味着每当规则触发都要进行一次握手、一次 initialize 和一次工具列表。已经死掉的会话在下一次调用时重连，而不是靠计时器，因为下一次调用是第一个有人在意的时刻。已配置的服务器宕机并不会让工厂停止被监控，在规则需要之前不会拨出任何东西。

MCP 画面显示每个已配置的服务器、它是否已连接，以及它所公布的工具。

## 站点联合

每个工厂一个网关，就是它设计的运行方式。每个站点保留自己的数据库、自己的看板和自己的名字，没有一个依赖去往别处的链路保持畅通，工厂不会因为 WAN 掉线就不再被监控。

一次看到全部，用的是各站点已经在使用的协议。在云端配置一个网关，把各站点作为出站 MCP 服务器，与 `mcp_call` 动作完全一样：

```
HOTLOOP_MCP_SERVER_1_NAME=akron
HOTLOOP_MCP_SERVER_1_URL=https://akron.example/mcp
HOTLOOP_MCP_SERVER_1_TOKEN=…
HOTLOOP_MCP_SERVER_2_NAME=ashtabula
HOTLOOP_MCP_SERVER_2_URL=https://ashtabula.example/mcp
HOTLOOP_MCP_SERVER_2_TOKEN=…
```

站点画面然后并行地在每个站点上调用 `get_plant_status`，并汇总答案。无需在站点上部署任何东西就能让它出现，没有站点需要知道自己被联合，也没有任何东西向内连接到工厂网络。

有两种行为是有意设计的，值得信赖：

- 不回答的站点显示为**不可达，并附原因**，并被排除在汇总之外。把一个你联系不上的工厂计为零报警，是这样的画面能做的最糟糕的事。
- 站点上次报告的数字绝不显示。它们看起来是当前的，实际上不是。

每个站点都有自己的短期限，所以链路中断的一个工厂不会拖住正常的那些。

## 值得告诉代理的事

服务器自己的指令已经涵盖了这些，但对于围绕它编写提示的人：

- 报警状态遵循 ISA-18.2。`rtn-unack` 表示报警在任何人看到之前自己恢复了，它仍然值得报告，而且这个状态证明了确认和恢复正常是相互独立的。
- 对于超过几分钟的任何内容，使用带时间桶的 `query_history`，而不是原始数据。一天的一秒级数据是每个变量 86,400 个点。时间桶遵循质量规则：不良和不确定的读数计入 `badReadings`，绝不计入平均，没有任何良好数据的时间桶，平均值为 null。
- `recent_events` 是还原一次事件的方式：设备连接、写入、报警转换、自动化运行和配置变更，按顺序排列，每一项都带有引起它的操作者。
