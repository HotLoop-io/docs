---
title: "Broker MQTT tích hợp sẵn"
description: "Một broker chạy trong cùng tiến trình, để một thiết bị nhỏ có thể là toàn bộ bản cài đặt, với các listener, tài khoản và các cài đặt bật nó lên."
---

HotLoop có thể chạy broker MQTT của riêng nó ngay trong tiến trình, từ 4.11.0, nên một bản cài HotLoop nhỏ trên một máy không có gì thêm để triển khai. Mặc định bật (`HOTLOOP_BROKER_ENABLED`), trong tệp nhị phân và trong Helm chart. Nó lắng nghe ở :1883; nếu cổng đó đang bị một broker khác trên máy dùng, broker nhúng sẽ nghỉ và ghi điều đó vào log, và HotLoop vẫn khởi động (hãy đặt `HOTLOOP_BROKER_LISTEN_ADDR` thành một địa chỉ còn trống, hoặc tắt nó). Một cổng bạn đã chọn mà không bind được vẫn là lỗi: một lần triển khai đang chạy Mosquitto hoặc EMQX không có gì để trỏ cái này tới, và khởi động broker thứ hai cạnh một broker đã có không phải là mặc định an toàn để đoán mò.

## Vì sao nó có mặt

Xuất bản ở edge (Gateway đóng vai nút edge Sparkplug) và quản lý đội thiết bị (theo dõi các edge relay đã đăng ký) đều kết nối *ra ngoài* tới một broker MQTT qua `BrokerAddress`, và chưa bao giờ tự chạy broker. Điều đó ổn khi hệ thống đã có broker, dù là một Mosquitto sẵn có hay một broker chạy cạnh HotLoop vì lý do khác. Nhưng không ổn nếu đó là lựa chọn *duy nhất*: dự án này tồn tại để giảm số bộ phận chuyển động mà một nhà máy phụ thuộc vào, và việc đòi hỏi thêm một phần hạ tầng chỉ để có trung tâm Sparkplug cho một Gateway sẽ là đưa một bộ phận chuyển động trở lại bằng cửa sau.

Với `HOTLOOP_BROKER_ENABLED=true`, chính tiến trình này lắng nghe các kết nối MQTT trên địa chỉ của nó. Xuất bản ở edge, quản lý đội thiết bị, hoặc `HOTLOOP_EDGE_PUBLISH_BROKER` của một edge relay bên ngoài đều có thể trỏ tới `localhost:1883` (trong cụm, là địa chỉ Service của chính Gateway).

## Khi nào dùng, khi nào không

**Hãy dùng nó** cho một Gateway, một số ít edge relay và lưu lượng mà một broker tích hợp, dùng chung tiến trình với historian, bộ máy cảnh báo và HTTP API, có thể xử lý thoải mái, trường hợp phổ biến mà toàn bộ dự án này nhắm tới: một nhà máy, một thiết bị, hạ tầng tối thiểu.

**Đừng dùng nó** thay cho broker cấp sản xuất ở quy mô thật: nhiều ứng dụng host Sparkplug độc lập, phân phối tới rất nhiều bên nhận, cầu nối giữa các site, hoặc tải cần clustering, mở rộng theo chiều ngang hay các công cụ vận hành riêng của một broker (số đo chi tiết, ACL động, hệ sinh thái plugin) đều là lý do chính đáng để chạy Mosquitto, EMQX hay một broker chuyên dụng khác, và trỏ `EdgePublishConfig`/`FleetConfig` của chính Gateway tới đó như mọi hệ thống khác đã có thể làm. Gói này không cạnh tranh với trường hợp sử dụng đó; nó tồn tại cho những hệ thống mà nếu không sẽ không có broker nào cả.

## Đăng nhập, và mỗi loại được chạm vào đâu

Có ba loại đăng nhập được vào, và chúng không ngang nhau.

**Đăng nhập tạo trong HotLoop** (Settings, MQTT, hoặc `/api/broker/logins` trong [HTTP API](/vi/iot/api/)) mang theo các quy tắc: những topic mà đăng nhập được phép xuất bản và những topic nó được phép đăng ký. `%u` trong một quy tắc là tên của chính đăng nhập và `%p` là tiền tố khám phá. Chúng bắt đầu từ một hồ sơ và bạn có thể chỉnh sửa sau đó:

| Hồ sơ | Xuất bản | Đăng ký | Dành cho |
|---|---|---|---|
| `shelly` | `%u/#`, `shellies/announce` | `%u/#`, `shellies/command`, `%p/status` | Shelly Gen2 trở lên, đăng nhập đặt theo tiền tố topic MQTT của nó |
| `esphome` | `%u/#`, `%p/+/%u/+/config`, `esphome/discover/%u` | `%u/#`, `%p/status`, `esphome/discover` | một nút ESPHome, đăng nhập đặt theo tên nút |
| `tasmota` | `tele/%u/#`, `stat/%u/#`, `tasmota/discovery/+/config`, `tasmota/discovery/+/sensors` | `cmnd/%u/#`, `cmnd/tasmotas/#` | một thiết bị Tasmota, đăng nhập đặt theo topic của nó |
| `zigbee2mqtt` | `%u/#`, `%p/#` | `%u/#`, `%p/status` | một cầu nối Zigbee2MQTT, đăng nhập đặt theo topic gốc của nó |
| `integration` | không có gì | `#` | một bảng điều khiển, một historian, bạn với MQTT Explorer |
| `full` | `#` | `#` | bất cứ thứ gì, toàn bộ nhà máy |

Đặt tên đăng nhập của một Shelly theo tiền tố topic của nó thì nó có thể tự thông báo và báo cáo với tư cách chính nó, và chỉ vậy thôi. Nó không thể xuất bản tới `cmnd/boiler/POWER`, không thể thông báo một thiết bị dưới tên người khác và không thể đăng ký `#` để đọc cả nhà máy. Broker kiểm tra mọi lần xuất bản, mọi đăng ký và mọi thông điệp trên đường tới bên đăng ký, nên một quy tắc không thể bị kéo giãn bằng một ký tự đại diện khôn khéo. Last will cũng được kiểm tra khi client kết nối: thư viện broker xuất bản will mà không hỏi ai, nên một đăng nhập có will trỏ tới nơi nó không được phép xuất bản sẽ không vào được. Nếu không, một ổ cắm rẻ tiền có thể để lại một `ON` được giữ lại trên nồi hơi rồi tự rút dây nguồn.

Thay đổi trên một đăng nhập có hiệu lực từ gói tin kế tiếp của client đó. Thu hẹp một đăng nhập và thiết bị đang kết nối mất các topic ngay lúc đó; xóa một đăng nhập và client vẫn còn treo đó không thể làm gì cả, và không thể kết nối lại. Mật khẩu là băm bcrypt trong `broker_logins`, nằm trong mọi bản sao lưu; API không bao giờ trả lời bằng cái nào trong hai thứ đó.

Zigbee2MQTT là trường hợp đặc biệt: một cầu nối thông báo mọi thiết bị trên sóng vô tuyến của nó, nên hồ sơ của nó có thể xuất bản ở bất cứ đâu dưới tiền tố. Đó là việc của cầu nối, và là lý do màn hình Discovered cho thấy ai đã thông báo gì.

**`HOTLOOP_BROKER_USERS`** là danh sách cũ các cặp `user:password` (chỉ dấu hai chấm đầu tiên là dấu tách, nên mật khẩu có thể chứa một dấu). Các đăng nhập này có thể làm mọi thứ, trên mọi topic, y như 4.16 và 4.17. Đó là cố ý: không ai nâng cấp vào một nhà máy mà lưu lượng Sparkplug đột nhiên bị chặn bởi một ACL họ chưa từng viết. Điều đó cũng có nghĩa mỗi đăng nhập này là một chìa khóa cho cả nhà máy. Hãy chuyển thiết bị sang các đăng nhập tạo trong HotLoop và giữ các đăng nhập từ biến môi trường cho những thứ thật sự cần tất cả: đội thiết bị, một edge relay, bộ xuất bản edge. Được kiểm tra trong thời gian không đổi; tên người dùng với mật khẩu sai bị từ chối.

**Ẩn danh** (`HOTLOOP_BROKER_ALLOW_ANONYMOUS`, mặc định `false`) là bất cứ thứ gì, cho bất kỳ ai có thể tới được cổng. Đó là lựa chọn bật riêng cho từng hệ thống, dành cho mạng LAN đáng tin cậy hoặc giàn thử nghiệm, không bao giờ là điều tiến trình này tự quyết định là ổn, và màn hình Discovered nói điều đó bằng màu đỏ khi nó đang bật. Nó không nới lỏng gì cho client có gửi tên người dùng: mật khẩu sai vẫn là mật khẩu sai.

Broker không có `HOTLOOP_BROKER_USERS` và tắt ẩn danh vẫn khởi động bình thường. Cho đến khi ai đó tạo một đăng nhập trong HotLoop, thứ duy nhất có thể kết nối là HotLoop.

Các broker khác là việc của chúng. Trên Mosquitto hoặc EMQX, ACL do broker đó thực thi, cùng ranh giới mà [quản lý đội thiết bị](/vi/gateway/fleet/) vạch ra, và [khám phá MQTT](/vi/iot/mqtt-discovery/) có một ACL cho đăng nhập riêng của HotLoop ở đó.

## Khám phá, và đăng nhập riêng của HotLoop

