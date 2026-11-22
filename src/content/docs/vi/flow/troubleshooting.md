---
title: "Khi Flow từ chối khởi động"
description: "Các lỗi khởi động mà Flow cố ý đưa ra, mỗi lỗi nghĩa là gì và cách sửa trong một dòng."
---

Ngoài các lỗi cấu hình đơn giản (gõ sai trong YAML, cổng ngoài phạm vi), nó từ chối khởi động vì năm lý do, tất cả đều có chủ ý. Mỗi lỗi in ra cách sửa thay vì dấu vết ngăn xếp, vì người đọc đang nhìn một CrashLoopBackOff và không cần các đường dẫn Go của tôi.

| Từ chối | Cách sửa |
|---|---|
| Xác thực bị tắt | Hãy cấu hình một người dùng. Hoặc, nếu mạng thực sự bị cô lập và bạn đã quyết định chịu trách nhiệm, đặt `HOTLOOP_FLOW_INSECURE=true` trong môi trường. Chỉ `auth.enabled: false` trong tệp là chưa đủ. (Đến 2.0.4, biến này không làm gì và bạn vẫn nhận lỗi từ chối này. Đã sửa ở 2.0.5.) |
| Xác thực được bật nhưng không có người dùng | Đặt `auth.users`, hoặc `HOTLOOP_FLOW_ADMIN_USER` và `HOTLOOP_FLOW_ADMIN_PASSWORD_HASH`. |
| Một `passwordHash` không phải bcrypt | Chạy `hotloop-flow hash-password`. Kiểm tra này có để mật khẩu dạng văn bản thuần không bao giờ lọt vào ConfigMap một cách vô tình. |
| Không có bí mật thông tin xác thực | Đặt `HOTLOOP_FLOW_CREDENTIAL_SECRET`. Hoặc `HOTLOOP_FLOW_ALLOW_PLAINTEXT_CREDENTIALS=true` nếu thể hiện này không giữ bí mật nào cả. |
| `discovery` hoặc `exec` được bật với danh sách cho phép trống | Liệt kê những gì được phép, hoặc tắt tính năng đó. Danh sách cho phép trống mà được đọc theo hướng dễ dãi chính là cách một khả năng hẹp biến thành shell. |

Điều nó *sẽ không* từ chối khởi động vì là một nút hỏng. Một luồng có một nút hỏng vẫn chạy mọi nút khác và ghi lại lỗi, vì dừng một dây chuyền chỉ vì một lỗi gõ trong một hộp thoại còn tệ hơn chạy 40 trên 41 nút và nói rõ điều đó. Tương tự với danh sách cho phép của exec nêu tên thứ chưa có trong `PATH`: nó cảnh báo khi khởi động và xác định lại khi một luồng dùng đến, vì một init container hoặc một volume được gắn có thể hợp lệ đưa nó vào sau khi khởi động.

Nếu tệp luồng không phân tích được, nó thử các bản sao lưu từ mới nhất, giữ tệp hỏng bên cạnh dưới tên `.corrupt` và ghi lại chính xác bản sao lưu nào nó đã quay về. Nếu không bản nào phân tích được, nó dừng ở đó, thay vì lên trống rỗng và trông khỏe mạnh trong khi mọi luồng của bạn đã mất. Và một lần triển khai ghi tệp luồng *trước khi* dừng runtime cũ, nên nếu lưu thất bại, các luồng trước đó của bạn vẫn chạy thay vì dây chuyền sập vì một lần lưu lỗi. Thứ tự đó không phải thứ tự hiển nhiên, không phải ngẫu nhiên, và một bài kiểm thử sẽ thất bại nếu ai đó đổi nó.
