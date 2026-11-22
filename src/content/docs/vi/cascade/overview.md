---
title: "HotLoop Cascade: quy trình tự động"
description: "Quy trình giúp nhà máy trò chuyện với mọi hệ thống khác, có điểm kiểm tra nên thử lại chỉ là một dòng trong cơ sở dữ liệu. Chỉ một tệp nhị phân Go tĩnh."
---

Cascade giúp nhà máy trò chuyện với mọi hệ thống khác. Một báo động, một webhook, một lịch chạy, một dòng mới hay một loạt tin MQTT sẽ thành một lô phần tử, và các phần tử chạy qua những bước gọi hệ thống thật bằng thông tin đăng nhập thật. Nếu một API ngừng hoạt động hoặc máy khởi động lại giữa chừng, công việc vẫn hoàn tất, vì mỗi bước đều có điểm kiểm tra và một lần thử lại chỉ là một dòng trong cơ sở dữ liệu.

Đó là một tệp nhị phân Go tĩnh. SQLite trên Raspberry Pi, hoặc Postgres với bao nhiêu worker tùy bạn trên k3s. Postgres cũng chính là hàng đợi, nên không có Redis nào phải trông chừng trên cụm của nhà máy.

## Những gì nó không làm

**Nó không ghi vào thiết bị của bạn.** Cascade chỉ đọc và đăng ký theo dõi. Mọi thứ làm van chuyển động hay đổi giá trị đặt đều đi qua cổng ghi của HotLoop, nên kiểm toán của cổng thấy mọi lần ghi, bất kể quy trình nào khởi động nó. Một công cụ quy trình có cửa sau vào PLC là cách khiến nhật ký kiểm toán không còn trung thực.

**Nó không chạy JavaScript trong các trường của bạn.** Biểu thức trường dùng expr, cùng ngôn ngữ nhỏ mà các tự động hóa của HotLoop dùng. Chúng không thể chạm vào hệ điều hành, mạng hay hệ thống tệp, và luôn kết thúc. JavaScript chỉ có ở đúng một nơi, bước Code, và nó chạy trong một tiến trình riêng bị nhốt, không có bí mật, không có mạng, không có hệ thống tệp. Giữ nó ngoài mọi trường khác cũng là giữ việc thực thi mã từ xa ngoài các trường đó.

**Nó không khóa gì cả.** SSO, MFA bắt buộc, RBAC, kiểm toán, lịch sử phiên bản, khóa API có phạm vi và worker HA đều nằm trong cùng một tệp nhị phân. Không có đoạn kiểm tra giấy phép nào trong mã.

**Nó không gửi dữ liệu về nhà.** Không có máy chủ giấy phép, không phụ thuộc vào đám mây. Dữ liệu đo từ xa là tùy chọn bật, mặc định tắt, và được ghi tài liệu đến từng trường khi có.

## Tiếp theo đi đâu

[Chạy Cascade](/vi/cascade/running/), chạy nó [bằng Podman Quadlet](/vi/cascade/quadlet/), hoặc đọc [lộ trình của Cascade](/vi/cascade/roadmap/). Đang dùng tại nhà máy? [Dùng HotLoop trong doanh nghiệp](/vi/business/) nói về giấy phép và cách liên hệ với chúng tôi.
