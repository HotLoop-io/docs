---
title: "CODESYS 0.3.4 发布说明"
description: "HotLoop for CODESYS chart 0.3.4:封装 HotLoop 4.20.1,即带有多架构镜像的发布。"
sidebar:
  label: "0.3.4"
---

## 变更内容

0.3.4 在索引 `{{codesysChartRepo}}` 中,发布于 2026-11-16。

- **它封装 HotLoop 4.20.1,** 即带有测试人员所拉取的 arm 镜像的发布。provisioner 仍是 0.3.1。

这对您意味着什么:arm64 节点随 chart 拉取 HotLoop 的 arm 镜像,其他一切都不动。

## 检查了什么

从 0.3.3 升级到已应用配置文件的 0.3.4,旁边是 CODESYS Control for Linux SL 4.22.0.0 运行时:4.20.1 上的一个新 pod 启动了,设备及其 44 个标签仍在且都不可写,页面有应答,HotLoop 日志没有警告或错误。运行时在节点网络上时,provisioner 在 4840 上访问到它,运行时按其自身设置以匿名用户身份拒绝了它,所以运行时自己的设备保持待处理,而监听设备及其标签已创建。已在裸机上运行(2026-11-17)。
