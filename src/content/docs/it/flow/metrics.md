---
title: "Metriche di Flow"
description: "Le metriche Prometheus che Flow espone per nodo, così un filo intasato o una casella piena compaiono su un grafico prima di diventare un'interruzione."
---

Prometheus su `/metrics`, per nodo, con le etichette `node` e `type` su tutto ciò che è per nodo. Nessun sidecar exporter, perché un box edge non ha spazio per uno e non dovresti aver bisogno di un secondo container per scoprire che la tua casella in ingresso è piena.

| Metrica | Tipo | Cosa ti dice |
|---|---|---|
| `hotloop_flow_build_info` | gauge | Sempre 1. La versione viaggia nell'etichetta. |
| `hotloop_flow_uptime_seconds` | gauge | Secondi dall'avvio del runtime. |
| `hotloop_flow_nodes_running` | gauge | Istanze di nodo attualmente in esecuzione. |
| `hotloop_flow_node_messages_received_total` | counter | Messaggi consegnati a un nodo. |
| `hotloop_flow_node_messages_sent_total` | counter | Messaggi emessi da un nodo. |
| `hotloop_flow_node_errors_total` | counter | Errori sollevati da un nodo. |
| `hotloop_flow_node_schema_mismatches_total` | counter | Messaggi che hanno violato uno schema JSON in un nodo: sulla porta di ingresso, su una porta di uscita o in un nodo `json`. Ciascuno è andato a un nodo Catch con il percorso di ogni campo errato. |
| `hotloop_flow_node_messages_dropped_total` | counter | Messaggi scartati perché una casella in ingresso era piena. |
| `hotloop_flow_node_sends_blocked_total` | counter | Volte in cui un mittente ha atteso spazio. Back-pressure prolungata, che è il vero segnale che un flusso non regge. |
| `hotloop_flow_node_queue_length` | gauge | Messaggi in attesa in questo momento. |
| `hotloop_flow_node_queue_capacity` | gauge | Il punto in cui inizia ad applicarsi la politica di overflow. |
| `hotloop_flow_node_queue_high_water` | gauge | La profondità massima mai raggiunta da quella casella. |
| `hotloop_flow_goroutines` | gauge | Circa una per nodo più l'I/O che ciascuno detiene. |
| `hotloop_flow_memory_heap_bytes` | gauge | Heap attualmente allocato. |
| `hotloop_flow_memory_sys_bytes` | gauge | Byte presi dal sistema operativo. |
| `hotloop_flow_gc_cycles_total` | counter | Cicli di GC completati. |
| `hotloop_flow_git_mirror_behind_deployments` | gauge | Deploy che il remoto del mirror git non ha ancora. Solo con un mirror. |
| `hotloop_flow_git_mirror_push_failures_total` | counter | Push verso il mirror falliti che verranno ritentati. |
| `hotloop_flow_git_mirror_pushes_total` | counter | Push verso il mirror riusciti. |
| `hotloop_flow_durable_wire_depth` | gauge | Messaggi in attesa su un filo durevole, su disco. Etichetta `wire`. |
| `hotloop_flow_durable_wire_bytes` | gauge | Quota addebitata ai messaggi in attesa di quel filo. |
| `hotloop_flow_durable_wire_delivered_total` | counter | Messaggi che il filo ha consegnato e che la destinazione ha preso. |
| `hotloop_flow_durable_wire_retries_total` | counter | Volte in cui il filo ha rinviato un messaggio perché la destinazione lo ha rifiutato. Una destinazione ferma fa salire questo valore. |
| `hotloop_flow_durable_wire_given_up_total` | counter | Messaggi per cui il filo ha smesso di riprovare perché `ew_durable_attempts` del nodo si è esaurito. Ciascuno è passato al flusso come errore con il messaggio allegato. |
| `hotloop_flow_durable_wire_dropped_total` | counter | Messaggi che la politica di quota ha rifiutato o espulso, e code svuotate quando un filo ha smesso di essere durevole. |
| `hotloop_flow_durable_bytes`, `hotloop_flow_durable_max_bytes` | gauge | Quota usata da tutti i fili durevoli insieme, e la quota. |
| `hotloop_flow_context_flushes_total`, `hotloop_flow_context_rows_written_total` | counter | Transazioni che hanno scritto il contesto, e righe effettivamente modificate. |
| `hotloop_flow_context_flush_failures_total` | counter | Scritture del contesto fallite. Le modifiche vengono conservate e riprovate. Dovrebbe essere zero. |
| `hotloop_flow_audit_write_failures_total` | counter | Voci di audit che non è stato possibile scrivere. Dovrebbe restare zero per sempre. |
| `hotloop_flow_traces_kept` | gauge | Tracce di messaggi nel buffer in questo momento. |
| `hotloop_flow_trace_bytes` | gauge | Più o meno quanto occupano. Limitato da `trace.maxBytes`. |
| `hotloop_flow_traces_started_total` | counter | Tracce di messaggi avviate. |
| `hotloop_flow_traces_forgotten_total` | counter | Tracce espulse per fare spazio. |
| `hotloop_flow_traces_skipped_total` | counter | Messaggi non tracciati perché si è raggiunto `trace.perSecond`. |
| `hotloop_flow_trace_hops_dropped_total` | counter | Passaggi non registrati: la loro traccia era piena o già dimenticata. |
| `hotloop_flow_otlp_spans_exported_total` | counter | Span che il collector OpenTelemetry ha accettato. Solo con un endpoint. |
| `hotloop_flow_otlp_spans_dropped_total` | counter | Span scartati perché la coda di esportazione era piena. |
| `hotloop_flow_otlp_spans_failed_total` | counter | Span che il collector non ha preso dopo un nuovo tentativo. Sopra zero significa che non li riceve. |

Quella su cui impostare un allarme è `hotloop_flow_node_queue_high_water` rispetto a `hotloop_flow_node_queue_capacity`. Il livello massimo è l'avviso precoce che un flusso si avvicina al suo tetto, che arriva prima che si scarti qualcosa e molto prima che qualcuno sia sveglio. Quell'allarme è l'intera ragione per cui abbiamo costruito la casella in ingresso limitata. Non puoi riferire quanto sei vicino a un limite che non esiste, quindi il limite doveva esistere per primo.
