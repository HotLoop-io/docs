---
title: "Quản trị một phiên bản Cascade"
description: "Biến, thư mục, lần chạy có ghi chú, che dữ liệu, Insights, bí mật bên ngoài và chuyển tiếp log, cho nhà máy có ngày càng nhiều quy trình."
---

Cách một nhà máy giữ quyền kiểm soát đối với số quy trình ngày càng nhiều: cài đặt dùng chung, thư mục, lần chạy có ghi chú, che dữ liệu, các con số theo thời gian, bí mật bên ngoài, chuyển tiếp log và nơi dữ liệu lớn được lưu. Tất cả đều miễn phí và có trong mọi bản dựng.

Mọi endpoint được nêu bên dưới đều có trong tài liệu OpenAPI tại `/api/v1/openapi.json`, và mỗi endpoint đều có một bài kiểm thử gọi đến nó, trên SQLite và trên Postgres.

## Biến

Trong trình chỉnh sửa: Biến, ở thanh trên cùng. Biến của toàn phiên bản nằm ở trên cùng, còn biến của từng dự án nằm dưới tên dự án. Chỉ hiện những gì vai trò của bạn cho phép.

Biến là một giá trị có tên mà quy trình đọc dưới dạng `vars.NAME`: ngưỡng trên của giá trị đặt, tên của một nhà máy, một URL gốc khác nhau giữa chuyền thử nghiệm và chuyền thật.

```yaml
- name: Check limit
  type: core.if
  version: 1
  params:
    condition: "{{ item.json.temp > toNumber(vars.TEMP_LIMIT) }}"
```

- Biến là **của toàn phiên bản** hoặc thuộc về **một dự án**. Khi cả hai cùng có một tên, biến của dự án thắng, và chỉ với các quy trình của dự án đó.
- Giá trị là văn bản, tối đa 8 KiB. Dùng `toNumber(vars.X)` khi cần một số.
- Tên gồm chữ cái, chữ số và dấu gạch dưới, bắt đầu bằng chữ cái hoặc dấu gạch dưới, dài tối đa 64 ký tự, vì nó phải đọc được là `vars.NAME`.
- **Biến không phải là bí mật.** Ai đọc được dự án thì đọc được biến của nó, và giá trị không bị xóa khỏi dữ liệu lần chạy. Mật khẩu, token hoặc khóa thì đặt trong kho thông tin đăng nhập, hoặc trong một kho bí mật bên ngoài (bên dưới).
- Một lần chạy đọc biến của nó khi bắt đầu, và đọc lại nếu nó tiếp tục sau khi chờ hoặc khởi động lại. Thay đổi đến lần chạy kế tiếp, không đến lần chạy đang ở giữa một bước. Một tên không tồn tại được đọc là rỗng, không phải lỗi.

| Lệnh gọi | Chức năng |
|---|---|
| `GET /api/v1/variables` | Các biến của phiên bản và những biến trong các dự án bạn đọc được; `?project=` thu hẹp về một dự án. |
| `POST /api/v1/variables` | Tạo một biến. Có `projectId` thì thuộc dự án, không có thì là của toàn phiên bản. |
| `PUT /api/v1/variables/{variable}` | Đổi tên và giá trị của nó. |
| `DELETE /api/v1/variables/{variable}` | Xóa nó. |

Ai được làm: trong một dự án, quyền `variable.read` liệt kê chúng, còn `variable.create`, `variable.update` và `variable.delete` thay đổi chúng. Viewer và operator đọc, editor và admin thay đổi. Biến của toàn phiên bản ai đã đăng nhập cũng đọc được, vì quy trình của dự án nào cũng đọc được chúng, và chỉ chủ sở hữu hoặc quản trị viên phiên bản mới thay đổi được. Một vai trò tùy chỉnh có thể mang bất kỳ quyền nào trong bốn quyền đó. Các thay đổi nằm trong nhật ký kiểm toán dưới dạng `variable.created`, `variable.updated` và `variable.deleted`, kèm tên và không bao giờ kèm giá trị.

## Thư mục

Trong trình chỉnh sửa: danh sách quy trình chính là các thư mục. Tạo một thư mục bằng Thư mục mới, lồng nó bằng Thêm thư mục con, và chuyển một quy trình từ chính hàng của nó trong danh sách. Chọn một thư mục khi tạo quy trình thì quy trình sẽ nằm ở đó.

Thư mục gom các quy trình của một dự án và lồng nhau, theo cách một nhà máy được bố trí: khu vực, chuyền, cell.

- Một thư mục thuộc một dự án. Tên là duy nhất giữa các thư mục cạnh nhau, và tên dài tối đa 100 ký tự.
- Thư mục lồng nhau tối đa 10 cấp.
- Một quy trình nằm trong một thư mục hoặc ở trên cùng của dự án. Lưu một phiên bản mới không di chuyển nó.
- Thư mục đang chứa quy trình hoặc thư mục khác không thể bị xóa (409), nên xóa thư mục không bao giờ là cách một quy trình biến mất. Một thư mục không thể được chuyển vào chính nó hay vào thư mục con của nó, và không thể chuyển sang dự án khác.

