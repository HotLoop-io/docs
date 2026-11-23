---
title: "Ghi chú phát hành: HotLoop core 4.16.0"
description: "HotLoop core 4.16.0 có gì mới, điều gì thay đổi khi nâng cấp và nên đọc gì trước khi đụng vào một nhà máy đang chạy."
sidebar:
  label: "4.16.0"
---

Bản phát hành đầu tiên được công bố kể từ 4.3.1 hồi tháng 8. Mọi thứ từ 4.4.0 đến 4.15.3 đã được gộp nhưng chưa từng được phát hành, nên nếu đang dùng 4.3.1 bạn nhận tất cả cùng lúc, với tên mới, image mới, chart mới và giấy phép mới. **Từ 4.3.1 lên thì không phải chỉ cần một lệnh `helm upgrade` đơn giản.** Hãy đọc mục «Nâng cấp từ 4.3.1» bên dưới trước khi đụng vào một nhà máy đang chạy.

Ghi chú đầy đủ nằm trong README: Những gì thay đổi trong 4.16.0, và bên dưới là mọi phiên bản lùi về tận 4.4.0.

## Tóm tắt

- **HotLoop Core: thực thể.** Mỗi tag là một thực thể có id ổn định, đặt trên cây thiết bị theo ISA-95. Động cơ, van, vòng PID và phần còn lại là các thực thể ghép từ chính các tag của chúng, mỗi cảnh báo là một thực thể, và mọi lệnh gửi tới thực thể đều đi qua cùng cổng ghi như một lần ghi tag. Các agent (MCP), tự động hóa và hai màn hình mới Entities và Plant đều dùng chúng. Có thể hỏi trước một lệnh gọi dịch vụ bằng `?dry_run=true`, và dấu nhắc lệnh sẽ báo «Would be refused: ...» trước khi bạn xác nhận.
- **Thông báo đến tận điện thoại:** ntfy và bot Discord có nút Acknowledge, Gotify và webhook Discord, với giới hạn tần suất gom cả một loạt thông báo dồn dập thành một bản tóm tắt.
- **Các bản sửa quan trọng với nhà máy đang chạy:** bỏ hoãn (unshelve) có thể xóa một cảnh báo chưa xác nhận; một subscription OPC UA có thể im lặng mãi mãi trong khi phiên vẫn báo đã kết nối; một thiết bị Modbus im lặng mất tới 15 phút mới bị coi là ngừng; webhook lỗi ghi URL của nó vào log, mà với Discord và ntfy URL đó chính là mật khẩu; khôi phục nạp cột theo vị trí; mỗi lần triển khai lại đều thay chứng chỉ của máy chủ OPC UA nên Ignition thôi tin nó; Discover tags nhập mọi nút OPC UA thành float; màn hình Settings nêu tên các biến thăm dò mà không có gì đọc.
- **Ignition 8.3.9 đọc được máy chủ OPC UA của chúng tôi**, đã kiểm chứng từ đầu đến cuối, và máy chủ giờ báo `HotLoop` là nhà sản xuất.
- **Edge Relay ra mắt** với image và chart riêng, đồng bộ với Gateway. TimescaleDB 2.30.1, và phần mở rộng giờ tự cập nhật.

### Thay đổi API

- Danh sách rỗng luôn là `[]`, không bao giờ là `null`, ở mọi nơi, kể cả stream.
- Các khoảng của `/api/history` không có số đọc tốt là `null` (một khoảng trống), và số đọc xấu không được đưa vào giá trị trung bình.
- Lỗi mà API không xác định được là 500 kèm mã tham chiếu log, không phải 400. Thiết bị báo lỗi khi ghi hoặc duyệt trả về 502.
- Một dịch vụ mà thực thể cảnh báo không nhận (`alarm.turn_on`) là 400. Trước đây nó trả lời thành công và không làm gì.
- Bỏ hoãn một cảnh báo không bị hoãn là 409.
- JSON của tag luôn có `minValue`, `maxValue` và `hasRange`.
- Mới: `?dry_run=true` trên `POST /api/services/{domain}/{service}`. Chỉ nhận `true` hoặc `false`; giá trị khác là 400.

### Nâng cấp từ 4.3.1

- Image `ghcr.io/hotloop-io/hotloop` (trước là `ghcr.io/embernet-ai/industrial-iot`), kho chart `https://hotloop.io/hotloop`, chart `hotloop` (trước là `industrial-iot`), và mọi biến `IIOT_` đổi thành `HOTLOOP_`.
- Tên chart nằm trong các selector của workload, thứ mà Kubernetes không đổi tại chỗ. Giữ nguyên tên release và namespace, rồi làm như sau: `pg_dump` cơ sở dữ liệu; xóa Deployment cũ (`<release>`) và StatefulSet (`<release>-postgresql`), việc này để nguyên volume cơ sở dữ liệu; chạy `helm upgrade <release> hotloop/hotloop -f your-4.3.1-values.yaml`. Không dùng `--reuse-values`. Đổi tên mọi `IIOT_` trong `extraEnv` và bỏ phần ghi đè `image.repository`. Pod cơ sở dữ liệu mới gắn volume cũ và Gateway chuyển đổi nó lên bản mới khi khởi động.
- Giấy phép: điều khoản riêng của HotLoop, không phải điều khoản đi kèm 4.3.1. Miễn phí cho gia đình và phòng thí nghiệm; doanh nghiệp đăng ký miễn phí qua EmberNet. Điều khoản hiện hành nằm trong LICENSE.
- Có đăng nhập, quyền ghi mặc định tắt, và múi giờ không tải được sẽ dừng quá trình khởi động thay vì chạy tiếp bằng UTC.
