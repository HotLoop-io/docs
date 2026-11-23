---
title: "Ghi chú phát hành: HotLoop Cascade 1.0.1"
description: "HotLoop Cascade 1.0.1 có gì, điều gì thay đổi khi nâng cấp và nên đọc gì trước khi động vào một nhà máy đang chạy."
sidebar:
  label: "1.0.1"
---

## Đây là gì

1.0.1 sửa một lỗi trong cách đăng nhập xử lý cơ sở dữ liệu không đọc được. Ngoài ra không có gì thay đổi so với 1.0.0.

## Bản sửa

Khi cơ sở dữ liệu chập chờn, Cascade đọc "tôi không tra cứu được" thành "không hợp lệ" và trả 401. Kiểm tra phiên, khóa API, token SCIM và người dùng của một khóa đều làm vậy, và kiểm tra phiên còn xóa cả cookie, nên một lần gián đoạn ngắn cũng đăng xuất mọi người. Giờ chỉ phiên không tồn tại hoặc thuộc người dùng đã bị vô hiệu hóa mới là 401. Kho không đọc được sẽ trả 503 kèm Retry-After, và cookie được giữ lại.

Yếu tố thứ hai cũng gặp vấn đề tương tự. Trong lúc gián đoạn, một mã xác thực, mã khôi phục hoặc passkey đúng bị trả lời như mã sai, có thể khiến một người bị khóa khỏi chính tài khoản của mình. Các bước đó giờ trả 503 khi kho hoặc máy chủ lỗi và chỉ giữ 401 cho lần từ chối thật sự: mã sai, passkey thất bại, yêu cầu hết hạn. Đăng nhập bằng passkey cũng không còn đọc việc tra cứu người dùng thất bại thành "không tài khoản nào có passkey đó".

## Nâng cấp, và quay lại

Không có migration. `helm upgrade` lên 1.0.1, hoặc để `:stable` di chuyển các unit Quadlet. Vì không có gì trong cơ sở dữ liệu thay đổi, đặt lại 1.0.0 là an toàn. Sao lưu trước bất kỳ lần cập nhật nào vẫn là thói quen tốt.
