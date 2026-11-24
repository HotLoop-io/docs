---
title: "Máy chủ OPC UA"
description: "Công bố thiết bị và tag đã cấu hình thành không gian địa chỉ OPC UA chỉ đọc, để SCADA bạn đang dùng thấy mọi tag mà không cần trình điều khiển mới."
---

Máy chủ OPC UA của HotLoop, từ phiên bản 4.13.0, công bố các thiết bị và tag đã cấu hình trong Gateway thành một không gian địa chỉ OPC UA. Nhờ vậy một client OPC UA của bên thứ ba, một gói SCADA, một HMI, một historian hay một công cụ kiểm thử như UaExpert có thể đọc các tag trực tiếp của Gateway mà không ai phải viết trình điều khiển HotLoop cho phía bên kia.

Mặc định bật (`HOTLOOP_OPCUA_SERVER_ENABLED`), trong tệp thực thi và trong Helm chart. Máy chủ khởi động với xác thực HotLoop đang bật và một tài khoản đăng nhập riêng, `opcua-reader`, do HotLoop tạo với mật khẩu sinh tự động mà mục Cài đặt hiển thị cho quản trị viên (`GET /api/opcua/server`); tài khoản này chỉ đọc được tag và giá trị, không làm gì khác. Khi xác thực HotLoop tắt thì không có người dùng nào để đăng nhập, nên máy chủ chờ và thông báo điều đó (nó không từ chối khởi động). Nếu cổng 4840 đã bị một máy chủ OPC UA khác trên thiết bị chiếm, nó chờ và thông báo; một cổng bạn tự chọn mà không mở được là lỗi: mở một listener trên mạng nhà máy là việc một lần triển khai làm có chủ ý. Cổng mặc định 4840.

