---
title: "Utgivelsesnotater: HotLoop Cascade 1.1.0"
description: "Hva HotLoop Cascade 1.1.0 inneholder, hva som endres ved oppgradering og hva du bør lese før du rører et anlegg i drift."
sidebar:
  label: "1.1.0"
---

## Hva dette er

1.1.0 gir Cascade en MCP-server og skjermene editoren manglet, og flytter pålogging inn i editoren. Motoren, filformatet for arbeidsflyter og REST-API-et er som i 1.0.2.

## MCP-serveren

Den ligger på `/mcp`, på samme adresse som API-et, leveres påslått og skriver. Alle MCP-er i HotLoop-familien leser og skriver, og Cascade var den siste uten MCP i det hele tatt.

En agent logger inn med en API-nøkkel og får det innehaveren av nøkkelen kan gjøre, skåret ned til nøkkelens omfang. Det er 79 verktøy, og hvert av dem er en rute i REST-API-et: Et kall går gjennom rutens egen håndterer, så tillatelsessjekken, valideringen, skrivingen og revisjonsraden er rutens. Ingenting er kopiert inn i MCP-serveren, så ingenting kan drive fra hverandre, og ingenting er utelatt, så ingenting hoppes over.

- Et verktøy som endrer noe, ber om en `reason`, og revisjonsloggen beholder den ved siden av endringen, sammen med nøkkelen og navnet klienten ga seg selv.
- Hemmeligheten til en legitimasjon kommer aldri tilbake, til noen. En legitimasjon opprettet over MCP har hemmelighetene forseglet idet de kommer inn.
- `HOTLOOP_CASCADE_MCP` og `HOTLOOP_CASCADE_MCP_WRITES` er utrullingens brytere, begge påslått som standard. Ingen verktøy og ingen API-rute kan endre dem, så en agent som kan redigere instansens innstillinger, kan fortsatt ikke slå skriving på igjen.
- Rutene som avviser en nøkkel selv (å lage API-nøkler, SCIM-tokens, hemmelighetsleverandører og loggmål) er ikke verktøy, fordi en nøkkel som kunne lage nøkler, er en lekket nøkkel som holder seg i live. MCP-siden lister dem med hvert verktøy og tillatelsen det ber om.

## Skjermene

Legitimasjon, Prosjekter, Kontoen din og, for eiere og administratorer, Innstillinger, Brukere og revisjonsloggen. Hver følger de samme tillatelsene som API-et: En person tilbys bare det rollen tillater, og serveren avviser fortsatt resten.

- **Legitimasjon** opprettes, åpnes, endres, deles med andre prosjekter og slettes. En hemmelighet legges inn én gang, og skjermen sier bare at den er satt.
- **Prosjekter** har medlemmer og rollene deres, og tjenestekontonøklene en vedvarende integrasjon logger inn med, vist én gang.
- **Konto** lager og tilbakekaller API-nøklene dine, som API-et og MCP logger inn med, og endrer passordet ditt.
- **Brukere** oppretter personer og slår dem av eller på. **Revisjonsloggen** leses, filtreres og sjekkes for tukling. **Innstillinger** har kravet om andre faktor og feilarbeidsflyten.

Pålogging er nå editorens egen side, på `/login`, i editorens farger, lys og mørk, på en telefon like godt som ved en pult. Den gjør alt den gamle siden gjorde: førstegangsoppsett, passord, katalogkontoer, enkel pålogging, passnøkler, den andre faktoren og gjenopprettingskoder.

## Bare amd64, og hvorfor

Denne utgivelsen bygges bare for amd64. Multi-arkitektur kommer i sin egen kjøring, så utgivelsen etter denne er et lite versjonsløft som bygger begge. Inntil da lister `stable`, `latest` og de korte taggene dette amd64-avbildet ved siden av arm64-avbildet de allerede pekte på, så en arm-maskin henter fortsatt. Versjonstaggen `1.1.0` er bare amd64.

## Oppgradere, og gå tilbake

Ingen migreringer. `helm upgrade` til 1.1.0, eller la `:stable` flytte Quadlet-enhetene. Det er trygt å sette 1.0.2 tilbake, fordi ingenting i databasen endret seg. Det en tilbakerulling ikke kan angre, er det en agent allerede har gjort: endringene dens står, og revisjonsradene den skrev, blir i loggen med aktørtypen `mcp`. En sikkerhetskopi før enhver oppdatering er fortsatt en god vane.
