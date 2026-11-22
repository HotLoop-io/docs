---
title: "Blueprints for regler"
description: "Skriv en regel én gang med blanke felt og fyll den ut for hver pumpe. Hver regel beholder sin blueprint-versjon, så én endring rører aldri førti regler."
---

Et blueprint er en regel som skrives én gang, med blanke felt i seg. «Når *denne motoren* har gått lenger enn *så lenge*, si fra, og stopp den hvis *jeg ber om det*.» Noen som vet hva regelen skal gjøre, skriver den én gang. Alle andre fyller ut de blanke feltene, per pumpe, per tank, per linje, og får en helt vanlig automasjon ut i den andre enden.

Alternativet er det alle anlegg allerede har: den samme regelen kopiert til førti pumper, og så rettet på trettisyv av dem den dagen noen finner feilen. Kopier glir fra hverandre. Et blueprint og førti sett med inndata gjør ikke det.

Det som kommer ut, er en vanlig regel. Den ligger på Automasjoner-skjermen ved siden av dem som er skrevet for hånd, den armeres av samme motor, og hver skriving den gjør, går gjennom skriveporten som `automation:<id>`, revidert, avslag medregnet. Det finnes ingen blueprint-kjøretid og ingen bakdør. Det er et skjema, og det er en regel.

## Den ene regelen om blueprints

**En regel beholder versjonen av blueprintet den ble laget fra.**

Rediger et blueprint, og versjonen går opp. Ikke én regel laget fra det endres. Regelen på pumpe 7 som var riktig på tirsdag, blir ikke i stillhet en annen regel fordi noen redigerte blueprintet på onsdag og tenkte på pumpe 12, mens det er pumpe 7 som oversvømmer kjelleren.

Å flytte en regel til den nye versjonen er en **oppgradering**, og en oppgradering er noe et menneske ber om:

1. Automasjoner-skjermen sier det på regelen: *Fra blueprint Motor går for lenge, versjon 1*, og *versjon 2 tilgjengelig*.
2. **Se over oppgradering** viser nøyaktig hva som endres, del for del, før og etter, og hva regelen ville gjort hvis den utløstes akkurat nå, med hver skriving lagt fram for portens kontroller. Ingenting er endret ennå.
3. **Oppgrader** legger inn nøyaktig det som ble sett over. Hvis blueprintet har gått videre igjen, eller noen andre har oppgradert regelen i mellomtiden, blir det avvist, og du ser på nytt. Det du så over, er det som kommer inn, ellers kommer ingenting inn.

Det logges med hvem som gjorde det: *automasjon oppgradert fra blueprint pump_watch versjon 1 til 2*.

Hvis noen har redigert regelen for hånd siden den ble laget, viser gjennomgangen den redigeringen som erstattet. Ingens endring forsvinner uten å ha stått på skjermen først.

## Slik ser ett ut

```json
{
  "id": "pump_watch",
  "name": "Pump start watch",
  "description": "Says when a pump starts, with the limit it runs to.",
  "inputs": [
    {"name": "pump", "label": "Pump", "type": "entity", "domain": ["switch"], "required": true},
    {"name": "limit", "label": "Limit", "type": "number", "min": 0, "max": 100, "step": 5, "unit": "%", "required": true}
  ],
  "template": {
    "triggers": [{"type": "state", "entityId": {"!input": "pump"}, "to": "on"}],
    "condition": "float(states['sensor.tank_level']) < ${limit}",
    "actions": [
      {"type": "log_event", "params": {"message": "${pump} started, running to ${limit}%"}}
    ],
    "mode": "skip"
  }
}
```

- **`id`** er små bokstaver, sifre og understreker, og begynner med en bokstav.
- **`inputs`** er de blanke feltene, med type. De samme feltene som ellers i HotLoop: `number` med `min`, `max`, `step` og `unit`, `text` med `max_length` og `pattern`, `boolean`, `select` med `options`, `entity` med `domain`-ene det tar, `duration` (sekunder, eller `90s`, `1h30m`), `alarm` og `tag`. Hvert kan være `required` eller ha en `default`.
- **`template`** er regelen: `description`, `triggers`, `condition`, `actions`, `mode`, `minIntervalSec`, `maxRuntimeSec`, i automasjonsspråket ([Automasjoner](/nb/iot/automations/)). Ikke dens `id`, `name` eller `enabled`. De tilhører hver regel som lages fra det.

### De blanke feltene

**`{"!input": "pump"}`** som verdi byttes ut med verdien til inndataen, med dens type: en entity_id havner i `entityId` som en streng, en varighet havner i `forSec` som et tall. En valgfri inndata ingen har fylt ut, er `null`.

**`${pump}`** inne i en streng byttes også ut, og hvordan avhenger av hvor den står:

