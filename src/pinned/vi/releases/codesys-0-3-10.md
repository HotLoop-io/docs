---
title: "Ghi chú phát hành HotLoop for CODESYS 0.3.10"
description: "Chart 0.3.10 của HotLoop for CODESYS: bao bọc HotLoop 4.24.0 và chạy provisioner 0.4.1, nên hồ sơ có thể mang nhiều màn hình."
sidebar:
  label: "0.3.10"
---

## Có gì thay đổi

0.3.10 có trong chỉ mục `{{codesysChartRepo}}`, công bố ngày 2026-11-23. Đây là bản nên cài, và nó mang mọi thứ 0.3.9 đã thêm.

- **Nó bao bọc HotLoop 4.24.0,** hiển thị các cảnh báo riêng của một PLC CODESYS trong danh sách cảnh báo và vẽ màn hình dưới dạng P&ID.
- **Nó chạy provisioner 0.4.1.** Hồ sơ nhận một danh sách màn hình bên cạnh màn hình đơn, nên một dự án có nhiều trang WebVisu trở lại đầy đủ.
- **Hồ sơ ví dụ kết nối ngay.** Các tag của nó dùng chỉ số trường của OPC UA PubSub, nên thiết bị nó tạo không thử lại kết nối.
- **Chart bỏ các kênh cảnh báo Gotify và Discord cho đến khi chúng có thông tin xác thực,** nên pod khởi động trên một lần cài đơn giản. Đặt `enabled` của một kênh thành true cùng token hoặc URL của nó để dùng.

Điều này có nghĩa với bạn: hãy cài bản này. Nâng cấp từ 0.3.8 giữ thiết bị và các tag.

## Đã kiểm tra những gì

Cài từ chỉ mục trên một cụm thật với hồ sơ gồm một bên lắng nghe OPC UA PubSub và hai màn hình: provisioner tạo thiết bị, hai tag của nó và cả hai màn hình mà không cần thao tác tay, thiết bị đọc là đã kết nối, và nhật ký HotLoop không có cảnh báo hay lỗi. Xóa cả hai pod đưa chúng trở lại tự động với thiết bị vẫn được cấu hình, nâng cấp từ [0.3.8](/vi/releases/codesys-0-3-8/) giữ thiết bị và các tag, và cài không hồ sơ chỉ cho HotLoop.

Ảnh 4.24.0 được xây dựng cho amd64, nên trên nút arm64 hãy ghim HotLoop vào một nút amd64.
