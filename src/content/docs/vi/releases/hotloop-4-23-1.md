---
title: "Ghi chú phát hành: HotLoop core 4.23.1"
description: "HotLoop core 4.23.1 có gì mới, điều gì thay đổi khi nâng cấp và nên đọc gì trước khi đụng vào một nhà máy đang chạy."
sidebar:
  label: "4.23.1"
---

Bản phát hành này mang mọi thứ mà ghi chú của 4.23.0 liệt kê. Thời tiết và năng lượng, giao diện web thêm mười ba ngôn ngữ, các màn hình di chuyển giữa các bản cài dưới dạng tệp, và những lệnh đầu tiên tới một bảng điều khiển UniFi. Chỉ build cho amd64; bản build đa kiến trúc theo sau ở phiên bản kế tiếp.

## Có gì thay đổi

- **Một trạm thời tiết là một thực thể.** Được dựng từ các tag mà một trạm trên mái đã publish (nhiệt độ, độ ẩm, áp suất, gió, mưa, mặt trời), với điểm sương, chỉ số nhiệt và gió lạnh được tính ngay trên hộp. Một cảm biến mà trạm không được cấp thì không có hàng, và một cảm biến ngừng trả lời được đọc là Unavailable, không bao giờ là không. Không có dịch vụ đám mây nào được gọi. Xem [Weather](/vi/iot/weather/).
- **Đồng hồ đo năng lượng.** Một đồng hồ là một tag được đọc như một lượng đã dùng (một bộ đếm tích lũy như kWh, khí, nước hoặc khí nén, hoặc một công suất). Lượng đã dùng được giữ trong các thùng 15 phút, nên một lần khởi động lại không mất gì và một ca, một ngày hay một tháng là một tổng. Biểu giá gán cho mỗi thùng một chi phí khi thùng được tạo, nên một mức giá đổi sau này không đổi chi phí tháng trước, và chi phí của một đơn vị sản xuất được tính từ một đồng hồ sản xuất. Có màn hình Energy, API và các công cụ MCP. Xem [Energy](/vi/iot/energy/).
- **Giao diện web có thêm mười ba ngôn ngữ** bên cạnh tiếng Anh: Tây Ban Nha, Pháp, Ý, Đức, Na Uy, Bulgaria, Hy Lạp, Hàn, Nhật, Việt, Hindi, Trung giản thể và Ả Rập, bố cục từ phải sang trái. Hãy chọn một ngôn ngữ ở thanh trên cùng hoặc trên thẻ đăng nhập. Xem [Languages](/vi/iot/languages/).
- **Một bảng điều khiển xuất ra tệp và nhập vào một bản cài khác.** Các màn hình của khách hàng là của họ và không bao giờ là một phần của sản phẩm: tệp liệt kê mọi tag, thiết bị, script và công thức mà nó nêu tên, và một lần nhập báo cáo mọi vấn đề cùng lúc, kèm ánh xạ cho các tên khác nhau, trước khi lưu bất cứ thứ gì. Export và Import là các nút trên màn hình Dashboards, còn `screen_export` và `screen_import` là các công cụ MCP. Xem [Screen files](/vi/iot/screen-file/).
- **Các lần đọc của MCP đi cùng các lần ghi của nó**, các lần chạy thử của trình soạn thảo và việc nhập cảnh báo từ CODESYS.
- **Những lệnh đầu tiên tới một bảng điều khiển UniFi.** Năm loại điểm có thể được ra lệnh, mỗi loại chỉ đọc cho đến khi một người kích hoạt tag đó, qua cổng ghi như mọi tag: đèn LED định vị của thiết bị, khởi động lại thiết bị, chu kỳ nguồn PoE của một cổng switch, một mạng không dây bật hoặc tắt, một client được theo dõi bị chặn hoặc cho vào lại, và chế độ PoE của một cổng. Một chu kỳ nguồn bị giữ bởi thời gian chờ 15 phút được lưu trong cơ sở dữ liệu, nên một lần khởi động lại không quên nó, và một cổng mang mạng (uplink, switch, gateway, bản dự phòng 5G, một peer mà bảng điều khiển không liệt kê) không bao giờ bị chu kỳ. Tài khoản bảng điều khiển mà HotLoop đăng nhập phải là Administrator cục bộ cho các lệnh này; tài khoản View Only bị bảng điều khiển từ chối và HotLoop nói rõ như vậy. Một blueprint có sẵn chu kỳ cổng của một thiết bị im lặng một lần rồi nâng một cảnh báo. Xem [UniFi Network](/vi/iot/unifi/).
- **Máy chủ OPC UA trả lời HistoryRead** từ lịch sử mà Gateway giữ, thô và đã xử lý.
- **Khung delta của OPC UA PubSub, như một tùy chọn.** `HOTLOOP_UADP_PUBLISH_DELTA_FRAMES=true` chỉ gửi các trường đã thay đổi giữa các khung key. Mặc định tắt.
- **Một thẻ hình ảnh trên trang panel vừa với thẻ của nó** và không còn đặt chiều cao của hàng.
- **Unit nâng cấp cơ sở dữ liệu của bản cài Quadlet tự bỏ qua** khi volume không có gì để nâng cấp, vì Podman 5.7 không khởi động một container không có gì để chạy, và tên của cơ sở dữ liệu đi kèm được vừa vào 52 ký tự mà một StatefulSet có thể có.
- **Các chart giữ lại Secret thông tin xác thực khi gỡ cài đặt**, như volume của cơ sở dữ liệu: cài lại cùng tên từng tạo mật khẩu mới mà cơ sở dữ liệu được giữ lại từ chối. Để bắt đầu sạch, hãy xóa Secret bằng tay cùng với volume.
- **Đầu ra Kafka chờ** broker cho một topic vừa tạo lâu bằng mức kết nối của nó cho phép, và các con số về hàng đợi khi mất kết nối của Edge Relay đã được ghi tài liệu là những số đã đo (khoảng hai phút ở 2,000 số đọc mỗi giây).
- Các bản sửa mà bộ kiểm thử tìm thấy: người dùng kiểm thử OPC UA được băm ở chi phí thấp nhất của bcrypt, nên một lần đăng nhập trong bộ kiểm thử không còn vượt quá thời gian mà client kiểm thử chờ trên một runner chậm (máy chủ và đăng nhập của nó không đổi), luồng trực tiếp quên những gì nó đã gửi vào lúc trang cuối của nó rời đi, máy chủ OPC UA nói khi listener của nó giữ cổng, và một số bài kiểm thử không còn sleep cho những việc xảy ra theo thời gian riêng của chúng.

