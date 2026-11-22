---
title: "Supervisión"
description: "Estado, disponibilidad, métricas de Prometheus y trazas de cada ejecución y paso, para que un trabajo atascado aparezca en una gráfica y no en una queja."
---

`/healthz` indica que el proceso está activo. `/readyz` indica que puede hacer su trabajo: la base de datos responde y tiene el esquema que necesita este binario. `/metrics` es Prometheus: ejecuciones por estado y cuánto tardaron, el tiempo dedicado a cada tipo de paso, cuántas ejecuciones están en cola, en curso o en espera y cuánto lleva esperando la más antigua, la latencia de los webhooks, los fallos de renovación de OAuth y qué disparadores mantienen una conexión. Comparten la dirección principal o tienen una propia con `HOTLOOP_CASCADE_OPS_LISTEN` (un worker no tiene otra dirección y usa `:8081`). `HOTLOOP_CASCADE_METRICS_TOKEN` hace que `/metrics` exija un token de portador.

Cada ejecución es una traza de OpenTelemetry con un span por cada paso. Indique un endpoint OTLP con las variables estándar (`OTEL_EXPORTER_OTLP_ENDPOINT` y su familia) y los spans se envían allí; si no se indica ninguno, no se envía nada. El id de la traza es el id de la ejecución, o la traza del llamante cuando un webhook llega con un `traceparent`, y el paso HTTP envía uno a lo que llama.
