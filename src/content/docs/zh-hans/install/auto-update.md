---
title: "自动更新 :stable"
description: "每台设备都跟随 stable 标签，由 Podman 移动该标签。说明更新做什么、回滚无法撤销什么，以及如何在您批准之前暂缓更新。"
---

每台设备都跟随 `:stable`，由 Podman 负责更新。这是四个产品共同的规则，也是这里没有任何单元固定发布版本号的原因：固定在 `4.17.0` 的设备，和有人安装它的那天一样旧，没有人会为了改一个标签专程回到工厂现场。每个发布标签都会移动 `:stable`，单元不跟随它的发布会被拒绝。

每台设备只需打开一次定时器：

```sh
sudo systemctl enable --now podman-auto-update.timer
```

## 更新做什么

定时器触发时，Podman 拉取 `:stable`，如果摘要变了，就用新镜像重启应用的单元。只重启应用的单元：数据库容器不受影响，所以更新不会打断历史数据库。该单元有一个不需要 shell 的健康检查（镜像里没有 shell）：`hotloop healthcheck` 询问应用自己的 `/readyz`，只有在数据库有响应时它才会应答。单元在检查通过之前保持“activating”，这样 Podman 就能区分已经恢复的更新和没有恢复的更新；如果新镜像始终起不来，它会把上一个镜像放回 `:stable` 并启动。

启动新镜像时，会先在已有的数据库上运行它的迁移，大型数据库需要一些时间。单元给应用 15 分钟来响应，之后才判定更新失败，前五分钟内的失败不计入，因为迁移不是故障。

有两点是实际运行时发现的，而不是读文档读出来的，单元里各带有对应的修复。普通的 `HealthCmd` 字符串会通过 `/bin/sh -c` 运行，而镜像没有 shell，检查永远无法通过，所以它是一个 JSON 数组。另外，旧版 Quadlet 把 `Notify=healthy` 当作普通的 `true`，并传入 `--sdnotify=conmon`，这会在容器一启动就认定应用已就绪：无法启动的更新被报告为成功，也没有任何回滚。单元自己指定 `--sdnotify=healthy`。

## 为什么没有 pod

应用和数据库过去共用一个 pod。这使回滚失效，也是实际运行时发现的，而不是读手册读出来的。对于 pod 里的容器，Podman 的自动更新重启的是 **pod 的**单元，而无论里面的应用出了什么问题，pod 的单元都能正常起来。一个无法启动的发布被报告为 `UPDATED true`，应用在它上面陷入崩溃循环（头几分钟内重启二十次），设备上的 `:stable` 成了损坏的镜像。每次更新应用时，它还会重启数据库。改用网络之后，应用是独立的单元，Podman 重启的就是它，单元会一直保持“activating”，直到应用响应 `/readyz`：同一个发布这次返回的是 `UPDATED rolled back`。

## 回滚无法撤销什么

迁移。当一个发布迁移了数据库，随后健康检查失败，Podman 会放回上一个发布，而它是在失败的发布留下的模式上启动的。这是安全的，并且通过三种方式保持安全（详情见[迁移只做新增](/zh-hans/iot/migrations/)）：

- **迁移只做新增。** 一张表、一个带默认值的列、一个索引。绝不删除、重命名或更改类型，所以上一个发布能在原处找到它认识的一切，并且从不去看新增的部分。
- **应用会拒绝它无法信任的模式。** 数据库记录每次迁移是由哪个发布应用的。只落后一步的回滚发布可以启动，并在日志中说明。落后两个或更多发布的不会启动，并说明原因，写明两个版本。这种情况是：一台设备更新失败、回滚、又更新失败，而数据库已经前进了两次。应用立即退出，消息在 `journalctl -u hotloop` 中，单元的 `Restart=always` 不断重试，也不断被拒绝。解决办法是一个认识该模式的发布：最新的那个，也就是 `:stable` 指向的（`sudo podman auto-update`，或拉取后重启）。或者恢复由您正在运行的发布所做的备份（[备份与恢复](/zh-hans/iot/backup/)）。

因此，回滚在发布说明中不再有附带的保留条件。它仍然无法撤销的是数据：失败的发布可能写入了旧发布会忽略的行。打开更新之前先做备份；它是一个有问题的发布与恢复之间唯一的保障。

## 为什么数据库不跟随 `:stable`

应用带有自动更新标签。数据库容器没有，它的 `Image=` 是一个精确的标签。原因是应用的更新可以撤销，而数据库的更新不能。

