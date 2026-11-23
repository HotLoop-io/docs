---
title: "Hjelpere"
description: "Verdiene som folkene på anlegget eier, som batchmålet eller hvilket skift som går: brytere, tall, valg, tekst, tellere, tidtakere og tidsplaner."
---

En hjelper er en verdi som folkene på anlegget eier, ikke en PLS. «Linje 2 er i omstilling.» «Dagens batchmål er 1 250 kg.» «B-skiftet går.» «Tolv deler kassert siden forrige nullstilling.» «Spylingen har ni minutter igjen.» Ingenting av dette ligger i et register, og alt er akkurat det regler og skjermer trenger å vite.

HotLoop har sju slags. En hjelper er en entitet som alle andre: den har en `entity_id`, en tilstand, attributter og tjenester, den står i utstyrstreet, den vises i `/api/states`, på skjermen Entiteter, i `list_entities` over MCP og i tilstandsutløseren til en automatisering. Det som er annerledes er hvor verdien bor: HotLoop beholder den, i databasen, og **ingen tjeneste på en hjelper skriver noen gang en tag**.

## De sju

| Domene | Tilstand | Valg | Tjenester |
|---|---|---|---|
| `input_boolean` | `on` / `off` | `initial` (true/false), `restore` | `turn_on`, `turn_off`, `toggle` |
| `input_number` | tallet, `"1250"` | `min`, `max` (begge påkrevd), `step` (standard 1), `mode` (`slider` eller `box`), `initial`, `restore` og en `unit_of_measurement` | `set_value {value}`, `increment`, `decrement` |
| `input_select` | valget | `choices` (påkrevd, opptil 100), `initial`, `restore` | `select_option {option}`, `select_next {cycle}`, `select_previous {cycle}` |
| `input_text` | teksten | `max_length` (standard og tak 255), `pattern`, `initial`, `restore` | `set_value {value}` |
| `input_counter` | et heltall | `initial` (standard 0), `step` (standard 1), `min`, `max`, `restore` | `increment`, `decrement`, `reset`, `set_value {value}` |
| `timer` | `idle` / `active` / `paused` | `duration_sec` (påkrevd, 1 sekund til 7 dager), `restore` | `start {duration}`, `pause`, `cancel`, `finish` |
| `schedule` | `on` / `off` | `schedule` (påkrevd) | ingen: den følger klokka |

Telleren er `input_counter`, ikke `counter`. `counter` er allerede PLS-komposittet der nullstilling skriver en tag, og den forblir akkurat det den er.

Hvert valg sjekkes når hjelperen lagres, og `initial` mot alle de andre: en `input_number` fra 0 til 100 som starter på 150 avvises, den startes ikke på 100. Et valg et domene ikke tar imot, er en feil, ikke en innstilling som stille ignoreres. Hjelpervalgene (`initial`, `restore`, `choices`, `duration_sec`, `mode`, `schedule`) avvises på alle andre domener av samme grunn.

## Å lage en

En administrator lager hjelpere (`entities.write`). På skjermen Entiteter, **Ny hjelper**, ved siden av Nytt utstyr. Over API-et:

```
POST /api/helpers
{"name": "Batch target", "domain": "input_number", "unit_of_measurement": "kg",
 "options": {"min": 0, "max": 5000, "step": 50, "initial": 1000}}
```

