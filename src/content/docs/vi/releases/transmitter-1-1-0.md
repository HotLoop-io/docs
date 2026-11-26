---
title: "Ghi chú phát hành: HotLoop Transmitter 1.1.0"
description: "Mỗi thông điệp mang dấu thời gian từ đồng hồ của PLC, và thư viện cài từ gói CODESYS: những gì đã đổi, đã chạy gì và chưa chạy gì."
---

Mỗi thông điệp giờ mang dấu thời gian từ đồng hồ của PLC, và thư viện giờ cài được từ một `.package` của CODESYS.

Điều này có nghĩa với bạn: một bên đăng ký muốn biết một giá trị được lấy mẫu lúc nào sẽ lấy được từ gói tin thay vì đoán theo lúc nó đến, và bạn có thể cài thư viện bằng CODESYS Installer như mọi tiện ích khác.

## Điều thay đổi với dự án dùng 1.0.0

* **Dấu thời gian, bật theo mặc định.** NetworkMessage và DataSetMessage mỗi cái mang một Timestamp (Phần 14, 7.2.4.4.2 và 7.2.4.5.4), cùng một DateTime, đọc từ đồng hồ thời gian thực của PLC một lần mỗi thông điệp. ExtendedFlags1 đổi từ `01` thành `21`, DataSetFlags1 từ `69` hoặc `6B` thành `E9` hoặc `EB`, và thêm một byte DataSetFlags2 `10`. Một thông điệp dài thêm 17 byte. Danh sách trường và các giá trị không đổi, và `udiConfigMajor` vẫn như cũ.
* **`bTimestamp := FALSE` gửi đúng các byte của 1.0.0.** Hãy ghim nó nếu một bên nhận của bạn từ chối dấu thời gian. Đã kiểm tra: thông điệp 1142 và 1144 byte, không cái nào có dấu, đúng các kích thước 1.0.0 từng gửi.
* **Độ phân giải là một giây.** Đồng hồ được đọc bằng `SysTimeRtcGet`, cho ra số giây nguyên, nên bên nhận thấy cùng một dấu thời gian trên mọi thông điệp trong một giây, và nó có thể chậm tới một giây so với lúc thông điệp được dựng. Dấu thời gian dưới một giây có trong lộ trình.
* **Một đầu ra mới, `diLastClockResult`.** Nếu không đọc được đồng hồ, thông điệp đi ra không có dấu thời gian, điều mà Phần 14 cho phép, và đầu ra này cho biết lý do.
* **Một thư viện hệ thống mới, SysTimeRtc.** Thư viện gọi tên nó như một chỗ giữ chỗ, giống SysSocket, và runtime cung cấp nó. Control for Linux SL 4.22.0.0 có. Một đích không có nó không dùng được 1.1.0 với dấu thời gian; hãy ở lại 1.0.0.
* **`.package`.** `HotLoopTransmitter-1.1.0.package` do chính PackageManagerCLI của CODESYS tạo ra và đưa cùng thư viện đó vào kho thư viện qua Installer. Xem [trang cài đặt](/vi/transmitter/install/).

## Chúng tôi đã chạy gì và nó cho thấy gì

Tất cả đều trên CODESYS Control for Linux SL 4.22.0.0, với các tệp bên dưới.

