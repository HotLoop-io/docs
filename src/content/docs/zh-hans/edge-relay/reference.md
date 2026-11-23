---
title: "Edge Relay 参考"
description: "无界面的 Sparkplug B 轮询转发节点：它做什么、每一项设置、磁盘队列、设备群配置以及如何部署。"
---

Edge Relay 自 4.6.0 起是第二个二进制文件，独立运行：一个轮询并转发的 Sparkplug B 边缘节点，没有数据库、没有网页界面、没有认证，也没有写入路径。它用来运行在 Pi 或边缘的小型工业 PC 上，把读到的一切，通过 4.5.0 加入的同一个 Sparkplug B 发布器，转发给运行在别处、带真正数据库的完整 Gateway。

4.5.0 自己的说明就直接讲过：Edge Publish 是一项可以在完整 Gateway 进程内打开的功能，“还不是独立的、更轻量的 Edge Relay 版本”。这就是那个版本。

## 它不是什么

**不是选项更少的缩小版 Gateway。** 它是另一个二进制文件，依赖少得多。它不含数据库、网页界面、认证、MCP 服务器或客户端、自动化引擎，也没有实体注册表。

**不能提供界面、接受写入或应答 MCP 工具调用。** 这三件事都需要这个二进制文件有意不具备的东西：一个可以把操作记到其名下的已认证身份。Edge Relay 不做任何决定，也不向人确认任何事；它读取并转发。