`entity_id` lages av navnet (`input_number.batch_target`) hvis du ikke oppgir en. `PUT /api/helpers/{entity_id}` endrer navn, ikon, enhet eller valg; `DELETE /api/helpers/{entity_id}` sletter den og verdien. Hele API-et står i [HTTP-API-et](/nb/iot/api/#hjelpere).

En endring av valg som ville latt hjelperens nåværende verdi havne utenfor dem, avvises: å snevre inn et område forbi verdien, eller å fjerne alternativet som er valgt. Sett verdien først, eller velg valg som inkluderer den. En verdi flyttes aldri for å passe.

## Å sette en

Alle med `helpers.write` setter hjelpere. Operatørene har den: å kjøre skiftvelgeren og telle kassasjon er drift, ikke konfigurasjon. Lesere har den ikke. Den er ikke `values.write`, for en hjelper skriver ingen tag.

Å sette en hjelper er et tjenestekall på en entitet, det samme kallet alle andre entiteter tar imot:

```
POST /api/services/input_counter/increment   {"entity_id": "input_counter.scrap", "reason": "short shot"}
POST /api/services/timer/start               {"entity_id": "timer.purge", "duration": "0:15:00"}
```

Svaret sier hva hjelperen er nå: `{"call_id": "...", "state": "13", "writes": []}`. `?dry_run=true` virker også og svarer med de samme ordene som det ekte kallet ville gjort, uten å endre noe.

På skjermen Entiteter får en hjelper sin egen flis, aldri slått sammen med en annen (den har ingen tagger å slå sammen etter), med kontrollene sine for den som har `helpers.write`. Hver endring bekreftes først, med en begrunnelse, som alle andre kommandoer.

Fra MCP finnes det ikke noe nytt verktøy: `list_entities` finner hjelpere, `get_states` leser dem, `call_service` setter dem. En agent endrer en hjelper bare i en installasjon med `HOTLOOP_ALLOW_WRITES` på, den samme bryteren en skriving til en tag trenger. En hjelper flytter ikke noe utstyr, men det er den reglene handler på, og en agent som snur omstillingsbryteren er en agent som starter det omstillingsregelen gjør.

## Avvist, aldri avkortet

En verdi en hjelper ikke tar imot, avvises, og ingenting endres:

- et tall utenfor `min`..`max`, eller utenfor `step` (talt fra `min`);
- en `increment` som ville gått forbi `max`, en `decrement` som ville gått forbi `min` (avvist, ikke stoppet ved grensen: «stoppet ved grensen» er en verdi ingen har bedt om);
- et valg som ikke er blant de mulige alternativene; `select_next` forbi det siste alternativet med `cycle: false`;
- en tekst som er lengre enn `max_length`, eller som ikke passer med `pattern` (hele teksten må passe);
- en telling som ikke er et heltall, eller som går forbi `min` eller `max` på telleren;
- en tidtaker som settes på pause når den ikke går, avbrytes eller fullføres når den er inaktiv, eller startes for mindre enn ett sekund eller mer enn sju dager;
- en deaktivert hjelper; en som kaller uten `helpers.write`; en agent med MCP-skriving av.

Hvert avslag er en advarsel i systemloggen (`GET /api/events`) mot hjelperen, med hvem som spurte og hvorfor den ble avvist, akkurat som avslaget på en alarmkvittering. En feil i selve forespørselen (et felt tjenesten ikke tar imot, `"50"` der et tall skal stå) er kallerens feil, besvares med 400, og endrer og registrerer ingenting.

## Hvor endringer registreres

Hver endring er én linje i systemloggen mot hjelperen: hvem, fra hva, til hva, kall-id-en, hvor den kom fra og begrunnelsen hvis en ble gitt.

```
otto   input_counter.increment: 12 -> 13; reason: short shot
system timer finished: active -> idle, due at 2026-09-27T21:10:00Z
```

Linjen skrives i samme transaksjon som verdien, så det finnes aldri en endring uten linjen sin eller en linje uten endringen sin.

En tilstandsendring er også en linje i [loggboken](/nb/iot/logbook/), i den samme transaksjonen, med samme hvem, kilde og kall-id. Den skrives av prosessen som gjorde endringen, uansett hvilken det er, så en agents endring gjennom `--mcp-stdio` logges også, og logges én gang. Hjelperlinjer hastighetsbegrenses aldri: hver av dem er noen som bestemmer noe. Et kall som lar tilstanden stå som den var (et tall satt til verdien det allerede har) står i systemloggen, men ikke i loggboken, fordi ingenting endret seg.

## Omstarter

En hjelper beholder verdien sin gjennom en omstart: Gateway kommer tilbake med skiftet fortsatt B og telleren fortsatt 13. Sett `restore: false` på en som skal starte på nytt hver gang (en teller «siden siste omstart»): Gateway setter den tilbake til startverdien når den starter, og sier det i loggen. Bare Gateway selv gjør det. En `--mcp-stdio`-prosess en agent starter ved siden av en Gateway som kjører, har de samme hjelperne og hører hver endring, men nullstiller aldri noe, for å nullstille anleggets verdier fordi en agent koblet til ville vært absurd.

## Tidtakere

En tidtaker går etter veggklokka. Startet for ti minutter blir den ferdig ti minutter senere uansett hva som skjer imens: en omstart som tok to minutter lar den ha åtte igjen. En tidtaker på pause forblir på pause, med tiden den hadde igjen, gjennom et hvilket som helst antall omstarter, og `start` gjenopptar den.

En tidtaker som gikk ut **mens ingen HotLoop kjørte**, settes tilbake til `idle` når HotLoop starter neste gang, med `finished_late_at` satt til når den skulle gå ut, og en advarsel i loggen. **Ingenting utløses for den.** En regel som venter på at tidtakeren skal bli inaktiv, kjører ikke, fordi motorens første blikk på den etter en start er en baseline, ikke en endring. Det den tok tiden på (en spyling, en herding) skjedde for lenge siden eller ikke i det hele tatt, og å gjøre det nå, for sent og uten at noen har bedt om det, er verre enn å si at det ble gått glipp av. Se etter `finished_late_at` og avgjør.

En tidtaker er ikke en forriglingskrets. Den går på klokka til en prosess, gjennom en database og et nettverk, til sekundet og som regel til millisekundet. Alt som må stoppe i tide, hører hjemme i PLS-en.

## Tidsplaner

En tidsplan er på innenfor blokkene sine og av utenfor dem:

```json
{"schedule": {
  "mon": [{"from": "06:00", "to": "14:00", "data": {"crew": "A"}},
          {"from": "14:00", "to": "22:00", "data": {"crew": "B"}}],
  "fri": [{"from": "22:00", "to": "06:00", "data": {"crew": "C"}}]
}}
```

- Dagene er `mon` til `sun`. Et klokkeslett er `HH:MM` eller `HH:MM:SS`; `24:00` er slutten av en dag.
- En blokk der `to` er tidligere enn `from`, går over midnatt: fredagens 22:00 til 06:00 er på til lørdag 06:00.
- Blokker som berører hverandre er én sammenhengende strekning på; blokker som overlapper avvises, fordi det å avgjøre hvilke data som gjelder, ville vært å gjette.
- Mens en blokk er på, ligger `data` i entitetens attributter (`crew: "B"`), og `next_event` sier alltid når tidsplanen endrer seg neste gang.
- Den leses etter veggklokka i lokasjonens tidssone (`HOTLOOP_SITE_TIMEZONE`), fordi et skift som starter klokka 06:00 starter klokka 06:00 også den dagen klokka skifter. Natten klokka stilles fram, er timen som ikke finnes, ikke på; natten den stilles tilbake, er timen som kommer to ganger, på begge gangene.

## Mer enn én prosess

Hver endring varsles med Postgres `NOTIFY`, og hver prosess som holder hjelperne, lytter. En hjelper satt i én prosess viser den nye verdien i alle de andre innen en rundtur, en hjelper opprettet eller slettet i én dukker opp eller forsvinner i de andre, og en endring gjort gjennom `PUT /api/helpers/{entity_id}` plukkes opp på samme måte (en gjort gjennom `PUT /api/entities/{entity_id}` når de andre ved neste registersynk, som for enhver entitet). Hver skriving er betinget av radens revisjon, så to prosesser som teller på samme teller samtidig mister aldri en telling, og en tidtaker begge holder, blir fullført av nøyaktig én av dem.

## Sikkerhetskopier

Hjelpere er med i hver sikkerhetskopi: konfigurasjonen deres sammen med entitetene, og verdiene deres i `helper_state`, revisjoner inkludert. Et gjenopprettet anlegg kommer tilbake med skiftet, målene og tellingene det hadde, og en tidtaker som gikk, går fortsatt etter veggklokka (eller, hvis den gikk ut i mellomtiden, inaktiv og merket som forsinket, som over).

## I automatiseringer

En hjelper er det reglene handler på og setter:

```json
{"triggers": [{"type": "state", "entityId": "input_boolean.changeover", "to": "on"}],
 "actions": [{"type": "call_service", "params": {"entityId": "number.line_2_speed_sp",
   "service": "number.set_value", "data": {"value": 0}}}]}
```

Regelens skriving til taggen går gjennom skriveporten som alle andre, med regelen som aktør. `states['input_select.shift'] == 'B'` virker i en betingelse, og en regel kan sette en hjelper med `call_service` på samme måte som den setter en bryter.
