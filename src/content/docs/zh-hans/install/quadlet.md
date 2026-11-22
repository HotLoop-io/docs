---
title: "Podman Quadlet 安装"
description: "用 Podman Quadlet 在 Pi 或小型工业 PC 上把 HotLoop 作为真正的 systemd 服务运行，无需 Docker、Compose 和集群。"
---

适用于**不属于** k3s 集群的 Pi 或小型工业 PC。如果属于，请改用产品的 chart。本目录和 chart 是运行 HotLoop 的两种受支持方式。

不用 Docker，也不用随会话结束而消失的 shell 里的临时 `podman run`。Quadlet 把容器变成真正的 systemd 服务：开机即启动，无需用户登录，失败时自动重启，日志写入 journald。

| 目录 | 产品 | 镜像 |
|---|---|---|
| `iot/` | HotLoop IoT，含 PostgreSQL 17 | `ghcr.io/hotloop-io/hotloop-iot` |
| `edge/` | HotLoop Edge，含 TimescaleDB | `ghcr.io/hotloop-io/hotloop-edge` |
| `gateway/` | HotLoop Gateway，含 TimescaleDB | `ghcr.io/hotloop-io/hotloop` |
| 本目录 | HotLoop Edge Relay，无数据库 | `ghcr.io/hotloop-io/hotloop-edge-relay` |

[产品页面](/zh-hans/products/)会告诉您需要哪一个。

