---
title: "k3s 和 Helm"
description: "在 k3s 或任何 Kubernetes 上部署任意 HotLoop chart：值得设置的值、数据库的选择、升级与回滚，以及一次良好安装应有的样子。"
---

该 chart 部署两个工作负载：gateway（一个 Deployment，自身不保存持久状态）和 TimescaleDB（带卷的 StatefulSet）。这是默认配置。`database.type` 可选择另一种数据库：纯 PostgreSQL，或 SQLite，后者根本不需要第二个工作负载（[SQLite](#sqlite)，见下文）。

## 安装

通过 EmberNet 仪表板的 App Store，或直接安装：

```bash
helm install hotloop ./charts/hotloop \
  --namespace hotloop --create-namespace
```

或者从 chart 仓库安装，它也是 App Store 所指向的 URL:

```bash
helm repo add hotloop https://hotloop.io/hotloop
helm install hotloop hotloop/hotloop \
  --namespace hotloop --create-namespace
```

第二种方式从 4.16.0 起可用，这是第一个以 `hotloop` 之名发布的版本。在它之前的最后一个版本是旧名称下的 `industrial-iot` 4.3.1，从它升级是单独的流程：见 README 中 4.16.0 说明里的 "Upgrading from 4.3.1"。旧的仓库地址 `https://embernet-ai.github.io/industrial-iot/` 返回 404。

裸安装即可运行。chart 会在发布版本的 Secret 中生成数据库密码和 MCP 令牌，并在升级时复用它们，所以无需提供任何内容，升级也不会在运行中的数据库之下更换密码。

访问它不需要 ingress 或子域名。仪表板通过应用的商店标签发现它，并通过集群内地址代理访问：

```
<release>.<namespace>.svc.cluster.local:8080
```

要直接查看：

```bash
kubectl -n hotloop port-forward svc/hotloop 8080:8080
```

## 值得设置的值

### 认证

自 4.4.0 起。完整模型见[认证和用户](/zh-hans/iot/authentication/)；这里是 chart 一侧的说明。

```yaml
auth:
  enabled: true    # the default; requires a login
  insecure: false  # set true only for a deployment truly isolated behind the
                    # dashboard's own NetworkPolicy -- see AUTH.md
```

当 `enabled: true`（默认）时，chart 会在首次安装时把管理员账户生成到发布版本的 Secret 中，方式与生成数据库密码和 MCP 令牌相同，并在升级时复用：

```bash
kubectl get secret hotloop -n hotloop \
  -o jsonpath='{.data.admin-password}' | base64 -d
```

显式设置 `auth.admin.password` 会覆盖生成的密码。

### 安全

这些值决定此 pod 能否驱动机器。

```yaml
safety:
  allowWrites: false      # the master switch -- off by default since 4.4.0
  allowMcpWrites: true    # agents (MCP) write wherever an operator could, once writes are on
  confirmWrites: true     # the UI asks before writing
```

写入默认关闭。标签在其自己的 `writable` 标志设置之前一直是只读的，超出标签配置范围的值会被拒绝（绝不截断：有人输入 500 时发送 250，就是在悄悄做另一件事），并且每次尝试，**包括每一次拒绝**，都会连同操作者和来源一起记录。但全新安装不应需要三者全部对上才算安全，所以总开关本身从关闭开始。

在部署经过审查后，要打开写入：

```yaml
safety:
  allowWrites: true
```

仅此而已：MCP 客户端像操作员一样读写，权限、可写标签和范围都相同。`allowMcpWrites` 在每个 chart 中默认开启交付；它为做出不同决定的部署而存在，在任何地方都不是默认值。

### 历史记录器

```yaml
historian:
  retentionDays: 90     # 0 keeps everything until the volume fills
  useTimescale: true

logbook:
  retentionDays: 90     # entity state changes; 0 keeps everything (see LOGBOOK.md)

database:
  postgresql:
    persistence:
      size: 20Gi
      storageClass: longhorn
```

规模由标签数量、扫描速率和死区决定。一千个标签、每秒一次、没有死区，大约每天 8600 万行；同一座工厂设置合理的死区后，通常少一个数量级。在购买存储之前先设置死区。

`useTimescale: false` 强制走原生分区路径，这就是在纯 PostgreSQL 上运行的样子。适用于复现边缘部署。

**TimescaleDB 镜像变化时。** 镜像携带每个旧版本的库，所以用旧镜像创建的数据库会在新镜像上继续运行，但使用的是旧的扩展版本，并停留在那里，直到有人运行 `ALTER EXTENSION timescaledb UPDATE`。Gateway 在启动时执行这一步：它把已安装的版本与服务器自带的版本比较，如果不同，就把更新作为新连接的第一条语句运行（TimescaleDB 会在已加载旧版本的会话中拒绝它）。日志会显示 `timescaledb extension updated from=... to=...`。这需要超级用户，而内置数据库的用户正是超级用户。对于不是超级用户的外部或托管数据库，您会收到一条带有要运行命令的警告，同时历史记录在旧版本上继续工作。仅在开启 `useTimescale` 且迁移在启动时运行（`HOTLOOP_DB_MIGRATE`，默认开启）时发生。

### 轮询

```yaml
runtime:
  defaultPollIntervalMs: 1000
  minPollIntervalMs: 100      # a floor applied to every device
  timeoutMs: 10000
  maxConcurrentPolls: 32
```

`minPollIntervalMs` 是强制执行的，而不是依赖信任。对串行 gateway 每 10 ms 轮询一次，是多了几个步骤的拒绝服务。

### OPC UA 客户端

```yaml
opcuaClient:
  persistence:
    enabled: true      # off by default
    size: 64Mi
```

连接到受保护的 OPC UA 服务器，或使用服务器要求加密的用户名和密码登录的设备，会保留一个证书和一个已批准服务器证书的信任库（`HOTLOOP_OPCUA_CLIENT_PKI_DIR`,`/data/opcua-client-pki`）。添加这类设备之前请先开启它：根文件系统是只读的，所以没有这个卷，设备会报告一个说明此事的错误，而不是用下次重启就会丢失的证书去连接。它默认关闭，因为它会给现有安装增加一个 PersistentVolumeClaim，在没有默认 StorageClass 的集群上会一直处于 Pending。不安全通道上的匿名设备不使用它。批准服务器证书以及关于这些设备的其他一切，见[协议和驱动](/zh-hans/iot/protocols/#opc-ua-security-and-credentials)。

### 网络

```yaml
networkPolicy:
  enabled: true
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: dashboard-system
      ports:
        - protocol: TCP
          port: 8080
```

知道仪表板的命名空间之后，把 ingress 收窄到它。egress 是有意不加限制的：这个应用的存在就是为了连接那些没人能事先列举的地址上的设备，而悄悄阻断一次轮询的 egress 策略，看起来更像是驱动坏了，而不是防火墙规则。

### 硬件：USB 无线电、串口适配器和蓝牙

从 4.19.7 起，每个 HotLoop chart(Gateway、IoT、Edge 和 Edge Relay)交付时都开启了硬件所需的访问，所以通过 App Store 或 helm 的裸安装无需手动编辑，就能在 pod 网络上看到插在节点上的设备。它是 `values.yaml` 中的 `hardware:` 块：三个默认开启的开关，以及一个默认关闭的可选项：

| 值 | 默认 | 作用 |
|---|---|---|
| `hardware.privileged` | `true` | 应用容器以特权模式（`privileged: true`、`allowPrivilegeEscalation: true`）和 root(`runAsUser: 0`、`runAsNonRoot: false`、不丢弃 capability)运行。使用 root 是因为 USB 串口节点是 `root:dialout 0660`，而 BlueZ 的 D-Bus 策略允许 root 和 `bluetooth` 组进入；两者都不是的容器用户什么也打不开。根文件系统保持只读，init 容器和内置数据库保持各自的非 root、丢弃全部 capability 的上下文。 |
| `hardware.usbDevices.enabled` | `true` | 节点的 `/dev`(`hardware.usbDevices.hostPath`)挂载到 `/dev`:USB 串口适配器（`/dev/ttyUSB*`、`/dev/ttyACM*`、`/dev/serial/by-id/*`），包括 pod 启动之后才插入的。特权容器只会拿到它启动时存在的设备；让重新插入的设备出现的正是这个挂载。 |
| `hardware.bluetooth.enabled` | `true` | 节点的 D-Bus 目录（`hardware.bluetooth.dbusPath`，即包含 `system_bus_socket` 的 `/run/dbus`）挂载到相同路径，使客户端能连到节点的 BlueZ。在没有 D-Bus 的节点上它会以空目录创建，所以 pod 在那里仍能启动。 |
| `hardware.bluetooth.hostNetwork` | `false` | 可选项，默认关闭，用于需要节点网络的场景：内核的蓝牙套接字（HCI、L2CAP）只存在于节点的网络命名空间中，所以直接打开套接字的客户端，以及在节点自身网络上监听的发现机制（mDNS、SSDP、无线电的多播），都需要它。通过 BlueZ 的 D-Bus API 的客户端只需要挂载的套接字，在 pod 网络上就能工作。开启后，pod 运行在节点的网络上，其后果见[网络](#网络)。 |

HotLoop 目前用它做什么：暂时什么都不做。HotLoop 自己没有蓝牙、Z-Wave 或 USB 串口的代码（Zigbee 通过 MQTT 上的 Zigbee2MQTT 桥接而来，见[内置 MQTT 代理](/zh-hans/iot/broker/)）；这是某个功能，或读取无线电的 sidecar，所需要的访问，在被要求之前就已就位。

代价，是有意且已决定的：pod 在节点上是 root（特权，带有节点的 `/dev`）,chart 的 NetworkPolicy 默认值对其覆盖范围仍然开启。pod 仍留在 pod 网络上。用 `--set hardware.privileged=false --set hardware.usbDevices.enabled=false --set hardware.bluetooth.enabled=false` 可关闭任意部分；三个全部关闭时，渲染结果逐行与 4.19.6 渲染的 pod 相同（非 root、丢弃所有 capability、只读根、pod 网络）。对于需要节点网络的场景，设置 `hardware.bluetooth.hostNetwork=true`（或 `hostNetwork=true`）：页面随后在节点的每个地址上通过 `service.targetPort` 应答，每个节点每个端口一个 HotLoop,NetworkPolicy 不适用于该 pod，并且 `nodeSelector` 会把它固定到应该看到该无线电的节点。

### 边缘部署

应用镜像为 amd64 和 arm64 构建，TimescaleDB 2.30.1-pg17 是多架构的，所以拦住边缘安装的不是历史记录器。

```yaml
resources:
  requests: {cpu: 100m, memory: 128Mi}
  limits:   {cpu: 500m, memory: 256Mi}

database:
  postgresql:
    persistence: {size: 5Gi}
    resources:
      requests: {cpu: 100m, memory: 256Mi}
      limits:   {cpu: 500m, memory: 512Mi}

historian:
  retentionDays: 30

nodeSelector:
  kubernetes.io/arch: arm64
```

### 通过 Sparkplug 向上发布

边缘 Gateway 也可以把它读取的一切作为 Sparkplug B 边缘节点发布到中心 Gateway。它发布什么以及转发队列如何运作，见[边缘发布和存储转发](/zh-hans/edge/edge-publish/)；这里是 chart 一侧的说明。

```yaml
edgePublish:
  enabled: true
  broker: tcp://central.example.local:1883
  group: Plant1
  node: press-line-3          # empty uses the release name
  username: press-line-3
  existingSecret: central-mqtt # key "password", or set secretKey
  tls: false
  queueMaxBytes: 536870912     # 512 MiB; the default is 64 MiB, and 0 is unbounded
  persistence:
    size: 1Gi
```

开启它会改变什么，以及原因：

- **转发队列使用 1Gi 的 PVC**，挂载在 `/data/edge-publish`。上行链路中断期间，读数就堆积在这里，所以它必须比 pod 活得更久。`persistence.enabled: false` 会把它放到 emptyDir 上，它能挨过容器重启，别的都不行。
- **Deployment 以 `Recreate` 滚动。** 队列是一个带锁的文件。滚动更新会先启动新 pod，新 pod 打不开队列，永远不会就绪，发布就永远卡住。Recreate 先停掉旧的；每次升级会损失几秒钟的轮询。
- **`replicaCount` 必须为 1**，否则 chart 拒绝渲染。两个副本就是两个发布者争用同一个 Sparkplug 节点。
- **节点 id 默认为发布版本名称**，而不是 pod 的主机名。主机名每次发布都会变，Sparkplug 主机每次都会看到一个全新的边缘节点。

密码绝不会出现在明文默认值里。对匿名代理，把 `password` 和 `existingSecret` 留空，就不会创建 Secret；设置 `password`,chart 会把它放进 `<release>-edge-publish`；设置 `existingSecret` 则使用您自己管理的 Secret。

### 外部数据库

```yaml
database:
  postgresql:
    enabled: false
    auth:
      existingSecret: my-db-credentials
      secretKey: password
  external:
    host: timescale.plant.local
    port: 5432
    database: industrial
    username: industrial
  sslMode: require
```

应用会检测 TimescaleDB，在扩展存在时把 `tag_history` 升级为 hypertable。面对纯 PostgreSQL 时，它会退回到原生范围分区，而不是失败。

这个决定会被记录，并且是**固定的**。作为 hypertable 创建的数据库，在没有扩展的服务器上会拒绝启动，而不是悄悄写到别处；如果您看到该错误，说明您把应用指向了与其构建时不同的数据库。

### SQLite

数据库是一项设置，而不是一个镜像。每个产品都用同一个二进制在 SQLite、Postgres 或 TimescaleDB 上运行（IoT 跳过 TimescaleDB，见下文）:

| 变量 | 默认 | 作用 |
|---|---|---|
| `HOTLOOP_DB_TYPE` | `postgres` | `postgres` 或 `sqlite`。TimescaleDB 是服务器上带扩展的 `postgres` |
| `HOTLOOP_DB_PATH` | `/data/hotloop.db` | SQLite 文件。只有 SQLite 会读取它 |

SQLite 是纯 Go 版本（`modernc.org/sqlite`），编译进了每个镜像，所以没有第二个容器，SD 卡上没有 300 MB 的 Postgres 镜像，arm 构建仍是静态的。把文件放在比容器活得更久的卷上，在 Pi 上把那个卷放在 USB SSD 上。历史记录器整天往 SD 卡上写，是买很多 SD 卡的办法。

相同之处：每张表、每一列、每个功能。不同之处：

- 历史数据是一张带一个索引的表，不是分区或 hypertable，保留策略会删除旧行，而不是丢弃整月。每秒记录、积累多年历史的现场需要 Postgres 或 TimescaleDB，迁移过去就是一次备份和恢复（BACKUP.md）。
- 同一时间只有一个写入者。SQLite 轮流写入，并在写入的同时读取（WAL），对于一个 HotLoop 和同一文件旁边的一个 `--mcp-stdio` 辅助程序绰绰有余。它不适用于网络存储上的两个副本：NFS 上的 SQLite 会损坏，所以 SQLite 部署是带本地卷的一个 pod。
- 提交是 `synchronous=FULL`：当 API 说已保存时，它已经在磁盘上，不论是否断电。

**HotLoop IoT** 默认保留 30 天历史（设置了 `HOTLOOP_HISTORIAN_RETENTION_DAYS` 时仍以它为准），并且从不构建 hypertable:TimescaleDB 是 Edge 和 Gateway 的一部分。在 IoT 上设置 `HOTLOOP_HISTORIAN_TIMESCALE=true`，它会在启动时说明，并在普通分区上运行。从 Edge 或 Gateway 降级而来、已有 hypertable 的数据库会保留它并继续工作。

#### 在 chart 中选择数据库

一个值，`database.type`，每个产品只接受它能运行的那些：

| `database.type` | 部署什么 | IoT | Edge | Gateway |
|---|---|---|---|---|
| `timescaledb` | 应用和 TimescaleDB（一个 StatefulSet 及其卷）。历史数据存于 hypertable | 拒绝 | 默认 | 默认 |
| `postgresql` | 应用和纯 PostgreSQL 17（一个 StatefulSet 及其卷）。历史数据存于原生分区 | 默认 | 是 | 是 |
| `sqlite` | 仅应用，数据库文件放在它自己的卷上 | 是 | 是 | 是 |

```bash
helm install hotloop hotloop/hotloop-iot --namespace hotloop --create-namespace   --set database.type=sqlite
```

对 IoT 要求 `timescaledb` 会使安装失败，并说明 IoT 运行在什么上（`database.type is "timescaledb", and HotLoop IoT runs on sqlite, postgresql`）,App Store 中的表单也不提供它。`helm lint` 抓不到它（helm 3.22 检查通过），所以拒绝它的是渲染。省略 `database.type` 就是产品自己的默认值，因此从这个键出现之前的版本用 `--reuse-values` 升级，会保留它原来的数据库。

`sqlite` 渲染出：

- `HOTLOOP_DB_TYPE=sqlite` 和 `HOTLOOP_DB_PATH=/data/db/hotloop.db`，没有任何 Postgres 连接设置。没有数据库 pod,Secret 里没有数据库密码，也没有等待它的 init 容器。
- 一个名为 `<release>-db` 的 PersistentVolumeClaim（`database.sqlite.persistence`:`size`、`storageClass`、`accessMode`，起始为 10Gi 和集群默认值），挂载在 `/data/db`。是目录，不是文件：SQLite 在数据库旁边保存 `-wal` 和 `-shm`。把它放在本地存储上；NFS 上的 SQLite 会损坏。
- Deployment 使用 `Recreate`，而不是滚动更新，因为卷是 `ReadWriteOnce`，而且文件只有一个写入者。`replicaCount` 大于 1 会使安装失败。

NetworkPolicy 保持不变且开启：应用自己的策略仍然适用，数据库策略只在有数据库 pod 需要保护时才渲染。

在已有数据的发布版本上更改 `database.type` 不会迁移数据。新数据库从空开始，所以把工厂在数据库之间迁移就是一次备份和恢复（BACKUP.md），与使用变量时一样。特别是，作为 TimescaleDB hypertable 创建的数据库会拒绝在纯 PostgreSQL 上启动，所以不要把现有的 Edge 或 Gateway 从 `timescaledb` 切换到 `postgresql` 并指望它能起来。

#### 在 Quadlet 中选择数据库

`deploy/quadlet/` 下每个产品的目录里有原样的 PostgreSQL 或 TimescaleDB 文件，旁边还有一个 `sqlite/` 目录：`hotloop.container` 和 `hotloop-data.volume`，仅应用，文件位于 `hotloop-data` 卷上的 `/data/hotloop.db`。它跟随 `:stable`，并以同样的方式回滚有问题的更新。安装这两个文件来代替其他文件（它们使用相同的单元名），并创建两个密钥而不是三个：没有数据库密码。步骤见 [`deploy/quadlet/README.md`](/zh-hans/install/quadlet/)。

在 Quadlet 下对 Edge 或 Gateway 使用普通 Postgres 分区，请保留 TimescaleDB 单元，并在 `hotloop.container` 中加入 `Environment=HOTLOOP_HISTORIAN_TIMESCALE=false`。IoT 的单元本来就运行纯 PostgreSQL。

### 设备凭据密钥

```yaml
secretKey:
  enabled: true
  existingSecret: ""     # or a Secret you manage, with the key under secret.key
```

设备密码（UniFi 控制台登录、OPC UA 或 MQTT 密码、HTTP API 密钥）在数据库中用这个密钥加密，所以转储或备份里只有密文。开箱即用时，chart 会在首次安装时生成一个到 `<release>-secret-key`，在升级时保留它，在 `helm uninstall` 时也保留（`helm.sh/resource-policy: keep`），因为保留在卷上的数据库没有它就无法使用其中的凭据。它以文件方式挂载，并作为 `HOTLOOP_SECRET_KEY_FILE` 传入，绝不作为环境变量。

请把 Secret 与数据库备份分开备份：密钥放在它所保护的备份旁边，就什么也保护不了。要使用您自己的密钥，`hotloop gen-secret-key` 会输出一个。在 Kubernetes 之外，把它写入只有 HotLoop 能读取的文件，并让 `HOTLOOP_SECRET_KEY_FILE` 指向它。没有密钥时 HotLoop 照常运行，在启动日志中说明设备密码按输入原样存储，并拒绝保存 UniFi 控制台。已存储的凭据会在首次带密钥启动时加密。这对恢复意味着什么，见[备份与恢复](/zh-hans/iot/backup/#设备凭据与密钥)。

## 配置，以及设置界面可以更改的内容

几乎每项设置都来自一个环境变量，chart 通过 Helm 值来设置它。这是正确的位置：决定此进程能否指挥机器的配置属于部署，经过审查，而不属于网页上的表单。

**设置**界面显示全部内容：每项设置、它的生效值、它来自数据库、环境变量还是内置默认值，以及改变它的变量。大部分是只读的，这正是要点：它回答的问题是“它为什么这样做，我该改什么?”

有四项设置是工厂的身份而不是行为，可以在那里编辑。它们存储在数据库中并立即生效，因为工厂改名的频率远高于重新部署的频率：

| 设置 | 它覆盖的变量 |
|---|---|
| 工厂名称 | `HOTLOOP_PLANT_NAME` |
| 站点 ID | `HOTLOOP_SITE_ID` |
| 时区 | `HOTLOOP_TIMEZONE` |
| 写入前确认 | `HOTLOOP_CONFIRM_WRITES` |

设置之下有一些卡片是数据而不是配置，出于同样的原因可以编辑：**用户**（[认证和用户](/zh-hans/iot/authentication/)）、**报警升级**（说明无人确认报警时接下来通知谁以及何时通知，见[报警通知](/zh-hans/iot/notifications/#升级)），以及历史记录器目标和 MQTT 登录。升级可以使用的渠道仍属于部署，由 `HOTLOOP_NOTIFY_*` 设置。

已存储的值优先于环境变量，所以 chart 的值成为起点，而不是最终决定。机器无法解析的时区会被拒绝，而不是被接受后悄悄忽略，否则每个时间戳都会退回到 UTC，却没有任何提示说明原因。

部署自身的值也是如此。如果 `HOTLOOP_TIMEZONE`（或者在它未设置时的 `TZ`）指向一个无法加载的时区，HotLoop 会拒绝启动，错误中会指明变量和值。它过去会耸耸肩，然后按 UTC 运行。报告、计划和班次时间都按工厂的时钟运行，差了几个小时的猜测，比一个说明为何起不来的 pod 更糟。

站点位置是 `HOTLOOP_SITE_LATITUDE` 和 `HOTLOOP_SITE_LONGITUDE`(chart:`plant.latitude`、`plant.longitude`)，十进制度数，北纬和东经为正。日出、日落以及太阳的实体和触发器由它们在设备上计算（[太阳](/zh-hans/iot/sun/)）。要么两个都设置，要么都不设置，错误的值会指明变量并停止启动。设置界面以只读方式显示它们：规则在日出时触发，所以移动它就是一次部署。

**安全开关不可编辑，以后也不会。** `HOTLOOP_ALLOW_WRITES` 是此进程能否指挥设备的总控制；一个能从发出写入的同一浏览器会话重新打开的控制，不是控制。`HOTLOOP_HISTORIAN_RETENTION_DAYS` 同样只属于部署：保留策略在启动时应用到数据库，所以界面上的字段看起来有效，却不会移动任何数据。端点会**按名称**拒绝可编辑集合之外的任何键，而不是忽略它。

有一项限制，因为界面也这样说明所以在此写出：MCP 服务器在启动时构建它的指令，所以在 pod 重启之前，它宣告的是它启动时的工厂名称。其他一切在下一个请求时就会采用新名称。

## PostgreSQL 17

HotLoop 的数据库是 PostgreSQL 17(Edge 和 Gateway 在其上使用 TimescaleDB 2.30.1,IoT 以及 `database.type: postgresql` 使用纯 PostgreSQL 17.11)。此前的版本运行 PostgreSQL 16，而 PostgreSQL 不会打开另一个主版本的数据目录。所以迁移在升级时替您完成，没有任何需要运行的东西。

**在 chart 上，** 数据库 pod 会获得两个 init 容器。第一个运行 PostgreSQL 16 镜像，仅当卷中有 16 的数据时，才把那个安装复制到一个临时卷中。第二个运行新镜像，并 `pg_upgrade` 到旧目录旁边的新目录。两者都不会动全新的卷，或已经在 17 的卷。升级就是 `helm upgrade`，没有别的。预期数据库 pod 会在 `Init` 停留与复制数据所需一样长的时间，应用会等待它；`kubectl logs <release>-postgresql-0 -c pg-upgrade` 就是日志。

**在 Quadlet 上，** `hotloop-db-upgrade.container` 在 `hotloop-db.service` 之前运行，并在 oneshot 单元中做同样的事。把您产品目录中的新 `hotloop-db.container`、`hotloop-db-upgrade.container` 和 `hotloop-db-upgrade.sh` 复制到单元目录，然后重启数据库单元；命令见 [Quadlet README](/zh-hans/install/quadlet/)。数据库单元需要升级单元，所以只收到新数据库单元的设备不会在 16 的数据上启动，并会说明原因：它会失败，而不是猜测。`journalctl -u hotloop-db-upgrade` 就是日志。该单元仅在卷中有 16 的数据时运行：在新设备上，以及升级之后的每次启动，systemd 都会跳过它（显示为 inactive，而不是 failed），并且 PostgreSQL 16 镜像永远不会被拉取。当卷中确有 16 的数据时，该单元会先拉取该镜像。

它按顺序做的事，全部在 `hotloop-pg-upgrade.sh` 中（一个文件，与 chart 和各单元运行的是同一个）:

1. 没有数据目录，或已经在 17：什么也不做，并说明。任何其他主版本都会被拒绝，不做任何更改。
2. 在一个私有套接字上启动旧服务器一次，并干净地停止它，这会重放断电后的日志，并读取新集群必须匹配的编码和区域设置。
3. 用这些设置对旧目录旁的新目录执行 `initdb`，以复制模式运行 `pg_upgrade`（旧目录只读），并把 `postgresql.conf`、`postgresql.auto.conf`、`pg_hba.conf` 和 `pg_ident.conf` 带过去。
4. 启动新服务器一次，证明它能以最终设置打开，并收集 `pg_upgrade` 不会带过去的规划器统计信息。
5. 只有这时才交换名称：旧目录变成 `pgdata.pg16`，新目录成为 `pgdata`。

它需要的数据旁空闲空间，大致与数据本身占用的一样多，并在开始前检查。如果步骤 5 之前有任何失败，升级以非零状态退出，16 的数据与原来完全一样，数据库也不会在半成品目录上启动：在 chart 上 pod 停留在 `Init:Error`，在 Quadlet 上升级单元失败，其后的数据库单元永远不会启动。修复日志所说的问题后再启动；未完成的尝试会被清除并重做。TimescaleDB 扩展以它原来的版本迁过来，应用会在下次启动时把它更新到随附版本，一如既往。TimescaleDB 自己对 PostgreSQL 原地升级的指导是使用新旧二进制的 `pg_upgrade`([Tiger Data,"Upgrade PostgreSQL"](https://www.tigerdata.com/docs/deploy/self-hosted/upgrades/upgrade-pg))。

备份就是旧目录本身。复制模式的 `pg_upgrade` 从不写入它，所以 `pgdata.pg16` 就是当时完整的 PostgreSQL 16 数据库，这是比转储更好的备份，也是使下面的回退路径成为可能的唯一东西。HotLoop 自己的备份（[备份与恢复](/zh-hans/iot/backup/)）是由运行中的应用通过运行中的数据库完成的，所以不能在数据库启动之前运行的步骤中进行。升级之前仍请在旧版本上做一份，并把它复制出设备。

### 回退

`helm rollback`，或放回之前的 `hotloop-db.container`，会让数据库回到 PostgreSQL 16 镜像（Podman 的自动更新不会这样：它只移动应用），而 PostgreSQL 16 不会打开 17 的目录（`database files are incompatible with server`，日志说该目录由版本 16 初始化）。什么都没有丢失，也没有半成品更改；数据库只是不启动。之前的版本需要的是它自己的 16 目录，即 `pgdata.pg16`。停止数据库，然后把名称放回去：

```sh
# chart: after the rollback, stop the database, swap in a one-off pod, start it
kubectl -n hotloop scale statefulset/hotloop-postgresql --replicas=0
kubectl -n hotloop run pgswap --rm -it --restart=Never --image=busybox \
  --overrides='{"spec":{"securityContext":{"runAsUser":999,"fsGroup":999},"containers":[{"name":"pgswap","image":"busybox","command":["sh","-c","cd /d && mv pgdata pgdata.pg17 && mv pgdata.pg16 pgdata"],"volumeMounts":[{"name":"d","mountPath":"/d"}]}],"volumes":[{"name":"d","persistentVolumeClaim":{"claimName":"data-hotloop-postgresql-0"}}]}}'
kubectl -n hotloop scale statefulset/hotloop-postgresql --replicas=1

# Quadlet: the volume is named hotloop-db
sudo systemctl stop hotloop.service hotloop-db.service
d=$(sudo podman volume inspect hotloop-db --format '{{.Mountpoint}}')
sudo mv "$d/pgdata" "$d/pgdata.pg17" && sudo mv "$d/pgdata.pg16" "$d/pgdata"
```

这就是升级时的数据库，此后写入的内容都不在其中。换回只能用一次：只要 `pgdata.pg16` 还挡在路上，升级就拒绝运行，所以下一次升级尝试需要先处理 `pgdata.pg17` 和旧目录。向前走才是路，回滚是给完全无法运行 17 的设备用的。应用自己的回滚规则没有变化：16 目录的模式是升级前的版本留下的，发现不认识的迁移的版本会说明，见[迁移只增加](/zh-hans/iot/migrations/)。

### 当您满意时

`pgdata.pg16` 会一直保留到您删除它，因为删除它就是删除唯一的回退路径。它和数据库一样大。当设备在 17 上运行了您想要的时长之后：

```sh
# chart
kubectl -n hotloop exec hotloop-postgresql-0 -c postgresql -- rm -rf /var/lib/postgresql/data/pgdata.pg16
# Quadlet
sudo rm -rf "$(sudo podman volume inspect hotloop-db --format '{{.Mountpoint}}')/pgdata.pg16"
```

### 关闭它

`database.postgresql.upgrade.enabled: false` 会移除 init 容器。仍在 16 的卷随后会阻止数据库启动，迁移要由您自己完成。请保持开启：开启时，全新安装仍会在每个节点拉取一次 PostgreSQL 16 镜像，因为 init 容器的镜像在运行之前就会被拉取，然后它永远不会运行它。

## 从 3.x 升级

**这是替换，不是升级。** 3.x 是另一个产品。它的数据没有迁移路径，因为它与标签历史记录器没有共用任何数据模型。

```bash
helm uninstall hotloop -n hotloop
# keep or delete the old PVCs deliberately, they hold the HA recorder database
helm install hotloop ./charts/hotloop -n hotloop
```

已不存在、设置后会被拒绝的东西：`sidecarProxy`、`homeassistant`、`mqtt`/`nodered`/`esphome`/`zigbee2mqtt` 附加组件、`devices`、`cameras`、`customConfig`、`network.hostNetwork`。

## 回滚更新

`helm rollback hotloop -n hotloop` 会放回上一个版本的镜像。它不会放回数据库：版本在启动时迁移，这已经做完了。规则和检查见[迁移只增加](/zh-hans/iot/migrations/)。

跨越 PostgreSQL 17 版本的回滚确实会放回的一样东西是数据库引擎：chart 的数据库镜像回到 16，它打不开已升级的目录。[回退](#回退)是出路。

回退一个版本是安全的。数据库会记录每个迁移是由哪个版本应用的，发现迁移来自比自己新两个或更多版本的版本会拒绝启动：

```
refusing to start: this database's schema is more than one release ahead of
HotLoop 4.18.10. ...
```

这不是需要绕开的故障。它意味着数据库已经走到了这个版本从未运行到过的地方。向前走到认识该模式的版本，也就是最新的版本，或恢复由您当前版本制作的备份（[备份与恢复](/zh-hans/iot/backup/)）。正好回退一个版本可以启动，日志中会有一条指明两个版本的警告。升级前请先备份；回滚无法撤销更新版本写入的数据。

## 验证安装

```bash
kubectl -n hotloop get pods
kubectl -n hotloop logs deploy/hotloop | head -20
```

健康的启动会说明它使用的协议，应用迁移，报告历史模式，并对任何值得知道的事项发出警告：

```
msg=starting version=4.0.0 protocols="[ethernet-ip http modbus mqtt mtconnect opcua s7comm]"
msg="writes are ENABLED: the UI, API, automations and MCP can all command devices"
msg="tag_history promoted to a hypertable" timescale=2.30.1
msg="history schema ready" mode=timescale
msg=listening addr=:8080 mcp=/mcp writes=true
```

然后检查仪表板需要的标签。这是能发现偏差的检查，断言**集合**，而不是数量，因为数量检查在集合错误时仍会通过：

```bash
kubectl -n hotloop get svc <release> -o json \
  | jq -r '.metadata.labels | keys[] | select(startswith("embernet.ai/"))'
```

在 Service 和 pod 上正好四个：

```
embernet.ai/app-name
embernet.ai/gui-port
embernet.ai/gui-type
embernet.ai/store-app
```

如果应用在运行，却没有出现在运行中的应用里，Service 标签是最先该看的地方：仪表板按 `embernet.ai/store-app` 查询 Service。

通过 App Store 的部署会从仪表板传入的 `tenantLabels` 再添加五个：`embernet.ai/tenant`、`app-id`、`source`、`deployed-by` 和 `deployment-id`。它们会加到 chart 渲染的每个资源和 gateway pod 上。仪表板只从 Service 读取租户，不会从别处读取，所以其 Service 上没有 `embernet.ai/tenant` 的商店部署的 Gateway 不属于任何人。普通的 `helm install` 不会渲染这五个中的任何一个。

## 探针

- `/healthz`,liveness。进程在运行时应答。
- `/readyz`,readiness。另外还需要数据库，所以失去历史记录器的 pod 会停止接收流量，而不是提供一个什么都回答不了的界面。

启动探针允许两分钟，因为首次安装会运行迁移，liveness 探针不能在迁移中途把它杀掉。

## 关闭

`terminationGracePeriodSeconds: 45`。收到 SIGTERM 时，应用停止接受请求，然后排空历史记录器队列，使已经采集的读数被写入而不是丢弃。宽限期缩得太短，会丢失正在处理中的内容。

## 故障排除

**设备停在 `connecting`。** 查看设备卡片上的 `lastError`。最常见的是 pod 与设备之间的防火墙，或端口错误。chart 不限制 egress，所以阻止它的 NetworkPolicy 是集群上的其他东西。

**标签读到的质量为坏。** 设备应答了，但该点位没有。对于 Modbus，检查地址基数，如果您的图纸使用 40001 编号，则用 `oneBased`。对于 OPC UA，检查节点 id 是否已解析；优先使用 `nsu=` 形式。

**数值看起来合理但是错的。** 在 Modbus 上，这是字序问题，试试 `CDAB`。这是不会自己报错的故障，因为数字并不明显错误。

**没有任何内容被历史记录。** 检查协议界面的诊断信息。`filtered` 统计被死区抑制的读数，这是按预期工作；`dropped` 统计因数据库跟不上而丢失的读数，这就不是了。

**MCP 返回 401。** 是 bearer 令牌。从发布版本的 Secret 中读取它。

**每个 `/api/` 请求都返回 401。** 一旦 `auth.enabled` 为 true 而且还没有人登录，这是预期的，这正是 4.4.0 的意义所在。从发布版本的 Secret 中读取生成的管理员密码（见[认证](#认证)），通过界面登录，或直接 `POST /api/auth/login`。见[认证和用户](/zh-hans/iot/authentication/)。

**丢失了管理员密码，也没有其他管理员账户。** 生成新的哈希并修补 Secret，然后重启 pod 让它重新读取环境；`EnsureAdminUser` 不会动已存在的账户，所以这会直接替换该行，而不是通过 chart:

```bash
hotloop hash-password -password 'a-new-one'
kubectl exec -n hotloop deploy/hotloop -- \
  psql "$DATABASE_URL" -c \
  "UPDATE users SET password_hash = '<the hash>' WHERE username = 'admin'"
```

**自动化已启用但没有运行。** 它编译失败了。自动化界面会把它显示为 NOT ARMED 并给出原因，系统日志中有该错误。
