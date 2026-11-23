---
title: "Oppskrifter"
description: "Settpunktene for en produktkvalitet brukt i ett grep: kontrollert som helhet, avvist som helhet, skrevet i rekkefølge og lest tilbake fra enheten."
---

En oppskrift er et sett med verdier som går ut til anlegget sammen. Sonetemperaturene, linjehastigheten og dyseåpningen for kvalitet A. Omstillingen til 500 ml-flasken. Nattsenkingen. Hvert anlegg har dette, og hvert anlegg har et laminert ark et sted med tallene på og en operatør som taster dem inn én og én, og hvert anlegg har historien om natta da ett av dem ble tastet feil.

Så tallene bor her i stedet, og de går ut i ett grep: kontrollert som helhet først, sendt i rekkefølge, lest tilbake fra enheten etterpå, hvert eneste ett på protokollen. Hver oppskrift er også en entitet, `scene.<id>`. Den er laget for utstyr som kan skade noen, og det er grunnen til at det meste av denne siden handler om hva som skjer når noe går galt.

## Slik ser en ut

```json
{
  "id": "grade_a",
  "name": "Grade A",
  "description": "The 2pm run. Die at 210, line at whatever the order says.",
  "equipment_id": 7,
  "apply_permission": "recipes.apply",
  "params": [
    {"name": "speed", "label": "Line speed", "type": "number", "min": 0, "max": 400, "step": 10, "unit": "rpm", "required": true}
  ],
  "precondition": "states['input_boolean.line_ready'] == 'on'",
  "targets": [
    {"entity_id": "loop.line_02_die_tic", "service": "set_mode", "data": {"mode": "auto"}},
    {"entity_id": "loop.line_02_die_tic", "service": "set_setpoint", "data": {"value": 210}},
    {"entity_id": "number.line_02_speed", "service": "set_value", "data_expressions": {"value": "vars.speed"}},
    {"entity_id": "switch.line_02_heater", "service": "turn_on"},
    {"entity_id": "input_select.product", "service": "select_option", "data": {"option": "Grade A"}}
  ],
  "verify_sec": 10
}
```

- **`id`** er små bokstaver, sifre og understreker, og begynner med en bokstav. Det er objekt-id-en til entiteten, `scene.grade_a`, og den endres aldri.
- **`equipment_id`** er noden i utstyrstreet som oppskriften hører til, for å finne den. Oppskrifter-skjermen grupperer etter den. La den utgå for en oppskrift for hele anlegget.
- **`params`** er det en anvendelse tar imot: de samme typede feltene som et skript har (`model.Field`: `number` med `min`, `max`, `step` og `unit`, `text`, `boolean`, `select`, `entity`, `duration`, `alarm`, `tag`). Et mål leser ett som `vars.<name>` i en oppføring i `data_expressions`.
- **`precondition`** er et uttrykk i automasjonsspråket som må være sant for at oppskriften skal starte. La det utgå, så finnes det ingen.
- **`targets`** er verdiene, **i den rekkefølgen de går ut**. Hver er en entitet, tjenesten som setter den, og tjenestens data, som en verdi (`data`) eller beregnet fra parameterne (`data_expressions`). Opptil 200.
- **`verify_sec`** er hvor lang tid hver skrevet verdi får på å dukke opp i en avlesning fra enheten. 1 til 600, standard 10.

### Hva et mål kan være

En oppskrift **setter verdier**. Tjenestene den tar, er de som lar utstyret holde en verdi:

| Domene | Tjenester |
|---|---|
| `switch`, `input_boolean` | `turn_on`, `turn_off` |
| `number`, `input_number`, `input_counter` | `set_value` |
| `text`, `input_text` | `set_value` |
| `select`, `input_select` | `select_option` |
| `valve` | `set_position` |
| `motor` | `set_speed` |
| `loop` | `set_setpoint`, `set_mode` |

