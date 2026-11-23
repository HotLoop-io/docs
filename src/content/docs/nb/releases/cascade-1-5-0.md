---
title: "Utgivelsesnotater: HotLoop Cascade 1.5.0"
description: "Hva HotLoop Cascade 1.5.0 inneholder, hva som endres ved oppgradering og hva du bør lese før du rører et anlegg i drift."
sidebar:
  label: "1.5.0"
---

## Hva dette er

1.5.0 lar en eier slette en person. Motoren, filformatet og alle andre skjermer er som i 1.4.2, og ingenting migreres.

## Slette en person

Før var den eneste måten å fjerne en konto på å slå den av, og den ble stående i listen for alltid. Nå har Brukere en Slett-knapp ved siden av Slå av, vist for eiere for alle unntatt dem selv, og den spør før den gjør noe. Det samme kallet finnes i REST-API-et, `DELETE /api/v1/users/{user}`, og i MCP-serveren som `delete_user`, med samme regel: bare en instanseier, aldri din egen konto, og aldri den siste eieren.

Kontoen, øktene, passnøklene, påloggingsidentitetene og API-nøklene forsvinner med en gang, så alt som fortsatt er logget inn som den personen, slutter å virke ved neste forespørsel. Revisjonsloggen noterer hvem som slettet hvem, med e-post, rolle og hvor mange økter og nøkler som gikk, og kjeden kan fortsatt verifiseres.

Arbeidet deres blir. Det personlige prosjektet deres blir et delt prosjekt oppkalt etter dem med "(removed)" etter, og det holder hver arbeidsflyt, legitimasjon og kjøring det hadde, og eiere og administratorer kan flytte hva som helst av det til et annet prosjekt eller gi det til noen. Den samme e-posten kan brukes senere for å lage en ny konto, som starter med et eget prosjekt.

Slå av er uendret og er det riktige valget når du vil beholde kontoen. En person identitetsleverandøren din fjerner over SCIM, blir fortsatt slått av og skjult, ikke slettet.

## Gå tilbake

Det er ingen migrering, så det forrige avbildet kjører på de samme dataene. En slettet konto kommer ikke tilbake; gjenopprett sikkerhetskopien du tok før slettingen hvis du trenger den.

## Bare amd64, og hvorfor

Denne utgivelsen bygges bare for amd64. Multi-arkitektur kommer i sin egen kjøring, så utgivelsen etter denne er et lite versjonsløft som bygger begge. `stable`, `latest`, `1.5` og `1` lister det nye amd64-avbildet ved siden av arm64-avbildet de allerede pekte på.
