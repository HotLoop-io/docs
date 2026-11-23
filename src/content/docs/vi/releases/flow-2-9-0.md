---
title: "Ghi chú phát hành: HotLoop Flow 2.9.0"
description: "HotLoop Flow 2.9.0 có gì mới, điều gì thay đổi khi nâng cấp và nên đọc gì trước khi đụng vào một nhà máy đang chạy."
sidebar:
  label: "2.9.0"
---

HotLoop Flow 2.9.0 thêm các nút kết nối gốc cho việc di chuyển một nhà máy thật. Nó chạy các nút Node-RED mà flow của một nhà máy dựa vào, Modbus, bảng điều khiển, PostgreSQL và e-mail, cùng với `Buffer` và `setInterval` mà các nút hàm xung quanh gọi. Một flow lấy từ một máy Node-RED có dùng chúng sẽ được tải, chạy và lưu mà không đổi gì. Nó cũng cho phép một Flow giữ một tab cho mỗi máy trên một thiết bị mà cổng duy nhất mang một VLAN cho từng máy, ngay cả khi mọi VLAN có cùng mạng con và cùng địa chỉ thiết bị.

## Có gì mới

- **Modbus của Node-RED.** `modbus-client`, `modbus-read`, `modbus-getter`, `modbus-flex-getter`, `modbus-write`, `modbus-flex-write`, `modbus-server` và `modbustcp-server` thụ động. Đầu ra giống những gì các nút cộng đồng gửi: `msg.payload` là danh sách giá trị, `msg.responseBuffer` là `{data, buffer}`, `msg.input`, và lỗi ra cổng ra thứ hai.
- **Bảng điều khiển.** `ui_base`, `ui_tab`, `ui_group`, `ui_link`, `ui_spacer`, `ui_text`, `ui_numeric`, `ui_button`, `ui_switch`, `ui_text_input`, `ui_led`, `ui_gauge`, `ui_chart` và `ui_template`, được phục vụ tại `/ui` từ chính tệp nhị phân, không tải gì từ ngoài nhà máy. Những gì người vận hành làm trên trang đi ra từ nút dưới dạng thông điệp. `ui_template` chạy tập con kiểu AngularJS mà các nhà máy dùng: `{{ }}`, `ng-click`, `ng-class`, `ng-init`, `ng-show`, `ng-hide`, `ng-if`, `ng-bind`, `scope.$watch`, `scope.send`.
- **PostgreSQL.** `postgreSQLConfig` và `postgresql`. Kết nối mở ở truy vấn đầu tiên, nên một cơ sở dữ liệu chưa chạy không làm flow dừng.
- **E-mail.** Nút đầu ra `e-mail` qua SMTP, với STARTTLS, công tắc chứng chỉ và XOAUTH2.
- **`Buffer`, `setInterval` và `setTimeout` trong nút hàm.** Các bộ hẹn giờ chạy theo đồng hồ của nút, mỗi hàm gọi lại có cùng giới hạn CPU như một thông điệp, và mọi bộ hẹn giờ được dọn khi flow dừng hoặc được triển khai lại.
- **Một giao diện mạng cho mỗi máy khách.** Một nút, một tab hoặc một cấu hình máy khách có thể chỉ định giao diện mà các kết nối của nó gắn vào (`SO_BINDTODEVICE`), nên tab cho máy sấy 14 chỉ tới được `192.168.1.5` của VLAN 14. Với tab, đó là biến môi trường `FLOW_NETWORK_INTERFACE` trên tab, mà mọi nút máy khách trong đó đều thừa hưởng. Nó có ở các nút Modbus, PostgreSQL, e-mail, yêu cầu TCP, đầu ra UDP và yêu cầu HTTP.

README có thêm một phần mới, `docs/node-red-types.md` nói cái gì chạy và khác ở đâu, và `docs/compatibility.md` được tạo lại từ sổ đăng ký.

## Có gì thay đổi

- Nút hàm từng cố ý không có `Buffer`, `setTimeout` và `setInterval`, và hai bài kiểm tra giữ điều đó. Giờ chúng đã có, vì các hàm của một nhà máy dùng đến. Phần còn lại của môi trường cô lập không đổi: vẫn không có `require`, không có `process` và không có thư viện chuẩn của Node.
- Khi chưa đặt hook, nó hoạt động như upstream. NOTICE và `HOTLOOP_PATCH.txt` nói điều gì đã đổi.
- Lý do là các nút kết nối Node-RED gốc cho việc di chuyển một nhà máy thật.

## Cài đặt mới

- `HOTLOOP_FLOW_UI_PATH`, mặc định `/ui`: nơi phục vụ bảng điều khiển.
- `FLOW_NETWORK_INTERFACE`, một biến môi trường của tab, luồng con hoặc tiến trình: giao diện mà các máy khách của tab đó gắn vào. Mặc định trống, để máy chủ chọn, như trước.
- Một trường **Giao diện mạng** trên mỗi nút máy khách và cấu hình.
- Giá trị chart `bindToInterface.netRaw`, mặc định `false`. Gắn một socket vào một giao diện không cần capability trên Linux 5.7 trở lên. Trên kernel cũ hơn cần `CAP_NET_RAW`, và đặt giá trị này thành `true` thêm đúng capability đó vào pod và không gì khác. Pod cũng cần mạng của host (`network.mode: host`) để thấy một giao diện VLAN.

## Nâng cấp

Chỉ cần một lệnh `helm upgrade` lên ảnh và chart 2.9.0, hoặc tag mới trong đơn vị Quadlet của bạn. Không có gì xảy ra ở lần khởi động đầu, không cần di chuyển gì, và một flow không dùng kiểu mới nào vẫn chạy như trước. Một flow đã có sẵn các kiểu này (một tệp Node-RED đã lấy về) giờ sẽ khởi động chúng, thay vì báo từng cái là kiểu nút không xác định như trước.

## Thay đổi trong NOTICE và giấy phép

NOTICE có thêm mục của thư viện Modbus, giờ là một bản sao đã sửa. Không có mô-đun bên thứ ba mới nào trong ảnh.

Ảnh: `ghcr.io/hotloop-io/hotloop-flow:2.9.0`, linux/amd64 trước, arm64 theo sau trong 2.9.1. Chart: `https://hotloop.io/hotloop-flow/`. README ở tag này có phần còn lại, kèm hình ảnh: https://github.com/HotLoop-io/hotloop-flow/blob/v2.9.0/README.md
