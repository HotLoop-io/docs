---
title: "线路上有什么"
description: "HotLoop Transmitter 发送的 NetworkMessage 和 DataSetMessage，逐字节说明，并附上定义每个字节的 OPC 10000-14 和 10000-6 章节。"
---

下面的每个字节都来自 OPC 10000-14（第 14 部分，PubSub）1.05 版和 OPC 10000-6（第 6 部分，映射），于 2026-10-31 在 reference.opcfoundation.org 上读取。某个字节看起来不对时，就去翻对应的章节号。这里的任何内容都不是通过查看其他厂商的数据包得来的。

一个发布器功能块每个发布间隔发送一条 NetworkMessage。一条 NetworkMessage 携带一条 DataSetMessage，即一个 Data Key Frame，所以每条消息都包含所有字段。从 1.1.0 起，除非 `bTimestamp` 为 FALSE，每条消息都在 NetworkMessage 和 DataSetMessage 中携带来自 PLC 时钟的时间戳；为 FALSE 时，字节与 1.0.0 完全相同。表格同时给出两种情况：标为带时间戳的行只在时间戳开启时才有。

所有多字节值都是小端序，OPC UA 二进制就是这样定义的；功能块逐字节写出，所以主机的字节序无关紧要。

## NetworkMessage（第 14 部分，7.2.4.4.2）

| 字节 | 值 | 含义 |
|---|---|---|
| 1 | `F1` | 位 0 到 3 为 UADPVersion 1。位 4 到 7 为 UADPFlags：PublisherId（位 4）、GroupHeader（位 5）、PayloadHeader（位 6）和 ExtendedFlags1（位 7）全部存在 |
| 1 | 带时间戳为 `21`，不带为 `01` | ExtendedFlags1：位 0 到 2 为 PublisherId 类型 001 = UInt16，带时间戳时位 5 为 Timestamp。没有 DataSetClassId、没有安全头、没有 PicoSeconds、没有 ExtendedFlags2 |
| 2 | PublisherId | `uiPublisherId` |
| 1 | `0F` | GroupFlags：存在 WriterGroupId、GroupVersion、NetworkMessageNumber 和 SequenceNumber |
| 2 | WriterGroupId | `uiWriterGroupId` |
| 4 | GroupVersion | `udiGroupVersion` |
| 2 | NetworkMessageNumber | 始终为 1，因为 0 无效 |
| 2 | SequenceNumber | 统计已发送的消息，到 65535 后回绕 |
| 1 | Count | 始终为 1（负载头，7.2.4.5.2） |
| 2 | DataSetWriterId | `uiDataSetWriterId` |
| 8 | Timestamp，仅带时间戳时 | NetworkMessage 的 Timestamp（7.2.4.4.2），一个 DateTime（第 6 部分，5.2.2.5）：自 1601-01-01 00:00:00 UTC 起的 100 ns 刻度，以 Int64 表示。位于负载头之后、DataSetMessage 之前 |

因为 Count 为 1，负载中没有 Sizes 数组。功能块不发送分块消息、发现消息、提升字段或安全头，需要其中任何一项的接收端，这个版本无法满足。

## DataSetMessage（第 14 部分，7.2.4.5.4 和 7.2.4.5.5）

| 字节 | 值 | 含义 |
|---|---|---|
| 1 | `69` Variant，`6B` RawData；带时间戳为 `E9` 和 `EB` | DataSetFlags1：有效（位 0）、字段编码（位 1 和 2：00 Variant，01 RawData）、序号（位 3）、ConfigurationVersion major（位 5）和 minor（位 6），带时间戳时还有 DataSetFlags2（位 7）。没有 Status。不带时间戳时 DataSetFlags2 也不存在，类型为默认的 Data Key Frame |
| 1 | `10`，仅带时间戳时 | DataSetFlags2：位 0 到 3 为消息类型 0（Data Key Frame），位 4 为 Timestamp |
| 2 | DataSetMessage 序号 | 统计已发送的消息，到 65535 后回绕 |
| 8 | Timestamp，仅带时间戳时 | DataSetMessage 的 Timestamp（7.2.4.5.4），与 NetworkMessage 的是同一个 DateTime，位于序号之后 |
| 4 | ConfigurationVersion major | `udiConfigMajor` |
| 4 | ConfigurationVersion minor | `udiConfigMinor` |
| 2 | FieldCount | 仅 Variant。RawData 省略（7.2.4.5.5） |
| ... | 各字段 | 按添加顺序 |

## 时间戳

功能块每条消息用 `SysTimeRtcGet`（由运行时提供的 SysTimeRtc 系统库）读取一次 PLC 的实时时钟，得到自 1970-01-01 UTC 起的整秒数，并把 `(seconds + 11644473600) * 10000000` 写成 DateTime。一条消息中的两个时间戳都是这同一个值。由此得出两点：

