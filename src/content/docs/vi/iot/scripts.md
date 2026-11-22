---
title: "Script quy trình"
description: "Viết một chu trình một lần, đặt tên và chạy từ quy tắc, màn hình hoặc MCP. Lần chạy thử đi qua cổng kiểm soát ghi thật trước khi có gì chuyển động."
---

Script là một chuỗi các bước có tên. Chu trình CIP. Việc xả sạch dây chuyền. Việc chuyển sang sản phẩm B. Nhà máy nào cũng có một số quy trình mà lần nào cũng chạy y hệt nhau, và ngày có người chép một quy trình vào tự động hóa thứ tư rồi chỉ sửa một bước ở ba trong số đó là ngày bạn gặp rắc rối. Vì vậy bạn viết nó một lần, đặt tên, và mọi thứ cần đến nó đều gọi nó bằng tên đó: vận hành viên từ màn hình Scripts, một quy tắc có bước `call_script`, một tác nhân dùng `run_script`, bất cứ thứ gì qua `POST /api/services/script/turn_on`.

Script nói ngôn ngữ tự động hóa, chạy trên cùng bộ chạy chuỗi bước với các hành động của quy tắc, và mọi lệnh ghi của nó đều đi qua một cổng kiểm soát ghi duy nhất. Không có cửa hậu. Nó chưa từng có.

## Một script trông thế nào

```json
{
  "id": "cip_cycle",
  "name": "CIP cycle",
  "description": "Caustic wash, rinse, done. Tank must be empty.",
  "fields": [
    {"name": "minutes", "label": "Wash time", "type": "number", "min": 5, "max": 60, "step": 5, "unit": "min", "required": true},
    {"name": "circuit", "type": "select", "options": ["tank_1", "tank_2"], "default": "tank_1"}
  ],
  "sequence": [
    {"type": "condition", "params": {"expression": "float(states['sensor.cip_tank_level']) < 5"}},
    {"type": "call_service", "params": {"entityId": "switch.cip_pump", "service": "switch.turn_on"}},
    {"type": "delay", "params": {"seconds": 5}},
    {"type": "wait", "params": {"expression": "float(states['sensor.cip_return_temp']) > 70", "timeoutSec": 900}},
    {"type": "log_event", "params": {"message": "CIP on {{ vars.circuit }} for {{ vars.minutes }} minutes"}},
    {"type": "call_service", "params": {"entityId": "switch.cip_pump", "service": "switch.turn_off"}}
  ],
  "mode": "skip",
  "maxRuntimeSec": 1800
}
```

- **`id`** gồm chữ thường, chữ số và dấu gạch dưới, bắt đầu bằng một chữ cái. Nó cũng là id đối tượng của thực thể của script, nên cái này là `script.cip_cycle`, và không bao giờ thay đổi.
- **`fields`** là những gì một lần chạy nhận vào. Cùng các đầu vào có kiểu như ở mọi nơi trong HotLoop (`model.Field`): `number` với `min`, `max`, `step` và `unit`, `text` với `max_length` và `pattern`, `boolean`, `select` với `options`, `entity` với các `domain` mà nó nhận, `duration` (giây, hoặc `90s`, `1h30m`), `alarm` và `tag`. Mỗi trường có thể là `required` hoặc có `default`, và giá trị mặc định mà chính trường đó sẽ từ chối thì bị từ chối khi lưu. Một bước đọc một trường dưới dạng `vars.<name>`.
- **`sequence`** là ngôn ngữ tự động hóa, trọn vẹn: `call_service`, `write_tag`, `condition`, `wait`, `stop`, `call_script`, `set_variable`, `delay`, `log_event` và những bước còn lại. [Tự động hóa](/vi/iot/automations/) có mọi bước.
- **`mode`** và **`maxRuntimeSec`** ở bên dưới.

Script được biên dịch khi lưu, giống như quy tắc: một bước không giải mã được, một biểu thức không biên dịch được, một lần chờ dài hơn mức một lần chạy cho phép, một trường vô nghĩa, tất cả đều bị từ chối khi lưu. Bạn biết ngay trong trình soạn thảo, chứ không phải lúc 3 giờ sáng khi máy bơm đang dừng giữa chừng một lần rửa.

## Trường được kiểm tra, không bao giờ bị sửa

