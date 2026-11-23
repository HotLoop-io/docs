---
title: "Dự phòng nóng với lease"
description: "Hai bản cài Flow chia nhau một việc: một lease trong PostgreSQL và một rào chắn trên mọi lần ghi vào thiết bị, nên mỗi lúc chỉ một bản ghi."
---

Hai bản cài Flow có thể chia nhau công việc của một bản. Một bản là bên ghi: chỉ nó gửi bất cứ thứ gì tới thiết bị. Bản còn lại là bên dự phòng: nó chạy cùng các luồng, đọc, đăng ký và giữ ngữ cảnh của mình ở trạng thái nóng, nhưng giữ lại mọi lần ghi vào thiết bị cho đến khi nó thay chỗ bên ghi. Nếu bên ghi chết, treo hoặc mất liên kết, bên dự phòng tiếp quản trong khoảng bằng thời hạn của một lease, và bên từng là bên ghi không thể ghi lại cho đến khi giành lại được lease.

Điều này dành cho trường hợp khởi động lại không đủ nhanh và một bên ghi thứ hai còn tệ hơn một lần chờ ngắn. Nếu khởi động lại đủ nhanh, một bản cài duy nhất cùng việc Kubernetes lên lịch lại sẽ đơn giản hơn và là điều chart làm theo mặc định.

## Cách hoạt động

Lease là một dòng trong một PostgreSQL mà cả hai bản cài đều truy cập được. Bên ghi gia hạn nó vài giây một lần. Bên dự phòng cố giành nó theo cùng nhịp và chỉ có được sau khi nó đã hết hạn. Mỗi khi bên giữ thay đổi, số rào chắn trên dòng đó tăng lên, và Flow báo số đó.

Mọi lần ghi vào thiết bị đều hỏi cùng một câu ngay trước khi gửi: tôi có đang giữ lease, với thời gian còn lại nhiều hơn mức một lần ghi cần không? Nếu không, lần ghi bị từ chối bằng một lỗi được đếm, đến nút Catch của luồng, và không có gì được gửi, kể cả một kết nối. Việc kiểm tra đó, thực hiện đúng lúc mỗi lần ghi, là điều ngăn hai bản cài ghi cùng lúc:

- Bên giữ tính lease từ lúc nó đã yêu cầu, không bao giờ từ lúc câu trả lời quay về, nên nó không bao giờ nghĩ mình có nhiều thời gian hơn cơ sở dữ liệu.
- Bên giữ ngừng ghi khi lease còn lại ít hơn mức một lần ghi cần (`writeMargin`), tức là trước khi lease hết hạn. Bên dự phòng chỉ có thể lấy lease sau khi nó đã hết hạn. Vì vậy có một khoảng hở, và không có chồng lấn.
- Một bên giữ bị đóng băng rồi rã đông, hoặc bị cắt rồi kết nối lại, thấy lease của mình đã mất, từ chối các lần ghi của mình và xin lease như bất kỳ ai khác.
- Đồng hồ của cơ sở dữ liệu quyết định khi nào lease kết thúc, nên hai máy có đồng hồ lệch nhau vẫn thống nhất ai là bên giữ.

Các lần ghi có hỏi là những lần có thể ra lệnh cho thiết bị: `modbus write`, `s7 write`, `opcua write` và `ethernetip write`, dù trực tiếp hay qua cổng ghi của HotLoop, các nút `hotloop script` và `hotloop recipe`, và trong một sơ đồ FlowLab là ghi nối tiếp, một lệnh thiết bị đo có ghi (cùng với công tắc ghi riêng của thiết bị đó) và lần ghi HotLoop. Gửi thông điệp tới một MQTT broker, một cơ sở dữ liệu hay một thông báo không bị rào chắn: đó không phải lệnh cho thiết bị, và lặp lại nó là vô hại ở chỗ một giá trị đặt bị lặp lại có thể không vô hại. Một bài kiểm thử luồng thay cho thế giới bên ngoài và không bao giờ bị giữ lại.

## Cái giá và những gì nó không mang lại

- **Thời gian tiếp quản** xấp xỉ độ dài lease. Với giá trị mặc định (lease 15 giây, gia hạn mỗi 5 giây, biên 5 giây), một bên dự phòng đã tiếp quản 14,7 giây sau khi bên ghi bị tắt đột ngột. Với lease 6 giây là 5,7 giây. Bên ghi dừng sạch sẽ thì nhả lease, và bên dự phòng đã tiếp quản sau 0,35 giây.
- **Một lần ghi mất lâu hơn `writeMargin`** có thể sống lâu hơn lease. Hãy giữ thời gian chờ giao thức của các nút ghi dưới mức đó. Một lần ghi đã đang bay khi một tiến trình bị đóng băng đã qua bước kiểm tra và vẫn có thể đến nơi.
- **Ít nhất một lần.** Một PLC đã nhận một lần ghi mà xác nhận bị mất có thể thấy bên ghi mới gửi lại nó. Điều đó an toàn với giá trị đặt nhưng không với xung hay phép tăng, nên hãy ghi giá trị đặt, không ghi delta.
- **Hàng đợi vẫn ở cục bộ.** Dây bền vững và ngữ cảnh nằm trên đĩa riêng của mỗi bản cài. Những gì đang xếp hàng ở bên ghi đã chết không có ở bên dự phòng.
- **Cơ sở dữ liệu là một phụ thuộc.** Bên ghi không tới được nó thì không gia hạn được, và ngừng ghi khi lease của nó ngắn lại. Hãy đặt lease trên cơ sở dữ liệu ít nhất cũng sẵn sàng như thiết bị mà nó bảo vệ.

