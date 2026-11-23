---
title: "Nhật ký"
description: "Thay đổi trạng thái, thao tác ghi, báo động, lần chạy quy tắc và thay đổi cấu hình trên một dòng thời gian, cho cả nhà máy, một khu vực hay một thực thể."
---

Một dòng thời gian duy nhất về những gì đã xảy ra trong nhà máy, mới nhất trước: máy bơm đã bật, ai đó ghi 180 vào điểm đặt của vùng 1, báo động nhiệt độ cao được kích hoạt rồi được xác nhận, tự động hóa làm nguội đã chạy, một thiết bị được cấu hình lại. Cho cả nhà máy, một vị trí trên cây thiết bị cùng mọi thứ bên dưới, hoặc một thực thể. Đó là tab Nhật ký, một mục trong ngăn kéo của mỗi thực thể, `GET /api/logbook` (xem [API HTTP](/vi/iot/api/#nhật-ký-sự-kiện)) và công cụ MCP `get_logbook` (xem [MCP](/vi/iot/mcp/)).

Câu hỏi đầu tiên khi có gì đó hỏng là "ngay trước đó đã xảy ra chuyện gì?", và cho đến nay câu trả lời nằm ở năm nơi: kiểm toán thao tác ghi, lịch sử báo động, các lần chạy tự động hóa, nhật ký hệ thống, và trí nhớ của không ai về những gì chính thiết bị đã làm. Nhật ký là năm thứ đó trong một danh sách.

## Những gì có trong đó

| Loại | Từ | Một dòng cho biết |
|---|---|---|
| `state` | `entity_state_log` | trạng thái của một thực thể đã thay đổi: `changed to on (was off)` |
| `write` | `write_audit` | một thao tác ghi vào tag, đã ghi, bị từ chối hoặc thất bại, do ai và qua cổng nào |
| `alarm` | `alarm_events` | một báo động được kích hoạt, xác nhận, xóa, hoãn, kèm ghi chú đã nêu |
| `automation` | `automation_runs` | một quy tắc đã chạy, kết thúc thế nào, cái gì đã khởi động nó |
| `event` | `events` | thay đổi cấu hình, tóm tắt các lệnh gọi dịch vụ và lý do được nêu cho các thao tác ghi, cùng những gì một bảng điều khiển UniFi báo ngay lúc nó xảy ra, được xếp dưới công tắc mạng hoặc điểm truy cập mà nó nói tới (công tắc mất liên lạc là một cảnh báo) |
| `script` | `script_runs` | một [tập lệnh](/vi/iot/scripts/) đã chạy, kết thúc thế nào, ai đã khởi động và cái gì đã gọi nó |
| `recipe` | `recipe_applications` | một [công thức](/vi/iot/recipes/) đã được áp dụng hoặc bị từ chối: phiên bản nào, do ai, bao nhiêu đích đã nhận giá trị và được đọc lại |

Chỉ `state` là mới. Những loại còn lại được đọc ở nơi chúng vốn có, vào lúc truy vấn, rồi gộp lại. Không có gì được ghi hai lần, nên không gì có thể mâu thuẫn với dấu vết mà nó đến từ đó, và mỗi dấu vết giữ thời hạn lưu trữ riêng của mình (bên dưới).

Từ nhật ký hệ thống, nhật ký lấy danh mục `config` và các dòng riêng của danh mục `write`: bản tóm tắt của một lệnh gọi dịch vụ, một lệnh gọi dịch vụ báo động, lý do được nêu cho một thao tác ghi. Các dòng "wrote ..." và "write of ... refused" của chính cổng ghi bị bỏ ra, vì chúng nói đúng những gì kiểm toán thao tác ghi đã có, và nếu không mỗi thao tác ghi sẽ hiện hai lần.

### Những gì cố ý không có trong đó

**Số đo dạng số.** Một cảm biến, một con số, một vòng điều khiển hay một bộ đếm PLC thay đổi ở mỗi lần thăm dò, và mọi số đo đều đã nằm trong historian. Ghi lại chúng lần nữa sẽ chôn mọi dòng mà ai đó muốn đọc dưới một triệu dòng mỗi ngày mà không ai muốn đọc. Hãy xem chúng bằng xu hướng.

**Nút bấm.** Trạng thái của nút bấm là thời điểm nhấn lần cuối, và mỗi lần nhấn đã là một thao tác ghi trong kiểm toán. Nó còn trở về không xác định ở mỗi lần khởi động lại, nghĩa là mỗi nút mỗi lần khởi động lại có một dòng chẳng nói gì.

**Trạng thái của các thực thể báo động.** Lịch sử riêng của báo động nằm trong nhật ký dưới dạng các dòng `alarm`, với nhiều thông tin hơn (giá trị, ghi chú, ai đã xác nhận).

Mọi thứ khác đều được ghi: cảm biến nhị phân, công tắc, văn bản, lựa chọn, động cơ, van, trợ thủ và tập lệnh khi chúng đến.

**Trợ thủ được ghi bởi người đã thay đổi chúng.** Thay đổi của một trợ thủ được ghi vào nhật ký trong cùng giao dịch với giá trị của nó, bởi tiến trình đã thực hiện thay đổi, kèm ai đã làm, từ đâu và dưới id lệnh gọi nào, và không bao giờ bị giới hạn tần suất. Bộ ghi không động tới trợ thủ: nó chỉ chạy trong Gateway, nên thay đổi của tác tử qua `--mcp-stdio` sẽ bị bỏ sót, và mọi tiến trình giữ trợ thủ đều thấy thay đổi nên nó sẽ bị ghi một lần cho mỗi tiến trình. Lịch là ngoại lệ, vì không ai đặt nó mà đồng hồ làm nó chuyển: bộ ghi ghi nó như mọi thực thể khác.

## Nhiễu nảy

Một tiếp điểm nảy ở 10 Hz là một sự kiện ("nó đã nảy bấy nhiêu lần"), chứ không phải ba mươi sáu nghìn dòng mỗi giờ. Mỗi thực thể được mười thay đổi liên tiếp, rồi cứ hai giây một thay đổi. Thay đổi vượt quá mức đó không được ghi, mà được đếm vào dòng kế tiếp của thực thể:

```
changed to closed (was open); 14 changes before this not logged, it was changing faster than the logbook records
```

Số đếm là chính xác: các dòng cộng với số đếm của chúng là mọi thay đổi mà thực thể đã thực hiện. Khi nhiễu nảy dừng, trạng thái cuối cùng của thực thể luôn được ghi, trong vòng hai giây, nên nhật ký không bao giờ kết thúc ở một trạng thái mà thiết bị đã rời bỏ. Số lượng bị chặn từ lúc khởi động là `suppressed` trong `/api/diagnostics` dưới `logbook`.

## last_changed tồn tại qua một lần khởi động lại

Trạng thái của một thực thể được tính từ các tag trực tiếp và không bao giờ được lưu, nên trước khi có nhật ký, mỗi lần khởi động lại khiến mọi thực thể trông như vừa mới thay đổi. Nhật ký giữ trạng thái mới nhất của mỗi thực thể được theo dõi và lần thay đổi cuối của nó (`entity_last_state`), và bộ máy thực thể đọc nó khi khởi động. Thực thể có trạng thái trở lại giống cũ giữ nguyên `last_changed`.

Nhìn từ bên trong, một lần khởi động lại trông như sau: một thiết bị chưa được kết nối, nên các thực thể của nó thành không khả dụng, rồi không xác định, rồi hiện số đọc của chúng. Những bước đó là tiến trình này đang bắt kịp, không phải nhà máy thay đổi, nên người ta chờ chúng qua đi. Một trạng thái thật sự đã thay đổi trong lúc Gateway ngừng hoạt động nhận một `last_changed` mới và một dòng nói trước đó nó là gì. Vì lý do tương tự, nhật ký giữ lại thay đổi sang không khả dụng hoặc không xác định trong phút đầu sau khi khởi động: một thiết bị vẫn ngừng sau đó sẽ được ghi vào lúc ấy, với thời điểm lần đầu nó được thấy là ngừng.

## Bộ lọc

- **Ở đâu:** một nút của cây thiết bị và mọi thứ bên dưới. Một vị trí được chuyển thành mọi tên mà các dấu vết biết nó: các thực thể ở đó (theo vị trí riêng của chúng, nếu không thì theo vị trí của thiết bị, cùng quy tắc mà màn hình Thực thể dùng), các thiết bị ở đó và mọi tag trên chúng, các báo động trên những tag đó, các tự động hóa có trình kích hoạt trên bất kỳ cái nào trong số đó, và chính nút đó cho các thay đổi cấu hình của nó. Một lần chạy tự động hóa cũng thuộc về một vị trí nếu nó đã ghi vào đó khi đang chạy, bất kể cái gì đã kích hoạt nó. Sự kiện của một bảng điều khiển UniFi được tìm qua mạng, không phải qua thứ gì đó mà con người đặt trên cây: công tắc mạng mà thiết bị được liên kết treo vào, và mọi công tắc giữa nó và cổng, nên một công tắc rớt xuất hiện dưới mọi dòng mà nó cấp nguồn. Một bảng điều khiển đặt trên cây tìm thấy các sự kiện về mọi thứ nó đã tiếp nhận. Xem [UniFi Network](/vi/iot/unifi/#sự-kiện).
- **Thực thể:** như vậy, cho một thực thể: các thay đổi trạng thái của nó, thao tác ghi vào nó và các tag của nó, các báo động của nó, các quy tắc mà nó kích hoạt hoặc đã ghi vào nó, và thay đổi cấu hình của nó hoặc các tag của nó. Một thực thể đã bị xóa từ đó vẫn được tìm thấy bằng tên nó từng có.
- **Ai:** một phần của bên thực hiện, không phân biệt hoa thường: `alice`, `automation:cooldown` (các lần chạy của quy tắc và mọi thao tác ghi nó đã làm), `mcp:` (mọi thứ bất kỳ tác tử nào đã làm). Một thay đổi trạng thái do chính thiết bị tạo ra không có bên thực hiện.
- **Loại:** bất kỳ loại nào trong năm loại.
- **Khi nào:** `from` và `to`.

Phân trang dùng con trỏ, gồm thời gian, loại và id của dòng cuối, nên một trang không bao giờ bị lệch bởi các dòng được thêm vào sau trang trước.

Màn hình cập nhật trực tiếp. Luồng trực tiếp xem các dấu vết mỗi giây một lần khi có người đang xem, và gửi một sự kiện `logbook` nêu các loại có điều gì mới; màn hình khi đó hỏi lại trang của nó. Nó theo dõi các bảng, không phải tiến trình này, nên một thao tác ghi mà tác tử thực hiện qua `--mcp-stdio`, vốn là một tiến trình khác, vẫn hiện ra như thường.

## Giữ trong bao lâu

`entity_state_log` được phân vùng theo tháng, ở cả hai chế độ lịch sử (nó là bảng phân vùng PostgreSQL thông thường dù `tag_history` có là hypertable hay không), và một tháng bị xóa nguyên khối khi mọi dòng trong đó cũ hơn `HOTLOOP_LOGBOOK_RETENTION_DAYS`. Mặc định **90**. Xóa một tháng là tức thì; xóa từng dòng của nó thì không, và đó là lý do nó được phân vùng. Vì vậy một dòng được giữ từ 90 ngày đến 90 ngày cộng một tháng. `0` giữ mọi thứ, và Gateway nói điều đó khi khởi động, vì khi đó bảng lớn lên cho đến khi đầy ổ.

Phần bảo trì riêng của nhật ký làm việc này, một lần khi khởi động và hằng ngày sau đó. Nó tạo trước phân vùng của tháng trước và của ba tháng tiếp theo, để một dòng luôn có chỗ rơi vào; một dòng của tháng không có phân vùng rơi vào phân vùng mặc định, và bảo trì chuyển chúng về tháng của chúng khi tạo tháng đó (điều này xảy ra sau một lần khôi phục, xem [Sao lưu và khôi phục](/vi/iot/backup/)) hoặc xóa chúng khi đã quá thời hạn lưu trữ.

Các dấu vết khác giữ những gì chúng vẫn luôn giữ:

| Dấu vết | Được giữ |
|---|---|
| `write_audit` | mọi thứ, cho đến khi ai đó cắt bớt |
| `alarm_events` | mọi thứ, cho đến khi ai đó cắt bớt |
| `automation_runs` | 500 lần chạy mới nhất của mỗi tự động hóa |
| `events` | 100.000 dòng mới nhất |

Vì vậy ở một nhà máy bận rộn, các thao tác ghi và báo động của nhật ký có thể lùi xa hơn các thay đổi trạng thái của nó, còn các lần chạy tự động hóa và thay đổi cấu hình thì ít xa hơn. Nhật ký cho thấy những gì các dấu vết có.

## Một tiến trình ghi

Gateway ghi. Tiến trình thứ hai được khởi động bằng `--mcp-stdio` (trợ thủ của một tác tử bên cạnh Gateway) đọc nhật ký và mốc cơ sở của nó, nên những gì nó nói về `last_changed` khớp với Gateway, nhưng nó không ghi gì và không bảo trì gì: hai bộ ghi sẽ ghi mỗi thay đổi hai lần.

Bộ ghi là một hook trên bộ máy thực thể chỉ xếp hàng. Mỗi giây một lần, một goroutine biến những gì trong hàng thành các dòng, áp dụng giới hạn tần suất và ghi chúng bằng một `COPY` và một upsert các trạng thái mới nhất, trong một giao dịch. Hàng đợi chứa 50.000 thay đổi; quá mức đó các thay đổi cũ nhất bị bỏ và được đếm. Một cơ sở dữ liệu đang ngừng giữ các dòng trong hàng đợi, đến cùng giới hạn đó, và chúng được ghi vào khi nó trở lại. `/api/diagnostics` hiển thị tất cả dưới `logbook`:

```json
{"recording":true,"retentionDays":90,"queued":0,"dropped":0,"written":212,"suppressed":36,"writeErrors":0}
```

`dropped` lớn hơn không nghĩa là nhật ký đang thiếu các thay đổi; `queued` cứ tăng mãi nghĩa là cơ sở dữ liệu không theo kịp; `lastError` cho biết vì sao lần ghi cuối thất bại.

## Sao lưu

Cả hai bảng đều có trong mọi bản sao lưu: `entity_last_state` sau các bảng thực thể, `entity_state_log` ngay trước `tag_history`. Xem [Sao lưu và khôi phục](/vi/iot/backup/).
