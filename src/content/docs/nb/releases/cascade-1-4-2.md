---
title: "Utgivelsesnotater: HotLoop Cascade 1.4.2"
description: "Hva HotLoop Cascade 1.4.2 inneholder, hva som endres ved oppgradering og hva du bør lese før du rører et anlegg i drift."
sidebar:
  label: "1.4.2"
---

## Hva dette er

1.4.2 gir påloggingssiden et ryddigere utseende. Motoren, filformatet, REST-API-et, MCP-serveren og alle andre skjermer er som i 1.4.1.

## Påloggingssiden

Siden er nå ett kort på en rolig bakgrunn, med HotLoop Cascade-merket og -navnet sentrert over. Logg inn er den ene oransje knappen. Pålogging med passnøkkel og enkel pålogging er vanlige knapper under, og knappen for enkel pålogging viser Vord-ikonet når Vord er leverandøren. Den leses likt i lys og mørk og på en telefon, og språk- og temaknappene blir øverst til høyre.

Ingenting om hvordan du logger inn er endret: de samme feltene, de samme veiene inn, førstegangsoppsett, katalogpålogging, den andre faktoren, å legge til en passnøkkel eller en autentiseringsapp. Siden beholder id-ene sine, så passordbehandlere og bokmerker oppfører seg som før.

## Bare amd64, og hvorfor

Denne utgivelsen bygges bare for amd64. Multi-arkitektur kommer i sin egen kjøring, så utgivelsen etter denne er et lite versjonsløft som bygger begge. `stable`, `latest`, `1.4` og `1` lister det nye amd64-avbildet ved siden av arm64-avbildet de allerede pekte på.
