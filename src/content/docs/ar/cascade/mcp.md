---
title: "خادم MCP"
description: "لدى Cascade خادم MCP يقرأ ويكتب: 83 أداة، كل منها مسار API يمر عبر معالجه الخاص، مع إذنه وسببه وسطر تدقيق."
---

:::note[يشمل أيضًا ما هو قادم]
تشمل هذه الصفحة أيضًا بعض الأمور الأحدث من HotLoop Cascade 1.4.2، وهو أحدث إصدار. قد لا يكون بعضها في ما ثبّتّه. تبيّن [ملاحظات الإصدار](/ar/releases/) ما الذي تغيّر.
:::

لدى Cascade خادم MCP، وهو يقرأ ويكتب. يُشحن مفعّلًا، على `/mcp` في العنوان نفسه الخاص بـ API والمحرر، ويستطيع الوكيل الذي يتصل به أن يفعل ما يستطيعه صاحب مفتاحه، ولا شيء بعد ذلك. لا يوجد وضع للقراءة فقط تحتاج إلى الالتفاف حوله، لأن الخادم الذي يستطيع الوكيل أن ينظر إليه ولا يلمسه ليس سوى صفحة حالة، ولديك واحدة بالفعل.

84 أداة، وكل واحدة منها مسار من مسارات REST API. لا يمرّ الاستدعاء بجانب المسار بل عبره: يتحقق معالج المسار نفسه من الإذن، ويتحقق من صحة المحتوى، وينفّذ التغيير، ويكتب سطر التدقيق. لم يُنسخ إلى خادم MCP شيء قد ينحرف، ولم يُترك خارجه شيء ليُتجاوَز.

وما معنى ذلك لك: إن كان سير العمل أو بيانات الاعتماد أو المشروع أو الشخص شيئًا تستطيع تغييره من المحرر، فيستطيع وكيل يحمل مفتاحك تغييره أيضًا، ضمن حدود دورك، ويذكر سجل التدقيق أنه كان وكيلًا وأي وكيل.

## الاتصال

أنشئ مفتاحًا. في المحرر يوجد تحت حسابك، أو عبر API:

```sh
curl -s -X POST https://cascade.plant.example/api/v1/api-keys \
  -H "X-CSRF-Token: $CSRF" -b cookies.txt -H 'Content-Type: application/json' \
  -d '{"name":"line 4 agent","scopes":["*"],"days":30}'
```

يعود الرمز مرة واحدة ويبدأ بـ `hlc_`. يفعل المفتاح ما يستطيعه حامله، مقصورًا على نطاقاته: أعطِ الوكيل `["workflow.read","execution.read"]` فيستطيع أن ينظر ولا يلمس. ومفتاح حساب الخدمة (مشروع واحد ودور واحد، ينشئه مدير المشروع) يعمل بالطريقة نفسها وهو المفتاح المناسب لتكامل دائم.

ثم وجّه العميل إلى `/mcp` وأرسل المفتاح كرمز bearer. وسيلة النقل التي يتكلمها هي HTTP القابل للبث:

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

الطلب الذي لا مفتاح معه، أو معه مفتاح خاطئ أو مُبطَل أو منتهٍ، أو مفتاح شخص عُطِّل حسابه، يتلقى 401 قبل أن يصل إلى أي أداة، والمفتاح الذي يُبطَل في منتصف جلسة يتوقف عن العمل عند استدعائه التالي.

## القواعد

**الأذونات هي أذونات المسار.** يخبرك `whoami` بالمشاريع التي يراها المفتاح ودوره في كل منها. والأداة التي لا يحق للمفتاح استخدامها تُرفض بسبب المسار نفسه: 403 لإذن ينقصه، و404 لشيء لا يراه، وهو الجواب نفسه الذي تعطيه REST API. هذا قرار وليس عطلًا يُلتف حوله.

**الكتابة تحتاج إلى سبب.** تأخذ كل أداة تغيّر شيئًا حقلًا `reason` وترفض من دونه. ويُكتب في سجل التدقيق مع مفتاحك والاسم الذي سمّى به عميلك نفسه.

**الأسرار تبقى في مكانها.** لا تعيد أي أداة حقل السر في بيانات الاعتماد إلى أي مفتاح، وبيانات الاعتماد المنشأة عبر MCP تُختم أسرارها في الخزنة لحظة وصولها. و`get_credential` هو العرض نفسه الخالي من الأسرار الذي يراه نموذج التحرير.

