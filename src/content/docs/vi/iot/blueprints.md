---
title: "Blueprint cho quy tắc"
description: "Viết một quy tắc một lần, chừa chỗ trống, rồi điền cho từng máy bơm. Mỗi quy tắc giữ phiên bản blueprint đã tạo ra nó, nên một lần sửa không đổi 40 quy tắc."
---

Blueprint là một quy tắc được viết một lần, có chừa chỗ trống. "Khi *động cơ này* chạy lâu hơn *khoảng thời gian này*, hãy báo, và dừng nó nếu *tôi yêu cầu*." Người hiểu quy tắc cần làm gì sẽ viết nó một lần. Những người còn lại điền vào chỗ trống, cho từng máy bơm, từng bồn, từng dây chuyền, và nhận được một tự động hóa bình thường ở đầu bên kia.

Cách thay thế là điều mà nhà máy nào cũng đã có: cùng một quy tắc được sao chép sang bốn mươi máy bơm, rồi chỉ sửa được ba mươi bảy cái vào ngày có người tìm ra lỗi. Các bản sao dần lệch nhau. Một blueprint với bốn mươi bộ đầu vào thì không.

Thứ được tạo ra là một quy tắc bình thường. Nó nằm trên màn hình Tự động hóa cạnh các quy tắc viết tay, được cùng một bộ máy kích hoạt, và mọi lệnh ghi của nó đều đi qua cổng kiểm soát ghi dưới tên `automation:<id>`, có kiểm toán, kể cả các lần bị từ chối. Không có môi trường chạy riêng cho blueprint và không có cửa hậu. Chỉ có một biểu mẫu và một quy tắc.

## Một quy tắc duy nhất về blueprint

**Một quy tắc giữ phiên bản blueprint mà nó được tạo ra từ đó.**

Sửa một blueprint thì phiên bản của nó tăng lên. Không quy tắc nào được tạo từ nó bị thay đổi. Quy tắc trên máy bơm 7, đúng vào thứ Ba, sẽ không lặng lẽ thành một quy tắc khác chỉ vì thứ Tư có người sửa blueprint của nó khi đang nghĩ đến máy bơm 12, trong khi máy bơm 7 mới là cái làm ngập tầng hầm.

Chuyển một quy tắc sang phiên bản mới là một **nâng cấp**, và nâng cấp là việc do con người yêu cầu:

1. Màn hình Tự động hóa ghi điều đó ngay trên quy tắc: *Từ blueprint Động cơ chạy quá lâu, phiên bản 1*, và *có phiên bản 2*.
2. **Xem lại nâng cấp** cho thấy chính xác điều gì thay đổi, từng phần một, trước và sau, và quy tắc sẽ làm gì nếu kích hoạt ngay bây giờ, với mỗi lệnh ghi được đưa qua các bước kiểm tra của cổng. Chưa có gì thay đổi.
3. **Nâng cấp** đưa vào đúng những gì đã được xem lại. Nếu blueprint đã đổi tiếp, hoặc có người khác đã nâng cấp quy tắc trong lúc đó, thao tác bị từ chối và bạn xem lại. Những gì bạn đã xem lại là những gì được đưa vào, nếu không thì không có gì được đưa vào.

Việc này được ghi lại cùng người thực hiện: *tự động hóa được nâng cấp từ blueprint pump_watch phiên bản 1 lên 2*.

Nếu có người đã sửa tay quy tắc kể từ khi nó được tạo, phần xem lại hiển thị chỉnh sửa đó là sẽ bị thay thế. Thay đổi của bất kỳ ai cũng không biến mất mà chưa từng hiện trên màn hình.

## Một blueprint trông thế nào

```json
{
  "id": "pump_watch",
  "name": "Pump start watch",
  "description": "Says when a pump starts, with the limit it runs to.",
  "inputs": [
    {"name": "pump", "label": "Pump", "type": "entity", "domain": ["switch"], "required": true},
    {"name": "limit", "label": "Limit", "type": "number", "min": 0, "max": 100, "step": 5, "unit": "%", "required": true}
  ],
  "template": {
    "triggers": [{"type": "state", "entityId": {"!input": "pump"}, "to": "on"}],
    "condition": "float(states['sensor.tank_level']) < ${limit}",
    "actions": [
      {"type": "log_event", "params": {"message": "${pump} started, running to ${limit}%"}}
    ],
    "mode": "skip"
  }
}
```

