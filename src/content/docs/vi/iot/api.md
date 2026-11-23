---
title: "API HTTP"
description: "Mọi lệnh gọi mà HotLoop trả lời qua HTTP, nó cần gì, nhận gì và trả về gì. Giao diện web không dùng thứ gì khác."
---

:::note[Có cả những gì sắp tới]
Trang này cũng nói về một vài thứ mới hơn HotLoop core 4.24.0, bản phát hành mới nhất. Một số phần có thể chưa có trong bản bạn đã cài. [Ghi chú phát hành](/vi/releases/) cho biết điều gì đã thay đổi.
:::

Mọi lệnh gọi mà Gateway trả lời qua HTTP, mỗi lệnh cần gì, nhận gì và trả về gì. Giao diện web không dùng thứ gì khác: không có API riêng nào phía sau các màn hình, nên bất cứ việc gì giao diện làm được, một script cũng làm được bằng đúng những lệnh gọi và đúng những quyền đó.

Trang này được kiểm tra đối chiếu với mã nguồn. Vì vậy danh sách các route và người được gọi chúng không phải là mô tả một API như nó từng là. Hình dạng của các yêu cầu và phản hồi bên dưới được lấy từ một Gateway đang chạy; các bài kiểm thử không kiểm tra chúng, nên nếu bạn đổi một handler, hãy đổi cả mục của nó ở đây.

Bối cảnh sâu hơn của từng tính năng nằm ở trang riêng của tính năng đó: [Xác thực và người dùng](/vi/iot/authentication/), [Thực thể](/vi/iot/entities/), [cây thiết bị và nhãn](/vi/iot/equipment/), [Tự động hóa](/vi/iot/automations/), [Báo cáo theo lịch](/vi/gateway/reports/), [Quản lý đội thiết bị](/vi/gateway/fleet/), [Thông báo báo động](/vi/iot/notifications/), [Sao lưu và khôi phục](/vi/iot/backup/) và [MCP](/vi/iot/mcp/). Trang này là danh sách; các trang kia nêu lý do.

## Quy ước

### Nó nằm ở đâu

Mọi thứ nằm trên một cổng HTTP duy nhất của ứng dụng (`HOTLOOP_LISTEN_ADDR`, mặc định `:8080`). Phía sau một proxy phục vụ ứng dụng dưới một đường dẫn, hãy đặt `HOTLOOP_BASE_PATH` và Gateway sẽ bỏ nó đi, nên `/hotloop/api/devices` và `/api/devices` là cùng một lệnh gọi. Các đường dẫn bên dưới được viết không có nó.

### Đăng nhập: cookie hoặc bearer token

Mọi route `/api/` đều cần một phiên, trừ đăng nhập (bằng mật khẩu, hoặc bằng PIN hay thẻ tại một bảng điều khiển kiosk), các webhook đến và các liên kết xác nhận báo động, mỗi loại tự mang bằng chứng riêng trong yêu cầu. `POST /api/auth/login` trả về một token và đồng thời đặt nó thành cookie `iiot_session` (HttpOnly, SameSite=Lax, Secure khi yêu cầu đến qua TLS hoặc có `X-Forwarded-Proto: https`). Trình duyệt dùng cookie và không bao giờ thấy token. Một script thì gửi token thay vào đó:

```
Authorization: Bearer 3f9c...e1
```

Cả hai là cùng một phiên và được kiểm tra như nhau. Một phiên kéo dài `HOTLOOP_AUTH_SESSION_TTL` (mặc định 12 giờ). Không có phiên, mọi route `/api/` trả lời:

```
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="hotloop"

{"error":"not logged in"}
```

hoặc `"the session is invalid or has expired"` với token đã bị thu hồi hay hết hạn, hoặc `"this account no longer has access"` với tài khoản đã bị tắt.

