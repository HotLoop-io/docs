---
title: "Hồ sơ"
description: "Đầu vào duy nhất của HotLoop for CODESYS: một tệp JSON có bản sửa đổi, thiết bị cùng các biến, các báo động và một màn hình, và cách bộ cấp phát áp dụng nó."
sidebar:
  label: "Hồ sơ"
---

Hồ sơ là một tệp JSON trong một Secret ở namespace của bản cài đặt, dưới khóa `profile.json`. Nó không nằm trong chart hay trong image của bộ cấp phát, nên cả hai đều chung và công khai, và không thứ nào nêu tên biến của bất kỳ ai. Người cài ứng dụng cung cấp nó. Trên EmberNet, Store ghi nó dưới tên `<release>-profile`.

Bộ cấp phát đọc lại nó ở mỗi lượt, nên hồ sơ mới hơn đến được một bản cài đang chạy mà không cần khởi động lại.

## Hình dạng

| Khóa | Nội dung |
|---|---|
| `revision` | Một số nguyên từ 1. Màn hình và các báo động chỉ được thay khi nó cao hơn bản sửa đổi đã tạo ra chúng. |
| `device` | `id`, `name`, `options` (các tùy chọn của trình kết nối, như `browseRoot`, `arrayElements` và `browseMaxNodes`) và `points`, tên các biến mà HotLoop giữ từ PLC. |
| `alarms` | Các định nghĩa báo động của HotLoop, mỗi định nghĩa có một `id`. |
| `dashboard` | Một màn hình HotLoop, có một `id`. [Bảng điều khiển](/vi/iot/dashboards/) là một danh sách thẻ. |

Một hồ sơ tạo một màn hình. Nó tạo một thiết bị từ `device`, hoặc nhiều thiết bị từ `devices`, được mô tả tiếp theo.

## Danh sách thiết bị

Hồ sơ có thể mang `devices` bên cạnh `device` hoặc thay cho nó. Mỗi mục là phần thân của `POST /api/devices` của HotLoop (`id`, `name`, `protocol`, `address`, `enabled`, `pollIntervalMs`, `timeoutMs` và `config`, khối riêng của giao thức) cùng `tags` của nó, các bộ mô tả mà HotLoop nhập cho thiết bị: `name`, `address`, `dataType` và tùy chọn `unit`, `description` và `deviceClass`. Điều đó bao gồm một trình lắng nghe OPC UA PubSub (UADP) với các `dataSets` RawData của nó, một máy khách OPC UA và nhiều thiết bị trong một hồ sơ. Ở mỗi lượt:

- thiết bị mà HotLoop chưa có sẽ được tạo, còn thiết bị đã có thì để yên, nên chỉnh sửa của một người được giữ cho đến khi `revision` của hồ sơ cao hơn bản đã tạo ra thiết bị;
- mọi tag của hồ sơ mà thiết bị còn thiếu đều được nhập, chỉ đọc;
- không điều nào trong số này chờ máy chủ OPC UA của nút, nên trình lắng nghe chỉ lắng nghe, và một runtime đang ngừng hoặc đang khởi động lại không giữ chân thứ gì khác (`device` đơn lẻ vẫn đọc runtime, và một lượt khi nó ngừng sẽ nói điều đó và thử lại);
- khi không có `devices`, hồ sơ hoạt động đúng như trước, và khi có cả hai thì cả hai cùng áp dụng.

Điều này có nghĩa với bạn: một trình lắng nghe PubSub, như trình được cấp dữ liệu bởi [HotLoop Transmitter](/vi/transmitter/overview/), quay lại đã được cấu hình sẵn mà không cần PLC nào để đọc.

## Một ví dụ

Đây là hồ sơ đứng sau các ảnh chụp trong [phần tổng quan](/vi/codesys/overview/), đối với chương trình demo của HotLoop. `GVL_Demo` là danh sách biến của chương trình demo, và các nhãn là bịa ra.

```json
{
  "revision": 2,
  "device": {
    "id": "line-2",
    "name": "Line 2 PLC",
    "options": {"browseRoot": "Application.GVL_Demo", "arrayElements": 4, "browseMaxNodes": 500},
    "points": ["GVL_Demo.bRun", "GVL_Demo.rTemp", "GVL_Demo.udiCycles", "GVL_Demo.nEcho", "GVL_Demo.rEcho", "GVL_Demo.rReadOnly"]
  },
  "alarms": [
    {"id": "line-2-mixer-hot", "name": "Mixer temperature high", "tagName": "GVL_Demo.rTemp", "condition": "hi", "limit": 20, "deadband": 0.5, "priority": 2, "message": "{device}/{tag} at {value}, limit {limit}"}
  ],
  "dashboard": {
    "id": "line-2-screen", "name": "Line 2", "description": "The Line 2 screen.", "kind": "cards", "roles": [], "homeFor": [], "screens": [],
    "cards": [
      {"id": "t", "type": "value", "title": "Mixer temperature", "w": 3, "h": 2, "config": {"tag": "line-2/GVL_Demo.rTemp", "decimals": 1}},
      {"id": "tr", "type": "trend", "title": "Mixer temperature, last 15 minutes", "w": 6, "h": 3, "config": {"tags": ["line-2/GVL_Demo.rTemp"], "minutes": 15}},
      {"id": "al", "type": "alarms", "title": "Line 2 alarms", "w": 6, "h": 3, "config": {"outstanding": true, "limit": 8}}
    ]
  }
}
```

`tag` của một thẻ là id của thiết bị, một dấu gạch chéo và tên của điểm. Các loại thẻ, điều kiện báo động và các khóa còn lại của một màn hình giống như trong [bảng điều khiển](/vi/iot/dashboards/) của HotLoop và [API HTTP](/vi/iot/api/).

## Bộ cấp phát làm gì với nó

- **Nó tạo thiết bị** nếu chưa có, và thêm mọi biến trong `points` mà PLC có còn thiết bị thì chưa.
- **Nó không bao giờ ghi vào PLC.** Mọi tag nó tạo đều chỉ đọc, và hồ sơ không có cách nào đánh dấu một tag là ghi được.
- **Nó tạo các báo động và màn hình** khi chúng thiếu, và chỉ thay chúng khi `revision` cao hơn bản đã tạo ra chúng. Vì vậy, một thay đổi mà một người đã làm trên màn hình trong HotLoop vẫn còn cho đến khi một hồ sơ mới hơn được phát hành có chủ ý.
- **Nó tiếp tục xem xét.** Mỗi năm phút, và sớm hơn sau một lượt không thể hoàn tất, vì runtime hoặc HotLoop chưa trả lời.
