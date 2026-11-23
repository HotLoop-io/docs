---
title: "core 4.18.10 发布说明"
description: "HotLoop core 4.18.10 包含什么、升级时有哪些变化,以及动手处理一个正在运行的工厂之前应该先读什么。"
sidebar:
  label: "4.18.10"
---

HotLoop 不再只是一个镜像的版本。IoT、Edge、Gateway 和 Edge Relay 都从这同一个标签发布,步调一致,各有自己的镜像和 chart。此外还有:通过 MQTT 自行报到的设备,写入工厂自己数据库的历史数据,由你选择的数据库(SQLite、Postgres 或 TimescaleDB),WAN 断了也能继续工作的 Edge,以及跟随 `:stable` 并在更新出问题时自动回滚的设备盒。从 4.17.0 升级时,Gateway 只需一次普通的 `helm upgrade`。动手处理正在运行的工厂之前,请先读下面的“从 4.17.0 升级”,因为有几个默认值变了。

没有 4.18.0、4.18.1、4.18.2、4.18.3、4.18.4、4.18.5、4.18.6、4.18.7 或 4.18.9 可以安装,4.18.8 也不是该运行的版本。其中九个标签什么也没有发布。4.18.8 在 ghcr.io 上留下了没有 chart 也没有 release 的镜像,并移动了 Gateway、Edge Relay 和 IoT 的 `:stable` 和 `:latest`,所以跟随 `:stable` 的设备盒在更新之前可能运行过 4.18.8。4.18.10 取代了它,并带有那些标签中的每一项修复。被发现设备的值可能被打上比它自己的“还没有数据”读数更早的时间戳,缓存会把它丢掉。仪表板不再重绘没有变化的仪表。HotLoop 内置的 broker 曾在监听者订阅的包 id 与它正发给同一客户端的某条消息的包 id 相同时拒绝这个订阅,于是该订阅背后的设备永远不会被发现;而一个客户端用与 broker 仍欠它的某条 QoS 1 或 2 消息相同的包 id 发布时,会让 broker 丢掉自己的那条消息,重连后也不再重发。现在 broker 把两个方向放在各自的表里,拒绝订阅的 broker 会在日志里说明。仍在加载的仪表板不再把自己的地址写到用户刚刚跳转到的地址上。如果你的手机用 HotLoop 发布时所用地址的密码登录 ntfy,请也给那个用户一个 tier。4.18.10 是 4.18.0 本来要成为的一切,再加上 4.18.3 打标签之后发生的变化。

完整说明在 README 里:4.18.10 的变化。

## 简要说明

- 同样的四个镜像,同样的标签,同样的架构。
- **4.18.4 打标签以来。** 被发现设备的值可能被它自己的“还没有数据”读数盖住而丢失,现在不会了。描述读取失败的 UPnP 设备会在几秒内重新读取,而不是 15 分钟之后。卡片编辑器里的 OK 第一次点击就生效,实体抽屉里的 Save 保持原位,仪表板不再重绘没有变化的内容,被两个进程反复猛击的计数器也不再拒绝总是输的那一个。
- **许可证变了。** 四个产品现在都使用 HotLoop 的 Business Source License 1.1。家庭和实验室使用免费,学校、非营利组织和政府使用也免费,企业使用通过 EmberNet 办理。每个版本在首次发布四年后转为 GPL-3.0 或更高版本。在那之前它不是开源软件,我也不会假装它是。把它放进工厂之前,请先读 LICENSE。
- **4.18.3 打标签以来。** 墙面看板和手机上的 UniFi:网络图可以缩放和双指捏合,WAN 延迟和端口流量有了曲线,一个按钮就能建好常用的报警。代理可以通过 MCP 请求网络的拓扑图(`get_network_topology`)和控制台刚刚报告的内容(`get_network_events`)。logbook 把 UniFi 事件显示在相关交换机下面。一台 MQTT 设备可能得到两个相同 id 的客户端,broker 会轮流把它们踢掉;已修复。报警消息打印数值的方式与数值卡片一致,报警卡片可以指向设备或设备组,而一个保持不变的 tag 的趋势图是一条横穿窗口的线。
- **四个产品,四个镜像,四个 chart,一个标签。** `hotloop-iot` 和 `hotloop-edge` 在 ghcr.io 和 chart 仓库里是新的。Gateway 仍使用 `ghcr.io/hotloop-io/hotloop` 和 chart `hotloop`,所以正在运行它的人什么都不用改。产品是一次构建,不是一个设置:IoT 镜像里的 OPC UA 服务器不是被关掉了,而是根本不在里面。参见[产品页面](/zh-hans/products/)。
- **MQTT 发现。** 把 ESPHome、Zigbee2MQTT、Tasmota 或 Shelly 指向 broker,它就会出现,并且已经在读数。在管理员接受它并手动启用每个点之前,它不能下达任何命令。网络发现(mDNS、SSDP、DHCP)只监听,除非你列出一个要探测的网络,否则不会发送任何东西。
- **Historian 目标。** HotLoop 保存的每个读数也会写入工厂自己的 PostgreSQL、TimescaleDB、SQL Server、InfluxDB 或 MySQL/MariaDB,行相同,质量相同。
- **数据库是一个设置。** 每个产品可以选 SQLite、PostgreSQL 或 TimescaleDB,用的是同一个二进制。Pi 不需要 300 MB 的数据库镜像。
- **WAN 断了,Edge 也让工厂继续运转**,它的存储转发队列能撑过糟糕的情况:停机期间启动、没有复位就断掉的链路、必须追上工厂速度的回放。
- **每个设备盒都跟随 `:stable` 并自行更新**,无法启动的版本会回滚。迁移只增不减,应用会拒绝在比自己领先两个版本的 schema 上启动,所以这种回滚总是安全的。
- **Edge Relay** 可以即时应用推送的配置,不用重启,也不会丢失 Sparkplug 会话,并像 Gateway 一样发现 broker 上的设备。
- **每个镜像都带有所有第三方许可证**,GPL 模块会让构建停止。
- **太阳。** 日出、日落和太阳高度,根据纬度和经度在设备盒上算出。

