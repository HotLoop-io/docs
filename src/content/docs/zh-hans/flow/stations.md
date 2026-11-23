---
title: "推送到租户的工作站"
description: "把一个流程文件及其 FlowLab 图表依次放到租户运行的每个 Flow 上，每台都做检查，失败的会被还原。"
---

EmberNet 中的一个租户可以运行多个 HotLoop Flow 安装，每个工厂或产线一个。我们把每个安装称为一个工作站。本页讲的是把一个流程文件，也就是一套 FlowLab 图表，放到所有工作站上，检查每一台，并在某台失败时将它还原。

简短来说：`hotloop-flow stations push -tenant acme -file flows.json` 会逐台推送到 EmberNet 显示为 `acme` 运行中的工作站。如果之后某台工作站不正常，该工作站会退回原有状态，推送随即停止。如果该文件会重启正在运行的记录器，在您表示允许之前什么都不会发生。

## 工作站从哪里来

没有人手动输入工作站。列表就是 EmberNet 仪表板为该租户显示为运行中的内容，与其“Running Apps”页面是同一份列表：每个带有 `hotloop-flow` 标签、正在运行且属于该租户的应用。当仪表板报告了 Flux 地址时，通过该地址访问工作站，否则通过其集群地址访问，所以请在能解析该地址的地方运行推送。

租户必须指明，一次推送永远只针对那一个租户。仪表板用您的仪表板令牌查询，并把您限制在您有权查看的租户内，我们还会再次核对返回结果：为其他任何租户送来的行会被丢弃并计数，绝不使用。没有运行中 Flow 的租户会返回错误。

## 命令

```bash
hotloop-flow stations list -tenant acme
hotloop-flow stations push -tenant acme -file flows.json -note "new line 3 logger"
```

仪表板地址来自 `-dashboard` 或 `HOTLOOP_FLOW_DASHBOARD_URL`，其令牌来自 `-dashboard-token-file` 或 `HOTLOOP_FLOW_DASHBOARD_TOKEN`。工作站接受的令牌来自 `-token-file` 或 `HOTLOOP_FLOW_TOKEN`，与 `hotloop-flow deploy` 相同。用 `hotloop-flow token` 生成它，并把该令牌作为具有 `flows.read`、`flows.write` 和 `status.read` 的 API 令牌交给每个工作站（普通部署令牌只有前两项）：检查需要读取每个工作站的图表，而普通部署令牌做不到。同一租户的工作站使用同一个令牌。

| 标志 | 作用 |
|---|---|
| `-dry-run` | 为每个工作站做规划，但不更改任何一个。显示当前运行的内容、每台会重启什么，以及哪些无法规划。 |
| `-confirm-restart` | 您同意本次推送可以重启正在运行的记录器。 |
| `-window 02:00-04:00` | 预先同意重启的时间段，在 `-window-zone`（IANA 名称，省略则为 UTC）中解释。窗口内的推送会继续进行。可以跨过午夜，如 `22:00-02:00`。 |
| `-settle 5s` | 在检查判定工作站的图表未运行之前，图表有多长时间来启动。 |
| `-json` | JSON 格式的报告。 |

退出状态 0 表示每个工作站都完成了。3 表示有工作站失败，推送已停止。4 表示推送正在等您同意重启。5 表示有工作站因未应答或无法规划而被跳过。

## 一次推送做什么

首先，它在不更改任何工作站的情况下为每个工作站做规划。对每一台，它读取运行中的流程文件和修订号，找到可以回退到的部署记录，列出其图表，并算出该文件会重启哪些运行中的记录器。然后，如果没有需要您点头的事，就按名称顺序逐台进行。

1. **部署**文件时使用规划所见的修订号，因此其间别人做的部署会被拒绝，而不是被覆盖。只有变化的部分才会重启。凭据从不传输：每个工作站保留自己的密码，仪器的写入保持关闭，直到该工作站上有人将其打开。
2. **检查。** 工作站必须应答每个工作站都应具有的修订号。修订号来自文件内容，所以同一个文件在任何地方都是同一个修订号，推送在开始前会说出它是什么。文件中每个会自行启动的图表都必须在工作站上，没有问题，并在稳定时间内处于运行或已完成状态。没有启动的节点同样会使检查失败。
3. **未通过检查的工作站会被还原。** 它被回滚到原来所在的部署，作为一次独立的部署，并检查它确实回到了旧的修订号。推送在此停止。