| Lệnh gọi | Chức năng |
|---|---|
| `GET /api/v1/folders` | Các thư mục trong dự án bạn đọc được, dạng phẳng, mỗi thư mục kèm `parentId`; `?project=` thu hẹp. |
| `POST /api/v1/folders` | Tạo một thư mục trong `projectId`, bên trong `parentId` hoặc ở trên cùng. |
| `PATCH /api/v1/folders/{folder}` | Đổi tên nó, hoặc chuyển nó bằng `parentId` (chuỗi rỗng cho trên cùng). |
| `DELETE /api/v1/folders/{folder}` | Xóa một thư mục rỗng. |
| `PUT /api/v1/workflows/{workflow}/folder` | Đặt một quy trình vào một thư mục, hoặc lên trên cùng bằng `folderId` rỗng. |
| `GET /api/v1/workflows?folder=` | Các quy trình của một thư mục, hoặc `folder=none` cho phần trên cùng của mỗi dự án. |

Mỗi quy trình mà API trả về đều cho biết `folderId` của nó. Các quyền `folder.read`, `folder.create`, `folder.update` và `folder.delete` hoạt động như các quyền của biến, và chuyển một quy trình cần `workflow.update`. Các thay đổi thư mục nằm trong nhật ký kiểm toán, còn việc chuyển là `workflow.moved`.

## Ghi chú cho lần chạy

Trong trình chỉnh sửa: trang của mỗi lần chạy có một ô Ghi chú với ngón tay cái lên hoặc xuống, một lời nhắn và các thẻ, và danh sách lần chạy lọc theo thẻ và theo bình chọn.

Một người có thể nói điều gì đó về một lần chạy sau khi nó xảy ra: ngón tay cái lên hoặc xuống, một lời nhắn và các thẻ để tìm lại nó. "Mẻ tốt đầu tiên sau khi đổi khuôn" và `scrap` là kiểu nội dung được ghi ở đây.

```sh
curl -X PUT $CASCADE/api/v1/executions/$RUN/annotation -H "Authorization: Bearer $KEY" \
  -d '{"vote":"up","note":"first good batch after the die change","tags":["die-change","first-shift"]}'
```

- Bình chọn là `up`, `down` hoặc rỗng. Lời nhắn dài tối đa 2000 ký tự. Một lần chạy có tối đa 20 thẻ, mỗi thẻ từ 1 đến 40 ký tự không có ký tự điều khiển, liệt kê một lần.
- `PUT` thay toàn bộ ghi chú, nên hãy gửi mọi thứ bạn muốn giữ. Một ghi chú không nói gì thì giống như không có. `DELETE /api/v1/executions/{execution}/annotation` xóa nó.
- Mỗi lần chạy mà API trả về đều mang ghi chú của nó, và danh sách mang nó trên từng hàng. `GET /api/v1/executions?tag=scrap` và `?vote=down` lọc, và kết hợp được với các bộ lọc khác.
- Ghi chú ghi lại ai để lại và khi nào, từ cùng danh tính mà nhật ký kiểm toán dùng.
- Ghi chú cần quyền `execution.annotate`, mà operator, editor và admin có còn viewer thì không. Viewer đọc ghi chú.
- Ghi chú mất đi khi lần chạy của nó bị xóa. Nhật ký kiểm toán giữ `execution.annotated` và `execution.annotation_cleared` cùng bình chọn và thẻ, và chỉ ghi rằng một lời nhắn đã được để lại, không ghi nội dung.

## Giữ các lần chạy đã hoàn tất

Trong trình chỉnh sửa: Cài đặt, Giữ các lần chạy đã hoàn tất trong (ngày). Qua API: `PATCH /api/v1/settings` với `{"retentionDays": 90}`, cần quyền `instance.settings` như các cài đặt còn lại.

Theo mặc định, mọi lần chạy đã hoàn tất được giữ mãi mãi, như vẫn luôn như vậy. Đặt một số ngày và một main sẽ xóa các lần chạy đã hoàn tất (thành công, thất bại hoặc bị hủy) đã kết thúc lâu hơn thế, cùng dữ liệu bước của chúng, mỗi giờ một lần. 0 tắt nó trở lại.

- Lần chạy đang xếp hàng, đang chạy hoặc đang chờ không bao giờ bị động đến, và lần chạy mà bản cha vẫn đang chạy cũng vậy, vì bản cha sẽ hỏi nó đã làm gì.
- Mỗi lô tối đa 500 lần chạy là một giao dịch riêng và ghi một hàng `execution.pruned` vào nhật ký kiểm toán, kèm số lượng đã xóa và mốc cắt. Đổi cài đặt ghi `instance.retention`.
- Mọi main đều chạy lượt này, và hai main cùng lúc chỉ thấy có ít việc hơn để làm.
- Việc dọn blob theo cùng lượt đó, và chạy mỗi giờ một lần dù việc giữ có bật hay không, nên một lần chạy bị xóa thủ công cũng được dọn. Xem "Dọn blob" bên dưới.

