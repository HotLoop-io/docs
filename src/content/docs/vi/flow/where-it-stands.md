---
title: "Flow đang ở đâu"
description: "Flow đã được kiểm chứng trên thiết bị thật nào, và nó đến từ đâu trước khi là HotLoop Flow."
---

**Nó chạy.** Nó khởi động, phục vụ API và trình soạn thảo, nạp các luồng từ volume, di chuyển thông điệp, và trở lại sau khi khởi động lại với các luồng, thông tin xác thực và ngữ cảnh của nó. Chart triển khai nó ở cả ba chế độ mạng và toàn bộ chuỗi phát hành được giải quyết. Nó chạy trong một nhà máy thật.

**Đã kiểm chứng trên hạ tầng thật**: Mosquitto, InfluxDB và PostgreSQL. Giá trị tag của InfluxDB trở ra từ một cơ sở dữ liệu thật là `press 01,west` với dấu cách và dấu phẩy còn nguyên. Đó là lỗi thoát ký tự mà nếu không sẽ lặng lẽ làm vỡ một chuỗi và khiến ai đó mất một ngày mới tìm ra.

**Cookie và multipart trả lời đúng như các thư viện của chính Node-RED**, vì đã được đối chiếu với chúng, hơn một trăm trường hợp, và các câu trả lời được đưa vào một tệp golden mà các bài kiểm thử phát lại qua socket thật. Điều đó gồm cả những trường hợp xấu xí: tên tệp UTF-8 ra bị hỏng đúng như ngăn xếp Node-RED làm hỏng nó, và một cookie tên `value` mất giá trị trong `msg.responseCookies`, giống như ở đó. Khớp cả các lỗi là điểm mấu chốt. Một luồng dựa vào một lỗi như vậy sẽ hỏng vào ngày nó biến mất.

**Đã chạy trên phần cứng thật (2026-11-17):** các nút S7 và EtherNet/IP, đường nối bền vững (lưu và chuyển tiếp và các lần ghi đĩa) và plugin, cùng các cạm bẫy và từ chối của chúng, và một plugin đã ký trong một cụm thật. Các con số ghi đĩa và theo từng lần gọi vẫn được gắn nhãn nơi đo.

Những gì được xây tiếp theo, và theo thứ tự nào, nằm ở [lộ trình](/vi/flow/roadmap/).

## Trước khi là HotLoop Flow

Nó từng là Emberwire, và `v0.1.0` vẫn ở nơi nó từng ở, tại `ghcr.io/embernet-ai/emberwire:0.1.0`. `2.0.0` là bản phát hành đầu tiên dưới tên này, và 2.x không đọc bất cứ thứ gì do tên cũ ghi ra: các biến `EMBERWIRE_*`, hai loại nút cơ sở dữ liệu `emberwire-`, một mô-đun WASM biên dịch theo các export cũ và tệp thông tin xác thực của 0.1.0 đều phải làm lại. Đó là một lần cắt gọn có chủ ý. Chưa ai xây dựng trên 0.1.0, và một lớp tương thích cho số người dùng bằng không chỉ là thêm mã có thể sai. Từ 2.0.1, tệp thông tin xác thực cũ nhận được một thông báo rõ ràng nêu tên tệp, nói rằng Emberwire đã ghi nó, và yêu cầu bạn đặt nó sang một bên rồi nhập lại thông tin xác thực.