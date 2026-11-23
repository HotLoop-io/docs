---
title: "Ghi chú phát hành: HotLoop core 4.24.0"
description: "HotLoop core 4.24.0 có gì mới, điều gì thay đổi khi nâng cấp và nên đọc gì trước khi đụng vào một nhà máy đang chạy."
sidebar:
  label: "4.24.0"
---

Các màn hình HotLoop là P&ID. Các cảnh báo riêng của một PLC CODESYS hiện trong danh sách cảnh báo của HotLoop và một xác nhận quay lại PLC, một lần chạy script luôn kết thúc, volume dữ liệu của một hộp luôn đọc được, và các dòng lộ trình UniFi Protect, Access và nguồn đã được phát hành. Chỉ build cho amd64; bản build đa kiến trúc theo sau ở phiên bản kế tiếp.

## Có gì thay đổi

- **Các màn hình là P&ID.** Thả bồn, máy bơm, van, bộ trao đổi nhiệt, bộ lọc, thiết bị đo và mối nối lên một trang ký hiệu, rồi kéo từ một điểm kết nối sang điểm khác: đường ống tự đi theo góc vuông quanh mọi thứ trên trang, rẽ nhánh bằng một mối nối nơi bạn thả nó lên đường ống khác, và định tuyến lại khi bạn di chuyển một ký hiệu. Mỗi đường ống mang môi chất của nó (nước, hơi nước, nhiên liệu, khí, điện, tín hiệu và nhiều loại khác, mỗi loại có một màu, một mã và một kiểu đường nét, nên màu không bao giờ là phương tiện mang duy nhất) và di chuyển theo tag của nó hoặc một quy tắc. Mỗi trang ký hiệu có một thanh công cụ để thu phóng, kéo, hiện bản đồ nhỏ và chuyển sang chế độ xem xám hiệu năng cao, và một P&ID được lưu, xuất và nhập trong cùng tệp màn hình. Xem [Bảng điều khiển](/vi/iot/dashboards/) và [Screen files](/vi/iot/screen-file/).
- **Các cảnh báo riêng của một PLC CODESYS hiện trong danh sách cảnh báo của HotLoop.** Alarm Configuration của một dự án giữ các nhóm và lớp cảnh báo, và các cảnh báo theo dõi một biến. Một thiết bị CODESYS giờ đọc những cảnh báo mà trình quản lý cảnh báo của PLC nó đang giữ (đang hoạt động, chờ xác nhận, đã xác nhận trong khi điều kiện vẫn còn), và một xác nhận thực hiện trong HotLoop quay lại PLC. Một PLC không có cảnh báo nào để đưa thì được để yên. Cần thư viện HotLoop Alarms và một khối trong dự án. Xem CODESYS-ALARMS.md.
- **Volume dữ liệu của hộp luôn đọc được.** Một hộp không có gì được mount dưới `/data` thì không có `/data`, và tag sức khỏe hộp `data_util_pct` từng đọc là xấu với «no such file or directory». Giờ nó đọc volume mà thư mục dữ liệu sẽ được tạo trên đó. Xem [Giao thức và driver](/vi/iot/protocols/#tình-trạng-máy).
- **Một lần chạy script luôn kết thúc.** Khi cơ sở dữ liệu từ chối ghi phần kết thúc của một lần chạy script, HotLoop ghi log rồi bỏ cuộc, nên lần chạy được đọc là «running» suốt đời tiến trình trong khi chỗ của nó đã trống từ lâu. Giờ lần ghi được yêu cầu lại, tối đa năm lần với một khoảng chờ ngắn giữa các lần.
- **UniFi Protect, Access và ổ cắm của SmartPower PDU đã được phát hành trong lộ trình.** Chúng đến như thiết bị ở 4.23.6, được xây dựng theo các API đã công bố, với mọi đường dẫn của Protect khớp tài liệu 7.4.102. Xem [lộ trình của HotLoop](/vi/roadmap/).
- **Một màn hình TwinCAT được chứng minh trong trình duyệt.** Ví dụ TwinCAT PackML được nhập cùng các khung của nó, được render, và một đèn theo dõi một thanh ghi trực tiếp.
- **Các bài kiểm thử chờ đúng thứ chúng đang chờ.** Thời gian chờ throttle của panel được kiểm tra như số học, bộ đếm giờ của việc giữ forSec nằm trong tay bài kiểm thử chứ không chạy đua với một khoảng sleep, bài kiểm thử topic của Apache Kafka xóa topic của nó ngay và có đủ thời gian mà một hộp chậm cần, và một bài kiểm thử API không còn giới hạn một lần đăng nhập bằng một mẫu, vì một hộp đang tải trả lời chậm gấp bốn lần so với một giây trước.

## Migration

Không có.

## Thay đổi API

Không có. Không route nào thay đổi. Cấu hình của một trang ký hiệu nhận `pipes`, `view` và `rot` của một ký hiệu, và một tệp màn hình đã lưu mang chúng.

## Nâng cấp từ 4.23.6

Một lệnh `helm upgrade` bình thường. Không có migration và không có secret mới. Một trang ký hiệu không có đường ống được vẽ như trước.

## Những gì chưa được kiểm chứng

- Đường cảnh báo PLC được chạy với một runtime CODESYS Control for Linux SL 4.22.0.0 thật cùng chương trình phòng thí nghiệm cảnh báo.
- Protect, Access và các ổ cắm của PDU theo các API đã công bố, và lần chạy trên bàn thử với thiết bị thật sẽ tiếp theo ở văn phòng.
