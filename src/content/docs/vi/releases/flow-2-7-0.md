---
title: "Ghi chú phát hành: HotLoop Flow 2.7.0"
description: "HotLoop Flow 2.7.0 có gì mới, điều gì thay đổi khi nâng cấp và nên đọc gì trước khi đụng vào một nhà máy đang chạy."
sidebar:
  label: "2.7.0"
---

HotLoop Flow 2.7.0 là bản cắt đầu tiên của FlowLab, một cách thứ hai để chạy một tab cho bàn thử nghiệm và bộ ghi dữ liệu. Các luồng chạy y như trước, và một tệp luồng bạn có hôm nay được tải và lưu từng byte. FlowLab chỉ khởi động khi bạn thêm một tab cho nó, nên nếu bạn không làm vậy, điều duy nhất đổi với bạn là bản sửa phiên, mục cuối bên dưới.

## Có gì mới

**Sơ đồ FlowLab.** Sơ đồ là một tab nơi mỗi nút chạy một lần, khi mọi đầu vào được nối đều có giá trị, và hai nút không có dây giữa chúng chạy cùng lúc. Thêm một cái bằng nút FlowLab mới cạnh nút luồng con. Nó có một thanh phía trên canvas với Chạy và Dừng, và mọi thứ nó vẽ nằm trên các dây: giá trị cuối trên mỗi dây sau một lần chạy, một đầu dò trên bất kỳ dây nào giữ 100 giá trị cuối, và một điểm dừng trên một nút hoặc một dây. Tạm dừng, bước vào, bước qua và bước ra hoạt động từng nút, và làm nổi bật thực thi làm chậm một lần chạy đủ để theo dõi và tự tắt sau mười phút. Không việc gỡ lỗi nào đổi điều một lần chạy làm, và một bài kiểm thử xác nhận rằng một lần chạy có đầu dò kết thúc với cùng giá trị trên mỗi dây như một lần chạy không có.

**Có gì trong hộp.** Vòng lặp while và for với các giá trị mang từ lượt này sang lượt sau, một vòng lặp for trên một số đếm hoặc một mảng, và một dây lỗi: một nút nhận lỗi không làm gì và chuyển nó đi, và một lỗi nối vào vòng lặp dừng nó cùng nguồn gốc và một mã ở đầu ra lỗi của vòng lặp. Một dây `after` đặt thứ tự của hai nút không chia sẻ dữ liệu. Có 21 loại nút trong mục FlowLab mới của bảng nút: hằng số, toán, so sánh, logic, chờ, gói, trường, dựng mảng, hai vòng lặp cùng đầu vào và đầu ra thân vòng, một cổng nối tiếp có đọc và ghi, một bộ phân tích số đọc, một bộ phát hiện giá trị ổn định, một nhật ký ra tệp văn bản, và một điều khiển, một chỉ báo và một biểu đồ cho bảng. docs/diagrams.md mô tả từng loại.

**Một bảng mà người vận hành có thể mở trên điện thoại.** `/panel/<diagram id>` đăng nhập như trình soạn thảo và hiển thị các điều khiển, chỉ báo và biểu đồ của sơ đồ khi một lần chạy đang diễn ra. Một biểu đồ giữ 1.024 điểm cuối trừ khi bạn đổi và đếm những gì nó bỏ. Một điều khiển được kiểm tra trên máy chủ theo loại, phạm vi và các lựa chọn của nó, và ai đặt nó được ghi vào nhật ký kiểm toán.

**Một cổng nối tiếp sống sót khi rút cáp.** Một lần đọc không nhận được gì, hoặc một cổng biến mất, là một lỗi trên dây lỗi. Lần đọc tiếp theo thử mở lại cổng mỗi giây một lần, và đếm sự mất và sự trở lại. Ví dụ trong `examples/diagram-scale-logger` đọc một cân, phân tích khối lượng và đơn vị, báo khi năm số đọc cuối khớp nhau, hiển thị tất cả trên bảng cùng biểu đồ xu hướng, và nối thêm vào một tệp CSV. Đặt `autostart` trên tab và nó chạy mà không cần mở trình duyệt, và chạy lại sau mỗi lần triển khai.

