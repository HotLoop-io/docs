---
title: "API quản trị"
description: "Các lệnh gọi HTTP và websocket mà trình soạn thảo và dòng lệnh sử dụng, mỗi lệnh cần gì và trả về gì."
---

| Phương thức và đường dẫn | Quyền | Ghi chú |
|---|---|---|
| `GET /health` | không | Kiểm tra còn sống. Kubelet không mang theo mã thông báo, và việc xác thực trên đường dẫn này sẽ khiến pod khởi động lại trong vòng lặp vô tận. |
| `GET /ready` | không | Kiểm tra sẵn sàng, báo riêng, để một môi trường chạy không khởi động được sẽ rời khỏi Service mà kubelet không giết pod. |
| `POST /auth/token` | không | Đăng nhập. Mã 429 kèm `Retry-After` khi đang bị khóa. |
| `POST /auth/revoke` | không | Đăng xuất. |
| `GET /auth/mode` | không cần đăng nhập | Cho biết môi trường chạy này có được mở từ bảng điều khiển EmberCORE hay không: `{"dashboard": bool, "hideLogin": bool}`. Trình soạn thảo hỏi điều này trước khi có ai đăng nhập. |
| `GET /auth/mfa`, `POST /auth/mfa/setup`, `/confirm`, `/disable` | người dùng đã đăng nhập | Đăng nhập hai yếu tố của chính bạn. Setup trả về khóa, liên kết `otpauth://` và mã QR. Confirm và disable nhận `{"code": ...}`. |
| `POST /auth/mfa/reset` | `auth.admin` | Tắt đăng nhập hai yếu tố của người khác: `{"username": ...}`. |
| `GET /metrics` | không | Prometheus. Chỉ có số đếm và id nút, không bao giờ có nội dung tin nhắn hay cấu hình. |
| `GET /settings` | `settings.read` | |
| `GET /nodes` | `nodes.read` | Sổ đăng ký, thứ vận hành bảng nút và các hộp thoại của trình soạn thảo. |
| `GET /plugins` | `nodes.read` | Các plugin đã nạp, mỗi plugin yêu cầu gì và được cấp gì, và những plugin bị từ chối kèm lý do. |
| `GET /flows` | `flows.read` | |
| `GET /flows/export` | `flows.read` | Tệp luồng đúng như đang nằm trên đĩa, dành cho git. |
| `POST /flows` | `flows.write` | Triển khai. Nhận một ghi chú tùy chọn cho nhật ký triển khai. |
| `GET /deployments` | `flows.read` | Nhật ký triển khai, mới nhất trước, không kèm nội dung. `?limit=N` giới hạn số lượng. |
| `GET /audit` | `audit.read` | Ai đã làm gì từ đâu, mới nhất trước. `?event=`, `?user=`, `?since=`, `?limit=`. |
| `GET /deployments/{seq}` | `flows.read` | Một bản ghi, với các luồng đã phân tích. Không bao giờ có thông tin xác thực của nó. |
| `GET /deployments/{seq}/flows` | `flows.read` | Tệp luồng của lần triển khai đó, từng byte một. |
| `GET /deployments/{from}/diff/{to}` | `flows.read` | Khác biệt từng nút giữa hai lần triển khai, có cấu trúc và dạng văn bản. |
| `POST /flows/diff` | `flows.read` | Khác biệt giữa bản đang chạy và tài liệu trong phần thân. Không triển khai gì cả. |
| `POST /flows/types` | `flows.read` | Việc kiểm tra dây có kiểu mà một lần triển khai thực hiện, trên tài liệu trong phần thân: `{"wires": [...]}`, rỗng khi không có gì sai. Trình soạn thảo vẽ câu trả lời. Không triển khai gì cả. |
| `POST /deployments/{seq}/rollback` | `flows.write` | Triển khai lại các luồng và thông tin xác thực của bản ghi đó như một lần triển khai mới. Nhận tiêu đề rev và một `{"note": ...}` tùy chọn. |
| `GET /tests` | `flows.read` | Bộ kiểm thử luồng được giữ cạnh tệp luồng, tên tệp của nó, và việc các lần triển khai có bị chặn bởi nó hay không. |
| `PUT /tests` | `flows.write` | Thay thế bộ kiểm thử. Phần thân là YAML; cái nào không phân tích được sẽ trả về 400 kèm lý do. |
| `POST /tests/run` | `flows.read` | Chạy bộ kiểm thử, hoặc `"tests"` từ phần thân, trên `"flows"` từ phần thân hoặc bản đang chạy. Trả về báo cáo. Không triển khai gì cả. |
| `POST /tests/from-debug` | `flows.read` | Soạn một bài kiểm thử từ `{"node", "msgId"}`, một tin nhắn mà nút Debug đã hiển thị. Không lưu gì cả. |
| `POST /tests/cases` | `flows.write` | Thêm các bài kiểm thử trong phần thân, một tệp kiểm thử riêng, vào cuối bộ kiểm thử. |
| `GET /traces` | `flows.read` | Các vết được giữ, mới nhất trước, cùng với những gì bộ đệm chứa và các giới hạn của nó. `?limit=N`. 404 khi `trace.enabled: false`. |
| `GET /traces/find` | `flows.read` | Vết mà một tin nhắn nằm trong, theo `?msgId=` và `?node=`, id và nút Debug mà thanh bên hiển thị. Trả về mọi chặng và đường đi tới chặng được hỏi. |
| `GET /traces/{id}` | `flows.read` | Một vết, mỗi chặng kèm thời gian và tin nhắn như nút đã nhận. |
| `POST /traces/{id}/test` | `flows.read` | Soạn một bài kiểm thử luồng từ vết. Không lưu gì cả. |
| `POST /traces/{id}/replay` | `flows.read` | Đưa tin nhắn đã khởi đầu vết vào `"flows"` từ phần thân, hoặc bản đang chạy, trong một tiến trình con, và trả về nơi nó kết thúc so với nơi nó đã kết thúc. Không triển khai gì cả. |
| `GET /runtime/stats` | `status.read` | |
| `POST /inject/{id}` | `inject.write` | Kích hoạt một nút Inject. |
| `GET /comms` | `status.read` | Websocket trạng thái và gỡ lỗi của trình soạn thảo. Gửi mã thông báo dưới dạng giao thức con `hotloop-flow.bearer.<token>`, được đưa ra bên cạnh `hotloop-flow`. Đó là điều trình soạn thảo làm. `?access_token=<token>` trong URL vẫn hoạt động cho các tập lệnh đang dùng nó, và ghi một cảnh báo cho mỗi kết nối làm vậy, vì URL sẽ nằm lại trong nhật ký proxy và nhật ký truy cập. |
| `POST /mcp` (và `GET` và `DELETE`, cho các bản sửa đổi cũ hơn của giao thức) | `mcp.call` | [Điểm cuối MCP](/vi/flow/mcp/), nơi các luồng được cung cấp như công cụ. Mã phiên hoặc mã API như bất kỳ mã nào khác. Các công cụ được đưa ra cho người gọi, và người đó có thể gọi, là những công cụ nằm trong tầm quyền của họ. 403 khi tắt xác thực. |

