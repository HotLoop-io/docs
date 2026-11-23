---
title: "core 4.23.2 发布说明"
description: "HotLoop core 4.23.2 包含什么、升级时有哪些变化,以及动手处理一个正在运行的工厂之前应该先读什么。"
sidebar:
  label: "4.23.2"
---

CODESYS 画面现在会作为 HotLoop 画面导入,设备盒向 EmberNet 仪表板报告自己的健康状况,能耗电表可以带需量电费。这也是对测试套件在慢速节点上失败情况的一次清扫,每一项都是修复的一个真实的等待或竞态。只为 amd64 构建;多架构构建作为下一个版本跟进。

## 变更内容

- **CODESYS 可视化可以导入为画面。** 从 IDE 导出(Project、Export,原生的 `.export` 文件,而不是 PLCopenXML),Dashboards 画面的 Import 会把它读成基于 PLC 变量的 HotLoop 画面。画面读取而这个安装里没有的每个 tag 都会被列出,并带有设备映射,HotLoop 无法放置的每个元素会在保存任何东西之前连同原因一起列出。在不可写的 tag 上的按钮或设定值会被拒绝,与构建时一样。参见 [Import a CODESYS screen](/zh-hans/iot/codesys-screen-import/)。
- **面向 EmberNet 仪表板的设备盒健康状况。** 以 Kubernetes 节点命名的设备会发布设备盒的 CPU、内存、磁盘和数据卷使用情况,以及在有代理为它写入文件时三个核心的实时抖动。无法读取的值是带原因的坏质量,绝不是零。OPC UA 服务器提供它们的历史。参见 [OPC UA 服务器](/zh-hans/edge/opc-ua-server/#设备健康面向-embernet-仪表板)和[协议与驱动](/zh-hans/iot/protocols/#设备健康)。
- **一个只能读取、别无其他权限的登录。** 部署可以创建一个恰好只有 `tags.read` 和 `values.read` 的账户(`HOTLOOP_READER_USER` 和 `HOTLOOP_READER_PASSWORD_HASH`)。chart 在第一次安装时创建 `embernet-dashboard-read`,把它的密码保存在 Secret `<release>-opcua-dashboard` 中,升级时从不轮换它。
- **仪表板的证书从 Secret 中获得信任。** chart 挂载 `<release>-opcua-trust`(可选),OPC UA 服务器让它的信任文件夹与之保持同步:新证书在 30 秒内加入,离开 Secret 的证书被移除,运维人员手动放置的文件绝不会被动。服务器仍然只接受 Basic256Sha256 SignAndEncrypt,没有匿名会话,也没有信任所有。服务器开启时,该版本的 Service 现在会列出端口 4840。
- **能耗:需量电费和班次。** 以 Wh、kWh 或 MWh 计的电表接受 `demand_price`,即它在一个窗口内最高的一刻钟的每千瓦费用,汇总会显示峰值、它何时开始,以及那一刻钟中有多少被读取。班次是一个窗口,最近开始的一班是 `shift:06:00-14:00`,再之前的一班是 `last_shift:06:00-14:00`。Energy 画面有 Shift 框和需量价格,支持全部十三种语言。
- **单位产品成本不再读成免费。** 当有产品生产出来、而没有带价格的电表统计过用量时,回答是没有,带原因 `nothing_counted`,而不是零。
- **测试中的 CODESYS 运行时,已记录下来。** 真实运行时的 OPC UA 服务器用 CODESYS 文档所述的 PLC shell 命令做了安全配置,并针对它验证了 Basic256Sha256 SignAndEncrypt 读取。一条真实的报警触发、被确认,并按运行中的 PLC 报告的情况清除。未授权运行时的两小时演示窗口结束时设备会怎样,已连同时间线脚本一起记录。这些是[协议与驱动](/zh-hans/iot/protocols/)中的测试和说明;驱动没有变化。
- **套件发现的修复。** 能耗引擎不再在电表被删除或修改时读取它(数据库曾通过让删除失败来打破死锁)。备份的 manifest 以临时名称写入,再就地重命名,所以列表永远看不到半个文件。historian 的追赶会等到写完某个标记之前的所有内容。其余的是现在在负载节点上等待它们所断言的内容、而不是固定秒数的测试。

## 盒子健康状况默认开启

chart 把主机的根挂载到 `/host`,把它的 `/proc` 挂载到 `/host/proc`,两者都是只读的,并且不增加任何权限:只读取一个 statfs 以及 CPU 和内存计数器。强制执行 Pod Security restricted 配置的集群会拒绝 hostPath。在那里,请设置 `opcuaServer.dashboard.boxHealth.enabled: false`(没有设备,没有挂载)或 `hostMount: false`(有设备,设备盒的磁盘和 CPU 读为坏,并说明要挂载什么)。Quadlet 的 drop-in 是 `deploy/quadlet/opcua-dashboard.conf`。

## 迁移

一个,并且只增不减:`0030_energy_demand`(电表及其桶上的 `demand_price` 列,默认 0,所以已经统计或定价的内容不会变化)。在 4.23.1 上做的备份可以在这里恢复,而在这里做的备份不能恢复到更旧的版本上。

## API 变更

能耗电表费率中的 `demand_price`,汇总行中的 `demand` 块,作为能耗周期的 `shift:` 和 `last_shift:`,以及 `cost_per_unit` 为 null 时的 `reason`。`POST /api/dashboards/import` 接受 `codesys` 和 `visualization` 来代替 `file`,它的报告带有 `conversion`。参见 [HTTP API](/zh-hans/iot/api/)。

## 从 4.23.1 升级

普通的 `helm upgrade`。迁移在第一次启动时运行。chart 在这个版本的第一次安装时创建只读账户和它的 Secret,并且从不轮换它;设备盒上已有的东西都不会改变。

## 尚未验证的内容

- 它不认识的元素会被列出并留空,绝不猜测,来自其他项目的画面可能会列出更多。
- 实时抖动 tag 需要一个写入该文件的代理,这个版本没有安装任何代理。
- 只读登录和证书信任是用 HotLoop 自己的客户端证明的。EmberNet 仪表板那一侧是它自己的版本。
- CODESYS 安全端点在测试中是在一个运行时版本上验证的。HotLoop 的驱动没有为此改变,安全端点的设置画面也不是这个版本的一部分。
- 需量电费是用记录下来的读数核对的，而不是用电力公司的账单。
