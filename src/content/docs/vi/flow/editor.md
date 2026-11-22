---
title: "Trình soạn thảo của HotLoop Flow"
description: "Trình soạn thảo Flow ở giao diện sáng và tối: canvas, bước xem xét trước khi triển khai, một thông điệp được truy vết và đăng nhập."
---

Nó theo hệ thống của bạn, sáng hoặc tối, và mỗi hình bên dưới được hiển thị cả hai kiểu, kiểu sáng trước. Mọi hình bên dưới đều đến từ `web/shots/screenshots.sh`, tập lệnh này chạy tệp nhị phân thật và một trình duyệt thật, nên chúng được chụp lại khi trình soạn thảo thay đổi và không thể trôi thành bản mô phỏng. Nhà máy trên canvas là một dây chuyền lò với hai lần triển khai phía sau.

## Đấu dây, chạy, theo dõi

![Trình soạn thảo trên một dây chuyền lò: canvas, lịch sử triển khai và các bảng gỡ lỗi và runtime](/synced/flow/docs/screenshots/editor.png)
![Cũng vậy, ở giao diện tối](/synced/flow/docs/screenshots/editor-dark.png)

Canvas là thứ đang chạy. Bảng gỡ lỗi bên dưới in ra những gì các nút gỡ lỗi của bạn thấy, và bảng Runtime bên cạnh đếm những gì đã vào và ra khỏi từng nút, kèm một thanh cho biết hàng đợi của nó đầy đến đâu. Khi một dây chuyền chạy sai, bạn đọc nó trên màn hình thay vì đi lục trong nhật ký.

## Xem xét trước khi nó đến dây chuyền

![Bảng xem xét liệt kê một nút đã đổi, có ô ghi chú, bên cạnh canvas với nút đó được khoanh viền](/synced/flow/docs/screenshots/review.png)
![Cũng vậy, ở giao diện tối](/synced/flow/docs/screenshots/review-dark.png)

Deploy không triển khai ngay. Nó vẽ thay đổi lên canvas, viết ra bằng lời và yêu cầu bạn ghi chú. Ghi chú nằm trong lịch sử cạnh tên bạn, để ai nhận cuộc gọi lúc 2 giờ sáng cũng thấy được điều gì đã đổi và vì sao.

## Theo một thông điệp dọc các đường nối

![Một thông điệp được truy vết sáng lên khắp canvas cùng thời gian mỗi nút dành cho nó, và bảng gỡ lỗi bên dưới](/synced/flow/docs/screenshots/debug.png)
![Cũng vậy, ở giao diện tối](/synced/flow/docs/screenshots/debug-dark.png)

Nhấp Trace trên một dòng gỡ lỗi và đường đi của thông điệp đó sáng lên trên canvas, từng chặng một, kèm việc mỗi nút đã làm với nó và mất bao lâu. Biến nó thành một bài kiểm thử, hoặc phát lại vào một bản nháp, ngay từ cùng bảng đó.

## Đăng nhập

![Thẻ đăng nhập](/synced/flow/docs/screenshots/signin.png)
![Cũng vậy, ở giao diện tối](/synced/flow/docs/screenshots/signin-dark.png)

![Thông báo mà một runtime hiển thị khi bảng điều khiển đăng nhập cho mọi người và trang này được mở bằng cách khác](/synced/flow/docs/screenshots/dashboard-signin.png)
![Cũng vậy, ở giao diện tối](/synced/flow/docs/screenshots/dashboard-signin-dark.png)

Nó không khởi động khi chưa khóa, nên điều đầu tiên ai cũng thấy là màn hình đăng nhập. Khi bảng điều khiển EmberCORE đăng nhập cho mọi người, một runtime được mở bằng cách khác sẽ bảo họ vào qua bảng điều khiển thay vì hỏi mật khẩu thứ hai.
