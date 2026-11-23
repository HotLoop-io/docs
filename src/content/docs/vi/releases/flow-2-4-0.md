---
title: "Ghi chú phát hành: HotLoop Flow 2.4.0"
description: "HotLoop Flow 2.4.0 có gì mới, điều gì thay đổi khi nâng cấp và nên đọc gì trước khi đụng vào một nhà máy đang chạy."
sidebar:
  label: "2.4.0"
---

HotLoop Flow 2.4.0 cho phép bảng điều khiển EmberCORE đăng nhập mọi người vào Flow. Một người mở Flow từ bảng điều khiển vào bằng vai trò mà tenant của họ đã giao, toàn quyền hoặc chỉ đọc, không cần đăng nhập lần hai. Tính năng tắt trừ khi khóa của bảng điều khiển được cấu hình, và không có gì từng chạy thay đổi.

## Có gì mới

**Đăng nhập từ bảng điều khiển EmberCORE**
- Bảng điều khiển đặt một token do nó ký vào `X-Embernet-Assertion` trên mọi yêu cầu nó chuyển tiếp tới Flow, kể cả websocket của trình soạn thảo. Flow kiểm tra nó bằng khóa công khai của bảng điều khiển: chữ ký (ES256), bên phát hành (`embernet-dashboard`), việc nó được tạo cho Flow này trong tenant này (audience là `<tenant>/<release>`, nên token của ứng dụng khác không mở được gì ở đây) và hạn dùng, khoảng một phút. Một token sai ở bất kỳ điểm nào trong số đó bị từ chối, và không gì khác trong yêu cầu cứu được nó.
- Vai trò đến từ bản đồ vai trò của tenant trong bảng điều khiển. `*` là mọi quyền. `read` là các luồng, bảng nút, các cài đặt và trạng thái, và không gì thay đổi chúng: không triển khai, không inject, không nhật ký triển khai. Operator và Viewer nhận `read` theo mặc định. Một vai trò không phải hai loại đó, hoặc không có vai trò, là không có quyền truy cập. Người đăng nhập theo cách này hiện trong nhật ký triển khai và dấu vết kiểm toán dưới dạng `dashboard:<email>`.
- Không có phiên. Bảng điều khiển gửi một token mới ở mỗi yêu cầu, nên một vai trò đổi ở đó có hiệu lực ở yêu cầu kế tiếp và không có gì để thu hồi.
- Trình soạn thảo nói "Hãy mở từ bảng điều khiển EmberCORE" thay vì đưa ra biểu mẫu đăng nhập riêng, và bỏ nút Đăng xuất khi bảng điều khiển đã đăng nhập cho bạn. `GET /auth/mode` là cách nó hỏi, trước khi ai đó đăng nhập.
- Chart nhận nó dưới `embernetSignin`. App Store truyền khóa công khai của bảng điều khiển; chart gắn nó, ghi các cài đặt, khởi động lại pod và chú thích Service để bảng điều khiển biết cần đăng nhập mọi người.

## Có gì thay đổi

Không có gì, trừ khi bạn đặt khóa. Không có tệp khóa thì Flow hoàn toàn không đọc header, và một `helm template` của các giá trị mặc định vẫn như cũ.

## Nâng cấp

Chỉ cần `helm upgrade` lên image và chart 2.4.0. Không có gì xảy ra ở lần khởi động đầu tiên.

Để dùng thủ công, hãy gắn khóa công khai của bảng điều khiển (một tệp PEM) và đặt `auth.assertion.publicKeyFile` và `auth.assertion.audience`, hoặc `HOTLOOP_FLOW_ASSERTION_PUBLIC_KEY_FILE` và `HOTLOOP_FLOW_ASSERTION_AUDIENCE`. Flow từ chối khởi động với một khóa nó không đọc được hoặc không có audience. Các cài đặt khác là `auth.assertion.issuer` (`embernet-dashboard`), `header` (`X-Embernet-Assertion`) và `hideLogin` (`true`).

Đăng nhập quản trị và token API vẫn hoạt động bên cạnh. Chúng là lối thoát khẩn cấp cho nhân viên và tự động hóa, và việc biểu mẫu của trình soạn thảo biến mất không ảnh hưởng đến chúng.

Image: `ghcr.io/hotloop-io/hotloop-flow:2.4.0`, linux/amd64 và linux/arm64. Chart: `https://hotloop.io/hotloop-flow/`. README tại tag này có phần còn lại: https://github.com/HotLoop-io/hotloop-flow/blob/v2.4.0/README.md
