---
title: "MCP 서버"
description: "Cascade에는 읽고 쓰는 MCP 서버가 있습니다. 83개 도구는 각각 자체 핸들러를 거치는 API 경로이며 권한, 사유, 감사 행이 함께합니다."
---

Cascade에는 MCP 서버가 있으며, 읽기와 쓰기를 모두 합니다. 기본으로 켜져 있고 API, 편집기와 같은 주소의 `/mcp`에 있으며, 여기에 연결한 에이전트는 키를 가진 사람이 할 수 있는 일을 할 수 있고 그 이상은 할 수 없습니다. 돌아가야 할 읽기 전용 모드는 없습니다. 에이전트가 볼 수만 있고 손댈 수 없는 서버는 상태 페이지이고, 상태 페이지는 이미 있기 때문입니다.

도구는 83개이고, 모두 REST API의 경로입니다. 호출은 경로 옆으로 가지 않고 경로를 통과합니다. 경로 자체의 핸들러가 권한을 확인하고, 본문을 검증하고, 변경을 수행하고, 감사 행을 기록합니다. 어긋날 만한 것을 MCP 서버에 복사해 두지 않았고, 건너뛸 만한 것을 빼놓지도 않았습니다.

이것이 의미하는 바는 다음과 같습니다. 편집기에서 바꿀 수 있는 워크플로, 자격 증명, 프로젝트, 사용자는 당신의 키를 가진 에이전트도 당신 역할의 한도 안에서 바꿀 수 있으며, 감사 로그에는 에이전트가 했다는 사실과 어느 에이전트인지가 남습니다.

## 연결

키를 만드세요. 편집기에서는 계정 아래에 있으며, API로도 만들 수 있습니다.

```sh
curl -s -X POST https://cascade.plant.example/api/v1/api-keys \
  -H "X-CSRF-Token: $CSRF" -b cookies.txt -H 'Content-Type: application/json' \
  -d '{"name":"line 4 agent","scopes":["*"],"days":30}'
```

토큰은 한 번만 반환되며 `hlc_`로 시작합니다. 키는 소유자가 할 수 있는 일을 하되 스코프만큼으로 줄어듭니다. 에이전트에 `["workflow.read","execution.read"]`를 주면 볼 수만 있고 손댈 수는 없습니다. 서비스 계정 키(프로젝트 하나, 역할 하나, 프로젝트 관리자가 만듦)도 똑같이 동작하며, 상시 연동에 알맞은 키입니다.

그런 다음 클라이언트가 `/mcp`를 가리키게 하고 키를 bearer 토큰으로 보냅니다. 사용하는 전송 방식은 스트리밍 가능한 HTTP입니다.

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

키가 없거나, 틀리거나, 폐기되었거나 만료되었거나, 소유자가 비활성화된 요청은 도구에 닿기 전에 401을 받으며, 세션 도중에 폐기된 키는 다음 호출부터 동작하지 않습니다.

## 규칙

**권한은 경로의 것입니다.** `whoami`는 키가 볼 수 있는 프로젝트와 각각에서의 역할을 알려 줍니다. 키가 쓸 수 없는 도구는 경로 자체의 사유로 거부됩니다. 없는 권한은 403, 볼 수 없는 것은 404이며, REST API가 주는 답과 같습니다. 이것은 결정이지 돌아가야 할 결함이 아닙니다.

**쓰기에는 사유가 필요합니다.** 무언가를 바꾸는 모든 도구는 `reason`을 받으며, 없으면 거부합니다. 사유는 키와 클라이언트가 스스로 붙인 이름과 함께 감사 로그에 기록됩니다.

**시크릿은 제자리에 있습니다.** 어떤 도구도, 어떤 키에도 자격 증명의 시크릿 필드를 반환하지 않으며, MCP로 만든 자격 증명은 시크릿이 도착하는 즉시 보관함에 봉인됩니다. `get_credential`은 편집 양식과 같은 시크릿 없는 보기입니다.

**스위치는 배포 쪽의 것입니다.** 서버가 시작되는 환경의 설정 두 가지이며, API 호출이나 에이전트로는 바꿀 수 없습니다.

