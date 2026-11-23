---
title: "Công thức sản phẩm"
description: "Các giá trị đặt của một loại sản phẩm được áp dụng trong một lượt: kiểm tra toàn bộ, từ chối toàn bộ, ghi theo thứ tự và đọc lại từ thiết bị."
---

Công thức là một tập giá trị cùng được gửi xuống nhà máy. Nhiệt độ các vùng, tốc độ dây chuyền và khe hở khuôn của loại A. Việc chuyển sang chai 500 ml. Việc hạ giá trị đặt ban đêm. Nhà máy nào cũng có những thứ này, nhà máy nào cũng có một tờ giấy ép plastic ở đâu đó ghi các con số và một vận hành viên gõ vào từng số một, và nhà máy nào cũng có câu chuyện về cái đêm một trong số đó bị gõ sai.

Vì vậy các con số nằm ở đây, và chúng được gửi đi trong một lượt: trước hết được kiểm tra toàn bộ, gửi theo thứ tự, sau đó đọc lại từ thiết bị, mỗi con số đều được ghi lại. Mỗi công thức cũng là một thực thể, `scene.<id>`. Nó được xây dựng cho thiết bị có thể làm người bị thương, và đó là lý do phần lớn trang này nói về điều xảy ra khi có gì đó trục trặc.

## Một công thức trông thế nào

```json
{
  "id": "grade_a",
  "name": "Grade A",
  "description": "The 2pm run. Die at 210, line at whatever the order says.",
  "equipment_id": 7,
  "apply_permission": "recipes.apply",
  "params": [
    {"name": "speed", "label": "Line speed", "type": "number", "min": 0, "max": 400, "step": 10, "unit": "rpm", "required": true}
  ],
  "precondition": "states['input_boolean.line_ready'] == 'on'",
  "targets": [
    {"entity_id": "loop.line_02_die_tic", "service": "set_mode", "data": {"mode": "auto"}},
    {"entity_id": "loop.line_02_die_tic", "service": "set_setpoint", "data": {"value": 210}},
    {"entity_id": "number.line_02_speed", "service": "set_value", "data_expressions": {"value": "vars.speed"}},
    {"entity_id": "switch.line_02_heater", "service": "turn_on"},
    {"entity_id": "input_select.product", "service": "select_option", "data": {"option": "Grade A"}}
  ],
  "verify_sec": 10
}
```

- **`id`** gồm chữ thường, chữ số và dấu gạch dưới, bắt đầu bằng một chữ cái. Đó là id đối tượng của thực thể của nó, `scene.grade_a`, và không bao giờ thay đổi.
- **`equipment_id`** là nút trong cây thiết bị mà công thức thuộc về, để dễ tìm. Màn hình Công thức nhóm theo nó. Bỏ trống đối với công thức của cả nhà máy.
- **`params`** là những gì một lần áp dụng nhận vào: các trường có kiểu giống như của script (`model.Field`: `number` với `min`, `max`, `step` và `unit`, `text`, `boolean`, `select`, `entity`, `duration`, `alarm`, `tag`). Một đích đọc một trường dưới dạng `vars.<name>` trong một mục `data_expressions`.
- **`precondition`** là một biểu thức trong ngôn ngữ tự động hóa phải đúng thì công thức mới bắt đầu. Bỏ qua thì không có điều kiện nào.
- **`targets`** là các giá trị, **theo thứ tự chúng được gửi đi**. Mỗi đích là một thực thể, dịch vụ đặt nó và dữ liệu của dịch vụ đó, dưới dạng một giá trị (`data`) hoặc được tính từ các tham số (`data_expressions`). Tối đa 200.
- **`verify_sec`** là khoảng thời gian dành cho mỗi giá trị đã ghi để xuất hiện trong số đọc từ thiết bị. Từ 1 đến 600, mặc định 10.

### Một đích có thể là gì

Công thức **đặt các giá trị**. Các dịch vụ nó nhận là những dịch vụ khiến thiết bị giữ một giá trị:

| Miền | Dịch vụ |
|---|---|
| `switch`, `input_boolean` | `turn_on`, `turn_off` |
| `number`, `input_number`, `input_counter` | `set_value` |
| `text`, `input_text` | `set_value` |
| `select`, `input_select` | `select_option` |
| `valve` | `set_position` |
| `motor` | `set_speed` |
| `loop` | `set_setpoint`, `set_mode` |

Nhấn một nút, khởi động một động cơ, đặt lại một bộ đếm, dừng một van: bị từ chối khi lưu. Đó là các hành động, không phải giá trị, và chúng thuộc về một [script](/vi/iot/scripts/). "Áp dụng loại A" mà nhấn nút đặt lại mỗi khi có người áp dụng không phải là điều ai cũng hiểu là công thức, và ngày điều đó xảy ra giữa một đợt sản xuất là ngày bạn biết. Toggle cũng bị từ chối: một công thức lật một công tắc sẽ làm điều ngược lại cứ mỗi lần thứ hai.

Thực thể của một đích phải tồn tại khi bạn lưu, các biểu thức của nó phải biên dịch được, và cùng một thực thể không thể được đặt hai lần bởi cùng một dịch vụ (hai giá trị cho một cài đặt, và giá trị nào thắng sẽ phụ thuộc vào một thứ tự không ai đọc). Chế độ và giá trị đặt của một vòng điều khiển là hai cài đặt và cả hai đều có thể được đặt; hãy đặt chế độ trước, vì giá trị đặt cho chế độ tự động chẳng có nghĩa gì với một vòng điều khiển đang ở chế độ thủ công.

## Áp dụng một công thức

Từ màn hình Công thức, ô của công thức trên màn hình Thực thể, một bước `apply_recipe` của một quy tắc hoặc một script, `apply_recipe` của MCP, hoặc `POST /api/services/scene/turn_on`. Mỗi cách đều làm đúng như sau:

### 1. Kiểm tra toàn bộ, từ chối toàn bộ

Trước khi một giá trị nào được đi đến đâu:

- Các tham số được kiểm tra đối chiếu với các trường của chúng. **Một giá trị không bao giờ bị chỉnh cho vừa.** 450 ở một trường có giá trị tối đa 400 bị từ chối, không bị cắt xuống
  400. `"250"` cho một số bị từ chối, không được tự phân tích. 255 ở bước nhảy 10 bị từ chối, không được làm tròn. Con số đi xuống nhà máy đúng là con số ai đó đã nhập, nếu không thì không có gì được gửi.
- Quyền riêng của công thức, khi nó nêu một quyền (bên dưới), và các công tắc ghi của MCP, đối với một tác nhân.
- Điều kiện tiên quyết được đánh giá đối chiếu với nhà máy như hiện tại.
- Mọi biểu thức dữ liệu đều được đánh giá. Một biểu thức thất bại sẽ làm công thức bị từ chối; một đích không bao giờ được gửi mà thiếu giá trị mà nó đáng ra phải có.
- Không có gì khác trong tiến trình này được phép đang ghi vào một trong các thực thể của nó (bên dưới).
- **Mọi đích đều được đưa qua chính các bước kiểm tra của cổng kiểm soát ghi**, đúng những bước mà lệnh ghi của nó sẽ gặp: ghi đang bật, tag có thể ghi, giá trị nằm trong phạm vi của tag, thực thể được bật và chấp nhận giá trị (bước nhảy, các lựa chọn, một vòng điều khiển ở chế độ thủ công cho đầu ra của nó), thiết bị đã kết nối. `Services.Check`, mà với một tag là `runtime.Manager.CheckWrite`. Không có gì được ghi hay kiểm toán.

**Nếu có bất cứ điều gì thất bại, cả công thức bị từ chối và không có gì được ghi.** Không phải mười đích đầu rồi mới bị từ chối. Không có gì cả. Và bạn nhận được mọi lý do, không chỉ lý do đầu tiên: một vận hành viên được báo từng vấn đề sẽ sửa nó rồi lại được báo vấn đề tiếp theo, mà một công thức có bốn mươi đích cần được sửa trong một lượt. Mỗi đích cho biết nó thuộc loại nào: `would_write`, `refused` kèm lời của cổng, hoặc `not_sent`.

