---
title: "Ghi chú phát hành: HotLoop Flow 2.5.0"
description: "HotLoop Flow 2.5.0 có gì mới, điều gì thay đổi khi nâng cấp và nên đọc gì trước khi đụng vào một nhà máy đang chạy."
sidebar:
  label: "2.5.0"
---

HotLoop Flow 2.5.0 là một trình soạn thảo mới. Cùng các luồng, cùng động cơ, cùng phím tắt, và cuối cùng nó trông như thuộc về phần còn lại của HotLoop thay vì đến từ một công ty khác. Nếu bạn nối dây nhà máy để kiếm sống, thứ bạn nhận được là một màn hình khớp với việc bạn làm cả ngày: đặt thứ đó lên canvas, triển khai nó và xem nó chạy.

## Có gì mới

**Trình soạn thảo trông như HotLoop.** Cùng màu, cùng phông chữ, sáng và tối theo hệ thống của bạn, với một nút trên thanh trên cùng khi bạn muốn cái còn lại. Màu cam nghĩa là "bạn có thể nhấp vào đây" và không gì khác. Nó không có nghĩa là cảnh báo, lựa chọn, hay đường mà một thông điệp đã đi.

**Gỡ lỗi và runtime đã chuyển xuống dưới canvas.** Nhật ký gỡ lỗi và bảng Runtime giờ nằm trong một dock dọc phía dưới, cạnh nhau, nên một dòng gỡ lỗi có toàn bộ chiều rộng canvas thay vì một cột hẹp nơi mỗi payload bị ngắt dòng bốn lần. Bảng Runtime bên cạnh vẫn đếm những gì vào và ra khỏi mỗi nút, với một thanh cho biết mỗi hàng đợi đầy đến đâu. Điều đó có nghĩa gì với bạn: bạn xem một số đọc đến nơi và nút nó đến từ đâu mà không cần cuộn hay nheo mắt.

**Lịch sử, Kiểm thử và Truy vết vẫn ở bên phải.** Mục bạn đang làm việc lên trên cùng. Nhấn Triển khai và bản rà soát là thứ đầu tiên trong cột đó, với ô ghi chú bên dưới. Nhấp Truy vết trên một dòng gỡ lỗi và vết truy chiếm vị trí trên cùng.

**Vết truy giờ có màu xanh.** Đường một thông điệp đã đi được vẽ màu xanh trên canvas, cùng thời gian mỗi nút đã dùng. Bản rà soát trước khi triển khai đánh dấu các nút được thêm, thay đổi, di chuyển và xóa bằng xanh lá, hổ phách, xanh dương và đỏ. Điều đó có nghĩa gì với bạn: giờ bạn phân biệt được vết truy với lựa chọn chỉ trong một cái nhìn, vì chúng không còn dùng chung một màu.

**Một trang đăng nhập trông như phần còn lại của HotLoop.** Một thẻ, logo thật và cùng các trường. Phía sau bảng điều khiển EmberCORE, nó vẫn bảo bạn vào qua bảng điều khiển.

**Tìm kiếm hiện phím tắt của nó.** Nút ghi Ctrl F, nên bạn không phải đoán.

**Nhấp đúp ngay sau một chỉnh sửa đã trúng.** Trình soạn thảo kiểm tra kiểu của các dây của bạn một chút sau mỗi chỉnh sửa, và trước đây nó vẽ lại mọi dây kể cả khi câu trả lời không đổi, nên một cú nhấp đúp vào một nút có thể trúng một dây đang bị thay giữa chừng cú nhấp và không làm gì. Giờ nó chỉ vẽ lại khi có gì đó thực sự thay đổi.

## Có gì thay đổi

Không có gì về các luồng của bạn. Một tệp luồng được tải và lưu từng byte, y như trước. Nối dây, kéo, hoàn tác, sao chép và dán, Ctrl+Enter, Escape, nhích bằng phím mũi tên, thu phóng, chọn bằng khung và kéo từ bảng nút đều hoạt động như trước, và cả 60 bài kiểm thử trình duyệt đều qua mà không đụng đến một dòng nào của chúng. Chúng tôi cũng đã duyệt qua mọi màn hình và hộp thoại trên 2.4.0 và trên bản build này với cùng một luồng nhà máy, 48 trạng thái, và không thiếu gì.

Những thứ trông khác có chủ ý: các bảng gỡ lỗi và runtime chuyển sang dock, thông báo trống của bảng Kiểm thử giờ nói "dock gỡ lỗi" vì nhật ký nằm ở đó, vết truy và bản rà soát được vẽ bằng màu xanh và các màu trạng thái, nút giao diện ghi Tối hoặc Sáng, và Tìm kiếm hiện phím tắt của nó.

**Một thứ chậm hơn, và chúng tôi muốn nói ra hơn là để bạn tự phát hiện.** Trang trắng một lúc cho đến khi trình soạn thảo tải xong, trong khi bản cũ vẽ khung của nó trước. Chúng tôi đo với bộ nhớ đệm trình duyệt tắt, từ yêu cầu trang đăng nhập đến lúc biểu mẫu hiện trên màn hình. Trên máy này chậm hơn khoảng 12 ms. Trên đường truyền 20 Mbps chậm hơn khoảng 100 ms (230 ms thành 335 ms), và trên đường truyền 1,6 Mbps với độ trễ 150 ms chậm hơn khoảng nửa giây (1,46 giây thành 1,96 giây). Trên mạng LAN nhà máy chỉ vài mili giây. Trên đường truyền kém, bạn sẽ thấy một trang trắng trong chốc lát, rồi đến trình soạn thảo. Đó là chi phí một lần cho mỗi lần tải trang, không phải mỗi lần nhấp.

## Cài đặt mới

Không có. Không có gì để bật, và không có gì ở đây có công tắc để tắt.

## Nâng cấp

Chỉ cần `helm upgrade` lên image và chart 2.5.0, hoặc tag mới trong unit Quadlet của bạn. Không có gì xảy ra ở lần khởi động đầu tiên, không có gì để di chuyển, và các luồng, bản ghi triển khai và thông tin xác thực không bị đụng đến. Hãy tải lại tab trình soạn thảo một lần sau khi pod khởi động lại để trình duyệt ngừng hiện bản cũ.

## Giấy phép

Trình soạn thảo giờ mang theo hai phông chữ, Inter và JetBrains Mono, theo SIL Open Font License 1.1. Giấy phép của chúng nằm trong `/usr/share/doc/hotloop-flow/THIRD_PARTY_LICENSES` cùng các giấy phép còn lại, và `NOTICE` nói tệp đó được tạo ra thế nào.

Image: `ghcr.io/hotloop-io/hotloop-flow:2.5.0`, linux/amd64 và linux/arm64. Chart: `https://hotloop.io/hotloop-flow/`. README ở tag này có phần còn lại, kèm hình: https://github.com/HotLoop-io/hotloop-flow/blob/v2.5.0/README.md
