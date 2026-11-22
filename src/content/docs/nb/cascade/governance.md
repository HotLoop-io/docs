---
title: "Styre en Cascade-instans"
description: "Variabler, mapper, kommenterte kjøringer, sladding, Insights, eksterne hemmeligheter og loggstrømming, for et anlegg med stadig flere arbeidsflyter."
---

Hvordan et anlegg holder kontroll på en voksende haug med arbeidsflyter: felles innstillinger, mapper, kommenterte kjøringer, sladding, tall over tid, eksterne hemmeligheter, loggstrømming og hvor store data lever. Alt dette er gratis og med i hver build.

Hvert endepunkt som nevnes nedenfor står i OpenAPI-dokumentet på `/api/v1/openapi.json`, og hvert av dem har en test som kaller det, på SQLite og på Postgres.

## Variabler

I editoren: Variabler, i den øverste linjen. De som gjelder hele instansen, står øverst, og hvert prosjekts under navnet sitt. Du får bare tilbudt det rollen din tillater.

En variabel er en navngitt verdi som en arbeidsflyt leser som `vars.NAME`: en øvre grense for et settpunkt, navnet på et anlegg, en basis-URL som er forskjellig mellom pilotlinjen og den ekte.

```yaml
- name: Check limit
  type: core.if
  version: 1
  params:
    condition: "{{ item.json.temp > toNumber(vars.TEMP_LIMIT) }}"
```

- En variabel gjelder **hele instansen** eller tilhører **ett prosjekt**. Når begge har et navn, vinner prosjektets, og bare for arbeidsflytene i det prosjektet.
- En verdi er tekst, opptil 8 KiB. Bruk `toNumber(vars.X)` når du trenger et tall.
- Et navn er bokstaver, sifre og understreker, begynner med en bokstav eller en understrek og er opptil 64 tegn langt, fordi det må kunne leses som `vars.NAME`.
- **Variabler er ikke hemmeligheter.** Alle som kan lese prosjektet, leser variablene dets, og verdien fjernes ikke fra kjøringsdata. Et passord, et token eller en nøkkel hører hjemme i legitimasjonsvelvet, eller i et eksternt hemmelighetslager (nedenfor).
- En kjøring leser variablene sine når den starter, og igjen hvis den gjenopptas etter en pause eller en omstart. En endring når den neste kjøringen, ikke en som allerede er midt i et trinn. Et navn som ikke finnes, leses som ingenting, ikke som en feil.

| Kall | Hva det gjør |
|---|---|
| `GET /api/v1/variables` | Instansvariabler og de i prosjekter du kan lese; `?project=` begrenser til ett prosjekt. |
| `POST /api/v1/variables` | Lager en. Med `projectId` tilhører den prosjektet, uten gjelder den hele instansen. |
| `PUT /api/v1/variables/{variable}` | Endrer navn og verdi. |
| `DELETE /api/v1/variables/{variable}` | Sletter den. |

Hvem som kan: i et prosjekt lister tillatelsen `variable.read` dem, og `variable.create`, `variable.update` og `variable.delete` endrer dem. Viewere og operatorer leser, editorer og admins endrer. Variabler som gjelder hele instansen, kan leses av alle som er logget inn, fordi arbeidsflyten i et hvilket som helst prosjekt kan lese dem, og bare en eier eller administrator av instansen endrer dem. En egen rolle kan ha hvilken som helst av disse fire tillatelsene. Endringer står i revisjonsloggen som `variable.created`, `variable.updated` og `variable.deleted`, med navnet og aldri verdien.

## Mapper

I editoren: arbeidsflytlisten er mappene. Lag en med Ny mappe, nøst den med Legg til undermappe, og flytt en arbeidsflyt fra raden den står på i listen. Velger du en mappe når du lager en arbeidsflyt, havner den der.

Mapper grupperer et prosjekts arbeidsflyter og nøstes, slik et anlegg er bygget opp: område, linje, celle.

- En mappe ligger i ett prosjekt. Navn er unike blant mapper ved siden av hverandre, og et navn er opptil 100 tegn langt.
- Mapper nøstes opptil 10 nivåer dypt.
- En arbeidsflyt ligger i én mappe eller øverst i prosjektet sitt. Å lagre en ny versjon flytter den ikke.
- En mappe med arbeidsflyter eller mapper i kan ikke slettes (409), så å slette en mappe er aldri måten en arbeidsflyt forsvinner på. En mappe kan ikke flyttes inn i seg selv eller en av sine egne undermapper, og kan ikke flyttes til et annet prosjekt.

