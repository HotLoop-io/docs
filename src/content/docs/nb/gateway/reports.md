---
title: "Planlagte rapporter"
description: "Historian-tall etter tidsplan som CSV eller HTML, lagret og sendt på e-post: bare gode målinger teller, og hver rad sier hvor mange som ble forkastet."
---

Planlagte rapporter kjører siden 4.14.0 operatørdefinerte rapporter etter tidsplan: de spør historianen, lager resultatet som CSV og HTML, lagrer det på et volum og sender det eventuelt på e-post. Det er motstykket til Ignitions Reporting-modul for den delen av modulen et anlegg bruker oftest, en tabell med tall levert i tide. Av som standard (`HOTLOOP_REPORTS_ENABLED`).

## Hva det er, og hva det ikke er

- **Bare API.** Det finnes ingen skjerm for dette i denne versjonen. Rapporter defineres, kjøres, listes og lastes ned gjennom `/api/reports`. Et brukergrensesnitt er et eget arbeid.
- **Bare CSV og HTML.** Ingen PDF. Å lage en god PDF i ren Go, uten noen ekstern binærfil (kjøretidsbildet har ingen, med vilje), betyr å velge et PDF-bibliotek og en layoutmotor, og det er en egen beslutning. HTML-filen er selvstendig og skrives ut pent fra hvilken som helst nettleser, noe som foreløpig dekker «jeg trenger en PDF».
- **Tabeller med aggregater, ikke fri layout.** En rapport er en liste med tagger, et vindu, en bøttestørrelse og et sett med aggregeringer. Det er ikke en sidedesigner.
- **Én Gateway-instans.** Planleggeren forutsetter at den er den eneste som kjører rapporter mot denne databasen. To replikaer ville hver utløst hver rapport. Dette chartet kjører én replika, og rapportvolumet er `ReadWriteOnce`.
- **Ikke en alarmfunksjon.** Alarm-e-post er en egen funksjon, [alarmvarsler](/nb/iot/notifications/). Rapportene deler SMTP-relé-innstillingene med den og ingenting annet.

## En rapportdefinisjon

Definisjoner er operatørredigerte data, lagret i databasen som enheter, tagger, alarmdefinisjoner og flåtemedlemmer, og håndtert gjennom API-et. Eksempel:

```json
{
  "id": "line1-daily",
  "name": "Line 1 daily summary",
  "enabled": true,
  "tags": [
    {"deviceId": "press-01", "tagName": "Zone1_Temp"},
    {"deviceId": "press-01", "tagName": "Pressure"}
  ],
  "window": {"count": 1, "unit": "days", "end": "local_midnight"},
  "bucket": "hour",
  "aggregations": ["min", "max", "avg", "count"],
  "schedule": {"kind": "daily", "at": "03:00"},
  "format": "both",
  "recipients": ["ops@example.com"],
  "retain": 30
}
```

| Felt | Betydning |
|---|---|
| `id` | 1 til 64 tegn av bokstaver, sifre, punktum, bindestrek eller understrek, som starter med en bokstav eller et siffer. Den gir navn til rapportens katalog på volumet, så den valideres som alle andre id-er i dette programmet. |
| `name` | Vises i HTML-tittelen og e-postens emne. Ingen kontrolltegn. |
| `enabled` | Om planleggeren kjører den. En deaktivert rapport kan fortsatt kjøres for hånd. |
| `tags` | 1 til 50 par av enhet og tag. Hvert må finnes når definisjonen lagres, og må ikke være en tekst-tag. |
| `window` | Historikkspennet hver kjøring dekker. Se nedenfor. |
| `bucket` | `window` (én rad per tag), `hour` eller `day`. Standard er `window`. |
| `aggregations` | Én eller flere av `min`, `max`, `avg`, `first`, `last` eller `count`, hver høyst én gang. |
| `schedule` | Se nedenfor. |
| `format` | `csv`, `html` eller `both`. Standard er `csv`. |
| `recipients` | Valgfritt. Bare enkle adresser (`ops@example.com`, ikke `Ops <ops@example.com>`). Høyst 20. |
| `retain` | Hvor mange kjøringer som beholdes. 1 til 1000. Standard er 30. |

