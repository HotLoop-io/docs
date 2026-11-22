---
title: "Tích hợp"
description: "Trỏ HotLoop tới thiết bị bạn biết địa chỉ, xem thực tế trên đó có gì và giữ lại các điểm cần. Hỗ trợ SNMP, BACnet/IP, OPC UA, chỉ đọc."
---

Tích hợp là cách để trỏ HotLoop tới một loại thiết bị mà bạn biết địa chỉ, trả lời vài câu hỏi, xem thực tế trên đó có gì và giữ lại các điểm bạn muốn. Nó tạo ra thiết bị và các tag của thiết bị. Thực thể được tạo từ các tag như với mọi tag khác, nên các điểm mới sẽ có trong API thực thể, trong tự động hóa và trên bảng điều khiển sau một phút.

Có ba cách để một thiết bị vào HotLoop, và chúng được thiết kế để dùng song song:

| <span class="sr-only">Details</span> | Ai bắt đầu | Cần gì |
|---|---|---|
| [Phát hiện qua MQTT](/vi/iot/mqtt-discovery/) | Thiết bị, bằng cách tự thông báo trên một broker | Một publisher nói một trong các định dạng |
| [Phát hiện mạng](/vi/iot/network-discovery/) | Mạng, bằng cách được lắng nghe | Không cần gì từ thiết bị; nó cho bạn biết đã nghe thấy gì và HotLoop có thể giao tiếp với thiết bị như thế nào |
| **Tích hợp** (trang này) | Bạn, với một địa chỉ | Một thiết bị trả lời theo giao thức của chính nó |

Một tích hợp không bao giờ ghi vào thiết bị, và không có gì nó tạo ra được kích hoạt. Một điểm tìm thấy là một điểm mà chưa ai quyết định cho phép ra lệnh, nên mọi tag mà một lần thiết lập tạo ra đều chỉ đọc cho đến khi có người kích hoạt, từng cái một, trong trình soạn tag, giống như tag từ bất kỳ nguồn nào khác.

## Có những gì

