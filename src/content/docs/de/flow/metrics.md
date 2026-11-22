---
title: "Flow-Kennzahlen"
description: "Die Prometheus-Kennzahlen, die Flow pro Knoten bereitstellt, damit sich eine gestaute Verbindung oder ein voller Eingang im Diagramm zeigt, bevor sie ausfällt."
---

Prometheus unter `/metrics`, pro Knoten, mit den Labels `node` und `type` auf allem, was pro Knoten gilt. Kein Exporter-Sidecar, weil eine Edge-Box dafür keinen Platz hat und Sie keinen zweiten Container brauchen sollten, um zu erfahren, dass Ihr Eingang voll ist.

| Kennzahl | Typ | Was sie Ihnen sagt |
|---|---|---|
| `hotloop_flow_build_info` | gauge | Immer 1. Die Version steckt im Label. |
| `hotloop_flow_uptime_seconds` | gauge | Sekunden seit dem Start der Laufzeit. |
| `hotloop_flow_nodes_running` | gauge | Derzeit laufende Knoteninstanzen. |
| `hotloop_flow_node_messages_received_total` | counter | An einen Knoten zugestellte Nachrichten. |
| `hotloop_flow_node_messages_sent_total` | counter | Von einem Knoten ausgegebene Nachrichten. |
| `hotloop_flow_node_errors_total` | counter | Von einem Knoten ausgelöste Fehler. |
| `hotloop_flow_node_schema_mismatches_total` | counter | Nachrichten, die an einem Knoten ein JSON-Schema verletzt haben: an seinem Eingangsport, an einem Ausgangsport oder in einem `json`-Knoten. Jede ging mit dem Pfad jedes fehlerhaften Felds an einen Catch-Knoten. |
| `hotloop_flow_node_messages_dropped_total` | counter | Nachrichten, die verworfen wurden, weil ein Eingang voll war. |
| `hotloop_flow_node_sends_blocked_total` | counter | Wie oft ein Sender auf Platz gewartet hat. Anhaltender Gegendruck, das eigentliche Signal, dass ein Flow nicht mehr mitkommt. |
| `hotloop_flow_node_queue_length` | gauge | Derzeit wartende Nachrichten. |
| `hotloop_flow_node_queue_capacity` | gauge | Ab wo die Überlaufrichtlinie greift. |
| `hotloop_flow_node_queue_high_water` | gauge | Die größte Tiefe, die dieser Eingang je hatte. |
| `hotloop_flow_goroutines` | gauge | Etwa eine pro Knoten plus die E/A, die jeder hält. |
| `hotloop_flow_memory_heap_bytes` | gauge | Aktuell belegter Heap. |
| `hotloop_flow_memory_sys_bytes` | gauge | Vom Betriebssystem bezogene Bytes. |
| `hotloop_flow_gc_cycles_total` | counter | Abgeschlossene GC-Zyklen. |
| `hotloop_flow_git_mirror_behind_deployments` | gauge | Deployments, die das Remote des Git-Spiegels noch nicht hat. Nur mit Spiegel. |
| `hotloop_flow_git_mirror_push_failures_total` | counter | Fehlgeschlagene Pushes zum Spiegel, die wiederholt werden. |
| `hotloop_flow_git_mirror_pushes_total` | counter | Erfolgreiche Pushes zum Spiegel. |
| `hotloop_flow_durable_wire_depth` | gauge | Auf einer dauerhaften Verbindung wartende Nachrichten, auf der Platte. Label `wire`. |
| `hotloop_flow_durable_wire_bytes` | gauge | Der Kapazität angerechnete Menge der wartenden Nachrichten dieser Verbindung. |
| `hotloop_flow_durable_wire_delivered_total` | counter | Nachrichten, die die Verbindung übergeben und das Ziel angenommen hat. |
| `hotloop_flow_durable_wire_retries_total` | counter | Wie oft die Verbindung eine Nachricht erneut gesendet hat, weil ihr Ziel sie abgelehnt hat. Ein ausgefallenes Ziel lässt diesen Wert steigen. |
| `hotloop_flow_durable_wire_given_up_total` | counter | Nachrichten, bei denen die Verbindung das Wiederholen aufgab, weil `ew_durable_attempts` des Knotens aufgebraucht war. Jede ging als Fehler mit angehängter Nachricht an den Flow. |
| `hotloop_flow_durable_wire_dropped_total` | counter | Nachrichten, die die Kontingentrichtlinie abgelehnt oder verdrängt hat, und Warteschlangen, die bereinigt wurden, als eine Verbindung nicht mehr dauerhaft war. |
| `hotloop_flow_durable_bytes`, `hotloop_flow_durable_max_bytes` | gauge | Von allen dauerhaften Verbindungen zusammen genutztes Kontingent und das Kontingent selbst. |
| `hotloop_flow_context_flushes_total`, `hotloop_flow_context_rows_written_total` | counter | Transaktionen, die Kontext geschrieben haben, und die Zeilen, die sie tatsächlich geändert haben. |
| `hotloop_flow_context_flush_failures_total` | counter | Fehlgeschlagene Kontext-Flushes. Die Änderungen bleiben erhalten und werden erneut versucht. Sollte null sein. |
| `hotloop_flow_audit_write_failures_total` | counter | Audit-Einträge, die nicht geschrieben werden konnten. Sollte für immer null sein. |
| `hotloop_flow_traces_kept` | gauge | Derzeit im Puffer liegende Nachrichtenverfolgungen. |
| `hotloop_flow_trace_bytes` | gauge | Ungefähr, was sie belegen. Begrenzt durch `trace.maxBytes`. |
| `hotloop_flow_traces_started_total` | counter | Gestartete Nachrichtenverfolgungen. |
| `hotloop_flow_traces_forgotten_total` | counter | Verfolgungen, die für neue Platz machen mussten. |
| `hotloop_flow_traces_skipped_total` | counter | Nicht verfolgte Nachrichten, weil `trace.perSecond` erreicht war. |
| `hotloop_flow_trace_hops_dropped_total` | counter | Nicht aufgezeichnete Stationen: Ihre Verfolgung war voll oder schon vergessen. |
| `hotloop_flow_otlp_spans_exported_total` | counter | Spans, die der OpenTelemetry-Collector angenommen hat. Nur mit Endpunkt. |
| `hotloop_flow_otlp_spans_dropped_total` | counter | Spans, die verworfen wurden, weil die Exportwarteschlange voll war. |
| `hotloop_flow_otlp_spans_failed_total` | counter | Spans, die der Collector nach einem erneuten Versuch nicht angenommen hat. Über null heißt: Er bekommt sie nicht. |

Auf diese Kennzahl sollten Sie den Alarm setzen: `hotloop_flow_node_queue_high_water` im Verhältnis zu `hotloop_flow_node_queue_capacity`. Der Höchststand ist die Frühwarnung, dass sich ein Flow seiner Obergrenze nähert, und sie kommt, bevor etwas verworfen wird und lange bevor jemand wach ist. Dieser Alarm ist der ganze Grund, warum wir den begrenzten Eingang gebaut haben. Man kann nicht melden, wie nah man an einer Grenze ist, die es nicht gibt, also musste die Grenze zuerst existieren.
