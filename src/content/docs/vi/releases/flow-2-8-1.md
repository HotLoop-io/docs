---
title: "Ghi chú phát hành: HotLoop Flow 2.8.1"
description: "HotLoop Flow 2.8.1 có gì mới, điều gì thay đổi khi nâng cấp và nên đọc gì trước khi đụng vào một nhà máy đang chạy."
sidebar:
  label: "2.8.1"
---

HotLoop Flow 2.8.1 là 2.8.0 thêm image arm64, và không gì khác. 2.8.0 chỉ ra cho amd64 để lên môi trường chạy thật trước và được ghi là ổn định, và đây là bước nhỏ tiếp theo dựng cả hai. Mã nguồn, chart, cài đặt và các flow của bạn không thay đổi.

## Có gì thay đổi

- Ảnh lại được xây dựng cho linux/amd64 và linux/arm64. Các tag `2.8.1`, `2.8` và `2` đều chứa cả hai.
- README và các trang cài đặt nêu 2.8.1 và ghi amd64 và arm64, như trước 2.8.0.

## Cài đặt mới

Không có.

## Nâng cấp

Chỉ cần `helm upgrade` lên image và chart 2.8.1, hoặc tag mới trong unit Quadlet của bạn. Nếu bạn dùng arm64 và ở lại 2.7.1 trong lúc 2.8.0 chỉ có amd64, đây là bước của bạn sang các nút phân tích, nút thu thập dữ liệu, đầu ra MQTT bền và nhật ký TDMS: hãy đọc ghi chú 2.8.0 để biết chúng là gì và điều gì chưa được chứng minh. Không có gì xảy ra ở lần khởi động đầu tiên và không cần di chuyển gì.

Image: `ghcr.io/hotloop-io/hotloop-flow:2.8.1`, linux/amd64 và linux/arm64. Chart: `https://hotloop.io/hotloop-flow/`. README ở tag này có phần còn lại, kèm hình: https://github.com/HotLoop-io/hotloop-flow/blob/v2.8.1/README.md
