---
title: "CODESYS 0.3.5 发布说明"
description: "HotLoop for CODESYS chart 0.3.5:封装 HotLoop 4.20.2,索引中最新的 chart。"
sidebar:
  label: "0.3.5"
---

## 变更内容

0.3.5 在索引 `{{codesysChartRepo}}` 中,发布于 2026-11-16,是应安装的 chart。

- **它封装 HotLoop 4.20.2,** 其中带有 EtherNet/IP 批量修复和无需任何配置即可输出的 `version` 命令。provisioner 仍是 0.3.1。
- **从 [0.3.2](/zh-hans/releases/codesys-0-3-2/) 到 [0.3.4](/zh-hans/releases/codesys-0-3-4/) 的一切仍然在这里,** 不向 PLC 写入任何内容,每个更早的 chart 都保留在索引中。

这对您意味着什么:应安装的就是它,从 0.3.4 升级会保留您的设备及其标签。

## 检查了什么

从 0.3.4 升级到已应用配置文件的 0.3.5,旁边是节点网络上的 CODESYS Control for Linux SL 4.22.0.0 运行时:4.20.2 上的一个新 pod 启动了,设备及其 44 个标签仍在且都不可写,页面有应答,HotLoop 日志没有警告或错误。两个 pod 都被删除,运行时重启:三者都自行恢复了。已在裸机上运行(2026-11-17)。
