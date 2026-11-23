---
title: "Ghi chú phát hành: HotLoop Transmitter 1.0.0"
description: "Bản phát hành đầu tiên của HotLoop Transmitter: thư viện CODESYS xuất giá trị PLC dưới dạng OPC UA PubSub, gồm những gì, đã chạy gì và chưa chạy gì."
---

Bản phát hành đầu tiên. Một thư viện CODESYS, viết bằng Structured Text trên UDP của SysSocket, đưa giá trị của PLC lên mạng dưới dạng OPC UA PubSub (Phần 14, UADP). Bạn thêm thư viện, khai báo một function block, thêm các biến muốn đưa ra và gọi nó một lần mỗi chu kỳ. Bất cứ thứ gì đăng ký OPC UA PubSub đều đọc được, kể cả HotLoop core, từ 4.19.4 trở đi.

Điều này có nghĩa với bạn: một PLC không có thư viện PubSub giờ có thể cấp dữ liệu cho một bên đăng ký PubSub chỉ với khoảng mười lăm dòng Structured Text, và không cài thêm gì khác lên bộ điều khiển.

## Gồm những gì

* Một khối, `HLTX.FB_HLTX_Publisher`. Một NetworkMessage mỗi khoảng xuất bản, một DataSetMessage, một Data Key Frame, nên mỗi thông điệp mang đủ mọi trường.
* Mã hóa trường Variant và RawData, chọn theo từng bên xuất bản. Variant tự mang kiểu của nó. RawData không mang kiểu nào, nên bên nhận phải được cho biết bố cục, mà [trang định dạng trên đường truyền](/vi/transmitter/wire-format/) mô tả từng byte.
* Các trường BOOL, SINT, USINT, INT, UINT, DINT, UDINT, LINT, ULINT, REAL, LREAL, STRING và TIME, và mảng của tất cả các kiểu đó trừ STRING, tối đa 128 trường và 1472 byte mỗi thông điệp. Một thông điệp không bao giờ bị phân mảnh.
* Unicast hoặc multicast, với đầu vào là id bên xuất bản, id nhóm ghi, id bên ghi tập dữ liệu, khoảng xuất bản, phiên bản nhóm và phiên bản cấu hình.
* Gửi không chặn. Địa chỉ sai, socket chết hoặc danh sách trường quá lớn đưa khối vào trạng thái lỗi mà bạn đọc được, và không bao giờ làm ứng dụng của bạn bị lỗi.

## Chúng tôi đã chạy gì và nó cho thấy gì

Tất cả đều trên CODESYS Control for Linux SL 4.22.0.0, với các tệp bên dưới.

* Thư viện biên dịch với 0 lỗi và 0 cảnh báo trong CODESYS 3.5.22.30. Ứng dụng mẫu biên dịch với nó với 0 lỗi và 0 cảnh báo.
* Hai bên xuất bản, một Variant và một RawData, mỗi bên mười bảy trường. Mỗi giá trị trên đường truyền bằng với giá trị PLC báo qua máy chủ OPC UA của chính nó, không hụt số thứ tự nào.
* Một ngăn xếp PubSub độc lập giải mã đầy đủ thông điệp Variant và các giá trị vô hướng RawData. Nó hoàn toàn không đọc được mảng RawData hay chuỗi RawData dài, đó là giới hạn của nó chứ không phải của thư viện.
* Bên đăng ký của HotLoop core (từ nhánh main lúc chạy thử này, và trong HotLoop core 4.19.4 cùng mọi bản sau đó) đọc cả hai bên xuất bản, gồm chuỗi, TIME, cả hai mảng và hai bộ đếm đổi giữa các lần đọc, và không từ chối gì.
* Bộ giải mã thứ hai đọc được cả 222 datagram đã bắt.
* Chi phí trên tác vụ 20 ms, hai bên xuất bản: trung bình thêm khoảng 10,6 us mỗi chu kỳ. Một chu kỳ có gửi tốn từ 10 đến 100 us. Phần đuôi là lệnh gọi `sendto`, và trên một máy chủ dùng chung đang bận nó từng chạm 14,3 ms một lần trong 12 000 chu kỳ. Hãy đặt bên xuất bản vào tác vụ riêng có mức ưu tiên thấp hơn nếu điều đó quan trọng với logic điều khiển của bạn. [Trang về thời gian](/vi/transmitter/timing/) có bảng số liệu.

## Cần kiểm tra gì trên bộ điều khiển của bạn

* Phần xử lý thứ tự byte cho đích big endian đã được viết, nên hãy kiểm tra nó trên bộ điều khiển của chính bạn.
* Multicast: khối đặt TTL, loopback và giao diện gửi cho nhóm, nên hãy kiểm tra nhóm trên mạng của chính bạn.
* Nếu mạng mất hoặc một địa chỉ không có, khối đếm lỗi và giãn cách các lần thử, còn chương trình vẫn tiếp tục quét.
* Ở chế độ demo, runtime dừng khi hết khoảng hai giờ của nó, đúng như CODESYS nói.

## Không có trong bản phát hành này

Dấu thời gian của DataSetMessage và NetworkMessage, KeepAlive và Delta Frame, nhiều hơn một DataSetMessage mỗi NetworkMessage, WSTRING, trạng thái theo từng trường, bảo mật thông điệp và phía bên đăng ký. [Lộ trình](/vi/transmitter/roadmap/) cho biết cái nào đến tiếp theo.

## Nếu bạn chuyển từ một bên xuất bản khác

Một bên nhận đòi dấu thời gian, KeepAlive hoặc Delta Frame sẽ không hài lòng với phiên bản này, vì không cái nào được gửi. Mỗi thông điệp là một Key Frame, mà bên nhận nào cũng đọc được ngay từ đầu. Mảng RawData ở đây là một độ dài Int32, các phần tử, rồi đệm số không đến kích thước đã khai báo, đúng như ngăn xếp tham chiếu của OPC Foundation viết. Bên nhận mong đợi mảng là các phần tử liền nhau không có độ dài thì phải được cho biết các trường là những giá trị vô hướng riêng.

## Với dự án đã dùng nó

Không có phiên bản trước. Định dạng trên đường truyền chỉ đổi khi `udiConfigMajor` đổi, và một dự án PLC ghim vào phiên bản thư viện này giữ nguyên các trường và byte như cũ.

## Tệp

Tải cả hai tệp và `SHA256SUMS` từ https://hotloop.io/hotloop-transmitter/1.0.0/, rồi cài `HotLoopTransmitter-1.0.0.library` qua Tools, Library Repository, Install trong CODESYS 3.5 SP22 trở lên. `.compiled-library` là cùng thư viện đó nhưng không kèm mã nguồn.

```
91b8023a73870925082c170588feb43d363e6d07ce008e1471fa8f5ff8db2c0d  HotLoopTransmitter-1.0.0.library
b02b0b40e434f35e4af1def20d6cc38688463537c4800354931b8c6094a66686  HotLoopTransmitter-1.0.0.compiled-library
```
