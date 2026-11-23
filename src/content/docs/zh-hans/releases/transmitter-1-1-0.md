---
title: "Transmitter 1.1.0 发布说明"
description: "每条消息都带有 PLC 时钟的时间戳,库可从 CODESYS 包安装:变了什么,运行过什么,没有运行什么。"
---

现在每条消息都带有 PLC 时钟的时间戳,库也可以从 CODESYS 的 `.package` 安装了。

这对您意味着什么:想知道某个值何时被采样的订阅方可以直接从数据包得到,不必再按到达时间去猜,您也可以像安装其他插件一样用 CODESYS Installer 安装这个库。

## 使用 1.0.0 的项目有什么变化

* **时间戳,默认开启。** NetworkMessage 和 DataSetMessage 各带一个 Timestamp(第 14 部分,7.2.4.4.2 和 7.2.4.5.4),是同一个 DateTime,每条消息从 PLC 的实时时钟读取一次。ExtendedFlags1 从 `01` 变为 `21`,DataSetFlags1 从 `69` 或 `6B` 变为 `E9` 或 `EB`,并增加一个 DataSetFlags2 字节 `10`。每条消息长 17 个字节。字段列表和值没有变,`udiConfigMajor` 也相同。
* **`bTimestamp := FALSE` 会发送与 1.0.0 完全相同的字节。** 如果您的某个接收方拒绝时间戳,请固定为此值。已检查:1142 和 1144 字节的消息,都没有时间戳,正是 1.0.0 发送的大小。
* **分辨率是一秒。** 时钟用 `SysTimeRtcGet` 读取,给出整秒,所以接收方在同一秒内的每条消息上看到相同的时间戳,它最多可能比消息构建的时刻落后一秒。亚秒时间戳在路线图上。
* **新输出 `diLastClockResult`。** 如果无法读取时钟,消息会不带时间戳发出,第 14 部分允许这样,而该输出会说明原因。
* **新的系统库 SysTimeRtc。** 库像 SysSocket 一样把它命名为占位符,由运行时提供。Control for Linux SL 4.22.0.0 提供它。没有它的目标无法使用带时间戳的 1.1.0;请留在 1.0.0。
* **`.package`。** `HotLoopTransmitter-1.1.0.package` 由 CODESYS 自带的 PackageManagerCLI 制作,通过 Installer 把同一个库放进库仓库。见[安装页面](/zh-hans/transmitter/install/)。

## 我们运行了什么,结果如何

全部在 CODESYS Control for Linux SL 4.22.0.0 上,使用下面的文件。

* 该库在 CODESYS 3.5.22.30 中编译,0 个错误,0 个警告。示例应用基于它编译,同样 0 个错误,0 个警告。
* 两个发布方,Variant 和 RawData,开启时间戳。一个按规范独立编写的解码器解码每条消息,每个值都与 PLC 通过自身 OPC UA 服务器报告的值相等。每条消息都有两个时间戳,它们是同一时刻,从不倒退,处于抓包所用时钟的整秒容差内,并且在 11 秒的抓包中时间戳前进了 11 秒。容器与主机共用时钟,所以这说明时间戳是 PLC 时钟的读数而不是编造的;它不测试时钟有误的控制器。
* 一个独立的 PubSub 协议栈用自己的头部解码器读取每个写入方全部 113 条消息的 NetworkMessage 和 DataSetMessage Timestamp,并像 1.0.0 那样解码各个值。
* HotLoop core 的订阅方(运行时用的是其 main 分支,在 HotLoop core 4.19.4 及之后的每个版本中)针对在线运行时读取两个发布方:各 21 个值,两个计数器都在前进,没有任何拒绝。每次读数都把发布方的整秒时间戳作为它的时间,在 3 秒的等待中,时间戳随 PLC 时钟移动。
* `.package` 通过 `PackageManagerCLI --install` 安装,库出现在 System 仓库中(之前没有),示例基于 Installer 放置的库编译,0 个错误,0 个警告。
* 20 ms 任务、两个发布方的开销:每个周期平均增加约 9.6 us,发送的周期为 10 到 100 us,本次运行中最长的周期为 81 us。该次运行跳过了三个发布时隙,没有发送被拒绝。时间戳本身在数字中看不出来。[时序页面](/zh-hans/transmitter/timing/)有对应的表格。

## 在您的控制器上要检查什么

* 大端目标的字节序处理已经写好,请在您自己的控制器上检查。
* 组播:该块为组设置 TTL、回环和发送接口,请在您自己的网络上检查该组。
* 如果网络消失或地址不存在,该块会记录失败并放慢重试,程序继续扫描。
* 在演示模式下,运行时会在两小时窗口结束时停止,正如 CODESYS 所说。
* 实时时钟未设置或有误的控制器,会按时钟显示的值打时间戳。

## 本版本不包含

KeepAlive 和 Delta Frame、每个 NetworkMessage 多于一个 DataSetMessage、WSTRING、每个字段的状态、亚秒时间戳、消息安全以及订阅方一侧。[路线图](/zh-hans/transmitter/roadmap/)说明了接下来是哪些。

## 回退

固定在 1.0.0 的 PLC 项目继续工作,继续发送 1.0.0 的字节。在 1.1.0 内,`bTimestamp := FALSE` 给出相同的字节。

## 文件

从 https://hotloop.io/hotloop-transmitter/1.1.0/ 下载,并与同一文件夹中的 `SHA256SUMS` 核对。

```
5ec021b23f5d57460016834a03b2b196d6dbc83aeb5d0ad60ace8d7b4fbbb4a7  HotLoopTransmitter-1.1.0.library
e172f4674f6cbfce2aeaf017d5a6c733245b1b9aa3e527369c753bf07b6ce0c2  HotLoopTransmitter-1.1.0.compiled-library
b3686bdebd052f1ddea46d1f1ff409f3b6c9a016ca5f3e8f4cd6f7922ccb479c  HotLoopTransmitter-1.1.0.package
```
