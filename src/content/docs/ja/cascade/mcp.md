---
title: "MCPサーバー"
description: "Cascadeには読み書きできるMCPサーバーがあります。91個のツールはそれぞれ専用ハンドラーを通るAPIルートで、権限、理由、監査の行が付きます。"
---

CascadeにはMCPサーバーがあり、読み取りも書き込みもできます。標準で有効で、APIやエディターと同じアドレスの`/mcp`にあります。接続したエージェントは、そのキーの持ち主ができることをでき、それ以上はできません。回り込むべき読み取り専用モードはありません。エージェントが見られても触れないサーバーはステータスページにすぎず、それはすでにお持ちだからです。

ツールは91個あり、そのすべてがREST APIのルートです。呼び出しはルートの脇を通らず、ルートそのものを通ります。ルート自身のハンドラーが権限を確認し、ボディを検証し、変更を行い、監査の行を書き込みます。MCPサーバーにコピーされて食い違うものはなく、迂回できるように外されたものもありません。

これが意味すること。エディターから変更できるワークフロー、認証情報、プロジェクト、ユーザーは、あなたのキーを持つエージェントも、あなたのロールの範囲内で変更できます。そして監査ログには、エージェントが行ったこととどのエージェントかが残ります。

## 接続

キーを作成します。エディターではアカウントの下にあり、APIでも作成できます。

```sh
curl -s -X POST https://cascade.plant.example/api/v1/api-keys \
  -H "X-CSRF-Token: $CSRF" -b cookies.txt -H 'Content-Type: application/json' \
  -d '{"name":"line 4 agent","scopes":["*"],"days":30}'
```

トークンは一度だけ返され、`hlc_`で始まります。キーは持ち主ができることを、スコープの範囲まで絞って行います。エージェントに`["workflow.read","execution.read"]`を与えれば、見ることはできても触れません。サービスアカウントのキー(1つのプロジェクト、1つのロール、プロジェクト管理者が作成)も同じように動き、常時稼働する連携に適したキーです。

次に、クライアントを`/mcp`に向け、キーをBearerトークンとして送ります。使うトランスポートはストリーミング可能なHTTPです。

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

キーがない、間違っている、失効または期限切れである、あるいは持ち主が無効にされているリクエストは、どのツールにも届く前に401を受け取ります。セッションの途中で失効したキーは、次の呼び出しから動かなくなります。

## ルール

**権限はルートのものです。** `whoami`は、キーが見られるプロジェクトと、それぞれでのロールを答えます。キーが使えないツールは、ルート自身の理由で拒否されます。足りない権限は403、見えないものは404で、REST APIが返す答えと同じです。これは回避すべき不具合ではなく、決定です。

**書き込みには理由が必要です。** 何かを変更するすべてのツールは`reason`を受け取り、なければ拒否します。理由は、キーとクライアントが名乗った名前とともに監査ログに書かれます。

**シークレットはそこから動きません。** どのツールも、どのキーに対しても、認証情報のシークレットのフィールドを返しません。MCPで作成した認証情報のシークレットは、届いた時点で保管庫に封印されます。`get_credential`は、編集フォームにあるものと同じ、シークレットを含まない表示です。

**スイッチはデプロイ側のものです。** サーバーが起動する環境にある2つの設定で、APIの呼び出しにもエージェントにも変更できません。

| 設定 | 既定値 | 内容 |
|---|---|---|
| `HOTLOOP_CASCADE_MCP` | `true` | `false`にすると`/mcp`はなくなります。 |
| `HOTLOOP_CASCADE_MCP_WRITES` | `true` | `false`にすると、何かを変更するすべてのツールが拒否し、読み取りのツールは引き続き動きます。 |

`PATCH /settings`はどちらも知らないので、設定を編集できるエージェントでも、書き込みを再び有効にすることはできません。

**設備には決して書き込みません。** `run_workflow`は実際の実行を開始し、そのステップが呼び出し先のシステムに何をするかはステップ次第です。バルブを動かしたり設定値を変えたりする操作はすべてHotLoopの書き込みゲートを通るので、誰がワークフローを始めても、そのゲートの監査に記録されます。

