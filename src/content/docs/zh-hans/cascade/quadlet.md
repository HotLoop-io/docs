---
title: "Cascade 与 Podman Quadlet"
description: "用 Podman Quadlet 把 Cascade 作为 systemd 服务运行，可用 SQLite，也可用 Postgres 加独立 worker，更新时间窗口由您自己掌握。"
---

运行方式有两种。两种都要求 Podman 5.0 或更高版本，并以 root 安装，这样开机时无人登录也会自动启动。两种都跟随 `ghcr.io/hotloop-io/hotloop-cascade:stable`，以只读、非 root、去掉全部 capability 的方式运行，并交给 systemd 负责重启。更新以及如何回滚见最后。

## 一台设备，SQLite

`hotloop-cascade.container` 和 `hotloop-cascade-data.volume`。数据库是卷里的一个文件，和加密已存凭据的密钥放在一起。

```sh
sudo cp hotloop-cascade.container hotloop-cascade-data.volume /etc/containers/systemd/
sudo install -D -m 600 /dev/null /etc/hotloop-cascade/cascade.env
sudo systemctl daemon-reload
sudo systemctl start hotloop-cascade
```

打开 `http://this-box:8080`。第一个打开的人会创建第一个账户，所以请在分享地址之前自己先创建。

## PostgreSQL、一台服务器和 worker

`postgres/`。包含数据库、服务器，以及需要时更多的 worker。Postgres 就是队列，所以 worker 都从同一个地方领取任务。数据库位于自己的网络中，不发布任何端口。

先创建三个密钥，只需创建一次。命令在 `postgres/hotloop-cascade.container` 的开头。其中密钥最重要：一旦丢失，所有已存凭据都将无法读取。请把一份副本保存在这台设备以外的地方。

```sh
cd postgres
sudo cp hotloop-cascade.network hotloop-cascade-db.container hotloop-cascade-db.volume \
  hotloop-cascade-data.volume hotloop-cascade.container /etc/containers/systemd/
sudo install -D -m 600 /dev/null /etc/hotloop-cascade/cascade.env
sudo systemctl daemon-reload
sudo systemctl start hotloop-cascade
```

更多 worker：`hotloop-cascade-worker.container`。worker 共用数据卷，所以必须在同一台设备上。超出一台设备时，请使用 Helm chart。

## 设置

`/etc/hotloop-cascade/cascade.env`，每行一个 `NAME=value`，即使为空文件也必须存在（`install` 那一行会创建它）。您可能会用到的有：

| 设置 | 作用 |
|---|---|
| `HOTLOOP_CASCADE_PUBLIC_URL` | 人们访问 Cascade 所用的地址。Webhook 和 OAuth 回调链接都由它生成。在您设置之前，它是 `http://localhost:8080`，只能在设备本机使用。 |
| `HOTLOOP_CASCADE_METRICS_TOKEN` | 要求 `/metrics` 带上 `Authorization: Bearer`。 |
| `HOTLOOP_CASCADE_FILES_DIR` | 在这个目录中启用文件步骤。也请把它挂载到容器里。 |

单元只设置数据目录、端口和密钥，而且单元里设置的值优先于 env 文件里的值，所以请不要改动这几项。修改之后：`sudo systemctl restart hotloop-cascade`。

## 检查

```sh
sudo podman healthcheck run hotloop-cascade
curl -s http://127.0.0.1:8081/readyz
sudo podman exec hotloop-cascade /usr/local/bin/hotloop-cascade workflows import - < workflow.yaml
```

健康检查和指标在 8081 端口，只发布在回环地址上。如果 8080 或 8081 已被别的程序占用，请修改 `PublishPort=` 各行的左边部分。

## 升级

应用单元跟随 `:stable`，并带有 `AutoUpdate=registry`。每台设备只需打开一次 Podman 的定时器：

```sh
sudo systemctl enable --now podman-auto-update.timer
```

定时器触发时，Podman 拉取 `:stable`，如果摘要变了，就用新镜像重启单元。只有当容器通过健康检查后，单元才算启动完成（`Notify=healthy`；检查方式是程序自己查询自己的 `/readyz`，因为镜像里没有 shell，所以写成 JSON 数组）。如果新镜像始终达不到这一步，Podman 会把上一个镜像放回 `:stable` 并启动它。等待时间最长 15 分钟，因为新镜像在启动过程中会迁移数据库。

如果想等您发话再更新，就让定时器保持关闭，准备好时运行 `sudo podman auto-update`。如果只想在某个时间窗口内更新，请安装 `update-window.conf`（它的开头说明了做法）。

有两件事回滚无法撤销。迁移只会向前，所以在打开更新之前请先备份。如果某个版本以旧版本读不了的方式修改了表，它的发布说明里会写明。还有数据库：它的镜像固定在一个精确的标签上，而且特意不带更新标签。无法启动的新服务器，把旧镜像放回去就能撤销；而新的数据库镜像可能先启动、修改数据目录，之后才发现是个错误。在 PostgreSQL 18 之内，这只需修改标签，前提是先读发布说明并做好备份。

在 PostgreSQL 方案中，服务器和每个 worker 都是独立的单元，所以无法启动的更新只回滚那一个单元，不会影响旁边的单元。

## 测试过什么

这些单元在 Podman 6.1.3 上以 rootless 方式在 systemd 下真实运行过，用本地镜像仓库代替 ghcr.io，除主机端口外，随附的单元未作任何修改。独立方案和 PostgreSQL 方案都测了：首次启动会等待容器健康；更新到新摘要后恢复健康，数据完好，PostgreSQL 方案中数据库容器纹丝未动；更新到启动即退出的镜像时，`podman auto-update` 报告为 `rolled back`，之前的摘要重新健康运行，之前的工作流仍在运行。在 Podman 4.9.3 上以 root 安装时，单元的早期版本在 systemd 下可以启动和重启；而 Quadlet 4.9 不支持 `Notify=healthy`，所以单元还带有 `--sdnotify=healthy`。

然后两种方案又以 root 安装的方式各测了一遍，这正是单元所说的运行方式，在 Podman 5.8.7 上、systemd 下、一个一次性的特权容器中，用同一个本地镜像仓库作为 ghcr.io 的镜像，单元未作修改。独立方案：启动等待容器健康；被杀掉的容器恢复健康；更新到良好镜像后在新摘要上健康启动；更新到启动即退出的镜像时报告为 `rolled back`，良好镜像重新运行；每一步之后都运行了一个工作流。PostgreSQL 方案，含服务器和一个额外 worker：对服务器执行 `systemctl start` 时，先等数据库再等服务器健康；被杀掉的服务器恢复了；更新到良好镜像后，服务器和 worker 都切换了，数据库容器未受影响；更新到启动即退出的镜像时，结果为 `rolled back`，两者都回到良好镜像，数据库纹丝未动；更新之前、之间和之后各运行了一个工作流。阅读这些输出时有一点需要知道：服务器和 worker 共用同一个镜像，当其中一个先回滚时，另一个显示的是 `true`，并伴随一次重启，最后同样落在良好镜像上。哪一个先回滚，每次运行都不一样。

在裸机上运行（2026-11-17），用的是真实的 Raspberry Pi，并针对 ghcr.io 本身做了 Quadlet 自动更新。
