---
title: "MCP सर्वर"
description: "Cascade में एक MCP सर्वर है जो पढ़ता और लिखता है: 83 टूल, हर एक API रूट जो अपने हैंडलर, अनुमति, कारण और ऑडिट पंक्ति से होकर चलता है।"
---

Cascade में एक MCP सर्वर है, और वह पढ़ता भी है और लिखता भी। यह चालू आता है, `/mcp` पर, API और एडिटर वाले उसी पते पर, और इससे जुड़ने वाला एजेंट वही कर सकता है जो उसकी कुंजी के पीछे का व्यक्ति कर सकता है, उससे ज़्यादा कुछ नहीं। कोई केवल-पढ़ने वाला मोड नहीं है जिसके इर्द-गिर्द घूमना पड़े, क्योंकि जिस सर्वर को एजेंट देख तो सके पर छू न सके, वह एक स्टेटस पेज है, और वह आपके पास पहले से है।

84 टूल, और हर एक REST API का एक रूट है। कोई कॉल रूट के बगल से नहीं जाती, रूट के भीतर से जाती है: रूट का अपना हैंडलर अनुमति जांचता है, बॉडी को वैलिडेट करता है, बदलाव करता है और ऑडिट पंक्ति लिखता है। MCP सर्वर में ऐसा कुछ कॉपी नहीं हुआ जो अलग राह पकड़ ले, और उसमें से ऐसा कुछ छोड़ा नहीं गया जिसे लांघा जा सके।

आपके लिए इसका मतलब: अगर कोई वर्कफ़्लो, क्रेडेंशियल, प्रोजेक्ट या व्यक्ति ऐसी चीज़ है जिसे आप एडिटर से बदल सकते हैं, तो आपकी कुंजी रखने वाला एजेंट भी उसे बदल सकता है, आपकी भूमिका की सीमाओं के भीतर, और ऑडिट लॉग बताता है कि यह एजेंट था और कौन सा।

## जुड़ना

एक कुंजी बनाएँ। एडिटर में यह आपके खाते के नीचे है, या API से:

```sh
curl -s -X POST https://cascade.plant.example/api/v1/api-keys \
  -H "X-CSRF-Token: $CSRF" -b cookies.txt -H 'Content-Type: application/json' \
  -d '{"name":"line 4 agent","scopes":["*"],"days":30}'
```

टोकन एक ही बार लौटता है, और `hlc_` से शुरू होता है। कुंजी वही करती है जो उसका धारक कर सकता था, अपने स्कोप तक घटाकर: किसी एजेंट को `["workflow.read","execution.read"]` दें तो वह देख सकता है पर छू नहीं सकता। सर्विस खाते की कुंजी (एक प्रोजेक्ट, एक भूमिका, प्रोजेक्ट एडमिन की बनाई हुई) भी इसी तरह चलती है और स्थायी इंटीग्रेशन के लिए सही कुंजी है।

फिर क्लाइंट को `/mcp` की ओर करें और कुंजी को bearer टोकन के रूप में भेजें। जो ट्रांसपोर्ट वह बोलता है वह स्ट्रीम करने योग्य HTTP है:

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

बिना कुंजी वाला, गलत, रद्द या समाप्त हो चुकी कुंजी वाला, या ऐसे व्यक्ति की कुंजी वाला अनुरोध जिसे बंद कर दिया गया हो, किसी टूल तक पहुँचने से पहले 401 पाता है, और सत्र के बीच में रद्द की गई कुंजी अपनी अगली कॉल पर काम करना बंद कर देती है।

## नियम

**अनुमतियाँ रूट की होती हैं।** `whoami` बताता है कि कुंजी कौन से प्रोजेक्ट देख सकती है और हर एक में उसकी भूमिका क्या है। जिस टूल को कुंजी इस्तेमाल नहीं कर सकती, उसे रूट के अपने कारण के साथ मना किया जाता है: जो अनुमति उसके पास नहीं है उसके लिए 403, जो वह देख नहीं सकती उसके लिए 404, यानी वही जवाब जो REST API देता है। यह एक फ़ैसला है, ऐसी खराबी नहीं जिसके इर्द-गिर्द घूमा जाए।

**लिखने के लिए कारण चाहिए।** जो भी टूल कुछ बदलता है वह `reason` लेता है, और उसके बिना मना कर देता है। यह आपकी कुंजी और आपके क्लाइंट के अपने रखे नाम के साथ ऑडिट लॉग में लिखा जाता है।

**सीक्रेट अपनी जगह रहते हैं।** कोई टूल, किसी कुंजी को, क्रेडेंशियल का सीक्रेट फ़ील्ड नहीं लौटाता, और MCP से बना क्रेडेंशियल अपने सीक्रेट के पहुँचते ही तिजोरी में सील कर देता है। `get_credential` वही बिना-सीक्रेट वाला दृश्य है जो संपादन फ़ॉर्म में होता है।

