---
title: "Utgivelsesnotater: HotLoop Flow 2.8.0"
description: "Hva HotLoop Flow 2.8.0 gir deg, hva som endres ved oppgradering og hva du bør lese før du rører et anlegg i drift."
sidebar:
  label: "2.8.0"
---

HotLoop Flow 2.8.0 legger fire ting til i FlowLab, diagramfanen for testbenker og dataloggere: analysenoder, en datainnsamlingsnode for NI-maskinvare, en MQTT-utgang som beholder det megleren går glipp av, og en TDMS-logg. Flows kjører akkurat som før, en flow-fil du har i dag lastes og lagres byte for byte, og en fane som ikke er et diagram, ser ingenting av dette.

## Nytt

**Analyse.** Fire noder jobber på en tabell med målinger: statistikk (middelverdi, RMS, minste, største og standardavvik), integral (arealet under tabellen etter trapesregelen, som ett tall eller som et løpende areal), derivert (stigningen ved hver prøve) og et Butterworth-filter av orden 1 til 10 som lavpass, høypass, båndpass eller båndstopp, med knekkfrekvensen i hertz.

**En datainnsamlingsnode.** `read DAQ task` leser prøver fra NI-maskinvare, for eksempel et CompactDAQ-chassis, gjennom NIs gRPC Device Server. Klienten er så liten den kan bli: Gos egen HTTP/2 med håndskrevne meldinger, så binærfilen tok ikke inn et gRPC-bibliotek.

**En MQTT-utgang som ikke mister noe.** `mqtt out` publiserer gjennom megleren flow-filen konfigurerer, den samme forbindelsen MQTT-nodene bruker. Merk den som varig, så skrives en melding megleren går glipp av, til disk før noden er ferdig og sendes, eldste først, når megleren er tilbake, selv over en omstart. Ingenting forbikjører noe som venter foran. Utgangen for sendt sier om meldingen gikk rett ut.

**En TDMS-logg.** `log to TDMS file` legger en post til en TDMS-fil, én kanal per felt, og filen åpnes i verktøyene et laboratorium allerede har. En fil der siste skriving ble avbrutt av et strømbrudd kan fortsatt leses frem til siste hele verdi.

## Hva som er endret

- Det er nå 28 nodetyper i FlowLab-delen av paletten, opp fra 21, og README-en sier det.
- Et steg som sviktet én gang i kjøringen av 2.7.1, skrev ut ingenting, og årsaken var innsamlertesten som sammenlignet et tidsrom før loggen den leser hadde hele tidsrommet; den venter nå på hele tidsrommet. To tester til ble gjort slik at de venter på det de kontrollerer. Ingenting av dette leveres.
- Bildene i README-en ble tatt på nytt slik at toppfeltet sier v2.8.0.
- Størrelsene på binærfilen og avbildet i README-en ble lest på nytt for denne utgivelsen.

## Nye innstillinger

Ingen.

## Oppgradering

På amd64 en vanlig `helm upgrade` til 2.8.0-avbildet og -chartet, eller den nye taggen i Quadlet-enheten din. På arm64 blir du der du er til 2.8.1, som er denne utgivelsen med arm64 lagt til og ingenting annet. Ingenting skjer ved første oppstart, og det er ingenting å migrere.

Image: `ghcr.io/hotloop-io/hotloop-flow:2.8.0`, bare linux/amd64. Vi bygger amd64 først, lar det lese som stabilt i produksjon, og så legger en liten 2.8.1 uten noe annet til arm64. Til da har taggen `2` det nye amd64-imaget og arm64-imaget fra 2.7.1, så en maskin på arm64 som følger `2` eller `2.7` beholder det den har, og en maskin festet til `2.8.0` trenger amd64. Chart: `https://hotloop.io/hotloop-flow/`. README-en på denne taggen har resten, med bilder: https://github.com/HotLoop-io/hotloop-flow/blob/v2.8.0/README.md
