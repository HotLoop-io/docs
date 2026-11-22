---
title: "Trạng thái bền vững, có số đo"
description: "Ngữ cảnh còn lại sau khi khởi động lại và các đường nối bền vững chỉ ghi xuống đĩa khi đích ngừng phản hồi, kèm số đo của cả hai."
---

Một historian ngừng một giờ không nên khiến bạn mất một giờ số đọc, miễn là thời gian ngừng nằm gọn trong hạn mức đĩa (mặc định 256 MiB: khoảng một giờ với 100 số đọc mỗi giây, mỗi số đọc 120 byte, đo trên 2.13.1), và một bộ đếm trong luồng không nên bắt đầu lại từ đầu chỉ vì pod đã chuyển chỗ. Cả hai đều là một tệp SQLite trên volume, và trang này nói tệp đó chứa gì, bảo đảm gì, không bảo đảm gì và tốn của một thẻ flash bao nhiêu.

Một tệp, `state.db`, trong thư mục dữ liệu. Ngữ cảnh lưu bền và các hàng đợi phía sau đường nối bền vững dùng chung tệp này, vì hai kho sẽ là hai thứ phải định cỡ, sao lưu và giữ đồng bộ.

## Ngữ cảnh còn lại sau khi khởi động lại

Ngữ cảnh luồng, toàn cục và nút được nạp từ tệp lần đầu một phạm vi được dùng và sau đó nằm trong bộ nhớ, nên việc đọc không bao giờ chạm vào đĩa, còn `CompareAndSwap`, `Increment` và `Update` là cùng một đoạn mã như trước, nguyên tử dưới cùng một khóa. Khởi động lại sẽ trả bộ đếm về và nó chạy tiếp từ đó, và một `CompareAndSwap` với giá trị đã quay về từ đĩa vẫn hoạt động, kể cả với số nguyên mà một nút function đã lưu.

Điều bạn đánh đổi là có chủ ý: việc ghi bị chậm lại. Một giá trị đã thay đổi chờ `store.context.flushInterval` (30 giây) và mọi thứ thay đổi trong khoảng đó được ghi vào tệp trong một giao dịch. Mười nghìn lần tăng một bộ đếm trong một khoảng là một dòng được ghi. Một giá trị được đặt lại đúng bằng giá trị cũ thì hoàn toàn không phải là một lần ghi, đó là luồng lưu cùng một nhiệt độ mỗi giây và chiếc thẻ SD mà nếu không sẽ ghét bạn vì chuyện đó. Dừng sạch sẽ ghi mọi thứ trước. `kill -9` hoặc mất điện sẽ mất tối đa một khoảng như vậy. Đặt thành `0s` thì mọi thay đổi được ghi trước khi lệnh gọi trả về, và thẻ phải trả giá cho điều đó.

Chỉ những gì sống sót qua JSON mới sống sót qua khởi động lại: số, chuỗi, giá trị boolean, thời gian, bộ đệm byte, danh sách và đối tượng. Nếu bạn đặt một hàm hoặc một socket vào ngữ cảnh, `set` thất bại và nêu tên khóa, thay vì lưu một nửa. Ngữ cảnh của một nút mất đi khi nút bị xóa và ngữ cảnh của một luồng mất đi khi tab bị xóa, lúc triển khai, theo cùng cách dọn dẹp mà Node-RED làm.

## Đường nối bền vững

Đánh dấu một đường nối là bền vững trên nút mà nó đi ra. Khóa là `ew_durable`, một danh sách id của các nút mà đường nối đó đi tới, và tệp luồng vẫn được nạp và lưu từng byte một vì các công cụ khác bỏ qua nó:

```json
{
  "id": "count", "type": "function", "z": "line3", "x": 290, "y": 100,
  "ew_durable": ["influx"],
  "wires": [["influx", "reply"]]
}
```

Mọi đường nối từ `count` đến `influx` giờ đều bền vững. Đường nối đến `reply` vẫn là đường nối thông thường.

