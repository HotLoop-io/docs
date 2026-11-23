---
title: "Khám phá MQTT"
description: "Trỏ ESPHome, Zigbee2MQTT, Tasmota hoặc Shelly tới broker và thiết bị tự hiện ra, chỉ đọc cho đến khi admin chấp nhận và kích hoạt từng điểm."
---

Trỏ một thiết bị tới broker của HotLoop và nó hiện ra. Cảm biến của nó đọc, công tắc của nó hiển thị trạng thái, các thực thể của nó mang tên, đơn vị và lớp mà nó đã thông báo. Không ai phải gõ danh sách tag.

Và nó không thể ra lệnh gì. Mọi điểm mà khám phá tạo ra đều chỉ đọc, và giữ nguyên như vậy cho đến khi admin chấp nhận thiết bị rồi kích hoạt từng điểm bằng tay, nhìn đúng topic mà lệnh sẽ đi tới. Một thiết bị tự thông báo là một thiết bị cho bạn biết nó là gì. Điều đó hữu ích. Nó không phải là một thiết bị giành được quyền đóng cắt một rơ-le trong nhà máy của bạn, và HotLoop không giả vờ rằng nó là vậy.

## Những gì dùng định dạng này

Định dạng này là loại có topic như `homeassistant/sensor/kitchen/power/config`. Nó mang tên của dự án đã định nghĩa nó; HotLoop dùng nó vì các nhà xuất bản dùng, và đó là toàn bộ mối quan hệ.

| Nhà xuất bản | Cách nó đến đây | Chúng tôi kiểm thử nó với cái gì |
|---|---|---|
| **ESPHome** (thành phần `mqtt:` của nó) | theo từng thành phần, bật theo mặc định, retained | đầu ra ghi lại từ các nút thật (xem bên dưới) |
| **Zigbee2MQTT** | theo từng thành phần, có mẫu trên gần như mọi thứ | đầu ra ghi lại từ các bản cài đặt thật |
| **Tasmota** | định dạng riêng của nó, bên dưới | đầu ra ghi lại từ chín thiết bị thật |
| **Shelly** (Gen2, Gen3, Gen4) | không thông báo gì cả; học từ các trạng thái nó xuất bản, bên dưới | đầu ra ghi lại từ mười lăm bộ thông điệp thật và tài liệu của nhà sản xuất |
| Bất cứ thứ gì khác xuất bản định dạng này | tương tự | chính các quy tắc của định dạng |

ESPHome được đối chiếu với các bản ghi từ nút thật, giống như Zigbee2MQTT.

Các bản ghi là những thông điệp mà một bản cài đặt thật đã xuất bản, do người vận hành nó chụp lại, với nhà xuất bản, phiên bản và thiết bị được ghi chú và không thay đổi gì ngoài khoảng trắng của JSON.

## Tasmota

Tasmota hiện tại không xuất bản định dạng `homeassistant/`. Tài liệu của nó nói rằng nó đã bị gỡ khỏi mọi bản dựng. Những gì nó xuất bản, retained, là định dạng riêng:

- `tasmota/discovery/<MAC>/config`: thiết bị (topic của nó, mẫu full topic, các rơ-le và đèn, các từ bật và tắt, các từ last will);
- `tasmota/discovery/<MAC>/sensors`: những gì cảm biến của nó đang đọc ngay lúc đó.

Cả hai đều do `TasDiscovery` trong `xdrv_12_discovery.ino` của Tasmota viết ra (đọc tại arendst/Tasmota `development` 5c295fb, 2026-10-12). HotLoop biến cả hai thành các thành phần giống hệt mọi nhà xuất bản khác tạo ra, nên mọi thứ sau đó (màn hình Đã phát hiện, chấp nhận, kích hoạt, cổng ghi, việc đọc) là một đường mã duy nhất. MAC là danh tính của thiết bị; một thiết bị cũng thông báo theo định dạng `homeassistant/` (firmware cũ có SetOption19) là cùng một thiết bị.

| Tasmota nói | HotLoop tạo ra |
|---|---|
| một rơ-le (`rl` 1) | một công tắc: đọc `stat/<topic>/POWER` (`POWER1`, `POWER2` và tiếp theo khi có nhiều hơn một), bằng chính các từ bật và tắt của thiết bị; ra lệnh `cmnd/<topic>/POWER[n]` với ON hoặc OFF |
| một đèn (`rl` 2) | một đèn: bật và tắt theo cách tương tự. Với một bộ điều sáng, mức của nó là khóa `Dimmer` của `tele/<topic>/STATE`, từ 0 đến 100, và được đặt bằng `cmnd/<topic>/Dimmer` |
| mỗi con số trong thông điệp cảm biến | mỗi con số là một cảm biến, đọc từ `tele/<topic>/SENSOR` theo đường dẫn của nó (`ENERGY` `Power`, `SCD40` `CarbonDioxide`), với đơn vị và lớp mà Tasmota gán cho tên đó. Mảng của một đồng hồ ba pha là một cảm biến cho mỗi pha |
| last will của nó | khả năng sẵn sàng: `tele/<topic>/LWT`, với các từ Online và Offline của chính thiết bị |

Các topic được dựng theo cách Tasmota dựng: full topic của nó với `%prefix%` và `%topic%` được điền, nên một thiết bị mà chủ sở hữu đã đổi full topic (`tasmota/35D7A0/%prefix%/`, hoặc `bi/test/%topic%/%prefix%`) đọc và ra lệnh trên các topic mà nó thực sự dùng.

Những gì nó không đọc, nó nói ra, trong các vấn đề của nguồn và không bao giờ bằng sự im lặng: rèm cuốn, đầu vào công tắc, nút bấm, iFan, camera, màu của đèn màu, và độ sáng của thiết bị có nhiều hơn một đèn. Không có gì trong các bản ghi cho thấy những thứ đó hoạt động, nên ở đây không tuyên bố là đọc chúng.

**Hỏi.** Tasmota báo một rơ-le khi nó thay đổi và báo mọi thứ mỗi năm phút. Vì vậy khi một thiết bị bắt đầu được đọc, HotLoop gửi một thông điệp rỗng tới `cmnd/<topic>/POWER`, mà Tasmota đáp lại bằng trạng thái của mọi rơ-le và không di chuyển gì; nếu thiếu nó, một thiết bị không thay đổi sẽ đọc là không rõ tới năm phút sau khi HotLoop khởi động. Thông điệp rỗng, tới một topic kết thúc bằng `POWER` và không gì khác, và một nguồn chỉ lắng nghe không gửi gì cả.

**Độ sáng của một đèn** đến cùng telemetry của Tasmota (mỗi năm phút trừ khi `TelePeriod` của thiết bị ngắn hơn), không phải ngay lúc nó thay đổi. Bật và tắt đến ngay lập tức.

**Trên mỗi broker**, định dạng này là một công tắc (`tasmota` trên broker, trong Cài đặt, MQTT). Một broker được thêm bây giờ có nó bật; broker nhúng luôn có nó; một broker đã tồn tại từ trước tiếp tục lắng nghe y như trước, nên nó tắt cho đến khi ai đó bật. Tắt nghĩa là HotLoop thậm chí không đăng ký `tasmota/discovery/#` ở đó.

