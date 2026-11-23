---
title: "Ghi chú phát hành: HotLoop Cascade 1.2.0"
description: "HotLoop Cascade 1.2.0 có gì, điều gì thay đổi khi nâng cấp và nên đọc gì trước khi động vào một nhà máy đang chạy."
sidebar:
  label: "1.2.0"
---

## Đây là gì

1.2.0 hoàn thiện danh sách công cụ của máy chủ MCP. Công cụ chạy, định dạng tệp quy trình, các màn hình và REST API vẫn như ở 1.1.1.

## Bốn công cụ

Mọi MCP trong dòng HotLoop đều đọc và ghi, và MCP của Cascade đã bỏ sót bốn route mà một khóa được phép gọi. Giờ chúng đã là công cụ, tổng cộng 83:

- `list_keys` và `revoke_key`: các khóa của người sở hữu khóa, và thu hồi một khóa. Một khóa có thể tự thu hồi chính nó, đó là việc đầu tiên mà người giữ khóa bị lộ nên làm được. Các kiểm tra riêng của route quyết định người gọi được thu hồi khóa của ai, giống như trong trình soạn thảo.
- `listen_workflow`: mở URL webhook thử nghiệm của một quy trình cho một lệnh gọi, trong 1 đến 600 giây.
- `start_oauth`: trả về địa chỉ mà một người mở để đăng nhập cho một thông tin đăng nhập OAuth2. Người đó vẫn phải đồng ý.

Mỗi công cụ đi qua route của nó, nên kiểm tra quyền, xác thực và dòng kiểm toán là của route, và một lần ghi yêu cầu lý do như mọi công cụ ghi khác.

## Những gì nằm ngoài

Mười route tự từ chối một khóa, vì chúng cần một người đã đăng nhập: tạo khóa API hoặc khóa tài khoản dịch vụ, tạo token SCIM, thêm, đổi hoặc xóa nhà cung cấp bí mật hay đích nhật ký, và mật khẩu của chính bạn. Một khóa có thể tạo khóa, hoặc đổi nơi nhật ký kiểm toán đi tới, là một khóa bị lộ tự giữ mình sống. Trang MCP có danh sách và lý do.

## Chỉ amd64, và vì sao

Bản phát hành này chỉ build cho amd64. Đa kiến trúc ra ở một lần chạy riêng, nên bản sau bản này là một lần nâng phiên bản nhỏ build cả hai.

## Nâng cấp, và quay lại

Không có migration. `helm upgrade` lên 1.2.0, hoặc để `:stable` di chuyển các unit Quadlet. Đặt lại 1.1.1 là an toàn, vì không có gì trong cơ sở dữ liệu thay đổi. Điều rollback không thể hoàn tác là những gì một tác tử đã làm với các công cụ mới.