* 分辨率是一秒。接收端会在同一秒内的每条消息上看到相同的时间戳，并且它最多比消息构建的瞬间落后一秒。亚秒级时间戳在路线图上。
* 时间只和 PLC 的时钟一样准。时钟未设置的控制器会给消息打上 1970 年。当无法读取时钟（`diLastClockResult` 不为 0）时，消息会不带时间戳发出，这是第 14 部分允许的，而不是干脆不发。

字段列表每次变化时都要增加 `udiConfigMajor`。这样，按版本保存布局的接收端就可以拒绝为另一份列表构建的消息，而不是错误地解码它。

## 字段，Variant 编码（第 6 部分，5.2.2.16）

每个字段是一个 EncodingMask 字节，后面是值。掩码的位 0 到 5 是内置类型 id（第 6 部分，5.1.2，表 1），位 7 表示值是数组，此时元素之前有一个 Int32 元素个数。

| PLC 类型 | 类型 id | 值的字节 |
|---|---|---|
| BOOL | 1 Boolean | 1，`00` 或 `01` |
| SINT | 2 SByte | 1 |
| USINT, BYTE | 3 Byte | 1 |
| INT | 4 Int16 | 2 |
| UINT, WORD | 5 UInt16 | 2 |
| DINT | 6 Int32 | 4 |
| UDINT, DWORD | 7 UInt32 | 4 |
| LINT | 8 Int64 | 8 |
| ULINT, LWORD | 9 UInt64 | 8 |
| REAL | 10 Float | 4，IEEE 754 |
| LREAL | 11 Double | 8，IEEE 754 |
| STRING | 12 String | 以字节计的 Int32 长度，然后是 UTF-8（5.2.2.4） |
| TIME | 7 UInt32 | 毫秒，CODESYS 的 TIME 就是这样存放的 |

CODESYS 的 STRING 每个字符一个字节。`7F` 以内的字节是 ASCII，原样发出。高于 `7F` 的字节按 ISO 8859-1 读取，并写成其两字节的 UTF-8 形式。这是对 PLC 代码页的一个假设，也是功能块解释文本的唯一一处。

## 字段，RawData 编码（第 14 部分，7.2.4.5.11）

没有掩码，也没有计数：每个字段按顺序就是它的值，所以接收端必须知道布局。第 14 部分说这些字段 "handled like a Structure DataType"，所以每个值的编码方式与第 6 部分中 Structure 字段的编码方式相同。

* **标量**就是它们的值字节，与 Variant 表中相同，没有掩码。
* **数组**是一个 Int32 元素个数，然后是各元素（第 6 部分，5.2.5："One dimensional Arrays are encoded as a sequence of elements preceded by the number of elements encoded as an Int32 value"）。功能块总是发送给它的每个元素，所以个数等于数组声明的大小，后面没有填充。
* **字符串**是以字节计的 Int32 长度和 UTF-8 字节，然后是零字节直到 MaxStringLength，所以字段总是 4 + MaxStringLength 字节（7.2.4.5.11："the field shall be padded with bytes with value zero"）。功能块把 `STRING(N)` 的 N 作为以字节计的 MaxStringLength。更长的文本会在字符边界处被截断，因为字段无法增长。接收端的字段元数据必须带有相同的 MaxStringLength，并为每个数组提供一个 ArrayDimensions 条目。

这是 OPC Foundation 自己参考协议栈的读法。在 UA-.NETStandard（提交 `fcfc84eab5c105780d7268474a47d344d100aca1`）中，`src/Opc.Ua.PubSub/Encoding/Uadp/UadpBinaryReader.cs` 第 389 到 403 行说字符串 "read like a Structure field (Int32 length prefix and value) from a fixed-size 4 + MaxStringLength byte block whose remainder is zero padding"，而对于数组 "the array's Part 6 length (or dimensions) prefix gives the actual element count and the block is padded to product(arrayDimensions) elements"。第 593 到 648 行的 `TryReadPaddedArray` 实现了它，`tests/Opc.Ua.PubSub.Tests/Encoding/Uadp/UadpRawDataPaddingTests.cs` 对它做了断言。其余内容见[验证页面](/zh-hans/transmitter/proof/)。

## 大小

功能块在一个 1472 字节的缓冲区中构建消息：1500 字节的以太网负载减去 IP 的 20 字节和 UDP 的 8 字节，所以消息永远不会分片。放不下的字段列表会使功能块进入 `ConfigError`，错误为 `TooBig`；它不会截断。Variant 编码下一个 250 个元素的 REAL 数组是 1005 字节，所以一条包含该数组加头部的消息放得下，两个则放不下。
