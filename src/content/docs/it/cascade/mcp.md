---
title: "Il server MCP"
description: "Cascade ha un server MCP che legge e scrive: 83 strumenti, ciascuno una route dell'API con il proprio gestore, il suo permesso, un motivo e una riga di audit."
---

:::note[Comprende ciò che sta arrivando]
Questa pagina comprende anche alcune cose più recenti di HotLoop Cascade 1.4.2, l'ultima versione rilasciata. Una parte potrebbe non essere in ciò che hai installato. Le [note di rilascio](/it/releases/) dicono cosa è cambiato.
:::

Cascade ha un server MCP, e legge e scrive. Viene fornito attivo, su `/mcp`, allo stesso indirizzo dell'API e dell'editor, e un agente che si collega può fare ciò che può fare la persona titolare della sua chiave e nulla di più. Non c'è una modalità di sola lettura da aggirare, perché un server che un agente può guardare e non toccare è una pagina di stato, e ne hai già una.

84 strumenti, e ognuno è una route dell'API REST. Una chiamata non passa accanto alla route, passa attraverso di essa: il gestore della route controlla da sé il permesso, valida il corpo, fa la modifica e scrive la riga di audit. Niente è stato copiato nel server MCP che possa divergere, e niente è stato lasciato fuori per saltare qualcosa.

Che cosa significa per te: se un flusso di lavoro, una credenziale, un progetto o una persona è qualcosa che puoi modificare dall'editor, può modificarlo anche un agente che ha la tua chiave, con i limiti del tuo ruolo, e il registro di audit dice che è stato un agente e quale.

## Collegarsi

Crea una chiave. Nell'editor si trova sotto il tuo account, oppure con l'API:

```sh
curl -s -X POST https://cascade.plant.example/api/v1/api-keys \
  -H "X-CSRF-Token: $CSRF" -b cookies.txt -H 'Content-Type: application/json' \
  -d '{"name":"line 4 agent","scopes":["*"],"days":30}'
```

Il token viene restituito una sola volta e inizia con `hlc_`. Una chiave fa ciò che potrebbe fare il suo titolare, ridotto ai suoi ambiti: dai a un agente `["workflow.read","execution.read"]` e potrà guardare e non toccare. Una chiave di account di servizio (un progetto, un ruolo, creata da un amministratore del progetto) funziona allo stesso modo ed è la chiave giusta per un'integrazione permanente.

Poi punta il client su `/mcp` e invia la chiave come token bearer. Il trasporto che parla è l'HTTP in streaming:

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

Una richiesta senza chiave, con una chiave sbagliata, revocata o scaduta, o la cui persona è stata disattivata riceve un 401 prima di arrivare a qualsiasi strumento, e una chiave revocata nel mezzo di una sessione smette di funzionare alla chiamata successiva.

## Le regole

**I permessi sono quelli della route.** `whoami` dice quali progetti la chiave può vedere e il suo ruolo in ciascuno. Uno strumento che la chiave non può usare viene rifiutato con il motivo della route stessa: 403 per un permesso che le manca, 404 per qualcosa che non può vedere, ossia la stessa risposta che dà l'API REST. È una decisione, non un guasto da aggirare.

**Una scrittura richiede un motivo.** Ogni strumento che modifica qualcosa prende un `reason` e rifiuta senza. Viene scritto nel registro di audit con la tua chiave e il nome che il tuo client si è dato.

**I segreti restano dove sono.** Nessuno strumento restituisce il campo segreto di una credenziale, a nessuna chiave, e una credenziale creata via MCP ha i suoi segreti sigillati nel caveau man mano che arrivano. `get_credential` è la stessa vista senza segreti che ha il modulo di modifica.

**Gli interruttori sono della distribuzione.** Due impostazioni, nell'ambiente in cui parte il server, che nessuna chiamata API e nessun agente può cambiare:

| Impostazione | Predefinito | Che cosa fa |
|---|---|---|
| `HOTLOOP_CASCADE_MCP` | `true` | Con `false`, `/mcp` non esiste. |
| `HOTLOOP_CASCADE_MCP_WRITES` | `true` | Con `false`, ogni strumento che modifica qualcosa rifiuta, e quelli che leggono continuano a funzionare. |

