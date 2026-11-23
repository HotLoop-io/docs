---
title: "Giao thức và trình điều khiển"
description: "OPC UA, Modbus, MQTT và Sparkplug B, EtherNet/IP, S7comm, MTConnect và HTTP, cùng mức độ mỗi trình điều khiển đã được kiểm chứng trên thiết bị thật."
---

Tài liệu này nói chính xác gateway nói được những gì, mỗi trình điều khiển đã được kiểm chứng đến đâu và phải làm gì với mọi thứ còn lại. Đây là tài liệu nên đọc đầu tiên, và là tài liệu đáng tin khi có điều gì mâu thuẫn với nó.

Danh sách giao thức gốc được lấy từ các trình điều khiển được biên dịch vào tệp nhị phân. `/api/protocols`, màn hình Giao thức và công cụ MCP `describe_protocol` đều đọc cùng một sổ đăng ký, nên danh mục không thể quảng cáo một giao thức mà tệp nhị phân không có.

## Trạng thái kiểm chứng

Mọi giao thức HotLoop nói ở dạng gốc đều đã lấy giá trị thật từ máy chủ hoặc thiết bị thật, và đã chạy trên máy vật lý (2026-11-17). Ở nơi có một triển khai độc lập, HotLoop đã được chạy với nó theo cả hai chiều.

| Giao thức | Gốc | Trạng thái |
|---|---|---|
| Modbus TCP/RTU | có | **đã kiểm chứng trên thiết bị thật** |
| OPC UA | có | **đã kiểm chứng trên thiết bị thật**, gồm Ignition 8.3.9 theo cả hai chiều với tên người dùng và mật khẩu qua kênh được bảo mật |
| MQTT / Sparkplug B | có | **đã kiểm chứng trên thiết bị thật** |
| MTConnect | có | **đã kiểm chứng trên thiết bị thật** |
| HTTP / REST | có | **đã kiểm chứng trên thiết bị thật** |
| S7comm | có | **đã kiểm chứng trên thiết bị thật** (máy vật lý, 2026-11-17) |
| EtherNet/IP | có | **đã kiểm chứng trên thiết bị thật** (máy vật lý, 2026-11-17) |
| UniFi Network | có | **đã kiểm chứng trên thiết bị thật**, chỉ đọc, trên bộ điều khiển và switch thật, gồm cả WAN và failover |
| SNMP | có | **đã kiểm chứng trên thiết bị thật**, chỉ đọc, qua v1, v2c và v3 ở mọi mức bảo mật |
| CODESYS | có | **đã kiểm chứng trên thiết bị thật**, đọc và ghi, gồm một chương trình hơn 100.000 biến được đọc trong 2,4 giây |
| BACnet/IP | có | **đã kiểm chứng trên thiết bị thật**, chỉ đọc |
| OPC UA PubSub (UADP) | có | **đã kiểm chứng trên thiết bị thật**, cả hai chiều |
| Kafka API (đầu ra) | có | **đã kiểm chứng trên thiết bị thật** với Apache Kafka và Redpanda, có TLS và đăng nhập SASL |

Mỗi nhà cung cấp có mặc định riêng: máy chủ OPC UA đưa ra chứng chỉ và chính sách token nào, bộ điều khiển BACnet đưa gì vào danh sách đối tượng, thiết bị SNMP phục vụ những MIB nào, PLC đánh số dữ liệu ra sao. Một thiết bị mới ở một nhà máy mới vẫn là công việc nghiệm thu, nên hãy so một giá trị đã biết trên probe của tích hợp với màn hình của chính thiết bị trước khi tin vào một màn hình.

## Giao thức gốc

### OPC UA

Hãy ưu tiên giao thức này khi thiết bị cho phép chọn. Nó duyệt được, được bảo mật đúng cách và hỗ trợ subscribe.

Trình điều khiển **subscribe thay vì thăm dò (poll)**. Máy chủ gửi giá trị khi nó thay đổi, ở tốc độ nó chịu được, thay vì bị client hỏi cùng một câu ở mỗi lần quét mà không biết có gì thay đổi hay không. Nếu máy chủ từ chối một subscription, trình điều khiển chuyển sang đọc theo lô thay vì làm thiết bị bị lỗi.

Nó cũng chuyển sang đọc khi một subscription không gửi gì cả. Máy chủ gửi giá trị hiện tại của mọi node ở lần publish đầu tiên và không gửi lại cho đến khi giá trị đổi, nên mất lần publish đầu có nghĩa là một giá trị đặt sẽ đọc là bad suốt phiên. Nếu mười chu kỳ publish trôi qua (tối thiểu năm giây) mà subscription không có giá trị nào, trình điều khiển ghi một cảnh báo, xóa subscription và đọc các tag ở mỗi lần poll cho đến khi thiết bị kết nối lại. Thư viện client OPC UA mà trình điều khiển này dựa vào có thể khởi động vòng lặp publish ở trạng thái tạm dừng trên một máy chủ đang quá tải và không bao giờ gửi yêu cầu publish; tính năng này tồn tại cho trường hợp đó.

Nó cũng chuyển sang đọc khi một subscription dừng sau khi đã có giá trị. Thư viện giữ các keep-alive cho riêng nó, nên một vòng lặp publish đã dừng trông hệt như một nhà máy không có gì thay đổi. Sau khi subscription im lặng mười chu kỳ publish (tối thiểu ba mươi giây), trình điều khiển đọc mỗi node một lần và so với giá trị subscription gửi lần cuối. Nếu có node nào khác về giá trị hoặc chất lượng, máy chủ đang giữ thứ lẽ ra phải gửi, nên trình điều khiển ghi một cảnh báo, xóa subscription và đọc ở mỗi lần poll cho đến khi thiết bị kết nối lại. Nếu khớp, nó tiếp tục và kiểm tra lại sau cùng một khoảng im lặng. Một subscription khỏe mạnh nhưng yên tĩnh tốn một lần đọc theo lô mỗi ba mươi giây.

**Hãy địa chỉ hóa các node bằng namespace URI.** Điều này quan trọng hơn vẻ ngoài của nó:

```
nsu=http://opcua.edge.server;s=Zone1_Temperature    good
ns=3;s=Zone1_Temperature                            works until it doesn't
```

*Chỉ số* namespace được gán theo thứ tự máy chủ tình cờ nạp các namespace. Thêm một namespace, nâng cấp firmware, và chỉ số 3 lặng lẽ trở thành thứ khác, mọi giá trị đọc khi đó đều sai mà không có lỗi nào ở đâu cả. URI là một phần của mô hình và không đổi. `Browse` trả về dạng URI chính vì lý do này.

Một chuỗi trơn không được chấp nhận làm địa chỉ. Đọc như `ns=0;s=Temperature`, một lỗi gõ sẽ được phân tích gọn gàng thành một node không tồn tại và tag sẽ đọc bad mãi mãi. Cần một dạng tường minh để lỗi hiện ra ngay khi bạn lưu.

**Discover tags khai báo mỗi tag theo kiểu mà máy chủ nói node đang giữ**: Boolean là `bool`, các kiểu số nguyên giữ nguyên độ rộng (`int16`, `uint16`, `int32`, `uint32`, `int64`, `uint64`; SByte và Byte lên cỡ kế tiếp), Float và Double là `float`, còn String, DateTime, LocalizedText và các kiểu khác mà trình điều khiển đọc dưới dạng văn bản là `string`. Một kiểu mà máy chủ không nói ra, hoặc không có tên nào tốt hơn (kiểu liệt kê, cấu trúc), vẫn là `float`. Trước công việc Ignition bên dưới, mọi tag được phát hiện đều là `float`. Trình điều khiển vẫn đọc được văn bản của node String, nhưng tag nói là float, và máy chủ OPC UA của chính Gateway phát hành tag theo kiểu đã khai báo, nên client của máy chủ đó nhận `Bad_TypeMismatch`. Ignition hiển thị `System_Status` của Emberburn đúng như vậy. Các tag nhập trước bản sửa giữ nguyên kiểu: hãy tự đổi tag văn bản sang `string`.

