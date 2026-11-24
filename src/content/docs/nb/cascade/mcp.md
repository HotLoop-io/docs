---
title: "MCP-serveren"
description: "Cascade har en MCP-server som leser og skriver: 91 verktøy, hvert en API-rute med sin egen behandler, sin tillatelse, en begrunnelse og en revisjonsrad."
---

Cascade har en MCP-server, og den leser og skriver. Den leveres på, på `/mcp` på samme adresse som API-et og editoren, og en agent som kobler til den, kan gjøre det personen bak nøkkelen kan gjøre, og ingenting utover det. Det finnes ingen skrivebeskyttet modus å komme seg rundt, for en server en agent kan se på men ikke røre, er en statusside, og den har du allerede.

91 verktøy, og hvert av dem er en rute i REST-API-et. Et kall går ikke ved siden av ruten, det går gjennom den: rutens egen behandler sjekker tillatelsen, validerer innholdet, gjør endringen og skriver revisjonsraden. Ingenting ble kopiert inn i MCP-serveren som kan drive av gårde, og ingenting ble utelatt fra den for å hoppe over noe.

Hva det betyr for deg: hvis en arbeidsflyt, en legitimasjon, et prosjekt eller en person er noe du kan endre fra editoren, kan en agent med nøkkelen din endre det også, innenfor rollens grenser, og revisjonsloggen sier at det var en agent og hvilken.

## Koble til

Lag en nøkkel. I editoren ligger den under kontoen din, eller med API-et:

```sh
curl -s -X POST https://cascade.plant.example/api/v1/api-keys \
  -H "X-CSRF-Token: $CSRF" -b cookies.txt -H 'Content-Type: application/json' \
  -d '{"name":"line 4 agent","scopes":["*"],"days":30}'
```

Tokenet kommer tilbake én gang og starter med `hlc_`. En nøkkel gjør det innehaveren kunne gjøre, beskåret til sine omfang: gi en agent `["workflow.read","execution.read"]`, så kan den se og ikke røre. En tjenestekontonøkkel (ett prosjekt, én rolle, laget av en prosjektadministrator) fungerer likt og er riktig nøkkel for en fast integrasjon.

Pek så klienten mot `/mcp` og send nøkkelen som bearer-token. Transporten den snakker, er streamable HTTP:

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

En forespørsel uten nøkkel, med feil nøkkel, med en tilbakekalt eller utløpt nøkkel, eller der personen er slått av, får en 401 før den når noe verktøy, og en nøkkel som tilbakekalles midt i en økt, slutter å virke ved neste kall.

## Reglene

**Tillatelsene er rutens.** `whoami` sier hvilke prosjekter nøkkelen kan se og rollen den har i hvert. Et verktøy nøkkelen ikke har lov å bruke, avvises med rutens egen begrunnelse: 403 for en tillatelse den mangler, 404 for noe den ikke kan se, som er samme svar REST-API-et gir. Det er en beslutning, ikke en feil å komme seg rundt.

**En skriving trenger en begrunnelse.** Hvert verktøy som endrer noe, tar en `reason` og nekter uten. Den skrives til revisjonsloggen med nøkkelen din og navnet klienten ga seg selv.

**Hemmeligheter blir der de er.** Ingen verktøy returnerer det hemmelige feltet i en legitimasjon, til noen nøkkel, og en legitimasjon laget over MCP får hemmelighetene sine forseglet i hvelvet idet de kommer inn. `get_credential` er den samme visningen uten hemmeligheter som redigeringsskjemaet har.

**Bryterne tilhører utrullingen.** To innstillinger, i miljøet serveren starter i, som ingen API-kall og ingen agent kan endre:

| Innstilling | Standard | Hva den gjør |
|---|---|---|
| `HOTLOOP_CASCADE_MCP` | `true` | Med `false` finnes ikke `/mcp`. |
| `HOTLOOP_CASCADE_MCP_WRITES` | `true` | Med `false` nekter hvert verktøy som endrer noe, og de som leser, virker fortsatt. |

`PATCH /settings` kjenner ingen av dem, så en agent som kan redigere innstillingene, kan likevel ikke slå skriving på igjen.

