---
title: "Destinazioni dello storico"
description: "Scriva ogni lettura che HotLoop conserva anche nel PostgreSQL, TimescaleDB, SQL Server, InfluxDB, MySQL o MariaDB dell'impianto."
---

HotLoop conserva il proprio storico, e questo non cambia. Ma un impianto ha già un database. L'IT lo salva, lo aggiorna, ci collega Power BI e ne risponde in un audit, e nessuno adotterà il nostro solo per vedere un andamento. Per questo HotLoop scrive lo storico anche nel loro.

Ogni lettura che lo storico integrato conserva va a ogni destinazione: le stesse letture, dopo la stessa banda morta, con la stessa qualità. Né di più né di meno. Un andamento tracciato dalla destinazione e uno tracciato in HotLoop coincidono, perché sono le stesse righe.

Le destinazioni sono in HotLoop IoT, Edge e Gateway. Non nell'Edge Relay: non ha uno storico proprio da cui allineare una destinazione, e il compito di un relay è portare le letture a un Gateway, che può scriverle ovunque.

Database in cui scrive HotLoop:

| Tipo | Versioni provate | <span class="sr-only">Details</span> |
|---|---|---|
| PostgreSQL e TimescaleDB | PostgreSQL 16 con TimescaleDB 2.30 | [sotto](#postgresql-e-timescaledb) |
| Microsoft SQL Server | SQL Server 2025 CU9 | [sotto](#microsoft-sql-server) |
| InfluxDB 2 e 3 | InfluxDB 2.9.1 e InfluxDB 3 Core 3.12.0 | [sotto](#influxdb-2-e-3) |
| MySQL e MariaDB | MySQL 26.7.0 e MariaDB 13.0.2 | [sotto](#mysql-e-mariadb) |
| API Kafka (flusso di eventi) | Apache Kafka 4.4.0 e Redpanda 26.2.6 | [sotto](#api-kafka-flusso-di-eventi) |

## Aggiungerne una

**Impostazioni, Destinazioni dello storico, Aggiungi una destinazione**, oppure `POST /api/historian/targets` (vedere [l'API HTTP](/it/iot/api/#destinazioni-dello-storico)). È solo per gli amministratori, perché una destinazione è un posto dove vanno i dati dell'impianto, e deciderlo spetta a un amministratore. Chiunque possa leggere le impostazioni vede le destinazioni e come sta andando ciascuna.

Una destinazione è un tipo, un indirizzo (`host` o `host:port`), un database, una tabella e un login. La password è cifrata con la stessa chiave delle credenziali dei dispositivi (`HOTLOOP_SECRET_KEY_FILE`, vedere [Backup e ripristino](/it/iot/backup/)) e non esce mai dall'API. Senza chiave, una destinazione con password viene rifiutata: un login di database in chiaro in un backup è esattamente ciò che quella chiave serve a evitare.

HotLoop crea la tabella se non esiste. Se esiste ma non è stata creata da HotLoop (non ha le sei colonne qui sotto), la destinazione risulta non attiva e indica quali colonne mancano, invece di rifiutare ogni lettura una per una.

## Cosa arriva nella tabella

Le stesse sei colonne dello storico di HotLoop, così una query scritta per uno legge anche l'altro:

| Colonna | <span class="sr-only">Details</span> |
|---|---|
| `ts` | Quando è stata rilevata la lettura, in UTC, al microsecondo |
| `device_id` | Il dispositivo |
| `tag_name` | Il tag |
| `value` | Il numero, oppure vuoto per una lettura di testo |
| `string_val` | Il testo, oppure vuoto per un numero |
| `quality` | `good`, `bad` o `uncertain` |

La chiave primaria è `(device_id, tag_name, ts)`, con dispositivo e tag per primi perché un andamento chiede un tag nel tempo. Quella chiave è anche il motivo per cui inviare una lettura due volte è innocuo: è una sola riga. L'allineamento qui sotto si appoggia su questo di proposito.

## Quando una destinazione non è attiva

Questa è la parte che conta, quindi ecco esattamente cosa succede.

**Il polling non la aspetta mai.** Le letture vanno a una destinazione attraverso una coda in memoria, grande quanto quella dello storico integrato (`HOTLOOP_HISTORIAN_QUEUE_SIZE`). Consegnare una lettura non blocca mai. Una coda piena scarta la lettura più vecchia per fare posto, la stessa regola dello storico integrato e per lo stesso motivo: una coda senza limite su un pod con un limite di memoria finisce in un OOM kill, e allora si perdono l'arretrato, i dati in tempo reale e il processo. Una destinazione dietro un firewall che inghiotte ogni pacchetto è provata per non trattenere nulla: né il polling, né lo storico integrato, né uno spegnimento.

**Si allinea quando torna.** Ciò che aspettava nella coda parte per primo. Ciò che la coda ha dovuto scartare parte dopo, dallo storico di HotLoop, che contiene già ognuna di quelle letture. Non c'è una seconda copia su disco da dimensionare o riempire, e l'allineamento funziona finché HotLoop conserva il proprio storico (`HOTLOOP_HISTORIAN_RETENTION_DAYS`, 90 giorni salvo modifica), non finché dura un buffer.

**Un riavvio a metà non dimentica.** Ciò che è dovuto a una destinazione è un intervallo di tempo scritto nella sua riga, non un mucchio di letture in memoria. Un arresto pulito annota esattamente ciò che è dovuto. Un crash non può, quindi nel momento in cui una destinazione va giù o inizia a scartare, HotLoop annota da dove è iniziato, con fine aperta. Il successivo avvio invia tutto da lì.

**Dice ad alta voce ciò che non può inviare.** Due cose non si possono allineare, ed entrambe vanno nel log di sistema, con quante sono e quando sono state rilevate:

- Letture più vecchie della conservazione di HotLoop quando la destinazione torna. Sono sparite anche da HotLoop. Il log indica l'intervallo esatto.
- Letture che il database della destinazione rifiuta del tutto: un valore che la sua colonna non può contenere, un vincolo check messo da qualcuno sulla tabella. Il lotto viene diviso finché si trovano le letture che non accetta, così una lettura sbagliata non blocca mai le altre, e vengono contate come rifiutate. Viene segnalato al massimo una volta al minuto, perché un tag che il database non può contenere viene rifiutato a ogni polling.

Un database che non lascia entrare HotLoop (password sbagliata, nessun permesso di inserimento, una colonna mancante nella tabella) è **non attivo**, mai «in rifiuto». Le letture aspettano e, appena qualcuno lo sistema, arrivano. Si rinuncia solo a un rifiuto che riguarda le letture stesse.

Ogni passaggio finisce nel log di sistema, sotto il soggetto `historian/<id>`:

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

La scheda Impostazioni mostra la stessa cosa in tempo reale: lo stato (`writing`, `catching up`, `down`, `off`), perché non è attiva, quanto è in attesa e cosa è ancora dovuto.

L'allineamento resta un minuto dietro la lettura più recente che è dovuta, e aspetta che lo storico integrato sia al passo, perché una lettura ancora in quella coda non è ancora nel database. Leggere oltre la farebbe saltare per sempre.

## Spegnerne una, modificarla, rimuoverla

Spenta, una destinazione non riceve nulla e non le è dovuto nulla per il tempo in cui resta spenta. Ciò che le era già dovuto resta dovuto. Una modifica (una nuova password, un nuovo indirizzo) la riavvia con le nuove impostazioni, e ciò che le era dovuto resta dovuto. Rimuoverla fa dimenticare ciò che le era dovuto. Ciò che contiene già resta nel suo database.

Scrive nelle destinazioni solo l'HotLoop che serve l'interfaccia. Un helper `--mcp-stdio` che gira accanto non lo fa, altrimenti tutto uscirebbe due volte.

## PostgreSQL e TimescaleDB

```json
{"id":"plant-pg","name":"Plant historian","kind":"postgres","address":"db.plant.local","database":"plant",
 "username":"hotloop","password":"...","useTls":true}
```

- La porta predefinita è 5432. La tabella predefinita è `hotloop_history` e può portare uno schema (`history.hotloop`). Lo schema deve esistere.
- Se il database ha l'estensione TimescaleDB, la tabella creata da HotLoop è una hypertable su `ts`. Se la conversione fallisce, la tabella resta normale, accetta comunque ogni lettura e il log di sistema dice perché.
- Il login deve potersi connettere, creare la tabella la prima volta (oppure la crea lei, con le sei colonne qui sopra) e inserirvi dati. Nient'altro. Un login che può leggere la tabella ma non inserirvi è una destinazione non attiva, non una che rifiuta letture.
- `useTls` verifica il certificato del server (`sslmode=verify-full`). `insecureSkipVerify` cifra senza verificarlo (`sslmode=require`). Senza `useTls` la connessione non è cifrata (`sslmode=disable`).
- NaN e gli infiniti entrano così come sono: `double precision` li contiene.
- Le istruzioni non sono preparate, quindi un PgBouncer in modalità transazione davanti al database va bene.

La tabella, se preferisce crearla da sé:

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

- La porta predefinita è 1433, la tabella `hotloop_history` nello schema `dbo`. Uno schema davanti (`history.hotloop`) viene usato così com'è e deve esistere.
- Il database deve esistere. HotLoop crea la tabella, non il database.
- La tabella creata da HotLoop ha `ts` come `datetime2(6)`, i nomi come `nvarchar`, `value` come `float`, `string_val` come `nvarchar(max)` e la chiave primaria `(device_id, tag_name, ts)`. Quella chiave è il motivo per cui un nome di tag può avere al massimo 380 caratteri, e uno più lungo viene rifiutato come lettura e segnalato: una chiave cluster può essere di 900 byte.
- Il login deve potersi connettere, creare la tabella la prima volta (oppure la crea lei, con quelle sei colonne) e inserirvi dati. Un login che può leggere la tabella ma non inserirvi è una destinazione non attiva, non una che rifiuta letture.
- **NaN e gli infiniti entrano con il loro orario e la loro qualità e senza numero.** Il `float` di SQL Server non può contenerli. La lettura c'è, e `value` è NULL.
- SQL Server cifra il login stesso, quindi la password non viaggia mai in chiaro. `useTls` cifra anche le letture e verifica il certificato del server; `insecureSkipVerify` cifra senza verificarlo.
- Una lettura già presente viene saltata, quindi inviarla due volte dà una sola riga.

La tabella, se preferisce crearla da sé:

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

## MySQL e MariaDB

```json
{"id":"plant-mysql","name":"Plant historian","kind":"mysql","address":"mysql.plant.local","database":"plant",
 "username":"hotloop","password":"...","useTls":true}
```

Un solo tipo per entrambi: parlano lo stesso protocollo e accettano qui le stesse istruzioni, ed entrambi vengono eseguiti nella suite di test.

- La porta predefinita è 3306, la tabella `hotloop_history`. Un nome preceduto dal database (`other.hotloop`) viene usato così com'è. Il database deve esistere; HotLoop crea la tabella, non il database.
- La tabella creata da HotLoop è InnoDB con `ts` come `DATETIME(6)` in UTC, `value` come `DOUBLE`, `string_val` come `LONGTEXT` e la chiave primaria `(device_id, tag_name, ts)`. I nomi sono `utf8mb4_bin`, perché i nomi dei tag di HotLoop distinguono maiuscole e minuscole e la collation predefinita dei server no: `Temp` e `TEMP` sarebbero una sola chiave. Quella chiave è il motivo per cui un nome di tag può avere al massimo 512 caratteri, e uno più lungo viene rifiutato come lettura e segnalato.
- **INSERT è l'unico privilegio necessario** una volta che la tabella c'è, e CREATE la prima volta se preferisce che la crei HotLoop. Non legge la tabella e non usa `ON DUPLICATE KEY UPDATE`, che chiederebbe anche UPDATE: una lettura già presente è un duplicato sulla chiave primaria, e viene saltata.
- **NaN e gli infiniti entrano con il loro orario e la loro qualità e senza numero.** `DOUBLE` non può contenerli. `value` è NULL.
- Un duplicato su un altro indice univoco aggiunto da qualcuno non è la stessa lettura: viene rifiutata e segnalata, come un vincolo check.
- `useTls` cifra e verifica il certificato del server; `insecureSkipVerify` cifra senza verificarlo. Senza `useTls` la password comunque non viaggia in chiaro (il login predefinito di MySQL 8 la invia cifrata con la chiave del server), ma chiunque si trovi nel mezzo potrebbe sostituire quella chiave, quindi indichi `useTls` per tutto ciò che non è sulla rete propria dell'impianto.

La tabella, se preferisce crearla da sé:

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

## InfluxDB 2 e 3

```json
{"id":"plant-influx","name":"Plant historian","kind":"influxdb","address":"influx.plant.local:8086",
 "org":"plant","database":"hotloop","password":"<an API token>","useTls":true}
```

La stessa destinazione parla con InfluxDB 2 e con InfluxDB 3, su semplice HTTP (`/api/v2/write`, line protocol, timestamp al microsecondo). Rispondono entrambi, quindi non c'è un driver da fissare né nulla da scegliere.

- La porta predefinita è 8086, quella di InfluxDB 2. InfluxDB 3 ascolta sulla 8181 salvo modifica, quindi indichi la porta.
- `database` è il bucket. `org` è l'organizzazione di InfluxDB 2, e InfluxDB 2 ne vuole una: senza, ogni scrittura è un 400 che lo dice, e la destinazione è non attiva con quel messaggio. InfluxDB 3 non ha organizzazioni, quindi la ometta.
- `password` è il token API. Serve il permesso di scrittura sul bucket (InfluxDB 2) o sul database (InfluxDB 3). HotLoop non crea il bucket. Un bucket che non c'è dà un 404, cioè la destinazione non attiva, non letture rifiutate. InfluxDB 3 crea un database quando ci si scrive.
- `table` è la misura (measurement), `hotloop_history` salvo diversa indicazione.
- Una lettura è un punto. Il dispositivo e il tag sono tag, quindi ogni tag di HotLoop è una serie. Il numero (`value`) o il testo (`string_val`) e la qualità (`quality`) sono campi. Inviare una lettura due volte la sovrascrive.
- **NaN e gli infiniti entrano con il loro orario e la loro qualità e senza campo `value`.** Il line protocol non ha modo di scriverli.
- InfluxDB fissa il tipo di un campo per sempre (per shard nella 2, per colonna nella 3). Se qualcos'altro ha già scritto un numero in `string_val` o testo in `value`, le letture di HotLoop dell'altro tipo vengono rifiutate, contate e nominate nel log di sistema, e le altre entrano.
- Un 401 o un 403 (un token che non conosce o che non può scrivere) è la destinazione non attiva, non un rifiuto: nulla viene buttato, e le letture entrano appena il token è giusto.
- `useTls` passa a `https` e verifica il certificato; `insecureSkipVerify` non lo verifica.

## API Kafka (flusso di eventi)

Non un database: un flusso. Ogni lettura che lo storico conserva va a un topic Kafka e, se gliene dà un secondo, anche ogni riga che HotLoop scrive nel proprio log di sistema (allarmi, dispositivi che si collegano e cadono, modifiche di configurazione). Parla l'API Kafka, quindi Apache Kafka, Redpanda e qualunque altro server che risponda a quel protocollo la accettano. Stessa coda, stesso allineamento dallo storico di HotLoop, stesso «un broker non attivo non rallenta nulla» di ogni altra destinazione.

```json
{"id":"plant-stream","name":"Plant event stream","kind":"kafka","address":"kafka1.plant.local:9093,kafka2.plant.local:9093",
 "table":"hotloop.tags","username":"hotloop","password":"...","useTls":true,
 "options":{"sasl":"scram-sha-512","caCert":"-----BEGIN CERTIFICATE-----...","eventsTopic":"hotloop.events"}}
```

- `address` è un elenco di broker separati da virgole, porta 9092 se non indicata. Uno basta per partire: il broker dice dove sono gli altri.
- `table` è il topic delle letture (`hotloop.tags` salvo diversa indicazione). `options.eventsTopic` è il topic degli eventi, `hotloop.events` quando aggiunge la destinazione dal modulo o lo omette nella chiamata API, e vuoto per nessun evento. I due non possono essere lo stesso topic.
- HotLoop crea i topic se non esistono, con le partizioni e la replica predefinite del broker. Un login che non può crearli è una destinazione non attiva con il motivo del broker, quindi li crei prima se il suo non può.
- `options.sasl` è `scram-sha-512`, `scram-sha-256` o `plain`, con `username` e `password`. PLAIN invia la password così com'è, quindi HotLoop lo rifiuta senza `useTls`. Un login che il broker respinge è **non attivo**, con «the broker refused the login» nello stato, mai «rifiuto di letture».
- `useTls` verifica il certificato del broker. Se è stato firmato dalla sua CA, metta la CA in `options.caCert` come PEM. `insecureSkipVerify` cifra senza verificare.
- Certificati client (TLS reciproco), Kerberos e login OAuth non sono supportati.

**Cosa arriva sul topic delle letture.** Un oggetto JSON per lettura, con chiave `deviceId/tag` perché le letture di un tag restino in ordine su una partizione:

```json
{"ts":"2026-10-31T12:00:00.123456Z","deviceId":"press-01","tag":"Zone1_Temp","value":21.5,"quality":"good","unit":"°C"}
{"ts":"2026-10-31T12:00:00Z","deviceId":"press-01","tag":"Program","value":null,"text":"Grade A","quality":"good"}
{"ts":"2026-10-31T12:00:00Z","deviceId":"press-01","tag":"Speed","value":null,"nonFinite":"NaN","quality":"bad"}
```

Un numero è `value`; il testo è `text` con `value` nullo; JSON non può portare NaN né un infinito, quindi questi indicano `nonFinite` (`NaN`, `+Inf`, `-Inf`) e `value` è nullo. A questo formato si aggiungono solo campi, mai si cambia. Intestazioni: `hotloop-type: reading` e `content-type: application/json`. Il timestamp del record è quando è stato prodotto; l'orario della lettura è `ts`.

**Cosa arriva sul topic degli eventi.** Un oggetto JSON per riga del log di sistema, con chiave il suo soggetto (o la sua categoria quando non ne ha), `hotloop-type: event`:

```json
{"at":"2026-10-31T12:00:00.456Z","severity":"warning","category":"alarm","subject":"press-01/Zone1_Temp",
 "actor":"system","message":"Zone 1 is over 250","detail":{"limit":250,"value":251.5}}
```

`detail` è il JSON che la riga portava, come JSON, oppure testo quando non era JSON. Le righe sulle destinazioni dello storico stesse sono escluse, altrimenti un broker non attivo segnalerebbe a se stesso il proprio guasto.

**È almeno una volta, e gli eventi sono al meglio possibile.**
- Letture: la consegna è confermata da ogni replica sincronizzata, e l'allineamento dopo un'interruzione si sovrappone di proposito a ciò che era già partito, quindi una lettura può arrivare due volte. `deviceId`, `tag` e `ts` identificano un duplicato; un consumatore a cui importa scarta il ripetuto. Una lettura che non raggiunge mai il broker è dovuta e viene inviata dallo storico di HotLoop, come per un database.
- Gli eventi sono il flusso in tempo reale. Non esiste uno storico da cui allinearli, quindi un evento prodotto mentre il broker è assente, o oltre un buffer pieno, va perso, e lo stato della destinazione lo conta (`eventsLost`) e la scheda Impostazioni lo mostra.
- Un broker che sparisce a metà di una scrittura rende la destinazione **non attiva** entro 25 secondi, e le letture di quella scrittura sono dovute. (franz-go altrimenti aspetterebbe all'infinito una scrittura di cui non può provare che non sia arrivata; HotLoop lo lascia rinunciare, ed è per questo che un duplicato è possibile.)
- Una lettura che il broker non accetterà mai (più grande di quanto possa essere un messaggio) viene rifiutata da sola, contata e nominata nel log di sistema, e il resto del suo lotto parte comunque.

HotLoop parla l'API Kafka tramite [franz-go](https://github.com/twmb/franz-go) (BSD-3-Clause), citato in `NOTICE`. Ha aggiunto circa 5 MiB al binario.

## Come viene provato

Ogni tipo di destinazione è stato eseguito contro il vero database o broker, attraverso un'interruzione tagliata e ripristinata davvero: la destinazione finisce per contenere esattamente ciò che contiene HotLoop, un riavvio mentre è non attiva si allinea al successivo avvio, e una destinazione che si blocca non trattiene né il polling né lo storico integrato.
