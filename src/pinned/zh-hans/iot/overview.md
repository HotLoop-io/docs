---
title: "HotLoop IoT 概览"
description: "HotLoop IoT 是自动化的基础：实体、自动化、仪表板、报警、MQTT 发现和全部协议驱动，用 Go 构建，运行在 SQLite 或 PostgreSQL 上。"
sidebar:
  label: "概览"
---

:::note[IoT 已发布，首个版本是 4.18.10]
镜像是 `ghcr.io/hotloop-io/hotloop-iot:{{hotloop}}`，为 amd64、arm64 和 arm/v7 构建，amd64 上约 31 MB，Pi 上约 29 MB，图表是来自 `https://hotloop.io/hotloop` 的 `hotloop-iot`。两者都无需登录即可拉取。Quadlet 单元在 [Podman Quadlet](/zh-hans/install/quadlet/) 的 `iot/` 目录中。[安装它](/zh-hans/iot/install/)。本节的页面会说明每项功能是对照什么运行过的，如果某一页跟随的是 `main` 而不是发布版本，也会说明。
:::

IoT 是 Edge 和 Gateway 所构建的基础。如果你面前的盒子是一块 Pi、柜子里的 NUC、一排智能插座和传感器，或者工作台上的一台 PLC，就选它。它是三个完整产品中最小的镜像，却带着让 HotLoop 有用的一切：实体、规则、报警，以及什么都绕不过的那一个写入关口。

更大的产品从不会拿走它的任何东西。[Edge](/zh-hans/edge/overview/) 是 IoT 加上机器层。[Gateway](/zh-hans/gateway/overview/) 是 Edge 加上站点层。这些页面上的一切，两者都有。

## IoT 有什么

- **实体和设备树。** 每个变量都有一个永不改变 ID 的实体，挂在同一棵 ISA-95 树上。[实体](/zh-hans/iot/entities/)、[设备树](/zh-hans/iot/equipment/)。
- **自动化、蓝图、脚本和配方。** 保存时编译的规则、命名的序列，以及经过写入关口的设定值集。[自动化](/zh-hans/iot/automations/)、[蓝图](/zh-hans/iot/blueprints/)、[脚本](/zh-hans/iot/scripts/)、[配方](/zh-hans/iot/recipes/)。
- **辅助项、日志簿和太阳。** 属于你们自己人的数值、对发生的一切的统一时间线，以及在盒子上算出的日出时间。[辅助项](/zh-hans/iot/helpers/)、[日志簿](/zh-hans/iot/logbook/)、[太阳](/zh-hans/iot/sun/)。
- **仪表板、通知和 MCP。** 按角色搭建的画面、会呼叫手机的报警，以及一个能读取工厂、只能操作你启用过的内容的代理。[仪表板](/zh-hans/iot/dashboards/)、[通知](/zh-hans/iot/notifications/)、[MCP](/zh-hans/iot/mcp/)。
- **全部协议驱动（包括按符号名访问的 CODESYS 运行时，以及基于 UADP 的 OPC UA PubSub）、带发现功能的 MQTT 和内嵌代理。** [协议](/zh-hans/iot/protocols/)、[代理](/zh-hans/iot/broker/)、[MQTT 发现](/zh-hans/iot/mqtt-discovery/)、[网络发现](/zh-hans/iot/network-discovery/)。
- **UniFi，在你启用命令之前只读，** 以及 **把历史写出到你自己的数据库或 Kafka 代理。** UniFi 读取网络，而少数属于命令的点（定位 LED、重启、PoE 断电重启、开关一个无线网络、封锁一个客户端）在有人把该变量标为可写之前什么都不做。[UniFi](/zh-hans/iot/unifi/)、[历史数据库目标](/zh-hans/iot/historian-targets/)。
- **天气、能源、可随身携带的画面，以及另外十三种语言。** 屋顶气象站就是一个实体。电表是一个按已用能源读取的变量，按 15 分钟分段保存，并带电价和需量电费。仪表板可以导出为文件，再导入另一套安装，CODESYS 可视化可以作为画面导入。网页界面支持英语和另外十三种语言。[能源](/zh-hans/iot/energy/)、[天气](/zh-hans/iot/weather/)、[画面文件](/zh-hans/iot/screen-file/)、[CODESYS 画面](/zh-hans/iot/codesys-screen-import/)、[语言](/zh-hans/iot/languages/)。
- **用户、备份，以及只增不减的迁移。** [认证](/zh-hans/iot/authentication/)、[备份](/zh-hans/iot/backup/)、[迁移](/zh-hans/iot/migrations/)和 [HTTP API](/zh-hans/iot/api/)。

[写入关口](/zh-hans/gateway/write-gate/)是真正的工厂看到这些内容之前必须读的一页。它适用于每个产品。

## 它没有什么

没有 OPC UA 服务器，没有带存储转发的 Sparkplug 发布，没有设备群，没有多站点，也没有定时报表。在 IoT 中它们不是被关掉了，而是根本不在二进制文件里，所以任何环境变量和任何倒霉的日子都无法把它们打开。API 仍然保留所有路由，对 IoT 没有的功能，路由会返回 `404` 并指出拥有该功能的产品。

## 数据库

SQLite 或 PostgreSQL。图表和 Quadlet 单元默认运行 PostgreSQL 17，保留 30 天历史，`HOTLOOP_DB_TYPE=sqlite` 会把整个系统放到一个文件上，完全不需要数据库容器。在图表中是 `database.type`，向 IoT 图表要求 `timescaledb` 会让安装失败。换到另一种数据库就是备份再恢复。对照表见[产品系列](/zh-hans/products/)，恢复方法见[备份](/zh-hans/iot/backup/)。

## 安装

Helm 或 Podman Quadlet，与产品系列其余部分相同的两种方式，两者的命令都在 [IoT 安装页面](/zh-hans/iot/install/)。盒子跟随 `:stable` 并自行更新，更新无法启动时会发生什么，见[该页面](/zh-hans/install/auto-update/)。

在工厂里使用？[在企业中使用 HotLoop](/zh-hans/business/)介绍许可方式和联系我们的方法。
