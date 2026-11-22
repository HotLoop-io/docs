---
title: "Kiểm thử hiệu năng"
description: "Thời gian khởi động, bộ nhớ, thông lượng và độ trễ đo được của Flow trên máy tính để bàn và Raspberry Pi 5, những con số này không phải là gì và cách chạy lại."
---

Chỉ có số liệu tuyệt đối. Một bảng so sánh song song thay đổi mỗi khi hộp thay đổi, và rốt cuộc mô tả thứ kia nhiều hơn thứ này.

Flow phản hồi khoảng 15.000 yêu cầu mỗi giây trên máy tính để bàn và khoảng 13.000 mỗi giây trên Raspberry Pi 5, với dưới 30 MiB bộ nhớ trên máy tính để bàn và 42 MiB trên Pi. Đó là toàn bộ ý nghĩa của một công cụ chạy luồng đủ nhỏ cho chiếc hộp trên sàn nhà máy.

## Luồng

Năm nút: một điểm cuối HTTP, ba lần chỉnh sửa thuộc tính, một phản hồi. Không có gì trong đó nhanh một cách cố ý. Đó là hình dạng của một luồng thật nhỏ, đúng là thứ mà một bài kiểm thử hiệu năng của công cụ chạy luồng cần nói tới. Bộ tạo tải chạy vòng kín: mỗi máy khách gửi yêu cầu tiếp theo khi yêu cầu trước quay về, nên nó đo thứ mà đầu bên kia có thể tiếp nhận và không thể tạo ra độ trễ gây hiểu lầm mà bộ tạo tải vòng hở báo cáo khi mục tiêu bị tụt lại.

## Tự chạy thử

`hotloop-flow bench` có sẵn trong tệp nhị phân. `-launch` khởi động tệp nhị phân, đo thời gian cho tới khi luồng phản hồi (khởi động nguội), đọc bộ nhớ thường trú của tiến trình hai giây sau đó (nhàn rỗi), rồi lấy mẫu nó trong suốt lúc tải và giữ lại mức đỉnh. `-target` không kèm `-launch` điều khiển một bản đang chạy sẵn, một container hay một pod, qua HTTP, để đo thông lượng và độ trễ.

```bash
hotloop-flow bench -mode http -launch ./hotloop-flow -target http://127.0.0.1:18897 -path /bench -duration 30s -warmup 5s -connections 8
hotloop-flow bench -mode engine -chain 5 -messages 200000
```

## Kết quả

Đo trên một máy tính để bàn x86 (24 CPU), với tệp nhị phân tĩnh gốc, mỗi loại ba lần chạy.

| <span class="sr-only">Chi tiết</span> | Lần chạy 1 | Lần chạy 2 | Lần chạy 3 |
|---|---|---|---|
| Khởi động nguội | 0.05 s | 0.05 s | 0.05 s |
| RSS, nhàn rỗi | 16.7 MiB | 16.7 MiB | 16.4 MiB |
| RSS, đỉnh khi có tải | 26.4 MiB | 26.4 MiB | 28.5 MiB |
| Thông lượng HTTP | 15.0k req/s | 15.3k req/s | 13.0k req/s |
| Độ trễ HTTP p50 / p95 / p99 | 0.39 / 1.22 / 1.82 ms | 0.39 / 1.20 / 1.78 ms | 0.41 / 1.49 / 4.03 ms |
| Công cụ, mỗi tin nhắn | 2.61 µs | 3.11 µs | 2.20 µs |
| Công cụ, bộ nhớ cấp phát mỗi tin nhắn | 3,868 bytes | 3,869 bytes | 3,868 bytes |

## Kết quả trên Raspberry Pi 5

Đo trên một Raspberry Pi 5 8 GB, xung nhịp giới hạn ở 2.0 GHz, chạy như một pod trên k3s, không có gì khác trên nút. Cùng một luồng, ba lần chạy, mỗi lần trong một pod mới.

| <span class="sr-only">Chi tiết</span> | Lần chạy 1 | Lần chạy 2 | Lần chạy 3 |
|---|---|---|---|
| Khởi động nguội | 0.46 s | 0.15 s | 0.10 s |
| RSS, đỉnh khi có tải | 40.3 MiB | 40.5 MiB | 40.3 MiB |
| Thông lượng HTTP | 13.2k req/s | 13.4k req/s | 13.3k req/s |
| Độ trễ HTTP p50 / p95 / p99 | 0.48 / 1.45 / 2.78 ms | 0.48 / 1.42 / 2.72 ms | 0.48 / 1.44 / 2.74 ms |
| Công cụ, mỗi tin nhắn | 8.15 µs | 7.74 µs | 7.89 µs |

Giữ trong 600 giây, cùng lệnh đó trên cùng bo mạch ổn định ở 11.4k req/s với p50 là 0.58 ms và p99 là 3.00 ms. Bo mạch chạy với một tản nhiệt trần không có quạt và bị giảm xung khi tải nhiều như vậy, nên đó là con số trung thực cho một hộp luôn có tải.

### Những con số này không phải là gì

**Thông lượng HTTP bao gồm cả ngăn xếp HTTP.** Có chủ đích: đó là điều một máy khách của luồng bạn trải nghiệm. Nó không phải số đo của bộ lập lịch. Các hàng của công cụ thì có, không có I/O nào trên đường đi.

**Một dạng luồng, một cỡ nội dung, một mức đồng thời.** Một luồng có I/O thật, một lần phát MQTT hay một lần ghi cơ sở dữ liệu, bị I/O đó chi phối. Những con số này là chi phí riêng của môi trường chạy, không phải lời hứa cho mọi khối lượng công việc.

**Phần đuôi dao động nhiều hơn trung vị.** Khi bão hòa mọi thứ xếp hàng và hàng đợi quyết định p99. Trung vị là nơi chi phí xử lý một yêu cầu lộ ra.

**Đây là luồng đo hiệu năng, không phải dây bền vững.** Không có gì ở đây đo kho lưu trữ phía sau một dây bền vững hay việc ghi lên thẻ SD.

## Bộ nhớ

RSS là bộ nhớ thường trú của chính tiến trình, đọc từ `/proc`. Nó không phải điều `podman stats` báo cáo, vốn cho thấy phần kernel tính cho container và có thể thấp hơn nhiều so với những gì tiến trình thực sự giữ.