| 설정 | 기본값 | 하는 일 |
|---|---|---|
| `HOTLOOP_CASCADE_MCP` | `true` | `false`이면 `/mcp`가 없습니다. |
| `HOTLOOP_CASCADE_MCP_WRITES` | `true` | `false`이면 무언가를 바꾸는 모든 도구가 거부하고, 읽는 도구는 계속 동작합니다. |

`PATCH /settings`는 둘 다 알지 못하므로, 설정을 편집할 수 있는 에이전트도 쓰기를 다시 켤 수 없습니다.

**설비에는 절대 쓰지 않습니다.** `run_workflow`는 실제 실행을 시작하며, 그 단계들이 호출하는 시스템에 무엇을 하는지는 단계에 달려 있습니다. 밸브를 움직이거나 설정값을 바꾸는 모든 동작은 HotLoop의 쓰기 게이트를 거치므로, 누가 워크플로를 시작했든 그 게이트의 감사가 볼 수 있습니다.

## 감사 로그에 남는 것

쓰기 하나에 행이 둘입니다. 경로 자체의 행은 에이전트를 행위자로 하며, 유형 `mcp`, 키, 키의 소유자, 클라이언트가 들어 있습니다.

```
actor:  mcp, "line 4 agent (ops@plant.example) via claude-desktop"
action: workflow.created
```

그리고 도구의 행이 하나 있으며, 사유가 들어 있습니다. 경로가 허용했든 거부했든 기록됩니다.

```
action: mcp.write   target: create_workflow
detail: {"reason": "the line 4 oven needs a setpoint workflow", "method": "POST", "path": "/api/v1/workflows", "status": 201}
```

`action=mcp.write`로 `list_audit`를 호출하면 에이전트가 한 모든 변경과 그 이유를 볼 수 있습니다.

## 도구

모든 행은 실제 경로와 그 경로가 요구하는 권한이며, 테스트가 표를 둘 다에 맞춰 유지합니다. 권한은 프로젝트 권한(그 항목이 속한 프로젝트에서 확인)이거나 인스턴스 권한(소유자와 관리자)입니다. 로그인한 모든 키는 그렇게 표시된 것을 요청할 수 있습니다.

본문이 있는 도구는 `body`를 받으며, REST API가 받는 것과 같은 JSON입니다. `describe_tool_body`가 모든 도구의 스키마를 알려 주므로 첫 호출부터 올바르게 할 수 있습니다.

