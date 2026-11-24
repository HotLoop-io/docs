---
title: "Lộ trình của Transmitter"
description: "Những gì HotLoop Transmitter đã xây dựng, những gì sắp tới và những gì cố ý không nằm trong kế hoạch."
---

Hiện có gì trong hộp, tiếp theo là gì và cố ý không có kế hoạch cho điều gì. Một dòng chỉ chuyển sang "Đã phát hành" khi nó đã chạy trên runtime 4.22.0.0 thật và một bộ nhận đã đọc được.

## Phát hành trong 1.3.0

* Dấu thời gian chính xác đến mili giây, từ thời gian độ phân giải cao của đồng hồ. `bHighResTimestamp` chuyển về giây nguyên.
* Trường WSTRING, gửi dưới dạng UTF-8 trong Variant và RawData (`AddWString`).
* Trạng thái theo từng trường, để giá trị Bad được gửi đi là Bad (`SetStatus`).
* Nhiều DataSetMessage trong một NetworkMessage, với mảng Sizes, để một datagram mang được nhiều hơn một writer (`AddDataSet`).
* Data Delta Frame và thông điệp KeepAlive, để giảm số byte của tập dữ liệu gần như đứng yên. Đây là một thiết lập, `bDeltaFrames`, mặc định tắt.

## Phát hành trong 1.2.0

* HotLoop Alarms (`alarms/`), một thư viện đọc các cảnh báo đang hoạt động, đang chờ và đã xác nhận của trình quản lý cảnh báo CODESYS vào các biến đơn giản và thực hiện xác nhận mà HotLoop ghi ngược lại. Nó đã chạy trên runtime thật 4.22.0.0 và danh sách cảnh báo của HotLoop đã đọc nó.

## Phát hành trong 1.1.0

* Dấu thời gian của DataSetMessage và NetworkMessage lấy từ đồng hồ thời gian thực của PLC, bật theo mặc định; `bTimestamp` tắt chúng.
* Thư viện dưới dạng `.package` của CODESYS, cài bằng CODESYS Installer.

## Phát hành trong 1.0.0

* Một khối publisher, `FB_HLTX_Publisher`: một NetworkMessage mỗi khoảng xuất bản, một DataSetMessage, một Data Key Frame, UADP qua UDP, từ Structured Text trên SysSocket.
* Các kiểu mã hóa trường Variant và RawData.
* Các trường BOOL, SINT, USINT, INT, UINT, DINT, UDINT, LINT, ULINT, REAL, LREAL, STRING và TIME, và mảng của mọi kiểu trừ STRING, ở cả hai kiểu mã hóa.
* Đích unicast và multicast, publisher id, writer group id, dataset writer id, khoảng xuất bản, phiên bản nhóm và phiên bản cấu hình, tất cả đặt làm đầu vào của khối.
* Gửi không chặn, chi phí mỗi lần gọi có giới hạn, bộ đếm số đã gửi, bị từ chối và bị bỏ qua, và một trạng thái lỗi không bao giờ làm ứng dụng bị lỗi.

## Không có kế hoạch

* Bảo mật thông điệp (ký và mã hóa). Khối gửi ở dạng rõ, trên mạng mà nhà máy vốn đã tin cậy.
* NetworkMessage bị chia khúc. Thông điệp không vừa một khung 1500 byte sẽ bị từ chối, không bị chia nhỏ.
* Phía subscriber. HotLoop core đăng ký UADP; thư viện này xuất bản.
* Truyền tải MQTT. UDP là thứ mà runtime CODESYS với tới mà không cần thêm thư viện.
