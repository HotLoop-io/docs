---
title: "Cascade với Podman Quadlet"
description: "Chạy Cascade như dịch vụ systemd bằng Podman Quadlet, trên SQLite hoặc với Postgres và worker riêng, với khung giờ cập nhật do chính bạn quyết định."
---

Có hai cách để chạy. Cả hai đều cần Podman 5.0 trở lên và cài bằng quyền root, để khởi động cùng máy mà không cần ai đăng nhập. Cả hai đều theo `ghcr.io/hotloop-io/hotloop-cascade:stable`, chạy ở chế độ chỉ đọc, không có quyền root và bỏ hết mọi capability, rồi để systemd khởi động lại khi cần. Phần cập nhật và cách quay lui nằm ở cuối.

## Một máy, SQLite

`hotloop-cascade.container` và `hotloop-cascade-data.volume`. Cơ sở dữ liệu là một tệp trong volume, nằm cạnh khóa dùng để mã hóa thông tin đăng nhập đã lưu.

```sh
sudo cp hotloop-cascade.container hotloop-cascade-data.volume /etc/containers/systemd/
sudo install -D -m 600 /dev/null /etc/hotloop-cascade/cascade.env
sudo systemctl daemon-reload
sudo systemctl start hotloop-cascade
```

Mở `http://this-box:8080`. Người đầu tiên mở sẽ tạo tài khoản đầu tiên, vì vậy hãy tự làm việc đó trước khi chia sẻ địa chỉ.

## PostgreSQL, một máy chủ và các worker

`postgres/`. Cơ sở dữ liệu, máy chủ và, nếu muốn, thêm các worker. Postgres chính là hàng đợi, nên các worker lấy việc từ cùng một nơi. Cơ sở dữ liệu nằm trong một mạng riêng và không công bố cổng nào.

Trước tiên là ba bí mật, chỉ tạo một lần. Các lệnh nằm ở đầu `postgres/hotloop-cascade.container`. Khóa là quan trọng nhất: mất nó thì mọi thông tin đăng nhập đã lưu đều không đọc được. Hãy giữ một bản sao ở nơi khác, không phải trên máy này.

```sh
cd postgres
sudo cp hotloop-cascade.network hotloop-cascade-db.container hotloop-cascade-db.volume \
  hotloop-cascade-data.volume hotloop-cascade.container /etc/containers/systemd/
sudo install -D -m 600 /dev/null /etc/hotloop-cascade/cascade.env
sudo systemctl daemon-reload
sudo systemctl start hotloop-cascade
```

Thêm worker: `hotloop-cascade-worker.container`. Các worker dùng chung volume dữ liệu, nên phải nằm trên cùng một máy. Vượt quá một máy thì dùng chart Helm.

## Cài đặt

`/etc/hotloop-cascade/cascade.env`, mỗi dòng một `NAME=value`, và tệp phải tồn tại dù để trống (dòng `install` sẽ tạo ra nó). Những mục bạn sẽ cần:

| Cài đặt | Tác dụng |
|---|---|
| `HOTLOOP_CASCADE_PUBLIC_URL` | Địa chỉ mọi người dùng để vào Cascade. Liên kết webhook và liên kết gọi lại OAuth được tạo từ nó. Khi chưa đặt, nó là `http://localhost:8080`, chỉ dùng được từ chính máy đó. |
| `HOTLOOP_CASCADE_METRICS_TOKEN` | Yêu cầu `Authorization: Bearer` trên `/metrics`. |
| `HOTLOOP_CASCADE_FILES_DIR` | Bật các bước tệp, trong thư mục này. Hãy gắn thư mục đó vào container nữa. |

Các unit chỉ đặt thư mục dữ liệu, các cổng và khóa, và giá trị đặt trong unit sẽ thắng giá trị trong tệp env, nên đừng đụng vào những mục này. Sau khi thay đổi: `sudo systemctl restart hotloop-cascade`.

## Kiểm tra

```sh
sudo podman healthcheck run hotloop-cascade
curl -s http://127.0.0.1:8081/readyz
sudo podman exec hotloop-cascade /usr/local/bin/hotloop-cascade workflows import - < workflow.yaml
```

Tình trạng và số đo nằm ở cổng 8081, chỉ công bố trên loopback. Nếu thứ khác đã dùng 8080 hoặc 8081, hãy đổi vế trái của các dòng `PublishPort=`.

## Nâng cấp

Các unit của ứng dụng theo `:stable` và có `AutoUpdate=registry`. Bật bộ hẹn giờ của Podman một lần cho mỗi máy:

