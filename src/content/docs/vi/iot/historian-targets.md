---
title: "Đích của historian"
description: "Ghi mọi số đo HotLoop lưu giữ sang cả PostgreSQL, TimescaleDB, SQL Server, InfluxDB, MySQL hoặc MariaDB của nhà máy."
---

HotLoop giữ lịch sử riêng của mình và điều đó không thay đổi. Nhưng nhà máy vốn đã có cơ sở dữ liệu. Bộ phận CNTT sao lưu, vá lỗi, nối Power BI vào đó và chịu trách nhiệm về nó khi bị kiểm toán, và không ai chuyển sang cơ sở dữ liệu của chúng tôi chỉ để xem một xu hướng. Vì vậy HotLoop ghi lịch sử ra cả cơ sở dữ liệu của họ.

Mọi số đo mà historian tích hợp lưu giữ đều đi tới mọi đích: cùng số đo, sau cùng vùng chết, với cùng chất lượng. Không nhiều hơn, không ít hơn. Xu hướng vẽ từ đích và xu hướng vẽ trong HotLoop khớp nhau, vì chúng là cùng các hàng.

Đích có trong HotLoop IoT, Edge và Gateway. Không có trong Edge Relay: nó không có lịch sử riêng để đưa một đích bắt kịp, và toàn bộ việc của relay là chuyển số đo tới một Gateway, nơi có thể ghi chúng đi bất cứ đâu.

Các cơ sở dữ liệu HotLoop ghi vào:

| Loại | Phiên bản đã chạy thử | <span class="sr-only">Details</span> |
|---|---|---|
| PostgreSQL và TimescaleDB | PostgreSQL 16 với TimescaleDB 2.30 | [bên dưới](#postgresql-và-timescaledb) |
| Microsoft SQL Server | SQL Server 2025 CU9 | [bên dưới](#microsoft-sql-server) |
| InfluxDB 2 và 3 | InfluxDB 2.9.1 và InfluxDB 3 Core 3.12.0 | [bên dưới](#influxdb-2-và-3) |
| MySQL và MariaDB | MySQL 26.7.0 và MariaDB 13.0.2 | [bên dưới](#mysql-và-mariadb) |
| Kafka API (luồng sự kiện) | Apache Kafka 4.4.0 và Redpanda 26.2.6 | [bên dưới](#kafka-api-luồng-sự-kiện) |

## Thêm một đích

**Cài đặt, Đích của historian, Thêm đích**, hoặc `POST /api/historian/targets` (xem [HTTP API](/vi/iot/api/#đích-historian)). Chỉ dành cho quản trị viên, vì đích là nơi dữ liệu nhà máy đi tới, và quyết định đó thuộc về quản trị viên. Bất kỳ ai đọc được phần cài đặt đều thấy các đích và tình trạng của từng đích.

Một đích gồm loại, địa chỉ (`host` hoặc `host:port`), cơ sở dữ liệu, bảng và tài khoản đăng nhập. Mật khẩu được niêm phong bằng cùng khóa với thông tin xác thực của thiết bị (`HOTLOOP_SECRET_KEY_FILE`, xem [Sao lưu và khôi phục](/vi/iot/backup/)) và không bao giờ lấy ra được từ API. Không có khóa thì đích có mật khẩu bị từ chối: tài khoản cơ sở dữ liệu ở dạng rõ trong bản sao lưu chính là điều khóa này sinh ra để ngăn.

HotLoop tạo bảng nếu chưa có. Nếu bảng đã có nhưng không phải do HotLoop tạo (không có sáu cột bên dưới), đích sẽ ở trạng thái ngừng và cho biết cột nào còn thiếu, thay vì từ chối từng số đo một.

## Những gì vào bảng

Cùng sáu cột như lịch sử riêng của HotLoop, nên truy vấn viết cho bên này đọc được bên kia:

| Cột | <span class="sr-only">Details</span> |
|---|---|
| `ts` | Thời điểm đo, UTC, chính xác đến micro giây |
| `device_id` | Thiết bị |
| `tag_name` | Tag |
| `value` | Con số, hoặc để trống nếu là số đo dạng văn bản |
| `string_val` | Văn bản, hoặc để trống nếu là số |
| `quality` | `good`, `bad` hoặc `uncertain` |

Khóa chính là `(device_id, tag_name, ts)`, thiết bị và tag đứng trước vì xu hướng hỏi một tag theo thời gian. Khóa đó cũng là lý do gửi một số đo hai lần là vô hại: vẫn chỉ là một hàng. Phần bắt kịp bên dưới dựa vào điều này một cách có chủ ý.

## Khi một đích ngừng hoạt động

Đây là phần quan trọng, nên sau đây là chính xác những gì xảy ra.

**Việc thăm dò không bao giờ chờ nó.** Số đo đi tới đích qua một hàng đợi trong bộ nhớ, lớn bằng hàng đợi của historian tích hợp (`HOTLOOP_HISTORIAN_QUEUE_SIZE`). Việc giao một số đo không bao giờ bị chặn. Hàng đợi đầy sẽ bỏ số đo cũ nhất để lấy chỗ, cùng quy tắc mà historian tích hợp áp dụng và vì cùng lý do: hàng đợi không giới hạn trên một pod có giới hạn bộ nhớ sẽ kết thúc bằng OOM kill, và khi đó bạn mất cả phần tồn đọng, dữ liệu trực tiếp lẫn tiến trình. Một đích nằm sau tường lửa nuốt mọi gói tin đã được thử để không giữ chân thứ gì: không thăm dò, không historian tích hợp, không cả việc tắt máy.

**Nó bắt kịp khi quay lại.** Phần đang chờ trong hàng đợi đi trước. Phần hàng đợi buộc phải bỏ đi sau, lấy từ lịch sử riêng của HotLoop, nơi đã có sẵn từng số đo đó. Không có bản sao thứ hai trên đĩa để định cỡ hay làm đầy, và việc bắt kịp hoạt động chừng nào HotLoop còn giữ lịch sử (`HOTLOOP_HISTORIAN_RETENTION_DAYS`, 90 ngày nếu bạn chưa đổi), chứ không phải chừng nào một bộ đệm còn chịu được.

**Khởi động lại giữa chừng không làm mất dấu.** Thứ đích còn nợ là một khoảng thời gian ghi trong hàng của nó, không phải một đống số đo trong bộ nhớ. Dừng sạch sẽ ghi lại chính xác phần còn nợ. Sự cố thì không làm được, nên ngay khi một đích ngừng hoặc bắt đầu bỏ số đo, HotLoop ghi lại điểm bắt đầu, với đầu kia để mở. Lần khởi động sau sẽ gửi mọi thứ từ đó.

**Nó nói rõ những gì không gửi được.** Có hai thứ không thể bắt kịp, và cả hai đều vào nhật ký hệ thống, kèm số lượng và thời điểm đo:

- Số đo cũ hơn thời hạn lưu giữ của HotLoop khi đích quay lại. Chúng cũng đã mất khỏi HotLoop. Nhật ký nêu đúng khoảng thời gian.
- Số đo mà cơ sở dữ liệu của đích từ chối thẳng: một giá trị cột không chứa được, một ràng buộc check ai đó đặt lên bảng. Lô được chia nhỏ cho đến khi tìm ra các số đo bị từ chối, nên một số đo xấu không bao giờ giữ chân số còn lại, và chúng được đếm là bị từ chối. Việc này chỉ được báo tối đa mỗi phút một lần, vì một tag mà cơ sở dữ liệu không chứa được sẽ bị từ chối ở mỗi lần thăm dò.

Một cơ sở dữ liệu không cho HotLoop vào được (sai mật khẩu, không có quyền chèn, bảng thiếu cột) là **ngừng**, không bao giờ là "đang từ chối". Các số đo chờ, và ngay khi ai đó sửa xong, chúng được ghi vào. Chỉ những từ chối liên quan đến chính các số đo mới bị bỏ.

Mỗi bước đều vào nhật ký hệ thống, dưới chủ đề `historian/<id>`:

```
warning  Historian target plant-pg (Plant historian) is down: dial tcp 10.20.0.9:5432: connect: connection refused.
         Readings wait in memory, up to 50000 of them; past that they're sent from HotLoop's own history when it's back.
info     Historian target plant-pg is back after 41m12s down. What waited in memory goes first.
warning  Historian target plant-pg couldn't keep up, and its queue dropped readings taken between
         2026-10-03T10:12:40Z and 2026-10-03T10:43:19Z (182211 readings dropped since HotLoop started).
         They go out from HotLoop's own history next.
info     Historian target plant-pg caught up: 182211 readings taken between 2026-10-03T10:12:40Z and
         2026-10-03T10:43:19Z went out from HotLoop's own history.
```

Thẻ Cài đặt hiển thị điều tương tự theo thời gian thực: trạng thái (`writing`, `catching up`, `down`, `off`), lý do ngừng, lượng đang chờ và phần còn nợ.

Việc bắt kịp đi sau số đo mới nhất còn nợ một phút, và chờ historian tích hợp theo kịp, vì một số đo còn trong hàng đợi đó thì chưa nằm trong cơ sở dữ liệu. Đọc vượt qua nó sẽ bỏ qua số đo đó vĩnh viễn.

## Tắt, đổi, gỡ một đích

Khi tắt, đích không nhận gì và không nợ gì cho khoảng thời gian bị tắt. Phần đã nợ từ trước vẫn còn nợ. Một thay đổi (mật khẩu mới, địa chỉ mới) khởi động lại đích với cài đặt mới, và phần đã nợ vẫn còn nợ. Gỡ đích thì quên phần đã nợ. Những gì đích đã có vẫn nằm trong cơ sở dữ liệu của nó.

Chỉ HotLoop đang phục vụ giao diện mới ghi vào các đích. Một trình hỗ trợ `--mcp-stdio` chạy bên cạnh thì không, nếu không mọi thứ sẽ đi ra hai lần.

## PostgreSQL và TimescaleDB

```json
{"id":"plant-pg","name":"Plant historian","kind":"postgres","address":"db.plant.local","database":"plant",
 "username":"hotloop","password":"...","useTls":true}
```

- Cổng mặc định là 5432. Bảng mặc định là `hotloop_history`, và có thể kèm một schema (`history.hotloop`). Schema phải tồn tại.
- Nếu cơ sở dữ liệu có phần mở rộng TimescaleDB, bảng HotLoop tạo ra là một hypertable trên `ts`. Nếu việc chuyển đổi thất bại, bảng vẫn là bảng thường, vẫn nhận mọi số đo, và nhật ký hệ thống cho biết lý do.
- Tài khoản đăng nhập cần kết nối được, tạo bảng lần đầu (hoặc bạn tự tạo, với sáu cột ở trên) và chèn vào đó. Không cần gì thêm. Tài khoản đọc được bảng nhưng không chèn được là đích ngừng, không phải đích từ chối số đo.
- `useTls` kiểm tra chứng chỉ của máy chủ (`sslmode=verify-full`). `insecureSkipVerify` mã hóa mà không kiểm tra (`sslmode=require`). Không có `useTls` thì kết nối không được mã hóa (`sslmode=disable`).
- NaN và các giá trị vô cực đi vào nguyên trạng: `double precision` chứa được chúng.
- Các câu lệnh không được chuẩn bị trước, nên PgBouncer ở chế độ giao dịch đặt trước cơ sở dữ liệu vẫn ổn.

Bảng, nếu bạn muốn tự tạo:

```sql
CREATE TABLE hotloop_history (
    ts         timestamptz      NOT NULL,
    device_id  text             NOT NULL,
    tag_name   text             NOT NULL,
    value      double precision,
    string_val text,
    quality    text             NOT NULL,
    PRIMARY KEY (device_id, tag_name, ts)
);
```

## Microsoft SQL Server

```json
{"id":"plant-sql","name":"Plant historian","kind":"sqlserver","address":"sql.plant.local","database":"plant",
 "username":"hotloop","password":"...","useTls":true}
```

- Cổng mặc định là 1433, bảng là `hotloop_history` trong schema `dbo`. Schema đứng trước (`history.hotloop`) được dùng đúng như đã cho, và phải tồn tại.
- Cơ sở dữ liệu phải tồn tại. HotLoop tạo bảng, không tạo cơ sở dữ liệu.
- Bảng HotLoop tạo có `ts` là `datetime2(6)`, các tên là `nvarchar`, `value` là `float`, `string_val` là `nvarchar(max)`, và khóa chính `(device_id, tag_name, ts)`. Khóa đó là lý do tên tag dài tối đa 380 ký tự, còn tên dài hơn bị từ chối như một số đo và được báo: khóa clustered có thể là 900 byte.
- Tài khoản đăng nhập cần kết nối được, tạo bảng lần đầu (hoặc bạn tự tạo, với sáu cột đó) và chèn vào đó. Tài khoản đọc được bảng nhưng không chèn được là đích ngừng, không phải đích từ chối số đo.
- **NaN và các giá trị vô cực đi vào cùng thời gian và chất lượng nhưng không có số.** `float` của SQL Server không chứa được chúng. Số đo vẫn có, và `value` là NULL.
- SQL Server tự mã hóa phần đăng nhập, nên mật khẩu không bao giờ đi qua ở dạng rõ. `useTls` mã hóa cả các số đo và kiểm tra chứng chỉ của máy chủ; `insecureSkipVerify` mã hóa mà không kiểm tra.
- Số đo đã có thì được bỏ qua, nên gửi hai lần vẫn chỉ là một hàng.

Bảng, nếu bạn muốn tự tạo:

```sql
CREATE TABLE dbo.hotloop_history (
    ts         datetime2(6)  NOT NULL,
    device_id  nvarchar(64)  NOT NULL,
    tag_name   nvarchar(380) NOT NULL,
    value      float         NULL,
    string_val nvarchar(max) NULL,
    quality    varchar(16)   NOT NULL,
    CONSTRAINT PK_hotloop_history PRIMARY KEY CLUSTERED (device_id, tag_name, ts)
);
```

## MySQL và MariaDB

```json
{"id":"plant-mysql","name":"Plant historian","kind":"mysql","address":"mysql.plant.local","database":"plant",
 "username":"hotloop","password":"...","useTls":true}
```

Một loại cho cả hai: chúng nói cùng một giao thức và nhận cùng các câu lệnh ở đây, và cả hai đều chạy trong bộ kiểm thử.

- Cổng mặc định là 3306, bảng là `hotloop_history`. Tên có cơ sở dữ liệu đứng trước (`other.hotloop`) được dùng đúng như đã cho. Cơ sở dữ liệu phải tồn tại; HotLoop tạo bảng, không tạo cơ sở dữ liệu.
- Bảng HotLoop tạo là InnoDB với `ts` là `DATETIME(6)` theo UTC, `value` là `DOUBLE`, `string_val` là `LONGTEXT`, và khóa chính `(device_id, tag_name, ts)`. Các tên là `utf8mb4_bin`, vì tên tag của HotLoop phân biệt hoa thường còn collation mặc định của máy chủ thì không: `Temp` và `TEMP` sẽ thành một khóa. Khóa đó là lý do tên tag dài tối đa 512 ký tự, còn tên dài hơn bị từ chối như một số đo và được báo.
- **INSERT là quyền duy nhất cần thiết** khi bảng đã có, và CREATE ở lần đầu nếu bạn muốn HotLoop tạo. Nó không đọc bảng và không dùng `ON DUPLICATE KEY UPDATE`, vì như vậy sẽ đòi thêm UPDATE: số đo đã có là bản trùng của khóa chính và bị bỏ qua.
- **NaN và các giá trị vô cực đi vào cùng thời gian và chất lượng nhưng không có số.** `DOUBLE` không chứa được chúng. `value` là NULL.
- Bản trùng trên một chỉ mục duy nhất khác do ai đó thêm vào không phải cùng một số đo: nó bị từ chối và được báo, giống ràng buộc check.
- `useTls` mã hóa và kiểm tra chứng chỉ của máy chủ; `insecureSkipVerify` mã hóa mà không kiểm tra. Không có `useTls` thì mật khẩu vẫn không đi qua ở dạng rõ (đăng nhập mặc định của MySQL 8 gửi nó đã mã hóa bằng khóa của máy chủ), nhưng ai đó ở giữa có thể đánh tráo khóa đó, nên hãy đặt `useTls` cho mọi thứ không nằm trên đường truyền riêng của nhà máy.

Bảng, nếu bạn muốn tự tạo:

```sql
CREATE TABLE hotloop_history (
    ts         DATETIME(6)  NOT NULL,
    device_id  VARCHAR(64)  CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
    tag_name   VARCHAR(512) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
    value      DOUBLE       NULL,
    string_val LONGTEXT     CHARACTER SET utf8mb4 NULL,
    quality    VARCHAR(16)  NOT NULL,
    PRIMARY KEY (device_id, tag_name, ts)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

## InfluxDB 2 và 3

```json
{"id":"plant-influx","name":"Plant historian","kind":"influxdb","address":"influx.plant.local:8086",
 "org":"plant","database":"hotloop","password":"<an API token>","useTls":true}
```

Cùng một đích nói chuyện được với cả InfluxDB 2 và InfluxDB 3, qua HTTP thường (`/api/v2/write`, line protocol, dấu thời gian micro giây). Cả hai đều đáp lại, nên không có driver nào phải ghim và không có gì phải chọn.

- Cổng mặc định là 8086, của InfluxDB 2. InfluxDB 3 lắng nghe ở 8181 nếu bạn chưa đổi, nên hãy chỉ định cổng.
- `database` là bucket. `org` là tổ chức của InfluxDB 2, và InfluxDB 2 yêu cầu một tổ chức: không có thì mọi lần ghi đều là lỗi 400 nói rõ điều đó, và đích ngừng với thông báo ấy. InfluxDB 3 không có tổ chức, nên hãy bỏ trống.
- `password` là API token. Nó cần quyền ghi trên bucket (InfluxDB 2) hoặc trên cơ sở dữ liệu (InfluxDB 3). HotLoop không tạo bucket. Bucket không tồn tại cho lỗi 404, tức là đích ngừng, không phải số đo bị từ chối. InfluxDB 3 tạo cơ sở dữ liệu khi có dữ liệu ghi vào.
- `table` là measurement, mặc định `hotloop_history` nếu bạn không nói khác.
- Một số đo là một điểm. Thiết bị và tag là các tag, nên mỗi tag của HotLoop là một series. Con số (`value`) hoặc văn bản (`string_val`) và chất lượng (`quality`) là các field. Gửi một số đo hai lần sẽ tự ghi đè.
- **NaN và các giá trị vô cực đi vào cùng thời gian và chất lượng nhưng không có field `value`.** Line protocol không có cách nào để ghi chúng.
- InfluxDB giữ kiểu của một field vĩnh viễn (theo shard ở bản 2, theo cột ở bản 3). Nếu thứ khác đã ghi một số vào `string_val` hoặc văn bản vào `value`, các số đo của HotLoop thuộc loại còn lại bị từ chối, được đếm và nêu tên trong nhật ký hệ thống, còn phần còn lại vẫn vào.
- Lỗi 401 hoặc 403 (token mà nó không biết hoặc không ghi được) là đích ngừng, không phải từ chối: không có gì bị bỏ, và các số đo được ghi vào ngay khi token đúng.
- `useTls` chuyển sang `https` và kiểm tra chứng chỉ; `insecureSkipVerify` không kiểm tra.

## Kafka API (luồng sự kiện)

Không phải cơ sở dữ liệu: là một luồng. Mọi số đo historian lưu giữ đi vào một topic Kafka, và nếu bạn cho một topic thứ hai thì mọi dòng HotLoop ghi vào nhật ký hệ thống của chính nó (cảnh báo, thiết bị lên và xuống, thay đổi cấu hình) cũng vậy. Nó nói Kafka API, nên Apache Kafka, Redpanda và mọi thứ khác đáp ứng giao thức đó đều nhận được. Cùng hàng đợi, cùng cách bắt kịp từ lịch sử riêng của HotLoop, cùng nguyên tắc "broker ngừng không làm chậm thứ gì" như mọi đích khác.

```json
{"id":"plant-stream","name":"Plant event stream","kind":"kafka","address":"kafka1.plant.local:9093,kafka2.plant.local:9093",
 "table":"hotloop.tags","username":"hotloop","password":"...","useTls":true,
 "options":{"sasl":"scram-sha-512","caCert":"-----BEGIN CERTIFICATE-----...","eventsTopic":"hotloop.events"}}
```

- `address` là danh sách broker, cách nhau bằng dấu phẩy, cổng 9092 nếu không nêu. Một broker là đủ để bắt đầu: broker sẽ cho biết những broker còn lại ở đâu.
- `table` là topic cho số đo (`hotloop.tags` nếu bạn không nói khác). `options.eventsTopic` là topic cho sự kiện, là `hotloop.events` khi bạn thêm đích từ biểu mẫu hoặc bỏ nó khỏi lệnh gọi API, và để trống nghĩa là không có sự kiện. Hai topic không được trùng nhau.
- HotLoop tạo các topic nếu chưa có, với số partition và bản sao mặc định của chính broker. Tài khoản không tạo được chúng là một đích ngừng kèm lý do của broker, nên hãy tạo trước nếu tài khoản của bạn không làm được.
- `options.sasl` là `scram-sha-512`, `scram-sha-256` hoặc `plain`, cùng `username` và `password`. PLAIN gửi mật khẩu nguyên dạng, nên HotLoop từ chối nếu không có `useTls`. Tài khoản broker từ chối là **ngừng**, với "the broker refused the login" trong trạng thái, không bao giờ là "từ chối số đo".
- `useTls` kiểm tra chứng chỉ của broker. Nếu nó do CA của chính bạn ký, hãy đặt CA vào `options.caCert` dạng PEM. `insecureSkipVerify` mã hóa mà không kiểm tra.
- Chứng chỉ máy khách (mutual TLS), Kerberos và đăng nhập OAuth không được hỗ trợ.

**Những gì vào topic số đo.** Mỗi số đo là một đối tượng JSON, với khóa `deviceId/tag` để các số đo của một tag giữ đúng thứ tự trên một partition:

```json
{"ts":"2026-10-31T12:00:00.123456Z","deviceId":"press-01","tag":"Zone1_Temp","value":21.5,"quality":"good","unit":"°C"}
{"ts":"2026-10-31T12:00:00Z","deviceId":"press-01","tag":"Program","value":null,"text":"Grade A","quality":"good"}
{"ts":"2026-10-31T12:00:00Z","deviceId":"press-01","tag":"Speed","value":null,"nonFinite":"NaN","quality":"bad"}
```

Con số là `value`; văn bản là `text` còn `value` là null; JSON không mang được NaN hay vô cực, nên những giá trị đó ghi `nonFinite` (`NaN`, `+Inf`, `-Inf`) và `value` là null. Định dạng này chỉ được thêm field, không bao giờ đổi. Header: `hotloop-type: reading` và `content-type: application/json`. Dấu thời gian của chính bản ghi là lúc nó được tạo ra; thời điểm của số đo là `ts`.

**Những gì vào topic sự kiện.** Mỗi dòng nhật ký hệ thống là một đối tượng JSON, với khóa là chủ đề của nó (hoặc danh mục khi không có chủ đề), `hotloop-type: event`:

```json
{"at":"2026-10-31T12:00:00.456Z","severity":"warning","category":"alarm","subject":"press-01/Zone1_Temp",
 "actor":"system","message":"Zone 1 is over 250","detail":{"limit":250,"value":251.5}}
```

`detail` là JSON mà dòng đó mang theo, dưới dạng JSON, hoặc văn bản khi nó không phải JSON. Các dòng về chính các đích của historian bị loại ra, nếu không một broker đang ngừng sẽ tự báo cho chính nó rằng nó ngừng.

**Giao ít nhất một lần, và sự kiện là nỗ lực tối đa.**
- Số đo: việc giao được mọi bản sao đồng bộ xác nhận, và việc bắt kịp sau sự cố cố ý chồng lên phần đã gửi, nên một số đo có thể đến hai lần. `deviceId`, `tag` và `ts` xác định một bản trùng; bên tiêu thụ nào quan tâm sẽ bỏ bản lặp. Số đo không bao giờ tới broker là phần còn nợ và được gửi từ lịch sử riêng của HotLoop, giống như với cơ sở dữ liệu.
- Sự kiện là luồng trực tiếp. Không có lịch sử của chúng để bắt kịp, nên sự kiện sinh ra khi broker vắng mặt, hoặc vượt quá bộ đệm đầy, sẽ bị mất, và trạng thái của đích đếm số đó (`eventsLost`) và thẻ Cài đặt hiển thị.
- Broker biến mất giữa chừng một lần ghi sẽ khiến đích **ngừng** trong vòng 25 giây, và các số đo trong lần ghi đó là phần còn nợ. (Nếu không, franz-go sẽ chờ mãi một lần ghi mà nó không thể chứng minh là chưa tới nơi; HotLoop để nó bỏ cuộc, và đó là lý do bản trùng có thể xảy ra.)
- Số đo mà broker sẽ không bao giờ nhận (lớn hơn mức một thông điệp cho phép) bị từ chối riêng lẻ, được đếm và nêu tên trong nhật ký hệ thống, còn phần còn lại của lô vẫn đi tiếp.

HotLoop nói Kafka API qua [franz-go](https://github.com/twmb/franz-go) (BSD-3-Clause), được ghi nhận trong `NOTICE`. Nó làm tệp nhị phân nặng thêm khoảng 5 MiB.

## Cách kiểm thử

Mọi loại đích đều đã được chạy với cơ sở dữ liệu hoặc broker thật, qua một sự cố thật sự bị cắt rồi khôi phục: đích cuối cùng giữ đúng những gì HotLoop giữ, khởi động lại trong lúc đích ngừng sẽ bắt kịp ở lần khởi động sau, và một đích bị treo không giữ chân việc thăm dò lẫn historian tích hợp.
