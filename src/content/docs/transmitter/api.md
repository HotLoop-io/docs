---
title: "HotLoop Transmitter API"
description: "Every input, output and method of the HotLoop Transmitter publisher function block."
---

:::caution[Not released]
HotLoop Transmitter has no release yet. This page describes the library as built on `main` of HotLoop-io/hotloop-transmitter and run on the CODESYS Control for Linux SL 4.22.0.0 runtime in a container. It has not run on a physical controller.
:::

Everything is in the `HLTX` namespace. The block is `HLTX.FB_HLTX_Publisher`.

## Inputs

| Input | Type | Default | Meaning |
|---|---|---|---|
| `bEnable` | BOOL | FALSE | TRUE opens the socket and starts publishing. FALSE closes it and returns the block to `Disabled`, which also clears a `ConfigError` |
| `sDestination` | STRING(15) | `127.0.0.1` | dotted IPv4 address: a unicast host, or a multicast group from 224.0.0.0 to 239.255.255.255 |
| `uiPort` | UINT | 4840 | destination UDP port. 4840 is the one OPC UA registers |
| `sLocalAddress` | STRING(15) | empty | multicast only: the address of the interface to send from. Empty lets the OS choose |
| `usiMulticastTTL` | USINT | 1 | multicast time to live |
| `uiPublisherId` | UINT | 1 | PublisherId, sent as UInt16 |
| `uiWriterGroupId` | UINT | 1 | WriterGroupId |
| `uiDataSetWriterId` | UINT | 1 | DataSetWriterId |
| `tPublishingInterval` | TIME | T#100MS | time between messages. Minimum T#1MS. The block can only send on a cycle, so the real rate is the interval rounded up to a whole number of cycles of the task that calls it |
| `eEncoding` | `E_HLTX_Encoding` | `Variant` | `Variant` or `RawData`. Change it while disabled |
| `udiGroupVersion` | UDINT | 1 | GroupVersion in the group header |
| `udiConfigMajor`, `udiConfigMinor` | UDINT | 1, 0 | DataSet ConfigurationVersion. Bump the major whenever the field list changes |
| `tRetry` | TIME | T#2S | how long to wait before reopening the socket after ten sends in a row failed |

## Outputs

| Output | Type | Meaning |
|---|---|---|
| `eState` | `E_HLTX_State` | `Disabled`, `Running`, `Backoff` (waiting to reopen the socket) or `ConfigError` (see `eError`; nothing is sent) |
| `eError` | `E_HLTX_Error` | `None`, `NoFields`, `BadInterval`, `BadAddress`, `SocketCreate`, `SocketOption`, `TooBig`, `BadField` |
| `bActive` | BOOL | TRUE while messages are going out |
| `udiSent` | UDINT | messages handed to the network |
| `udiSendErrors` | UDINT | sends the OS refused or cut short |
| `udiSkipped` | UDINT | publish slots missed because the task ran late |
| `uiMessageSize` | UINT | bytes in the last message |
| `diLastSocketResult` | UDINT | the last runtime error code from a socket call, 0 is fine |
| `udiLastCallUs`, `udiMaxCallUs` | UDINT | microseconds spent in the last call of the block, and the longest since enable or `Clear()` |
| `udiMaxEncodeUs`, `udiMaxSendUs` | UDINT | the longest time spent building one message, and in the send call itself, since enable or `Clear()` |

## Methods

Add fields once, before the first call, in the order a receiver should read them. Each returns TRUE when the field
was accepted. Up to 128 fields.

| Method | Adds |
|---|---|
| `AddBool(pValue)`, `AddSInt`, `AddUSInt`, `AddInt`, `AddUInt`, `AddDInt`, `AddUDInt`, `AddLInt`, `AddULInt`, `AddReal`, `AddLReal`, `AddTime` | one scalar. `pValue` is `ADR(variable)` |
| `AddString(pValue, uiMaxLen)` | one STRING. `uiMaxLen` is the N in `STRING(N)` |
| `AddArray(pFirst, eType, uiCount)` | an array of `uiCount` elements of any type but STRING. `pFirst` is `ADR(array[first])` |
| `AddField(pData, eType, uiCount, uiMaxLen)` | the general form the others call |
| `Clear()` | forgets the field list and the maximum call time |

The block keeps the addresses you give it, so after an online change that moves variables, call `Clear()` and add
the fields again. WORD, DWORD and LWORD go in as UINT, UDINT and ULINT through the same-sized method.

## Calling it

Call the instance once per cycle from one task. Do not call one instance from two tasks. Several publishers in
one program are fine and each owns its own socket; give each its own writer group and dataset writer id.
