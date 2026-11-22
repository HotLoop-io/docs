---
title: "Utstyrstreet og etikettene"
description: "Ett ISA-95-tre med foretak, lokasjon, område, linje, celle, enhet og utstyr, pluss etiketter, så regler og agenter snakker om pumpa og ikke om register 40001."
---

Et anlegg har allerede en måte å organisere seg på, og hvert SCADA-, MES- og historian-system det eier bruker den: ISA-95. Foretak, lokasjon, område, linje, celle, enhet, utstyr. Det er det HotLoop bruker, ett tre, og ikke én liste for etasjer, en annen for områder og en tredje for enheter. Se [Entiteter](/nb/iot/entities/) for det som henger under det.

## Nivåer

| Nivå | Hva det vanligvis er |
|---|---|
| `enterprise` | Selskapet |
| `site` | Et anlegg |
| `area` | En avdeling eller en bygning: Pakking, Utilities, Tankpark |
| `line` | En produksjonslinje |
| `cell` | En arbeidscelle på en linje, eller en prosesscelle i et batchanlegg |
| `unit` | En produksjonsenhet: en reaktor, en kjøler, en ovn |
| `equipment` | En maskin eller en del av en: en pumpe, en skid, en motor |

Et barn er alltid på et lavere nivå enn forelderen, så en lokasjon havner aldri under en linje. Det kan hoppe over nivåer: en enhet rett under et område er greit, og det samme er en linje rett under en lokasjon i et anlegg uten områder. Det eneste unntaket er `equipment` inni `equipment`, fordi en skid inneholder pumper og en pumpe inneholder en motor, og ISA-95 slutter å gi nivåer navn lenge før et anlegg slutter å nøste ting. En node kan stå i roten på hvilket som helst nivå; de fleste anlegg starter på `site`.

To søsken med samme nivå og navn er det samme stedet, så treet avviser den andre.

En node kan aldri bli sin egen forfader: å flytte en node under seg selv eller under noe under den avvises. Den eneste måten å få en løkke på er å redigere tabellen `equipment` for hånd. Hvis noen gjør det, henger ingenting som går gjennom treet seg opp, og en endring av en node i løkka avvises med en melding som nevner nodene og ber deg sette `parent_id` til NULL på en av dem.

## Tekst for lokasjon, område og linje virker fortsatt

Hver enhet har hatt fritekstfeltene `site`, `area` og `line` siden før treet fantes. De forsvinner ikke. Enhetsredigereren i 4.15 skriver dem, `list_devices` og `describe_device` leser dem, og det samme gjør alle agenter og skript noen har skrevet mot dem. Derfor holdes teksten og treet i takt, begge veier, i samme transaksjon som endringen:

**Å lagre en enhet med tekst og uten `equipmentId`** finner lokasjonen, området og linja teksten nevner, eller oppretter dem, hver under den forrige, og plasserer enheten på den dypeste. To enheter med samme tekst havner på samme node; ingenting dupliseres noen gang. Teksten du sendte er teksten som lagres, nøyaktig: en klient som ikke vet noe om treet får det den alltid har fått, pluss en `equipmentId` den kan ignorere.

**Å lagre en enhet med en `equipmentId` som flytter den** henter teksten fra nodens bane, uansett hvilken tekst som fulgte med. Plasser en enhet på en celle under `Plant A / Packing / Line 2`, og teksten blir `Plant A`, `Packing`, `Line 2`.

To detaljer gjør dette trygt for klienter som ikke kjenner til treet:

- Tekst som fortsatt sier det enhetens nåværende node sier, lar enheten bli der den er. Teksten har bare tre kolonner, så en enhet på en celle eller en maskin under linja kan bare si linja. Å lagre den med samme tekst flytter den ikke opp til linja.
- En klient som leser en enhet og sender hele greia tilbake, `equipmentId` og alt, med teksten redigert, får tekstendringen. `equipmentId` den sendte tilbake er den enheten allerede hadde, så det er ikke en flytting, og teksten avgjør.

En lokasjon blir funnet uansett hvor den står, ikke bare i roten, så å legge `Plant A` under et foretak gjør ikke at neste enhet som sier `Plant A` oppretter en til.

**Å gi nytt navn til eller flytte en node** skriver om teksten til hver enhet på eller under den, i samme transaksjon. Hvis noe av det mislykkes, har ingenting skjedd: et tre som sier én ting og enhetstekst som sier noe annet er akkurat det å holde begge i takt skulle hindre. Svaret og systemloggen lister hver enhet der teksten endret seg.

