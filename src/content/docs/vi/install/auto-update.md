---
title: "Tự động cập nhật :stable"
description: "Mọi thiết bị theo thẻ stable. Cập nhật làm gì, hoàn tác không khôi phục được gì, và cách giữ cập nhật lại cho đến khi bạn đồng ý."
---

Mọi thiết bị đều theo `:stable` và Podman cập nhật nó. Đó là quy tắc cho cả bốn sản phẩm, và vì vậy không đơn vị nào ở đây ghim số phiên bản: một thiết bị bị ghim ở `4.17.0` cũ đúng bằng ngày có người cài nó, và không ai quay lại nhà máy chỉ để đổi một thẻ. Mọi thẻ phát hành đều di chuyển `:stable`, và bản phát hành có các đơn vị không theo nó sẽ bị từ chối.

Bật bộ hẹn giờ một lần cho mỗi thiết bị:

```sh
sudo systemctl enable --now podman-auto-update.timer
```

## Một lần cập nhật làm gì

Podman kéo `:stable` khi bộ hẹn giờ kích hoạt, và nếu digest đã đổi, nó khởi động lại đơn vị của ứng dụng bằng ảnh mới. Chỉ đơn vị của ứng dụng: container cơ sở dữ liệu không bị đụng đến, nên cập nhật không làm gián đoạn historian. Đơn vị có một kiểm tra tình trạng không cần shell (ảnh không có shell): `hotloop healthcheck` hỏi chính `/readyz` của ứng dụng, chỉ trả lời khi cơ sở dữ liệu còn trả lời. Đơn vị ở trạng thái "activating" cho đến khi kiểm tra đạt, nhờ đó Podman phân biệt được bản cập nhật đã chạy lại với bản không chạy lại, và nếu ảnh mới không bao giờ chạy lên, nó đặt ảnh trước đó trở lại dưới `:stable` và khởi động nó.

Khi khởi động ảnh mới, các migration của nó chạy trước, trên cơ sở dữ liệu đã có, và cơ sở dữ liệu lớn sẽ mất thời gian. Đơn vị cho ứng dụng 15 phút để trả lời trước khi coi bản cập nhật là thất bại, và các lỗi trong năm phút đầu không được tính, vì một migration không phải là lỗi.

Hai điều được phát hiện bằng cách chạy thử, không phải bằng cách đọc, và các đơn vị mang bản sửa cho từng điều. Một chuỗi `HealthCmd` thường được chạy qua `/bin/sh -c`, mà ảnh không có shell, nên kiểm tra không bao giờ đạt được: nó là một mảng JSON. Và các bản Quadlet cũ đọc `Notify=healthy` như `true` thường và truyền `--sdnotify=conmon`, tức coi ứng dụng đã chạy ngay khi container khởi động: một bản cập nhật không thể khởi động lại bị báo là thành công và không có gì được hoàn tác. Các đơn vị tự khai báo `--sdnotify=healthy`.

## Vì sao không có pod

Ứng dụng và cơ sở dữ liệu từng dùng chung một pod. Điều đó làm mất khả năng hoàn tác, và được phát hiện bằng cách chạy thử, không phải đọc sách hướng dẫn. Với container nằm trong pod, tự động cập nhật của Podman khởi động lại đơn vị **của pod**, và đơn vị của pod vẫn chạy bình thường dù ứng dụng bên trong gặp sự cố gì. Một bản phát hành không thể khởi động bị báo là `UPDATED true`, ứng dụng rơi vào vòng lặp sập (hai mươi lần khởi động lại trong vài phút đầu), và `:stable` trên thiết bị là ảnh hỏng. Nó cũng khởi động lại cơ sở dữ liệu ở mỗi lần cập nhật ứng dụng. Khi dùng mạng thay thế, ứng dụng là một đơn vị riêng, Podman khởi động lại đơn vị đó, và đơn vị ở trạng thái "activating" cho đến khi ứng dụng trả lời `/readyz`: cùng bản phát hành ấy quay lại với kết quả `UPDATED rolled back`.

## Hoàn tác không thể khôi phục gì

