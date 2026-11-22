---
title: "Метрики на Flow"
description: "Prometheus метриките, които Flow предоставя за всеки възел, така че задръстен проводник или пълна входяща кутия да се покаже на графика, преди да стане срив."
---

Prometheus на `/metrics`, за всеки възел, с етикети `node` и `type` върху всичко, което е за възел. Без допълнителен контейнер за експортиране, защото една гранична кутия няма място за такъв и не бива да ви трябва втори контейнер, за да разберете, че входящата ви кутия е пълна.

| Метрика | Тип | Какво ви казва |
|---|---|---|
| `hotloop_flow_build_info` | gauge | Винаги 1. Версията е в етикета. |
| `hotloop_flow_uptime_seconds` | gauge | Секунди от стартирането на средата за изпълнение. |
| `hotloop_flow_nodes_running` | gauge | Инстанции на възли, които работят в момента. |
| `hotloop_flow_node_messages_received_total` | counter | Съобщения, доставени до възел. |
| `hotloop_flow_node_messages_sent_total` | counter | Съобщения, излъчени от възел. |
| `hotloop_flow_node_errors_total` | counter | Грешки, предизвикани от възел. |
| `hotloop_flow_node_schema_mismatches_total` | counter | Съобщения, нарушили JSON схема във възел: на входния му порт, на изходен порт или в `json` възел. Всяко е отишло до Catch възел с пътя на всяко грешно поле. |
| `hotloop_flow_node_messages_dropped_total` | counter | Съобщения, отхвърлени, защото входяща кутия е била пълна. |
| `hotloop_flow_node_sends_blocked_total` | counter | Пъти, в които подател е чакал за място. Продължителен обратен натиск, който е истинският сигнал, че потокът не смогва. |
| `hotloop_flow_node_queue_length` | gauge | Съобщения, които чакат в момента. |
| `hotloop_flow_node_queue_capacity` | gauge | Откъде започва да важи политиката при препълване. |
| `hotloop_flow_node_queue_high_water` | gauge | Най-голямата дълбочина, достигана някога от тази входяща кутия. |
| `hotloop_flow_goroutines` | gauge | Приблизително по една на възел плюс I/O, което всеки държи. |
| `hotloop_flow_memory_heap_bytes` | gauge | Heap, отделен в момента. |
| `hotloop_flow_memory_sys_bytes` | gauge | Байтове, взети от операционната система. |
| `hotloop_flow_gc_cycles_total` | counter | Завършени GC цикли. |
| `hotloop_flow_git_mirror_behind_deployments` | gauge | Внедрявания, които отдалеченото хранилище на git огледалото още няма. Само с огледало. |
| `hotloop_flow_git_mirror_push_failures_total` | counter | Изпращания към огледалото, които са се провалили и ще бъдат опитани отново. |
| `hotloop_flow_git_mirror_pushes_total` | counter | Изпращания към огледалото, които са успели. |
| `hotloop_flow_durable_wire_depth` | gauge | Съобщения, които чакат на траен проводник, на диска. Етикет `wire`. |
| `hotloop_flow_durable_wire_bytes` | gauge | Квота, начислена на чакащите съобщения на този проводник. |
| `hotloop_flow_durable_wire_delivered_total` | counter | Съобщения, които проводникът е предал и целта е приела. |
| `hotloop_flow_durable_wire_retries_total` | counter | Пъти, в които проводникът е изпратил съобщение отново, защото целта му го е отхвърлила. Спряла цел вдига този брояч. |
| `hotloop_flow_durable_wire_given_up_total` | counter | Съобщения, при които проводникът е спрял опитите, защото `ew_durable_attempts` на възела е изчерпано. Всяко е отишло към потока като грешка с приложеното съобщение. |
| `hotloop_flow_durable_wire_dropped_total` | counter | Съобщения, които политиката за квота е отказала или изхвърлила, и опашки, изчистени, когато проводник е спрял да бъде траен. |
| `hotloop_flow_durable_bytes`, `hotloop_flow_durable_max_bytes` | gauge | Квота, използвана от всички трайни проводници заедно, и самата квота. |
| `hotloop_flow_context_flushes_total`, `hotloop_flow_context_rows_written_total` | counter | Транзакции, които са записали контекст, и редовете, които действително са променили. |
| `hotloop_flow_context_flush_failures_total` | counter | Записи на контекст, които са се провалили. Промените се запазват и се опитват отново. Трябва да е нула. |
| `hotloop_flow_audit_write_failures_total` | counter | Записи за одит, които не са могли да бъдат записани. Трябва да е нула завинаги. |
| `hotloop_flow_traces_kept` | gauge | Проследявания на съобщения в буфера в момента. |
| `hotloop_flow_trace_bytes` | gauge | Приблизително какво заемат. Ограничено от `trace.maxBytes`. |
| `hotloop_flow_traces_started_total` | counter | Започнати проследявания на съобщения. |
| `hotloop_flow_traces_forgotten_total` | counter | Проследявания, изместени, за да се освободи място. |
| `hotloop_flow_traces_skipped_total` | counter | Съобщения, които не са проследени, защото е достигнато `trace.perSecond`. |
| `hotloop_flow_trace_hops_dropped_total` | counter | Прескоци, които не са записани: проследяването им е било пълно или вече забравено. |
| `hotloop_flow_otlp_spans_exported_total` | counter | Спанове, приети от колектора на OpenTelemetry. Само с крайна точка. |
| `hotloop_flow_otlp_spans_dropped_total` | counter | Спанове, отхвърлени, защото опашката за експорт е била пълна. |
| `hotloop_flow_otlp_spans_failed_total` | counter | Спанове, които колекторът не е приел след повторен опит. Над нула означава, че не ги получава. |

Тази, върху която да настроите известяване, е `hotloop_flow_node_queue_high_water` спрямо `hotloop_flow_node_queue_capacity`. Високото ниво е ранното предупреждение, че потокът се приближава към тавана си, което идва, преди нещо да бъде отхвърлено, и много преди някой да е буден. Това известяване е цялата причина да изградим ограничената входяща кутия. Не можете да докладвате колко близо сте до граница, която не съществува, така че границата трябваше да съществува първа.
