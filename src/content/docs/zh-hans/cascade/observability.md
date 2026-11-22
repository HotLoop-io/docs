---
title: "监控运行状态"
description: "为每次执行和每个步骤提供健康、就绪、Prometheus 指标和追踪，卡住的任务会出现在图表上，而不是出现在投诉里。"
---

`/healthz` 表示进程在运行。`/readyz` 表示它能够工作：数据库有响应，并且具有此二进制文件所需的数据库结构。`/metrics` 是 Prometheus 格式：按状态统计的执行次数及耗时、每种步骤类型花费的时间、排队、运行或等待中的执行数量及最早一个已等待多久、Webhook 延迟、OAuth 刷新失败，以及哪些触发器占用着连接。它们共用主地址，也可以用 `HOTLOOP_CASCADE_OPS_LISTEN` 单独设置地址（worker 没有其他地址，使用 `:8081`）。设置 `HOTLOOP_CASCADE_METRICS_TOKEN` 后，`/metrics` 需要 Bearer 令牌。

每次执行就是一条 OpenTelemetry 追踪，每个步骤对应一个 span。用标准变量（`OTEL_EXPORTER_OTLP_ENDPOINT` 及其同系列变量）指定 OTLP 端点后，span 会发送到那里；未指定则不发送任何内容。追踪 ID 就是执行的 ID；当 Webhook 带着 `traceparent` 到达时，则沿用调用方的追踪，HTTP 步骤也会把它继续传给所调用的对象。
