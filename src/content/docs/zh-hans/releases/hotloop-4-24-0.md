---
title: "core 4.24.0 发布说明"
description: "HotLoop core 4.24.0 包含什么、升级时有哪些变化,以及动手处理一个正在运行的工厂之前应该先读什么。"
sidebar:
  label: "4.24.0"
---

HotLoop 画面就是 P&ID。CODESYS PLC 自己的报警出现在 HotLoop 的报警列表里,确认会回到 PLC,脚本运行总会结束,设备盒的数据卷总能读到,UniFi Protect、Access 和电源的路线图条目已经交付。只为 amd64 构建;多架构构建作为下一个版本跟进。

## 变更内容

- **画面就是 P&ID。** 把储罐、泵、阀门、换热器、过滤器、仪表和接头放到符号页面上,再从一个连接点拖到另一个:管道会自行铺设,绕过页面上的一切并保持直角,在你把它放到另一根管道上的地方用接头分出支路,并在你移动符号时重新布线。每根管道都带有它的介质(水、蒸汽、燃料、空气、电力、信号等,每种都有颜色、代码和线型,所以颜色绝不是唯一的载体),并随它的 tag 或一条规则而动。每个符号页面都有一个工具栏,用于缩放、平移、显示小地图以及切换到灰色的高性能视图,P&ID 在同一个画面文件中保存、导出和导入。参见[仪表板](/zh-hans/iot/dashboards/)和 [Screen files](/zh-hans/iot/screen-file/)。
- **CODESYS PLC 自己的报警出现在 HotLoop 的报警列表里。** 项目的 Alarm Configuration 保存报警组和报警类,以及监视某个变量的报警。CODESYS 设备现在会读取它的 PLC 的报警管理器所持有的那些(激活的、等待确认的、在条件仍成立时已确认的),并且在 HotLoop 里做的确认会回到 PLC。没有报警可给的 PLC 不会被打扰。它需要 HotLoop Alarms 库和项目里的一个块。参见 CODESYS-ALARMS.md。
- **设备盒的数据卷总能读到。** 在 `/data` 下没有挂载任何东西的设备盒没有 `/data`,设备盒健康 tag `data_util_pct` 曾以“no such file or directory”读为坏。现在它读取数据文件夹将要创建在其上的那个卷。参见[协议与驱动](/zh-hans/iot/protocols/#设备健康)。
- **脚本运行总会结束。** 当数据库拒绝写入脚本运行的结束时,HotLoop 记录日志然后放弃,所以这次运行在进程存活期间一直读为“running”,而它的位置早已空出。现在会再次请求这次写入,最多五次,中间有短暂等待。
- **UniFi Protect、Access 和 SmartPower PDU 插口已在路线图上交付。** 它们在 4.23.6 中作为设备到来,按已发布的 API 构建,Protect 的每条路径都与 7.4.102 文档相符。参见 [HotLoop 路线图](/zh-hans/roadmap/)。
- **TwinCAT 画面在浏览器中得到验证。** TwinCAT PackML 示例连同它的框架一起导入并渲染,指示灯会跟随一个实时寄存器。
- **测试等待它们所等待的东西。** 面板 throttle 的等待按算术检查,forSec 保持的计时器掌握在测试手里,不再与一次睡眠赛跑,Apache Kafka 的 topic 测试立即删除它的 topic,并拥有慢速设备盒所需的时间,API 测试也不再用一个样本来限定登录,因为负载下的设备盒的应答比一秒前慢四倍。

## 迁移

无。

## API 变更

没有。没有路由改变。符号页面的配置接受 `pipes`、`view` 和符号的 `rot`,保存的画面文件会带上它们。

## 从 4.23.6 升级

普通的 `helm upgrade`。没有迁移,也没有新的 secret。没有管道的符号页面按原样绘制。

## 尚未验证的内容

- PLC 报警路径是针对真实的 CODESYS Control for Linux SL 4.22.0.0 运行时,配合报警实验程序运行的。
- Protect、Access 和 PDU 的插口遵循已发布的 API,使用真实设备的试验台运行将在办公室跟进。
