---
title: "Đưa luồng Node-RED của bạn sang"
description: "Nhập flows.json của Node-RED nguyên vẹn, xem từng nút tương ứng với gì và Flow từ chối chạy những gì, cùng lý do."
---

Flow đọc định dạng v1 của `flows.json` trong Node-RED, mảng JSON phẳng mà mọi bản xuất và mọi mục trong thư viện luồng của Node-RED đều được ghi bằng. Trỏ nó tới tệp của bạn và nó chạy.

**Nó nạp và lưu từng byte một.** Nạp một tệp, lưu lại mà không sửa gì và bạn nhận lại đúng những byte đó: cùng thứ tự khóa, cùng khoảng trắng, không có ký tự thoát nào tự ý bị viết lại. Sửa một thuộc tính thì khác biệt chỉ là một dòng chứ không phải cả nút.

Trong Go việc này khó hơn vẻ ngoài. Một đối tượng JavaScript giữ thứ tự chèn của các khóa, nên môi trường JavaScript có điều đó miễn phí từ `JSON.parse` và `JSON.stringify` mà không ai phải nghĩ tới. Map trong Go không có thứ tự nào cả và `encoding/json` cố ý sắp xếp các khóa. Thay vì ép một map giữ thứ tự vào mọi đường đọc trong mã nguồn, các byte gốc của từng mục được giữ lại và phát ra lại khi dạng đã phân tích không đổi, rồi mã hóa lại theo thứ tự khóa gốc khi nó đã đổi. `json.Compact` và `json.Indent` là các phép biến đổi ở mức byte, nên chúng thụt lề lại mà không sắp xếp lại gì.

Điều này quan trọng vì hai lý do, cả hai đều nhàm chán và đều có thật. Tệp luồng của bạn nằm trên một ổ lưu trữ và trong git, và nó không nên đổi chỉ vì một pod khởi động lại. Và khi người vận hành xem lại khác biệt của một lần triển khai trước khi đẩy lên một dây chuyền, họ phải thấy đúng những gì đã đổi và tuyệt đối không gì khác. Quy tắc đó vẫn giữ, kể cả khi kiểm thử và kiểu dữ liệu đi vào tệp: dữ liệu mới nằm trong các khóa mà công cụ khác bỏ qua, và bài kiểm thử đi-về bao gồm cả những tệp mang chúng.

Một loại nút mà bản dựng này chưa từng thấy vẫn tồn tại qua một lần nạp và lưu với mọi thuộc tính còn nguyên, nên bạn có thể chạy một luồng ở đây rồi trả lại sau đó mà không lo. `flows_cred.json` của Node-RED, dùng AES-256-CTR, được nhập ở chế độ chỉ đọc, và những gì đọc theo cách đó sẽ được mã hóa lại bằng GCM ở lần lưu kế tiếp.

**Trước khi triển khai bất cứ thứ gì, hãy hỏi xem điều gì sắp xảy ra:**

```bash
hotloop-flow import flows.json
```

Nó báo cáo mọi loại nút trong tệp, kể cả những nút bên trong luồng con, chia thành được hỗ trợ, hỗ trợ một phần với chỗ thiếu được nêu rõ, và không được hỗ trợ. Phần bên trong của một luồng con được đếm theo đồ thị đã mở rộng chứ không theo tệp, nên một bản sao không bao giờ được báo là "được hỗ trợ" trong khi im lặng về những gì nằm bên trong. Đó là khác biệt giữa việc biết ngay tại bàn làm việc và biết khi một dây chuyền dừng.

Một nút cũng có thể trỏ tới một nút cấu hình không có trong tệp. Xóa một luồng thì broker MQTT riêng của nó đi theo, trong khi một luồng con từng dùng broker đó vẫn trỏ tới một id không chỉ vào đâu. Sửa tay hoặc một bản xuất bị sao chép dở cũng gây ra như vậy. Trước đây chúng tôi chỉ phát hiện khi tin nhắn đầu tiên tới nút, và những nút chỉ tra cứu máy chủ của mình khi đó không nói gì cả. Giờ báo cáo nhập có một phần dành cho việc này, nêu tên từng nút và id không tìm thấy, trình soạn thảo ghi cùng các dòng đó vào nhật ký khi nạp, và một lần triển khai trả lời bằng chúng và đánh dấu các nút đó là khởi động thất bại, kèm thuộc tính chứa id sai. Phần còn lại của luồng tiếp tục chạy. Một nút bạn đã tắt, và một cài đặt TLS để trống hoặc ghi `true` hay `false`, không bị báo, vì đó không phải lỗi.

Một id tồn tại không có nghĩa là id đó hoạt động. Lần đầu chúng tôi đã bỏ sót điều này. Nếu cài đặt trỏ tới một tab, một luồng con, một nhóm hay một nút thường, hoặc tới một nút cấu hình sai loại, chẳng hạn cài đặt TLS nhắm vào một broker MQTT, nó nhận cùng báo cáo và cùng lỗi khởi động, và dòng đó cho biết id thực sự là gì và cài đặt cần loại nào. Trình soạn thảo chỉ đưa ra đúng loại, nên điều này chỉ đến từ sửa tay hoặc một id dán vào, đúng chỗ dễ đau nhất.