Et knappetrykk, en motorstart, en tellernullstilling, et ventilstopp: avvises ved lagring. Det er handlinger, ikke verdier, og de hører hjemme i et [skript](/nb/iot/scripts/). «Bruk kvalitet A» som trykker på en nullstillingsknapp hver gang noen bruker den, er ikke det noen mener med en oppskrift, og dagen det skjer midt i en kjøring, er dagen du finner det ut. Toggle avvises også: en oppskrift som snur en bryter, gjør det motsatte annenhver gang.

Et måls entitet må finnes når du lagrer, uttrykkene må kompilere, og den samme entiteten kan ikke settes to ganger av den samme tjenesten (to verdier for én innstilling, og hvilken som vinner ville avhenge av en rekkefølge ingen leser). En sløyfes modus og settpunkt er to innstillinger og begge kan settes; sett modusen først, for et settpunkt for auto betyr ingenting for en sløyfe som står i manuell.

## Bruke én

Fra Oppskrifter-skjermen, oppskriftens flis på Entiteter-skjermen, et `apply_recipe`-trinn i en regel eller et skript, MCPs `apply_recipe`, eller `POST /api/services/scene/turn_on`. Hver av dem gjør nøyaktig dette:

### 1. Kontrollert som helhet, avvist som helhet

Før én eneste verdi går noe sted:

- Parameterne kontrolleres mot feltene sine. **En verdi flyttes aldri for å passe.** 450 i et felt med maksimum 400 avvises, det kuttes ikke til
  400. `"250"` for et tall avvises, det tolkes ikke. 255 på et steg på 10 avvises, det rundes ikke. Tallet som går til anlegget, er nøyaktig det noen tastet inn, ellers går ingenting.
- Oppskriftens egen rettighet, når den nevner én (nedenfor), og MCPs skrivebrytere, for en agent.
- Forutsetningen evalueres mot anlegget slik det er nå.
- Hvert datauttrykk evalueres. Ett som feiler, avviser oppskriften; et mål sendes aldri uten verdien det skulle ha.
- Ingenting annet i denne prosessen kan skrive til en av entitetene (nedenfor).
- **Hvert mål legges fram for skriveportens egne kontroller**, de samme som skrivingen vil møte: skriving på, taggen skrivbar, verdien innenfor taggens område, entiteten aktivert og fornøyd med verdien (steget, alternativene, en sløyfe i manuell for utgangen), enheten tilkoblet. `Services.Check`, som for en tag er `runtime.Manager.CheckWrite`. Ingenting skrives eller revideres.

**Hvis noe som helst feiler, avvises hele oppskriften og ingenting skrives.** Ikke de ti første målene og så et avslag. Ingenting. Og du får alle årsakene, ikke bare den første: en operatør som får vite om ett problem, retter det og får så vite om det neste, og en oppskrift med førti mål bør rettes i ett grep. Hvert mål sier hva det var: `would_write`, `refused` med portens egne ord, eller `not_sent`.

### 2. Skrevet i rekkefølge, én kall-id, aldri rullet tilbake

Så går målene ut i rekkefølge, hvert gjennom `Services.Call` og dermed gjennom `runtime.Manager.Write`, den ene skriveporten. Det finnes ingen bakdør. Hver skriving bærer anvendelsens **kall-id**, så hele anvendelsen er `GET /api/writes?call=<id>`, i revisjonssporet, ved siden av alle andre skrivinger anlegget noen gang har tatt imot.

En kontroll kan bestå og skrivingen likevel feile et øyeblikk senere. En PLS svarer på en skriving med et unntak. Noen sparker ut en kabel. Noen avarmerer en tag mellom kontrollen og skrivingen. **Det første målet som ikke går gjennom, stopper anvendelsen.** De etter det sendes ikke, og står som `skipped`.

