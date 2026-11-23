---
title: "Der MCP-Server"
description: "Cascade hat einen MCP-Server, der liest und schreibt: 83 Werkzeuge, jedes eine API-Route mit eigenem Handler, eigener Berechtigung, Begründung und Audit-Zeile."
---

:::note[Enthält, was kommt]
Diese Seite behandelt auch einige Dinge, die neuer sind als HotLoop Cascade 1.4.2, die aktuelle Version. Manches davon ist möglicherweise nicht in dem enthalten, was Sie installiert haben. Die [Versionshinweise](/de/releases/) sagen, was sich geändert hat.
:::

Cascade hat einen MCP-Server, und er liest und schreibt. Er wird eingeschaltet ausgeliefert, unter `/mcp` auf derselben Adresse wie die API und der Editor, und ein Agent, der sich verbindet, kann tun, was die Person hinter seinem Schlüssel tun kann, und nicht mehr. Es gibt keinen Nur-Lese-Modus, den man umgehen müsste, denn ein Server, den ein Agent ansehen, aber nicht anfassen kann, ist eine Statusseite, und die haben Sie schon.

84 Werkzeuge, und jedes davon ist eine Route der REST-API. Ein Aufruf geht nicht neben der Route vorbei, er geht durch sie: Der Handler der Route prüft selbst die Berechtigung, validiert den Body, macht die Änderung und schreibt die Audit-Zeile. Nichts wurde in den MCP-Server kopiert, was auseinanderlaufen könnte, und nichts wurde weggelassen, um etwas zu umgehen.

Was das für Sie heißt: Wenn Sie einen Workflow, Zugangsdaten, ein Projekt oder eine Person im Editor ändern können, kann ein Agent mit Ihrem Schlüssel das auch, mit den Grenzen Ihrer Rolle, und das Audit-Log vermerkt, dass es ein Agent war und welcher.

## Verbinden

Erstellen Sie einen Schlüssel. Im Editor finden Sie ihn unter Ihrem Konto, oder mit der API:

```sh
curl -s -X POST https://cascade.plant.example/api/v1/api-keys \
  -H "X-CSRF-Token: $CSRF" -b cookies.txt -H 'Content-Type: application/json' \
  -d '{"name":"line 4 agent","scopes":["*"],"days":30}'
```

Das Token kommt einmal zurück und beginnt mit `hlc_`. Ein Schlüssel kann, was sein Inhaber könnte, eingeschränkt auf seine Scopes: Geben Sie einem Agenten `["workflow.read","execution.read"]`, und er kann ansehen, aber nichts anfassen. Ein Dienstkonto-Schlüssel (ein Projekt, eine Rolle, von einem Projektadmin erstellt) funktioniert genauso und ist der richtige Schlüssel für eine dauerhafte Integration.

Richten Sie dann den Client auf `/mcp` und senden Sie den Schlüssel als Bearer-Token. Gesprochen wird der Streamable-HTTP-Transport:

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

Eine Anfrage ohne Schlüssel, mit einem falschen, widerrufenen oder abgelaufenen oder mit dem Schlüssel einer deaktivierten Person bekommt ein 401, bevor sie ein Werkzeug erreicht, und ein Schlüssel, der mitten in einer Sitzung widerrufen wird, funktioniert beim nächsten Aufruf nicht mehr.

## Die Regeln

**Berechtigungen sind die der Route.** `whoami` sagt, welche Projekte der Schlüssel sehen kann und welche Rolle er in jedem hat. Ein Werkzeug, das der Schlüssel nicht nutzen darf, wird mit dem Grund der Route selbst abgelehnt: 403 für eine fehlende Berechtigung, 404 für etwas, das er nicht sehen kann, also dieselbe Antwort wie bei der REST-API. Das ist eine Entscheidung, kein Fehler, den man umgehen müsste.

**Ein Schreibvorgang braucht eine Begründung.** Jedes Werkzeug, das etwas ändert, nimmt einen `reason` und lehnt ohne ihn ab. Er wird mit Ihrem Schlüssel und dem Namen, den Ihr Client sich gegeben hat, ins Audit-Log geschrieben.

**Geheimnisse bleiben, wo sie sind.** Kein Werkzeug gibt das geheime Feld von Zugangsdaten zurück, an keinen Schlüssel, und Zugangsdaten, die über MCP angelegt werden, werden beim Eintreffen im Tresor versiegelt. `get_credential` ist dieselbe Ansicht ohne Geheimnisse wie im Bearbeitungsformular.

