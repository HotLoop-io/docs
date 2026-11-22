---
title: "Métriques de Flow"
description: "Les métriques Prometheus que Flow expose par nœud, pour qu'un fil saturé ou une boîte pleine apparaisse sur un graphique avant de devenir une panne."
---

Prometheus sur `/metrics`, par nœud, avec les étiquettes `node` et `type` sur tout ce qui est par nœud. Pas de conteneur exportateur annexe, parce qu'un boîtier en périphérie n'a pas la place d'en accueillir un et que vous ne devriez pas avoir besoin d'un second conteneur pour savoir que votre boîte de réception est pleine.

| Métrique | Type | Ce qu'elle vous dit |
|---|---|---|
| `hotloop_flow_build_info` | gauge | Toujours 1. La version est portée par l'étiquette. |
| `hotloop_flow_uptime_seconds` | gauge | Secondes écoulées depuis le démarrage de l'exécution. |
| `hotloop_flow_nodes_running` | gauge | Instances de nœud en cours d'exécution. |
| `hotloop_flow_node_messages_received_total` | counter | Messages remis à un nœud. |
| `hotloop_flow_node_messages_sent_total` | counter | Messages qu'un nœud a émis. |
| `hotloop_flow_node_errors_total` | counter | Erreurs levées par un nœud. |
| `hotloop_flow_node_schema_mismatches_total` | counter | Messages qui ont enfreint un schéma JSON sur un nœud : sur son port d'entrée, sur un port de sortie ou dans un nœud `json`. Chacun est allé vers un nœud Catch avec le chemin de chaque champ erroné. |
| `hotloop_flow_node_messages_dropped_total` | counter | Messages écartés parce qu'une boîte de réception était pleine. |
| `hotloop_flow_node_sends_blocked_total` | counter | Nombre de fois qu'un émetteur a attendu de la place. Une contre-pression soutenue, qui est le vrai signal qu'un flux ne suit pas. |
| `hotloop_flow_node_queue_length` | gauge | Messages en attente à l'instant. |
| `hotloop_flow_node_queue_capacity` | gauge | Le point à partir duquel la politique de débordement s'applique. |
| `hotloop_flow_node_queue_high_water` | gauge | La profondeur maximale jamais atteinte par cette boîte de réception. |
| `hotloop_flow_goroutines` | gauge | Environ une par nœud plus les E/S que chacun détient. |
| `hotloop_flow_memory_heap_bytes` | gauge | Tas actuellement alloué. |
| `hotloop_flow_memory_sys_bytes` | gauge | Octets pris au système d'exploitation. |
| `hotloop_flow_gc_cycles_total` | counter | Cycles de GC terminés. |
| `hotloop_flow_git_mirror_behind_deployments` | gauge | Déploiements que le dépôt distant du miroir git n'a pas encore. Seulement avec un miroir. |
| `hotloop_flow_git_mirror_push_failures_total` | counter | Envois vers le miroir qui ont échoué et seront retentés. |
| `hotloop_flow_git_mirror_pushes_total` | counter | Envois vers le miroir qui ont réussi. |
| `hotloop_flow_durable_wire_depth` | gauge | Messages en attente sur un fil durable, sur disque. Étiquette `wire`. |
| `hotloop_flow_durable_wire_bytes` | gauge | Quota imputé aux messages en attente de ce fil. |
| `hotloop_flow_durable_wire_delivered_total` | counter | Messages que le fil a remis et que la cible a pris. |
| `hotloop_flow_durable_wire_retries_total` | counter | Nombre de fois que le fil a renvoyé un message parce que sa cible l'a refusé. Une cible à l'arrêt fait grimper ce compteur. |
| `hotloop_flow_durable_wire_given_up_total` | counter | Messages que le fil a cessé de réessayer parce que `ew_durable_attempts` du nœud était épuisé. Chacun est passé au flux comme une erreur avec le message joint. |
| `hotloop_flow_durable_wire_dropped_total` | counter | Messages que la politique de quota a refusés ou évincés, et files purgées quand un fil a cessé d'être durable. |
| `hotloop_flow_durable_bytes`, `hotloop_flow_durable_max_bytes` | gauge | Quota utilisé par tous les fils durables ensemble, et le quota. |
| `hotloop_flow_context_flushes_total`, `hotloop_flow_context_rows_written_total` | counter | Transactions qui ont écrit du contexte, et lignes réellement modifiées. |
| `hotloop_flow_context_flush_failures_total` | counter | Vidages de contexte qui ont échoué. Les changements sont conservés et retentés. Devrait être zéro. |
| `hotloop_flow_audit_write_failures_total` | counter | Entrées d'audit qui n'ont pas pu être écrites. Devrait rester à zéro pour toujours. |
| `hotloop_flow_traces_kept` | gauge | Traces de messages dans le tampon à l'instant. |
| `hotloop_flow_trace_bytes` | gauge | À peu près ce qu'elles occupent. Borné par `trace.maxBytes`. |
| `hotloop_flow_traces_started_total` | counter | Traces de messages démarrées. |
| `hotloop_flow_traces_forgotten_total` | counter | Traces évincées pour faire de la place. |
| `hotloop_flow_traces_skipped_total` | counter | Messages non tracés parce que `trace.perSecond` était atteint. |
| `hotloop_flow_trace_hops_dropped_total` | counter | Sauts non consignés : leur trace était pleine ou déjà oubliée. |
| `hotloop_flow_otlp_spans_exported_total` | counter | Spans que le collecteur OpenTelemetry a acceptés. Seulement avec un point de terminaison. |
| `hotloop_flow_otlp_spans_dropped_total` | counter | Spans écartés parce que la file d'export était pleine. |
| `hotloop_flow_otlp_spans_failed_total` | counter | Spans que le collecteur n'a pas pris après une nouvelle tentative. Au-dessus de zéro, il ne les reçoit pas. |

La métrique à surveiller par une alerte est `hotloop_flow_node_queue_high_water` rapportée à `hotloop_flow_node_queue_capacity`. Le niveau maximal est l'alerte précoce qu'un flux approche de son plafond, qui arrive avant que quoi que ce soit soit écarté et bien avant que quelqu'un soit réveillé. Cette alerte est la raison d'être de la boîte de réception bornée. On ne peut pas dire à quelle distance on se trouve d'une limite qui n'existe pas, il fallait donc que la limite existe d'abord.
