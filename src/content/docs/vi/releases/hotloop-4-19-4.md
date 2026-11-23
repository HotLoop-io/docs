---
title: "Ghi chú phát hành: HotLoop core 4.19.4"
description: "HotLoop core 4.19.4 có gì mới, điều gì thay đổi khi nâng cấp và nên đọc gì trước khi đụng vào một nhà máy đang chạy."
sidebar:
  label: "4.19.4"
---

4.19.0, 4.19.1, 4.19.2 và 4.19.3 đã được gắn tag nhưng chưa bao giờ được công bố, nên không có gì mang các tên đó và `stable` chưa bao giờ chuyển sang bất kỳ bản nào. Đây là bản phát hành đầu tiên có mọi thứ mà ghi chú của chúng liệt kê, và gồm một điều mới kể từ 4.19.1: các chart nhận `hostNetwork`.

- 4.19.1 thêm bản sửa cho việc đó và một bản nữa (một listener khám phá báo rằng nó đã chạy trước khi nghe được, xem bên dưới) và bị bỏ qua trước khi phát hành.
- 4.19.2 thêm `hostNetwork`.
- Cả hai đều được sửa bên dưới.
- Mọi thứ trong ghi chú của 4.19.0 (MCP, ghi có scale, đăng nhập từ store, CODESYS, luồng sự kiện Kafka, OPC UA PubSub qua UADP và các bản sửa) đều có trong ghi chú bên dưới.

Điều mới kể từ 4.19.1: các chart có thiết lập `hostNetwork`.

## hostNetwork

Mọi chart HotLoop có pod (chart của Gateway, IoT và Edge cùng chart của Edge Relay) nhận `hostNetwork: true`. Mặc định tắt, và khi tắt chart render đúng như chart của 4.19.1.

- **Dùng để làm gì.** Cho một pod cần nghe những gì node của nó nghe: UDP multicast trên loopback của node (một runtime PLC trên cùng hộp publish OPC UA PubSub tới một nhóm multicast qua loopback), hoặc một card mạng thứ hai. Mạng pod không mang cái nào trong hai thứ đó.
- **Nó làm gì.** Deployment nhận `hostNetwork: true` và `dnsPolicy: ClusterFirstWithHostNet`, nên các tên DNS của cluster vẫn phân giải được.
- **Nó có nghĩa gì với pod.** Pod dùng địa chỉ và cổng của node: trang trả lời trên mọi địa chỉ của node ở `service.targetPort`, vì vậy hãy chọn một cổng mà không gì trên node dùng và giữ xác thực bật. NetworkPolicy không áp dụng cho pod dùng mạng host (plugin mạng của cluster bỏ qua chúng). Ghim pod vào node của nó bằng `nodeSelector`.
- **Một listener trên loopback.** Subscriber OPC UA PubSub tham gia một nhóm trên card có tên theo tên hoặc theo địa chỉ: `"interface": "127.0.0.1"` trong tùy chọn của thiết bị tham gia trên card loopback.
- **Không có gì khác.** Mã là mã mà 4.19.1 sẽ phát hành. Chốt chặn của bản phát hành giờ render mọi chart có và không có thiết lập và thất bại nếu một trong hai lần render sai.

---

Phần còn lại của bản phát hành này, từ 4.19.0 và 4.19.1:

Hai điều trong 4.19.4 thay đổi những gì một nhà máy hiện có làm, nên hãy đọc chúng trước khi đụng vào nhà máy đang chạy. Các agent qua MCP giờ có thể ghi, và endpoint MCP luôn có token. Và một giá trị bạn ghi vào tag có scale cuối cùng cũng vào thanh ghi đúng như bạn muốn, nghĩa là ai từng lách hành vi cũ phải dừng lại. Mọi thứ sau hai điều đó là mới hoặc là bản sửa.

Ghi chú đầy đủ nằm trong README: Những gì thay đổi trong 4.19.4.

### MCP được bật, nó ghi được và luôn có token

