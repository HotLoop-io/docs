---
title: "Máy chủ MCP"
description: "Cascade có máy chủ MCP vừa đọc vừa ghi: 83 công cụ, mỗi công cụ là một tuyến API chạy qua trình xử lý riêng, có quyền, lý do và một dòng kiểm toán."
---

Cascade có một máy chủ MCP, và nó vừa đọc vừa ghi. Nó được phát hành ở trạng thái bật, tại `/mcp` cùng địa chỉ với API và trình soạn thảo, và một tác tử kết nối vào đó có thể làm những gì người giữ khóa của nó làm được, không hơn. Không có chế độ chỉ đọc nào để bạn phải đi vòng, vì một máy chủ mà tác tử chỉ nhìn được mà không chạm được thì chỉ là một trang trạng thái, và bạn đã có sẵn một trang như vậy rồi.

83 công cụ, và mỗi công cụ đều là một tuyến của REST API. Một lời gọi không đi bên cạnh tuyến, nó đi xuyên qua tuyến: trình xử lý của chính tuyến kiểm tra quyền, xác thực nội dung, thực hiện thay đổi và ghi dòng kiểm toán. Không có gì được sao chép vào máy chủ MCP để rồi lệch đi, và không có gì bị bỏ ra ngoài để người ta lách qua.

Điều đó có nghĩa là: nếu một quy trình, thông tin đăng nhập, dự án hay con người là thứ bạn đổi được từ trình soạn thảo, thì một tác tử cầm khóa của bạn cũng đổi được, trong giới hạn vai trò của bạn, và nhật ký kiểm toán ghi rằng đó là một tác tử và là tác tử nào.

## Kết nối

Tạo một khóa. Trong trình soạn thảo, nó nằm dưới tài khoản của bạn, hoặc dùng API:

```sh
curl -s -X POST https://cascade.plant.example/api/v1/api-keys \
  -H "X-CSRF-Token: $CSRF" -b cookies.txt -H 'Content-Type: application/json' \
  -d '{"name":"line 4 agent","scopes":["*"],"days":30}'
```

Token chỉ trả về một lần và bắt đầu bằng `hlc_`. Một khóa làm được những gì người giữ nó làm được, thu hẹp theo phạm vi của nó: cấp cho tác tử `["workflow.read","execution.read"]` thì nó chỉ nhìn được mà không chạm được. Khóa tài khoản dịch vụ (một dự án, một vai trò, do quản trị viên dự án tạo) hoạt động y hệt và là khóa phù hợp cho một tích hợp chạy lâu dài.

Sau đó trỏ ứng dụng khách tới `/mcp` và gửi khóa dưới dạng bearer token. Phương thức truyền mà nó nói là HTTP dạng luồng:

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

Một yêu cầu không có khóa, có khóa sai, khóa đã thu hồi hoặc hết hạn, hoặc của một người đã bị vô hiệu hóa sẽ nhận 401 trước khi tới bất kỳ công cụ nào, và một khóa bị thu hồi giữa phiên sẽ ngừng hoạt động ở lời gọi kế tiếp.

## Các quy tắc

**Quyền là của tuyến.** `whoami` cho biết khóa thấy được những dự án nào và vai trò của nó ở từng dự án. Công cụ mà khóa không được dùng sẽ bị từ chối với lý do của chính tuyến: 403 nếu thiếu quyền, 404 nếu là thứ nó không thấy, đúng câu trả lời mà REST API đưa ra. Đó là một quyết định, không phải lỗi để đi vòng.

**Một lần ghi cần có lý do.** Mọi công cụ làm thay đổi gì đó đều nhận một `reason` và từ chối nếu thiếu. Lý do được ghi vào nhật ký kiểm toán cùng khóa của bạn và cái tên mà ứng dụng khách tự đặt.

**Bí mật nằm yên chỗ cũ.** Không công cụ nào trả về trường bí mật của thông tin đăng nhập, cho bất kỳ khóa nào, và thông tin đăng nhập tạo qua MCP có bí mật được niêm phong trong kho ngay khi chúng đến. `get_credential` là cùng chế độ xem không có bí mật như biểu mẫu chỉnh sửa.