Trước khi bước đầu tiên chạy, những gì lần chạy được cung cấp sẽ được kiểm tra đối chiếu với các trường: mọi giá trị phải là giá trị mà trường của nó nhận, mọi giá trị bắt buộc phải có mặt, và một trường mà script không có là một lỗi, chứ không phải thứ bị lặng lẽ bỏ qua. **Một giá trị không bao giờ bị chỉnh cho vừa.** 70 phút ở trường có giá trị tối đa 60 bị từ chối, chứ không bị cắt còn 60; `"12"` cho một số bị từ chối, không được tự phân tích; 12,5 ở bước nhảy 5 bị từ chối, không được làm tròn. Giá trị tiếp tục đi điều khiển thiết bị đúng là giá trị ai đó đã nhập, nếu không thì không có gì chạy cả. Một lần chạy bị từ chối không để lại lần chạy nào: không có gì được bắt đầu.

## Chạy một script

| Từ | Cách | Cần |
|---|---|---|
| Màn hình Scripts | **Chạy** trên thẻ của nó, điền biểu mẫu | `scripts.run` |
| Thực thể của nó | **Chạy** trên ô của nó, hoặc `POST /api/services/script/turn_on` với các trường làm dữ liệu | `scripts.run` |
| API | `POST /api/scripts/{id}/run` với `{"fields": {...}, "reason": "..."}` | `scripts.run` |
| Một quy tắc | một bước `call_script` | quyền của chính quy tắc |
| Một tác nhân | `run_script` qua MCP | ghi qua MCP đang bật |

Vận hành viên chạy script. Quản trị viên viết chúng. Chạy chu trình CIP là việc nút bấm này sinh ra để làm; quyết định chu trình CIP mở những van nào là quyết định của kỹ sư và vẫn là như vậy.

Một lần chạy trả lời ngay khi nó bắt đầu, kèm id của nó. Yêu cầu nó chờ (`wait`) thì nó trả lời khi kết thúc, kèm kết quả và dấu vết của từng bước. **Dừng** (`POST /api/scripts/{id}/stop`, hoặc `script.turn_off`) hủy mọi lần chạy của script ngay tại chỗ nó đang ở, trong mọi tiến trình, kể cả lần chờ hay độ trễ. Những gì một bước đã ghi thì vẫn được ghi. Hoàn tác cũng là một lệnh ghi, được thực hiện mà không ai yêu cầu, lên thiết bị vốn đã chuyển động, và đó là quyết định của vận hành viên, không phải của chúng tôi.

## Mọi lệnh ghi đều đi qua cổng

Script chạy dưới tên **`script:<id>`**. Mọi lệnh ghi nó thực hiện, mọi lệnh gọi dịch vụ, mọi dòng nhật ký đều mang tên đó làm tác nhân thực hiện, và mọi lệnh ghi được kiểm toán theo tên đó trong `GET /api/writes`, dù bị từ chối hay không. **Nguồn** là người đã khởi động nó: `ui` từ màn hình, `automation` từ một quy tắc, `mcp` từ một tác nhân. Điều đó quan trọng vì cổng quyết định dựa trên nguồn. Một script do tác nhân khởi động ghi dưới nguồn `mcp`, và khi `HOTLOOP_ALLOW_WRITES` tắt thì mọi lệnh ghi của nó đều bị từ chối, đúng như `write_tag` của chính tác nhân sẽ bị từ chối. Trong trường hợp đó, `run_script` và `script.turn_on` của tác nhân từ chối ngay từ đầu, thay vì chạy một script mà mọi lệnh ghi đều sẽ bị trả về.

Lần chạy ghi lại ai đã yêu cầu (`actor`), bằng cách nào (`source`), và cái gì đã gọi nó (`parent`: `automation_run:812`, `script_run:77`), để bạn có thể đi từ một lệnh ghi ngược về quy tắc, script và người hay tác nhân đứng sau.

## Hỏi trước: lần chạy thử

`POST /api/scripts/{id}/run?dry_run=true`, **Kiểm tra trước** trong ngăn chạy, hoặc `run_script` với `dryRun`. Các trường được kiểm tra theo cùng cách, sau đó mọi bước được đi qua đối chiếu với nhà máy đúng như hiện tại:

- mọi `write_tag` và `call_service` được đưa qua chính các bước kiểm tra của cổng kiểm soát ghi (`CheckWrite`, `Services.Check`), cùng đoạn mã mà lệnh ghi thật chạy, nên một lần chạy thử không thể nói đồng ý với điều mà lệnh ghi thật sẽ từ chối vì một lý do mà lần chạy thử chưa kiểm tra. Không có gì được ghi, không có gì được kiểm toán;
- một `condition` được đánh giá ngay bây giờ, và một điều kiện sai kết thúc lượt đi qua ở đúng chỗ nó sẽ kết thúc lần chạy;
- một `set_variable` được gán, nên các bước sau nó thấy đúng những gì chúng sẽ thấy;
- một `call_script` đi qua script mà nó gọi, các bước của script đó được đánh số bên dưới lệnh gọi (`3.1`, `3.2`);
- một `wait`, một `delay` và bất cứ thứ gì không ghi vào thiết bị nào (một thông báo, một lệnh gọi HTTP, một báo động được nâng lên) là `not_checked`. Lần chạy thử không chờ mười lăm phút để cho bạn biết lúc đó bồn sẽ đọc được bao nhiêu.

Lệnh ghi đầu tiên sẽ bị từ chối kết thúc lượt đi qua, vì nó sẽ kết thúc lần chạy, và câu trả lời nói điều đó bằng lời của cổng: `step 2 (call_service): cip/pump: this tag is not marked writable`. Một lần chạy thử trả về sạch là lời khuyên, không phải lời hứa. Một thiết bị có thể rớt mạng, ai đó có thể tắt kích hoạt một tag, và một lần chờ cho nhà máy mọi khoảng thời gian cần thiết để đổi ý giữa lần kiểm tra của bạn và bước đó.

## Chế độ chạy

Điều xảy ra với một lần chạy được yêu cầu khi một lần chạy khác của cùng script đang diễn ra. Cùng những từ mà quy tắc dùng, chỉ khác một điểm.

| Chế độ | Lần chạy thứ hai |
|---|---|
| `skip` | bị từ chối, `409`, và một lần chạy `skipped` trong lịch sử nói rõ lý do. **Mặc định**, và là câu trả lời đúng cho mọi thứ điều khiển thiết bị |
| `queue` | chờ đến lượt và bắt đầu khi lần chạy phía trước kết thúc. Chỉ sâu một lượt: lần thứ ba bị từ chối |
| `restart` | hủy lần đang chạy ngay tại chỗ, rồi bắt đầu sau khi nó đã dừng. Hai lần chạy không bao giờ chồng lên nhau |
| `parallel` | chạy song song |

Điểm khác biệt: hàng đợi của quy tắc lặng lẽ bỏ lần chạy đang chờ cũ hơn, còn hàng đợi của script từ chối lần mới hơn một cách rõ ràng. Một quy tắc được kích hoạt bởi một điều kiện kích hoạt không quan tâm. Một script được ai đó, hoặc cái gì đó, yêu cầu và có thể đang chờ câu trả lời, và "lần chạy của bạn lặng lẽ không bao giờ xảy ra" không phải là một câu trả lời.

Một bước `call_script` chờ một script đang bận sẽ thất bại (`script busy`); bước không chờ sẽ ghi chú điều đó vào dấu vết và đi tiếp, vì tất cả những gì nó từng sẽ làm là khởi động script.

`maxRuntimeSec` giới hạn một lần chạy, năm phút khi bằng không. Một lần chạy hết thời gian này sẽ là `timed_out`, dù nó đang ở giữa các bước hay giữa một lần chờ.

## Script gọi script

Một bước `call_script` chạy một script từ một quy tắc hoặc từ một script khác. Với `wait`, bước lấy kết quả của script làm kết quả của mình, và script là một phần của lần chạy đã gọi nó: hủy bên gọi, hoặc để nó hết thời gian, thì script nó đang chờ cũng dừng theo. Không có `wait`, script được khởi động rồi để tự chạy cho xong.

Hai giới hạn, cả hai có là vì phương án thay thế là một script lặp vô tận:

- **Một script sẽ tự gọi chính nó bị từ chối khi lưu**, trực tiếp hoặc qua bất kỳ chuỗi script nào khác: `script b would call itself: b calls a calls b`. Điều tương tự áp dụng cho một chỉnh sửa khép kín một vòng lặp.
- **Sâu năm cấp, khi chạy.** Script thứ sáu trong một chuỗi làm hỏng bước lẽ ra gọi nó, và cả chuỗi theo đó. Và nếu một vòng lặp lọt qua bước lưu (hai tiến trình lưu hai nửa của nó cùng lúc), lần chạy sẽ bắt được: một script đang chạy trong chính chuỗi của nó bị từ chối, không chạy lần thứ hai.