Với `HOTLOOP_AUTH_INSECURE=true` thì không có đăng nhập nào cả: không có gì được kiểm tra, mọi quyền bên dưới được cấp cho tất cả mọi người, và tên ghi lại cho một thao tác ghi lấy từ header của proxy `X-EmberNET-User`, `X-Forwarded-User`, `X-Auth-Request-User`, `X-Remote-User` hoặc `X-Forwarded-Email`, hoặc là `operator` nếu không có header nào. Chỉ hợp lý phía sau một NetworkPolicy không cho gì chạm tới pod ngoài proxy của bảng điều khiển. Xem [Xác thực và người dùng](/vi/iot/authentication/#chạy-không-cần-đăng-nhập).

MCP là phần riêng: nó có bearer token riêng (`HOTLOOP_MCP_TOKEN`) và không bao giờ nhìn vào phiên. Xem [MCP](#mcp).

### Quyền

Người dùng đã đăng nhập có một danh sách quyền, lấy từ vai trò của họ hoặc đặt trực tiếp trên tài khoản. Một route cần một quyền mà người dùng không có sẽ trả lời:

```
HTTP/1.1 403 Forbidden

{"error":"viewer1 does not have the \"values.write\" permission"}
```

[Bảng quyền](#quyền) cho biết vai trò nào có quyền gì.

### Lỗi

Mọi lỗi do chính API tạo ra đều là JSON với một dạng duy nhất:

```json
{"error": "value is outside the tag's configured range: 120 is outside 0..95"}
```

`/readyz` thêm một `detail`, và một lệnh gọi dịch vụ thất bại thêm các thao tác ghi mà nó đã thực hiện. Thông báo được viết cho người đọc: nói điều gì đã sai và, nếu có, nên làm gì thay thế. Hãy hiển thị nguyên văn.

| Trạng thái | Khi nào |
|---|---|
| 400 | Yêu cầu sai: phần thân sai định dạng, một trường không qua kiểm tra, một trường không xác định, thiếu tham số, dịch vụ không xác định |
| 401 | Không có phiên, phiên đã hết hạn, hoặc sai mật khẩu khi đăng nhập |
| 403 | Người dùng thiếu quyền, hoặc cổng ghi từ chối thao tác ghi theo chính sách: ghi bị tắt, tag chưa được kích hoạt, thực thể bị tắt |
| 404 | Thứ được nêu trong đường dẫn hoặc phần thân không tồn tại |
| 409 | Đã tồn tại, hoặc đang ở trạng thái không cho phép việc này: một báo động chưa bị hoãn, một nút vẫn còn nút con, một thực thể chưa biết trạng thái để chuyển đổi, một script đang chạy, một công thức đã bị từ chối hoặc đang được áp dụng |
| 422 | Một giá trị mà cổng ghi từ chối vì chính nội dung: ngoài phạm vi của tag, lệch bước của thực thể |
| 502 | Thiết bị trả lời bằng một lỗi của riêng nó và phần thân là lời của thiết bị; hoặc một công thức đã bắt đầu nhưng không phải mọi đích đều tới nơi, và phần thân nói đích nào đã gửi, đích nào chưa |
| 503 | Thiết bị chưa kết nối, hoặc bộ máy báo động không chạy |
| 500 | Lỗi bên trong máy chủ. Phần thân là `internal error (ref …); the server log has the detail under that ref` và không gì hơn, còn nhật ký có toàn bộ lỗi dưới mã tham chiếu đó. Lỗi 500 duy nhất có thông báo thật là khi nhấn một nút mà tín hiệu nhả nút không gửi đi, vì thông báo đó nói chính xác cần kiểm tra gì |

Mọi thứ API không xếp loại được đều là 500, không bao giờ là 400. Sự cố cơ sở dữ liệu mà trả lời 400 sẽ báo cho người vận hành rằng họ gõ sai, và họ đi tìm một lỗi chính tả không hề có.

Hai lỗi không đến từ API và là văn bản thuần, không phải JSON: một đường dẫn không khớp route nào trả lời `404 page not found`, và một đường dẫn đã biết gọi bằng sai phương thức trả lời `405 method not allowed`.

Một thao tác ghi bị từ chối không bao giờ là 500. Một màn hình nhà máy hiển thị việc từ chối theo chính sách như lỗi máy chủ sẽ dạy người vận hành bỏ qua các lỗi.

### Phần thân

Phần thân yêu cầu là JSON, tối đa 4 MiB (webhook đến, 1 MiB). **Trường không xác định bị từ chối**, không bị bỏ qua:

```json
{"error":"request body: json: unknown field \"x\""}
```

Một cài đặt viết sai bị lặng lẽ bỏ đi trông y hệt một cài đặt đã chạy đúng, nên bộ giải mã từ chối.

`POST` và `PUT` trên thiết bị, tag, báo động, tự động hóa, thành viên đội thiết bị và báo cáo sẽ thay thế toàn bộ đối tượng: trường bỏ sót nhận giá trị không, và boolean bỏ sót là `false`. Hãy đọc, sửa, rồi gửi lại. Ngoại lệ là `PUT` của thực thể và thiết bị trong cây, chỉ đổi các trường bạn gửi, và thông tin xác thực của thiết bị, được giữ nguyên khi bỏ sót (xem bên dưới).

### Bí mật chỉ ghi, không đọc

Thông tin xác thực lưu trong một thiết bị (mật khẩu broker, một header HTTP, mật khẩu trong địa chỉ) không bao giờ được gửi lại, cho bất kỳ vai trò nào, kể cả quản trị viên. Nó hiện là `[redacted]`:

```json
"config": {"clientId": "docs-api-tankfarm", "password": "[redacted]", "username": "tank"}
```

Khi lưu thiết bị, hãy gửi chỗ giữ chỗ (hoặc bỏ khóa đi) để giữ giá trị đã lưu, gửi giá trị mới để thay thế, và gửi `""` hoặc `null` để xóa. Thiết bị mới không thể lưu với chỗ giữ chỗ, và việc lưu chuyển thiết bị sang một host khác khi còn giữ thông tin xác thực sẽ bị từ chối, để mật khẩu đã lưu không thể bị mang sang listener của người khác. Quy tắc đầy đủ nằm ở [Xác thực và người dùng](/vi/iot/authentication/#thông-tin-xác-thực-của-thiết-bị-chỉ-ghi). Mọi thông tin xác thực khác mà Gateway nắm giữ cũng vậy: phần cài đặt hiện `set` hoặc `not set`, chẩn đoán loại bỏ thông tin xác thực khỏi các đích MCP gửi đi, và không gì trong API này trả về mã băm mật khẩu hay token phiên, trừ token duy nhất mà lần đăng nhập đưa cho bạn.

### camelCase, trừ chỗ dùng snake_case

Phần lớn API dùng camelCase (`deviceId`, `pollIntervalMs`, `createdAt`), như từ phiên bản đầu tiên và như hợp đồng `TagValue` của bảng điều khiển EmberNet yêu cầu.

Các endpoint về thực thể, trạng thái, dịch vụ, thiết bị trong cây và nhãn dùng snake_case (`entity_id`, `last_changed`, `parent_id`, `label_id`). Đó là cố ý: API thực thể dùng dạng thông thường của thực thể, trạng thái và dịch vụ, để bất cứ thứ gì đã nói được dạng đó cũng nói được API này, và cây thiết bị là sổ đăng ký khu vực của mô hình thực thể, có dạng dành cho cùng những bên dùng. Ở chỗ hai bên gặp nhau, mỗi bên giữ kiểu viết của mình: thiết bị có `equipmentId`, thực thể có `equipment_id`.

### Thời gian, khoảng thời gian và khóa tag

- **Dấu thời gian** là RFC 3339 theo UTC, kèm phần giây thập phân khi có: `2026-09-27T20:21:58.255869Z`. Cài đặt múi giờ hiển thị thay đổi điều giao diện hiển thị, không bao giờ thay đổi điều API trả về.
- **Thời điểm chưa xảy ra thì được bỏ đi.** Một quy tắc chưa từng chạy không có `lastRun`, một thiết bị chưa từng được thăm dò không có `lastPoll` hay `lastGood`, một báo động chưa ai xác nhận không có `ackedAt`, một thành viên đội thiết bị chưa từng thấy không có `lastSeen`. Trường thời gian vắng mặt nghĩa là chưa bao giờ. Bạn sẽ không bao giờ thấy thời điểm không của Go, `0001-01-01T00:00:00Z`, trong phản hồi hay sự kiện luồng. Từng có khoảng chục trường gửi nó, và màn hình tự động hóa hiển thị một quy tắc chưa từng chạy là chạy lần cuối 739887 ngày trước. Một bài kiểm thử đọc mọi route và mọi trường thời gian trong mã để giữ như vậy.
- **Sparkline** là ngoại lệ: ở đó `timestamps` là mili giây Unix, vì nó đi thẳng vào biểu đồ.
- **Khoảng thời gian** nêu đơn vị ngay trong tên: `pollIntervalMs`, `onDelaySec`, `minutes`, `durationMs`. `uptime` trong trạng thái là chuỗi khoảng thời gian của Go (`11m13s`).
- **Khóa tag** là `device/tag`, dạng mà mọi tham số `?tag=` và mọi trường `tag` nhận. Tên tag có thể chứa dấu gạch chéo (đường dẫn OPC UA, topic MQTT), nên chỉ dấu gạch chéo đầu tiên là chỗ tách: `plc-1/Line/Zone 1` là tag `Line/Zone 1` trên thiết bị `plc-1`.
- **Tham số truy vấn dạng số** mà không phải số thì bị bỏ qua và dùng giá trị mặc định, nên `?limit=abc` giống như không đặt `?limit`.
- **Danh sách rỗng** là `[]`, không bao giờ là `null`, trong mọi phản hồi và mọi sự kiện luồng, ở mọi độ sâu. Bạn không cần kiểm tra null trước `.length`. Một `null` bạn thấy không bao giờ là danh sách: nó là một trong các trường được ghi nhận là cho phép null, như `equipment_id` của thực thể hay `parent_id` của nút gốc. Một trường danh sách được đánh dấu tùy chọn vẫn có thể bị bỏ hẳn.

### Tính năng tùy chọn

Đội thiết bị, thông báo, sao lưu và báo cáo theo lịch đều tắt trừ khi đặt biến `HOTLOOP_*_ENABLED` của chúng. Khi tính năng tắt, route danh sách của nó vẫn trả lời 200, với `"configured": false` và danh sách rỗng, để màn hình có thể nói "chưa bật" thay vì "ở đây không có gì". Mọi route khác của tính năng đó trả lời 400 kèm lỗi nêu tên biến:

```json
{"error":"backups are not enabled (HOTLOOP_BACKUP_ENABLED)"}
```

`GET /api/sites` cũng làm vậy khi không có máy chủ MCP đi nào được cấu hình.

### Không có trong sản phẩm này

HotLoop được phát hành thành IoT, Edge, Gateway và Edge Relay từ một cơ sở mã, và một tính năng mà sản phẩm không có thì không bị tắt, mà không có trong tệp nhị phân. Trên IoT, Edge và Gateway, các route của nó vẫn trả lời, sau cùng một lần kiểm tra quyền, bằng một lỗi 404 nói rõ điều đó và nêu tên cả hai đầu, để script phân biệt được "sai thiết bị" với "sai URL":

```json
{"error":"scheduled reports are part of HotLoop Gateway; this is HotLoop IoT","product":"iot","feature":"reports"}
```

Không phải 400, vì không có biến nào để sửa được, và không phải 5xx, vì không có gì hỏng. `GET /api/status` cho biết ngay từ đầu sản phẩm nào đã trả lời và có những tính năng nào, để máy khách hỏi thay vì dò.

### Mọi thứ làm thay đổi điều gì đều được ghi lại

Mọi thao tác tạo, đổi, xóa, ghi, xác nhận và đăng nhập đều vào nhật ký hệ thống (`GET /api/events`) kèm tên người dùng, và mọi thao tác ghi vào một tag, bị từ chối hay không, đều vào nhật ký kiểm toán ghi (`GET /api/writes`). API không có đường đi lặng lẽ.

## Quyền

Ai có quyền gì. Tài khoản có danh sách quyền tường minh chỉ có đúng những gì danh sách đó nêu, thay cho bộ quyền của vai trò. `*` cấp mọi quyền và `resource.*` cấp mọi quyền dưới một tài nguyên (`reports.*`). Vai trò admin là `*`.

| Quyền | viewer | operator | admin |
|---|---|---|---|
| `status.read` | có | có | có |
| `devices.read` | có | có | có |
| `devices.write` | không | không | có |
| `tags.read` | có | có | có |
| `tags.write` | không | không | có |
| `values.read` | có | có | có |
| `values.write` | không | có | có |
| `board.write` | không | có | có |
| `entities.read` | có | có | có |
| `entities.write` | không | không | có |
| `helpers.write` | không | có | có |
| `equipment.read` | có | có | có |
| `equipment.write` | không | không | có |
| `alarms.read` | có | có | có |
| `alarms.write` | không | không | có |
| `alarms.ack` | không | có | có |
| `automations.read` | có | có | có |
| `automations.write` | không | không | có |
| `automations.trigger` | không | có | có |
| `scripts.read` | có | có | có |
| `scripts.run` | không | có | có |
| `scripts.write` | không | không | có |
| `recipes.read` | có | có | có |
| `recipes.apply` | không | có | có |
| `recipes.write` | không | không | có |
| `blueprints.read` | có | có | có |
| `blueprints.apply` | không | có | có |
| `blueprints.write` | không | không | có |
| `dashboards.read` | có | có | có |
| `dashboards.write` | không | không | có |
| `energy.read` | có | có | có |
| `energy.write` | không | không | có |
| `fleet.read` | có | có | có |
| `fleet.write` | không | có | có |
| `fleet.rebirth` | không | có | có |
| `fleet.restart` | không | không | có |
| `fleet.update` | không | không | có |
| `fleet.config` | không | không | có |
| `notify.test` | không | không | có |
| `notify.escalation` | không | không | có |
| `backup.read` | không | không | có |
| `backup.run` | không | không | có |
| `reports.read` | có | có | có |
| `reports.run` | không | có | có |
| `reports.write` | không | không | có |
| `sites.read` | có | có | có |
| `settings.read` | có | có | có |
| `settings.write` | không | không | có |
| `events.read` | có | có | có |
| `logbook.read` | có | có | có |
| `users.manage` | không | không | có |

Ranh giới ở đâu cũng giống nhau: operator vận hành nhà máy (ghi giá trị, xác nhận báo động, kích hoạt tự động hóa, huých một rơ-le), và chỉ admin mới thay đổi cách nhà máy được cấu hình, hoặc làm điều gì đó ra bên ngoài thay mặt Gateway (khởi động lại một relay, đẩy cấu hình cho nó, gửi một trang thử, định nghĩa một báo cáo gửi dữ liệu nhà máy qua email đến đâu đó).

## Chỉ mục endpoint

Cột quyền cho biết route kiểm tra gì. `session` nghĩa là bất kỳ người dùng nào đã đăng nhập, không cần quyền nào khác. `none` nghĩa là cũng không cần phiên, và mục tương ứng giải thích lý do. `(in handler)` nghĩa là việc kiểm tra được làm bên trong handler chứ không phải phía trước nó, và mục tương ứng giải thích lý do.

Cột sản phẩm cho biết HotLoop nhỏ nhất có route đó: `all` là IoT, Edge và Gateway, `edge` là Edge và Gateway, `gateway` chỉ là Gateway. Mọi sản phẩm đều đăng ký mọi route và kiểm tra cùng một quyền trên đó. Trên sản phẩm không có route đó, route trả lời 404 và nói nó nằm ở đâu; xem [Không có trong sản phẩm này](#không-có-trong-sản-phẩm-này).

| Phương thức | Đường dẫn | Quyền | Sản phẩm |
|---|---|---|---|
| `GET` | `/healthz` | none | all |
| `GET` | `/readyz` | none | all |
| `POST` | `/api/auth/login` | none | all |
| `POST` | `/api/auth/kiosk` | none | all |
| `POST` | `/api/auth/logout` | session | all |
| `POST` | `/api/auth/activity` | session | all |
| `GET` | `/api/auth/session` | session | all |
| `POST` | `/api/auth/password` | session | all |
| `GET` | `/api/users` | `users.manage` | all |
| `POST` | `/api/users` | `users.manage` | all |
| `PUT` | `/api/users/{username}` | `users.manage` | all |
| `DELETE` | `/api/users/{username}` | `users.manage` | all |
| `POST` | `/api/users/{username}/password` | `users.manage` | all |
| `DELETE` | `/api/users/{username}/lockout` | `users.manage` | all |
| `PUT` | `/api/users/{username}/pin` | `users.manage` | all |
| `DELETE` | `/api/users/{username}/pin` | `users.manage` | all |
| `GET` | `/api/opcua/certificates` | `users.manage` | all |
| `GET` | `/api/users/{username}/certificates` | `users.manage` | all |
| `POST` | `/api/users/{username}/certificates` | `users.manage` | all |
| `POST` | `/api/users/{username}/certificates/{thumbprint}/revoke` | `users.manage` | all |
| `DELETE` | `/api/users/{username}/certificates/{thumbprint}` | `users.manage` | all |
| `GET` | `/api/status` | `status.read` | all |
| `GET` | `/api/protocols` | `status.read` | all |
| `GET` | `/api/diagnostics` | `status.read` | all |
| `GET` | `/api/devices` | `devices.read` | all |
| `POST` | `/api/devices` | `devices.write` | all |
| `GET` | `/api/devices/{id}` | `devices.read` | all |
| `DELETE` | `/api/devices/{id}` | `devices.write` | all |
| `POST` | `/api/devices/{id}/enabled` | `devices.write` | all |
| `POST` | `/api/devices/{id}/browse` | `devices.read` | all |
| `POST` | `/api/devices/{id}/import` | `tags.write` | all |
| `GET` | `/api/devices/{id}/network` | `devices.read` | all |
| `PUT` | `/api/devices/{id}/network` | `devices.write` | all |
| `DELETE` | `/api/devices/{id}/network` | `devices.write` | all |
| `GET` | `/api/unifi/{id}/networks` | `devices.read` | all |
| `PUT` | `/api/unifi/{id}/networks/{network}` | `devices.write` | all |
| `POST` | `/api/unifi/{id}/networks/{network}/accept-all` | `devices.write` | all |
| `GET` | `/api/unifi/{id}/known` | `devices.read` | all |
| `PUT` | `/api/unifi/{id}/networks/{network}/known/{mac}` | `devices.write` | all |
| `DELETE` | `/api/unifi/{id}/networks/{network}/known/{mac}` | `devices.write` | all |
| `GET` | `/api/unifi/{id}/clients` | `devices.read` | all |
| `GET` | `/api/unifi/consoles` | `devices.read` | all |
| `GET` | `/api/unifi/{id}/overview` | `devices.read` | all |
| `GET` | `/api/unifi/{id}/topology` | `devices.read` | all |
| `GET` | `/api/unifi/{id}/devices` | `devices.read` | all |
| `GET` | `/api/unifi/{id}/wifi` | `devices.read` | all |
| `GET` | `/api/unifi/{id}/events` | `devices.read` | all |
| `POST` | `/api/unifi/{id}/starter-alarms` | `alarms.write` | all |
| `GET` | `/api/unifi-protect/{id}/cameras/{camera}/snapshot` | `devices.read` | all |
| `GET` | `/api/onvif/{id}/profiles/{profile}/snapshot` | `devices.read` | all |
| `POST` | `/api/onvif/discover` | `devices.write` | all |
| `GET` | `/api/discovery` | `devices.read` | all |
| `GET` | `/api/discovery/{source}/{key}` | `devices.read` | all |
| `POST` | `/api/discovery/{source}/{key}/accept` | `devices.write` | all |
| `POST` | `/api/discovery/{source}/{key}/ignore` | `devices.write` | all |
| `POST` | `/api/discovery/{source}/{key}/unignore` | `devices.write` | all |
| `POST` | `/api/discovery/{source}/{key}/review/apply` | `devices.write` | all |
| `POST` | `/api/discovery/{source}/{key}/review/reject` | `devices.write` | all |
| `GET` | `/api/network-discovery` | `devices.read` | all |
| `GET` | `/api/network-discovery/{key}` | `devices.read` | all |
| `POST` | `/api/network-discovery/{key}/accept` | `devices.write` | all |
| `POST` | `/api/network-discovery/{key}/ignore` | `devices.write` | all |
| `POST` | `/api/network-discovery/{key}/unignore` | `devices.write` | all |
| `POST` | `/api/network-discovery/probe` | `devices.write` | all |
| `GET` | `/api/integrations` | `devices.read` | all |
| `POST` | `/api/integrations/{id}/probe` | `devices.write` | all |
| `POST` | `/api/integrations/{id}/setup` | `devices.write` | all |
| `GET` | `/api/broker/logins` | `users.manage` | all |
| `POST` | `/api/broker/logins` | `users.manage` | all |
| `PUT` | `/api/broker/logins/{name}` | `users.manage` | all |
| `DELETE` | `/api/broker/logins/{name}` | `users.manage` | all |
| `GET` | `/api/mqtt/brokers` | `devices.read` | all |
| `POST` | `/api/mqtt/brokers` | `devices.write` | all |
| `PUT` | `/api/mqtt/brokers/{id}` | `devices.write` | all |
| `DELETE` | `/api/mqtt/brokers/{id}` | `devices.write` | all |
| `GET` | `/api/tags` | `tags.read` | all |
| `POST` | `/api/tags` | `tags.write` | all |
| `DELETE` | `/api/tags/{device}/{name}` | `tags.write` | all |
| `GET` | `/api/values` | `values.read` | all |
| `GET` | `/api/sparkline` | `values.read` | all |
| `GET` | `/api/board` | `values.read` | all |
| `PUT` | `/api/board` | `board.write` | all |
| `POST` | `/api/write` | `values.write` | all |
| `GET` | `/api/history` | `values.read` | all |
| `GET` | `/api/writes` | `values.read` | all |
| `GET` | `/api/entities` | `entities.read` | all |
| `GET` | `/api/entities/composites` | `entities.read` | all |
| `GET` | `/api/entities/{entity_id}` | `entities.read` | all |
| `GET` | `/api/entities/{entity_id}/image` | `entities.read` | all |
| `PUT` | `/api/entities/{entity_id}` | `entities.write` | all |
| `POST` | `/api/entities` | `entities.write` | all |
| `DELETE` | `/api/entities/{entity_id}` | `entities.write` | all |
| `GET` | `/api/states` | `entities.read` | all |
| `GET` | `/api/states/{entity_id}` | `entities.read` | all |
| `GET` | `/api/energy/meters` | `energy.read` | all |
| `POST` | `/api/energy/meters` | `energy.write` | all |
| `GET` | `/api/energy/meters/{id}` | `energy.read` | all |
| `PUT` | `/api/energy/meters/{id}` | `energy.write` | all |
| `DELETE` | `/api/energy/meters/{id}` | `energy.write` | all |
| `GET` | `/api/energy/summary` | `energy.read` | all |
| `GET` | `/api/energy/summary/{period}` | `energy.read` | all |
| `GET` | `/api/energy/series` | `energy.read` | all |
| `GET` | `/api/energy/series/{meter}/{period}/{step}` | `energy.read` | all |
| `POST` | `/api/services/{domain}/{service}` | `values.write`, `alarms.ack`, `helpers.write`, `scripts.run`, `recipes.apply` (in handler) | all |
| `GET` | `/api/helpers` | `entities.read` | all |
| `POST` | `/api/helpers` | `entities.write` | all |
| `GET` | `/api/helpers/{entity_id}` | `entities.read` | all |
| `PUT` | `/api/helpers/{entity_id}` | `entities.write` | all |
| `DELETE` | `/api/helpers/{entity_id}` | `entities.write` | all |
| `GET` | `/api/equipment` | `equipment.read` | all |
| `POST` | `/api/equipment` | `equipment.write` | all |
| `GET` | `/api/equipment/{id}` | `equipment.read` | all |
| `PUT` | `/api/equipment/{id}` | `equipment.write` | all |
| `DELETE` | `/api/equipment/{id}` | `equipment.write` | all |
| `GET` | `/api/labels` | `equipment.read` | all |
| `POST` | `/api/labels` | `equipment.write` | all |
| `GET` | `/api/labels/{label_id}` | `equipment.read` | all |
| `PUT` | `/api/labels/{label_id}` | `equipment.write` | all |
| `DELETE` | `/api/labels/{label_id}` | `equipment.write` | all |
| `PUT` | `/api/devices/{id}/labels` | `equipment.write` | all |
| `GET` | `/api/alarms` | `alarms.read` | all |
| `POST` | `/api/alarms` | `alarms.write` | all |
| `POST` | `/api/alarms/import/codesys` | `alarms.write` | all |
| `DELETE` | `/api/alarms/{id}` | `alarms.write` | all |
| `POST` | `/api/alarms/{id}/ack` | `alarms.ack` | all |
| `POST` | `/api/alarms/{id}/shelve` | `alarms.ack` | all |
| `POST` | `/api/alarms/{id}/unshelve` | `alarms.ack` | all |
| `GET` | `/api/alarms/events` | `alarms.read` | all |
| `GET` | `/api/automations` | `automations.read` | all |
| `POST` | `/api/automations` | `automations.write` | all |
| `POST` | `/api/automations/validate` | `automations.write` | all |
| `DELETE` | `/api/automations/{id}` | `automations.write` | all |
| `POST` | `/api/automations/{id}/enabled` | `automations.write` | all |
| `POST` | `/api/automations/{id}/trigger` | `automations.trigger` | all |
| `GET` | `/api/runs` | `automations.read` | all |
| `POST` | `/api/automations/{id}/blueprint-upgrade` | `blueprints.apply` | all |
| `GET` | `/api/blueprints` | `blueprints.read` | all |
| `POST` | `/api/blueprints` | `blueprints.write` | all |
| `GET` | `/api/blueprints/{id}` | `blueprints.read` | all |
| `PUT` | `/api/blueprints/{id}` | `blueprints.write` | all |
| `DELETE` | `/api/blueprints/{id}` | `blueprints.write` | all |
| `POST` | `/api/blueprints/{id}/instantiate` | `blueprints.apply` | all |
| `GET` | `/api/dashboards` | `dashboards.read` | all |
| `POST` | `/api/dashboards` | `dashboards.write` | all |
| `GET` | `/api/dashboards/{id}` | `dashboards.read` | all |
| `PUT` | `/api/dashboards/{id}` | `dashboards.write` | all |
| `DELETE` | `/api/dashboards/{id}` | `dashboards.write` | all |
| `GET` | `/api/dashboards/{id}/export` | `dashboards.read` | all |
| `POST` | `/api/dashboards/import` | `dashboards.write` | all |
| `GET` | `/api/scripts` | `scripts.read` | all |
| `POST` | `/api/scripts` | `scripts.write` | all |
| `POST` | `/api/scripts/validate` | `scripts.write` | all |
| `GET` | `/api/scripts/{id}` | `scripts.read` | all |
| `PUT` | `/api/scripts/{id}` | `scripts.write` | all |
| `DELETE` | `/api/scripts/{id}` | `scripts.write` | all |
| `POST` | `/api/scripts/{id}/run` | `scripts.run` | all |
| `POST` | `/api/scripts/{id}/stop` | `scripts.run` | all |
| `GET` | `/api/scripts/{id}/runs` | `scripts.read` | all |
| `GET` | `/api/recipes` | `recipes.read` | all |
| `POST` | `/api/recipes` | `recipes.write` | all |
| `POST` | `/api/recipes/capture` | `recipes.write` | all |
| `GET` | `/api/recipes/{id}` | `recipes.read` | all |
| `PUT` | `/api/recipes/{id}` | `recipes.write` | all |
| `DELETE` | `/api/recipes/{id}` | `recipes.write` | all |
| `GET` | `/api/recipes/{id}/versions` | `recipes.read` | all |
| `GET` | `/api/recipes/{id}/versions/{version}` | `recipes.read` | all |
| `POST` | `/api/recipes/{id}/validate` | `recipes.apply` | all |
| `POST` | `/api/recipes/{id}/apply` | `recipes.apply` | all |
| `GET` | `/api/recipes/{id}/applications` | `recipes.read` | all |
| `POST` | `/api/webhook/{path}` | none | all |
| `GET` | `/api/fleet` | `fleet.read` | gateway |
| `POST` | `/api/fleet` | `fleet.write` | gateway |
| `DELETE` | `/api/fleet/{id}` | `fleet.write` | gateway |
| `POST` | `/api/fleet/{id}/rebirth` | `fleet.rebirth` | gateway |
| `POST` | `/api/fleet/{id}/restart` | `fleet.restart` | gateway |
| `POST` | `/api/fleet/{id}/update` | `fleet.update` | gateway |
| `POST` | `/api/fleet/{id}/config` | `fleet.config` | gateway |
| `DELETE` | `/api/fleet/{id}/config` | `fleet.config` | gateway |
| `POST` | `/api/notify/test` | `notify.test` | all |
| `GET` | `/api/notify/escalation` | `notify.escalation` | all |
| `PUT` | `/api/notify/escalation` | `notify.escalation` | all |
| `POST` | `/api/notify/ack/{token}` | none | all |
| `GET` | `/api/backup` | `backup.read` | all |
| `POST` | `/api/backup` | `backup.run` | all |
| `GET` | `/api/reports` | `reports.read` | gateway |
| `POST` | `/api/reports` | `reports.write` | gateway |
| `GET` | `/api/reports/{id}` | `reports.read` | gateway |
| `PUT` | `/api/reports/{id}` | `reports.write` | gateway |
| `DELETE` | `/api/reports/{id}` | `reports.write` | gateway |
| `POST` | `/api/reports/{id}/run` | `reports.run` | gateway |
| `GET` | `/api/reports/{id}/runs` | `reports.read` | gateway |
| `GET` | `/api/reports/{id}/runs/{run}/download` | `reports.read` | gateway |
| `GET` | `/api/sites` | `sites.read` | gateway |
| `GET` | `/api/settings` | `settings.read` | all |
| `PUT` | `/api/settings` | `settings.write` | all |
| `GET` | `/api/destinations` | `settings.read` | all |
| `GET` | `/api/opcua/server` | `users.manage` | all |
| `PUT` | `/api/destinations/{kind}` | `settings.write` | all |
| `GET` | `/api/historian/targets` | `settings.read` | all |
| `POST` | `/api/historian/targets` | `settings.write` | all |
| `PUT` | `/api/historian/targets/{id}` | `settings.write` | all |
| `DELETE` | `/api/historian/targets/{id}` | `settings.write` | all |
| `GET` | `/api/events` | `events.read` | all |
| `GET` | `/api/logbook` | `logbook.read` | all |
| `GET` | `/api/stream` | `status.read` | all |
| bất kỳ | `/mcp` | token MCP | all |
| bất kỳ | `/mcp/` | token MCP | all |
| `GET` | `/manifest.webmanifest` | none | all |
| `GET` | `/sw.js` | none | all |
| `GET` | `/next` | none | all |
| `GET` | `/next/` | none | all |
| bất kỳ | `/` | none | all |

## Tình trạng

Dành cho kubelet và các bộ cân bằng tải. Không cái nào cần phiên: một probe không có tài khoản, và không cái nào nói gì về nhà máy.

### `GET /healthz`

Liveness. `200` kèm văn bản `ok` miễn là tiến trình còn phục vụ HTTP. Nó không đụng tới cơ sở dữ liệu, có chủ ý: sự cố cơ sở dữ liệu nên đưa pod ra khỏi vòng phục vụ, chứ không phải khiến nó khởi động lại liên tục.

### `GET /readyz`

Readiness. Ping cơ sở dữ liệu với giới hạn 5 giây.

```json
{"status":"ready"}
```

`503` khi không tới được, kèm lý do trong `detail` (dạng do handler quyết định; nội dung lý do là điều trình điều khiển cơ sở dữ liệu đã nói):

```json
{"error":"not ready","detail":"<why the database did not answer>"}
```

Một ứng dụng không tới được historian của mình thì không nên nhận lưu lượng.

## Xác thực

Xem [Xác thực và người dùng](/vi/iot/authentication/) về tài khoản, vai trò và quản trị viên đầu tiên.

### `POST /api/auth/login`

Không cần phiên, theo thiết kế.

| Trường | Kiểu | <span class="sr-only">Chi tiết</span> |
|---|---|---|
| `username` | string | Bắt buộc. Chữ hoa chữ thường và khoảng trắng hai đầu đều bị bỏ qua |
| `password` | string | Bắt buộc |

```json
{"expiresAt":"2026-09-28T08:21:00.571794Z","permissions":["*"],"role":"admin","token":"<token>","username":"admin"}
```

Đồng thời đặt cookie `iiot_session` thành cùng token đó. `401` `"invalid username or password"` cho tên sai, mật khẩu sai hay tài khoản bị tắt như nhau, và thời gian xử lý luôn như nhau: việc nó là trường hợp nào trong ba không phải điều nói cho người lạ. `429` cho tài khoản đã sai mật khẩu hoặc PIN quá nhiều lần liên tiếp, bất kể gửi gì, kèm header `Retry-After`; xem [Xác thực và người dùng](/vi/iot/authentication/#khóa-sau-khi-nhập-sai-mật-khẩu-và-pin).

### `POST /api/auth/kiosk`

Đăng nhập tại bảng điều khiển dùng chung bằng PIN hoặc thẻ, theo cách [Xác thực và người dùng](/vi/iot/authentication/#bảng-kiosk-mã-pin-hoặc-thẻ-và-tự-đăng-xuất-khi-nhàn-rỗi) mô tả. Không cần phiên, theo thiết kế.

| Trường | Kiểu | <span class="sr-only">Chi tiết</span> |
|---|---|---|
| `code` | string | Bắt buộc. PIN, hoặc giá trị mà đầu đọc thẻ kiểu bàn phím đã gõ. Khoảng trắng hai đầu bị bỏ qua |
| `username` | string | Tùy chọn. Có nó thì chỉ kiểm tra PIN của tài khoản đó và một lần sai được tính vào việc khóa tài khoản đó. Không có thì mã được tìm trong mã của mọi tài khoản |

```json
{"expiresAt":"2026-10-21T08:21:00.571794Z","idleSec":300,"permissions":["status.read","tags.read"],"role":"operator","username":"olga"}
```

Đặt cookie `iiot_session` và, khác với `POST /api/auth/login`, không trả lời bằng token: phiên kiosk thuộc về trình duyệt tại bảng điều khiển. `idleSec` là thời gian phiên tồn tại khi không ai chạm vào. `401` `"that PIN or badge isn't recognized"` cho mã sai, mã quá ngắn và mã của tài khoản bị tắt như nhau, và thời gian xử lý luôn như nhau. `429` khi tài khoản bị khóa (xem [Việc khóa](/vi/iot/authentication/#khóa-sau-khi-nhập-sai-mật-khẩu-và-pin)), kèm header `Retry-After`. Mã gửi không kèm `username` mà không khớp với ai thì không tính vào tài khoản nào; bảng điều khiển đã gửi, theo địa chỉ máy khách, phải chờ thêm nửa giây trước khi lần thử tương tự tiếp theo được kiểm tra, tối đa `ui.panelDelaySeconds`, và một mã đúng sẽ đặt lại từ đầu. Bảng điều khiển không bao giờ bị khóa. `400` khi hệ thống chạy không có đăng nhập (`HOTLOOP_AUTH_INSECURE`), vì khi đó không có ai để đăng nhập với tư cách.

### `POST /api/auth/activity`

Có người đã chạm vào bảng điều khiển. Không có phần thân. `{"status":"ok"}`. Trên phiên kiosk, đây là thứ đẩy giới hạn nhàn rỗi của nó đi tiếp; mọi yêu cầu khác không phải thao tác đọc (ghi, xác nhận) cũng vậy. `GET`, luồng trực tiếp và các lần tải nền của chính trang thì không: nếu không chúng sẽ giữ người cuối cùng đăng nhập mãi mãi. Phiên tạo bằng mật khẩu không có giới hạn nhàn rỗi và không có gì để đẩy.

### `POST /api/auth/logout`

Kết thúc phiên mà yêu cầu mang theo (cookie hoặc bearer) và xóa cookie. Không có phần thân. `{"status":"logged out"}`.

### `GET /api/auth/session`

Tôi là ai. Dùng cho trình tự khởi động của giao diện.

```json
{"authenticated":true,"permissions":["*"],"role":"admin","username":"admin"}
```

Phiên tạo tại bảng điều khiển kiosk thêm `"idleSec"`, giới hạn nhàn rỗi tính bằng giây, nhờ đó trang biết phải tự đăng xuất.

Khi tắt xác thực (`HOTLOOP_AUTH_INSECURE`), nó trả lời `{"authenticated":false,"insecure":true}` thay vì 401, để giao diện nói được vì sao không có đăng nhập thay vì đoán.

### `POST /api/auth/password`

Đổi mật khẩu của chính bạn. Không cần quyền: biết mật khẩu hiện tại chính là thông tin xác thực.

| Trường | Kiểu | <span class="sr-only">Chi tiết</span> |
|---|---|---|
| `currentPassword` | string | Bắt buộc |
| `newPassword` | string | Bắt buộc, ít nhất 8 ký tự |

`{"status":"password changed; log in again"}`. **Mọi phiên của tài khoản đều kết thúc, kể cả phiên này**, và cookie bị xóa: đổi mật khẩu mà để các phiên cũ vẫn chạy thì chỉ đổi trên danh nghĩa. `401` nếu mật khẩu hiện tại sai, `400` nếu mật khẩu mới quá ngắn.

## Người dùng

Tất cả chỉ dành cho quản trị viên (`users.manage`). Mã băm mật khẩu không bao giờ xuất hiện trong phản hồi; trường đó không có tên JSON.

### `GET /api/users`

```json
[{"username":"admin","role":"admin","disabled":false,"hasPin":false,"locked":false,"createdAt":"2026-09-27T20:19:28.036228Z","updatedAt":"2026-09-27T20:19:28.036228Z","lastLogin":"2026-09-27T20:21:00.575455Z"}]
```

`permissions` chỉ xuất hiện trên tài khoản có danh sách tường minh. `hasPin` cho biết tài khoản có PIN hoặc thẻ kiosk hay không; giá trị và mã băm của nó không bao giờ xuất hiện.

### `POST /api/users`

| Trường | Kiểu | <span class="sr-only">Chi tiết</span> |
|---|---|---|
| `username` | string | Bắt buộc. Chữ thường, chữ số, dấu chấm, gạch dưới, gạch nối, bắt đầu bằng chữ cái hoặc chữ số, từ 2 đến 64 ký tự |
| `password` | string | Bắt buộc, ít nhất 8 ký tự |
| `role` | string | `admin`, `operator` hoặc `viewer`. Mặc định là `viewer` |
| `permissions` | string[] | Tùy chọn. Thay thế hoàn toàn bộ quyền của vai trò |

Trả về người dùng mới. `400` cho tên, vai trò hoặc mật khẩu không hợp lệ, `409` nếu tên đã có người dùng.

### `PUT /api/users/{username}`

| Trường | Kiểu | <span class="sr-only">Chi tiết</span> |
|---|---|---|
| `role` | string | Bắt buộc trừ khi đặt `permissions` |
| `permissions` | string[] | Tùy chọn. Rỗng nghĩa là "dùng vai trò" |
| `disabled` | bool | `true` tắt tài khoản và kết thúc mọi phiên của nó |

Trả về người dùng đã cập nhật. `400` cho vai trò không xác định, hoặc khi tắt quản trị viên cuối cùng còn hoạt động: đó là tự khóa mình mà không còn ai để hoàn tác. `404` cho người dùng không xác định.

### `DELETE /api/users/{username}`

`{"status":"deleted"}`. `400` cho tài khoản của chính bạn hoặc quản trị viên cuối cùng còn hoạt động, `404` cho người dùng không xác định.

### `POST /api/users/{username}/password`

Quản trị viên đặt mật khẩu của người khác mà không cần biết mật khẩu cũ. `{"password": "..."}`, ít nhất 8 ký tự. Trả về `{"status":"password reset"}` và kết thúc mọi phiên của tài khoản đó.

### `PUT /api/users/{username}/pin`

Quản trị viên đặt cho tài khoản một PIN hoặc giá trị thẻ để đăng nhập tại bảng điều khiển kiosk, hoặc thay cái đang có. `{"code": "482913"}`: 6 đến 72 ký tự, không có khoảng trắng hay ký tự điều khiển, chữ số hoặc bất cứ thứ gì đầu đọc thẻ gõ ra. Trả về `{"status":"PIN set","username":"olga","hasPin":true}`. Giá trị được băm bằng bcrypt như mật khẩu, và không bao giờ được ghi nhật ký hay gửi lại. `400` cho mã quá ngắn, quá dài hoặc có khoảng trắng, và cho mã mà tài khoản khác đã có: bảng điều khiển tìm tài khoản chỉ bằng mã, nên một mã mở một tài khoản. `404` cho người dùng không xác định. Nó không đụng tới mật khẩu hay phiên nào.

### `DELETE /api/users/{username}/lockout`

Cho tài khoản bị khóa vào lại trước khi hết thời gian khóa, và đếm lại số lần sai mật khẩu và PIN từ không. `{"status":"unlocked","username":"olga","locked":false}`. `404` cho người dùng không xác định. Tài khoản bị khóa hiện `"locked":true` và `"lockedUntil"` trong `GET /api/users`.

### `DELETE /api/users/{username}/pin`

Gỡ PIN hoặc thẻ và đăng xuất tài khoản khỏi mọi bảng điều khiển kiosk nó đang đăng nhập. Mật khẩu của nó, và các phiên trên máy tính riêng của nó, không bị đụng tới. `{"status":"PIN cleared","username":"olga","hasPin":false}`. `404` cho người dùng không xác định.

### `GET /api/opcua/certificates`

Mọi chứng chỉ X.509 gắn với người dùng để đăng nhập vào máy chủ OPC UA (xem [máy chủ OPC UA](/vi/edge/opc-ua-server/#chứng-chỉ-người-dùng-x509)), mới nhất trước: `{"serverAcceptsCertificates":false,"certificates":[...]}`. Mỗi chứng chỉ có `thumbprint` (SHA-256 của dạng DER, hex chữ thường), `username`, `label`, `subject`, `notBefore`, `notAfter`, `addedBy`, `addedAt`, `revokedAt` và `revokedBy` khi đã thu hồi, `lastUsed` khi đã dùng, và `state`: `active`, `revoked`, `expired` hoặc `not yet valid`. Chỉ chứng chỉ đang hoạt động mới đăng nhập được. `serverAcceptsCertificates` cho biết máy chủ OPC UA có đang bật và đã đặt `HOTLOOP_OPCUA_SERVER_ALLOW_X509` hay không; chứng chỉ được giữ trong cả hai trường hợp. Chỉ chứng chỉ công khai được lưu hoặc gửi.

### `GET /api/users/{username}/certificates`

Cùng danh sách đó cho một người dùng. `404` cho người dùng không xác định.

### `POST /api/users/{username}/certificates`

Gắn chứng chỉ cho người dùng. `{"certificate": "<PEM text or base64 of the DER bytes>", "label": "Olga's laptop"}`; nhãn là tùy chọn. Trả về `201` cùng chứng chỉ như trong danh sách. Chứng chỉ phải là RSA với khóa ít nhất 2048 bit và chưa hết hạn. `400` nói rõ trường hợp nào, và cả cho thứ không phải chứng chỉ: khóa riêng bị từ chối đích danh và không bao giờ được giữ hay gửi lại, chuỗi chứng chỉ cũng vậy. `404` cho người dùng không xác định. `409` khi chứng chỉ đã được gắn, cho người dùng này hoặc người khác: một chứng chỉ là một người. Thay đổi được ghi trong nhật ký công việc kèm người thực hiện.

### `POST /api/users/{username}/certificates/{thumbprint}/revoke`

Thu hồi một chứng chỉ. Nó không còn đăng nhập được, phiên đang mở bằng nó kết thúc trong 10 giây của bộ nhớ đệm quyền, và các lần thử sau bị từ chối và ghi nhật ký là đã thu hồi. Nó vẫn nằm trong danh sách với trạng thái `revoked` kèm người làm và thời điểm, và thu hồi lần nữa vẫn giữ bản ghi đầu. `{thumbprint}` là SHA-256 như trong danh sách; dấu hai chấm, khoảng trắng và chữ hoa đều được chấp nhận. `404` khi chứng chỉ không thuộc người dùng này.

### `DELETE /api/users/{username}/certificates/{thumbprint}`

Quên một chứng chỉ. Gắn lại thì nó hoạt động lại. `404` khi nó không thuộc người dùng này. Xóa người dùng sẽ xóa các chứng chỉ của họ.

## Trạng thái và chẩn đoán

### `GET /api/status`

Thanh tiêu đề: bộ đếm runtime, tóm tắt báo động, tên nhà máy và đây là sản phẩm nào. `product` là `iot`, `edge` hoặc `gateway`, giống `hotloop --product`. `features` cho biết sản phẩm này có những tính năng nào trong số các tính năng khác nhau giữa các sản phẩm: `edge-publish`, `fleet`, `opcua-server`, `reports` và `sites` trong Gateway, tính năng thứ nhất và thứ ba trong Edge, không có trong IoT. `version` là bản dựng, còn `imageDigest` là digest của image mà nó được khởi động từ đó, điều mà số phiên bản không cho bạn biết trên một thiết bị đi theo `:stable`. Nó chỉ có khi trình giám sát đã nói (các unit Quadlet làm vậy trước mỗi lần khởi động; tệp nhị phân trần và bản cài Helm thì không) và bị bỏ nếu không.

```json
{
  "alarms": {"critical":0,"high":1,"medium":0,"low":0,"unacked":0,"total":1},
  "features": ["edge-publish","fleet","opcua-server","reports","sites"],
  "plantName": "Demo Plant",
  "product": "gateway",
  "runtime": {
    "startedAt": "2026-09-27T20:19:28.06635851Z", "uptime": "11m13s",
    "devices": 2, "connected": 2, "degraded": 0, "disconnected": 0,
    "tags": 5, "cachedTags": 5, "writesOk": 4, "writesRefused": 3,
    "bus": {"subscribers":4,"published":653,"dropped":0},
    "historian": {"queued":1085,"written":1085,"filtered":329,"dropped":0,"failed":0,"queueLen":0,"queueCap":50000},
    "writePolicy": {"allowWrites":true,"allowMcpWrites":true,"confirmWrites":true},
    "protocols": ["codesys","ethernet-ip","http","modbus","mqtt","mtconnect","opcua","s7comm","snmp","unifi"]
  },
  "siteId": "docs",
  "version": "4.24.0"
}
```

### `GET /api/protocols`

Mọi giao thức mà Gateway biết, và bản dựng này có trình điều khiển của nó hay không.

```json
[{"id":"opcua","name":"OPC UA","description":"The universal one. ...","transport":"opc.tcp binary","defaultPort":4840,"writable":true,"browsable":true,"deviceTypes":["plc","cnc","robot","ipc","hmi","historian","gateway"],"library":"...","available":true}]
```

### `GET /api/diagnostics`

Những gì màn hình chẩn đoán hiển thị: pool cơ sở dữ liệu, hàng đợi historian và kích thước lịch sử, bus tag, bộ máy thực thể, bộ ghi của nhật ký công việc, runtime, MCP (máy chủ và các kết nối đi) và các quy tắc đã kích hoạt của bộ máy tự động hóa, đường dẫn webhook và hàng đợi thay đổi trạng thái.

```json
{
  "automations": {"armed":[],"stateChangesDropped":0,"stateChangesPending":0,"webhooks":[]},
  "bus": {"subscribers":4,"published":654,"dropped":0},
  "database": {"type":"postgres","totalConns":3,"idleConns":3,"acquiredConns":0,"maxConns":10,"historyMode":"timescale","timescaleVersion":"2.30.1"},
  "entities": {"entities":8,"droppedBatches":0,"pendingChanges":0,"droppedChanges":0},
  "historian": {"queued":1087,"written":1085,"filtered":329,"dropped":0,"failed":0,"queueLen":0,"queueCap":50000},
  "historyStats": {"mode":"timescale","rows":996,"distinctTags":5,"oldest":"2026-09-27T20:21:38.609853Z","newest":"2026-09-27T20:30:39.507987Z","sizeBytes":73728},
  "logbook": {"recording":true,"retentionDays":90,"queued":0,"dropped":0,"written":212,"suppressed":36,"writeErrors":0},
  "mcp": {"outbound":[],"path":"/mcp","serverEnabled":true,"tokenSet":true},
  "runtime": {"...": "the same block as /api/status"}
}
```

Khi có máy chủ MCP đi được cấu hình, `outbound` liệt kê từng máy chủ:

```json
{"name":"plant-a","target":"http://localhost:8080/mcp","connected":true,"tools":["ack_alarm","call_service","...","write_tag"],"connectedSince":"2026-09-27T20:45:50Z"}
```

Mọi thông tin xác thực trong `target` hoặc `lastError` của máy chủ đi đều bị xóa, vì một URL hay dòng lệnh có thể mang token và mọi vai trò đều đọc được thứ này. Bản thân token MCP chỉ bao giờ là `tokenSet`.

## Thiết bị

Một thiết bị là một kết nối qua một giao thức. Nội dung trong `config` và `address` phụ thuộc vào giao thức: xem [Giao thức và trình điều khiển](/vi/iot/protocols/).

### `GET /api/devices`

Mọi thiết bị, kèm trạng thái kết nối trực tiếp. Thông tin xác thực là `[redacted]`. `?q=` giữ các thiết bị có id, tên, địa chỉ hoặc giao thức chứa đoạn văn bản (không phân biệt hoa thường), `?limit=` (1 đến 5000, giá trị khác là `400`) giữ những thiết bị đầu tiên; với một trong hai, `X-Total-Count` là số thiết bị khớp.

```json
[{"id":"tank-farm","name":"Tank farm","protocol":"mqtt","address":"base-mqtt:1883","enabled":true,
  "site":"Demo Plant","area":"Utilities","equipmentId":4,
  "config":{"clientId":"docs-api-tankfarm","password":"[redacted]","topics":["docs-api-example/#"],"username":"tank","writeTopic":"docs-api-example/{tag}/set"},
  "createdAt":"2026-09-27T20:21:01.637319Z","updatedAt":"2026-09-27T20:21:01.637319Z",
  "state":"connected","lastPoll":"2026-09-27T20:21:39.412Z",
  "latencyMs":0.002,"tagCount":3,"pollCount":1}]
```

`state` là `connected`, `connecting`, `degraded` (đang chạy nhưng các lần thăm dò thất bại), `disconnected` hoặc `disabled`. `lastError`, `errorCount` và phần còn lại xuất hiện khi có điều cần nói.

### `POST /api/devices`

Tạo thiết bị nếu `id` là mới, thay thế nếu không. Không có `PUT`.

| Trường | Kiểu | <span class="sr-only">Chi tiết</span> |
|---|---|---|
| `id` | string | Bắt buộc. 1 đến 64 chữ cái, chữ số, `.`, `_`, `-`, bắt đầu bằng chữ cái hoặc chữ số. Nó xuất hiện trong URL, topic MQTT và đối số MCP |
| `name` | string | Bắt buộc |
| `protocol` | string | Bắt buộc. Một giao thức mà bản dựng này có trình điều khiển (`GET /api/protocols`) |
| `address` | string | Bắt buộc. Host và cổng, hoặc URL `opc.tcp://` hay `http://`: giao thức quyết định |
| `enabled` | bool | Bỏ sót là `false` |
| `description` | string | |
| `pollIntervalMs`, `timeoutMs` | int | 0 lấy giá trị mặc định của runtime. Khoảng thăm dò có mức sàn là `HOTLOOP_MIN_POLL_INTERVAL` |
| `site`, `area`, `line` | string | Đặt thiết bị vào cây thiết bị theo tên, tạo các nút khi cần |
| `equipmentId` | int | Thay vào đó đặt nó vào một nút của cây; khi đó `site`, `area` và `line` lấy từ nút. Xem [cây thiết bị và nhãn](/vi/iot/equipment/) |
| `config` | object | Các tùy chọn riêng của giao thức. Thông tin xác thực theo [quy tắc chỉ ghi](#bí-mật-chỉ-ghi-không-đọc) |

Các trường runtime (`state`, `lastPoll`, `tagCount` v.v.) chỉ đọc; gửi lại thì bị bỏ qua. Trả về thiết bị đã lưu, đã che thông tin nhạy cảm. `400` cho giao thức không có trình điều khiển, kiểm tra không đạt hoặc vi phạm quy tắc thông tin xác thực; runtime tải lại ngay với nó.

```json
{"error":"no driver for protocol \"profibus\"; this build speaks: ethernet-ip, http, modbus, mqtt, mtconnect, opcua, s7comm, snmp, unifi"}
```

### `GET /api/devices/{id}`

Thiết bị, các tag và nhãn của nó.

```json
{"device":{"id":"tank-farm","name":"Tank farm","...":"..."},"labels":["critical"],"tags":[{"id":3,"deviceId":"tank-farm","name":"level","...":"..."}]}
```

`tags` là `[]` với thiết bị không có tag nào. `404` cho id không xác định.

### `DELETE /api/devices/{id}`

Xóa thiết bị, các tag và thực thể của chúng. **Lịch sử của nó được giữ lại.** `{"deleted":"tank-farm"}`, hoặc `404`.

### `POST /api/devices/{id}/enabled`

`{"enabled": false}` dừng thăm dò mà không xóa gì. Trả về `{"enabled":false,"id":"tank-farm"}`. `404` cho id không xác định.

### `POST /api/devices/{id}/browse`

Hỏi thiết bị nó có những điểm nào. Chỉ cần `devices.read`, vì nó chỉ đọc. Không có phần thân.

```json
{"supported":true,"tags":[{"name":"Plant_Boiler_Temperature","address":"nsu=http://plant/;s=Temperature","dataType":"float","description":"Temperature","writable":true}]}
```

Giao thức không liệt kê được các điểm của nó (Modbus, S7comm, HTTP) trả về `200` kèm `{"supported":false,"reason":"..."}`: đó là một sự thật về giao thức, không phải lỗi. `503` nếu thiết bị chưa kết nối. `writable` ở đây là điều thiết bị nói về điểm đó, không phải việc Gateway có ghi nó hay không.

### `POST /api/devices/{id}/import`

Biến kết quả duyệt thành các tag đã cấu hình. Cần `tags.write`, vì nó tạo tag.

```json
{"tags":[{"name":"Temperature","address":"nsu=http://emberburn/;s=Temperature","dataType":"float","unit":"C"}]}
```

Mỗi mục nhận `name`, `address`, `dataType`, `unit`, `description`, `deviceClass` và `writable` (kết quả duyệt đúng như nó đến). Trả về `{"inserted":2,"updated":0}`. **Mọi tag được nhập đều chỉ đọc**, dù thiết bị nói gì: một điểm được phát hiện không phải điểm mà ai đó đã quyết định được phép điều khiển, và đặt mặc định ngược lại sẽ kích hoạt vài nghìn điểm cùng lúc. Hãy kích hoạt những tag bạn muốn bằng `POST /api/tags`. `404` cho thiết bị không xác định.

## UniFi: mạng OT, máy khách và vị trí của một thiết bị trên mạng

Bản ghi riêng của HotLoop về các site UniFi. Xem [UniFi Network](/vi/iot/unifi/). `{id}` dưới `/api/unifi` là một thiết bị UniFi (một site trên một bảng điều khiển); `{network}` là ID mà chính bảng điều khiển đặt cho một mạng, như `GET .../networks` trả về; `{mac}` nhận mọi cách viết thông thường và được lưu bằng chữ thường có dấu hai chấm.

**Không lệnh gọi nào trong số này hỏi bảng điều khiển điều gì.** Chúng đọc lần đọc gần nhất của trình điều khiển từ nó, nên một màn hình để mở không tốn gì của bảng điều khiển. Điều đó cũng có nghĩa là chúng trả lời `503` cho đến khi thiết bị được đọc một lần, và luôn như vậy trong một trình trợ giúp `--mcp-stdio`, vốn không bao giờ đăng nhập vào bảng điều khiển. Chúng cũng không ghi gì vào bảng điều khiển.

Một thay đổi tạo hoặc xóa báo động sẽ nói rõ trong `change`: `{"alarmsCreated":["unifi-unknown-3f2a9c01b7de"]}`. Đó là các định nghĩa báo động thông thường, dưới `/api/alarms`.

### `GET /api/devices/{id}/network`

Vị trí của một thiết bị HotLoop (một PLC, một đồng hồ đo) trên mạng. Khi đã liên kết:

```json
{"deviceId":"plc-07","link":{"deviceId":"plc-07","consoleId":"plant-net","mac":"02:48:4c:00:00:07","confirmedBy":"hana","confirmedAt":"2026-09-28T18:02:05Z"},
 "consoleName":"Plant network","client":{"mac":"02:48:4c:00:00:07","ip":"10.77.0.7","switchMac":"00:27:22:e2:1d:6f","switchName":"USW Lite 8 PoE","port":5,"portUp":false,"online":false,"lastSeen":"2026-09-28T18:01:40Z","lastSeenSec":25,"why":"its switch port 5 has no link","...":"..."},
 "readAt":"2026-09-28T18:02:05Z","summary":"on USW Lite 8 PoE port 5, link down; the console last saw it 25s ago; off the network: its switch port 5 has no link","proposals":[]}
```

Khi chưa liên kết, `link` là `null` và `proposals` liệt kê các máy khách mà bất kỳ bảng điều khiển nào HotLoop đọc có tại IP của thiết bị, mới nhất trước. Một đề xuất chỉ là đề xuất: IP của bảng điều khiển bị trễ, nên không có gì được liên kết cho đến khi quản trị viên xác nhận một cái.

### `PUT /api/devices/{id}/network`

`{"consoleId":"plant-net","mac":"02:48:4c:00:00:07"}` xác nhận thiết bị là máy khách nào. Từ đó MAC là khóa và IP không bao giờ được tin lại. Máy khách nhận các tag (`c.<mac>.*` trên bảng điều khiển) và một báo động, "PLC-07 ngoài mạng", ưu tiên 1 với độ trễ kích hoạt 120 s để khởi động lại không gọi ai. Trả về `{"link":{...},"change":{...}}`. `400` nếu `consoleId` không phải thiết bị UniFi hoặc MAC không phải MAC, `404` cho thiết bị không xác định.

### `DELETE /api/devices/{id}/network`

Gỡ liên kết, và báo động mà HotLoop đã tạo cho nó trừ khi máy khách vẫn được theo dõi từ một danh sách đã biết. `404` nếu không có liên kết.

### `GET /api/unifi/{id}/networks`

Các mạng của site như bảng điều khiển có, kèm bản ghi của HotLoop: `ot`, `known` (có bao nhiêu thiết bị trong danh sách của nó), `clients` (đang ở trên đó), và `unknown` (đang ở trên đó và không có trong danh sách). Một mạng mà HotLoop có bản ghi nhưng bảng điều khiển không còn sẽ trả về với `"onConsole":false`.

```json
[{"networkId":"6abb23d25a95f2636a5df29c","name":"SCADA","purpose":"corporate","vlan":122,"subnet":"10.122.0.1/24","onConsole":true,"ot":true,"clients":2,"known":1,"unknown":[{"mac":"02:9b:b1:69:88:f2","ip":"10.122.0.66","switchName":"USW Lite 8 PoE","port":6,"...":"..."}],"changedBy":"hana"}]
```

### `PUT /api/unifi/{id}/networks/{network}`

`{"ot": true}` đánh dấu một mạng là OT. Mọi thứ trên đó mà không nằm trong danh sách đã biết được tính trong `n.<network>.unknown` và tự nêu tên trong `.unknown_last`, và HotLoop tạo báo động "Thiết bị lạ trên SCADA", ưu tiên 1. `{"ot": false}` bỏ đánh dấu và xóa báo động đó; danh sách đã biết được giữ lại. `400` cho một WAN hoặc một mạng mà bảng điều khiển không có.

### `POST /api/unifi/{id}/networks/{network}/accept-all`

Chấp nhận mọi thứ đang trên mạng, nguyên trạng: một cú nhấp sau khi đánh dấu. Các thiết bị đã có trong danh sách giữ tên và việc theo dõi. Không có phần thân. Trả về `{"accepted":[{known device}...]}`, những thiết bị nó đã thêm.

### `GET /api/unifi/{id}/known`

Mọi thiết bị đã biết trên các mạng của site: `[{"deviceId":"plant-net","networkId":"...","mac":"...","name":"PLC-07","watch":true,"acceptedBy":"hana","acceptedAt":"..."}]`.

### `PUT /api/unifi/{id}/networks/{network}/known/{mac}`

`{"name":"PLC-07","watch":true}` chấp nhận một thiết bị vào mạng, hoặc đổi tên hay việc theo dõi của nó. `watch` cho nó các tag và báo động mất kết nối; một thiết bị được phép nhưng lúc có lúc không (laptop bảo trì) thì được chấp nhận mà không có nó. `400` nếu mạng chưa bao giờ được đánh dấu OT.

### `DELETE /api/unifi/{id}/networks/{network}/known/{mac}`

Gỡ một thiết bị khỏi danh sách. Nếu nó đang trên mạng, nó lại là thiết bị lạ ở lần đọc tiếp theo.

### `GET /api/unifi/{id}/clients`

Mọi máy khách mà bảng điều khiển liệt kê, cộng với mọi máy khách được theo dõi mà nó không liệt kê, mỗi máy kèm vị trí, trực tuyến hay không, và `ot`, `known`, `watched`, `linkedTo` cùng `summary` một dòng. `?q=` thu hẹp theo MAC, IP hoặc tên.

### `GET /api/unifi/consoles`

Mọi thiết bị UniFi mà HotLoop có, đang chạy hay không, cho bộ chọn của màn hình UniFi: `[{"id":"plant-net","name":"Plant network","address":"https://...","enabled":true,"running":true,"site":"default","version":"10.6.106","readAt":"...","devices":4,"online":4,"clients":12,"failover":false,"eventsLive":true}]`. Một bảng điều khiển mà tiến trình này chưa đọc sẽ nói vì sao trong `why`.

### `GET /api/unifi/{id}/overview`

Thẻ Tổng quan: số thiết bị và máy khách (một máy khách được tính khi HotLoop tin rằng nó đang trên mạng, phép thử mà các tag `n.<id>.clients` dùng, chứ không chỉ khi bảng điều khiển liệt kê nó), máy khách theo mạng, `health` của các phân hệ của bảng điều khiển, và với mỗi gateway là dải WAN của nó, `gateways[]`: một mục `wans[]` cho mỗi WAN với `alive` (các kiểm tra sức khỏe của chính gateway, không bao giờ là `up` của khối WAN), `known`, `active`, `backup`, độ trễ và độ khả dụng. `failover` là lưu lượng trên một WAN không phải WAN đầu tiên, `down` là không WAN nào còn sống, và `since` là lần đọc đầu tiên HotLoop thấy lưu lượng trên WAN nó đang dùng, tức là lúc HotLoop nhận ra, chứ không phải lúc gateway chuyển. `events` là trạng thái của websocket sự kiện (`live`, `error`, `reconnects`) và mười sự kiện mới nhất.

### `GET /api/unifi/{id}/topology`

Bản đồ. `nodes[]` là các thiết bị đã tiếp nhận kèm vị trí trên lưới (`x`, `y`, `layer`: từ trái sang phải kể từ gateway, bố trí giống nhau cho cùng một lần đọc), `edges[]` là các dây cáp giữa chúng lấy từ `downlink_table` của chính bảng điều khiển, `wired[]` và `wifi[]` là các máy khách treo ở mỗi cổng switch và mỗi AP và SSID. Thiết bị mà không có gì liệt kê là cắm vào đâu được vẽ riêng với `noUplink` được đặt, chứ không treo vào gateway theo phỏng đoán. Thiết bị của một bảng điều khiển UniFi khác mà HotLoop đọc và bảng điều khiển này liệt kê là máy khách được nối vào như một nút với `external` được đặt và một cạnh có `stitched`. `feeds` là, theo MAC thiết bị, các thiết bị HotLoop được liên kết với một máy khách phía hạ lưu của nó, kèm `equipmentId` của chúng cho cây nhà máy, và `links` chính các thiết bị đó theo MAC máy khách.

### `GET /api/unifi/{id}/devices`

Mọi thiết bị đã tiếp nhận cùng các con số của nó và `ports[]` cho mặt trước: liên kết, tốc độ, chế độ và mức tiêu thụ PoE, các máy khách học được trên cổng, thiết bị cắm vào nó, và `dropped` cho một cổng đã lên ở lần đọc trước và giờ đã xuống. Một thiết bị mà bảng điều khiển đã mất không báo con số nào và không có liên kết cổng, vì điều nó nói lần cuối không còn hiện hành.

### `GET /api/unifi/{id}/wifi`

Các SSID của site với `enabled`, mạng chúng nằm trên đó và có bao nhiêu máy khách ở mỗi SSID. Khi bảng điều khiển không cho tài khoản này thấy các mạng không dây, `error` nói lý do và `wlans` rỗng.

### `GET /api/unifi/{id}/events`

Các sự kiện mới nhất mà bảng điều khiển đã báo kể từ khi HotLoop kết nối, mới nhất trước (`?limit=` tối đa 200, mặc định 50), và trạng thái của websocket sự kiện. Mỗi sự kiện có `key` của bộ điều khiển (`EVT_SW_Lost_Contact`), `message` riêng, `severity` (`warning` khi bộ điều khiển đánh dấu đó là điều gì đó đang sai) và thiết bị, máy khách và cổng mà nó nói tới. Chúng cũng nằm trong nhật ký công việc, xếp dưới switch hoặc điểm truy cập mà chúng nói tới (xem [UniFi Network](/vi/iot/unifi/#sự-kiện)).

### `POST /api/unifi/{id}/starter-alarms`

Tạo các báo động thường dùng cho site từ những gì bảng điều khiển đang có, dưới dạng các định nghĩa báo động thông thường dưới `/api/alarms`: mọi thiết bị đã tiếp nhận ngoại tuyến (ưu tiên 2, độ trễ kích hoạt 60 s), mọi cổng uplink đã xuống (ưu tiên 1, 10 s), một gateway có hai WAN trở lên đang chạy bằng WAN dự phòng (ưu tiên 2, 30 s). Phần thân là tùy chọn. `{"poeLimitW": 25}` thêm một báo động ưu tiên 3 cho mức tiêu thụ `poe_w` của mọi cổng PoE vượt quá số watt đó, độ trễ 30 s; bảng điều khiển không nói ngân sách của một cổng là bao nhiêu, nên HotLoop không đoán. Giới hạn âm là `400`.

```json
{"created":[{"id":"unifi-devoffline-9c1e2a77b3d0","name":"USW Lite 8 PoE offline","kind":"offline","tag":"d.002722e2e633.online","priority":2}],
 "kept":[]}
```

`kept` là các báo động mà bộ này yêu cầu và đã có sẵn: của chính nó từ lần nhấn trước, hoặc báo động của ai đó trên cùng tag. Vì vậy nhấn lại sau khi tiếp nhận thêm thiết bị là an toàn, và nó chỉ thêm cho thiết bị mới. Các báo động mạng OT và ngoài mạng không thuộc bộ này; chúng đi kèm việc đánh dấu một mạng là OT và theo dõi một thiết bị. `503` cho đến khi bảng điều khiển được đọc một lần.

### `GET /api/unifi-protect/{id}/cameras/{camera}/snapshot`

Ảnh hiện tại của một camera Protect, một JPEG (`Content-Type: image/jpeg`, `Cache-Control: no-store`), lấy từ console khi được yêu cầu; đây là route UniFi duy nhất tự gửi một yêu cầu. `{id}` là một thiết bị có giao thức `unifi-protect` và `{camera}` là id mà console đặt cho camera (phần `<id>` trong tag `cam.<id>.online` của nó). `404` khi thiết bị không phải là thiết bị Protect đang kết nối, và `502` kèm lý do của console khi camera ngoại tuyến hoặc console từ chối khóa. Xem [Giao thức và driver](/vi/iot/protocols/#unifi-protect).

### `GET /api/onvif/{id}/profiles/{profile}/snapshot`

Ảnh hiện tại của một hồ sơ camera ONVIF, một JPEG (`Content-Type` đúng như camera đã gửi, `Cache-Control: no-store`), lấy từ camera khi được yêu cầu, bằng tài khoản đăng nhập của chính camera. `{id}` là một thiết bị có giao thức `onvif` và `{profile}` là token mà camera đặt cho hồ sơ media (phần `<token>` trong tag `profile.<token>.snapshot_uri` của nó). `404` khi thiết bị không phải là thiết bị ONVIF đang kết nối, và `502` kèm lý do của camera khi nó không cung cấp ảnh. Xem ONVIF.md.

### `POST /api/onvif/discover`

Dò mạng tìm camera ONVIF (WS-Discovery, một lần dò multicast từ mọi giao diện) và trả lời `{"cameras":[...]}` với từng camera đã đáp lại: `endpoint`, `xaddrs`, `address` để thêm nó vào, cùng `name`, `hardware`, `location` và `profiles` mà các scope của nó cho biết. `?wait=` là số giây để lắng nghe, từ 1 đến 15, mặc định 3. Nó không thêm gì; một người thêm camera thành thiết bị có giao thức `onvif`.

## Khám phá MQTT

Các thiết bị đã tự thông báo qua MQTT, và điều một người đã quyết định về từng thiết bị. Xem [Khám phá MQTT](/vi/iot/mqtt-discovery/). Việc khám phá lắng nghe trên broker tích hợp khi nó chạy, và trên mọi broker được thiết lập dưới `/api/mqtt/brokers`. Không có cái nào thì `sources` rỗng. Trong trình trợ giúp `--mcp-stdio`, vốn không bao giờ lắng nghe, `GET /api/discovery` trả lời `{"running":false,"sources":[],"devices":[]}` và mọi route khác trả `503`.

`{source}` là broker mà thiết bị đã thông báo trên đó (`embedded` cho broker riêng của HotLoop, còn lại là id của broker); `{key}` là thứ gắn các thông báo của nó lại với nhau: định danh đầu tiên, MAC của nó dạng `mac:aa:bb:cc:dd:ee:ff`, hoặc id nút. Hãy mã hóa URL; định danh có những ký tự mà một đường dẫn không chấp nhận.

**Không lệnh nào trong số này kích hoạt gì.** Chấp nhận một thiết bị làm cho các điểm của nó có thể kích hoạt, từng điểm một, qua `POST /api/tags` như mọi điểm khác.

### `GET /api/discovery`

Mọi nguồn, kèm những gì nó đã thấy và từ chối, và mọi thiết bị được khám phá:

```json
{"running":true,"sources":[{"id":"embedded","name":"the embedded broker","prefix":"homeassistant","listening":true,"connected":true,
  "received":42,"dropped":0,"refused":0,"problems":[],"autoCreate":true,"anonymousAllowed":false,
  "external":false,"listenOnly":false,"enabled":true}],
 "devices":[{"source":"embedded","deviceKey":"plug-0001","deviceId":"kitchen-plug","status":"discovered",
  "device":{"identifiers":["plug-0001"],"name":"Kitchen Plug","manufacturer":"Acme","model":"P1","swVersion":"1.0.0"},
  "origin":{"name":"test-publisher","swVersion":"0.1"},"firstSeen":"2026-10-02T09:12:04Z","lastSeen":"2026-10-02T09:12:04Z",
  "components":[{"key":"plug-0001-relay","component":"switch","name":"Relay","configTopic":"homeassistant/switch/plug-0001/relay/config",
   "stateTopic":"plug/relay","commandTopic":"plug/relay/set","commandTopics":["plug/relay/set"],"tag":"relay",
   "unsupported":[],"unknownKeys":[],"flags":[]}]}]}
```

Nguồn có `external` là true là broker được thiết lập dưới `/api/mqtt/brokers`, và `broker` nói nó ở đâu. `autoCreate` false là nguồn mà các thiết bị chờ trong hộp thư đến: được liệt kê là `discovered` không có `deviceId`, không có gì được tạo và không có gì được đọc cho đến khi ai đó chấp nhận một thiết bị. `listenOnly` là broker mà HotLoop không bao giờ phát hành lên. `lastError` nói vì sao một nguồn không kết nối, kể cả mật khẩu không thể mở.

`status` là `discovered`, `accepted` hoặc `ignored`. Theo từng thành phần, `unsupported` liệt kê những gì HotLoop không dùng được và lý do ("value template not supported: filter `regex_findall_index` is not supported at column 12"), `unknownKeys` các khóa cấu hình mà định dạng không định nghĩa, `commandTopics` mọi topic mà các lệnh của nó có thể đi tới (topic tốc độ của quạt cùng topic chính), và `flags` những gì người dùng nên xem trước khi chấp nhận: topic lệnh nằm ngoài các topic mà thành phần đọc, nằm trong tiền tố khám phá hoặc bị thiết bị khác giành, và cấu hình yêu cầu các lệnh retained. `withdrawnAt` được đặt trên thành phần mà bên phát hành đã rút lại. `suggestedEquipmentId` là nút của cây mà `suggested_area` của thiết bị nêu tên, khi đúng một nút có tên đó; nó chỉ điền sẵn hộp thoại chấp nhận. Trên broker tích hợp, `announcedBy` và `announcedVia` là tài khoản broker và id máy khách đã phát hành cấu hình mới nhất của nó, còn `acceptedLogin` là tài khoản mà nó được chấp nhận từ đó. Một thiết bị đã chấp nhận mà thông báo thay đổi, hoặc do tài khoản khác thông báo, có `review`:

```json
{"hash":"9a1c...","summary":["plug-0001-power: unit changed"],
 "changes":[{"key":"plug-0001-power","kind":"changed","fields":[{"field":"unit","running":"W","announced":"kW"}]}]}
```

### `GET /api/discovery/{source}/{key}`

Một thiết bị, cùng dạng. `404` cho thiết bị mà HotLoop chưa thấy.

### `POST /api/discovery/{source}/{key}/accept`

Chấp nhận một thiết bị. Phần thân tùy chọn `{"equipmentId": 12}` đặt nó vào cây ngay trong cùng bước. Không kích hoạt gì. Trả về thiết bị. `400` cho thiết bị bị bỏ qua.

### `POST /api/discovery/{source}/{key}/ignore`

Bỏ thiết bị: thiết bị HotLoop của nó, các tag và thực thể biến mất (lịch sử vẫn còn), và nó vẫn bị bỏ qua khi thông báo lại. Trả về thiết bị. `DELETE /api/devices/{id}` trên thiết bị đã khám phá làm điều tương tự, vì thiết bị cứ tiếp tục thông báo thì sẽ chỉ quay lại.

### `POST /api/discovery/{source}/{key}/unignore`

Đưa thiết bị bị bỏ qua về trạng thái đã khám phá, từ những gì nó thông báo lần cuối. `400` nếu nó không bị bỏ qua.

### `POST /api/discovery/{source}/{key}/review/apply`

Làm cho thiết bị đã chấp nhận chạy theo những gì nó đã thông báo. Việc mỗi điểm có được kích hoạt hay không giữ nguyên như cũ. `400` khi không có gì đang chờ xem xét.

### `POST /api/discovery/{source}/{key}/review/reject`

Giữ cấu hình đã chấp nhận tiếp tục chạy và ngừng đề nghị thay đổi này. Một thay đổi khác về sau sẽ được đề nghị lại. `400` khi không có gì đang chờ.

Một lần xem xét có thể là về việc ai đã thông báo: một thay đổi có `"kind":"publisher"` và dòng tóm tắt "announced by login garage-node; accepted from kitchen-node". Áp dụng nó làm cho tài khoản đó thành tài khoản mà thiết bị được chấp nhận từ đó.

## Tài khoản broker

Các tài khoản của broker tích hợp được tạo trong HotLoop, mỗi tài khoản có các topic nó được phép phát hành và đăng ký. Xem [broker MQTT tích hợp](/vi/iot/broker/). Một tài khoản là chìa khóa vào broker của cả nhà máy, nên những thứ này là `users.manage`, của quản trị viên. Không gì ở đây từng trả lời bằng mật khẩu hay mã băm của nó. Mỗi thay đổi đi vào nhật ký và có hiệu lực từ lần phát hành kế tiếp của máy khách; không ai phải kết nối lại.

### `GET /api/broker/logins`

```json
{"running":true,"anonymous":false,"prefix":"homeassistant","envLogins":["plant"],
 "profiles":[{"name":"shelly","about":"a Shelly Gen2 or later; name the login after its MQTT topic prefix",
   "publish":["%u/#","shellies/announce"],"subscribe":["%u/#","shellies/command","%p/status"]}],
 "logins":[{"name":"kitchen-node","profile":"esphome","publish":["%u/#","%p/+/%u/+/config","esphome/discover/%u"],
   "subscribe":["%u/#","%p/status","esphome/discover"],"createdBy":"admin","createdAt":"2026-10-02T09:12:04Z",
   "updatedAt":"2026-10-02T09:12:04Z","resolvedPublish":["kitchen-node/#","homeassistant/+/kitchen-node/+/config",
   "esphome/discover/kitchen-node"],"resolvedSubscribe":["kitchen-node/#","homeassistant/status","esphome/discover"]}]}
```

`running` là false khi tiến trình này không chạy broker; các tài khoản vẫn được giữ, và broker đọc chúng khi khởi động. `envLogins` là các tên từ `HOTLOOP_BROKER_USERS`, có thể làm mọi thứ. `%u` trong một quy tắc là tên của chính tài khoản và `%p` là tiền tố khám phá; `resolved*` là các quy tắc đã điền cả hai.

### `POST /api/broker/logins`

```json
{"name":"kitchen-node","password":"a-long-random-password","profile":"esphome"}
```

`name` là 1 đến 64 chữ cái, chữ số, `-` và `_` (nó thay cho `%u` trong topic). `password` ít nhất 12 ký tự. `profile` điền các quy tắc; `publish` và `subscribe`, khi được đưa ra, thay thế chúng. Cần một trong hai. Một quy tắc là bộ lọc topic MQTT: `+` và `#` chỉ như cả một cấp, `#` chỉ ở cuối, không bao giờ là topic `$`. `201` kèm tài khoản; `400` cho bất kỳ điều nào ở trên hoặc một tên mà `HOTLOOP_BROKER_USERS` đã có; `409` cho tên đã có người dùng.

### `PUT /api/broker/logins/{name}`

Bất kỳ trường nào trong `profile`, `publish`, `subscribe` và `password`; thứ không gửi thì giữ nguyên. `200` kèm tài khoản, `404` cho tài khoản không tồn tại.

### `DELETE /api/broker/logins/{name}`

`200` `{"deleted":"kitchen-node"}`. Máy khách còn đang kết nối bằng nó không làm được gì từ đó trở đi, và không kết nối lại được. `404` cho tài khoản không tồn tại.

## Khám phá mạng

Các thiết bị nghe thấy trên mạng nhà máy qua mDNS, SSDP và DHCP, và điều một người đã quyết định về từng thiết bị. Xem [Khám phá mạng](/vi/iot/network-discovery/). Trong trình trợ giúp `--mcp-stdio`, vốn không bao giờ lắng nghe, `GET /api/network-discovery` trả lời `{"running":false,"finds":[]}` và mọi route khác trả `503`.

`{key}` là cách một phát hiện được nghe thấy và bởi cái gì: `mdns:` và tên host mDNS của nó, `ssdp:` và uuid UPnP của nó, `dhcp:` và MAC của nó. Hãy mã hóa URL.

**Không lệnh nào trong số này kích hoạt gì**, và không gì ở đây được thêm vào cho đến khi ai đó chấp nhận.

### `GET /api/network-discovery`

Các bộ lắng nghe, việc thăm dò, các giao diện chúng đang dùng, và mọi phát hiện:

```json
{"running":true,
 "status":{"leading":true,"interfaces":["eth0 10.20.0.15/24"],
  "listeners":[{"name":"mdns","enabled":true,"listening":true,"heard":120,"dropped":0,"refused":0},
   {"name":"ssdp","enabled":true,"listening":true,"heard":14,"dropped":0,"refused":0},
   {"name":"dhcp","enabled":false,"listening":false,"heard":0,"dropped":0,"refused":0}],
  "probe":{"networks":[]}},
 "finds":[{"key":"mdns:line3-ua.local","via":"mdns","kind":"opcua","name":"line3-ua","status":"discovered",
  "firstSeen":"2026-10-11T14:02:11Z","lastSeen":"2026-10-11T14:07:40Z",
  "find":{"key":"mdns:line3-ua.local","via":"mdns","kind":"opcua","name":"line3-ua",
   "summary":"OPC UA server, capabilities DA","host":"line3-ua.local","addresses":["10.20.0.31"],
   "services":[{"type":"_opcua-tcp._tcp.local","instance":"line3-ua._opcua-tcp._tcp.local","port":50000,
    "txt":{"caps":"DA","path":"/"}}],
   "proposal":{"protocol":"opcua","address":"opc.tcp://10.20.0.31:50000/","how":"Accepting makes an OPC UA device..."},
   "heard":"2026-10-11T14:07:40Z"}}]}
```

`kind` là `esphome`, `shelly`, `opcua`, `mqtt-broker`, `web`, `mdns` (nó thông báo thứ mà HotLoop không có từ để gọi), `upnp` hoặc `dhcp`. Một phát hiện có `proposal` kèm `protocol` sẽ thành thiết bị của giao thức đó tại `address` khi được chấp nhận; phát hiện không có thì nói trong `how` điều gì sẽ đưa nó vào. `also` liệt kê các phát hiện khác và thiết bị khám phá qua MQTT là cùng một thiết bị, theo MAC hoặc địa chỉ. `status` là `discovered`, `accepted` hoặc `ignored`, và `deviceId` là thiết bị mà việc chấp nhận đã tạo. `error` của bộ lắng nghe nói vì sao nó không lắng nghe (cổng 67 bị chiếm hoặc không được phép, không có giao diện multicast); `refused` đếm các phát hiện mới bị bỏ vì bản ghi đã đầy.

### `GET /api/network-discovery/{key}`

Một phát hiện, cùng dạng. `404` cho phát hiện mà HotLoop chưa nghe thấy.

### `POST /api/network-discovery/{key}/accept`

Chấp nhận một phát hiện. Phần thân tùy chọn `{"equipmentId": 12}` đặt thiết bị mà nó tạo ra vào cây. Một phát hiện mà HotLoop có trình điều khiển sẽ thành thiết bị tại địa chỉ đề xuất, đã bật, không có tag và không có gì được kích hoạt; phát hiện khác chỉ được ghi là đã biết và không tạo gì. Trả về phát hiện. `400` cho phát hiện đã được chấp nhận hoặc bị bỏ qua.

### `POST /api/network-discovery/{key}/ignore`

Ẩn một phát hiện mà chưa ai quyết định, và giữ nó ẩn khi nghe thấy lần nữa. `400` cho phát hiện đã được quyết định.

### `POST /api/network-discovery/{key}/unignore`

Đưa phát hiện bị bỏ qua trở lại để được quyết định. `400` nếu nó không bị bỏ qua.

### `POST /api/network-discovery/probe`

Thăm dò ngay: một truy vấn mDNS và một lần tìm SSDP trên mọi giao diện có mạng nằm trong `HOTLOOP_NETDISC_PROBE_NETWORKS`, và không ở đâu khác. Trả về `{"status": ...}`, với những gì không gửi đi được trong `status.probe.lastError`. `400` khi không mạng nào bật việc thăm dò: nút này không bật được, chỉ việc triển khai mới bật được.

## Tích hợp

Luồng cấu hình cho một loại thiết bị mà người dùng chỉ HotLoop tới: hỏi tích hợp cần gì, xem thiết bị thật với các câu trả lời, và tạo thiết bị cùng các tag của nó từ những gì tìm thấy. Xem [Tích hợp](/vi/iot/integrations/).

**Không gì ở đây kích hoạt gì.** Mọi tag do một lần thiết lập tạo ra đều chỉ đọc. Kích hoạt một tag là `POST /api/tags` như mọi điểm khác.

### `GET /api/integrations`

Mọi tích hợp mà bản dựng này có, kèm các câu hỏi nó đặt ra:

```json
[{"id":"opcua","name":"OPC UA server","description":"A PLC, CNC, gateway or SCADA server ...",
  "protocol":"opcua","addressLabel":"Endpoint","addressPlaceholder":"opc.tcp://192.168.1.20:4840","writable":true,
  "fields":[{"key":"securityMode","label":"Security","kind":"choice","required":false,"default":"None",
             "choices":[{"value":"None","label":"None"},{"value":"Sign","label":"Sign"}]},
            {"key":"password","label":"Password","kind":"secret","required":false}]}]
```

`kind` là `text`, `number`, `bool`, `choice` hoặc `secret`. Một trường có `showWhen` (`{"version":["3"]}`) chỉ được hỏi khi một câu trả lời khác có một trong các giá trị đó, và câu trả lời cho câu hỏi không hiển thị bị bỏ qua.

### `POST /api/integrations/{id}/probe`

Kiểm tra các câu trả lời và đi xem thiết bị thật. Không lưu gì.

```json
{"address":"opc.tcp://192.168.1.20:4840","options":{"securityMode":"None"}}
```

Trả về `{"integration":"opcua","address":"opc.tcp://192.168.1.20:4840","found":{...}}`. `address` là địa chỉ như tích hợp đã phân giải. `found` có `name` (thiết bị tự gọi mình là gì), `identity` (nó nói nó là gì), `notes` (điều cần biết trước khi chấp nhận) và `points`, mỗi điểm có dạng tag `{name, address, dataType, unit, description, writable, deviceClass}` cộng thêm `group`, `sample` (những gì nó đọc được khi tìm thấy) và `suggested`.

`400` cho các câu trả lời không khớp với câu hỏi, tất cả vấn đề cùng lúc; câu trả lời cho câu hỏi mà tích hợp không đặt ra cũng là `400`, không bị bỏ qua. `502` khi thiết bị không trả lời hoặc trả lời bằng thứ không phải giao thức của nó, kèm điều đã sai. `404` cho tích hợp mà bản dựng này không có. Bí mật không bao giờ nằm trong câu trả lời hay lỗi.

### `POST /api/integrations/{id}/setup`

Xem lại thiết bị, rồi tạo nó cùng các tag. Phần thân là của probe, cộng thêm:

| Trường | Ý nghĩa |
|---|---|
| `deviceId` | Id của thiết bị mới. Để trống thì lấy từ tên. `400` nếu đã có thiết bị dùng nó |
| `name` | Tên thiết bị. Để trống thì lấy tên mà thiết bị tự gọi |
| `points` | Các tên từ `found.points` để thiết lập. Để trống thì lấy những điểm đánh dấu `suggested`. Tên mà thiết bị không có là `400` |
| `site`, `area`, `line` | Nó nằm ở đâu trong cây thiết bị, như trên `POST /api/devices` |

Các điểm được kiểm tra với thiết bị như hiện tại, không phải với điều một máy khách nói đã tìm thấy một phút trước. Trả về `{"device":{...},"tags":3,"entities":["sensor.plc_sim_..."],"notes":[]}`. Thiết bị được bật và đang thăm dò, mọi tag đều chỉ đọc, và mỗi tag có thực thể đọc của nó. Một lần thiết lập thất bại giữa chừng không để lại thiết bị nào.

## Broker MQTT

Các broker khác broker riêng của HotLoop mà việc khám phá lắng nghe: Mosquitto của nhà máy, broker mà một thiết bị Zigbee2MQTT mang theo. Xem [Khám phá MQTT](/vi/iot/mqtt-discovery/#các-broker-khác). Mật khẩu của chúng được niêm phong bằng khóa thông tin xác thực thiết bị (`HOTLOOP_SECRET_KEY_FILE`) và không bao giờ được trả về; `passwordSet` cho biết có mật khẩu nào được lưu không, và `passwordProblem` vì sao mật khẩu đã lưu không mở được. Mỗi thay đổi đi vào nhật ký và có hiệu lực ngay: bộ lắng nghe và các thiết bị từ broker đó kết nối lại.

### `GET /api/mqtt/brokers`

```json
{"secretKey":true,
 "brokers":[{"id":"plant-uns","name":"Plant UNS","broker":"tcp://10.20.0.5:1883","username":"hotloop","useTls":false,
   "insecureSkipVerify":false,"prefix":"homeassistant","listenOnly":true,"autoCreate":false,"tasmota":true,"shelly":true,"enabled":true,
   "createdBy":"admin","passwordSet":true,"createdAt":"2026-10-03T09:12:04Z","updatedAt":"2026-10-03T09:12:04Z"}]}
```

`secretKey` cho biết HotLoop này có khóa để niêm phong mật khẩu hay không.

### `POST /api/mqtt/brokers`

```json
{"id":"plant-uns","name":"Plant UNS","broker":"tcp://10.20.0.5:1883","username":"hotloop",
 "password":"...","listenOnly":true}
```

`id` là 1 đến 63 chữ cái thường, chữ số và `-`, không phải `embedded`: nó đặt tên cho broker trong mọi thiết bị đến từ đó, và không thể đổi. `broker` là `host:port` hoặc URL `tcp://`, `ssl://`, `tls://`, `mqtt://` hoặc `mqtts://`, không có tài khoản trong đó. `prefix` mặc định là `homeassistant`; `autoCreate` false (thiết bị chờ trong hộp thư đến); `listenOnly` false; `tasmota` (nghe cả việc khám phá riêng của Tasmota, `tasmota/discovery/#`) true; `shelly` (học các thiết bị Shelly Gen2 trở lên từ các topic `<prefix>/status/<component>` chúng phát hành) true; `enabled` true. Mật khẩu cần tên người dùng và một khóa: không có `HOTLOOP_SECRET_KEY_FILE` thì là `400`, không bao giờ lưu dạng rõ. `201` kèm broker; `409` cho id đã có người dùng.

### `PUT /api/mqtt/brokers/{id}`

Bất kỳ trường nào ở trên trừ `id`; thứ không gửi thì giữ nguyên. `"password":""` xóa mật khẩu. `200` kèm broker.

### `DELETE /api/mqtt/brokers/{id}`

Xóa broker và những gì nó đã thông báo mà không ai chấp nhận: hộp thư đến và mọi thiết bị nó tự tạo. `409` nêu tên chúng khi vẫn còn thiết bị đã chấp nhận từ nó: hãy bỏ qua hoặc xóa chúng trước, hoặc tắt broker bằng `"enabled":false` thay vào đó. `200` `{"deleted":"plant-uns"}`.

## Tag

### `GET /api/tags`

| Truy vấn | <span class="sr-only">Chi tiết</span> |
|---|---|
| `device` | Chỉ các tag của thiết bị này. Không có `limit` thì trả lời tất cả |
| `q` | Tìm kiếm: một chuỗi con, không phân biệt hoa thường, của id thiết bị, tên tag hoặc mô tả. Dùng được cùng `device` |
| `limit` | Một số nguyên từ 1 đến 5000. Mặc định 500 khi không có `device`. Bất cứ giá trị nào khác, kể cả 5001, là `400`: nó bị từ chối, không bao giờ được trả lời bằng ít hơn (đến 4.19.5, mọi giới hạn trên 1000 bị lặng lẽ đổi thành 200) |
| `writable` | `true` chỉ cho các tag được đánh dấu có thể ghi (thứ mà bộ chọn ghi đưa ra) |
| `offset` | Trang bắt đầu từ đâu, từ không trở lên. Tag được sắp theo thiết bị rồi theo tên |

Header `X-Total-Count` của phản hồi cho biết tổng cộng có bao nhiêu tag khớp, nên máy khách phân trang bằng `offset` cho đến khi có đủ và biết là đã có đủ. Phản hồi rỗng là `[]`.

```json
[{"id":5,"deviceId":"tank-farm","name":"level_sp","address":"mqtt:docs-api-example/level_sp","dataType":"float","unit":"%","enabled":true,"writable":true,"maxValue":95,"hasRange":true,"scale":1,"createdAt":"2026-09-27T20:21:39.405164Z","updatedAt":"2026-09-27T20:21:39.405164Z"}]
```

### `POST /api/tags`

Tạo tag nếu `deviceId` và `name` là mới, thay thế nếu không.

| Trường | Kiểu | <span class="sr-only">Chi tiết</span> |
|---|---|---|
| `deviceId` | string | Bắt buộc. Thiết bị phải tồn tại (`404` nếu không) |
| `name` | string | Bắt buộc. Không có ký tự điều khiển |
| `address` | string | Bắt buộc. Địa chỉ riêng của giao thức |
| `dataType` | string | `bool`, `int`, `float` hoặc `string` (và các bí danh thông dụng: `int16`, `word`, `coil`...). Quyết định cách mã hóa một thao tác ghi |
| `unit`, `description` | string | |
| `enabled` | bool | Bỏ sót là `false` |
| `writable` | bool | **Kích hoạt tag để ghi, từ mọi đường: giao diện, tự động hóa, thực thể, MCP.** Bỏ sót là `false` |
| `hasRange`, `minValue`, `maxValue` | bool, number, number | Với `hasRange`, thao tác ghi ngoài phạm vi bị từ chối (không bao giờ bị cắt) |
| `scale`, `offset` | number | giá trị kỹ thuật = thô x hệ số + độ lệch. Hệ số 0 tính là 1 |
| `noData` | list | Các giá trị thô có nghĩa là "không có phép đo", mỗi giá trị `{"raw", "reason"}`. `raw` là chuỗi (`"0x8005"`, `"-32763"`) hoặc một số trần, và được trả về dưới dạng chuỗi. Một lần đọc có giá trị thô nằm trong danh sách có chất lượng xấu với `reason` đó, được kiểm tra trước `scale` và `offset`. Tối đa 32 mã. Mã không phải số nguyên, bị liệt kê hai lần hoặc không thể là kiểu của điểm là `400`. Xem [Giao thức và trình điều khiển](/vi/iot/protocols/#giá-trị-không-có-dữ-liệu) để biết cần viết gì cho từng kiểu và ví dụ Yokogawa DX |
| `deadband`, `deadbandPercent` | number | Các thay đổi nhỏ hơn mức này không được ghi vào lịch sử |
| `deviceClass` | string | Lớp mà các thực thể của tag bắt đầu với (`power`, `connectivity`, `temperature`...), khi nó có nghĩa với miền của chúng. Được lấy khi tạo tag và bị bỏ qua khi thay thế: từ đó thực thể sở hữu lớp của mình, nên hãy đổi nó ở đó |

Trả về tag đã lưu. Lưu một tag với `writable: true` được ghi nhật ký đúng như vậy: kích hoạt một tag là quyết định về an toàn và có tên người kèm theo. Các thực thể của tag được tạo hoặc cập nhật trước khi trả lời, nên máy khách có thể yêu cầu chúng ngay.

Tag trên thiết bị đã khám phá mà chưa ai chấp nhận không thể kích hoạt: `400`, "accept the device first". Xem [Khám phá MQTT](/vi/iot/mqtt-discovery/#lệnh).

### `DELETE /api/tags/{device}/{name}`

`{"deleted":"tank-farm/level"}`, hoặc `404`. Lịch sử được giữ lại. Các thực thể của tag trở thành mồ côi (xem [Thực thể](/vi/iot/entities/#tag-bị-xóa-thực-thể-mồ-côi-và-việc-nhận-lại)).

## Giá trị, bảng và thao tác ghi

### `GET /api/values`

Lần đọc mới nhất của mọi tag, từ bộ nhớ. `?device=` thu hẹp xuống một thiết bị.

```json
[{"deviceId":"extruder-1","protocol":"opcua","tagName":"Temperature","tagValue":20.645294745260895,"unit":"C","quality":"good","timestamp":"2026-09-27T20:21:58.255722Z"}]
```

Dạng này là `TagValue` của bảng điều khiển EmberNet và là một hợp đồng. `quality` là `good`, `uncertain` hoặc `bad`; **một lần đọc xấu có nghĩa là giá trị không biết, chứ không phải bằng không**. Một lần đọc chuỗi mang `stringVal`, và `tagValue` của nó không có nghĩa gì.

Một lần đọc không tốt mang `reason` khi trình điều khiển biết vì sao, để màn hình nói được nhiều hơn "xấu":

```json
{"deviceId":"meter-01","protocol":"http","tagName":"power","tagValue":0,"quality":"bad","timestamp":"2026-09-30T09:12:04.51Z","reason":"no field at ENERGY.Power"}
```

Một lần đọc tốt không bao giờ có nó, nên hợp đồng trên từng byte vẫn như cũ. Historian không giữ nó: `/api/history` có chất lượng, không có lý do.

### `GET /api/sparkline`

Các lần đọc gần nhất của một tag được giữ trong bộ nhớ (`HOTLOOP_RING_SIZE`, mặc định 30), cho các biểu đồ nhỏ. `?tag=device/tag`, bắt buộc.

```json
{"tag":"extruder-1/Temperature","timestamps":[1790540498609,1790540499246,1790540500246],"values":[0,20.06524581530632,19.933308705395785]}
```

`timestamps` là mili giây Unix. Cả hai là `[]` với tag không có lần đọc nào. `400` cho khóa sai định dạng.

### `GET /api/board`

Những tag nào được ghim lên bảng, và trong bao nhiêu cột. Nó được lưu trong cơ sở dữ liệu, không phải trình duyệt, vì một bảng thuộc về nhà máy: PC bảng điều khiển ngoài xưởng và laptop ở văn phòng hiển thị cùng một bảng.

```json
{"columns":2,"tags":["extruder-1/Temperature","tank-farm/level"],"rev":"9f2c41b07a6d3e58"}
```

`rev` gọi tên bảng như đã lưu. Gửi nó lại cùng một lần lưu và lần lưu bị từ chối nếu bảng đã thay đổi từ đó (bên dưới).

### `PUT /api/board`

Cùng dạng. `columns` ngoài 1 đến 4 thành 3; trùng lặp bị bỏ. `rev` là tùy chọn: với `rev` của bảng bạn đã đọc, một lần lưu lên bảng đã thay đổi từ đó là `409` và không đổi gì, nên một trang chưa từng đọc bảng, hoặc đọc bảng cũ, không thể thay bảng của nhà máy bằng bản sao của nó. Bỏ nó đi thì lần lưu không được kiểm tra, phù hợp với máy khách đặt cả bảng mỗi lần. Giao diện web đọc bảng khi khởi động và gửi `rev` với mỗi lần lưu. Mọi tag phải tồn tại (`404` nêu tên tag không có): một mục cũ là một đồng hồ không bao giờ nhúc nhích. Trả về bảng như đã lưu. Operator có `board.write`: sắp xếp bảng là vận hành nhà máy, không phải cấu hình nó.

### `POST /api/write`

Ghi một giá trị vào một tag, qua cổng ghi.

| Trường | Kiểu | <span class="sr-only">Chi tiết</span> |
|---|---|---|
| `tag` | string | Bắt buộc. `device/tag` |
| `value` | bool, number or string | Bắt buộc. `true` là bool, `42` là số nguyên, `42.5` là số thực, `"42"` là chuỗi: kiểu JSON là kiểu được ghi, vì một coil, một word và một số thực là ba thứ khác nhau trên đường truyền |
| `reason` | string | Tùy chọn. Được ghi nhật ký cùng thao tác ghi |

```json
{"tag":"tank-farm/level_sp","written":"72.5"}
```

**Một giá trị tính theo đơn vị của tag, như một lần đọc.** Với tag có hệ số hoặc độ lệch, thứ bạn gửi là thứ tag sẽ đọc lại, và HotLoop gửi cho thiết bị số đếm cho ra nó: 55.5 trên thanh ghi có hệ số 0.1 đặt 555 vào thanh ghi. (Đến 4.18, số được gửi nguyên cho thiết bị, nên 55.5 thành 55 và đọc lại là 5.5.) Phép kiểm tra phạm vi và dòng kiểm toán dùng số của bạn, theo đơn vị của tag. Một số đếm sau đó không vừa thanh ghi, như 7000 trên `uint16` có hệ số 0.1, bị từ chối với số đếm và thanh ghi được nêu tên, và không gì được gửi. Phần lẻ của số đếm bị cắt, như thanh ghi số đếm nguyên vẫn luôn làm: 12.34 trên thanh ghi hệ số một phần mười giữ 12.3.

Cổng kiểm tra theo thứ tự rằng việc ghi đã bật (`HOTLOOP_ALLOW_WRITES`), tag đã được kích hoạt và giá trị trong phạm vi. Mọi lần thử, bị từ chối hay không, đều nằm trong `GET /api/writes`.

| Trạng thái | Khi nào |
|---|---|
| 400 | Không có giá trị, giá trị `null`, khóa sai định dạng |
| 403 | Việc ghi bị tắt, hoặc `"tank-farm/level: this tag is not marked writable"` |
| 404 | Không có tag như vậy |
| 422 | `"value is outside the tag's configured range: 120 is outside 0..95"` |
| 503 | Thiết bị chưa kết nối |

## Lịch sử và kiểm toán

### `GET /api/history`

| Truy vấn | <span class="sr-only">Chi tiết</span> |
|---|---|
| `tag` | Bắt buộc, lặp được, tối đa 50: `?tag=a/x&tag=b/y` |
| `minutes` | Lùi lại bao xa từ bây giờ. Mặc định 60 |
| `bucket` | Kích thước khoảng tính bằng giây. Mặc định: chọn sao cho cửa sổ có khoảng 400 khoảng, trên thang từ 1 s đến 1 ngày |
| `raw` | `true` để lấy chính các lần đọc thay vì các khoảng |
| `limit` | Mặc định 5000, tối đa 100000 |
| `carry` | `true` để cũng nói mỗi tag đã giữ giá trị gì khi cửa sổ bắt đầu (chỉ khi theo khoảng) |

Theo khoảng, cũ nhất trước cho mỗi tag. `badCount` là số lần đọc trong khoảng có chất lượng không tốt; chúng được đếm, không được đưa vào trung bình. `from` và `to` là cửa sổ mà câu trả lời áp dụng, cách nhau đúng `minutes` và kết thúc khi câu hỏi được đặt ra:

```json
{"buckets":[{"deviceId":"extruder-1","tagName":"Temperature","bucket":"2026-09-27T20:21:00Z","avg":18.986210570239944,"min":0,"max":20.83008050535897,"first":0,"last":20.83008050535897,"count":22,"badCount":1}],"from":"2026-09-27T19:22:00Z","raw":false,"to":"2026-09-27T20:22:00Z"}
```

Historian giữ một lần đọc khi một giá trị di chuyển vượt dải chết của nó, không phải mỗi lần thăm dò, nên một tag đứng yên không có gì trong cửa sổ để vẽ. Với `carry=true`, câu trả lời cũng có `"carry":[{"deviceId":"extruder-1","tagName":"Temperature","ts":"2026-09-27T16:40:12Z","value":21.4}]`: lần đọc cuối trước `from`, cho mỗi tag mà lần đọc trước đó cuối cùng là tốt và có một con số. Tag mà lần đọc cuối là xấu hoặc không chắc chắn, không có lần đọc trước, hoặc là văn bản, không có mục nào, vì không biết nó đã giữ gì và chúng tôi sẽ không đưa cho biểu đồ một phỏng đoán. Thẻ xu hướng vẽ từ đây.

Dạng thô, mới nhất trước:

```json
{"raw":true,"readings":[{"deviceId":"extruder-1","protocol":"","tagName":"Temperature","tagValue":21.021559879601448,"quality":"good","timestamp":"2026-09-27T20:22:00.267463Z"}]}
```

`400` khi không có `tag`, có hơn 50, hoặc có khóa sai định dạng.

### `GET /api/writes`

Nhật ký kiểm toán ghi, mới nhất trước. Mọi lần thử đều ở đây, kể cả những lần bị từ chối, vì "chúng tôi không biết lệnh đó đã đi chưa" là câu trả lời tệ nhất một nhà máy có thể nhận.

| Truy vấn | <span class="sr-only">Chi tiết</span> |
|---|---|
| `tag` | Một tag, `device/tag` |
| `device` | Mọi tag của một thiết bị (bị bỏ qua nếu đặt `tag`) |
| `entity` | Mọi thao tác ghi mà một lệnh gọi dịch vụ trên thực thể này đã thực hiện hoặc bị từ chối, thay cho các mục trên |
| `call` | Mọi thao tác ghi của một lệnh gọi, thay cho tất cả các mục trên: lần nhấn và nhả một nút, hoặc mọi đích của việc áp dụng một công thức, cùng chia sẻ `call_id` của nó |
| `limit` | Mặc định 100, tối đa 5000 |

```json
[{"id":2,"at":"2026-09-27T20:22:01.04226Z","deviceId":"tank-farm","tagName":"level_sp","value":"120","prior":"0 %","actor":"admin","source":"ui","succeeded":false,"error":"refused: value is outside the tag's configured range: 120 is outside 0..95"},
 {"id":4,"at":"2026-09-27T20:23:03.276962Z","deviceId":"tank-farm","tagName":"pump","value":"true","prior":"0","actor":"admin","source":"ui","succeeded":true,"latencyMs":0.317,"entityId":"switch.tank_farm_pump","service":"switch.turn_on","callId":"5c9f8545a93b5443"}]
```

`source` là `ui`, `api`, `automation` hoặc `mcp`. `entityId`, `service` và `callId` chỉ có trên các thao tác ghi do một lệnh gọi dịch vụ thực hiện.

## Thực thể và trạng thái

Mỗi tag có thực thể mà không ai phải yêu cầu; các thực thể ghép (động cơ, van, vòng điều khiển, bộ đếm, bộ chọn, nút, trạm thời tiết) do quản trị viên dựng từ các tag. Dùng snake_case, như mọi endpoint thực thể. Toàn bộ mô hình nằm ở [Thực thể](/vi/iot/entities/).

### `GET /api/entities`

Mọi thực thể, kể cả mồ côi.

| Truy vấn | <span class="sr-only">Chi tiết</span> |
|---|---|
| `domain` | `sensor`, `switch`, `motor`... |
| `device` | Thực thể trên một thiết bị |
| `orphaned` | `true` chỉ cho thực thể mồ côi, `false` cho không thực thể nào |
| `q`, `limit` | Tìm kiếm: một chuỗi con, không phân biệt hoa thường, của id thực thể, tên hoặc id thiết bị, và tối đa `limit` thực thể (1 đến 5000, giá trị khác là `400`, không bao giờ bị cắt lặng lẽ) sắp theo id thực thể. `X-Total-Count` là số khớp. Bỏ đi thì danh sách đầy đủ |

```json
[{"id":5,"entity_id":"switch.tank_farm_pump","unique_id":"tag-control:tank-farm/pump","domain":"switch","platform":"tag","name":"pump","device_id":"tank-farm","options":{},"disabled":false,"hidden":false,"created_at":"2026-09-27T20:21:39.153197Z","updated_at":"2026-09-27T20:21:39.153197Z","bindings":[{"role":"command","device_id":"tank-farm","tag_name":"pump"},{"role":"state","device_id":"tank-farm","tag_name":"pump"}],"equipment_id":null,"area_id":4,"labels":[]}]
```

### `GET /api/entities/composites`

Những gì `POST /api/entities` có thể tạo: mỗi miền, các vai trò mà tag của nó được gắn vào, và các dịch vụ nó nhận. Một vai trò nói `kind` của tag, nó có `required` không, có dịch vụ nào ghi vào nó không (`command`) và trạng thái có được đọc từ nó không (`feedback`). Trạm thời tiết không nhận dịch vụ nào.

```json
{"domains":[{"domain":"weather","roles":[{"role":"temperature","kind":"number","required":true,"command":false,"feedback":true},{"role":"humidity","kind":"number","required":false,"command":false,"feedback":true}],"services":[]}]}
```

### `GET /api/entities/{entity_id}`

`{"entity": {...}, "state": {...}}`. `state` là `null` với thực thể bị tắt. `404` cho thực thể không xác định.

### `GET /api/entities/{entity_id}/image`

Hình ảnh mới nhất của một camera hoặc một hình ảnh, dưới dạng các byte HotLoop đang giữ: `Content-Type` là loại của chúng (`image/jpeg`, `image/png`, `image/gif` hoặc `image/webp`), kèm `X-Content-Type-Options: nosniff`, một `Content-Security-Policy` cô lập và một `ETag` (`If-None-Match` nhận `304`). `404` cho thực thể không phải loại này, hoặc trước khi có hình ảnh nào đến. Thuộc tính `entity_picture` của trạng thái là đường dẫn này kèm mã băm của hình ảnh.

### `PUT /api/entities/{entity_id}`

Chỉ đổi các trường bạn gửi. Chỉ dành cho quản trị viên: entity_id là tên mà mọi tự động hóa, bảng điều khiển và tác tử dùng để gọi thực thể, và đổi nó là cấu hình.

| Trường | Kiểu | <span class="sr-only">Chi tiết</span> |
|---|---|---|
| `entity_id` | string | Đổi tên. `unique_id` không dịch chuyển |
| `name`, `icon`, `device_class`, `state_class`, `unit_of_measurement`, `entity_category` | string | |
| `options` | object | Theo miền; xem [Thực thể](/vi/iot/entities/#api) |
| `disabled`, `hidden` | bool | Thực thể bị tắt không có trạng thái và không điều khiển được |
| `equipment_id` | int or null | Đặt nó vào cây; `null` lại theo thiết bị của nó |
| `labels` | string[] | Toàn bộ tập |

`unique_id`, `domain`, `platform`, thiết bị và các liên kết không đổi được ở đây, và gửi chúng là 400.

```json
{"entity":{"id":3,"entity_id":"sensor.tank_1_level","name":"Tank 1 level","device_class":"moisture","icon":"mdi:water-percent","...":"..."},"warnings":[]}
```

`warnings` nói khi điều gì đó hợp lệ nhưng lạ (một đơn vị mà lớp thiết bị thường không có). `400` cho phần thân rỗng (`"the update names no field to change"`) hoặc giá trị xấu, `404` cho thực thể không xác định, `409` cho entity_id đã có người dùng.

### `POST /api/entities`

Tạo một thực thể ghép. Phần thân nêu miền và gắn các tag vào các vai trò của nó:

```json
{"name":"Transfer pump","domain":"motor","bindings":[{"role":"run_command","device_id":"tank-farm","tag_name":"pump"},{"role":"running","device_id":"tank-farm","tag_name":"pump"}]}
```

Cũng có `entity_id` (nếu không thì sinh từ tên), `device_class`, `unit_of_measurement`, `icon`, `entity_category` và `options`. Mỗi miền nhận những vai trò và tùy chọn nào nằm ở [Thực thể](/vi/iot/entities/#thiết-bị-ghép). Trả về `201` `{"entity": {...}, "warnings": [...]}`. `400` cho miền không được tạo ở đây (`sensor` đến từ tag của nó, `alarm` từ định nghĩa của nó), vai trò bị thiếu hoặc tag không thể lấp vai trò đó, `409` cho entity_id đã có người dùng.

### `DELETE /api/entities/{entity_id}`

Xóa một thực thể ghép, hoặc một thực thể mồ côi mà tag hay định nghĩa báo động của nó đã mất. `{"deleted":"motor.transfer_pump","entity":{...}}`. Mọi thứ khác trả `409` nói cách nó thực sự biến mất:

```json
{"error":"this entity cannot be deleted: sensor.tank_1_level is kept in step with its tag; delete the tag, and then this orphan, or hide or disable it: already exists"}
```

### `GET /api/states`

Trạng thái của mọi thực thể đang bật, sắp theo entity_id. `?domain=` lọc.

```json
[{"entity_id":"number.tank_farm_level_sp","state":"unknown","attributes":{"armed":true,"friendly_name":"level_sp","max":95,"min":0,"source":["tank-farm/level_sp"],"unit_of_measurement":"%"},"quality":"bad","last_changed":"2026-09-27T20:21:39.417193755Z","last_updated":"2026-09-27T20:21:39.417193755Z","last_reported":"2026-09-27T20:22:04.423849496Z"}]
```

`state` luôn là chuỗi, kể cả với một số; `unknown` và `unavailable` có nghĩa đúng như tên. `last_reported` là dấu thời gian của thiết bị cho lần đọc đằng sau nó.

### `GET /api/states/{entity_id}`

Một trạng thái. `404` cho thực thể không xác định, và một `404` khác cho thực thể bị tắt, nói cách bật nó: thực thể bị tắt không phải là thiếu, và báo nó là thiếu sẽ đẩy ai đó đi tìm một lỗi chính tả.

## Năng lượng

Nhà máy dùng gì và tốn bao nhiêu: kilowatt giờ, khí, nước, khí nén và chi phí của một đơn vị sản xuất. Đồng hồ đo là một tag được đọc như một lượng đã dùng. Toàn bộ mô hình, biểu giá và những gì màn hình làm nằm ở [Năng lượng](/vi/iot/energy/). Đọc là `energy.read`, mọi vai trò đều có; tạo hoặc đổi đồng hồ đo hay biểu giá là `energy.write`, của quản trị viên.

### `GET /api/energy/meters`

Mọi đồng hồ đo, theo loại rồi theo tên, mỗi cái kèm cách nó được đọc và nó đã dùng bao nhiêu hôm nay.

```json
[{"id":"main","name":"Main panel","kind":"electricity","mode":"counter","source":{"device_id":"pm-01","tag_name":"kWh"},"unit":"kWh","factor":0.001,"tariff":{"currency":"USD","price":0.12,"bands":[{"from":"22:00","to":"06:00","price":0.07}]},"enabled":true,"status":{"state":"ok","last_read_at":"2026-11-19T21:15:00Z","resets":0,"gap_seconds":0},"today":{"value":412.6,"cost":49.51,"covered_seconds":43200,"estimated":false}}]
```

`status.state` là `ok`, `waiting` (chưa đọc được gì từ tag), `bad` (lần đọc của tag không tốt, và `reason` nói vì sao) hoặc `disabled`.

### `POST /api/energy/meters`

Tạo một đồng hồ đo. `id` là chữ thường, chữ số, `-` và `_`. `kind` là `electricity`, `gas`, `water`, `air`, `heat` hoặc `production`. `mode` là `counter` (tag tích lũy: lượng đã dùng là nó đã nhích bao nhiêu, nhân `factor`) hoặc `power` (một tốc độ: lượng đã dùng là tốc độ nhân với thời gian nó duy trì, với `power_unit` `W`, `kW` hoặc `MW`, và `unit` `Wh`, `kWh` hoặc `MWh`). `source` là tag. `tariff` là một `price` cố định cho mỗi đơn vị với `currency` tùy chọn, và `bands` tùy chọn (`from` và `to` theo mỗi mười lăm phút, `days`, `price`) cho biểu giá theo giờ; đồng hồ sản xuất không có. Đồng hồ điện tính bằng `Wh`, `kWh` hoặc `MWh` cũng có thể có `demand_price` trong biểu giá: chi phí của một kilowatt trong mười lăm phút cao nhất của nó trong một cửa sổ. Bỏ `enabled` là `true`. `201` kèm `{"meter": {...}, "warnings": []}`. `400` nói điều gì sai: tag không có hoặc không phải số, một dải không nằm trên mười lăm phút, một đồng hồ công suất có hệ số. `409` cho id đã có người dùng.

### `GET /api/energy/meters/{id}`

Một đồng hồ đo, như danh sách hiển thị. `404` cho cái không xác định.

### `PUT /api/energy/meters/{id}`

Thay định nghĩa của một đồng hồ đo. Những gì nó đã đếm vẫn còn, và giữ giá tại thời điểm đó. Trỏ nó sang tag hay chế độ khác thì quên lần đọc cuối dừng ở đâu, vì lần đọc kế tiếp là của thứ khác.

### `DELETE /api/energy/meters/{id}`

Xóa một đồng hồ đo và mọi thứ nó đã đếm. `404` cho cái không xác định.

### `GET /api/energy/summary`

Mức dùng và chi phí của từng đồng hồ đo trong một cửa sổ, và chi phí của một đơn vị sản xuất. Cửa sổ là `?period=` (`today`, `yesterday`, `this_week`, `last_week`, `this_month`, `last_month`, `last_7_days`, `last_30_days`, hoặc một ca viết `shift:06:00-14:00` cho ca mới bắt đầu gần nhất và `last_shift:06:00-14:00` cho ca trước đó; ngày, tháng và ca là của site) hoặc `?from=&to=` theo RFC 3339, gồm from và không gồm to, tối đa 400 ngày. `meters` là danh sách phân tách bằng dấu phẩy các đồng hồ đo có chi phí được tính vào chi phí mỗi đơn vị, và `per` nêu một đồng hồ sản xuất để chia.

```json
{"period":"today","from":"2026-11-19T05:00:00Z","to":"2026-11-20T05:00:00Z",
 "meters":[{"id":"main","name":"Main panel","kind":"electricity","unit":"kWh","currency":"USD","value":412.6,"cost":49.51,"covered_seconds":43200,"coverage":1,"estimated":false}],
 "costs":[{"currency":"USD","cost":49.51}],
 "per_unit":[{"production":"parts","units":9800,"currency":"USD","cost":49.51,"cost_per_unit":0.00505}]}
```

`coverage` là phần của cửa sổ cho đến nay mà các lần đọc bao phủ. Chi phí ở hai loại tiền không bao giờ được cộng, nên mỗi loại có một dòng `per_unit`. `cost_per_unit` là `null` khi chưa làm ra gì (`reason` là `nothing_made`) hoặc khi đã làm ra nhưng chưa đồng hồ có giá nào đếm được mức dùng (`nothing_counted`): đó không phải câu trả lời, không phải bằng không.

Đồng hồ có `demand_price` có `demand` trong dòng của nó: `peak_kw` (mười lăm phút cao nhất của cửa sổ, bằng số kilowatt trung bình của nó), `peak_at` (khi nó bắt đầu), `peak_covered_seconds` (bao nhiêu của mười lăm phút đó đã được đọc; dưới 900 thì đỉnh bị đánh giá thấp) và `cost` (đỉnh nhân giá). `cost` của dòng vẫn là chi phí năng lượng; `costs` và `per_unit` bao gồm phí nhu cầu.

### `GET /api/energy/summary/{period}`

Giống phần tóm tắt, trên một kỳ có tên (hoặc ca) được nêu trong đường dẫn. `meters` và `per` vẫn đặt trong truy vấn.

### `GET /api/energy/series`

Mức dùng của một đồng hồ đo trong một cửa sổ, `?meter=<id>`, cửa sổ như trên, và `step`: `quarter` (tối đa 8 ngày), `hour` (mặc định), `day` hoặc `month`. Bước không có lần đọc nào thì không nằm trong danh sách.

```json
{"meter":"main","unit":"kWh","currency":"USD","step":"day","points":[{"start":"2026-11-19T05:00:00Z","value":412.6,"cost":49.51,"estimated":false}]}
```

### `GET /api/energy/series/{meter}/{period}/{step}`

Giống chuỗi, với đồng hồ đo, kỳ có tên và bước đều nằm trong đường dẫn, cho bên gọi chỉ có một đường dẫn để đưa.

## Dịch vụ

### `POST /api/services/{domain}/{service}`

Ra lệnh cho một thực thể: `switch/turn_on`, `number/set_value`, `motor/start`, `alarm/acknowledge`. Một thực thể, một dịch vụ, một lệnh gọi. Bên dưới nó không là gì ngoài các thao tác ghi tag qua cùng cổng ghi như `POST /api/write`.

```json
{"entity_id":"switch.tank_farm_pump","reason":"start of shift"}
```

`entity_id` là bắt buộc và là một thực thể, không phải danh sách; `reason` là tùy chọn; mọi thứ còn lại là dữ liệu của dịch vụ (`value`, `option`, `position`, `mode`, `minutes`, `note`). Số giữ kiểu mà chúng được gõ. Miền trong đường dẫn phải là miền của thực thể. Mọi dịch vụ và dữ liệu của nó nằm ở [Thực thể](/vi/iot/entities/#mỗi-miền-nhận-gì).

```json
{"call_id":"5c9f8545a93b5443","entity_id":"switch.tank_farm_pump","service":"switch.turn_on","writes":[{"tag":"tank-farm/pump","value":"true","status":"written"}]}
```

Mỗi thao tác ghi là `written`, `not_sent` (bị từ chối trước khi tới thiết bị), `failed` (đã đi ra và thiết bị báo lỗi, nên không biết nó có hiệu lực không) hoặc `skipped` (một thao tác ghi trước đó trong lệnh gọi không thành công). Các thao tác ghi đã làm không bao giờ được hoàn tác. Dịch vụ của thực thể báo động không ghi tag nào và trả lời bằng `alarm` như bộ máy để lại. Dịch vụ của helper cũng không ghi tag nào và trả lời bằng `state` mà chúng để helper lại:

```json
{"call_id":"0f3c2a1b9d8e7f60","entity_id":"input_number.batch_target","service":"input_number.set_value","writes":[],"state":"1250"}
```

`turn_on` của script chạy nó, với dữ liệu làm các trường của nó, và trả lời bằng `script_run` nó đã bắt đầu; các thao tác ghi của các bước của nó được kiểm toán từng cái một dưới dạng `script:<id>`, không phải ở đây. `turn_off` dừng mọi lần chạy của nó. Xem [Script](#script).

`turn_on` của cảnh áp dụng công thức của nó, với `params` và `version` từ dữ liệu, và trả lời bằng toàn bộ `recipe_application` và, trong `writes`, mọi thao tác ghi mà các đích của nó đã làm, theo thứ tự. Nó thất bại trừ khi mọi đích đều được ghi. Xem [Công thức](#công-thức).

Một lệnh gọi thất bại trả lời bằng trạng thái của lỗi và cùng phần thân cộng `error`, để thấy chính xác nó dừng ở đâu:

```json
{"error":"value is outside the tag's configured range: 150 is outside 0..95","call_id":"3cd42f8275e5765e","entity_id":"number.tank_farm_level_sp","service":"number.set_value","writes":[{"tag":"tank-farm/level_sp","value":"150","status":"not_sent","error":"value is outside the tag's configured range: 150 is outside 0..95"}]}
```

| Trạng thái | Khi nào |
|---|---|
| 400 | Không có `entity_id`, sai miền, dịch vụ không xác định, dữ liệu mà dịch vụ không nhận |
| 403 | Quyền, hoặc cổng từ chối theo chính sách |
| 404 | Không có thực thể như vậy |
| 409 | Một chuyển đổi không có trạng thái đã biết, thiết bị trong cây ở trạng thái sai cho dịch vụ |
| 422 | Một giá trị bị từ chối vì nội dung |
| 503 | Thiết bị chưa kết nối; bộ máy báo động không chạy |
| 500 | Lần nhấn nút đã đi ra và lần nhả thì không. **Tag có thể vẫn giữ giá trị nhấn**: hãy kiểm tra và nhả bằng tay |

**`?dry_run=true`** hỏi lệnh gọi sẽ làm gì và không làm gì cả: không có gì được ghi, kiểm toán hay ghi nhật ký. Lệnh gọi được lập kế hoạch như lệnh thật và mọi thao tác ghi được đưa qua chính các kiểm tra của cổng, theo cùng thứ tự, ngay bây giờ. Một phán quyết trả lời 200, bị từ chối hay không: mỗi thao tác ghi là `would_write`, hoặc thao tác đầu tiên sẽ bị từ chối là `not_sent` kèm lý do và phần còn lại là `skipped`, và `error` là lỗi mà lệnh gọi thật sẽ thất bại, từng chữ một.

```json
{"dry_run":true,"error":"value is outside the tag's configured range: 150 is outside 0..95","entity_id":"number.tank_farm_level_sp","service":"number.set_value","writes":[{"tag":"tank-farm/level_sp","value":"150","status":"not_sent","error":"value is outside the tag's configured range: 150 is outside 0..95"}]}
```

Một yêu cầu mà lệnh gọi thật sẽ từ chối trước mọi kiểm tra (không có thực thể như vậy, dịch vụ không xác định, dữ liệu mà dịch vụ không nhận, một chuyển đổi không có trạng thái đã biết) trả lời bằng trạng thái và lỗi của lệnh gọi thật; thiếu quyền cũng vậy. `dry_run` là `true` hoặc `false` và không gì khác: `yes` là 400, không phải một sự đoán, vì đoán sai biến một câu hỏi thành một mệnh lệnh. Xem [Thực thể](/vi/iot/entities/#hỏi-trước-chạy-thử).

**Vì sao quyền được kiểm tra trong handler.** Nó cần `values.write`, giống như ghi tag trực tiếp, vì đó là tất cả những gì nó là; dịch vụ của thực thể `alarm` cần `alarms.ack` thay vào đó, giống màn hình báo động, dịch vụ của helper cần `helpers.write`, mà operator có, dịch vụ của script cần `scripts.run`, giống `POST /api/scripts/{id}/run`, và dịch vụ của cảnh cần `recipes.apply` và quyền riêng của công thức khi nó nêu một quyền, giống `POST /api/recipes/{id}/apply`. Việc kiểm tra được làm bên trong handler chứ không phải phía trước để một lần từ chối vì thiếu quyền được gửi tới cổng ghi và **được kiểm toán theo thực thể** như mọi lần từ chối khác, kèm giá trị đã được yêu cầu. Người dùng không có quyền nhận 403 và một dòng trong `GET /api/writes?entity=...`, không phải 403 mà không có gì. Helper không ghi tag nào, nên lần từ chối cho helper, kể cả lần này, thay vào đó là một cảnh báo trong nhật ký hệ thống (`GET /api/events`) đối với helper, và script cũng vậy. Lần từ chối cho cảnh là một lần áp dụng bị từ chối trong lịch sử của công thức, kèm người dùng.

## Trợ thủ

Những giá trị thuộc về người trong nhà máy chứ không thuộc về PLC: `input_boolean`, `input_number`, `input_select`, `input_text`, `input_counter`, `timer` và `schedule`. Trợ thủ là một thực thể (nền tảng `helper`) và xuất hiện trong `/api/entities` và `/api/states` như mọi thực thể khác; các route này là phần cấu hình của nó. Giá trị của trợ thủ được đặt qua các dịch vụ ở trên, với `helpers.write`. Mọi domain, tùy chọn và dịch vụ đều có trong [Trợ thủ](/vi/iot/helpers/).

### `GET /api/helpers`

Mọi trợ thủ, mỗi trợ thủ kèm các trường của thực thể và `value`, dòng được lưu cho nó:

```json
[{"id":41,"entity_id":"timer.purge","unique_id":"helper:6f1d...","domain":"timer","platform":"helper","name":"Purge","options":{"duration_sec":600},"...":"...","value":{"state":"active","finishes_at":"2026-09-27T21:10:00Z","duration_ms":600000,"changed_at":"2026-09-27T21:00:00Z","changed_by":"otto","source":"ui","call_id":"9a1b...","rev":4}}]
```

### `POST /api/helpers`

Tạo một trợ thủ với giá trị ban đầu. Chỉ dành cho quản trị viên.

```json
{"name":"Batch target","domain":"input_number","unit_of_measurement":"kg","options":{"min":0,"max":5000,"step":50,"initial":1000}}
```

Cũng có `entity_id` (nếu bỏ trống thì tạo từ tên) và `icon`. Trả về `201` `{"helper": {...}}`. `400` nếu domain không thuộc trợ thủ, tùy chọn mà domain không nhận, hoặc `initial` mà chính các tùy chọn của nó sẽ từ chối; `409` nếu entity_id đã được dùng.

### `GET /api/helpers/{entity_id}`

Một trợ thủ, như trong danh sách. `404` nếu thực thể không xác định hoặc không phải trợ thủ.

### `PUT /api/helpers/{entity_id}`

Đổi `name`, `icon`, `unit_of_measurement`, `options`, `disabled`, `hidden`, `entity_id`, `equipment_id` hoặc `labels`, cùng các trường như `PUT /api/entities/{entity_id}`. Chỉ dành cho quản trị viên. Tùy chọn mới không cho phép giá trị đang giữ (một khoảng bị thu hẹp thấp hơn nó, lựa chọn đang chọn bị bỏ) sẽ trả `400`: giá trị không bao giờ bị dời đi cho vừa. Trả về `{"helper": {...}, "warnings": []}`.

### `DELETE /api/helpers/{entity_id}`

Xóa trợ thủ và giá trị của nó. Chỉ dành cho quản trị viên. `{"deleted":"timer.purge"}`. `DELETE /api/entities/{entity_id}` từ chối một trợ thủ bằng `409` chỉ về đây.

## Thiết bị và nhãn

Cây ISA-95 (doanh nghiệp, địa điểm, khu vực, dây chuyền, cell, đơn vị, thiết bị) và các nhãn tự do. Dùng snake_case. Mọi vai trò đều đọc được; chỉ quản trị viên mới thay đổi, vì đổi tên hoặc di chuyển một nút sẽ ghi lại địa điểm, khu vực và dây chuyền của mọi thiết bị bên dưới. Xem [cây thiết bị và nhãn](/vi/iot/equipment/).

### `GET /api/equipment`

Mọi nút, sắp theo id, mỗi nút kèm `path` gồm các tên từ gốc. `?level=area` để lọc. `?q=` giữ các nút có đường dẫn chứa đoạn văn bản (không phân biệt hoa thường), `?limit=` (từ 1 đến 5000, giá trị khác là `400`) giữ những nút đầu tiên trong số đó; với một trong hai, `X-Total-Count` là số nút khớp.

```json
[{"id":4,"parent_id":1,"level":"area","name":"Utilities","created_at":"2026-09-27T20:21:01.637319Z","updated_at":"2026-09-27T20:21:01.637319Z","path":["Demo Plant","Utilities"]}]
```

### `POST /api/equipment`

```json
{"parent_id":3,"level":"cell","name":"Die head","description":"Die and screen changer"}
```

`parent_id` là null hoặc bỏ trống sẽ tạo một gốc. Nút con phải ở cấp thấp hơn nút cha (thiết bị có thể nằm trong thiết bị). Trả về `{"equipment": {...}, "devices_rewritten": []}`. `400` nếu cấp hoặc vị trí sai, `409` nếu đã có nút cùng cấp trùng tên.

### `GET /api/equipment/{id}`

Nút đó, các nút nằm ngay dưới nó, cùng các thiết bị và thực thể đặt trực tiếp trên nó:

```json
{"children":[],"devices":["extruder-1"],"entities":[],"equipment":{"id":3,"parent_id":2,"level":"line","name":"Line 1","...":"...","path":["Demo Plant","Extrusion","Line 1"]}}
```

`400` nếu id không phải số dương, `404` nếu id không xác định.

### `PUT /api/equipment/{id}`

Bất kỳ trường nào trong `name`, `description`, `level`, `parent_id` (`null` chuyển nó về gốc). Chỉ các trường được gửi mới đổi; nội dung rỗng là 400. Trả về nút và **mọi thiết bị có văn bản địa điểm, khu vực hoặc dây chuyền bị đổi do đó**, vì đó chính là văn bản mà các client cũ và công cụ MCP đọc:

```json
{"devices_rewritten":["tank-farm"],"equipment":{"id":4,"parent_id":1,"level":"area","name":"Utilities East","...":"..."}}
```

### `DELETE /api/equipment/{id}`

`{"deleted":5}`. `409` khi còn thứ gì nằm dưới hoặc đặt trên nó, và nói rõ là gì: xóa một nút ngay dưới chân một thiết bị không phải là quyết định để đưa ra vô tình.

### `GET /api/labels`

```json
[{"label_id":"critical","name":"Critical","color":"red","icon":"mdi:alert","description":"Stops the line if it fails","created_at":"2026-09-27T20:24:29.659126Z","updated_at":"2026-09-27T20:24:29.659126Z"}]
```

### `POST /api/labels`

`name` là bắt buộc; `label_id` (1 đến 64 chữ thường, chữ số và dấu gạch dưới) được tạo từ tên nếu bỏ trống, và sau đó không bao giờ đổi. `color`, `icon` (`mdi:...`) và `description` là tùy chọn. Trả về nhãn. `409` nếu tên hoặc id đã được dùng.

### `GET /api/labels/{label_id}`

`{"label": {...}, "devices": ["tank-farm"], "entities": []}`: nhãn và những gì mang nhãn đó. `404` nếu không xác định.

### `PUT /api/labels/{label_id}`

Thay `name`, `color`, `icon` và `description`; trường bỏ trống sẽ bị xóa. `label_id` trong nội dung phải khớp với đường dẫn: nếu không là `400`, vì label_id không bao giờ đổi.

### `DELETE /api/labels/{label_id}`

Gỡ nhãn khỏi mọi thứ đang mang nó. `{"deleted":"critical"}`, hoặc `404`.

### `PUT /api/devices/{id}/labels`

`{"labels": ["critical"]}` thay toàn bộ tập nhãn của một thiết bị. Trả về `{"id":"tank-farm","labels":["critical"]}`. Mọi nhãn phải tồn tại (`400` kèm tên các nhãn còn thiếu), và thiết bị cũng vậy (`404`). Nhãn cố ý không thuộc `POST /api/devices`: mọi client lưu thiết bị đều gửi cả thiết bị mà không có nhãn, và sẽ xóa sạch nhãn ở mỗi lần lưu.

## Báo động

ISA-18.2: phát sinh, xác nhận và trở lại bình thường là những việc khác nhau, và nhật ký cho biết việc nào đã xảy ra.

### `GET /api/alarms`

Mọi định nghĩa, các báo động đang hoạt động và bản tóm tắt. `?outstanding=true` bỏ qua các báo động bình thường và đã bị chặn.

```json
{
  "alarms": [{"definitionId":"extruder-temp-hi","name":"Extruder temperature high","deviceId":"extruder-1","tagName":"Temperature","priority":2,"state":"unack-active","message":"extruder-1/Temperature at 22.80197037650447 C, limit 5","tripValue":22.80197037650447,"raisedAt":"2026-09-27T20:25:19.67042816Z","count":1,"updatedAt":"2026-09-27T20:25:19.67042816Z"}],
  "definitions": [{"id":"extruder-temp-hi","name":"Extruder temperature high","deviceId":"extruder-1","tagName":"Temperature","condition":"hi","limit":5,"priority":2,"enabled":true,"deadband":0.5,"message":"{device}/{tag} at {value}, limit {limit}","createdAt":"2026-09-27T20:25:19.055658Z","updatedAt":"2026-09-27T20:25:19.055658Z"}],
  "summary": {"critical":0,"high":1,"medium":0,"low":0,"unacked":1,"total":1}
}
```

`state` là `normal`, `unack-active`, `ack-active`, `rtn-unack` (đã trở lại bình thường trước khi ai xác nhận, và được giữ trên danh sách để một lần kích hoạt lúc 3 giờ sáng không biến mất trước khi ca sáng nhìn thấy), `shelved` hoặc `suppressed`. `tripValue` là giá trị đã kích hoạt báo động, không phải giá trị hiện tại.

### `POST /api/alarms`

Tạo hoặc thay một định nghĩa.

| Trường | Kiểu | <span class="sr-only">Chi tiết</span> |
|---|---|---|
| `id`, `name` | string | Bắt buộc. `id` theo quy tắc id thiết bị |
| `deviceId`, `tagName` | string | Bắt buộc |
| `condition` | string | `hihi`, `hi`, `lo`, `lolo`, `eq`, `ne`, `true`, `false`, `bad-quality`, `stale` (không có giá trị đọc trong `limit` giây), `roc` (tốc độ thay đổi vượt `limit` mỗi giây) |
| `limit` | number | |
| `priority` | int | Từ 1 (nghiêm trọng) đến 4 (thấp) |
| `enabled` | bool | Bỏ trống là `false` |
| `deadband` | number | Giá trị phải lùi lại bao xa trước khi báo động hết. Không có vùng chết, giá trị nằm đúng trên ngưỡng sẽ nhấp nháy liên tục |
| `onDelaySec`, `offDelaySec` | int | Điều kiện phải giữ bao lâu trước khi báo động phát sinh, hoặc phải hết bao lâu trước khi trở lại bình thường |
| `message`, `description` | string | `message` nhận `{value}`, `{limit}`, `{tag}`, `{device}`, `{unit}`, `{condition}` và `{reason}` (lý do giá trị đọc bị lỗi, để trống khi giá trị tốt) |

`{value}` được viết đúng như thẻ giá trị viết, kèm đơn vị: số nguyên giữ nguyên, hai chữ số thập phân từ 1 trở lên, một chữ số từ 100 trở lên, bốn chữ số dưới 1, và ký hiệu khoa học khi trên mười triệu hoặc dưới 0.01 (`8.20 pH`, `212.5 F`, `1.235e+7`). Chúng tôi làm vậy vì một tag có hệ số 0.1 và giá trị thô 82 là 8.200000000000001 khi ở dạng float, và biểu ngữ từng hiện đúng như thế. Giá trị dạng văn bản được nêu nguyên như vậy. Tag, các lần ghi và các tự động hóa vẫn thấy con số chính xác; chỉ câu chữ được làm tròn. `{limit}` là ngưỡng đúng như bạn đã nhập.

Trả về định nghĩa; engine tải lại và thực thể báo động được tạo trước khi trả lời. `400` khi kiểm tra không đạt (`"alarm x: priority must be 1-4, got 9"`).

### `POST /api/alarms/import/codesys`

Đọc từ nội dung yêu cầu tệp mà Export Alarms của CODESYS IDE ghi ra (bản xuất một nhóm báo động, `.csv`), đúng như IDE đã ghi (UTF-16 có dấu thứ tự byte) hoặc ở dạng UTF-8. `?deviceId=` là thiết bị PLC và là bắt buộc. `?application=` là tên ứng dụng mà các tag của nó nằm dưới, mặc định là `Application`: bản xuất gọi tên một biến theo GVL của nó (`GVL_Alarm.bPumpFault`) và tag là `Application.GVL_Alarm.bPumpFault`. `?defaultPriority=` (1 đến 4) là mức ưu tiên của báo động có lớp không phải Error, Warning hay Info. Không có `?apply=true` thì không lưu gì cả: phản hồi cho biết những gì sẽ được đưa vào.

Màn hình Báo động có chức năng này với tên Nhập từ CODESYS (chỉ quản trị viên): chọn thiết bị, đặt tên ứng dụng, chọn tệp, xem bản xem trước, rồi nhập.

Báo động số so sánh với `= TRUE` hoặc `= FALSE` trở thành `true` và `false`, UpperLimit với `>` trở thành `hi`, LowerLimit với `<` trở thành `lo`, báo động Outside range (`OutOfArea`, với cả hai toán tử `<`) trở thành hai báo động, một `lo` ở ngưỡng dưới và một `hi` ở ngưỡng trên, thông báo và độ trễ bật, tắt (thời gian IEC như `T#5s`) được mang sang, và Error là mức ưu tiên 2, Warning là 3, Info là 4. Mọi thứ khác mà IDE có thể ghi sẽ không được đọc và quay lại trong `skipped` kèm dòng và lý do, vì CODESYS không công bố định dạng và chỉ những gì một bản xuất thật đã cho thấy mới được đọc. Điều đó gồm cả phần còn lại IDE cung cấp: Inside the range (`ForbiddenArea`) chỉ đúng giữa hai ngưỡng mà ở đây một báo động chỉ có một ngưỡng, Change không có thời lượng được ghi tài liệu, còn Event và Alarm (API) do chương trình PLC kích hoạt và không có biến nào để theo dõi. `warnings` liệt kê những gì chỉ được mang sang một phần (lớp không rõ, chốt giữ, báo động có mức ưu tiên cao hơn).

```json
{"applied": false, "version": "2.0.0.0",
 "alarms": [{"id":"codesys-GVL_Alarm.rTemp-hi","name":"Temperature high","deviceId":"plc1","tagName":"Application.GVL_Alarm.rTemp","condition":"hi","limit":90,"priority":3,"enabled":true,"message":"Temperature high"}],
 "skipped": [{"row":5,"id":"3","reason":"the observation type \"Deviation\" has not been seen in an export, so it is not read"}],
 "warnings": []}
```

`404` cho thiết bị không xác định, `400` cho tệp không phải bản xuất của một nhóm báo động.

### `DELETE /api/alarms/{id}`

`{"deleted":"extruder-temp-hi"}`, hoặc `404`.

### `POST /api/alarms/{id}/ack`

Nội dung gửi kèm tùy chọn `{"note": "checking the heater bands"}`. Trả về báo động ở trạng thái hiện tại, kèm `ackedBy` và `ackNote`. `404` nếu báo động không xác định.

### `POST /api/alarms/{id}/shelve`

`{"minutes": 30}`, bắt buộc và là số dương: tắt tiếng vô thời hạn là một sự chặn báo động, tức là việc khác, không phải việc của người vận hành. Trả về báo động, với `state` là `shelved`, cùng `shelvedUntil` và `shelvedBy`.

### `POST /api/alarms/{id}/unshelve`

Không có nội dung gửi kèm. Trả về báo động về đúng trạng thái mà điều kiện của nó đặt ra. `409` nếu nó không ở trạng thái đã hoãn.

### `GET /api/alarms/events`

Nhật ký kiểm tra báo động, mới nhất trước. `?alarm=` một định nghĩa, `?limit=` (mặc định 200, tối đa 5000).

```json
[{"id":2,"definitionId":"extruder-temp-hi","type":"acked","fromState":"unack-active","toState":"ack-active","value":23.192472931395088,"message":"extruder-1/Temperature at 22.80197037650447 C, limit 5","actor":"admin","note":"checking the heater bands","at":"2026-09-27T20:25:22.920251Z"}]
```

`type` là `raised`, `acked`, `cleared`, `shelved`, `unshelved`, `suppressed`, `unsuppressed`, `escalated` hoặc `escalation-ended`. Hai giá trị cuối do cơ chế leo thang báo động ghi (`actor` là `escalation`), và `note` của chúng cho biết ai đã được báo và vì sao chuỗi dừng lại. Xem [Thông báo báo động](/vi/iot/notifications/#leo-thang).

## Tự động hóa

Trình kích hoạt, một điều kiện, các thao tác. Ngôn ngữ quy tắc nằm trong [Tự động hóa](/vi/iot/automations/).

### `GET /api/automations`

```json
{"armed":{"fill-tank":true},"automations":[{"id":"fill-tank","name":"Fill the tank","enabled":true,"triggers":[{"type":"threshold","deviceId":"tank-farm","tagName":"level","threshold":20,"direction":"falling","hysteresis":5},{"type":"webhook","webhookPath":"fill-now"}],"actions":[{"type":"call_service","name":"start the pump","params":{"service":"switch.turn_on","entityId":"switch.tank_farm_pump"}}],"mode":"skip","minIntervalSec":60,"createdAt":"2026-09-27T20:26:49.770826Z","updatedAt":"2026-09-27T20:26:49.770826Z"}],"webhooks":["fill-now"]}
```

`armed` cho biết những quy tắc nào đang thực sự chạy, và điều đó không giống `enabled`: một quy tắc đã bật nhưng không còn biên dịch được thì không armed, và đây là nơi bạn biết điều đó.

### `POST /api/automations`

Tạo hoặc thay một quy tắc: `id`, `name`, `description`, `enabled`, `triggers` (ít nhất một), `condition`, `actions` (ít nhất một), `mode` (`skip` là mặc định, `queue`, `restart` hoặc `parallel`), `minIntervalSec`, `maxRuntimeSec`. Quy tắc được biên dịch trước khi lưu, và quy tắc không biên dịch được sẽ trả về 400 và không bao giờ vào cơ sở dữ liệu: một quy tắc đã lưu mà không thể armed là quy tắc mà tác giả của nó tin rằng đang chạy.

```json
{"error":"automation fill-tank action 1 (call_service): params: json: unknown field \"entity_id\""}
```

### `POST /api/automations/validate`

Biên dịch một quy tắc mà không lưu, để trình soạn thảo kiểm tra trực tiếp. Luôn là `200`; phản hồi cho biết nó có biên dịch được không:

```json
{"valid":true}
{"error":"automation bad: at least one trigger is required","valid":false}
```

Cần `automations.write` vì nó tồn tại để giúp ai đó viết một quy tắc.

### `DELETE /api/automations/{id}`

`{"deleted":"fill-tank"}`, hoặc `404`.

### `POST /api/automations/{id}/enabled`

`{"enabled": false}` gỡ trạng thái armed mà không xóa. Trả về `{"enabled":false,"id":"fill-tank"}`, hoặc `404`.

### `POST /api/automations/{id}/trigger`

Chạy ngay, như thể một trình kích hoạt vừa kích hoạt. Điều kiện vẫn áp dụng (điều kiện sai ghi một lần chạy `skipped`) và chế độ chạy cũng vậy; `minIntervalSec` thì không, vì một người yêu cầu chạy không phải là một tag chập chờn. Không có nội dung gửi kèm. `202` `{"triggered":"fill-tank"}`: lần chạy diễn ra ở nền, và `GET /api/runs` có kết quả. `400` nếu quy tắc không armed. Người vận hành có `automations.trigger`; chạy một quy tắc do người khác viết là vận hành, còn viết một quy tắc thì không.

### `GET /api/runs`

Lịch sử chạy, mới nhất trước. `?automation=` một quy tắc, `?limit=` (mặc định 100, tối đa 1000). `[]` khi không có lần nào.

```json
[{"id":1,"automationId":"fill-tank","status":"succeeded","triggerType":"manual","triggerDesc":"triggered by admin","actor":"admin","startedAt":"2026-09-27T20:26:50.269792Z","finishedAt":"2026-09-27T20:26:50.282129Z","durationMs":12.337,"steps":[{"index":1,"type":"call_service","name":"start the pump","input":"switch.turn_on switch.tank_farm_pump {}","output":"true to tank-farm/pump: written; call 8fb9538c82d532be","startedAt":"2026-09-27T20:26:50.272532641Z","durationMs":9.595}]}]
```

`status` là `running`, `succeeded`, `failed`, `skipped`, `timed_out` hoặc `cancelled`. Các bước giữ đầu vào đã được xử lý xong, không phải mẫu, vì đó là thứ bạn cần đọc lúc 3 giờ sáng.

Một quy tắc tạo từ blueprint mang thêm ba trường trong `GET /api/automations`: `blueprintId`, `blueprintVersion` (phiên bản nó được tạo từ đó, và cũng là phiên bản nó giữ nguyên) và `blueprintInputs`. Quy tắc viết tay không có trường nào trong số đó. Chúng thuộc về máy chủ: `POST /api/automations` nhận chúng và bỏ qua, và một chỉnh sửa thủ công giữ nguyên những gì quy tắc đã có.

### `POST /api/automations/{id}/blueprint-upgrade`

Chuyển một quy tắc tạo từ blueprint lên phiên bản mới nhất của blueprint, giữ nguyên id, tên và trạng thái armed. Việc này không bao giờ tự xảy ra. Người vận hành có `blueprints.apply`, giống như khi tạo một quy tắc. Hãy xem trước: **`?dry_run=true`** không thay đổi gì và trả lời điều gì sẽ thay đổi, từng phần một, và quy tắc sẽ làm gì nếu kích hoạt ngay bây giờ, với mọi lần ghi đều qua các kiểm tra của cổng ghi:

```json
{"dry_run":true,"id":"pump_1_watch","blueprint":"pump_watch","from":1,"to":2,"changes":[{"field":"actions","before":[{"params":{"message":"switch.pump_1 started, v1"},"type":"log_event"}],"after":[{"params":{"message":"switch.pump_1 started, v2"},"type":"log_event"}]}],"automation":{"id":"pump_1_watch","...":"..."},"check":{"automation_id":"pump_1_watch","steps":[{"step":"1","type":"log_event","verdict":"not_checked","detail":"a dry run checks writes to equipment; this step writes to none and runs only for real"}]}}
```

Một chỉnh sửa thủ công kể từ khi quy tắc được tạo sẽ hiện trong `changes` là bị thay thế. Khi phiên bản mới cần một đầu vào mà quy tắc không có giá trị, hoặc từ chối một giá trị mà quy tắc được tạo cùng, lần chạy thử nói điều đó trong `error` và không gì khác.

Lần chạy thật nhận `{"version": 2}`, phiên bản mà lần chạy thử đã cho thấy, và `inputs` cho mọi thứ phiên bản mới cần. Một blueprint đã đi tiếp từ đó, hoặc một quy tắc mà ai đó đã nâng cấp trong lúc đó, trả về `409`: cái đã được xem xét là cái được áp dụng, hoặc không có gì được áp dụng. Thiếu đầu vào trả về `400`. `200` với cùng cấu trúc, trong đó `automation` là quy tắc như đã lưu. Nó được ghi nhật ký là `automation upgraded from blueprint pump_watch version 1 to 2`. Với cùng phiên bản và `inputs` mới, đây là cách đổi đầu vào của một quy tắc. `400` cho quy tắc viết tay; `404` nếu blueprint nó xuất phát không còn nữa.

## Script

Các chuỗi thao tác có tên, chạy theo yêu cầu: từ đây, từ bước `call_script` của một quy tắc, từ `run_script` của MCP hoặc qua thực thể của script (`script.turn_on`). Chuỗi này là ngôn ngữ tự động hóa. Mọi lần ghi mà một bước thực hiện đều đi qua cổng ghi dưới dạng `script:<id>`, với nguồn của người đã khởi chạy nó. Tất cả có trong [Script](/vi/iot/scripts/).

### `GET /api/scripts`

Mọi script, kèm bộ đếm lần chạy và số lần chạy của nó đang diễn ra, trong mọi tiến trình:

```json
[{"id":"cip_cycle","name":"CIP cycle","fields":[{"name":"minutes","type":"number","required":true,"min":1,"max":60,"unit":"min"}],"sequence":[{"type":"call_service","params":{"entityId":"switch.cip_pump","service":"switch.turn_on"}}],"mode":"skip","createdAt":"2026-09-28T10:00:00Z","updatedAt":"2026-09-28T10:00:00Z","lastRun":"2026-09-28T10:05:00Z","lastStatus":"succeeded","runCount":3,"running":0}]
```

### `POST /api/scripts`

Tạo một script. Chỉ dành cho quản trị viên. `id` (chữ thường, chữ số và dấu gạch dưới, bắt đầu bằng một chữ cái: đó là id đối tượng của thực thể, `script.<id>`), `name`, `description`, `icon`, `fields` (đầu vào có kiểu), `sequence` (ít nhất một thao tác), `mode` (`skip` là mặc định, `queue`, `restart` hoặc `parallel`) và `maxRuntimeSec`. Nó được biên dịch trước khi lưu, như một quy tắc, và script sẽ tự gọi chính nó, trực tiếp hoặc qua các script khác, bị từ chối. Trả về `201` cùng script. `400` cho thứ không biên dịch được; `409` cho id đã có người dùng.

### `POST /api/scripts/validate`

Kiểm tra một script mà không lưu, để trình soạn thảo kiểm tra trực tiếp. `200` `{"valid":true}` hoặc `{"valid":false,"error":"..."}`, bằng đúng những lời mà một lần lưu sẽ bị từ chối.

### `GET /api/scripts/{id}`

Một script, như trong danh sách. `404` nếu không có.

### `PUT /api/scripts/{id}`

Thay định nghĩa của nó; nội dung gửi kèm giống như khi tạo, và có thể bỏ `id`. Chỉ dành cho quản trị viên. Các lần chạy đang diễn ra bị hủy khi bước, trường hoặc chế độ của nó thay đổi: chúng được khởi chạy từ định nghĩa cũ.

### `DELETE /api/scripts/{id}`

Xóa nó cùng lịch sử chạy, và hủy các lần chạy đang diễn ra. Chỉ dành cho quản trị viên. `{"deleted":"cip_cycle"}`. Thực thể của nó thành mồ côi, không bị xóa.

### `POST /api/scripts/{id}/run`

Chạy nó. Người vận hành có `scripts.run`.

```json
{"fields":{"minutes":20},"reason":"end of shift clean","wait":false}
```

Mọi trường trong nội dung gửi kèm đều tùy chọn, và nội dung gửi kèm cũng vậy. Các trường được kiểm tra với các trường của script trước khi bất cứ thứ gì chạy: một giá trị ngoài phạm vi, lệch bước, không phải một trong các lựa chọn hoặc sai kiểu sẽ trả về `400`, và không bao giờ bị dịch chuyển cho khớp. `202` cùng lần chạy ngay khi nó bắt đầu; với `"wait":true`, `200` cùng lần chạy khi nó đã kết thúc, kèm dấu vết của nó.

```json
{"run":{"id":77,"scriptId":"cip_cycle","status":"running","actor":"otto","source":"ui","fields":{"minutes":20},"startedAt":"2026-09-28T10:05:00Z","durationMs":0}}
```

`409` khi nó đang bận: đang chạy rồi và chế độ là `skip`, hoặc đang chạy với một lần đang chờ và chế độ là `queue`. Không có gì chạy, và một lần chạy `skipped` nằm trong lịch sử cho biết lý do:

```json
{"error":"script busy: script cip_cycle was not started: it is already running, and its mode is skip","run":{"id":78,"scriptId":"cip_cycle","status":"skipped","...":"..."}}
```

**`?dry_run=true`** hỏi một lần chạy sẽ làm gì bây giờ và không làm gì trong đó. Các trường được kiểm tra theo cùng cách; sau đó từng bước được duyệt trên nhà máy như hiện tại: mọi lần ghi và lệnh gọi dịch vụ đều qua các kiểm tra riêng của cổng, một điều kiện được đánh giá, một biến được gán. Một lần chờ, một độ trễ và mọi thứ không ghi vào thiết bị nào là `not_checked`. Lần ghi đầu tiên bị từ chối sẽ kết thúc nó, như nó sẽ kết thúc lần chạy, và `error` nói điều đó bằng lời của cổng. `200` cùng kết luận, bị từ chối hay không:

```json
{"dry_run":true,"check":{"script_id":"cip_cycle","fields":{"minutes":20},"steps":[{"step":"1","type":"call_service","input":"switch.turn_on switch.cip_pump {}","verdict":"refused","detail":"cip/pump: this tag is not marked writable"}],"error":"step 1 (call_service): cip/pump: this tag is not marked writable"}}
```

`verdict` của mỗi bước là `would_write`, `refused`, `ends_here` (một điều kiện hiện đang sai, hoặc một lệnh dừng), `not_checked` hoặc `ok`. Một bước của script mà nó gọi được đánh số dưới lệnh gọi: `3.1`.

### `POST /api/scripts/{id}/stop`

Hủy mọi lần chạy đang diễn ra của nó, trong mọi tiến trình, ở bất cứ đâu. `{"cancelled":1,"stopped":"cip_cycle"}`, trong đó `cancelled` là số lần chạy mà tiến trình này có. Người vận hành có `scripts.run`: dừng thứ họ được phép khởi chạy là một phần của việc khởi chạy nó.

### `GET /api/scripts/{id}/runs`

Các lần chạy của nó, mới nhất trước, kèm dấu vết. `?limit=` (mặc định 50, tối đa 1000). `parent` là thứ đã gọi một lần chạy, khi có: `automation_run:812`, `script_run:77`.

```json
[{"id":77,"scriptId":"cip_cycle","status":"succeeded","actor":"automation:shift-end","source":"automation","parent":"automation_run:812","fields":{"minutes":20},"startedAt":"2026-09-28T10:05:00Z","finishedAt":"2026-09-28T10:25:00Z","durationMs":1200012,"steps":[{"index":1,"type":"call_service","input":"switch.turn_on switch.cip_pump {}","output":"true to cip/pump: written; call 8fb9538c82d532be","startedAt":"2026-09-28T10:05:00Z","durationMs":9.6}]}]
```

## Công thức

Các bộ giá trị được áp dụng cùng nhau: giá trị đặt của một loại sản phẩm, một lần đổi sản phẩm. Mỗi bộ cũng là một thực thể, `scene.<id>`. Công thức được kiểm tra trọn vẹn trước khi có gì được gửi đi và bị từ chối trọn vẹn vì bất kỳ lý do nào; các mục tiêu của nó sau đó được gửi theo thứ tự dưới một id lệnh gọi duy nhất, mục tiêu đầu tiên thất bại sẽ dừng phần còn lại và không có gì được hoàn tác; mọi giá trị đã ghi đều được đọc lại từ thiết bị. Tất cả có trong [Công thức](/vi/iot/recipes/).

Tên, mô tả, nút thiết bị và quyền của một công thức thay đổi ngay tại chỗ. Những gì nó ghi (`targets`, `params`, `precondition`, `verify_sec`) là một phiên bản, và phiên bản không bao giờ bị sửa: lưu nội dung mới sẽ lưu phiên bản kế tiếp.

### `GET /api/recipes`

Mọi công thức, kèm nội dung của phiên bản hiện tại và lần áp dụng mới nhất:

```json
[{"id":"grade_a","name":"Grade A","equipment_id":7,"apply_permission":"recipes.apply","current_version":3,"params":[{"name":"speed","type":"number","min":0,"max":400,"step":10,"unit":"rpm","required":true}],"precondition":"states['input_boolean.line_ready'] == 'on'","targets":[{"entity_id":"number.line_02_zone1_sp","service":"set_value","data":{"value":210}},{"entity_id":"number.line_02_speed","service":"set_value","data_expressions":{"value":"vars.speed"}}],"verify_sec":10,"note":"zone 1 up 5","created_at":"2026-09-28T10:00:00Z","updated_at":"2026-09-28T11:00:00Z","last_application":{"id":41,"recipe_id":"grade_a","version":3,"call_id":"7c1f0e2d9a8b6c54","actor":"otto","source":"ui","params":{"speed":250},"status":"applied","targets":[],"started_at":"2026-09-28T11:05:00Z","finished_at":"2026-09-28T11:05:01Z"}}]
```

`equipment_id` là `null` với công thức của cả nhà máy.

### `POST /api/recipes`

Tạo một công thức, là phiên bản 1. Chỉ dành cho quản trị viên. `id` (chữ thường, chữ số và dấu gạch dưới, bắt đầu bằng một chữ cái: đó là id đối tượng của thực thể, `scene.<id>`), `name`, `description`, `equipment_id`, `apply_permission` (`recipes.apply`, là mặc định, hoặc `recipes.apply.<name>`), `params` (đầu vào có kiểu), `precondition` (một biểu thức phải đúng thì mới bắt đầu), `targets` (ít nhất một, nhiều nhất 200, mỗi mục có `entity_id`, `service` và `data` hoặc `data_expressions`), `verify_sec` (từ 1 đến 600, mặc định 10) và `note`. Một mục tiêu đặt một giá trị: `set_value`, `select_option`, `set_position`, `set_speed`, `set_setpoint`, `set_mode`, `turn_on`, `turn_off`, trên các miền chấp nhận chúng. Một xung hoặc một lệnh khởi động bị từ chối: nó thuộc về một script. Thực thể của mỗi mục tiêu phải tồn tại, và mọi biểu thức phải biên dịch được. `201` cùng công thức; `400` cho bất cứ lỗi nào, `409` cho id đã có người dùng.

### `POST /api/recipes/capture`

Soạn nháp một công thức từ những gì các thực thể đang giữ bây giờ, chỉ dành cho quản trị viên, và không lưu gì:

```json
{"entity_ids":["number.line_02_zone1_sp","switch.line_02_heater","loop.line_02_tic"]}
```

Mỗi thực thể trở thành một mục tiêu đặt nó về giá trị hiện tại, theo thứ tự đã cho; một vòng điều khiển trở thành chế độ của nó rồi đến giá trị đặt. Phản hồi là một công thức không có id và không có tên, dành cho trình soạn thảo. Một thực thể không tồn tại, bị tắt, được đọc với chất lượng không phải tốt, là `unknown` hoặc `unavailable`, hoặc không phải thứ mà công thức đặt, trả về `400` nêu tên từng thực thể: một công thức dựng từ một số đọc xấu sẽ ghi lại số đọc xấu đó.

### `GET /api/recipes/{id}`

Một công thức, như trong danh sách. `404` nếu không có.

### `PUT /api/recipes/{id}`

Lưu nó. Chỉ dành cho quản trị viên. Nội dung gửi kèm là công thức như `GET` đã trả về, đã được chỉnh sửa; có thể bỏ `id`. `current_version` là phiên bản mà bản chỉnh sửa dựa trên: nếu từ đó có người đã lưu một phiên bản khác, lần lưu trả về `409` thay vì lặng lẽ ghi đè phiên bản của họ (`0` bỏ qua việc kiểm tra). Nội dung mới trở thành phiên bản kế tiếp, với `note` nói lý do; chỉ đổi tên, mô tả, thiết bị hoặc quyền thì không tạo phiên bản nào.

### `DELETE /api/recipes/{id}`

Xóa nó cùng các phiên bản. Chỉ dành cho quản trị viên. `{"deleted":"grade_a"}`. Các lần áp dụng của nó được giữ lại, vì đó là những gì đã gửi tới nhà máy, và thực thể của nó thành mồ côi.

### `GET /api/recipes/{id}/versions`

Mọi phiên bản, mới nhất trước, mỗi phiên bản đúng như lúc được lưu, kèm người đã lưu và ghi chú:

```json
[{"recipe_id":"grade_a","version":3,"params":[],"targets":[{"entity_id":"number.line_02_zone1_sp","service":"set_value","data":{"value":210}}],"verify_sec":10,"note":"zone 1 up 5","created_by":"ada","created_at":"2026-09-28T11:00:00Z"}]
```

### `GET /api/recipes/{id}/versions/{version}`

Một phiên bản. `404` nếu công thức không có phiên bản đó, `400` nếu `{version}` không phải là số.

### `POST /api/recipes/{id}/validate`

Nó có được áp dụng ngay bây giờ không? Người vận hành có `recipes.apply`. Nội dung gửi kèm giống với một lần áp dụng, và không có gì được ghi, lưu hay đưa vào nhật ký. Mọi kiểm tra mà một lần áp dụng thực hiện trước khi ghi đều được thực hiện: các tham số, quyền riêng của công thức, điều kiện tiên quyết, các biểu thức dữ liệu, liệu một lần áp dụng khác có đang ghi vào một trong các thực thể của nó hay không, và mỗi mục tiêu đều qua các kiểm tra của cổng ghi. `200` cùng kết luận, `would_apply` hoặc `refused`, và kết luận của từng mục tiêu: `would_write`, `refused` kèm lý do, hoặc `not_sent`.

```json
{"dry_run":true,"application":{"recipe_id":"grade_a","version":3,"params":{"speed":250},"status":"refused","targets":[{"index":1,"entity_id":"number.line_02_zone1_sp","service":"set_value","data":{"value":210},"status":"would_write"},{"index":2,"entity_id":"number.line_02_speed","service":"set_value","data":{"value":250},"status":"refused","error":"line-02/Speed: this tag is not marked writable"}],"started_at":"2026-09-28T11:04:00Z","error":"target 2 (set_value number.line_02_speed): line-02/Speed: this tag is not marked writable"}}
```

Các tham số mà nó không nhận sẽ trả về `400`, như với lần áp dụng thật.

### `POST /api/recipes/{id}/apply`

Áp dụng nó. Người vận hành có `recipes.apply`. Một công thức nêu tên một quyền riêng, `recipes.apply.<name>`, cũng đòi quyền đó, được kiểm tra ở đây đối với công thức; người dùng không có quyền nhận `403` và một lần áp dụng bị từ chối trong lịch sử mang tên họ.

```json
{"params":{"speed":250},"reason":"grade A for the 2pm run","version":0,"resume":0}
```

Mọi thứ đều tùy chọn, và nội dung gửi kèm cũng vậy. `version` áp dụng có chủ ý một phiên bản cũ hơn; bỏ đi thì dùng phiên bản hiện tại. `resume` là id của một lần áp dụng trước đó của công thức này đã dừng giữa chừng: các mục tiêu của nó chưa được ghi sẽ được gửi như một lần áp dụng mới, với phiên bản và tham số của nó, và `parent` cho biết nó hoàn tất lần nào.

Nó phản hồi khi mọi giá trị đã được ghi và đọc lại, việc này mất tối đa `verify_sec` của công thức:

```json
{"application":{"id":42,"recipe_id":"grade_a","version":3,"call_id":"9d2e4f6a8b0c1e3f","actor":"otto","source":"ui","reason":"grade A for the 2pm run","params":{"speed":250},"status":"applied","targets":[{"index":1,"entity_id":"number.line_02_zone1_sp","service":"set_value","data":{"value":210},"status":"written","writes":[{"tag":"line-02/Zone1_SP","value":"210","status":"written"}],"verification":"verified","verify_detail":"read back 210"},{"index":2,"entity_id":"number.line_02_speed","service":"set_value","data":{"value":250},"status":"written","writes":[{"tag":"line-02/Speed","value":"250","status":"written"}],"verification":"unconfirmed","verify_detail":"not confirmed within 10s: read back 240, not 250"}],"started_at":"2026-09-28T11:05:00Z","finished_at":"2026-09-28T11:05:10Z"}}
```

Một mục tiêu là `written`, `failed` (đã gửi đi và thiết bị nói không, hoặc không nói gì), `not_sent`, `skipped` (một mục trước nó không qua được) hoặc `refused` (kiểm tra trước). Mục đã ghi là `verified` khi thiết bị đọc lại, sau khi gửi, đúng giá trị đã gửi cho nó, và `unconfirmed` khi nó không làm vậy trong `verify_sec`: đã gửi đi và có thể chưa được chấp nhận. Mỗi lần ghi mang `call_id` của lần áp dụng, nên `GET /api/writes?call=<call_id>` là tất cả.

| Trạng thái | Khi nào |
|---|---|
| 200 | `applied`: mọi mục tiêu đã được ghi. Kiểm tra `verification` của từng mục |
| 400 | Một tham số mà công thức không nhận, ngoài phạm vi hoặc sai kiểu; một `resume` mà không còn gì để áp dụng |
| 403 | Quyền riêng của công thức. Được ghi lại như một lần áp dụng bị từ chối |
| 404 | Không có công thức như vậy, hoặc không có phiên bản như vậy |
| 409 | `refused`: bất kỳ lý do nào để không bắt đầu, mỗi lý do nằm trong `error` và trên mục tiêu của nó. Hoặc một lần áp dụng khác đang ghi vào một trong các thực thể của nó ngay lúc này. Không có gì được ghi |
| 502 | `partial` hoặc `failed`: đã bắt đầu, và không phải mục tiêu nào cũng được gửi đi. `targets` cho biết chính xác mục nào. Không có gì được hoàn tác |

Mọi phản hồi trừ `400` cho nội dung sai định dạng hoặc `404` đều mang lần áp dụng, và mọi lần áp dụng trừ lần chạy thử đều nằm trong `GET /api/recipes/{id}/applications`, kể cả các lần bị từ chối.

### `GET /api/recipes/{id}/applications`

Các lần áp dụng của nó, mới nhất trước, kể cả các lần bị từ chối. `?limit=` (mặc định 50, tối đa 1000). `parent` là thứ đã áp dụng nó, khi có: `automation_run:812`, `script_run:77`, `application:41`. Các lần áp dụng của một công thức đã xóa vẫn được trả về.

## Blueprint

Một tự động hóa được viết một lần với các chỗ trống có kiểu, được điền vào để tạo ra một quy tắc thông thường. Quy tắc giữ phiên bản mà nó được tạo từ đó; sửa blueprint không đổi quy tắc nào, và chuyển một quy tắc lên phiên bản mới hơn là [một lần nâng cấp](#post-apiautomationsidblueprint-upgrade) do ai đó yêu cầu. Mọi lần ghi của quy tắc đều đi qua cổng ghi dưới dạng `automation:<id>`. Tất cả có trong [Blueprint](/vi/iot/blueprints/).

### `GET /api/blueprints`

Mọi blueprint, loại tích hợp sẵn trước, mỗi blueprint kèm số quy tắc đã tạo từ nó:

```json
[{"id":"motor_running_too_long","name":"Motor running too long","description":"Says so when a motor has been running longer than it should...","source":"builtin","version":1,"inputs":[{"name":"motor","label":"Motor","type":"entity","required":true,"domain":["motor"]},{"name":"max_run","label":"Longest it may run","type":"duration","default":3600},{"name":"stop_it","label":"Stop it as well","type":"boolean","default":false}],"template":{"triggers":[{"type":"state","entityId":{"!input":"motor"},"to":"running","forSec":{"!input":"max_run"}}],"...":"..."},"instances":2}]
```

`source` là `builtin` (đi kèm trong tệp nhị phân, chỉ đọc) hoặc `user`.

### `POST /api/blueprints`

Viết một blueprint. Chỉ dành cho quản trị viên. `id` (chữ thường, chữ số và dấu gạch dưới, bắt đầu bằng một chữ cái), `name`, `description`, `inputs` (có kiểu, giống các trường của một script) và `template`: quy tắc, với `description`, `triggers`, `condition`, `actions`, `mode`, `minIntervalSec` và `maxRuntimeSec`, cùng các chỗ trống trong đó. `{"!input": "motor"}` làm giá trị sẽ được thay bằng đầu vào; `${motor}` trong một chuỗi cũng vậy, như một giá trị nguyên văn khi chuỗi là biểu thức. Nó được kiểm tra trước khi lưu: mỗi chỗ trống nêu một đầu vào, mỗi đầu vào đều được dùng, và khi điền giá trị mẫu thì tạo ra một quy tắc biên dịch được. `201` ở `version` 1. `400` cho bất cứ lỗi nào, `409` cho id đã có người dùng, kể cả id của blueprint tích hợp sẵn.

### `GET /api/blueprints/{id}`

Một blueprint, như trong danh sách. `404` nếu không có.

### `PUT /api/blueprints/{id}`

Thay định nghĩa của nó; nội dung gửi kèm giống như khi viết một blueprint, và có thể bỏ `id`. Chỉ dành cho quản trị viên. `version` tăng thêm một khi `inputs` hoặc `template` thay đổi, và không tăng khi đổi tên hoặc mô tả. **Không quy tắc nào được tạo từ nó bị thay đổi.** Mỗi quy tắc giữ phiên bản nó được tạo từ đó, và `GET /api/automations` cho biết là phiên bản nào. Blueprint tích hợp sẵn trả về `400`: hãy sao chép nó dưới một id của riêng bạn.

### `DELETE /api/blueprints/{id}`

Chỉ dành cho quản trị viên. `{"deleted":"pump_watch"}`. `409` chừng nào còn quy tắc được tạo từ nó, nêu tên các quy tắc đó: hãy xóa chúng trước. Blueprint tích hợp sẵn trả về `400`.

### `POST /api/blueprints/{id}/instantiate`

Tạo một quy tắc từ nó và armed quy tắc đó. Người vận hành có `blueprints.apply`: bơm nào và trong bao lâu là do họ chọn, còn quy tắc làm gì thì đã được quyết định khi blueprint được viết.

```json
{"automationId":"infeed_too_long","name":"Infeed pump ran too long","enabled":true,"inputs":{"motor":"motor.infeed_pump","max_run":"90m","stop_it":true}}
```

`name` mặc định là tên của blueprint và `enabled` là `true`. Mọi đầu vào được kiểm tra trước khi tạo bất cứ thứ gì: một giá trị ngoài phạm vi, lệch bước, không phải một trong các lựa chọn, một thực thể của miền khác hoặc sai kiểu trả về `400` nêu tên từng giá trị sai, và không bao giờ bị dịch chuyển cho khớp. Một `automationId` đã có người dùng trả về `409`: tạo quy tắc không bao giờ thay thế quy tắc khác. `201` cùng quy tắc, với `blueprintId`, `blueprintVersion` và `blueprintInputs` được đặt. Nó được ghi nhật ký là `automation made from blueprint motor_running_too_long version 1`.

**`?dry_run=true`** không tạo gì. Nó trả lời quy tắc mà nó sẽ tạo và quy tắc đó sẽ làm gì nếu kích hoạt ngay bây giờ: điều kiện được đánh giá, mỗi lần ghi và lệnh gọi dịch vụ đều qua các kiểm tra của cổng dưới dạng `automation:<id>`, lần từ chối đầu tiên nằm trong `check.error` bằng lời của cổng. Không có gì được lưu, ghi hay kiểm toán.

```json
{"dry_run":true,"automation":{"id":"infeed_too_long","...":"..."},"check":{"automation_id":"infeed_too_long","steps":[{"step":"1","type":"log_event","verdict":"not_checked"},{"step":"2","type":"condition","input":"true","verdict":"ok","detail":"true now"},{"step":"3","type":"call_service","input":"motor.stop motor.infeed_pump {}","verdict":"would_write","detail":"would write false to line-02/M1_Run"}]}}
```

## Bảng điều khiển

Các trang gồm những thẻ, dành cho các vai trò và màn hình cần chúng. Một bảng điều khiển không ra lệnh gì: một thẻ nêu một tag, một thực thể, một script hoặc một công thức, và nút của nó ghi thông qua [`POST /api/write`](#post-apiwrite) với tư cách người đã nhấn. Bảng treo tường là một trong số đó. Tất cả có trong [Bảng điều khiển](/vi/iot/dashboards/).

### `GET /api/dashboards`

Các bảng điều khiển được đề nghị cho người gọi, theo thứ tự bộ chuyển hiển thị, kể cả bảng treo tường. Ai có `dashboards.write` được đề nghị tất cả.

```json
[{"id":"wall","name":"Wall board","description":"The tags pinned on the Board screen, as gauges.","kind":"wall","roles":[],"homeFor":[],"screens":["wall-tv"],"position":0,"cards":[],"version":2,"updatedBy":"ada"},
 {"id":"line-2","name":"Line 2","kind":"cards","roles":["operator","admin"],"homeFor":["operator"],"screens":["line-2-panel"],"position":1,"version":3,"updatedBy":"ada","cards":[{"id":"temp","type":"gauge","title":"Zone 1","w":3,"h":3,"config":{"tag":"press-01/Zone1_Temp"}}]}]
```

### `POST /api/dashboards`

Dựng một bảng. Chỉ dành cho quản trị viên. `id` (chữ thường, chữ số, dấu gạch ngang và gạch dưới, bắt đầu bằng một chữ cái), `name`, và tùy chọn `description`, `roles`, `homeFor`, `screens`, `position` và `cards`. `201` ở `version` 1, với kích thước và cấu hình của mỗi thẻ ở dạng đã lưu.

Một thẻ gồm `id`, `type`, `title`, `w` (1 đến 12 cột), `h` (1 đến 8 hàng) và một `config`. Các kiểu và cấu hình của chúng nằm trong [Bảng điều khiển](/vi/iot/dashboards/#các-thẻ). Nó được kiểm tra trước khi lưu:

- một khóa cấu hình mà kiểu không có, một số ngoài phạm vi, một địa chỉ camera hoặc sơ đồ mặt bằng có thông tin đăng nhập hoặc token trong đó, hoặc hơn 60 thẻ sẽ trả về `400`;
- một thẻ nêu một tag, thực thể, script hoặc công thức không tồn tại sẽ trả về `400` nêu tên nó;
- một `button` trên tag không ghi được, hoặc với một số ngoài phạm vi của tag, trả về `400`: cổng sẽ từ chối mọi lần nhấn;
- một vai trò không tồn tại trả về `400`;
- một `id` đã có người dùng, một màn hình mà bảng khác đã có, hoặc trang chủ của một vai trò mà bảng khác đã là, trả về `409`.

### `GET /api/dashboards/{id}`

Một bảng, như trong danh sách. `404` nếu không có, và cả khi người gọi không được đề nghị bảng đó.

### `PUT /api/dashboards/{id}`

Thay thế nó. Chỉ dành cho quản trị viên. Nội dung gửi kèm là bảng điều khiển như `GET` đã trả về, với `version` đặt ở phiên bản lúc nó được đọc: **bắt buộc có**, và một lần lưu nêu phiên bản không còn là hiện tại sẽ trả về `409` cho biết phiên bản hiện tại là gì, vì lựa chọn còn lại là lặng lẽ xóa những gì người lưu cuối cùng vừa dựng. Có thể bỏ `id` khỏi nội dung, `kind` không thể đổi, còn `createdAt`, `updatedAt` và `updatedBy` thuộc về máy chủ và bị bỏ qua. `200` cùng bảng ở phiên bản kế tiếp.

Bảng treo tường nhận `PUT` chỉ cho các phân công của nó (`roles`, `homeFor`, `screens`, `position`) và không gì khác: nó không có thẻ, nên bảng có thẻ trả về `400`. Các đồng hồ của nó là các tag của bảng, `GET` và `PUT /api/board`.

### `DELETE /api/dashboards/{id}`

Chỉ dành cho quản trị viên. `{"deleted":"line-2"}`. Các thẻ chỉ tới các thứ khác và không sở hữu gì, nên không có gì khác bị chạm tới. Bảng treo tường trả về `400`: nó luôn có đó.

Việc dựng, lưu và xóa được ghi nhật ký là các sự kiện `config` trên đối tượng `dashboard:<id>`.

### `GET /api/dashboards/{id}/export`

Bảng điều khiển dưới dạng tệp màn hình: một tài liệu JSON có phiên bản mà [`POST /api/dashboards/import`](#post-apidashboardsimport) nạp vào một bản cài đặt khác. Nó phản hồi dưới dạng tệp đính kèm tên `<id>.hotloop-screen.json`. Người gọi cần `dashboards.read` và phải được đề nghị bảng đó, như với `GET` một bảng. Bảng treo tường trả về `400`: đó là các đồng hồ được ghim của một bản cài đặt, không phải bố cục. Định dạng nằm trong [Tệp màn hình](/vi/iot/screen-file/).

### `POST /api/dashboards/import`

Đọc một tệp màn hình, kiểm tra nó với bản cài đặt này và lưu thành một bảng điều khiển mới. Chỉ dành cho quản trị viên, và nó không thể lưu thứ mà `POST /api/dashboards` sẽ từ chối. Nội dung gửi kèm là chính tệp, hoặc `{"file": {...}}` với các tùy chọn bên cạnh:

| Tùy chọn | <span class="sr-only">Chi tiết</span> |
|---|---|
| `id`, `name` | Lưu dưới id hoặc tên khác. |
| `replace` | Nếu id đã có người dùng, lưu đè lên bảng đó ở phiên bản hiện tại của nó. Không có tùy chọn này thì id đã có người dùng trả về `409`. |
| `skipAssignments` | Bỏ `screens` và `homeFor` của tệp, vốn thuộc về bản cài đặt đã tạo ra nó. `roles` được giữ lại. |
| `remap` | Gọi các thứ ở đây là gì: `tags` (khóa đầy đủ sang khóa đầy đủ, như tệp nêu tag hoặc như nó đọc được sau khi `devices` đã chuyển nó), `devices` (id sang id, cũng chuyển phần thiết bị của mọi tag không nêu trong `tags`), `entities`, `scripts`, `recipes` và `equipment` (id sang id). Một mục mà không thứ gì trên màn hình dùng là một cảnh báo. |
| `dryRun` | Trả về báo cáo và không lưu gì. Luôn là `200`. |
| `codesys`, `visualization` | Thay cho `file`: nội dung xuất gốc của CODESYS, và hình thức hiển thị cần lấy khi nó chứa nhiều cái. Khi đó báo cáo có một `conversion` cho biết mỗi phần tử trở thành gì và cái gì bị bỏ lại. Xem [Nhập màn hình CODESYS](/vi/iot/codesys-screen-import/). |

Phản hồi là một báo cáo dù có lưu gì hay không:

```json
{"ok":false,"dryRun":true,"id":"line-2","name":"Line 2","cards":6,"replaces":false,
 "problems":[{"kind":"tag","ref":"press-01/Zone1_Temp","message":"tag press-01/Zone1_Temp does not exist here; map it to one that does, or add it on the Tags screen first"}],
 "warnings":[],"remapped":[],
 "requires":{"tags":[{"key":"press-01/Zone1_Temp","writable":false}],"entities":[],"scripts":[],"recipes":[],"devices":[],"equipment":[]}}
```

Mọi tham chiếu thiếu đều được liệt kê, không chỉ cái đầu tiên. Một `kind` là `file` (không phải tệp màn hình, sai định dạng, phiên bản định dạng mới hơn bản dựng này đọc được, hoặc một trường mà nó không biết), `screen` (các quy tắc riêng của bảng điều khiển: một thẻ sai, một vai trò không tồn tại, quá lớn), `tag`, `entity`, `script`, `recipe`, `device`, `equipment`, `writable` (một nút hoặc giá trị đặt trên tag không ghi được), `assignment` (tên màn hình hoặc trang chủ của một vai trò mà bảng khác đang giữ) hoặc `exists` (id đã có người dùng). Một lần nhập có bất kỳ vấn đề nào sẽ không lưu gì: `400`, hoặc `409` khi vấn đề duy nhất là `exists` hoặc `assignment`, với cùng báo cáo. Thành công là `201`, hoặc `200` khi nó đã thay thế một bảng, kèm báo cáo và `dashboard` đã lưu. Nó được ghi nhật ký là sự kiện `config` trên đối tượng `dashboard:<id>`.

## Webhook

### `POST /api/webhook/{path}`

Kích hoạt mọi tự động hóa có trình kích hoạt `webhook` trên đường dẫn đó. **Không có phiên và không có quyền**: đường dẫn là bí mật được trao cho bên thứ ba, cùng mô hình tin cậy mà endpoint này luôn có, và một hệ thống SCADA hay một callback của SaaS không có tài khoản để đăng nhập. Hãy chọn một đường dẫn mà không ai đoán được.

Nội dung gửi kèm, tối đa 1 MiB, được chuyển cho quy tắc. `202` `{"accepted":"fill-now"}`. `404` `"no automation is listening on this webhook path"` khi không có gì lắng nghe: một webhook gửi vào hư không trông y hệt một webhook hoạt động, nên nó nói ra điều đó.

## Đội thiết bị

Các relay biên đã đăng ký, trạng thái hiện diện trực tiếp của chúng qua Sparkplug, và các lệnh gửi tới chúng. Cần `HOTLOOP_FLEET_ENABLED`. Xem [Quản lý đội thiết bị](/vi/gateway/fleet/).

### `GET /api/fleet`

```json
{"configured":true,"members":[{"id":"press-relay-01","name":"Press line relay","group":"plant-a","nodeId":"press-relay-01","statusUrl":"http://press-relay-01:8081","enabled":true,"createdAt":"2026-09-27T20:28:49.448323Z","updatedAt":"2026-09-27T20:28:49.448323Z","online":false,"polled":true,"error":"Get \"http://press-relay-01:8081/status\": dial tcp: lookup press-relay-01 on 10.89.0.1:53: no such host"}]}
```

`online` đến từ NBIRTH và NDEATH. `release` là bản dựng mà relay đã nói là đang chạy trong birth gần nhất của nó: `version`, `imageDigest` (khi bộ giám sát của nó cho biết; Helm chart thì không) và `since`, thời điểm Gateway lần đầu nghe thấy bản dựng đó. Relay quá cũ để báo cáo thì không có. Với một thành viên có `statusUrl`, `polled` là true, còn `reachable`, `forwardQueueLen`, `devices`, `connected`, `config` và `updateMode` (`auto` hoặc `approve`) đến từ `/status` của nó; chúng không có nghĩa gì khi nó không liên lạc được. Khi tính năng tắt: `{"members":[],"configured":false}`.

### `POST /api/fleet`

Tạo hoặc thay một thành viên: `id`, `name`, `group` và `nodeId` (danh tính Sparkplug của nó) bắt buộc; `description`, `statusUrl` (`http://` hoặc `https://`) và `enabled` tùy chọn. Trả về thành viên. Lệnh này hoạt động cả khi tính năng tắt, để có thể khai báo đội thiết bị trước khi bật.

### `DELETE /api/fleet/{id}`

`{"deleted":"press-relay-01"}`, hoặc `404`.

### `POST /api/fleet/{id}/rebirth`

Phát hành `Node Control/Rebirth` tới relay. Không có nội dung gửi kèm. `{"status":"rebirth requested"}`. `404` cho thành viên không xác định.

### `POST /api/fleet/{id}/restart`

Phát hành `Node Control/Reboot`. `{"status":"restart requested"}`. Chỉ dành cho quản trị viên: khởi động lại một relay làm mất dữ liệu của nó cho đến khi nó trở lại.

### `POST /api/fleet/{id}/update`

Duyệt bản cập nhật image mà một relay đang giữ. Phát hành `Node Control/Update`. `{"status":"update approved"}`. Chỉ dành cho quản trị viên: relay thoát và bộ giám sát của nó khởi chạy image mà nó theo, nên nó mất dữ liệu trong khoảng thời gian đó. Nó chỉ có tác dụng với relay đặt ở `HOTLOOP_EDGE_RELAY_UPDATE_MODE=approve`; relay nào khác ghi nhật ký rằng đã bỏ qua. Yêu cầu không nêu image nào: không có chỗ để đặt một cái, và đó chính là mục đích. Xem [tài liệu tham chiếu Edge Relay](/vi/edge-relay/reference/#cập-nhật-một-relay).

### `POST /api/fleet/{id}/config`

Đẩy một tệp thiết bị mới tới relay, relay áp dụng trực tiếp: không khởi động lại, phiên broker và hàng đợi chuyển tiếp được giữ nguyên, và mọi thiết bị mà tệp không đổi vẫn giữ kết nối. Nội dung gửi kèm là **chính tệp thiết bị**, JSON thô, không bọc trong gì. Nó được xác thực trước khi phát hành bất cứ thứ gì (`400` `"invalid device file: ..."` nếu không). `{"status":"config pushed"}` nghĩa là broker đã nhận; relay có đang chạy nó hay không thì `config.digest` của thành viên đó trong `GET /api/fleet` cho biết, và một tệp mà relay từ chối hiện ở đó là `config.rejected`. Chỉ dành cho quản trị viên: nó đổi những gì relay thăm dò. Xem [Quản lý đội thiết bị](/vi/gateway/fleet/#đẩy-cấu-hình).

### `DELETE /api/fleet/{id}/config`

Rút lại lần đẩy. Xóa cấu hình được giữ trên broker để không lần khởi động nào sau đó áp dụng nó, và một relay đang kết nối ngay lúc này bỏ tệp đã đẩy và quay lại trực tiếp với tệp thiết bị cục bộ của nó. Không có nội dung gửi kèm. `{"status":"config push cleared"}`, `404` cho thành viên không xác định, `503` khi Gateway không kết nối với broker. Chỉ dành cho quản trị viên, như việc đẩy. Nó không khởi động lại gì. Hãy gửi nó khi relay đang trực tuyến: relay ngoại tuyến không bao giờ nghe thấy. Xem [tài liệu tham chiếu Edge Relay](/vi/edge-relay/reference/#tệp-được-đẩy-nằm-ở-đâu-và-tệp-nào-thắng).

## Thông báo

Báo tới điện thoại khi một báo động được kích hoạt, qua webhook, SMTP, ntfy hoặc Gotify, và báo cho người kế tiếp khi không ai xác nhận. Cần `HOTLOOP_NOTIFY_ENABLED`.

### `POST /api/notify/test`

Gửi ngay một thông báo báo động tổng hợp qua mọi kênh đã cấu hình, để bạn biết relay SMTP từ chối bạn trước khi một báo động thật làm điều đó. Không có nội dung gửi kèm. Cần `HOTLOOP_NOTIFY_ENABLED`. Chỉ dành cho quản trị viên: nó gửi một thư thật và tiêu hao hạn mức mà nhà cung cấp cho phép.

```json
{"results":[{"channel":"smtp","success":true}]}
```

`200` dù mỗi kênh có hoạt động hay không; mỗi kết quả tự cho biết. Kênh thất bại mang `error`. Webhook thất bại chỉ nêu lược đồ và máy chủ của nó và không gì khác, vì với phần lớn các dịch vụ gọi báo, URL chính là thông tin xác thực. Xem [Thông báo báo động](/vi/iot/notifications/).

### `GET /api/notify/escalation`

Chính sách leo thang báo động, các kênh mà một bước có thể nêu, và các chuỗi đang mở ngay lúc này. `available` là `false`, với chính sách tắt và không có kênh, khi `HOTLOOP_NOTIFY_ENABLED` chưa được đặt; phản hồi vẫn là `200`. Chỉ dành cho quản trị viên cả khi đọc lẫn ghi: chính sách chứa các topic ntfy của mọi người, mà trên một máy chủ ai cũng truy cập được thì đó là mật khẩu.

```json
{"available":true,"policy":{"enabled":true,"minPriority":"high","contacts":[{"name":"Ana","ntfyTopic":"ana-phone-3f9c","emails":["ana@plant.test"]}],"steps":[{"afterMinutes":5,"contacts":["Ana"]},{"afterMinutes":10,"channels":["gotify"]}],"repeatEveryMinutes":15,"repeatTimes":2},"channels":["smtp","ntfy","gotify"],"active":[{"alarmId":"boiler-hi","name":"Boiler Trip","raisedAt":"2026-10-21T03:00:00Z","sent":1,"total":4,"nextAt":"2026-10-21T03:15:00Z"}],"limits":{"steps":10,"contacts":50,"repeats":20,"minutes":1440}}
```

`channels` là những kênh HotLoop này đã cấu hình, đó là tất cả những gì một bước có thể nêu. `active` là mọi báo động đang được đi qua chuỗi: đã gửi bao nhiêu lần trong tổng số mà chính sách có (các bước, rồi các lần lặp), và khi nào đến lần kế tiếp. Chưa lưu gì thì là `{"policy":{"enabled":false},...}`: tắt, không có gì trong đó.

### `PUT /api/notify/escalation`

Thay toàn bộ chính sách, không phải một bản vá, và trả lời như `GET` sẽ trả lời. Nó áp dụng cho các báo động được kích hoạt từ bây giờ. `400` khi thông báo chưa được bật.

```json
{"enabled":true,"minPriority":"high",
 "contacts":[{"name":"Ana","ntfyTopic":"ana-phone-3f9c","emails":["ana@plant.test"]}],
 "steps":[{"afterMinutes":5,"contacts":["Ana"]},{"afterMinutes":10,"channels":["gotify"]}],
 "repeatEveryMinutes":15,"repeatTimes":2}
```

`minPriority` là `critical`, `high` (mặc định), `medium` hoặc `low`. Một bước đến hạn sau bước trước `afterMinutes` (1 đến 1440), bước đầu sau lúc kích hoạt, và nêu `contacts` từ danh sách, `channels` mà bản triển khai có, hoặc cả hai. Tối đa 10 bước, 50 liên hệ và 20 lần lặp. Các trường không xác định bị từ chối.

`400` kèm lý do khi chính sách không thể hoạt động, bằng lời bạn có thể làm theo: một bước không nêu ai, một liên hệ không có trong danh sách, một kênh mà HotLoop này chưa cấu hình (phản hồi liệt kê những kênh nó có), một topic ntfy khi ntfy chưa được cấu hình hoặc một địa chỉ khi email chưa được cấu hình, một địa chỉ không phải loại đơn giản, một lần lặp không có khoảng cách. Không lưu gì khi bị từ chối. Việc lưu nằm trong nhật ký hệ thống, không có các topic. Xem [Thông báo báo động](/vi/iot/notifications/#leo-thang).

### `POST /api/notify/ack/{token}`

Nút **Xác nhận** trên một thông báo ntfy. Điện thoại nhấn nó không có phiên để gửi, nên **không có phiên và không có quyền**: token đã ký trong đường dẫn là sự ủy quyền, và tất cả những gì nó ủy quyền là xác nhận một lần xảy ra của một báo động, một lần, trước khi hết hạn (`HOTLOOP_NOTIFY_ACK_TTL`, mặc định 12 giờ). Nút từ chuyến đi hôm qua không thể xác nhận báo động hôm nay. Nó là `POST` có chủ ý: trình xem trước liên kết và trình quét bảo mật tự mở liên kết, và một báo động không bao giờ được để robot xác nhận. Không có nội dung gửi kèm. Nó phản hồi với báo động đã xác nhận (dạng, lấy từ trình xử lý; các ví dụ khác trong tài liệu này được chụp từ một Gateway đang chạy, ví dụ này thì không, vì Gateway đó không có ntfy):

```json
{"acknowledged":true,"alarmId":"extruder-temp-hi","name":"Extruder temperature high","state":"ack-active","ackedBy":"notify:ntfy"}
```

Khi các liên kết xác nhận bị tắt:

```json
{"error":"acknowledge links are not enabled on this HotLoop (they need HOTLOOP_PUBLIC_URL and a channel that carries a button)"}
```

Đó là một lần xác nhận thông thường qua bộ máy báo động, được kiểm toán dưới `notify:<channel>`. Mọi lần từ chối đều được trả lời và ghi nhật ký, vì một nút lặng lẽ không làm gì trông y hệt nút chưa ai nhấn:

| Trạng thái | Khi nào |
|---|---|
| 403 | Bị giả mạo, bị sửa đổi, hoặc ký bằng bí mật khác |
| 404 | Báo động không còn tồn tại, hoặc các liên kết xác nhận đang tắt (chúng cần `HOTLOOP_PUBLIC_URL` và một kênh có nút) |
| 409 | Đã được dùng, báo động đã được kích hoạt lại từ đó, hoặc không còn gì để xác nhận |
| 410 | Thật, nhưng đã hết hạn |
| 503 | Không thể lưu lần xác nhận; liên kết được trả lại để lần nhấn thứ hai vẫn có thể hoạt động |

Phản hồi mang `Access-Control-Allow-Origin: *` để ứng dụng web ntfy có thể nhấn nó từ origin của chính nó; không có gì trên route này đọc cookie. Token không bao giờ được ghi nhật ký hay trả về ở đâu cả. Xem [Thông báo báo động](/vi/iot/notifications/#liên-kết-xác-nhận).

## Sao lưu

Các ảnh chụp logic của cơ sở dữ liệu, chỉ gồm dữ liệu bảng. Cần `HOTLOOP_BACKUP_ENABLED`. Cả hai chỉ dành cho quản trị viên: danh sách cho thấy số hàng của mọi bảng, kể cả người dùng và phiên. **Không có endpoint khôi phục**, có chủ ý: khôi phục là một cờ của tệp nhị phân, được chạy một lần bởi người biết rằng cơ sở dữ liệu sẵn sàng nhận nó, không bao giờ là một lệnh gọi mạng vào cơ sở đang chạy. Xem [Sao lưu và khôi phục](/vi/iot/backup/#khôi-phục-một-bản-sao-lưu).

### `GET /api/backup`

Các bản sao lưu trên ổ, mỗi bản kèm manifest của nó.

```json
{"backups":[{"name":"20260927T202912Z","bytes":98567,"manifest":{"hotloopVersion":"4.16.0","schemaMigrations":["0001_core.sql","...","0007_service_audit.sql"],"createdAt":"2026-09-27T20:29:12.970721945Z","tables":[{"name":"devices","rows":2,"columns":[{"name":"id","type":"text"},{"name":"...","type":"..."}]}]}}],"configured":true}
```

### `POST /api/backup`

Tạo một bản ngay bây giờ và chờ nó (tối đa 30 phút: một `tag_history` lớn mất một lúc). Không có nội dung gửi kèm. Trả về manifest: phiên bản, các lần di trú, và số hàng và cột của mọi bảng.

## Báo cáo theo lịch

Tóm tắt từ historian dạng CSV và HTML, theo lịch, qua email hoặc tải về. Cần `HOTLOOP_REPORTS_ENABLED`. Người xem đọc, người vận hành chạy, quản trị viên định nghĩa: một định nghĩa nêu nơi dữ liệu nhà máy được gửi email tới. Xem [Báo cáo theo lịch](/vi/gateway/reports/) để biết các trường của định nghĩa.

### `GET /api/reports`

```json
{"configured":true,"reports":[{"id":"line1-hourly","name":"Line 1 hourly","enabled":true,"tags":[{"deviceId":"extruder-1","tagName":"Temperature"},{"deviceId":"extruder-1","tagName":"Pressure"}],"window":{"count":1,"unit":"hours","end":"run_time"},"bucket":"window","aggregations":["min","max","avg"],"schedule":{"kind":"daily","at":"06:00"},"format":"both","recipients":["shift-lead@example.com"],"retain":10,"createdAt":"2026-09-27T20:29:23.300978Z","updatedAt":"2026-09-27T20:29:23.300978Z","nextRunAt":"2026-09-28T06:00:00Z"}],"smtpConfigured":true,"timezone":"UTC"}
```

Mỗi định nghĩa mang `nextRunAt` và lần chạy gần nhất của nó là `lastRun`.

### `POST /api/reports`

Tạo một định nghĩa; nội dung gửi kèm là định nghĩa như trên. `201`. `400` khi xác thực thất bại (`"report line1-hourly: window end \"now\" must be run_time or local_midnight"`), `409` nếu id đã tồn tại.

### `GET /api/reports/{id}`

Một định nghĩa, như trong danh sách. `404` cho định nghĩa không xác định.

### `PUT /api/reports/{id}`

Thay toàn bộ định nghĩa. Id không thể đổi (`400` nếu id trong nội dung khác). `nextRunAt` và `lastRun` được chấp nhận và bỏ qua, nên bạn có thể gửi lại những gì đã đọc.

### `DELETE /api/reports/{id}`

Xóa nó cùng các lần chạy và tệp của nó, hủy lần chạy đang diễn ra. `{"deleted":"line1-hourly"}`, hoặc `404`.

### `POST /api/reports/{id}/run`

Chạy nó ngay và chờ. `?deliver=false` tạo và lưu nó mà không gửi email cho ai, để thử một định nghĩa. `200` nghĩa là lần chạy đã xảy ra; `status` của chính nó cho biết báo cáo có hoạt động hay không. Một lần chạy thất bại là một kết quả, không phải yêu cầu sai, và nó được ghi lại trong cả hai trường hợp.

```json
{"id":1,"reportId":"line1-hourly","trigger":"manual","actor":"admin","status":"succeeded","startedAt":"2026-09-27T20:29:54.06926Z","finishedAt":"2026-09-27T20:29:54.092456655Z","windowStart":"2026-09-27T19:29:54.06926Z","windowEnd":"2026-09-27T20:29:54.06926Z","tags":2,"rows":2,"readings":984,"excluded":2,"files":[{"format":"csv","name":"20260927T202954Z-1.csv","bytes":338},{"format":"html","name":"20260927T202954Z-1.html","bytes":2430}],"emailStatus":"skipped","emailTo":["shift-lead@example.com"]}
```

`400` cho `deliver` không phải true hoặc false, `404` cho báo cáo không xác định.

### `GET /api/reports/{id}/runs`

`{"runs": [...]}`, mới nhất trước, `?limit=` mặc định 50, tối đa 500. `404` cho báo cáo không xác định, không phải danh sách rỗng.

### `GET /api/reports/{id}/runs/{run}/download`

Truyền một tệp đã lưu dưới dạng tệp đính kèm. `?format=csv` hoặc `html`.

```
HTTP/1.1 200 OK
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="20260927T202954Z-1.csv"
Cache-Control: private, no-store

device_id,tag_name,unit,period_start,period_end,min,max,avg,excluded
extruder-1,Temperature,C,2026-09-27T19:29:54+00:00,2026-09-27T20:29:54+00:00,19.50001230192043,23.499980145373126,21.508905654397623,1
```

HTML được phục vụ với Content-Security-Policy `sandbox`: báo cáo là tài liệu để đọc, không phải trang được phép chạy bất cứ thứ gì. Tệp được mở là tệp mà bản ghi lần chạy nêu; không phần nào của URL trở thành một phần của đường dẫn. `400` cho số lần chạy không phải là số hoặc định dạng không phải cái nào trong hai, `404` cho lần chạy hoặc tệp không tồn tại.

## Địa điểm

### `GET /api/sites`

Mọi địa điểm mà Gateway liên kết, được hỏi trạng thái nhà máy qua MCP song song, mỗi địa điểm 6 giây, để một địa điểm chết không thể giữ chân các địa điểm còn lại. Các địa điểm là các máy chủ MCP đi ra trong cấu hình. Xem [MCP](/vi/iot/mcp/#liên-hợp-các-địa-điểm).

```json
{"configured":true,
 "rollup":{"sites":2,"reachable":1,"devices":2,"connected":2,"tags":5,"outstandingAlarms":1,"unacknowledgedAlarms":1,"criticalAlarms":0},
 "sites":[{"name":"plant-a","reachable":true,"latencyMs":14,"plant":"Demo Plant","uptime":"1m25s","devices":2,"connected":2,"degraded":0,"disconnected":0,"tags":5,"outstandingAlarms":1,"unacknowledgedAlarms":1,"criticalAlarms":0,"writesEnabled":true},
          {"name":"plant-c","reachable":false,"error":"connect to MCP server \"plant-c\": calling \"initialize\": ... no such host","latencyMs":49,"devices":0,"connected":0,"degraded":0,"disconnected":0,"tags":0,"outstandingAlarms":0,"unacknowledgedAlarms":0,"criticalAlarms":0,"writesEnabled":false}]}
```

Số đếm của một địa điểm không liên lạc được không có nghĩa gì và được để ngoài tổng: đếm một địa điểm không liên lạc được là không có báo động sẽ là điều nguy hiểm nhất mà màn hình này có thể làm. Khi chưa cấu hình địa điểm nào: `{"configured":false,"sites":[]}`.

## Cài đặt

### `GET /api/destinations`

Nơi báo động và số đọc edge được gửi tới, mỗi loại một mục: `webhook`, `smtp`, `ntfy`, `gotify`, `discord_webhook`, `discord_bot` và `edge_publish`. Mỗi mục có `fields` của nó (khóa, nhãn, kiểu, có phải bí mật hay bắt buộc không), `enabled`, một `state` (`active`: đang gửi; `needs`: đã bật và chờ đích của nó, với `missing` nêu tên thứ nó chờ; `off`; `needs-restart`: đã lưu, và edge publisher áp dụng khi HotLoop khởi động lại), các `values` thông thường, và `set`, cho biết trường bí mật nào có giá trị. Giá trị của một bí mật không bao giờ được trả về. `source` là `saved` khi quản trị viên đã lưu nó trong Cài đặt và `environment` khi chart hoặc biến môi trường cung cấp. Mọi loại đều mặc định bật và nghỉ cho đến khi có nơi để gửi; không loại nào từ chối khởi động.

```json
{"destinations":[{"id":"webhook","name":"Webhook","enabled":true,"state":"needs",
  "missing":["url"],"values":{"min_priority":"high"},"set":{"url":false},
  "fields":[{"key":"url","label":"URL","type":"password","secret":true,"required":true}]}]}
```

### `GET /api/opcua/server`

Máy chủ OPC UA đang làm gì và một client đăng nhập thế nào. `state` là `active`, `idle` (xác thực của HotLoop đang tắt nên không có người dùng để đăng nhập; `reason` nói như vậy), `off` hoặc `unavailable` (sản phẩm này không có máy chủ). Khi nó bật, `endpoint` là URL mà client kết nối tới, và khi bật xác thực, `username` và `password` là tài khoản mà HotLoop đã tạo cho các client OPC UA (`opcua-reader`, chỉ đọc được tag và giá trị, với mật khẩu sinh tự động). Cần `users.manage`, vì mật khẩu nằm trong đó. Máy chủ mặc định bật; mật khẩu của nó có thể đổi như của bất kỳ người dùng nào, và lần khởi động tiếp theo làm cho mật khẩu hiển thị ở đây hoạt động lại.

### `PUT /api/destinations/{kind}`

Lưu một đích và trả lời bằng danh sách như `GET` đưa ra. Phần thân là `{"enabled": true, "values": {"url": "https://..."}, "clear": ["token"]}`, mỗi phần đều tùy chọn. Một bí mật để trống giữ nguyên giá trị đã lưu, và `clear` xóa một cái. Kết quả được kiểm tra giống như cách môi trường được kiểm tra khi khởi động, trước khi lưu bất cứ thứ gì, nên một đích sai là một `400` nói rõ điều gì sai (không bao giờ nêu giá trị) và không thay đổi gì. Các kênh báo động áp dụng ngay; đích của edge publisher áp dụng khi HotLoop khởi động lại. Các bí mật được niêm phong trong cơ sở dữ liệu khi HotLoop có khóa bí mật. Cần `settings.write`.

### `GET /api/settings`

Mọi cài đặt, giá trị đang có hiệu lực, giá trị đó đến từ đâu và biến đặt nó:

```json
{"groups":["Plant","Safety","Polling","Historian","Database","MCP","Server"],
 "settings":[{"key":"ui.plantName","group":"Plant","label":"Plant name","help":"...","value":"Demo Plant East","kind":"string","source":"stored","envVar":"HOTLOOP_PLANT_NAME","editable":true},
             {"key":"safety.allowWrites","group":"Safety","label":"Writes allowed","help":"...","value":true,"kind":"bool","source":"environment","envVar":"HOTLOOP_ALLOW_WRITES","editable":false},
             {"key":"database.password","group":"Database","label":"Password","help":"Never shown. It comes from the release Secret.","value":"set","kind":"secret","source":"environment","envVar":"HOTLOOP_DB_PASSWORD","editable":false}]}
```

`source` là `stored`, `environment` hoặc `default`. Một `secret` chỉ là `set` hoặc `not set`. `envVar` là biến mà giá trị đến từ đó. Một vài cài đặt quay về một biến thứ hai khi biến `HOTLOOP_` để trống (`TZ` cho múi giờ, `POSTGRES_HOST`, `POSTGRES_DB`, `POSTGRES_USER` và `POSTGRES_PASSWORD` cho cơ sở dữ liệu), và khi biến dự phòng là cái đang có hiệu lực, `envVar` nêu tên nó. Một biến được đặt thành chuỗi rỗng được coi là chưa đặt, giống như cấu hình xử lý. Các cài đặt thăm dò được hiển thị bằng mili giây, nhưng biến của chúng nhận một khoảng thời gian (`5s`, `500ms`) hoặc một số giây trần.

`product` trong nhóm `Server` cho biết đây là HotLoop nào. Một tính năng mà sản phẩm này không có nhưng bản triển khai vẫn bật (chẳng hạn `HOTLOOP_REPORTS_ENABLED=true` trên IoT) không ngăn nó khởi động. Nó được ghi nhật ký là cảnh báo lúc khởi động và được liệt kê ở đây trong một nhóm phụ, `Not in this product`, kèm biến của nó và một dòng nói nó nằm ở đâu. Cài đặt được giữ nguyên như vậy, nên cùng cấu hình đó trên sản phẩm có tính năng sẽ bật nó. Khi không có gì như thế được đặt, nhóm này không xuất hiện.

### `PUT /api/settings`

Đổi các cài đặt nhận dạng nhà máy, và chỉ những cài đặt đó:

| Khóa | Kiểu |
|---|---|
| `ui.plantName` | chuỗi, tối đa 200 ký tự |
| `ui.siteId` | chuỗi, tối đa 200 ký tự |
| `ui.timezone` | một tên IANA mà máy này biết (`America/Chicago`) |
| `ui.confirmWrites` | bool |
| `ui.kioskIdleSeconds` | một số nguyên giây, 10 đến 43200: đăng nhập kiosk tồn tại bao lâu khi không ai chạm vào bảng. Mặc định 900 |
| `ui.lockoutAttempts` | một số nguyên, 0 đến 100: số lần sai mật khẩu hoặc PIN liên tiếp làm khóa một tài khoản. Mặc định 10, và 0 là không khóa |
| `ui.panelDelaySeconds` | một số nguyên giây, 0 đến 30: thời gian tối đa một bảng kiosk chờ trước khi kiểm tra PIN kế tiếp nhập không có tên người dùng, sau các lần sai. Mặc định 3, và 0 là không chờ |
| `ui.lockoutSeconds` | một số nguyên giây, 10 đến 86400: một tài khoản bị khóa vẫn bị khóa bao lâu. Mặc định 300 |

```json
{"ui.plantName":"Demo Plant East","ui.timezone":"America/Chicago"}
```

Trả về đầy đủ các cài đặt, như `GET`. Mọi khóa khác trả về 400 nêu tên nó:

```json
{"error":"safety.allowWrites is set by the deployment and cannot be changed here"}
```

Điều đó là có chủ ý. Các công tắc ghi quyết định liệu tiến trình này có thể điều khiển máy móc hay không, và một điều khiển có thể bật từ chính trình duyệt đang phát ra các lệnh ghi thì không phải là điều khiển. Đổi chúng là một lần triển khai.

## Đích historian

Các cơ sở dữ liệu riêng của nhà máy, nơi HotLoop ghi lịch sử của mình vào bên cạnh cơ sở của chính nó. Xem [Đích historian](/vi/iot/historian-targets/). Mọi vai trò đọc cài đặt đều thấy chúng và tình trạng của từng đích. Thay đổi một đích chỉ dành cho quản trị viên, vì một đích là nơi dữ liệu nhà máy đi tới. Mật khẩu được niêm phong bằng khóa thông tin xác thực thiết bị (`HOTLOOP_SECRET_KEY_FILE`) và không bao giờ được trả về; `passwordSet` cho biết có mật khẩu đã lưu hay không, và `passwordProblem` cho biết vì sao không mở được mật khẩu đã lưu. Mọi thay đổi đi vào nhật ký và có hiệu lực ngay.

### `GET /api/historian/targets`

```json
{"secretKey":true,
 "kinds":[{"id":"postgres","title":"PostgreSQL or TimescaleDB","defaultPort":5432,"defaultTable":"hotloop_history",
    "databaseLabel":"Database","tableLabel":"Table","passwordLabel":"Password","usesUsername":true,"usesOrg":false},
   {"id":"sqlserver","title":"Microsoft SQL Server","defaultPort":1433,"defaultTable":"hotloop_history",
    "databaseLabel":"Database","tableLabel":"Table","passwordLabel":"Password","usesUsername":true,"usesOrg":false},
   {"id":"mysql","title":"MySQL or MariaDB","defaultPort":3306,"defaultTable":"hotloop_history",
    "databaseLabel":"Database","tableLabel":"Table","passwordLabel":"Password","usesUsername":true,"usesOrg":false},
   {"id":"influxdb","title":"InfluxDB 2 or 3","defaultPort":8086,"defaultTable":"hotloop_history",
    "databaseLabel":"Bucket (InfluxDB 3: database)","tableLabel":"Measurement","passwordLabel":"API token",
    "usesUsername":false,"usesOrg":true}],
 "targets":[{"id":"plant-pg","name":"Plant historian","kind":"postgres","address":"db.plant.local:5432",
   "database":"plant","username":"hotloop","table":"hotloop_history","useTls":true,"insecureSkipVerify":false,
   "enabled":true,"createdBy":"admin","passwordSet":true,"createdAt":"2026-10-03T09:12:04Z","updatedAt":"2026-10-03T09:12:04Z",
   "status":{"state":"down","since":"2026-10-03T10:02:11Z","queued":50000,"queueCap":50000,"written":182340,
     "backfilled":0,"dropped":1210,"refused":0,"lastWrite":"2026-10-03T10:02:10Z",
     "lastError":"failed to connect to `user=hotloop database=plant`: dial tcp 10.20.0.9:5432: connect: connection refused",
     "owedFrom":"2026-10-03T10:02:09Z"}}]}
```

`kinds` là các cơ sở dữ liệu mà HotLoop này ghi vào, và cách mỗi loại gọi các trường của nó: InfluxDB có token ở chỗ các loại khác có mật khẩu (`password` mang nó), có bucket ở chỗ chúng có cơ sở dữ liệu (`database`), có measurement ở chỗ chúng có bảng (`table`), và có một tổ chức (`org`) mà không loại nào khác có. `status.state` là `up`, `catching-up` (đang chạy, và vẫn đang gửi những gì nó còn nợ từ lịch sử riêng của HotLoop), `down`, `starting` hoặc `off` (đã tắt). `queued` là những gì đang chờ trong bộ nhớ, trên `queueCap`. `written` đếm các số đọc gửi trực tiếp và `backfilled` đếm những số đọc gửi từ lịch sử riêng của HotLoop. `dropped` đếm các số đọc mà hàng đợi bỏ khi đích không theo kịp: chúng là khoản nợ, không phải đã mất. `refused` đếm các số đọc mà chính cơ sở dữ liệu không chịu nhận, kèm lý do trong `lastRefusal`. `owedFrom` và `owedTo` là những gì còn nợ; `owedTo` vắng mặt khi phần cuối còn mở, tức là suốt thời gian đích đang ngừng.

### `POST /api/historian/targets`

```json
{"id":"plant-pg","name":"Plant historian","kind":"postgres","address":"db.plant.local","database":"plant",
 "username":"hotloop","password":"...","useTls":true}
```

`id` gồm 1 đến 63 chữ thường, chữ số và `-`, và nêu tên đích trong nhật ký hệ thống. `address` là `host` hoặc `host:port`, không có thông tin đăng nhập; cổng mặc định của loại sẽ điền cổng còn thiếu. `table` mặc định là `defaultTable` của loại và có thể mang một lược đồ (`history.hotloop`). `org` là tổ chức của InfluxDB 2. `enabled` mặc định là true. Mật khẩu cần một khóa: không có `HOTLOOP_SECRET_KEY_FILE` thì là `400`, không bao giờ lưu ở dạng rõ. `201` cùng đích và trạng thái của nó; `409` cho id đã có người dùng.

### `PUT /api/historian/targets/{id}`

Bất kỳ trường nào ở trên trừ `id`; những gì không gửi thì giữ nguyên. `"password":""` xóa mật khẩu. Một thay đổi khởi động lại đích với cài đặt mới, và những gì nó còn nợ vẫn còn nợ. `200` cùng đích.

### `DELETE /api/historian/targets/{id}`

Ngừng ghi vào nó và quên những gì nó còn nợ. Những gì nó đã giữ vẫn ở trong cơ sở dữ liệu của nó. Hãy tắt nó bằng `"enabled":false` để giữ các cài đặt. `200` `{"deleted":"plant-pg"}`.

## Nhật ký hệ thống

### `GET /api/events`

Mọi thay đổi, lần ghi, lần đăng nhập và chuyển đổi kết nối, mới nhất trước.

| Truy vấn | <span class="sr-only">Chi tiết</span> |
|---|---|
| `category` | Lặp lại được: `system`, `device`, `tag`, `write`, `alarm`, `automation`, `mcp`, `config`, `auth` |
| `severity` | Lặp lại được: `debug`, `info`, `warning`, `error` |
| `subject` | Chính xác: id thiết bị, khóa tag, entity_id, `equipment:4`, `label:critical` |
| `q` | Tìm kiếm không phân biệt hoa thường |
| `minutes` | Chỉ N phút gần nhất |
| `limit` | Mặc định 200, tối đa 5000 |

```json
[{"id":61,"at":"2026-09-27T20:29:23.303795Z","severity":"info","category":"config","subject":"line1-hourly","actor":"admin","message":"report created"}]
```

`actor` là một người dùng, `system`, `automation:<id>` hoặc `mcp:<client>`. `detail`, khi có, là JSON bổ sung dạng chuỗi.

## Nhật ký sự kiện

### `GET /api/logbook`

Một dòng thời gian duy nhất về những gì đã xảy ra, mới nhất trước: thay đổi trạng thái thực thể, các lần ghi, chuyển đổi báo động, các lần chạy tự động hóa và script, cùng thay đổi cấu hình và lệnh gọi dịch vụ từ nhật ký hệ thống. Các dấu vết được đọc tại nơi chúng nằm và hợp nhất, nên mỗi cái giữ thời hạn lưu trữ riêng. Các số đọc dạng số không có trong đó: đó là việc của `GET /api/history`. Xem [nhật ký sự kiện](/vi/iot/logbook/).

| Truy vấn | <span class="sr-only">Chi tiết</span> |
|---|---|
| `entity` | Chỉ những gì liên quan đến thực thể này: thay đổi trạng thái của nó, các lần ghi vào nó và các tag của nó, các báo động của nó, các lần chạy tự động hóa mà nó kích hoạt hoặc đã ghi vào nó, các thay đổi cấu hình của nó |
| `equipment_id` | Chỉ những gì đã xảy ra tại nút này của cây thiết bị hoặc bên dưới nó, theo cùng quy tắc. Không dùng cùng `entity` |
| `actor` | Một phần, không phân biệt hoa thường, của người đã làm: một người dùng, `automation:<id>`, `mcp:<client>` |
| `kinds` | Phân cách bằng dấu phẩy hoặc lặp lại: `state`, `write`, `alarm`, `automation`, `event`, `script`, `recipe` |
| `from`, `to` | Thời gian RFC 3339; `from` bao gồm, `to` không bao gồm |
| `limit` | Mặc định 100, tối đa 1000 |
| `before` | `next` của trang trước |

```json
{"entries":[
  {"at":"2026-09-28T09:14:02.51Z","kind":"state","id":41,"severity":"info","message":"changed to on (was off)","entity_id":"switch.tank_farm_pump","old_state":"off","state":"on","quality":"good"},
  {"at":"2026-09-28T09:14:02.18Z","kind":"write","id":88,"severity":"info","message":"wrote true to tank-farm/pump (switch.turn_on on switch.tank_farm_pump) (was 0)","actor":"admin","source":"ui","entity_id":"switch.tank_farm_pump","device_id":"tank-farm","tag":"tank-farm/pump","call_id":"5c9f8545a93b5443"},
  {"at":"2026-09-28T09:13:40.02Z","kind":"state","id":37,"severity":"info","message":"changed to closed (was open); 14 changes before this not logged, it was changing faster than the logbook records","entity_id":"valve.infeed","old_state":"open","state":"closed","quality":"good","suppressed":14}
 ],
 "next":"MjAyNi0wOS0yOFQwOToxMzo0MC4wMlp8c3RhdGV8Mzc"}
```

`id` là id của hàng trong dấu vết riêng của nó (với thay đổi trạng thái, là id bất biến của thực thể), và cùng với `at` và `kind` là thứ mà `next` mã hóa: trang sau trang này là mọi thứ cũ hơn hẳn theo thứ tự đó, bất kể điều gì được thêm vào trong lúc đó. `next` được bỏ ở trang cuối. `suppressed` là số thay đổi của thực thể đó trước thay đổi này đã không được ghi nhật ký, vì nó thay đổi nhanh hơn mười lần cùng lúc rồi một lần mỗi hai giây.

`400` cho loại không xác định, thời gian sai định dạng, `from` không trước `to`, giới hạn trên 1000, con trỏ bịa ra, hoặc `entity` và `equipment_id` cùng nhau; `404` cho nút không tồn tại. `503` khi nhật ký sự kiện không chạy trong tiến trình đang trả lời.

## Luồng trực tiếp

### `GET /api/stream`

Server-sent events, một chiều, chừng nào bạn còn giữ nó mở. Dùng SSE thay vì WebSocket vì lưu lượng chỉ đi một chiều, và một luồng sự kiện tự kết nối lại khi pod khởi động lại bên dưới một bảng điều khiển đang mở. `EventSource` gửi cookie phiên; một script gửi bearer token.

Khi kết nối bạn nhận `retry: 3000` rồi bức tranh hiện tại, để màn hình được điền đầy trước khi có gì thay đổi:

```
retry: 3000

event: snapshot
data: [{"deviceId":"extruder-1","protocol":"opcua","tagName":"Temperature","tagValue":19.553128777917983,"unit":"C","quality":"good","timestamp":"2026-09-27T20:34:23.619589Z"}]

event: alarms
data: {"alarms":[...outstanding alarms...],"summary":{"critical":0,"high":1,"medium":0,"low":0,"unacked":0,"total":1}}

event: entities
data: {"changed":[...every entity state...],"removed":[]}
```

Sau đó, khi mọi việc xảy ra:

| Sự kiện | Dữ liệu | Khi nào |
|---|---|---|
| `values` | Một mảng các số đọc, dạng của `GET /api/values`, mới nhất theo từng tag, **chỉ các tag có số đọc thay đổi** | Mỗi 250 ms, nếu có tag nào thay đổi. Một tag có giá trị, văn bản, đơn vị, chất lượng và lý do giống lần gửi trước sẽ bị bỏ ra, và gửi lại sau khi đã 30 giây không gửi, nên `timestamp` của một giá trị ổn định không bao giờ cũ hơn mức đó. Một driver đọc mọi tag ở mỗi lần thăm dò; 4.19.5 gửi tất cả mỗi lần (khoảng 150 KB bốn lần mỗi giây cho 2232 tag của một tester) và một trang trên đường truyền chậm bị trễ hàng phút |
| `entities` | `{"changed": [states], "removed": [entity_ids]}` | Mỗi 250 ms, nếu trạng thái thực thể nào thay đổi. `removed` là thực thể bị tắt, xóa hoặc đổi tên đi |
| `alarm` | `{"alarm": {...}, "event": "shelved"}`, báo động và điều đã xảy ra với nó (`raised`, `acked`, `cleared`, `shelved`, `unshelved`, `suppressed`, `unsuppressed`) | Ngay lập tức: các chuyển đổi báo động hiếm và mỗi cái đều quan trọng |
| `device` | `{"deviceId":"tank-farm","state":"connected"}` | Ngay lập tức: màn hình phải chuyển đỏ khi thiết bị rớt, không phải ở lần xả kế tiếp |
| `logbook` | `{"kinds":["state","write"]}`, các loại mục nhật ký sự kiện có điều gì mới | Tối đa mỗi giây một lần. Không có mục nào trong đó, vì điều một màn hình nên hiển thị phụ thuộc vào bộ lọc của nó: nó hỏi `GET /api/logbook` trang riêng của mình |

```
event: alarm
data: {"alarm":{"definitionId":"extruder-temp-hi","state":"shelved","shelvedUntil":"2026-09-27T20:39:45.839983854Z","shelvedBy":"admin","...":"..."},"event":"shelved"}

event: device
data: {"deviceId":"tank-farm","state":"connected"}
```

Một dòng chú thích (`: heartbeat 2026-09-27T20:35:00Z`) mỗi 20 giây giữ cho các proxy không đóng một kết nối nhàn rỗi. Mỗi trang đang mở được điều tiết riêng: bộ ghi của nó nghỉ bằng thời gian lần gửi cuối của nó, tối đa năm giây, và những gì đến trong lúc đó được giữ theo từng tag và từng thực thể, chỉ giữ cái mới nhất, nên một trang trên đường truyền chậm chỉ chậm hơn nhà máy một hay hai lần gửi, không bao giờ hàng phút, không mất gì và không lấy gì của các trang khác. Luồng được nén gzip khi yêu cầu có `Accept-Encoding: gzip` (trình duyệt có), việc này đưa bức tranh đầu tiên của một tester từ khoảng 326 KB xuống khoảng 11 KB trên đường truyền. Phản hồi đặt `X-Accel-Buffering: no`, vì proxy có đệm biến một luồng trực tiếp thành một lần tải xuống rất chậm.

Luồng xem lại phiên của nó mỗi năm giây và đóng khi phiên không còn: đã đăng xuất, hết hạn, bị thu hồi, hoặc tài khoản bị tắt hay không còn được phép `status.read`. Nó không gửi sự kiện nào trước. `EventSource` của trình duyệt kết nối lại, nhận `401` ở trên, rồi dừng. Với `HOTLOOP_AUTH_INSECURE=true` không có phiên và không có gì để kiểm tra. Việc kiểm tra không tính là phiên được dùng, nên một màn hình để mở không giữ phiên luôn mới.

## MCP

### `/mcp` và `/mcp/`

Model Context Protocol, truyền tải HTTP dạng streaming, dành cho agent. Bất kỳ phương thức nào: phần truyền tải dùng `POST` cho các lệnh gọi, `GET` cho luồng riêng của máy chủ và `DELETE` để kết thúc một phiên. Đường dẫn là `HOTLOOP_MCP_PATH` (mặc định `/mcp`) và endpoint chỉ có mặt khi `HOTLOOP_MCP_ENABLED` được bật.

Nó **không** nằm sau đăng nhập phiên. Nó có bearer token riêng, `HOTLOOP_MCP_TOKEN`, được kiểm tra trước trình xử lý để người gọi không có nó thậm chí không thể liệt kê các công cụ:

```
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="hotloop"

unauthorized
```

Khi chưa cấu hình token, HotLoop tạo một token ở lần khởi động đầu tiên và giữ trong cơ sở dữ liệu của nó (`hotloop mcp-token` in ra), nên endpoint không bao giờ mở. Một agent là một người gọi như mọi người khác: nó đọc và ghi, các lần ghi của nó đi qua cùng cổng ghi như của mọi người, và được kiểm toán dưới `mcp:<client name>`. Các công cụ và tài nguyên nằm trong [MCP](/vi/iot/mcp/).

```
POST /mcp
Authorization: Bearer <token>
Accept: application/json, text/event-stream

{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"1"}}}
```

phản hồi với header `Mcp-Session-Id` cùng các khả năng và hướng dẫn của máy chủ.

## Giao diện

### `GET /manifest.webmanifest`

Manifest ứng dụng web cho phép điện thoại cài giao diện như một ứng dụng: tên sản phẩm và nhà máy, `display` `standalone`, các màu giao diện, các biểu tượng (PNG 192 và 512 điểm ảnh, một bản 512 maskable và SVG) và lối tắt tới Báo động và Bảng điều khiển. Mọi URL trong đó đều tương đối so với URL của chính manifest, nên đúng ở bất cứ nơi nào HotLoop được gắn. Tên theo tên nhà máy đặt trong Cài đặt, và phản hồi là `Cache-Control: no-cache` để việc đổi tên hiện ra ở lần xem kế tiếp. Không có phiên: điện thoại hỏi trước khi có ai đăng nhập. Xem [Bảng điều khiển](/vi/iot/dashboards/#trên-điện-thoại).

### `GET /sw.js`

Service worker, ở gốc nơi HotLoop được gắn để phạm vi của nó bao trùm toàn bộ ứng dụng. Nó giữ trang và câu trả lời gần nhất cho các lần đọc mà một người xem, và trả lời chúng đánh dấu là cũ khi không liên lạc được HotLoop. Nó không bao giờ trả lời, giữ hay xếp hàng một lần ghi. Phiên bản đang chạy nằm trong đó, nên mỗi bản phát hành có bộ nhớ đệm trang riêng. `Cache-Control: no-cache`; không có phiên. Chỉ trình duyệt trong ngữ cảnh an toàn (https hoặc `localhost`) mới chạy nó.

### `GET /next` và `GET /next/`

Nơi giao diện từng nằm khi giao diện cũ còn là mặc định. Cả hai đều là `301` về gốc, nên dấu trang tạo lúc đó vẫn tới nơi.

### `/`

Giao diện web, được dựng từ `web/` vào trong tệp nhị phân: một trang, các script, kiểu và phông chữ của nó, một service worker và các biểu tượng của ứng dụng cài được, mọi URL trong đó đều tương đối so với trang nên nó chạy ở gốc của một host, dưới một đường dẫn, sau một proxy hoặc bên trong iframe của bảng điều khiển EmberNet. Máy chủ điền tiêu đề và một khối dữ liệu, `<script type="application/json" id="iiot">`, với những gì chỉ nó biết: nhà máy, địa điểm, sản phẩm, các tính năng, chính sách ghi và múi giờ. Chỉ `GET` và `HEAD`; mọi phương thức khác là `405`. Một đường dẫn không phải một trong các tệp của nó là `404`, vì phục vụ trang cho một lỗi gõ sẽ khiến nó trông như một màn hình đang hoạt động, và một tệp nhị phân được dựng không có giao diện sẽ nói điều đó bằng văn bản thuần cùng cách dựng. Không có phiên: trang là biểu mẫu đăng nhập cho đến khi bạn đăng nhập.
