---
title: "Ghi chú phát hành: HotLoop Cascade 1.4.2"
description: "HotLoop Cascade 1.4.2 có gì, điều gì thay đổi khi nâng cấp và nên đọc gì trước khi động vào một nhà máy đang chạy."
sidebar:
  label: "1.4.2"
---

## Đây là gì

1.4.2 mang đến cho trang đăng nhập diện mạo gọn gàng hơn. Công cụ chạy, định dạng tệp, REST API, máy chủ MCP và mọi màn hình khác vẫn như ở 1.4.1.

## Trang đăng nhập

Trang giờ là một thẻ duy nhất trên nền dịu, với biểu tượng và tên HotLoop Cascade căn giữa phía trên. Đăng nhập là nút màu cam duy nhất. Đăng nhập bằng passkey và đăng nhập một lần là các nút thường bên dưới, và nút đăng nhập một lần hiện biểu tượng Vord khi Vord là nhà cung cấp. Nó trông như nhau ở chế độ sáng và tối và trên điện thoại, còn các nút ngôn ngữ và giao diện vẫn ở góc trên bên phải.

Cách đăng nhập không đổi: cùng các trường, cùng các lối vào, thiết lập lần đầu, đăng nhập bằng thư mục, yếu tố thứ hai, thêm passkey hoặc ứng dụng xác thực. Trang giữ nguyên các id của nó, nên trình quản lý mật khẩu và dấu trang hoạt động như trước.

## Chỉ amd64, và vì sao

Bản phát hành này chỉ build cho amd64. Đa kiến trúc ra ở một lần chạy riêng, nên bản sau bản này là một lần nâng phiên bản nhỏ build cả hai. `stable`, `latest`, `1.4` và `1` liệt kê image amd64 mới bên cạnh image arm64 mà chúng đã trỏ tới.