**Die Schalter gehören dem Deployment.** Zwei Einstellungen in der Umgebung, in der der Server startet, die weder ein API-Aufruf noch ein Agent ändern kann:

| Einstellung | Standard | Was sie bewirkt |
|---|---|---|
| `HOTLOOP_CASCADE_MCP` | `true` | Bei `false` gibt es `/mcp` nicht. |
| `HOTLOOP_CASCADE_MCP_WRITES` | `true` | Bei `false` lehnt jedes Werkzeug ab, das etwas ändert, und die lesenden funktionieren weiter. |

`PATCH /settings` kennt keinen der beiden, also kann ein Agent, der die Einstellungen bearbeiten darf, das Schreiben trotzdem nicht wieder einschalten.

**Es schreibt nie auf Anlagen.** `run_workflow` startet eine echte Ausführung, und was ihre Schritte den Systemen antun, die sie aufrufen, liegt bei den Schritten. Alles, was ein Ventil bewegt oder einen Sollwert ändert, läuft über das Schreib-Gate von HotLoop, sodass dessen Audit es sieht, wer auch immer den Workflow gestartet hat.

## Was das Audit-Log sagt

Zwei Zeilen pro Schreibvorgang. Die Zeile der Route selbst hat den Agenten als Akteur, mit dem Typ `mcp`, dem Schlüssel, wem er gehört und dem Client:

```
actor:  mcp, "line 4 agent (ops@plant.example) via claude-desktop"
action: workflow.created
```

Und eine Zeile des Werkzeugs, mit der Begründung, geschrieben, egal ob die Route zugestimmt oder abgelehnt hat:

```
action: mcp.write   target: create_workflow
detail: {"reason": "the line 4 oven needs a setpoint workflow", "method": "POST", "path": "/api/v1/workflows", "status": 201}
```

`list_audit` mit `action=mcp.write` zeigt jede Änderung, die ein Agent gemacht hat, und warum.

## Die Werkzeuge

Jede Zeile ist eine echte Route und die Berechtigung, die diese Route verlangt, und ein Test hält die Tabelle an beides. Eine Berechtigung ist entweder eine Projektberechtigung (sie wird in dem Projekt geprüft, in dem die Sache liegt) oder eine Instanzberechtigung (Eigentümer und Admins). Die so markierten kann jeder angemeldete Schlüssel anfragen.

Werkzeuge mit Body nehmen einen `body`, dasselbe JSON, das die REST-API nimmt. `describe_tool_body` liefert das Schema jedes Werkzeugs, damit schon der erste Aufruf stimmt.

