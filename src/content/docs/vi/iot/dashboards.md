---
title: "Bảng điều khiển theo vai trò và màn hình"
description: "Các trang thẻ dựng theo vai trò hoặc màn hình: đồng hồ, xu hướng, danh sách thực thể và nút bấm, bố cục như nhau trên PC bảng điều khiển, laptop và điện thoại."
---

Bảng điều khiển (dashboard) là một trang thẻ do ai đó dựng nên. Đồng hồ đo, xu hướng, danh sách thực thể, một nút khởi động máy bơm, một sơ đồ mặt bằng với nhiệt độ đặt đúng chỗ các khu vực. Nhà máy cần bao nhiêu thì dựng bấy nhiêu, giao mỗi bảng cho các vai trò cần nó hoặc cho đúng một màn hình nơi nó nằm, và Board cũ chỉ là một trong số đó.

Có trong HotLoop IoT, Edge và Gateway. Edge Relay không có giao diện và không có bảng điều khiển. Edge HMI được dựng hoàn toàn từ trang này, và đó là lý do phần còn lại có hình dạng như bây giờ.

## Vì sao được dựng như vậy

**Một thẻ không ra lệnh gì cả.** Câu hỏi thiết kế đầu tiên với mọi trang nút bấm là trang đó có phải một cách thứ hai để vận hành nhà máy hay không. Không phải. Một thẻ gọi tên một tag, một thực thể, một script hoặc một công thức, và trình duyệt làm với chúng đúng như mọi màn hình khác. Nút ghi gửi `POST /api/write`. Các điều khiển của một thực thể gọi `POST /api/services`. Nút script mở hộp xác nhận chạy của màn hình Script, còn thẻ công thức mở ngăn áp dụng của màn hình Công thức. Mỗi thứ đều có quyền riêng và đều đi qua cổng kiểm soát ghi, nên bảng điều khiển cũng không thể là đường vòng. Điều `dashboards.write` bảo vệ là ai quyết định các nút làm gì, đó là quyết định của kỹ sư và chỉ quản trị viên mới có, vì cùng lý do với việc viết script.

Hệ quả: một bảng điều khiển do quản trị viên lưu sẽ không làm gì cho đến khi một vận hành viên bấm vào đó, và điều xảy ra khi bấm đúng bằng điều xảy ra khi bấm ở bất kỳ màn hình nào khác, đến cả dòng trong nhật ký kiểm toán.

**Bố cục là một dòng chảy, không phải tọa độ.** Các thẻ xếp theo thứ tự đọc. Mỗi thẻ nói nó rộng bao nhiêu trên mười hai cột và cao bao nhiêu hàng, và không biết mình sẽ rơi vào đâu. Mười hai cột trên PC bảng điều khiển, sáu cột trên laptop có một cửa sổ khác bên cạnh, hai cột trên máy tính bảng, một cột trên điện thoại. Bố cục theo vị trí điểm ảnh chỉ đúng trên đúng màn hình đã vẽ ra nó, trong khi Edge HMI phải đúng trên bất kỳ màn hình nào mà máy có.

Hệ quả: không ai phải dựng phiên bản cho điện thoại. Không có phiên bản đó.

**Lưu phải nêu rõ phiên bản.** Hai người cùng sửa một bảng điều khiển là chuyện xảy ra lúc giao ca. Một lần lưu mang theo `version` mà nó đã mở, và lần lưu cũ bị từ chối bằng `409` cho biết ai đã lưu trước. Nếu không, người bấm Lưu thứ hai sẽ xóa mất công việc cả buổi chiều của người thứ nhất mà cả hai đều không thấy.

## Mô hình

```json
{
  "id": "line-2",
  "name": "Line 2",
  "description": "The extruder, for the floor.",
  "kind": "cards",
  "roles": ["operator", "admin"],
  "homeFor": ["operator"],
  "screens": ["line-2-panel"],
  "position": 1,
  "version": 3,
  "cards": [
    {"id": "temp", "type": "gauge", "title": "Zone 1", "w": 3, "h": 3,
     "config": {"tag": "press-01/Zone1_Temp"}},
    {"id": "go", "type": "button", "w": 3, "h": 1,
     "config": {"tag": "line-02/Speed", "value": 250, "label": "Run at 250", "confirm": true}}
  ]
}
```