Một đường nối bền vững làm gì:

- **Không ghi gì khi đích còn theo kịp.** Thông điệp đi từ bộ nhớ thẳng vào hộp thư đến của đích, giống như một đường nối thông thường, và cơ sở dữ liệu trạng thái không bị chạm tới. Chúng tôi đặt ra quy tắc đó sau khi một thiết kế ghi mọi thứ trước được đo ở hàng trăm gigabyte mỗi ngày trên thẻ flash, chỉ để phòng một sự cố xảy ra vài giờ mỗi năm.
- **Tràn xuống đĩa khi không theo kịp.** Đường nối bắt đầu tràn ngay khi trình xử lý của đích trả về lỗi, hộp thư đến đầy hoặc đích không chạy. Từ đó, mỗi thông điệp được ghi vào tệp trước khi `Send` của nút gửi trả về, nên một khi bên gửi đã đi tiếp, `kill -9` không thể lấy mất nó. Các thông điệp đã trên đường tới đích được chuyển hướng xuống đĩa phía sau thông điệp đã thất bại, theo đúng thứ tự. Trong ví dụ trên, `reply` đứng thứ hai trong sơ đồ nối, nên khi đường nối đang tràn, một HTTP 200 có nghĩa là số đọc đã nằm trên đĩa.
- **Xả theo thứ tự, theo lô khi đích nhận được.** Một bơm đưa cho đích các thông điệp cũ nhất trên đĩa và chờ đến khi chúng được nhận. Không gì phía sau một thông điệp vượt lên trước nó. Một đích ghi vào cơ sở dữ liệu có thể nhận một loạt tối đa 256 thông điệp như một lần ghi, và `influxdb out` làm vậy: với historian trả lời một lần ghi trong 8 ms, phần tồn đọng được xả ở khoảng 110 số đọc mỗi giây khi gửi từng cái một, mức mà một nhà máy gửi 100 mỗi giây hầu như không rút ngắn được, và nó được xả với tốc độ mà các lần ghi cho phép khi mỗi lần mang vài trăm. Mọi đích khác vẫn nhận từng thông điệp một. Nếu một lô không được nhận, các thông điệp trước thông điệp đầu tiên thất bại được đánh dấu là xong, thông điệp đó được thử lại riêng bằng cơ chế thử lại bên dưới, và phần còn lại được gửi lại thành lô. Khi hàng đợi trống, đường nối quay về bộ nhớ và ngừng ghi.
- **Thử lại những gì đích làm hỏng.** Cùng thông điệp đó được gửi lại sau 250 ms, rồi 500 ms, nhân đôi đến 5 giây, bao lâu cũng được. Các nút Catch của luồng biết về lần thất bại đầu tiên chứ không biết từng lần thử lại. Một đích đã dừng, bị thay thế bởi một lần triển khai hoặc không khởi động được sẽ được chờ, không bị bỏ qua.
- **Còn lại sau khi khởi động lại.** Bất cứ thứ gì còn trên đĩa khi tiến trình quay lại sẽ được giao trước.
- **Tôn trọng hạn mức đĩa.** `store.durable.maxBytes` (256 MiB) áp dụng cho mọi đường nối bền vững cộng lại, tính phần thân mỗi thông điệp cộng thêm 64 byte. Khi đầy, nút mà đường nối đi tới quyết định theo chính sách tràn mà nó đã có: `block` chờ tối đa `blockTimeout` để có chỗ rồi báo lỗi, `drop-newest` từ chối thông điệp đang đến, `drop-oldest` đẩy ra thông điệp cũ nhất không đang được giao, `error` nâng lỗi lên một nút Catch. Mỗi trường hợp đều được đếm và thông báo như một sự kiện bị loại bỏ. Một ngoại lệ: một thông điệp đã được nhận vào bộ nhớ mà đường nối phải chuyển xuống đĩa sẽ vào dù vượt hạn mức, vì từ chối nó đồng nghĩa với việc bỏ một thông điệp cũ hơn và giữ lại những thông điệp mới hơn. Mức vượt tối đa là phần đích đang giữ, hộp thư đến cộng một thông điệp mà goroutine của nó đã lấy nhưng chưa bắt đầu, nên hạn mức có thể trong chốc lát hiển thị vượt vài thông điệp. Tệp lớn hơn hạn mức đôi chút, do chi phí trang của SQLite và nhật ký ghi trước, và một bài kiểm tra làm đầy, xả rồi làm đầy lại sáu lần để chứng minh nó không tiếp tục phình ra.
- **Cho thấy độ sâu của nó.** `hotloop_flow_durable_wire_depth{wire="..."}` là số thông điệp đang chờ, kèm `_bytes`, `_delivered_total`, `_retries_total` và `_dropped_total` bên cạnh, và `hotloop_flow_durable_bytes` so với `hotloop_flow_durable_max_bytes` là hạn mức.
- **Không khởi động lại nút.** Đánh dấu một đường nối là bền vững trên luồng đang chạy là một thay đổi sơ đồ nối, như di chuyển một đường nối.

