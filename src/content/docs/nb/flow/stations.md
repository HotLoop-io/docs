---
title: "Sending til en tenants stasjoner"
description: "Én flytfil og FlowLab-diagrammene den inneholder til hver Flow-installasjon en tenant kjører, én om gangen, sjekket etter hver, og tilbakestilt ved feil."
---

En tenant i EmberNet kan kjøre flere HotLoop Flow-installasjoner, én på hvert anlegg eller hver linje. Vi kaller hver av dem en stasjon. Denne siden handler om å legge én flytfil, og dermed ett sett FlowLab-diagrammer, på alle, sjekke hver av dem og sette en stasjon tilbake hvis den feiler.

Kortversjonen: `hotloop-flow stations push -tenant acme -file flows.json` sender til stasjonene EmberNet viser som kjørende for `acme`, én om gangen. Hvis en stasjon ikke er i orden etterpå, går den stasjonen tilbake til det den hadde, og sendingen stopper. Hvis filen ville startet en kjørende logger på nytt, skjer ingenting før du sier at det er greit.

## Hvor stasjonene kommer fra

Ingen skriver inn en stasjon. Listen er det EmberNet-dashbordet viser som kjørende for tenanten, den samme listen som siden Running Apps: hver app merket `hotloop-flow` som kjører og tilhører tenanten. En stasjon nås på sin Flux-adresse når dashbordet oppgir en, og ellers på klyngeadressen, så kjør sendingen fra et sted der den adressen kan slås opp.

Tenanten oppgis alltid, og en sending gjelder alltid bare den ene tenanten. Dashbordet spørres med dashbordtokenet ditt og holder deg til tenantene du får se, og vi kontrollerer svaret på nytt: en rad som kommer for en annen tenant, forkastes og telles, aldri brukes. En tenant uten kjørende Flow svarer med en feil.

## Kommandoen

```bash
hotloop-flow stations list -tenant acme
hotloop-flow stations push -tenant acme -file flows.json -note "new line 3 logger"
```

Dashbordadressen kommer fra `-dashboard` eller `HOTLOOP_FLOW_DASHBOARD_URL`, og tokenet fra `-dashboard-token-file` eller `HOTLOOP_FLOW_DASHBOARD_TOKEN`. Tokenet stasjonene godtar, kommer fra `-token-file` eller `HOTLOOP_FLOW_TOKEN`, som for `hotloop-flow deploy`. Lag det med `hotloop-flow token`, og gi hver stasjon det tokenet som et API-token med `flows.read`, `flows.write` og `status.read` (et vanlig utrullingstoken har bare de to første): sjekken må lese hver stasjons diagrammer, og det kan ikke et vanlig utrullingstoken. Stasjonene til én tenant bruker samme token.

| Flagg | Hva det gjør |
|---|---|
| `-dry-run` | Planlegger hver stasjon og endrer ingen. Viser hva som er i drift, hva hver ville startet på nytt, og hvilke som ikke kunne planlegges. |
| `-confirm-restart` | Du godtar at kjørende loggere kan startes på nytt av denne sendingen. |
| `-window 02:00-04:00` | Timene da en omstart er godtatt på forhånd, i `-window-zone` (et IANA-navn, UTC hvis utelatt). En sending innenfor vinduet fortsetter. Det kan gå over midnatt, `22:00-02:00`. |
| `-settle 5s` | Hvor lenge en stasjons diagrammer får på seg til å starte før sjekken regner dem som ikke kjørende. |
| `-json` | Rapporten som JSON. |

Avslutningskode 0 betyr at alle stasjoner er ferdige. 3 betyr at en stasjon feilet og sendingen stoppet. 4 betyr at sendingen venter på at du godtar omstarter. 5 betyr stasjoner som ble hoppet over fordi de ikke svarte eller ikke kunne planlegges.

## Hva en sending gjør

Først planlegger den hver stasjon uten å endre noen. For hver leser den den gjeldende flytfilen og revisjonen, finner utrullingsposten den kunne gå tilbake til, lister diagrammene og regner ut hvilke kjørende loggere filen ville startet på nytt. Hvis ingenting trenger et ja, går den så stasjon for stasjon i navnerekkefølge.

1. **Ruller ut** filen med revisjonen planen så, slik at en utrulling noen gjorde i mellomtiden, avvises i stedet for å overskrives. Bare det som er endret, starter på nytt. Legitimasjon reiser aldri: hver stasjon beholder sine egne passord, og et instruments skriving forblir av til noen på den stasjonen slår den på.
2. **Sjekker.** Stasjonen må svare med revisjonen alle stasjoner skal ha. Revisjonen kommer fra filens innhold, så den samme filen er den samme revisjonen overalt, og sendingen sier hva den er før den starter. Hvert diagram i filen som starter av seg selv, må være på stasjonen, uten problem, og kjøre eller være ferdig innen stabiliseringstiden. En node som ikke startet, får også sjekken til å feile.
3. **En stasjon som feiler sjekken, går tilbake.** Den rulles tilbake til utrullingen den var på, som en utrulling for seg, og det kontrolleres at den er på sin gamle revisjon. Sendingen stopper der.

