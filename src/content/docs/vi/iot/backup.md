---
title: "Sao lưu và khôi phục"
description: "Ảnh chụp logic của cơ sở dữ liệu, bản khôi phục từ chối schema mới hơn, và lý do khóa mật khẩu thiết bị phải được sao lưu riêng."
---

HotLoop chụp các bản sao logic của historian, chỉ dữ liệu bảng, và khôi phục chúng, từ 4.12.0. Mặc định bật, hằng ngày (`HOTLOOP_BACKUP_ENABLED`, `HOTLOOP_BACKUP_INTERVAL` 24h), trong tệp nhị phân và trong Helm chart. Các bản sao lưu nằm dưới `HOTLOOP_BACKUP_DIR`, mặc định là `backups` trong thư mục dữ liệu của HotLoop (`HOTLOOP_DATA_DIR`, nếu không thì `/data` khi ghi được, nếu không thì `~/.local/share/hotloop`): một lần triển khai chưa cấu hình volume sao lưu không nên để tiến trình này lặng lẽ ghi vào hệ thống tệp tạm của container.

## Đây là gì

Một bản sao lưu là một thư mục: một tệp cho mỗi bảng cùng một tệp `manifest.json` nhỏ (phiên bản HotLoop, các migration schema mà cơ sở dữ liệu đã áp dụng, dấu thời gian, và số hàng cùng các cột với kiểu của chúng cho từng bảng).

## Đây không phải là gì

- **Không phải `pg_dump`/`pg_restore`.** Ảnh chạy của Gateway (`gcr.io/distroless/static-debian12:nonroot`) cố ý là một tệp nhị phân tĩnh và không có gì khác: không shell, không trình quản lý gói, không có bất kỳ tệp nhị phân bên ngoài nào. Mọi thứ ở đây đi qua cùng kết nối cơ sở dữ liệu mà ứng dụng đã giữ sẵn.
- **Không phải bản sao lưu schema.** Schema được dựng lại tự động ở mỗi lần khởi động (`HOTLOOP_DB_MIGRATE`, mặc định bật). Bản sao lưu chỉ lấy *dữ liệu* của bảng, và việc khôi phục luôn giả định rằng schema đã được các migration đó dựng lại trước.
- **Không phải khôi phục về một thời điểm bất kỳ.** Ở đây không có lưu trữ WAL và không có sao chép liên tục. Bản sao lưu là ảnh chụp tại thời điểm nó chạy; mọi thứ ghi sau thời điểm đó và trước bản sao lưu kế tiếp không được bao phủ.
- **Không phải lưu trữ ngoài thiết bị.** Thư mục sao lưu (`HOTLOOP_BACKUP_DIR`, dự kiến nằm trên PVC `backup.persistence` mà chart này cấp) vẫn là một ổ duy nhất trong cùng cụm. Đưa các bản sao lưu lên nơi lưu trữ thật sự bền vững, có nhân bản hoặc ngoại tuyến (sao chép ổ vào lưu trữ đối tượng, chụp ảnh PVC, bất cứ thứ gì hạ tầng thực tế của người vận hành cung cấp) là việc của người vận hành, giống như dự án này vốn coi lưu trữ bền vững là trách nhiệm của hạ tầng thay vì thứ mà ứng dụng phải phát minh lại bằng một bộ chuyển đổi sao lưu đa đám mây.

## Bảo vệ các tệp sao lưu

Các tệp sao lưu là dữ liệu nhạy cảm. Tệp `users.copy` chứa mã băm bcrypt của mật khẩu và mã PIN kiosk, còn `sessions.copy` và `write_audit.copy` chứa bản ghi phiên và nhật ký kiểm toán các lần ghi. Các tệp được tạo với chế độ `0640` (và thư mục sao lưu với `0750`), và một tệp đã tồn tại là lỗi chứ không bị ghi đè, nhưng đó chỉ là mức tối thiểu, không thay thế cho việc bảo vệ ổ lưu: hãy để ổ sao lưu trên nơi lưu trữ được mã hóa khi nghỉ, hạn chế ai và cái gì được đọc nó, và áp dụng sự cẩn trọng tương tự cho mọi bản sao ngoài thiết bị mà người vận hành tạo ra.