| 도구 | 경로 | 권한 | 종류 |
|---|---|---|---|
| `get_version` | `GET /api/v1/version` | 로그인한 모든 키 | 읽기 |
| `whoami` | `GET /api/v1/me` | 로그인한 모든 키 | 읽기 |
| `list_permissions` | `GET /api/v1/permissions` | 로그인한 모든 키 | 읽기 |
| `list_roles` | `GET /api/v1/roles` | 로그인한 모든 키 | 읽기 |
| `get_role` | `GET /api/v1/roles/{role}` | 로그인한 모든 키 | 읽기 |
| `list_projects` | `GET /api/v1/projects` | `project.read` | 읽기 |
| `get_project` | `GET /api/v1/projects/{project}` | `project.read` | 읽기 |
| `create_project` | `POST /api/v1/projects` | `project.create` | 쓰기 |
| `rename_project` | `PATCH /api/v1/projects/{project}` | `project.update` | 쓰기 |
| `delete_project` | `DELETE /api/v1/projects/{project}` | `project.delete` | 쓰기 |
| `list_members` | `GET /api/v1/projects/{project}/members` | `project.read` | 읽기 |
| `set_member` | `PUT /api/v1/projects/{project}/members/{user}` | `project.members` | 쓰기 |
| `remove_member` | `DELETE /api/v1/projects/{project}/members/{user}` | `project.members` | 쓰기 |
| `list_service_accounts` | `GET /api/v1/projects/{project}/service-accounts` | `project.members` | 읽기 |
| `list_workflows` | `GET /api/v1/workflows` | `workflow.read` | 읽기 |
| `get_workflow` | `GET /api/v1/workflows/{workflow}` | `workflow.read` | 읽기 |
| `create_workflow` | `POST /api/v1/workflows` | `workflow.create` | 쓰기 |
| `save_workflow` | `PUT /api/v1/workflows/{workflow}` | `workflow.update` | 쓰기 |
| `delete_workflow` | `DELETE /api/v1/workflows/{workflow}` | `workflow.delete` | 쓰기 |
| `listen_workflow` | `POST /api/v1/workflows/{workflow}/listen` | `workflow.execute` | 쓰기 |
| `activate_workflow` | `POST /api/v1/workflows/{workflow}/activate` | `workflow.activate` | 쓰기 |
| `deactivate_workflow` | `POST /api/v1/workflows/{workflow}/deactivate` | `workflow.activate` | 쓰기 |
| `run_workflow` | `POST /api/v1/workflows/{workflow}/run` | `workflow.execute` | 쓰기 |
| `move_workflow` | `PUT /api/v1/workflows/{workflow}/folder` | `workflow.update` | 쓰기 |
| `list_workflow_versions` | `GET /api/v1/workflows/{workflow}/versions` | `workflow.read` | 읽기 |
| `get_workflow_version` | `GET /api/v1/workflows/{workflow}/versions/{version}` | `workflow.read` | 읽기 |
| `diff_workflow_versions` | `GET /api/v1/workflows/{workflow}/diff` | `workflow.read` | 읽기 |
| `restore_workflow_version` | `POST /api/v1/workflows/{workflow}/versions/{version}/restore` | `workflow.update` | 쓰기 |
| `label_workflow_version` | `PUT /api/v1/workflows/{workflow}/versions/{version}/label` | `workflow.update` | 쓰기 |
| `preview_expression` | `POST /api/v1/workflows/{workflow}/preview` | `workflow.read` | 읽기 |
| `list_expression_functions` | `GET /api/v1/expression/functions` | 로그인한 모든 키 | 읽기 |
| `list_step_types` | `GET /api/v1/step-types` | 로그인한 모든 키 | 읽기 |
| `shape_step` | `POST /api/v1/step-types/{type}/{version}/shape` | 로그인한 모든 키 | 읽기 |
| `list_folders` | `GET /api/v1/folders` | `folder.read` | 읽기 |
| `create_folder` | `POST /api/v1/folders` | `folder.create` | 쓰기 |
| `update_folder` | `PATCH /api/v1/folders/{folder}` | `folder.update` | 쓰기 |
| `delete_folder` | `DELETE /api/v1/folders/{folder}` | `folder.delete` | 쓰기 |
| `list_variables` | `GET /api/v1/variables` | `variable.read` | 읽기 |
| `create_variable` | `POST /api/v1/variables` | `variable.create` | 쓰기 |
| `update_variable` | `PUT /api/v1/variables/{variable}` | `variable.update` | 쓰기 |
| `delete_variable` | `DELETE /api/v1/variables/{variable}` | `variable.delete` | 쓰기 |
| `list_executions` | `GET /api/v1/executions` | `execution.read` | 읽기 |
| `get_execution` | `GET /api/v1/executions/{execution}` | `execution.read` | 읽기 |
| `get_step_output` | `GET /api/v1/executions/{execution}/steps/{step}/output` | `execution.read` | 읽기 |
| `get_insights` | `GET /api/v1/insights` | `execution.read` | 읽기 |
| `stop_execution` | `POST /api/v1/executions/{execution}/stop` | `execution.stop` | 쓰기 |
| `retry_execution` | `POST /api/v1/executions/{execution}/retry` | `execution.retry` | 쓰기 |
| `replay_execution` | `POST /api/v1/executions/{execution}/replay` | `execution.retry` | 쓰기 |
| `delete_execution` | `DELETE /api/v1/executions/{execution}` | `execution.delete` | 쓰기 |
| `annotate_execution` | `PUT /api/v1/executions/{execution}/annotation` | `execution.annotate` | 쓰기 |
| `clear_annotation` | `DELETE /api/v1/executions/{execution}/annotation` | `execution.annotate` | 쓰기 |
| `list_credential_types` | `GET /api/v1/credential-types` | 로그인한 모든 키 | 읽기 |
| `list_credentials` | `GET /api/v1/credentials` | `credential.list` | 읽기 |
| `get_credential` | `GET /api/v1/credentials/{credential}` | `credential.read` | 읽기 |
| `start_oauth` | `POST /api/v1/credentials/{credential}/oauth/start` | `credential.update` | 쓰기 |
| `create_credential` | `POST /api/v1/credentials` | `credential.create` | 쓰기 |
| `update_credential` | `PATCH /api/v1/credentials/{credential}` | `credential.update` | 쓰기 |
| `delete_credential` | `DELETE /api/v1/credentials/{credential}` | `credential.delete` | 쓰기 |
| `share_credential` | `PUT /api/v1/credentials/{credential}/shares/{project}` | `credential.share` | 쓰기 |
| `unshare_credential` | `DELETE /api/v1/credentials/{credential}/shares/{project}` | `credential.share` | 쓰기 |
| `create_role` | `POST /api/v1/roles` | `role.manage` | 쓰기 |
| `update_role` | `PUT /api/v1/roles/{role}` | `role.manage` | 쓰기 |
| `delete_role` | `DELETE /api/v1/roles/{role}` | `role.manage` | 쓰기 |
| `list_redaction_policies` | `GET /api/v1/redaction-policies` | 로그인한 모든 키 | 읽기 |
| `create_redaction_policy` | `POST /api/v1/redaction-policies` | `redaction.manage` | 쓰기 |
| `update_redaction_policy` | `PUT /api/v1/redaction-policies/{policy}` | `redaction.manage` | 쓰기 |
| `delete_redaction_policy` | `DELETE /api/v1/redaction-policies/{policy}` | `redaction.manage` | 쓰기 |
| `list_secret_providers` | `GET /api/v1/secret-providers` | 로그인한 모든 키 | 읽기 |
| `test_secret_provider` | `POST /api/v1/secret-providers/{provider}/test` | `secrets.manage` | 쓰기 |
| `list_log_destinations` | `GET /api/v1/log-destinations` | `logstream.manage` | 읽기 |
| `test_log_destination` | `POST /api/v1/log-destinations/{destination}/test` | `logstream.manage` | 쓰기 |
| `list_keys` | `GET /api/v1/api-keys` | 로그인한 모든 키 | 읽기 |
| `revoke_key` | `DELETE /api/v1/api-keys/{key}` | 로그인한 모든 키 | 쓰기 |
| `list_scim_tokens` | `GET /api/v1/scim-tokens` | `scim.manage` | 읽기 |
| `revoke_scim_token` | `DELETE /api/v1/scim-tokens/{token}` | `scim.manage` | 쓰기 |
| `list_users` | `GET /api/v1/users` | `user.manage` | 읽기 |
| `create_user` | `POST /api/v1/users` | `user.manage` | 쓰기 |
| `change_user` | `PATCH /api/v1/users/{user}` | `user.manage` | 쓰기 |
| `list_audit` | `GET /api/v1/audit` | `audit.read` | 읽기 |
| `verify_audit` | `GET /api/v1/audit/verify` | `audit.read` | 읽기 |
| `get_settings` | `GET /api/v1/settings` | `instance.settings` | 읽기 |
| `change_settings` | `PATCH /api/v1/settings` | `instance.settings` | 쓰기 |
| `describe_tool_body` | 경로가 아님: 도구의 본문이 받는 JSON 스키마 | 로그인한 모든 키 | 읽기 |

