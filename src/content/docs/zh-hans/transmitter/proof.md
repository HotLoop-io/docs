---
title: "运行了什么"
description: "这个库用什么构建、在什么上运行、由谁读回，以及两个读取端意见不一致的那一处。"
---

本页是 1.0.0 的运行记录。带时间戳和 `.package` 的 1.1.0 运行记录在 [1.1.0 发布说明](/zh-hans/releases/transmitter-1-1-0/)中。此后这个库又在裸机上运行过（2026-11-17）。

## 构建

* 库：在 CODESYS 3.5.22.30（SP22 Patch 3）的 ScriptEngine 中编译，0 个错误、0 个警告。
* 示例应用，针对已安装的库构建，目标为 CODESYS Control for Linux SL 设备（4102, 0000 0005, 4.20.0.0）：0 个错误、0 个警告，可以下载。

## 运行时

CODESYS Control for Linux SL 4.22.0.0 把应用作为启动工程加载，并报告 `Application started`、`CODESYS Control ready`。因为没有运行时许可，它运行在演示模式。

## 线路上走了什么，谁读了它

示例应用有两个发布器：writer group 1 和 dataset writer 1 使用 Variant 编码（1142 字节），writer group 2 和 dataset writer 2 使用 RawData 编码（1144 字节）。每个有十七个字段：库支持的每种类型各一个，一个 250 个元素的 REAL 数组，一个 4 个元素的 INT 数组，以及两个计数器。

四个相互独立的读取端读取了它。

| 读取端 | 是什么 | Variant | RawData |
|---|---|---|---|
| 依据规范编写的解码器 | 仅依据 OPC 10000-14 和 10000-6 编写，还会从运行时的 OPC UA 服务器读取同样的变量并进行比较 | 每个字段都与 PLC 的值相等，整个抓包期间 NetworkMessage 和 DataSetMessage 序号没有缺口 | 相同 |
| 独立的 OPC UA PubSub 协议栈 | 带有 17 个字段的 DataSet 元数据的订阅端 | 检查的 15 个值全部相等，包括字符串、两个数组和 TIME | 11 个数值标量相等。该协议栈完全不读取任何长度的 RawData 字符串，也不读取 RawData 数组 |
| HotLoop core 的 UADP 订阅端 | HotLoop core 4.19.4 及之后每个版本中的驱动，针对运行中的运行时执行，并在其 DataSet 类型中告知 RawData 布局 | 21 个值检查相等，包括字符串、TIME、250 个元素 REAL 数组的第 0、1、124 和 249 个元素以及 INT 数组的全部四个元素，两个计数器在相隔 3 秒的两次读取之间都在递增 | 相同的 21 个值和相同的两个计数器。收到 62 个 key frame，没有被拒绝的 |
| 第二个解码器 | 我们自己接收端代码中的 UADP 解码器，对按 17 个字段布局抓取的 222 个数据报执行 | 全部 111 条消息解码，每个检查的值都正确 | 全部 111 条消息解码，每个检查的值都正确，数组带有 Int32 长度和填充 |

## RawData 数组和字符串

这个库在每个 RawData 数组之前写入一个 Int32 元素个数，字符串则写成 Int32 长度、其字节，然后用零填充到 MaxStringLength。这是 OPC Foundation 参考协议栈的做法，也符合规范文字：OPC 10000-14 7.2.4.5.11（"handled like a Structure DataType"，填充 "to the maximum size indicated by ArrayDimensions or MaxStringLength"）加上 OPC 10000-6 5.2.5（"One dimensional Arrays are encoded as a sequence of elements preceded by the number of elements encoded as an Int32 value"）。

HotLoop core 的订阅端和第二个解码器都以这种方式读取 RawData 数组，带长度和填充，并且都能解码这个库的 RawData。

与参考协议栈有一处不同：字符串长于 MaxStringLength 时，参考协议栈会抛出异常，而这个库在字符边界处截断，因为 PLC 任务没有可抛出异常的地方。

## 需要了解

* 运行是在 x86-64 上的 CODESYS Control for Linux SL 4.22.0.0 上进行的。这个库是 Structured Text，针对大端目标的字节序处理已经写好，但你需要在自己的控制器上检查。
* 组播：功能块会为组播组设置 TTL、回环和发送接口。请在你自己的网络上检查该组。
* 功能块会统计发送失败，并在网络消失或地址不存在时退避，程序继续扫描。
* 在演示模式下，运行时会在两小时窗口结束时停止，正如 CODESYS 所说。
