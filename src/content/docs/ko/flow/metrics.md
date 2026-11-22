---
title: "Flow 지표"
description: "Flow가 노드별로 제공하는 Prometheus 지표로, 막힌 와이어나 가득 찬 받은 편지함이 장애가 되기 전에 그래프에 먼저 나타나도록 합니다."
---

`/metrics`의 Prometheus이며 노드별이고, 노드별인 모든 항목에 `node`와 `type` 레이블이 붙습니다. 익스포터 사이드카는 없습니다. 엣지 박스에는 둘 자리가 없고, 받은 편지함이 가득 찼는지 알기 위해 두 번째 컨테이너가 필요해서는 안 되기 때문입니다.

| 지표 | 유형 | 알려 주는 내용 |
|---|---|---|
| `hotloop_flow_build_info` | gauge | 항상 1입니다. 버전은 레이블에 담깁니다. |
| `hotloop_flow_uptime_seconds` | gauge | 런타임이 시작된 뒤 경과한 초입니다. |
| `hotloop_flow_nodes_running` | gauge | 현재 실행 중인 노드 인스턴스 수입니다. |
| `hotloop_flow_node_messages_received_total` | counter | 노드에 전달된 메시지 수입니다. |
| `hotloop_flow_node_messages_sent_total` | counter | 노드가 내보낸 메시지 수입니다. |
| `hotloop_flow_node_errors_total` | counter | 노드가 일으킨 오류 수입니다. |
| `hotloop_flow_node_schema_mismatches_total` | counter | 노드에서 JSON 스키마를 위반한 메시지 수입니다. 입력 포트, 출력 포트, 또는 `json` 노드에서 발생합니다. 각 메시지는 잘못된 모든 필드의 경로와 함께 Catch 노드로 갔습니다. |
| `hotloop_flow_node_messages_dropped_total` | counter | 받은 편지함이 가득 차서 버려진 메시지 수입니다. |
| `hotloop_flow_node_sends_blocked_total` | counter | 송신 측이 공간을 기다린 횟수입니다. 지속되는 백프레셔이며, 플로가 따라가지 못한다는 실제 신호입니다. |
| `hotloop_flow_node_queue_length` | gauge | 지금 대기 중인 메시지 수입니다. |
| `hotloop_flow_node_queue_capacity` | gauge | 오버플로 정책이 적용되기 시작하는 지점입니다. |
| `hotloop_flow_node_queue_high_water` | gauge | 그 받은 편지함이 지금까지 가장 깊었던 수준입니다. |
| `hotloop_flow_goroutines` | gauge | 대략 노드마다 하나에 각자가 쥔 I/O를 더한 수입니다. |
| `hotloop_flow_memory_heap_bytes` | gauge | 현재 할당된 힙입니다. |
| `hotloop_flow_memory_sys_bytes` | gauge | 운영체제에서 가져온 바이트 수입니다. |
| `hotloop_flow_gc_cycles_total` | counter | 완료된 GC 주기 수입니다. |
| `hotloop_flow_git_mirror_behind_deployments` | gauge | git 미러의 원격에 아직 없는 배포 수입니다. 미러가 있을 때만 해당합니다. |
| `hotloop_flow_git_mirror_push_failures_total` | counter | 실패하여 재시도될 미러 푸시 수입니다. |
| `hotloop_flow_git_mirror_pushes_total` | counter | 성공한 미러 푸시 수입니다. |
| `hotloop_flow_durable_wire_depth` | gauge | 디스크에 있는 내구성 와이어에서 대기 중인 메시지 수입니다. 레이블 `wire`. |
| `hotloop_flow_durable_wire_bytes` | gauge | 그 와이어의 대기 메시지에 부과된 할당량입니다. |
| `hotloop_flow_durable_wire_delivered_total` | counter | 와이어가 넘겨주고 대상이 받아 간 메시지 수입니다. |
| `hotloop_flow_durable_wire_retries_total` | counter | 대상이 거부해서 와이어가 메시지를 다시 보낸 횟수입니다. 대상이 멈춰 있으면 이 값이 올라갑니다. |
| `hotloop_flow_durable_wire_given_up_total` | counter | 노드의 `ew_durable_attempts`가 소진되어 와이어가 재시도를 멈춘 메시지 수입니다. 각각은 메시지가 첨부된 오류로 플로에 전달되었습니다. |
| `hotloop_flow_durable_wire_dropped_total` | counter | 할당량 정책이 거부하거나 밀어낸 메시지 수와, 와이어가 더 이상 내구성이 아니게 되어 비워진 큐입니다. |
| `hotloop_flow_durable_bytes`, `hotloop_flow_durable_max_bytes` | gauge | 모든 내구성 와이어가 함께 사용한 할당량과 그 한도입니다. |
| `hotloop_flow_context_flushes_total`, `hotloop_flow_context_rows_written_total` | counter | 컨텍스트를 기록한 트랜잭션 수와, 실제로 바뀐 행 수입니다. |
| `hotloop_flow_context_flush_failures_total` | counter | 실패한 컨텍스트 플러시 수입니다. 변경은 유지되고 다시 시도됩니다. 0이어야 합니다. |
| `hotloop_flow_audit_write_failures_total` | counter | 기록하지 못한 감사 항목 수입니다. 영원히 0이어야 합니다. |
| `hotloop_flow_traces_kept` | gauge | 지금 버퍼에 있는 메시지 추적 수입니다. |
| `hotloop_flow_trace_bytes` | gauge | 그 추적들이 차지하는 대략의 크기입니다. `trace.maxBytes`로 제한됩니다. |
| `hotloop_flow_traces_started_total` | counter | 시작된 메시지 추적 수입니다. |
| `hotloop_flow_traces_forgotten_total` | counter | 자리를 만들려고 밀려난 추적 수입니다. |
| `hotloop_flow_traces_skipped_total` | counter | `trace.perSecond`에 도달해서 추적하지 않은 메시지 수입니다. |
| `hotloop_flow_trace_hops_dropped_total` | counter | 기록되지 않은 홉 수입니다. 추적이 가득 찼거나 이미 잊혀졌기 때문입니다. |
| `hotloop_flow_otlp_spans_exported_total` | counter | OpenTelemetry 수집기가 받아 간 스팬 수입니다. 엔드포인트가 있을 때만 해당합니다. |
| `hotloop_flow_otlp_spans_dropped_total` | counter | 내보내기 큐가 가득 차서 버려진 스팬 수입니다. |
| `hotloop_flow_otlp_spans_failed_total` | counter | 재시도 후에도 수집기가 받지 않은 스팬 수입니다. 0보다 크면 수집기가 받지 못하고 있다는 뜻입니다. |

경보를 걸 지표는 `hotloop_flow_node_queue_capacity` 대비 `hotloop_flow_node_queue_high_water`입니다. 최고 수위는 플로가 상한에 다가가고 있다는 조기 경고이며, 무엇이 버려지기 전에, 그리고 누군가 깨어 있기 한참 전에 도착합니다. 이 경보가 한도가 있는 받은 편지함을 만든 이유의 전부입니다. 존재하지 않는 한계에 얼마나 가까운지는 보고할 수 없으므로 한계가 먼저 있어야 했습니다.
