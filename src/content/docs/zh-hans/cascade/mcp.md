---
title: "MCP 服务器"
description: "Cascade 内置可读可写的 MCP 服务器：83 个工具，每个都是经过自身处理程序的 API 路由，带有权限、理由和一条审计记录。"
---

:::note[也涵盖即将推出的内容]
本页也涵盖了一些比最新版本 HotLoop Cascade 1.4.2 更新的内容。其中有些可能不在您已安装的版本里。[发布说明](/zh-hans/releases/)会告诉您有哪些变化。
:::

Cascade 有一个 MCP 服务器，既能读也能写。它默认开启，位于 `/mcp`，与 API 和编辑器在同一个地址，连接它的智能体能做的，就是持有该密钥的人能做的，不会更多。这里没有需要绕开的只读模式，因为智能体只能看、不能碰的服务器，其实就是一个状态页，而您已经有一个了。

84 个工具，每一个都是 REST API 的一条路由。调用不会绕过路由，而是经过路由：路由自己的处理程序检查权限、校验请求体、完成修改并写入审计记录。没有任何东西被复制进 MCP 服务器而可能产生偏差，也没有任何东西被排除在外以便被绕过。

这对您意味着：如果某个工作流、凭据、项目或用户是您可以在编辑器里修改的，那么持有您密钥的智能体也能修改，受您角色的限制，并且审计日志会记录这是智能体所为，以及是哪一个。

## 连接

先创建一个密钥。在编辑器里，它位于您的账户下，也可以用 API 创建：

```sh
curl -s -X POST https://cascade.plant.example/api/v1/api-keys \
  -H "X-CSRF-Token: $CSRF" -b cookies.txt -H 'Content-Type: application/json' \
  -d '{"name":"line 4 agent","scopes":["*"],"days":30}'
```

令牌只返回一次，以 `hlc_` 开头。密钥能做持有者能做的事，再按它的作用域收窄：给智能体 `["workflow.read","execution.read"]`，它就只能看、不能碰。服务账户密钥（一个项目、一个角色，由项目管理员创建）同样适用，是长期集成的合适选择。

然后让客户端指向 `/mcp`，并把密钥作为 bearer 令牌发送。它使用的传输方式是可流式的 HTTP：

```json
{
  "mcpServers": {
    "cascade": {
      "type": "http",
      "url": "https://cascade.plant.example/mcp",
      "headers": { "Authorization": "Bearer hlc_..." }
    }
  }
}
```

没有密钥、密钥错误、已吊销或已过期，或对应用户已被停用的请求，在到达任何工具之前就会收到 401；会话中途被吊销的密钥，在下一次调用时就会失效。

## 规则

**权限属于路由。** `whoami` 会告诉您该密钥能看到哪些项目，以及它在每个项目中的角色。密钥无权使用的工具，会带着路由自己的理由被拒绝：缺少权限返回 403，看不到的东西返回 404，与 REST API 给出的答复相同。这是一种决定，不是需要绕开的故障。

**写入需要理由。** 每个会修改内容的工具都接受一个 `reason`，没有就拒绝。它会连同您的密钥和客户端给自己起的名字一起写入审计日志。

**密钥保持原处。** 没有任何工具会向任何密钥返回凭据的机密字段，通过 MCP 创建的凭据，其机密在到达时就被封存进保险库。`get_credential` 与编辑表单所见的无机密视图相同。

**开关属于部署。** 两个设置，在服务器启动时的环境中，API 调用和智能体都改不了：

| 设置 | 默认值 | 作用 |
|---|---|---|
| `HOTLOOP_CASCADE_MCP` | `true` | 设为 `false`，`/mcp` 就不存在了。 |
| `HOTLOOP_CASCADE_MCP_WRITES` | `true` | 设为 `false`，每个会修改内容的工具都会拒绝，读取类的仍然可用。 |

`PATCH /settings` 不认识其中任何一个，所以即使智能体可以编辑设置，也无法把写入重新打开。

**它从不向设备写入。** `run_workflow` 会启动一次真实的执行，其步骤对所调用的系统做什么，取决于这些步骤。任何会让阀门动作或改变设定值的操作，都要经过 HotLoop 的写入闸门，因此无论是谁启动了工作流，闸门的审计都能看到。

## 审计日志记录什么

一次写入对应两行。路由自己的那一行以智能体为操作者，类型为 `mcp`，并记录密钥、密钥属于谁以及客户端：

```
actor:  mcp, "line 4 agent (ops@plant.example) via claude-desktop"
action: workflow.created
```

另一行来自工具，带有理由，无论路由答应还是拒绝都会写入：

```
action: mcp.write   target: create_workflow
detail: {"reason": "the line 4 oven needs a setpoint workflow", "method": "POST", "path": "/api/v1/workflows", "status": 201}
```

带 `action=mcp.write` 的 `list_audit`，就是智能体做过的每一项修改及其原因。

## 工具

每一行都是一条真实的路由，以及该路由要求的权限，并有测试保证这张表与两者一致。权限要么是项目权限（在该对象所在的项目中检查），要么是实例权限（所有者和管理员）。任何已登录的密钥都可以请求这样标注的工具。

