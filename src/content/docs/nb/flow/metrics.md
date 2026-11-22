---
title: "Flow-måledata"
description: "Prometheus-måledataene Flow viser per node, slik at en opphopet kobling eller en full innboks vises i en graf før den vises som et driftsstopp."
---

Prometheus på `/metrics`, per node, med `node`- og `type`-etiketter på alt som er per node. Ingen eksportør-sidecar, fordi en kantboks ikke har plass til en, og du skal ikke trenge en ekstra container for å finne ut at innboksen din er full.

| Måledata | Type | Hva den forteller deg |
|---|---|---|
| `hotloop_flow_build_info` | gauge | Alltid 1. Versjonen ligger i etiketten. |
| `hotloop_flow_uptime_seconds` | gauge | Sekunder siden kjøretiden startet. |
| `hotloop_flow_nodes_running` | gauge | Nodeinstanser som kjører nå. |
| `hotloop_flow_node_messages_received_total` | counter | Meldinger levert til en node. |
| `hotloop_flow_node_messages_sent_total` | counter | Meldinger en node har sendt ut. |
| `hotloop_flow_node_errors_total` | counter | Feil en node har gitt. |
| `hotloop_flow_node_schema_mismatches_total` | counter | Meldinger som brøt et JSON-skjema i en node: på inngangsporten, på en utgangsport eller i en `json`-node. Hver gikk til en Catch-node med stien til hvert feilaktige felt. |
| `hotloop_flow_node_messages_dropped_total` | counter | Meldinger forkastet fordi en innboks var full. |
| `hotloop_flow_node_sends_blocked_total` | counter | Ganger en avsender ventet på plass. Vedvarende mottrykk, som er det egentlige signalet på at en flyt ikke henger med. |
| `hotloop_flow_node_queue_length` | gauge | Meldinger som venter akkurat nå. |
| `hotloop_flow_node_queue_capacity` | gauge | Der overflytpolicyen begynner å gjelde. |
| `hotloop_flow_node_queue_high_water` | gauge | Det dypeste innboksen noen gang har vært. |
| `hotloop_flow_goroutines` | gauge | Omtrent én per node pluss I/O-en hver holder. |
| `hotloop_flow_memory_heap_bytes` | gauge | Heap som er allokert nå. |
| `hotloop_flow_memory_sys_bytes` | gauge | Byte tatt fra operativsystemet. |
| `hotloop_flow_gc_cycles_total` | counter | Fullførte GC-sykluser. |
| `hotloop_flow_git_mirror_behind_deployments` | gauge | Utrullinger som git-speilets fjernlager ikke har ennå. Bare med speil. |
| `hotloop_flow_git_mirror_push_failures_total` | counter | Pushes til speilet som mislyktes og blir forsøkt på nytt. |
| `hotloop_flow_git_mirror_pushes_total` | counter | Pushes til speilet som lyktes. |
| `hotloop_flow_durable_wire_depth` | gauge | Meldinger som venter på en varig kobling, på disk. Etikett `wire`. |
| `hotloop_flow_durable_wire_bytes` | gauge | Kvote belastet for meldingene som venter på den koblingen. |
| `hotloop_flow_durable_wire_delivered_total` | counter | Meldinger koblingen leverte og målet tok imot. |
| `hotloop_flow_durable_wire_retries_total` | counter | Ganger koblingen sendte en melding på nytt fordi målet avviste den. Et mål som er nede får denne til å stige. |
| `hotloop_flow_durable_wire_given_up_total` | counter | Meldinger koblingen sluttet å prøve på nytt fordi nodens `ew_durable_attempts` var brukt opp. Hver gikk til flyten som en feil med meldingen vedlagt. |
| `hotloop_flow_durable_wire_dropped_total` | counter | Meldinger kvotepolicyen avviste eller kastet ut, og køer som ble tømt da en kobling sluttet å være varig. |
| `hotloop_flow_durable_bytes`, `hotloop_flow_durable_max_bytes` | gauge | Kvote brukt av alle varige koblinger til sammen, og selve kvoten. |
| `hotloop_flow_context_flushes_total`, `hotloop_flow_context_rows_written_total` | counter | Transaksjoner som skrev kontekst, og radene de faktisk endret. |
| `hotloop_flow_context_flush_failures_total` | counter | Kontekstskrivinger som mislyktes. Endringene beholdes og prøves på nytt. Bør være null. |
| `hotloop_flow_audit_write_failures_total` | counter | Revisjonsoppføringer som ikke kunne skrives. Bør være null for alltid. |
| `hotloop_flow_traces_kept` | gauge | Meldingssporinger i bufferen akkurat nå. |
| `hotloop_flow_trace_bytes` | gauge | Omtrent hva de opptar. Begrenset av `trace.maxBytes`. |
| `hotloop_flow_traces_started_total` | counter | Meldingssporinger som er startet. |
| `hotloop_flow_traces_forgotten_total` | counter | Sporinger som ble presset ut for å gi plass. |
| `hotloop_flow_traces_skipped_total` | counter | Meldinger som ikke ble sporet fordi `trace.perSecond` var nådd. |
| `hotloop_flow_trace_hops_dropped_total` | counter | Hopp som ikke ble skrevet ned: sporingen var full eller allerede glemt. |
| `hotloop_flow_otlp_spans_exported_total` | counter | Spans OpenTelemetry-samleren tok imot. Bare med endepunkt. |
| `hotloop_flow_otlp_spans_dropped_total` | counter | Spans forkastet fordi eksportkøen var full. |
| `hotloop_flow_otlp_spans_failed_total` | counter | Spans samleren ikke tok imot etter et nytt forsøk. Over null betyr at den ikke får dem. |

Den du bør varsle på er `hotloop_flow_node_queue_high_water` mot `hotloop_flow_node_queue_capacity`. Høyvannsmerket er tidligvarselet om at en flyt nærmer seg taket sitt, som kommer før noe forkastes og lenge før noen er våkne. Det varselet er hele grunnen til at vi bygde den avgrensede innboksen. Du kan ikke melde hvor nær du er en grense som ikke finnes, så grensen måtte finnes først.