- I et uttrykk (en regels `condition`, en handlings `expression`, en verdi i `dataExpressions`, `argExpressions`, `fieldExpressions` eller `paramExpressions`, og alt mellom `{{` og `}}` i en melding) går den inn som en **bokstavelig verdi**. En streng settes i anførselstegn, et tall er et tall, `true`, `false`, `nil`. Så betingelsen over, med grense 40, blir `float(states['sensor.tank_level']) < 40`.
- Overalt ellers er den vanlig tekst: `switch.pump_1 started, running to 40%`.

**`${counter.domain}`** er domenet til en entitet-inndata, for et tjenestenavn som må passe med hvilken type entitet som ble valgt: `"${counter.domain}.reset"` er `counter.reset` for en PLS-teller og `input_counter.reset` for en hjelpeteller.

Den anførselen er hele grunnen til at en tekstinndata er trygg å bruke i et uttrykk. Skriv `' || true || '` i en tekstinndata, og betingelsen sammenlikner med akkurat den strengen, slik den ble skrevet. Den blir aldri en del av uttrykket. Og en tekstinndata kan ikke inneholde `{{` i det hele tatt: hver melding en regel sender, kjører det som står mellom `{{` og `}}` som et uttrykk når den sendes, og en verdi noen har skrevet inn i et skjema, får aldri bli et slikt.

### Kontrollert ved lagring

Et blueprint kontrolleres før det lagres, ikke når noen prøver det:

- hvert blankt felt peker på en inndata, og `.domain` kommer bare etter en entitet-inndata;
- hver inndata brukes et sted. En inndata malen ignorerer, er et skjemafelt som ikke gjør noe, og noen kommer til å miste en ettermiddag på det;
- utfylt med eksempelverdier av hver inndatas type (standardverdien når den har en), lager malen en regel som kompilerer. En tekstinndata som blir en URL, trenger et `pattern` som sier det, `https?://\S+`, ellers avviser URL-kontrollen eksempelet.

## Fylle ut ett

På **Blueprints**-skjermen åpner **Bruk** skjemaet: regelens id og navn, og hver inndata som riktig kontroll, et tall med sitt område, en liste, en entitetsvelger. Så:

- **Sjekk først** svarer med regelen den ville laget og hva den regelen ville gjort hvis den utløstes akkurat nå: betingelsen evaluert, hver skriving og tjenestekall lagt fram for skriveportens egne kontroller som `automation:<id>`, og det første avslaget med portens egne ord. Ingenting lagres, skrives eller revideres.
- **Lag regelen** lager den, armert med mindre du fjerner haken, og den dukker opp på Automasjoner-skjermen med opplysning om hvor den kom fra.

Hver inndata kontrolleres først og **flyttes aldri for å passe**. 150 for en inndata med maksimum 100 avvises, den blir ikke stille satt til 100. `"12"` for et tall avvises, det tolkes ikke. Alle inndata som er feil, rapporteres samtidig, så skjemaet kommer tilbake med hele listen. En verdi regelen selv avviser (en varighet på to dager for en holdetid som høyst kan være én dag) avvises med regelens egne ord. Ingenting lages før alt er riktig.

Å lage en regel **erstatter aldri en**. En id som er tatt, av en regel skrevet for hånd eller laget fra et blueprint, avvises.

