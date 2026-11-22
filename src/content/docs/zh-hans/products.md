---
title: "HotLoop 产品：五条线八款产品"
description: "五条发布线上的八款产品：核心各产品包含什么、使用哪种数据库、如何安装，以及如何把站点升级到更高一级的产品。"
---

HotLoop 是面向工厂现场的八款产品：四款随站点一起成长（IoT、Edge、Gateway 和 Edge Relay），另有负责逻辑编排的 Flow、负责工作流的 Cascade、为 PLC 自带画面而做的 HotLoop for CODESYS，以及把 PLC 数值送上网络的 Transmitter。

它们按五条发布线发布。**HotLoop core** 是 IoT、Edge、Gateway 和 Edge Relay：四款产品，一套代码，一个标签。每次核心发布都会同时推出这四款，版本号相同，各自有独立的镜像、Helm 图表和 Podman Quadlet 单元。选适合设备的那一款即可。每款产品都支持 HotLoop 的全部协议，所以您不必为了读取工作台上的 PLC 而升级产品。区分它们的是功能，不是协议。

**Flow**、**Cascade**、**HotLoop for CODESYS** 和 **Transmitter** 各有独立的发布线和版本，因此 Flow 的发布不会带动核心，反过来也一样。表格下面的内容都是关于核心的。八款产品各自的入口如下：

| 产品 | 发布线 | 文档 | 安装 | 发布说明 | 路线图 |
|---|---|---|---|---|---|
| **HotLoop IoT** | HotLoop core | <a href="/zh-hans/iot/overview/">文档</a> | <a href="/zh-hans/iot/install/">安装</a> | <a href="/zh-hans/releases/#hotloop-core">说明</a> | <a href="/zh-hans/roadmap/">路线图</a> |
| **HotLoop Edge** | HotLoop core | <a href="/zh-hans/edge/overview/">文档</a> | <a href="/zh-hans/edge/install/">安装</a> | <a href="/zh-hans/releases/#hotloop-core">说明</a> | <a href="/zh-hans/roadmap/">路线图</a> |
| **HotLoop Gateway** | HotLoop core | <a href="/zh-hans/gateway/overview/">文档</a> | <a href="/zh-hans/gateway/install/">安装</a> | <a href="/zh-hans/releases/#hotloop-core">说明</a> | <a href="/zh-hans/roadmap/">路线图</a> |
| **HotLoop Edge Relay** | HotLoop core | <a href="/zh-hans/edge-relay/overview/">文档</a> | <a href="/zh-hans/edge-relay/install/">安装</a> | <a href="/zh-hans/releases/#hotloop-core">说明</a> | <a href="/zh-hans/roadmap/">路线图</a> |
| **HotLoop Flow** | Flow | <a href="/zh-hans/flow/overview/">文档</a> | <a href="/zh-hans/flow/install/">安装</a> | <a href="/zh-hans/releases/#hotloop-flow">说明</a> | <a href="/zh-hans/flow/roadmap/">路线图</a> |
| **HotLoop Cascade** | Cascade | <a href="/zh-hans/cascade/overview/">文档</a> | <a href="/zh-hans/cascade/running/">安装</a> | <a href="/zh-hans/releases/#hotloop-cascade">说明</a> | <a href="/zh-hans/cascade/roadmap/">路线图</a> |
| **HotLoop for CODESYS** | HotLoop for CODESYS | <a href="/zh-hans/codesys/overview/">文档</a> | <a href="/zh-hans/codesys/install/">安装</a> | <a href="/zh-hans/releases/codesys-0-3-8/">说明</a> | <a href="/zh-hans/codesys/roadmap/">路线图</a> |
| **HotLoop Transmitter** | Transmitter | <a href="/zh-hans/transmitter/overview/">文档</a> | <a href="/zh-hans/transmitter/install/">安装</a> | <a href="/zh-hans/releases/transmitter-1-1-0/">说明</a> | <a href="/zh-hans/transmitter/roadmap/">路线图</a> |

下表对比核心的四款产品。

