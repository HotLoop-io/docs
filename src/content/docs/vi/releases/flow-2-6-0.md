---
title: "Ghi chú phát hành: HotLoop Flow 2.6.0"
description: "HotLoop Flow 2.6.0 có gì mới, điều gì thay đổi khi nâng cấp và nên đọc gì trước khi đụng vào một nhà máy đang chạy."
sidebar:
  label: "2.6.0"
---

HotLoop Flow 2.6.0 cho dây bền một cách để báo với bạn rằng nó đã ngừng chuyển giao. Không có gì về cách các luồng của bạn chạy thay đổi. Nếu bạn chạy dây bền trên một dây chuyền nhà máy, thứ bạn nhận được là một bộ đếm bạn có thể đặt cảnh báo cho lỗi duy nhất từng trông như một hàng đợi yên ắng.

## Có gì mới

**Một dây bền bị kẹt được đếm và mô tả.** Bơm của một dây bền giờ nhận ra khi dây báo có thông điệp đang chờ mà hàng đợi không chứa gì nó đọc được, và vẫn như vậy sau một lần kiểm tra lại ngắn. Nó cộng một vào `hotloop_flow_durable_wire_stranded_total{wire=...}` và ghi một cảnh báo vào nhật ký runtime, một lần cho mỗi loại lỗi, cùng các bộ đếm của dây bên cạnh những gì bảng của nó chứa: bơm đã đi đến đâu, độ sâu, số dòng trên đĩa, cái gì đang bay, và bao nhiêu đã được thêm, chuyển giao và bỏ. Trên một dây khỏe, bộ đếm là không và giữ nguyên không, nên mọi giá trị trên không đều đáng một cảnh báo.

Chúng tôi thêm nó vì một dây bỏ cái cũ nhất đã không xả hết một lần trong vài nghìn lần chạy thử và chúng tôi không bắt được lý do. Bản phát hành này là dụng cụ đo, không phải bản sửa. Nếu nó từng kích hoạt trên dây chuyền của bạn, dòng nhật ký là thứ chúng tôi cần.

## Có gì thay đổi

- Văn bản giấy phép đi kèm trong image viết EmberNet đúng như bản chuẩn. Ba dòng, chỉ chính tả.
- Các hình trong README là ảnh thường, sáng rồi tối, nên hiển thị được trên docs.hotloop.io.

## Cài đặt mới

Không có. Chỉ số đã được bật và không có công tắc.

## Nâng cấp

Chỉ cần `helm upgrade` lên image và chart 2.6.0, hoặc tag mới trong unit Quadlet của bạn. Không có gì xảy ra ở lần khởi động đầu tiên, không có gì để di chuyển, và các luồng, bản ghi triển khai và thông tin xác thực không bị đụng đến.

Image: `ghcr.io/hotloop-io/hotloop-flow:2.6.0`, linux/amd64 và linux/arm64. Chart: `https://hotloop.io/hotloop-flow/`. README ở tag này có phần còn lại, kèm hình: https://github.com/HotLoop-io/hotloop-flow/blob/v2.6.0/README.md
