---
title: "Utgivelsesnotater: HotLoop Cascade 1.3.0"
description: "Hva HotLoop Cascade 1.3.0 inneholder, hva som endres ved oppgradering og hva du bør lese før du rører et anlegg i drift."
sidebar:
  label: "1.3.0"
---

## Hva dette er

1.3.0 setter editoren på 14 språk: engelsk, spansk, fransk, italiensk, tysk, norsk bokmål, bulgarsk, gresk, koreansk, japansk, vietnamesisk, hindi, forenklet kinesisk og arabisk. Motoren, filformatet for arbeidsflyter, REST-API-et og MCP-serveren er som i 1.2.1.

## Språkene

- En språkvelger står i toppfeltet i editoren og på påloggingssiden. Valget lagres i nettleseren, og et førstegangsbesøk følger nettleserens språk.
- Hver skjerm er oversatt: arbeidsflyter, kjøringer, innsikt, variabler, legitimasjon, prosjekter, brukere, roller, revisjonsloggen, innstillinger, kontoen din, hemmeligheter, loggstrømming og stegeditoren. Det samme gjelder stegtitlene og hjelpen deres, legitimasjonstypene og avvisningene serveren sender når en lagring, en sletting eller en pålogging avvises.
- Datoer, tall, varigheter og lister kommer fra nettleserens egen formatering for språket du velger. Arabisk skrives fra høyre til venstre, med lerretet, koden og uttrykkene fortsatt fra venstre til høyre. Arabisk bruker sifrene 0 til 9 og den gregorianske kalenderen.
- Produktnavn, nodenavn, protokollnavn og eksempelverdier forblir engelske på alle språk. En melding om hvordan personen som driver instansen har satt opp en katalog, en SAML- eller OpenID-leverandør, et hemmelighetslager eller en nøkkelfil, vises slik serveren skrev den, fordi driftspersonen søker etter den teksten.
- Ordene kommer fra den felles HotLoop-ordlisten. Linjene en morsmålsleser bør bekrefte først, står i `_review.json` for hvert språk, under `web/src/i18n/locales`. Ingen som leser disse språkene som morsmål har gjennomgått dem ennå.
- Et språk tilbys bare når hver linje av det er der. Byggingen sjekker at hvert språk har hver engelsk nøkkel, at plassholdere og tagger overlever og at flertallsformene stemmer. En Go-test holder de engelske stegordene og servermeldingene lik det serveren kan si, så et nytt steg eller en ny avvisning ikke kan komme ut uten en linje å oversette.

## Også i denne utgivelsen

- Editortesten som sjekker at de bygde filene aldri peker til en annen vert, tillater nå fire eksempeladresser (`https://ntfy.sh`, `https://example.com`, `https://hotloop.plant` og `http://hotloop:8080`). De står i hjelpeteksten til stegene, som nå følger med editoren for alle språk, og er ord i en setning som ingenting henter. Nettlesertesten feiler fortsatt hvis editoren ber om noe fra en annen vert.
- Testnettleseren har Noto-skriftene for koreansk, japansk, kinesisk og hindi, så disse skjermene tegner bokstaver og ikke tomme bokser.
- OpenBao-testhjelperen prøver en skriving på nytt mens OpenBao sier at en ny nøkkel-verdi-montering fortsatt oppgraderes (26e1e13).
- HotLoop LLC er navngitt som lisensgiver og vedlikeholder av Cascade (0ea9cd5).

## Bare amd64, og hvorfor

Denne utgivelsen bygges bare for amd64. Multi-arkitektur kommer i sin egen kjøring, så utgivelsen etter denne er et lite versjonsløft som bygger begge. `stable`, `latest`, `1.3` og `1` lister det nye amd64-avbildet ved siden av arm64-avbildet de allerede pekte på.

## Et kjent problem

I den delte installasjonen (server-, worker- og webhook-pods på PostgreSQL) starter podene før databasens navn er løst og starter om to eller tre ganger før de er klare. De kommer opp og installasjonen består, men det er støyende. 1.2.1 gjør det samme, så dette er ikke nytt. Løsningen er å koble til med nye forsøk til databasen er klar, og den kommer i neste utgivelse.

## Oppgradere, og gå tilbake

Ingen migreringer. `helm upgrade` til 1.3.0, eller la `:stable` flytte Quadlet-enhetene. Det er trygt å sette 1.2.1 tilbake, fordi ingenting i databasen endret seg. Det valgte språket bor i nettleseren, så du mister ingenting ved å gå tilbake, bortsett fra velgeren.
