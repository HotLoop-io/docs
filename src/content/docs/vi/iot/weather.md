---
title: "Thời tiết"
description: "Một trạm thời tiết trên mái là một thực thể, với điểm sương, chỉ số nhiệt và chỉ số rét do gió tính ngay trên hộp, không gọi dịch vụ đám mây nào."
---

Một trạm thời tiết trên mái nhà máy, hiện ra trên màn hình như một thứ duy nhất. HotLoop không gọi điện cho ai để biết trời đang mưa. Trạm sẽ cho biết: một Ecowitt hoặc Tempest qua MQTT, một Davis hoặc Vaisala qua Modbus, bất cứ thứ gì qua OPC UA. Một số đọc từ bất kỳ thiết bị nào trong số đó đã là một tag, và thực thể thời tiết là các tag của một trạm, mỗi tag giữ một vai trò: nhiệt độ, độ ẩm, áp suất, gió, mưa và ánh nắng.

Không dịch vụ thời tiết, không khóa API, không internet. Một địa điểm mất đường truyền lên từ ba tuần trước vẫn hiển thị nhiệt độ trên mái của chính nó. (Về vị trí mặt trời, xem [mặt trời](/vi/iot/sun/); vị trí này được tính từ vĩ độ và kinh độ của địa điểm và không cần trạm nào cả.)

## Tạo một trạm

