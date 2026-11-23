---
title: "Trợ thủ"
description: "Những giá trị thuộc về người trong nhà máy, như mục tiêu mẻ hay ca nào đang làm: công tắc, số, lựa chọn, văn bản, bộ đếm, bộ hẹn giờ và lịch."
---

Trợ thủ là một giá trị thuộc về người trong nhà máy chứ không phải của một PLC. "Dây chuyền 2 đang đổi sản phẩm." "Mục tiêu mẻ hôm nay là 1.250 kg." "Ca B đang làm." "Mười hai chi tiết bị loại bỏ kể từ lần đặt lại cuối." "Đợt xả còn chín phút." Không cái nào nằm trong một thanh ghi, và tất cả đều đúng là điều mà quy tắc và màn hình cần biết.

HotLoop có bảy loại. Trợ thủ là một thực thể như mọi thực thể khác: nó có `entity_id`, trạng thái, thuộc tính và dịch vụ, nằm trên cây thiết bị, xuất hiện trong `/api/states`, trên màn hình Thực thể, trong `list_entities` qua MCP và trong trình kích hoạt theo trạng thái của một tự động hóa. Điểm khác là nơi giá trị của nó nằm: HotLoop giữ nó, trong cơ sở dữ liệu, và **không dịch vụ nào của trợ thủ từng ghi vào tag**.

## Bảy loại

| Miền | Trạng thái | Tùy chọn | Dịch vụ |
|---|---|---|---|
| `input_boolean` | `on` / `off` | `initial` (true/false), `restore` | `turn_on`, `turn_off`, `toggle` |
| `input_number` | con số, `"1250"` | `min`, `max` (cả hai bắt buộc), `step` (mặc định 1), `mode` (`slider` hoặc `box`), `initial`, `restore` và một `unit_of_measurement` | `set_value {value}`, `increment`, `decrement` |
| `input_select` | lựa chọn | `choices` (bắt buộc, tối đa 100), `initial`, `restore` | `select_option {option}`, `select_next {cycle}`, `select_previous {cycle}` |
| `input_text` | văn bản | `max_length` (mặc định và giới hạn trên 255), `pattern`, `initial`, `restore` | `set_value {value}` |
| `input_counter` | một số nguyên | `initial` (mặc định 0), `step` (mặc định 1), `min`, `max`, `restore` | `increment`, `decrement`, `reset`, `set_value {value}` |
| `timer` | `idle` / `active` / `paused` | `duration_sec` (bắt buộc, từ 1 giây đến 7 ngày), `restore` | `start {duration}`, `pause`, `cancel`, `finish` |
| `schedule` | `on` / `off` | `schedule` (bắt buộc) | không có: nó chạy theo đồng hồ |

Bộ đếm là `input_counter`, không phải `counter`. `counter` đã là thực thể tổng hợp của PLC mà việc đặt lại ghi vào một tag, và nó giữ nguyên đúng như hiện tại.

Mỗi tùy chọn được kiểm tra khi lưu trợ thủ, và `initial` được đối chiếu với tất cả các tùy chọn còn lại: một `input_number` từ 0 đến 100 mà bắt đầu ở 150 sẽ bị từ chối, không phải được khởi động ở 100. Một tùy chọn mà một miền không nhận là một lỗi, không phải một thiết lập bị âm thầm bỏ qua. Các tùy chọn của trợ thủ (`initial`, `restore`, `choices`, `duration_sec`, `mode`, `schedule`) bị từ chối ở mọi miền khác vì cùng lý do.

## Tạo một trợ thủ

Quản trị viên tạo trợ thủ (`entities.write`). Trên màn hình Thực thể, chọn **Trợ thủ mới**, cạnh Thiết bị mới. Qua API:

```
POST /api/helpers
{"name": "Batch target", "domain": "input_number", "unit_of_measurement": "kg",
 "options": {"min": 0, "max": 5000, "step": 50, "initial": 1000}}
```