**المفتاحان للنشر.** إعدادان في البيئة التي يبدأ فيها الخادم، لا يستطيع تغييرهما أي استدعاء API ولا أي وكيل:

| الإعداد | الافتراضي | وظيفته |
|---|---|---|
| `HOTLOOP_CASCADE_MCP` | `true` | مع `false` لا يوجد `/mcp`. |
| `HOTLOOP_CASCADE_MCP_WRITES` | `true` | مع `false` ترفض كل أداة تغيّر أي شيء، وتبقى أدوات القراءة تعمل. |

لا يعرف `PATCH /settings` أيًّا منهما، فالوكيل الذي يحق له تحرير الإعدادات لا يستطيع مع ذلك إعادة تشغيل الكتابة.

**لا يكتب أبدًا على المعدات.** يبدأ `run_workflow` تشغيلًا حقيقيًا، وما تفعله خطواته بالأنظمة التي تستدعيها متروك للخطوات. وكل ما يحرّك صمامًا أو يغيّر قيمة مستهدفة يمر عبر بوابة الكتابة في HotLoop، فيراه تدقيق تلك البوابة أيًّا كان من بدأ سير العمل.

## ما يقوله سجل التدقيق

سطران لكل عملية كتابة. سطر المسار نفسه يكون الوكيل فيه هو الفاعل، بنوع `mcp`، والمفتاح، ولمن هو، والعميل:

```
actor:  mcp, "line 4 agent (ops@plant.example) via claude-desktop"
action: workflow.created
```

وسطر واحد للأداة، مع السبب، يُكتب سواء قال المسار نعم أو رفض:

```
action: mcp.write   target: create_workflow
detail: {"reason": "the line 4 oven needs a setpoint workflow", "method": "POST", "path": "/api/v1/workflows", "status": 201}
```

يعرض `list_audit` مع `action=mcp.write` كل تغيير أجراه وكيل ولماذا.

## الأدوات

كل سطر هو مسار حقيقي والإذن الذي يطلبه ذلك المسار، ويُبقي اختبار الجدول مطابقًا لكليهما. والإذن إما إذن مشروع (يُفحص في المشروع الذي يوجد فيه الشيء) أو إذن نسخة (للمالكين والمديرين). ويستطيع أي مفتاح مسجَّل الدخول أن يطلب ما وُسم هكذا.

تأخذ الأدوات ذات المتن حقلًا `body`، وهو JSON نفسه الذي تقبله REST API. ويعطي `describe_tool_body` مخطط أي أداة، ليكون الاستدعاء الأول صحيحًا.

