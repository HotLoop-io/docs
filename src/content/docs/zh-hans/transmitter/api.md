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
| `bTimestamp` | BOOL | TRUE | 用 PLC 时钟为每条消息打时间戳,位于 NetworkMessage 和 DataSetMessage 中(精确到毫秒,见 `WIRE-FORMAT.md`)。FALSE 发送 1.0.0 的字节,短 17 字节 |
| `bDeltaFrames` | BOOL | FALSE | 仅限 Variant 编码。在关键帧之间发送 Data Delta Frame(只含变化的字段,各带其索引),无变化时发送 KeepAlive。FALSE 每次发送完整关键帧,所有订阅方都能读取。丢弃增量帧的订阅方会在下一个关键帧才看到变化 |
| `uiKeyFrameEvery` | UINT | 10 | 配合 `bDeltaFrames`:每隔这么多条消息发送一个完整关键帧,使后加入的订阅方在此间隔内获得完整画面 |
| `bHighResTimestamp` | BOOL | TRUE | 运行时支持时,用时钟的毫秒时间打时间戳。FALSE 则打整秒,与 1.1.0 相同 |
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
| `bDeltaActive` | BOOL | 使用增量帧期间为 TRUE:`bDeltaFrames` 已开启,DataSet 为 Variant,且字段能放进 4096 字节的先前值副本 |
| `udiDeltaSent`, `udiKeepAliveSent` | UDINT | 已发送的 Data Delta Frame 与 KeepAlive 消息 |
| `bStampHighRes` | BOOL | 上一条消息的时间戳带有时钟的毫秒时间时为 TRUE;回退为整秒或未打时间戳时为 FALSE |
| `udiLastCallUs`, `udiMaxCallUs` | UDINT | 功能块最近一次调用所用的微秒数，以及自启用或 `Clear()` 以来的最大值 |
| `udiMaxEncodeUs`, `udiMaxSendUs` | UDINT | 自启用或 `Clear()` 以来，构建一条消息所用的最长时间，以及发送调用本身所用的最长时间 |

## 方法

在第一次调用之前，按接收端应读取的顺序一次性添加字段。字段被接受时，每个方法返回 TRUE。最多 128 个字段。

| 方法 | 添加 |
|---|---|
| `AddBool(pValue)`, `AddSInt`, `AddUSInt`, `AddInt`, `AddUInt`, `AddDInt`, `AddUDInt`, `AddLInt`, `AddULInt`, `AddReal`, `AddLReal`, `AddTime` | 一个标量。`pValue` 是 `ADR(variable)` |
| `AddString(pValue, uiMaxLen)` | 一个 STRING。`uiMaxLen` 是 `STRING(N)` 中的 N |
| `AddWString(pValue, uiMaxLen)` | 一个 WSTRING,以 UTF-8 发送。`uiMaxLen` 是 `WSTRING(N)` 中的 N |
| `AddDataSet(uiWriterId, udiConfigMajor)` | 在同一个 NetworkMessage 中开始另一个 DataSet:之后添加的字段属于它。每个发布间隔,一个 NetworkMessage 为每个 DataSet 携带一个 DataSetMessage,多个 writer 因而共享一个数据报。最多 8 个 DataSet;多于一个时增量帧关闭 |
| `SetStatus(pStatus)` | 给最后添加的字段一个状态。`pStatus` 是保存 OPC UA StatusCode 的 UDINT 的 `ADR`。只要它不为 0,该字段就以该 StatusCode 代替其值发出(Variant 编码),接收方将其读作坏质量。0 则发送值。RawData 没有状态,因此 RawData 发布者继续发送值 |
| `AddArray(pFirst, eType, uiCount)` | 由 `uiCount` 个元素组成的数组,元素可为除 STRING 和 WSTRING 外的任意类型。`pFirst` 为 `ADR(array[first])` |
| `AddField(pData, eType, uiCount, uiMaxLen)` | 其他方法所调用的通用形式 |
| `Clear()` | 忘记字段列表和最大调用时间 |

功能块会保存你给它的地址，所以在移动变量的在线更改之后，请调用 `Clear()` 并重新添加字段。WORD、DWORD 和 LWORD 通过同样大小的方法分别作为 UINT、UDINT 和 ULINT 加入。

## 如何调用

每个周期从一个任务中调用一次实例。不要从两个任务调用同一个实例。一个程序中有多个发布器没有问题，每个都有自己的套接字；请给每个发布器各自的 writer group id 和 dataset writer id。
