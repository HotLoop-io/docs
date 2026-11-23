---
title: "Ghi chú phát hành: HotLoop core 4.21.1"
description: "HotLoop core 4.21.1 có gì mới, điều gì thay đổi khi nâng cấp và nên đọc gì trước khi đụng vào một nhà máy đang chạy."
sidebar:
  label: "4.21.1"
---

Đây là bản build đa kiến trúc của [4.21.0](/vi/releases/hotloop-4-21-0/). Mã sản phẩm giống 4.21.0: đăng nhập X.509 cho máy chủ OPC UA, mật khẩu 72 byte, các chính sách bảo mật lỗi thời tắt theo mặc định và việc nhập cảnh báo CODESYS được mở rộng. 4.21.0 là bản build amd64, và `stable` giữ các image arm mà nó đã có.

4.21.1 build bộ đầy đủ: Gateway cho amd64 và arm64, còn Edge, IoT và Edge Relay cho amd64, arm64 và arm/v7. Hãy đọc [ghi chú của 4.21.0](/vi/releases/hotloop-4-21-0/) để biết mọi thứ đã thay đổi kể từ 4.20.2, kể cả việc `Basic128Rsa15` và `Basic256` cũng tắt khi nâng cấp.

- Cả bốn chart (`hotloop`, `hotloop-iot`, `hotloop-edge`, `hotloop-edge-relay`) đều ở 4.21.1, với mọi phiên bản trước vẫn nằm trong chỉ mục.
