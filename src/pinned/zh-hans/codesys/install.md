---
title: "安装 HotLoop for CODESYS"
description: "从 EmberCORE App Store 或用 Helm 安装 HotLoop for CODESYS：节点需要什么、配置文件 Secret、它自己做什么，以及如何检查。"
sidebar:
  label: "安装"
---

HotLoop for CODESYS 是一个 Helm Chart，名为 `hotloop-codesys`，它在运行 CODESYS 运行时的同一节点上安装 HotLoop Edge 和一个配置器。Chart 发布在 `{{codesysChartRepo}}`，最新版本是 {{codesys}}，配置器镜像无需登录即可拉取。在 EmberNet 上它是 App Store 应用。没有 EmberNet 时，它就是 k3s 上的 Helm。

## 节点首先需要什么

- **同一节点上的 CODESYS 运行时，并在 4840 端口发布它的 OPC UA 服务器。** 配置器从 Kubernetes 获取节点自己的地址，并读取 `<node address>:4840`。运行时自己的 Chart 会在主机上发布该端口。
- **PLC 程序中的 Symbol Configuration**，开启 *Support OPC UA features*，列出你想看到的变量，或者在声明中给它们加上 `{attribute 'symbol' := 'read'}`。没有 Symbol Configuration 的 PLC 会用一条提示添加的消息回应设置请求。这是对 PLC 项目唯一的改动。
- **HotLoop {{codesysNeeds}}**，由该 Chart 封装。CODESYS 连接器随 HotLoop 4.19.4 一起提供。该 Chart 依赖 `~{{codesysNeeds}}` 系列的 `hotloop-edge` Chart。
- **一个配置文件。** 一个带一个键的 Secret。[配置文件页面](/zh-hans/codesys/profile/)里有它的格式。

## 通过 EmberCORE App Store

该 Chart 标记为供员工使用，所以 Store 只向 EmberNet 员工列出它，由他们安装到客户的租户上。这不是租户自己点的按钮，所以请询问负责你的租户的人。Store 会把配置文件以 `<release>-profile` 的名称写入租户的命名空间，把选定的节点和租户的标签传给 Chart，并传入仪表板的公钥用于登录。之后就没有别的事要做了。

## 通过 Helm

```bash
kubectl -n <namespace> create secret generic <release>-profile --from-file=profile.json
helm repo add hotloop-codesys {{codesysChartRepo}}
helm repo update
helm install <release> hotloop-codesys/hotloop-codesys --version {{codesys}} -n <namespace>
```

把 Secret 命名为 `<release>-profile`，或用 `profile.existingSecret`（Secret）和 `profile.key`（键，默认 `profile.json`）更改 Chart 查找的内容。要把安装固定在运行时所在的节点，设置 `nodeSelector`。如果只要 HotLoop、不要配置文件、想手动设置，用 `--set provisioner.enabled=false` 安装。

## 运行时在节点网络上

用自己的 Chart 并设置 `network.hostNetwork=true` 安装的运行时，会为 WebVisu 占用主机的 8080 端口，所以 HotLoop 的页面在那里不能同时监听 8080。该 Chart 让 HotLoop 的页面在 pod 内监听 8090，并让 Service 保持在 8080，所以 App Store 图块和配置器仍像以前一样访问它。安装时对两者都开启主机网络：

```bash
helm install <release> hotloop-codesys/hotloop-codesys --version {{codesys}} -n <namespace> \
  --set hotloop-edge.hostNetwork=true --set hotloop-edge.service.targetPort=8090
```

HotLoop 的 OPC UA PubSub 监听器会独占一个 UDP 端口，所以同一个端口上的两个监听器不能同时连接。配置器会拒绝提出这种要求的配置文件，并说明原因。

## 安装会做什么

1. HotLoop Edge 在该节点上启动，使用节点 local-path 存储上的 SQLite。没有数据库 pod，一个副本，更新策略是 `Recreate`。
2. 配置器在同一节点上启动。它在每一遍都读取挂载的配置文件，所以较新的配置文件能到达正在运行的安装。它等待 HotLoop 和节点自己的 CODESYS 运行时，然后设置配置文件中的设备、变量、报警和画面。
3. 它每五分钟再看一次，并随着 PLC 程序的变化让设备保持正确。配置文件列出而 PLC 现在有的变量会被加入，PLC 不再有的变量会被读作坏值，并带有服务器给出的原因。
4. 两个 pod 都容忍 `node.kubernetes.io/unreachable` 和 `not-ready`，不设置 `tolerationSeconds`，所以失去控制平面的节点会保留它们。Chart 自己带着这一点，不依赖集群的设置。

OPC UA 服务器、内嵌 broker、边缘发布和备份是关闭的，因为运行时旁边都不需要它们。如果需要，可通过 `hotloop-edge` 的 values 开启其中一项。

## 检查

```bash
kubectl -n <namespace> logs deploy/<release>-provision
```

一次良好的启动会说明设备已连同其变量设置好，没有可写的变量，并且报警和画面已创建。打开 HotLoop 服务，以 `admin` 登录，查看设备和仪表板。admin 密码在 release 的 Secret 中，与任何 HotLoop Chart 一样。

## 从仪表板登录

从 HotLoop 4.19 起，Edge Chart 根据 EmberCORE 仪表板签名的断言让人登录（`embernetSignin` values、四个 `HOTLOOP_AUTH_ASSERTION_*` 变量，以及 Service 注解 `embernet.ai/signin: assertion`）。该 Chart 从 `hotloop-edge` 子 Chart 继承这一切，Store 会把公钥传给它。配置器使用 Chart 的 admin 账号，本地登录仍然允许它。在测试集群中，正确的断言让人以 operator 或 admin 的身份登录，而针对错误应用、错误租户、已过期、错误签发者的断言以及被篡改的断言都被拒绝了。

## 已运行到什么程度

它已在实体硬件上运行过（2026-11-17），Chart 用 Helm 从线上索引渲染。[当前进展](/zh-hans/codesys/where-it-stands/)。

