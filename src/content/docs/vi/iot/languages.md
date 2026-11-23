---
title: "Ngôn ngữ của giao diện web"
description: "Giao diện web có tiếng Anh và mười ba ngôn ngữ nữa, tiếng Ả Rập bố trí từ phải sang trái, chọn trên thanh trên cùng hoặc ở thẻ đăng nhập."
---

:::note[Có cả những gì sắp tới]
Trang này cũng nói về một vài thứ mới hơn HotLoop core 4.24.0, bản phát hành mới nhất. Một số phần có thể chưa có trong bản bạn đã cài. [Ghi chú phát hành](/vi/releases/) cho biết điều gì đã thay đổi.
:::

Giao diện web của HotLoop IoT, Edge và Gateway (và của HotLoop for CODESYS, chạy giao diện Edge) có tiếng Anh và 13 ngôn ngữ nữa: tiếng Tây Ban Nha (es), tiếng Pháp (fr), tiếng Ý (it), tiếng Đức (de), tiếng Na Uy Bokmål (nb), tiếng Bulgaria (bg), tiếng Hy Lạp (el), tiếng Hàn (ko), tiếng Nhật (ja), tiếng Việt (vi), tiếng Hindi (hi), tiếng Trung giản thể (zh-Hans) và tiếng Ả Rập (ar, bố trí từ phải sang trái).

Chọn một ngôn ngữ trong ô ngôn ngữ ở thanh trên cùng, hoặc ở thẻ đăng nhập. Lựa chọn được lưu trong trình duyệt này. Nếu chưa chọn gì, trang dùng ngôn ngữ đầu tiên trong danh sách của trình duyệt mà HotLoop có, và dùng tiếng Anh nếu không có ngôn ngữ nào khớp. Một ngôn ngữ chỉ xuất hiện trong danh sách chọn khi tệp của nó đã đầy đủ.

Những gì đi theo ngôn ngữ: mọi từ trên mọi màn hình, thứ tự và dấu của số (dấu phẩy thập phân trong tiếng Đức, Pháp và Tây Ban Nha), ngày và giờ (đồng hồ 24 giờ), các dạng số nhiều (tiếng Ả Rập có sáu) và chiều của trang. Tên sản phẩm và giao thức (HotLoop, Modbus, OPC UA, MQTT, Sparkplug, CODESYS, UniFi) giữ nguyên như đã viết. Các giá trị từ nhà máy, như tên tag, tên thiết bị, thông báo báo động do ai đó gõ và nội dung lỗi do máy chủ gửi về, được hiển thị đúng như vậy.

## Xây dựng cho những người dùng nó

* Mỗi màn hình được vẽ từ một thông điệp cho mỗi câu, nên một ngôn ngữ không bao giờ là nửa trang bằng chữ của nó và nửa trang bằng tiếng Anh. Một ngôn ngữ chỉ xuất hiện trong bộ chọn khi mọi màn hình đều đầy đủ.
* Dạng số nhiều theo quy tắc CLDR của Unicode cho từng ngôn ngữ, nên "1 thiết bị", "2 thiết bị" và sáu dạng của tiếng Ả Rập đều đọc đúng như người bản ngữ mong đợi.
* Số và ngày lấy từ cách định dạng của chính trình duyệt cho ngôn ngữ bạn chọn, nên người đọc Đức thấy 1.234,5 còn người đọc Mỹ thấy 1,234.5.
* Đổi ngôn ngữ vẽ lại mọi màn hình cùng lúc, không cần tải lại. Tiếng Anh là một phần của trang và được tải cùng nó; mỗi ngôn ngữ khác chỉ được tải khi có người chọn, nên một nhà máy chạy bằng một ngôn ngữ không bao giờ tải mười hai ngôn ngữ còn lại.
* Bố cục tự đảo chiều cho tiếng Ả Rập: lề, căn lề và khoảng cách đều đảo theo ngôn ngữ.

Một bài kiểm thử trình duyệt trong bộ đầy đủ chứng minh điều đó trên trang thật. Nó mở HotLoop ở từng ngôn ngữ với chiều rộng máy tính để bàn và điện thoại rồi đi qua mọi màn hình. Hướng đúng, không có gì cuộn ngang, không thông điệp nào hiện như chỗ giữ chỗ, các con số đọc theo cách của ngôn ngữ đó, và lựa chọn vẫn còn sau khi tải lại.

## Những gì không được dịch

* Văn bản do máy chủ gửi: thông báo lỗi từ API, thông báo và báo động, và CLI. Giao diện hiển thị chúng đúng như khi chúng đến.
* Tài liệu, tên của máy chủ OPC UA, MQTT broker và các giá trị của Helm chart.
