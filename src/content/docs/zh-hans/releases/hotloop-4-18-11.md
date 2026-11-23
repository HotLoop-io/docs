---
title: "core 4.18.11 发布说明"
description: "HotLoop core 4.18.11 包含什么、升级时有哪些变化,以及动手处理一个正在运行的工厂之前应该先读什么。"
sidebar:
  label: "4.18.11"
---

从这个版本起,HotLoop 的数据库是 PostgreSQL 17,每个带有 PostgreSQL 16 数据的安装都会在下一次升级时自动迁移,你不用运行任何东西。这是 4.18.11 里你在动手处理正在运行的工厂之前唯一需要读的内容,因为它是数据库引擎的更换,需要磁盘空间,并且有一条回退路径不是普通的回滚。

完整说明在 README 里:4.18.11 的变化。

## PostgreSQL 17,以及随之而来的升级

- **变了什么。** chart 和 Quadlet 单元运行的数据库是 PostgreSQL 17:Edge 和 Gateway 在其上加 TimescaleDB 2.30.1,IoT 和 `database.type: postgresql` 用原生 PostgreSQL 17.11。SQLite 安装没有 PostgreSQL,不受影响。PostgreSQL 不会打开另一个主版本的数据目录,所以只换镜像会让每个现有设备盒带着一个无法启动的数据库。我们不愿意那样发布。
- **第一次启动时会发生什么。** 一个脚本 `hotloop-pg-upgrade.sh` 在数据库之前运行。在 chart 上,它是数据库 pod 上的两个 init container:旧镜像交出它的 PostgreSQL 16 安装,新镜像运行 `pg_upgrade`。在 Quadlet 上,它是 `hotloop-db-upgrade.container`,一个 `hotloop-db.container` 所依赖的 oneshot 单元。它以复制模式在旧目录旁的新目录里工作,先启动一次新服务器以证明它能打开,然后才交换名称。全新安装,或已经在 17 上的卷,什么也不做。
- **预计会有等待。** 数据库 pod 会在 `Init` 停留一份数据复制所需的时间,应用会等着它。日志在 chart 上是 `kubectl logs <release>-postgresql-0 -c pg-upgrade`,在 Quadlet 上是 `journalctl -u hotloop-db-upgrade`。
- **可用空间。** 它需要在数据旁边有大致等于数据大小的空闲空间,并在开始前检查。如果空间不够就停下,16 的数据完全保持原样,数据库不启动。
- **`pgdata.pg16` 会保留,删不删由你决定。** 旧目录被重命名为 `pgdata.pg16` 并留在卷上。它是升级时 PostgreSQL 16 数据库的完整内容,也就是备份和回退的路,大小与数据库相同。在你删除之前它一直都在。等设备盒在 17 上运行了你想要的那么久之后:

  ```sh
  # chart
  kubectl -n hotloop exec hotloop-postgresql-0 -c postgresql -- rm -rf /var/lib/postgresql/data/pgdata.pg16
  # Quadlet
  sudo rm -rf "$(sudo podman volume inspect hotloop-db --format '{{.Mountpoint}}')/pgdata.pg16"
  ```