### API 变更

- 新路由:`/api/discovery`、`/api/network-discovery`、`/api/mqtt/brokers`、`/api/broker/logins`、`/api/historian/targets`、`GET /api/entities/{entity_id}/image` 和 `POST /api/fleet/{id}/update`。全都写在 docs/API.md 里。
- `GET /api/status` 会给出 `product`、`features` 和镜像 digest。你正在交谈的产品所没有的功能,其路由不会假装有,而是回答 `404` 并指出哪个产品有它。每个路由仍然存在于每个产品中。
- 新权限 `fleet.update`,仅限管理员。operator 角色没有变化。

### 从 4.17.0 升级

- `helm upgrade <release> hotloop/hotloop --version 4.18.10 --reset-then-reuse-values`。我们把 4.17.0 和 4.18.10 的 Gateway chart 并排渲染过:同样的八个对象,同样的 selector,同样的 volume claim。这次单独的 `--reuse-values` 也能渲染,但它会重放 4.17.0 的值并丢掉每个新的默认值,所以请用 reset 的形式或你自己的 values 文件。
- 迁移 0016 到 0024 会在启动时运行(MQTT 发现、broker 登录、MQTT 源、historian 目标、网络发现结果、为 MQTT 源所说内容准备的另外两个、保存仪表板的表,以及 tag 上的一个 `no_data` 列,对每个已有的 tag 都为空)。全部是增量的。照旧先做 `pg_dump`。
- **`edgePublish.queueMaxBytes` 的默认值现在是 64 MiB,不再无限。** 超过后最旧的读数会被丢弃并计数。无限队列在长时间断网时会填满卷,那样更糟,但这确实是一个改变了的默认值:按你自己的读数速率来定大小(每个读数约 180 字节),或设为 `0` 以保持旧行为。用 `--reuse-values` 升级会保留你原有的值。
- **Broker 登录。** 你在 Settings、MQTT 里创建的登录带有来自 profile 的 topic 规则。来自 `HOTLOOP_BROKER_USERS` 的登录保持不动,并且和以前一样什么都能做。没有 `HOTLOOP_BROKER_USERS` 的 broker 现在也能启动,只有 HotLoop 和在其中创建的登录才能进入。
- 从现在起,应用还会统计它的数据库领先了多少,并在相差两个版本时点名拒绝,这样回滚就不会是一个意外。
- **Edge Relay:** 也请用 `--reset-then-reuse-values` 升级。Quadlet 用户请换用新的 `edge-relay.container`,它跟随 `:stable` 而不是固定在 4.17.0,同时使用能让坏更新回滚的 healthcheck。
- **IoT、Edge 和 Gateway 的 Quadlet 单元是新的。** 4.17.0 只有 relay 的。它们位于 `deploy/quadlet/` 下,每个产品一个目录。
