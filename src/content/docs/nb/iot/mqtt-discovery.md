---
title: "MQTT-oppdagelse"
description: "Pek ESPHome, Zigbee2MQTT, Tasmota eller en Shelly mot megleren, så dukker den opp, skrivebeskyttet til en admin godtar den og armerer hvert punkt."
---

Pek en enhet mot HotLoops megler, så dukker den opp. Sensorene leser, bryterne viser tilstanden sin, entitetene har navnene, enhetene og klassene den kunngjorde. Ingen skriver inn en tag-liste.

Og den kan ikke kommandere noe. Hvert punkt oppdagelsen lager er skrivebeskyttet, og blir det til en admin godtar enheten og så armerer hvert punkt for hånd, mens vedkommende ser på nøyaktig det topicet kommandoen går til. En enhet som kunngjør seg selv er en enhet som forteller deg hva den er. Det er nyttig. Det er ikke en enhet som tjener retten til å slå av og på et relé i anlegget ditt, og HotLoop later ikke som om den gjør det.

## Hvem som snakker det

Formatet er det med topics som `homeassistant/sensor/kitchen/power/config`. Det bærer navnet til prosjektet som definerte det; HotLoop snakker det fordi publisherne gjør det, og det er hele forholdet.

| Publisher | Hvordan den kommer hit | Hva vi tester den mot |
|---|---|---|
| **ESPHome** (`mqtt:`-komponenten) | per komponent, på som standard, retained | innspilt utdata fra ekte noder (se under) |
| **Zigbee2MQTT** | per komponent, med maler på nesten alt | innspilt utdata fra ekte installasjoner |
| **Tasmota** | sitt eget format, under | innspilt utdata fra ni ekte enheter |
| **Shelly** (Gen2, Gen3, Gen4) | ingen kunngjøring i det hele tatt; lært fra statusene den publiserer, under | innspilt utdata fra femten sett med ekte meldinger og produsentens dokumentasjon |
| Alt annet som publiserer formatet | det samme | formatets egne regler |

ESPHome holdes opp mot opptak fra ekte noder, på samme måte som Zigbee2MQTT.

Opptakene er meldinger en ekte installasjon publiserte, fanget av den som driver den, med publisher, versjon og enhet notert og ingenting endret bortsett fra JSON-mellomrom.

## Tasmota

Dagens Tasmota publiserer ikke `homeassistant/`-formatet. Dokumentasjonen sier at det er fjernet fra alle bygg. Det den publiserer, retained, er sitt eget:

- `tasmota/discovery/<MAC>/config`: enheten (topicet, mønsteret for full topic, reléene og lysene, ordene for på og av, ordene for last will);
- `tasmota/discovery/<MAC>/sensors`: hva sensorene leser akkurat da.

Begge skrives av `TasDiscovery` i Tasmotas `xdrv_12_discovery.ino` (lest på arendst/Tasmota `development` 5c295fb, 2026-10-12). HotLoop gjør de to om til de samme komponentene som alle andre publishere lager, så alt etterpå (Oppdaget-skjermen, godkjenning, armering, skrive-porten, lesingen) er én kodevei. MAC-adressen er enhetens identitet; en enhet som i tillegg kunngjør seg i `homeassistant/`-formatet (en gammel firmware med SetOption19) er den samme enheten.

| Tasmota sier | HotLoop lager |
|---|---|
| et relé (`rl` 1) | en bryter: leser `stat/<topic>/POWER` (`POWER1`, `POWER2` og så videre når det er flere), med enhetens egne ord for på og av; kommanderer `cmnd/<topic>/POWER[n]` med ON eller OFF |
| et lys (`rl` 2) | et lys: på og av på samme måte. Med én dimmer er nivået nøkkelen `Dimmer` i `tele/<topic>/STATE`, 0 til 100, og settes med `cmnd/<topic>/Dimmer` |
| hvert tall i sensormeldingen | en sensor hver, lest fra `tele/<topic>/SENSOR` etter stien (`ENERGY` `Power`, `SCD40` `CarbonDioxide`), med enheten og klassen Tasmota gir det navnet. Matrisen fra en trefasemåler blir én sensor per fase |
| last will | tilgjengelighet: `tele/<topic>/LWT`, med enhetens egne ord for Online og Offline |

Topics bygges slik Tasmota bygger dem: full topic med `%prefix%` og `%topic%` fylt inn, slik at en enhet der eieren har endret full topic (`tasmota/35D7A0/%prefix%/`, eller `bi/test/%topic%/%prefix%`) leser og kommanderer på topicene den faktisk bruker.

Det den ikke leser, sier den fra om, i kildens problemer og aldri med taushet: persienner, en bryterinngang, en knapp, en iFan, et kamera, fargene på et fargelys og lysstyrken på en enhet med mer enn ett lys. Ingenting i opptakene viser at noe av dette fungerer, så ingenting her hevder å lese dem.

**Spørre.** Tasmota rapporterer et relé når det endres, og alt hvert femte minutt. Så når en enhet begynner å leses, sender HotLoop én tom melding til `cmnd/<topic>/POWER`, som Tasmota svarer på med tilstanden til hvert relé uten å flytte noe; uten den leser en enhet som ikke har endret seg ukjent i opptil fem minutter etter at HotLoop starter. Meldingen er tom, til et topic som ender på `POWER` og ingenting annet, og en kilde som bare lytter sender ingenting i det hele tatt.

**Lysstyrken til et lys** kommer med Tasmotas telemetri (hvert femte minutt med mindre enhetens `TelePeriod` er kortere), ikke i øyeblikket den endres. På og av kommer med en gang.

**På hver megler** er formatet en bryter (`tasmota` på megleren, under Innstillinger, MQTT). En megler som legges til nå har den på; den innebygde megleren har den alltid; en megler som allerede fantes lytter akkurat som før, så den er av til noen slår den på. Av betyr at HotLoop ikke engang abonnerer på `tasmota/discovery/#` der.

