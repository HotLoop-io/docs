---
title: "Entiteter"
description: "Entitetsregisteret som alle automatiseringer, hjelpere, skript og skjermbilder bygger på: faste id-er, domener, tjenester og API-et som leser dem."
---

Entitetsregisteret og motoren som beregner tilstanden til entitetene er grunnmuren som alle automatiseringer, hjelpere, skript og skjermbilder i HotLoop bygger på.

## Hvorfor entiteter, når vi allerede har tags

En tag er det en driver snakker om: et holderegister, en NodeId, en S7 DB-offset. Den identifiseres med enhet og tag-navn, kan ikke gis nytt navn, og betyr nøyaktig ett punkt på én ledning.

En entitet er det folk og regler snakker om: "temperaturen i sone 1", "kjørebryteren på transportbåndet". Den har et eget, stabilt navn (`sensor.zone_1_temperature`), en type som sier hvordan den vises og hva man kan gjøre med den, og et sett bindinger til taggene den er laget av.

Entiteter pakker inn tags. De erstatter dem ikke, og ingenting ved taggene er endret for å gjøre plass. Det finnes ingen ny verdipipeline og ingen ny historian: tilstanden til en entitet beregnes fra den samme levende cachen som `/api/values`, alarmmotoren og OPC UA-serveren allerede leser. Alle eksisterende tag-endepunkter, tavlen, `/api/write`, MCP-verktøyene og automatiseringsreglene som fantes før entitetene, oppfører seg nøyaktig som de gjorde; entiteter kommer ved siden av dem, ikke i stedet for dem.

## Det du får uten å løfte en finger

Hver tag får automatisk en **lese-entitet**:

| Datatype for tag | Domene for lese-entitet |
|---|---|
| `bool`, `boolean`, `bit`, `coil`, `discrete` | `binary_sensor` |
| alt annet | `sensor` |

Første gang en tag gjøres skrivbar, får den også en **styre-entitet**:

| Datatype for tag | Domene for styre-entitet |
|---|---|
| bool-familien | `switch` |
| int- og float-familiene | `number` |
| `string`, `text`, `char` | `text` |

En styre-entitet fjernes aldri fordi taggen ble avarmert. Skriveporten avviser skriving til en avarmert tag slik den alltid har gjort, og attributtet `armed` på entiteten blir `false`, så et skjermbilde kan gråe ut kontrollen. Å beholde entiteten er hele poenget: en automatisering eller et dashbord som nevner `switch.press_01_pump` skal ikke gå i stykker fordi noen avarmerte pumpen for et skift.

Eksisterende tags får entitetene sine i selve oppgraderingen: migreringen `0005_entities.sql` fyller inn en lese-entitet for hver tag og en styre-entitet for hver tag som allerede er skrivbar, i den samme transaksjonen som oppretter tabellene. Enten har hver tag entiteten sin når den nye versjonen betjener sin første forespørsel, eller så er ingenting endret.

