---
title: "Báo cáo theo lịch"
description: "Số liệu historian theo lịch dưới dạng CSV hoặc HTML, được lưu và gửi email: chỉ tính các số đọc tốt và mỗi dòng cho biết đã loại bao nhiêu số đọc."
---

Báo cáo theo lịch, từ 4.14.0, chạy theo lịch các báo cáo do vận hành viên định nghĩa: truy vấn historian, xuất kết quả thành CSV và HTML, lưu vào một volume, và tùy chọn gửi qua email. Nó tương đương module Reporting của Ignition ở phần mà một nhà máy dùng nhiều nhất, một bảng số liệu giao đúng giờ. Mặc định tắt (`HOTLOOP_REPORTS_ENABLED`).

## Nó là gì và không là gì

- **Chỉ có API.** Phiên bản này không có màn hình cho tính năng này. Báo cáo được định nghĩa, chạy, liệt kê và tải xuống qua `/api/reports`. Giao diện là một công việc riêng.
- **Chỉ CSV và HTML.** Không có PDF. Tạo một PDF tốt bằng Go thuần, không có tệp nhị phân bên ngoài (ảnh runtime cố ý không có), nghĩa là phải chọn một thư viện PDF và một công cụ dàn trang, và đó là một quyết định riêng. Tệp HTML tự chứa đủ và in gọn gàng từ bất kỳ trình duyệt nào, nên hiện tại đáp ứng được nhu cầu "tôi cần một PDF".
- **Bảng tổng hợp, không phải bố cục tự do.** Một báo cáo là danh sách tag, một khoảng thời gian, kích thước bucket và một tập các phép tổng hợp. Nó không phải trình thiết kế trang.
- **Một instance Gateway.** Bộ lập lịch cho rằng nó là thứ duy nhất chạy báo cáo trên cơ sở dữ liệu này. Hai bản sao sẽ mỗi bản chạy mọi báo cáo. Chart này chạy một bản sao, và volume báo cáo là `ReadWriteOnce`.
- **Không phải tính năng báo động.** Email báo động là một tính năng riêng, [thông báo báo động](/vi/iot/notifications/). Báo cáo dùng chung với nó các thiết lập relay SMTP và không gì khác.

## Định nghĩa một báo cáo

Các định nghĩa là dữ liệu do vận hành viên chỉnh sửa, lưu trong cơ sở dữ liệu như thiết bị, tag, định nghĩa báo động và thành viên đội thiết bị, và được quản lý qua API. Ví dụ:

```json
{
  "id": "line1-daily",
  "name": "Line 1 daily summary",
  "enabled": true,
  "tags": [
    {"deviceId": "press-01", "tagName": "Zone1_Temp"},
    {"deviceId": "press-01", "tagName": "Pressure"}
  ],
  "window": {"count": 1, "unit": "days", "end": "local_midnight"},
  "bucket": "hour",
  "aggregations": ["min", "max", "avg", "count"],
  "schedule": {"kind": "daily", "at": "03:00"},
  "format": "both",
  "recipients": ["ops@example.com"],
  "retain": 30
}
```

| Trường | Ý nghĩa |
|---|---|
| `id` | 1 đến 64 ký tự gồm chữ cái, chữ số, dấu chấm, gạch ngang hoặc gạch dưới, bắt đầu bằng chữ cái hoặc chữ số. Nó đặt tên thư mục của báo cáo trên volume, nên được kiểm tra như mọi id khác trong ứng dụng này. |
| `name` | Hiển thị trong tiêu đề HTML và chủ đề email. Không có ký tự điều khiển. |
| `enabled` | Bộ lập lịch có chạy nó hay không. Báo cáo bị tắt vẫn có thể chạy thủ công. |
| `tags` | 1 đến 50 cặp thiết bị và tag. Mỗi cặp phải tồn tại khi lưu định nghĩa và không được là tag kiểu chuỗi. |
| `window` | Khoảng lịch sử mà mỗi lần chạy bao phủ. Xem bên dưới. |
| `bucket` | `window` (một dòng mỗi tag), `hour` hoặc `day`. Mặc định là `window`. |
| `aggregations` | Một hoặc nhiều trong `min`, `max`, `avg`, `first`, `last` hoặc `count`, mỗi phép tối đa một lần. |
| `schedule` | Xem bên dưới. |
| `format` | `csv`, `html` hoặc `both`. Mặc định là `csv`. |
| `recipients` | Tùy chọn. Chỉ địa chỉ thuần (`ops@example.com`, không phải `Ops <ops@example.com>`). Tối đa 20. |
| `retain` | Số lần chạy cần giữ. 1 đến 1000. Mặc định là 30. |