`PUT` erstatter hele definisjonen. En klient kan lese en rapport, endre ett felt og sende den tilbake som den er: de skrivebeskyttede feltene serveren legger til (`nextRunAt`, `lastRun`, `lastRunAt`, `createdAt` og `updatedAt`) godtas og ignoreres.

En definisjon som ville gitt mer enn 1000 bøtter, avvises når den lagres (for eksempel timesbøtter over mer enn omtrent 41 dager).

## Vinduer

Et vindu er relativt til når kjøringen skjer.

| Du vil ha | `count` | `unit` | `end` |
|---|---|---|---|
| De forrige 24 timene | 24 | `hours` | `run_time` |
| Den forrige kalenderdagen | 1 | `days` | `local_midnight` |
| De forrige 7 hele dagene | 7 | `days` | `local_midnight` |
| En rullerende uke | 7 | `days` | `run_time` |

- `end` er øyeblikket kjøringen starter, eller, for `local_midnight`, den siste lokale midnatten ved eller før det. En kjøring klokken 03:00 som slutter ved lokal midnatt dekker hele kalenderdager.
- **Timer er medgått tid. Dager er kalenderdager** i anleggets tidssone. Et ettdagersvindu som slutter ved lokal midnatt er hele én lokal dag, som er 23 timer lang den dagen klokkene stilles fram og 25 den dagen de stilles tilbake. «De forrige 24 timene» er alltid nøyaktig 24 timer.
- **Et vindu er halvåpent**: det inkluderer starten og utelukker slutten. En måling stemplet nøyaktig ved midnatt hører til dagen som starter der. To påfølgende dagsrapporter teller aldri begge en måling og går aldri begge glipp av den.
- En manuell kjøring og en innhentingskjøring beregner vinduet ut fra øyeblikket de kjører.

## Bøtter

- `window`: én rad per tag over hele vinduet.
- `hour`: én rad per tag per lokal klokketime. Et vindu som ikke starter på hel time, begynner med en kortere delbøtte, og et som ikke slutter på hel time, slutter med en. Timene holder seg på hel time gjennom en klokkeendring og i soner der forskyvningen ikke er et helt antall timer.
- `day`: én rad per tag per lokal kalenderdag.

Hver tag har en rad for hver bøtte, også bøtter uten innhold. Rapporten utelater aldri timen en sensor var stille, for en rapport som i stillhet lot raden falle, ville sett lik ut som en for en sensor som ikke hadde noe å si. Hver rad oppgir nøyaktig spennet den dekker (`period_start` og `period_end`, med UTC-forskyvninger), slik at en dag på 23 timer vises som det.

## Aggregeringer og kvalitetsregelen

Aggregeringene er `min`, `max`, `avg`, `first` (den tidligste målingen i perioden etter tidsstempel), `last` (den seneste) og `count`.

Rapporter følger kvalitetsregelen, den samme som trenddiagrammet følger, slik at en rapport og en trend over samme time stemmer overens. En måling uten tallverdi (en tekstmåling) utelates også. Det finnes ingen bryter for det: et gjennomsnitt som i stillhet blander inn målinger historianen selv har markert som upålitelige, er verre enn en rapport som sier hvor mange den ikke brukte.

Hver rad har derfor en `excluded`-kolonne: hvor mange målinger i den perioden som ble utelatt. `count` er hvor mange som ble brukt. Kjørepostene og e-posten har totalene.

**Ingenting blir diktet opp.** En tag uten brukbar måling i en periode har ikke noe minimum, og rapporten sier det: cellene er tomme i CSV og viser `no data` i HTML. De er aldri null. Null er en måling (en lukket ventil, en strøm av ingenting) og aggregeres som enhver annen verdi. `count` er den ene kolonnen som er et tall når det ikke finnes data, fordi null er en sann telling av ingenting.

## Tidsplaner og tid

