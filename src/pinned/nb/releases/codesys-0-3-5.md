---
title: "Utgivelsesnotater HotLoop for CODESYS 0.3.5"
description: "Chart 0.3.5 for HotLoop for CODESYS: omslutter HotLoop 4.20.2, det nyeste chartet i indeksen."
sidebar:
  label: "0.3.5"
---

## Hva som er endret

0.3.5 er i indeksen `{{codesysChartRepo}}`, publisert 2026-11-16, og er chartet å installere.

- **Det omslutter HotLoop 4.20.2,** som bærer EtherNet/IP-batchrettingen og en `version`-kommando som skriver ut uten konfigurasjon. Provisioneren blir på 0.3.1.
- **Alt fra [0.3.2](/nb/releases/codesys-0-3-2/) til [0.3.4](/nb/releases/codesys-0-3-4/) er fortsatt her,** ingenting skriver til PLS-en, og hvert tidligere chart blir i indeksen.

Hva det betyr for deg: dette er den du skal installere, og en oppgradering fra 0.3.4 beholder enheten din og tagsene.

## Hva som ble sjekket

En oppgradering fra 0.3.4 med en profil brukt på 0.3.5, med en CODESYS Control for Linux SL 4.22.0.0-runtime på nodens nett ved siden av: en ny pod på 4.20.2 kom opp, enheten og dens 44 tags var der fortsatt og ingen var skrivbare, siden svarte, og HotLoop-loggen hadde ingen advarsler eller feil. Begge podene slettet og runtime startet på nytt: alle tre kom tilbake av seg selv. Det er kjørt på bare metal (2026-11-17).
