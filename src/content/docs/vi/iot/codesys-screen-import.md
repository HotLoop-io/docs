---
title: "Nhập màn hình CODESYS"
description: "Xuất một trực quan hóa CODESYS từ IDE và nhập nó thành màn hình HotLoop trên các biến của PLC, với các phần tử không đặt được liệt kê trước tiên."
---

Người vận hành của bạn đã có sẵn một màn hình CODESYS. Hãy xuất nó từ IDE, nhập vào HotLoop, và nó mở ra như một màn hình HotLoop trên các biến của cùng PLC đó. Đây là con đường rời khỏi WebVisu: PLC vẫn chạy chương trình của nó, HotLoop đọc nó qua trình kết nối OPC UA, và màn hình thuộc về HotLoop. HotLoop for CODESYS chạy Edge, nên đây cũng là phần nhập của nó.

## Cách dùng

Trong CODESYS IDE, chọn trực quan hóa trong cây dự án và dùng **Project, Export** (kiểu xuất gốc của CODESYS, một tệp `.export`). Không phải **Export PLCopenXML**: tệp đó không có trực quan hóa nào, và HotLoop sẽ báo như vậy nếu bạn chọn nó.

Trên màn hình Bảng điều khiển, chọn **Nhập**, chọn tệp `.export`, rồi **Đọc tệp**. Nó cho bạn biết:

* trực quan hóa mà nó tìm thấy (tệp có nhiều trực quan hóa sẽ hỏi bạn chọn cái nào),
* mọi tag mà màn hình đọc mà bản cài đặt này chưa có. Các biến đến dưới dạng `plc/<GVL>.<variable>`: ánh xạ thiết bị `plc` tới thiết bị HotLoop mà PLC đang nối vào và mọi tag chuyển cùng lúc, hoặc ánh xạ từng tag một,
* **đáng xem lại**: mọi phần tử nó không đặt được lên màn hình, kèm lý do, trước khi lưu bất cứ thứ gì.

Không có gì được lưu cho đến khi không còn gì vướng. Việc nhập cần `dashboards.write`, và một nút hay một giá trị đặt trên tag không được đánh dấu là ghi được sẽ bị từ chối ở đây, giống như khi dựng màn hình, nên màn hình không bao giờ có một điều khiển mà cổng sẽ từ chối.

Qua API là `POST /api/dashboards/import` với `codesys` (nội dung của tệp) thay cho `file`, và `visualization` để chọn một trong nhiều:

```json
{"codesys": "<ExportFile>...", "visualization": "Overview", "dryRun": true,
 "remap": {"devices": {"plc": "line-3"}}}
```

Báo cáo có các mục quen thuộc `problems`, `warnings` và `remapped`, cùng một `conversion` với `mapped` (mỗi phần tử và nó đã trở thành gì) và `unmapped` (mỗi phần tử và vì sao không).

## Những gì được chuyển sang

| Phần tử CODESYS | Trong HotLoop |
|---|---|
| Hình chữ nhật, hình chữ nhật bo góc, hình elip có chữ và một biến (`Temperature: %2.1f C`) | một ô hiển thị: tag của biến, chữ đứng trước làm chú thích, chữ đứng sau làm đơn vị, số thập phân lấy từ định dạng |
| Giống như trên với chữ và không có biến | một nhãn |
| Đèn | một đèn, sáng theo biến và tô bằng màu riêng của đèn (đỏ là sự cố, vàng là cảnh báo, xanh dương là thông tin, màu khác là đèn chạy). `NOT x` đọc tag theo chiều ngược lại |
| Đồng hồ đo, biến trở | một ô hiển thị của biến. Một núm xoay từng đặt giá trị còn có thêm thẻ giá trị đặt với thang chia của mặt số làm giới hạn |
| Công tắc bập bênh, công tắc gạt, nút nhấn | một đèn hiển thị trạng thái và một thẻ nút: bật và tắt cho công tắc gạt, một giá trị duy nhất cho một lần chạm |
| Đa giác, đường gấp khúc và các hình không có chữ và không có biến (đường ống, bình chứa, khung) | hình nền phía sau các biểu tượng, vẽ từ các điểm và màu của chúng |
| Nhóm | các thành viên của nó, đặt từ góc của nhóm |

Mỗi phần tử giữ nguyên vị trí theo điểm ảnh: trang là thẻ biểu tượng, được vẽ như một hình được co giãn, nên màn hình giữ nguyên hình dạng ở mọi kích thước và trên điện thoại.

## Những gì không được chuyển sang

Được nêu trong lúc nhập, mỗi thứ một dòng, không bao giờ bị bỏ lặng lẽ:

* một loại phần tử không có biểu tượng HotLoop (đồ thị vết, bảng, thanh trượt, phần tử hình ảnh và phần còn lại của hộp công cụ),
* một biến là biểu thức (`Temp * 2`, `a AND b`, một phần tử mảng): HotLoop hiển thị một tag, nên hãy thêm một tag cho biểu thức và trỏ một ô hiển thị vào đó,
* một quy tắc hiển thị, màu sắc hoặc chuyển động do giá trị PLC điều khiển: biểu tượng có mặt suốt và không đổi màu,
* đường cong Bézier được vẽ thành các đoạn thẳng giữa các điểm của nó, và phần tử bị xoay không được xoay,
* kích thước trang, thứ mà tệp xuất không chứa: trang lớn bằng phần tử ngoài cùng cộng thêm lề,
* chữ dài hơn 40 ký tự bị cắt, và các mặt số là con số, không phải mặt số.

Kiểu chữ, phông chữ và màu của phong cách CODESYS là của HotLoop: màn hình theo giao diện của HotLoop.

## Cách nó đọc tệp

CODESYS ghi tài liệu rằng bản xuất gốc tồn tại và là XML, nhưng không ghi bên trong có gì. Trình đọc ở đây theo những gì chính IDE ghi ra (CODESYS 3.5 SP22, Visualization 4.10): mỗi phần tử lưu các thiết lập của nó dưới dạng danh sách các thành viên được đánh số, và số đó là CRC-32 của đường dẫn thành viên trong mô tả của phần tử, chẳng hạn `m_StaticPosition.iX`, thứ mà IDE cài bên cạnh nó. Các bài kiểm thử chứa các giá trị đọc từ chính bản xuất của IDE. Một thiết lập mang biến mà không được đọc sẽ được báo như trên, nên một màn hình không bao giờ được nhập như thể đầy đủ khi nó chưa đầy đủ.

## Bước tiếp theo

Mở màn hình, đối chiếu các ô hiển thị với nhà máy, và đặt các thẻ giá trị đặt và thẻ nút ở nơi người vận hành của bạn mong đợi. Một màn hình bạn dựng bằng tay và một màn hình bạn nhập là như nhau từ đây: nó xuất ra thành [tệp màn hình](/vi/iot/screen-file/), có phiên bản mới mỗi lần lưu, và chuyển sang bản cài đặt khác theo cùng cách.