- **Agent giờ có thể ghi, ở nơi một operator ghi được.** MCP bật trong mọi sản phẩm HotLoop và nó đọc và ghi. `allowMcpWrites` mặc định là true trong mã và trong cả ba chart. Một bản triển khai có `allowWrites` bật và chưa bao giờ đặt `allowMcpWrites` sẽ có ghi từ agent sau lần nâng cấp này, qua cùng cổng như màn hình: quyền của người dùng, dấu ghi được của tag và phạm vi của nó vẫn được áp dụng.
- **`allowWrites` không đổi.** Nó vẫn tắt theo mặc định và vẫn quyết định liệu có gì ghi được hay không, cả giao diện lẫn agent. Nếu nó tắt thì không gì ghi được, kể cả MCP.
- **Một bản triển khai đã lưu `allowMcpWrites: false` vẫn tắt.** Điều đó bao gồm bản cài từ App Store, nơi lưu mọi câu trả lời. Hãy đổi nếu bạn muốn agent ghi.
- **Endpoint không bao giờ mở.** Các chart luôn đặt một token MCP. Một HotLoop khởi động mà không có `HOTLOOP_MCP_TOKEN` (một unit Quadlet, một binary trần) từng phục vụ `/mcp` cho bất cứ ai tới được cổng và chỉ ghi một cảnh báo. Giờ nó tạo một token 24 byte ở lần khởi động đầu và giữ trong cơ sở dữ liệu của nó, nên mọi replica và mọi lần khôi phục mang cùng một token. Một lời gọi không có token là `401`. Token bạn đã cấu hình không bao giờ bị thay thế.
- **Để lấy token trên bản cài trần hoặc Quadlet:** `hotloop mcp-token` in nó ra. Nếu bạn có một agent trỏ tới `/mcp` trên một bản cài như vậy mà không có token, nó ngừng hoạt động ở lần nâng cấp này cho đến khi bạn đưa cho nó token đó. Điều này là có chủ ý.
- **Ai thực hiện lời gọi.** Một token tĩnh cho biết client nào gọi, không bao giờ cho biết người nào. Khi bật thiết lập OIDC, một đăng nhập Vord hoặc một hub assertion trên `/mcp` khiến kiểm toán ghi tên người đó (`mcp:pat@example.com`), và một vai trò ghi tùy chọn thu hẹp việc ghi theo từng người gọi bên trên các công tắc ở trên. Nó tắt trừ khi bạn đặt, và token vẫn hoạt động bên cạnh. [Trang MCP](/vi/iot/mcp/) có phần thiết lập.

### Ghi vào một tag có scale