`PUT` thay thế toàn bộ định nghĩa. Một client có thể đọc báo cáo, đổi một trường và gửi lại nguyên trạng: các trường chỉ đọc mà máy chủ thêm vào (`nextRunAt`, `lastRun`, `lastRunAt`, `createdAt` và `updatedAt`) được chấp nhận và bỏ qua.

Một định nghĩa tạo ra hơn 1000 bucket bị từ chối khi lưu (ví dụ bucket theo giờ trên hơn khoảng 41 ngày).

## Cửa sổ thời gian

Cửa sổ thời gian tính tương đối so với lúc lần chạy diễn ra.

| Bạn muốn | `count` | `unit` | `end` |
|---|---|---|---|
| 24 giờ trước | 24 | `hours` | `run_time` |
| Ngày lịch trước | 1 | `days` | `local_midnight` |
| 7 ngày tròn trước | 7 | `days` | `local_midnight` |
| Một tuần trượt | 7 | `days` | `run_time` |

- `end` là thời điểm lần chạy bắt đầu, hoặc, với `local_midnight`, nửa đêm địa phương gần nhất tại hoặc trước thời điểm đó. Một lần chạy lúc 03:00 kết thúc vào nửa đêm địa phương bao phủ các ngày lịch tròn.
- **Giờ là thời gian trôi qua. Ngày là ngày lịch** theo múi giờ của nhà máy. Cửa sổ một ngày kết thúc vào nửa đêm địa phương là trọn một ngày địa phương, dài 23 giờ vào ngày chỉnh đồng hồ tiến lên và 25 giờ vào ngày chỉnh lùi. "24 giờ trước" luôn là đúng 24 giờ.
- **Cửa sổ là nửa mở**: nó gồm điểm bắt đầu và loại điểm kết thúc. Một số đọc có dấu thời gian đúng nửa đêm thuộc về ngày bắt đầu tại đó. Hai báo cáo ngày liên tiếp không bao giờ cùng đếm một số đọc và không bao giờ cùng bỏ lỡ nó.
- Một lần chạy thủ công và một lần chạy bù tính cửa sổ tại thời điểm chúng chạy.

## Bucket

- `window`: một dòng mỗi tag trên toàn bộ cửa sổ.
- `hour`: một dòng mỗi tag mỗi giờ đồng hồ địa phương. Cửa sổ không bắt đầu đúng giờ sẽ mở đầu bằng một bucket một phần ngắn hơn, và cửa sổ không kết thúc đúng giờ cũng kết thúc bằng một bucket như vậy. Các giờ vẫn đúng giờ khi đổi giờ đồng hồ và ở các múi giờ có độ lệch không phải là số giờ nguyên.
- `day`: một dòng mỗi tag mỗi ngày lịch địa phương.

Mỗi tag có một dòng cho mọi bucket, kể cả bucket không có gì bên trong. Báo cáo không bao giờ bỏ qua giờ mà cảm biến im lặng, vì một báo cáo lặng lẽ bỏ dòng đó sẽ trông giống báo cáo của một cảm biến không có gì để nói. Mỗi dòng nêu đúng khoảng mà nó bao phủ (`period_start` và `period_end`, kèm độ lệch UTC), nên một ngày 23 giờ hiện ra đúng là 23 giờ.

## Phép tổng hợp và quy tắc chất lượng

Các phép tổng hợp là `min`, `max`, `avg`, `first` (số đọc sớm nhất trong kỳ theo dấu thời gian), `last` (số đọc muộn nhất) và `count`.

