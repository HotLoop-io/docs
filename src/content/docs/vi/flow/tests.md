---
title: "Kiểm thử cạnh các luồng"
description: "Viết tệp kiểm thử cạnh luồng, chạy trên đồng hồ giả lập, buộc việc triển khai vào kết quả đó, và không có gì thoát ra khỏi bài kiểm thử."
---

"Thay đổi của tôi có làm hỏng dây chuyền không?" cần được trả lời trước khi triển khai, bởi người thực hiện thay đổi, chứ không phải lúc 3 giờ sáng bởi người trực. Vì vậy một luồng có thể có các bài kiểm thử, là YAML nằm cạnh tệp luồng và đi qua cùng một quy trình xem xét:

```yaml
# line3.test.yaml
flows: line3.json            # relative to this file; flows.json if you leave it out
tests:
  - name: a high reading raises the alarm and nothing else
    inject:
      - node: reading                  # by name or by id
        msg: {topic: line3/temp, payload: 92.5}
    expect:
      - node: over limit?              # the Switch
        port: 1
        msg: {payload: 92.5}
        within: 500ms
      - node: over limit?
        port: 2
        nothing: true
      - node: alarm out                # a Debug: checked on what it received
        msg: {payload: HIGH}

  - name: a negative reading is caught, not alarmed on
    inject:
      - node: reading
        msg: {payload: -4}
    expect:
      - node: errors                   # a Catch node
        error: "out of range"
```

```bash
hotloop-flow test -junit report.xml line3.test.yaml
```

```
--- PASS: a high reading raises the alarm and nothing else (0.00s)
--- PASS: a negative reading is caught, not alarmed on (0.00s)
ok	line3.test.yaml	2 passed, 0 failed, 0 errors (0.00s)
```

Đó là môi trường chạy thật và các nút thật, ngay trong tiến trình, không cần máy chủ hay trình soạn thảo. Mỗi bài kiểm thử có môi trường chạy riêng, nên không gì mà một bài để lại trong Delay hay trong ngữ cảnh có thể lọt sang bài kế tiếp.

- **`inject`** đưa thông điệp vào theo thứ tự, mỗi thông điệp được xử lý xong trước khi thông điệp kế vào. Nút có đầu vào nhận nó ở đó. Một nguồn như Inject hay MQTT In gửi nó ra từ đầu ra đầu tiên như thể tự tạo ra, còn nút Inject không có thông điệp thì được nhấn nút.
- **`expect`** theo dõi đầu ra của một nút, đếm cổng từ 1 như trình soạn thảo. Nút không có đầu ra, như Debug, được kiểm tra theo những gì nó nhận. Một phiên bản luồng con được theo dõi ở chính các đầu ra của nó, bất kể chúng đến từ đâu bên trong.
- **`msg`** là những gì thông điệp phải chứa. Mọi thuộc tính bạn nêu phải có đó với giá trị ấy, sâu đến tận cùng, còn mọi thứ khác trên thông điệp bị bỏ qua, nên bài kiểm thử về payload không vỡ khi ai đó bắt đầu đặt `msg.topic`. **`assert`** là một biểu thức JSONata phải cho kết quả đúng, dành cho các phép kiểm tra mà giá trị cố định không làm được. **`error`** là văn bản mà lỗi do nút Catch bắt được phải chứa.
- **`within`** là thời hạn. Thông điệp đến muộn sẽ thất bại, và thất bại cho biết muộn bao lâu. **`nothing: true`** và **`count: N`** được kiểm tra khi luồng đã lặng đi, vì chỉ lúc đó "không có gì ra" mới có nghĩa. Hai kỳ vọng trên một cổng là hai thông điệp, theo thứ tự đó.

Bài kiểm thử kết thúc ngay khi mọi điều nó chờ đã xảy ra và luồng không còn gì để làm. `timeout` là 5 giây nếu bạn không nói khác, tính theo đồng hồ riêng của bài kiểm thử, là mục kế tiếp.

Một thất bại cho biết thay vào đó ra cái gì và khác ở đâu:

```
--- FAIL: the alarm says LOW (0.00s)
    expect 1: debug "alarm out" (alarm-out): 1 message(s) received and none matched; the first one differs at msg.payload: wanted "LOW", got "HIGH"
      at 0s: {"payload":"HIGH","topic":"line3/temp"}
```

