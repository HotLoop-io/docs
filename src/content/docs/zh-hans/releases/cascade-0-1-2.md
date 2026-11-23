---
title: "发布说明: Cascade 0.1.2"
description: "HotLoop Cascade 0.1.2 包含什么、升级时有哪些变化,以及动手改动一个运行中的工厂之前应该先读什么。"
sidebar:
  label: "0.1.2"
---

## 这是什么

0.1.2 只是一个构建修复,别无其他。代码与 0.1.1 相同,你运行的一切也相同:chart、Quadlet 单元、设置、数据库。

Cascade 现在全程在 Podman 上构建和发布,镜像恰好包含 amd64 和 arm64。

## 从 0.1.1 升级

无需任何操作。把 0.1.2 `helm upgrade` 上去,或者让 `:stable` 推进 Quadlet 单元。没有迁移,没有新设置,密钥和你的工作流都留在原处。