Báo cáo tuân theo quy tắc chất lượng, cùng quy tắc mà biểu đồ xu hướng tuân theo, nên báo cáo và xu hướng trong cùng một giờ khớp nhau. Một số đọc không có giá trị số (số đọc kiểu chuỗi) cũng bị loại. Không có công tắc cho việc này: một giá trị trung bình lặng lẽ trộn vào các số đọc mà chính historian đã đánh dấu là không đáng tin còn tệ hơn một báo cáo nói rõ nó đã không dùng bao nhiêu số đọc.

Vì vậy mỗi dòng có một cột `excluded`: số số đọc trong kỳ đó bị loại. `count` là số đã dùng. Bản ghi lần chạy và email mang các tổng số.

**Không có gì bị bịa ra.** Một tag không có số đọc dùng được trong một kỳ thì không có giá trị nhỏ nhất, và báo cáo nói vậy: các ô để trống trong CSV và hiện `no data` trong HTML. Chúng không bao giờ là không. Số không là một số đọc (một van đóng, một dòng chảy bằng không) và được tổng hợp như mọi giá trị khác. `count` là cột duy nhất vẫn là một con số khi không có dữ liệu, vì không là một phép đếm đúng của sự trống rỗng.

## Lịch và thời gian

Một lịch là một trong các loại sau:

```json
{"kind": "interval", "every": "6h"}
{"kind": "daily",    "at": "03:00"}
{"kind": "weekly",   "weekday": "monday", "at": "06:30"}
```

- **Khoảng cách** là thời gian trôi qua (ít nhất một phút) và bỏ qua đồng hồ treo tường.
- Giờ **hằng ngày và hằng tuần** là giờ đồng hồ treo tường theo múi giờ của nhà máy, tức `HOTLOOP_TIMEZONE` (`global.timezone` của chart). Nó phải là tên múi giờ thật, như `America/Chicago`. Một tên không dùng được là một lần khởi động bị từ chối, dù báo cáo bật hay tắt, chứ không lặng lẽ quay về UTC, vì một báo cáo dự định chạy lúc 03:00 giờ địa phương mà chạy lúc 03:00 UTC là một lỗi không ai thấy cho đến khi số liệu sai.

### Giờ mùa hè

Lần chạy kế tiếp được tính bằng cách dựng một giờ đồng hồ treo tường tại địa điểm nhà máy với `time.Date`. Nó không bao giờ được tính bằng cách cộng 24 giờ vào lần chạy trước, cách đó sẽ chạy sớm một giờ hoặc muộn một giờ từ lần đổi giờ này sang lần kế tiếp. Hai giờ treo tường rắc rối vào ngày đổi giờ, và quy tắc cho mỗi giờ được cố định trong mã thay vì để cho `time.Date`, vốn có hành vi cho cả hai được ghi nhận là không xác định:

- **Một giờ không tồn tại** (02:30 vào ngày chỉnh tiến, khi đồng hồ nhảy từ 02:00 lên 03:00) chạy vào khoảnh khắc đầu tiên sau khoảng trống, tức 03:00. Nó chạy muộn nhiều nhất bằng độ lớn của khoảng trống và không bỏ qua ngày.
- **Một giờ xảy ra hai lần** (01:30 vào ngày chỉnh lùi) chạy một lần, ở lần xuất hiện đầu tiên.

### last_run_at, lần chạy kế tiếp và chạy bù

`last_run_at` là lúc bộ lập lịch **bắt đầu** báo cáo lần gần nhất, dù lần chạy đó sau đó thành công hay thất bại. Chạy thủ công không làm nó dịch chuyển, nên chạy báo cáo bằng tay lúc 02:00 không hủy lần chạy 03:00 đêm nay.

Lần chạy kế tiếp là thời điểm theo lịch đầu tiên sau mốc muộn nhất trong số lúc tạo định nghĩa, lần sửa gần nhất và `last_run_at`. Tính từ lần sửa gần nhất nghĩa là chuyển một báo cáo từ 03:00 sang 09:00 vào lúc 10:00 sẽ đợi đến ngày mai thay vì chạy ngay cho một giờ đã qua.

