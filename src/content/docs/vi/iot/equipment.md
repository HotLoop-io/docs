---
title: "Cây thiết bị và nhãn"
description: "Một cây ISA-95 từ doanh nghiệp tới thiết bị, cùng với nhãn, để quy tắc và tác tử nói về cái bơm chứ không phải thanh ghi 40001."
---

Một nhà máy vốn đã có cách tự sắp xếp, và mọi hệ thống SCADA, MES và historian của nhà máy đều dùng cách đó: ISA-95. Doanh nghiệp, địa điểm, khu vực, dây chuyền, ô, đơn vị, thiết bị. HotLoop dùng đúng như vậy, một cây duy nhất, chứ không phải một danh sách cho các tầng, một danh sách khác cho các khu vực và danh sách thứ ba cho các thiết bị. Xem [Thực thể](/vi/iot/entities/) để biết những gì treo dưới cây.

## Cấp

| Cấp | Thường là gì |
|---|---|
| `enterprise` | Công ty |
| `site` | Một nhà máy |
| `area` | Một bộ phận hoặc một tòa nhà: Đóng gói, Tiện ích, Khu bồn chứa |
| `line` | Một dây chuyền sản xuất |
| `cell` | Một ô làm việc trên dây chuyền, hoặc một ô quy trình trong nhà máy sản xuất theo mẻ |
| `unit` | Một đơn vị sản xuất: một lò phản ứng, một máy làm lạnh, một lò nung |
| `equipment` | Một máy hoặc một phần của máy: một cái bơm, một skid, một động cơ |

Nút con luôn ở cấp thấp hơn nút cha, nên một địa điểm không bao giờ nằm dưới một dây chuyền. Có thể bỏ qua cấp: một đơn vị nằm thẳng dưới một khu vực là được, và một dây chuyền nằm thẳng dưới một địa điểm trong nhà máy không có khu vực cũng vậy. Ngoại lệ duy nhất là `equipment` trong `equipment`, vì một skid chứa các bơm và một cái bơm chứa một động cơ, và ISA-95 ngừng đặt tên cho các cấp từ rất lâu trước khi một nhà máy ngừng lồng các thứ vào nhau. Một nút có thể nằm ở gốc ở bất kỳ cấp nào; hầu hết nhà máy bắt đầu từ `site`.

Hai nút anh em cùng cấp và cùng tên là cùng một nơi, nên cây từ chối nút thứ hai.

Một nút không bao giờ có thể trở thành tổ tiên của chính nó: việc di chuyển một nút xuống dưới chính nó hoặc dưới bất kỳ nút nào nằm dưới nó đều bị từ chối. Cách duy nhất để tạo ra một vòng lặp là chỉnh sửa bảng `equipment` bằng tay. Nếu có ai làm vậy, không thứ gì duyệt qua cây bị treo, và việc thay đổi một nút trong vòng lặp bị từ chối kèm thông báo nêu tên các nút và bảo bạn đặt `parent_id` của một trong số đó thành NULL.

## Văn bản địa điểm, khu vực và dây chuyền vẫn hoạt động

Mỗi thiết bị đều có các trường văn bản tự do `site`, `area` và `line` từ trước khi cây tồn tại. Chúng không biến mất. Trình chỉnh sửa thiết bị của 4.15 ghi chúng, `list_devices` và `describe_device` đọc chúng, và mọi tác tử cũng như tập lệnh mà ai đó viết dựa trên chúng cũng vậy. Vì thế văn bản và cây được giữ đồng bộ, theo cả hai chiều, trong cùng một giao dịch với thay đổi:

**Lưu một thiết bị có văn bản mà không có `equipmentId`** sẽ tìm địa điểm, khu vực và dây chuyền mà văn bản nêu tên, hoặc tạo ra chúng, cái nọ dưới cái kia, rồi đặt thiết bị vào nút sâu nhất. Hai thiết bị có cùng văn bản sẽ rơi vào cùng một nút; không bao giờ có gì bị nhân đôi. Văn bản bạn gửi chính là văn bản được lưu, đúng từng chữ: một client không biết gì về cây nhận lại những gì nó vẫn luôn nhận, cộng thêm một `equipmentId` mà nó có thể bỏ qua.

