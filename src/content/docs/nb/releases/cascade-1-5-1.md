---
title: "Utgivelsesnotater: HotLoop Cascade 1.5.1"
description: "Hva HotLoop Cascade 1.5.1 inneholder, hva som endres ved oppgradering og hva du bør lese før du rører et anlegg i drift."
sidebar:
  label: "1.5.1"
---

## Hva dette er

1.5.1 er 1.5.0 med arm64-avbildet lagt til. Koden er 1.5.0s, chartet endrer bare versjonen sin, og hver innstilling, rute, skjerm og verktøy er det 1.5.0 har, inkludert at en eier sletter en person.

## Hvorfor det er sin egen utgivelse

Multi-arkitektur kommer i sin egen kjøring. 1.5.0 ble bygget bare for amd64, og dette er det lille versjonsløftet som bygger begge. Herfra lister `stable`, `latest`, `1.5`, `1` og `1.5.1` amd64 og arm64.

## Oppgradere, og gå tilbake

Ingen migreringer. `helm upgrade` til 1.5.1, eller la `:stable` flytte Quadlet-enhetene. En arm64-maskin som har hentet arm64-avbildet 1.4.2 leverte, får nå det fra 1.5.1. Det er trygt å sette 1.5.0 eller 1.4.2 tilbake, fordi ingenting i databasen endret seg.