| الأداة | المسار | الإذن | النوع |
|---|---|---|---|
| `get_version` | `GET /api/v1/version` | أي مفتاح مسجَّل الدخول | قراءة |
| `whoami` | `GET /api/v1/me` | أي مفتاح مسجَّل الدخول | قراءة |
| `list_permissions` | `GET /api/v1/permissions` | أي مفتاح مسجَّل الدخول | قراءة |
| `list_roles` | `GET /api/v1/roles` | أي مفتاح مسجَّل الدخول | قراءة |
| `get_role` | `GET /api/v1/roles/{role}` | أي مفتاح مسجَّل الدخول | قراءة |
| `list_projects` | `GET /api/v1/projects` | `project.read` | قراءة |
| `get_project` | `GET /api/v1/projects/{project}` | `project.read` | قراءة |
| `create_project` | `POST /api/v1/projects` | `project.create` | كتابة |
| `rename_project` | `PATCH /api/v1/projects/{project}` | `project.update` | كتابة |
| `delete_project` | `DELETE /api/v1/projects/{project}` | `project.delete` | كتابة |
| `list_members` | `GET /api/v1/projects/{project}/members` | `project.read` | قراءة |
| `set_member` | `PUT /api/v1/projects/{project}/members/{user}` | `project.members` | كتابة |
| `remove_member` | `DELETE /api/v1/projects/{project}/members/{user}` | `project.members` | كتابة |
| `list_service_accounts` | `GET /api/v1/projects/{project}/service-accounts` | `project.members` | قراءة |
| `list_workflows` | `GET /api/v1/workflows` | `workflow.read` | قراءة |
| `get_workflow` | `GET /api/v1/workflows/{workflow}` | `workflow.read` | قراءة |
| `create_workflow` | `POST /api/v1/workflows` | `workflow.create` | كتابة |
| `save_workflow` | `PUT /api/v1/workflows/{workflow}` | `workflow.update` | كتابة |
| `delete_workflow` | `DELETE /api/v1/workflows/{workflow}` | `workflow.delete` | كتابة |
| `listen_workflow` | `POST /api/v1/workflows/{workflow}/listen` | `workflow.execute` | كتابة |
| `activate_workflow` | `POST /api/v1/workflows/{workflow}/activate` | `workflow.activate` | كتابة |
| `deactivate_workflow` | `POST /api/v1/workflows/{workflow}/deactivate` | `workflow.activate` | كتابة |
| `run_workflow` | `POST /api/v1/workflows/{workflow}/run` | `workflow.execute` | كتابة |
| `move_workflow` | `PUT /api/v1/workflows/{workflow}/folder` | `workflow.update` | كتابة |
| `list_workflow_versions` | `GET /api/v1/workflows/{workflow}/versions` | `workflow.read` | قراءة |
| `get_workflow_version` | `GET /api/v1/workflows/{workflow}/versions/{version}` | `workflow.read` | قراءة |
| `diff_workflow_versions` | `GET /api/v1/workflows/{workflow}/diff` | `workflow.read` | قراءة |
| `restore_workflow_version` | `POST /api/v1/workflows/{workflow}/versions/{version}/restore` | `workflow.update` | كتابة |
| `label_workflow_version` | `PUT /api/v1/workflows/{workflow}/versions/{version}/label` | `workflow.update` | كتابة |
| `preview_expression` | `POST /api/v1/workflows/{workflow}/preview` | `workflow.read` | قراءة |
| `list_expression_functions` | `GET /api/v1/expression/functions` | أي مفتاح مسجَّل الدخول | قراءة |
| `list_step_types` | `GET /api/v1/step-types` | أي مفتاح مسجَّل الدخول | قراءة |
| `shape_step` | `POST /api/v1/step-types/{type}/{version}/shape` | أي مفتاح مسجَّل الدخول | قراءة |
| `list_folders` | `GET /api/v1/folders` | `folder.read` | قراءة |
| `create_folder` | `POST /api/v1/folders` | `folder.create` | كتابة |
| `update_folder` | `PATCH /api/v1/folders/{folder}` | `folder.update` | كتابة |
| `delete_folder` | `DELETE /api/v1/folders/{folder}` | `folder.delete` | كتابة |
| `list_variables` | `GET /api/v1/variables` | `variable.read` | قراءة |
| `create_variable` | `POST /api/v1/variables` | `variable.create` | كتابة |
| `update_variable` | `PUT /api/v1/variables/{variable}` | `variable.update` | كتابة |
| `delete_variable` | `DELETE /api/v1/variables/{variable}` | `variable.delete` | كتابة |
| `list_executions` | `GET /api/v1/executions` | `execution.read` | قراءة |
| `get_execution` | `GET /api/v1/executions/{execution}` | `execution.read` | قراءة |
| `get_step_output` | `GET /api/v1/executions/{execution}/steps/{step}/output` | `execution.read` | قراءة |
| `get_insights` | `GET /api/v1/insights` | `execution.read` | قراءة |
| `stop_execution` | `POST /api/v1/executions/{execution}/stop` | `execution.stop` | كتابة |
| `retry_execution` | `POST /api/v1/executions/{execution}/retry` | `execution.retry` | كتابة |
| `replay_execution` | `POST /api/v1/executions/{execution}/replay` | `execution.retry` | كتابة |
| `delete_execution` | `DELETE /api/v1/executions/{execution}` | `execution.delete` | كتابة |
| `annotate_execution` | `PUT /api/v1/executions/{execution}/annotation` | `execution.annotate` | كتابة |
| `clear_annotation` | `DELETE /api/v1/executions/{execution}/annotation` | `execution.annotate` | كتابة |
| `list_credential_types` | `GET /api/v1/credential-types` | أي مفتاح مسجَّل الدخول | قراءة |
| `list_credentials` | `GET /api/v1/credentials` | `credential.list` | قراءة |
| `get_credential` | `GET /api/v1/credentials/{credential}` | `credential.read` | قراءة |
| `start_oauth` | `POST /api/v1/credentials/{credential}/oauth/start` | `credential.update` | كتابة |
| `create_credential` | `POST /api/v1/credentials` | `credential.create` | كتابة |
| `update_credential` | `PATCH /api/v1/credentials/{credential}` | `credential.update` | كتابة |
| `delete_credential` | `DELETE /api/v1/credentials/{credential}` | `credential.delete` | كتابة |
| `share_credential` | `PUT /api/v1/credentials/{credential}/shares/{project}` | `credential.share` | كتابة |
| `unshare_credential` | `DELETE /api/v1/credentials/{credential}/shares/{project}` | `credential.share` | كتابة |
| `create_role` | `POST /api/v1/roles` | `role.manage` | كتابة |
| `update_role` | `PUT /api/v1/roles/{role}` | `role.manage` | كتابة |
| `delete_role` | `DELETE /api/v1/roles/{role}` | `role.manage` | كتابة |
| `list_redaction_policies` | `GET /api/v1/redaction-policies` | أي مفتاح مسجَّل الدخول | قراءة |
| `create_redaction_policy` | `POST /api/v1/redaction-policies` | `redaction.manage` | كتابة |
| `update_redaction_policy` | `PUT /api/v1/redaction-policies/{policy}` | `redaction.manage` | كتابة |
| `delete_redaction_policy` | `DELETE /api/v1/redaction-policies/{policy}` | `redaction.manage` | كتابة |
| `list_secret_providers` | `GET /api/v1/secret-providers` | أي مفتاح مسجَّل الدخول | قراءة |
| `test_secret_provider` | `POST /api/v1/secret-providers/{provider}/test` | `secrets.manage` | كتابة |
| `list_log_destinations` | `GET /api/v1/log-destinations` | `logstream.manage` | قراءة |
| `test_log_destination` | `POST /api/v1/log-destinations/{destination}/test` | `logstream.manage` | كتابة |
| `list_keys` | `GET /api/v1/api-keys` | أي مفتاح مسجَّل الدخول | قراءة |
| `revoke_key` | `DELETE /api/v1/api-keys/{key}` | أي مفتاح مسجَّل الدخول | كتابة |
| `list_scim_tokens` | `GET /api/v1/scim-tokens` | `scim.manage` | قراءة |
| `revoke_scim_token` | `DELETE /api/v1/scim-tokens/{token}` | `scim.manage` | كتابة |
| `list_users` | `GET /api/v1/users` | `user.manage` | قراءة |
| `create_user` | `POST /api/v1/users` | `user.manage` | كتابة |
| `change_user` | `PATCH /api/v1/users/{user}` | `user.manage` | كتابة |
| `delete_user` | `DELETE /api/v1/users/{user}` | `user.manage` | كتابة، للمالك فقط |
| `list_audit` | `GET /api/v1/audit` | `audit.read` | قراءة |
| `verify_audit` | `GET /api/v1/audit/verify` | `audit.read` | قراءة |
| `get_settings` | `GET /api/v1/settings` | `instance.settings` | قراءة |
| `change_settings` | `PATCH /api/v1/settings` | `instance.settings` | كتابة |
| `describe_tool_body` | ليس مسارًا: مخطط JSON الذي يقبله متن الأداة | أي مفتاح مسجَّل الدخول | قراءة |

