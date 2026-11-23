---
title: "core 4.21.0 发布说明"
description: "HotLoop core 4.21.0 包含什么、升级时有哪些变化,以及动手处理一个正在运行的工厂之前应该先读什么。"
sidebar:
  label: "4.21.0"
---

这个版本为 OPC UA 服务器加入 X.509 登录,取消了 64 字节的密码上限,并默认关闭已弃用的安全策略。它还扩展了 CODESYS 报警导入。构建于 [4.20.2](/zh-hans/releases/hotloop-4-20-2/) 之上。

## 变更内容

- **客户端可以用 X.509 证书登录 OPC UA 服务器。** 管理员把客户端的公钥证书附加到一个 HotLoop 用户上(Settings、OPC UA certificates,或 API,或 MCP 工具),持有私钥的客户端就以该用户的身份、用该用户的权限登录。吊销证书会在十秒内结束它正在进行的会话,每次证书登录和每次拒绝都在 logbook 里。在 `HOTLOOP_OPCUA_SERVER_ALLOW_X509=true`(chart `opcuaServer.allowX509`)之前它是关闭的。设备驱动可以用 `userCertificate` 和 `userPrivateKey` 以同样方式登录(RSA,密钥像密码一样被密封)。带名称规则的受信任 CA 尚未构建。
- **65 到 72 字节的密码现在可以通过 OPC UA 登录。** 它们在 Web 界面里一直可用。服务器所基于的库曾拒绝任何密码超过 64 字节的用户名 token。
- **已弃用的安全策略 `Basic128Rsa15` 和 `Basic256` 默认关闭。** 服务器不再列出它们,按名称请求其中一个的客户端会在通道打开时被拒绝。这适用于新安装和升级。只会说较旧协议的传统客户端用 `HOTLOOP_OPCUA_SERVER_ALLOW_DEPRECATED_POLICIES=true`(chart `opcuaServer.allowDeprecatedPolicies: true`)重新连接,服务器会在启动时说明这一点。关闭它们的选项在上游也是开放的(pull request 66)。
- **CODESYS 报警导入会读取 Outside range 报警。** IDE 的 Export Alarms 为它写出 `OutOfArea`,它会被导入为两条报警,下限处的 `lo` 和上限处的 `hi`。Inside the range、Change、Event 和 Alarm (API) 被列为已跳过并附上原因:这里没有任何东西能诚实地表达它们。导入器是根据 IDE 所提供的每种观测类型的一次导出来扩展的,该导出作为测试 fixture 保存。

## API 变更

- 新增:`GET /api/opcua/certificates`、`GET` 和 `POST /api/users/{username}/certificates`、`POST /api/users/{username}/certificates/{thumbprint}/revoke`、`DELETE /api/users/{username}/certificates/{thumbprint}`,全部是 `users.manage`。五个新的 MCP 工具,共 133 个。
- 一个迁移,0027:`user_certificates` 表(仅公钥证书)。它在备份里。

## 升级

普通的 `helm upgrade`,或 Quadlet 自动更新。请先检查你的 OPC UA 客户端里有没有用 `Basic256` 或 `Basic128Rsa15` 的(Ignition 的连接会显示):那个客户端在升级后会停止连接,直到你把它改到 `Basic256Sha256` 或设置上面的传统开关。带着新表回滚到上一个版本没有试过。

- 全部四个 chart(`hotloop`、`hotloop-iot`、`hotloop-edge`、`hotloop-edge-relay`)都在 4.21.0,之前的每个版本仍在索引里。

- 这次构建只有 amd64,`stable` 保留它已有的 arm 镜像。下一个版本是一次小的版本号提升,用来构建 arm 镜像。
