---
title: "Flow 指标"
description: "Flow 按节点公开的 Prometheus 指标，让积压的连线或已满的收件箱在变成故障之前先出现在图表上。"
---

Prometheus 在 `/metrics`，按节点提供，所有按节点的指标都带有 `node` 和 `type` 标签。没有导出器 sidecar，因为边缘盒子放不下，而且你不该需要第二个容器才能知道收件箱满了。

| 指标 | 类型 | 它告诉你什么 |
|---|---|---|
| `hotloop_flow_build_info` | gauge | 始终为 1。版本在标签中。 |
| `hotloop_flow_uptime_seconds` | gauge | 运行时启动以来的秒数。 |
| `hotloop_flow_nodes_running` | gauge | 当前正在运行的节点实例数。 |
| `hotloop_flow_node_messages_received_total` | counter | 投递到节点的消息数。 |
| `hotloop_flow_node_messages_sent_total` | counter | 节点发出的消息数。 |
| `hotloop_flow_node_errors_total` | counter | 节点抛出的错误数。 |
| `hotloop_flow_node_schema_mismatches_total` | counter | 在节点上违反 JSON Schema 的消息数：在其输入端口、某个输出端口或 `json` 节点中。每一条都带着每个错误字段的路径送到了 Catch 节点。 |
| `hotloop_flow_node_messages_dropped_total` | counter | 因收件箱已满而被丢弃的消息数。 |
| `hotloop_flow_node_sends_blocked_total` | counter | 发送方等待空位的次数。持续的反压，是流程跟不上的真正信号。 |
| `hotloop_flow_node_queue_length` | gauge | 此刻正在等待的消息数。 |
| `hotloop_flow_node_queue_capacity` | gauge | 溢出策略开始生效的位置。 |
| `hotloop_flow_node_queue_high_water` | gauge | 该收件箱曾经达到的最大深度。 |
| `hotloop_flow_goroutines` | gauge | 大致每个节点一个，再加上各自持有的 I/O。 |
| `hotloop_flow_memory_heap_bytes` | gauge | 当前已分配的堆内存。 |
| `hotloop_flow_memory_sys_bytes` | gauge | 从操作系统获取的字节数。 |
| `hotloop_flow_gc_cycles_total` | counter | 已完成的 GC 周期数。 |
| `hotloop_flow_git_mirror_behind_deployments` | gauge | git 镜像的远端还没有的部署数。仅在有镜像时。 |
| `hotloop_flow_git_mirror_push_failures_total` | counter | 推送到镜像失败并将重试的次数。 |
| `hotloop_flow_git_mirror_pushes_total` | counter | 推送到镜像成功的次数。 |
| `hotloop_flow_durable_wire_depth` | gauge | 磁盘上持久连线上等待的消息数。标签 `wire`。 |
| `hotloop_flow_durable_wire_bytes` | gauge | 记在该连线等待消息上的配额。 |
| `hotloop_flow_durable_wire_delivered_total` | counter | 连线交出且目标已接收的消息数。 |
| `hotloop_flow_durable_wire_retries_total` | counter | 因目标处理失败而由连线重发消息的次数。目标宕机时这个值会上升。 |
| `hotloop_flow_durable_wire_given_up_total` | counter | 因节点的 `ew_durable_attempts` 用完而停止重试的消息数。每一条都作为附带该消息的错误进入了流程。 |
| `hotloop_flow_durable_wire_dropped_total` | counter | 被配额策略拒绝或逐出的消息数，以及连线不再持久时被清空的队列。 |
| `hotloop_flow_durable_bytes`, `hotloop_flow_durable_max_bytes` | gauge | 所有持久连线合计使用的配额，以及配额本身。 |
| `hotloop_flow_context_flushes_total`, `hotloop_flow_context_rows_written_total` | counter | 写入上下文的事务数，以及它们实际修改的行数。 |
| `hotloop_flow_context_flush_failures_total` | counter | 失败的上下文刷新次数。更改会保留并重试。应为零。 |
| `hotloop_flow_audit_write_failures_total` | counter | 未能写入的审计条目数。应永远为零。 |
| `hotloop_flow_traces_kept` | gauge | 此刻缓冲区中的消息追踪数。 |
| `hotloop_flow_trace_bytes` | gauge | 它们大约占用的空间。受 `trace.maxBytes` 限制。 |
| `hotloop_flow_traces_started_total` | counter | 已开始的消息追踪数。 |
| `hotloop_flow_traces_forgotten_total` | counter | 为腾出空间而被挤出的追踪数。 |
| `hotloop_flow_traces_skipped_total` | counter | 因达到 `trace.perSecond` 而未被追踪的消息数。 |
| `hotloop_flow_trace_hops_dropped_total` | counter | 未被记录的跳数：它们的追踪已满或已被遗忘。 |
| `hotloop_flow_otlp_spans_exported_total` | counter | OpenTelemetry 收集器已接收的 span 数。仅在配置了端点时。 |
| `hotloop_flow_otlp_spans_dropped_total` | counter | 因导出队列已满而被丢弃的 span 数。 |
| `hotloop_flow_otlp_spans_failed_total` | counter | 重试后收集器仍未接收的 span 数。大于零表示它没有收到这些 span。 |

应该设置告警的是 `hotloop_flow_node_queue_high_water` 相对于 `hotloop_flow_node_queue_capacity`。高水位是流程正接近其上限的早期预警，它出现在任何东西被丢弃之前，也远早于有人醒来。这个告警就是我们构建有界收件箱的全部原因。你无法报告离一个不存在的限制有多近，所以必须先有这个限制。
