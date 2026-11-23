---
title: "Ghi chú phát hành: HotLoop Flow 2.9.1"
description: "HotLoop Flow 2.9.1 có gì mới, điều gì thay đổi khi nâng cấp và nên đọc gì trước khi đụng vào một nhà máy đang chạy."
sidebar:
  label: "2.9.1"
---

HotLoop Flow 2.9.1 cho phép nút `modbus-server` lắng nghe trên giao diện của một VLAN, nhờ đó một Flow có thể chạy một máy chủ trên mỗi VLAN của một cổng, cùng địa chỉ và cùng cổng.

## Có gì mới

- **`modbus-server` nhận một giao diện mạng.** Socket lắng nghe được gắn vào giao diện (`SO_BINDTODEVICE`) trước khi lắng nghe, nên hai máy chủ trên `192.168.1.9:10502` ở hai VLAN không còn va chạm. Cài đặt giống như trên mọi máy khách: **Giao diện mạng** của chính nút, nếu không thì `FLOW_NETWORK_INTERFACE` trong biến môi trường của tab. Không có cái nào thì nó lắng nghe như mọi khi, và hai máy chủ trên cùng một địa chỉ và cổng vẫn va chạm, giờ kèm một lỗi nói rằng mỗi máy cần một giao diện.

## Có gì thay đổi

- Khi chưa đặt, nó hoạt động như upstream. NOTICE và `HOTLOOP_PATCH.txt` nói điều gì đã đổi.

## Cài đặt mới

Không có gì ngoài trường **Giao diện mạng** trên `modbus-server`. Giá trị chart `bindToInterface.netRaw` và yêu cầu mạng host từ 2.9.0 áp dụng cho nó như cho các máy khách.

## Nâng cấp

Chỉ cần một lệnh `helm upgrade` lên ảnh và chart 2.9.1, hoặc tag mới trong đơn vị Quadlet của bạn. Không có gì xảy ra ở lần khởi động đầu và không cần di chuyển gì. Một flow không đặt giao diện nào hoạt động đúng như trên 2.9.0.

Ảnh: `ghcr.io/hotloop-io/hotloop-flow:2.9.1`, linux/amd64 trước, arm64 theo sau trong 2.9.2. Chart: `https://hotloop.io/hotloop-flow/`. README ở tag này có phần còn lại, kèm hình ảnh: https://github.com/HotLoop-io/hotloop-flow/blob/v2.9.1/README.md
