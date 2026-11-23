---
title: "Automatiseringer"
description: "Regler med ti typer utløsere, vilkår og sekvenser, kompilert ved lagring, og hver skriving går gjennom skriveporten."
---

En regel er tre ting: noe skjer, et vilkår holder, handlinger kjører.

Regler kan styre utstyr, så to egenskaper er ikke til forhandling.

**Vilkår kompileres når regelen lagres, ikke når den utløses.** En syntaksfeil ser forfatteren mens han fortsatt ser på editoren, i stedet for en regel som i stillhet aldri kjører, eller verre, en som feiler klokken 3 om natten midt i en sekvens som allerede er halvveis utført. Editoren validerer mens du skriver; en regel som ikke kompilerer, avvises ved lagring.

**Vilkår evalueres i en sandkasse.** [expr-lang](https://expr-lang.org) har ingen I/O, kommer ikke til filsystemet eller nettverket, typesjekker ved kompilering og er garantert å avslutte. Den siste egenskapen betyr mest: Et vilkår evalueres på veien som fører til en skriving, og et uttrykksspråk som kan gå i løkke for alltid er ett som kan låse motoren som holder skrivelåsen.

## Utløsere

Det holder at én utløser slår til for at regelen kjører.

| Type | Utløses når | Nøkkelfelt |
|---|---|---|
| `tag_change` | verdien til en tag endres | `deviceId`, `tagName` |
| `threshold` | en verdi **krysser** en grense | `deviceId`, `tagName`, `threshold`, `direction`, `hysteresis` |
| `state` | tilstanden til en entitet endres, eller har holdt en tilstand en stund | `entityId`, `from`, `to`, `forSec` |
| `schedule` | et cron-uttrykk forfaller | `cron` |
| `interval` | hvert N-te sekund | `intervalSec` |
| `alarm` | en alarm går inn i en tilstand | `alarmId`, `alarmState` |
| `device_state` | en enhet kobler til eller faller ut | `deviceId`, `toState` |
| `webhook` | en innkommende POST kommer | `webhookPath` |
| `mqtt` | en melding lander på et emne | `topic` |
| `startup` | prosessen starter | n/a |
| `sun` | demring, soloppgang, solhøyde, solnedgang eller skumring på anlegget, med en forskyvning om du vil | `event`, `offsetSec` |

### Terskler utløses ved krysset

`threshold` utløses når en verdi *krysser* grensen, ikke mens den ligger over. Å utløse på "verdien er over 200" betyr at regelen utløses på hver skanning verdien holder seg høy, noe som for en regel som styrer noe er en kommandostorm.

`hysteresis` hindrer at en verdi som svever på grensen slår regelen på igjen ved hver vingling: Når den først er over, må verdien falle under `threshold - hysteresis` før utløseren kan slå til igjen.

```json
{
  "type": "threshold",
  "deviceId": "press-01", "tagName": "Zone1_Temp",
  "threshold": 200, "direction": "rising", "hysteresis": 5
}
```

`direction` er `rising`, `falling` eller `either`. Den første målingen etter oppstart setter en referanse og utløser ikke, ellers ville hver terskelregel utløst én gang ved oppstart uansett verdi.

### Tilstandsutløsere følger entiteter

`state` utløses når tilstandsstrengen til en entitet endres: `off` til `on`, `212.5` til `213`, `on` til `unavailable`. `from` og `to` snevrer det inn. Utelater du begge, utløses den ved hver endring, også til og fra `unavailable`, som vanligvis er det du vil ha for "si fra til noen" og aldri det du vil ha for "styre noe". Si `to`.

```json
{
  "type": "state",
  "entityId": "binary_sensor.press_01_run",
  "from": "off", "to": "on"
}
```

Den utløses på tilstanden og ingenting annet. At en attributt endres, eller at kvaliteten blir dårlig mens tilstanden holder sin siste gode verdi, er ikke en tilstandsendring.

Her er nøyaktig når den utløses, fordi en regel som styrer utstyr fortjener å vite det. Utløseren følger entitetsmotorens egen oversikt over hva som endret seg, ikke tag-bussen. Motoren beregner tilstanden til en entitet etter hvert som målinger kommer, og beregner alt på nytt én gang i sekundet som sikkerhetsnett for en bunke den ikke rakk i tide. Hver endring den beregner, rapporterer den én gang, i rekkefølge, og utløseren ser hver eneste. Altså:

- **Den utløses én gang per endring.** Omberegningen hvert sekund rapporterer bare det som har flyttet seg siden motoren sist så, så den kan ikke rapportere en endring to ganger, og en omlasting av regler nullstiller ingenting en tilstandsutløser er avhengig av.
- **Den går ikke glipp av en endring motoren så.** En treg buss koster ett sekund i ventetid, ikke endringen.
- **Den kan ikke se en endring ingen så.** En spole som går av, på, av mellom to avlesninger endret seg aldri så langt anlegget angår. En tilstandsutløser er så god som skanningen bak den og ikke bedre. Trenger du hver flanke av et raskt signal, lås den i PLS-en.
- **Oppstart er en referanse.** Hver entitet som dukker opp når Gateway starter, eller når en aktiveres, er ikke en endring og utløser ikke.

Hvis regler noen gang kommer 10 000 endringer på etterskudd (databasen er for treg til å registrere kjøringene de starter), forkastes de eldste, telles og logges, og `GET /api/diagnostics` viser `stateChangesPending` og `stateChangesDropped` under `automations`.

Gi en entitet nytt navn, og hver regel som nevner dens gamle `entity_id` slutter å utløses. Det er prisen for navn som betyr noe; gi nytt navn med omhu, og søk gjennom reglene først.

### Å holde en tilstand: forSec

"Pumpen har gått i fem minutter" er en tilstandsutløser med `forSec`. Endringen starter en tidtaker i stedet for å utløse regelen; regelen utløses når tilstanden den endret seg til har holdt i så mange sekunder.

```json
{
  "type": "state",
  "entityId": "binary_sensor.press_01_run",
  "from": "off", "to": "on",
  "forSec": 300
}
```

- **Enhver tilstandsendring avbryter den.** Fra på til av og tilbake til på innen de fem minuttene er to endringer: Den første avslutter holdet, den andre starter et nytt fra null. Den legger ikke sammen tid. Et fall til `unavailable` er også en tilstandsendring, så en enhet som blir stille midt i holdet avbryter det.
- **Bare tilstanden teller.** En attributt som endres, eller kvaliteten som blir dårlig mens tilstanden holder, avbryter den ikke, på samme måte som den ikke utløser en vanlig tilstandsutløser. Skal et hold ikke overleve en dårlig måling, vokt vilkåret til regelen med `qualities`.
- **Den utløses én gang per hold.** Å holde i én time utløser en fem-minutters regel én gang, etter fem minutter, ikke hvert femte minutt.
- **Hver regel har sin egen tidtaker**, én per utløser. To regler på samme entitet med ulik `forSec` utløses hver til sin tid.
- **Sporet sier det.** En kjøring et hold utløste, lyder `binary_sensor.press_01_run changed from off to on and held for 300s`, og `fromState`, `toState` og `entity` er de fra endringen som startet holdet.
- **Et hold overlever ikke en omstart.** Det ligger i minnet og ingenting slår det på igjen: Minuttene en presse hadde holdt før omstarten teller ikke etterpå. Det prosessen ser når den kommer tilbake, er at hver entitet dukker opp (en referanse, ikke en endring), vanligvis som `unknown`, og så enhetens første måling som flytter den til det den leser. Med `"from": "off"` er ikke det en match, så en presse som gikk før omstarten starter ikke noe hold, og regelen utløses neste gang pressen går fra av til på og går i fem minutter. Uten `from` avhenger det av et kappløp du ikke kontrollerer. Lander den første målingen etter at reglene lytter, er det en endring, `unknown` til `on`, og den starter et hold fra null: Regelen utløses fem minutter etter det, og sporet sier `changed from unknown to on`. Svarer enheten raskere enn Gateway kommer opp, er pressen rett og slett `on` fra start, ingenting endret seg, og ingenting utløses før den neste gang gjør det. Si `from` når en omstart ikke skal telle som en start, og ikke skriv en regel som trenger at den gjør det. Å redigere, deaktivere eller slette regelen forkaster også holdene dens; å lagre en annen regel gjør ikke det.
- **En entitet som forsvinner midt i holdet** (deaktivert, eller slettet sammen med enheten) utløser det aldri.

`forSec` er høyst ett døgn (86400), og bare en `state`-utløser tar imot den. Den sjekkes ved lagring som alt annet.

### Solutløsere

Gårdslys, varmekabel, en parkeringsplass, alt som bryr seg om det er mørkt ute. `sun` utløses ved `dawn`, `sunrise`, `noon`, `sunset` eller `dusk` på dette anlegget, flyttet med `offsetSec`: negativ er før, så dette er en halv time før solnedgang.

```json
{"type": "sun", "event": "sunset", "offsetSec": -1800}
```

- **Det regnes ut på boksen.** Fra anleggets breddegrad og lengdegrad (`HOTLOOP_SITE_LATITUDE`, `HOTLOOP_SITE_LONGITUDE`), med NOAAs solligninger, uten tjeneste og uten internett. Et anlegg som mistet forbindelsen slår likevel på lysene i skumringen. Se [solen](/nb/iot/sun/).
- **Ingen posisjon, ikke slått på.** En regel med en solutløser på et anlegg uten breddegrad og lengdegrad er ikke slått på, og systemloggen sier hvilke to variabler som må settes. Det pleide å være typen ting som står slått på og stille for evig, og ingen oppdager det før gården er mørk.
- **Den utløses én gang per dagens hendelse,** til tiden den dagen. Solnedgangene i oktober kommer omtrent et minutt tidligere hver kveld, og utløseren følger dem.
- **Demring og skumring er borgerlig tussmørke**, solens sentrum 6 grader under horisonten. Det er linjen "det er mørkt nok for lys" utendørsbelysning er skrevet rundt.
- **Under midnattsola finnes det ingen solnedgang å utløse på**, så en solnedgangsutløser venter på neste, uansett hvor mange uker unna, og utløses da.
- `offsetSec` er høyst seks timer til hver side (21600). Lenger enn det er en `schedule`.

Sporet sier hva som utløste den og når: `30m before sunset at 2026-10-01T22:38:00Z`, og `trigger` er `sun` i vilkåret.

## Vilkår

Et uttrykk som returnerer en boolsk verdi. Tomt betyr ubetinget.

Hva et uttrykk kan se:

| Navn | Betydning |
|---|---|
| `value`, `string`, `quality` | målingen som utløste regelen |
| `previous` | målingen før den |
| `tag`, `device` | det som utløste den |
| `tags["device/tag"]` | hver gjeldende numeriske måling |
| `strings["device/tag"]` | hver gjeldende tekstmåling |
| `qualities["device/tag"]` | hver gjeldende kvalitet |
| `states["sensor.x"]` | tilstanden til hver aktivert entitet, som en streng |
| `attrs["sensor.x"]["unit_of_measurement"]` | attributtene til hver aktivert entitet |
| `qualities["sensor.x"]` | kvaliteten til hver entitet, ved siden av tagenes (en tag-nøkkel har en `/`, en entity_id aldri) |
| `entity`, `fromState`, `toState` | tilstandsendringen som utløste regelen |
| `alarm`, `alarmState` | alarmen som utløste regelen |
| `deviceState` | enhetstilstanden som utløste den |
| `now`, `hour`, `minute`, `weekday` | klokken; weekday 0 er søndag |
| `trigger` | hvilken utløser som slo til |
| `vars` | verdier bundet av tidligere steg |

```
value > 200
value > 200 and quality == 'good'
tags['press-01/Zone1_Temp'] > 200 and tags['press-01/Pressure'] < 50
hour >= 6 and hour < 18 and weekday != 0 and weekday != 6
qualities['press-01/Zone1_Temp'] == 'good'
strings['cnc-01/Program'] == 'PART_4471.NC'
value > previous
states['switch.press_01_pump'] == 'off' and toState == 'on'
float(states['sensor.press_01_zone1_temp']) > 200 and qualities['sensor.press_01_zone1_temp'] == 'good'
attrs['switch.press_01_pump']['armed'] == true
```

**Vokt på kvalitet.** `value > 200` er sant for en dårlig måling på 250, og en dårlig måling er en systemet forteller deg at det ikke kjenner. På alt som styrer utstyr, skriv `value > 200 and quality == 'good'`. Det samme gjelder entiteter: En dårlig entitet viser fortsatt sin siste gode verdi, og `qualities['sensor.x']` er hvordan en regel ser det.

**En tilstand er en streng.** Den er `"212.5"`, `"on"` eller `"unavailable"`, aldri et tall, så `states['sensor.x'] > 200` avvises ved lagring som en typefeil i stedet for å lagres som en sammenligning som i stillhet alltid er usann. Skriv `float(states['sensor.x']) > 200`, og vokt den: `float('unavailable')` er en feil, og et vilkår som gir feil lar kjøringen feile.

`string` er målingen som utløste regelen, noe som betyr at den ikke også er expr-langs `string()`-funksjon. For å sette et tall inn i en streng, bruk `toJSON(value)`.

Et vilkår må returnere en boolsk verdi. Et som returnerer et tall eller en streng avvises ved lagring i stedet for å tvinges til en sannhetsverdi ingen mente.

## Handlinger

Handlinger kjører i rekkefølge. Et mislykket steg stopper regelen med mindre det setter `continueOnError`; et steg som skulle stenge en ventil og ikke gjorde det, må ikke følges av steg som forutsetter at ventilen er stengt.

### write_tag

```json
{
  "type": "write_tag",
  "params": {
    "deviceId": "press-01", "tagName": "Cooling",
    "value": true
  }
}
```

Eller beregnet:

```json
{
  "type": "write_tag",
  "params": {
    "deviceId": "press-01", "tagName": "Setpoint",
    "expression": "tags['press-01/Zone1_Temp'] - 10"
  }
}
```

**Dette går gjennom samme port som alt annet.** En automatisering får ikke mer privilegium enn et menneske: Skriving må være slått på, taggen må være markert skrivbar, verdien må være innenfor området, og forsøket revideres som `automation:<rule-id>`.

### call_service

Styrer en entitet via tjenesten dens, slik `POST /api/services/...` og MCP-verktøyet `call_service` gjør. Se [Entiteter](/nb/iot/entities/#services) for hva hvert domene tar imot.

```json
{
  "type": "call_service",
  "params": {
    "entityId": "switch.press_01_pump",
    "service": "switch.turn_on"
  }
}
```

Med data, bokstavelige eller beregnede:

```json
{
  "type": "call_service",
  "params": {
    "entityId": "number.press_01_zone1_sp",
    "service": "number.set_value",
    "dataExpressions": {"value": "float(states['sensor.press_01_zone1_temp']) - 10"}
  }
}
```

`service` er `domain.service`, og domenet må være entitetens, så en regel som nevner et tall med en brytertjeneste avvises ved lagring. Det samme gjelder en tjeneste domenet ikke tar imot, og listen over hva hvert domene tar imot kommer fra entitetslaget selv: Når et domene får en tjeneste der, kan regler bruke den uten endring her. `data` er de bokstavelige tjenestedataene; `dataExpressions` evalueres ved kjøring og legges over.

Det er `write_tag` med et navn på. Kallet blir tag-skrivinger gjennom samme port, revidert som `automation:<rule-id>` med entiteten, tjenesten og kall-id-en på hver rad. Et avslag (skriving av, taggen deaktivert, en verdi utenfor entitetens steg) får steget og kjøringen til å feile, med avslaget i sporet, nøyaktig som et avslått `write_tag`, og hver skriving kallet gjorde eller fikk avslått står i stegets utdata. Et kall rulles aldri tilbake: En sammensatt som fikk gjennom to av tre skrivinger stopper der og sier det.

### condition

Et vilkår midt i en sekvens. Når det er usant, slutter sekvensen der, og kjøringen **lyktes**: Regelen gjorde det den ble skrevet for, nemlig å stoppe. Stegets utdata sier `false; the steps after this one did not run`.

```json
{
  "type": "condition",
  "params": {
    "expression": "states['binary_sensor.press_01_run'] == 'on' and qualities['binary_sensor.press_01_run'] == 'good'"
  }
}
```

Det er ikke regelens `condition`. Den sjekkes én gang, før noe kjører, mot anlegget slik det var da utløseren slo til, og et usant vilkår registrerer kjøringen som hoppet over. Et vilkårssteg leser anlegget **slik det er når steget kjører**, som er poenget med ett etter en `delay` eller en `wait`: "går pressen fortsatt, tretti sekunder senere?" `entity`, `toState`, `value` og resten av det som utløste regelen forblir som de var, og det samme gjør `vars`.

Et vilkår som ikke kan evalueres (`float('unavailable')`) får steget og kjøringen til å feile, likt som regelens vilkår. `continueOnError` avvises på et vilkår ved lagring: Å fortsette forbi ett ville bety at det aldri stopper noe.

### wait

Holder sekvensen til et uttrykk er sant, i høyst `timeoutSec`.

```json
{
  "type": "wait",
  "params": {
    "expression": "states['binary_sensor.press_01_valve_closed'] == 'on'",
    "timeoutSec": 30
  }
}
```

Den ser med en gang, igjen **hver gang en entitet uttrykket nevner endres** (tilstanden, kvaliteten eller en attributt), og én gang i sekundet uansett. Entitetene den følger med på er de som er skrevet som bokstavelige verdier i `states['...']`, `attrs['...']` og `qualities['...']`; en tag-måling, klokken eller en entitet nevnt på annen måte fanges av sekundblikket. En wait på en Modbus-spole er dermed like rask som avlesningen bak, ikke et sekund for sen.

Når den blir sann, kjører neste steg, og stegene etter ser anlegget slik waiten sist så det. Når tidsavbruddet går ut først, **feiler** steget, og kjøringen med det, og sier `still false after 30s`, med mindre waiten sier at man skal fortsette:

```json
{
  "type": "wait",
  "params": {
    "expression": "float(states['sensor.press_01_zone1_temp']) < 60",
    "timeoutSec": 240,
    "continueOnTimeout": true
  }
}
```

Uansett er `vars.wait.completed` sann eller usann etterpå, og `vars.wait.waitedSec` er hvor lenge den ventet, så et vilkårssteg etter en wait som fortsetter kan avgjøre: `vars.wait.completed == true`.

`timeoutSec` er påkrevd og høyst én time. En wait uten slutt holder kjøreplassen sin til kjøringens budsjett tar den, som under `skip` betyr at regelen slutter å utløses. Den må også passe i kjøringens budsjett (`maxRuntimeSec`, fem minutter som standard): En wait på ti minutter trenger `"maxRuntimeSec": 900` eller så på regelen, og uten den avvises regelen ved lagring i stedet for å gå ut på tid som en kjøring. Et uttrykk som gir feil mens det venter, får steget til å feile.

### stop

Avslutter sekvensen. `reason` er påkrevd og tar imot `{{ expression }}`-erstatning; sporet viser den.

```json
{
  "type": "stop",
  "params": {"reason": "pump already running, nothing to do"}
}
```

Uten `error` lyktes kjøringen. Med `"error": true` feilet kjøringen, med årsaken som feil, og den logges og telles som en feil som alle andre:

```json
{
  "type": "stop",
  "params": {"reason": "valve did not close in time", "error": true}
}
```

`continueOnError` avvises på en stop ved lagring.

### call_script

Kjører et [skript](/nb/iot/scripts/): en navngitt sekvens noen skrev én gang slik at hver regel som trenger en CIP-syklus eller en linjespyling kaller den samme i stedet for å bære sin egen kopi. `fields` er inngangene, `fieldExpressions` evalueres når steget kjører og legges over, og skriptet sjekker alt mot sine egne felt nøyaktig som for en kjøring fra skjermen. En verdi det avviser, får dette steget til å feile; den flyttes aldri for å passe.

```json
{
  "type": "call_script",
  "params": {
    "scriptId": "cip_cycle",
    "fields": {"circuit": "tank_2"},
    "fieldExpressions": {"minutes": "states['input_number.cip_minutes']"},
    "wait": true
  }
}
```

Med `"wait": true` holder steget til skriptets kjøring er ferdig og tar utfallet: Et skript som feiler, får steget til å feile, og regelen stopper der med mindre steget sier `continueOnError`. Skriptets kjøring er en del av denne: Hvis denne kjøringen avbrytes eller går tom for budsjett, gjør skriptet det også. Uten `wait` startes skriptet og regelen går videre; skriptet blir ferdig på egen hånd.

Skriptet kjører som `script:<id>`, med denne regelens kilde, `automation`, på hver skriving det gjør, og kjøringen dens sier at `automation_run:<id>` var forelderen. Et skript som er opptatt og hvis modus avviser en ny kjøring, får et ventende steg til å feile (`script busy`) og noteres, ikke feiles, av ett som ikke venter. Skript som kaller skript går høyst fem dypt, og et skript som ville kalt seg selv, avvises når det lagres.

### apply_recipe

Bruker en [oppskrift](/nb/iot/recipes/): et sett settpunkter som går ut samtidig, en produktkvalitet eller en omstilling. `params` er parameterne og `paramExpressions` evalueres når steget kjører og legges over; `version` bruker en eldre versjon med vilje, og utelatt betyr den gjeldende.

```json
{
  "type": "apply_recipe",
  "params": {
    "recipeId": "grade_a",
    "params": {"line_speed": 120},
    "paramExpressions": {"batch": "states['input_number.next_batch']"}
  }
}
```

Oppskriften gjør det den gjør fra Oppskrifter-skjermen, med denne regelen som den som bruker den. Den sjekkes først i sin helhet, og hvis noe mål ville blitt avvist, skrives ingenting og steget feiler med alle årsakene. Så går målene ut i rekkefølge under én kall-id, som `automation:<id>` med kilden `automation`, og det første som feiler stopper resten og får steget til å feile; det som er skrevet, forblir skrevet. Steget lykkes bare når hvert mål er skrevet. En verdi som gikk ut og ikke ble lest tilbake fra enheten er ikke en feil, fordi den gikk ut, men sporet sier `NOT confirmed by read-back`, og det gjør bruken også. Forelderen til bruken er denne kjøringen, `automation_run:<id>`.

### Resten

| Handling | Gjør |
|---|---|
| `mqtt_publish` | publiserer på en MQTT-enhets eksisterende tilkobling |
| `http_request` | kaller et endepunkt; `bindTo` lagrer innholdet i `vars` |
| `raise_alarm` / `clear_alarm` | styrer en alarm motoren ikke kan se selv |
| `log_event` | skriver til systemloggen |
| `set_variable` | binder en verdi for senere steg |
| `delay` | pauser, opptil en time |
| `mcp_call` | kaller et verktøy på en konfigurert MCP-server |

`mqtt_publish`, `http_request`, `log_event` og `stop` støtter `{{ expression }}`-erstatning i strengene sine.

```json
{
  "type": "mcp_call",
  "params": {
    "server": "maintenance",
    "tool": "create_work_order",
    "args": {"priority": "high"},
    "argExpressions": {"note": "'Zone 1 reached ' + toJSON(value)"},
    "bindTo": "workOrder"
  }
}
```

## Kjøremoduser

Hva som skjer når en regel utløses mens en forrige kjøring fortsatt pågår.

| Modus | Oppførsel |
|---|---|
| `skip` | forkast den nye utløseren, **standarden**, og det riktige svaret nær en enhet |
| `queue` | kjør den etterpå, høyst én i kø |
| `restart` | forkast den pågående kjøringen og start på nytt |
| `parallel` | kjør begge |

`queue` er med vilje begrenset til én ventende kjøring. En regel som ikke henger med, ville ellers bygd opp en bunke kommandoer som alle avfyres mot et anlegg hvis tilstand har gått videre.

`minIntervalSec` begrenser raten uansett utløserrate, en sikring mot en tag som vibrerer og kjører en enhet i senk. En manuell kjøring fra brukergrensesnittet eller MCP omgår ratebegrensningen (noen mente det) men ikke kjøremodusen (to samtidige kjøringer er like farlige hvem som enn startet dem).

`maxRuntimeSec` avgrenser en hel kjøring; standarden er fem minutter. Uten den holder en regel som henger på et uoppnåelig endepunkt kjøreplassen sin for alltid, og under `skip` betyr det at den aldri utløses igjen. En kjøring som går tom for den, registreres som tidsavbrutt, enten den var mellom steg eller midt i en `delay` eller en `wait`.

### Ventinger, forsinkelser og kjøremoduser

En kjøring som står i en `wait` eller en `delay` er en kjøring som pågår, og kjøremodusen avgjør hva en utløser gjør med den:

| Modus | En utløser mens en kjøring venter |
|---|---|
| `skip` | forkastes og registreres som hoppet over. Den ventende kjøringen fortsetter. |
| `queue` | kjører når den ventende kjøringen er ferdig, uansett hvordan den endte. |
| `restart` | avbryter den ventende kjøringen der den er og starter en ny. Den gamle kjøringen registreres som **avbrutt**, `a newer trigger restarted the rule`. Dette er "bevegelseslys"-mønsteret: Hver utløser skyver slutten utover. |
| `parallel` | starter en ny kjøring, som venter på egen hånd. |

En kjøring avbrytes der den er, en wait eller en delay inkludert, og registreres som **avbrutt** med årsaken, når:

- **regelen dens deaktiveres eller slettes**: `the rule was disarmed or deleted`. Køkjøringen og `forSec`-holdene dens forkastes også.
- **regelen dens redigeres**: `the rule was edited`. En kjøring som venter på et vilkår forfatteren nettopp har endret, fortsetter ikke som om ingenting hadde skjedd; den redigerte regelen starter rent. Å lagre en *annen* regel rører ingenting: Kjøringer, hold, køkjøringer, kjøreplassen og intervalltidtakerne til hver uendret regel fortsetter som de var.
- **prosessen stopper**: `the process is stopping`. Nedstengingen venter ikke ut en wait. Ingenting gjenopptar kjøringen ved neste start; en kjøring prosessen ikke fikk registrert som avbrutt (en krasj, et strømbrudd) markeres som avbrutt ved neste start.

Et steg som ble avbrutt eller gikk tom for budsjett, stopper kjøringen selv med `continueOnError`: Det flagget er for et steg som feilet, ikke for en kjøring noen stoppet. Alt steget hadde gjort, forblir gjort: En skriving som gikk ut før avbruddet angres ikke, og den står i sporet.

## Kjørehistorikk

Hver kjøring registreres med et spor per steg: de **løste** inngangene, utgangene, varighetene og feilene. Ikke malene: Når en regel bommer klokken 3 om natten, er `wrote 212.5 to press-01/Setpoint` det som er verdt å vite, og `wrote {{expression}}` er det ikke.

Utvid en kjøring på Automatiseringer-skjermen for å se stegene. En kjøring som fortsatt pågikk da prosessen stoppet, avbrytes ved stoppen, og en prosessen aldri fikk registrert (en krasj) markeres som avbrutt ved neste start, i stedet for å se ut som den har kjørt siden forrige tirsdag.

## Et gjennomgått eksempel

Start kjølingen når en sone går varm under et skift, høyst én gang hvert tiende minutt, og si fra til noen.

```json
{
  "id": "cool-zone-1",
  "name": "Cool zone 1 when hot",
  "enabled": true,
  "mode": "skip",
  "minIntervalSec": 600,
  "triggers": [{
    "type": "threshold",
    "deviceId": "press-01", "tagName": "Zone1_Temp",
    "threshold": 200, "direction": "rising", "hysteresis": 5
  }],
  "condition": "quality == 'good' and hour >= 6 and hour < 18",
  "actions": [
    {"type": "write_tag", "params": {
      "deviceId": "press-01", "tagName": "Cooling", "value": true}},
    {"type": "delay", "params": {"seconds": 30}},
    {"type": "log_event", "params": {
      "severity": "warning",
      "message": "Cooling started, zone 1 at {{ value }}"}}
  ]
}
```

Les sikringene i rekkefølge: Den utløses ved krysset og ikke kontinuerlig; hysteresen hindrer at den slås på igjen ved en vingling; vilkåret nekter å handle på en måling det ikke kan stole på og kjører bare under skiftet; og ratebegrensningen gjør at den, selv om alt annet er galt, ikke kan styre anlegget oftere enn hvert tiende minutt.

Samme idé med entiteter: Start avtrekksviften når pressen begynner å gå, men bare hvis ingen har deaktivert viften.

```json
{
  "id": "fan-with-press",
  "name": "Extraction fan follows the press",
  "enabled": true,
  "mode": "skip",
  "triggers": [{
    "type": "state",
    "entityId": "binary_sensor.press_01_run",
    "from": "off", "to": "on"
  }],
  "condition": "qualities['binary_sensor.press_01_run'] == 'good' and attrs['switch.press_01_fan']['armed'] == true",
  "actions": [
    {"type": "call_service", "params": {
      "entityId": "switch.press_01_fan", "service": "switch.turn_on"}},
    {"type": "log_event", "params": {
      "message": "{{ entity }} went {{ toState }}, fan started"}}
  ]
}
```

`from` og `to` gjør at en gjenoppkobling (`unavailable` til `on`) ikke starter viften av seg selv; vilkåret gjør at en deaktivert vifte er en kjøring som hoppes over og ikke en avslått skriving i revisjonssporet hver gang pressen starter.

Og én som bruker sekvensstegene: Når pressen har gått i ti minutter, åpne kjøleventilen hvis den ikke allerede er åpen, vent på endebryteren, og feil høylytt hvis den aldri slår inn.

```json
{
  "id": "cool-after-warmup",
  "name": "Open cooling after ten minutes of running",
  "enabled": true,
  "mode": "restart",
  "maxRuntimeSec": 120,
  "triggers": [{
    "type": "state",
    "entityId": "binary_sensor.press_01_run",
    "from": "off", "to": "on",
    "forSec": 600
  }],
  "actions": [
    {"type": "condition", "params": {
      "expression": "states['valve.press_01_cooling'] != 'open'"}},
    {"type": "call_service", "params": {
      "entityId": "valve.press_01_cooling", "service": "valve.open"}},
    {"type": "wait", "params": {
      "expression": "states['valve.press_01_cooling'] == 'open'",
      "timeoutSec": 60, "continueOnTimeout": true}},
    {"type": "condition", "params": {
      "expression": "vars.wait.completed == false"}},
    {"type": "stop", "params": {
      "reason": "cooling valve did not open within 60s, it is {{ states['valve.press_01_cooling'] }}",
      "error": true}}
  ]
}
```

Les den ovenfra og ned: Holdet gjør at en presse som faller ut etter to minutter aldri åpner ventilen, og `from` gjør at en omstart av Gateway ikke er en pressestart; det første vilkåret gjør en allerede åpen ventil til en vellykket kjøring som ikke styrer noe; waiten våkner i det øyeblikket ventilentiteten endres; og når den aldri åpner, lar det andre vilkåret kjøringen gå videre til en stop som får den til å feile, med ventilens faktiske tilstand i årsaken og en advarsel i systemloggen. Når ventilen åpner, er det samme vilkåret usant og kjøringen slutter der, vellykket.

## Webhooks

En `webhook`-utløser registrerer `POST /api/webhook/<path>`. Innholdet er tilgjengelig som `vars.body`. En sti ingen regel gjør krav på, gir 404 i stedet for å godta i stillhet; en webhook som poster ut i intet ser nøyaktig ut som en som virker.

To regler kan ikke gjøre krav på samme sti; den andre avvises ved innlasting med en loggline som nevner begge.

## Når en regel ikke slår seg på

En regel som er aktivert, men ikke kompilerte, vises som **NOT ARMED** på Automatiseringer-skjermen, med en rød prikk og en forklaring, og en feil i systemloggen. Dette er tilstanden det er verdt å være høyest om: Forfatteren tror den kjører.

Én dårlig regel deaktiverer ikke de andre. Omlasting forkaster regelen som feilet og slår på alt annet.