## Giới hạn một khóa API

Trong trình chỉnh sửa: Cài đặt, Số yêu cầu API mỗi khóa mỗi phút. Qua API: `PATCH /api/v1/settings` với `{"apiRateLimit": 120}`, với quyền `instance.settings`.

Theo mặc định, một khóa được gọi thường xuyên tùy ý. Đặt một số và mỗi khóa API, cùng mỗi tác tử đăng nhập qua MCP bằng một khóa, được gửi chừng đó yêu cầu mỗi phút. Một lệnh gọi vượt giới hạn nhận `429` kèm tiêu đề `Retry-After` cho biết phải chờ bao nhiêu giây. Mỗi khóa có bộ đếm riêng, nên một script chạy mất kiểm soát không thể dùng hết phần của khóa khác. Những người đăng nhập vào trình chỉnh sửa không bị giới hạn này.

Bộ đếm là của từng tiến trình, vì chính nó bảo vệ tiến trình: với ba main, một khóa có thể thực hiện tối đa gấp ba số đó, phân tán giữa chúng. Một thay đổi cài đặt đến mọi main trong vòng năm giây. Thay đổi nó ghi `instance.api_rate_limit` vào nhật ký kiểm toán, kèm số cũ và số mới.

Webhook có giới hạn riêng, đặt trên trigger, và tài khoản bị khóa sau nhiều lần sai mật khẩu; cả hai đều không thay đổi.

## Sao lưu và khôi phục

```
hotloop-cascade backup /backups/2026-11-20
hotloop-cascade restore /backups/2026-11-20
```

`backup` ghi một thư mục mới chứa bản sao nhất quán của cơ sở dữ liệu SQLite (lấy khi máy chủ đang chạy, bằng `VACUUM INTO`), tệp khóa niêm phong mọi thông tin đăng nhập đã lưu, các tệp blob và `manifest.json` với SHA-256 của từng tệp. Nó nhận cùng các cài đặt `--database`, `--key-file` và `--blob-dir` như máy chủ, từ cùng các biến môi trường. Thư mục phải chưa tồn tại hoặc phải rỗng; một bản sao lưu không bao giờ bị trộn vào bản cũ. Không có tệp khóa thì không có bản sao lưu, vì cơ sở dữ liệu thiếu khóa của nó chứa thông tin đăng nhập mà không ai đọc được.

`restore` đưa chúng trở lại, và máy chủ phải được dừng trước. Nó kiểm tra từng tệp với manifest trước khi ghi bất cứ thứ gì, nên một bản sao lưu bị hỏng hoặc không đầy đủ không thay đổi gì. Nó từ chối ghi đè một cơ sở dữ liệu, hoặc một tệp khóa khác, đã có sẵn; `--replace` cho biết bạn thực sự muốn vậy. Sau đó khởi động máy chủ: nó cập nhật lược đồ, và từ chối bản sao lưu do bản phát hành mới hơn chính nó tạo ra.

PostgreSQL: `backup` ghi khóa, các blob và manifest, rồi in ra lệnh `pg_dump --format=custom` tạo phần của cơ sở dữ liệu, vì chương trình đó là của chính PostgreSQL và image của Cascade không mang theo nó. `restore` đưa khóa và blob trở lại và in ra lệnh `pg_restore`. Các blob lưu trong S3 hoặc Azure không được sao chép; hãy sao lưu bucket ở đó.

Trước khi nâng cấp lên bản phát hành có di chuyển dữ liệu, hãy tạo một bản sao lưu: các bản di chuyển chỉ đi tiến, và quay lại image cũ cần đến bản sao lưu.

## Chính sách che dữ liệu của lần chạy

Trong trình chỉnh sửa: Cài đặt, Che dữ liệu để tạo các chính sách. Một quy trình chọn một chính sách trong bảng bên của trình chỉnh sửa khi chưa chọn gì, dưới Cài đặt quy trình.

Kho thông tin đăng nhập đã giữ bí mật ra khỏi mọi thứ mà một lần chạy lưu. Chính sách che dữ liệu dành cho dữ liệu không phải thông tin đăng nhập nhưng cũng không nên nằm trong lịch sử chạy: một số thẻ ra vào, tên của một người vận hành, một số thẻ ngân hàng đến qua webhook.

Một chính sách gồm một tên và các quy tắc:

- **fields**: tên khóa của item. Một khóa mà chính sách nêu tên sẽ bị thay toàn bộ giá trị bằng `[redacted]`, ở mọi độ sâu, bất kể kiểu của giá trị. So khớp không phân biệt hoa thường, và `*` cùng `?` hoạt động như ký tự đại diện, nên `*secret*` bắt được `plant_secret` và `SecretKey`.
- **patterns**: biểu thức chính quy, theo cú pháp RE2 của Go. Mọi chỗ khớp trong bất kỳ văn bản nào đều bị thay bằng `[redacted]`. Một mẫu khớp với văn bản rỗng bị từ chối.
- **steps**: tùy chọn. Chính sách chỉ áp dụng cho các bước được liệt kê. Để trống nghĩa là mọi bước.
- **appliesToAll**: tùy chọn. Chính sách áp dụng cho mọi quy trình, dù quy trình có nêu nó hay không.

