---
title: "用 Podman 或 Helm 安装 Flow"
description: "用 Podman 或 Quadlet、在 Kubernetes 上用 Helm，或从源码运行 HotLoop Flow {{flow}}。它启动时是锁定的，所以请先设置管理员密码。"
sidebar:
  label: "安装"
---

HotLoop Flow {{flow}} 是当前版本。它以 `ghcr.io/hotloop-io/hotloop-flow:{{flow}}` 发布，是适用于 amd64 和 arm64 的镜像（amd64 镜像在 2.8.0 上按 Podman 的报告为 45.64 MB），另有 Helm chart 和可自行构建的源码。2.9.0、2.9.1、2.10.0、2.11.0、2.12.0、2.13.0、2.14.0、2.15.0、2.16.0、2.16.2、2.16.3、2.16.4、2.16.5 和 {{flow}} 仅有 amd64，而 2.10.2、2.11.1、2.12.1、2.13.1、2.14.1、2.15.1 和 2.16.1 同时为 amd64 和 arm64 构建（2.10.1 有 chart 但没有镜像，所以千万不要固定到它），因此一直停在 2.13.1 的 Pi 或 arm64 机器可以升级到 2.16.1。镜像是 distroless，以非 root 用户运行，里面没有 shell，所以没有可以进入的地方，无论对您还是对不该出现在那里的人。本页没有 Docker 或 Compose 的路径：单台机器用 Podman，要变成服务用 Quadlet，集群用 Helm。

Flow 启动时是锁定的。没有管理员账号它拒绝运行，因为流程可以执行命令。没有凭据密钥它也拒绝运行，这个密钥会加密与您的流程一起保存的每个代理和数据库密码。下面每条路径都会设置这两项。

从 2.2.0 起，上下文和持久连线保存在数据卷上的一个 SQLite 文件 `state.db` 中，所以重启不再会清掉它们。请保留那个卷。如果 chart 中 `persistence.enabled` 为 false，它能挺过容器重启，但挺不过 Pod 被替换。

## Podman

先生成密码哈希。镜像里没有 shell，所以哈希是二进制文件自带的子命令，并且它会拒绝少于八个字符的内容。

```bash
podman run --rm ghcr.io/hotloop-io/hotloop-flow:{{flow}} hash-password -password 'something-long'
```

然后生成凭据密钥，并保存在一年后您仍然找得到的地方：

```bash
openssl rand -hex 32
```

然后运行它。两个值都要放在单引号里，因为 bcrypt 哈希里满是美元符号，否则会被您的 shell 吃掉。

```bash
podman run -d --name hotloop-flow -p 1880:1880 -v hotloop-flow-data:/data \
  -e HOTLOOP_FLOW_ADMIN_USER=admin \
  -e HOTLOOP_FLOW_ADMIN_PASSWORD_HASH='<the hash>' \
  -e HOTLOOP_FLOW_CREDENTIAL_SECRET='<the secret>' \
  ghcr.io/hotloop-io/hotloop-flow:{{flow}}
```

打开 `http://localhost:1880/`，以 `admin` 登录。进程启动后，`/health` 会返回版本，`/ready` 会说明运行时是否真的启动了。

请保管好这个密钥。Flow 写入卷上的一切加密内容，只有用它才能读取。用另一个密钥重新创建容器，所有已保存的代理密码都会丢失，而且它看起来与干净启动完全一样，直到 MQTT 不再认证为止。

## Quadlet

适用于开机启动并自行重启的服务。需要 Podman 4.4 或更新版本。把密钥放进只有您能读取的文件里：

```bash
mkdir -p ~/.config/hotloop-flow ~/.config/containers/systemd
umask 077
cat > ~/.config/hotloop-flow/hotloop-flow.env <<'EOF'
HOTLOOP_FLOW_ADMIN_USER=admin
HOTLOOP_FLOW_ADMIN_PASSWORD_HASH=<the hash>
HOTLOOP_FLOW_CREDENTIAL_SECRET=<the secret>
EOF
```

然后向 systemd 描述这个容器。把下面内容保存为 `~/.config/containers/systemd/hotloop-flow.container`：