```sh
sudo systemctl enable --now podman-auto-update.timer
```

Khi nó chạy, Podman tải `:stable`, và nếu digest đã đổi thì khởi động lại unit với image mới. Unit chỉ được tính là đã khởi động khi container qua được kiểm tra sức khỏe (`Notify=healthy`; kiểm tra này là chính tệp nhị phân tự hỏi `/readyz` của nó, dưới dạng mảng JSON vì image không có shell). Nếu image mới không bao giờ đạt tới đó, Podman đặt lại image trước đó dưới `:stable` và khởi động nó. Thời gian chờ tối đa là 15 phút, vì image mới sẽ di chuyển cơ sở dữ liệu trong lúc khởi động.

Để giữ các bản cập nhật cho đến khi bạn cho phép, hãy để bộ hẹn giờ tắt và chạy `sudo podman auto-update` khi bạn sẵn sàng. Để chúng chỉ chạy trong một khung giờ, hãy cài `update-window.conf` (phần đầu tệp hướng dẫn cách làm).

Hai việc mà quay lui không thể hoàn tác. Migration chỉ đi một chiều, nên hãy sao lưu trước khi bật cập nhật. Bản phát hành nào đổi một bảng theo cách bản cũ không đọc được sẽ nói rõ trong ghi chú phát hành. Và cơ sở dữ liệu: image của nó được ghim vào một tag chính xác và không mang nhãn cập nhật, có chủ ý. Một máy chủ mới không khởi động được thì hoàn tác bằng cách đặt lại image cũ, còn image cơ sở dữ liệu mới có thể khởi động, đổi thư mục dữ liệu, rồi sau đó mới lộ ra là một sai lầm. Trong PostgreSQL 18, việc đó là sửa tag, sau khi đọc ghi chú phát hành và sao lưu.

Ở kiểu PostgreSQL, máy chủ và từng worker là các unit riêng, nên một bản cập nhật không khởi động được chỉ quay lui unit đó chứ không phải unit bên cạnh.

## Đã thử những gì

Các unit đã được chạy thật trên Podman 6.1.3, rootless dưới systemd, với một registry cục bộ thay cho ghcr.io và các unit giữ nguyên như phát hành, chỉ đổi cổng của máy chủ. Cả kiểu độc lập lẫn kiểu PostgreSQL: lần khởi động đầu chờ một container khỏe; cập nhật lên digest mới, quay lại khỏe với dữ liệu nguyên vẹn và, ở kiểu PostgreSQL, container cơ sở dữ liệu không bị động tới; và cập nhật lên image thoát ngay khi khởi động, được `podman auto-update` báo là `rolled back`, digest trước đó khỏe lại và quy trình trước đó vẫn đang chạy. Khi cài bằng root trên Podman 4.9.3, phiên bản unit trước đó đã khởi động và khởi động lại dưới systemd; và Quadlet 4.9 không hỗ trợ `Notify=healthy`, vì vậy các unit còn mang thêm `--sdnotify=healthy`.

Sau đó cả hai kiểu lại được chạy như cài bằng root, đúng như các unit hướng dẫn, trên Podman 5.8.7 dưới systemd trong một container đặc quyền dùng một lần, với cùng registry cục bộ thay cho ghcr.io làm bản sao và các unit không chỉnh sửa. Kiểu độc lập: lần khởi động chờ container khỏe, container bị tắt cưỡng bức quay lại khỏe, cập nhật lên image tốt lên khỏe trên digest mới, cập nhật lên image thoát ngay khi khởi động được báo là `rolled back` với image tốt chạy lại, và một quy trình chạy sau mỗi bước. PostgreSQL, với máy chủ và một worker thêm: `systemctl start` trên máy chủ chờ cơ sở dữ liệu rồi máy chủ khỏe, máy chủ bị tắt cưỡng bức quay lại, cập nhật lên image tốt chuyển máy chủ và worker sang bản mới mà không động tới container cơ sở dữ liệu, cập nhật lên image thoát ngay khi khởi động quay lại là `rolled back` với cả hai trở về image tốt và cơ sở dữ liệu không bị động tới, và một quy trình chạy trước, giữa và sau. Một điều cần biết khi đọc kết quả đó: máy chủ và worker dùng chung một image, và khi cái đầu tiên quay lui thì cái kia hiện `true`, kèm một lần khởi động lại, và rốt cuộc vẫn nằm trên image tốt. Cái nào quay lui trước thay đổi theo từng lần chạy.

Chạy trên máy thật (2026-11-17), trên một Raspberry Pi thật và với cập nhật tự động Quadlet đối chiếu với chính ghcr.io.
