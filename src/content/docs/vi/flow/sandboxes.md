---
title: "Hai sandbox trong HotLoop Flow"
description: "Nút Function và sandbox WebAssembly được rào lại như thế nào, mỗi bên chạm được gì và plugin chạy thế nào trong sandbox thứ hai."
---

Nút Function chạy trên trình thông dịch JavaScript (xem [Tư thế bảo mật](/vi/flow/security/)). Một lần gọi tốn 11.6 đến 13.7 µs. Đó không phải ranh giới đối với bộ nhớ: một hàm cấp phát trong vòng lặp làm heap Go phình ra cho đến khi pod chết, và trình thông dịch JavaScript chỉ làm được một việc là đặt giới hạn thời gian theo đồng hồ thực.

Cái này tốn 184 đến 196 µs mỗi lần gọi, gấp mười lăm đến mười sáu lần một lần gọi trình thông dịch JavaScript. Đáng trả đúng khi bạn chạy mã mà bạn không hoàn toàn tin, và không đáng trong trường hợp khác.

Một luồng chạy khách WASM thông qua plugin: một mô-đun đã ký với bộ mô tả mà trình soạn thảo dùng để vẽ hộp thoại của nó, không được truy cập máy chủ trừ khi nó yêu cầu và bạn đồng ý. Bộ nhớ bị giới hạn theo từng nút, một thông điệp có thời gian chờ, và một khách vượt quá một trong hai sẽ bị ngắt, đến nút Catch kèm lý do và không kéo theo gì khác. Mọi thứ nằm trong [Plugin không cần npm](/vi/flow/plugins/), gồm cách tin khóa của nhà phát hành và các lời từ chối nói gì. Điều đó nghĩa là gì với bạn: thứ mà Node-RED cần npm và cả một bản cài Node.js để làm, Flow chạy như một tệp cô lập mà bạn có thể kiểm tra trước khi nạp.

Plugin có thể viết bằng Rust, TinyGo, Zig hoặc AssemblyScript thay vì JavaScript, nên phần xử lý tín hiệu mà một luồng OT thực sự cần chạy ở dạng đã biên dịch, với trần bộ nhớ mà nó không thể cãi.

ABI của khách gồm ba export, hai trong số đó là móc của bộ cấp phát, và nó nhỏ như vậy là có chủ ý. Mỗi export là bề mặt tấn công và là thêm một điều mà mọi tác giả khách phải làm đúng.

| Export | Chữ ký | Bắt buộc |
|---|---|---|
| `hotloop_flow_process` | `(ptr i32, len i32) -> i64` | có |
| `hotloop_flow_alloc` | `(size i32) -> i32` | có |
| `hotloop_flow_free` | `(ptr i32, size i32)` | không |

Kết quả `i64` đóng gói một độ lệch trong 32 bit cao và một độ dài trong 32 bit thấp, trỏ tới một phản hồi JSON trong bộ nhớ riêng của khách. Mọi thứ đi qua dưới dạng JSON, nên một khách bằng bất kỳ ngôn ngữ nào cũng tạo ra được nó mà không cần trình biên dịch lược đồ dùng chung.

Các giới hạn nhỏ có chủ ý. Cái này chạy trên phần cứng biên cạnh các luồng thực sự quan trọng, và một nút cần nhiều hơn thì nên phải nói ra:

| Giới hạn | trình thông dịch JavaScript | WASM |
|---|---|---|
| Thời gian chờ mỗi lần gọi | 5 s | 5 s |
| Trần bộ nhớ | không có gì ép buộc được | 16 MiB mỗi nút trừ khi plugin nói khác, tối đa 64 MiB trừ khi bạn nâng `plugins.maxMemoryMiB`, cứng |
| Đầu ra tối đa | 16 MiB | 8 MiB |

Cả hai runtime đều là Go thuần, không có cgo.
