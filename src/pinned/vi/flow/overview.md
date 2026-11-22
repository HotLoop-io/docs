---
title: "HotLoop Flow, công cụ luồng trực quan"
description: "Công cụ luồng trực quan cho nhà máy trong một tệp nhị phân Go, mỗi hàng đợi có trần, bản triển khai xem xét được, luồng Node-RED hiện có nạp nguyên vẹn."
---

**Đấu dây cho nhà máy. Xem xét nó như xem xét mã.**

HotLoop Flow là công cụ luồng trực quan cho nhà máy, viết bằng Go. Bạn đấu nối cảm biến, broker, PLC và cơ sở dữ liệu trên một canvas, và nó chạy các đường nối đó trong một tệp nhị phân tĩnh đủ nhỏ cho một chiếc Pi, với bộ lập lịch không đổ khi một cảm biến bắt đầu gửi nhanh hơn thứ đọc nó.

Trong một đêm tồi tệ, điều đó có nghĩa là:

- **Mỗi hàng đợi đều có trần, và mỗi thông điệp không vừa đều được đếm.** Một cảm biến nhanh đặt trước một historian chậm sẽ dồn lại, chặn hoặc bỏ theo chính sách bạn đã chọn, và điều đó hiện trên biểu đồ trước khi hiện ra thành một OOM kill mà nhật ký không có gì.
- **Historian ngừng một giờ không làm bạn mất một giờ.** Đánh dấu một đường nối là bền vững, và khi nút phía sau ngừng nhận thông điệp, chúng được ghi xuống đĩa theo thứ tự, và vẫn còn đó sau một lệnh `kill -9`. Khi mọi thứ khỏe, không có gì được ghi. [Lưu và chuyển tiếp](/vi/flow/store-and-forward/) đã được kiểm chứng với một InfluxDB thật bị dừng mười phút.
- **Mỗi nút chạy riêng.** Một goroutine cho mỗi nút, nên một nút Function đang xử lý một tải lớn chỉ tốn của bạn một lõi, không ảnh hưởng đến trình soạn thảo và mọi luồng khác trên máy.
- **Tệp luồng là thứ xem xét được.** Nó được nạp và lưu từng byte một, sửa một thuộc tính chỉ là một diff một dòng, và mỗi lần lưu đều nguyên tử với ba bản sao lưu phía sau. Mỗi lần triển khai là [một bản ghi](/vi/flow/deploys/): ai, khi nào, vì sao và đúng từng byte, và hai bản ghi bất kỳ có thể [so sánh từng nút](/vi/flow/deploys/#the-diff-reads-like-a-review), trong API, trên dòng lệnh và trong `git diff`. Bản nào cũng có thể [khôi phục](/vi/flow/deploys/#put-it-back), gồm cả thông tin xác thực.
- **Nó không khởi động khi chưa khóa.** Thiếu xác thực là lỗi khi khởi động, không phải giá trị mặc định. Nút `exec` được giao ở trạng thái tắt, các nút tệp bị giới hạn trong thư mục dữ liệu, và thông tin xác thực được mã hóa AES-256-GCM dưới khóa Argon2id.

Nó cũng chạy nguyên vẹn các luồng hiện có của bạn. Phần đó ở [bên dưới](/vi/flow/migrating-from-node-red/), vì đó là một tính năng, không phải điểm chính.

Bản phát hành hiện tại là `{{flow}}`. Image là `ghcr.io/hotloop-io/hotloop-flow:{{flow}}` cho amd64 (arm64 có trong bản vá kế tiếp), kho Helm là `https://hotloop.io/hotloop-flow/`, và [Triển khai Flow](/vi/flow/deploying/) có Kubernetes, Podman và Quadlet. Có 117 loại nút cho thông điệp và 39 loại cho sơ đồ FlowLab. Dùng tại nhà và trong phòng thí nghiệm là miễn phí, trường học, tổ chức phi lợi nhuận và cơ quan nhà nước cũng vậy, và dùng qua EmberNet, một nền tảng đối tác, kể cả dùng cho doanh nghiệp, không bị hạn chế, theo HotLoop Source License Agreement.

## Các con số

Chỉ có số tuyệt đối, để bạn kiểm tra trên phần cứng của mình. Mỗi mục chạy ba lần, và khoảng giá trị được in ra.

| Chỉ số | Kết quả |
|---|---|
| Tệp nhị phân, linux/amd64, tĩnh | **41.7 MB** |
| Image, amd64 | **45.64 MB** |
| Từ lúc khởi động đến khi trả lời yêu cầu đầu tiên | **0.05 s** |
| RSS, khi nhàn rỗi | **16.4 đến 16.7 MiB** |
| RSS, đỉnh dưới tải HTTP bên dưới | **26.4 đến 28.5 MiB** |
| HTTP, luồng năm nút, 8 kết nối | **13.0k đến 15.3k req/s** |
| Độ trễ HTTP p50 / p99 | **0.39 đến 0.41 ms / 1.78 đến 4.03 ms** |
| Engine, chuỗi năm nút, không có I/O | **2.20 đến 3.11 µs mỗi thông điệp**, cấp phát 3.9 KB |

Hãy biết những con số này không phải là gì. Con số HTTP cố ý đi qua toàn bộ ngăn xếp HTTP, vì đó là thứ mà một client của luồng bạn nhìn thấy. Và khi bão hòa, mọi runtime đều xếp hàng và việc xếp hàng quyết định phần đuôi, nên p99 dao động giữa các lần chạy nhiều hơn p50.

### Trên Raspberry Pi 5

Cùng luồng và cùng lệnh, ngày 2026-10-22, trên một Raspberry Pi 5 Model B (8 GB, bốn lõi Cortex-A76) với xung nhịp giới hạn ở 2.0 GHz, chạy image arm64 đã phát hành `2.2.0` dưới dạng một pod, không có gì khác trên nút ngoài các DaemonSet của cụm. Ba lần chạy, khoảng giá trị được in ra.

| Chỉ số | Kết quả |
|---|---|
| Từ lúc khởi động đến khi trả lời yêu cầu đầu tiên | **0.10 đến 0.46 s** |
| RSS, khi nhàn rỗi | **88.0 đến 88.3 MiB** |
| RSS, đỉnh dưới tải HTTP | **40.3 đến 40.5 MiB** |
| HTTP, luồng năm nút, 8 kết nối, 30 s | **13.2k đến 13.4k req/s** |
| Độ trễ HTTP p50 / p99 | **0.48 ms / 2.72 đến 2.78 ms** |
| Engine, chuỗi năm nút, không có I/O | **7.74 đến 8.15 µs mỗi thông điệp**, cấp phát 4.0 KB |
| HTTP, cùng lệnh giữ trong 600 s | **11.4k req/s**, p50 0.58 ms, p99 3.00 ms |

Dòng cuối là dòng trung thực cho một máy luôn có tải. Bo mạch chạm ngưỡng nhiệt mềm trong chưa đầy một phút, bị giảm xung từ khoảng phút thứ hai và nằm ở 83 đến 86 C với xung nhịp 1.5 đến 1.7 GHz trong phần còn lại. [Trang benchmark](/vi/flow/benchmarks/#results-on-a-raspberry-pi-5) có toàn bộ lần chạy trên Pi.

[Trang benchmark](/vi/flow/benchmarks/) có phương pháp và các lưu ý.

Bạn dùng nó ở nhà máy? [Dùng HotLoop trong doanh nghiệp](/vi/business/) nói về giấy phép và cách liên hệ với chúng tôi.