En konfigurasjon er ikke til å stole på, som alle andre. En som er publisert under en MAC som ikke er den den sier den er, et full topic uten `%topic%` eller med jokertegn, et topic med skråstrek, et på-ord med anførselstegn, en versjon den ikke kjenner: hver av dem avvises med begrunnelse, og ingenting lages. Et sensornavn med anførselstegn når aldri en mal.

**Hva dette ble testet mot.** Ekte meldinger fra ni enheter, fanget fra Tasmotas egen konsoll:

| Opptak | Enhet | Kilde |
|---|---|---|
| esp32-8relay-13.4.0 | ESP32-kort, 8 releer, Tasmota 13.4.0 | github.com/arendst/Tasmota/issues/20953 |
| esp32-zigbee-gateway-reboots-15.3.0.1 | ESP32 uten releer, tre oppstarter | github.com/arendst/Tasmota/issues/24487 |
| esp8266-sps30-scd40-airsensor-14.1.0 | CO2- og partikkelsensor, 14.1.0 | github.com/arendst/Tasmota/issues/24780 |
| esp8266-sps30-scd40-airsensor-15.4.0-invalid-json | samme boks på 15.4.0, hvis firmware publiserte JSON med et etterfølgende komma | samme sak |
| nous-a1t-energy-plug-14.5.0 | NOUS A1T-plugg med energimåling | github.com/arendst/Tasmota/issues/23094 |
| olimex-esp32-poe-counter-custom-fulltopic-14.5.0 | tellere og en trefasemåler, full topic endret | github.com/arendst/Tasmota/issues/23775 |
| shelly-dimmer2-15.3.0.3 | Shelly Dimmer 2 som kjører Tasmota | github.com/arendst/Tasmota/issues/24560 |
| tuyamcu-energy-meter-custom-fulltopic-14.5.0 | TuyaMCU-energimåler, full topic endret | github.com/arendst/Tasmota/issues/23165 |
| wemos-2relay-15.1.0.1 | to releer, fra konsolloggen til Tasmotas egen forfatter | github.com/arendst/Tasmota/issues/24006 |

Dette er opptak, ikke en enhet på benken. Det opptakene ikke har, er lysstyrken (dimmerens egen `tele/STATE`-linje var uleselig i kildeloggen; `Dimmer`-nøkkelen står i `STATUS11` i samme opptak, som Tasmota bygger med samme funksjon) og effektspørringen med svar (opptakene viser spørsmålet og svaret, fra Tasmotas konsoll, ikke at HotLoop spør).

## Shelly

En Shelly Gen2, Gen3 eller Gen4 kunngjør ingenting. Det finnes ikke noe konfigurasjons-topic å vente på. Det den gjør, når MQTT er på og statusvarslene er på, er å publisere hele statusen til hver komponent på `<prefix>/status/<component>` (`switch:0`, `cover:0`, `light:0`, `input:0`, en virtuell `boolean:200`) hver gang den endres, og last will på `<prefix>/online`. Så HotLoop lærer enheten av det den sier: komponentene den har publisert, feltene hver av dem har båret, og MAC-adressen fra `sys`-statusen. Prefikset er som standard enhetens id (`shellyplus2pm-485519968144`), som er modellen og MAC-adressen, så en enhet på standardprefikset venter ikke engang på `sys`. En på et prefiks noen har skrevet inn (`ShellyLichtGarten`) må publisere `sys` før den kan skilles fra en annen, og til den gjør det nevnes den i kildens problemer og lages ikke.

Det som er lært beholdes, per prefiks, og vokser bare. En komponent som blir stille er ikke fjernet, og en status med mindre i seg enn den forrige tar ikke bort noe, så en omstart gjør ikke at en enhet mister deler. Alt etterpå er samme vei som for alle andre publishere: Oppdaget-skjermen, godkjenning, armering av hvert punkt, skrive-porten, lesingen.

| Shelly sier | HotLoop lager |
|---|---|
| `switch:n` med en `output` | en bryter: leser `output` fra `<prefix>/status/switch:n`; kommanderer `<prefix>/command/switch:n` med `on` eller `off` |
| `light:n` | et lys på samme måte, med `set,true` og `set,false`; med `brightness` i statusen, et nivå fra 0 til 100, sendt som `set,true,<level>` |
| `cover:n` | et dekke: leser `state` (open, closed, opening, closing, stopped) og sender `open`, `close` og `stop`. Et dekke som sier `pos_control` er kalibrert, så det leser også `current_pos` og får `pos,<n>`; et som ikke er det åpner og lukker bare |
| `apower`, `voltage`, `current`, `freq`, `pf`, `aenergy.total`, `temperature.tC` på en switch, light eller cover | en sensor hver, i W, V, A, Hz, Wh og grader C, med klassen Shellys dokumentasjon gir dem |
| `input:n` | en binærsensor for `state` |
| `devicepower:n`, `voltmeter:n`, `illuminance:n`, `presencezone:n` | sensorer og binærsensorer for batteri, ekstern strøm, spenning, lysnivå, tilstedeværelse og antall objekter |
| `boolean:n`, `number:n`, `enum:n` (virtuelle komponenter) | skrivebeskyttede sensorer. Å sette en virtuell komponent er et RPC-kall, som dette ikke gjør, og hver enkelt nevnes i kildens problemer |
| `online`-last will | tilgjengelighet, med Shellys egne `true` og `false` |

Kommandoene er de produsentens MQTT-side lister under MQTT Control, og testene holder HotLoop til den listen: `on`, `off` og `toggle` for en bryter; `set,<bool>,<brightness>` for et lys; `open`, `close`, `stop` og `pos,<n>` for et dekke. Hver er en skriving gjennom porten, armert av et menneske.

**Spørre.** En Shelly publiserer en komponent når den endres, så en enhet som ikke har endret seg ville lest ukjent til den gjør det. Når en enhet begynner å leses, sender HotLoop `status_update` til `<prefix>/command`, som samme side sier får enheten til å publisere statusen til komponentene og ikke flytter noe. Det er det ene ordet, til et topic som ender på `/command` og ingenting annet, og en kilde som bare lytter sender ingenting i det hele tatt. Det skjer hver gang enhetens lesing starter, så å armere flere punkter på rad spør flere ganger.

