---
title: "MCP сървърът"
description: "Cascade има MCP сървър, който чете и записва: 91 инструмента, всеки маршрут на API със собствен обработчик, свое право, причина и ред в одита."
---

Cascade има MCP сървър и той чете и записва. Доставя се включен, на `/mcp`, на същия адрес като API и редактора, и агент, който се свърже с него, може да прави каквото може човекът зад неговия ключ и нищо повече. Няма режим само за четене, който да заобикаляте, защото сървър, който агентът може да гледа, но не и да докосва, е страница за състояние, а такава вече имате.

91 инструмента, и всеки от тях е маршрут на REST API. Повикването не минава встрани от маршрута, а през него: собственият обработчик на маршрута проверява разрешението, валидира тялото, прави промяната и записва реда в одита. Нищо не е копирано в MCP сървъра, което да се разминава, и нищо не е изпуснато от него, за да се заобиколи нещо.

Какво означава това за вас: ако работен процес, данни за вход, проект или човек е нещо, което можете да промените от редактора, агент с вашия ключ също може да го промени, в границите на вашата роля, а журналът за одит казва, че е бил агент, и кой.

## Свързване

Направете ключ. В редактора е под вашия акаунт, или чрез API:

```sh
curl -s -X POST https://cascade.plant.example/api/v1/api-keys \
  -H "X-CSRF-Token: $CSRF" -b cookies.txt -H 'Content-Type: application/json' \
  -d '{"name":"line 4 agent","scopes":["*"],"days":30}'
```

Токенът се връща веднъж и започва с `hlc_`. Ключът прави каквото би могъл притежателят му, ограничено до неговите обхвати: дайте на агент `["workflow.read","execution.read"]` и той може да гледа, но не и да докосва. Ключ на служебен акаунт (един проект, една роля, създаден от администратор на проекта) работи по същия начин и е правилният ключ за постоянна интеграция.

След това насочете клиента към `/mcp` и изпратете ключа като bearer токен. Транспортът, който говори, е streamable HTTP:

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

Заявка без ключ, с грешен, отнет или изтекъл ключ, или с ключ на изключен човек получава 401, преди да стигне до инструмент, а ключ, отнет по средата на сесия, спира да работи при следващото си повикване.

## Правилата

**Правата са на маршрута.** `whoami` казва кои проекти може да вижда ключът и каква е ролята му във всеки. Инструмент, който ключът няма право да ползва, се отказва със собствената причина на маршрута: 403 за право, което му липсва, 404 за нещо, което не може да види, тоест същият отговор като на REST API. Това е решение, а не повреда, която да се заобикаля.

**Записът изисква причина.** Всеки инструмент, който променя нещо, приема `reason` и отказва без него. Записва се в журнала за одит с вашия ключ и името, което клиентът ви си е дал.

**Тайните остават на мястото си.** Никой инструмент не връща тайното поле на данни за вход, на никой ключ, а данни за вход, създадени през MCP, имат тайните си запечатани в трезора още при пристигането им. `get_credential` е същият изглед без тайни, който има формата за редакция.

**Превключвателите са на внедряването.** Две настройки, в средата, в която стартира сървърът, които не може да промени нито API повикване, нито агент:

| Настройка | По подразбиране | Какво прави |
|---|---|---|
| `HOTLOOP_CASCADE_MCP` | `true` | При `false` `/mcp` го няма. |
| `HOTLOOP_CASCADE_MCP_WRITES` | `true` | При `false` всеки инструмент, който променя нещо, отказва, а тези, които четат, продължават да работят. |

`PATCH /settings` не познава нито една от двете, така че агент, който може да редактира настройките, пак не може да включи отново записа.

**Никога не записва в оборудването.** `run_workflow` стартира реално изпълнение, а какво правят стъпките му със системите, които викат, зависи от стъпките. Всичко, което движи вентил или променя зададена стойност, минава през портата за запис на HotLoop, така че одитът на тази порта го вижда, който и да е стартирал работния процес.