- **`id`** gồm chữ thường, chữ số, dấu gạch nối và dấu gạch dưới, bắt đầu bằng một chữ cái. Nó nằm trong địa chỉ và không bao giờ đổi. `wall` là id của bảng treo tường.
- **`kind`** là `cards`, hoặc `wall` cho bảng treo tường.
- **`roles`** là các vai trò được cấp bảng điều khiển này. Để trống nghĩa là mọi vai trò. Ai có `dashboards.write` thấy mọi bảng điều khiển bất kể giá trị này, vì họ phải sửa được cái mà không ai khác mở được. Vai trò không được cấp mà yêu cầu bảng theo tên sẽ nhận `404`, nên người xem không thể biết những gì tồn tại bằng cách hỏi.
- **`homeFor`** là các vai trò mà nó mở ra đầu tiên khi họ vào mà không có địa chỉ yêu cầu gì. Mỗi vai trò có nhiều nhất một bảng, và bảng đó phải được cấp cho các vai trò coi nó là trang chủ.
- **`screens`** là các màn hình vật lý mà nó dành cho. Một tên màn hình chỉ thuộc về một bảng điều khiển.
- **`position`** sắp thứ tự thanh chuyển. Bảng mới nằm cuối.
- **`cards`** theo thứ tự đọc, tối đa 60 thẻ mỗi bảng, tổng cộng 2 MB.
- **`version`** tăng thêm một sau mỗi lần lưu.

Một thẻ gồm `id` (duy nhất trong bảng, do trang tạo), `type`, `title` tùy chọn, `w` (1 đến 12) và `h` (1 đến 8), cùng một `config` tùy theo loại. Bỏ `w` và `h` thì dùng giá trị mặc định của loại. Config được kiểm tra nghiêm ngặt: một khóa mà loại thẻ không có là lỗi, và nội dung lưu lại có đủ mọi giá trị mặc định. Thẻ nêu tên một tag, thực thể, script hoặc công thức không tồn tại sẽ bị từ chối khi lưu bảng. Nút trên tag chưa được đánh dấu là ghi được, hoặc nút có số nằm ngoài dải của tag, cũng bị từ chối: cổng sẽ từ chối mọi lần bấm, và người dựng bảng cần nghe điều đó, không phải người bấm.

## Các thẻ

| Loại | Là gì | Cấu hình | Kích thước mặc định |
|---|---|---|---|
| `status` | Thiết bị đang chạy, tag đang báo, báo động, historian, thời gian hoạt động: dải trạng thái của Board | không | 12 x 1 |
| `gauge` | Một tag thành mặt đồng hồ của Board, có dải đo và các giới hạn báo động | `tag` | 3 x 3 |
| `value` | Một tag thành số lớn, tô màu theo trạng thái báo động | `tag`, `decimals` | 3 x 2 |
| `trend` | Tối đa sáu tag trong khoảng từ 15 phút đến một tuần | `tags`, `minutes`, `labels` | 6 x 3 |
| `entities` | Các thực thể bạn chọn, thành ô riêng với điều khiển riêng | `entities` (tối đa 30) | 6 x 3 |
| `alarms` | Danh sách báo động, có nút Xác nhận cho ai được phép | `outstanding`, `limit`, `devices`, `equipment` | 6 x 3 |
| `button` | Ghi một giá trị vào một tag, sau khi hỏi | `tag`, `value`, `label`, `confirm` | 3 x 1 |
| `script` | Chạy một script qua hộp xác nhận của màn hình Script | `script`, `label` | 3 x 1 |
| `recipe` | Chọn một trong tối đa tám công thức và mở ngăn áp dụng của nó | `recipes` | 4 x 2 |
| `markdown` | Văn bản: tiêu đề, danh sách, chữ đậm, chữ nghiêng, mã, liên kết http(s) | `text` | 4 x 2 |
| `camera` | Ảnh chụp tự làm mới, hoặc luồng JPEG chuyển động | `url`, `stream`, `refreshSec` | 6 x 4 |
| `map` | Sơ đồ mặt bằng có đặt các tag trực tiếp lên đó | `image`, `markers` | 6 x 5 |
| `setpoint` | Một số nhập cho một tag, có giới hạn, đơn vị và xác nhận, kèm giá trị thiết bị báo lại | `tag`, `label`, `min`, `max`, `step`, `unit`, `decimals`, `confirm` | 3 x 3 |
| `symbols` | Hình một cỗ máy: các ký hiệu đặt theo điểm ảnh trên nền, vẽ theo tag của từng ký hiệu | `image`, `width`, `height`, `symbols` | 8 x 5 |