**Hva enheten må ha på.** MQTT aktivert, med meglerens adresse; statusvarsler på (`status_ntf`); og, for kommandoer, kontroll på (`enable_control`). HotLoops egen megler har en `shelly`-påloggingsprofil, oppkalt etter enhetens prefiks, som lar den publisere statusene sine og høre `<prefix>/command` og ingenting annet.

**Hva den ikke leser.** Sagt, i kildens problemer, aldri med taushet: en komponent av en type den ikke har fått se (`lora:100` på en Gen4 med LoRa-tillegget, en `pm1`, en `em`), en switch eller cover som har utelatt feltet den leses fra, og innstillingen av en virtuell komponent. Inngangshendelser (et dobbelttrykk, et langt trykk) kommer på RPC-varslings-topicet `<prefix>/events/rpc`, og leses ikke; bare `state` for en inngang leses. Et prefiks med mer enn to nivåer (`home/garage/boiler`) høres ikke; ett eller to gjør det. Ingenting sendes over RPC.

**På hver megler** er det en bryter (`shelly` på megleren, under Innstillinger, MQTT). En megler som legges til nå har den på; den innebygde megleren har den alltid; en megler som allerede fantes lytter akkurat som før, så den er av til noen slår den på. Det er en bryter fordi topicene den lytter på, `+/status/+`, er brede, og en megler som fører noe annet under `*/status/*` vil ha den av. Av betyr at HotLoop ikke abonnerer på dem der.

Den er ikke til å stole på, som alle andre topics. Et prefiks som ikke er bokstaver, sifre og `_.-`, en komponent som ikke er `kind:number`, en nyttelast som ikke er et objekt eller er over 64 KiB, en enhet som oppgir mer enn 64 komponenter, og mer enn 512 enheter som læres samtidig ignoreres hver for seg, og en struktur lagret under ett prefiks som sier den er et annet avvises.

**Hva dette ble testet mot.** Femten sett med ekte meldinger og produsentens egen dokumentasjon.

| Opptak | Enhet | Kilde |
|---|---|---|
| plus-1-fw1.4.2-switch-rpc | Plus 1, firmware 1.4.2 | github.com/iobroker-community-adapters/ioBroker.shelly/issues/1055 |
| plus-2pm-cover-mode | Plus 2PM som rullegardin, kalibrert | samme repo, issues/1088 |
| 1pm-mini-gen3-fw2.0.0-switch | 1PM Mini Gen3, 2.0.0 | samme, issues/1592 |
| 2pm-gen3-fw2.0.1-beta3-switch | 2PM Gen3, 2.0.1-beta3, to kanaler | samme, issues/1627 |
| 2pm-gen4-lora-addon | 2PM Gen4 med LoRa-tillegget | samme, issues/1349 |
| plug-s-gen3-fw2.0.1-beta1-switch | Plug S Gen3 | samme, issues/1594 |
| pro4pm-gen2-fw2.0.1-switch-set | Pro 4PM, 2.0.1, med avsenderens MAC sladdet | samme, issues/1640 |
| pro-dimmer-2pm-fw1.3.0-light | Pro Dimmer 2PM | samme, issues/974 |
| dimmer-gen3-light-sys | Dimmer Gen3 | github.com/enesbcs/shellyteacher4domo/issues/65 |
| pill-gen3-fw1.8.99 | Pill, 1.8.99, med et voltmeter | ioBroker-repoet, issues/1232 |
| presence-gen4-fw2.1.99-dev | Presence Gen4, tre soner | samme, issues/1228 |
| frankever-sprinkler-virtual-components | en vanningsstyring på et eget prefiks, virtuelle komponenter | samme, issues/1207 |
| official-docs-component-status | produsentens komponenteksempler: Plus 1PM, Plus 2PM, H&T, Pro 1, WDUS | shelly-api-docs.shelly.cloud |
| official-docs-mqtt-control | produsentens MQTT Control-kommandoer | samme |
| official-docs-mqtt-page, official-docs-notifications | produsentens MQTT-side og varslingseksempler | samme |

To av dem kan ikke bygges til en enhet, og testene sier det: prefikset til Pro 4PM har avsenderens sladding (`xxxx`) i seg og ingen `sys`, og hagelyset har et eget prefiks som heller ikke har noen. Begge venter på MAC-adressen sin, som en ekte ville gjort.

**Dette er verifisert mot opptak og dokumentasjonen, ikke mot en Shelly på benken.** Ingen er her ennå. Statusene er det ekte enheter publiserte, topicene HotLoop leser er topics disse enhetene brukte, og kommandoene har formene produsenten dokumenterer. Det opptakene ikke kan vise: en kommando som faktisk flytter et relé, et dekke som faktisk går til en posisjon, og svaret på `status_update`. Når en Shelly står på benken, er dette de tre tingene å prøve først.

## Hva som skjer når noe kunngjør seg

