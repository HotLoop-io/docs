---
title: "Flow 2.7.1 发布说明"
description: "HotLoop Flow 2.7.1 带来了什么，升级时有什么变化，以及动手改动运行中的工厂之前该读什么。"
sidebar:
  label: "2.7.1"
---

HotLoop Flow 2.7.1 就是加上 arm64 镜像的 2.7.0，没有别的。2.7.0 只发布了 amd64，为的是先进入生产并被标为稳定版，这是同时构建两者的那个小后续版本。代码、chart、设置和您的 flow 都没有变化。

## 变更内容

- 镜像再次为 linux/amd64 和 linux/arm64 构建。`2.7.1`、`2.7` 和 `2` 标签同时包含两者。
- README 和安装页面写的是 2.7.1，并像 2.7.0 之前一样同时提到 amd64 和 arm64。

## 新设置

无。

## 升级

对 2.7.1 的镜像和图表做一次普通的 `helm upgrade`，或在你的 Quadlet 单元里换上新标签。如果你在 arm64 上，并且在 2.7.0 仅支持 amd64 期间留在 2.6.0，这就是你迁移到 FlowLab 的时机：阅读 2.7.0 的说明，了解它是什么，以及还不是什么。首次启动不会发生任何事，也无需迁移。

镜像：`ghcr.io/hotloop-io/hotloop-flow:2.7.1`，linux/amd64 和 linux/arm64。Chart：`https://hotloop.io/hotloop-flow/`。这个标签的 README 有其余内容，还配有图片：https://github.com/HotLoop-io/hotloop-flow/blob/v2.7.1/README.md