| Tích hợp | Giao thức | Đã kiểm chứng với |
|---|---|---|
| Máy chủ OPC UA (`opcua`) | [OPC UA](/vi/iot/protocols/#opc-ua) | Một máy chủ OPC UA thật |
| Thiết bị SNMP (`snmp`) | [SNMP](/vi/iot/protocols/#snmp) | Một agent SNMP thật, v1, v2c và v3 |
| Thiết bị BACnet/IP (`bacnet`) | [BACnet/IP](/vi/iot/protocols/#bacnetip) | Một BACnet stack độc lập |
| PLC CODESYS (`codesys`) | [CODESYS](/vi/iot/protocols/#codesys) | CODESYS Control for Linux SL 4.22.0.0, chạy hai chương trình PLC thật, một chương trình lớn hơn nhiều |

Sẽ có thêm tích hợp trên khung này khi chúng được chứng minh với một máy chủ thật.

## Chiều ngược lại

Một tích hợp đưa thiết bị vào. Để gửi các giá trị đọc và sự kiện của HotLoop ra một broker Kafka, xem [luồng sự kiện Kafka API](/vi/iot/historian-targets/#kafka-api-luồng-sự-kiện) trong các đích của historian: Apache Kafka và Redpanda, TLS và SASL, giá trị đọc trên một topic và nhật ký hệ thống trên topic khác. Để gửi chúng dưới dạng OPC UA PubSub (UADP qua UDP), hoặc để đọc dữ liệu của một publisher, xem [OPC UA PubSub](/vi/iot/protocols/#opc-ua-pubsub-uadp): đọc một publisher là một thiết bị với giao thức `opcua-pubsub`, không có quy trình thiết lập, vì một datagram mang vị trí trường chứ không mang tên.

## SNMP

Dành cho switch, UPS, PDU, đồng hồ đo điện hoặc bất cứ thứ gì chạy agent SNMP. Các câu hỏi phụ thuộc vào phiên bản: v2c hỏi một community, v3 hỏi một người dùng và chỉ những cụm mật khẩu mà mức bảo mật của nó cần. Không có community mặc định.

Bộ thăm dò duyệt nhóm system, các bảng giao diện, tài nguyên máy chủ, bảng tải và đầu ra extend của một agent SNMP, tức các đối tượng mà HotLoop có thể đặt tên, và hiển thị từng đối tượng cùng giá trị mà agent cho biết nó đang giữ lúc này. Nó **gợi ý** những điểm mà người trỏ tới một thiết bị mới thường muốn: tên, vị trí và thời gian hoạt động của thiết bị (tính bằng giây, không phải phần trăm giây của agent), trạng thái vận hành và số lỗi của từng giao diện, các bộ đếm byte (loại 64 bit nếu agent có), các giá trị tải trung bình và mọi hàng extend. Trong phần ghi chú, nó cho biết có bao nhiêu điểm gợi ý là bộ đếm, vì bộ đếm trên biểu đồ cần một tốc độ.

Mọi thứ khác mà agent có vẫn đọc được: hãy thiết lập thủ công thành một tag có địa chỉ là OID. Xem [trình điều khiển SNMP](/vi/iot/protocols/#snmp) để biết một tag trở thành gì, một đối tượng bị thiếu sẽ ra sao và vì sao community v2c sai trông giống thiết bị đã chết.

SNMP ở đây luôn chỉ đọc. HotLoop không gửi SET.

## BACnet/IP

Dành cho bộ điều khiển tự động hóa tòa nhà, đồng hồ đo, bộ điều nhiệt: bất cứ thứ gì trên mạng IP nói BACnet. Các câu hỏi là địa chỉ của thiết bị, instance của thiết bị nếu bạn biết (và khi đó HotLoop từ chối nếu một thiết bị khác trả lời tại địa chỉ đó) và gửi từ card mạng nào nếu máy có hai card.

Bộ thăm dò hỏi thiết bị nó là gì, đọc danh sách đối tượng và đọc mọi đối tượng analog, binary và multi-state mà nó tìm thấy (cùng các giá trị integer, large analog, accumulator và character string): tên, mô tả, đơn vị, giá trị hiện tại và cờ trạng thái. Nó hiển thị từng đối tượng cùng giá trị vừa đọc và gợi ý một trăm đối tượng đầu tiên. Đơn vị đến dưới dạng nhãn và, nếu chúng chỉ một loại, kèm lớp thiết bị, nên một đầu vào `degrees-celsius` là nhiệt độ `°C`.

Trong phần ghi chú, nó cho biết có bao nhiêu đối tượng báo lỗi (chúng đọc ở trạng thái xấu cho đến khi thiết bị xóa lỗi) và bao nhiêu đối tượng đang ngừng hoạt động (chúng đọc ở trạng thái không chắc chắn, vì giá trị là giá trị đã được ghi vào). Mô tả của đối tượng multi-state liệt kê các trạng thái của nó, và mẫu của nó hiển thị trạng thái cùng với con số.

BACnet ở đây luôn chỉ đọc. HotLoop không ghi thuộc tính và không tiếp cận thiết bị phía sau một router BACnet: xem [trình điều khiển BACnet/IP](/vi/iot/protocols/#bacnetip) để biết cái gì được hỗ trợ và cái gì không.

## CODESYS

Dành cho PLC chạy runtime CODESYS Control. Các câu hỏi là những câu của OPC UA (địa chỉ, bảo mật, tên người dùng và mật khẩu nếu quản lý người dùng của PLC được bật) và, chỉ khi bạn cần, phần ứng dụng cần liệt kê, tên PLC và ứng dụng, và số phần tử của một mảng cần liệt kê.

Bộ thăm dò kết nối với máy chủ OPC UA của runtime, tìm PLC và ứng dụng của nó, rồi liệt kê các biến mà ứng dụng xuất ra (Symbol Configuration của nó) theo tên lập trình viên đã viết, cùng kiểu của chúng và việc mỗi biến có ghi được hay không. Nó gợi ý các biến của chính ứng dụng, không phải các phần tử của bộ đệm, và cho biết trong ghi chú đã liệt kê một phần bao nhiêu mảng. Với PLC không xuất gì, nó chỉ cách xuất một thứ.

Thiết bị CODESYS được đọc mỗi giây một lần, đó là tần suất trình điều khiển yêu cầu máy chủ OPC UA của runtime theo dõi từng biến, nên màn hình chỉ chậm hơn PLC khoảng một giây và không hơn. Mặc định của chính runtime là năm giây, vốn chậm đối với màn hình: bơm khởi động và trang báo năm giây sau. Hãy đổi chu kỳ thăm dò của thiết bị, hoặc `samplingIntervalMs` của nó, để yêu cầu nhiều hơn; mức sàn áp dụng cho mọi thiết bị và OperationLimits của máy chủ vẫn được áp dụng.

Thiết lập với `"dashboard": true` trong yêu cầu thì các điểm bạn giữ lại còn có thêm một bảng điều khiển mang tên thiết bị: một tiêu đề, xu hướng của các con số thay đổi, các cảnh báo của thiết bị và một thẻ giá trị cho từng điểm dưới tiêu đề của danh sách biến. Đó là màn hình đầu tiên được tạo từ chương trình đúng như hiện có, và được chỉnh sửa như mọi bảng điều khiển. Không có gì trên đó ra lệnh bất cứ điều gì, và mọi tag vẫn chỉ đọc cho đến khi được kích hoạt.

PLC có runtime khởi động lại hoặc có chương trình mới được tải xuống sẽ tự được kết nối lại: xem [trình điều khiển CODESYS](/vi/iot/protocols/#codesys).

## Quy trình

Ba lệnh gọi, theo thứ tự, và hai lệnh đầu không lưu gì.

1. **Hỏi.** `GET /api/integrations` liệt kê mọi tích hợp và các câu hỏi của chúng. Mỗi câu hỏi có một loại (`text`, `number`, `bool`, `choice` hoặc `secret`), một giá trị mặc định, bắt buộc hay không và, khi chỉ có ý nghĩa sau một câu trả lời khác, `showWhen`. Màn hình được vẽ từ đó và không gì khác, vì vậy một tích hợp mới không cần màn hình mới.
2. **Xem.** `POST /api/integrations/{id}/probe` nhận các câu trả lời, kiểm tra chúng, kết nối tới thiết bị thật bằng trình điều khiển riêng của tích hợp và báo cáo nó là gì và có gì: một tên gợi ý, những gì nó nói về chính mình, các ghi chú đáng đọc và mọi điểm tìm thấy dưới dạng bản ghi có hình dạng của tag với `sample` của giá trị đã đọc, để bạn so sánh với con số trên màn hình của chính máy.
3. **Giữ.** `POST /api/integrations/{id}/setup` nhận cùng các câu trả lời và tên của các điểm cần giữ (không nêu tên nào thì giữ những điểm được đánh dấu `suggested`), tạo thiết bị và các tag của nó rồi tải lại runtime. Thiết bị được bật và đang được thăm dò. Tích hợp có thể bố trí bảng điều khiển đầu tiên (CODESYS) sẽ làm vậy khi yêu cầu có `"dashboard": true`, và trả về id của bảng điều khiển.

Bước thiết lập xem lại thiết bị thay vì tin vào bộ thăm dò. Điều mà một client nghĩ nó đã tìm thấy một phút trước là một lời khẳng định, và các điểm được kiểm tra với thiết bị đúng như lúc thiết bị được tạo. Một tên không có trên thiết bị là lỗi `400`, không phải một điểm bị bỏ qua, vì có người đã yêu cầu nó theo tên.

Một lần thiết lập thất bại giữa chừng (thiết bị đã lưu, các tag thì chưa) sẽ xóa thiết bị vừa tạo. Thiết bị đã tồn tại bị từ chối với lỗi `400` thay vì bị ghi đè: để thêm điểm vào thiết bị bạn đã có, hãy dùng Browse và Import của nó.

## Các câu trả lời được kiểm tra trước khi thử bất cứ điều gì

Khung kiểm tra mọi câu trả lời với câu hỏi của nó trước khi tích hợp nhìn thấy, và báo cáo mọi vấn đề cùng lúc, nên một biểu mẫu chỉ phải sửa một lần:

* một câu hỏi bắt buộc bị để trống cho kết quả "X is required";
* một số phải là số nguyên nằm trong phạm vi của câu hỏi, một lựa chọn phải là một trong các lựa chọn của nó, một bool phải là bool;
* một câu trả lời cho câu hỏi mà tích hợp không hỏi sẽ bị từ chối, không bị bỏ qua, vì `pasword` viết sai mà bị loại im lặng là một thiết bị không đăng nhập được mà không có gợi ý nào về lý do;
* một secret không được là chuỗi giữ chỗ `[redacted]` mà API hiển thị thay cho giá trị đã lưu. Gửi lại nó sẽ lưu chuỗi giữ chỗ làm mật khẩu;
* một câu hỏi không hiển thị (`showWhen`) bị bỏ qua và không bắt buộc.

Thông tin xác thực được giữ như của một thiết bị: được niêm phong khi lưu trữ khi HotLoop có khóa niêm phong, và bị ẩn khỏi mọi phản hồi API và mọi lỗi. Bộ thăm dò không bao giờ lưu những gì nó được cung cấp.

## Khi thiết bị không trả lời

`502`, kèm điều đã xảy ra: "could not reach the device: ..." khi không kết nối được gì, "connected, but could not list its points: ..." khi đã kết nối rồi không trả lời. Đó là phản hồi của thiết bị cần đọc, không phải lỗi của HotLoop và không phải yêu cầu sai. Cổng đóng, community sai hay tường lửa đều kết thúc ở đây, và thông báo là của chính trình điều khiển.

## Vị trí trong sản phẩm

Bộ thăm dò và bước thiết lập vươn ra mạng từ máy HotLoop, nên cả hai đều cần `devices.write`, giống như lưu một thiết bị. Việc liệt kê cần `devices.read`. Mọi sản phẩm đều có chúng. Các route nằm trong [HTTP API](/vi/iot/api/#integrations).

## Thêm một tích hợp

* `Info()` nói nó là gì: id, tên, giao thức của trình điều khiển, cách hỏi địa chỉ và các câu hỏi;
* `Configure()` biến các câu trả lời đã kiểm tra thành địa chỉ và khối cấu hình riêng của trình điều khiển, và từ chối những gì một câu hỏi không diễn đạt được;
* `Discover()` tiếp cận thiết bị thật và báo cáo những gì có trên đó.

Khi khởi động, khung từ chối một tích hợp không thể là một mục trong danh mục: id trùng lặp, giao thức mà mô hình không khai báo, câu hỏi không có nhãn, lựa chọn không có phương án, giá trị mặc định không phải câu trả lời hợp lệ, hoặc `showWhen` nêu tên một câu hỏi không tồn tại. Một bài kiểm thử cũng buộc mọi tích hợp phải dùng giao thức có trình điều khiển được biên dịch sẵn.

Nơi không có máy chủ thật để chạy thì không có tích hợp, và [lộ trình](/vi/roadmap/) cho biết tích hợp nào đang chờ phần cứng.
