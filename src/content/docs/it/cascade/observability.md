---
title: "Tenerlo sotto controllo"
description: "Stato, prontezza, metriche Prometheus e trace per ogni esecuzione e passaggio, così un lavoro bloccato compare su un grafico e non in un reclamo."
---

`/healthz` indica che il processo è attivo. `/readyz` indica che può svolgere il suo lavoro: il database risponde e ha lo schema di cui questo binario ha bisogno. `/metrics` è Prometheus: esecuzioni per stato e quanto sono durate, il tempo speso in ogni tipo di passaggio, quante esecuzioni sono in coda, in corso o in attesa e da quanto aspetta la più vecchia, la latenza dei webhook, gli errori di rinnovo OAuth e quali trigger tengono una connessione. Condividono l'indirizzo principale oppure hanno un indirizzo proprio con `HOTLOOP_CASCADE_OPS_LISTEN` (un worker non ha altro indirizzo e usa `:8081`). `HOTLOOP_CASCADE_METRICS_TOKEN` fa richiedere a `/metrics` un token bearer.

Ogni esecuzione è una trace OpenTelemetry con uno span per ogni passaggio. Indicare un endpoint OTLP con le variabili standard (`OTEL_EXPORTER_OTLP_ENDPOINT` e la sua famiglia) e gli span vengono inviati lì; se non ne è indicato nessuno, non viene inviato nulla. L'id della trace è l'id dell'esecuzione, oppure la trace di chi chiama quando un webhook arriva con un `traceparent`, e il passaggio HTTP ne inoltra una a ciò che chiama.