**Máy chủ chỉ đọc.** Xem [Vì sao chỉ đọc](#vì-sao-chỉ-đọc). Máy chủ cũng cung cấp lịch sử của mọi tag: xem [Lịch sử](#lịch-sử).

## Những gì được công bố

Mỗi thiết bị đang bật có một nút **Object**, nằm ngay dưới thư mục *Objects* chuẩn, và mỗi tag đang bật có một nút **Variable** bên dưới thiết bị của nó. Thiết bị và tag đang tắt không được công bố: chúng không có worker và không có giá trị đọc, nên công bố chỉ đặt trước client một nút Bad vĩnh viễn. Không gian địa chỉ chính là những gì runtime đang thăm dò.

Mọi thứ nằm trong một không gian tên duy nhất, `urn:hotloop:ua:gateway`. URI của không gian tên là hằng số, không suy ra từ tên máy chủ hay URI ứng dụng: client lưu một nút dưới dạng URI cộng định danh và tìm lại chỉ số không gian tên ở mỗi lần kết nối, còn một URI đổi theo tên pod sẽ khiến mọi đăng ký trong một dự án SCADA thành mồ côi. Hãy tìm chỉ số trong mảng không gian tên của máy chủ theo URI, như một client thật làm; đừng mặc định là `ns=2`.

### NodeIds

Định danh là chuỗi và ổn định:

| Nút | Định danh NodeId |
|---|---|
| Thiết bị | `<deviceId>` |
| Tag | `<deviceId>/<tagName>` |
| Thuộc tính `EngineeringUnits` / `EURange` của một tag | `~EngineeringUnits/<deviceId>/<tagName>` và `~EURange/…` |

Dạng của tag là `model.TagKey.String()`, cách viết `device/tag` mà phần còn lại của mã đã dùng, nên NodeId và khóa tag chuyển qua lại được bằng `model.ParseTagKey`. Dấu phân cách `.` sẽ không hoạt động: id thiết bị có thể chứa dấu chấm, nên `a.b.c` có thể là thiết bị `a` với tag `b.c` hoặc thiết bị `a.b` với tag `c`. Id thiết bị không thể chứa dấu gạch chéo, nên dấu gạch chéo đầu tiên luôn là ranh giới, và tên tag có dấu gạch chéo (đường dẫn duyệt OPC UA và topic MQTT có) vẫn được gán đúng thiết bị. Id thuộc tính bắt đầu bằng `~`, điều mà id thiết bị không thể, nên thuộc tính không bao giờ trùng với một tag, dù tag tên là gì.

### Thuộc tính

| Thuộc tính | Giá trị |
|---|---|
| `BrowseName` | id thiết bị / tên tag, trong không gian tên HotLoop |
| `DisplayName` | tên thiết bị / tên tag |
| `Description` | mô tả của thiết bị hoặc tag |
| `DataType` | xem bên dưới |
| `ValueRank` | vô hướng (-1) |
| `AccessLevel`, `UserAccessLevel` | chỉ `CurrentRead` (0x01) |
| `MinimumSamplingInterval` | chu kỳ thăm dò hiệu lực của thiết bị tính bằng ms; giá trị không thể đổi nhanh hơn tốc độ runtime thăm dò, nên client yêu cầu tần suất lấy mẫu nhanh hơn sẽ được nâng lên mức đó |
| `Historizing` | false |

Tag có đơn vị nhận thuộc tính `EngineeringUnits` (`EUInformation`, id đơn vị -1 = "không phải mã UNECE", văn bản đơn vị trong `DisplayName`), và tag có dải nhận thuộc tính `EURange`. Tag không có cả hai thì không có thuộc tính nào.

### Kiểu dữ liệu

Runtime quy mọi giá trị đọc dạng số về float64 theo đơn vị kỹ thuật, nên kiểu khai báo là lựa chọn về cách hiển thị, được quyết định trong `kindForTag`, và phải là kiểu mà giá trị luôn biểu diễn được:

| `dataType` của tag | Kiểu OPC UA |
|---|---|
| `bool`, `boolean`, `bit`, `coil`, `discrete` | Boolean |
| `string`, `text`, `char` | String |
| `int16` | Int16 |
| `uint16`, `word` | UInt16 |
| `int32`, `dint` | Int32 |
| `uint32`, `dword` | UInt32 |
| `uint64` | UInt64 |
| `int`, `int64` | Int64 (kiểu có dấu rộng nhất, nên không có gì bị tràn) |
| mọi kiểu khác, kể cả `float` | Double |
| **mọi kiểu số nguyên có hệ số tỉ lệ hoặc độ lệch** | **Double** |

Hàng cuối rất quan trọng: một thanh ghi `int16` với hệ số 0,1 đọc ra 23,4, và cắt nó về Int16 sẽ đưa cho client số 23 với trạng thái Good. Một giá trị không vừa kiểu đã khai báo, chẳng hạn tag `int16` trả về 70000, được báo là `BadOutOfRange` không kèm giá trị, không bao giờ bị cuộn vòng hay cắt thành thứ trông có vẻ hợp lý. Tag số mà giá trị đọc mang văn bản là `BadTypeMismatch`.

### Giá trị, chất lượng và dấu thời gian

Mỗi lần đọc (và mỗi mẫu của một đăng ký) được trả lời từ bộ nhớ đệm trực tiếp của runtime, cùng nguồn mà `/api/values` phục vụ, không bao giờ từ cơ sở dữ liệu. Mã trạng thái được suy ra từ giá trị đọc đó **và trạng thái liên kết thiết bị phía sau nó**, vì chỉ riêng bộ nhớ đệm là chưa đủ: nó giữ giá trị đọc cuối cùng mà thiết bị trả về, và một thiết bị đã rơi khỏi mạng vẫn có giá trị đọc cuối trông hoàn toàn tốt.

| Liên kết thiết bị | Giá trị đọc | Trạng thái | Giá trị |
|---|---|---|---|
| Đã kết nối, ít nhất một lần thăm dò đã giao trong phiên này | tốt | **Good** | được gửi |
| | không chắc chắn | Uncertain | được gửi |
| | xấu, hoặc chất lượng không nhận ra | Bad | không có |
| Đã kết nối, chưa có lần thăm dò nào được giao trong phiên này | bất kỳ | BadWaitingForInitialData | không có |
| Đã kết nối, bộ nhớ đệm hoàn toàn trống | n/a | BadWaitingForInitialData | không có |
| Suy giảm (phiên còn, thăm dò lỗi hoặc không đầy đủ) | tốt | **UncertainLastUsableValue** | được gửi |
| | không chắc chắn | Uncertain | được gửi |
| | xấu | Bad | không có |
| Đã ngắt kết nối, đang kết nối, đã tắt | bất kỳ | **BadNoCommunication** | không có |
| Không có worker cho thiết bị | bất kỳ | BadOutOfService | không có |
| Tag hoặc thiết bị đã bị gỡ | n/a | BadNodeIdUnknown | không có |

Good chỉ được báo cho thiết bị đã kết nối, ở lần thăm dò của phiên hiện tại, khi giá trị đọc là tốt. Tag trên thiết bị đã ngắt kết nối đọc ra Bad, không phải giá trị cuối kèm trạng thái Good.

Tuổi của dữ liệu cố ý không được tính. Các nguồn hướng sự kiện (tag MQTT/Sparkplug, đăng ký OPC UA) hoàn toàn có thể giữ một giá trị hàng giờ vì không có gì đổi, và gọi nó là cũ theo đồng hồ là sai; việc thiết bị còn gửi dữ liệu hay không là việc của liên kết.

**Dấu thời gian nguồn** là dấu thời gian riêng của giá trị đọc, lúc cuối cùng nhận được tin từ thiết bị, và nó được báo cả khi trạng thái là Bad. **Dấu thời gian máy chủ** là lúc lần đọc được trả lời. Cả hai đều theo UTC.

## Đăng ký

Client có thể tạo đăng ký và mục giám sát trên biến tag và nhận thông báo thay đổi dữ liệu, đó là cách client SCADA thực sự dùng tag. Trong thư viện này, việc giám sát theo cách lấy mẫu: máy chủ đọc từng mục giám sát theo chu kỳ lấy mẫu của nó (ít nhất 100 ms, và ít nhất bằng chu kỳ thăm dò của thiết bị) qua cùng bộ xử lý mà một lần đọc dùng, và thông báo khi giá trị hoặc trạng thái thay đổi. Vì vậy thay đổi về *chất lượng*, như một thiết bị rớt mạng, được thông báo giống hệt thay đổi về giá trị.

Mục giám sát trên một tag bị gỡ không bị bỏ lửng: nó nhận `BadNodeIdUnknown`.

## Client thấy gì khi cấu hình thay đổi

Khi một tag bị gỡ, các lần đọc và mục giám sát trên nó nhận `BadNodeIdUnknown` ngay, và nó biến mất khỏi việc duyệt thiết bị của nó ngay. Bản thân nút vẫn nằm trong bảng nút của máy chủ khoảng 5 giây sau đó, không truy cập được, rồi bị xóa. Một thiết bị bị gỡ hoạt động tương tự dưới thư mục Objects.

Một lần chỉnh sửa không bao giờ để lại khoảng trống. Tag hoặc thiết bị đã chỉnh sửa được thay bằng phiên bản mới dưới cùng NodeId trong một bước, nên lần đọc hay duyệt vào lúc đó thấy phiên bản cũ hoặc mới, không bao giờ là "không rõ". Các đăng ký trên đó vẫn tiếp tục.

Độ trễ trước khi xóa không phải để trang trí. Browse của thư viện đọc danh sách tham chiếu của một nút rồi tra từng đích mà không giữ khóa giữa hai việc, và nếu một đích biến mất ở giữa, việc duyệt *nút cha* thất bại với `BadNodeIdUnknown`, như thể thiết bị hoặc thư mục Objects không tồn tại. Trước đây chúng tôi xóa nút ngay, và client đang duyệt một thiết bị trong lúc một tag bị gỡ, hoặc đang đọc một tag trong lúc thiết bị của nó được chỉnh sửa, có thể bị báo rằng một nút hoàn toàn có thật không tồn tại.

## Vì sao chỉ đọc

Bước này không triển khai việc ghi, và nói điều đó ở ba nơi cùng lúc để không một thay đổi đơn lẻ nào có thể lặng lẽ thêm nó vào:

- mọi nút được công bố có `AccessLevel = CurrentRead | HistoryRead` và không có bộ xử lý ghi nào được cài, nên một lần ghi bị từ chối bằng `BadNotWritable` và client có thể thấy trước khi thử rằng nút không ghi được;
- các bài kiểm thử ghi vào một tag với tư cách viewer, operator và admin, và xác nhận câu trả lời là `BadNotWritable` **và thanh ghi trên thiết bị phía sau tag không thay đổi**.

Một đường ghi OPC UA sẽ phải đi qua cổng đó, đưa principal của nó vào dấu vết kiểm toán và tôn trọng công tắc tổng. Đó là một thay đổi có đợt xem xét riêng, không phải thứ đến như sản phẩm phụ của việc công bố tag, và phiên bản này cố ý không có cài đặt nào bật nó.

## Lịch sử

Mọi nút tag đều được lưu lịch sử và mang mức truy cập HistoryRead. Máy chủ trả lời dịch vụ HistoryRead của OPC UA từ lịch sử riêng của HotLoop, cùng những giá trị đọc mà `/api/history` phục vụ, nên client ở đầu bên kia của kết nối OPC UA đọc được những gì Gateway đã lưu mà không cần cơ sở dữ liệu thứ hai. Người dùng cần những gì một lần đọc giá trị cần (`tags.read` và `values.read`), được kiểm tra như một lần đọc giá trị, cho người dùng của phiên, chứ không chỉ một lần lúc đăng nhập.

- **Raw** (`ReadRawModifiedDetails`): các giá trị đọc trong một cửa sổ, mỗi giá trị có chất lượng riêng làm trạng thái và dấu thời gian riêng. Điểm bắt đầu trước điểm kết thúc thì đọc xuôi, điểm bắt đầu sau điểm kết thúc thì đọc ngược, mới nhất trước. Điểm bắt đầu được tính và điểm kết thúc bị loại (OPC UA 10000-11, mục 4.6), trừ khi client yêu cầu biên, khi đó thêm giá trị đọc tại hoặc ngay trước điểm bắt đầu và giá trị đọc đầu tiên ngoài cửa sổ ở điểm kết thúc. `NumValuesPerNode` là số lượng một lần gọi trả về cho một nút; nhiều hơn thế, hoặc hơn 10.000, được trả theo trang, mỗi trang có một điểm tiếp tục dùng được năm phút và chỉ một lần (giữ tối đa 1.000 cùng lúc). Cửa sổ không có gì là `Good_NoData`. Lịch sử đã sửa đổi bị từ chối (`BadHistoryOperationUnsupported`): ở đây không có gì bị sửa hay xóa.
- **Processed** (`ReadProcessedDetails`): Average, Minimum, Maximum, Count, Start, End và Total, trên các khoảng `ProcessingInterval` tính từ thời điểm bắt đầu, theo quy tắc chất lượng (README, "The quality rule"): chỉ các giá trị đọc tốt có số hữu hạn mới được tính. Khoảng không có giá trị nào là `Good_NoData` (Count cho 0), và khoảng có giá trị đọc bị loại đọc ra `Uncertain_DataSubNormal`, nên con số không bao giờ tốt hơn những gì có trong đó. Phép tổng hợp khác bị từ chối cho nút đó (`BadAggregateNotSupported`), tag chuỗi không có phép nào, và cửa sổ hơn 10.000 khoảng hoặc 500.000 giá trị đọc bị từ chối (`BadTooManyOperations`) thay vì bị cắt ngắn. Chỉ cửa sổ xuôi có đủ hai đầu mới được trả lời.
- **At time** (`ReadAtTimeDetails`): tag có giá trị gì tại từng thời điểm, tức giá trị đọc cuối cùng tại hoặc trước thời điểm đó, đóng dấu thời gian là thời điểm được hỏi. Không bao giờ nội suy, vì một giá trị đọc là giá trị ai đó đã lấy; thời điểm trước giá trị đọc đầu tiên của tag là `Bad_NoData`.
- **Sự kiện** không được phục vụ: `BadHistoryOperationUnsupported`. Thiết bị hay đối tượng khác cũng không có lịch sử, và nút thuộc tính (`EngineeringUnits`, `EURange`) không mang HistoryRead.

Historian lưu một giá trị đọc khi nó vượt khỏi vùng chết, không phải mỗi lần thăm dò, nên một tag yên tĩnh có ít dòng: hãy đọc At time, hoặc một cửa sổ Processed quanh giá trị đọc cuối của tag, khi cần biết nó đã có gì chứ không chỉ khi nào nó đổi. `HistoryServerCapabilities` cho biết có thể đọc lịch sử và một lần gọi trả về tối đa 10.000 giá trị.

## Tình trạng máy, cho bảng điều khiển EmberNet

Task Manager của bảng điều khiển đọc CPU, bộ nhớ, ổ đĩa và độ trễ biến thiên thời gian thực của một máy từ chính máy đó: HotLoop công bố chúng thành một thiết bị và máy chủ phục vụ lịch sử của chúng ([Lịch sử](#lịch-sử)), nên bảng điều khiển không bao giờ đọc cơ sở dữ liệu của chính nó cho việc này. Những gì đã được xây dựng, và cách bật:

* **Thiết bị.** Khi `HOTLOOP_BOX_HEALTH_NODE` được đặt (chart đặt nó là tên của nút Kubernetes), HotLoop tạo một thiết bị có id đúng bằng tên đó, với giao thức `boxhealth` ([Giao thức và trình điều khiển](/vi/iot/protocols/#tình-trạng-máy)). Các tag của nó là `cpu_util_pct`, `mem_util_pct`, `disk_util_pct` (ổ đĩa riêng của máy), `data_util_pct` (ổ lưu trữ nơi HotLoop giữ dữ liệu) và, chỉ khi `HOTLOOP_BOX_HEALTH_JITTER_FILE` trỏ tới tệp JSON mà một tác tử thời gian thực ghi, `rtos_jitter_core1_us`, `rtos_jitter_core2_us` và `rtos_jitter_core3_us`. Id nút OPC UA của chúng nằm trong không gian tên `urn:hotloop:ua:gateway` với định danh chuỗi `<device id>/<tag>`.
* **Các con số của máy.** Chart gắn thư mục gốc của máy chủ tại `/host` và `/proc` của nó tại `/host/proc`, cả hai chỉ đọc, và đặt tên nút, **theo mặc định** (`opcuaServer.dashboard.boxHealth.enabled: true`), nên Task Manager của bảng điều khiển chạy ngay khi HotLoop được cài. Chỉ một statfs của `/host` cùng bộ đếm CPU và bộ nhớ được đọc, và không thêm đặc quyền nào. Cụm áp dụng cấu hình Pod Security restricted sẽ từ chối hostPath: ở đó hãy đặt `enabled: false` (không thiết bị, không gắn kết) hoặc `hostMount: false` (có thiết bị, nhưng ổ đĩa và CPU của máy đọc ra Bad và cho biết cần gắn gì). Thiết bị không cần máy chủ OPC UA.
* **Một tài khoản chỉ đọc được và không gì khác.** Chart tạo người dùng `embernet-dashboard-read` với đúng `tags.read` và `values.read` (danh sách quyền tường minh, không bao giờ là vai trò) ở lần cài đầu, và giữ mật khẩu sinh ra của nó trong Secret `<release>-opcua-dashboard` (các khóa `username`, `password` và `password-hash`). Nâng cấp không bao giờ xoay vòng nó. Tài khoản đã tồn tại không bao giờ bị khởi động lại làm thay đổi.
* **Chứng chỉ của bảng điều khiển.** Bảng điều khiển tạo Secret `<release>-opcua-trust`, mỗi chứng chỉ một khóa đặt tên `<sha1 thumbprint>.crt`. Chart gắn nó, tùy chọn, tại `/etc/hotloop/opcua-trust`, và máy chủ giữ các tệp đó trong `trusted/` (`HOTLOOP_OPCUA_SERVER_TRUST_DIR`): lúc khởi động và mỗi 30 giây, tệp mới được thêm, tệp đã đổi được ghi lại, và tệp rời khỏi Secret bị gỡ ra. Tệp mà một vận hành viên đặt vào `trusted/` không bao giờ bị động tới, và thắng khóa Secret cùng tên.
* **Cổng.** Service của chính bản phát hành (cái mà bảng điều khiển phát hiện) liệt kê cổng OPC UA 4840 khi máy chủ bật, bên cạnh Service riêng của máy chủ OPC UA.

Máy chủ vẫn như trước: Basic256Sha256 SignAndEncrypt, không có phiên ẩn danh, không tin tất cả.

## Mô hình bảo mật

### Truyền tải

Kênh bảo mật dùng các chính sách của thư viện ở Sign và SignAndEncrypt. **`Basic256Sha256` được cung cấp ở cả hai chế độ**, và đây là điều client nên chọn.

**Chính sách bảo mật None là lựa chọn bật tường minh** (`HOTLOOP_OPCUA_SERVER_ALLOW_INSECURE`, mặc định false), có cảnh báo khi khởi động nếu bật. Khi tắt, không có điểm cuối None nào được quảng bá, và client vẫn mở kênh None chỉ có thể khám phá: mọi dịch vụ khác đều bị từ chối. Ngay cả khi bật, tên đăng nhập và mật khẩu vẫn đi trong một token được mã hóa (chính sách token là `Basic256Sha256`, không bao giờ là None), dù mọi giá trị client đọc sau đó không được bảo vệ.

**Các chính sách lỗi thời mặc định tắt.** OPC Foundation đã coi `Basic128Rsa15` (RSA với đệm PKCS#1 v1.5) và `Basic256` (SHA-1) là lỗi thời. Ở các bản phát hành trước, cả hai được cung cấp trong mọi danh sách điểm cuối mà không có cách gỡ. `HOTLOOP_OPCUA_SERVER_ALLOW_DEPRECATED_POLICIES` (chart: `opcuaServer.allowDeprecatedPolicies`, mặc định `false`) quyết định:

- **Tắt (mặc định, cho cài mới và nâng cấp).** Không chính sách nào nằm trong điểm cuối được báo cho client, và client mở kênh bảo mật bằng một trong hai bị từ chối ngay khi mở kênh, trước mọi phiên hay đăng nhập. Client dùng `Basic256Sha256`, `Aes128_Sha256_RsaOaep` hoặc `Aes256_Sha256_RsaPss` không bị ảnh hưởng.
- **Bật.** Cả hai lại được cung cấp ở Sign và SignAndEncrypt, cho client cũ không nói được gì mới hơn, kèm cảnh báo khi khởi động. Chỉ bật cho đến khi client đó được cập nhật.

Client ngừng kết nối sau khi nâng cấp và đang dùng một trong hai chính sách này sẽ thấy kênh bị từ chối; hãy đặt cài đặt, hoặc chuyển client sang `Basic256Sha256`.

### Chứng chỉ máy chủ

Nếu `HOTLOOP_OPCUA_SERVER_CERT_FILE` và `_KEY_FILE` được đặt, cặp RSA đó được dùng nguyên trạng. Nếu không, **một chứng chỉ thể hiện ứng dụng tự ký được tạo ở lần khởi động đầu và được lưu** dưới `HOTLOOP_OPCUA_SERVER_PKI_DIR` (`own/cert.pem`, `own/key.pem`, khóa chế độ 0600), nên lần khởi động sau trình ra cùng chứng chỉ và client từng được bảo tin cậy nó một lần sẽ không bị hỏi lại. Mỗi lần khởi động, khi chứng chỉ còn tự ký, một cảnh báo được ghi kèm dấu vân tay SHA-1, dạng mà các công cụ OPC UA hiển thị, để vận hành viên so với những gì client hiển thị.

Chứng chỉ nói những gì client OPC UA kiểm tra, điều mà chứng chỉ TLS thông thường không làm: **URI ứng dụng** (`HOTLOOP_OPCUA_SERVER_APPLICATION_URI`, mặc định `urn:hotloop:gateway`, cộng `:<siteId>` khi đã cấu hình) trong các tên thay thế chủ thể kiểu URI, tên máy chủ và địa chỉ mà client dùng (máy chủ của điểm cuối, `HOTLOOP_OPCUA_SERVER_CERT_HOSTS`, `localhost`, loopback, tên máy chủ của máy này) làm SAN DNS và IP, và các mục đích sử dụng khóa mà Phần 6 liệt kê cho một thể hiện ứng dụng. RSA-2048, năm năm.

Chứng chỉ đã lưu chỉ bị thay, kèm cảnh báo rằng client phải tin cậy chứng chỉ mới, nếu nó không còn làm tròn việc: còn dưới 30 ngày, URI ứng dụng không còn khớp cấu hình, một máy chủ đã cấu hình mà nó không bao phủ, hoặc khóa không đọc được.

**Tên máy chủ của máy không phải là máy chủ đã cấu hình.** Nó được đưa vào chứng chỉ mới, nhưng chứng chỉ đã lưu được giữ khi tên máy chủ đổi. Trong container, tên máy chủ là id của container, và trong Kubernetes là tên pod, nên nó đổi ở mỗi lần triển khai lại. Cho đến khi điều này được sửa, nó được tính, và mỗi lần nâng cấp Gateway chạy trong container tạo một chứng chỉ mới: Ignition, đã được bảo tin cậy chứng chỉ cũ, từ chối máy chủ với `Bad_SecurityChecksFailed` cho đến khi ai đó tin cậy lại, trên mọi client, sau mỗi lần triển khai. Client tới máy chủ qua `HOTLOOP_OPCUA_SERVER_ENDPOINT_HOST` và `_CERT_HOSTS`; hãy đặt chúng, và chứng chỉ sống đến khi gần hết hạn. (Gateway không đặt máy chủ điểm cuối dùng tên máy chủ của máy làm máy chủ điểm cuối, và cái đó có được tính, vì đó là điều client được báo. Thêm một lý do để đặt nó.)

**Một khóa có thể không dùng được, và máy chủ từ chối nó.** Khoảng một trong hai mươi khóa RSA không thể mang một đăng nhập OPC UA được mã hóa, và mọi đăng nhập mã hóa với khóa đó khi ấy đều thất bại, lần nào cũng vậy, client chỉ thấy "kênh bảo mật đã bị đóng". Phiên ẩn danh và không mã hóa không bị ảnh hưởng, nên rất dễ chẩn đoán nhầm. Khóa được sinh ra sẽ được rút lại cho đến khi không còn là một trong số đó; khóa do vận hành viên cung cấp mà là loại này bị từ chối lúc khởi động kèm lỗi nói rõ lý do.

### Chứng chỉ ứng dụng của client

OPC UA xác thực cả ứng dụng lẫn người dùng. Máy chủ giữ danh sách tin cậy trong `<PKI_DIR>/trusted/`: client có chứng chỉ không nằm ở đó bị từ chối tại kênh bảo mật, và chứng chỉ của nó được ghi vào `<PKI_DIR>/rejected/`. **Để chấp thuận một client, hãy chuyển chứng chỉ của nó từ `rejected/` sang `trusted/`**, không cần khởi động lại; thư mục được đọc ở mỗi lần kết nối. `<PKI_DIR>/issuers/` và `<PKI_DIR>/crl` được chuyển tiếp cho chứng chỉ client do CA cấp.

`HOTLOOP_OPCUA_SERVER_TRUST_ALL_CLIENT_CERTS` (mặc định false, có cảnh báo khi khởi động) bỏ qua bước này. Nó chỉ bỏ xác thực ứng dụng: người dùng vẫn phải xác thực bằng tên đăng nhập và mật khẩu HotLoop.

### Ai được đăng nhập

**Tên đăng nhập và mật khẩu, đối chiếu với người dùng của chính HotLoop.** Chỉ có một cơ sở dữ liệu người dùng, không có kho thông tin xác thực thứ hai: bộ xác thực tra người dùng bằng cùng `store.User` mà đăng nhập HTTP dùng, so sánh với cùng các mã băm bcrypt (`auth.CheckPassword`), chuẩn hóa tên đăng nhập như vậy (chữ thường, bỏ khoảng trắng hai đầu), chạy một phép so sánh bcrypt dù người dùng có tồn tại hay không để thời gian phản hồi không lộ tên nào là thật, và từ chối tài khoản đã tắt. Người dùng không rõ, sai mật khẩu, người dùng đã tắt và người dùng không có quyền đều nhận cùng một câu trả lời, `BadUserAccessDenied`.

**Người dùng chỉ đọc được tag nếu vai trò của họ cấp `tags.read` và `values.read`**, cùng cặp mà API HTTP dùng để bảo vệ `/api/tags` và `/api/values`, được xác định qua cùng `auth.Permissions` và `auth.Allows`, nên vai trò dựng sẵn và danh sách quyền tường minh hoạt động đúng như ở đó. Cần cả hai vì client OPC UA duyệt danh sách tag và đọc giá trị qua một kết nối, và người dùng chỉ có một trong hai sẽ nhận cái còn lại miễn phí. Mọi vai trò dựng sẵn có `values.read` đều có `tags.read`; điều này chỉ có ý nghĩa với người dùng có danh sách quyền tường minh.

**Quyền được kiểm tra khi dùng, không chỉ khi đăng nhập.** Thư viện hỏi vai trò của phiên ở mỗi lần duyệt, đọc và lấy mẫu đăng ký; chúng được trả lời từ một bộ nhớ đệm ngắn hạn (10 s) của cơ sở dữ liệu người dùng. Người dùng bị tắt, bị xóa hoặc bị gỡ quyền mất truy cập trên phiên đang chạy trong khoảng đó, các mục giám sát chuyển sang Bad, thay vì khi client kết nối lại lần sau. Một lần tra cứu thất bại được tính là "không".

**Phiên ẩn danh tắt** (`HOTLOOP_OPCUA_SERVER_ALLOW_ANONYMOUS`) và không có token ẩn danh nào được cung cấp trừ khi chọn bật, có cảnh báo khi khởi động. Token danh tính người dùng X.509 cũng tắt, và được cung cấp khi đặt `HOTLOOP_OPCUA_SERVER_ALLOW_X509` (xem [Chứng chỉ người dùng X.509](#chứng-chỉ-người-dùng-x509)). Nếu xác thực riêng của HotLoop tắt (`HOTLOOP_AUTH_INSECURE`), không có người dùng nào để đăng nhập, và máy chủ từ chối khởi động trừ khi truy cập ẩn danh được bật.

Đăng nhập thành công được ghi vào nhật ký hệ thống như đăng nhập HTTP. Đăng nhập thất bại chỉ được ghi vào nhật ký tiến trình, kèm lý do, để người gọi chưa xác thực không thể làm đầy dấu vết kiểm toán. Tối đa bốn lần kiểm tra mật khẩu chạy cùng lúc, vì mỗi lần là một phép so sánh bcrypt cố ý chậm và OPC UA không có bộ giới hạn tốc độ tương đương đặt trước HTTP; ngoài ra không có khóa tài khoản hay giới hạn tốc độ, như đăng nhập HTTP.

Thư viện giữ danh tính người dùng đã giải mã, kể cả mật khẩu, trong đối tượng phiên suốt thời gian phiên còn sống. Nó chỉ nằm trong bộ nhớ và không bao giờ được ghi lại, nhưng một bản dump heap của Gateway đang chạy sẽ chứa mật khẩu của những người dùng đang kết nối.

**Mật khẩu có độ dài bất kỳ mà HotLoop chấp nhận, tối đa 72 byte (giới hạn của bcrypt), đều đăng nhập được.** Ở các bản phát hành trước, mật khẩu 65 đến 72 byte đăng nhập được vào giao diện web nhưng không đăng nhập được ở đây (`BadIdentityTokenRejected`). Độ dài tính mật khẩu cộng nonce 32 byte của máy chủ, nên mật khẩu dừng ở 64 byte. Không có gì trong RSA hay đặc tả đòi hỏi điều đó: token được mã hóa thành bao nhiêu khối tùy cần và bộ giải mã đã đọc hết các khối. Phép kiểm tra giờ là độ dài tối thiểu 32 và không lớn hơn số byte thực sự được giải mã, đúng điều mà phép kiểm tra phải đảm bảo, vì nó định cỡ bộ đệm được tạo tiếp theo. Độ dài khai báo nhiều hơn những gì đã đến vẫn bị từ chối, nên client không thể khiến máy chủ cấp phát thứ nó không gửi. Nhánh `main` thượng nguồn (kiểm tra 2026-11-16) vẫn còn giới hạn; thay đổi được đề nghị lên thượng nguồn dưới dạng pull request từ HotLoop-io/opcua.

### Chứng chỉ người dùng X.509

Client có thể đăng nhập bằng chứng chỉ thay vì mật khẩu. Mặc định tắt: đặt `HOTLOOP_OPCUA_SERVER_ALLOW_X509=true` (chart `opcuaServer.allowX509`), và máy chủ cung cấp token người dùng Certificate trên các điểm cuối bảo mật của nó và nói điều đó khi khởi động. Không đặt thì không điểm cuối nào cung cấp và đăng nhập bằng chứng chỉ bị từ chối.

**Chứng chỉ được ánh xạ tới người dùng thế nào.** Quản trị viên đính kèm chứng chỉ vào một người dùng HotLoop: Cài đặt, Chứng chỉ OPC UA, Đính kèm chứng chỉ (hoặc qua API, `POST /api/users/{username}/certificates`, hoặc công cụ MCP `add_user_certificate`). Sổ đăng ký giữ chứng chỉ công khai, dấu vân tay SHA-256 của nó, ai đã đính kèm và khi nào, đã bị thu hồi hay chưa, và lần đăng nhập gần nhất. Client trình chứng chỉ đó và chứng minh nắm khóa riêng sẽ đăng nhập **với tư cách người dùng đó**. Không cấu hình gì thêm và không có gì trong chính chứng chỉ được tin: tên chung (common name) không được xét, không có CA nào để vận hành, và chứng chỉ không ai đính kèm thì không làm được gì.

**Token mang gì.** Client có thể gửi chứng chỉ của mình kèm theo các chứng chỉ đã cấp nó; chứng chỉ đầu tiên là chứng chỉ đã được đính kèm, còn lại bị bỏ qua.

**Bằng chứng về khóa.** Thư viện kiểm tra chữ ký của token trên chứng chỉ máy chủ và nonce phiên, thứ chỉ người nắm khóa riêng mới tạo được; chứng chỉ được trình cùng chữ ký của khóa khác bị từ chối.

**Nó được làm gì.** Đúng những gì người dùng được làm. Đăng nhập đòi người dùng phải đang bật và có `tags.read` và `values.read`, cùng cặp như đăng nhập bằng mật khẩu, và phiên được kiểm tra mỗi 10 giây như phiên mật khẩu: người dùng bị tắt hoặc mất quyền sẽ mất phiên chứng chỉ đang chạy trong khoảng đó. Nó chỉ đọc như mọi phiên ở đây; phiên chứng chỉ không thể ghi, bất kể vai trò của người dùng.

**Bị từ chối, có lý do trong nhật ký.** Chứng chỉ chưa đăng ký, đã bị thu hồi, đã hết hạn, chưa có hiệu lực, hoặc có người dùng đã mất, bị tắt hay không có quyền, nhận `BadUserAccessDenied`, cùng một câu trả lời cho tất cả, nên client không biết gì về trường hợp nào. Lý do được ghi vào nhật ký tiến trình và dấu vết kiểm toán.

**Thu hồi.** Hãy thu hồi nó trên cùng màn hình (hoặc `POST .../{thumbprint}/revoke`). Nó ngừng đăng nhập ngay và phiên đang mở bằng nó kết thúc trong 10 giây. Chứng chỉ đã thu hồi vẫn nằm trong danh sách, kèm ai thu hồi và khi nào, để một đăng nhập bị từ chối đọc là "đã thu hồi" chứ không phải "không rõ"; hãy xóa nó để quên. Bản sao lưu mang theo sổ đăng ký, kể cả các lần thu hồi.

**Kiểm toán.** Mỗi lần đăng nhập bằng chứng chỉ là một mục trong sổ nhật ký (loại auth) nêu người dùng, dấu vân tay và chủ thể của chứng chỉ, và ứng dụng client. Mỗi lần từ chối cũng là một mục, kèm lý do. Client thử lại cùng một lần từ chối ghi một mục mỗi phút cho chứng chỉ và lý do đó, không phải mỗi lần thử một mục; mọi lần từ chối vẫn nằm trong nhật ký tiến trình. Đính kèm, thu hồi và xóa chứng chỉ là các mục kèm người thực hiện. Khóa riêng không bao giờ nằm trong mục nào, và HotLoop không bao giờ có khóa riêng: chỉ chứng chỉ công khai được gửi hoặc lưu.

**Không phải danh sách tin cậy ứng dụng.** Chứng chỉ ứng dụng client trong `<PKI_DIR>/trusted/` cho phép client mở kênh bảo mật; đó không phải đăng nhập. Chứng chỉ người dùng là đối tượng khác: của một con người, đính kèm vào một người dùng. Một chứng chỉ có thể dùng cho cả hai ở phía client, nhưng máy chủ coi chúng là hai hành động.

**Client riêng của HotLoop** cũng đăng nhập theo cách này: xem `userCertificate` và `userPrivateKey` trong [Giao thức và trình điều khiển](/vi/iot/protocols/#opc-ua).

Chưa xây dựng: một tổ chức cấp chứng chỉ được tin cậy để bảo chứng cho chứng chỉ client và một quy tắc tên ánh xạ chúng tới người dùng. Sổ đăng ký phục vụ nhà máy đính kèm từng chứng chỉ client một; một CA sẽ là phần bổ sung cho nó, không phải thay thế.

**RsaEncryptedSecret, định dạng OPC UA yêu cầu cho mật khẩu trên 64 byte.** OPC 10000-4 7.40.4 nói rằng client mã hóa mật khẩu dài hơn 64 byte trên một chính sách bảo mật RSA dưới dạng RsaEncryptedSecret (7.40.2.4), không phải theo định dạng cũ. Client riêng của OPC Foundation làm đúng như vậy, và nay client OPC UA của HotLoop cũng thế. Server đọc cả hai. Nó nhìn phần đầu của token trước: với RsaEncryptedSecret, nó kiểm tra chính sách bảo mật, chứng chỉ, thời điểm ký, chữ ký, phần đệm và nonce của phiên, và chỉ trao mật khẩu khi tất cả đều đúng; mọi thứ khác đi vào bộ giải mã cũ, nên một client gửi định dạng cũ trên 64 byte vẫn đăng nhập được. Mọi chính sách RSA đều được bao phủ, `Basic256Sha256`, `Aes128_Sha256_RsaOaep` và `Aes256_Sha256_RsaPss`, cùng `Basic128Rsa15` và `Basic256` khi chúng được bật. Điều này đã được kiểm chứng với Reference Server và ConsoleReferenceClient của OPC Foundation (UA-.NETStandard 2.0.2) theo cả hai chiều, với một người dùng có mật khẩu dài 10, 64, 65, 72, 100 và 200 byte.

### Chẩn đoán máy chủ đã bị gỡ

Các nút chẩn đoán theo từng phiên của thư viện cho phép bất kỳ người dùng đã đăng nhập nào duyệt tên đăng nhập và địa chỉ client của mọi phiên khác, nên chúng được tắt, và đối tượng `Server/ServerDiagnostics` bị gỡ khỏi không gian địa chỉ (thư viện cũng ghi bộ đếm của nó mà không có khóa).

## Thay đổi không gian địa chỉ khi đang chạy

Thiết bị và tag được thêm, chỉnh sửa và gỡ trong khi Gateway chạy, và không gian địa chỉ theo kịp mà không cần khởi động lại. **Cơ chế: một callback của runtime, cộng một bộ hẹn giờ làm lưới an toàn.**

- `runtime.Manager.OnReload` gọi lại sau mỗi `Reload` thành công. Mọi thay đổi thiết bị và tag mà API thực hiện đều kết thúc bằng `Reload`, nên thay đổi làm qua giao diện hoặc API được công bố trong chốc lát. Callback chỉ báo hiệu một goroutine đối soát; nó không bao giờ tự làm việc, nên một lần đối soát chậm không thể làm nghẽn yêu cầu API đã kích hoạt nó.
- Một lần đối soát định kỳ (`HOTLOOP_OPCUA_SERVER_RECONCILE_INTERVAL`, mặc định 30 s) bắt mọi thứ thay đổi cấu hình mà không có `Reload`.

Cả hai chạy cùng một phép so sánh lũy đẳng với các thiết bị và tag đang bật trong cơ sở dữ liệu. Nó chỉ động tới những gì khác nhau: tag đã sửa được thay, tag đã gỡ bị xóa, và mọi thứ còn lại, kể cả các mục giám sát mà client giữ trên đó, giữ nguyên như cũ. Các nút của một thiết bị mới vào không gian trong một lần gọi, nên client đang duyệt giữa lúc đối soát thấy một thiết bị có đủ tag hoặc không có gì.

Callback được ưu tiên hơn chỉ thăm dò vì runtime đã có tín hiệu sạch (`Reload`) và nó làm thay đổi hiện ra sau vài mili giây thay vì tới một chu kỳ đầy đủ; bộ hẹn giờ vẫn giữ vì không gian địa chỉ không nên phụ thuộc vào việc mọi bên ghi cấu hình trong tương lai có nhớ tải lại hay không.

## Kết nối một client

Điểm cuối là `opc.tcp://<HOTLOOP_OPCUA_SERVER_ENDPOINT_HOST>:<port>`. Trong một cụm, chart mặc định lấy máy chủ là tên DNS của Service của bản phát hành; ngoài cụm, hãy đặt nó là tên hoặc địa chỉ mà client thực sự sẽ dùng (địa chỉ LoadBalancer, bản ghi DNS): nó được quảng bá trong mọi URL điểm cuối và ghi vào chứng chỉ được sinh. Đó **không** phải nơi máy chủ bind: thư viện lắng nghe trên mọi giao diện và chỉ nhận một cổng.

Với UaExpert hoặc client khác:

1. Thêm máy chủ với URL đó và chọn `Basic256Sha256` / `Sign & Encrypt`.
2. Chọn *Username*, và đăng nhập bằng người dùng HotLoop có `tags.read` và `values.read`; hoặc, khi `HOTLOOP_OPCUA_SERVER_ALLOW_X509` bật, chọn *Certificate* và đưa chứng chỉ người dùng cùng khóa mà quản trị viên đã đính kèm vào một người dùng.
3. Lần kết nối đầu bị từ chối vì máy chủ chưa tin cậy chứng chỉ của client. Tìm nó trong `<PKI_DIR>/rejected/` (trên ổ lưu trữ PKI trong cụm), chuyển sang `trusted/`, rồi kết nối lại.
4. Lần đầu, client hỏi có tin cậy chứng chỉ của máy chủ không; hãy so dấu vân tay với dấu vân tay trong nhật ký khởi động.
5. Duyệt *Objects* → thiết bị → các tag của nó, và kéo tag vào khung xem truy cập dữ liệu; chúng sẽ được đăng ký.

## Ignition 8.3 làm client

**Đã xác minh ngày 2026-09-27 với Ignition 8.3.9**, bản ổn định hiện tại, trong image container chính thức của Inductive Automation (`inductiveautomation/ignition:8.3.9`, bản standard đang dùng thử), với một Gateway HotLoop có thiết bị demo `extruder-1` được cấp dữ liệu bởi một trình mô phỏng. Những gì đã được chứng minh, từ đầu đến cuối:

- một kết nối OPC UA của Ignition tới `opc.tcp://<gateway>:4840` với `Basic256Sha256` và `SignAndEncrypt`, đăng nhập với tư cách **viewer** của HotLoop;
- sự tin cậy chứng chỉ theo cả hai chiều, như bên dưới;
- các tag OPC trong nhà cung cấp `[default]` của Ignition trỏ tới các nút HotLoop, đọc với chất lượng Good và thay đổi khi trình mô phỏng chạy. Mọi giá trị Ignition hiển thị là giá trị mà `/api/values` của chính HotLoop đã giữ: cùng một double đi qua đường truyền không đổi, nên chúng được so sánh về sự bằng nhau, không phải sự gần nhau. Một tag văn bản khai báo `string` trong HotLoop đọc ra "RUNNING" trong một tag String của Ignition;
- một lần ghi từ Ignition bị từ chối: Ignition gửi lệnh ghi, HotLoop trả lời `Bad_NotWritable` (đọc trên đường truyền qua kênh chỉ Sign, nơi phản hồi được ký nhưng không mã hóa), và giá trị của HotLoop không nhúc nhích;
- mọi chính sách và chế độ bảo mật mà Ignition cung cấp, bên dưới.

### Thiết lập

Ở phía HotLoop, trước Ignition:

1. Bật máy chủ và đặt `HOTLOOP_OPCUA_SERVER_ENDPOINT_HOST` là tên mà Ignition dùng để tới Gateway. Tên đó nằm trong mọi URL điểm cuối mà máy chủ quảng bá và trong chứng chỉ của nó.
2. Tạo một người dùng HotLoop cho Ignition với vai trò **viewer** (quản trị viên làm bằng `POST /api/users`; xem [Xác thực và người dùng](/vi/iot/authentication/)). Bất kỳ vai trò nào có `tags.read` và `values.read` đều đăng nhập được; không cung cấp gì thêm, vì máy chủ chỉ đọc.

Trong Ignition Gateway (giao diện web trên cổng 8088):

3. Trên trang **OPC Connections** dưới Connections (`/app/connections/opc-client-connections`), tạo một kết nối **OPC UA**. URL điểm cuối `opc.tcp://<gateway>:4840`; chọn điểm cuối `Basic256Sha256` / `SignAndEncrypt`; xác thực **Username**, với người dùng và mật khẩu HotLoop. Kết nối chuyển sang Faulted ngay, đó là điều được dự kiến: bước 4.
4. **Chấp thuận Ignition trong HotLoop.** Chứng chỉ client của Ignition giờ nằm trong `<PKI_DIR>/rejected/` của Gateway (`/data/opcua-pki/rejected` trong container và chart), đặt tên theo dấu vân tay SHA-1, `<thumbprint>.crt`. So dấu vân tay với chứng chỉ client OPC UA của chính Ignition, hiển thị trên trang chứng chỉ OPC (`/app/connections/opc/security/certificates`). Sau đó chuyển tệp sang `trusted/`. Không cần khởi động lại ở cả hai phía. HotLoop không ghi lại việc từ chối; tệp là dấu hiệu duy nhất.
5. **Chấp thuận HotLoop trong Ignition.** Kết nối giờ thất bại theo chiều ngược lại: trạng thái ghi `Bad_SecurityChecksFailed ... unable to find valid certification path`. Chứng chỉ của HotLoop nằm trong các chứng chỉ **client** bị từ chối của Ignition, trên cùng trang. Đối chiếu dấu vân tay của nó với dấu vân tay mà HotLoop ghi lúc khởi động (`generated a self-signed OPC UA application certificate ... thumbprint=`) và tin cậy nó. Không cần khởi động lại; kết nối lên trong vài giây.
6. **Tag.** Tạo các tag OPC với kết nối làm máy chủ OPC và đường dẫn mục theo dạng URI của không gian tên, dạng mà Ignition chấp nhận nguyên trạng:

   ```
   nsu=urn:hotloop:ua:gateway;s=extruder-1/Emberburn_Temperature
   ```

   Khai báo từng tag đúng như những gì HotLoop công bố (xem [Kiểu dữ liệu](#kiểu-dữ-liệu)): Float8 cho float, Boolean, String, Int2 cho `int16`, Int4 cho `uint16` hoặc `int32`, Int8 cho các số nguyên rộng hơn. Chúng được đăng ký theo tần suất của nhóm tag, và HotLoop nâng tần suất lấy mẫu nhanh hơn lên chu kỳ thăm dò của thiết bị.

Cũng việc đó, bằng tệp hoặc qua API REST:

- Kết nối là tài nguyên `data/config/resources/core/ignition/opc-connection/<name>/config.json`, kiểu hồ sơ `com.inductiveautomation.OpcUaServerType`, hoặc `POST /data/api/v1/resources/ignition/opc-connection`. Có hai điều không hiển nhiên. Mật khẩu là một bí mật nhúng, một JWE mà `POST /data/api/v1/encryption/encrypt` tạo từ văn bản thuần; chuỗi thường không được chấp nhận. Và khối `security` cần bí danh kho khóa client của gateway và mật khẩu của nó: bỏ đi thì kết nối thất bại với NullPointerException, để bí danh rỗng thì thất bại với `Unable to retrieve KeyPair for alias 'client'`. Hãy sao chép khối từ kết nối loopback `Ignition OPC UA Server` có sẵn, nơi có cả hai.
- Các chứng chỉ nằm dưới `data/config/local/com.inductiveautomation.opcua/client/security/pki/` (`rejected/certs`, `trusted/certs`), hoặc qua `GET /data/opc-ua/api/v1/client/pki/certificates/rejected` và `POST .../trusted/<sha1>` bằng API. **Ignition không đặt tên tệp theo dấu vân tay**; trường `signature` của API là dấu vân tay SHA-1, và nó khớp với những gì HotLoop ghi lại.
- Tag được nhập bằng `POST /data/api/v1/tags/import?provider=default&type=json`.
- Mọi lệnh gọi API cần một khóa API (trang API Keys, `/app/platform/security/api-keys`), và một khóa chỉ qua được nếu một trong các mức bảo mật của nó nằm trong quyền đọc hoặc ghi của gateway (tài nguyên `security-properties`).

### Điều nên mong đợi

- **`Bad_SecurityChecksFailed` mang hai nghĩa khác nhau.** Ignition hiện cùng một trạng thái khi HotLoop từ chối chứng chỉ của Ignition (bước 4; thông báo không có lý do) và khi Ignition từ chối chứng chỉ của HotLoop (bước 5; thông báo nói *unable to find valid certification path*). Hãy xem `rejected/` của HotLoop trước.
- **Triển khai lại HotLoop giữ nguyên chứng chỉ.** Đến 4.15.3 thì chưa: chứng chỉ phải bao phủ tên máy chủ của container, thứ đổi mỗi khi container được tạo lại, nên mỗi lần nâng cấp tạo một chứng chỉ mới và Ignition từ chối máy chủ cho đến khi ai đó tin cậy lại. Xem [Chứng chỉ máy chủ](#chứng-chỉ-máy-chủ). Chứng chỉ vẫn đổi nếu ổ lưu trữ PKI bị mất.
- **Tag văn bản khai báo là số đọc ra `Bad_TypeMismatch`.** HotLoop công bố tag theo kiểu đã khai báo, và tag `float` đang chứa "RUNNING" không thể là Double. Các tag do Discover tags tạo đến 4.15.3 đều được khai báo là `float`; xem [Giao thức và trình điều khiển](/vi/iot/protocols/#opc-ua). Hãy khai báo chúng là `string`.
- **Lệnh ghi bị từ chối, và Ignition làm mờ lý do.** HotLoop trả lời `Bad_NotWritable`. Máy chủ OPC UA của chính Ignition, khi được yêu cầu ghi cùng tag đó, chỉ chuyển tiếp một `Bad` chung (0x80000000). Giá trị của tag Ignition không đổi.
- **Các chính sách lỗi thời chỉ hoạt động khi được bật.** Ignition cung cấp `Basic128Rsa15` và `Basic256`. Hãy chọn `Basic256Sha256` hoặc một trong các chính sách `Aes` trong kết nối.
- **Bản dùng thử.** Gateway 8.3 chưa có giấy phép chạy trong hai giờ rồi ngừng thực thi cho đến khi bản dùng thử được đặt lại trong giao diện web của Gateway. Tag trở nên cũ khi nó hết hạn; đó là Ignition, không phải kết nối.

### Ma trận chính sách

Mỗi hàng là một phiên mới với chính sách và chế độ đó, đọc giá trị trực tiếp. Hai hàng lỗi thời được đo khi `HOTLOOP_OPCUA_SERVER_ALLOW_DEPRECATED_POLICIES` bật; khi tắt, như mặc định, hai chính sách đó không được cung cấp và kênh yêu cầu một trong hai bị từ chối:

| Chính sách | SignAndEncrypt | Sign |
|---|---|---|
| `Basic256Sha256` | hoạt động | hoạt động |
| `Aes128_Sha256_RsaOaep` | hoạt động | hoạt động |
| `Aes256_Sha256_RsaPss` | hoạt động | hoạt động |
| `Basic256` (lỗi thời) | hoạt động | hoạt động |
| `Basic128Rsa15` (lỗi thời) | hoạt động | hoạt động |

`None` không được cung cấp trừ khi `HOTLOOP_OPCUA_SERVER_ALLOW_INSECURE` được đặt, và chưa được thử.

## Cấu hình

| Biến | Mặc định | <span class="sr-only">Chi tiết</span> |
|---|---|---|
| `HOTLOOP_OPCUA_SERVER_ENABLED` | `true` | Bật trong tệp thực thi và chart; `false` tắt máy chủ |
| `HOTLOOP_OPCUA_SERVER_PORT` | `4840` | Cổng TCP, trên mọi giao diện |
| `HOTLOOP_OPCUA_SERVER_ENDPOINT_HOST` | tên máy chủ của máy này | Điều mà client được bảo kết nối tới; cũng được ghi vào chứng chỉ được sinh. **Hãy đặt biến này.** |
| `HOTLOOP_OPCUA_SERVER_APPLICATION_URI` | `urn:hotloop:gateway[:<siteId>]` | Phải ổn định qua các lần khởi động lại; phải là một URI |
| `HOTLOOP_OPCUA_SERVER_PKI_DIR` | `/data/opcua-pki` | Chứng chỉ, khóa, `trusted/`, `rejected/`. Hãy đặt sau một ổ lưu trữ |
| `HOTLOOP_OPCUA_SERVER_CERT_FILE` / `_KEY_FILE` | n/a | Dùng cặp RSA này thay vì sinh một cặp; đặt cả hai hoặc không đặt |
| `HOTLOOP_OPCUA_SERVER_CERT_HOSTS` | n/a | Tên DNS / IP bổ sung cho chứng chỉ được sinh |
| `HOTLOOP_OPCUA_SERVER_ALLOW_INSECURE` | `false` | Cung cấp chính sách bảo mật None. Có cảnh báo khi khởi động |
| `HOTLOOP_OPCUA_SERVER_ALLOW_ANONYMOUS` | `false` | Chấp nhận phiên không có danh tính. Có cảnh báo khi khởi động |
| `HOTLOOP_OPCUA_SERVER_TRUST_ALL_CLIENT_CERTS` | `false` | Bỏ qua bước chấp thuận chứng chỉ client. Có cảnh báo khi khởi động |
| `HOTLOOP_OPCUA_SERVER_ALLOW_X509` | `false` | Cung cấp token người dùng Certificate: client đăng nhập bằng chứng chỉ được đính kèm vào một người dùng ([Chứng chỉ người dùng X.509](#chứng-chỉ-người-dùng-x509)). Có ghi chú khi khởi động |
| `HOTLOOP_OPCUA_SERVER_ALLOW_DEPRECATED_POLICIES` | `false` | Cung cấp các chính sách lỗi thời `Basic128Rsa15` và `Basic256` cho client cũ ([Truyền tải](#truyền-tải)). Có cảnh báo khi khởi động |
| `HOTLOOP_OPCUA_SERVER_MAX_SESSIONS` | `20` | 0 = không giới hạn |
| `HOTLOOP_OPCUA_SERVER_MAX_SUBSCRIPTIONS` | `200` | 0 = không giới hạn |
| `HOTLOOP_OPCUA_SERVER_RECONCILE_INTERVAL` | `30s` | Chu kỳ đối soát làm lưới an toàn |

Máy chủ không được khởi động ở chế độ `--mcp-stdio`: đó là một tác tử chạy tệp nhị phân này làm trợ giúp, và việc một tiến trình thứ hai tranh cổng 4840 với Gateway thật không được phép xảy ra.

### Helm

`opcuaServer.*` trong `charts/hotloop/values.yaml`. Bật nó sẽ thêm một Service (`<release>-opcua`, mặc định ClusterIP; LoadBalancer hoặc NodePort là lựa chọn có chủ ý cho client ngoài cụm), một PVC cho thư mục PKI (`opcuaServer.persistence`; mất nó nghĩa là mọi client phải tin cậy một chứng chỉ mới), cổng của container và, để `networkPolicy.enabled` và `opcuaServer.enabled` cùng bật không lặng lẽ để lại một máy chủ đang lắng nghe mà không gì tới được, cổng trong quy tắc ingress của NetworkPolicy mặc định. `networkPolicy.ingress` tùy chỉnh thay thế quy tắc đó, như với broker, và khi ấy phải tự liệt kê cổng. `opcuaServer.tls.existingSecret` cung cấp một Secret `kubernetes.io/tls` thay cho chứng chỉ được sinh.

## Những gì đã được xác minh và chưa được xác minh

HotLoop đã được chạy với thiết bị thật và máy chủ thật, và trên phần cứng thật vào 2026-11-17.