| Kall | Hva det gjør |
|---|---|
| `GET /api/v1/folders` | Mapper i prosjekter du kan lese, flatt, hver med sin `parentId`; `?project=` begrenser. |
| `POST /api/v1/folders` | Lager en i `projectId`, inni `parentId` eller øverst. |
| `PATCH /api/v1/folders/{folder}` | Gir den nytt navn, eller flytter den med `parentId` (tom streng for øverst). |
| `DELETE /api/v1/folders/{folder}` | Sletter en tom mappe. |
| `PUT /api/v1/workflows/{workflow}/folder` | Legger en arbeidsflyt i en mappe, eller øverst med en tom `folderId`. |
| `GET /api/v1/workflows?folder=` | Arbeidsflytene i én mappe, eller `folder=none` for toppen av hvert prosjekt. |

Hver arbeidsflyt API-et returnerer, oppgir sin `folderId`. Tillatelsene `folder.read`, `folder.create`, `folder.update` og `folder.delete` virker som variabeltillatelsene, og å flytte en arbeidsflyt krever `workflow.update`. Mappeendringer står i revisjonsloggen, og flyttinger som `workflow.moved`.

## Merknader på kjøringer

I editoren: siden til hver kjøring har en Merknad-boks med tommel opp eller ned, et notat og tagger, og kjøringslisten filtrerer på tagg og på stemme.

En person kan si noe om en kjøring etter at den har skjedd: tommel opp eller ned, et notat og tagger å finne den på. «Første gode parti etter verktøybyttet» og `scrap` er typiske ting som hører hjemme her.

```sh
curl -X PUT $CASCADE/api/v1/executions/$RUN/annotation -H "Authorization: Bearer $KEY" \
  -d '{"vote":"up","note":"first good batch after the die change","tags":["die-change","first-shift"]}'
```

- En stemme er `up`, `down` eller tom. Et notat er opptil 2000 tegn. En kjøring har opptil 20 tagger, hver på 1 til 40 tegn uten kontrolltegn, oppført én gang.
- `PUT` erstatter hele merknaden, så send alt du vil beholde. En merknad som ikke sier noe, er det samme som ingen. `DELETE /api/v1/executions/{execution}/annotation` fjerner den.
- Hver kjøring API-et returnerer, har merknaden sin, og listen har den på hver rad. `GET /api/v1/executions?tag=scrap` og `?vote=down` filtrerer, og de kombineres med de andre filtrene.
- Merknaden registrerer hvem som la den igjen og når, fra samme identitet som revisjonsloggen bruker.
- Å legge inn merknader krever tillatelsen `execution.annotate`, som operatorer, editorer og admins har, og viewere ikke har. Viewere leser merknader.
- En merknad forsvinner når kjøringen slettes. Revisjonsloggen beholder `execution.annotated` og `execution.annotation_cleared` med stemmen og taggene, og registrerer bare at et notat ble lagt igjen, ikke hva det sa.

## Beholde ferdige kjøringer

I editoren: Innstillinger, Behold ferdige kjøringer i (dager). Gjennom API-et: `PATCH /api/v1/settings` med `{"retentionDays": 90}`, som krever tillatelsen `instance.settings` som resten av innstillingene.

Som standard beholdes hver ferdige kjøring for alltid, slik det alltid har vært. Sett et antall dager, og en main sletter ferdige kjøringer (vellykkede, mislykkede eller avbrutte) som endte for lenger siden enn det, med trinndataene deres, én gang i timen. 0 slår det av igjen.

- En kjøring som står i kø, kjører eller venter, røres aldri, og heller ikke en kjøring hvis forelder fortsatt pågår, fordi forelderen kommer til å spørre hva den gjorde.
- Hver bolk på opptil 500 kjøringer er en egen transaksjon og skriver én `execution.pruned`-rad til revisjonsloggen, med hvor mange som gikk og skjæringstidspunktet. Å endre innstillingen skriver `instance.retention`.
- Hver main kjører runden, og to samtidig finner bare mindre å gjøre.
- Blob-opprydding følger samme runde, og kjører én gang i timen enten oppbevaring er på eller ikke, slik at en kjøring slettet for hånd også ryddes opp. Se «Blob-opprydding» nedenfor.

