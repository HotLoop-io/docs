---
title: "Áp lực ngược, hiện rõ"
description: "Một mức trần cho mọi hàng đợi, một chính sách cho điều xảy ra ở mức trần và một biểu đồ về mọi tin nhắn không vừa, trước khi nó thành một lần bị OOM kill."
---

Đây là toàn bộ dự án. Lỗi điển hình của một công cụ chạy luồng trên hộp biên là một pod âm thầm phình ra cho tới khi kubelet giết nó, và nhật ký nó để lại chẳng giải thích gì cho người đang cầm máy nhắn tin. Vì vậy mọi nơi có thể tích tụ một tin nhắn hay một byte đều có mức trần, và mỗi mức trần là một quyết định được viết ra và ghi tài liệu trong [Tương thích với Node-RED](/vi/flow/compatibility/), chứ không phải một giới hạn chúng tôi đặt ra rồi không bao giờ nhắc tới.

| Thứ có thể tích tụ | Thứ chặn nó lại |
|---|---|
| Hộp thư đến của một nút | Một mức trần (mặc định 1024) và một trong bốn chính sách tràn |
| Hàng đợi trễ và giới hạn tốc độ | Một mức trần; vượt qua thì bị từ chối tới một nút Catch |
| Bộ hẹn giờ của Trigger | Một mức trần |
| Đầu ra của `exec` | Giới hạn theo từng luồng; cắt bớt sẽ gây lỗi |
| Tiến trình `exec` | Một giới hạn đồng thời; vượt qua thì bị từ chối |
| Đọc tệp | Có giới hạn, với chế độ theo dòng và theo khối |
| Nội dung yêu cầu HTTP | Có giới hạn |
| Chờ phản hồi HTTP | Một mã 504 sau thời gian chờ |
| Kết nối và khung TCP | Có biên |
| Hàng đợi gửi WebSocket | Có biên; máy khách chậm sẽ bị ngắt |

Các chính sách tràn, đặt toàn cục và có thể ghi đè theo từng nút:

| Chính sách | Điều gì xảy ra |
|---|---|
| `block` | Bên gửi chờ có chỗ, tối đa `blockTimeout`. Áp lực ngược đi ngược lên phía trên, gần như lúc nào cũng là câu trả lời đúng. |
| `drop-newest` | Tin nhắn đang đến bị loại bỏ. Được đếm và thông báo. |
| `drop-oldest` | Phần đầu hàng đợi bị đẩy đi để lấy chỗ. Được đếm và thông báo. Dành cho "chỉ giá trị đọc mới nhất mới quan trọng". |
| `error` | Việc gửi bị từ chối và được chuyển tới một nút Catch, để luồng tự quyết định. |

Không có gì bị vứt đi trong im lặng. Mỗi lần loại bỏ đều được đếm, đẩy tới trình soạn thảo như một sự kiện và xuất ra như một chỉ số mà bạn có thể đặt cảnh báo. Khi một giới hạn bị chạm tới, bạn biết qua một biểu đồ, không phải qua một người vận hành.

## Một goroutine cho mỗi nút

Mỗi bản sao nút có goroutine riêng và hộp thư đến riêng. Có thứ tự trong một nút, song song giữa các nút. Một nút Function làm việc thật chiếm một lõi trong khi trình soạn thảo, API, websocket và mọi luồng khác vẫn tiếp tục chạy.

## Mỗi bên nhận có bản sao riêng

Khi một dây rẽ nhánh, mọi nút ở đầu bên kia nhận bản sao riêng của tin nhắn, nên hai nhánh đều tưởng mình sở hữu nó cũng không thể làm hỏng nhau, và một nhánh không bao giờ hành xử khác với các nhánh anh em giống hệt chỉ vì thứ tự bạn nối dây. Đó là một lỗi chỉ tái hiện vào các ngày thứ Ba, và ở đây nó không tồn tại.

Nó không miễn phí. Sao chép một tin nhắn nhỏ (một giá trị đọc và một chủ đề) tốn 411 đến 453 ns và 680 byte, và một chuỗi năm nút chuyển một tin nhắn mỗi 1,14 đến 1,40 µs, đã tính cả bản sao. Chỗ sao chép đau là nội dung nhị phân lớn: một bộ đệm 1 MiB tốn 128 đến 156 µs và thêm một megabyte trên heap cho mỗi bên nhận. Vì vậy nội dung nhị phân lớn đi dưới dạng `ImmutableBytes`, chia sẻ bộ đệm thay vì sao chép: **250 đến 279 ns và 360 byte cho cùng tin nhắn 1 MiB đó.** Các nút tệp và HTTP đã giao nội dung nhị phân theo cách này, nên bạn có nó mà không cần yêu cầu.

## Ngữ cảnh biết đếm

Ngữ cảnh luồng và ngữ cảnh toàn cục có `get` và `set`, cũng như `CompareAndSwap`, `Increment` và `Update`. Hai nhánh cùng làm get-modify-set trên một bộ đếm sẽ tranh nhau và mất các lần cập nhật, và chỉ với get và set thì không làm gì được. Với `Increment` thì không có gì để tranh.

Và nó sống sót qua khởi động lại. Ngữ cảnh luồng, toàn cục và nút nằm trong một tệp SQLite trên ổ lưu trữ, được nạp khi một phạm vi được dùng lần đầu và ghi trễ, nên một bộ đếm hay chốt trong luồng vẫn ở nơi bạn để lại khi pod quay về. Các phép toán nguyên tử là cùng một đoạn mã như trước. Các thay đổi được gom thành một lần ghi mỗi ba mươi giây và một giá trị được đặt về đúng giá trị cũ thì không ghi gì, vì chúng tôi quan tâm điều này tác động thế nào tới thẻ SD hơn là tỏ ra khôn khéo. Dừng sạch sẽ ghi mọi thứ; `kill -9` mất tối đa ba mươi giây đó, và `store.context.flushInterval` là núm chỉnh. Chi tiết, và cái giá với một thẻ, nằm ở [docs/durable](/vi/flow/durable-state/).
