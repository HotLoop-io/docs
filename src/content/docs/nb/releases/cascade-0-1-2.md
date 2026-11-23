---
title: "Utgivelsesnotater: HotLoop Cascade 0.1.2"
description: "Hva HotLoop Cascade 0.1.2 inneholder, hva som endres ved oppgradering og hva du bør lese før du rører et anlegg i drift."
sidebar:
  label: "0.1.2"
---

## Hva dette er

0.1.2 er en byggerettelse og ingenting annet. Koden er den samme som 0.1.1, og det er alt du kjører også: chartet, Quadlet-enhetene, innstillingene, databasen.

Cascade bygges og publiseres nå på Podman hele veien, og avbildet inneholder nøyaktig amd64 og arm64.

## Oppgradere fra 0.1.1

Ingenting å gjøre. `helm upgrade` til 0.1.2, eller la `:stable` flytte Quadlet-enhetene. Ingen migreringer, ingen nye innstillinger, og nøkkelen og arbeidsflytene dine blir der de var.
