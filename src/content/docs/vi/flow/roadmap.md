---
title: "Lộ trình của Flow"
description: "Các giai đoạn của Flow, việc nào đã xong và việc nào tiếp theo, kể cả trình soạn thảo được viết lại bằng Astro."
---

HotLoop Flow sẽ trở thành gì, theo đúng thứ tự được xây dựng. Nếu không có trong danh sách này thì sẽ không được làm, nên hãy đưa nó vào danh sách.

Flow được xây dựng song song với HotLoop và vẫn là một sản phẩm riêng. FlowLab và các sơ đồ của nó, Giai đoạn 9, là một gói riêng đặt cạnh runtime thông điệp.

## Flow dùng để làm gì

Một engine luồng trực quan cho sàn nhà máy. Mỗi lần triển khai đều được so sánh khác biệt, được kiểm thử và chỉ cách khôi phục một cú nhấp chuột. Khi có chuyện trục trặc lúc 3 giờ sáng, bạn thấy chính xác thông điệp đã đi theo đường nào và trông như thế nào ở mỗi chặng. Nó chạy trong một tệp nhị phân tĩnh duy nhất đủ nhỏ cho một chiếc Pi, và không gục ngã khi cảm biến gửi dồn dập.

Nó cũng đọc `flows.json` hiện có của bạn mà không thay đổi gì. Đó là một tính năng, không phải trọng tâm.

Những quy tắc mà mọi mục bên dưới đều tuân theo:

- Không có stub. Nếu chưa được xây dựng, chưa được kiểm thử trên đồ thật và chưa chạy tốt thì không được đánh dấu.
- Mọi thứ có thể ra lệnh cho thiết bị đều đi qua một cổng có thể từ chối, và nói rõ lý do.
- Không có gì bị vứt đi lặng lẽ. Mỗi lần loại bỏ, từ chối và tràn đều được đếm và hiện trong các số đo.
- Tệp luồng luôn được nạp và lưu đúng từng byte. Dữ liệu mới nằm trong các khóa mà công cụ khác bỏ qua, và bài kiểm thử đi-về bao gồm cả những tệp mang dữ liệu đó.

---

### Giai đoạn 0: nói đúng sự thật

README đưa ra những tuyên bố mà mã nguồn không chứng minh được. Việc đó được sửa trước khi hứa thêm điều gì mới, vì một README đã nói sai một lần thì lần nào cũng bị đọc như thể nó sai.

- [x] Sandbox WASM là thật và đã được kiểm thử, nhưng chưa có nút nào dùng nó và nó chưa nằm trong tệp nhị phân. Cứ nói rõ như vậy cho đến khi Giai đoạn 6 biến nó thành sự thật
- [x] Hai chú thích trong mã trỏ tới một kho ngữ cảnh nhúng không hề tồn tại. Đã xóa chúng
- [x] Đo lại bộ nhớ lúc rảnh và lúc có tải theo cùng một cách trên cùng một máy, công bố lệnh đo cùng với con số, và bỏ mọi con số mà không ai tái hiện được
- [x] CVE-2025-41656 là lỗi của một nhà cung cấp đã xuất xưởng một engine luồng khác với xác thực tắt, không phải CVE của engine đó. Sửa cách ghi nguồn trong README và ở dòng `exec` của `docs/compatibility.md`
- [x] Viết lại phần đầu README xoay quanh việc Flow làm gì. Việc nhập các luồng hiện có chuyển sang một mục riêng ở phía dưới, với vòng đi-về đúng từng byte và `hotloop-flow import` làm bằng chứng
- [x] Tài liệu triển khai nói về Kubernetes, Podman và Quadlet, không phải App Store của riêng một công ty
- [x] Kiểm thử cho các gói chưa có: `api` (đăng nhập, quyền, mã 409 khi triển khai cũ), `config` (mọi lần từ chối khởi động mà README liệt kê) và `cmd` (triển khai ghi tệp luồng trước khi dừng runtime cũ), cùng `js`, sandbox của nút Function, vốn cũng chưa có

