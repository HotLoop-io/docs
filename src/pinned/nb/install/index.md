---
title: "Slik installerer du HotLoop"
description: "Slik installeres hvert HotLoop-produkt: Helm på k3s eller Kubernetes, eller Podman Quadlet på en boks som følger stable-taggen og oppdaterer seg selv."
sidebar:
  label: "Installasjon"
---

Det er to måter å kjøre et HotLoop-produkt på for alvor: Helm på k3s eller et hvilket som helst Kubernetes, eller Podman med Quadlet på en boks som ikke står i en klynge. Ingen Docker, ingen Compose og ingen løs `podman run` fra et skall som dør med økten. En vanlig `podman run` går fint for å prøve, og Flow-siden sier det, men det er ikke en installasjon.

## Velg veien

| Du har | Bruk | Side |
|---|---|---|
| En k3s- eller Kubernetes-klynge | Helm | [k3s og Helm](/nb/install/helm/) |
| En Pi, en NUC eller en liten industri-PC, uten klynge | Podman Quadlet | [Podman Quadlet](/nb/install/quadlet/) |
| Begge deler, og du vil vite hvordan oppdateringer oppfører seg | | [Den automatiske oppdateringen av :stable](/nb/install/auto-update/) |

## Hva du kan installere i dag

| Produkt | Siste utgivelse | Helm | Quadlet | Start her |
|---|---|---|---|---|
| [HotLoop IoT](/nb/iot/overview/) | {{hotloop}} | Ja | Ja | [Installer IoT](/nb/iot/install/) |
| [HotLoop Edge](/nb/edge/overview/) | {{hotloop}} | Ja | Ja | [Installer Edge](/nb/edge/install/) |
| [HotLoop Gateway](/nb/gateway/overview/) | {{hotloop}} | Ja | Ja | [Installer Gateway](/nb/gateway/install/) |
| [HotLoop Edge Relay](/nb/edge-relay/overview/) | {{hotloop}} | Ja | Ja | [Installer Edge Relay](/nb/edge-relay/install/) |
| [HotLoop Flow](/nb/flow/overview/) | {{flow}} | Ja | Ja | [Installer Flow](/nb/flow/install/) |
| [HotLoop Cascade](/nb/cascade/overview/) | {{cascade}} | Ja, uten innlogging | Ja, uten innlogging, se [Cascade med Podman Quadlet](/nb/cascade/quadlet/) | [Kjøre Cascade](/nb/cascade/running/) |
| [HotLoop for CODESYS](/nb/codesys/overview/) | {{codesys}} | Ja, eller EmberCORE App Store | Nei | [Installer HotLoop for CODESYS](/nb/codesys/install/) |
| [HotLoop Transmitter](/nb/transmitter/overview/) | 1.1.0 | Nei, det er et CODESYS-bibliotek | Nei, det er et CODESYS-bibliotek | [Installer Transmitter](/nb/transmitter/install/) |

HotLoop IoT, Edge, Gateway og Edge Relay kommer fra én tagg, i takt, så de deler et versjonsnummer. Flow, Cascade, HotLoop for CODESYS og Transmitter har sitt eget. Quadlet-enhetene for IoT, Edge og Gateway trenger Podman 5.0 eller nyere, og releens enhet ble kjørt på Podman 4.9.3. Raspberry Pi OS Bookworm leveres med 4.3, som ikke har Quadlet i det hele tatt, så en Pi trenger Trixie eller nyere.

## Før du setter en på et ekte anlegg

- Les [skriveporten](/nb/gateway/write-gate/). Den er lik i alle produkter, og det er derfor ingenting flytter en maskin du ikke har armert.
- Legg databasen på en USB-SSD og ikke på SD-kortet, hvis det er en Pi. Historikken skriver hele dagen, hver dag, og SD-kort dør nettopp av det.
- Ta sikkerhetskopi av nøkkelen til enhetspassordene. Den ligger ikke i databasen og ikke i en sikkerhetskopi, så den er en del av dataene dine. [Sikkerhetskopier](/nb/iot/backup/) forklarer hvordan.
- Ta en sikkerhetskopi før du flytter en lokasjon opp et produkt eller oppgraderer på tvers av en utgivelse, og kopier den bort fra boksen.