### 2. Ghi theo thứ tự, một id lệnh gọi, không bao giờ hoàn tác

Sau đó các đích được gửi theo thứ tự, mỗi đích qua `Services.Call` và do đó qua `runtime.Manager.Write`, cổng kiểm soát ghi duy nhất. Không có cửa hậu. Mỗi lệnh ghi mang **id lệnh gọi** của lần áp dụng, nên toàn bộ lần áp dụng là `GET /api/writes?call=<id>`, trong nhật ký kiểm toán, bên cạnh mọi lệnh ghi khác mà nhà máy từng nhận.

Một lần kiểm tra có thể qua mà lệnh ghi vẫn thất bại ngay sau đó. PLC trả lời một lệnh ghi bằng một ngoại lệ. Có người đá bung một sợi cáp. Có người tắt kích hoạt một tag giữa lần kiểm tra và lệnh ghi. **Đích đầu tiên không qua được sẽ dừng lần áp dụng.** Các đích sau nó không được gửi và ghi `skipped`.

**Không có gì đã ghi bị hoàn tác.** Đây là chủ ý, và là quy tắc mà mọi lệnh ghi của HotLoop tuân theo. Hoàn tác tự nó là một lệnh ghi: được thực hiện mà không ai yêu cầu, lên thiết bị vốn đã chuyển động, dựa trên điều chúng tôi cho là giá trị trước đó, vào đúng lúc có thứ vừa chứng minh rằng nhà máy không hành xử như chúng tôi mong đợi. Đó là cách một công thức áp dụng dở dang trở thành một dây chuyền hoàn toàn rối loạn. Quyết định làm gì với một công thức áp dụng dở dang là việc của vận hành viên, và họ nhận đúng thông tin để làm việc đó:

```text
PARTIAL v3: 2 of 5 written before one failed, nothing undone
  1. set_mode loop.line_02_die_tic: written, verified
  2. set_setpoint loop.line_02_die_tic: written, verified
  3. set_value number.line_02_speed: failed: the device answered the write with an exception
  4. turn_on switch.line_02_heater: skipped
  5. select_option input_select.product: skipped
```

Một đích là `written`, `failed` (nó đã được gửi đi và thiết bị nói không, hoặc không nói gì, nên không biết đã được nhận hay chưa), `not_sent` (cổng đã từ chối vào phút cuối) hoặc `skipped`. Lần áp dụng là `applied` (mọi đích đã ghi), `partial` (một số đã ghi) hoặc `failed` (đích đầu tiên chưa ghi).

Khi đó màn hình Công thức đưa ra **Áp dụng các đích còn lại**. Đó là một lần áp dụng mới, cho các đích chưa được ghi, với cùng phiên bản và tham số, lại được kiểm tra toàn bộ trước, được kiểm toán dưới một id lệnh gọi riêng, với `application:<id>` làm cha để hai lần áp dụng được tìm thấy cùng nhau. Nó không bao giờ tự động. Có người xem chuyện gì đã xảy ra, sửa cái đã làm nó dừng và nhấn nút.

### 3. Đọc lại

Đã ghi không giống với đã được nhận. PLC có thể chấp nhận một lệnh ghi rồi logic của chính nó ghi đè lên ở chu kỳ quét tiếp theo. Một thanh ghi có tỷ lệ có thể nhận 12,34 và giữ 12,3. Vì vậy sau lệnh ghi cuối cùng, mỗi giá trị đã ghi được đọc lại:

- với một đích trên thiết bị, chỉ từ một số đọc **được lấy sau lệnh ghi của nó**, để bộ nhớ đệm nhớ điều thiết bị đã nói trước đó không thể xác nhận được gì;
- từ trạng thái của thực thể, hoặc với một van, một động cơ và một vòng điều khiển thì từ thuộc tính mà dịch vụ đặt (`current_position`, `speed`, `setpoint`, `mode`);
- một số trong phạm vi một phần triệu của chính nó (thanh ghi dấu phẩy động trả 0,1 thành 0,10000000149, vẫn là cùng một giá trị đặt), mọi thứ khác phải chính xác.

