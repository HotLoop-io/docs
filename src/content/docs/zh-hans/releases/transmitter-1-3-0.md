---
title: "Transmitter 1.3.0 发布说明"
description: "毫秒级时间戳、WSTRING 字段、字段状态、一个 NetworkMessage 中的多个 DataSet,以及带 KeepAlive 的增量帧(默认关闭)。"
---

HotLoop Transmitter 通过你放入 CODESYS 项目的库,把 PLC 的值以 OPC UA PubSub 的形式送上网络。1.3.0 新增毫秒级时间戳、WSTRING 字段、使坏值以坏值发出的字段状态、一个 NetworkMessage 中的多个 DataSet,以及带 KeepAlive 消息的 Data Delta Frame。它是库 1.3.0.0,HotLoop Alarms 1.0.0.0 原样随附。

这对你意味着:已在使用 1.2.0 的 PLC 项目发送的字节与之前相同,只有一处可见的差异,时间戳现在带有毫秒。其余一切都通过一次调用或一个输入来开启。

## 新功能

* **毫秒级时间戳。** NetworkMessage 和 DataSetMessage 都带有时钟的毫秒,订阅方看到的是每条消息构建的时刻,而不是它所在的那一秒。`bStampHighRes` 表明上一条消息使用了哪个时钟。
* **WSTRING 字段。** `AddWString(ADR(wName), N)` 以 OPC UA String 的形式发布 `WSTRING(N)`,在 Variant 和 RawData 中均可。文本以 UTF-8 发出:U+FFFF 以上的字符在 PLC 中是代理对,发出时为一个四字节字符;孤立的代理项发出为 U+FFFD,所以订阅方读到的始终是有效文本。在 RawData 中,该字段的 MaxStringLength 为 `3 * N` 字节。
* **字段状态。** 添加字段后,`SetStatus(ADR(udiStatus))` 把它绑定到保存 OPC UA StatusCode 的 UDINT。只要该变量不为 0,字段就以 StatusCode 代替其值发出,订阅方将其读作坏质量。把它设回 0,值就会再次发出。RawData 发布者继续发送值,因为 RawData 无法携带状态。
* **一个 NetworkMessage 中的多个 DataSet。** `AddDataSet(uiWriterId, udiConfigMajor)` 在同一功能块中开始另一个 DataSet:之后添加的字段属于它。每个发布间隔,一个 NetworkMessage 为每个 DataSet 携带一个 DataSetMessage,并带有 Part 14 要求的 Sizes 数组,多个 writer 因而共享一个数据报。最多 8 个 DataSet。若从不调用它,消息就是 1.2.0 发送的那种。
* **Data Delta Frame 与 KeepAlive。** 稳定的数据集不必再在每个间隔发送每个字段。开启增量帧后,发布者先发送完整关键帧,之后每 `uiKeyFrameEvery` 条消息发送一次,其间发送只含变化字段的 Data Delta Frame,无变化时发送 KeepAlive。`bDeltaActive`、`udiDeltaSent` 和 `udiKeepAliveSent` 显示它在做什么。

## 使用 1.2.0 的项目有什么变化

* 你的字段列表和线路格式没有变化。线路上唯一的差异是时间戳的毫秒部分。
* HotLoop Alarms 1.0.0.0 包含在此版本中,没有变化。

## 设置与默认值

* `bHighResTimestamp` 为 `TRUE`:用时钟的毫秒打时间戳。设为 `FALSE` 则打整秒,与 1.2.0 完全相同。若运行时无法提供毫秒,功能块会自行打整秒。
* `bDeltaFrames` 为 `FALSE`。增量帧是你在发布者上开启的设置,而不是功能块不经询问就做的事,因此你现有的所有订阅方继续读取完整关键帧。要为某个 writer 开启,请在该发布者上设置 `bDeltaFrames := TRUE`,若想改变关键帧间隔,再设置 `uiKeyFrameEvery`(不设置则为 10)。每个发布者各自决定,所以一个 writer 可以发送增量,其他的不发送。丢弃增量帧的订阅方会在下一个关键帧才看到变化,因此请只为能读取增量帧的订阅方开启。它适用于只有一个 DataSet 的 Variant 发布者;RawData 发布者,或有多个 DataSet 的功能块,发送关键帧。
* `AddDataSet`、`AddWString` 和 `SetStatus` 是启动时调用一次的函数,与其他 `Add` 调用相同。不调用它们,一切照旧。

## 升级

安装 `HotLoopTransmitter-1.3.0.library`(或用 CODESYS Installer 打开 `.package`),把项目 Library Manager 中的库版本改为 1.3.0.0,然后编译。你的代码不必改动。需要新调用的功能时再添加它们。

## 回退

固定在 1.2.0 的项目继续工作,发送与之前相同的字节,时间戳为整秒。HotLoop Alarms 是单独的库,不受影响。

## 本版本不包含

消息安全、分块的 NetworkMessage、订阅方,以及 MQTT 传输。

## 文件

```
e68cfc88e599ddcf278eb208ff500f4f78d3faf74edf12e38f308a009f478594  HotLoopAlarms-1.0.0.0.compiled-library
68f704fc5662bbc67ec097016a741065d705af01913a2746296c17f9e6991118  HotLoopAlarms-1.0.0.0.library
5be90a88e9e0aae1de421628fb6ca8e810dda96b4562566df345d451ecd859cf  HotLoopTransmitter-1.3.0.compiled-library
0410b98578fd55775a97b27023a0b5f30111cac0587120894354d9edca1248fc  HotLoopTransmitter-1.3.0.library
3e791358e6dc628a2d2aae760e0c49c89f1c4490f0637b65864c335fcbb3e9a0  HotLoopTransmitter-1.3.0.package
```