前三个产品各有一个 `sqlite/` 目录：同一产品，数据库是一个文件，没有数据库容器。参见[用 SQLite 代替 PostgreSQL](#用-sqlite-代替-postgresql)。

## IoT、Edge 和 Gateway

每个目录都有相同的单元和一个脚本：

- **`hotloop.network`**：应用和它的数据库共用的网络。应用通过名称（`hotloop-db:5432`）访问数据库，设备上的其他任何东西都不能，因为数据库不发布任何端口。只发布应用的 8080。
- **`hotloop.container`**：应用。文件头部有安装步骤；复制任何内容之前请先阅读。
- **`hotloop-db.container`**：数据库，与该产品的 chart 运行的镜像和版本相同。它在能响应后才报告已启动，所以应用等待的是一个可用的数据库。
- **`hotloop-db-upgrade.container`** 和 **`hotloop-db-upgrade.sh`**：数据库从 PostgreSQL 16 迁到 17 的一次性步骤。它在数据库单元之前运行，并且只在卷里仍是 16 的数据时运行；在全新的卷或已是 17 的卷上，systemd 会跳过它。参见 [PostgreSQL 16 升到 17](#postgresql-16-升到-17)。
- **`hotloop-db.volume`** 和 **`hotloop-data.volume`**：数据库，以及应用写在 `/data` 下的一切（备份、证书、转发队列、报表）。它们是具名的 Podman 卷，所以 `podman system prune` 不会动它们。

三个 Podman 密钥保存不适合放进文件的内容：`hotloop-db-password`、`hotloop-secret-key`（加密数据库中的设备密码；请在设备之外保留一份副本）和 `hotloop-admin-password-hash`（首位管理员密码的 bcrypt 哈希，绝不是密码本身）。

**Podman 5.0 或更高版本。** Raspberry Pi OS Bookworm 自带的是完全没有 Quadlet 的 Podman 4.3：请使用 Raspberry Pi OS Trixie(Podman 5.4)或更高版本。下面的更新是在 Podman 6.1.3 上运行的；共用相同键的 Edge Relay 单元则在 4.9.3 上运行。另外，请把数据库卷放在 USB SSD 上，而不是 SD 卡上。历史数据全天都在写入，SD 卡正是这样损坏的。

### 为什么所有产品使用相同的名称

单元名、卷名和密钥名在 `iot/`、`edge/` 和 `gateway/` 中完全相同，这是有意为之。把设备升到更大的产品，就是把更大产品的 `hotloop.container` 和 `hotloop-db.container` 复制到您的文件之上：

```sh
sudo cp gateway/hotloop.container gateway/hotloop-db.container \
  gateway/hotloop-db-upgrade.container gateway/hotloop-db-upgrade.sh /etc/containers/systemd/
sudo systemctl daemon-reload
sudo systemctl restart hotloop.service hotloop-db.service
```

卷和密钥保持不变，每个设备、标签、报警、用户和每一小时的历史数据也都保留。尽管如此，仍请先备份（`POST /api/backup`）。这一步已经实际运行过，在同一组卷上从 IoT 到 Edge 再到 Gateway。回退到较小的产品，不是您在重要设备上该做的事。

这也意味着每台设备一个 HotLoop。两个本来就会争用 8080 端口。

### 已验证

交付的 IoT、Edge 和 Gateway 文件，不做任何改动，用 Podman 6.1.3 的 `quadlet` 生成器生成后结构相同：应用依赖数据库和网络，发布自己的端口，带有自动更新标签，而数据库没有标签，也不发布任何端口。

随后 Gateway 的单元被真实运行：无 root、在 systemd 下，用本地注册表代替 ghcr.io，并使用各产品自己的 `podman auto-update`。首次启动时数据库健康、随后应用健康；更新到一个为应用已在使用的表新增迁移的版本，现有设备及其数据完好，数据库容器从未重启；以及更新到一个迁移了数据库却无法启动的版本，Podman 将其回滚，前一个版本在失败版本已迁移过的数据库上健康启动。Edge 和 IoT 使用相同的单元运行，并已在真实的 Pi 上、在裸机上于 systemd 下运行过（2026-11-17）。

## PostgreSQL 16 升到 17

从这个版本起，HotLoop 的数据库是 PostgreSQL 17。运行过早期版本的设备有 PostgreSQL 16 的数据，PostgreSQL 17 无法打开，所以迁移由一个在数据库之前运行的单元完成。把新文件放到位，重启数据库，就这些：

```sh
sudo cp hotloop-db.container hotloop-db-upgrade.container hotloop-db-upgrade.sh \
  /etc/containers/systemd/
sudo systemctl daemon-reload
sudo systemctl restart hotloop-db.service
journalctl -u hotloop-db-upgrade.service      # what it did
```

`hotloop-db.container` 依赖升级单元，所以只复制了新数据库单元的设备不会在 16 的数据上启动，journal 会说明原因。升级单元以复制模式把 `pg_upgrade` 运行到旧目录旁的新目录中，启动一次新服务器以证明它能打开，然后才交换名称；旧数据以 `pgdata.pg16` 留在卷上。只有卷需要时，它才拉取 PostgreSQL 16 镜像。失败时 16 的数据保持原样，数据库不会启动。完整说明、回退方法以及如何删除 `pgdata.pg16`，见 [k3s 和 Helm](/zh-hans/install/helm/#postgresql-17)。对于无 root 安装，单元中的脚本路径是来自 `%E` 的 `~/.config/containers/systemd`。

## 用 SQLite 代替 PostgreSQL

数据库是一项设置，而不是一个镜像（k3s 和 Helm 页面中的“SQLite”）。在 Quadlet 下，这意味着第二组文件，而不是第二个镜像。每个产品的 `sqlite/` 目录有两个：

- **`sqlite/hotloop.container`**：只有应用。没有对数据库的 `Requires=`，没有网络，没有数据库密码，并使用 `HOTLOOP_DB_TYPE=sqlite`，文件位于 `HOTLOOP_DB_PATH=/data/hotloop.db`。它跟随 `:stable`，并与 PostgreSQL 单元完全一样地回滚有问题的更新：同样的健康检查，同样的 `--sdnotify=healthy`。
- **`sqlite/hotloop-data.volume`**:`hotloop-data` 卷，数据库文件及其 `-wal` 和 `-shm` 都在这里。它与 PostgreSQL 文件使用相同的卷名，所以将来切换时是同一个数据卷。

| 目录 | 安装 | 密钥 |
|---|---|---|
| `iot/`、`edge/`、`gateway/` | `hotloop.network`、`hotloop.container`、`hotloop-db.container`、`hotloop-db.volume`、`hotloop-data.volume` | 三个 |
| `iot/sqlite/`、`edge/sqlite/`、`gateway/sqlite/` | `hotloop.container`、`hotloop-data.volume` | 两个：`hotloop-secret-key` 和 `hotloop-admin-password-hash` |

安装其中一组即可，不要两组都装：它们使用相同的单元名。`sqlite/hotloop.container` 的头部有确切的步骤。简而言之：

```sh
cd iot/sqlite        # or edge/sqlite, gateway/sqlite
sudo cp hotloop.container hotloop-data.volume /etc/containers/systemd/
# make hotloop-secret-key and hotloop-admin-password-hash as the header says
sudo systemctl daemon-reload
sudo systemctl start hotloop.service
curl -s localhost:8080/api/status
```

选择之前有几点需要了解。SQLite 是单个本地磁盘上的单个写入者：Pi 把卷放在 USB SSD 上，网络存储不可选，因为 SQLite 在上面会损坏。历史数据是一张带一个索引的表，没有分区或超表，所以每秒记录、积累多年历史的现场需要 PostgreSQL 文件。而在 SQLite 与 PostgreSQL 之间移动设备是备份和恢复（[备份与恢复](/zh-hans/iot/backup/)），不是更换单元：新数据库从空开始。不要为了“切换”而把 `sqlite/hotloop.container` 复制到正在运行的 PostgreSQL 安装之上；它不会读取 PostgreSQL 卷的数据。

在 Edge 或 Gateway 上使用纯 PostgreSQL，就是在 `hotloop.container` 中加入 `Environment=HOTLOOP_HISTORIAN_TIMESCALE=false` 的 TimescaleDB 单元。IoT 的单元本来就是纯 PostgreSQL,IoT 完全没有 TimescaleDB 单元。

### 已验证（SQLite）

`iot/sqlite/hotloop.container` 及其卷从已提交的文件在 Podman 4.9.3 上于 systemd(`systemctl --user`)下无 root 运行，只改了名称、端口、镜像（由同一代码树构建）以及用户管理器所需的运行时目录。单元健康启动，`/healthz` 和 `/readyz` 返回 200，管理员用哈希密钥登录，`/api/status` 有响应，`hotloop.db`、`hotloop.db-wal` 和 `hotloop.db-shm` 出现在卷上，重启没有应用任何迁移并让管理员再次登录。Edge 和 Gateway 的 `sqlite/` 单元除镜像和保留期默认值外是同一个文件，并已在真实的 Pi 上、在裸机上以 root 于 systemd 下运行过（2026-11-17）。

## Edge Relay

- **`edge-relay-hold.conf`**：可选：在操作员批准之前保留镜像更新。是 systemd 的 drop-in，不属于默认安装。
- **`edge-relay.container`**，服务本身。完整安装步骤在它自己头部的注释里；复制任何内容之前请先阅读。
- **`edge-relay-data.volume`**，用于转发队列的具名 Podman 卷，使缓冲的读数在容器重启后依然保留。服务首次启动时 Podman 会自动创建它。
- **`devices.example.json`**，设备文件的起点。把它复制到 `/etc/edge-relay/devices.json`，并按本现场的实际设备编辑；完整格式见 [Edge Relay 参考](/zh-hans/edge-relay/reference/)。

### 快速开始

```sh
sudo mkdir -p /etc/containers/systemd /etc/edge-relay
sudo cp edge-relay.container edge-relay-data.volume /etc/containers/systemd/
sudo cp devices.example.json /etc/edge-relay/devices.json   # then edit it
sudo "$EDITOR" /etc/containers/systemd/edge-relay.container  # broker, group, node

# Skip this if the broker takes anonymous connections.
printf '%s' 'your-broker-password' | sudo podman secret create edge-relay-broker-password -

sudo systemctl daemon-reload
sudo systemctl start edge-relay.service
sudo systemctl status edge-relay.service
curl localhost:8081/status
```

**更新。** 单元跟随 `:stable`，只要 Podman 的定时器开启，就会自行更新：

```sh
sudo systemctl enable --now podman-auto-update.timer
```

如果新镜像通不过健康检查，Podman 会把旧镜像放回去。Gateway 的设备群列表显示每个中继的版本和镜像摘要，并记录每一次变更。若要在管理员于 Gateway 上批准之前保留更新，请按该文件顶部注释所述安装 `edge-relay-hold.conf`，并关闭定时器。这样做能做到的一切，以及做不到的，都在 [Edge Relay 参考](/zh-hans/edge-relay/reference/#updating-a-relay)中。

要使本地文件的更改生效：编辑它，然后运行 `sudo systemctl restart edge-relay.service`。中继在启动时读取该文件，不会监视它。

Gateway 推送的设备文件不需要这些：它即时生效，无需重启。它无法写入 `/etc/edge-relay/devices.json`（那是在只读根上以 `:ro` 挂载的），所以它放在数据卷上，名为 `/data/pushed-devices.json`，只要它存在，中继就运行并从它启动。在清除推送之前，您对本地文件的编辑都不会被使用：中继运行时在 Gateway 上执行 `DELETE /api/fleet/{id}/config`，它会立即切回本地文件。journal 会说明它在用哪个文件，所以在怀疑您的 JSON 之前先在那里查看。

已对照真正的 `quadlet` 二进制文件验证（`podman-5.8.6` 的 `/usr/libexec/podman/quadlet -dryrun`）：两个单元都能无错误解析，并生成预期的 `podman run` 调用，卷依赖和密钥自动接入。
