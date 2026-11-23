---
title: "Ghi chú phát hành: HotLoop core 4.23.4"
description: "HotLoop core 4.23.4 có gì mới, điều gì thay đổi khi nâng cấp và nên đọc gì trước khi đụng vào một nhà máy đang chạy."
sidebar:
  label: "4.23.4"
---

Việc nhập màn hình đi từ CODESYS sang TwinCAT. Một tệp `.TcVIS`, và các bản xuất của cds-text-sync và codescribe, đến như một màn hình HotLoop cùng các nút, khung và đèn của chúng, và những gì không chuyển sang được sẽ được liệt kê kèm văn bản của chúng trước khi lưu bất cứ thứ gì.

## Có gì thay đổi

- **Màn hình TwinCAT được nhập.** Một tệp TwinCAT `.TcVIS` là cùng visualization đó trong XML lưu trữ của IDE, nên nó đi qua bộ chuyển đổi của CODESYS. Đã kiểm tra với ví dụ TwinCAT PackML thật (ba màn hình, MIT, giấy phép giữ bên cạnh): 60 phần tử được ánh xạ, không cái nào chưa ánh xạ. Xem [Import a CODESYS screen](/vi/iot/codesys-screen-import/).
- **Nút.** Mọi phép gán đơn giản trong hành động đầu vào của một nút (`X := 5`, `X := TRUE`, một thành viên của enumeration) trở thành một thẻ nút ghi giá trị đó, với chú thích làm nhãn. Một đầu vào Toggle được cấu hình trở thành một nút bật và một nút tắt. Mã nhiều hơn một phép gán (điều kiện, lời gọi, số học) được báo cáo kèm văn bản của nó. Các enumeration OMAC PackML đã biết; mọi cái khác đi vào `enums` của lần nhập, và một thành viên chưa biết số được ghi theo tên và có nói rõ.
- **Đèn và ẩn bằng một biểu thức.** Biến của một đèn hoặc một biến ẩn có thể là phép so sánh một tag với một số, TRUE, FALSE hoặc một thành viên enumeration, nối bằng NOT, AND và OR cùng dấu ngoặc. Phép so sánh hai tag, số học và lời gọi không thể mang sang và được báo cáo.
- **Khung.** Một khung hiển thị một visualization khác. Hãy gửi các tệp khác của dự án cùng với tệp đầu tiên (`codesysRelated`; trong hộp thoại, chọn nhiều tệp và tệp đầu là màn hình) và visualization của khung được đặt vào khung với mỗi đầu vào được gắn với biến đã đưa cho khung.
- **Quy tắc ký hiệu kết hợp được.** Một quy tắc `show` hoặc `colors` có thể là `{"all": [...]}` hoặc `{"any": [...]}`, AND và OR của một PLC, sâu ba cấp và tám phần, và một tag bị mất làm `all` không đúng trong khi `any` đúng nhờ các tag còn lại. Một đèn có thể mang quy tắc `lit` thay cho tag của nó. Xem [Bảng điều khiển](/vi/iot/dashboards/).
- **Kiểm thử.** Bài kiểm thử đồng hồ năng lượng giới hạn những gì các đồng hồ đã đếm theo thời gian thực sự đã trôi qua, không phải mười giây cố định.

## Migration

Không có.

## Thay đổi API

`POST /api/dashboards/import` nhận `codesysRelated` và `enums` bên cạnh `codesys`. Không route nào thay đổi. Xem [API HTTP](/vi/iot/api/).

## Nâng cấp từ 4.23.3

Một lệnh `helm upgrade` bình thường. Không có migration và không có secret mới.

## Những gì chưa được kiểm chứng

- Các trình nhập được chứng minh với ví dụ TwinCAT PackML và các bản xuất mẫu của cds-text-sync và codescribe, không phải với dự án riêng của khách hàng. Một dự án dùng nhiều ngôn ngữ visualization hơn sẽ liệt kê nhiều hơn những gì nó không đặt được.
- Biểu thức là các phép so sánh một tag với một hằng số nối bằng NOT, AND và OR. Mọi thứ khác được báo cáo, không đoán.
