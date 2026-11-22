---
title: "HotLoop for CODESYS: tổng quan"
description: "HotLoop bên cạnh runtime CODESYS: màn hình và cảnh báo cho PLC CODESYS, đọc qua máy chủ OPC UA của chính runtime, không cài gì trong CODESYS."
sidebar:
  label: "Tổng quan"
editUrl: false
---

HotLoop for CODESYS là HotLoop chạy trên cùng một nút với runtime CODESYS. Nó đọc biến của PLC qua máy chủ OPC UA của chính runtime, đưa chúng lên các màn hình chạy được trên panel PC, điện thoại hoặc màn hình treo tường, phát cảnh báo trên chúng và giữ lịch sử. Không có gì được cài trong CODESYS và không có gì ghi vào PLC. Đó là màn hình mà bạn lẽ ra phải dựng trong CODESYS WebVisu, nhưng được vẽ bên ngoài runtime. Bạn được gì: người vận hành có màn hình mà không phải tải gì xuống PLC, và PLC có thêm một đôi mắt thứ hai không phụ thuộc vào thứ gì khác trên nút.

Đây là một trong tám sản phẩm HotLoop và có dòng phát hành riêng. Chart mới nhất là 0.3.8, xuất bản ngày 2026-11-16. Bên dưới là HotLoop Edge, nên mọi điều trên [các trang Edge](/vi/edge/overview/) cũng đúng ở đây.

![Màn hình Line 2: bốn thẻ giá trị, một đồng hồ, xu hướng mười lăm phút và danh sách cảnh báo](/codesys/screen.png)
![Cùng màn hình, ở chế độ tối](/codesys/screen-dark.png)

Đó là một lần chạy thật: giao diện mặc định của HotLoop đọc một runtime CODESYS Control for Linux SL 4.22.0.0. Chương trình PLC là chương trình demo của chính HotLoop nên các con số là của demo. Các nhãn (Line 2, Mixer temperature, Riverside Bottling) là bịa ra và do [hồ sơ](/vi/codesys/profile/) đặt vào.

## Ba phần

| Phần | Là gì | Nằm ở đâu |
|---|---|---|
| Chart `hotloop-codesys` | Lớp bọc quanh `hotloop-edge` với mặc định cho runtime trên một nút: SQLite, một replica và tắt những phần không cần bên cạnh PLC. Mọi bản sửa chart của HotLoop đều đến được đây. | `https://hotloop.io/hotloop-codesys/` |
| Provisioner | Một tệp nhị phân Go tĩnh áp hồ sơ vào HotLoop và giữ cho nó đúng. Nó không giữ hồ sơ nào. | `ghcr.io/hotloop-io/hotloop-provision` |
| Hồ sơ | Một tệp JSON: thiết bị, các biến cần giữ, các cảnh báo và một màn hình. Đầu vào duy nhất bạn cung cấp. | Một Secret trong namespace của bản cài, [mô tả tại đây](/vi/codesys/profile/) |

## Cách nó đọc PLC

CODESYS chỉ tài liệu hóa một cách để bên thứ ba đọc biến của bộ điều khiển, đó là máy chủ OPC UA của chính runtime. PLC công bố những gì bạn muốn xem bằng Symbol Configuration trong IDE, và HotLoop đọc các biến đó theo tên mà lập trình viên đặt, như `Application.GVL_Line.rTemp`, không theo node id. Symbol Configuration là thay đổi duy nhất trong dự án PLC. Giao thức kênh của CODESYS Gateway không được tài liệu hóa cho bên thứ ba, và sản phẩm này không dùng nó.

Việc đọc do trình kết nối CODESYS của HotLoop core thực hiện, tức là driver OPC UA cộng với những gì PLC CODESYS cần thêm: khám phá những gì ứng dụng xuất ra và các kiểu nó có, mảng và cấu trúc được duyệt thành một điểm cho mỗi trường, tự kết nối lại sau khi khởi động lại hoặc tải xuống, và mọi yêu cầu được cắt theo giới hạn mà runtime công bố. [Trang giao thức](/vi/iot/protocols/) có tài liệu tham khảo của trình kết nối từ HotLoop 4.19.4 trở đi, và nói rõ nó đã được kiểm chứng với gì và chưa với gì.

## Nó tự làm gì

Khi HotLoop và runtime của nút đều trả lời, provisioner thiết lập thiết bị của hồ sơ, các biến, cảnh báo và màn hình. Sau đó nó xem lại mỗi năm phút. Một biến của hồ sơ mà PLC có thêm sau đó sẽ được thêm vào. Một biến PLC không còn sẽ được đọc là xấu kèm lý do của máy chủ. Màn hình và cảnh báo được tạo khi còn thiếu và chỉ được thay khi `revision` của hồ sơ cao hơn bản đã tạo ra chúng, nên thay đổi do người làm vẫn giữ nguyên cho đến khi một hồ sơ mới hơn được cố ý phát hành.

## Nó sẽ không làm gì

- **Nó sẽ không ghi vào PLC của bạn.** Mọi tag provisioner thiết lập đều chỉ đọc, và hồ sơ không đánh dấu tag nào là ghi được. Sau này một người có thể kích hoạt một tag, và khi đó [cổng ghi](/vi/gateway/write-gate/) và quyền symbol của chính PLC đều có tiếng nói.
- **Nó sẽ không đặt gì vào runtime.** Không thư viện, không tác vụ, không agent.
- **Nó không cần pod cơ sở dữ liệu.** SQLite trên bộ nhớ riêng của nút, một replica.
- **Nó được xây để giữ màn hình khi mất liên kết.** Cả hai pod chịu được nút không truy cập được hoặc chưa sẵn sàng mà không giới hạn thời gian, và các dung sai nằm trong chart. [Hiện trạng](/vi/codesys/where-it-stands/) nói đã chạy gì trên một nút thật.

## Đi tiếp đâu

[Cài đặt](/vi/codesys/install/), đọc xem một [hồ sơ](/vi/codesys/profile/) chứa gì, hoặc xem [hiện trạng](/vi/codesys/where-it-stands/) và [lộ trình](/vi/codesys/roadmap/). Dùng ở nhà máy? [Dùng HotLoop trong doanh nghiệp](/vi/business/) nói về giấy phép và cách liên hệ với chúng tôi.