Mỗi đích đã ghi là **`verified`** khi đọc lại được, hoặc **`unconfirmed`** nếu chưa được trong `verify_sec`, kèm điều đã đọc được thay vào đó:

```text
  3. set_value number.line_02_speed: written, unconfirmed (not confirmed within 10s: read back 240, not 250)
```

Mục chưa xác nhận được hiển thị màu **hổ phách**, không bao giờ màu xanh, trên màn hình Công thức, và là một cảnh báo trong nhật ký sự kiện và nhật ký hệ thống. Đó không phải một thất bại: giá trị đã được gửi đi và thiết bị đã chấp nhận, và lần áp dụng vẫn là `applied`. Đó là một cờ nói hãy đi xem, vì có thể nó chưa được nhận. Một trình trợ giúp giữ giá trị của chính nó, nên đích của trình trợ giúp được xác minh thẳng từ nó.

Câu trả lời quay lại khi việc đọc lại xong, nên áp dụng một công thức mất tối đa `verify_sec`.

## Chồng chéo

Hai công thức đan xen các lệnh ghi vào cùng một giá trị đặt sẽ để nó ở giá trị của công thức đến sau cùng, và đó không phải công thức của ai. Vì vậy trong lúc một lần áp dụng đang ghi và đọc lại, nó giữ mọi thực thể mà nó nhắm tới, và một lần áp dụng khác nhắm tới bất kỳ thực thể nào trong số đó bị từ chối, `409`, kèm công thức nào đang cản đường. Hãy chờ nó, rồi áp dụng.

Việc giữ này nằm trong tiến trình: một lần áp dụng từ Gateway và một lần từ tiến trình `--mcp-stdio` bên cạnh không giữ chặn nhau. Hãy chạy một bên ghi, hoặc để các công thức của tác nhân và của vận hành viên trên các thiết bị khác nhau.

## Phiên bản

Tên, mô tả, nút thiết bị và quyền của một công thức thuộc về công thức và thay đổi tại chỗ. **Điều nó ghi là một phiên bản, và một phiên bản không bao giờ bị thay đổi.** Lưu các đích khác, các tham số khác, một điều kiện tiên quyết khác hoặc `verify_sec` khác sẽ lưu phiên bản tiếp theo và biến nó thành phiên bản hiện tại. Phiên bản 3 đúng là như ngày nó được lưu, mãi mãi, và mỗi lần áp dụng ghi lại phiên bản và các tham số nó đã chạy với. Cái đã được gửi xuống nhà máy hôm thứ Ba tuần trước luôn có câu trả lời.

- Chỉ đổi tên, hoặc chỉ đổi ghi chú, không tạo phiên bản.
- Một lần lưu lên phiên bản mà người khác đã thay thế kể từ đó bị từ chối, `409`, thay vì lặng lẽ vứt bỏ thay đổi của họ. Trình soạn thảo gửi phiên bản nó đang chỉnh sửa.
- Có thể cố ý áp dụng một phiên bản cũ hơn: chọn nó trong ngăn áp dụng, hoặc `"version": 2`. Lần áp dụng cho biết đó là phiên bản 2.
- Ngăn Phiên bản hiển thị mọi phiên bản cùng người đã lưu, ghi chú của họ và những gì đã đổi so với phiên bản trước, theo từng đích.

Xóa một công thức xóa các phiên bản của nó. Các lần áp dụng của nó được giữ lại: chúng là những gì đã được gửi xuống nhà máy, và lịch sử đó tồn tại lâu hơn công thức.

## Ghi lại một công thức

