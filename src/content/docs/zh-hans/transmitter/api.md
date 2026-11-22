---
title: "Transmitter API 参考"
description: "HotLoop Transmitter 发布器功能块的全部输入、输出和方法。"
---

一切都在 `HLTX` 命名空间中。功能块是 `HLTX.FB_HLTX_Publisher`。

## 输入

| 输入 | 类型 | 默认值 | 含义 |
|---|---|---|---|
| `bEnable` | BOOL | FALSE | TRUE 打开套接字并开始发布。FALSE 关闭套接字，并使功能块回到 `Disabled`，同时清除 `ConfigError` |
| `sDestination` | STRING(15) | `127.0.0.1` | 点分 IPv4 地址：单播主机，或 224.0.0.0 到 239.255.255.255 之间的组播组 |
| `uiPort` | UINT | 4840 | 目标 UDP 端口。4840 是 OPC UA 注册的端口 |
| `sLocalAddress` | STRING(15) | 空 | 仅组播：用于发送的接口地址。留空则由操作系统选择 |
| `usiMulticastTTL` | USINT | 1 | 组播 time to live |
| `uiPublisherId` | UINT | 1 | PublisherId，以 UInt16 发送 |
| `uiWriterGroupId` | UINT | 1 | WriterGroupId |
| `uiDataSetWriterId` | UINT | 1 | DataSetWriterId |
| `tPublishingInterval` | TIME | T#100MS | 消息之间的时间。最小 T#1MS。功能块只能在某个周期发送，所以实际速率是该间隔向上取整为调用它的任务周期的整数倍 |
| `eEncoding` | `E_HLTX_Encoding` | `Variant` | `Variant` 或 `RawData`。请在禁用状态下更改 |
| `udiGroupVersion` | UDINT | 1 | 组头中的 GroupVersion |
| `udiConfigMajor`, `udiConfigMinor` | UDINT | 1, 0 | DataSet 的 ConfigurationVersion。字段列表每次变化时都要增加 major |
| `bTimestamp` | BOOL | TRUE | 用 PLC 时钟给每条消息加时间戳，在 NetworkMessage 和 DataSetMessage 中都有（整秒，参见[线路上有什么](/zh-hans/transmitter/wire-format/)）。FALSE 则发送 1.0.0 的字节，短 17 字节 |
| `tRetry` | TIME | T#2S | 连续十次发送失败后，重新打开套接字前等待的时间 |

## 输出

| 输出 | 类型 | 含义 |
|---|---|---|
| `eState` | `E_HLTX_State` | `Disabled`、`Running`、`Backoff`（等待重新打开套接字）或 `ConfigError`（见 `eError`；不发送任何内容） |
| `eError` | `E_HLTX_Error` | `None`、`NoFields`、`BadInterval`、`BadAddress`、`SocketCreate`、`SocketOption`、`TooBig`、`BadField` |
| `bActive` | BOOL | 消息正在发出时为 TRUE |
| `udiSent` | UDINT | 已交给网络的消息数 |
| `udiSendErrors` | UDINT | 被操作系统拒绝或截断的发送数 |
| `udiSkipped` | UDINT | 因任务延迟而错过的发布时隙数 |
| `uiMessageSize` | UINT | 最近一条消息的字节数 |
| `diLastSocketResult` | UDINT | 套接字调用最近一次的运行时错误码，0 表示正常 |
| `diLastClockResult` | UDINT | 为时间戳读取 PLC 时钟的最近一次结果，0 表示正常。不为 0 时，消息不带时间戳发出 |
| `udiLastCallUs`, `udiMaxCallUs` | UDINT | 功能块最近一次调用所用的微秒数，以及自启用或 `Clear()` 以来的最大值 |
| `udiMaxEncodeUs`, `udiMaxSendUs` | UDINT | 自启用或 `Clear()` 以来，构建一条消息所用的最长时间，以及发送调用本身所用的最长时间 |

## 方法

在第一次调用之前，按接收端应读取的顺序一次性添加字段。字段被接受时，每个方法返回 TRUE。最多 128 个字段。

| 方法 | 添加 |
|---|---|
| `AddBool(pValue)`, `AddSInt`, `AddUSInt`, `AddInt`, `AddUInt`, `AddDInt`, `AddUDInt`, `AddLInt`, `AddULInt`, `AddReal`, `AddLReal`, `AddTime` | 一个标量。`pValue` 是 `ADR(variable)` |
| `AddString(pValue, uiMaxLen)` | 一个 STRING。`uiMaxLen` 是 `STRING(N)` 中的 N |
| `AddArray(pFirst, eType, uiCount)` | 一个含 `uiCount` 个元素、除 STRING 外任意类型的数组。`pFirst` 是 `ADR(array[first])` |
| `AddField(pData, eType, uiCount, uiMaxLen)` | 其他方法所调用的通用形式 |
| `Clear()` | 忘记字段列表和最大调用时间 |

功能块会保存你给它的地址，所以在移动变量的在线更改之后，请调用 `Clear()` 并重新添加字段。WORD、DWORD 和 LWORD 通过同样大小的方法分别作为 UINT、UDINT 和 ULINT 加入。

## 如何调用

每个周期从一个任务中调用一次实例。不要从两个任务调用同一个实例。一个程序中有多个发布器没有问题，每个都有自己的套接字；请给每个发布器各自的 writer group id 和 dataset writer id。