Một đường nối thôi bền vững, hoặc bị xóa, sẽ bị dọn hàng đợi, đếm là đã loại bỏ và được thông báo. Các thông điệp đó không còn nơi nào để đi, và giữ chúng sẽ làm đầy hạn mức bằng một hàng đợi mà không ai nhìn thấy.

### Điều nó hứa và điều nó không hứa

**Khi đường nối còn khỏe, có một khoảng mất mát.** Thứ nằm trong bộ nhớ là hộp thư đến của đích và lệnh gọi nó đang thực hiện, và `kill -9` hoặc mất điện sẽ lấy mất. Đó là cái giá của việc không ghi gì, và chúng tôi chấp nhận có chủ ý: với hộp thư đến 1024 và một đích nhanh, đó là các thông điệp của khoảng một lần thăm dò. Khi đường nối đang tràn, tức là khi đích đã ngừng và dữ liệu có nguy cơ, thì không có khoảng nào. Bài kiểm tra kill -9 bên dưới được làm giữa lúc ngừng vì lý do đó, với hàng đợi trên đĩa. Chúng tôi không tắt runtime khi đường nối còn khỏe để đếm, vì câu trả lời là "mất vài cái" và đó là thiết kế.

**Việc giao là ít nhất một lần.** Đích đã nhận một thông điệp khi trình xử lý của nó trả về không lỗi, và đường nối đánh dấu nó là xong trên đĩa sau đó. Một `kill -9` giữa hai bước nghĩa là thông điệp được gửi lại sau khi khởi động lại. Bao nhiêu thì tùy `store.durable.ackFlush`: các dấu được ghi cùng nhau, nên với mặc định `100ms` đó là các thông điệp xong trong 100 ms gần nhất, còn với `0s` mỗi dấu được ghi trước khi gửi thông điệp tiếp theo, nên tối đa là cái đang bay, hoặc lô đang bay, tối đa 256 thông điệp, với đích nhận theo lô.

Nghe như một lỗ hổng, nên đây là thứ lấp nó cho đích mà tính năng này được xây dựng. Một thông điệp đi qua đường nối bền vững được đóng dấu `msg._queuedAt` với thời điểm nó vào đường nối, và `influxdb out` không cấu hình dấu thời gian sẽ ghi điểm với thời điểm đó. Một lần lặp là cùng chuỗi tại cùng thời điểm, mà InfluxDB coi là ghi đè, nên số dòng không đổi. Nó cũng khắc phục điều khác hay hỏng với lưu rồi chuyển tiếp: nếu không có nó, mọi số đọc bị giữ trong lúc ngừng sẽ được đóng dấu khi InfluxDB quay lại, và một giờ lịch sử đổ vào trong một phút. Một đích đóng dấu lúc đến, chẳng hạn `now()` trong một câu insert Postgres, sẽ lưu một lần lặp hai lần, và còn đặt giờ được phát lại vào sai chỗ. Hãy dùng `msg._queuedAt`.

