---
title: "Năng lượng"
description: "Đồng hồ đo theo khoảng 15 phút, biểu giá tính tiền từng khoảng khi nó được tạo, phí công suất, ca làm việc và chi phí của một đơn vị sản phẩm."
---

Nhà máy dùng gì và tốn bao nhiêu: kilowatt giờ, khí, nước, khí nén và chi phí của một đơn vị sản phẩm, trên một màn hình, làm cho xưởng sản xuất. Không cần phần cứng mới và không có giao thức mới. Đồng hồ đo là một tag mà HotLoop vốn đã đọc, và đây là phần sổ sách đặt lên trên nó: những gì tag đã đếm, lưu trong cơ sở dữ liệu và được tính giá.

## Một đồng hồ đo

Một đồng hồ đo đọc một tag như một lượng đã dùng. Nó có một trong hai chế độ.

| Chế độ | Tag là | Lượng đã dùng là |
|---|---|---|
| `counter` | một số đếm tích lũy: một thanh ghi kWh, một bộ tích lũy khí, các xung của đồng hồ nước | nó đã dịch chuyển bao nhiêu, nhân với `factor` của đồng hồ đo |
| `power` | một tốc độ: số kW đang tiêu thụ ngay lúc này, tính bằng `W`, `kW` hoặc `MW` | trung bình của hai số đọc trong khoảng thời gian giữa chúng |

`factor` là giá trị của một bước đếm theo đơn vị của đồng hồ đo: `0.001` đổi thanh ghi tính bằng Wh thành kWh, `0.01` nghĩa là một xung bằng một phần trăm mét khối. Nếu bỏ qua thì là 1. Đồng hồ đo công suất không nhận hệ số: `power_unit` và `unit` của nó (`Wh`, `kWh` hoặc `MWh`) cho biết cách quy đổi.

| Loại | Dành cho | Đơn vị thường dùng |
|---|---|---|
| `electricity` | kWh | kWh |
| `gas` | khí | m³ |
| `water` | nước | m³ |
| `air` | khí nén | m³ |
| `heat` | hơi nước, nước nóng, nhiệt | kWh |
| `production` | số đơn vị đã sản xuất | đơn vị |

Đồng hồ đo `production` đếm những gì dây chuyền đã làm ra. Nó không có biểu giá, và chi phí của một đơn vị được chia cho nó.

