---
title: "Utgivelsesnotater: HotLoop Flow 2.8.1"
description: "Hva HotLoop Flow 2.8.1 gir deg, hva som endres ved oppgradering og hva du bør lese før du rører et anlegg i drift."
sidebar:
  label: "2.8.1"
---

HotLoop Flow 2.8.1 er 2.8.0 med arm64-imaget lagt til, og ingenting annet. 2.8.0 kom bare for amd64 for å komme først i produksjon og stå som stabil, og dette er det ene lille steget som bygger begge. Ingenting endres i koden, chartet, innstillingene eller flowene dine.

## Hva som er endret

- Avbildet bygges igjen for linux/amd64 og linux/arm64. Taggene `2.8.1`, `2.8` og `2` inneholder begge.
- README-en og installasjonssidene nevner 2.8.1 og sier amd64 og arm64, som før 2.8.0.

## Nye innstillinger

Ingen.

## Oppgradering

En enkel `helm upgrade` til 2.8.1-imaget og -charten, eller den nye taggen i Quadlet-enheten din. Hvis du er på arm64 og ble på 2.7.1 mens 2.8.0 bare var amd64, er dette ditt steg til analysenodene, datainnsamlingsnoden, den varige MQTT-utgangen og TDMS-loggen: les notatene for 2.8.0 for hva de er og hva som ikke er bevist. Ingenting skjer ved første oppstart, og ingenting må migreres.

Image: `ghcr.io/hotloop-io/hotloop-flow:2.8.1`, linux/amd64 og linux/arm64. Chart: `https://hotloop.io/hotloop-flow/`. README-en på denne taggen har resten, med bilder: https://github.com/HotLoop-io/hotloop-flow/blob/v2.8.1/README.md