Bài kiểm thử không chạy được là một lỗi, không phải một lần đạt: một nút mà nó nêu tên nhưng không có trong luồng, một tên mà hai nút dùng chung, một cổng mà nút không có, hoặc một nút trong luồng không khởi động. Khóa viết sai chính tả cũng vậy. `expcet:` bị từ chối khi đọc tệp, vì một lỗi gõ bị lặng lẽ bỏ qua sẽ để lại bài kiểm thử không có gì để kiểm tra, và bài kiểm thử không có gì để kiểm tra thì luôn đạt. Trạng thái thoát là 1 với mọi kết quả chưa đạt hoàn toàn, và `-junit` ghi báo cáo mà mọi hệ thống CI đều đọc được.

## Trên đồng hồ của bài kiểm thử

Không ai chạy bộ kiểm thử chờ hết một Delay năm phút, nên bài kiểm thử không chờ. Nó giữ đồng hồ riêng và đẩy thẳng đến thời điểm kế tiếp mà thứ gì đó trong luồng đang chờ: một Delay nhả ra, thông điệp thứ hai của Trigger, một Inject theo khoảng hay crontab, một Join hoặc Batch hết hạn, một Link Call bỏ cuộc. Bộ hẹn giờ kích hoạt, luồng xử lý những gì nó gửi, và chỉ khi đó đồng hồ mới tìm mốc đến hạn kế tiếp, theo cùng thứ tự mà những phút thật sẽ mang lại. Năm phút Delay là một bước và khoảng một mili giây.

```yaml
  - name: a reading at 4m pushes the watchdog's off out to 9m
    clock: 2026-10-05T06:00:00Z     # when the test starts; the real time if you leave it out
    timeout: 20m
    inject:
      - {node: watchdog, msg: {payload: reading}}
      - {node: watchdog, msg: {payload: reading}, at: 4m}   # at: on the test's clock
    expect:
      - {node: watchdog, msg: {payload: "on"}}
      - {node: watchdog, msg: {payload: "off"}, within: 9m}

  - name: and not a moment before
    timeout: 8m59s
    inject:
      - {node: watchdog, msg: {payload: reading}}
      - {node: watchdog, msg: {payload: reading}, at: 4m}
    expect:
      - {node: watchdog, count: 1}  # the "on", and nothing else yet
```

**`at`** đặt một lần chèn vào một thời điểm trên đồng hồ của bài kiểm thử, và mọi thứ đến hạn trước đó xảy ra trước. **`within`** và **`timeout`** cũng tính theo đồng hồ ấy, nên `timeout: 1h` với luồng có Inject mỗi mười phút là sáu nhịp và vài mili giây. **`clock`** đặt thời điểm bài kiểm thử bắt đầu, cho luồng phụ thuộc vào giờ: một crontab kích hoạt lúc sáu giờ rưỡi sẽ kích hoạt khi đồng hồ của bài kiểm thử chỉ sáu giờ rưỡi. `Date` của nút Function, dấu thời gian của Inject, nút Change đặt một ngày và `Expires` của cookie đều đọc cùng một đồng hồ, nên luồng đóng dấu và so sánh thời gian vẫn nhất quán với chính nó khi chạy kiểm thử.

Bộ kiểm thử dùng nó để chứng minh mọi nút định thời trong bảng nút, chính xác đến mili giây: Delay ở các chế độ cố định, ngẫu nhiên, theo tốc độ và theo giờ, Trigger có extend, Inject theo khoảng, một lần lúc khởi động và theo crontab, thời hạn của Join và Batch, và Link Call không bao giờ nhận được câu trả lời. Tất cả, kể cả một giờ thời gian nhà máy, chạy xong trong chưa đầy một giây. Thứ bài kiểm thử không dịch chuyển được là CPU: luồng vẫn bận sau một phút thời gian thật sẽ làm bài kiểm thử thất bại thay vì treo cả bộ. `$now()` và `$millis()` của JSONata vẫn đọc đồng hồ treo tường.

## Kiểm thử từ trình soạn thảo

Không ai viết bài kiểm thử cho luồng đang chạy tốt. Họ viết vào ngày nó ngừng chạy, tức là muộn một ngày. Vì vậy trình soạn thảo tạo một bài từ những gì luồng vừa làm, chỉ với hai cú nhấp.

Mỗi thông điệp trong thanh bên gỡ lỗi đều có nút **Test**. Nhấp vào và trình soạn thảo soạn một bài kiểm thử từ chính thông điệp đó: những gì đã vào qua nguồn mà nó đã vào, đưa vào lại ở đó, và những gì nút Debug này đã hiển thị, đặt làm kỳ vọng ở đây. Sửa tùy ý, vì một số đọc có dấu thời gian nên được kiểm tra bằng `assert` thay vì ghim chặt đến từng mili giây. Nhấp **Add to tests** và nó nằm trong bộ kiểm thử cạnh tệp luồng, ở cuối, còn mọi thứ đã viết sẵn ở đó giữ nguyên, kể cả chú thích. Tên mà bộ kiểm thử đã có sẽ được thêm số ở cuối thay vì thay thế bất cứ thứ gì.

