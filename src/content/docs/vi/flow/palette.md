---
title: "Bảng nút"
description: "Mọi loại nút mà Flow cung cấp, được gắn nhãn đầy đủ, một phần, khác biệt hoặc chỉ có ở Flow, với điểm khác so với Node-RED được ghi rõ."
---

**117 loại nút cho tin nhắn và 39 loại nữa cho sơ đồ FlowLab.**

| Danh mục | Nút |
|---|---|
| Chung | inject, debug, complete, catch, status, link in, link out, comment, junction |
| Hàm | function, switch, change, range, template, delay, trigger, exec, rbe |
| Mạng | ntfy out, gotify out, discord out, discord bot out, kafka out, mqtt in/out, http in, http response, http request, websocket in/out, tcp in/out, tcp request, udp in/out, modbus read/write, s7 read/write, ethernetip read/write, opcua read/write/subscribe, sparkplug in/out/command, hotloop in/state/script/recipe, mcp tool/result/client, e-mail, và các nút modbus-read/getter/flex-getter/write/flex-write/server của Node-RED |
| Chuỗi | split, join, sort, batch |
| Bộ phân tích | csv, html, json, xml, yaml |
| Lưu trữ | file, file in, watch, influxdb out, postgres, postgresql |
| Bảng điều khiển | ui_text, ui_numeric, ui_button, ui_switch, ui_text_input, ui_led, ui_gauge, ui_chart, ui_template, và ui_base, ui_tab, ui_group, ui_link, ui_spacer dùng để bố trí trang |
| Khám phá | scan, netinfo, để kiểm kê một phân đoạn OT |
| Cấu hình | hotloop-flow-ntfy, hotloop-flow-gotify, hotloop-flow-discord-bot, hotloop-flow-kafka, mqtt-broker, websocket-listener, websocket-client, influxdb, postgres, modbus, s7, ethernetip, opcua, sparkplug, hotloop, mcp-server, modbus-client, postgreSQLConfig |
| FlowLab | constant, math, compare, logic, wait, bundle, field, build array, while loop, for loop, body in, body out, serial port, serial read, serial write, parse reading, stable value, log to text file, log to TDMS file, statistics, integral, derivative, filter, read DAQ task, mqtt out, postgres out, control, indicator, chart |

Hàng FlowLab là một loại nút khác. Nó chạy trên một tab là sơ đồ, nơi một nút chạy một lần khi mọi đầu vào đều có giá trị, và không bao giờ nhận tin nhắn. FlowLab là gì, và cách các vòng lặp, dây lỗi, bảng điều khiển và trình gỡ lỗi của nó hoạt động, nằm trong [FlowLab](/vi/flow/flowlab/). Một tệp luồng, và do đó một bộ sơ đồ, có thể được đẩy tới mọi bản cài Flow mà một tenant chạy trong EmberNet, mỗi bản đều được kiểm tra và bản nào thất bại thì được đưa về như cũ: [Đẩy tới các trạm của một tenant](/vi/flow/stations/). Hai bản cài có thể chia sẻ công việc của một bản, với một thuê bao và một rào chắn trên mọi lần ghi xuống thiết bị để chỉ một bản ghi: [Dự phòng nóng với thuê bao](/vi/flow/failover/).

## Thông báo cho mọi người, và Kafka

Năm nút gửi nội dung mà tin nhắn mang đi nơi khác và chuyển tiếp tin nhắn: **ntfy out**, **gotify out**, **discord out** (một webhook), **discord bot out** và **kafka out**. Chúng dùng cùng các cài đặt mà lõi HotLoop dùng để gửi cảnh báo và sự kiện, nên một nhà máy đã có chủ đề ntfy, ứng dụng Gotify, webhook Discord hoặc cụm Kafka chỉ cần trỏ Flow tới những thứ đó.

- **ntfy.** Một nút cấu hình máy chủ (địa chỉ, rồi mã truy cập hoặc tên người dùng và mật khẩu, hoặc không có gì với máy chủ cho phép ai cũng đăng được), và mỗi nút có một chủ đề, một tiêu đề, một mức ưu tiên (từ min đến max, hoặc `msg.priority`), thẻ và một địa chỉ khi nhấp. Chủ đề hoặc tiêu đề để trống sẽ lấy `msg.topic` hoặc `msg.title`. Trên máy chủ công khai, chủ đề là bí mật duy nhất, nên nó được giữ ngoài mọi lỗi và trạng thái.
- **Gotify.** Một nút cấu hình máy chủ với mã của ứng dụng, và mỗi nút có một tiêu đề và mức ưu tiên từ 0 đến 10.
- **Webhook Discord.** URL của webhook là toàn bộ thông tin xác thực, nằm trên nút, và không bao giờ hiện trong trạng thái, nhật ký hay lỗi, kể cả lỗi mạng có nêu địa chỉ. Một tiêu đề hoặc một màu biến tin nhắn thành embed. Nội dung bị cắt ở 2,000 ký tự và phần mô tả của embed ở 4,096, đếm theo cách Discord đếm, và không gì trong tin nhắn có thể nhắc tên ai.
- **Bot Discord.** Một nút cấu hình bot với mã của nó, và mỗi nút có một ID kênh (hoặc `msg.channel`). Nó đăng với tư cách bot và cần bot ở trong kênh với quyền gửi.
- **Kafka out.** Một nút cấu hình cụm (broker, SASL PLAIN hoặc SCRAM-SHA-256 hoặc SCRAM-SHA-512, TLS), và mỗi nút có một chủ đề và một khóa tùy chọn. Giá trị là `msg.payload`, dưới dạng văn bản, hoặc JSON khi không phải văn bản, và tin nhắn được chuyển tiếp khi cụm đã xác nhận từ mọi bản sao đồng bộ. Nó dùng franz-go, ứng dụng khách mà đầu ra Kafka của lõi sử dụng.

Một máy chủ từ chối sẽ nói lý do trong lỗi của nút, không kèm bất cứ thứ gì đã gửi. Giới hạn tốc độ được chờ một lần, lâu như máy chủ báo tối đa một phút, rồi tin nhắn thất bại. Không có nút Slack hay Teams, cũng không có nút UADP: HotLoop nhận UADP và Flow đọc các giá trị đó qua các nút HotLoop.

Đã được chứng minh với ntfy thật, Gotify thật và Redpanda thật: nút đăng và máy chủ được hỏi xem nó đang giữ gì. Các nút Discord theo API được ghi tài liệu của Discord cho webhook và bot.

`scan` quét một dải CIDR và nhận diện các điểm cuối Modbus và EtherNet/IP, còn `netinfo` báo các giao diện mà môi trường chạy thực sự thấy được, mà ở chế độ macvlan là cách một luồng khám phá địa chỉ của chính nó trên VLAN OT. Các nút Modbus TCP, S7, EtherNet/IP, OPC UA và Sparkplug B giờ có thể nói chuyện với những gì `scan` tìm thấy, và chúng là phần tiếp theo.

Một bộ mô tả Go cho mỗi loại nút khai báo thuộc tính, cổng, giá trị mặc định và văn bản trợ giúp của nó, và trình soạn thảo dựng hộp thoại từ đó, nên một nút không thể phát hành với hộp thoại mâu thuẫn với môi trường chạy của nó.