Một quy trình chọn một chính sách theo tên trong cài đặt của nó:

```yaml
settings:
  redaction: Badges
```

Nó làm gì và khi nào:

- Nó chạy **khi lần chạy kết thúc**, trong cùng giao dịch đánh dấu lần chạy đã hoàn tất: thành công, thất bại hoặc dừng. Cho đến lúc đó, lần chạy có dữ liệu thật, vì bước kế tiếp cần nó và việc khởi động lại tiếp tục từ nó. Một lần chạy đang chờ vẫn giữ dữ liệu thật.
- Nó làm sạch đầu ra đã lưu của từng bước, thông báo lỗi đã lưu của từng bước, lỗi riêng của lần chạy và phản hồi webhook đã lưu. Nó không động đến nội dung tệp: chính sách đọc dữ liệu item, còn tệp là tham chiếu đến các byte.
- Những gì đã lưu là điểm xuất phát cho việc chạy lại hoặc thử lại từ giữa lần chạy đó, nên chạy lại sẽ thấy các giá trị đã được làm sạch. Các item trigger của quy trình nằm trong đầu ra của bước đầu tiên, và chúng cũng được làm sạch.
- Nó đọc quy trình đúng như lần chạy đó có, nên sửa một quy trình, hay chính sách, không bao giờ làm thay đổi một lần chạy đã kết thúc.
- Một quy trình nêu tên một chính sách không tồn tại sẽ **thất bại theo hướng đóng**: các lần chạy của nó không giữ dữ liệu item nào, như cài đặt lưu `metadata` hoạt động, và `problems` của quy trình nói rõ điều đó. Một chính sách bị thiếu không bao giờ được nghĩa là dữ liệu bị giữ lại mà ai đó đã muốn làm sạch.
- Một chính sách mà các quy trình nêu tên không thể bị xóa (409), và tên của nó không đổi được. Quy tắc thì đổi được.

| Lệnh gọi | Chức năng |
|---|---|
| `GET /api/v1/redaction-policies` | Mọi chính sách. Ai đã đăng nhập cũng đọc được, vì những người viết quy trình cần các tên. |
| `POST /api/v1/redaction-policies` | Tạo một chính sách. |
| `PUT /api/v1/redaction-policies/{policy}` | Thay mô tả và quy tắc của nó. |
| `DELETE /api/v1/redaction-policies/{policy}` | Xóa một chính sách mà không quy trình nào nêu tên. |

Tạo, đổi và xóa một chính sách cần quyền của phiên bản `redaction.manage`, mà chủ sở hữu và quản trị viên có. Mỗi thao tác nằm trong nhật ký kiểm toán dưới dạng `redaction.created`, `redaction.updated` và `redaction.deleted`.

## Insights

Trong trình chỉnh sửa: Insights, ở thanh trên cùng. Chọn một khoảng thời gian, một dự án và một quy trình; nó hiện các tổng, một biểu đồ và một bảng theo ngày, và một bảng theo quy trình.

`GET /api/v1/insights` cộng dồn các lần chạy trong một khoảng thời gian: chúng kết thúc ra sao, mất bao lâu, theo ngày và theo quy trình.

```sh
curl "$CASCADE/api/v1/insights?from=2026-10-10&to=2026-10-14&project=$PROJECT" -H "Authorization: Bearer $KEY"
```

- `from` và `to` là một thời điểm RFC 3339 hoặc một ngày (nửa đêm UTC). Nếu không có, đó là bảy ngày gần nhất tính đến bây giờ. Nó trả lời tối đa cho 366 ngày.
- `project` và `workflow` thu hẹp phạm vi. Nếu không có, nó đếm mọi dự án mà người gọi đọc được lần chạy, nên số liệu của mỗi người là của riêng họ.
- Một lần chạy được tính vào ngày UTC mà nó được tạo.
- `totals` và mọi hàng trong `days` và `workflows` mang `total`, `succeeded`, `failed`, `canceled` và `unfinished` (đang xếp hàng, đang chạy hoặc đang chờ), thời gian chạy trung bình và dài nhất tính bằng mili giây trên các lần chạy có cả thời điểm bắt đầu và kết thúc, và `failureRate`.
- `failureRate` là số thất bại chia cho số thành công cộng số thất bại. Lần chạy bị hủy không phải là thất bại và lần chạy chưa xong chưa có kết quả, nên cả hai đều không được tính. Giá trị là 0 khi chưa có gì kết thúc theo hướng nào.
- `days` liệt kê mọi ngày UTC trong khoảng thời gian, với số 0 cho ngày không có gì chạy, nên biểu đồ không có khoảng trống phải đoán. `workflows` là 50 quy trình bận nhất, quy trình bận nhất trước.

Nó đọc cùng các hàng lần chạy như danh sách lần chạy, nên cần quyền `execution.read` và một khóa có phạm vi cho quyền đó.