**Chạy bù.** Nếu lần chạy kế tiếp sau `last_run_at` đã nằm trong quá khứ khi Gateway khởi động, thì Gateway đã không có mặt để thực hiện nó, và báo cáo chạy **một lần**, ngay lập tức, gắn nhãn `catchup`. Nó không chạy một lần cho mỗi giờ bị lỡ: một báo cáo hằng ngày bị lỡ ba ngày sẽ chạy một lần, vào ngày Gateway trở lại, với cửa sổ có nghĩa tính từ bây giờ. Các ngày bị lỡ không được bù dữ liệu. Sau đó báo cáo trở lại đúng lịch.

`last_run_at` được ghi **trước** khi lần chạy bắt đầu, nên một Gateway chết giữa chừng không lặp lại lần chạy khi khởi động lại chồng lên một email có thể đã được gửi đi. Thay vào đó, lần chạy bị gián đoạn được ghi là thất bại. Một lần chạy theo lịch thất bại không được thử lại; thời điểm theo lịch kế tiếp chạy bình thường, và `POST /api/reports/{id}/run` sẵn đó khi ai đó muốn chạy lại.

## Đầu ra

Mỗi lần chạy ghi tệp dưới `HOTLOOP_REPORTS_DIR` (`/data/reports`, một PVC trong chart):

```
/data/reports/<report id>/<UTC timestamp>-<run id>.csv
/data/reports/<report id>/<UTC timestamp>-<run id>.html
```

- **Tên tệp chỉ được tạo từ một id đã được kiểm tra, một dấu thời gian UTC và id số nguyên của lần chạy.** Việc duyệt đường dẫn bị chặn ngay từ cách xây dựng: id báo cáo phải thỏa cùng quy tắc định danh như mọi nơi khác, và một tên tệp đọc lại từ bản ghi lần chạy được so với đúng mẫu ở trên trước khi mở. `{run}` trong URL tải xuống được phân tích thành số nguyên và chỉ dùng để tra bản ghi lần chạy cùng với id báo cáo. Tệp được mở là tệp mà bản ghi đó nêu tên. Không phần nào của URL trở thành một phần của đường dẫn.
- Tệp được tạo với `O_EXCL` và chế độ `0640`, còn thư mục với `0750`. Tệp đã tồn tại là một lỗi, không bao giờ bị ghi đè. Đầu ra chứa dữ liệu nhà máy và tên tag, nên chế độ này là mức tối thiểu, không thay thế cho việc bảo vệ volume.
- **Lưu giữ.** Sau mỗi lần chạy, `retain` lần chạy mới nhất đã lưu tệp được giữ lại, và các lần cũ hơn bị xóa cùng tệp của chúng. Các lần chạy thất bại, vốn không có tệp, được giữ riêng (`retain` lần mới nhất trong số đó), để một chuỗi thất bại không thể đẩy báo cáo tốt cuối cùng ra ngoài. Mọi tệp trong thư mục của báo cáo khớp với mẫu đặt tên nhưng không được bản ghi lần chạy nào còn lại tham chiếu (tệp dở dang của một lần chạy đã chết) cũng bị gỡ bỏ. Một tệp không khớp với mẫu, chẳng hạn tệp do vận hành viên đặt vào, được để yên.

### CSV

RFC 4180, từ `encoding/csv`, với kết thúc dòng CRLF. Các cột là `device_id`, `tag_name`, `unit`, `period_start`, `period_end`, một cột cho mỗi phép tổng hợp theo thứ tự định nghĩa liệt kê, và `excluded`. Dấu thời gian là RFC 3339 theo múi giờ nhà máy kèm độ lệch. Số được ghi với độ chính xác đầy đủ.

