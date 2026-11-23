---
title: "Dashbord etter rolle"
description: "Sider med kort per rolle eller skjerm: målere, trender, entitetslister og knapper, med samme oppsett på panel-PC, bærbar og telefon."
---

Et dashbord er en side med kort som noen har bygd. Målere, trender, lister over entiteter, en knapp som starter pumpa, en planløsning med temperaturene plassert der sonene er. Bygg så mange anlegget trenger, gi hvert til rollene som trenger det eller til den ene skjermen det bor på, og den gamle Board er bare ett av dem.

Det finnes i HotLoop IoT, Edge og Gateway. Edge Relay har ikke noe brukergrensesnitt og ingen dashbord. Edge-HMI-en er bygd av denne siden og ingenting annet, og det er grunnen til at resten er slik det er.

## Hvorfor det er bygd slik

**Et kort styrer ingenting.** Det første designspørsmålet for enhver side med knapper er om siden er en andre måte å kjøre anlegget på. Det er den ikke. Et kort nevner en tag, en entitet, et skript eller en oppskrift, og nettleseren gjør med dem det alle andre skjermer gjør. En skriveknapp sender `POST /api/write`. En entitets kontroller kaller `POST /api/services`. En skriptknapp åpner kjøreforespørselen på Skript-skjermen, og et oppskriftskort åpner anvendelsesskuffen på Oppskrifter-skjermen. Hver av dem har sin egen rettighet og møter skriveporten, så et dashbord kan heller ikke være en vei utenom. Det `dashboards.write` vokter, er hvem som bestemmer hva knappene er, som er en ingeniørs avgjørelse og er forbeholdt administrator av samme grunn som å skrive et skript.

Følgen: Et dashbord lagret av en administrator gjør ingenting før en operatør trykker på noe, og det trykket gjør er nøyaktig det et trykk på en hvilken som helst annen skjerm gjør, helt ned til revisjonsraden.

**Et oppsett er en flyt, ikke koordinater.** Kortene går i lesefølge. Hvert sier hvor bredt det er av tolv kolonner og hvor høyt i rader, og vet ingenting om hvor det havner. Tolv kolonner på en panel-PC, seks på en bærbar med et annet vindu ved siden av, to på et nettbrett, én på en telefon. Et oppsett med pikselposisjoner er riktig på nøyaktig den skjermen det ble tegnet på, og Edge-HMI-en må være riktig på hvilken skjerm maskinen enn har.

Følgen: Ingen bygger noen gang telefonversjonen. Det finnes ingen.

**Lagringer nevner versjonen.** At to personer redigerer ett dashbord, er noe som skjer ved skiftbytte. En lagring bærer `version`-en den ble åpnet på, og en utdatert avvises med en `409` som sier hvem som kom først. Uten det sletter den andre som trykker Lagre den første sin ettermiddag uten at noen av dem ser det.

## Modellen

```json
{
  "id": "line-2",
  "name": "Line 2",
  "description": "The extruder, for the floor.",
  "kind": "cards",
  "roles": ["operator", "admin"],
  "homeFor": ["operator"],
  "screens": ["line-2-panel"],
  "position": 1,
  "version": 3,
  "cards": [
    {"id": "temp", "type": "gauge", "title": "Zone 1", "w": 3, "h": 3,
     "config": {"tag": "press-01/Zone1_Temp"}},
    {"id": "go", "type": "button", "w": 3, "h": 1,
     "config": {"tag": "line-02/Speed", "value": 250, "label": "Run at 250", "confirm": true}}
  ]
}
```

- **`id`** er små bokstaver, sifre, bindestreker og understreker, og begynner med en bokstav. Den står i adressen og endres aldri. `wall` er veggtavlas.
- **`kind`** er `cards`, eller `wall` for veggtavla.
- **`roles`** er rollene dashbordet tilbys. Tom betyr alle roller. Den som har `dashboards.write`, ser alle dashbord uansett hva de sier, fordi vedkommende må kunne fikse det ingen andre kan åpne. En rolle som ikke tilbys ett, får en `404` for det ved navn, så listen over hva som finnes, ikke er noe en leser kan få vite ved å spørre.
- **`homeFor`** er rollene det åpnes for når de kommer inn uten en adresse som ber om noe. En rolle har høyst ett; dashbordet må tilbys rollene det er startside for.
- **`screens`** er de fysiske skjermene det er for. Et skjermnavn hører til ett dashbord.
- **`position`** ordner bryteren. Nye havner sist.
- **`cards`** står i lesefølge, opptil 60 per dashbord, 2 MB til sammen.
- **`version`** går opp med én ved hver lagring.