**स्विच डिप्लॉयमेंट के हैं।** दो सेटिंग, उस एनवायरनमेंट में जिसमें सर्वर शुरू होता है, जिन्हें कोई API कॉल या एजेंट नहीं बदल सकता:

| सेटिंग | डिफ़ॉल्ट | क्या करती है |
|---|---|---|
| `HOTLOOP_CASCADE_MCP` | `true` | `false` पर `/mcp` नहीं रहता। |
| `HOTLOOP_CASCADE_MCP_WRITES` | `true` | `false` पर कुछ भी बदलने वाला हर टूल मना कर देता है, और पढ़ने वाले चलते रहते हैं। |

`PATCH /settings` इनमें से किसी को नहीं जानता, इसलिए सेटिंग संपादित कर सकने वाला एजेंट भी लिखना दोबारा चालू नहीं कर सकता।

**यह उपकरणों पर कभी नहीं लिखता।** `run_workflow` एक असली रन शुरू करता है, और उसके स्टेप जिन सिस्टम को बुलाते हैं उनके साथ क्या करते हैं, यह स्टेप पर निर्भर है। जो कुछ भी वाल्व हिलाता है या सेटपॉइंट बदलता है वह HotLoop के राइट गेट से गुज़रता है, इसलिए उस गेट का ऑडिट उसे देखता है, चाहे वर्कफ़्लो किसी ने भी शुरू किया हो।

## ऑडिट लॉग क्या कहता है

एक लिखने पर दो पंक्तियाँ। रूट की अपनी पंक्ति में एजेंट कर्ता है, प्रकार `mcp`, कुंजी, वह किसकी है और क्लाइंट:

```
actor:  mcp, "line 4 agent (ops@plant.example) via claude-desktop"
action: workflow.created
```

और टूल की एक पंक्ति, कारण के साथ, जो तब भी लिखी जाती है जब रूट ने हाँ कहा हो या मना किया हो:

```
action: mcp.write   target: create_workflow
detail: {"reason": "the line 4 oven needs a setpoint workflow", "method": "POST", "path": "/api/v1/workflows", "status": 201}
```

`action=mcp.write` के साथ `list_audit` वह हर बदलाव है जो किसी एजेंट ने किया और क्यों।

## टूल

हर पंक्ति एक असली रूट है और वह अनुमति जो वह रूट माँगता है, और एक टेस्ट तालिका को दोनों से मिलाकर रखता है। अनुमति या तो प्रोजेक्ट की होती है (उस प्रोजेक्ट में जाँची जाती है जिसमें वह चीज़ है) या इंस्टेंस की (मालिक और एडमिन)। साइन इन की गई कोई भी कुंजी वे माँग सकती है जिन पर ऐसा निशान है।

बॉडी वाले टूल एक `body` लेते हैं, वही JSON जो REST API लेता है। `describe_tool_body` किसी भी टूल का स्कीमा देता है, ताकि पहली कॉल सही हो।