**Chèn công thức vào bảng tính.** Tên tag hoặc đơn vị là văn bản do ai đó gõ, và bảng tính đọc một ô bắt đầu bằng `=`, `+`, `-` hoặc `@` như một công thức. Mọi ô văn bản bắt đầu bằng một trong các ký tự đó (hoặc bằng tab hay ký tự xuống dòng về đầu, hoặc một dấu cách theo sau bởi một trong số đó) được thêm một dấu nháy đơn ở đầu, mà bảng tính hiểu là "đây là văn bản" và không hiển thị. Các cột số được ghi từ số, nên một số đọc âm được để nguyên và vẫn đọc như một con số.

Tệp không có dấu thứ tự byte. Excel mở một CSV UTF-8 không có nó như thể đó là một bảng mã cũ, nên một tên tag có ký tự ngoài ASCII có thể cần được nhập dưới dạng UTF-8.

### HTML

Một tệp tự chứa đủ, dựng bằng `html/template`, nên tên tag và giá trị được thoát ký tự theo nơi chúng xuất hiện: một tag tên `<script>` được ghi như văn bản. Stylesheet nằm trực tiếp trong tệp và không có script, phông chữ, hình ảnh hay liên kết tới đâu cả, vì các triển khai có thể bị cách ly với mạng. Nó cũng mang một thẻ meta `Content-Security-Policy` cấm tải bất cứ thứ gì, và API phục vụ nó với một chính sách thêm `sandbox`, dưới dạng tệp đính kèm.

## Gửi qua email

Nếu một báo cáo có `recipients`, mỗi lần chạy gửi các tệp qua email dưới dạng tệp đính kèm, qua relay SMTP được cấu hình dưới `HOTLOOP_NOTIFY_SMTP_*` (host, cổng, tên người dùng, mật khẩu, người gửi, TLS). Chỉ relay được dùng chung với kênh báo động: kênh đó có bật hay không và báo động gửi cho ai không ảnh hưởng gì đến báo cáo, nên một triển khai có thể gửi báo cáo qua email mà không gọi ai. Chart ghi các biến của relay chỉ cho báo cáo khi kênh báo động tắt.

