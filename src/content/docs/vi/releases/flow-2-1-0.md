---
title: "Ghi chú phát hành: HotLoop Flow 2.1.0"
description: "HotLoop Flow 2.1.0 có gì mới, điều gì thay đổi khi nâng cấp và nên đọc gì trước khi đụng vào một nhà máy đang chạy."
sidebar:
  label: "2.1.0"
---

HotLoop Flow 2.1.0 gồm các giai đoạn 0 đến 2 của [lộ trình](/vi/flow/roadmap/) cùng những chỗ thiếu hằng ngày từng cản việc đưa một luồng thật vào chạy. Mỗi lần triển khai giờ là một bản ghi bạn có thể so sánh, kiểm thử, rà soát và khôi phục. Một luồng có thể có các bài kiểm thử chạy trước khi một lần triển khai xấu xảy ra. Mỗi lần lưu chỉ khởi động lại các nút bạn đã đổi và để yên phần còn lại của nhà máy.

Không có gì trong bản phát hành này làm đổi cách đọc hoặc ghi một tệp luồng. Vòng đi về từng byte vẫn nguyên vẹn, nên một `flows.json` từng chạy trên 2.0.5 vẫn chạy trên 2.1.0.

## Có gì mới

**Triển khai**
- Mỗi lần triển khai là một bản ghi: ai, từ đâu, khi nào, ghi chú, bản sửa đổi bị thay thế, tệp luồng từng byte và thông tin xác thực được mã hóa đúng như lúc đó. `GET /deployments` đọc chúng. `history.retain` mặc định giữ 100 bản gần nhất.
- Một bản so sánh đọc như một buổi rà soát: từng nút, từng thuộc tính, phần bố cục tách khỏi logic, thông tin xác thực không bao giờ hiển thị. Trong API, trên dòng lệnh (`hotloop-flow diff`) và làm trình điều khiển diff của chính git.
- Khôi phục đưa một bản ghi cũ trở lại thành một lần triển khai mới, luồng và thông tin xác thực cùng nhau, nên một nút đã xóa quay lại cùng mật khẩu broker của nó.
- Triển khai một phần: mỗi lần lưu khởi động lại các nút đã thay đổi. Phiên MQTT, bộ lắng nghe và hàng đợi Delay của mọi thứ khác vẫn chạy. `HotLoop-Flow-Deployment-Type` (hoặc header của Node-RED) chọn nút, luồng hoặc toàn bộ.
- Trình soạn thảo rà soát trước khi triển khai, với bản so sánh vẽ ngay trên canvas cùng một ghi chú, và hiển thị lịch sử kèm nút khôi phục.
- Luồng như mã: `hotloop-flow deploy` in ra khác biệt so với bản đang chạy và triển khai dựa trên bản sửa đổi mà nó xuất phát, nên một cuộc đua sẽ hiện thành pipeline đỏ. `hotloop-flow export` trả lại tệp đang chạy từng byte. `hotloop-flow token` tạo một token API và mã băm cần cấu hình cho nó.
- Bản gương git tùy chọn: khi đặt `history.git`, mỗi lần triển khai là một commit do chính người triển khai làm tác giả.

**Kiểm thử**
- Kiểm thử luồng: `flows.test.yaml` đặt cạnh `flows.json`, chạy bằng `hotloop-flow test` (JUnit với `-junit`) trên runtime thật và các nút thật. Delay, Trigger, Inject, Join và Batch chạy trên một đồng hồ do bài kiểm thử tua đi, nên năm phút Delay chỉ là một bước. Mọi thứ nói chuyện với bên ngoài, MQTT, HTTP, PostgreSQL, InfluxDB, TCP, UDP, WebSocket, tệp, exec, đều được thay bằng bản giả, và bài kiểm thử kiểm tra những gì lẽ ra đã được gửi đi.
- Cổng triển khai: bật `tests.gate` và một lần triển khai có luồng không qua bộ kiểm thử sẽ nhận 422 kèm toàn bộ báo cáo. Khôi phục không bị chặn bởi cổng, vì khôi phục chính là lối thoát.
- Trình soạn thảo biến một thông điệp gỡ lỗi thành bài kiểm thử và chạy nó.

**Nút và giao thức**
- JSONata, được chứng minh bằng bộ kiểm thử jsonata-js 2.2.2 đã công bố: 1673 trên 1686 trường hợp đạt, và 13 trường hợp không đạt được ghim theo tên cùng lý do.
- Inject kích hoạt theo crontab, đúng phút mà Node-RED sẽ làm, đã kiểm tra các lần đổi giờ ở sáu múi giờ.
- MQTT 5 (thuộc tính, tùy chọn đăng ký, hết hạn phiên) và last will. MQTT 3.1.1 vẫn chạy.
- TLS trên TCP, yêu cầu HTTP và MQTT qua một nút `tls-config`. Bộ lắng nghe và máy khách WebSocket khởi động, và máy khách dùng TLS.
- Cookie và multipart trên HTTP, đối chiếu với các thư viện mà Node-RED dùng.
- Split, Join và Batch hoạt động như của Node-RED: truyền phát, hết thời gian chờ, rút gọn, khoảng thời gian. Link Call và chế độ trả về của Link Out.
- Mật khẩu có thể nằm trong một Secret được gắn thay vì trong luồng. Helm chart có thêm `secrets.mounts`.

