---
title: "Ghi chú phát hành: HotLoop core 4.23.6"
description: "HotLoop core 4.23.6 có gì mới, điều gì thay đổi khi nâng cấp và nên đọc gì trước khi đụng vào một nhà máy đang chạy."
sidebar:
  label: "4.23.6"
---

Các ô trong lộ trình cho Protect, Access và hộp nguồn có mã, thiết bị Shelly nói chuyện trực tiếp với Shelly, và OPC UA PubSub có bảo mật thông điệp và metadata. Chỉ build cho amd64; bản build đa kiến trúc theo sau ở phiên bản kế tiếp.

## Có gì thay đổi

- **UniFi Protect, dưới dạng thiết bị.** Giao thức `unifi-protect`, với một khóa API từ trang Integrations của bảng điều khiển, được niêm phong như mật khẩu bảng điều khiển và với chứng chỉ được ghim. Camera, cảm biến, đèn và còi là các tag tự thêm vào. Chuyển động và các phát hiện thông minh của camera (người, phương tiện, kiện hàng, biển số, khuôn mặt, động vật) đến từ websocket sự kiện và được đọc là xấu khi nó ngừng, không bao giờ là «không có chuyển động». Còi có thể được kích hoạt để phát, và `alarm.<trigger>.fire` gửi webhook của trình quản lý cảnh báo để một cảnh báo của HotLoop làm các camera ghi hình. Ảnh chụp của một camera là một route. Mọi sự kiện đều có trong logbook. Xem [UniFi Network](/vi/iot/unifi/#unifi-protect).
- **UniFi Access, dưới dạng thiết bị.** Giao thức `unifi-access`, với một token API. Vị trí và khóa của mỗi cửa là các tag, được websocket thông báo giữ luôn cập nhật, và mọi thay đổi đều có trong logbook. Mở khóa là một lần ghi mà một người kích hoạt, qua cổng ghi, có kiểm toán. Xem [UniFi Network](/vi/iot/unifi/#unifi-access).
- **Ổ cắm của SmartPower PDU.** Rơ-le, công suất, dòng điện, điện áp và hệ số công suất của một ổ cắm là các tag của thiết bị UniFi Network, và tổng điện năng tiêu thụ của một PDU là một tag. Ghi `on` vào một ổ cắm sẽ bật nó và giữ tên của mọi ổ cắm khác; `cycle` tắt nó, chờ, rồi bật lại, tối đa một lần mỗi 15 phút, và luôn kết thúc ở trạng thái bật. Xem [UniFi Network](/vi/iot/unifi/#ổ-cắm-của-pdu-smartpower).
- **Một thiết bị Shelly.** Giao thức `shelly`: RPC từ Gen2 trở lên với đăng nhập digest riêng của thiết bị, tag cho mọi thành phần nó báo cáo, các lần ghi cho một switch, một đèn, một rèm và một bộ điều nhiệt. Gen1 bị từ chối với một thông báo đưa nó về MQTT.
- Các phản hồi DataSetMetaData và khám phá, theo từng phần khi lớn, đọc từ các thông điệp được ghi lại của một publisher Siemens. Publisher thông báo metadata của nó cứ mười khoảng một lần theo mặc định (`HOTLOOP_UADP_PUBLISH_METADATA_EVERY`, 0 để tắt). Xem [Giao thức và driver](/vi/iot/protocols/).
- **Bộ xả hàng đợi chuyển tiếp nhìn lại, và nói khi nó thất bại.** Một lượt không gửi gì trong khi số đọc đang chờ từng chờ một cú huých mà một vòng thăm dò im lặng không bao giờ gửi, và một lượt thất bại lùi nửa phút mà không có dòng nào trong log.
- **Các bài kiểm thử chờ đúng thứ chúng đang chờ.** Sáu bài kiểm thử năng lượng chờ số đọc của giàn thay vì một khoảng sleep cố định.

- **Một thiết bị Modbus im lặng được đọc là xấu ở mọi điểm.** Trên đường serial, một yêu cầu hết hạn dùng hết hạn chót của vòng thăm dò, nên chỉ khối đầu tiên bị xấu và mọi điểm sau đó giữ giá trị tốt cuối của chúng chừng nào cáp còn bị rút. Giờ một thiết bị không trả lời gì sẽ đánh dấu mọi điểm là xấu ngay trong cùng một vòng thăm dò. Xem [Giao thức và driver](/vi/iot/protocols/).
- **Các tính năng đã hoàn thiện được phát hành ở trạng thái bật.** Trong Helm chart và trong binary: broker MQTT tích hợp (các login của nó được tạo trong HotLoop), máy chủ OPC UA (xác thực bật, với login `opcua-reader` được tạo mà Settings hiển thị cho quản trị viên), báo cáo theo lịch, bản sao lưu cục bộ hằng ngày (mỗi 24 giờ, volume 5 Gi), ServiceMonitor (chỉ được render ở nơi có CRD của operator Prometheus, nên cluster không có chúng vẫn cài như trước), và một Ingress không có hostname, trả lời mọi host mà lớp phục vụ cho đến khi `ingress.hosts[0].host` được đặt. Báo cáo, bản sao lưu, chứng chỉ OPC UA và hàng đợi edge mặc định dùng một thư mục ghi được dưới thư mục dữ liệu của HotLoop, và một cổng mà dịch vụ khác đã giữ sẽ ở trạng thái nhàn rỗi và nói điều đó. Các chart `hotloop` và các chart IoT và Edge được tạo ra đều mang nó.
- **Các kênh cảnh báo và publisher của edge được bật, và chờ một đích.** Các kênh webhook, email, ntfy, Gotify, Discord webhook và bot Discord, cùng `edgePublish`, được bật từ lần khởi động đầu. Một kênh không có nơi gửi không còn làm dừng việc cài đặt hay khởi động: nó chờ và nói điều đó. Quản trị viên nhập từng đích trong Settings, «Where alarms and readings go», và những gì lưu ở đó thắng giá trị của chart. Các kênh cảnh báo áp dụng khi lưu; đích của publisher edge áp dụng ở lần khởi động lại kế tiếp. Settings cũng có một thẻ máy chủ OPC UA với endpoint và login được tạo.
- **Đích Kafka chờ một broker đặt một topic mới.** Một broker đơn mà một host bận cô lập trong chốc lát từng làm lần nhìn đầu thất bại với `INVALID_REPLICATION_FACTOR`; giờ đích chờ cho đến khi hết thời gian của nó và nói broker đã trả lời gì.
- **Bộ xả hàng đợi chuyển tiếp nhìn lại, và nói khi nó thất bại.** Một lượt không gửi gì trong khi số đọc đang chờ từng chờ một cú huých mà một vòng thăm dò im lặng không bao giờ gửi, và một lượt thất bại lùi nửa phút mà không có dòng nào trong log.

- **Mang sang từ 4.23.4 và 4.23.5.** Màn hình TwinCAT `.TcVIS` và của cds-text-sync và codescribe được nhập cùng các nút, khung, đèn và quy tắc biểu thức của chúng, và làm mới màn hình UniFi chờ chế độ xem đang tải. Cả hai phiên bản đều chưa được công bố, nên cả hai nằm ở đây. Xem [4.23.4](/vi/releases/hotloop-4-23-4/) và [4.23.5](/vi/releases/hotloop-4-23-5/).

## Migration

Không có.

## Thay đổi API

`GET /api/unifi-protect/{id}/cameras/{camera}/snapshot` trả về JPEG hiện tại của camera. Danh sách giao thức có `unifi-protect` và `unifi-access`. Xem [API HTTP](/vi/iot/api/).

## Nâng cấp từ 4.23.5

Một lệnh `helm upgrade` bình thường. Không có migration và không có secret mới. 4.23.4 và 4.23.5 đã được gắn tag và các lần chạy phát hành của chúng thất bại ở job kiểm thử trước khi có gì được công bố, nên bản phát hành cuối trước bản này là 4.23.3, và bản này mang các thay đổi của cả hai. Một tệp values đặt bất kỳ tính năng nào ở trên vẫn thắng; đặt một cái là `false` và nó không render listener, Service, volume hay Ingress.

## Những gì chưa được kiểm chứng

- Protect, Access và các ổ cắm của PDU được xây dựng từ các API đã công bố và đối chiếu với các bảng điều khiển thay thế có giữ trạng thái. Chưa cái nào từng ở trên bảng điều khiển hay PDU thật, nên các ô của chúng trong lộ trình chưa được đánh dấu.
- Ảnh chụp đính kèm vào thông báo cảnh báo chưa được xây dựng.
- PubSub: Security Key Service chưa được xây dựng (khóa là tĩnh), và chưa publisher Siemens, CODESYS hay Beckhoff nào từng ở trên bàn thử.
- Việc tắt cổng UniFi vẫn chờ yêu cầu từ giao diện web của một bảng điều khiển 10.6 thật.