En tidsplan er en av disse:

```json
{"kind": "interval", "every": "6h"}
{"kind": "daily",    "at": "03:00"}
{"kind": "weekly",   "weekday": "monday", "at": "06:30"}
```

- Et **intervall** er medgått tid (minst ett minutt) og ignorerer veggklokka.
- **Daglige og ukentlige** tider er veggklokketider i anleggets tidssone, som er `HOTLOOP_TIMEZONE` (chartets `global.timezone`). Den må være et ekte sonenavn som `America/Chicago`. Et ubrukelig navn er en avvist oppstart, med rapporter på eller av, ikke en stille tilbakegang til UTC, for en rapport ment for 03:00 lokal tid som utløses 03:00 UTC er en feil ingen ser før tallene er gale.

### Sommertid

Neste kjøring beregnes ved å bygge en veggklokketid på anleggets sted med `time.Date`. Den beregnes aldri ved å legge til 24 timer på forrige kjøring, som utløses en time for tidlig eller en time for sent fra én klokkeendring til den neste. To veggklokketider er vanskelige på en endringsdag, og regelen for hver er fastsatt i koden i stedet for å overlates til `time.Date`, hvis oppførsel for begge er dokumentert som uspesifisert:

- **En tid som ikke finnes** (02:30 på dagen klokka stilles fram, når den hopper fra 02:00 til 03:00) utløses i første øyeblikk etter hullet, 03:00. Den kjører forsinket med høyst hullets størrelse og hopper ikke over dagen.
- **En tid som inntreffer to ganger** (01:30 på dagen klokka stilles tilbake) utløses én gang, ved sin første forekomst.

### last_run_at, neste kjøring og innhenting

`last_run_at` er når planleggeren sist **startet** rapporten, enten den kjøringen så lyktes eller feilet. En manuell kjøring flytter den ikke, så å kjøre en rapport for hånd klokken 02:00 avlyser ikke kjøringen klokken 03:00 i natt.

Neste kjøring er den første planlagte tiden etter den seneste av definisjonens opprettelse, siste redigering og `last_run_at`. At det måles fra siste redigering betyr at å flytte en rapport fra 03:00 til 09:00 klokken 10:00 venter til i morgen i stedet for å utløses straks for en tid som allerede var passert.

**Innhenting.** Hvis neste kjøring etter `last_run_at` allerede er i fortiden når Gateway starter, var ikke Gateway der for å gjøre den, og rapporten kjører **én gang**, straks, merket `catchup`. Den kjører ikke én gang per tapte tid: en daglig rapport som gikk glipp av tre dager, kjører én gang, den dagen Gateway kommer tilbake, med vinduet det betyr fra nå. De tapte dagene etterfylles ikke. Etter det er rapporten tilbake på tidsplanen.

`last_run_at` skrives **før** kjøringen starter, slik at en Gateway som dør midt i en kjøring ikke gjentar kjøringen ved omstart oppå en e-post som kanskje allerede er gått ut. Den avbrutte kjøringen registreres i stedet som mislykket. En mislykket planlagt kjøring prøves ikke på nytt; neste planlagte tid kjører vanlig, og `POST /api/reports/{id}/run` finnes når noen vil ha den igjen.

## Utdata

Hver kjøring skriver filene sine under `HOTLOOP_REPORTS_DIR` (`/data/reports`, en PVC i chartet):

```
/data/reports/<report id>/<UTC timestamp>-<run id>.csv
/data/reports/<report id>/<UTC timestamp>-<run id>.html
```