Khi broker bật, HotLoop lắng nghe trên đó các thiết bị tự thông báo (xem [khám phá MQTT](/vi/iot/mqtt-discovery/)). Broker ghi lại đăng nhập nào và client nào đã xuất bản từng cấu hình khám phá. Màn hình Discovered hiển thị điều đó, và một thiết bị đã chấp nhận từ một đăng nhập mà được thông báo bởi đăng nhập khác sẽ bị giữ lại cho một người, kèm cảnh báo trong nhật ký ("Kitchen re-announced by login garage-node; it was accepted from kitchen-node"). Hoặc ai đó đã chuyển thiết bị sang đăng nhập mới, hoặc một đăng nhập đang giả làm thiết bị không phải của nó. Một người quyết định là trường hợp nào.

Client riêng của HotLoop trên broker này (bộ lắng nghe khám phá và các trình điều khiển của thiết bị được khám phá) đăng nhập bằng một đăng nhập mà broker tạo ra ở mỗi lần khởi động và chỉ giữ trong bộ nhớ. Nó có thể làm mọi thứ. Không có gì để cấu hình cho nó, không có gì trên đĩa và không có gì trong bản sao lưu; sau mỗi lần khởi động lại nó là một đăng nhập khác.

## TLS

Một listener TCP thường (`HOTLOOP_BROKER_LISTEN_ADDR`, mặc định `:1883`) luôn có sẵn khi broker được bật. Đặt `HOTLOOP_BROKER_TLS_ENABLED=true` cùng `HOTLOOP_BROKER_TLS_CERT_FILE` và `HOTLOOP_BROKER_TLS_KEY_FILE` sẽ thêm một listener thứ hai, độc lập (`HOTLOOP_BROKER_TLS_LISTEN_ADDR`, mặc định `:8883`) được kết thúc bằng chứng chỉ đó. Cả hai listener chạy cùng lúc khi bật TLS, không có gì đóng listener không mã hóa, nên người vận hành muốn chỉ truy cập qua TLS sẽ thực thi điều đó ở tầng mạng (một NetworkPolicy, một quy tắc tường lửa), giống cách chart này vốn đã để các quyết định phơi bày mạng rộng hơn cho `networkPolicy.ingress` thay vì để ứng dụng tự quyết định cổng nào của nó được truy cập.

Khác với việc nâng cấp STARTTLS ngay trong một kết nối của kênh SMTP, listener TLS của broker là một socket thứ hai, riêng biệt, cùng hình thức mà Mosquitto, EMQX và hầu hết các broker MQTT dùng cho một cổng không mã hóa đặt cạnh một cổng TLS, và là lựa chọn tự nhiên hơn cho MQTT, vốn (không như SMTP) không có cách nâng cấp trong kết nối được triển khai rộng rãi.

Gói này không tạo chứng chỉ riêng, tự ký hay loại nào khác, vì không thành phần phía sau nào sẽ tin một chứng chỉ do nó tự bịa ra, nên chứng chỉ thật (từ CA nội bộ, `cert-manager` hoặc nguồn khác) luôn do người vận hành cung cấp.

## Cấu hình

| Biến | Mặc định | <span class="sr-only">Details</span> |
|---|---|---|
| `HOTLOOP_BROKER_ENABLED` | `false` | Tính năng tắt cho đến khi đặt biến này |
| `HOTLOOP_BROKER_LISTEN_ADDR` | `:1883` | Listener TCP không mã hóa |
| `HOTLOOP_BROKER_TLS_ENABLED` | `false` | Thêm listener TLS thứ hai, độc lập |
| `HOTLOOP_BROKER_TLS_LISTEN_ADDR` | `:8883` | Chỉ dùng khi bật TLS |
| `HOTLOOP_BROKER_TLS_CERT_FILE` / `_KEY_FILE` | n/a | Bắt buộc khi bật TLS |
| `HOTLOOP_BROKER_ALLOW_ANONYMOUS` | `false` | Lựa chọn bật riêng cho từng hệ thống; đừng bao giờ đặt nó làm mặc định |
| `HOTLOOP_BROKER_USERS` | không có | `user:password,user2:password2`. Mỗi cái có thể làm mọi thứ; xem ở trên. Đăng nhập có quy tắc được tạo trong HotLoop |
| `HOTLOOP_BROKER_DISCOVERY` | `true` | Lắng nghe các thiết bị tự thông báo; xem [khám phá MQTT](/vi/iot/mqtt-discovery/) |
| `HOTLOOP_BROKER_DISCOVERY_PREFIX` | `homeassistant` | Tiền tố topic mà các thông báo đến dưới đó |

## Những gì đã được xác minh và chưa được xác minh

HotLoop đã được chạy với thiết bị thật và máy chủ thật, và trên phần cứng thật vào 2026-11-17.