1. **Den dukker opp.** På den innebygde megleren er en enhet som kunngjør seg straks en HotLoop-enhet: protokoll `mqtt`, ikke plassert i treet, oppkalt etter det den kalte seg (`kitchen-plug`, så `-2` ved kollisjon), leser. Taggene får navn etter det den kunngjorde (`power`, `relay`). Entitetene får navnet, enhetsklassen, tilstandsklassen, enheten, kategorien og ikonet konfigurasjonen ga dem, og en entitet konfigurasjonen sier er av som standard starter deaktivert.
2. **Ingenting er armert.** Hver tag opprettes skrivebeskyttet. En bryter, et tall eller en tekst får kontrollentiteten sin med en gang, uarmert (`armed: false`), så en skjerm eller en automasjon kan navngi `switch.kitchen_plug_relay` fra dag én. Den begynner å virke i det øyeblikket et menneske armerer punktet, og ikke før.
3. **En admin bestemmer.** Enheter, Oppdaget. Hvem som kunngjorde den (på den innebygde megleren, påloggingen og klient-id-en som publiserte konfigurasjonen), hver komponent den ville laget, hvert topic den leser, hvert kommando-topic i sin helhet, og hva man skal se etter:

   - et kommando-topic utenfor topicene komponenten leser (en "lampe" hvis kommandoer går til `cmnd/boiler/POWER`);
   - et kommando-topic innenfor oppdagelsesprefikset, eller et som en annen enhet også gjør krav på;
   - en konfigurasjon som ber om retained kommandoer, fordi en retained kommando spilles av på nytt hver gang enheten kobler til igjen;
   - maler HotLoop ikke kan evaluere, og konfigurasjonsnøkler formatet ikke definerer.

   **Godta** holder den i lesing og gjør punktene armerbare, ett om gangen, i tag-editoren. Det armerer ingenting. Hvis enheten foreslo et område og en trenode har akkurat det navnet, forhåndsutfyller godta-dialogen det. En publisher får ikke plassere seg selv under Kjelerom; et menneske klikker godta. **Ignorer** forkaster enheten, taggene og entitetene (historikken blir, som for alle enheter) og holder den forkastet når den kunngjør seg igjen. Å slette en oppdaget enhet er det samme som å ignorere den, fordi en som fortsetter å kunngjøre seg bare ville kommet tilbake.

## Når den ombestemmer seg

**En annen pålogging holdes tilbake for gjennomgang, uansett hva den sier.** På den innebygde megleren husker en enhet påloggingen den ble godtatt fra. Den samme enheten kunngjort av en annen pålogging holdes tilbake for gjennomgang med de to påloggingene side om side, selv når konfigurasjonen er ord for ord den samme, og loggen får en advarsel. Enten har noen flyttet enheten til en ny pålogging, eller en pålogging kunngjør en enhet som ikke er dens egen. Bruk, og den nye påloggingen er den den er godtatt fra. Avvis, og den påloggingen som kunngjør det samme forblir avvist.

**En konfigurasjon som endres under en godtatt enhet holdes tilbake for gjennomgang.** Den godtatte konfigurasjonen fortsetter å kjøre. Oppdaget-skjermen viser endringen felt for felt, kjørende mot kunngjort, og en admin bruker eller avviser den. En enhet som går fra °C til °F, eller et tilstands-topic som peker et annet sted, er akkurat slik et feil tall får et pålitelig ansikt. Å bruke en endring endrer aldri om et punkt er armert: det var et menneskes beslutning og forblir det.

En firmwareoppdatering, et nytt enhetsnavn, en ny modell eller et annet ikon brukes av seg selv. Ingen skal måtte klikke for et versjonshopp.

Før noen godtar en enhet, gjelder alltid den nyeste kunngjøringen: ingen har bygget på den ennå.

**En tom konfigurasjon trekker tilbake en komponent.** Punktene leser dårlig og sier "trukket tilbake av publisheren kl. 14:02", og ingenting slettes. Et alarm på det punktet beholder målet sitt og sier hvorfor det er dårlig. Hvis den samme komponenten kommer tilbake, gjeninnsettes den, og til den sender en ny verdi leser den "kunngjort igjen etter tilbaketrekking; venter på neste verdi" i stedet for å fremstille verdien fra før den dro som gjeldende. En enhet ingen har godtatt som trekker tilbake alle komponentene sine, er borte, fordi ingen har bygget på den.

**Zigbee2MQTT som endrer navn på en enhet** fjerner de gamle konfigurasjons-topicene og kunngjør nye med de samme unike id-ene. HotLoop identifiserer komponenter etter den unike id-en, så det er en tilbaketrekking og en gjeninnsetting med ett sekunds mellomrom, og ingenting går tapt.

## Lesing

En tilstand går gjennom komponentens verdimal, hvis den har en, og deretter gjennom komponentens egen matching: `payload_on`/`payload_off` for en binærsensor (`ON`/`OFF` som standard), `state_on`/`state_off` for en bryter, et tall for et tall, ett av alternativene for et select. **Alt som ikke passer er en dårlig lesing med begrunnelse**, vist på flisen:

- `"CLOSE" is neither payload_on "CLOSED" nor payload_off "OPEN"`
- `value_json has no key 'temperature'`
- `"unavailable" is not a number`
- `the publisher sent no value` (den sendte `None`, `null`, ingenting eller `unknown`)
- `no update for 300 s (expire_after)`

Den første er ekte: Zigbee2MQTT 1.41.0 kunngjør vindussensoren til en Avatto TRV07 slik, og den som fanget den åpnet en sak fordi vinduet aldri dukket opp. HotLoop viser den som dårlig og sier hvorfor i stedet for å gjette.

**Tilgjengelighet** er enhetens forbindelse, ikke en lesing. Så lenge enheten sier at den er offline på tilgjengelighets-topicet, vises den som frakoblet med sine egne ord ("the device says it is offline (plug/status = offline)") og entitetene er utilgjengelige. Til den første tilgjengelighetsmeldingen kommer, er en enhet med konfigurert tilgjengelighet ikke tilgjengelig. Det er formatets regel, og den er riktig. Megler-sesjonen rives ikke ned for det: den deles med alle andre enheter på den megleren.

`expire_after` gjør en verdi dårlig etter så mange sekunder uten oppdatering. `off_delay` slår av en binærsensor etter så mange sekunder, fordi konfigurasjonen sier at enheten aldri sender av. JSON-attributter havner på entiteten, opptil 64 nøkler og 8 KiB, under HotLoops egne (`friendly_name`, `source`, `armed` og resten vinner alltid).

En komponent uten tilstands-topic leser dårlig for alltid. HotLoop antar aldri en tilstand ut fra en kommando.

## Kommandoer

Ingenting kommanderes før tre ting er sanne, i denne rekkefølgen:

1. **Et menneske godtok enheten.** Til da vil tag-editoren ikke armere et punkt på den ("accept the device first"), og skrive-porten avviser kommandoene på egen hånd, så en håndredigert rad eller en gammel sikkerhetskopi med punktet armert kommer heller ingen vei.
2. **Et menneske armerte punktet**, i tag-editoren, ett om gangen. Før avkryssingsboksen sier editoren hvor kommandoene går og hva de sender: "Commands go to `plug/relay/set`, sending ON or OFF."
3. **Skrive-porten slipper kommandoen gjennom**, som hver annen skriving: skriving slått på, MCP-bryteren for en agent, taggens område, entitetens egne kontroller, en levende sesjon. Revidert med sin anrops-id, avvist eller ikke. Prøvekjøringen stiller nøyaktig de samme spørsmålene.

Det som sendes er det konfigurasjonen sier: `payload_on` og `payload_off` for en bryter, `payload_press` for en knapp, alternativet for et select, verdien for et tall eller en tekst (et heltall som heltall, `5` og ikke `5.0`), gjennom konfigurasjonens kommandomal hvis den har en. En knapp trykkes én gang. "Slippet" ville vært en ny kommando enheten aldri ba om, så en oppdaget knapp er engangs.

Et lys får `payload_on`/`payload_off` (et lys med JSON-skjema, `{"state":"ON"}`), og en lysstyrke i prosent skalert til sin egen `brightness_scale` og avrundet, på lysstyrke-kommando-topicet (et lys med JSON-skjema, `{"state":"ON", "brightness":128}`). Et dekke får `payload_open`, `payload_close` eller `payload_stop`, og en posisjon skalert fra prosent til sine egne `position_closed`..`position_open` gjennom `set_position_template`. En ventil får sine åpne- og lukke-nyttelaster (en ventil som rapporterer en posisjon, sine `position_open` og `position_closed`), en posisjon på kommando-topicet og `payload_stop` én gang: som en knapp er stoppen til en oppdaget ventil engangs. En nyttelast konfigurasjonen slår av med `null` (et dekke uten stopp) er en kommando porten avviser med begrunnelse.

Porten avviser en kommando, med begrunnelse, når:

- ingen har godtatt enheten;
- megleren den ligger på bare lytter;
- publisheren trakk komponenten tilbake;
- kommandomalen ligger utenfor delmengden ("command template not supported: filter `regex_replace` is not supported at column 12"). Det er aldri "send råverdien i stedet";
- konfigurasjonen ikke har noe kommando-topic;
- konfigurasjonen ikke har noen nyttelast for det som ble bedt om: en stopp på et dekke hvis konfigurasjon sier `payload_stop: null`, et alternativ et select ikke har, en lysstyrke over 100 %. Nyttelasten gjengis i kontrollen, så prøvekjøringen sier også nei.

**Retained kommandoer følger konfigurasjonen.** Hvis en konfigurasjon ber om `retain: true`, publiserer HotLoop komponentens kommandoer retained, og sier det overalt der et menneske bestemmer om den: Oppdaget-skjermen flagger det og tag-editoren sier det med enkle ord. Forstå hva det betyr før du armerer en: megleren beholder den siste kommandoen og gir den til enheten hver gang den kobler til igjen, klokken tre om natten, uten at noens hånd er på noe. Kommandoen gikk likevel gjennom porten og står fortsatt i revisjonssporet med et navn ved siden av; den skjer bare igjen.

Det finnes ingen steder noe "publiser dette til det topicet": ikke i automasjoner, ikke i skript, ikke i MCP. Det ville vært en sidedør rundt porten med et penere navn. I koden er det to ting i oppdagelsen som publiserer: driverens skriving, som bare porten når, og fødselsmeldingen. En vakttest typesjekker driverpakken og lar bygget feile hvis noe annet kaller noen av dem, med en plantet omgåelse for å bevise at den biter.

## Maler

Ingen Python, ingen Jinja-motor. Ingen løkker, så en mal koster det lengden koster.

`{% set name = value %}` er med, og bare den formen: Zigbee2MQTT skriver modusen til hver termostat som `{% set values = {'manual':'heat', ...} %}` og slår den så opp, og en termostat der modusen ikke kan leses er en termostat du ikke kan stole på. Ingen navnerom, ingen utpakking, ingen blokkform. `.keys()` er også med, bare som høyre side av `in`, fordi det er det eneste stedet de malene bruker det.

| <span class="sr-only">Detaljer</span> | <span class="sr-only">Detaljer</span> |
|---|---|
| Struktur | tekst, `{{ expr }}`, `{% if %}` / `{% elif %}` / `{% else %}`, `{% set name = value %}`, `{# comments #}`, mellomromskontroll med `-` |
| Variabler | verdimaler: `value`, `value_json` (bare når nyttelasten er JSON), `entity_id`, `name`; kommandomaler: `value`, `entity_id`, `name` |
| Uttrykk | literaler, `.attr`, `['key']`, `[0]`, utsnitt, `+ - * / // % **`, `~`, sammenligninger, `and or not`, `in`, `x if c else y`, `.get(key, default)` på et kart, `in mapping.keys()` |
| Tester | `defined`, `undefined`, `none`, `number`, `integer`, `float`, `boolean`, `string`, `mapping`, `sequence`, `true`, `false`, `eq`, `ne`, `lt`, `le`, `gt`, `ge`, `in`, `odd`, `even`, `divisibleby` |
| Filtre | `float`, `int`, `round`, `bool`, `default`/`d`, `string`, `lower`, `upper`, `capitalize`, `title`, `trim`, `replace`, `truncate`, `abs`, `length`/`count`, `min`, `max`, `tojson`, `to_json`, `from_json`, `is_defined`, `iif` |
| Funksjoner | `float()`, `int()`, `bool()`, `iif()`, `min()`, `max()` |

Der formatet dokumenterer et filter annerledes enn standard Jinja, følger HotLoop formatet. Det som betyr noe: **`float` og `int` uten standardverdi feiler** på noe som ikke er et tall. Standard Jinja gir stille tilbake `0`, og det er nullen som sier at tanken er tom når sensoren har sluttet å svare.

Verdier gjengis slik Pythons `str()` gjengir dem, fordi det er det alle publishernes konfigurasjoner ble skrevet mot: `True`, `None`, `21.0` forblir `21.0`. Det er ikke kosmetisk. Zigbee2MQTTs kontaktsensor kunngjør `payload_on: false` og matcher det gjengitte `False`.

