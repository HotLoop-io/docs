---
title: "Ghi chú phát hành: HotLoop Transmitter 1.3.0"
description: "Dấu thời gian mili giây, trường WSTRING, trạng thái theo trường, nhiều DataSet trong một NetworkMessage, khung delta với KeepAlive, mặc định tắt."
---

HotLoop Transmitter đưa các giá trị của PLC lên mạng dưới dạng OPC UA PubSub, từ một thư viện bạn thả vào dự án CODESYS. 1.3.0 bổ sung dấu thời gian chính xác đến mili giây, trường WSTRING, trạng thái theo trường để giá trị xấu được gửi đi là xấu, nhiều DataSet trong một NetworkMessage, và Data Delta Frame với thông điệp KeepAlive. Đó là thư viện 1.3.0.0, và HotLoop Alarms 1.0.0.0 đi kèm không đổi.

Điều này có nghĩa với bạn: một dự án PLC đang dùng 1.2.0 sẽ gửi các byte như trước, chỉ khác một điểm thấy được, dấu thời gian nay có mili giây. Mọi thứ khác bạn bật bằng một lệnh gọi hoặc một đầu vào.

## Có gì mới

* **Dấu thời gian chính xác đến mili giây.** Cả NetworkMessage lẫn DataSetMessage đều mang mili giây của đồng hồ, nên bên đăng ký thấy được thời điểm mỗi thông điệp được tạo thay vì giây mà nó rơi vào. `bStampHighRes` cho biết thông điệp gần nhất dùng đồng hồ nào.
* **Trường WSTRING.** `AddWString(ADR(wName), N)` xuất bản một `WSTRING(N)` dưới dạng OPC UA String, trong Variant và trong RawData. Văn bản đi ra dưới dạng UTF-8: một ký tự trên U+FFFF, vốn là cặp thay thế trong PLC, đi ra thành một ký tự bốn byte, còn một thay thế lẻ đi ra thành U+FFFD, nên thứ bên đăng ký đọc luôn là văn bản hợp lệ. Trong RawData, MaxStringLength của trường là `3 * N` byte.
* **Trạng thái theo trường.** Sau khi thêm một trường, `SetStatus(ADR(udiStatus))` gắn nó với một UDINT chứa OPC UA StatusCode. Khi biến đó khác 0, trường được gửi đi dưới dạng StatusCode thay cho giá trị, và bên đăng ký đọc là chất lượng xấu. Đặt lại về 0 thì giá trị lại được gửi. Publisher RawData vẫn gửi giá trị, vì RawData không có cách nào mang trạng thái.
* **Nhiều DataSet trong một NetworkMessage.** `AddDataSet(uiWriterId, udiConfigMajor)` bắt đầu thêm một DataSet trong cùng khối: các trường bạn thêm sau đó thuộc về nó. Mỗi chu kỳ xuất bản, một NetworkMessage mang một DataSetMessage cho mỗi DataSet, với mảng Sizes mà Phần 14 yêu cầu, nên nhiều hơn một writer dùng chung một datagram. Tối đa 8 DataSet. Nếu bạn không bao giờ gọi nó, thông điệp là thông điệp mà 1.2.0 đã gửi.
* **Data Delta Frame và KeepAlive.** Một tập dữ liệu ổn định không còn phải gửi mọi trường ở mọi chu kỳ. Khi bật khung delta, publisher gửi trước một khung khóa đầy đủ và cứ mỗi `uiKeyFrameEvery` thông điệp, ở giữa là Data Delta Frame chỉ có các trường đã đổi, và KeepAlive khi không có gì đổi. `bDeltaActive`, `udiDeltaSent` và `udiKeepAliveSent` cho thấy nó đang làm gì.

## Điều gì thay đổi với dự án dùng 1.2.0

* Danh sách trường và định dạng trên đường truyền của bạn không đổi. Khác biệt duy nhất trên đường truyền là phần mili giây của dấu thời gian.
* HotLoop Alarms 1.0.0.0 có trong bản phát hành, không đổi.

## Thiết lập và giá trị mặc định

* `bHighResTimestamp` là `TRUE`: gắn dấu thời gian bằng mili giây của đồng hồ. Đặt `FALSE` để gắn giây nguyên, đúng như 1.2.0. Nếu runtime không cho được mili giây, khối tự gắn giây nguyên.
* `bDeltaFrames` là `FALSE`. Khung delta là một thiết lập bạn bật cho một publisher, không phải việc khối tự làm khi chưa được yêu cầu, nên mọi bên đăng ký bạn có vẫn đọc khung khóa đầy đủ. Để bật cho một writer, đặt `bDeltaFrames := TRUE` trên publisher đó và, nếu muốn khoảng cách khung khóa khác, đặt `uiKeyFrameEvery` (10 nếu bạn không đặt). Mỗi publisher tự quyết, nên một writer có thể gửi delta trong khi các writer khác thì không. Bên đăng ký bỏ qua khung delta sẽ thấy thay đổi ở khung khóa kế tiếp, vì vậy hãy bật cho những bên đọc được chúng. Nó áp dụng cho publisher Variant có một DataSet; publisher RawData, hoặc khối có nhiều hơn một DataSet, gửi khung khóa.
* `AddDataSet`, `AddWString` và `SetStatus` là các lệnh gọi bạn thực hiện một lần lúc khởi động, như các lệnh gọi `Add` khác. Không có chúng thì không có gì thay đổi.

## Nâng cấp

Cài `HotLoopTransmitter-1.3.0.library` (hoặc mở `.package` bằng CODESYS Installer), đổi phiên bản thư viện trong Library Manager của dự án thành 1.3.0.0 rồi biên dịch. Mã của bạn không cần thay đổi gì. Thêm các lệnh gọi mới khi bạn muốn điều chúng làm.

## Quay lại bản cũ

Dự án ghim ở 1.2.0 vẫn chạy và gửi các byte như trước, với dấu thời gian giây nguyên. HotLoop Alarms là thư viện riêng và không bị ảnh hưởng.

## Không có trong bản phát hành này

Bảo mật thông điệp, NetworkMessage phân mảnh, phía bên đăng ký và truyền tải MQTT.

## Tệp

```
e68cfc88e599ddcf278eb208ff500f4f78d3faf74edf12e38f308a009f478594  HotLoopAlarms-1.0.0.0.compiled-library
68f704fc5662bbc67ec097016a741065d705af01913a2746296c17f9e6991118  HotLoopAlarms-1.0.0.0.library
5be90a88e9e0aae1de421628fb6ca8e810dda96b4562566df345d451ecd859cf  HotLoopTransmitter-1.3.0.compiled-library
0410b98578fd55775a97b27023a0b5f30111cac0587120894354d9edca1248fc  HotLoopTransmitter-1.3.0.library
3e791358e6dc628a2d2aae760e0c49c89f1c4490f0637b65864c335fcbb3e9a0  HotLoopTransmitter-1.3.0.package
```