Những điều đáng biết về các thẻ không hiển nhiên:

- **`button`** gửi `value` đúng kiểu mà nó đã được lưu. Một số là số, `true` là boolean, một chuỗi là văn bản. Trên PLC, `1` và `1.0` là hai lần ghi khác nhau và cổng quyết định theo kiểu JSON, nên thẻ không biến cái này thành cái kia. `confirm` bật sẵn trừ khi bị tắt, và khi bật nó hỏi “thao tác này ra lệnh cho thiết bị thật” kèm giá trị hiện tại và một lý do sẽ vào nhật ký kiểm toán (`dashboard <id> / <card>` nếu để trống). Tắt nó dành cho bảng điều khiển mà việc giữ nút chính là mục đích; đó là quyết định của kỹ sư, và mục “Xác nhận trước khi ghi” của màn hình Cài đặt sẽ bật lại nó.
- **`alarms`** liệt kê báo động của cả nhà máy trừ khi bạn chỉ nó vào chỗ khác. `devices` là danh sách id thiết bị. `equipment` là danh sách id nút thiết bị từ `GET /api/equipment`, ở bất kỳ cấp nào (một địa điểm, một khu, một dây chuyền, một cell), và một nút đại diện cho mọi thiết bị đặt tại hoặc dưới nó, nên trang của một khu có thể hiện báo động của khu đó và không của ai khác. Khi có cả hai, một báo động được liệt kê nếu nó thuộc một trong hai. Bỏ trống hoặc để rỗng thì thẻ là toàn nhà máy, đúng như mọi thẻ lưu trước khi có các trường này. Giới hạn đếm phần còn lại sau khi lọc, và `outstanding` vẫn loại những báo động đã trở về bình thường và đã được xác nhận. Một thẻ giới hạn vào nơi không có báo động sẽ ghi “ở đây” để không ai đọc nhầm thành nhà máy yên tĩnh, và một thẻ có thiết bị đã bị xóa sẽ nói điều đó thay vì hiện danh sách trống. Thiết bị được lưu bằng id của nút, nên đổi tên hay di chuyển nút không làm hỏng thẻ. Bảng bị từ chối khi lưu nếu một thiết bị hoặc nút không có. Trong trình dựng, bạn gõ đường dẫn (`Plant 2 / Scrubbers / Kettle 3`) và nó giữ lại id. Thẻ này đọc cây thiết bị, nên vai trò cần `equipment.read` (vận hành viên và người xem có quyền này).

  ```json
  {
    "id": "kettle-alarms", "type": "alarms", "title": "Scrubber alarms", "w": 6, "h": 3,
    "config": { "outstanding": true, "limit": 10, "equipment": [14], "devices": ["oven-1"] }
  }
  ```
- **`trend`** vẽ đúng khoảng bạn yêu cầu, kết thúc ở hiện tại, chứ không chỉ khoảng mà các số đọc tình cờ phủ tới. `minutes: 480` là một trục của tám giờ gần nhất với một vạch ở mỗi giờ tròn, theo múi giờ của người đang xem. Một tag không đổi là một đường phẳng ở số đọc tốt cuối cùng, vì máy nghiền dừng hay van đóng trông đúng như vậy, và historian chỉ giữ một số đọc khi giá trị vượt qua vùng chết, nên trong khoảng có thể chỉ có một số đọc, hoặc không có. Không có gì trên đường là bịa ra. Giá trị mà tag giữ khi khoảng bắt đầu là số đọc tốt cuối cùng trước đó (`GET /api/history` cho biết điều này bằng `carry=true`), và đường là giá trị đó từ đầu khoảng đến số đọc đầu tiên trong khoảng. Sau số đọc cuối cùng, nó được giữ đến lần cuối cùng nghe tin từ tag, không bao giờ quá hiện tại. Không có đường trước số đọc đầu tiên mà bất kỳ ai có, và một tag mà số đọc cuối trước khoảng là xấu thì hoàn toàn không có giá trị mang sang, vì không biết nó đã giữ gì. Một đoạn số đọc xấu là một khoảng trống, như xưa nay. Một số đọc đơn lẻ là một đường kéo đến hiện tại, hoặc một chấm nếu không có chỗ để vẽ tới.

  Chú giải gọi mỗi đường bằng tên riêng của tag, cùng tên mà thẻ số hiển thị, không kèm thiết bị phía trước. Hai đường cùng tên từ các thiết bị khác nhau giữ id đầy đủ để bạn phân biệt được. `labels` là một đối tượng tùy chọn từ một tag trong `tags` sang văn bản bạn muốn dùng thay, dài 1 đến 80 ký tự, và nhãn cho một tag không được vẽ sẽ bị từ chối. Chú thích khi rê chuột luôn có id đầy đủ bên cạnh nhãn.

  ```json
  {
    "id": "mills", "type": "trend", "title": "Mill temperatures", "w": 6, "h": 3,
    "config": {
      "tags": ["plant-5-temperatures/Large Sand Mill Temperature", "plant-5-temperatures/Small Sand Mill Temperature"],
      "minutes": 480,
      "labels": { "plant-5-temperatures/Large Sand Mill Temperature": "Large mill" }
    }
  }
  ```