**不通过数据库配置，也没有自己的配置 API。** 设备和变量来自启动时读取的本地 JSON 文件，或来自 Gateway 通过代理推送的文件，推送的文件会立即生效（见[配置推送](#配置推送-480)）。Relay 上没有任何东西监听新配置：唯一的入口，是它本来就向外拨出的代理连接。

## 各部分如何配合

内部复用的是 Gateway 真正的轮询引擎，而不是重新实现一份：同样的工作线程、重连与退避、轮询循环代码，作为 Gateway 的一部分已在生产中运行，在这里原样运行。不同的是*配置和历史数据去往何处*。

轮询之后的一切，即驱动、变量总线、Sparkplug 发布器、磁盘上的转发队列，与设置了 `HOTLOOP_EDGE_PUBLISH_ENABLED` 时 Gateway 所用的代码完全相同。该发布器实际做什么，请看 Edge Publish 页面：Birth、序列号、中断期间的缓冲、重连时的回放。这些在这里都没有变化；这个二进制文件只是到达同一个 `Offer()` 调用的另一条路。

## 设备文件

```json
{
  "devices": [
    {
      "id": "press-01",
      "name": "Press 1",
      "protocol": "opcua",
      "address": "opc.tcp://press-01.local:4840",
      "enabled": true,
      "pollIntervalMs": 1000
    }
  ],
  "tags": [
    {
      "deviceId": "press-01",
      "name": "Zone1_Temp",
      "address": "ns=2;s=Zone1.Temp",
      "dataType": "float",
      "enabled": true
    }
  ]
}
```

变量具备 Gateway 变量的一切能力，包括 `noData`：一份表示“没有测量值”的原始值列表（例如记录仪的 0x8005），每个值带一个原因，因此失效的通道在 Relay 上和 Sparkplug 数据流里显示为质量不良，而不是一个数字。见[无数据值](/zh-hans/iot/protocols/#无数据值)。

Gateway 的七个协议驱动全部编译在内：OPC UA、Modbus、MQTT/Sparkplug B、EtherNet/IP、S7comm、MTConnect 和 HTTP。设备文件格式中没有任何专属于 Edge Relay 的部分。

### 发现 (4.18.10)

Relay 可以像 Gateway 一样监听 MQTT 代理，寻找自行宣告的设备（见 [MQTT 发现](/zh-hans/iot/mqtt-discovery/)），并读取、转发它听到的内容。在设备文件中写明代理：

```json
{
  "devices": [],
  "tags": [],
  "discovery": [
    {
      "id": "yard",
      "broker": "10.0.0.5:1883",
      "username": "hotloop",
      "password": "...",
      "prefix": "homeassistant",
      "listenOnly": true,
      "tasmota": true,
      "shelly": true
    }
  ]
}
```

`id` 为 1 到 63 个小写字母、数字和 `-`，且不能是 `embedded`。`broker`、`username`、`password`、`useTls` 和 `insecureSkipVerify` 与 Gateway 的设置、MQTT 所接受的一致，并由同一份代码检查。`prefix` 默认为 `homeassistant`，`tasmota` 和 `shelly` 默认开启。没有写明任何代理的文件，不会改变 Relay 的运行方式。

它听到的内容会成为设备和变量，由 Gateway 所运行的同一份代码创建（`homeassistant/` 格式、Tasmota 自己的格式、Shelly 的状态），并像其他设备一样被轮询、通过 Sparkplug 转发。设备的 id 由代理的 id 和设备自报的身份生成，每次都相同（`disc-<identity>-<hash>`），所以重启后的 Relay 给指标起的名字不变。设备在宣告后几秒内出现，被撤回的设备会在一次 Rebirth 中从节点的 Birth 里消失，两者都不会影响 Sparkplug 会话或转发队列。增加或移除代理的推送文件同样立即生效。

**它发现的任何东西都不能被置为可写。** 不是因为某项检查这么说。发现创建的每个变量都与 Gateway 一样是只读的；它创建的每个设备都未被接受；Relay 上没有人去接受；而且 Relay 根本没有写入路径，所以发给被发现点位或任何点位的命令，在接近设备之前就会被拒绝。对此的测试，是让一个允许写入的 Relay 去打开一个被发现的水泵，然后检查水泵的命令主题保持静默。

你可以下命令的设备，是以相反的方向到达 Relay 的：你在 Gateway 上接受它，把要用的点位置为可写，再推送文件。当文件中有一个 Relay 也能听到的设备（相同的代理 id，或相同的地址和相同的身份）时，以文件为准，被发现的副本不会创建，因此同一个设备绝不会被转发两次。

`listenOnly` 默认开启，除非你关闭它，开启时 Relay 不会向该代理发布任何东西：不发让发布器重新宣告自己的 Birth 消息，不发 Shelly 的 `status_update`，也不发 Tasmota 的电源查询。只在变化时才发声的设备，在它发声之前读数为未知。关闭后，只有这些内容会被发送，发往 DISCOVERY.md 中指明的主题。

Relay 不保存它听到的任何内容。`homeassistant/` 和 Tasmota 的配置以 retained 方式保存在其代理上，Relay 启动时会重新获得；Shelly 在有变化时就会报告状态，所以自 Relay 启动以来一直安静的设备，要等它发声才会出现。这一点，加上没有数据库来记住已接受的设备，就是它与 Gateway 的区别。

`/status` 会在 `discovery` 下为每个代理说明：是否正在监听并已连接，收到、丢弃和拒绝了多少消息，有多少问题，以及发现所创建的设备和变量数量。它不会说明代理在哪里，也不会说明问题出在哪个主题上。

### 设备文件中的凭据 (4.15.0)

Relay 的 OPC UA 驱动就是 Gateway 的驱动，所以设备可以在其 `config` 块中携带 OPC UA 的 `username` 和 `password`（以及[协议与驱动](/zh-hans/iot/protocols/#opc-ua安全与凭据)中的安全选项），任何其他协议的设备也可以（MQTT 和 HTTP 密码、HTTP 头、地址中的凭据）。这些内容在设备文件里是明文的，而 Relay 没有可用来遮盖它们的 API（4.15.1 为 Gateway 增加的 API 脱敏不适用于它；见[认证与用户](/zh-hans/iot/authentication/#凭据仍是明文的地方)），所以文件放在哪里很重要：

- **在 Helm 图表中，请使用 `devicesSecret`。** 在图表的 `devices` 和 `tags` 值中设置的设备会渲染成 ConfigMap，命名空间内任何有权读取 ConfigMap 的人都能读到，并且它们还会保存在 Helm 发布记录中。对于带凭据的设备，请把整个设备文件放进一个 Secret，键为 `devices.json`，并在 `devicesSecret` 中写上它的名字；Secret 会替代 ConfigMap 被挂载，此时不会创建 ConfigMap。
- **推送的设备文件同样带有这些凭据。** 用 `POST /api/fleet/{id}/config` 推送的文件，会以 retained 方式发布到一个 MQTT 主题，所以代理必须启用 TLS，并限制谁可以读取 `hotloop/edge-relay-config/#`，否则任何能订阅它的人都能读到其中的每一项凭据。Relay 以 `0600` 权限把推送的文件写到它的数据卷上（图表和 Quadlet 单元里都是 `/data/pushed-devices.json`），所以它也在 PVC 上，而不是在 Secret 里。
- **启用安全的 OPC UA 设备会保留一份证书和一个信任库。** 它们位于 `/data/opcua-client-pki`（`HOTLOOP_OPCUA_CLIENT_PKI_DIR`），与转发队列在同一个持久卷上。图表的持久化关闭时它是 emptyDir，于是每个新 Pod 都会生成新证书，每台启用安全的服务器都要重新信任它（见下文“关闭持久化”）；使用无安全通道的匿名设备则不受影响。批准服务器证书的操作与 Gateway 上相同，即从 `rejected/` 移到 `trusted/`，在 Relay 的数据卷上进行。

## 远程命令 (4.7.0)

两个 Sparkplug NCMD 命令，都走这个 Relay 本来就向外拨出的同一条连接，不需要入站连接：

- **重启**（`Node Control/Reboot`），自 4.7.0 起：Relay 自己发布一个正常的 NDEATH 然后退出，依靠它的守护者（Quadlet 单元的 `Restart=always`，或 Deployment 默认的 `restartPolicy: Always`）把它重新拉起。

- **更新**（`Node Control/Update`）：由操作员批准 Relay 一直暂挂着的镜像更新。它只对被设置为暂挂更新的 Relay 起作用；见[更新 Relay](#更新-relay)。

Relay 自身一侧没有任何机制决定谁可以发送这些命令；发送它们的 Gateway 一侧的设备群管理器，以及作为真正授权边界的代理 ACL 要求，请看设备群管理页面。

## 更新 Relay

Relay 不是由 Gateway 更新的。也做不到：Gateway 没有办法进入那台机器，而 Relay 也不能替换自己的容器，所以“远程更新”对两种安装方式的含义不同，本页会逐一说明，因为平台做不到的承诺，比没有承诺更糟。

**规则与每一台 HotLoop 机器所遵循的相同：跟随 `:stable`，绝不固定版本。** 固定在 `4.17.0` 的 Relay，只会和安装它的那天一样旧，没有人会记得回到工厂现场去升级它。所以 Relay 跟随的镜像是 `ghcr.io/hotloop-io/hotloop-edge-relay:stable`，每次发布都会移动这个标签。不同之处在于，由谁来重启 Relay 让它换到这个镜像上。

### Quadlet（Pi 或小型工业 PC）：它自己更新

[`deploy/quadlet`](/zh-hans/install/quadlet/) 中的单元跟随 `:stable`，并带有 Podman 自动更新所查找的标签。每台机器只需打开一次定时器：

```sh
sudo systemctl enable --now podman-auto-update.timer
```

定时器触发时，Podman 拉取 `:stable`，如果摘要变了，就用新镜像重启该单元。三件事让它可以放心不管，而且三件事都是通过实际运行证明的，不是读文档得出的：

- **无法恢复的 Relay 会被还原。** 该单元有一个健康检查（`/edge-relay --healthcheck`，因为镜像里没有 shell 或 curl 可用来执行检查），并在检查通过之前告诉 systemd 它还没有启动完成。如果新镜像始终通不过，Podman 会把先前的镜像放回 `:stable` 之下并启动它。一个无法启动的版本，代价是一台机器几分钟，而不是一个一直宕着的 Relay。在 Podman 4.9（Ubuntu 24.04）上，单独的 `Notify=healthy` 做不到这一点：它被当成普通的 `true` 读取，容器一启动 Relay 就被认为已就绪，Relay 明明已经挂了，Podman 却报告更新成功。因此该单元明确设置了 `--sdnotify=healthy`。
- **Gateway 能看到每一次更新。** Relay 在每个 Birth 中都带有它的版本和镜像摘要。Gateway 的设备群列表为每个 Relay 显示这两项，并在其中任何一项变化时向系统日志写一行：原来是什么，现在是什么，以及两个摘要。这就是审计记录，涵盖任何原因引起的更新，包括操作员在机器上的操作。
- **更新不会动数据。** 转发队列和推送的设备文件位于数据卷上，新镜像不会碰它。损失的只是 Relay 重启期间的轮询，最多几秒钟。

Relay 报告的摘要，就是在那台机器上 `podman image inspect --format '{{.Digest}}'` 打印的内容，也是自动更新所跟随的东西。当注册表存放的清单格式与 Podman 所使用的不同时，Podman 可能以多个摘要识别同一个镜像（它把它们列在 `RepoDigests` 之下），所以在每个 Relay 上都要用同样的方式比较，不要与注册表的响应头比较。

### Quadlet，暂挂更新直到操作员批准（可选）

有些现场希望自己决定时间：比如一条在班次期间不能中断的产线上的 Relay。这就是 `edge-relay-hold.conf`，一个 systemd 附加配置，它绝不是默认设置。启用后，Relay 报告 `"updateMode": "approve"`，定时器关闭，直到管理员从 Gateway 发送 `POST /api/fleet/{id}/update` 之前不会有任何更新。随后 Relay 以状态码 75 退出，systemd 用它现有的镜像再次启动它，另一个任务等待它恢复健康后运行 `podman auto-update`：有新镜像就用新镜像，并带有同样的回滚；没有的话，就只是让 Relay 白白中断了一下。已通过一次真实的更新验证：更新被暂挂 30 秒，期间 Relay 未受影响地运行，随后在批准后生效。

要清楚它的代价。定时器必须在整台机器上关闭，因为 Podman 的自动更新作用于每一个带标签的容器，无法让它跳过某一个；一台必须为其他用途运行它的机器，就无法暂挂这个 Relay。而且 Gateway 无法告诉你有更新在等待，只能告诉你每个 Relay 现在运行的是什么，所以在批准之前，请把设备群列表与 `:stable` 当前的内容对比。批准不携带镜像：只能告诉 Relay 更新到它自己的单元所跟随的那个版本。

### Helm：由你运行 `helm upgrade`

Pod 不能替换自己，而 Deployment 归 Helm 来改，所以图表没有远程更新。图表的 `image.tag` 默认等于它的 `appVersion`，也就是发布版本，因此：

```sh
helm repo update
helm upgrade edge-relay hotloop/hotloop-edge-relay --reuse-values
```

会把 Pod 滚动到新版本上。图表的策略是在启动新 Pod 之前先停止旧 Pod（`maxSurge: 0`，因为转发队列是一个卷上的单写者文件），所以在新 Pod 启动期间会有一段空档。Gateway 仍会在 Relay 的下一个 Birth 中看到新版本并记录这一变化。在 Helm 下，Relay 不报告镜像摘要（容器看不到自己的摘要，Kubernetes 也不会传下来），只报告版本。`Node Control/Update` 在这里什么也不做，Relay 会在日志里这样说；Helm 本身就是批准。

### 这里没有的，以及原因

- **签名镜像和摘要允许列表。** Gateway 无法在一台它无法进入的机器上强制执行这两者，而 Relay 对自己运行的检查，是被攻破的 Relay 会跳过的检查。Podman 可以在拉取时验证签名（`policy.json`），那才是有效的位置；这里不会为你设置该策略，`:stable` 与任何标签一样被信任。
- **分阶段发布。** 一台机器上的每个 Relay 都按自己的定时器跟随同一个标签，所以设备群是在定时器的分散范围内更新，而不是分批进行，上述回滚才是限制坏版本影响的手段。若要有意分阶段，用暂挂附加配置把需要等待的现场暂挂起来，然后按你想要的顺序批准它们。

## 配置推送 (4.8.0)

新的设备文件可以通过一个单独的、普通的（非 Sparkplug）retained MQTT 主题推送。Gateway 一侧请看设备群管理页面的“配置推送”一节。在 4.17 之前，推送只是暂存文件，Relay 会继续轮询旧列表，直到有东西把它重启。这使得 Relay 所轮询内容的每一次变化，都要重启 Relay、它的代理会话以及它持有的每一个设备会话，而这台机器本应一待数月而不被碰。现在，推送一到就立即生效。

- 推送时这个 Relay **正在运行**：字节内容按启动时 `LoadDeviceFile` 所用的同样规则校验，保存到 `HOTLOOP_EDGE_RELAY_PUSHED_FILE`（未设置时则覆盖 `HOTLOOP_EDGE_RELAY_DEVICES_FILE`，见下文），然后立即应用。先保存是有意的：一份运行过却从未保存的列表，会在下次启动时悄悄恢复原样。
- **错误的推送会被拒绝，旧列表继续运行。** 无法解析、无法通过校验（重复的设备、挂在无人声明的设备上的变量、未知协议）或无法保存的推送，什么都不会改变：不会改变运行中的设备，也不会改变磁盘上的文件。日志会说明原因，`/status` 的 `config.rejected` 下也会说明，Gateway 的设备群界面就是从这里取得的。
- 推送时这个 Relay **处于离线**：在下次启动之前没有谁来接收它，到那时 Relay 会在加载本地设备文件*之前*给 retained 推送几秒钟的时间到达，因此它会直接用它启动。在这几秒之后才到的推送，与其他推送一样立即生效。
- 代理会在每次重连时把 retained 推送再交还一遍。Relay 通过 sha256 知道自己正在运行的文件，所以相同的字节再次到达不会改变任何东西。

### 实时应用保留什么，改变什么

Relay 逐个设备算出正在运行的文件与新文件之间的变化，只动变化的部分：

- **没有变化的设备保持它的会话。** 到 PLC 的同一条 TCP 连接，同一个 OPC UA 订阅，读数没有间断。
- **有变化的设备**（它的地址、协议、轮询间隔、超时、config 块或变量）会用新定义重新连接。
- **新设备**会被连接并开始轮询。
- **被移除的设备**（或现在是 `"enabled": false` 的设备）会被断开。
- **Sparkplug 会话保持不断。** 没有 NDEATH，没有重连，bdSeq 不变，转发队列也不会被动。代理中断期间的一次重新加载，会让每一条缓冲的读数留在队列里；代理恢复后它们就会排空，与没有重新加载时一样。

在线路上，遵循 Sparkplug B。Relay 是一个边缘节点，每个变量都是名为 `device/tag` 的节点指标，所以变化的是节点的指标集合，而 Sparkplug 只给节点一种改变它的方式：一个新的 NBIRTH，整体替换上一个。因此：

- **消失的指标**（被移除的设备，被移除或被禁用的变量）会在一个 NDATA 中再以 null 发送一次，然后节点在没有它们的情况下 Rebirth：同一个会话，同一个 bdSeq，seq 回到 0，与收到 `Node Control/Rebirth` 时的 Rebirth 相同。之所以有这个 null，是因为主机被允许保留新 Birth 中省略的指标的最后一个值，而 Gateway 自己的 Sparkplug 主机正是这样做的。没有这个 null，你从 Relay 上拿掉的阀门会永远停在它最后一个良好读数上，看起来一切正常。
- **新增的指标**在其设备的第一次轮询时进入一个 Birth，与启动时每个指标进入的方式相同。Birth 绝不会在读数产生之前就列出一个指标。
- **已移除变量仍在转发队列中的读数**会在队列排空时被丢弃，并有一行日志统计它们的数量。节点的 Birth 不再携带该指标，而 Sparkplug 没有合法的办法发送它未携带的指标，所以发送它们就意味着使用一个没有主机被告知过的别名。

手动编辑本地设备文件仍然需要重启：Relay 在启动时和推送被清除时读取它，并不监视它。在图表下，修改 `devices` 的 `helm upgrade` 本来就会做这件事。

### 推送的文件放在哪里，以及哪个文件优先

两种受支持的安装方式都以只读方式挂载本地设备文件：图表来自 ConfigMap（或 Secret），Quadlet 单元使用 `:ro` 绑定，而且两者都在只读根文件系统上。在 4.16.0 之前，Relay 把推送写在那个文件的旁边，所以在两种安装方式上，每一次推送都会失败，报错

```
a pushed config was rejected; keeping the current one and continuing to run
error="write /etc/edge-relay/devices.json.tmp: open /etc/edge-relay/devices.json.tmp: read-only file system"
```

而 Relay 继续轮询旧列表。Gateway 说 `config pushed`，重启也成功了，但什么都没有改变。解决办法是给推送一个它自己的位置：

- **`HOTLOOP_EDGE_RELAY_PUSHED_FILE`** 是推送被写入的位置。图表把它设为 PVC 上的 `/data/pushed-devices.json`（values.yaml 中的 `pushedDevicesFile`），Quadlet 单元在它命名的数据卷上设置同样的路径。两者都比容器活得久，而且 PVC 在重新调度后依然存在。最后这一点是有意的：emptyDir 同样可写，但 Pod 一迁移它就没了，而 Relay 在节点排空之后悄悄回到旧设备列表，就是换了个样子的同一个 bug。
- **推送的文件优先。** 启动时，Relay 如果存在推送的文件就加载它，只有不存在时才加载本地文件。这在重启之后、重新调度之后、代理丢失 retained 推送之后（没有持久化的 Mosquitto 重启），以及修改 `devices` 或 `tags` 的 `helm upgrade` 之后都成立。推送是更新、更有意的改动，而且代理在下次启动时本来就会把 retained 副本原样交回，所以让本地文件优先只会维持到一次重启。日志的前几行会说明它是从哪个文件启动的：`booting from the pushed device file; the local one is ignored until the push is cleared`
- **回到本地文件**（图表的 `devices`，或 Quadlet 下的 `/etc/edge-relay/devices.json`）就是在 Gateway 上执行 `DELETE /api/fleet/{id}/config`。删除会清除代理上的 retained 推送，所以之后的启动都不会再应用它，而当时已连接的 Relay 会加载它的本地文件、删除它推送的文件、记录 `the config push was cleared; the local device file takes over`，并像应用推送一样实时应用本地文件。如果本地文件无法加载，Relay 会让推送的文件继续运行并保留在磁盘上，同时在日志和 `/status` 中说明：先删除它，会让 Relay 在下次重启时用一个损坏的文件启动。请修好本地文件，再次发送删除。请在 Relay **在线**时进行。清除不是 retained 的，所以当时离线的 Relay 永远听不到它，并保留它推送的文件；把它启动起来，再次发送删除。重复操作是安全的。
- 存在但无法加载的推送文件（磁盘故障，或规则更严格的后续版本）会作为错误记入日志，Relay 会用本地文件启动，而不是因此一直宕着。
- 未设置 `HOTLOOP_EDGE_RELAY_PUSHED_FILE` 时，推送会覆盖 `HOTLOOP_EDGE_RELAY_DEVICES_FILE` 本身，这是 4.8.0 的行为。这只对设备文件可写的裸二进制文件有用，而且那时没有单独的副本可供清除操作丢弃。

如果某次推送“没有生效”，请先看 Relay 的日志。它要么说明从哪个文件启动，要么说明推送为什么被拒绝。

## HTTP 接口

两个端点，都没有认证，都是只读的：

- `GET /healthz`，进程在运行。仅此而已。某个设备断开，并不意味着这个进程不健康。
- `GET /status`，一份快照：按连接状态统计的设备数、变量数、转发队列当前的深度、编译进来的协议列表，以及 `uplink`：代理是否已连接，回放是否在进行，转发队列里有什么、磁盘占用多少，以及在上限处丢弃了多少（见 Edge Publish 页面的“上行链路中断时”）。没有变量值，没有设备地址，没有配置，这是一个监控界面，不是 Gateway 仪表板的缩小副本。`version`、`imageDigest` 和 `updateMode` 说明这是哪个构建，以及它是否暂挂更新。它还会在 `config` 下说明正在运行哪个设备文件：`source`（`local` 或 `pushed`）、`path`、它的 sha256 `digest`、`appliedAt`，以及 `rejected`，即 Relay 最近一次拒绝的文件及原因，直到其后的推送生效为止。给的是摘要，不是文件：Gateway 可以拿它与自己推送的内容比对，而文件里的地址和凭据不会通过无认证的端口泄露。文件中有 `discovery` 代理时，它还会在 `discovery` 下说明每个代理的状况以及它发现了多少设备（见[发现](#发现-41810)）。

两者前面有意不设认证：Edge Relay 没有用户数据库、会话存储，也没有可据以构建它们的身份系统，而为两个不暴露任何敏感内容的端点加一个共享令牌，只是做样子而不是安全。请把它运行在设备本身所处的任何网络边界之后，这与 Gateway 自己的 `auth.insecure` 模式对部署在可信代理之后所记录的要求相同。

## 配置

| 变量 | 默认值 | <span class="sr-only">Details</span> |
|---|---|---|
| `HOTLOOP_EDGE_RELAY_DEVICES_FILE` | 无 | 必需。上述设备文件的路径 |
| `HOTLOOP_EDGE_RELAY_PUSHED_FILE` | 未设置 | 推送的设备文件保存的位置，只要它存在就优先于上面的文件。必须可写且持久；图表和 Quadlet 单元使用 `/data/pushed-devices.json`。见[推送的文件放在哪里](#推送的文件放在哪里以及哪个文件优先) |
| `HOTLOOP_EDGE_RELAY_LISTEN_ADDR` | `:8081` | `/healthz` 和 `/status` 服务器 |
| `HOTLOOP_EDGE_RELAY_UPDATE_MODE` | `auto` | `auto` 把更新交给守护者，并忽略来自 Gateway 的批准；`approve` 暂挂更新直到批准到达。见[更新 Relay](#更新-relay) |
| `HOTLOOP_IMAGE_DIGEST` | 未设置 | 这个 Relay 所运行镜像的摘要，由它的守护者得知。Quadlet 单元在每次启动前设置它。会在 `/status` 和每个 Birth 中报告；为空也没关系 |
| `HOTLOOP_LOG_LEVEL` | `info` | |
| `HOTLOOP_POLL_INTERVAL` | `5s` | 默认轮询间隔；设备自己的 `pollIntervalMs` 会覆盖它 |
| `HOTLOOP_MIN_POLL_INTERVAL` | `100ms` | 对每个设备强制执行的下限，不论它自己的设置如何 |
| `HOTLOOP_POLL_TIMEOUT` | `10s` | 默认的单次轮询超时；设备自己的 `timeoutMs` 会覆盖它 |
| `HOTLOOP_MAX_CONCURRENT_POLLS` | `32` | 可同时处于轮询中的设备数 |
| `HOTLOOP_RECONNECT_MIN` / `HOTLOOP_RECONNECT_MAX` | `1s` / `60s` | 重连尝试之间的退避上下限，带随机抖动 |
| `HOTLOOP_RING_SIZE` | `120` | 为 `/status` 附近的诊断为每个变量保留的采样数 |
| `HOTLOOP_OPCUA_CLIENT_PKI_DIR` | `/data/opcua-client-pki` | OPC UA 驱动的证书，及其 `trusted/` 和 `rejected/` 存储；设备自己的 `pkiDir` 会覆盖它。只有启用安全的 OPC UA 设备会用到它 |

变量名和默认值与 Gateway 自己的 `RuntimeConfig` 完全相同；同样的设置以 Helm 值表达的形式，请看 k3s 和 Helm 页面的“轮询”一节，因为两个二进制文件都通过同一个 `config.LoadRuntimeConfig()` 函数加载这份配置，而不是两份可能彼此偏离的副本。

外加 Edge Publish 页面所记录的每一个 `HOTLOOP_EDGE_PUBLISH_*` 变量，只有一处不同：`HOTLOOP_EDGE_PUBLISH_ENABLED` 被忽略，转发始终开启，因为发布它读到的内容就是这个二进制文件存在的全部意义，而不像在 Gateway 上那样是可选功能。

## 哪些已验证，哪些没有

HotLoop 已经在真实设备和真实服务器上运行过，并于 2026-11-17 在真实硬件上运行过。

## 部署

两种受支持的方式，都是容器，没有从随会话一起消亡的 shell 里直接运行的 `podman run`，也没有 Docker：

- **`charts/hotloop-edge-relay`**，一个 k3s Helm 图表，与 Gateway 自己的图表（`charts/hotloop`）分开，因为 Edge Relay 确实是另一种制品，常常运行在与它所转发的 Gateway 不同的、更小的集群里。设备和变量在 `values.yaml` 中声明并渲染成 ConfigMap；转发队列位于一个小的 PVC 上（关闭它之前，请看下文“关闭持久化”）。
- **`deploy/quadlet`**，一个 Podman Quadlet 单元，适用于完全不属于 k3s 集群的 Pi 或小型工业 PC。Quadlet 把容器变成真正的 systemd 服务：开机启动，失败时重启，日志写入 journald；安装步骤请看该目录自己的 README。

两者使用同一个镜像和上面记录的同一组环境变量。

自 4.16.0 起，每个版本都会同时发布这两者。镜像是 `ghcr.io/hotloop-io/hotloop-edge-relay`，以发布版本号作标签（另有 `major.minor`、`major`、`latest` 和 `stable`；Quadlet 单元跟随 `stable`，见[更新 Relay](#更新-relay)）。它支持 amd64 和 arm64，并从 4.17.0 之后的第一个版本起支持 32 位 arm（arm/v7），因为 Pi 3 或 32 位 Pi OS 安装，正是 Relay 最终落脚的那种机器。图表与 Gateway 的图表在同一个 Helm 仓库中：

```sh
helm repo add hotloop https://hotloop.io/hotloop/
helm install edge-relay hotloop/hotloop-edge-relay \
  --namespace hotloop --create-namespace \
  --set edgePublish.broker=tcp://gateway.example.local:1883 \
  --set edgePublish.group=Plant1
```

### 关闭持久化

`persistence.enabled=false` 会得到一个不带 PVC 运行的 Relay，仅此而已。在 4.16.0 上它甚至跑不起来：`/data` 没有挂载任何东西，根文件系统是只读的，Relay 在启动时就以 `open forward queue at /data/forward.db: no such file or directory` 退出了。现在 `/data` 是一个 emptyDir，容量上限为 `persistence.size`，Relay 写入的一切都落在那里。

emptyDir 的寿命与 Pod 相同。同一个 Pod 内的容器重启会保留它。新 Pod 则不会，而你会在节点排空、节点故障、驱逐、`kubectl delete pod` 以及任何会滚动 Deployment 的 `helm upgrade` 时得到新 Pod。每一次，你都会丢失：

- **转发队列。** 代理宕机期间缓冲的每一条读数都没了，而 Gateway 一侧没有任何东西知道它缺失。
- **推送的设备文件。** Relay 会毫无怨言地再次用图表的 `devices` 启动，直到 Gateway 再次推送，或代理回放一个 retained 推送。这正是 PVC 要防止的那种故障，关闭它就等于重新选择了这种故障。
- **OPC UA 客户端证书和信任库。** 每台启用安全的服务器都要信任新证书，操作员也必须重新批准每台服务器的证书。

把上限填满（一个设为无限制的队列，即 `queueMaxBytes: 0`，默认值是 64 MiB，在足够长的中断中就会这样），会使 Pod 被驱逐，三样东西同时丢失。这仍然好过在节点上其他所有东西之下把节点的磁盘填满。安装说明在持久化关闭时会打印一条警告。试用时没问题。对于读数重要的 Relay，请给它配上 PVC。

### 来自 EmberNet App Store

应用商店把这个 Relay 列为 HotLoop Edge Relay，每个节点一个。商店部署会把三样东西交给图表：显示名称（发布名称）、一个节点选择器和租户标签。它没有表单可以询问其他任何内容，而没有代理和 Sparkplug 组，Relay 无法运行。所以 Relay 的商店部署会有意停在渲染阶段，并在 helm-install 任务的日志中给出一条错误，指出缺少什么，并打印出修复所需的确切命令。

我们没有给它默认的代理，因为不存在一个对任何人的工厂都成立的代理，而指向一个编造地址的 Relay，看上去已经部署了，实际上什么也没转发。它也不能原地等待推送的设备文件：推送要经过它尚未拥有的代理连接才能到达。

修复方法是把这两个值写进商店写入的内容里，安装会自行重试：

```sh
# a node on the local cluster: add them under spec.valuesContent
kubectl -n default edit helmchart hotloop-edge-relay-<node>

# a tenant on its own cluster (Fleet): add them under spec.helm.values
kubectl -n fleet-default edit helmop hotloop-edge-relay-<node>
```

```yaml
edgePublish:
  broker: tcp://<gateway-or-broker>:1883
  group: <sparkplug group id>
```

启动之后，它会在 Running Apps 中以商店所给的名称显示，带有 HotLoop 图标，范围限定在部署它的租户，没有 LAUNCH 按钮。最后这一点是有意的：图表给它加了 `embernet.ai/gui-type: none` 标签，因为 `/healthz` 和 `/status` 是给探针和操作员的 curl 用的，不是放在 iframe 里的页面。

Relay 与 Gateway 共用一个版本号。除非两个图表都带有该标签的版本，并且 Relay 的 Quadlet 单元跟随 `:stable`，否则发布不会开始，所以不论 Relay 自己的代码是否有变化，它每个版本都会得到新版本号。这是有意的：只需要问一个版本号，也不会有 Relay 图表指向一个没人推送过的 Relay 镜像。Quadlet 单元过去固定发布版本号，这与一台自我更新的机器的工作方式正好相反。
