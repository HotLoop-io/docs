---
title: "Utgivelsesnotater: HotLoop core 4.24.0"
description: "Hva HotLoop core 4.24.0 gir deg, hva som endrer seg ved oppgradering og hva du bør lese før du rører et anlegg i drift."
sidebar:
  label: "4.24.0"
---

HotLoop-skjermer er P&ID-er. En CODESYS-PLS-s egne alarmer vises i HotLoops alarmliste, og en kvittering går tilbake til PLS-en, en skriptkjøring tar alltid slutt, en boks datavolum leses alltid, og veikartlinjene for UniFi Protect, Access og strøm er levert. Bygd bare for amd64; multi-arch-bygget følger som neste versjon.

## Hva som er endret

- **Skjermer er P&ID-er.** Slipp tanker, pumper, ventiler, varmevekslere, filtre, instrumenter og koblinger på en symbolside, og dra så fra ett tilkoblingspunkt til et annet: røret legger seg selv i rette vinkler rundt alt på siden, grener av med en kobling der du slipper det på et annet rør, og legges om mens du flytter et symbol. Hvert rør bærer mediet sitt (vann, damp, drivstoff, luft, strøm, signal og mer, hver med en farge, en kode og et linjemønster, så farge aldri er den eneste bæreren) og beveger seg med taggen sin eller en regel. Hver symbolside får en verktøylinje for å zoome, panorere, vise et minikart og bytte til den grå høyytelsesvisningen, og et P&ID lagres, eksporteres og importeres i den samme skjermfilen. Se [Dashbord](/nb/iot/dashboards/) og [Screen files](/nb/iot/screen-file/).
- **En CODESYS-PLS-s egne alarmer vises i HotLoops alarmliste.** Et prosjekts Alarm Configuration holder alarmgrupper og -klasser, og alarmer som overvåker en variabel. En CODESYS-enhet leser nå de PLS-ens alarmbehandler holder (aktive, ventende på kvittering, kvittert mens betingelsen fortsatt holder), og en kvittering gjort i HotLoop går tilbake til PLS-en. En PLS som ingen har å gi, blir latt i fred. Det trenger HotLoop Alarms-biblioteket og én blokk i prosjektet. Se CODESYS-ALARMS.md.
- **Boksens datavolum leses alltid.** En boks uten noe montert under `/data` har ikke `/data`, og bokshelse-taggen `data_util_pct` ble lest dårlig med «no such file or directory». Den leser nå volumet datamappen vil bli laget på. Se [Protokoller og drivere](/nb/iot/protocols/#boksens-helse).
- **En skriptkjøring tar alltid slutt.** Da databasen avviste skrivingen av slutten på en skriptkjøring, logget HotLoop det og ga opp, så kjøringen leste «running» så lenge prosessen levde, med plassen for lenge siden ledig. Skrivingen bes nå om på nytt, opptil fem ganger med en kort ventetid mellom.
- **UniFi Protect, Access og SmartPower PDU-uttak er levert i veikartet.** De kom som enheter i 4.23.6, bygd etter de utgitte API-ene, med hver Protect-sti i samsvar med 7.4.102-dokumentet. Se [HotLoops veikart](/nb/roadmap/).
- **En TwinCAT-skjerm er bevist i en nettleser.** TwinCAT PackML-eksempelet importeres med rammene sine, rendres, og en lampe følger et levende register.
- **Tester venter på det de venter på.** Ventingen på panelets throttle kontrolleres som aritmetikk, timeren til forSec-holdet er i testens hender og ikke i kappløp mot en pause, Apache Kafka-topictesten sletter topicene sine med én gang og har tiden en treg boks trenger, og en API-test avgrenser ikke lenger en innlogging med ett enkelt utvalg, fordi en belastet boks svarer fire ganger tregere enn et sekund før.

## Migreringer

Ingen.

## API-endringer

Ingen. Ingen rute endret seg. Konfigurasjonen til en symbolside tar `pipes`, `view` og et symbols `rot`, og en lagret skjermfil bærer dem.

## Oppgradere fra 4.23.6

En vanlig `helm upgrade`. Ingen migrering og ingen ny secret. En symbolside uten rør tegnes som før.

## Hva som ikke er bevist

- PLS-alarmstien ble kjørt mot en ekte CODESYS Control for Linux SL 4.22.0.0-runtime med alarmlaboratorieprogrammet.
- Protect, Access og PDU-ens uttak følger de utgitte API-ene, og benkekjøringen på ekte utstyr følger på kontoret.