Hver alarmdefinisjon får også en **alarm-entitet**, på samme måte: se [Alarm-entiteter](#alarm-entiteter).

Å styre en styre-entitet (slå på en bryter, sette et tall) er et tjenestekall, og et tjenestekall er tag-skriving gjennom `runtime.Manager.Write` og skriveporten, som all annen skriving. Det finnes ingen annen dør. Se [Tjenester](#tjenester).

Utstyr som er mer enn én tag (en pumpe med startkommando, en gå-kontakt og en feil; en ventil med endebrytere; en PID-sløyfe) er et **sammensatt utstyr** som du bygger med vilje av taggene det består av. Se [Sammensatt utstyr](#sammensatt-utstyr).

## Entitets-id-er

En `entity_id` er `<domain>.<object_id>`: små bokstaver, sifre og understreker, høyst 255 tegn. Den automatiske for en tag er `<domain>.<device>_<tag>`, der begge halvdelene gjøres om til små bokstaver og hver rekke tegn som ikke er en ASCII-bokstav eller et siffer blir én understrek:

| Enhet | Tag | Lese-entitet |
|---|---|---|
| `press-01` | `Zone1_Temp` | `sensor.press_01_zone1_temp` |
| `Line.A-2` | `Motor/Speed.PV` | `sensor.line_a_2_motor_speed_pv` |
| `press-01` | `温度` | `sensor.press_01_tag` |

To tags som ender likt får `_2`, `_3` og så videre, i den rekkefølgen de ble registrert. Et navn som er for langt for 255 tegn kuttes før suffikset, aldri gjennom det.

**En `entity_id` genereres én gang, lagres og genereres aldri på nytt.** Å endre beskrivelsen til en tag, endre datatypen, flytte den til et annet register: ingenting av dette rører entity_id. Det eneste som endrer den er en uttrykkelig omdøping gjennom `PUT /api/entities/{entity_id}`, som er en administratorhandling og havner i systemloggen (kategori `config`, emne den nye id-en, den gamle id-en i meldingen og i detaljene).

En omdøping beholder domenet. Identiteten til en entitet er databasens `id` og `unique_id`, og ingen av dem flytter seg noen gang:

| Entitet | `unique_id` |
|---|---|
| lese-entiteten til en tag | `tag:<device>/<tag>` |
| styre-entiteten til en tag | `tag-control:<device>/<tag>` |
| en alarm-entitet | `alarm:<definition id>` |
| et sammensatt utstyr | `composite:<32 random hex digits>` |

De tre første utledes av det entiteten pakker inn, og det er det som lar en slettet tag eller alarmdefinisjon som kommer tilbake ta over entiteten sin igjen. Et sammensatt utstyr har ikke noe slikt å utlede fra: to like pumper på én PLS er bundet til forskjellige tags, og de samme taggene kan med vilje ligge bak to sammensatte utstyr. Derfor er `unique_id` tilfeldig, laget én gang når utstyret opprettes. Den kan aldri kollidere med noen annen entitets, heller ikke med et sammensatt utstyr som ble slettet og bygd på nytt, som er en ny entitet og skal være det.

## Slettede tags, foreldreløse entiteter og gjenovertakelse

Slett en tag, og entitetene blir **foreldreløse**, ikke slettet: `orphaned_at` settes og tilstanden blir `unavailable`. Hvis samme tag kommer tilbake, gjennom tag-editoren eller en ny import fra nettleseren, finner registeret den foreldreløse entiteten gjennom `unique_id` og tar den over igjen. Entity_id, navn, enhetsklasse, ikon og alle andre tilpasninger kommer tilbake med den.

Det er bevisst. På et anlegg slettes og importeres en tag på nytt mye oftere enn noen mener "glem alt om dette punktet", og en automatisering som nevner `sensor.oven_temperature` skal fortsette å virke gjennom det.

Å slette en hel enhet er noe annet: entitetene går med den, på samme måte som taggene. Det gjelder også et sammensatt utstyr der alle taggene ligger på den enheten. Et sammensatt utstyr som spenner over flere enheter tilhører ingen, og mister bare tilstanden når én av dem forsvinner.

Alarm-entiteter følger alarmdefinisjonene sine etter de samme reglene: slett definisjonen, og entiteten blir foreldreløs; lagre en definisjon med samme id, og den tas over igjen.

Et sammensatt utstyr blir aldri foreldreløst. Det ble bygd med vilje, så det blir stående til noen sletter det; mens en av taggene mangler, er det `unavailable`.

`DELETE /api/entities/{entity_id}` sletter et sammensatt utstyr eller en foreldreløs entitet. Det avviser (409) entiteten til en tag eller alarmdefinisjon som fortsatt har det den pakker inn, og sier hvordan den forsvinner: slett taggen eller definisjonen, deretter den foreldreløse. Å slette en levende ville bare fått neste synkronisering til å legge den tilbake under en ny id, og ødelagt alt som nevner den i mellomtiden. For å ta den bort fra skjermbildene, skjul eller deaktiver den.

## Hvordan registeret holder seg à jour

Registeret henger seg ikke på hvert sted en tag kan endre seg. Det avstemmer: leser hver tag og hver entitet, oppretter det som mangler, gjør foreldreløst det som mistet taggen sin, og tar over igjen det som fikk den tilbake. En avstemming kan ikke gå glipp av en vei som noen legger til neste år, og å kjøre den to ganger er det samme som å kjøre den én gang. Den kjører:

- ved oppstart, som dekker en oppgradering og en gjenoppretting fra sikkerhetskopi;
- etter hver omlasting av runtime, som alle tag- og enhetsendringer allerede utløser;
- synkront i API-håndtererne som endrer tags (`POST /api/tags`, `DELETE /api/tags/...`, `POST /api/devices/{id}/import`, `DELETE /api/devices/{id}`) og alarmdefinisjoner (`POST /api/alarms`, `DELETE /api/alarms/{id}`), slik at en klient som oppretter en tag eller en definisjon og straks spør etter entiteten, finner den.

Registreringen serialiseres på tvers av replikaer med en rådgivende lås i databasen, så to replikaer som importerer den samme enheten ikke kan dele ut samme `_2`. Hver avstemming som endrer noe skriver én linje i systemloggen, ikke én per entitet: en import av fem tusen punkter er én hendelse.

## Tilstand

`GET /api/states/{entity_id}`:

```json
{
  "entity_id": "sensor.press_01_zone1_temp",
  "state": "212.5",
  "attributes": {
    "friendly_name": "Zone1_Temp",
    "unit_of_measurement": "F",
    "device_class": "temperature",
    "source": ["press-01/Zone1_Temp"]
  },
  "quality": "good",
  "last_changed": "2026-09-26T14:02:11.482Z",
  "last_updated": "2026-09-26T14:02:11.482Z",
  "last_reported": "2026-09-26T14:07:40.100Z"
}
```

`state` er verdien gjengitt uten enheten: et tall slik `/api/values` viser det, `on` eller `off` for `binary_sensor` og `switch`, selve teksten for en streng. Enheten er et attributt. En tilstand som noen ganger er `212.5` og noen ganger `212.5 F` er en tilstand ingenting kan sammenligne.

Reglene, i den rekkefølgen de brukes. De er de samme som OPC UA-serveren bruker for statuskodene sine, av samme grunn: **en tilstand er aldri bedre enn beviset for den.**

| Vilkår | `state` | `quality` |
|---|---|---|
| Entiteten er foreldreløs, eller taggen er borte | `unavailable` | `bad` |
| Enheten er deaktivert, slettet, eller forbindelsen er nede | `unavailable` | `bad` |
| Forbindelsen er oppe, ingenting lest ennå i denne økten | `unknown` | `bad` |
| Dårlig avlesning | den **siste gode verdien**, eller `unknown` hvis det aldri har vært en | `bad` |
| God avlesning, men andre punkter på enheten feiler (redusert) | verdien | `uncertain` |
| God avlesning | verdien | `good` |

Regelen om dårlig avlesning betyr mer enn den ser ut til. En driver melder et punkt den ikke kunne lese som en dårlig avlesning av null, og å vise den nullen som tilstand gjør "nivåtransmitteren har sluttet å svare" til "tanken er tom". Entiteten fortsetter å vise den siste verdien man kunne stole på, og sier i `quality` at den ikke lenger kan gå god for den.

Merk forskjellen på at et punkt feiler og at en enhet feiler. En Modbus-enhet der hver blokk feiler, mister økten sin og kobler til på nytt, så entitetene blir `unavailable`. En enhet som svarer for noen punkter og ikke for andre, forblir tilkoblet (redusert), og bare entitetene til de feilende punktene viser `bad`.

**Hvor raskt en død Modbus-enhet viser seg.** En som nekter eller lukker forbindelsen er `unavailable` ved neste polling. En som bare slutter å svare (en utrukket kabel, en hengt PLS, en svitsj som startet på nytt) holder socketen åpen og vurderes etter pollingens tidsavbrudd: entitetene er `unavailable` innen ett polleintervall pluss to ganger enhetens tidsavbrudd, pluss høyst ett sekund for motorens reserveberegning. Vanligvis er det ett tidsavbrudd; to er når enheten dør midt i en polling, fordi forespørselen som allerede ligger på ledningen får hele tidsavbruddet sitt. Frem til da er ingenting nytt lest, så entiteten viser fortsatt siste avlesning slik den var. En hengt enhet som fortsatt tar imot forbindelser kobles til igjen med en gang, så etter det veksler entitetene mellom `unavailable` og `unknown` (tilkoblet, ingenting lest) til den svarer igjen; ingen av dem forveksles noen gang med en verdi. Tidsavbruddet er rattet: en enhet med 20 sekunders tidsavbrudd kan se grei ut i 20 til 40 sekunder etter at den dør, så ikke sett det lengre enn enheten trenger for å svare.

Den tabellen gjelder entiteter for én tag. Et sammensatt utstyr er strengere (en dårlig avlesning beholder aldri siste verdi, se [Hvordan tilstanden til et sammensatt utstyr avgjøres](#hvordan-tilstanden-til-et-sammensatt-utstyr-avgjøres)), og tilstanden til en alarm-entitet er alarmmotorens (se [Alarm-entiteter](#alarm-entiteter)).

### Tidsstempler

- `last_changed` flytter seg bare når `state` endres.
- `last_updated` flytter seg når `state`, `quality` eller et attributt endres.
- `last_reported` er tidsstemplet for avlesningen tilstanden kom fra. Det mangler til det finnes en.

Tilstanden beregnes, den lagres ikke, men loggboken beholder den nyeste tilstanden til hver entitet og når den sist endret seg (`entity_last_state`, se [Loggboken](/nb/iot/logbook/)). Etter en omstart **beholder** en entitet der tilstanden kommer tilbake lik, sin `last_changed`: en pumpe som har gått siden tirsdag sier fortsatt tirsdag. Tilstandene unavailable og unknown som en tag-entitet går gjennom mens enheten kobler til på nytt, teller ikke som en endring. En tilstand som endret seg mens Gateway var nede, får en ny `last_changed` og en linje i loggboken. Numeriske entiteter (sensorer, tall, sløyfer, tellere) og knapper spores ikke, så deres, som `last_updated` for alle entiteter, begynner på nytt fra omstarten.

### Attributter

Hver entitet har `friendly_name` og `source` (tag-nøklene den er bundet til). Deretter, når de gjelder:

| Attributt | Når |
|---|---|
| `unit_of_measurement` | `sensor` og `number`: entitetens egen enhet, eller taggens |
| `device_class`, `state_class`, `icon` | når de er satt på entiteten |
| `armed` | styre-entiteter: om taggen er skrivbar akkurat nå |
| `min`, `max` | `number`: entitetens alternativer, ellers taggens område hvis den har ett |
| `step` | `number`: entitetens alternativ, ellers 1 for en heltalls-tag |
| `max_length`, `pattern` | `text`: entitetens alternativer, med `max_length` som standard 255 |
| `quality_reason` | tag-entiteter, mens avlesningen ikke er god og driveren vet hvorfor: `no field at ENERGY.Power`, `payload is not JSON`. Forsvinner med neste gode avlesning |

### Deaktivert og skjult

En **deaktivert** entitet har ingen tilstand i det hele tatt: den mangler i `/api/states`, og å spørre etter den med id svarer at den er deaktivert i stedet for at den mangler. En **skjult** entitet har tilstanden sin som vanlig; flagget er for skjermbilder som vil holde den utenfor standardvisningene.

### Hvordan motoren kjører

Motoren abonnerer på tag-bussen som `entities` med en kø på 256 grupper, den samme kontrakten med tap som alarm- og automatiseringsmotorene: en treg forbruker mister grupper, den stanser aldri en polling. En gruppe som går tapt her koster høyst ett sekund, fordi motoren også beregner alle entiteter på nytt fra cachen én gang i sekundet. Den takten fanger også opp endringer ingenting varsler om, som at den første pollingen til en enhet kommer inn.

Abonnenter inne i prosessen registrerer seg med `Engine.OnStateChanged`. De kalles på motorens egen goroutine, i den rekkefølgen endringene skjedde, som er det en regel som bryr seg om "fra X til Y" trenger. De må være raske. Motoren venter aldri på dem; hvis de havner mer enn 10 000 endringer etter, kastes de eldste og telles.

`GET /api/diagnostics` rapporterer det under `entities`:

| Felt | Betydning |
|---|---|
| `entities` | hvor mange entiteter som har en tilstand |
| `droppedBatches` | bussgrupper motoren var for treg til å ta imot (også under `bus.droppedPerSubscriber.entities`) |
| `pendingChanges`, `droppedChanges` | køen til kroken for tilstandsendringer. Et voksende etterslep, eller noe som helst tap, betyr at en krok er for treg |

## Enhetsklasser og enheter

En enhetsklasse sier hva en verdi er (`temperature`, `pressure`, `volume_flow_rate`, `running`, `problem`) slik at et skjermbilde kan velge et ikon og en statistikkforbruker vet hva den skal gjøre med den. Hver klasse har de enhetene den vanligvis kommer i. Hele tabellen er `model.DeviceClasses`.

- En enhetsklasse som er ukjent for domenet avvises.
- En enhet som klassen vanligvis ikke har, **lagres, med en advarsel** i svaret. Anlegg merker ting slik anlegg merker ting, og `degF` på en temperatur er ikke verdt å blokkere en lagring for. Vanlig `F` og `C` godtas for temperatur uten advarsel, fordi det er det de fleste PLS-tag-databaser faktisk bruker.
- `state_class` (`measurement`, `total`, `total_increasing`) er bare for sensorer.
- **Det finnes ingen enhetskonvertering.** Enheten er en merkelapp.

## API

Entitets-endepunktene bruker feltnavn i snake_case (`entity_id`, `last_changed`) i stedet for det vanlige camelCase i dette API-et. Det er med vilje: entitets-API-et finnes for at alt som allerede forstår den formen, skal forstå også denne.

| Endepunkt | Tillatelse | Hva |
|---|---|---|
| `GET /api/entities` | `entities.read` | Alle entiteter, foreldreløse medregnet. Filtre: `?domain=`, `?device=`, `?orphaned=true\|false` |
| `GET /api/entities/{entity_id}` | `entities.read` | `{"entity": ..., "state": ...}`; `state` er null for en deaktivert entitet |
| `GET /api/entities/{entity_id}/image` | `entities.read` | det nyeste bildet fra et kamera eller et bilde |
| `PUT /api/entities/{entity_id}` | `entities.write` | Endrer registerfelt, også en omdøping. Svarer `{"entity": ..., "warnings": [...]}` |
| `POST /api/entities` | `entities.write` | Oppretter et sammensatt utstyr. Svarer 201 `{"entity": ..., "warnings": [...]}`. Se [Sammensatt utstyr](#sammensatt-utstyr) |
| `DELETE /api/entities/{entity_id}` | `entities.write` | Sletter et sammensatt utstyr eller en foreldreløs entitet. Alt annet er 409 |
| `GET /api/states` | `entities.read` | Tilstanden til hver aktivert entitet, sortert etter entity_id. Filter: `?domain=` |
| `GET /api/states/{entity_id}` | `entities.read` | Én tilstand |
| `POST /api/services/{domain}/{service}` | `values.write` (`alarms.ack` for `alarm`) | Kaller en tjeneste på én entitet. Se [Tjenester](#tjenester). `?dry_run=true` spør hva den ville gjort i stedet for å gjøre det; se [Spørre først](#spørre-først-prøvekjøringen) |
| `GET /api/writes?entity={entity_id}` | `values.read` | Hver skriving tjenestekall har gjort eller fått avvist på én entitet, nyeste først |

Hver rolle har `entities.read`: tilstanden til en entitet er verdien til en tag under et annet navn, som en leser allerede kan lese. Bare administrator har `entities.write`: entity_id er navnet hver automatisering, dashbord og agent viser til entiteten med, og å endre det er konfigurasjon, ikke drift.

En `PUT`-body endrer bare feltene den nevner. Ukjente felt avvises, og det samme gjelder identitetsfeltene (`unique_id`, `domain`, `platform`, enheten og bindingene):

```json
{
  "entity_id": "sensor.zone_1_temperature",
  "name": "Zone 1 temperature",
  "device_class": "temperature",
  "state_class": "measurement",
  "unit_of_measurement": "°F",
  "icon": "mdi:thermometer",
  "entity_category": "",
  "options": {},
  "disabled": false,
  "hidden": false
}
```

`options` tar `min`, `max` og `step` på en `number` (de snevrer inn det et skjermbilde tilbyr; skriveporten sjekker likevel taggens eget område) og `max_length` og `pattern` på en `text`. Alternativene til et sammensatt utstyr er dets egne (se hvert domene nedenfor), og en `PUT` som endrer dem sjekkes mot taggene nøyaktig som opprettingen. `sensor`, `binary_sensor`, `switch` og `alarm` tar ingen.

En entitet har også en plass i utstyrstreet og et sett etiketter: `equipment_id` (null for å følge enheten sin), den skrivebeskyttede `area_id` som klienter grupperer etter, og `labels`. `PUT` tar `equipment_id` og `labels` som alle andre felt. Se [utstyrstreet og etikettene](/nb/iot/equipment/).

## Tjenester

En tjeneste er det man kan gjøre med en entitet: `switch.turn_on`, `number.set_value`. Den navngir det du vil ha gjort med entiteten, og under er den ikke noe annet enn tag-skriving.

```
POST /api/services/switch/turn_on
{"entity_id": "switch.press_01_pump", "reason": "start of shift"}

POST /api/services/number/set_value
{"entity_id": "number.press_01_zone1_sp", "value": 212.5}
```

Body er `entity_id`, en valgfri `reason` og tjenestedataene. Én entitet per kall, aldri en liste, fordi svaret på "hva gikk ut" skal handle om én entitet.

### Hva hvert domene tar

| Tjeneste | Data | Skriver |
|---|---|---|
| `switch.turn_on`, `switch.turn_off` | ingen | `true` eller `false` til kommando-taggen |
| `switch.toggle` | ingen | det motsatte av nåværende tilstand, lest fra den levende cachen etter de samme reglene som selve tilstanden. Hvis tilstanden er `unknown`, `unavailable` eller av dårlig kvalitet, avvises kallet: å bytte noe man ikke vet tilstanden til er å gjette hvilken vei man skal flytte det. Si `turn_on` eller `turn_off` |
| `number.set_value` | `value`, et tall | verdien, til kommando-taggen |
| `text.set_value` | `value`, en streng | strengen, til kommando-taggen |
| `select.select_option` | `option` | alternativets råverdi, til kommando-taggen |
| `button.press` | ingen | `press_value`, så, `pulse_ms` senere, `release_value`, til kommando-taggen; en `single_shot`-knapp skriver `press_value` én gang og ingenting etterpå |
| `motor.start`, `motor.stop` | ingen | `true` eller `false` til `run_command` |
| `motor.reset` | ingen | en puls på `reset_command`: `true`, så, `pulse_ms` senere, `false` |
| `motor.set_speed` | `value`, et tall | verdien, til `speed_command` |
| `valve.open`, `valve.close` | ingen | `true` eller `false` til `command`; på en modulerende ventil 100 eller 0 til `position_command` |
| `valve.stop` | ingen | en puls på `stop_command`; en `single_shot`-ventil skriver `true` én gang |
| `valve.set_position` | `position`, 0 til 100 | posisjonen, til `position_command` |
| `loop.set_setpoint` | `value`, et tall | verdien, til `setpoint` |
| `loop.set_mode` | `mode`: `auto`, `manual` eller `cascade` | modusens råverdi, til `mode` |
| `loop.set_output` | `value`, et tall | verdien, til `output`, **bare mens sløyfen leser manuell** |
| `counter.reset` | ingen | 0 til en numerisk `reset_command`, eller en puls på en bool |
| `alarm.acknowledge` | `note`, valgfri | ingen tag: alarmmotorens kvittering |
| `alarm.shelve` | `minutes`, 1 til 1440 | ingen tag: alarmmotorens utsettelse |
| `alarm.unshelve` | ingen | ingen tag: alarmmotorens oppheving av utsettelse, bare på en utsatt alarm |
| `script.turn_on` | skriptets felt | ingen tag direkte: kjører [skriptet](/nb/iot/scripts/), hvis trinn skriver gjennom porten som `script:<id>` |
| `script.turn_off` | ingen | ingen tag: stopper alle kjøringer av skriptet |
| `scene.turn_on` | `params`, oppskriftens parametere, og `version`, begge valgfrie | ingen tag direkte: bruker [oppskriften](/nb/iot/recipes/), hvis mål skriver gjennom porten under én kall-id |
| `light.turn_on` | `brightness`, 0 til 100, valgfri | `true` til `command`, så lysstyrken til `brightness_command` |
| `light.turn_off` | ingen | `false` til `command` |
| `light.toggle` | ingen | det motsatte av det lysets tilstandstilbakemelding sier; avvises når den ikke kan leses |
| `cover.open`, `cover.close`, `cover.stop` | ingen | `open`, `close` eller `stop` til `command` |
| `cover.set_position` | `position`, 0 til 100 | posisjonen, til `position_command` |
| `lock.lock`, `lock.unlock`, `lock.open` | ingen | `lock`, `unlock` eller `open` til `state` |
| `fan.turn_on` | `percentage`, `preset_mode`, begge valgfrie | `true` til `state`, så hver av dem som er oppgitt |
| `fan.turn_off`, `fan.toggle` | ingen | `false`, eller det motsatte av det tilbakemeldingen sier, til `state` |
| `fan.set_percentage` | `percentage`, 0 til 100 | til `percentage` |
| `fan.set_preset_mode`, `fan.set_direction` | `preset_mode`, `direction` | til `preset_mode`, `direction` |
| `fan.oscillate` | `oscillating`, true eller false | til `oscillating` |
| `siren.turn_on`, `siren.turn_off`, `siren.toggle` | ingen | som en bryter, til `state` |
| `notify.send_message` | `message` | meldingen, til `message` |

En sammensatt tjeneste der rollen ikke er bundet (`set_speed` på en motor uten `speed_command`) avvises før noe planlegges, som en ukjent tjeneste.

`sensor` og `binary_sensor` er skrivebeskyttede og tar ingen tjenester. Tjenestedata med et felt tjenesten ikke tar, avvises, på samme måte som et feilstavet felt i en hvilken som helst annen body: et kall som stille går videre uten feltet du mente, er verre enn et som sier nei.

Et tall som er et heltall kommer til en heltalls-tag som heltall: `42.0` er `42`.

### Hvert kall går gjennom skriveporten

Et tjenestekall blir en ordnet liste av skrivinger, og hver av dem går gjennom `runtime.Manager.Write`. Så alt porten krever av en skriving til en tag, krever den av et tjenestekall, i samme rekkefølge:

1. skriving aktivert (`safety.allowWrites`), og for en agent, agent-skriving aktivert;
2. taggen armert (`writable`);
3. verdien innenfor taggens område, avvist, aldri avkortet;
4. deretter det bare entiteten vet, sjekket inne i porten mot entiteten og taggen slik de er i det øyeblikket:
   - entiteten er ikke deaktivert (å styre noe som ikke har tilstand er ikke tillatt);
   - en `number`s egne `min` og `max`, som bare kan snevre inn taggens område;
   - en `number`s `step`, talt fra minimum (sitt eget, ellers minimum for taggens område, ellers null). En heltalls-tag har steg 1 med mindre entiteten sier noe annet, så `1.5` til et holderegister avvises i stedet for at en driver stille kutter det til `1`;
   - en `text`s `max_length` (tegn, 255 når den ikke er satt) og `pattern`, som hele verdien må passe til;
   - et `select`-alternativ eller en sløyfemodus som ikke er entitetens. Det sendes til porten som alternativet eller modusen det ble bedt om, og avvises der, så den som prøver alternativer som ikke finnes, står på protokollen;
   - en ventilposisjon utenfor 0 til 100;
   - en sløyfes `set_output` mens modus-taggen, lest fra den levende cachen i det øyeblikket, er alt annet enn manuell (auto, cascade, en verdi som ikke er noen av modusene, eller ulesbar).

Hver avvisning, på hvilket som helst av disse trinnene, **revideres**: en `write_audit`-rad med entiteten, tjenesten og kall-id-en, `succeeded` false og årsaken som begynner med `refused:`. Det gjelder også en bruker uten `values.write`. API-et svarer ikke bare 403 og glemmer det: det sender kallet til porten merket som nektet, porten avviser det før noe er skrevet, og avvisningen står i entitetens historikk med verdien det ble bedt om.

Det matcher formen på en enhetsskriving, ikke et navn, så en omgåelse gjennom en ny innpakning eller et grensesnitt deklarert på stedet fanges også.

### Hva et kall svarer

```json
{
  "call_id": "9f2c4e1a7b3d5c60",
  "entity_id": "switch.press_01_pump",
  "service": "switch.turn_on",
  "writes": [
    {"tag": "press-01/pump", "value": "true", "status": "written"}
  ]
}
```

Hver skriving har en status:

| Status | Betydning |
|---|---|
| `written` | enheten godtok den |
| `not_sent` | porten avviste den før den nådde enheten: en avvisning, ingen økt, en revisjonsrad som ikke kunne åpnes |
| `failed` | den gikk ut og enheten eller forbindelsen meldte en feil. Det er ikke kjent om den virket |
| `skipped` | aldri forsøkt, fordi en tidligere skriving i samme kall ikke lyktes |

Et mislykket kall svarer med feilens statuskode (403 avvist av policy eller tillatelse, 422 en verdi avvist, 409 en veksling uten kjent tilstand eller utstyr i feil tilstand for tjenesten, 503 enheten ikke tilkoblet, 502 enheten tok imot skrivingen og meldte en feil, 404 ingen slik entitet, 400 et misdannet kall, 500 et trykk der slippet ikke gikk gjennom, eller en feil inne i Gateway, hvis `error` bare er en referanse til serverloggen) og samme body med `error` lagt til.

Skrivingene i ett kall går ut i rekkefølge, den første som ikke lykkes avslutter kallet, og **ingenting som allerede er skrevet blir rullet tilbake**. Å angre er selv en skriving, gjort uten at noen ba om det, til utstyr som allerede har beveget seg. Å avgjøre det er operatørens jobb, og svaret forteller nøyaktig hvor kallet stoppet. Alle skrivinger i ett kall deler `call_id`, i revisjonssporet og i svaret.

Det finnes ett unntak, og det er den korte kommandoen: et knappetrykk, en motor-reset, en ventil-stopp, en teller-reset på en bit. Det er to skrivinger, trykket og, pulse_ms senere, slippet, og slippet hopper man ikke lett over, for å hoppe over det etterlater en trykknapp holdt inne. Derfor:

- Slippet sendes likevel når trykket gikk ut og meldte en feil (`failed`): det kan ha virket. Det hoppes bare over når trykket var `not_sent`, for da holdes ingenting.
- Slippet sendes selv om den som ringer legger på under pulsen. Kallet fortsetter uten ham.
- Hvis trykket ble skrevet og slippet ble avvist eller feilet, feiler kallet med en 500 og sier det: taggen **kan fortsatt holde trykkverdien**, sjekk den og slipp den for hånd. Avvisningen eller feilen på slippet står i revisjonssporet under samme kall-id, og kallet loggføres under entiteten med alvorlighet feil, ikke advarsel.

En puls er `pulse_ms` lang, 500 som standard, høyst 10 000. Kallet svarer når slippet er gjort, så den som kaller venter på pulsen.

Hvert kall er også én linje i systemloggen, under entity_id, kategori `write`, med årsaken og, i detaljene, kall-id-en, kilden og hver skriving med status. De enkelte tag-skrivingene beholder sine egne linjer under taggene sine, som de alltid har gjort.

`GET /api/writes?entity=switch.press_01_pump` er revisjonssporet til den entiteten, avvisninger medregnet, nyeste først. Radene har `entityId`, `service` og `callId`; en skriving rett til en tag utelater dem, så hver eksisterende leser av `/api/writes` ser nøyaktig det den så før. Migreringen `0007_service_audit.sql` legger til de tre kolonnene, tomme for hver eksisterende rad.

### Spørre først: prøvekjøringen

`POST /api/services/{domain}/{service}?dry_run=true` spør porten hva den ville gjort med et kall, og gjør ingenting av det. Samme body, samme tillatelse.

```json
{"dry_run":true,"entity_id":"number.press_01_zone1_sp","service":"number.set_value","writes":[{"tag":"press-01/zone1_sp","value":"212.5","status":"would_write"}]}
```

```json
{"dry_run":true,"error":"press-01/zone1_sp: this tag is not marked writable","entity_id":"number.press_01_zone1_sp","service":"number.set_value","writes":[{"tag":"press-01/zone1_sp","value":"212.5","status":"not_sent","error":"press-01/zone1_sp: this tag is not marked writable"}]}
```

Kallet planlegges nøyaktig som det virkelige, og hver skriving det ville gjort legges fram for portens egne kontroller, i samme rekkefølge, mot taggene, entiteten og enheten slik de er akkurat nå: skriving på, agentbryteren, taggen armert, området, alt bare entiteten vet (steg, mønster, en sløyfe i manuell, en deaktivert entitet) og en økt til enheten. Den første skrivingen som ville blitt avvist er `not_sent` med årsaken, resten `skipped`, og `error` er feilen det virkelige kallet ville feilet med, **ord for ord**. En skriving som ville gått ut er `would_write`. Det er én funksjon i porten (`precheck`) som svarer på begge, så en prøvekjøring kan ikke slippe gjennom kontroller den virkelige skrivingen gjør. En `alarm`-entitet skriver ingen tag, så prøvekjøringen gjør alarmkontrollene i stedet (motoren kjører, definisjonen finnes fortsatt, entiteten er aktivert, bare en utsatt alarm kan få utsettelsen opphevet) og svarer uten skrivinger; alarmen røres ikke og alarmsporet får ingenting.

Det er et spørsmål, så en dom, avvist eller ikke, svarer 200. En forespørsel som det virkelige kallet ville avvist før noen kontroll (ingen slik entitet, en tjeneste domenet ikke tar, data det ikke godtar, en veksling uten kjent tilstand, feil domene i stien) svarer med samme status og samme feil som det virkelige kallet. En bruker uten tillatelsen får samme 403.

En prøvekjøring skriver ingenting, åpner ingen revisjonsrad, setter ingenting i systemloggen og bruker ingen kall-id: ingenting ble forsøkt, så det er ingenting å gjøre rede for.

Den sier hva som ville skjedd **akkurat nå**. Mellom prøvekjøringen og det virkelige kallet kan enheten falle ut og noen kan avarmere taggen; det virkelige kallet sjekkes på nytt, i sin helhet, i øyeblikket for skrivingen. Ett tilfelle besvares mer nøyaktig enn det virkelige kallets egne kontroller: en enhet hvis økt har falt ut mens arbeideren kobler til på nytt. Den virkelige skrivingen kommer helt til driveren og feiler der (`failed`, 503 og en revisjonsrad for forsøket); prøvekjøringen sier `not_sent` med en gang, med samme feil.

Kommandoprompten i skjermbildet Entiteter og i entitetsskuffen bruker den: når prompten åpnes og mens en verdi tastes inn, spør den, og en avvisning vises i prompten, med portens ord, før noen trykker bekreft. Det er et råd, ikke en lås: bekreft går fortsatt til porten, som avgjør på nytt.

## Sammensatt utstyr

En tag svarer til én entitet. En pumpe svarer ikke til én tag: den har en startkommando, en gå-kontakt, en feil, en reset og kanskje en hastighet, og operatøren tenker på den som én ting. Et sammensatt utstyr er den ene tingen, bundet til hver av taggene sine i en navngitt **rolle**.

En administrator bygger ett med `POST /api/entities`:

```json
{
  "domain": "motor",
  "name": "Infeed pump",
  "device_class": "pump",
  "options": {"pulse_ms": 500},
  "bindings": [
    {"role": "running",       "device_id": "press-01", "tag_name": "P101_Running"},
    {"role": "run_command",   "device_id": "press-01", "tag_name": "P101_RunCmd"},
    {"role": "fault",         "device_id": "press-01", "tag_name": "P101_Fault"},
    {"role": "reset_command", "device_id": "press-01", "tag_name": "P101_Reset"}
  ]
}
```

`entity_id` er valgfri. Utelat den, og det lages en fra navnet (`motor.infeed_pump`, så `_2` og så videre). Oppgi den, og den brukes nøyaktig, og en som er tatt er en 409, ikke en stille `_2`: du ba om det navnet. `name`, `device_class`, `unit_of_measurement`, `icon`, `entity_category` og `options` er de samme registerfeltene som hver entitet har. Plasser det i utstyrstreet og merk det med `PUT` etterpå.

Opprettingen sjekker alt den kan mot taggene slik de er nå, og avviser (400, med beskjed om hva som må rettes) alt som ikke stemmer:

- domenet er ett av `select`, `button`, `motor`, `valve`, `loop`, `counter`, `weather` (`GET /api/entities/composites` sier hvilke, og rollene til hvert). Tag-domenene lages for deg av tags, og `alarm` av alarmdefinisjoner;
- hver påkrevd rolle er bundet, og ingen rolle som domenet ikke har;
- **hver bundet tag finnes**;
- **hver tags type passer til rollen**: en motors `running` er en bool, en ventils `position` er et tall, en tellers tellerverdi er et heltall;
- **hver tag en tjeneste skriver til er allerede armert** (`writable`). Et sammensatt utstyr armerer aldri noe. Å armere et punkt forblir en beslutning noen tar om taggen, én om gangen, slik det alltid har vært;
- hver råverdi i alternativene (verdien til et select-alternativ, trykk- og slippverdiene til en knapp, modusene til en sløyfe) er en taggen kan ta. `1.5` avvises nå for et heltallsregister, ikke når noen trykker på knappen.

Et sammensatt utstyr går med enheten sin når alle taggene ligger på én enhet, og tilhører ingen når de spenner over flere. Bindingene er faste: et annet sett tags er en annen entitet, så slett det og bygg et nytt.

Hver opprettelse og sletting er én linje i systemloggen under entity_id, kategori `config`, med bindingene.

### Roller

| Domene | Rolle | Tag-type | <span class="sr-only">Detaljer</span> |
|---|---|---|---|
| `select` | `state` | hvilken som helst | påkrevd. Tilbakemelding: leses tilbake for å finne alternativet |
| | `command` | hvilken som helst | påkrevd, armert. Skrives med alternativets råverdi. Kan være samme tag som `state` |
| `button` | `command` | hvilken som helst | påkrevd, armert. Pulses |
| `motor` | `running` | bool | påkrevd. Tilbakemelding: gå-kontakten |
| | `run_command` | bool | påkrevd, armert. `start` skriver true, `stop` false |
| | `fault` | bool | tilbakemelding |
| | `reset_command` | bool | armert. Pulses av `reset` |
| | `speed` | tall | tilbakemelding, attributtet `speed` |
| | `speed_command` | tall | armert. Skrives av `set_speed` |
| `valve` | `state` | hvilken som helst | tilbakemelding: hvor en ventil som har meldt seg selv sier med ord at den er |
| | `opened`, `closed` | bool | tilbakemelding: endebryterne |
| | `position` | tall | tilbakemelding, 0 til 100 prosent |
| | `fault` | bool | tilbakemelding |
| | `command` | bool | armert. En av/på-ventil: `open` skriver true, `close` false |
| | `position_command` | tall | armert. En modulerende ventil: `set_position`, og `open`/`close` som 100/0 |
| | `stop_command` | bool | armert. Pulses av `stop` |
| `loop` | `pv` | tall | påkrevd. Tilstanden |
| | `setpoint` | tall | påkrevd, armert. Leses for attributtet, skrives av `set_setpoint` |
| | `output` | tall | påkrevd, armert. Leses for attributtet, skrives av `set_output` |
| | `mode` | hvilken som helst | påkrevd, armert. Leses for å kjenne modusen, skrives av `set_mode` |
| `counter` | `state` | heltall | påkrevd. Tellerverdien |
| | `reset_command` | bool eller tall | armert. Pulses hvis bool, skrives med 0 hvis tall (kan være selve tellerregisteret) |
| `weather` | `temperature` | tall | påkrevd. Tilstanden |
| | `humidity`, `pressure`, `wind_speed`, `wind_gust`, `wind_bearing`, `rain_rate`, `rain_today`, `solar_radiation`, `uv_index` | tall | tilbakemelding, hver et attributt. Ingen er armert: en stasjon leses, den styres aldri |

En ventil trenger minst ett av `state`, `opened`, `closed` og `position` (noe må si hvor den er) og nøyaktig ett av `command` og `position_command`. Begge samtidig ville vært to svar på "hvor er den bedt om å gå", og tilstanden mellom endestillingene avhenger av det svaret. Hvis PLS-en virkelig har begge, lag to entiteter.

### Alternativer

| Alternativ | Domene | <span class="sr-only">Detaljer</span> |
|---|---|---|
| `select_options` | `select` | påkrevd: `[{"option": "low", "value": 1}, ...]`, i den rekkefølgen et skjermbilde tilbyr dem. Unike navn, unike verdier (to alternativer med samme verdi ville gjort tilstanden til en gjetning), hver verdi et tall, en bool eller en streng |
| `press_value`, `release_value` | `button` | sammen eller ikke i det hele tatt. Utelatt på en bool-tag er de `true` og `false`, skrevet inn i alternativene så det knappen gjør står på protokollen. Alle andre tag-typer trenger begge |
| `pulse_ms` | `button`, `motor`, `valve`, `counter` | hvor lenge en kort kommando holdes. 1 til 10 000, 500 når den ikke er satt |
| `single_shot` | `button`, `valve` | `true` skriver `press_value` én gang og slipper aldri: trykket er hele kommandoen. En oppdaget MQTT-knapp er en, fordi dens "slipp" ville vært en andre kommando enheten aldri ba om. Tar `press_value` og ikke `release_value` eller `pulse_ms`. På en ventil skriver dens `stop` `true` én gang i stedet for en puls: stoppen til en oppdaget ventil er en kommando for seg |
| `event_types` | `event` | hendelsestypene den kan utløse, når den sier det |
| `role_choices` | `lock`, `fan`, `siren`, `notify`, `update`, `device_tracker`, `climate`, `humidifier`, `water_heater` | ordene hver styrte rolle tilbyr, per rolle, 1 til 64 forskjellige hver: modusene til en termostat. Oppdagelsen setter den fra konfigurasjonen |
| `modes` | `loop` | påkrevd: råverdien til modus-taggen for hver modus, minst `{"auto": 1, "manual": 0}`, `cascade` hvis regulatoren har den |

### Hvordan tilstanden til et sammensatt utstyr avgjøres

Tilstanden til et sammensatt utstyr kommer fra **tilbakemeldingen** dets. Den beregnes aldri ut fra at HotLoop sendte en kommando. En motor som er bedt om å starte og der gå-kontakten ikke har sluttet seg, går ikke, den starter, og hvis kontakten aldri sluttes, blir den stående i start til noen ser etter. Tilbakelesingen av en kommando-tag teller som tilbakemelding: det er PLS-en som sier hva den holder, ikke HotLoop som husker hva det skrev.

Et sammensatt utstyr er **aldri optimistisk**. En enkelt sensor viser fortsatt siste gode verdi gjennom en dårlig avlesning; et sammensatt utstyr gjør ikke det. Hver tilbakemeldingsrolle som avgjør tilstanden må ha en god avlesning, ellers:

| Vilkår | `state` | `quality` |
|---|---|---|
| en avgjørende tag er borte, eller enheten er nede | `unavailable` | `bad` |
| en avgjørende tag har ingen avlesning ennå, eller en dårlig | `unknown` | `bad` |
| alle avgjørende tags gode, én av dem usikker eller på en redusert enhet | tilstanden | `uncertain` |
| alle avgjørende tags gode | tilstanden | `good` |

En motor der feilinngangen har sluttet å svare er `unknown`, ikke den `running` den var for et sekund siden. Hvilke roller som avgjør står nedenfor; de andre fyller bare attributter, og en ulesbar utelates rett og slett.

Attributtet `armed` på et sammensatt utstyr er bare true når hver tag en av tjenestene skriver til, er armert akkurat nå. En motor som kan startes men ikke stoppes herfra er ikke en et skjermbilde bør tilby.

### `motor`

Avgjørende roller: `running`, og `fault` hvis bundet. Tilstand, den første regelen som passer:

1. `fault` på: **`fault`**, uansett hva annet som er sant. Gang og feil samtidig er motstridende, og det som trenger et menneske er feilen; attributtet `running` sier fortsatt at den går rundt.
2. går, og kjørekommandoen leses tilbake av: **`stopping`**.
3. går: **`running`**.
4. går ikke, og kjørekommandoen leses tilbake på: **`starting`**.
5. ellers: **`stopped`**.

Hvis tilbakelesingen av kjørekommandoen er ulesbar, avgjør den ingenting: motoren er da `running` eller `stopped` bare etter kontakten sin. HotLoop setter ikke tidsavbrudd på en start som ikke kommer i gang: det er en startfeil, og den hører hjemme i PLS-en eller i en alarmdefinisjon på gå-kontakten.

Attributter: `running`, `fault` (hvis bundet), `command` (tilbakelesingen), `speed` (hvis bundet og lesbar), `device_class` (`pump`, `fan`, `conveyor`, `compressor`, `agitator`).

### `valve`

En ventil som har meldt seg selv (MQTT-oppdagelse) sier med ord hvor den er på rollen `state`: `open`, `closed`, `opening`, `closing` eller `stopped`, og det er tilstanden dens, med `current_position` fra `position` når den melder en. Et ord som ikke er noen av disse er `unknown`, med det den sa i `raw_value`. Resten av dette avsnittet gjelder en ventil bygd av PLS-tags.

Avgjørende roller: hver bundet av `opened`, `closed`, `position`, `fault`. Tilstand, den første regelen som passer:

1. `fault` på: **`fault`**.
2. begge endebryterne slått: **`fault`**, med `limit_conflict: true`. En ventil kan ikke være åpen og lukket, så en bryter lyver, og hvilken er ikke noe man skal gjette.
3. åpen-endebryter slått: **`open`**. Lukket-endebryter slått: **`closed`**.
4. ingen endebrytere, bare en posisjon: ved 1 % eller lavere **`closed`**, ved 99 % eller høyere **`open`**.
5. mellom endene, i bevegelse eller stoppet etter det den er kommandert til: en posisjonskommando som leses tilbake mer enn 1 % over posisjonen er **`opening`**, mer enn 1 % under **`closing`**, innenfor 1 % **`stopped`**; en av/på-kommando som leses tilbake på er **`opening`**, av er **`closing`**; uten noe å gå etter, **`stopped`**.

En av/på-ventil som står stille mellom endestillingene mens den fortsatt er kommandert åpen, leses som `opening`. Hvis du trenger å se den stoppet der, bind `position`.

`current_position` er posisjonstilbakemeldingen når den er bundet, ellers 100 på åpen-endebryteren og 0 på lukket-endebryteren, og fraværende mellom dem. Andre attributter: `open_limit`, `closed_limit`, `fault`, `device_class` (`water`, `gas`, `steam`, `air`).

### `loop`

Tilstanden er prosessvariabelen, gjengitt som en sensors, fra `pv` alene. Attributtene er `setpoint` og `output` (til stede når de kan leses), `mode` (navnet på modusen modus-taggen leser, eller `unknown` når den ikke kan leses eller har en verdi som ikke er noen av modusene), `modes` (de konfigurerte navnene) og `unit_of_measurement` (entitetens, ellers PV-taggens). En sløyfe tar sensorenes enhetsklasser: en temperatursløyfe, en trykksløyfe.

`set_output` avvises inne i porten med mindre sløyfen leser manuell **i øyeblikket for skrivingen**. En utgang skrevet til en sløyfe i auto slåss mot regulatoren, og i cascade mot to. En modus som ikke kan leses er ikke manuell. Avvisningen er en `write_audit`-rad som alle andre, med entiteten, tjenesten, kall-id-en og verdien det ble bedt om, og kallet svarer 409. Sett sløyfen i manuell med `set_mode` først.

### `counter`

Tilstanden er tellerverdien, en heltalls-tag. `reset` skriver 0 til en numerisk `reset_command` (bind selve tellerregisteret hvis det er slik PLS-en nullstiller det) eller pulser en bool. En teller uten `reset_command` er skrivebeskyttet. `unit_of_measurement` er entitetens, ellers taggens.

### `weather`

En takstasjon som én entitet: se [Vær og værstasjon](/nb/iot/weather/). Tilstanden er temperaturen; hver annen avlesning er et attributt, bare til stede når sensoren kan leses, med duggpunkt, varmeindeks og vindkjøling regnet ut fra dem. En avlesning som er bundet og ikke kan leses nevnes i `unavailable`, aldri vist som null. Den tar ingen tjeneste.

### `select`

Tilstanden er alternativet hvis råverdi `state`-taggen leser. En verdi som ikke er noen av alternativene er `unknown`, med råverdien i `raw_value`, i stedet for det nærmeste alternativet eller det siste. Attributtet `options` lister alternativenes navn i rekkefølge. Et alternativ som ikke er selectens avvises i porten og revideres med alternativet det ble bedt om.

### `button`

En knapp har ingen tilbakemelding. Tilstanden er tidspunktet for siste trykk gjennom denne Gateway, eller `unknown` hvis den ikke er trykket siden Gateway startet. Den er `unavailable` når kommando-taggen er borte eller enheten er nede, fordi det da ikke kan virke å trykke på den. Det siste trykket holdes i minnet, så det nullstilles ved omstart; revisjonssporet har hvert trykk uansett, og det er også grunnen til at loggboken ikke logger tilstanden til en knapp.

## Lys, persienner og hendelser

Laget av [MQTT-oppdagelse](/nb/iot/mqtt-discovery/) for en enhet som har meldt seg selv, bundet til taggene oppdagelsen laget for den. Ingen bygger disse av PLS-tags, så `POST /api/entities` tar dem ikke. Samme regler som for hvert sammensatt utstyr: tilstanden er det tilbakemeldingen sier, aldri det HotLoop sist sendte, og hver tjeneste er skrivinger gjennom porten, hver tag armert først av et menneske.

| Domene | Rolle | Tag-type | <span class="sr-only">Detaljer</span> |
|---|---|---|---|
| `light` | `state` | bool | tilbakemelding: på eller av |
| | `command` | bool | armert. `turn_on` skriver true, `turn_off` false. Samme tag som `state` |
| | `brightness` | tall | tilbakemelding, 0 til 100 prosent, attributtet `brightness` |
| | `brightness_command` | tall | armert. `turn_on` med en `brightness`. Samme tag som `brightness` |
| `cover` | `state` | hvilken som helst | tilbakemelding: `open`, `closed`, `opening`, `closing` eller `stopped` |
| | `command` | hvilken som helst | armert. `open`, `close` eller `stop`. Samme tag som `state` |
| | `position` | tall | tilbakemelding, 0 (lukket) til 100 (åpen), `current_position` |
| | `position_command` | tall | armert. `set_position`. Samme tag som `position` |
| `event` | `state` | hvilken som helst | hendelsestypen den sist utløste |
| `lock` | `state` | hvilken som helst | leses og skrives: `locked`, `unlocked`, `locking`, `unlocking`, `jammed`, `open`, `opening`; tar `lock`, `unlock`, `open` |
| `fan` | `state` | bool | leses og skrives: på eller av |
| | `percentage` | tall | leses og skrives, 0 til 100 |
| | `preset_mode`, `direction` | hvilken som helst | leses og skrives |
| | `oscillating` | bool | leses og skrives |
| `siren` | `state` | bool | leses og skrives: på eller av |
| `notify` | `message` | hvilken som helst | skrives: meldingen. Ingenting å lese |
| `update` | `installed_version`, `latest_version` | hvilken som helst | leses |
| `device_tracker` | `state` | hvilken som helst | leses: `home`, `not_home`, eller sonen den nevner |
| `climate` | `mode` | hvilken som helst | leses og skrives: tilstanden. `set_hvac_mode` med `hvac_mode` |
| | `temperature`, `target_temp_low`, `target_temp_high` | tall | leses og skrives. `set_temperature` med hvilken som helst av dem |
| | `target_humidity` | tall | leses og skrives. `set_humidity` med `humidity` |
| | `fan_mode`, `swing_mode`, `swing_horizontal_mode`, `preset_mode` | hvilken som helst | leses og skrives, hver med sin egen `set_`-tjeneste |
| | `current_temperature`, `current_humidity`, `action` | tall, tall, hvilken som helst | leses |
| | `power` | bool | skrives: `turn_on` true, `turn_off` false. Ingenting å lese |
| `humidifier` | `state` | bool | leses og skrives: på eller av |
| | `target_humidity` | tall | leses og skrives. `set_humidity` med `humidity` |
| | `mode` | hvilken som helst | leses og skrives. `set_mode` med `mode` |
| | `current_humidity`, `action` | tall, hvilken som helst | leses |
| `water_heater` | `mode` | hvilken som helst | leses og skrives: tilstanden. `set_operation_mode` med `operation_mode` |
| | `temperature` | tall | leses og skrives. `set_temperature` |
| | `current_temperature` | tall | leses |
| | `power` | bool | skrives: `turn_on`, `turn_off` |
| `alarm_control_panel` | `state` | hvilken som helst | leses: `disarmed`, `armed_home`, `armed_away`, `armed_night`, `armed_vacation`, `armed_custom_bypass`, `pending`, `triggered`, `arming`, `disarming`; skrives av `alarm_arm_home`, `alarm_arm_away`, `alarm_arm_night`, `alarm_arm_vacation`, `alarm_arm_custom_bypass`, `alarm_disarm`, `alarm_trigger` |
| `vacuum` | `state` | hvilken som helst | leses: `cleaning`, `docked`, `paused`, `idle`, `returning`, `error`; skrives av `start`, `pause`, `stop`, `return_to_base`, `clean_spot`, `locate` |
| | `battery_level` | tall | leses |
| | `fan_speed` | hvilken som helst | leses og skrives. `set_fan_speed` med `fan_speed` |
| `lawn_mower` | `activity` | hvilken som helst | leses: `mowing`, `paused`, `docked`, `error`, `returning` |
| `camera` | `image` | hvilken som helst | leses: en hash av det nyeste bildet. Tilstanden er når det endret seg; `entity_picture` er hvor du henter det |
| `image` | `image` eller `url` | hvilken som helst | leses: et lagret bilde som for et kamera, eller en lenke (`url`, bare http eller https, aldri hentet) |
| | `start_mowing`, `pause`, `dock` | bool | skrives: ett trykk hver, med tjenesten med samme navn |

Tilstanden er avlesningen av tilstandsrollen (på eller av for en bool), `unknown` når den ikke kan leses, og hver annen rolle som kan leses er et attributt under eget navn: en vifte sin `percentage`, `preset_mode`, `oscillating` og `direction`. `toggle` følger tilbakemeldingen og avvises når det ikke finnes noen. En varsler har ingenting å lese: tilstanden er `unknown` med `feedback: none`. En oppdatering er `on` når det installerte ikke er det nyeste, og den tar ingen tjenester: HotLoop installerer aldri fastvare, fordi en mislykket flashing er et driftsstopp. En oppdaget scene er en enkeltskudd-knapp, og trykket er scenens nyttelast.

Hva en ting kan få sendt står i attributtene, etter konfigurasjonen: en termostats `hvac_modes`, `fan_modes`, `preset_modes` og `swing_modes`, en luftfukters `available_modes`, en varmtvannsberederes `operation_list`, en vifte sine `preset_modes`, en støvsugers `fan_speed_list` (fra entitetens `role_choices`-alternativ, som oppdagelsen holder i takt med konfigurasjonen), og setpunktets `min_temp`/`max_temp` og `min_humidity`/`max_humidity` (fra taggens område). De er det skjermbildene tilbyr. De er ikke det som bestemmer regelen: porten holder setpunktet innenfor taggens område og driveren avviser et ord konfigurasjonen ikke lister, uansett hva et attributt sier. `set_temperature` uten noen av de tre nøklene avvises, det er ikke et kall som ikke gjør noe. `turn_on` på en termostat uten strøm-topic avvises også, i stedet for å gjette hvilken modus "på" betyr.

### `light`

På eller av etter `state`-tilbakemeldingen; `unknown` når den ikke kan leses, og uten noe tilstands-topic i det hele tatt, `unknown` for godt med `feedback: none`. Lysstyrke er et attributt, og `color_mode`, `color`, `color_temp` og `effect` på et JSON-skjema-lys er også attributter: vist, ikke styrt. `toggle` følger tilbakemeldingen og avvises når det ikke finnes noen å gå etter.

### `cover`

Dens `state`-tilbakemelding når den har en. Med bare en posisjon: ved 1 % eller lavere `closed`, alt over `open`. Et ord som ikke er noen av de fem er `unknown`, med `raw_value`. `current_position` er posisjonen når det finnes en.

### `event`

Tilstanden til en hendelse er **når** den sist ble utløst (RFC 3339), og `event_type` hva den var; `event_types` lister hva den kan utløse. `unknown` til den har utløst siden HotLoop begynte å lese den. Den tar ingen tjenester: ingenting styrer en hendelse. To hendelser i én polling vises som den seneste; loggboken og historikken har hver avlesning slik den kom.

## Alarm-entiteter

Hver alarmdefinisjon er en entitet: `alarm.<definition id>` (gjort om til slug på samme måte som en tags, så `oven-temp-hi` blir `alarm.oven_temp_hi`), plattform `alarm`, `unique_id` `alarm:<definition id>`, oppkalt etter definisjonen. Den har ingen bindinger og ingen enhet: tilstanden er alarmmotorens, ikke en tags, og en definisjon tilhører ikke enheten sin slik en tag gjør (å slette en enhet lar alarmdefinisjonene bli). Taggen den overvåker er attributtet `source`.

Tilstanden er ISA-18.2-tilstanden alarmmotoren holder, skrevet slik en entitetstilstand skrives:

| Alarmmotor | Entitetstilstand | <span class="sr-only">Detaljer</span> |
|---|---|---|
| `normal` | `normal` | vilkåret er borte, ingenting utestående |
| `unack-active` | `active_unack` | vilkåret er sant, ingen har kvittert |
| `ack-active` | `active_ack` | vilkåret er sant, kvittert |
| `rtn-unack` | `rtn_unack` | gått tilbake før noen kvitterte |
| `shelved` | `shelved` | dempet av en operatør, for en begrenset tid |
| `suppressed` | `suppressed` | dempet av design |

Kvaliteten er `good`: motorens tilstand er ikke en avlesning. Entiteten er `unavailable` når den er foreldreløs eller Gateway ikke har noen alarmmotor. Den følger hver overgang etter hvert som den skjer, kvitteringer medregnet.

Attributter: `definition_id`, `source`, `condition`, `limit`, `priority` (1 til 4), `priority_label`, `enabled`, `message`, `count`, `active`, `needs_ack`, `trip_value`, `raised_at`, `cleared_at`, `acked_at`, `acked_by`, `shelved_until`, `shelved_by`, de siste til stede når de gjelder.

Tjenestene `acknowledge`, `shelve` og `unshelve` skriver ingen tag, så de går ikke gjennom skriveporten. De kaller alarmmotorens egne `Ack`, `Shelve` og `Unshelve`, de samme som alarmskjermbildet og `POST /api/alarms/{id}/ack` kaller, så de havner i alarmsporet (`alarm_events`) og systemloggen nøyaktig som de gjør. De trenger **`alarms.ack`**, ikke `values.write`: en operatør kvitterer alarmer, en leser gjør det ikke. Et avvist kall svarer 403 og loggføres under entiteten med hvem som prøvde. Kallet er også én linje i systemloggen under entiteten, med årsaken.

`unshelve` avvises (409) på en alarm som ikke er utsatt. Alarmmotoren avviser det også, og bringer en utsatt alarm tilbake i den tilstanden vilkåret faktisk er i, ikke blindt til normal. En tjeneste alarmer ikke tar (`turn_on`) avvises som ukjent tjeneste (400) før den kommer i nærheten av motoren.

### Plattformer med leverandør

Alarm-entiteter er den første **leverandør**-plattformen: entiteter hvis sannhetskilde er et annet sted enn i en tag. En leverandør sier hvilke entiteter plattformen har akkurat nå, gjengir tilstanden deres, kjører tjenestene deres og besvarer prøvekjøringene deres; registeret utleder, gjør foreldreløse og tar over igjen entitetene sine gjennom `unique_id` nøyaktig som det gjør med en tags, tilstandsmotoren beregner dem på nytt ved leverandørens egne hendelser og i sin takt på én gang i sekundet, og et tjenestekall på en går til leverandøren i stedet for å planlegges som tag-skrivinger. En leverandør som skriver en tag skriver den fortsatt gjennom porten.

Hjelpere er den andre: `input_boolean`, `input_number`, `input_select`, `input_text`, `input_counter`, `timer` og `schedule`, verdier som anleggets folk eier i stedet for en PLS, holdt av HotLoop og satt med `helpers.write`. De skriver ingen tag. Se [Hjelpere](/nb/iot/helpers/).

Skript er den tredje: hvert skript er en `script`-entitet, `script.<id>`, på mens en kjøring av det pågår i en hvilken som helst prosess og av når ingen gjør det. `turn_on` kjører det med tjenestedataene som felt, `turn_off` stopper det, begge med `scripts.run`. Å slette et skript gjør entiteten foreldreløs, som å slette en alarmdefinisjon. Se [Skript](/nb/iot/scripts/).

Oppskrifter er den fjerde: hver oppskrift er en `scene`-entitet, `scene.<id>`, hvis tilstand er når den sist skrev til anlegget og hvis attributter sier hvordan den nyeste bruken gikk. `turn_on` bruker den, med `recipes.apply` og oppskriftens egen tillatelse når den nevner en. Å slette en oppskrift gjør entiteten foreldreløs. Se [Oppskrifter](/nb/iot/recipes/).

Solen er den femte: `binary_sensor.sun_up`, `sensor.sun_elevation` og `sensor.sun_azimuth`, regnet ut hvert sekund fra stedets breddegrad og lengdegrad, på maskinen. De leses og tar ingen tjenester. Et sted uten posisjon har dem ikke, og de som er igjen fra da det hadde en, leses som utilgjengelige og sier hvilke variabler som skal settes. Se [solen](/nb/iot/sun/).

## Entiteter overalt ellers

### Direktestrømmen

`GET /api/stream` bærer en `entities`-hendelse ved siden av `values`. Den slås sammen på samme måte, høyst fire ganger i sekundet, nyeste tilstand per entitet:

```
event: entities
data: {"changed":[{"entity_id":"sensor.press_01_zone1_temp","state":"212.5",...}],"removed":[]}
```

`changed` er den fulle tilstanden til hver entitet som har endret seg siden forrige hendelse, i samme form som `GET /api/states/{entity_id}`. `removed` er entity_id-ene som ikke lenger har noen tilstand i det hele tatt: deaktivert, slettet sammen med enheten, eller omdøpt bort fra (det nye navnet kommer i `changed`). Den første `entities`-hendelsen på en ny forbindelse bærer hver tilstand, slik `snapshot` bærer hver avlesning, så et skjermbilde er fylt før noe endrer seg. Hendelsene `values`, `snapshot`, `alarm` og `device` er nøyaktig det de var.

### MCP

Agenter får `list_entities`, `get_states` og `call_service`. `call_service` går gjennom samme tjenestekjører som `POST /api/services/...`, så en agents kall styres av MCP-bryteren som `write_tag` og revideres mot entiteten med kilde `mcp`. Se [MCP](/nb/iot/mcp/#entiteter).

### Automatiseringer

En `state`-trigger utløser en regel når tilstanden til en entitet endres, vilkår kan lese `states`, `attrs` og entitetenes `qualities`, og en `call_service`-handling styrer en entitet gjennom porten, revidert som `automation:<rule-id>`. Se [Automatiseringer](/nb/iot/automations/#tilstandsutløsere-følger-entiteter).

Begge følger motorens `OnStateChanged`-krok, og det er derfor reglene i [Hvordan motoren kjører](#hvordan-motoren-kjører) betyr noe: en tilstandstrigger ser hver endring motoren beregner, én gang, i rekkefølge, og ingenting motoren aldri så.

## Skjermbilder

**Entiteter** lister hver entitet under plassen sin i utstyrstreet (sin egen, ellers enhetens), med treet ved siden av, og filtrerer på plass, domene, etikett, tekst og kvalitet. Innenfor en plass kommer utstyret først (alarmer, motorer, ventiler, sløyfer, selects, knapper, tellere), så det som kan styres, så de rå avlesningene.

Som standard viser skjermbildet hvert signal én gang. Entitetsmodellen gir med vilje ett punkt flere entiteter, og hver beholder id-en sin, men tegnet som fliser er det samme signalet to eller tre ganger: en armert tag er en sensor og en bryter, og en tag bundet inn i en motor er fortsatt sin egen sensor. På en ekte linje doblet det omtrent flisene og begravde utstyret. Så skjermbildet folder:

- Lese-entiteten til en tag ligger bak styre-entiteten sin. Bryteren eller tallet er flisen, siden den allerede viser levende tilstand, og skuffen dens sier "også tilgjengelig som" med sensorens entity_id, for den som kobler en automatisering eller en agent til den.
- En tag bundet inn i et sammensatt utstyr ligger inne i utstyret, begge entitetene. Skuffen til det sammensatte utstyret lister signalene: rollene, taggen, hva den leser nå, og lese- og styre-entity_id-ene. En tag i to sammensatte utstyr går inn i det første etter navn.
- Bare en kontroll eller et sammensatt utstyr som verken er skjult eller deaktivert tar imot noe. Skjul eller deaktiver bryteren, og sensoren får flisen sin tilbake.
- En alarm på et foldet signal flagger flisen det er foldet inn i, med alarmens navn, og åpner alarmen derfra. Å folde rydder skjermbildet; det skjuler aldri en alarm.
- Tallet ved siden av kvalitetslinjen sier "13 vist · 25 foldet inn", og en flis som rommer andre sier det i foten ("5 signaler", "+ sensor"). Domenebrikkene, tretellingene og kvalitetslinjen teller flisene som vises.
- Søk og etikettfilter ser inne i flisene. Søk etter en entity_id eller en tag som er foldet, og du får flisen som rommer den, med ramme, med "Funnet her:" og entity_id. Vi valgte det framfor å bytte hele skjermbildet til hver entitet: du lander på pumpen du lette etter, ikke på en vegg av fliser.

"Vis alle entiteter" slår foldingen av og gir hver entitet sin egen flis, for en ingeniør som vil ha det rå registeret. Den er av som standard og denne nettleseren husker det (lokal lagring; et privat vindu glemmer det). Ingen andres skjermbilde endres.

Tilstander kommer på `entities`-hendelsen i direktestrømmen; skjermbildet poller dem aldri. En flis tegnes på nytt når tilstanden endres, og tegnes på nytt selv mens en knapp i den har fokus, fordi en flis som beholdt en gammel tilstand av den grunn ville vise fortiden som nåtiden. Kvaliteten tegnes før verdien:

| Kvalitet | På skjermen |
|---|---|
| god | verdien, ingen markering |
| usikker | verdien, en gulbrun kant og et merke "usikker" |
| dårlig | siste gode verdi, grået ut på en skravur, "dårlig", og "siste gode verdi, avlesningen er dårlig", med årsaken etter når driveren oppga en |
| ingen avlesning ennå | "Ukjent", i kursiv, og "avlesning dårlig" med årsaken når det finnes en |
| utilgjengelig | "Utilgjengelig", hele flisen skravert |

Kontrollene følger domenet og rollen. En leser ser ingen. En operatør ser de som ligger bak `values.write` (og en alarms, bak `alarms.ack`), deaktivert med årsaken på seg når skriving er slått av på denne installasjonen eller en tag entiteten skriver til ikke er armert. Utgangen til en sløyfe tilbys bare mens den leser manuell, fordi det er det eneste tidspunktet porten tillater det. Hver kommando åpner en prompt som sier hvilken tjeneste, hvilke tags og hva entiteten leser nå, og tar en årsak til revisjonssporet. En avvisning holder prompten åpen med portens ord og hver skriving som gikk ut eller ikke. Den nye tilstanden antas aldri ut fra kommandoen: den kommer tilbake på strømmen når enheten leser tilbake, eller den gjør det ikke.

Skuffen har tilstanden og tidsstemplene, kontrollene, en time, seks timer eller ett døgn av den bundne taggens historikk (en trinnkurve, siste verdi ført fram til nå, dårlige avlesninger markert), de andre entitetene for samme signal, bindingene (for et sammensatt utstyr, signalene), attributtene og hver kommando gitt eller avvist gjennom entiteten. En administrator får også entity_id, navnet, plassen i treet, etikettene, skjult og deaktivert, og slett for et sammensatt utstyr eller en foreldreløs entitet.

**Nytt utstyr** (administrator) bygger et sammensatt utstyr: velg domenet, gi det et navn og velg en tag for hver rolle. Hver rolle tilbys bare tags av en type som passer, og en kommandorolle viser tags som ikke er armert som deaktiverte i stedet for å skjule dem. Det som er påkrevd er markert, men ikke håndhevet av skjemaet: registeret avgjør, og avvisningen vises slik det skrev den.

**Anlegg** er utstyrstreet og etikettene. Se [Utstyrstreet og etikettene](/nb/iot/equipment/).

## Sikkerhetskopi og gjenoppretting

`entities` og `entity_bindings` er med i sikkerhetskopien, entity_id, tilpasninger og alt. Det gjelder også sammensatte utstyr, hver rolle og hvert alternativ, som betyr mer for dem enn for noe annet: entiteten til en tag kunne bygges opp igjen fra taggen, men ingenting kan bygge opp et sammensatt utstyr unntatt sikkerhetskopien. Alarm-entiteter kommer tilbake med definisjonene sine, og en gjenopprettet definisjon uten entitet får en ved første synkronisering. En sikkerhetskopi tatt før denne versjonen har ingen av tabellene; gjenopprett den, start Gateway, og registerets første synkronisering gir hver gjenopprettet tag entiteten sin. `entity_labels` er også med i sikkerhetskopien, og gjenoppretting av en sikkerhetskopi fra før utstyrstreet er dekket i [Utstyrstreet og etikettene](/nb/iot/equipment/).

Migrering 0007 legger til tre kolonner i `write_audit`. En sikkerhetskopi tatt før den kan fortsatt gjenopprettes: gjenopprettingen laster en fil med færre kolonner enn dagens tabell inn i de første kolonnene og lar de nye få standardverdiene sine, fordi en migrering som legger til en kolonne alltid legger den til bakerst. En sikkerhetskopi fra en nyere versjon avvises fortsatt. Se [Sikkerhetskopier og gjenoppretting](/nb/iot/backup/).

## Hva som ikke er her ennå

Kjernen, utstyrstreet, styring av entiteter gjennom skriveporten, sammensatt utstyr, alarm-entiteter, entiteter i MCP, automatiseringer og direktestrømmen, og skjermbildene er alle her. Se [HotLoop-veikart](/nb/roadmap/). En tilstandstriggers `forSec` ("på i fem minutter") står i [Automatiseringer](/nb/iot/automations/#å-holde-en-tilstand-forsec).
