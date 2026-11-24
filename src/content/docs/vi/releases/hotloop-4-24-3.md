---
title: "Ghi chú phát hành: HotLoop core 4.24.3"
description: "HotLoop core 4.24.3 có gì mới, điều gì thay đổi khi nâng cấp và nên đọc gì trước khi đụng vào một nhà máy đang chạy."
sidebar:
  label: "4.24.3"
---

4.24.3 đưa mọi thứ trong [4.24.2](/vi/releases/hotloop-4-24-2/) đến mọi bo mạch chúng tôi dựng cho: Shelly mọi thế hệ, camera ONVIF, Arduino qua Firmata, mật khẩu OPC UA độ dài bất kỳ, hàng đợi chuyển tiếp tự rỗng sau một liên kết chậm, `--version` nêu commit của nó, và bản cài HotLoop Edge mặc định khởi động được.

Gateway chạy trên amd64 và arm64, còn Edge, IoT và Edge Relay chạy trên amd64, arm64 và arm/v7, nên cùng một bản phát hành phủ máy chủ, các Pi và các cổng ARM cũ hơn của bạn. Hãy đọc [ghi chú 4.24.2](/vi/releases/hotloop-4-24-2/) để biết mọi thứ mới từ 4.24.0.

- Cả bốn chart (`hotloop`, `hotloop-iot`, `hotloop-edge`, `hotloop-edge-relay`) đều ở 4.24.3, với mọi phiên bản trước vẫn còn trong chỉ mục.
- Nâng cấp như mọi khi: `helm upgrade` lên chart 4.24.3, hoặc thẻ mới trong đơn vị Quadlet của bạn. Không cần di chuyển gì.
