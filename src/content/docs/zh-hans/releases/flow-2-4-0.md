---
title: "Flow 2.4.0 发布说明"
description: "HotLoop Flow 2.4.0 带来了什么，升级时有什么变化，以及动手改动运行中的工厂之前该读什么。"
sidebar:
  label: "2.4.0"
---

HotLoop Flow 2.4.0 让 EmberCORE 仪表板可以让人登录 Flow。从仪表板打开 Flow 的人，会带着其租户赋予的角色进入，完全访问或只读，无需第二次登录。除非配置了仪表板的密钥，否则它是关闭的，之前能用的一切都不会改变。

## 新功能

**从 EmberCORE 仪表板登录**
- 仪表板会在它代理到 Flow 的每个请求上，包括编辑器的 websocket，把它签名的令牌放进 `X-Embernet-Assertion`。Flow 用仪表板的公钥检查它：签名（ES256）、签发者（`embernet-dashboard`）、它是为这个租户里的这个 Flow 生成的（audience 是 `<tenant>/<release>`，所以为其他应用生成的令牌在这里打不开任何东西），以及有效期，约一分钟。其中任何一项有误的令牌都会被拒绝，请求中的其他内容也救不了它。
- 角色来自仪表板中租户的角色映射。`*` 是所有权限。`read` 是流程、节点面板、设置和状态，没有任何会修改它们的内容：没有部署、没有 inject、没有部署日志。操作员和查看者默认获得 `read`。既不是这两者也没有角色的，就没有访问权限。以这种方式登录的人，在部署日志和审计记录中显示为 `dashboard:<email>`。
- 没有会话。仪表板在每个请求上发送新的令牌，所以在那里改变的角色在下一个请求就生效，也没有什么需要撤销。
- 编辑器会显示“请从 EmberCORE 仪表板打开”，而不是提供自己的登录表单，并在仪表板为你登录时去掉“退出登录”按钮。在还没有人登录时，它通过 `GET /auth/mode` 来询问。
- 图表通过 `embernetSignin` 接收它。App Store 传入仪表板的公钥；图表挂载它、写入设置、滚动 Pod，并给 Service 加上注解，让仪表板知道要让人登录。

## 变更内容

除非设置密钥，否则什么都不发生。没有密钥文件时，Flow 完全不读取该请求头，默认值的 `helm template` 与之前相同。

## 升级

对 2.4.0 的镜像和图表做一次普通的 `helm upgrade`。首次启动不会发生任何事。

要手动使用，挂载仪表板的公钥（PEM 文件），并设置 `auth.assertion.publicKeyFile` 和 `auth.assertion.audience`，或 `HOTLOOP_FLOW_ASSERTION_PUBLIC_KEY_FILE` 和 `HOTLOOP_FLOW_ASSERTION_AUDIENCE`。Flow 在密钥无法读取或没有 audience 时拒绝启动。其他设置是 `auth.assertion.issuer`（`embernet-dashboard`）、`header`（`X-Embernet-Assertion`）和 `hideLogin`（`true`）。

管理员登录和 API 令牌仍在它旁边继续工作。它们是员工和自动化的应急通道，编辑器的表单消失并不影响它们。

镜像：`ghcr.io/hotloop-io/hotloop-flow:2.4.0`，linux/amd64 和 linux/arm64。图表：`https://hotloop.io/hotloop-flow/`。此标签的 README 有其余内容：https://github.com/HotLoop-io/hotloop-flow/blob/v2.4.0/README.md