`PATCH /settings` non conosce nessuno dei due, quindi un agente che può modificare le impostazioni non può comunque riattivare le scritture.

**Non scrive mai sulle apparecchiature.** `run_workflow` avvia un'esecuzione vera, e ciò che i suoi passaggi fanno ai sistemi che chiamano dipende dai passaggi. Tutto ciò che muove una valvola o cambia un setpoint passa dal gate di scrittura di HotLoop, così l'audit di quel gate lo vede chiunque abbia avviato il flusso di lavoro.

## Che cosa dice il registro di audit

Due righe per una scrittura. La riga della route ha l'agente come attore, con tipo `mcp`, la chiave, di chi è e il client:

```
actor:  mcp, "line 4 agent (ops@plant.example) via claude-desktop"
action: workflow.created
```

E una riga dello strumento, con il motivo, scritta sia che la route abbia detto sì sia che abbia rifiutato:

```
action: mcp.write   target: create_workflow
detail: {"reason": "the line 4 oven needs a setpoint workflow", "method": "POST", "path": "/api/v1/workflows", "status": 201}
```

`list_audit` con `action=mcp.write` è ogni modifica fatta da un agente e perché.

## Gli strumenti

Ogni riga è una route vera e il permesso che quella route richiede, e un test tiene la tabella fedele a entrambi. Un permesso è di progetto (si controlla nel progetto in cui si trova la risorsa) o di istanza (proprietari e amministratori). Qualsiasi chiave autenticata può richiedere quelli così indicati.

Gli strumenti con corpo prendono un `body`, lo stesso JSON che prende l'API REST. `describe_tool_body` dà lo schema di qualsiasi strumento, così la prima chiamata è giusta.

