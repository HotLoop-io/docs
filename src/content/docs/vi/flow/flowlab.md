---
title: "FlowLab: bàn thử nghiệm"
description: "Chạy một tab dưới dạng sơ đồ cho bàn thử nghiệm và bộ ghi dữ liệu: nút có vòng lặp, dây lỗi, cổng nối tiếp, bảng điều khiển và trình gỡ lỗi."
---

FlowLab là phần của Flow dành cho bàn thử nghiệm và bộ ghi dữ liệu, và đơn vị của nó là sơ đồ: cách thứ hai để Flow chạy một tab. Trong một luồng, thông điệp đi qua một nút và đầu vào nào cũng đánh thức được nút đó. Trong một sơ đồ, mỗi nút chạy một lần cho mỗi lần chạy, khi mọi đầu vào có dây đều đã có giá trị. Hai nút không có dây giữa chúng chạy cùng lúc. Đó là cách xây một bàn thử nghiệm hoặc một bộ ghi dữ liệu: đọc một thiết bị, phân tích số đọc, quyết định xem nó đã ổn định chưa, hiển thị và ghi lại.

Các luồng không bị ảnh hưởng bởi bất cứ điều gì trong số này. Một tab mang `ew_diagram` nằm ngoài runtime thông điệp, và mọi tab khác chạy đúng như trước.

Điều đó có nghĩa là: bạn vẽ logic một lần, nhấn Chạy và xem các giá trị di chuyển trên dây. Ai có địa chỉ của bảng điều khiển đều có thể xem cùng lần chạy đó trên điện thoại.

## Tệp

Sơ đồ là một tab có đối tượng `ew_diagram`. Các nút của nó là những mục bình thường của tệp luồng. `wires` nêu tên nút mà dây đi tới, như mọi khi, và `ew_in` trên nút nguồn cho biết mỗi dây rơi vào đầu vào nào của đích, theo cùng dạng:

```json
{ "id": "a", "type": "dia-const", "z": "d", "value": "1", "x": 100, "y": 80,
  "ew_in": [["a"], []], "wires": [["sum"], []] }
```

Tệp được nạp và lưu từng byte một với các khóa này bên trong. Các thiết lập của tab:

| Khóa | Tác dụng |
|---|---|
| `autostart` | `true` bắt đầu lần chạy khi Flow khởi động và sau mỗi lần triển khai, không cần mở trình duyệt. |
| `role` | `"body"` cho sơ đồ mà một vòng lặp chạy. Thân không tự chạy một mình. |

Mỗi nút còn có một đầu vào tùy chọn `after` và một đầu ra `done`. Nối `done` của một nút với `after` của nút khác thì nút thứ hai chờ nút thứ nhất, không có gì xen giữa. Thứ tự là một dây mà bạn thấy được và so sánh được bằng diff.

## Chạy

Một sơ đồ chạy từ những gì đã triển khai. Trong trình soạn thảo, mở một tab sơ đồ và nhấn Chạy. Thanh phía trên canvas có:

- **Làm nổi bật quá trình chạy**: mỗi nút chờ một chút trước khi chạy để bạn theo dõi được, và dây mà một giá trị vừa đi qua sáng lên. Tính năng tự tắt sau mười phút.
- **Tạm dừng, Tiếp tục, Bước vào, Bước qua, Bước ra**: chạy từng bước đi qua từng nút một. Bước qua chạy trọn thân của một vòng lặp. Bước vào dừng ở nút đầu tiên trong đó.
- **Ngắt tại vùng chọn**: một điểm dừng trên nút đang chọn. Nhấn đúp một dây để đặt đầu dò, giữ lại 100 giá trị gần nhất của dây, hoặc để dừng khi có giá trị được đưa lên dây. Đầu dò không bao giờ thay đổi một lần chạy.
- **Mở bảng điều khiển**: trang của người vận hành.

Rê chuột lên bất kỳ dây nào sau một lần chạy để xem giá trị cuối cùng nó đã mang. Nút vấn đề liệt kê mọi lý do khiến một sơ đồ không chạy được, mỗi lý do kèm nút và đầu vào.

| Lệnh gọi | Chức năng |
|---|---|
| `GET /diagrams`, `GET /diagrams/{id}` | Những gì đã triển khai, bảng điều khiển và giá trị cuối cùng trên mỗi dây. |
| `GET /diagrams/{id}/trace` | Những gì lần chạy gần nhất đã làm, theo thứ tự: mọi nút đã bắt đầu hoặc kết thúc và mọi giá trị đã đi qua một dây, kèm số mili giây tính từ đầu lần chạy. Một sơ đồ chưa chạy kể từ khi triển khai sẽ trả lời 404. |
| `POST /diagrams/{id}/run`, `/stop`, `/debug` | Cần `diagram.run`. Mỗi lệnh đều có trong nhật ký kiểm toán kèm người thực hiện. |
| `POST /diagrams/{id}/sub` | Gửi `{flows, nodes, name}` và nhận lại tệp luồng với các nút đó đã được biến thành một sơ đồ con. Chỉ đọc và tính toán; không có gì được lưu hay triển khai. |
| `PUT /diagrams/{id}/controls/{node}` | Đặt một điều khiển. Được kiểm tra theo loại, phạm vi và các lựa chọn của nó. |
| `PUT /diagrams/{id}/breakpoints`, `/probes` | Khóa là id của một nút, `wire:<wire key>` hoặc `diagram:<tab>`. |

Các sự kiện của một lần chạy đi ra trên cùng socket với trình soạn thảo, dưới dạng `diagram/<id>/node`, `token`, `run`, `paused` và `values`.

## Các nút

