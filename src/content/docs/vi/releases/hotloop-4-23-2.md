---
title: "Ghi chú phát hành: HotLoop core 4.23.2"
description: "HotLoop core 4.23.2 có gì mới, điều gì thay đổi khi nâng cấp và nên đọc gì trước khi đụng vào một nhà máy đang chạy."
sidebar:
  label: "4.23.2"
---

Một màn hình CODESYS giờ được chuyển sang thành màn hình HotLoop, hộp báo cáo sức khỏe của chính nó cho bảng điều khiển EmberNet, và một đồng hồ năng lượng có thể mang phí công suất. Đây cũng là một đợt quét sạch các lỗi của bộ kiểm thử trên các node chậm, mỗi cái là một lần chờ hoặc một race thật đã được sửa. Chỉ build cho amd64; bản build đa kiến trúc theo sau ở phiên bản kế tiếp.

## Có gì thay đổi

- **Một visualization của CODESYS được nhập thành một màn hình.** Xuất nó từ IDE (Project, Export, tệp `.export` gốc, không phải PLCopenXML), và Import của màn hình Dashboards đọc nó như một màn hình HotLoop trên các biến của PLC. Mọi tag mà màn hình đọc mà bản cài này thiếu được liệt kê, kèm ánh xạ thiết bị, và mọi phần tử HotLoop không đặt được được liệt kê kèm lý do trước khi lưu bất cứ thứ gì. Một nút hoặc giá trị đặt trên tag không ghi được bị từ chối, giống như một lần build. Xem [Import a CODESYS screen](/vi/iot/codesys-screen-import/).
- **Sức khỏe của hộp cho bảng điều khiển EmberNet.** Một thiết bị đặt theo tên node Kubernetes publish mức dùng CPU, bộ nhớ, đĩa và volume dữ liệu của hộp, cùng độ jitter thời gian thực của ba lõi khi một agent ghi tệp cho nó. Các giá trị không đọc được có chất lượng xấu kèm lý do, không bao giờ là không. Máy chủ OPC UA phục vụ lịch sử của chúng. Xem [máy chủ OPC UA](/vi/edge/opc-ua-server/#tình-trạng-máy-cho-bảng-điều-khiển-embernet) và [Giao thức và driver](/vi/iot/protocols/#tình-trạng-máy).
- **Một đăng nhập chỉ đọc được và không làm gì khác.** Một bản triển khai có thể tạo một tài khoản với đúng `tags.read` và `values.read` (`HOTLOOP_READER_USER` và `HOTLOOP_READER_PASSWORD_HASH`). Chart tạo `embernet-dashboard-read` ở lần cài đầu, giữ mật khẩu của nó trong Secret `<release>-opcua-dashboard` và không bao giờ xoay nó khi nâng cấp.
- **Chứng chỉ của bảng điều khiển được tin cậy từ một Secret.** Chart mount `<release>-opcua-trust` (tùy chọn) và máy chủ OPC UA giữ thư mục tin cậy của nó đồng bộ: một chứng chỉ mới được thêm trong vòng 30 giây, chứng chỉ rời khỏi Secret bị gỡ, và một tệp do người vận hành đặt bằng tay không bao giờ bị đụng tới. Máy chủ vẫn chỉ nhận Basic256Sha256 SignAndEncrypt, không có phiên ẩn danh, không tin tất cả. Service của bản phát hành giờ liệt kê cổng 4840 khi máy chủ bật.
- **Năng lượng: phí công suất và các ca.** Một đồng hồ tính bằng Wh, kWh hoặc MWh nhận `demand_price`, mức giá của một kilowatt trong khoảng một phần tư giờ cao nhất của nó trong một cửa sổ, và bản tóm tắt cho thấy đỉnh, khi nó bắt đầu và bao nhiêu phần của phần tư giờ đó đã được đọc. Một ca là một cửa sổ, `shift:06:00-14:00` cho ca mới nhất đã bắt đầu và `last_shift:06:00-14:00` cho ca trước đó. Màn hình Energy có ô Shift và giá công suất, bằng cả mười ba ngôn ngữ.
- **Chi phí trên mỗi đơn vị sản xuất không còn được đọc là miễn phí.** Khi đã sản xuất ra thứ gì và chưa có đồng hồ có giá nào đếm mức tiêu thụ, câu trả lời là không có, kèm lý do `nothing_counted`, không phải không.
- **Các runtime CODESYS khi kiểm thử, được ghi lại.** Máy chủ OPC UA của một runtime thật được làm cho an toàn bằng các lệnh shell của PLC mà CODESYS ghi tài liệu, và một lần đọc Basic256Sha256 SignAndEncrypt được chứng minh với nó. Một cảnh báo thật kích hoạt, được xác nhận và xóa theo những gì một PLC đang chạy báo cáo. Những gì một thiết bị làm khi cửa sổ dùng thử hai giờ của runtime không có giấy phép kết thúc được ghi lại, kèm script dòng thời gian. Đó là các bài kiểm thử và ghi chú trong [Giao thức và driver](/vi/iot/protocols/); driver không thay đổi.
- **Các bản sửa mà bộ kiểm thử tìm thấy.** Bộ máy năng lượng không còn đọc một đồng hồ khi nó đang bị xóa hoặc thay đổi (cơ sở dữ liệu gỡ deadlock bằng cách làm lần xóa thất bại). Manifest của một bản sao lưu được ghi dưới tên tạm và đổi tên tại chỗ, nên một danh sách không bao giờ thấy nửa tệp. Việc bắt kịp của historian chờ cho đến khi ghi xong mọi thứ tới một mốc. Phần còn lại là các bài kiểm thử giờ chờ đúng những gì chúng khẳng định, trên node đang tải, thay vì một số giây cố định.

## Tình trạng hộp được bật theo mặc định

Chart mount gốc của host tại `/host` và `/proc` của nó tại `/host/proc`, cả hai chỉ đọc, và không thêm đặc quyền nào: chỉ đọc một statfs cùng các bộ đếm CPU và bộ nhớ. Một cluster áp dụng hồ sơ restricted của Pod Security từ chối hostPath. Ở đó hãy đặt `opcuaServer.dashboard.boxHealth.enabled: false` (không thiết bị, không mount) hoặc `hostMount: false` (thiết bị, với đĩa và CPU của hộp được đọc là xấu và nói cần mount gì). Drop-in Quadlet là `deploy/quadlet/opcua-dashboard.conf`.

## Migration

Một cái, và chỉ bổ sung: `0030_energy_demand` (một cột `demand_price` trên đồng hồ và các thùng của chúng, mặc định 0, nên không gì đã được đếm hoặc tính giá thay đổi). Một bản sao lưu lấy trên 4.23.1 khôi phục được ở đây, còn bản lấy ở đây không khôi phục được lên bản phát hành cũ hơn.

## Thay đổi API

`demand_price` trong biểu giá của đồng hồ năng lượng, khối `demand` trong một hàng tóm tắt, `shift:` và `last_shift:` làm kỳ năng lượng, và `reason` trên `cost_per_unit` khi nó là null. `POST /api/dashboards/import` nhận `codesys` và `visualization` thay cho `file`, và báo cáo của nó mang một `conversion`. Xem [API HTTP](/vi/iot/api/).

## Nâng cấp từ 4.23.1

Một lệnh `helm upgrade` bình thường. Migration chạy ở lần khởi động đầu. Chart tạo tài khoản chỉ đọc và Secret của nó ở lần cài đầu của phiên bản này và không bao giờ xoay nó; không gì đã có trên hộp thay đổi.

## Những gì chưa được kiểm chứng

- Các phần tử nó không biết được liệt kê và để ngoài, không bao giờ đoán, và một màn hình từ dự án khác có thể liệt kê nhiều hơn.
- Các tag jitter thời gian thực cần một agent ghi tệp, và bản phát hành này không cài agent nào.
- Đăng nhập chỉ đọc và việc tin cậy chứng chỉ được chứng minh với chính client của HotLoop. Phía bảng điều khiển EmberNet là bản phát hành riêng của nó.
- Endpoint bảo mật của CODESYS được chứng minh khi kiểm thử trên một phiên bản runtime. Driver của HotLoop không thay đổi vì nó, và không có màn hình thiết lập endpoint bảo mật nào là một phần của bản phát hành này.
- Phí nhu cầu được kiểm với các số đọc đã ghi, không phải với hóa đơn của một công ty điện.
