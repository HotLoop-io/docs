---
title: "HotLoop Transmitter: oversikt"
description: "Et CODESYS-bibliotek i Structured Text over SysSocket UDP som publiserer PLS-verdier som OPC UA PubSub (UADP), uten annet bibliotek og uten konfigurator."
---

HotLoop Transmitter legger verdiene fra en PLS ut på nettverket som OPC UA PubSub, slik del 14 av OPC UA-spesifikasjonen beskriver, fra et bibliotek du legger inn i CODESYS-prosjektet. Det er en transmitter i instrumentløyfens forstand: delen som legger prosessverdien på ledningen slik at noe annet kan lese den.

Det er skrevet i Structured Text over `SysSocket` UDP, og trenger ikke noe annet bibliotek, ingen ekstra lisens og ingen konfigurator. Du legger til biblioteket, kaller én funksjonsblokk én gang per syklus, og en UADP NetworkMessage sendes ved hvert publiseringsintervall til en unicast-adresse eller en multicast-gruppe.

Hva det betyr for deg: en PLS uten PubSub-bibliotek kan likevel mate alt som abonnerer på OPC UA PubSub, også HotLoop selv, med noen få linjer Structured Text. Hver melding har et tidsstempel fra PLS-ens klokke, med mindre du slår det av med `bTimestamp`.

## Hvorfor Structured Text og ikke Go

Hvert nytt HotLoop-verktøy skrives i Go med mindre det er en reell grunn. Dette er den reelle grunnen: det må kjøre inne i PLS-ens egen skanning, i IEC 61131-3-kjøretiden, som et bibliotek programmereren refererer til fra prosjektet sitt. En CODESYS-kjøretid kjører Structured Text, ikke Go. Testene og verktøyene rundt biblioteket (opptaksverktøyet, verifikatoren) er i Go.

## Slik bruker du det

1. Installer `HotLoopTransmitter-1.1.0.library` i CODESYS-bibliotekarkivet (Tools, Library Repository, Install), eller installer `HotLoopTransmitter-1.1.0.package` med CODESYS Installer, og legg det så til i prosjektets Library Manager. [Installasjonssiden](/nb/transmitter/install/) har nedlastingene og detaljene.
2. Deklarer en publisher, legg til variablene du vil publisere én gang ved oppstart, og kall den hver syklus:

```iecst
PROGRAM PLC_PRG
VAR
    pub : HLTX.FB_HLTX_Publisher;
    bInit : BOOL;
END_VAR

IF NOT bInit THEN
    bInit := TRUE;
    pub.sDestination := '239.0.0.22';        // a unicast host or a multicast group
    pub.uiPort := 4840;
    pub.uiPublisherId := 1;
    pub.uiWriterGroupId := 1;
    pub.uiDataSetWriterId := 1;
    pub.tPublishingInterval := T#100MS;
    pub.AddReal(ADR(GVL.rTemperature));
    pub.AddBool(ADR(GVL.bRunning));
    pub.AddArray(ADR(GVL.aValues), HLTX.E_HLTX_Type.REAL_T, 250);
END_IF
pub.bEnable := TRUE;
pub();
```

[API-siden](/nb/transmitter/api/) lister hver inngang, utgang og metode. [Siden om trådformatet](/nb/transmitter/wire-format/) viser pakken byte for byte, med de delene av spesifikasjonen som definerer hver byte.

## Hva det gjør og ikke gjør med skanningen din

* Det blokkerer aldri. Socketen er ikke-blokkerende, og meldingen bygges i en fast buffer.
* Kostnaden for et kall er kostnaden ved å bygge én melding, og den betales bare i syklusene der en melding sendes. Målt på en 20 ms-oppgave med to publishere og tidsstempel på: omtrent 9,6 us lagt til per syklus i snitt, 10 til 100 us i syklusene som sender, og den lengste syklusen i kjøringen var 81 us. En travel vert har strukket én enkelt sending til millisekunder. De målte tallene og begrensningene deres står på [tidssiden](/nb/transmitter/timing/).
* En socketfeil, en ugyldig adresse eller en for stor feltliste får aldri applikasjonen til å feile. Blokken rapporterer en `eState` og en `eError`, teller feilen, og programmet fortsetter å skanne.
* Det fragmenterer ikke. En melding er høyst 1472 byte. En feltliste som ikke får plass setter blokken i `ConfigError` og sender ingenting.

## Testet mot

CODESYS Control for Linux SL 4.22.0.0-kjøretiden, og på bare metal (2026-11-17). Se [tidssiden](/nb/transmitter/timing/) og [bevissiden](/nb/transmitter/proof/) for hva som ble kjørt og lest tilbake.

Bruker du det på et anlegg? [Bruke HotLoop i en bedrift](/nb/business/) forklarer lisensiering og hvordan du når oss.

## Lisens

HotLoop Source License Agreement 1.0, som for alle HotLoop-produkter. Det er gratis å bruke og har tilgjengelig kildekode, ikke åpen kildekode etter OSI, og seksjon 5 lar deg bygge biblioteket inn i dine egne PLS-prosjekter og levere eller selge det kompilerte resultatet, aldri selve biblioteket. [Lisenssiden](https://hotloop.io/license/) har teksten.
