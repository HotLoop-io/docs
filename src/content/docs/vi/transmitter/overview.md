---
title: "HotLoop Transmitter: tổng quan"
description: "Thư viện CODESYS viết bằng Structured Text trên SysSocket UDP, xuất bản giá trị PLC dưới dạng OPC UA PubSub (UADP), không cần thư viện hay công cụ nào khác."
---

HotLoop Transmitter đưa giá trị của PLC lên mạng dưới dạng OPC UA PubSub, đúng như Phần 14 của đặc tả OPC UA quy định, từ một thư viện bạn thêm vào dự án CODESYS. Nó là bộ truyền theo nghĩa của vòng đo lường: phần đặt giá trị quá trình lên đường truyền để thiết bị khác đọc được.

Thư viện viết bằng Structured Text trên `SysSocket` UDP, không cần thư viện nào khác, không cần giấy phép bổ sung và không cần công cụ cấu hình. Bạn thêm thư viện, gọi một khối hàm mỗi chu kỳ, và một UADP NetworkMessage sẽ đi ra ở mỗi khoảng xuất bản, tới một địa chỉ unicast hoặc một nhóm multicast.

Điều này có nghĩa là: một PLC không có thư viện PubSub vẫn có thể cấp dữ liệu cho mọi thứ đăng ký OPC UA PubSub, kể cả chính HotLoop, chỉ với vài dòng Structured Text. Mỗi thông điệp mang dấu thời gian từ đồng hồ của PLC, trừ khi bạn tắt bằng `bTimestamp`.

## Vì sao là Structured Text mà không phải Go

Mọi công cụ HotLoop mới đều viết bằng Go, trừ khi có lý do thực sự. Đây là lý do thực sự: nó phải chạy trong chính chu kỳ quét của PLC, trong runtime IEC 61131-3, như một thư viện mà lập trình viên tham chiếu từ dự án của mình. Runtime CODESYS chạy Structured Text, không chạy Go. Các bài kiểm tra và công cụ quanh thư viện (công cụ ghi gói, công cụ xác minh) viết bằng Go.

## Cách dùng

1. Cài `HotLoopTransmitter-1.3.0.library` vào kho thư viện của CODESYS (Tools, Library Repository, Install), hoặc cài `HotLoopTransmitter-1.3.0.package` bằng CODESYS Installer, rồi thêm vào Library Manager của dự án. [Trang cài đặt](/vi/transmitter/install/) có các bản tải và chi tiết.
2. Khai báo một publisher, thêm các biến muốn xuất bản một lần lúc khởi động, rồi gọi nó mỗi chu kỳ:

```iecst
PROGRAM PLC_PRG
VAR
    pub : HLTX.FB_HLTX_Publisher;
    bInit : BOOL;
END_VAR

IF NOT bInit THEN
    bInit := TRUE;
    pub.sDestination := '239.0.0.22';        // a unicast host or a multicast group
    pub.uiPort := 4840;
    pub.uiPublisherId := 1;
    pub.uiWriterGroupId := 1;
    pub.uiDataSetWriterId := 1;
    pub.tPublishingInterval := T#100MS;
    pub.AddReal(ADR(GVL.rTemperature));
    pub.AddBool(ADR(GVL.bRunning));
    pub.AddArray(ADR(GVL.aValues), HLTX.E_HLTX_Type.REAL_T, 250);
END_IF
pub.bEnable := TRUE;
pub();
```

[Trang API](/vi/transmitter/api/) liệt kê mọi đầu vào, đầu ra và phương thức. [Trang định dạng trên đường truyền](/vi/transmitter/wire-format/) mô tả gói tin từng byte một, kèm các mục của đặc tả quy định từng byte.

## Nó làm gì và không làm gì với chu kỳ quét của bạn

* Không bao giờ chặn. Socket không chặn, và thông điệp được dựng trong một bộ đệm cố định.
* Chi phí một lần gọi là chi phí dựng một thông điệp, và chỉ phải trả ở những chu kỳ có thông điệp đi ra. Đo trên một tác vụ 20 ms với hai publisher và bật dấu thời gian: trung bình thêm khoảng 9,6 us mỗi chu kỳ, 10 đến 100 us ở những chu kỳ có gửi, và chu kỳ dài nhất trong lần chạy là 81 us. Một máy chủ bận từng kéo một lần gửi lên tới vài mili giây. Số liệu đo được và giới hạn của chúng nằm ở [trang thời gian](/vi/transmitter/timing/).
* Lỗi socket, địa chỉ sai hay danh sách trường quá lớn không bao giờ làm ứng dụng bị lỗi. Khối báo một `eState` và một `eError`, đếm lỗi, và chương trình vẫn tiếp tục quét.
* Nó không phân mảnh. Một thông điệp tối đa 1472 byte. Danh sách trường không vừa sẽ đưa khối vào `ConfigError` và không gửi gì.

## Đã kiểm thử với

Runtime CODESYS Control for Linux SL 4.22.0.0, và trên phần cứng không có hệ điều hành (2026-11-17). Xem [trang thời gian](/vi/transmitter/timing/) và [trang bằng chứng](/vi/transmitter/proof/) để biết đã chạy gì và đọc lại gì.

Dùng ở nhà máy? [Dùng HotLoop trong doanh nghiệp](/vi/business/) nói về giấy phép và cách liên hệ với chúng tôi.

## Giấy phép

HotLoop Source License Agreement 1.0, giống mọi sản phẩm HotLoop. Miễn phí sử dụng và mở mã nguồn để xem, không phải mã nguồn mở theo OSI, và mục 5 cho phép bạn tích hợp thư viện vào dự án PLC của riêng mình rồi giao hoặc bán kết quả đã biên dịch, không bao giờ là chính thư viện. [Trang giấy phép](https://hotloop.io/license/) có toàn văn.