Một cấu hình không đáng tin, như mọi cấu hình khác. Một cái xuất bản dưới một MAC không phải MAC nó nói, một full topic không có `%topic%` hoặc có ký tự đại diện, một topic có dấu gạch chéo, một từ bật có dấu nháy, một phiên bản nó không biết: mỗi cái bị từ chối kèm lý do và không có gì được tạo ra. Một tên cảm biến có dấu nháy không bao giờ tới được một mẫu.

**Cái này được kiểm thử với gì.** Thông điệp thật của chín thiết bị, chụp từ chính bảng điều khiển của Tasmota:

| Bản ghi | Thiết bị | Nguồn |
|---|---|---|
| esp32-8relay-13.4.0 | bo mạch ESP32, 8 rơ-le, Tasmota 13.4.0 | github.com/arendst/Tasmota/issues/20953 |
| esp32-zigbee-gateway-reboots-15.3.0.1 | ESP32 không có rơ-le, ba lần khởi động | github.com/arendst/Tasmota/issues/24487 |
| esp8266-sps30-scd40-airsensor-14.1.0 | cảm biến CO2 và bụi hạt, 14.1.0 | github.com/arendst/Tasmota/issues/24780 |
| esp8266-sps30-scd40-airsensor-15.4.0-invalid-json | cùng chiếc hộp đó trên 15.4.0, có firmware xuất bản JSON với dấu phẩy ở cuối | cùng vấn đề đó |
| nous-a1t-energy-plug-14.5.0 | ổ cắm NOUS A1T có đo năng lượng | github.com/arendst/Tasmota/issues/23094 |
| olimex-esp32-poe-counter-custom-fulltopic-14.5.0 | bộ đếm và đồng hồ ba pha, full topic đã đổi | github.com/arendst/Tasmota/issues/23775 |
| shelly-dimmer2-15.3.0.3 | Shelly Dimmer 2 chạy Tasmota | github.com/arendst/Tasmota/issues/24560 |
| tuyamcu-energy-meter-custom-fulltopic-14.5.0 | đồng hồ năng lượng TuyaMCU, full topic đã đổi | github.com/arendst/Tasmota/issues/23165 |
| wemos-2relay-15.1.0.1 | hai rơ-le, từ nhật ký bảng điều khiển của chính tác giả Tasmota | github.com/arendst/Tasmota/issues/24006 |

Đây là các bản ghi, không phải một thiết bị trên bàn thử. Những thứ các bản ghi không có là độ sáng (dòng `tele/STATE` của bộ điều sáng bị lỗi trong nhật ký gốc; khóa `Dimmer` của nó nằm trong `STATUS11` của cùng bản ghi, mà Tasmota dựng bằng cùng một hàm) và truy vấn công suất được trả lời (các bản ghi cho thấy câu hỏi và câu trả lời, từ bảng điều khiển của Tasmota, không phải HotLoop hỏi).

## Shelly

Một Shelly Gen2, Gen3 hoặc Gen4 không thông báo gì. Không có topic cấu hình nào để chờ. Những gì nó làm, khi MQTT đã bật và thông báo trạng thái đã bật, là xuất bản toàn bộ trạng thái của mỗi thành phần lên `<prefix>/status/<component>` (`switch:0`, `cover:0`, `light:0`, `input:0`, một `boolean:200` ảo) mỗi khi nó thay đổi, và last will của nó lên `<prefix>/online`. Vì vậy HotLoop học thiết bị từ những gì nó nói: các thành phần nó đã xuất bản, các trường mà mỗi thành phần đã mang, và MAC từ trạng thái `sys` của nó. Tiền tố mặc định là id của thiết bị (`shellyplus2pm-485519968144`), tức là model và MAC của nó, nên một thiết bị trên tiền tố mặc định thậm chí không chờ `sys`. Một cái trên tiền tố do ai đó gõ (`ShellyLichtGarten`) phải xuất bản `sys` trước khi có thể phân biệt với cái khác, và cho đến lúc đó nó được nêu trong các vấn đề của nguồn và không được tạo.

Những gì đã học được giữ lại, theo tiền tố, và chỉ tăng thêm. Một thành phần im lặng không bị gỡ bỏ, và một trạng thái có ít nội dung hơn trạng thái trước không lấy đi gì, nên khởi động lại không làm thiết bị mất bộ phận. Mọi thứ sau đó là cùng một đường đi như mọi nhà xuất bản khác: màn hình Đã phát hiện, chấp nhận, kích hoạt từng điểm, cổng ghi, việc đọc.

| Shelly nói | HotLoop tạo ra |
|---|---|
| `switch:n` có `output` | một công tắc: đọc `output` từ `<prefix>/status/switch:n`; ra lệnh `<prefix>/command/switch:n` với `on` hoặc `off` |
| `light:n` | một đèn theo cách tương tự, với `set,true` và `set,false`; có `brightness` trong trạng thái, một mức từ 0 đến 100, gửi dưới dạng `set,true,<level>` |
| `cover:n` | một cover: đọc `state` (open, closed, opening, closing, stopped) và gửi `open`, `close` và `stop`. Một cover nói `pos_control` là đã hiệu chuẩn, nên nó cũng đọc `current_pos` và được gửi `pos,<n>`; cái không phải thì chỉ mở và đóng |
| `apower`, `voltage`, `current`, `freq`, `pf`, `aenergy.total`, `temperature.tC` trên một switch, light hoặc cover | mỗi cái một cảm biến, theo W, V, A, Hz, Wh và độ C, với lớp mà tài liệu của Shelly gán cho chúng |
| `input:n` | một cảm biến nhị phân của `state` của nó |
| `devicepower:n`, `voltmeter:n`, `illuminance:n`, `presencezone:n` | cảm biến và cảm biến nhị phân của pin, nguồn ngoài, điện áp, mức sáng, sự hiện diện và số lượng vật thể |
| `boolean:n`, `number:n`, `enum:n` (thành phần ảo) | cảm biến chỉ đọc. Đặt một thành phần ảo là một lệnh gọi RPC, mà cái này không làm, và mỗi cái được nêu trong các vấn đề của nguồn |
| last will `online` của nó | khả năng sẵn sàng, với `true` và `false` riêng của Shelly |

Các lệnh là những lệnh mà trang MQTT của nhà sản xuất liệt kê dưới MQTT Control, và các bài kiểm thử buộc HotLoop theo danh sách đó: `on`, `off` và `toggle` cho công tắc; `set,<bool>,<brightness>` cho đèn; `open`, `close`, `stop` và `pos,<n>` cho cover. Mỗi lệnh là một lần ghi qua cổng, do một người kích hoạt.

**Hỏi.** Một Shelly xuất bản một thành phần khi nó thay đổi, nên một thiết bị không thay đổi sẽ đọc là không rõ cho đến khi nó thay đổi. Khi một thiết bị bắt đầu được đọc, HotLoop gửi `status_update` tới `<prefix>/command`, mà theo cùng trang đó khiến thiết bị xuất bản trạng thái của các thành phần và không di chuyển gì. Chỉ là một từ đó, tới một topic kết thúc bằng `/command` và không gì khác, và một nguồn chỉ lắng nghe không gửi gì cả. Nó xảy ra mỗi khi việc đọc thiết bị bắt đầu, nên kích hoạt nhiều điểm liên tiếp sẽ hỏi nhiều lần.

