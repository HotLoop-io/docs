---
title: "core 4.19.11 发布说明"
description: "HotLoop core 4.19.11 包含什么、升级时有哪些变化,以及动手处理一个正在运行的工厂之前应该先读什么。"
sidebar:
  label: "4.19.11"
---

HMI 仪表板卡片和在 [4.19.8](/zh-hans/releases/hotloop-4-19-8/) 之后加入的 CODESYS 工作,以及在更早版本中发现的两处修复。没有迁移,唯一的 API 变化是一个新路由(见下)。普通的 `helm upgrade` 或 Quadlet 自动更新就能带上它,前一个版本可以在同一个数据库上运行。

这次构建只有 amd64,下一个版本是一次小的版本号提升,用来构建 arm 镜像,两轮就是这样进行的。在此期间 `stable` 保留它已有的 arm 镜像。[4.19.10](/zh-hans/releases/hotloop-4-19-10/) 是最近一次多架构构建,[4.19.8](/zh-hans/releases/hotloop-4-19-8/) 列出了自它之前那个版本以来的所有变化。

## 变更内容

- **设定值卡片。** 用于有人键入的数字的仪表板卡片:温度、速度、液位。它知道 tag 的单位和限值(卡片只能收窄 tag 的范围,绝不能放宽),在字段下面说明输入有什么问题,并在输入正确之前保持 **Set** 关闭,先带着当前值和一条供审计记录用的原因来询问,并通过 `POST /api/write` 写入,所以总写入开关、tag 的可写标记、角色的权限和审计行与其他任何写入都一样。然后它说明设备保存着什么:“Read back 70 C from the device: it is the value sent”,或者在 PLC 接受了写入却保存着别的值时说“The device reports 60 C, not 70 C”。在读数匹配之后它还会观察两秒,因为把写入的值拉回自己限值的 PLC,会先让那个值短暂显示一下。当 tag 没有良好的读数时,卡片会说设备没有应答,并关闭它的字段和 **Set**。参见[仪表板](/zh-hans/iot/dashboards/)。
- **符号页面卡片。** 一幅机器的图画:泵、电机、风扇、阀门、罐、加热器、指示灯、管道、读数和标签,按像素放在背景上,并根据它们的 tag 状态绘制,除了颜色还有文字,报警时是红色或暖色,tag 没有良好读数时变淡,在用户要求系统减少动态效果时保持静止。每个符号都由 HotLoop 绘制。它不发出任何命令:旁边的设定值卡片或按钮卡片才会。参见[仪表板](/zh-hans/iot/dashboards/)。
- **对 CODESYS 或 OPC UA tag 的写入在写入后立即从 PLC 读回。** 订阅只发送变化,所以一个写入 PLC 已经持有的值的配方从未被确认过。现在运行时在一次已写入的操作之后自己读取该点,设定值卡片的“read back”就是这次读数。
- **CODESYS 设备每秒读取一次,而不是每五秒。** 这是驱动要求运行时的 OPC UA 服务器查看每个变量的频率;运行时自己默认的五秒曾让一台泵看起来晚了五秒才启动。修改设备的轮询间隔或它的 `samplingIntervalMs` 可以要求更频繁。参见[集成](/zh-hans/iot/integrations/)。
- **报警可以从 CODESYS 项目导入。** `POST /api/alarms/import/codesys`(权限 `alarms.write`)读取 CODESYS IDE 的 Export Alarms 写出的文件,UTF-16(IDE 写出的样子)或 UTF-8,带 `?deviceId=`,以及可选的 `?application=` 和 `?defaultPriority=`。没有 `?apply=true` 时不会保存任何东西,回答会说明将会导入什么。数字报警、UpperLimit 和 LowerLimit 连同它们的消息和延迟会被带过来;IDE 能写出的其他任何东西都不会被读取,并连同它的行和原因出现在 `skipped` 里,因为 CODESYS 没有记录其布局,只有真实导出显示过的内容才会被读取。参见 [HTTP API](/zh-hans/iot/api/#post-apialarmsimportcodesys)。
- **旧画面的文字在句子里没有破折号。** 工厂会读每一个字。

- **UniFi 画面先画曲线,再显示旁边的数字。** 旧画面的概览,以及两个画面里端口的详情,都是先读数字,再读它背后的近期读数。在两者之间到达的读数留在了曲线里而不在数字里,所以一张 WAN 卡片在一条结束于 6 的线旁边写着 5 ms。现在它们先请求曲线,带着上一次查看的曲线,所以刷新不会发出以前不会发出的请求;一个还没有 WAN 的画面的第一次查看会在之后读取它们。已在浏览器中对两个画面做了验证:旧的顺序通不过新测试(5 ms 在一条结束于 6 的曲线旁边,端口的流量比它的曲线慢一个计数),新的顺序通过,把旧顺序放回去又会使其失败。
- **Kafka 或 Redpanda 历史目标会说明 broker 为什么拒绝写入。** 磁盘上没有空间的 broker(低于空闲空间阈值的 Redpanda,日志目录无法写入的 Kafka)会用错误码回答每次写入,客户端在它后面重试,直到记录超时,所以目标只显示“records have timed out before they were able to be produced”。现在在超时之后,目标会向 broker 询问一次,用一次不携带记录、因而无法存储读数的写入,并显示它的回答:`KAFKA_STORAGE_ERROR`,并附一行说明是 broker 之下的磁盘。工作正常的 broker 对该请求回答一个没有含义的错误,目标不会多说什么。读数从未丢失,现在也不会丢失:目标保留这一批,记下欠的区间,并在 broker 再次接受写入时从 HotLoop 自己的历史中发送。已针对空闲空间阈值设在其磁盘之上的 Redpanda 做了验证(目标带着原因下线,客户端的超时仍在其后),也针对工作正常的 Redpanda 和 Apache Kafka 做了验证(没有给出原因,问询也没有写入任何东西)。这关闭了 [4.19.8 的说明](/zh-hans/releases/hotloop-4-19-8/)列为已知的那一项。

## 已知

- 没有新内容。[路线图](/zh-hans/roadmap/)中 Broken or missing 下仍然开放的:OPC UA X.509 用户 token、我们的 OPC UA 服务器提供的已弃用策略 `Basic128Rsa15` 和 `Basic256` 以及超过 64 字节的密码(两者都来自库),还有针对进程内服务器的 S7comm 和 EtherNet/IP 静默设备测试。
