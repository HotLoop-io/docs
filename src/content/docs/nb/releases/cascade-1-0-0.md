---
title: "Utgivelsesnotater: HotLoop Cascade 1.0.0"
description: "Hva HotLoop Cascade 1.0.0 inneholder, hva som endres ved oppgradering og hva du bør lese før du rører et anlegg i drift."
sidebar:
  label: "1.0.0"
---

## Hva dette er

1.0.0 er identitets- og styringsarbeidet og en ny editor, i én utgivelse. Alt i 0.1.2 er fortsatt her og fungerer som før: motoren, koblingene, importøren, Helm-chartet, Quadlet-enhetene og filformatet for arbeidsflyter. Det som er endret, er hva et anlegg kan gjøre med en instans, og hvordan den ser ut mens det skjer.

Vi kaller det 1.0.0 fordi editoren er den siste brikken vi ville ha før vi setter navnet vårt under nummeret. Hver skjerm fungerer mot det ekte API-et, og hver funksjon nedenfor er prøvd mot den ekte serveren den snakker med, ikke en stand-in.

## Den nye editoren

Den er bygget om i Astro med Svelte-øyer, i HotLoops egne farger og skrift, og følger systemets lyse eller mørke modus til du velger selv. Den er fortsatt bakt inn i binærfilen og henter ingenting fra noe sted, så en maskin uten internett kjører den like godt som en med. Hver skjerm den gamle editoren hadde er her og gjør det den gjorde, lerretet inkludert: vi tok med koden i stedet for å skrive den på nytt, og vi telte hver skjerm, knapp, felt og API-kall før og etter for å sikre at ingenting manglet.

URL-ene du har lagret, fungerer fortsatt. `#/w/<id>`, `#/x/<id>`, `#/executions` og feilsøkingslenkene åpner de samme skjermene, og `/app/main.js` og `/app/main.css` svarer fortsatt.

## Hva som er nytt

SAML, mot Keycloak, bare med signerte svar. LDAP og Active Directory, mot OpenLDAP og en Samba-domenekontroller, med roller fra grupper. SCIM, mot scim2-tester, slik at en leverandør oppretter og slår av kontoer uten at noen rører en skjerm. Egendefinerte roller, laget av prosjekttillatelsene. Eksterne hemmeligheter i OpenBao eller HashiCorp Vault, slik at passordet til en legitimasjon bor i lageret og roterer der. Loggstrømming av revisjonsloggen og ferdige kjøringer til syslog (TCP, UDP eller TLS) og OTLP, prøvd mot en ekte syslog-server og Loki. Variabler, mapper, innsikt, merknader på kjøringer, sladdingsregler og S3- og Azure-blobblagre, prøvd mot Garage og Azurite.

Editoren har en skjerm for hver av dem: Variabler, Innsikt og under Innstillinger Roller, Sladding, Eksterne hemmeligheter, Loggstrømming og Pålogging og SCIM. En person tilbys bare det rollen tillater, og serveren avviser fortsatt resten.

## EmberOps-stegene er borte

Vi tok ut EmberOps-koblingen. De ni stegene (`erpnext.trigger`, `getList`, `getDoc`, `create`, `update`, `delete`, `submit`, `cancel` og `call`), triggeren "Når et EmberOps-dokument opprettes eller endres", legitimasjonstypen EmberOps og skjermene og dokumentene som tilbød dem finnes ikke i 1.0.0. Hvis du må nå EmberOps, kaller HTTP-steget REST-API-et med en legitimasjon, og det fungerer i dag.

En arbeidsflyt du har lagret med ett av disse stegene, blir verken droppet eller stille endret. Den feiler validering og starter ikke, og meldingen nevner steget og sier at EmberOps-steg ble fjernet i 1.0.0. Slett steget, eller bytt det ut med et HTTP-steg, så kjører den igjen. En legitimasjon av typen EmberOps blir stående i listen, ubrukt, og du kan slette den. Importøren tar ikke lenger med en EmberOps-node: den kommer inn deaktivert med innstillingene i notatene, som enhver node den ikke har et steg for.

## Oppgradere fra 0.1.2

`helm upgrade` til 1.0.0, eller la `:stable` flytte Quadlet-enhetene. Åtte migreringer (0018 til 0025) kjører på veien opp. De oppretter tabeller for roller, variabler, mapper, merknader, sladdingsregler, SCIM, hemmelighetsleverandører og loggmål, og legger til én kolonne: mappen en arbeidsflyt ligger i. De rører ikke det du har, så arbeidsflytene, legitimasjonen og kjøringene dine ligger der de var, og nøkkelen åpner dem fortsatt. SAML, LDAP, SCIM og blobblagrene er av til du setter `HOTLOOP_CASCADE_*`-innstillingene deres, som står i `docs/IDENTITY.md` og `docs/GOVERNANCE.md`. Ingenting endres for en instans som ikke setter noen av dem, med mindre en arbeidsflyt av deg bruker et EmberOps-steg (se over).

## Dette må du vite

Migreringer går bare framover. En tilbakerulling setter det gamle avbildet tilbake, den angrer ikke migreringen av databasen din, så ta sikkerhetskopi før du oppdaterer, og se på den som veien tilbake. Ingenting i disse migreringene endrer eller fjerner det som var der, men vi har ikke kjørt det gamle avbildet på det nye skjemaet, så vi lover det ikke.

Eksterne hemmeligheter trenger tillatte stier. En leverandør uten noen blir avvist, med vilje, fordi lagerets token vanligvis kan lese mye mer enn den som redigerer legitimasjon bør kunne navngi.

SCIM viser aldri instanseieren til en leverandør, og en DELETE fra en leverandør slår av og skjuler en konto i stedet for å slette den, slik at en leverandør ikke kan fjerne den siste personen som kan logge inn. En gjenoppretting gir samme konto tilbake.

Variabler er ikke hemmeligheter. Alle som kan lese et prosjekt, leser variablene, og verdien sladdes ikke i kjøredataene. Passord hører hjemme i legitimasjon eller i et eksternt lager.

## Lisens

Cascade er under HotLoops Business Source License 1.1 (`BUSL-1.1`), som resten av HotLoop-familien. Det er ikke åpen kildekode, og jeg skal ikke late som det er det. Hver versjon blir til GPL-3.0 eller nyere fire år etter at den først ble gjort offentlig. Bruk hjemme og i laboratorium er gratis, og det samme gjelder produksjonsbruk i skoler, ideelle organisasjoner og offentlig sektor. Næringsbruk går via EmberNet, hvor registrering er gratis og næringsbruk også er det. Å drifte det som tjeneste for andre, selge det videre og bygge det inn i noe du selger er ikke tillatt. Filen `LICENSE` er den juridiske teksten og vinner enhver uenighet med dette avsnittet.