## Bí mật bên ngoài

Trong trình chỉnh sửa: Cài đặt, Bí mật bên ngoài. Thêm một nhà cung cấp, thử nó với một đường dẫn từ cùng thẻ, và xem tham chiếu đến nó trông thế nào.

Trường bí mật của một thông tin đăng nhập có thể trỏ đến một bí mật lưu trong HashiCorp Vault hoặc OpenBao thay vì tự chứa bí mật. Xoay vòng mật khẩu trong kho và mọi quy trình dùng mật khẩu mới ở lần chạy kế tiếp, không ai phải sửa thông tin đăng nhập, và một bản sao cơ sở dữ liệu của bạn không bao giờ chứa mật khẩu.

Một tham chiếu trông như thế này, trong bất kỳ trường bí mật nào của một thông tin đăng nhập:

```
secret://bao/plant/line-3/db#password
```

Đó là nhà cung cấp tên `bao`, bí mật ở `plant/line-3/db` và khóa `password` của nó. Thông tin đăng nhập lưu văn bản đó, được niêm phong như mọi bí mật. Không có gì mà nó trỏ đến được lưu ở đây: giá trị được đọc khi một lần chạy mở thông tin đăng nhập, được giữ trong bộ nhớ trong thời gian cache của nhà cung cấp, và được làm sạch khỏi mọi thứ lần chạy lưu, giống mật khẩu trong kho. Chỉ các trường bí mật mới nhận tham chiếu. Một tham chiếu gõ vào trường không phải bí mật chỉ là văn bản.

### Thiết lập một nhà cung cấp

Nhà cung cấp là máy chủ, cách Cascade đăng nhập vào đó và nơi nó được phép đọc. Tạo, đổi và gỡ một nhà cung cấp là việc của chủ sở hữu hoặc quản trị viên phiên bản, quyền `secrets.manage`, và phải do một người đã đăng nhập thực hiện, không phải khóa API.

```sh
curl -X POST $CASCADE/api/v1/secret-providers -H "X-CSRF-Token: ..." -d '{
  "name": "bao",
  "address": "https://bao.plant.example:8200",
  "authMethod": "approle", "roleId": "...", "secretId": "...",
  "allowedPaths": ["plant"]
}'
```

| Trường | Chức năng |
|---|---|
| `name` | 1 đến 40 chữ thường, chữ số và dấu gạch ngang. Nó có trong mọi tham chiếu, nên không thể đổi sau này. |
| `address` | URL của máy chủ. |
| `mount`, `kvVersion` | Nơi engine KV được gắn (`secret` theo mặc định) và là phiên bản 1 hay 2 (mặc định là 2). |
| `namespace` | Được gửi dưới dạng `X-Vault-Namespace`, cho một namespace của máy chủ. |
| `authMethod` | `token` với `token`, hoặc `approle` với `roleId` và `secretId`. `authMount` là nơi AppRole được gắn (`approle` theo mặc định). AppRole tự đăng nhập và đăng nhập lại khi token hết hạn. |
| `caCert` | Một tổ chức cấp chứng chỉ PEM để tin cậy cho máy chủ, khi chứng chỉ của nó không thuộc tổ chức mà hệ thống tin cậy. |
| `allowedPaths` | **Bắt buộc.** Những nơi duy nhất mà một tham chiếu được đọc. `plant` cho phép `plant` và mọi thứ bên dưới, và không phải `plantation`. |
| `projects` | Tùy chọn. Những dự án duy nhất được dùng nhà cung cấp. Để trống thì dự án nào cũng được. |
| `cacheSeconds` | Thời gian một bí mật đã đọc được giữ trong bộ nhớ, 0 đến 3600. Mặc định 30. 0 là đọc mỗi lần. |

Cách Cascade đăng nhập (token, hoặc id và bí mật AppRole) được niêm phong dưới khóa của phiên bản, được bọc lại khi xoay vòng khóa cùng mọi thứ khác, và không bao giờ được hiện bởi bất kỳ lệnh gọi nào. Bỏ nó ra khỏi một thay đổi thì giá trị đã lưu được giữ nguyên.

`POST /api/v1/secret-providers/{provider}/test` đăng nhập và, với một `path`, đọc nó, rồi cho biết có thành công không. Nó không bao giờ trả về giá trị. `GET /api/v1/secret-providers` liệt kê các nhà cung cấp cho bất kỳ ai đã đăng nhập, vì những người tạo thông tin đăng nhập cần các tên. Các lệnh gọi nằm trong nhật ký kiểm toán dưới dạng `secrets.provider_created`, `_updated` và `_deleted`.

### Những gì nó sẽ không làm