- **PostgreSQL 主版本**（16 到 17）不是一次重启。PostgreSQL 的版本策略指出，数据目录无法在主版本之间保持向后兼容，需要转储再重新加载，或使用 `pg_upgrade`（[postgresql.org/support/versioning](https://www.postgresql.org/support/versioning/)）。一个在主版本之间浮动的标签，会在一次无关的重启中对工厂的历史数据库做这件事。固定主版本是最低要求，它不是上面规则所指的“端点固定”。HotLoop 做过的唯一一次跨越，16 到 17，是 `hotloop-db-upgrade.container`，在您复制新单元时有意运行。
- **次版本**（16.14 到 16.15）不需要转储和恢复。同一页还补充说，有些版本“可能需要额外步骤，所以务必先阅读发布说明”。无人值守的设备不会读发布说明。
- **TimescaleDB**（Gateway 和 Edge）是另一半。应用在使用更新的镜像启动时会自己运行 `ALTER EXTENSION timescaledb UPDATE`，而扩展更新是对数据库的单向更改：事后放回旧镜像并不能撤销它。浮动的 Timescale 标签会让应用可逆的更新拖着一个不可逆的更新一起来。
- 一个能启动并运行的新数据库镜像，并不等于健康的镜像。健康检查只能区分起不来的容器和起得来的容器，仅此而已。历史数据库是否扛过了引擎升级，不是 `pg_isready` 能回答的。

所以数据库标签随着针对它测试过的 HotLoop 发布一起移动。`release_guard.sh` 让每个 `hotloop-db.container` 与其 chart 的数据库保持一致，使同一产品的 Quadlet 设备和 chart 安装运行同一个版本，并拒绝在其上使用 `AutoUpdate=`。代价是 PostgreSQL 自己的补丁发布，要等某个发布带上它们，或者由您手动更改标签，才会到达设备。在同一主版本内，这是编辑 `hotloop-db.container`、执行 `daemon-reload` 并重启 pod，事先阅读发布说明并做好备份。主版本变更是 `pg_upgrade`，HotLoop 为 16 到 17 运行它，其他情况由您自己运行，或恢复到其中。

## 在您批准之前暂缓更新

默认不暂缓：定时器触发时就会更新。希望由人来决定的站点有两种方式，都不要求应用可访问。

- **暂缓。** 保持 `podman-auto-update.timer` 关闭。什么都不会更新。准备好之后，运行 `sudo podman auto-update`：这就是批准，使用同样的健康检查和同样的回滚。Podman 运行时会更新机器上所有带标签的容器，而不只是这些，也无法让它跳过某一个，所以需要为其他容器运行定时器的设备，不能同时暂缓这些。
- **时间窗口。** `update-window.conf` 是定时器的附加配置，用来指定它何时可以触发，例如周日 03:00，而不是默认的每天午夜：

  ```sh
  sudo mkdir -p /etc/systemd/system/podman-auto-update.timer.d
  sudo cp update-window.conf /etc/systemd/system/podman-auto-update.timer.d/
  sudo systemctl daemon-reload && sudo systemctl restart podman-auto-update.timer
  ```

Edge Relay 有一点不同：Gateway 可以在车队界面批准它的更新，因为中继本来就在监听它所转发到的 Gateway 的命令。IoT、Edge 和 Gateway 没有这样的通道可以触达，而为此建一个，就是在网页界面上放一个“重启此设备”按钮，去实现 `sudo podman auto-update` 已经提供的功能。中继的暂缓请参阅 [Edge Relay 参考](/zh-hans/edge-relay/reference/#更新-relay)和 `edge-relay-hold.conf`。

## Gateway 看到什么

三者中任何一个的 `GET /api/status` 都会给出它的 `version`，在单元报告过时还会给出 `imageDigest`（它在每次启动之前都会报告）。启用了 Edge 发布的 Edge 或 Gateway 是和中继一样的 Sparkplug 节点，并把同样的两项放进每条 birth 消息，所以在车队列表中有它的 Gateway 会显示版本和摘要，并在自动更新使它变化时记录该变化（[车队管理](/zh-hans/gateway/fleet/)）。IoT 没有上游，所以它的摘要只在它自己的 `/api/status` 上，别处都没有。

## 使用 Helm

pod 无法替换自己，所以 chart 没有无人值守的更新：`helm upgrade` 就是更新，chart 的 `image.tag` 默认是它的 `appVersion`，也就是发布版本。
