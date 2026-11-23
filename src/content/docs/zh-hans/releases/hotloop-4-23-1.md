---
title: "core 4.23.1 发布说明"
description: "HotLoop core 4.23.1 包含什么、升级时有哪些变化,以及动手处理一个正在运行的工厂之前应该先读什么。"
sidebar:
  label: "4.23.1"
---

这个版本包含 4.23.0 说明里列出的全部内容。天气和能耗、再增加十三种语言的 Web 界面、可作为文件在安装之间移动的画面,以及对 UniFi 控制台的首批命令。只为 amd64 构建;多架构构建作为下一个版本跟进。

## 变更内容

- **一个气象站是一个实体。** 由屋顶气象站已经发布的 tag(温度、湿度、气压、风、雨、太阳辐射)构建,露点、热指数和风寒在设备盒上算出。没有提供给气象站的传感器没有行,停止应答的传感器读为 Unavailable,绝不是零。不会调用任何云服务。参见 [Weather](/zh-hans/iot/weather/)。
- **能耗电表。** 电表是一个按用量读取的 tag(像 kWh、燃气、水或空气这样的累计计数器,或一个功率)。用量按 15 分钟的桶保存,所以重启不会丢失任何东西,而一个班次、一天或一个月就是一个总和。费率表在桶生成时给每个桶一个成本,所以之后改了价格不会改变上个月的成本,单位产品的成本则由生产电表算出。有 Energy 画面、API 和 MCP 工具。参见 [Energy](/zh-hans/iot/energy/)。
- **Web 界面在英文之外再增加十三种语言:** 西班牙语、法语、意大利语、德语、挪威语、保加利亚语、希腊语、韩语、日语、越南语、印地语、简体中文和阿拉伯语,阿拉伯语从右向左排版。在顶部栏或登录卡片上选择一种。参见 [Languages](/zh-hans/iot/languages/)。
- **仪表板可以导出为文件,并导入到另一个安装里。** 客户的画面是他们自己的,绝不是产品的一部分:文件列出它所点名的每个 tag、设备、脚本和配方,导入会在保存任何东西之前一次性报告所有问题,并为名称不同的项提供映射。Export 和 Import 是 Dashboards 画面上的按钮,`screen_export` 和 `screen_import` 是 MCP 工具。参见 [Screen files](/zh-hans/iot/screen-file/)。
- **与 MCP 写入相配的读取**、编辑器的试运行,以及 CODESYS 报警导入。
- **对 UniFi 控制台的首批命令。** 可以命令五种点,每种在有人启用该 tag 之前都是只读的,像任何 tag 一样通过写入关口:设备的定位 LED、设备重启、交换机端口的 PoE 电源循环、无线网络开或关、被监视的客户端被封锁或放回,以及端口的 PoE 模式。电源循环受 15 分钟冷却时间的限制,冷却时间保存在数据库里,所以重启不会忘记它,而承载网络的端口(上行链路、交换机、网关、5G 备份、控制台没有列出的对端)绝不会被循环。HotLoop 登录所用的控制台账户必须是本地 Administrator 才能执行这些命令;View Only 账户会被控制台拒绝,HotLoop 会这样说明。一个内置 blueprint 会对一台不出声的设备的端口循环一次,然后发出报警。参见 [UniFi Network](/zh-hans/iot/unifi/)。
- **OPC UA 服务器应答 HistoryRead,** 数据来自 Gateway 保存的历史,有原始数据和处理后的数据。
- **OPC UA PubSub 的 delta 帧,作为选项。** `HOTLOOP_UADP_PUBLISH_DELTA_FRAMES=true` 只发送 key 帧之间发生变化的字段。默认关闭。
- **面板页面上的图片卡片适配它的卡片,** 不再决定行高。
- **Quadlet 安装的数据库升级单元在卷没有可升级内容时会跳过自己,** 因为 Podman 5.7 不会启动没有东西可运行的容器,而且内置数据库的名称被调整到 StatefulSet 所能有的 52 个字符之内。
- **chart 在卸载时保留它的凭据 Secret,** 和数据库的卷一样:以前用同一个名称重新安装会生成一个新密码,而保留下来的数据库会拒绝它。要从头开始,请把 Secret 连同卷一起手动删除。
- **Kafka 输出会等待** broker 上一个刚创建的 topic,等多久取决于它的连接所允许的时间,Edge Relay 文档里的断网队列数字都是实测值(在每秒 2,000 个读数时约两分钟)。
- 测试套件发现的修复:OPC UA 测试用户使用 bcrypt 的最低成本做哈希,所以套件里的登录不再超过测试客户端在慢速 runner 上愿意等待的时间(服务器及其登录没有变化),实时推送在它的最后一个页面离开的那一刻就忘记它发送过的内容,OPC UA 服务器会说明它的监听器何时占着端口,还有几项测试不再对那些按自己节奏发生的事情做 sleep。

## 迁移

两个,每个都只增不减:`0028_unifi_port_cycles`(每个交换机端口上一次电源循环的时间)和 `0029_energy`(三张表,用于电表和它们的桶)。两者都在备份里。在 4.22.1 上做的备份可以在这里恢复,而在这里做的备份不能恢复到更旧的版本上。

## API 变更

新路由:`GET /api/energy/meters`、`POST /api/energy/meters`、`GET`、`PUT` 和 `DELETE /api/energy/meters/{id}`、`GET /api/energy/summary` 和 `/api/energy/summary/{period}`、`GET /api/energy/series` 和 `/api/energy/series/{meter}/{period}/{step}`、`GET /api/dashboards/{id}/export`、`POST /api/dashboards/import` 和 `GET /api/entities/composites`。两个新权限:每个角色都有的 `energy.read`,以及管理员有的 `energy.write`。每个都有新的 MCP 工具。气象站是一个新的实体域,`weather`。参见 [HTTP API](/zh-hans/iot/api/)。

## 从 4.22.1 升级

普通的 `helm upgrade`。迁移在第一次启动时运行并增加表;没有新的 secret。原本关闭的东西不会被打开。

## 尚未验证的内容

- 其他命令还没有对真实控制台运行过。
- 天气和能耗是对录制数据、一套 Modbus 试验装置和 Emberburn 的模拟计数器运行的,不是对真实的屋顶气象站或工厂的电表。
- 十三个新的语言目录是根据共享术语表编写的,没有母语者审阅过。
