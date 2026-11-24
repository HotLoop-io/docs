---
title: "core 4.24.2 发布说明"
description: "HotLoop core 4.24.2 包含什么、升级时有哪些变化,以及动手处理一个正在运行的工厂之前应该先读什么。"
sidebar:
  label: "4.24.2"
---

HotLoop 直接读取并控制各代 Shelly 设备，发现 ONVIF 摄像头并提供其视频流、快照以及云台的平移、俯仰和变焦，通过 Firmata 与 Arduino 通信，并按规范的要求发送任意长度的 OPC UA 密码。慢速链路不再把边缘节点绑在它的磁盘上，`--version` 会说明镜像是从哪个提交构建的。HotLoop Edge 的默认安装可以启动。仅为 amd64 构建；多架构构建作为下一个版本随后发布。

## 变更内容

- **各代 Shelly。** Gen2 及以后通过 RPC 加实时 websocket，变化和按键在发生的那一刻就到达，Gen1 则通过它自己的 HTTP 接口。按键记录在设备名下的日志簿中。参见 SHELLY.md。
- **ONVIF 摄像头。** 在网络上发现摄像头（WS-Discovery），读取每台设备的信息、每个媒体配置文件的视频流和快照地址（Media 和 Media2）、平移、俯仰和变焦，以及摄像头自身的事件，作为标签和日志簿行。配置文件的当前画面只需一个路由即可获取。参见 ONVIF.md。
- **通过 Firmata 连接的 Arduino。** USB 串口或 TCP，数字和模拟引脚、PWM、舵机和 I2C 设备都作为标签。参见 FIRMATA.md。
- **任意长度的 OPC UA 密码。** 超过 64 字节的密码现在按规范的要求（RsaEncryptedSecret，第 4 部分，7.40.4）通过 OPC UA 从客户端发送到服务器，较旧的服务器仍然可以登录。已对照 OPC Foundation 自己的协议栈验证。参见 [OPC UA 服务器](/zh-hans/edge/opc-ua-server/)。
- **慢速链路不再把节点钉在磁盘上。** 取走磁盘最后一部分的那一轮，现在会把随后进来的数据从内存发送，因此慢速链路后面的转发队列会清空，节点离开磁盘，而不是每次轮询都执行 fsync。
- **`--version` 会说明提交。** 每个镜像除版本外，还会说明它是从哪个提交构建的。
- **CODESYS 画面与其 WebVisu 并排对照。** 对 CODESYS 可视化的导入，会对照一个真实的 WebVisu、由相同的 PLC 变量驱动来运行，并在浏览器中比较两者。
- **docs/legacy 的路线图条目已勾选。**
- **HotLoop Edge 的默认安装可以启动。** Pod 不再从一个不存在的 Secret 中读取 Gotify 令牌、Discord Webhook URL 或 Discord 机器人令牌：每一项只在其凭据已设置时才发送，而且图表检查会对渲染结果没有生成的那个 Secret 的任何引用报错。设置了目的地、或指定了现有 Secret 的图表，渲染结果与以前一样。
- **Ignition 实验室，双向运行。** HotLoop 的 Ignition 验证现在也能反方向运行，并新增了跨路由器的组播 UADP 验证，同时测量了最大的报告。参见[定时报告](/zh-hans/gateway/reports/)。
- **测试等待它们所等待的东西。** 手机应用的预热会等待一个已登录的页面，能源表单则一步填完所有字段。

## 迁移

无。

## API 变更

两个路由，都是新的。`POST /api/onvif/discover`（`devices.write`）在网络中探测 ONVIF 摄像头，不添加任何内容。`GET /api/onvif/{id}/profiles/{profile}/snapshot`（`devices.read`）返回某个摄像头配置文件的当前 JPEG。现有路由没有变化。参见 [HTTP API](/zh-hans/iot/api/)。

## 从 4.24.0 升级

普通的 `helm upgrade`。没有迁移,也没有新的 secret。

## 尚未验证的内容

- Shelly、ONVIF 和 Firmata 是对照真实设备的录制数据、ONVIF 自己生成的协议栈，以及模拟 Uno 上 Arduino 项目自己的 StandardFirmata 运行的。还没有实体的 Shelly、摄像头或 Arduino 上过台架。
- 与 WebVisu 的并排对照在测试中对照 CODESYS Control for Linux SL 4.22.0.0 运行时运行。