- **Nhà cung cấp cần các đường dẫn được phép.** Một token cho Vault thường đọc được nhiều hơn hẳn những gì người sửa thông tin đăng nhập nên có thể nêu tên, và nếu không có danh sách, bất kỳ ai tạo được thông tin đăng nhập đều có thể trỏ một cái đến bất kỳ bí mật nào mà token chạm tới và bắt một quy trình gửi nó đi đâu đó. Hãy cấp cho nhà cung cấp các đường dẫn mà thông tin đăng nhập của nó cần, và cấp cho chính sách của nó cũng như vậy.
- **Tham chiếu được kiểm tra khi thông tin đăng nhập được lưu**, không chỉ khi một lần chạy dùng nó: nhà cung cấp phải tồn tại, mở cho dự án của thông tin đăng nhập và cho phép đường dẫn đó. Đường dẫn có phần rỗng, dấu chấm hoặc `..` bị từ chối.
- **Một lần chạy không đọc được bí mật sẽ thất bại và nói rõ lý do**, nêu nhà cung cấp, đường dẫn và khóa chứ không bao giờ nêu giá trị: không có nhà cung cấp như vậy, đường dẫn mà nhà cung cấp không cho phép, không có bí mật ở đó, không có khóa như vậy, hoặc chính lời từ chối của máy chủ (chính sách không cho phép đọc là "permission denied").
- **Xóa một nhà cung cấp không sửa thông tin đăng nhập.** Những thông tin đăng nhập trỏ đến nó sẽ thất bại khi một lần chạy mở chúng, báo rằng nhà cung cấp đã mất.
- Một giá trị bí mật thật sự bắt đầu bằng `secret://` không thể được lưu làm bí mật, vì nó bị đọc như một tham chiếu.
- Các giá trị là số hoặc true hay false được đọc là văn bản. Một giá trị là cả một đối tượng hoặc một danh sách bị từ chối.
## Chuyển tiếp log

Trong trình chỉnh sửa: Cài đặt, Chuyển tiếp log (chủ sở hữu và quản trị viên). Mỗi đích cho biết nó đã gửi bao nhiêu, lần giao gần nhất khi nào và lỗi gần nhất, kèm một nút gửi một sự kiện thử.

Gửi nhật ký kiểm toán, và một dòng cho mỗi lần chạy kết thúc, đến những nơi nhà máy vốn đã lưu log: máy chủ syslog, hoặc bất cứ thứ gì nhận log OTLP qua HTTP (một collector OpenTelemetry, Loki, một nền tảng log). Sự kiện rời đi ngay khi xảy ra, nên một SIEM thấy lần đăng nhập thất bại trong vài giây, và dấu vết kiểm toán tồn tại ở nơi mà quản trị viên của phiên bản này không thể viết lại.

Một đích là một nơi. Hãy tạo bao nhiêu tùy nhu cầu:

```sh
curl -X POST $CASCADE/api/v1/log-destinations -H "X-CSRF-Token: ..." -d '{
  "name": "plant syslog", "kind": "syslog",
  "address": "syslog.plant.example:6514", "network": "tls",
  "caCert": "-----BEGIN CERTIFICATE-----..."
}'
curl -X POST $CASCADE/api/v1/log-destinations -H "X-CSRF-Token: ..." -d '{
  "name": "collector", "kind": "otlp", "endpoint": "https://otel.plant.example/v1/logs",
  "headers": {"Authorization": "Bearer ..."}
}'
```

Tạo, đổi và gỡ các đích là việc của chủ sở hữu và quản trị viên phiên bản (`logstream.manage`), do một người đã đăng nhập thực hiện chứ không phải khóa API, vì đích là nơi nhật ký kiểm toán đi đến. Các lệnh gọi nằm trong nhật ký kiểm toán dưới dạng `logstream.destination_created`, `_updated` và `_deleted`.

### Những gì được gửi

- **Sự kiện kiểm toán**: mọi hàng của nhật ký kiểm toán, kèm số thứ tự và hash của nó. Số thứ tự và hash là cách bên nhận phát hiện bản lặp, và hash là của chính hàng đó, nên chuỗi có thể được kiểm tra từ những gì đã đến. Đăng nhập thất bại hoặc bị từ chối là cảnh báo, mọi thứ khác là thông báo.
- **Sự kiện lần chạy**: một sự kiện cho mỗi lần chạy kết thúc, dù kết thúc theo cách nào: id của lần chạy, id và tên của quy trình, dự án, trạng thái, chế độ, thời điểm được tạo, bắt đầu và kết thúc, thời gian chạy, và lỗi cùng bước nó thất bại. Lần chạy thất bại là lỗi, lần chạy bị dừng là thông báo, lần chạy tốt là thông tin. Chúng được gửi vài giây sau khi lần chạy kết thúc.
- **Không bao giờ gửi dữ liệu item.** Những gì các bước của một lần chạy đã thấy và tạo ra ở lại trong lần chạy, nơi các chính sách che dữ liệu bảo vệ nó. Nhật ký kiểm toán không bao giờ chứa bí mật.

`events` chọn một hoặc cả hai (`["audit"]`, `["execution"]`, mặc định cả hai). `start` cho biết một đích mới bắt đầu từ đâu: `now`, mặc định, gửi những gì xảy ra sau khi nó được tạo, còn `beginning` gửi trước toàn bộ nhật ký kiểm toán và mọi lần chạy đã kết thúc.

### Syslog