Et kort er `id` (unik i dashbordet, laget av siden), `type`, en valgfri `title`, `w` (1 til 12) og `h` (1 til 8), og en `config` som avhenger av typen. Utelat `w` og `h`, så brukes typens standard. En config kontrolleres strengt: en nøkkel typen ikke har, er en feil, og det som lagres, har hver standardverdi fylt ut. Et kort som nevner en tag, entitet, skript eller oppskrift som ikke finnes, avvises når dashbordet lagres. En knapp på en tag som ikke er merket skrivbar, eller en knapp med et tall utenfor taggens område, avvises også: porten ville avvist hvert trykk, og personen som bygger den, bør få høre det, ikke personen som trykker.

## Kortene

| Type | Hva det er | Config | Standardstørrelse |
|---|---|---|---|
| `status` | Enheter oppe, tagger som rapporterer, alarmer, historian, oppetid: stripen på Board | ingen | 12 x 1 |
| `gauge` | Én tag som Boards skive, med området og alarmgrensene markert | `tag` | 3 x 3 |
| `value` | Én tag som et stort tall, farget etter alarmtilstanden | `tag`, `decimals` | 3 x 2 |
| `trend` | Opptil seks tagger over 15 minutter til en uke | `tags`, `minutes`, `labels` | 6 x 3 |
| `entities` | Entitetene du velger, som egne fliser med egne kontroller | `entities` (opptil 30) | 6 x 3 |
| `alarms` | Alarmlisten, med Kvitter for den som har lov | `outstanding`, `limit`, `devices`, `equipment` | 6 x 3 |
| `button` | Skriver én verdi til én tag, etter å ha spurt | `tag`, `value`, `label`, `confirm` | 3 x 1 |
| `script` | Kjører et skript gjennom forespørselen på Skript-skjermen | `script`, `label` | 3 x 1 |
| `recipe` | Velger én av opptil åtte oppskrifter og åpner anvendelsesskuffen | `recipes` | 4 x 2 |
| `markdown` | Tekst: overskrifter, lister, fet, kursiv, kode, http(s)-lenker | `text` | 4 x 2 |
| `camera` | Et stillbilde som oppdateres, eller en bevegelses-JPEG-strøm | `url`, `stream`, `refreshSec` | 6 x 4 |
| `map` | En planløsning med levende tagger plassert på den | `image`, `markers` | 6 x 5 |
| `setpoint` | Et tall som tastes inn for én tag, med grenser, en enhet og en bekreftelse, og det enheten melder tilbake | `tag`, `label`, `min`, `max`, `step`, `unit`, `decimals`, `confirm` | 3 x 3 |
| `symbols` | Et bilde av en maskin eller en prosess: symboler plassert per piksel på en bakgrunn, forbundet med rør, tegnet fra taggene sine | `image`, `width`, `height`, `symbols`, `pipes`, `view` | 8 x 5 |

Ting som er verdt å vite om dem som ikke er opplagte:

- **`button`** sender `value` som typen den ble lagret som. Et tall er et tall, `true` er en boolsk verdi, en streng er tekst. `1` og `1.0` er ulike skrivinger på en PLS og porten avgjør etter JSON-typen, så kortet gjør ikke det ene til det andre. `confirm` er på med mindre det slås av, og da spør det «dette styrer ekte utstyr» med den gjeldende verdien og en begrunnelse som går inn i revisjonssporet (`dashboard <id> / <card>` hvis den lades tom). Å slå det av er for et panel der det å holde knappen er poenget; det er en ingeniørs avgjørelse, og «Bekreft før skriving» i Innstillinger slår det på igjen.
- **`alarms`** lister hele anleggets alarmer med mindre du peker den et annet sted. `devices` er en liste over enhets-id-er. `equipment` er en liste over utstyrsnode-id-er fra `GET /api/equipment`, på hvilket som helst nivå (et sted, et område, en linje, en celle), og en node står for hver enhet plassert på eller under den, så et områdes side kan vise områdets alarmer og ingen andres. Med begge listes en alarm når den er på en av dem. Utelat dem, eller la dem være tomme, så er kortet hele anlegget, som er det hvert kort lagret før disse feltene, gjorde. Grensen teller det som er igjen etter filteret, og `outstanding` dropper fortsatt det som er tilbake til normal og kvittert. Et kort begrenset til et sted uten alarmer sier «her», så ingen leser det som et rolig anlegg, og et kort der utstyret siden er slettet, sier det i stedet for å vise en tom liste. Utstyret lagres som nodens id, så å gi en node nytt navn eller flytte den ødelegger ikke kortet. Dashbordet avvises ved lagring hvis en enhet eller en node ikke finnes. I byggeren taster du stien (`Plant 2 / Scrubbers / Kettle 3`) og den beholder id-en. Dette kortet leser treet, så en rolle trenger `equipment.read` (operatører og lesere har det).

  ```json
  {
    "id": "kettle-alarms", "type": "alarms", "title": "Scrubber alarms", "w": 6, "h": 3,
    "config": { "outstanding": true, "limit": 10, "equipment": [14], "devices": ["oven-1"] }
  }
  ```
- **`trend`** tegner vinduet du ba om, som slutter nå, og ikke bare spennet avlesningene tilfeldigvis dekket: `minutes: 480` er en akse over de siste åtte timene med en strek ved hver hele time, i tidssonen til den som ser på. En tag som ikke har beveget seg, er en flat linje ved sin siste gode avlesning, for det er slik en stoppet mølle eller en lukket ventil ser ut, og historian beholder bare en avlesning når en verdi passerer dødbåndet, så det kan være én avlesning i vinduet, eller ingen. Ingenting på linjen er funnet på. Det taggen holdt da vinduet begynte, er den siste gode avlesningen før det (`GET /api/history` sier det med `carry=true`), og linjen er den verdien fra vinduets start til den første avlesningen i det. Etter den siste avlesningen holdes den til siste gang det ble hørt fra taggen, aldri forbi nå. Det er ingen linje før den første avlesningen noen har, og en tag der siste avlesning før vinduet var dårlig, har ingen overføring i det hele tatt, for det den holdt, er ikke kjent. Et strekk med dårlige avlesninger er et hull, som det alltid har vært. Én avlesning alene er en linje til nå, eller en prikk hvis det ikke er noe sted å tegne den til.

  Forklaringen navngir hver linje med taggens eget navn, det samme navnet talkortet viser, uten enheten foran. To linjer med samme navn fra ulike enheter beholder de fulle id-ene så du kan skille dem. `labels` er et valgfritt objekt fra en tag i `tags` til teksten du vil ha i stedet, 1 til 80 tegn, og en etikett for en tag som ikke plottes, avvises. Svevehjelpen har alltid den fulle id-en ved siden av etiketten.

  ```json
  {
    "id": "mills", "type": "trend", "title": "Mill temperatures", "w": 6, "h": 3,
    "config": {
      "tags": ["plant-5-temperatures/Large Sand Mill Temperature", "plant-5-temperatures/Small Sand Mill Temperature"],
      "minutes": 480,
      "labels": { "plant-5-temperatures/Large Sand Mill Temperature": "Large mill" }
    }
  }
  ```
