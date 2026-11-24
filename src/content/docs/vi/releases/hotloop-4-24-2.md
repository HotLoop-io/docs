---
title: "Ghi chú phát hành: HotLoop core 4.24.2"
description: "HotLoop core 4.24.2 có gì mới, điều gì thay đổi khi nâng cấp và nên đọc gì trước khi đụng vào một nhà máy đang chạy."
sidebar:
  label: "4.24.2"
---

HotLoop đọc và điều khiển trực tiếp thiết bị Shelly ở mọi thế hệ, tìm camera ONVIF và phục vụ luồng, ảnh chụp cùng thao tác xoay, nghiêng và thu phóng của chúng, trao đổi với Arduino qua Firmata, và gửi mật khẩu OPC UA có độ dài bất kỳ đúng như đặc tả yêu cầu. Một đường truyền chậm không còn giữ nút biên bám vào đĩa của nó nữa, và `--version` nêu commit mà một image được dựng từ đó. Cài đặt mặc định của HotLoop Edge khởi động được. Chỉ dựng cho amd64; bản dựng đa kiến trúc theo sau ở phiên bản kế tiếp.

## Có gì thay đổi

- **Shelly, mọi thế hệ.** Gen2 trở lên qua RPC với websocket trực tiếp, nên một thay đổi và một lần nhấn nút đến ngay khoảnh khắc chúng xảy ra, còn Gen1 qua giao diện HTTP riêng của nó. Một lần nhấn nút được ghi vào nhật ký dưới thiết bị. Xem SHELLY.md.
- **Camera ONVIF.** Tìm camera trên mạng (WS-Discovery), đọc thông tin của từng thiết bị, địa chỉ luồng và ảnh chụp của mọi hồ sơ media (Media và Media2), xoay, nghiêng và thu phóng, cùng các sự kiện riêng của camera dưới dạng tag và dòng nhật ký. Hình ảnh hiện tại của một hồ sơ chỉ cách một route. Xem ONVIF.md.
- **Arduino qua Firmata.** USB nối tiếp hoặc TCP, với chân số và chân tương tự, PWM, servo và thiết bị I2C dưới dạng tag. Xem FIRMATA.md.
- **Mật khẩu OPC UA có độ dài bất kỳ.** Mật khẩu trên 64 byte nay đi qua OPC UA đúng như đặc tả yêu cầu (RsaEncryptedSecret, phần 4, 7.40.4), từ client đến server, và các server cũ hơn vẫn đăng nhập được. Đã được kiểm chứng với chính stack của OPC Foundation. Xem [server OPC UA](/vi/edge/opc-ua-server/).
- **Đường truyền chậm không còn ghim nút vào đĩa của nó.** Lượt lấy phần cuối của đĩa nay gửi từ bộ nhớ những gì đến sau nó, nên hàng đợi chuyển tiếp sau một đường truyền chậm được làm rỗng và nút rời khỏi đĩa thay vì fsync ở mỗi lần thăm dò.
- **`--version` nêu commit.** Mỗi image nêu commit mà nó được dựng từ đó, bên cạnh phiên bản của nó.
- **Một màn hình CODESYS bên cạnh WebVisu của nó.** Việc nhập một visualization CODESYS được chạy với một WebVisu thật, được điều khiển bởi cùng các biến PLC, và hai bên được so sánh trong trình duyệt.
- **Dòng lộ trình docs/legacy đã được đánh dấu.**
- **Cài đặt mặc định của HotLoop Edge khởi động được.** Pod không còn đọc token Gotify, URL webhook Discord hay token bot Discord từ một Secret không tồn tại: mỗi giá trị chỉ được gửi khi thông tin xác thực của nó được đặt, và bước kiểm tra chart thất bại với mọi tham chiếu đến Secret mà phần render không tạo ra. Một chart có đích được đặt, hoặc có nêu một Secret sẵn có, vẫn render như trước.
- **Phòng thí nghiệm Ignition, theo cả hai chiều.** Bằng chứng của HotLoop với Ignition nay cũng chạy theo chiều ngược lại, một bằng chứng UADP multicast qua bộ định tuyến được thêm vào, và báo cáo lớn nhất đã được đo. Xem [Báo cáo định kỳ](/vi/gateway/reports/).
- **Các bài kiểm tra chờ đúng thứ chúng đang chờ.** Bước khởi động của ứng dụng điện thoại chờ một trang đã đăng nhập, và biểu mẫu năng lượng điền các trường của nó trong một bước.

## Migration

Không có.

## Thay đổi API

Hai route, cả hai đều mới. `POST /api/onvif/discover` (`devices.write`) dò mạng để tìm camera ONVIF và không thêm gì. `GET /api/onvif/{id}/profiles/{profile}/snapshot` (`devices.read`) trả về JPEG hiện tại của một hồ sơ camera. Không route nào hiện có thay đổi. Xem [HTTP API](/vi/iot/api/).

## Nâng cấp từ 4.24.0

Một lệnh `helm upgrade` bình thường. Không có migration và không có secret mới.

## Những gì chưa được kiểm chứng

- Shelly, ONVIF và Firmata đã được chạy với bản ghi của thiết bị thật, stack do chính ONVIF sinh ra và StandardFirmata của chính dự án Arduino trên một Uno mô phỏng. Chưa có Shelly, camera hay Arduino thật nào lên bàn thử nghiệm.
- Phép so sánh cạnh nhau với WebVisu chạy trong thử nghiệm với runtime CODESYS Control for Linux SL 4.22.0.0.
