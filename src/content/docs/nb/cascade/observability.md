---
title: "Hold øye med den"
description: "Helse, beredskap, Prometheus-målinger og spor for hver kjøring og hvert trinn, så en fastlåst jobb dukker opp i en graf og ikke i en klage."
---

`/healthz` sier at prosessen er oppe. `/readyz` sier at den kan gjøre jobben sin: databasen svarer og har skjemaet denne binærfilen trenger. `/metrics` er Prometheus: kjøringer etter status og hvor lang tid de tok, tiden brukt i hver trinntype, hvor mange kjøringer som står i kø, kjører eller venter og hvor lenge den eldste har ventet, webhook-latens, feil ved OAuth-fornyelse og hvilke utløsere som holder en tilkobling. De deler hovedadressen, eller har en egen adresse med `HOTLOOP_CASCADE_OPS_LISTEN` (en worker har ingen annen adresse og bruker `:8081`). `HOTLOOP_CASCADE_METRICS_TOKEN` gjør at `/metrics` krever et bearer-token.

Hver kjøring er ett OpenTelemetry-spor med en span for hvert trinn. Oppgi et OTLP-endepunkt med standardvariablene (`OTEL_EXPORTER_OTLP_ENDPOINT` og de som hører til) så sendes spans dit; er ingen oppgitt, sendes ingenting. Spor-ID-en er kjøringens ID, eller sporet til den som kaller når en webhook kommer inn med en `traceparent`, og HTTP-trinnet sender en videre til det det kaller.