**Ingenting som allerede er skrevet, angres.** Dette er med vilje, og det er regelen hver HotLoop-skriving følger. Å angre er i seg selv en skriving: gjort uten at noen ber om det, til utstyr som allerede har beveget seg, basert på det vi tror verdien var før, i det nøyaktige øyeblikket noe nettopp har bevist at anlegget ikke oppfører seg slik vi forventet. Slik blir en halvt anvendt oppskrift til en helt forvirret linje. Å avgjøre hva man skal gjøre med en halvt anvendt oppskrift er operatørens jobb, og de får nøyaktig den informasjonen de trenger til det:

```text
PARTIAL v3: 2 of 5 written before one failed, nothing undone
  1. set_mode loop.line_02_die_tic: written, verified
  2. set_setpoint loop.line_02_die_tic: written, verified
  3. set_value number.line_02_speed: failed: the device answered the write with an exception
  4. turn_on switch.line_02_heater: skipped
  5. select_option input_select.product: skipped
```

Et mål er `written`, `failed` (det gikk ut og enheten sa nei, eller sa ingenting, så det er ikke kjent om det tok), `not_sent` (porten avviste det i siste øyeblikk) eller `skipped`. Anvendelsen er `applied` (hvert mål skrevet), `partial` (noen var det) eller `failed` (det første var ikke det).

Oppskrifter-skjermen tilbyr da **Bruk de gjenstående målene**. Det er en ny anvendelse, av målene som ikke ble skrevet, med samme versjon og parametere, kontrollert som helhet på nytt først, revidert under en egen kall-id, med `application:<id>` som overordnet så de to finnes sammen. Den er aldri automatisk. Noen ser på hva som skjedde, retter det som stoppet den, og trykker på knappen.

### 3. Lest tilbake

Skrevet er ikke det samme som tatt imot. En PLS kan godta en skriving og dens egen logikk overskrive den i neste skann. Et skalert register kan ta 12,34 og holde 12,3. Så etter den siste skrivingen leses hver skrevne verdi tilbake:

- for et mål på en enhet, bare fra en avlesning **tatt etter skrivingen**, så hurtigbufferen som husker hva enheten sa før, ikke kan bekrefte noe;
- fra entitetens tilstand eller, for en ventil, en motor og en sløyfe, attributtet tjenesten setter (`current_position`, `speed`, `setpoint`, `mode`);
- et tall innenfor en milliondel av seg selv (et flyttallsregister gir 0,1 tilbake som 0,10000000149, som er det samme settpunktet), alt annet nøyaktig.

Hvert skrevne mål er **`verified`** når det leses tilbake, eller **`unconfirmed`** hvis det ikke har gjort det innen `verify_sec`, med det som ble lest i stedet:

```text
  3. set_value number.line_02_speed: written, unconfirmed (not confirmed within 10s: read back 240, not 250)
```

Ubekreftet vises **gult**, aldri grønt, på Oppskrifter-skjermen, og er en advarsel i loggboken og systemloggen. Det er ikke en feil: verdien gikk ut og enheten godtok den, og anvendelsen er fortsatt `applied`. Det er et flagg som sier gå og se, for det kan hende den ikke tok. En hjelper holder sin egen verdi, så et hjelpermål verifiseres rett fra den.

Svaret kommer tilbake når tilbakelesingen er ferdig, så å bruke en oppskrift tar opptil `verify_sec`.

## Overlapping

To oppskrifter som fletter skrivingene sine til det samme settpunktet, lar det stå på den som landet sist, som ikke er noens oppskrift. Så mens en anvendelse skriver og leser tilbake, holder den hver entitet den har som mål, og en annen anvendelse som har en av dem som mål, avvises, `409`, med hvilken oppskrift som er i veien. Vent på den, og bruk så.

Dette holdes i prosessen: en anvendelse fra Gatewayen og en fra en `--mcp-stdio`-prosess ved siden av holder ikke hverandre igjen. Kjør én skriver, eller hold agentens oppskrifter og operatørenes på ulikt utstyr.

## Versjoner