**Lưu một thiết bị với `equipmentId` làm nó di chuyển** sẽ lấy văn bản từ đường dẫn của nút, bất kể văn bản đi kèm là gì. Đặt một thiết bị lên một ô dưới `Plant A / Packing / Line 2` và văn bản của nó trở thành `Plant A`, `Packing`, `Line 2`.

Hai chi tiết giúp điều này an toàn với các client không biết về cây:

- Văn bản vẫn nói đúng điều mà nút hiện tại của thiết bị nói thì giữ thiết bị ở nguyên chỗ. Văn bản chỉ có ba cột, nên một thiết bị trên một ô hoặc một máy bên dưới dây chuyền chỉ có thể nói tới dây chuyền. Lưu nó với cùng văn bản đó không đẩy nó lên dây chuyền.
- Một client đọc một thiết bị rồi gửi trả cả thiết bị, kèm `equipmentId` và mọi thứ, với văn bản đã chỉnh sửa, sẽ nhận được việc chỉnh sửa văn bản. `equipmentId` mà nó gửi lại chính là cái thiết bị đã có, nên đó không phải di chuyển, và văn bản quyết định.

Một địa điểm được tìm thấy ở bất kỳ đâu, không chỉ ở gốc, nên việc đặt `Plant A` dưới một doanh nghiệp không khiến thiết bị tiếp theo nói `Plant A` tạo ra cái thứ hai.

**Đổi tên hoặc di chuyển một nút** ghi lại văn bản của mọi thiết bị tại nút đó hoặc bên dưới nó, trong cùng một giao dịch. Nếu bất kỳ phần nào thất bại, không có gì xảy ra: một cây nói một đằng và văn bản thiết bị nói một nẻo chính là điều việc giữ đồng bộ cả hai nhằm ngăn chặn. Phản hồi và nhật ký hệ thống liệt kê mọi thiết bị có văn bản bị thay đổi.

### Nâng cấp

Bản di chuyển `0006_hierarchy.sql` dựng cây từ văn bản mà mỗi thiết bị hiện có đã mang sẵn: một địa điểm cho mỗi tên địa điểm khác nhau, một khu vực cho mỗi tên khu vực khác nhau dưới địa điểm của nó, một dây chuyền cho mỗi dây chuyền khác nhau dưới khu vực của nó, và mỗi thiết bị ở nút sâu nhất mà văn bản của nó nêu tên. Thiết bị có khu vực mà không có địa điểm nhận một khu vực ở gốc; thiết bị có dây chuyền mà không có khu vực nhận một dây chuyền nằm thẳng dưới địa điểm của nó. Văn bản chỉ toàn dấu cách thì không nêu tên gì cả. Văn bản được dùng đúng như đã lưu, kể cả dấu cách và chữ hoa chữ thường, vì tên trong cây là thứ mà văn bản sau này được ghi lại từ đó, và việc cắt bớt khi nâng cấp sẽ là một lần đổi tên âm thầm cho mọi thiết bị có thừa một dấu cách. Không có văn bản thiết bị nào thay đổi khi nâng cấp.

Phía Go đặt một thiết bị theo cùng các quy tắc, và một bài kiểm thử giữ hai bên khớp nhau: mọi thiết bị mà bản nâng cấp đã đặt, lưu lại mà không chạm vào, vẫn ở nguyên chỗ và không làm cây to thêm gì.

## Xóa một nút

**Một nút có bất kỳ thứ gì bên dưới sẽ bị từ chối**: các nút con, hoặc các thiết bị đặt trên nó. Hãy di chuyển chúng trước. Thông báo từ chối nêu rõ cái gì đang cản đường.

Cách thay thế là gắn các nút con vào nút cha của nút bị xóa. Việc đó di chuyển mọi thiết bị bên dưới và ghi lại văn bản của chúng, dưới một nút mà không ai đụng tới, và có thể đặt một dây chuyền thẳng dưới một địa điểm mà không có khu vực ở giữa, một cây mà không ai vẽ ra. Còn nếu bỏ vị trí của các thiết bị, văn bản của chúng sẽ nêu một nơi không còn tồn tại, và lần lưu tiếp theo của bất kỳ thiết bị nào trong số đó sẽ âm thầm tạo lại nút. Cả hai đều gây bất ngờ. Một lời từ chối cho biết cần di chuyển gì thì không.

Các thực thể đặt trên một nút bị xóa mất vị trí và quay lại đi theo thiết bị của chúng.

## Thực thể trên cây

