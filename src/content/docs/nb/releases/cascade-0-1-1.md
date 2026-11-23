---
title: "Utgivelsesnotater: HotLoop Cascade 0.1.1"
description: "Hva HotLoop Cascade 0.1.1 inneholder, hva som endres ved oppgradering og hva du bør lese før du rører et anlegg i drift."
sidebar:
  label: "0.1.1"
---

## Hva dette er

0.1.1 er den første versjonen som ikke er en kandidat. Det fantes en 0.1.0-tagg som aldri publiserte noe: den ble avbrutt før noe nådde registeret. En tagg blir der den er, så dette er samme kode, nå publisert.

Hva det er: arbeidsflytmotoren vi ville ha på et anlegg. Én statisk Go-binærfil, SQLite på én maskin eller Postgres med workere når du trenger mer, og editoren er bygget inn i binærfilen, så det er ikke noe annet å kjøre.

## Hva som er med

Motoren, der hvert steg lagres som et sjekkpunkt, slik at en `kill -9` midt i en kjøring fortsetter der den stoppet. Varige ventetider, nye forsøk, feilporter og feilarbeidsflyter. Uttrykk og et Kode-steg som kjører JavaScript isolert i sin egen prosess.

Webhooks med en varig innboks, tidsplaner som utløses nøyaktig én gang per tidsluke uansett hvor mange hovednoder som ser på, MQTT og en trigger for filer som havner i en katalog. Et HTTP-steg for alt som har et API, og koblinger for HotLoop, Postgres, EmberOps, e-post, ntfy, Gotify og Discord. Ingen andre, med vilje.

Et hvelv for legitimasjon med nøkkelrotasjon, OAuth2 for alle tildelinger et anlegg trenger, pålogging med passord, TOTP, passnøkler eller din egen OpenID Connect-leverandør, påkrevd MFA, prosjekter og roller, en revisjonslogg du kan verifisere, hver lagring bevart som en versjon og et API med omfang og et OpenAPI-dokument. Målinger, sporing og helsesjekker, slik at noen andre enn meg kan se når noe står fast.

## Slik kjører du det

Avbildet finnes for amd64 og arm64. Hent det med digesten ovenfor hvis du vil ha en utrulling som ikke kan flytte seg.

På k3s: Helm-chartet, enten alene eller delt i server og workere.

På en vanlig maskin: Quadlet-enhetene under `deploy/quadlet`, SQLite på én maskin eller Postgres med ekstra workere. De følger `:stable`, og Podmans tidsur for automatisk oppdatering flytter dem. En oppdatering som ikke kommer opp frisk, rulles tilbake til avbildet som kjørte. Vi kjørte dette på ekte, begge variantene, på Podman 5.8.7 under systemd: oppstarten venter på frisk status, en drept container kommer tilbake, en god oppdatering går gjennom, en dårlig rulles tilbake, og en arbeidsflyt kjører etter hver.

## Dette må du vite

Migreringer går bare framover. En tilbakerulling setter det gamle avbildet tilbake, den angrer ikke migreringen av databasen din, så ta sikkerhetskopi før du slår på oppdateringer.

Registeret var privat for denne versjonen, så det trengtes først en `podman login ghcr.io` som root. Avbildet og chartet er offentlige fra 0.1.2 og hentes uten innlogging.

Mister du nøkkelen som forsegler lagret legitimasjon, blir all lagret legitimasjon uleselig. Ha en kopi et annet sted enn på maskinen.

## Lisens

Cascade er under HotLoops Business Source License 1.1 (`BUSL-1.1`), som resten av HotLoop-familien. Det er ikke åpen kildekode, og jeg skal ikke late som det er det. Hver versjon blir til GPL-3.0 eller nyere fire år etter at den først ble gjort offentlig. Bruk hjemme og i laboratorium er gratis, og det samme gjelder produksjonsbruk i skoler, ideelle organisasjoner og offentlig sektor. Næringsbruk går via EmberNet, hvor registrering er gratis og næringsbruk også er det. Å drifte det som tjeneste for andre, selge det videre og bygge det inn i noe du selger er ikke tillatt. Filen `LICENSE` er den juridiske teksten og vinner enhver uenighet med dette avsnittet.

## Det som ikke er her ennå

SAML, LDAP, SCIM, miljøer, HA-planleggeren med leieavtaler, flere koblinger, KI-steg. Det kommer i 0.2.0 og senere, og alt står i veikartet.