## Thực thể của script

Mỗi script là một thực thể, `script.<id>`, nền tảng `script`. Trạng thái của nó là `on` khi một lần chạy của nó đang diễn ra, ở bất kỳ tiến trình nào, và `off` khi không có lần nào; các thuộc tính của nó mang `mode`, số lần chạy đang diễn ra (`current`), `fields`, và lần khởi động gần nhất cùng cách nó kết thúc. Nó nằm trên màn hình Thực thể với nút **Chạy**, trong `list_entities` qua MCP, trong `/api/states`, và một quy tắc có thể có điều kiện kích hoạt theo trạng thái trên nó: "khi chu trình CIP tắt, ghi lô". Xóa một script khiến thực thể của nó thành mồ côi, giống như xóa một định nghĩa báo động: quản trị viên xóa thực thể mồ côi khi không còn gì tham chiếu đến nó.

## Lịch sử các lần chạy

Mỗi lần chạy là một hàng trong `script_runs`: ai, bằng cách nào, các trường nó nhận được sau khi đã kiểm tra, dấu vết của từng bước (đầu vào đã giải quyết, không phải mẫu), nó kết thúc ra sao và vì sao. `GET /api/scripts/{id}/runs`, ngăn chạy, và [nhật ký sự kiện](/vi/iot/logbook/), nơi các lần chạy script có loại `script`, tìm được theo thực thể của script hoặc theo bất cứ thứ gì một lần chạy đã ghi vào. Lịch sử giữ 500 lần chạy mới nhất của mỗi script, cùng giới hạn với các lần chạy tự động hóa.

Hàng của một lần chạy được mở trước bước đầu tiên và hoàn tất sau bước cuối cùng. Khi tiến trình dừng, nó hủy mọi lần chạy đang diễn ra ngay tại chỗ và ghi lại là `cancelled: interrupted by restart`. Một lần chạy bị sự cố làm gián đoạn, không còn ai hoàn tất hàng của nó, được đánh dấu y như vậy ở lần khởi động tiếp theo của Gateway. **Không gì tiếp tục một lần chạy.** Tiếp tục từ bước bốn của chu trình CIP một giờ sau, không ai yêu cầu, trên một nhà máy đã thay đổi trạng thái, còn tệ hơn là nói rằng nó đã dừng.

## Nhiều hơn một tiến trình

Gateway và một tiến trình `--mcp-stdio` bên cạnh (hoặc hai pod đang giữa đợt triển khai) đều chạy script. Trạng thái của một lần chạy nằm trong cơ sở dữ liệu, và mọi tiến trình đều lắng nghe thay đổi trên `hotloop_script`, nên:

- một script khởi động trong một tiến trình hiện `on` trong thực thể của mọi tiến trình;
- một script lưu trên một pod là script trên pod kia, và các lần chạy của nó ở đó bị hủy nếu các bước của nó đã đổi;
- **Dừng** dừng mọi lần chạy của nó, trong mọi tiến trình.

Chế độ chạy được giữ theo từng tiến trình. Hai tiến trình có thể mỗi bên khởi động một lần chạy của một script `skip` trong cùng một khoảnh khắc. Một nhà máy chạy cùng một quy trình từ tiến trình phụ trợ của một tác nhân và từ màn hình của vận hành viên trong cùng một giây có một cuộc trao đổi cần làm mà không khóa nào của chúng tôi giải quyết được.

## Sao lưu

`scripts` và `script_runs` có trong mọi bản sao lưu và trở lại khi khôi phục, cùng lịch sử. Một lần chạy mà bản sao lưu bắt được giữa chừng sẽ trở lại ở trạng thái `running` và được đánh dấu `interrupted by restart` ở lần khởi động đầu tiên, như mọi lần chạy khác. Xem [Sao lưu và khôi phục](/vi/iot/backup/).

## API

Mọi tuyến, quyền của nó và các câu trả lời của nó nằm trong [API HTTP](/vi/iot/api/#scripts).

| Quyền | người xem | vận hành viên | quản trị viên |
|---|---|---|---|
| `scripts.read`: liệt kê chúng, các lần chạy của chúng | có | có | có |
| `scripts.run`: chạy, chạy thử, dừng, `script.turn_on`/`turn_off` | không | có | có |
| `scripts.write`: tạo, sửa, xóa | không | không | có |