### Oppgraderingen

Migreringen `0006_hierarchy.sql` bygger treet fra teksten hver eksisterende enhet allerede har: én lokasjon per distinkt lokasjonsnavn, ett område per distinkt områdenavn under lokasjonen, én linje per distinkt linje under området, og hver enhet på den dypeste noden teksten nevner. En enhet med område og uten lokasjon får et område i roten; en med linje og uten område får en linje rett under lokasjonen. Tekst som bare er mellomrom, nevner ingenting. Teksten brukes nøyaktig slik den er lagret, med mellomrom og store og små bokstaver, fordi navnene i treet er det teksten senere skrives om fra, og å trimme under oppgraderingen ville vært en stille omdøping av hver enhet som hadde et ekstra mellomrom. Ingen enhetstekst endres i oppgraderingen.

Go-siden plasserer en enhet etter de samme reglene, og en test holder de to sammen: hver enhet oppgraderingen plasserte, lagret på nytt uten endring, blir der den er og får ikke treet til å vokse med noe.

## Å slette en node

**En node med noe under seg avvises**: barnenoder eller enheter plassert på den. Flytt dem først. Avvisningen sier hva som er i veien.

Alternativet var å flytte barna over på forelderen til den slettede noden. Det flytter hver enhet under og skriver om teksten deres, under en node ingen har rørt, og kan sette en linje rett under en lokasjon uten område imellom, et tre ingen har tegnet. Å fjerne plasseringen til enhetene i stedet ville latt teksten deres nevne et sted som ikke finnes lenger, og neste lagring av en av dem ville stille opprettet noden på nytt. Begge deler er overraskelser. En avvisning som sier hva som må flyttes, er det ikke.

Entiteter plassert på en slettet node mister plasseringen og går tilbake til å følge enheten sin.

## Entiteter i treet

Hvert entitetssvar har nå tre felter til:

| Felt | Hva |
|---|---|
| `equipment_id` | Hvor selve entiteten er plassert, eller null når den bare går dit enheten går |
| `area_id` | Nærmeste `area` ved entitetens egen node eller over, eller enhetens node når den ikke har noen. Alt som grupperer etter område, leser dette feltet. Null når det ikke finnes noe område over |
| `labels` | Entitetens label_ids |

En entitets egen plassering går foran enhetens. Det har betydning for en enhet som er en hel PLS: temperatur-taggen hører hjemme i ovnen, kjøler-taggen i Utilities. Plasser en entitet med `PUT /api/entities/{entity_id}`:

```json
{ "equipment_id": 42, "labels": ["critical"] }
```

`"equipment_id": null` går tilbake til å følge enheten. `labels` erstatter hele settet. Begge krever `entities.write`, som alle andre registerfelt.

## Etiketter

En etikett er en tag i hverdagslig forstand: `critical`, `line 1 utilities`, `calibrate quarterly`. Enheter og entiteter kan ha så mange du vil.

En etikett har en `label_id` og et `name`. `label_id` lages av navnet første gang (små bokstaver, sifre og understreker, `_2`, `_3` ved kollisjon) og endres aldri, for det er det automatiseringer og skjermer refererer til. Navnet kan endres når du vil. Du kan også velge `label_id` selv når du oppretter en.

Å slette en etikett tar den bort fra alt som har den.

Enhetsetiketter settes med `PUT /api/devices/{id}/labels`, ikke gjennom `POST /api/devices`. Alle klienter som lagrer en enhet i dag sender hele enheten uten etiketter, og ville slettet dem ved hver lagring.

## API

Endepunktene for utstyr og etiketter bruker feltnavn i snake_case, som entitetsendepunktene, fordi treet er områderegisteret i entitetsmodellen og er laget for de samme brukerne. Enhetens nye felt er `equipmentId`, i camelCase, som resten av enhets-API-et.

