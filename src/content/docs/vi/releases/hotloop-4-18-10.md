---
title: "Ghi chú phát hành: HotLoop core 4.18.10"
description: "HotLoop core 4.18.10 có gì mới, điều gì thay đổi khi nâng cấp và nên đọc gì trước khi đụng vào một nhà máy đang chạy."
sidebar:
  label: "4.18.10"
---

Bản phát hành mà HotLoop thôi chỉ là một image. IoT, Edge, Gateway và Edge Relay đều ra từ cùng một tag này, đồng bộ với nhau, mỗi sản phẩm có image và chart riêng. Ngoài ra: thiết bị tự khai báo qua MQTT, lịch sử được ghi vào cơ sở dữ liệu của chính nhà máy, cơ sở dữ liệu do bạn chọn (SQLite, Postgres hoặc TimescaleDB), một Edge vẫn chạy khi WAN chết, và các hộp bám theo `:stable` rồi tự hoàn tác một bản cập nhật hỏng. Từ 4.17.0, Gateway chỉ cần một lệnh `helm upgrade` bình thường. Hãy đọc mục «Nâng cấp từ 4.17.0» bên dưới trước khi đụng vào một nhà máy đang chạy, vì vài giá trị mặc định đã dịch chuyển.

Không có 4.18.0, 4.18.1, 4.18.2, 4.18.3, 4.18.4, 4.18.5, 4.18.6, 4.18.7 hay 4.18.9 để cài, và 4.18.8 không phải bản để chạy. Chín trong số các tag đó không công bố gì cả. 4.18.8 để lại các image trên ghcr.io mà không có chart và không có release, đồng thời dời `:stable` và `:latest` của Gateway, Edge Relay và IoT, nên một hộp bám theo `:stable` có thể đã chạy 4.18.8 cho đến khi nó cập nhật. 4.18.10 thay thế nó và mang mọi bản sửa từ các tag đó. Giá trị của một thiết bị được phát hiện có thể bị đóng dấu thời gian cũ hơn chính số đọc «chưa có gì» của nó, và bộ nhớ đệm bỏ nó đi. Bảng điều khiển thôi vẽ lại một đồng hồ đo không thay đổi. Broker tích hợp trong HotLoop từng từ chối subscription của một listener khi id gói tin của nó trùng với id của một tin nhắn đang gửi cho chính client đó, nên thiết bị sau subscription ấy không bao giờ được phát hiện; và một client publish với cùng id gói tin như một tin nhắn QoS 1 hoặc 2 mà broker còn nợ nó sẽ khiến broker bỏ chính tin nhắn của mình và không bao giờ gửi lại sau khi kết nối lại. Giờ broker giữ hai chiều trong các bảng riêng, và một broker từ chối subscription sẽ ghi điều đó vào log. Một bảng điều khiển còn đang tải không còn ghi địa chỉ của nó đè lên địa chỉ mà người dùng vừa chuyển tới. Nếu điện thoại của bạn đăng nhập ntfy bằng mật khẩu của cùng địa chỉ mà HotLoop publish, hãy cấp cả tier cho người dùng đó. 4.18.10 là mọi thứ mà 4.18.0 định trở thành, cộng với những gì thay đổi kể từ khi tag 4.18.3 được tạo.

Ghi chú đầy đủ nằm trong README: Những gì thay đổi trong 4.18.10.

## Tóm tắt

- Cùng bốn image, cùng các tag, cùng các kiến trúc.
- **Kể từ khi tag 4.18.4 được tạo.** Giá trị của một thiết bị được phát hiện có thể bị mất sau chính số đọc «chưa có gì» của nó, và giờ thì không còn. Một thiết bị UPnP có mô tả không đọc được sẽ được đọc lại trong vài giây, không phải sau 15 phút. OK trong trình soạn thẻ hoạt động ngay lần nhấp đầu tiên, Save trong ngăn kéo thực thể đứng yên, bảng điều khiển thôi vẽ lại những gì không đổi, và một bộ đếm bị hai tiến trình đập liên tục không còn từ chối bên cứ thua mãi.
- **Giấy phép đã thay đổi.** Cả bốn sản phẩm nay thuộc Business Source License 1.1 của HotLoop. Dùng ở nhà và phòng thí nghiệm là miễn phí, trường học, tổ chức phi lợi nhuận và cơ quan nhà nước cũng vậy, còn dùng cho doanh nghiệp thì qua EmberNet. Mỗi phiên bản trở thành GPL-3.0 trở lên bốn năm sau lần phát hành đầu. Cho đến lúc đó nó không phải mã nguồn mở, và tôi sẽ không giả vờ là có. Hãy đọc LICENSE trước khi đưa nó vào một nhà máy.
- **Kể từ khi tag 4.18.3 được tạo.** UniFi trên bảng treo tường và điện thoại: bản đồ mạng phóng to và chụm được, độ trễ WAN và lưu lượng cổng có đồ thị, và một nút tạo ra các cảnh báo thường dùng. Một agent có thể hỏi qua MCP bản đồ của mạng (`get_network_topology`) và điều bảng điều khiển vừa nói (`get_network_events`). Logbook hiển thị sự kiện UniFi dưới switch mà chúng liên quan. Một thiết bị MQTT có thể có hai client cùng id, và broker lần lượt đá từng cái; đã sửa. Thông điệp cảnh báo in giá trị như thẻ giá trị, thẻ cảnh báo có thể trỏ tới thiết bị hoặc thiết bị máy, và xu hướng của một tag đứng yên là một đường ngang suốt cửa sổ.
- **Bốn sản phẩm, bốn image, bốn chart, một tag.** `hotloop-iot` và `hotloop-edge` là mới trên ghcr.io và trong kho chart. Gateway giữ `ghcr.io/hotloop-io/hotloop` và chart `hotloop`, nên ai đang chạy nó không phải đổi gì. Một sản phẩm là một bản build, không phải một thiết lập: máy chủ OPC UA không bị tắt trong image IoT, nó không có trong đó. Xem [trang sản phẩm](/vi/products/).
- **Khám phá MQTT.** Trỏ ESPHome, Zigbee2MQTT, Tasmota hoặc Shelly vào broker và nó xuất hiện, đã đang đọc. Nó không thể ra lệnh gì cho đến khi quản trị viên chấp nhận và tự tay kích hoạt từng điểm. Khám phá mạng (mDNS, SSDP, DHCP) chỉ lắng nghe và không gửi gì, trừ khi bạn liệt kê một mạng để thăm dò.
- **Đích historian.** Mỗi số đọc HotLoop giữ cũng đi tới PostgreSQL, TimescaleDB, SQL Server, InfluxDB hoặc MySQL/MariaDB của chính nhà máy, cùng các hàng với cùng chất lượng.
- **Cơ sở dữ liệu là một thiết lập.** SQLite, PostgreSQL hoặc TimescaleDB cho mỗi sản phẩm, từ cùng một binary. Một chiếc Pi không cần image cơ sở dữ liệu 300 MB.
- **Edge giữ nhà máy chạy khi WAN chết**, và hàng đợi lưu và chuyển tiếp của nó sống sót qua các trường hợp xấu: khởi động trong lúc mất kết nối, một liên kết chết mà không reset, một lần phát lại phải chạy nhanh hơn nhà máy.
- **Mỗi hộp bám theo `:stable` và tự cập nhật**, và một bản phát hành không khởi động được sẽ bị hoàn tác. Migration chỉ bổ sung, và một ứng dụng từ chối khởi động trên schema đi trước nó hai bản phát hành, nên việc hoàn tác đó luôn an toàn.
- **Edge Relay** áp dụng ngay một cấu hình được đẩy tới, không cần khởi động lại và không mất phiên Sparkplug, và phát hiện thiết bị trên một broker như Gateway.
- **Mỗi image mang mọi giấy phép của bên thứ ba**, và một module GPL sẽ dừng bản build.
- **Mặt trời.** Bình minh, hoàng hôn và độ cao mặt trời, tính ngay trên hộp từ vĩ độ và kinh độ.