**Thiết bị phải bật những gì.** MQTT được bật, kèm địa chỉ broker; thông báo trạng thái bật (`status_ntf`); và, cho các lệnh, điều khiển bật (`enable_control`). Broker riêng của HotLoop có một hồ sơ đăng nhập `shelly`, đặt theo tiền tố của thiết bị, cho phép nó xuất bản các trạng thái của mình và nghe `<prefix>/command` và không gì khác.

**Những gì nó không đọc.** Được nói ra, trong các vấn đề của nguồn, không bao giờ bằng sự im lặng: một thành phần thuộc loại chưa được cho xem (`lora:100` trên Gen4 có bộ bổ sung LoRa, một `pm1`, một `em`), một switch hay cover đã bỏ trường dùng để đọc, và việc đặt một thành phần ảo. Các sự kiện đầu vào (nhấn đôi, nhấn giữ) đến trên topic thông báo RPC, `<prefix>/events/rpc`, và không được đọc; chỉ `state` của đầu vào được đọc. Một tiền tố có nhiều hơn hai cấp (`home/garage/boiler`) không được nghe; một hoặc hai cấp thì có. Không có gì được gửi qua RPC.

**Trên mỗi broker** nó là một công tắc (`shelly` trên broker, trong Cài đặt, MQTT). Một broker được thêm bây giờ có nó bật; broker nhúng luôn có nó; một broker đã tồn tại từ trước tiếp tục lắng nghe y như trước, nên nó tắt cho đến khi ai đó bật. Nó là công tắc vì các topic nó lắng nghe, `+/status/+`, rất rộng, và một broker mang thứ khác dưới `*/status/*` muốn nó tắt. Tắt nghĩa là HotLoop không đăng ký chúng ở đó.

Nó không đáng tin, như mọi topic khác. Một tiền tố không phải chữ, chữ số và `_.-`, một thành phần không phải `kind:number`, một payload không phải đối tượng hoặc lớn hơn 64 KiB, một thiết bị khai báo hơn 64 thành phần, và hơn 512 thiết bị đang được học cùng lúc đều bị bỏ qua, và một cấu trúc được giữ dưới một tiền tố mà nói rằng nó là cái khác thì bị từ chối.

**Cái này được kiểm thử với gì.** Mười lăm bộ thông điệp thật và chính tài liệu của nhà sản xuất.

| Bản ghi | Thiết bị | Nguồn |
|---|---|---|
| plus-1-fw1.4.2-switch-rpc | Plus 1, firmware 1.4.2 | github.com/iobroker-community-adapters/ioBroker.shelly/issues/1055 |
| plus-2pm-cover-mode | Plus 2PM làm cửa cuốn, đã hiệu chuẩn | cùng kho mã, issues/1088 |
| 1pm-mini-gen3-fw2.0.0-switch | 1PM Mini Gen3, 2.0.0 | cùng nơi, issues/1592 |
| 2pm-gen3-fw2.0.1-beta3-switch | 2PM Gen3, 2.0.1-beta3, hai kênh | cùng nơi, issues/1627 |
| 2pm-gen4-lora-addon | 2PM Gen4 có bộ bổ sung LoRa | cùng nơi, issues/1349 |
| plug-s-gen3-fw2.0.1-beta1-switch | Plug S Gen3 | cùng nơi, issues/1594 |
| pro4pm-gen2-fw2.0.1-switch-set | Pro 4PM, 2.0.1, MAC của người đăng đã bị che | cùng nơi, issues/1640 |
| pro-dimmer-2pm-fw1.3.0-light | Pro Dimmer 2PM | cùng nơi, issues/974 |
| dimmer-gen3-light-sys | Dimmer Gen3 | github.com/enesbcs/shellyteacher4domo/issues/65 |
| pill-gen3-fw1.8.99 | Pill, 1.8.99, có vôn kế | kho mã ioBroker, issues/1232 |
| presence-gen4-fw2.1.99-dev | Presence Gen4, ba vùng | cùng nơi, issues/1228 |
| frankever-sprinkler-virtual-components | một bộ điều khiển tưới có tiền tố riêng, thành phần ảo | cùng nơi, issues/1207 |
| official-docs-component-status | các ví dụ thành phần của nhà sản xuất: Plus 1PM, Plus 2PM, H&T, Pro 1, WDUS | shelly-api-docs.shelly.cloud |
| official-docs-mqtt-control | các lệnh MQTT Control của nhà sản xuất | cùng nơi |
| official-docs-mqtt-page, official-docs-notifications | trang MQTT của nhà sản xuất và các ví dụ thông báo | cùng nơi |

Hai trong số đó không thể dựng thành thiết bị, và các bài kiểm thử nói vậy: tiền tố của Pro 4PM có phần che của người đăng (`xxxx`) trong đó và không có `sys`, còn tiền tố của đèn vườn là tiền tố riêng và cũng không có. Cả hai chờ MAC của mình, như một thiết bị thật sẽ làm.

**Cái này được xác minh dựa trên các bản ghi và tài liệu, không phải trên một Shelly ở bàn thử.** Chưa có cái nào ở đây. Các trạng thái là những gì thiết bị thật đã xuất bản, các topic HotLoop đọc là các topic mà những thiết bị đó đã dùng, và các lệnh có dạng mà nhà sản xuất ghi tài liệu. Những gì các bản ghi không thể cho thấy: một lệnh thực sự di chuyển rơ-le, một cover thực sự đi đến một vị trí, và câu trả lời cho `status_update`. Khi có một Shelly trên bàn thử, đó là ba việc cần thử trước.

## Điều gì xảy ra khi có thứ tự thông báo

1. **Nó hiện ra.** Trên broker nhúng, một thiết bị tự thông báo là một thiết bị HotLoop ngay lập tức: giao thức `mqtt`, không đặt vào cây, được đặt tên theo cái nó tự gọi (`kitchen-plug`, rồi `-2` nếu trùng), đang đọc. Các tag của nó được đặt tên theo những gì nó đã thông báo (`power`, `relay`). Các thực thể của nó nhận tên, lớp thiết bị, lớp trạng thái, đơn vị, danh mục và biểu tượng mà cấu hình đã cho, và một thực thể mà cấu hình nói là tắt theo mặc định bắt đầu ở trạng thái vô hiệu hóa.
2. **Không có gì được kích hoạt.** Mọi tag được tạo ra chỉ đọc. Một công tắc, một số hay một văn bản nhận ngay thực thể điều khiển của nó, chưa kích hoạt (`armed: false`), nên một màn hình hay một tự động hóa có thể gọi tên `switch.kitchen_plug_relay` từ ngày đầu. Nó bắt đầu hoạt động vào khoảnh khắc một người kích hoạt điểm, và không sớm hơn.
3. **Admin quyết định.** Thiết bị, Đã phát hiện. Ai đã thông báo nó (trên broker nhúng, thông tin đăng nhập và id máy khách đã xuất bản cấu hình của nó), mọi thành phần nó sẽ tạo, mọi topic nó đọc, mọi topic lệnh đầy đủ, và những gì cần xem:

   - một topic lệnh nằm ngoài các topic mà thành phần đọc (một "cái đèn" mà các lệnh đi tới `cmnd/boiler/POWER`);
   - một topic lệnh nằm trong tiền tố khám phá, hoặc một cái mà thiết bị khác cũng tuyên bố;
   - một cấu hình yêu cầu lệnh retained, vì một lệnh retained phát lại mỗi lần thiết bị kết nối lại;
   - các mẫu mà HotLoop không thể đánh giá, và các khóa cấu hình mà định dạng không định nghĩa.

   **Chấp nhận** giữ nó tiếp tục đọc và làm cho các điểm của nó có thể kích hoạt, từng điểm một, trong trình chỉnh sửa tag. Nó không kích hoạt gì. Nếu thiết bị đề xuất một khu vực và một nút của cây có đúng tên đó, hộp thoại chấp nhận điền sẵn nó. Một nhà xuất bản không được tự xếp mình vào Phòng nồi hơi; một người bấm chấp nhận. **Bỏ qua** loại bỏ thiết bị, tag và thực thể (lịch sử vẫn còn, như mọi thiết bị) và giữ nó bị loại khi nó thông báo lại. Xóa một thiết bị đã phát hiện giống như bỏ qua nó, vì một thiết bị cứ tiếp tục thông báo sẽ chỉ quay lại.

