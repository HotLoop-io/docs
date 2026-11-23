---
title: "Sikkerhetskopier og gjenoppretting"
description: "Logiske øyeblikksbilder av databasen, gjenopprettinger som avviser et nyere skjema, og hvorfor nøkkelen til enhetspassordene må sikkerhetskopieres for seg."
---

HotLoop tar logiske øyeblikksbilder av historikeren, bare tabelldata, og gjenoppretter dem, siden 4.12.0. På som standard, daglig (`HOTLOOP_BACKUP_ENABLED`, `HOTLOOP_BACKUP_INTERVAL` 24h), i binærfilen og i Helm-chartet. Sikkerhetskopier går under `HOTLOOP_BACKUP_DIR`, som som standard er `backups` i HotLoops datakatalog (`HOTLOOP_DATA_DIR`, ellers `/data` når den kan skrives til, ellers `~/.local/share/hotloop`): en utrulling som ikke har konfigurert et sikkerhetskopivolum bør ikke ha denne prosessen til å skrive i det stille inn i en containers flyktige filsystem.

## Hva dette er

En sikkerhetskopi er en katalog: én fil per tabell pluss en liten `manifest.json` (HotLoop-versjon, skjemamigreringene databasen hadde kjørt, tidsstempel, og hver tabells radantall og kolonner med typene deres).

## Hva dette ikke er

- **Ikke `pg_dump`/`pg_restore`.** Gateways kjøretidsbilde (`gcr.io/distroless/static-debian12:nonroot`) er med vilje en statisk binærfil og ingenting mer: ingen shell, ingen pakkebehandler, ingen eksterne binærfiler av noe slag. Alt her går over den samme databaseforbindelsen som appen allerede har.
- **Ikke en skjemasikkerhetskopi.** Skjemaet bygges automatisk opp igjen ved hver oppstart (`HOTLOOP_DB_MIGRATE`, på som standard). En sikkerhetskopi tar bare med *dataene* i tabellene, og en gjenoppretting forutsetter alltid at skjemaet først er bygd opp av disse migreringene.
- **Ikke gjenoppretting til et bestemt tidspunkt.** Her finnes ingen WAL-arkivering og ingen kontinuerlig replikering. En sikkerhetskopi er et øyeblikksbilde fra det den kjørte; alt som skrives etter det og før neste sikkerhetskopi, er ikke dekket.
- **Ikke lagring utenfor enheten.** Sikkerhetskopikatalogen (`HOTLOOP_BACKUP_DIR`, ment å ligge på PVC-en `backup.persistence` som dette chartet setter opp) er fortsatt ett enkelt volum i samme klynge. Å få sikkerhetskopiene over på lagring som er virkelig varig, replikert eller frakoblet (kopiere volumet til objektlagring, ta øyeblikksbilde av PVC-en, det driftspersonellets faktiske infrastruktur tilbyr) er driftspersonellets jobb, på samme måte som dette prosjektet allerede behandler varig lagring som infrastrukturens ansvar og ikke noe appen finner opp en multiskybasert sikkerhetskopiadapter for.

## Beskytt sikkerhetskopifilene

Sikkerhetskopifiler er sensitive. Filen `users.copy` inneholder bcrypt-hasher av passord og kiosk-PIN-koder, og `sessions.copy` og `write_audit.copy` inneholder øktposter og revisjonssporet for skriving. Filer opprettes med modus `0640` (og sikkerhetskopikatalogen med `0750`), og en fil som allerede finnes, er en feil i stedet for å bli overskrevet, men det er et minimum og ingen erstatning for å beskytte volumet: ha sikkerhetskopivolumet på lagring som er kryptert i hvile, begrens hvem og hva som kan lese det, og vis samme omsorg for enhver kopi utenfor enheten som driftspersonell lager.

