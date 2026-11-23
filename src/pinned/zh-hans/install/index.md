---
title: "安装 HotLoop"
description: "每款 HotLoop 产品如何安装：k3s 或任意 Kubernetes 上的 Helm，或设备上的 Podman Quadlet，设备跟随 stable 标签并自动更新。"
sidebar:
  label: "安装"
---

真正运行一款 HotLoop 产品有两种方式：在 k3s 或任意 Kubernetes 上用 Helm，或在不属于集群的设备上用 Podman 加 Quadlet。不用 Docker，不用 Compose，也不要在会随会话一起消失的 shell 里单独执行 `podman run`。试一试时用普通的 `podman run` 没问题，Flow 的页面也这么说，但那不算安装。

## 选择方式

| 您有 | 使用 | 页面 |
|---|---|---|
| 一个 k3s 或 Kubernetes 集群 | Helm | [k3s 和 Helm](/zh-hans/install/helm/) |
| 一块 Pi、一台 NUC 或一台小型工控机，没有集群 | Podman Quadlet | [Podman Quadlet](/zh-hans/install/quadlet/) |
| 两者皆可，并且想了解更新的行为 | | [:stable 自动更新](/zh-hans/install/auto-update/) |

## 今天可以安装的产品

| 产品 | 最新发布 | Helm | Quadlet | 从这里开始 |
|---|---|---|---|---|
| [HotLoop IoT](/zh-hans/iot/overview/) | {{hotloop}} | 支持 | 支持 | [安装 IoT](/zh-hans/iot/install/) |
| [HotLoop Edge](/zh-hans/edge/overview/) | {{hotloop}} | 支持 | 支持 | [安装 Edge](/zh-hans/edge/install/) |
| [HotLoop Gateway](/zh-hans/gateway/overview/) | {{hotloop}} | 支持 | 支持 | [安装 Gateway](/zh-hans/gateway/install/) |
| [HotLoop Edge Relay](/zh-hans/edge-relay/overview/) | {{hotloop}} | 支持 | 支持 | [安装 Edge Relay](/zh-hans/edge-relay/install/) |
| [HotLoop Flow](/zh-hans/flow/overview/) | {{flow}} | 支持 | 支持 | [安装 Flow](/zh-hans/flow/install/) |
| [HotLoop Cascade](/zh-hans/cascade/overview/) | {{cascade}} | 支持，无需登录 | 支持，无需登录, 参见 [用 Podman Quadlet 运行 Cascade](/zh-hans/cascade/quadlet/) | [运行 Cascade](/zh-hans/cascade/running/) |
| [HotLoop for CODESYS](/zh-hans/codesys/overview/) | {{codesys}} | 支持，或通过 EmberCORE App Store | 不支持 | [安装 HotLoop for CODESYS](/zh-hans/codesys/install/) |
| [HotLoop Transmitter](/zh-hans/transmitter/overview/) | 1.2.0 | 不支持，它是 CODESYS 库 | 不支持，它是 CODESYS 库 | [安装 Transmitter](/zh-hans/transmitter/install/) |

HotLoop IoT、Edge、Gateway 和 Edge Relay 出自同一个标签，同步发布，所以共用一个版本号。Flow、Cascade、HotLoop for CODESYS 和 Transmitter 各有自己的版本号。IoT、Edge 和 Gateway 的 Quadlet 单元需要 Podman 5.0 或更高，中继的单元在 Podman 4.9.3 上运行过。Raspberry Pi OS Bookworm 自带 4.3，完全没有 Quadlet，所以 Pi 需要 Trixie 或更新的系统。

## 从 EmberNet App Store 安装

在 EmberNet 上，安装就是 App Store。它会替你在所选节点上运行同一个 Helm 图表，所以不用添加图表，不用值文件，也不用命令行。我们在一台真实节点上计了时：从打开 App Store 到看板上出现实时读数，用了 1 分 10 秒。

<figure>
<video controls preload="none" playsinline width="1920" height="1080" poster="/embernet-install/poster.webp" aria-label="从 EmberNet App Store 安装 HotLoop Gateway，从开始到实时数据用时 1 分 10 秒" style="width:100%;height:auto;aspect-ratio:16/9">
<source src="/embernet-install/install-hotloop-on-embernet.mp4" type="video/mp4" />
<source src="/embernet-install/install-hotloop-on-embernet.webm" type="video/webm" />
您的浏览器无法播放此视频。 <a href="/embernet-install/install-hotloop-on-embernet.mp4">下载视频</a>.
</video>
<figcaption>一镜到底，真实时间。计时从打开 App Store 开始，到 HotLoop 读到数据为止，安装等待的部分以 4 倍速播放。</figcaption>
</figure>

1. 在 EmberCORE 中打开 **App Store**。

   ![带有类别、发布者和排序筛选的 EmberCORE App Store](/embernet-install/hotloop-install-01-app-store.webp)

2. 选择 **HotLoop** 类别，然后在 HotLoop Gateway 上点 **部署**。HotLoop 的每个产品在这个类别里都有自己的卡片。

   ![按 HotLoop 类别筛选的 App Store，显示 HotLoop Cascade、Edge、Edge Relay、Flow、Gateway 和 IoT 的卡片](/embernet-install/hotloop-install-02-hotloop-apps.webp)

3. 选择节点，再点一次 **部署**。

   ![已选好节点的 HotLoop Gateway 部署对话框](/embernet-install/hotloop-install-03-choose-node.webp)

4. EmberCORE 确认安装，HotLoop Gateway 会出现在 **运行中的应用** 里，并显示版本和 Flux 地址。

   ![EmberCORE 提示 HotLoop Gateway 正在节点上安装的消息](/embernet-install/hotloop-install-04-installing.webp)

   ![运行中的应用页面，HotLoop Gateway 正在运行，显示版本、在线的 Flux 地址，以及启动、打开、Pod Shell、设备 Shell 和移除按钮](/embernet-install/hotloop-install-05-running.webp)

5. 点 **启动**。EmberCORE 会为你登录，HotLoop 打开时这台设备自身的状态已经在读取，所以你最先看到的就是实时数据。

   ![在 EmberCORE 中已登录并打开的 HotLoop Gateway，显示 1 台设备、4 个标签中 4 个正在上报、没有告警](/embernet-install/hotloop-install-06-hotloop-signed-in.webp)

6. 把你关心的标签固定下来，它们就成了看板上的实时仪表。

   ![把标签固定到看板的对话框，列出节点的 CPU、内存和磁盘标签](/embernet-install/hotloop-install-07-pin-a-tag.webp)

   ![HotLoop 看板，用实时仪表显示节点的 CPU、内存和磁盘使用率](/embernet-install/hotloop-install-08-board-live.webp)

EmberNet 文档也逐页讲解同样的安装过程：[EmberNet 上的 HotLoop Gateway](https://docs.embernet.ai/docs/app-store/hotloop)。

## 在把它放进真实工厂之前

- 请阅读[写入关口](/zh-hans/gateway/write-gate/)。它在每款产品里都一样，这也是没有任何东西能驱动您未解除保护的机器的原因。
- 如果是 Pi，请把数据库放在 USB SSD 上，而不是 SD 卡。历史数据每天全天都在写入，SD 卡正是死于这个。
- 备份设备密码密钥。它不在数据库里，也不在备份里，所以它本身就是您数据的一部分。做法见[备份](/zh-hans/iot/backup/)。
- 把站点升到更高一级的产品、或跨版本升级之前，先做备份，并把备份复制到设备之外。
