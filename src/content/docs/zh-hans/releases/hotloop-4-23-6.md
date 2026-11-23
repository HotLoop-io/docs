---
title: "core 4.23.6 发布说明"
description: "HotLoop core 4.23.6 包含什么、升级时有哪些变化,以及动手处理一个正在运行的工厂之前应该先读什么。"
sidebar:
  label: "4.23.6"
---

路线图中 Protect、Access 和电源盒的条目有了代码,Shelly 设备直接与 Shelly 通信,OPC UA PubSub 获得消息安全和元数据。只为 amd64 构建;多架构构建作为下一个版本跟进。

## 变更内容

- **UniFi Protect,作为设备。** 协议 `unifi-protect`,使用控制台 Integrations 页面里的 API 密钥,像控制台密码一样被密封,证书被固定。摄像头、传感器、灯和警报器是会自动加入的 tag。摄像头的移动和智能检测(人、车辆、包裹、车牌、人脸、动物)来自事件 websocket,它断开时会读为坏,绝不是“没有移动”。警报器可以被启用来响,`alarm.<trigger>.fire` 会发送警报管理器的 webhook,让 HotLoop 报警使摄像头录像。摄像头的快照是一个路由。每个事件都在 logbook 里。参见 [UniFi Network](/zh-hans/iot/unifi/#unifi-protect)。
- **UniFi Access,作为设备。** 协议 `unifi-access`,使用 API token。每扇门的位置和锁是 tag,由通知 websocket 保持最新,每次变化都在 logbook 里。开锁是需要人启用的写入,通过写入关口,会被审计。参见 [UniFi Network](/zh-hans/iot/unifi/#unifi-access)。
- **SmartPower PDU 插口。** 插口的继电器、功率、电流、电压和功率因数是 UniFi Network 设备的 tag,PDU 的总功耗也是一个。向插口写入 `on` 会切换它并保留每个其他插口的名称;`cycle` 会关闭它、等待、再打开,15 分钟内最多一次,并且总是以开启结束。参见 [UniFi Network](/zh-hans/iot/unifi/#smartpower-pdu-插座)。
- **Shelly 设备。** 协议 `shelly`:Gen2 及以后的 RPC,使用设备自己的 digest 登录,为它报告的每个组件提供 tag,为开关、灯、卷帘和温控器提供写入。Gen1 会被拒绝,并给出一条把它指向 MQTT 的消息。
- DataSetMetaData 和发现响应,较大时分块,从西门子发布者捕获的消息中读取。发布者默认每十个间隔宣布一次它的元数据(`HOTLOOP_UADP_PUBLISH_METADATA_EVERY`,0 表示关闭)。参见[协议与驱动](/zh-hans/iot/protocols/)。
- **转发队列的排空器会再看一次,并在失败时说明。** 一次在读数等待时什么也没发送的遍历,过去会等一个安静的轮询永远不会发出的推动,而失败的遍历会退避半分钟,日志里没有任何一行。
- **测试等待它们所等待的东西。** 六个能耗测试等待测试台的读数,而不是固定的睡眠。

- **不出声的 Modbus 设备在每个点上都读为坏。** 在串行线路上,超时的请求用掉了整个轮询期限,所以只有第一个块变坏,而之后的每个点在线缆拔掉期间都保留它最后的良好值。现在,什么都不应答的设备会在同一次轮询中把每个点都标为坏。参见[协议与驱动](/zh-hans/iot/protocols/)。
- **已完成的功能默认开启发布。** 在 Helm chart 和二进制里:内置的 MQTT broker(它的登录在 HotLoop 中创建)、OPC UA 服务器(认证开启,带有生成的 `opcua-reader` 登录,Settings 会展示给管理员)、定时报告、每日本地备份(每 24 小时,5 Gi 卷)、ServiceMonitor(只在存在 Prometheus operator CRD 的地方渲染,所以没有它们的集群照旧安装),以及没有主机名的 Ingress,在设置 `ingress.hosts[0].host` 之前,它会应答该类所服务的任何主机。报告、备份、OPC UA 证书和 edge 队列默认使用 HotLoop 数据目录下的一个可写目录,另一个服务已占用的端口会保持空闲并说明。chart `hotloop` 以及生成的 IoT 和 Edge chart 都带有它。
- **报警通道和 edge 发布者已开启,并等待目标。** webhook、邮件、ntfy、Gotify、Discord webhook 和 Discord 机器人通道,以及 `edgePublish`,从第一次启动起就是开启的。没有地方可发的通道不再让安装或启动停下:它会等待并说明。管理员在 Settings 的“Where alarms and readings go”下输入每个目标,在那里保存的内容优先于 chart 的值。报警通道在保存时生效;edge 发布者的目标在下次重启时生效。Settings 还有一张 OPC UA 服务器卡片,带有端点和生成的登录。
- **Kafka 目标会等待 broker 放置一个新的 topic。** 一个被繁忙主机短暂隔离的单个 broker,过去会让第一次查看因 `INVALID_REPLICATION_FACTOR` 失败;现在目标会等到它的时间用完,并说明 broker 回答了什么。
- **转发队列的排空器会再看一次,并在失败时说明。** 一次在读数等待时什么也没发送的遍历,过去会等一个安静的轮询永远不会发出的推动,而失败的遍历会退避半分钟,日志里没有任何一行。

- **延续自 4.23.4 和 4.23.5。** TwinCAT 的 `.TcVIS` 以及 cds-text-sync 和 codescribe 的画面会连同它们的按钮、框架、指示灯和表达式规则导入,UniFi 画面的刷新会等待正在加载的视图。这两个版本都没有发布,所以两者都在这里。参见 [4.23.4](/zh-hans/releases/hotloop-4-23-4/) 和 [4.23.5](/zh-hans/releases/hotloop-4-23-5/)。

## 迁移

无。

## API 变更

`GET /api/unifi-protect/{id}/cameras/{camera}/snapshot` 返回摄像头当前的 JPEG。协议列表里有 `unifi-protect` 和 `unifi-access`。参见 [HTTP API](/zh-hans/iot/api/)。

## 从 4.23.5 升级

普通的 `helm upgrade`。没有迁移,也没有新的 secret。4.23.4 和 4.23.5 都打了标签,它们的发布运行在测试作业中失败,尚未发布任何东西,所以在此之前的最后一个版本是 4.23.3,而这个版本带有两者的变更。设置了上述任何功能的 values 文件仍然优先;把某一项设为 `false`,它就不会渲染 listener、Service、卷或 Ingress。

## 尚未验证的内容

- Protect、Access 和 PDU 的插口是按已发布的 API 构建的,并用保持状态的替身控制台做了约束。没有一项在真实的控制台或 PDU 上运行过,所以它们在路线图里的方框没有打勾。
- 附在报警通知上的快照尚未构建。
- PubSub:Security Key Service 尚未构建(密钥是静态的),也没有西门子、CODESYS 或倍福的发布者上过试验台。
- UniFi 端口禁用仍在等待来自真实 10.6 控制台 Web 界面的请求。