Tệp `devices.copy` chứa địa chỉ và cấu hình giao thức của từng thiết bị đúng như được lưu, bao gồm cả thông tin xác thực mà các driver dùng để đăng nhập. Chúng đọc được đến mức nào tùy thuộc vào khóa, bên dưới. Từ 4.15.1, API ẩn mọi thông tin xác thực thiết bị khỏi mọi vai trò, kể cả quản trị viên; tệp sao lưu không nằm sau API. Xem [Xác thực và người dùng](/vi/iot/authentication/#nơi-thông-tin-xác-thực-vẫn-ở-dạng-rõ).

## Thông tin xác thực thiết bị và khóa bí mật

Bản sao lưu là tệp bị sao chép sang laptop, thư mục chia sẻ và phiếu hỗ trợ. Vì vậy thông tin xác thực trong đó được mã hóa, bằng một khóa không bao giờ nằm trong cơ sở dữ liệu và không bao giờ nằm trong bản sao lưu.

- **Khi `HOTLOOP_SECRET_KEY_FILE` được đặt** (chart đặt nó, với một khóa tự sinh khi cài đặt và giữ nguyên qua các lần nâng cấp và gỡ cài đặt), mọi thông tin xác thực có khóa (`password` của thiết bị OPC UA, CODESYS, MQTT, HTTP, MTConnect và UniFi, `community` và cụm mật khẩu của thiết bị SNMP, giá trị header HTTP và MTConnect như khóa API, mật khẩu của từng MQTT broker khác mà phần khám phá lắng nghe, và mật khẩu của từng đích historian) được mã hóa trong cơ sở dữ liệu, còn `devices.copy`, `mqtt_sources.copy` và `historian_targets.copy` chứa bản mã. Manifest liệt kê khóa đã dùng để mã hóa là `secretKeyIds`: một id, không bao giờ là khóa.
- **Không có nó**, các thông tin xác thực đó nằm trong cơ sở dữ liệu và trong `devices.copy` ở dạng rõ, và HotLoop nói điều đó trong nhật ký khởi động. Console UniFi, MQTT broker có mật khẩu và đích historian có mật khẩu hoàn toàn không thể lưu nếu thiếu khóa. Hãy đặt một khóa và khởi động lại: mọi thứ đã lưu sẽ được mã hóa ở lần khởi động đó.
- **Thông tin xác thực viết trong URL hoặc văn bản cũng được niêm phong** (`mqtt://user:pass@host`, giá trị truy vấn `?token=` hoặc `?api_key=`, một `body` HTTP có nhắc đến mật khẩu). Địa chỉ hoặc tùy chọn của thiết bị có chứa một thứ như vậy được niêm phong toàn bộ, và các driver nhận lại đúng như đã nhập. URL không có gì bí mật thì được để đọc được. Không có khóa thì chúng cũng ở dạng rõ như phần còn lại, và nhật ký khởi động nói điều đó; có khóa thì mọi thứ đã lưu được niêm phong ở lần khởi động đó. Tùy chọn mật khẩu vẫn là nơi tốt hơn để đặt mật khẩu.

**Khôi phục cần cùng một khóa.** `--restore-from` kiểm tra manifest trước khi nạp bất kỳ hàng nào: bản sao lưu được mã hóa bằng khóa mà HotLoop đang khôi phục không có sẽ bị từ chối, và lỗi nêu tên khóa cần thiết. Hãy khôi phục với tệp khóa đó được gắn vào. Nếu khóa đã mất vĩnh viễn, hãy thêm `--restore-keep-unreadable-credentials`: mọi thứ khác được khôi phục, và mỗi thiết bị có thông tin xác thực không mở được sẽ ở trạng thái ngừng, nói rõ nó cần khóa nào, cho đến khi ai đó nhập lại thông tin xác thực. Bản sao lưu được tạo trước khi có khóa có thể khôi phục ở bất cứ đâu, và thông tin xác thực của nó được mã hóa ngay khi việc khôi phục kết thúc.

**Hãy giữ khóa ở nơi không có bản sao lưu.** Khóa lưu cạnh các bản sao lưu của nó thì không bảo vệ được gì. Với chart, đó là Secret `<release>-secret-key`; hãy sao lưu nó theo cách bạn sao lưu các secret còn lại của cụm, tách riêng.

## Những gì được sao lưu và theo thứ tự nào

Mọi bảng dữ liệu người dùng, theo thứ tự phụ thuộc khóa ngoại (một bảng luôn đứng sau mọi bảng mà khóa ngoại của chính nó trỏ tới):

```
devices → tags → tag_latest → alarm_definitions → alarm_state →
alarm_events → automations → automation_runs → blueprints → scripts → script_runs →
recipes → recipe_versions → recipe_applications → events → write_audit →
settings → users → sessions → user_certificates → energy_meters → energy_meter_state →
energy_buckets → fleet_members → report_definitions →
report_runs → entity_state_log → tag_history
```

(Rút gọn; `backup.Tables` là toàn bộ danh sách, bao gồm các bảng thực thể và thiết bị cùng `entity_last_state`.) `entity_state_log` của nhật ký được phân vùng theo tháng ở cả hai chế độ lịch sử và đứng ngay trước `tag_history`, bảng duy nhất lớn hơn. Việc khôi phục nạp các hàng của nó trước khi bất kỳ phân vùng tháng nào tồn tại, nên chúng rơi vào phân vùng mặc định. Phần bảo trì của nhật ký, khi một Gateway có ghi dữ liệu khởi động, tạo phân vùng của tháng trước và tháng này quanh các hàng thuộc về chúng, và xóa các hàng cũ hơn khỏi phân vùng mặc định khi chúng quá thời hạn lưu giữ, nên thời hạn lưu giữ áp dụng cho mọi hàng được khôi phục. Xem [nhật ký](/vi/iot/logbook/).

Các script quay lại cùng lịch sử của chúng. Một lần chạy mà bản sao lưu bắt gặp giữa chừng quay lại với trạng thái `running`, và lần khởi động đầu tiên của Gateway đánh dấu nó là đã hủy, `interrupted by restart`, giống như một lần chạy bị sự cố cắt ngang: không gì tiếp tục một lần chạy. Xem [Script](/vi/iot/scripts/).

Các công thức quay lại cùng mọi phiên bản và mọi lần áp dụng. Một lần áp dụng mà bản sao lưu bắt gặp giữa chừng quay lại với trạng thái `applying`, và lần khởi động đầu tiên của Gateway đánh dấu nó là `failed`, trỏ tới id lệnh gọi của nó trong kiểm toán ghi: không gì tiếp tục một lần như vậy, và không gì hoàn tác một lần như vậy. Xem [Công thức](/vi/iot/recipes/).

`schema_migrations` được loại trừ có chủ đích: `store.Migrate` dựng lại nó, cùng DDL của mọi bảng, từ các migration được nhúng. Đó là mục duy nhất trong `backup.ExcludedTables`, nơi ghi lại lý do từng bảng bị loại trừ.

Danh sách được duy trì thủ công, và đó là cách một bảng có thể được migration thêm vào rồi lặng lẽ bị bỏ sót khỏi mọi bản sao lưu sau đó. Hai bài kiểm thử ngăn điều này, và cả hai chạy trên cơ sở dữ liệu thật ở cả hai chế độ lưu trữ. Các bảng báo cáo theo lịch (`report_definitions`, `report_runs`) là những bảng đầu tiên được thêm vào dưới các biện pháp bảo vệ này. Các tệp đầu ra của báo cáo nằm trên ổ báo cáo và không thuộc bản sao lưu cơ sở dữ liệu. `tag_history` được nạp cuối cùng khi khôi phục: nó không có khóa ngoại riêng và là bảng lớn nhất với khoảng cách rất xa, nên mọi bảng cấu hình nhỏ đều thất bại sớm, nếu chúng sắp thất bại, trước khi bước dài đó thậm chí bắt đầu.

**`settings` có một ngoại lệ có chủ đích.** Hàng `history_mode` do chính `store.ensureHistorySchema` ghi, một lần duy nhất, vào lúc `Migrate` dựng schema từ con số không: nó ghi lại việc *máy chủ này* đã dựng `tag_history` là hypertable của TimescaleDB hay là bảng phân vùng gốc, là một sự thật về cơ sở dữ liệu mà `Migrate` vừa chạy, không phải về nhà máy. Hàng này bị loại trừ khỏi cả sao lưu lẫn khôi phục của `settings`: khôi phục quyết định lịch sử của một bản cài đặt nguồn lên đích có khả năng khác (hoặc thậm chí lên một lần chạy `Migrate` mới trên cùng loại máy chủ) có thể ghi đè hàng này để mô tả một hình dạng mà đích thực ra không có. `Migrate` của chính đích đã đưa ra quyết định đúng trước khi `Restore` kịp nhìn vào `settings`, và quyết định đó được để nguyên.

## Sao lưu theo yêu cầu

- `POST /api/backup` (`backup.run`, chỉ quản trị viên) tạo một bản sao lưu ngay bây giờ và trả về manifest.
- `GET /api/backup` (`backup.read`, chỉ quản trị viên) liệt kê những gì có trên ổ sao lưu: tên, kích thước trên đĩa, và manifest (danh sách bảng, số hàng, phiên bản HotLoop, dấu thời gian) của từng bản.

Cả hai chỉ dành cho quản trị viên do bị bỏ khỏi vai trò vận hành viên, cùng sự thu hẹp mà `fleet.restart`/`fleet.config`/`notify.test` đã áp dụng cho các hành động vận hành khác, loại "làm ngay" hoặc có phạm vi quản trị. Số hàng trong danh sách sao lưu, gồm cả `users` và `sessions`, giống một chẩn đoán quản trị hơn là các lần đọc ở sàn nhà máy (thiết bị, tag, cảnh báo) mà vai trò vận hành viên được dự kiến xem, nên `backup.read` không được tách thành một quyền thấp hơn như một số lần đọc khác; đó là một nhận định, không phải ràng buộc kỹ thuật, và có thể xem xét lại nếu một quy trình thực tế của vận hành viên cần đến.

## Lập lịch và lưu giữ

`HOTLOOP_BACKUP_INTERVAL` (ví dụ `24h`) chạy sao lưu theo chu kỳ cố định. Cố ý chỉ là một khoảng thời gian đơn giản, không phải bộ phân tích biểu thức cron: nhu cầu thực tế là "thỉnh thoảng sao lưu cái này", và quy ước của dự án này là không xây cho nhu cầu mà chưa ai có. Để trống (hoặc `0`) thì tắt bộ lập lịch; endpoint theo yêu cầu vẫn hoạt động, cho người vận hành hoặc cron bên ngoài muốn tự kích hoạt.

`HOTLOOP_BACKUP_RETAIN` (mặc định `7`) giữ N thư mục sao lưu mới nhất, xóa các thư mục cũ hơn sau mỗi lần sao lưu thành công. `0` hoặc nhỏ hơn thì giữ tất cả, một lựa chọn mà người vận hành phải đưa ra có chủ ý trên một ổ nhỏ.

## Khôi phục một bản sao lưu

**Khôi phục cố ý không phải là một endpoint API.** Tự động hóa "khôi phục ngay" thành một hành động trực tiếp, kích hoạt được qua mạng, trên cơ sở dữ liệu có thể đang phục vụ lưu lượng sản xuất là một nguy cơ thật: một cú nhấp sai, hoặc một phiên quản trị bị xâm phạm, sẽ ghi đè dữ liệu đang chạy, và dự án này không xây điều đó trừ khi được yêu cầu rõ ràng. Khôi phục là một cờ của chính tệp nhị phân, chạy một lần, thủ công, bởi một người vận hành đã quyết định rằng cơ sở dữ liệu đích được dành để nhận nó:

```sh
hotloop --restore-from=/data/backups/20260918T220000Z
```

Điều này làm gì, theo thứ tự:

1. Nạp cấu hình và kết nối tới cơ sở dữ liệu đúng như một lần khởi động thông thường: `store.Open` chạy cùng các migration, dựng schema mà bản khôi phục sắp nạp dữ liệu vào.
2. **Từ chối bản sao lưu mà nó không thể nạp mà không mất gì**: bản được tạo ở schema mới hơn schema của cơ sở dữ liệu này, hoặc bản có bảng hay cột mà phiên bản này không còn. Cả hai đều được kiểm tra trước khi nạp một hàng nào. Xem "Khôi phục lên phiên bản khác" bên dưới.
3. **Từ chối nếu bất kỳ bảng đích nào đã có dữ liệu** ngoài những gì chính `Migrate` vừa gieo (một hàng `history_mode` trong `settings`): khôi phục chỉ chạy trên cơ sở dữ liệu chưa có gì. Đây là bước kiểm tra an toàn: một bảng dù chỉ có một hàng sẵn có cũng dừng toàn bộ việc khôi phục trước khi bất kỳ `COPY FROM STDIN` nào chạy.
4. Nạp từng bảng, theo thứ tự phụ thuộc, trong một giao dịch duy nhất, vào các cột mà manifest nêu tên.
5. Đặt lại sequence của mọi bảng có khóa chính `bigserial` (`tags`, `alarm_events`, `automation_runs`, `events`, `write_audit`, `sessions`) thành một giá trị lớn hơn id cao nhất đã khôi phục: `COPY FROM STDIN` nạp giá trị id tường minh mà không chạm vào sequence, nên bỏ qua bước này sẽ khiến lần chèn thông thường kế tiếp đụng một hàng đã khôi phục.
6. Đếm lại từng bảng và so với số hàng trong manifest, trong cùng giao dịch vẫn đang mở.
7. Chỉ commit nếu mọi con số khớp. Sai lệch, hoặc bất kỳ lỗi nào ở bước trước, sẽ hoàn tác toàn bộ giao dịch, để cơ sở dữ liệu đích trống đúng như lúc tìm thấy, không bao giờ bị nạp dở dang.
8. Thoát. Không có gì khác trong tiến trình khởi động: không bộ lập lịch thăm dò, không engine cảnh báo, không máy chủ API. Việc khôi phục không cần bất kỳ thứ nào trong số đó, và khởi động môi trường chạy trên cơ sở dữ liệu đang khôi phục dở sẽ là một nguy cơ tự thân.

### Chuyển sang PostgreSQL 17

Bản sao lưu này do ứng dụng đang chạy tạo, qua kết nối của nó tới cơ sở dữ liệu đang chạy, nên không thể là bản sao lưu cho bước chuyển từ PostgreSQL 16 sang 17: bước chuyển đó diễn ra trước khi cơ sở dữ liệu khởi động. Sự an toàn của chính bản nâng cấp là nó không bao giờ ghi vào thư mục PostgreSQL 16, mà giữ nguyên vẹn thành `pgdata.pg16` (trang về k3s và Helm, "PostgreSQL 17"). Dù vậy, hãy tạo bản sao lưu này trên bản phát hành cũ trước khi nâng cấp, vì nó là bản sao nằm ngoài thiết bị. Khôi phục nó lên cơ sở dữ liệu mới là phép khôi phục thông thường bên dưới: nó mang theo các hàng, không phải engine, nên không quan tâm phiên bản chính nào đã ghi chúng.

### Khôi phục lên phiên bản khác

Bản phát hành bạn dùng để khôi phục hiếm khi là bản đã tạo ra bản sao lưu. Bản sao lưu được tạo nhiều tháng trước với bản đang chạy lúc đó, còn thiết bị bạn đang dựng lại chạy bản của hôm nay. Vì vậy đây là những gì được khôi phục lên những gì.

**Bản sao lưu cũ lên HotLoop mới hơn: được.** Đây là trường hợp quan trọng, và nó đã được thử từ mọi mức schema từng có, từ `0001_core` đến nay, trên TimescaleDB và trên PostgreSQL thường, rồi khởi động ứng dụng sau đó.

- Mỗi manifest ghi lại các cột của từng bảng, tên và kiểu. Việc khôi phục nạp từng tệp vào đúng những cột đó, theo tên. Cột được thêm sau bản sao lưu nhận giá trị mặc định. `entity_id`, `service` và `call_id` của `write_audit` trở lại trống ở mọi hàng kiểm toán trước các dịch vụ thực thể, đúng là những gì các hàng đó vốn có: các lần ghi tag thuần túy.
- Bảng được thêm sau bản sao lưu vẫn trống, và ứng dụng điền những gì nó có thể khi khởi động. Lần đồng bộ đầu tiên của sổ đăng ký thực thể cấp cho mỗi tag đã khôi phục thực thể đọc của nó, cho mỗi tag đã vũ trang thực thể điều khiển của nó và cho mỗi định nghĩa cảnh báo thực thể cảnh báo của nó, với những cái tên mà sổ đăng ký sẽ đặt. Các thiết bị từ bản sao lưu cũ hơn cây thiết bị được đặt vào cây theo văn bản địa điểm, khu vực và dây chuyền của chúng ngay trong lúc khôi phục, giống cách bản nâng cấp đã đặt chúng. Những gì chưa từng có trong bản sao lưu thì không thể quay lại: nhãn, thực thể tổng hợp, và tên thực thể mà người vận hành đã tùy chỉnh sau khi bản sao lưu được tạo.

**Bản sao lưu mới hơn lên HotLoop cũ hơn: không, bị từ chối.** Manifest ghi lại mọi migration mà cơ sở dữ liệu của bản sao lưu đã áp dụng. Nếu có migration mà cơ sở dữ liệu này chưa từng chạy, việc khôi phục dừng trước khi nạp một hàng và nói rõ điều đó:

```
refusing to restore: this backup was taken by HotLoop <its version> with the
database schema at <its newest migration>, which is newer than this database's
schema at <this database's newest migration> (HotLoop <this version>). ...
Restore it with HotLoop <its version> or a later release
```

"Mới hơn" nghĩa là migration, không phải chuỗi phiên bản. Chuỗi phiên bản cho biết tệp nhị phân nào đã tạo bản sao lưu, và các bản dựng dev, bản phát hành ứng viên và nhánh hotfix khiến việc so sánh chúng chỉ là đoán. Các migration cho biết schema thực sự là gì, và chúng được so sánh như một tập hợp, nên migration bị thiếu được bắt ở bất cứ vị trí nào trong thứ tự. Các phiên bản có trong thông báo vì phiên bản là thứ bạn có thể hành động dựa vào: khôi phục bằng bản phát hành nào.

**Bản sao lưu có cột mà phiên bản này không còn: bị từ chối, nêu rõ tên.** Ngày migration xóa, đổi tên hoặc đổi kiểu một cột, bản sao lưu từ trước đó có dữ liệu mà bảng mới không có chỗ chứa. Việc khôi phục không đoán. Nó nêu tên mọi cột như vậy, trên mọi bảng, trước khi nạp bất cứ thứ gì:

- cột mà bảng đang chạy không có sẽ bị từ chối, trừ khi `backup.columnRenames` ánh xạ nó sang tên mới. Migration đổi tên một cột sẽ thêm mục đó, và một bài kiểm thử khôi phục bản sao lưu từ trước nó, trong cùng thay đổi. Hiện nay chưa có lần đổi tên nào, nên bản đồ trống;
- cột có kiểu thay đổi sẽ bị từ chối. COPY nhị phân không mang kiểu, nên các byte sẽ bị đọc như kiểu mới hoặc bị từ chối giữa chừng;
- cột mà bảng đang chạy đã thêm là `NOT NULL` mà không có giá trị mặc định sẽ bị từ chối, vì không gì có thể điền vào nó.

Lối thoát giống nhau cho cả ba: khôi phục bằng bản phát hành đã tạo bản sao lưu, rồi nâng cấp cơ sở dữ liệu đó tại chỗ, đó là cách migration được thiết kế để gặp dữ liệu ấy.

Nạp theo tên cũng bao phủ thay đổi mà không ai để ý: một cột bị xóa rồi thêm lại, hoặc một bảng được dựng lại, khiến các cột nằm theo thứ tự khác. Nạp theo vị trí sẽ đặt giá trị của cột này vào cột khác mà không báo lỗi mỗi khi các kiểu khớp nhau. Theo tên thì mỗi cột vào đúng chỗ của nó.

**Các bản sao lưu được tạo trước khi manifest ghi lại bất cứ điều gì trong số này** (mọi bản sao lưu tạo trước bản phát hành này) không có danh sách cột và không có schema. Chúng vẫn khôi phục được:

- Không có danh sách cột, việc khôi phục quay về theo vị trí. Tệp có ít cột hơn bảng được nạp vào các cột đầu của bảng, còn lại nhận giá trị mặc định. Điều đó đúng với mọi schema cho đến nay, vì mọi migration đến giờ chỉ thêm cột, và `ALTER TABLE ADD COLUMN` luôn thêm vào cuối. Tệp có nhiều cột hơn bảng bị chính PostgreSQL từ chối.
- Không có schema, việc khôi phục giả định bản sao lưu mới nhất có thể: `0007_service_audit.sql`, migration mới nhất vào lúc các manifest bắt đầu ghi lại nó. Giả định đó chỉ có thể từ chối một lần khôi phục lẽ ra chạy được, không bao giờ cho qua một lần không chạy được. Trên thực tế nó không từ chối gì cả, vì mọi HotLoop có bước kiểm tra này đã chạy mọi migration cho đến migration đó.

Bản sao lưu đầu tiên mà bản phát hành này tạo ghi lại mọi thứ, nên phương án dự phòng chỉ quan trọng với các bản sao lưu đã nằm sẵn trên ổ sao lưu.

### Quy trình khôi phục, từng bước

1. Đưa thư mục sao lưu lên máy hoặc ổ mà tệp nhị phân `hotloop` của triển khai đích đọc được: đây là chỗ bản sao ngoài thiết bị của ổ sao lưu mà người vận hành tự tạo quay lại phát huy tác dụng.
2. Trỏ `HOTLOOP_DB_*` tới cơ sở dữ liệu **đích**. Nó phải truy cập được và chưa có dữ liệu ở bất kỳ bảng nào được sao lưu (cơ sở dữ liệu mới tinh, trống là trường hợp bình thường; schema sẽ được dựng ở bước 3).
3. Chạy `hotloop --restore-from=<path to the backup directory>`.
4. Đọc dòng nhật ký cuối: `restore complete` cùng số bảng và số hàng, hoặc một lỗi giải thích chính xác điều gì bị từ chối và vì sao.
5. Khởi động `hotloop` bình thường trên cùng cơ sở dữ liệu đó.

## Chuyển giữa các cơ sở dữ liệu

Bản sao lưu là một thứ giống nhau dù cơ sở dữ liệu nào tạo ra nó: các tệp COPY nhị phân của PostgreSQL và một manifest nêu kiểu Postgres của từng cột. Vì vậy chuyển một nhà máy từ cơ sở dữ liệu này sang cơ sở dữ liệu khác là một bản sao lưu trên cái cũ và một lần khôi phục vào cái mới. Không có gì khác.

- **SQLite sang Postgres hoặc TimescaleDB.** Chiếc Pi đã vượt quá cái tệp của nó. Tạo bản sao lưu, trỏ `HOTLOOP_DB_*` tới máy chủ mới (`HOTLOOP_DB_TYPE=postgres`), khôi phục. Trên máy chủ TimescaleDB, lịch sử rơi vào một hypertable.
- **Postgres hoặc TimescaleDB sang SQLite.** Nhà máy thu nhỏ xuống một thiết bị nhỏ. Làm ngược lại tương tự, với `HOTLOOP_DB_TYPE=sqlite`.
- **Postgres thường sang TimescaleDB, và ngược lại.** Chế độ lịch sử là cố định, nên trỏ một Gateway tới Postgres thường của một thiết bị IoT sẽ giữ nguyên các phân vùng. Để có hypertable, hãy khôi phục vào một TimescaleDB mới. Theo chiều ngược lại bạn nhận được các phân vùng.

Những gì được kiểm tra khi nạp vào là những gì được kiểm tra với mọi lần khôi phục: từng cột theo tên và kiểu so với đích, với các cột của SQLite được đọc như kiểu Postgres của chúng, nên bản sao lưu từ bên này được khôi phục vào bên kia hoặc bị từ chối vì cùng lý do như ở bất cứ đâu. `history_mode` không bao giờ được sao chép: đích giữ những gì các migration của chính nó đã quyết định. Các sequence ra đúng ở cả hai: trên Postgres `fixSequences` dời chúng, còn AUTOINCREMENT của SQLite tự dời qua mọi id được khôi phục vào nó.

## Cấu hình

| Biến | Mặc định | <span class="sr-only">Details</span> |
|---|---|---|
| `HOTLOOP_BACKUP_ENABLED` | `false` | Tính năng tắt, kể cả các route API, cho đến khi đặt biến này |
| `HOTLOOP_BACKUP_DIR` | `/data/backups` | Nơi ghi các bản sao lưu; dự kiến là một PVC (`backup.persistence` trong chart) |
| `HOTLOOP_BACKUP_RETAIN` | `7` | Giữ N bản sao lưu mới nhất; `0` hoặc nhỏ hơn thì giữ tất cả |
| `HOTLOOP_BACKUP_INTERVAL` | chưa đặt | ví dụ `24h`; chưa đặt nghĩa là chỉ theo yêu cầu |

`--restore-from=<dir>` là cờ dòng lệnh của tệp nhị phân `hotloop`, không phải biến môi trường, xem "Khôi phục một bản sao lưu" ở trên.

## Những gì đã và chưa được kiểm chứng

HotLoop đã được chạy trên thiết bị thật và máy chủ thật, và trên bare metal vào 2026-11-17.