## Khi nó đổi ý

**Một thông tin đăng nhập khác bị giữ lại để xem xét, bất kể nó nói gì.** Trên broker nhúng, một thiết bị nhớ thông tin đăng nhập mà nó đã được chấp nhận từ đó. Cùng thiết bị được thông báo bởi một thông tin đăng nhập khác bị giữ lại để xem xét với hai thông tin đăng nhập đặt cạnh nhau, ngay cả khi cấu hình giống từng chữ, và nhật ký nhận một cảnh báo. Hoặc ai đó đã chuyển thiết bị sang thông tin đăng nhập mới, hoặc một thông tin đăng nhập đang thông báo một thiết bị không phải của nó. Áp dụng, và thông tin đăng nhập mới là cái mà nó được chấp nhận từ đó. Từ chối, và thông tin đăng nhập thông báo cùng thứ đó vẫn bị từ chối.

**Một cấu hình thay đổi dưới một thiết bị đã được chấp nhận bị giữ lại để xem xét.** Cấu hình đã chấp nhận tiếp tục chạy. Màn hình Đã phát hiện hiển thị thay đổi theo từng trường, đang chạy so với đã thông báo, và admin áp dụng hoặc từ chối. Một đơn vị chuyển từ °C sang °F, hoặc một topic trạng thái trỏ sang nơi khác, chính là cách một con số sai có được bộ mặt đáng tin. Áp dụng một thay đổi không bao giờ đổi việc một điểm có được kích hoạt hay không: đó là quyết định của một người và vẫn như vậy.

Cập nhật firmware, tên thiết bị mới, model mới hay biểu tượng khác tự động được áp dụng. Không ai phải bấm vì một lần tăng phiên bản.

Trước khi có ai chấp nhận một thiết bị, thông báo mới nhất luôn được áp dụng: chưa ai xây dựng trên nó.

**Một cấu hình rỗng rút lại một thành phần.** Các điểm của nó đọc xấu, nói "bị nhà xuất bản rút lại lúc 14:02", và không có gì bị xóa. Một cảnh báo trên điểm đó giữ mục tiêu của nó và nói tại sao nó xấu. Nếu cùng thành phần đó quay lại, nó được khôi phục, và cho đến khi nó gửi giá trị mới, nó đọc "được thông báo lại sau khi rút lại; đang chờ giá trị tiếp theo" thay vì đưa giá trị từ trước khi nó rời đi ra như hiện tại. Một thiết bị không ai chấp nhận mà rút lại mọi thành phần của nó sẽ biến mất, vì không ai xây dựng trên nó.

**Zigbee2MQTT đổi tên một thiết bị** xóa các topic cấu hình cũ của nó và thông báo các topic mới với cùng ID duy nhất. HotLoop định danh các thành phần theo ID duy nhất, nên đó là một lần rút lại và một lần khôi phục cách nhau một giây, và không mất gì.

## Đọc

Một trạng thái đi qua mẫu giá trị của thành phần, nếu có, rồi qua phần so khớp riêng của thành phần: `payload_on`/`payload_off` cho cảm biến nhị phân (`ON`/`OFF` theo mặc định), `state_on`/`state_off` cho công tắc, một số cho một số, một trong các tùy chọn cho select. **Bất cứ thứ gì không khớp là một lần đọc xấu kèm lý do**, hiển thị trên ô:

- `"CLOSE" is neither payload_on "CLOSED" nor payload_off "OPEN"`
- `value_json has no key 'temperature'`
- `"unavailable" is not a number`
- `the publisher sent no value` (nó gửi `None`, `null`, không gì, hoặc `unknown`)
- `no update for 300 s (expire_after)`

Cái đầu tiên là thật: Zigbee2MQTT 1.41.0 thông báo cảm biến cửa sổ của một Avatto TRV07 theo cách đó, và người đã chụp nó đã mở một vấn đề vì cửa sổ không bao giờ hiện ra. HotLoop hiển thị nó là xấu và nói tại sao thay vì đoán.

**Khả năng sẵn sàng** là đường liên kết của thiết bị, không phải một lần đọc. Khi thiết bị nói nó ngoại tuyến trên topic khả năng sẵn sàng, nó hiển thị là ngắt kết nối bằng chính lời của nó ("the device says it is offline (plug/status = offline)") và các thực thể của nó không khả dụng. Cho đến khi thông điệp khả năng sẵn sàng đầu tiên đến, một thiết bị có cấu hình khả năng sẵn sàng là không khả dụng. Đó là quy tắc của định dạng, và là quy tắc đúng. Phiên broker không bị phá vì việc đó: nó được dùng chung với mọi thiết bị khác trên broker đó.

`expire_after` làm một giá trị xấu sau chừng đó giây không có cập nhật. `off_delay` tắt một cảm biến nhị phân sau chừng đó giây, vì cấu hình nói thiết bị không bao giờ gửi lệnh tắt. Các thuộc tính JSON được đưa vào thực thể, tối đa 64 khóa và 8 KiB, dưới các thuộc tính của chính HotLoop (`friendly_name`, `source`, `armed` và phần còn lại luôn thắng).

Một thành phần không có topic trạng thái đọc xấu mãi mãi. HotLoop không bao giờ giả định một trạng thái từ một lệnh.

## Lệnh

Không có gì được ra lệnh cho đến khi ba điều là đúng, theo thứ tự này:

1. **Một người đã chấp nhận thiết bị.** Cho đến lúc đó trình chỉnh sửa tag sẽ không kích hoạt điểm nào trên nó ("accept the device first"), và cổng ghi tự từ chối các lệnh của nó, nên một hàng chỉnh tay hay một bản sao lưu cũ có điểm đã kích hoạt cũng không đi đến đâu.
2. **Một người đã kích hoạt điểm**, trong trình chỉnh sửa tag, từng điểm một. Trước ô đánh dấu, trình chỉnh sửa cho biết các lệnh đi đâu và gửi gì: "Commands go to `plug/relay/set`, sending ON or OFF."
3. **Cổng ghi cho lệnh đi qua**, như mọi lần ghi khác: ghi được bật, công tắc MCP cho một tác tử, phạm vi của tag, các kiểm tra riêng của thực thể, một phiên đang hoạt động. Được kiểm toán với id cuộc gọi của nó, bị từ chối hay không. Chạy thử đặt ra đúng những câu hỏi như vậy.

