---
title: "MCP theo cả hai chiều"
description: "Tác nhân có thể gọi một luồng như một công cụ, và một luồng có thể gọi công cụ trên mọi máy chủ MCP, chỉ với ba nút và một nút cấu hình."
---

Một tác nhân nói giao thức Model Context Protocol có thể gọi một luồng như một công cụ, và một luồng có thể gọi công cụ trên bất kỳ máy chủ MCP nào, kể cả MCP của chính HotLoop. Ba nút và một nút cấu hình làm được việc này: `mcp tool` và `mcp result` phục vụ một luồng, còn `mcp client` trên kết nối `hotloop-flow-mcp-server` gọi ra ngoài. Nếu bạn chỉ nối cảm biến với bảng điều khiển thì có thể bỏ qua toàn bộ phần này: một luồng không dùng nút nào trong số này sẽ không bao giờ thực hiện lệnh gọi MCP, và các công cụ duy nhất Flow tự cung cấp là những công cụ đọc và thay đổi các luồng của nó ([bên dưới](#các-công-cụ-riêng-của-flow)).

Giao thức là của Go SDK (`github.com/modelcontextprotocol/go-sdk` v1.8.0, giấy phép dễ dãi, một số tệp vẫn theo MIT trong lúc dự án hoàn tất việc đổi giấy phép, do dự án MCP duy trì). Nó hỗ trợ bản sửa đổi hiện hành của đặc tả, 2026-07-28, không có bước bắt tay và mang phiên bản trong mọi yêu cầu, cùng các bản sửa đổi có bắt tay đến 2025-11-25, trên cùng một điểm cuối. Máy khách nhận bản mà nó dùng khi mở kết nối, nên không cần cấu hình gì.

## Luồng làm công cụ

Một nút `mcp tool` khai báo một công cụ: tên, mô tả cho mô hình đọc nó, và một lược đồ đầu vào. Khi luồng đang được triển khai, Flow phục vụ công cụ đó tại `/mcp` (dưới gốc quản trị, nếu bạn đã dời nó). Một lệnh gọi trở thành thông điệp đi ra khỏi nút, `msg.payload` là các đối số của lệnh gọi, `msg.topic` là tên công cụ, và `msg.mcp` chứa `tool`, `caller` và `callId`. Một nút `mcp result` ở phía sau gửi câu trả lời về, giống như `http response` trả lời `http in`. Mọi thứ nằm giữa hai nút là một luồng như mọi luồng khác.

```json
[
  {"id": "t1", "type": "tab", "label": "Line"},
  {"id": "tool", "type": "mcp tool", "z": "t1", "toolName": "line_status",
   "description": "Status of a production line: its state and speed.",
   "schema": "{\"type\":\"object\",\"properties\":{\"line\":{\"type\":\"string\",\"enum\":[\"L1\",\"L2\",\"L3\"]}},\"required\":[\"line\"],\"additionalProperties\":false}",
   "x": 100, "y": 100, "wires": [["status"]]},
  {"id": "status", "type": "function", "z": "t1", "name": "status", "outputs": 1,
   "func": "msg.payload = {line: msg.payload.line, state: 'running', askedBy: msg.mcp.caller};\nreturn msg;",
   "x": 300, "y": 100, "wires": [["answer"]]},
  {"id": "answer", "type": "mcp result", "z": "t1", "x": 500, "y": 100, "wires": []}
]
```

**Lược đồ được kiểm tra trước khi luồng chạy.** Đó là JSON Schema, được đọc theo cách nút `json` đọc (bản nháp 2020-12 trừ khi lược đồ nêu bản khác, và `$ref` tới một URL khác là lỗi). Lược đồ không hợp lệ, gốc không phải đối tượng, tên công cụ mà MCP không cho phép, hoặc hai nút phục vụ cùng một tên đều làm việc triển khai nút đó thất bại, kèm lý do. Một lệnh gọi có đối số không khớp được trả lời bằng lỗi công cụ nêu tên trường sai, `arguments.line: value must be one of "L1", "L2", "L3"`, để mô hình sửa và thử lại, và luồng không bao giờ thấy lệnh gọi đó. Payload là đối tượng được trả về dưới dạng đối tượng và dưới dạng văn bản JSON của nó, văn bản được trả về dưới dạng văn bản, và một `mcp result` được nút Catch cấp dữ liệu, hoặc có đánh dấu "The work failed", sẽ trả lời bằng lỗi công cụ với chính lời của lỗi đó. Một lệnh gọi mà không ai trả lời sẽ được báo như vậy sau thời gian chờ phản hồi, 30 giây nếu bạn không đặt, và lỗi đi tới một nút Catch. Triển khai lại sẽ chờ các lệnh gọi đang chạy.

**Một tác nhân là người gọi như mọi người gọi khác.** `/mcp` nhận cùng các token mà API quản trị nhận, token phiên hoặc token API, và không gì khác. Không có lệnh gọi ẩn danh: không có token là 401, token mà Flow không biết là 401, và token không có quyền `mcp.call` là 403, trước khi giao thức nhìn thấy yêu cầu. Một phiên bản chạy với `HOTLOOP_FLOW_INSECURE` trả lời 403 cho mọi yêu cầu `/mcp`, vì một lệnh gọi công cụ phải có người gọi để ghi vào nhật ký kiểm toán. Token của một tác nhân là một token như mọi token khác:

```yaml
auth:
  tokens:
    - name: agent
      hash: sha256:...          # from: hotloop-flow token -name agent
      permissions: ["mcp.call"]
      rateLimit: {calls: 60, per: 1m}   # optional; no rateLimit, no limit
```

Lệnh gọi chạy với quyền của danh tính đó. Mọi người gọi đều cần `mcp.call` (hoặc `mcp.*`, hoặc `*`). Nếu bạn đặt một quyền khác vào ô "Extra permission" của công cụ, chẳng hạn `mcp.line3`, người gọi cũng cần quyền đó, và nếu thiếu thì không thấy công cụ trong danh sách. Hai tác nhân có thể dùng chung một Flow và thấy các công cụ khác nhau.

**Một token có thể bị giới hạn số lệnh gọi.** `rateLimit` trên một token API trong `auth.tokens` là `calls` trong một khoảng thời gian, `per`, một phút nếu bạn bỏ trống. Khoảng thời gian bắt đầu từ lệnh gọi đầu tiên của token, một lệnh gọi vượt quá số đó bị từ chối cho đến khi khoảng này kết thúc, rồi việc đếm bắt đầu lại. Một lệnh gọi bị từ chối không bao giờ tới luồng, và được trả lời bằng lỗi công cụ cho biết phải chờ bao nhiêu giây, nhờ vậy một tác nhân đang lặp được bảo chậm lại bằng lời mà nó đọc được. Đặc tả không nêu lỗi nào cho việc này, nên dùng lỗi công cụ mà nó đã định nghĩa cho một lệnh gọi không thể thực hiện. Token không có `rateLimit` không bao giờ bị hạn chế, và token phiên cũng không bị giới hạn, vì nó là của một con người. Mỗi token đếm riêng, và số đếm nằm trong bộ nhớ, nên khởi động lại sẽ đếm lại từ đầu. Một lần từ chối là một dòng `mcp.refused` với lý do `rate limit exceeded`, nghĩa là một đợt ồ ạt cũng nằm trong nhật ký kiểm toán.

**Mọi lệnh gọi đều có trong nhật ký kiểm toán, dưới tên người gọi.** `mcp.call` được ghi trước khi luồng chạy, kèm công cụ, nút và một id lệnh gọi, và `mcp.result` được ghi sau đó, kèm kết quả và số mili giây. `mcp.refused` là token sai, token thiếu quyền, công cụ mà nó không được gọi, hoặc đối số không khớp. Bản thân các đối số không bao giờ được ghi. Một yêu cầu không có token nào cũng không được ghi, vì không có ai ở đầu bên kia để gọi tên. `GET /audit?event=mcp.` đọc tất cả, và `?user=token:agent` thu hẹp xuống một tác nhân.

Hãy thử bằng trình kiểm tra của chính dự án MCP, không cần gì từ Flow:

```bash
npx @modelcontextprotocol/inspector@2.12.0 --cli http://localhost:1880/mcp \
  --transport http --header "Authorization: Bearer $TOKEN" \
  --method tools/call --tool-name line_status --tool-arg line=L3
```

Một bài kiểm thử luồng đặt thông điệp mà một lệnh gọi sẽ tạo ra vào chỗ nút `mcp tool` đang đứng, và `mcp result` chuyển cho bài kiểm thử điều nó sẽ trả lời dưới dạng `{isError, text, structuredContent}`, nên luồng được kiểm thử mà không cần máy chủ.

## Các công cụ riêng của Flow

Một tác nhân chỉ gọi được những gì tác giả luồng đã nối dây thì không thể thấy các luồng hay thay đổi chúng, nên Flow phục vụ 45 công cụ riêng tại cùng `/mcp`, bên cạnh các công cụ của luồng. Chúng đọc và chúng ghi. Bảy công cụ nói về các luồng, trong bảng dưới đây, và phần còn lại là các tuyến khác của API quản trị: cài đặt, bảng nút, nhật ký kiểm toán, chi tiết và khác biệt của các lần triển khai, xuất, các bài kiểm thử luồng, vết thông điệp, số liệu của môi trường chạy, đặt lại xác thực hai yếu tố, cùng các sơ đồ và thiết bị đo: liệt kê và đọc một sơ đồ, chạy và dừng nó, điều khiển trình gỡ lỗi của nó, đặt một điều khiển trên bảng của nó, và bật tắt việc ghi của một thiết bị đo. Trang MCP có mọi công cụ, tuyến và quyền của chúng, cùng vài tuyến không phải công cụ và lý do.

| Công cụ | Chức năng | Quyền |
|---|---|---|
| `list_flows` | mọi tab và luồng con: id, nhãn, đã tắt hay chưa, số nút, và bản sửa đổi | `flows.read` |
| `get_flows` | toàn bộ tập đã triển khai như trình soạn thảo đọc, kèm bản sửa đổi | `flows.read` |
| `get_flow` | một tab hoặc luồng con cùng các nút của nó, theo id | `flows.read` |
| `deploy_flows` | **deploy**: thay toàn bộ tập, kèm bản sửa đổi bạn đã đọc và một ghi chú | `flows.write` |
| `list_deployments` | lịch sử triển khai, mới nhất trước | `flows.read` |
| `rollback_deployment` | **roll back** về một lần triển khai trước đó, như một lần triển khai mới | `flows.write` |
| `inject_node` | **press** một nút inject, kèm thông điệp của riêng bạn | `inject.write` |

Không công cụ nào là một bản triển khai thứ hai. Mỗi công cụ chạy chính trình xử lý của API quản trị cho cùng công việc đó, với tư cách người gọi mà điểm cuối đã xác thực, nên một lần triển khai gặp mọi thứ mà một lần triển khai từ trình soạn thảo gặp: tài liệu phải phân tích được, bản sửa đổi phải là bản hiện tại (bản sửa đổi rỗng ghi đè có chủ ý), các dây không thống nhất về thứ đi qua chúng bị từ chối, các plugin không được phép bị từ chối, và các bài kiểm thử luồng thất bại sẽ từ chối việc triển khai, mỗi trường hợp bằng lời của chính tuyến đó. Lịch sử triển khai ghi người gọi và ghi chú, và nhật ký kiểm toán có dòng `deploy` hoặc `inject` dưới tên người gọi, cùng các dòng `mcp.call` và `mcp.result` mà mọi lệnh gọi công cụ để lại. Người gọi cần `mcp.call` và quyền riêng của công cụ, và công cụ mà nó không được gọi sẽ không có trong danh sách. Các công cụ vẫn còn sau một lần triển khai, vì lần triển khai chỉ gỡ các công cụ của luồng, và một luồng không thể phục vụ tên nào trong số đó.

`deploy_flows` thay toàn bộ tập, nên một tác nhân đọc `get_flows` trước rồi gửi lại bản đã sửa, kèm `rev` mà nó nhận được.

## Gọi công cụ trên các máy chủ khác

Một nút `mcp client` gọi một công cụ khi có thông điệp đến, trên một kết nối `hotloop-flow-mcp-server`: địa chỉ MCP của máy chủ, một bearer token nếu nó cần, và một thời gian chờ. Công cụ và các đối số của nó là đầu vào có kiểu, nên cái nào cũng có thể lấy từ thông điệp. `msg.payload` là câu trả lời có cấu trúc của công cụ khi có, là văn bản khi mọi thứ nó nói đều là văn bản, và là nội dung nguyên như nhận được khi là bất cứ thứ gì khác, còn `msg.mcp` có máy chủ, công cụ và toàn bộ câu trả lời. Thao tác còn lại, "List the tools", đặt vào `msg.payload` mọi công cụ mà máy chủ có, kèm mô tả và lược đồ đầu vào.

Một công cụ báo lỗi sẽ phát ra lỗi, với lời của máy chủ, nên nút Catch thấy đúng điều mà mô hình sẽ thấy. **Một lệnh gọi không bao giờ được gửi hai lần.** Một công cụ có thể làm thiết bị chuyển động, và một kết nối bị đứt không cho biết máy chủ đã chạy lệnh hay chưa, nên lỗi nói rằng kết nối đã thất bại và thông điệp kế tiếp sẽ kết nối lại. Token chỉ đi tới địa chỉ bạn đã cho và không đi đâu khác, chuyển hướng không được theo, và lỗi không bao giờ lặp lại token. Kết nối chỉ tin các gốc chứng chỉ của hệ thống và không tin gì khác.

Với HotLoop, đó là địa chỉ `/mcp` của nó và `mcp-token` từ Secret của bản phát hành, và mọi công cụ trong tài liệu MCP của HotLoop đều có ở đó:

```json
{"id": "plant", "type": "mcp client", "z": "t1", "server": "hotloop",
 "tool": "get_plant_status", "toolType": "str", "arguments": "{}", "argumentsType": "json",
 "x": 300, "y": 100, "wires": [["use"]]}
```

HotLoop thấy lệnh gọi như của một máy khách MCP, theo quy tắc riêng của nó: MCP đọc và ghi, qua cùng cổng như mọi người khác, nên một `write_tag` tới tag đã kích hoạt và trong phạm vi sẽ đi qua (sau khi bật việc ghi của chính HotLoop) còn lệnh bị từ chối, chẳng hạn tag mà không ai đánh dấu là ghi được, quay về dưới dạng lỗi của nút bằng lời của HotLoop. Để ghi qua cổng của HotLoop từ một luồng mà không dùng MCP, hãy dùng các nút HotLoop ở trên.

## Đã kiểm thử với những gì

**Máy chủ** được kiểm thử bằng chính máy khách của Go SDK trên HTTP thật, ở cả hai thời kỳ: liệt kê, gọi, đối số bị từ chối, một quyền bị từ chối, một token bị từ chối, các dòng kiểm toán, một công cụ biến mất khi nút của nó dừng, và toàn bộ máy chủ quản trị phía trước với token API và token phiên thật cùng nhật ký kiểm toán trên đĩa. Inspector CLI 2.12.0 của dự án MCP đã liệt kê các công cụ của một Flow đang chạy, gọi chúng, và bị từ chối khi không có token và khi dùng token bịa. Nút `mcp client` được chạy với một HotLoop 4.18.10 thật (ảnh IoT đã phát hành): nó liệt kê cả 27 công cụ, gọi `get_plant_status`, `list_devices` và `get_states` rồi dùng các câu trả lời, bị từ chối khi sai token và khi không có token, nhận lỗi riêng của HotLoop với một công cụ không tồn tại và với một lần ghi mà MCP không được phép thực hiện, và một công cụ Flow do Inspector gọi đã chạy một luồng gọi MCP của HotLoop rồi trả lời bằng điều nó nói.

**Chưa làm:** OAuth (bearer token là cách vào duy nhất, theo cả hai chiều), máy chủ stdio, tài nguyên, prompt, lấy mẫu, gợi hỏi và thông báo tiến độ, và lược đồ đầu ra của một công cụ. HotLoop 4.18.10 nói các bản sửa đổi có bắt tay, nên nút gặp nó theo cách đó; với máy chủ ở bản sửa đổi hiện hành thì chỉ được kiểm thử với máy chủ riêng của Flow. Một máy chủ có bắt tay mà quên một phiên (khởi động lại) sẽ làm lệnh gọi đầu tiên sau đó thất bại, một lần, và lệnh kế tiếp kết nối lại. Giới hạn lệnh gọi theo từng token API và tắt cho đến khi bạn đặt, nên một token không có `rateLimit` chỉ bị giới hạn bởi các hàng đợi vốn đã có mức trần, và bởi kích thước yêu cầu, 4 MiB.
