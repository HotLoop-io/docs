---
title: "Utgivelsesnotater: HotLoop core 4.21.1"
description: "Hva HotLoop core 4.21.1 gir deg, hva som endrer seg ved oppgradering og hva du bør lese før du rører et anlegg i drift."
sidebar:
  label: "4.21.1"
---

Dette er multi-arch-bygget av [4.21.0](/nb/releases/hotloop-4-21-0/). Produktkoden er den samme som 4.21.0 sin: X.509-innlogging for OPC UA-serveren, passord på 72 byte, de utdaterte sikkerhetspolicyene av som standard og den utvidede CODESYS-alarmimporten. 4.21.0 var amd64-bygget, og `stable` beholdt arm-imagene det allerede hadde.

4.21.1 bygger hele settet: Gateway for amd64 og arm64, og Edge, IoT og Edge Relay for amd64, arm64 og arm/v7. Les [notatene for 4.21.0](/nb/releases/hotloop-4-21-0/) for alt som har endret seg siden 4.20.2, inkludert at `Basic128Rsa15` og `Basic256` også er av ved oppgraderinger.

- Alle fire chartene (`hotloop`, `hotloop-iot`, `hotloop-edge`, `hotloop-edge-relay`) er på 4.21.1, med hver tidligere versjon fortsatt i indeksen.