Mỗi phản hồi thực thể giờ mang thêm ba trường:

| Trường | Ý nghĩa |
|---|---|
| `equipment_id` | Nơi bản thân thực thể được đặt, hoặc null khi nó cứ đi theo nơi thiết bị của nó đi |
| `area_id` | `area` gần nhất tại nút riêng của thực thể hoặc phía trên nó, hoặc nút của thiết bị khi nó không có. Mọi thứ nhóm theo khu vực đều đọc trường này. Null khi không có khu vực nào phía trên |
| `labels` | Các label_id của thực thể |

Vị trí riêng của một thực thể được ưu tiên hơn vị trí của thiết bị của nó. Điều này quan trọng với một thiết bị là cả một PLC: tag nhiệt độ của nó thuộc về lò nung, tag máy làm lạnh của nó thuộc về Tiện ích. Đặt một thực thể bằng `PUT /api/entities/{entity_id}`:

```json
{ "equipment_id": 42, "labels": ["critical"] }
```

`"equipment_id": null` quay lại đi theo thiết bị. `labels` thay thế toàn bộ tập. Cả hai đều cần `entities.write`, như mọi trường sổ đăng ký khác.

## Nhãn

Nhãn là một tag theo nghĩa thông thường: `critical`, `line 1 utilities`, `calibrate quarterly`. Thiết bị và thực thể mang bao nhiêu nhãn cũng được.

Một nhãn có `label_id` và `name`. `label_id` được tạo từ tên lần đầu tiên (chữ thường, chữ số và dấu gạch dưới, thêm `_2`, `_3` khi trùng) và không bao giờ thay đổi, vì đó là thứ mà tự động hóa và màn hình tham chiếu tới. Tên có thể đổi bất cứ lúc nào. Bạn cũng có thể tự chọn `label_id` khi tạo nhãn.

Xóa một nhãn sẽ gỡ nó khỏi mọi thứ đang mang nó.

Nhãn của thiết bị được đặt bằng `PUT /api/devices/{id}/labels`, không phải qua `POST /api/devices`. Mọi client lưu thiết bị hiện nay đều gửi cả thiết bị mà không có nhãn, và sẽ xóa sạch nhãn ở mỗi lần lưu.

## API

Các endpoint thiết bị và nhãn dùng tên trường snake_case, như các endpoint thực thể, vì cây là sổ đăng ký khu vực của mô hình thực thể và được tạo hình cho cùng những bên sử dụng. Trường mới của thiết bị là `equipmentId`, camelCase, như phần còn lại của API thiết bị.

| Endpoint | Quyền | Ý nghĩa |
|---|---|---|
| `GET /api/equipment` | `equipment.read` | Mọi nút, kèm `path` gồm các tên từ gốc. Bộ lọc: `?level=` |
| `GET /api/equipment/{id}` | `equipment.read` | `{"equipment", "children", "devices", "entities"}`: nút đó, các nút nằm thẳng bên dưới và những gì đặt thẳng trên nó |
| `POST /api/equipment` | `equipment.write` | `{"parent_id", "level", "name", "description"}` |
| `PUT /api/equipment/{id}` | `equipment.write` | Bất kỳ trường nào trong `name`, `description`, `level`, `parent_id` (null cho gốc). Trả về `{"equipment", "devices_rewritten"}` |
| `DELETE /api/equipment/{id}` | `equipment.write` | Bị từ chối với 409 khi còn bất kỳ thứ gì bên dưới |
| `GET /api/labels` | `equipment.read` | Mọi nhãn |
| `GET /api/labels/{label_id}` | `equipment.read` | `{"label", "devices", "entities"}` mang nhãn đó |
| `POST /api/labels` | `equipment.write` | `{"label_id"?, "name", "color", "icon", "description"}` |
| `PUT /api/labels/{label_id}` | `equipment.write` | Tên, màu, biểu tượng, mô tả. Không bao giờ đổi label_id |
| `DELETE /api/labels/{label_id}` | `equipment.write` | Gỡ nó khỏi mọi thứ |
| `PUT /api/devices/{id}/labels` | `equipment.write` | `{"labels": [...]}`, toàn bộ tập |
| `POST /api/devices` | `devices.write` | Có thêm `equipmentId` tùy chọn, như trên |
| `GET /api/devices/{id}` | `devices.read` | Có thêm `labels` bên cạnh `device` và `tags` |

