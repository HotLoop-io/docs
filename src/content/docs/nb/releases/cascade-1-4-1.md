---
title: "Utgivelsesnotater: HotLoop Cascade 1.4.1"
description: "Hva HotLoop Cascade 1.4.1 inneholder, hva som endres ved oppgradering og hva du bør lese før du rører et anlegg i drift."
sidebar:
  label: "1.4.1"
---

## Hva dette er

1.4.1 retter én ting på Innstillinger-siden og rydder språkmappene. Motoren, filformatet, REST-API-et, MCP-serveren og alle andre skjermer er som i 1.4.0.

## Innstillinger-siden beholder det du endret

Hver Lagre på Innstillinger-siden besvares med innstillingene slik serveren har dem. Hvis du endret et felt etter at du trykket Lagre og før svaret kom tilbake, satte svaret feltet tilbake til verdien du nettopp hadde forlatt, uten noen melding. En administrator som lagret og straks endret det neste feltet, kunne miste den endringen.

Nå tar et felt som fortsatt holder det som ble sendt, serverens verdi, og et felt du har redigert siden, beholder redigeringen din. En nettlesertest holder svaret tilbake i halvannet sekund og endrer et felt i mellomtiden. På 1.4.0s side feiler den (den viser den første verdien der den andre var satt), og på denne siden består den.

## Språkmappene

`_review.json`-listene i hver språkmappe er borte, og det samme er byggesjekken som leste dem. Ingenting annet leste dem, og ingen gjennomgang av morsmålsbrukere er planlagt. Oversettelsene er de 1.4.0 leverte.

## Bare amd64, og hvorfor

Denne utgivelsen bygges bare for amd64. Multi-arkitektur kommer i sin egen kjøring, så utgivelsen etter denne er et lite versjonsløft som bygger begge. `stable`, `latest`, `1.4` og `1` lister det nye amd64-avbildet ved siden av arm64-avbildet de allerede pekte på.

## Oppgradere, og gå tilbake

Ingen migreringer: skjemaet er det 1.4.0 har. `helm upgrade` til 1.4.1, eller la `:stable` flytte Quadlet-enhetene. Det er trygt å sette 1.4.0 tilbake, fordi ingenting i databasen endret seg.
