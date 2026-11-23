---
title: "Skript"
description: "Skriv en syklus én gang, gi den et navn og kjør den fra en regel, en skjerm eller MCP. En prøvekjøring går gjennom den ekte skriveporten før noe beveger seg."
---

Et skript er en sekvens av trinn med et navn. CIP-syklusen. Spylingen av linja. Omstillingen til produkt B. Hvert anlegg har en håndfull prosedyrer det kjører nøyaktig likt hver gang, og dagen noen kopierer én inn i en fjerde automasjon og retter ett trinn i bare tre av dem, er dagen det biter deg. Så du skriver den én gang, gir den et navn, og alt som trenger den, kaller den ved det navnet: en operatør fra Skript-skjermen, en regel med et `call_script`-trinn, en agent med `run_script`, hva som helst gjennom `POST /api/services/script/turn_on`.

Et skript snakker automasjonsspråket, kjører på den samme sekvenskjøreren som en regels handlinger, og hver skriving det gjør, går gjennom den ene skriveporten. Ingen bakdør. Det har aldri hatt noen.

## Slik ser ett ut

```json
{
  "id": "cip_cycle",
  "name": "CIP cycle",
  "description": "Caustic wash, rinse, done. Tank must be empty.",
  "fields": [
    {"name": "minutes", "label": "Wash time", "type": "number", "min": 5, "max": 60, "step": 5, "unit": "min", "required": true},
    {"name": "circuit", "type": "select", "options": ["tank_1", "tank_2"], "default": "tank_1"}
  ],
  "sequence": [
    {"type": "condition", "params": {"expression": "float(states['sensor.cip_tank_level']) < 5"}},
    {"type": "call_service", "params": {"entityId": "switch.cip_pump", "service": "switch.turn_on"}},
    {"type": "delay", "params": {"seconds": 5}},
    {"type": "wait", "params": {"expression": "float(states['sensor.cip_return_temp']) > 70", "timeoutSec": 900}},
    {"type": "log_event", "params": {"message": "CIP on {{ vars.circuit }} for {{ vars.minutes }} minutes"}},
    {"type": "call_service", "params": {"entityId": "switch.cip_pump", "service": "switch.turn_off"}}
  ],
  "mode": "skip",
  "maxRuntimeSec": 1800
}
```

- **`id`** er små bokstaver, sifre og understreker, og begynner med en bokstav. Det er også objekt-id-en til entiteten, så dette er `script.cip_cycle`, og den endres aldri.
- **`fields`** er det en kjøring tar imot. De samme typede inndataene overalt i HotLoop (`model.Field`): `number` med `min`, `max`, `step` og `unit`, `text` med `max_length` og `pattern`, `boolean`, `select` med `options`, `entity` med `domain`-ene det tar, `duration` (sekunder, eller `90s`, `1h30m`), `alarm` og `tag`. Hvert kan være `required` eller ha en `default`, og en standardverdi som feltet selv ville avvist, avvises ved lagring. Et trinn leser et felt som `vars.<name>`.
- **`sequence`** er automasjonsspråket, hele det: `call_service`, `write_tag`, `condition`, `wait`, `stop`, `call_script`, `set_variable`, `delay`, `log_event` og resten. [Automasjoner](/nb/iot/automations/) har hvert trinn.
- **`mode`** og **`maxRuntimeSec`** står lenger ned.

Et skript kompileres når det lagres, som en regel: et trinn som ikke lar seg dekode, et uttrykk som ikke kompilerer, en ventetid lengre enn en kjøring kan vare, et felt som ikke gir mening, alt avvises ved lagring. Du får vite det i redigeringsprogrammet, ikke klokka 03 om natten med pumpen midt i en vask.

## Felt kontrolleres, rettes aldri

Før det første trinnet kjører, kontrolleres det kjøringen fikk, mot feltene: hver verdi må være en feltet tar, hver obligatoriske verdi må være der, og et felt skriptet ikke har, er en feil og ikke noe som i stillhet ignoreres. **En verdi flyttes aldri for å passe.** 70 minutter i et felt med maksimum 60 avvises, de kuttes ikke til 60; `"12"` for et tall avvises, det tolkes ikke; 12,5 på et steg på 5 avvises, det rundes ikke. Verdien som går videre og styrer utstyr, er nøyaktig den noen skrev inn, ellers kjører ingenting i det hele tatt. En avvist kjøring etterlater ingen kjøring: ingenting startet.

## Kjøre ett

| Fra | Hvordan | Krever |
|---|---|---|
| Skript-skjermen | **Kjør** på kortet, fyll ut skjemaet | `scripts.run` |
| Entiteten | **Kjør** på flisen, eller `POST /api/services/script/turn_on` med feltene som data | `scripts.run` |
| API-et | `POST /api/scripts/{id}/run` med `{"fields": {...}, "reason": "..."}` | `scripts.run` |
| En regel | et `call_script`-trinn | regelens egen rettighet |
| En agent | `run_script` over MCP | MCP-skriving på |