Những gì đi ra là những gì cấu hình nói: `payload_on` và `payload_off` cho công tắc, `payload_press` cho nút bấm, tùy chọn cho select, giá trị cho số hoặc văn bản (số nguyên giữ là số nguyên, `5` chứ không phải `5.0`), qua mẫu lệnh của cấu hình nếu có. Một nút bấm được nhấn một lần. "Thả" của nó sẽ là một lệnh thứ hai mà thiết bị chưa bao giờ yêu cầu, nên một nút bấm đã phát hiện là bắn một lần.

Một đèn nhận `payload_on`/`payload_off` (đèn lược đồ JSON, `{"state":"ON"}`), và độ sáng theo phần trăm được quy đổi theo `brightness_scale` riêng của nó và làm tròn, trên topic lệnh độ sáng của nó (đèn lược đồ JSON, `{"state":"ON", "brightness":128}`). Một cover nhận `payload_open`, `payload_close` hoặc `payload_stop`, và một vị trí được quy đổi từ phần trăm vào `position_closed`..`position_open` riêng của nó qua `set_position_template`. Một van nhận các payload mở và đóng của nó (một van báo vị trí, `position_open` và `position_closed` của nó), một vị trí trên topic lệnh của nó, và `payload_stop` một lần: như một nút bấm, lệnh dừng của một van đã phát hiện là bắn một lần. Một payload mà cấu hình tắt bằng `null` (một cover không có lệnh dừng) là một lệnh mà cổng từ chối kèm lý do.

Cổng từ chối một lệnh, kèm lý do, khi:

- chưa ai chấp nhận thiết bị;
- broker mà nó nằm trên đó chỉ lắng nghe;
- nhà xuất bản đã rút lại thành phần;
- mẫu lệnh của nó nằm ngoài tập con ("command template not supported: filter `regex_replace` is not supported at column 12"). Không bao giờ là "gửi giá trị thô thay thế";
- cấu hình của nó không có topic lệnh;
- cấu hình của nó không có payload cho điều được yêu cầu: một lệnh dừng trên cover có cấu hình nói `payload_stop: null`, một tùy chọn mà select không có, một độ sáng trên 100%. Payload được dựng ra trong lúc kiểm tra, nên chạy thử cũng nói không.

**Các lệnh retained theo cấu hình.** Nếu một cấu hình yêu cầu `retain: true`, HotLoop xuất bản các lệnh của thành phần đó ở dạng retained, và nói điều đó ở mọi nơi một người quyết định về nó: màn hình Đã phát hiện đánh dấu nó và trình chỉnh sửa tag nói bằng lời đơn giản. Hãy hiểu điều đó nghĩa là gì trước khi kích hoạt một cái: broker giữ lệnh cuối cùng và đưa cho thiết bị mỗi khi thiết bị kết nối lại, lúc ba giờ sáng, khi không có tay ai chạm vào gì. Lệnh vẫn đã đi qua cổng và vẫn nằm trong dấu vết kiểm toán kèm một cái tên; nó chỉ xảy ra lần nữa.

Không nơi nào có "xuất bản cái này lên topic kia": không trong tự động hóa, không trong script, không trong MCP. Đó sẽ là một cửa hông đi vòng quanh cổng với cái tên dễ nghe hơn. Trong mã, hai thứ trong khám phá xuất bản: lần ghi của trình điều khiển, mà chỉ cổng mới tới được, và thông điệp birth. Một bài kiểm thử bảo vệ kiểm tra kiểu của gói trình điều khiển và làm hỏng bản dựng nếu bất cứ thứ gì khác gọi một trong hai, với một lối vòng được cài sẵn để chứng minh nó có tác dụng.

## Mẫu

Không Python, không công cụ Jinja. Không vòng lặp, nên một mẫu tốn bằng độ dài của nó.

`{% set name = value %}` có trong đó, và chỉ dạng đó: Zigbee2MQTT viết chế độ của mọi bộ điều nhiệt dưới dạng `{% set values = {'manual':'heat', ...} %}` rồi tra cứu nó, và một bộ điều nhiệt mà chế độ không đọc được là bộ điều nhiệt bạn không thể tin. Không có không gian tên, không giải nén, không dạng khối. `.keys()` cũng có, chỉ ở vế phải của `in`, vì đó là nơi duy nhất các mẫu đó dùng nó.

| <span class="sr-only">Chi tiết</span> | <span class="sr-only">Chi tiết</span> |
|---|---|
| Cấu trúc | văn bản, `{{ expr }}`, `{% if %}` / `{% elif %}` / `{% else %}`, `{% set name = value %}`, `{# comments #}`, điều khiển khoảng trắng bằng `-` |
| Biến | mẫu giá trị: `value`, `value_json` (chỉ khi payload là JSON), `entity_id`, `name`; mẫu lệnh: `value`, `entity_id`, `name` |
| Biểu thức | literal, `.attr`, `['key']`, `[0]`, cắt lát, `+ - * / // % **`, `~`, so sánh, `and or not`, `in`, `x if c else y`, `.get(key, default)` trên một ánh xạ, `in mapping.keys()` |
| Kiểm tra | `defined`, `undefined`, `none`, `number`, `integer`, `float`, `boolean`, `string`, `mapping`, `sequence`, `true`, `false`, `eq`, `ne`, `lt`, `le`, `gt`, `ge`, `in`, `odd`, `even`, `divisibleby` |
| Bộ lọc | `float`, `int`, `round`, `bool`, `default`/`d`, `string`, `lower`, `upper`, `capitalize`, `title`, `trim`, `replace`, `truncate`, `abs`, `length`/`count`, `min`, `max`, `tojson`, `to_json`, `from_json`, `is_defined`, `iif` |
| Hàm | `float()`, `int()`, `bool()`, `iif()`, `min()`, `max()` |

Khi định dạng ghi tài liệu một bộ lọc khác với Jinja tiêu chuẩn, HotLoop theo định dạng. Cái quan trọng: **`float` và `int` không có giá trị mặc định sẽ thất bại** trên thứ không phải số. Jinja tiêu chuẩn lặng lẽ trả về `0`, và đó là số không báo rằng bể rỗng khi cảm biến đã ngừng trả lời.

Các giá trị được hiển thị theo cách `str()` của Python hiển thị, vì cấu hình của mọi nhà xuất bản được viết theo đó: `True`, `None`, `21.0` vẫn là `21.0`. Đó không phải chuyện thẩm mỹ. Cảm biến tiếp điểm của Zigbee2MQTT thông báo `payload_on: false` và khớp với `False` đã hiển thị.

**Một khóa bị thiếu là lỗi trừ khi đã được xử lý.** `{{ value_json.temperature }}` trên payload không có nó là một lần đọc xấu nói rõ như vậy, không phải chuỗi rỗng. `default`, `is defined` và một `{% if value_json.x %}` trần xử lý nó có chủ đích, và ổn.

