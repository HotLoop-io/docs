---
title: "Utgivelsesnotater: HotLoop Transmitter 1.0.0"
description: "Første versjon av HotLoop Transmitter: et CODESYS-bibliotek som publiserer PLS-verdier som OPC UA PubSub, hva det inneholder og hva som er kjørt."
---

Første utgivelse. Et CODESYS-bibliotek, skrevet i Structured Text over SysSocket UDP, som legger verdiene fra PLS-en din ut på nettet som OPC UA PubSub (del 14, UADP). Du legger til biblioteket, deklarerer én funksjonsblokk, legger til variablene du vil sende ut og kaller den én gang per syklus. Alt som abonnerer på OPC UA PubSub kan lese det, HotLoop core inkludert, fra 4.19.4.

Hva det betyr for deg: en PLS uten PubSub-bibliotek kan nå mate en PubSub-abonnent med omtrent femten linjer Structured Text, og ingenting annet installeres på kontrolleren.

## Hva som følger med

* Én blokk, `HLTX.FB_HLTX_Publisher`. Én NetworkMessage per publiseringsintervall, én DataSetMessage, en Data Key Frame, så hver melding inneholder alle feltene.
* Feltkodingene Variant og RawData, valgt per utgiver. Variant bærer sine egne typer. RawData bærer ingen, så mottakeren må få vite oppsettet, som [siden om nettformatet](/nb/transmitter/wire-format/) beskriver byte for byte.
* Feltene BOOL, SINT, USINT, INT, UINT, DINT, UDINT, LINT, ULINT, REAL, LREAL, STRING og TIME, og matriser av alle unntatt STRING, opptil 128 felt og 1472 byte per melding. En melding blir aldri fragmentert.
* Unicast eller multicast, med utgiver-ID, writer group-ID, dataset writer-ID, publiseringsintervall, gruppeversjon og konfigurasjonsversjon som innganger.
* En ikke-blokkerende sending. En feil adresse, en død socket eller en feltliste som er for stor setter blokken i en feiltilstand du kan lese, og får aldri applikasjonen din til å feile.

## Hva vi kjørte, og hva det viste

Alt mot CODESYS Control for Linux SL 4.22.0.0, på filene under.

* Biblioteket bygges med 0 feil og 0 advarsler i CODESYS 3.5.22.30. Eksempelapplikasjonen bygges mot det med 0 feil og 0 advarsler.
* To utgivere, én Variant og én RawData, med sytten felt hver. Hver verdi på nettet er lik det PLS-en rapporterer over sin egen OPC UA-server, uten hull i sekvensnumrene.
* En uavhengig PubSub-stakk dekoder Variant-meldingen fullt ut og RawData-skalarene. Den kan ikke lese en RawData-matrise eller en lang RawData-streng i det hele tatt, noe som er dens grense og ikke bibliotekets.
* HotLoop core sin abonnent (fra main-grenen da dette ble kjørt, og i HotLoop core 4.19.4 og alle utgivelser etter) leser begge utgiverne, inkludert strengen, TIME, begge matrisene og to tellere som endrer seg mellom lesingene, og avviser ingenting.
* En andre dekoder leser alle de 222 fangede datagrammene.
* Kostnad på en 20 ms-oppgave, to utgivere: omtrent 10,6 us lagt til per syklus i snitt. En syklus som sender koster 10 til 100 us. Halen er `sendto`-kallet, og på en travel delt vert nådde den én gang 14,3 ms på 12 000 sykluser. Legg utgiveren i sin egen oppgave med lavere prioritet hvis det betyr noe for styringslogikken din. [Tidssiden](/nb/transmitter/timing/) har tabellen.

## Hva du bør sjekke på kontrolleren din

* Håndteringen av byterekkefølge for et big endian-mål er skrevet, så sjekk den på din egen kontroller.
* Multicast: blokken setter TTL, loopback og sendegrensesnitt for gruppen, så sjekk gruppen på ditt eget nett.
* Hvis nettet forsvinner eller en adresse ikke finnes, teller blokken feilen og venter lenger mellom forsøkene, og programmet fortsetter å skanne.
* I demomodus stopper runtime ved slutten av sitt to timers vindu, slik CODESYS sier.

## Ikke med i denne utgivelsen

Tidsstempler i DataSetMessage og NetworkMessage, KeepAlive og Delta Frames, mer enn én DataSetMessage per NetworkMessage, WSTRING, en status per felt, meldingssikkerhet og abonnentsiden. [Veikartet](/nb/transmitter/roadmap/) sier hva som kommer neste.

## Hvis du kommer fra en annen utgiver

En mottaker som insisterer på et tidsstempel, en KeepAlive eller en Delta Frame blir ikke fornøyd med denne versjonen, fordi ingen av dem sendes. Hver melding er en Key Frame, som enhver mottaker kan lese uten forkunnskap. En RawData-matrise er her en Int32-lengde, elementene og nullfylling opp til den deklarerte størrelsen, som er slik OPC Foundations referansestakk skriver den. En mottaker som forventer en matrise som elementer rett etter hverandre uten lengde, må få beskjed om at feltene er separate skalarer.

## For et prosjekt som allerede bruker det

Det finnes ingen tidligere versjon. Nettformatet endres bare når `udiConfigMajor` endres, og et PLS-prosjekt som er festet til denne biblioteksversjonen beholder de samme feltene og bytene.

## Filer

Last ned begge filene og `SHA256SUMS` fra https://hotloop.io/hotloop-transmitter/1.0.0/HotLoopTransmitter-1.0.0.library, og installer deretter `HotLoopTransmitter-1.0.0.library` via Verktøy, Bibliotekbehandling, Installer i CODESYS 3.5 SP22 eller nyere. `.compiled-library` er det samme biblioteket uten kildekoden.

```
91b8023a73870925082c170588feb43d363e6d07ce008e1471fa8f5ff8db2c0d  HotLoopTransmitter-1.0.0.library
b02b0b40e434f35e4af1def20d6cc38688463537c4800354931b8c6094a66686  HotLoopTransmitter-1.0.0.compiled-library
```
