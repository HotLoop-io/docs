---
title: "Historian-mål"
description: "Skriv hver måling HotLoop lagrer også til anleggets egen PostgreSQL, TimescaleDB, SQL Server, InfluxDB, MySQL eller MariaDB."
---

HotLoop har sin egen historikk, og den forsvinner ikke. Men et anlegg har allerede en database. IT tar sikkerhetskopi av den, oppdaterer den, kobler Power BI til den og svarer for den i en revisjon, og ingen skal ta i bruk vår bare for å få en trend. Derfor skriver HotLoop historikk også til deres.

Hver måling den innebygde historianen lagrer, går til hvert mål: de samme målingene, etter det samme dødbåndet, med den samme kvaliteten. Ikke flere, ikke færre. En trend tegnet fra målet og en tegnet i HotLoop stemmer overens, fordi det er de samme radene.

Mål finnes i HotLoop IoT, Edge og Gateway. Ikke i Edge Relay: Den har ingen egen historikk å ta igjen et mål fra, og hele jobben til et relé er å få målinger til en Gateway, som kan skrive dem hvor som helst.

Databaser HotLoop skriver til:

| Type | Versjoner testet mot | <span class="sr-only">Detaljer</span> |
|---|---|---|
| PostgreSQL og TimescaleDB | PostgreSQL 16 med TimescaleDB 2.30 | [nedenfor](#postgresql-og-timescaledb) |
| Microsoft SQL Server | SQL Server 2025 CU9 | [nedenfor](#microsoft-sql-server) |
| InfluxDB 2 og 3 | InfluxDB 2.9.1 og InfluxDB 3 Core 3.12.0 | [nedenfor](#influxdb-2-og-3) |
| MySQL og MariaDB | MySQL 26.7.0 og MariaDB 13.0.2 | [nedenfor](#mysql-og-mariadb) |
| Kafka-API (hendelsesstrøm) | Apache Kafka 4.4.0 og Redpanda 26.2.6 | [nedenfor](#kafka-api-hendelsesstrøm) |

## Legge til et mål

**Innstillinger, Historian-mål, Legg til et mål**, eller `POST /api/historian/targets` (se [HTTP-API-et](/nb/iot/api/#historian-mål)). Det er bare for administratorer, fordi et mål er et sted anleggsdata havner, og å bestemme hvor er en administrators sak. Alle som kan lese innstillingene, ser målene og hvordan det går med hvert enkelt.

Et mål er en type, en adresse (`host` eller `host:port`), en database, en tabell og en pålogging. Passordet krypteres med den samme nøkkelen som enhetenes legitimasjon (`HOTLOOP_SECRET_KEY_FILE`, se [Sikkerhetskopier og gjenoppretting](/nb/iot/backup/)) og kommer aldri ut av API-et igjen. Uten nøkkel avvises et mål med passord: en databasepålogging i klartekst i en sikkerhetskopi er nøyaktig det nøkkelen finnes for å hindre.

HotLoop lager tabellen hvis den ikke finnes. Hvis den finnes, men ikke er en HotLoop har laget (den har ikke de seks kolonnene nedenfor), er målet nede og sier hvilke kolonner som mangler, i stedet for at hver måling avvises én etter én.

## Hva som havner i tabellen

De samme seks kolonnene som HotLoops egen historikk har, slik at et søk skrevet for den ene leser den andre:

| Kolonne | <span class="sr-only">Detaljer</span> |
|---|---|
| `ts` | Når målingen ble tatt, UTC, til mikrosekundet |
| `device_id` | Enheten |
| `tag_name` | Taggen |
| `value` | Tallet, eller tomt for en tekstmåling |
| `string_val` | Teksten, eller tomt for et tall |
| `quality` | `good`, `bad` eller `uncertain` |

Primærnøkkelen er `(device_id, tag_name, ts)`, enhet og tag først fordi en trend ber om én tag over tid. Den nøkkelen er også grunnen til at det er ufarlig å sende en måling to ganger: det blir én rad. Innhentingen nedenfor bygger på det med vilje.

## Når et mål er nede

Dette er delen som teller, så her er nøyaktig hva som skjer.

**Pollingen venter aldri på det.** Målinger går til et mål gjennom en kø i minnet, like stor som den innebygde historianens (`HOTLOOP_HISTORIAN_QUEUE_SIZE`). Å levere fra seg en måling blokkerer aldri. En full kø kaster sin eldste måling for å lage plass, den samme regelen som den innebygde historianen følger, og av samme grunn: en ubegrenset kø på en pod med minnegrense ender i en OOM-kill, og da har du mistet etterslepet, live-dataene og prosessen. Et mål bak en brannmur som sluker hver pakke er testet til ikke å holde noe tilbake: ikke pollingen, ikke den innebygde historianen, ikke en nedstenging.

**Det tar igjen når det er tilbake.** Det som ventet i køen, går først. Det køen måtte kaste, går deretter, fra HotLoops egen historikk, som allerede har hver eneste av de målingene. Det finnes ingen andre kopi på disk å dimensjonere eller fylle, og innhentingen virker så lenge HotLoop beholder historikken sin (`HOTLOOP_HISTORIAN_RETENTION_DAYS`, 90 dager hvis du ikke har endret det), ikke så lenge en buffer varer.

**En omstart midt i glemmer ingenting.** Det et mål skylder, er et tidsrom skrevet i raden dets, ikke en haug med målinger i minnet. En ren stopp skriver ned nøyaktig hva som er skyldt. Et krasj kan ikke det, så i det øyeblikket et mål går ned eller begynner å kaste, skriver HotLoop ned hvor det begynte, åpent i enden. Neste oppstart sender alt herfra.

**Det sier høyt hva det ikke kan sende.** To ting kan ikke tas igjen, og begge havner i systemloggen, med hvor mange og når de ble tatt:

- Målinger som er eldre enn HotLoops egen oppbevaringstid når målet er tilbake. De er borte fra HotLoop også. Loggen oppgir det nøyaktige tidsrommet.
- Målinger målets database avviser helt: en verdi kolonnen ikke kan romme, en check-begrensning noen har lagt på tabellen. Gruppen deles til målingene den ikke tar imot er funnet, så én dårlig måling holder aldri igjen resten, og de telles som avvist. Det sies høyst én gang i minuttet, fordi en tag databasen ikke kan romme, avvises ved hver polling.

En database som ikke slipper HotLoop inn i det hele tatt (feil passord, ingen rett til å sette inn, tabellen mangler en kolonne) er **nede**, aldri «avviser». Målingene venter, og i det øyeblikket noen fikser det, havner de. Det er bare en avvisning som gjelder selve målingene, som noen gang gis opp.

Hvert trinn havner i systemloggen, under emnet `historian/<id>`:

```
warning  Historian target plant-pg (Plant historian) is down: dial tcp 10.20.0.9:5432: connect: connection refused.
         Readings wait in memory, up to 50000 of them; past that they're sent from HotLoop's own history when it's back.
info     Historian target plant-pg is back after 41m12s down. What waited in memory goes first.
warning  Historian target plant-pg couldn't keep up, and its queue dropped readings taken between
         2026-10-03T10:12:40Z and 2026-10-03T10:43:19Z (182211 readings dropped since HotLoop started).
         They go out from HotLoop's own history next.
info     Historian target plant-pg caught up: 182211 readings taken between 2026-10-03T10:12:40Z and
         2026-10-03T10:43:19Z went out from HotLoop's own history.
```

Innstillingskortet viser det samme live: tilstanden (`writing`, `catching up`, `down`, `off`), hvorfor det er nede, hvor mye som venter og hva som fortsatt er skyldt.

Innhentingen holder seg et minutt bak den nyeste målingen som er skyldt, og venter på at den innebygde historianen henger med, fordi en måling som fortsatt står i den køen, ikke er i databasen ennå. Å lese forbi den ville hoppet over den for godt.

## Slå av, endre, fjerne

Slått av får et mål ingenting og skylder ingenting for tiden det er av. Det det allerede var skyldt, forblir skyldt. En endring (nytt passord, ny adresse) starter det på nytt med de nye innstillingene, og det det var skyldt, forblir skyldt. Å fjerne et mål glemmer det det var skyldt. Det det allerede har, blir værende i databasen dets.

Bare HotLoop-en som serverer grensesnittet, skriver til mål. En `--mcp-stdio`-hjelper ved siden av gjør det ikke, ellers ville alt gått ut to ganger.

## PostgreSQL og TimescaleDB

```json
{"id":"plant-pg","name":"Plant historian","kind":"postgres","address":"db.plant.local","database":"plant",
 "username":"hotloop","password":"...","useTls":true}
```

- Porten er som standard 5432. Tabellen er som standard `hotloop_history`, og kan ha et skjema (`history.hotloop`). Skjemaet må finnes.
- Hvis databasen har TimescaleDB-utvidelsen, er tabellen HotLoop lager en hypertable på `ts`. Hvis det mislykkes, forblir tabellen vanlig, den tar fortsatt imot hver måling, og systemloggen sier hvorfor.
- Påloggingen må kunne koble til, lage tabellen første gang (eller du lager den, med de seks kolonnene ovenfor) og sette inn i den. Ingenting annet. En pålogging som kan lese tabellen, men ikke sette inn i den, er et mål som er nede, ikke ett som avviser målinger.
- `useTls` kontrollerer serverens sertifikat (`sslmode=verify-full`). `insecureSkipVerify` krypterer uten å kontrollere det (`sslmode=require`). Uten `useTls` er forbindelsen ikke kryptert (`sslmode=disable`).
- NaN og uendelighetene går inn som de er: `double precision` rommer dem.
- Setninger blir ikke forberedt, så en PgBouncer i transaksjonsmodus foran databasen er greit.

Tabellen, hvis du heller vil lage den selv:

```sql
CREATE TABLE hotloop_history (
    ts         timestamptz      NOT NULL,
    device_id  text             NOT NULL,
    tag_name   text             NOT NULL,
    value      double precision,
    string_val text,
    quality    text             NOT NULL,
    PRIMARY KEY (device_id, tag_name, ts)
);
```

## Microsoft SQL Server

```json
{"id":"plant-sql","name":"Plant historian","kind":"sqlserver","address":"sql.plant.local","database":"plant",
 "username":"hotloop","password":"...","useTls":true}
```

- Porten er som standard 1433, og tabellen `hotloop_history` i skjemaet `dbo`. Et skjema foran (`history.hotloop`) brukes som oppgitt, og må finnes.
- Databasen må finnes. HotLoop lager tabellen, ikke databasen.
- Tabellen HotLoop lager, har `ts` som `datetime2(6)`, navnene som `nvarchar`, `value` som `float`, `string_val` som `nvarchar(max)` og primærnøkkelen `(device_id, tag_name, ts)`. Den nøkkelen er grunnen til at et tag-navn kan være høyst 380 tegn, og et lengre avvises som måling og meldes: en klynget nøkkel kan være 900 byte.
- Påloggingen må kunne koble til, lage tabellen første gang (eller du lager den, med de seks kolonnene) og sette inn i den. En pålogging som kan lese tabellen, men ikke sette inn, er et mål som er nede, ikke ett som avviser målinger.
- **NaN og uendelighetene går inn med tid og kvalitet og uten tall.** SQL Servers `float` rommer dem ikke. Målingen er der, og `value` er NULL.
- SQL Server krypterer selve påloggingen, så passordet går aldri i klartekst. `useTls` krypterer målingene også og kontrollerer serverens sertifikat; `insecureSkipVerify` krypterer uten å kontrollere.
- En måling som allerede finnes, hoppes over, så å sende den to ganger gir én rad.

Tabellen, hvis du heller vil lage den selv:

```sql
CREATE TABLE dbo.hotloop_history (
    ts         datetime2(6)  NOT NULL,
    device_id  nvarchar(64)  NOT NULL,
    tag_name   nvarchar(380) NOT NULL,
    value      float         NULL,
    string_val nvarchar(max) NULL,
    quality    varchar(16)   NOT NULL,
    CONSTRAINT PK_hotloop_history PRIMARY KEY CLUSTERED (device_id, tag_name, ts)
);
```

## MySQL og MariaDB

```json
{"id":"plant-mysql","name":"Plant historian","kind":"mysql","address":"mysql.plant.local","database":"plant",
 "username":"hotloop","password":"...","useTls":true}
```

Én type for begge: de snakker samme protokoll og tar de samme setningene her, og begge kjøres i testsuiten.

- Porten er som standard 3306, og tabellen `hotloop_history`. Et navn med databasen foran (`other.hotloop`) brukes som oppgitt. Databasen må finnes; HotLoop lager tabellen, ikke databasen.
- Tabellen HotLoop lager, er InnoDB med `ts` som `DATETIME(6)` i UTC, `value` som `DOUBLE`, `string_val` som `LONGTEXT` og primærnøkkelen `(device_id, tag_name, ts)`. Navnene er `utf8mb4_bin`, fordi HotLoops tag-navn skiller mellom store og små bokstaver og serverens standard collation ikke gjør det: `Temp` og `TEMP` ville vært én nøkkel. Den nøkkelen er grunnen til at et tag-navn kan være høyst 512 tegn, og et lengre avvises som måling og meldes.
- **INSERT er den eneste rettigheten det trenger** når tabellen finnes, og CREATE første gang hvis du vil at HotLoop skal lage den. Det leser ikke tabellen, og det bruker ikke `ON DUPLICATE KEY UPDATE`, som også ville bedt om UPDATE: en måling som allerede finnes, er en duplikat på primærnøkkelen, og den hoppes over.
- **NaN og uendelighetene går inn med tid og kvalitet og uten tall.** `DOUBLE` rommer dem ikke. `value` er NULL.
- En duplikat på en annen unik indeks noen har lagt til, er ikke den samme målingen: den avvises og meldes, som en check-begrensning.
- `useTls` krypterer og kontrollerer serverens sertifikat; `insecureSkipVerify` krypterer uten å kontrollere. Uten `useTls` går passordet likevel ikke i klartekst (MySQL 8s standardpålogging sender det kryptert med serverens nøkkel), men hvem som helst i midten kunne byttet ut den nøkkelen, så oppgi `useTls` for alt som ikke ligger på anleggets eget nett.

Tabellen, hvis du heller vil lage den selv:

```sql
CREATE TABLE hotloop_history (
    ts         DATETIME(6)  NOT NULL,
    device_id  VARCHAR(64)  CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
    tag_name   VARCHAR(512) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
    value      DOUBLE       NULL,
    string_val LONGTEXT     CHARACTER SET utf8mb4 NULL,
    quality    VARCHAR(16)  NOT NULL,
    PRIMARY KEY (device_id, tag_name, ts)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

## InfluxDB 2 og 3

```json
{"id":"plant-influx","name":"Plant historian","kind":"influxdb","address":"influx.plant.local:8086",
 "org":"plant","database":"hotloop","password":"<an API token>","useTls":true}
```

Det samme målet snakker med InfluxDB 2 og med InfluxDB 3, over vanlig HTTP (`/api/v2/write`, line protocol, tidsstempler i mikrosekunder). Begge svarer på det, så det er ingen driver å låse og ingenting å velge.

- Porten er som standard 8086, InfluxDB 2s. InfluxDB 3 lytter på 8181 hvis du ikke har endret det, så oppgi porten.
- `database` er bucketen. `org` er InfluxDB 2s organisasjon, og InfluxDB 2 vil ha en: uten den er hver skriving en 400 som sier det, og målet er nede med den meldingen. InfluxDB 3 har ingen organisasjoner, så utelat den.
- `password` er API-tokenet. Det trenger skriverett på bucketen (InfluxDB 2) eller på databasen (InfluxDB 3). HotLoop lager ikke bucketen. En bucket som ikke finnes, gir en 404, som er målet nede, ikke avviste målinger. InfluxDB 3 lager en database når det skrives til den.
- `table` er målingen (measurement), `hotloop_history` hvis du ikke sier noe annet.
- En måling er et punkt. Enheten og taggen er tagger, så hver HotLoop-tag er én serie. Tallet (`value`) eller teksten (`string_val`) og kvaliteten (`quality`) er felter. Å sende en måling to ganger overskriver seg selv.
- **NaN og uendelighetene går inn med tid og kvalitet og uten feltet `value`.** Line protocol har ingen måte å skrive dem på.
- InfluxDB låser et felts type for godt (per shard i 2, per kolonne i 3). Hvis noe annet allerede har skrevet et tall til `string_val` eller tekst til `value`, avvises HotLoops målinger av den andre typen, telles og nevnes i systemloggen, og resten går inn.
- En 401 eller 403 (et token det ikke kjenner eller som ikke kan skrive) er målet nede, ikke en avvisning: ingenting kastes, og målingene går inn i det øyeblikket tokenet er riktig.
- `useTls` bytter til `https` og kontrollerer sertifikatet; `insecureSkipVerify` kontrollerer det ikke.

## Kafka-API (hendelsesstrøm)

Ikke en database: en strøm. Hver måling historianen lagrer, går til et Kafka-topic, og hvis du gir det et andre topic, gjør også hver linje HotLoop skriver til sin egen systemlogg (alarmer, enheter som går opp og ned, konfigurasjonsendringer) det. Det snakker Kafka-API-et, så Apache Kafka, Redpanda og alt annet som svarer på den protokollen, tar imot. Samme kø, samme innhenting fra HotLoops egen historikk, samme «en broker som er nede, bremser ingenting» som alle andre mål.

```json
{"id":"plant-stream","name":"Plant event stream","kind":"kafka","address":"kafka1.plant.local:9093,kafka2.plant.local:9093",
 "table":"hotloop.tags","username":"hotloop","password":"...","useTls":true,
 "options":{"sasl":"scram-sha-512","caCert":"-----BEGIN CERTIFICATE-----...","eventsTopic":"hotloop.events"}}
```

- `address` er en liste over brokere, kommaseparert, port 9092 hvis ikke oppgitt. Én er nok til å starte fra: brokeren sier hvor de andre er.
- `table` er topicet for målinger (`hotloop.tags` hvis du ikke sier noe annet). `options.eventsTopic` er topicet for hendelser, `hotloop.events` når du legger til målet fra skjemaet eller utelater det i API-kallet, og tomt for ingen hendelser. De to kan ikke være samme topic.
- HotLoop lager topicene hvis de ikke finnes, med brokerens egne standard partisjoner og replikering. En pålogging som ikke kan lage dem, er et mål som er nede med brokerens begrunnelse, så lag dem først hvis din ikke kan.
- `options.sasl` er `scram-sha-512`, `scram-sha-256` eller `plain`, med `username` og `password`. PLAIN sender passordet som det er, så HotLoop avviser det uten `useTls`. En pålogging brokeren avviser, er **nede**, med «the broker refused the login» i statusen, aldri «avviser målinger».
- `useTls` kontrollerer brokerens sertifikat. Hvis det ble signert av din egen CA, legg CA-en i `options.caCert` som PEM. `insecureSkipVerify` krypterer uten å kontrollere.
- Klientsertifikater (gjensidig TLS), Kerberos og OAuth-pålogginger støttes ikke.

**Hva som havner på målingstopicet.** Ett JSON-objekt per måling, med nøkkelen `deviceId/tag` slik at én tags målinger holder rekkefølgen på én partisjon:

```json
{"ts":"2026-10-31T12:00:00.123456Z","deviceId":"press-01","tag":"Zone1_Temp","value":21.5,"quality":"good","unit":"°C"}
{"ts":"2026-10-31T12:00:00Z","deviceId":"press-01","tag":"Program","value":null,"text":"Grade A","quality":"good"}
{"ts":"2026-10-31T12:00:00Z","deviceId":"press-01","tag":"Speed","value":null,"nonFinite":"NaN","quality":"bad"}
```

Et tall er `value`; tekst er `text` med `value` null; JSON kan ikke bære NaN eller en uendelighet, så de sier `nonFinite` (`NaN`, `+Inf`, `-Inf`) og `value` er null. Det legges bare til felter i dette formatet, aldri endres noe. Hoder: `hotloop-type: reading` og `content-type: application/json`. Postens eget tidsstempel er når den ble produsert; målingens tidspunkt er `ts`.

**Hva som havner på hendelsestopicet.** Ett JSON-objekt per linje i systemloggen, med emnet som nøkkel (eller kategorien når det ikke har noe), `hotloop-type: event`:

```json
{"at":"2026-10-31T12:00:00.456Z","severity":"warning","category":"alarm","subject":"press-01/Zone1_Temp",
 "actor":"system","message":"Zone 1 is over 250","detail":{"limit":250,"value":251.5}}
```

`detail` er JSON-en linjen bar, som JSON, eller tekst når den ikke var JSON. Linjer om selve historian-målene er utelatt, ellers ville en broker som er nede, meldt seg selv nede til seg selv.

**Det er minst én gang, og hendelser er best effort.**
- Målinger: Leveringen bekreftes av hver synkroniserte replika, og innhentingen etter et avbrudd overlapper med vilje det som allerede gikk ut, så en måling kan komme to ganger. `deviceId`, `tag` og `ts` angir en duplikat; en forbruker som bryr seg, kaster gjentakelsen. En måling som aldri når brokeren, er skyldt og sendes fra HotLoops egen historikk, akkurat som for en database.
- Hendelser er livestrømmen. Det finnes ingen historikk å ta dem igjen fra, så en hendelse som produseres mens brokeren er borte, eller forbi en full buffer, går tapt, og målets status teller den (`eventsLost`) og innstillingskortet sier det.
- En broker som forsvinner midt i en skriving, gjør målet **nede** innen 25 sekunder, og målingene i den skrivingen er skyldt. (franz-go ville ellers ventet for alltid på en skriving det ikke kan bevise at ikke kom frem; HotLoop lar det gi opp, og det er derfor en duplikat er mulig.)
- En måling brokeren aldri vil ta imot (større enn en melding kan være) avvises for seg, telles og nevnes i systemloggen, og resten av gruppen går likevel.

HotLoop snakker Kafka-API-et gjennom [franz-go](https://github.com/twmb/franz-go) (BSD-3-Clause), oppgitt i `NOTICE`. Det la omtrent 5 MiB til binærfilen.

## Hvordan det testes

Hver type mål er kjørt mot den virkelige databasen eller brokeren, gjennom et avbrudd som faktisk ble kuttet og gjenopprettet: målet ender med å inneholde nøyaktig det HotLoop inneholder, en omstart mens det er nede tar igjen ved neste oppstart, og et mål som henger, holder ikke igjen verken pollingen eller den innebygde historianen.
