---
title: "core 4.16.0 发布说明"
description: "HotLoop core 4.16.0 包含什么、升级时有哪些变化,以及动手处理一个正在运行的工厂之前应该先读什么。"
sidebar:
  label: "4.16.0"
---

这是自 8 月的 4.3.1 以来第一个公开发布的版本。4.4.0 到 4.15.3 的所有内容都已合并但从未发布,所以如果你还在 4.3.1,就会一次拿到全部更新,同时换上新名称、新镜像、新 chart 和新许可证。**从 4.3.1 升级,不是一条简单的 `helm upgrade` 就能完成。** 动手处理正在运行的工厂之前,请先读下面的“从 4.3.1 升级”。

完整说明在 README 里:先是 4.16.0 的变化,下面是一直到 4.4.0 的每个版本。

## 简要说明

- **HotLoop Core:实体。** 每个 tag 都是一个带稳定 id 的实体,放在 ISA-95 设备树上。电机、阀门、PID 回路和其余对象都是由各自的 tag 组合而成的复合实体,每条报警也是实体,对实体下发的每条命令都走与 tag 写入相同的写入关口。代理(MCP)、自动化和新的 Entities、Plant 画面都用它们。服务调用可以先用 `?dry_run=true` 试问,命令提示会在你确认之前告诉你“Would be refused: ...”。
- **能送到手机上的通知:** 带 Acknowledge 按钮的 ntfy 和 Discord 机器人、Gotify,以及 Discord webhook,并用速率限制把一大波通知合并成一条摘要。
- **对运行中的工厂有意义的修复:** 取消搁置(unshelve)可能清掉一条未确认的报警;OPC UA 订阅可能永远沉默,而会话仍显示已连接;一个不出声的 Modbus 设备最多要 15 分钟才被判定为掉线;失败的 webhook 会把自己的 URL 写进日志,而对 Discord 和 ntfy 来说,这个 URL 就是密码;恢复时按位置加载列;每次重新部署都会替换 OPC UA 服务器的证书,于是 Ignition 不再信任它;Discover tags 把每个 OPC UA 节点都导入成 float;Settings 画面列出了没有任何东西会读取的轮询变量。
- **Ignition 8.3.9 可以读取我们的 OPC UA 服务器**,已端到端验证,服务器现在把制造商报告为 `HotLoop`。
- **Edge Relay 随版本发布**,有自己的镜像和 chart,与 Gateway 同步更新。TimescaleDB 2.30.1,扩展现在会自行更新。

### API 变更

- 空列表在所有地方(包括流)都是 `[]`,绝不是 `null`。
- 没有有效读数的 `/api/history` 时间段为 `null`(一个空缺),坏读数不计入平均值。
- API 无法归类的错误是带日志编号的 500,而不是 400。写入或浏览时出错的设备返回 502。
- 报警实体不接受的服务(`alarm.turn_on`)返回 400。以前它会回答成功,却什么也不做。
- 取消搁置一条并未搁置的报警返回 409。
- tag 的 JSON 始终带有 `minValue`、`maxValue` 和 `hasRange`。
- 新增:`POST /api/services/{domain}/{service}` 支持 `?dry_run=true`。只接受 `true` 或 `false`,其他值返回 400。

### 从 4.3.1 升级

- 镜像 `ghcr.io/hotloop-io/hotloop`(原为 `ghcr.io/embernet-ai/industrial-iot`),chart 仓库 `https://hotloop.io/hotloop`,chart `hotloop`(原为 `industrial-iot`),每个 `IIOT_` 变量都改为 `HOTLOOP_`。
- chart 名称写在工作负载的 selector 里,Kubernetes 不能原地修改。保留 release 名称和 namespace,然后:对数据库执行 `pg_dump`;删除旧的 Deployment(`<release>`)和 StatefulSet(`<release>-postgresql`),数据库卷会原样保留;执行 `helm upgrade <release> hotloop/hotloop -f your-4.3.1-values.yaml`。不要用 `--reuse-values`。把 `extraEnv` 里的每个 `IIOT_` 改名,并去掉对 `image.repository` 的覆盖。新的数据库 pod 会挂载旧卷,Gateway 在启动时把它迁移到新版本。
- 许可证:HotLoop 自己的许可条款,不是 4.3.1 附带的那一份。家庭和实验室使用免费;企业通过 EmberNet 免费注册。当前条款见 LICENSE。
- 现在有了登录,写入默认关闭,时区加载失败时会停止启动,而不是继续按 UTC 运行。