**Các công tắc thuộc về bản triển khai.** Hai cài đặt, trong môi trường mà máy chủ khởi động, mà lời gọi API hay tác tử đều không đổi được:

| Cài đặt | Mặc định | Tác dụng |
|---|---|---|
| `HOTLOOP_CASCADE_MCP` | `true` | Với `false`, `/mcp` không còn. |
| `HOTLOOP_CASCADE_MCP_WRITES` | `true` | Với `false`, mọi công cụ làm thay đổi gì đó đều từ chối, còn các công cụ đọc vẫn chạy. |

`PATCH /settings` không biết đến công tắc nào trong hai cái, nên một tác tử được phép sửa cài đặt vẫn không thể bật lại việc ghi.

**Nó không bao giờ ghi vào thiết bị.** `run_workflow` bắt đầu một lần chạy thật, và các bước của nó làm gì với hệ thống mà chúng gọi là tùy ở các bước. Mọi thứ làm van chuyển động hay đổi giá trị đặt đều đi qua cổng ghi của HotLoop, nên kiểm toán của cổng đó nhìn thấy nó, bất kể ai đã khởi động quy trình.

## Nhật ký kiểm toán ghi gì

Hai dòng cho một lần ghi. Dòng của chính tuyến có tác tử làm chủ thể, với loại `mcp`, khóa, khóa của ai và ứng dụng khách:

```
actor:  mcp, "line 4 agent (ops@plant.example) via claude-desktop"
action: workflow.created
```

Và một dòng của công cụ, kèm lý do, được ghi dù tuyến đồng ý hay từ chối:

```
action: mcp.write   target: create_workflow
detail: {"reason": "the line 4 oven needs a setpoint workflow", "method": "POST", "path": "/api/v1/workflows", "status": 201}
```

`list_audit` với `action=mcp.write` là mọi thay đổi mà một tác tử đã làm và lý do.

## Các công cụ

Mỗi dòng là một tuyến thật và quyền mà tuyến đó yêu cầu, và một bài kiểm thử giữ cho bảng khớp với cả hai. Quyền là quyền dự án (được kiểm tra trong dự án chứa đối tượng) hoặc quyền thực thể (chủ sở hữu và quản trị viên). Mọi khóa đã đăng nhập đều có thể yêu cầu những mục được đánh dấu như vậy.

Các công cụ có nội dung nhận một `body`, cùng JSON mà REST API nhận. `describe_tool_body` cho lược đồ của bất kỳ công cụ nào, để lời gọi đầu tiên đã đúng.