| टूल | रूट | अनुमति | प्रकार |
|---|---|---|---|
| `get_version` | `GET /api/v1/version` | साइन इन की गई कोई भी कुंजी | पढ़ना |
| `whoami` | `GET /api/v1/me` | साइन इन की गई कोई भी कुंजी | पढ़ना |
| `list_permissions` | `GET /api/v1/permissions` | साइन इन की गई कोई भी कुंजी | पढ़ना |
| `list_roles` | `GET /api/v1/roles` | साइन इन की गई कोई भी कुंजी | पढ़ना |
| `get_role` | `GET /api/v1/roles/{role}` | साइन इन की गई कोई भी कुंजी | पढ़ना |
| `list_projects` | `GET /api/v1/projects` | `project.read` | पढ़ना |
| `get_project` | `GET /api/v1/projects/{project}` | `project.read` | पढ़ना |
| `create_project` | `POST /api/v1/projects` | `project.create` | लिखना |
| `rename_project` | `PATCH /api/v1/projects/{project}` | `project.update` | लिखना |
| `delete_project` | `DELETE /api/v1/projects/{project}` | `project.delete` | लिखना |
| `list_members` | `GET /api/v1/projects/{project}/members` | `project.read` | पढ़ना |
| `set_member` | `PUT /api/v1/projects/{project}/members/{user}` | `project.members` | लिखना |
| `remove_member` | `DELETE /api/v1/projects/{project}/members/{user}` | `project.members` | लिखना |
| `list_service_accounts` | `GET /api/v1/projects/{project}/service-accounts` | `project.members` | पढ़ना |
| `list_workflows` | `GET /api/v1/workflows` | `workflow.read` | पढ़ना |
| `get_workflow` | `GET /api/v1/workflows/{workflow}` | `workflow.read` | पढ़ना |
| `create_workflow` | `POST /api/v1/workflows` | `workflow.create` | लिखना |
| `save_workflow` | `PUT /api/v1/workflows/{workflow}` | `workflow.update` | लिखना |
| `delete_workflow` | `DELETE /api/v1/workflows/{workflow}` | `workflow.delete` | लिखना |
| `listen_workflow` | `POST /api/v1/workflows/{workflow}/listen` | `workflow.execute` | लिखना |
| `activate_workflow` | `POST /api/v1/workflows/{workflow}/activate` | `workflow.activate` | लिखना |
| `deactivate_workflow` | `POST /api/v1/workflows/{workflow}/deactivate` | `workflow.activate` | लिखना |
| `run_workflow` | `POST /api/v1/workflows/{workflow}/run` | `workflow.execute` | लिखना |
| `move_workflow` | `PUT /api/v1/workflows/{workflow}/folder` | `workflow.update` | लिखना |
| `list_workflow_versions` | `GET /api/v1/workflows/{workflow}/versions` | `workflow.read` | पढ़ना |
| `get_workflow_version` | `GET /api/v1/workflows/{workflow}/versions/{version}` | `workflow.read` | पढ़ना |
| `diff_workflow_versions` | `GET /api/v1/workflows/{workflow}/diff` | `workflow.read` | पढ़ना |
| `restore_workflow_version` | `POST /api/v1/workflows/{workflow}/versions/{version}/restore` | `workflow.update` | लिखना |
| `label_workflow_version` | `PUT /api/v1/workflows/{workflow}/versions/{version}/label` | `workflow.update` | लिखना |
| `preview_expression` | `POST /api/v1/workflows/{workflow}/preview` | `workflow.read` | पढ़ना |
| `list_expression_functions` | `GET /api/v1/expression/functions` | साइन इन की गई कोई भी कुंजी | पढ़ना |
| `list_step_types` | `GET /api/v1/step-types` | साइन इन की गई कोई भी कुंजी | पढ़ना |
| `shape_step` | `POST /api/v1/step-types/{type}/{version}/shape` | साइन इन की गई कोई भी कुंजी | पढ़ना |
| `list_folders` | `GET /api/v1/folders` | `folder.read` | पढ़ना |
| `create_folder` | `POST /api/v1/folders` | `folder.create` | लिखना |
| `update_folder` | `PATCH /api/v1/folders/{folder}` | `folder.update` | लिखना |
| `delete_folder` | `DELETE /api/v1/folders/{folder}` | `folder.delete` | लिखना |
| `list_variables` | `GET /api/v1/variables` | `variable.read` | पढ़ना |
| `create_variable` | `POST /api/v1/variables` | `variable.create` | लिखना |
| `update_variable` | `PUT /api/v1/variables/{variable}` | `variable.update` | लिखना |
| `delete_variable` | `DELETE /api/v1/variables/{variable}` | `variable.delete` | लिखना |
| `list_executions` | `GET /api/v1/executions` | `execution.read` | पढ़ना |
| `get_execution` | `GET /api/v1/executions/{execution}` | `execution.read` | पढ़ना |
| `get_step_output` | `GET /api/v1/executions/{execution}/steps/{step}/output` | `execution.read` | पढ़ना |
| `get_insights` | `GET /api/v1/insights` | `execution.read` | पढ़ना |
| `stop_execution` | `POST /api/v1/executions/{execution}/stop` | `execution.stop` | लिखना |
| `retry_execution` | `POST /api/v1/executions/{execution}/retry` | `execution.retry` | लिखना |
| `replay_execution` | `POST /api/v1/executions/{execution}/replay` | `execution.retry` | लिखना |
| `delete_execution` | `DELETE /api/v1/executions/{execution}` | `execution.delete` | लिखना |
| `annotate_execution` | `PUT /api/v1/executions/{execution}/annotation` | `execution.annotate` | लिखना |
| `clear_annotation` | `DELETE /api/v1/executions/{execution}/annotation` | `execution.annotate` | लिखना |
| `list_credential_types` | `GET /api/v1/credential-types` | साइन इन की गई कोई भी कुंजी | पढ़ना |
| `list_credentials` | `GET /api/v1/credentials` | `credential.list` | पढ़ना |
| `get_credential` | `GET /api/v1/credentials/{credential}` | `credential.read` | पढ़ना |
| `start_oauth` | `POST /api/v1/credentials/{credential}/oauth/start` | `credential.update` | लिखना |
| `create_credential` | `POST /api/v1/credentials` | `credential.create` | लिखना |
| `update_credential` | `PATCH /api/v1/credentials/{credential}` | `credential.update` | लिखना |
| `delete_credential` | `DELETE /api/v1/credentials/{credential}` | `credential.delete` | लिखना |
| `share_credential` | `PUT /api/v1/credentials/{credential}/shares/{project}` | `credential.share` | लिखना |
| `unshare_credential` | `DELETE /api/v1/credentials/{credential}/shares/{project}` | `credential.share` | लिखना |
| `create_role` | `POST /api/v1/roles` | `role.manage` | लिखना |
| `update_role` | `PUT /api/v1/roles/{role}` | `role.manage` | लिखना |
| `delete_role` | `DELETE /api/v1/roles/{role}` | `role.manage` | लिखना |
| `list_redaction_policies` | `GET /api/v1/redaction-policies` | साइन इन की गई कोई भी कुंजी | पढ़ना |
| `create_redaction_policy` | `POST /api/v1/redaction-policies` | `redaction.manage` | लिखना |
| `update_redaction_policy` | `PUT /api/v1/redaction-policies/{policy}` | `redaction.manage` | लिखना |
| `delete_redaction_policy` | `DELETE /api/v1/redaction-policies/{policy}` | `redaction.manage` | लिखना |
| `list_secret_providers` | `GET /api/v1/secret-providers` | साइन इन की गई कोई भी कुंजी | पढ़ना |
| `test_secret_provider` | `POST /api/v1/secret-providers/{provider}/test` | `secrets.manage` | लिखना |
| `list_log_destinations` | `GET /api/v1/log-destinations` | `logstream.manage` | पढ़ना |
| `test_log_destination` | `POST /api/v1/log-destinations/{destination}/test` | `logstream.manage` | लिखना |
| `list_keys` | `GET /api/v1/api-keys` | साइन इन की गई कोई भी कुंजी | पढ़ना |
| `revoke_key` | `DELETE /api/v1/api-keys/{key}` | साइन इन की गई कोई भी कुंजी | लिखना |
| `list_scim_tokens` | `GET /api/v1/scim-tokens` | `scim.manage` | पढ़ना |
| `revoke_scim_token` | `DELETE /api/v1/scim-tokens/{token}` | `scim.manage` | लिखना |
| `list_users` | `GET /api/v1/users` | `user.manage` | पढ़ना |
| `create_user` | `POST /api/v1/users` | `user.manage` | लिखना |
| `change_user` | `PATCH /api/v1/users/{user}` | `user.manage` | लिखना |
| `delete_user` | `DELETE /api/v1/users/{user}` | `user.manage` | राइट, केवल स्वामी |
| `list_audit` | `GET /api/v1/audit` | `audit.read` | पढ़ना |
| `verify_audit` | `GET /api/v1/audit/verify` | `audit.read` | पढ़ना |
| `get_settings` | `GET /api/v1/settings` | `instance.settings` | पढ़ना |
| `change_settings` | `PATCH /api/v1/settings` | `instance.settings` | लिखना |
| `describe_tool_body` | रूट नहीं है: वह JSON स्कीमा जो किसी टूल की बॉडी लेती है | साइन इन की गई कोई भी कुंजी | पढ़ना |

