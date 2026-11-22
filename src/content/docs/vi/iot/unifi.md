---
title: "Mạng UniFi"
description: "Switch, cổng, PoE, dự phòng WAN và client từ bảng điều khiển UniFi dưới dạng tag thông thường, có màn hình, sự kiện và lệnh luôn tắt cho đến khi kích hoạt."
---

Mạng của nhà máy cũng là thiết bị. Khi một PLC im lặng, câu hỏi đầu tiên là "do PLC hay do cổng switch nó đang cắm vào", và cho đến nay câu trả lời nằm trong ứng dụng UniFi trên điện thoại của ai đó. Vì vậy HotLoop đọc trực tiếp bảng điều khiển UniFi: mọi switch, mọi cổng, mức tiêu thụ PoE, các đường WAN và tình trạng của site, dưới dạng tag thông thường. Nhờ đó, cảnh báo, xu hướng, thực thể, tự động hóa, OPC UA và MCP đều hoạt động trên các tag này mà không cần biết UniFi tồn tại.

Phần này nói về trình điều khiển, phần giám sát OT chạy trên đó, các màn hình, luồng sự kiện và những lệnh đầu tiên (U1 đến U5 trong [lộ trình](/vi/roadmap/)). **Nó đọc mạng, và chỉ thay đổi mạng khi có người đã kích hoạt một tag cho việc đó.** Mọi tag đều được tạo ở chế độ chỉ đọc. Một vài điểm là lệnh (bên dưới, "Lệnh") đi qua cổng ghi như mọi tag: không có gì gửi lệnh cho đến khi ai đó đánh dấu tag đó là ghi được, và tài khoản bảng điều khiển ở chế độ View Only sẽ bị chính bảng điều khiển từ chối. Với mọi thứ trừ lệnh, tài khoản được dùng có thể là View Only.

## Thêm bảng điều khiển

Một thiết bị HotLoop là **một site trên một bảng điều khiển**. Cloud Gateway và Express phía sau nó là hai bảng điều khiển, tức hai thiết bị, với hai lần đăng nhập, vì mỗi bảng điều khiển có tài khoản cục bộ riêng.

1. **Tạo một tài khoản cục bộ trên bảng điều khiển.** Settings, Admins & Users, Add Admin, đánh dấu **Restrict to Local Access Only**, vai trò **View Only**. Tài khoản đám mây của Ubiquiti không thể đăng nhập từ bất kỳ nơi nào ngoài ứng dụng: nó yêu cầu MFA, và bảng điều khiển trả lời script bằng 403. Tài khoản của chúng tôi tên là `hotloop-ro`.
2. **Thêm thiết bị.** Giao thức `unifi`, địa chỉ là URL của bảng điều khiển: `https://host` cho bảng điều khiển chạy UniFi OS (Cloud Gateway, Dream Machine, UniFi OS Server), `https://host:8443` cho Network Application tự lưu trữ. Chu kỳ thăm dò 15 giây là hợp lý; trình điều khiển không bao giờ đọc một bảng điều khiển thường xuyên hơn một lần mỗi 10 giây, bất kể giá trị được đặt là bao nhiêu.
3. **Lưu mà không có dấu vân tay.** Lần kết nối đầu tiên thất bại, có chủ ý, kèm dấu vân tay của chứng chỉ mà bảng điều khiển đưa ra. Hãy kiểm tra xem đó có đúng là bảng điều khiển của bạn không (bảng điều khiển hiển thị chứng chỉ của nó, hoặc `openssl s_client -connect host:443` chuyển qua `openssl x509 -pubkey -noout | openssl pkey -pubin -outform der
   | sha256sum` cho cùng kết quả), dán vào `certFingerprint` rồi lưu.
4. Các tag tự được tạo ở lần thăm dò kế tiếp. Xem bên dưới.