## Какво казва журналът за одит

Два реда за един запис. Собственият ред на маршрута има агента като действащо лице, с тип `mcp`, ключа, чий е той и клиента:

```
actor:  mcp, "line 4 agent (ops@plant.example) via claude-desktop"
action: workflow.created
```

И един ред на инструмента, с причината, записан независимо дали маршрутът е казал да или е отказал:

```
action: mcp.write   target: create_workflow
detail: {"reason": "the line 4 oven needs a setpoint workflow", "method": "POST", "path": "/api/v1/workflows", "status": 201}
```

`list_audit` с `action=mcp.write` е всяка промяна, направена от агент, и защо.

## Инструментите

Всеки ред е реален маршрут и правото, което този маршрут изисква, а тест държи таблицата вярна и към двете. Правото е на проект (проверява се в проекта, в който е обектът) или на инстанция (собственици и администратори). Всеки ключ с вписан потребител може да поиска отбелязаните така.

Инструментите с тяло приемат `body`, същия JSON, който приема REST API. `describe_tool_body` дава схемата на всеки инструмент, така че първото повикване да е вярно.

| Инструмент | Маршрут | Право | Вид |
|---|---|---|---|
| `get_version` | `GET /api/v1/version` | всеки ключ с вписан потребител | четене |
| `whoami` | `GET /api/v1/me` | всеки ключ с вписан потребител | четене |
| `list_permissions` | `GET /api/v1/permissions` | всеки ключ с вписан потребител | четене |
| `list_roles` | `GET /api/v1/roles` | всеки ключ с вписан потребител | четене |
| `get_role` | `GET /api/v1/roles/{role}` | всеки ключ с вписан потребител | четене |
| `list_projects` | `GET /api/v1/projects` | `project.read` | четене |
| `get_project` | `GET /api/v1/projects/{project}` | `project.read` | четене |
| `create_project` | `POST /api/v1/projects` | `project.create` | запис |
| `rename_project` | `PATCH /api/v1/projects/{project}` | `project.update` | запис |
| `delete_project` | `DELETE /api/v1/projects/{project}` | `project.delete` | запис |
| `list_members` | `GET /api/v1/projects/{project}/members` | `project.read` | четене |
| `set_member` | `PUT /api/v1/projects/{project}/members/{user}` | `project.members` | запис |
| `remove_member` | `DELETE /api/v1/projects/{project}/members/{user}` | `project.members` | запис |
| `list_service_accounts` | `GET /api/v1/projects/{project}/service-accounts` | `project.members` | четене |
| `list_workflows` | `GET /api/v1/workflows` | `workflow.read` | четене |
| `get_workflow` | `GET /api/v1/workflows/{workflow}` | `workflow.read` | четене |
| `create_workflow` | `POST /api/v1/workflows` | `workflow.create` | запис |
| `save_workflow` | `PUT /api/v1/workflows/{workflow}` | `workflow.update` | запис |
| `delete_workflow` | `DELETE /api/v1/workflows/{workflow}` | `workflow.delete` | запис |
| `listen_workflow` | `POST /api/v1/workflows/{workflow}/listen` | `workflow.execute` | запис |
| `activate_workflow` | `POST /api/v1/workflows/{workflow}/activate` | `workflow.activate` | запис |
| `deactivate_workflow` | `POST /api/v1/workflows/{workflow}/deactivate` | `workflow.activate` | запис |
| `run_workflow` | `POST /api/v1/workflows/{workflow}/run` | `workflow.execute` | запис |
| `move_workflow` | `PUT /api/v1/workflows/{workflow}/folder` | `workflow.update` | запис |
| `list_workflow_versions` | `GET /api/v1/workflows/{workflow}/versions` | `workflow.read` | четене |
| `get_workflow_version` | `GET /api/v1/workflows/{workflow}/versions/{version}` | `workflow.read` | четене |
| `diff_workflow_versions` | `GET /api/v1/workflows/{workflow}/diff` | `workflow.read` | четене |
| `restore_workflow_version` | `POST /api/v1/workflows/{workflow}/versions/{version}/restore` | `workflow.update` | запис |
| `label_workflow_version` | `PUT /api/v1/workflows/{workflow}/versions/{version}/label` | `workflow.update` | запис |
| `preview_expression` | `POST /api/v1/workflows/{workflow}/preview` | `workflow.read` | четене |
| `list_expression_functions` | `GET /api/v1/expression/functions` | всеки ключ с вписан потребител | четене |
| `list_step_types` | `GET /api/v1/step-types` | всеки ключ с вписан потребител | четене |
| `shape_step` | `POST /api/v1/step-types/{type}/{version}/shape` | всеки ключ с вписан потребител | четене |
| `list_folders` | `GET /api/v1/folders` | `folder.read` | четене |
| `create_folder` | `POST /api/v1/folders` | `folder.create` | запис |
| `update_folder` | `PATCH /api/v1/folders/{folder}` | `folder.update` | запис |
| `delete_folder` | `DELETE /api/v1/folders/{folder}` | `folder.delete` | запис |
| `list_variables` | `GET /api/v1/variables` | `variable.read` | четене |
| `create_variable` | `POST /api/v1/variables` | `variable.create` | запис |
| `update_variable` | `PUT /api/v1/variables/{variable}` | `variable.update` | запис |
| `delete_variable` | `DELETE /api/v1/variables/{variable}` | `variable.delete` | запис |
| `list_executions` | `GET /api/v1/executions` | `execution.read` | четене |
| `get_execution` | `GET /api/v1/executions/{execution}` | `execution.read` | четене |
| `get_step_output` | `GET /api/v1/executions/{execution}/steps/{step}/output` | `execution.read` | четене |
| `get_insights` | `GET /api/v1/insights` | `execution.read` | четене |
| `list_approvals` | `GET /api/v1/approvals` | `execution.read` | read |
| `get_git` | `GET /api/v1/projects/{project}/git` | `workflow.read` | read |
| `connect_git` | `PUT /api/v1/projects/{project}/git` | `project.update` | write |
| `disconnect_git` | `DELETE /api/v1/projects/{project}/git` | `project.update` | write |
| `git_status` | `GET /api/v1/projects/{project}/git/status` | `workflow.read` | read |
| `git_push` | `POST /api/v1/projects/{project}/git/push` | `workflow.update` | write |
| `git_pull` | `POST /api/v1/projects/{project}/git/pull` | `workflow.create` | write |
| `stop_execution` | `POST /api/v1/executions/{execution}/stop` | `execution.stop` | запис |
| `retry_execution` | `POST /api/v1/executions/{execution}/retry` | `execution.retry` | запис |
| `replay_execution` | `POST /api/v1/executions/{execution}/replay` | `execution.retry` | запис |
| `delete_execution` | `DELETE /api/v1/executions/{execution}` | `execution.delete` | запис |
| `annotate_execution` | `PUT /api/v1/executions/{execution}/annotation` | `execution.annotate` | запис |
| `clear_annotation` | `DELETE /api/v1/executions/{execution}/annotation` | `execution.annotate` | запис |
| `list_credential_types` | `GET /api/v1/credential-types` | всеки ключ с вписан потребител | четене |
| `list_credentials` | `GET /api/v1/credentials` | `credential.list` | четене |
| `get_credential` | `GET /api/v1/credentials/{credential}` | `credential.read` | четене |
| `start_oauth` | `POST /api/v1/credentials/{credential}/oauth/start` | `credential.update` | запис |
| `create_credential` | `POST /api/v1/credentials` | `credential.create` | запис |
| `update_credential` | `PATCH /api/v1/credentials/{credential}` | `credential.update` | запис |
| `delete_credential` | `DELETE /api/v1/credentials/{credential}` | `credential.delete` | запис |
| `share_credential` | `PUT /api/v1/credentials/{credential}/shares/{project}` | `credential.share` | запис |
| `unshare_credential` | `DELETE /api/v1/credentials/{credential}/shares/{project}` | `credential.share` | запис |
| `create_role` | `POST /api/v1/roles` | `role.manage` | запис |
| `update_role` | `PUT /api/v1/roles/{role}` | `role.manage` | запис |
| `delete_role` | `DELETE /api/v1/roles/{role}` | `role.manage` | запис |
| `list_redaction_policies` | `GET /api/v1/redaction-policies` | всеки ключ с вписан потребител | четене |
| `create_redaction_policy` | `POST /api/v1/redaction-policies` | `redaction.manage` | запис |
| `update_redaction_policy` | `PUT /api/v1/redaction-policies/{policy}` | `redaction.manage` | запис |
| `delete_redaction_policy` | `DELETE /api/v1/redaction-policies/{policy}` | `redaction.manage` | запис |
| `list_secret_providers` | `GET /api/v1/secret-providers` | всеки ключ с вписан потребител | четене |
| `test_secret_provider` | `POST /api/v1/secret-providers/{provider}/test` | `secrets.manage` | запис |
| `list_log_destinations` | `GET /api/v1/log-destinations` | `logstream.manage` | четене |
| `test_log_destination` | `POST /api/v1/log-destinations/{destination}/test` | `logstream.manage` | запис |
| `list_keys` | `GET /api/v1/api-keys` | всеки ключ с вписан потребител | четене |
| `revoke_key` | `DELETE /api/v1/api-keys/{key}` | всеки ключ с вписан потребител | запис |
| `list_scim_tokens` | `GET /api/v1/scim-tokens` | `scim.manage` | четене |
| `revoke_scim_token` | `DELETE /api/v1/scim-tokens/{token}` | `scim.manage` | запис |
| `list_users` | `GET /api/v1/users` | `user.manage` | четене |
| `create_user` | `POST /api/v1/users` | `user.manage` | запис |
| `change_user` | `PATCH /api/v1/users/{user}` | `user.manage` | запис |
| `delete_user` | `DELETE /api/v1/users/{user}` | `user.manage` | запис, само собственик |
| `list_audit` | `GET /api/v1/audit` | `audit.read` | четене |
| `verify_audit` | `GET /api/v1/audit/verify` | `audit.read` | четене |
| `get_settings` | `GET /api/v1/settings` | `instance.settings` | четене |
| `change_settings` | `PATCH /api/v1/settings` | `instance.settings` | запис |
| `describe_tool_body` | не е маршрут: JSON схемата, която приема тялото на инструмента | всеки ключ с вписан потребител | четене |

## Оставено навън нарочно

Десет маршрута сами отказват ключ, защото искат вписан човек, а MCP сървърът не се преструва на друго: създаване на API ключ, създаване на ключ на служебен акаунт, създаване на SCIM токен, добавяне, промяна и изтриване на външен доставчик на тайни, добавяне, промяна и изтриване на дестинация за логове, и собствената парола на човек. Ключ, който може да сече ключове или да променя накъде се изпраща журналът за одит, е изтекъл ключ, който може да поддържа сам себе си жив. Всеки от тях би бил инструмент, който винаги отговаря само „не е позволено“, затова никой не се предлага. Всичко останало е инструмент: списък на дестинациите за логове, доставчиците на тайни и SCIM токените, отнемане на SCIM токен, тест на доставчик или дестинация, списък и отнемане на ключове, отваряне на тестовия webhook на работен процес и започване на вписване с OAuth2, което връща адреса, който човек след това отваря. Ключ може да отнеме сам себе си, което е първото нещо, което притежателят на изтекъл ключ трябва да може да направи.

`/api/v1/openapi.json` не е инструмент: `describe_tool_body` дава телата.
