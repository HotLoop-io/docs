---
title: "Thực thể trong HotLoop"
description: "Sổ đăng ký thực thể làm nền cho mọi tự động hóa, helper, script và màn hình: ID không bao giờ đổi, miền, dịch vụ và API để đọc chúng."
---

Sổ đăng ký thực thể và công cụ tính trạng thái thực thể là nền tảng cho mọi tự động hóa, helper, script và màn hình trong HotLoop.

## Vì sao cần thực thể khi đã có Tag

Tag là thứ trình điều khiển nói tới: một thanh ghi lưu giữ, một NodeId, một độ lệch DB của S7. Tag được xác định bằng thiết bị và tên Tag, không thể đổi tên, và chỉ có nghĩa là đúng một điểm trên một đường dây.

Thực thể là thứ con người và các quy tắc nói tới: "nhiệt độ vùng 1", "công tắc chạy băng tải". Nó có một cái tên ổn định riêng (`sensor.zone_1_temperature`), một kiểu cho biết cách hiển thị và có thể làm gì với nó, và một tập liên kết tới các Tag tạo nên nó.

Thực thể bao quanh Tag. Chúng không thay thế Tag, và không có gì về Tag bị đổi để nhường chỗ cho chúng. Không có đường ống giá trị thứ hai và không có historian thứ hai: trạng thái của thực thể được tính từ cùng bộ nhớ đệm trực tiếp mà `/api/values`, công cụ báo động và máy chủ OPC UA vốn đã đọc. Mọi endpoint Tag hiện có, bảng điều khiển, `/api/write`, các công cụ MCP và các quy tắc tự động hóa có từ trước khi có thực thể vẫn hoạt động y như cũ; thực thể được thêm vào bên cạnh chúng, không thay chỗ chúng.

## Những gì bạn có mà không cần làm gì

Mọi Tag đều tự động có một **thực thể đọc**:

| Kiểu dữ liệu của Tag | Miền của thực thể đọc |
|---|---|
| `bool`, `boolean`, `bit`, `coil`, `discrete` | `binary_sensor` |
| mọi kiểu còn lại | `sensor` |

Lần đầu một Tag được cho phép ghi, nó cũng có thêm một **thực thể điều khiển**:

| Kiểu dữ liệu của Tag | Miền của thực thể điều khiển |
|---|---|
| nhóm bool | `switch` |
| nhóm int và float | `number` |
| `string`, `text`, `char` | `text` |

Thực thể điều khiển không bao giờ bị xóa vì Tag của nó đã được hủy kích hoạt. Cổng ghi vẫn từ chối ghi vào Tag đã hủy kích hoạt như vẫn luôn làm, và thuộc tính `armed` của thực thể chuyển thành `false` để màn hình có thể làm xám phần điều khiển. Giữ lại thực thể chính là mục đích: một tự động hóa hay một bảng điều khiển gọi `switch.press_01_pump` không nên hỏng chỉ vì ai đó đã hủy kích hoạt máy bơm trong một ca.

Các Tag có sẵn có thực thể ngay trong lúc nâng cấp: migration `0005_entities.sql` điền một thực thể đọc cho mọi Tag và một thực thể điều khiển cho mọi Tag đã cho phép ghi, trong cùng giao dịch tạo các bảng. Hoặc là mọi Tag đều có thực thể khi phiên bản mới phục vụ yêu cầu đầu tiên, hoặc là không có gì thay đổi.