Cách trình soạn thảo biết những gì đã vào: môi trường chạy giữ 64 thông điệp cuối cùng đã vào luồng tại một nguồn và 64 thông điệp cuối cùng đã tới một nút Debug, theo id mà thông điệp mang từ nút này sang nút khác. Đó là một vòng đệm có giới hạn kích thước, và thông điệp trên 64 KB hoàn toàn không được giữ, nên nó không bao giờ có thể là thứ làm một pod phình ra. Thông điệp đã bị đẩy ra, hoặc bị một nút thay bằng thông điệp mới trên đường đi, không thể soạn thành bài kiểm thử, và trình soạn thảo nói rõ như vậy thay vì đoán cái gì đã vào.

Bảng **Tests** chạy bộ kiểm thử trên bản làm việc, đã triển khai hay chưa, và đó chính là điểm mấu chốt: bạn biết trước khi triển khai. Mỗi nút mà một bài đạt đã đi qua nhận một dấu tích, mỗi nút mà một thất bại nói đến nhận một dấu chéo kèm lý do khi di chuột, và nhấp vào một thất bại sẽ đưa bạn đến nút của nó. Sửa bất cứ thứ gì thì các dấu biến mất, vì chúng mô tả một luồng không còn tồn tại. **Edit** mở toàn bộ bộ kiểm thử dưới dạng YAML. Một lần triển khai mà [cổng chặn](#cổng-chặn-triển-khai) từ chối sẽ hiện trong cùng bảng, với các thất bại trên các nút.

Tất cả chạy trong trình duyệt thật với tệp nhị phân thật ở mỗi pull request.

## Cổng chặn triển khai

Kiểm thử trên laptop của ai đó chứng minh luồng họ có trên laptop. Cổng chặn chứng minh luồng đang được triển khai. Giữ bộ kiểm thử trên phiên bản, cạnh tệp luồng mà nó kiểm tra (`data/flows.test.yaml` cạnh `data/flows.json`, qua `PUT /tests` hoặc trình soạn thảo), bật `tests.gate`, và mỗi lần triển khai chạy nó với các luồng sắp được đưa vào. Lần nào không đạt sẽ bị từ chối, với mã 422 và toàn bộ báo cáo:

```
$ hotloop-flow deploy -file flows.json -note "raise the alarm at 95"
1 changed

Tab "Line 3" (t1)
  ~ switch "over limit?" (chk)
      rules[0].v: "80" -> "95"
hotloop-flow: the deploy was refused: 1 of 2 flow tests didn't pass, and the flows already running are untouched; "a high reading raises the alarm and nothing else": expect 1: switch "over limit?" (chk): nothing sent from port 1

--- FAIL: a high reading raises the alarm and nothing else (0.00s)
    expect 1: switch "over limit?" (chk): nothing sent from port 1
    expect 2: switch "over limit?" (chk): expected nothing, and 1 message(s) sent from port 2
      at 0s: {"payload":92.5,"topic":"line3/temp"}
    expect 3: debug "alarm out" (alarm-out): nothing received
--- PASS: a negative reading is caught, not alarmed on (0.00s)
FAIL	flows.test.yaml	1 passed, 1 failed, 0 errors (0.00s)
```

Đó là một lần chạy thật: tệp nhị phân với cổng chặn bật, bộ kiểm thử ở đầu mục này đặt cạnh tệp luồng của nó, và một token triển khai.

**Các luồng đang chạy không hề hay biết.** Cổng chặn chạy trước khi một byte nào được ghi: không có tệp luồng, không có thông tin xác thực, không có bản ghi triển khai, không khởi động lại. Việc từ chối đi vào nhật ký kiểm toán dưới dạng `deploy.refused` cho biết các bài kiểm thử đã thất bại. Và các bài kiểm thử hoàn toàn không chạy trong tiến trình máy chủ. Chúng chạy trong một tiến trình con, chính tệp nhị phân này dưới dạng `hotloop-flow test -stdin`, được đưa các luồng ứng viên và bộ kiểm thử qua stdin, vì một bài kiểm thử khởi động mọi nút trong luồng và một số đăng ký ở nơi cả tiến trình dùng chung: Link In theo id của nó, một tuyến HTTP theo đường dẫn của nó. Chạy ngay trong đó, Link In của ứng viên sẽ trả lời thay cho Link In của luồng đang chạy ngay khi nó khởi động. Trong tiến trình con, nó không thể chạm vào bất cứ thứ gì dây chuyền đang dùng, một nút bị panic trong goroutine riêng chỉ làm sập bài kiểm thử chứ không phải nhà máy, và bộ nhớ được trả lại khi nó thoát. Bài kiểm thử chứng minh điều đó theo cách khó: ứng viên bị từ chối có cùng Link In, và sau khi bị từ chối, một thông điệp đi qua liên kết của luồng đang chạy vẫn tới nơi.

Ba quyết định đáng biết. **Mặc định tắt**, vì một cổng chặn mà người vận hành không yêu cầu là một lần triển khai thất bại lúc 3 giờ sáng vì lý do mà không ai trong ca từng nghe. **Bài kiểm thử không chạy được thì không đạt**: tiến trình con không khởi động hoặc một lần chạy lâu hơn `tests.timeout` sẽ từ chối triển khai và nói rõ là trường hợp nào. Và **khôi phục phiên bản trước không bị chặn.** Khôi phục là cách thoát khỏi trạng thái xấu để về trạng thái đã từng chạy, và giữ nó lại vì các bài kiểm thử hôm nay là cách làm sự cố kéo dài hơn. Khi cổng chặn bật mà không có bộ kiểm thử thì không có gì để thất bại, nên việc triển khai đi tiếp và nhật ký cho biết vì sao nó không được kiểm tra.

## Ngữ cảnh và thông tin xác thực

Mỗi bài kiểm thử bắt đầu với ngữ cảnh trống, bất kể bài trước để lại gì. Bộ đếm mà một bài đã đẩy lên 42 không phải điểm xuất phát của bài kế tiếp, vì bộ kiểm thử mà bài thứ hai chỉ đạt khi bài thứ nhất đã chạy trước là bộ kiểm thử nói dối vào ngày ai đó chạy riêng một bài. Vậy nên bài cần bộ đếm ở 41 sẽ nói rõ điều đó, và nói ngữ cảnh phải chứa gì khi xong:

```yaml
  - name: picks up where the line left off
    context:                        # what the test starts with
      global: {limit: 90}
      flow: {Line 3: {count: 41}}   # flow context, by tab label or id
    credentials:                    # by node name or id; never the real ones
      historian: {token: test-token}
      plc api: {password: s3cret}
    inject: [{node: count, msg: {payload: 95}}]
    expect:
      - {node: out, msg: {count: 42}}
      - context:                    # what it holds at the end
          global: {alarm: true}
          flow: {Line 3: {count: 42}}
          node: {count: {last: 95}} # node context, by node name or id
```

`context` trong một kỳ vọng được so khớp như `msg`, và `null` nghĩa là khóa không được đặt. Một thất bại cho biết phạm vi thực sự chứa gì, vì câu trả lời thường gặp là lỗi gõ: `flow context of "Line 3" (t1): cuont: not set; it holds count`.

Bài kiểm thử không bao giờ thấy thông tin xác thực thật. Nó chạy với những gì nó nêu tên, và chính điều đó làm cho việc commit nó an toàn, và chúng đến nút đúng như cách thông tin thật sẽ đến: mật khẩu của một yêu cầu HTTP xuất hiện trong tiêu đề `Authorization` mà nó sẽ gửi, và cấu hình InfluxDB không khởi động được nếu thiếu token sẽ khởi động với token của bài kiểm thử. Nút đọc mật khẩu từ tệp được gắn qua `ew_credentialFiles` nhận thông tin xác thực của bài kiểm thử cho trường đó, vì bài kiểm thử không đọc gì từ đĩa, và một giá trị trống khi bài kiểm thử không nêu giá trị nào.

Ngữ cảnh sống trong bộ nhớ trong suốt bài kiểm thử, không bao giờ ở cơ sở dữ liệu trạng thái, nên bài kiểm thử không thể đọc những gì các luồng đang chạy để lại, cũng không để lại gì cho chúng. Fixture là YAML trong bài kiểm thử, không phải một tệp giả làm cơ sở dữ liệu.

## Không gì thoát ra khỏi bài kiểm thử

Bài kiểm thử mà chạy MQTT Out thật sẽ phát hành lên broker của nhà máy, và khi đó nó không còn là kiểm thử mà là triển khai. Vì vậy trong kiểm thử, mọi nút giao tiếp với thế giới bên ngoài tiến trình đều được thay bằng một bản giả: MQTT vào và ra, HTTP in, response và request, PostgreSQL, InfluxDB, TCP và UDP vào, ra và request, WebSocket vào và ra cùng bộ lắng nghe và máy khách phía sau, các nút tệp, `exec`, `scan` và `netinfo`.

Nút vẫn làm trọn công việc của mình cho đến sát đường dây. MQTT Out vẫn tính topic, QoS và các byte; HTTP Request vẫn dựng URL, tạo phần thân và theo các chuyển hướng; nút PostgreSQL vẫn dựng SQL và các tham số của nó. Sau đó nó giao kết quả cho bản giả, bản giả ghi lại và trả lời bằng những gì bài kiểm thử đã kịch bản hóa. Nếu không có kịch bản, câu trả lời là không có gì và thành công: không có hàng, một 200 trống, một lệnh thoát với 0. Các nguồn (MQTT In, HTTP In, TCP và UDP In, WebSocket In, Watch) không đăng ký, không lắng nghe, không thăm dò, nên cái đến là cái bài kiểm thử chèn vào.

```yaml
  - name: the limit comes from the database and the alarm goes to the broker
    inject:
      - node: reading
        msg: {topic: "3", payload: 92.5}
    replies:
      - node: lookup limit                   # a PostgreSQL query
        reply: {rows: [{limit_c: 90}]}
      - node: maintenance api                # an HTTP Request
        reply: {statusCode: 503, payload: {error: down for maintenance}}
      - node: historian                      # InfluxDB, and it's down
        error: connection refused
    expect:
      - node: lookup limit
        sent: {query: "select limit_c from limits where line = $1", params: ["3"]}
      - node: to the plant                   # an MQTT Out
        sent: {topic: line3/alarm, payload: HIGH, qos: 1, retain: true}
      - node: errors
        error: connection refused
```

**`sent`** là những gì nút sẽ gửi, được so khớp như `msg`. **`replies`** kịch bản hóa những gì quay về: phản hồi đầu tiên liệt kê cho một nút trả lời cuộc gọi đầu tiên của nó, phản hồi kế tiếp trả lời cuộc gọi thứ hai, và phản hồi cuối cùng tiếp tục trả lời, nên "nó trả lời rồi ngừng" là hai dòng. **`error`** làm cuộc gọi thất bại như thật, nên đường đi mà luồng của bạn chọn khi hệ thống lưu trữ lịch sử ngừng hoạt động được kiểm thử trước khi nó ngừng.

| Nút | `sent` | `reply` |
|---|---|---|
| MQTT Out | `topic`, `payload`, `qos`, `retain` | |
| HTTP Request | `method`, `url`, `headers`, `payload` | `statusCode` (200), `headers`, `payload` |
| HTTP Response | `statusCode`, `headers`, `payload` | |
| PostgreSQL | `query`, `params` | `rows` cho truy vấn, `rowCount` cho insert |
| InfluxDB | `line`, giao thức dòng | |
| TCP Out, UDP Out | `host`, `port`, `payload` (`session` khi trả lời) | |
| TCP Request | `host`, `port`, `payload` | `payload`, đọc theo cách nút đọc một phản hồi thật |
| WebSocket Out | `payload` (`session` khi trả lời) | |
| File | `filename`, `action`, `payload` | |
| File In | `filename` | `payload`, nội dung |
| exec | `command`, `args` | `stdout`, `stderr`, `code` (0) |
| scan | `range`, `ports` | `devices` |
| netinfo | | `interfaces` |

Có vài thứ bài kiểm thử không kiểm tra, có chủ ý, vì chúng thuộc về thiết bị chứ không phải luồng: danh sách cho phép của `exec`, các phạm vi đường dẫn và khám phá, và chứng chỉ trong `tls-config`. Trong kiểm thử không có gì được chạy, mở, thăm dò hay quay số, nên không có gì để rào lại hay mã hóa, và việc triển khai vẫn chịu trách nhiệm về tất cả chúng trên thiết bị mà nó đến.

Bằng chứng là một bài kiểm thử trỏ từng nút trong số đó tới một cổng TCP, một cổng UDP và một thư mục mà bài kiểm thử nắm giữ, cho một số đọc đi qua tất cả, kiểm tra từng byte xem mỗi nút sẽ gửi gì, rồi đếm: không kết nối, không datagram, không tệp nào được ghi, không gì được thực thi. Nút vươn ra ngoài mà không có bản giả sẽ bị từ chối theo tên trước khi có gì chạy, và bài kiểm thử bảng nút thất bại nếu ai đó thêm một nút như vậy.
