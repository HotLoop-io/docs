---
title: "Métricas de Flow"
description: "Las métricas de Prometheus que Flow expone por nodo, para que un cable saturado o una bandeja llena aparezcan en un gráfico antes de convertirse en una caída."
---

Prometheus en `/metrics`, por nodo, con las etiquetas `node` y `type` en todo lo que es por nodo. Sin sidecar exportador, porque una caja de borde no tiene espacio para uno y no debería hacerle falta un segundo contenedor para saber que su bandeja de entrada está llena.

| Métrica | Tipo | Qué le dice |
|---|---|---|
| `hotloop_flow_build_info` | gauge | Siempre 1. La versión va en la etiqueta. |
| `hotloop_flow_uptime_seconds` | gauge | Segundos desde que arrancó el entorno de ejecución. |
| `hotloop_flow_nodes_running` | gauge | Instancias de nodo en ejecución ahora mismo. |
| `hotloop_flow_node_messages_received_total` | counter | Mensajes entregados a un nodo. |
| `hotloop_flow_node_messages_sent_total` | counter | Mensajes que un nodo ha emitido. |
| `hotloop_flow_node_errors_total` | counter | Errores que generó un nodo. |
| `hotloop_flow_node_schema_mismatches_total` | counter | Mensajes que incumplieron un esquema JSON en un nodo: en su puerto de entrada, en un puerto de salida o en un nodo `json`. Cada uno fue a un nodo Catch con la ruta de cada campo incorrecto. |
| `hotloop_flow_node_messages_dropped_total` | counter | Mensajes descartados porque una bandeja de entrada estaba llena. |
| `hotloop_flow_node_sends_blocked_total` | counter | Veces que un emisor esperó a que hubiera espacio. Contrapresión sostenida, que es la señal real de que un flujo no puede seguir el ritmo. |
| `hotloop_flow_node_queue_length` | gauge | Mensajes en espera ahora mismo. |
| `hotloop_flow_node_queue_capacity` | gauge | Dónde empieza a aplicarse la política de desbordamiento. |
| `hotloop_flow_node_queue_high_water` | gauge | Lo más profunda que ha llegado a estar esa bandeja. |
| `hotloop_flow_goroutines` | gauge | Aproximadamente una por nodo más la E/S que cada uno mantiene. |
| `hotloop_flow_memory_heap_bytes` | gauge | Heap asignado actualmente. |
| `hotloop_flow_memory_sys_bytes` | gauge | Bytes tomados del sistema operativo. |
| `hotloop_flow_gc_cycles_total` | counter | Ciclos de GC completados. |
| `hotloop_flow_git_mirror_behind_deployments` | gauge | Despliegues que el remoto del espejo de git aún no tiene. Solo con un espejo. |
| `hotloop_flow_git_mirror_push_failures_total` | counter | Envíos al espejo que fallaron y se reintentarán. |
| `hotloop_flow_git_mirror_pushes_total` | counter | Envíos al espejo que tuvieron éxito. |
| `hotloop_flow_durable_wire_depth` | gauge | Mensajes en espera en un cable durable, en disco. Etiqueta `wire`. |
| `hotloop_flow_durable_wire_bytes` | gauge | Cuota cargada a los mensajes en espera de ese cable. |
| `hotloop_flow_durable_wire_delivered_total` | counter | Mensajes que el cable entregó y que el destino aceptó. |
| `hotloop_flow_durable_wire_retries_total` | counter | Veces que el cable reenvió un mensaje porque su destino lo rechazó. Un destino caído hace subir este valor. |
| `hotloop_flow_durable_wire_given_up_total` | counter | Mensajes que el cable dejó de reintentar porque se agotó `ew_durable_attempts` del nodo. Cada uno pasó al flujo como un error con el mensaje adjunto. |
| `hotloop_flow_durable_wire_dropped_total` | counter | Mensajes que la política de cuota rechazó o expulsó, y colas purgadas cuando un cable dejó de ser durable. |
| `hotloop_flow_durable_bytes`, `hotloop_flow_durable_max_bytes` | gauge | Cuota usada por todos los cables durables juntos, y la cuota. |
| `hotloop_flow_context_flushes_total`, `hotloop_flow_context_rows_written_total` | counter | Transacciones que escribieron contexto, y filas que realmente cambiaron. |
| `hotloop_flow_context_flush_failures_total` | counter | Volcados de contexto que fallaron. Los cambios se conservan y se reintentan. Debería ser cero. |
| `hotloop_flow_audit_write_failures_total` | counter | Entradas de auditoría que no se pudieron escribir. Debería ser cero siempre. |
| `hotloop_flow_traces_kept` | gauge | Trazas de mensajes en el búfer ahora mismo. |
| `hotloop_flow_trace_bytes` | gauge | Aproximadamente lo que ocupan. Acotado por `trace.maxBytes`. |
| `hotloop_flow_traces_started_total` | counter | Trazas de mensajes iniciadas. |
| `hotloop_flow_traces_forgotten_total` | counter | Trazas desplazadas para hacer sitio. |
| `hotloop_flow_traces_skipped_total` | counter | Mensajes sin traza porque se alcanzó `trace.perSecond`. |
| `hotloop_flow_trace_hops_dropped_total` | counter | Saltos no registrados: su traza estaba llena u olvidada. |
| `hotloop_flow_otlp_spans_exported_total` | counter | Spans que el colector de OpenTelemetry aceptó. Solo con un endpoint. |
| `hotloop_flow_otlp_spans_dropped_total` | counter | Spans descartados porque la cola de exportación estaba llena. |
| `hotloop_flow_otlp_spans_failed_total` | counter | Spans que el colector no aceptó tras un reintento. Por encima de cero significa que no los recibe. |

La que conviene vigilar con una alerta es `hotloop_flow_node_queue_high_water` frente a `hotloop_flow_node_queue_capacity`. La marca máxima es el aviso temprano de que un flujo se acerca a su techo, que llega antes de que se descarte nada y mucho antes de que alguien esté despierto. Esa alerta es la razón de ser de la bandeja de entrada acotada. No se puede informar de lo cerca que se está de un límite que no existe, así que el límite tenía que existir primero.
