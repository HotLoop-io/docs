---
title: "Loggboken"
description: "Tilstandsendringer, skriving, alarmer, regelkjøringer og konfigurasjonsendringer på én tidslinje, for anlegget, ett område eller én entitet."
---

Én tidslinje over det som har skjedd på anlegget, nyeste først: pumpa gikk på, noen skrev 180 til settpunktet i sone 1, alarmen for høy temperatur ble utløst og kvittert, nedkjølingsautomatiseringen kjørte, en enhet ble omkonfigurert. For hele anlegget, ett sted i utstyrstreet og alt under, eller én entitet. Det er fanen Loggbok, en seksjon i skuffen til hver entitet, `GET /api/logbook` (se [HTTP-API-et](/nb/iot/api/#logbook)) og MCP-verktøyet `get_logbook` (se [MCP](/nb/iot/mcp/)).

Det første spørsmålet når noe går galt er «hva skjedde rett før?», og til nå lå svaret på fem steder: skrivegranskingen, alarmhistorikken, automatiseringskjøringene, systemloggen og ingens hukommelse om hva utstyret selv gjorde. Loggboken er de fem i én liste.

## Hva som står i den

| Type | Fra | Hva en linje sier |
|---|---|---|
| `state` | `entity_state_log` | tilstanden til en entitet endret seg: `changed to on (was off)` |
| `write` | `write_audit` | en skriving til en tag, utført, avvist eller mislykket, av hvem og gjennom hvilken dør |
| `alarm` | `alarm_events` | en alarm utløst, kvittert, ryddet, utsatt, med notatet som ble gitt |
| `automation` | `automation_runs` | en regel kjørte, hvordan den endte, hva som startet den |
| `event` | `events` | konfigurasjonsendringer, sammendrag av tjenestekall og begrunnelsene som ble gitt for skriving, og det en UniFi-konsoll rapporterer i øyeblikket det skjer, lagt under svitsjen eller aksesspunktet det gjelder (en svitsj som mister kontakten, er en advarsel) |
| `script` | `script_runs` | et [skript](/nb/iot/scripts/) kjørte, hvordan det endte, hvem som startet det og hva som kalte det |
| `recipe` | `recipe_applications` | en [oppskrift](/nb/iot/recipes/) ble brukt eller avvist: hvilken versjon, av hvem, hvor mange mål som fikk verdien og ble lest tilbake |

Bare `state` er nytt. De andre leses der de allerede ligger, når spørringen kjøres, og slås sammen. Ingenting skrives to ganger, så ingenting kan motsi sporet det kom fra, og hvert spor beholder sin egen lagringstid (under).

Fra systemloggen henter loggboken kategorien `config` og kategorien `write` sine egne linjer: sammendraget av et tjenestekall, et tjenestekall for en alarm, begrunnelsen som ble gitt for en skriving. Skriveportens egne linjer «wrote ...» og «write of ... refused» er utelatt, fordi de sier akkurat det skrivegranskingen allerede har, og hver skriving ellers ville vist seg to ganger.

### Hva som med vilje ikke står i den

**Numeriske målinger.** En sensor, et tall, en sløyfe eller en PLS-teller endrer seg ved hver avlesning, og hver måling ligger allerede i historikeren. Å logge dem på nytt ville begravd hver linje noen vil lese under en million om dagen ingen vil lese. Lag trend av dem i stedet.

**Knapper.** Tilstanden til en knapp er tidspunktet for siste trykk, og hvert trykk er allerede en skriving i granskingen. Den går også tilbake til ukjent ved hver omstart, og det ville vært en linje per knapp per omstart som ikke sier noe.

**Tilstandene til alarmentiteter.** Alarmens egen historikk ligger i loggboken som `alarm`-linjer, med mer i seg (verdien, notatet, hvem som kvitterte).

Alt annet registreres: binære sensorer, brytere, tekst, valg, motorer, ventiler, hjelpere og skript etter hvert som de kommer.

**Hjelpere logges av den som endret dem.** Endringen av en hjelper skrives til loggboken i samme transaksjon som verdien, av prosessen som gjorde endringen, med hvem som gjorde det, hvor fra og under hvilken kall-id, og aldri hastighetsbegrenset. Opptakeren lar hjelpere være: den kjører bare i Gateway, så en agents endring gjennom `--mcp-stdio` ville gått den forbi, og hver prosess som holder hjelperen ser endringen, så den ville blitt logget én gang per prosess. Tidsplanen er unntaket, fordi ingen setter den og klokka flytter den: opptakeren logger den som enhver annen entitet.

## Prelling

En kontakt som preller med 10 Hz er ett faktum («den prellet så mange ganger»), ikke trettiseks tusen linjer i timen. Hver entitet får ti endringer rett gjennom, deretter én hvert annet sekund. En endring utover det logges ikke, og telles i stedet på entitetens neste linje:

```
changed to closed (was open); 14 changes before this not logged, it was changing faster than the logbook records
```

Tellingen er nøyaktig: linjene pluss tellingene deres er hver endring entiteten har gjort. Når prellingen stopper, logges entitetens sluttilstand alltid, innen to sekunder, så loggboken ender aldri på en tilstand utstyret har forlatt. Antallet undertrykt siden start er `suppressed` i `/api/diagnostics` under `logbook`.

## last_changed overlever en omstart

Tilstanden til en entitet beregnes fra de levende taggene og lagres aldri, så før loggboken fikk hver omstart hver entitet til å se ut som om den nettopp hadde endret seg. Loggboken beholder den nyeste tilstanden til hver sporet entitet og når den sist endret seg (`entity_last_state`), og entitetsmotoren leser den når den starter. En entitet som får samme tilstand tilbake, beholder sin `last_changed`.

En omstart ser slik ut innenfra: en enhet er ikke tilkoblet ennå, så entitetene dens blir utilgjengelige, deretter ukjente, og viser så målingen sin. Disse trinnene er denne prosessen som tar igjen det tapte, ikke anlegget som endrer seg, så man venter dem ut. En tilstand som virkelig endret seg mens Gateway var nede, får en ny `last_changed` og en linje som sier hva den var før. Av samme grunn holder loggboken tilbake en endring til utilgjengelig eller ukjent det første minuttet etter en start: en enhet som fortsatt er nede etter det, logges da, med tidspunktet den først ble sett nede.

## Filtre

- **Hvor:** en node i utstyrstreet og alt under. Et sted gjøres om til alle navnene sporene kjenner det under: entitetene der (etter sin egen plassering, ellers enhetens, samme regel som skjermen Entiteter bruker), enhetene der og hver tag på dem, alarmene på disse taggene, automatiseringene med en utløser på noe av det, og selve noden for konfigurasjonsendringene sine. En automatiseringskjøring hører også til et sted hvis den skrev der mens den kjørte, uansett hva som utløste den. En UniFi-konsolls hendelser finnes via nettverket, ikke via noe et menneske har plassert i treet: svitsjen en koblet enhet henger på, og hver svitsj mellom den og gatewayen, så en svitsj som faller ut, vises under hver linje den mater. En konsoll plassert i treet finner hendelsene om alt den har tatt i bruk. Se [UniFi Network](/nb/iot/unifi/#hendelser).
- **Entitet:** det samme, for én entitet: tilstandsendringene, skriving til den og taggene dens, alarmene, reglene den utløser eller som har skrevet til den, og konfigurasjonsendringer på den eller taggene dens. En entitet som senere er slettet, finnes fortsatt under navnet den hadde.
- **Hvem:** en del av aktøren, uten hensyn til store og små bokstaver: `alice`, `automation:cooldown` (kjøringene til regelen og hver skriving den gjorde), `mcp:` (alt noen agent gjorde). En tilstandsendring utstyret gjorde av seg selv, har ingen aktør.
- **Typer:** hvilke som helst av de fem.
- **Når:** `from` og `to`.

Paginering skjer med en peker, tidspunktet, typen og id-en til den siste linja, så en side forskyves aldri av linjer som er lagt til siden den forrige.

Skjermen oppdateres live. Livestrømmen ser på sporene én gang i sekundet mens noen følger med, og sender en `logbook`-hendelse som nevner typene som har noe nytt; skjermen ber da om siden sin på nytt. Den følger tabellene, ikke denne prosessen, så en skriving en agent gjør gjennom `--mcp-stdio`, som er en annen prosess, dukker opp likevel.

## Hvor lenge den beholder

`entity_state_log` er partisjonert per måned, i begge historikkmodusene (det er en vanlig partisjonert PostgreSQL-tabell enten `tag_history` er en hypertabell eller ikke), og en måned slettes helt når hver linje i den er eldre enn `HOTLOOP_LOGBOOK_RETENTION_DAYS`. Standard **90**. Å slette en måned går momentant; å slette radene én etter én gjør ikke det, og derfor er den partisjonert. En linje beholdes altså mellom 90 dager og 90 dager pluss en måned. `0` beholder alt, og Gateway sier det ved oppstart, fordi tabellen da vokser til volumet er fullt.

Loggbokens egen vedlikeholdsjobb gjør dette, én gang ved start og daglig etterpå. Den lager forrige måneds partisjon og de neste tre månedenes på forhånd, så en linje alltid har noe å lande i; en linje for en måned uten partisjon havner i standardpartisjonen, og vedlikeholdet flytter dem til sin måned når det lager den (det som skjer etter en gjenoppretting, se [Sikkerhetskopi og gjenoppretting](/nb/iot/backup/)) eller sletter dem når de er forbi lagringstiden.

De andre sporene beholder det de alltid har beholdt:

| Spor | Beholdt |
|---|---|
| `write_audit` | alt, til noen trimmer det |
| `alarm_events` | alt, til noen trimmer det |
| `automation_runs` | de 500 nyeste kjøringene av hver automatisering |
| `events` | de 100 000 nyeste linjene |

På et travelt anlegg kan altså loggbokens skrivinger og alarmer gå lenger tilbake enn tilstandsendringene, og automatiseringskjøringene og konfigurasjonsendringene mindre langt. Loggboken viser det sporene har.

## Én prosess registrerer

Gateway registrerer. En andre prosess startet med `--mcp-stdio` (en agents hjelper ved siden av Gateway) leser loggboken og baselinjen, så det den sier om `last_changed` stemmer med Gateways, men den skriver ingenting og vedlikeholder ingenting: to opptakere ville logget hver endring to ganger.

Opptakeren er en krok på entitetsmotoren som bare setter i kø. Én gang i sekundet gjør en goroutine det som er i kø om til linjer, bruker hastighetsgrensen og skriver dem med én `COPY` og én upsert av de nyeste tilstandene, i én transaksjon. Køen rommer 50 000 endringer; utover det forkastes de eldste og telles. En database som er nede, holder linjene i kø, opp til samme grense, og de går inn når den er tilbake. `/api/diagnostics` viser alt under `logbook`:

```json
{"recording":true,"retentionDays":90,"queued":0,"dropped":0,"written":212,"suppressed":36,"writeErrors":0}
```

`dropped` over null betyr at endringer mangler i loggboken; `queued` som stadig vokser, betyr at databasen ikke henger med; `lastError` sier hvorfor den siste skrivingen mislyktes.

## Sikkerhetskopier

Begge tabellene er i hver sikkerhetskopi: `entity_last_state` etter entitetstabellene, `entity_state_log` like før `tag_history`. Se [Sikkerhetskopi og gjenoppretting](/nb/iot/backup/).
