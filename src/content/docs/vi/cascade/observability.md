---
title: "Theo dõi hoạt động"
description: "Tình trạng, mức sẵn sàng, số liệu Prometheus và dấu vết cho mọi lần chạy và bước, để tác vụ bị kẹt hiện lên trên biểu đồ chứ không phải trong lời phàn nàn."
---

`/healthz` cho biết tiến trình đang chạy. `/readyz` cho biết nó làm được việc: cơ sở dữ liệu phản hồi và có lược đồ mà tệp nhị phân này cần. `/metrics` là Prometheus: số lần chạy theo trạng thái và thời gian chạy, thời gian dành cho từng loại bước, số lần chạy đang xếp hàng, đang chạy hoặc đang chờ và lần chạy cũ nhất đã chờ bao lâu, độ trễ webhook, lỗi làm mới OAuth và những trình kích hoạt nào đang giữ kết nối. Chúng dùng chung địa chỉ chính, hoặc có địa chỉ riêng bằng `HOTLOOP_CASCADE_OPS_LISTEN` (worker không có địa chỉ nào khác và dùng `:8081`). `HOTLOOP_CASCADE_METRICS_TOKEN` khiến `/metrics` yêu cầu bearer token.

Mỗi lần chạy là một dấu vết OpenTelemetry với một span cho từng bước. Chỉ định một endpoint OTLP bằng các biến chuẩn (`OTEL_EXPORTER_OTLP_ENDPOINT` và nhóm biến đi kèm) thì các span được gửi đến đó; nếu không chỉ định thì không gửi gì cả. ID dấu vết là ID của lần chạy, hoặc dấu vết của bên gọi khi webhook đến kèm `traceparent`, và bước HTTP chuyển tiếp một cái đến nơi nó gọi.