Operatører kjører skript. Administratorer skriver dem. Å kjøre CIP-syklusen er det knappen er til for; å bestemme hvilke ventiler CIP-syklusen åpner er en ingeniørs avgjørelse, og det forblir det.

En kjøring svarer så snart den har startet, med id-en sin. Be den vente (`wait`), og den svarer når den er ferdig, med utfallet og sporet av hvert trinn. **Stopp** (`POST /api/scripts/{id}/stop`, eller `script.turn_off`) avbryter hver kjøring av det der den er, i hver prosess, også en ventetid eller en forsinkelse. Det et trinn allerede hadde skrevet, forblir skrevet. Å angre er også en skriving, gjort uten at noen ba om det, til utstyr som allerede har beveget seg, og det er operatørens avgjørelse, ikke vår.

## Hver skriving går gjennom porten

Et skript kjører som **`script:<id>`**. Hver skriving det gjør, hvert tjenestekall, hver loggline har det som aktør, og hver skriving revideres mot det i `GET /api/writes`, avvist eller ikke. **Kilden** er den som startet det: `ui` fra skjermen, `automation` fra en regel, `mcp` fra en agent. Det betyr noe, fordi porten avgjør etter kilde. Et skript en agent starter, skriver som `mcp`, og med `HOTLOOP_ALLOW_WRITES` av avvises hver eneste skriving, akkurat som agentens egen `write_tag` ville blitt det. `run_script` og en agents `script.turn_on` avviser på forhånd i det tilfellet, i stedet for å kjøre et skript der hver skriving kommer til å sprette tilbake.

Kjøringen registrerer hvem som ba om den (`actor`), hvordan (`source`) og hva som kalte den (`parent`: `automation_run:812`, `script_run:77`), så du kan gå fra en skriving tilbake til regelen, skriptet og personen eller agenten bak.

## Spør først: prøvekjøringen

`POST /api/scripts/{id}/run?dry_run=true`, **Sjekk først** i kjøreskuffen, eller `run_script` med `dryRun`. Feltene kontrolleres på samme måte, så gås hvert trinn gjennom mot anlegget slik det er akkurat nå:

- hver `write_tag` og `call_service` legges fram for skriveportens egne kontroller (`CheckWrite`, `Services.Check`), den samme koden som den virkelige skrivingen kjører, så en prøvekjøring kan ikke si ja til noe den virkelige skrivingen ville avvist av en grunn prøvekjøringen ikke kontrollerte. Ingenting skrives, ingenting revideres;
- en `condition` evalueres nå, og en usann avslutter gjennomgangen der den ville avsluttet kjøringen;
- en `set_variable` bindes, så trinnene etter den ser det de ville sett;
- en `call_script` går gjennom skriptet den kaller, med trinnene nummerert under kallet (`3.1`, `3.2`);
- en `wait`, en `delay` og alt som ikke skriver til noe utstyr (en melding, et HTTP-kall, en alarm som utløses) er `not_checked`. En prøvekjøring venter ikke femten minutter for å fortelle deg hva tanken vil vise da.

Den første skrivingen som ville blitt avvist, avslutter gjennomgangen, fordi den ville avsluttet kjøringen, og svaret sier det med portens egne ord: `step 2 (call_service): cip/pump: this tag is not marked writable`. En prøvekjøring som kommer tilbake ren, er et råd, ikke et løfte. En enhet kan falle ut, noen kan avarmere en tag, og en ventetid gir anlegget all den tiden det trenger til å ombestemme seg mellom kontrollen din og trinnet.

## Kjøremoduser

Hva som skjer med en kjøring som ble bedt om mens en annen kjøring av det samme skriptet pågår. De samme ordene en regel bruker, med én forskjell.

| Modus | En andre kjøring |
|---|---|
| `skip` | avvist, `409`, og en `skipped`-kjøring i historikken som sier hvorfor. **Standarden**, og det riktige svaret for alt som styrer utstyr |
| `queue` | venter på tur og starter når den foran er ferdig. Bare én dyp: en tredje avvises |
| `restart` | avbryter den pågående der den er, og starter så snart den har stoppet. To kjøringer overlapper aldri |
| `parallel` | kjører ved siden av |

Forskjellen: En regels kø dropper den eldste ventende kjøringen i stillhet, og et skripts kø avviser den nyeste høyt og tydelig. En regel utløses av en utløser som ikke bryr seg. Et skript etterspørres av noen, eller noe, som kanskje venter på svaret, og «kjøringen din skjedde bare aldri» er ikke et svar.

Et `call_script`-trinn som venter på et opptatt skript, feiler (`script busy`); ett som ikke venter, noterer det i sporet og går videre, for alt det noen gang skulle gjøre, var å starte det.

