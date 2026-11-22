---
title: "Ta med en arbeidsflyt"
description: "Importer en eksisterende arbeidsflyt til Cascade: hva som tas med, og hva importen sier at den ikke kunne ta med."
---

`hotloop-cascade workflows convert export.json -o workflow.yaml --report report.json` konverterer en arbeidsflyt eksportert som JSON fra et annet verktøy. Den tar med det den kan være sikker på: trinnene den kjenner og feltavlesningene i innstillingene deres. Alt annet kommer over avslått, med de opprinnelige innstillingene i notatene, og rapporten lister hver enkelt og hvorfor. Den gjør aldri et JavaScript-uttrykk om til et gjett på hva det mente, og den tar aldri med legitimasjon, fordi en eksport ikke har noen: rapporten sier hvilken plass som trenger hvilken. Deretter legger `workflows import workflow.yaml` den inn.