- **`id`** gồm chữ thường, chữ số và dấu gạch dưới, bắt đầu bằng một chữ cái.
- **`inputs`** là các chỗ trống, có kiểu dữ liệu. Các trường giống như ở mọi nơi khác trong HotLoop: `number` với `min`, `max`, `step` và `unit`, `text` với `max_length` và `pattern`, `boolean`, `select` với `options`, `entity` với các `domain` mà nó nhận, `duration` (giây, hoặc `90s`, `1h30m`), `alarm` và `tag`. Mỗi trường có thể là `required` hoặc có `default`.
- **`template`** là quy tắc: `description`, `triggers`, `condition`, `actions`, `mode`, `minIntervalSec`, `maxRuntimeSec`, viết bằng ngôn ngữ tự động hóa ([Tự động hóa](/vi/iot/automations/)). Không gồm `id`, `name` hay `enabled` của nó. Những trường đó thuộc về từng quy tắc được tạo từ nó.

### Các chỗ trống

**`{"!input": "pump"}`** khi dùng làm giá trị sẽ được thay bằng giá trị của đầu vào, giữ nguyên kiểu: entity_id vào `entityId` dưới dạng chuỗi, một khoảng thời gian vào `forSec` dưới dạng số. Một đầu vào tùy chọn mà không ai điền là `null`.

**`${pump}`** bên trong một chuỗi cũng được thay, và cách thay tùy vào vị trí:

- Trong một biểu thức (`condition` của quy tắc, `expression` của hành động, một giá trị trong `dataExpressions`, `argExpressions`, `fieldExpressions` hoặc `paramExpressions`, và mọi thứ nằm giữa `{{` và `}}` trong một thông báo) nó đi vào dưới dạng **giá trị nguyên văn**. Chuỗi được đặt trong dấu nháy, số là số, `true`, `false`, `nil`. Vì vậy điều kiện ở trên, với giới hạn 40, là `float(states['sensor.tank_level']) < 40`.
- Ở mọi nơi khác nó là văn bản thường: `switch.pump_1 started, running to 40%`.

**`${counter.domain}`** là domain của một đầu vào thực thể, dùng cho tên dịch vụ phải khớp với loại thực thể được chọn: `"${counter.domain}.reset"` là `counter.reset` đối với bộ đếm của PLC và `input_counter.reset` đối với bộ đếm phụ trợ.

Việc đặt trong dấu nháy này là toàn bộ lý do một đầu vào văn bản an toàn khi dùng trong biểu thức. Gõ `' || true || '` vào một đầu vào văn bản và điều kiện sẽ so sánh với đúng chuỗi đó, như đã gõ. Nó không bao giờ trở thành một phần của biểu thức. Và một đầu vào văn bản hoàn toàn không thể chứa `{{`: mọi thông báo mà một quy tắc gửi đi sẽ chạy phần nằm giữa `{{` và `}}` như một biểu thức khi gửi, còn giá trị do ai đó gõ vào biểu mẫu thì không bao giờ được trở thành biểu thức.

### Được kiểm tra khi lưu

Một blueprint được kiểm tra trước khi lưu, chứ không phải khi có người thử:

- mỗi chỗ trống gọi tên một đầu vào, và `.domain` chỉ đi sau một đầu vào thực thể;
- mỗi đầu vào được dùng ở đâu đó. Một đầu vào mà mẫu bỏ qua là một trường biểu mẫu không làm gì cả, và sẽ có người mất cả buổi chiều vì nó;
- khi điền bằng giá trị mẫu thuộc kiểu của từng đầu vào (giá trị mặc định nếu có), mẫu tạo ra một quy tắc biên dịch được. Một đầu vào văn bản trở thành URL cần một `pattern` nói rõ điều đó, `https?://\S+`, nếu không bước kiểm tra URL sẽ từ chối giá trị mẫu.

## Điền một blueprint

Trên màn hình **Blueprints**, **Dùng** mở biểu mẫu: id và tên của quy tắc, và mỗi đầu vào là một điều khiển phù hợp, một số có khoảng giá trị, một danh sách, một bộ chọn thực thể. Sau đó:

- **Kiểm tra trước** cho biết quy tắc sẽ được tạo ra là gì và quy tắc đó sẽ làm gì nếu kích hoạt ngay bây giờ: điều kiện đã được đánh giá, mỗi lệnh ghi và lệnh gọi dịch vụ được đưa qua chính các bước kiểm tra của cổng kiểm soát ghi dưới tên `automation:<id>`, và lần từ chối đầu tiên bằng chính lời của cổng. Không có gì được lưu, ghi hay kiểm toán.
- **Tạo quy tắc** tạo ra nó, ở trạng thái đã kích hoạt trừ khi bạn bỏ chọn, và nó hiện trên màn hình Tự động hóa kèm nguồn gốc của nó.

Mỗi đầu vào được kiểm tra trước và **không bao giờ bị chỉnh cho vừa**. 150 cho một đầu vào có giá trị tối đa 100 bị từ chối, chứ không lặng lẽ thành 100. `"12"` cho một số bị từ chối, không được tự phân tích. Mọi đầu vào sai được báo cùng một lúc, nên biểu mẫu quay lại với toàn bộ danh sách. Một giá trị mà chính quy tắc từ chối (khoảng thời gian hai ngày cho thời gian giữ tối đa một ngày) bị từ chối bằng lời của chính quy tắc. Không có gì được tạo cho đến khi mọi thứ đều đúng.

Tạo một quy tắc **không bao giờ thay thế một quy tắc khác**. Một id đã bị dùng, bởi quy tắc viết tay hoặc quy tắc tạo từ blueprint, sẽ bị từ chối.