### Thay đổi API

- Route mới: `/api/discovery`, `/api/network-discovery`, `/api/mqtt/brokers`, `/api/broker/logins`, `/api/historian/targets`, `GET /api/entities/{entity_id}/image` và `POST /api/fleet/{id}/update`. Tất cả có trong docs/API.md.
- `GET /api/status` cho biết `product` và `features`, cùng digest của image. Route của một tính năng mà sản phẩm bạn đang nói chuyện không có sẽ trả lời `404` kèm sản phẩm có tính năng đó, thay vì giả vờ. Mọi route vẫn có trong mọi sản phẩm.
- Quyền mới `fleet.update`, chỉ dành cho quản trị viên. Vai trò operator không đổi.

### Nâng cấp từ 4.17.0

- `helm upgrade <release> hotloop/hotloop --version 4.18.10 --reset-then-reuse-values`. Chúng tôi đã render song song chart Gateway 4.17.0 và 4.18.10: cùng tám đối tượng, cùng selector, cùng volume claim. Lần này `--reuse-values` trơn cũng render được, nhưng nó phát lại các giá trị của 4.17.0 và làm mất mọi giá trị mặc định mới, nên hãy dùng dạng reset hoặc tệp values của bạn.
- Các migration từ 0016 đến 0024 chạy khi khởi động (khám phá MQTT, login của broker, nguồn MQTT, đích historian, phát hiện mạng, hai cái nữa cho những gì nguồn MQTT nói, bảng lưu các bảng điều khiển, và một cột `no_data` trên tag, trống với mọi tag đã tồn tại). Tất cả đều là bổ sung. `pg_dump` trước, như mọi khi.
- **`edgePublish.queueMaxBytes` giờ mặc định 64 MiB, không còn là không giới hạn.** Vượt mức đó, các số đọc cũ nhất bị bỏ và được đếm. Hàng đợi không giới hạn làm đầy volume khi mất kết nối lâu, thế còn tệ hơn, nhưng đây là một giá trị mặc định đã đổi: hãy chọn cỡ theo tốc độ đọc của chính bạn (khoảng 180 byte mỗi số đọc) hoặc đặt `0` để giữ hành vi cũ. Nâng cấp bằng `--reuse-values` giữ nguyên những gì bạn đang có.
- **Login của broker.** Các login bạn tạo trong Settings, MQTT mang các quy tắc topic từ một profile. Các login từ `HOTLOOP_BROKER_USERS` không bị đụng tới và làm được mọi thứ, y như trước. Một broker không có `HOTLOOP_BROKER_USERS` giờ khởi động được, và chỉ HotLoop cùng các login tạo trong nó được vào.
- Từ giờ ứng dụng cũng đếm xem cơ sở dữ liệu của nó đi trước bao xa và từ chối đích danh khi cách hai bản phát hành, để việc hoàn tác không bao giờ là một bất ngờ.
- **Edge Relay:** cũng nâng cấp nó bằng `--reset-then-reuse-values`. Người dùng Quadlet lấy `edge-relay.container` mới, bám theo `:stable` thay vì ghim 4.17.0, và healthcheck khiến một bản cập nhật hỏng bị hoàn tác.
- **Các unit Quadlet cho IoT, Edge và Gateway là mới.** 4.17.0 chỉ có unit của relay. Chúng nằm dưới `deploy/quadlet/`, mỗi sản phẩm một thư mục.
