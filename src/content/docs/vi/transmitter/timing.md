---
title: "Transmitter thêm gì vào tác vụ của PLC"
description: "Chi phí đo được của publisher trên tác vụ chu kỳ 20 ms, và điều đó nói được và không nói được gì về bộ điều khiển thật."
---

Đo trên 1.1.0 với dấu thời gian bật. Runtime là CODESYS Control for Linux SL 4.22.0.0 ở chế độ demo, với tác vụ chu kỳ 20 ms gắn vào bốn lõi. Lần chạy xuất bản có hai publisher, một Variant và một RawData, mỗi cái gửi khoảng 1,1 KB mỗi 100 ms, nên cứ năm chu kỳ có một thông điệp đi ra. Thống kê được đặt lại 45 s sau khi runtime khởi động và đọc 240 s sau đó.

| Chỉ số | cơ sở (không publisher) | hai publisher, bật dấu thời gian |
|---|---|---|
| Thời gian trung bình trong `PLC_PRG` mỗi chu kỳ | 103 ns | 9 584 ns |
| Thời gian dài nhất trong `PLC_PRG` trong cửa sổ | 1 us | 81 us |
| Chu kỳ dưới 10 us | 11 997 trên 11 997 | 9 580 trên 11 976 |
| Chu kỳ từ 10 đến 50 us | 0 | 2 299 |
| Chu kỳ từ 50 đến 100 us | 0 | 97 |
| Chu kỳ từ 100 us trở lên | 0 | 0 |
| Thông điệp đã gửi / bị từ chối / khe bị bỏ qua | 0 / 0 / 0 | 2 849 / 0 / 3 |

Điều này cho thấy:

* **Một chu kỳ có gửi tốn từ 10 đến 100 us.** Khoảng 2 400 chu kỳ trong cửa sổ có gửi (một trong năm), nên các chu kỳ gửi là toàn bộ chi phí: 96 phần trăm trong số đó mất 10 đến 50 us và 4 phần trăm mất 50 đến 100 us, cho hai thông điệp khoảng 1,16 KB. Các chu kỳ ở giữa tốn bằng cơ sở.
* **Chi phí thêm trung bình khoảng 9,5 us mỗi chu kỳ 20 ms**, tức 0,05 phần trăm của tác vụ. Dấu thời gian là một lần đọc đồng hồ và thêm 17 byte mỗi thông điệp, và lần chạy này không cho thấy chi phí nào cho nó.
* **Không có lần gửi nào bị từ chối.** Ba khe xuất bản bị bỏ qua, nên tác vụ trễ ba lần. Khối không bao giờ chờ mạng, dù một lần gửi có thể chậm khi kernel bận, vì vậy hãy đọc con số dài nhất như giới hạn của phép đo, và đặt publisher vào một tác vụ riêng có mức ưu tiên thấp nếu tác vụ chính đã sát.

Điều này không cho biết: chi phí trên bộ điều khiển của bạn. Các số liệu này lấy từ một container trên máy chủ đa dụng. Một CPU ARM nhỏ có thể chậm hơn mười đến một trăm lần, và chi phí tăng theo kích thước danh sách trường. Hãy đo trên thiết bị đích bằng `udiLastCallUs`, `udiMaxCallUs`, `udiMaxEncodeUs` và `udiMaxSendUs` của khối, chúng có sẵn để làm việc này.