### Giai đoạn 1: lịch sử, khác biệt, khôi phục

Mỗi lần triển khai là một bản ghi: ai, khi nào, một ghi chú, các byte chính xác và điều gì đã thay đổi. "Cái gì đã đổi, ai đổi, trả nó về" là điều đầu tiên ai cũng hỏi sau khi một dây chuyền dừng, và hôm nay câu trả lời là ba tệp `.bak`.

- [x] Nhật ký triển khai: mỗi lần triển khai là một bản ghi bất biến với người dùng, thời gian, một ghi chú tùy chọn, các byte của luồng và thông tin xác thực đã mã hóa đúng như lúc đó. Thời gian lưu giữ là một cài đặt. `GET /deployments`
- [x] So sánh theo ngữ nghĩa: từng nút, từng thuộc tính. Thêm, xóa, đổi, nối lại dây. Kéo một nút đi chỗ khác chỉ hiện là bố cục, không bao giờ là thay đổi logic. Qua API và bằng `hotloop-flow diff a.json b.json`
- [x] So sánh này dùng được như một git difftool, nên pull request về một luồng đọc ra "ngưỡng của quy tắc 2 từ 7.5 thành 8.0" thay vì một khối JSON
- [x] Khôi phục: triển khai lại một bản ghi cũ thành bản ghi mới, kể cả thông tin xác thực, nên một nút bạn đã xóa quay lại cùng mật khẩu broker của nó. Lịch sử luôn chỉ thêm vào
- [x] Trình soạn thảo: bảng lịch sử, khác biệt được vẽ trên canvas, "xem lại và triển khai" kèm ghi chú, một nút khôi phục. Khi triển khai xung đột, nó hiện người kia đã đổi gì thay vì một hộp có/không
- [x] Luồng như mã: `hotloop-flow deploy` và `hotloop-flow export` cho CI/CD, với token chỉ dùng để triển khai để pipeline không bao giờ giữ mật khẩu quản trị
- [x] Bản sao git tùy chọn: mỗi lần triển khai được đẩy lên thành một commit do chính người triển khai làm tác giả. Thuần Go, và kiểm tra kích thước tệp nhị phân vẫn đạt
- [x] Nhật ký kiểm toán: đăng nhập, đăng nhập thất bại, triển khai, khôi phục và inject, mỗi mục kèm ai và từ đâu. Nhật ký triển khai là bảng đầu tiên của nó
- [x] MFA (TOTP), miễn phí và bật được cho bất kỳ ai muốn. Không có gì thuộc về đăng nhập an toàn bị đặt sau rào chắn trả phí, không bao giờ
- [x] Giới hạn tốc độ đăng nhập và khóa tài khoản, phiên vẫn còn sau khi khởi động lại, và token websocket được gửi qua subprotocol thay vì trong URL. Token trong URL vẫn dùng được cho các script hiện có và ghi một cảnh báo, vì làm hỏng chúng khi nâng cấp còn tệ hơn việc lộ; việc gỡ bỏ chờ đến bản phát hành lớn

### Giai đoạn 2: kiểm thử luồng

"Thay đổi của tôi có làm hỏng dây chuyền không?" được trả lời trước khi triển khai, không phải sau. Kiểm thử là YAML đặt cạnh các luồng, nên được so sánh và xem xét theo cùng một cách.

