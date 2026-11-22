---
title: "HotLoop Transmitter 概览"
description: "基于 SysSocket UDP、用 Structured Text 编写的 CODESYS 库，无需其他库和配置工具，即可把 PLC 的值以 OPC UA PubSub (UADP) 发布出去。"
---

HotLoop Transmitter 通过一个放进 CODESYS 工程的库，按 OPC UA 规范第 14 部分规定的方式，把 PLC 的值以 OPC UA PubSub 发到网络上。它是仪表回路意义上的变送器：把过程值放到线路上，让别的设备来读取。

它用 Structured Text 写成，建立在 `SysSocket` UDP 之上，不需要其他库、额外许可或配置工具。添加这个库，每个周期调用一次功能块，每到一个发布间隔，就有一条 UADP NetworkMessage 发往单播地址或组播组。

对你来说意味着：没有 PubSub 库的 PLC，只需几行 Structured Text，就能给所有订阅 OPC UA PubSub 的对象供数，包括 HotLoop 本身。每条消息都带有来自 PLC 时钟的时间戳，除非你用 `bTimestamp` 把它关掉。

## 为什么是 Structured Text 而不是 Go

HotLoop 的每一个新工具都用 Go 编写，除非有真正的理由。这就是真正的理由：它必须在 PLC 自己的扫描中运行，在 IEC 61131-3 运行时里，作为程序员在工程中引用的库。CODESYS 运行时执行的是 Structured Text，不是 Go。库周围的测试和工具（抓包工具、校验工具）是 Go 写的。

## 如何使用

1. 把 `HotLoopTransmitter-1.1.0.library` 安装到 CODESYS 库仓库（Tools、Library Repository、Install），或用 CODESYS Installer 安装 `HotLoopTransmitter-1.1.0.package`，然后把它添加到工程的 Library Manager。[安装页面](/zh-hans/transmitter/install/)有下载和详细说明。
2. 声明一个发布器，在启动时一次性添加要发布的变量，然后每个周期调用它：

```iecst
PROGRAM PLC_PRG
VAR
    pub : HLTX.FB_HLTX_Publisher;
    bInit : BOOL;
END_VAR

IF NOT bInit THEN
    bInit := TRUE;
    pub.sDestination := '239.0.0.22';        // a unicast host or a multicast group
    pub.uiPort := 4840;
    pub.uiPublisherId := 1;
    pub.uiWriterGroupId := 1;
    pub.uiDataSetWriterId := 1;
    pub.tPublishingInterval := T#100MS;
    pub.AddReal(ADR(GVL.rTemperature));
    pub.AddBool(ADR(GVL.bRunning));
    pub.AddArray(ADR(GVL.aValues), HLTX.E_HLTX_Type.REAL_T, 250);
END_IF
pub.bEnable := TRUE;
pub();
```

[API 页面](/zh-hans/transmitter/api/)列出每一个输入、输出和方法。[线路格式页面](/zh-hans/transmitter/wire-format/)逐字节说明数据包，并给出定义每个字节的规范章节。

## 它会对你的扫描做什么，不会做什么

* 它从不阻塞。套接字是非阻塞的，消息在固定缓冲区中构建。
* 一次调用的开销就是构建一条消息的开销，并且只在有消息发出的周期里产生。在 20 ms 任务上、两个发布器并开启时间戳的情况下测得：每个周期平均增加约 9.6 us，发送周期为 10 到 100 us，运行期间最长的周期为 81 us。繁忙的主机曾把一次发送拉长到数毫秒。实测数据及其局限见[时序页面](/zh-hans/transmitter/timing/)。
* 套接字错误、地址错误或字段列表过大，都不会让应用出现故障。功能块会报告 `eState` 和 `eError`，对失败计数，程序继续扫描。
* 它不分片。一条消息最多 1472 字节。字段列表放不下时，功能块进入 `ConfigError`，什么也不发送。

## 测试环境

CODESYS Control for Linux SL 4.22.0.0 运行时，以及裸机 (2026-11-17)。运行了什么、回读了什么，见[时序页面](/zh-hans/transmitter/timing/)和[验证页面](/zh-hans/transmitter/proof/)。

要在工厂里使用？[在企业中使用 HotLoop](/zh-hans/business/)介绍了许可以及如何联系我们。

## 许可

HotLoop Source License Agreement 1.0，与每一个 HotLoop 产品相同。可免费使用，源代码可查看，但不是 OSI 定义的开源。第 5 条允许你把这个库构建进自己的 PLC 工程，并交付或销售编译后的成果，但不能交付或销售库本身。全文见[许可页面](https://hotloop.io/license/)。
