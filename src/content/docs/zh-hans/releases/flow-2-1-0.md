---
title: "Flow 2.1.0 发布说明"
description: "HotLoop Flow 2.1.0 带来了什么，升级时有什么变化，以及动手改动运行中的工厂之前该读什么。"
sidebar:
  label: "2.1.0"
---

HotLoop Flow 2.1.0 包含[路线图](/zh-hans/flow/roadmap/)的第 0 到 2 阶段，以及那些一直阻碍人们把真实流程放上去的日常缺口。现在每次部署都是一条记录，可以比对、测试、审阅和还原。流程可以带测试，在一次糟糕的部署发生之前先运行。保存只会重启你改过的节点，工厂的其余部分原样不动。

这个版本没有改变流程文件的读取和写入方式。逐字节往返保持不变，所以在 2.0.5 上能跑的 `flows.json` 在 2.1.0 上照样能跑。

## 新功能

**部署**
- 每次部署都是一条记录：谁、从哪里、什么时候、备注、被替换的修订、逐字节的流程文件，以及按当时原样加密的凭据。`GET /deployments` 读取它们。`history.retain` 默认保留最近 100 条。
- 读起来像一次审阅的差异：逐节点、逐属性，布局与逻辑分开，凭据永不显示。可用于 API、命令行（`hotloop-flow diff`），也可作为 git 自己的 diff 驱动。
- 回滚会把旧记录作为一次新的部署放回去，流程和凭据一起，所以被删除的节点会带着它的代理密码回来。
- 部分部署：一次保存只重启变化过的节点。其他所有节点上的 MQTT 会话、监听器和 Delay 队列继续运行。`HotLoop-Flow-Deployment-Type`（或 Node-RED 的请求头）选择节点、流程或完整部署。
- 编辑器在部署前先审阅，把差异画在画布上并附一条备注，还会显示带回滚按钮的历史。
- 流程即代码：`hotloop-flow deploy` 输出与正在运行内容的差异，并基于它出发时的修订进行部署，所以竞争冲突会变成一条红色流水线。`hotloop-flow export` 逐字节交回正在运行的文件。`hotloop-flow token` 生成一个 API 令牌以及要为它配置的哈希。
- 可选的 git 镜像：设置 `history.git` 后，每次部署都是一次提交，作者就是执行部署的人。

**测试**
- 流程测试：`flows.test.yaml` 放在 `flows.json` 旁边，由 `hotloop-flow test`（加 `-junit` 输出 JUnit）在真实的运行时和真实的节点上运行。Delay、Trigger、Inject、Join 和 Batch 跑在由测试拨动的时钟上，所以五分钟的 Delay 只是一步。凡是与外部世界通信的部分，MQTT、HTTP、PostgreSQL、InfluxDB、TCP、UDP、WebSocket、文件、exec，都会被替身取代，测试检查的是本该发出去的内容。
- 部署关卡：打开 `tests.gate`，流程未通过测试套件的部署会返回 422 和完整报告。回滚不受关卡限制，因为回滚就是退路。
- 编辑器可以把一条调试消息变成测试并运行它。

**节点和协议**
- JSONata，已用公开的 jsonata-js 2.2.2 测试套件验证：1686 个用例中 1673 个通过，未通过的 13 个按名称固定并注明原因。
- Inject 按 crontab 触发，与 Node-RED 在同一分钟，并已检查六个时区的时间变更。
- MQTT 5（属性、订阅选项、会话过期）和遗嘱消息。MQTT 3.1.1 仍然可用。
- 通过 `tls-config` 节点，在 TCP、HTTP 请求和 MQTT 上使用 TLS。WebSocket 监听器和客户端可以启动，客户端支持 TLS。
- HTTP 的 Cookie 和 multipart，已对照 Node-RED 使用的库检查。
- Split、Join 和 Batch 的工作方式与 Node-RED 的一致：流式处理、超时、归并、间隔。还有 Link Call，以及 Link Out 的返回模式。
- 密码可以放在挂载的 Secret 里，而不是流程中。Helm 图表新增 `secrets.mounts`。

**登录**
- 双重验证登录（TOTP），免费，任何人都可以在编辑器中开启。
- 锁定、重启后仍保留的会话，以及记录谁从哪里做了什么的审计日志（`GET /audit`、`audit.read`）。