**En manglende nøkkel er en feil med mindre den er håndtert.** `{{ value_json.temperature }}` på en nyttelast uten den er en dårlig lesing som sier det, ikke en tom streng. `default`, `is defined` og en bar `{% if value_json.x %}` håndterer den med vilje, og er i orden.

**Utenfor delmengden avvises ved ankomst av konfigurasjonen**, med hvor: "value template not supported: filter `regex_findall_index` is not supported at column 12". Komponenten lages likevel, så du kan se at den finnes, og den leser dårlig med den begrunnelsen. Det finnes ingen delvis gjengivelse etter beste evne og ingen "bruk råe nyttelast i stedet". To ekte maler avvises med vilje: `now()` (en verdi som avhenger av når HotLoop evaluerte den er ikke en lesing av enheten), og en Zigbee2MQTT-hendelsesmal som bygger regex-mønstre med navnerom og `regex_findall`.

Grenser: 4 KiB mal, nesting 32 dyp, 64 KiB utdata, 64-biters heltall (et overløp er en feil, ikke en omslutning).

Formatets egne filtre, som ikke er standard Jinja, har håndskrevne tilfeller som siterer den dokumenterte oppførselen hvert av dem holder oss til. Hver mal i opptakene må kunne parses.

## Hva HotLoop bygger av hva

| Komponent | Tag | Entiteter |
|---|---|---|
| `sensor` | `float` når den har en enhet, en tilstandsklasse eller en numerisk enhetsklasse, ellers `string` | sensor |
| `binary_sensor` | `bool` | binary_sensor |
| `switch` | `bool` | binary_sensor, og en switch-kontrollentitet, uarmert |
| `number` | `float`, med konfigurasjonens `min`/`max` som taggens område | sensor, og en number-kontrollentitet, uarmert, med minimum, maksimum og steg |
| `text` | `string` | sensor, og en text-kontrollentitet, uarmert |
| `select` | `string`, leser bare ett av alternativene | sensor, og et select med konfigurasjonens alternativer, uarmert |
| `button` | `string`, tar imot et trykk og leser ingenting | en engangs knapp, uarmert (taggens egen leseentitet lages skjult) |
| `light` | `bool` på/av; `float` lysstyrke 0 til 100 % når den har en | et lys, uarmert |
| `cover` | `string`-tilstand, som også tar `open`, `close` og `stop`; `float` posisjon 0 til 100 % når den har en | et dekke, uarmert |
| `valve` | `string`-tilstand; `float` posisjon 0 til 100 % hvis den rapporterer en; `bool`-kommando (åpne eller lukke) og `bool`-stopp, kommandert og aldri lest | en ventil, uarmert, stoppen er engangs |
| `event` | `string`, hendelsestypen | en hendelse |
| `device_automation` (en utløser) | `string`, `<type>_<subtype>` når nyttelasten kommer | en hendelse, én per utløser |
| `lock` | `string`, lest med egne ord og tar `lock`, `unlock`, `open` | en lås, uarmert |
| `fan` | `bool` på/av; `float` hastighet 0 til 100 %; `string` forhåndsvalg og retning; `bool` oscillering, hver når den har en | en vifte, uarmert |
| `siren` | `bool` | en sirene, uarmert |
| `scene` | `bool`, et trykk | en engangs knapp, uarmert |
| `notify` | `string`, en melding, kommandert og aldri lest | en varsler, uarmert |
| `update` | `string` for installert og nyeste versjon | en oppdatering: på når de er ulike. Installeringskommandoen sendes aldri |
| `device_tracker` | `string`, `home`, `not_home` eller en sone | en sporer |
| `tag` | `string`, taggens id når en skannes | en hendelse |
| `climate` | `string` modus; `float` settpunkt, lavt og høyt settpunkt og fuktighetssettpunkt, hver med konfigurasjonens `min_temp`/`max_temp` (eller `min_humidity`/`max_humidity`) som område; `float` romtemperatur og fuktighet; `string` vifte-, sving- og forhåndsvalgsmoduser og handling; `bool` strøm, kommandert og aldri lest; hver når den har en | en termostat, uarmert |
| `humidifier` | `bool` på/av; `float` fuktighetssettpunkt i sitt område; `string` modus og handling; `float` romfuktighet | en luftfukter, uarmert |
| `water_heater` | `string` modus; `float` settpunkt i sitt område og gjeldende temperatur; `bool` strøm, kommandert og aldri lest | en varmtvannsbereder, uarmert |
| `alarm_control_panel` | `string`-tilstand, lest med formatets ord og tar handlingene `supported_features` lister, hver med egen nyttelast | et alarmpanel, uarmert |
| `vacuum` | `string`-tilstand, tar handlingene `supported_features` lister; `float` batteri; `string` viftehastighet, hver fra JSON-tilstanden | en støvsuger, uarmert |
| `lawn_mower` | `string` aktivitet; `bool` start klipping, pause og dokking, hver et trykk på eget topic, kommandert og aldri lest | en gressklipper, uarmert |
| `camera` | `string`, en kort hash av siste bilde; selve bildet holdes i minnet | et kamera |
| `image` | det samme, for et bilde på `image_topic`; eller `string`, URL-en fra `url_topic` | et bilde |

For et lys, et dekke, en ventil, en hendelse, en utløser og hver komponent i radene etter dem lages taggenes egne leseentiteter skjult: tingen er én entitet på skjermene. Hver tag armeres fortsatt for seg, så et dekke du stoler på posisjonen til og ikke åpne og lukke kan være akkurat det. Noe som får en verdi etter at det ble godtatt (en firmware som begynner å rapportere en lysstyrke) er en endring til gjennomgang, og når et menneske bruker den, får entiteten rollen sammen med taggen.

