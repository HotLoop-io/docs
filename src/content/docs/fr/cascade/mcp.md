---
title: "Le serveur MCP"
description: "Cascade a un serveur MCP qui lit et écrit : 83 outils, chacun une route de l'API avec son propre gestionnaire, sa permission, un motif et une ligne d'audit."
---

Cascade a un serveur MCP, et il lit et écrit. Il est livré activé, sur `/mcp`, à la même adresse que l'API et l'éditeur, et un agent qui s'y connecte peut faire ce que peut faire la personne qui détient sa clé, et rien de plus. Il n'y a pas de mode lecture seule à contourner, parce qu'un serveur qu'un agent peut regarder sans y toucher est une page d'état, et vous en avez déjà une.

83 outils, et chacun est une route de l'API REST. Un appel ne passe pas à côté de la route, il passe par elle : le gestionnaire de la route vérifie lui-même la permission, valide le corps, fait le changement et écrit la ligne d'audit. Rien n'a été copié dans le serveur MCP qui puisse dériver, et rien n'en a été exclu qu'on puisse contourner.

Ce que cela signifie pour vous : si un flux de travail, un identifiant, un projet ou une personne est quelque chose que vous pouvez modifier depuis l'éditeur, un agent qui détient votre clé peut aussi le modifier, avec les limites de votre rôle, et le journal d'audit indique que c'était un agent et lequel.

## Se connecter

Créez une clé. Dans l'éditeur, elle se trouve sous votre compte, ou avec l'API :

```sh
curl -s -X POST https://cascade.plant.example/api/v1/api-keys \
  -H "X-CSRF-Token: $CSRF" -b cookies.txt -H 'Content-Type: application/json' \
  -d '{"name":"line 4 agent","scopes":["*"],"days":30}'
```

Le jeton n'est renvoyé qu'une fois et commence par `hlc_`. Une clé fait ce que son titulaire pourrait faire, réduit à ses portées : donnez à un agent `["workflow.read","execution.read"]` et il pourra regarder sans toucher. Une clé de compte de service (un projet, un rôle, créée par un administrateur du projet) fonctionne de la même façon et convient pour une intégration permanente.

Pointez ensuite le client vers `/mcp` et envoyez la clé comme jeton bearer. Le transport qu'il parle est le HTTP en streaming :

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

Une requête sans clé, avec une mauvaise clé, une clé révoquée ou expirée, ou dont la personne a été désactivée reçoit un 401 avant d'atteindre un outil, et une clé révoquée en pleine session cesse de fonctionner à son appel suivant.

## Les règles

**Les permissions sont celles de la route.** `whoami` indique quels projets la clé peut voir et son rôle dans chacun. Un outil que la clé n'a pas le droit d'utiliser est refusé avec le motif de la route elle-même : 403 pour une permission qui lui manque, 404 pour ce qu'elle ne peut pas voir, soit la même réponse que donne l'API REST. C'est une décision, pas une panne à contourner.

**Une écriture demande un motif.** Tout outil qui modifie quelque chose prend un `reason` et refuse sans lui. Il est écrit dans le journal d'audit avec votre clé et le nom que votre client s'est donné.

**Les secrets restent en place.** Aucun outil ne renvoie le champ secret d'un identifiant, à aucune clé, et un identifiant créé par MCP a ses secrets scellés dans le coffre à mesure qu'ils arrivent. `get_credential` est la même vue sans secret que celle du formulaire de modification.

**Les interrupteurs appartiennent au déploiement.** Deux réglages, dans l'environnement où le serveur démarre, que ni un appel d'API ni un agent ne peut modifier :

| Réglage | Par défaut | Ce qu'il fait |
|---|---|---|
| `HOTLOOP_CASCADE_MCP` | `true` | Avec `false`, `/mcp` n'existe plus. |
| `HOTLOOP_CASCADE_MCP_WRITES` | `true` | Avec `false`, tout outil qui modifie quoi que ce soit refuse, et ceux qui lisent continuent de fonctionner. |

