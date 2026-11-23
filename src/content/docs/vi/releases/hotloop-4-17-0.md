---
title: "Ghi chú phát hành: HotLoop core 4.17.0"
description: "HotLoop core 4.17.0 có gì mới, điều gì thay đổi khi nâng cấp và nên đọc gì trước khi đụng vào một nhà máy đang chạy."
sidebar:
  label: "4.17.0"
---

Giai đoạn 2 của nền tảng tự động hóa, UniFi chỉ đọc, và mật khẩu thiết bị được mã hóa khi lưu. Từ 4.16.0 lên chỉ là một lệnh `helm upgrade` bình thường, nhưng mật khẩu thiết bị của bạn được mã hóa ở lần khởi động đầu tiên, và từ đó khóa trở thành một phần dữ liệu của bạn. Hãy đọc mục «Nâng cấp từ 4.16.0» bên dưới trước khi đụng vào một nhà máy đang chạy.

Ghi chú đầy đủ nằm trong README: Những gì thay đổi trong 4.17.0.

## Tóm tắt

- **Nền tảng tự động hóa, giai đoạn 2.** Helper (các giá trị thuộc về người trong nhà máy, bị từ chối chứ không bao giờ bị cắt), logbook (một dòng thời gian duy nhất gồm thay đổi trạng thái, lần ghi, cảnh báo, lần chạy và cấu hình), các bước điều kiện, chờ và dừng cùng `forSec` trên trigger trạng thái, script (viết chu trình CIP một lần, chạy từ bất cứ đâu), công thức (mọi setpoint của một mác sản phẩm được gửi cùng nhau hoặc không cái nào được gửi, đọc lại từ thiết bị) và blueprint (một quy tắc viết một lần, điền cho từng máy bơm, ghim vào phiên bản của nó cho đến khi có người xem xét bản nâng cấp). MCP tăng từ 16 lên 25 công cụ.
- **UniFi Network, chỉ đọc.** Switch, cổng, PoE, WAN và máy khách dưới dạng tag, một lần đăng nhập cho mỗi bảng điều khiển, chứng chỉ được ghim. Ngăn kéo của một PLC im lặng cho biết nó cắm vào cổng switch nào và liên kết có lên không, và một thiết bị lạ trên mạng được đánh dấu là OT sẽ kích hoạt cảnh báo. Đã kiểm chứng ở chế độ chỉ đọc trên bảng điều khiển thật. **Chưa kiểm chứng:** rút cáp thật trên một thiết bị đang được theo dõi và một điện thoại tham gia mạng được đánh dấu là OT. Hai cảnh báo đó mới được kiểm chứng khi thử nghiệm và chưa ở đâu khác, cho đến khi có người làm cả hai trên tủ rack.
- **Mật khẩu thiết bị được mã hóa** trong cơ sở dữ liệu và trong bản sao lưu, bằng một khóa mà chart tạo ra trong `<release>-secret-key` và giữ lại.
- **Các bản sửa mà nhà máy đang dùng 4.16.0 có thể vấp phải:** Edge Relay từ chart hoặc từ unit Quadlet bỏ qua mọi cấu hình được đẩy tới, và Edge Relay tắt lưu trữ bền thì không khởi động; chỉnh sửa tay trong trình soạn quy tắc làm đặt lại ngân sách lượt chạy của quy tắc; phán quyết của dấu nhắc lệnh có thể dời Set ra khỏi chỗ vừa nhấp; một bản cập nhật đến muộn có thể đưa màn hình Entities lùi về quá khứ; một quy tắc chưa từng chạy lại báo đã chạy cách đây 739887 ngày; các lần triển khai từ App Store không mang tenant.

### Thay đổi API

- Một thời điểm chưa xảy ra sẽ được bỏ đi, không gửi dưới dạng `0001-01-01T00:00:00Z`: `lastRun`, `lastPoll`, `lastGood`, `clearedAt`, `ackedAt`, `shelvedUntil`, `raisedAt` và các trường còn lại, kể cả trên live feed.
- Route mới: `/api/helpers`, `/api/logbook`, `/api/scripts`, `/api/recipes`, `/api/blueprints`, `POST /api/automations/{id}/blueprint-upgrade`, `/api/devices/{id}/network`, `/api/unifi/{id}/...` và `DELETE /api/fleet/{id}/config`. Tất cả có trong docs/API.md.
- Quyền mới, và vai trò operator có các quyền này: `helpers.write`, `scripts.run`, `recipes.apply`, `blueprints.apply`. Viết script, công thức và blueprint là việc của quản trị viên.
- Tag mang `deviceClass`; quy tắc mang `blueprintId`, `blueprintVersion` và `blueprintInputs`.

### Nâng cấp từ 4.16.0

- `helm upgrade <release> hotloop/hotloop --version 4.17.0 --reset-then-reuse-values`. Không dùng `--reuse-values`, vì nó làm mất các giá trị mặc định mới và render bị lỗi. Selector và volume claim không đổi; đối tượng mới duy nhất là Secret của khóa.
- Các migration từ 0009 đến 0015 chạy khi khởi động (helper, logbook, script, lớp thiết bị của tag, công thức, blueprint, UniFi). Tất cả đều là bổ sung. Hãy `pg_dump` trước.
- `HOTLOOP_SECRET_KEY_FILE`: chart tạo khóa trong lần nâng cấp này, và Gateway mã hóa mọi mật khẩu thiết bị đã lưu ở lần khởi động đó. Sau này nếu thiếu khóa, các thiết bị đó vẫn ngừng hoạt động kèm một lỗi nêu tên khóa. Bản sao lưu tạo sau khi nâng cấp chỉ khôi phục được với khóa đó, hoặc với `--restore-keep-unreadable-credentials`, tùy chọn để các thiết bị đó ngừng hoạt động cho đến khi có người nhập lại mật khẩu. Hãy cất Secret tách khỏi các bản sao lưu của bạn. Quay lại 4.16.0 nghĩa là khôi phục bản dump trước khi nâng cấp.
- Bạn render chart bằng `helm template` thay vì cài đặt? Hãy mang khóa riêng vào `secretKey.existingSecret`, nếu không mỗi lần render sẽ tạo một khóa mới.
- Edge Relay: tệp thiết bị được đẩy nằm ở `/data/pushed-devices.json` và được ưu tiên hơn `devices` của chart khi nó còn tồn tại; `DELETE /api/fleet/{id}/config` sẽ xóa nó. Một lần đẩy bị lỗi trên 4.16.0 vẫn được giữ lại ở broker và tới nơi ở lần khởi động 4.17.0 đầu tiên. Người dùng Quadlet lấy unit mới. Với `persistence.enabled=false` nó giờ đã khởi động được, nhưng mất hàng đợi chuyển tiếp, mọi tệp được đẩy và chứng chỉ OPC UA mỗi khi pod bị thay thế.