| Nút | Tác dụng |
|---|---|
| `dia-const`, `dia-math`, `dia-compare`, `dia-logic` | Giá trị và số học. Phép toán chạy từng phần tử trên mảng. |
| `dia-wait` | Chờ, rồi chuyển tiếp đầu vào của nó. |
| `dia-bundle`, `dia-field`, `dia-array` | Bản ghi và mảng. |
| `dia-while`, `dia-for` | Vòng lặp. Thân là một sơ đồ riêng, được gọi theo tab của nó. Các giá trị mang theo bắt đầu từ một dây hoặc từ Start values và ra đúng như ở lượt cuối. Vòng lặp for nhận một số lần hoặc một mảng. Vòng lặp while chạy ít nhất một lần. |
| `dia-case` | Cấu trúc trường hợp. Giá trị trên `selector` chọn một thân để chạy, và chỉ thân đó chạy. Giá trị boolean chọn `true` hoặc `false`, một số chọn trường hợp của giá trị đó dù viết thế nào, còn một chuỗi hoặc một enum chọn trường hợp mang tên đó. Các trường hợp là một đối tượng JSON từ tên trường hợp sang sơ đồ, và giá trị không trường hợp nào nêu tên sẽ chạy trường hợp mặc định. Nếu không có mặc định, nút đưa một lỗi lên dây lỗi của nó, và việc triển khai cảnh báo là không có mặc định (boolean có đủ hai trường hợp thì được miễn). Mỗi thân phải gửi ra từng kết quả dưới cùng một tên, và thân nào không làm vậy là một vấn đề khi triển khai. Đầu ra `case` cho biết trường hợp nào đã chạy. |
| `dia-body-in`, `dia-body-out` | Hai đầu của một thân. `iter` là số của lượt. `stop` kết thúc một vòng lặp while. Tên của một giá trị mang theo gửi nó sang lượt kế tiếp. |
| `dia-serial-open`, `dia-serial-read`, `dia-serial-write` | Một cổng nối tiếp. Việc đọc kết thúc ở một ký tự kết thúc hoặc một số byte. |
| `dia-instr-open`, `dia-instr-query`, `dia-scpi-parse` | Một thiết bị đo thử nghiệm, theo địa chỉ. Xem Thiết bị đo bên dưới. |
| `dia-parse-reading`, `dia-stable` | Lấy một số và một đơn vị ra khỏi một dòng, và cho biết vài số đọc gần nhất có khớp nhau không. |
| `dia-log-text` | Thêm một bản ghi thành một dòng của tệp văn bản, kèm cột thời gian. |
| `dia-daq-read` | Đọc mẫu từ một tác vụ thu thập dữ liệu trên phần cứng NI, qua gRPC Device Server của NI. Xem Thu thập dữ liệu bên dưới. |
| `dia-mqtt-out` | Phát hành giá trị của nó qua một máy chủ MQTT mà tệp luồng cấu hình, cùng kết nối mà các nút MQTT dùng. Đánh dấu là durable thì thông điệp mà broker bỏ lỡ sẽ được ghi ra đĩa và gửi đi, theo thứ tự, khi broker trở lại, kể cả qua một lần khởi động lại. |
| `dia-postgres-out` | Ghi một bản ghi thành một hàng của bảng trong PostgreSQL hoặc TimescaleDB, qua máy chủ mà tệp luồng cấu hình, cùng kết nối mà nút postgres dùng. Đánh dấu là durable thì hàng mà cơ sở dữ liệu bỏ lỡ được giữ trên đĩa và ghi lại, theo thứ tự, khi nó trở lại. Xem Cơ sở dữ liệu bị gián đoạn bên dưới. |
| `dia-log-tdms` | Thêm một bản ghi vào tệp TDMS, mỗi trường một kênh. Xem bên dưới. |
| `dia-control`, `dia-indicator`, `dia-chart` | Bảng điều khiển. |
| `dia-stats` | Trung bình, RMS, nhỏ nhất, lớn nhất và độ lệch chuẩn của một mảng. Độ lệch chuẩn chia cho n trừ một, nên cần hai số đọc. |
| `dia-integral` | Diện tích dưới một mảng theo quy tắc hình thang, dưới dạng một số hoặc diện tích lũy kế ở mỗi mẫu. |
| `dia-derivative` | Độ dốc tại mỗi mẫu của một mảng. |
| `dia-filter` | Bộ lọc Butterworth thông thấp, thông cao, thông dải hoặc chặn dải bậc 1 đến 10 với tần số cắt tính bằng hertz. |

### Bộ lọc

Nút lọc là một bộ lọc Butterworth: phẳng ở dải thông, không gợn sóng, và thấp hơn 3 dB tại tần số cắt. Nó được thiết kế từ bộ lọc tương tự bằng phép biến đổi song tuyến tính với tần số cắt được hiệu chỉnh trước, để điểm 3 dB rơi đúng vào tần số bạn nhập, và chạy như một chuỗi các đoạn bậc hai để bậc cao vẫn chính xác. Bộ lọc thông dải hoặc chặn dải bậc n có 2n cực. Tần số cắt phải lớn hơn không và nhỏ hơn một nửa tần số lấy mẫu, và một thiết kế không dựng được sẽ được liệt kê trong phần vấn đề trước khi chạy. Tần số lấy mẫu là một thuộc tính, hoặc một đầu vào được ưu tiên hơn nó. Bộ lọc giữ bộ nhớ của nó từ lần gọi này sang lần gọi khác trong một lần chạy, nên một mảng bị vòng lặp cắt thành từng mảnh vẫn ra như thể được lọc nguyên khối, và mỗi lần chạy mới bắt đầu từ trạng thái nghỉ.

Những gì nó không làm được: nó không phải bộ lọc pha tuyến tính, nên làm trễ các tần số khác nhau những lượng khác nhau, và không có chế độ pha không để lọc xuôi rồi ngược. Ở nơi thời điểm giữa hai tín hiệu phải khớp nhau, hoặc hình dạng của một dạng sóng phải được giữ, đây là bộ lọc sai. Tích phân và đạo hàm lấy thời gian giữa các mẫu từ đầu vào `dt` tính bằng giây, đầu vào `rate` tính bằng hertz, hoặc thuộc tính Samples per second.

### Ghi nhật ký vào TDMS

`dia-log-tdms` ghi các phép đo mà một bàn thử nghiệm thực hiện vào một tệp TDMS, định dạng mà các công cụ thu thập và phân tích dữ liệu mở được. Nối một bản ghi vào `row`. Mỗi trường của bản ghi là một kênh trong một nhóm, nên một bản ghi có `pressure`, `ok` và `operator` tạo ra ba kênh. Một số được lưu thành float 64 bit, đúng hoặc sai thành bool, và mọi thứ khác thành văn bản. Một trường chứa danh sách số sẽ thêm cả danh sách, đó là cách một khối mẫu đi vào. Các thiết lập:

| Cài đặt | Ý nghĩa |
|---|---|
| `path` | Tệp. Tệp đã có sẵn thì được ghi nối thêm, nên hết lần chạy này đến lần chạy khác tạo thành một tệp. |
| `group` | Nhóm mà các kênh được đưa vào. |
| `columns` | Các trường cần ghi, theo thứ tự. Để trống thì ghi mọi trường, theo tên. |
| `properties` | Một đối tượng JSON gồm các thuộc tính cho tệp, chẳng hạn `{"title": "bench 4", "station": 4}`, được ghi khi lần chạy bắt đầu. |
| `sync` | Mặc định bật: mỗi hàng tới được đĩa trước khi nút kết thúc. |

