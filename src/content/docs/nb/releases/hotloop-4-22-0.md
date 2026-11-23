---
title: "Utgivelsesnotater: HotLoop core 4.22.0"
description: "Hva HotLoop core 4.22.0 gir deg, hva som endrer seg ved oppgradering og hva du bør lese før du rører et anlegg i drift."
sidebar:
  label: "4.22.0"
---

En skjerm åpnet som et panel (`/?screen=<name>`) fyller nå displayet sitt kant til kant i enhver størrelse, skjermen Alarms kan importere en CODESYS-alarmfil, og en håndfull rettinger. Bygd bare for amd64; multi-arch-bygget følger som neste versjon.

## Hva som er endret

- **En panelside fyller skjermen sin.** Ved 1920x1080, 1366x768 og 3840x2160 dekker den displayet uten dødt rom. Den har en topptekst med anleggets navn, en Live-status med hvor mange enheter som er online, og en 24-timers klokke med dato. Tall og målere vokser med skjermen, det samme gjør trendens akse og forklaring. Bare panelsiden endrer seg; dashbordene er som de var, og en kundes kort, størrelser og navn er deres.
- **Skjermen Alarms importerer en CODESYS Export Alarms-fil.** Bare for admin: velg enheten, navngi applikasjonen, velg filen, les forhåndsvisningen av hva som kommer over og hva som ikke gjør det, og importer så. API-ruten fantes allerede.
- **OPC UA PubSub-enheter på én adresse og port deler én socket.** Den andre enheten kunne aldri binde, og gjenbruksvalgene delte en publishers datagrammer mellom dem.
- **Trege svar hoper seg ikke lenger opp.** Et kamerakort som er tregere enn oppdateringen sin, viser nå bildet sitt, kortene og UniFi-skjermen spør på nytt først etter det siste svaret, en discovery-batch som feilet én gang, prøves på nytt, og en SNMP-enhet på et vertsnavn beholder sin egen ventetid på svaret.
- **Kjerneproduktene er under HotLoop Free Use License 1.0.** Tidligere versjoner beholder vilkårene de ble utgitt under. Se NOTICE.
- **App Store-ikonet** på chart-sidene er HotLoop-merket.

## API-endringer

Ingen.

## Oppgradere fra 4.21.1

En vanlig `helm upgrade`. Ingen migrering, ingen ny secret, ingenting som ikke kan rulles tilbake.

## Testet

Panelsiden ble kontrollert i testing ved de tre størrelsene ovenfor, med Emberburn som matet en Gateway.