**Ngoài tập con, bị từ chối khi cấu hình đến**, kèm vị trí: "value template not supported: filter `regex_findall_index` is not supported at column 12". Thành phần vẫn được tạo, để bạn thấy nó tồn tại, và đọc xấu với lý do đó. Không có kết xuất một phần theo nỗ lực tối đa và không có "dùng payload thô thay thế". Hai mẫu thật bị từ chối có chủ đích: `now()` (giá trị phụ thuộc vào lúc HotLoop đánh giá nó không phải là lần đọc của thiết bị), và một mẫu sự kiện Zigbee2MQTT dựng các mẫu regex với không gian tên và `regex_findall`.

Giới hạn: mẫu 4 KiB, lồng 32 cấp, đầu ra 64 KiB, số nguyên 64 bit (tràn số là lỗi, không phải quay vòng).

Các bộ lọc riêng của định dạng, không phải Jinja tiêu chuẩn, có các ca viết tay trích dẫn hành vi được ghi tài liệu mà mỗi bộ lọc buộc chúng tôi theo. Mọi mẫu trong các bản ghi đều phải phân tích được.

## HotLoop dựng cái gì từ cái gì

| Thành phần | Tag | Thực thể |
|---|---|---|
| `sensor` | `float` khi có đơn vị, lớp trạng thái hoặc lớp thiết bị dạng số, nếu không là `string` | sensor |
| `binary_sensor` | `bool` | binary_sensor |
| `switch` | `bool` | binary_sensor, và một thực thể điều khiển switch, chưa kích hoạt |
| `number` | `float`, với `min`/`max` của cấu hình làm phạm vi của tag | sensor, và một thực thể điều khiển number, chưa kích hoạt, có tối thiểu, tối đa và bước |
| `text` | `string` | sensor, và một thực thể điều khiển text, chưa kích hoạt |
| `select` | `string`, chỉ đọc một trong các tùy chọn của nó | sensor, và một select với các tùy chọn của cấu hình, chưa kích hoạt |
| `button` | `string`, nhận một lần nhấn và không đọc gì | một nút bắn một lần, chưa kích hoạt (thực thể đọc riêng của tag được tạo ẩn) |
| `light` | `bool` bật/tắt; `float` độ sáng 0 đến 100 % khi có | một đèn, chưa kích hoạt |
| `cover` | `string` trạng thái, cũng nhận `open`, `close` và `stop`; `float` vị trí 0 đến 100 % khi có | một cover, chưa kích hoạt |
| `valve` | `string` trạng thái; `float` vị trí 0 đến 100 % nếu báo; `bool` lệnh (mở hoặc đóng) và `bool` dừng, chỉ ra lệnh và không bao giờ đọc | một van, chưa kích hoạt, lệnh dừng của nó bắn một lần |
| `event` | `string`, loại sự kiện | một sự kiện |
| `device_automation` (một trigger) | `string`, `<type>_<subtype>` khi payload của nó đến | một sự kiện, mỗi trigger một cái |
| `lock` | `string`, đọc bằng chính từ của nó và nhận `lock`, `unlock`, `open` | một khóa, chưa kích hoạt |
| `fan` | `bool` bật/tắt; `float` tốc độ 0 đến 100 %; `string` chế độ cài sẵn và hướng; `bool` dao động, mỗi cái khi có | một quạt, chưa kích hoạt |
| `siren` | `bool` | một còi, chưa kích hoạt |
| `scene` | `bool`, một lần nhấn | một nút bắn một lần, chưa kích hoạt |
| `notify` | `string`, một thông điệp, chỉ ra lệnh và không bao giờ đọc | một bộ thông báo, chưa kích hoạt |
| `update` | `string` của phiên bản đã cài và mới nhất | một bản cập nhật: bật khi chúng khác nhau. Lệnh cài đặt của nó không bao giờ được gửi |
| `device_tracker` | `string`, `home`, `not_home` hoặc một vùng | một bộ theo dõi |
| `tag` | `string`, id của tag khi một cái được quét | một sự kiện |
| `climate` | `string` chế độ; `float` điểm đặt, điểm đặt thấp và cao và điểm đặt độ ẩm, mỗi cái với `min_temp`/`max_temp` của cấu hình (hoặc `min_humidity`/`max_humidity`) làm phạm vi; `float` nhiệt độ và độ ẩm phòng; `string` các chế độ quạt, xoay và cài sẵn và hành động; `bool` nguồn, chỉ ra lệnh và không bao giờ đọc; mỗi cái khi có | một bộ điều nhiệt, chưa kích hoạt |
| `humidifier` | `bool` bật/tắt; `float` điểm đặt độ ẩm trong phạm vi của nó; `string` chế độ và hành động; `float` độ ẩm phòng | một máy tạo ẩm, chưa kích hoạt |
| `water_heater` | `string` chế độ; `float` điểm đặt trong phạm vi của nó và nhiệt độ hiện tại; `bool` nguồn, chỉ ra lệnh và không bao giờ đọc | một bình nước nóng, chưa kích hoạt |
| `alarm_control_panel` | `string` trạng thái, đọc bằng từ của định dạng và nhận các hành động mà `supported_features` của nó liệt kê, mỗi cái với payload riêng | một bảng báo động, chưa kích hoạt |
| `vacuum` | `string` trạng thái, nhận các hành động mà `supported_features` của nó liệt kê; `float` pin; `string` tốc độ quạt, mỗi cái từ trạng thái JSON của nó | một robot hút bụi, chưa kích hoạt |
| `lawn_mower` | `string` hoạt động; `bool` bắt đầu cắt, tạm dừng và về đế, mỗi cái là một lần nhấn trên topic riêng, chỉ ra lệnh và không bao giờ đọc | một máy cắt cỏ, chưa kích hoạt |
| `camera` | `string`, một mã băm ngắn của ảnh mới nhất; bản thân ảnh được giữ trong bộ nhớ | một camera |
| `image` | tương tự, cho một ảnh trên `image_topic`; hoặc `string`, URL từ `url_topic` | một ảnh |

Với một đèn, một cover, một van, một sự kiện, một trigger và mọi thành phần trong các hàng sau chúng, các thực thể đọc riêng của tag được tạo ẩn: thứ đó là một thực thể trên các màn hình. Mỗi tag vẫn được kích hoạt riêng, nên một cover mà bạn tin vị trí nhưng không tin việc mở và đóng có thể đúng là như vậy. Một thứ có được giá trị sau khi được chấp nhận (firmware bắt đầu báo độ sáng) là một thay đổi cần xem xét, và khi một người áp dụng nó, thực thể nhận vai trò cùng với tag.

Các thông điệp trạng thái của một đèn lược đồ JSON được gộp lại, vì lược đồ gửi những gì đã thay đổi: một thông điệp chỉ có độ sáng, hoặc riêng `last_seen` của Zigbee2MQTT, để đèn vẫn bật. Màu, nhiệt độ màu và hiệu ứng của nó được hiển thị như thuộc tính, không ra lệnh; bật, tắt và độ sáng thì có, và màn hình Đã phát hiện nói điều đó với đèn có màu. Các topic màu của đèn lược đồ mặc định cũng vậy: không đọc, không ra lệnh, và được liệt kê. Lược đồ mẫu không được hỗ trợ và nói rõ. Độ nghiêng của cover không được đọc hay ra lệnh, và nói rõ.

