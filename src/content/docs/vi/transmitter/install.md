---
title: "Cài đặt HotLoop Transmitter"
description: "Cài thư viện vào kho thư viện CODESYS, thêm vào dự án, và biết cần làm gì khi khối báo lỗi."
---

Bạn cần hệ thống phát triển CODESYS 3.5 SP22 trở lên, và một runtime mà thiết bị đích có các thành phần SysSocket và SysTimeRtc; các runtime CODESYS Control cho Linux SL đều có (thành phần thứ hai là mới trong 1.1.0, dành cho dấu thời gian).

## Từ CODESYS Installer

Từ 1.1.0, bản phát hành còn có `HotLoopTransmitter-1.2.0.package`, tại https://hotloop.io/hotloop-transmitter/1.2.0/HotLoopTransmitter-1.2.0.package. Cài bằng CODESYS Installer (trong IDE: Tools, CODESYS Installer), hoặc không cần cửa sổ bằng dòng lệnh của nó, `PackageManagerCLI.exe --profile="<your profile>" --install=<file>.package --targetProfiles="<your profile>"`. Installer đặt thư viện vào kho thư viện của profile đó, dưới tên công ty HotLoop, và bạn chuyển sang bước 3 bên dưới. Gói này là cùng một thư viện với tệp `.library`, trong một tệp ZIP mà Installer đọc được, nên hai cách cho ra cùng một thư viện.

## Từ tệp thư viện

1. Tải `HotLoopTransmitter-1.2.0.library` từ https://hotloop.io/hotloop-transmitter/1.2.0/HotLoopTransmitter-1.2.0.library và đối chiếu với `SHA256SUMS` trong cùng thư mục (`sha256sum -c SHA256SUMS`).
2. Trong IDE CODESYS: Tools, Library Repository, Install, chọn tệp. Giờ nó nằm trong kho dưới tên công ty HotLoop.
3. Trong dự án, mở Library Manager của ứng dụng, Add Library, và chọn HotLoop Transmitter. SysSocket, SysTimeRtc và các thư viện giao diện của chúng đi kèm như phần phụ thuộc và không cần bạn làm gì.
4. Khai báo một `HLTX.FB_HLTX_Publisher`, thêm các trường và gọi nó mỗi chu kỳ (README có ví dụ).
5. Tải xuống bộ điều khiển. Đích phải truy cập được từ mạng của bộ điều khiển; với multicast, các switch của mạng phải chuyển tiếp nhóm đó.

Tệp `.compiled-library` là cùng thư viện nhưng không có mã nguồn. Hãy cài tệp này nếu bạn không muốn Structured Text hiện trong Library Manager. Nó nằm trong cùng thư mục, tên là `HotLoopTransmitter-1.2.0.compiled-library`.

Để kiểm tra thứ gì đang đến, bất kỳ trình lắng nghe UDP nào trên cổng đích đều dùng được. Một chương trình Go nhỏ lắng nghe trên một cổng hoặc tham gia một nhóm multicast và in mỗi datagram thành một dòng JSON kèm dạng hex là đủ tốt.

## HotLoop Alarms

Từ 1.2.0, bản phát hành còn có `HotLoopAlarms-1.0.0.0.library` và `HotLoopAlarms-1.0.0.0.compiled-library`, thư viện cho các cảnh báo riêng của PLC, trong cùng thư mục. Cài một trong hai theo cách giống thư viện Transmitter và thêm vào Library Manager của ứng dụng. Dự án cần một Alarm Configuration, và HotLoop 4.23.6 trở lên đọc khối này.

## Nếu khối báo lỗi

| `eError` | Ý nghĩa | Cách xử lý |
|---|---|---|
| `NoFields` | chưa thêm trường nào | gọi một phương thức `Add` trước khi bật |
| `BadInterval` | `tPublishingInterval` dưới 1 ms | đặt giá trị |
| `BadAddress` | `sDestination` không phải địa chỉ IPv4 dạng chấm | sửa lại |
| `SocketCreate`, `SocketOption` | runtime từ chối một lệnh gọi socket; `diLastSocketResult` có mã của nó | khối tự thử lại sau `tRetry` |
| `TooBig` | các trường không vừa trong 1472 byte | xuất bản ít hơn, hoặc dùng hai publisher có writer id khác nhau |
| `BadField` | một địa chỉ đã lưu bị xóa | `Clear()` rồi thêm lại các trường |
