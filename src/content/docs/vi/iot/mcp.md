---
title: "MCP cho tác tử"
description: "Cho phép một tác tử đọc toàn bộ nhà máy và chỉ chạm vào những gì bạn đã kích hoạt, qua cổng ghi, với lý do nêu rõ được ghi lại bên cạnh mỗi lần ghi."
---

Gateway nói MCP theo cả hai chiều: tác tử có thể đọc và điều khiển nhà máy, và một quy tắc tự động hóa có thể gọi một công cụ ở nơi khác.

Quy tắc thiết kế là **một tác tử là một bên gọi như mọi bên gọi khác**. Các công cụ đọc qua cùng bộ nhớ đệm mà giao diện đọc và ghi qua cùng cổng mà giao diện ghi. Không có đường đặc quyền, không có lối vòng, không có chính sách riêng. Một lần ghi mà người vận hành sẽ bị từ chối thì bị từ chối; một lần ghi thành công rơi vào cùng bảng kiểm toán với `mcp:` đứng trước tác nhân.

## Cung cấp

### Qua HTTP

Bật theo mặc định tại `/mcp` trên cổng của ứng dụng, được bảo vệ bằng bearer token mà chart tạo ra trong Secret của release.

```bash
kubectl -n hotloop get secret <release> \
  -o jsonpath='{.data.mcp-token}' | base64 -d
```

Trong cụm, điểm cuối là:

```
http://<release>.<namespace>.svc.cluster.local:8080/mcp
```

Việc kiểm tra token nằm trước bộ xử lý, nên một bên gọi chưa xác thực thậm chí không thể liệt kê những gì tồn tại. Để trống `mcp.token` thì chart tạo một cái, nên bản triển khai mặc định không phải là bản mở một cách vô tình. Hãy kết hợp nó với NetworkPolicy; token là tuyến phòng thủ thứ hai, không phải duy nhất.

Điểm cuối không bao giờ mở. Chạy tệp nhị phân không có `HOTLOOP_MCP_TOKEN` (một unit Quadlet, một `hotloop` trần) và nó tạo một token ở lần khởi động đầu tiên rồi giữ trong cơ sở dữ liệu của nó, nên cùng token đó quay lại sau khi khởi động lại, trên mọi bản sao và sau khi khôi phục. `hotloop mcp-token` in nó ra (nhật ký nói rằng nó đã tạo một cái, và không bao giờ nói đó là gì). Đặt `HOTLOOP_MCP_TOKEN` để chọn token của riêng bạn; khi đặt `HOTLOOP_MCP_OIDC_*`, điểm cuối nhận đăng nhập và không giữ token riêng. Một máy khách trước đây kết nối với tệp nhị phân trần mà không có gì giờ nhận `401` cho đến khi nó gửi `Authorization: Bearer <that token>`.

### Với đăng nhập Vord hoặc khẳng định từ hub

Token tĩnh cho biết máy khách nào đã gọi; nó không thể cho biết người nào. Khi đặt OIDC, `/mcp` cũng nhận `Authorization: Bearer <jwt>`, và email của người đã xác minh trở thành tác nhân kiểm toán: một lần ghi được ghi nhận là `mcp:pat@example.com` thay vì `mcp:<client name>`. Hành vi khi không đặt nó không đổi, và token tĩnh vẫn hoạt động bên cạnh (khi không đặt token tĩnh, chỉ JWT đã xác minh mới vào được).

| Biến | Giá trị chart | Tác dụng |
|---|---|---|
| `HOTLOOP_MCP_OIDC_ISSUER` | `mcp.oidc.issuer` | URL realm của Vord; nhận các token truy cập của nó |
| `HOTLOOP_MCP_OIDC_AUDIENCE` | `mcp.oidc.audience` | `aud` mà mọi token phải mang; bắt buộc với một trong hai biến này |
| `HOTLOOP_MCP_OIDC_HUB_JWKS_URL` | `mcp.oidc.hubJwksUrl` | các khóa khẳng định của hub danh tính; nhận các khẳng định của nó |
| `HOTLOOP_MCP_OIDC_REQUIRED_ROLE` | `mcp.oidc.requiredRole` | một vai trò realm mà bên gọi phải có |
| `HOTLOOP_MCP_OIDC_WRITE_ROLE` | `mcp.oidc.writeRole` | giới hạn việc ghi theo từng bên gọi, xem bên dưới |

Token truy cập của Vord được kiểm tra với JWKS của bên phát hành (tìm qua tài liệu khám phá của nó, lưu đệm mười phút, tải lại khi gặp `kid` lạ): chỉ RS256 hoặc ES256, `iss` bằng bên phát hành, `aud` chứa audience, `exp` và `nbf` với độ lệch 30 s, và một claim `email` (hoặc `preferred_username`). Theo mặc định Vord chỉ đặt `account` vào `aud`; hãy cấp cho client scope một audience mapper cho audience bạn đặt.

Khẳng định từ hub là `typ` `fb-assert+jwt`, EdDSA, `iss` `fireball-hub`, `aud` là audience đã cấu hình (module Hub gửi `hotloop`), chưa hết hạn, được ký bằng một khóa trong JWKS của Hub. Không có bộ nhớ đệm chống phát lại `jti`: một lần gọi công cụ là nhiều yêu cầu HTTP (initialize, rồi lần gọi) mang cùng một khẳng định, tồn tại 60 s. Khi Hub nói lần gọi hành động thay cho người khác (`acting_as`), tác nhân hiển thị là `mcp:<email> for <acting_as email>`.

Việc ghi vẫn cần `HOTLOOP_ALLOW_WRITES`, công tắc tổng; token không bao giờ mở rộng nó. `HOTLOOP_MCP_OIDC_WRITE_ROLE` thu hẹp việc ghi theo từng bên gọi: `hotloop:hotloop.write` nghĩa là vai trò client Vord `hotloop.write` trên client `hotloop` (`resource_access.hotloop.roles`), một tên trần nghĩa là vai trò realm, và khẳng định từ Hub phải mang tên vai trò trong `abilities`. Một bên gọi không có nó có thể đọc, nhưng `write_tag`, `call_service`, `run_script`, `apply_recipe`, `trigger_automation` và mọi công cụ thay đổi cấu hình đều từ chối. Token tĩnh không bị nó giới hạn.

### Qua stdio