- **Filnavn bygges bare av en validert id, et UTC-tidsstempel og kjøringens heltalls-id.** Path traversal er stengt ved konstruksjon: rapport-id-en må oppfylle den samme identifikatorregelen som overalt ellers, og et filnavn lest tilbake fra en kjørepost matches mot det nøyaktige mønsteret over før det åpnes. `{run}` i en nedlastings-URL tolkes som et heltall og brukes bare til å slå opp kjøreposten sammen med rapport-id-en. Filen som åpnes, er den posten navngir. Ingenting fra URL-en blir en del av en sti.
- Filer opprettes med `O_EXCL` og modus `0640`, og kataloger med `0750`. En fil som allerede finnes, er en feil og overskrives aldri. Utdataene inneholder anleggsdata og tag-navn, så modusen er et gulv, ikke en erstatning for å beskytte volumet.
- **Oppbevaring.** Etter hver kjøring beholdes de nyeste `retain` kjøringene som lagret filer, og eldre slettes med filene sine. Mislykkede kjøringer, som ikke har filer, beholdes hver for seg (de nyeste `retain` av dem), slik at en rekke feil ikke kan skyve ut den siste gode rapporten. Enhver fil i rapportens katalog som samsvarer med navnemønsteret men ikke er referert av noen gjenværende kjørepost (delfilen fra en kjøring som døde), fjernes også. En fil som ikke samsvarer med mønsteret, for eksempel en en operatør har lagt der, blir latt i fred.

### CSV

RFC 4180, fra `encoding/csv`, med CRLF-linjeslutt. Kolonnene er `device_id`, `tag_name`, `unit`, `period_start`, `period_end`, én kolonne per aggregering i den rekkefølgen definisjonen lister dem, og `excluded`. Tidsstempler er RFC 3339 i anleggets tidssone med forskyvningen. Tall skrives med full presisjon.

**Formelinjeksjon i regneark.** Et tag-navn eller en enhet er tekst noen har skrevet, og et regneark leser en celle som begynner med `=`, `+`, `-` eller `@` som en formel. Enhver tekstcelle som begynner med ett av disse (eller med en tabulator eller et vognretur, eller et mellomrom etterfulgt av ett) får en apostrof foran, som regneark behandler som «dette er tekst» og ikke viser. De numeriske kolonnene skrives fra tall, så en negativ måling blir latt være og leses fortsatt som et tall.

Filen har ingen byte order mark. Excel åpner en UTF-8 CSV uten den som om den var en gammel kodetabell, så et tag-navn med ikke-ASCII-tegn må kanskje importeres som UTF-8.

### HTML

Én selvstendig fil, bygget med `html/template`, slik at tag-navn og verdier escapes for stedet de havner: en tag som heter `<script>` skrives som tekst. Stilarket er innebygd, og det finnes ikke noe skript, skrift, bilde eller lenke til noe sted, fordi installasjoner kan være luftgapet. Den har også en `Content-Security-Policy`-metakode som forbyr å laste noe som helst, og API-et leverer den med en policy som legger til `sandbox`, som vedlegg.

## Levering på e-post

Hvis en rapport har `recipients`, sender hver kjøring filene som vedlegg på e-post, gjennom SMTP-releet konfigurert under `HOTLOOP_NOTIFY_SMTP_*` (vert, port, brukernavn, passord, avsender, TLS). Bare releet deles med alarmkanalen: om den kanalen er aktivert, og hvem alarmer går til, har ingen virkning på rapporter, så en installasjon kan sende rapporter på e-post uten å varsle noen. Chartet skriver releets variabler for rapportene alene når alarmkanalen er av.