**API mới.** `GET /diagrams`, `GET /diagrams/{id}`, và `POST` cho `run`, `stop` và `debug`, `PUT` cho `controls/{node}`, `breakpoints` và `probes`. Đọc cần `status.read`. Chạy, dừng, đặt một điều khiển và gỡ lỗi cần một quyền mới, `diagram.run`, và mỗi việc được ghi vào nhật ký kiểm toán cùng người đã làm.

**Phiên không bị ghi đè bởi một lần đọc thất bại.** Một tệp phiên tồn tại nhưng không đọc được, một lỗi I/O hoặc một ổ lên muộn, không còn bị thay bởi lần đăng nhập kế tiếp, và một tệp có JSON không đọc được được giữ cạnh bản gốc thay vì bị mất.

## Có gì thay đổi

- Một tab mang `ew_diagram` bị loại khỏi runtime thông điệp. Mọi tab khác chạy như trước. Các khóa mới là `ew_diagram` trên tab và `ew_in` trên một nút, và cả hai đều sống sót qua vòng đi về, điều mà hai bài kiểm thử mới và bài cũ xác nhận.
- README đếm 79 loại nút và "khoảng 36.000 dòng Go", và cả hai đều đã lỗi thời. Giờ nó nói 79 loại nút cho thông điệp và 21 cho FlowLab.
- Bài kiểm thử của nút máy khách MCP của HotLoop giờ ghi qua cổng của HotLoop, vì HotLoop phát hành các lần ghi MCP của nó ở trạng thái bật.
- Một lần triển khai khởi động lại lần chạy của mọi sơ đồ, kể cả sơ đồ nó không thay đổi.
- FlowLab thêm khoảng 370 KB vào tệp nhị phân, đo trên một máy trước và sau. Tệp nhị phân là 41,4 MB và image amd64 là 45,34 MB.
- Các hình trong README được chụp lại cho nút mới và mục bảng nút mới.

## Cài đặt mới

Không có. Quyền `diagram.run` là mới. Người dùng có danh sách quyền là `["*"]` thì có nó. Ai có danh sách tường minh có thể đọc một sơ đồ và bảng của nó bằng `status.read` và không thể chạy cái nào cho đến khi bạn thêm `diagram.run`.

## Nâng cấp

Trên amd64, chỉ cần `helm upgrade` lên image và chart 2.7.0; trên arm64 hãy ở nguyên chỗ cho đến 2.7.1, hoặc dùng tag mới trong unit Quadlet của bạn. Không có gì xảy ra ở lần khởi động đầu tiên, không có gì để di chuyển, và các luồng, bản ghi triển khai và thông tin xác thực của bạn không bị đụng đến. Nếu bạn quay lại sau khi lưu một tệp luồng có sơ đồ trong đó, bản dựng cũ giữ tệp từng byte và báo `unknown node type` cho mỗi nút FlowLab, những nút đó khi đó không chạy. Chúng tôi đã kiểm tra điều đó với bản dựng trước bản này.

Image: `ghcr.io/hotloop-io/hotloop-flow:2.7.0`, chỉ linux/amd64. Chúng tôi dựng amd64 trước, để nó được xác nhận ổn định trong sản xuất, rồi một bản 2.7.1 nhỏ không có gì khác bổ sung arm64. Cho đến lúc đó, tag `2` giữ image amd64 mới và image arm64 từ 2.6.0, nên một máy arm64 theo `2` hoặc `2.6` giữ nguyên cái nó có, và một máy được ghim vào `2.7.0` cần amd64. Chart: `https://hotloop.io/hotloop-flow/`. README tại tag này có phần còn lại, kèm hình: https://github.com/HotLoop-io/hotloop-flow/blob/v2.7.0/README.md