Một thông điệp theo RFC 5424: `<priority>1 time host hotloop-cascade pid msgid - {json}`, với sự kiện là một dòng JSON. Mức ưu tiên là facility nhân tám cộng mức nghiêm trọng. Msgid là hành động kiểm toán (`workflow.saved`) hoặc trạng thái của lần chạy.

| Trường | Chức năng |
|---|---|
| `address` | `host:port`. |
| `network` | `tcp` (mặc định), `udp` hoặc `tls`. |
| `framing` | Với `tcp` và `tls`: `octet` (đếm octet theo RFC 6587, mặc định) hoặc `newline`. UDP là một datagram cho mỗi sự kiện. |
| `facility` | Mặc định `local0`; bất kỳ tên facility syslog nào. |
| `appName` | APP-NAME của tiêu đề, mặc định `hotloop-cascade`. |
| `caCert`, `serverName` | Với `tls`: tổ chức để tin cậy, và tên mà chứng chỉ phải được cấp cho khi nó không phải máy chủ. Không có cài đặt nào bỏ qua bước kiểm tra. |

### OTLP

Log đi đến `endpoint` dưới dạng OTLP qua HTTP với phần thân JSON: một bản ghi log cho mỗi sự kiện, phần thân là sự kiện dưới dạng JSON, và các phần của nó là thuộc tính (`cascade.event`, `cascade.action`, `cascade.status`, `cascade.project`, `cascade.actor.name` và tiếp tục như vậy) để bên nhận có thể lọc mà không cần phân tích. Tài nguyên ghi `service.name=hotloop-cascade`, phiên bản của nó và máy chủ. `headers` được gửi kèm mọi yêu cầu, cho một token hoặc một tenant. Chúng được niêm phong dưới khóa của phiên bản, được bọc lại khi xoay vòng khóa, và không bao giờ được hiện: danh sách chỉ nêu tên chúng. `caCert` và `serverName` hoạt động như với syslog.

### Việc giao hoạt động thế nào

- **Ít nhất một lần, theo thứ tự.** Một đích nhớ hàng kiểm toán cuối cùng và lần chạy đã kết thúc cuối cùng mà nó đã gửi. Đích nào ngừng hoạt động sẽ nhận mọi thứ nó đã lỡ khi quay lại, theo thứ tự, và việc khởi động lại tiếp tục từ chỗ nó dừng. Nếu bên gửi bị ngắt giữa lúc gửi và lúc ghi nhận, các sự kiện đó được gửi lại, và đó là việc các số thứ tự phục vụ.
- **Một đích bị lỗi sẽ giãn dần thời gian thử lại**, một giây rồi nhân đôi đến năm phút, và trạng thái của nó nói điều gì đã sai và khi nào: `lastError`, `lastErrorAt`. Một lần thành công xóa nó. Không có gì bị bỏ trong lúc nó ngừng hoạt động, nên giới hạn là nhật ký kiểm toán, không phải một hàng đợi.
- **Mỗi lúc một bên gửi.** Với nhiều main, main nào giữ lease của một đích sẽ gửi đến đó; các main khác chờ và tiếp quản nếu nó dừng.
- **Đổi một đích vẫn giữ vị trí của nó.** Chuyển nó sang địa chỉ khác không bao giờ gửi lại hay bỏ sót gì. Các tiêu đề bị bỏ ra khỏi một thay đổi được giữ lại, và một đối tượng rỗng xóa chúng. Tên và loại không đổi được.
- `POST /api/v1/log-destinations/{destination}/test` gửi một sự kiện giả qua cùng đường đó và cho biết nó có đến không, kèm lý do khi không đến. Nó không di chuyển gì.
- `GET /api/v1/log-destinations` cho thấy trạng thái của từng đích: đã gửi bao nhiêu sự kiện, số thứ tự kiểm toán cuối cùng đã giao, lần thành công gần nhất khi nào và lỗi gần nhất.

## Dữ liệu lớn nằm ở đâu

Các tệp và tải trọng lớn mà một lần chạy mang theo (một tệp PDF tải về, một khung hình camera, một bảng tính) được lưu dưới dạng blob, tách khỏi cơ sở dữ liệu. Theo mặc định chúng nằm trên đĩa của phiên bản. Đặt `HOTLOOP_CASCADE_BLOB_STORE` để đưa chúng vào một bucket S3 hoặc một container blob Azure, để main có thể được dựng lại mà không phải mang chúng theo và nhiều main dùng chung một bản sao.

