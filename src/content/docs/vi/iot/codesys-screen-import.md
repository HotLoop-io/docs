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
| Biến **Invisible** của một phần tử (`bInvisible`), hoặc của nhóm của nó | một quy tắc `show` trên ký hiệu: nó chỉ được vẽ khi biến cho biết phần tử sẽ hiển thị (`NOT x` đảo lại) |
| Biến **Toggle color** của một phần tử | một quy tắc `colors` trên ký hiệu: khi biến bật, nó được tô bằng tông gần nhất với màu báo động riêng của phần tử (đỏ là `bad`, vàng và cam là `warn`, xanh dương là `info`, xanh lá là `ok`; một phần tử không có màu báo động riêng là `bad`, vì khung báo động mặc định của CODESYS màu đỏ) |

Mỗi phần tử giữ nguyên vị trí theo điểm ảnh: trang là thẻ biểu tượng, được vẽ như một hình được co giãn, nên màn hình giữ nguyên hình dạng ở mọi kích thước và trên điện thoại.

## Những gì không được chuyển sang

Được nêu trong lúc nhập, mỗi thứ một dòng, không bao giờ bị bỏ lặng lẽ:

* một loại phần tử không có biểu tượng HotLoop (đồ thị vết, bảng, thanh trượt, phần tử hình ảnh và phần còn lại của hộp công cụ),
* một biến là biểu thức (`Temp * 2`, `a AND b`, một phần tử mảng): HotLoop hiển thị một tag, nên hãy thêm một tag cho biểu thức và trỏ một ô hiển thị vào đó,
* một biến ẩn hoặc đổi màu trên một hình được vẽ vào ảnh nền (một đường ống, một bình chứa, một khung): ảnh nền là một hình duy nhất, nên hình luôn ở đó và giữ màu của nó. Được nêu trong kết quả nhập, kèm biến,
* mọi cài đặt khác do giá trị PLC điều khiển (biến màu cho phần tô, khung hoặc chữ, một chuyển động, một lần nhấp nháy, một danh sách văn bản): ký hiệu vẫn ở đó như đã vẽ, và quy tắc được báo cáo khi biến của nó là biến đơn giản,
* đường cong Bézier được vẽ thành các đoạn thẳng giữa các điểm của nó, và phần tử bị xoay không được xoay,
* kích thước trang, thứ mà tệp xuất không chứa: trang lớn bằng phần tử ngoài cùng cộng thêm lề,
* chữ dài hơn 40 ký tự bị cắt, và các mặt số là con số, không phải mặt số.

Kiểu chữ, phông chữ và màu của phong cách CODESYS là của HotLoop: màn hình theo giao diện của HotLoop.

## Cách nó đọc tệp

CODESYS ghi tài liệu rằng bản xuất gốc tồn tại và là XML, nhưng không ghi trong đó có gì. Bộ đọc ở đây theo những gì chính IDE ghi ra (CODESYS 3.5 SP22, Visualization 4.10): mỗi phần tử lưu cài đặt của nó dưới dạng danh sách các thành viên có đánh số, và số đó là CRC-32 của đường dẫn thành viên trong mô tả của phần tử, chẳng hạn `m_StaticPosition.iX`, mà IDE cài đặt ngay bên cạnh nó. Các cây phần tử của chính IDE liệt kê mọi đường dẫn kèm id của nó (`ITypeNode.CompletePath` và `CRCIdNumber`); các id của biến ẩn (`m_pStateVariables..State.bInvisible`, 2880254039) và biến đổi màu (`m_pColorVariables..ToggleColor`, 1999528970) lấy từ đó, và id đầu là id mà ví dụ Refrigerator của CODESYS dùng để lưu `NOT Glob_Var.DoorOpen` của nhóm nó. Các bài kiểm thử chứa giá trị đọc từ bản xuất của chính IDE. Một cài đặt mang biến mà không đọc được sẽ được báo cáo như trên, nên một màn hình không bao giờ được nhập như đầy đủ khi nó không đầy đủ.

## Bước tiếp theo

Mở màn hình, đối chiếu các ô hiển thị với nhà máy, và đặt các thẻ giá trị đặt và thẻ nút ở nơi người vận hành của bạn mong đợi. Một màn hình bạn dựng bằng tay và một màn hình bạn nhập là như nhau từ đây: nó xuất ra thành [tệp màn hình](/vi/iot/screen-file/), có phiên bản mới mỗi lần lưu, và chuyển sang bản cài đặt khác theo cùng cách.

## Hình hiển thị TwinCAT (.TcVIS)

Một tệp `.TcVIS` của TwinCAT là cùng hình hiển thị đó trong XML lưu trữ đối tượng của IDE, với cùng các loại phần tử và cùng id thành viên, nên nó đi qua cùng bộ chuyển đổi. Đã kiểm tra với ví dụ PackML thật của TwinCAT.

- Nút: mỗi phép gán đơn giản trong hành động đầu vào của một nút (`X := 5`, `X := TRUE`, `X := E_PMLCommand.ePMLCommand_Start`) trở thành một thẻ nút ghi giá trị đó vào X, và chú thích được chuyển sang làm nhãn. Một đầu vào Toggle đã cấu hình trở thành cặp nút bật và tắt. Mã nhiều hơn một phép gán (một điều kiện, một lời gọi, phép tính) được báo cáo cùng văn bản của nó.
- Kiểu liệt kê: các thành viên OMAC PackML (`E_PMLCommand`, `E_PMLUnitMode`) đã được biết, với các số từ cấu hình PackML_HMI_Example của Beckhoff và khai báo `E_PMLUnitMode` của SPT-Libraries. Mọi kiểu liệt kê khác đi vào `enums` của lần nhập (`{"E_Own.eOwn_Go": 7}`). Một thành viên không có số đã biết được ghi bằng tên của nó và báo cáo nói rõ điều đó.
- Biểu thức: biến của một đèn và một biến ẩn có thể là phép so sánh một tag với một số, TRUE, FALSE hoặc một thành viên kiểu liệt kê (`=`, `<>`, `<`, `<=`, `>`, `>=`), NOT, AND và OR, có dấu ngoặc. Chúng trở thành một quy tắc của ký hiệu (xem DASHBOARDS.md: quy tắc `lit` của đèn, các quy tắc `show` và `colors` của ký hiệu, có thể kết hợp quy tắc bằng `all` và `any`). Phép so sánh hai tag, phép tính và các lời gọi không thể diễn đạt và được báo cáo cùng phần không làm được.
- Khung: một khung hiển thị một hình hiển thị khác. Hãy gửi các tệp khác của dự án cùng với tệp đầu tiên (`codesysRelated` trong API; trong hộp thoại, chọn nhiều tệp và tệp đầu là màn hình). Hình hiển thị của khung được đặt vào trong khung, với mỗi đầu vào nó nhận được gắn với biến được trao cho khung (`HMI` của V_Module trở thành `MAIN.VFFSDemo.Sealer.PackMLBaseModule_HMI`). Một khung có hình hiển thị không nằm trong các tệp được báo cáo cùng tên của nó.

Bộ PackML (V_Main cùng V_Module và V_MachineModule): 60 phần tử được ánh xạ, không có phần tử nào chưa ánh xạ.
