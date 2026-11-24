---
title: "Ghi chú phát hành: HotLoop Cascade 1.6.0"
description: "HotLoop Cascade 1.6.0 có gì, điều gì thay đổi khi nâng cấp và nên đọc gì trước khi động vào một nhà máy đang chạy."
sidebar:
  label: "1.6.0"
---

## Đây là gì

1.6.0 là bản mà Cascade thôi chỉ là nơi workflow chạy và trở thành nơi con người, mô hình và các máy chủ khác cùng tham gia. Một lần chạy có thể dừng lại và hỏi một người trên điện thoại. Một lần chạy có thể hỏi một mô hình của chính bạn. Workflow của bạn có thể nằm trong Git, và một phiên bản sản xuất có thể từ chối bị sửa tay. Và mọi API web đều có thể thành các bước từ một tệp. Engine, định dạng tệp và mọi thứ còn lại vẫn như 1.5.1.

## Hỏi một người, từ điện thoại

Bước Yêu cầu phê duyệt mới dừng lần chạy và chờ. Đặt `execution.approvalUrl` vào một thông báo đẩy, người nhận chạm vào, đọc những gì bạn viết, điền một biểu mẫu nhỏ nếu bạn tạo, rồi bấm Phê duyệt hoặc Từ chối. Trang đơn giản, nhanh, không đòi đăng nhập trừ khi bạn yêu cầu, và nói ngôn ngữ của trình duyệt trong cả mười bốn ngôn ngữ. Lần chạy tiếp tục từ cổng Đã phê duyệt hoặc Bị từ chối, kèm ai đã trả lời, khi nào và nói gì. Mỗi câu trả lời là một bản ghi: trong trình chỉnh sửa trên lần chạy, trong API tại `GET /api/v1/approvals`, trong máy chủ MCP là `list_approvals`, và trong nhật ký kiểm toán. Cho bước yêu cầu tài khoản đã đăng nhập thì nó chỉ nhận câu trả lời từ những tài khoản bạn liệt kê. Một liên kết chỉ dùng được một lần. Chờ không tốn gì, nên một câu trả lời có thể đến sau một tuần và vẫn qua được mọi lần khởi động lại.

## Hỏi một mô hình

Hai bước mới, AI: hỏi một mô hình và AI: chạy một tác tử. Mô hình là của bạn: một thông tin xác thực trỏ tới máy chủ bạn tự chạy (Ollama, vLLM, llama.cpp) hoặc một dịch vụ lưu trữ mà bạn có khóa, theo giao thức của OpenAI hoặc của Anthropic. Không gì đi tới nơi mà thông tin xác thực không chỉ định, không có dịch vụ lưu trữ nào, và mọi lệnh gọi đều đi qua chính sách lưu lượng ra như mọi lệnh gọi khác. Hỏi một mô hình đặt câu trả lời lên mục, dạng văn bản hoặc đối tượng JSON khớp với một lược đồ bạn đưa. Chạy một tác tử đưa cho mô hình một mục tiêu và danh sách công cụ, trong đó mỗi công cụ là một workflow khác của bạn. Mô hình yêu cầu một công cụ, Cascade chạy nó, trả kết quả về, và điều này lặp lại cho tới khi mô hình trả lời hoặc hết lượt. Giữa các lượt, lần chạy chờ trong cơ sở dữ liệu, nên một công cụ chậm không chiếm worker nào.

## Workflow trong Git

Kết nối một dự án với một kho, một nhánh và một thư mục, rồi push hoặc pull. Push ghi một tệp cho mỗi workflow, đặt theo tên và mang id của nó, và commit dưới tên người đã push với thông điệp họ nhập. Pull làm dự án khớp với kho: tệp mới thành workflow (tắt cho tới khi bạn bật), tệp đã đổi thành phiên bản mới, id được giữ nên một workflow là cùng một thứ trên mọi phiên bản, và thay đổi xảy ra ở cả hai phía được báo lại và để nguyên cho tới khi bạn nói bên nào thắng. Việc xóa chỉ xảy ra khi bạn yêu cầu. Mỗi dự án có một thẻ, sáu đường dẫn API và sáu công cụ MCP. Nó nói chuyện HTTPS bằng tên người dùng và token hoặc mật khẩu giữ trong két, qua chính sách lưu lượng ra.

## Phiên bản được bảo vệ

Đặt tên cho một phiên bản (phát triển, thử nghiệm, sản xuất) và nó hiện trong một huy hiệu ở đầu mọi màn hình. Bảo vệ nó, từ Cài đặt hoặc bằng `HOTLOOP_CASCADE_PROTECTED` (giá trị `protected` của chart, không cài đặt nào hoàn tác được), thì workflow của nó không thể được tạo, sửa, khôi phục hay xóa bằng tay trong trình chỉnh sửa, API hay MCP. Workflow đến bằng cách pull từ Git. Thông tin xác thực, biến, các lần chạy và việc bật tắt một workflow vẫn mở, vì chúng khác nhau giữa các môi trường. Một phiên bản được bảo vệ chỉ pull và không push.

## Trình kết nối dạng tệp

Trình kết nối là một tệp nói API ở đâu, đăng nhập thế nào, và mỗi lệnh gọi nhận và trả gì. Đặt nó vào `HOTLOOP_CASCADE_CONNECTORS_DIR` (thư mục `connectors` trong thư mục dữ liệu) và mỗi thao tác là một bước, có biểu mẫu, loại thông tin xác thực riêng, phân trang và thử lại được sắp xếp như cách các trình kết nối tích hợp sẵn làm. Định dạng được công bố, có phiên bản và có JSON Schema (`hotloop-cascade connector schema`). Công cụ để viết một trình kết nối nằm sẵn trong tệp nhị phân: `connector init`, `validate`, `call` (thử một thao tác với API thật), cùng `index` và `install` để chia sẻ, trong đó một chỉ mục là các tệp tĩnh, mỗi tệp một mã băm. Cascade không bao giờ tải một chỉ mục bạn chưa nêu tên. Máy chủ MCP giờ có 91 công cụ.

## Quay lại

Bản phát hành này thêm ba bảng (phê duyệt và hai bảng cho Git) và các bản di chuyển chỉ đi tiến, nên quay về 1.5.1 cần bản sao lưu bạn tạo trước khi nâng cấp, không chỉ ảnh cũ. Không thứ gì đang có đổi hình dạng.