- **`camera`** laster adressen i nettleseren, ikke på serveren. Et korts config kan leses av hver rolle som åpner dashbordet, så en adresse med en pålogging eller et token i, avvises når dashbordet lagres. Bruk en adresse på anleggsnettverket som ikke trenger noen, eller en proxy som legger til påloggingen. Et stillbilde hentes på nytt hvert `refreshSec` sekund med en `_hl`-spørringsparameter så nettleseren ikke viser det første for alltid.
- **`map`** er et bilde og markører. Bildet er en http(s)-adresse eller ett lastet opp i kortet (png, jpeg, webp eller gif, opptil 500 KB, lagret i kortet). Markører er tagger, plassert i prosent av bildets bredde og høyde så de blir der de ble satt i enhver størrelse. Dette er en planløsning, ikke et gatekart: et flisekart trenger en flisetjener på internett, og et anleggs panel-PC kan vanligvis ikke nå en.
- **`setpoint`** er for et tall noen taster inn: en temperatur, en hastighet, et nivå. Feltet kjenner taggens enhet (eller kortets `unit`) og grensene: `min` og `max` sammen, eller taggens eget område når kortet ikke gir noe. Et kort kan bare snevre inn taggens område, aldri utvide det, fordi skriveporten avviser en verdi utenfor taggens område uansett hva et kort sier; et kort som tilbyr mer, avvises når dashbordet lagres, og det samme gjelder et kort på en tag som holder tekst eller en bryter (bruk en `button` for dem). Utenfor grensene, utenfor `step`, eller ikke et tall, sier oppføringen det under feltet og **Sett** forblir av. **Sett** spør først, med gjeldende verdi og en begrunnelse for revisjonssporet, med mindre kortet ble bygd med `confirm` av og Innstillinger ikke overstyrer det, og da går det gjennom `POST /api/write`: hovedskrivebryteren, taggens skrivbar-flagg, rollens rettighet og revisjonsraden er de samme som for enhver annen skriving. Kortet venter så på at enhetens avlesning viser verdien og følger med to sekunder til, og sier hva enheten holder: «Lest tilbake 70 C fra enheten: det er verdien som ble sendt»; eller, hvis PLS-en tok skrivingen og brakte den tilbake til sin egen grense, «Enheten tok 70 C og endret den så til 60 C»; eller, hvis avlesningen aldri viste den, «Enheten melder 60 C, ikke 70 C». Linjen «i enheten nå» er hele tiden den levende avlesningen, så den viser også et PLS-program som overskriver verdien senere. Mens enheten ikke har noen god avlesning (en PLS som er av eller utilgjengelig), er feltet og Sett av, og kortet sier at enheten ikke svarer, fordi en skriving bare kunne blitt avvist.
- **`symbols`** er et bilde av en maskin. `width` og `height` er sidens egen størrelse i piksler (800 ganger 450 hvis utelatt), `image` er en valgfri bakgrunn (en http(s)-adresse, eller et bilde lastet opp i kortet, det samme som for `map`), og `symbols` er en liste med ting plassert per piksel fra øvre venstre hjørne: `{"id": "p1", "type": "pump", "x": 120, "y": 300, "tag": "plc/bPumpRun"}`. Siden tegnes som ett skalert bilde, så hvert symbol beholder plassen sin ved enhver kortstørrelse og på en telefon. Typene er `pump`, `motor` og `fan` (de snurrer mens taggen er på), `valve` (åpen eller stengt), `tank` (fylt mellom `min` og `max`, eller taggens område, eller 0 til 100), `heater` og `lamp` (lyser mens på), `pipe` (det som er i det beveger seg mens den valgfrie taggen er på), `readout` (tallet, med `unit` og `decimals`) og `label` (fast tekst). `invert` leser en tag andre veien, og `tone` på en lampe (`ok`, `warn`, `bad` eller `info`) er fargen den lyser i: en driftslampe er grønn og en feillampe er rød, og taggen sier bare når den lyser. Ethvert symbol kan bære to regler som leser en tag. `show` får det til å vises bare mens regelen gjelder (`"show": {"tag": "plc/bDoorOpen", "op": "off"}`): mens den ikke gjelder, tegnes ikke symbolet, og byggeren viser det utvasket så det fortsatt kan velges. `colors` er opptil fire regler, hver med en `tone` (`ok`, `warn`, `bad` eller `info`): den første som gjelder maler symbolet i den tonen, uansett hva dets egen tag sier, og når ingen gjelder tegnes det som det var. En regel er `tag`, en `op` og, for sammenligningene som trenger en, en `value`: `on` (taggen er ikke 0, standard), `off`, `eq`, `ne`, `gt`, `ge`, `lt` og `le`. En regel hvis tag ikke har noen god lesning gjelder ikke og skjuler ingenting, så en tapt forbindelse får aldri et symbol til å forsvinne. En regel kan i stedet kombinere regler: `{"all": [...]}` gjelder mens hver av dem gjelder og `{"any": [...]}` mens én gjør det (en PLS-s AND og OR), opptil tre nivåer dypt og åtte deler, og har ingen egen tag. En tapt tag får en `all` til å ikke gjelde, og en `any` gjelder gjennom de andre. En lampe kan også bære en `lit`-regel i stedet for taggen sin, for en lampe som lyser av en sammenligning eller en kombinasjon (`"lit": {"tag": "plc/Mode", "op": "eq", "value": 3}`); da trenger den ingen tag. Reglenes tagger er tagger skjermen nevner, så en skjermfil lister dem og flytter dem med resten. Et symbol sier tilstanden sin i ord i tillegg til farge (en tekst og en tittel), tegnes rødt eller varmt når taggen er i alarm eller har kommet tilbake fra en, og utvaskes med "no reading" når taggen ikke har noen god lesning. Bevegelse stopper når personen har bedt systemet sitt om mindre av den. Symbolene tegnes av HotLoop for HotLoop; ingen er lånt. Et symbol med en tag åpner den taggen når det klikkes, som en nål på en planløsning. Det styrer ingenting: sett et `setpoint`- eller `button`-kort ved siden av for det. I byggeren plukkes et symbol opp og flyttes med pekeren, eller med piltastene (Shift flytter ti piksler), eller får pikslene sine oppgitt som tall.

  **Prosesssymboler og rør.** Et symbols-kort er også et P&ID. I tillegg til typene over plasserer det `controlvalve`, `checkvalve`, `compressor`, `heatexchanger`, `filter`, `vessel`, `flowmeter`, `instrument` (en ISA-boble: `label` er bokstavene, og den viser taggens tall), `junction`, `source` og `sink`. Et symbol har `rot` (`90`, `180` eller `270`) for å vri det en kvart omdreining om gangen rundt senteret; tekst vrir seg ikke. De fleste symboler har koblingspunkter: en pumpes `in` og `out`, en tanks `top`, `bottom`, `left-1` til `left-3` og `right-1` til `right-3`, en ventils `w` og `e`, og så videre. Et rør forbinder to av dem:

  ```json
  "pipes": [
    { "id": "tank-out", "from": { "symbol": "tank-1", "port": "bottom" },
      "to": { "symbol": "p1", "port": "in" }, "medium": "water", "tag": "plc/Flow" }
  ]
  ```

  Bare det som er forbundet lagres. Siden regner ut ruten overalt der den tegner røret: rette vinkler, rundt hvert symbol på siden med klaring, med så få hjørner som mulig, og et rør som forlater et symbol forlater det den veien koblingspunktet vender. Flytt et symbol og rørene legger seg om mens det flyttes, i byggeren og i en lagret fil. En T er et `junction`-symbol med tre rør på seg (punktene `n`, `e`, `s` og `w` ligger alle i senteret), og i byggeren deler det å slippe et rør på et annet røret med en forgrening for deg. `medium` er ett av `process` (standard), `water`, `wastewater`, `fuel`, `oil`, `air`, `steam`, `gas`, `chemical`, `coolant`, `hydraulic`, `vacuum`, `nitrogen`, `power` eller `signal`. Hver har sin farge, og signal og power har også sitt eget linjemønster, så et rør skilles aldri bare på farge. `tag` (med `invert`) sier når mediet beveger seg i røret, fra `from` til `to`, og `flow` sier det med en regel, de samme reglene som `show` og `colors` på et symbol bruker. Et rør med ingen av delene tegnes fullt og stille. `label` er opptil 24 tegn langs røret. Et rør holder én tag eller én regel, ikke begge. En side rommer opptil 120 symboler og 240 rør.

  **Verktøylinjen.** Hvert symbols-kort har, når det vises og når det bygges, en verktøylinje øverst til høyre: zoom inn, zoom ut, tilpass siden, minikartet og høyytelsesvisningen. Zoom er også Ctrl og hjulet (et vanlig hjul fortsetter å rulle dashbordet), `+`, `-` og `0` på siden; dra siden for å panorere. Når du har zoomet inn, viser minikartet hele siden med en ramme der du er, og å trykke eller dra på det tar deg dit. Høyytelsesvisningen er den grå ISA-101-siden: grått utstyr og grå rør, en mørkere fyll for i drift eller åpen i stedet for grønt, rørets medium som en kort kode ved siden av (W for vann, S for damp, SIG for signal), og en farge bare på det som er i alarm eller malt av en regel. `view` satt til `hp` får en side til å åpne i den; verktøylinjen bytter begge veier for den som ser, og ingenting lagres av det. Flyt animeres bare når personen ikke har bedt systemet sitt om mindre bevegelse.
