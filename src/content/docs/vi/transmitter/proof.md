---
title: "Những gì đã được chạy"
description: "Thư viện được dựng bằng gì, chạy trên gì, ai đọc lại, và điểm duy nhất mà hai bộ đọc bất đồng."
---

Trang này là lần chạy của 1.0.0. Lần chạy của 1.1.0, với dấu thời gian và `.package`, nằm trong [ghi chú phát hành 1.1.0](/vi/releases/transmitter-1-1-0/). Từ đó thư viện đã được chạy trên phần cứng không có hệ điều hành (2026-11-17).

## Bản dựng

* Thư viện: biên dịch với 0 lỗi và 0 cảnh báo trong ScriptEngine của CODESYS 3.5.22.30 (SP22 Patch 3).
* Ứng dụng mẫu, dựng dựa trên thư viện đã cài, cho thiết bị CODESYS Control for Linux SL (4102, 0000 0005, 4.20.0.0): 0 lỗi, 0 cảnh báo, sẵn sàng để tải xuống.

## Runtime

CODESYS Control for Linux SL 4.22.0.0 nạp ứng dụng như một dự án khởi động và báo `Application started`, `CODESYS Control ready`. Nó chạy ở chế độ demo, vì không có giấy phép runtime.

## Cái gì đã đi qua đường truyền, và ai đã đọc nó

Ứng dụng mẫu có hai publisher: writer group 1 và dataset writer 1 theo mã hóa Variant (1142 byte), và writer group 2 và dataset writer 2 theo mã hóa RawData (1144 byte). Mỗi bên mười bảy trường: mỗi kiểu mà thư viện hỗ trợ một trường, một mảng REAL 250 phần tử, một mảng INT 4 phần tử và hai bộ đếm.

Bốn bộ đọc độc lập đã đọc nó.

| Bộ đọc | Là gì | Variant | RawData |
|---|---|---|---|
| Một bộ giải mã viết từ đặc tả | chỉ viết từ OPC 10000-14 và 10000-6, đồng thời đọc cùng các biến đó từ máy chủ OPC UA của runtime và so sánh | mọi trường bằng giá trị của PLC, không có khoảng trống trong số thứ tự NetworkMessage và DataSetMessage suốt phiên ghi | giống vậy |
| Một ngăn xếp OPC UA PubSub độc lập | một subscriber có metadata DataSet của 17 trường | cả 15 giá trị được kiểm tra đều bằng nhau, gồm chuỗi, cả hai mảng và TIME | 11 giá trị vô hướng kiểu số bằng nhau. Ngăn xếp đó không đọc chuỗi RawData ở bất kỳ độ dài nào và hoàn toàn không đọc mảng RawData |
| Subscriber UADP của HotLoop core | driver trong HotLoop core 4.19.4 và mọi bản phát hành sau đó, chạy với một runtime đang hoạt động và được cho biết bố cục RawData trong các kiểu DataSet | 21 giá trị được kiểm tra bằng nhau, gồm chuỗi, TIME và các phần tử 0, 1, 124 và 249 của mảng REAL 250 phần tử cùng cả bốn phần tử của mảng INT, và cả hai bộ đếm tăng giữa hai lần đọc cách nhau 3 giây | cùng 21 giá trị và cùng hai bộ đếm. Nhận 62 key frame, không cái nào bị từ chối |
| Bộ giải mã thứ hai | bộ giải mã UADP trong mã bên nhận của chính chúng tôi, chạy trên 222 datagram đã ghi với bố cục của 17 trường | giải mã cả 111 thông điệp, mọi giá trị được kiểm tra đều đúng | giải mã cả 111 thông điệp, mọi giá trị được kiểm tra đều đúng, các mảng có độ dài Int32 và phần đệm |

## Mảng và chuỗi RawData

Thư viện này ghi số phần tử Int32 trước mỗi mảng RawData, và một chuỗi dưới dạng độ dài Int32, các byte của nó, rồi đệm số không cho đến MaxStringLength. Đó là điều mà ngăn xếp tham chiếu của OPC Foundation làm, và nó theo đúng văn bản đặc tả: OPC 10000-14 7.2.4.5.11 ("handled like a Structure DataType", đệm "to the maximum size indicated by ArrayDimensions or MaxStringLength") cùng OPC 10000-6 5.2.5 ("One dimensional Arrays are encoded as a sequence of elements preceded by the number of elements encoded as an Int32 value").

Subscriber của HotLoop core và bộ giải mã thứ hai đều đọc mảng RawData theo cách này, với độ dài và phần đệm, và cả hai đều giải mã được RawData của thư viện này.

Một điểm khác với ngăn xếp tham chiếu: khi chuỗi dài hơn MaxStringLength, ngăn xếp đó ném ngoại lệ, còn thư viện này cắt chuỗi tại ranh giới ký tự, vì một tác vụ PLC không có chỗ nào để ném ngoại lệ.

## Cần biết

* Lần chạy diễn ra trên CODESYS Control for Linux SL 4.22.0.0 trên x86-64. Thư viện là Structured Text, và phần xử lý thứ tự byte cho đích big endian đã được viết, nhưng bạn phải kiểm tra trên bộ điều khiển của mình.
* Multicast: khối đặt TTL, loopback và giao diện gửi cho một nhóm multicast. Hãy kiểm tra nhóm trên mạng của bạn.
* Khối đếm các lần gửi lỗi và lùi lại khi mạng biến mất hoặc một địa chỉ không có mặt, và chương trình vẫn tiếp tục quét.
* Ở chế độ demo, runtime dừng khi hết cửa sổ hai giờ, như CODESYS nêu.