Theo mức tương thích, 108 loại nút tin nhắn gồm 12 đầy đủ, 50 một phần, 14 cố ý khác biệt và 32 là của riêng Flow. Mọi nút đều khai báo mối quan hệ của nó với nút cùng tên của Node-RED, và **một bài kiểm thử làm bản dựng thất bại nếu một nút tuyên bố tương thích một phần mà không ghi rõ bằng văn bản điều gì còn thiếu.** Một nút tương thích 90% nhưng im lặng về 10% còn lại nguy hiểm hơn một nút vắng mặt rõ ràng, vì nút đầu để một luồng trông như đang chạy được. Ma trận đầy đủ là [Tương thích với Node-RED](/vi/flow/compatibility/), được sinh từ sổ đăng ký chứ không bảo trì bằng tay, vì tài liệu tương thích bảo trì bằng tay là một lời nói dối có đóng dấu ngày.

Các điểm khác biệt đều có chủ đích và từng điểm được ghi ở đó: mỗi bên nhận trên một nhánh rẽ nhận bản sao riêng, nút `exec` có danh sách cho phép và không có shell, các nút tệp bị giới hạn phạm vi, và mọi thứ được liệt kê trong [Áp lực ngược, hiện rõ](/vi/flow/back-pressure/) đều có trần.

**Hầu hết các nút cộng đồng của Node-RED không chạy ở đây.** Chúng là các gói npm cần Node.js, và sẽ không có phiên bản tương lai nào mà một gói cần Node bỗng chạy được. Đó là cái giá cho dung lượng nhỏ và sandbox, nói thẳng để bạn có thể quyết định không chọn. Plugin WASM có chữ ký là câu trả lời của Flow cho những gì bạn tự viết: xem [Plugin không cần npm](/vi/flow/plugins/).

Các nút cộng đồng mà một nhà máy dựa vào thì lại là chuyện khác. Flow chạy gốc, bằng Go, các loại của Node-RED cho Modbus, bảng điều khiển, PostgreSQL và email, dưới tên loại riêng của chúng, nên một luồng dùng chúng nạp và chạy không đổi, cũng như `Buffer` và `setInterval` mà các nút hàm xung quanh gọi tới. Cái gì chạy, cái gì khác và cái gì đã được chứng minh nằm trong docs/node-red-types.md. Mọi nút cộng đồng khác trong luồng tự thất bại riêng với tên loại được nêu, còn phần còn lại của luồng vẫn khởi động.

JSONata từng đứng đầu danh sách những thứ khiến luồng nhập vào vấp ngã. 13 mục không chạy được ghim trong một bài kiểm thử cùng lý do cho từng mục, và mười trong số đó vẫn gây lỗi, chỉ là với mã khác. `$moment` là hàm Node-RED duy nhất bạn sẽ tiếc, và nó cho bạn biết dùng gì thay thế thay vì thất bại trong im lặng.

Các nút Inject lên lịch bằng cron là mục kế tiếp trong danh sách đó. Giờ chúng đã kích hoạt, và đúng vào phút mà Node-RED sẽ kích hoạt: crontab được đọc bởi một bản chuyển của cronosjs 1.7.1, bộ lập lịch bên trong nút Inject của chính Node-RED, và được đối chiếu với 22.620 lần kích hoạt do chính cronosjs tạo ra trên sáu múi giờ, ở cả hai phía của những lần đổi giờ thật. Điều đó quan trọng lúc 2 giờ sáng. Một ca làm bắt đầu rơi vào giờ biến mất vào mùa xuân sẽ chạy ngay khi đồng hồ nhảy, còn giờ lặp lại vào mùa thu chạy một lần, không phải hai. Lịch cũng đọc lại đồng hồ treo tường mỗi phút, nên một hộp khởi động với giờ sai rồi được NTP sửa sau đó sẽ bắt đầu kích hoạt đúng giờ thay vì trễ nhiều giờ.

Link Call là mục cuối trong ba mục. Giờ nó đã hoạt động, cùng với chế độ trả về của Link Out: một logic duy nhất, "tra cứu lô này", "kiểm tra khóa liên động này", viết một lần trên tab riêng và được gọi từ mọi dây chuyền, với đường quay lại được giữ trên tin nhắn dưới dạng ngăn xếp, nên một luồng được gọi cũng có thể tự gọi tiếp. Một lệnh gọi không bao giờ quay lại sẽ gây lỗi sau thời gian chờ thay vì treo. Một giá trị trả về đến muộn vẫn được phát ra, như trong Node-RED. Và một giá trị trả về không có nơi để quay lại là một lỗi mà nút Catch nhìn thấy, thay vì cảnh báo mà Node-RED ghi lại và không ai đọc.