Không ai viết tay một công thức bốn mươi đích khi dây chuyền đang chạy loại A. **Ghi lại** lấy các thực thể bạn chọn và soạn một công thức nháp đặt từng cái về đúng giá trị nó đang giữ ngay lúc này, theo thứ tự bạn đã chọn: giá trị của một số, bật hay tắt của một công tắc, lựa chọn của một bộ chọn, vị trí của một van, tốc độ của một động cơ, chế độ của một vòng điều khiển rồi đến giá trị đặt của nó. Bạn đặt tên, tỉa bớt, biến những con số thay đổi theo từng đơn hàng thành tham số, rồi lưu.

Một thực thể có giá trị không biết, hoặc không đáng tin, bị **từ chối, không được ghi lại**: một số đọc có chất lượng khác tốt, `unknown`, `unavailable`, một thực thể bị tắt. Một công thức dựng từ một số đọc xấu sẽ ghi số đọc xấu đó trở lại nhà máy, mỗi khi có người áp dụng nó.

## Ai được áp dụng một công thức

Vận hành viên áp dụng công thức (`recipes.apply`); quản trị viên viết chúng (`recipes.write`); mọi người đều đọc chúng (`recipes.read`). Nạp loại A là việc vận hành viên có mặt để làm. Quyết định loại A là gì là quyết định của kỹ sư.

Một công thức có thể nêu một quyền riêng hẹp hơn: `"apply_permission": "recipes.apply.night_setback"`. Khi đó việc áp dụng nó cũng cần quyền đó, mà vai trò vận hành viên không có. Hãy cấp nó cho những người được áp dụng công thức đó thông qua danh sách quyền của chính họ:

```json
["recipes.read", "recipes.apply", "recipes.apply.night_setback"]
```

`recipes.apply.*` cấp quyền của mọi công thức, và quản trị viên giữ tất cả. Người dùng không có quyền bị từ chối, và **việc từ chối được ghi lại**: một lần áp dụng bị từ chối trong lịch sử của công thức, kèm tên họ, như mọi lần áp dụng khác. Điều này cũng đúng khi đi qua thực thể scene.

Một tác nhân không giữ quyền của người dùng nào, nên **tác nhân không bao giờ áp dụng công thức nêu quyền riêng**. Nó có thể đọc công thức và hỏi liệu có áp dụng được không; câu trả lời nói rõ vì sao không.

## Điều kiện tiên quyết

```json
"precondition": "states['input_boolean.line_ready'] == 'on' and float(states['sensor.line_02_die_temp']) < 250"
```

Ngôn ngữ tự động hóa, được đánh giá đối chiếu với nhà máy như khi có người nhấn Áp dụng, với các tham số là `vars`. Sai thì từ chối công thức, và nói rõ như vậy. Đó là một biện pháp chống lại việc áp dụng đúng con số vào sai thời điểm, không phải một khóa liên động: khóa liên động nằm trong PLC, nơi nó vẫn hoạt động khi mạng không hoạt động.

## Từ một quy tắc, một script hoặc một tác nhân

Một quy tắc hoặc một script áp dụng một công thức bằng bước `apply_recipe` (xem [Tự động hóa](/vi/iot/automations/)):

```json
{"type": "apply_recipe", "params": {"recipeId": "grade_a", "params": {"speed": 250}}}
```

Nó áp dụng với tư cách quy tắc, `automation:<id>`, hoặc script, `script:<id>`, kèm nguồn của lần chạy đó trên mọi lệnh ghi, và cha của lần áp dụng là lần chạy. Bước này thất bại trừ khi mọi đích đã được ghi; một giá trị chưa xác nhận không làm nó thất bại, và dấu vết ghi `NOT confirmed by read-back`. Lần chạy thử của một script cũng kiểm tra công thức.

