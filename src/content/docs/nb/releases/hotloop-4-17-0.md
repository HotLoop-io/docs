---
title: "Utgivelsesnotater: HotLoop core 4.17.0"
description: "Hva HotLoop core 4.17.0 gir deg, hva som endrer seg ved oppgradering og hva du bør lese før du rører et anlegg i drift."
sidebar:
  label: "4.17.0"
---

Fase 2 av automasjonsgrunnlaget, UniFi skrivebeskyttet og enhetspassord kryptert i hvile. Fra 4.16.0 er det en vanlig `helm upgrade`, men enhetspassordene dine krypteres ved første oppstart, og fra da av er nøkkelen en del av dataene dine. Les «Oppgradere fra 4.16.0» lenger ned før du rører et anlegg i drift.

De fullstendige notatene står i README: Hva som er nytt i 4.17.0.

## Kort fortalt

- **Automasjonsgrunnlaget, fase 2.** Helpers (verdiene folkene på anlegget eier, avvist og aldri avkortet), logbook (én tidslinje over tilstandsendringer, skrivinger, alarmer, kjøringer og konfigurasjon), steg for betingelse, venting og stopp og `forSec` på en tilstandstrigger, skript (skriv CIP-syklusen én gang og kjør den hvor som helst), oppskrifter (alle settpunkter for en kvalitet går ut samtidig eller ingen gjør det, lest tilbake fra enheten) og blueprints (en regel skrevet én gang, fylt ut for hver pumpe, festet til versjonen sin til noen har sett over oppgraderingen). MCP går fra 16 til 25 verktøy.
- **UniFi Network, skrivebeskyttet.** Svitsjer, porter, PoE, WAN og klienter som tagger, én innlogging per konsoll, sertifikatet festet. Skuffen til en taus PLS sier hvilken svitsjport den sitter på og om linken er oppe, og en fremmed på et nett merket OT utløser en alarm. Bevist skrivebeskyttet på ekte konsoller. **Ikke bevist ennå:** et ekte kabeltrekk på en overvåket enhet og en telefon som kobler seg til et nett merket OT. De to alarmene er bevist i testing og ingen andre steder før noen gjør begge deler ved racken.
- **Enhetspassord krypteres** i databasen og i sikkerhetskopier, med en nøkkel som chartet genererer i `<release>-secret-key` og beholder.
- **Rettinger et anlegg på 4.16.0 kan snuble i:** en Edge Relay fra chartet eller Quadlet-enheten ignorerte hver konfigurasjon som ble sendt, og en med persistens av startet ikke; en manuell endring i regelredigereren nullstilte regelens kjørebudsjett; kommandopromptens dom kunne flytte Set unna under klikket; en forsinket oppdatering kunne sette skjermen Entities tilbake i tid; en regel som aldri hadde kjørt, sa at den kjørte for 739887 dager siden; App Store-distribusjoner hadde ingen tenant.

### API-endringer

- Et tidspunkt som ikke har skjedd, utelates, og sendes ikke som `0001-01-01T00:00:00Z`: `lastRun`, `lastPoll`, `lastGood`, `clearedAt`, `ackedAt`, `shelvedUntil`, `raisedAt` og resten, også på live-feeden.
- Nye ruter: `/api/helpers`, `/api/logbook`, `/api/scripts`, `/api/recipes`, `/api/blueprints`, `POST /api/automations/{id}/blueprint-upgrade`, `/api/devices/{id}/network`, `/api/unifi/{id}/...` og `DELETE /api/fleet/{id}/config`. Alle i docs/API.md.
- Nye rettigheter, og operatørrollen har dem: `helpers.write`, `scripts.run`, `recipes.apply`, `blueprints.apply`. Å skrive skript, oppskrifter og blueprints er admin.
- Tagger har `deviceClass`; regler har `blueprintId`, `blueprintVersion` og `blueprintInputs`.

### Oppgradere fra 4.16.0

- `helm upgrade <release> hotloop/hotloop --version 4.17.0 --reset-then-reuse-values`. Ikke `--reuse-values`, som mister de nye standardverdiene og feiler ved rendering. Selektorer og volume claims er uendret; det eneste nye objektet er Secret for nøkkelen.
- Migreringene 0009 til 0015 kjøres ved oppstart (helpers, logbook, skript, tag-enhetsklasse, oppskrifter, blueprints, UniFi). Alle er additive. Ta `pg_dump` først.
- `HOTLOOP_SECRET_KEY_FILE`: chartet genererer nøkkelen ved denne oppgraderingen, og Gateway krypterer hvert lagrede enhetspassord ved den oppstarten. Uten nøkkelen etterpå blir disse enhetene stående nede med en feil som nevner nøkkelen. En sikkerhetskopi tatt etter oppgraderingen kan bare gjenopprettes med den nøkkelen, eller med `--restore-keep-unreadable-credentials`, som lar disse enhetene stå nede til noen taster inn passordene på nytt. Ta vare på Secret atskilt fra sikkerhetskopiene dine. Å gå tilbake til 4.16.0 betyr å gjenopprette dumpen du tok før oppgraderingen.
- Rendrer du chartet med `helm template` i stedet for å installere det? Ta med din egen nøkkel i `secretKey.existingSecret`, ellers lager hver rendering en ny.
- Edge Relay: en sendt enhetsfil ligger i `/data/pushed-devices.json` og går foran chartets `devices` så lenge den finnes; `DELETE /api/fleet/{id}/config` fjerner den. En push som feilet på 4.16.0, ligger fortsatt på megleren og kommer frem ved første oppstart av 4.17.0. Quadlet-brukere tar den nye enheten. Med `persistence.enabled=false` starter den nå, men mister videresendingskøen, en sendt fil og OPC UA-sertifikatet hver gang poden byttes ut.
