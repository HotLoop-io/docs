---
title: "HotLoop for CODESYS: status"
description: "Hva HotLoop for CODESYS har kjørt mot på ekte maskinvare, og hva som er publisert."
sidebar:
  label: "Status"
editUrl: false
---

Denne siden viser hva som er publisert, og hvor langt HotLoop for CODESYS er kjørt.

## Hva som er ute

- **Chartet.** `hotloop-codesys` 0.3.8 ligger i indeksen på `https://hotloop.io/hotloop-codesys/`, publisert 2026-11-19, med alle tidligere versjoner fortsatt ved siden av. Det pakker inn HotLoop 4.22.0. Installer 0.3.8: [utgivelsesnotatene](/nb/releases/codesys-0-3-5/) sier hva hvert chart endret.
- **Provisioner-imaget.** `ghcr.io/hotloop-io/hotloop-provision` på 0.3.3 hentes uten innlogging, for amd64 og for arm64, og chartet kjører det.
- **App Store-oppføringen.** Den ligger i EmberCORE App Store, og EmberNet installerer den på tenanten din.

## Hvor langt det er kjørt

Chartet på en k3s-node med Store-formede verdier, en ekte CODESYS Control for Linux SL 4.22.0.0-kjøretid på samme node som kjører et demoprogram, og et HotLoop Edge-image.

- Enheten, taggene (ingen skrivbare), alarmen og skjermbildet dukket opp uten håndgrep.
- Hver verdi leste bra og beveget seg.
- Podene kom tilbake etter at en pod ble slettet.
- Installasjonen leste dårlig med grunnen "the PLC's runtime is not answering" gjennom en omstart av kjøretiden, og kom tilbake av seg selv omtrent 88 sekunder etter.
- En signert innlogging fra dashbordet logget en person inn som operatør eller administrator, og en feil app, en feil tenant, en utløpt, en feil utsteder og en tuklet med ble hver avvist.
- Det publiserte chartet rendres fra den levende indeksen med Helm.

Konnektoren under, CODESYS-driveren i HotLoop core, er verifisert live mot en CODESYS Control for Linux SL 4.22.0.0-kjøretid, for lesing og skriving, og på bare metal (2026-11-17). Skriving finnes i konnektoren, og dette produktet slår den aldri på.

Alt dette er også kjørt på bare metal (2026-11-17).

## Hva en profil ikke kan ennå

En profil lager ett skjermbilde. Den lager én enhet fra `device`, eller flere med en hvilken som helst protokoll fra `devices`, og det finnes ingen måte å markere en variabel som skrivbar fra den, med vilje.