## Thiết lập

Cài Flow hai lần, dưới dạng hai release Helm hoặc hai unit Quadlet, mỗi bản có volume riêng, và trỏ cả hai vào cùng một lease. Đưa cho bản thứ hai cùng tệp luồng như bản đầu và giữ nó như vậy bằng cách đẩy tới các trạm ([Đẩy tới các trạm của một tenant](/vi/flow/stations/)), vì Flow không sao chép luồng giữa hai bản.

| Cài đặt | Biến môi trường | Là gì |
|---|---|---|
| `failover.urlFile` | `HOTLOOP_FLOW_FAILOVER_URL_FILE` | Một tệp chứa URL PostgreSQL của cơ sở dữ liệu lease. Đặt nó sẽ bật failover. |
| `failover.name` | `HOTLOOP_FLOW_FAILOVER_NAME` | Lease. Giống nhau ở cả hai. Mặc định `flow`. |
| `failover.holder` | `HOTLOOP_FLOW_FAILOVER_HOLDER` | Tên riêng của bản cài này. Phải khác nhau giữa hai bản, và mặc định là tên máy chủ. |
| `failover.ttl` | `HOTLOOP_FLOW_FAILOVER_TTL` | Một lần cấp kéo dài bao lâu, và do đó xấp xỉ thời gian tiếp quản. Mặc định `15s`. |
| `failover.renewEvery` | `HOTLOOP_FLOW_FAILOVER_RENEW_EVERY` | Bên giữ hỏi lại thường xuyên đến đâu. Mặc định bằng một phần ba ttl. |
| `failover.writeMargin` | `HOTLOOP_FLOW_FAILOVER_WRITE_MARGIN` | Một lần ghi cần còn lại bao nhiêu lease. Mặc định `5s`. |

Flow từ chối khởi động khi các cài đặt khiến bên giữ tụt xuống dưới biên của nó giữa các lần gia hạn, ví dụ một biên dài bằng ttl.

Trong chart chúng là `failover.urlSecret` (một Secret có khóa chứa URL, được gắn như tệp và không bao giờ đặt vào ConfigMap), `failover.name`, `failover.ttl`, `failover.renewEvery` và `failover.writeMargin`. Với Quadlet chúng là các biến môi trường ở trên, và URL là một secret Podman được gắn như tệp:

```ini
Environment=HOTLOOP_FLOW_FAILOVER_URL_FILE=/run/secrets/flow-lease-url
Environment=HOTLOOP_FLOW_FAILOVER_NAME=line3
Secret=hotloop-flow-lease-url,type=mount,target=flow-lease-url
```

## Xem nó

- `GET /failover` (và công cụ MCP `get_failover`) cho biết bản cài này là `active`, `standby` hay `lost`, ai đang giữ lease, số rào chắn nó giữ và nó đã giữ lại bao nhiêu lần ghi, theo thứ đang ghi. Nó cần `status.read` và chỉ có khi failover được thiết lập.
- Trình soạn thảo hiện một biểu ngữ trên bên dự phòng và trên bên giữ đã mất lease.
- Điểm cuối số liệu có `hotloop_flow_failover_active`, `hotloop_flow_failover_epoch`, `hotloop_flow_failover_takeovers_total` và `hotloop_flow_failover_refused_total{op}`.
- Cả hai bản cài đều ghi nhật ký khi chúng lấy lease và khi lease bị lấy đi.

## Điều đã được chứng minh, và điều chưa

Đã chứng minh trên hai tiến trình Flow thật với một PostgreSQL thật và một máy chủ Modbus TCP ghi lại mọi lần ghi, mỗi bản cài ghi một giá trị có gắn nhãn mỗi 200 ms: khi bên ghi bị tắt giữa chừng, bên dự phòng tiếp quản sau một lease, và không có lần ghi nào của bên dự phòng đến trước lần ghi cuối của bên ghi hay sau nó (0 và 0); khi bên ghi bị đóng băng lâu hơn lease rồi rã đông, nó không ghi lại; khi bên ghi dừng sạch sẽ, bên dự phòng tiếp quản sau 0,35 giây. Một bài kiểm thử cho từng đường ghi ở trên cho thấy lần ghi của một bên dự phòng hay một bên giữ đã hết hạn bị từ chối trước khi có gì được gửi, và cho thấy cùng lần ghi đó được gửi khi cổng mở.

Chưa chứng minh: hành vi của một PLC thật với một lần ghi lặp lại, một lần chuyển đổi dự phòng cơ sở dữ liệu bên dưới lease, và một mạng bị cắt chỉ một chiều. Máy chủ Modbus là một trình mô phỏng nói giao thức đó. Failover chưa được thử trên cluster, và các giá trị chart cùng các dòng Quadlet được render và kiểm tra, chưa cài đặt. Các chuỗi trong biểu ngữ của trình soạn thảo chưa được người bản ngữ xem xét.