Tilstandsmeldingene til et lys med JSON-skjema slås sammen, fordi skjemaet sender det som endret seg: en melding med bare en lysstyrke, eller Zigbee2MQTTs `last_seen` alene, lar lyset stå på. Fargen, fargetemperaturen og effekten vises som attributter, ikke kommandert; på, av og lysstyrke er det, og Oppdaget-skjermen sier det for et lys som har farge. Fargetopicene til et lys med standardskjema er det samme: ikke lest, ikke kommandert, og listet. Malskjemaet støttes ikke og sier det. Vipping av et dekke leses eller kommanderes ikke, og sier det.

En enhetsutløser utløses bare på sin egen `payload`: Zigbee2MQTT legger hver handling fra en knapp på ett topic, og hver utløser er en av dem. En utløser uten `payload` utløses på alt på topicet sitt.

Viftehastigheten leses på konfigurasjonens eget `speed_range_min`..`speed_range_max` slik formatet gjør: det første trinnet over av er første prosent. Et nivå konfigurasjonen sier ikke kan skje (en ESPHome-vifte som kunngjør fire trinn og rapporterer 25) er en dårlig lesing som sier det, ikke 625 prosent.

Oppdaget-skjermen lister hvert topic en komponents kommandoer kan gå til: lysstyrke-topicet til et lys, hastighets-topicet til en vifte, i tillegg til hovedtopicet, og flagger hvert som er utenfor det komponenten leser, innenfor prefikset eller krevd av en annen enhet.

Settpunktområdet til en termostat eller en varmtvannsbereder er konfigurasjonens eget, og formatets standard når den ikke oppgir noe (7 til 35 °C for en termostat, 43,3 til 60 °C for en varmtvannsbereder, i °F når konfigurasjonen sier `temperature_unit: F`). Det er taggens område, så porten avviser 31 °C til en radiatorventil som topper ut på 30 før noe sendes. Modusene er konfigurasjonens liste, og en modus den ikke lister avvises på samme måte. Skjermene tilbyr akkurat disse, og når en brukt endring bringer en ny modus, får skjermene den også.

`code` til et alarmpanel er det en forbrukers skjerm ber om før den sender noe. I HotLoop er det portens sak hvem som kan armere eller avarmere, med taggen armert av et menneske og hver kommando revidert, så handlingen sendes slik konfigurasjonen sier. Et panel hvis kommandomal vil ha selve koden (`{{ code }}`) kan ikke kommanderes: HotLoop har ingen kode å sette inn, og Oppdaget-skjermen sier det. En støvsugers `send_command_topic` brukes ikke: en vilkårlig kommando er akkurat det HotLoop ikke kan kontrollere mot konfigurasjonen.

Bildet fra et camera eller image holdes i minnet, det siste per komponent, opptil 4 MiB, og serveres av `GET /api/entities/{entity_id}/image`. HotLoop beholder det bare hvis bytene er en JPEG, PNG, GIF eller WebP, uansett hva konfigurasjonens `content_type` påstår: en SVG er et dokument som kjører skript, og et "bilde" som kjører skript hos den som åpner dashbordet er et hull. Taggen inneholder en kort hash, så historikken sier når bildet endret seg uten en database full av JPEG-er. Et bilde kunngjort med URL er en lenke: HotLoop viser den, bare hvis den er http eller https, og henter den aldri, fordi en server som henter hvilken adresse en enhet enn oppgir kan pekes mot hva som helst på nettverket. Ingen av dem logges i loggboken; et kamera endres hvert sekund og tag_history har allerede hver endring.

Hver komponent formatet definerer blir til noe. En komponent det ikke definerer (en `kettle`) lagres med det den kunngjorde og listes som at den ikke lager noe. Formatet har ingen dato-, tid- eller datetime-komponent, så denne listen har heller ingen.

Entitets-id-er er HotLoops, laget av enheten og taggen. En konfigurasjons `object_id` og `default_entity_id` ignoreres: en konfigurasjon får ikke velge navn i HotLoops navnerom, og en fiendtlig ville valgt `switch.boiler_main`.

## Alt er upålitelig

Alt en konfigurasjon sier kom fra den som kan publisere på prefikset. Derfor:

- navn og tekst kappes og strippes for kontrolltegn, og skjermen setter dem på siden som tekst, aldri HTML;
- et topic med jokertegn, et `$`-topic, eller en `~` uten base å sette inn avvises med begrunnelse;
- en konfigurasjon over 64 KiB avvises; en enhet kan ikke ha mer enn 512 komponenter; ikke mer enn 256 enheter kan vente på en beslutning på én megler; konfigurasjonsmeldinger over 200 i sekundet forkastes og telles. Hver avvisning telles og vises på Oppdaget-skjermen, aldri forkastet uten et ord;
- HotLoop abonnerer på `<prefix>/+/+/config` og `<prefix>/+/+/+/config`, aldri `#` under prefikset, så et forvillet dypt topic ikke kan få den til å parse noe;
- en tilstandsnyttelast over 256 KiB, eller en som ikke er UTF-8, er en dårlig lesing.

Med anonyme tilkoblinger tillatt på den innebygde megleren kan hvem som helst på nettverket kunngjøre enheter og publisere til et hvilket som helst kommando-topic, og Oppdaget-skjermen sier det med rødt. Gi hver enhet sin egen pålogging laget i HotLoop, fra profilen, oppkalt etter topicet ([Den innebygde MQTT-megleren](/nb/iot/broker/)): da kan den kunngjøre seg selv og ingenting annet, og den kan ikke røre en annen enhets kommando-topic.

## Meglersiden

Oppdagelsen kjører på den innebygde megleren (se [den innebygde MQTT-megleren](/nb/iot/broker/)), på som standard så snart megleren er på. HotLoops egen klient logger inn med en pålogging laget ved hver oppstart og bare holdt i minnet: det er ingenting å konfigurere og ingenting i en sikkerhetskopi som kan lekke. Den publiserer én ting av eget, fødselen (`<prefix>/status` = `online`), som får publishere som lytter etter den til å kunngjøre seg på nytt.

| Variabel | Standard | <span class="sr-only">Details</span> |
|---|---|---|
| `HOTLOOP_BROKER_DISCOVERY` | `true` | Lytt etter kunngjøringer på den innebygde megleren |
| `HOTLOOP_BROKER_DISCOVERY_PREFIX` | `homeassistant` | Topic-prefikset de kommer under |

