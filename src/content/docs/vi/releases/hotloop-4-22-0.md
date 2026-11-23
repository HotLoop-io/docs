---
title: "Ghi chú phát hành: HotLoop core 4.22.0"
description: "HotLoop core 4.22.0 có gì mới, điều gì thay đổi khi nâng cấp và nên đọc gì trước khi đụng vào một nhà máy đang chạy."
sidebar:
  label: "4.22.0"
---

Một màn hình mở dưới dạng panel (`/?screen=<name>`) giờ lấp đầy màn hình của nó từ mép này đến mép kia ở mọi kích thước, màn hình Alarms có thể nhập tệp cảnh báo CODESYS, và một số bản sửa. Chỉ build cho amd64; bản build đa kiến trúc theo sau ở phiên bản kế tiếp.

## Có gì thay đổi

- **Một trang panel lấp đầy màn hình của nó.** Ở 1920x1080, 1366x768 và 3840x2160 nó phủ kín màn hình không còn khoảng trống. Nó có tiêu đề với tên nhà máy, trạng thái Live cho biết bao nhiêu thiết bị đang trực tuyến và đồng hồ 24 giờ kèm ngày. Các con số và đồng hồ đo lớn lên theo màn hình, và trục cùng chú giải của xu hướng cũng vậy. Chỉ trang panel thay đổi; các bảng điều khiển như cũ, còn thẻ, kích thước và tên của khách hàng là của họ.
- **Màn hình Alarms nhập tệp Export Alarms của CODESYS.** Chỉ dành cho quản trị viên: chọn thiết bị, đặt tên ứng dụng, chọn tệp, đọc bản xem trước về những gì được chuyển sang và những gì không, rồi nhập. Route API đã có sẵn.
- **Các thiết bị OPC UA PubSub trên cùng một địa chỉ và cổng dùng chung một socket.** Thiết bị thứ hai không bao giờ bind được, và các tùy chọn dùng lại chia datagram của một publisher giữa chúng.
- **Các phản hồi chậm không còn chồng lên nhau.** Một thẻ camera chậm hơn lần làm mới của nó giờ hiện hình ảnh của nó, các thẻ và màn hình UniFi chỉ hỏi lại sau phản hồi cuối, một lô khám phá đã thất bại một lần sẽ được thử lại, và một thiết bị SNMP theo tên host giữ thời gian chờ phản hồi riêng của nó.
- **Các sản phẩm lõi nằm dưới HotLoop Free Use License 1.0.** Các phiên bản trước giữ điều khoản mà chúng được công bố. Xem NOTICE.
- **Biểu tượng App Store** trên các trang chart là biểu trưng của HotLoop.

## Thay đổi API

Không có.

## Nâng cấp từ 4.21.1

Một lệnh `helm upgrade` bình thường. Không có migration, không có secret mới, không có gì không hoàn tác được.

## Đã kiểm thử

Trang panel được kiểm tra trong thử nghiệm ở ba kích thước trên, với Emberburn cấp dữ liệu cho một Gateway.