`entity_id` được tạo từ tên (`input_number.batch_target`) trừ khi bạn tự đặt. `PUT /api/helpers/{entity_id}` đổi tên, biểu tượng, đơn vị hoặc tùy chọn của nó; `DELETE /api/helpers/{entity_id}` xóa nó cùng giá trị. Toàn bộ API nằm trong [API HTTP](/vi/iot/api/#trợ-thủ).

Một thay đổi tùy chọn khiến giá trị hiện tại của trợ thủ nằm ngoài các tùy chọn sẽ bị từ chối: thu hẹp một khoảng xuống dưới giá trị, hoặc bỏ lựa chọn đang được chọn. Hãy đặt giá trị trước, hoặc chọn các tùy chọn bao gồm nó. Một giá trị không bao giờ bị dịch chuyển cho vừa.

## Đặt giá trị

Bất kỳ ai có `helpers.write` đều đặt được trợ thủ. Vận hành viên có quyền này: điều khiển bộ chọn ca và đếm phế phẩm là vận hành, không phải cấu hình. Người xem thì không. Đây không phải `values.write`, vì trợ thủ không ghi vào tag nào.

Đặt một trợ thủ là một lệnh gọi dịch vụ của thực thể, cùng lệnh gọi mà mọi thực thể khác nhận:

```
POST /api/services/input_counter/increment   {"entity_id": "input_counter.scrap", "reason": "short shot"}
POST /api/services/timer/start               {"entity_id": "timer.purge", "duration": "0:15:00"}
```

Phản hồi cho biết trợ thủ giờ là gì: `{"call_id": "...", "state": "13", "writes": []}`. `?dry_run=true` cũng dùng được và trả lời bằng đúng những từ mà lệnh gọi thật sẽ dùng, không thay đổi gì.

Trên màn hình Thực thể, trợ thủ có ô riêng, không bao giờ bị gộp vào ô khác (nó không có tag nào để gộp), kèm các nút điều khiển cho người có `helpers.write`. Mọi thay đổi đều được xác nhận trước, kèm lý do, như mọi lệnh khác.

Từ MCP không có công cụ mới: `list_entities` tìm trợ thủ, `get_states` đọc chúng, `call_service` đặt chúng. Tác tử chỉ thay đổi trợ thủ trên bản triển khai có bật `HOTLOOP_ALLOW_WRITES`, cùng công tắc mà việc ghi vào tag cần. Trợ thủ không di chuyển thiết bị nào, nhưng đó là thứ mà quy tắc dựa vào, và một tác tử bật công tắc đổi sản phẩm là một tác tử khởi động bất cứ điều gì quy tắc đổi sản phẩm làm.

## Bị từ chối, không bao giờ bị cắt gọt

Một giá trị mà trợ thủ không nhận sẽ bị từ chối và không có gì thay đổi:

- một số nằm ngoài `min`..`max`, hoặc lệch khỏi `step` (tính từ `min`);
- một `increment` sẽ vượt `max`, một `decrement` sẽ xuống dưới `min` (bị từ chối, không phải dừng ở giới hạn: "dừng ở giới hạn" là một giá trị không ai yêu cầu);
- một tùy chọn không nằm trong các lựa chọn hiện có; `select_next` vượt quá lựa chọn cuối với `cycle: false`;
- một văn bản dài hơn `max_length`, hoặc không khớp `pattern` (toàn bộ văn bản phải khớp);
- một số đếm không phải số nguyên, hoặc vượt quá `min` hay `max` của bộ đếm;
- một bộ hẹn giờ bị tạm dừng khi không chạy, bị hủy hoặc kết thúc khi đang nhàn rỗi, hoặc được bắt đầu với thời lượng dưới một giây hay trên bảy ngày;
- một trợ thủ bị tắt; một bên gọi không có `helpers.write`; một tác tử khi quyền ghi MCP bị tắt.

Mỗi lần từ chối là một cảnh báo trong nhật ký hệ thống (`GET /api/events`) gắn với trợ thủ, kèm ai đã yêu cầu và vì sao bị từ chối, y như việc từ chối một lần xác nhận báo động. Một lỗi trong chính yêu cầu (một trường mà dịch vụ không nhận, `"50"` ở chỗ cần một số) là lỗi của bên gọi, được trả lời bằng 400, và không thay đổi hay ghi lại gì.

## Thay đổi được ghi ở đâu

Mỗi thay đổi là một dòng trong nhật ký hệ thống gắn với trợ thủ: ai, từ gì, sang gì, id lệnh gọi, đến từ đâu, và lý do nếu có.

```
otto   input_counter.increment: 12 -> 13; reason: short shot
system timer finished: active -> idle, due at 2026-09-27T21:10:00Z
```

Dòng này được ghi trong cùng giao dịch với giá trị, nên không bao giờ có thay đổi mà không có dòng, hay dòng mà không có thay đổi.

Một thay đổi trạng thái cũng là một dòng trong [nhật ký](/vi/iot/logbook/), trong cùng giao dịch đó, với cùng ai, nguồn và id lệnh gọi. Nó được ghi bởi tiến trình đã thực hiện thay đổi, dù là tiến trình nào, nên thay đổi của một tác tử qua `--mcp-stdio` cũng được ghi, và chỉ ghi một lần. Các dòng của trợ thủ không bao giờ bị giới hạn tần suất: mỗi dòng là một người quyết định điều gì đó. Một lệnh gọi giữ nguyên trạng thái (một số được đặt đúng giá trị nó đang có) có trong nhật ký hệ thống nhưng không có trong nhật ký, vì không có gì thay đổi.

## Khởi động lại

Một trợ thủ giữ giá trị của nó qua lần khởi động lại: Gateway trở lại với ca vẫn là B và bộ đếm vẫn là 13. Hãy đặt `restore: false` cho trợ thủ cần bắt đầu mới mỗi lần (một bộ đếm "kể từ lần khởi động lại cuối"): Gateway đưa nó về giá trị ban đầu khi khởi động và ghi điều đó vào nhật ký. Chỉ bản thân Gateway làm việc này. Một tiến trình `--mcp-stdio` mà tác tử khởi động bên cạnh một Gateway đang chạy giữ cùng các trợ thủ và nghe mọi thay đổi, nhưng không bao giờ đặt lại gì, vì đặt lại các giá trị của nhà máy chỉ vì một tác tử kết nối là điều vô lý.

## Bộ hẹn giờ

Bộ hẹn giờ chạy theo đồng hồ treo tường. Bắt đầu mười phút thì kết thúc sau mười phút dù giữa chừng có chuyện gì: một lần khởi động lại mất hai phút còn để lại tám phút. Bộ hẹn giờ đang tạm dừng vẫn tạm dừng, với thời gian còn lại của nó, qua bao nhiêu lần khởi động lại cũng được, và `start` sẽ tiếp tục nó.

Một bộ hẹn giờ hết hạn **trong lúc HotLoop không chạy** được đưa về `idle` khi HotLoop khởi động lần tiếp theo, với `finished_late_at` đặt thành thời điểm đáng lẽ nó hết hạn, và một cảnh báo trong nhật ký. **Không có gì được kích hoạt vì nó.** Một quy tắc chờ bộ hẹn giờ đó chuyển sang nhàn rỗi sẽ không chạy, vì lần nhìn đầu tiên của bộ máy vào nó sau khi khởi động là một mốc cơ sở, không phải một thay đổi. Bất cứ điều gì nó đang đo giờ (một đợt xả, một đợt đóng rắn) đã xảy ra từ lâu hoặc không xảy ra, và làm nó bây giờ, trễ và không ai yêu cầu, còn tệ hơn là nói rằng nó đã bị bỏ lỡ. Hãy tìm `finished_late_at` và quyết định.

Bộ hẹn giờ không phải là khóa liên động. Nó chạy theo đồng hồ của một tiến trình, qua cơ sở dữ liệu và mạng, chính xác đến giây và thường đến mili giây. Mọi thứ phải dừng đúng giờ đều thuộc về PLC.

## Lịch

Một lịch bật trong các khối của nó và tắt ngoài các khối đó:

```json
{"schedule": {
  "mon": [{"from": "06:00", "to": "14:00", "data": {"crew": "A"}},
          {"from": "14:00", "to": "22:00", "data": {"crew": "B"}}],
  "fri": [{"from": "22:00", "to": "06:00", "data": {"crew": "C"}}]
}}
```

- Các ngày là từ `mon` đến `sun`. Một thời điểm là `HH:MM` hoặc `HH:MM:SS`; `24:00` là cuối ngày.
- Một khối có `to` sớm hơn `from` kéo qua nửa đêm: 22:00 đến 06:00 của thứ Sáu bật đến 06:00 thứ Bảy.
- Các khối chạm nhau là một đoạn bật liền mạch; các khối chồng lên nhau bị từ chối, vì chọn dữ liệu của khối nào sẽ là đoán mò.
- Khi một khối đang bật, `data` của nó nằm trong thuộc tính của thực thể (`crew: "B"`), và `next_event` luôn cho biết lúc nào lịch thay đổi tiếp theo.
- Nó được đọc theo đồng hồ treo tường ở múi giờ của địa điểm (`HOTLOOP_SITE_TIMEZONE`), vì một ca bắt đầu lúc 06:00 cũng bắt đầu lúc 06:00 vào ngày đổi giờ. Vào đêm đồng hồ chỉnh tiến, giờ không xảy ra thì không bật; vào đêm chỉnh lùi, giờ xảy ra hai lần thì bật cả hai lần.

## Nhiều hơn một tiến trình

Mọi thay đổi được thông báo bằng `NOTIFY` của Postgres, và mọi tiến trình giữ các trợ thủ đều lắng nghe. Một trợ thủ được đặt ở một tiến trình hiện giá trị mới ở mọi tiến trình khác trong một vòng đi về, một trợ thủ được tạo hoặc xóa ở một nơi xuất hiện hoặc biến mất ở các nơi khác, và một thay đổi thực hiện qua `PUT /api/helpers/{entity_id}` được nhận theo cùng cách (thay đổi qua `PUT /api/entities/{entity_id}` đến các nơi khác ở lần đồng bộ sổ đăng ký kế tiếp của chúng, như với mọi thực thể). Mọi lần ghi đều có điều kiện theo bản sửa đổi của dòng, nên hai tiến trình cùng đếm một bộ đếm không bao giờ mất một lần đếm, và một bộ hẹn giờ mà cả hai cùng giữ được kết thúc bởi đúng một trong hai.

## Sao lưu

Trợ thủ nằm trong mọi bản sao lưu: cấu hình của chúng cùng với các thực thể, và giá trị của chúng trong `helper_state`, kể cả các bản sửa đổi. Một nhà máy được khôi phục trở lại với ca, các mục tiêu và các số đếm mà nó có, và một bộ hẹn giờ đang chạy vẫn chạy theo đồng hồ treo tường (hoặc, nếu đã hết hạn trong lúc đó, nhàn rỗi và được đánh dấu là trễ, như ở trên).

## Trong tự động hóa

Trợ thủ là thứ mà quy tắc dựa vào và đặt giá trị:

```json
{"triggers": [{"type": "state", "entityId": "input_boolean.changeover", "to": "on"}],
 "actions": [{"type": "call_service", "params": {"entityId": "number.line_2_speed_sp",
   "service": "number.set_value", "data": {"value": 0}}}]}
```

Việc ghi vào tag của quy tắc đi qua cổng ghi như mọi lần ghi khác, với quy tắc là bên thực hiện. `states['input_select.shift'] == 'B'` dùng được trong một điều kiện, và một quy tắc có thể đặt một trợ thủ bằng `call_service` theo cách giống như nó điều khiển một công tắc.
