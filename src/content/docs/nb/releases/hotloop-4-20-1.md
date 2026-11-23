---
title: "Utgivelsesnotater: HotLoop core 4.20.1"
description: "Hva HotLoop core 4.20.1 gir deg, hva som endrer seg ved oppgradering og hva du bør lese før du rører et anlegg i drift."
sidebar:
  label: "4.20.1"
---

Dette er multi-arch-bygget av [4.20.0](/nb/releases/hotloop-4-20-0/). Produktkoden er den samme som 4.20.0 sin: det nye webgrensesnittet på `/` og MCP-verktøyene som endrer konfigurasjon. 4.20.0 var amd64-bygget, og `stable` beholdt arm-imagene det allerede hadde.

4.20.1 bygger hele settet: Gateway for amd64 og arm64, og Edge, IoT og Edge Relay for amd64, arm64 og arm/v7. Les [notatene for 4.20.0](/nb/releases/hotloop-4-20-0/) for alt som har endret seg siden 4.19.11.

- Alle fire chartene (`hotloop`, `hotloop-iot`, `hotloop-edge`, `hotloop-edge-relay`) er på 4.20.1, med hver tidligere versjon fortsatt i indeksen.
