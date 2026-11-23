---
title: "HotLoop for CODESYS 路线图"
description: "HotLoop for CODESYS 已经构建、发布并在真实硬件上运行过的内容。"
sidebar:
  label: "路线图"
editUrl: false
---

这是已完成和待完成事项的清单，按完成顺序排列。它不承诺任何不在代码或测试计划中的内容，[现状](/zh-hans/codesys/where-it-stands/)说明了它已运行到什么程度。

## 已构建

- [x] 围绕 HotLoop Edge 的 chart，带有节点上运行时的默认值：SQLite、一个副本，以及在控制平面丢失时保留两个 Pod 的容忍设置。
- [x] 一个应用配置文件并使其保持正确的 provisioner，带有保护人工修改的修订号。
- [x] 一个可携带 HotLoop 所支持任意协议设备列表的配置文件，使监听器无需 PLC 即可配置完毕地恢复。
- [x] 针对容器中的 CODESYS Control for Linux SL 4.22.0.0 运行时，无需手工步骤创建的设备、tag、报警和画面。
- [x] 运行时重启后无需人工干预的恢复，约 88 秒。
- [x] 来自 EmberCORE 仪表板的签名登录，以及各种拒绝情形。

## 已发布

- [x] HotLoop 4.22.0，chart 所封装的版本。
- [x] 发布在 `https://hotloop.io/hotloop-codesys/` 的 chart，最新为 0.3.8。
- [x] 公开的 provisioner 镜像，无需登录即可拉取，0.3.3。
- [x] 从 0.3.3 和 chart 0.3.8 起提供多架构 provisioner 镜像，amd64 和 arm64。
- [x] 一个 UDP 端口上的两个 OPC UA PubSub 监听器，随 HotLoop 4.22.0 和 chart 0.3.7。
- [x] 每个 chart 的[发布说明](/zh-hans/releases/codesys-0-3-10/)，从 0.3.0 到 0.3.10。

## 已在裸机上验证

- [x] 已在裸机上运行（2026-11-17），包括像员工那样从真实的 App Store 页面安装、k3s v1.35.7、一个在保留 Pod 的情况下真正失去与控制平面连接的节点、运行时保持运行时从 CODESYS IDE 下载、在一个节点上位于 HotLoop Pod 旁边使用主机自身网络的运行时，以及开启用户管理并使用证书保护的 OPC UA 端点的运行时。

## 待构建

- [ ] 一个配置文件中支持多个画面。
