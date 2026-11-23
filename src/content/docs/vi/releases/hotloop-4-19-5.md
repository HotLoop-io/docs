---
title: "Ghi chú phát hành: HotLoop core 4.19.5"
description: "HotLoop core 4.19.5 có gì mới, điều gì thay đổi khi nâng cấp và nên đọc gì trước khi đụng vào một nhà máy đang chạy."
sidebar:
  label: "4.19.5"
---

Đây là bản build đa kiến trúc của [4.19.4](/vi/releases/hotloop-4-19-4/) và không có gì khác. Mã là mã của cùng commit với phiên bản được tăng: không sửa lỗi, không tính năng, không thay đổi hành vi.

4.19.4 chỉ được build cho amd64, để nó đến được môi trường sản xuất và được đọc là stable trước khi các image arm được build. 4.19.5 build bộ đầy đủ: Gateway cho amd64 và arm64, còn Edge, IoT và Edge Relay cho amd64, arm64 và arm/v7. Một hộp arm chuyển từ các image nó đang chạy sang mã của 4.19.4 bằng cách kéo `stable`.

Hãy đọc [ghi chú của 4.19.4](/vi/releases/hotloop-4-19-4/) để biết mọi thứ đã thay đổi kể từ bản phát hành được công bố gần nhất.

- Cả bốn chart (`hotloop`, `hotloop-iot`, `hotloop-edge`, `hotloop-edge-relay`) đều ở 4.19.5, với mọi phiên bản trước vẫn nằm trong chỉ mục.
- Bản phát hành kế tiếp mang thay đổi sẽ đặt nó lại là `linux/amd64`.
