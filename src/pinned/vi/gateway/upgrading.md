---
title: "Nâng cấp HotLoop Gateway lên {{hotloop}}"
description: "Từ 4.22.1 chỉ là một lần helm upgrade với ba migration mới. Từ 4.18.11 agent có thể ghi. Từ 4.18.10 cơ sở dữ liệu chuyển sang PostgreSQL 17."
sidebar:
  label: "Nâng cấp"
---

Có sáu đường lên {{hotloop}} và chúng chẳng giống nhau chút nào. Từ 4.22.1 đó là một lệnh `helm upgrade` đơn giản, thêm ba bảng và cột, đồng thời gắn máy chủ ở chế độ chỉ đọc để theo dõi tình trạng thiết bị, nên hãy kiểm tra hồ sơ Pod Security của bạn. Từ 4.18.11 cũng là một `helm upgrade` đơn giản, nhưng có hai điều thay đổi cách một nhà máy đang chạy hoạt động, nên hãy đọc chúng trước. Từ 4.18.10 động cơ cơ sở dữ liệu thay đổi ngay bên dưới bạn, và bạn cần biết điều đó trước khi nó xảy ra. Từ 4.17.0 là một `helm upgrade` đơn giản, có vài giá trị mặc định đã đổi. Từ 4.16.0 bạn đi qua 4.17.0 trước, và sau đó một Secret mới là một phần dữ liệu của nhà máy cũng như cơ sở dữ liệu. Từ 4.3.1 đó là một chart đã đổi tên mà `helm upgrade` đơn giản không thể chạm tới, và trên đường đi bạn qua 4.16.0 và 4.17.0. Ghi chú phát hành chỉ nói về từng bước một, và không ghi chú nào nói về việc nhảy qua một bản phát hành, nên trang này không hứa rằng cách đó chạy được. Hãy tìm đường của bạn và đọc hết trước khi chạm vào một nhà máy đang chạy.

:::caution[Nếu bạn đang ở 4.20.2 trở về trước: một client OPC UA dùng Basic256 sẽ không kết nối được nữa]
4.21.0 đã tắt `Basic128Rsa15` và `Basic256` theo mặc định, cả khi nâng cấp lẫn khi cài mới. Máy chủ không còn liệt kê chúng và từ chối client yêu cầu một trong hai theo tên. Hãy kiểm tra xem có client OPC UA nào của bạn (kết nối của Ignition cho thấy điều này) không nói được gì mới hơn `Basic256`, rồi chuyển client đó sang `Basic256Sha256`. Nếu không chuyển được, `HOTLOOP_OPCUA_SERVER_ALLOW_DEPRECATED_POLICIES=true` (trong chart là `opcuaServer.allowDeprecatedPolicies: true`) sẽ bật lại hai chính sách đó, và máy chủ báo điều này khi khởi động. 4.21.0 còn thêm migration 0027, một bảng mới, nên ngoài ra việc nâng cấp là một `helm upgrade` đơn giản. Bước kiểm tra phát hành đã chạy 4.20.2 trên lược đồ đã migrate và nó chạy được, nên bảng này không phải lý do khiến rollback không an toàn.
:::

:::note[Chart cũ được tải bằng URL]
Chỉ mục của kho chart giữ các chart của Gateway tới 4.16.0, nên `hotloop/hotloop --version 4.17.0` phân giải được, và các gói cũng được phục vụ qua URL. Các lệnh bên dưới cho 4.16.0 và 4.17.0 gọi chart bằng URL của nó, như `https://hotloop.io/hotloop/hotloop-4.17.0.tgz`, và cách nào cũng chạy. IoT và Edge bắt đầu từ 4.18.10.
:::

## Nâng cấp từ 4.22.1

Một `helm upgrade` đơn giản, và không có gì đã có trên thiết bị bị thay đổi. Ba migration chạy ở lần khởi động đầu tiên và mỗi cái chỉ thêm: `0028_unifi_port_cycles`, `0029_energy` và `0030_energy_demand`. Bản sao lưu làm trên 4.22.1 khôi phục được ở đây, còn bản làm ở đây không khôi phục được lên bản phát hành cũ hơn, nên hãy sao lưu trước nếu bạn có thể quay lại.