En oppskrifts navn, beskrivelse, utstyrsnode og rettighet tilhører oppskriften og endres på stedet. **Det den skriver, er en versjon, og en versjon endres aldri.** Å lagre andre mål, andre parametere, en annen forutsetning eller en annen `verify_sec` lagrer neste versjon og gjør den til den gjeldende. Versjon 3 er nøyaktig det den var dagen den ble lagret, for alltid, og hver anvendelse registrerer versjonen og parameterne den kjørte med. Hva som gikk ut til anlegget forrige tirsdag, kan alltid besvares.

- Å endre bare navnet, eller bare notatet, lager ingen versjon.
- En lagring gjort mot en versjon noen andre har erstattet siden, avvises, `409`, i stedet for å kaste endringen deres i stillhet. Redigeringsprogrammet sender versjonen det redigerte.
- En eldre versjon kan brukes med vilje: velg den i anvendelsesskuffen, eller `"version": 2`. Anvendelsen sier at det var versjon 2.
- Versjoner-skuffen viser hver versjon med hvem som lagret den, notatet deres og hva som endret seg fra den før, mål for mål.

Å slette en oppskrift sletter versjonene. Anvendelsene beholdes: de er det som ble sendt til anlegget, og den historikken overlever oppskriften.

## Ta opp én

Ingen skriver en oppskrift med førti mål for hånd når linja allerede kjører kvalitet A. **Ta opp** tar entitetene du velger og lager et utkast til en oppskrift som setter hver tilbake til det den holder akkurat nå, i den rekkefølgen du valgte dem: et talls verdi, en brytes av eller på, en velgers alternativ, en ventils posisjon, en motors hastighet, en sløyfes modus og så settpunktet. Du gir den et navn, trimmer den, gjør tallene som endres per ordre til parametere, og lagrer.

En entitet der verdien ikke er kjent, eller ikke er til å stole på, **avvises, ikke opptatt**: en avlesning med annen kvalitet enn god, `unknown`, `unavailable`, en deaktivert entitet. En oppskrift bygget av en dårlig avlesning skriver den dårlige avlesningen tilbake til anlegget, hver gang noen bruker den.

## Hvem kan bruke én

Operatører bruker oppskrifter (`recipes.apply`); administratorer skriver dem (`recipes.write`); alle leser dem (`recipes.read`). Å laste kvalitet A er det operatøren er der for. Å bestemme hva kvalitet A er, er en ingeniørs avgjørelse.

En oppskrift kan nevne en snevrere rettighet av sin egen: `"apply_permission": "recipes.apply.night_setback"`. Da krever bruken også den, som operatørrollen ikke har. Gi den til dem som kan bruke den oppskriften gjennom deres egen rettighetsliste:

```json
["recipes.read", "recipes.apply", "recipes.apply.night_setback"]
```

`recipes.apply.*` gir alle oppskrifters, og en administrator har alt. En bruker uten den avvises, og **avslaget står på protokollen**: en avvist anvendelse i oppskriftens historikk, med navnet deres på, som alle andre. Det samme gjelder gjennom scene-entiteten.

En agent har ingen brukers rettigheter, så **en agent bruker aldri en oppskrift som nevner en egen rettighet**. Den kan lese den og spørre om den ville blitt brukt; svaret sier hvorfor ikke.

## Forutsetningen

```json
"precondition": "states['input_boolean.line_ready'] == 'on' and float(states['sensor.line_02_die_temp']) < 250"
```

Automasjonsspråket, evaluert mot anlegget slik det er når noen trykker Bruk, med parameterne som `vars`. Usant avviser oppskriften og sier det. Det er en vakt mot å bruke riktige tall i feil øyeblikk, ikke en forriglingskrets: en forriglingskrets bor i PLS-en, der den fortsatt virker når nettverket ikke gjør det.

## Fra en regel, et skript eller en agent

En regel eller et skript bruker én med et `apply_recipe`-trinn (se [Automasjoner](/nb/iot/automations/)):

```json
{"type": "apply_recipe", "params": {"recipeId": "grade_a", "params": {"speed": 250}}}
```

