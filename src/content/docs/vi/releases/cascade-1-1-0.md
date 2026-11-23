---
title: "Ghi chú phát hành: HotLoop Cascade 1.1.0"
description: "HotLoop Cascade 1.1.0 có gì, điều gì thay đổi khi nâng cấp và nên đọc gì trước khi động vào một nhà máy đang chạy."
sidebar:
  label: "1.1.0"
---

## Đây là gì

1.1.0 mang đến cho Cascade một máy chủ MCP và những màn hình mà trình soạn thảo còn thiếu, đồng thời chuyển đăng nhập vào trong trình soạn thảo. Công cụ chạy, định dạng tệp quy trình và REST API vẫn như ở 1.0.2.

## Máy chủ MCP

Nó ở `/mcp`, cùng địa chỉ với API, được bật sẵn và có ghi. Mọi MCP trong dòng HotLoop đều đọc và ghi, và Cascade là cái cuối cùng chưa có MCP nào.

Một tác tử đăng nhập bằng khóa API và nhận được những gì người giữ khóa đó có thể làm, thu hẹp theo phạm vi của khóa. Có 79 công cụ, và mỗi công cụ là một route của REST API: một lệnh gọi đi qua trình xử lý của chính route đó, nên kiểm tra quyền, xác thực, ghi và dòng kiểm toán đều là của route. Không có gì được sao chép vào máy chủ MCP, nên không gì có thể lệch, và không gì bị bỏ ra ngoài, nên không gì bị bỏ qua.

- Một công cụ thay đổi thứ gì đó yêu cầu một `reason`, và nhật ký kiểm toán lưu nó cạnh thay đổi, cùng khóa và tên mà máy khách tự đặt.
- Bí mật của một thông tin đăng nhập không bao giờ được trả lại, cho bất kỳ ai. Thông tin đăng nhập tạo qua MCP có bí mật được niêm phong ngay khi chúng đến.
- `HOTLOOP_CASCADE_MCP` và `HOTLOOP_CASCADE_MCP_WRITES` là các công tắc của bản triển khai, cả hai đều bật theo mặc định. Không công cụ hay route API nào có thể đổi chúng, nên một tác tử có thể sửa cài đặt của phiên bản vẫn không thể bật lại việc ghi.
- Các route tự từ chối một khóa (tạo khóa API, token SCIM, nhà cung cấp bí mật và đích nhật ký) không phải là công cụ, vì một khóa có thể tạo khóa là một khóa bị lộ tự giữ mình sống. Trang MCP liệt kê chúng cùng mọi công cụ và quyền mà từng công cụ yêu cầu.

## Các màn hình

Thông tin đăng nhập, Dự án, Tài khoản của bạn và, cho chủ sở hữu và quản trị viên, Cài đặt, Người dùng và nhật ký kiểm toán. Mỗi màn hình theo cùng quyền như API: mỗi người chỉ được thấy những gì vai trò của họ cho phép, và máy chủ vẫn từ chối phần còn lại.

- **Thông tin đăng nhập** được tạo, mở, thay đổi, chia sẻ với các dự án khác và xóa. Bí mật được nhập một lần và màn hình chỉ cho biết là đã đặt.
- **Dự án** có các thành viên và vai trò của họ, cùng các khóa tài khoản dịch vụ mà một tích hợp thường trực dùng để đăng nhập, chỉ hiện một lần.
- **Tài khoản** tạo và thu hồi các khóa API của bạn, thứ mà API và MCP dùng để đăng nhập, và đổi mật khẩu.
- **Người dùng** tạo người và tắt hoặc bật họ. **Nhật ký kiểm toán** được đọc, lọc và kiểm tra xem có bị can thiệp không. **Cài đặt** có yêu cầu yếu tố thứ hai và quy trình xử lý lỗi.

Đăng nhập giờ là trang riêng của trình soạn thảo, tại `/login`, với màu của trình soạn thảo, sáng và tối, trên điện thoại cũng như trên máy để bàn. Nó làm mọi thứ trang cũ từng làm: thiết lập lần đầu, mật khẩu, tài khoản thư mục, đăng nhập một lần, passkey, yếu tố thứ hai và mã khôi phục.

## Chỉ amd64, và vì sao

Bản phát hành này chỉ build cho amd64. Đa kiến trúc ra ở một lần chạy riêng, nên bản sau bản này là một lần nâng phiên bản nhỏ build cả hai. Đến lúc đó, `stable`, `latest` và các thẻ ngắn liệt kê image amd64 này bên cạnh image arm64 mà chúng đã trỏ tới, nên máy arm vẫn kéo được. Thẻ phiên bản, `1.1.0`, chỉ có amd64.

## Nâng cấp, và quay lại

Không có migration. `helm upgrade` lên 1.1.0, hoặc để `:stable` di chuyển các unit Quadlet. Đặt lại 1.0.2 là an toàn, vì không có gì trong cơ sở dữ liệu thay đổi. Điều rollback không thể hoàn tác là những gì một tác tử đã làm: các thay đổi của nó vẫn còn, và các dòng kiểm toán nó đã ghi vẫn nằm trong nhật ký với loại tác nhân `mcp`. Sao lưu trước bất kỳ lần cập nhật nào vẫn là thói quen tốt.