Én klient per megler, `hotloop-disc-embedded`, delt av lytteren og driveren til hver oppdaget enhet. En `--mcp-stdio`-hjelper åpner ingen: en andre klient med samme id ville sparket Gatewayens fra megleren hvert få sekund. Med flere replikaer på én database lytter bare den som holder oppdagelseslåsen.

## Andre meglere

Mange anlegg kjører allerede en megler: en Mosquitto som er UNS-en, den en Zigbee2MQTT-boks tok med seg. HotLoop lytter til de også. Innstillinger, MQTT, legg til en megler: en id (den navngir megleren i hver enhet som kom fra den), hvor den er, en pålogging og prefikset publisherne kunngjør under. Megleren trenger ikke være på, og HotLoop trenger ikke den innebygde for å gjøre dette.

Tre ting er annerledes enn HotLoops egen megler, med vilje:

- **Enheter venter i innboksen.** På en travel anleggsmegler betyr "dukker opp av seg selv" tre hundre enheter på skjermen før lunsj. Så en kunngjort enhet listes på Oppdaget-skjermen, uten at noe lages og uten lesing, til noen godtar den. Da lages den, den leser, og punktene kan armeres som alle andre. En megler du stoler nok på til å la dumpe alt hos deg kan stilles til "enheter dukker opp av seg selv".
- **Ingen last will.** HotLoop kobler til uten. En `offline`-will på en delt megler ville sagt til alle andre publishere der at noe forsvant, når det bare var HotLoop. Testene sjekker selve CONNECT-pakken, og trekker ut kontakten på forbindelsen for å bevise at ingenting sies.
- **ACL-ene er dens egne.** HotLoop kan ikke se hvem som publiserte hva på en annens megler, så det finnes ingen "kunngjort av pålogging" der, og hva hver pålogging kan røre er den meglerens sak. Gi HotLoop en pålogging som leser prefikset og topicene til enhetene du godtar, og skriver fødselen og kommando-topicene, ingenting annet. For Mosquitto:

  ```
  user hotloop
  topic read homeassistant/+/+/config
  topic read homeassistant/+/+/+/config
  topic write homeassistant/status
  # the devices you accept, for example a Zigbee2MQTT bridge:
  topic read zigbee2mqtt/#
  topic write zigbee2mqtt/+/set
  ```

**Bare lytting** er for en megler HotLoop ikke skal snakke på: produksjons-UNS-en, en annens anlegg. HotLoop publiserer aldri noe der. Ingen fødsel, ingen kommando. Det er sesjonens regel, ikke skjermens: publiseringen avvises, og skrive-porten avviser hver kommando til enhetene med "the broker plant-uns is listen-only", prøvekjøring inkludert, selv på en enhet noen godtok og et punkt noen armerte. Påloggingen trenger ikke noe annet enn `topic read`-linjer.

Passordet forsegles med enhetspåloggingsnøkkelen (`HOTLOOP_SECRET_KEY_FILE`), som en UniFi-konsolls, og kommer aldri ut igjen av API-et. Uten nøkkel avvises en megler med passord, ikke lagret i klartekst. En sikkerhetskopi bærer det forseglet og gjenopprettes etter samme regel som en enhets påloggingsdata ([Sikkerhetskopiering og gjenoppretting](/nb/iot/backup/)). En megler der passordet ikke kan åpnes listes, ikke tilkoblet, og sier hvorfor.

Endre en megler, og lytteren og hver enhet fra den kobler til på nytt med de nye innstillingene. Slå en av, og enhetene blir, leser dårlig og sier at megleren deres ikke kjører her. Å fjerne en tar innboksen med seg, og avvises, med navn på dem, så lenge enheter noen godtok fra den fortsatt finnes.

## På et Edge Relay

Et Edge Relay oppdager også, med samme kode, men har ingen database å holde en beslutning i og ingen skjerm å ta en på. Så det tar det det hører, leser det og videresender det over Sparkplug, og ingenting det finner kan armeres: taggene er skrivebeskyttede som alle oppdagede tagger, enhetene godtas aldri, og releet har ingen skrivevei i det hele tatt. Navngi meglerne i enhetsfilen; se [Edge Relay-referansen](/nb/edge-relay/reference/#discovery-41810). En enhet du kan kommandere kommer dit den andre veien: godtatt og armert på en Gateway, i en fil den pusher. Det glemmer det det hørte når det stopper, og hører det på nytt fra megleren.

## Omstarter og avspillinger

Godtatte enheter kjører fra enhetsradene sine. HotLoop trenger ikke en eneste retained melding for å komme opp igjen med anlegget.

Den innebygde megleren beholder ingenting over en omstart, så hver konfigurasjon "mangler" etterpå. **En manglende konfigurasjon er ikke en tilbaketrekking**: bare en eksplisitt tom er det. Alt annet ville trukket tilbake hele anlegget hver gang boksen starter på nytt. Til en enhet sender neste tilstand leser entitetene ukjent, aldri verdien fra før omstarten utkledd som gjeldende.

En megler som spiller av hundrevis av retained konfigurasjoner på én gang er én batch: to sekunder stillhet, ett gjennomløp, én omlasting. En avspilling av det som allerede er registrert endrer ingenting og laster ingenting på nytt.

## Sikkerhetskopier

`mqtt_devices` (hvem som godtok og ignorerte hva), `mqtt_configs` (hver konfigurasjon slik den kom, byte for byte) og `mqtt_discovered` (hver komponent, normalisert) er i hver sikkerhetskopi. Beslutningene er den delen ingen enhet kan kunngjøre tilbake.

## API-et

Under `/api/discovery`. Se [HTTP-API-et](/nb/iot/api/#mqtt-oppdagelse).

## Funnet på nettverket

Den samme skjermen lister enheter HotLoop hørte på anleggsnettverket over mDNS, SSDP og DHCP, avgjort på samme måte. Se [Nettverksoppdagelse](/nb/iot/network-discovery/).