- **`markdown`** bygges til DOM-noder og aldri til HTML, så ingenting som tastes inn i det, kan bli markup eller et skript.
- **`gauge`, `value`, `map`, `setpoint`** viser «ikke lenger på denne gatewayen» hvis taggen slettes etter at dashbordet ble lagret, i stedet for en skive som aldri beveger seg.

## Veggtavla

Veggtavla er dashbordet `wall`, av typen `wall`. Den er alltid der, kan ikke slettes, og har ingen kort: målerne er taggene festet på Board-skjermen, holdt i tavlas egen innstilling der de alltid har vært. `GET` og `PUT /api/board`, adressen `#board`, festevelgeren og dragingen for å ordne er urørt.

Det den får av å være et dashbord, er bryteren (den er den første pillen på hvert dashbord og Board har linjen også) og tilordningene: den kan tilbys noen roller, være en rolles startside og være en fysisk skjerms. En TV på veggen åpner `/?screen=wall-tv` og får Board uten topptekst og faner.

## Roller og skjermer

**Per rolle.** `roles` bestemmer hvem som tilbys et dashbord. `homeFor` bestemmer hvor en rolle havner. En operatør med `line-2` som startside åpner HotLoop på Linje 2. Med et URL-fragment i adressen (`#alarms`) åpnes siden der adressen sier.

