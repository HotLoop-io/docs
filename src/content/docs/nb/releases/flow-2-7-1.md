---
title: "Utgivelsesnotater: HotLoop Flow 2.7.1"
description: "Hva HotLoop Flow 2.7.1 gir deg, hva som endres ved oppgradering og hva du bør lese før du rører et anlegg i drift."
sidebar:
  label: "2.7.1"
---

HotLoop Flow 2.7.1 er 2.7.0 med arm64-imaget lagt til, og ingenting annet. 2.7.0 kom bare for amd64 for å komme først i produksjon og stå som stabil, og dette er det ene lille steget som bygger begge. Ingenting endres i koden, chartet, innstillingene eller flowene dine.

## Hva som er endret

- Imaget bygges for linux/amd64 og linux/arm64 igjen. Taggene `2.7.1`, `2.7` og `2` har begge.
- README-en og installasjonssidene nevner 2.7.1 og sier amd64 og arm64, som før 2.7.0.

## Nye innstillinger

Ingen.

## Oppgradering

En enkel `helm upgrade` til 2.7.1-imaget og -charten, eller den nye taggen i Quadlet-enheten din. Hvis du er på arm64 og ble på 2.6.0 mens 2.7.0 bare var amd64, er dette ditt steg til FlowLab: les notatene for 2.7.0 for hva det er og hva det ikke er ennå. Ingenting skjer ved første oppstart, og ingenting må migreres.

Image: `ghcr.io/hotloop-io/hotloop-flow:2.7.1`, linux/amd64 og linux/arm64. Chart: `https://hotloop.io/hotloop-flow/`. README-en på denne taggen har resten, med bilder: https://github.com/HotLoop-io/hotloop-flow/blob/v2.7.1/README.md