## 監査ログの内容

書き込み1回につき2行です。ルート自身の行では、エージェントが実行者となり、種類は`mcp`、キー、その持ち主、クライアントが入ります。

```
actor:  mcp, "line 4 agent (ops@plant.example) via claude-desktop"
action: workflow.created
```

もう1行はツールの行で、理由が入り、ルートが許可しても拒否しても書かれます。

```
action: mcp.write   target: create_workflow
detail: {"reason": "the line 4 oven needs a setpoint workflow", "method": "POST", "path": "/api/v1/workflows", "status": 201}
```

`action=mcp.write`を付けた`list_audit`は、エージェントが行ったすべての変更とその理由です。

## ツール

すべての行は実在するルートと、そのルートが求める権限であり、テストが表をその両方に照らして保っています。権限はプロジェクト権限(対象があるプロジェクトで確認)かインスタンス権限(オーナーと管理者)です。サインイン済みのキーなら、そう記されたものを要求できます。

本文を取るツールは`body`を受け取ります。REST APIが受け取るものと同じJSONです。`describe_tool_body`はどのツールのスキーマも返すので、最初の呼び出しから正しくできます。

| ツール | ルート | 権限 | 種類 |
|---|---|---|---|
| `get_version` | `GET /api/v1/version` | サインイン済みのすべてのキー | 読み取り |
| `whoami` | `GET /api/v1/me` | サインイン済みのすべてのキー | 読み取り |
| `list_permissions` | `GET /api/v1/permissions` | サインイン済みのすべてのキー | 読み取り |
| `list_roles` | `GET /api/v1/roles` | サインイン済みのすべてのキー | 読み取り |
| `get_role` | `GET /api/v1/roles/{role}` | サインイン済みのすべてのキー | 読み取り |
| `list_projects` | `GET /api/v1/projects` | `project.read` | 読み取り |
| `get_project` | `GET /api/v1/projects/{project}` | `project.read` | 読み取り |
| `create_project` | `POST /api/v1/projects` | `project.create` | 書き込み |
| `rename_project` | `PATCH /api/v1/projects/{project}` | `project.update` | 書き込み |
| `delete_project` | `DELETE /api/v1/projects/{project}` | `project.delete` | 書き込み |
| `list_members` | `GET /api/v1/projects/{project}/members` | `project.read` | 読み取り |
| `set_member` | `PUT /api/v1/projects/{project}/members/{user}` | `project.members` | 書き込み |
| `remove_member` | `DELETE /api/v1/projects/{project}/members/{user}` | `project.members` | 書き込み |
| `list_service_accounts` | `GET /api/v1/projects/{project}/service-accounts` | `project.members` | 読み取り |
| `list_workflows` | `GET /api/v1/workflows` | `workflow.read` | 読み取り |
| `get_workflow` | `GET /api/v1/workflows/{workflow}` | `workflow.read` | 読み取り |
| `create_workflow` | `POST /api/v1/workflows` | `workflow.create` | 書き込み |
| `save_workflow` | `PUT /api/v1/workflows/{workflow}` | `workflow.update` | 書き込み |
| `delete_workflow` | `DELETE /api/v1/workflows/{workflow}` | `workflow.delete` | 書き込み |
| `listen_workflow` | `POST /api/v1/workflows/{workflow}/listen` | `workflow.execute` | 書き込み |
| `activate_workflow` | `POST /api/v1/workflows/{workflow}/activate` | `workflow.activate` | 書き込み |
| `deactivate_workflow` | `POST /api/v1/workflows/{workflow}/deactivate` | `workflow.activate` | 書き込み |
| `run_workflow` | `POST /api/v1/workflows/{workflow}/run` | `workflow.execute` | 書き込み |
| `move_workflow` | `PUT /api/v1/workflows/{workflow}/folder` | `workflow.update` | 書き込み |
| `list_workflow_versions` | `GET /api/v1/workflows/{workflow}/versions` | `workflow.read` | 読み取り |
| `get_workflow_version` | `GET /api/v1/workflows/{workflow}/versions/{version}` | `workflow.read` | 読み取り |
| `diff_workflow_versions` | `GET /api/v1/workflows/{workflow}/diff` | `workflow.read` | 読み取り |
| `restore_workflow_version` | `POST /api/v1/workflows/{workflow}/versions/{version}/restore` | `workflow.update` | 書き込み |
| `label_workflow_version` | `PUT /api/v1/workflows/{workflow}/versions/{version}/label` | `workflow.update` | 書き込み |
| `preview_expression` | `POST /api/v1/workflows/{workflow}/preview` | `workflow.read` | 読み取り |
| `list_expression_functions` | `GET /api/v1/expression/functions` | サインイン済みのすべてのキー | 読み取り |
| `list_step_types` | `GET /api/v1/step-types` | サインイン済みのすべてのキー | 読み取り |
| `shape_step` | `POST /api/v1/step-types/{type}/{version}/shape` | サインイン済みのすべてのキー | 読み取り |
| `list_folders` | `GET /api/v1/folders` | `folder.read` | 読み取り |
| `create_folder` | `POST /api/v1/folders` | `folder.create` | 書き込み |
| `update_folder` | `PATCH /api/v1/folders/{folder}` | `folder.update` | 書き込み |
| `delete_folder` | `DELETE /api/v1/folders/{folder}` | `folder.delete` | 書き込み |
| `list_variables` | `GET /api/v1/variables` | `variable.read` | 読み取り |
| `create_variable` | `POST /api/v1/variables` | `variable.create` | 書き込み |
| `update_variable` | `PUT /api/v1/variables/{variable}` | `variable.update` | 書き込み |
| `delete_variable` | `DELETE /api/v1/variables/{variable}` | `variable.delete` | 書き込み |
| `list_executions` | `GET /api/v1/executions` | `execution.read` | 読み取り |
| `get_execution` | `GET /api/v1/executions/{execution}` | `execution.read` | 読み取り |
| `get_step_output` | `GET /api/v1/executions/{execution}/steps/{step}/output` | `execution.read` | 読み取り |
| `get_insights` | `GET /api/v1/insights` | `execution.read` | 読み取り |
| `list_approvals` | `GET /api/v1/approvals` | `execution.read` | read |
| `get_git` | `GET /api/v1/projects/{project}/git` | `workflow.read` | read |
| `connect_git` | `PUT /api/v1/projects/{project}/git` | `project.update` | write |
| `disconnect_git` | `DELETE /api/v1/projects/{project}/git` | `project.update` | write |
| `git_status` | `GET /api/v1/projects/{project}/git/status` | `workflow.read` | read |
| `git_push` | `POST /api/v1/projects/{project}/git/push` | `workflow.update` | write |
| `git_pull` | `POST /api/v1/projects/{project}/git/pull` | `workflow.create` | write |
| `stop_execution` | `POST /api/v1/executions/{execution}/stop` | `execution.stop` | 書き込み |
| `retry_execution` | `POST /api/v1/executions/{execution}/retry` | `execution.retry` | 書き込み |
| `replay_execution` | `POST /api/v1/executions/{execution}/replay` | `execution.retry` | 書き込み |
| `delete_execution` | `DELETE /api/v1/executions/{execution}` | `execution.delete` | 書き込み |
| `annotate_execution` | `PUT /api/v1/executions/{execution}/annotation` | `execution.annotate` | 書き込み |
| `clear_annotation` | `DELETE /api/v1/executions/{execution}/annotation` | `execution.annotate` | 書き込み |
| `list_credential_types` | `GET /api/v1/credential-types` | サインイン済みのすべてのキー | 読み取り |
| `list_credentials` | `GET /api/v1/credentials` | `credential.list` | 読み取り |
| `get_credential` | `GET /api/v1/credentials/{credential}` | `credential.read` | 読み取り |
| `start_oauth` | `POST /api/v1/credentials/{credential}/oauth/start` | `credential.update` | 書き込み |
| `create_credential` | `POST /api/v1/credentials` | `credential.create` | 書き込み |
| `update_credential` | `PATCH /api/v1/credentials/{credential}` | `credential.update` | 書き込み |
| `delete_credential` | `DELETE /api/v1/credentials/{credential}` | `credential.delete` | 書き込み |
| `share_credential` | `PUT /api/v1/credentials/{credential}/shares/{project}` | `credential.share` | 書き込み |
| `unshare_credential` | `DELETE /api/v1/credentials/{credential}/shares/{project}` | `credential.share` | 書き込み |
| `create_role` | `POST /api/v1/roles` | `role.manage` | 書き込み |
| `update_role` | `PUT /api/v1/roles/{role}` | `role.manage` | 書き込み |
| `delete_role` | `DELETE /api/v1/roles/{role}` | `role.manage` | 書き込み |
| `list_redaction_policies` | `GET /api/v1/redaction-policies` | サインイン済みのすべてのキー | 読み取り |
| `create_redaction_policy` | `POST /api/v1/redaction-policies` | `redaction.manage` | 書き込み |
| `update_redaction_policy` | `PUT /api/v1/redaction-policies/{policy}` | `redaction.manage` | 書き込み |
| `delete_redaction_policy` | `DELETE /api/v1/redaction-policies/{policy}` | `redaction.manage` | 書き込み |
| `list_secret_providers` | `GET /api/v1/secret-providers` | サインイン済みのすべてのキー | 読み取り |
| `test_secret_provider` | `POST /api/v1/secret-providers/{provider}/test` | `secrets.manage` | 書き込み |
| `list_log_destinations` | `GET /api/v1/log-destinations` | `logstream.manage` | 読み取り |
| `test_log_destination` | `POST /api/v1/log-destinations/{destination}/test` | `logstream.manage` | 書き込み |
| `list_keys` | `GET /api/v1/api-keys` | サインイン済みのすべてのキー | 読み取り |
| `revoke_key` | `DELETE /api/v1/api-keys/{key}` | サインイン済みのすべてのキー | 書き込み |
| `list_scim_tokens` | `GET /api/v1/scim-tokens` | `scim.manage` | 読み取り |
| `revoke_scim_token` | `DELETE /api/v1/scim-tokens/{token}` | `scim.manage` | 書き込み |
| `list_users` | `GET /api/v1/users` | `user.manage` | 読み取り |
| `create_user` | `POST /api/v1/users` | `user.manage` | 書き込み |
| `change_user` | `PATCH /api/v1/users/{user}` | `user.manage` | 書き込み |
| `delete_user` | `DELETE /api/v1/users/{user}` | `user.manage` | 書き込み、オーナーのみ |
| `list_audit` | `GET /api/v1/audit` | `audit.read` | 読み取り |
| `verify_audit` | `GET /api/v1/audit/verify` | `audit.read` | 読み取り |
| `get_settings` | `GET /api/v1/settings` | `instance.settings` | 読み取り |
| `change_settings` | `PATCH /api/v1/settings` | `instance.settings` | 書き込み |
| `describe_tool_body` | ルートではありません。ツールの本文が受け取るJSONスキーマ | サインイン済みのすべてのキー | 読み取り |

## あえて外したもの

10のルートは、サインインした人を必要とするため、キーを自分で断ります。MCPサーバーもそうでないふりはしません。APIキーの作成、サービスアカウントキーの作成、SCIMトークンの作成、外部シークレットプロバイダーの追加・変更・削除、ログの宛先の追加・変更・削除、そして本人のパスワードです。キーを発行したり、監査ログの送り先を変えたりできるキーは、自分自身を生き延びさせられる、漏えいしたキーです。これらの1つ1つは「許可されていません」としか答えないツールになるため、どれも提供しません。それ以外はすべてツールです。ログの宛先、シークレットプロバイダー、SCIMトークンの一覧、SCIMトークンの失効、プロバイダーや宛先のテスト、キーの一覧と失効、ワークフローのテスト用Webhookを開くこと、そして人があとで開くアドレスを返すOAuth2サインインの開始です。キーは自分自身を失効させられます。漏えいしたキーを持つ人が最初にできるべきことだからです。

`/api/v1/openapi.json`はツールではありません。`describe_tool_body`が本文を返します。
