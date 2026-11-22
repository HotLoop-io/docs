---
title: "HotLoop for CODESYS 概览"
description: "与 CODESYS 运行时并排运行的 HotLoop：通过运行时自带的 OPC UA 服务器读取 CODESYS PLC 的画面和报警，无需在 CODESYS 中安装任何东西。"
sidebar:
  label: "概览"
editUrl: false
---

HotLoop for CODESYS 就是和 CODESYS 运行时运行在同一个节点上的 HotLoop。它通过运行时自带的 OPC UA 服务器读取 PLC 的变量，把它们放到能在面板电脑、手机或墙屏上使用的画面里，基于它们触发报警，并保存历史。CODESYS 中不安装任何东西，也没有任何东西写入 PLC。这就是你原本要在 CODESYS WebVisu 中搭建的画面，只是画在运行时之外。你得到的是：操作员无需向 PLC 下载就有画面，而 PLC 多了一双不依赖节点上任何其他东西的眼睛。

它是 HotLoop 八个产品之一，有自己的发布线。最新的 chart 是 0.3.8，发布于 2026-11-16。它下面是 HotLoop Edge，所以 [Edge 页面](/zh-hans/edge/overview/)上的内容在这里同样成立。

![Line 2 画面：四张数值卡片、一个仪表、十五分钟趋势和报警列表](/codesys/screen.png)
![同一画面，深色模式](/codesys/screen-dark.png)

这是一次真实运行：HotLoop 的默认界面读取 CODESYS Control for Linux SL 4.22.0.0 运行时。PLC 程序是 HotLoop 自己的演示程序，所以数字是演示的数字。标签（Line 2、Mixer temperature、Riverside Bottling）是虚构的，由[配置文件](/zh-hans/codesys/profile/)放上去。

## 三个部分

| 部分 | 是什么 | 位置 |
|---|---|---|
| Chart `hotloop-codesys` | 围绕 `hotloop-edge` 的封装，带有节点上运行时的默认值：SQLite、一个副本，并关闭 PLC 旁边不需要的部分。HotLoop chart 的每个修复都会到达这里。 | `https://hotloop.io/hotloop-codesys/` |
| Provisioner | 一个静态 Go 二进制文件，把配置文件应用到 HotLoop 并使其保持正确。它不保存任何配置文件。 | `ghcr.io/hotloop-io/hotloop-provision` |
| 配置文件 | 一个 JSON 文件：设备、要保留的变量、报警和一个画面。你提供的唯一输入。 | 安装命名空间中的一个 Secret，[在此说明](/zh-hans/codesys/profile/) |

## 它如何读取 PLC

CODESYS 为第三方读取控制器变量只记录了一种方式，那就是运行时自带的 OPC UA 服务器。PLC 通过 IDE 中的 Symbol Configuration 发布你想看的内容，HotLoop 按程序员起的名字读取这些变量，例如 `Application.GVL_Line.rTemp`，而不是按 node id。Symbol Configuration 是对 PLC 工程唯一的更改。CODESYS Gateway 的通道协议没有对第三方公开文档，这里也不使用它。

读取由 HotLoop core 的 CODESYS 连接器完成，它是 OPC UA 驱动，再加上 CODESYS PLC 额外需要的东西：发现应用导出的内容及其类型，把数组和结构展开成每个字段一个点，重启或下载之后无需人工干预的重连，以及把每个请求限制在运行时公布的限度内。[协议页面](/zh-hans/iot/protocols/)载有 HotLoop 4.19.4 起连接器的参考，并说明它针对什么做过验证、没有针对什么验证。

## 它自己会做什么

当 HotLoop 和节点自己的运行时都有响应后，provisioner 会设置配置文件中的设备、其变量、报警和画面。然后每五分钟再看一次。配置文件里 PLC 后来新增的变量会被加入。PLC 不再有的变量会连同服务器给出的原因读作坏值。画面和报警在缺失时创建，只有当配置文件的 `revision` 高于创建它们的那一版时才会被替换，所以人所做的修改会一直保留，直到有意发布更新的配置文件。

## 它不会做什么

- **它不会写入你的 PLC。** provisioner 设置的每个 tag 都是只读的，配置文件也没有把任何一个标记为可写。以后可以由人启用某个 tag，那时[写入闸门](/zh-hans/gateway/write-gate/)和 PLC 自身的符号权限都有发言权。
- **它不会往运行时里放任何东西。** 没有库，没有任务，没有代理。
- **它不需要数据库 Pod。** 使用节点自己存储上的 SQLite，一个副本。
- **它设计成在链路丢失时仍保留画面。** 两个 Pod 都能无时限地容忍节点不可达或未就绪，容忍设置就在 chart 里。[现状](/zh-hans/codesys/where-it-stands/)说明了在真实节点上运行过什么。

## 接下来去哪里

[安装它](/zh-hans/codesys/install/)，阅读[配置文件](/zh-hans/codesys/profile/)里有什么，或查看[现状](/zh-hans/codesys/where-it-stands/)和[路线图](/zh-hans/codesys/roadmap/)。要在工厂里使用？[在企业中使用 HotLoop](/zh-hans/business/)介绍了许可以及如何联系我们。