Cấu hình: các tùy chọn bảo mật, danh tính và chứng chỉ được mô tả ở [OPC UA: bảo mật và thông tin xác thực](#opc-ua-bảo-mật-và-thông-tin-xác-thực). Phần còn lại là `subscribe`, `publishIntervalMs`, `samplingIntervalMs`, `queueSize`, `sessionTimeoutMs`, `browseMaxNodes`, `browseRoot` và `browseServerNodes`. Một tên tùy chọn mà trình điều khiển không biết là một lỗi liệt kê những tên nó biết, không phải một cài đặt bị lặng lẽ bỏ qua: nếu không, lỗi gõ ở `securityMode` sẽ kết nối không có bảo mật nào và trông hệt như một thiết bị đang chạy tốt.

**Discover tags bỏ qua đối tượng `Server` của chính máy chủ** (`i=2253`: trạng thái, khả năng, chẩn đoán, mảng namespace và cấu hình). Mọi máy chủ OPC UA đều có đối tượng này, và nó có thể là hàng trăm biến lẫn với biến của nhà máy. Đặt `browseServerNodes` thành `true` trên thiết bị để lấy lại chúng, hoặc đặt `browseRoot` thành `i=2253` để chủ động nhìn vào bên trong; một lần duyệt bắt đầu từ đó vẫn đi hết.

### OPC UA: bảo mật và thông tin xác thực

Cho đến 4.15.0, trình điều khiển chỉ tạo được kết nối ẩn danh, không bảo mật, và không kết nối được với bất kỳ máy chủ nào tuân theo đặc tả: nó không hỏi máy chủ cung cấp chính sách token danh tính nào, nên gửi một id chính sách token rỗng mà máy chủ tuân thủ sẽ từ chối. Điều đó gồm cả máy chủ OPC UA của chính HotLoop. Giờ trình điều khiển phát hiện các endpoint của máy chủ, chọn endpoint khớp với thiết bị và gửi lại id chính sách mà endpoint đó liệt kê.

#### Tùy chọn thiết bị

| Tùy chọn | Mặc định | Công dụng |
|---|---|---|
| `securityMode` | `None` | `None`, `Sign` hoặc `SignAndEncrypt`. Nếu bỏ trống khi có `securityPolicy` khác `None`, giá trị là `SignAndEncrypt`. |
| `securityPolicy` | chính sách tốt nhất máy chủ đưa ra cho chế độ đó | `None`, `Basic256Sha256`, `Aes128_Sha256_RsaOaep` hoặc `Aes256_Sha256_RsaPss`. `Basic128Rsa15` và `Basic256` bị từ chối. |
| `username`, `password` | ẩn danh | Xác thực bằng tên người dùng. |
| `userCertificate`, `userPrivateKey` | không có | Xác thực người dùng X.509: phiên đăng nhập là người mà máy chủ ánh xạ với chứng chỉ này, không cần mật khẩu. Cả hai ở dạng PEM, đặt cùng nhau. Khóa là RSA (thư viện OPC UA chỉ ký bằng RSA; khóa EC bị từ chối kèm lý do đó) và là một secret như mật khẩu: được niêm phong khi lưu, bị che trong mọi phản hồi API, không bao giờ ghi vào log. Chứng chỉ là của người dùng, không phải chứng chỉ ứng dụng client trong `certFile`. Nếu `username` cũng được đặt thì chứng chỉ được dùng. Với máy chủ của chính HotLoop, chứng chỉ phải được gắn cho một người dùng trước ([Máy chủ OPC UA](/vi/edge/opc-ua-server/#chứng-chỉ-người-dùng-x509)). |
| `allowInsecureCredentials` | `false` | Cho phép gửi mật khẩu qua kênh không bảo mật (`securityMode` là `None`), hoặc khi không có gì mã hóa nó. |
| `certFile`, `keyFile` | được tạo | Chứng chỉ ứng dụng của client này và khóa RSA của nó, cho chế độ bảo mật. Đặt cả hai hoặc không đặt cái nào. |
| `pkiDir` | `HOTLOOP_OPCUA_CLIENT_PKI_DIR` (`/data/opcua-client-pki`) | Nơi chứa chứng chỉ được tạo và các kho `trusted/` và `rejected/`. |
| `serverCertThumbprints` | không có | Dấu vân tay SHA-1 (40 chữ số hex) hoặc SHA-256 (64) của các chứng chỉ máy chủ được tin tưởng mà không cần tệp trong `trusted/`. Dấu hai chấm và khoảng trắng bị bỏ qua. |
| `insecureSkipVerify` | `false` | Chấp nhận mọi chứng chỉ máy chủ. |

Một thiết bị không đặt cái nào trong số này vẫn như trước nay: ẩn danh, qua kênh không bảo mật.

#### Cách trình điều khiển chọn endpoint

Trình điều khiển hỏi máy chủ các endpoint của nó qua một kênh không bảo mật, điều mà đặc tả yêu cầu máy chủ cho phép để phục vụ việc khám phá và không mang bí mật nào, vì danh sách endpoint vốn công khai. Nó giữ lại các endpoint có chế độ bảo mật và chính sách khớp với thiết bị, và trong số đó chọn chính sách token cho danh tính của thiết bị (ẩn danh, hoặc tên người dùng khi có `username`). Token danh tính nó gửi sau đó mang id chính sách mà endpoint đó đã liệt kê; nó không bao giờ gửi id rỗng.

- **Nó không bao giờ chọn `Basic128Rsa15` hay `Basic256`.** Cả hai đều bị OPC Foundation đánh dấu lỗi thời. Điều này đúng cả khi một trong hai có mức bảo mật cao nhất trong danh sách, cách máy chủ xếp hạng chúng, lẫn khi nó là thứ duy nhất máy chủ đưa ra, và khi đó kết nối thất bại với lỗi nói rõ như vậy. Không thể cấu hình thiết bị để dùng một trong hai, và một chính sách token mã hóa mật khẩu bằng chúng cũng bị từ chối. Máy chủ của chính HotLoop đưa ra cả hai bên cạnh các chính sách hiện đại và không thể tắt, nên điều này được thực hiện trên một máy chủ thật, và các bài kiểm tra xác nhận URI của cả hai chính sách không xuất hiện trong những gì trình điều khiển gửi.
- **Khi thiết bị không nêu chính sách, nó ưu tiên `Basic256Sha256`, rồi `Aes128_Sha256_RsaOaep`, rồi `Aes256_Sha256_RsaPss`**, bất kể máy chủ cho chúng mức bảo mật nào. Thứ tự dựa vào mức độ phổ biến của từng cái, không phải độ mạnh. Một số máy chủ không mở được kênh với `Aes256_Sha256_RsaPss` và đóng kết nối mà không nói lý do, nên nó chỉ được dùng khi thiết bị nêu tên nó.
- **Nếu không có gì khớp, lỗi liệt kê những gì máy chủ thực sự đưa ra**, kèm chính sách và id chính sách token của từng endpoint, để có thể sửa cấu hình chỉ từ thông báo.

#### Chứng chỉ riêng của client

Mọi chế độ bảo mật đều cần một chứng chỉ ứng dụng. Nếu thiết bị nêu `certFile` và `keyFile`, chúng được dùng nguyên trạng, sau các kiểm tra (RSA, ít nhất 2048 bit, chưa hết hạn). Nếu không, một chứng chỉ tự ký được tạo ở lần dùng đầu và giữ trong thư mục PKI: RSA-2048, năm năm, URI ứng dụng `urn:hotloop:client:<host name>` trong subject alternative names, khóa ở chế độ `0600`, chứng chỉ ở `0644` và các thư mục ở `0750`. Bố cục phản chiếu bố cục của máy chủ OPC UA:

```
own/cert.pem, own/key.pem   this client's certificate
trusted/                    server certificates an operator has approved
rejected/                   server certificates the driver turned away
```

Nó không được tạo lại ở lần khởi động thông thường, nên một máy chủ đã được bảo tin tưởng nó sẽ không phải được bảo lại. Nó chỉ được thay, kèm cảnh báo rằng mọi máy chủ phải chấp thuận chứng chỉ mới, nếu không đọc được, không phải RSA từ 2048 bit trở lên, hoặc còn dưới 30 ngày. Các thiết bị khởi động cùng lúc dùng chung một chứng chỉ thay vì mỗi thiết bị tự ghi một cái.

Thư mục phải ghi được và bền vững. Trong Helm chart, đó là `opcuaClient.persistence.enabled` (mặc định tắt, vì nó thêm một volume vào bản cài đặt hiện có); trên edge relay, đó là volume `/data` sẵn có. Nếu không có thư mục ghi được, một thiết bị bảo mật báo lỗi nêu tên biến cần đặt, thay vì kết nối bằng chứng chỉ sẽ mất ở lần khởi động lại kế tiếp.

**Máy chủ** cũng phải tin tưởng chứng chỉ này, và đó là cài đặt của chính máy chủ. Với máy chủ của chính HotLoop, đó là cùng một thao tác: chứng chỉ của trình điều khiển xuất hiện trong thư mục `rejected/` của máy chủ sau lần thử bị từ chối đầu tiên, và chuyển nó sang `trusted/` là chấp thuận. Khi máy chủ đóng kết nối trong lúc kênh bảo mật đang mở, cách nhiều máy chủ từ chối chứng chỉ mà chúng không tin, lỗi nêu tên tệp chứng chỉ và dấu vân tay của client này để người vận hành biết cần tìm gì trên máy chủ.

#### Chấp thuận chứng chỉ của máy chủ

Với chế độ bảo mật, hoặc với mật khẩu cần được mã hóa bằng khóa của máy chủ, **trình điều khiển không chấp nhận bất kỳ chứng chỉ nào máy chủ đưa ra.** Nó chỉ tin chứng chỉ nếu chứng chỉ được ghim trong `serverCertThumbprints` của thiết bị hoặc đúng là chứng chỉ trong `trusted/`. Bất cứ thứ gì khác được ghi vào `rejected/<thumbprint>.der` và kết nối thất bại, trước khi bất kỳ thông tin xác thực nào được gửi, với một thông báo như sau:

```
opcua: the server at opc.tcp://plc-01:4840 presented a certificate that is not
trusted (subject "CN=PLC01", SHA-1 thumbprint 5A6DB35A..., expires 2031-09-18).
It has been saved to /data/opcua-client-pki/rejected/5A6DB35A....der. To approve
it, first check that the thumbprint matches the one the server shows, then move
that file into /data/opcua-client-pki/trusted (the next connection attempt picks
it up; no restart is needed). Alternatively pin it by adding the thumbprint to
this device's serverCertThumbprints. Until then this device will not connect
```

Hãy kiểm tra dấu vân tay với màn hình của chính máy chủ trước khi chấp thuận: phép so sánh đó là toàn bộ quyết định tin cậy. Sau đó `mv` tệp vào `trusted/` (cả tệp PEM và DER đều được đọc), và thiết bị sẽ kết nối ở lần thử kế tiếp, nằm trong khoảng thời gian kết nối lại của runtime. Một vài chi tiết:

- Sự tin cậy dựa trên đúng chứng chỉ đó, không dựa trên chuỗi. Một máy chủ có chứng chỉ do CA cấp được chấp thuận bằng cách đặt chính chứng chỉ của máy chủ đó vào `trusted/`, giống chứng chỉ tự ký. Tin tưởng một CA không được hỗ trợ.
- Một chứng chỉ đã hết hạn nhưng đã được người vận hành chấp thuận vẫn được tin, kèm một cảnh báo trong log ở mỗi lần kết nối. Từ chối thứ mà người vận hành đã chấp thuận có chủ đích chỉ đẩy họ về phía `insecureSkipVerify`.
- Một tệp trong `trusted/` không phải là chứng chỉ sẽ bị bỏ qua và được báo cáo, và không làm các máy chủ đã chấp thuận khác không truy cập được.
- `rejected/` chứa tối đa 256 tệp, nên một máy chủ đưa ra chứng chỉ khác ở mỗi kết nối không thể làm đầy đĩa. Quá mức đó kết nối vẫn bị từ chối, và thông báo nói rằng tệp không được giữ lại và cách vẫn chấp thuận chứng chỉ.
- `insecureSkipVerify` tắt việc kiểm tra. Khi đó một bên nằm trên đường truyền có thể mạo danh máy chủ và đọc những gì gửi tới nó, kể cả mật khẩu. Mặc định nó tắt và cảnh báo, kèm dấu vân tay của chứng chỉ, ở mỗi lần kết nối.

Một thiết bị ẩn danh trên kênh không bảo mật không cần gì trong số này, vì không có gì được ký hay mã hóa bằng khóa của máy chủ.

#### Thông tin xác thực

Mật khẩu bị từ chối, trước khi gửi, trừ khi kênh được bảo mật và có thứ gì đó mã hóa mật khẩu. Trình điều khiển quyết định như sau, dựa trên những gì máy chủ đưa ra cho endpoint đã khớp:

| Kênh | Chính sách token tên người dùng của máy chủ | Kết quả |
|---|---|---|
| `SignAndEncrypt` | mã hóa mật khẩu (trường hợp thường gặp) | kết nối |
| `SignAndEncrypt` | không mã hóa | kết nối: kênh được mã hóa mang nó, và log ghi nhận điều đó |
| `Sign` | mã hóa mật khẩu | kết nối |
| `Sign` | không mã hóa | **bị từ chối** trừ khi có `allowInsecureCredentials`. `Sign` xác thực thông điệp nhưng không che giấu chúng. |
| `None` | mã hóa mật khẩu | **bị từ chối** trừ khi có `allowInsecureCredentials`. Trên kênh không bảo mật, khóa dùng để mã hóa mật khẩu đến từ một phản hồi mà không gì xác thực, nên bất kỳ ai sửa được lưu lượng đều có thể khôi phục mật khẩu. Khi chọn bật, nó kết nối kèm cảnh báo. |
| `None` | không mã hóa | **bị từ chối** trừ khi có `allowInsecureCredentials` |

**Tên người dùng qua `securityMode` `None` bị từ chối ngay cả khi chính sách token của máy chủ mã hóa mật khẩu.** Mã hóa mà kẻ tấn công chọn được khóa thì không bảo vệ trước kẻ tấn công đó, và trên kênh không bảo mật, chứng chỉ dùng để mã hóa mật khẩu được lấy từ phản hồi của máy chủ cho `CreateSession`, thứ mà không gì xác thực (bài kiểm tra bên dưới thay một chứng chỉ khác vào và khôi phục mật khẩu). Lỗi nêu điều này và chỉ cách sửa, `securityMode` `SignAndEncrypt`. Phiên ẩn danh không bị ảnh hưởng.

`allowInsecureCredentials` là công tắc duy nhất cho phép mật khẩu được gửi đi theo những điều kiện đó. Mặc định nó tắt và cảnh báo ở mỗi lần kết nối khi chính nó là thứ cho phép kết nối. Khi chính sách token mã hóa mật khẩu, nó thay đổi những gì một kẻ nghe lén đọc được, không thay đổi những gì một bên can thiệp vào lưu lượng đọc được: xem [những gì đi qua mạng](#những-gì-đi-qua-mạng). Ngay cả khi có nó, chứng chỉ của máy chủ vẫn phải được chấp thuận trước khi mật khẩu được mã hóa bằng chứng chỉ đó.

Mật khẩu là một secret ở mọi nơi trình điều khiển và API xử lý nó:

- **Phản hồi API.** Nó được thay bằng `[redacted]` trong mọi phản hồi trả về một thiết bị (`GET /api/devices`, `GET /api/devices/{id}` và phản hồi của lệnh lưu), nên một viewer, người có `devices.read`, không đọc được. Từ 4.15.1 điều này đúng cho mọi vai trò, kể cả admin, và cho thông tin xác thực của mọi giao thức, không chỉ giao thức này. Lưu lại một thiết bị với giá trị giữ chỗ thì giữ nguyên mật khẩu đã lưu; một giá trị mới thay thế nó; một chuỗi rỗng xóa nó; giá trị giữ chỗ cho một thiết bị không có mật khẩu bị từ chối thay vì được lưu. Bỏ trống trường giờ giữ nguyên nó (ở 4.15.0 thì xóa). Các quy tắc đầy đủ nằm ở [Xác thực và người dùng](/vi/iot/authentication/#thông-tin-xác-thực-của-thiết-bị-chỉ-ghi). Trình soạn thiết bị trên giao diện web hiển thị cấu hình đúng như API trả về và lưu đúng những gì nó hiển thị, điều mà cách này xử lý, nên sửa một thiết bị không làm mất mật khẩu của nó. (Các bài kiểm tra thực hiện điều đó qua API, không qua trình duyệt.)
- **Log và lỗi.** Cả các dòng log của trình điều khiển lẫn bất kỳ lỗi nào nó trả về đều không chứa mật khẩu: các thông báo được tạo từ mã trạng thái và các cài đặt không bí mật của thiết bị. Các bài kiểm tra thu log của tiến trình, log của máy chủ và các lỗi, rồi tìm mật khẩu trong tất cả chúng.
- **Công cụ và tài nguyên MCP, luồng sự kiện trực tiếp, log hệ thống.** Không cái nào trả về cấu hình của thiết bị (mỗi cái mô tả một thiết bị qua một tập trường cố định), và các bài kiểm tra gọi mọi công cụ và tài nguyên, mở luồng và đọc log hệ thống khi có một mật khẩu được cấu hình, và không tìm thấy nó ở đâu.
- **Cơ sở dữ liệu và bản sao lưu.** Mật khẩu được lưu trong cột `config` của thiết bị như của các trình điều khiển khác. Đến 4.16.0 nó ở dạng rõ và bản sao lưu chứa nó. Từ 4.17.0 nó được mã hóa bằng một khóa giữ bên ngoài cơ sở dữ liệu (xem "Mã hóa khi lưu" bên dưới), nên một bản dump hay bản sao lưu chỉ chứa văn bản mã hóa. Dù thế nào, hãy xem [Sao lưu và khôi phục](/vi/iot/backup/#bảo-vệ-các-tệp-sao-lưu) và bảo vệ cơ sở dữ liệu cùng volume sao lưu cho phù hợp.
- **Edge relay.** Một tệp thiết bị cũng mang mật khẩu. Trong Helm chart, hãy đặt tệp thiết bị có thông tin xác thực vào một Secret và nêu tên nó trong `devicesSecret`; các thiết bị đặt trực tiếp trong values của chart sẽ nằm trong một ConfigMap. Một tệp thiết bị được đẩy qua fleet config push được phát hành, retained, lên một topic MQTT, nên broker phải có TLS và giới hạn ai được đọc topic đó.

Một mật khẩu sai là một lỗi rõ ràng, chỉ trong một lần thử, không treo và không thử lại bên trong trình điều khiển:

```
opcua: authentication rejected: the server at opc.tcp://plc-01:4840 rejected the
user name and password for "svc-hotloop" (StatusBadUserAccessDenied). ...
```

Sau đó runtime chờ **mười phút** (dao động từ năm đến mười) trước lần thử kế tiếp, thay vì leo qua cơ chế backoff kết nối lại thông thường (`HOTLOOP_RECONNECT_MAX`, mặc định 60 giây). Hai điều khiến một lần đăng nhập bị từ chối tốn kém hơn khi lặp lại so với một sự cố mạng. Một máy chủ khóa tài khoản sau vài lần thất bại biến mọi lần thử lại nhanh thành sự cố cho bất kỳ ai khác dùng tài khoản đó. Và mỗi lần đăng nhập bị từ chối có thể để lại trên máy chủ một **phiên đã được tạo nhưng chưa bao giờ được kích hoạt**, tính vào giới hạn phiên của nó cho đến khi hết thời gian chờ (thư viện yêu cầu hai mươi phút; `sessionTimeoutMs` thay đổi giá trị này): với máy chủ của chính HotLoop, một thiết bị sai mật khẩu thử lại mỗi vài giây đã làm đầy giới hạn mặc định hai mươi phiên, sau đó máy chủ từ chối mọi client khác bằng `BadTooManySessions`. Một bộ điều khiển có bảng phiên nhỏ còn dễ bị ảnh hưởng hơn thế. Thiết bị không ngừng thử lại, nên một máy chủ được sửa mật khẩu ở phía nó sẽ phục hồi trong vòng mười phút mà không ai phải đụng tới HotLoop; sửa mật khẩu trên thiết bị, hoặc tắt rồi bật lại, sẽ khởi động một worker mới và nó thử ngay.

#### Những gì đi qua mạng

Đã đo, không phải suy luận: các bài kiểm tra đặt một proxy ghi lại giữa trình điều khiển và một máy chủ rồi tìm từng byte theo cả hai chiều. Việc tìm kiếm thấy những byte biết chắc là có ở đó (danh sách endpoint của máy chủ, gửi ở dạng rõ), điều cho thấy proxy đã ghi lại cuộc trò chuyện.

| Cấu hình | Mật khẩu | Tên người dùng | Node id và giá trị của tag |
|---|---|---|---|
| `SignAndEncrypt` | không nhìn thấy | không nhìn thấy | không nhìn thấy |
| `Sign` | không nhìn thấy (chính sách token mã hóa nó) | **đọc được** | **đọc được** |
| `None`, tên người dùng, chính sách token của máy chủ mã hóa (cần `allowInsecureCredentials`) | không nhìn thấy | **đọc được** | **đọc được** |
| `None`, ẩn danh | không áp dụng | không áp dụng | **đọc được** |
| một máy chủ đưa ra mật khẩu không mã hóa, kèm `allowInsecureCredentials` | **đọc được** | **đọc được** | tùy theo chế độ |

Hàng cuối được kiểm tra với một máy chủ không thực sự đưa ra điều đó: một bên đứng trước một máy chủ thật viết lại danh sách endpoint của nó để nói rằng mật khẩu không được mã hóa, trên kênh mà việc khám phá dùng và không gì xác thực. Đó cũng là cách các bài kiểm tra cho thấy việc từ chối: không có lựa chọn bật, trình điều khiển từ chối, chỉ mở kết nối khám phá, và không có thông tin xác thực nào trên đường truyền. Danh sách endpoint chính là thứ một bên nằm trên đường có thể viết lại, đó là lý do quy tắc của trình điều khiển được áp dụng cho những gì nó được báo, chứ không để máy chủ tự thực thi.

Một kênh không bảo mật có mật khẩu có một giới hạn mà bảng không cho thấy, và một bài kiểm tra cho thấy nó; đó là lý do trình điều khiển từ chối tổ hợp này nếu không có lựa chọn bật. Mật khẩu được mã hóa bằng chứng chỉ của máy chủ, giữ nó khỏi kẻ nghe lén, và trình điều khiển sẽ không gửi cho đến khi chứng chỉ đó được chấp thuận. Nhưng chứng chỉ mà thư viện OPC UA dùng để mã hóa là chứng chỉ trong phản hồi của máy chủ khi phiên được tạo, và trên kênh không bảo mật phản hồi đó không được xác thực. Một bên có thể sửa lưu lượng đặt chứng chỉ của chính nó vào đó, và mật khẩu khi ấy được mã hóa bằng khóa của bên đó: bài kiểm tra làm đúng như vậy, giải mã mật khẩu bằng khóa đã thay và lấy lại được nó. **Qua `Sign` hay `SignAndEncrypt`, cùng bên đó không làm được**, vì phản hồi được bảo vệ bằng những khóa nó không có. Không có `allowInsecureCredentials`, trình điều khiển từ chối gửi mật khẩu hoàn toàn, và bài kiểm tra cho thấy cùng bên đó khi ấy không lấy được gì; khi có nó, trình điều khiển cảnh báo ở mỗi lần kết nối. Hãy dùng `SignAndEncrypt` ở bất cứ nơi nào máy chủ cung cấp; một kênh không bảo mật có mật khẩu, đã được chọn bật, chỉ bảo vệ khỏi kẻ nghe lén và không hơn.

#### Kết nối lại

Cơ chế kết nối lại riêng của thư viện OPC UA bị tắt, và runtime tự kết nối lại. Thư viện, khi mất phiên, mở một phiên mới với thông tin xác thực đã được cấp và, khi máy chủ từ chối chúng, thử lại ngay lập tức không có độ trễ: đã đo được khoảng hai mươi lần đăng nhập bị từ chối trong mười hai giây, với một máy chủ đã bị đổi mật khẩu. Đó là cách một tài khoản bị khóa với tất cả những ai dùng chung. Giờ khi mất phiên, `Poll` báo lỗi, worker của runtime đóng trình điều khiển và mở một cái mới, cái mới phát hiện các endpoint, kiểm tra chứng chỉ của máy chủ và đăng nhập lại, với backoff có dao động của runtime và khoảng chờ mười phút sau một lỗi xác thực. Việc khởi động lại máy chủ được vượt qua theo cùng cách: thiết bị đọc giá trị mới sau khi khởi động lại, đã đăng nhập lại, điều mà các bài kiểm tra xác nhận bằng cách đếm số lần đăng nhập của máy chủ và đổi giá trị sau khi khởi động lại.

Một thiết bị không có tag nào thì không có gì để đọc, và cho đến 4.15.2 điều đó nghĩa là lần poll của nó không gửi gì cả. Máy chủ đóng phiên nhàn rỗi sau thời gian chờ của phiên, thiết bị vẫn nói là đã kết nối vì không ai hỏi máy chủ điều gì, và mọi lần duyệt đều thất bại với `BadSessionIDInvalid` cho đến khi tiến trình được khởi động lại. Đó là mọi thiết bị ngay vào lúc có người thêm nó và bấm Discover tags. Ignition đã bắt được lỗi này. Giờ một thiết bị không có tag đọc trạng thái của máy chủ ở mỗi lần poll, giữ phiên sống và nhận ra khi nó chết, và một lần duyệt thấy phiên đã mất sẽ báo cáo để runtime kết nối lại.

Một tag chưa thay đổi từ trước khi phiên bắt đầu giờ đọc giá trị hiện tại với chất lượng tốt. Trước đây, số đọc giữ chỗ được báo trong lúc chờ giá trị đầu tiên mới hơn nhãn thời gian nguồn của chính giá trị đó, và runtime giữ số đọc mới nhất rồi bỏ giá trị, nên một tag ổn định đọc là bad cho đến lần nó đổi kế tiếp.

#### Đã kiểm thử gì và chưa kiểm thử gì

OPC UA đã được chạy với Ignition 8.3.9 và với các máy chủ OPC UA độc lập, với đăng nhập ẩn danh và bằng tên người dùng cùng mật khẩu qua `None`, `Sign` và `SignAndEncrypt`, và trên máy vật lý vào 2026-11-17. Mỗi máy chủ trong sản xuất có thói quen riêng về những chính sách nó đưa ra và cách nó từ chối một chứng chỉ, nên hãy coi lần kết nối đầu tiên tới máy chủ của một nhà cung cấp mới là công việc nghiệm thu.

Cần biết:

- Giờ mỗi lần kết nối đều hỏi máy chủ các endpoint của nó trước, và một thiết bị không có tùy chọn bảo mật cần một endpoint không bảo mật liệt kê một chính sách token ẩn danh có id. Một máy chủ chấp nhận phiên ẩn danh mà không liệt kê chính sách đó sẽ bị từ chối, với một lỗi liệt kê những gì nó đưa ra.
- Xác thực người dùng bằng chứng chỉ X.509 và issued-token không được triển khai cho trình điều khiển. `certFile` của một thiết bị là chứng chỉ ứng dụng của nó.
- Sự tin cậy dựa trên đúng chứng chỉ. Tin tưởng một tổ chức cấp chứng chỉ và thu hồi chứng chỉ không được hỗ trợ.
- Các chính sách bảo mật đường cong elliptic không được hỗ trợ, và các máy chủ từ chối khám phá trên kênh không bảo mật cũng không.
- Một đường mạng bị đứt mà không đầu nào thấy nó đóng sẽ để thiết bị ở lại các giá trị cuối cùng cho đến khi hệ điều hành bỏ kết nối.
- Một số máy chủ không mở được kênh với `Aes256_Sha256_RsaPss`.
- Máy chủ của chính HotLoop chấp nhận mật khẩu tối đa 72 byte. Máy chủ khác có thể có giới hạn riêng.

#### Ignition 8.3

Đã kiểm chứng với **Ignition 8.3.9**, bản ổn định hiện tại, trong chính container image của Inductive Automation: trình điều khiển của HotLoop là client, máy chủ OPC UA của Ignition ở đầu bên kia, `Basic256Sha256` với `SignAndEncrypt`, đăng nhập bằng tên người dùng và mật khẩu. Duyệt tìm thấy các tag của Ignition dưới `nsu=urn:inductiveautomation:ignition:opcua:tags`, và các tag đồng hồ, CPU, bộ nhớ và thời gian hoạt động của `[System]/Gateway` được nhập và đọc với chất lượng tốt, được đẩy qua subscription.

Một gateway 8.3 nguyên bản sẽ chặn bạn bốn lần trước khi HotLoop kịp nói gì:

1. **Máy chủ OPC UA của nó chỉ lắng nghe trên localhost.** Ngay khi cài, 8.3 gắn cổng 62541 vào `localhost`, nên một HotLoop ở bất kỳ nơi nào khác chỉ nhận được từ chối kết nối và không gì khác. Trong Gateway, ở phần cài đặt máy chủ OPC UA, hãy đặt Bind Addresses thành `0.0.0.0`. Chúng tôi cũng thêm tên máy chủ mà HotLoop quay số vào Endpoint Addresses; trình điều khiển có cần điều đó hay không thì chưa được kiểm thử.
2. **Mặc định các tag không có trên OPC UA.** Hãy bật Expose Tag Providers, nếu không thứ một lần duyệt tìm thấy chỉ là chẩn đoán của chính máy chủ và các thư mục thiết bị.
3. **Chứng chỉ, theo cả hai chiều.** HotLoop từ chối chứng chỉ của Ignition cho đến khi bạn chấp thuận nó, như ở trên. Ignition từ chối chứng chỉ của HotLoop cho đến khi bạn tin tưởng nó trong chứng chỉ máy chủ OPC UA của Gateway. Trên đĩa, đó là chuyển nó từ `data/config/local/com.inductiveautomation.opcua/server/security/pki/rejected/certs` sang `.../trusted/certs`, không cần khởi động lại. **Ignition không đặt tên tệp đó theo dấu vân tay SHA-1 mà HotLoop ghi log.** Hãy mở chứng chỉ và so dấu vân tay; tên tệp sẽ không khớp và đó không phải dấu hiệu của kẻ mạo danh.
4. **Đăng nhập OPC UA là `opcuauser` / `password`** trong nguồn người dùng `opcua-module`, ở mọi bản cài mới. Hãy đổi nó trước khi có bất cứ thứ gì thật kết nối.

Chỉ những gì máy chủ của 8.3 cung cấp ngay khi cài mới được thử theo chiều này: `Basic256Sha256` và `SignAndEncrypt`.

**Chiều ngược lại cũng đã được kiểm chứng: client OPC UA của Ignition 8.3.9 đọc máy chủ OPC UA của HotLoop**, đăng nhập với tư cách viewer của HotLoop, qua mọi chính sách và chế độ bảo mật mà Ignition cung cấp. Phần thiết lập, sự tin cậy chứng chỉ theo cả hai chiều, các điểm cần lưu ý và ma trận chính sách nằm ở [Máy chủ OPC UA](/vi/edge/opc-ua-server/#ignition-83-làm-client). Nó đã tìm ra hai lỗi của HotLoop, cả hai đã được sửa: máy chủ tạo chứng chỉ mới mỗi lần container của nó được tạo lại, làm hỏng sự tin cậy của Ignition sau mỗi lần nâng cấp, và Discover tags khai báo mọi tag là float, nên một tag văn bản đến Ignition là `Bad_TypeMismatch` (ở trên).

Node biên Sparkplug và Edge Relay của HotLoop với MQTT Engine của Ignition là bước tiếp theo và chưa làm xong.

### OPC UA PubSub (UADP)

Một loại OPC UA khác: không phải client hỏi máy chủ, mà là một publisher gửi các DataSet dưới dạng datagram UDP đến bất kỳ ai đang lắng nghe, unicast hoặc multicast (OPC 10000-14, mã hóa UADP). HotLoop subscribe, ở vai trò thiết bị, và publish, ở vai trò một cài đặt.

**Subscribe.** Thêm một thiết bị với giao thức `opcua-pubsub`. Địa chỉ là nơi để lắng nghe: `udp://239.0.0.1:4840` tham gia một nhóm multicast, `udp://:4840` lắng nghe unicast. Địa chỉ của tag là `<DataSetWriterId>/<field index>`, vị trí của trường trong DataSet của publisher tính từ 0: `1000/3` là trường thứ tư mà writer 1000 publish. UADP không mang tên trường (chúng nằm trong một DataSetMetaData mà publisher phục vụ bằng cách khác, hoặc hoàn toàn không có), nên vị trí là điều một datagram có thể nói. Một trường là mảng được đọc từng phần tử một: `1000/3[17]` là giá trị thứ mười tám của mảng là trường thứ tư. Browse liệt kê các trường đã nghe thấy, kèm kiểu của chúng, và một mảng thì liệt kê theo các phần tử (1000 phần tử đầu).

```json
{"publisherId":"2234","writerGroupId":100,"interface":"eth0","timeoutMs":30000,
 "dataSets":[{"writerId":62541,"types":["Float","UInt16","Boolean","Int32","Double"]}]}
```

- `publisherId` và `writerGroupId` giữ một thiết bị chỉ theo một publisher và một nhóm. Rỗng và bằng không thì nhận tất cả. Đó là cách nhiều thiết bị dùng chung một địa chỉ: một publisher gửi hai WriterGroup tới `udp://:4840` là hai thiết bị ở đó, một với `"writerGroupId":1` và một với `"writerGroupId":2`.
- Các thiết bị có thể dùng chung một địa chỉ và cổng. HotLoop mở một socket cho nó (một lần tham gia, đối với một nhóm multicast trên một card) và chuyển mọi datagram cho mọi thiết bị trên đó. Mỗi thiết bị sau đó áp dụng `publisherId`, `writerGroupId` và `dataSets` của riêng nó, nên mỗi thiết bị thấy toàn bộ luồng của publisher của nó và không có luồng nào bị chia giữa các thiết bị. Socket đóng khi thiết bị cuối cùng trên đó bị gỡ hoặc dừng, và thiết bị kế tiếp khởi động sẽ mở lại. Các thiết bị được khớp theo địa chỉ như được viết: `udp://:4840`, `udp://0.0.0.0:4840` và `udp://[::]:4840` là ba địa chỉ với HotLoop, và chúng có thể cùng tồn tại hay không tùy hệ điều hành, như xưa nay. Một nhóm multicast tham gia trên hai card khác nhau là hai socket. Không có gì thay đổi với thiết bị đứng một mình trên địa chỉ của nó.
- Nhóm, cổng và card đều là của thiết bị: không có gì cố định trong HotLoop. `udp://239.192.0.1:4850` với `"interface":"eth0"` tham gia nhóm đó trên card đó, và `udp://127.0.0.1:4842` lắng nghe một publisher trên cùng máy. Nhiều thiết bị có thể lắng nghe các nhóm và cổng khác nhau cùng lúc, hoặc cùng một nhóm.
- `interface` là card mạng mà nhóm multicast tham gia, theo tên (`eth0`, `lo`) hoặc theo một trong các địa chỉ IPv4 của nó (`127.0.0.1`). Máy có nhiều hơn một card cần nó. Một publisher trên cùng máy gửi tới một nhóm qua loopback (`IP_MULTICAST_IF` 127.0.0.1, TTL 0, loopback bật, không có route) được một thiết bị với `"interface":"lo"` hoặc `"127.0.0.1"` nghe thấy; khi không nêu interface và không có route, việc tham gia thất bại với `no such device` và nói rõ như vậy.
- `dataSets` chỉ dành cho RawData, loại không mang kiểu trên đường truyền: các kiểu trường của publisher, theo thứ tự, để đọc được các byte. Thông điệp Variant và DataValue tự mang kiểu. Mỗi mục là một tên kiểu (`"Float"`), và cũng có thể nói cách một khối giá trị được bố trí: `"Float*250"` là 250 trường nối tiếp nhau không có độ dài ở trước, cách một PLC gửi một khối REAL dưới dạng các trường riêng viết; `"Float[250]"` là một trường mảng gồm tối đa 250 giá trị, được viết như stack của OPC Foundation viết một mảng RawData (một số đếm Int32, các giá trị và đệm số không cho đủ 250); và `"String(40)"` là một String đệm đến 40 byte, đứng một mình hoặc như `"String(40)[4]"`.
- Key frame thay các trường của một DataSet; delta frame thay những trường mà chúng nêu tên; keep alive chứng tỏ publisher còn sống. Một thông điệp bị mất (một khoảng trống trong số thứ tự) đánh dấu các tag của DataSetWriter đó là **uncertain** cho đến key frame kế tiếp của nó, vì một delta có thể đã mất cùng. Một thay đổi trong phiên bản cấu hình của DataSet làm quên mọi trường cho đến khi một key frame nói chúng giờ có nghĩa gì.
- Một writer im lặng quá `timeoutMs` (30 giây nếu không đặt) đọc là **bad** kèm lý do đó, và một thiết bị không nghe thấy gì từ publisher của nó trong thời gian chờ là down. Một trường mà publisher đánh dấu Bad là bad, và một trường nó đánh dấu Uncertain là uncertain; lý do là mã trạng thái.
- Thời gian của số đọc là của publisher, lấy từ trường, DataSetMessage hoặc NetworkMessage, khi nó được đặt và không vượt quá một phút so với đồng hồ này, và nếu không thì là thời điểm nó đến.
- Mảng được đọc trong thông điệp Variant và DataValue (một số đếm Int32 và các giá trị, OPC 10000-6 5.2.2.16; một mảng nhiều chiều đến dưới dạng phẳng, từng hàng một) và, với một layout, trong RawData. Một số đếm mà datagram không thể chứa bị từ chối trước khi tạo bất cứ thứ gì cho nó.
- Chỉ đọc. Bảo mật thông điệp (NetworkMessage được ký hoặc mã hóa), thông điệp chia khối, thông điệp khám phá, sự kiện và trường cấu trúc không được hỗ trợ; một datagram có bất kỳ thứ nào trong số đó bị từ chối, được đếm theo lý do và không bao giờ bị đoán.

**Publish.** Tắt cho đến khi `HOTLOOP_UADP_PUBLISH_ENABLED` được đặt, trong Edge và Gateway (các sản phẩm có máy chủ OPC UA). Nó gửi các tag mà một layout nêu tên:

```json
{"dataSets":[{"writerId":1,"name":"press","configMajor":1,"fields":[
  {"device":"press-01","tag":"Zone1_Temp","type":"Float"},
  {"device":"press-01","tag":"Cycle","type":"UInt32"}]}]}
```

| Biến | Mặc định | <span class="sr-only">Chi tiết</span> |
|---|---|---|
| `HOTLOOP_UADP_PUBLISH_ADDRESS` | | `udp://239.0.0.1:4840` cho một nhóm multicast, `udp://host:4840` cho một subscriber |
| `HOTLOOP_UADP_PUBLISH_LAYOUT_FILE` hoặc `_LAYOUT` | | layout ở trên, dưới dạng tệp hoặc nội tuyến (tệp được ưu tiên) |
| `HOTLOOP_UADP_PUBLISH_PUBLISHER_ID` | `1` | một số hoặc một văn bản |
| `HOTLOOP_UADP_PUBLISH_WRITER_GROUP_ID` | `1` | |
| `HOTLOOP_UADP_PUBLISH_INTERVAL` | `1s` | |
| `HOTLOOP_UADP_PUBLISH_KEY_FRAME_EVERY` | `10` | tối đa chừng này chu kỳ giữa các key frame |
| `HOTLOOP_UADP_PUBLISH_DATAVALUE` | `false` | các trường DataValue (giá trị, trạng thái, thời gian) thay vì Variant |
| `HOTLOOP_UADP_PUBLISH_DELTA_FRAMES` | `false` | một DataSet đã thay đổi được gửi dưới dạng delta frame (chỉ các trường thay đổi) giữa các key frame |
| `HOTLOOP_UADP_PUBLISH_INTERFACE`, `_TTL` | của hệ thống, `1` | card mà multicast đi ra, và giới hạn hop của nó |

Mỗi DataSet đi ra trên DataSetWriter riêng của nó, mỗi lần một NetworkMessage. Một DataSet có giá trị thay đổi đi ra dưới dạng key frame (mọi trường), một DataSet không đổi đi ra dưới dạng keep alive, và một key frame ít nhất mỗi `KEY_FRAME_EVERY` chu kỳ để một subscriber tham gia muộn bắt kịp. Delta frame mặc định tắt: một key frame là đầy đủ, nên một datagram mất tốn một chu kỳ chứ không để lại giá trị sai. Với `HOTLOOP_UADP_PUBLISH_DELTA_FRAMES=true`, một DataSet đã thay đổi đi ra dưới dạng delta frame, chỉ mang các trường thay đổi kể từ thông điệp trước và vị trí của chúng, và key frame vẫn đến ít nhất mỗi `KEY_FRAME_EVERY` chu kỳ; một delta bị mất khi đó tốn đến chừng ấy chu kỳ của một trường lỗi thời, cái giá của một thông điệp nhỏ hơn trên đường truyền chậm. Subscriber của chính HotLoop đọc được delta frame. value. Một tag bad được publish dưới dạng trạng thái của nó và không bao giờ là giá trị cuối; một tag chưa có gì được đọc được publish là `BadWaitingForInitialData`. Giá trị bị chặn theo kiểu đã publish, không bị cuộn vòng. Bảo mật thông điệp không được hỗ trợ, nên việc này thuộc về một mạng mà nhà máy tin cậy. Các tag của cùng layout có thể được đọc bởi subscriber của chính HotLoop trên một máy khác.

**Điều đã được chứng minh.** Một stack OPC UA PubSub độc lập publish tới subscriber của HotLoop và subscribe tới publisher của HotLoop qua multicast, và publisher của HotLoop được subscriber của chính HotLoop đọc đúng.
### CODESYS

Một PLC chạy runtime CODESYS Control (Linux SL, ARM64, Raspberry Pi, Windows, PLC ảo), được đọc và ghi theo tên mà lập trình viên đặt cho các biến: `Application.GVL_Line.rTemp`, không phải node id. Nó là trình điều khiển OPC UA cùng những thứ một PLC CODESYS cần thêm vào, nên mọi thứ trong [OPC UA: bảo mật và thông tin xác thực](#opc-ua-bảo-mật-và-thông-tin-xác-thực) đều đúng cho nó và các tùy chọn của nó chính là các tùy chọn đó.

**Tại sao là máy chủ OPC UA, và điều đó có nghĩa gì với PLC.** CODESYS tài liệu hóa một cách duy nhất để bên thứ ba đọc các biến của một bộ điều khiển, và đó là máy chủ OPC UA của chính runtime: Symbol Configuration của ứng dụng (hoặc, từ CODESYS 3.5 SP18, một IEC Symbol Set dưới Communication Manager) nói biến nào được publish và với quyền truy cập gì, và máy chủ phục vụ chúng. Giao thức kênh của CODESYS Gateway không được tài liệu hóa cho bên thứ ba và trình điều khiển này không nói giao thức đó. Vì vậy PLC phải publish những gì bạn muốn thấy:

1. Trong IDE, thêm một **Symbol Configuration** vào ứng dụng, với *Support OPC UA features* bật, rồi đánh dấu các biến, hoặc đánh dấu chúng trong phần khai báo bằng `{attribute 'symbol' := 'readwrite'}` (`'read'` cho chỉ đọc).
2. Tải xuống. Một PLC không có Symbol Configuration trả lời bước thiết lập bằng một thông báo nói hãy thêm một cái.
3. Một biến chỉ ghi được từ HotLoop khi symbol của nó là `readwrite` và người dùng mà nó kết nối với tư cách đó được phép ghi nó (*Symbol Rights* của thiết bị). HotLoop đọc mức truy cập và nói bên nào trong hai bên đã từ chối một lần ghi.

Nguồn: [Trợ giúp CODESYS, Symbol Configuration](https://content.helpme-codesys.com/en/CODESYS%20Communication/_cds_symbolconfiguration.html) và [IEC Symbol Set](https://content.helpme-codesys.com/en/CODESYS%20Communication/_comm_symbol_configuration.html) (tên symbol là `<application>.<POU>.<variable>`, quyền truy cập là đọc, ghi hoặc thực thi cho mỗi symbol, quyền của các nhóm nằm trên tab Symbol Rights của thiết bị, và OPC UA cần một chứng chỉ trên bộ điều khiển); [mô hình thông tin OPC UA của PLCopen cho IEC 61131-3](https://plcopen.org/system/files/downloads/plcopen_opc_ua_information_model_for_iec61131-3_version1.02.pdf) (bản 1.02, bố cục bên dưới); OPC UA Part 5 (OperationLimits). Các node id là những gì một runtime 4.22.0.0 đã trả lời, mà trình điều khiển này được viết dựa theo; cách viết chính xác `|var|` là của runtime, không phải một hợp đồng được công bố, vì vậy một tag được địa chỉ hóa bằng symbol và trình điều khiển tự dựng node id.

**Bố cục.** Runtime publish, trong `DeviceSet` của OPC UA Device Integration, một thiết bị cho PLC, `Resources` bên dưới nó, và ứng dụng bên dưới đó, với `GlobalVars` (các danh sách biến) và `Programs` ở dưới. Node của một biến là `ns=<n>;s=|var|<device>.<application>.<list or program>.<variable>` trong namespace `CODESYSSPV3/3S/IecVarAccess`. Trình điều khiển tìm thiết bị và ứng dụng bằng cách duyệt, nên một tag vẫn sống sót khi dự án bị đổi tên.

**Địa chỉ.** Một symbol IEC, có hoặc không có ứng dụng:

```
Application.GVL_Line.rTemp        a variable of a variable list
GVL_Line.rTemp                    the same; the application is assumed
Application.PLC_PRG.nCount        a program's variable
GVL.motors[2].speed               a field of an element of an array of structures
nsu=CODESYSSPV3/3S/IecVarAccess;s=|var|CODESYS Control for Linux SL.Application.GVL.x
                                  a node id, if you have one
```

**Discover tags** liệt kê những gì ứng dụng xuất ra, theo các kiểu nó có: STRING là `string`, BYTE là `uint16`, TIME là `int64` (mili giây), kiểu liệt kê là `int32`, các độ rộng số nguyên giữ nguyên, REAL và LREAL là `float`. Runtime nói STRING, BYTE hay TIME là một kiểu của mô hình PLCopen (ví dụ `ns=3;i=3013`); trình điều khiển theo các tham chiếu `HasSubtype` của nó tới kiểu chuẩn mà nó thuộc về, đó cũng là cách một lần ghi vào BYTE được gửi dưới dạng Byte. Mỗi biến mang quyền truy cập mà symbol của nó được gán. Một cấu trúc và một mảng được đi vào trong: một điểm cho mỗi trường và mỗi phần tử. Nó bỏ qua các thuộc tính riêng của runtime (`|vprop|`), danh sách task và đối tượng Server.

Một mảng liệt kê 32 phần tử đầu (`arrayElements`), vì một bộ đệm một nghìn phần tử không phải là một nghìn thứ cho một dashboard, và một tag có thể địa chỉ hóa bất kỳ phần tử nào bằng symbol của nó. Danh sách dừng ở `browseMaxNodes` và nói như vậy; `browseRoot` đặt thành một symbol (`Application.GVL_Demo`) liệt kê một phần của ứng dụng. Việc duyệt theo chiều rộng, nên các biến của một danh sách đến trước các phần tử của mảng, và các phản hồi được giữ ở kích thước mà runtime chấp nhận (nó đóng kết nối với phản hồi gồm một trăm mảng một nghìn phần tử).

Cấu hình: các tùy chọn OPC UA, và `device` (tên của PLC, chỉ khi runtime liệt kê nhiều hơn một), `application` (chỉ khi không cái nào tên là Application), `arrayElements`. Một tùy chọn viết sai là một lỗi liệt kê các tùy chọn hợp lệ. Mật khẩu là một secret, được lưu và che như mọi secret của thiết bị.

**Runtime đòi hỏi gì ở client.** Nó publish `OperationLimits` bằng 100 cho đọc, duyệt và monitored item trên mỗi yêu cầu, và từ chối yêu cầu lớn hơn bằng `BadTooManyOperations`. Trình điều khiển đọc các giới hạn đó khi kết nối và cắt mọi yêu cầu theo chúng, cho mọi thiết bị OPC UA (một runtime CODESYS là cái đầu tiên có vấn đề: trước đó trình điều khiển báo mọi tag được phát hiện là float và không đọc được tag nào của một thiết bị có hơn 100 biến). Lấy mẫu mặc định một giây và hàng đợi một mục, vì một PLC có một chu kỳ quét phải giữ và một gateway Ignition đang đọc nó không nên bị lấy mất; hãy đặt `samplingIntervalMs` để yêu cầu nhiều hơn.

**Tải xuống, khởi động lại và mất liên kết.** Khởi động lại runtime, hoặc nạp một chương trình mới, làm rớt phiên. Thiết bị chuyển sang ngắt kết nối, mọi tag đọc là bad với lý do "runtime của PLC không trả lời", và HotLoop tự kết nối lại với backoff và đọc các symbol như hiện giờ. Một symbol đang đọc được mà bị từ chối là đã biến mất hai lần liên tiếp được coi là một lần tải xuống mà runtime giữ nguyên phiên, và phiên bị bỏ để kết nối lại theo cách đó. Một tag cho biến mà chương trình không có đọc là bad với lý do của máy chủ và không gây kết nối lại.

**Bảo mật máy chủ OPC UA của runtime.** Một runtime CODESYS Control chỉ đưa ra các endpoint không bảo mật cho đến khi máy chủ OPC UA của nó có chứng chỉ, và khi đó nó cũng đưa ra các chính sách của `CommunicationPolicy` (mặc định AES128-SHA256-RSAOAEP, Basic256Sha256, AES256-SHA256-RSAPSS) với Sign và SignAndEncrypt. CODESYS tài liệu hóa việc tạo chứng chỉ đó trong Security Screen (CODESYS Security Agent, Devices, bộ điều khiển, OPC UA Server) và tin tưởng một client bằng cách chuyển chứng chỉ của nó từ "Certificates in Quarantine" sang "Trusted Certificates". Shell PLC của runtime Linux làm điều tương tự không cần IDE, với các lệnh CODESYS liệt kê cho shell PLC của trình soạn thiết bị (`cert-getapplist`, `cert-genselfsigned <n>`, `cert-getcertlist quarantine`, `cert-export`, `cert-import trusted`), qua Unix socket mà runtime Linux tài liệu hóa cho nó (`/var/opt/codesyscontrolapi/plcshell.sock`, "Accessing the PLC Shell"). Đặt thiết bị thành `securityMode` `SignAndEncrypt` với một `securityPolicy`, kết nối một lần (chứng chỉ của chính HotLoop rơi vào quarantine của runtime và kết nối bị từ chối, kèm thông báo nói như vậy), tin tưởng chứng chỉ đó, và thiết bị đọc được. Chưa trình bày: Security Screen của IDE, chứng chỉ do CA ký, quản lý người dùng với một runtime được bảo mật.

**Một runtime không có giấy phép tự dừng.** Một runtime CODESYS Control không có giấy phép chạy ở chế độ demo và tự tắt sau khoảng hai giờ (log của runtime ghi `no runtime license - running in demo mode(~2 hours)` ở mỗi lần khởi động). Từ phía HotLoop, đó là một lần khởi động lại runtime như mọi lần khác: thiết bị chuyển sang ngắt kết nối với "runtime của PLC không trả lời" và tự trở lại ngay khi có thứ gì đó khởi động lại runtime (chính sách restart của container, một unit systemd). Không có gì trong HotLoop đếm hai giờ hay đối xử khác với lần dừng này, và không có gì khởi động lại runtime thay bạn; một runtime không được khởi động lại vẫn ở trạng thái ngắt kết nối. Chạy với một runtime 4.22.0.0 trong container không có giấy phép: nó tự dừng 2 giờ 5 phút sau khi khởi động, với mã thoát 0; chính sách restart của container khởi động lại nó 31 giây sau, ứng dụng của nó chạy 82 giây sau đó, và thiết bị đọc tốt trở lại 35 giây sau khi ứng dụng bắt đầu (2 phút 28 giây tính từ lúc dừng), không có bước thủ công nào.

**Ghi.** Một tag chỉ đọc cho đến khi ai đó đánh dấu nó ghi được, như với mọi thiết bị, và không thứ gì một bước thiết lập tạo ra là ghi được. Sau đó cổng ghi giống như với OPC UA, với phần của PLC đứng trước: một lần ghi vào symbol được xuất ở dạng chỉ đọc, hoặc vào symbol mà người dùng không được phép ghi, bị từ chối bằng lời của PLC và không bao giờ được gửi.

**Thiết lập từ luồng tích hợp** (`codesys`): địa chỉ của runtime, các câu hỏi bảo mật OPC UA, và tùy chọn một dashboard đầu tiên gồm các điểm được giữ lại (màn hình mà WebVisu lẽ ra là; xem [Tích hợp](/vi/iot/integrations/#codesys)). Đã kiểm chứng với một runtime 4.22.0.0 trong container; xem bảng trạng thái về những gì điều đó không bao gồm.

### Modbus TCP/RTU

Con ngựa thồ từ năm 1979. PLC, biến tần, đồng hồ điện, RTU, và phương án dự phòng của mọi gateway không có gì tốt hơn.

```
holding:100:float32:CDAB    a float across registers 100-101, word-swapped
holding:40:bit3             bit 3 of register 40
holding:200:string16        16 characters from register 200
input:12:int16              a signed input register
coil:5                      a single coil
```

**Thứ tự word** là cài đặt mà mọi người hay làm sai nhất, và một số float đọc sai thứ tự không hiển nhiên sai trên màn hình, nó là một con số hợp lý nhưng không phải sự thật. Cả bốn hoán vị đều được hỗ trợ theo các tên mà sổ tay nhà cung cấp in: `ABCD`, `CDAB`, `BADC`, `DCBA`. Đặt mặc định cho thiết bị bằng `byteOrder` và ghi đè cho từng tag bằng trường địa chỉ thứ tư.

**Địa chỉ hóa** là thô và bắt đầu từ không. Nếu bản vẽ của bạn dùng cách đánh số kiểu 40001 truyền thống, hãy đặt `oneBased: true` và viết các số từ bản vẽ. Sai lệch một đơn vị ở đây là lỗi Modbus lâu đời nhất.

Các lần đọc được gộp thành khối: các thanh ghi liền kề và gần kề trở thành một yêu cầu. `maxGap` kiểm soát bao nhiêu thanh ghi không dùng đáng đọc để tránh một lượt đi về thứ hai (mặc định 8), `maxBlock` giới hạn một yêu cầu đơn (mặc định 120, trần của giao thức là 125).

Ghi một bit đơn của holding register là đọc-sửa-ghi, vì Modbus không có thao tác đặt bit nguyên tử ở đó. Mười lăm bit còn lại được giữ nguyên.

### MQTT và Sparkplug B

MQTT thuần, hoặc Sparkplug B với vai trò một **primary host application đầy đủ**.

Các topic thuần:
```
mqtt:plant/line1/temperature              a scalar payload
mqtt:plant/line1/state|data.temperature   JSON, extracted by path
mqtt:plant/+/flow                         wildcards work
```

Các metric Sparkplug:
```
spb:GroupId|EdgeNodeId|DeviceId|Metric/Name
spb:Plant|Edge1||Node/Uptime               empty device = a node-level metric
```

Là một primary host, trình điều khiển làm những việc mà đặc tả yêu cầu và hầu hết các tích hợp bỏ qua:

- Publish một `STATE` birth retained với một will tương ứng, để các node biên thấy host rớt thay vì suy ra từ một timeout. Mặc định theo dạng Sparkplug 3.0 (`spBv1.0/STATE/<host>` mang JSON); đặt `legacyState` cho chuỗi `ONLINE`/`OFFLINE` trước 3.0.
- Theo dõi số thứ tự xoay vòng của từng node và yêu cầu node rebirth khi nó bỏ qua số, vì một khoảng trống nghĩa là đã lỡ thông điệp và bảng alias không còn đáng tin.
- Yêu cầu rebirth sau lần kết nối lại của chính nó. Một host đã vắng mặt không biết điều gì đã thay đổi trong lúc đó.
- Khớp `NDEATH` với `NBIRTH` theo `bdSeq`, để một death certificate còn sót từ phiên trước không thể giết phiên hiện tại.

Thứ tự thông điệp được thực thi. Chuyển các thông điệp Sparkplug đồng thời làm đảo thứ tự của chúng, khiến một node khỏe mạnh trông như đang rớt thông điệp và gây ra một cơn bão rebirth.

### EtherNet/IP (CIP)

Allen-Bradley ControlLogix, CompactLogix và Micro820. Tag có tên, nên có thể hỏi bộ điều khiển nó đang giữ những gì.

```
Temperature                    type from the tag's declared dataType
Speed:dint                     an explicit type wins
Program:MainProgram.Speed      a program-scoped tag, the colon is part of the path
Zones[0].Heater.On:bool        array elements and UDT members
```

CIP có kiểu chặt chẽ và bộ điều khiển từ chối một lần đọc có kiểu khai báo không khớp, nên kiểu phải đến từ đâu đó. Nó được lấy từ `dataType` của tag, hoặc từ hậu tố `:type`, thứ được ưu tiên. Không rõ thì dùng `REAL`, kiểu của hầu hết giá trị quy trình.

Các lần đọc được gom thành yêu cầu đa dịch vụ, rồi quay về đọc từng cái khi một lô thất bại để một đường dẫn tag lỗi không làm mù mười chín cái còn lại.

### S7comm

Siemens S7-300, 400, 1200 và 1500, qua ISO-on-TCP theo rack và slot.

```
db1:0:real        a REAL at DB1.DBD0
db1:4:dint        a DINT at DB1.DBD4
db1:8.3:bool      bit 3 of DB1.DBB8
db2:20:string32   a 32-character STRING
m:10:word         merker word MW10
i:0.1:bool        input I0.1
q:2:byte          output byte QB2
```

Kiểu là bắt buộc với bất cứ thứ gì rộng hơn một byte. Giao thức không thể cho bạn biết bốn byte là REAL hay DINT, đó là một sự thật về chương trình PLC, không phải về đường truyền.

Mặc định là rack 0, slot 1 (S7-1200/1500). S7-300/400 thường là slot 2. `connectType` mặc định là 3 (S7 Basic) để gateway không chiếm khe kết nối PG mà một kỹ sư muốn dùng cho TIA Portal.

Không có duyệt. Một CPU S7 không công bố bố cục các khối dữ liệu của nó, điều đó nằm trong dự án TIA Portal.

### MTConnect

Dữ liệu từ xa máy công cụ, chỉ đọc. MTConnect không có kênh lệnh, và trình điều khiển này không giả vờ khác đi.

Địa chỉ hóa theo `dataItemId` hoặc theo tên; các agent không nhất quán về cái nào ổn định, và tài liệu máy chỉ cho thấy cái này hoặc cái kia.

Hai chi tiết phân biệt một tích hợp chạy được với một tích hợp trông có vẻ đúng: `UNAVAILABLE` là agent nói rõ rằng nó không có số đọc, nó trở thành chất lượng bad, không phải văn bản "UNAVAILABLE" và không phải số không. Và ý nghĩa của một Condition là tên phần tử của nó (`Normal`, `Warning`, `Fault`, `Unavailable`), không phải dữ liệu ký tự của nó, thứ thường rỗng.

`Browse` đọc `/probe` và đi qua cây thành phần ở mọi độ sâu.

### HTTP / REST

Phương án gom mọi thứ, cho đồng hồ năng lượng, cảm biến môi trường, bộ điều khiển OEM và phía REST của một gateway mà bên dưới nói một giao thức độc quyền.

```
power.kw                      nested fields
readings[0].value             array indexing
zones[name=Zone1].temp        select an array element by a field value
$.data.temperature            a leading $. is accepted
```

Dạng thứ ba mới là quan trọng: các API này thích trả về một mảng không có thứ tự gồm các đối tượng `{name, value}`, và lập chỉ mục theo vị trí là một lỗi đang chờ một bản cập nhật firmware.

Một yêu cầu phục vụ mọi tag trên thiết bị. `Browse` đi qua tài liệu và báo cáo mọi giá trị vô hướng cùng đường dẫn tới nó.

### Tình trạng máy

Máy mà HotLoop chạy trên đó, như một thiết bị chỉ đọc: `cpu_util_pct` (thời gian CPU không rảnh kể từ lần đọc trước), `mem_util_pct` (MemTotal so với MemAvailable), `disk_util_pct` (đĩa của máy, một statfs của thư mục gốc của host được gắn chỉ đọc tại `diskPath`, mặc định `/host`), `data_util_pct` (volume tại `dataPath`, `/data`), và `rtos_jitter_core1_us` đến `core3_us` khi `jitterFile` nêu tên tệp JSON `{"core1_us":3.2,"core2_us":2.9,"core3_us":4.1}` mà một agent thời gian thực ghi lại (một tệp cũ hơn năm phút đọc là bad). CPU và bộ nhớ lấy từ `procRoot` (`/proc`, hoặc `/host/proc` khi của host được gắn vào). Một giá trị không đọc được là chất lượng bad kèm lý do, không bao giờ là số không. Thiết bị được tạo bởi `HOTLOOP_BOX_HEALTH_NODE` ([Máy chủ OPC UA](/vi/edge/opc-ua-server/#tình-trạng-máy-cho-bảng-điều-khiển-embernet)).

### UniFi Network

Mạng nhà máy như một thiết bị: một site trên một bộ điều khiển UniFi, các switch của nó, mọi cổng switch, mức tiêu thụ PoE, các liên kết WAN và tình trạng của site, dưới dạng các tag tự tạo ra khi thiết bị được adopt, chỉ đọc cho đến khi được kích hoạt. Một lần đăng nhập cho mỗi bộ điều khiển, chứng chỉ được ghim và mật khẩu bộ điều khiển được mã hóa trong cơ sở dữ liệu. Nó chỉ thay đổi bộ điều khiển qua vài tag lệnh mà một người kích hoạt (đèn LED định vị, khởi động lại, chu trình cấp nguồn PoE của một cổng; xem UNIFI.md). Nó cũng lắng nghe websocket sự kiện của bộ điều khiển, nên một switch rớt mạng xuất hiện trong logbook ngay khi nó xảy ra, và việc poll vẫn là sự thật bên dưới, và tab UniFi vẽ phần tổng quan, bản đồ, mặt trước thiết bị, các client, các mạng và WiFi. Mọi thứ về nó nằm ở [UniFi Network](/vi/iot/unifi/).

### SNMP

Bất cứ thứ gì có agent SNMP: switch, UPS, PDU, đồng hồ điện và mọi máy Linux chạy một agent SNMP. Chỉ đọc. HotLoop không bao giờ gửi SNMP SET, vì một SET có thể thay đổi cấu hình của switch và mục đích của trình điều khiển này là nhìn thấy mạng nhà máy, không phải vận hành nó.

```
1.3.6.1.2.1.1.5.0             sysName
.1.3.6.1.2.1.1.3.0            sysUpTime, a leading dot is accepted
1.3.6.1.2.1.2.2.1.8.2         ifOperStatus of the interface with ifIndex 2
```

Địa chỉ của một tag là OID của một instance, các số cách nhau bằng dấu chấm. Một giá trị vô hướng kết thúc bằng `.0`; một ô bảng kết thúc bằng chỉ số hàng của nó. `dataType` của tag quyết định nó trở thành gì:

* Một số mà agent gửi (Integer, Gauge32, Counter32, Counter64, TimeTicks) chính là số đó. Scale và offset áp dụng như ở mọi nơi.
* Một OCTET STRING là văn bản, trừ khi tag là số, và khi đó nó được phân tích. Đó là cách một tải trung bình (`laLoad` là văn bản `0.15`) hay một nhiệt độ phía sau một agent đến nơi. Văn bản không phải số là một số đọc bad nói rõ điều đó, không bao giờ là số không.
* Một OCTET STRING không in được (một địa chỉ MAC) là `0x` và hex.

**Bộ đếm là giá trị thô.** Một Counter32 hay Counter64 chỉ tăng và quay vòng. Tag giữ những gì agent gửi, và tốc độ là việc của bất cứ thứ gì đọc tag. Counter64 được giữ dưới dạng float, chính xác đến 2^53; một cổng chạy hết tốc độ đường truyền cần hàng chục năm để tới đó.

**TimeTicks là phần trăm giây**, nên `sysUpTime` đọc như một tag thường là theo 1/100 giây. Tích hợp quy đổi nó sang giây cho bạn; một tag làm bằng tay nên đặt `scale` thành `0.01`.

**Một đối tượng mà agent không có là một số đọc bad kèm lý do**, và các đối tượng khác trong cùng yêu cầu vẫn được đọc: v2c và v3 cho biết những cái nào bị thiếu, còn với v1, thứ trả lời một đối tượng thiếu bằng lỗi cho cả yêu cầu, trình điều khiển bỏ cái đó ra và hỏi lại phần còn lại. Một câu trả lời quá lớn so với agent được hỏi lại theo từng nửa.

Tùy chọn thiết bị (`config`):

| Tùy chọn | Ý nghĩa |
|---|---|
| `version` | `1`, `2c` hoặc `3`. Mặc định `2c` |
| `community` | Community của v1 và v2c. Bắt buộc với các bản đó, và **không có mặc định**: `public` là cách các switch của một nhà máy bị bất kỳ ai hỏi đọc được. Một secret |
| `username` | Người dùng v3 |
| `securityLevel` | `noAuthNoPriv`, `authNoPriv` hoặc `authPriv`. Mặc định: `authPriv` khi có cụm mật khẩu riêng tư, `authNoPriv` khi chỉ có cụm mật khẩu xác thực, nếu không thì `noAuthNoPriv` |
| `authProtocol` | `MD5`, `SHA`, `SHA224`, `SHA256`, `SHA384` hoặc `SHA512`. Mặc định `SHA` |
| `authPassword` | Cụm mật khẩu xác thực. Một secret |
| `privProtocol` | `DES`, `AES`, `AES192`, `AES256`, `AES192C` hoặc `AES256C`. Mặc định `AES` |
| `privPassword` | Cụm mật khẩu riêng tư. Một secret |
| `contextName` | Context của v3. Hầu như luôn để trống |
| `transport` | `udp` (mặc định) hoặc `tcp` |
| `retries` | Số lần gửi lại một yêu cầu không có phản hồi, từ 0 đến 10. Mặc định 1 |
| `maxRepetitions` | Số hàng cho mỗi GETBULK trong một lần walk. Mặc định 10, mức mà các agent nhỏ nhất vẫn trả lời được |
| `browseRoots` | Các OID để walk khi phát hiện điểm. Mặc định: system, các bảng interface, host resources, bảng load và các đầu ra extend của một agent SNMP |
| `browseMaxNodes` | Nơi một lần duyệt dừng. Mặc định 2000 |

Địa chỉ là `host` hoặc `host:port`, cổng mặc định là 161.

**Một community sai không nhận được gì.** Một agent SNMPv1 hoặc v2c bỏ một yêu cầu mang community mà nó không biết, nên community sai, cổng sai, tường lửa và một agent đang tắt đều trông như một timeout, và thông báo của HotLoop nêu cả bốn. SNMPv3 thì phân biệt được: một cụm mật khẩu sai hay một người dùng không xác định bị từ chối đúng như vậy (`ErrAuthRejected`), và HotLoop chờ rất lâu trước khi thử lại cùng thông tin xác thực.

`Browse` đi qua các cây con mà HotLoop có thể nêu tên và đặt tên cho mỗi đối tượng: tên của MIB, như `sysName`, `ifOperStatus.2`, `ifHCInOctets.2`, `laLoad.1`, hoặc OID dưới dạng `oid.1.3.6.1...` cho cái nó không biết. Các tên, cùng OID, kiểu và đơn vị đằng sau chúng, đến từ các MIB định nghĩa chúng: SNMPv2-MIB (RFC 3418), IF-MIB (RFC 2863), HOST-RESOURCES-MIB (RFC 2790) và UCD-SNMP-MIB cùng NET-SNMP-EXTEND-MIB của một agent SNMP. Mọi thứ khác agent có vẫn đọc được; hãy thêm nó thành tag theo OID.

Tích hợp (xem [Tích hợp](/vi/iot/integrations/#snmp)) hỏi thay bạn.

### BACnet/IP

Một bộ điều khiển tự động hóa tòa nhà, một đồng hồ, một bộ điều nhiệt: bất cứ thứ gì trên mạng IP nói BACnet. Chỉ đọc. HotLoop không bao giờ ghi một thuộc tính BACnet, vì một lần ghi rơi vào một đầu ra điều khiển được qua một priority array, và một mức ưu tiên còn đặt sẽ giữ thiết bị ở nơi nó được đặt rất lâu sau khi người đặt đã về nhà. Đó là một tính năng phải được thiết kế có chủ đích, không phải thứ để lăn lóc ở đó.

Nó được giữ theo các khung ghi từ một thiết bị thật, được giải mã bởi các bài kiểm tra luôn chạy, và theo thiết bị đó khi kiểm thử.

```
analog-input:1                present value of analog input 1
ai:1                          the same, abbreviated
av:3.units                    a property other than the present value, by name
analog-input:1.117            or by number
multi-state-value:2           present value of a multi-state value
```

Địa chỉ của một tag là đối tượng, `<type>:<instance>`, cùng một dấu chấm và một thuộc tính khi nó không phải present value. Các kiểu, theo tên hoặc viết tắt: `analog-input` (`ai`), `analog-output` (`ao`), `analog-value` (`av`), `binary-input` (`bi`), `binary-output` (`bo`), `binary-value` (`bv`), `multi-state-input` (`msi`), `multi-state-output` (`mso`), `multi-state-value` (`msv`), `accumulator` (`acc`), `integer-value` (`iv`), `positive-integer-value` (`piv`), `large-analog-value` (`lav`) và `characterstring-value` (`csv`). Các thuộc tính theo tên là `present-value`, `object-name`, `description`, `units`, `status-flags`, `out-of-service`, `reliability`, `number-of-states`, `state-text`, `object-type`, `object-identifier`, `object-list`, `vendor-name`, `vendor-identifier`, `model-name`, `firmware-revision` và `application-software-version`; mọi thuộc tính khác là số của nó.

Một tag trở thành gì tùy theo `dataType` của nó: một số mà thiết bị gửi (real, double, unsigned, signed, enumerated, boolean) là số đó, và `active` của một đối tượng nhị phân là 1 còn `inactive` là 0; một chuỗi ký tự là văn bản, hoặc một số nếu tag là số và văn bản là số; một present value `null` là một số đọc bad nói rằng thiết bị không có gì để báo. Một thuộc tính chứa nhiều hơn một giá trị (một danh sách đối tượng) không thể là tag.

**Status flag là một phần của số đọc.** Mỗi lần poll hỏi status flag của một đối tượng trong cùng yêu cầu với present value của nó, và một đối tượng có cờ **fault** được đặt đọc là **bad**, kèm lý do. Đối tượng **out of service** hoặc **overridden** đọc là **uncertain**: present value của nó là thứ một người hay một chương trình đặt vào, không phải một phép đo, và các biểu đồ xu hướng và báo cáo bỏ các số đọc uncertain ra giống như bad (quy tắc chất lượng). **In alarm** riêng nó là một số đọc tốt của một điểm đang trong trạng thái báo động.

**Điều thiết bị không có là một số đọc bad kèm lý do, và phần còn lại vẫn đọc.** ReadPropertyMultiple trả lời từng thuộc tính riêng, nên một đối tượng không tồn tại (`unknown-object`) hoặc một thuộc tính nó không có (`unknown-property`) làm tag đó thất bại và không tag nào khác. Một thiết bị từ chối ReadPropertyMultiple được đọc từng thuộc tính một từ đó về sau.

**Không có gì được phân đoạn.** Client báo cho thiết bị rằng nó không nhận được câu trả lời phân đoạn. Một thiết bị có câu trả lời không vừa một khung sẽ hủy (`segmentation-not-supported`), và HotLoop hỏi số đối tượng mỗi lần bằng một nửa; một thiết bị có danh sách đối tượng quá lớn để gửi nguyên được đọc từng phần tử một.

Tùy chọn thiết bị (`config`):

| Tùy chọn | Ý nghĩa |
|---|---|
| `deviceInstance` | Số instance mà thiết bị tại địa chỉ này được kỳ vọng có. Khi nó được đặt và thiết bị nói số khác, kết nối bị từ chối: một thiết bị khác trả lời ở một địa chỉ được dùng lại, hoặc một bộ điều khiển đã bị thay, là cách một nhà máy nhận được một con số sai trông sạch sẽ |
| `localAddress` | Địa chỉ của card mạng của máy này để gửi đi, cho một host có nhiều hơn một card. Thường để trống |
| `retries` | Số lần gửi lại một yêu cầu không có phản hồi, từ 0 đến 10. Mặc định 1 |
| `browseMaxObjects` | Nơi một lần duyệt dừng. Mặc định 1000 |

Địa chỉ là `host` hoặc `host:port`, cổng mặc định là 47808. Không có gì trong BACnet/IP là thông tin xác thực, nên không có gì để che.

**Kết nối là hỏi thiết bị nó là ai.** HotLoop gửi cho thiết bị một Who-Is unicast và lấy device instance của nó từ I-Am. Một thiết bị không trả lời cái đó được hỏi đối tượng thiết bị của chính nó dưới instance ký tự đại diện (4194303), mà tiêu chuẩn nói một thiết bị trả lời như chính nó. Một thiết bị không trả lời cả hai được báo cáo là đã thử cả hai, vì các nguyên nhân thường gặp trông giống nhau: địa chỉ hoặc cổng sai, tường lửa, thiết bị đang tắt, hoặc thiết bị trên một mạng phía sau một router.

**Định tuyến chưa được xây dựng.** HotLoop nói chuyện với một thiết bị mà nó có thể gửi một datagram UDP tới. Một bộ điều khiển trên một trunk MS/TP phía sau một router BACnet, hoặc trên một mạng BACnet khác, không truy cập được, và một thiết bị chỉ BBMD mới tới được (foreign device registration) cũng vậy. Hãy địa chỉ hóa phía BACnet/IP của chính router, hoặc đặt một gateway phía trước: xem [chế độ gateway](#mọi-thứ-còn-lại-chế-độ-gateway).

`Browse` đọc đối tượng riêng của thiết bị (tên, nhà cung cấp, model và firmware), danh sách đối tượng của nó, và mọi đối tượng HotLoop đọc: tên, mô tả, đơn vị, present value và status flag, cùng văn bản trạng thái của một đối tượng multi-state. Một tag được đặt tên theo tên riêng của đối tượng, kèm địa chỉ khi hai đối tượng trùng tên. Đơn vị trở thành một nhãn và, khi chúng có nghĩa như vậy, một lớp thực thể: độ Celsius là `°C` và `temperature`, phần trăm độ ẩm tương đối là `%` và `humidity`, kilowatt giờ là `kWh` và `energy`. Một đơn vị mà HotLoop không có nhãn được để không nhãn và nêu trong mô tả bằng số của nó. Các số và tên của những đơn vị đó được giữ theo một thiết bị thật, thiết bị gửi số mà bảng của chính nó gán cho mỗi tên. Tích hợp (xem [Tích hợp](/vi/iot/integrations/#bacnetip)) hỏi thay bạn.

## Đi ra: Kafka API

Mọi thứ ở trên đưa giá trị của thiết bị vào. HotLoop cũng có thể gửi chúng ra một Kafka broker như một luồng sự kiện: mọi số đọc mà historian giữ, và mọi dòng của log hệ thống (cảnh báo, thiết bị lên và xuống, thay đổi), dưới dạng JSON trên các topic bạn đặt tên. Nó là một đích historian, được thiết lập trong Cài đặt, Historian targets, và nhận Apache Kafka, Redpanda và bất cứ thứ gì nói Kafka API, qua TLS với đăng nhập SASL. Các định dạng bản ghi, "at least once" nghĩa là gì ở đây, và điều gì đã và chưa được chứng minh nằm ở [Historian targets](/vi/iot/historian-targets/#kafka-api-luồng-sự-kiện). Client là [franz-go](https://github.com/twmb/franz-go).

## Mọi thứ còn lại: chế độ gateway

**PROFINET · EtherCAT · HART · DNP3 · FINS · MELSEC/SLMP · CANopen · FANUC FOCAS**

Những giao thức này không được nói ở dạng gốc và không có trình điều khiển nào cho chúng. Đó là một lựa chọn có chủ đích, không phải một khoảng trống đang chờ được lấp bằng một stub.

Các nhà máy chạy những giao thức này hầu như luôn đã có một gateway phát lại trên OPC UA hoặc Modbus: một bộ điều khiển PROFINET IO có máy chủ OPC UA, một bộ ghép kênh HART có bản đồ Modbus. Hãy trỏ một thiết bị vào endpoint đó và cấu hình nó như OPC UA hoặc Modbus.

Viết thêm tám trình điều khiển mà mỗi cái lặp lại việc gateway hiện có của nhà máy đã làm sẽ thêm tám thứ để làm sai tinh vi, cho những giao thức mà thiết bị khó kiểm thử nhất. Nếu một nhà máy thực sự không có gateway và cần một trong số này ở dạng gốc, đó là một khối công việc thật cần lên lịch, không phải một tệp để thêm vào rồi ghi log "not implemented".

**Không có trình điều khiển giữ chỗ nào trong cây mã này.** Một giao thức hoặc có một triển khai hoạt động hoặc nằm trong phần này. Một bài kiểm tra bắt buộc rằng mọi giao thức mà mô hình khai báo đều có một trình điều khiển được biên dịch vào, và ngược lại.

## Thông tin xác thực của thiết bị

`config` và `address` của một thiết bị là nơi trình điều khiển tìm những gì nó dùng để đăng nhập. Đây là các thông tin xác thực mà mỗi giao thức đọc, và tất cả đều chỉ ghi qua API (4.15.1): chúng hiện là `[redacted]` với mọi vai trò, một lần lưu gửi giá trị giữ chỗ hoặc bỏ trống khóa sẽ giữ giá trị đã lưu, và một chuỗi mới thay thế nó. Các quy tắc, và những gì không đi qua API, nằm ở [Xác thực và người dùng](/vi/iot/authentication/#thông-tin-xác-thực-của-thiết-bị-chỉ-ghi).

| Giao thức | Thông tin xác thực trong cấu hình | Thông tin xác thực trong địa chỉ |
|---|---|---|
| OPC UA | `password` (cùng `username`) | không có: thông tin người dùng trong địa chỉ bị ẩn, và trình điều khiển bỏ qua nó |
| MQTT / Sparkplug B | `password` (cùng `username`) | `mqtt://user:pass@host`, mà client dùng |
| HTTP / REST | `password` (cùng `username`, gửi dưới dạng basic auth); mọi giá trị trong `headers` trừ các giá trị thông thường như `Accept` và `Content-Type`, nơi một khóa API hoặc header `Authorization` được đặt; `body` và `writeBody` nếu chúng nhắc đến một thông tin xác thực | `http://user:pass@host` và các giá trị truy vấn kiểu `?api_key=`, trong địa chỉ và trong `writeUrl` |
| MTConnect | `password` (cùng `username`); mọi giá trị trong `headers`, với cùng các ngoại lệ | `http://user:pass@host` và các giá trị truy vấn |
| UniFi Network | `password` (cùng `username`). Chỉ được lưu ở dạng mã hóa: không có khóa (bên dưới) thì không lưu được thiết bị | không có: địa chỉ là URL `https://` của bộ điều khiển |
| BACnet/IP | không có | không có: địa chỉ là `host` hoặc `host:port` |
| CODESYS | `password` (cùng `username`), như với OPC UA | không có: thông tin người dùng trong địa chỉ bị ẩn, và trình điều khiển bỏ qua nó |
| SNMP | `community` (v1, v2c); `authPassword` và `privPassword` (v3), cùng `username` | không có: địa chỉ là `host` hoặc `host:port` |
| Modbus, S7comm, EtherNet/IP | không có | không có: thông tin người dùng trong địa chỉ bị ẩn, và trình điều khiển bỏ qua nó |

**Mã hóa khi lưu.** Khi `HOTLOOP_SECRET_KEY_FILE` được đặt (chart đặt nó, với một khóa chart tự tạo), mọi thông tin xác thực trong cột cấu hình ở trên được mã hóa trong cơ sở dữ liệu bằng khóa đó, thứ nằm bên ngoài cơ sở dữ liệu, nên một bản dump hay bản sao lưu chỉ chứa văn bản mã hóa. Phần còn lại của HotLoop, và các trình điều khiển, không bao giờ thấy sự khác biệt. Một thông tin xác thực viết trong một URL (`mqtt://user:pass@host`, `?api_key=`) hoặc trong văn bản tự do như `body` của HTTP cũng được mã hóa: toàn bộ địa chỉ hoặc tùy chọn được niêm phong và trả về đúng như đã gõ, còn một URL không có gì bí mật được để đọc được. Tùy chọn `password` vẫn là nơi gọn gàng hơn cho một thông tin xác thực. Xem [Sao lưu và khôi phục](/vi/iot/backup/#thông-tin-xác-thực-thiết-bị-và-khóa-bí-mật).

Bất kỳ tùy chọn nào khác có tên trông giống một thông tin xác thực (chứa `password`, `token`, `secret`, `apikey`, `authorization`, `private`, `passphrase`, hoặc kết thúc bằng `key`, hoặc có cả một từ như `pass`, `pw`, `auth`, `cred` hay `sig`, cùng những từ khác) cũng bị ẩn, bất kể nó thuộc giao thức nào, nên một tùy chọn được thêm vào một trình điều khiển sau này bị ẩn cho đến khi có người quyết định rằng nó không nên bị ẩn. Một bài kiểm tra đi qua các tùy chọn của mọi trình điều khiển và thất bại cho đến khi mỗi tùy chọn nằm trong danh sách thông tin xác thực hoặc danh sách các tùy chọn đã biết là không phải. Xem [Xác thực và người dùng](/vi/iot/authentication/#thông-tin-xác-thực-của-thiết-bị-chỉ-ghi) để biết các quy tắc đầy đủ.

## Thêm một thiết bị

1. **Devices → Add device.** Chọn giao thức, cho nó một địa chỉ.
2. **Discover tags** ở nơi giao thức hỗ trợ: OPC UA, EtherNet/IP, MTConnect, MQTT (sau một Sparkplug birth), HTTP, SNMP, BACnet/IP, CODESYS. Modbus và S7comm không thể liệt kê các điểm của chính chúng, nên hãy khai báo chúng từ tài liệu của thiết bị.
3. Các tag được nhập được tạo ở dạng **chỉ đọc**. Một điểm mà thiết bị tình cờ lộ ra không phải là một điểm mà ai đó đã quyết định có thể bị ra lệnh. Hãy đánh dấu từng tag là ghi được, từng cái một, một cách có chủ ý.
4. Đặt `scale` và `offset` cho các số đếm thô: `engineering = raw × scale + offset`. Nếu thiết bị đo gửi một mã khi một kênh chết hoặc ngoài dải, hãy liệt kê nó trong [Giá trị không có dữ liệu](#giá-trị-không-có-dữ-liệu) để nó đọc là bad thay vì là một con số.
5. Đặt một `deadband` cho bất cứ thứ gì nhiễu. Nó chặn việc ghi vào historian cho các thay đổi quá nhỏ để đáng kể, và nếu không có nó, một cảm biến 12 bit rung ở bit cuối sẽ ghi một hàng ở mỗi lần quét mãi mãi.

## Giá trị không có dữ liệu

Một máy ghi có cặp nhiệt điện bị cháy không im lặng. Nó vẫn tiếp tục trả lời, và thứ nó đặt vào thanh ghi là một mã: 0x8005 cho "undefined", 0x7FFF cho "over range". Đọc như một int16 với scale 0,1, 0x8005 là -3276,3 độ, và cho đến khi chúng tôi sửa điều này, nó trở về với chất lượng **good**, đi vào historian như một nhiệt độ thật và nằm đó cho các cảnh báo đánh giá. Một cảm biến chết trông như một cảm biến lạnh.

Vì vậy một tag có thể liệt kê các giá trị thô có nghĩa là "không có phép đo". Mỗi giá trị có một lý do. Khi giá trị thô của một số đọc nằm trong danh sách, số đọc là **bad**, lý do nằm trên nó, và scale cùng offset không bao giờ chạm vào nó.

```json
{
  "deviceId": "dx-1", "name": "ch01", "address": "input:1:int16",
  "dataType": "float", "unit": "C", "scale": 0.1, "enabled": true,
  "noData": [
    {"raw": "0x7FFF", "reason": "+over"},
    {"raw": "0x8001", "reason": "-over"},
    {"raw": "0x8002", "reason": "skip"},
    {"raw": "0x8004", "reason": "error"},
    {"raw": "0x8005", "reason": "undefined"},
    {"raw": "0x7F7F", "reason": "power fail"},
    {"raw": "0x7FFA", "reason": "burnout up"},
    {"raw": "0x8006", "reason": "burnout down"}
  ]
}
```

Tám mã đó là mã của dòng Yokogawa DX, từ sổ tay truyền thông DX (IM 04L41B01-17E, mục 4.3, trang 4-35). Chúng không đặc thù của HotLoop: đó là cùng một trường trên mọi tag của mọi giao thức, và danh sách DX chỉ là cái làm khổ chúng tôi đầu tiên. Mỗi mã nằm trên tag, nên một kênh của máy ghi thực sự có thể đọc 0x7F7F ở một đơn vị khác giữ nó như một số đọc.

| Trường | <span class="sr-only">Chi tiết</span> |
|---|---|
| `raw` | Mã của thiết bị, viết theo cách sổ tay của nó in: `"0x8005"` (hex), `"-32763"` hoặc `32773` (thập phân). Một chuỗi hoặc một số trần. Bắt buộc |
| `reason` | Điều mà chất lượng của số đọc nói. Tối đa 120 ký tự. Nếu bỏ trống, nó đọc là `raw value 0x8005 means no measurement`, nên một số đọc không bao giờ thành bad mà không nói tại sao |

Trong trình soạn tag, đó là ô **Giá trị không có dữ liệu**: mỗi dòng một mã, mã, một khoảng trắng, lý do.

### Số nào bạn viết

Với một điểm Modbus dựa trên thanh ghi, mã là số nguyên mà thiết bị giữ, sau khi thứ tự byte và word của điểm được áp dụng. Đó chính là con số mà điểm giải mã ra, nên một sổ tay nói "thiết bị trả về 8005h" nghĩa là chính xác `"0x8005"` ở đây.

- **int16 và các kiểu có dấu khác.** `0x8005` và `-32763` là cùng một thanh ghi, và `32773` cũng vậy. Hãy viết theo cách sổ tay viết; cả ba đều khớp. Một mã không vừa kiểu (`0x10000` trên một int16) bị từ chối khi thiết bị kết nối, vì một danh sách không bao giờ khớp được còn tệ hơn một lỗi. Hai cách viết của cùng một giá trị trên một tag cũng bị từ chối.
- **uint16 và các kiểu không dấu khác.** Từ `0` đến giá trị lớn nhất của kiểu. Một số âm bị từ chối.
- **int32, uint32, int64, uint64.** Cùng quy tắc ở 32 và 64 bit. `0x7FFFFFFF` trên một int32 với thứ tự word `CDAB` là giá trị sau khi các word được đặt lại đúng chiều, không phải thứ tự chúng đến từ đường truyền.
- **float32 và float64.** Mã là mẫu bit của thanh ghi, nên nó phải là hex: `0x7FC00000` cho một quiet NaN. Một số thập phân bị từ chối, vì 32773 như một float và 32773 như một mẫu bit là hai thứ khác nhau và chúng tôi sẽ không đoán.
- **Bit, coil, discrete input và chuỗi.** Không có số thô để so sánh, nên `noData` trên chúng bị từ chối khi thiết bị kết nối.

Việc kiểm tra dựa trên các bit thô, trước giải mã, trước scale, trước offset.

### Các giao thức khác

Mọi trình điều khiển đưa ra một số đã giải mã đều kiểm tra cùng danh sách: S7comm, EtherNet/IP, OPC UA, HTTP và MQTT (gồm cả các thiết bị được phát hiện). Thứ chúng so sánh là con số đã giải mã đó, như một số nguyên, nên hãy viết nó đúng như con số của nó. Một S7 INT giữ 0x8005 là -32763, nên hãy viết `-32763`. Hex ở đây chỉ là một cách khác để viết cùng một con số, vì một số đã giải mã đã mất độ rộng và không thể đọc ngược lại thành một mẫu bit. Một giá trị có phần thập phân không bao giờ khớp. Danh sách chỉ đáng đặt ở nơi thiết bị gửi các mã như vậy; hầu hết những gì MTConnect và UniFi báo cáo không bao giờ như thế.

### Một sentinel làm gì

- **Chất lượng** là `bad` và số đọc mang lý do. Nó hiển thị trên `GET /api/values` và luồng trực tiếp (`reason`), bên cạnh chất lượng trên màn hình Tags, và trên các thực thể của tag dưới dạng thuộc tính `quality_reason`.
- **Giá trị** rỗng, không phải số không và không phải mã đã được scale. Scale và offset không được áp dụng.
- **Historian** ghi chất lượng là bad, giống mọi số đọc bad khác, và cột giá trị của nó không chứa gì có ý nghĩa. Một bucket không có số đọc tốt hiện ra như một khoảng trống trên biểu đồ xu hướng, như với mọi số đọc bad.
- **Cảnh báo.** Một số đọc bad không bao giờ kích hoạt cảnh báo giá trị: cao, thấp, bằng, tốc độ thay đổi đều giữ trạng thái trước đó, như với mọi số đọc bad. Một cảnh báo `bad-quality` trên tag thì có kích hoạt, và thông báo mặc định của nó mang lý do (`dx-1/ch01 bad-quality: undefined`). Hãy dùng `{reason}` trong thông báo của riêng bạn để đưa nó vào.
- **Logbook** ghi lại việc thực thể của tag chuyển sang bad, và lý do là thuộc tính `quality_reason` của thực thể.

### Nó nằm ở đâu

Trên tag, được lưu cùng nó. Qua API, đó là danh sách `noData` trên `POST /api/tags` (xem [API HTTP](/vi/iot/api/#post-apitags)), trong trình soạn thảo đó là ô ở trên, và trong một Edge Relay đó là cùng JSON trong tag của tệp thiết bị (xem [Tham chiếu Edge Relay](/vi/edge-relay/reference/)). Lưu tag sẽ nạp lại thiết bị đang chạy, nên một thay đổi có hiệu lực ở lần poll kế tiếp và không có gì phải khởi động lại bằng tay. Một lần phát hiện lại để yên danh sách của tag.

## Chất lượng

Mỗi số đọc mang `good`, `uncertain` hoặc `bad`.

**Bad nghĩa là giá trị không được biết. Nó không có nghĩa là số không.** Một trình điều khiển không đọc được một điểm vẫn phát ra một số đọc, đánh dấu là bad, vì im lặng không thể phân biệt với một giá trị chưa thay đổi, và trên một biểu đồ xu hướng, sự khác biệt giữa "cảm biến đọc 0" và "cảm biến ngừng trả lời" là sự khác biệt giữa một vấn đề quy trình và một vấn đề thiết bị đo.

Việc đánh giá cảnh báo giữ trạng thái trước đó trên một số đọc bad thay vì đánh giá nó. Một cảm biến hỏng về không nếu không sẽ kích hoạt mọi cảnh báo thấp trên đơn vị và trông như một sự kiện quy trình.
