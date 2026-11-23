---
title: "Transmitter 1.0.0 发布说明"
description: "HotLoop Transmitter 的首个版本:一个把 PLC 值作为 OPC UA PubSub 发布的 CODESYS 库,包含什么,运行过什么,没有运行什么。"
---

首个版本。一个用 Structured Text 写成、基于 SysSocket UDP 的 CODESYS 库,把您的 PLC 数值作为 OPC UA PubSub(第 14 部分,UADP)发到网络上。您添加该库,声明一个功能块,加入要发出的变量,然后每个周期调用一次。任何订阅 OPC UA PubSub 的程序都能读取,HotLoop core 从 4.19.4 起也可以。

这对您意味着什么:没有 PubSub 库的 PLC 现在只需约十五行 Structured Text,就能向 PubSub 订阅方提供数据,控制器上不用再安装任何别的东西。

## 包含什么

* 一个块,`HLTX.FB_HLTX_Publisher`。每个发布间隔一个 NetworkMessage、一个 DataSetMessage、一个 Data Key Frame,因此每条消息都包含全部字段。
* Variant 和 RawData 两种字段编码,按发布方选择。Variant 自带类型。RawData 不带任何类型,所以必须告诉接收方布局,[线路格式页面](/zh-hans/transmitter/wire-format/)逐字节写明了这一点。
* BOOL、SINT、USINT、INT、UINT、DINT、UDINT、LINT、ULINT、REAL、LREAL、STRING 和 TIME 字段,以及除 STRING 外所有这些类型的数组,每条消息最多 128 个字段、1472 字节。消息从不分片。
* 单播或组播,输入为发布方 ID、写入组 ID、数据集写入方 ID、发布间隔、组版本和配置版本。
* 非阻塞发送。错误的地址、已断开的套接字或过大的字段列表,会让该块进入您可以读取的错误状态,但绝不会让您的应用出故障。

## 我们运行了什么,结果如何

全部在 CODESYS Control for Linux SL 4.22.0.0 上,使用下面的文件。

* 该库在 CODESYS 3.5.22.30 中编译,0 个错误,0 个警告。示例应用基于它编译,同样 0 个错误,0 个警告。
* 两个发布方,一个 Variant,一个 RawData,各十七个字段。线路上的每个值都与 PLC 通过自身 OPC UA 服务器报告的值相等,序列号没有缺口。
* 一个独立的 PubSub 协议栈完整解码 Variant 消息和 RawData 标量。它完全无法读取 RawData 数组或较长的 RawData 字符串,这是它的限制,不是该库的限制。
* HotLoop core 的订阅方(运行时用的是其 main 分支,在 HotLoop core 4.19.4 及之后的每个版本中)可以读取两个发布方,包括字符串、TIME、两个数组,以及两个在两次读取之间变化的计数器,并且不拒绝任何内容。
* 第二个解码器读取了全部 222 个捕获的数据报。
* 20 ms 任务、两个发布方的开销:每个周期平均增加约 10.6 us。发送的周期耗时 10 到 100 us。尾部是 `sendto` 调用,在繁忙的共享主机上,12 000 个周期中有一次达到 14.3 ms。如果这对您的控制逻辑有影响,请把发布方放在自己的较低优先级任务中。[时序页面](/zh-hans/transmitter/timing/)有对应的表格。

## 在您的控制器上要检查什么

* 大端目标的字节序处理已经写好,请在您自己的控制器上检查。
* 组播:该块为组设置 TTL、回环和发送接口,请在您自己的网络上检查该组。
* 如果网络消失或地址不存在,该块会记录失败并放慢重试,程序继续扫描。
* 在演示模式下,运行时会在两小时窗口结束时停止,正如 CODESYS 所说。

## 本版本不包含

DataSetMessage 和 NetworkMessage 的时间戳、KeepAlive 和 Delta Frame、每个 NetworkMessage 多于一个 DataSetMessage、WSTRING、每个字段的状态、消息安全以及订阅方一侧。[路线图](/zh-hans/transmitter/roadmap/)说明了接下来是哪些。

## 如果您来自另一个发布方

坚持要时间戳、KeepAlive 或 Delta Frame 的接收方不会满意这个版本,因为这三样都不发送。每条消息都是 Key Frame,任何接收方都可以直接读取。这里的 RawData 数组是一个 Int32 长度、各元素,再加补零到声明大小,这也是 OPC Foundation 参考协议栈的写法。期望数组是不带长度、元素首尾相连的接收方,必须被告知这些字段是独立的标量。

## 对已经使用它的项目

没有更早的版本。只有 `udiConfigMajor` 变化时线路格式才会变化,固定在这个库版本上的 PLC 项目保持相同的字段和字节。

## 文件

从 https://hotloop.io/hotloop-transmitter/1.0.0/ 下载两个文件和 `SHA256SUMS`,然后在 CODESYS 3.5 SP22 或更高版本中通过 Tools、Library Repository、Install 安装 `HotLoopTransmitter-1.0.0.library`。`.compiled-library` 是同一个库,只是不含源代码。

```
91b8023a73870925082c170588feb43d363e6d07ce008e1471fa8f5ff8db2c0d  HotLoopTransmitter-1.0.0.library
b02b0b40e434f35e4af1def20d6cc38688463537c4800354931b8c6094a66686  HotLoopTransmitter-1.0.0.compiled-library
```