## जानबूझकर बाहर रखा गया

दस रूट खुद ही किसी कुंजी को लौटा देते हैं, क्योंकि उन्हें साइन इन किया हुआ व्यक्ति चाहिए, और MCP सर्वर इसका दिखावा नहीं करता: API कुंजी बनाना, सर्विस खाते की कुंजी बनाना, SCIM टोकन बनाना, बाहरी सीक्रेट प्रदाता जोड़ना, बदलना और हटाना, लॉग गंतव्य जोड़ना, बदलना और हटाना, और किसी व्यक्ति का अपना पासवर्ड। जो कुंजी कुंजियाँ गढ़ सके, या बदल सके कि ऑडिट लॉग कहाँ भेजा जाता है, वह लीक हुई कुंजी है जो खुद को ज़िंदा रख सकती है। इनमें से हर एक ऐसा टूल होता जो हमेशा केवल "अनुमति नहीं" जवाब देता, इसलिए कोई भी पेश नहीं किया जाता। इनके अलावा सब कुछ टूल है: लॉग गंतव्य, सीक्रेट प्रदाता और SCIM टोकन की सूची, SCIM टोकन रद्द करना, किसी प्रदाता या गंतव्य को आज़माना, कुंजियों की सूची और रद्द करना, किसी वर्कफ़्लो का टेस्ट वेबहुक खोलना, और OAuth2 साइन-इन शुरू करना, जो वह पता लौटाता है जिसे फिर कोई व्यक्ति खोलता है। कुंजी खुद को रद्द कर सकती है, जो वह पहली चीज़ है जो लीक हुई कुंजी के धारक को कर पाना चाहिए।

`/api/v1/openapi.json` टूल नहीं है: `describe_tool_body` बॉडी देता है।