- **`camera`** tải địa chỉ trong trình duyệt, không phải trên máy chủ. Config của thẻ mọi vai trò mở bảng đều đọc được, nên địa chỉ có chứa thông tin đăng nhập hoặc token sẽ bị từ chối khi lưu bảng. Hãy dùng một địa chỉ trong mạng nhà máy không cần đăng nhập, hoặc một proxy thêm đăng nhập. Ảnh tĩnh được lấy lại mỗi `refreshSec` giây với tham số truy vấn `_hl` để trình duyệt không hiện mãi tấm đầu tiên.
- **`map`** là một hình ảnh và các điểm đánh dấu. Hình là một địa chỉ http(s) hoặc một tệp tải lên thẻ (png, jpeg, webp hoặc gif, tối đa 500 KB, lưu trong thẻ). Các điểm đánh dấu là tag, đặt theo phần trăm chiều rộng và chiều cao của hình nên ở nguyên chỗ đã đặt ở mọi kích thước. Đây là sơ đồ mặt bằng, không phải bản đồ đường phố: bản đồ ô cần máy chủ ô trên internet, và PC bảng điều khiển của nhà máy thường không tới được.
- **`setpoint`** dành cho một số do ai đó nhập: nhiệt độ, tốc độ, mức. Ô nhập biết đơn vị của tag (hoặc `unit` của thẻ) và các giới hạn của nó: `min` và `max` cùng nhau, hoặc dải của chính tag khi thẻ không cho. Thẻ chỉ có thể thu hẹp dải của tag, không bao giờ mở rộng, vì cổng ghi từ chối giá trị ngoài dải của tag dù thẻ nói gì; thẻ đề nghị rộng hơn bị từ chối khi lưu bảng, và thẻ trên một tag chứa văn bản hay công tắc cũng vậy (với chúng hãy dùng `button`). Khi ngoài giới hạn, lệch khỏi `step` hoặc không phải số, ô nhập báo điều đó bên dưới và **Set** vẫn tắt. **Set** hỏi trước, với giá trị hiện tại và một lý do cho nhật ký kiểm toán, trừ khi thẻ được dựng với `confirm` tắt và Cài đặt không ghi đè, rồi nó đi qua `POST /api/write`: công tắc ghi chính, cờ ghi được của tag, quyền của vai trò và dòng kiểm toán đều giống mọi lần ghi khác. Sau đó thẻ chờ số đọc của thiết bị hiện giá trị và theo dõi thêm hai giây, rồi nói thiết bị đang giữ gì: “Đọc lại 70 C từ thiết bị: đó là giá trị đã gửi”; hoặc nếu PLC nhận lệnh ghi rồi đưa nó về giới hạn riêng của nó, “Thiết bị nhận 70 C rồi đổi thành 60 C”; hoặc nếu số đọc không bao giờ hiện nó, “Thiết bị báo 60 C, không phải 70 C”. Dòng “trong thiết bị lúc này” luôn là số đọc trực tiếp, nên nó cũng cho thấy khi một chương trình PLC ghi đè giá trị về sau. Khi thiết bị không có số đọc tốt (PLC tắt hoặc không liên lạc được), ô nhập và Set bị tắt và thẻ nói thiết bị không trả lời, vì một lệnh ghi chỉ có thể bị từ chối.
- **`symbols`** là hình một cỗ máy. `width` và `height` là kích thước điểm ảnh của chính trang (800 x 450 nếu bỏ qua), `image` là nền tùy chọn (một địa chỉ http(s), hoặc một hình tải lên thẻ, giống `map`), và `symbols` là danh sách các thứ đặt theo điểm ảnh từ góc trên bên trái: `{"id": "p1", "type": "pump", "x": 120, "y": 300, "tag": "plc/bPumpRun"}`. Trang được vẽ như một hình co giãn, nên mỗi ký hiệu giữ nguyên chỗ ở mọi kích thước thẻ và trên điện thoại. Các loại là `pump`, `motor` và `fan` (quay khi tag bật), `valve` (mở hoặc đóng), `tank` (đầy giữa `min` và `max`, hoặc dải của tag, hoặc 0 đến 100), `heater` và `lamp` (sáng khi bật), `pipe` (chất bên trong chuyển động khi tag tùy chọn của nó bật), `readout` (số, kèm `unit` và `decimals`) và `label` (văn bản cố định). `invert` đọc tag theo chiều ngược lại, và `tone` của đèn (`ok`, `warn`, `bad` hoặc `info`) là màu nó sáng lên: đèn chạy màu xanh lá và đèn lỗi màu đỏ, còn tag chỉ cho biết khi nào nó sáng. Một ký hiệu nói trạng thái của nó bằng lời chứ không chỉ bằng màu (phụ đề và tiêu đề), được vẽ màu đỏ hoặc ấm khi tag của nó đang báo động hoặc vừa trở về từ báo động, và mờ đi với chữ “không có số đọc” khi tag không có số đọc tốt. Chuyển động dừng khi người dùng đã yêu cầu hệ thống giảm chuyển động. Các ký hiệu do HotLoop vẽ cho HotLoop; không cái nào là mượn. Một ký hiệu có tag sẽ mở tag đó khi được bấm, như một chiếc ghim trên sơ đồ mặt bằng. Nó không ra lệnh gì: hãy đặt một thẻ `setpoint` hoặc `button` bên cạnh để làm việc đó. Trong trình dựng, một ký hiệu được nhấc lên và di chuyển bằng con trỏ, hoặc bằng phím mũi tên (Shift di chuyển mười điểm ảnh), hoặc nhập số điểm ảnh của nó.
- **`markdown`** được dựng thành các nút DOM và không bao giờ thành HTML, nên không gì gõ vào đó có thể thành mã đánh dấu hay script.
- **`gauge`, `value`, `map`, `setpoint`** hiện “không còn trên gateway này” nếu tag của chúng bị xóa sau khi bảng được lưu, thay vì một mặt đồng hồ không bao giờ nhúc nhích.