- **Điều gì đã sai.** Một tag có scale, giả sử 0.1 trên thanh ghi nhiệt độ giữ phần mười độ, cho bạn thấy giá trị kỹ thuật: thanh ghi nói 555 và màn hình nói 55.5. Việc ghi đi theo chiều ngược lại mà không được chăm chút như vậy. Bạn gõ 55.5 làm giá trị đặt và HotLoop đặt 55 vào thanh ghi, rồi nó đọc lại là 5.5. Điều này giống nhau trên mọi màn hình, qua API, từ một tự động hóa, một script, một công thức, một vòng điều khiển và qua MCP, vì tất cả đều đi qua cùng cổng ghi. Hàng kiểm toán nói 55.5 suốt thời gian đó, nên không có gì trông sai trong log.
- **Điều gì thay đổi.** Con số bạn ghi nằm trong đơn vị riêng của tag, giống con số bạn đọc. HotLoop bỏ scale và offset ra trước khi gửi: 55.5 trên một tag scale 0.1 đặt 555 vào thanh ghi và đọc lại là 55.5. Một tag không có scale và không có offset hoàn toàn không bị đụng tới. Bit, coil, chuỗi và các lần ghi Sparkplug và MQTT của một cờ cũng không được scale.
- **Nếu bạn đã lách, hãy dừng.** Nếu ai đó đã gõ số đếm thô vào tag có scale để có con số đúng, gõ 555 để có 55.5, thì giờ điều đó gửi 5550 và đọc lại là 555. Hãy gõ giá trị kỹ thuật. Hãy xem các tag có scale của bạn trước khi nâng cấp: mọi tag có scale khác 1, hoặc có offset, mà ai đó ghi bằng tay, từ một tự động hóa hoặc từ một công thức đều đáng xem. Các công thức và tự động hóa từng ghi số đếm cần đổi số của chúng thành giá trị kỹ thuật ngay trong bước nâng cấp.
- **Giá trị mà thanh ghi không chứa được sẽ bị từ chối.** Sau khi bỏ scale, một số đếm không vừa thanh ghi, 7000 trên `uint16` scale 0.1, bị từ chối bằng thông báo rõ ràng nêu tên số đếm và thanh ghi, và không gì được gửi. Trước đây nó lặng lẽ cuộn vòng: 70000 trên thanh ghi 16 bit đi ra thành 4464. Điều này áp dụng cho các kiểu số nguyên của Modbus, S7, EtherNet/IP và OPC UA.
- **Một công thức có giá trị không vừa bị từ chối toàn bộ.** Trước lần ghi đầu tiên, mọi mục tiêu đều được kiểm tra, nên một công thức không bao giờ áp dụng dở rồi mới từ chối. Với Modbus, S7 và EtherNet/IP, bước kiểm tra biết kiểu thanh ghi của từng tag từ địa chỉ của nó. Với OPC UA, tức đường tới runtime CODESYS, nó dùng kiểu mà số đọc cuối của tag đến với. Một tag chưa bao giờ được đọc kể từ khi HotLoop khởi động thì chưa có kiểu để kiểm tra, nên một công thức nhắm vào nó bị từ chối tại lần ghi của chính tag đó, sau khi các mục tiêu trước nó đã được ghi, và ứng dụng ghi lại là những cái nào. Đọc nó một lần, việc mà vòng thăm dò làm trong vòng một giây sau khi kết nối, sẽ giải quyết việc này.
- **Phần lẻ của một số đếm bị cắt bỏ.** Thanh ghi giữ số đếm nguyên, nên 12.34 trên thanh ghi scale phần mười giữ 12.3, như trước giờ.
- **Điều không đổi.** Kiểm tra phạm vi của tag và hàng kiểm toán dùng con số bạn đã gõ. Cổng ghi, quyền và các quy tắc từ chối giữ nguyên.

### Bản cài từ store đăng nhập bạn bằng chính bạn

Chart từng tạo mật khẩu quản trị ngẫu nhiên trong một Secret mà tenant không đọc được, nên bản cài từ store rơi vào màn hình đăng nhập không có lối vào. Khi khóa công khai của bảng điều khiển được cấu hình, một yêu cầu mang assertion có chữ ký hợp lệ cho tenant này và Service này sẽ đăng nhập người đó, tạo người dùng của họ lần đầu, giữ vai trò của họ khớp với những gì bảng điều khiển gửi, và dấu vết kiểm toán ghi tên họ. Assertion xấu, hết hạn, sai tenant hoặc sai ứng dụng bị từ chối, và đăng nhập cục bộ không bị đụng tới. Nó tắt trừ khi có khóa được đặt, và ba chart sản phẩm lấy khóa từ store. [Xác thực và người dùng](/vi/iot/authentication/) có các thiết lập.

### CODESYS, theo tên mà lập trình viên đặt cho các biến

HotLoop đọc và ghi một PLC CODESYS qua chính máy chủ OPC UA của runtime, như CODESYS ghi trong tài liệu: Symbol Configuration của ứng dụng, được công bố theo mô hình PLCopen IEC 61131-3. Khám phá liệt kê những gì ứng dụng xuất ra cùng kiểu và quyền truy cập mà lập trình viên đã đặt, đi sâu vào mảng và cấu trúc, và một tag là một ký hiệu IEC được tìm thấy dưới bất kỳ tên nào dự án đặt cho PLC và ứng dụng của nó. Khởi động lại, tải xuống hoặc mất liên kết sẽ được đọc là xấu kèm lý do và tự quay lại mà không cần ai can thiệp. Chúng tôi đã kiểm chứng trong thử nghiệm với một runtime thật 4.22.0.0 chạy chương trình của chính chúng tôi, với một lần ghi mà chính logic của PLC trả lời, và với một chương trình thứ hai có hơn một trăm nghìn biến, đọc trong 2.4 giây.