Một thực thể thời tiết được tạo giống như một động cơ (xem [Thực thể](/vi/iot/entities/#thiết-bị-ghép)): quản trị viên đặt tên các tag. Trên màn hình Thực thể, chọn Thiết bị mới, Thời tiết. Hoặc qua API:

```json
POST /api/entities
{
  "domain": "weather",
  "name": "Roof station",
  "bindings": [
    {"role": "temperature", "device_id": "roof", "tag_name": "Temp"},
    {"role": "humidity",    "device_id": "roof", "tag_name": "Humidity"},
    {"role": "wind_speed",  "device_id": "roof", "tag_name": "Wind"},
    {"role": "wind_bearing","device_id": "roof", "tag_name": "Bearing"}
  ]
}
```

Chỉ `temperature` là bắt buộc. Trạm không có máy đo mưa thì không có `rain_rate` và không hiển thị dòng mưa. Mỗi vai trò nhận một tag số và không vai trò nào được ghi: trạm chỉ được đọc, không bao giờ bị ra lệnh, nên không tag nào cần kích hoạt và thực thể không nhận dịch vụ.

| Vai trò | <span class="sr-only">Chi tiết</span> | Thuộc tính tạo ra |
|---|---|---|
| `temperature` | bắt buộc, là trạng thái | `unit_of_measurement` |
| `humidity` | độ ẩm tương đối, phần trăm | `humidity` |
| `pressure` | áp suất không khí, theo đơn vị của tag | `pressure` |
| `wind_speed` | gió trung bình | `wind_speed` |
| `wind_gust` | cơn gió giật mạnh nhất gần đây | `wind_gust` |
| `wind_bearing` | hướng gió thổi tới, từ 0 đến 360 độ | `wind_bearing` |
| `rain_rate` | hiện đang mưa mạnh đến đâu | `rain_rate` |
| `rain_today` | lượng mưa từ nửa đêm | `rain_today` |
| `solar_radiation` | ánh nắng trên cảm biến, thường tính bằng W/m² | `solar_radiation` |
| `uv_index` | chỉ số UV | `uv_index` |

Mỗi thuộc tính còn có `<name>_unit` với đơn vị của tag đó, để màn hình không bao giờ phải đoán áp suất đang tính bằng hPa hay inHg.

## Những gì được tính trên hộp

Ba giá trị mà một trạm hiếm khi gửi, được tính từ chính các số đọc của nó:

| Thuộc tính | Từ | Cách tính |
|---|---|---|
| `dew_point` | nhiệt độ, độ ẩm | Công thức Magnus (Sonntag 1990), đối chiếu với các bảng ẩm kế từ 0 đến 30 °C |
| `heat_index` | nhiệt độ, độ ẩm | Hồi quy Rothfusz của Cơ quan Thời tiết Quốc gia Hoa Kỳ (NWS) với hai điều chỉnh đã công bố. Chỉ có từ 80 °F (26,7 °C) trở lên, vì đó là nơi NWS thôi dùng nó |
| `wind_chill` | nhiệt độ, tốc độ gió | Chỉ số NWS năm 2001. Chỉ có ở 50 °F (10 °C) trở xuống với gió trên 3 mph, khoảng mà nó được hiệu chỉnh |

Chúng được trả về theo đơn vị riêng của nhiệt độ, nên một trạm dùng độ Fahrenheit sẽ có điểm sương tính bằng độ Fahrenheit. Các đơn vị nhiệt độ HotLoop quy đổi là °C, °F và K, còn đơn vị gió là m/s, km/h, mph, hải lý/giờ và ft/s, đọc từ đơn vị của tag. Tag nhiệt độ không có đơn vị sẽ không được quy đổi bằng cách đoán: `unit_of_measurement` của chính thực thể có thể cho biết đơn vị, và nếu không có cả hai thì không tính gì từ nó.

Việc thiếu chỉ số nhiệt và chỉ số rét do gió không phải là lỗi. Dưới 80 °F không có chỉ số nhiệt, và trong không khí lặng hay ấm thì không có chỉ số rét do gió, nên thẻ không có dòng cho chúng.

## Số đọc bị thiếu không phải là số không

Một thực thể thời tiết không bao giờ lạc quan, và không bao giờ lấp chỗ trống bằng một con số.

* Cảm biến chưa được gắn thì không có dòng.
* Cảm biến đã gắn nhưng hiện không đọc được (tag của nó xấu, thiết bị của nó ngừng hoạt động, chưa có gì đến) sẽ bị bỏ khỏi các thuộc tính và được nêu tên trong `unavailable`. Thẻ ghi **Không khả dụng** ở chỗ lẽ ra là con số của nó.
* Một số đọc không thể là phép đo được xử lý như vậy: độ ẩm trên 105 phần trăm, hướng nằm ngoài 0 đến 360 độ, lượng mưa hoặc tốc độ gió âm. Độ ẩm 101 hoặc 102, mà cảm biến trong sương mù có thể đọc, được hiển thị là
  100. Số đọc âm nhỏ của một nhật xạ kế vào ban đêm được hiển thị là 0.
* Một giá trị tính từ số đọc không khả dụng cũng không khả dụng, và được nêu tên: không có độ ẩm thì không có `dew_point` và `heat_index`.
* Nếu không đọc được nhiệt độ, trạng thái là `unknown` (hoặc `unavailable` khi thiết bị ngừng hoạt động), với chất lượng thông thường, và phần còn lại của thẻ vẫn hiển thị những gì các cảm biến khác báo.

## Trên màn hình

Trên màn hình Thực thể, một trạm thời tiết là một ô: nhiệt độ cỡ chữ lớn, và bên dưới là một dòng cho mỗi số đọc mà trạm cung cấp, theo thứ tự cố định (độ ẩm, áp suất, gió, hướng gió, gió giật, cường độ mưa, mưa hôm nay, ánh nắng, chỉ số UV, điểm sương, chỉ số nhiệt, chỉ số rét do gió). Nhiệt độ có đường xu hướng quen thuộc. Thẻ được đọc bằng mọi ngôn ngữ của giao diện và bố trí từ phải sang trái trong tiếng Ả Rập.

## MCP

Các tác nhân đọc và tạo trạm bằng những công cụ mà mọi thực thể đều có, cùng một công cụ cho biết trạm nhận những gì:

| Công cụ | Làm gì |
|---|---|
| `list_composite_entities` | Đọc những gì `create_entity` có thể tạo, mỗi miền với các vai trò của nó, vai trò nào bắt buộc và vai trò nào do dịch vụ ghi. Thời tiết có mười vai trò, một bắt buộc, và không có dịch vụ |
| `create_entity` | Tạo một trạm từ các tag, như `POST /api/entities`. Cần có lý do và công tắc ghi của MCP như mọi thay đổi |
| `get_states` | Đọc một trạm: trạng thái là nhiệt độ, và đoạn văn bản mà mô hình đọc liệt kê mọi thuộc tính bên cạnh, kể cả `unavailable` |
| `list_entities` | Tìm các trạm bằng `domain: weather` |
| `delete_entity` | Xóa một trạm |

`call_service` trên một thực thể thời tiết bị từ chối: nó không nhận dịch vụ.

## Những gì nó không làm

* Không dự báo. Không có dự báo nếu không hỏi một bên khác, và HotLoop không làm vậy.
* Không ghi nhiệt độ của một trạm thành các dòng nhật ký, giống như không cảm biến nào làm. Lịch sử là của tag: đường xu hướng trên ô là của tag nhiệt độ, và mọi tag khác nằm trong historian như bất kỳ tag nào.
* Không đọc trạm thay bạn. Trạm đến trước hết dưới dạng các tag: hãy thêm thiết bị của nó (MQTT, Modbus hoặc OPC UA), rồi gắn các tag.