`PATCH /settings` ne connaît ni l'un ni l'autre, donc un agent qui peut modifier les paramètres ne peut toujours pas réactiver les écritures.

**Il n'écrit jamais sur les équipements.** `run_workflow` lance une vraie exécution, et ce que ses étapes font aux systèmes qu'elles appellent dépend des étapes. Tout ce qui déplace une vanne ou change une consigne passe par la porte d'écriture de HotLoop, si bien que l'audit de cette porte le voit, quelle que soit la personne qui a lancé le flux de travail.

## Ce que dit le journal d'audit

Deux lignes pour une écriture. La ligne de la route elle-même a l'agent pour acteur, avec le type `mcp`, la clé, à qui elle est et le client :

```
actor:  mcp, "line 4 agent (ops@plant.example) via claude-desktop"
action: workflow.created
```

Et une ligne de l'outil, avec le motif, écrite que la route ait dit oui ou refusé :

```
action: mcp.write   target: create_workflow
detail: {"reason": "the line 4 oven needs a setpoint workflow", "method": "POST", "path": "/api/v1/workflows", "status": 201}
```

`list_audit` avec `action=mcp.write` donne chaque changement fait par un agent et pourquoi.

## Les outils

Chaque ligne est une vraie route et la permission que cette route demande, et un test tient le tableau fidèle aux deux. Une permission est une permission de projet (elle est vérifiée dans le projet où se trouve la ressource) ou d'instance (propriétaires et administrateurs). Toute clé connectée peut demander celles ainsi marquées.

Les outils à corps prennent un `body`, le même JSON que prend l'API REST. `describe_tool_body` donne le schéma de n'importe quel outil, pour que le premier appel soit le bon.