- **Chart giờ gắn máy chủ ở chế độ chỉ đọc để theo dõi tình trạng thiết bị.** Chart Gateway và Edge gắn thư mục gốc của máy chủ và `/proc` để bảng điều khiển EmberNet đọc được đĩa, CPU và bộ nhớ của thiết bị. Không có đặc quyền nào được thêm. Một cluster dùng hồ sơ Pod Security restricted sẽ từ chối hostPath, nên ở đó hãy đặt `opcuaServer.dashboard.boxHealth.enabled: false` trước khi nâng cấp. [Cài đặt Gateway](/vi/gateway/install/#tình-trạng-hộp-và-phần-gắn-của-host) có các giá trị.
- **Các tính năng đã hoàn thiện giờ được giao ở trạng thái bật.** Ở nơi chart có tính năng đó, `broker.enabled`, `opcuaServer.enabled`, `reports.enabled`, `backup.enabled` (hằng ngày, `backup.interval: 24h`), `notify.enabled` cùng mọi kênh báo động, `edgePublish.enabled`, `monitoring.serviceMonitor.enabled` (chỉ được tạo ở nơi đã cài CRD của Prometheus operator) và `ingress.enabled` đều là true. Ingress không có tên máy chủ, nên nó trả lời mọi host mà ingress class của bạn phục vụ: đặt `ingress.hosts[0].host` để gắn nó vào một tên. Một kênh báo động hoặc bộ phát hành edge không có nơi để gửi sẽ chờ và nói rõ điều đó, và quản trị viên cho nó một đích trong Cài đặt, "Báo động và số đo đi đâu". Một giá trị do tệp của bạn đặt vẫn được ưu tiên, và mỗi mục đặt thành `false` không tạo listener, Service, ổ lưu trữ hay Ingress.
- **Một đăng nhập mới chỉ đọc được và không làm gì khác.** Chart tạo `embernet-dashboard-read` và Secret `<release>-opcua-dashboard` của nó ở lần cài đầu tiên của phiên bản này và không bao giờ xoay vòng nó.
- **Lệnh UniFi có sẵn và đang tắt.** Năm loại điểm có thể ra lệnh cho một console, và mỗi loại vẫn chỉ đọc cho đến khi có người kích hoạt tag đó. Tài khoản console phải là Quản trị viên cục bộ thì chúng mới chạy.
- **Unit nâng cấp của Quadlet tự bỏ qua.** `hotloop-db-upgrade` chỉ chạy khi ổ lưu trữ vẫn chứa dữ liệu PostgreSQL 16, nên trên thiết bị đã ở 17 nó hiện không hoạt động, không phải thất bại. Hãy lấy các tệp unit mới từ `deploy/quadlet/`.
- **Các chart giữ lại Secret thông tin đăng nhập khi gỡ cài đặt,** giống như ổ lưu trữ của cơ sở dữ liệu. Để bắt đầu lại từ đầu, hãy xóa Secret bằng tay cùng với ổ lưu trữ.

## Nâng cấp từ 4.18.11

Vì sao nên làm: agent qua MCP giờ có thể ghi, một giá trị bạn ghi vào tag có tỉ lệ sẽ vào thanh ghi đúng như bạn muốn, runtime CODESYS được đọc theo tên mà lập trình viên đặt cho các biến, HotLoop có thể gửi số đo và nhật ký hệ thống tới broker Kafka, OPC UA PubSub trên UADP chạy cả hai chiều, và cài từ cửa hàng sẽ đăng nhập bằng chính bạn. [Ghi chú phát hành 4.19.4](/vi/releases/hotloop-4-19-4/) có danh sách đầy đủ, [4.19.5](/vi/releases/hotloop-4-19-5/) là bản dựng đa kiến trúc của nó, và [4.19.8](/vi/releases/hotloop-4-19-8/) thêm một bản sửa cho Sổ nhật ký và bộ chọn tag tìm trong toàn nhà máy. 4.19.0 đến 4.19.3, 4.19.6 và 4.19.7 đã được gắn tag nhưng chưa bao giờ được phát hành, nên không bản nào tồn tại để nâng cấp từ đó.

```bash
helm repo update
helm upgrade hotloop hotloop/hotloop --version {{hotloop}} \
  --namespace hotloop --reset-then-reuse-values
```

Giống như vậy cho `hotloop-edge`, `hotloop-iot` và `hotloop-edge-relay`. Cơ sở dữ liệu đã là PostgreSQL 17 từ 4.18.11, và không có gì ở đây thay đổi nó, nên `helm rollback` về 4.18.11 là ổn.

- **Agent có thể ghi.** `allowMcpWrites` được bật theo mặc định trong mã và trong cả ba chart. Một bản triển khai có `allowWrites` bật và chưa bao giờ đặt `allowMcpWrites` sẽ nhận ghi từ agent ở lần nâng cấp này, qua cùng cổng kiểm soát như màn hình. Bản triển khai đã lưu `allowMcpWrites: false` vẫn tắt. Nếu bạn muốn agent chỉ đọc, hãy đặt nó thành `false` trước khi nâng cấp.
- **Endpoint MCP luôn có token.** Một tệp nhị phân chạy riêng hoặc một unit Quadlet chưa từng đặt token sẽ tự tạo một cái ở lần khởi động đầu và giữ trong cơ sở dữ liệu của nó. `hotloop mcp-token` in nó ra, và một agent trỏ tới `/mcp` mà không có token sẽ ngừng hoạt động cho đến khi bạn đưa token này cho nó.
- **Tag có tỉ lệ.** Ghi 55.5 vào tag có tỉ lệ 0.1 thì 555 vào thanh ghi, trong khi trước đây là 55. Nếu có ai từng nhập số đếm thô để né điều này, giờ nó sẽ gửi gấp mười lần. Hãy xem lại mọi tag có tỉ lệ hoặc độ lệch mà ai đó ghi bằng tay, từ một tự động hóa hoặc từ một công thức, và đổi các con số đó sang giá trị kỹ thuật ngay trong bước nâng cấp.
- **Giờ là `Z`.** Mọi thời gian mà API ghi đều là UTC. Một script từng phân tích độ lệch cục bộ của bạn giờ nhận `Z`.
- **Một migration,** `0026`, thêm cột `options` vào các đích của historian, trống với mọi đích đang có.

## Nâng cấp từ 4.18.10

Vì sao nên làm: cơ sở dữ liệu giờ là PostgreSQL 17, và thiết bị tự chuyển. Bạn cũng có [tích hợp](/vi/iot/integrations/) với SNMP và BACnet/IP, đăng nhập kiosk, leo thang báo động, và một giao diện cài được lên điện thoại. [Ghi chú phát hành 4.18.11](/vi/releases/hotloop-4-18-11/) có danh sách. Phần tiếp theo là chỗ dễ vấp.

PostgreSQL sẽ không mở thư mục dữ liệu của một phiên bản chính khác, nên chỉ đổi image sẽ để mọi thiết bị hiện có với một cơ sở dữ liệu không khởi động được. HotLoop không yêu cầu bạn dump rồi nạp lại. Lần khởi động đầu sau khi nâng cấp chạy một script trước cơ sở dữ liệu, và script đó thực hiện việc chuyển.

```bash
helm repo update hotloop
helm upgrade <release> hotloop/hotloop --version {{hotloop}} --reset-then-reuse-values
```

Giống như vậy cho `hotloop-edge` và `hotloop-iot`. Hãy sao lưu trên 4.18.10 trước và chép nó ra khỏi thiết bị. Bản sao lưu của chính HotLoop do ứng dụng đang chạy tạo ra qua cơ sở dữ liệu đang chạy, nên không thể tạo trong bước chạy trước khi cơ sở dữ liệu khởi động.

### Điều gì xảy ra ở lần khởi động đầu từ 4.18.10

- **Pod cơ sở dữ liệu nằm ở `Init`, và ứng dụng chờ nó.** Trên chart đó là hai init container của pod cơ sở dữ liệu: image cũ bàn giao bản cài PostgreSQL 16 và image mới chạy `pg_upgrade`, ở chế độ sao chép, vào một thư mục mới cạnh thư mục cũ. Nó khởi động máy chủ mới một lần để chứng minh nó mở được, và chỉ sau đó mới đổi tên. Thời gian phụ thuộc vào dữ liệu của bạn, nên với dữ liệu lớn hãy theo dõi nhật ký lần đầu: `kubectl logs <release>-postgresql-0 -c pg-upgrade`. Trên Quadlet đó là `hotloop-db-upgrade.container`, một unit oneshot mà unit cơ sở dữ liệu yêu cầu: `journalctl -u hotloop-db-upgrade`.
- **Nó cần dung lượng trống xấp xỉ dữ liệu của bạn, và nó kiểm tra trước khi bắt đầu.** Nếu không đủ chỗ, nó dừng với dữ liệu 16 y nguyên và cơ sở dữ liệu chưa khởi động. Giải phóng đĩa rồi khởi động lại.
- **`pgdata.pg16` vẫn nằm trên ổ lưu trữ, và việc xóa nó là của bạn.** Thư mục cũ được đổi tên và để lại đó. Nó là toàn bộ cơ sở dữ liệu PostgreSQL 16 như lúc nâng cấp, tức là bản sao lưu và đường quay lại của bạn, và lớn bằng cơ sở dữ liệu. Khi thiết bị đã chạy trên 17 đủ lâu theo ý bạn:

  ```bash
  # chart
  kubectl -n hotloop exec hotloop-postgresql-0 -c postgresql -- rm -rf /var/lib/postgresql/data/pgdata.pg16
  # Quadlet
  sudo rm -rf "$(sudo podman volume inspect hotloop-db --format '{{.Mountpoint}}')/pgdata.pg16"
  ```

- **Thất bại thì bạn vẫn ở chỗ cũ.** Nếu có gì hỏng trước khi hoán đổi, dữ liệu 16 không bị động tới và cơ sở dữ liệu không khởi động trên một thư mục dựng dở. Trên chart, pod ở lại `Init:Error`. Trên Quadlet, unit nâng cấp thất bại và unit cơ sở dữ liệu phía sau không bao giờ khởi động. Sửa điều nhật ký nói rồi khởi động lại.
- **`helm rollback` về 4.18.10 sẽ không khởi động được cơ sở dữ liệu của nó.** Đây là điểm lưu ý. Rollback đặt image cơ sở dữ liệu về PostgreSQL 16, và 16 không mở được thư mục 17. Không mất gì và không có gì bị đổi dở, chỉ là cơ sở dữ liệu không khởi động. Để lấy lại cần phép hoán đổi trong [Quay lại](/vi/install/helm/#quay-lại) trên trang k3s và Helm: dừng cơ sở dữ liệu, chuyển `pgdata` thành `pgdata.pg17` và `pgdata.pg16` thành `pgdata`. **Việc này làm mất mọi bản ghi đã ghi trên 17 kể từ lần nâng cấp,** vì `pgdata.pg16` là cơ sở dữ liệu như lúc đó. Hãy tiến lên khi có thể. Hoán đổi ngược chỉ dùng được một lần, và lần nâng cấp kế tiếp từ chối chạy khi còn một `pgdata.pg16` nằm đó. Nó được ghi trong tài liệu, không được chạy bằng một bài kiểm tra.
- **Thiết bị Quadlet không bị ảnh hưởng.** Tự động cập nhật của Podman chỉ rollback ứng dụng, không bao giờ rollback cơ sở dữ liệu, và ứng dụng 4.18.10 đọc cơ sở dữ liệu PostgreSQL 17 bình thường, vì các migration chỉ thêm. Một thiết bị Quadlet rollback một bản cập nhật vẫn tiếp tục chạy.
- **Một migration mới, `0025_kiosk_pin`.** Nó chỉ thêm cột, mỗi cột đều có giá trị mặc định, nên 4.18.10 chạy trên lược đồ mà nó để lại.
- **Giờ có khóa tài khoản, cho mọi bản cài.** Mười lần nhập sai mật khẩu hoặc PIN liên tiếp sẽ khóa riêng tài khoản đó 5 phút, và quản trị viên có thể mở khóa. Một script thử lại mật khẩu sai hơn mười lần sẽ bắt đầu nhận `429`. `HOTLOOP_AUTH_LOCKOUT_ATTEMPTS=0` tắt nó.
- **Tắt việc nâng cấp.** `database.postgresql.upgrade.enabled: false` bỏ các init container, và khi đó ổ lưu trữ còn ở 16 sẽ làm cơ sở dữ liệu không khởi động. Hãy để bật. Khi bật, bản cài mới vẫn kéo image PostgreSQL 16 một lần trên mỗi node, vì image của init container được kéo trước khi nó chạy.

### Quadlet và Edge Relay

Chép `hotloop-db.container`, `hotloop-db-upgrade.container` và `hotloop-db-upgrade.sh` mới từ thư mục sản phẩm của bạn trong `deploy/quadlet/` vào thư mục unit, chạy `systemctl daemon-reload` và khởi động lại `hotloop-db.service`. Unit cơ sở dữ liệu yêu cầu unit nâng cấp, nên một thiết bị chỉ nhận unit cơ sở dữ liệu mới sẽ không khởi động trên dữ liệu 16, và nói rõ lý do. Edge Relay không có cơ sở dữ liệu và không có gì phải làm. Nó được phát hành ở {{hotloop}} vì mọi sản phẩm phát hành đồng bộ với nhau.

### Thay đổi API từ 4.18.10

- **Route mới:** `GET` và `PUT /api/notify/escalation`, `GET /manifest.webmanifest` và `GET /sw.js` (không có phiên, vì điện thoại hỏi trước khi có ai đăng nhập), `GET /api/integrations` cùng `POST /api/integrations/{id}/probe` và `/setup`, `POST /api/auth/kiosk`, `POST /api/auth/activity`, `PUT` và `DELETE /api/users/{username}/pin`, và `DELETE /api/users/{username}/lockout`.
- **Một quyền mới, `notify.escalation`,** chỉ dành cho quản trị viên. Vai trò người xem và vận hành viên không có.
- **Hai giao thức mới,** `snmp` và `bacnet`, trong `GET /api/protocols`. Nhật ký báo động có hai loại sự kiện mới, `escalated` và `escalation-ended`, và một script giả định danh sách cũ sẽ gặp chúng.
- **Thời gian trả về theo UTC,** mọi thời gian mà lịch sử trả về. Một script so sánh chuỗi sẽ thấy độ lệch thành `Z`. Script so sánh thời điểm thì không thấy gì.

## Nâng cấp từ 4.17.0

Vì sao nên làm: Gateway không còn là image duy nhất. IoT và Edge là mới, cơ sở dữ liệu là một thiết lập, các thiết bị tự công bố qua MQTT tự xuất hiện, lịch sử có thể ghi ra cơ sở dữ liệu riêng của nhà máy, và một thiết bị theo `:stable` tự rollback một bản cập nhật xấu. Điều cuối chỉ chạy được vì các migration chỉ thêm. [Ghi chú phát hành 4.18.10](/vi/releases/hotloop-4-18-10/) có danh sách.

Đó là một `helm upgrade` đơn giản. Chúng tôi đã render chart Gateway 4.17.0 và {{hotloop}} cạnh nhau với cùng các giá trị: cùng tám đối tượng, cùng selector, cùng volume claim.

```bash
helm repo update hotloop
helm upgrade <release> hotloop/hotloop --version {{hotloop}} --reset-then-reuse-values
```

`--reset-then-reuse-values`, hoặc tệp giá trị của bạn với `-f`. `--reuse-values` thuần túy lần này tình cờ vẫn render được, nhưng nó phát lại các giá trị của 4.17.0 và bỏ mọi mặc định mà bản phát hành này thêm, và đó là cách bạn vô tình ở lại giới hạn hàng đợi cũ bên dưới.

### Điều gì xảy ra ở lần khởi động đầu từ 4.17.0

- **Các migration 0016 đến 0025 chạy:** `0016_mqtt_discovery`, `0017_broker_logins`, `0018_mqtt_sources`, `0019_historian_targets`, `0020_net_finds`, `0021_mqtt_source_dialects`, `0022_mqtt_source_shelly`, `0023_dashboards` (bảng lưu các bảng điều khiển bạn tạo) và `0024_tag_no_data` (cột `no_data` trên tag, trống với mọi tag đang có, đúng như những tag đó vốn làm) và `0025_kiosk_pin` (cột cho mã băm PIN, giới hạn nhàn rỗi của phiên và bộ đếm khóa). Tất cả chỉ thêm. `pg_dump` trước, như mọi khi.
- **`edgePublish.queueMaxBytes` mặc định là 64 MiB, không phải không giới hạn.** Nó chỉ quan trọng nếu bạn phát hành lên trên qua Sparkplug. Quá giới hạn, các số đo cũ nhất bị bỏ và được đếm. Một hàng đợi không giới hạn làm đầy ổ lưu trữ nếu mất kết nối đủ lâu, điều đó tệ hơn, nhưng đây vẫn là một mặc định đã đổi. 64 MiB là khoảng 248.000 số đo, khoảng hai phút ở 2.000 số đo mỗi giây, nên hãy tính theo tốc độ của chính bạn (khoảng 240 byte một số đo), hoặc đặt `0` để có hành vi cũ. HotLoop cảnh báo khi khởi động nếu bạn làm vậy. Một bản phát hành nâng cấp bằng `--reuse-values` giữ nguyên những gì nó có.
- **Đăng nhập broker.** Các đăng nhập từ `HOTLOOP_BROKER_USERS` vẫn làm được mọi việc như trước, vì không ai nên nâng cấp vào một nhà máy mà lưu lượng Sparkplug bị dội lại bởi những quy tắc họ chưa từng viết. Các đăng nhập bạn tạo trong Cài đặt, MQTT mang quy tắc chủ đề từ một hồ sơ. Một broker không có `HOTLOOP_BROKER_USERS` giờ vẫn khởi động, và chỉ HotLoop cùng các đăng nhập tạo trong đó mới vào được.
- **Cơ sở dữ liệu chuyển từ PostgreSQL 16 sang 17 ở lần khởi động đầu này,** tự nó làm, và cần đĩa trống. [Phần 4.18.10](#nâng-cấp-từ-41810) nói nó diễn ra thế nào, và đó là phần cần đọc trước.
- **Quay lại 4.17.0 giờ là một phép hoán đổi cơ sở dữ liệu, không phải `helm rollback`.** Lược đồ chỉ lớn thêm và 4.17.0 chạy được trên nó, nhưng cơ sở dữ liệu của 4.17.0 là PostgreSQL 16 và sẽ không mở thư mục 17 mà lần nâng cấp để lại; phép hoán đổi ngược nằm ở phần 4.18.10. Dù sao cũng hãy sao lưu trước khi nâng cấp. Từ đây ứng dụng cũng đếm cơ sở dữ liệu đi trước nó bao xa, và từ chối khởi động, nêu tên cả hai phiên bản, khi cơ sở dữ liệu đã đi trước hai bản phát hành.
- **Muốn một sản phẩm khác?** Từ IoT lên Edge lên Gateway giữ nguyên mọi thiết bị, tag, thực thể, tự động hóa, báo động, người dùng và từng giờ lịch sử. Hãy sao lưu, rồi `helm upgrade hotloop hotloop/hotloop-edge` trên cùng release. [Dòng sản phẩm](/vi/products/) có cách làm. Đi ngược xuống một sản phẩm thấp hơn không phải việc nên làm trên thiết bị bạn coi trọng.

### Edge Relay và Quadlet

Hãy nâng cấp chart của relay cũng với `--reset-then-reuse-values`. Người dùng Quadlet lấy `edge-relay.container` mới: nó theo `:stable` thay vì ghim 4.17.0, và mang healthcheck cùng `--sdnotify=healthy` giúp một bản cập nhật xấu được rollback. Thiếu hai thứ đó, một bản cập nhật chết vẫn được báo là thành công. Một tệp thiết bị đẩy từ Gateway giờ được áp dụng ngay, không cần khởi động lại, trong khi ở 4.17.0 nó phải chờ một lần. [Trang cài đặt Edge Relay](/vi/edge-relay/install/) có unit đầy đủ.

Gateway giờ có các unit Quadlet, thứ mà 4.17.0 không có. Chúng nằm trong thư mục `gateway/` của [Podman Quadlet](/vi/install/quadlet/), và [trang cài đặt Gateway](/vi/gateway/install/#podman-quadlet) có các bước.

### Thay đổi API từ 4.17.0

- **Route mới:** `/api/discovery` cùng các hành động `accept`, `ignore`, `unignore` và `review`, `/api/network-discovery` cùng `probe`, `accept`, `ignore` và `unignore`, `/api/mqtt/brokers`, `/api/broker/logins`, `/api/historian/targets`, `GET /api/entities/{entity_id}/image` và `POST /api/fleet/{id}/update`, thao tác duyệt bản cập nhật image mà một relay đang giữ. Không có gì bị gỡ bỏ.
- **`GET /api/status` cho biết `product` và `features`,** cùng digest của image. Script hỏi thay vì dò. Một route của tính năng mà sản phẩm không có trả lời `404` với `{"error":...,"product":...,"feature":...}`.
- **Quyền mới:** `fleet.update`, chỉ dành cho quản trị viên. Vai trò vận hành viên không đổi.

## Nâng cấp từ 4.16.0

Đây là bước tới 4.17.0, và từ 4.17.0 bạn đi tiếp tới {{hotloop}} theo [phần ở trên](#nâng-cấp-từ-4170). Mọi điều bên dưới đã được kiểm chứng với 4.17.0.

Vì sao nên làm: 4.16.0 có lỗi mà một nhà máy đang chạy có thể vấp phải, và 4.17.0 sửa chúng. Dòng lệnh có thể nuốt mất một lệnh Set, nên vận hành viên thấy dòng lệnh đóng lại, tưởng giá trị đặt đã đi, mà không có gì được ghi. Lưu một quy tắc trong trình soạn thảo, kể cả chỉ để đổi tên, lặng lẽ đặt lại ngân sách chạy của nó về năm phút. Một tệp thiết bị đẩy tới Edge Relay không bao giờ tới nơi, trong khi Gateway báo `config pushed`. Và một bản triển khai từ App Store của EmberNet mất tenant của nó. Ngoài các bản sửa, bạn có [công thức](/vi/iot/recipes/), [script](/vi/iot/scripts/), [blueprint](/vi/iot/blueprints/), [helper](/vi/iot/helpers/), [sổ nhật ký](/vi/iot/logbook/), các bước [tự động hóa](/vi/iot/automations/) mới, [UniFi](/vi/iot/unifi/) chỉ đọc, và [MCP](/vi/iot/mcp/) tăng từ 16 công cụ lên 25.

Đó là một `helm upgrade` đơn giản. Chúng tôi đã render cả hai chart ở cả hai phiên bản: mọi selector và mọi volume claim đều giống hệt, và đối tượng mới duy nhất là Secret của khóa.

```bash
helm upgrade <release> https://hotloop.io/hotloop/hotloop-4.17.0.tgz --reset-then-reuse-values
```

`--reset-then-reuse-values`, hoặc tệp giá trị của bạn với `-f`. **Không dùng `--reuse-values`.** Nó phát lại các giá trị của 4.16.0 và bỏ mọi mặc định mà chart này thêm, và việc render chết ở giá trị đầu tiên nó cần (`nil pointer evaluating interface {}.enabled`, từ `secretKey`). Không có gì thay đổi trên cluster khi điều đó xảy ra, nên chỉ cần chạy lại cho đúng cách.

### Điều gì xảy ra ở lần khởi động đầu tiên

Chúng tôi đã kiểm tra điều này bằng cách chạy image 4.16.0 đã phát hành trên một cơ sở dữ liệu, rồi 4.17.0 trên chính cơ sở dữ liệu đó.

- **Các migration 0009 đến 0015 chạy:** `0009_helpers`, `0010_logbook`, `0011_scripts`, `0012_tag_device_class`, `0013_recipes`, `0014_blueprints` và `0015_unifi`. Tất cả chỉ thêm. Trên một nhà máy trống chúng mất một phần năm giây. Trên nhà máy của bạn chúng mất bằng thời gian cơ sở dữ liệu của bạn cần. `pg_dump` trước, như mọi khi.
- **Mật khẩu thiết bị của bạn được mã hóa.** Chart tạo `<release>-secret-key` ở lần nâng cấp này (4.16.0 không có), và Gateway niêm phong mọi thông tin đăng nhập đã lưu ở lần khởi động đó và ghi điều này trong nhật ký: `encrypted stored device credentials devices=N`. Các thiết bị vẫn kết nối, và không ai phải gõ lại gì.
- **Từ đó, khóa này là một phần dữ liệu của bạn.** Khởi động Gateway mà không có nó thì mọi thiết bị có mật khẩu đã niêm phong vẫn ngừng, liên tục thử lại, với lỗi nêu tên khóa nó cần. Bản sao lưu làm sau khi nâng cấp chỉ khôi phục được nơi khóa đó được gắn, và ở nơi khác `--restore-from` từ chối nó và gọi tên khóa. Nếu khóa mất hẳn, `--restore-keep-unreadable-credentials` khôi phục mọi thứ còn lại và để các thiết bị đó ngừng cho đến khi ai đó gõ lại mật khẩu. Bản sao lưu từ 4.16.0 khôi phục ở bất cứ đâu, và thông tin đăng nhập của nó được niêm phong ngay khi khôi phục xong.
- **Quay lại 4.16.0** trên cùng cơ sở dữ liệu thì khởi động được (chúng tôi đã thử), nhưng 4.16.0 không biết gì về niêm phong. Nó đưa cho mỗi thiết bị đoạn văn bản đã niêm phong làm mật khẩu, nên mọi thứ kiểm tra mật khẩu đều từ chối nó. Nếu bắt buộc phải quay lại, hãy khôi phục `pg_dump` bạn đã làm trước khi nâng cấp. Đó chính là lý do bạn làm nó.
- **Render chart thay vì cài nó?** Khóa được tạo bằng một `lookup` mà chỉ `helm install` hay `helm upgrade` thật mới làm được. Bất cứ thứ gì chạy `helm template` rồi áp dụng kết quả sẽ nhận khóa mới mỗi lần render, và lần đồng bộ kế tiếp khóa chặn mọi mật khẩu đã niêm phong. Hãy tạo khóa riêng bằng `hotloop gen-secret-key`, đặt nó vào một Secret do bạn quản lý, và đặt `secretKey.existingSecret`. Helm, Fleet và App Store của EmberNet đều cài thật nên không cần điều này.

Vì vậy việc mới sau lần nâng cấp này: sao lưu `<release>-secret-key` theo cách bạn sao lưu các secret khác của cluster, và giữ nó ở nơi khác, không phải cạnh các bản sao lưu. Một khóa nằm cạnh chính các bản sao lưu nó bảo vệ thì không bảo vệ được gì. [Cài đặt](/vi/gateway/install/#sao-lưu-khóa-trước-khi-bạn-cần-đến-nó) có phần còn lại về những gì khóa này bao phủ.

### Edge Relay

Relay cũng là 4.17.0, phát hành từ cùng tag. Hãy nâng cấp chart của nó lên 4.17.0, bằng cùng loại URL, `https://hotloop.io/hotloop/hotloop-edge-relay-4.17.0.tgz`, và với cùng quy tắc cờ: `--reset-then-reuse-values` hoặc tệp giá trị của bạn. `--reuse-values` trên relay thậm chí không thất bại. Nó bỏ mặc định `pushedDevicesFile` mới của chart, render biến đó rỗng, và một lần đẩy lại chết trên điểm gắn chỉ đọc. Khi đó hãy biết bốn điều.

- **Tệp thiết bị đã đẩy nằm ở `/data/pushed-devices.json`** (`HOTLOOP_EDGE_RELAY_PUSHED_FILE`, `pushedDevicesFile` của chart), trên ổ lưu trữ của relay. Nó thắng `devices` của chart chừng nào còn tồn tại, qua các lần khởi động lại, chuyển pod, và một `helm upgrade` thay đổi `devices`. Relay ghi vào nhật ký nó đã khởi động từ tệp nào. Để quay về tệp cục bộ, `DELETE /api/fleet/{id}/config` trên Gateway (`fleet.config`) khi relay đang kết nối, rồi khởi động lại nó. Lần khởi động lại đó là của 4.17.0. Từ 4.18.10, một relay đang kết nối chuyển ngay tại chỗ.
- **Một lần đẩy cũ có thể quay lại.** Một lần đẩy bạn làm tới relay 4.16.0 không bao giờ tới nơi, nhưng broker vẫn giữ nó, retained, và relay 4.17.0 nhận nó ở lần khởi động đầu và chạy nó. Nếu nó đã cũ, hãy xóa bằng cùng `DELETE` ngay sau khi nâng cấp rồi khởi động lại relay. Từ 4.18.10 việc xóa được áp dụng ngay và không cần khởi động lại.
- **Quadlet: lấy `edge-relay.container` mới.** Unit của 4.17.0 ghim 4.17.0 và đặt `HOTLOOP_EDGE_RELAY_PUSHED_FILE`, và unit hiện tại cũng đặt nó, nhưng theo `:stable`. Thiếu dòng đó, một lần đẩy vẫn thất bại trên thư mục gốc chỉ đọc. [Trang cài đặt Edge Relay](/vi/edge-relay/install/#quadlet) có unit đầy đủ.
- **`persistence.enabled=false` giờ khởi động được,** trên một emptyDir bị giới hạn ở `persistence.size`. Hãy biết cái giá trước khi chọn: mỗi lần pod bị thay, bạn mất hàng đợi chuyển tiếp, mọi tệp thiết bị đã đẩy và chứng chỉ client OPC UA. Thứ gì bạn quan tâm thì dùng PVC, đó là mặc định.

### Một script gọi API sẽ nhận thấy gì

- **Một thời điểm chưa xảy ra thì bị bỏ.** Không phải `null`, mà bị bỏ. 4.16.0 từng gửi `0001-01-01T00:00:00Z` cho `lastRun` của một quy tắc hay script chưa chạy bao giờ, `lastPoll` và `lastGood` của một thiết bị chưa được hỏi, `clearedAt`, `ackedAt` và `shelvedUntil` của một báo động đang tồn tại, `raisedAt` của báo động chưa từng được nâng, cùng các trường đó trong sự kiện `alarm` của luồng trực tiếp, và vài trường nữa. Đó là cách một quy tắc chưa từng chạy báo "Chạy lần cuối 739887 ngày trước". Nếu mã của bạn kiểm tra năm một, hãy kiểm tra trường có hiện diện hay không.
- **Vận hành viên nhận quyền mới ngay lúc bạn nâng cấp:** `helpers.write`, `scripts.run`, `recipes.apply` và `blueprints.apply`. Nên vận hành viên của bạn có thể đặt helper, chạy script, áp dụng công thức và tạo quy tắc từ blueprint ngay. Viết script, công thức và blueprint (`scripts.write`, `recipes.write`, `blueprints.write`) là quyền quản trị viên. Mọi người đều đọc được. Một công thức cũng có thể đặt tên `recipes.apply.<name>` riêng của nó.
- **Route mới:** `/api/helpers`, `/api/logbook`, `/api/scripts`, `/api/recipes`, `/api/blueprints`, `POST /api/automations/{id}/blueprint-upgrade`, các route UniFi (`/api/devices/{id}/network` và `/api/unifi/{id}/...`), và `DELETE /api/fleet/{id}/config`.
- **Tag mang `deviceClass`,** và nó truyền tới các thực thể của chúng.
- **Quy tắc mang `blueprintId`, `blueprintVersion` và `blueprintInputs`.** Một quy tắc viết tay không có. Lưu một quy tắc vẫn thay thế toàn bộ nó, và một body không thể chuyển quy tắc sang blueprint hay phiên bản khác.

## Nâng cấp từ 4.3.1

4.3.1 được phát hành vào tháng Tám, và không có gì sau nó được phát hành cho đến 4.16.0. Mọi thứ từ 4.4.0 đến 4.15.3 đã được gộp và chưa bao giờ phát hành, nên rời 4.3.1 bạn nhận tất cả trong một bước nhảy, dưới một tên mới, image mới, chart mới và giấy phép mới. Phần này đưa bạn tới 4.16.0, bản phát hành mà quy trình này đã được kiểm chứng. Từ đó, [Nâng cấp từ 4.16.0](#nâng-cấp-từ-4160) ở trên là bước nâng cấp đơn giản lên 4.17.0, và [Nâng cấp từ 4.17.0](#nâng-cấp-từ-4170) là bước sau nó. Hãy đọc cả ba trước khi chạm vào một nhà máy đang chạy. Chúng ngắn, và ngắn hơn việc giải thích với quản đốc nhà máy vì sao historian trống.

### Tên mới cho mọi thứ

| Gì | 4.3.1 | 4.16.0 trở đi |
|---|---|---|
| Image | `ghcr.io/embernet-ai/industrial-iot` | `ghcr.io/hotloop-io/hotloop` |
| Kho chart | địa chỉ cũ, giờ là 404 | `https://hotloop.io/hotloop` |
| Chart | `industrial-iot` | `hotloop` |
| Biến môi trường | `IIOT_*` | `HOTLOOP_*` (từ 4.9.0) |

### Đây không phải helm upgrade đơn giản

Tên chart được ghi cứng trong selector của Deployment và StatefulSet, và Kubernetes thẳng thừng từ chối đổi selector tại chỗ. Trỏ release cũ vào chart mới thì nó thất bại ngay. Giữ nguyên tên release và namespace, rồi:

1. `pg_dump` cơ sở dữ liệu. Cẩn tắc vô áy náy. Bạn sẽ mừng vì đã làm.
2. Xóa Deployment cũ (`<release>`) và StatefulSet (`<release>-postgresql`). Ổ lưu trữ cơ sở dữ liệu là một claim riêng, và nó vẫn nằm yên.
3. Thêm kho và nâng cấp bằng tệp giá trị bạn đã dùng để chạy 4.3.1:

   ```bash
   helm upgrade <release> https://hotloop.io/hotloop/hotloop-4.16.0.tgz \
     -n <namespace> -f your-4.3.1-values.yaml
   ```

   Đó là chart 4.16.0 theo URL của nó, chạy được trước khi thêm kho. Khi đã ở 4.16.0, hãy thêm kho (`helm repo add hotloop https://hotloop.io/hotloop`) cho các bước sau nó.

   Không có gì trong tệp đó bị gỡ khỏi chart. Đổi tên mọi `IIOT_` trong `extraEnv` thành `HOTLOOP_`, và bỏ phần ghi đè `image.repository` nếu bạn có. Đừng dùng `--reuse-values`. Nó bỏ qua mọi mặc định chart này đã thêm từ 4.3.1, tức hơn nửa số khóa của nó, và bạn sẽ chạy một chart phần lớn toàn lỗ hổng.

Tên, mật khẩu cơ sở dữ liệu trong Secret và volume claim được render giống hệt của 4.3.1, nên pod cơ sở dữ liệu mới gắn dữ liệu cũ. Gateway migrate lược đồ lên khi khởi động, và nâng TimescaleDB từ 2.29.1 lên 2.30.1 luôn thể.

Chúng tôi đã kiểm tra điều đó bằng cách render hai chart cạnh nhau. Bước 1 là đường quay lại của bạn: nếu việc nâng cấp làm bạn bất ngờ, bạn có một bản dump từ năm phút trước, và chúng tôi muốn nghe về điều đó tại [helpdesk@fireballz.ai](mailto:helpdesk@fireballz.ai).

### Điều gì hoạt động khác đi

- **Có đăng nhập.** Trước 4.4.0 hoàn toàn không có. Chart tạo tài khoản `admin` ở lần cài đầu; [Cài đặt](/vi/gateway/install/#đăng-nhập) có lệnh đọc lại mật khẩu.
- **Ghi mặc định tắt,** kể cả agent, từ 4.4.0. Nếu tệp giá trị 4.3.1 của bạn chưa bao giờ đặt `safety.allowWrites`, mọi lần ghi mà vận hành viên và quy tắc của bạn từng làm sẽ bị từ chối sau khi nâng cấp cho đến khi bạn đặt nó. Điều đó là cố ý, và là dấu hiệu để bạn xem lại những gì đang được kích hoạt trước khi bật lại.
- **Múi giờ không tải được sẽ dừng việc khởi động.** `HOTLOOP_TIMEZONE` hoặc `TZ` đặt thành giá trị sai từng chạy theo UTC mà không nói một lời, âm thầm làm lệch mọi báo cáo, lịch và ca đổi ca hàng giờ.
- **Thông tin đăng nhập thiết bị được đọc lại là `[redacted]`** với mọi vai trò, kể cả quản trị viên (4.15.1). Lưu một thiết bị với giá trị giữ chỗ đó thì giữ mật khẩu đã lưu.
- **Các thiết lập thăm dò là `HOTLOOP_POLL_INTERVAL`, `HOTLOOP_MIN_POLL_INTERVAL` và `HOTLOOP_POLL_TIMEOUT`.** Màn hình Cài đặt cũ bảo bạn đặt `HOTLOOP_POLL_INTERVAL_MS`, `HOTLOOP_MIN_POLL_INTERVAL_MS` và `HOTLOOP_TIMEOUT_MS`, mà không thứ gì từng đọc. Nếu bạn đã đặt chúng thì chúng không làm gì. Hãy đổi tên.
- **Tag OPC UA bạn đã nhập giữ kiểu lúc nhập.** Khám phá tag từng coi mọi nút là float. Giờ nó đọc kiểu thật của từng nút, nhưng tag nhập trước đó vẫn giữ `float`, và máy chủ OPC UA của chính HotLoop phát hành một tag theo kiểu đã khai báo, nên một tag văn bản tới Ignition dưới dạng `Bad_TypeMismatch`. Hãy khai báo các tag văn bản là `string`.
- **Edge publish giờ có khối giá trị.** Nếu bạn đặt nó qua `extraEnv`, hãy chuyển sang `edgePublish:` và bỏ các biến, nếu không chúng bị đặt hai lần.
- **Máy chủ OPC UA nói `HotLoop`** là nhà sản xuất, trong khi các bản trước dùng một tên nhà sản xuất khác. Nếu một client hay script kiểm kê so khớp chuỗi đó, hãy đổi trước khi nó thôi khớp.
- **Giấy phép.** Điều khoản đã thay đổi sau 4.3.1. Điều khoản hiện hành nằm ở [trang Giấy phép]({{LICENSE_URL}}).

### Thay đổi API từ 4.3.1

Nếu bạn có script hay tích hợp gọi API, đây là danh sách. Mọi thứ khác là bổ sung. Các thay đổi từ 4.16.0 đến 4.17.0 [ở trên](#một-script-gọi-api-sẽ-nhận-thấy-gì) cộng thêm vào, và các thay đổi từ 4.17.0 đến {{hotloop}} [bên trên nữa](#thay-đổi-api-từ-4170) cũng vậy.

- **Danh sách rỗng là `[]`, không bao giờ `null`,** trong mọi phản hồi và mọi sự kiện luồng, ở mọi độ sâu. `GET /api/runs`, các tự động hóa, tag của một thiết bị, nhật ký kiểm toán ghi, người dùng, sự kiện báo động, sparkline và một cửa sổ lịch sử trống từng đều trả `null`. Một `null` bạn vẫn thấy không bao giờ là danh sách; nó là một trường cho phép null đã được ghi tài liệu, như `equipment_id` của một thực thể.
- **Các bucket của `/api/history` không có số đo tốt là `null`,** và được vẽ thành khoảng trống, còn số đo xấu nằm ngoài trung bình của xu hướng. Một xu hướng và một báo cáo cho cùng một giờ giờ nói cùng một điều.
- **Một lỗi mà API không xác định được là 500** kèm một tham chiếu vào nhật ký máy chủ, không phải 400. Một thiết bị gặp lỗi khi ghi hay duyệt là 502. [Cổng ghi](/vi/gateway/write-gate/#mỗi-từ-chối-trả-lời-gì) có mọi trạng thái mà một lần ghi có thể nhận.
- **`alarm.turn_on`, và mọi dịch vụ khác mà một thực thể báo động không nhận, là 400** ("unknown service"). Trước đây nó trả về thành công và không làm gì, đó là câu trả lời tệ nhất có thể.
- **Bỏ hoãn một báo động chưa bị hoãn là 409.** Trước đây nó đặt báo động về bình thường bất kể đang ở trạng thái nào, có thể xóa khỏi danh sách một báo động đã hết nhưng chưa xác nhận, chính báo động mà ISA-18.2 sinh ra để giữ lại trong danh sách.
- **JSON của tag luôn mang `minValue`, `maxValue` và `hasRange`,** và chỉ riêng `hasRange` cho biết có dải hay không. Một dải bắt đầu từ 0 từng trông như không có giá trị nhỏ nhất.
- **Mới: `?dry_run=true` trên `POST /api/services/{domain}/{service}`.** Nó chạy các kiểm tra của cổng, không ghi gì, không kiểm toán gì, và trả lời bằng lời từ chối mà lệnh gọi thật sẽ đưa ra. `dry_run` nhận `true` hoặc `false` và không gì khác; `yes` là 400, vì đoán sai hướng biến một câu hỏi thành một mệnh lệnh.
- **`GET /api/settings`** nêu tên biến mà một giá trị thực sự đến từ đó trong `envVar`, kể cả các biến dự phòng, và một biến đặt thành chuỗi rỗng được coi là chưa đặt.

[Ghi chú phát hành](https://hotloop.io/releases/core/) có phần còn lại của những gì đã thay đổi, từng phiên bản lùi về 4.4.0. Khi bạn đã lên 4.16.0 mà historian vẫn đầy, hãy làm [Nâng cấp từ 4.16.0](#nâng-cấp-từ-4160), rồi [Nâng cấp từ 4.17.0](#nâng-cấp-từ-4170).