| Endepunkt | Tillatelse | Hva |
|---|---|---|
| `GET /api/equipment` | `equipment.read` | Hver node, med `path` av navn fra roten. Filter: `?level=` |
| `GET /api/equipment/{id}` | `equipment.read` | `{"equipment", "children", "devices", "entities"}`: noden, nodene rett under den og det som er plassert rett på den |
| `POST /api/equipment` | `equipment.write` | `{"parent_id", "level", "name", "description"}` |
| `PUT /api/equipment/{id}` | `equipment.write` | Hvilket som helst av `name`, `description`, `level`, `parent_id` (null for roten). Svarer `{"equipment", "devices_rewritten"}` |
| `DELETE /api/equipment/{id}` | `equipment.write` | Avvises med 409 så lenge noe er under |
| `GET /api/labels` | `equipment.read` | Hver etikett |
| `GET /api/labels/{label_id}` | `equipment.read` | `{"label", "devices", "entities"}` som har den |
| `POST /api/labels` | `equipment.write` | `{"label_id"?, "name", "color", "icon", "description"}` |
| `PUT /api/labels/{label_id}` | `equipment.write` | Navn, farge, ikon, beskrivelse. Aldri label_id |
| `DELETE /api/labels/{label_id}` | `equipment.write` | Fjerner den fra alt |
| `PUT /api/devices/{id}/labels` | `equipment.write` | `{"labels": [...]}`, hele settet |
| `POST /api/devices` | `devices.write` | Får den valgfrie `equipmentId`, som over |
| `GET /api/devices/{id}` | `devices.read` | Får `labels` ved siden av `device` og `tags` |

Alle roller har `equipment.read`: hvor ting står er det en enhets lokasjon og område allerede fortalte en leser. Bare administratoren har `equipment.write`, fordi å gi nytt navn til eller flytte én node skriver om lokasjon, område og linje på hver enhet under, og det er konfigurasjon.

Hver endring havner i systemloggen, kategori `config`, emne `equipment:<id>` eller `label:<label_id>`.

## MCP

`list_devices` og `describe_device` svarer fra teksten, som de alltid har gjort, og utdataene er uendret. En test fester dem byte for byte til det versjonen før treet svarte, og omorganiserer så treet rundt enheten (et foretak over lokasjonen, en celle under linja, en etikett) og sjekker at ingenting en agent ser har flyttet seg. Når treet endrer teksten, for eksempel ved omdøping, ser agenten den nye teksten, akkurat som om noen hadde skrevet den inn i enheten. `list_entities` er stedet agenter ser treet: den filtrerer på en node og alt under, og gir hver entitets plassering. Se [MCP](/nb/iot/mcp/#entities).

## Sikkerhetskopi og gjenoppretting

`equipment`, `labels`, `entity_labels` og `device_labels` er med i sikkerhetskopien, og det er de nye `equipment_id`-kolonnene også. `equipment` refererer til seg selv (`parent_id`), noe en gjenoppretting ikke kan sortere: etter at en node er flyttet, kan en forelder fint bli lagret etter barnet sitt. Begrensningen er `DEFERRABLE INITIALLY DEFERRED`, så den sjekkes når gjenopprettingen committer, med alle rader på plass, og det samme gjelder alt annet som skriver om treet i mer enn én setning. Vakttesten for sikkerhetskopien tillater at en tabell refererer til seg selv bare når begrensningen er utsatt, og rundturstesten lagrer et barn før forelderen med vilje.

En sikkerhetskopi tatt før denne versjonen lar seg fortsatt gjenopprette. Filene `devices` og `entities` har én kolonne færre; gjenopprettingen laster dem inn i tabellens første kolonner (en ny kolonne legges alltid til sist), og den nye får standardverdien. Så, i samme transaksjon, plasserer den hver gjenopprettede enhet i treet etter teksten, slik oppgraderingen ville gjort.

## Skjermen Anlegg

Treet, nedover siden, med et kort for noden som er valgt: banen, enhetene på den, entitetene plassert på den og det som er under. En administrator kan legge til en node i roten eller under den valgte, gi den nytt navn, endre nivået, flytte den, slette den, plassere en enhet på den eller flytte en bort, og sette etikettene til en enhet. Nivålisten tilbyr bare nivåene reglene tillater, både mot forelderen og mot barna som allerede er under, og en flytting tilbyr bare foreldre en node på det nivået kan havne under, aldri noden selv eller noe under den. Serveren sjekker alt på nytt, og en avvisning (en sletting med noe fortsatt under, for eksempel) vises nøyaktig slik den skrev den. Å flytte en enhet er den samme lagringen enhetsredigereren gjør, med en `equipmentId`, så teksten følger treet som beskrevet over.

Etiketter administreres nederst på skjermen: et navn, en farge og en beskrivelse, med `label_id` valgt én gang og låst. Entiteter får plassering og etiketter fra skuffen sin på skjermen Entiteter.

Alle andre ser den samme skjermen uten noe å trykke på.