| Outil | Route | Permission | Type |
|---|---|---|---|
| `get_version` | `GET /api/v1/version` | toute clé connectée | lecture |
| `whoami` | `GET /api/v1/me` | toute clé connectée | lecture |
| `list_permissions` | `GET /api/v1/permissions` | toute clé connectée | lecture |
| `list_roles` | `GET /api/v1/roles` | toute clé connectée | lecture |
| `get_role` | `GET /api/v1/roles/{role}` | toute clé connectée | lecture |
| `list_projects` | `GET /api/v1/projects` | `project.read` | lecture |
| `get_project` | `GET /api/v1/projects/{project}` | `project.read` | lecture |
| `create_project` | `POST /api/v1/projects` | `project.create` | écriture |
| `rename_project` | `PATCH /api/v1/projects/{project}` | `project.update` | écriture |
| `delete_project` | `DELETE /api/v1/projects/{project}` | `project.delete` | écriture |
| `list_members` | `GET /api/v1/projects/{project}/members` | `project.read` | lecture |
| `set_member` | `PUT /api/v1/projects/{project}/members/{user}` | `project.members` | écriture |
| `remove_member` | `DELETE /api/v1/projects/{project}/members/{user}` | `project.members` | écriture |
| `list_service_accounts` | `GET /api/v1/projects/{project}/service-accounts` | `project.members` | lecture |
| `list_workflows` | `GET /api/v1/workflows` | `workflow.read` | lecture |
| `get_workflow` | `GET /api/v1/workflows/{workflow}` | `workflow.read` | lecture |
| `create_workflow` | `POST /api/v1/workflows` | `workflow.create` | écriture |
| `save_workflow` | `PUT /api/v1/workflows/{workflow}` | `workflow.update` | écriture |
| `delete_workflow` | `DELETE /api/v1/workflows/{workflow}` | `workflow.delete` | écriture |
| `listen_workflow` | `POST /api/v1/workflows/{workflow}/listen` | `workflow.execute` | écriture |
| `activate_workflow` | `POST /api/v1/workflows/{workflow}/activate` | `workflow.activate` | écriture |
| `deactivate_workflow` | `POST /api/v1/workflows/{workflow}/deactivate` | `workflow.activate` | écriture |
| `run_workflow` | `POST /api/v1/workflows/{workflow}/run` | `workflow.execute` | écriture |
| `move_workflow` | `PUT /api/v1/workflows/{workflow}/folder` | `workflow.update` | écriture |
| `list_workflow_versions` | `GET /api/v1/workflows/{workflow}/versions` | `workflow.read` | lecture |
| `get_workflow_version` | `GET /api/v1/workflows/{workflow}/versions/{version}` | `workflow.read` | lecture |
| `diff_workflow_versions` | `GET /api/v1/workflows/{workflow}/diff` | `workflow.read` | lecture |
| `restore_workflow_version` | `POST /api/v1/workflows/{workflow}/versions/{version}/restore` | `workflow.update` | écriture |
| `label_workflow_version` | `PUT /api/v1/workflows/{workflow}/versions/{version}/label` | `workflow.update` | écriture |
| `preview_expression` | `POST /api/v1/workflows/{workflow}/preview` | `workflow.read` | lecture |
| `list_expression_functions` | `GET /api/v1/expression/functions` | toute clé connectée | lecture |
| `list_step_types` | `GET /api/v1/step-types` | toute clé connectée | lecture |
| `shape_step` | `POST /api/v1/step-types/{type}/{version}/shape` | toute clé connectée | lecture |
| `list_folders` | `GET /api/v1/folders` | `folder.read` | lecture |
| `create_folder` | `POST /api/v1/folders` | `folder.create` | écriture |
| `update_folder` | `PATCH /api/v1/folders/{folder}` | `folder.update` | écriture |
| `delete_folder` | `DELETE /api/v1/folders/{folder}` | `folder.delete` | écriture |
| `list_variables` | `GET /api/v1/variables` | `variable.read` | lecture |
| `create_variable` | `POST /api/v1/variables` | `variable.create` | écriture |
| `update_variable` | `PUT /api/v1/variables/{variable}` | `variable.update` | écriture |
| `delete_variable` | `DELETE /api/v1/variables/{variable}` | `variable.delete` | écriture |
| `list_executions` | `GET /api/v1/executions` | `execution.read` | lecture |
| `get_execution` | `GET /api/v1/executions/{execution}` | `execution.read` | lecture |
| `get_step_output` | `GET /api/v1/executions/{execution}/steps/{step}/output` | `execution.read` | lecture |
| `get_insights` | `GET /api/v1/insights` | `execution.read` | lecture |
| `stop_execution` | `POST /api/v1/executions/{execution}/stop` | `execution.stop` | écriture |
| `retry_execution` | `POST /api/v1/executions/{execution}/retry` | `execution.retry` | écriture |
| `replay_execution` | `POST /api/v1/executions/{execution}/replay` | `execution.retry` | écriture |
| `delete_execution` | `DELETE /api/v1/executions/{execution}` | `execution.delete` | écriture |
| `annotate_execution` | `PUT /api/v1/executions/{execution}/annotation` | `execution.annotate` | écriture |
| `clear_annotation` | `DELETE /api/v1/executions/{execution}/annotation` | `execution.annotate` | écriture |
| `list_credential_types` | `GET /api/v1/credential-types` | toute clé connectée | lecture |
| `list_credentials` | `GET /api/v1/credentials` | `credential.list` | lecture |
| `get_credential` | `GET /api/v1/credentials/{credential}` | `credential.read` | lecture |
| `start_oauth` | `POST /api/v1/credentials/{credential}/oauth/start` | `credential.update` | écriture |
| `create_credential` | `POST /api/v1/credentials` | `credential.create` | écriture |
| `update_credential` | `PATCH /api/v1/credentials/{credential}` | `credential.update` | écriture |
| `delete_credential` | `DELETE /api/v1/credentials/{credential}` | `credential.delete` | écriture |
| `share_credential` | `PUT /api/v1/credentials/{credential}/shares/{project}` | `credential.share` | écriture |
| `unshare_credential` | `DELETE /api/v1/credentials/{credential}/shares/{project}` | `credential.share` | écriture |
| `create_role` | `POST /api/v1/roles` | `role.manage` | écriture |
| `update_role` | `PUT /api/v1/roles/{role}` | `role.manage` | écriture |
| `delete_role` | `DELETE /api/v1/roles/{role}` | `role.manage` | écriture |
| `list_redaction_policies` | `GET /api/v1/redaction-policies` | toute clé connectée | lecture |
| `create_redaction_policy` | `POST /api/v1/redaction-policies` | `redaction.manage` | écriture |
| `update_redaction_policy` | `PUT /api/v1/redaction-policies/{policy}` | `redaction.manage` | écriture |
| `delete_redaction_policy` | `DELETE /api/v1/redaction-policies/{policy}` | `redaction.manage` | écriture |
| `list_secret_providers` | `GET /api/v1/secret-providers` | toute clé connectée | lecture |
| `test_secret_provider` | `POST /api/v1/secret-providers/{provider}/test` | `secrets.manage` | écriture |
| `list_log_destinations` | `GET /api/v1/log-destinations` | `logstream.manage` | lecture |
| `test_log_destination` | `POST /api/v1/log-destinations/{destination}/test` | `logstream.manage` | écriture |
| `list_keys` | `GET /api/v1/api-keys` | toute clé connectée | lecture |
| `revoke_key` | `DELETE /api/v1/api-keys/{key}` | toute clé connectée | écriture |
| `list_scim_tokens` | `GET /api/v1/scim-tokens` | `scim.manage` | lecture |
| `revoke_scim_token` | `DELETE /api/v1/scim-tokens/{token}` | `scim.manage` | écriture |
| `list_users` | `GET /api/v1/users` | `user.manage` | lecture |
| `create_user` | `POST /api/v1/users` | `user.manage` | écriture |
| `change_user` | `PATCH /api/v1/users/{user}` | `user.manage` | écriture |
| `list_audit` | `GET /api/v1/audit` | `audit.read` | lecture |
| `verify_audit` | `GET /api/v1/audit/verify` | `audit.read` | lecture |
| `get_settings` | `GET /api/v1/settings` | `instance.settings` | lecture |
| `change_settings` | `PATCH /api/v1/settings` | `instance.settings` | écriture |
| `describe_tool_body` | pas une route : le schéma JSON que prend le corps d'un outil | toute clé connectée | lecture |

## Laissé de côté volontairement

Dix routes écartent d'elles-mêmes une clé, parce qu'elles veulent une personne connectée, et le serveur MCP ne fait pas semblant du contraire : créer une clé d'API, créer une clé de compte de service, créer un jeton SCIM, ajouter, modifier et supprimer un fournisseur de secrets externe, ajouter, modifier et supprimer une destination de journaux, et le mot de passe d'une personne. Une clé qui pourrait fabriquer des clés, ou changer la destination du journal d'audit, est une clé volée qui peut se maintenir en vie. Chacune de ces routes serait un outil qui ne répondrait jamais que « non autorisé », donc aucune n'est proposée. Tout le reste est un outil : lister les destinations de journaux, les fournisseurs de secrets et les jetons SCIM, révoquer un jeton SCIM, tester un fournisseur ou une destination, lister et révoquer des clés, ouvrir le webhook de test d'un flux de travail et lancer une connexion OAuth2, qui renvoie l'adresse qu'une personne ouvre ensuite. Une clé peut se révoquer elle-même, ce que celui qui détient une clé volée devrait pouvoir faire en premier.

`/api/v1/openapi.json` n'est pas un outil : `describe_tool_body` donne les corps.