**"Đã nhận" chỉ mạnh bằng nút đó.** `influxdb out` thực hiện việc ghi bên trong trình xử lý, nên đã nhận nghĩa là đã ghi. Một nút giao việc cho goroutine khác rồi trả về đã hứa ít hơn, và đường nối không thể bền vững hơn thứ nó nối tới.

**Một số thuộc tính không đi cùng chuyến.** Một handle đang sống không thể vượt qua khởi động lại và không thể được trả lời sau đó, nên `msg.req` và `msg.res` (của nút HTTP In) và bất cứ thứ gì không tuần tự hóa được sẽ bị bỏ khỏi các thông điệp trên đường nối bền vững, và lần đầu điều đó xảy ra trên một đường nối, nó được ghi nhật ký kèm tên thuộc tính. Nội dung gói tin không bao giờ bị bỏ: nếu không lưu được, thông điệp bị từ chối với một lỗi nêu đường dẫn.

**Một thông điệp xấu có thể giữ chân một đường nối.** Một đích luôn thất bại với cùng một thông điệp sẽ luôn nhận nó, với khoảng nghỉ 5 giây giữa các lần thử, và các thông điệp phía sau phải chờ. Bộ đếm thử lại và độ sâu là cách để bạn thấy điều đó. Đó là lựa chọn đúng cho một historian đang ngừng. Nó là lựa chọn sai cho một thông điệp sai định dạng, nên một đường nối có thể được đặt giới hạn: `"ew_durable_attempts": {"influx": 20}` trên nút mà nó đi ra, hoặc hộp thoại đường nối trong trình soạn thảo. Sau khi đích đã từ chối một thông điệp từ hàng đợi chừng đó lần, nó đi vào luồng như một lỗi từ nút đã từ chối nó, kèm thông điệp, một nút Catch có thể cất nó đi, và đường nối đi tiếp. Không có khóa thì không có gì thay đổi. Vẫn chưa có hàng đợi thư chết: nút Catch là nơi bạn xây nó, và `hotloop_flow_durable_wire_given_up_total` đếm những gì đã đi tới đó.

## Cài đặt

```yaml
store:
  path: ""              # empty is state.db in data.dir
  synchronous: normal   # normal | full
  context:
    persist: true
    flushInterval: 30s  # 0s writes every change at once
  durable:
    maxBytes: 268435456
    ackFlush: 100ms     # 0s marks each message before the next is sent
```

Môi trường: `HOTLOOP_FLOW_STORE_PATH`, `HOTLOOP_FLOW_STORE_SYNCHRONOUS`, `HOTLOOP_FLOW_CONTEXT_PERSIST`, `HOTLOOP_FLOW_CONTEXT_FLUSH_INTERVAL`, `HOTLOOP_FLOW_DURABLE_MAX_BYTES`, `HOTLOOP_FLOW_DURABLE_ACK_FLUSH`. Chart có cùng các tên đó dưới `store:` trong `values.yaml`.

`synchronous: normal` chạy tệp ở chế độ ghi trước mà không fsync ở mỗi commit. Một commit sống sót khi tiến trình bị kill, đó là bài kiểm tra `kill -9` bên dưới. Nó không sống sót khi mất điện trên mọi hệ thống tệp. `full` thì có, và `full` là thứ làm mòn thẻ.

## Bằng chứng

Đo với một InfluxDB 2.9.1 thật trong Podman. Không có gì được giả lập.

