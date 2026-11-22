---
title: "Skrivegrinda: trygg skriving til utstyr"
description: "Hver skriving, fra en skjerm, API-et, en regel, et skript, en oppskrift eller en agent, går gjennom én funksjon. Hva den sjekker, og hva avvisningene svarer."
sidebar:
  label: "Skrivegrinda"
---

Dette kan flytte maskineri. Her er derfor nøyaktig hva som står mellom en forespørsel og en enhet, i den rekkefølgen koden kjører det.

Hver verdi på vei til en enhet går gjennom **én funksjon som ikke kan omgås**: et klikk på en skjerm, `POST /api/write`, et kall til en entitetstjeneste, en automasjon, et skript, en oppskrift, en agent over MCP. Regelverket bor der og bare der, fordi en sjekk som er kopiert til seks steder, er en sjekk noen glemmer å legge til på det sjuende, og det sjuende er alltid det som skriver til den kjørende pressen. En test får bygget til å feile hvis noe i kjøretiden kan nå en enhets skriving uten å gå gjennom grinda, og den beviser at den kan feile ved å plante fire typer omgåelse i en kopi av pakken og fange hver eneste.

Vil du kjenne det heller enn å lese det? [hotloop.io har en interaktiv versjon](https://hotloop.io/gateway/#the-gate). Slå bryterne av og på, send et settpunkt og se nøyaktig hvor det blir stoppet.

## Sjekkene, i rekkefølge

1. **Den som kaller, har lov til å skrive.** Dette skjer ved API-ets dør, før grinda. En innlogget bruker trenger `values.write` for å kalle `POST /api/write`: operatører og administratorer har den, lesere har den ikke, og uten den svarer API-et 403. En agents dør er MCP-bearer-tokenet, og uten det får den en 401 og ser aldri verktøylisten. Uansett hører grinda aldri et ord, så det står ikke i skriverevisjonen. (Et kall til en entitetstjeneste fungerer annerledes, [nedenfor](#hver-dør-samme-grind).)
2. **Skriving er på.** `safety.allowWrites`, hovedbryteren. Av som standard siden 4.4.0.
3. **Agentskriving er på.** `safety.allowMcpWrites`, sjekkes bare når forespørselen kom over MCP. Den snevrer inn hovedbryteren og kan aldri gå utenom den: med skriving på og denne av kan en operatør styre en tag, men en agent kan ikke. Settes den på mens `safety.allowWrites` er av, nekter Gateway å starte, i stedet for å la deg gjette hvilken som gjelder.
4. **Taggen er armert.** Hver tag er skrivebeskyttet til noen merker den `writable`, én om gangen og med vilje. Et nettleserimport av 4 000 tagger armerer ingen av dem. En tag som ikke finnes, avvises også her.
5. **Verdien er innenfor området.** Når taggen har et område og verdien er et tall, blir en verdi utenfor **avvist, aldri avkortet**. Den som skrev 500 på en tag som topper ut på 400, gjorde en feil og må få høre det. Å sende 400 i stillhet er å gjøre noe ingen ba om, og ingen får vite det.
6. **Kallerens egen sjekk går gjennom.** En entitet legger til det bare den vet: et talls steg og snevrere område, en teksts mønster og lengde, valgene i en liste, en reguleringssløyfes utgang, avvist med mindre sløyfen står i manuell akkurat nå, at entiteten er deaktivert eller slettet midt i kallet. Den kjører inne i grinda, etter taggens regelverk og område slik at en operatør alltid hører om taggen først, og før revisjonsraden slik at en entitetsavvisning registreres nøyaktig som en tag-avvisning. Den kan bare avvise. Den kan ikke endre verdien eller slippe gjennom noe grinda ville stoppet.
7. **Enheten kjører.** HotLoop har en kjørende worker for den. En deaktivert enhet, eller en som aldri startet, avvises med `the device is not connected` i stedet for at en verdi kastes mot ingenting.

**Først da åpnes revisjonsraden, og først da går verdien ut.** Hvis raden ikke kan skrives, sendes ikke skrivingen i det hele tatt. En skriving som ikke kan revideres, er en ingen kan stå til ansvar for etterpå, og på utstyr som beveger seg er ikke det en handel verdt å gjøre. Raden ferdigstilles med resultat og forsinkelse i en kontekst løsrevet fra forespørselen, slik at en skriving som går ut på tid eller blir avbrutt, likevel registrerer hva som skjedde.

Hver avvisning fra sjekk 2 og utover revideres som en avvisning: en rad med aktøren, kilden, verdien som ble bedt om, verdien den ville erstattet og `refused:` med årsaken, pluss en advarsel i systemloggen. Noen som gjentatte ganger prøver å styre en tag de ikke har lov til, er usynlige hvis det ikke skrives ned, og en ingeniør skal kunne finne det i etterkant. Sjekk 1 står ikke i skriverevisjonen, fordi grinda aldri så den.

### Hvorfor den rekkefølgen

Regelverket kjører før revisjonsraden åpnes, så en avvisning registreres som en avvisning og ikke som et forsøk som tilfeldigvis feilet. Revisjonsraden åpnes før verdien når ledningen, så en skriving som henger, eller tar prosessen med seg i fallet, likevel etterlot bevis på at den ble forsøkt. På et produksjonsgulv er "vi vet ikke om den kommandoen gikk ut" det verste svaret som finnes.

### Én ting sjekk 7 ikke fanger opp

Sjekk 7 spør om enheten har en worker, ikke om økten dens er oppe akkurat nå. En enhet som har falt av nettverket og kobler til på nytt, slipper gjennom. Revisjonsraden åpnes, driveren har ingen økt, og skrivingen feiler som `the device is not connected`, registrert som et mislykket forsøk og ikke som en avvisning. Ingenting når enheten uansett. [Prøvekjøringen](#spør-før-du-sender-prøvekjøringen) sjekker også økten, og sier det på forhånd.

## Hva hver avvisning svarer

Statuskoden sier hvem sitt problem det er, fordi det er slik en operatør leser den.

| Hva som skjedde | Feilen sier | HTTP |
|---|---|---|
| Ingen tillatelse, ved døren | `<user> does not have the "values.write" permission` | 403 |
| Skriving er av | `writes are disabled on this deployment` | 403 |
| Agentskriving er av | `writes from MCP clients are disabled on this deployment` | 403 |
| Taggen er ikke armert | `this tag is not marked writable` | 403 |
| Entiteten er deaktivert | `the entity is disabled` | 403 |
| Taggen finnes ikke | taggen, og `not found` | 404 |
| Entiteten forsvant midt i kallet, eller er ikke i en tilstand som tillater det (en sløyfe som ikke står i manuell) | hva som endret seg | 409 |
| Verdien er utenfor taggens område | `value is outside the tag's configured range` | 422 |
| Entiteten godtar ikke verdien (steg, mønster, valg, eget område) | `the value is not one this entity accepts`, og hvorfor | 422 |
| Enheten er ikke tilkoblet | `the device is not connected` | 503 |
| Enheten svarte og sa nei | enhetens egne ord | 502 |
| Skrivingen kunne ikke revideres, eller noe annet API-et ikke kan plassere | `internal error (ref …)`, med detaljene i serverloggen under den referansen | 500 |

Alt API-et ikke kan plassere, er en 500. Det pleide å være en 400, noe som betydde at et databasebrudd fortalte en operatør at de hadde skrevet noe feil, og de lette etter en skrivefeil som ikke fantes.

Over MCP finnes det ingen statuskoder. En avvisning kommer tilbake som et verktøyresultat merket `isError`, med grindas egne ord:

```
> write_tag tag=press-01/Zone1_Temp value=99 reason="testing"
write refused: press-01/Zone1_Temp: this tag is not marked writable
```

Det er et svar, ikke en transportfeil. Kallet ble forstått og bevisst avvist, og å prøve igjen gir samme svar.

## Spør før du sender: prøvekjøringen

Grinda har et andre inngangspunkt som spør uten å gjøre noe. Det kjører de samme sjekkene i samme rekkefølge og gir samme feiltekst for en avvisning. Det åpner ingen revisjonsrad, utløser ingen hendelse, teller ingenting og når aldri enheten. Det går til og med ett steg lenger enn den ekte skrivingen: en enhet der workeren kjører men økten er nede, meldes som ikke tilkoblet, i stedet for "dette ville gått ut".

Hvor du får det:

- **Kall til entitetstjenester**: `POST /api/services/{domain}/{service}?dry_run=true`. Det svarer 200 med dommen: hver skriving det ville gjort som `would_write`, eller den første som ville blitt avvist som `not_sent`, med årsaken ord for ord. En forespørsel som ikke engang kunne planlegges (ingen slik entitet, en tjeneste domenet ikke tar, dårlige data) svarer med samme status som det ekte kallet. `dry_run` tar `true` eller `false` og ingenting annet, og `yes` gir en 400, fordi en gjetning feil vei gjør et spørsmål til en kommando.
- **Kommandolinjen** spør mens du skriver og viser "Would be refused: ..." før noen bekrefter.
- **Skript**, nytt i 4.17.0: `POST /api/scripts/{id}/run?dry_run=true`, **Check first** i kjørepanelet, eller MCPs `run_script` med `dryRun`. Hvert steg gås gjennom mot anlegget slik det er akkurat nå, og den første skrivingen som ville blitt avvist, avslutter gjennomgangen i grindas ord. Se [Skript](/nb/iot/scripts/).
- **Oppskrifter**, nytt i 4.17.0: hvert mål settes gjennom disse sjekkene før den første verdien går ut, og én dårlig verdi avviser hele oppskriften uten at noe skrives. `POST /api/recipes/{id}/validate` og MCPs `validate_recipe` spør uten å bruke. Se [Oppskrifter](/nb/iot/recipes/).
- **Blueprints**, nytt i 4.17.0: **Check first** viser hva regelen ville gjort hvis den utløstes akkurat nå, hver skriving satt gjennom disse sjekkene, før regelen finnes. Se [Blueprints](/nb/iot/blueprints/).

En ren prøvekjøring er et råd, ikke et løfte. Grinda avgjør fortsatt ved den ekte skrivingen, fordi en enhet kan falle ut, eller noen kan avarmere en tag, mellom spørsmålet og kommandoen din.

:::caution[Fortsatt på 4.16.0? Kommandolinjen kan sluke et Set]
I 4.16.0 lander prøvekjøringens dom omtrent et kvart sekund etter at du slutter å skrive, akkurat når musen er på vei mot Set, og kommandolinjen vokser eller krymper under den. Set flytter seg omtrent 30 px, så klikket treffer tomrom, eller bakgrunnen og lukker kommandolinjen. Operatøren ser den lukkes, tror settpunktet gikk ut, og ingenting ble skrevet. Rettet i 4.17.0: dommen står ved siden av knappene og ingenting flytter seg. Til du [oppgraderer](/nb/gateway/upgrading/), sjekk at verdien faktisk endret seg etter at du trykket Set.
:::

## Hver dør, samme grind

- **Skjermene og `POST /api/write`.** Aktøren er det innloggede brukernavnet, ikke en header hvem som helst kunne satt.
- **Entitetstjenester**, `POST /api/services/{domain}/{service}`. `switch.turn_on` på `switch.press_01_pump` er en tag-skriving gjennom denne grinda, revidert mot entiteten med entity_id, tjenesten og en kall-id. Et knappetrykk er to skrivinger under én kall-id. En bruker uten `values.write` stoppes ikke ved døren her: den manglende tillatelsen overleveres til grinda som kallerens egen sjekk, så et nektet entitetskall revideres mot entiteten, med verdien som ble bedt om, som enhver annen avvisning, og svarer fortsatt 403.
- **Automasjoner** skriver som `automation:<rule-id>`. En regel får ikke mer privilegium enn et menneske. Se [Automasjoner](/nb/iot/automations/).
- **Skript**, nytt i 4.17.0, skriver som `script:<id>` og beholder kilden til den som startet dem, så et skript en agent setter i gang, treffer agentbryteren akkurat som agentens eget `write_tag`.
- **Oppskrifter**, nytt i 4.17.0, skriver hvert mål under én kall-id, så `GET /api/writes?call=<id>` er hele anvendelsen i revisjonssporet.
- **Agenter** skriver som `mcp:<client name>`. `write_tag` og `call_service` går gjennom de samme sjekkene som en operatør, og begge nekter å kjøre uten en oppgitt grunn, som havner i systemloggen ved siden av skrivingen. En revisjonsrad ingen kan forklare seks måneder senere, er bare et tidsstempel med dårlig samvittighet. `trigger_automation` nekter helt mens agentskriving er av, det samme gjør `run_script` og `apply_recipe`, fordi en regel, et skript eller en oppskrift kan styre utstyr og ellers ville vært en vei utenom bryteren. Se [Model Context Protocol](/nb/iot/mcp/).

## Hvorfor skriving er av som standard

Før 4.4.0 var `safety.allowWrites` og `safety.allowMcpWrites` `true` som standard. Nå er de `false`. En tag var alltid skrivebeskyttet til den ble armert, men en fersk installasjon bør ikke være ett `writable`-flagg unna å styre utstyr før noen har sett på den.

Oppå grinda gjør `safety.confirmWrites` (på som standard) at skjermene ber om bekreftelse før de sender noe. Det er en melding i nettleseren, ikke en sjekk i grinda, og det er den ene sikkerhetsinnstillingen du kan endre fra Innstillinger-skjermen. `safety.allowWrites` og `safety.allowMcpWrites` er skrivebeskyttet der med vilje: hovedkontrollen over om denne prosessen kan styre utstyr hører ikke hjemme bak den samme nettleserøkten som utsteder skrivingene.

## Slå på skriving, med vilje

1. Legg til enheten og oppdag taggene dens der protokollen kan liste dem. Modbus og S7comm kan ikke oppregne sine egne punkter, så deklarer dem fra enhetens dokumentasjon.
2. Merk tagger som skrivbare én om gangen, og bare de du mener.
3. Sett `safety.allowWrites: true` i verdifilen din og kjør `helm upgrade`. Til du gjør det, kan ingenting i trinn 1 og 2 flytte en ventil.
4. Bare hvis agenter også skal styre utstyr, sett `safety.allowMcpWrites: true`.

## Hva den ikke gjør

Applikasjonen kan ikke håndheve alt, og det er bedre å si det enn å la deg anta.

- **Det er ikke en sperre.** En utkobling som beskytter folk eller anlegget hører hjemme i PLS-en, fastkoblet der den må være, ikke i noe som kjører på et nettverk.
- **Den overvåker ikke brokeren din.** Hvis du sender nodekommandoer til edge relays over MQTT, må brokerens egen tilgangskontroll begrense hvem som kan publisere dem til Gateways legitimasjon.
- **OPC UA-serveren kan ikke skrive i det hele tatt.** Den er skrivebeskyttet, uten skrivehåndterer og uten innstilling som legger til en, så SCADA-en som leser den, kan ikke styre noe gjennom den.