| <span class="sr-only">详情</span> | HotLoop IoT | HotLoop Edge | HotLoop Gateway | HotLoop Edge Relay |
|---|---|---|---|---|
| 适用场景 | 自动化的基础。一台 Pi、一台 NUC、柜子里的一个盒子 | 机器旁的盒子，上行链路断了也照常运行 | 站点的大脑 | 轮询、转发、扛住故障。没有数据库，没有界面 |
| 实体、自动化、辅助项、脚本、配方、蓝图、仪表板、日志簿、通知、MCP、带发现功能的 MQTT、ISA-18.2 报警、备份和所有驱动 | 是 | 是 | 是 | 仅驱动 |
| OPC UA 服务器、带存储转发的 Sparkplug 边缘发布 | | 是 | 是 | 仅发布 |
| 设备群、多站点、定时报表 | | | 是 | |
| 镜像 | `ghcr.io/hotloop-io/hotloop-iot` | `ghcr.io/hotloop-io/hotloop-edge` | `ghcr.io/hotloop-io/hotloop` | `ghcr.io/hotloop-io/hotloop-edge-relay` |
| 图表 | `hotloop-iot` | `hotloop-edge` | `hotloop` | `hotloop-edge-relay` |
| Quadlet 单元 | `deploy/quadlet/iot/` | `deploy/quadlet/edge/` | `deploy/quadlet/gateway/` | `deploy/quadlet/edge-relay.container` |
| SQLite 上的 Quadlet 单元 | `deploy/quadlet/iot/sqlite/` | `deploy/quadlet/edge/sqlite/` | `deploy/quadlet/gateway/sqlite/` | 无 |
| 图表中的 `database.type` | `postgresql`（默认）、`sqlite` | `timescaledb`（默认）、`postgresql`、`sqlite` | `timescaledb`（默认）、`postgresql`、`sqlite` | 无 |
| 架构 | amd64, arm64, arm/v7 | amd64, arm64, arm/v7 | amd64, arm64 | amd64, arm64, arm/v7 |
| 图表和 Quadlet 运行的数据库 | PostgreSQL 17 | TimescaleDB | TimescaleDB | 无 |
| 默认保留的历史 | 30 天 | 90 天 | 90 天 | 无 |
| 二进制文件可运行的数据库 | SQLite 或 Postgres | SQLite、Postgres 或 TimescaleDB | SQLite、Postgres 或 TimescaleDB | 无 |

数据库是一项设置，不是一个镜像：`HOTLOOP_DB_TYPE=sqlite` 和 `HOTLOOP_DB_PATH` 可以让三款产品中的任何一款运行在一个 SQLite 文件上，完全不需要数据库容器（DEPLOYMENT.md,“SQLite”）。图表用 `database.type` 接受同样的选择，Quadlet 单元则用 `sqlite/` 目录，每款产品只提供上表中的数据库：向 IoT 图表要求 `timescaledb` 会使安装失败。从一种数据库换到另一种，需要备份再恢复（BACKUP.md）。

Gateway 在 4.17.0 之前一直沿用发布时的名称：镜像 `ghcr.io/hotloop-io/hotloop`，图表 `hotloop`。正在使用它的人什么都不用改。

## 产品里有什么，二进制文件里就有什么

产品是一次构建，不是一项设置。`-tags hotloop_iot` 构建 IoT,`-tags hotloop_edge` 构建 Edge，不加标签则构建 Gateway。产品没有的功能不是被关掉了，而是根本不存在：OPC UA 服务器压根不在 IoT 镜像里，所以任何环境变量、values 文件或意外都无法把它打开。

因此，较小的产品会如实说明自己没有什么，而不是假装有：

- **API** 在每款产品中都保留所有路由。对于该产品没有的功能，路由返回 `404` 并指出具备该功能的产品：`{"error":"scheduled reports are part of HotLoop Gateway; this is HotLoop IoT","product":"iot","feature":"reports"}`。`GET /api/status` 会给出 `product` 和 `features`，脚本直接询问即可，不必试探。
- IoT 或 Edge 上的 **Gateway 专属设置**（例如从旧 values 文件带过来的 `HOTLOOP_REPORTS_ENABLED=true`）会在启动时和设置界面发出警告，HotLoop 照常运行。HotLoop 不会因为一份无法生成的报表而让工厂停摆，警告则确保有人看到。
- **图表**里根本没有这项设置。`charts/hotloop-iot` 没有 `reports`、`opcuaServer` 或 `edgePublish` 块，`hotloop-edge` 没有 `reports`。即使您还是设置了，也不会生成任何内容。
- **`hotloop --product`** 会输出 `iot`、`edge` 或 `gateway`。`--version` 仍然只输出版本号，因为脚本要解析它。

## 选哪一款

- **一台 Pi、智能插座、几个传感器、装满 Tasmota 和 Zigbee2MQTT 的 MQTT 代理，或工作台上的一台 PLC：** IoT。它的镜像最小（arm 上约 29 MB），而普通 PostgreSQL 的镜像只有 TimescaleDB 的六分之一，这在 SD 卡上是关键的数字。
- **固定在产线旁的盒子，通过 OPC UA 向 SCADA 供数，或通过 Sparkplug 向上发布，并能扛过上行链路中断：** Edge。
- **整个站点：每条产线、按计划邮件发送的报表、上报数据的边缘中继、一块屏幕上看多个站点：** Gateway。
- **只需轮询和转发、没有数据库要维护的盒子：** Edge Relay。参见 [Edge Relay 参考](/zh-hans/edge-relay/reference/)。

## 大小

镜像是二进制文件加上约 3 MB 的基础层。