Qua MCP, `list_recipes` hiển thị mọi công thức cùng các đích và tham số của chúng, `validate_recipe` hỏi liệu một công thức có áp dụng được ngay bây giờ không, và `apply_recipe` áp dụng nó, với một lý do **bắt buộc**. Các lệnh ghi của một tác nhân mang nguồn `mcp`, nên cổng áp dụng cho từng lệnh, và khi ghi bị tắt (`HOTLOOP_ALLOW_WRITES`) thì `apply_recipe` bị từ chối trước khi kiểm tra bất cứ điều gì. Xem [MCP](/vi/iot/mcp/#công-thức).

## Thực thể của công thức

Mỗi công thức là một thực thể `scene`, `scene.<id>`. Trạng thái của nó là lần áp dụng gần nhất (một lần áp dụng đã ghi gì đó), dưới dạng dấu thời gian, và `unknown` cho đến khi từng được áp dụng. Các thuộc tính của nó cho biết lần áp dụng mới nhất diễn ra thế nào: `last_result`, `last_version`, `last_applied_by`, `last_application`, và `unconfirmed` khi có chừng ấy giá trị của một lần áp dụng đã thực hiện không được đọc lại. Ô của nó có nút Áp dụng. `scene.turn_on` áp dụng nó, với `params` và `version` trong dữ liệu. Một quy tắc có thể kích hoạt theo trạng thái của nó, trạng thái này thay đổi một lần cho mỗi lần áp dụng đã ghi gì đó.

Xóa một công thức khiến thực thể của nó thành mồ côi, giống như xóa một script.

## Bản ghi

Mỗi lần áp dụng, kể cả những lần bị từ chối, là một hàng của `recipe_applications`: công thức, phiên bản, các tham số, ai, từ đâu, vì sao, id lệnh gọi, điều đã xảy ra với từng đích và liệu nó có được đọc lại hay không. Nó được mở trước lệnh ghi đầu tiên và hoàn tất sau khi đọc lại, nên một lần mà tiến trình chết giữa chừng vẫn nói rằng nó đã bắt đầu. Lần khởi động tiếp theo của Gateway đánh dấu nó `failed`, `interrupted by restart`, trỏ đến id lệnh gọi của nó trong nhật ký kiểm toán ghi. Không gì tiếp tục nó.

Mỗi lần áp dụng là một dòng trong nhật ký hệ thống dưới scene, và một mục trong [nhật ký sự kiện](/vi/iot/logbook/), loại `recipe`, bên cạnh các lệnh ghi nó đã thực hiện. Lịch sử của một công thức giữ 5000 lần áp dụng mới nhất.

## Nhiều hơn một tiến trình

Mỗi thay đổi của một công thức và mỗi lần áp dụng đều được thông báo cho mọi tiến trình trên cơ sở dữ liệu, nên một công thức lưu trên một pod là công thức mà pod kia áp dụng, và một lần áp dụng do tiến trình `--mcp-stdio` thực hiện sẽ làm thực thể scene của Gateway thay đổi.

## Sao lưu

Các công thức, mọi phiên bản và mọi lần áp dụng đều nằm trong bản sao lưu và trở lại đúng như trước. Một lần áp dụng mà bản sao lưu bắt được giữa chừng trở lại ở trạng thái `applying` và được đánh dấu `failed` ở lần khởi động đầu tiên, như một sự cố. Xem [Sao lưu và khôi phục](/vi/iot/backup/).

## API

[API HTTP](/vi/iot/api/#công-thức) có mọi tuyến. Tóm tắt:

| <span class="sr-only">Chi tiết</span> | <span class="sr-only">Chi tiết</span> |
|---|---|
| `GET /api/recipes` | mọi công thức, nội dung hiện tại và lần áp dụng gần nhất |
| `POST /api/recipes` | tạo một công thức, là phiên bản 1 |
| `POST /api/recipes/capture` | một bản nháp từ giá trị các thực thể đang giữ |
| `PUT /api/recipes/{id}` | lưu; nội dung mới là phiên bản mới |
| `GET /api/recipes/{id}/versions` | mọi phiên bản, như đã lưu |
| `POST /api/recipes/{id}/validate` | bây giờ nó có áp dụng được không? không có gì được ghi |
| `POST /api/recipes/{id}/apply` | áp dụng: `200` đã áp dụng, `409` bị từ chối, `502` một phần hoặc thất bại |
| `GET /api/recipes/{id}/applications` | mọi lần áp dụng, kể cả những lần bị từ chối |
