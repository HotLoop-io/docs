---
title: "Flow のメトリクス"
description: "Flow がノードごとに公開する Prometheus メトリクス。詰まったワイヤーや満杯の受信箱が、障害になる前にグラフに表れます。"
---

`/metrics` の Prometheus で、ノード単位です。ノード単位のものにはすべて `node` ラベルと `type` ラベルが付きます。エクスポーターのサイドカーはありません。エッジボックスには置く余裕がなく、受信箱が満杯だと知るために 2 つ目のコンテナが必要であってはならないからです。

| メトリクス | 種類 | 分かること |
|---|---|---|
| `hotloop_flow_build_info` | gauge | 常に 1。バージョンはラベルに入ります。 |
| `hotloop_flow_uptime_seconds` | gauge | ランタイム起動からの秒数。 |
| `hotloop_flow_nodes_running` | gauge | 現在実行中のノードインスタンス数。 |
| `hotloop_flow_node_messages_received_total` | counter | ノードに配信されたメッセージ数。 |
| `hotloop_flow_node_messages_sent_total` | counter | ノードが出力したメッセージ数。 |
| `hotloop_flow_node_errors_total` | counter | ノードが出したエラー数。 |
| `hotloop_flow_node_schema_mismatches_total` | counter | ノードで JSON スキーマに違反したメッセージ数。入力ポート、出力ポート、または `json` ノードで発生します。それぞれ、不正なすべてのフィールドのパスとともに Catch ノードに送られました。 |
| `hotloop_flow_node_messages_dropped_total` | counter | 受信箱が満杯のため破棄されたメッセージ数。 |
| `hotloop_flow_node_sends_blocked_total` | counter | 送信側が空きを待った回数。持続するバックプレッシャーで、フローが追いつけていないことを示す本当のシグナルです。 |
| `hotloop_flow_node_queue_length` | gauge | 現在待機中のメッセージ数。 |
| `hotloop_flow_node_queue_capacity` | gauge | オーバーフローポリシーが適用され始める位置。 |
| `hotloop_flow_node_queue_high_water` | gauge | その受信箱がこれまでに到達した最大の深さ。 |
| `hotloop_flow_goroutines` | gauge | おおよそノードごとに 1 つに、それぞれが保持する I/O を加えた数。 |
| `hotloop_flow_memory_heap_bytes` | gauge | 現在割り当てられているヒープ。 |
| `hotloop_flow_memory_sys_bytes` | gauge | OS から取得したバイト数。 |
| `hotloop_flow_gc_cycles_total` | counter | 完了した GC サイクル数。 |
| `hotloop_flow_git_mirror_behind_deployments` | gauge | git ミラーのリモートにまだないデプロイ数。ミラーがある場合のみ。 |
| `hotloop_flow_git_mirror_push_failures_total` | counter | 失敗して再試行されるミラーへのプッシュ数。 |
| `hotloop_flow_git_mirror_pushes_total` | counter | 成功したミラーへのプッシュ数。 |
| `hotloop_flow_durable_wire_depth` | gauge | ディスク上の永続ワイヤーで待機中のメッセージ数。ラベルは `wire`。 |
| `hotloop_flow_durable_wire_bytes` | gauge | そのワイヤーの待機中メッセージに課されたクォータ。 |
| `hotloop_flow_durable_wire_delivered_total` | counter | ワイヤーが渡し、宛先が受け取ったメッセージ数。 |
| `hotloop_flow_durable_wire_retries_total` | counter | 宛先が失敗させたため、ワイヤーがメッセージを再送した回数。宛先が停止していると増えます。 |
| `hotloop_flow_durable_wire_given_up_total` | counter | ノードの `ew_durable_attempts` を使い切ったため、ワイヤーが再試行をやめたメッセージ数。それぞれ、メッセージが添付されたエラーとしてフローに渡されました。 |
| `hotloop_flow_durable_wire_dropped_total` | counter | クォータポリシーが拒否または追い出したメッセージ数と、ワイヤーが永続でなくなったときに消去されたキュー。 |
| `hotloop_flow_durable_bytes`, `hotloop_flow_durable_max_bytes` | gauge | すべての永続ワイヤーを合わせて使用中のクォータと、クォータ自体。 |
| `hotloop_flow_context_flushes_total`, `hotloop_flow_context_rows_written_total` | counter | コンテキストを書き込んだトランザクション数と、実際に変更された行数。 |
| `hotloop_flow_context_flush_failures_total` | counter | 失敗したコンテキストのフラッシュ数。変更は保持され、再試行されます。ゼロであるべきです。 |
| `hotloop_flow_audit_write_failures_total` | counter | 書き込めなかった監査エントリ数。永久にゼロであるべきです。 |
| `hotloop_flow_traces_kept` | gauge | 現在バッファにあるメッセージトレース数。 |
| `hotloop_flow_trace_bytes` | gauge | それらが保持するおおよその量。`trace.maxBytes` で制限されます。 |
| `hotloop_flow_traces_started_total` | counter | 開始されたメッセージトレース数。 |
| `hotloop_flow_traces_forgotten_total` | counter | 場所を空けるために押し出されたトレース数。 |
| `hotloop_flow_traces_skipped_total` | counter | `trace.perSecond` に達したためトレースされなかったメッセージ数。 |
| `hotloop_flow_trace_hops_dropped_total` | counter | 記録されなかったホップ数。トレースが満杯、または既に破棄されていたためです。 |
| `hotloop_flow_otlp_spans_exported_total` | counter | OpenTelemetry コレクターが受け付けたスパン数。エンドポイントがある場合のみ。 |
| `hotloop_flow_otlp_spans_dropped_total` | counter | エクスポートキューが満杯のため破棄されたスパン数。 |
| `hotloop_flow_otlp_spans_failed_total` | counter | 再試行後もコレクターが受け取らなかったスパン数。ゼロを超えていれば、コレクターに届いていません。 |

アラートを設定すべきなのは、`hotloop_flow_node_queue_capacity` に対する `hotloop_flow_node_queue_high_water` です。最高水位は、フローが上限に近づいている早期警告であり、何かが破棄される前に、そして誰かが起きているずっと前に届きます。このアラートこそが、上限付きの受信箱を作った理由のすべてです。存在しない限界にどれだけ近いかは報告できないので、まず限界が存在する必要がありました。
