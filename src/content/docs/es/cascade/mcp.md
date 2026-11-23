---
title: "El servidor MCP"
description: "Cascade tiene un servidor MCP que lee y escribe: 83 herramientas, cada una una ruta de la API con su propio manejador, permiso, motivo y fila de auditoría."
---

:::note[Incluye lo que viene]
Esta página también recoge algunas cosas más nuevas que HotLoop Cascade 1.4.2, la última versión publicada. Es posible que parte de ello no esté en lo que usted tiene instalado. Las [notas de la versión](/es/releases/) dicen qué ha cambiado.
:::

Cascade tiene un servidor MCP, y lee y escribe. Se entrega activado, en `/mcp`, en la misma dirección que la API y el editor, y un agente que se conecta a él puede hacer lo que puede hacer la persona dueña de su clave y nada más. No hay un modo de solo lectura que rodear, porque un servidor que un agente puede mirar y no tocar es una página de estado, y ya tiene una.

84 herramientas, y cada una de ellas es una ruta de la API REST. Una llamada no va junto a la ruta, va a través de ella: el propio manejador de la ruta comprueba el permiso, valida el cuerpo, hace el cambio y escribe la fila de auditoría. No se copió nada en el servidor MCP que pueda desviarse, y no se dejó nada fuera de él para saltarse algo.

Lo que significa para usted: si un flujo de trabajo, una credencial, un proyecto o una persona es algo que puede cambiar desde el editor, un agente con su clave también puede cambiarlo, con los límites de su rol, y el registro de auditoría dice que fue un agente y cuál.

## Conectar

Cree una clave. En el editor está en su cuenta, o con la API:

```sh
curl -s -X POST https://cascade.plant.example/api/v1/api-keys \
  -H "X-CSRF-Token: $CSRF" -b cookies.txt -H 'Content-Type: application/json' \
  -d '{"name":"line 4 agent","scopes":["*"],"days":30}'
```

El token se devuelve una sola vez y empieza por `hlc_`. Una clave hace lo que podría hacer su titular, recortado a sus ámbitos: dele a un agente `["workflow.read","execution.read"]` y podrá mirar y no tocar. Una clave de cuenta de servicio (un proyecto, un rol, creada por un administrador del proyecto) funciona igual y es la clave adecuada para una integración permanente.

Después apunte el cliente a `/mcp` y envíe la clave como token bearer. El transporte que habla es HTTP en streaming:

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

Una petición sin clave, con una incorrecta, con una revocada o caducada, o cuya persona ha sido desactivada recibe un 401 antes de llegar a ninguna herramienta, y una clave revocada en mitad de una sesión deja de funcionar en su siguiente llamada.

## Las reglas

**Los permisos son los de la ruta.** `whoami` dice qué proyectos puede ver la clave y su rol en cada uno. Una herramienta que la clave no puede usar se rechaza con el motivo de la propia ruta: 403 por un permiso que le falta, 404 por algo que no puede ver, que es la misma respuesta que da la API REST. Es una decisión, no un fallo que haya que rodear.

**Una escritura necesita un motivo.** Toda herramienta que cambia algo recibe un `reason` y se niega sin él. Se escribe en el registro de auditoría con su clave y el nombre que se dio su cliente.

**Los secretos no se mueven.** Ninguna herramienta devuelve el campo secreto de una credencial, a ninguna clave, y una credencial creada por MCP tiene sus secretos sellados en la bóveda a medida que llegan. `get_credential` es la misma vista sin secretos que tiene el formulario de edición.

**Los interruptores son del despliegue.** Dos ajustes, en el entorno en que arranca el servidor, que no puede cambiar ninguna llamada de API ni ningún agente:

| Ajuste | Valor predeterminado | Qué hace |
|---|---|---|
| `HOTLOOP_CASCADE_MCP` | `true` | Con `false`, `/mcp` no existe. |
| `HOTLOOP_CASCADE_MCP_WRITES` | `true` | Con `false`, toda herramienta que cambie algo se niega, y las que leen siguen funcionando. |