Một migration. Khi một bản phát hành migrate cơ sở dữ liệu rồi không đạt kiểm tra tình trạng, Podman đặt lại bản phát hành trước, và nó khởi động trên lược đồ mà bản thất bại để lại. Điều này an toàn, và được giữ an toàn theo ba cách ([Migration chỉ thêm vào](/vi/iot/migrations/) có chi tiết):

- **Migration chỉ thêm vào.** Một bảng, một cột có giá trị mặc định, một chỉ mục. Không bao giờ xóa, đổi tên hay đổi kiểu, nên bản phát hành trước tìm thấy mọi thứ nó biết ở đúng chỗ và không bao giờ nhìn vào phần được thêm.
- **Ứng dụng từ chối lược đồ mà nó không thể tin cậy.** Cơ sở dữ liệu ghi lại bản phát hành nào đã áp dụng từng migration. Một bản đã hoàn tác chỉ chậm một bước thì khởi động và ghi điều đó vào nhật ký. Một bản chậm hai bản phát hành trở lên thì không khởi động và nêu lý do, kèm tên cả hai phiên bản. Đây là trường hợp thiết bị thất bại một lần cập nhật, hoàn tác, thất bại lần nữa, và cơ sở dữ liệu giờ đã tiến hai lần. Ứng dụng thoát ngay với thông báo trong `journalctl -u hotloop`, còn `Restart=always` của đơn vị cứ thử lại và cứ bị từ chối. Cách sửa là một bản phát hành biết lược đồ: bản mới nhất, chính là thứ `:stable` trỏ tới (`sudo podman auto-update`, hoặc kéo nó về rồi khởi động lại). Hoặc khôi phục bản sao lưu do bản phát hành bạn đang chạy tạo ra ([Sao lưu và khôi phục](/vi/iot/backup/)).

Vì vậy hoàn tác không còn lời lưu ý nào trong ghi chú phát hành. Thứ nó vẫn không thể khôi phục là dữ liệu: bản phát hành thất bại có thể đã ghi các dòng mà bản cũ bỏ qua. Hãy sao lưu trước khi bật cập nhật; đó là thứ duy nhất nằm giữa một bản phát hành lỗi và việc khôi phục.

## Vì sao cơ sở dữ liệu không theo `:stable`

Ứng dụng được gắn nhãn tự động cập nhật. Container cơ sở dữ liệu thì không, và `Image=` của nó là một thẻ chính xác. Lý do là cập nhật của ứng dụng có thể hoàn tác, còn của cơ sở dữ liệu thì không.