* Thư viện biên dịch với 0 lỗi và 0 cảnh báo trong CODESYS 3.5.22.30. Ứng dụng mẫu biên dịch với nó với 0 lỗi và 0 cảnh báo.
* Hai bên xuất bản, Variant và RawData, bật dấu thời gian. Một bộ giải mã độc lập viết theo đặc tả giải mã mọi thông điệp và mọi giá trị bằng với giá trị PLC báo qua máy chủ OPC UA của chính nó. Mọi thông điệp có cả hai dấu thời gian, chúng là cùng một thời điểm, không bao giờ đi lùi, nằm trong dung sai số giây nguyên của đồng hồ mà phiên bắt gói chạy trên đó, và trong một phiên bắt 11 giây dấu đã dịch 11 giây. Container dùng chung đồng hồ của máy chủ, nên điều này cho thấy dấu là số đọc từ đồng hồ của PLC chứ không phải dấu bịa ra; nó không kiểm tra một bộ điều khiển có đồng hồ sai.
* Một ngăn xếp PubSub độc lập đọc Timestamp của NetworkMessage và DataSetMessage trong cả 113 thông điệp của mỗi bên ghi bằng bộ giải mã tiêu đề riêng, và giải mã các giá trị như với 1.0.0.
* Bên đăng ký của HotLoop core (từ nhánh main lúc chạy thử này, và trong HotLoop core 4.19.4 cùng mọi bản sau đó) đọc cả hai bên xuất bản trên một runtime đang chạy: mỗi bên 21 giá trị, cả hai bộ đếm đều tăng, không có gì bị từ chối. Mỗi lần đọc mang dấu thời gian số giây nguyên của bên xuất bản làm thời gian của nó, và dấu đã di chuyển theo đồng hồ PLC trong lúc chờ 3 giây.
* `.package` cài bằng `PackageManagerCLI --install`, thư viện xuất hiện trong kho System (trước đó chưa có), và ví dụ biên dịch với thư viện đúng như Installer đã đặt, 0 lỗi và 0 cảnh báo.
* Chi phí trên tác vụ 20 ms, hai bên xuất bản: trung bình thêm khoảng 9,6 us mỗi chu kỳ, 10 đến 100 us ở các chu kỳ có gửi, và chu kỳ dài nhất trong lần chạy là 81 us. Ba ô xuất bản bị bỏ qua trong lần chạy đó, và không lần gửi nào bị từ chối. Bản thân dấu thời gian không lộ ra trong các con số. [Trang về thời gian](/vi/transmitter/timing/) có bảng số liệu.

## Cần kiểm tra gì trên bộ điều khiển của bạn

* Phần xử lý thứ tự byte cho đích big endian đã được viết, nên hãy kiểm tra nó trên bộ điều khiển của chính bạn.
* Multicast: khối đặt TTL, loopback và giao diện gửi cho nhóm, nên hãy kiểm tra nhóm trên mạng của chính bạn.
* Nếu mạng mất hoặc một địa chỉ không có, khối đếm lỗi và giãn cách các lần thử, còn chương trình vẫn tiếp tục quét.
* Ở chế độ demo, runtime dừng khi hết khoảng hai giờ của nó, đúng như CODESYS nói.
* Một bộ điều khiển có đồng hồ thời gian thực chưa đặt hoặc sai sẽ đóng dấu theo những gì đồng hồ nói.

## Không có trong bản phát hành này

KeepAlive và Delta Frame, nhiều hơn một DataSetMessage mỗi NetworkMessage, WSTRING, trạng thái theo từng trường, dấu thời gian dưới một giây, bảo mật thông điệp và phía bên đăng ký. [Lộ trình](/vi/transmitter/roadmap/) cho biết cái nào đến tiếp theo.

## Quay lại bản cũ

Một dự án PLC ghim vào 1.0.0 vẫn chạy và vẫn gửi các byte của 1.0.0. Trong 1.1.0, `bTimestamp := FALSE` cho cùng các byte đó.

## Tệp

Tải về từ https://hotloop.io/hotloop-transmitter/1.1.0/HotLoopTransmitter-1.1.0.library và đối chiếu với `SHA256SUMS` trong cùng thư mục.

```
5ec021b23f5d57460016834a03b2b196d6dbc83aeb5d0ad60ace8d7b4fbbb4a7  HotLoopTransmitter-1.1.0.library
e172f4674f6cbfce2aeaf017d5a6c733245b1b9aa3e527369c753bf07b6ce0c2  HotLoopTransmitter-1.1.0.compiled-library
b3686bdebd052f1ddea46d1f1ff409f3b6c9a016ca5f3e8f4cd6f7922ccb479c  HotLoopTransmitter-1.1.0.package
```
