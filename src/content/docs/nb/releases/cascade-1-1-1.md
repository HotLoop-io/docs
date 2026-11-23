---
title: "Utgivelsesnotater: HotLoop Cascade 1.1.1"
description: "Hva HotLoop Cascade 1.1.1 inneholder, hva som endres ved oppgradering og hva du bør lese før du rører et anlegg i drift."
sidebar:
  label: "1.1.1"
---

## Hva dette er

1.1.1 er 1.1.0 med arm64-avbildet lagt til, og en etikett. Koden er 1.1.0s, chartet endrer bare versjonen sin, og hver innstilling, rute og skjerm er det 1.1.0 har.

Etiketten er `org.opencontainers.image.version`. Avbildet hadde den aldri, så konfigurasjonen viste ingen versjon. Den sier nå utgivelsens versjon, satt fra samme byggeargument som binærfilens versjon kommer fra.

## Hvorfor det er sin egen utgivelse

Multi-arkitektur kommer i sin egen kjøring. 1.1.0 ble bygget bare for amd64, gikk til produksjon og leste som stabil der, og dette er det lille versjonsløftet som bygger begge. Herfra lister `stable`, `latest`, `1.1`, `1` og `1.1.1` amd64 og arm64.

## Oppgradere, og gå tilbake

Ingen migreringer. `helm upgrade` til 1.1.1, eller la `:stable` flytte Quadlet-enhetene. En arm64-maskin som har hentet arm64-avbildet 1.0.2 leverte, får nå det fra 1.1.1. Det er trygt å sette 1.1.0 eller 1.0.2 tilbake, fordi ingenting i databasen endret seg.
