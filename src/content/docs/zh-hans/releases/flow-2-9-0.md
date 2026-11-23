---
title: "Flow 2.9.0 发布说明"
description: "HotLoop Flow 2.9.0 带来了什么，升级时有什么变化，以及动手改动运行中的工厂之前该读什么。"
sidebar:
  label: "2.9.0"
---

HotLoop Flow 2.9.0 为一次真实的工厂迁移加入了内置的连接器节点。它运行工厂流程所依赖的 Node-RED 节点，Modbus、仪表板、PostgreSQL 和电子邮件，还有周围函数节点所调用的 `Buffer` 和 `setInterval`。从 Node-RED 机器上导入的流程只要用到它们，就能原样加载、运行和保存。它还让一个 Flow 可以为每台机器保留一个标签页，即使设备只有一个端口、为每台机器承载一个 VLAN，并且每个 VLAN 的子网和设备地址都相同。

## 新功能

- **Node-RED Modbus。** `modbus-client`、`modbus-read`、`modbus-getter`、`modbus-flex-getter`、`modbus-write`、`modbus-flex-write`、`modbus-server`，以及被动的 `modbustcp-server`。输出与社区节点发送的一致：`msg.payload` 是值的列表，`msg.responseBuffer` 是 `{data, buffer}`，还有 `msg.input`，错误从第二个输出送出。
- **仪表板。** `ui_base`、`ui_tab`、`ui_group`、`ui_link`、`ui_spacer`、`ui_text`、`ui_numeric`、`ui_button`、`ui_switch`、`ui_text_input`、`ui_led`、`ui_gauge`、`ui_chart` 和 `ui_template`，由程序本身在 `/ui` 提供，不会从工厂之外获取任何东西。操作员在页面上的操作，会作为消息从节点送出。`ui_template` 运行工厂所用的 AngularJS 风格子集：`{{ }}`、`ng-click`、`ng-class`、`ng-init`、`ng-show`、`ng-hide`、`ng-if`、`ng-bind`、`scope.$watch`、`scope.send`。
- **PostgreSQL。** `postgreSQLConfig` 和 `postgresql`。连接在第一次查询时打开，所以还没启动的数据库不会让流程停下。
- **电子邮件。** 通过 SMTP 的 `e-mail` 输出节点，支持 STARTTLS、证书开关和 XOAUTH2。
- **函数节点里的 `Buffer`、`setInterval` 和 `setTimeout`。** 定时器按节点的时钟运行，每个回调的 CPU 限制与一条消息相同，流程停止或重新部署时，所有定时器都会清除。
- **每个客户端一个网络接口。** 节点、标签页或客户端配置可以指定其连接所绑定的接口（`SO_BINDTODEVICE`），所以干燥机 14 的标签页只能连到 VLAN 14 的 `192.168.1.5`。标签页的方式是在该标签页上设置环境变量 `FLOW_NETWORK_INTERFACE`，其中每个客户端节点都会继承。Modbus、PostgreSQL、电子邮件、TCP 请求、UDP 输出和 HTTP 请求节点都有这个选项。

README 新增了一节，`docs/node-red-types.md` 说明了哪些能运行、有什么不同，`docs/compatibility.md` 从注册表重新生成。

## 变更内容

- 函数节点原本特意没有 `Buffer`、`setTimeout` 和 `setInterval`，有两个测试把这一点固定了下来。现在它们已经有了，因为工厂的函数会用到。沙箱的其他部分没有变：仍然没有 `require`、没有 `process`，也没有 Node 标准库。
- 未设置该钩子时，它的行为与上游一致。NOTICE 和 `HOTLOOP_PATCH.txt` 说明了改了什么。
- 原因是为一次真实的工厂迁移加入了内置的 Node-RED 连接器节点。

## 新设置

- `HOTLOOP_FLOW_UI_PATH`，默认 `/ui`：仪表板的服务路径。
- `FLOW_NETWORK_INTERFACE`，标签页、子流程或进程的环境变量：该标签页的客户端绑定的接口。默认为空，让主机自行选择，与之前一样。
- 每个客户端节点和配置上有一个**网络接口**字段。
- 图表值 `bindToInterface.netRaw`，默认 `false`。在 Linux 5.7 及更高版本上，把套接字绑定到接口不需要任何 capability。在更旧的内核上需要 `CAP_NET_RAW`，把它设为 `true` 会给 Pod 加上这一个 capability，别无其他。Pod 还需要主机的网络（`network.mode: host`）才能看到 VLAN 接口。

## 升级

只需对 2.9.0 的镜像和 chart 执行一次 `helm upgrade`，或在您的 Quadlet 单元里换上新标签。首次启动时不会发生任何事，也不需要迁移，没有用到新类型的流程照常运行。已经包含这些类型的流程（导入的 Node-RED 文件）现在会启动它们，而以前会把每一个都报告为未知的节点类型。

## NOTICE 和许可证的变更

NOTICE 新增了 Modbus 库的条目，它现在是一个修改过的副本。镜像里没有新增任何第三方模块。

镜像：`ghcr.io/hotloop-io/hotloop-flow:2.9.0`，先发布 linux/amd64，arm64 在 2.9.1 中跟进。Chart：`https://hotloop.io/hotloop-flow/`。这个标签的 README 有其余内容，还配有图片：https://github.com/HotLoop-io/hotloop-flow/blob/v2.9.0/README.md