Mọi định nghĩa báo động cũng có một **thực thể báo động** theo cách tương tự: xem [Thực thể báo động](#thực-thể-báo-động).

Ra lệnh cho một thực thể điều khiển (bật một công tắc, đặt một số) là một lệnh gọi dịch vụ, và lệnh gọi dịch vụ là các lần ghi Tag qua `runtime.Manager.Write` và cổng ghi như mọi lần ghi khác. Không có cửa nào khác. Xem [Dịch vụ](#dịch-vụ).

Thiết bị gồm nhiều Tag (một máy bơm có lệnh chạy, tiếp điểm đang chạy và lỗi; một van có công tắc hành trình; một vòng PID) là một **thực thể ghép** do bạn chủ động tạo từ các Tag của nó. Xem [Thiết bị ghép](#thiết-bị-ghép).

## ID thực thể

`entity_id` có dạng `<domain>.<object_id>`: chữ thường, chữ số và dấu gạch dưới, tối đa 255 ký tự. ID tự động của một Tag là `<domain>.<device>_<tag>`, trong đó cả hai nửa được chuyển thành chữ thường và mỗi chuỗi ký tự không phải chữ cái hay chữ số ASCII được thay bằng một dấu gạch dưới:

| Thiết bị | Tag | Thực thể đọc |
|---|---|---|
| `press-01` | `Zone1_Temp` | `sensor.press_01_zone1_temp` |
| `Line.A-2` | `Motor/Speed.PV` | `sensor.line_a_2_motor_speed_pv` |
| `press-01` | `温度` | `sensor.press_01_tag` |

Hai Tag cho ra cùng một ID thì được thêm `_2`, `_3` và cứ thế, theo thứ tự đăng ký. Tên quá 255 ký tự bị cắt trước hậu tố, không bao giờ cắt ngang hậu tố.

**Một `entity_id` được tạo một lần, được lưu lại và không bao giờ được tạo lại.** Đổi mô tả của Tag, đổi kiểu dữ liệu, chuyển sang thanh ghi khác: không việc nào chạm tới entity_id. Thứ duy nhất làm nó đổi là một thao tác đổi tên tường minh qua `PUT /api/entities/{entity_id}`, đó là thao tác của quản trị viên và được ghi vào nhật ký hệ thống (danh mục `config`, đối tượng là ID mới, ID cũ nằm trong thông điệp và chi tiết).

Đổi tên vẫn giữ nguyên miền. Danh tính của một thực thể là `id` trong cơ sở dữ liệu và `unique_id` của nó, và cả hai không bao giờ thay đổi:

| Thực thể | `unique_id` |
|---|---|
| thực thể đọc của một Tag | `tag:<device>/<tag>` |
| thực thể điều khiển của một Tag | `tag-control:<device>/<tag>` |
| một thực thể báo động | `alarm:<definition id>` |
| một thực thể ghép | `composite:<32 random hex digits>` |

Ba loại đầu được suy ra từ thứ mà thực thể bao quanh, nhờ đó một Tag hay một định nghĩa báo động đã bị xóa mà quay lại sẽ nhận lại đúng thực thể của nó. Thực thể ghép không có gì như vậy để suy ra: hai máy bơm giống hệt nhau trên một PLC được liên kết với các Tag khác nhau, và cùng những Tag đó có thể chủ ý làm nền cho hai thực thể ghép. Vì vậy `unique_id` của nó là ngẫu nhiên, được tạo một lần khi nó ra đời. Nó không bao giờ trùng với bất cứ thứ gì khác, kể cả một thực thể ghép đã bị xóa rồi tạo lại, vốn là một thực thể mới và đúng là nên như vậy.

## Tag bị xóa, thực thể mồ côi và việc nhận lại

Xóa một Tag thì các thực thể của nó bị **mồ côi** chứ không bị xóa: `orphaned_at` được đặt và trạng thái chuyển sang `unavailable`. Đưa chính Tag đó trở lại, bằng trình soạn thảo Tag hoặc bằng cách nhập lại từ duyệt, sổ đăng ký sẽ tìm thấy thực thể mồ côi qua `unique_id` và nhận lại nó. Entity_id, tên, lớp thiết bị, biểu tượng và mọi tùy chỉnh khác quay lại cùng nó.

Điều đó là có chủ ý. Trong nhà máy, một Tag bị xóa rồi nhập lại thường xuyên hơn nhiều so với lúc có ai thật sự muốn "quên hết mọi thứ về điểm này", và một tự động hóa gọi `sensor.oven_temperature` nên tiếp tục chạy qua việc đó.

Xóa cả một thiết bị thì khác: các thực thể của nó đi cùng, giống như các Tag của nó. Điều đó bao gồm một thực thể ghép có mọi Tag nằm trên thiết bị này. Một thực thể ghép trải trên nhiều thiết bị không thuộc thiết bị nào, và khi một thiết bị mất đi thì nó chỉ mất trạng thái.

Thực thể báo động theo định nghĩa báo động của chúng bằng cùng các quy tắc: xóa định nghĩa thì thực thể bị mồ côi, lưu một định nghĩa có cùng id thì thực thể được nhận lại.

Thực thể ghép không bao giờ bị mồ côi. Nó được tạo có chủ ý, nên nó tồn tại cho đến khi ai đó xóa; trong lúc một Tag của nó đã mất, nó ở trạng thái `unavailable`.

`DELETE /api/entities/{entity_id}` xóa một thực thể ghép hoặc một thực thể mồ côi. Nó từ chối (409) thực thể của một Tag hay một định nghĩa báo động mà thứ nó bao quanh vẫn còn, và cho biết cách để nó biến mất: xóa Tag hoặc định nghĩa, rồi xóa thực thể mồ côi. Xóa một thực thể còn sống chỉ khiến lần đồng bộ kế tiếp tạo lại nó dưới một ID mới, và làm hỏng mọi thứ gọi tên nó trong khoảng giữa. Để gỡ nó khỏi màn hình, hãy ẩn hoặc tắt nó.

## Sổ đăng ký bắt kịp thay đổi như thế nào

Sổ đăng ký không móc vào từng nơi một Tag có thể thay đổi. Nó đối chiếu: đọc mọi Tag và mọi thực thể, tạo thứ còn thiếu, làm mồ côi thứ đã mất Tag, nhận lại thứ có Tag quay về. Một lần đối chiếu không thể bỏ sót đường đi nào mà ai đó thêm vào năm sau, và chạy nó hai lần cũng như chạy một lần. Nó chạy:

- khi khởi động, bao gồm cả nâng cấp và khôi phục từ bản sao lưu;
- sau mỗi lần nạp lại runtime, mà mọi thay đổi về Tag và thiết bị vốn đã kích hoạt;
- đồng bộ trong các trình xử lý API làm thay đổi Tag (`POST /api/tags`, `DELETE /api/tags/...`, `POST /api/devices/{id}/import`, `DELETE /api/devices/{id}`) và định nghĩa báo động (`POST /api/alarms`, `DELETE /api/alarms/{id}`), để một client vừa tạo Tag hoặc định nghĩa rồi hỏi ngay thực thể của nó sẽ thấy nó.

Việc đăng ký được tuần tự hóa giữa các bản sao bằng khóa tư vấn của cơ sở dữ liệu, nên hai bản sao cùng nhập một thiết bị không thể cấp phát trùng một `_2`. Mỗi lần đối chiếu có thay đổi ghi một dòng vào nhật ký hệ thống, không phải một dòng cho mỗi thực thể: nhập năm nghìn điểm là một sự kiện.

## Trạng thái

`GET /api/states/{entity_id}`:

```json
{
  "entity_id": "sensor.press_01_zone1_temp",
  "state": "212.5",
  "attributes": {
    "friendly_name": "Zone1_Temp",
    "unit_of_measurement": "F",
    "device_class": "temperature",
    "source": ["press-01/Zone1_Temp"]
  },
  "quality": "good",
  "last_changed": "2026-09-26T14:02:11.482Z",
  "last_updated": "2026-09-26T14:02:11.482Z",
  "last_reported": "2026-09-26T14:07:40.100Z"
}
```

`state` là giá trị được hiển thị không kèm đơn vị: một số theo cách `/api/values` hiển thị, `on` hoặc `off` cho `binary_sensor` và `switch`, và chính đoạn văn bản cho chuỗi. Đơn vị là một thuộc tính. Một trạng thái lúc là `212.5` lúc là `212.5 F` thì không gì so sánh được.

Các quy tắc, theo thứ tự được áp dụng. Chúng giống các quy tắc máy chủ OPC UA dùng cho mã trạng thái của nó, vì cùng một lý do: **trạng thái không bao giờ tốt hơn bằng chứng của nó.**

| Điều kiện | `state` | `quality` |
|---|---|---|
| Thực thể mồ côi, hoặc Tag của nó đã mất | `unavailable` | `bad` |
| Thiết bị bị tắt, bị xóa hoặc liên kết không hoạt động | `unavailable` | `bad` |
| Liên kết đang hoạt động, chưa đọc được gì trong phiên này | `unknown` | `bad` |
| Lần đọc xấu | **giá trị tốt gần nhất**, hoặc `unknown` nếu chưa từng có | `bad` |
| Lần đọc tốt, nhưng các điểm khác trên thiết bị đang lỗi (suy giảm) | giá trị | `uncertain` |
| Lần đọc tốt | giá trị | `good` |

Quy tắc về lần đọc xấu quan trọng hơn vẻ ngoài của nó. Trình điều khiển báo một điểm không đọc được thành một lần đọc xấu có giá trị bằng không, và hiển thị số không đó làm trạng thái sẽ biến "bộ phát tín hiệu mức đã ngừng trả lời" thành "bồn đã cạn". Thực thể tiếp tục hiển thị giá trị tin cậy được gần nhất và cho biết, trong `quality`, rằng nó không còn đảm bảo được giá trị đó.

Hãy chú ý sự khác nhau giữa một điểm lỗi và một thiết bị lỗi. Một thiết bị Modbus có mọi khối đều lỗi sẽ bỏ phiên và kết nối lại, nên các thực thể của nó chuyển sang `unavailable`. Một thiết bị trả lời một số điểm mà không trả lời các điểm khác vẫn giữ kết nối (suy giảm), và chỉ các thực thể của những điểm lỗi mới hiện `bad`.

**Một thiết bị Modbus đã chết hiển thị nhanh đến đâu.** Thiết bị từ chối hoặc đóng kết nối thì chuyển sang `unavailable` ở lần thăm dò kế tiếp. Thiết bị chỉ đơn giản ngừng trả lời (cáp bị rút, PLC bị treo, một switch vừa khởi động lại) giữ nguyên socket mở và được phán xét theo thời gian chờ của lần thăm dò: các thực thể của nó chuyển sang `unavailable` trong vòng một chu kỳ thăm dò cộng hai lần thời gian chờ của thiết bị, cộng thêm tối đa một giây cho lần tính lại dự phòng của công cụ. Thường là một lần thời gian chờ; hai lần là khi thiết bị chết giữa lúc một lần thăm dò đang dở, vì yêu cầu đã nằm trên đường dây vẫn được cho đủ thời gian chờ. Cho đến lúc đó chưa đọc được gì mới, nên thực thể vẫn hiển thị lần đọc gần nhất đúng như nó đã có. Một thiết bị treo nhưng vẫn nhận kết nối được kết nối lại ngay, nên sau đó các thực thể của nó luân phiên giữa `unavailable` và `unknown` (đã kết nối, chưa đọc gì) cho đến khi nó trả lời lại; không cái nào bị nhầm là một giá trị. Thời gian chờ là núm điều chỉnh: một thiết bị có thời gian chờ 20 giây có thể trông vẫn ổn trong 20 đến 40 giây sau khi chết, nên đừng đặt nó dài hơn mức thiết bị cần để trả lời.

Bảng đó dành cho thực thể của một Tag. Thực thể ghép nghiêm ngặt hơn (một lần đọc xấu không bao giờ giữ giá trị cuối, xem [Trạng thái của thực thể ghép được quyết định thế nào](#trạng-thái-của-thực-thể-ghép-được-quyết-định-thế-nào)), và trạng thái của thực thể báo động là của công cụ báo động (xem [Thực thể báo động](#thực-thể-báo-động)).

### Dấu thời gian

- `last_changed` chỉ di chuyển khi `state` thay đổi.
- `last_updated` di chuyển khi `state`, `quality` hoặc bất kỳ thuộc tính nào thay đổi.
- `last_reported` là dấu thời gian của lần đọc mà trạng thái được lấy từ đó. Nó không có cho đến khi có một lần đọc.

Trạng thái được tính chứ không được lưu, nhưng sổ nhật ký giữ trạng thái mới nhất của mọi thực thể và lúc nó thay đổi lần cuối (`entity_last_state`, xem [Sổ nhật ký](/vi/iot/logbook/)). Sau khi khởi động lại, một thực thể có trạng thái quay lại giống như trước **giữ nguyên `last_changed`**: một máy bơm chạy từ thứ Ba vẫn báo thứ Ba. Các trạng thái unavailable và unknown mà thực thể Tag đi qua trong lúc thiết bị kết nối lại không tính là một thay đổi. Một trạng thái thật sự đã thay đổi trong lúc Gateway ngừng hoạt động sẽ nhận `last_changed` mới, và một dòng trong sổ nhật ký. Các thực thể số (cảm biến, số, vòng điều khiển, bộ đếm) và nút bấm không được theo dõi, nên `last_updated` của chúng, như của mọi thực thể, bắt đầu lại từ lúc khởi động lại.

### Thuộc tính

Mọi thực thể đều có `friendly_name` và `source` (các khóa Tag mà nó được liên kết). Sau đó, khi áp dụng được:

| Thuộc tính | Khi nào |
|---|---|
| `unit_of_measurement` | `sensor` và `number`: đơn vị riêng của thực thể, hoặc của Tag |
| `device_class`, `state_class`, `icon` | khi được đặt trên thực thể |
| `armed` | thực thể điều khiển: Tag có đang cho phép ghi ngay lúc này không |
| `min`, `max` | `number`: các tùy chọn của thực thể, nếu không thì dải của Tag nếu có |
| `step` | `number`: tùy chọn của thực thể, nếu không thì 1 cho Tag số nguyên |
| `max_length`, `pattern` | `text`: các tùy chọn của thực thể, `max_length` mặc định là 255 |
| `quality_reason` | thực thể Tag, khi lần đọc không tốt và trình điều khiển biết lý do: `no field at ENERGY.Power`, `payload is not JSON`. Biến mất ở lần đọc tốt kế tiếp |

### Bị tắt và bị ẩn

Một thực thể **bị tắt** không có trạng thái nào cả: nó không xuất hiện trong `/api/states`, và hỏi nó theo id thì được trả lời là nó bị tắt chứ không phải là không tìm thấy. Một thực thể **bị ẩn** vẫn có trạng thái như bình thường; cờ này để màn hình bỏ nó khỏi các chế độ xem mặc định.

### Công cụ chạy thế nào

Công cụ đăng ký vào bus Tag với tên `entities`, hàng đợi 256 lô, cùng cam kết có thể mất dữ liệu như công cụ báo động và công cụ tự động hóa: một bên tiêu thụ chậm sẽ mất các lô, nhưng không bao giờ làm kẹt một lần thăm dò. Một lô bị rơi ở đây tốn tối đa một giây, vì công cụ cũng tính lại mọi thực thể từ bộ nhớ đệm mỗi giây một lần. Nhịp đó cũng bắt được các thay đổi mà không ai báo, chẳng hạn lần thăm dò đầu tiên của một thiết bị vừa đến.

Các bên đăng ký bên trong tiến trình đăng ký bằng `Engine.OnStateChanged`. Chúng được gọi trên goroutine riêng của công cụ, theo thứ tự các thay đổi xảy ra, điều mà một quy tắc quan tâm đến "từ X sang Y" cần. Chúng phải nhanh. Công cụ không bao giờ chờ chúng; nếu chúng chậm hơn quá 10.000 thay đổi, các thay đổi cũ nhất bị bỏ và được đếm.

`GET /api/diagnostics` báo cáo nó dưới `entities`:

| Trường | Ý nghĩa |
|---|---|
| `entities` | có bao nhiêu thực thể có trạng thái |
| `droppedBatches` | các lô bus mà công cụ quá chậm để nhận (cũng có trong `bus.droppedPerSubscriber.entities`) |
| `pendingChanges`, `droppedChanges` | hàng đợi móc thay đổi trạng thái. Tồn đọng tăng dần, hoặc bất kỳ lần bỏ nào, nghĩa là một móc quá chậm |

## Lớp thiết bị và đơn vị

Một lớp thiết bị cho biết một giá trị là gì (`temperature`, `pressure`, `volume_flow_rate`, `running`, `problem`) để màn hình chọn được biểu tượng và bên dùng số liệu thống kê biết phải làm gì với nó. Mỗi lớp có những đơn vị nó thường đi kèm. Bảng đầy đủ là `model.DeviceClasses`.

- Một lớp thiết bị không có trong miền sẽ bị từ chối.
- Một đơn vị mà lớp thường không có sẽ được **lưu, kèm một cảnh báo** trong phản hồi. Nhà máy ghi nhãn theo cách nhà máy ghi nhãn, và `degF` trên một nhiệt độ không đáng để chặn việc lưu. `F` và `C` được chấp nhận cho nhiệt độ mà không cảnh báo, vì đó là thứ hầu hết cơ sở dữ liệu Tag của PLC thực sự dùng.
- `state_class` (`measurement`, `total`, `total_increasing`) chỉ dành cho cảm biến.
- **Không có chuyển đổi đơn vị.** Đơn vị chỉ là một nhãn.

## API

Các endpoint thực thể dùng tên trường snake_case (`entity_id`, `last_changed`) chứ không phải camelCase thường dùng của API này. Điều đó có chủ ý: API thực thể tồn tại để bất cứ thứ gì đã hiểu dạng đó đều hiểu được cái này.

| Endpoint | Quyền | Chức năng |
|---|---|---|
| `GET /api/entities` | `entities.read` | Mọi thực thể, kể cả thực thể mồ côi. Bộ lọc: `?domain=`, `?device=`, `?orphaned=true\|false` |
| `GET /api/entities/{entity_id}` | `entities.read` | `{"entity": ..., "state": ...}`; `state` là null với thực thể bị tắt |
| `GET /api/entities/{entity_id}/image` | `entities.read` | ảnh mới nhất của một camera hoặc một ảnh |
| `PUT /api/entities/{entity_id}` | `entities.write` | Đổi các trường sổ đăng ký, kể cả đổi tên. Trả về `{"entity": ..., "warnings": [...]}` |
| `POST /api/entities` | `entities.write` | Tạo một thực thể ghép. Trả về 201 `{"entity": ..., "warnings": [...]}`. Xem [Thiết bị ghép](#thiết-bị-ghép) |
| `DELETE /api/entities/{entity_id}` | `entities.write` | Xóa một thực thể ghép hoặc một thực thể mồ côi. Mọi thứ khác là 409 |
| `GET /api/states` | `entities.read` | Trạng thái của mọi thực thể đang bật, sắp theo entity_id. Bộ lọc: `?domain=` |
| `GET /api/states/{entity_id}` | `entities.read` | Một trạng thái |
| `POST /api/services/{domain}/{service}` | `values.write` (`alarms.ack` cho `alarm`) | Gọi một dịch vụ trên một thực thể. Xem [Dịch vụ](#dịch-vụ). `?dry_run=true` hỏi nó sẽ làm gì thay vì làm; xem [Hỏi trước](#hỏi-trước-chạy-thử) |
| `GET /api/writes?entity={entity_id}` | `values.read` | Mọi lần ghi mà các lệnh gọi dịch vụ đã thực hiện hoặc bị từ chối trên một thực thể, mới nhất trước |

Mọi vai trò đều có `entities.read`: trạng thái của một thực thể là giá trị của một Tag dưới một tên khác, mà người xem vốn đã đọc được. Chỉ quản trị viên có `entities.write`: entity_id là tên mà mọi tự động hóa, bảng điều khiển và tác tử dùng để gọi thực thể, và đổi nó là cấu hình chứ không phải vận hành.

Một `PUT` chỉ đổi những trường mà nó nêu tên. Trường không xác định bị từ chối, trường danh tính cũng vậy (`unique_id`, `domain`, `platform`, thiết bị và các liên kết):

```json
{
  "entity_id": "sensor.zone_1_temperature",
  "name": "Zone 1 temperature",
  "device_class": "temperature",
  "state_class": "measurement",
  "unit_of_measurement": "°F",
  "icon": "mdi:thermometer",
  "entity_category": "",
  "options": {},
  "disabled": false,
  "hidden": false
}
```

`options` nhận `min`, `max` và `step` trên một `number` (chúng thu hẹp những gì màn hình đưa ra; cổng ghi vẫn kiểm tra dải riêng của Tag bất kể thế nào) và `max_length` cùng `pattern` trên một `text`. Các tùy chọn của thực thể ghép là của riêng nó (xem từng miền bên dưới), và một `PUT` làm đổi chúng được kiểm tra với các Tag của nó y như lúc tạo. `sensor`, `binary_sensor`, `switch` và `alarm` không nhận tùy chọn nào.

Một thực thể cũng có một vị trí trên cây thiết bị và một tập nhãn: `equipment_id` (null để theo thiết bị của nó), `area_id` chỉ đọc mà client dùng để nhóm, và `labels`. `PUT` nhận `equipment_id` và `labels` như mọi trường khác. Xem [cây thiết bị và nhãn](/vi/iot/equipment/).

## Dịch vụ

Một dịch vụ là thứ bạn có thể làm với một thực thể: `switch.turn_on`, `number.set_value`. Nó gọi tên điều bạn muốn làm với thực thể, và bên dưới nó không là gì khác ngoài các lần ghi Tag.

```
POST /api/services/switch/turn_on
{"entity_id": "switch.press_01_pump", "reason": "start of shift"}

POST /api/services/number/set_value
{"entity_id": "number.press_01_zone1_sp", "value": 212.5}
```

Phần thân gồm `entity_id`, một `reason` tùy chọn và dữ liệu dịch vụ. Mỗi lệnh gọi một thực thể, không bao giờ là một danh sách, vì câu trả lời cho "đã gửi đi những gì" nên nói về một thực thể.

### Mỗi miền nhận gì

| Dịch vụ | Dữ liệu | Ghi |
|---|---|---|
| `switch.turn_on`, `switch.turn_off` | không có | `true` hoặc `false` vào Tag lệnh |
| `switch.toggle` | không có | ngược lại với trạng thái hiện tại, đọc từ bộ nhớ đệm trực tiếp theo cùng quy tắc như chính trạng thái. Nếu trạng thái là `unknown`, `unavailable` hoặc chất lượng xấu, lệnh gọi bị từ chối: đảo một thứ mà bạn không biết trạng thái là đoán xem nên đẩy nó về hướng nào. Hãy nói `turn_on` hoặc `turn_off` |
| `number.set_value` | `value`, một số | giá trị đó, vào Tag lệnh |
| `text.set_value` | `value`, một chuỗi | chuỗi đó, vào Tag lệnh |
| `select.select_option` | `option` | giá trị thô của tùy chọn, vào Tag lệnh |
| `button.press` | không có | `press_value`, rồi `pulse_ms` sau đó là `release_value`, vào Tag lệnh; nút `single_shot` ghi `press_value` một lần và không ghi gì sau đó |
| `motor.start`, `motor.stop` | không có | `true` hoặc `false` vào `run_command` |
| `motor.reset` | không có | một xung vào `reset_command`: `true`, rồi `pulse_ms` sau đó là `false` |
| `motor.set_speed` | `value`, một số | giá trị đó, vào `speed_command` |
| `valve.open`, `valve.close` | không có | `true` hoặc `false` vào `command`; với van điều tiết, 100 hoặc 0 vào `position_command` |
| `valve.stop` | không có | một xung vào `stop_command`; van `single_shot` ghi `true` một lần |
| `valve.set_position` | `position`, 0 đến 100 | vị trí đó, vào `position_command` |
| `loop.set_setpoint` | `value`, một số | giá trị đó, vào `setpoint` |
| `loop.set_mode` | `mode`: `auto`, `manual` hoặc `cascade` | giá trị thô của chế độ, vào `mode` |
| `loop.set_output` | `value`, một số | giá trị đó, vào `output`, **chỉ khi vòng điều khiển đang đọc là manual** |
| `counter.reset` | không có | 0 vào một `reset_command` kiểu số, hoặc một xung vào kiểu bool |
| `alarm.acknowledge` | `note`, tùy chọn | không có Tag: lệnh xác nhận của công cụ báo động |
| `alarm.shelve` | `minutes`, 1 đến 1440 | không có Tag: lệnh hoãn của công cụ báo động |
| `alarm.unshelve` | không có | không có Tag: lệnh bỏ hoãn của công cụ báo động, chỉ trên báo động đang hoãn |
| `script.turn_on` | các trường của script | tự nó không có Tag: chạy [script](/vi/iot/scripts/), mà các bước của nó ghi qua cổng dưới tên `script:<id>` |
| `script.turn_off` | không có | không có Tag: dừng mọi lần chạy của script |
| `scene.turn_on` | `params`, các tham số của công thức, và `version`, cả hai tùy chọn | tự nó không có Tag: áp dụng [công thức](/vi/iot/recipes/), mà các mục tiêu của nó ghi qua cổng dưới cùng một id lệnh gọi |
| `light.turn_on` | `brightness`, 0 đến 100, tùy chọn | `true` vào `command`, rồi độ sáng vào `brightness_command` |
| `light.turn_off` | không có | `false` vào `command` |
| `light.toggle` | không có | ngược lại với những gì phản hồi trạng thái của đèn cho biết; bị từ chối khi không đọc được |
| `cover.open`, `cover.close`, `cover.stop` | không có | `open`, `close` hoặc `stop` vào `command` |
| `cover.set_position` | `position`, 0 đến 100 | vị trí đó, vào `position_command` |
| `lock.lock`, `lock.unlock`, `lock.open` | không có | `lock`, `unlock` hoặc `open` vào `state` |
| `fan.turn_on` | `percentage`, `preset_mode`, cả hai tùy chọn | `true` vào `state`, rồi từng giá trị được cho |
| `fan.turn_off`, `fan.toggle` | không có | `false`, hoặc ngược lại với những gì phản hồi cho biết, vào `state` |
| `fan.set_percentage` | `percentage`, 0 đến 100 | vào `percentage` |
| `fan.set_preset_mode`, `fan.set_direction` | `preset_mode`, `direction` | vào `preset_mode`, `direction` |
| `fan.oscillate` | `oscillating`, true hoặc false | vào `oscillating` |
| `siren.turn_on`, `siren.turn_off`, `siren.toggle` | không có | như một công tắc, vào `state` |
| `notify.send_message` | `message` | thông điệp đó, vào `message` |

Một dịch vụ ghép có vai trò chưa được liên kết (`set_speed` trên một động cơ không có `speed_command`) bị từ chối, như một dịch vụ không xác định, trước khi có bất cứ thứ gì được lập kế hoạch.

`sensor` và `binary_sensor` chỉ đọc và không nhận dịch vụ nào. Dữ liệu dịch vụ có một trường mà dịch vụ không nhận sẽ bị từ chối, giống như một trường viết sai chính tả trong bất kỳ phần thân nào khác: một lệnh gọi lặng lẽ chạy tiếp mà thiếu trường bạn định dùng còn tệ hơn một lệnh gọi nói là không.

Một số là số nguyên sẽ đến Tag số nguyên dưới dạng số nguyên: `42.0` là `42`.

### Mọi lệnh gọi đều đi qua cổng ghi

Một lệnh gọi dịch vụ trở thành một danh sách có thứ tự các lần ghi, và mỗi lần ghi đều đi qua `runtime.Manager.Write`. Vì vậy mọi thứ cổng áp dụng cho một lần ghi vào Tag, nó cũng áp dụng cho một lệnh gọi dịch vụ, theo cùng thứ tự:

1. cho phép ghi đang bật (`safety.allowWrites`), và với một tác tử thì việc ghi của tác tử cũng phải bật;
2. Tag đã được kích hoạt (`writable`);
3. giá trị nằm trong dải của Tag, bị từ chối chứ không bao giờ bị cắt cho vừa;
4. rồi đến những gì chỉ thực thể biết, được kiểm tra bên trong cổng với thực thể và Tag đúng như lúc đó:
   - thực thể không bị tắt (ra lệnh cho thứ không có trạng thái là không được phép);
   - `min` và `max` riêng của một `number`, vốn chỉ có thể thu hẹp dải của Tag;
   - `step` của một `number`, tính từ giá trị nhỏ nhất của nó (của chính nó, nếu không thì giá trị nhỏ nhất trong dải của Tag, nếu không thì không). Một Tag số nguyên có step là 1 trừ khi thực thể nói khác, nên `1.5` gửi vào một thanh ghi lưu giữ bị từ chối thay vì để trình điều khiển lặng lẽ cắt thành `1`;
   - `max_length` của một `text` (tính theo ký tự, 255 khi không đặt) và `pattern` của nó, mà toàn bộ giá trị phải khớp;
   - một tùy chọn `select` hoặc một chế độ của vòng điều khiển không thuộc thực thể. Nó được gửi tới cổng đúng như tùy chọn hoặc chế độ được yêu cầu, và bị từ chối ở đó, nên ai thử các tùy chọn không tồn tại sẽ có trong hồ sơ;
   - một vị trí van ngoài khoảng 0 đến 100;
   - `set_output` của một vòng điều khiển trong khi Tag chế độ của nó, đọc từ bộ nhớ đệm trực tiếp ngay lúc đó, là bất cứ thứ gì ngoài manual (auto, cascade, một giá trị không phải chế độ nào, hoặc không đọc được).

Mọi lần từ chối, ở bất kỳ bước nào trong số đó, đều được **kiểm toán**: một dòng `write_audit` có thực thể, dịch vụ và id lệnh gọi, `succeeded` là false và lý do bắt đầu bằng `refused:`. Điều đó bao gồm cả người dùng không có `values.write`. API không chỉ trả lời 403 rồi quên. Nó gửi lệnh gọi tới cổng với dấu bị từ chối, cổng từ chối nó trước khi ghi bất cứ thứ gì, và lần từ chối nằm trong hồ sơ của thực thể cùng giá trị đã được yêu cầu.

Nó khớp với hình dạng của một lần ghi vào thiết bị chứ không phải một cái tên, nên một đường vòng qua một lớp bao mới hay một giao diện khai báo ngay tại chỗ cũng bị bắt.

### Một lệnh gọi trả lời gì

```json
{
  "call_id": "9f2c4e1a7b3d5c60",
  "entity_id": "switch.press_01_pump",
  "service": "switch.turn_on",
  "writes": [
    {"tag": "press-01/pump", "value": "true", "status": "written"}
  ]
}
```

Mỗi lần ghi có một trạng thái:

| Trạng thái | Ý nghĩa |
|---|---|
| `written` | thiết bị đã chấp nhận |
| `not_sent` | cổng đã chặn trước khi nó tới thiết bị: một lần từ chối, không có phiên, một dòng kiểm toán không mở được |
| `failed` | nó đã đi ra và thiết bị hoặc kết nối báo lỗi. Không biết nó đã có hiệu lực hay chưa |
| `skipped` | không bao giờ được thử, vì một lần ghi trước đó trong cùng lệnh gọi không thành công |

Một lệnh gọi lỗi trả lời bằng mã trạng thái của lỗi (403 bị từ chối theo chính sách hoặc quyền, 422 một giá trị bị từ chối, 409 một lệnh đảo khi không biết trạng thái hoặc thiết bị ở sai trạng thái cho dịch vụ, 503 thiết bị chưa kết nối, 502 thiết bị đã nhận lần ghi và báo lỗi, 404 không có thực thể như vậy, 400 một lệnh gọi sai dạng, 500 một lần nhấn mà lần nhả không thực hiện được, hoặc một lỗi bên trong Gateway, mà `error` chỉ là một tham chiếu tới nhật ký máy chủ) và cùng phần thân với `error` được thêm vào.

Các lần ghi của một lệnh gọi đi ra theo thứ tự, lần đầu tiên không thành công kết thúc lệnh gọi, và **không có gì đã ghi bị hoàn tác**. Hoàn tác tự nó là một lần ghi, thực hiện mà không ai yêu cầu, lên thiết bị đã chuyển động rồi. Quyết định điều đó là việc của người vận hành, và câu trả lời cho họ biết chính xác lệnh gọi đã dừng ở đâu. Mọi lần ghi của một lệnh gọi dùng chung `call_id` của nó, trong dấu vết kiểm toán và trong câu trả lời.

Có một ngoại lệ, và đó là lệnh tức thời: nhấn một nút, đặt lại động cơ, dừng van, đặt lại bộ đếm trên một bit. Đó là hai lần ghi, lần nhấn và lần nhả sau pulse_ms, và lần nhả không phải thứ có thể bỏ qua tùy tiện, vì bỏ nó sẽ để một nút bấm bị giữ xuống. Vì vậy:

- Lần nhả vẫn được gửi khi lần nhấn đã đi ra và báo lỗi (`failed`): nó có thể đã có hiệu lực. Nó chỉ bị bỏ qua khi lần nhấn là `not_sent`, vì khi đó không có gì bị giữ.
- Lần nhả vẫn được gửi kể cả khi bên gọi ngắt kết nối giữa xung. Lệnh gọi tiếp tục mà không có họ.
- Nếu lần nhấn đã được ghi mà lần nhả bị từ chối hoặc lỗi, lệnh gọi thất bại với 500 và nói rõ như vậy: Tag **có thể vẫn đang giữ giá trị nhấn**, hãy kiểm tra và nhả nó bằng tay. Việc lần nhả bị từ chối hoặc lỗi nằm trong dấu vết kiểm toán dưới cùng id lệnh gọi, và lệnh gọi được ghi dưới thực thể ở mức nghiêm trọng là lỗi, không phải cảnh báo.

Một xung dài `pulse_ms`, mặc định 500, tối đa 10.000. Lệnh gọi trả lời khi lần nhả xong, nên bên gọi chờ hết xung.

Mỗi lệnh gọi cũng là một dòng trong nhật ký hệ thống, dưới entity_id, danh mục `write`, kèm lý do và, trong chi tiết, id lệnh gọi, nguồn và mọi lần ghi cùng trạng thái của nó. Các lần ghi Tag riêng lẻ vẫn giữ dòng riêng của chúng dưới các Tag của chúng, như vẫn luôn thế.

`GET /api/writes?entity=switch.press_01_pump` là dấu vết kiểm toán của thực thể đó, gồm cả các lần từ chối, mới nhất trước. Các dòng có `entityId`, `service` và `callId`; một lần ghi thẳng vào Tag bỏ chúng đi, nên mọi bên đọc `/api/writes` hiện có thấy đúng những gì họ từng thấy. Migration `0007_service_audit.sql` thêm ba cột này, để trống cho mọi dòng hiện có.

### Hỏi trước: chạy thử

`POST /api/services/{domain}/{service}?dry_run=true` hỏi cổng nó sẽ làm gì với một lệnh gọi, và không làm gì cả. Cùng phần thân, cùng quyền.

```json
{"dry_run":true,"entity_id":"number.press_01_zone1_sp","service":"number.set_value","writes":[{"tag":"press-01/zone1_sp","value":"212.5","status":"would_write"}]}
```

```json
{"dry_run":true,"error":"press-01/zone1_sp: this tag is not marked writable","entity_id":"number.press_01_zone1_sp","service":"number.set_value","writes":[{"tag":"press-01/zone1_sp","value":"212.5","status":"not_sent","error":"press-01/zone1_sp: this tag is not marked writable"}]}
```

Lệnh gọi được lập kế hoạch đúng như lệnh gọi thật, và mọi lần ghi nó sẽ thực hiện được đưa qua chính các kiểm tra của cổng, theo cùng thứ tự, đối với các Tag, thực thể và thiết bị đúng như lúc này: cho phép ghi đang bật, công tắc tác tử, Tag đã kích hoạt, dải của nó, mọi thứ chỉ thực thể biết (step, pattern, vòng điều khiển ở manual, thực thể bị tắt) và một phiên tới thiết bị. Lần ghi đầu tiên sẽ bị từ chối là `not_sent` kèm lý do, phần còn lại là `skipped`, và `error` là lỗi mà lệnh gọi thật sẽ gặp, **từng chữ một**. Một lần ghi sẽ được gửi đi là `would_write`. Chỉ có một hàm trong cổng (`precheck`) trả lời cả hai, nên chạy thử không thể vượt qua những kiểm tra mà lần ghi thật không làm. Một thực thể `alarm` không ghi Tag nào, nên chạy thử của nó thực hiện các kiểm tra báo động thay vào đó (công cụ đang chạy, định nghĩa vẫn còn, thực thể đang bật, chỉ báo động đang hoãn mới được bỏ hoãn) và trả lời mà không có lần ghi nào; báo động không bị chạm tới và dấu vết báo động không nhận gì.

Đó là một câu hỏi, nên một phán quyết, bị từ chối hay không, đều trả lời 200. Một yêu cầu mà lệnh gọi thật sẽ chặn trước mọi kiểm tra (không có thực thể như vậy, một dịch vụ mà miền không nhận, dữ liệu không được chấp nhận, một lệnh đảo khi không biết trạng thái, sai miền trong đường dẫn) được trả lời bằng cùng trạng thái và lỗi mà lệnh gọi thật sẽ trả. Người dùng không có quyền nhận cùng 403.

Chạy thử không ghi gì, không mở dòng kiểm toán nào, không đưa gì vào nhật ký hệ thống và không tiêu một id lệnh gọi: không có gì được thử, nên không có gì phải giải trình.

Nó cho biết điều gì sẽ xảy ra **ngay lúc này**. Giữa chạy thử và lệnh gọi thật, thiết bị có thể rớt và ai đó có thể hủy kích hoạt Tag; lệnh gọi thật được kiểm tra lại đầy đủ vào đúng lúc ghi. Một trường hợp được trả lời chính xác hơn các kiểm tra của chính lệnh gọi thật: một thiết bị có phiên đã rớt trong lúc worker của nó kết nối lại. Lần ghi thật đi tới tận trình điều khiển và lỗi ở đó (`failed`, 503 và một dòng kiểm toán cho lần thử), còn chạy thử nói `not_sent` ngay từ đầu, với cùng lỗi.

Dấu nhắc lệnh trên màn hình Thực thể và trong ngăn bên của thực thể dùng nó: khi dấu nhắc mở ra và khi một giá trị được gõ, nó hỏi, và một lần từ chối hiện ngay trong dấu nhắc, bằng lời của cổng, trước khi ai nhấn xác nhận. Đó là lời khuyên chứ không phải khóa: xác nhận vẫn đi tới cổng, và cổng quyết định lại.

## Thiết bị ghép

Một Tag ứng với một thực thể. Một máy bơm không ứng với một Tag: nó có lệnh chạy, tiếp điểm đang chạy, lỗi, đặt lại và có thể có tốc độ, và người vận hành nghĩ về nó như một thứ duy nhất. Thực thể ghép là thứ duy nhất đó, được liên kết với từng Tag của nó theo một **vai trò** có tên.

Quản trị viên tạo nó bằng `POST /api/entities`:

```json
{
  "domain": "motor",
  "name": "Infeed pump",
  "device_class": "pump",
  "options": {"pulse_ms": 500},
  "bindings": [
    {"role": "running",       "device_id": "press-01", "tag_name": "P101_Running"},
    {"role": "run_command",   "device_id": "press-01", "tag_name": "P101_RunCmd"},
    {"role": "fault",         "device_id": "press-01", "tag_name": "P101_Fault"},
    {"role": "reset_command", "device_id": "press-01", "tag_name": "P101_Reset"}
  ]
}
```

`entity_id` là tùy chọn. Bỏ nó đi thì một ID được tạo từ tên (`motor.infeed_pump`, rồi `_2` và cứ thế). Cho nó thì nó được dùng đúng nguyên văn, và một ID đã có người dùng là 409, không phải một `_2` lặng lẽ: bạn đã yêu cầu đúng tên đó. `name`, `device_class`, `unit_of_measurement`, `icon`, `entity_category` và `options` là các trường sổ đăng ký giống mọi thực thể. Đặt nó lên cây thiết bị và gắn nhãn bằng `PUT` sau đó.

Việc tạo kiểm tra mọi thứ có thể với các Tag như lúc này, và từ chối (400, nói rõ phải sửa gì) bất cứ thứ gì chưa đúng:

- miền là một trong `select`, `button`, `motor`, `valve`, `loop`, `counter`, `weather` (`GET /api/entities/composites` cho biết là những miền nào, và các vai trò của từng miền). Các miền Tag được tạo cho bạn từ Tag, và `alarm` từ các định nghĩa báo động;
- mọi vai trò bắt buộc đều được liên kết, và không có vai trò nào mà miền không có;
- **mọi Tag được liên kết đều tồn tại**;
- **kiểu của mọi Tag khớp với vai trò của nó**: `running` của động cơ là bool, `position` của van là số, số đếm của bộ đếm là số nguyên;
- **mọi Tag mà một dịch vụ ghi vào đều đã được kích hoạt** (`writable`). Một thực thể ghép không bao giờ kích hoạt gì cả. Kích hoạt một điểm vẫn là quyết định mà ai đó đưa ra cho từng Tag, một lần một cái, như vẫn luôn thế;
- mọi giá trị thô trong các tùy chọn (giá trị của một tùy chọn select, các giá trị nhấn và nhả của nút, các chế độ của vòng điều khiển) là giá trị mà Tag của nó có thể nhận. `1.5` bị từ chối cho một thanh ghi số nguyên ngay bây giờ, không phải khi ai đó nhấn nút.

Một thực thể ghép đi cùng thiết bị của nó khi mọi Tag của nó nằm trên một thiết bị, và không thuộc thiết bị nào khi chúng trải trên nhiều thiết bị. Các liên kết của nó là cố định: một tập Tag khác là một thực thể khác, nên hãy xóa nó và tạo cái khác.

Mỗi lần tạo và xóa là một dòng trong nhật ký hệ thống dưới entity_id, danh mục `config`, kèm các liên kết.

### Vai trò

| Miền | Vai trò | Kiểu Tag | <span class="sr-only">Chi tiết</span> |
|---|---|---|---|
| `select` | `state` | any | bắt buộc. Phản hồi: đọc lại để tìm tùy chọn |
| | `command` | any | bắt buộc, đã kích hoạt. Ghi bằng giá trị thô của tùy chọn. Có thể là cùng Tag với `state` |
| `button` | `command` | any | bắt buộc, đã kích hoạt. Phát xung |
| `motor` | `running` | bool | bắt buộc. Phản hồi: tiếp điểm đang chạy |
| | `run_command` | bool | bắt buộc, đã kích hoạt. `start` ghi true, `stop` ghi false |
| | `fault` | bool | phản hồi |
| | `reset_command` | bool | đã kích hoạt. Được `reset` phát xung |
| | `speed` | number | phản hồi, thuộc tính `speed` |
| | `speed_command` | number | đã kích hoạt. Được `set_speed` ghi |
| `valve` | `state` | any | phản hồi: nơi một van tự báo cho biết nó đang ở đâu, bằng lời |
| | `opened`, `closed` | bool | phản hồi: các công tắc hành trình |
| | `position` | number | phản hồi, 0 đến 100 phần trăm |
| | `fault` | bool | phản hồi |
| | `command` | bool | đã kích hoạt. Một van đóng mở: `open` ghi true, `close` ghi false |
| | `position_command` | number | đã kích hoạt. Một van điều tiết: `set_position`, và `open`/`close` là 100/0 |
| | `stop_command` | bool | đã kích hoạt. Được `stop` phát xung |
| `loop` | `pv` | number | bắt buộc. Trạng thái |
| | `setpoint` | number | bắt buộc, đã kích hoạt. Đọc cho thuộc tính, được `set_setpoint` ghi |
| | `output` | number | bắt buộc, đã kích hoạt. Đọc cho thuộc tính, được `set_output` ghi |
| | `mode` | any | bắt buộc, đã kích hoạt. Đọc để biết chế độ, được `set_mode` ghi |
| `counter` | `state` | integer | bắt buộc. Số đếm |
| | `reset_command` | bool hoặc number | đã kích hoạt. Phát xung nếu là bool, ghi bằng 0 nếu là number (có thể chính là thanh ghi đếm) |
| `weather` | `temperature` | number | bắt buộc. Trạng thái |
| | `humidity`, `pressure`, `wind_speed`, `wind_gust`, `wind_bearing`, `rain_rate`, `rain_today`, `solar_radiation`, `uv_index` | number | phản hồi, mỗi cái là một thuộc tính. Không cái nào được kích hoạt: một trạm được đọc, không bao giờ được ra lệnh |

Một van cần ít nhất một trong `state`, `opened`, `closed` và `position` (phải có thứ gì đó cho biết nó đang ở đâu) và đúng một trong `command` và `position_command`. Cả hai cùng lúc sẽ là hai câu trả lời cho "nó đã được bảo đi tới đâu", và trạng thái giữa hai đầu hành trình phụ thuộc vào câu trả lời đó. Nếu PLC thật sự có cả hai, hãy tạo hai thực thể.

### Tùy chọn

| Tùy chọn | Miền | <span class="sr-only">Chi tiết</span> |
|---|---|---|
| `select_options` | `select` | bắt buộc: `[{"option": "low", "value": 1}, ...]`, theo thứ tự màn hình đưa ra. Tên là duy nhất, giá trị là duy nhất (hai tùy chọn cùng một giá trị sẽ khiến trạng thái thành đoán mò), mỗi giá trị là một số, một bool hoặc một chuỗi |
| `press_value`, `release_value` | `button` | cùng nhau hoặc không có cái nào. Bỏ đi trên một Tag bool thì chúng là `true` và `false`, được ghi vào các tùy chọn để việc nút làm được lưu lại. Mọi kiểu Tag khác cần cả hai |
| `pulse_ms` | `button`, `motor`, `valve`, `counter` | thời gian giữ một lệnh tức thời. 1 đến 10.000, 500 khi không đặt |
| `single_shot` | `button`, `valve` | `true` ghi `press_value` một lần và không bao giờ nhả: lần nhấn là toàn bộ lệnh. Một nút MQTT được phát hiện là loại này, vì "lần nhả" của nó sẽ là một lệnh thứ hai mà thiết bị không bao giờ yêu cầu. Nhận `press_value` và không nhận `release_value` hay `pulse_ms`. Trên một van, `stop` của nó ghi `true` một lần thay vì một xung: lệnh dừng của một van được phát hiện là một lệnh riêng |
| `event_types` | `event` | các kiểu sự kiện nó có thể phát, khi nó cho biết |
| `role_choices` | `lock`, `fan`, `siren`, `notify`, `update`, `device_tracker`, `climate`, `humidifier`, `water_heater` | các từ mà mỗi vai trò có thể ra lệnh đưa ra, theo vai trò, mỗi vai trò từ 1 đến 64 từ khác nhau: các chế độ của một bộ điều nhiệt. Phát hiện đặt nó từ cấu hình |
| `modes` | `loop` | bắt buộc: giá trị thô của Tag chế độ cho từng chế độ, tối thiểu `{"auto": 1, "manual": 0}`, thêm `cascade` nếu bộ điều khiển có |

### Trạng thái của thực thể ghép được quyết định thế nào

Trạng thái của một thực thể ghép đến từ **phản hồi** của nó. Nó không bao giờ được tính từ việc HotLoop đã gửi một lệnh. Một động cơ được bảo khởi động mà tiếp điểm đang chạy chưa đóng thì không đang chạy, nó đang khởi động, và nếu tiếp điểm không bao giờ đóng thì nó giữ trạng thái đang khởi động cho đến khi ai đó xem xét. Giá trị đọc lại của một Tag lệnh được tính là phản hồi: đó là PLC nói nó đang giữ gì, không phải HotLoop nhớ mình đã ghi gì.

Một thực thể ghép **không bao giờ lạc quan**. Một cảm biến đơn lẻ vẫn hiển thị giá trị tốt gần nhất qua một lần đọc xấu; thực thể ghép thì không. Mọi vai trò phản hồi quyết định trạng thái phải có một lần đọc tốt, nếu không thì:

| Điều kiện | `state` | `quality` |
|---|---|---|
| một Tag quyết định đã mất, hoặc thiết bị của nó ngừng hoạt động | `unavailable` | `bad` |
| một Tag quyết định chưa có lần đọc nào, hoặc có lần đọc xấu | `unknown` | `bad` |
| mọi Tag quyết định đều tốt, một trong số đó không chắc chắn hoặc nằm trên thiết bị suy giảm | trạng thái | `uncertain` |
| mọi Tag quyết định đều tốt | trạng thái | `good` |

Một động cơ có đầu vào lỗi ngừng trả lời là `unknown`, không phải `running` như nó đã là một giây trước. Vai trò nào quyết định nằm bên dưới; những vai trò còn lại chỉ điền thuộc tính, và một vai trò không đọc được thì đơn giản bị bỏ ra.

Thuộc tính `armed` của một thực thể ghép chỉ là true khi mọi Tag mà bất kỳ dịch vụ nào của nó ghi vào đều đang được kích hoạt ngay lúc này. Một động cơ có thể khởi động nhưng không thể dừng từ đây thì không phải thứ một màn hình nên đưa ra.

### `motor`

Các vai trò quyết định: `running`, và `fault` nếu được liên kết. Trạng thái, theo quy tắc khớp đầu tiên:

1. `fault` bật: **`fault`**, bất kể điều gì khác đúng. Chạy và lỗi cùng lúc là mâu thuẫn, và cái cần một con người là lỗi; thuộc tính `running` vẫn cho biết nó đang quay.
2. đang chạy, và giá trị đọc lại của lệnh chạy là tắt: **`stopping`**.
3. đang chạy: **`running`**.
4. không chạy, và giá trị đọc lại của lệnh chạy là bật: **`starting`**.
5. còn lại: **`stopped`**.

Nếu giá trị đọc lại của lệnh chạy không đọc được thì nó không quyết định gì: động cơ khi đó là `running` hoặc `stopped` chỉ theo tiếp điểm của nó. HotLoop không đặt thời gian chờ cho một lần khởi động không thành: đó là lỗi không khởi động được, và nó thuộc về PLC hoặc một định nghĩa báo động trên tiếp điểm đang chạy.

Thuộc tính: `running`, `fault` (nếu được liên kết), `command` (giá trị đọc lại), `speed` (nếu được liên kết và đọc được), `device_class` (`pump`, `fan`, `conveyor`, `compressor`, `agitator`).

### `valve`

Một van tự báo (phát hiện MQTT) cho biết nó ở đâu bằng lời trên vai trò `state` của nó: `open`, `closed`, `opening`, `closing` hoặc `stopped`, và đó là trạng thái của nó, với `current_position` lấy từ `position` khi nó có báo. Một từ không phải bất kỳ từ nào trong số đó là `unknown`, với những gì nó nói trong `raw_value`. Phần còn lại của mục này là về một van được xây từ các Tag PLC.

Các vai trò quyết định: mọi vai trò đã được liên kết trong `opened`, `closed`, `position`, `fault`. Trạng thái, theo quy tắc khớp đầu tiên:

1. `fault` bật: **`fault`**.
2. cả hai công tắc hành trình đều đóng: **`fault`**, kèm `limit_conflict: true`. Một van không thể vừa mở vừa đóng, nên một công tắc đang nói dối, và đó là cái nào thì không phải thứ để đoán.
3. công tắc hành trình mở đóng: **`open`**. Công tắc hành trình đóng đóng: **`closed`**.
4. không có công tắc hành trình, chỉ có vị trí: từ 1% trở xuống là **`closed`**, từ 99% trở lên là **`open`**.
5. giữa hai đầu, đang di chuyển hoặc dừng theo lệnh nó được giao: một lệnh vị trí đọc lại cao hơn vị trí hơn 1% là **`opening`**, thấp hơn hơn 1% là **`closing`**, trong phạm vi 1% là **`stopped`**; một lệnh đóng mở đọc lại là bật thì **`opening`**, tắt thì **`closing`**; không có gì để dựa vào thì **`stopped`**.

Một van đóng mở dừng giữa hai đầu hành trình trong khi vẫn đang được lệnh mở sẽ đọc là `opening`. Nếu bạn cần thấy nó đang dừng ở đó, hãy liên kết `position`.

`current_position` là phản hồi vị trí khi được liên kết, nếu không thì 100 ở công tắc mở và 0 ở công tắc đóng, và không có ở giữa. Các thuộc tính khác: `open_limit`, `closed_limit`, `fault`, `device_class` (`water`, `gas`, `steam`, `air`).

### `loop`

Trạng thái là biến quá trình, hiển thị như của một cảm biến, chỉ từ `pv`. Các thuộc tính là `setpoint` và `output` (có khi đọc được), `mode` (tên của chế độ mà Tag chế độ đang đọc, hoặc `unknown` khi không đọc được hay chứa một giá trị không phải chế độ nào), `modes` (các tên đã cấu hình) và `unit_of_measurement` (của thực thể, nếu không thì của Tag PV). Một vòng điều khiển nhận các lớp thiết bị của cảm biến: một vòng nhiệt độ, một vòng áp suất.

`set_output` bị từ chối bên trong cổng trừ khi vòng điều khiển đọc là manual **vào lúc ghi**. Một đầu ra ghi vào vòng điều khiển ở auto là đấu với bộ điều khiển, và ở cascade là đấu với hai bộ. Một chế độ không đọc được thì không phải manual. Lần từ chối là một dòng `write_audit` như mọi dòng khác, với thực thể, dịch vụ, id lệnh gọi và giá trị đã được yêu cầu, và lệnh gọi trả lời 409. Hãy đưa vòng điều khiển về manual bằng `set_mode` trước.

### `counter`

Trạng thái là số đếm, một Tag số nguyên. `reset` ghi 0 vào một `reset_command` kiểu số (hãy liên kết chính thanh ghi đếm nếu PLC đặt lại theo cách đó) hoặc phát xung vào một cái kiểu bool. Một bộ đếm không có `reset_command` là chỉ đọc. `unit_of_measurement` là của thực thể, nếu không thì của Tag.

### `weather`

Một trạm trên mái nhà như một thực thể: xem [Thời tiết](/vi/iot/weather/). Trạng thái là nhiệt độ; mọi số đọc khác là một thuộc tính, chỉ có khi cảm biến của nó đọc được, cùng điểm sương, chỉ số nóng và độ lạnh do gió được tính từ chúng. Một số đọc đã liên kết mà không đọc được được nêu tên trong `unavailable`, không bao giờ hiển thị là không. Nó không nhận dịch vụ nào.

### `select`

Trạng thái là tùy chọn có giá trị thô mà Tag `state` đang đọc. Một giá trị không thuộc tùy chọn nào là `unknown`, với giá trị thô trong `raw_value`, thay vì tùy chọn gần nhất hay tùy chọn cuối cùng. Thuộc tính `options` liệt kê các tên tùy chọn theo thứ tự. Một tùy chọn không thuộc select bị từ chối ở cổng và được kiểm toán cùng tùy chọn đã được yêu cầu.

### `button`

Một nút bấm không có phản hồi. Trạng thái của nó là thời điểm nhấn gần nhất qua Gateway này, hoặc `unknown` nếu nó chưa được nhấn từ khi Gateway khởi động. Nó là `unavailable` khi Tag lệnh của nó đã mất hoặc thiết bị của nó ngừng hoạt động, vì khi đó nhấn nó không thể có tác dụng. Lần nhấn gần nhất được giữ trong bộ nhớ, nên nó được đặt lại khi khởi động lại; dấu vết kiểm toán có mọi lần nhấn bất kể thế nào, đó cũng là lý do sổ nhật ký không ghi trạng thái của một nút bấm.

## Đèn, cửa che và sự kiện

Được tạo bởi [phát hiện MQTT](/vi/iot/mqtt-discovery/) cho một thiết bị đã tự báo, liên kết với các Tag mà phát hiện đã tạo cho nó. Không ai xây những thứ này từ Tag PLC, nên `POST /api/entities` không nhận chúng. Cùng quy tắc như mọi thực thể ghép: trạng thái là điều phản hồi cho biết, không bao giờ là điều HotLoop gửi lần cuối, và mọi dịch vụ là các lần ghi qua cổng, từng Tag do một người kích hoạt trước.

| Miền | Vai trò | Kiểu Tag | <span class="sr-only">Chi tiết</span> |
|---|---|---|---|
| `light` | `state` | bool | phản hồi: bật hoặc tắt |
| | `command` | bool | đã kích hoạt. `turn_on` ghi true, `turn_off` ghi false. Cùng Tag với `state` |
| | `brightness` | number | phản hồi, 0 đến 100 phần trăm, thuộc tính `brightness` |
| | `brightness_command` | number | đã kích hoạt. `turn_on` kèm một `brightness`. Cùng Tag với `brightness` |
| `cover` | `state` | any | phản hồi: `open`, `closed`, `opening`, `closing` hoặc `stopped` |
| | `command` | any | đã kích hoạt. `open`, `close` hoặc `stop`. Cùng Tag với `state` |
| | `position` | number | phản hồi, 0 (đóng) đến 100 (mở), `current_position` |
| | `position_command` | number | đã kích hoạt. `set_position`. Cùng Tag với `position` |
| `event` | `state` | any | kiểu sự kiện nó phát gần nhất |
| `lock` | `state` | any | đọc và ghi: `locked`, `unlocked`, `locking`, `unlocking`, `jammed`, `open`, `opening`; nhận `lock`, `unlock`, `open` |
| `fan` | `state` | bool | đọc và ghi: bật hoặc tắt |
| | `percentage` | number | đọc và ghi, 0 đến 100 |
| | `preset_mode`, `direction` | any | đọc và ghi |
| | `oscillating` | bool | đọc và ghi |
| `siren` | `state` | bool | đọc và ghi: bật hoặc tắt |
| `notify` | `message` | any | ghi: thông điệp. Không có gì để đọc |
| `update` | `installed_version`, `latest_version` | any | đọc |
| `device_tracker` | `state` | any | đọc: `home`, `not_home`, hoặc vùng mà nó nêu tên |
| `climate` | `mode` | any | đọc và ghi: trạng thái. `set_hvac_mode` kèm `hvac_mode` |
| | `temperature`, `target_temp_low`, `target_temp_high` | number | đọc và ghi. `set_temperature` kèm bất kỳ cái nào trong số đó |
| | `target_humidity` | number | đọc và ghi. `set_humidity` kèm `humidity` |
| | `fan_mode`, `swing_mode`, `swing_horizontal_mode`, `preset_mode` | any | đọc và ghi, mỗi cái qua dịch vụ `set_` riêng của nó |
| | `current_temperature`, `current_humidity`, `action` | number, number, any | đọc |
| | `power` | bool | ghi: `turn_on` true, `turn_off` false. Không có gì để đọc |
| `humidifier` | `state` | bool | đọc và ghi: bật hoặc tắt |
| | `target_humidity` | number | đọc và ghi. `set_humidity` kèm `humidity` |
| | `mode` | any | đọc và ghi. `set_mode` kèm `mode` |
| | `current_humidity`, `action` | number, any | đọc |
| `water_heater` | `mode` | any | đọc và ghi: trạng thái. `set_operation_mode` kèm `operation_mode` |
| | `temperature` | number | đọc và ghi. `set_temperature` |
| | `current_temperature` | number | đọc |
| | `power` | bool | ghi: `turn_on`, `turn_off` |
| `alarm_control_panel` | `state` | any | đọc: `disarmed`, `armed_home`, `armed_away`, `armed_night`, `armed_vacation`, `armed_custom_bypass`, `pending`, `triggered`, `arming`, `disarming`; ghi bằng `alarm_arm_home`, `alarm_arm_away`, `alarm_arm_night`, `alarm_arm_vacation`, `alarm_arm_custom_bypass`, `alarm_disarm`, `alarm_trigger` |
| `vacuum` | `state` | any | đọc: `cleaning`, `docked`, `paused`, `idle`, `returning`, `error`; ghi bằng `start`, `pause`, `stop`, `return_to_base`, `clean_spot`, `locate` |
| | `battery_level` | number | đọc |
| | `fan_speed` | any | đọc và ghi. `set_fan_speed` kèm `fan_speed` |
| `lawn_mower` | `activity` | any | đọc: `mowing`, `paused`, `docked`, `error`, `returning` |
| `camera` | `image` | any | đọc: một mã băm của ảnh mới nhất. Trạng thái là lúc nó đổi; `entity_picture` là nơi lấy nó |
| `image` | `image` hoặc `url` | any | đọc: một ảnh được giữ như với camera, hoặc một liên kết (`url`, chỉ http hoặc https, không bao giờ được tải) |
| | `start_mowing`, `pause`, `dock` | bool | ghi: mỗi cái một lần nhấn, bằng dịch vụ cùng tên |

Trạng thái là số đọc của vai trò state (bật hoặc tắt cho một bool), `unknown` khi không đọc được, và mọi vai trò khác đọc được là một thuộc tính dưới tên riêng của nó: `percentage`, `preset_mode`, `oscillating` và `direction` của một cái quạt. `toggle` dựa theo phản hồi và bị từ chối khi không có. Một thiết bị thông báo không có gì để đọc: trạng thái của nó là `unknown` với `feedback: none`. Một bản cập nhật là `on` khi thứ đã cài không phải bản mới nhất, và không nhận dịch vụ nào: HotLoop không bao giờ cài firmware, vì một lần nạp lỗi là một sự cố ngừng máy. Một cảnh được phát hiện là một nút bấm single-shot, lần nhấn của nó là payload của cảnh.

Những gì có thể gửi cho một thiết bị nằm trong thuộc tính của nó, theo cấu hình của nó: `hvac_modes`, `fan_modes`, `preset_modes` và `swing_modes` của một bộ điều nhiệt, `available_modes` của một máy tạo ẩm, `operation_list` của một bình nước nóng, `preset_modes` của một quạt, `fan_speed_list` của một robot hút bụi (từ tùy chọn `role_choices` của thực thể, mà phát hiện giữ đồng bộ với cấu hình), và `min_temp`/`max_temp` cùng `min_humidity`/`max_humidity` của giá trị đặt (từ dải của Tag). Đó là những gì màn hình đưa ra. Chúng không phải thứ làm nên quy tắc: cổng giữ giá trị đặt trong dải của Tag và trình điều khiển từ chối một từ mà cấu hình không liệt kê, bất kể một thuộc tính nói gì. `set_temperature` mà không có khóa nào trong ba khóa của nó bị từ chối, không phải một lệnh gọi chẳng làm gì. `turn_on` trên một bộ điều nhiệt không có topic nguồn cũng bị từ chối, thay vì đoán xem "bật" nghĩa là chế độ nào.

### `light`

Bật hoặc tắt theo phản hồi `state` của nó; `unknown` khi không đọc được, và khi không có topic trạng thái nào thì `unknown` mãi mãi với `feedback: none`. Độ sáng là một thuộc tính, và `color_mode`, `color`, `color_temp` và `effect` của một đèn theo lược đồ JSON cũng là thuộc tính: hiển thị chứ không ra lệnh. `toggle` dựa theo phản hồi và bị từ chối khi không có phản hồi nào để dựa vào.

### `cover`

Phản hồi `state` của nó khi có. Chỉ với một vị trí: từ 1% trở xuống là `closed`, cao hơn thế là `open`. Một từ không thuộc năm giá trị đó là `unknown`, kèm `raw_value`. `current_position` là vị trí khi có.

### `event`

Trạng thái của một sự kiện là **lúc** nó phát gần nhất (RFC 3339), và `event_type` là nó là gì; `event_types` liệt kê những gì nó có thể phát. `unknown` cho đến khi nó phát kể từ lúc HotLoop bắt đầu đọc nó. Nó không nhận dịch vụ nào: không có gì ra lệnh cho một sự kiện. Hai sự kiện trong một lần thăm dò hiện ra là sự kiện sau; sổ nhật ký và lịch sử có từng số đọc đúng như lúc nó đến.

## Thực thể báo động

Mọi định nghĩa báo động là một thực thể: `alarm.<definition id>` (được chuyển thành slug giống cách của một Tag, nên `oven-temp-hi` là `alarm.oven_temp_hi`), nền tảng `alarm`, `unique_id` là `alarm:<definition id>`, đặt tên theo định nghĩa. Nó không có liên kết và không có thiết bị: trạng thái của nó là của công cụ báo động chứ không phải của một Tag, và một định nghĩa không thuộc về thiết bị của nó như một Tag (xóa một thiết bị vẫn để lại các định nghĩa báo động của nó). Tag mà nó theo dõi là thuộc tính `source` của nó.

Trạng thái là trạng thái ISA-18.2 mà công cụ báo động đang giữ, viết theo cách một trạng thái thực thể được viết:

| Công cụ báo động | Trạng thái thực thể | <span class="sr-only">Chi tiết</span> |
|---|---|---|
| `normal` | `normal` | điều kiện đã hết, không còn gì tồn đọng |
| `unack-active` | `active_unack` | điều kiện đúng, chưa ai xác nhận |
| `ack-active` | `active_ack` | điều kiện đúng, đã xác nhận |
| `rtn-unack` | `rtn_unack` | đã hết trước khi ai đó xác nhận |
| `shelved` | `shelved` | được người vận hành làm im, trong một thời gian có giới hạn |
| `suppressed` | `suppressed` | được làm im theo thiết kế |

Chất lượng là `good`: trạng thái của công cụ không phải một số đọc. Thực thể là `unavailable` khi nó mồ côi hoặc Gateway không có công cụ báo động. Nó theo từng chuyển đổi ngay khi xảy ra, kể cả các lần xác nhận.

Thuộc tính: `definition_id`, `source`, `condition`, `limit`, `priority` (1 đến 4), `priority_label`, `enabled`, `message`, `count`, `active`, `needs_ack`, `trip_value`, `raised_at`, `cleared_at`, `acked_at`, `acked_by`, `shelved_until`, `shelved_by`, những cái cuối có khi áp dụng được.

Các dịch vụ của nó, `acknowledge`, `shelve` và `unshelve`, không ghi Tag nào, nên không đi qua cổng ghi. Chúng gọi `Ack`, `Shelve` và `Unshelve` riêng của công cụ báo động, đúng những hàm mà màn hình báo động và `POST /api/alarms/{id}/ack` gọi, nên chúng vào dấu vết báo động (`alarm_events`) và nhật ký hệ thống y như các hàm đó. Chúng cần **`alarms.ack`**, không phải `values.write`: người vận hành xác nhận báo động, người xem thì không. Một lệnh gọi bị từ chối trả lời 403 và được ghi dưới thực thể kèm người đã thử. Lệnh gọi cũng là một dòng trong nhật ký hệ thống dưới thực thể, kèm lý do.

`unshelve` bị từ chối (409) trên một báo động không đang hoãn. Công cụ báo động cũng từ chối nó, và đưa một báo động đang hoãn về trạng thái mà điều kiện của nó thực sự đang ở, chứ không mù quáng về normal. Một dịch vụ mà báo động không nhận (`turn_on`) bị từ chối như một dịch vụ không xác định (400) trước khi nó đến gần công cụ.

### Các nền tảng có nhà cung cấp

Thực thể báo động là nền tảng **nhà cung cấp** đầu tiên: các thực thể mà nguồn sự thật nằm ở nơi khác ngoài một Tag. Một nhà cung cấp cho biết nền tảng của nó hiện có những thực thể nào, tạo trạng thái của chúng, chạy các dịch vụ của chúng và trả lời các lần chạy thử của chúng; sổ đăng ký suy ra, làm mồ côi và nhận lại các thực thể của nó theo `unique_id` y như với một Tag, công cụ trạng thái tính lại chúng theo các sự kiện riêng của nhà cung cấp và theo nhịp mỗi giây một lần, và một lệnh gọi dịch vụ trên một thực thể như vậy đi tới nhà cung cấp thay vì được lập kế hoạch thành các lần ghi Tag. Một nhà cung cấp mà ghi một Tag vẫn ghi nó qua cổng.

Helper là nền tảng thứ hai: `input_boolean`, `input_number`, `input_select`, `input_text`, `input_counter`, `timer` và `schedule`, các giá trị do những người trong nhà máy sở hữu chứ không phải một PLC, do HotLoop lưu giữ và đặt bằng `helpers.write`. Chúng không ghi Tag nào. Xem [Helper](/vi/iot/helpers/).

Script là nền tảng thứ ba: mỗi script là một thực thể `script`, `script.<id>`, bật khi một lần chạy của nó đang diễn ra ở bất kỳ tiến trình nào và tắt khi không có lần nào. `turn_on` chạy nó với dữ liệu dịch vụ làm các trường của nó, `turn_off` dừng nó, cả hai cần `scripts.run`. Xóa một script làm thực thể của nó mồ côi, như xóa một định nghĩa báo động. Xem [Script](/vi/iot/scripts/).

Công thức là nền tảng thứ tư: mỗi công thức là một thực thể `scene`, `scene.<id>`, mà trạng thái là lúc nó ghi vào nhà máy gần nhất và các thuộc tính cho biết lần áp dụng mới nhất của nó đã diễn ra thế nào. `turn_on` áp dụng nó, với `recipes.apply` và quyền riêng của công thức khi nó nêu một quyền. Xóa một công thức làm thực thể của nó mồ côi. Xem [Công thức](/vi/iot/recipes/).

Mặt trời là nền tảng thứ năm: `binary_sensor.sun_up`, `sensor.sun_elevation` và `sensor.sun_azimuth`, được tính mỗi giây từ vĩ độ và kinh độ của địa điểm, ngay trên thiết bị. Chúng chỉ đọc và không nhận dịch vụ nào. Một địa điểm không có vị trí thì không có chúng, và những cái còn sót lại từ lúc nó có vị trí đọc là unavailable và cho biết phải đặt các biến nào. Xem [mặt trời](/vi/iot/sun/).

## Thực thể ở mọi nơi khác

### Luồng trực tiếp

`GET /api/stream` mang một sự kiện `entities` bên cạnh `values`. Nó được gộp theo cùng cách, tối đa bốn lần một giây, trạng thái mới nhất của mỗi thực thể:

```
event: entities
data: {"changed":[{"entity_id":"sensor.press_01_zone1_temp","state":"212.5",...}],"removed":[]}
```

`changed` là trạng thái đầy đủ của mọi thực thể đã thay đổi kể từ sự kiện trước, cùng dạng với `GET /api/states/{entity_id}`. `removed` là các entity_id không còn trạng thái nào nữa: bị tắt, bị xóa cùng thiết bị của chúng, hoặc bị đổi tên đi (tên mới đến trong `changed`). Sự kiện `entities` đầu tiên trên một kết nối mới mang mọi trạng thái, như `snapshot` mang mọi số đọc, để màn hình có dữ liệu trước khi có gì thay đổi. Các sự kiện `values`, `snapshot`, `alarm` và `device` đúng như trước đây.

### MCP

Các tác tử có `list_entities`, `get_states` và `call_service`. `call_service` chạy qua cùng bộ chạy dịch vụ như `POST /api/services/...`, nên lệnh gọi của một tác tử bị công tắc MCP chặn như `write_tag` và được kiểm toán lên thực thể với nguồn `mcp`. Xem [MCP](/vi/iot/mcp/#thực-thể).

### Tự động hóa

Một trigger `state` kích hoạt một quy tắc khi trạng thái của một thực thể thay đổi, các điều kiện có thể đọc `states`, `attrs` và `qualities` của thực thể, và một hành động `call_service` ra lệnh cho một thực thể qua cổng, được kiểm toán là `automation:<rule-id>`. Xem [Tự động hóa](/vi/iot/automations/#trình-kích-hoạt-trạng-thái-theo-dõi-thực-thể).

Cả hai đều theo móc `OnStateChanged` của công cụ, đó là lý do các quy tắc trong [Công cụ chạy thế nào](#công-cụ-chạy-thế-nào) quan trọng: một trigger state thấy mọi thay đổi mà công cụ tính ra, một lần, theo thứ tự, và không thấy gì mà công cụ chưa từng thấy.

## Màn hình

**Thực thể** liệt kê mọi thực thể dưới vị trí của nó trên cây thiết bị (vị trí riêng của nó, nếu không thì của thiết bị), với cây ở bên cạnh, và lọc theo vị trí, miền, nhãn, văn bản và chất lượng. Bên trong một vị trí, thiết bị đứng trước (báo động, động cơ, van, vòng điều khiển, select, nút bấm, bộ đếm), rồi đến những gì có thể ra lệnh, rồi đến các số đọc thô.

Theo mặc định màn hình hiện mỗi tín hiệu một lần. Mô hình thực thể có chủ ý cho một điểm vài thực thể, và mỗi cái giữ ID của nó, nhưng vẽ thành các ô thì đó là cùng một tín hiệu hai hay ba lần: một Tag đã kích hoạt là một cảm biến và một công tắc, và một Tag đã liên kết vào một động cơ vẫn là cảm biến riêng của nó. Trên một dây chuyền thật, điều đó làm số ô tăng gần gấp đôi và chôn vùi thiết bị. Vì vậy màn hình gộp:

- Thực thể đọc của một Tag nằm sau thực thể điều khiển của nó. Công tắc hoặc số là cái ô, vì nó đã hiện trạng thái trực tiếp, và ngăn bên của nó ghi "cũng có dạng cảm biến" kèm entity_id của cảm biến, cho ai đang nối một tự động hóa hay một tác tử vào nó.
- Một Tag đã liên kết vào một thực thể ghép nằm bên trong thực thể ghép, cả hai thực thể của nó. Ngăn bên của thực thể ghép liệt kê các tín hiệu của nó: các vai trò, Tag, thứ nó đang đọc, và các entity_id đọc và điều khiển của nó. Một Tag nằm trong hai thực thể ghép thì vào cái đầu tiên theo tên.
- Chỉ một thực thể điều khiển hoặc thực thể ghép không bị ẩn cũng không bị tắt mới gom thứ khác vào. Ẩn hoặc tắt công tắc đi thì cảm biến của nó lấy lại ô của mình.
- Một báo động trên một tín hiệu đã gộp đánh dấu cái ô nó được gộp vào, kèm tên của báo động, và mở báo động từ đó. Gộp làm màn hình gọn hơn; nó không bao giờ giấu một báo động.
- Con số cạnh thanh chất lượng ghi "đang hiển thị 13 · 25 đã gộp", và một ô chứa các ô khác ghi vậy ở chân của nó ("5 tín hiệu", "+ cảm biến"). Các chip miền, số đếm của cây và thanh chất lượng đếm các ô đang hiển thị.
- Tìm kiếm và bộ lọc nhãn nhìn vào bên trong các ô. Tìm một entity_id hoặc một Tag đã bị gộp và bạn nhận được ô chứa nó, được viền ra, với "Có trong này:" và entity_id. Chúng tôi chọn cách đó thay vì chuyển cả màn hình sang mọi thực thể: bạn đến đúng máy bơm đang tìm, không phải một bức tường các ô.

"Hiện mọi thực thể" tắt việc gộp và cho mỗi thực thể một ô riêng, dành cho kỹ sư muốn xem sổ đăng ký thô. Mặc định nó tắt và trình duyệt này ghi nhớ (bộ nhớ cục bộ; cửa sổ riêng tư sẽ quên). Màn hình của người khác không thay đổi.

Các trạng thái đến qua sự kiện `entities` của luồng trực tiếp; màn hình không bao giờ thăm dò chúng. Một ô được vẽ lại khi trạng thái của nó đổi, và được vẽ lại cả khi một nút trong đó đang có tiêu điểm, vì một ô giữ trạng thái cũ vì lý do đó sẽ cho thấy quá khứ như hiện tại. Chất lượng được vẽ trước giá trị:

| Chất lượng | Trên màn hình |
|---|---|
| tốt | giá trị, không đánh dấu |
| không chắc chắn | giá trị, một viền màu hổ phách và huy hiệu "không chắc chắn" |
| xấu | giá trị tốt gần nhất, làm xám trên nền gạch chéo, "xấu", và "giá trị tốt gần nhất, hiện đọc xấu", kèm lý do phía sau khi trình điều khiển có cho |
| chưa có số đọc | "Không rõ", chữ nghiêng, và "đọc xấu" kèm lý do khi có |
| không khả dụng | "Không khả dụng", cả ô được gạch chéo |

Các điều khiển theo miền và vai trò. Người xem không thấy cái nào. Người vận hành thấy những cái nằm sau `values.write` (và của một báo động sau `alarms.ack`), bị vô hiệu hóa kèm lý do khi việc ghi đang tắt trên bản triển khai này hoặc một Tag mà thực thể ghi vào chưa được kích hoạt. Đầu ra của một vòng điều khiển chỉ được đưa ra khi nó đọc là manual, vì đó là lúc duy nhất cổng cho phép. Mọi lệnh mở một dấu nhắc cho biết dịch vụ nào, các Tag nào và thực thể đang đọc gì, và nhận một lý do cho dấu vết kiểm toán. Một lần từ chối giữ dấu nhắc mở, kèm lời của cổng và mọi lần ghi đã hoặc chưa đi ra. Trạng thái mới không bao giờ được giả định từ lệnh: nó quay lại trên luồng khi thiết bị đọc lại, hoặc không quay lại.

Ngăn bên có trạng thái và các dấu thời gian của nó, các điều khiển, lịch sử một giờ, sáu giờ hoặc một ngày của Tag đã liên kết (một đường bậc thang, giá trị cuối được kéo dài đến hiện tại, các số đọc xấu được đánh dấu), các thực thể khác của cùng tín hiệu, các liên kết (với thực thể ghép là các tín hiệu của nó), các thuộc tính, và mọi lệnh đã được đưa ra hoặc bị từ chối qua thực thể. Quản trị viên còn có entity_id, tên, vị trí trên cây, các nhãn, ẩn và tắt, và nút xóa cho một thực thể ghép hoặc một thực thể mồ côi.

**Thiết bị mới** (quản trị viên) tạo một thực thể ghép: chọn miền, đặt tên, và chọn một Tag cho từng vai trò. Mỗi vai trò chỉ được đưa ra những Tag có kiểu phù hợp, và một vai trò lệnh hiện các Tag chưa được kích hoạt ở dạng bị vô hiệu hóa thay vì giấu chúng. Những gì bắt buộc được đánh dấu nhưng biểu mẫu không ép buộc: sổ đăng ký quyết định, và lời từ chối của nó được hiện đúng như nó viết.

**Nhà máy** là cây thiết bị và các nhãn. Xem [Cây thiết bị và nhãn](/vi/iot/equipment/).

## Sao lưu và khôi phục

`entities` và `entity_bindings` nằm trong bản sao lưu, cả entity_id lẫn các tùy chỉnh. Điều đó bao gồm các thực thể ghép, mọi vai trò và mọi tùy chọn, vốn quan trọng với chúng hơn bất cứ thứ gì: thực thể của một Tag có thể được dựng lại từ Tag của nó, nhưng không gì dựng lại được một thực thể ghép ngoài bản sao lưu. Thực thể báo động quay lại cùng các định nghĩa của chúng, và một định nghĩa đã khôi phục mà chưa có thực thể sẽ nhận một cái ở lần đồng bộ đầu tiên. Bản sao lưu được tạo trước phiên bản này không có bảng nào trong hai bảng đó; hãy khôi phục nó, khởi động Gateway, và lần đồng bộ đầu tiên của sổ đăng ký sẽ cho mọi Tag đã khôi phục thực thể của nó. `entity_labels` cũng nằm trong bản sao lưu, và việc khôi phục một bản sao lưu từ trước khi có cây thiết bị được nêu trong [Cây thiết bị và nhãn](/vi/iot/equipment/).

Migration 0007 thêm ba cột vào `write_audit`. Bản sao lưu được tạo trước nó vẫn khôi phục được: việc khôi phục nạp một tệp có ít cột hơn bảng hiện nay vào các cột đầu và để các cột mới nhận giá trị mặc định, vì một migration thêm cột luôn thêm nó vào cuối. Bản sao lưu từ một phiên bản mới hơn vẫn bị từ chối. Xem [Sao lưu và khôi phục](/vi/iot/backup/).

## Những gì chưa có

Lõi, cây thiết bị, ra lệnh cho thực thể qua cổng ghi, thiết bị ghép, thực thể báo động, thực thể trong MCP, tự động hóa và luồng trực tiếp, cùng các màn hình, đều đã có ở đây. Xem [Lộ trình HotLoop](/vi/roadmap/). `forSec` của một trigger state ("bật trong năm phút") nằm trong [Tự động hóa](/vi/iot/automations/#giữ-một-trạng-thái-forsec).
