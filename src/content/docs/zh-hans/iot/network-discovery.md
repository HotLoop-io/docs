---
title: "HotLoop 网络发现"
description: "HotLoop 通过 mDNS、SSDP 和 DHCP 监听并显示工厂网络上有什么，除非您列出要探测的网络，否则不会发送任何内容。"
---

HotLoop 监听工厂网络，告诉您上面有什么：院子里的 ESPHome 节点、压缩机上的 Shelly、3 号线的 OPC UA 服务器、有人插上后忘掉的 UPnP 设备，以及刚刚请求地址的东西。每一个都会出现在 Devices 的 Discovered 中，位于通过 MQTT 自我宣告的设备（[MQTT 发现](/zh-hans/iot/mqtt-discovery/)）下方，并说明它是什么，以及 HotLoop 如何与它通信。

然后由人来决定。在网络上听到的任何东西都不会自动被添加，也不会被启用写入。

## 监听，而不是扫描

在您读取的 OT 网络上，不要扫描。端口扫描曾经击垮过不止一台 PLC，它对一个从未预料到的数据包作出了应答，而“这只是发现”在凌晨三点没有任何安慰作用。所以默认情况下 HotLoop 完全不发送任何内容：

- **mDNS**（开启）：设备在启动时宣告其服务，对任何人的提问的每个应答都会以组播方式发给整个网段。打开应用的手机或寻找打印机的笔记本电脑会发出提问；HotLoop 偶然听到。
- **SSDP**（开启）：UPnP 设备在加入时以及此后每隔几分钟会组播 `NOTIFY ssdp:alive`。HotLoop 同样会听到这些。
- **DHCP**（关闭，见下文）：加入网络的设备会广播一个地址请求，带有它的 MAC，通常还有它的名称。

提问就是**探测**，它按网络启用，由部署来启用，绝不通过按钮：

| 变量 | 默认值 | <span class="sr-only">详情</span> |
|---|---|---|
| `HOTLOOP_NETDISC_MDNS` | `true` | 监听 mDNS |
| `HOTLOOP_NETDISC_SSDP` | `true` | 监听 SSDP |
| `HOTLOOP_NETDISC_DHCP` | `false` | 监听 UDP 67 上的 DHCP 请求 |
| `HOTLOOP_NETDISC_PROBE_NETWORKS` | 空 | 启用探测的网络，以 CIDR 表示：`10.20.0.0/24,192.168.7.0/24` |
| `HOTLOOP_NETDISC_PROBE_INTERVAL` | `15m` | 在那里多久运行一次探测 |

在列出的网络上，探测会为每种服务类型以及 HotLoop 认识的服务类型发送 mDNS 提问，针对出现的每种类型再次提问，发送一次 SSDP `M-SEARCH`，并从每个 UPnP 设备读取其描述（名称、制造商和型号）。在其他任何网络上它不发送任何内容，在没有列出网络的地方，Probe now 按钮会被拒绝。请列出您指的那些网络：一个 /8 是 1600 万个地址，如果您这样要求，HotLoop 就会在上面提问。

## 它知道如何与什么通信

| 听到的 | 它是 | 接受后 |
|---|---|---|
| mDNS `_opcua-tcp._tcp` | 一个 OPC UA 服务器（OPC 10000-12 附录 C：endpoint 是 SRV 的地址和端口加上 TXT 的 `path`） | 在该 endpoint 创建一个 OPC UA 设备，起初匿名且无安全设置，没有变量。用 Discover tags 浏览它，并在它承载任何重要内容之前设置其安全性 |
| mDNS `_shelly._tcp`，或带有 `gen` 的 `_http._tcp` | 一个 Shelly，Gen2 或更新（其 TXT 中的 `gen`、`app` 和 `ver`） | 创建一个读取 `http://<it>/rpc/Shelly.GetStatus` 的 HTTP 设备，即 Shelly 自己的状态调用，只读，没有变量。Discover tags 会列出每个值。开启了登录的 Shelly 需要 digest 认证，而 HTTP 驱动不支持 |
| mDNS `_esphomelib._tcp` | 一个 ESPHome 节点（其 TXT：`friendly_name`、`version`、`mac`、`platform`、`board`、`network`） | 把它记为已知，不创建任何内容。HotLoop 通过 MQTT 读取 ESPHome：给节点一个指向 HotLoop 的 broker 的 `mqtt:` 块，它就会自我宣告，卡片会说明这一点（按 MAC 匹配） |
| mDNS `_mqtt._tcp` | 一个 MQTT broker | 记录它。在 Settings、MQTT 下添加它，就能听到上面宣告了什么 |
| mDNS `_http._tcp`，其他任何 | 一个网页，或 HotLoop 不认识的服务 | 记录它 |
| SSDP | 一个 UPnP 设备，按其 uuid：设备类型、`SERVER`，以及在开启探测时的描述 | 记录它 |
| DHCP | 一个请求地址的设备：MAC、主机名、厂商类别 | 记录它 |