Qua API, đó là `POST /api/blueprints/{id}/instantiate`, với `?dry_run=true` để kiểm tra. Xem [API HTTP](/vi/iot/api/#blueprint).

## Các blueprint tích hợp sẵn

Chúng đi kèm trong tệp nhị phân. Chúng chỉ đọc; **Sao chép** tạo một bản của riêng bạn dưới id mới, bắt đầu từ phiên bản 1, để bạn sửa tùy ý.

| Blueprint | Đầu vào | Quy tắc làm gì |
|---|---|---|
| `motor_running_too_long` | một động cơ, được chạy bao lâu (mặc định một giờ), có dừng nó hay không | Khi động cơ ở trạng thái `running` liên tục trong khoảng thời gian đó, ghi một cảnh báo. Nếu được yêu cầu, dừng nó bằng `motor.stop`. |
| `tank_high_level_stop_pump` | một cảm biến mức, giới hạn, máy bơm (một động cơ) | Khi mức bằng hoặc vượt giới hạn, chất lượng số đọc tốt và máy bơm chưa dừng, dừng máy bơm và ghi lại. |
| `alarm_to_notify` | một báo động, trạng thái cần xử lý (mặc định `unack-active`), một URL webhook | Khi báo động chuyển sang trạng thái đó, gửi POST `{"text": "Alarm temp-hi is unack-active"}` đến URL. |
| `device_silent_cycle_its_port` | cảm biến trực tuyến của một thiết bị, được im lặng bao lâu (mặc định 5 phút), tag tắt bật nguồn của thiết bị UniFi và cổng, chờ bao lâu sau đó (mặc định 3 phút), một báo động, khoảng cách tối thiểu giữa các lần chạy (mặc định một giờ) | Khi thiết bị tắt trong khoảng thời gian đó, tắt rồi bật nguồn cổng switch của nó một lần qua cổng kiểm soát ghi, chờ nó trở lại, và nếu nó chưa trở lại thì nâng báo động. Driver từ chối chu kỳ thứ hai của cùng một cổng trong vòng 15 phút và không bao giờ tắt bật cổng đang mang mạng. |
| `shift_schedule_counter_reset` | một trình trợ giúp lịch, một bộ đếm (của PLC hoặc phụ trợ) | Khi lịch bật, đặt lại bộ đếm và ghi lại. |

Vài ghi chú thẳng thắn về chúng:

- **`tank_high_level_stop_pump` là một tiện ích, không phải một khóa liên động.** Một ngắt bảo vệ con người hay nhà máy thuộc về PLC, đấu dây cứng ở nơi cần có, không phải trong thứ gì chạy trên mạng. Blueprint này chỉ giúp ai đó khỏi phải ngồi canh một mức. Nó không thay thế công tắc mức cao.
- Nó không hành động dựa trên số đọc mà nó không thể tin cậy. Một mức có chất lượng xấu không dừng gì cả, vì một lần dừng dựa trên con số rác vẫn là một lần dừng.
- **`shift_schedule_counter_reset` kích hoạt khi lịch bật**, và hai khối lịch chạm nhau chỉ là một đoạn bật liên tục. Vì vậy hãy cho mỗi ca khối riêng với lịch tắt giữa chúng, dù chỉ một phút (06:00 đến 13:59, 14:00 đến 21:59), nếu không chỉ ca đầu của chuỗi mới đặt lại bộ đếm.
- **`alarm_to_notify`** dành cho phòng chat hoặc hệ thống phiếu yêu cầu. Để gọi điện thoại, với giới hạn tần suất, thử lại và liên kết xác nhận, hãy dùng các thông báo do chính HotLoop gửi ([Thông báo báo động](/vi/iot/notifications/)).

## Ai làm được gì

| <span class="sr-only">Chi tiết</span> | người xem | vận hành viên | quản trị viên |
|---|---|---|---|
| Xem blueprint (`blueprints.read`) | có | có | có |
| Tạo quy tắc từ một blueprint, nâng cấp một quy tắc (`blueprints.apply`) | không | có | có |
| Viết, sửa, sao chép, xóa một blueprint (`blueprints.write`) | không | không | có |

Vì sao vận hành viên được tạo quy tắc: blueprint là nơi một kỹ sư đã quyết định quy tắc làm gì, và chọn máy bơm nào để theo dõi chính là quyết định mà vận hành viên đưa ra suốt cả ngày. Phần nguy hiểm, quy tắc điều khiển cái gì, đã được quyết định khi blueprint được viết, bởi người có `blueprints.write`. Xóa hoặc sửa tay quy tắc sau đó vẫn là `automations.write`, quyền quản trị viên.

Việc xóa một blueprint mà bất kỳ quy tắc nào đã được tạo từ nó đều bị từ chối, kèm tên các quy tắc. Hãy xóa các quy tắc đó trước. Blueprint tích hợp sẵn không thể sửa hay xóa.

## Tác nhân

Một tác nhân được cấp `list_blueprints`, `preview_blueprint` và `instantiate_blueprint` (cùng `upgrade_blueprint_automation`, `create_blueprint`, `update_blueprint` và `delete_blueprint`): nó tìm blueprint phù hợp, tính ra các đầu vào, cho xem quy tắc sẽ làm gì, và tạo nó, qua cùng đường mà màn hình dùng, với cùng các bước kiểm tra đầu vào và tên tác nhân được ghi trong nhật ký sự kiện. Một quy tắc là mệnh lệnh thường trực điều khiển thiết bị mỗi khi điều kiện kích hoạt của nó xảy ra, nên bản xem trước đi trước, và mỗi lệnh ghi mà quy tắc thực hiện sau đó đều gặp cổng kiểm soát ghi. Xem [MCP](/vi/iot/mcp/#blueprint).

## Mọi thứ nằm ở đâu

- **Các blueprint** do nhà máy viết nằm trong bảng `blueprints`. Các blueprint tích hợp sẵn nằm trong tệp nhị phân và không bao giờ được lưu.
- **Một quy tắc tạo từ một blueprint** là một hàng trong `automations` như mọi quy tắc khác, với `blueprint_id`, `blueprint_version` và `blueprint_inputs` cho biết nguồn gốc. `GET /api/automations` trả về chúng dưới dạng `blueprintId`, `blueprintVersion` và `blueprintInputs`.
- **Mỗi thay đổi** có trong nhật ký hệ thống và nhật ký sự kiện, cùng người thực hiện: *blueprint đã tạo*, *blueprint đã lưu, nay là phiên bản 2*, *tự động hóa được tạo từ blueprint motor_running_too_long phiên bản 1*, *tự động hóa được nâng cấp từ blueprint pump_watch phiên bản 1 lên 2*, *blueprint đã xóa*.
- **Bản sao lưu** chứa cả các blueprint lẫn phiên bản đã ghim của từng quy tắc, nên một nhà máy được khôi phục đưa ra đúng các bản nâng cấp mà nó đã đưa ra trước đó. Bản sao lưu từ trước khi có blueprint khôi phục mọi quy tắc như được viết tay.
- Một quy tắc mà blueprint đã mất (ví dụ một blueprint tích hợp sẵn mà bản phát hành sau đã bỏ) tiếp tục chạy đúng như hiện có. Chỉ là không còn gì để nâng cấp lên.
