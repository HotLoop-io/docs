---
title: "Lộ trình của Transmitter"
description: "Những gì HotLoop Transmitter đã xây dựng, những gì sắp tới và những gì cố ý không nằm trong kế hoạch."
---

Hiện có gì trong hộp, tiếp theo là gì và cố ý không có kế hoạch cho điều gì. Một dòng chỉ chuyển sang "Đã phát hành" khi nó đã chạy trên runtime 4.22.0.0 thật và một bộ nhận đã đọc được.

## Phát hành trong 1.1.0

* Dấu thời gian của DataSetMessage và NetworkMessage lấy từ đồng hồ thời gian thực của PLC, bật theo mặc định; `bTimestamp` tắt chúng.
* Thư viện dưới dạng `.package` của CODESYS, cài bằng CODESYS Installer.

## Phát hành trong 1.0.0

* Một khối publisher, `FB_HLTX_Publisher`: một NetworkMessage mỗi khoảng xuất bản, một DataSetMessage, một Data Key Frame, UADP qua UDP, từ Structured Text trên SysSocket.
* Các kiểu mã hóa trường Variant và RawData.
* Các trường BOOL, SINT, USINT, INT, UINT, DINT, UDINT, LINT, ULINT, REAL, LREAL, STRING và TIME, và mảng của mọi kiểu trừ STRING, ở cả hai kiểu mã hóa.
* Đích unicast và multicast, publisher id, writer group id, dataset writer id, khoảng xuất bản, phiên bản nhóm và phiên bản cấu hình, tất cả đặt làm đầu vào của khối.
* Gửi không chặn, chi phí mỗi lần gọi có giới hạn, bộ đếm số đã gửi, bị từ chối và bị bỏ qua, và một trạng thái lỗi không bao giờ làm ứng dụng bị lỗi.

## Tiếp theo

* Dấu thời gian dưới một giây. Dấu của 1.1.0 là số giây nguyên của đồng hồ thời gian thực.
* Nhiều DataSetMessage trong một NetworkMessage (mảng Sizes), để một datagram mang được nhiều hơn một writer.
* Data Delta Frame và thông điệp KeepAlive, để giảm số byte của bộ dữ liệu gần như không đổi.
* Trường WSTRING.
* Trạng thái cho từng trường, để một giá trị Bad có thể gửi đi là Bad.

## Không có kế hoạch

* Bảo mật thông điệp (ký và mã hóa). Khối gửi ở dạng rõ, trên mạng mà nhà máy vốn đã tin cậy.
* NetworkMessage bị chia khúc. Thông điệp không vừa một khung 1500 byte sẽ bị từ chối, không bị chia nhỏ.
* Phía subscriber. HotLoop core đăng ký UADP; thư viện này xuất bản.
* Truyền tải MQTT. UDP là thứ mà runtime CODESYS với tới mà không cần thêm thư viện.