“记录它”仍然值得点一下。在工厂网络上，每个设备盒都应该是有人知道的，而被接受的发现是一个带有姓名和时间的决定。下一个陌生的东西就会凸显出来。

当两个发现是同一个设备盒时，卡片会指出：ESPHome 节点的 mDNS MAC 与它的 MQTT 宣告，同一地址上的 DHCP 请求与 mDNS 主机。

接受不会启用任何东西。接受所创建的设备在有人选择之前没有变量，并且它上面的每个点在有人于变量编辑器中启用之前都是只读的，经过与其他一切相同的写入门。提议中的地址来自设备自己的宣告，接受对话框会显示它，这样您可以核对它是不是您以为的那个设备盒。

**Ignore** 隐藏一个发现，并在它再次被听到时仍保持隐藏。**Un-ignore** 把它带回来。

## 一切都不可信

任何能在网段上放一个数据包的人都可以声称自己是任何东西。所以：

- 每个字符串都被截断并去掉控制字符，界面把它作为文本放到页面上，绝不作为 HTML；
- UPnP 描述只会从宣告来源的地址读取，只在探测网络上读取，绝不经过重定向，也绝不超过 64 KiB。一个把 `LOCATION` 指向 PLC 网页或 HotLoop 本身的伪造 `NOTIFY`，不会让任何东西被获取；
- 每个监听器每秒接收 500 个数据报，其余的丢弃并计数；
- 记录最多保存 1,024 个发现。超出之后的新发现会被丢弃并计数，直到有人处理掉一些，界面会说明这一点；
- 线路上的提问是某个人的提问，不是宣告：它所携带的已知应答是提问者的看法，不会据此生成任何东西。

## HotLoop 必须位于何处才能听到东西

组播和广播不会跨越路由器、NAT 或容器网络。HotLoop 只听得到它所在的网段，别的什么也听不到：

- **工厂网络上的一台设备**（二进制程序，或带 `--network host` 的 Podman）：能听到一切。
- **使用 Pod 网络的 Kubernetes**：听不到工厂的任何东西。Discovered 屏幕会显示它正在监听的接口，据此就能发现。给 Pod 设置 `hostNetwork: true`，或在工厂网段上增加第二个接口（带 macvlan 的 Multus），它就能听到工厂。chart 不会替您做这两件事：把 Pod 放到主机的网络上是关于节点的决定，而不是默认值。

mDNS（5353）和 SSDP（1900）是 1024 以上的普通端口，所以不需要特权。HotLoop 与已经占用它们的程序共用，包括主机上的 avahi-daemon。

## DHCP

老实说是可行的，但需要容器默认得不到的两样东西，这就是它关闭的原因：

1. **工厂的广播。** DHCP 请求发往 255.255.255.255，所以 HotLoop 必须在该网段上：主机网络或其上的一个接口，与上面相同。
2. **UDP 端口 67**，它低于 1024。HotLoop 的镜像以 uid 65532 运行。要么给二进制程序 `CAP_NET_BIND_SERVICE`（`setcap cap_net_bind_service=+ep /hotloop`），要么把主机的 `net.ipv4.ip_unprivileged_port_start` 设为 67 或更低。在 Kubernetes 中，给非 root 容器的 capabilities 添加 `NET_BIND_SERVICE` 本身并不会让它生效；文件 capability 或 sysctl 才会。

它从不需要原始套接字或特权容器：端口 67 上的普通 UDP 套接字就能接收广播。它从不应答，从不提供地址，从不发送一个字节。它与别人共用该端口，所以同一主机上同样共用该端口的 DHCP 服务器继续工作；独占该端口的服务器会让 HotLoop 的监听器失败，界面会说明原因，而不会碰服务器。

它看不到的：续租，因为它们以单播方式发往服务器。HotLoop 在设备加入时听到它，而不是此后每小时都听到。

## 多个副本

只有持有网络发现锁的副本会监听和探测；其他副本每 30 秒重试一次，所以如果持有者消失，会有一个接手。如果两个同时探测，会对每个设备询问两次。

## 备份

`net_finds` 包含在每一份备份中：听到了什么，以及谁接受或忽略了什么。这些决定是网络不会再说第二遍的部分。

## 测试方式

发现功能已在真实网络上针对真实的宣告者运行过，包括 ESPHome、Shelly 和 OPC UA 节点、一台 UPnP 媒体服务器和 DHCP 客户端，并于 2026-11-17 在真实硬件上运行过。