Rapporten sier hva som skjedde med hver stasjon:

| Status | Betydning |
|---|---|
| `done` | Utrullet og bestått sjekken. |
| `unchanged` | Allerede på denne revisjonen, og diagrammene er som de skal. |
| `failed` | Ikke utrullet (stasjonen avviste det, eller noen rullet ut i mellomtiden), eller allerede på denne revisjonen og ikke i orden. Ingenting ble endret. |
| `reverted` | Feilet sjekken og er tilbake på revisjonen den hadde. |
| `revert-failed` | Feilet sjekken og kunne ikke settes tilbake. Denne trenger et menneske. |
| `skipped` | Ikke rørt. Den svarte ikke, eller den har ingen utrullingspost for sin gjeldende revisjon, så en mislykket sending kunne ikke vært angret der. Rull ut til den én gang for hånd, eller fiks forbindelsen, og send på nytt. |
| `not-started` | Sendingen stoppet før denne stasjonen. Den er som den var. |
| `planned` | Svaret fra en prøvekjøring. |

Stasjoner som ble hoppet over, stopper ikke sendingen. En sending kan gjentas: en stasjon som allerede er på revisjonen, er `unchanged`, så en ny sending gjør bare ferdig det den første ikke rakk.

## Omstarter

Et diagram som starter av seg selv, er en logger. Å rulle ut et endret diagram starter det på nytt, og et fjernet stopper. En sending som ville gjort det mot en logger som kjører, stopper før den rører noe, og rapporten navngir hver stasjon og hver logger. Så lar én av tre ting den fortsette:

- du svarer ja på spørsmålet, når kommandoen kjøres i en terminal;
- du oppgir `-confirm-restart`;
- klokkeslettet er innenfor vinduet du ga med `-window`.

Ingenting starter på nytt uten en av dem. Et diagram som ikke er endret, beholder kjøringen sin, og et nytt starter bare.

## Fra en instans, og for en agent

En instans kan sende til sin egen tenants stasjoner gjennom admin-API-et, og det er det MCP-verktøyene `list_stations` og `push_to_stations` bruker. Sett alle fire av disse, i konfigurasjonsfilen under `stations:` eller i miljøet, så dukker rutene `GET /stations` og `POST /stations/push` opp. Uten dem finnes de ikke.

| Innstilling | Miljø | Hva det er |
|---|---|---|
| `stations.dashboardUrl` | `HOTLOOP_FLOW_STATIONS_DASHBOARD_URL` | EmberNet-dashbordet som kjenner tenantens installasjoner. |
| `stations.tenant` | `HOTLOOP_FLOW_STATIONS_TENANT` | Den ene tenanten denne instansen sender for. En forespørsel kan ikke oppgi en annen. |
| `stations.dashboardTokenFile` | `HOTLOOP_FLOW_STATIONS_DASHBOARD_TOKEN_FILE` | En fil med dashbordtokenet. |
| `stations.deployTokenFile` | `HOTLOOP_FLOW_STATIONS_DEPLOY_TOKEN_FILE` | En fil med utrullingstokenet stasjonene godtar. |

I chartet er disse `stations.dashboardUrl`, `stations.tenant`, `stations.dashboardTokenSecret` og `stations.deployTokenSecret`, hver Secret med ett token og montert som en fil; med Podman og Quadlet er de de fire miljøvariablene og de to monterte hemmelighetene i [Utrulling av Flow](/nb/flow/deploying/). Sett alle fire eller ingen: en chart-rendering med noen av dem avvises, og det samme gjelder en oppstart med noen av dem.

`POST /stations/push` krever `flows.write` og tar `{flows, note, confirmRestart, window, windowZone, dryRun}`. Utelater du `flows`, sender den det denne instansen kjører. Den svarer med samme rapport, pluss `ok`, og en sending står i revisjonsloggen som `stations.push`. `GET /stations` krever `flows.read`. En sending som venter på et ja, svarer med `needsConfirm` true og har ikke endret noe: send den på nytt med `confirmRestart` eller et vindu.

## Hva som ikke er bevist

Formen på dashbordets liste ble lest fra det live dashbordet for en ekte tenant. Det er ikke sendt til en tenants stasjoner gjennom Flux, så om adressen dashbordet gir kan nås fra der du kjører sendingen, må du selv sjekke med `stations list` og en `-dry-run`.