## Begrense en API-nøkkel

I editoren: Innstillinger, API-forespørsler per nøkkel per minutt. Gjennom API-et: `PATCH /api/v1/settings` med `{"apiRateLimit": 120}`, med tillatelsen `instance.settings`.

Som standard kan en nøkkel kalle så ofte den vil. Sett et tall, og hver API-nøkkel, og hver agent som er logget inn over MCP med en, kan gjøre så mange forespørsler i minuttet. Et kall over grensen besvares med `429` og en `Retry-After`-header som sier hvor mange sekunder du skal vente. Hver nøkkel har sin egen telling, så ett skript på avveie kan ikke bruke opp en annens. Folk som er logget inn i editoren, er ikke bundet av den.

Tellingen er hver prosess sin egen, fordi det er den som beskytter prosessen: med tre mains kan en nøkkel gjøre opptil tre ganger tallet, fordelt på dem. En endring av innstillingen når hver main innen fem sekunder. Å endre den skriver `instance.api_rate_limit` til revisjonsloggen, med det gamle og det nye tallet.

En webhook har sin egen grense, satt på triggeren, og en konto låses etter gjentatte feil passord; ingen av delene endres.

## Sikkerhetskopi og gjenoppretting

```
hotloop-cascade backup /backups/2026-11-20
hotloop-cascade restore /backups/2026-11-20
```

`backup` skriver en ny katalog med en konsistent kopi av SQLite-databasen (tatt mens serveren kjører, med `VACUUM INTO`), nøkkelfilen som forsegler all lagret legitimasjon, blob-filene og `manifest.json` med SHA-256 for hver. Den tar de samme innstillingene `--database`, `--key-file` og `--blob-dir` som serveren, fra de samme miljøvariablene. Katalogen må ikke finnes ennå, eller må være tom; en sikkerhetskopi blandes aldri inn i en gammel. Uten nøkkelfil er det ingen sikkerhetskopi, fordi en database uten nøkkelen har legitimasjon ingen kan lese.

`restore` legger dem tilbake, og serveren må stoppes først. Den sjekker hver fil mot manifestet før den skriver noe, så en skadet eller ufullstendig sikkerhetskopi endrer ingenting. Den nekter å overskrive en database, eller en nøkkelfil som er forskjellig, som allerede finnes; `--replace` sier at du mener det. Start serveren etterpå: den oppdaterer skjemaet, og avviser en sikkerhetskopi tatt av en nyere utgave enn den selv.

PostgreSQL: `backup` skriver nøkkelen, blobene og manifestet, og skriver ut kommandoen `pg_dump --format=custom` som lager databasens halvdel, fordi det programmet er PostgreSQLs eget og Cascade-imaget ikke har det med. `restore` legger nøkkelen og blobene tilbake og skriver ut kommandoen `pg_restore`. Blober lagret i S3 eller Azure kopieres ikke; ta sikkerhetskopi av bøtta der.

Før du oppgraderer til en utgave som migrerer, ta en: migreringer går bare fremover, og å gå tilbake til det gamle imaget krever sikkerhetskopien.

## Sladdingspolicyer for kjøringer

I editoren: Innstillinger, Sladding lager policyene. En arbeidsflyt velger en i editorens sidepanel uten noe valgt, under Arbeidsflytinnstillinger.

Legitimasjonsvelvet holder allerede hemmeligheter ute av alt en kjøring lagrer. En sladdingspolicy er for data som ikke er legitimasjon, men som heller ikke hører hjemme i kjøringshistorikken: et adgangskortnummer, navnet på en operatør, et kortnummer som kom inn via en webhook.

En policy er et navn og regler:

- **fields**: nøkkelnavn på elementer. En nøkkel som en policy nevner, får hele verdien erstattet med `[redacted]`, på alle dybder, uansett hvilken type verdien har. Sammenligningen ignorerer store og små bokstaver, og `*` og `?` virker som jokertegn, slik at `*secret*` tar `plant_secret` og `SecretKey`.
- **patterns**: regulære uttrykk, i Gos RE2-syntaks. Hvert treff i hvilken som helst tekst erstattes med `[redacted]`. Et mønster som treffer den tomme teksten, avvises.
- **steps**: valgfritt. Policyen dekker bare trinnene som er oppført. Tomt betyr alle trinn.
- **appliesToAll**: valgfritt. Policyen dekker alle arbeidsflyter, enten de nevner den eller ikke.

En arbeidsflyt velger en med navn i innstillingene sine:

```yaml
settings:
  redaction: Badges
```

Hva den gjør og når:

- Den kjører **når kjøringen er ferdig**, i samme transaksjon som markerer den som ferdig: vellykket, mislykket eller stoppet. Frem til da har kjøringen sine ekte data, fordi neste trinn trenger dem og en omstart fortsetter fra dem. En kjøring som venter, har fortsatt sine ekte data.
- Den renser hvert trinns lagrede utdata, hvert trinns lagrede feilmelding, kjøringens egen feil og et lagret webhook-svar. Den rører ikke filinnhold: en policy leser elementdata, og en fil er en referanse til byte.
- Det som ble lagret, er det en gjentakelse eller et nytt forsøk fra midten av den kjøringen starter fra, så en gjentakelse ser de rensede verdiene. Arbeidsflytens triggerelementer står i det første trinnets utdata, og de renses også.
- Den leser arbeidsflyten slik den var for den kjøringen, så å redigere en arbeidsflyt, eller policyen, endrer aldri en kjøring som allerede er over.
- En arbeidsflyt som nevner en policy som ikke finnes, **feiler lukket**: kjøringene dens beholder ingen elementdata i det hele tatt, slik lagringsinnstillingen `metadata` virker, og arbeidsflytens `problems` sier det. En manglende policy må aldri bety at data beholdes som noen mente skulle renses.
- En policy som arbeidsflyter nevner, kan ikke slettes (409), og navnet kan ikke endres. Reglene kan.

| Kall | Hva det gjør |
|---|---|
| `GET /api/v1/redaction-policies` | Alle policyer. Alle som er logget inn, kan lese dem, fordi de som skriver arbeidsflyter, trenger navnene. |
| `POST /api/v1/redaction-policies` | Lager en. |
| `PUT /api/v1/redaction-policies/{policy}` | Erstatter beskrivelsen og reglene. |
| `DELETE /api/v1/redaction-policies/{policy}` | Sletter en ingen arbeidsflyt nevner. |

Å lage, endre og slette en policy krever instanstillatelsen `redaction.manage`, som eiere og administratorer har. Hver av dem står i revisjonsloggen som `redaction.created`, `redaction.updated` og `redaction.deleted`.

## Insights

I editoren: Insights, i den øverste linjen. Velg et vindu, et prosjekt og en arbeidsflyt; den viser totalene, et diagram og en tabell per dag, og en tabell per arbeidsflyt.

`GET /api/v1/insights` summerer kjøringene i et vindu: hvordan de endte, hvor lenge de tok, per dag og per arbeidsflyt.

```sh
curl "$CASCADE/api/v1/insights?from=2026-10-10&to=2026-10-14&project=$PROJECT" -H "Authorization: Bearer $KEY"
```

- `from` og `to` er et RFC 3339-tidspunkt eller en dato (midnatt UTC). Uten noen av dem er det de siste sju dagene frem til nå. Det meste den svarer for, er 366 dager.
- `project` og `workflow` begrenser det. Uten dem teller den alle prosjekter der den som kaller, kan lese kjøringer, så hver persons tall er deres egne.
- En kjøring teller på UTC-dagen den ble opprettet.
- `totals` og hver rad i `days` og `workflows` har `total`, `succeeded`, `failed`, `canceled` og `unfinished` (i kø, kjørende eller ventende), gjennomsnittlig og lengste kjøretid i millisekunder over kjøringer som har både start og slutt, og `failureRate`.
- `failureRate` er mislykkede delt på vellykkede pluss mislykkede. En avbrutt kjøring er ikke en feil og en uferdig har ikke avgjort seg, så ingen av dem er med. Den er 0 når ingenting har blitt ferdig i den ene eller andre retningen.
- `days` lister hver UTC-dag i vinduet, med nuller for en dag der ingenting kjørte, så et diagram ikke har hull å gjette på. `workflows` er de 50 travleste, den travleste først.