Một producer gửi một số đọc có đánh số tới luồng trong flow.json hai mươi lần mỗi giây. Luồng đếm nó trong ngữ cảnh luồng và gửi nó qua một đường nối bền vững tới `influxdb out`. Số đọc không mang dấu thời gian, nên một thông điệp được giao hai lần sẽ thành hai dòng. Một bước trung chuyển nhỏ giữa luồng và InfluxDB ghi lại mọi lần ghi mà InfluxDB đã chấp nhận, vì InfluxDB coi một điểm được ghi hai lần cùng thời điểm là một điểm và chỉ riêng các dòng thì không thể cho thấy một lần lặp.

| Giờ | Điều đã xảy ra |
|---|---|
| 00:13:53 | Luồng bắt đầu, 20 số đọc mỗi giây. |
| 00:14:53 | `podman kill` trên InfluxDB. Nó chết mười phút. Đường nối tràn xuống đĩa. |
| 00:19:54 | Năm phút sau, độ sâu hàng đợi 5,989 trên đĩa. `kill -9` trên runtime. |
| 00:19:59 | Runtime khởi động lại, InfluxDB vẫn ngừng. Nó tìm thấy 5,992 thông điệp trên đĩa và tiếp tục nhận thông điệp mới. |
| 00:24:59 | InfluxDB khởi động. Độ sâu hàng đợi 11,989. |
| 00:25:25 | Đang xả, độ sâu hàng đợi 5,987. `kill -9` trên runtime lần nữa, giữa hàng đợi. |
| 00:25:30 | Runtime khởi động lại với 5,948 trên đĩa. |
| 00:25:53 | Phần tồn đọng đã xả xong. Thêm chín mươi giây đầu vào đều, rồi đếm. |

```
deliveries      15987 writes InfluxDB answered 204 to
delivered twice 5 [7829, 7830, 7831, 7832, 7833]
sent            16185
accepted (200)  15982
failed          203
rows stored     15982
distinct seqs   15982
missing         0 []
doubled         0 []
unacked stored  0 []
```

Mọi số đọc mà luồng đã trả lời 200 đều có trong InfluxDB, đúng một lần. **Không thiếu cái nào, không trùng cái nào.** 203 yêu cầu thất bại là các yêu cầu đến trong lúc runtime chết, tức là producer bị báo không, và không cái nào được lưu.