| Werkzeug | Route | Berechtigung | Art |
|---|---|---|---|
| `get_version` | `GET /api/v1/version` | jeder angemeldete Schlüssel | lesen |
| `whoami` | `GET /api/v1/me` | jeder angemeldete Schlüssel | lesen |
| `list_permissions` | `GET /api/v1/permissions` | jeder angemeldete Schlüssel | lesen |
| `list_roles` | `GET /api/v1/roles` | jeder angemeldete Schlüssel | lesen |
| `get_role` | `GET /api/v1/roles/{role}` | jeder angemeldete Schlüssel | lesen |
| `list_projects` | `GET /api/v1/projects` | `project.read` | lesen |
| `get_project` | `GET /api/v1/projects/{project}` | `project.read` | lesen |
| `create_project` | `POST /api/v1/projects` | `project.create` | schreiben |
| `rename_project` | `PATCH /api/v1/projects/{project}` | `project.update` | schreiben |
| `delete_project` | `DELETE /api/v1/projects/{project}` | `project.delete` | schreiben |
| `list_members` | `GET /api/v1/projects/{project}/members` | `project.read` | lesen |
| `set_member` | `PUT /api/v1/projects/{project}/members/{user}` | `project.members` | schreiben |
| `remove_member` | `DELETE /api/v1/projects/{project}/members/{user}` | `project.members` | schreiben |
| `list_service_accounts` | `GET /api/v1/projects/{project}/service-accounts` | `project.members` | lesen |
| `list_workflows` | `GET /api/v1/workflows` | `workflow.read` | lesen |
| `get_workflow` | `GET /api/v1/workflows/{workflow}` | `workflow.read` | lesen |
| `create_workflow` | `POST /api/v1/workflows` | `workflow.create` | schreiben |
| `save_workflow` | `PUT /api/v1/workflows/{workflow}` | `workflow.update` | schreiben |
| `delete_workflow` | `DELETE /api/v1/workflows/{workflow}` | `workflow.delete` | schreiben |
| `listen_workflow` | `POST /api/v1/workflows/{workflow}/listen` | `workflow.execute` | schreiben |
| `activate_workflow` | `POST /api/v1/workflows/{workflow}/activate` | `workflow.activate` | schreiben |
| `deactivate_workflow` | `POST /api/v1/workflows/{workflow}/deactivate` | `workflow.activate` | schreiben |
| `run_workflow` | `POST /api/v1/workflows/{workflow}/run` | `workflow.execute` | schreiben |
| `move_workflow` | `PUT /api/v1/workflows/{workflow}/folder` | `workflow.update` | schreiben |
| `list_workflow_versions` | `GET /api/v1/workflows/{workflow}/versions` | `workflow.read` | lesen |
| `get_workflow_version` | `GET /api/v1/workflows/{workflow}/versions/{version}` | `workflow.read` | lesen |
| `diff_workflow_versions` | `GET /api/v1/workflows/{workflow}/diff` | `workflow.read` | lesen |
| `restore_workflow_version` | `POST /api/v1/workflows/{workflow}/versions/{version}/restore` | `workflow.update` | schreiben |
| `label_workflow_version` | `PUT /api/v1/workflows/{workflow}/versions/{version}/label` | `workflow.update` | schreiben |
| `preview_expression` | `POST /api/v1/workflows/{workflow}/preview` | `workflow.read` | lesen |
| `list_expression_functions` | `GET /api/v1/expression/functions` | jeder angemeldete Schlüssel | lesen |
| `list_step_types` | `GET /api/v1/step-types` | jeder angemeldete Schlüssel | lesen |
| `shape_step` | `POST /api/v1/step-types/{type}/{version}/shape` | jeder angemeldete Schlüssel | lesen |
| `list_folders` | `GET /api/v1/folders` | `folder.read` | lesen |
| `create_folder` | `POST /api/v1/folders` | `folder.create` | schreiben |
| `update_folder` | `PATCH /api/v1/folders/{folder}` | `folder.update` | schreiben |
| `delete_folder` | `DELETE /api/v1/folders/{folder}` | `folder.delete` | schreiben |
| `list_variables` | `GET /api/v1/variables` | `variable.read` | lesen |
| `create_variable` | `POST /api/v1/variables` | `variable.create` | schreiben |
| `update_variable` | `PUT /api/v1/variables/{variable}` | `variable.update` | schreiben |
| `delete_variable` | `DELETE /api/v1/variables/{variable}` | `variable.delete` | schreiben |
| `list_executions` | `GET /api/v1/executions` | `execution.read` | lesen |
| `get_execution` | `GET /api/v1/executions/{execution}` | `execution.read` | lesen |
| `get_step_output` | `GET /api/v1/executions/{execution}/steps/{step}/output` | `execution.read` | lesen |
| `get_insights` | `GET /api/v1/insights` | `execution.read` | lesen |
| `stop_execution` | `POST /api/v1/executions/{execution}/stop` | `execution.stop` | schreiben |
| `retry_execution` | `POST /api/v1/executions/{execution}/retry` | `execution.retry` | schreiben |
| `replay_execution` | `POST /api/v1/executions/{execution}/replay` | `execution.retry` | schreiben |
| `delete_execution` | `DELETE /api/v1/executions/{execution}` | `execution.delete` | schreiben |
| `annotate_execution` | `PUT /api/v1/executions/{execution}/annotation` | `execution.annotate` | schreiben |
| `clear_annotation` | `DELETE /api/v1/executions/{execution}/annotation` | `execution.annotate` | schreiben |
| `list_credential_types` | `GET /api/v1/credential-types` | jeder angemeldete Schlüssel | lesen |
| `list_credentials` | `GET /api/v1/credentials` | `credential.list` | lesen |
| `get_credential` | `GET /api/v1/credentials/{credential}` | `credential.read` | lesen |
| `start_oauth` | `POST /api/v1/credentials/{credential}/oauth/start` | `credential.update` | schreiben |
| `create_credential` | `POST /api/v1/credentials` | `credential.create` | schreiben |
| `update_credential` | `PATCH /api/v1/credentials/{credential}` | `credential.update` | schreiben |
| `delete_credential` | `DELETE /api/v1/credentials/{credential}` | `credential.delete` | schreiben |
| `share_credential` | `PUT /api/v1/credentials/{credential}/shares/{project}` | `credential.share` | schreiben |
| `unshare_credential` | `DELETE /api/v1/credentials/{credential}/shares/{project}` | `credential.share` | schreiben |
| `create_role` | `POST /api/v1/roles` | `role.manage` | schreiben |
| `update_role` | `PUT /api/v1/roles/{role}` | `role.manage` | schreiben |
| `delete_role` | `DELETE /api/v1/roles/{role}` | `role.manage` | schreiben |
| `list_redaction_policies` | `GET /api/v1/redaction-policies` | jeder angemeldete Schlüssel | lesen |
| `create_redaction_policy` | `POST /api/v1/redaction-policies` | `redaction.manage` | schreiben |
| `update_redaction_policy` | `PUT /api/v1/redaction-policies/{policy}` | `redaction.manage` | schreiben |
| `delete_redaction_policy` | `DELETE /api/v1/redaction-policies/{policy}` | `redaction.manage` | schreiben |
| `list_secret_providers` | `GET /api/v1/secret-providers` | jeder angemeldete Schlüssel | lesen |
| `test_secret_provider` | `POST /api/v1/secret-providers/{provider}/test` | `secrets.manage` | schreiben |
| `list_log_destinations` | `GET /api/v1/log-destinations` | `logstream.manage` | lesen |
| `test_log_destination` | `POST /api/v1/log-destinations/{destination}/test` | `logstream.manage` | schreiben |
| `list_keys` | `GET /api/v1/api-keys` | jeder angemeldete Schlüssel | lesen |
| `revoke_key` | `DELETE /api/v1/api-keys/{key}` | jeder angemeldete Schlüssel | schreiben |
| `list_scim_tokens` | `GET /api/v1/scim-tokens` | `scim.manage` | lesen |
| `revoke_scim_token` | `DELETE /api/v1/scim-tokens/{token}` | `scim.manage` | schreiben |
| `list_users` | `GET /api/v1/users` | `user.manage` | lesen |
| `create_user` | `POST /api/v1/users` | `user.manage` | schreiben |
| `change_user` | `PATCH /api/v1/users/{user}` | `user.manage` | schreiben |
| `delete_user` | `DELETE /api/v1/users/{user}` | `user.manage` | Schreiben, nur Eigentümer |
| `list_audit` | `GET /api/v1/audit` | `audit.read` | lesen |
| `verify_audit` | `GET /api/v1/audit/verify` | `audit.read` | lesen |
| `get_settings` | `GET /api/v1/settings` | `instance.settings` | lesen |
| `change_settings` | `PATCH /api/v1/settings` | `instance.settings` | schreiben |
| `describe_tool_body` | keine Route: das JSON-Schema, das der Body eines Werkzeugs erwartet | jeder angemeldete Schlüssel | lesen |