报告会说明每个工作站发生了什么：

| 状态 | 含义 |
|---|---|
| `done` | 已部署并通过检查。 |
| `unchanged` | 已经是这个修订号，且图表都正常。 |
| `failed` | 未部署（工作站拒绝了，或其间有人部署过），或已是这个修订号但不正常。没有任何更改。 |
| `reverted` | 未通过检查，已回到原有的修订号。 |
| `revert-failed` | 未通过检查，且无法还原。这台需要人工处理。 |
| `skipped` | 未触碰。它没有应答，或者没有其运行修订号的部署记录，所以失败的推送无法在那里撤销。请手动向它部署一次，或修复链路，然后再次推送。 |
| `not-started` | 推送在这个工作站之前就停止了。它保持原样。 |
| `planned` | 试运行的结果。 |

被跳过的工作站不会让推送停止。推送可以重复：已经是该修订号的工作站为 `unchanged`，所以第二次推送只会完成第一次没做完的部分。

## 重启

会自行启动的图表就是一个记录器。部署已更改的图表会使其重启，被移除的则会停止。如果一次推送会对正在运行的记录器这样做，它会在触碰任何东西之前停止，报告会列出每个工作站和每个记录器。之后，以下三种情况之一即可让它继续：

- 在终端中运行命令时，您在提示处回答是；
- 您传入 `-confirm-restart`；
- 当前时间在您用 `-window` 给定的窗口内。

没有其中之一，什么都不会重启。没有变化的图表保持其运行，新的图表则直接启动。

## 从一个实例推送，以及面向智能体

实例可以通过其管理 API 向自己租户的工作站推送，MCP 工具 `list_stations` 和 `push_to_stations` 用的就是这个。把下面四项全部设置好，在配置文件的 `stations:` 下或通过环境变量，路由 `GET /stations` 和 `POST /stations/push` 就会出现。没有它们，这些路由就不存在。

| 设置 | 环境变量 | 说明 |
|---|---|---|
| `stations.dashboardUrl` | `HOTLOOP_FLOW_STATIONS_DASHBOARD_URL` | 了解该租户各安装的 EmberNet 仪表板。 |
| `stations.tenant` | `HOTLOOP_FLOW_STATIONS_TENANT` | 该实例为其推送的唯一租户。请求不能指定其他租户。 |
| `stations.dashboardTokenFile` | `HOTLOOP_FLOW_STATIONS_DASHBOARD_TOKEN_FILE` | 存放仪表板令牌的文件。 |
| `stations.deployTokenFile` | `HOTLOOP_FLOW_STATIONS_DEPLOY_TOKEN_FILE` | 存放工作站所接受的部署令牌的文件。 |

在 chart 中它们是 `stations.dashboardUrl`、`stations.tenant`、`stations.dashboardTokenSecret` 和 `stations.deployTokenSecret`，每个 Secret 存放一个令牌并作为文件挂载；使用 Podman 和 Quadlet 时，它们是[部署 Flow](/zh-hans/flow/deploying/)中的四个环境变量和两个挂载的密钥。要么四项全设，要么都不设：只设置其中一部分的 chart 渲染会被拒绝，只设置一部分的启动也会被拒绝。

`POST /stations/push` 需要 `flows.write`，接受 `{flows, note, confirmRestart, window, windowZone, dryRun}`。省略 `flows` 时，它推送该实例正在运行的内容。它返回同样的报告外加 `ok`，推送会以 `stations.push` 记入审计日志。`GET /stations` 需要 `flows.read`。等待您点头的推送会返回 `needsConfirm` 为 true，并且没有更改任何内容：带上 `confirmRestart` 或一个窗口再发送一次。

## 尚未证实的内容

仪表板列表的格式是从一个真实租户的线上仪表板读取的。它尚未通过 Flux 推送到某个租户的工作站，所以仪表板给出的地址能否从您运行推送的位置访问，需要您自己用 `stations list` 和 `-dry-run` 去检查。
