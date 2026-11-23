---
title: "Hiện trạng của Cascade"
description: "Cascade đã phát hành: những gì có trong đó, những gì chưa có, và nơi đặt image cùng chart."
---

:::note[Có cả những gì sắp tới]
Trang này cũng nói về một vài thứ mới hơn HotLoop Cascade 1.4.2, bản phát hành mới nhất. Một số phần có thể chưa có trong bản bạn đã cài. [Ghi chú phát hành](/vi/releases/) cho biết điều gì đã thay đổi.
:::

1.5.0 là bản phát hành ra hôm nay, còn 1.4.2, 1.4.1, 1.4.0, 1.3.1, 1.3.0, 1.2.1, 1.2.0, 1.1.1, 1.1.0, 1.0.2, 1.0.1 và 1.0.0 là mười hai bản trước nó. 1.0.0 là bản đầu tiên có phần danh tính và quản trị, mỗi phần đều được thử với máy chủ thật mà nó giao tiếp: SAML, LDAP và Active Directory, SCIM, vai trò tùy chỉnh, bí mật bên ngoài, chuyển tiếp nhật ký, biến, thư mục, thống kê, chú thích cho lần chạy, chính sách che dữ liệu, và kho blob S3 và Azure. Nó cũng có trình soạn thảo mới, nên mỗi tính năng trên đều có màn hình riêng. 1.0.1 sửa một lỗi đăng nhập: khi không đọc được cơ sở dữ liệu, Cascade trả lời "chưa đăng nhập" và xóa cookie, nên một sự cố ngắn khiến mọi người bị đăng xuất và có thể biến một yếu tố thứ hai đúng thành mã sai. Giờ nó báo hãy thử lại và giữ nguyên phiên. 1.0.2 cho phép một quy trình ký và xác minh bằng khóa HMAC lưu như thông tin đăng nhập, và cho phép một biểu mẫu công khai trên trang web khác gọi một webhook từ trình duyệt. 1.1.0 thêm máy chủ MCP và những màn hình mà trình soạn thảo còn thiếu: thông tin đăng nhập, dự án, người dùng, nhật ký kiểm toán, cài đặt và tài khoản của bạn, với đăng nhập giờ là trang riêng của trình soạn thảo. 1.1.1 là 1.1.0 có thêm image arm64. 1.2.0 trao cho máy chủ MCP bốn công cụ cuối cùng, và 1.2.1 là 1.2.0 có thêm image arm64. 1.3.0 đưa trình soạn thảo sang tiếng Anh và mười ba ngôn ngữ khác. 1.3.1 là 1.3.0 có thêm image arm64. 1.4.0 chờ cơ sở dữ liệu khi khởi động, giữ các lần chạy đã xong trong khoảng thời gian bạn đặt và dọn tệp của chúng, có thể giới hạn tần suất gọi của một khóa API, và sao lưu cũng như khôi phục. 1.4.1 sửa một điều trên trang Cài đặt. 1.4.2 cho trang đăng nhập một diện mạo gọn gàng hơn. 1.5.0 cho phép chủ sở hữu xóa một người, từ Người dùng, API và máy chủ MCP. Không có gì cần di chuyển giữa 1.0.0 và 1.5.0.

Những gì chưa có (quản lý mã nguồn bằng Git và môi trường, thêm trình kết nối, và các bước AI) nằm trong lộ trình.

Kho mã là riêng tư. Image và chart là công khai và tải về không cần đăng nhập. Image là `ghcr.io/hotloop-io/hotloop-cascade`, với các tag `1.5.0`, `1.4`, `1`, `latest` và `stable`, cho amd64 và arm64.