## Mit Absicht weggelassen

Zehn Routen weisen einen Schlüssel selbst ab, weil sie eine angemeldete Person wollen, und der MCP-Server tut nicht so, als wäre es anders: einen API-Schlüssel erstellen, einen Dienstkonto-Schlüssel erstellen, ein SCIM-Token erstellen, einen externen Geheimnisanbieter hinzufügen, ändern und löschen, ein Log-Ziel hinzufügen, ändern und löschen, und das eigene Passwort einer Person. Ein Schlüssel, der Schlüssel prägen oder ändern könnte, wohin das Audit-Log geschickt wird, ist ein geleakter Schlüssel, der sich selbst am Leben halten kann. Jede davon wäre ein Werkzeug, das immer nur „nicht erlaubt“ antworten würde, also wird keine angeboten. Alles daneben ist ein Werkzeug: die Log-Ziele, die Geheimnisanbieter und die SCIM-Tokens auflisten, ein SCIM-Token widerrufen, einen Anbieter oder ein Ziel testen, Schlüssel auflisten und widerrufen, den Test-Webhook eines Workflows öffnen und eine OAuth2-Anmeldung starten, die die Adresse zurückgibt, die eine Person dann öffnet. Ein Schlüssel kann sich selbst widerrufen, und genau das sollte der Inhaber eines geleakten Schlüssels als Erstes tun können.

`/api/v1/openapi.json` ist kein Werkzeug: `describe_tool_body` liefert die Bodys.