Mỗi hàng là một đoạn, được ghi trong một lần. Nếu mất điện giữa chừng một hàng, tệp cho thấy nó bị cắt ở đâu, trình đọc trả về mọi hàng trước đó, và lần chạy kế tiếp sửa phần cuối tệp rồi đi tiếp. Kiểu của một trường được hàng đầu tiên của một lần chạy quyết định. Một hàng sau đó không khớp, chẳng hạn văn bản trong cột số, đi vào dây lỗi như một đầu vào xấu và tệp được để yên. Một số bị thiếu được ghi là not-a-number.

Để mở tệp, dùng bất kỳ trình đọc TDMS nào. Các thuộc tính kênh như `unit_string` và các thuộc tính dạng sóng `wf_start_time`, `wf_increment` và `wf_samples` được thư viện hỗ trợ; nút chưa đặt chúng.

Những gì trình đọc chấp nhận: đoạn little endian và big endian, dữ liệu xen kẽ và liên tục, siêu dữ liệu được bỏ khỏi một đoạn khi không đổi, danh sách đối tượng mới, số nguyên 8, 16, 32 và 64 bit, float 32 và 64 bit, bool, văn bản và dấu thời gian. Những gì nó từ chối, nêu rõ tên và không đọc tệp dở dang: dữ liệu thô do trình điều khiển thu thập dữ liệu ghi, dữ liệu đã chia tỷ lệ hoặc nén, float độ chính xác mở rộng, số dấu phẩy cố định và số phức. Những gì trình ghi ghi ra: little endian, dữ liệu liên tục và chính các kiểu đó. Nó không ghi big endian.

### Dây lỗi

Các nút giao tiếp với bên ngoài có `err` vào và `err` ra. Một lỗi là một bản ghi: một cờ, một mã số, văn bản nguồn và nút phát sinh ra nó. Một nút có lỗi đi vào thì không làm việc gì và chuyển lỗi đi tiếp, nên một sự cố ở đầu chuỗi bỏ qua mọi thứ phía sau và chỉ hiện một lần ở cuối. Nối một lỗi vào đầu ra thân `err` của một vòng lặp thì vòng lặp dừng tại đó, với lỗi nằm ở đầu ra lỗi của vòng lặp. Chỉ báo lỗi trên bảng điều khiển chuyển đỏ khi có sự cố và tắt khi giá trị kế tiếp đến mà không có lỗi.

### Một đích đến bị gián đoạn

Một `dia-mqtt-out` durable gửi thẳng tới broker khi broker còn trả lời. Khi nó không trả lời, thông điệp được ghi vào kho durable của Flow trước khi nút kết thúc, và một bơm giao hàng đợi, cũ nhất trước, khi liên kết trở lại. Bất cứ thứ gì được đưa vào lúc những thứ khác đang chờ sẽ đứng sau chúng, nên không gì vượt mặt gì. Việc giao từ hàng đợi là ít nhất một lần: một thông điệp mà lần gửi bị hết thời gian vì máy khách chưa nhận ra liên kết đã mất vẫn có thể được giao khi máy khách kết nối lại, nên nó có thể đến hai lần, mỗi lần cho một lần gửi bị hết thời gian. Hàng đợi nằm trong cùng kho và cùng hạn mức đĩa với một dây durable, và nó được rút cạn sau khi khởi động lại mà không cần lần chạy nào và không cần trình duyệt. Không có durable, thông điệp mà broker bỏ lỡ là một lỗi trên dây lỗi.

### Cơ sở dữ liệu bị gián đoạn

`dia-postgres-out` ghi mỗi bản ghi nhận được thành một hàng, vào bảng bạn nêu tên, qua một máy chủ `hotloop-flow-postgres`. Các trường của bản ghi đi vào các cột cùng tên, nên một bản ghi có `n` và `sensor` điền vào các cột `n` và `sensor`. Liệt kê các cột, cách nhau bằng dấu phẩy, để chỉ ghi một số cột hoặc cố định thứ tự; để trống danh sách thì nút dùng các trường của bản ghi. Nút chạy một lần cho mỗi lượt của vòng lặp, nên một vòng lặp ghi một hàng mỗi lượt. Một bảng hoặc cột không phải tên thường là một vấn đề khi triển khai, không bao giờ là một câu lệnh giữa lúc đang chạy. Một số nguyên vào được cột integer, float hay numeric như nhau, còn một bản ghi hoặc một mảng vào nguyên trạng, đúng thứ mà cột json hoặc jsonb nhận.

Đặt tên cho một **cột thời gian** và mỗi hàng nhận thời điểm nó đến nút. Đó là thời điểm số đọc được tạo ra, không phải thời điểm nó được ghi: một hàng đã chờ năm phút trên đĩa vẫn mang phút mà nó được tạo ra.

Không có **Giữ lại những gì cơ sở dữ liệu bỏ lỡ**, một hàng mà cơ sở dữ liệu không nhận là một lỗi trên dây lỗi của nút và bị mất. Khi bật, hàng đi thẳng vào chừng nào cơ sở dữ liệu còn trả lời. Khi cơ sở dữ liệu không trả lời, hàng được ghi vào kho durable của Flow trước khi nút kết thúc, và đầu ra `sent` của nút cho biết `false`. Các hàng chờ trên đĩa, sống sót qua một lần khởi động lại và được ghi theo thứ tự khi cơ sở dữ liệu trở lại, không có gì đi vào sau đó vượt mặt chúng. Một đống tồn được ghi nhiều hàng mỗi câu lệnh, tối đa 256, nên đống tồn tích lại lúc cơ sở dữ liệu vắng mặt được bắt kịp trong vài giây chứ không phải với tốc độ một vòng đi về cho mỗi hàng. Bài kiểm tra để 30.000 hàng chờ trên đĩa, lượng của năm phút ở 100 hàng mỗi giây, và tất cả được ghi theo thứ tự trong vài giây sau khi cơ sở dữ liệu trở lại.