| Công cụ | Tuyến | Quyền | Loại |
|---|---|---|---|
| `get_version` | `GET /api/v1/version` | mọi khóa đã đăng nhập | đọc |
| `whoami` | `GET /api/v1/me` | mọi khóa đã đăng nhập | đọc |
| `list_permissions` | `GET /api/v1/permissions` | mọi khóa đã đăng nhập | đọc |
| `list_roles` | `GET /api/v1/roles` | mọi khóa đã đăng nhập | đọc |
| `get_role` | `GET /api/v1/roles/{role}` | mọi khóa đã đăng nhập | đọc |
| `list_projects` | `GET /api/v1/projects` | `project.read` | đọc |
| `get_project` | `GET /api/v1/projects/{project}` | `project.read` | đọc |
| `create_project` | `POST /api/v1/projects` | `project.create` | ghi |
| `rename_project` | `PATCH /api/v1/projects/{project}` | `project.update` | ghi |
| `delete_project` | `DELETE /api/v1/projects/{project}` | `project.delete` | ghi |
| `list_members` | `GET /api/v1/projects/{project}/members` | `project.read` | đọc |
| `set_member` | `PUT /api/v1/projects/{project}/members/{user}` | `project.members` | ghi |
| `remove_member` | `DELETE /api/v1/projects/{project}/members/{user}` | `project.members` | ghi |
| `list_service_accounts` | `GET /api/v1/projects/{project}/service-accounts` | `project.members` | đọc |
| `list_workflows` | `GET /api/v1/workflows` | `workflow.read` | đọc |
| `get_workflow` | `GET /api/v1/workflows/{workflow}` | `workflow.read` | đọc |
| `create_workflow` | `POST /api/v1/workflows` | `workflow.create` | ghi |
| `save_workflow` | `PUT /api/v1/workflows/{workflow}` | `workflow.update` | ghi |
| `delete_workflow` | `DELETE /api/v1/workflows/{workflow}` | `workflow.delete` | ghi |
| `listen_workflow` | `POST /api/v1/workflows/{workflow}/listen` | `workflow.execute` | ghi |
| `activate_workflow` | `POST /api/v1/workflows/{workflow}/activate` | `workflow.activate` | ghi |
| `deactivate_workflow` | `POST /api/v1/workflows/{workflow}/deactivate` | `workflow.activate` | ghi |
| `run_workflow` | `POST /api/v1/workflows/{workflow}/run` | `workflow.execute` | ghi |
| `move_workflow` | `PUT /api/v1/workflows/{workflow}/folder` | `workflow.update` | ghi |
| `list_workflow_versions` | `GET /api/v1/workflows/{workflow}/versions` | `workflow.read` | đọc |
| `get_workflow_version` | `GET /api/v1/workflows/{workflow}/versions/{version}` | `workflow.read` | đọc |
| `diff_workflow_versions` | `GET /api/v1/workflows/{workflow}/diff` | `workflow.read` | đọc |
| `restore_workflow_version` | `POST /api/v1/workflows/{workflow}/versions/{version}/restore` | `workflow.update` | ghi |
| `label_workflow_version` | `PUT /api/v1/workflows/{workflow}/versions/{version}/label` | `workflow.update` | ghi |
| `preview_expression` | `POST /api/v1/workflows/{workflow}/preview` | `workflow.read` | đọc |
| `list_expression_functions` | `GET /api/v1/expression/functions` | mọi khóa đã đăng nhập | đọc |
| `list_step_types` | `GET /api/v1/step-types` | mọi khóa đã đăng nhập | đọc |
| `shape_step` | `POST /api/v1/step-types/{type}/{version}/shape` | mọi khóa đã đăng nhập | đọc |
| `list_folders` | `GET /api/v1/folders` | `folder.read` | đọc |
| `create_folder` | `POST /api/v1/folders` | `folder.create` | ghi |
| `update_folder` | `PATCH /api/v1/folders/{folder}` | `folder.update` | ghi |
| `delete_folder` | `DELETE /api/v1/folders/{folder}` | `folder.delete` | ghi |
| `list_variables` | `GET /api/v1/variables` | `variable.read` | đọc |
| `create_variable` | `POST /api/v1/variables` | `variable.create` | ghi |
| `update_variable` | `PUT /api/v1/variables/{variable}` | `variable.update` | ghi |
| `delete_variable` | `DELETE /api/v1/variables/{variable}` | `variable.delete` | ghi |
| `list_executions` | `GET /api/v1/executions` | `execution.read` | đọc |
| `get_execution` | `GET /api/v1/executions/{execution}` | `execution.read` | đọc |
| `get_step_output` | `GET /api/v1/executions/{execution}/steps/{step}/output` | `execution.read` | đọc |
| `get_insights` | `GET /api/v1/insights` | `execution.read` | đọc |
| `stop_execution` | `POST /api/v1/executions/{execution}/stop` | `execution.stop` | ghi |
| `retry_execution` | `POST /api/v1/executions/{execution}/retry` | `execution.retry` | ghi |
| `replay_execution` | `POST /api/v1/executions/{execution}/replay` | `execution.retry` | ghi |
| `delete_execution` | `DELETE /api/v1/executions/{execution}` | `execution.delete` | ghi |
| `annotate_execution` | `PUT /api/v1/executions/{execution}/annotation` | `execution.annotate` | ghi |
| `clear_annotation` | `DELETE /api/v1/executions/{execution}/annotation` | `execution.annotate` | ghi |
| `list_credential_types` | `GET /api/v1/credential-types` | mọi khóa đã đăng nhập | đọc |
| `list_credentials` | `GET /api/v1/credentials` | `credential.list` | đọc |
| `get_credential` | `GET /api/v1/credentials/{credential}` | `credential.read` | đọc |
| `start_oauth` | `POST /api/v1/credentials/{credential}/oauth/start` | `credential.update` | ghi |
| `create_credential` | `POST /api/v1/credentials` | `credential.create` | ghi |
| `update_credential` | `PATCH /api/v1/credentials/{credential}` | `credential.update` | ghi |
| `delete_credential` | `DELETE /api/v1/credentials/{credential}` | `credential.delete` | ghi |
| `share_credential` | `PUT /api/v1/credentials/{credential}/shares/{project}` | `credential.share` | ghi |
| `unshare_credential` | `DELETE /api/v1/credentials/{credential}/shares/{project}` | `credential.share` | ghi |
| `create_role` | `POST /api/v1/roles` | `role.manage` | ghi |
| `update_role` | `PUT /api/v1/roles/{role}` | `role.manage` | ghi |
| `delete_role` | `DELETE /api/v1/roles/{role}` | `role.manage` | ghi |
| `list_redaction_policies` | `GET /api/v1/redaction-policies` | mọi khóa đã đăng nhập | đọc |
| `create_redaction_policy` | `POST /api/v1/redaction-policies` | `redaction.manage` | ghi |
| `update_redaction_policy` | `PUT /api/v1/redaction-policies/{policy}` | `redaction.manage` | ghi |
| `delete_redaction_policy` | `DELETE /api/v1/redaction-policies/{policy}` | `redaction.manage` | ghi |
| `list_secret_providers` | `GET /api/v1/secret-providers` | mọi khóa đã đăng nhập | đọc |
| `test_secret_provider` | `POST /api/v1/secret-providers/{provider}/test` | `secrets.manage` | ghi |
| `list_log_destinations` | `GET /api/v1/log-destinations` | `logstream.manage` | đọc |
| `test_log_destination` | `POST /api/v1/log-destinations/{destination}/test` | `logstream.manage` | ghi |
| `list_keys` | `GET /api/v1/api-keys` | mọi khóa đã đăng nhập | đọc |
| `revoke_key` | `DELETE /api/v1/api-keys/{key}` | mọi khóa đã đăng nhập | ghi |
| `list_scim_tokens` | `GET /api/v1/scim-tokens` | `scim.manage` | đọc |
| `revoke_scim_token` | `DELETE /api/v1/scim-tokens/{token}` | `scim.manage` | ghi |
| `list_users` | `GET /api/v1/users` | `user.manage` | đọc |
| `create_user` | `POST /api/v1/users` | `user.manage` | ghi |
| `change_user` | `PATCH /api/v1/users/{user}` | `user.manage` | ghi |
| `list_audit` | `GET /api/v1/audit` | `audit.read` | đọc |
| `verify_audit` | `GET /api/v1/audit/verify` | `audit.read` | đọc |
| `get_settings` | `GET /api/v1/settings` | `instance.settings` | đọc |
| `change_settings` | `PATCH /api/v1/settings` | `instance.settings` | ghi |
| `describe_tool_body` | không phải tuyến: lược đồ JSON mà nội dung của công cụ nhận | mọi khóa đã đăng nhập | đọc |

