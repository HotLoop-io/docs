---
title: "Lộ trình HotLoop"
description: "HotLoop là gì, còn gì phải xây và cái gì đang hỏng, theo thứ tự sẽ làm, cho HotLoop core. Flow và Cascade có lộ trình riêng được liên kết tại đây."
---

HotLoop là gì, còn gì phải xây và cái gì đang hỏng. Cái gì không có trong danh sách này thì sẽ không được làm, nên hãy đưa nó vào danh sách.

## HotLoop là gì

**HotLoop là nền tảng tự động hóa cho nhà máy, viết lại từ đầu bằng Go.** Một tệp nhị phân tĩnh. Không Python, không runtime phải chăm sóc, không container đặc quyền, không capability nào thừa. Thực thể, tự động hóa, trợ thủ, script, nhật ký, bảng điều khiển, thông báo, MCP và MQTT có khám phá, đặt trên lớp công nghiệp: giao thức PLC thật, historian thật, báo động ISA-18.2, OPC UA, Sparkplug B.

Mỗi dòng đều là của chúng tôi. Không có gì được nhúng, bắc cầu hay fork, nên khi có gì hỏng lúc 3 giờ sáng chỉ có một mã nguồn để đọc và không có lỗi của ai khác để chờ.

HotLoop gồm tám sản phẩm cho nhà máy: bốn sản phẩm lớn lên cùng một địa điểm (IoT, Edge, Gateway và Edge Relay), cộng thêm Flow để đấu nối, Cascade cho quy trình làm việc, HotLoop for CODESYS cho màn hình riêng của PLC và Transmitter để đưa giá trị của PLC lên mạng. Lộ trình này dành cho HotLoop core, bốn sản phẩm đến từ một mã nguồn. Xem [Sản phẩm](#sản-phẩm). Flow, Cascade, HotLoop for CODESYS và Transmitter có lộ trình riêng, tại <a href="/vi/flow/roadmap/">lộ trình Flow</a>, <a href="/vi/cascade/roadmap/">lộ trình Cascade</a>, <a href="/vi/codesys/roadmap/">lộ trình HotLoop for CODESYS</a> và <a href="/vi/transmitter/roadmap/">lộ trình Transmitter</a>.

## Sản phẩm

HotLoop core là bốn sản phẩm, một mã nguồn, một thẻ. Mỗi bản phát hành core đưa cả bốn ra cùng lúc, cùng số phiên bản, mỗi sản phẩm có image và chart Helm riêng. Bạn chọn sản phẩm hợp với thiết bị, chứ không phải sản phẩm tình cờ có trình điều khiển bạn cần.

| Sản phẩm | Là gì | Cơ sở dữ liệu | Hiện trạng |
|---|---|---|---|
| **HotLoop IoT** | Thực thể, tự động hóa, trợ thủ, script, nhật ký, bảng điều khiển, thông báo, MCP, MQTT có khám phá, động cơ báo động ISA-18.2, sao lưu và mọi trình điều khiển. Nền tảng mà Edge và Gateway xây trên đó | SQLite hoặc Postgres | Đã tách: image riêng (`hotloop-iot`, amd64, arm64, arm/v7), chart và đơn vị Quadlet, được dựng và công bố với mỗi thẻ. Đã phát hành trong 4.18.10 |
| **HotLoop Edge** | IoT, cộng máy chủ OPC UA, lưu rồi chuyển tiếp lên trên, và màn hình cục bộ ngay tại máy | SQLite, Postgres hoặc TimescaleDB | Đã tách: image riêng (`hotloop-edge`, amd64, arm64, arm/v7), chart và đơn vị Quadlet, được dựng và công bố với mỗi thẻ. Đã phát hành trong 4.18.10 (Gateway chạy ở biên và công bố Sparkplug lên trên từ 4.5.0) |
| **HotLoop Gateway** | Edge, cộng đội thiết bị, nhiều địa điểm và báo cáo theo lịch. Bộ não của địa điểm | SQLite, Postgres hoặc TimescaleDB | Đang cung cấp |
| **HotLoop Edge Relay** | Đơn giản và bền: thăm dò, chuyển tiếp, trụ vững. Không cơ sở dữ liệu, không giao diện. Là sản phẩm riêng, không phải Edge bị rút màn hình | không có | Đang cung cấp. Mỗi bản phát hành công bố image và chart của nó từ 4.16.0 |

**Chức năng phân biệt các sản phẩm. Giao thức thì không.** Mọi sản phẩm đều nói MQTT trên mọi trình điều khiển chúng tôi có. Một người chơi với chiếc S7-1200 cũ trên bàn là người dùng IoT, và IoT nói chuyện với chiếc PLC đó mà không cần nâng cấp.

- [x] Chính việc tách này, trong mã nguồn. `-tags hotloop_edge` là Edge, `-tags hotloop_iot` là IoT, và cả hai cùng lúc thì không biên dịch được. Các tuyến API trả 404 và nói sản phẩm nào có nó. `hotloop --product` và `GET /api/status` cho biết bạn đang nói chuyện với sản phẩm nào
- [x] Bốn image và bốn chart từ một thẻ, dựng song song, công bố lên cùng kho Helm. Bản phát hành từ chối thẻ mà một trong bốn chart không khớp. Gateway giữ `ghcr.io/hotloop-io/hotloop` và chart `hotloop`, nên không ai đang dùng 4.16 thức dậy với thứ hỏng
- [x] Cơ sở dữ liệu là một thiết lập, không phải image. SQLite, Postgres hoặc TimescaleDB, chọn lúc chạy, tất cả trong cùng một tệp nhị phân. SQLite là bản Go thuần, không cgo, nên các bản dựng arm vẫn tĩnh và một chiếc Pi không cần bộ công cụ biên dịch để tồn tại. Toàn bộ bộ kiểm thử chạy trên cả ba, vì cơ sở dữ liệu chúng tôi không kiểm thử là cơ sở dữ liệu chúng tôi không hỗ trợ
- [x] Chuyển một địa điểm từ IoT lên Edge rồi Gateway giữ nguyên mọi thiết bị, tag, báo động, người dùng và từng giờ lịch sử: đổi image là xong. Quay xuống không xóa gì, các chức năng thiếu chỉ nằm im cho đến khi bạn quay lại
- [x] Thiết lập chỉ dành cho Gateway trên IoT hoặc Edge sẽ cảnh báo và vẫn chạy, và vẫn hiện và lưu trong Cài đặt. Bạn thấy chính xác mình đã đặt gì và vì sao nó không làm gì, thay vì phải đoán
- [x] IoT giữ 30 ngày lịch sử theo mặc định. Ổ đĩa của Pi nhỏ, và Gateway là nơi lưu lịch sử dài
- [x] Không khóa giấy phép và không mở khóa lúc chạy. Không có bậc nào phải trả tiền. Một bậc là một image, và nâng cấp là đổi image trên cùng dữ liệu
- [x] **Mọi thiết bị đều theo `:stable` và tự cập nhật.** Các đơn vị Quadlet của Gateway, Edge và IoT theo `:stable` như của relay, với tự cập nhật của Podman, một kiểm tra sức khỏe không cần shell và việc quay lui khi image mới không lên được. `release_guard.sh` từ chối bản phát hành có đơn vị bị ghim, không thể báo là không khỏe, hoặc tự cập nhật cơ sở dữ liệu của chúng. Cơ sở dữ liệu vẫn bị ghim vào thẻ mà chart của nó chạy: phiên bản chính của PostgreSQL là xuất rồi nạp lại, và việc cập nhật phần mở rộng TimescaleDB của ứng dụng là một chiều, nên khác với ứng dụng, nó không thể hoàn tác. Đã chạy thật trên Gateway: một bản cập nhật có thêm migration, thực hiện với dữ liệu còn nguyên, và một bản migrate rồi không khởi động được, đã quay lui. Lần chạy đó là lý do pod biến mất: khi ứng dụng nằm trong một pod, Podman khởi động lại đơn vị của pod, đơn vị này lên bình thường, nên bản phát hành hỏng được báo là thành công và không bao giờ bị quay lui. Xem [README của Quadlet](/vi/install/auto-update/)
- [x] Dòng phạm vi của giấy phép nêu tên cả bốn sản phẩm, trong giấy phép chuẩn và mọi bản sao của nó. Trước đây nó ghi Gateway, điều có thể khiến ba sản phẩm kia không có quyền sử dụng nào
- [x] **Việc tách ra đã phát hành trong 4.18.10 cùng với khám phá MQTT** (giai đoạn 4). Bản phát hành đầu tiên của IoT tìm thấy thiết bị Shelly và ESPHome ngay từ đầu

## Nền tảng tự động hóa

Theo thứ tự. Mỗi giai đoạn ra mắt dưới dạng các PR được kiểm thử riêng, và mỗi giai đoạn dựa trên giai đoạn trước. Tất cả đều vào HotLoop IoT, nghĩa là cũng có trong Edge và Gateway.

### Giai đoạn 1: thực thể

Nền móng. Mọi tự động hóa, trợ thủ, script và màn hình trong HotLoop đều nói về thực thể, nên chúng được làm trước. Đã gộp trong các PR từ 1 đến 6, sau 4.15.3, và phát hành lần đầu trong 4.16.0. Toàn bộ nằm trong [Thực thể](/vi/iot/entities/) và [cây thiết bị cùng nhãn](/vi/iot/equipment/).

- [x] Mô hình thực thể: các miền có kiểu (cảm biến, cảm biến nhị phân, công tắc, số, lựa chọn, nút bấm, văn bản, cùng các miền OT: van, động cơ, vòng PID, bộ đếm, báo động), một trạng thái, thuộc tính, ID thực thể ổn định. Bơm, quạt, băng tải và máy nén là các loại động cơ, không phải miền riêng
- [x] Thiết bị tổng hợp: một thực thể động cơ dựng từ các tag khởi động, dừng, đặt lại, đang chạy, lỗi và tốc độ, vì động cơ thực sự là như vậy
- [x] Ánh xạ các tag hiện có vào thực thể mà không làm hỏng một tag, lệnh gọi API, công cụ MCP, nút OPC UA, tự động hóa hay tệp thiết bị edge relay nào
- [x] Các dịch vụ (`switch.turn_on`, `number.set_value` và tương tự) đi qua cổng ghi hiện có và không đường nào khác
- [x] Một cây thiết bị ISA-95 (doanh nghiệp, địa điểm, khu vực, dây chuyền, ô, đơn vị, thiết bị), cộng nhãn. Các trường địa điểm / khu vực / dây chuyền đã có vẫn chạy bình thường
- [x] Đơn vị và lớp thiết bị
- [x] Thực thể trong MCP, tự động hóa và luồng trực tiếp, cùng các màn hình Thực thể và Nhà máy
- [x] Khoảng thời gian `for:` trên bộ kích hoạt trạng thái thực thể ("bơm đã tắt 5 phút"). Phát hành ở giai đoạn 2 dưới dạng `forSec` trên bộ kích hoạt `state`; một lần chờ đang diễn ra không sống sót qua khởi động lại ([Tự động hóa](/vi/iot/automations/#holding-a-state-forsec))

### Giai đoạn 2: trợ thủ, script, cảnh, nhật ký

- [x] Trợ thủ: boolean, số, lựa chọn, văn bản đầu vào; bộ hẹn giờ, bộ đếm, lịch. Trong nhà máy đó là giá trị đặt và lịch ca. Được giữ qua các lần khởi động lại và trong bản sao lưu, bộ hẹn giờ theo đồng hồ treo tường; xem [Trợ thủ](/vi/iot/helpers/)
- [x] Script: các chuỗi hành động có tên, gọi được từ tự động hóa, giao diện và MCP. Trường có kiểu, chế độ chạy, chạy thử qua cổng thật, mọi lần ghi là `script:<id>`, có trong nhật ký và bản sao lưu; xem [Script](/vi/iot/scripts/)
- [x] Cảnh dưới dạng **công thức**: chụp một tập giá trị đặt, áp dụng cùng nhau, có kiểm toán. Kiểm tra cả bộ và từ chối cả bộ, không bao giờ cắt bớt, ghi theo thứ tự dưới một mã gọi và không bao giờ quay lui, đọc lại từ thiết bị, phiên bản bất biến, áp dụng từ giao diện, một quy tắc, một script hoặc MCP; xem [Công thức](/vi/iot/recipes/)
- [x] Nhật ký: một dòng thời gian của mọi thay đổi trạng thái, lần ghi, báo động và lần chạy tự động hóa, theo thực thể và theo khu vực ([Nhật ký](/vi/iot/logbook/))
- [x] Bản mẫu (blueprint): mẫu tự động hóa tái sử dụng. Đầu vào có kiểu nằm ngoài phạm vi bị từ chối, không bao giờ cắt bớt; quy tắc giữ phiên bản nó được tạo ra cho đến khi ai đó xem xét bản nâng cấp và chấp nhận; bốn bản dựng sẵn; xem [Bản mẫu](/vi/iot/blueprints/)
- [x] Ngôn ngữ tự động hóa: các bước điều kiện, chờ và dừng trong một chuỗi, và `forSec` trên bộ kích hoạt trạng thái ("bật năm phút")

### Giai đoạn 3: bảng điều khiển

Đây là nơi "tốt hơn và ngầu hơn" phải thấy rõ từ phía bên kia căn phòng.

- [x] Trình dựng bảng điều khiển: thẻ, kéo và thả, bao nhiêu bảng điều khiển tùy bạn. Các lần lưu ghi rõ phiên bản chúng xuất phát, nên hai người dựng cùng một trang không thể ghi đè lên nhau mà không biết; xem [Bảng điều khiển](/vi/iot/dashboards/)
- [x] Tệp màn hình: một bảng điều khiển lưu thành tệp có phiên bản và nhập vào một bản cài khác, nên màn hình của khách hàng là của họ và không bao giờ là một phần của sản phẩm; mọi tag hoặc thiết bị còn thiếu đều được liệt kê và ánh xạ trước khi lưu bất cứ gì. Xem [Tệp màn hình](/vi/iot/screen-file/)
- [x] Bộ thẻ: đồng hồ đo, số, xu hướng, danh sách thực thể, nút ghi có xác nhận, nút script, danh sách báo động, markdown, camera, sơ đồ mặt bằng với tag trực tiếp, bộ chọn công thức và thanh trạng thái nhà máy. Một thẻ tự nó không ra lệnh gì; nút bấm ghi qua cổng ghi
- [x] Bảng điều khiển theo vai trò và theo màn hình; bảng treo tường là một trong số đó, trong cùng bộ chuyển và với cùng các phân công
- [x] Trông giống nhau trên PC bảng điều khiển, laptop và điện thoại: một bố cục gập từ mười hai cột xuống một, được thử ở năm độ rộng
- [x] Giao diện web bằng tiếng Anh và 13 ngôn ngữ nữa: Tây Ban Nha, Pháp, Ý, Đức, Na Uy, Bulgaria, Hy Lạp, Hàn, Nhật, Việt, Hindi, Trung giản thể và Ả Rập (từ phải sang trái), chọn ở thanh trên và được trình duyệt nhớ. Xem [Ngôn ngữ](/vi/iot/languages/)
- Dựng sao cho HMI của Edge có thể làm từ nó: một bảng điều khiển gắn với tên màn hình mở tại `/?screen=<name>` không có đầu trang và không có thẻ tab
### Giai đoạn 4: tích hợp và khám phá

- [x] Khung tích hợp: một tích hợp thêm thiết bị và thực thể, có luồng cấu hình và được kiểm thử với thiết bị thật
- [x] **Khám phá MQTT**: Zigbee2MQTT và ESPHome theo định dạng chúng công bố, Tasmota theo định dạng riêng, Shelly Gen2 trở đi từ các trạng thái nó công bố. Thiết bị hiện ra ở chế độ đọc, trên broker tích hợp hoặc bất kỳ broker nào khác, và không có gì được kích hoạt cho đến khi một người chấp nhận thiết bị và kích hoạt từng điểm. Edge Relay cũng khám phá, chỉ đọc và chuyển tiếp. Frigate không có ở đây: trang MQTT của nó không ghi tài liệu về thông điệp khám phá. Mọi thứ được kiểm chứng với bản ghi của thiết bị thật, riêng Tasmota và Shelly còn với tài liệu của nhà sản xuất, không phải với thiết bị trên bàn thử. Xem [Khám phá MQTT](/vi/iot/mqtt-discovery/) và [tài liệu tham chiếu Edge Relay](/vi/edge-relay/reference/#discovery-41810). Việc tách thành bốn sản phẩm đã chờ điều này
- [x] Khám phá mạng (mDNS, SSDP, DHCP): thiết bị nghe thấy trên mạng nhà máy hiện ra trên màn hình Đã khám phá cùng thông tin nó là gì và HotLoop có thể nói chuyện với nó thế nào, và một người chấp nhận hoặc bỏ qua từng cái. Máy chủ OPC UA thành thiết bị OPC UA, Shelly thành thiết bị HTTP, nút ESPHome chỉ bạn sang MQTT; không có gì tự được thêm và không có gì được kích hoạt. Mặc định chỉ lắng nghe; việc thăm dò được bật theo từng mạng bởi bản triển khai. DHCP cần mạng của máy chủ và cổng 67, nên bị tắt cho đến khi một bản triển khai cấp cả hai. Đã kiểm thử với avahi, MiniDLNA và udhcpc thật; chưa kiểm thử với thiết bị thật trên bàn thử. Xem [Khám phá mạng](/vi/iot/network-discovery/)
- [x] CODESYS, các biến của PLC theo tên lập trình viên đã đặt, qua máy chủ OPC UA riêng của runtime: khám phá những gì ứng dụng xuất ra, đọc và ghi, một bảng điều khiển đầu tiên từ thiết lập, và tự kết nối lại sau khi khởi động lại hay tải xuống. Đã chứng minh với runtime 4.22.0.0 trong một container chạy chương trình phòng thí nghiệm của HotLoop và một chương trình thứ hai lớn hơn nhiều, và trên phần cứng thật (2026-11-17). Xem [CODESYS](/vi/iot/protocols/#codesys)
- [x] BACnet/IP và SNMP, chỉ đọc, xem [Giao thức và trình điều khiển](/vi/iot/protocols/)
- [ ] Camera ONVIF, Shelly gốc
- [ ] **Firmata**, cho Arduino qua USB. Chỉ kiểm chứng trên bo mạch thật: Arduino và vài thiết bị Firmata khác đang trên đường tới bàn thử, và một bộ giả lập Firmata chỉ là tự đồng ý với chính mình
- [ ] UniFi, xem [UniFi](#unifi)
- [x] Mặt trời, cho mọi thứ ngoài trời: `binary_sensor.sun_up`, độ cao và góc phương vị của mặt trời, và bộ kích hoạt `sun` lúc rạng đông, mặt trời mọc, trưa, mặt trời lặn và chạng vạng với độ lệch. Tính ngay trên thiết bị từ vĩ độ và kinh độ của địa điểm bằng các phương trình của NOAA, không cần dịch vụ nào, và đối chiếu với mọi giờ mặt trời mọc, lặn và giữa trưa NOAA công bố cho năm 2026 ở sáu nơi từ Utqiagvik đến Quito. Xem [mặt trời](/vi/iot/sun/)
- [x] Thời tiết. Không phải từ API thời tiết đám mây: HotLoop không gọi cho ai để biết trời đang mưa. Thực thể `weather` là một trạm trên mái nhà máy, các tag gắn theo vai trò (nhiệt độ, độ ẩm, áp suất, gió, mưa, ánh sáng mặt trời), với điểm sương, chỉ số nóng và độ lạnh do gió tính ngay trên thiết bị và đối chiếu với bảng của NWS. Cảm biến không đọc được là không khả dụng, không bao giờ là không. Một thẻ, 14 ngôn ngữ, và tác tử dựng và đọc một thẻ qua MCP. Xem [Thời tiết](/vi/iot/weather/)

### Giai đoạn 5: năng lượng, điện thoại, thông báo

- [x] Năng lượng: kWh, khí, nước, khí nén và chi phí mỗi đơn vị sản xuất. Một bảng điều khiển năng lượng hướng tới sàn sản xuất. Đồng hồ đo là một tag đọc như bộ đếm hoặc công suất, lưu theo khoảng 15 phút trong cơ sở dữ liệu (migration 0029), được tính giá khi đếm theo biểu giá cố định hoặc theo giờ, nên giá đổi sau này không bao giờ làm thay đổi chi phí tháng trước. Chi phí một đơn vị sản xuất là chi phí chia cho số bộ đếm sản xuất đã đếm, và "Chưa sản xuất gì" khi chưa có gì. Màn hình Năng lượng, cảm biến cho mọi quy tắc, 14 ngôn ngữ và MCP. Phí nhu cầu trên một phần tư giờ cao nhất (migration 0030) và tổng của một ca có tên, từ màn hình, API hoặc tác tử. Xem [Năng lượng](/vi/iot/energy/)
- [x] Ứng dụng web cài được trên điện thoại và chạy khi không có mạng
- [x] Thông báo, xem bên dưới

---

## Thông báo

Webhook, email, ntfy, Gotify, webhook Discord và bot Discord đều có, tất cả trên cùng hạ tầng. Xem [Thông báo báo động](/vi/iot/notifications/).

- [x] **Hạ tầng trước:** bộ giới hạn tốc độ theo kênh, gộp ("thêm 7 báo động trong phút vừa qua" thành một tin) và thử lại có giới hạn tôn trọng `Retry-After`
- [x] **Liên kết xác nhận có chữ ký:** một xác nhận từ điện thoại đến như một xác nhận ISA-18.2 thật, và nút cũ không thể xác nhận lần sau khi cùng báo động đó kích hoạt. ntfy không cho biết ai đã bấm, nên tên hiện ra là của kênh (`notify:ntfy`); bot Discord đặt tên của người bấm

Bốn kênh. Đó là danh sách.

- [x] **ntfy, trước tiên.** Miễn phí, tự lưu trữ, chạy được trên mạng nhà máy không có internet (Android; iPhone cần máy chủ chuyển tiếp qua ntfy.sh), và nút hành động xác nhận báo động ngược về HotLoop qua mạng nhà máy.
- [x] **Gotify.** Miễn phí, tự lưu trữ, chạy không cần internet. Không có nút xác nhận và không có ứng dụng iPhone, nên là một chiếc máy nhắn tin chứ không phải hai chiều.
- [x] **Webhook Discord.** Dán một URL là xong. `allowed_mentions` bị khóa nên tên báo động không thể nhắc @everyone, và báo động nghiêm trọng có thể gọi một vai trò. Webhook mà Discord từ chối thì bị tắt, không thử lại cho đến khi bị cấm IP.
- [x] **Bot Discord.** Nút xác nhận và hoãn ngay trong kênh, giới hạn theo vai trò Discord (không ai cho đến khi bạn nêu tên), ghi cho người đã bấm. Nói chuyện với Discord qua kết nối đi ra (Gateway), nên nhà máy không cần địa chỉ công khai.
- [x] Leo thang: không ai xác nhận trong N phút, đi đánh thức người kế tiếp hoặc kênh kế tiếp
- Sẽ không làm: SMS và Google Messages (RCS cần nhà mạng duyệt theo từng công ty và từng quốc gia, và một thiết bị tự lưu trữ không thể có được), Slack, Teams, Google Chat, Pushover, PagerDuty, Telegram, Opsgenie, Signal, Matrix

---

## UniFi

Mạng của nhà máy cũng là thiết bị. Khi một PLC im lặng, câu hỏi đầu tiên là "do PLC hay do switch", và hôm nay bạn trả lời bằng cách đi tới ứng dụng UniFi. Vì vậy UniFi vào như một **trình điều khiển giao thức**, không phải hệ thống bên cạnh: mọi switch, cổng, ngân sách PoE và WAN đều là một tag. Nhờ đó nó có sẵn cổng ghi, kiểm toán, chạy thử, báo động, xu hướng, thực thể, tự động hóa, OPC UA và MCP, thay vì dựng lại một nửa mỗi thứ cho một nhà sản xuất.

Nó vào nền tảng IoT, nên cả bốn sản phẩm đều có, và Edge Relay có thể thăm dò một bảng điều khiển như mọi thiết bị khác.

### Mạng

Theo thứ tự. Không có gì ở đây ghi vào bộ điều khiển cho đến U5.

- [x] **U1: trình điều khiển chỉ đọc.** Một phiên cho mỗi bảng điều khiển, dùng lại cho mọi thứ, với ngân sách đăng nhập. Đăng nhập ở mỗi lần kiểm tra khiến chính Cloud Gateway của chúng tôi trả 429 và khóa chúng tôi, hai lần, nên HotLoop đăng nhập một lần và chờ hết khóa thay vì kéo dài nó. Chứng chỉ của bảng điều khiển được ghim ở lần dùng đầu, không cho qua mù quáng. Thiết bị, cổng switch, mức tiêu thụ PoE, WAN và chuyển đổi dự phòng đi vào dưới dạng tag tự đồng bộ: switch được nhận vào ngày mai tự xuất hiện, cái biến mất chuyển sang chất lượng xấu thay vì bốc hơi ngay dưới các báo động của nó. Lần đọc thật đầu tiên báo đường dự phòng 5G đang chạy khi nó đã chết hai ngày, vì tin vào `up` lỗi thời trong khối WAN giống như bản tóm tắt của bảng điều khiển. Các kiểm tra sức khỏe biết điều đó, nên trình điều khiển giờ đọc chúng và một bài kiểm thử ghim lại. Đã xong, xem [UniFi Network](/vi/iot/unifi/)
- [ ] **U2: máy khách và giám sát OT.** Máy khách được nhận diện theo MAC, không bao giờ theo IP, vì bảng máy khách của bộ điều khiển hiện những địa chỉ mà một máy đã rời đi từ nhiều giờ trước. Đánh dấu một mạng là OT, chấp nhận những gì có trên đó, và mọi thứ mới xuất hiện sẽ báo động. Liên kết một lần thiết bị HotLoop với cổng switch của nó, và một PLC im lặng cho bạn biết nó ở cổng nào và liên kết đó có đang hoạt động không. Ô được đánh dấu sau hai bước cần có người ở tủ rack: rút cáp thật và một điện thoại tham gia SCADA. Xem [UniFi Network](/vi/iot/unifi/)
- [x] **U3: màn hình và bản đồ cấu trúc mạng.** Tổng quan với dải WAN (chuyển màu hổ phách khi địa điểm chạy trên đường dự phòng 5G), một bản đồ cấu trúc mạng bố trí giống nhau mỗi lần để không gì rung trên bảng treo tường, mặt trước switch, máy khách, mạng và WiFi. Hai bảng điều khiển được ghép thành một hình. Nhấp vào một switch và xem nó cấp nguồn cho những dây chuyền nào trên cây nhà máy. Dây cáp lấy từ chính bảng downlink của bảng điều khiển, nên switch mà không gì ghi là cắm vào đâu thì đứng riêng thay vì bị treo vào gateway theo phỏng đoán. Chưa được xem trên thiết bị thật. Bản đồ chụm, kéo và thu phóng đến tám lần, có lớp phủ Nhà máy gom các thiết bị HotLoop đã liên kết dưới dây chuyền của chúng, độ trễ nằm cạnh mỗi WAN và lưu lượng vào ra của cổng được vẽ vết, và quản trị viên có thể tạo các báo động quen thuộc (thiết bị ngoại tuyến, uplink hỏng, gateway chạy dự phòng, PoE vượt giới hạn họ đặt) bằng một lần bấm. Các phần này đã được chứng minh vào 2026-10-19, với cảm ứng được giả lập chứ không phải trên màn hình, và vết thông lượng WAN chưa được xây: chưa đọc trường nào của bảng điều khiển cho việc đó từ một gateway thật. Xem [UniFi Network](/vi/iot/unifi/#các-màn-hình)
- [x] **U4: sự kiện.** Websocket sự kiện của bộ điều khiển, để switch rớt hiện ra trong vài giây thay vì ở lần thăm dò tiếp theo, và vào nhật ký. Thăm dò vẫn là sự thật; websocket chết chỉ mất tốc độ, không bao giờ mất tính đúng. Websocket bị ngắt và websocket im lặng đều kết nối lại mà không cần đăng nhập. Sự kiện được ghi vào nhật ký dưới switch hoặc AP mà chúng nói tới, và bộ lọc thiết bị tìm thấy chúng từ một thiết bị đã liên kết qua các switch cấp nguồn cho nó. Các công cụ tác tử `get_network_topology` và `get_network_events` đọc bản đồ và sự kiện. Xem [UniFi Network](/vi/iot/unifi/#sự-kiện)
- [ ] **U5: ghi qua cổng.** Đèn LED định vị trước: rủi ro bằng không, thấy được từ phía bên kia căn phòng, và nó chứng minh toàn bộ đường ghi trên thiết bị thật. Sau đó là chế độ PoE, chu kỳ nguồn của cổng, bật và tắt WLAN, chặn máy khách và vô hiệu hóa cổng của thiết bị lạ, một khi dạng đó được chứng minh trên bộ điều khiển thật và một cổng trống. Chu kỳ nguồn có thời gian chờ 15 phút cho mỗi cổng, vì một tự động hóa tắt bật PLC mỗi hai phút là cách làm cháy bộ nguồn. Các cổng được bảo vệ lấy từ cấu trúc mạng: HotLoop sẽ không tắt bật uplink hay cổng cấp nguồn cho đường dự phòng 5G, bất kể ai yêu cầu. Khởi động lại thiết bị là một nút bấm bình thường: bấm, thiết bị khởi động lại, không xác nhận, và vẫn được kiểm toán
- [ ] **U6: tự chữa.** Một bản mẫu dựng sẵn: thiết bị im lặng N phút, tắt bật cổng của nó một lần, rồi báo động. Một lần, không phải mãi mãi

### Protect, Access và nguồn điện

Xây từ tài liệu của Ubiquiti, và mỗi cái được gộp khi đã chạy trên thiết bị thật tại bàn thử, không phải trước đó.

- [ ] **Protect.** Camera làm thực thể, chuyển động và nhận diện thông minh làm cảm biến nhị phân và bộ kích hoạt tự động hóa, ảnh chụp theo yêu cầu và đính kèm vào thông báo báo động. Một báo động HotLoop có thể kích hoạt bộ kích hoạt báo động của Protect để camera ghi hình. Video trực tiếp đến cùng thẻ camera ở giai đoạn 3
- [ ] **Access.** Vị trí cửa, sự kiện cửa vào nhật ký và mở khóa như một lần ghi qua cổng. Mở khóa từ MCP được phép qua cổng ghi như mọi lần ghi khác, và được kiểm toán như mọi lần ghi khác
- [ ] **SmartPower PDU.** Công suất ổ cắm, bật, tắt và chu kỳ nguồn làm tag, cấp dữ liệu cho phần năng lượng ở giai đoạn 5

## Đích của historian

Historian tích hợp vẫn ở lại. Bên trên nó, HotLoop ghi lịch sử ra các cơ sở dữ liệu mà nhà máy đã vận hành, vì bộ phận CNTT có một SQL Server họ sao lưu và vá, và họ sẽ không dùng cái của chúng tôi chỉ để xem một xu hướng.

- [x] Postgres và TimescaleDB (của người khác, không phải cái HotLoop chạy trên đó). Xem [Đích của historian](/vi/iot/historian-targets/)
- [x] SQL Server
- [x] InfluxDB (2 và 3)
- [x] MySQL và MariaDB
- [x] Một đích đang ngừng không bao giờ làm chậm việc thăm dò hay historian tích hợp. Nó bắt kịp khi quay lại, hoặc nói to ra những gì nó đã bỏ. Nó bắt kịp từ chính lịch sử của HotLoop, nên khởi động lại giữa lúc gián đoạn cũng không mất gì
- [x] Luồng sự kiện qua Kafka API: số đọc và nhật ký hệ thống ra bất kỳ broker tương thích Kafka nào, TLS và SASL, qua cùng hàng đợi và cơ chế bắt kịp như một cơ sở dữ liệu. Đã chứng minh với Apache Kafka 4.4.0 và Redpanda 26.2.6. Xem [Đích của historian](/vi/iot/historian-targets/#kafka-api-luồng-sự-kiện). Chưa có: TLS hai chiều, đăng nhập Kerberos và OAuth, schema registry, và bắt kịp cho sự kiện (chúng không có lịch sử để gửi lại)

---

## OPC UA PubSub

- [x] Đăng ký UADP qua UDP, unicast hoặc multicast, như một thiết bị (`opcua-pubsub`): trường Variant, DataValue và RawData, khung khóa, delta và keep alive, xử lý thông điệp bị mất và thay đổi cấu hình. Xem [Giao thức và trình điều khiển](/vi/iot/protocols/#opc-ua-pubsub-uadp)
- [x] Công bố tag dưới dạng UADP, trong Edge và Gateway, bên cạnh máy chủ OPC UA
- [x] Máy chủ OPC UA trả lời HistoryRead từ lịch sử mà Gateway giữ, thô và đã xử lý, nên máy khách đọc quá khứ của một tag từ chính HotLoop. Chỉ biến mà phiên được phép đọc mới được phục vụ. Xem [máy chủ OPC UA](/vi/edge/opc-ua-server/)
- [x] Một nhà công bố CODESYS đối chiếu với nó: HotLoop Transmitter 1.1.0, thư viện công bố UADP của CODESYS, được bên đăng ký này (4.19.2) đọc trên runtime CODESYS Control for Linux SL đang chạy
- [ ] Bảo mật thông điệp (NetworkMessage có chữ ký và mã hóa)
- [x] Khung delta từ nhà công bố, như một tùy chọn (`HOTLOOP_UADP_PUBLISH_DELTA_FRAMES`): chỉ các trường thay đổi giữa các khung khóa. Xem [Giao thức và trình điều khiển](/vi/iot/protocols/)
- [ ] DataSetMetaData và thông điệp khám phá để bên đăng ký có thể đặt tên các trường; trường mảng và cấu trúc trong những gì nhà công bố gửi, và trường cấu trúc trong những gì bên đăng ký đọc; sự kiện
- [ ] Với nhà công bố của Siemens hoặc Beckhoff, và qua router (định tuyến multicast và TTL)

---

## Tương tác với Ignition

Mọi sản phẩm được kiểm tra với bản ổn định hiện tại của Ignition, nên nhà máy chạy Ignition có thể nối HotLoop vào đó.

| Kết nối | Trạng thái |
|---|---|
| Máy khách OPC UA của Gateway → máy chủ OPC UA của Ignition, bảo mật, đã đăng nhập | **Đã kiểm chứng** (4.15.2) |
| Máy khách OPC UA của Ignition → máy chủ OPC UA của Gateway | **Đã kiểm chứng** (27 tháng 9 năm 2026, Ignition 8.3.9 với 4.15.3), mọi chính sách Ignition cung cấp |
| Nút biên Sparkplug của Gateway → Ignition MQTT Engine | Tiếp theo. Cần mô-đun Cirrus Link MQTT Engine 5.x cho 8.3 |
| Edge Relay → Ignition MQTT Engine | Tiếp theo, với cùng mô-đun |
| Gateway làm máy chủ Sparkplug ← Ignition MQTT Transmission | Tiếp theo |

---

## HotLoop Edge

- [x] Image và chart riêng, xem [Sản phẩm](#sản-phẩm)
- [x] Màn hình và logic cục bộ tiếp tục chạy khi uplink hỏng. Một bài kiểm thử khởi động tệp nhị phân Edge thật với uplink Sparkplug trỏ vào một liên kết nuốt hết mọi thứ và không trả lời gì, rồi thao tác màn hình, cổng ghi, một script, một công thức, một tự động hóa, một báo động và thông báo ntfy của nó trên LAN, và trả liên kết lại để xem hàng đợi phát lại. Thứ duy nhất bị chặn vì uplink là việc khởi động nhà công bố biên, và nó kéo sập cả Edge lúc khởi động; đã sửa bằng lưu rồi chuyển tiếp. Bản thân các màn hình HMI đến cùng các bảng điều khiển ở giai đoạn 3
- [x] Các lần ghi từ HMI nêu tên một con người. Trên máy tính của bạn, bạn đã đăng nhập rồi, nên một lần ghi đi thẳng qua và ghi tên bạn. Bảng kiosk dùng chung cho người vận hành đăng nhập bằng PIN hoặc thẻ và đăng xuất khi không hoạt động, vì "panel-3 đã mở van" không phải là dấu vết kiểm toán
- Lần chạy đầu tiên trên mã cũ mất 86% của một sự cố năm phút mà không nói một lời. Giờ thứ tự chính xác, tệp ở dưới giới hạn của nó và mọi số đọc mà giới hạn làm mất đều được đếm. Số liệu có trên trang công bố của Edge

## HotLoop Edge Relay

- [x] **Thực sự phát hành image.** Bản phát hành trước đây chỉ dựng Gateway. Giờ một bản phát hành cũng đẩy `ghcr.io/hotloop-io/hotloop-edge-relay` (amd64 và arm64) và công bố `hotloop-edge-relay` lên cùng kho Helm, và từ chối thẻ mà chart của relay không khớp. Lần đẩy thật đầu tiên diễn ra với thẻ kế tiếp
- [x] **Cập nhật từ xa qua quản lý đội thiết bị.** "Từ xa" có thể thành thật nghĩa là gì thì khác nhau ở mỗi bản cài, nên nó là như vậy. Relay Quadlet theo `:stable` và tự cập nhật của Podman khởi động lại nó lên từng bản phát hành, với một kiểm tra sức khỏe khiến Podman trả lại image cũ nếu image mới không lên được. Một địa điểm có thể chọn giữ lại các bản cập nhật cho đến khi quản trị viên phê duyệt một bản trên Gateway. Relay Helm được cập nhật bằng `helm upgrade`, và tài liệu nói rõ như vậy. Mỗi relay báo phiên bản và digest image của nó, danh sách đội thiết bị hiển thị chúng, và mỗi thay đổi vào nhật ký hệ thống. Đã chứng minh bằng các lần chạy thật của tự cập nhật Podman với registry thật: một bản cập nhật, một bản phát hành không khởi động được đã quay lui, và một bản cập nhật bị giữ rồi được phê duyệt. Cố ý không xây: image có chữ ký hoặc ghim theo digest (Gateway không thể áp đặt cái nào trên một thiết bị nó không với tới; chính sách pull của Podman là nơi chữ ký thuộc về) và triển khai theo giai đoạn (quay lui giới hạn một bản phát hành xấu, và việc giữ các địa điểm cho bạn thứ tự). Xem [tài liệu tham chiếu Edge Relay](/vi/edge-relay/reference/#updating-a-relay)
- [x] **Tải lại cấu hình trực tiếp.** Tệp thiết bị được đẩy xuống từng nằm trên đĩa cho đến khi có gì khởi động lại relay, nghĩa là phải ngắt phiên với broker và mọi phiên thiết bị chỉ để đổi một tag. Giờ nó áp dụng ngay khi tới: thiết bị mới kết nối, thiết bị bị bỏ được thả ra, thiết bị thay đổi kết nối lại, và phần còn lại giữ phiên của mình. Phiên Sparkplug và hàng đợi chuyển tiếp vẫn hoạt động, nút sinh lại với tập số liệu mới, và số liệu bị bỏ được gửi đi trước dưới dạng null để không máy chủ nào kẹt ở giá trị tốt cuối cùng. Tệp xấu bị từ chối và tệp cũ tiếp tục chạy, và `/status` cho biết tệp nào đang chạy và tệp nào bị từ chối.

---

## Đã sửa khi rà soát

Tìm thấy khi rà soát mã và đã sửa trên `main`. Ghi chú phát hành của mỗi phiên bản nói điều gì đã thay đổi với một địa điểm đang chạy.

- [x] **Khôi phục không nạp được bản sao lưu từ lược đồ cũ hơn, và hoàn toàn không kiểm tra `hotloopVersion` của bản sao lưu.** Manifest giờ ghi các cột của mọi bảng và các migration lược đồ đã áp dụng. Khôi phục nạp từng tệp vào các cột đó theo tên, để các cột mới hơn lấy giá trị mặc định, để các bảng mới hơn cho ứng dụng điền, và từ chối bản sao lưu từ lược đồ mới hơn, hoặc có cột mà phiên bản này đã bỏ, đổi tên hoặc đổi kiểu, trước khi nạp một hàng nào. Các bản sao lưu trước đây vẫn được khôi phục theo vị trí. Đã kiểm thử từ mọi mức lược đồ từng có. Đã sửa, xem [Sao lưu và khôi phục](/vi/iot/backup/#khôi-phục-lên-phiên-bản-khác)
- [x] **Webhook thông báo làm lộ URL của nó** trong lỗi, nhật ký, sự kiện kiểm toán và phản hồi của `/api/notify/test`, và URL gõ sai thì lộ trong nhật ký khởi động. Với Discord và ntfy, URL chính là mật khẩu. Đã sửa
- [x] trang thông báo báo động từng nói webhook chung dùng được cho Discord, Pushover và PagerDuty. Không đúng, và giờ nó nói đúng. Đã sửa
- [x] Bộ lọc nhật ký ăn mất từ sau `token:` trong các thông điệp nhật ký thường. Đã sửa, và mọi thông tin xác thực thật sau những tên đó vẫn được ẩn
- [x] Một dải tag bắt đầu từ 0 hiện một dấu gạch cho số 0 trong chú giải Ghi: API bỏ đi giá trị nhỏ nhất bằng không. Giờ nó luôn gửi `minValue`, `maxValue` và `hasRange`, và `list_tags` của MCP gửi dải đúng lúc có dải. Đã sửa
- [x] Các lần chạy kiểm thử cục bộ dùng chung một broker MQTT hoặc một Mailpit giẫm lên nhau: chủ đề Sparkplug va chạm, và email báo cáo của lần chạy này rơi vào hộp thư của lần chạy kia. Mỗi bài kiểm thử giờ có không gian tên chủ đề, hộp thư và địa điểm UniFi riêng, nên các lần chạy song song không thể va chạm. Đã sửa
- [x] Biểu đồ xu hướng và báo cáo bất đồng về dữ liệu xấu: `store.HistoryBuckets` lấy trung bình cả số đọc xấu và không chắc chắn, còn báo cáo loại chúng ra. Cả hai giờ theo quy tắc chất lượng (README, "Quy tắc chất lượng"), và một khoảng không có gì tốt là một chỗ trống trên biểu đồ. Đã sửa
- [x] `HOTLOOP_DB_STATEMENT_CACHE=false` làm hỏng việc tạo thiết bị (`invalid input syntax for type json`), và mọi lần ghi jsonb khác cùng với nó: trên giao thức đơn giản, `[]byte` đi ra dưới dạng bytea. Giờ mọi tham số json đi ra dưới dạng văn bản. Đã sửa
- [x] `writeError` biến mọi lỗi không rõ thành 400, kể cả tắt máy và sự cố cơ sở dữ liệu. Giờ nó là 500 chỉ tới dòng nhật ký mà không làm lộ gì, và mọi lỗi thật sự của bên gọi được đánh dấu ngay nơi nó xảy ra. Đã sửa
- [x] Múi giờ không nạp được rơi về UTC mà không nói gì. Giờ HotLoop từ chối khởi động và nêu tên biến và giá trị, và màn hình Cài đặt vốn đã từ chối một giá trị như vậy. Đã sửa
- [x] Bài kiểm thử sao lưu hai chiều chỉ bao phủ chế độ TimescaleDB. Giờ nó chạy trên mọi cơ sở dữ liệu, và từ mỗi cơ sở dữ liệu sang các cơ sở còn lại: SQLite sang Postgres và ngược lại, phân vùng thường sang hypertable và ngược lại. Đã sửa
- [x] Không có khóa hay giới hạn tốc độ với đăng nhập thất bại. Mười mật khẩu hoặc PIN sai khóa tài khoản năm phút, một bảng điều khiển bị làm chậm thay vì bị khóa, và quản trị viên có thể mở khóa. Đã sửa, xem [Xác thực và người dùng](/vi/iot/authentication/#khóa-sau-khi-nhập-sai-mật-khẩu-và-pin)
- [x] Không có màn hình quản lý người dùng, chỉ có API. Cài đặt giờ có thẻ Người dùng cho ai có `users.manage`: thêm người dùng, đổi vai trò, tắt một người, đặt mật khẩu mới, xóa. Các lần từ chối của chính máy chủ (quản trị viên được bật cuối cùng, tài khoản của chính bạn) hiện trong hộp thoại đúng như vậy. Mật khẩu hơn 72 byte từng trả về từ API là 500; giờ là 400 nêu giới hạn. Đã sửa, xem [Xác thực và người dùng](/vi/iot/authentication/#quản-lý-người-dùng)
- [x] Công bố từ biên không có khối `edgePublish:` trong chart Helm. Giờ đã có: thông tin xác thực qua Secret, hàng đợi trên PVC riêng, triển khai Recreate, và bản kết xuất mặc định không đổi một byte nào
- [x] Email chỉ làm STARTTLS, nên relay ở cổng 465 nhận lời chào văn bản thường và việc gửi chết ở bước bắt tay. Cổng 465 giờ là TLS ngầm định, và `HOTLOOP_NOTIFY_SMTP_IMPLICIT_TLS` ghi đè hành vi cổng theo cả hai hướng. Email báo động và báo cáo theo lịch đều vậy. Đã chứng minh với máy chủ SMTP thật có bộ lắng nghe chỉ TLS và với Mailpit có `--smtp-require-tls`; cổng 465 của nhà cung cấp thương mại chưa được thử. Đã sửa, xem [Thông báo báo động](/vi/iot/notifications/#implicit-tls-port-465)
- [x] Thông tin xác thực của thiết bị nằm trong cơ sở dữ liệu và trong bản sao lưu ở dạng rõ. Mọi thông tin xác thực có khóa (mọi `password`, tiêu đề khóa API) giờ được mã hóa bằng khóa giữ ngoài cơ sở dữ liệu, chart tạo và giữ một khóa, và khôi phục từ chối bản sao lưu mà nó không mở được trừ khi được báo rằng khóa đã mất. Đã sửa, xem [Sao lưu và khôi phục](/vi/iot/backup/#thông-tin-xác-thực-thiết-bị-và-khóa-bí-mật)
- [x] Thông tin xác thực gõ vào địa chỉ của thiết bị hoặc tùy chọn URL (`mqtt://user:pass@host`, `?token=`) hoặc văn bản tự do được lưu ở dạng rõ: mọi màn hình đều ẩn nó, cơ sở dữ liệu và bản sao lưu thì không. Mọi chuỗi chứa một cái như vậy, theo đúng phép thử mà việc che dùng để ẩn nó, giờ được niêm phong toàn bộ, kể cả cột địa chỉ, và một khóa bật về sau niêm phong những gì đã lưu trước đó. Đã sửa, xem [Sao lưu và khôi phục](/vi/iot/backup/#thông-tin-xác-thực-thiết-bị-và-khóa-bí-mật)
- [x] Duyệt OPC UA gán nhãn mọi nút là `float` thay vì đọc kiểu dữ liệu của nó, nên tag văn bản được phục vụ lại qua chính máy chủ OPC UA của chúng tôi trả về `Bad_TypeMismatch`. Ignition 8.3.9 đã phát hiện. Đã sửa (#42)
- Khám phá tag giờ bỏ nó ra. Đặt `browseServerNodes` trên thiết bị để lấy lại, hoặc trỏ `browseRoot` tới `i=2253` để cố ý nhìn vào bên trong. Đã sửa
- [x] Token người dùng X.509 của OPC UA, máy khách và máy chủ. Chứng chỉ mà quản trị viên gắn cho người dùng (Cài đặt, API, MCP) đăng nhập một máy khách vào máy chủ OPC UA của chúng tôi với tư cách người dùng đó, với quyền của họ; thu hồi hoạt động, và mọi lần đăng nhập và từ chối đều vào nhật ký. Tắt cho đến khi đặt `HOTLOOP_OPCUA_SERVER_ALLOW_X509`. Trình điều khiển thiết bị đăng nhập theo cách tương tự với `userCertificate` và `userPrivateKey` (RSA, khóa được niêm phong như mật khẩu). CA tin cậy có quy tắc tên chưa được xây; xem [máy chủ OPC UA](/vi/edge/opc-ua-server/#x509-user-certificates)
- [x] Máy chủ OPC UA của chúng tôi luôn đưa ra các chính sách lỗi thời `Basic128Rsa15` và `Basic256`. Giờ mặc định tắt, với `HOTLOOP_OPCUA_SERVER_ALLOW_DEPRECATED_POLICIES` để bật lại cho máy khách cũ; khi tắt chúng không được liệt kê và kênh nào yêu cầu một cái sẽ bị từ chối. Đã sửa trong một bản sao của thư viện
- [x] Chart ghim TimescaleDB 2.29.1; 2.30.1 đã ra. Đã nâng, các bài kiểm thử chạy trên cùng phiên bản, và phần mở rộng của bản cài hiện có giờ thực sự được cập nhật lúc khởi động thay vì mãi ở phiên bản cũ
- [x] Nhà công bố biên có thể công bố NBIRTH trước khi đăng ký NCMD, điều mà mục 5 của Sparkplug B 3.0 cấm, nên một Rebirth hoặc Reboot tức thì của máy chủ bị bỏ rơi. Fleet có cùng khe hở khi lắng nghe các lần sinh. Đã sửa
- [x] Sparkplug muốn NBIRTH và NDATA ở QoS 0 và chúng tôi công bố chúng ở QoS 1, vì PUBACK là bằng chứng duy nhất rằng broker đã nhận số đọc trước khi hàng đợi chuyển tiếp buông nó. Giờ chúng đi ra ở QoS 0, di chúc NDEATH vẫn ở QoS 1, và một khối chỉ rời đĩa sau khi broker trả lời một yêu cầu gửi phía sau nó, điều mà trên một kết nối có thứ tự chứng minh nó đã đọc mọi thứ phía trước. Một lần ghi QoS 0 vào liên kết chết giờ là một bài kiểm thử: không có xác nhận đó cả 30 số đọc đã rời đĩa. Thư viện máy khách MQTT cũng không còn gửi lại gì sang phiên kế tiếp, vì nhà công bố biên tự kết nối lại trên phiên sạch
- Trình điều khiển giờ rơi về đọc có thăm dò khi một đăng ký mới vẫn im lặng. Đã sửa
- [x] Cùng thư viện: nếu vòng công bố của nó dừng sau khi giá trị đã tới, trình điều khiển vẫn phục vụ các giá trị cuối như tốt, vì thư viện giấu các keep-alive của nó. Sau một quãng im lặng, trình điều khiển giờ đọc các nút và so sánh, và rơi về đọc khi máy chủ giữ thứ mà đăng ký lẽ ra phải gửi. Chính điều kiện tranh chấp, nằm trong thư viện, vẫn cần báo lên thượng nguồn. Đã sửa
- [x] **Mã "không có dữ liệu" của một máy ghi bị đọc như phép đo tốt.** Một kênh Yokogawa DX trả 0x8005 (không xác định) trên `input:1:int16` với tỷ lệ 0.1 đến như tốt, -3276.3, và được lưu lịch sử như một nhiệt độ. Một tag giờ liệt kê các giá trị thô nghĩa là "không có phép đo", mỗi giá trị kèm lý do; một giá trị được kiểm tra trước tỷ lệ và độ lệch và đọc là xấu kèm lý do, và không bao giờ kích hoạt báo động giá trị. Modbus kiểm tra mẫu bit của thanh ghi (mọi độ rộng số nguyên, thứ tự byte và từ, mẫu dấu phẩy động dạng hex), và mọi trình điều khiển khác giải mã số đều kiểm tra cùng danh sách. Đã chứng minh với máy chủ Modbus không phải của chúng tôi, với cả tám mã DX. Đã sửa, xem [Giao thức và trình điều khiển](/vi/iot/protocols/#no-data-values)
- [x] Thiết bị Modbus im lặng khi socket còn mở (rút cáp, PLC treo) bị đánh dấu là suy giảm, không phải ngừng, và các thực thể của nó đứng ở giá trị cuối cho đến khi TCP bỏ cuộc. Giờ nó ngừng trong vòng một lần thăm dò cộng hai lần thời gian chờ. Đã sửa
- [x] S7comm và EtherNet/IP có cùng lối trả về sớm khi một lần thăm dò hết thời gian, nên PLC im lặng khi socket còn mở vẫn ở trạng thái suy giảm thay vì ngừng. Cả hai giờ dừng đọc và đánh giá phiên, như Modbus. Đã chứng minh qua vòng thăm dò với một lần đọc chặn tới hạn chót (nó thất bại với lối trả về cũ và đạt với bản sửa, và một PLC trả lời một số khối vẫn hoạt động), không phải trên đường dây. Đã sửa
- [x] Các bài kiểm thử thiết bị im lặng của S7comm và EtherNet/IP ở trên điều khiển vòng thăm dò, không phải một socket. Giờ chúng chạy trên một socket: các bài kiểm thử khởi động một máy chủ S7 trong tiến trình (kết nối ISO-on-TCP, thiết lập liên lạc, đọc biến) và một máy chủ CIP (RegisterSession, forward open, một lần đọc có kết nối và lần đọc nhiều dịch vụ), mỗi cái trả lời từ một bảng và im lặng theo lệnh, và các trình điều khiển thăm dò chúng qua TCP. PLC im lặng ngừng trong vòng một lần thăm dò cộng hai lần thời gian chờ, cái trả lời một số khối vẫn hoạt động, và hoàn tác bản sửa trước đó làm chúng thất bại. Đã sửa
- [x] **Thiết bị EtherNet/IP có hai tag trở lên trong một lô làm lần thăm dò của nó panic.** Trình điều khiển đọc một lô qua `ReadMulti` của thư viện, hàm nhận một struct các trường có thẻ hoặc một map, và khi đưa tên tag thì nó panic trong reflect trước khi gửi gì. Điều này không bao giờ lộ ra vì không bài kiểm thử nào chạy một lô với một máy chủ. Lô giờ đi qua `ReadList`, và bộ điều khiển không trả lời không còn bị hỏi lại từng tag một, điều từng giữ lần thăm dò một thời gian chờ cho mỗi tag. Đã sửa
- [x] **Một Pin từ trang mở trên Tags đã lưu một bảng chỉ có một tag đè lên bảng thật.** Trang chỉ đọc bảng khi màn hình Bảng mở ra, nên tải lại tại `#tags` giữ một danh sách rỗng và Pin đầu tiên thay bảng của nhà máy bằng đúng tag đó. Trang giờ đọc bảng khi khởi động, Pin và Unpin từ chối cho đến khi nó làm xong, và một lần lưu mang theo `rev` của bảng: máy chủ từ chối lần lưu đè lên bảng đã thay đổi kể từ lúc đọc (`409`), nên một tab cũ cũng không làm được. Đã sửa, xem [API HTTP](/vi/iot/api/#get-apiboard)
- [x] **MCP được phát hành với chế độ ghi tắt.** Máy chủ bật, nhưng `allowMcpWrites` mặc định là false trong mã và trong cả ba chart, nên tác tử chỉ đọc được nhà máy và không hơn, và bật lên còn đòi đặt công tắc thứ hai mà công tắc chính đã bao gồm. MCP giờ đọc và ghi trong mọi sản phẩm HotLoop: core và Flow ra mắt ở trạng thái bật với quyền ghi, và Cascade cũng sẽ vậy khi được xây. `allowMcpWrites` mặc định là true và theo `allowWrites`, vẫn là công tắc chính cho giao diện, API và tác tử như nhau (mặc định tắt); quyền của người dùng, dấu ghi được của tag và dải của nó áp dụng cho tác tử như với màn hình. Tài liệu không còn bảo ai chạy tác tử chỉ đọc. Đã sửa, xem [MCP](/vi/iot/mcp/#writing)
- [x] **MCP đọc được phần lớn những gì nó không thay đổi được.** Hai mươi bảy công cụ ra lệnh cho thiết bị, chạy script và áp dụng công thức, còn bản mẫu chỉ xem trước được mà không biến thành quy tắc được, báo động xác nhận được mà không hoãn được, và không thiết bị, tag, trợ thủ, quy tắc, script, công thức, bảng điều khiển hay mạng UniFi nào tạo hay đổi được. Sáu mươi bốn công cụ giờ làm được, và bốn mươi hai công cụ nữa chạm tới các chức năng riêng của quản trị viên (người dùng, cài đặt, sao lưu, leo thang, đích của historian, đăng nhập broker, đội thiết bị, báo cáo), mỗi cái là một tuyến API chạy qua trình xử lý riêng của nó với quyền mà tuyến đó đòi, một lý do, và tác tử trong nhật ký. Các công tắc ghi thuộc về bản triển khai và không có tuyến, nên tuyến cài đặt từ chối chúng với tác tử như với màn hình. Đã sửa, xem [MCP](/vi/iot/mcp/#changing-configuration)
- [x] **MCP không nhập được bản xuất báo động của CODESYS, không đọc lại được phần lớn những gì nó đổi, và không kiểm tra được nội dung trước khi lưu.** Màn hình báo động nhập tệp Export Alarms của CODESYS, và cách duy nhất làm điều đó từ tác tử là curl. `import_codesys_alarms` xem trước và áp dụng nó qua cùng tuyến, kèm lý do khi áp dụng. Hai mươi bốn lần đọc giờ nằm cạnh các lần ghi chúng thuộc về (định nghĩa báo động, bảng điều khiển, bảng, cây thiết bị, nhãn, thiết bị đã khám phá, phát hiện mạng, broker, tích hợp, bản mẫu, script, lần chạy, các bảng điều khiển UniFi và mạng của chúng), và `validate_automation`, `validate_script` và `browse_device` là các lần chạy thử của trình soạn thảo. Bên gọi mà vai trò ghi loại ra chỉ làm được các lần đọc thông thường. Một trăm sáu mươi ba công cụ. `screen_export` và `screen_import` mang một màn hình giữa các bản cài, việc nhập là chạy thử trừ khi được bảo khác. Đã sửa, xem [MCP](/vi/iot/mcp/#reads-and-dry-runs)
- [x] Điểm cuối MCP mở cho bất kỳ ai tới được cổng khi không đặt `HOTLOOP_MCP_TOKEN` (mọi chart đều đặt một cái; tệp nhị phân trần hay đơn vị Quadlet thì không), và tiến trình chỉ nói điều đó trong nhật ký. Giờ nó tạo một token ở lần khởi động đầu và giữ trong cơ sở dữ liệu, `hotloop mcp-token` in ra, và lời gọi không có nó nhận `401`. Đã chứng minh với tệp nhị phân đã dựng: không token 401, sai 401, đúng 200, vẫn vậy sau khi khởi động lại. Đã sửa, xem [MCP](/vi/iot/mcp/)
- [x] **Mặt trước của switch 8 cổng làm cả trang rộng thêm khoảng 115px trên điện thoại.** Mỗi cột đòi 54px, nên tám cột rộng hơn màn hình và thanh trên cùng cùng mọi thẻ trượt sang bên theo chúng. Một cổng giờ là ô gọn 34px, số watt PoE chuyển từ ô sang chi tiết của cổng và chú giải của nó (biểu tượng tia chớp đánh dấu PoE trên ô), và nếu mặt trước vượt ra ngoài thẻ thì nó cuộn bên trong thẻ. Một bài kiểm thử trình duyệt đưa cho chính mã mặt trước của trang tám cổng ở 390px: rộng hơn 113px trước đó, trang đúng bằng cửa sổ sau đó. Đã sửa

- [x] **Một màn hình UniFi có thể vẽ một con số cũ hơn vết bên cạnh nó.** Tổng quan của màn hình cũ và chi tiết cổng trên cả hai màn hình hỏi con số trước rồi hỏi vết của nó, nên số đọc đến giữa chừng nằm trong vết mà không nằm trong con số ("5 ms" bên cạnh một đường kết thúc ở 6). Giờ chúng hỏi các vết trước. Đã chứng minh trong trình duyệt: thứ tự cũ làm bài kiểm thử thất bại, thứ tự mới đạt, và thứ tự cũ lại thất bại. Đã sửa
- [x] **Đích Kafka hoặc Redpanda có broker từ chối ghi vì thiếu đĩa chỉ nói "records have timed out".** Sau khi hết thời gian chờ, đích hỏi broker một lần tại sao, bằng một produce không mang bản ghi, và nói câu trả lời của nó (Redpanda dưới ngưỡng dung lượng trống: `KAFKA_STORAGE_ERROR`, đĩa dưới broker). Các số đọc không bao giờ mất: chúng được ghi nợ và gửi khi broker nhận ghi lại. Đã chứng minh với Redpanda có ngưỡng đặt cao hơn đĩa của nó, và với Redpanda và Apache Kafka đang chạy tốt để chúng không nói gì. Đã sửa

## Cuối cùng: một giao diện hiện đại

Mục này đứng sau mọi thứ khác trên trang này, có chủ ý. Một giao diện mới là thứ vui nhất để xây và cách dễ nhất để tiêu cả một quý trong khi nhà máy vẫn chưa làm được điều nó cần. Nên nó chờ, và không gì ở trên bị chậm vì nó.

- [x] **Viết lại giao diện web của HotLoop IoT, Edge và Gateway bằng Astro,** cùng framework dựng nên trang web HotLoop. Nó được dựng thành tài nguyên tĩnh nhúng vào tệp nhị phân Go duy nhất, đúng như giao diện hiện nay, nên mỗi sản phẩm vẫn ra mắt như một image với không gì phải cài thêm bên cạnh. Không Node trên thiết bị, không tiến trình thứ hai, không CDN. Mục tiêu là một giao diện hiện đại trên mọi dự án HotLoop, một diện mạo và một bộ thành phần thay vì mỗi thời một màn hình
- [x] **Một đợt thiết kế đi trước.** Trước khi viết một thành phần nào: các màn hình, điều hướng, báo động trông thế nào lúc 3 giờ sáng trên điện thoại, và một hệ thống thiết kế mà trang web và mọi sản phẩm cùng dùng. Viết lại màn hình mà không có nó chỉ chuyển cái bừa bộn sang một framework mới hơn
- [x] **Không có gì thụt lùi.** Mọi màn hình mà các bài kiểm thử trình duyệt điều khiển hôm nay tiếp tục hoạt động và tiếp tục được điều khiển, và API không đổi vì giao diện. Một lần viết lại làm mất màn hình mà ai đó dùng ở sàn sản xuất thì chưa xong

### Hiện trạng

Đã xong, và là mặc định. Giao diện web được dựng từ `web/` (Astro, đảo Svelte, tệp tĩnh nhúng vào tệp nhị phân duy nhất, không Node trên thiết bị) và là thứ `/` phục vụ trên mọi bản cài. Giao diện cũ và các mẫu của nó đã bỏ; `/next` chuyển hướng về gốc cho ai đã đánh dấu.

- [x] Đợt thiết kế: các token chuẩn của HotLoop, biểu trưng chính thức, bốn nhóm màn hình (Vận hành, Nhà máy, Xây dựng, Hệ thống) với thanh bên trên máy tính để bàn và thanh năm tab trên điện thoại
- [x] Ứng dụng điện thoại trong giao diện mới: cài được, giữ trang và các câu trả lời gần nhất, mở khi không có mạng và được đánh dấu là cũ, từ chối gửi bất kỳ thứ gì, và lần truy cập đầu tiên không có kết nối nói điều đó trên màn hình đăng nhập
- [x] Mọi màn hình ngang bằng, được chứng minh trong trình duyệt so với bản cũ
- [x] Các bài kiểm thử trình duyệt đạt với giao diện mới mà không đổi, rồi giao diện mới thành mặc định và `assets/` biến mất