Việc giao từ đĩa là ít nhất một lần. Một hàng có insert đã được gửi khi liên kết chết có thể đã được commit nhưng mất câu trả lời, và nó được gửi lại, nên có thể bị ghi hai lần, nhiều nhất một lô. Nếu điều đó quan trọng, hãy cho bảng một khóa duy nhất và chọn **Bỏ qua hàng** ở Khi xung đột: hàng thứ hai khi đó bị cơ sở dữ liệu bỏ đi.

Một hàng bị cơ sở dữ liệu từ chối vì nội dung của nó, chẳng hạn một giá trị quá lớn cho cột hoặc một khóa đã có trong khi Khi xung đột để ở Báo lỗi, sẽ bị từ chối mãi. Nó được bỏ đi kèm một sự kiện kiểm toán, `diagram.row_rejected`, mang theo hàng đó, và các hàng phía sau được ghi. Nếu không, một hàng xấu sẽ làm dừng nhật ký. Cơ sở dữ liệu đang ngừng, bảng chưa tồn tại và mật khẩu sai không thuộc trường hợp này: những hàng đó chờ.

### Thiết bị đo

`dia-instr-open` nhận một địa chỉ: `10.0.0.5:5025` cho thiết bị đo mạng LAN trên socket thô, `serial:///dev/ttyUSB0?baud=19200&data=8&parity=E&stop=1` cho thiết bị nối tiếp, hoặc chỉ `/dev/ttyUSB0` hay `COM3` cho 9600 8N1. Lần chạy đóng phiên khi kết thúc. Nếu liên kết rớt, truy vấn kế tiếp mở lại và lần rớt được đếm trên phiên.

`dia-instr-query` ghi một lệnh và ký tự kết thúc, rồi đọc câu trả lời. Chọn text (một dòng, ra từ `reply`), none (một lần ghi thuần túy) hoặc block, đọc một khối nhị phân `#41024...` và đưa các mẫu ra từ `samples` thành một mảng, dạng int8, uint8, int16, uint16, int32, float32 hoặc float64, big hay little endian. Một khối không xác định độ dài `#0` kết thúc ở cuối dòng đầu tiên. Một câu trả lời không đến kịp là một lần hết thời gian trên dây lỗi, nêu địa chỉ.

`dia-scpi-parse` đọc một câu trả lời dạng văn bản thành danh sách số, một số, một danh tính (`*IDN?` thành nhà sản xuất, mẫu, số sê-ri và firmware), hoặc một byte trạng thái (`*STB?` hay `*ESR?`) thành tên của các bit đang bật.

### Nối tiếp

Một cổng biến mất, chẳng hạn do rút cáp hoặc rút bộ chuyển đổi, là một sự cố trên dây lỗi của lần đọc. Lần đọc kế tiếp thử mở lại, mỗi giây một lần, và đếm lần mất và lần trở lại. Một cổng có điều khiển luồng, không có, phần cứng (RTS và CTS) hoặc phần mềm (XON và XOFF), trên Linux, được đặt ngay trên thiết bị đầu cuối; một thiết bị đầu cuối giả cho thấy thiết lập đã tới nơi, còn các đường tín hiệu làm gì trên một bộ chuyển đổi thật thì chưa được chứng minh.

### Thu thập dữ liệu

`dia-daq-read` đọc một tác vụ từ phần cứng NI, chẳng hạn khung CompactDAQ, qua gRPC Device Server mở của chính NI. Flow nói chuyện với máy chủ đó qua mạng, nên phần cứng có thể ở một máy khác với Flow, và Flow không cần trình điều khiển NI hay thư viện nhà cung cấp riêng. Nó vẫn là một tệp nhị phân tĩnh duy nhất.

