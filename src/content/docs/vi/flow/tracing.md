---
title: "Truy vết và phát lại"
description: "Bấm vào một thông điệp gỡ lỗi để thấy nó đã đi đâu, phát lại trong bản nháp, biến một lần truy vết thành bài kiểm thử và gửi span tới OpenTelemetry."
---

Một giá trị sai lúc 2 giờ sáng và bảng gỡ lỗi cho bạn biết giá trị đó. Nó không cho biết nút nào trong chín nút nó đi qua đã thay đổi giá trị, nút chậm giữ nó bao lâu, hay lúc đi vào nó trông thế nào. Bạn chỉ biết được bằng cách rải các nút Debug khắp luồng, triển khai, chờ nó xảy ra lần nữa rồi gỡ chúng đi.

Vì vậy mỗi thông điệp đi vào luồng đều có một vết truy. Mỗi thông điệp gỡ lỗi trong bảng có một nút **Trace**, và một lần bấm sẽ làm sáng trên canvas con đường thông điệp đó đã đi: các nút nó đi qua, các dây nó đi theo, còn mọi thứ nó chưa hề chạm tới đều bị làm mờ. Mỗi nút trên đường cho biết nó giữ thông điệp bao lâu (`8.3 µs`, hoặc `8.3 µs ×3` khi nó xử lý ba phần của thông điệp), và bảng Trace bên cạnh liệt kê từng bước theo thứ tự cùng thông điệp đúng như nút đó nhận được. Bấm vào một dòng là bạn đến ngay nút đó. Một bước bị lỗi có màu đỏ, kèm lỗi bên dưới.

Nó đi theo thông điệp đúng nơi thông điệp thật sự đến:

- **Qua một Split.** Một số đo thành ba, và cả ba đều nằm trong vết truy, mỗi cái là một bước riêng ở mọi nút sau chỗ tách.
- **Qua một Join.** Bước sau một Join có tất cả thông điệp mà Join đã gom cho nó làm cha mẹ, không chỉ cái tình cờ đến cuối cùng. Cả ba nhánh đã cấp dữ liệu cho nó đều sáng.
- **Qua một luồng con.** Các nút bên trong chạy như những bản sao có id riêng, và các bước được ghi dưới những id đó. Canvas làm sáng phiên bản luồng con, vì đó là nút trên tab bạn đang xem.
- **Vào một Catch.** Nút bị lỗi mang lỗi trên bước của nó, và Catch nhận lỗi là bước kế tiếp, được đánh dấu là đến được bằng một lỗi.

Vết truy đi cùng thông điệp nhưng không nằm trong nó. Không luồng nào đọc được hay phá được nó bằng `msg = {...}`, và nó không bao giờ xuất hiện trong một nút Debug, một bài kiểm thử hay một payload trên dây.

## Nó không thể phình ra

Việc này chạy ngay trên dây chuyền nó đang theo dõi, nên mọi hướng đều có giới hạn, và các giới hạn nằm dưới `trace:` trong [cấu hình](/vi/flow/configuration/):

| Giới hạn | Mặc định |
|---|---|
| Số vết truy được giữ, mới nhất | 256 |
| Số bước một vết truy giữ, để một vòng lặp không thể tự ghi mãi | 512 |
| Thông điệp lớn nhất mà một bước giữ bản sao | 16 KiB |
| Tất cả cộng lại, đếm gần đúng, cái cũ nhất bị quên trước | 16 MiB |
| Vết truy mới bắt đầu trong một giây | 1,000 |

Thông điệp trên 16 KiB vẫn giữ thời gian và được đánh dấu là quá lớn để hiển thị, và không thể phát lại hay biến thành bài kiểm thử. Quá 1,000 vết truy mới mỗi giây, các thông điệp còn lại của giây đó không được truy vết, vì một cảm biến phát một trăm nghìn lần mỗi giây nếu không sẽ phải trả giá một vết truy cho từng thông điệp. Một thông điệp bị bỏ qua, hoặc có vết truy bị đẩy ra khi nó còn đang trên đường, sẽ không được truy vết trong phần còn lại của hành trình; bắt đầu một vết truy mới giữa chừng chỉ làm đầy bộ đệm bằng phần đuôi của những hành trình đã mất phần đầu. Tất cả được đếm trên `/metrics`, nên bạn thấy được khi nào việc đó xảy ra.