- Một **phiên bản chính của PostgreSQL** (16 lên 17) không phải là một lần khởi động lại. Chính sách đánh số phiên bản của PostgreSQL nói rằng thư mục dữ liệu không thể giữ tương thích ngược giữa các phiên bản chính, và cần dump rồi nạp lại, hoặc `pg_upgrade` ([postgresql.org/support/versioning](https://www.postgresql.org/support/versioning/)). Một thẻ trôi qua các phiên bản chính sẽ làm điều đó với historian của một nhà máy trong một lần khởi động lại không liên quan. Ghim phiên bản chính là mức tối thiểu, và không phải là "ghim endpoint" theo nghĩa của quy tắc ở trên. Bước chuyển duy nhất HotLoop đã làm, 16 lên 17, là `hotloop-db-upgrade.container`, chạy có chủ đích khi bạn sao chép các đơn vị mới.
- Một **bản phát hành phụ** (16.14 lên 16.15) không cần dump và khôi phục. Cùng trang đó nói thêm rằng một số bản "có thể cần thêm các bước, nên luôn đọc ghi chú phát hành trước". Một thiết bị không người trông coi không đọc ghi chú phát hành.
- **TimescaleDB** (Gateway và Edge) là nửa còn lại. Ứng dụng tự chạy `ALTER EXTENSION timescaledb UPDATE` khi khởi động sau một ảnh mới hơn, và cập nhật extension là thay đổi một chiều đối với cơ sở dữ liệu: đặt lại ảnh cũ sau đó không hoàn tác được. Một thẻ Timescale trôi nổi sẽ khiến bản cập nhật có thể hoàn tác của ứng dụng kéo theo một bản không thể hoàn tác.
- Một ảnh cơ sở dữ liệu mới chạy lên được chưa chắc là ảnh khỏe mạnh. Kiểm tra tình trạng chỉ phân biệt được container không khởi động với container khởi động, chỉ vậy thôi. Historian có vượt qua việc nâng cấp engine hay không thì `pg_isready` không trả lời được.

Vì thế thẻ cơ sở dữ liệu di chuyển cùng một bản phát hành HotLoop đã được kiểm thử với nó. `release_guard.sh` giữ mỗi `hotloop-db.container` bằng cơ sở dữ liệu của chart tương ứng, để thiết bị Quadlet và bản cài bằng chart của cùng một sản phẩm chạy cùng một thứ, và từ chối `AutoUpdate=` trên nó. Cái giá là các bản vá của chính PostgreSQL đến thiết bị khi một bản phát hành mang chúng theo, hoặc khi bạn đổi thẻ bằng tay. Trong cùng phiên bản chính, đó là sửa `hotloop-db.container`, chạy `daemon-reload` và khởi động lại pod, sau khi đọc ghi chú phát hành và sao lưu. Phiên bản chính là `pg_upgrade`, mà HotLoop chạy cho 16 lên 17, còn với mọi trường hợp khác thì bạn tự chạy, hoặc khôi phục vào đó.

## Giữ cập nhật lại cho đến khi bạn đồng ý

Mặc định là không giữ: cập nhật diễn ra khi bộ hẹn giờ kích hoạt. Một cơ sở muốn để con người quyết định có hai cách, và cả hai đều không cần ứng dụng truy cập được.

- **Giữ lại.** Để `podman-auto-update.timer` tắt. Không có gì được cập nhật. Khi sẵn sàng, chạy `sudo podman auto-update`: đó là sự phê duyệt, với cùng kiểm tra tình trạng và cùng hoàn tác. Podman cập nhật mọi container có nhãn trên máy khi chạy, không chỉ những container này, và không thể bảo nó bỏ qua một cái, nên một thiết bị phải chạy bộ hẹn giờ cho các container khác thì không thể đồng thời giữ những container này.
- **Một khung giờ.** `update-window.conf` là tệp bổ sung cho bộ hẹn giờ, cho biết khi nào nó được phép kích hoạt, chẳng hạn Chủ nhật lúc 03:00, thay cho mặc định là mỗi ngày lúc nửa đêm:

  ```sh
  sudo mkdir -p /etc/systemd/system/podman-auto-update.timer.d
  sudo cp update-window.conf /etc/systemd/system/podman-auto-update.timer.d/
  sudo systemctl daemon-reload && sudo systemctl restart podman-auto-update.timer
  ```

Edge Relay khác ở một điểm: một Gateway có thể phê duyệt bản cập nhật của relay từ màn hình đội thiết bị, vì relay vốn đã lắng nghe lệnh từ Gateway mà nó chuyển tiếp tới. IoT, Edge và Gateway không có kênh như vậy để tiếp cận, và xây dựng một kênh sẽ đặt nút "khởi động lại thiết bị này" lên giao diện web cho một tính năng mà `sudo podman auto-update` đã là. Xem [tài liệu tham chiếu Edge Relay](/vi/edge-relay/reference/#updating-a-relay) về việc giữ cập nhật của relay, và `edge-relay-hold.conf`.

## Gateway nhìn thấy gì

`GET /api/status` trên bất kỳ sản phẩm nào trong ba sản phẩm cho biết `version`, và `imageDigest` khi đơn vị đã báo (nó báo, trước mỗi lần khởi động). Một Edge hoặc Gateway đã bật xuất bản Edge là một nút Sparkplug như relay, và đưa cùng hai giá trị đó vào mỗi birth, nên Gateway có nó trong danh sách đội thiết bị sẽ hiện phiên bản và digest và ghi lại thay đổi khi một lần tự động cập nhật di chuyển nó ([Quản lý đội thiết bị](/vi/gateway/fleet/)). IoT không có upstream, nên digest của nó nằm trên `/api/status` của chính nó và không ở đâu khác.

## Với Helm

Một pod không thể tự thay thế mình, nên không có cập nhật không giám sát cho các chart: `helm upgrade` là bản cập nhật, và `image.tag` của chart mặc định là `appVersion` của nó, chính là bản phát hành.