Cùng tệp nhị phân phục vụ MCP trên stdin và stdout với `--mcp-stdio`, cho máy khách khởi chạy nó trực tiếp. Mọi thứ khác cũng khởi động, nên tác tử thấy một nhà máy sống chứ không phải một máy chủ rỗng.

```json
{
  "mcpServers": {
    "hotloop": {
      "command": "/usr/local/bin/hotloop",
      "args": ["--mcp-stdio"],
      "env": {
        "HOTLOOP_DB_HOST": "timescale.plant.local",
        "HOTLOOP_DB_PASSWORD": "…"
      }
    }
  }
}
```

Ở chế độ stdio, mọi nhật ký đi tới stderr. Bất cứ thứ gì ghi ra stdout sẽ làm hỏng luồng giao thức.

## Công cụ

Một trăm bảy mươi mốt: hai mươi bảy công cụ đọc nhà máy và ra lệnh cho nó, sáu mươi chín công cụ thay đổi cấu hình của nó ([bên dưới](#thay-đổi-cấu-hình)), ba mươi ba lần đọc và chạy thử đi kèm ([bên dưới](#đọc-và-chạy-thử)) và bốn mươi hai công cụ quản trị ([bên dưới](#quản-trị)).

| Công cụ | Làm gì |
|---|---|
| `get_plant_status` | thiết bị trực tuyến, báo động tồn đọng, việc ghi có được bật không |
| `list_devices` | mọi thiết bị với giao thức, địa chỉ, trạng thái, số lượng tag |
| `describe_device` | một thiết bị chi tiết, với các tag và thống kê thăm dò |
| `list_tags` | tìm trong danh mục theo thiết bị, tên hoặc mô tả |
| `read_tag` | giá trị hiện tại, kèm chất lượng |
| `query_history` | các lần đọc lịch sử, thô hoặc theo nhóm |
| `write_tag` | **ra lệnh cho một tag** |
| `list_alarms` | báo động và các trạng thái ISA-18.2 của chúng |
| `ack_alarm` | xác nhận thay mặt một người vận hành |
| `list_automations` | quy tắc, số lần chạy, kết quả cuối |
| `trigger_automation` | chạy một quy tắc ngay bây giờ |
| `describe_protocol` | bản dựng này thực sự nói những gì |
| `recent_events` | nhật ký hệ thống, để suy ra điều gì đã xảy ra theo thứ tự nào |
| `list_entities` | tìm thực thể theo miền, nút thiết bị hoặc nhãn, kèm các dịch vụ mà mỗi thực thể nhận |
| `get_states` | trạng thái hiện tại của một hoặc nhiều thực thể, kèm chất lượng và thuộc tính |
| `call_service` | **ra lệnh cho một thực thể**: `switch.turn_on`, `number.set_value` |
| `get_logbook` | một dòng thời gian duy nhất về thay đổi trạng thái, lần ghi, báo động, lần chạy và thay đổi cấu hình, theo thực thể, nút thiết bị, tác nhân hoặc loại |
| `list_scripts` | các script của nhà máy, các trường mỗi script nhận, nó có đang chạy không, lần chạy cuối |
| `run_script` | **chạy một script**, hoặc hỏi bằng `dryRun` xem ngay lúc này nó sẽ làm gì |
| `list_recipes` | các công thức của nhà máy: mục tiêu theo thứ tự, tham số, điều kiện tiên quyết, phiên bản, lần áp dụng cuối |
| `validate_recipe` | công thức có được áp dụng ngay bây giờ không? mọi lý do nó sẽ bị từ chối; không ghi gì cả |
| `apply_recipe` | **áp dụng một công thức**: kiểm tra toàn bộ, ghi theo thứ tự, đọc lại |
| `list_blueprints` | các blueprint mà mọi người điền để tạo quy tắc, đầu vào và phiên bản của chúng |
| `preview_blueprint` | quy tắc mà một blueprint sẽ tạo với các đầu vào đã cho, và nó sẽ làm gì ngay bây giờ; không tạo gì cả |
| `find_network_client` | một thiết bị ở đâu trên mạng nhà máy: cổng switch của nó, cổng có liên kết không, lần cuối bảng điều khiển UniFi thấy nó |
| `get_network_topology` | mạng nhà máy như bảng điều khiển UniFi vẽ: cái gì cắm vào cái gì, trạng thái của từng thiết bị, và các thiết bị HotLoop mất mạng nếu nó sập |
| `get_network_events` | các sự kiện mới nhất mà một bảng điều khiển UniFi đã báo cáo, và websocket sự kiện của nó có đang sống không |

### Thực thể

Thực thể là thứ mà mọi người gọi một vật trong nhà máy, `sensor.zone_1_temperature` hay `switch.conveyor_run`, bao bọc một hoặc nhiều tag. Xem [Thực thể](/vi/iot/entities/). Với tác tử, chúng thường là tay nắm tốt hơn: cái tên có nghĩa, và thực thể biết có thể làm gì với nó.

`list_entities` lọc theo `domain`, theo `equipment` (một nút của cây thiết bị theo id, tên hoặc đường dẫn các tên như `Plant A/Packing`, khớp mọi thứ ở nút đó hoặc bên dưới, vị trí riêng của thực thể thắng vị trí của thiết bị nó), theo `label` (label_id hoặc tên; thực thể khớp nếu nó mang nhãn hoặc thiết bị của nó mang) và theo `query`, một chuỗi con của entity_id hoặc tên. Mỗi kết quả mang trạng thái và chất lượng hiện tại cùng các dịch vụ nó nhận, dưới dạng `domain.service`. Thực thể không có dịch vụ là chỉ đọc. Các dịch vụ đến từ lớp thực thể, nên một miền có thêm dịch vụ ở đó sẽ xuất hiện ở đây mà không cần thay đổi.

`get_states` nhận `entity_ids` và trả lời cho từng cái bằng trạng thái, chất lượng, thuộc tính và `last_changed`. Nó giữ cùng một ranh giới như `read_tag`: một trạng thái `unknown` hoặc `unavailable` được trả lời bằng ghi chú rằng nó không phải một giá trị, một thực thể bị vô hiệu hóa nói rằng nó bị vô hiệu hóa thay vì thiếu, và chất lượng xấu được nêu rõ.

`call_service` nhận `domain`, `service`, `entity_id`, `data` và một `reason` **bắt buộc**:

```
> call_service domain=number service=set_value entity_id=number.press_01_sp
    data={"value": 212.5} reason="operator asked for 212.5 on zone 1"
Called number.set_value on number.press_01_sp (was 210). Writes: 212.5 to press-01/Setpoint: written
```

Nó đi qua `entity.Services`, cùng bộ thực thi mà `POST /api/services/...` dùng, biến lần gọi thành các lần ghi qua cổng ghi. Xem [Ghi](#ghi).

### Mạng

`find_network_client` trả lời câu hỏi đầu tiên về một PLC đã im lặng: là PLC, hay cổng switch của nó? Đưa cho nó `deviceId` và nó đi theo liên kết đã xác nhận của thiết bị đó tới máy khách UniFi của nó; đưa cho nó `query` (một MAC, một IP hoặc một phần tên) và nó tìm trong mọi bảng điều khiển mà HotLoop đọc. Nó đọc lần đọc cuối của trình điều khiển UniFi, không bao giờ đọc bảng điều khiển, nên một tác tử hỏi trong vòng lặp không tốn gì của bảng điều khiển. Điều đó cũng có nghĩa là một trình hỗ trợ `--mcp-stdio` trả lời rằng không có bảng điều khiển nào được đọc trong tiến trình của nó: nó không bao giờ đăng nhập vào cái nào, vì Gateway bên cạnh đã giữ phiên. Hãy hỏi điểm cuối của Gateway. Xem [UniFi Network](/vi/iot/unifi/).

`get_network_topology` là bản đồ: mỗi switch, điểm truy cập và gateway nằm dưới cái mà nó cắm vào, với cổng ở cả hai đầu, liên kết, có bao nhiêu máy khách trên nó và các thiết bị HotLoop được liên kết với một máy khách bên dưới. Phần cuối cùng đó là bán kính ảnh hưởng: nó nêu tên các PLC mất mạng nếu switch đó sập. Một switch mà bảng điều khiển liệt kê là không cắm vào đâu thì nói như vậy và không bị treo vào gateway. `get_network_events` là các sự kiện mới nhất của bảng điều khiển, mới nhất trước, với câu riêng của nó, cờ cảnh báo ở chỗ bảng điều khiển gọi là tiêu cực, và websocket sự kiện có đang sống không. Cả hai nhận `deviceId` của bảng điều khiển, có thể bỏ qua khi HotLoop chỉ đọc một cái, và cả hai đọc lần đọc cuối của trình điều khiển như `find_network_client`, nên không tốn gì của bảng điều khiển và nói điều tương tự trong trình hỗ trợ `--mcp-stdio`: không có bảng điều khiển nào được đọc trong tiến trình đó. Các sự kiện cũ hơn nằm trong `get_logbook`, được xếp dưới switch hoặc điểm truy cập mà chúng liên quan.

### Sổ nhật ký

`get_logbook` là dòng thời gian mà `GET /api/logbook` phục vụ (xem [Sổ nhật ký](/vi/iot/logbook/)): thay đổi trạng thái, lần ghi, chuyển trạng thái báo động, lần chạy tự động hóa và thay đổi cấu hình, mới nhất trước. Nó thu hẹp theo `entity`, theo `equipment` (id, tên hoặc đường dẫn, và mọi thứ bên dưới; một tên khớp hai nút là lỗi liệt kê cả hai), theo `actor` (một phần của nó: `mcp:` tìm mọi thứ bất kỳ tác tử nào đã làm), theo `kinds`, và theo `minutes` lùi lại (mặc định một ngày). Một trang còn nữa phía sau kết thúc bằng việc nói cần truyền gì làm `before` cho trang kế tiếp. Với "chuyện gì đã xảy ra trước khi việc này hỏng" thì nó là `recent_events` tốt hơn: các thay đổi trạng thái riêng của thiết bị nằm trong đó, và các dòng của cổng ghi không xuất hiện hai lần.

### Script

Script là một chuỗi các bước có tên mà ai đó đã viết một lần, chu trình CIP hay xả đường ống, để tác tử chạy quy trình riêng của nhà máy thay vì bịa ra một cái. Xem [Script](/vi/iot/scripts/). `list_scripts` cho biết mỗi cái nhận gì. `run_script` nhận `scriptId`, `fields`, một `reason` **bắt buộc**, và hai công tắc:

- `dryRun: true` đi qua script đối chiếu với nhà máy như hiện có và nói, từng bước, điều gì sẽ được ghi và điều đầu tiên cổng sẽ từ chối, bằng lời của cổng. Không có gì được ghi hay kiểm toán. Hãy hỏi điều này trước.
- `wait: true` trả lời khi lần chạy đã kết thúc, với kết quả và dấu vết của nó. Không có nó, câu trả lời là id lần chạy, và `list_scripts` hoặc `get_logbook` với `kinds: ["script"]` cho biết nó kết thúc ra sao.

Lần chạy là của script, dưới dạng `script:<id>`, với nguồn `mcp`, nên mọi lần ghi nó thực hiện gặp cổng đúng như `write_tag`. Khi việc ghi bị tắt (`HOTLOOP_ALLOW_WRITES`), `run_script` từ chối trước khi có gì chạy, như `trigger_automation` làm; chạy thử vẫn được trả lời, và nói rằng công tắc là lý do.

### Công thức

Công thức là một tập giá trị đặt mà nhà máy áp dụng cùng nhau, một cấp sản phẩm hay một lần chuyển đổi, để tác tử nạp các con số riêng của nhà máy thay vì ghi từng cái. Xem [Công thức](/vi/iot/recipes/). `list_recipes` hiển thị các mục tiêu của mỗi công thức theo thứ tự và các tham số nó nhận. `validate_recipe` hỏi liệu một công thức có được áp dụng ngay bây giờ không và đưa ra mọi lý do nó sẽ không, mà không ghi gì. `apply_recipe` nhận `recipeId`, `params`, `version` tùy chọn và một `reason` **bắt buộc**.

Trước hết nó được kiểm tra toàn bộ và bị từ chối toàn bộ, không ghi gì, nếu có giá trị nào sẽ bị từ chối; giá trị ngoài phạm vi bị từ chối, không bao giờ được điều chỉnh. Sau đó các mục tiêu đi ra theo thứ tự dưới một id cuộc gọi, mục tiêu đầu tiên thất bại sẽ dừng phần còn lại, và không có gì được hoàn tác. Câu trả lời nói, từng mục tiêu một, điều gì đã đi ra và thiết bị có đọc lại giá trị không. Các lần ghi là của tác tử, với nguồn `mcp`, nên cổng áp dụng cho từng lần; khi việc ghi bị tắt (`HOTLOOP_ALLOW_WRITES`), `apply_recipe` từ chối trước khi kiểm tra bất cứ gì. Một công thức nêu quyền áp dụng riêng của nó dành cho những người được cấp quyền, và tác tử không nằm trong số đó.

### Blueprint

Blueprint là một quy tắc viết một lần với các chỗ trống có kiểu: động cơ nào, bao lâu, giới hạn gì. Xem [Blueprint](/vi/iot/blueprints/). `list_blueprints` cho biết mỗi cái nhận gì. `preview_blueprint` nhận `blueprintId`, `automationId` và `inputs`, và trả lời bằng quy tắc nó sẽ tạo và điều quy tắc đó sẽ làm nếu kích hoạt ngay bây giờ, với mọi lần ghi đưa qua các kiểm tra của cổng. Các đầu vào được kiểm tra đúng như màn hình kiểm tra: ngoài phạm vi bị từ chối, không được điều chỉnh.

`instantiate_blueprint` tạo quy tắc, qua đường mà màn hình Blueprint dùng: cùng các kiểm tra, và quy tắc rơi vào sổ nhật ký với tác tử là người tạo ra nó. Một quy tắc là mệnh lệnh thường trực để ra lệnh cho thiết bị mỗi khi bộ kích hoạt của nó chạy, nên tác tử xem trước: `preview_blueprint` không lưu gì và không ghi gì, và được trả lời dù việc ghi bật hay không. Mọi lần ghi mà quy tắc đã tạo thực hiện sau đó gặp cổng ghi, như với quy tắc do một người tạo. Xem [Thay đổi cấu hình](#thay-đổi-cấu-hình).

## Thay đổi cấu hình

Mọi thứ tác tử có thể đọc, nó đều có thể thay đổi. Các công cụ ở trên đọc nhà máy có các đối tác thay đổi nó, sáu mươi chín cái, và không cái nào là bản triển khai thứ hai: mỗi cái là một route của REST API, và một lần gọi được chạy qua bộ xử lý riêng của route đó. Việc xác thực, kiểm tra quyền, nạp lại runtime và dòng kiểm toán là của route, với tác tử là tác nhân (`mcp:<client>`, hoặc `mcp:<email>` với đăng nhập Vord), nên một thiết bị không có trình điều khiển, một quy tắc không biên dịch được, một đầu vào blueprint ngoài phạm vi hoặc một tag mà thiết bị đã phát hiện chưa được chấp nhận đều bị từ chối bằng chính lời mà màn hình hiển thị, và không có gì bị thay đổi.

Mỗi cái nhận các giá trị đường dẫn của route theo tên (`id`, `device`, `name`...), `body`, cùng JSON mà API nhận ([HTTP API](/vi/iot/api/) có mọi body), và một `reason` **bắt buộc**. Lý do được ghi thành một dòng `config` trong nhật ký hệ thống bên cạnh dòng của chính route, gắn với đối tượng bị thay đổi.

```
> save_tag reason="the setpoint, writable between 0 and 100" body={"deviceId":"press-01",
    "name":"Setpoint","address":"holding:5:uint16","dataType":"int16","enabled":true,
    "writable":true,"hasRange":true,"minValue":0,"maxValue":100}
save_tag done.
{ ...the tag as stored... }
```

Cái đứng trước chúng là cái đứng trước `write_tag`, trừ công tắc tổng, vì các màn hình cũng không cần nó để thay đổi cấu hình:

1. `HOTLOOP_ALLOW_MCP_WRITES`, bật theo mặc định, phải được bật.
2. Bên gọi có đặt `HOTLOOP_MCP_OIDC_WRITE_ROLE` phải có nó.
3. Lần gọi mang một quyền, quyền mà route của nó yêu cầu (cột thứ ba bên dưới), và không gì khác. Một route trả lời một tác tử như trả lời một người không có quyền đó, và một bài kiểm thử buộc mọi hàng của bảng với một route thực và quyền mà route đó yêu cầu.
4. Một lý do.

Ra lệnh cho thiết bị vẫn là `write_tag`, `call_service`, `run_script`, `apply_recipe` và `trigger_automation` với `HOTLOOP_ALLOW_WRITES` bật và dấu có thể ghi cùng phạm vi của tag cần đáp ứng. Làm cho một tag, quy tắc, script hay công thức có thể ghi là cấu hình: nó không ra lệnh gì cho đến khi được dùng, và những gì nó ra lệnh khi đó đi qua cổng.

Các chức năng riêng của quản trị viên cũng là công cụ, trong phần [Quản trị](#quản-trị) bên dưới. Chấp nhận một thiết bị đã phát hiện nằm ở đây, như trên màn hình; các điểm trên đó vẫn phải được kích hoạt để ghi từng cái một.

Các công cụ cũng tồn tại trong `--mcp-stdio`: tiến trình dựng cùng máy chủ API và không bao giờ mở cổng của nó.

**Thiết bị và tag**

| Công cụ | Route | Quyền |
|---|---|---|
| `save_device` | `POST /api/devices` | `devices.write` |
| `delete_device` | `DELETE /api/devices/{id}` | `devices.write` |
| `set_device_enabled` | `POST /api/devices/{id}/enabled` | `devices.write` |
| `import_device_tags` | `POST /api/devices/{id}/import` | `tags.write` |
| `save_tag` | `POST /api/tags` | `tags.write` |
| `delete_tag` | `DELETE /api/tags/{device}/{name}` | `tags.write` |
| `set_device_labels` | `PUT /api/devices/{id}/labels` | `equipment.write` |
| `set_device_network` | `PUT /api/devices/{id}/network` | `devices.write` |
| `clear_device_network` | `DELETE /api/devices/{id}/network` | `devices.write` |

**Khám phá và broker**

| Công cụ | Route | Quyền |
|---|---|---|
| `accept_discovered_device` | `POST /api/discovery/{source}/{key}/accept` | `devices.write` |
| `ignore_discovered_device` | `POST /api/discovery/{source}/{key}/ignore` | `devices.write` |
| `unignore_discovered_device` | `POST /api/discovery/{source}/{key}/unignore` | `devices.write` |
| `apply_discovery_review` | `POST /api/discovery/{source}/{key}/review/apply` | `devices.write` |
| `reject_discovery_review` | `POST /api/discovery/{source}/{key}/review/reject` | `devices.write` |
| `accept_network_find` | `POST /api/network-discovery/{key}/accept` | `devices.write` |
| `ignore_network_find` | `POST /api/network-discovery/{key}/ignore` | `devices.write` |
| `unignore_network_find` | `POST /api/network-discovery/{key}/unignore` | `devices.write` |
| `probe_network` | `POST /api/network-discovery/probe` | `devices.write` |
| `create_mqtt_broker` | `POST /api/mqtt/brokers` | `devices.write` |
| `update_mqtt_broker` | `PUT /api/mqtt/brokers/{id}` | `devices.write` |
| `delete_mqtt_broker` | `DELETE /api/mqtt/brokers/{id}` | `devices.write` |
| `probe_integration` | `POST /api/integrations/{id}/probe` | `devices.write` |
| `setup_integration` | `POST /api/integrations/{id}/setup` | `devices.write` |

**UniFi**

| Công cụ | Route | Quyền |
|---|---|---|
| `mark_unifi_network_ot` | `PUT /api/unifi/{id}/networks/{network}` | `devices.write` |
| `accept_unifi_known_device` | `PUT /api/unifi/{id}/networks/{network}/known/{mac}` | `devices.write` |
| `forget_unifi_known_device` | `DELETE /api/unifi/{id}/networks/{network}/known/{mac}` | `devices.write` |
| `accept_all_unifi_known_devices` | `POST /api/unifi/{id}/networks/{network}/accept-all` | `devices.write` |
| `create_unifi_starter_alarms` | `POST /api/unifi/{id}/starter-alarms` | `alarms.write` |

**Thực thể, helper, thiết bị, nhãn**

| Công cụ | Route | Quyền |
|---|---|---|
| `create_entity` | `POST /api/entities` | `entities.write` |
| `update_entity` | `PUT /api/entities/{entity_id}` | `entities.write` |
| `delete_entity` | `DELETE /api/entities/{entity_id}` | `entities.write` |
| `create_energy_meter` | `POST /api/energy/meters` | `energy.write` |
| `update_energy_meter` | `PUT /api/energy/meters/{id}` | `energy.write` |
| `delete_energy_meter` | `DELETE /api/energy/meters/{id}` | `energy.write` |
| `create_helper` | `POST /api/helpers` | `entities.write` |
| `update_helper` | `PUT /api/helpers/{entity_id}` | `entities.write` |
| `delete_helper` | `DELETE /api/helpers/{entity_id}` | `entities.write` |
| `create_equipment` | `POST /api/equipment` | `equipment.write` |
| `update_equipment` | `PUT /api/equipment/{id}` | `equipment.write` |
| `delete_equipment` | `DELETE /api/equipment/{id}` | `equipment.write` |
| `create_label` | `POST /api/labels` | `equipment.write` |
| `update_label` | `PUT /api/labels/{label_id}` | `equipment.write` |
| `delete_label` | `DELETE /api/labels/{label_id}` | `equipment.write` |

**Báo động**

| Công cụ | Route | Quyền |
|---|---|---|
| `save_alarm` | `POST /api/alarms` | `alarms.write` |
| `delete_alarm` | `DELETE /api/alarms/{id}` | `alarms.write` |
| `shelve_alarm` | `POST /api/alarms/{id}/shelve` | `alarms.ack` |
| `unshelve_alarm` | `POST /api/alarms/{id}/unshelve` | `alarms.ack` |

**Tự động hóa và blueprint**

| Công cụ | Route | Quyền |
|---|---|---|
| `save_automation` | `POST /api/automations` | `automations.write` |
| `delete_automation` | `DELETE /api/automations/{id}` | `automations.write` |
| `set_automation_enabled` | `POST /api/automations/{id}/enabled` | `automations.write` |
| `upgrade_blueprint_automation` | `POST /api/automations/{id}/blueprint-upgrade` | `blueprints.apply` |
| `instantiate_blueprint` | `POST /api/blueprints/{id}/instantiate` | `blueprints.apply` |
| `create_blueprint` | `POST /api/blueprints` | `blueprints.write` |
| `update_blueprint` | `PUT /api/blueprints/{id}` | `blueprints.write` |
| `delete_blueprint` | `DELETE /api/blueprints/{id}` | `blueprints.write` |

**Script và công thức**

| Công cụ | Route | Quyền |
|---|---|---|
| `create_script` | `POST /api/scripts` | `scripts.write` |
| `update_script` | `PUT /api/scripts/{id}` | `scripts.write` |
| `delete_script` | `DELETE /api/scripts/{id}` | `scripts.write` |
| `stop_script` | `POST /api/scripts/{id}/stop` | `scripts.run` |
| `create_recipe` | `POST /api/recipes` | `recipes.write` |
| `capture_recipe` | `POST /api/recipes/capture` | `recipes.write` |
| `update_recipe` | `PUT /api/recipes/{id}` | `recipes.write` |
| `delete_recipe` | `DELETE /api/recipes/{id}` | `recipes.write` |

**Bảng điều khiển và bảng board**

| Công cụ | Route | Quyền |
|---|---|---|
| `create_dashboard` | `POST /api/dashboards` | `dashboards.write` |
| `update_dashboard` | `PUT /api/dashboards/{id}` | `dashboards.write` |
| `delete_dashboard` | `DELETE /api/dashboards/{id}` | `dashboards.write` |
| `save_board` | `PUT /api/board` | `board.write` |

**Nhập**

| Công cụ | Route | Quyền |
|---|---|---|
| `import_codesys_alarms` | `POST /api/alarms/import/codesys` | `alarms.write` |
| `screen_import` | `POST /api/dashboards/import` | `dashboards.write` |

`import_codesys_alarms` nhận tệp mà Export Alarms của CODESYS IDE đã ghi, dưới dạng `contentBase64` (các byte đúng như trên đĩa, mà IDE ghi bằng UTF-16) hoặc `content` (văn bản, nếu bạn có dưới dạng văn bản), với `deviceId` mà các báo động thuộc về và, nếu bạn muốn, `application` và `defaultPriority`. Để nguyên thì nó chỉ xem trước: nói báo động nào sẽ được đưa sang và cái nào không, không lưu gì và không cần lý do. Với `apply` true nó lưu chúng thành định nghĩa báo động, và khi đó nó cần lý do và công tắc ghi MCP như mọi công cụ thay đổi cấu hình.

`screen_export` trả lời một bảng điều khiển dưới dạng tệp màn hình HotLoop ([Tệp màn hình](/vi/iot/screen-file/)), và `screen_import` nhận một tệp, trên bản cài đặt này hoặc bản khác. Nó hỏi trước: `dryRun` là true trừ khi bạn nói false, và chạy thử không lưu gì và trả lời bằng báo cáo với mọi vấn đề được liệt kê và các tham chiếu cho `remap`. Một lần nhập thật cần `dryRun` false, một lý do và công tắc ghi MCP, và một id đã tồn tại bị từ chối trừ khi `replace` là true. Màn hình là dữ liệu của khách hàng, nên tệp là cách nó di chuyển giữa các bản cài đặt, không bao giờ là mã.

### Đọc và chạy thử

Một tác tử có thể thay đổi một bảng điều khiển, một broker hay một nút của cây thiết bị phải có thể đọc trước những gì đang có, nên mỗi đối tượng mà một công cụ ở trên thay đổi đều có một lần đọc ở đây, và các lần chạy thử của trình soạn thảo cũng là công cụ. Mỗi cái là một route chạy qua bộ xử lý riêng của nó với quyền đọc mà route đó yêu cầu. Một lần đọc trả lời không cần lý do và không cần công tắc ghi, và một bên gọi mà vai trò ghi loại trừ vẫn có thể thực hiện chúng, vì chúng mang quyền đọc và không gì hơn. Ba lần chạy thử (`validate_automation`, `validate_script` và `browse_device`) không thay đổi gì; hai cái kiểm tra một thân yêu cầu mang quyền ghi mà route của chúng yêu cầu, nên chúng nằm sau vai trò ghi.

| Công cụ | Route | Quyền |
|---|---|---|
| `list_alarm_definitions` | `GET /api/alarms` | `alarms.read` |
| `list_composite_entities` | `GET /api/entities/composites` | `entities.read` |
| `list_energy_meters` | `GET /api/energy/meters` | `energy.read` |
| `get_energy_meter` | `GET /api/energy/meters/{id}` | `energy.read` |
| `get_energy_summary` | `GET /api/energy/summary/{period}` | `energy.read` |
| `get_energy_series` | `GET /api/energy/series/{meter}/{period}/{step}` | `energy.read` |
| `list_alarm_events` | `GET /api/alarms/events` | `alarms.read` |
| `screen_export` | `GET /api/dashboards/{id}/export` | `dashboards.read` |
| `list_dashboards` | `GET /api/dashboards` | `dashboards.read` |
| `get_dashboard` | `GET /api/dashboards/{id}` | `dashboards.read` |
| `get_board` | `GET /api/board` | `values.read` |
| `list_equipment` | `GET /api/equipment` | `equipment.read` |
| `get_equipment` | `GET /api/equipment/{id}` | `equipment.read` |
| `list_labels` | `GET /api/labels` | `equipment.read` |
| `get_label` | `GET /api/labels/{label_id}` | `equipment.read` |
| `list_discovered_devices` | `GET /api/discovery` | `devices.read` |
| `get_discovered_device` | `GET /api/discovery/{source}/{key}` | `devices.read` |
| `list_network_finds` | `GET /api/network-discovery` | `devices.read` |
| `get_network_find` | `GET /api/network-discovery/{key}` | `devices.read` |
| `list_integrations` | `GET /api/integrations` | `devices.read` |
| `list_mqtt_brokers` | `GET /api/mqtt/brokers` | `devices.read` |
| `get_blueprint` | `GET /api/blueprints/{id}` | `blueprints.read` |
| `get_script` | `GET /api/scripts/{id}` | `scripts.read` |
| `list_automation_runs` | `GET /api/runs` | `automations.read` |
| `list_script_runs` | `GET /api/scripts/{id}/runs` | `scripts.read` |
| `list_unifi_consoles` | `GET /api/unifi/consoles` | `devices.read` |
| `list_unifi_networks` | `GET /api/unifi/{id}/networks` | `devices.read` |
| `list_unifi_known_devices` | `GET /api/unifi/{id}/known` | `devices.read` |
| `get_device_network` | `GET /api/devices/{id}/network` | `devices.read` |
| `get_diagnostics` | `GET /api/diagnostics` | `status.read` |
| `browse_device` | `POST /api/devices/{id}/browse` | `devices.read` |
| `validate_automation` | `POST /api/automations/validate` | `automations.write` |
| `validate_script` | `POST /api/scripts/validate` | `scripts.write` |

### Quản trị

Tài khoản người dùng, cài đặt, bản sao lưu, chính sách leo thang, đích của historian, đăng nhập broker, đội relay edge và báo cáo theo lịch là của quản trị viên, và chúng cũng là công cụ: bốn mươi hai cái, cùng mẫu với phần còn lại. Mỗi cái là một route chạy qua bộ xử lý riêng của nó với quyền mà route đó yêu cầu (`users.manage`, `settings.write`, `backup.run`, `fleet.restart`...), một lý do cho mỗi thay đổi và tác tử trong dòng kiểm toán. Một route từ chối thì từ chối tác tử bằng cùng lời. Các lần đọc (các công cụ `list_` và `get_`) không cần lý do và không cần công tắc ghi, và vẫn cần vai trò ghi của bên gọi khi có đặt, vì quyền chúng mang là quyền quản trị viên. Các công cụ đội relay và báo cáo chỉ tồn tại trong sản phẩm có tính năng đó.

Hai điều là của riêng các route và đáng biết trước khi tin cậy một công cụ:

- **Các công tắc ghi không có route.** `safety.allowWrites` và `safety.allowMcpWrites` thuộc về bản triển khai (`HOTLOOP_ALLOW_WRITES`, `HOTLOOP_ALLOW_MCP_WRITES`), và `PUT /api/settings` từ chối chúng vì do bản triển khai đặt. Vì vậy `save_settings` thay đổi những gì màn hình Cài đặt có thể thay đổi và trả lời lời từ chối đó cho các công tắc, bằng chính lời ấy. Một tác tử không thể bật công tắc mà các lần ghi của chính nó đang chờ.
- **Mật khẩu của người dùng đi qua lần gọi.** `create_user`, `reset_user_password` và các công cụ PIN nhận một bí mật trong đối số của chúng, như API. Dòng kiểm toán nêu thay đổi và lý do và không bao giờ nêu bí mật.

**Tài khoản người dùng**

| Công cụ | Route | Quyền |
|---|---|---|
| `list_users` | `GET /api/users` | `users.manage` |
| `create_user` | `POST /api/users` | `users.manage` |
| `update_user` | `PUT /api/users/{username}` | `users.manage` |
| `delete_user` | `DELETE /api/users/{username}` | `users.manage` |
| `reset_user_password` | `POST /api/users/{username}/password` | `users.manage` |
| `unlock_user` | `DELETE /api/users/{username}/lockout` | `users.manage` |
| `set_user_pin` | `PUT /api/users/{username}/pin` | `users.manage` |
| `clear_user_pin` | `DELETE /api/users/{username}/pin` | `users.manage` |
| `list_opcua_certificates` | `GET /api/opcua/certificates` | `users.manage` |
| `list_user_certificates` | `GET /api/users/{username}/certificates` | `users.manage` |
| `add_user_certificate` | `POST /api/users/{username}/certificates` | `users.manage` |
| `revoke_user_certificate` | `POST /api/users/{username}/certificates/{thumbprint}/revoke` | `users.manage` |
| `delete_user_certificate` | `DELETE /api/users/{username}/certificates/{thumbprint}` | `users.manage` |

**Cài đặt, bản sao lưu, thông báo**

| Công cụ | Route | Quyền |
|---|---|---|
| `get_settings` | `GET /api/settings` | `settings.read` |
| `save_settings` | `PUT /api/settings` | `settings.write` |
| `list_backups` | `GET /api/backup` | `backup.read` |
| `run_backup` | `POST /api/backup` | `backup.run` |
| `get_escalation` | `GET /api/notify/escalation` | `notify.escalation` |
| `save_escalation` | `PUT /api/notify/escalation` | `notify.escalation` |
| `send_test_notification` | `POST /api/notify/test` | `notify.test` |

**Đích của historian và đăng nhập broker**

| Công cụ | Route | Quyền |
|---|---|---|
| `list_historian_targets` | `GET /api/historian/targets` | `settings.read` |
| `create_historian_target` | `POST /api/historian/targets` | `settings.write` |
| `update_historian_target` | `PUT /api/historian/targets/{id}` | `settings.write` |
| `delete_historian_target` | `DELETE /api/historian/targets/{id}` | `settings.write` |
| `list_broker_logins` | `GET /api/broker/logins` | `users.manage` |
| `create_broker_login` | `POST /api/broker/logins` | `users.manage` |
| `update_broker_login` | `PUT /api/broker/logins/{name}` | `users.manage` |
| `delete_broker_login` | `DELETE /api/broker/logins/{name}` | `users.manage` |

**Đội relay edge (Gateway)**

| Công cụ | Route | Quyền |
|---|---|---|
| `list_fleet` | `GET /api/fleet` | `fleet.read` |
| `register_relay` | `POST /api/fleet` | `fleet.write` |
| `delete_relay` | `DELETE /api/fleet/{id}` | `fleet.write` |
| `rebirth_relay` | `POST /api/fleet/{id}/rebirth` | `fleet.rebirth` |
| `restart_relay` | `POST /api/fleet/{id}/restart` | `fleet.restart` |
| `update_relay` | `POST /api/fleet/{id}/update` | `fleet.update` |
| `set_relay_config` | `POST /api/fleet/{id}/config` | `fleet.config` |
| `clear_relay_config` | `DELETE /api/fleet/{id}/config` | `fleet.config` |

**Báo cáo theo lịch (Gateway)**

| Công cụ | Route | Quyền |
|---|---|---|
| `list_reports` | `GET /api/reports` | `reports.read` |
| `get_report` | `GET /api/reports/{id}` | `reports.read` |
| `create_report` | `POST /api/reports` | `reports.write` |
| `update_report` | `PUT /api/reports/{id}` | `reports.write` |
| `delete_report` | `DELETE /api/reports/{id}` | `reports.write` |
| `run_report` | `POST /api/reports/{id}/run` | `reports.run` |

## Tài nguyên

| URI | Nội dung |
|---|---|
| `iiot://devices` | cây thiết bị với các tag, dưới dạng JSON |
| `iiot://tags` | danh mục tag với giá trị hiện tại |
| `iiot://alarms` | định nghĩa báo động, trạng thái trực tiếp và một tham chiếu trạng thái |
| `iiot://protocols` | các giao thức được hỗ trợ, từ các trình điều khiển đã biên dịch sẵn |

Tài nguyên tồn tại để một máy khách có thể kéo toàn bộ không gian tên bằng một lần đọc thay vì khám phá nó từng lần gọi công cụ.

## Những gì các công cụ sẽ không làm

Các công cụ được viết để một mô hình không thể vô tình làm tròn sự không chắc chắn.

**Một tag không có lần đọc không phải là tag đọc ra không.** `read_tag` nói `no reading has been taken for this tag yet`, hoặc `this tag is not configured` nếu nó không tồn tại. Không cái nào trả về giá trị.

**Chất lượng xấu được nêu rõ, không được ngụ ý.** Các lần đọc trả về dưới dạng `[quality: bad (the value is NOT known; do not treat it as a measurement)]`. Hướng dẫn của máy chủ lặp lại điều đó. Đừng lấy trung bình các lần đọc xấu và đừng báo cáo một lần đọc xấu như một phép đo.

**`describe_protocol` không thể nói dối.** Khả năng sẵn có đến từ các trình điều khiển biên dịch vào tệp nhị phân, nên công cụ không thể tuyên bố một giao thức mà gateway không có.

**Một lời từ chối là một câu trả lời, không phải lỗi truyền tải.** Một lần ghi bị từ chối trả về dưới dạng kết quả công cụ với `isError`, nghĩa là lần gọi được hình thành đúng và bị từ chối có chủ ý. Đó không phải là lỗi giao thức cần thử lại.

## Ghi

MCP đọc và ghi: nó ra lệnh cho thiết bị và thay đổi cấu hình ([ở trên](#thay-đổi-cấu-hình)). `write_tag` di chuyển thiết bị thật, nên cùng những thứ đứng giữa cú nhấp của người vận hành và máy móc cũng đứng giữa lần gọi công cụ và máy móc:

1. `HOTLOOP_ALLOW_WRITES`, công tắc tổng cho toàn bộ bản triển khai, phải được bật. Khi nó tắt, không có gì ghi: không phải giao diện, không phải API, không phải tác tử.
2. Tag phải được đánh dấu có thể ghi. Các tag chỉ đọc cho đến khi ai đó nói khác đi, từng cái một.
3. Giá trị phải nằm trong phạm vi đã cấu hình của tag. Nó bị **từ chối, không bị cắt gọn**: gửi 400 khi có người yêu cầu 500 là lặng lẽ làm điều khác với điều được yêu cầu.

Một **lý do là bắt buộc** và được ghi bên cạnh lần ghi. Một dòng kiểm toán mà sáu tháng sau không ai diễn giải được thì hầu như không hơn gì không có.

`call_service` nhận đúng ba điều đó, vì nó chẳng là gì ngoài các lần ghi qua cùng cổng, rồi thêm các kiểm tra riêng của thực thể bên trên (bước và phạm vi hẹp hơn của một số, mẫu của một văn bản, thực thể không bị vô hiệu hóa). Một lời từ chối ở bất kỳ đâu trong số đó được kiểm toán đối với thực thể cũng như tag: nguồn `mcp`, máy khách theo tên, entity_id, dịch vụ và id cuộc gọi, cùng dòng mà một `write_tag` bị từ chối để lại cộng thêm thực thể. Một lần gọi không có lý do bị từ chối trước khi có gì được thử, như `write_tag`.

`trigger_automation` được chặn giống hệt, vì các hành động của một quy tắc có thể ra lệnh cho thiết bị; nếu không nó sẽ là cách đi vòng các kiểm tra mà `write_tag` gặp.

```
> write_tag tag=press-01/Zone1_Temp value=99 reason="testing"
write refused: press-01/Zone1_Temp: this tag is not marked writable
```

Khi việc ghi bị tắt, hướng dẫn của máy chủ nói điều đó ngay từ đầu, để tác tử không phí một lượt để phát hiện ra.

## Gọi ra ngoài

Hành động `mcp_call` của một tự động hóa gọi một công cụ trên máy chủ MCP khác. Cấu hình các máy chủ trong chart:

```yaml
mcp:
  outboundServers:
    - name: maintenance
      url: http://maintenance-mcp.default.svc.cluster.local:8080/mcp
      existingSecret: maintenance-mcp-token
      secretKey: token
```

Các phiên được gom vào pool và dùng lại; kết nối ở mỗi lần gọi sẽ nghĩa là một lần bắt tay, một initialize và một danh sách công cụ mỗi khi một quy tắc kích hoạt. Một phiên đã chết được kết nối lại ở lần gọi kế tiếp thay vì theo bộ đếm giờ, vì lần gọi kế tiếp là thời điểm đầu tiên có người quan tâm. Một máy chủ đã cấu hình bị sập không làm nhà máy ngừng được giám sát, không có gì được quay số cho đến khi một quy tắc cần.

Màn hình MCP hiển thị từng máy chủ đã cấu hình, nó có kết nối không và các công cụ nó quảng bá.

## Liên hợp các địa điểm

Một gateway cho mỗi nhà máy là cách điều này được thiết kế để chạy. Mỗi địa điểm giữ cơ sở dữ liệu riêng, bảng board riêng và tên riêng, và không cái nào phụ thuộc vào việc một liên kết tới nơi khác còn hoạt động, một nhà máy không ngừng được giám sát vì WAN bị đứt.

Xem tất cả cùng lúc dùng giao thức mà các địa điểm đã nói sẵn. Cấu hình một gateway trên đám mây với các địa điểm là máy chủ MCP đi ra, đúng như với hành động `mcp_call`:

```
HOTLOOP_MCP_SERVER_1_NAME=akron
HOTLOOP_MCP_SERVER_1_URL=https://akron.example/mcp
HOTLOOP_MCP_SERVER_1_TOKEN=…
HOTLOOP_MCP_SERVER_2_NAME=ashtabula
HOTLOOP_MCP_SERVER_2_URL=https://ashtabula.example/mcp
HOTLOOP_MCP_SERVER_2_TOKEN=…
```

Màn hình Địa điểm sau đó gọi `get_plant_status` trên từng cái song song và tổng hợp các câu trả lời. Không có gì để triển khai tại một địa điểm để nó xuất hiện, không địa điểm nào cần biết nó được liên hợp, và không có gì kết nối vào bên trong mạng nhà máy.

Hai hành vi là có chủ ý và đáng tin cậy:

- Một địa điểm không trả lời được hiển thị là **không thể tiếp cận, kèm lý do**, và bị để ngoài phần tổng hợp. Đếm một nhà máy bạn không thể tiếp cận là không có báo động là điều tệ nhất mà một màn hình như thế này có thể làm.
- Các con số mà một địa điểm báo cáo lần cuối không bao giờ được hiển thị. Chúng trông như hiện tại và không phải vậy.

Mỗi địa điểm có thời hạn ngắn riêng, nên một nhà máy trên liên kết chết không thể giữ chân những nhà máy đang hoạt động.

## Đáng nói với một tác tử

Hướng dẫn riêng của máy chủ bao quát điều này, nhưng dành cho ai viết một prompt xung quanh nó:

- Trạng thái báo động theo ISA-18.2. `rtn-unack` nghĩa là một báo động tự trở lại bình thường trước khi ai thấy, nó vẫn đáng được báo cáo, và là trạng thái chứng minh rằng việc xác nhận và việc trở lại bình thường là độc lập.
- `query_history` với nhóm, không thô, cho bất cứ thứ gì dài hơn vài phút. Một ngày dữ liệu mỗi giây là 86.400 điểm cho mỗi tag. Các nhóm theo quy tắc chất lượng: các lần đọc xấu và không chắc chắn được đếm trong `badReadings`, không bao giờ được lấy trung bình, và một nhóm không có gì tốt có trung bình null.
- `recent_events` là cách dựng lại một sự cố: kết nối thiết bị, lần ghi, chuyển trạng thái báo động, lần chạy tự động hóa và thay đổi cấu hình, theo thứ tự, mỗi cái kèm tác nhân đã gây ra nó.