Năm thông điệp đã được giao cho InfluxDB hai lần. Đó là những thông điệp mà lần kill thứ hai bắt gặp giữa lúc InfluxDB nhận chúng và lúc dấu "xong" tới đĩa, trong khoảng `ackFlush`. Mỗi cái mang cùng `_queuedAt`, nên lần ghi thứ hai ghi đè lần đầu và số dòng không nhúc nhích. Đó là hình dạng của [ít nhất một lần](#điều-nó-hứa-và-điều-nó-không-hứa) khi nó hoạt động. Đó cũng là thứ mà một đích đóng dấu lúc đến sẽ lưu hai lần.

Điều này không bao quát: một `kill -9` khi đường nối còn khỏe. Các số đọc trong bộ nhớ vào lúc đó mất đi, theo thiết kế, và chúng tôi không đếm chúng.

## Nó ghi gì xuống đĩa

`write_bytes` trong `/proc/<pid>/io` là lượng mà kernel đã được yêu cầu gửi xuống bộ nhớ lưu trữ cho tiến trình, đã trừ đi các lần ghi bị hủy. Đó là con số mà thẻ flash quan tâm. Mỗi dòng là 300 giây của một kịch bản, sau 30 giây để ổn định, từ disk-writes.sh. Luồng là luồng chứng minh với InfluxDB phía sau, nên tải là thật.

```bash
BIN=./hotloop-flow SECS=300 bash docs/durable/disk-writes.sh
```

| Kịch bản | Tốc độ | Xả ngữ cảnh | Ghi mỗi giờ | Mỗi ngày |
|---|---|---|---|---|
| Nhàn rỗi, một đường nối bền vững trong luồng | không | 5 s | 0 byte | 0 |
| Đường nối bền vững khỏe, tải đều | 20 msg/s | 30 s | 1.7 MiB | 0.04 GB |
| Đường nối bền vững khỏe, tải đều | 50 msg/s | 30 s | 1.2 MiB | 0.03 GB |
| Như trên, ngữ cảnh xả mỗi 5 s | 20 msg/s | 5 s | 5.1 MiB | 0.12 GB |
| Như trên, ngữ cảnh xả mỗi 5 s | 50 msg/s | 5 s | 4.2 MiB | 0.10 GB |
| Chỉ ngữ cảnh, đường nối thông thường | 20 msg/s | 30 s | 1.2 MiB | 0.03 GB |
| Đường nối đang tràn, InfluxDB ngừng | 20 msg/s | 5 s | 728 MiB | 17 GB |
| Đường nối đang tràn, `synchronous: full` | 20 msg/s | 5 s | 1,011 MiB | 24 GB |

Hãy đọc nó theo ba phần.

**Nhàn rỗi không ghi gì.** Không byte nào trong năm phút.

**Một đường nối khỏe không ghi gì của riêng nó.** Các dòng khỏe là ngữ cảnh lưu bền, một bộ đếm được tăng ở mỗi thông điệp, và không gì khác. Dòng chỉ có ngữ cảnh với đường nối thông thường nằm trong mức nhiễu so với chúng. Mặc định xả ngữ cảnh là năm giây cho tới bảng này: ở hai mươi thông điệp mỗi giây đó là 5.1 MiB mỗi giờ, 0.12 GB mỗi ngày, và ba mươi giây đưa nó xuống 1.7 MiB, đó là lý do mặc định là ba mươi. Khi đó kill -9 mất tối đa ba mươi giây ngữ cảnh.

**Một đường nối đang tràn thì đắt, và chỉ khi nó đang tràn.** Mỗi thông điệp là một commit riêng, khoảng 10 KB ghi cho mỗi cái, vì bên gửi chờ đĩa. Mười phút ngừng ở hai mươi mỗi giây là khoảng 120 MiB, một ngày ngừng cả ngày khoảng 17 GB. Đó là chi phí của "trên đĩa trước khi bên gửi đi tiếp", chỉ trả khi historian đang ngừng. Group commit chia sẻ một giao dịch giữa các bên gửi đồng thời, nhưng một bên gửi thì chỉ có một commit.

Thêm một con số nữa, vì nó làm tôi bất ngờ. Ở 100 thông điệp mỗi giây, bộ thử này không giữ được đường nối khỏe: đích ngừng theo kịp, đường nối tràn và cứ tràn suốt lần chạy, 3,548 MiB mỗi giờ. Chúng tôi không tìm hiểu bước trung chuyển hay InfluxDB là phần chậm. Đó là thiết kế hoạt động đúng như đã viết, vì "tồn đọng" được tính là không theo kịp, và nó có nghĩa là một đích chậm hơn đầu vào của nó sẽ đưa một đường nối bền vững xuống đĩa. Ở 50 thông điệp mỗi giây nó vẫn khỏe.

Thiết kế trước đó ghi mọi thông điệp xuống đĩa trước. Với lược đồ đầu tiên (trang 4 KiB, một bảng và một chỉ mục) nó đo được 632 MiB mỗi giờ ở 20 thông điệp mỗi giây dù InfluxDB khỏe, và 1,163 MiB khi mỗi dấu "xong" được ghi ngay. Đó là nơi "chỉ ghi đĩa khi ngừng" xuất phát.

### Trên máy thật

Các con số này được đo trên máy x86 dưới WSL2, và kho bền vững từ đó đã chạy trên máy thật (2026-11-17). Số byte ghi là thuộc tính của mã và kích thước trang, nên các số trên vẫn đúng. Cách một thẻ xử lý chúng (khuếch đại ghi, hao mòn) thì không, bộ nhớ, thời gian khởi động và số thông điệp mỗi giây bền vững cũng vậy, nên các con số đó vẫn được ghi rõ nơi đã đo.
