---
title: "Im Blick behalten"
description: "Zustand, Bereitschaft, Prometheus-Metriken und Traces je Ausführung und Schritt, damit ein hängender Auftrag im Diagramm auftaucht, nicht in einer Beschwerde."
---

`/healthz` sagt, dass der Prozess läuft. `/readyz` sagt, dass er seine Arbeit tun kann: Die Datenbank antwortet und hat das Schema, das diese Binärdatei braucht. `/metrics` ist Prometheus: Ausführungen nach Status und wie lange sie dauerten, die Zeit in jedem Schrittyp, wie viele Ausführungen in der Warteschlange sind, laufen oder warten und wie lange die älteste schon wartet, Webhook-Latenz, OAuth-Erneuerungsfehler und welche Auslöser eine Verbindung halten. Sie teilen sich die Hauptadresse oder haben mit `HOTLOOP_CASCADE_OPS_LISTEN` eine eigene (ein Worker hat keine andere Adresse und nutzt `:8081`). `HOTLOOP_CASCADE_METRICS_TOKEN` sorgt dafür, dass `/metrics` ein Bearer-Token verlangt.

Jede Ausführung ist ein OpenTelemetry-Trace mit einem Span für jeden Schritt. Legen Sie mit den Standardvariablen (`OTEL_EXPORTER_OTLP_ENDPOINT` und ihre Familie) einen OTLP-Endpunkt fest, dann werden die Spans dorthin gesendet; ist keiner festgelegt, wird nichts gesendet. Die Trace-ID ist die ID der Ausführung oder der Trace des Aufrufers, wenn ein Webhook mit einem `traceparent` ankommt, und der HTTP-Schritt gibt einen an das weiter, was er aufruft.