Det er den samme SMTP-koden som alarmkanalen, ikke en andre kopi. Alarmkanalen sender nå også gjennom den. Tilkoblingshåndteringen er uendret (port 465 snakker nå TLS fra første byte, se [Alarmvarsler](/nb/iot/notifications/#implicit-tls-port-465)): STARTTLS når releet tilbyr det, `AUTH` når påloggingsinformasjon er satt, og en hard feil før `AUTH` når `HOTLOOP_NOTIFY_SMTP_TLS` er satt og releet ikke tilbyr STARTTLS. For en ASCII-alarm er meldingen de samme bytene som før, bortsett fra `Date`-headeren, og en test fastslår det. Et ikke-ASCII alarmemne sendes nå som et RFC 2047-kodet ord i stedet for rå UTF-8.

Meldingen er `multipart/mixed`: en quoted-printable tekstdel, deretter hver fil base64-kodet. **Header-injeksjon avvises, ikke renses.** Mottakere, avsender, emne og vedleggsfilnavn valideres: en verdi med CR, LF eller et annet kontrolltegn, en mottaker i visningsnavnform eller som inneholder en liste, eller et filnavn med et anførselstegn eller en sti får meldingen til å feile før noe sendes til releet. Alarmkanalens eget emne er det eneste unntaket, fordi en varsling må gå ut uansett hva en alarm heter: den gjør først kontrolltegn om til mellomrom.

- **Ingen reléoppsett.** En rapport med mottakere kjører likevel og lagrer filene sine, og kjøringen registreres som `failed`, med `emailStatus` `failed` og en feil som sier at releet ikke er konfigurert. Den lykkes ikke i stillhet.
- **For stor.** `HOTLOOP_REPORTS_MAX_EMAIL_BYTES` (10 MiB) setter tak på vedleggsdataene i én e-post. En rapport over det lagres og kan lastes ned, og kjøringen registrerer hvorfor den ikke ble sendt på e-post.
- En kjøring gjort for hånd kan hoppe over e-posten med `?deliver=false`.

## Kjøreposter og revisjonssporet

Hver kjøring registreres i `report_runs` fra det øyeblikket den starter: når den startet og sluttet, utløseren (`schedule`, `catchup` eller `manual`), hvem som ba om den, vinduet, utfallet og feilteksten, antall tagger, rader, aggregerte målinger og utelatte målinger, filene som ble lagret, e-postutfallet og mottakerne, og notater (for eksempel at en tag siden er slettet og rapporteres fra sin registrerte historikk). Suksess og feil skrives også gjennom `rt.Event`, det samme revisjonssporet alarmer og flåtehandlinger bruker, med rapport-id-en som subjekt.

En kjøring avbrutt av nedstenging, av tidsgrensen (`HOTLOOP_REPORTS_RUN_TIMEOUT`) eller av at rapporten slettes, registreres som mislykket med den årsaken. En kjøring en prosess som døde lot stå som `running`, merkes som mislykket neste gang Gateway starter. Bare én kjøring av en rapport pågår om gangen; en andre forespørsel mens en kjører, gir en `409`.

## API

| Rute | Tillatelse | <span class="sr-only">Detaljer</span> |
|---|---|---|
| `GET /api/reports` | `reports.read` | Hver definisjon, hver med sin `nextRunAt` og siste kjøring |
| `POST /api/reports` | `reports.write` | Opprett. `409` hvis id-en finnes |
| `GET /api/reports/{id}` | `reports.read` | Én definisjon |
| `PUT /api/reports/{id}` | `reports.write` | Erstatt. Id-en kan ikke endres |
| `DELETE /api/reports/{id}` | `reports.write` | Slett, med kjøringer og filer. En pågående kjøring avbrytes først |
| `POST /api/reports/{id}/run` | `reports.run` | Kjør nå og vent. `?deliver=false` hopper over e-posten |
| `GET /api/reports/{id}/runs` | `reports.read` | Kjøreposter, nyeste først (`?limit=`, opptil 500) |
| `GET /api/reports/{id}/runs/{run}/download?format=csv\|html` | `reports.read` | Strøm én lagret fil som vedlegg |

`POST .../run` returnerer kjøreposten med `200` enten kjøringen virket eller ikke. Statusen sier om forespørselen ble utført, og postens egen `status` sier om rapporten ble det. En kjøring som feiler er et resultat, og den registreres uansett. Kjøringen er ikke knyttet til klientens tilkobling: å legge på avbryter ikke en rapport som kanskje allerede har startet en e-post.

Med funksjonen av svarer listen `{"reports": [], "configured": false}` og hver annen rute svarer med en feil som nevner `HOTLOOP_REPORTS_ENABLED`.

### Hvem som kan gjøre hva

| Rolle | `reports.read` | `reports.run` | `reports.write` |
|---|---|---|---|
| leser | ja | nei | nei |
| operatør | ja | ja | nei |
| administrator | ja | ja | ja |

- **Lese** er for lesere fordi en lagret rapport er aggregater av historikk en leser allerede kan lese gjennom `values.read`, så å lese eller laste ned en gir ikke noe nytt.
- **Kjøre** er for operatører fordi å kjøre en rapport bare leverer til mottakerne en administrator allerede har valgt, og den kan kjøres uten å levere.
- **Skriving er bare for administratorer.** En definisjon navngir adressene utdataene sendes til på e-post, så å kunne definere en er å kunne sende anleggsdata til en vilkårlig adresse etter tidsplan. Det ligner mer i art på `notify.test` og `fleet.config` (også bare for administratorer, også «gjøre noe mot omverdenen») enn på en lesing. Det er et skjønnsspørsmål, og kan tas opp igjen hvis en ekte arbeidsflyt trenger at operatører bygger rapporter.
- En operatør kan fortsatt få en e-post til å gå til en rapports mottakere ved å kjøre den, gjentatte ganger. Det finnes en én-kjøring-om-gangen-sperre og `?deliver=false`, men ingen hastighetsbegrensning.
- En bruker med en eksplisitt tillatelsesliste har akkurat det den navngir; jokertegnet `reports.*` dekker alle tre.

## Konfigurasjon

| Variabel | Standard | <span class="sr-only">Detaljer</span> |
|---|---|---|
| `HOTLOOP_REPORTS_ENABLED` | `false` | Funksjonen er av, planleggeren inkludert, til dette settes |
| `HOTLOOP_REPORTS_DIR` | `/data/reports` | Hvor hver kjørings filer skrives. Ment å være en PVC (`reports.persistence` i chartet) |
| `HOTLOOP_REPORTS_RUN_TIMEOUT` | `5m` | Avgrenser én kjøring: spørring, gjengivelse, skriving og e-post |
| `HOTLOOP_REPORTS_MAX_EMAIL_BYTES` | `10485760` | Største mengde vedleggsdata i én e-post |
| `HOTLOOP_TIMEZONE` | `UTC` | Anleggets tidssone. Må være et ekte sonenavn, ellers starter ikke HotLoop |
| `HOTLOOP_NOTIFY_SMTP_HOST`, `_PORT`, `_USERNAME`, `_PASSWORD`, `_FROM`, `_TLS`, `_TLS_SKIP_VERIFY` | | Releet rapportene sender e-post gjennom. Se [Alarmvarsler](/nb/iot/notifications/) |

Chartets `reports`-blokk har `enabled`, `runTimeout`, `maxEmailBytes` og `persistence` (størrelse, lagringsklasse, tilgangsmodus). `notify.smtp` leverer releet. Rapporter startes ikke i `--mcp-stdio`-modus, der en agent starter binærfilen som hjelper, og en andre planlegger ved siden av den ekte Gateway ville kjørt hver forfalt rapport to ganger.

## Sikkerhetskopier

Rapportdefinisjoner og kjøreposter er brukerdata og del av databasens sikkerhetskopi. Utdatafilene er det ikke: de ligger på rapportvolumet, og å gjenopprette en sikkerhetskopi i en ny utrulling bringer postene tilbake men ikke filene, så å laste ned en gammel kjøring der svarer at filen ikke lenger er på disken. Kopier rapportvolumet hvis filene betyr noe.

Å legge disse to tabellene til sikkerhetskopilisten er den typen endring som er lett å glemme, så sikkerhetskopipakken har nå vern for det. En test lister hver tabell i skjemaet og feiler hvis noen ikke står verken i `backup.Tables` eller i en eksplisitt utelatelsesliste med en begrunnelse. En annen sjekker at `Tables` står i fremmednøkkelrekkefølge, og leser fremmednøklene fra databasen. Rundturstesten sår en rapportdefinisjon og en kjøring og sjekker de gjenopprettede verdiene og sekvensen.

## Hva som er og ikke er verifisert

HotLoop er kjørt mot ekte utstyr og ekte servere, og på bare metal 2026-11-17.