Mọi vai trò đều có `equipment.read`: mọi thứ ở đâu là điều mà địa điểm và khu vực của một thiết bị vốn đã cho người xem biết. Chỉ quản trị viên có `equipment.write`, vì đổi tên hoặc di chuyển một nút sẽ ghi lại địa điểm, khu vực và dây chuyền của mọi thiết bị bên dưới, và đó là cấu hình.

Mọi thay đổi đều vào nhật ký hệ thống, danh mục `config`, chủ đề `equipment:<id>` hoặc `label:<label_id>`.

## MCP

`list_devices` và `describe_device` trả lời từ văn bản, như trước nay, và đầu ra của chúng không đổi. Một bài kiểm thử cố định nó từng byte theo những gì phiên bản trước khi có cây đã trả lời, rồi sắp xếp lại cây quanh thiết bị (một doanh nghiệp phía trên địa điểm của nó, một ô dưới dây chuyền của nó, một nhãn) và kiểm tra rằng không có gì mà tác tử nhìn thấy bị xê dịch. Khi cây thật sự đổi văn bản, chẳng hạn do đổi tên, tác tử thấy văn bản mới, y như khi ai đó nhập nó vào thiết bị. `list_entities` là nơi tác tử nhìn thấy cây: nó lọc theo một nút và mọi thứ bên dưới, và cho biết vị trí của từng thực thể. Xem [MCP](/vi/iot/mcp/#thực-thể).

## Sao lưu và khôi phục

`equipment`, `labels`, `entity_labels` và `device_labels` nằm trong bản sao lưu, các cột `equipment_id` mới cũng vậy. `equipment` tham chiếu chính nó (`parent_id`), điều mà một lần khôi phục không thể sắp thứ tự: sau khi một nút được di chuyển, nút cha rất dễ được lưu sau nút con của nó. Ràng buộc là `DEFERRABLE INITIALLY DEFERRED`, nên nó được kiểm tra khi lần khôi phục commit, khi mọi dòng đã vào, và điều tương tự áp dụng cho bất cứ thứ gì ghi lại cây bằng nhiều hơn một câu lệnh. Bài kiểm thử bảo vệ sao lưu chỉ cho phép một bảng tham chiếu chính nó khi ràng buộc đó được hoãn, và bài kiểm thử đi và về cố ý lưu một nút con trước nút cha của nó.

Một bản sao lưu được tạo trước phiên bản này vẫn khôi phục được. Các tệp `devices` và `entities` của nó ít hơn một cột; lần khôi phục nạp chúng vào các cột đầu của bảng (cột mới luôn được thêm vào cuối) và cột mới nhận giá trị mặc định. Rồi, trong cùng giao dịch, nó đặt mọi thiết bị được khôi phục vào cây theo văn bản của chúng, như bản nâng cấp sẽ làm.

## Màn hình Nhà máy

Cây nằm bên cạnh, với một thẻ cho nút được chọn: đường dẫn của nó, các thiết bị trên nó, các thực thể đặt trên nó và những gì bên dưới. Quản trị viên có thể thêm một nút ở gốc hoặc dưới nút đang chọn, đổi tên, đổi cấp, di chuyển, xóa, đặt một thiết bị lên nó hoặc gỡ một thiết bị ra, và đặt nhãn cho thiết bị. Danh sách cấp chỉ đưa ra các cấp mà quy tắc cho phép, cả với nút cha lẫn với các nút con đã có bên dưới, và việc di chuyển chỉ đưa ra các nút cha mà một nút ở cấp đó có thể nằm dưới, không bao giờ là chính nút đó hay bất cứ thứ gì bên dưới nó. Máy chủ kiểm tra lại tất cả, và một lời từ chối (chẳng hạn xóa khi còn thứ gì bên dưới) được hiển thị đúng như nó viết. Di chuyển một thiết bị là cùng một lần lưu mà trình chỉnh sửa thiết bị thực hiện, với một `equipmentId`, nên văn bản đi theo cây như mô tả ở trên.

Nhãn được quản lý ở cuối màn hình: một tên, một màu và một mô tả, với `label_id` được chọn một lần và cố định. Thực thể nhận vị trí và nhãn từ ngăn kéo của chúng trên màn hình Thực thể.

Mọi người khác thấy cùng màn hình đó mà không có gì để nhấn.