Thiết bị UniFi chỉ lưu được khi HotLoop có khóa để mã hóa mật khẩu (`HOTLOOP_SECRET_KEY_FILE`, do chart tự thiết lập). Xem [Sao lưu và khôi phục](/vi/iot/backup/#device-credentials-and-the-secret-key).

| Tùy chọn | Mặc định | Công dụng |
|---|---|---|
| `site` | `default` | Tên ngắn của site, tên xuất hiện trong URL của bảng điều khiển. `default` là site đầu tiên của mọi bảng điều khiển |
| `username`, `password` | bắt buộc | Tài khoản cục bộ. Mật khẩu chỉ ghi được qua API và được mã hóa trong cơ sở dữ liệu |
| `certFingerprint` | không có | SHA-256 của khóa công khai trong chứng chỉ của bảng điều khiển, dạng hex. Dấu hai chấm, khoảng trắng và chữ hoa đều được |
| `caFile` | không có | Tin cậy một CA thay vì ghim, dùng cho bảng điều khiển có chứng chỉ thật |
| `insecureSkipVerify` | `false` | Tin mọi chứng chỉ. Dành cho bàn thử nghiệm, không bao giờ dùng cho nhà máy |
| `clientTimeoutSec` | `90` | Sau lần cuối bảng điều khiển thấy một client, bao lâu thì client đó vẫn được tính là có trên mạng. Tối thiểu 30. Xem [client](#client-mạng-ot-và-nơi-plc-được-cắm-vào) |

### Vì sao chứng chỉ được ghim

Bảng điều khiển xuất xưởng với chứng chỉ tự ký, và cách làm lười là bỏ qua bước xác minh. Điều đó chấp nhận được khi chỉ đọc một đồng hồ đo. Nhưng không chấp nhận được với một tài khoản đăng nhập thấy được toàn bộ mạng nhà máy và, từ các PR ghi trở đi, có thể tắt bật nguồn các cổng. Một bảng điều khiển đã ghim mà đưa ra chứng chỉ khác sẽ bị từ chối ngay trong quá trình bắt tay TLS, **trước khi tên đăng nhập hoặc mật khẩu được gửi đi**, và lỗi nêu tên cả hai dấu vân tay. Ghim đặt trên khóa công khai, nên bảng điều khiển cấp lại chứng chỉ với cùng khóa vẫn tiếp tục hoạt động.

Không có kiểu "trust on first use" âm thầm. Thời điểm duy nhất mà việc tin một chứng chỉ có ý nghĩa là khi có người đang nhìn nó, và đó là lúc việc này diễn ra.

## Đăng nhập: một lần, và không đăng nhập lại trừ khi bắt buộc

Đăng nhập ở mỗi lần kiểm tra đã khiến Cloud Gateway của chính chúng tôi trả lời 429 và khóa tài khoản. Hai lần. Vì vậy:

- **Một phiên cho mỗi bảng điều khiển trong mỗi tiến trình.** Mọi lần thăm dò, và mọi site trên bảng điều khiển, dùng chung một lần đăng nhập. Hai thiết bị cho hai site trên cùng một bảng điều khiển với cùng một tài khoản là một phiên.
- **Chỉ đăng nhập lại khi bảng điều khiển báo phiên đã mất** (401), mỗi lần một bên gọi, và **không bao giờ quá một lần mỗi phút**, dù có chuyện gì xảy ra. Một phiên chết hai lần trong vòng một phút sẽ khiến thiết bị đọc ở trạng thái xấu cho đến hết phút đó, và đó là sự đánh đổi chúng tôi muốn.
- **Đăng nhập bị từ chối thì không thử lại.** Sai mật khẩu, tài khoản đám mây hoặc bị khóa 429 sẽ chờ ít nhất năm phút, lâu hơn nếu `Retry-After` của bảng điều khiển yêu cầu, và lỗi của thiết bị nói rõ là trường hợp nào. Tắt rồi bật lại thiết bị không mua thêm được lần thử: tiến trình ghi nhớ.
- **Nó đăng xuất** khi thiết bị cuối cùng dùng bảng điều khiển dừng lại, để các lần khởi động lại không chất đống phiên trên bảng điều khiển.
- **Trình hỗ trợ `--mcp-stdio` không bao giờ đăng nhập.** Nó chạy cạnh Gateway, nơi đã giữ phiên, và lần đăng nhập thứ hai từ cùng một máy chính là thứ gây ra 429. Các thiết bị UniFi của nó ở trạng thái ngừng tại đó trong khi chúng vẫn chạy trong Gateway.

## Tag

Mọi tag đều do trình điều khiển tạo, chỉ đọc cho đến khi có người kích hoạt, và được đặt tên theo địa chỉ MAC và số cổng, không bao giờ theo tên hiển thị, nên việc đổi tên switch trong ứng dụng UniFi không làm hỏng gì. `<mac>` là MAC của thiết bị bằng chữ thường, không có dấu phân cách, `<nn>` là số cổng hai chữ số.

| Tag | Kiểu | Ý nghĩa |
|---|---|---|
| `d.<mac>.state` | văn bản | `connected`, `disconnected`, `pending`, `upgrading`, `provisioning`, `heartbeat_missed`, `adopting`, ... |
| `d.<mac>.online` | bool, connectivity | Đã kết nối với bảng điều khiển |
| `d.<mac>.uptime_s` | int, s | Thời gian hoạt động |
| `d.<mac>.cpu_pct`, `.mem_pct` | float, % | CPU và bộ nhớ |
| `d.<mac>.temp_c` | float, °C | Nhiệt độ, trên các thiết bị có cảm biến |
| `d.<mac>.clients` | int | Số client kết nối qua thiết bị |
| `d.<mac>.fw` | văn bản | Phiên bản firmware |
| `d.<mac>.wan<N>.up` | bool, connectivity | WAN N **đang hoạt động** theo kiểm tra tình trạng của chính gateway (`last_wan_interfaces`, rồi `last_wan_status`). Không phải `up` của khối WAN, vốn nghĩa là đã cấu hình. Bảng điều khiển không cung cấp cái nào thì đọc ở trạng thái xấu, không bao giờ là up |
| `d.<mac>.wan<N>.latency_ms` | float, ms | Độ trễ của nó, chỉ tốt khi WAN còn hoạt động |
| `d.<mac>.wan<N>.availability_pct` | float, % | Độ sẵn sàng theo các bộ giám sát của chính gateway trong cửa sổ của nó (một ngày), khi nó báo cáo |
| `d.<mac>.wan.active` | văn bản | WAN nào đang mang lưu lượng: WAN của uplink nếu còn hoạt động, nếu không thì WAN hoạt động đầu tiên, `none` nếu không có cái nào |
| `d.<mac>.wan.failover` | bool, problem | Lưu lượng đi qua WAN khác ngoài WAN đầu tiên: nhà máy đang chạy bằng đường dự phòng |
| `p.<mac>.<nn>.up` | bool, connectivity | Liên kết của cổng |
| `p.<mac>.<nn>.speed_mbps` | int, Mbit/s | Tốc độ liên kết; 0, bình thường, trên cổng không có liên kết |
| `p.<mac>.<nn>.rx_bps`, `.tx_bps` | float, bit/s | Lưu lượng |
| `p.<mac>.<nn>.errors` | int | Lỗi nhận cộng lỗi gửi |
| `p.<mac>.<nn>.poe_w` | float, W, power | Công suất PoE, trên các cổng có thể cấp PoE |
| `p.<mac>.<nn>.poe_mode` | văn bản | `auto`, `off`, `pasv24`, `passthrough` |
| `site.<subsystem>.status` | văn bản | Tình trạng của site: `wan`, `www`, `lan`, `wlan`, `vpn` |
| `site.www.latency_ms` | float, ms | Độ trễ internet, khi được báo cáo |
| `site.network_version` | văn bản | Phiên bản Network mà bảng điều khiển đang chạy |
| `site.events_live` | bool, connectivity | Websocket sự kiện của bảng điều khiển đã kết nối. 0 nghĩa là HotLoop chỉ thăm dò, tốn tốc độ chứ không tốn gì khác |
| `site.last_event` | văn bản | Sự kiện mới nhất mà bảng điều khiển báo cáo về site, bằng lời của chính nó |
| `d.<mac>.last_event` | văn bản | Sự kiện mới nhất về thiết bị đó. Để trống cho đến khi có sự kiện đầu tiên |

Các lớp thiết bị được chuyển sang thực thể, nên liên kết của một cổng hiện ra thành cảm biến nhị phân về kết nối và công suất PoE của nó thành cảm biến công suất mà không ai phải cài đặt.

**Tag tự thêm vào và không bao giờ tự biến mất.** Một switch được adopt vào tuần sau sẽ hiện thành các tag ở lần thăm dò kế tiếp, trong cùng phiên, không cần khởi động lại gì. Một switch bị rút nguồn đọc `online` bằng 0 và các cổng của nó chuyển sang chất lượng xấu, nên cảnh báo trên nó sẽ nói lên điều đó thay vì biến mất theo nó. Xóa các tag của nó là quyết định của con người. Tag mà ai đó đã tắt sẽ vẫn tắt: trình điều khiển không có quyền quyết định.

Chỉ các thiết bị đã adopt mới có tag. Một switch mà ai đó cắm vào nhưng chưa ai adopt thì chưa thuộc mạng của nhà máy. Một điểm mà bảng điều khiển không báo cáo sẽ đọc ở trạng thái xấu, không bao giờ là số không bịa ra: switch không báo cáo công suất PoE có các tag `poe_w` đọc xấu.

Edge Relay cũng có thể thăm dò bảng điều khiển. Nó đọc các tag mà tệp thiết bị của nó khai báo và không thêm tag nào, vì không có nơi để lưu.

## Lệnh

Năm loại điểm là lệnh. Mỗi loại được tạo ở chế độ chỉ đọc như mọi tag khác, và không làm gì cho đến khi ai đó đánh dấu nó là ghi được. Tài khoản mà HotLoop dùng để đăng nhập phải là Administrator cục bộ cho các lệnh này; với View Only, bảng điều khiển trả lời HTTP 403, HotLoop báo như vậy, và không có gì thay đổi.

| Tag | Ghi | Bảng điều khiển làm gì |
|---|---|---|
| `d.<mac>.locate` | `true` hoặc `false` | Nhấp nháy đèn LED của thiết bị cho đến khi tắt. Đọc lại điều bảng điều khiển báo. |
| `d.<mac>.restart` | `true` | Khởi động lại thiết bị vào lần tới nó báo về. `false` không làm gì. Đọc 0. |
| `p.<mac>.<nn>.power_cycle` | `true` | Tắt rồi bật PoE của cổng. `false` không làm gì. Đọc 0. |
| `w.<id>.enabled` | `true` hoặc `false` | Bật hoặc tắt một mạng không dây. Chỉ trường đó được gửi đi, nên mật khẩu wifi và mọi cài đặt khác được giữ nguyên. `<id>` là mã của mạng trong bảng điều khiển, đổi tên không làm nó thay đổi. |
| `c.<mac>.blocked` | `true` hoặc `false` | Chặn một client đang được theo dõi khỏi mạng, hoặc cho nó vào lại. Điểm này tồn tại cho client mà bảng điều khiển đã từng thấy. |

Một chu kỳ nguồn có thể gây hại cho nhà máy (một tự động hóa tắt bật PLC cứ hai phút một lần sẽ làm cháy bộ nguồn của nó), nên hai quy tắc được áp dụng bất kể ai yêu cầu: một cổng được tắt bật nhiều nhất một lần trong 15 phút (thời điểm của chu kỳ cuối được lưu trong cơ sở dữ liệu, nên khởi động lại không làm quên, và chu kỳ mà thời điểm không thể kiểm tra sẽ bị từ chối), và cổng đang mang mạng không bao giờ bị tắt bật. Đó là một uplink, và mọi cổng mà thiết bị khác đang gắn vào, theo cấu trúc mạng của chính bảng điều khiển; cổng cấp nguồn cho đường dự phòng 5G là một trong số đó. Lời từ chối nói rõ là quy tắc nào. Một lệnh mà chính bảng điều khiển từ chối không làm mất thời gian chờ.

## Client, mạng OT và nơi PLC được cắm vào

Hai việc, cả hai đều chỉ đọc.

**Nó được cắm ở đâu.** Một PLC im lặng và câu hỏi đầu tiên là do PLC hay do cổng switch. Hãy liên kết một lần thiết bị HotLoop với client của nó trên mạng, và ngăn kéo của nó sẽ báo "ở USW Lite 8 PoE cổng 5, liên kết down" trước khi ai đó mở ứng dụng UniFi. Liên kết cũng tạo các tag client trên thiết bị của bảng điều khiển, nên trạng thái cổng được vẽ xu hướng và đặt cảnh báo cạnh các giá trị Modbus đã ngừng.

**Có gì trên mạng SCADA.** Đánh dấu một mạng là OT, chấp nhận những gì thuộc về nó, và bất cứ thứ gì khác xuất hiện trên đó sẽ nâng một cảnh báo gọi tên nó. Có người cắm laptop vào switch SCADA lúc 2 giờ sáng, bạn biết ngay lúc 2 giờ sáng.

### Không có gì được xác định theo IP

Danh sách client của bảng điều khiển bị trễ. Vì vậy:

- **Một client chính là MAC của nó.** Việc liên kết đề xuất client theo IP, vì đó là điều bạn biết về PLC của mình, nhưng một người xác nhận một lần và từ đó khóa là MAC. Tag IP cho biết đó là ý kiến của bảng điều khiển.
- **Online không có nghĩa là "có trong danh sách".** Một client là online khi bảng điều khiển thấy nó trong vòng `clientTimeoutSec` (90 giây) **và**, với client có dây, cổng switch của nó có liên kết. Cổng là nửa nhanh: rút cáp ra và cổng đọc là down ở lần đọc kế tiếp, trong khi danh sách vẫn đang bắt kịp.

### Liên kết một thiết bị

Mở ngăn kéo của thiết bị. Nếu một bảng điều khiển UniFi mà HotLoop đọc liệt kê một client ở IP của thiết bị, phần Network sẽ đề xuất nó; quản trị viên bấm **Link**. Không có IP để dựa vào (thiết bị được định địa chỉ theo tên): liên kết theo MAC. Hoặc qua API, `PUT /api/devices/{id}/network`, xem [HTTP API](/vi/iot/api/#put-apidevicesidnetwork).

Client của thiết bị đã liên kết có tag và một cảnh báo, **"PLC-07 off the network"**, mức ưu tiên 1, với độ trễ kích hoạt 120 giây để PLC đang khởi động lại không gọi ai.

### Mạng OT và danh sách đã biết

Đánh dấu một mạng là OT (`PUT /api/unifi/{id}/networks/{network}` với `{"ot": true}`), rồi chấp nhận những gì đang có: tất cả như hiện tại trong một lệnh gọi (`POST .../accept-all`), hoặc từng thiết bị một. Việc đánh dấu tạo cảnh báo **"Unknown device on SCADA"**, mức ưu tiên 1, trên `n.<network>.unknown`. Người lạ mới nhất được nêu trong `n.<network>.unknown_last`, kèm MAC, tên nó tự xưng, IP và cổng switch hoặc SSID nó đã vào qua.

Một thiết bị đã biết có thể được **theo dõi** (`"watch": true`): nó nhận cùng các tag và cùng cảnh báo rời mạng như thiết bị đã liên kết. PLC được theo dõi. Một laptop bảo trì được phép nhưng lúc đến lúc đi thì là đã biết và không theo dõi, nếu không nó sẽ gọi ai đó mỗi lần rời đi.

Các cảnh báo là định nghĩa cảnh báo thông thường. Hoãn chúng, xác nhận chúng, gửi chúng tới Discord, sửa độ trễ của chúng. Bỏ theo dõi, liên kết hoặc dấu OT, HotLoop sẽ bỏ cảnh báo mà nó đã tạo cho chúng, nên một tag không ai đọc nữa không giữ một cảnh báo mở. Cảnh báo do quản trị viên viết tay thì không bao giờ bị đụng đến.

Bản ghi này thuộc về HotLoop, trong cơ sở dữ liệu riêng của HotLoop (`unifi_networks`, `unifi_known`, `unifi_links`, tất cả đều nằm trong các bản sao lưu), không bao giờ thuộc về bảng điều khiển. Một thay đổi đến được trình điều khiển đang chạy ở lần đọc kế tiếp, trên phiên nó đã có: nó không khởi động lại thiết bị, vì khởi động lại sẽ đăng xuất và hạn mức một lần đăng nhập mỗi phút sẽ giữ nó ngoài trong một phút.

### Các tag

| Tag | Kiểu | Ý nghĩa |
|---|---|---|
| `n.<network>.clients` | int | Số client trên mạng lúc này, online theo phép thử ở trên. Mọi mạng LAN đều có một tag này |
| `n.<network>.unknown` | int | Trên mạng OT: các client online không có trong danh sách đã biết |
| `n.<network>.unknown_last` | văn bản | Client mới nhất trong số đó, bằng lời. Để trống khi không có |
| `c.<mac>.online` | bool, connectivity | Client được theo dõi hoặc đã liên kết đang trên mạng |
| `c.<mac>.ip` | văn bản | IP của nó, như bảng điều khiển thấy lần cuối |
| `c.<mac>.sw_mac`, `.sw_port` | văn bản, int | Switch và cổng mà client có dây đang cắm. Được giữ lại sau khi rút cáp: nó *đã ở* đâu mới là điều quan trọng |
| `c.<mac>.port_up` | bool, connectivity | Liên kết của cổng đó. Xấu khi chính switch đã rớt khỏi bảng điều khiển, vì khi đó không ai biết |
| `c.<mac>.last_seen_s` | int, s | Số giây kể từ lần cuối bảng điều khiển thấy nó |

`<network>` là ID của mạng trong bảng điều khiển, nên đổi tên SCADA trong ứng dụng không làm hỏng gì. Một mạng đã đánh dấu OT mà bảng điều khiển sau đó xóa sẽ đọc ở trạng thái xấu kèm lý do đó, không bao giờ là số không âm thầm. Một client mà bảng điều khiển chưa từng thấy đọc `online` bằng 0 và phần còn lại ở trạng thái xấu, và nói rõ như vậy.

Chỉ các client được theo dõi và đã liên kết mới có tag `c.*`. Một mạng khách có 300 điện thoại ra vào không tạo ra 300 bộ tag.

### Đọc mà không hỏi bảng điều khiển

`GET /api/unifi/{id}/networks`, `/clients` và `/known`, ngăn kéo và công cụ MCP `find_network_client` đều đọc lần đọc gần nhất của trình điều khiển. Không cái nào tự gửi yêu cầu, nên một màn hình để mở, hoặc một agent hỏi liên tục trong vòng lặp, không tốn gì của bảng điều khiển và không thể là nguyên nhân gây ra 429. Mặt kia: trình hỗ trợ `--mcp-stdio`, không bao giờ đăng nhập, cho biết trong tiến trình của nó không có lần đọc bảng điều khiển nào.

## Các màn hình

Tab UniFi có sáu chế độ xem và bộ chọn bảng điều khiển. Mọi thứ trên đó là lần đọc gần nhất của trình điều khiển từ bảng điều khiển, nên để mở không tốn gì của bảng điều khiển và không thể là nguyên nhân gây ra 429. Nó hỏi HotLoop lại sau mỗi vài giây và chỉ vẽ lại khi có gì đó thay đổi, nên bản đồ mà ai đó đã cuộn tới góc vẫn ở đúng nơi họ đặt.

- **Tổng quan.** Mỗi bảng điều khiển một thẻ. Trên cùng thẻ của gateway là dải WAN: mỗi WAN một đoạn, màu xanh khi kiểm tra tình trạng của chính gateway cho biết nó còn hoạt động, màu đỏ khi không, đoạn đang mang lưu lượng có viền. Khi site đang chạy bằng đường dự phòng, cả dải chuyển sang màu hổ phách và cho biết đường nào và từ khi nào. "Từ khi nào" đó là lúc HotLoop lần đầu đọc thấy như vậy, không phải lúc gateway chuyển, và HotLoop khởi động khi site đã chạy trên 5G sẽ báo tính từ lúc khởi động của chính nó. Chúng tôi không in ra thời điểm mà chúng tôi không có. Bên dưới: thiết bị online, client có dây và không dây, client theo mạng, các thiết bị bảng điều khiển đã mất và các sự kiện mới nhất. WAN mà bảng điều khiển không nói gì thì màu xám và hiện "no liveness reported", không bao giờ màu xanh. Mỗi WAN báo cáo độ trễ có một đường vết cạnh con số, cùng đường mà các ô thực thể vẽ, lấy từ bộ đệm riêng của HotLoop cho tag đó. Quản trị viên có **Create the usual alarms** ở cuối thẻ, xem [các cảnh báo khởi đầu](#các-cảnh-báo-khởi-đầu).
- **Bản đồ.** Từ trái sang phải bắt đầu từ gateway. Nó được bố trí theo cùng một cách mỗi lần (một cây gọn gàng, không có vật lý mô phỏng, cùng dữ liệu vào thì cùng pixel ra), nên không rung lắc trên bảng treo tường. Các dây cáp là `downlink_table` của chính bảng điều khiển: một switch được cắm vào switch khác chỉ vì bảng điều khiển nói vậy. Một thiết bị không có gì liệt kê là được cắm vào đâu thì đứng riêng và hiện "no uplink listed". Chúng tôi sẽ không treo nó vào gateway theo phỏng đoán rồi sau đó sai về việc mạng của PLC đi đâu. Client có dây nằm trên switch và cổng mà bảng điều khiển học được chúng, client không dây nằm trên AP và SSID của chúng, được đếm trong một chip trên thẻ. Bấm vào một thiết bị và mọi thứ không nằm phía dưới nó sẽ mờ đi, và bảng bên liệt kê những gì nằm phía dưới, các client của nó, và các dây chuyền trên cây Plant mà nó cấp nguồn: các thiết bị HotLoop được liên kết với client bên dưới nó, mỗi thiết bị kèm đường dẫn thiết bị nơi nó nằm. Bản đồ phóng to và di chuyển được: chụm hai ngón, kéo một ngón, ctrl với cuộn hoặc chụm trên trackpad quanh con trỏ, hoặc các nút cộng, trừ và Fit, từ toàn bộ bản đồ lên đến tám lần. Nó là SVG thuần nên luôn sắc nét ở mọi tỷ lệ, và nơi bạn đặt nó vẫn giữ nguyên khi màn hình làm mới. Một cú kéo kết thúc trên thiết bị không chọn thiết bị đó. **Plant overlay** đặt các thiết bị HotLoop được liên kết với client vào một khung nét đứt cho mỗi dây chuyền của cây Plant, bên phải mạng và ghi nhãn đường dẫn của dây chuyền, mỗi thiết bị có một dây cáp tới cổng switch nó đang cắm, điều mạng nói về nó (up, down hoặc chưa thấy) và điều HotLoop nói về nó. Thiết bị đã liên kết nhưng không thuộc dây chuyền nào nằm trong khung tên "Not on the Plant tree". Nó vẫn bật sau khi bạn bật. Hai bảng điều khiển là một bức tranh: một thiết bị của bảng điều khiển khác mà HotLoop đọc và bảng điều khiển này liệt kê là client có dây được vẽ ở đây cùng cây con của riêng nó, nét đứt, đánh dấu "separate console". Bản đồ xuất được thành SVG cho hồ sơ của site.
- **Thiết bị.** Một bảng, và bấm vào một thiết bị để xem mặt trước của nó: các cổng được vẽ như bảng điều khiển mặt trước, một hàng cho switch nhỏ, hai hàng cho 24 và 48 cổng với cổng lẻ ở trên cổng chẵn. Xanh cho có liên kết, xám cho không có, **đỏ cho cổng từng up rồi down** (HotLoop nhớ nó đã up từ khi bắt đầu theo dõi), nét đứt cho cổng bị tắt, tia chớp PoE (số watt ở chú giải và chi tiết của cổng), mũi tên trên uplink. Bấm vào một cổng để xem ai đang ở trên đó, cái gì được cắm vào, chế độ PoE, watt và lưu lượng, kèm đường vết của những gì nó đã nhận và gửi. Thiết bị mà bảng điều khiển đã mất không hiển thị số liệu và liên kết cổng, vì điều nó nói lần cuối không còn hiện hành.
- **Client.** Có thể tìm theo tên, MAC hoặc IP, kèm vị trí, lần cuối bảng điều khiển thấy, đã biết hay chưa biết trên mạng OT, và thiết bị HotLoop được liên kết với nó. Quản trị viên chấp nhận client chưa biết ngay từ hàng đó.
- **Mạng.** Công tắc OT cho từng mạng, và "chấp nhận tất cả như hiện tại". Việc đó thay đổi bản ghi của HotLoop, không phải bảng điều khiển.
- **WiFi.** Các SSID, mỗi SSID có đang phát hay không, thuộc mạng nào và có bao nhiêu client. Nếu bảng điều khiển không cho tài khoản thấy các mạng không dây của nó, màn hình sẽ nói điều đó thay vì khẳng định là không có mạng nào.

Các route phía sau là `GET /api/unifi/consoles`, `.../overview`, `.../topology`, `.../devices`, `.../wifi` và `.../events`, được ghi trong [HTTP API](/vi/iot/api/).

### Các cảnh báo khởi đầu

Những cảnh báo mà nhà máy muốn có trên mạng của mình trước khi ai đó phải nghĩ tới, được tạo từ những gì bảng điều khiển hiện có. **Create the usual alarms** trong Tổng quan (hoặc `POST /api/unifi/{id}/starter-alarms`, xem [HTTP API](/vi/iot/api/)) tạo ra:

| Cảnh báo | Trên | Mức ưu tiên | Độ trễ kích hoạt |
|---|---|---|---|
| một thiết bị offline | `d.<mac>.online`, cho mọi switch, AP và gateway đã adopt | 2 | 60 giây, để khởi động lại firmware không gọi ai |
| một uplink down | `p.<mac>.<nn>.up` trên cổng mà mỗi thiết bị cắm vào phía trên của nó | 1 | 10 giây |
| gateway trên WAN dự phòng | `d.<mac>.wan.failover`, cho gateway có hai WAN trở lên | 2 | 30 giây |
| một cổng PoE vượt giới hạn | `p.<mac>.<nn>.poe_w`, chỉ khi bạn đưa ra giới hạn tính bằng watt | 3 | 30 giây |

Chúng là định nghĩa cảnh báo thông thường: hoãn, xác nhận, gửi tới Discord, sửa độ trễ hoặc giới hạn, xóa một cái. Bấm lại sau khi adopt thêm thiết bị chỉ thêm thiết bị mới, và tag đã có cảnh báo, làm tay hoặc do lần bấm trước, được để yên. Cảnh báo PoE lấy giới hạn do bạn đưa ra thay vì giới hạn HotLoop tự chọn, vì không bảng điều khiển nào chúng tôi đọc cho biết ngân sách của một cổng, và con số chúng tôi đoán sẽ là con số mà ai đó tin. "Unknown device on an OT network" và "a watched client off the network" không có trong nút này: chúng được tạo khi một mạng được đánh dấu OT và khi một thiết bị được theo dõi hoặc liên kết, cùng với bản ghi cho chúng ý nghĩa.

## Sự kiện

Websocket sự kiện của bảng điều khiển (`/proxy/network/wss/s/<site>/events` trên UniFi OS, `/wss/s/<site>/events` trên ứng dụng tự lưu trữ), trên cùng phiên với mọi thứ khác. Nó không bao giờ tự đăng nhập: một lần bắt tay bị từ chối với 401 đi qua cùng hạn mức đăng nhập như một lần đọc, và đăng nhập bị từ chối thì được chờ, không thử lại.

**Thăm dò vẫn là sự thật.** Một sự kiện không bao giờ ghi một tag. Nó làm những việc sau:

1. Nó vào **nhật ký** ngay khi đến, kèm câu của chính bộ điều khiển ("Switch[...] was disconnected") và khóa của nó. Switch bị rớt hiện trên dòng thời gian khi nó xảy ra, không phải khi lần thăm dò kế tiếp phát hiện. Nó được lưu dưới switch, điểm truy cập hoặc gateway mà nó nói tới, không phải dưới thiết bị của chính bảng điều khiển, vì bảng điều khiển là máy mà bộ điều khiển chạy trên đó chứ không phải thứ đã rớt. Sự kiện chỉ nêu một client (bảng điều khiển nói ai vừa vào, không nói ở đâu) được lưu dưới switch hoặc AP mà lần đọc gần nhất có client đó, và nếu client là mới thì nó chờ lần đọc mà sự kiện vừa yêu cầu, tối đa ba mươi giây, rồi chuyển xuống dưới bảng điều khiển nếu lần đọc đó vẫn chưa có. Bộ lọc **Where** của nhật ký tìm sự kiện từ phía nhà máy: một thiết bị HotLoop được liên kết với client của nó, switch mà bảng điều khiển nói client đó đang ở, và mọi switch từ đó tới gateway theo bảng downlink của chính bảng điều khiển. Một switch bị rớt hiện trên dòng thời gian của mọi dây chuyền nó cấp nguồn và không hiện trên dây chuyền nào nó không cấp. Hỏi về chính bảng điều khiển vẫn hoạt động như mọi khi: nhật ký hệ thống theo `subject` bằng id của bảng điều khiển, và nhật ký với bảng điều khiển nằm trong các thiết bị thuộc phạm vi, trả về mọi sự kiện của bảng điều khiển đó, kể cả sự kiện của từng switch.
2. Nó vào nhật ký mà Tổng quan hiển thị, và vào `site.last_event` và `d.<mac>.last_event`, nên một tự động hóa có thể kích hoạt từ một sự kiện.
3. Nó yêu cầu lần đọc kế tiếp ngay. Khoảng đọc tối thiểu là mười giây; một sự kiện rút ngắn nó còn năm, nên các tag và thực thể bắt kịp ở lần thăm dò kế tiếp thay vì trễ tới mười giây. Mạng WiFi bận gửi một sự kiện cho mỗi điện thoại đi ngang, và bảng điều khiển không bị đọc cho từng cái.

Bộ điều khiển gắn cờ các sự kiện có nghĩa là có gì đó sai (`is_negative`: switch mất liên lạc là một sự kiện như vậy, client ngắt kết nối thì không), và đó là các cảnh báo trong nhật ký. Mọi thứ khác là thông tin, kể cả những khóa HotLoop chưa từng thấy.

**Websocket chết tốn tốc độ, không bao giờ tốn tính đúng đắn.** Nó kết nối lại với khoảng lùi từ hai giây tới một phút. Nó gửi ping, và một luồng không trả lời gì trong 90 giây là đã chết dù mạng nói gì, nên nó được đóng và mở lại. Khi đang ngừng, `site.events_live` đọc 0, Tổng quan hiện "polling only" kèm lý do, và việc thăm dò tiếp tục y như trước.
## Những gì đã được xác minh

Trình điều khiển UniFi và các màn hình đã được chạy với UniFi Network Application và bảng điều khiển UniFi OS thật, chỉ đọc bằng tài khoản View Only, và trên phần cứng thật vào 2026-11-17: lần đăng nhập và phiên duy nhất của nó, các tag thiết bị, cổng, PoE, WAN và client, luồng sự kiện trực tiếp, và các màn hình xây dựng trên chúng.