`maxRuntimeSec` setter en grense for én kjøring, fem minutter når den er null. En kjøring som går ut på tid, blir `timed_out`, enten den var mellom trinn eller midt i en ventetid.

## Skript som kaller skript

Et `call_script`-trinn kjører et skript fra en regel eller fra et annet skript. Med `wait` tar trinnet skriptets utfall som sitt eget, og skriptet er en del av kjøringen som kalte det: avbryt den som kaller, eller la den gå ut på tid, så stopper skriptet den venter på, også. Uten `wait` startes skriptet og får fullføre på egen hånd.

To grenser, begge der fordi alternativet er et skript som går i løkke:

- **Et skript som ville kalt seg selv, avvises ved lagring**, direkte eller gjennom en hvilken som helst kjede av andre skript: `script b would call itself: b calls a calls b`. Det samme gjelder en redigering som lukker en løkke.
- **Fem nivåer dypt, under kjøring.** Et sjette skript i én kjede får trinnet som skulle kalt det til å feile, og kjeden med det. Og hvis en løkke noen gang kommer forbi lagringen (to prosesser som lagrer to halvdeler av den i samme øyeblikk), fanger kjøringen den: et skript som allerede kjører i sin egen kjede, avvises, ikke kjørt en gang til.

## Entiteten

Hvert skript er en entitet, `script.<id>`, plattform `script`. Tilstanden er `on` mens en kjøring av det pågår, i en hvilken som helst prosess, og `off` når ingen gjør det; attributtene bærer `mode`, hvor mange kjøringer som pågår (`current`), `fields`, og når det sist startet og hvordan det endte. Den står på Entiteter-skjermen med en **Kjør**-knapp, i `list_entities` over MCP, i `/api/states`, og en regel kan ha en tilstandsutløser på den: «når CIP-syklusen går av, logg batchen». Å slette et skript gjør entiteten foreldreløs, slik det å slette en alarmdefinisjon gjør: En administrator sletter den foreldreløse når ingenting refererer til den lenger.

## Kjørehistorikken

Hver kjøring er en rad i `script_runs`: hvem, hvordan, feltene den fikk etter at de var kontrollert, sporet av hvert trinn (løste inndata, ikke maler), hvordan den endte og hvorfor. `GET /api/scripts/{id}/runs`, kjøreskuffen og [loggboken](/nb/iot/logbook/), der skriptkjøringer er av typen `script`, funnet via skriptets entitet eller via alt en kjøring skrev til. Historikken beholder de nyeste 500 kjøringene av hvert skript, den samme grensen automasjonskjøringer har.

En kjørings rad åpnes før det første trinnet og ferdigstilles etter det siste. Når prosessen stopper, avbryter den hver pågående kjøring der den er og registrerer den som `cancelled: interrupted by restart`. En kjøring et krasj har kuttet, uten noen igjen til å ferdigstille raden, markeres på samme måte ved Gatewayens neste start. **Ingenting gjenopptar en kjøring.** Å fortsette fra trinn fire i en CIP-syklus en time senere, uten å bli bedt om det, mot et anlegg som har gått videre, er verre enn å si at den stoppet.

## Mer enn én prosess

Gatewayen og en `--mcp-stdio`-prosess ved siden av (eller to poder midt i en utrulling) kjører begge skript. En kjørings tilstand lever i databasen, og hver prosess lytter etter endringer på `hotloop_script`, så:

- et skript startet i én prosess viser `on` i hver prosess sin entitet;
- et skript lagret på én pod er skriptet på den andre, og kjøringene av det der avbrytes hvis trinnene endret seg;
- **Stopp** stopper hver kjøring av det, i hver prosess.

Kjøremodusen holdes per prosess. To prosesser kan hver starte én kjøring av et `skip`-skript i samme øyeblikk. Et anlegg som kjører den samme prosedyren fra en agents hjelpeprosess og fra operatørens skjerm i samme sekund, har en samtale å ta som ingen lås fra oss ville avgjort.

## Sikkerhetskopier

`scripts` og `script_runs` er med i hver sikkerhetskopi og kommer tilbake ved en gjenoppretting, med historikken. En kjøring sikkerhetskopien tok midt i, kommer tilbake som `running` og markeres som `interrupted by restart` ved første start, som alle andre. Se [Sikkerhetskopi og gjenoppretting](/nb/iot/backup/).

## API-et

Hver rute, dens rettighet og svarene dens står i [HTTP-API-et](/nb/iot/api/#skript).

| Rettighet | leser | operatør | administrator |
|---|---|---|---|
| `scripts.read`: liste dem, kjøringene deres | ja | ja | ja |
| `scripts.run`: kjøre, prøvekjøre, stoppe, `script.turn_on`/`turn_off` | nei | ja | ja |
| `scripts.write`: opprette, redigere, slette | nei | nei | ja |