**Den skriver aldri til utstyr.** `run_workflow` starter en ekte kjøring, og hva trinnene gjør med systemene de kaller, er opp til trinnene. Alt som flytter en ventil eller endrer et settpunkt, går gjennom HotLoops skrivegate, så gatens revisjon ser det uansett hvem som startet arbeidsflyten.

## Hva revisjonsloggen sier

To rader for en skriving. Rutens egen rad har agenten som aktør, med typen `mcp`, nøkkelen, hvem den tilhører og klienten:

```
actor:  mcp, "line 4 agent (ops@plant.example) via claude-desktop"
action: workflow.created
```

Og én rad fra verktøyet, med begrunnelsen, skrevet enten ruten sa ja eller nektet:

```
action: mcp.write   target: create_workflow
detail: {"reason": "the line 4 oven needs a setpoint workflow", "method": "POST", "path": "/api/v1/workflows", "status": 201}
```

`list_audit` med `action=mcp.write` er hver endring en agent har gjort og hvorfor.

## Verktøyene

Hver rad er en ekte rute og tillatelsen ruten ber om, og en test holder tabellen til begge deler. En tillatelse er enten en prosjekttillatelse (den sjekkes i prosjektet tingen ligger i) eller en instanstillatelse (eiere og administratorer). Enhver innlogget nøkkel kan be om de som er merket slik.

Verktøy med innhold tar en `body`, den samme JSON-en REST-API-et tar. `describe_tool_body` gir skjemaet til ethvert verktøy, så det første kallet blir riktig.

