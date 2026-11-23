---
title: "Transmitter 1.2.0 发布说明"
description: "HotLoop Alarms 加入本次发布:一个把 PLC 自身的报警放到 HotLoop 读取位置的库。发布方不变。"
---

本次发布增加了 HotLoop Alarms,这是第二个库,把您 PLC 自身的报警放到 HotLoop 读取的位置,并以 1.2.0.0 发布 Transmitter,发布方与 1.1.0 相同。

这对您意味着什么:您的 CODESYS 项目已经触发的报警会出现在 HotLoop 的报警列表中,在 HotLoop 里确认一个报警也会在 PLC 中确认它。如果您只用发布方,就没有什么要改的。

## 使用 1.1.0 的项目有什么变化

* **HotLoop Alarms 1.0.0.0,新增。** `HotLoopAlarms-1.0.0.0.library` 和 `.compiled-library` 在本次发布中。块 `HLAL.FB_HLAL_Alarms` 是 CODESYS 报警管理器的客户端。每个周期调用一次,它把活动、等待和已确认的报警复制到一张由普通变量构成的表(`aAlarms`,64 行)中,运行时的 OPC UA 服务器像导出其他变量一样导出它。表变化时 `udiChanges` 递增,放不下的活动报警由 `uiDropped` 计数,而不是悄悄丢失。它不需要生成的报警连接器库,只需要项目自己的 Alarm Configuration。
* **确认会回传。** 写入命令变量(`uiAckGroupId`、`uiAckAlarmId`、`udiAckInternalId` 或 `bAckAll`,然后在 `udiAckRequest` 中写入新的数字),就会让块通过报警管理器确认该报警或全部报警。HotLoop 4.23.6 及之后的版本会根据块的内容找到它,并替您完成这一切。
* **Transmitter 发布方没有变。** 字段列表和线路格式没有动,`bTimestamp` 的工作方式不变。库重新编译为 1.2.0.0,`.package` 包含它。
* **许可证是 HotLoop Source License Agreement 1.0,** 与每个 HotLoop 产品相同。

## 我运行了什么,结果如何

全部在实验室中,针对容器里的 CODESYS Control for Linux SL 4.22.0.0。

* Transmitter 库在 CODESYS 3.5.22.30 中编译,0 个错误,0 个警告,基于它编译的示例应用也是如此。
* 实验室:两个发布方,Variant 和 RawData,各解码 114 条消息,每个值都与 PLC 通过自身 OPC UA 服务器报告的值相等,序列号没有缺口,每条消息都有两个时间戳,在 `bTimestamp := FALSE` 时字节与 1.0.0 相同。一个独立的 OPC UA PubSub 实现读取每条消息的值和时间戳。128 项检查通过,没有失败。
* HotLoop core 的 UADP 订阅方针对在线运行时读取两个发布方:每个值都相等,两个计数器都在前进,收到 62 个 key frame,没有被拒绝的。
* `.package` 通过 `PackageManagerCLI --install` 安装,库出现在 System 仓库中,示例基于它编译,0 个错误,0 个警告。
* HotLoop Alarms:针对有两个报警的 Alarm Configuration 的真实运行时,PLC 中的跳闸会显示在 HotLoop 中,在 HotLoop 中确认会让 PLC 的表变为已确认并带上时间,复位会让它变为等待确认,在 HotLoop 中确认完毕会清空 PLC 的表。第二个报警按相反顺序进行,全部确认则确认了两个活动报警。
* 20 ms 任务、两个发布方、固定在四个核心上时发布方的开销:每个周期平均增加约 15 us,最长周期 144 us,没有跳过发布时隙,也没有发送被拒绝。同一小时内重新编译的 1.1.0 库测得 15.2 us 和 261 us。

## 我没有运行什么

* 任何实体控制器,除 Control for Linux SL 4.22.0.0 之外的任何 CODESYS 运行时,以及 x86-64 之外的任何 CPU。
* 使用与"确认并要求确认完毕"的类别不同的报警类别的 HotLoop Alarms,或同时有超过 64 个活动报警的情况。
* 在 CODESYS Installer 窗口中安装 `.package`。它是用 PackageManagerCLI 无界面安装的。
* 实时时钟未设置或有误的控制器、组播、丢失并恢复网络的运行时,以及两小时演示窗口的结束。

## 本版本不包含

KeepAlive 和 Delta Frame、每个 NetworkMessage 多于一个 DataSetMessage、WSTRING、每个字段的状态、亚秒时间戳、消息安全以及订阅方一侧。[路线图](/zh-hans/transmitter/roadmap/)说明了接下来是哪些。

## 回退

固定在 1.1.0 的 PLC 项目继续工作,发送相同的字节。HotLoop Alarms 是单独的库:不添加它的项目不受影响。

## 文件

从 https://hotloop.io/hotloop-transmitter/1.2.0/ 下载,并与同一文件夹中的 `SHA256SUMS` 核对。

```
e68cfc88e599ddcf278eb208ff500f4f78d3faf74edf12e38f308a009f478594  HotLoopAlarms-1.0.0.0.compiled-library
68f704fc5662bbc67ec097016a741065d705af01913a2746296c17f9e6991118  HotLoopAlarms-1.0.0.0.library
a404f20fc35c4a3d804aa194f29def3f8193e26e696357899d3ae5b3d44948c1  HotLoopTransmitter-1.2.0.compiled-library
05200d0279ac120fd69d2dc3eeba99d9b40cb76eba2d15d1431b94c5e8f3fc32  HotLoopTransmitter-1.2.0.library
d6b6606a5919e18d2d6d31a5529af4d76bc7058003fb26032ec1a578f78ea57d  HotLoopTransmitter-1.2.0.package
```
