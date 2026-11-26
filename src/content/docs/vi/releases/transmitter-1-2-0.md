---
title: "Ghi chú phát hành: HotLoop Transmitter 1.2.0"
description: "HotLoop Alarms tham gia bản phát hành: thư viện đưa cảnh báo riêng của PLC đến nơi HotLoop đọc. Bên xuất bản không đổi."
---

Bản phát hành này thêm HotLoop Alarms, thư viện thứ hai đưa cảnh báo riêng của PLC đến nơi HotLoop đọc, và phát hành Transmitter là 1.2.0.0 với cùng bên xuất bản như trong 1.1.0.

Điều này có nghĩa với bạn: các cảnh báo mà dự án CODESYS của bạn đã phát ra sẽ hiện trong danh sách cảnh báo của HotLoop, và xác nhận một cảnh báo trong HotLoop cũng xác nhận nó trong PLC. Nếu bạn chỉ dùng bên xuất bản thì không có gì phải đổi.

## Điều thay đổi với dự án dùng 1.1.0

* **HotLoop Alarms 1.0.0.0, mới.** `HotLoopAlarms-1.0.0.0.library` và `.compiled-library` có trong bản phát hành. Khối `HLAL.FB_HLAL_Alarms` là một client của trình quản lý cảnh báo CODESYS. Gọi một lần mỗi chu kỳ, nó sao chép các cảnh báo đang hoạt động, đang chờ và đã xác nhận vào một bảng biến đơn giản (`aAlarms`, 64 dòng) mà máy chủ OPC UA của runtime xuất ra như mọi biến khác. `udiChanges` tăng lên khi bảng thay đổi, và `uiDropped` đếm các cảnh báo đang hoạt động không vừa thay vì lặng lẽ làm mất chúng. Nó không cần thư viện kết nối cảnh báo sinh tự động, chỉ cần Alarm Configuration của chính dự án.
* **Xác nhận được gửi ngược lại.** Ghi vào các biến lệnh (`uiAckGroupId`, `uiAckAlarmId`, `udiAckInternalId` hoặc `bAckAll`, rồi một số mới trong `udiAckRequest`) khiến khối xác nhận cảnh báo đó, hoặc tất cả, qua trình quản lý cảnh báo. HotLoop 4.23.6 trở lên tìm khối theo những gì nó chứa và làm tất cả việc này cho bạn.
* **Bên xuất bản của Transmitter không đổi.** Danh sách trường và định dạng trên đường truyền không dịch chuyển, và `bTimestamp` hoạt động như trước. Thư viện được biên dịch lại thành 1.2.0.0, và `.package` mang nó.
* **Giấy phép là HotLoop Source License Agreement 1.0,** giống mọi sản phẩm HotLoop.

## Tôi đã chạy gì và nó cho thấy gì

Tất cả trong phòng thí nghiệm, trên CODESYS Control for Linux SL 4.22.0.0 trong một container.

* Thư viện Transmitter biên dịch với 0 lỗi và 0 cảnh báo trong CODESYS 3.5.22.30, và các ứng dụng mẫu biên dịch với nó cũng vậy.
* Phòng thí nghiệm: hai bên xuất bản, Variant và RawData, mỗi bên giải mã 114 thông điệp, mỗi giá trị bằng với giá trị PLC báo qua máy chủ OPC UA của chính nó, không hụt số thứ tự, cả hai dấu thời gian trong mỗi thông điệp, và các byte của 1.0.0 với `bTimestamp := FALSE`. Một bản triển khai OPC UA PubSub độc lập đọc các giá trị và dấu thời gian của mọi thông điệp. 128 phép kiểm tra đạt và không phép nào hỏng.
* Bên đăng ký UADP của HotLoop core đọc cả hai bên xuất bản trên một runtime đang chạy: mọi giá trị bằng nhau, cả hai bộ đếm đều tăng, nhận 62 key frame và không cái nào bị từ chối.
* `.package` cài bằng `PackageManagerCLI --install`, thư viện xuất hiện trong kho System, và ví dụ biên dịch với nó với 0 lỗi và 0 cảnh báo.
* HotLoop Alarms: trên một runtime thật với Alarm Configuration gồm hai cảnh báo, một lần kích hoạt trong PLC hiện trong HotLoop, một xác nhận trong HotLoop đặt bảng của PLC thành đã xác nhận kèm giờ, một lần reset đặt nó thành chờ xác thực, và một xác thực trong HotLoop làm trống bảng của PLC. Cảnh báo thứ hai đi theo thứ tự ngược lại, và xác nhận tất cả đã xác nhận cả hai cảnh báo đang hoạt động.
* Chi phí của bên xuất bản trên tác vụ 20 ms, hai bên xuất bản, ghim vào bốn lõi: trung bình thêm khoảng 15 us mỗi chu kỳ và chu kỳ dài nhất 144 us, không ô xuất bản nào bị bỏ qua và không lần gửi nào bị từ chối. Một thư viện 1.1.0 biên dịch lại trong cùng giờ đo được 15,2 us và 261 us.

## Tôi đã không chạy gì

* Bất kỳ bộ điều khiển vật lý nào, bất kỳ runtime CODESYS nào ngoài Control for Linux SL 4.22.0.0, và bất kỳ CPU nào ngoài x86-64.
* HotLoop Alarms với lớp cảnh báo khác lớp vừa xác nhận vừa yêu cầu xác thực, hoặc với hơn 64 cảnh báo hoạt động cùng lúc.
* `.package` trong cửa sổ của CODESYS Installer. Nó được cài không giao diện bằng PackageManagerCLI.
* Một bộ điều khiển có đồng hồ thời gian thực chưa đặt hoặc sai, multicast, một runtime mất rồi lấy lại mạng, và phần cuối của cửa sổ demo hai giờ.

## Không có trong bản phát hành này

KeepAlive và Delta Frame, nhiều hơn một DataSetMessage mỗi NetworkMessage, WSTRING, trạng thái theo từng trường, dấu thời gian dưới một giây, bảo mật thông điệp và phía bên đăng ký. [Lộ trình](/vi/transmitter/roadmap/) cho biết cái nào đến tiếp theo.

## Quay lại bản cũ

Một dự án PLC ghim vào 1.1.0 vẫn chạy và gửi cùng các byte. HotLoop Alarms là một thư viện riêng: dự án không thêm nó thì không bị ảnh hưởng.

## Tệp

Tải về từ https://hotloop.io/hotloop-transmitter/1.2.0/HotLoopTransmitter-1.2.0.library và đối chiếu với `SHA256SUMS` trong cùng thư mục.

```
e68cfc88e599ddcf278eb208ff500f4f78d3faf74edf12e38f308a009f478594  HotLoopAlarms-1.0.0.0.compiled-library
68f704fc5662bbc67ec097016a741065d705af01913a2746296c17f9e6991118  HotLoopAlarms-1.0.0.0.library
a404f20fc35c4a3d804aa194f29def3f8193e26e696357899d3ae5b3d44948c1  HotLoopTransmitter-1.2.0.compiled-library
05200d0279ac120fd69d2dc3eeba99d9b40cb76eba2d15d1431b94c5e8f3fc32  HotLoopTransmitter-1.2.0.library
d6b6606a5919e18d2d6d31a5529af4d76bc7058003fb26032ec1a578f78ea57d  HotLoopTransmitter-1.2.0.package
```
