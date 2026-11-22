---
title: "HotLoop for CODESYS 现状"
description: "HotLoop for CODESYS 在真实硬件上针对什么运行过，以及已发布了什么。"
sidebar:
  label: "现状"
editUrl: false
---

本页说明已发布的内容，以及 HotLoop for CODESYS 已运行到什么程度。

## 已发布的内容

- **Chart。** `hotloop-codesys` 0.3.8 位于 `https://hotloop.io/hotloop-codesys/` 的索引中，发布于 2026-11-19，此前所有版本仍在旁边。它封装 HotLoop 4.22.0。安装 0.3.8：每个 chart 改了什么，见[发布说明](/zh-hans/releases/codesys-0-3-5/)。
- **Provisioner 镜像。** 0.3.3 的 `ghcr.io/hotloop-io/hotloop-provision` 无需登录即可拉取，支持 amd64 和 arm64，由 chart 运行。
- **App Store 条目。** 它在 EmberCORE App Store 中，由 EmberNet 安装到你的租户。

## 运行到什么程度

在 k3s 节点上使用 Store 形式的值运行 chart，同一节点上有一个真实的 CODESYS Control for Linux SL 4.22.0.0 运行时在运行演示程序，还有一个 HotLoop Edge 镜像。

- 设备、它的 tag（没有可写的）、它的报警和它的画面都在无需手工步骤的情况下出现。
- 每个值读取正常并在变化。
- 删除一个 Pod 后，Pod 恢复了。
- 运行时重启期间，安装以 "the PLC's runtime is not answering" 为原因读作坏值，大约 88 秒后自行恢复。
- 来自仪表板的签名登录让一个人以操作员或管理员身份登录，而错误的应用、错误的租户、已过期的、错误的签发者和被篡改的，每一种都被拒绝。
- 已发布的 chart 用 Helm 从线上索引渲染。

其下的连接器，即 HotLoop core 的 CODESYS 驱动，已针对 CODESYS Control for Linux SL 4.22.0.0 运行时现场验证过读取和写入，也在裸机上验证过（2026-11-17）。连接器里有写入功能，而本产品从不启用它。

以上全部也都在裸机上运行过（2026-11-17）。

## 配置文件目前还不能做的

一个配置文件生成一个画面。它从 `device` 生成一个设备，或从 `devices` 生成任意协议的多个设备，并且刻意没有办法通过它把某个变量标记为可写。