```ini
[Unit]
Description=HotLoop Flow
After=network-online.target
Wants=network-online.target

[Container]
Image=ghcr.io/hotloop-io/hotloop-flow:{{flow}}
ContainerName=hotloop-flow
PublishPort=1880:1880
Volume=hotloop-flow-data:/data
EnvironmentFile=%h/.config/hotloop-flow/hotloop-flow.env

[Service]
Restart=always

[Install]
WantedBy=default.target
```

```bash
systemctl --user daemon-reload
systemctl --user start hotloop-flow
```

用户服务只有在您的账号开启 lingering 时才会在开机时启动，并在您注销后继续运行：`loginctl enable-linger`。跳过这一步，它会一直正常运行，直到您注销或机器重启。

## Helm

这个 chart 可在任何 Kubernetes 上运行，包括 k3s。

```bash
helm repo add hotloop-flow https://hotloop.io/hotloop-flow/
helm install line3-flows hotloop-flow/hotloop-flow
```

chart 在首次安装时生成管理员密码和凭据密钥，并在每次升级时从现有的 Secret 中读回这两者，所以升级绝不会在您已保存的凭据之下轮换密钥。安装说明会打印如何读取密码。对于上面的版本：

```bash
kubectl get secret line3-flows-auth -o jsonpath='{.data.admin-password}' | base64 -d
kubectl port-forward svc/line3-flows 1880:8080
```

用户是 `admin`。2.0.2 之前，生成的那个密码从来无法使用，因为应用检查的哈希是由一个与 chart 保存的不同的随机密码生成的。升级以这种方式安装的版本即可就地修复，密码和凭据密钥都不会改变。

一个版本就是一个实例，chart 有意固定 `replicaCount: 1`。每个实例都持有流程状态以及与代理和 PLC 的实时连接。同一个 Service 后面的两个 Pod 会都去订阅、都去写入，InfluxDB 会悄悄把每条读数存两遍。要运行更多实例，请安装另一个带有自己流程的版本。两个版本也可以共同承担一项工作，通过租约让同一时刻只有一个能向设备写入：[带租约的热备](/zh-hans/flow/failover/)。

它也是有意做得很小。默认的 `resources.preset` 是 `small`，请求 10m CPU 和 64Mi 内存。Flow 的进程在空闲时测得常驻内存 16.6 MiB，所以它可以调度到只剩 64Mi 的边缘节点上，而 node-red chart 默认的 512Mi 请求会一直停在 Pending。

Pod 以 uid 65532 运行，根文件系统只读，没有权限提升，使用 `RuntimeDefault` seccomp，并去掉所有 Linux capability，包括发现功能所需的。直到 2.0.4，只要开启发现，chart 就会添加 `NET_RAW` 和 `NET_ADMIN`，用于一个从来没人写过的 ARP 扫描。2.0.5 停止了这样做，您不需要更改已设置的任何内容。

chart 有三种网络模式：

| 模式 | 它得到什么 | 每个节点的实例数 |
|---|---|---|
| `cluster` | 一个 ClusterIP，以及集群能路由的一切。默认值，除非需要第 2 层，否则就是正确答案。 | 不限 |
| `host` | 主机的网络接口、ARP 表和广播域。 | 一个，因为端口属于节点 |
| `macvlan` | 目标 VLAN 上自己的 MAC 和 IP，直接位于有 PLC 的网段上。需要 Multus。 | 不限 |

