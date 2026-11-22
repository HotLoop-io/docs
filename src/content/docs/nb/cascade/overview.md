---
title: "HotLoop Cascade: arbeidsflyter"
description: "Arbeidsflyter som får anlegget til å snakke med alt annet, med sjekkpunkter slik at et nytt forsøk bare er en databaserad. Én statisk Go-binærfil."
---

Cascade får anlegget til å snakke med alt annet. En alarm, en webhook, en tidsplan, en ny rad eller en MQTT-byge blir til en pakke med elementer, og elementene går gjennom trinn som kaller ekte systemer med ekte legitimasjon. Hvis et API er nede eller maskinen starter på nytt midtveis, blir jobben likevel ferdig, fordi hvert trinn har et sjekkpunkt og et nytt forsøk er en rad i databasen.

Det er én statisk Go-binærfil. SQLite på en Raspberry Pi, eller Postgres med så mange workere du vil på k3s. Postgres er også køen, så det er ingen Redis å passe på i et anleggs-cluster.

## Hva den ikke gjør

**Den skriver ikke til utstyret ditt.** Cascade leser og abonnerer. Alt som beveger en ventil eller endrer et settpunkt går gjennom HotLoops write gate, slik at gatens revisjon ser hver skriving, uansett hvilken arbeidsflyt som startet den. En arbeidsflytmotor med en bakdør inn til PLS-en er slik et revisjonsspor slutter å være ærlig.

**Den kjører ikke JavaScript i feltene dine.** Feltuttrykk bruker expr, det samme lille språket som HotLoops automatiseringer bruker. De kan ikke røre operativsystemet, nettverket eller filsystemet, og de avsluttes alltid. JavaScript finnes på nøyaktig ett sted, Code-trinnet, og det kjører i en egen, avskjermet prosess uten hemmeligheter, uten nettverk og uten filsystem. Å holde det ute av alle andre felt holder ekstern kodekjøring ute av dem.

**Den låser ikke noe.** SSO, påtvunget MFA, RBAC, revisjon, versjonshistorikk, API-nøkler med avgrenset omfang og HA-workere er alle i den ene binærfilen. Det finnes ingen lisenssjekk noe sted i koden.

**Den ringer ikke hjem.** Ingen lisensserver, ingen skyavhengighet. Telemetri er opt-in, avslått som standard, og dokumentert helt ned til feltet når den kommer.

## Hvor du går videre

[Kjør Cascade](/nb/cascade/running/), kjør den [med Podman Quadlet](/nb/cascade/quadlet/), eller les [veikartet for Cascade](/nb/cascade/roadmap/). Skal du bruke den på et anlegg? [Bruke HotLoop i en bedrift](/nb/business/) tar for seg lisensiering og hvordan du når oss.
