---
title: "Ghi chú phát hành: HotLoop Cascade 1.5.0"
description: "HotLoop Cascade 1.5.0 có gì, điều gì thay đổi khi nâng cấp và nên đọc gì trước khi động vào một nhà máy đang chạy."
sidebar:
  label: "1.5.0"
---

## Đây là gì

1.5.0 cho phép chủ sở hữu xóa một người. Công cụ chạy, định dạng tệp và mọi màn hình khác vẫn như ở 1.4.2, và không có gì phải migrate.

## Xóa một người

Trước đây, cách duy nhất để gỡ một tài khoản là tắt nó, và nó nằm lại trong danh sách mãi mãi. Giờ Người dùng có nút Xóa bên cạnh Tắt, hiển thị cho chủ sở hữu với mọi người trừ chính họ, và nó hỏi trước khi làm bất cứ điều gì. Cùng lệnh gọi đó có trong REST API, `DELETE /api/v1/users/{user}`, và trong máy chủ MCP dưới tên `delete_user`, với cùng quy tắc: chỉ chủ sở hữu phiên bản, không bao giờ là tài khoản của chính bạn, và không bao giờ là chủ sở hữu cuối cùng.

Tài khoản, các phiên, passkey, danh tính đăng nhập và khóa API của nó biến mất ngay, nên mọi thứ còn đăng nhập với tư cách người đó sẽ ngừng hoạt động ở yêu cầu kế tiếp. Nhật ký kiểm toán ghi ai đã xóa ai, kèm email, vai trò và số phiên và khóa đã mất, và chuỗi của nó vẫn xác minh được.

Công việc của họ vẫn còn. Dự án cá nhân của họ trở thành một dự án chung mang tên họ kèm "(removed)" phía sau, chứa mọi quy trình, thông tin đăng nhập và lần chạy nó từng có, và chủ sở hữu cùng quản trị viên có thể chuyển bất cứ thứ gì trong đó sang dự án khác hoặc giao cho ai đó. Cùng email đó có thể dùng sau này để tạo tài khoản mới, bắt đầu với một dự án riêng.

Tắt không đổi và là lựa chọn đúng khi bạn muốn giữ tài khoản. Một người mà nhà cung cấp danh tính của bạn gỡ qua SCIM vẫn bị tắt và ẩn, chứ không bị xóa.

## Quay lại

Không có migration, nên image trước chạy được trên cùng dữ liệu. Một tài khoản đã xóa không quay lại; hãy khôi phục bản sao lưu bạn đã làm trước khi xóa nếu cần.

## Chỉ amd64, và vì sao

Bản phát hành này chỉ build cho amd64. Đa kiến trúc ra ở một lần chạy riêng, nên bản sau bản này là một lần nâng phiên bản nhỏ build cả hai. `stable`, `latest`, `1.5` và `1` liệt kê image amd64 mới bên cạnh image arm64 mà chúng đã trỏ tới.