## Bảng treo tường

Bảng treo tường là bảng điều khiển `wall`, kind `wall`. Nó luôn có đó, không thể xóa và không có thẻ: các đồng hồ của nó là những tag được ghim trên màn hình Board, giữ trong cài đặt riêng của board như từ trước đến nay. `GET` và `PUT /api/board`, địa chỉ `#board`, bộ chọn ghim và thao tác kéo để sắp xếp đều giữ nguyên.

Điều nó nhận được khi là một bảng điều khiển là thanh chuyển (nó là viên thuốc đầu tiên trên mọi bảng điều khiển và Board cũng có thanh này) và việc gán: nó có thể được cấp cho một số vai trò, làm trang chủ của một vai trò, và là của một màn hình vật lý. Một chiếc TV trên tường mở `/?screen=wall-tv` và nhận Board không có tiêu đề trang và các tab.

## Vai trò và màn hình

**Theo vai trò.** `roles` quyết định ai được cấp một bảng điều khiển. `homeFor` quyết định vai trò đáp xuống đâu. Một vận hành viên có trang chủ là `line-2` mở HotLoop ra là thấy Dây chuyền 2. Nếu địa chỉ có một phần đoạn URL (`#alarms`), trang mở ở nơi địa chỉ chỉ.

**Theo màn hình.** Một màn hình là một thiết bị hiển thị vật lý. Mở HotLoop ở `/?screen=<name>` thì nó hiện bảng điều khiển có `screens` mang tên đó, không có tiêu đề trang, không có tab và vùng chạm lớn hơn, vì người đi ngang qua PC bảng điều khiển không cần một lối thoát khỏi trang. Một tên mà không bảng nào có sẽ nói thẳng điều đó thay vì hiện một thứ khác.