## متروك عمدًا

عشرة مسارات ترفض المفتاح بنفسها، لأنها تريد شخصًا مسجَّل الدخول، ولا يتظاهر خادم MCP بخلاف ذلك: إنشاء مفتاح API، وإنشاء مفتاح حساب خدمة، وإنشاء رمز SCIM، وإضافة مزود أسرار خارجي وتغييره وحذفه، وإضافة وجهة سجلات وتغييرها وحذفها، وكلمة مرور الشخص نفسه. المفتاح الذي يستطيع سكّ المفاتيح، أو تغيير وجهة إرسال سجل التدقيق، هو مفتاح مسرَّب يستطيع إبقاء نفسه حيًا. وكل واحد منها سيكون أداة لا تجيب إلا «غير مسموح»، فلا يُعرض أي منها. وكل ما عدا ذلك أداة: سرد وجهات السجلات ومزودي الأسرار ورموز SCIM، وإبطال رمز SCIM، واختبار مزود أو وجهة، وسرد المفاتيح وإبطالها، وفتح webhook الاختبار لسير عمل، وبدء تسجيل دخول OAuth2، الذي يعيد العنوان الذي يفتحه شخص بعد ذلك. ويستطيع المفتاح إبطال نفسه، وهو أول ما ينبغي أن يقدر عليه من يحمل مفتاحًا مسرَّبًا.

`/api/v1/openapi.json` ليس أداة: يعطي `describe_tool_body` المتون.
