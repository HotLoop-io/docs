---
title: "HotLoop for CODESYS: veikart"
description: "Hva HotLoop for CODESYS har bygget, publisert og kjørt på ekte maskinvare."
sidebar:
  label: "Veikart"
editUrl: false
---

Dette er listen over hva som er gjort og hva som gjenstår, i den rekkefølgen det gjøres. Den lover ingenting som ikke er i koden eller i en testplan, og [Status](/nb/codesys/where-it-stands/) sier hvor langt den er kjørt.

## Bygget

- [x] Et chart rundt HotLoop Edge med standardverdier for en kjøretid på en node: SQLite, én replika, toleranser som beholder begge podene ved tapt kontrollplan.
- [x] En provisioner som bruker en profil og holder den riktig, med en revisjon som beskytter det en person har endret.
- [x] En profil som bærer en liste over enheter med en hvilken som helst protokoll HotLoop snakker, slik at en lytter kommer tilbake konfigurert uten behov for en PLS.
- [x] Enheten, taggene, alarmen og skjermbildet laget uten håndgrep, mot en CODESYS Control for Linux SL 4.22.0.0-kjøretid i en container.
- [x] Gjenoppretting etter omstart av kjøretiden uten inngrep, på omtrent 88 sekunder.
- [x] En signert innlogging fra EmberCORE-dashbordet, med avvisningene.

## Levert

- [x] HotLoop 4.22.0, utgivelsen chartet pakker inn.
- [x] Chartet publisert på `https://hotloop.io/hotloop-codesys/`, med 0.3.8 som det nyeste.
- [x] Provisioner-imaget offentlig, så det kan hentes uten innlogging, 0.3.3.
- [x] Et multiarkitektur-provisioner-image, amd64 og arm64, fra 0.3.3 og chart 0.3.8.
- [x] To OPC UA PubSub-lyttere på én UDP-port, med HotLoop 4.22.0 og chart 0.3.7.
- [x] [Utgivelsesnotater](/nb/releases/codesys-0-3-10/) for hvert chart, 0.3.0 til 0.3.10.

## Bevist på bare metal

- [x] Kjørt på bare metal (2026-11-17), inkludert en installasjon fra den ekte App Store-siden slik ansatte gjør den, k3s v1.35.7, en node som faktisk mister forbindelsen til kontrollplanet mens podene beholdes, en nedlasting fra CODESYS IDE mens kjøretiden forblir oppe, en kjøretid på vertens eget nettverk ved siden av HotLoop-poden på én node, og en kjøretid med brukeradministrasjon på og et sertifikatsikret OPC UA-endepunkt.

## Skal bygges

- [ ] Mer enn ett skjermbilde i en profil.