`PATCH /settings` no conoce ninguno de los dos, así que un agente que puede editar los ajustes sigue sin poder volver a activar las escrituras.

**Nunca escribe en los equipos.** `run_workflow` inicia una ejecución real, y lo que sus pasos hagan a los sistemas a los que llaman depende de los pasos. Todo lo que mueve una válvula o cambia una consigna pasa por la puerta de escritura de HotLoop, de modo que la auditoría de esa puerta lo ve, quien sea que iniciara el flujo de trabajo.

## Qué dice el registro de auditoría

Dos filas por cada escritura. La fila de la propia ruta tiene al agente como actor, con el tipo `mcp`, la clave, de quién es y el cliente:

```
actor:  mcp, "line 4 agent (ops@plant.example) via claude-desktop"
action: workflow.created
```

Y una fila de la herramienta, con el motivo, escrita tanto si la ruta dijo que sí como si se negó:

```
action: mcp.write   target: create_workflow
detail: {"reason": "the line 4 oven needs a setpoint workflow", "method": "POST", "path": "/api/v1/workflows", "status": 201}
```

`list_audit` con `action=mcp.write` es todo cambio que hizo un agente y por qué.

## Las herramientas

Cada fila es una ruta real y el permiso que esa ruta pide, y una prueba mantiene la tabla fiel a ambos. Un permiso es de proyecto (se comprueba en el proyecto en que está el recurso) o de instancia (propietarios y administradores). Cualquier clave con sesión puede pedir las marcadas así.

Las herramientas con cuerpo reciben un `body`, el mismo JSON que acepta la API REST. `describe_tool_body` da el esquema de cualquier herramienta, para acertar a la primera.

