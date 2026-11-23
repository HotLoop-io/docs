---
title: "Tự động hóa"
description: "Quy tắc với mười loại trình kích hoạt, điều kiện và chuỗi bước, được biên dịch khi lưu, mọi thao tác ghi đều đi qua cổng ghi."
---

Một quy tắc gồm ba thứ: có việc xảy ra, một điều kiện đúng, các hành động chạy.

Quy tắc có thể điều khiển thiết bị, nên có hai tính chất không thể thương lượng.

**Điều kiện được biên dịch khi lưu quy tắc, không phải khi nó kích hoạt.** Lỗi cú pháp được tác giả thấy ngay khi còn đang nhìn trình soạn thảo, thay vì một quy tắc âm thầm không bao giờ chạy hoặc tệ hơn, một quy tắc báo lỗi lúc 3 giờ sáng giữa một chuỗi bước đã chạy được một nửa. Trình soạn thảo kiểm tra khi bạn gõ; quy tắc không biên dịch được sẽ bị từ chối khi lưu.

**Điều kiện được đánh giá trong môi trường biệt lập.** [expr-lang](https://expr-lang.org) không có I/O, không chạm tới hệ thống tệp hay mạng, kiểm tra kiểu khi biên dịch và được bảo đảm sẽ kết thúc. Tính chất cuối cùng quan trọng nhất: điều kiện được đánh giá trên đường dẫn tới một thao tác ghi, và một ngôn ngữ biểu thức có thể lặp mãi là thứ có thể làm treo engine đang giữ khóa ghi.

## Trình kích hoạt

Chỉ cần một trình kích hoạt bất kỳ kích hoạt là quy tắc chạy.

| Loại | Kích hoạt khi | Trường chính |
|---|---|---|
| `tag_change` | giá trị của một tag thay đổi | `deviceId`, `tagName` |
| `threshold` | một giá trị **vượt qua** một ngưỡng | `deviceId`, `tagName`, `threshold`, `direction`, `hysteresis` |
| `state` | trạng thái của một thực thể thay đổi, hoặc giữ một trạng thái trong một khoảng thời gian | `entityId`, `from`, `to`, `forSec` |
| `schedule` | một biểu thức cron đến hạn | `cron` |
| `interval` | cứ N giây | `intervalSec` |
| `alarm` | một báo động chuyển sang một trạng thái | `alarmId`, `alarmState` |
| `device_state` | một thiết bị kết nối hoặc rớt kết nối | `deviceId`, `toState` |
| `webhook` | một POST đến | `webhookPath` |
| `mqtt` | một thông điệp đến một topic | `topic` |
| `startup` | tiến trình khởi động | n/a |
| `sun` | bình minh, mặt trời mọc, trưa, mặt trời lặn hoặc chạng vạng tại địa điểm, có thể lệch một khoảng | `event`, `offsetSec` |

### Ngưỡng kích hoạt khi vượt qua

`threshold` kích hoạt khi một giá trị *vượt qua* ngưỡng, không phải khi nó nằm trên ngưỡng. Kích hoạt theo "giá trị lớn hơn 200" nghĩa là quy tắc kích hoạt ở mọi lần quét giá trị còn cao, mà với một quy tắc điều khiển thứ gì đó thì đó là cơn bão lệnh.

`hysteresis` ngăn một giá trị lơ lửng quanh ngưỡng khỏi việc kích hoạt lại quy tắc ở mỗi lần dao động: một khi đã ở trên, giá trị phải xuống dưới `threshold - hysteresis` thì trình kích hoạt mới có thể kích hoạt lần nữa.

```json
{
  "type": "threshold",
  "deviceId": "press-01", "tagName": "Zone1_Temp",
  "threshold": 200, "direction": "rising", "hysteresis": 5
}
```

`direction` là `rising`, `falling` hoặc `either`. Lần đọc đầu tiên sau khi khởi động thiết lập một mốc chuẩn và không kích hoạt, nếu không thì mọi quy tắc ngưỡng sẽ kích hoạt một lần lúc khởi động bất kể giá trị là gì.

### Trình kích hoạt trạng thái theo dõi thực thể

`state` kích hoạt khi chuỗi trạng thái của một thực thể thay đổi: `off` sang `on`, `212.5` sang `213`, `on` sang `unavailable`. `from` và `to` thu hẹp nó. Bỏ cả hai thì nó kích hoạt ở mọi thay đổi, kể cả sang và từ `unavailable`, thường là điều bạn muốn cho "báo cho ai đó" và không bao giờ là điều bạn muốn cho "điều khiển thứ gì đó". Hãy nêu `to`.

```json
{
  "type": "state",
  "entityId": "binary_sensor.press_01_run",
  "from": "off", "to": "on"
}
```

Nó kích hoạt theo trạng thái và không gì khác. Một thuộc tính thay đổi, hoặc chất lượng xấu đi trong khi trạng thái giữ giá trị tốt cuối cùng, không phải là thay đổi trạng thái.

Đây là chính xác lúc nó kích hoạt, vì một quy tắc điều khiển thiết bị xứng đáng được biết. Trình kích hoạt theo dõi bản ghi riêng của engine thực thể về điều gì đã thay đổi, không phải bus tag. Engine tính trạng thái của thực thể khi các lần đọc đến, và mỗi giây tính lại tất cả như một mạng lưới an toàn cho một lô nó không kịp xử lý. Mỗi thay đổi nó tính ra được báo một lần, theo thứ tự, và trình kích hoạt thấy từng cái một. Vì vậy:

- **Nó kích hoạt một lần cho mỗi thay đổi.** Lần tính lại mỗi giây chỉ báo những gì đã dịch chuyển kể từ lần engine nhìn trước, nên nó không thể báo một thay đổi hai lần, và việc nạp lại quy tắc không đặt lại thứ gì mà trình kích hoạt trạng thái phụ thuộc.
- **Nó không bỏ sót thay đổi mà engine đã thấy.** Bus chậm tốn một giây độ trễ, chứ không mất thay đổi.
- **Nó không thể thấy thay đổi mà không ai thấy.** Một cuộn coil chuyển off, on, off giữa hai lần thăm dò thì với nhà máy là chưa từng thay đổi. Trình kích hoạt trạng thái chỉ tốt bằng vòng quét phía sau nó và không hơn. Nếu bạn cần mọi sườn của một tín hiệu nhanh, hãy chốt nó trong PLC.
- **Khởi động là mốc chuẩn.** Mọi thực thể xuất hiện khi Gateway khởi động, hoặc khi một thực thể được bật, không phải là thay đổi và không kích hoạt.

Nếu các quy tắc từng chậm 10.000 thay đổi (cơ sở dữ liệu quá chậm để ghi các lần chạy mà chúng khởi tạo), những cái cũ nhất bị bỏ, được đếm và ghi nhật ký, và `GET /api/diagnostics` hiển thị `stateChangesPending` và `stateChangesDropped` dưới `automations`.

Đổi tên một thực thể và mọi quy tắc nêu `entity_id` cũ của nó ngừng kích hoạt. Đó là cái giá của những cái tên có ý nghĩa; hãy đổi tên có chủ đích, và tìm trong các quy tắc trước.

### Giữ một trạng thái: forSec

"Máy bơm đã chạy năm phút" là trình kích hoạt trạng thái với `forSec`. Thay đổi bắt đầu một bộ hẹn giờ thay vì kích hoạt quy tắc; quy tắc kích hoạt khi trạng thái nó đã chuyển sang được giữ đủ số giây đó.

```json
{
  "type": "state",
  "entityId": "binary_sensor.press_01_run",
  "from": "off", "to": "on",
  "forSec": 300
}
```

- **Mọi thay đổi trạng thái đều hủy nó.** On sang off rồi lại on trong vòng năm phút là hai thay đổi: cái đầu kết thúc lần giữ, cái sau bắt đầu lần mới từ không. Nó không cộng dồn thời gian. Rớt xuống `unavailable` cũng là một thay đổi trạng thái, nên thiết bị im bặt giữa chừng sẽ hủy lần giữ.
- **Chỉ trạng thái được tính.** Thuộc tính thay đổi, hoặc chất lượng xấu đi trong khi trạng thái vẫn giữ, không hủy nó, cũng như không kích hoạt một trình kích hoạt trạng thái thông thường. Nếu một lần giữ không được sống sót qua một lần đọc xấu, hãy bảo vệ điều kiện của quy tắc bằng `qualities`.
- **Nó kích hoạt một lần cho mỗi lần giữ.** Giữ một giờ chỉ kích hoạt quy tắc năm phút một lần, ở phút thứ năm, không phải mỗi năm phút.
- **Mỗi quy tắc có bộ hẹn giờ riêng**, mỗi trình kích hoạt một cái. Hai quy tắc trên cùng một thực thể với `forSec` khác nhau kích hoạt mỗi cái vào giờ của nó.
- **Dấu vết nói rõ.** Một lần chạy do lần giữ kích hoạt hiển thị `binary_sensor.press_01_run changed from off to on and held for 300s`, và `fromState`, `toState` cùng `entity` là của thay đổi đã bắt đầu lần giữ.
- **Lần giữ không sống sót qua khởi động lại.** Nó được lưu trong bộ nhớ và không gì kích hoạt lại nó: số phút máy ép đã giữ trước khi khởi động lại không được tính sau đó. Điều tiến trình thấy khi quay lại là mọi thực thể xuất hiện (một mốc chuẩn, không phải thay đổi), thường là `unknown`, rồi lần đọc đầu tiên của thiết bị chuyển nó sang giá trị đọc được. Với `"from": "off"` thì điều đó không khớp, nên một máy ép đang chạy trước khi khởi động lại không bắt đầu lần giữ nào, và quy tắc kích hoạt vào lần tới máy ép chuyển từ off sang on và chạy năm phút. Không có `from` thì tùy vào một cuộc chạy đua bạn không kiểm soát. Nếu lần đọc đầu đến sau khi các quy tắc đã lắng nghe, đó là một thay đổi, `unknown` sang `on`, và nó bắt đầu lần giữ từ không: quy tắc kích hoạt năm phút sau đó, và dấu vết của nó ghi `changed from unknown to on`. Nếu thiết bị trả lời nhanh hơn lúc Gateway lên, máy ép đơn giản là `on` từ đầu, không có gì thay đổi, và không gì kích hoạt cho đến lần nó đổi tiếp theo. Hãy nêu `from` khi khởi động lại không được tính là một lần khởi động máy, và đừng viết quy tắc cần điều đó. Sửa, vô hiệu hóa hoặc xóa quy tắc cũng bỏ các lần giữ của nó; lưu quy tắc khác thì không.
- **Một thực thể biến mất giữa lần giữ** (bị tắt, hoặc bị xóa cùng thiết bị của nó) không bao giờ kích hoạt nó.

`forSec` tối đa một ngày (86400), và chỉ trình kích hoạt `state` nhận nó. Nó được kiểm tra khi lưu như mọi thứ khác.

### Trình kích hoạt theo mặt trời

Đèn sân, dây gia nhiệt, bãi đỗ xe, bất cứ thứ gì quan tâm bên ngoài đã tối chưa. `sun` kích hoạt tại `dawn`, `sunrise`, `noon`, `sunset` hoặc `dusk` ở địa điểm này, dịch bởi `offsetSec`: số âm là trước, nên đây là nửa giờ trước khi mặt trời lặn.

```json
{"type": "sun", "event": "sunset", "offsetSec": -1800}
```

- **Nó được tính ngay trên thiết bị.** Từ vĩ độ và kinh độ của địa điểm (`HOTLOOP_SITE_LATITUDE`, `HOTLOOP_SITE_LONGITUDE`), bằng các phương trình mặt trời của NOAA, không dịch vụ, không internet. Một nhà máy mất đường truyền vẫn bật đèn lúc chạng vạng. Xem [mặt trời](/vi/iot/sun/).
- **Không có vị trí thì không được kích hoạt sẵn.** Một quy tắc có trình kích hoạt mặt trời ở địa điểm không có vĩ độ và kinh độ không được kích hoạt sẵn, và nhật ký hệ thống cho biết hai biến cần đặt. Trước đây đó là loại việc nằm đó ở trạng thái sẵn sàng mà im lặng mãi mãi, và không ai biết cho đến khi sân tối om.
- **Nó kích hoạt một lần cho mỗi sự kiện trong ngày,** vào giờ của ngày đó. Mặt trời lặn tháng Mười đến sớm hơn khoảng một phút mỗi buổi tối và trình kích hoạt đi theo.
- **Bình minh và chạng vạng là hoàng hôn dân sự**, tâm mặt trời dưới đường chân trời 6 độ. Đó là ranh giới "đủ tối để bật đèn" mà chiếu sáng ngoài trời được viết xoay quanh.
- **Dưới mặt trời nửa đêm không có hoàng hôn để kích hoạt**, nên trình kích hoạt mặt trời lặn chờ cái kế tiếp, dù cách bao nhiêu tuần, và kích hoạt khi đó.
- `offsetSec` tối đa sáu giờ mỗi phía (21600). Xa hơn thế là `schedule`.

Dấu vết cho biết cái gì kích hoạt và khi nào: `30m before sunset at 2026-10-01T22:38:00Z`, và `trigger` là `sun` trong điều kiện.

## Điều kiện

Một biểu thức trả về giá trị boolean. Để trống nghĩa là vô điều kiện.

Biểu thức có thể thấy gì:

| Tên | Ý nghĩa |
|---|---|
| `value`, `string`, `quality` | lần đọc đã kích hoạt quy tắc |
| `previous` | lần đọc trước đó |
| `tag`, `device` | cái đã kích hoạt nó |
| `tags["device/tag"]` | mọi lần đọc số hiện tại |
| `strings["device/tag"]` | mọi lần đọc dạng văn bản hiện tại |
| `qualities["device/tag"]` | mọi chất lượng hiện tại |
| `states["sensor.x"]` | trạng thái của mọi thực thể đang bật, dưới dạng chuỗi |
| `attrs["sensor.x"]["unit_of_measurement"]` | thuộc tính của mọi thực thể đang bật |
| `qualities["sensor.x"]` | chất lượng của mọi thực thể, bên cạnh chất lượng của tag (khóa của tag có `/`, entity_id thì không bao giờ) |
| `entity`, `fromState`, `toState` | thay đổi trạng thái đã kích hoạt quy tắc |
| `alarm`, `alarmState` | báo động đã kích hoạt quy tắc |
| `deviceState` | trạng thái thiết bị đã kích hoạt nó |
| `now`, `hour`, `minute`, `weekday` | đồng hồ; weekday 0 là Chủ nhật |
| `trigger` | trình kích hoạt nào đã kích hoạt |
| `vars` | giá trị được các bước trước gán |

```
value > 200
value > 200 and quality == 'good'
tags['press-01/Zone1_Temp'] > 200 and tags['press-01/Pressure'] < 50
hour >= 6 and hour < 18 and weekday != 0 and weekday != 6
qualities['press-01/Zone1_Temp'] == 'good'
strings['cnc-01/Program'] == 'PART_4471.NC'
value > previous
states['switch.press_01_pump'] == 'off' and toState == 'on'
float(states['sensor.press_01_zone1_temp']) > 200 and qualities['sensor.press_01_zone1_temp'] == 'good'
attrs['switch.press_01_pump']['armed'] == true
```

**Bảo vệ theo chất lượng.** `value > 200` đúng với một lần đọc xấu là 250, và lần đọc xấu là lần mà hệ thống đang nói với bạn rằng nó không biết. Với bất cứ thứ gì điều khiển thiết bị, hãy viết `value > 200 and quality == 'good'`. Thực thể cũng vậy: một thực thể xấu vẫn hiển thị giá trị tốt cuối cùng của nó, và `qualities['sensor.x']` là cách quy tắc phân biệt.

**Trạng thái là một chuỗi.** Nó là `"212.5"`, `"on"` hoặc `"unavailable"`, không bao giờ là số, nên `states['sensor.x'] > 200` bị từ chối khi lưu như một lỗi kiểu thay vì được lưu thành phép so sánh âm thầm luôn sai. Hãy viết `float(states['sensor.x']) > 200`, và bảo vệ nó: `float('unavailable')` là lỗi, và điều kiện báo lỗi làm lần chạy thất bại.

`string` là lần đọc đã kích hoạt quy tắc, nghĩa là nó không đồng thời là hàm `string()` của expr-lang. Để đặt một số vào chuỗi, dùng `toJSON(value)`.

Điều kiện phải trả về boolean. Điều kiện trả về số hoặc chuỗi bị từ chối khi lưu thay vì bị ép thành một giá trị đúng sai mà không ai định.

## Hành động

Các hành động chạy theo thứ tự. Một bước thất bại sẽ dừng quy tắc trừ khi nó đặt `continueOnError`; một bước lẽ ra phải đóng van mà không đóng được thì không được theo sau bởi các bước giả định van đã đóng.

### write_tag

```json
{
  "type": "write_tag",
  "params": {
    "deviceId": "press-01", "tagName": "Cooling",
    "value": true
  }
}
```

Hoặc tính toán:

```json
{
  "type": "write_tag",
  "params": {
    "deviceId": "press-01", "tagName": "Setpoint",
    "expression": "tags['press-01/Zone1_Temp'] - 10"
  }
}
```

**Việc này đi qua cùng cổng với mọi thứ khác.** Một tự động hóa không có đặc quyền hơn một con người: ghi phải được bật, tag phải được đánh dấu là ghi được, giá trị phải nằm trong phạm vi, và nỗ lực đó được kiểm toán là `automation:<rule-id>`.

### call_service

Điều khiển một thực thể qua dịch vụ của nó, giống `POST /api/services/...` và công cụ MCP `call_service`. Xem [Thực thể](/vi/iot/entities/#dịch-vụ) để biết mỗi miền nhận gì.

```json
{
  "type": "call_service",
  "params": {
    "entityId": "switch.press_01_pump",
    "service": "switch.turn_on"
  }
}
```

Với dữ liệu, nguyên văn hoặc tính toán:

```json
{
  "type": "call_service",
  "params": {
    "entityId": "number.press_01_zone1_sp",
    "service": "number.set_value",
    "dataExpressions": {"value": "float(states['sensor.press_01_zone1_temp']) - 10"}
  }
}
```

`service` là `domain.service` và miền của nó phải là miền của thực thể, nên quy tắc nêu một thực thể số bằng dịch vụ của công tắc sẽ bị từ chối khi lưu. Dịch vụ mà miền không nhận cũng vậy, và danh sách những gì mỗi miền nhận đến từ chính lớp thực thể: khi một miền có thêm dịch vụ ở đó, các quy tắc dùng được ngay mà không phải đổi gì ở đây. `data` là dữ liệu dịch vụ nguyên văn; `dataExpressions` được đánh giá lúc chạy và gộp lên trên.

Nó là `write_tag` mang một cái tên. Lời gọi trở thành các thao tác ghi tag qua cùng cổng, được kiểm toán là `automation:<rule-id>` với thực thể, dịch vụ và id lời gọi trên mỗi dòng. Một lần từ chối (ghi bị tắt, tag bị gỡ trạng thái sẵn sàng, giá trị lệch khỏi bước của thực thể) làm bước và lần chạy thất bại, với lý do từ chối trong dấu vết, đúng như một `write_tag` bị từ chối, và mọi thao tác ghi mà lời gọi đã thực hiện hoặc bị từ chối đều có trong đầu ra của bước. Một lời gọi không bao giờ được hoàn tác: một lời gọi tổng hợp đã ghi được hai trong ba lần sẽ dừng ở đó và nói rõ như vậy.

### condition

Một điều kiện ở giữa chuỗi bước. Khi nó sai, chuỗi kết thúc tại đó, và lần chạy **thành công**: quy tắc đã làm đúng điều nó được viết ra để làm, tức là dừng lại. Đầu ra của bước ghi `false; the steps after this one did not run`.

```json
{
  "type": "condition",
  "params": {
    "expression": "states['binary_sensor.press_01_run'] == 'on' and qualities['binary_sensor.press_01_run'] == 'good'"
  }
}
```

Nó không phải `condition` của quy tắc. Cái đó được kiểm tra một lần, trước khi bất cứ thứ gì chạy, đối với nhà máy như lúc trình kích hoạt kích hoạt, và một điều kiện sai ghi lần chạy là bị bỏ qua. Bước điều kiện đọc nhà máy **như lúc bước chạy**, đó là mục đích của một bước đặt sau `delay` hay `wait`: "ba mươi giây sau máy ép còn chạy không?" `entity`, `toState`, `value` và phần còn lại của những gì đã kích hoạt quy tắc giữ nguyên như cũ, và `vars` cũng vậy.

Một điều kiện không thể đánh giá (`float('unavailable')`) làm bước và lần chạy thất bại, giống điều kiện của quy tắc. `continueOnError` bị từ chối trên điều kiện khi lưu: tiếp tục sau một điều kiện nghĩa là nó không bao giờ dừng được gì.

### wait

Giữ chuỗi bước cho đến khi một biểu thức đúng, tối đa `timeoutSec`.

```json
{
  "type": "wait",
  "params": {
    "expression": "states['binary_sensor.press_01_valve_closed'] == 'on'",
    "timeoutSec": 30
  }
}
```

Nó nhìn ngay lập tức, nhìn lại **mỗi khi một thực thể mà biểu thức nêu thay đổi** (trạng thái, chất lượng hoặc một thuộc tính), và mỗi giây một lần bất kể thế nào. Các thực thể nó theo dõi là những cái viết nguyên văn trong `states['...']`, `attrs['...']` và `qualities['...']`; lần đọc tag, đồng hồ, hoặc thực thể được nêu theo cách khác sẽ bị lần nhìn mỗi giây bắt được. Một wait trên coil Modbus vì vậy nhanh bằng lần thăm dò phía sau, không chậm một giây.

Khi nó đúng, bước kế tiếp chạy, và các bước sau thấy nhà máy như wait thấy lần cuối. Khi hết thời gian trước, bước **thất bại**, và lần chạy cùng với nó, ghi `still false after 30s`, trừ khi wait nói hãy tiếp tục:

```json
{
  "type": "wait",
  "params": {
    "expression": "float(states['sensor.press_01_zone1_temp']) < 60",
    "timeoutSec": 240,
    "continueOnTimeout": true
  }
}
```

Dù thế nào, `vars.wait.completed` là đúng hoặc sai sau đó, và `vars.wait.waitedSec` là thời gian đã chờ, nên một bước điều kiện sau một wait có tiếp tục có thể quyết định: `vars.wait.completed == true`.

`timeoutSec` là bắt buộc và tối đa một giờ. Một wait không có hồi kết giữ chỗ chạy của nó cho đến khi ngân sách của lần chạy lấy đi, mà dưới `skip` nghĩa là quy tắc ngừng kích hoạt. Nó cũng phải vừa trong ngân sách của lần chạy (`maxRuntimeSec`, mặc định năm phút): một wait mười phút cần `"maxRuntimeSec": 900` hoặc tương tự trên quy tắc, và không có thì quy tắc bị từ chối khi lưu thay vì hết giờ như một lần chạy. Biểu thức báo lỗi trong lúc chờ làm bước thất bại.

### stop

Kết thúc chuỗi bước. `reason` là bắt buộc và nhận thay thế `{{ expression }}`; dấu vết hiển thị nó.

```json
{
  "type": "stop",
  "params": {"reason": "pump already running, nothing to do"}
}
```

Không có `error` thì lần chạy thành công. Với `"error": true` lần chạy thất bại, với lý do là lỗi của nó, và được ghi nhật ký và đếm là thất bại như mọi lần khác:

```json
{
  "type": "stop",
  "params": {"reason": "valve did not close in time", "error": true}
}
```

`continueOnError` bị từ chối trên stop khi lưu.

### call_script

Chạy một [tập lệnh](/vi/iot/scripts/): một chuỗi bước có tên mà ai đó viết một lần để mọi quy tắc cần một chu trình CIP hay xả đường ống đều gọi cùng một cái thay vì mang bản sao riêng. `fields` là đầu vào của nó, `fieldExpressions` được đánh giá khi bước chạy và gộp lên trên, và tập lệnh kiểm tra toàn bộ đối chiếu với các trường của chính nó đúng như với một lần chạy từ màn hình. Giá trị nó từ chối làm bước này thất bại; nó không bao giờ bị chỉnh để cho vừa.

```json
{
  "type": "call_script",
  "params": {
    "scriptId": "cip_cycle",
    "fields": {"circuit": "tank_2"},
    "fieldExpressions": {"minutes": "states['input_number.cip_minutes']"},
    "wait": true
  }
}
```

Với `"wait": true`, bước giữ cho đến khi lần chạy của tập lệnh kết thúc và lấy kết quả của nó: tập lệnh thất bại làm bước thất bại, và quy tắc dừng ở đó trừ khi bước ghi `continueOnError`. Lần chạy của tập lệnh là một phần của lần chạy này: nếu lần chạy này bị hủy hoặc hết ngân sách, tập lệnh cũng vậy. Không có `wait`, tập lệnh được bắt đầu và quy tắc đi tiếp; tập lệnh tự kết thúc.

Tập lệnh chạy dưới dạng `script:<id>`, với nguồn của quy tắc này, `automation`, trên mọi thao tác ghi nó thực hiện, và lần chạy của nó ghi `automation_run:<id>` là cha. Một tập lệnh đang bận và chế độ của nó từ chối lần chạy khác làm một bước đang chờ thất bại (`script busy`) và được ghi chú, không thất bại, bởi một bước không chờ. Tập lệnh gọi tập lệnh đi sâu tối đa năm cấp, và tập lệnh sẽ tự gọi chính nó bị từ chối khi được lưu.

### apply_recipe

Áp dụng một [công thức](/vi/iot/recipes/): một bộ giá trị đặt cùng được gửi đi, một mác sản phẩm hay một lần đổi chuyền. `params` là các tham số của nó và `paramExpressions` được đánh giá khi bước chạy và gộp lên trên; `version` cố ý áp dụng một phiên bản cũ hơn, và bỏ trống nghĩa là bản hiện tại.

```json
{
  "type": "apply_recipe",
  "params": {
    "recipeId": "grade_a",
    "params": {"line_speed": 120},
    "paramExpressions": {"batch": "states['input_number.next_batch']"}
  }
}
```

Công thức làm những gì nó làm từ màn hình Công thức, với quy tắc này là bên áp dụng nó. Trước hết nó được kiểm tra toàn bộ, và nếu bất kỳ đích nào bị từ chối thì không có gì được ghi và bước thất bại cùng mọi lý do. Rồi các đích của nó đi theo thứ tự dưới một id lời gọi, là `automation:<id>` với nguồn `automation`, và cái đầu tiên thất bại dừng phần còn lại và làm bước thất bại; những gì đã ghi vẫn được ghi. Bước chỉ thành công khi mọi đích đã được ghi. Một giá trị đã gửi đi nhưng không được đọc lại từ thiết bị không phải thất bại, vì nó đã đi, nhưng dấu vết ghi `NOT confirmed by read-back`, và phần áp dụng cũng vậy. Cha của phần áp dụng là lần chạy này, `automation_run:<id>`.

### Phần còn lại

| Hành động | Làm gì |
|---|---|
| `mqtt_publish` | phát hành trên kết nối hiện có của một thiết bị MQTT |
| `http_request` | gọi một endpoint; `bindTo` lưu phần thân vào `vars` |
| `raise_alarm` / `clear_alarm` | điều khiển một báo động mà engine không tự thấy được |
| `log_event` | ghi vào nhật ký hệ thống |
| `set_variable` | gán một giá trị cho các bước sau |
| `delay` | tạm dừng, tối đa một giờ |
| `mcp_call` | gọi một công cụ trên máy chủ MCP đã cấu hình |

`mqtt_publish`, `http_request`, `log_event` và `stop` hỗ trợ thay thế `{{ expression }}` trong các chuỗi của chúng.

```json
{
  "type": "mcp_call",
  "params": {
    "server": "maintenance",
    "tool": "create_work_order",
    "args": {"priority": "high"},
    "argExpressions": {"note": "'Zone 1 reached ' + toJSON(value)"},
    "bindTo": "workOrder"
  }
}
```

## Chế độ chạy

Chuyện gì xảy ra khi một quy tắc được kích hoạt trong lúc lần chạy trước vẫn đang diễn ra.

| Chế độ | Hành vi |
|---|---|
| `skip` | bỏ trình kích hoạt mới, **mặc định**, và là câu trả lời đúng gần một thiết bị |
| `queue` | chạy nó sau, tối đa một cái xếp hàng |
| `restart` | bỏ lần chạy hiện tại và bắt đầu lại |
| `parallel` | chạy cả hai |

`queue` bị giới hạn ở một lần chạy chờ, có chủ ý. Một quy tắc không theo kịp sẽ nếu không thì dồn lại một đống lệnh cùng nổ vào một nhà máy mà trạng thái đã đi tiếp.

`minIntervalSec` giới hạn tốc độ bất kể tốc độ kích hoạt, một lớp bảo vệ trước một tag chập chờn làm thiết bị hỏng. Chạy thủ công từ giao diện hoặc MCP bỏ qua giới hạn tốc độ (có người chủ ý làm) nhưng không bỏ qua chế độ chạy (hai lần chạy đồng thời đều nguy hiểm như nhau dù ai bắt đầu).

`maxRuntimeSec` giới hạn cả một lần chạy; mặc định là năm phút. Không có nó, một quy tắc treo ở endpoint không tới được giữ chỗ chạy mãi mãi, và dưới `skip` nghĩa là nó không bao giờ kích hoạt nữa. Lần chạy hết ngân sách đó được ghi là hết giờ, dù đang ở giữa các bước hay giữa một `delay` hay `wait`.

### Wait, delay và chế độ chạy

Một lần chạy đang nằm trong `wait` hay `delay` là một lần chạy đang diễn ra, và chế độ chạy quyết định trình kích hoạt làm gì với nó:

| Chế độ | Một trình kích hoạt trong lúc một lần chạy đang chờ |
|---|---|
| `skip` | bị bỏ và được ghi là bị bỏ qua. Lần chạy đang chờ vẫn tiếp tục. |
| `queue` | chạy khi lần chạy đang chờ đã xong, dù nó xong theo cách nào. |
| `restart` | hủy lần chạy đang chờ ngay tại chỗ và bắt đầu lần mới. Lần chạy cũ được ghi là **đã hủy**, `a newer trigger restarted the rule`. Đây là mẫu "đèn cảm biến chuyển động": mỗi trình kích hoạt đẩy điểm kết thúc ra xa. |
| `parallel` | bắt đầu một lần chạy khác, tự chờ riêng. |

Một lần chạy bị hủy ngay tại chỗ, kể cả đang wait hay delay, và được ghi là **đã hủy** cùng lý do, khi:

- **quy tắc của nó bị vô hiệu hóa hoặc xóa**: `the rule was disarmed or deleted`. Lần chạy đang xếp hàng của nó và các lần giữ `forSec` cũng bị bỏ.
- **quy tắc của nó bị sửa**: `the rule was edited`. Một lần chạy đang chờ một điều kiện mà tác giả vừa đổi không tiếp tục như thể chưa có gì xảy ra; quy tắc đã sửa bắt đầu sạch. Lưu quy tắc *khác* không đụng tới gì: các lần chạy, lần giữ, lần chạy xếp hàng, chỗ chạy và bộ hẹn giờ khoảng của mọi quy tắc không đổi tiếp tục như cũ.
- **tiến trình dừng**: `the process is stopping`. Tắt máy không chờ một wait xong. Không gì tiếp tục lần chạy ở lần khởi động tiếp theo; lần chạy mà tiến trình không ghi được là đã hủy (sự cố, mất điện) được đánh dấu là đã hủy ở lần khởi động tiếp theo.

Một bước bị hủy hoặc hết ngân sách dừng lần chạy ngay cả khi có `continueOnError`: cờ đó dành cho bước đã thất bại, không phải cho lần chạy mà ai đó đã dừng. Những gì bước đã làm vẫn là đã làm: một thao tác ghi đã đi trước khi hủy không được hoàn tác, và nó có trong dấu vết.

## Lịch sử chạy

Mỗi lần chạy được ghi cùng dấu vết theo từng bước: đầu vào đã **được phân giải**, đầu ra, thời lượng và lỗi. Không phải các mẫu: khi một quy tắc chạy sai lúc 3 giờ sáng, `wrote 212.5 to press-01/Setpoint` là thứ đáng biết còn `wrote {{expression}}` thì không.

Mở rộng một lần chạy trên màn hình Tự động hóa để xem các bước của nó. Một lần chạy còn đang diễn ra khi tiến trình dừng bị hủy khi dừng, và lần chạy mà tiến trình không kịp ghi (sự cố) được đánh dấu là đã hủy ở lần khởi động tiếp theo, thay vì trông như đã chạy từ thứ Ba tuần trước.

## Một ví dụ cụ thể

Bật làm mát khi một khu vực nóng lên trong ca, tối đa mười phút một lần, và báo cho ai đó.

```json
{
  "id": "cool-zone-1",
  "name": "Cool zone 1 when hot",
  "enabled": true,
  "mode": "skip",
  "minIntervalSec": 600,
  "triggers": [{
    "type": "threshold",
    "deviceId": "press-01", "tagName": "Zone1_Temp",
    "threshold": 200, "direction": "rising", "hysteresis": 5
  }],
  "condition": "quality == 'good' and hour >= 6 and hour < 18",
  "actions": [
    {"type": "write_tag", "params": {
      "deviceId": "press-01", "tagName": "Cooling", "value": true}},
    {"type": "delay", "params": {"seconds": 30}},
    {"type": "log_event", "params": {
      "severity": "warning",
      "message": "Cooling started, zone 1 at {{ value }}"}}
  ]
}
```

Đọc các lớp bảo vệ theo thứ tự: nó kích hoạt khi vượt qua chứ không liên tục; hysteresis ngăn nó kích hoạt lại khi dao động; điều kiện từ chối hành động dựa trên một lần đọc nó không tin được và chỉ chạy trong ca; và giới hạn tốc độ nghĩa là dù mọi thứ khác sai, nó cũng không thể điều khiển nhà máy quá một lần mỗi mười phút.

Cùng ý tưởng với thực thể: bật quạt hút khi máy ép bắt đầu chạy, nhưng chỉ khi không ai đã vô hiệu hóa quạt.

```json
{
  "id": "fan-with-press",
  "name": "Extraction fan follows the press",
  "enabled": true,
  "mode": "skip",
  "triggers": [{
    "type": "state",
    "entityId": "binary_sensor.press_01_run",
    "from": "off", "to": "on"
  }],
  "condition": "qualities['binary_sensor.press_01_run'] == 'good' and attrs['switch.press_01_fan']['armed'] == true",
  "actions": [
    {"type": "call_service", "params": {
      "entityId": "switch.press_01_fan", "service": "switch.turn_on"}},
    {"type": "log_event", "params": {
      "message": "{{ entity }} went {{ toState }}, fan started"}}
  ]
}
```

`from` và `to` nghĩa là việc kết nối lại (`unavailable` sang `on`) không tự bật quạt; điều kiện nghĩa là một quạt bị vô hiệu hóa là một lần chạy bị bỏ qua chứ không phải một thao tác ghi bị từ chối trong nhật ký kiểm toán mỗi lần máy ép khởi động.

Và một ví dụ dùng các bước của chuỗi: khi máy ép đã chạy mười phút, mở van làm mát nếu nó chưa mở, chờ công tắc hành trình của nó, và thất bại thật to nếu nó không bao giờ đóng tiếp điểm.

```json
{
  "id": "cool-after-warmup",
  "name": "Open cooling after ten minutes of running",
  "enabled": true,
  "mode": "restart",
  "maxRuntimeSec": 120,
  "triggers": [{
    "type": "state",
    "entityId": "binary_sensor.press_01_run",
    "from": "off", "to": "on",
    "forSec": 600
  }],
  "actions": [
    {"type": "condition", "params": {
      "expression": "states['valve.press_01_cooling'] != 'open'"}},
    {"type": "call_service", "params": {
      "entityId": "valve.press_01_cooling", "service": "valve.open"}},
    {"type": "wait", "params": {
      "expression": "states['valve.press_01_cooling'] == 'open'",
      "timeoutSec": 60, "continueOnTimeout": true}},
    {"type": "condition", "params": {
      "expression": "vars.wait.completed == false"}},
    {"type": "stop", "params": {
      "reason": "cooling valve did not open within 60s, it is {{ states['valve.press_01_cooling'] }}",
      "error": true}}
  ]
}
```

Đọc từ trên xuống: lần giữ nghĩa là một máy ép ngắt sau hai phút không bao giờ mở van, và `from` nghĩa là khởi động lại Gateway không phải là một lần khởi động máy ép; điều kiện đầu tiên biến van đã mở thành một lần chạy thành công không điều khiển gì; wait thức dậy ngay khi thực thể của van thay đổi; và khi nó không bao giờ mở, điều kiện thứ hai để lần chạy đi tiếp tới một stop làm nó thất bại, với trạng thái thực của van trong lý do và một cảnh báo trong nhật ký hệ thống. Khi van mở, chính điều kiện đó sai và lần chạy kết thúc tại đó, thành công.

## Webhook

Trình kích hoạt `webhook` đăng ký `POST /api/webhook/<path>`. Phần thân có sẵn dưới dạng `vars.body`. Đường dẫn không quy tắc nào nhận trả về 404 thay vì âm thầm chấp nhận; một webhook gửi vào hư không trông y hệt một cái đang hoạt động.

Hai quy tắc không thể nhận cùng một đường dẫn; cái thứ hai bị từ chối khi tải với một dòng nhật ký nêu cả hai.

## Khi một quy tắc không được kích hoạt sẵn

Quy tắc đã bật nhưng không biên dịch được hiển thị là **NOT ARMED** trên màn hình Tự động hóa, với chấm đỏ và lời giải thích, cùng một lỗi trong nhật ký hệ thống. Đây là trạng thái đáng báo to nhất: tác giả tin rằng nó đang chạy.

Một quy tắc xấu không làm các quy tắc khác ngừng sẵn sàng. Nạp lại bỏ quy tắc đã thất bại và kích hoạt sẵn mọi thứ còn lại.
