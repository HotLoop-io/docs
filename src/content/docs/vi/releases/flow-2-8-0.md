---
title: "Ghi chú phát hành: HotLoop Flow 2.8.0"
description: "HotLoop Flow 2.8.0 có gì mới, điều gì thay đổi khi nâng cấp và nên đọc gì trước khi đụng vào một nhà máy đang chạy."
sidebar:
  label: "2.8.0"
---

HotLoop Flow 2.8.0 thêm bốn thứ vào FlowLab, tab sơ đồ cho bệ thử nghiệm và bộ ghi dữ liệu: các nút phân tích, một nút thu thập dữ liệu cho phần cứng NI, một đầu ra MQTT giữ lại những gì broker bỏ lỡ và một nhật ký TDMS. Các flow chạy đúng như trước, một tệp flow bạn có hôm nay được tải và lưu từng byte một, và một tab không phải sơ đồ không thấy gì trong số này.

## Có gì mới

**Phân tích.** Bốn nút làm việc trên một mảng số đọc: thống kê (trung bình, RMS, nhỏ nhất, lớn nhất và độ lệch chuẩn), tích phân (diện tích dưới mảng theo quy tắc hình thang, dưới dạng một số hoặc diện tích tích lũy), đạo hàm (độ dốc tại mỗi mẫu) và bộ lọc Butterworth bậc 1 đến 10 làm thông thấp, thông cao, thông dải hoặc chặn dải, với tần số cắt tính bằng hertz.

**Một nút thu thập dữ liệu.** `read DAQ task` đọc mẫu từ phần cứng NI, như khung CompactDAQ, qua gRPC Device Server của NI. Máy khách nhỏ hết mức có thể: HTTP/2 riêng của Go với các thông điệp viết tay, nên tệp nhị phân không phải mang thêm thư viện gRPC.

**Một đầu ra MQTT không mất gì.** `mqtt out` phát hành qua broker mà tệp flow cấu hình, cùng kết nối mà các nút MQTT dùng. Đánh dấu nó là bền, và thông điệp mà broker bỏ lỡ được ghi xuống đĩa trước khi nút kết thúc rồi được gửi, cái cũ nhất trước, khi broker quay lại, kể cả qua một lần khởi động lại. Không gì vượt lên trước những gì đang chờ phía trước. Đầu ra đã gửi của nó cho biết thông điệp có đi thẳng ra hay không.

**Một nhật ký TDMS.** `log to TDMS file` nối thêm một bản ghi vào tệp TDMS, mỗi trường một kênh, và tệp mở được trong các công cụ mà phòng thí nghiệm vốn có. Một tệp có lần ghi cuối bị cắt do mất điện vẫn đọc được đến giá trị nguyên vẹn cuối cùng.

## Có gì thay đổi

- Giờ có 28 loại nút trong mục FlowLab của bảng mẫu, tăng từ 21, và README có nói điều đó.
- Một bước từng thất bại một lần trong lần chạy 2.7.1 không in ra gì, và nguyên nhân là bài kiểm tra bộ thu thập so sánh một khoảng thời gian trước khi nhật ký nó đọc có đủ cả khoảng; giờ nó chờ đủ cả khoảng. Hai bài kiểm tra khác cũng được làm cho chờ những gì chúng kiểm tra. Không cái nào trong số đó được phát hành.
- Các hình trong README được chụp lại để thanh trên cùng ghi v2.8.0.
- Kích thước tệp nhị phân và ảnh trong README được đọc lại cho bản phát hành này.

## Cài đặt mới

Không có.

## Nâng cấp

Trên amd64, chỉ cần một lệnh `helm upgrade` lên ảnh và chart 2.8.0, hoặc tag mới trong đơn vị Quadlet của bạn. Trên arm64, hãy ở nguyên chỗ cho đến 2.8.1, là bản phát hành này có thêm arm64 và không gì khác. Không có gì xảy ra ở lần khởi động đầu và không cần di chuyển gì.

Image: `ghcr.io/hotloop-io/hotloop-flow:2.8.0`, chỉ linux/amd64. Chúng tôi dựng amd64 trước, để nó được xác nhận ổn định trong sản xuất, rồi một bản 2.8.1 nhỏ không có gì khác bổ sung arm64. Cho đến lúc đó, tag `2` giữ image amd64 mới và image arm64 từ 2.7.1, nên một máy arm64 theo `2` hoặc `2.7` giữ nguyên cái nó có, và một máy được ghim vào `2.8.0` cần amd64. Chart: `https://hotloop.io/hotloop-flow/`. README tại tag này có phần còn lại, kèm hình: https://github.com/HotLoop-io/hotloop-flow/blob/v2.8.0/README.md