Den leser de samme kjøringsradene som kjøringslisten, så den trenger tillatelsen `execution.read` og en nøkkel med omfang for den.

## Eksterne hemmeligheter

I editoren: Innstillinger, Eksterne hemmeligheter. Legg til en leverandør, prøv den mot en sti fra samme kort, og se hvordan referansen til den ser ut.

Hemmelighetsfeltet i en legitimasjon kan peke på en hemmelighet som ligger i HashiCorp Vault eller OpenBao, i stedet for å holde hemmeligheten selv. Roter passordet i lageret, og hver arbeidsflyt bruker det nye ved neste kjøring, uten at noen redigerer en legitimasjon, og en kopi av databasen din har aldri passordet.

En referanse ser slik ut, i et hvilket som helst hemmelighetsfelt i en legitimasjon:

```
secret://bao/plant/line-3/db#password
```

Det er leverandøren som heter `bao`, hemmeligheten på `plant/line-3/db` og nøkkelen `password`. Legitimasjonen lagrer den teksten, forseglet som enhver hemmelighet. Ingenting den peker på, lagres noen gang her: verdien leses når en kjøring åpner legitimasjonen, holdes i minnet så lenge leverandørens cache-tid varer, og renses fra alt kjøringen lagrer, på samme måte som et passord fra velvet. Bare hemmelighetsfelt tar imot referanser. En referanse skrevet i et felt som ikke er en hemmelighet, er bare tekst.

### Sette opp en leverandør

En leverandør er serveren, hvordan Cascade logger inn på den, og hvor den kan lese. Å lage, endre og fjerne en er en oppgave for en eier eller administrator av instansen, tillatelsen `secrets.manage`, og må gjøres av en person som er logget inn, ikke av en API-nøkkel.

```sh
curl -X POST $CASCADE/api/v1/secret-providers -H "X-CSRF-Token: ..." -d '{
  "name": "bao",
  "address": "https://bao.plant.example:8200",
  "authMethod": "approle", "roleId": "...", "secretId": "...",
  "allowedPaths": ["plant"]
}'
```

| Felt | Hva det gjør |
|---|---|
| `name` | 1 til 40 små bokstaver, sifre og bindestreker. Det står i hver referanse, så det kan ikke endres senere. |
| `address` | Serverens URL. |
| `mount`, `kvVersion` | Hvor KV-motoren er montert (`secret` som standard) og om den er versjon 1 eller 2 (2 som standard). |
| `namespace` | Sendes som `X-Vault-Namespace`, for et navneområde på serveren. |
| `authMethod` | `token` med `token`, eller `approle` med `roleId` og `secretId`. `authMount` er hvor AppRole er montert (`approle` som standard). AppRole logger inn selv og på nytt når tokenet går ut. |
| `caCert` | En PEM-sertifikatutsteder som skal stoles på for serveren, når sertifikatet ikke er fra en systemet stoler på. |
| `allowedPaths` | **Påkrevd.** De eneste stedene en referanse kan lese fra. `plant` tillater `plant` og alt under, og ikke `plantation`. |
| `projects` | Valgfritt. De eneste prosjektene som kan bruke leverandøren. Er det tomt, kan alle prosjekter. |
| `cacheSeconds` | Hvor lenge en lest hemmelighet holdes i minnet, 0 til 3600. 30 som standard. 0 leser hver gang. |

Hvordan Cascade logger inn (tokenet, eller AppRole-id og hemmelighet) forsegles under instansnøkkelen, pakkes om igjen av en nøkkelrotasjon sammen med alt annet, og vises aldri av noe kall. La det stå ute av en endring, så blir det lagrede stående.

`POST /api/v1/secret-providers/{provider}/test` logger inn og, med en `path`, leser den, og sier om det virket. Den returnerer aldri en verdi. `GET /api/v1/secret-providers` lister leverandører for alle som er logget inn, fordi de som lager legitimasjon, trenger navnene. Kallene står i revisjonsloggen som `secrets.provider_created`, `_updated` og `_deleted`.

### Hva det ikke gjør