**Per skjerm.** En skjerm er en fysisk skjerm. Åpne HotLoop på `/?screen=<name>`, så viser den dashbordet der `screens` har det navnet, uten topptekst, uten faner og med større trykkflater, fordi ingen som går forbi en panel-PC trenger en vei ut av siden. Et navn ingen dashbord har, sier det i stedet for å vise noe annet.

**Et panel logger inn personer, ikke seg selv.** Når ingen er innlogget, viser det ett felt «PIN eller adgangskort». En operatør taster PIN-en sin, eller skanner adgangskortet (en tastaturlesende leser taster det inn i feltet), og panelet åpner dashbordet. Navnet og en **Logg ut**-knapp sitter i hjørnet, siden toppteksten som ville vist dem, er borte. Hver skriving en knapp på dashbordet gjør, går gjennom skriveporten som den personen, og revisjonssporet og loggboken navngir dem: «olga skrev 250 til line-02/Speed», ikke «panel-3». Etter femten minutter der ingen rører skjermen (en innstilling) logger panelet dem ut og går tilbake til feltet, og en skriving sendt etter det avvises. En administrator gir hver person en kode under **Innstillinger, Brukere**. Det hele, hva et adgangskort er, hvordan koden lagres og hva den ikke gjør, står i [Autentisering og brukere](/nb/iot/authentication/#kioskpaneler-pin-eller-adgangskort-og-utlogging-ved-inaktivitet).

På din egen datamaskin gjelder ingenting av dette: du er innlogget med passordet ditt, en knapps skriving går rett gjennom porten og logger deg, og det er ingen utlogging ved inaktivitet. Et panel som var innlogget med en fast operatørkonto, slik et panel måtte drives før PIN-ene, virker fortsatt og skriver fortsatt som den kontoen. Gi ikke et delt panel en slik pålogging.

Dette er hva Edge-HMI-en er: et dashbord med `screens` satt, på en maskin som åpner den adressen, med personene ved den innlogget med PIN eller adgangskort.

## Bygge

Den som har `dashboards.write` (administratorer), ser **Rediger** på et dashbord og **Nytt dashbord** i linjen. Under redigering:

- er kortene inerte, så å gripe en knapp for å flytte den, ikke kan trykke den;
- dra et kort til et annet for å sette det der, eller bruk pilene i verktøylinjen, som er det en telefon har, fordi en berøringsskjerm ikke starter et drag;
- dra hjørnet for å endre størrelse: bredden hekter seg på en kolonne av tolv, høyden på en rad;
- tannhjulet redigerer kortet, kopiknappen dupliserer det, krysset sletter det;
- **Innstillinger** er navnet, hvem det tilbys, hvem det åpnes først for, de fysiske skjermene og plassen i bryteren.

Ingenting lagres før **Lagre**. **Forkast** kaster endringene. En `409` ved lagring betyr at noen lagret først: siden tilbyr å laste deres.

**Eksporter** (ved siden av Rediger) lagrer dashbordet på skjermen som en fil, og **Importer** (i linjen ved siden av Nytt dashbord, for den som har `dashboards.write`) laster ett inn i denne installasjonen, så en skjerm er kundens data og flyttes mellom installasjoner uten at noen bygger den på nytt. Se [Skjermfiler](/nb/iot/screen-file/).

## Oppsett

| Bredde | Kolonner | Et kort med `w` tar |
|---|---|---|
| Over 1100 px | 12 | `w` |
| 700 til 1100 px | 6 | halvparten av `w`, rundet opp |
| 480 til 700 px | 2 | én, eller begge når `w` er over 4 |
| Under 480 px | 1 | hele |

Radene er 76 px med et mellomrom på 16 px på de brede oppsettene. På en telefon er et kort så høyt som innholdet med et gulv fra radene, så ingenting kuttes. Bryteren ruller sideveis inni seg selv og siden gjør aldri det.

## På en telefon

Web-grensesnittet kan installeres på en telefon og åpnes uten tilkobling. Det er den samme siden med et manifest, ikoner og en service worker, servert av HotLoop selv, så det er ingenting å bygge og ingenting å installere på serveren.

**Installere det.** På Android har Chromes meny **Installer app**. På en iPhone har Safaris Del-ark **Legg til på Hjem-skjerm**. Det åpnes i fullskjerm, med anleggets navn, og på Android gir et langt trykk på ikonet Alarmer og Dashbord. En nettleser installerer bare en side og kjører en service worker over **https**, eller på `localhost`. På et anleggs vanlige `http://`-adresse åpnes HotLoop fortsatt i en fane akkurat som alltid, men det kan ikke installeres og vil ikke virke frakoblet. Sett et sertifikat foran for telefonene (ingressen eller reverse proxyen du allerede har). Nettleseren forteller deg hvorfor den ikke installerer: Chromes utviklerverktøy, Application, Manifest.

**Hva den beholder.** Selve siden, og det siste svaret på avlesningene en person ser på: alarmlisten, dashbordene, avlesningene og entitetstilstandene, enhetene og taggene, statusen, utstyrstreet og board. Mens siden er åpen og tilkoblet, spør den om disse én gang i minuttet så det er noe å åpne til, og ikke mens telefonen ligger i en lomme. Åpne den uten tilkobling, så lastes siden, alarmlisten og dashbordene viser det telefonen sist så, og en linje nederst sier det, med klokkeslettet:

```
Offline. This is what this phone last saw as of 10/22/2026, 05:42:23. Nothing you
do here is sent until the connection is back.
```

Når tilkoblingen er tilbake, innen noen få sekunder, forsvinner linjen, skjermen oppdateres fra levende svar og den levende strømmen kobler til igjen.

**Frakoblet og aldri innlogget.** En telefon som har appen men ikke er innlogget (den var det aldri, eller den logget ut, noe som tømmer det den hadde beholdt), har ingenting å vise uten tilkobling, så den viser innloggingsskjermen og sier hvorfor: HotLoop svarer ikke herfra, og den fortsetter å prøve. I det øyeblikket HotLoop svarer, laster siden seg selv på nytt inn i den ekte innloggingen. Den viser aldri en app med ingenting i.

**Hva den aldri gjør.** Ingenting som endrer noe, sendes fra en frakoblet side. En skriving, enten det er en verdi til en tag, et skript, en oppskrift eller en kvittering, avvises før den forlater siden, med begrunnelsen:

```
You are offline, so nothing was sent. Everything here is as of 10/22/2026, 05:42:23.
Try again when the connection is back.
```

Service worker svarer ikke på, beholder ikke og køer ikke en skriving, og det er ingen bakgrunnssynkronisering i den. En kommando til utstyr sendes bare av en person som ser på et levende svar, og en knapp trykket uten tilkobling venter ikke et sted på å gå ut senere. Å kvittere fra et varsel er noe eget og trenger nettverket på samme måte: ntfy-appen trykker sin egen knapp.

**Hva den ikke beholder.** Den levende strømmen, trender og historikk, loggboken, innstillingene, brukerne, eskaleringspolicyen og alt om varsler. Noe er for stort og ulikt hver gang til å være verdt å beholde, og noe inneholder ting (folks ntfy-emner, kontoer) som ikke hører hjemme i en telefons hurtigbuffer, så de skjermene trenger at HotLoop svarer.

**På telefonen.** Det som beholdes, bor i nettleserens hurtigbufferlagring på den telefonen, høyst 200 svar, de eldste droppes først. **Utlogging tømmer den**, og det gjør også en økt som har utløpt eller er tilbakekalt (den første `401` tømmer den). Bare en innlogget økt blir noen gang beholdt, så en frakoblet telefon åpnes aldri på andres data. En ny HotLoop-versjon får en egen sidehurtigbuffer og den gamle slettes; siden hentes levende når det er tilkobling, så en ny versjon eller et omdøpt anlegg vises ved neste åpning.

Den samme testen tar serveren bort, for siden og workeren likt, og laster på nytt: Siden åpnes, alarmlisten og et dashbord viser det som ble beholdt, en skriving til en tag og en Kvitter avvises begge, alarmen er fortsatt ukvittert og skriverevisjonen tom etter at tilkoblingen er tilbake, og utlogging tømmer det som ble beholdt. Kjørt på ekte maskinvare (2026-11-17), inkludert installasjon på en ekte telefon, Safari på en iPhone, og at Wi-Fi-et i et ekte anlegg falt ut.

## Rettigheter

| Rettighet | Leser | Operatør | Administrator |
|---|---|---|---|
| `dashboards.read` | ja | ja | ja |
| `dashboards.write` | nei | nei | ja |

Å lese er hver rolles, filtrert av `roles`. Å skrive er administratorens. Det et kort kan gjøre når det trykkes, er den trykkende personens egne rettigheter: en leser ser en skriveknapp deaktivert, og serveren ville avvist den hvis de kom forbi det.

## API-et

| Metode | Rute | Rettighet |
|---|---|---|
| `GET` | `/api/dashboards` | `dashboards.read` |
| `POST` | `/api/dashboards` | `dashboards.write` |
| `GET` | `/api/dashboards/{id}` | `dashboards.read` |
| `PUT` | `/api/dashboards/{id}` | `dashboards.write` |
| `DELETE` | `/api/dashboards/{id}` | `dashboards.write` |
| `GET` | `/api/dashboards/{id}/export` | `dashboards.read` |
| `POST` | `/api/dashboards/import` | `dashboards.write` |

Referansen med kropper og feil står i [HTTP-API-et](/nb/iot/api/#dashbord). Hver opprettelse, lagring og sletting står på protokollen som en `config`-hendelse på subjektet `dashboard:<id>`, så loggboken sier hvem som endret det et panel viser.

Tabellen er `dashboards`, lagt til i migrering 0023 for PostgreSQL, TimescaleDB og SQLite. Den bare legger til ([Migreringer legger bare til](/nb/iot/migrations/)). Veggtavlas rad lages av applikasjonen første gang den blir bedt om, ikke av migreringen, så en database gjenopprettet fra en sikkerhetskopi tatt før dashbord har den igjen.

## Hva som ikke er her

- **Pikselnøyaktige oppsett.** Med vilje, se over. Hvis en maskins HMI virkelig trenger en kontroll på et fast sted, er det en skjerm bygd for den maskinen, og det er ikke det dette er.
- **Synlighet per kort.** Et dashbord tilbys roller; et kort ikke. To målgrupper med ulike kort er to dashbord.
- **Et flisekart.** Se `map`-kortet.
- **Å holde en knapp.** En knapp skriver én gang når den trykkes. En momentan kontroll som skriver ved trykk og igjen ved slipp, er et annet kort og er ikke bygd.
- **Dashbord i Edge Relay.** Det har ikke noe brukergrensesnitt.