## Cố ý để ngoài

Mười tuyến tự từ chối khóa vì chúng cần một người đã đăng nhập, và máy chủ MCP không giả vờ khác đi: tạo khóa API, tạo khóa tài khoản dịch vụ, tạo token SCIM, thêm, đổi và xóa nhà cung cấp bí mật bên ngoài, thêm, đổi và xóa đích nhận nhật ký, và mật khẩu của chính một người. Một khóa có thể đúc ra khóa, hoặc đổi nơi gửi nhật ký kiểm toán, là một khóa bị lộ có thể tự giữ mình còn hiệu lực. Mỗi tuyến trong số đó sẽ là một công cụ chỉ luôn trả lời "không được phép", nên không cái nào được cung cấp. Mọi thứ còn lại đều là công cụ: liệt kê các đích nhận nhật ký, nhà cung cấp bí mật và token SCIM, thu hồi token SCIM, thử một nhà cung cấp hoặc một đích, liệt kê và thu hồi khóa, mở webhook thử của một quy trình, và bắt đầu đăng nhập OAuth2, trả về địa chỉ mà một người sau đó mở. Một khóa có thể tự thu hồi mình, và đó là điều đầu tiên người giữ khóa bị lộ nên làm được.

`/api/v1/openapi.json` không phải công cụ: `describe_tool_body` cho các nội dung.
