---
title: "Những gì đi trên đường truyền"
description: "NetworkMessage và DataSetMessage mà HotLoop Transmitter gửi, từng byte một, kèm các mục OPC 10000-14 và 10000-6 quy định từng thứ."
---

Mọi byte bên dưới đều lấy từ OPC 10000-14 (Phần 14, PubSub) phiên bản 1.05 và OPC 10000-6 (Phần 6, ánh xạ), đọc tại reference.opcfoundation.org ngày 2026-10-31. Số mục là nơi cần mở khi một byte trông có vẻ sai. Không có điều gì ở đây được biết bằng cách xem gói tin của nhà cung cấp khác.

Một khối publisher gửi một NetworkMessage mỗi khoảng xuất bản. Một NetworkMessage mang một DataSetMessage, là một Data Key Frame, nên mỗi thông điệp chứa mọi trường. Từ 1.1.0, mỗi thông điệp mang một dấu thời gian từ đồng hồ PLC, trong cả NetworkMessage lẫn DataSetMessage, trừ khi `bTimestamp` là FALSE, khi đó các byte đúng như 1.0.0. Các bảng hiển thị cả hai: những dòng đánh dấu có dấu chỉ xuất hiện khi dấu thời gian được bật.

Mọi giá trị nhiều byte đều là little endian, đúng như OPC UA binary định nghĩa; khối ghi chúng từng byte, nên thứ tự byte của máy chủ không quan trọng.

## NetworkMessage (Phần 14, 7.2.4.4.2)

| Byte | Giá trị | Ý nghĩa |
|---|---|---|
| 1 | `F1` | UADPVersion 1 ở bit 0 đến 3. UADPFlags ở bit 4 đến 7: PublisherId (bit 4), GroupHeader (bit 5), PayloadHeader (bit 6) và ExtendedFlags1 (bit 7), tất cả đều có |
| 1 | `21` có dấu, `01` không dấu | ExtendedFlags1: kiểu PublisherId 001 = UInt16 ở bit 0 đến 2, Timestamp (bit 5) khi có dấu. Không có DataSetClassId, không có tiêu đề bảo mật, không có PicoSeconds, không có ExtendedFlags2 |
| 2 | PublisherId | `uiPublisherId` |
| 1 | `0F` | GroupFlags: có WriterGroupId, GroupVersion, NetworkMessageNumber và SequenceNumber |
| 2 | WriterGroupId | `uiWriterGroupId` |
| 4 | GroupVersion | `udiGroupVersion` |
| 2 | NetworkMessageNumber | luôn là 1, vì 0 không hợp lệ |
| 2 | SequenceNumber | đếm số thông điệp đã gửi, quay về 0 sau 65535 |
| 1 | Count | luôn là 1 (tiêu đề tải, 7.2.4.5.2) |
| 2 | DataSetWriterId | `uiDataSetWriterId` |
| 8 | Timestamp, chỉ khi có dấu | Timestamp của NetworkMessage (7.2.4.4.2), một DateTime (Phần 6, 5.2.2.5): số nhịp 100 ns kể từ 1601-01-01 00:00:00 UTC dưới dạng Int64. Nó đứng sau tiêu đề tải và trước DataSetMessage |

Vì Count là 1, phần tải không có mảng Sizes. Khối không gửi thông điệp bị chia khúc, thông điệp khám phá, trường được nâng cấp hay tiêu đề bảo mật, và bên nhận đòi một trong những thứ đó sẽ không được phiên bản này phục vụ.

## DataSetMessage (Phần 14, 7.2.4.5.4 và 7.2.4.5.5)

| Byte | Giá trị | Ý nghĩa |
|---|---|---|
| 1 | `69` Variant, `6B` RawData; có dấu `E9` và `EB` | DataSetFlags1: hợp lệ (bit 0), mã hóa trường (bit 1 và 2: 00 Variant, 01 RawData), số thứ tự (bit 3), ConfigurationVersion major (bit 5) và minor (bit 6), và DataSetFlags2 (bit 7) khi có dấu. Không có Status. Khi không dấu, DataSetFlags2 cũng không có và kiểu là mặc định, một Data Key Frame |
| 1 | `10`, chỉ khi có dấu | DataSetFlags2: loại thông điệp 0 (Data Key Frame) ở bit 0 đến 3, Timestamp (bit 4) |
| 2 | Số thứ tự của DataSetMessage | đếm số thông điệp đã gửi, quay về 0 sau 65535 |
| 8 | Timestamp, chỉ khi có dấu | Timestamp của DataSetMessage (7.2.4.5.4), cùng DateTime với của NetworkMessage, đứng sau số thứ tự |
| 4 | ConfigurationVersion major | `udiConfigMajor` |
| 4 | ConfigurationVersion minor | `udiConfigMinor` |
| 2 | FieldCount | chỉ Variant. Bỏ qua với RawData (7.2.4.5.5) |
| ... | các trường | theo thứ tự đã thêm |

## Dấu thời gian

Khối đọc đồng hồ thời gian thực của PLC một lần mỗi thông điệp bằng `SysTimeRtcGet` (thư viện hệ thống SysTimeRtc, do runtime cung cấp), cho ra số giây nguyên kể từ 1970-01-01 UTC, và ghi `(seconds + 11644473600) * 10000000` làm DateTime. Cả hai dấu thời gian trong một thông điệp đều là giá trị duy nhất đó. Từ đó suy ra hai điều:

* Độ phân giải là một giây. Bên nhận thấy cùng một dấu thời gian trên mọi thông điệp trong vòng một giây, và nó trễ tới một giây so với thời điểm thông điệp được dựng. Dấu thời gian dưới một giây nằm trong lộ trình.
* Thời gian chỉ đúng bằng đồng hồ của PLC. Một bộ điều khiển chưa đặt đồng hồ sẽ đóng dấu thông điệp là 1970. Khi không đọc được đồng hồ (`diLastClockResult` khác 0), thông điệp đi ra không có dấu, điều mà Phần 14 cho phép, thay vì không đi ra.

Hãy tăng `udiConfigMajor` mỗi khi danh sách trường thay đổi. Khi đó một bên nhận giữ bố cục theo phiên bản có thể từ chối thông điệp dựng cho danh sách khác thay vì giải mã sai.

## Trường, mã hóa Variant (Phần 6, 5.2.2.16)

Mỗi trường là một byte EncodingMask, rồi đến giá trị. Bit 0 đến 5 của mặt nạ là id kiểu dựng sẵn (Phần 6, 5.1.2, bảng 1), và bit 7 cho biết giá trị là một mảng, khi đó số phần tử Int32 đứng trước các phần tử.

| Kiểu PLC | Id kiểu | Byte giá trị |
|---|---|---|
| BOOL | 1 Boolean | 1, `00` hoặc `01` |
| SINT | 2 SByte | 1 |
| USINT, BYTE | 3 Byte | 1 |
| INT | 4 Int16 | 2 |
| UINT, WORD | 5 UInt16 | 2 |
| DINT | 6 Int32 | 4 |
| UDINT, DWORD | 7 UInt32 | 4 |
| LINT | 8 Int64 | 8 |
| ULINT, LWORD | 9 UInt64 | 8 |
| REAL | 10 Float | 4, IEEE 754 |
| LREAL | 11 Double | 8, IEEE 754 |
| STRING | 12 String | độ dài Int32 tính bằng byte, rồi UTF-8 (5.2.2.4) |
| TIME | 7 UInt32 | mili giây, cách một TIME của CODESYS được lưu |

Một STRING của CODESYS lưu một byte cho mỗi ký tự. Các byte đến `7F` là ASCII và đi ra không đổi. Các byte trên `7F` được đọc như ISO 8859-1 và ghi dưới dạng UTF-8 hai byte. Đó là một giả định về bảng mã của PLC, và là nơi duy nhất khối diễn giải văn bản.

## Trường, mã hóa RawData (Phần 14, 7.2.4.5.11)

Không có mặt nạ và không có số đếm: mỗi trường chỉ là giá trị của nó, theo thứ tự, nên bên nhận phải biết bố cục. Phần 14 nói các trường được "handled like a Structure DataType", nên mỗi giá trị được mã hóa như một trường Structure trong Phần 6.

* **Giá trị vô hướng** là các byte giá trị như trong bảng Variant, không có mặt nạ.
* **Mảng** là số phần tử Int32 rồi đến các phần tử (Phần 6, 5.2.5: "One dimensional Arrays are encoded as a sequence of elements preceded by the number of elements encoded as an Int32 value"). Khối luôn gửi mọi phần tử được đưa vào, nên số đếm bằng kích thước khai báo của mảng và không có phần đệm phía sau.
* **Chuỗi** là độ dài Int32 tính bằng byte và các byte UTF-8, rồi các byte không đến MaxStringLength, nên trường luôn dài 4 + MaxStringLength byte (7.2.4.5.11: "the field shall be padded with bytes with value zero"). Khối dùng N của `STRING(N)` làm MaxStringLength, tính bằng byte. Văn bản dài hơn bị cắt ở ranh giới ký tự, vì trường không thể lớn thêm. Metadata trường của bên nhận phải mang cùng MaxStringLength và một mục ArrayDimensions cho mỗi mảng.

Đây là cách đọc của chính ngăn xếp tham chiếu của OPC Foundation. Trong UA-.NETStandard (commit `fcfc84eab5c105780d7268474a47d344d100aca1`), `src/Opc.Ua.PubSub/Encoding/Uadp/UadpBinaryReader.cs` dòng 389 đến 403 nói một chuỗi được "read like a Structure field (Int32 length prefix and value) from a fixed-size 4 + MaxStringLength byte block whose remainder is zero padding", và với mảng thì "the array's Part 6 length (or dimensions) prefix gives the actual element count and the block is padded to product(arrayDimensions) elements". `TryReadPaddedArray` ở dòng 593 đến 648 hiện thực điều đó, và `tests/Opc.Ua.PubSub.Tests/Encoding/Uadp/UadpRawDataPaddingTests.cs` khẳng định nó. [Trang bằng chứng](/vi/transmitter/proof/) có phần còn lại.

## Kích thước

Khối dựng thông điệp trong một bộ đệm 1472 byte: 1500 byte tải Ethernet trừ 20 của IP và 8 của UDP, nên thông điệp không bao giờ bị phân mảnh. Danh sách trường không vừa sẽ đưa khối vào `ConfigError` với lỗi `TooBig`; nó không cắt bớt. Một mảng REAL 250 phần tử ở mã hóa Variant là 1005 byte, nên một thông điệp gồm mảng đó cộng tiêu đề thì vừa, còn hai mảng thì không.