Filen `devices.copy` inneholder adressen og protokollkonfigurasjonen til hver enhet slik de er lagret, inkludert legitimasjonen driverne logger inn med. Hvor lesbare de er, avhenger av nøkkelen, nedenfor. Siden 4.15.1 skjuler API-et all enhetslegitimasjon for alle roller, administrator inkludert; en sikkerhetskopifil ligger ikke bak API-et. Se [Autentisering og brukere](/nb/iot/authentication/#hvor-legitimasjon-fortsatt-ligger-i-klartekst).

## Enhetslegitimasjon og den hemmelige nøkkelen

En sikkerhetskopi er filen som blir kopiert til en bærbar, en delt mappe og en sak. Derfor er legitimasjonen i den kryptert, med en nøkkel som aldri ligger i databasen og aldri i en sikkerhetskopi.

- **Med `HOTLOOP_SECRET_KEY_FILE` satt** (chartet setter den, med en nøkkel det genererer ved installasjon og beholder gjennom oppgraderinger og avinstallasjoner) er all nøkkelbeskyttet legitimasjon (`password` for OPC UA-, CODESYS-, MQTT-, HTTP-, MTConnect- og UniFi-enheter, `community` og passfraser for SNMP-enheter, HTTP- og MTConnect-hodeverdier som API-nøkler, passordet til hver annen MQTT-broker oppdagelsen lytter til, og passordet til hvert historian-mål) kryptert i databasen, og `devices.copy`, `mqtt_sources.copy` og `historian_targets.copy` inneholder chifferteksten. Manifestet oppgir nøkkelen det ble kryptert med som `secretKeyIds`: en id, aldri nøkkelen.
- **Uten den** ligger legitimasjonen i databasen og i `devices.copy` i klartekst, og HotLoop sier det i oppstartsloggen. UniFi-konsoller, MQTT-brokere med passord og historian-mål med passord kan ikke lagres i det hele tatt uten nøkkel. Sett en og start på nytt: alt som allerede er lagret, krypteres ved den oppstarten.
- **Legitimasjon skrevet i en URL eller i tekst forsegles også** (`mqtt://user:pass@host`, en spørringsverdi `?token=` eller `?api_key=`, en HTTP-`body` som nevner et passord). En enhets adresse eller alternativ som har en slik i seg, forsegles hel, og driverne får den tilbake nøyaktig slik den ble skrevet. En URL uten noe hemmelig i seg blir lesbar. Uten nøkkel ligger disse i klartekst som resten, og oppstartsloggen sier det; med nøkkel forsegles alt som allerede er lagret, ved den oppstarten. Passordalternativet er fortsatt det beste stedet for et passord.

**Gjenoppretting trenger den samme nøkkelen.** `--restore-from` kontrollerer manifestet før den laster en rad: en sikkerhetskopi kryptert med en nøkkel HotLoop-en som gjenoppretter ikke har, avvises, og feilen oppgir nøkkelen som trengs. Gjenopprett med den nøkkelfilen montert. Hvis nøkkelen er borte for godt, legg til `--restore-keep-unreadable-credentials`: alt annet kommer tilbake, og hver enhet der legitimasjonen ikke kan åpnes, blir stående nede og sier hvilken nøkkel den trenger, til noen legger inn legitimasjonen på nytt. En sikkerhetskopi tatt før det fantes nøkkel, kan gjenopprettes hvor som helst, og legitimasjonen krypteres så snart gjenopprettingen er ferdig.

**Oppbevar nøkkelen et sted sikkerhetskopien ikke er.** En nøkkel lagret ved siden av sikkerhetskopiene beskytter ingenting. Med chartet er det Secret-en `<release>-secret-key`; ta sikkerhetskopi av den slik du tar sikkerhetskopi av resten av klyngens secrets, hver for seg.

## Hva som sikkerhetskopieres, og i hvilken rekkefølge

Hver brukerdatatabell, i avhengighetsrekkefølge for fremmednøkler (en tabell kommer alltid etter alle tabellene dens egne fremmednøkler peker til):

```
devices → tags → tag_latest → alarm_definitions → alarm_state →
alarm_events → automations → automation_runs → blueprints → scripts → script_runs →
recipes → recipe_versions → recipe_applications → events → write_audit →
settings → users → sessions → user_certificates → energy_meters → energy_meter_state →
energy_buckets → fleet_members → report_definitions →
report_runs → entity_state_log → tag_history
```

(Forkortet; `backup.Tables` er hele listen, med entitets- og utstyrstabellene og `entity_last_state`.) Loggbokens `entity_state_log` er partisjonert per måned i begge historikkmodusene og kommer rett før `tag_history`, den eneste tabellen som er større. En gjenoppretting laster radene før noen av de månedlige partisjonene finnes, så de havner i standardpartisjonen. Loggbokens vedlikehold, når en Gateway som tar opp, starter, lager forrige og denne månedens partisjoner rundt radene som hører hjemme i dem, og sletter eldre rader fra standardpartisjonen etter hvert som de passerer oppbevaringstiden, så oppbevaringen når hver gjenopprettet rad. Se [loggboken](/nb/iot/logbook/).

Skript kommer tilbake med historikken sin. En kjøring sikkerhetskopien tok midt i, kommer tilbake som `running`, og Gateways første oppstart markerer den som avbrutt, `interrupted by restart`, på samme måte som en kjøring et krasj kuttet: ingenting gjenopptar en kjøring. Se [Skript](/nb/iot/scripts/).

Oppskrifter kommer tilbake med hver versjon og hver anvendelse. En anvendelse sikkerhetskopien tok halvveis, kommer tilbake som `applying`, og Gateways første oppstart markerer den som `failed`, med peker til kall-iden i skriverevisjonen: ingenting gjenopptar en, og ingenting angrer en. Se [Oppskrifter](/nb/iot/recipes/).

`schema_migrations` er med vilje utelatt: `store.Migrate` bygger den opp igjen, sammen med DDL-en til hver tabell, fra de innebygde migreringene. Den er den eneste oppføringen i `backup.ExcludedTables`, som registrerer hvorfor hver utelatt tabell er utelatt.

Listen vedlikeholdes for hånd, og slik kan en tabell bli lagt til av en migrering og i det stille mangle i alle sikkerhetskopier etterpå. To tester verner mot det, og begge kjører mot en ekte database i begge lagringsmodusene. Tabellene for planlagte rapporter (`report_definitions`, `report_runs`) er de første tabellene som er lagt til under disse vernene. Rapportenes utdatafiler ligger på rapportvolumet og er ikke en del av en databasesikkerhetskopi. `tag_history` lastes sist ved gjenoppretting: den har ingen egen fremmednøkkel og er med god margin den største tabellen, så hver liten konfigurasjonstabell feiler raskt, hvis den skal feile, før det lange trinnet i det hele tatt starter.

**`settings` har ett bevisst unntak.** Raden `history_mode` skrives av `store.ensureHistorySchema` selv, én gang, i det øyeblikket `Migrate` bygger et skjema fra ingenting: den registrerer om *denne serveren* bygde `tag_history` som en TimescaleDB-hypertable eller som en nativt partisjonert tabell, noe som er et faktum om databasen `Migrate` nettopp kjørte mot, ikke om anlegget. Den er utelatt fra både sikkerhetskopieringen og gjenopprettingen av `settings`: å gjenopprette en kildeinstallasjons historiske avgjørelse på et mål med andre egenskaper (eller bare på en ny `Migrate`-kjøring mot samme type server) kunne skrive om denne raden til å beskrive en form målet faktisk ikke har. Målets egen `Migrate` har allerede tatt riktig avgjørelse før `Restore` i det hele tatt ser på `settings`, og den avgjørelsen blir latt være.

## Sikkerhetskopier på forespørsel

- `POST /api/backup` (`backup.run`, bare administrator) tar en sikkerhetskopi akkurat nå og returnerer manifestet.
- `GET /api/backup` (`backup.read`, bare administrator) lister det som ligger på sikkerhetskopivolumet: navn, størrelse på disk og manifestet (tabelliste, radantall, HotLoop-versjon, tidsstempel) for hver enkelt.

Begge er bare for administrator ved at de er utelatt fra operatørrollen, den samme innsnevringen som `fleet.restart`/`fleet.config`/`notify.test` allerede bruker på andre driftshandlinger, «gjør det nå»-handlinger eller handlinger med administrativt omfang. Radantallene i en sikkerhetskopiliste, inkludert `users` og `sessions`, ligner mer på en administrativ diagnostikk enn på lesingene fra anleggsgulvet (enheter, tagger, alarmer) operatørrollen skal se, så `backup.read` ble ikke delt ut til en lavere tillatelse slik noen lesinger er; det er en vurdering, ikke en teknisk begrensning, og kan tas opp igjen hvis en reell operatørarbeidsflyt trenger det.

## Tidsplan og oppbevaring

`HOTLOOP_BACKUP_INTERVAL` (f.eks. `24h`) kjører en sikkerhetskopi med fast takt. Dette er med vilje et vanlig intervall og ikke en cron-uttrykkstolker: det realistiske behovet er «ta sikkerhetskopi av dette med jevne mellomrom», og dette prosjektets egen konvensjon er å ikke bygge for et behov ingen har ennå. Å la den stå usatt (eller `0`) slår av planleggeren; endepunktet på forespørsel virker fortsatt, for en operatør eller en ekstern cron som heller vil utløse det selv.

`HOTLOOP_BACKUP_RETAIN` (standard `7`) beholder de nyeste N sikkerhetskopikatalogene og sletter eldre etter hver vellykket sikkerhetskopi. `0` eller lavere beholder alt, et valg driftspersonell må ta bevisst på et lite volum.

## Gjenopprette en sikkerhetskopi

**Gjenoppretting er med vilje ikke et API-endepunkt.** Å automatisere «gjenopprett nå» som en levende, nettverksutløst handling mot en database som kan betjene produksjonstrafikk, er en reell fare: ett feil klikk, eller én kompromittert administratorøkt, overskriver levende data, og dette prosjektet bygger ikke det uten å bli bedt om det uttrykkelig. Gjenoppretting er et flagg på selve binærfilen, kjørt én gang, for hånd, av driftspersonell som allerede har bestemt at måldatabasen skal motta den:

```sh
hotloop --restore-from=/data/backups/20260918T220000Z
```

Hva dette gjør, i rekkefølge:

1. Laster konfigurasjonen og kobler til databasen akkurat som en vanlig oppstart: `store.Open` kjører de samme migreringene og bygger skjemaet gjenopprettingen straks laster data inn i.
2. **Avviser en sikkerhetskopi den ikke kan laste uten å miste noe**: en tatt med et nyere skjema enn denne databasens, eller en med en tabell eller kolonne denne versjonen ikke lenger har. Begge kontrolleres før en eneste rad lastes. Se «Gjenopprette til en annen versjon» nedenfor.
3. **Avviser hvis en måltabell allerede har data** utover det `Migrate` selv nettopp la inn (den ene `history_mode`-raden i `settings`): gjenoppretting kjører bare mot en database uten noe i seg ennå. Dette er sikkerhetskontrollen: en tabell med så mye som én eksisterende rad stanser hele gjenopprettingen før noen `COPY FROM STDIN` kjører.
4. Laster hver tabell, i avhengighetsrekkefølge, i én enkelt transaksjon, inn i kolonnene manifestet oppgir.
5. Nullstiller den underliggende sekvensen for hver tabell med `bigserial`-primærnøkkel (`tags`, `alarm_events`, `automation_runs`, `events`, `write_audit`, `sessions`) til én over den høyeste gjenopprettede iden: `COPY FROM STDIN` laster eksplisitte id-verdier uten å røre sekvensen, så å hoppe over dette ville latt den aller neste vanlige innsettingen kollidere med en gjenopprettet rad.
6. Teller hver tabell på nytt og sammenligner med manifestets radantall, i den samme fortsatt åpne transaksjonen.
7. Bekrefter bare hvis alle tellingene stemte. En avvikende telling, eller en feil i et tidligere trinn, ruller hele transaksjonen tilbake og lar måldatabasen være akkurat så tom som den var, aldri delvis lastet.
8. Avslutter. Ingenting annet i prosessen starter: ingen polling-planlegger, ingen alarmmotor, ingen API-server. En gjenoppretting har ingen bruk for noen av dem, og å starte kjøretiden mot en database midt i gjenoppretting ville vært en fare i seg selv.

### Bytte til PostgreSQL 17

Denne sikkerhetskopien tas av appen som kjører, over forbindelsen til databasen som kjører, så den kan ikke være sikkerhetskopien for byttet fra PostgreSQL 16 til 17: det byttet skjer før databasen starter. Selve oppgraderingens sikkerhet er at den aldri skriver til PostgreSQL 16-katalogen, som den beholder hel som `pgdata.pg16` (siden om k3s og Helm, «PostgreSQL 17»). Ta likevel denne sikkerhetskopien på den gamle utgaven før du oppgraderer, for den er kopien som ligger utenfor enheten. Å gjenopprette den på den nye databasen er den vanlige gjenopprettingen nedenfor: den bærer rader, ikke motoren, så den bryr seg ikke om hvilken hovedversjon som skrev dem.

### Gjenopprette til en annen versjon

Utgaven du gjenoppretter med, er sjelden den som tok sikkerhetskopien. Sikkerhetskopien ble tatt for måneder siden med det som kjørte da, og enheten du bygger opp igjen, kjører dagens. Her er hva som gjenopprettes på hva.

**En eldre sikkerhetskopi på en nyere HotLoop: ja.** Det er tilfellet som teller, og det er testet fra hvert skjemanivå som har vært, `0001_core` til i dag, på TimescaleDB og på vanlig PostgreSQL, med appen startet etterpå.

- Hvert manifest registrerer hver tabells kolonner, navn og typer. Gjenopprettingen laster hver fil inn i nøyaktig disse kolonnene, etter navn. En kolonne lagt til siden sikkerhetskopien får standardverdien sin. `entity_id`, `service` og `call_id` i `write_audit` kommer tilbake tomme på hver revisjonsrad fra før entitetstjenestene, som er det de radene var: vanlige tag-skrivinger.
- En tabell lagt til siden sikkerhetskopien forblir tom, og appen fyller det den kan ved oppstart. Entitetsregisterets første synkronisering gir hver gjenopprettet tag sin leseentitet, hver aktivert tag sin kontrollentitet og hver alarmdefinisjon sin alarmentitet, med navnene registeret ville gitt dem. Enheter fra en sikkerhetskopi eldre enn utstyrstreet plasseres i det etter sted-, område- og linjeteksten under selve gjenopprettingen, på samme måte som oppgraderingen plasserte dem. Det som aldri var i sikkerhetskopien, kan ikke komme tilbake: etiketter, sammensatte entiteter og entitetsnavn en operatør tilpasset etter at sikkerhetskopien ble tatt.

**En nyere sikkerhetskopi på en eldre HotLoop: nei, avvist.** Manifestet registrerer hver migrering sikkerhetskopiens database hadde kjørt. Hvis det har en denne databasen aldri har kjørt, stopper gjenopprettingen før den laster en rad og sier det:

```
refusing to restore: this backup was taken by HotLoop <its version> with the
database schema at <its newest migration>, which is newer than this database's
schema at <this database's newest migration> (HotLoop <this version>). ...
Restore it with HotLoop <its version> or a later release
```

«Nyere» betyr migreringer, ikke versjonsstrenger. En versjonsstreng sier hvilken binærfil som tok sikkerhetskopien, og utviklerbygg, kandidatutgaver og hurtigfiks-grener gjør sammenligningen av dem til et gjetningsspill. Migreringene sier hva skjemaet faktisk var, og de sammenlignes som en mengde, så en manglende migrering fanges uansett hvor den ligger i rekkefølgen. Versjonene står i meldingen fordi versjonen er det du kan handle på: hvilken utgave du skal gjenopprette med.

**En sikkerhetskopi med en kolonne denne versjonen ikke lenger har: avvist, med navn.** Den dagen en migrering fjerner, omdøper eller endrer typen på en kolonne, har en sikkerhetskopi fra før den data den nye tabellen ikke har plass til. Gjenopprettingen gjetter ikke. Den navngir hver slik kolonne, i alle tabeller, før den laster noe:

- en kolonne den kjørende tabellen ikke har, avvises, med mindre `backup.columnRenames` knytter den til det nye navnet. En migrering som omdøper en kolonne legger til den oppføringen, og en test som gjenoppretter en sikkerhetskopi fra før den, i samme endring. Det finnes ingen omdøpinger i dag, så tabellen er tom;
- en kolonne der typen er endret, avvises. Binær COPY bærer ingen typer, så bytene ville blitt lest som den nye typen eller avvist halvveis;
- en kolonne den kjørende tabellen har lagt til som `NOT NULL` uten standardverdi, avvises, fordi ingenting kunne fylle den.

Utveien er den samme for alle tre: gjenopprett med utgaven som tok sikkerhetskopien, og oppgrader deretter den databasen på stedet, som er måten migreringen var ment å møte de dataene på.

Å laste etter navn dekker også endringen ingen legger merke til: en kolonne som er fjernet og lagt til igjen, eller en tabell som er bygd om, slik at kolonnene står i en annen rekkefølge. Å laste etter posisjon ville lagt en kolonnes verdier inn i en annen uten feil hver gang typene passer. Etter navn havner hver der den hører hjemme.

**Sikkerhetskopier tatt før manifestene registrerte noe av dette** (hver sikkerhetskopi tatt før denne utgaven) har ingen kolonnelister og intet skjema. De gjenopprettes likevel:

- Uten kolonnelister faller gjenopprettingen tilbake på posisjon. En fil med færre kolonner enn tabellen går inn i tabellens første kolonner, og resten får standardverdiene. Det stemmer for alle skjemaer så langt, fordi hver migrering til nå bare har lagt til kolonner, og `ALTER TABLE ADD COLUMN` legger alltid til sist. En fil med flere kolonner enn tabellen avvises av PostgreSQL selv.
- Uten skjema antar gjenopprettingen at sikkerhetskopien er så ny som den overhodet kan være: `0007_service_audit.sql`, den nyeste migreringen som fantes da manifestene begynte å registrere den. Den antakelsen kan bare avvise en gjenoppretting som ville fungert, aldri slippe gjennom en som ikke ville. I praksis avviser den ingenting, fordi enhver HotLoop med denne kontrollen allerede har kjørt hver migrering opp til den.

Den første sikkerhetskopien denne utgaven tar, registrerer alt, så reserveløsningen betyr bare noe for sikkerhetskopier som allerede ligger på et sikkerhetskopivolum.

### Gjenopprettingsprosedyre, trinn for trinn

1. Få sikkerhetskopikatalogen over på maskinen eller volumet `hotloop`-binærfilen i måldriftsmiljøet kan lese: dette er punktet der driftspersonellets egen kopi av sikkerhetskopivolumet utenfor enheten kommer inn igjen.
2. Pek `HOTLOOP_DB_*` mot **mål**databasen. Den må være nåbar og ikke ha data ennå i noen av de sikkerhetskopierte tabellene (en splitter ny, tom database er det normale; skjemaet bygges i trinn 3).
3. Kjør `hotloop --restore-from=<path to the backup directory>`.
4. Les den siste logglinjen: `restore complete` med tabell- og radantall, eller en feil som forklarer nøyaktig hva som ble avvist og hvorfor.
5. Start `hotloop` som vanlig mot den samme databasen.

## Flytte mellom databaser

En sikkerhetskopi er det samme uansett hvilken database som tok den: PostgreSQLs binære COPY-filer og et manifest som navngir hver kolonnes Postgres-type. Å flytte et anlegg fra en database til en annen er derfor en sikkerhetskopi på den gamle og en gjenoppretting inn i den nye. Ingenting mer.

- **SQLite til Postgres eller TimescaleDB.** Pi-en som vokste ut av filen sin. Ta en sikkerhetskopi, pek `HOTLOOP_DB_*` mot den nye serveren (`HOTLOOP_DB_TYPE=postgres`), gjenopprett. På en TimescaleDB-server havner historikken i en hypertable.
- **Postgres eller TimescaleDB til SQLite.** Et anlegg som går ned på en liten enhet. Det samme motsatt vei, med `HOTLOOP_DB_TYPE=sqlite`.
- **Vanlig Postgres til TimescaleDB, og tilbake.** Historikkmodusen er klebrig, så å peke en Gateway mot en IoT-enhets vanlige Postgres beholder partisjonene. For å få en hypertable, gjenopprett inn i en fersk TimescaleDB. Motsatt vei får du partisjoner.

Det som kontrolleres på vei inn, er det som kontrolleres for enhver gjenoppretting: hver kolonne etter navn og type mot målet, med SQLites kolonner lest som sine Postgres-typer, slik at en sikkerhetskopi fra den ene gjenopprettes inn i den andre eller avvises av samme grunn som ellers. `history_mode` kopieres aldri: målet beholder det sine egne migreringer bestemte. Sekvensene blir riktige på begge: på Postgres flytter `fixSequences` dem, og SQLites AUTOINCREMENT flytter seg selv forbi enhver id gjenopprettet inn i den.

## Konfigurasjon

| Variabel | Standard | <span class="sr-only">Details</span> |
|---|---|---|
| `HOTLOOP_BACKUP_ENABLED` | `false` | Funksjonen er av, API-rutene inkludert, til dette er satt |
| `HOTLOOP_BACKUP_DIR` | `/data/backups` | Hvor sikkerhetskopier skrives; ment å være en PVC (`backup.persistence` i chartet) |
| `HOTLOOP_BACKUP_RETAIN` | `7` | De nyeste N sikkerhetskopiene beholdes; `0` eller lavere beholder alt |
| `HOTLOOP_BACKUP_INTERVAL` | ikke satt | f.eks. `24h`; ikke satt betyr bare på forespørsel |

`--restore-from=<dir>` er et kommandolinjeflagg på `hotloop`-binærfilen, ikke en miljøvariabel, se «Gjenopprette en sikkerhetskopi» ovenfor.

## Hva som er og ikke er verifisert

HotLoop er kjørt mot ekte utstyr og ekte servere, og på bare metal 2026-11-17.