**Đăng nhập**
- Đăng nhập hai bước (TOTP), miễn phí, cho bất kỳ ai bật nó từ trình soạn thảo.
- Khóa tài khoản, phiên sống sót qua khởi động lại và nhật ký kiểm toán ghi ai đã làm gì từ đâu (`GET /audit`, `audit.read`).

## Có gì thay đổi

- Khóa tài khoản được bật mặc định: 5 lần thất bại với một tài khoản từ một địa chỉ, hoặc 20 lần từ một địa chỉ, sẽ khóa trong 15 phút kèm mã 429. `auth.lockout` đổi các con số.
- Phiên được lưu trong `data/sessions.json` dưới dạng mã băm và theo cấu hình ở mỗi yêu cầu, nên gỡ một quyền hoặc một người dùng khỏi cấu hình có hiệu lực ở yêu cầu kế tiếp.
- Khôi phục là một lần khởi động lại đầy đủ trừ khi bạn yêu cầu ít hơn.
- Image mang theo `LICENSE`, `NOTICE` và `THIRD_PARTY_LICENSES` trong `/usr/share/doc/hotloop-flow/`. `THIRD_PARTY_LICENSES` liệt kê mọi module Go và gói npm trong tệp nhị phân cùng phiên bản và văn bản giấy phép, được sinh khi build. Build thất bại nếu có phụ thuộc GPL, AGPL hoặc LGPL, hoặc phụ thuộc mà không ai nhận diện được.
- `NOTICE` đã sai. Nó nói không có mã Node-RED nào ở đây. Cron, Split, Join, Batch, Link Call, tls-config và phần xử lý cookie và multipart của HTTP là các bản chuyển, và giờ nó liệt kê từng tệp được chuyển cùng nguồn gốc, bên giữ bản quyền và giấy phép, kèm toàn văn ISC cho cronosjs và văn bản MIT cho phần còn lại. Mỗi tệp được chuyển cũng nói điều đó ở đầu.
- Một lần triển khai bị từ chối không còn dọn thông tin xác thực trong bộ nhớ, và nhấp đúp vào một nút trong Chromium mở hộp thoại của nó. Cả hai được tìm ra khi xây dựng bản này.

## Ghi chú nâng cấp

Từ 2.0.5, chỉ cần đổi image (`helm upgrade`, hoặc tag mới trong unit Quadlet của bạn). Không cần di chuyển dữ liệu, không cần cờ nào.

- Lần khởi động đầu tiên tạo `sessions.json`, `audit.log` và một thư mục `deployments` dưới `data.dir`. Trước đây phiên nằm trong bộ nhớ, nên sau khi nâng cấp mọi người đăng nhập lại một lần.
- Mọi thứ mới trong cấu hình đều tùy chọn và mặc định tắt hoặc vô hại. Không thứ gì bạn đang dùng ngừng hoạt động.
- Token WebSocket: trình soạn thảo giờ gửi token của nó dưới dạng subprotocol, `hotloop-flow.bearer.<token>`, được đưa ra cạnh `hotloop-flow`. Đó là cách ưu tiên cho mọi thứ kết nối tới `/comms`. Một script gửi `?access_token=` trong URL vẫn chạy, và máy chủ ghi một cảnh báo cho mỗi kết nối như vậy, nói rằng token bị lộ vào nhật ký proxy và truy cập và nên gửi gì thay thế. Bản thân URL không bao giờ được ghi vào nhật ký của Flow hay dấu vết kiểm toán. Việc bỏ dạng URL chờ đến một bản phát hành chính trong tương lai.

## Cài đặt mới

| YAML | Biến môi trường | Mặc định |
|---|---|---|
| `tests.gate` | `HOTLOOP_FLOW_TESTS_GATE` | `false`. `true` từ chối một lần triển khai có luồng không qua `flows.test.yaml`. |
| `tests.timeout` | | `2m`, thời gian thực tối đa cho một lần chạy kiểm thử. Một lần chạy không thể hoàn tất sẽ từ chối lần triển khai. |
| `secrets.allowedPaths` | `HOTLOOP_FLOW_SECRET_ALLOWED_PATHS` | trống. Các cây thư mục bổ sung mà `tls-config` hoặc tệp thông tin xác thực có thể được đọc từ đó, ngoài `data.dir`. Không phải phạm vi của các nút tệp: nút File In vẫn không đọc được chúng. |
| `secrets.mounts` (chart) | | trống. Kubernetes Secret được gắn chỉ đọc, mỗi cái được thêm vào phạm vi bí mật. |
| `auth.tokens` | `HOTLOOP_FLOW_DEPLOY_TOKEN_HASH` | không có. Token API cho máy, lưu dưới dạng mã băm. Biến môi trường tạo một token `deploy` chỉ đọc và triển khai được, không hơn. Tạo một cái bằng `hotloop-flow token`. |
| `auth.lockout` | | `attempts: 5`, `perAddress: 20`, `window: 15m`, `duration: 15m` |
| `history.retain` | | `100`. `0` giữ mọi bản ghi. |
| `history.git` | `HOTLOOP_FLOW_GIT_URL`, `HOTLOOP_FLOW_GIT_USERNAME`, `HOTLOOP_FLOW_GIT_PASSWORD` | tắt. |
| `audit.maxBytes`, `audit.keep` | | 16 MiB, 4 tệp. |

Image: `ghcr.io/hotloop-io/hotloop-flow:2.1.0`, linux/amd64 và linux/arm64. Chart: `https://hotloop.io/hotloop-flow/`. README tại tag này có phần còn lại: https://github.com/HotLoop-io/hotloop-flow/blob/v2.1.0/README.md
