---
title: "Lưu và chuyển tiếp trong HotLoop Flow"
description: "Đánh dấu một đường nối là bền vững và thông điệp được ghi xuống đĩa theo thứ tự khi nút phía sau ngừng trả lời, và còn lại sau kill -9."
---

Đánh dấu một đường nối là bền vững và, khi nút ở đầu bên kia còn theo kịp, nó là một đường nối bình thường và không ghi gì xuống đĩa. Ngay khi nút đó ngừng nhận thông điệp, đường nối tràn sang cùng tệp SQLite đó trước khi bên gửi đi tiếp, và một bơm giao chúng từ cũ nhất cho đến khi đích nhận từng cái, theo lô tối đa 256 cho đích ghi vào cơ sở dữ liệu một lượt (InfluxDB làm vậy), và từng cái một với phần còn lại. Vì vậy historian ngừng, các số đọc dồn lại trên đĩa thay vì chặn luồng hoặc bị bỏ, và chúng được đưa vào, theo thứ tự, khi nó trở lại. Cái giá của việc không ghi gì khi mọi thứ khỏe là khi đó một lệnh `kill -9` mất những gì đang ở trong bộ nhớ, tương đương một lần thăm dò, và chúng tôi thà nói ở đây còn hơn để bạn tự phát hiện.

```json
{ "id": "count", "type": "function", "ew_durable": ["influx"], "wires": [["influx", "reply"]] }
```

Bạn không phải tự viết khóa. Nhấp đúp vào đường nối trong trình soạn thảo và đánh dấu *Durable*.

Nó còn lại sau khi khởi động lại, giữ thứ tự, tuân theo hạn mức đĩa (mặc định 256 MiB, và chính sách tràn của nút ở đầu bên kia quyết định cái gì phải nhường khi đầy) và hiển thị độ sâu của nó là `hotloop_flow_durable_wire_depth`. Nó là ít nhất một lần, không phải đúng một lần, và chúng tôi thà nói điều đó ở đây còn hơn để bạn phát hiện trong một buổi rút kinh nghiệm: lời lẽ chính xác, và việc `influxdb out` vẫn đúng bằng cách nào, nằm trong [docs/durable](/vi/flow/durable-state/).

Bằng chứng là `docs/durable/store-and-forward.sh`: một InfluxDB 2.9.1 thật trong Podman với hai mươi số đọc mỗi giây, bị dừng mười phút rồi đưa trở lại, với runtime bị kill bằng `kill -9` một lần giữa lúc gián đoạn và một lần giữa lúc xả. 15,982 số đọc được nhận, 15,982 dòng được lưu, không thiếu cái nào, không trùng cái nào. Một đường nối bền vững khỏe không tự ghi gì, và với ngữ cảnh được xả mỗi ba mươi giây, toàn bộ tiến trình ghi 1.7 MiB mỗi giờ ở hai mươi thông điệp mỗi giây (0.04 GB mỗi ngày). Các bảng và lệnh nằm trong [docs/durable](/vi/flow/durable-state/).

## Một thông điệp mà đích từ chối mãi mãi

Theo mặc định, một đường nối cứ thử lại thông điệp mà đích của nó làm lỗi, với khoảng nghỉ tăng đến năm giây, và không có gì sau thông điệp đó di chuyển. Với historian đang ngừng, thế là đúng. Với một số đọc sai định dạng mà historian sẽ không bao giờ nhận, đó là một đường nối kẹt vĩnh viễn, nên có một lối thoát, và nó tắt cho đến khi bạn yêu cầu.

```json
{ "id": "count", "type": "function", "ew_durable": ["influx"], "ew_durable_attempts": { "influx": 20 }, "wires": [["influx", "reply"]] }
```

Đặt cho đường nối một số lần thử, trong hộp thoại đường nối của trình soạn thảo hoặc như trên, và sau khi đích đã từ chối một thông điệp trong hàng đợi chừng đó lần, đường nối nâng nó lên luồng như một lỗi từ nút đã từ chối nó, kèm thông điệp theo cách mọi lỗi nút vẫn mang, rồi chuyển sang thông điệp kế tiếp. Một nút Catch trên luồng đó nhận được nó và có thể cất nó, cảnh báo về nó hoặc ghi nó đi nơi khác. Không có Catch thì lỗi vẫn hiện trong thanh bên gỡ lỗi và thông điệp mất, nên hãy nối một cái. Lần từ chối đầu tiên, trong bộ nhớ, đến Catch như mọi khi, nên một Catch thấy cùng một thông điệp hai lần: một lần khi nó lỗi lần đầu và một lần khi đường nối bỏ cuộc. Số đếm theo từng thông điệp và nằm trong bộ nhớ, nên khởi động lại là đếm lại từ đầu. `hotloop_flow_durable_wire_given_up_total` đếm chúng, bên cạnh độ sâu. Giới hạn không phải số nguyên từ 1 trở lên sẽ được báo và đường nối vẫn tiếp tục thử lại, vì lặng lẽ bỏ qua nó sẽ để kẹt một đường nối mà có người đã bảo dừng.
