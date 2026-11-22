---
title: "Podman Quadlet trên Pi"
description: "Chạy HotLoop như các dịch vụ systemd thật trên Pi hoặc PC công nghiệp nhỏ bằng Podman Quadlet, không cần Docker, không Compose và không cần cụm."
---

Dành cho Pi hoặc PC công nghiệp nhỏ **không** thuộc một cụm k3s. Nếu thuộc, hãy dùng chart của sản phẩm. Thư mục này và các chart là hai cách được hỗ trợ để chạy HotLoop.

Không Docker, và không có `podman run` lẻ loi từ một shell chết cùng phiên. Quadlet biến các container thành dịch vụ systemd thật: khởi động cùng máy mà không cần người dùng đăng nhập, tự khởi động lại khi lỗi và ghi log vào journald.

| Thư mục | Sản phẩm | Image |
|---|---|---|
| `iot/` | HotLoop IoT, kèm PostgreSQL 17 | `ghcr.io/hotloop-io/hotloop-iot` |
| `edge/` | HotLoop Edge, kèm TimescaleDB | `ghcr.io/hotloop-io/hotloop-edge` |
| `gateway/` | HotLoop Gateway, kèm TimescaleDB | `ghcr.io/hotloop-io/hotloop` |
| thư mục này | HotLoop Edge Relay, không có cơ sở dữ liệu | `ghcr.io/hotloop-io/hotloop-edge-relay` |

[Trang sản phẩm](/vi/products/) cho biết bạn cần loại nào.

