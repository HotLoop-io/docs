---
title: "Ghi chú phát hành: HotLoop core 4.20.2"
description: "HotLoop core 4.20.2 có gì mới, điều gì thay đổi khi nâng cấp và nên đọc gì trước khi đụng vào một nhà máy đang chạy."
sidebar:
  label: "4.20.2"
---

Hai bản sửa trên [4.20.1](/vi/releases/hotloop-4-20-1/), và giấy phép. Đây là bản phát hành lõi đầu tiên theo EmberNet Source License 1.0 (`LicenseRef-EmberNet-Source-1.0`): LICENSE, NOTICE, README, các annotation của chart và nhãn của image đều ghi như vậy.

- **EtherNet/IP với nhiều hơn một tag trong một lô.** Driver yêu cầu `ReadMulti` của thư viện một lô, hàm này nhận một struct các trường có tag hoặc một map, và một tên tag thuần làm nó panic trong reflect trước khi một byte nào đi ra. Vì vậy mọi thiết bị EtherNet/IP có hai tag trở lên trong một lô đều làm vòng thăm dò của nó panic (lô mặc định là hai mươi). Không ai thấy trong thử nghiệm vì chưa có bài thử nào đặt một lô lên máy chủ. Giờ các bài thử chạy một máy chủ EtherNet/IP và một máy chủ S7 trong tiến trình, driver đọc chúng qua TCP, và lô đi qua `ReadList`. Một bộ điều khiển im lặng với socket còn mở sẽ ngừng trong vòng một lần thăm dò cộng thời gian chờ của nó, như đã định, và không còn bị hỏi lại từng tag một, điều từng giữ vòng thăm dò mất một thời gian chờ cho mỗi tag. S7comm và EtherNet/IP vẫn chưa được kiểm chứng với PLC vật lý.
- **`version` là một từ.** `podman run ghcr.io/hotloop-io/hotloop:4.20.1 version` từng chết với «database password is not set», vì chỉ `--version` được xử lý trước khi cấu hình được đọc. Giờ `version` in phiên bản với môi trường trống, cho Gateway, Edge và IoT, và cho Edge Relay.

- Không có migration, không có secret mới, không có thay đổi API. Một lệnh `helm upgrade` bình thường hoặc tự động cập nhật của Quadlet sẽ lấy nó.
- Cả bốn chart (`hotloop`, `hotloop-iot`, `hotloop-edge`, `hotloop-edge-relay`) đều ở 4.20.2, với mọi phiên bản trước vẫn nằm trong chỉ mục.
- Bản build này chỉ có amd64, và `stable` giữ các image arm mà nó đang có. Bản phát hành kế tiếp là một lần tăng phiên bản nhỏ để build các image arm.
