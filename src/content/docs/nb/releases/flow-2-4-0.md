---
title: "Utgivelsesnotater: HotLoop Flow 2.4.0"
description: "Hva HotLoop Flow 2.4.0 gir deg, hva som endres ved oppgradering og hva du bør lese før du rører et anlegg i drift."
sidebar:
  label: "2.4.0"
---

HotLoop Flow 2.4.0 lar EmberCORE-dashbordet logge folk inn i Flow. En person som åpner Flow fra dashbordet er inne med rollen tenanten ga vedkommende, full tilgang eller skrivebeskyttet, uten en ny pålogging. Det er av med mindre dashbordets nøkkel er konfigurert, og ingenting som fungerte før endres.

## Nytt

**Pålogging fra EmberCORE-dashbordet**
- Dashbordet legger et token det har signert i `X-Embernet-Assertion` på hver forespørsel det sender videre til Flow, også editorens websocket. Flow sjekker det med dashbordets offentlige nøkkel: signaturen (ES256), utstederen (`embernet-dashboard`), at det ble laget for denne Flow i denne tenanten (audience er `<tenant>/<release>`, så et token for en annen app åpner ingenting her) og utløpet, omtrent ett minutt. Et token som er feil på noen av disse punktene avvises, og ingenting annet på forespørselen redder det.
- Rollen kommer fra tenantens rollekart i dashbordet. `*` er alle tillatelser. `read` er flytene, paletten, innstillingene og statusen, og ingenting som endrer dem: ingen distribusjon, ingen inject, ingen distribusjonslogg. Operatører og Seere får `read` som standard. En rolle som ingen av delene, eller ingen, gir ingen tilgang. Noen som er logget inn på denne måten vises i distribusjonsloggen og revisjonssporet som `dashboard:<email>`.
- Det finnes ingen økt. Dashbordet sender et ferskt token på hver forespørsel, så en rolle endret der trer i kraft ved neste forespørsel og det er ingenting å tilbakekalle.
- Editoren sier «Åpne dette fra EmberCORE-dashbordet» i stedet for å tilby sitt eget påloggingsskjema, og fjerner Logg ut-knappen når dashbordet logget deg inn. `GET /auth/mode` er måten den spør på, før noen har logget inn.
- Charten tar det under `embernetSignin`. App Store sender dashbordets offentlige nøkkel videre; charten monterer den, skriver innstillingene, ruller poden og annoterer Service slik at dashbordet vet at det skal logge folk inn.

## Hva som er endret

Ingenting, med mindre du setter nøkkelen. Uten nøkkelfil leser Flow ikke headeren i det hele tatt, og en `helm template` av standardverdiene er det den var.

## Oppgradering

En enkel `helm upgrade` til 2.4.0-imaget og -charten. Ingenting skjer ved første oppstart.

For å bruke det manuelt monterer du dashbordets offentlige nøkkel (en PEM-fil) og setter `auth.assertion.publicKeyFile` og `auth.assertion.audience`, eller `HOTLOOP_FLOW_ASSERTION_PUBLIC_KEY_FILE` og `HOTLOOP_FLOW_ASSERTION_AUDIENCE`. Flow nekter å starte med en nøkkel den ikke kan lese eller uten audience. De andre innstillingene er `auth.assertion.issuer` (`embernet-dashboard`), `header` (`X-Embernet-Assertion`) og `hideLogin` (`true`).

Admin-påloggingen og API-tokenene fungerer fortsatt ved siden av. De er nødutgangen for ansatte og automatisering, og at editorens skjema forsvinner, berører dem ikke.

Image: `ghcr.io/hotloop-io/hotloop-flow:2.4.0`, linux/amd64 og linux/arm64. Chart: `https://hotloop.io/hotloop-flow/`. README-en på denne taggen har resten: https://github.com/HotLoop-io/hotloop-flow/blob/v2.4.0/README.md
