---
title: "Chỉ số của Flow"
description: "Các chỉ số Prometheus mà Flow cung cấp cho từng nút, để một dây bị kẹt hay hộp thư đến đầy hiện lên trên biểu đồ trước khi nó hiện ra thành sự cố."
---

Prometheus tại `/metrics`, theo từng nút, với nhãn `node` và `type` trên mọi thứ tính theo nút. Không có sidecar xuất dữ liệu, vì một hộp biên không có chỗ cho nó và bạn không nên cần container thứ hai để biết hộp thư đến của mình đã đầy.

| Chỉ số | Loại | Nó cho bạn biết điều gì |
|---|---|---|
| `hotloop_flow_build_info` | gauge | Luôn là 1. Phiên bản nằm trong nhãn. |
| `hotloop_flow_uptime_seconds` | gauge | Số giây kể từ khi môi trường chạy khởi động. |
| `hotloop_flow_nodes_running` | gauge | Số bản sao nút đang chạy hiện tại. |
| `hotloop_flow_node_messages_received_total` | counter | Số tin nhắn đã giao tới một nút. |
| `hotloop_flow_node_messages_sent_total` | counter | Số tin nhắn một nút đã phát ra. |
| `hotloop_flow_node_errors_total` | counter | Số lỗi một nút đã gây ra. |
| `hotloop_flow_node_schema_mismatches_total` | counter | Số tin nhắn vi phạm một lược đồ JSON tại một nút: ở cổng vào, ở một cổng ra, hoặc trong một nút `json`. Mỗi tin đã đi tới một nút Catch cùng đường dẫn của mọi trường sai. |
| `hotloop_flow_node_messages_dropped_total` | counter | Số tin nhắn bị loại bỏ vì hộp thư đến đã đầy. |
| `hotloop_flow_node_sends_blocked_total` | counter | Số lần bên gửi phải chờ chỗ. Áp lực ngược kéo dài, đó là tín hiệu thật rằng một luồng không theo kịp. |
| `hotloop_flow_node_queue_length` | gauge | Số tin nhắn đang chờ ngay lúc này. |
| `hotloop_flow_node_queue_capacity` | gauge | Điểm mà chính sách tràn bắt đầu áp dụng. |
| `hotloop_flow_node_queue_high_water` | gauge | Độ sâu lớn nhất mà hộp thư đến đó từng đạt. |
| `hotloop_flow_goroutines` | gauge | Xấp xỉ một cái cho mỗi nút cộng với I/O mà mỗi nút giữ. |
| `hotloop_flow_memory_heap_bytes` | gauge | Heap đang được cấp phát. |
| `hotloop_flow_memory_sys_bytes` | gauge | Số byte lấy từ hệ điều hành. |
| `hotloop_flow_gc_cycles_total` | counter | Số chu kỳ GC đã hoàn tất. |
| `hotloop_flow_git_mirror_behind_deployments` | gauge | Số lần triển khai mà kho từ xa của bản sao git chưa có. Chỉ khi có bản sao. |
| `hotloop_flow_git_mirror_push_failures_total` | counter | Số lần đẩy lên bản sao đã thất bại và sẽ được thử lại. |
| `hotloop_flow_git_mirror_pushes_total` | counter | Số lần đẩy lên bản sao đã thành công. |
| `hotloop_flow_durable_wire_depth` | gauge | Số tin nhắn đang chờ trên một dây bền vững, trên đĩa. Nhãn `wire`. |
| `hotloop_flow_durable_wire_bytes` | gauge | Hạn mức tính cho các tin nhắn đang chờ của dây đó. |
| `hotloop_flow_durable_wire_delivered_total` | counter | Số tin nhắn dây đã chuyển đi và đích đã nhận. |
| `hotloop_flow_durable_wire_retries_total` | counter | Số lần dây gửi lại một tin nhắn vì đích đã từ chối nó. Một đích đang ngừng hoạt động sẽ làm số này tăng. |
| `hotloop_flow_durable_wire_given_up_total` | counter | Số tin nhắn dây đã ngừng thử lại vì `ew_durable_attempts` của nút đã hết. Mỗi tin đã đi vào luồng như một lỗi kèm tin nhắn. |
| `hotloop_flow_durable_wire_dropped_total` | counter | Số tin nhắn mà chính sách hạn mức đã từ chối hoặc đẩy ra, và hàng đợi bị xóa khi một dây không còn bền vững. |
| `hotloop_flow_durable_bytes`, `hotloop_flow_durable_max_bytes` | gauge | Hạn mức mà mọi dây bền vững cùng dùng, và hạn mức đó. |
| `hotloop_flow_context_flushes_total`, `hotloop_flow_context_rows_written_total` | counter | Số giao dịch đã ghi ngữ cảnh, và số hàng thực sự đã thay đổi. |
| `hotloop_flow_context_flush_failures_total` | counter | Số lần ghi ngữ cảnh thất bại. Các thay đổi được giữ lại và thử lại. Nên bằng không. |
| `hotloop_flow_audit_write_failures_total` | counter | Số mục kiểm toán không ghi được. Nên bằng không mãi mãi. |
| `hotloop_flow_traces_kept` | gauge | Số vết tin nhắn trong bộ đệm ngay lúc này. |
| `hotloop_flow_trace_bytes` | gauge | Xấp xỉ dung lượng chúng chiếm. Bị giới hạn bởi `trace.maxBytes`. |
| `hotloop_flow_traces_started_total` | counter | Số vết tin nhắn đã bắt đầu. |
| `hotloop_flow_traces_forgotten_total` | counter | Số vết bị đẩy ra để lấy chỗ. |
| `hotloop_flow_traces_skipped_total` | counter | Số tin nhắn không được theo vết vì đã đạt `trace.perSecond`. |
| `hotloop_flow_trace_hops_dropped_total` | counter | Số chặng không được ghi lại: vết của chúng đã đầy hoặc đã bị quên. |
| `hotloop_flow_otlp_spans_exported_total` | counter | Số span mà bộ thu OpenTelemetry đã nhận. Chỉ khi có điểm cuối. |
| `hotloop_flow_otlp_spans_dropped_total` | counter | Số span bị loại bỏ vì hàng đợi xuất đã đầy. |
| `hotloop_flow_otlp_spans_failed_total` | counter | Số span mà bộ thu không nhận sau một lần thử lại. Trên không nghĩa là nó không nhận được chúng. |

Chỉ số nên đặt cảnh báo là `hotloop_flow_node_queue_high_water` so với `hotloop_flow_node_queue_capacity`. Mức nước cao là cảnh báo sớm rằng một luồng đang tiến gần tới trần của nó, đến trước khi có gì bị loại bỏ và rất lâu trước khi có ai tỉnh dậy. Cảnh báo đó là toàn bộ lý do chúng tôi xây dựng hộp thư đến có giới hạn. Bạn không thể báo cáo mình gần một giới hạn đến mức nào nếu giới hạn đó không tồn tại, nên giới hạn phải tồn tại trước.
