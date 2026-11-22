---
title: "API của HotLoop Transmitter"
description: "Mọi đầu vào, đầu ra và phương thức của khối hàm publisher HotLoop Transmitter."
---

Mọi thứ nằm trong không gian tên `HLTX`. Khối là `HLTX.FB_HLTX_Publisher`.

## Đầu vào

| Đầu vào | Kiểu | Mặc định | Ý nghĩa |
|---|---|---|---|
| `bEnable` | BOOL | FALSE | TRUE mở socket và bắt đầu xuất bản. FALSE đóng nó và đưa khối về `Disabled`, đồng thời xóa `ConfigError` |
| `sDestination` | STRING(15) | `127.0.0.1` | địa chỉ IPv4 dạng chấm: một máy unicast, hoặc một nhóm multicast từ 224.0.0.0 đến 239.255.255.255 |
| `uiPort` | UINT | 4840 | cổng UDP đích. 4840 là cổng OPC UA đăng ký |
| `sLocalAddress` | STRING(15) | trống | chỉ multicast: địa chỉ của giao diện dùng để gửi. Để trống thì hệ điều hành chọn |
| `usiMulticastTTL` | USINT | 1 | multicast time to live |
| `uiPublisherId` | UINT | 1 | PublisherId, gửi dưới dạng UInt16 |
| `uiWriterGroupId` | UINT | 1 | WriterGroupId |
| `uiDataSetWriterId` | UINT | 1 | DataSetWriterId |
| `tPublishingInterval` | TIME | T#100MS | thời gian giữa các thông điệp. Tối thiểu T#1MS. Khối chỉ có thể gửi vào một chu kỳ, nên tốc độ thực là khoảng này làm tròn lên thành số nguyên chu kỳ của tác vụ gọi nó |
| `eEncoding` | `E_HLTX_Encoding` | `Variant` | `Variant` hoặc `RawData`. Đổi khi khối đang bị tắt |
| `udiGroupVersion` | UDINT | 1 | GroupVersion trong tiêu đề nhóm |
| `udiConfigMajor`, `udiConfigMinor` | UDINT | 1, 0 | ConfigurationVersion của DataSet. Tăng major mỗi khi danh sách trường thay đổi |
| `bTimestamp` | BOOL | TRUE | đóng dấu mỗi thông điệp bằng đồng hồ PLC, trong NetworkMessage và DataSetMessage (số giây nguyên, xem [Những gì đi trên đường truyền](/vi/transmitter/wire-format/)). FALSE gửi các byte của 1.0.0, ngắn hơn 17 byte |
| `tRetry` | TIME | T#2S | thời gian chờ trước khi mở lại socket sau mười lần gửi liên tiếp thất bại |

## Đầu ra

| Đầu ra | Kiểu | Ý nghĩa |
|---|---|---|
| `eState` | `E_HLTX_State` | `Disabled`, `Running`, `Backoff` (đang chờ mở lại socket) hoặc `ConfigError` (xem `eError`; không gửi gì) |
| `eError` | `E_HLTX_Error` | `None`, `NoFields`, `BadInterval`, `BadAddress`, `SocketCreate`, `SocketOption`, `TooBig`, `BadField` |
| `bActive` | BOOL | TRUE khi thông điệp đang đi ra |
| `udiSent` | UDINT | số thông điệp đã giao cho mạng |
| `udiSendErrors` | UDINT | số lần gửi bị hệ điều hành từ chối hoặc cắt ngang |
| `udiSkipped` | UDINT | số khe xuất bản bị lỡ vì tác vụ chạy trễ |
| `uiMessageSize` | UINT | số byte của thông điệp gần nhất |
| `diLastSocketResult` | UDINT | mã lỗi runtime gần nhất từ một lệnh gọi socket, 0 là bình thường |
| `diLastClockResult` | UDINT | kết quả gần nhất của việc đọc đồng hồ PLC để lấy dấu thời gian, 0 là bình thường. Khi khác 0, thông điệp đi ra không có dấu |
| `udiLastCallUs`, `udiMaxCallUs` | UDINT | số micro giây dùng trong lần gọi gần nhất của khối, và lâu nhất kể từ khi bật hoặc `Clear()` |
| `udiMaxEncodeUs`, `udiMaxSendUs` | UDINT | thời gian lâu nhất để dựng một thông điệp, và trong chính lệnh gọi gửi, kể từ khi bật hoặc `Clear()` |

## Phương thức

Thêm các trường một lần, trước lần gọi đầu tiên, theo thứ tự mà bên nhận cần đọc. Mỗi phương thức trả về TRUE khi trường được chấp nhận. Tối đa 128 trường.

| Phương thức | Thêm |
|---|---|
| `AddBool(pValue)`, `AddSInt`, `AddUSInt`, `AddInt`, `AddUInt`, `AddDInt`, `AddUDInt`, `AddLInt`, `AddULInt`, `AddReal`, `AddLReal`, `AddTime` | một giá trị vô hướng. `pValue` là `ADR(variable)` |
| `AddString(pValue, uiMaxLen)` | một STRING. `uiMaxLen` là N trong `STRING(N)` |
| `AddArray(pFirst, eType, uiCount)` | một mảng `uiCount` phần tử của bất kỳ kiểu nào trừ STRING. `pFirst` là `ADR(array[first])` |
| `AddField(pData, eType, uiCount, uiMaxLen)` | dạng tổng quát mà các phương thức khác gọi |
| `Clear()` | quên danh sách trường và thời gian gọi lâu nhất |

Khối giữ các địa chỉ bạn đưa, nên sau một thay đổi trực tuyến làm dời biến, hãy gọi `Clear()` và thêm lại các trường. WORD, DWORD và LWORD đi vào dưới dạng UINT, UDINT và ULINT qua phương thức cùng kích thước.

## Cách gọi

Gọi thực thể một lần mỗi chu kỳ từ một tác vụ. Đừng gọi một thực thể từ hai tác vụ. Nhiều publisher trong một chương trình là bình thường và mỗi cái có socket riêng; hãy cho mỗi cái writer group id và dataset writer id riêng.