## 变更内容

- 锁定默认开启：同一地址对一个账户失败 5 次，或同一地址失败 20 次，就会锁定 15 分钟并返回 429。`auth.lockout` 可修改这些数字。
- 会话以哈希形式保存在 `data/sessions.json` 中，并在每次请求时跟随配置，所以从配置中移除一项权限或一个用户，下一次请求就会生效。
- 回滚就是一次完整重启，除非你要求少一点。
- 镜像在 `/usr/share/doc/hotloop-flow/` 中带有 `LICENSE`、`NOTICE` 和 `THIRD_PARTY_LICENSES`。`THIRD_PARTY_LICENSES` 在构建时生成，列出二进制中每个 Go 模块和 npm 包的版本与许可证全文。构建遇到 GPL、AGPL 或 LGPL 依赖，或无人能识别的依赖，就会失败。
- `NOTICE` 之前是错的。它写着这里没有 Node-RED 的代码。Cron、Split、Join、Batch、Link Call、tls-config 以及 HTTP Cookie 和 multipart 的部分都是移植而来，现在它列出每个移植的文件，注明出处、版权所有者和许可证，cronosjs 附完整的 ISC 文本，其余附 MIT 文本。每个移植的文件顶部也写着同样的内容。
- 被拒绝的部署不再清理内存中的凭据，在 Chromium 中双击节点会打开它的对话框。这两个问题都是在构建时发现的。

## 升级说明

从 2.0.5 升级只需更换镜像（`helm upgrade`，或在你的 Quadlet 单元里换上新标签）。无需迁移，无需标志。

- 首次启动会在 `data.dir` 下创建 `sessions.json`、`audit.log` 和一个 `deployments` 目录。以前会话在内存中，所以升级后每个人需要登录一次。
- 配置中所有新增项都是可选的，默认关闭或无害。你现有的一切都不会失效。
- WebSocket 令牌：编辑器现在把令牌作为子协议 `hotloop-flow.bearer.<token>` 发送，与 `hotloop-flow` 一起提供。这是所有连接 `/comms` 的方式中的首选。在 URL 中发送 `?access_token=` 的脚本仍然可用，服务器会为每个这样的连接记录一条警告，说明令牌会泄漏到代理和访问日志中，以及应该改用什么。URL 本身绝不会写入 Flow 的日志或审计记录。取消 URL 形式要等到将来的主版本。

## 新设置

| YAML | 环境变量 | 默认值 |
|---|---|---|
| `tests.gate` | `HOTLOOP_FLOW_TESTS_GATE` | `false`。`true` 会拒绝流程未通过 `flows.test.yaml` 的部署。 |
| `tests.timeout` | | `2m`，一次测试运行的实际时间上限。无法完成的运行会拒绝该部署。 |
| `secrets.allowedPaths` | `HOTLOOP_FLOW_SECRET_ALLOWED_PATHS` | 空。除 `data.dir` 外，可读取 `tls-config` 或凭据文件的额外目录树。不是文件节点的范围：File In 节点仍然无法读取它们。 |
| `secrets.mounts`（图表） | | 空。以只读方式挂载的 Kubernetes Secret，每一个都会加入密钥范围。 |
| `auth.tokens` | `HOTLOOP_FLOW_DEPLOY_TOKEN_HASH` | 无。供机器使用的 API 令牌，以哈希形式保存。该环境变量会创建一个只能读取和部署的 `deploy` 令牌。用 `hotloop-flow token` 创建一个。 |
| `auth.lockout` | | `attempts: 5`, `perAddress: 20`, `window: 15m`, `duration: 15m` |
| `history.retain` | | `100`。`0` 保留每一条记录。 |
| `history.git` | `HOTLOOP_FLOW_GIT_URL`, `HOTLOOP_FLOW_GIT_USERNAME`, `HOTLOOP_FLOW_GIT_PASSWORD` | 关闭。 |
| `audit.maxBytes`, `audit.keep` | | 16 MiB，4 个文件。 |

镜像：`ghcr.io/hotloop-io/hotloop-flow:2.1.0`，linux/amd64 和 linux/arm64。图表：`https://hotloop.io/hotloop-flow/`。此标签的 README 有其余内容：https://github.com/HotLoop-io/hotloop-flow/blob/v2.1.0/README.md