| Cài đặt | Ý nghĩa |
| --- | --- |
| `HOTLOOP_CASCADE_BLOB_STORE` | `fs` (mặc định), `s3` hoặc `azure`. |
| `HOTLOOP_CASCADE_BLOB_SPOOL_DIR` | Nơi một blob chờ trong lúc được hash trước khi tải lên. Mặc định là `blob-spool` trong thư mục dữ liệu. |
| `HOTLOOP_CASCADE_BLOB_S3_BUCKET`, `_ACCESS_KEY`, `_SECRET_KEY` | Bắt buộc với `s3`. Bí mật cũng đọc `_SECRET_KEY_FILE`. |
| `HOTLOOP_CASCADE_BLOB_S3_ENDPOINT`, `_REGION` | Bỏ endpoint cho AWS. Đặt nó cho Garage, MinIO hoặc Ceph. |
| `HOTLOOP_CASCADE_BLOB_S3_PATH_STYLE` | `true` hoặc `false`. Path style là mặc định mỗi khi endpoint được đặt. |
| `HOTLOOP_CASCADE_BLOB_S3_CA_FILE` | Một gói CA cho endpoint có chứng chỉ riêng. |
| `HOTLOOP_CASCADE_BLOB_S3_PREFIX` | Một thư mục bên trong bucket, để một bucket chứa được nhiều hơn một phiên bản. |
| `HOTLOOP_CASCADE_BLOB_AZURE_CONTAINER` | Bắt buộc với `azure`. |
| `HOTLOOP_CASCADE_BLOB_AZURE_CONNECTION_STRING`, hoặc `_ACCOUNT` với `_KEY`, hoặc `_SAS` | Một cách đăng nhập. Các bí mật cũng đọc dạng `_FILE`. |
| `HOTLOOP_CASCADE_BLOB_AZURE_ENDPOINT`, `_PREFIX` | Một endpoint cho Azurite hoặc đám mây riêng, và một thư mục bên trong container. |

Trên chart, đặt chúng qua `env` và `extraEnv`, với các bí mật lấy từ một Kubernetes Secret.

- **Được định địa chỉ theo nội dung.** Một blob được lưu dưới SHA-256 của nó (`sha256/ab/cdef...`), nên cùng một tệp chỉ được lưu một lần dù có bao nhiêu lần chạy mang nó. Đặt lại nó không làm gì cả, kể cả khi hai lần chạy làm vậy cùng lúc.
- **Được hash trước khi tải lên.** Dữ liệu được đọc một lần vào tệp spool, được hash, rồi mới gửi, nên bộ nhớ giữ phẳng với mọi kích thước. Blob vượt giới hạn kích thước bị từ chối, và một lần tải lên bị hủy không để lại gì trong bucket.
- **Được kiểm tra khi đi ra.** Một lần đọc được đối chiếu với hash của nó khi truyền luồng, nên một đối tượng bị hỏng sẽ thất bại ồn ào thay vì đưa dữ liệu sai cho một lần chạy.
- **Kích thước.** Một lần tải lên đơn được đưa lên dưới dạng truyền multipart trên S3 và theo khối trên Azure, nên giới hạn 5 GiB cho mỗi yêu cầu thường gặp không áp dụng.
- **Dọn blob.** Mỗi giờ một lượt loại bỏ các blob mà không hàng nào trỏ đến: đầu ra của một bước được lưu thành tệp vì quá lớn đối với cơ sở dữ liệu, và các tệp đính kèm mà item mang theo. Một blob được giữ miễn là còn bất kỳ lần chạy bước, đầu ra một phần, phản hồi đã lưu hoặc quy trình nào nêu tên nó, trực tiếp hoặc qua một đầu ra đã lưu có chứa tệp đính kèm, nên một tệp được hai lần chạy có đầu ra giống hệt chia sẻ sẽ còn cho đến khi lần cuối cùng biến mất. Chỉ những blob được ghi lần cuối cách đây hơn 24 giờ mới được xét, và việc đặt các byte đã được lưu sẵn được tính như ghi lại sau giờ đầu tiên, nên một tệp mà một bước vừa lưu và chưa ghi nhận sẽ không bao giờ bị loại bỏ. Một lượt không đọc được đầu ra đã lưu thì không loại bỏ gì. Nó ghi một hàng `blobs.collected` vào nhật ký kiểm toán với số tệp và số byte đã bị loại bỏ. Lượt này giả định kho blob thuộc về một phiên bản (các worker và main của một bản cài đặt dùng chung nó); hai bản cài đặt trỏ đến cùng một bucket hoặc thư mục sẽ mỗi bên loại bỏ tệp của bên kia, nên hãy cho mỗi bản cài đặt một kho riêng (`HOTLOOP_CASCADE_BLOB_S3_PREFIX` có để làm việc này).
- **Đổi kho về sau.** Các blob hiện có ở lại nơi chúng được ghi. Hãy chuyển chúng sang kho mới trước khi chuyển đổi, vì một tham chiếu đến blob mà kho mới không có là một tệp bị thiếu.

Hai backend này được thử nghiệm với Garage và Azurite trong stack kiểm thử, bằng cùng bộ kiểm tra tương thích như kho trên đĩa: ghi và đọc, blob rỗng, khử trùng lặp khi đồng thời, hỏng dữ liệu, giới hạn, id sai, xóa, liệt kê, một lần ghi bị hủy, và một lần tải lên luồng 192 MiB kèm kiểm tra heap.

Điều này có nghĩa với bạn: một main được dựng lại hoặc thay thế tìm thấy mọi tệp mà các lần chạy của nó đã mang theo, mà không cần sao chép.
