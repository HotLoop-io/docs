---
title: "Utgivelsesnotater: HotLoop core 4.19.5"
description: "Hva HotLoop core 4.19.5 gir deg, hva som endrer seg ved oppgradering og hva du bør lese før du rører et anlegg i drift."
sidebar:
  label: "4.19.5"
---

Dette er multi-arch-bygget av [4.19.4](/nb/releases/hotloop-4-19-4/) og ingenting annet. Koden er samme commits kode med versjonen økt: ingen retting, ingen funksjon, ingen endring i oppførsel.

4.19.4 ble bygd bare for amd64, slik at den kunne nå produksjon og regnes som stable før arm-imagene var bygd. 4.19.5 bygger hele settet: Gateway for amd64 og arm64, og Edge, IoT og Edge Relay for amd64, arm64 og arm/v7. En arm-boks går fra imagene den kjørte til 4.19.4-koden ved å hente `stable`.

Les [notatene for 4.19.4](/nb/releases/hotloop-4-19-4/) for alt som har endret seg siden den sist utgitte versjonen.

- Alle fire chartene (`hotloop`, `hotloop-iot`, `hotloop-edge`, `hotloop-edge-relay`) er på 4.19.5, med hver tidligere versjon fortsatt i indeksen.
- Neste versjon som bærer endringer, setter det tilbake til `linux/amd64`.
