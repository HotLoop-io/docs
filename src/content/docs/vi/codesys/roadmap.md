---
title: "Lộ trình của HotLoop for CODESYS"
description: "Những gì HotLoop for CODESYS đã xây dựng, xuất bản và chạy trên phần cứng thật."
sidebar:
  label: "Lộ trình"
editUrl: false
---

Đây là danh sách những gì đã xong và những gì còn lại, theo thứ tự được làm. Nó không hứa điều gì không có trong mã hay trong kế hoạch kiểm thử, và [Hiện trạng](/vi/codesys/where-it-stands/) cho biết nó đã được chạy đến đâu.

## Đã xây dựng

- [x] Một chart bao quanh HotLoop Edge với mặc định cho runtime trên một nút: SQLite, một replica, các dung sai giữ cả hai pod khi mất mặt phẳng điều khiển.
- [x] Một provisioner áp hồ sơ và giữ cho nó đúng, với một bản sửa đổi bảo vệ những gì một người đã thay đổi.
- [x] Một hồ sơ mang danh sách thiết bị thuộc bất kỳ giao thức nào HotLoop nói được, để một listener quay lại đã được cấu hình mà không cần PLC.
- [x] Thiết bị, tag, cảnh báo và màn hình được tạo không cần thao tác tay, với runtime CODESYS Control for Linux SL 4.22.0.0 trong một container.
- [x] Phục hồi sau khi runtime khởi động lại không cần can thiệp, khoảng 88 giây.
- [x] Một lần đăng nhập có chữ ký từ bảng điều khiển EmberCORE, cùng các trường hợp bị từ chối.

## Đã phát hành

- [x] HotLoop 4.22.0, bản phát hành mà chart bao bọc.
- [x] Chart được xuất bản tại `https://hotloop.io/hotloop-codesys/`, mới nhất là 0.3.8.
- [x] Ảnh provisioner công khai, nên kéo về được mà không cần đăng nhập, 0.3.3.
- [x] Ảnh provisioner đa kiến trúc, amd64 và arm64, từ 0.3.3 và chart 0.3.8.
- [x] Hai listener OPC UA PubSub trên một cổng UDP, với HotLoop 4.22.0 và chart 0.3.7.
- [x] [Ghi chú phát hành](/vi/releases/codesys-0-3-8/) cho mọi chart, từ 0.3.0 đến 0.3.8.

## Đã chứng minh trên phần cứng không có hệ điều hành

- [x] Đã chạy trên phần cứng không có hệ điều hành (2026-11-17), gồm một lần cài từ trang App Store thật như nhân viên vẫn làm, k3s v1.35.7, một nút thật sự mất liên kết với mặt phẳng điều khiển mà các pod vẫn được giữ, một lần tải xuống từ IDE CODESYS trong khi runtime vẫn chạy, một runtime trên mạng riêng của máy chủ bên cạnh pod HotLoop trên một nút, và một runtime bật quản lý người dùng với endpoint OPC UA được bảo vệ bằng chứng chỉ.

## Cần xây dựng

- [ ] Nhiều hơn một màn hình trong một hồ sơ.