| Strumento | Route | Permesso | Tipo |
|---|---|---|---|
| `get_version` | `GET /api/v1/version` | qualsiasi chiave autenticata | lettura |
| `whoami` | `GET /api/v1/me` | qualsiasi chiave autenticata | lettura |
| `list_permissions` | `GET /api/v1/permissions` | qualsiasi chiave autenticata | lettura |
| `list_roles` | `GET /api/v1/roles` | qualsiasi chiave autenticata | lettura |
| `get_role` | `GET /api/v1/roles/{role}` | qualsiasi chiave autenticata | lettura |
| `list_projects` | `GET /api/v1/projects` | `project.read` | lettura |
| `get_project` | `GET /api/v1/projects/{project}` | `project.read` | lettura |
| `create_project` | `POST /api/v1/projects` | `project.create` | scrittura |
| `rename_project` | `PATCH /api/v1/projects/{project}` | `project.update` | scrittura |
| `delete_project` | `DELETE /api/v1/projects/{project}` | `project.delete` | scrittura |
| `list_members` | `GET /api/v1/projects/{project}/members` | `project.read` | lettura |
| `set_member` | `PUT /api/v1/projects/{project}/members/{user}` | `project.members` | scrittura |
| `remove_member` | `DELETE /api/v1/projects/{project}/members/{user}` | `project.members` | scrittura |
| `list_service_accounts` | `GET /api/v1/projects/{project}/service-accounts` | `project.members` | lettura |
| `list_workflows` | `GET /api/v1/workflows` | `workflow.read` | lettura |
| `get_workflow` | `GET /api/v1/workflows/{workflow}` | `workflow.read` | lettura |
| `create_workflow` | `POST /api/v1/workflows` | `workflow.create` | scrittura |
| `save_workflow` | `PUT /api/v1/workflows/{workflow}` | `workflow.update` | scrittura |
| `delete_workflow` | `DELETE /api/v1/workflows/{workflow}` | `workflow.delete` | scrittura |
| `listen_workflow` | `POST /api/v1/workflows/{workflow}/listen` | `workflow.execute` | scrittura |
| `activate_workflow` | `POST /api/v1/workflows/{workflow}/activate` | `workflow.activate` | scrittura |
| `deactivate_workflow` | `POST /api/v1/workflows/{workflow}/deactivate` | `workflow.activate` | scrittura |
| `run_workflow` | `POST /api/v1/workflows/{workflow}/run` | `workflow.execute` | scrittura |
| `move_workflow` | `PUT /api/v1/workflows/{workflow}/folder` | `workflow.update` | scrittura |
| `list_workflow_versions` | `GET /api/v1/workflows/{workflow}/versions` | `workflow.read` | lettura |
| `get_workflow_version` | `GET /api/v1/workflows/{workflow}/versions/{version}` | `workflow.read` | lettura |
| `diff_workflow_versions` | `GET /api/v1/workflows/{workflow}/diff` | `workflow.read` | lettura |
| `restore_workflow_version` | `POST /api/v1/workflows/{workflow}/versions/{version}/restore` | `workflow.update` | scrittura |
| `label_workflow_version` | `PUT /api/v1/workflows/{workflow}/versions/{version}/label` | `workflow.update` | scrittura |
| `preview_expression` | `POST /api/v1/workflows/{workflow}/preview` | `workflow.read` | lettura |
| `list_expression_functions` | `GET /api/v1/expression/functions` | qualsiasi chiave autenticata | lettura |
| `list_step_types` | `GET /api/v1/step-types` | qualsiasi chiave autenticata | lettura |
| `shape_step` | `POST /api/v1/step-types/{type}/{version}/shape` | qualsiasi chiave autenticata | lettura |
| `list_folders` | `GET /api/v1/folders` | `folder.read` | lettura |
| `create_folder` | `POST /api/v1/folders` | `folder.create` | scrittura |
| `update_folder` | `PATCH /api/v1/folders/{folder}` | `folder.update` | scrittura |
| `delete_folder` | `DELETE /api/v1/folders/{folder}` | `folder.delete` | scrittura |
| `list_variables` | `GET /api/v1/variables` | `variable.read` | lettura |
| `create_variable` | `POST /api/v1/variables` | `variable.create` | scrittura |
| `update_variable` | `PUT /api/v1/variables/{variable}` | `variable.update` | scrittura |
| `delete_variable` | `DELETE /api/v1/variables/{variable}` | `variable.delete` | scrittura |
| `list_executions` | `GET /api/v1/executions` | `execution.read` | lettura |
| `get_execution` | `GET /api/v1/executions/{execution}` | `execution.read` | lettura |
| `get_step_output` | `GET /api/v1/executions/{execution}/steps/{step}/output` | `execution.read` | lettura |
| `get_insights` | `GET /api/v1/insights` | `execution.read` | lettura |
| `stop_execution` | `POST /api/v1/executions/{execution}/stop` | `execution.stop` | scrittura |
| `retry_execution` | `POST /api/v1/executions/{execution}/retry` | `execution.retry` | scrittura |
| `replay_execution` | `POST /api/v1/executions/{execution}/replay` | `execution.retry` | scrittura |
| `delete_execution` | `DELETE /api/v1/executions/{execution}` | `execution.delete` | scrittura |
| `annotate_execution` | `PUT /api/v1/executions/{execution}/annotation` | `execution.annotate` | scrittura |
| `clear_annotation` | `DELETE /api/v1/executions/{execution}/annotation` | `execution.annotate` | scrittura |
| `list_credential_types` | `GET /api/v1/credential-types` | qualsiasi chiave autenticata | lettura |
| `list_credentials` | `GET /api/v1/credentials` | `credential.list` | lettura |
| `get_credential` | `GET /api/v1/credentials/{credential}` | `credential.read` | lettura |
| `start_oauth` | `POST /api/v1/credentials/{credential}/oauth/start` | `credential.update` | scrittura |
| `create_credential` | `POST /api/v1/credentials` | `credential.create` | scrittura |
| `update_credential` | `PATCH /api/v1/credentials/{credential}` | `credential.update` | scrittura |
| `delete_credential` | `DELETE /api/v1/credentials/{credential}` | `credential.delete` | scrittura |
| `share_credential` | `PUT /api/v1/credentials/{credential}/shares/{project}` | `credential.share` | scrittura |
| `unshare_credential` | `DELETE /api/v1/credentials/{credential}/shares/{project}` | `credential.share` | scrittura |
| `create_role` | `POST /api/v1/roles` | `role.manage` | scrittura |
| `update_role` | `PUT /api/v1/roles/{role}` | `role.manage` | scrittura |
| `delete_role` | `DELETE /api/v1/roles/{role}` | `role.manage` | scrittura |
| `list_redaction_policies` | `GET /api/v1/redaction-policies` | qualsiasi chiave autenticata | lettura |
| `create_redaction_policy` | `POST /api/v1/redaction-policies` | `redaction.manage` | scrittura |
| `update_redaction_policy` | `PUT /api/v1/redaction-policies/{policy}` | `redaction.manage` | scrittura |
| `delete_redaction_policy` | `DELETE /api/v1/redaction-policies/{policy}` | `redaction.manage` | scrittura |
| `list_secret_providers` | `GET /api/v1/secret-providers` | qualsiasi chiave autenticata | lettura |
| `test_secret_provider` | `POST /api/v1/secret-providers/{provider}/test` | `secrets.manage` | scrittura |
| `list_log_destinations` | `GET /api/v1/log-destinations` | `logstream.manage` | lettura |
| `test_log_destination` | `POST /api/v1/log-destinations/{destination}/test` | `logstream.manage` | scrittura |
| `list_keys` | `GET /api/v1/api-keys` | qualsiasi chiave autenticata | lettura |
| `revoke_key` | `DELETE /api/v1/api-keys/{key}` | qualsiasi chiave autenticata | scrittura |
| `list_scim_tokens` | `GET /api/v1/scim-tokens` | `scim.manage` | lettura |
| `revoke_scim_token` | `DELETE /api/v1/scim-tokens/{token}` | `scim.manage` | scrittura |
| `list_users` | `GET /api/v1/users` | `user.manage` | lettura |
| `create_user` | `POST /api/v1/users` | `user.manage` | scrittura |
| `change_user` | `PATCH /api/v1/users/{user}` | `user.manage` | scrittura |
| `delete_user` | `DELETE /api/v1/users/{user}` | `user.manage` | scrittura, solo proprietario |
| `list_audit` | `GET /api/v1/audit` | `audit.read` | lettura |
| `verify_audit` | `GET /api/v1/audit/verify` | `audit.read` | lettura |
| `get_settings` | `GET /api/v1/settings` | `instance.settings` | lettura |
| `change_settings` | `PATCH /api/v1/settings` | `instance.settings` | scrittura |
| `describe_tool_body` | non è una route: lo schema JSON che accetta il corpo di uno strumento | qualsiasi chiave autenticata | lettura |

## Lasciato fuori di proposito

Dieci route respingono da sole una chiave, perché vogliono una persona autenticata, e il server MCP non finge il contrario: creare una chiave API, creare una chiave di account di servizio, creare un token SCIM, aggiungere, modificare ed eliminare un provider di segreti esterno, aggiungere, modificare ed eliminare una destinazione dei log, e la password di una persona. Una chiave che potesse coniare chiavi, o cambiare dove viene inviato il registro di audit, è una chiave trapelata che può tenersi in vita. Ognuna di queste sarebbe uno strumento che risponderebbe sempre e solo «non consentito», quindi nessuna è offerta. Tutto il resto è uno strumento: elencare le destinazioni dei log, i provider di segreti e i token SCIM, revocare un token SCIM, provare un provider o una destinazione, elencare e revocare le chiavi, aprire il webhook di prova di un flusso di lavoro e avviare un accesso OAuth2, che restituisce l'indirizzo che una persona poi apre. Una chiave può revocare se stessa, che è la prima cosa che dovrebbe poter fare chi ha una chiave trapelata.

`/api/v1/openapi.json` non è uno strumento: `describe_tool_body` dà i corpi.
