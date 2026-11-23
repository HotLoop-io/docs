---
title: "Utgivelsesnotater: HotLoop core 4.23.4"
description: "Hva HotLoop core 4.23.4 gir deg, hva som endrer seg ved oppgradering og hva du bør lese før du rører et anlegg i drift."
sidebar:
  label: "4.23.4"
---

Skjermimporten går fra CODESYS til TwinCAT. En `.TcVIS`-fil, og eksportene fra cds-text-sync og codescribe, kommer over som en HotLoop-skjerm med knappene, rammene og lampene sine, og det som ikke kunne komme over, listes med teksten sin før noe lagres.

## Hva som er endret

- **TwinCAT-skjermer importeres.** En TwinCAT `.TcVIS`-fil er den samme visualiseringen i IDE-ens arkiv-XML, så den går gjennom CODESYS-konverteren. Sjekket mot det ekte TwinCAT PackML-eksempelet (tre skjermer, MIT, lisens beholdt ved siden av): 60 elementer tilordnet, ingen utilordnet. Se [Import a CODESYS screen](/nb/iot/codesys-screen-import/).
- **Knapper.** Hver enkel tilordning i en knapps input-handling (`X := 5`, `X := TRUE`, et oppregningsmedlem) blir et knappekort som skriver den verdien, med bildeteksten som etikett. Et konfigurert Toggle-input blir en på-knapp og en av-knapp. Kode som er mer enn en tilordning (en betingelse, et kall, aritmetikk), rapporteres med teksten sin. OMAC PackML-oppregningene er kjent; enhver annen går i importens `enums`, og et medlem uten kjent nummer skrives med navn, og det sies.
- **Lamper og skjuling med et uttrykk.** En lampes variabel eller en usynlighetsvariabel kan være en sammenligning av én tag med et tall, TRUE, FALSE eller et oppregningsmedlem, forbundet med NOT, AND og OR og parenteser. En sammenligning av to tagger, aritmetikk og kall kan ikke bæres og rapporteres.
- **Rammer.** En ramme viser en annen visualisering. Send prosjektets andre filer sammen med den første (`codesysRelated`; i dialogen, velg flere filer, og den første er skjermen), og rammens visualisering plasseres i rammen med hvert input bundet til variabelen rammen fikk.
- **Symbolregler kombineres.** En `show`- eller `colors`-regel kan være `{"all": [...]}` eller `{"any": [...]}`, en PLS-s AND og OR, tre nivåer dypt og åtte deler, og en tapt tag får en `all` til ikke å holde mens en `any` holder gjennom de andre. En lampe kan bære en `lit`-regel i stedet for taggen sin. Se [Dashbord](/nb/iot/dashboards/).
- **Tester.** Testen av energimåleren avgrenser det målerne talte, med tiden som virkelig gikk, ikke med faste ti sekunder.

## Migreringer

Ingen.

## API-endringer

`POST /api/dashboards/import` tar `codesysRelated` og `enums` ved siden av `codesys`. Ingen rute endret seg. Se [HTTP-API-et](/nb/iot/api/).

## Oppgradere fra 4.23.3

En vanlig `helm upgrade`. Ingen migrering og ingen ny secret.

## Hva som ikke er bevist

- Importørene ble bevist mot TwinCAT PackML-eksempelet og eksempeleksportene fra cds-text-sync og codescribe, ikke mot en kundes eget prosjekt. Et prosjekt som bruker mer av visualiseringsspråket, vil liste mer det ikke kunne plassere.
- Uttrykk er sammenligninger av én tag med en konstant forbundet med NOT, AND og OR. Alt annet rapporteres, ikke gjettes.
