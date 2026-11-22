---
title: "Slik installerer du HotLoop Transmitter"
description: "Installer biblioteket i CODESYS-bibliotekarkivet, legg det til i et prosjekt, og se hva du gjør når blokken rapporterer en feil."
---

Du trenger et CODESYS-utviklingssystem, 3.5 SP22 eller nyere, og en kjøretid der målet har komponentene SysSocket og SysTimeRtc, som CODESYS Control-kjøretidene for Linux SL har (den andre er ny i 1.1.0, for tidsstempelet).

## Fra CODESYS Installer

Siden 1.1.0 har utgivelsen også `HotLoopTransmitter-1.1.0.package`, på https://hotloop.io/hotloop-transmitter/1.1.0/HotLoopTransmitter-1.1.0.package. Installer den med CODESYS Installer (i IDE-en: Tools, CODESYS Installer), eller uten vindu med kommandolinjen, `PackageManagerCLI.exe --profile="<your profile>" --install=<file>.package --targetProfiles="<your profile>"`. Installer legger biblioteket i bibliotekarkivet til den profilen, under firmaet HotLoop, og du går videre til trinn 3 nedenfor. Pakken er samme bibliotek som `.library`-filen, i en ZIP som Installer leser, så de to veiene gir samme bibliotek.

## Fra bibliotekfilen

1. Last ned `HotLoopTransmitter-1.1.0.library` fra https://hotloop.io/hotloop-transmitter/1.1.0/HotLoopTransmitter-1.1.0.library, og kontroller den mot `SHA256SUMS` i samme mappe (`sha256sum -c SHA256SUMS`).
2. I CODESYS IDE: Tools, Library Repository, Install, velg filen. Den ligger nå i arkivet under firmaet HotLoop.
3. Åpne Library Manager for applikasjonen i prosjektet ditt, Add Library, og velg HotLoop Transmitter. SysSocket, SysTimeRtc og grensesnittbibliotekene deres følger med som avhengigheter og trenger ingenting fra deg.
4. Deklarer en `HLTX.FB_HLTX_Publisher`, legg til feltene dine, og kall den hver syklus (README har eksempelet).
5. Last ned til kontrolleren. Målet må kunne nås fra kontrollerens nettverk; for multicast må bryterne i nettverket føre gruppen videre.

Filen `.compiled-library` er det samme biblioteket uten kildekoden. Installer den hvis du ikke vil at Structured Text skal være synlig i Library Manager. Den ligger i samme mappe, som `HotLoopTransmitter-1.1.0.compiled-library`.

For å kontrollere hva som kommer frem, fungerer hvilken som helst UDP-lytter på målporten. Et lite Go-program som lytter på en port eller blir med i en multicast-gruppe og skriver ut hver datagram som en JSON-linje med hex fungerer godt.

## Hvis blokken rapporterer en feil

| `eError` | Betydning | Gjør |
|---|---|---|
| `NoFields` | ingen felt ble lagt til | kall en `Add`-metode før du aktiverer |
| `BadInterval` | `tPublishingInterval` er under 1 ms | sett den |
| `BadAddress` | `sDestination` er ikke en IPv4-adresse med punktum | rett den |
| `SocketCreate`, `SocketOption` | kjøretiden avviste et socketkall; `diLastSocketResult` har koden | blokken prøver på nytt selv etter `tRetry` |
| `TooBig` | feltene får ikke plass i 1472 byte | publiser færre, eller bruk to publishere med ulike writer id |
| `BadField` | en lagret adresse ble slettet | `Clear()` og legg til feltene på nytt |