Đó là cùng một mã SMTP với kênh báo động, không phải bản sao thứ hai. Kênh báo động giờ cũng gửi qua nó. Việc xử lý kết nối không đổi (cổng 465 giờ nói TLS từ byte đầu tiên, xem [Thông báo báo động](/vi/iot/notifications/#tls-ngầm-định-cổng-465)): STARTTLS bất cứ khi nào relay cung cấp, `AUTH` khi có thông tin xác thực, và một lỗi cứng trước `AUTH` khi `HOTLOOP_NOTIFY_SMTP_TLS` được đặt mà relay không cung cấp STARTTLS. Với báo động ASCII, thông điệp có cùng các byte như trước, trừ tiêu đề `Date`, và một bài kiểm thử cố định điều đó. Chủ đề báo động ngoài ASCII giờ được gửi dưới dạng từ mã hóa RFC 2047 thay vì UTF-8 thô.

Thông điệp là `multipart/mixed`: một phần văn bản quoted-printable, rồi mỗi tệp mã hóa base64. **Chèn vào tiêu đề bị từ chối, không được làm sạch.** Người nhận, người gửi, chủ đề và tên tệp đính kèm được kiểm tra: một giá trị có CR, LF hoặc ký tự điều khiển khác, một người nhận ở dạng tên hiển thị hoặc chứa danh sách, hoặc một tên tệp có dấu nháy hay đường dẫn khiến thông điệp thất bại trước khi gửi bất cứ gì tới relay. Chủ đề riêng của kênh báo động là ngoại lệ duy nhất, vì một cuộc gọi báo động phải đi ra dù báo động tên gì: nó biến các ký tự điều khiển thành dấu cách trước.

- **Chưa cấu hình relay.** Một báo cáo có người nhận vẫn chạy và lưu tệp, và lần chạy được ghi là `failed`, với `emailStatus` `failed` và một lỗi nói rằng relay chưa được cấu hình. Nó không thành công trong im lặng.
- **Quá lớn.** `HOTLOOP_REPORTS_MAX_EMAIL_BYTES` (10 MiB) giới hạn dữ liệu đính kèm trong một email. Báo cáo vượt mức này vẫn được lưu và tải xuống được, và lần chạy của nó ghi lại vì sao nó không được gửi qua email.
- Một lần chạy thủ công có thể bỏ qua email bằng `?deliver=false`.

## Bản ghi lần chạy và dấu vết kiểm toán

Mọi lần chạy được ghi trong `report_runs` từ lúc nó bắt đầu: lúc bắt đầu và kết thúc, bộ kích hoạt (`schedule`, `catchup` hoặc `manual`), ai yêu cầu, cửa sổ, kết quả và nội dung lỗi, số tag, dòng, số đọc đã tổng hợp và số đọc bị loại, các tệp đã lưu, kết quả email và người nhận, cùng ghi chú (ví dụ, một tag đã bị xóa kể từ đó và đang được báo cáo từ lịch sử đã ghi). Thành công và thất bại cũng được ghi qua `rt.Event`, cùng dấu vết kiểm toán mà báo động và hành động đội thiết bị dùng, với id báo cáo làm đối tượng.

Một lần chạy bị cắt ngang do tắt máy, do giới hạn thời gian (`HOTLOOP_REPORTS_RUN_TIMEOUT`) hoặc do báo cáo bị xóa được ghi là thất bại kèm lý do đó. Một lần chạy bị một tiến trình đã chết để lại ở `running` được đánh dấu thất bại khi Gateway khởi động lần tới. Mỗi lúc chỉ có một lần chạy của một báo cáo đang diễn ra; yêu cầu thứ hai trong khi một lần đang chạy nhận `409`.

## API

| Route | Quyền | <span class="sr-only">Chi tiết</span> |
|---|---|---|
| `GET /api/reports` | `reports.read` | Mọi định nghĩa, mỗi định nghĩa kèm `nextRunAt` và lần chạy gần nhất |
| `POST /api/reports` | `reports.write` | Tạo. `409` nếu id đã tồn tại |
| `GET /api/reports/{id}` | `reports.read` | Một định nghĩa |
| `PUT /api/reports/{id}` | `reports.write` | Thay thế. Không thể đổi id |
| `DELETE /api/reports/{id}` | `reports.write` | Xóa, cùng các lần chạy và tệp của nó. Lần chạy đang diễn ra bị hủy trước |
| `POST /api/reports/{id}/run` | `reports.run` | Chạy ngay và chờ. `?deliver=false` bỏ qua email |
| `GET /api/reports/{id}/runs` | `reports.read` | Bản ghi lần chạy, mới nhất trước (`?limit=`, tối đa 500) |
| `GET /api/reports/{id}/runs/{run}/download?format=csv\|html` | `reports.read` | Truyền một tệp đã lưu dưới dạng tệp đính kèm |

`POST .../run` trả về bản ghi lần chạy với `200` dù lần chạy có thành công hay không. Trạng thái cho biết yêu cầu có được thực hiện hay không, còn `status` của chính bản ghi cho biết báo cáo có thành công hay không. Một lần chạy thất bại là một kết quả, và được ghi trong cả hai trường hợp. Lần chạy không gắn với kết nối của client: ngắt kết nối không hủy một báo cáo có thể đã bắt đầu gửi email.

Khi tính năng tắt, danh sách trả lời `{"reports": [], "configured": false}` và mọi route khác trả lời bằng một lỗi nêu tên `HOTLOOP_REPORTS_ENABLED`.

### Ai được làm gì

| Vai trò | `reports.read` | `reports.run` | `reports.write` |
|---|---|---|---|
| người xem | có | không | không |
| vận hành viên | có | có | không |
| quản trị viên | có | có | có |

- **Đọc** dành cho người xem vì một báo cáo đã lưu là tổng hợp của lịch sử mà người xem vốn đã đọc được qua `values.read`, nên đọc hay tải nó xuống không cấp thêm gì mới.
- **Chạy** dành cho vận hành viên vì chạy một báo cáo chỉ gửi tới những người nhận mà quản trị viên đã chọn, và có thể chạy mà không gửi.
- **Ghi chỉ dành cho quản trị viên.** Một định nghĩa nêu các địa chỉ mà đầu ra được gửi email tới, nên có thể định nghĩa một báo cáo là có thể gửi dữ liệu nhà máy tới một địa chỉ bất kỳ theo lịch. Về bản chất, nó gần với `notify.test` và `fleet.config` (cũng chỉ dành cho quản trị viên, cũng "làm điều gì đó ra thế giới bên ngoài") hơn là một thao tác đọc. Đây là một phán đoán, và có thể xem xét lại nếu một quy trình làm việc thực tế cần vận hành viên tạo báo cáo.
- Một vận hành viên vẫn có thể khiến một email gửi tới người nhận của báo cáo bằng cách chạy nó, và lặp lại. Có một rào chắn mỗi lúc một lần chạy và `?deliver=false`, nhưng không có giới hạn tần suất.
- Một người dùng có danh sách quyền tường minh giữ đúng những gì nó nêu; ký tự đại diện `reports.*` bao gồm cả ba.

## Cấu hình

| Biến | Mặc định | <span class="sr-only">Chi tiết</span> |
|---|---|---|
| `HOTLOOP_REPORTS_ENABLED` | `false` | Tính năng tắt, kể cả bộ lập lịch, cho đến khi đặt biến này |
| `HOTLOOP_REPORTS_DIR` | `/data/reports` | Nơi ghi tệp của mỗi lần chạy. Dự định là một PVC (`reports.persistence` trong chart) |
| `HOTLOOP_REPORTS_RUN_TIMEOUT` | `5m` | Giới hạn một lần chạy: truy vấn, kết xuất, ghi và email |
| `HOTLOOP_REPORTS_MAX_EMAIL_BYTES` | `10485760` | Lượng dữ liệu đính kèm tối đa trong một email |
| `HOTLOOP_TIMEZONE` | `UTC` | Múi giờ nhà máy. Phải là tên múi giờ thật, nếu không HotLoop sẽ không khởi động |
| `HOTLOOP_NOTIFY_SMTP_HOST`, `_PORT`, `_USERNAME`, `_PASSWORD`, `_FROM`, `_TLS`, `_TLS_SKIP_VERIFY` | | Relay mà báo cáo gửi email qua. Xem [Thông báo báo động](/vi/iot/notifications/) |

Khối `reports` của chart có `enabled`, `runTimeout`, `maxEmailBytes` và `persistence` (kích thước, lớp lưu trữ, chế độ truy cập). `notify.smtp` cung cấp relay. Báo cáo không được khởi động ở chế độ `--mcp-stdio`, là chế độ một tác nhân khởi chạy tệp nhị phân như một trợ giúp, và bộ lập lịch thứ hai bên cạnh Gateway thật sẽ chạy mọi báo cáo đến hạn hai lần.

## Sao lưu

Định nghĩa báo cáo và bản ghi lần chạy là dữ liệu người dùng và là một phần của bản sao lưu cơ sở dữ liệu. Các tệp đầu ra thì không: chúng nằm trên volume báo cáo, và khôi phục một bản sao lưu vào một triển khai mới đưa các bản ghi trở lại nhưng không đưa các tệp, nên tải xuống một lần chạy cũ ở đó sẽ trả lời rằng tệp không còn trên đĩa. Hãy sao chép volume báo cáo nếu các tệp quan trọng.

Thêm hai bảng này vào danh sách sao lưu là kiểu thay đổi dễ bị quên, nên gói sao lưu giờ có các rào chắn cho việc đó. Một bài kiểm thử liệt kê mọi bảng trong lược đồ và thất bại nếu có bảng không nằm trong `backup.Tables` cũng không nằm trong một danh sách loại trừ tường minh kèm lý do. Bài khác kiểm tra `Tables` theo thứ tự khóa ngoại, đọc các khóa ngoại từ cơ sở dữ liệu. Bài kiểm thử khứ hồi gieo một định nghĩa báo cáo và một lần chạy rồi kiểm tra các giá trị được khôi phục và chuỗi số.

## Điều đã được kiểm chứng và điều chưa

HotLoop đã được chạy trên thiết bị thật và máy chủ thật, và trên phần cứng thật vào 2026-11-17.