| <span class="sr-only">详情</span> | amd64 镜像 / 二进制 | arm64 镜像 / 二进制 | arm/v7 镜像 / 二进制 |
|---|---|---|---|
| IoT | 31.2 / 28.0 MB | 29.1 / 26.0 MB | 29.2 / 26.0 MB |
| Edge | 36.5 / 33.3 MB | 34.2 / 31.0 MB | 34.3 / 31.1 MB |
| Gateway | 37.1 / 33.9 MB | 34.8 / 31.6 MB | 不构建 |
| Edge Relay | 15.7 / 12.5 MB | 14.9 / 11.7 MB | 15.1 / 11.9 MB |

这些是磁盘上的大小。没有设备时，HotLoop 的 RSS 约 10 MB，PostgreSQL 约 12 MB，这是下限，不是实际数值：产品在轮询设备时用多少，取决于设备。

## 安装

### Helm

一个仓库，四个图表都在里面：

```sh
helm repo add hotloop https://hotloop.io/hotloop/

helm install hotloop hotloop/hotloop-iot  --namespace hotloop --create-namespace
helm install hotloop hotloop/hotloop-edge --namespace hotloop --create-namespace
helm install hotloop hotloop/hotloop      --namespace hotloop --create-namespace
```

无论是哪款产品，都把发行版本命名为 `hotloop`。数据库的卷、Secret 和 Service 都以发行版本名命名，保持这个名字，站点日后才能升级到更高一级的产品（见下文）。

在 EmberNet 上，每款产品都是 App Store 里单独的一张卡片：“HotLoop IoT”“HotLoop Edge”“HotLoop Gateway”和“HotLoop Edge Relay”。从商店部署时，仪表板的租户标签会写入图表生成的所有资源，Running Apps 将它们显示为 `HotLoop-IoT`、`HotLoop-Edge`、`HotLoop-Gateway` 和 `HotLoop-Edge-Relay`。

### Podman Quadlet

适用于不在集群里的设备。`deploy/quadlet/` 下每个产品目录有五个单元：`hotloop.network`、`hotloop.container`（应用）、`hotloop-db.container`（它的数据库，与其图表运行的镜像和版本相同）、`hotloop-db.volume` 和 `hotloop-data.volume`。安装步骤写在每个 `hotloop.container` 的头部，其余内容见 [Podman Quadlet](/zh-hans/install/quadlet/)。

需要 Podman 5.0 或更高版本。Raspberry Pi OS Bookworm 自带 4.3，完全没有 Quadlet，所以 Pi 需要 Raspberry Pi OS Trixie 或更新的系统。应用跟随 `:stable`，由 Podman 的自动更新推动，数据库则保持固定：[Quadlet 的 README](/zh-hans/install/auto-update/) 说明了方法和原因。无论怎样安装，都请把数据库放在 USB SSD 上，而不是 SD 卡上。历史每天整天都在写入，SD 卡正是因此损坏的。

## 把站点升级到更高一级的产品

从 IoT 到 Edge 再到 Gateway，每台设备、变量、实体、自动化、报警、用户和每一小时的历史都会保留。每款产品都会运行所有迁移，所以三者的数据库结构相同，更高一级的产品启动时其额外功能是空的。

- **Quadlet：** 各产品目录里的单元名称、卷和密钥都相同。把更高一级产品的 `hotloop.container` 和 `hotloop-db.container` 复制覆盖到您的文件上，运行 `systemctl daemon-reload`，然后重启。
- **Helm：** 在同一个发行版本上运行 `helm upgrade hotloop hotloop/hotloop-edge`（或 `hotloop/hotloop`）。三个图表用相同的标签选择 pod，并以相同方式命名数据库的 StatefulSet 和卷，所以升级是允许的，卷也保持绑定。

先做一次备份（`POST /api/backup`，参见[备份与恢复](/zh-hans/iot/backup/)），并把它复制到设备之外。这次升级已在 Quadlet 上跑过：在同一个数据库卷上从 IoT 到 Edge 再到 Gateway，每一步都有同一台设备在线；也跑过让 IoT 的 PostgreSQL 目录在 Gateway 的 TimescaleDB 镜像下启动的情形；并在真实集群上以 `helm upgrade` 的方式跑过。如果 IoT 的普通目录里没有 TimescaleDB 扩展，升级后历史会留在原生分区里，要改成 hypertable 就需要备份，再恢复到全新的 TimescaleDB。降回较小的产品，不是在您在意的设备上该做的事。

## 如何发布

一个 `v` 标签发布全部四款，所以 IoT、Edge、Gateway 和 Edge Relay 始终是同一个版本。在构建任何东西之前，会检查每个图表的版本和镜像与标签一致，每个 Quadlet 应用单元都跟随 `:stable` 并带健康检查，每个数据库单元都与其图表一致且绝不自动更新。IoT 和 Edge 的图表由 Gateway 的图表生成，所以对其中一个的修复会同步到三个。
