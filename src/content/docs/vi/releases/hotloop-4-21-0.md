---
title: "Ghi chú phát hành: HotLoop core 4.21.0"
description: "HotLoop core 4.21.0 có gì mới, điều gì thay đổi khi nâng cấp và nên đọc gì trước khi đụng vào một nhà máy đang chạy."
sidebar:
  label: "4.21.0"
---

Bản phát hành này thêm đăng nhập X.509 vào máy chủ OPC UA, gỡ giới hạn mật khẩu 64 byte và tắt các chính sách bảo mật lỗi thời theo mặc định. Nó cũng mở rộng việc nhập cảnh báo từ CODESYS. Xây dựng trên [4.20.2](/vi/releases/hotloop-4-20-2/).

## Có gì thay đổi

- **Một client có thể đăng nhập vào máy chủ OPC UA bằng chứng chỉ X.509.** Quản trị viên gắn chứng chỉ công khai của client vào một người dùng HotLoop (Settings, OPC UA certificates, hoặc API, hoặc các công cụ MCP), và một client giữ khóa riêng đăng nhập là người dùng đó với quyền của người dùng đó. Thu hồi một chứng chỉ kết thúc phiên đang chạy của nó trong vòng mười giây, và mọi lần đăng nhập bằng chứng chỉ cũng như mọi lần từ chối đều có trong logbook. Nó tắt cho đến khi `HOTLOOP_OPCUA_SERVER_ALLOW_X509=true` (chart `opcuaServer.allowX509`). Driver thiết bị có thể đăng nhập theo cách tương tự với `userCertificate` và `userPrivateKey` (RSA, khóa được niêm phong như mật khẩu). Một CA tin cậy có quy tắc tên chưa được xây dựng.
- **Mật khẩu từ 65 đến 72 byte giờ đăng nhập được qua OPC UA.** Chúng luôn dùng được trong giao diện web. Thư viện mà máy chủ được xây dựng trên đó từng từ chối mọi token tên người dùng có mật khẩu quá 64 byte.
- **Các chính sách bảo mật lỗi thời `Basic128Rsa15` và `Basic256` tắt theo mặc định.** Máy chủ không còn liệt kê chúng và một client yêu cầu một chính sách theo tên bị từ chối khi kênh mở. Điều này áp dụng cho bản cài mới và cho nâng cấp. Một client cũ không nói được gì mới hơn kết nối lại với `HOTLOOP_OPCUA_SERVER_ALLOW_DEPRECATED_POLICIES=true` (chart `opcuaServer.allowDeprecatedPolicies: true`), và máy chủ nói điều đó khi khởi động. Tùy chọn tắt chúng cũng đang mở ở upstream (pull request 66).
- **Việc nhập cảnh báo từ CODESYS đọc được cảnh báo Outside range.** Export Alarms của IDE ghi `OutOfArea` cho nó, và nó được chuyển sang thành hai cảnh báo, một `lo` ở giới hạn dưới và một `hi` ở giới hạn trên. Inside the range, Change, Event và Alarm (API) được liệt kê là bị bỏ qua kèm lý do: không có gì ở đây nói chúng một cách trung thực. Trình nhập được mở rộng từ một bản xuất của mọi loại quan sát mà IDE cung cấp, được giữ làm fixture kiểm thử.

## Thay đổi API

- Mới: `GET /api/opcua/certificates`, `GET` và `POST /api/users/{username}/certificates`, `POST /api/users/{username}/certificates/{thumbprint}/revoke`, `DELETE /api/users/{username}/certificates/{thumbprint}`, tất cả `users.manage`. Năm công cụ MCP mới, tổng cộng 133.
- Một migration, 0027: bảng `user_certificates` (chỉ chứng chỉ công khai). Nó nằm trong bản sao lưu.

## Nâng cấp

Một lệnh `helm upgrade` bình thường, hoặc tự động cập nhật của Quadlet. Hãy kiểm tra trước xem có client OPC UA nào của bạn đang dùng `Basic256` hoặc `Basic128Rsa15` không (kết nối của Ignition cho thấy điều đó): client đó ngừng kết nối sau khi nâng cấp cho đến khi bạn chuyển nó sang `Basic256Sha256` hoặc đặt công tắc cũ ở trên. Rollback về bản phát hành trước chưa được thử với bảng mới có mặt.

- Cả bốn chart (`hotloop`, `hotloop-iot`, `hotloop-edge`, `hotloop-edge-relay`) đều ở 4.21.0, với mọi phiên bản trước vẫn nằm trong chỉ mục.

- Bản build này chỉ có amd64, và `stable` giữ các image arm mà nó đang có. Bản phát hành kế tiếp là một lần tăng phiên bản nhỏ để build các image arm.
