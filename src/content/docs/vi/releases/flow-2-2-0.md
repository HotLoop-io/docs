---
title: "Ghi chú phát hành: HotLoop Flow 2.2.0"
description: "HotLoop Flow 2.2.0 có gì mới, điều gì thay đổi khi nâng cấp và nên đọc gì trước khi đụng vào một nhà máy đang chạy."
sidebar:
  label: "2.2.0"
---

HotLoop Flow 2.2.0 là bản phát hành mà Flow nói chuyện với các PLC, nhớ những gì nó biết khi khởi động lại và cho bạn thấy một thông điệp đã đi đâu. Đây cũng là bản đầu tiên theo Business Source License của HotLoop, và tôi đặt điều đó lên đầu vì đó là phần bạn phải đọc.

## Giấy phép đã đổi

2.2.0 và mọi bản phát hành sau nó theo Business Source License 1.1 của HotLoop, cùng giấy phép với phần còn lại của HotLoop. Đó không phải là giấy phép nguồn mở và tôi sẽ không giả vờ là vậy. Mã nguồn của Flow vẫn công khai, nên bạn đọc được từng dòng mà bạn chạy.

- Dùng tại nhà và trong phòng thí nghiệm là miễn phí.
- Trường học và cơ sở giáo dục được công nhận, tổ chức phi lợi nhuận và cơ quan nhà nước dùng miễn phí cho hoạt động và sứ mệnh của chính họ.
- Dùng cho kinh doanh là miễn phí khi chạy qua [EmberNet](https://embernet.ai). Đó là con đường kinh doanh duy nhất.
- Việc lưu trữ Flow như một dịch vụ, bán lại và nhúng vào sản phẩm bạn bán không được cấp phép.
- Mỗi phiên bản chuyển sang GPL-3.0 trở lên bốn năm sau khi được công bố lần đầu.

`LICENSE` là văn bản pháp lý, từng byte giống bản trong HotLoop-io/HotLoop-io. 2.1.0 và mọi bản trước đó vẫn theo giấy phép lúc chúng phát hành. Không có gì thay đổi với các bản đó. Các tệp Node-RED được chuyển giữ nguyên phần đầu giấy phép và ghi công ban đầu, nên văn bản giấy phép của chúng giờ nằm trong `LICENSES/` cạnh `NOTICE`, và image mang cả hai trong `/usr/share/doc/hotloop-flow/`. `NOTICE` cũng bao gồm bản gos7 đã vá mà Flow mang theo bây giờ (bên dưới).

## Có gì mới

**Truy vết và phát lại**
- Mỗi thông điệp có một vết truy có giới hạn. Nhấp vào một thông điệp gỡ lỗi và trình soạn thảo làm sáng đường nó đã đi, kèm thời gian và payload ở mỗi chặng, qua các phép tách, ghép và luồng con.
- Một vết truy trở thành bài kiểm thử luồng, hoặc được phát lại vào một bản nháp để bạn thử một bản sửa trên chính thông điệp đã làm hỏng.
- Mỗi chặng có thể gửi đến một collector OpenTelemetry dưới dạng span (`trace.otlp.endpoint`).

**Trạng thái sống sót qua khởi động lại**
- Ngữ cảnh luồng, toàn cục và nút nằm trong một tệp SQLite, `state.db`, trên ổ dữ liệu. Khởi động lại không còn xóa chúng.
- Dây bền. Đánh dấu một dây là bền và, chừng nào nút ở đầu kia còn theo kịp, nó là một dây bình thường và không ghi gì. Khi nút đó ngừng nhận thông điệp, dây tràn vào chính tệp đó theo thứ tự và xả ra khi đích quay lại. Chúng tôi đã chứng minh điều này với một InfluxDB thật bị tắt mười phút, với runtime bị `kill -9` giữa lúc gián đoạn và giữa lúc xả: không mất cái nào, không trùng cái nào.

**Nút nhà máy**
- Modbus TCP đọc và ghi, OPC UA đọc, ghi và đăng ký, S7 đọc và ghi, EtherNet/IP đọc và ghi, và Sparkplug B làm nút biên và làm host. Flow giờ có thể nói chuyện với những gì `scan` tìm thấy.
- Sparkplug thực hiện các birth, last will, `bdSeq`, yêu cầu rebirth và lệnh mà đặc tả đòi hỏi. Chúng tôi đã kiểm tra nó với một bản triển khai Sparkplug độc lập theo cả hai chiều, nút biên và host.
- Một thiết bị im lặng làm yêu cầu thất bại trong thời gian chờ và thông điệp kế tiếp kết nối lại. Một đăng ký OPC UA nhận ra mình bị rớt, báo đúng một lần và tự khôi phục.

**Trình soạn thảo**
- Sao chép và dán, nhập và xuất một vùng chọn, luồng con có canvas riêng, nhóm lồng nhau, tìm kiếm trên mọi luồng, bộ lọc gỡ lỗi, Alt+nhấp để xóa một dây. Một bài kiểm thử trình duyệt nhấp qua mọi hộp thoại nút từ danh sách mà runtime cung cấp, nên một nút mới được phủ ngay từ ngày phát hành.
- Kéo một dây vào một nút chưa bao giờ hoạt động trong Chromium. Giờ thì được.

**Kiểm tra**
- Một nút mà nút cấu hình của nó không có trong tệp (một broker đã xóa mà luồng con vẫn nhắc tới, hoặc tham chiếu tới một tab hay sai loại nút cấu hình) được báo khi nhập, khi tải và khi triển khai, và nó không khởi động. Trước đây nó lặng lẽ không bao giờ chạy.
- Xóa một luồng hoặc một nút sẽ gỡ id của nó khỏi các phạm vi Catch, Status và Complete từng nhắc tới nó.

## Có gì thay đổi

- Ngữ cảnh được giữ lại theo mặc định. `store.context.persist` đang bật, nên một giá trị đặt trước khi khởi động lại vẫn còn sau đó, trong khi trước đây mỗi lần khởi động lại đều bắt đầu trống. Một luồng từng trông chờ ngữ cảnh trống lúc khởi động giờ phải tự xóa những gì nó mong là trống. Đặt `persist` thành `false` để có hành vi cũ.
- Truy vết được bật mặc định và bị giới hạn mọi mặt: 256 hành trình, mỗi hành trình 512 chặng, tổng cộng 16 MiB, 1000 hành trình mới mỗi giây. Nó chỉ nằm trong bộ nhớ, nên khởi động lại là bắt đầu lại danh sách. `trace.enabled: false` tắt nó.
- gos7 in một dòng thô ra bộ ghi nhật ký toàn cục của Go ở mỗi lần S7 hết thời gian chờ, và không gì trên nút có thể tắt nó.
- Hàng đợi bền tính một thông điệp là đang chờ sau khi nó đã nằm trên đĩa, không phải trước đó.
- Image được build và đẩy bằng Podman, không phải Docker. Cùng image, cùng tag (`2.2.0`, `2.2`, `2`), vẫn linux/amd64 và linux/arm64.

## Ghi chú nâng cấp

Từ 2.1.0, chỉ cần đổi image (`helm upgrade`, hoặc tag mới trong unit Quadlet của bạn). Không cần di chuyển dữ liệu, không cần cờ nào. Một `flows.json` và một tệp cấu hình từng chạy trên 2.1.0 vẫn chạy trên 2.2.0, và vòng đi về từng byte của tệp luồng vẫn nguyên vẹn.

- Lần khởi động đầu tiên tạo `state.db` trong `data.dir`, trên ổ dữ liệu. Với `persistence.enabled` là false trong chart, nó sống sót qua việc khởi động lại container nhưng không qua việc thay pod.
- Quay lại 2.1.0 để nguyên `state.db` ở đó. 2.1.0 không có mã nào đọc nó.
- Mỗi lần ghi vào `state.db` là một lần ghi vào thẻ SD hoặc SSD, nên các giá trị mặc định gom lại. Các thay đổi ngữ cảnh chờ `flushInterval` (30 giây) rồi được ghi cùng nhau, và một giá trị được đặt về đúng giá trị cũ thì không ghi gì. Một `kill -9` có thể mất chừng đó. `docs/durable/README.md` có các con số và cái giá phải trả cho một thẻ.

## Cài đặt mới

| YAML | Biến môi trường | Mặc định |
|---|---|---|
| `store.path` | `HOTLOOP_FLOW_STORE_PATH` | trống, nghĩa là `state.db` trong `data.dir` |
| `store.synchronous` | `HOTLOOP_FLOW_STORE_SYNCHRONOUS` | `normal`. `full` fsync ở mỗi commit và làm mòn thẻ vì điều đó. |
| `store.context.persist` | `HOTLOOP_FLOW_CONTEXT_PERSIST` | `true` |
| `store.context.flushInterval` | `HOTLOOP_FLOW_CONTEXT_FLUSH_INTERVAL` | `30s`. `0s` ghi mọi thay đổi trước khi luồng đi tiếp. |
| `store.durable.maxBytes` | `HOTLOOP_FLOW_DURABLE_MAX_BYTES` | 256 MiB cho tất cả các dây bền cộng lại |
| `store.durable.ackFlush` | `HOTLOOP_FLOW_DURABLE_ACK_FLUSH` | `100ms`. `0s` đánh dấu từng thông điệp trước khi gửi thông điệp tiếp theo. |
| `trace.enabled`, `trace.traces`, `trace.maxHops`, `trace.maxMessageBytes`, `trace.maxBytes`, `trace.perSecond` | | `true`, 256, 512, 16384, 16 MiB, 1000. `perSecond: 0` truy vết mọi thông điệp. |
| `trace.otlp.endpoint`, `trace.otlp.serviceName`, `trace.otlp.interval` | `HOTLOOP_FLOW_TRACE_OTLP_ENDPOINT` | trống (không xuất), `hotloop-flow`, `2s` |
| `trace.otlp.headersSecret` (chart) | `HOTLOOP_FLOW_TRACE_OTLP_HEADERS` | không có. Một khóa Secret chứa các cặp `Name=value` phân tách bằng dấu phẩy, dành cho khóa API của một collector được lưu trữ. |

Chart có tất cả những thứ này dưới `store` và `trace` trong `values.yaml`.

Image: `ghcr.io/hotloop-io/hotloop-flow:2.2.0`, linux/amd64 và linux/arm64. Chart: `https://hotloop.io/hotloop-flow/`. README tại tag này có phần còn lại: https://github.com/HotLoop-io/hotloop-flow/blob/v2.2.0/README.md