`macvlan` 正是这些模式存在的原因，因为从只能看到集群路由给它的内容的 Pod 里扫描 PLC 网络毫无意义。它对多实例是安全的，并且直接位于那个网段上，没有端口冲突，因为每个实例都有自己的地址。[Flow README](https://github.com/HotLoop-io/hotloop-flow#deploying-on-kubernetes)完整介绍了这些模式和资源预设。

:::note[chart 在哪里运行过]
chart 已在一个四节点 k3s 集群上以默认的 `cluster` 网络模式安装并验证：登录、通过 API 部署的流程、该流程在 Pod 重启后依然存在、升级，以及通过 Fleet 从 EmberNet App Store 部署。`host` 和 `macvlan` 模式可以渲染，通过 lint，配置错误时会被拒绝，并且已在真实硬件上运行（2026-11-17）。
:::

## 每个标签页一个 VLAN

2.9.0 允许标签页、子流程或单个节点把连接绑定到某个网络接口，因此一个 Flow 可以在一台只有一个端口、却为每台机器各承载一个 VLAN 的设备上，为每台机器保留一个标签页，即使每个 VLAN 使用相同的子网和相同的设备地址。按标签页的方式是在标签页上设置环境变量 `FLOW_NETWORK_INTERFACE`，其上每个客户端节点都会继承它。2.9.1 为 `modbus-server` 节点增加了同样的字段，所以两台服务器可以监听同一个地址和端口，每个 VLAN 一台。

Pod 必须能看到 VLAN 接口，所以请使用主机网络运行：chart 中用 `network.mode: host`，Quadlet 单元中用 `Network=host`。在 Linux 5.7 及更高版本上，把套接字绑定到接口不需要任何 capability。在更旧的内核上需要 `CAP_NET_RAW`，而 chart 的值 `bindToInterface.netRaw`（默认 `false`）只添加这一个 capability，别无其他。这已在共享 `192.168.1.0/24` 的两个网络命名空间组成的实验环境中得到验证，没有任何东西在工厂自己的网络上运行。

## 从 EmberNet App Store 安装

您不需要这样做，运行 Flow 也没有任何 EmberNet 步骤。但 chart 带有 EmberNet App Store 所查找的标签，所以如果您已经在运行 EmberCORE，Flow 就在它的目录中，并显示为一个磁贴。

对于拥有自己集群的租户，EmberCORE 通过 Fleet 部署它，这需要 EmberCORE 4.9.37 或更新版本。更早的版本会创建一个什么都不安装的 Fleet bundle。从 Flow 2.0.3 起，chart 会把 EmberCORE 的租户标签放到它创建的一切对象上。

从 2.0.4 起，已部署的磁贴能正确显示名称和图标。Pod 和 Service 带有 `embernet.ai/app-icon` 注解，默认是 chart 自己的图标，所以 EmberCORE 不再根据发布名称去猜图标，那样从来都对不上。设置 `embernet.appIcon` 可使用您自己的图标，并用 `Access-Control-Allow-Origin` 提供它，否则磁贴会显示空白。`embernet.ai/app-name` 标签现在是 chart 名称，而不是发布名称。实例仍在 `app.kubernetes.io/instance` 和 Service 名称中，没有任何选择器改变，所以就地升级没有问题。

[发布说明](https://hotloop.io/releases/flow/)列出了回溯到 0.1.0 的每个版本。

## 从源码安装

您需要 Go 和 Node。编辑器先构建，并通过 `go:embed` 嵌入二进制文件，所以没有它的 Go 构建会因缺少匹配的文件而失败，而不是交给您一个没有编辑器的二进制文件。

```bash
git clone https://github.com/HotLoop-io/hotloop-flow.git
cd hotloop-flow
(cd web && npm ci && npm run build)
go build -o hotloop-flow ./cmd/hotloop-flow
```

默认数据目录是 `/data`，在容器里是对的，但在您的笔记本上多半不是您想要的，所以请把它指向别处：

```bash
export HOTLOOP_FLOW_DATA_DIR=./data
export HOTLOOP_FLOW_ADMIN_USER=admin
export HOTLOOP_FLOW_ADMIN_PASSWORD_HASH="$(./hotloop-flow hash-password -password 'something-long')"
export HOTLOOP_FLOW_CREDENTIAL_SECRET='<the secret>'
./hotloop-flow
```

## 从 Emberwire 0.1.0 迁移

2.x 是有意为之的干净断裂：0.1.0 没有用户可供破坏，没有用户的兼容层只是缺陷滋生的地方。`EMBERWIRE_*` 变量现在是 `HOTLOOP_FLOW_*`，两种数据库配置节点类型是 `hotloop-flow-influxdb` 和 `hotloop-flow-postgres`，WASM 模块导出 `hotloop_flow_*`，指标是 `hotloop_flow_*`，部署头是 `HotLoop-Flow-Deployment-Rev`。

0.1.0 的凭据文件无法读取。从 2.0.1 起，Flow 会在启动时说明这一点：它指出文件名，说明是 Emberwire 写的，并请您把它放到一边，重新输入凭据。0.1.0 镜像仍在 `ghcr.io/embernet-ai/emberwire:0.1.0`，[发布说明](https://hotloop.io/releases/flow/)列出了每一次断裂。