Mỗi sản phẩm trong ba sản phẩm đầu còn có thư mục `sqlite/`: cùng sản phẩm đó với cơ sở dữ liệu là một tệp và không có container cơ sở dữ liệu. Xem [SQLite thay cho PostgreSQL](#sqlite-thay-cho-postgresql).

## IoT, Edge và Gateway

Mỗi thư mục có cùng các unit và một script:

- **`hotloop.network`**: mạng mà ứng dụng và cơ sở dữ liệu của nó dùng chung. Ứng dụng tới được cơ sở dữ liệu bằng tên (`hotloop-db:5432`) và không thứ gì khác trên máy làm được, vì cơ sở dữ liệu không công bố cổng nào. Chỉ cổng 8080 của ứng dụng được công bố.
- **`hotloop.container`**: ứng dụng. Phần đầu tệp có các bước cài đặt; hãy đọc nó trước khi sao chép bất cứ thứ gì.
- **`hotloop-db.container`**: cơ sở dữ liệu, cùng image và phiên bản mà chart của sản phẩm đó chạy. Nó báo đã khởi động khi bắt đầu trả lời, nên ứng dụng chờ một cơ sở dữ liệu dùng được.
- **`hotloop-db-upgrade.container`** và **`hotloop-db-upgrade.sh`**: bước chuyển cơ sở dữ liệu từ PostgreSQL 16 lên 17, chỉ một lần. Nó chạy trước unit cơ sở dữ liệu và chỉ khi volume còn dữ liệu 16; với volume mới, hoặc volume đã ở 17, systemd bỏ qua. Xem [PostgreSQL 16 lên 17](#postgresql-16-lên-17).
- **`hotloop-db.volume`** và **`hotloop-data.volume`**: cơ sở dữ liệu, và mọi thứ ứng dụng ghi dưới `/data` (bản sao lưu, chứng chỉ, hàng đợi chuyển tiếp, báo cáo). Là các volume Podman có tên, nên `podman system prune` không đụng tới.

Ba secret của Podman giữ những gì không nên nằm trong tệp: `hotloop-db-password`, `hotloop-secret-key` (mã hóa mật khẩu thiết bị trong cơ sở dữ liệu; hãy giữ một bản sao ngoài máy) và `hotloop-admin-password-hash` (mã băm bcrypt của mật khẩu quản trị viên đầu tiên, không bao giờ là chính mật khẩu).

**Podman 5.0 trở lên.** Raspberry Pi OS Bookworm đi kèm Podman 4.3, bản hoàn toàn không có Quadlet: hãy dùng Raspberry Pi OS Trixie (Podman 5.4) trở lên. Các bản cập nhật bên dưới đã chạy trên Podman 6.1.3; unit của Edge Relay, dùng cùng các khóa, chạy trên 4.9.3. Và hãy đặt volume cơ sở dữ liệu trên SSD USB, không phải thẻ SD. Lịch sử ghi suốt ngày, và thẻ SD chết chính vì điều đó.

### Vì sao mọi sản phẩm dùng cùng tên

Tên unit, tên volume và tên secret giống hệt nhau trong `iot/`, `edge/` và `gateway/`, có chủ ý. Nâng một máy lên sản phẩm lớn hơn là sao chép `hotloop.container` và `hotloop-db.container` của sản phẩm lớn hơn đè lên của bạn:

```sh
sudo cp gateway/hotloop.container gateway/hotloop-db.container \
  gateway/hotloop-db-upgrade.container gateway/hotloop-db-upgrade.sh /etc/containers/systemd/
sudo systemctl daemon-reload
sudo systemctl restart hotloop.service hotloop-db.service
```

Volume và secret vẫn còn, cùng với mọi thiết bị, tag, cảnh báo, người dùng và từng giờ lịch sử. Dù vậy, hãy sao lưu trước (`POST /api/backup`). Bước chuyển đó đã được chạy, từ IoT lên Edge rồi lên Gateway trên cùng một bộ volume. Hạ xuống sản phẩm nhỏ hơn không phải việc nên làm trên một máy bạn quan tâm.

Điều đó cũng có nghĩa là một HotLoop trên mỗi máy. Hai cái vốn cũng sẽ tranh nhau cổng 8080.

### Đã kiểm chứng

Các tệp IoT, Edge và Gateway được giao, giữ nguyên, được tạo bằng trình tạo `quadlet` của Podman 6.1.3 với cùng cấu trúc: ứng dụng cần cơ sở dữ liệu và mạng, công bố cổng của riêng nó và mang nhãn tự động cập nhật, còn cơ sở dữ liệu không mang nhãn nào và không công bố gì.

Sau đó các unit của Gateway được chạy thật: không cần root, dưới systemd, với một registry cục bộ thay cho ghcr.io và `podman auto-update` của chính các sản phẩm. Lần khởi động đầu với cơ sở dữ liệu khỏe và ứng dụng khỏe sau nó; một bản cập nhật lên bản phát hành thêm migration vào bảng mà ứng dụng đã dùng, thực hiện với thiết bị hiện có và dữ liệu của nó nguyên vẹn và container cơ sở dữ liệu không bao giờ khởi động lại; và một bản cập nhật lên bản phát hành migrate cơ sở dữ liệu rồi không thể khởi động, mà Podman đã quay lại, với bản trước khởi động khỏe trên cơ sở dữ liệu mà bản lỗi đã migrate. Edge và IoT chạy trên cùng các unit, và đã được chạy dưới systemd trên một Pi thật, trên phần cứng thật (2026-11-17).

## PostgreSQL 16 lên 17

Cơ sở dữ liệu của HotLoop là PostgreSQL 17 từ bản phát hành này. Một máy từng chạy bản cũ có dữ liệu PostgreSQL 16, mà PostgreSQL 17 sẽ không mở, nên bước chuyển là một unit chạy trước cơ sở dữ liệu. Đặt các tệp mới vào đúng chỗ và khởi động lại cơ sở dữ liệu, thế là xong:

```sh
sudo cp hotloop-db.container hotloop-db-upgrade.container hotloop-db-upgrade.sh \
  /etc/containers/systemd/
sudo systemctl daemon-reload
sudo systemctl restart hotloop-db.service
journalctl -u hotloop-db-upgrade.service      # what it did
```

`hotloop-db.container` yêu cầu unit nâng cấp, nên một máy chỉ sao chép unit cơ sở dữ liệu mới sẽ không khởi động trên dữ liệu 16 và journal nói rõ lý do. Unit nâng cấp chạy `pg_upgrade` ở chế độ sao chép vào một thư mục mới bên cạnh thư mục cũ, khởi động máy chủ mới một lần để chứng minh nó mở được, và chỉ sau đó mới hoán đổi tên; dữ liệu cũ vẫn nằm trên volume với tên `pgdata.pg16`. Nó chỉ tải image PostgreSQL 16 khi volume cần. Nếu lỗi, dữ liệu 16 giữ nguyên như cũ và cơ sở dữ liệu không khởi động. Mô tả đầy đủ, đường quay lại và cách xóa `pgdata.pg16` nằm ở [k3s và Helm](/vi/install/helm/#postgresql-17). Với cài đặt không cần root, đường dẫn script trong unit là `~/.config/containers/systemd`, từ `%E`.

## SQLite thay cho PostgreSQL

Cơ sở dữ liệu là một thiết lập, không phải một image (trang k3s và Helm, "SQLite"). Với Quadlet, điều đó nghĩa là bộ tệp thứ hai, không phải image thứ hai. Thư mục `sqlite/` của mỗi sản phẩm có hai tệp:

- **`sqlite/hotloop.container`**: chỉ có ứng dụng. Không có `Requires=` tới cơ sở dữ liệu, không có mạng, không có mật khẩu cơ sở dữ liệu, và dùng `HOTLOOP_DB_TYPE=sqlite` với tệp ở `HOTLOOP_DB_PATH=/data/hotloop.db`. Nó theo `:stable` và hoàn tác bản cập nhật lỗi đúng như unit PostgreSQL: cùng kiểm tra sức khỏe, cùng `--sdnotify=healthy`.
- **`sqlite/hotloop-data.volume`**: volume `hotloop-data`, nơi chứa tệp cơ sở dữ liệu cùng `-wal` và `-shm`. Cùng tên volume với các tệp PostgreSQL, nên là cùng volume dữ liệu nếu bạn từng chuyển đổi.

| Thư mục | Cài đặt | Secret |
|---|---|---|
| `iot/`, `edge/`, `gateway/` | `hotloop.network`, `hotloop.container`, `hotloop-db.container`, `hotloop-db.volume`, `hotloop-data.volume` | ba |
| `iot/sqlite/`, `edge/sqlite/`, `gateway/sqlite/` | `hotloop.container`, `hotloop-data.volume` | hai: `hotloop-secret-key` và `hotloop-admin-password-hash` |

Cài một bộ hoặc bộ kia, không bao giờ cả hai: chúng dùng cùng tên unit. Phần đầu của `sqlite/hotloop.container` có các bước chính xác. Tóm lại:

```sh
cd iot/sqlite        # or edge/sqlite, gateway/sqlite
sudo cp hotloop.container hotloop-data.volume /etc/containers/systemd/
# make hotloop-secret-key and hotloop-admin-password-hash as the header says
sudo systemctl daemon-reload
sudo systemctl start hotloop.service
curl -s localhost:8080/api/status
```

Vài điều cần biết trước khi chọn. SQLite là một bộ ghi trên một đĩa cục bộ: Pi đặt volume trên SSD USB, và lưu trữ mạng không phải lựa chọn vì SQLite bị hỏng trên đó. Lịch sử là một bảng với một chỉ mục, không có phân vùng hay hypertable, nên một nhà máy có nhiều năm lịch sử mỗi giây cần các tệp PostgreSQL. Và chuyển một máy giữa SQLite và PostgreSQL là sao lưu rồi khôi phục ([Sao lưu và khôi phục](/vi/iot/backup/)), không phải hoán đổi unit: cơ sở dữ liệu mới bắt đầu trống. Đừng sao chép `sqlite/hotloop.container` đè lên một bản cài PostgreSQL đang chạy để "chuyển đổi"; nó không đọc dữ liệu của volume PostgreSQL.

PostgreSQL thuần trên Edge hoặc Gateway là unit TimescaleDB với `Environment=HOTLOOP_HISTORIAN_TIMESCALE=false` được thêm vào `hotloop.container`. Unit của IoT đã là PostgreSQL thuần, và IoT hoàn toàn không có unit TimescaleDB.

### Đã kiểm chứng (SQLite)

`iot/sqlite/hotloop.container` và volume của nó đã được chạy không cần root trên Podman 4.9.3 dưới systemd (`systemctl --user`) từ các tệp đã commit, chỉ đổi tên, cổng, image (dựng từ cùng cây mã) và thư mục runtime mà trình quản lý người dùng cần. Unit lên khỏe, `/healthz` và `/readyz` trả 200, quản trị viên đăng nhập từ secret băm, `/api/status` trả lời, `hotloop.db`, `hotloop.db-wal` và `hotloop.db-shm` xuất hiện trên volume, và một lần khởi động lại không áp dụng migration nào và đăng nhập quản trị viên lại. Các unit `sqlite/` của Edge và Gateway là cùng một tệp ngoài image và giá trị lưu giữ mặc định, và đã được chạy dưới systemd với quyền root trên một Pi thật, trên phần cứng thật (2026-11-17).

## Edge Relay

- **`edge-relay-hold.conf`**: tùy chọn: giữ các bản cập nhật image cho đến khi người vận hành chấp thuận. Một drop-in của systemd, không thuộc bản cài mặc định.
- **`edge-relay.container`**, chính dịch vụ. Các bước cài đặt đầy đủ nằm trong chú thích ở phần đầu của nó; hãy đọc trước khi sao chép bất cứ thứ gì.
- **`edge-relay-data.volume`**, một volume Podman có tên cho hàng đợi chuyển tiếp, để các số đọc đang đệm sống sót qua lần khởi động lại container. Podman tự tạo nó lần đầu dịch vụ khởi động.
- **`devices.example.json`**, điểm khởi đầu cho tệp thiết bị. Sao chép nó tới `/etc/edge-relay/devices.json` và sửa cho các thiết bị thực tế tại nhà máy này; định dạng đầy đủ nằm trong [tài liệu tham chiếu Edge Relay](/vi/edge-relay/reference/).

### Bắt đầu nhanh

```sh
sudo mkdir -p /etc/containers/systemd /etc/edge-relay
sudo cp edge-relay.container edge-relay-data.volume /etc/containers/systemd/
sudo cp devices.example.json /etc/edge-relay/devices.json   # then edit it
sudo "$EDITOR" /etc/containers/systemd/edge-relay.container  # broker, group, node

# Skip this if the broker takes anonymous connections.
printf '%s' 'your-broker-password' | sudo podman secret create edge-relay-broker-password -

sudo systemctl daemon-reload
sudo systemctl start edge-relay.service
sudo systemctl status edge-relay.service
curl localhost:8081/status
```

**Cập nhật.** Unit theo `:stable` và tự cập nhật khi bộ hẹn giờ của Podman đã bật:

```sh
sudo systemctl enable --now podman-auto-update.timer
```

Nếu một image mới không qua được kiểm tra sức khỏe, Podman đặt lại image cũ. Danh sách đội thiết bị của Gateway hiển thị phiên bản và digest image của từng relay và ghi lại mọi thay đổi. Để giữ các bản cập nhật cho đến khi quản trị viên chấp thuận trên Gateway, hãy cài `edge-relay-hold.conf` như chú thích ở đầu tệp đó nói và tắt bộ hẹn giờ. Mọi việc điều này làm, và những gì nó không làm được, nằm trong [tài liệu tham chiếu Edge Relay](/vi/edge-relay/reference/#updating-a-relay).

Để áp dụng thay đổi của tệp cục bộ: sửa nó, rồi chạy `sudo systemctl restart edge-relay.service`. Relay đọc tệp đó khi khởi động và không theo dõi nó.

Tệp thiết bị do Gateway đẩy xuống không cần gì trong số đó: nó áp dụng ngay, không cần khởi động lại. Nó không thể ghi vào `/etc/edge-relay/devices.json` (được gắn `:ro` trên root chỉ đọc), nên nó nằm trên volume dữ liệu là `/data/pushed-devices.json`, và khi nó còn tồn tại, đó là tệp relay chạy và khởi động từ. Các chỉnh sửa của bạn với tệp cục bộ nằm không dùng cho đến khi bạn xóa bản đẩy: `DELETE /api/fleet/{id}/config` trên Gateway khi relay đang chạy, và nó chuyển về tệp cục bộ ngay. Journal cho biết nó đang dùng tệp nào, nên hãy kiểm tra ở đó trước khi nghi ngờ JSON của bạn.

Đã kiểm chứng với tệp nhị phân `quadlet` thật (`/usr/libexec/podman/quadlet -dryrun` của `podman-5.8.6`): cả hai unit được phân tích sạch và tạo ra lệnh `podman run` như mong đợi, với phụ thuộc volume và secret được nối tự động.