带请求体的工具接受一个 `body`，与 REST API 接受的 JSON 相同。`describe_tool_body` 会给出任何工具的模式，让第一次调用就是对的。

| 工具 | 路由 | 权限 | 类型 |
|---|---|---|---|
| `get_version` | `GET /api/v1/version` | 任何已登录的密钥 | 读取 |
| `whoami` | `GET /api/v1/me` | 任何已登录的密钥 | 读取 |
| `list_permissions` | `GET /api/v1/permissions` | 任何已登录的密钥 | 读取 |
| `list_roles` | `GET /api/v1/roles` | 任何已登录的密钥 | 读取 |
| `get_role` | `GET /api/v1/roles/{role}` | 任何已登录的密钥 | 读取 |
| `list_projects` | `GET /api/v1/projects` | `project.read` | 读取 |
| `get_project` | `GET /api/v1/projects/{project}` | `project.read` | 读取 |
| `create_project` | `POST /api/v1/projects` | `project.create` | 写入 |
| `rename_project` | `PATCH /api/v1/projects/{project}` | `project.update` | 写入 |
| `delete_project` | `DELETE /api/v1/projects/{project}` | `project.delete` | 写入 |
| `list_members` | `GET /api/v1/projects/{project}/members` | `project.read` | 读取 |
| `set_member` | `PUT /api/v1/projects/{project}/members/{user}` | `project.members` | 写入 |
| `remove_member` | `DELETE /api/v1/projects/{project}/members/{user}` | `project.members` | 写入 |
| `list_service_accounts` | `GET /api/v1/projects/{project}/service-accounts` | `project.members` | 读取 |
| `list_workflows` | `GET /api/v1/workflows` | `workflow.read` | 读取 |
| `get_workflow` | `GET /api/v1/workflows/{workflow}` | `workflow.read` | 读取 |
| `create_workflow` | `POST /api/v1/workflows` | `workflow.create` | 写入 |
| `save_workflow` | `PUT /api/v1/workflows/{workflow}` | `workflow.update` | 写入 |
| `delete_workflow` | `DELETE /api/v1/workflows/{workflow}` | `workflow.delete` | 写入 |
| `listen_workflow` | `POST /api/v1/workflows/{workflow}/listen` | `workflow.execute` | 写入 |
| `activate_workflow` | `POST /api/v1/workflows/{workflow}/activate` | `workflow.activate` | 写入 |
| `deactivate_workflow` | `POST /api/v1/workflows/{workflow}/deactivate` | `workflow.activate` | 写入 |
| `run_workflow` | `POST /api/v1/workflows/{workflow}/run` | `workflow.execute` | 写入 |
| `move_workflow` | `PUT /api/v1/workflows/{workflow}/folder` | `workflow.update` | 写入 |
| `list_workflow_versions` | `GET /api/v1/workflows/{workflow}/versions` | `workflow.read` | 读取 |
| `get_workflow_version` | `GET /api/v1/workflows/{workflow}/versions/{version}` | `workflow.read` | 读取 |
| `diff_workflow_versions` | `GET /api/v1/workflows/{workflow}/diff` | `workflow.read` | 读取 |
| `restore_workflow_version` | `POST /api/v1/workflows/{workflow}/versions/{version}/restore` | `workflow.update` | 写入 |
| `label_workflow_version` | `PUT /api/v1/workflows/{workflow}/versions/{version}/label` | `workflow.update` | 写入 |
| `preview_expression` | `POST /api/v1/workflows/{workflow}/preview` | `workflow.read` | 读取 |
| `list_expression_functions` | `GET /api/v1/expression/functions` | 任何已登录的密钥 | 读取 |
| `list_step_types` | `GET /api/v1/step-types` | 任何已登录的密钥 | 读取 |
| `shape_step` | `POST /api/v1/step-types/{type}/{version}/shape` | 任何已登录的密钥 | 读取 |
| `list_folders` | `GET /api/v1/folders` | `folder.read` | 读取 |
| `create_folder` | `POST /api/v1/folders` | `folder.create` | 写入 |
| `update_folder` | `PATCH /api/v1/folders/{folder}` | `folder.update` | 写入 |
| `delete_folder` | `DELETE /api/v1/folders/{folder}` | `folder.delete` | 写入 |
| `list_variables` | `GET /api/v1/variables` | `variable.read` | 读取 |
| `create_variable` | `POST /api/v1/variables` | `variable.create` | 写入 |
| `update_variable` | `PUT /api/v1/variables/{variable}` | `variable.update` | 写入 |
| `delete_variable` | `DELETE /api/v1/variables/{variable}` | `variable.delete` | 写入 |
| `list_executions` | `GET /api/v1/executions` | `execution.read` | 读取 |
| `get_execution` | `GET /api/v1/executions/{execution}` | `execution.read` | 读取 |
| `get_step_output` | `GET /api/v1/executions/{execution}/steps/{step}/output` | `execution.read` | 读取 |
| `get_insights` | `GET /api/v1/insights` | `execution.read` | 读取 |
| `stop_execution` | `POST /api/v1/executions/{execution}/stop` | `execution.stop` | 写入 |
| `retry_execution` | `POST /api/v1/executions/{execution}/retry` | `execution.retry` | 写入 |
| `replay_execution` | `POST /api/v1/executions/{execution}/replay` | `execution.retry` | 写入 |
| `delete_execution` | `DELETE /api/v1/executions/{execution}` | `execution.delete` | 写入 |
| `annotate_execution` | `PUT /api/v1/executions/{execution}/annotation` | `execution.annotate` | 写入 |
| `clear_annotation` | `DELETE /api/v1/executions/{execution}/annotation` | `execution.annotate` | 写入 |
| `list_credential_types` | `GET /api/v1/credential-types` | 任何已登录的密钥 | 读取 |
| `list_credentials` | `GET /api/v1/credentials` | `credential.list` | 读取 |
| `get_credential` | `GET /api/v1/credentials/{credential}` | `credential.read` | 读取 |
| `start_oauth` | `POST /api/v1/credentials/{credential}/oauth/start` | `credential.update` | 写入 |
| `create_credential` | `POST /api/v1/credentials` | `credential.create` | 写入 |
| `update_credential` | `PATCH /api/v1/credentials/{credential}` | `credential.update` | 写入 |
| `delete_credential` | `DELETE /api/v1/credentials/{credential}` | `credential.delete` | 写入 |
| `share_credential` | `PUT /api/v1/credentials/{credential}/shares/{project}` | `credential.share` | 写入 |
| `unshare_credential` | `DELETE /api/v1/credentials/{credential}/shares/{project}` | `credential.share` | 写入 |
| `create_role` | `POST /api/v1/roles` | `role.manage` | 写入 |
| `update_role` | `PUT /api/v1/roles/{role}` | `role.manage` | 写入 |
| `delete_role` | `DELETE /api/v1/roles/{role}` | `role.manage` | 写入 |
| `list_redaction_policies` | `GET /api/v1/redaction-policies` | 任何已登录的密钥 | 读取 |
| `create_redaction_policy` | `POST /api/v1/redaction-policies` | `redaction.manage` | 写入 |
| `update_redaction_policy` | `PUT /api/v1/redaction-policies/{policy}` | `redaction.manage` | 写入 |
| `delete_redaction_policy` | `DELETE /api/v1/redaction-policies/{policy}` | `redaction.manage` | 写入 |
| `list_secret_providers` | `GET /api/v1/secret-providers` | 任何已登录的密钥 | 读取 |
| `test_secret_provider` | `POST /api/v1/secret-providers/{provider}/test` | `secrets.manage` | 写入 |
| `list_log_destinations` | `GET /api/v1/log-destinations` | `logstream.manage` | 读取 |
| `test_log_destination` | `POST /api/v1/log-destinations/{destination}/test` | `logstream.manage` | 写入 |
| `list_keys` | `GET /api/v1/api-keys` | 任何已登录的密钥 | 读取 |
| `revoke_key` | `DELETE /api/v1/api-keys/{key}` | 任何已登录的密钥 | 写入 |
| `list_scim_tokens` | `GET /api/v1/scim-tokens` | `scim.manage` | 读取 |
| `revoke_scim_token` | `DELETE /api/v1/scim-tokens/{token}` | `scim.manage` | 写入 |
| `list_users` | `GET /api/v1/users` | `user.manage` | 读取 |
| `create_user` | `POST /api/v1/users` | `user.manage` | 写入 |
| `change_user` | `PATCH /api/v1/users/{user}` | `user.manage` | 写入 |
| `delete_user` | `DELETE /api/v1/users/{user}` | `user.manage` | 写入，仅所有者 |
| `list_audit` | `GET /api/v1/audit` | `audit.read` | 读取 |
| `verify_audit` | `GET /api/v1/audit/verify` | `audit.read` | 读取 |
| `get_settings` | `GET /api/v1/settings` | `instance.settings` | 读取 |
| `change_settings` | `PATCH /api/v1/settings` | `instance.settings` | 写入 |
| `describe_tool_body` | 不是路由：工具的请求体所用的 JSON 模式 | 任何已登录的密钥 | 读取 |

## 特意不提供的

有十条路由自己就会拒绝密钥，因为它们要求有人登录，MCP 服务器也不假装不是这样：创建 API 密钥、创建服务账户密钥、创建 SCIM 令牌、添加、修改和删除外部密钥提供方、添加、修改和删除日志目的地，以及个人自己的密码。能够铸造密钥，或改变审计日志发往何处的密钥，就是一把能让自己一直有效的泄露密钥。这些路由每一条都只会回答“不允许”，所以一个也不提供。除此之外都是工具：列出日志目的地、密钥提供方和 SCIM 令牌，吊销 SCIM 令牌，测试提供方或目的地，列出和吊销密钥，打开工作流的测试 Webhook，以及发起 OAuth2 登录，它会返回一个地址，由用户随后打开。密钥可以吊销自己，这正是泄露密钥的持有者应该最先能做的事。

`/api/v1/openapi.json` 不是工具：`describe_tool_body` 会给出请求体。