Den brukes som regelen, `automation:<id>`, eller skriptet, `script:<id>`, med kjøringens kilde på hver skriving, og anvendelsens overordnede er kjøringen. Trinnet feiler med mindre hvert mål ble skrevet; en ubekreftet verdi får det ikke til å feile, og sporet sier `NOT confirmed by read-back`. Et skripts prøvekjøring kontrollerer også oppskriften.

Over MCP viser `list_recipes` hver oppskrift med målene og parameterne, `validate_recipe` spør om en ville blitt brukt akkurat nå, og `apply_recipe` bruker den, med en **påkrevd** begrunnelse. En agents skrivinger bærer kilden `mcp`, så porten gjelder for hver av dem, og med skriving slått av (`HOTLOOP_ALLOW_WRITES`) avvises `apply_recipe` før noe er kontrollert. Se [MCP](/nb/iot/mcp/#oppskrifter).

## Entiteten

Hver oppskrift er en `scene`-entitet, `scene.<id>`. Tilstanden er når den sist ble brukt (en anvendelse som skrev noe), som et tidsstempel, og `unknown` til den noen gang er det. Attributtene sier hvordan den nyeste anvendelsen gikk: `last_result`, `last_version`, `last_applied_by`, `last_application`, og `unconfirmed` når så mange verdier i en anvendt ikke ble lest tilbake. Flisen har en Bruk-knapp. `scene.turn_on` bruker den, med `params` og `version` i dataene. En regel kan utløses av tilstanden, som beveger seg én gang per anvendelse som skrev noe.

Å slette en oppskrift gjør entiteten foreldreløs, slik det å slette et skript gjør.

## Protokollen

Hver anvendelse, avviste inkludert, er en rad i `recipe_applications`: oppskriften, versjonen, parameterne, hvem, hvorfra, hvorfor, kall-id-en, hva som ble av hvert mål og om det ble lest tilbake. Den åpnes før den første skrivingen og ferdigstilles etter tilbakelesingen, så en der prosessen dør midt i, sier likevel at den startet. Gatewayens neste start markerer den `failed`, `interrupted by restart`, med peker til kall-id-en i skriverevisjonen. Ingenting gjenopptar den.

Hver anvendelse er én linje i systemloggen under scenen, og én oppføring i [loggboken](/nb/iot/logbook/), av typen `recipe`, ved siden av skrivingene den gjorde. En oppskrifts historikk beholder de nyeste 5000 anvendelsene.

## Mer enn én prosess

Hver endring av en oppskrift og hver anvendelse kunngjøres til hver prosess på databasen, så en oppskrift lagret på én pod er den den andre bruker, og en anvendelse en `--mcp-stdio`-prosess gjør, flytter Gatewayens scene-entitet.

## Sikkerhetskopier

Oppskrifter, hver versjon og hver anvendelse er med i sikkerhetskopier, og kommer tilbake nøyaktig som de var. En anvendelse sikkerhetskopien tok midt i, kommer tilbake som `applying` og markeres `failed` ved første start, som et krasj. Se [Sikkerhetskopi og gjenoppretting](/nb/iot/backup/).

## API-et

[HTTP-API-et](/nb/iot/api/#oppskrifter) har hver rute. Kort fortalt:

| <span class="sr-only">Detaljer</span> | <span class="sr-only">Detaljer</span> |
|---|---|
| `GET /api/recipes` | hver oppskrift, dens gjeldende innhold og siste anvendelse |
| `POST /api/recipes` | opprett én, som versjon 1 |
| `POST /api/recipes/capture` | et utkast fra det entitetene holder nå |
| `PUT /api/recipes/{id}` | lagre; nytt innhold er en ny versjon |
| `GET /api/recipes/{id}/versions` | hver versjon, som lagret |
| `POST /api/recipes/{id}/validate` | ville den blitt brukt nå? ingenting skrives |
| `POST /api/recipes/{id}/apply` | bruk den: `200` brukt, `409` avvist, `502` delvis eller mislyktes |
| `GET /api/recipes/{id}/applications` | hver anvendelse, avslag inkludert |
