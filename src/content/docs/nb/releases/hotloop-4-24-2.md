---
title: "Utgivelsesnotater: HotLoop core 4.24.2"
description: "Hva HotLoop core 4.24.2 gir deg, hva som endrer seg ved oppgradering og hva du bør lese før du rører et anlegg i drift."
sidebar:
  label: "4.24.2"
---

HotLoop leser og styrer Shelly-enheter av alle generasjoner direkte, finner ONVIF-kameraer og leverer strømmene, stillbildene og panorering, tilting og zoom, snakker med Arduino over Firmata og sender et OPC UA-passord av hvilken som helst lengde slik spesifikasjonen ber om. En treg lenke holder ikke lenger en kantnode på disken sin, og `--version` oppgir hvilken commit et image er bygget fra. En standardinstallasjon av HotLoop Edge starter. Bygget kun for amd64; multiarkitektur-bygget følger som neste versjon.

## Hva som er endret

- **Shelly, alle generasjoner.** Gen2 og nyere over RPC med en live websocket, slik at en endring og et knappetrykk kommer i det øyeblikket de skjer, og Gen1 over sitt eget HTTP-grensesnitt. Et knappetrykk føres i loggboken under enheten. Se SHELLY.md.
- **ONVIF-kameraer.** Finn kameraer på nettverket (WS-Discovery), les hver enhets informasjon, strøm- og stillbildeadressen til hver medieprofil (Media og Media2), panorering, tilting og zoom, og kameraets egne hendelser som tagger og loggbokslinjer. Gjeldende bilde fra en profil er én rute unna. Se ONVIF.md.
- **Arduino over Firmata.** USB seriell eller TCP, med digitale og analoge pinner, PWM, servoer og I2C-enheter som tagger. Se FIRMATA.md.
- **OPC UA-passord av hvilken som helst lengde.** Passord over 64 byte går nå over OPC UA slik spesifikasjonen ber om (RsaEncryptedSecret, del 4, 7.40.4), fra klienten og til serveren, og eldre servere godtar fortsatt pålogging. Bevist mot OPC Foundations egen stakk. Se [OPC UA-serveren](/nb/edge/opc-ua-server/).
- **En treg lenke fester ikke lenger noden til disken.** Runden som tar det siste fra disken sender nå det som kommer inn bak den fra minnet, slik at en videresendingskø bak en treg lenke tømmes og noden forlater disken i stedet for å gjøre fsync ved hver polling.
- **`--version` oppgir commit.** Hvert image oppgir commiten det er bygget fra, i tillegg til versjonen.
- **Et CODESYS-bilde ved siden av sin WebVisu.** Importen av en CODESYS-visualisering kjøres mot en ekte WebVisu, drevet av de samme PLS-variablene, og de to sammenlignes i en nettleser.
- **Veikartlinjen for docs/legacy er avkrysset.**
- **En standardinstallasjon av HotLoop Edge starter.** Poden leser ikke lenger Gotify-tokenet, Discord-webhook-URL-en eller Discord-bot-tokenet fra en Secret som ikke finnes: hver sendes bare når legitimasjonen er satt, og chart-kontrollen feiler på enhver referanse til den Secreten som renderingen ikke lager. Et chart med en destinasjon satt, eller en eksisterende Secret oppgitt, rendres som før.
- **Ignition-laben, i begge retninger.** HotLoops Ignition-bevis kjører nå også andre veien, et bevis for UADP-multicast over en ruter kommer til, og den største rapporten er målt. Se [Planlagte rapporter](/nb/gateway/reports/).
- **Tester venter på det de venter på.** Oppvarmingen av telefonappen venter på en innlogget side, og energiskjemaet fyller feltene sine i ett steg.

## Migreringer

Ingen.

## API-endringer

To ruter, begge nye. `POST /api/onvif/discover` (`devices.write`) leter på nettverket etter ONVIF-kameraer og legger ikke til noe. `GET /api/onvif/{id}/profiles/{profile}/snapshot` (`devices.read`) returnerer gjeldende JPEG fra en kameraprofil. Ingen eksisterende rute er endret. Se [HTTP-API-et](/nb/iot/api/).

## Oppgradere fra 4.24.0

En vanlig `helm upgrade`. Ingen migrering og ingen ny secret.

## Hva som ikke er bevist

- Shelly, ONVIF og Firmata ble kjørt mot opptak av ekte enheter, ONVIFs egen genererte stakk og Arduino-prosjektets egen StandardFirmata på en simulert Uno. Ingen fysisk Shelly, noe kamera eller noen Arduino har vært på benken ennå.
- Side-ved-side-sammenligningen med WebVisu kjøres i testing mot en CODESYS Control for Linux SL 4.22.0.0-runtime.