- [x] `hotloop-flow test`: runtime thật và các nút thật, chạy trong cùng tiến trình. Inject một thông điệp, mong đợi thứ gì đó ra ở một cổng trong thời hạn, mong đợi không có gì, mong đợi một lỗi đến được Catch. Có đầu ra JUnit cho CI/CD
- [x] I/O ảo hóa: một MQTT out, một lần ghi cơ sở dữ liệu hay một yêu cầu HTTP trong kiểm thử chỉ ghi lại những gì nó sẽ gửi và không bao giờ chạm tới mạng
- [x] Đồng hồ ảo: một Delay năm phút chạy trong vài mili giây, và mọi nút liên quan đến thời gian đều được chứng minh trên đó
- [x] Dữ liệu mẫu cho ngữ cảnh và thông tin xác thực, và các khẳng định về ngữ cảnh sau đó. Một kiểm thử không thể dựa vào những gì kiểm thử khác để lại
- [x] Cổng triển khai: khi bật, một lần triển khai không qua được kiểm thử sẽ bị từ chối kèm các khẳng định thất bại, và các luồng đang chạy không hề hay biết
- [x] Trình soạn thảo: biến một thông điệp gỡ lỗi đã ghi lại thành kiểm thử chỉ với hai cú nhấp, chạy bộ kiểm thử ngay trong trình soạn thảo, hiện đạt và không đạt trên các nút

### Giai đoạn 3: truy vết và phát lại

- [x] Nhấp vào một thông điệp gỡ lỗi và canvas sáng lên đường nó đã đi, kèm thời gian và payload ở mỗi chặng, qua các nút tách, nối và luồng con
- [x] Bộ đệm truy vết có giới hạn. Bộ nhớ giữ phẳng qua bài thử ngâm một triệu thông điệp, và con số được công bố
- [x] Phát lại một thông điệp đã ghi vào bản nháp của luồng và so sánh đầu ra
- [x] Một truy vết đã ghi trở thành một kiểm thử của Giai đoạn 2
- [x] Xuất OpenTelemetry, đã được chứng minh với một collector thật

### Giai đoạn 4: trạng thái bền vững

Historian ngừng một giờ không nên làm bạn mất một giờ số đo.