Một trigger thiết bị chỉ kích hoạt trên `payload` riêng của nó: Zigbee2MQTT đặt mọi hành động của một nút bấm trên một topic, và mỗi trigger là một trong số đó. Một trigger không có `payload` kích hoạt với bất cứ thứ gì trên topic của nó.

Tốc độ của một quạt được đọc trên `speed_range_min`..`speed_range_max` riêng của cấu hình theo cách định dạng làm: bước đầu tiên trên mức tắt là phần trăm đầu tiên. Một mức mà cấu hình nói không thể xảy ra (một quạt ESPHome thông báo bốn bước và báo 25) là một lần đọc xấu nói rõ như vậy, không phải 625 phần trăm.

Màn hình Đã phát hiện liệt kê mọi topic mà các lệnh của một thành phần có thể đi tới: topic độ sáng của một đèn, topic tốc độ của một quạt, cùng với topic chính, và đánh dấu mỗi cái nằm ngoài những gì thành phần đọc, nằm trong tiền tố, hoặc do thiết bị khác tuyên bố.

Phạm vi điểm đặt của một bộ điều nhiệt hay một bình nước nóng là của chính cấu hình, và mặc định của định dạng khi nó không cho (7 đến 35 °C cho bộ điều nhiệt, 43,3 đến 60 °C cho bình nước nóng, tính theo °F khi cấu hình nói `temperature_unit: F`). Đó là phạm vi của tag, nên cổng từ chối 31 °C với một van bộ tản nhiệt tối đa 30 trước khi gửi bất cứ gì. Các chế độ của nó là danh sách của cấu hình, và một chế độ nó không liệt kê bị từ chối theo cách tương tự. Các màn hình đưa ra đúng những chế độ đó, và khi một thay đổi được áp dụng mang tới chế độ mới, các màn hình cũng nhận được nó.

`code` của một bảng báo động là thứ màn hình của người tiêu dùng yêu cầu trước khi gửi bất cứ gì. Trong HotLoop, ai được phép đặt hay hủy báo động là quyết định của cổng, với tag được một người kích hoạt và mọi lệnh được kiểm toán, nên hành động đi ra như cấu hình nói. Một bảng mà mẫu lệnh cần chính mã (`{{ code }}`) không thể bị ra lệnh: HotLoop không có mã nào để đặt vào đó, và màn hình Đã phát hiện nói rõ. `send_command_topic` của một robot hút bụi không được dùng: một lệnh tùy ý chính là thứ HotLoop không thể kiểm tra đối chiếu với cấu hình.

Ảnh của một camera hoặc một image được giữ trong bộ nhớ, ảnh mới nhất cho mỗi thành phần, tới 4 MiB, và được phục vụ bởi `GET /api/entities/{entity_id}/image`. HotLoop chỉ giữ nó nếu các byte là JPEG, PNG, GIF hoặc WebP, bất kể `content_type` của cấu hình tuyên bố gì: SVG là một tài liệu chạy script, và một "bức ảnh" chạy script trên bất kỳ ai mở bảng điều khiển là một lỗ hổng. Tag của nó giữ một mã băm ngắn, nên lịch sử cho biết khi nào ảnh đổi mà không cần cơ sở dữ liệu đầy JPEG. Một ảnh được thông báo bằng URL là một liên kết: HotLoop hiển thị nó, chỉ nếu là http hoặc https, và không bao giờ tải nó, vì một máy chủ tải bất kỳ địa chỉ nào mà thiết bị nêu tên có thể bị trỏ tới bất cứ thứ gì trên mạng. Cả hai đều không được ghi vào sổ nhật ký; một camera đổi mỗi giây và tag_history đã có mọi thay đổi.

Mọi thành phần mà định dạng định nghĩa đều trở thành một thứ gì đó. Một thành phần mà nó không định nghĩa (một `kettle`) được lưu cùng những gì nó đã thông báo và được liệt kê là không tạo ra gì. Định dạng không có thành phần ngày, giờ hay datetime, nên danh sách này cũng không có.

Các ID thực thể là của HotLoop, tạo từ thiết bị và tag. `object_id` và `default_entity_id` của một cấu hình bị bỏ qua: một cấu hình không được chọn tên trong không gian tên của HotLoop, và một cái độc hại sẽ chọn `switch.boiler_main`.

## Tất cả đều không đáng tin

Mọi thứ một cấu hình nói đều đến từ bất cứ ai có thể xuất bản trên tiền tố. Vì vậy:

- tên và văn bản bị giới hạn độ dài và bị loại bỏ ký tự điều khiển, và màn hình đặt chúng lên trang dưới dạng văn bản, không bao giờ là HTML;
- một topic có ký tự đại diện, một topic `$`, hoặc một `~` không có gốc để đặt vào bị từ chối kèm lý do;
- một cấu hình trên 64 KiB bị từ chối; một thiết bị không thể có hơn 512 thành phần; không quá 256 thiết bị có thể chờ quyết định trên một broker; các thông điệp cấu hình quá 200 mỗi giây bị bỏ và được đếm. Mọi lần từ chối đều được đếm và hiển thị trên màn hình Đã phát hiện, không bao giờ bị bỏ mà không nói một lời;
- HotLoop đăng ký `<prefix>/+/+/config` và `<prefix>/+/+/+/config`, không bao giờ `#` dưới tiền tố, nên một topic sâu lạc loài không thể khiến nó phân tích bất cứ thứ gì;
- một payload trạng thái trên 256 KiB, hoặc không phải UTF-8, là một lần đọc xấu.

Khi cho phép kết nối ẩn danh trên broker nhúng, bất kỳ ai trên mạng cũng có thể thông báo thiết bị và xuất bản lên bất kỳ topic lệnh nào, và màn hình Đã phát hiện nói điều đó bằng màu đỏ. Hãy cấp cho mỗi thiết bị thông tin đăng nhập riêng, tạo trong HotLoop từ hồ sơ của nó, đặt theo topic của nó ([Broker MQTT nhúng](/vi/iot/broker/)): khi đó nó có thể tự thông báo và không gì khác, và không thể chạm vào topic lệnh của thiết bị khác.

## Phía broker

Khám phá chạy trên broker nhúng (xem [broker MQTT nhúng](/vi/iot/broker/)), bật theo mặc định bất cứ khi nào broker bật. Máy khách riêng của HotLoop đăng nhập bằng thông tin đăng nhập được tạo ở mỗi lần khởi động và chỉ giữ trong bộ nhớ: không có gì để cấu hình và không có gì trong bản sao lưu có thể bị rò rỉ. Nó xuất bản đúng một thứ của riêng mình, birth (`<prefix>/status` = `online`), khiến các nhà xuất bản lắng nghe nó thông báo lại.

| Biến | Mặc định | <span class="sr-only">Details</span> |
|---|---|---|
| `HOTLOOP_BROKER_DISCOVERY` | `true` | Lắng nghe các thông báo trên broker nhúng |
| `HOTLOOP_BROKER_DISCOVERY_PREFIX` | `homeassistant` | Tiền tố topic mà chúng đến dưới đó |

