---
title: "Ghi chú phát hành: HotLoop Cascade 1.3.0"
description: "HotLoop Cascade 1.3.0 có gì, điều gì thay đổi khi nâng cấp và nên đọc gì trước khi động vào một nhà máy đang chạy."
sidebar:
  label: "1.3.0"
---

## Đây là gì

1.3.0 đưa trình soạn thảo lên 14 ngôn ngữ: tiếng Anh, Tây Ban Nha, Pháp, Ý, Đức, Na Uy Bokmål, Bulgaria, Hy Lạp, Hàn, Nhật, Việt, Hindi, Trung giản thể và Ả Rập. Công cụ chạy, định dạng tệp quy trình, REST API và máy chủ MCP vẫn như ở 1.2.1.

## Các ngôn ngữ

- Bộ chọn ngôn ngữ nằm trên thanh trên cùng của trình soạn thảo và trên trang đăng nhập. Lựa chọn được lưu trong trình duyệt, và lần truy cập đầu tiên theo ngôn ngữ của trình duyệt.
- Mọi màn hình đều được dịch: quy trình, các lần chạy, thống kê, biến, thông tin đăng nhập, dự án, người dùng, vai trò, nhật ký kiểm toán, cài đặt, tài khoản của bạn, bí mật, truyền nhật ký và trình soạn thảo bước. Tiêu đề các bước và phần trợ giúp của chúng, các loại thông tin đăng nhập, và các thông báo từ chối mà máy chủ gửi khi một lần lưu, xóa hoặc đăng nhập bị từ chối cũng vậy.
- Ngày, số, khoảng thời gian và danh sách lấy từ định dạng riêng của trình duyệt cho ngôn ngữ bạn chọn. Tiếng Ả Rập được viết từ phải sang trái, còn canvas, mã và biểu thức vẫn từ trái sang phải. Tiếng Ả Rập dùng các chữ số từ 0 đến 9 và lịch Gregory.
- Tên sản phẩm, tên nút, tên giao thức và giá trị ví dụ vẫn giữ tiếng Anh ở mọi ngôn ngữ. Thông báo về cách người vận hành phiên bản đã thiết lập thư mục, nhà cung cấp SAML hoặc OpenID, kho bí mật hay tệp khóa được hiển thị đúng như máy chủ đã viết, vì người vận hành tìm kiếm đúng đoạn văn bản đó.
- Các từ lấy từ bảng thuật ngữ HotLoop dùng chung. Những dòng mà người bản ngữ nên xác nhận trước được liệt kê trong `_review.json` của từng ngôn ngữ, dưới `web/src/i18n/locales`. Chưa có người đọc bản ngữ các ngôn ngữ này xem lại chúng.
- Một ngôn ngữ chỉ được đưa ra khi mọi dòng của nó đã có. Quá trình build kiểm tra mỗi ngôn ngữ có đủ mọi khóa tiếng Anh, các chỗ giữ chỗ và thẻ được giữ nguyên, và dạng số nhiều đúng. Một bài kiểm tra Go giữ các từ của bước bằng tiếng Anh và thông báo máy chủ khớp với những gì máy chủ có thể nói, nên một bước hoặc lời từ chối mới không thể ra mà không có dòng để dịch.

## Cũng trong bản phát hành này

- Bài kiểm tra của trình soạn thảo xác nhận các tệp đã build không bao giờ trỏ tới host khác giờ cho phép bốn địa chỉ ví dụ (`https://ntfy.sh`, `https://example.com`, `https://hotloop.plant` và `http://hotloop:8080`). Chúng xuất hiện trong văn bản trợ giúp của các bước, giờ được đóng gói trong trình soạn thảo cho mọi ngôn ngữ, và là những từ trong một câu mà không gì tải về. Bài kiểm tra trình duyệt vẫn thất bại nếu trình soạn thảo yêu cầu bất cứ thứ gì từ host khác.
- Trình duyệt kiểm thử có phông Noto cho tiếng Hàn, Nhật, Trung và Hindi, nên các màn hình đó vẽ ra chữ chứ không phải ô trống.
- Trình hỗ trợ kiểm thử OpenBao thử lại một lần ghi khi OpenBao báo một mount key-value mới vẫn đang nâng cấp (26e1e13).
- HotLoop LLC được nêu là bên cấp phép và người bảo trì của Cascade (0ea9cd5).

## Chỉ amd64, và vì sao

Bản phát hành này chỉ build cho amd64. Đa kiến trúc ra ở một lần chạy riêng, nên bản sau bản này là một lần nâng phiên bản nhỏ build cả hai. `stable`, `latest`, `1.3` và `1` liệt kê image amd64 mới bên cạnh image arm64 mà chúng đã trỏ tới.

## Một vấn đề đã biết

Trong bản cài đặt tách (các pod máy chủ, worker và webhook trên PostgreSQL), các pod khởi động trước khi tên cơ sở dữ liệu được phân giải và khởi động lại hai ba lần trước khi sẵn sàng. Chúng vẫn lên được và bản cài đặt vẫn qua, nhưng ồn ào. 1.2.1 cũng vậy, nên đây không phải điều mới. Cách sửa là kết nối có thử lại cho đến khi cơ sở dữ liệu sẵn sàng, và nó có trong bản phát hành tiếp theo.

## Nâng cấp, và quay lại

Không có migration. `helm upgrade` lên 1.3.0, hoặc để `:stable` di chuyển các unit Quadlet. Đặt lại 1.2.1 là an toàn, vì không có gì trong cơ sở dữ liệu thay đổi. Ngôn ngữ đã chọn nằm trong trình duyệt, nên quay lại chỉ mất bộ chọn.