Over API-et er det `POST /api/blueprints/{id}/instantiate`, med `?dry_run=true` for kontrollen. Se [HTTP-API-et](/nb/iot/api/#blueprints).

## De innebygde

De følger med i binærfilen. De er skrivebeskyttet; **Kopier** lager en egen under en ny id, fra versjon 1, som du kan endre som du vil.

| Blueprint | Inndata | Hva regelen gjør |
|---|---|---|
| `motor_running_too_long` | en motor, hvor lenge den får gå (standard én time), om den skal stoppes | Når motoren har vært `running` så lenge i ett strekk, logger den en advarsel. Hvis det er bedt om, stopper den motoren med `motor.stop`. |
| `tank_high_level_stop_pump` | en nivåsensor, grensen, pumpen (en motor) | Når nivået er ved eller over grensen, målingens kvalitet er god og pumpen ikke allerede er stoppet, stopper den pumpen og logger det. |
| `alarm_to_notify` | en alarm, tilstanden det skal handles på (standard `unack-active`), en webhook-URL | Når alarmen går til den tilstanden, sender den en POST med `{"text": "Alarm temp-hi is unack-active"}` til URL-en. |
| `device_silent_cycle_its_port` | en enhets nettsensor, hvor lenge den får være stille (standard 5 minutter), UniFi-enheten og tagen for å slå strømmen av og på på porten, hvor lenge det skal ventes etterpå (standard 3 minutter), en alarm, minste mellomrom mellom kjøringer (standard én time) | Når enheten har vært av så lenge, slår den én gang strømmen på bryterens port av og på gjennom skriveporten, venter på at den kommer tilbake, og hvis den ikke har gjort det, utløser den alarmen. Driveren avviser en ny syklus på samme port innen 15 minutter og slår aldri av en port som bærer nettverket. |
| `shift_schedule_counter_reset` | en tidsplanhjelper, en teller (PLS eller hjelper) | Når tidsplanen slår seg på, nullstiller den telleren og logger det. |

Noen ærlige merknader om dem:

- **`tank_high_level_stop_pump` er en bekvemmelighet, ikke en forriglingskrets.** En utkobling som beskytter folk eller anlegget hører hjemme i PLS-en, fastkoblet der den må være, ikke i noe som kjører på et nettverk. Denne sparer noen for å passe på et nivå. Den erstatter ikke høynivåbryteren.
- Den handler ikke på en måling den ikke kan stole på. Et nivå med dårlig kvalitet stopper ingenting, for et stopp basert på et søppeltall er fortsatt et stopp.
- **`shift_schedule_counter_reset` utløses når tidsplanen slår seg på**, og to tidsplanblokker som berører hverandre, er ett sammenhengende strekk med på. Gi derfor hvert skift sin egen blokk med tidsplanen av mellom dem, selv om det bare er ett minutt (06:00 til 13:59, 14:00 til 21:59), ellers nullstiller bare det første skiftet i rekken telleren.
- **`alarm_to_notify`** er for et chatterom eller et saksbehandlingssystem. For å varsle en telefon, med frekvensgrenser, nye forsøk og kvitteringslenker, bruk varslene HotLoop sender selv ([Alarmvarsler](/nb/iot/notifications/)).

## Hvem kan gjøre hva

| <span class="sr-only">Detaljer</span> | leser | operatør | administrator |
|---|---|---|---|
| Se blueprints (`blueprints.read`) | ja | ja | ja |
| Lage en regel fra ett, oppgradere ett (`blueprints.apply`) | nei | ja | ja |
| Skrive, redigere, kopiere, slette ett (`blueprints.write`) | nei | nei | ja |

Hvorfor operatører kan lage regler: blueprintet er stedet der en ingeniør bestemte hva regelen gjør, og å velge hvilken pumpe den overvåker er akkurat den avgjørelsen en operatør tar hele dagen. Den farlige delen, hva regelen styrer, ble bestemt da blueprintet ble skrevet, av noen med `blueprints.write`. Å slette eller redigere regelen for hånd etterpå er fortsatt `automations.write`, administrator.

Å slette et blueprint som en regel er laget fra, avvises, med navn på reglene. Slett dem først. Et innebygd blueprint kan ikke redigeres eller slettes.

## Agenter

En agent får `list_blueprints`, `preview_blueprint` og `instantiate_blueprint` (og `upgrade_blueprint_automation`, `create_blueprint`, `update_blueprint` og `delete_blueprint`): den finner riktig blueprint, finner ut inndataene, viser hva regelen ville gjort og lager den, gjennom samme rute som skjermen bruker, med de samme inndatakontrollene og agentens navn på det i loggboken. En regel er en stående ordre om å styre utstyr hver gang utløseren trigger, så forhåndsvisningen kommer først, og hver skriving regelen gjør etterpå, møter skriveporten. Se [MCP](/nb/iot/mcp/#blueprints).

## Hvor alt havner

- **Blueprints** anlegget har skrevet, ligger i tabellen `blueprints`. De innebygde ligger i binærfilen og lagres aldri.
- **En regel laget fra ett** er en rad i `automations` som alle andre, med `blueprint_id`, `blueprint_version` og `blueprint_inputs` som sier hvor den kom fra. `GET /api/automations` har dem som `blueprintId`, `blueprintVersion` og `blueprintInputs`.
- **Hver endring** står i systemloggen og loggboken, med hvem som gjorde den: *blueprint opprettet*, *blueprint lagret, nå versjon 2*, *automasjon laget fra blueprint motor_running_too_long versjon 1*, *automasjon oppgradert fra blueprint pump_watch versjon 1 til 2*, *blueprint slettet*.
- **Sikkerhetskopier** inneholder både blueprintene og hver regels festede versjon, så et gjenopprettet anlegg tilbyr nøyaktig de oppgraderingene det tilbød før. En sikkerhetskopi fra før blueprints fantes, gjenoppretter hver regel som skrevet for hånd.
- En regel der blueprintet er borte (et innebygd en senere utgave tok bort, for eksempel) fortsetter å kjøre akkurat som den er. Det er bare ingenting å oppgradere den til.