Một máy khách cho mỗi broker, `hotloop-disc-embedded`, được dùng chung bởi bộ lắng nghe và trình điều khiển của mọi thiết bị đã phát hiện. Một trình hỗ trợ `--mcp-stdio` không mở cái nào: một máy khách thứ hai cùng id sẽ đá máy khách của Gateway khỏi broker vài giây một lần. Với nhiều bản sao trên một cơ sở dữ liệu, chỉ bản giữ khóa khám phá mới lắng nghe.

## Các broker khác

Nhiều nhà máy đã chạy sẵn một broker: một Mosquitto là UNS, cái mà một hộp Zigbee2MQTT mang theo. HotLoop cũng lắng nghe những broker đó. Cài đặt, MQTT, thêm một broker: một id (nó đặt tên broker trong mọi thiết bị đến từ đó), nó ở đâu, một thông tin đăng nhập và tiền tố mà các nhà xuất bản của nó thông báo dưới đó. Broker không cần bật, và HotLoop không cần broker nhúng để làm việc này.

Ba điều khác với broker riêng của HotLoop, có chủ đích:

- **Thiết bị chờ trong hộp thư đến.** Trên một broker nhà máy bận rộn, "tự hiện ra" nghĩa là ba trăm thiết bị trên màn hình trước bữa trưa. Vì vậy một thiết bị đã thông báo được liệt kê trên màn hình Đã phát hiện, không tạo gì và không đọc, cho đến khi ai đó chấp nhận. Khi đó nó được tạo, nó đọc, và các điểm của nó có thể được kích hoạt như bất kỳ cái nào khác. Một broker mà bạn tin tưởng đủ để đổ mọi thứ lên bạn có thể được chuyển sang "thiết bị tự hiện ra".
- **Không last will.** HotLoop kết nối mà không có. Một will `offline` trên broker dùng chung sẽ báo cho mọi nhà xuất bản khác trên đó rằng có gì đó đã mất, trong khi chỉ là HotLoop. Các bài kiểm thử kiểm tra chính gói CONNECT, và rút phích cắm kết nối để chứng minh không có gì được nói.
- **ACL là của riêng nó.** HotLoop không thể thấy ai đã xuất bản gì trên broker của người khác, nên không có "được thông báo bởi thông tin đăng nhập" ở đó, và những gì mỗi thông tin đăng nhập được chạm vào là việc của broker đó. Hãy cấp cho HotLoop một thông tin đăng nhập đọc tiền tố và các topic của thiết bị bạn chấp nhận, và ghi birth và các topic lệnh, không gì khác. Với Mosquitto:

  ```
  user hotloop
  topic read homeassistant/+/+/config
  topic read homeassistant/+/+/+/config
  topic write homeassistant/status
  # the devices you accept, for example a Zigbee2MQTT bridge:
  topic read zigbee2mqtt/#
  topic write zigbee2mqtt/+/set
  ```

**Chỉ lắng nghe** dành cho một broker mà HotLoop không được nói trên đó: UNS sản xuất, nhà máy của người khác. HotLoop không bao giờ xuất bản gì ở đó. Không birth, không lệnh. Đó là quy tắc của phiên, không phải của màn hình: việc xuất bản của nó bị từ chối, và cổng ghi từ chối mọi lệnh tới các thiết bị của nó với "the broker plant-uns is listen-only", kể cả chạy thử, ngay cả trên thiết bị ai đó đã chấp nhận và điểm ai đó đã kích hoạt. Thông tin đăng nhập của nó không cần gì ngoài các dòng `topic read`.

Mật khẩu được niêm phong bằng khóa thông tin xác thực thiết bị (`HOTLOOP_SECRET_KEY_FILE`), giống mật khẩu của một bảng điều khiển UniFi, và không bao giờ ra khỏi API trở lại. Không có khóa, một broker có mật khẩu bị từ chối, không được lưu ở dạng rõ. Bản sao lưu mang nó ở dạng niêm phong và khôi phục theo cùng quy tắc như thông tin xác thực của thiết bị ([Sao lưu và khôi phục](/vi/iot/backup/)). Một broker có mật khẩu không mở được sẽ được liệt kê, không kết nối, và nói tại sao.

Đổi một broker và bộ lắng nghe cùng mọi thiết bị từ nó kết nối lại với cài đặt mới. Tắt một cái và các thiết bị của nó vẫn còn, đọc xấu và nói rằng broker của chúng không chạy ở đây. Gỡ một broker kéo theo hộp thư đến của nó, và bị từ chối, nêu tên chúng, trong khi các thiết bị mà ai đó đã chấp nhận từ nó vẫn tồn tại.

## Trên một Edge Relay

Một Edge Relay cũng khám phá, bằng cùng mã, nhưng nó không có cơ sở dữ liệu để giữ một quyết định và không có màn hình để đưa ra quyết định. Vì vậy nó lấy bất cứ thứ gì nó nghe thấy, đọc và chuyển tiếp qua Sparkplug, và không có gì nó tìm thấy có thể được kích hoạt: các tag của nó chỉ đọc như mọi tag đã phát hiện, các thiết bị của nó không bao giờ được chấp nhận, và relay không có đường ghi nào cả. Hãy nêu tên các broker trong tệp thiết bị của nó; xem [tham chiếu Edge Relay](/vi/edge-relay/reference/#khám-phá-41810). Một thiết bị bạn có thể ra lệnh đến đó bằng đường khác: được chấp nhận và kích hoạt trên một Gateway, trong một tệp mà nó đẩy xuống. Nó quên những gì đã nghe khi dừng, và nghe lại từ broker.

## Khởi động lại và phát lại

Các thiết bị đã chấp nhận chạy từ các hàng thiết bị của chúng. HotLoop không cần một thông điệp retained nào để khởi động lại cùng nhà máy.

Broker nhúng không giữ gì qua lần khởi động lại, nên mọi cấu hình đều "thiếu" sau đó. **Một cấu hình thiếu không phải là rút lại**: chỉ cấu hình rỗng tường minh mới là rút lại. Bất cứ thứ gì khác sẽ rút lại toàn bộ nhà máy mỗi khi thiết bị khởi động lại. Cho đến khi một thiết bị gửi trạng thái tiếp theo, các thực thể của nó đọc là không rõ, không bao giờ là giá trị từ trước lần khởi động lại được ngụy trang như hiện tại.

Một broker phát lại hàng trăm cấu hình retained cùng lúc là một lô: hai giây yên lặng, một lượt, một lần tải lại. Phát lại những gì đã có trong hồ sơ không thay đổi gì và không tải lại gì.

## Sao lưu

`mqtt_devices` (ai đã chấp nhận và bỏ qua gì), `mqtt_configs` (mọi cấu hình đúng như khi đến, từng byte) và `mqtt_discovered` (từng thành phần, đã chuẩn hóa) có trong mọi bản sao lưu. Các quyết định là phần mà không thiết bị nào có thể thông báo lại.

## API

Dưới `/api/discovery`. Xem [API HTTP](/vi/iot/api/#khám-phá-mqtt).

## Tìm thấy trên mạng

Cùng màn hình đó liệt kê các thiết bị mà HotLoop nghe thấy trên mạng nhà máy qua mDNS, SSDP và DHCP, được quyết định theo cùng cách. Xem [Khám phá mạng](/vi/iot/network-discovery/).