## 일부러 뺀 것

열 개의 경로는 로그인한 사람을 요구하므로 스스로 키를 거부하며, MCP 서버도 그렇지 않은 척하지 않습니다. API 키 만들기, 서비스 계정 키 만들기, SCIM 토큰 만들기, 외부 시크릿 공급자의 추가·변경·삭제, 로그 대상의 추가·변경·삭제, 그리고 본인의 비밀번호입니다. 키를 찍어 내거나 감사 로그가 전송되는 곳을 바꿀 수 있는 키는, 스스로를 살려 둘 수 있는 유출된 키입니다. 이들 각각은 "허용되지 않음"으로만 답하는 도구가 될 것이므로 어느 것도 제공하지 않습니다. 그 밖의 모든 것은 도구입니다. 로그 대상, 시크릿 공급자, SCIM 토큰 목록, SCIM 토큰 폐기, 공급자나 대상 시험, 키 목록과 폐기, 워크플로의 테스트 웹훅 열기, 그리고 사람이 이어서 열 주소를 돌려주는 OAuth2 로그인 시작이 있습니다. 키는 스스로를 폐기할 수 있으며, 유출된 키의 소유자가 가장 먼저 할 수 있어야 하는 일입니다.

`/api/v1/openapi.json`은 도구가 아닙니다. `describe_tool_body`가 본문을 알려 줍니다.