## Migration

Hai cái, mỗi cái chỉ bổ sung: `0028_unifi_port_cycles` (lần cuối mỗi cổng switch được chu kỳ nguồn) và `0029_energy` (ba bảng cho đồng hồ và các thùng của chúng). Cả hai đều có trong bản sao lưu. Một bản sao lưu lấy trên 4.22.1 khôi phục được ở đây, còn bản lấy ở đây không khôi phục được lên bản phát hành cũ hơn.

## Thay đổi API

Route mới: `GET /api/energy/meters`, `POST /api/energy/meters`, `GET`, `PUT` và `DELETE /api/energy/meters/{id}`, `GET /api/energy/summary` và `/api/energy/summary/{period}`, `GET /api/energy/series` và `/api/energy/series/{meter}/{period}/{step}`, `GET /api/dashboards/{id}/export`, `POST /api/dashboards/import` và `GET /api/entities/composites`. Hai quyền mới: `energy.read`, mà mọi vai trò đều có, và `energy.write`, mà quản trị viên có. Có công cụ MCP mới cho từng cái. Trạm thời tiết là một miền thực thể mới, `weather`. Xem [API HTTP](/vi/iot/api/).

## Nâng cấp từ 4.22.1

Một lệnh `helm upgrade` bình thường. Các migration chạy ở lần khởi động đầu và thêm bảng; không có secret mới. Không có gì đang tắt được bật lên.

## Những gì chưa được kiểm chứng

- Các lệnh còn lại chưa được chạy với một bảng điều khiển thật.
- Thời tiết và năng lượng được chạy với bản ghi, một giàn Modbus và các bộ đếm mô phỏng của Emberburn, không phải với một trạm thật trên mái hay đồng hồ đo của một nhà máy.
- Mười ba danh mục ngôn ngữ mới được viết từ bảng thuật ngữ chung và chưa có người bản ngữ nào xem lại.
