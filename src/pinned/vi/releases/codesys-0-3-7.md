---
title: "Ghi chú phát hành HotLoop for CODESYS 0.3.7"
description: "Chart 0.3.7 của HotLoop for CODESYS: bao bọc HotLoop 4.22.0 và chạy provisioner 0.3.2."
sidebar:
  label: "0.3.7"
---

## Có gì thay đổi

0.3.7 có trong chỉ mục `{{codesysChartRepo}}`, công bố ngày 2026-11-19.

- **Nó bao bọc HotLoop 4.22.0,** cho mọi thiết bị OPC UA PubSub trên cùng một địa chỉ và cổng một socket dùng chung, nên hai bên lắng nghe có thể ở trên một cổng UDP.
- **Provisioner nhận hai bên lắng nghe trên một cổng.** Provisioner 0.3.2 không còn từ chối hồ sơ đặt hai thiết bị `opcua-pubsub` trên một cổng.

Điều này có nghĩa với bạn: một hồ sơ có nhiều bên xuất bản PubSub trên một cổng cài và đọc được.

## Đã kiểm tra những gì

Cài mới với hồ sơ của chính thiết bị của runtime, hai bên lắng nghe PubSub trên cùng cổng UDP, một cảnh báo và một màn hình, cạnh runtime CODESYS Control for Linux SL 4.22.0.0 thật chạy thư viện Transmitter: mọi thứ được tạo mà không cần thao tác tay, các biến của PLC đọc tốt, cảnh báo nổ theo giá trị riêng của PLC, và cả hai bên lắng nghe đọc là đã kết nối. Với một bên xuất bản thật ở cả hai kiểu mã hóa, mỗi một trong 32 trường đều đọc tốt và bằng với PLC. Xóa cả hai pod và khởi động lại runtime: HotLoop tự trở lại với ba thiết bị của nó.