Điều này chạm tới một driver mà các nhà máy đang chạy, nên nói thẳng: driver OPC UA yêu cầu 200 node mỗi yêu cầu và không bao giờ đọc những gì máy chủ cho phép. Một runtime CODESYS công bố OperationLimits là 100 và từ chối nhiều hơn, và driver đáp lại bằng cách khai báo mọi tag được phát hiện là float và không đọc tag nào của một thiết bị có hơn một trăm. Giờ các yêu cầu được cắt theo giới hạn mà máy chủ công bố khi kết nối, và giảm một nửa khi một máy chủ không công bố giới hạn nào nói là quá nhiều. Một kiểu dữ liệu là kiểu con của kiểu chuẩn (STRING, BYTE hoặc TIME của CODESYS) được lần theo tới kiểu chuẩn, nên được gán kiểu và ghi như kiểu đó. Mọi thiết bị OPC UA đều nhận được điều này, không chỉ thiết bị CODESYS.

### Luồng sự kiện Kafka

- **Nó là gì.** HotLoop có thể gửi các số đọc và nhật ký hệ thống của nó tới bất kỳ broker nào nói API Kafka: Apache Kafka, Redpanda và phần còn lại của họ đó. Đây là một loại đích historian mới, trong Settings, Historian targets, nên nó có hàng đợi, việc bắt kịp từ lịch sử riêng của HotLoop và trạng thái mà những đích đó có. Số đọc đi tới một topic và nhật ký hệ thống (cảnh báo, thiết bị lên xuống, thay đổi) đi tới một topic khác, dưới dạng JSON.
- **TLS và SASL.** SCRAM-SHA-256, SCRAM-SHA-512 và PLAIN (PLAIN chỉ qua TLS), với CA riêng của bạn nếu chứng chỉ của broker không đến từ một CA công cộng. Chứng chỉ client, Kerberos và đăng nhập OAuth chưa được hỗ trợ.
- **Ít nhất một lần.** Một số đọc có thể đến hai lần sau khi mất kết nối, vì việc bắt kịp cố ý chồng lên những gì đã gửi đi. `deviceId`, `tag` và `ts` xác định một bản trùng. Sự kiện là luồng trực tiếp và không có lịch sử để bắt kịp, nên một sự kiện được tạo ra khi broker vắng mặt sẽ bị mất, và trạng thái của đích đếm nó.
- **Broker biến mất giữa lúc ghi.** Đích sẽ xuống trong vòng 25 giây và các số đọc trong lần ghi đó được ghi nhận là còn nợ, thay vì vẫn ở trạng thái lên trong khi hàng đợi của nó tràn.
- **Một topic vừa mới tạo.** Lần xem đầu tiên vào một topic vừa được tạo, bởi bạn hoặc bởi lần thử gần nhất của chính đích, sẽ chờ cho nó tồn tại và có leader thay vì báo đích đã xuống.
- **Chi phí.** Khoảng 5 MiB trên binary của mọi sản phẩm có cơ sở dữ liệu. Edge Relay không có đích historian nên không mang nó. Client là franz-go, được ghi công trong `NOTICE`.
- **Nâng cấp.** Migration 0026 thêm cột `options` vào các đích historian, trống với mọi đích hiện có. Không gì thay đổi với chúng. [Đích historian](/vi/iot/historian-targets/#kafka-api-luồng-sự-kiện) có định dạng bản ghi và những gì đã và chưa được kiểm chứng.

### OPC UA PubSub qua UADP

- **Đăng ký.** Một thiết bị có giao thức `opcua-pubsub` lắng nghe các DataSet của một publisher gửi dưới dạng UADP qua UDP, unicast hoặc multicast. Địa chỉ của tag là `<DataSetWriterId>/<field index>`. Các trường Variant, DataValue và RawData, các khung key, delta và keep alive. Một thông điệp bị mất đánh dấu các tag của writer đó là không chắc chắn cho đến khung key tiếp theo của nó, và một writer im lặng được đọc là xấu.
- **Publish.** Edge và Gateway có thể publish các tag mà một layout nêu tên dưới dạng UADP, tắt cho đến khi đặt `HOTLOOP_UADP_PUBLISH_ENABLED`. Khung key khi giá trị thay đổi và keep alive khi không. Một tag xấu được publish dưới dạng trạng thái của nó, không bao giờ là giá trị cuối cùng của nó.
- **Chưa có.** Bảo mật thông điệp (thông điệp có chữ ký hoặc mã hóa) bị từ chối đích danh, cũng như thông điệp phân mảnh, khám phá, sự kiện và trường cấu trúc. Khung delta được đọc nhưng không được gửi.
- **Mảng.** Một trường là mảng được đọc trong thông điệp Variant và DataValue, và trong RawData khi DataSet của thiết bị cho biết nó được bố trí thế nào (`"Float[250]"` cho một mảng có số phần tử, `"Float*250"` cho 250 trường riêng). Một tag nêu tên một phần tử, `1000/3[17]`, và Browse liệt kê chúng.
- **Nó lắng nghe ở đâu.** Nhóm, cổng và card mạng là của riêng thiết bị. Cả nhóm multicast trên một card có tên và một cổng unicast trên máy này đều hoạt động.
- [Giao thức và driver](/vi/iot/protocols/#opc-ua-pubsub-uadp) có phần thiết lập và các giới hạn.

### Image, và bộ màn hình thứ hai

- **Chỉ amd64, lần này.** Image của 4.19.4 được build cho amd64. Tag phiên bản chỉ liệt kê amd64, còn `stable` và `latest` mang image amd64 mới bên cạnh các image arm64 và arm/v7 đã có, vốn là của bản phát hành trước. Một hộp arm bám theo `stable` vẫn tiếp tục kéo và chạy những gì nó đang chạy. Bản phát hành kế tiếp build lại mọi kiến trúc và là một lần tăng phiên bản không có gì khác.
- **Màn hình mới nằm ở `/next`.** Một giao diện web dựng lại có trong mọi image phía sau giao diện cũ, vốn vẫn là thứ bạn nhận ở `/`. Hãy thử nó ở `/next` trên bất kỳ bản cài nào; không gì thay đổi với mặc định.

### Bản sửa

- **Một tiến trình không còn dừng lần chạy kế tiếp của một script bằng chính lệnh dừng của nó quay lại.** Việc dừng một script được thông báo tới mọi tiến trình, kể cả tiến trình đã thực hiện nó, và thông báo nghe lại một lát sau đã hủy lần chạy nào của script đó đang diễn ra: dưới tải, một lần chạy được chờ bị hủy 8 ms sau khi bắt đầu, và một lần khác không bao giờ kết thúc. Một tiến trình bỏ qua lệnh dừng chính nó đã thông báo, còn lệnh dừng do tiến trình khác thông báo vẫn dừng nó.
- **Listener khám phá chỉ lên khi broker đã trả lời các subscription của nó.** Một lần chờ hết hạn từng được tính là một câu trả lời, và một câu trả lời trên kết nối đã mất cũng vậy; cả hai không còn được tính, và một câu trả lời đến muộn vẫn được tính.
- **Listener khám phá báo là đã lên khi nó có thể nghe.** Phiên MQTT tự tính là đã kết nối ngay khi broker chấp nhận, rồi mới đưa các subscription ra và chờ broker cấp. Một listener báo lên vì thế đã gửi thông điệp kế tiếp vào khoảng trống, và trạng thái hoặc cấu hình của thiết bị không được retain bị mất. Giờ nó báo lên khi các subscription được cấp, ở lần kết nối đầu và ở mọi lần kết nối lại.
- **Ghim vào board không còn xóa board.** Trang chỉ đọc board khi màn hình board mở, nên tải lại ở màn hình tag giữ một danh sách rỗng và lần ghim đầu tiên thay board đã lưu bằng đúng tag đó. Giờ trang đọc board khi khởi động, một lần ghim bị từ chối cho đến khi nó làm xong, và một lần lưu mang `rev` của board, nên máy chủ trả lời `409` với lần lưu đè lên board đã thay đổi kể từ khi được đọc. `rev` là tùy chọn trong API: bỏ nó đi thì lần lưu không được kiểm tra.
- **Một subscription OPC UA bị kẹt được phát hiện.** Thư viện giữ keep alive cho riêng nó, nên một vòng publish đã dừng trông như một nhà máy yên tĩnh và phục vụ các giá trị cuối của nó như tốt. Sau mười khoảng publish im lặng (ít nhất ba mươi giây), driver đọc các node một lần, so với những gì nó đang giữ và quay về đọc nếu có node nào khác.
- **PLC im lặng với socket còn mở là đã ngừng, không phải suy giảm.** Modbus, S7 và EtherNet/IP giữ các giá trị cuối cho đến khi TCP bỏ cuộc, vì vòng thăm dò trả về trước khi đánh giá phiên. Giờ chúng đánh giá. Trong thử nghiệm chưa có máy chủ S7 hay CIP nào trên đường truyền, và lộ trình nói rõ như vậy.
- **Thông tin xác thực gõ vào URL hoặc văn bản tự do được mã hóa khi lưu.** Mọi màn hình đã ẩn `mqtt://user:pass@host` và `?token=` khỏi mọi người, nhưng cơ sở dữ liệu và các bản sao lưu giữ chúng như đã gõ. Một chuỗi mang một thứ như vậy, theo cùng phép thử mà việc che dùng để ẩn nó, được niêm phong toàn bộ và trả về đúng như đã viết, nên driver vẫn nhận URL được đưa cho. Một khóa bật sau đó niêm phong những gì đã lưu trước đó, và khôi phục chỉ hỏi khóa khi chỉ một địa chỉ cần đến nó.
- **Mọi thời điểm API ghi đều là UTC.** Một nhà máy đặt ở New York viết `-04:00` ở nơi nhà máy đặt UTC viết `Z`, trên khoảng ba mươi trường: `created_at`, `updated_at`, `raisedAt` của một cảnh báo, thời gian của một sự kiện, `lastPoll` của một thiết bị, dấu thời gian của một tag, một mục logbook, lần chạy tiếp theo của một báo cáo. Giờ chúng đọc giống nhau ở cả hai. Nếu bạn phân tích chúng trong script mong đợi độ lệch cục bộ của bạn, nó giờ nhận `Z`.
- **Phân vùng hàng tháng bị bỏ qua vào ngày 31.** Các bảng lịch sử và logbook tạo phân vùng kế tiếp bằng cách cộng một tháng vào hôm nay, và vào ngày 31 điều đó bỏ qua một tháng, nên các hàng của một tháng nằm trong phân vùng mặc định. Giờ chúng bắt đầu từ ngày mùng một của tháng.
- **Nhật ký sự kiện UniFi được sắp theo thời điểm sự kiện xảy ra,** không phải thời điểm khung đến đây, nên một lần phát lại sau khi kết nối lại không còn nằm trên cùng.
- **Mặt trước của một switch vừa với điện thoại.** Tám cổng rộng hơn màn hình 390 pixel và trang cuộn ngang 113 pixel. Giờ các cổng là ô gọn, với watt PoE nằm trong chi tiết của cổng, và một mặt trước vẫn tràn thẻ của nó sẽ cuộn bên trong thẻ.
- **Điện thoại không có phiên và không có kết nối nhận màn hình đăng nhập và lý do** thay vì một ứng dụng trống, và tải lại khi HotLoop trả lời.
- **Rollback là một lệnh.** Chỉ mục chart được gộp vào chỉ mục đang chạy thay vì dựng lại từ các chart của chính bản phát hành, nên một phiên bản cũ hơn vẫn phân giải được.

### Nâng cấp từ 4.18.11

- Hãy đọc hai mục đầu ở trên trước khi làm bất cứ điều gì trên một nhà máy đang chạy.
- Migration 0026 là duy nhất. Nó là bổ sung và mọi hàng hiện có vẫn hoạt động.
- Một bản cài trần hoặc Quadlet nhận token MCP ở lần khởi động đầu. `hotloop mcp-token` in nó ra.
- `helm upgrade` như thường lệ. Các unit Quadlet bám theo `:stable` và không cần gì. `helm rollback` về 4.18.11 ổn với bản phát hành này: cơ sở dữ liệu đã là PostgreSQL 17 và không gì ở đây thay đổi nó.