| Herramienta | Ruta | Permiso | Tipo |
|---|---|---|---|
| `get_version` | `GET /api/v1/version` | cualquier clave con sesión | lectura |
| `whoami` | `GET /api/v1/me` | cualquier clave con sesión | lectura |
| `list_permissions` | `GET /api/v1/permissions` | cualquier clave con sesión | lectura |
| `list_roles` | `GET /api/v1/roles` | cualquier clave con sesión | lectura |
| `get_role` | `GET /api/v1/roles/{role}` | cualquier clave con sesión | lectura |
| `list_projects` | `GET /api/v1/projects` | `project.read` | lectura |
| `get_project` | `GET /api/v1/projects/{project}` | `project.read` | lectura |
| `create_project` | `POST /api/v1/projects` | `project.create` | escritura |
| `rename_project` | `PATCH /api/v1/projects/{project}` | `project.update` | escritura |
| `delete_project` | `DELETE /api/v1/projects/{project}` | `project.delete` | escritura |
| `list_members` | `GET /api/v1/projects/{project}/members` | `project.read` | lectura |
| `set_member` | `PUT /api/v1/projects/{project}/members/{user}` | `project.members` | escritura |
| `remove_member` | `DELETE /api/v1/projects/{project}/members/{user}` | `project.members` | escritura |
| `list_service_accounts` | `GET /api/v1/projects/{project}/service-accounts` | `project.members` | lectura |
| `list_workflows` | `GET /api/v1/workflows` | `workflow.read` | lectura |
| `get_workflow` | `GET /api/v1/workflows/{workflow}` | `workflow.read` | lectura |
| `create_workflow` | `POST /api/v1/workflows` | `workflow.create` | escritura |
| `save_workflow` | `PUT /api/v1/workflows/{workflow}` | `workflow.update` | escritura |
| `delete_workflow` | `DELETE /api/v1/workflows/{workflow}` | `workflow.delete` | escritura |
| `listen_workflow` | `POST /api/v1/workflows/{workflow}/listen` | `workflow.execute` | escritura |
| `activate_workflow` | `POST /api/v1/workflows/{workflow}/activate` | `workflow.activate` | escritura |
| `deactivate_workflow` | `POST /api/v1/workflows/{workflow}/deactivate` | `workflow.activate` | escritura |
| `run_workflow` | `POST /api/v1/workflows/{workflow}/run` | `workflow.execute` | escritura |
| `move_workflow` | `PUT /api/v1/workflows/{workflow}/folder` | `workflow.update` | escritura |
| `list_workflow_versions` | `GET /api/v1/workflows/{workflow}/versions` | `workflow.read` | lectura |
| `get_workflow_version` | `GET /api/v1/workflows/{workflow}/versions/{version}` | `workflow.read` | lectura |
| `diff_workflow_versions` | `GET /api/v1/workflows/{workflow}/diff` | `workflow.read` | lectura |
| `restore_workflow_version` | `POST /api/v1/workflows/{workflow}/versions/{version}/restore` | `workflow.update` | escritura |
| `label_workflow_version` | `PUT /api/v1/workflows/{workflow}/versions/{version}/label` | `workflow.update` | escritura |
| `preview_expression` | `POST /api/v1/workflows/{workflow}/preview` | `workflow.read` | lectura |
| `list_expression_functions` | `GET /api/v1/expression/functions` | cualquier clave con sesión | lectura |
| `list_step_types` | `GET /api/v1/step-types` | cualquier clave con sesión | lectura |
| `shape_step` | `POST /api/v1/step-types/{type}/{version}/shape` | cualquier clave con sesión | lectura |
| `list_folders` | `GET /api/v1/folders` | `folder.read` | lectura |
| `create_folder` | `POST /api/v1/folders` | `folder.create` | escritura |
| `update_folder` | `PATCH /api/v1/folders/{folder}` | `folder.update` | escritura |
| `delete_folder` | `DELETE /api/v1/folders/{folder}` | `folder.delete` | escritura |
| `list_variables` | `GET /api/v1/variables` | `variable.read` | lectura |
| `create_variable` | `POST /api/v1/variables` | `variable.create` | escritura |
| `update_variable` | `PUT /api/v1/variables/{variable}` | `variable.update` | escritura |
| `delete_variable` | `DELETE /api/v1/variables/{variable}` | `variable.delete` | escritura |
| `list_executions` | `GET /api/v1/executions` | `execution.read` | lectura |
| `get_execution` | `GET /api/v1/executions/{execution}` | `execution.read` | lectura |
| `get_step_output` | `GET /api/v1/executions/{execution}/steps/{step}/output` | `execution.read` | lectura |
| `get_insights` | `GET /api/v1/insights` | `execution.read` | lectura |
| `stop_execution` | `POST /api/v1/executions/{execution}/stop` | `execution.stop` | escritura |
| `retry_execution` | `POST /api/v1/executions/{execution}/retry` | `execution.retry` | escritura |
| `replay_execution` | `POST /api/v1/executions/{execution}/replay` | `execution.retry` | escritura |
| `delete_execution` | `DELETE /api/v1/executions/{execution}` | `execution.delete` | escritura |
| `annotate_execution` | `PUT /api/v1/executions/{execution}/annotation` | `execution.annotate` | escritura |
| `clear_annotation` | `DELETE /api/v1/executions/{execution}/annotation` | `execution.annotate` | escritura |
| `list_credential_types` | `GET /api/v1/credential-types` | cualquier clave con sesión | lectura |
| `list_credentials` | `GET /api/v1/credentials` | `credential.list` | lectura |
| `get_credential` | `GET /api/v1/credentials/{credential}` | `credential.read` | lectura |
| `start_oauth` | `POST /api/v1/credentials/{credential}/oauth/start` | `credential.update` | escritura |
| `create_credential` | `POST /api/v1/credentials` | `credential.create` | escritura |
| `update_credential` | `PATCH /api/v1/credentials/{credential}` | `credential.update` | escritura |
| `delete_credential` | `DELETE /api/v1/credentials/{credential}` | `credential.delete` | escritura |
| `share_credential` | `PUT /api/v1/credentials/{credential}/shares/{project}` | `credential.share` | escritura |
| `unshare_credential` | `DELETE /api/v1/credentials/{credential}/shares/{project}` | `credential.share` | escritura |
| `create_role` | `POST /api/v1/roles` | `role.manage` | escritura |
| `update_role` | `PUT /api/v1/roles/{role}` | `role.manage` | escritura |
| `delete_role` | `DELETE /api/v1/roles/{role}` | `role.manage` | escritura |
| `list_redaction_policies` | `GET /api/v1/redaction-policies` | cualquier clave con sesión | lectura |
| `create_redaction_policy` | `POST /api/v1/redaction-policies` | `redaction.manage` | escritura |
| `update_redaction_policy` | `PUT /api/v1/redaction-policies/{policy}` | `redaction.manage` | escritura |
| `delete_redaction_policy` | `DELETE /api/v1/redaction-policies/{policy}` | `redaction.manage` | escritura |
| `list_secret_providers` | `GET /api/v1/secret-providers` | cualquier clave con sesión | lectura |
| `test_secret_provider` | `POST /api/v1/secret-providers/{provider}/test` | `secrets.manage` | escritura |
| `list_log_destinations` | `GET /api/v1/log-destinations` | `logstream.manage` | lectura |
| `test_log_destination` | `POST /api/v1/log-destinations/{destination}/test` | `logstream.manage` | escritura |
| `list_keys` | `GET /api/v1/api-keys` | cualquier clave con sesión | lectura |
| `revoke_key` | `DELETE /api/v1/api-keys/{key}` | cualquier clave con sesión | escritura |
| `list_scim_tokens` | `GET /api/v1/scim-tokens` | `scim.manage` | lectura |
| `revoke_scim_token` | `DELETE /api/v1/scim-tokens/{token}` | `scim.manage` | escritura |
| `list_users` | `GET /api/v1/users` | `user.manage` | lectura |
| `create_user` | `POST /api/v1/users` | `user.manage` | escritura |
| `change_user` | `PATCH /api/v1/users/{user}` | `user.manage` | escritura |
| `delete_user` | `DELETE /api/v1/users/{user}` | `user.manage` | escritura, solo el propietario |
| `list_audit` | `GET /api/v1/audit` | `audit.read` | lectura |
| `verify_audit` | `GET /api/v1/audit/verify` | `audit.read` | lectura |
| `get_settings` | `GET /api/v1/settings` | `instance.settings` | lectura |
| `change_settings` | `PATCH /api/v1/settings` | `instance.settings` | escritura |
| `describe_tool_body` | no es una ruta: el esquema JSON que acepta el cuerpo de una herramienta | cualquier clave con sesión | lectura |

## Dejado fuera a propósito

Diez rutas rechazan por sí mismas a una clave, porque quieren a una persona con sesión iniciada, y el servidor MCP no finge lo contrario: crear una clave de API, crear una clave de cuenta de servicio, crear un token SCIM, añadir, cambiar y eliminar un proveedor de secretos externo, añadir, cambiar y eliminar un destino de registros, y la contraseña de una persona. Una clave que pudiera acuñar claves, o cambiar adónde se envía el registro de auditoría, es una clave filtrada que puede mantenerse viva. Cada una de ellas sería una herramienta que solo respondería «no permitido», así que no se ofrece ninguna. Todo lo que está junto a ellas es una herramienta: listar los destinos de registros, los proveedores de secretos y los tokens SCIM, revocar un token SCIM, probar un proveedor o un destino, listar y revocar claves, abrir el webhook de prueba de un flujo de trabajo y empezar un inicio de sesión OAuth2, que devuelve la dirección que luego abre una persona. Una clave puede revocarse a sí misma, que es lo primero que debería poder hacer quien tiene una clave filtrada.

`/api/v1/openapi.json` no es una herramienta: `describe_tool_body` da los cuerpos.