| Verktøy | Rute | Tillatelse | Type |
|---|---|---|---|
| `get_version` | `GET /api/v1/version` | enhver innlogget nøkkel | lesing |
| `whoami` | `GET /api/v1/me` | enhver innlogget nøkkel | lesing |
| `list_permissions` | `GET /api/v1/permissions` | enhver innlogget nøkkel | lesing |
| `list_roles` | `GET /api/v1/roles` | enhver innlogget nøkkel | lesing |
| `get_role` | `GET /api/v1/roles/{role}` | enhver innlogget nøkkel | lesing |
| `list_projects` | `GET /api/v1/projects` | `project.read` | lesing |
| `get_project` | `GET /api/v1/projects/{project}` | `project.read` | lesing |
| `create_project` | `POST /api/v1/projects` | `project.create` | skriving |
| `rename_project` | `PATCH /api/v1/projects/{project}` | `project.update` | skriving |
| `delete_project` | `DELETE /api/v1/projects/{project}` | `project.delete` | skriving |
| `list_members` | `GET /api/v1/projects/{project}/members` | `project.read` | lesing |
| `set_member` | `PUT /api/v1/projects/{project}/members/{user}` | `project.members` | skriving |
| `remove_member` | `DELETE /api/v1/projects/{project}/members/{user}` | `project.members` | skriving |
| `list_service_accounts` | `GET /api/v1/projects/{project}/service-accounts` | `project.members` | lesing |
| `list_workflows` | `GET /api/v1/workflows` | `workflow.read` | lesing |
| `get_workflow` | `GET /api/v1/workflows/{workflow}` | `workflow.read` | lesing |
| `create_workflow` | `POST /api/v1/workflows` | `workflow.create` | skriving |
| `save_workflow` | `PUT /api/v1/workflows/{workflow}` | `workflow.update` | skriving |
| `delete_workflow` | `DELETE /api/v1/workflows/{workflow}` | `workflow.delete` | skriving |
| `listen_workflow` | `POST /api/v1/workflows/{workflow}/listen` | `workflow.execute` | skriving |
| `activate_workflow` | `POST /api/v1/workflows/{workflow}/activate` | `workflow.activate` | skriving |
| `deactivate_workflow` | `POST /api/v1/workflows/{workflow}/deactivate` | `workflow.activate` | skriving |
| `run_workflow` | `POST /api/v1/workflows/{workflow}/run` | `workflow.execute` | skriving |
| `move_workflow` | `PUT /api/v1/workflows/{workflow}/folder` | `workflow.update` | skriving |
| `list_workflow_versions` | `GET /api/v1/workflows/{workflow}/versions` | `workflow.read` | lesing |
| `get_workflow_version` | `GET /api/v1/workflows/{workflow}/versions/{version}` | `workflow.read` | lesing |
| `diff_workflow_versions` | `GET /api/v1/workflows/{workflow}/diff` | `workflow.read` | lesing |
| `restore_workflow_version` | `POST /api/v1/workflows/{workflow}/versions/{version}/restore` | `workflow.update` | skriving |
| `label_workflow_version` | `PUT /api/v1/workflows/{workflow}/versions/{version}/label` | `workflow.update` | skriving |
| `preview_expression` | `POST /api/v1/workflows/{workflow}/preview` | `workflow.read` | lesing |
| `list_expression_functions` | `GET /api/v1/expression/functions` | enhver innlogget nøkkel | lesing |
| `list_step_types` | `GET /api/v1/step-types` | enhver innlogget nøkkel | lesing |
| `shape_step` | `POST /api/v1/step-types/{type}/{version}/shape` | enhver innlogget nøkkel | lesing |
| `list_folders` | `GET /api/v1/folders` | `folder.read` | lesing |
| `create_folder` | `POST /api/v1/folders` | `folder.create` | skriving |
| `update_folder` | `PATCH /api/v1/folders/{folder}` | `folder.update` | skriving |
| `delete_folder` | `DELETE /api/v1/folders/{folder}` | `folder.delete` | skriving |
| `list_variables` | `GET /api/v1/variables` | `variable.read` | lesing |
| `create_variable` | `POST /api/v1/variables` | `variable.create` | skriving |
| `update_variable` | `PUT /api/v1/variables/{variable}` | `variable.update` | skriving |
| `delete_variable` | `DELETE /api/v1/variables/{variable}` | `variable.delete` | skriving |
| `list_executions` | `GET /api/v1/executions` | `execution.read` | lesing |
| `get_execution` | `GET /api/v1/executions/{execution}` | `execution.read` | lesing |
| `get_step_output` | `GET /api/v1/executions/{execution}/steps/{step}/output` | `execution.read` | lesing |
| `get_insights` | `GET /api/v1/insights` | `execution.read` | lesing |
| `list_approvals` | `GET /api/v1/approvals` | `execution.read` | read |
| `get_git` | `GET /api/v1/projects/{project}/git` | `workflow.read` | read |
| `connect_git` | `PUT /api/v1/projects/{project}/git` | `project.update` | write |
| `disconnect_git` | `DELETE /api/v1/projects/{project}/git` | `project.update` | write |
| `git_status` | `GET /api/v1/projects/{project}/git/status` | `workflow.read` | read |
| `git_push` | `POST /api/v1/projects/{project}/git/push` | `workflow.update` | write |
| `git_pull` | `POST /api/v1/projects/{project}/git/pull` | `workflow.create` | write |
| `stop_execution` | `POST /api/v1/executions/{execution}/stop` | `execution.stop` | skriving |
| `retry_execution` | `POST /api/v1/executions/{execution}/retry` | `execution.retry` | skriving |
| `replay_execution` | `POST /api/v1/executions/{execution}/replay` | `execution.retry` | skriving |
| `delete_execution` | `DELETE /api/v1/executions/{execution}` | `execution.delete` | skriving |
| `annotate_execution` | `PUT /api/v1/executions/{execution}/annotation` | `execution.annotate` | skriving |
| `clear_annotation` | `DELETE /api/v1/executions/{execution}/annotation` | `execution.annotate` | skriving |
| `list_credential_types` | `GET /api/v1/credential-types` | enhver innlogget nøkkel | lesing |
| `list_credentials` | `GET /api/v1/credentials` | `credential.list` | lesing |
| `get_credential` | `GET /api/v1/credentials/{credential}` | `credential.read` | lesing |
| `start_oauth` | `POST /api/v1/credentials/{credential}/oauth/start` | `credential.update` | skriving |
| `create_credential` | `POST /api/v1/credentials` | `credential.create` | skriving |
| `update_credential` | `PATCH /api/v1/credentials/{credential}` | `credential.update` | skriving |
| `delete_credential` | `DELETE /api/v1/credentials/{credential}` | `credential.delete` | skriving |
| `share_credential` | `PUT /api/v1/credentials/{credential}/shares/{project}` | `credential.share` | skriving |
| `unshare_credential` | `DELETE /api/v1/credentials/{credential}/shares/{project}` | `credential.share` | skriving |
| `create_role` | `POST /api/v1/roles` | `role.manage` | skriving |
| `update_role` | `PUT /api/v1/roles/{role}` | `role.manage` | skriving |
| `delete_role` | `DELETE /api/v1/roles/{role}` | `role.manage` | skriving |
| `list_redaction_policies` | `GET /api/v1/redaction-policies` | enhver innlogget nøkkel | lesing |
| `create_redaction_policy` | `POST /api/v1/redaction-policies` | `redaction.manage` | skriving |
| `update_redaction_policy` | `PUT /api/v1/redaction-policies/{policy}` | `redaction.manage` | skriving |
| `delete_redaction_policy` | `DELETE /api/v1/redaction-policies/{policy}` | `redaction.manage` | skriving |
| `list_secret_providers` | `GET /api/v1/secret-providers` | enhver innlogget nøkkel | lesing |
| `test_secret_provider` | `POST /api/v1/secret-providers/{provider}/test` | `secrets.manage` | skriving |
| `list_log_destinations` | `GET /api/v1/log-destinations` | `logstream.manage` | lesing |
| `test_log_destination` | `POST /api/v1/log-destinations/{destination}/test` | `logstream.manage` | skriving |
| `list_keys` | `GET /api/v1/api-keys` | enhver innlogget nøkkel | lesing |
| `revoke_key` | `DELETE /api/v1/api-keys/{key}` | enhver innlogget nøkkel | skriving |
| `list_scim_tokens` | `GET /api/v1/scim-tokens` | `scim.manage` | lesing |
| `revoke_scim_token` | `DELETE /api/v1/scim-tokens/{token}` | `scim.manage` | skriving |
| `list_users` | `GET /api/v1/users` | `user.manage` | lesing |
| `create_user` | `POST /api/v1/users` | `user.manage` | skriving |
| `change_user` | `PATCH /api/v1/users/{user}` | `user.manage` | skriving |
| `delete_user` | `DELETE /api/v1/users/{user}` | `user.manage` | skriving, bare eier |
| `list_audit` | `GET /api/v1/audit` | `audit.read` | lesing |
| `verify_audit` | `GET /api/v1/audit/verify` | `audit.read` | lesing |
| `get_settings` | `GET /api/v1/settings` | `instance.settings` | lesing |
| `change_settings` | `PATCH /api/v1/settings` | `instance.settings` | skriving |
| `describe_tool_body` | ikke en rute: JSON-skjemaet som innholdet til et verktøy bruker | enhver innlogget nøkkel | lesing |

## Utelatt med vilje

Ti ruter avviser en nøkkel selv, fordi de vil ha en innlogget person, og MCP-serveren later ikke som noe annet: å lage en API-nøkkel, å lage en tjenestekontonøkkel, å lage et SCIM-token, å legge til, endre og slette en ekstern hemmelighetsleverandør, å legge til, endre og slette et loggmål, og en persons eget passord. En nøkkel som kunne lage nøkler, eller endre hvor revisjonsloggen sendes, er en lekket nøkkel som kan holde seg selv i live. Hver av dem ville vært et verktøy som bare svarte «ikke tillatt», så ingen tilbys. Alt ved siden av er et verktøy: å liste loggmålene, hemmelighetsleverandørene og SCIM-tokenene, å tilbakekalle et SCIM-token, å teste en leverandør eller et mål, å liste og tilbakekalle nøkler, å åpne en arbeidsflyts testwebhook og å starte en OAuth2-innlogging, som gir tilbake adressen en person så åpner. En nøkkel kan tilbakekalle seg selv, som er det første innehaveren av en lekket nøkkel bør kunne gjøre.

`/api/v1/openapi.json` er ikke et verktøy: `describe_tool_body` gir innholdet.