Tạo một cái trên màn hình Năng lượng (Đồng hồ đo mới) hoặc bằng `POST /api/energy/meters` (xem [API HTTP](/vi/iot/api/#energy)). Chỉ quản trị viên mới tạo, thay đổi hoặc gỡ một đồng hồ đo (`energy.write`); ai cũng đọc được (`energy.read`). Tag phải tồn tại và là một con số. Nếu tag bị xóa sau đó, đồng hồ đo cho biết nó đang chờ, và nhận lại tag khi nó được tạo lại.

## Cách đếm

Cứ mười giây, bộ máy đọc tag của mỗi đồng hồ đo từ cùng bộ nhớ đệm mà mọi màn hình đọc, và tính xem mỗi số đọc mới cộng thêm gì. Phần cộng thêm đi vào các khoảng 15 phút, trong cơ sở dữ liệu, trong cùng giao dịch với số đọc cuối của đồng hồ đo. Vì vậy khởi động lại không mất gì và không đếm gì hai lần.

* **Bộ đếm tích lũy** cộng thêm phần nó đã dịch chuyển kể từ số đọc cuối, phân bổ trên khoảng thời gian giữa hai số đọc theo tỷ lệ thời gian nằm trong mỗi khoảng.
* **Bộ đếm chạy ngược** đã bị đặt lại hoặc được thay. Không có gì cho biết đã dùng bao nhiêu, nên không cộng gì: giá trị mới là điểm xuất phát mới, và đồng hồ đo đếm lần đặt lại đó (`status.resets`).
* **Bộ đếm vẫn tiếp tục đếm trong lúc HotLoop tắt.** Phần dịch chuyển là thật và được giữ lại toàn bộ, phân bổ đều qua khoảng trống, và mọi khoảng mà nó chạm tới đều được đánh dấu **ước tính**. Khoảng trống là hơn mười phút giữa hai số đọc.
* **Công suất** là trung bình của hai số đọc trong khoảng thời gian giữa chúng. Với khoảng trống hơn mười phút thì không có gì: đồng hồ đo không bịa ra công suất cho khoảng thời gian không ai đọc, và khoảng trống được đếm (`status.gap_seconds`). Mỗi khoảng cho biết bao nhiêu trong 900 giây của nó có số đọc (`covered_seconds`), và màn hình ghi "Đã đọc cho 63% của kỳ" khi đồng hồ đo công suất không được đọc trong một phần của kỳ. Một số đọc công suất không dùng gì vẫn bao phủ thời gian của nó.
* **Số đọc xấu** (chất lượng của tag không tốt) không cộng gì, và đồng hồ đo nói điều đó trên thẻ của nó kèm lý do. Bộ đếm tích lũy không được đọc rồi trở lại sẽ đếm phần nó đã dịch chuyển trong lúc đó, như một khoảng trống.
* **Số đọc không lưu được** được tính lại ở chu kỳ kế tiếp từ cùng điểm xuất phát.

## Chi phí

Biểu giá tính tiền từng khoảng khi nó được tạo: một `price` cố định cho mỗi đơn vị và tùy chọn `bands` cho biểu giá theo giờ. Một dải là `from` và `to` trên một phần tư giờ theo đồng hồ riêng của địa điểm (`to` trước `from` kéo qua nửa đêm), các `days` mà nó áp dụng (`mon` đến `sun`, mọi ngày nếu bỏ qua) và một `price`. Dải đầu tiên có hiệu lực tại thời điểm đó thắng; ngoài mọi dải thì giá cố định áp dụng. Một khoảng được tính giá tại điểm giữa của thời gian mà mỗi số đọc bao phủ.

Vì chi phí được lưu cùng khoảng, **một mức giá thay đổi sau đó không làm thay đổi chi phí của tháng trước.** Đổi biểu giá của một đồng hồ đo thay đổi những gì nó đếm từ đó trở đi.

`currency` là một mã hoặc một ký hiệu. Chi phí bằng hai đơn vị tiền tệ không bao giờ được cộng với nhau: phần tóm tắt có một chi phí cho mỗi loại.

### Phí công suất

Đồng hồ điện tính bằng `Wh`, `kWh` hoặc `MWh` có thể có `demand_price` trong biểu giá của nó: giá của một kilowatt trong phần tư giờ cao nhất của nhà máy. Trong một cửa sổ, công suất yêu cầu của một khoảng là số kilowatt trung bình nó đạt (một phần tư giờ dùng 25 kWh có trung bình 100 kW) và phí của nó là số đó nhân với giá công suất mà đồng hồ đo có khi khoảng này được tạo. Phí của cửa sổ là mức cao nhất trong số đó, mà với một mức giá thì là đỉnh nhân với giá. Phần tóm tắt cung cấp cho mỗi đồng hồ như vậy một `demand` gồm đỉnh tính bằng kW, thời điểm nó bắt đầu và khoản phí, và đưa khoản phí vào chi phí của cửa sổ và chi phí của một đơn vị sản phẩm. `cost` của chính đồng hồ đo vẫn là chi phí năng lượng.

Giống giá năng lượng, giá công suất được lưu cùng mỗi khoảng khi nó được tạo (migration 0030), nên **đổi giá công suất làm thay đổi những gì được đếm từ đó trở đi và không bao giờ đổi tháng đã qua.** Các khoảng được tạo trước khi đồng hồ đo có giá công suất không mang giá nào: chúng hiện một đỉnh và không có phí.

Công ty điện lực tính phí công suất theo tháng thanh toán của họ, nên hãy yêu cầu `this_month` hoặc `last_month` để thấy dòng trên hóa đơn; cửa sổ ngắn hơn cho khoản phí của phần tư giờ cao nhất bên trong nó. Nếu phần tư giờ đỉnh không được đọc đầy đủ (`peak_covered_seconds` dưới 900), đỉnh bị đánh giá thấp, và màn hình nói điều đó. Các cảm biến `Today` bên dưới chỉ đếm năng lượng: phí công suất là một dòng của hóa đơn tháng, không phải thứ tích lũy suốt cả ngày.

## Chi phí của một đơn vị sản phẩm

Chi phí trong một cửa sổ của các đồng hồ có giá mà bạn chọn, chia cho những gì một đồng hồ sản xuất đã đếm trong cùng cửa sổ. Phần tóm tắt cho một giá trị với mỗi đồng hồ sản xuất và mỗi loại tiền. Khi chưa làm ra gì, chi phí mỗi đơn vị là `null` với `reason` là `nothing_made`, và màn hình ghi "Chưa sản xuất gì": đó là không có câu trả lời, không phải bằng không hay phép chia cho không. Tương tự khi đã sản xuất mà chưa đồng hồ có giá nào đếm được mức dùng (`nothing_counted`, "Chưa đếm được năng lượng nào"): các đồng hồ được đọc lần lượt, nên một thanh ghi chưa nhúc nhích không có nghĩa là sản phẩm miễn phí. Một đồng hồ đã đếm được gì đó với giá bằng không vẫn được tính, và cho chi phí bằng không.

`GET /api/energy/summary?period=today&meters=line2-electricity,line2-air&per=line2-parts` tính nó cho một dây chuyền: `meters` nêu các đồng hồ có chi phí được đưa vào, `per` là đồng hồ sản xuất. Nếu không có chúng, đó là mọi đồng hồ có giá chia cho mọi đồng hồ sản xuất.

## Cửa sổ

`period` là `today`, `yesterday`, `this_week` (tuần bắt đầu vào thứ Hai), `last_week`, `this_month`, `last_month`, `last_7_days` hoặc `last_30_days`, một ca làm việc, hoặc đưa `from` và `to` theo RFC 3339 (tối đa 400 ngày). Ngày, tuần và tháng là **của địa điểm**, theo múi giờ riêng của nó (`HOTLOOP_TIMEZONE`): nửa đêm là nửa đêm của nhà máy, và ngày dài 23 hay 25 giờ là ngày thật. Một ca được viết `shift:06:00-14:00`, từ và đến trên một phần tư giờ theo đồng hồ của địa điểm, và `to` không sau `from` thì kéo qua nửa đêm (`shift:22:00-06:00`). `shift:` là ca bắt đầu gần nhất, tức là ca đang chạy nếu có, và `last_shift:` là ca trước đó. Một ca được dựng từ ngày theo lịch, nên đêm đổi giờ dài đúng bằng thực tế. Màn hình có ô Ca cạnh các kỳ, và cùng những tên đó dùng trong kỳ của các công cụ MCP. Chuỗi được cắt theo bước `quarter` (tối đa 8 ngày), `hour`, `day` hoặc `month`.

## Trên màn hình

Màn hình Năng lượng (nhóm Nhà máy) có bộ chọn kỳ, chi phí của kỳ, chi phí mỗi đơn vị sản phẩm cho từng đồng hồ sản xuất và một thẻ cho mỗi đồng hồ đo: nó đã dùng gì, tốn bao nhiêu, một cột cho mỗi giờ (hoặc ngày) và, khi áp dụng, nó có đang được đọc không, một phần có phải ước tính không và đồng hồ công suất được đọc trong bao nhiêu phần của kỳ. Cột có viền nét đứt là ước tính. Đồng hồ không đọc được cho biết lý do. Mọi từ đều có trong cả 14 ngôn ngữ.

## Thực thể

Mỗi đồng hồ đo cho các cảm biến mà mọi màn hình và quy tắc đều dùng được:

| Thực thể | Trạng thái |
|---|---|
| `sensor.<meter>_today` | lượng đồng hồ đã dùng từ nửa đêm của địa điểm, theo đơn vị của nó |
| `sensor.<meter>_cost_today` | chi phí của lượng đó (đồng hồ có giá) |
| `sensor.<production meter>_cost_per_unit_today` | chi phí hôm nay chia cho số đơn vị sản xuất hôm nay. `unknown` cho đến khi có gì đó được sản xuất, và khi các đồng hồ được định giá bằng hai loại tiền |

Chúng thuộc nền tảng `energy`, chúng đọc, và không nhận dịch vụ nào. Một đồng hồ đo đã ngừng phản hồi vẫn là những gì nó đã dùng cho đến lúc đó, với chất lượng `uncertain` và `meter_status` cho biết lý do.

## MCP

Các tác tử đọc và quản lý đồng hồ đo qua cùng những tuyến này:

| Công cụ | Làm gì |
|---|---|
| `list_energy_meters`, `get_energy_meter` | các đồng hồ đo, cách mỗi cái được đọc, và mức dùng và chi phí hôm nay |
| `get_energy_summary` | mỗi đồng hồ đã dùng và tốn bao nhiêu trong một kỳ có tên, chi phí theo từng loại tiền và chi phí của một đơn vị sản phẩm |
| `get_energy_series` | mức dùng của một đồng hồ trong một kỳ có tên, theo từng bước |
| `create_energy_meter`, `update_energy_meter`, `delete_energy_meter` | tạo, thay đổi và gỡ một đồng hồ đo. Mỗi cái cần một lý do và được kiểm toán |

Các bộ lọc `meters` và `per` của chi phí mỗi đơn vị là tham số truy vấn REST.

## Sao lưu và cập nhật

Ba bảng lưu nó (migration 0029): `energy_meters`, `energy_meter_state` và `energy_buckets`, tất cả đều có trong bản sao lưu. Migration 0030 thêm giá công suất vào các đồng hồ đo và vào mỗi khoảng. Các migration chỉ thêm vào. Một khoảng khoảng 100 byte, nên một đồng hồ đo khoảng 3,5 MB mỗi năm.

## Những gì nó không làm

* **Nó không biết các ca của bạn.** Một ca được nêu trong yêu cầu, như `shift:06:00-14:00`; không có danh sách các ca của nhà máy để chọn, và một ca không rơi vào một phần tư giờ bị từ chối vì các khoảng là các phần tư giờ.
* **Nó không tính phí công suất thay bạn.** Khoản phí là phần tư giờ cao nhất trong cửa sổ nhân với giá; các bậc thang, công suất tối thiểu và phí hệ số công suất của công ty điện lực không có trong đó.
* **Nó không đọc đồng hồ đo thay bạn.** Tag đến trước: hãy thêm thiết bị (Modbus, MQTT, OPC UA, hoặc Emberburn cho thiết bị mô phỏng), rồi tạo đồng hồ đo.