- **失败会把你留在原处。** 如果交换之前出了任何问题,16 的数据不会被动,数据库也不会在一个只建了一半的目录上启动。在 chart 上 pod 停在 `Init:Error`,在 Quadlet 上升级单元失败,它后面的数据库单元永远不会启动。按日志所说修好后再启动。
- **`helm rollback` 到 4.18.10 不会启动它的数据库。** 这是需要注意的地方。回滚会把 chart 的数据库镜像换回 PostgreSQL 16,而 16 打不开 17 的目录。什么也不会丢,也没有改到一半,只是数据库不启动。要把它找回来,就要做[k3s 和 Helm 页面](/zh-hans/install/helm/#回退)里的交换:停止数据库,把 `pgdata` 移到 `pgdata.pg17`,把 `pgdata.pg16` 移到 `pgdata`。**这会丢掉升级之后在 17 上做的每一次写入**,因为 `pgdata.pg16` 是那一刻的数据库。能向前就向前。换回去只能用一次,而且只要还有 `pgdata.pg16` 挡着,下一次升级就拒绝运行。
- **Quadlet 设备盒不受影响。** Podman 的 auto-update 只回滚应用,从不回滚数据库,而 4.18.10 的应用可以正常读取 PostgreSQL 17 数据库,因为迁移只增不减。回滚了更新的 Quadlet 设备盒会继续运行。
- **无论如何先做个备份。** HotLoop 自己的备份由运行中的应用通过运行中的数据库生成,所以无法在数据库启动之前的那一步里完成。升级前在 4.18.10 上做一份,并复制到设备盒之外。把它恢复到 17 上就是普通的恢复。
- **关闭它。** `database.postgresql.upgrade.enabled: false` 会去掉 init container,而仍在 16 上的卷随后会让数据库无法启动。请保持开启。开启时,全新安装仍会在每个节点上拉取一次 PostgreSQL 16 镜像,因为 init container 的镜像在运行之前就会被拉取。

### API 变更

- **新路由:** `GET` 和 `PUT /api/notify/escalation`,以及 `GET /manifest.webmanifest` 和 `GET /sw.js`,它们不需要会话,因为手机在任何人登录之前就会请求它们。全都写在 docs/API.md 里。
- **集成路由:** `GET /api/integrations`(`devices.read`),以及 `POST /api/integrations/{id}/probe` 和 `/setup`(`devices.write`)。没有新权限。
- **两个新协议,** `snmp` 和 `bacnet`,出现在 `GET /api/protocols` 和 `no driver for protocol` 错误的列表中。HotLoop 现在会说十种协议。
- **Kiosk 与锁定路由:** `POST /api/auth/kiosk`(无会话)、`POST /api/auth/activity`、`PUT` 和 `DELETE /api/users/{username}/pin`,以及 `DELETE /api/users/{username}/lockout`,后两者都在 `users.manage` 之下。`GET /api/users` 会给出 `hasPin` 和 `locked`,绝不给出代码。登录路由对被锁定的账户回答 `429` 并带 `Retry-After`。Kiosk 会话会报告 `idleSec`。新设置有 `ui.kioskIdleSeconds`、`ui.lockoutAttempts`、`ui.lockoutSeconds` 和 `ui.panelDelaySeconds`。
- **新权限:** `notify.escalation`,仅限管理员。viewer 和 operator 角色没有得到它。
- **报警轨迹有两种新的事件类型,** `escalated` 和 `escalation-ended`,其中 `actor` 为 `escalation`。读取报警历史并假定旧列表的脚本会遇到它们。
- `GET /api/stream` 在它的会话结束时关闭,历史返回的每个时间都是 UTC。这两项都在“还有什么”里。

### 从 4.18.10 升级

- **Chart:** `helm upgrade <release> hotloop/hotloop --version 4.18.11 --reset-then-reuse-values`,`hotloop-edge` 和 `hotloop-iot` 也一样。数据库 pod 先运行升级,如上所述。
- **Quadlet:** 把新的 `hotloop-db.container`、`hotloop-db-upgrade.container` 和 `hotloop-db-upgrade.sh` 从你产品在 `deploy/quadlet/` 下的目录复制到单元目录,运行 `systemctl daemon-reload`,然后重启 `hotloop-db.service`。数据库单元依赖升级单元,所以只拿到新数据库单元的设备盒不会在 16 的数据上启动,并会说明原因。只有卷需要时才会拉取 PostgreSQL 16 镜像。
- **一个新迁移,`0025_kiosk_pin`,** 适用于 PostgreSQL 和 SQLite。它只增加列(PIN 哈希、会话的空闲上限和锁定计数器),全都有默认值,所以 4.18.10 可以在它留下的 schema 上运行。照旧先做 `pg_dump`。
- **Edge Relay:** 没有数据库,也没有要做的事。它以 4.18.11 发布,因为每个产品都步调一致地发布。

### 还有什么

- **集成:把 HotLoop 指向一台你知道地址的设备。** 每种设备都走同一个流程:询问这个集成需要什么,用答案去查看真实设备,保留你要的点,而它创建的任何东西都不会被启用。设置创建的每个 tag 都是只读的,中途失败的设置不会留下设备。OPC UA 率先走这条路。为什么重要:新种类的设备过去需要自己的画面,以及对设置该做什么的自己一套理解,现在添加一种设备还是同样的三个步骤。[集成](/zh-hans/iot/integrations/)。
- HotLoop 从不发送 SET,因为 SET 可以改变交换机。没有默认的 community,因为 `public` 正是工厂的交换机被任何询问者读取的方式。community 和 v3 口令短语与其他设备机密一样加密保存。测试中已在 v3 的每个安全级别上针对 SNMP 代理验证。
- **BACnet/IP,只读。** IP 网络上的楼宇控制器和电表:对象、单位和状态标志,路由器后面的设备会被报告为不可达,而不是悄悄缺失。HotLoop 从不写 BACnet 属性,因为写入会落到 priority array 上,而遗留设置的优先级会把设备停在被放置的位置。
- **Kiosk 登录,以及默认开启的锁定。** 在 `/?screen=<name>` 打开的面板只要求一个字段,一个 PIN 或键盘式刷卡器输入的内容,通过关口的每次写入都属于那个人,所以审计轨迹会说是谁打开了阀门,而不是“panel-3”。放着不管 15 分钟,它会在页面和服务器上都注销,这样卡死的页面就不会让一个名字一直处于登录状态。管理员在 Settings、Users 里或通过 API 为每个账户设置一个代码。代码和密码一样用 bcrypt,至少六个字符,一个代码只开一个账户。在你自己的电脑上什么都不变:你已登录,写入直接通过。**需要了解的行为变化:** 错误的密码和 PIN 现在会在连续 10 次后把那个账户锁定 5 分钟,管理员可以解锁。这对每个安装都是开启的,包括从不使用 kiosk 的安装。重试错误密码超过十次的脚本会开始收到 `429`。设置 `HOTLOOP_AUTH_LOCKOUT_ATTEMPTS=0` 可以不锁定。单独输入的错误代码不会锁定任何账户,所以不能用它来锁住整个面板;面板每失败一次多等半秒,最多 3 秒,并且从不被锁定。尚未实现:从不是键盘的读卡器读取刷卡。[认证与用户](/zh-hans/iot/authentication/#自助终端面板pin-或工牌以及空闲退出)。
- **报警升级。** 没有人确认的报警现在会转给下一个人。管理员在 Settings 里编辑策略:有 ntfy topic 或自己地址的人、说明多少分钟后通知谁的步骤,以及重复。从任何地方确认都会让它停止,因为升级器在每次发送之前都会询问报警引擎,每个步骤和每次停止都是报警自己轨迹里的一行,所以 logbook 里有它。链条中途重启,会从审计行记录已发出的地方继续。它在你打开之前是关闭的,需要 `HOTLOOP_NOTIFY_ENABLED`,并且只能使用你的部署已有的通道。为什么重要:以前,发到床头手机上的一条通知就是全部。
- **界面可以安装到手机上,没有连接也能打开。** HotLoop 提供 manifest、图标和 service worker。手机保存页面和人们查看的读数的最后一次回答,底部的一条栏会告诉你它是几点的数据,每次写入在离开页面之前就会被拒绝:worker 从不回答、保存或排队任何写入。注销会清空手机保存的内容。它只能在 https 或 `localhost` 上运行,所以使用普通 http 的工厂得到的界面和以前一样。为什么重要:Wi-Fi 恰好在你需要的那个地方掉线时,一个说自己是旧的旧页面,强过一个空白页面。[仪表板](/zh-hans/iot/dashboards/#在手机上)。
- **会话结束时,实时推送也会停止。** `GET /api/stream` 只在打开时检查一次会话,而 stream 会开几个小时,所以在注销、过期、会话被撤销或账户被停用之后,它仍会继续发送工厂的实时数据。现在它每五秒检查一次,会话不在了就关闭,并且不把这次检查算作会话被使用,所以留在墙上的屏幕仍会进入空闲。没有路由、字段或权限发生变化。
- **历史返回的每个时间都用 UTC 书写。** 历史曾把某些时间按设备盒自己的时区返回(在 SQLite 上是读数本身),所以同一条趋势在设为纽约的工厂里写成 `-04:00`,在设为 UTC 的工厂里写成 `Z`。这涵盖区间的边缘、原始读数、tag 的最新值、窗口之前它所保持的值、诊断页上最早和最新的时间,以及窗口的 `from` 和 `to`。每一个都是一个时刻,两种写法是同一时刻,所以比较时间的脚本看不到变化。比较字符串的脚本会看到偏移量变成 `Z`。
- **重新连接的节点只报到一次。** 当 edge 节点恢复连接时,重连一方和节点的发送方可能各自发现会话尚未诞生,各自发布一个 NBIRTH,相差一毫秒,bdSeq 相同,第二个没有任何新内容。如果节点恰好在那时被停止,第二个会落在它的 NDEATH 之后,主机就会看到一个已停止的节点再次报到。现在发送方只在会话没有 birth 或有 tag 需要宣告时才发布 birth。Edge Relay 里也有。没有 topic、字段或设置发生变化。
- **4.18.10 里写错的文档。** 四处链接和数量:Edge Relay 页面链接了一个从来不是标题的发现锚点,4.18.10 的说明链接了 4.18.4 的一个锚点,MCP 页面在二十七行的表格上方写着二十五个工具,而代码注册的是二十七个。README 和路线图说 IoT 和 Edge 会在下一个版本到来,而它们已经在 4.18.10 发布了。

- 耗时随你的数据量而定,所以第一次在大数据库上请留意日志。