- **En leverandør trenger tillatte stier.** Et token for Vault kan vanligvis lese langt mer enn den som redigerer legitimasjon bør kunne navngi, og uten en liste kunne hvem som helst som kan lage en legitimasjon peke en mot en hvilken som helst hemmelighet tokenet når, og få en arbeidsflyt til å sende den et sted. Gi leverandøren stiene legitimasjonen dens trenger, og policyen dens det samme.
- **En referanse sjekkes når legitimasjonen lagres**, ikke bare når en kjøring bruker den: leverandøren må finnes, være åpen for legitimasjonens prosjekt og tillate stien. En sti med en tom del, et punktum eller en `..` avvises.
- **En kjøring som ikke kan lese hemmeligheten, feiler og sier hvorfor**, med leverandør, sti og nøkkel og aldri en verdi: ingen slik leverandør, en sti leverandøren ikke tillater, ingen hemmelighet der, ingen slik nøkkel, eller serverens eget avslag (en policy som ikke tillater lesingen, er «permission denied»).
- **Å slette en leverandør redigerer ikke legitimasjon.** De som peker på den, feiler når en kjøring åpner dem, og sier at leverandøren er borte.
- En hemmelighetsverdi som virkelig begynner med `secret://`, kan ikke lagres som hemmelighet, fordi den leses som en referanse.
- Verdier som er tall eller sann eller usann, leses som tekst. En verdi som er et helt objekt eller en liste, avvises.
## Loggstrømming

I editoren: Innstillinger, Loggstrømming (eiere og administratorer). Hvert mål viser hvor mye det har sendt, når det sist leverte og siste feil, med en knapp som sender én testhendelse.

Send revisjonsloggen, og en linje for hver kjøring som blir ferdig, til stedene et anlegg allerede har loggene sine: en syslog-server, eller alt som tar imot OTLP-logger over HTTP (en OpenTelemetry-collector, Loki, en loggplattform). Hendelser forlater systemet når de skjer, så et SIEM ser en mislykket innlogging i løpet av sekunder, og revisjonssporet finnes et sted der en administrator av denne instansen ikke kan skrive det om.

Et mål er ett sted. Lag så mange du trenger:

```sh
curl -X POST $CASCADE/api/v1/log-destinations -H "X-CSRF-Token: ..." -d '{
  "name": "plant syslog", "kind": "syslog",
  "address": "syslog.plant.example:6514", "network": "tls",
  "caCert": "-----BEGIN CERTIFICATE-----..."
}'
curl -X POST $CASCADE/api/v1/log-destinations -H "X-CSRF-Token: ..." -d '{
  "name": "collector", "kind": "otlp", "endpoint": "https://otel.plant.example/v1/logs",
  "headers": {"Authorization": "Bearer ..."}
}'
```

Å lage, endre og fjerne mål er for eiere og administratorer av instansen (`logstream.manage`), av en person som er logget inn og ikke av en API-nøkkel, fordi et mål er stedet revisjonsloggen går til. Kallene står i revisjonsloggen som `logstream.destination_created`, `_updated` og `_deleted`.

### Hva som sendes

- **Revisjonshendelser**: hver rad i revisjonsloggen, med sekvensnummeret og hashen sin. Sekvensnummeret og hashen er hvordan en mottaker oppdager en gjentakelse, og hashen er radens egen, så kjeden kan kontrolleres ut fra det som kom frem. En mislykket eller avvist innlogging er en advarsel, alt annet en melding.
- **Kjøringshendelser**: én for hver kjøring som blir ferdig, uansett hvordan den ender: kjøringens id, arbeidsflytens id og navn, prosjektet, status, modus, når den ble opprettet, startet og ferdig, hvor lenge den kjørte, og feilen og trinnet den feilet ved. En mislykket kjøring er en feil, en stoppet en melding, en vellykket informasjon. De sendes et par sekunder etter at kjøringen er ferdig.
- **Aldri elementdata.** Det trinnene i en kjøring så og lagde, blir i kjøringen, der sladdingspolicyene beskytter det. Revisjonsloggen har aldri en hemmelighet.

`events` velger én eller begge (`["audit"]`, `["execution"]`, begge som standard). `start` sier hvor et nytt mål begynner: `now`, standarden, sender det som skjer etter at det er laget, og `beginning` sender hele revisjonsloggen og hver ferdige kjøring først.