**Trên máy mà phần cứng được gắn vào**, cài trình điều khiển DAQmx của NI và gRPC Device Server của NI (https://github.com/ni/grpc-device, giấy phép MIT). Máy chủ chỉ lắng nghe trên máy đó (`localhost`, cổng 31763) cho tới khi tệp cấu hình của nó nói khác. Để truy cập nó từ Flow trên một máy khác, đặt `address` trong `server_config.json` của nó thành `[::]` hoặc giao diện bạn muốn, và bật TLS bằng cách đặt `server_cert`, `server_key` và, với TLS hai chiều, `root_cert`, với các tệp trong thư mục `certs` cạnh tệp cấu hình. README của NI có chi tiết cho phiên bản bạn đang chạy. Đừng để cổng mặc định không được bảo vệ của máy chủ mở trên mạng nhà máy: ai tới được nó cũng điều khiển được phần cứng.

**Trong nút**, đặt:

* `address` thành `host:port` của máy chủ.
* `tls` thành `off` (chỉ cho máy chủ trên cùng máy), `on` (Flow kiểm tra chứng chỉ của máy chủ với `caFile`, hoặc với các tổ chức của hệ thống nếu để trống) hoặc `mutual` (Flow cũng xuất trình `certFile` và `keyFile`, mà máy chủ kiểm tra với `root_cert` của nó). `serverName` là tên cần tìm trong chứng chỉ của máy chủ khi nó không phải máy chủ trong `address`.
* `device` và `channels` để gọi tên phần cứng, chẳng hạn `cDAQ1Mod1` và `ai0:3`, hoặc một danh sách như `ai0, ai2`. `kind` là `voltage`, `current` hoặc `thermocouple`, với `min` và `max` cho dải bạn mong đợi và `terminal` cho cách đấu dây. Cặp nhiệt điện nhận `tcType` và `unit` và dùng bù điểm lạnh của chính mô-đun.
* `mode`, `rate` và `samples`. Chế độ hữu hạn thực hiện một lần thu `samples` mẫu mỗi kênh ở `rate` trong mỗi lần gọi, bắt đầu lại mỗi lần. Chế độ liên tục bắt đầu tác vụ ở lần gọi đầu và mỗi lần gọi đọc `samples` mẫu tiếp theo, nên một nút trong thân vòng lặp đọc một luồng theo từng khối. `trigger` bắt đầu tác vụ ở một cạnh số tại một đầu cuối như `/cDAQ1/PFI0`.

`y` là các mẫu dưới dạng mảng cho một kênh, hoặc mảng của các mảng, mỗi kênh một mảng theo thứ tự bạn đã nêu. `dt` là số giây giữa các mẫu, một chia cho tần số, nên độ dài của một khối tính bằng giây là số mẫu nhân với `dt`: 1.000 mẫu ở 1.000 mẫu mỗi giây bao phủ 1,000 s. Đồng hồ của chính thiết bị đóng dấu thời gian cho các mẫu, như mọi khi. Flow chỉ di chuyển dữ liệu. Một từ chối từ máy chủ hoặc trình điều khiển ra trên `err` với mã và văn bản của chính trình điều khiển, và máy chủ không trả lời trong `callTimeoutSec` là một lần hết thời gian. Tác vụ sống trong suốt lần chạy và được xóa trên máy chủ khi lần chạy kết thúc, nên phần cứng lại rảnh.

Những gì đã làm: đầu vào điện áp tương tự, đầu vào dòng điện tương tự và nhiệt độ cặp nhiệt điện, hữu hạn hoặc liên tục, với xung nhịp lấy mẫu và một trigger bắt đầu số tùy chọn. Những gì chưa: đầu vào và đầu ra số cùng bộ đếm dùng các lệnh đọc khác và chưa được xây dựng, ghi, các loại trigger khác và chia tỷ lệ vượt quá những gì mô-đun làm cũng vậy.

Nút đã được chạy với một máy chủ thay thế nói cùng các lệnh gọi và trả lời bằng một sóng sin, và trên phần cứng thật (2026-11-17).

## Bảng điều khiển

`/panel/<diagram id>` trên một runtime mở một trang gồm các điều khiển, chỉ báo và biểu đồ của sơ đồ, đăng nhập theo cùng cách với trình soạn thảo. Nó được làm để dùng bằng ngón cái: không có gì trên đó nhỏ hơn một ngón tay. Một biểu đồ giữ 1.024 điểm gần nhất trừ khi bạn thay đổi, và cho biết nó đã bỏ bao nhiêu. Một đồ thị thay dữ liệu của nó bằng mỗi mảng. Một biểu đồ XY vẽ x theo y và cũng giữ lịch sử. Một biểu đồ cường độ nhận một lưới, một mảng các hàng số đều cùng độ dài (tới 512 nhân 512), và vẽ mỗi giá trị thành một màu từ nhỏ nhất đến lớn nhất trong đó, thay bức tranh bằng mỗi lưới; một mảng phẳng hoặc một lưới không đều là một lỗi trên dây lỗi của nút.

Nhiều người có thể xem một lần chạy. Đặt một điều khiển từ trình duyệt cần `diagram.run`, được kiểm tra trên máy chủ và được ghi vào nhật ký kiểm toán.

## Điều khiển

Một `dia-control` có một **loại** (nó chứa gì) và một **kiểu hiển thị** (bảng điều khiển vẽ nó thế nào). Máy chủ kiểm tra mọi giá trị theo loại, bất kể kiểu hiển thị, nên một tập lệnh gọi `PUT /diagrams/{id}/controls/{node}` bị ràng buộc bởi cùng quy tắc như một ngón tay. Những gì người vận hành đặt hiện trên bảng điều khiển ngay khi sơ đồ được triển khai, trước lần chạy đầu tiên, và nút điều khiển đưa giá trị đó cho sơ đồ mỗi lần nó chạy.

| Loại | Kiểu hiển thị | Sơ đồ đọc gì |
|---|---|---|
| `number` | `entry` (gõ vào), `spin` (gõ vào, với nút trừ và nút cộng bước theo `step` và dừng ở giới hạn của dải), `slider`, `knob` | một số, giới hạn trong `min` và `max` khi chúng được đặt |
| `bool` | `switch`, `button` (nhấn thì đặt thành true, và `latch` đặt lại khi sơ đồ đọc), `led` (một đèn LED có thể nhấn) | đúng hoặc sai |
| `string` | một ô văn bản | văn bản |
| `enum` | một danh sách thả xuống của `options` | một trong các tùy chọn |
| `array` | một danh sách mà người vận hành thêm và bớt mục | một danh sách số, công tắc hoặc văn bản, theo `elem`; `min` và `max` giới hạn từng số, và `maxlen` giới hạn độ dài |
| `record` | một đầu vào cho mỗi trường | một đối tượng có đúng các `fields` (`rate:number, on:bool, note:string`), mọi trường luôn có mặt |

Slider và knob cần một giá trị nhỏ nhất và một giá trị lớn nhất. Một knob thiếu một trong hai là một cảnh báo khi triển khai và được vẽ như một ô nhập cho tới khi có đủ (slider đã làm vậy rồi). Knob là một núm xoay quét 270 độ: kéo quanh nó bằng chuột hoặc ngón tay, nhấn vào nó để đặt tại đó, hoặc dùng phím mũi tên (một `step`), Page Up và Page Down (mười bước), Home và End. Nó ghi khi bạn thả ra. Giá trị ban đầu của một mảng là JSON (`[1, 2, 3]`) hoặc danh sách thường cách nhau bằng dấu phẩy (`1, 2, 3`), và giá trị ban đầu của một bản ghi là một đối tượng JSON (`{"rate": 3}`); một trường bị bỏ sẽ bắt đầu trống. Một bản ghi không có trường nào, một tên trường không biết hoặc một giá trị ban đầu không khớp là một vấn đề khi triển khai.

Mọi nút bấm, ô nhập, công tắc và núm xoay trên bảng điều khiển đều lớn ít nhất 44 pixel theo cả hai chiều, và trang không cuộn ngang trên điện thoại rộng 390 pixel.

Một điều khiển được ghi khi nó thay đổi, và sơ đồ đọc nó khi nút điều khiển chạy; không có điều khiển nào tự bắt đầu một lần chạy hoặc kích hoạt một nút khi nó thay đổi. Đó là cấu trúc sự kiện, và nó chưa được xây dựng.

## Đây không phải là gì

Một sơ đồ chạy trong một tiến trình Go trên hệ điều hành đa dụng. Việc thu gom rác và bộ lập lịch có thể làm một nút trễ vài mili giây, nên một nút không thể hứa một hạn chót. Công việc phải đáp ứng hạn chót thuộc về một PLC hoặc một runtime được xây dựng cho việc đó. Thời điểm của các mẫu từ một thiết bị thu thập dữ liệu không bị ảnh hưởng bởi bất cứ điều gì trong số này: đồng hồ của chính thiết bị lo việc đó, và Flow chỉ di chuyển dữ liệu.

## Kiểm thử một sơ đồ

Một tệp kiểm thử luồng có thể chứa một bài kiểm thử sơ đồ bên cạnh các bài kiểm thử thông điệp. Nó đặt các điều khiển của sơ đồ, chạy sơ đồ một lần với công cụ sơ đồ thật và cho biết các chỉ báo của nó chứa gì:

```yaml
tests:
  - name: weighs and flags a heavy load
    diagram:
      name: Scale logger          # the diagram's name or id
      controls: {Limit: 10}       # by label or id, checked like an operator's entry
      expect:
        Weight: 12.5              # a number matches to within a millionth
        Heavy: true
        Reading: {min: 12, max: 13}
```

Một điều khiển mà sơ đồ không có, một giá trị nó từ chối, một chỉ báo không phải chỉ báo, một cái tên hai thứ cùng dùng và một sơ đồ không chạy được đều là lỗi kèm lý do. Một sơ đồ có nút sẽ vươn ra ngoài bài kiểm thử (cổng nối tiếp, thiết bị đo, thiết bị thu thập dữ liệu, MQTT out, một lần ghi vào HotLoop, một tệp nhật ký) bị từ chối, vì một bài kiểm thử sơ đồ không có vật thay thế cho chúng. Một thiết bị nối tiếp được kịch bản hóa, để kiểm thử việc rút cáp hay một chuỗi khung rác, chưa được xây dựng.

## Danh sách lỗi trong CI/CD

`hotloop-flow test` và cổng triển khai chạy phép kiểm tra của trình soạn thảo trên mọi sơ đồ trong tệp luồng. Một sơ đồ không chạy được được liệt kê dưới dạng `--- DIAGRAM: <diagram>: <node> input <port>: <reason>` và làm tệp thất bại ngay cả khi mọi bài kiểm thử đều qua; báo cáo JUnit mang từng cái như một lỗi kiểu `diagram`. Một cảnh báo, chẳng hạn cấu trúc trường hợp không có mặc định, được liệt kê và không làm thất bại.

## Dạng sóng

Dạng sóng là một khối các mẫu cách đều nhau, biết nó bắt đầu khi nào và các mẫu cách nhau bao xa, dưới dạng một bản ghi trên dây: `{"type": "waveform", "t0": "2026-11-14T12:00:00Z", "dt": 0.001, "y": [...], "attrs": {"unit_string": "V"}}`. `dia-wave` dựng một dạng sóng từ một mảng (bước từ `dt`, nếu không thì `rate`, nếu không thì thiết lập của nó; điểm bắt đầu từ `t0`, nếu không thì thời điểm nó chạy) và `dia-wave-parts` tháo một dạng sóng ra, gồm cả khoảng thời gian nó trải dài. Một dạng sóng chứa tối đa `maxSamples` mẫu (mặc định 1.048.576); phần còn lại bị cắt và được đếm trong `dropped`. Các nút phân tích chấp nhận một dạng sóng ở nơi chúng nhận một mảng và dùng bước của nó. `dia-log-tdms` ghi một cột dạng sóng thành một kênh với `wf_start_time`, `wf_increment`, `wf_samples` và các thuộc tính thành thuộc tính kênh.

## Sơ đồ con

`dia-sub` là một sơ đồ được dùng như một nút: các đầu vào và đầu ra của nó là đầu nối, mỗi đầu vào là một `dia-body-in` cùng tên trong thân của nó và mỗi đầu ra là một `dia-body-out`. Một đầu vào là bắt buộc trừ khi tên của nó kết thúc bằng `?` (tùy chọn) hoặc `~` (khuyến nghị: nó chạy được khi thiếu và việc triển khai cảnh báo khi nó chưa được nối). Chọn các nút và tạo một sơ đồ con từ chúng (`POST /diagrams/{id}/sub`) thì các nút chuyển sang một tab thân mới, một `dia-sub` thế chỗ chúng, và đầu nối được suy ra từ các dây cắt qua rìa vùng chọn: một đầu vào cho mỗi đầu ra nguồn cấp cho vùng chọn, một đầu ra cho mỗi đầu ra đã chọn cấp cho các nút bên ngoài. Các dây bên ngoài được nối lại, nên một lần chạy cho ra các câu trả lời như trước.

## Kiểu bản ghi dùng chung

Một kiểu bản ghi được nêu tên một lần, trong thiết lập của một tab sơ đồ, dưới `types`, và mỗi `dia-bundle` hoặc `dia-field` đặt `shape` bằng tên của nó được kiểm tra theo định nghĩa duy nhất đó:

```json
{"types": {"Reading": {"fields": {"pressure": "number", "ok": "boolean", "state": {"enum": ["idle", "run"]}}}}}
```

Một trường là `number`, `integer`, `boolean`, `string`, `timestamp`, `array`, `waveform`, `record:Name` (một kiểu dùng chung khác) hoặc một enum. Đổi tên một trường trong định nghĩa thì mọi bundle còn dùng tên cũ là một vấn đề ở lần triển khai kế tiếp, trong cùng danh sách lỗi với một đầu vào chưa nối, kèm nút và trường. Một bundle giữ mỗi giá trị theo loại của trường khi chạy, và dây lỗi mang giá trị không khớp. `Set.Schema` cho ra cùng kiểu đó dưới dạng JSON Schema, thứ mà các dây có kiểu kiểm tra.

## Xoay vòng và lưu giữ

`dia-log-text` và `dia-log-tdms` có thể bắt đầu một tệp mới khi tệp đang dùng đạt `rotateMB` megabyte hoặc `rotateHours` giờ, và chỉ giữ `keep` tệp đã hoàn tất mới nhất. Tệp đã hoàn tất lấy tên của nhật ký kèm thời điểm đóng trước phần mở rộng (`bench.csv` thành `bench-20261114T120000Z.csv`) và nhật ký tiếp tục trong `bench.csv`, với tiêu đề mới, hoặc với các thuộc tính tệp được ghi lại đối với TDMS. Việc lưu giữ chỉ xóa các tệp khớp mẫu đó, không bao giờ xóa nhật ký đang dùng và không bao giờ xóa một tệp chỉ nằm cạnh nó. Tuổi được tính từ lần đầu một lần chạy ghi vào tệp. Nhật ký văn bản mở được trong bảng tính và nhật ký TDMS là định dạng nhị phân cho dữ liệu lớn.

## Chỉnh một cấu trúc trường hợp và chọn một sơ đồ

Các trường hợp của một cấu trúc trường hợp là các hàng gồm tên trường hợp và một bộ chọn sơ đồ, với bộ chọn thứ hai cho trường hợp mặc định, và thuộc tính nêu tên sơ đồ mà một vòng lặp hoặc sơ đồ con chạy cũng là một bộ chọn. Các bộ chọn liệt kê các sơ đồ FlowLab của tệp luồng và lưu id của tab; một tên viết tay trong tệp luồng cũ được hiển thị như tab đó và lưu thành id của nó, mà runtime đọc theo cùng cách. Các giá trị được lưu là cùng JSON như trước (`cases` là một đối tượng từ tên trường hợp sang sơ đồ), nên một tệp luồng chỉnh trong hộp thoại và một tệp chỉnh bằng tay là cùng một tệp.

## Mở một sơ đồ con ngay tại chỗ

Một nút sơ đồ con có một ô nhỏ ở góc trên bên phải. Nhấn vào nó, hoặc chọn nút rồi nhấn **Mở tại chỗ** trên thanh sơ đồ, và nút được vẽ mở ngay chỗ cũ: một khung có tên sơ đồ con, đầu nối của nó được ghi tên ở hai cạnh (đầu vào bên trái, đầu ra bên phải, với các cổng `after` và `done` và dây lỗi như mọi nút), và bên trong là các nút và dây của thân. Không có gì mở ra trong cửa sổ thứ hai và tab bạn đang ở không đổi. Các dây vốn dẫn tới nút giờ dẫn tới đầu nối của khung, và một đường đứt nét mờ chạy từ mỗi tên đầu nối tới nút body in hoặc body out cùng tên. Ô trên thanh tiêu đề của khung (hoặc **Đóng tại chỗ**) đóng nó lại.

Cái được vẽ bên trong khung là các nút của chính thân, không phải bản sao. Chọn một nút, kéo nó, nhấn đúp để xem thuộc tính, đổi giá trị hoặc xóa nó, và bạn đã chỉnh sửa thân, như một bước có thể hoàn tác, và một lần triển khai lưu nó. Di chuyển khung bằng thanh tiêu đề thì di chuyển nút sơ đồ con, và thân đi theo. Một dây nối hai nút của cùng một sơ đồ, nên một dây từ nút bên ngoài tới nút bên trong bị từ chối bằng lời; hãy nối vào đầu nối trên khung. Thu phóng, kéo, vừa khít và khung chọn hoạt động như ở mọi nơi khác.

Những sơ đồ con nào đang mở là cách bạn đang nhìn sơ đồ. Nó không nằm trong tệp luồng, không phải một bước hoàn tác, và tải lại sẽ đóng tất cả, nên mở một cái không bao giờ thay đổi những gì một lần triển khai gửi đi. Một sơ đồ con trong một sơ đồ đang mở có ô riêng và cũng mở được, sâu ba cấp. Một thân đã mở ở nơi khác không được mở lần thứ hai, và một sơ đồ con mà thân của nó dẫn tới một sơ đồ đã mở thì được vẽ ở trạng thái đóng, để một sơ đồ chứa chính nó không làm trình soạn thảo lặp vô hạn. Một thân không được gì nêu tên, hoặc được nêu tên bằng một cái tên hai sơ đồ cùng dùng, không có ô, vì runtime cũng không tìm thấy nó. Vòng lặp và cấu trúc trường hợp cũng sở hữu các thân và chưa mở tại chỗ được.

## Tạo một sơ đồ con trong trình soạn thảo

Khi đã chọn các nút trên một sơ đồ, **Vùng chọn thành sơ đồ con** trên thanh hỏi một cái tên, gọi `POST /diagrams/{id}/sub` với tệp luồng mà trình soạn thảo đang giữ và nạp câu trả lời như một lần chỉnh sửa có thể hoàn tác: các nút chuyển sang một tab riêng và một nút sơ đồ con thế chỗ chúng, với các đầu vào và đầu ra được suy ra từ các dây cắt qua vùng chọn. Không có gì được lưu cho tới khi triển khai.

## Phát lại một lần chạy

Làm nổi bật quá trình chạy làm chậm một lần chạy khi nó đang diễn ra. **Phát lại lần chạy gần nhất**, ở cuối canvas, phát một lần chạy đã kết thúc, từ những gì nó đã ghi lại, để bạn theo dõi sau đó. Nó làm sáng các dây và đánh dấu các nút như lần chạy trực tiếp, từng sự kiện một, ở tốc độ bạn chọn (Chậm, Bình thường, Nhanh hoặc Rất nhanh), và khi xong, canvas hiện những gì lần chạy để lại. **Dừng phát lại** kết thúc sớm. Nó không thay đổi gì trong runtime và không bắt đầu gì: nút tắt khi một lần chạy đang diễn ra, và một lần phát lại kết thúc khi bạn chuyển sang tab khác.

Mỗi lần chạy ghi lại điểm bắt đầu và kết thúc của các nút và mọi giá trị đã đi qua một dây, tối đa 20.000 sự kiện. Một lần chạy dài hơn giữ 20.000 sự kiện đầu, nói rõ điều đó khi phát lại, và bản phát lại hiện phần đầu đó, vì một bản phát lại bắt đầu từ giữa sẽ không có gì để xuất phát. Các giá trị được giữ dưới dạng các bản xem trước ngắn mà dây hiển thị, nên một mảng hàng nghìn mẫu là độ dài của nó và vài giá trị đầu. Bản ghi là của lần chạy gần nhất, và một lần chạy mới thay thế nó; nó không được lưu qua lần khởi động lại. `GET /diagrams/{id}/trace` là cùng bản ghi đó cho một tập lệnh.

## Bố cục gọn gàng

**Sắp xếp lại bố cục** trên thanh tab sắp xếp các nút đang hiện để dữ liệu đọc từ trái sang phải và không dây nào chạy xuyên qua một nút. Cột của một nút là chuỗi dây dài nhất dẫn tới nó. Một dây nhảy qua các cột được cấp một làn qua chúng, các nút trong một cột được xếp để gỡ các chỗ giao nhau, rồi mỗi dây dài được kiểm tra dọc theo đường cong nó thực sự được vẽ so với các nút trong những cột nó cắt qua, và một nút cản đường được dời đi. Khối giữ góc trên bên trái của nó, và toàn bộ là một lần chỉnh sửa có thể hoàn tác. Với một vòng lặp trong cách đấu dây, dây khép nó bị loại khỏi việc xếp hạng, nên nó chạy ngược thay vì làm bố cục lặp vô hạn.

## Tên dây

Một dây của sơ đồ được đặt tên ở giữa, theo đầu ra mà nó xuất phát (`sum`, `result`, `iterations`), bên cạnh kiểu của nó khi một trong hai đầu khai báo, và rê chuột lên vẫn hiện giá trị cuối cùng nó đã mang.

## Thu phóng

Canvas thu phóng từ 5 phần trăm đến 400 phần trăm quanh con trỏ, và đọc mức thu phóng của nó dưới dạng `data-zoom` trên canvas.

## Đặt một đối tượng của bảng điều khiển theo tên

`dia-panel-set` thay đổi một thuộc tính của một điều khiển hoặc một chỉ báo trong khi sơ đồ chạy, theo nhãn của đối tượng (hoặc id của nó): `visible` và `enabled` nhận true hoặc false, `color` nhận red, amber, green, blue, gray hoặc default, `label` nhận văn bản, còn `min` và `max` nhận một số cho một điều khiển số. Một điều khiển bị vô hiệu từ chối những gì người vận hành đặt, một đối tượng bị ẩn không được vẽ, và bảng điều khiển mà người vận hành đang mở sẽ theo đó. Một tên không khớp đối tượng nào, hoặc khớp nhiều hơn một, là một vấn đề khi triển khai nếu nó được gõ trên nút và là một lỗi trên dây nếu nó được nối vào, và một lần chạy bắt đầu từ bảng điều khiển như đã được thiết kế.

## Biểu tượng

Mỗi loại nút FlowLab được vẽ bằng một biểu tượng riêng của chúng tôi ở giữa thân của nó (dấu cộng cho toán học, sigma cho thống kê, hình sin cho dạng sóng, phích cắm cho cổng nối tiếp), bên cạnh nhãn văn bản. Đó là các nét đơn giản được vẽ trong `web/src/lib/symbols.ts`, không phải phông biểu tượng hay tác phẩm của ai, và một bài kiểm thử thất bại khi một loại nút sơ đồ nêu một biểu tượng chưa được vẽ.

## Ghi vào thiết bị: cổng ghi

Một sơ đồ ra lệnh cho thiết bị theo một cách duy nhất: `dia-hotloop-write`. Nó gửi giá trị của mình tới một tag trong HotLoop (`device/tag`, đặt trên nút hoặc nối vào) qua cổng ghi của HotLoop, cổng này quyết định, theo thứ tự của nó, rằng việc ghi đã bật, tag đã được vũ trang và giá trị nằm trong dải. Flow không bao giờ tự ghi vào máy. HotLoop ghi lại mọi lần thử, bị từ chối hay không, với lý do `flow:<diagram>/<node id>`, nên dấu vết kiểm toán của nó nêu tên sơ đồ và nút. Một lần từ chối là một lỗi trên dây lỗi của nút kèm lý do của chính cổng (mã 5006), và một HotLoop không liên lạc được cũng vậy; trong cả hai trường hợp việc ghi không xảy ra, và nút từ chối triển khai khi chưa chọn HotLoop. Các nút nối tiếp thô và nút thiết bị đo nói chuyện với thiết bị đo để bàn (đồng hồ vạn năng, nguồn, tải), vốn không có tag trong HotLoop, nên chúng có công tắc riêng (bên dưới).

## Công tắc ghi của thiết bị đo

Đọc một thiết bị đo không thay đổi gì và luôn mở. Ghi vào nó thì có thể: đầu ra của một nguồn, điện áp cao của một máy hipot, dòng điện của một tải. Vì vậy mọi thiết bị đo bắt đầu với việc ghi **tắt**, và một lần ghi từ sơ đồ bị từ chối cho tới khi ai đó có quyền `instrument.write` bật việc ghi của thiết bị đo đó, từng thiết bị một.

- **Cái gì được tính là ghi.** `dia-serial-write` luôn là ghi. `dia-instr-query` là đọc khi lệnh của nó là một truy vấn (mọi câu lệnh SCPI trong đó kết thúc bằng `?`, như `*IDN?` hay `MEAS:VOLT?;MEAS:CURR?`) và là ghi nếu không (`OUTP ON`, `VOLT 5`, `*RST` hoặc `VOLT 5;MEAS:VOLT?`). Một lệnh được nối vào được tính là lệnh có thể ghi.
- **Thiết bị đo nào.** Thiết bị đo chính là địa chỉ của nó: `tcp://host:port` hoặc `serial:///dev/ttyUSB0`, bỏ các thiết lập nối tiếp, nên một thiết bị đo được mở theo hai cách là một công tắc.
- **Một lần từ chối** là một lỗi trên dây lỗi của nút (mã 5007) cho biết việc ghi vào thiết bị đo đó đang tắt, và thiết bị đo không bao giờ nghe thấy lệnh.
- **Bật nó.** `PUT /instruments/writes` với `{"instrument": "tcp://10.0.0.5:5025", "allowed": true, "note": "bench 2"}`, cần `instrument.write` (quản trị viên có quyền này) và được giữ trong `instrument-writes.json` trong thư mục dữ liệu nên khởi động lại không thay đổi gì. `GET /instruments` liệt kê mọi thiết bị đo có công tắc hoặc có sơ đồ đã triển khai sẽ ghi vào nó, kèm người đặt và các sơ đồ và nút liên quan.
- **Kiểm toán.** Mỗi thay đổi công tắc là `instrument.switch`, và mỗi lần ghi của một sơ đồ là `instrument.write` hoặc, khi bị từ chối, `instrument.refused`, kèm sơ đồ, nút, thiết bị đo và lệnh.
- **Việc triển khai cho biết.** Một nút sẽ ghi vào thiết bị đo là một ghi chú trên sơ đồ (**ghi chú** của thanh, và danh sách mà `hotloop-flow test` in ra), nêu tên thiết bị đo và nói rằng việc ghi của nó tắt cho tới khi ai đó bật. Các tệp luồng chỉ đọc thì không đổi.

## Đưa một VI LabVIEW vào

Nhập một `.vi` trong hộp thoại Nhập của trình soạn thảo (hoặc `import_vi` qua MCP, hoặc `POST /flows/import-vi`) và FlowLab đọc những gì đọc được và liệt kê, trước khi thêm bất cứ thứ gì, những gì nó không đọc được. Hãy đọc docs/labview-import.md: tài liệu đó nói chính xác cái gì sang được và cái gì không. Bản ngắn: tên của VI, mô tả, phiên bản, tên của bảng điều khiển phía trước và các VI mà nó gọi sang được, dưới dạng một ghi chú trên một luồng riêng. Các dây và nguyên thủy của sơ đồ khối không sang được, nên sơ đồ là việc của bạn vẽ, với các tên đó bên cạnh.