Việc `/metrics` và `/health` không cần xác thực là một quyết định chứ không phải sơ suất. Bộ thu thập Prometheus không mang mã bearer, nên yêu cầu một mã nghĩa là hoặc trao thông tin xác thực cho hệ thống giám sát của bạn, hoặc không có giám sát.

Người dùng bật đăng nhập hai yếu tố gửi `"code"` cùng với tên người dùng và mật khẩu tới `POST /auth/token`. Không có nó, câu trả lời là 401 kèm `"mfa": "required"`.

Các quyền là `"*"` cho mọi thứ, một chuỗi chính xác như `flows.read`, hoặc một cấp quyền theo tiền tố như `flows.*`. Một tác nhân gọi luồng như công cụ MCP cần `mcp.call`. Một tài khoản chỉ đọc cho bảng điều khiển chỉ muốn hiển thị trạng thái luồng là `["flows.read", "status.read"]` và không gì thêm.

Các lần triển khai nhận một tiêu đề tùy chọn `HotLoop-Flow-Deployment-Rev`. Gửi bản sửa đổi bạn đọc gần nhất và một lần triển khai đua với trình soạn thảo khác sẽ bị từ chối bằng 409 thay vì lặng lẽ ghi đè công việc của ai đó, một lỗi mà bạn chỉ nghe nói tới từ người đã mất cả buổi chiều.

Một lần triển khai chỉ khởi động lại những gì bạn đã đổi. Một nút vẫn chạy khi không có gì nó dựa vào bị đổi: cài đặt, tab, nhóm, môi trường, thông tin xác thực của nó và mọi nút cấu hình mà nó nêu tên. Kéo nó trên canvas hay nối lại dây không tính, vì dây mới được gắn vào nút đang chạy. Nhờ vậy sửa một lỗi chính tả trong một nút hàm không còn làm rớt mọi phiên MQTT trên hộp, và một nút Delay đang giữ mười phút giá trị đo vẫn tiếp tục giữ chúng. Đó là toàn bộ lý do nó tồn tại: khi mỗi lần lưu làm nhà máy giật cục, người vận hành ngừng lưu trong ca làm việc và bản sửa phải chờ đến thứ Bảy.

Chọn mức khởi động lại bằng tiêu đề `HotLoop-Flow-Deployment-Type`. `Node-RED-Deployment-Type` của Node-RED cũng dùng được, nên một tập lệnh triển khai bạn đã có sẽ nhận được lần khởi động lại mà nó yêu cầu.

| Loại | Điều được khởi động lại |
|---|---|
| `nodes` (mặc định) | Các nút bạn đã đổi, cộng với mọi thứ nêu tên một nút cấu hình bạn đã đổi. |
| `flows` | Mọi nút trên bất kỳ luồng nào có thay đổi. |
| `full` | Tất cả. Giống như khởi động lại tiến trình. |

Phản hồi cho biết nó đã làm gì: `type`, `started`, `restarted`, `stopped` và `unchanged`. Không có gì đang xử lý bị mất trên đường. Công việc đã xếp hàng ở nút đang được thay sẽ hoàn tất trên bản cũ, mọi thứ xuất hiện trong lúc đổi sẽ chờ bản mới, và một tin nhắn hướng tới nút bạn đã xóa được đếm và hiện ra như một lần loại bỏ thay vì biến mất.