### Syslog

En melding er RFC 5424: `<priority>1 time host hotloop-cascade pid msgid - {json}`, med hendelsen som én linje JSON. Prioriteten er facility ganger åtte pluss alvorlighetsgraden. Msgid er revisjonshandlingen (`workflow.saved`) eller kjøringens status.

| Felt | Hva det gjør |
|---|---|
| `address` | `host:port`. |
| `network` | `tcp` (standard), `udp` eller `tls`. |
| `framing` | For `tcp` og `tls`: `octet` (RFC 6587 oktettelling, standard) eller `newline`. UDP er ett datagram hver. |
| `facility` | `local0` som standard; et hvilket som helst syslog-facility-navn. |
| `appName` | Headerens APP-NAME, `hotloop-cascade` som standard. |
| `caCert`, `serverName` | For `tls`: utstederen som skal stoles på, og navnet sertifikatet må gjelde for når det ikke er verten. Det finnes ingen innstilling som hopper over sjekken. |

### OTLP

Logger går til `endpoint` som OTLP over HTTP med en JSON-body: en loggpost for hver hendelse, med hendelsen som JSON i bodyen og delene som attributter (`cascade.event`, `cascade.action`, `cascade.status`, `cascade.project`, `cascade.actor.name` og så videre) slik at en mottaker kan filtrere uten å parse. Ressursen sier `service.name=hotloop-cascade`, versjonen og verten. `headers` sendes med hver forespørsel, for et token eller en tenant. De forsegles under instansnøkkelen, pakkes om av en nøkkelrotasjon og vises aldri: listen sier bare navnene deres. `caCert` og `serverName` virker som for syslog.

### Hvordan leveringen oppfører seg

- **Minst én gang, i rekkefølge.** Et mål husker den siste revisjonsraden og den siste ferdige kjøringen det sendte. Et som er nede, får alt det gikk glipp av når det kommer tilbake, i rekkefølge, og en omstart fortsetter der det stoppet. Hvis senderen blir avbrutt mellom sending og notering, sendes de hendelsene på nytt, og det er det sekvensnumrene er til for.
- **Et mål som feiler, venter stadig lenger**, ett sekund og dobbelt opp til fem minutter, og statusen sier hva som gikk galt og når: `lastError`, `lastErrorAt`. En vellykket sending fjerner den. Ingenting forkastes mens det er nede, så grensen er revisjonsloggen, ikke en kø.
- **Én sender om gangen.** Med flere mains sender den som holder et måls lease, til det; de andre venter og overtar hvis den stopper.
- **Å endre et mål beholder plassen det har.** Å flytte det til en annen adresse sender aldri noe på nytt og hopper aldri over noe. Headere som utelates i en endring, beholdes, og et tomt objekt fjerner dem. Navnet og typen kan ikke endres.
- `POST /api/v1/log-destinations/{destination}/test` sender én oppdiktet hendelse gjennom samme vei og sier om den kom frem, med grunnen når den ikke gjorde det. Den flytter ingenting.
- `GET /api/v1/log-destinations` viser statusen til hvert mål: hvor mange hendelser det har sendt, det siste leverte revisjonssekvensnummeret, når det sist lyktes og siste feil.

## Hvor store data lever

Filer og store nyttelaster som en kjøring bærer med seg (en nedlastet PDF, et kamerabilde, et regneark) lagres som blober, atskilt fra databasen. Som standard ligger de på instansens disk. Sett `HOTLOOP_CASCADE_BLOB_STORE` for å legge dem i en S3-bøtte eller en Azure-blobcontainer i stedet, slik at main kan bygges opp igjen uten å bære dem med seg og flere mains deler én kopi.