- [x] Ngữ cảnh lâu dài trong SQLite, thuần Go không dùng cgo, với các thao tác nguyên tử (so sánh rồi hoán đổi, tăng, cập nhật). Một kho cho ngữ cảnh bây giờ và hàng đợi bền vững sau này, không phải hai. Hiện nay ngữ cảnh luồng và toàn cục mất sạch mỗi lần khởi động lại, đây là khoảng trống dễ làm ai đó vấp trước nhất. Ghi trễ trong một giao dịch mỗi ba mươi giây, và một giá trị được đặt về đúng giá trị cũ thì không ghi gì
- [x] Dây bền vững: đánh dấu một dây là bền vững và hàng đợi của nó tràn sang chính kho đó thay vì chặn hay bỏ. Sống sót qua khởi động lại, giữ nguyên thứ tự, tôn trọng hạn mức đĩa, và độ sâu là một số đo. Được đánh dấu trong tệp luồng bằng `ew_durable`, nên vòng đi-về vẫn đúng từng byte. Nhấp đúp vào một dây trong trình soạn thảo để đánh dấu
- [x] Lưu và chuyển tiếp được chứng minh theo cách khắc nghiệt nhất: tắt InfluxDB thật mười phút khi đầu vào ổn định, bật lại, đếm số dòng. Không thiếu dòng nào, không trùng dòng nào. Rồi kill -9 runtime giữa lúc hàng đợi đang đầy và đếm lại. Script, các số đếm và số lần ghi đĩa mỗi giờ nằm trong [durable/](/vi/flow/durable-state/)
- [x] Đã chứng minh trên một chiếc Pi 5 thật: bộ nhớ, thời gian khởi động và thông lượng duy trì, trong [docs/bench](/vi/flow/benchmarks/#kết-quả-trên-raspberry-pi-5), cùng hiện tượng giảm xung nhịp đã xảy ra
- [ ] Chứng minh trên Pi 4 và Zero 2 W, và số lần ghi thẻ SD mỗi giờ trên một chiếc thẻ, vì một kho ngữ cảnh ngốn thẻ SD là một lỗi. Còn mở vì cần các bo mạch. Pi 5 đã được đo; một con số lấy từ máy khác sẽ là con số bịa

### Giai đoạn 5: sàn nhà máy

`scan` tìm thấy PLC ngày nay, nhưng không có gì trong bảng nút nói chuyện được với nó. Đó là lỗ hổng lớn nhất của một sản phẩm làm cho nhà máy.

- [x] Modbus TCP đọc và ghi
- [x] OPC UA đọc, đăng ký và ghi
- [x] S7 đọc và ghi
- [x] Sparkplug B, vừa là nút biên vừa là host
- [x] EtherNet/IP đọc và ghi
- Tất cả đều là bộ mô phỏng. Chưa có CPU Siemens hay bộ điều khiển Logix nào được đặt trước bất kỳ phần nào trong số này
- [x] Các nút HotLoop: thay đổi thực thể đi vào, trạng thái thực thể, gọi một script, áp dụng một công thức. Mọi lệnh đi qua cổng ghi của HotLoop và vào sổ nhật ký của nó dưới dạng `flow:<node id>`, và một lần ghi bị cổng từ chối sẽ đến nút Catch kèm lý do của cổng
- [x] Khi có HotLoop, các lần ghi thiết bị của Flow đi qua cổng của HotLoop thay vì thẳng tới PLC. Cả hai cùng xuất xưởng trong 2.3.0. Một lần ghi qua cổng thật đã được chứng minh với Modbus trên một image HotLoop đã công bố; các nút ghi OPC UA, S7 và EtherNet/IP gửi qua cùng đoạn mã đó và một kiểm thử xác nhận từng nút đều cung cấp cổng.

### Giai đoạn 6: plugin không cần npm

- [x] Một nút `wasm` trên host đã có sẵn: giới hạn bộ nhớ cứng, một thời hạn, và một guest vượt qua một trong hai sẽ bị trap mà không kéo theo thứ gì khác
- [x] Định dạng plugin: module, một bộ mô tả để trình soạn thảo vẽ hộp thoại của nó, và một chữ ký. Plugin không ký hoặc bị can thiệp sẽ không nạp và nói rõ vì sao
- [x] Quyền hạn: plugin không được truy cập host trừ khi manifest của nó yêu cầu và người vận hành cấp. Yêu cầu thứ chưa được cấp thì triển khai thất bại

### Giai đoạn 7: dây có kiểu và MCP

- [x] Kiểm tra schema trên nút `json`, phần đầu tiên
- [x] Schema tùy chọn trên các cổng. Sự không khớp mà trình soạn thảo thấy được thì bị từ chối khi triển khai; sự không khớp mà nó không thấy được thì đi tới một nút Catch kèm đường dẫn của trường sai, và tới một số đo
- [x] Kiểu được vẽ trên các dây trong trình soạn thảo
- [x] Luồng như công cụ MCP: một nút tool khai báo tên, mô tả và schema đầu vào, và Flow phục vụ `/mcp`. Một tác tử gọi một luồng có cùng quyền và cùng nhật ký kiểm toán như một con người
- [x] Một nút MCP client, để một luồng có thể gọi công cụ trên các máy chủ khác, kể cả của HotLoop
- [x] Các công cụ MCP riêng của Flow: liệt kê, đọc, triển khai và khôi phục các luồng, liệt kê các lần triển khai và bấm một nút inject, thông qua chính các handler của API quản trị với cùng quyền, cùng kiểm tra triển khai và cùng dấu vết kiểm toán, vì một MCP chỉ gọi được những gì tác giả luồng đã nối dây thì không thể đọc hay ghi chính Flow
- [x] Các công cụ MCP riêng của Flow cho sơ đồ và thiết bị đo: liệt kê và đọc các sơ đồ, chạy và dừng một sơ đồ, điều khiển trình gỡ lỗi của nó, đặt một điều khiển trên bảng của nó, đặt điểm dừng và đầu dò, tạo sơ đồ con, và đọc cũng như chuyển quyền ghi của một thiết bị đo; mỗi công cụ là một route quản trị chạy qua handler riêng của nó với quyền mà route đó yêu cầu (`status.read`, `diagram.run`, `instrument.write`). Trước đây các route sơ đồ không có công cụ, nên một tác tử triển khai được một sơ đồ mà không chạy được nó. Nay mọi route quản trị hoặc là một công cụ hoặc được nêu tên trong một kiểm thử là việc con người phải làm, và kiểm thử thất bại khi một route mới được thêm mà không có công cụ. Hiện có 44 công cụ, tính cả các công cụ cho trạm, chuyển dự phòng và truy vết

### Giai đoạn 8: trình soạn thảo, viết lại bằng Astro

Đã xong, và được đẩy lên sớm. Lẽ ra nó đi cuối, nhưng chúng tôi đưa nó lên trước những ảnh chụp màn hình đầu tiên của Flow, vì không ai nên thấy những ảnh đầu tiên trong một trình soạn thảo trông như của một công ty khác.

Mọi dự án HotLoop đang có một giao diện hiện đại thống nhất, và trình soạn thảo này là cái duy nhất chưa khớp. Nó từng là TypeScript thuần viết tay trên SVG gốc, một lựa chọn đúng khi mục tiêu là một tệp nhị phân tĩnh nhỏ không có gì phải kiểm toán. Nay nó là Astro với các đảo Svelte, cùng stack với trình soạn thảo của Cascade, trên cùng các token HotLoop, sáng và tối.

- [x] Trước hết là một vòng thiết kế, trước khi viết một dòng Astro nào. Trình soạn thảo nên trông và cảm thấy thế nào khi đặt cạnh phần còn lại của HotLoop, được chốt trên giấy và trong các token dùng chung, để việc viết lại là xây một thứ đã có người quyết định thay vì vừa làm vừa quyết
- [x] Trình soạn thảo được dựng lại bằng Astro với canvas, hộp thoại, lịch sử, xem lại, kiểm thử, truy vết, tìm kiếm và nhóm đều được mang sang, và không cái nào được phép kém đi. Các kiểm thử trình duyệt trong `web/e2e` là chuẩn: chúng đạt với trình soạn thảo mới mà không sửa gì
- [x] Vẫn nhúng trong một tệp nhị phân tĩnh duy nhất, vẫn không cần mạng trên một máy biên, vẫn nằm trong ngân sách kích thước tệp nhị phân, và cổng giấy phép vẫn bao phủ mọi thứ được đóng trong gói

Canvas và đồ thị bên dưới nó không bị viết lại. Chúng được chuyển vào `web/src/lib` nguyên là TypeScript cũ, chỉ khoác giao diện mới, nên việc nối dây, kéo thả, hoàn tác và vòng đi-về đúng từng byte của tệp luồng là mã đã được kiểm thử. Mọi thứ xung quanh là Svelte.

Flow vẫn là một sản phẩm riêng trong suốt quá trình này. Nó dùng chung diện mạo với HotLoop, không dùng chung mã, và không bao giờ được nhúng trong HotLoop.

### Giai đoạn 9: FlowLab, các sơ đồ

Một cách thứ hai để chạy một tab, đặt cạnh các thông điệp chứ không thay thế chúng. Trong một sơ đồ, mỗi nút chạy một lần, khi mỗi đầu vào được nối dây của nó đã có giá trị, và các nhánh không có dây nối giữa chúng chạy cùng lúc. Đó là thứ một bệ thử nghiệm hay một bộ ghi dữ liệu cần: vòng lặp mang một giá trị từ lượt này sang lượt sau, một lỗi đi trên một dây riêng, một bảng mà người vận hành mở được trên điện thoại, và một trình gỡ lỗi có thể tạm dừng một lần chạy và cho thấy giá trị trên mọi dây. Các luồng hiện có không đổi, và tệp luồng vẫn nạp và lưu đúng từng byte: một sơ đồ là một tab có khóa `ew_diagram`, và dây nào đi vào đầu vào nào được giữ trong `ew_in` trên nút mà dây xuất phát. [FlowLab](/vi/flow/flowlab/) còn có phần còn lại.

- [x] Bộ lập lịch: mọi đầu vào được nối dây đã sẵn sàng, các nhánh độc lập chạy song song, và một dây `after` để định thứ tự ở nơi không có dữ liệu chảy qua
- [x] Vòng lặp while và for với giá trị mang theo, và một dây lỗi bỏ qua các nút sau chỗ lỗi, dừng một vòng lặp và mang theo nguồn gốc cùng mã lỗi
- [x] Một cổng nối tiếp, đọc đến ký tự kết thúc hoặc số byte, có timeout trên dây lỗi, và một cổng được mở lại sau khi cáp bị rút và được đếm
- [x] Bộ phân tích số đọc, phát hiện giá trị ổn định, và nhật ký văn bản có cột thời gian
- [x] Một bảng do Flow phục vụ: điều khiển, đèn báo và biểu đồ hoặc đồ thị, mở trên điện thoại khi một lần chạy đang diễn ra, với người xem thứ hai trên máy tính, mỗi bên theo kịp lần chạy trong vòng một giây
- [x] Chạy, dừng, tô sáng quá trình thực thi, đầu dò trên mọi dây, điểm dừng trên nút, dây và lượt chạy, và bước vào, bước qua và bước ra
- [x] Trình soạn thảo vẽ các cổng có tên và nối dây tới cổng bạn thả vào, và cùng một trang chạy và gỡ lỗi
- [x] Cấu trúc case, bản ghi và kiểu dùng chung, dạng sóng
- [x] Ghi nhật ký TDMS và nhị phân, và một đầu ra cơ sở dữ liệu và MQTT
- [x] Phiên thiết bị đo, qua socket thô và cổng nối tiếp, đã được chứng minh với một bộ mô phỏng và một pty
- [ ] Một client thu thập dữ liệu được chứng minh với chính máy chủ của NI. Nó đã được xây và xuất xưởng, mới chỉ được kiểm thử với một máy chủ giả lập, nên vẫn mở cho đến khi chạy được với máy chủ của NI và một thiết bị
- [x] Phân tích: thống kê và bộ lọc
- [x] Sơ đồ con, danh sách lỗi trong CI/CD, và công việc thu phóng và bố cục của trình soạn thảo
- [x] Phát lại một lần chạy đã xong: mọi lần bắt đầu và kết thúc của nút cùng mọi giá trị trên dây đều được ghi lại, và thanh sơ đồ phát lại lần chạy gần nhất trên canvas. `GET /diagrams/{id}/trace`, công cụ `get_diagram_trace`
- [x] Một sink cơ sở dữ liệu giữ lại những gì cơ sở dữ liệu bỏ lỡ: `postgres out`, bền vững, ghi theo thứ tự và theo lô khi cơ sở dữ liệu trở lại, đã được chứng minh trên một TimescaleDB thật
- [x] Đẩy một tệp luồng, và do đó một bộ sơ đồ, tới mọi bản cài Flow mà một tenant chạy trong EmberNet, kiểm tra sau từng bản, và bản nào hỏng thì được trả về ([Đẩy tới các trạm của tenant](/vi/flow/stations/)), đã được chứng minh trên ba tiến trình Flow thật
- [ ] Chứng minh trên một chiếc Pi trong một ngày, cần có bo mạch và một lần chạy dài

---

## Những thiếu sót thường ngày

Những mục này chạy song song với các giai đoạn. Không ai chọn một engine luồng vì có chúng, nhưng nhiều người bỏ một engine vì không có.

- [x] Triển khai một phần: chỉ các nút đã đổi và dây của chúng được khởi động lại. Hiện nay mỗi lần lưu đều làm rơi mọi phiên MQTT và mọi thông điệp đang xử lý, khiến người vận hành học cách không triển khai trong ca làm việc
- [x] JSONata, được chứng minh với các ví dụ đã công bố, vì đó là thứ một luồng nhập vào hay vấp phải nhất
- [x] Inject theo kiểu cron
- [x] Chế độ trả về của Link Call và Link Out
- [x] Join theo thời gian chờ và reduce, batch theo thời gian, split dạng luồng
- [x] MQTT v5 và last will
- [x] TLS trên TCP, cookie và multipart trên HTTP
- [x] Trình soạn thảo: sao chép và dán, nhập và xuất một vùng chọn, chỉnh sửa luồng con và nhóm, tìm kiếm trên mọi luồng, lọc gỡ lỗi
- [x] Những thiếu sót của trình soạn thảo mà lượt đầu để lại: thêm nút cấu hình từ bảng nút (hộp thoại bảo làm vậy mà bạn không làm được), biến một vùng chọn thành luồng con, đổi tên và xóa một luồng, và đánh dấu một dây bền vững bằng cách nhấp đúp
- [x] Một lối thoát cho thông điệp mà đích của một dây bền vững từ chối mãi mãi: một giới hạn số lần thử, tùy chọn bật, cho mỗi dây. Sau chừng đó lần từ chối, thông điệp đi tới Catch của luồng như một lỗi kèm thông điệp đó và dây đi tiếp. Mặc định tắt, nên một dây vẫn giữ và thử lại đúng như trước
- `store.*` đã có từ công việc bền vững và nay có cùng kiểm tra đó
- [x] Một nút trỏ tới một nút cấu hình không có trong tệp (một luồng bị xóa cùng broker của nó trong khi một luồng con, một chỉnh sửa tay hay một lần nhập vẫn nhắc tên nó) được `hotloop-flow import` báo cáo, báo trong trình soạn thảo khi nạp và khi triển khai, và trong phản hồi triển khai, và nút đó là một lỗi khởi động thay vì một nút lặng lẽ không bao giờ chạy
- [x] Những thiếu sót mà mục đó để lại: một tham chiếu cấu hình trỏ tới một tab, một luồng con, một nhóm, một nút thường hay sai loại nút cấu hình cũng được báo cáo và khởi động thất bại như một tham chiếu không trỏ tới gì, một lần khôi phục đưa các cảnh báo của tệp vào nhật ký trình soạn thảo một lần chứ không hai, và `hotloop-flow import` ghi báo cáo của nó ra một writer như `deploy` đang làm, để các kiểm thử của nó khỏi phải thay đầu ra chuẩn
- Upstream vẫn còn dòng đó; chúng tôi không đề nghị họ nhận thay đổi này
- [x] Kiểm thử dọn dây bền vững có thể đếm nhiều hơn một thông điệp bị bỏ so với số đã lấy mẫu là đang trong hàng đợi. Sai là ở kiểm thử, không phải hàng đợi: nó đợi 28 trong 30 thông điệp nằm trên đĩa rồi bắt việc dọn phải đúng bằng những gì nó đã thấy, trong khi bộ đệm ghi vẫn đang đếm những cái cuối. Có bao nhiêu trong 30 cái nằm trên đĩa khi dây biến mất phụ thuộc vào thời điểm, nên giờ nó coi những gì đã thấy là mức sàn và 30 cái đã gửi là mức trần
- [x] Kiểm thử kill dây bền vững đạt trên máy cục bộ và hỏng trên một runner chậm hơn. Hàng đợi đếm một thông điệp là đang chờ trước khi nó nằm trên đĩa, nên một bản sao lấy đúng lúc số đếm chạm 100 có thể thiếu một. Giờ nó đếm sau khi commit
- [x] Trình soạn thảo, phần mô tả nút và trang bảng điều khiển bằng 13 ngôn ngữ ngoài tiếng Anh, với một bảng thuật ngữ dùng chung
- [x] Kafka out, cùng ntfy, gotify và discord out, với các cài đặt thông báo mà core đã có
- [x] Một dây bền vững tới InfluxDB bắt kịp theo lô tối đa 256, nên một giờ tồn đọng được xả trong vài giây thay vì vài phút
- [x] Các nút kết nối Node-RED mà việc chuyển một nhà máy cần (máy chủ Modbus trên một giao diện mạng, email, postgres và các nút bảng điều khiển), chạy nguyên bản
- [x] Giá trị chart và một bước kiểm tra render cho việc đẩy tới các trạm
- [x] Bí mật theo tham chiếu: một nút đọc mật khẩu từ một Kubernetes Secret hoặc tệp đã mount, nên nó không bao giờ nằm trong tệp luồng
- [x] Mang luồng của bạn tới: `hotloop-flow import` vẫn báo cáo chính xác cái gì sẽ chạy và cái gì không trước khi triển khai bất cứ gì. Nó liệt kê các loại nút chạy được, những loại chạy có khác biệt và khác biệt là gì, những loại sẽ không khởi động, và một nút trỏ tới một nút cấu hình không có trong tệp

## Sau này

- [x] Chủ động/dự phòng: một lease trong PostgreSQL với số rào chắn, một rào chắn trên mọi lần ghi vào thiết bị, và một bên dự phòng giữ các lần ghi của mình cho đến khi tiếp quản lease ([Dự phòng ấm với lease](/vi/flow/failover/)). Đã được chứng minh trên hai tiến trình Flow thật với một PostgreSQL thật và một máy chủ Modbus ghi lại mọi lần ghi: bị kill giữa chừng, bị đóng băng rồi rã đông, và dừng êm, không có lần ghi nào từ cả hai bên. Ngữ cảnh vẫn nằm trên đĩa của từng bản cài chứ không trong Postgres, đó là bản phác đầu tiên và không cần thiết để giữ hai bên ghi tách biệt

## Đã quyết định

Mọi câu hỏi mà danh sách này từng mang đều đã có câu trả lời. Chúng vẫn ở đây cùng câu trả lời, vì lý do là thứ ngăn người khác mở lại.

Quyết định ngày 2026-10-03:

- **Các nút công nghiệp được xây dựng trong Flow,** trên cùng các thư viện mã nguồn mở mà các driver của HotLoop dùng. Các driver của HotLoop vẫn là của HotLoop. Flow giữ giấy phép riêng của nó, vốn là một giấy phép khác lúc quyết định này được đưa ra và nay là HotLoop Source License Agreement 1.0, thay thế EmberNet Source License 1.0 và trước đó là Business Source License 1.1 mà nó mang từ 2.2.0.
- **Flow vẫn là một sản phẩm riêng và không bao giờ được nhúng trong HotLoop.** Nó chạy cạnh HotLoop và nói chuyện với API của HotLoop từ bên ngoài, đó là điều các nút HotLoop của Giai đoạn 5 làm, và đó là toàn bộ mối quan hệ.
- **README mở đầu bằng việc Flow làm gì.** "Nối nhà máy. Xem lại nó như xem mã." Việc nhập các luồng hiện có nằm sâu hơn trong "Mang luồng của bạn tới", và không có gì ở đầu trang so sánh Flow với bất cứ thứ gì. Flow tự đứng vững.
- **Ngữ cảnh lâu dài là SQLite ngay từ đầu,** thuần Go không dùng cgo. Một kho cho ngữ cảnh bây giờ và hàng đợi bền vững về sau, không phải một kho tệp trước rồi một kho thứ hai sau đó.
- **Sản phẩm tự động hóa quy trình là một thứ riêng** và không dùng chung engine của Flow. Lịch sử, so sánh và phần còn lại vẫn là các gói engine ở đây, vì API, CLI, trình soạn thảo và git đều phải nhận cùng một câu trả lời.

Quyết định trước khi Giai đoạn 1 bắt đầu:

- **MFA và nhật ký kiểm toán xuất xưởng ở Giai đoạn 1,** trước những thứ vui hơn. Cả hai đều đã làm.
- **Vòng đi-về đúng từng byte của các tệp luồng hiện có vẫn là quy tắc cứng,** ngay cả khi tệp có kiểu và kiểm thử. Dữ liệu mới nằm trong các khóa mà công cụ khác bỏ qua, và bài kiểm thử đi-về bao gồm cả những tệp mang dữ liệu đó.
- **Benchmark chỉ dùng số tuyệt đối,** mỗi số kèm lệnh đã tạo ra nó. Một bảng so sánh cạnh nhau thay đổi mỗi khi máy đổi, và rốt cuộc mô tả engine kia nhiều hơn engine này.