Bài thử độ bền: **một triệu thông điệp qua năm nút, 2026-10-18**, trên cùng máy với [các con số ở trên](/vi/flow/overview/#các-con-số). Heap sau một lần GC cưỡng bức, lấy mẫu mỗi một trăm nghìn thông điệp:

| Truy vết | Heap, tại mỗi điểm kiểm tra | Thông điệp mỗi giây |
|---|---|---|
| Tắt truy vết | **1.3 MiB** | 192,596 |
| Truy vết mọi thông điệp (`perSecond: 0`) | **2.7 MiB** | 115,770 |
| Giới hạn mặc định | **4.0 MiB** | 195,199 |

Đó là cùng một con số ở cả mười điểm kiểm tra. Bộ truy vết giữ 808,448 byte trong 256 vết truy từ điểm kiểm tra đầu đến điểm cuối, quên 999,744 trong một triệu thông điệp trên đường đi, và không bao giờ tiến gần mức 16 MiB. Truy vết mọi thông điệp có tốn kém: nó kéo chuỗi này từ 192k mỗi giây xuống 116k. Đó là lý do giới hạn mặc định tồn tại. Ở 1,000 vết truy mỗi giây, chi phí chìm trong nhiễu, và dưới mức đó một vết truy khoảng 3 KB. Nếu bạn vẫn muốn mọi thông điệp, hãy đặt `perSecond: 0` và đọc dòng đầu của bảng đó trước khi quyết định. Tái hiện bằng:

Nếu heap không còn phẳng, bài kiểm thử sẽ thất bại.

## Phát lại trong bản nháp

Bạn đã tìm ra giá trị sai, nghĩ rằng biết cách sửa, và đã đổi một nút trên canvas. Đừng triển khai để kiểm chứng. **Replay into draft** lấy thông điệp đã bắt đầu vết truy, đưa vào luồng đúng như nó đang có trên canvas của bạn lúc này, đã triển khai hay chưa, và cho bạn biết nó kết thúc ở đâu so với lần đầu.

"Kết thúc" nghĩa là những nơi thông điệp dừng lại: một nút Debug, một MQTT Out, một Switch không khớp gì, một Join vẫn đang chờ. Với mỗi nơi, phần so sánh cho biết nó giống nhau, hoặc thuộc tính nào đã đổi (`payload: "HIGH" -> "CRITICAL"`), hoặc bản gốc kết thúc ở đó còn bản phát lại thì không, hoặc ngược lại. Đường đi của chính bản phát lại cũng sáng lên trên canvas, nên bạn thấy bản nháp đã gửi nó đi đâu. **Back to the original trace** đưa vết truy đầu tiên trở lại.

Nó chạy giống như một [bài kiểm thử luồng](/vi/flow/tests/), trong một tiến trình con với runtime thật và các nút thật, vì cùng một lý do: bản nháp của bạn khởi động mọi nút trong đó và không gì trong đó chạm được vào nhà máy. Điều đó có nghĩa là một nút lẽ ra gọi một dịch vụ web sẽ nhận về không gì cả, nên một luồng có đầu ra phụ thuộc vào câu trả lời sẽ hiện ra như một điểm khác biệt. Đó là kết quả trung thực. Nó sẽ không giả vờ đã nói chuyện với một PLC mà nó chưa từng nói chuyện.

## Vết truy trở thành bài kiểm thử

**Make test** trong bảng Trace soạn một [bài kiểm thử luồng](/vi/flow/tests/#kiểm-thử-từ-trình-soạn-thảo) từ toàn bộ vết truy: thông điệp đã bắt đầu nó, đưa vào đúng nguồn mà nó đi vào, và mọi nơi nó kết thúc mà một bài kiểm thử có thể theo dõi, với những gì nút đó nhận được làm giá trị mong đợi ở đó. Đó là hai lần bấm giống như tạo bài kiểm thử từ một thông điệp gỡ lỗi, và tốt hơn cho những luồng rắc rối, vì một vết truy nhớ mọi đầu cuối mà thông điệp đã đến. Một chỗ tách thành ba nút Debug là ba kỳ vọng, trong khi một thông điệp gỡ lỗi chỉ là một.

Khi không làm được, nó nói rõ lý do. Một vết truy bắt đầu bên trong luồng con, từ đầu ra thứ hai của một nguồn, hoặc từ một thông điệp quá lớn để giữ thì không thể đưa lại theo cách bài kiểm thử cần. Và một thông điệp bị Switch bỏ đi không kết thúc ở nơi nào mà bài kiểm thử theo dõi được, nên nó bị từ chối thay vì được viết thành một bài kiểm thử rỗng, vì một bài kiểm thử không có gì để kiểm tra thì luôn đạt.

## OpenTelemetry

Trỏ nó tới một bộ thu và mỗi bước sẽ đi ra như một span:

```yaml
trace:
  otlp:
    endpoint: http://collector:4318   # OTLP over HTTP; /v1/traces is added
    headers: {x-api-key: ...}         # if the collector wants one
    serviceName: hotloop-flow
```

Một vết truy là một trace của OpenTelemetry và một bước là một span, với bước đã gửi thông điệp là cha của nó. Span của một Join có cái đầu tiên làm cha và các cái còn lại làm liên kết. Mỗi span mang id nút, loại nút, id thông điệp, số thông điệp nút đã gửi tiếp và cổng đầu ra mà nó được đến qua, còn một lỗi là một span có trạng thái lỗi. **Thông điệp không bao giờ rời đi.** Payload là dữ liệu của một nhà máy và bộ thu là máy chủ của người khác, nên thứ đi ra chỉ là hình dạng của hành trình và thời gian của nó.

Nó nói OTLP/HTTP với mã hóa JSON mà đặc tả định nghĩa, viết tay trong một tệp, thay vì kéo OpenTelemetry SDK cùng protobuf và gRPC của nó vào chỉ để làm cùng một lần POST. Tệp nhị phân có ngân sách dung lượng và chúng tôi không tiêu nó vào việc đó. Mọi span id, cha, liên kết, tên, thuộc tính và trạng thái lỗi đều phải khớp. Không có mock ở bất kỳ đâu trong bài kiểm thử đó. Nếu bộ thu ngừng hoạt động, việc xuất sẽ bỏ các span và đếm chúng, còn luồng không hề hay biết; `hotloop_flow_otlp_spans_failed_total` vượt quá không là cách bạn biết được.
