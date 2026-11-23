---
title: "Ghi chú phát hành: HotLoop core 4.23.3"
description: "HotLoop core 4.23.3 có gì mới, điều gì thay đổi khi nâng cấp và nên đọc gì trước khi đụng vào một nhà máy đang chạy."
sidebar:
  label: "4.23.3"
---

Một màn hình WebVisu giữ lại việc ẩn và các màu cảnh báo của nó khi được chuyển sang, và mọi ký hiệu trên mọi màn hình giờ có thể được hiện và tô màu bởi một quy tắc trên một tag. Một bản sửa nhỏ cho danh sách sao lưu đi kèm. Chỉ build cho amd64; bản build đa kiến trúc theo sau ở phiên bản kế tiếp.

## Có gì thay đổi

- **Một ký hiệu có thể được hiện và tô màu bởi quy tắc.** `show` chỉ vẽ một ký hiệu khi một quy tắc trên một tag còn đúng, nên một cánh cửa, một tấm chắn hay một máy bơm vẽ cho một trạng thái chỉ có mặt ở trạng thái đó. `colors` là tối đa bốn quy tắc, mỗi quy tắc có một sắc (`ok`, `warn`, `bad` hoặc `info`): quy tắc đầu tiên đúng sẽ tô ký hiệu bằng sắc đó, và khi không quy tắc nào đúng thì nó được vẽ như trước. Một quy tắc là một tag và một phép so sánh (`on`, `off`, `eq`, `ne`, `gt`, `ge`, `lt`, `le`). Một quy tắc có tag chưa có số đọc tốt thì không đúng với gì và không ẩn gì, nên mất kết nối không bao giờ làm một ký hiệu biến mất. Biểu mẫu ký hiệu trong trình dựng có cả hai, và một tệp màn hình liệt kê và di chuyển các tag của quy tắc cùng với phần còn lại. Xem [Bảng điều khiển](/vi/iot/dashboards/).
- **Việc nhập màn hình CODESYS mang theo Invisible và Toggle color.** Biến Invisible của một phần tử (và của nhóm của nó) trở thành quy tắc `show`, với `NOT x` đảo nó lại, và biến Toggle color của nó trở thành quy tắc `colors` ở sắc gần nhất với màu cảnh báo của chính phần tử. Chúng được tìm thấy ở các id mà chính cây phần tử của CODESYS IDE đưa ra. Những gì nó không mang được sẽ được nói trong lần nhập, kèm biến: hai thứ này trên một hình vẽ vào ảnh nền (đường ống, bình chứa, khung), vì ảnh là một hình duy nhất, và mọi thiết lập khác do biến điều khiển (tô màu, màu khung hay chữ, chuyển động, nhấp nháy, danh sách văn bản). Xem [Import a CODESYS screen](/vi/iot/codesys-screen-import/).
- **Danh sách sao lưu không còn thất bại khi một bản sao lưu đang được dọn.** Bản sao lưu theo lịch dọn các bản cũ trong goroutine riêng của nó, và một lần liệt kê rơi vào giữa chừng thất bại vì tệp bị mất, điều mà API trả lời là lỗi máy chủ. Một bản sao lưu đã mất giờ được bỏ ra khỏi danh sách.

## Migration

Không có.

## Thay đổi API

Cấu hình của một ký hiệu nhận `show` và `colors`. Không route nào thay đổi. Xem [API HTTP](/vi/iot/api/).

## Nâng cấp từ 4.23.2

Chỉ cần `helm upgrade` thông thường. Không di chuyển dữ liệu và không có secret mới. Một biểu tượng không có quy tắc nào được vẽ như trước.

## Những gì chưa được kiểm chứng

- Việc nhập CODESYS được chứng minh với bản xuất của chính IDE về một visualization và biến nhóm của ví dụ Refrigerator của CODESYS. Một màn hình từ dự án khác có thể liệt kê nhiều hơn những gì nó không đặt được.
- Các quy tắc ký hiệu mới được chứng minh bằng các bài kiểm thử của bộ kiểm thử, không phải trên màn hình của một nhà máy.