**Bảng điều khiển đăng nhập cho người, không đăng nhập cho chính nó.** Khi chưa ai đăng nhập, nó chỉ hiện một ô “PIN hoặc thẻ”. Vận hành viên gõ PIN, hoặc quét thẻ (đầu đọc kiểu bàn phím gõ vào ô), và bảng mở bảng điều khiển. Tên của họ và nút **Đăng xuất** nằm ở góc, vì tiêu đề trang vốn hiện chúng đã không còn. Mọi lệnh ghi do một nút trên bảng đó thực hiện đều đi qua cổng ghi dưới tên người ấy, nên nhật ký kiểm toán và Nhật ký ghi tên họ: “olga ghi 250 vào line-02/Speed”, không phải “panel-3”. Sau mười lăm phút không ai chạm vào màn hình (là một cài đặt), bảng đăng xuất họ và quay về ô nhập, và lệnh ghi gửi sau đó bị từ chối. Quản trị viên cấp cho mỗi người một mã trong **Cài đặt, Người dùng**. Toàn bộ nội dung, thẻ là gì, mã được lưu thế nào và nó không làm gì, nằm ở [Xác thực và người dùng](/vi/iot/authentication/#bảng-kiosk-mã-pin-hoặc-thẻ-và-tự-đăng-xuất-khi-nhàn-rỗi).

Trên máy tính của chính bạn, không điều nào trong số này áp dụng: bạn đăng nhập bằng mật khẩu, lệnh ghi của nút đi thẳng qua cổng và ghi tên bạn, và không có đăng xuất khi nhàn rỗi. Một bảng đăng nhập bằng tài khoản vận hành viên dùng chung, cách mà bảng buộc phải chạy trước khi có PIN, vẫn hoạt động và vẫn ghi dưới tài khoản đó. Đừng cấp cho bảng dùng chung một đăng nhập như vậy.

Edge HMI chính là thế này: một bảng điều khiển có đặt `screens`, trên một máy mở địa chỉ đó, với những người đứng trước máy đăng nhập bằng PIN hoặc thẻ.

## Dựng bảng

Ai có `dashboards.write` (quản trị viên) thấy **Sửa** trên một bảng điều khiển và **Bảng điều khiển mới** trên thanh. Khi đang sửa:

- các thẻ bị vô hiệu, nên nắm một nút để di chuyển nó không thể bấm nó;
- kéo một thẻ lên thẻ khác để đặt nó vào đó, hoặc dùng các mũi tên trên thanh công cụ của thẻ, thứ mà điện thoại dùng, vì màn hình cảm ứng không bắt đầu thao tác kéo;
- kéo góc để đổi kích thước: chiều rộng bám vào một cột trong mười hai, chiều cao bám vào một hàng;
- bánh răng sửa thẻ, nút sao chép nhân bản nó, dấu chéo xóa nó;
- **Cài đặt** là tên, được cấp cho ai, mở ra đầu tiên cho ai, các màn hình vật lý của nó và vị trí của nó trên thanh chuyển.

Không có gì được lưu cho đến khi bấm **Lưu**. **Hủy bỏ** bỏ các thay đổi. `409` khi lưu nghĩa là ai đó đã lưu trước: trang đề nghị tải bản của họ.

**Xuất** (cạnh Sửa) lưu bảng điều khiển đang hiện thành một tệp, và **Nhập** (trên thanh cạnh Bảng điều khiển mới, cho ai có `dashboards.write`) tải một tệp vào bản cài đặt này, nên một màn hình là dữ liệu của khách hàng và di chuyển giữa các bản cài đặt mà không ai phải dựng lại. Xem [Tệp màn hình](/vi/iot/screen-file/).

## Bố cục

| Chiều rộng | Cột | Một thẻ có `w` chiếm |
|---|---|---|
| Trên 1100 px | 12 | `w` |
| 700 đến 1100 px | 6 | một nửa `w`, làm tròn lên |
| 480 đến 700 px | 2 | một, hoặc cả hai khi `w` trên 4 |
| Dưới 480 px | 1 | tất cả |

Hàng cao 76 px với khoảng cách 16 px ở các bố cục rộng. Trên điện thoại, thẻ cao bằng nội dung của nó với mức sàn từ số hàng, nên không gì bị cắt. Thanh chuyển cuộn ngang bên trong chính nó và trang không bao giờ cuộn ngang.

## Trên điện thoại

Giao diện web có thể cài lên điện thoại và mở được khi không có kết nối. Đó là cùng một trang kèm tệp manifest, biểu tượng và một service worker, do chính HotLoop phục vụ, nên không có gì phải dựng và không có gì phải cài trên máy chủ.

**Cài đặt.** Trên Android, menu của Chrome có **Cài đặt ứng dụng**. Trên iPhone, bảng Chia sẻ của Safari có **Thêm vào Màn hình chính**. Nó mở toàn màn hình, với tên nhà máy, và trên Android nhấn giữ biểu tượng sẽ có Báo động và Bảng điều khiển. Trình duyệt chỉ cài một trang và chạy một service worker qua **https**, hoặc trên `localhost`. Trên địa chỉ `http://` thường của nhà máy, HotLoop vẫn mở trong một tab như trước nay, nhưng không thể cài và sẽ không chạy ngoại tuyến. Hãy đặt một chứng chỉ phía trước cho điện thoại (ingress hoặc reverse proxy bạn đã có). Trình duyệt cho bạn biết vì sao nó không cài: công cụ phát triển của Chrome, Application, Manifest.

**Nó giữ gì.** Chính trang đó, và câu trả lời gần nhất cho các lần đọc mà người dùng xem: danh sách báo động, các bảng điều khiển, số đọc và trạng thái thực thể, thiết bị và tag, trạng thái, cây thiết bị và board. Khi trang đang mở và có kết nối, nó hỏi những thứ đó mỗi phút một lần để có gì đó mà mở ra, và không hỏi khi điện thoại nằm trong túi. Mở khi không có kết nối thì trang vẫn tải, danh sách báo động và các bảng điều khiển hiện những gì điện thoại thấy lần cuối, và một thanh ở dưới cùng nói điều đó, kèm thời gian:

```
Offline. This is what this phone last saw as of 10/22/2026, 05:42:23. Nothing you
do here is sent until the connection is back.
```

Khi có lại kết nối, trong vài giây, thanh biến mất, màn hình làm mới từ các câu trả lời trực tiếp và nguồn cấp trực tiếp kết nối lại.

**Ngoại tuyến và chưa bao giờ đăng nhập.** Một điện thoại có ứng dụng nhưng chưa đăng nhập (chưa từng, hoặc đã đăng xuất, việc này làm trống những gì nó giữ) không có gì để hiện khi không có kết nối, nên nó hiện màn hình đăng nhập và nói rõ lý do: HotLoop không trả lời từ đây, và nó cứ thử lại. Ngay khi HotLoop trả lời, trang tự tải lại vào màn hình đăng nhập thật. Nó không bao giờ hiện một ứng dụng trống rỗng.

**Nó không bao giờ làm gì.** Không gì làm thay đổi điều gì được gửi đi từ một trang ngoại tuyến. Một lệnh ghi, dù là một giá trị vào tag, một script, một công thức hay một lần xác nhận, đều bị từ chối trước khi rời khỏi trang, kèm lý do:

```
You are offline, so nothing was sent. Everything here is as of 10/22/2026, 05:42:23.
Try again when the connection is back.
```

Service worker không trả lời, không giữ và không xếp hàng một lệnh ghi nào, và trong đó không có đồng bộ nền. Một lệnh cho thiết bị chỉ được gửi bởi một người đang nhìn một câu trả lời trực tiếp, và một nút bấm khi không có kết nối không nằm đợi ở đâu đó để gửi đi sau. Xác nhận từ một thông báo là chuyện khác và cũng cần mạng như vậy: ứng dụng ntfy tự bấm nút của nó.

**Nó không giữ gì.** Nguồn cấp trực tiếp, xu hướng và lịch sử, Nhật ký, cài đặt, người dùng, chính sách leo thang và mọi thứ về thông báo. Một số thì quá lớn và khác nhau mỗi lần nên không đáng giữ, một số chứa những thứ (chủ đề ntfy của người dùng, tài khoản) không nên nằm trong bộ nhớ đệm của điện thoại, nên các màn hình này cần HotLoop trả lời.

**Trên điện thoại.** Những gì được giữ nằm trong bộ nhớ đệm của trình duyệt trên điện thoại đó, tối đa 200 câu trả lời, cái cũ nhất bị bỏ trước. **Đăng xuất làm trống nó**, và một phiên đã hết hạn hoặc bị thu hồi cũng vậy (mã `401` đầu tiên làm trống). Chỉ phiên đã đăng nhập mới được giữ, nên một điện thoại ngoại tuyến không bao giờ mở ra dữ liệu của người khác. Một phiên bản HotLoop mới có bộ nhớ đệm trang riêng và cái cũ bị xóa; trang được lấy trực tiếp mỗi khi có kết nối, nên phiên bản mới hay tên nhà máy đã đổi sẽ hiện ở lần mở tiếp theo.

Cùng bài kiểm tra này gỡ máy chủ đi, cho cả trang lẫn worker, rồi tải lại: trang mở ra, danh sách báo động và một bảng điều khiển hiện những gì đã giữ, một lệnh ghi vào tag và một lần Xác nhận đều bị từ chối, báo động vẫn chưa được xác nhận và nhật ký kiểm toán ghi vẫn trống sau khi có lại kết nối, và đăng xuất làm trống những gì đã giữ. Chạy trên máy thật không ảo hóa (2026-11-17), gồm cả cài lên một điện thoại thật, Safari trên iPhone, và Wi-Fi nhà máy thật bị rớt.

## Quyền

| Quyền | Người xem | Vận hành viên | Quản trị viên |
|---|---|---|---|
| `dashboards.read` | có | có | có |
| `dashboards.write` | không | không | có |

Đọc là của mọi vai trò, lọc theo `roles`. Ghi là của quản trị viên. Điều một thẻ làm được khi bị bấm là quyền của chính người bấm: người xem thấy nút ghi bị vô hiệu, và máy chủ sẽ từ chối nếu họ vượt qua được.

## API

| Phương thức | Route | Quyền |
|---|---|---|
| `GET` | `/api/dashboards` | `dashboards.read` |
| `POST` | `/api/dashboards` | `dashboards.write` |
| `GET` | `/api/dashboards/{id}` | `dashboards.read` |
| `PUT` | `/api/dashboards/{id}` | `dashboards.write` |
| `DELETE` | `/api/dashboards/{id}` | `dashboards.write` |
| `GET` | `/api/dashboards/{id}/export` | `dashboards.read` |
| `POST` | `/api/dashboards/import` | `dashboards.write` |

Tài liệu tham chiếu có nội dung và lỗi nằm ở [HTTP API](/vi/iot/api/#dashboards). Mỗi lần tạo, lưu và xóa đều được ghi lại thành sự kiện `config` trên chủ thể `dashboard:<id>`, nên Nhật ký cho biết ai đã đổi điều một bảng điều khiển hiện.

Bảng dữ liệu là `dashboards`, thêm trong migration 0023 cho PostgreSQL, TimescaleDB và SQLite. Nó chỉ thêm ([Migration chỉ thêm](/vi/iot/migrations/)). Dòng của bảng treo tường do ứng dụng tạo khi lần đầu được hỏi, không phải do migration, nên một cơ sở dữ liệu khôi phục từ bản sao lưu lấy trước khi có bảng điều khiển sẽ có lại nó.

## Điều không có ở đây

- **Bố cục chính xác đến điểm ảnh.** Cố ý như vậy, như đã nói ở trên. Nếu HMI của một cỗ máy thật sự cần một điều khiển ở vị trí cố định, đó là một màn hình dựng cho cỗ máy ấy, và không phải việc của tính năng này.
- **Hiển thị theo từng thẻ.** Một bảng điều khiển được cấp cho các vai trò; một thẻ thì không. Hai nhóm người xem với các thẻ khác nhau là hai bảng điều khiển.
- **Bản đồ ô.** Xem thẻ `map`.
- **Giữ nút.** Một nút ghi một lần khi bấm. Một điều khiển tức thời ghi khi nhấn và ghi lại khi thả là một thẻ khác và chưa được xây dựng.
- **Bảng điều khiển trong Edge Relay.** Nó không có giao diện.