| Innstilling | Betydning |
| --- | --- |
| `HOTLOOP_CASCADE_BLOB_STORE` | `fs` (standard), `s3` eller `azure`. |
| `HOTLOOP_CASCADE_BLOB_SPOOL_DIR` | Hvor en blob venter mens den hashes før opplasting. Standard er `blob-spool` i datakatalogen. |
| `HOTLOOP_CASCADE_BLOB_S3_BUCKET`, `_ACCESS_KEY`, `_SECRET_KEY` | Påkrevd for `s3`. Hemmeligheten leser også `_SECRET_KEY_FILE`. |
| `HOTLOOP_CASCADE_BLOB_S3_ENDPOINT`, `_REGION` | La endepunktet utgå for AWS. Sett det for Garage, MinIO eller Ceph. |
| `HOTLOOP_CASCADE_BLOB_S3_PATH_STYLE` | `true` eller `false`. Path-stil er standard så snart et endepunkt er satt. |
| `HOTLOOP_CASCADE_BLOB_S3_CA_FILE` | En CA-pakke for et endepunkt med privat sertifikat. |
| `HOTLOOP_CASCADE_BLOB_S3_PREFIX` | En mappe inne i bøtta, slik at én bøtte kan holde mer enn én instans. |
| `HOTLOOP_CASCADE_BLOB_AZURE_CONTAINER` | Påkrevd for `azure`. |
| `HOTLOOP_CASCADE_BLOB_AZURE_CONNECTION_STRING`, eller `_ACCOUNT` med `_KEY`, eller `_SAS` | Én måte å logge inn på. Hemmeligheter leser også en `_FILE`-form. |
| `HOTLOOP_CASCADE_BLOB_AZURE_ENDPOINT`, `_PREFIX` | Et endepunkt for Azurite eller en privat sky, og en mappe inne i containeren. |

På charten setter du disse gjennom `env` og `extraEnv`, med hemmelighetene fra en Kubernetes-Secret.

- **Adressert etter innhold.** En blob lagres under SHA-256 (`sha256/ab/cdef...`), så den samme filen lagres én gang uansett hvor mange kjøringer som bærer den. Å legge den inn igjen gjør ingenting, også når to kjøringer gjør det i samme øyeblikk.
- **Hashet før opplasting.** Dataene leses én gang inn i spool-filen, hashes og sendes deretter, så minnebruken holder seg flat uansett størrelse. En blob over størrelsesgrensen avvises, og en avbrutt opplasting etterlater ingenting i bøtta.
- **Kontrollert på vei ut.** En lesing verifiseres mot hashen mens den strømmes, så et skadet objekt feiler høyt i stedet for å gi en kjøring dårlige data.
- **Størrelse.** En enkelt opplasting går opp som en flerdelt overføring på S3 og i blokker på Azure, så den vanlige grensen på 5 GiB per forespørsel gjelder ikke.
- **Blob-opprydding.** Én gang i timen fjerner en runde blobene ingen rad peker på lenger: en trinnutdata som ble lagret som fil fordi den var for stor for databasen, og vedleggene elementer bærer. En blob beholdes så lenge et trinnkjøring, delvis utdata, lagret svar eller en arbeidsflyt fortsatt nevner den, direkte eller gjennom en lagret utdata som holder vedlegget, så en fil som deles av to kjøringer med identisk utdata, blir til den siste er borte. Bare blober sist skrevet for mer enn 24 timer siden blir vurdert, og å legge inn byte som allerede er lagret, teller som å skrive dem på nytt etter den første timen, så en fil som et trinn nettopp har lagret og ikke ennå har registrert, fjernes aldri. En runde som ikke kan lese en lagret utdata, fjerner ingenting. Den skriver én `blobs.collected`-rad til revisjonsloggen med hvor mange filer og byte som gikk. Runden forutsetter at blob-lageret tilhører én instans (workerne og main i én installasjon deler det); to installasjoner som peker på samme bøtte eller mappe, ville hver fjerne den andres filer, så gi hver sitt eget (`HOTLOOP_CASCADE_BLOB_S3_PREFIX` finnes for dette).
- **Bytte lager senere.** Eksisterende blober blir der de ble skrevet. Flytt dem til det nye lageret før du bytter, fordi en referanse til en blob det nye lageret ikke har, er en manglende fil.

Disse to backendene prøves mot Garage og Azurite i teststakken, med samme samsvarssuite som disklageret: skriv og les, tomme blober, deduplisering under samtidighet, skade, grensen, ugyldige id-er, sletting, listing, en avbrutt opplasting og en strømmet opplasting på 192 MiB med en heap-kontroll.

Hva det betyr for deg: en main som er bygd opp igjen eller byttet ut, finner hver fil kjøringene dens bar med seg, uten å kopiere noe.
