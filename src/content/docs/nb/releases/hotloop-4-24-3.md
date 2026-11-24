---
title: "Utgivelsesnotater: HotLoop core 4.24.3"
description: "Hva HotLoop core 4.24.3 gir deg, hva som endrer seg ved oppgradering og hva du bør lese før du rører et anlegg i drift."
sidebar:
  label: "4.24.3"
---

4.24.3 tar alt i [4.24.2](/nb/releases/hotloop-4-24-2/) til hvert kort vi bygger for: Shelly av alle generasjoner, ONVIF-kameraer, Arduino over Firmata, OPC UA-passord av hvilken som helst lengde, en videresendingskø som tømmes bak en treg lenke, `--version` som nevner commiten sin, og en standardinstallasjon av HotLoop Edge som starter.

Gateway kjører på amd64 og arm64, og Edge, IoT og Edge Relay kjører på amd64, arm64 og arm/v7, så den samme utgivelsen dekker serverne dine, Pi-ene dine og de eldre ARM-gatewayene dine. Les [notatene for 4.24.2](/nb/releases/hotloop-4-24-2/) for alt nytt siden 4.24.0.

- Alle fire chartene (`hotloop`, `hotloop-iot`, `hotloop-edge`, `hotloop-edge-relay`) står på 4.24.3, med alle tidligere versjoner fortsatt i indeksen.
- Oppgrader som alltid: et `helm upgrade` til chartet 4.24.3, eller den nye taggen i Quadlet-enheten din. Ingenting må migreres.
