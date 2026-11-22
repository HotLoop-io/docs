---
title: "Historian-Ziele"
description: "Schreiben Sie jede Messung, die HotLoop speichert, zusätzlich in die PostgreSQL, TimescaleDB, SQL Server, InfluxDB, MySQL oder MariaDB des Werks."
---

HotLoop führt seine eigene Historie, und das bleibt so. Aber ein Werk hat bereits eine Datenbank. Die IT sichert sie, spielt Updates ein, bindet Power BI an und steht in einem Audit dafür gerade, und niemand stellt auf unsere um, nur um einen Verlauf zu sehen. Deshalb schreibt HotLoop die Historie zusätzlich in deren Datenbank.

Jede Messung, die der eingebaute Historian speichert, geht an jedes Ziel: dieselben Messungen, nach demselben Totband, mit derselben Qualität. Nicht mehr, nicht weniger. Ein Verlauf aus dem Ziel und einer aus HotLoop stimmen überein, weil es dieselben Zeilen sind.

Ziele gibt es in HotLoop IoT, Edge und Gateway. Nicht im Edge Relay: Er hat keine eigene Historie, aus der er ein Ziel nachziehen könnte, und die ganze Aufgabe eines Relays ist es, Messungen zu einem Gateway zu bringen, das sie überallhin schreiben kann.

Datenbanken, in die HotLoop schreibt:

| Art | Getestete Versionen | <span class="sr-only">Details</span> |
|---|---|---|
| PostgreSQL und TimescaleDB | PostgreSQL 16 mit TimescaleDB 2.30 | [unten](#postgresql-und-timescaledb) |
| Microsoft SQL Server | SQL Server 2025 CU9 | [unten](#microsoft-sql-server) |
| InfluxDB 2 und 3 | InfluxDB 2.9.1 und InfluxDB 3 Core 3.12.0 | [unten](#influxdb-2-und-3) |
| MySQL und MariaDB | MySQL 26.7.0 und MariaDB 13.0.2 | [unten](#mysql-und-mariadb) |
| Kafka-API (Ereignisstrom) | Apache Kafka 4.4.0 und Redpanda 26.2.6 | [unten](#kafka-api-ereignisstrom) |

## Ein Ziel hinzufügen

**Einstellungen, Historian-Ziele, Ziel hinzufügen**, oder `POST /api/historian/targets` (siehe [die HTTP-API](/de/iot/api/#historian-targets)). Das ist nur für Administratoren, denn ein Ziel ist ein Ort, an den Werksdaten gehen, und darüber entscheidet ein Administrator. Alle, die die Einstellungen lesen dürfen, sehen die Ziele und wie es jedem geht.

Ein Ziel besteht aus einer Art, einer Adresse (`host` oder `host:port`), einer Datenbank, einer Tabelle und einem Login. Das Passwort wird mit demselben Schlüssel wie die Zugangsdaten der Geräte verschlüsselt (`HOTLOOP_SECRET_KEY_FILE`, siehe [Sicherungen und Wiederherstellung](/de/iot/backup/)) und kommt nie wieder aus der API heraus. Ohne Schlüssel wird ein Ziel mit Passwort abgelehnt: Ein Datenbank-Login im Klartext in einer Sicherung ist genau das, was dieser Schlüssel verhindern soll.

HotLoop legt die Tabelle an, wenn sie fehlt. Gibt es sie, stammt aber nicht von HotLoop (ihr fehlen die sechs Spalten unten), ist das Ziel nicht erreichbar und nennt die fehlenden Spalten, statt jede Messung einzeln abzulehnen.

## Was in der Tabelle landet

Dieselben sechs Spalten wie in der eigenen Historie von HotLoop, damit eine Abfrage, die für die eine geschrieben ist, auch die andere liest:

| Spalte | <span class="sr-only">Details</span> |
|---|---|
| `ts` | Wann die Messung aufgenommen wurde, UTC, auf die Mikrosekunde |
| `device_id` | Das Gerät |
| `tag_name` | Der Tag |
| `value` | Die Zahl, oder leer bei einer Textmessung |
| `string_val` | Der Text, oder leer bei einer Zahl |
| `quality` | `good`, `bad` oder `uncertain` |

Der Primärschlüssel ist `(device_id, tag_name, ts)`, Gerät und Tag zuerst, weil ein Verlauf einen Tag über die Zeit abfragt. Dieser Schlüssel ist auch der Grund, warum es harmlos ist, eine Messung zweimal zu senden: Es ist eine Zeile. Das Nachholen unten stützt sich absichtlich darauf.

## Wenn ein Ziel nicht erreichbar ist

Das ist der Teil, auf den es ankommt, deshalb hier genau, was passiert.

**Das Abfragen wartet nie darauf.** Messungen gehen über eine Warteschlange im Speicher an ein Ziel, so groß wie die des eingebauten Historians (`HOTLOOP_HISTORIAN_QUEUE_SIZE`). Eine Messung zu übergeben blockiert nie. Eine volle Warteschlange wirft ihre älteste Messung weg, um Platz zu machen, dieselbe Regel wie beim eingebauten Historian und aus demselben Grund: Eine unbegrenzte Warteschlange auf einem Pod mit Speicherlimit endet in einem OOM-Kill, und dann sind der Rückstand, die Live-Daten und der Prozess verloren. Ein Ziel hinter einer Firewall, die jedes Paket verschluckt, ist darauf getestet, nichts aufzuhalten: nicht das Abfragen, nicht den eingebauten Historian, nicht ein Herunterfahren.

**Es holt nach, wenn es wieder da ist.** Was in der Warteschlange wartete, geht zuerst. Was die Warteschlange verwerfen musste, geht danach, aus der eigenen Historie von HotLoop, die jede dieser Messungen bereits enthält. Es gibt keine zweite Kopie auf der Platte, die bemessen oder gefüllt werden müsste, und das Nachholen funktioniert so lange, wie HotLoop seine Historie behält (`HOTLOOP_HISTORIAN_RETENTION_DAYS`, 90 Tage, sofern Sie es nicht geändert haben), nicht so lange, wie ein Puffer reicht.

**Ein Neustart mittendrin vergisst nichts.** Was einem Ziel noch geschuldet wird, ist ein Zeitbereich, der in seiner Zeile steht, kein Haufen Messungen im Speicher. Ein sauberes Beenden schreibt genau auf, was geschuldet wird. Ein Absturz kann das nicht. Deshalb notiert HotLoop in dem Moment, in dem ein Ziel ausfällt oder anfängt zu verwerfen, wo es begann, mit offenem Ende. Der nächste Start sendet alles ab dort.

**Es sagt laut, was es nicht senden kann.** Zwei Dinge lassen sich nicht nachholen, und beide gehen ins Systemprotokoll, mit Anzahl und Aufnahmezeit:

- Messungen, die bei der Rückkehr des Ziels älter sind als die Aufbewahrung von HotLoop. Sie sind auch aus HotLoop verschwunden. Das Protokoll nennt den genauen Bereich.
- Messungen, die die Datenbank des Ziels glatt ablehnt: ein Wert, den ihre Spalte nicht aufnehmen kann, eine Check-Einschränkung, die jemand auf die Tabelle gesetzt hat. Der Stapel wird geteilt, bis die abgelehnten Messungen gefunden sind, sodass eine schlechte Messung nie den Rest aufhält, und sie werden als abgelehnt gezählt. Das wird höchstens einmal pro Minute gemeldet, weil ein Tag, den die Datenbank nicht aufnehmen kann, bei jeder Abfrage abgelehnt wird.

Eine Datenbank, die HotLoop gar nicht hineinlässt (falsches Passwort, keine Einfügerechte, der Tabelle fehlt eine Spalte), ist **nicht erreichbar**, nie „lehnt ab“. Die Messungen warten, und sobald jemand es behebt, kommen sie an. Aufgegeben wird nur bei einer Ablehnung, die die Messungen selbst betrifft.

Jeder Schritt steht im Systemprotokoll, unter dem Betreff `historian/<id>`:

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

Die Karte in den Einstellungen zeigt dasselbe live: den Zustand (`writing`, `catching up`, `down`, `off`), warum es ausgefallen ist, wie viel wartet und was noch geschuldet wird.

Das Nachholen bleibt eine Minute hinter der neuesten geschuldeten Messung zurück und wartet darauf, dass der eingebaute Historian mitkommt, denn eine Messung, die noch in dieser Warteschlange ist, steht noch nicht in der Datenbank. Darüber hinauszulesen würde sie für immer überspringen.

## Ausschalten, ändern, entfernen

Ausgeschaltet bekommt ein Ziel nichts und ihm wird für die Zeit des Ausschaltens nichts geschuldet. Was ihm schon geschuldet wurde, bleibt geschuldet. Eine Änderung (neues Passwort, neue Adresse) startet es mit den neuen Einstellungen neu, und was ihm geschuldet wurde, bleibt geschuldet. Beim Entfernen wird vergessen, was ihm geschuldet wurde. Was es schon enthält, bleibt in seiner Datenbank.

Nur das HotLoop, das die Oberfläche bedient, schreibt in Ziele. Ein `--mcp-stdio`-Helfer daneben tut das nicht, sonst ginge alles doppelt hinaus.

## PostgreSQL und TimescaleDB

```json
{"id":"plant-pg","name":"Plant historian","kind":"postgres","address":"db.plant.local","database":"plant",
 "username":"hotloop","password":"...","useTls":true}
```

- Der Port ist standardmäßig 5432. Die Tabelle heißt standardmäßig `hotloop_history` und kann ein Schema tragen (`history.hotloop`). Das Schema muss existieren.
- Hat die Datenbank die Erweiterung TimescaleDB, ist die von HotLoop angelegte Tabelle eine Hypertable auf `ts`. Schlägt das fehl, bleibt die Tabelle normal, nimmt weiterhin jede Messung auf, und das Systemprotokoll nennt den Grund.
- Das Login muss sich verbinden, beim ersten Mal die Tabelle anlegen (oder Sie legen sie an, mit den sechs Spalten oben) und Daten einfügen. Mehr nicht. Ein Login, das die Tabelle lesen, aber nicht einfügen kann, ist ein Ziel, das nicht erreichbar ist, keines, das Messungen ablehnt.
- `useTls` prüft das Zertifikat des Servers (`sslmode=verify-full`). `insecureSkipVerify` verschlüsselt ohne Prüfung (`sslmode=require`). Ohne `useTls` ist die Verbindung nicht verschlüsselt (`sslmode=disable`).
- NaN und die Unendlichkeiten werden unverändert geschrieben: `double precision` nimmt sie auf.
- Anweisungen werden nicht vorbereitet, daher ist ein PgBouncer im Transaktionsmodus vor der Datenbank in Ordnung.

Die Tabelle, falls Sie sie lieber selbst anlegen:

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

- Der Port ist standardmäßig 1433, die Tabelle `hotloop_history` im Schema `dbo`. Ein vorangestelltes Schema (`history.hotloop`) wird wie angegeben verwendet und muss existieren.
- Die Datenbank muss existieren. HotLoop legt die Tabelle an, nicht die Datenbank.
- Die von HotLoop angelegte Tabelle hat `ts` als `datetime2(6)`, die Namen als `nvarchar`, `value` als `float`, `string_val` als `nvarchar(max)` und den Primärschlüssel `(device_id, tag_name, ts)`. Dieser Schlüssel ist der Grund, warum ein Tag-Name höchstens 380 Zeichen lang sein darf und ein längerer als Messung abgelehnt und gemeldet wird: Ein gruppierter Schlüssel darf 900 Bytes groß sein.
- Das Login muss sich verbinden, beim ersten Mal die Tabelle anlegen (oder Sie legen sie an, mit diesen sechs Spalten) und Daten einfügen. Ein Login, das die Tabelle lesen, aber nicht einfügen kann, ist ein Ziel, das nicht erreichbar ist, keines, das Messungen ablehnt.
- **NaN und die Unendlichkeiten werden mit Zeit und Qualität und ohne Zahl geschrieben.** Das `float` von SQL Server kann sie nicht aufnehmen. Die Messung ist da, und `value` ist NULL.
- SQL Server verschlüsselt das Login selbst, das Passwort geht also nie im Klartext über die Leitung. `useTls` verschlüsselt auch die Messungen und prüft das Zertifikat des Servers; `insecureSkipVerify` verschlüsselt ohne Prüfung.
- Eine Messung, die schon da ist, wird übersprungen, daher ergibt zweimaliges Senden eine Zeile.

Die Tabelle, falls Sie sie lieber selbst anlegen:

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

## MySQL und MariaDB

```json
{"id":"plant-mysql","name":"Plant historian","kind":"mysql","address":"mysql.plant.local","database":"plant",
 "username":"hotloop","password":"...","useTls":true}
```

Eine Art für beide: Sie sprechen dasselbe Protokoll und nehmen hier dieselben Anweisungen, und beide laufen in der Testsuite.

- Der Port ist standardmäßig 3306, die Tabelle `hotloop_history`. Ein Name mit vorangestellter Datenbank (`other.hotloop`) wird wie angegeben verwendet. Die Datenbank muss existieren; HotLoop legt die Tabelle an, nicht die Datenbank.
- Die von HotLoop angelegte Tabelle ist InnoDB mit `ts` als `DATETIME(6)` in UTC, `value` als `DOUBLE`, `string_val` als `LONGTEXT` und dem Primärschlüssel `(device_id, tag_name, ts)`. Die Namen sind `utf8mb4_bin`, weil die Tag-Namen von HotLoop zwischen Groß- und Kleinschreibung unterscheiden und die Standard-Collation der Server nicht: `Temp` und `TEMP` wären ein Schlüssel. Dieser Schlüssel ist der Grund, warum ein Tag-Name höchstens 512 Zeichen lang sein darf und ein längerer als Messung abgelehnt und gemeldet wird.
- **INSERT ist das einzige Recht, das es braucht**, sobald die Tabelle da ist, und beim ersten Mal CREATE, wenn Sie möchten, dass HotLoop sie anlegt. Es liest die Tabelle nicht und verwendet kein `ON DUPLICATE KEY UPDATE`, das auch UPDATE verlangen würde: Eine Messung, die schon da ist, ist ein Duplikat des Primärschlüssels und wird übersprungen.
- **NaN und die Unendlichkeiten werden mit Zeit und Qualität und ohne Zahl geschrieben.** `DOUBLE` kann sie nicht aufnehmen. `value` ist NULL.
- Ein Duplikat auf einem anderen eindeutigen Index, den jemand hinzugefügt hat, ist nicht dieselbe Messung: Sie wird abgelehnt und gemeldet, wie bei einer Check-Einschränkung.
- `useTls` verschlüsselt und prüft das Zertifikat des Servers; `insecureSkipVerify` verschlüsselt ohne Prüfung. Ohne `useTls` geht das Passwort trotzdem nicht im Klartext über die Leitung (das Standard-Login von MySQL 8 sendet es mit dem Schlüssel des Servers verschlüsselt), aber jemand dazwischen könnte diesen Schlüssel austauschen, setzen Sie also `useTls` für alles, was nicht im eigenen Netz des Werks liegt.

Die Tabelle, falls Sie sie lieber selbst anlegen:

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

## InfluxDB 2 und 3

```json
{"id":"plant-influx","name":"Plant historian","kind":"influxdb","address":"influx.plant.local:8086",
 "org":"plant","database":"hotloop","password":"<an API token>","useTls":true}
```

Dasselbe Ziel spricht mit InfluxDB 2 und mit InfluxDB 3, über einfaches HTTP (`/api/v2/write`, Line Protocol, Zeitstempel in Mikrosekunden). Beide antworten darauf, es gibt also keinen Treiber festzulegen und nichts auszuwählen.

- Der Port ist standardmäßig 8086, der von InfluxDB 2. InfluxDB 3 lauscht auf 8181, sofern Sie es nicht geändert haben, geben Sie also den Port an.
- `database` ist der Bucket. `org` ist die Organisation von InfluxDB 2, und InfluxDB 2 verlangt eine: Ohne sie ist jeder Schreibvorgang ein 400, der das sagt, und das Ziel ist mit dieser Meldung nicht erreichbar. InfluxDB 3 kennt keine Organisationen, lassen Sie sie also weg.
- `password` ist das API-Token. Es braucht Schreibrecht auf den Bucket (InfluxDB 2) oder auf die Datenbank (InfluxDB 3). HotLoop legt den Bucket nicht an. Ein fehlender Bucket ist ein 404, also ein nicht erreichbares Ziel, keine abgelehnten Messungen. InfluxDB 3 legt eine Datenbank an, wenn hineingeschrieben wird.
- `table` ist die Messung (Measurement), `hotloop_history`, sofern Sie nichts anderes angeben.
- Eine Messung ist ein Punkt. Gerät und Tag sind Tags, daher ist jeder HotLoop-Tag eine Serie. Die Zahl (`value`) oder der Text (`string_val`) und die Qualität (`quality`) sind Felder. Eine Messung zweimal zu senden überschreibt sie selbst.
- **NaN und die Unendlichkeiten werden mit Zeit und Qualität und ohne Feld `value` geschrieben.** Das Line Protocol kann sie nicht schreiben.
- InfluxDB legt den Typ eines Feldes für immer fest (in 2 je Shard, in 3 je Spalte). Hat schon etwas anderes eine Zahl in `string_val` oder Text in `value` geschrieben, werden die Messungen von HotLoop der anderen Art abgelehnt, gezählt und im Systemprotokoll genannt, und der Rest geht hinein.
- Ein 401 oder 403 (ein Token, das es nicht kennt oder das nicht schreiben darf) ist das nicht erreichbare Ziel, keine Ablehnung: Nichts wird weggeworfen, und die Messungen gehen hinein, sobald das Token stimmt.
- `useTls` schaltet auf `https` um und prüft das Zertifikat; `insecureSkipVerify` prüft es nicht.

## Kafka-API (Ereignisstrom)

Keine Datenbank: ein Strom. Jede Messung, die der Historian speichert, geht in ein Kafka-Topic und, wenn Sie ein zweites Topic angeben, auch jede Zeile, die HotLoop in sein eigenes Systemprotokoll schreibt (Alarme, Geräte, die ausfallen oder wiederkommen, Konfigurationsänderungen). Es spricht die Kafka-API, also nehmen es Apache Kafka, Redpanda und alles andere, das dieses Protokoll beantwortet. Dieselbe Warteschlange, dasselbe Nachholen aus der eigenen Historie von HotLoop, dasselbe „ein nicht erreichbarer Broker bremst nichts aus“ wie bei jedem anderen Ziel.

```json
{"id":"plant-stream","name":"Plant event stream","kind":"kafka","address":"kafka1.plant.local:9093,kafka2.plant.local:9093",
 "table":"hotloop.tags","username":"hotloop","password":"...","useTls":true,
 "options":{"sasl":"scram-sha-512","caCert":"-----BEGIN CERTIFICATE-----...","eventsTopic":"hotloop.events"}}
```

- `address` ist eine Liste von Brokern, durch Kommas getrennt, Port 9092, sofern nicht angegeben. Einer reicht zum Start: Der Broker sagt, wo die übrigen sind.
- `table` ist das Topic für Messungen (`hotloop.tags`, sofern Sie nichts anderes angeben). `options.eventsTopic` ist das Topic für Ereignisse, `hotloop.events`, wenn Sie das Ziel über das Formular hinzufügen oder es im API-Aufruf weglassen, und leer für keine Ereignisse. Beide dürfen nicht dasselbe Topic sein.
- HotLoop legt die Topics an, wenn sie fehlen, mit den Standard-Partitionen und der Standard-Replikation des Brokers. Ein Login, das sie nicht anlegen kann, ist ein Ziel, das mit dem Grund des Brokers nicht erreichbar ist, legen Sie sie also vorher an, wenn Ihres das nicht kann.
- `options.sasl` ist `scram-sha-512`, `scram-sha-256` oder `plain`, mit `username` und `password`. PLAIN sendet das Passwort unverändert, daher lehnt HotLoop es ohne `useTls` ab. Ein Login, das der Broker abweist, ist **nicht erreichbar**, mit „the broker refused the login“ im Status, nie „lehnt Messungen ab“.
- `useTls` prüft das Zertifikat des Brokers. Wurde es von Ihrer eigenen CA signiert, legen Sie die CA als PEM in `options.caCert` ab. `insecureSkipVerify` verschlüsselt ohne Prüfung.
- Client-Zertifikate (gegenseitiges TLS), Kerberos und OAuth-Logins werden nicht unterstützt.

**Was im Topic für Messungen landet.** Ein JSON-Objekt pro Messung, mit dem Schlüssel `deviceId/tag`, damit die Messungen eines Tags auf einer Partition in Reihenfolge bleiben:

```json
{"ts":"2026-10-31T12:00:00.123456Z","deviceId":"press-01","tag":"Zone1_Temp","value":21.5,"quality":"good","unit":"°C"}
{"ts":"2026-10-31T12:00:00Z","deviceId":"press-01","tag":"Program","value":null,"text":"Grade A","quality":"good"}
{"ts":"2026-10-31T12:00:00Z","deviceId":"press-01","tag":"Speed","value":null,"nonFinite":"NaN","quality":"bad"}
```

Eine Zahl ist `value`; Text ist `text` mit `value` null; JSON kann weder NaN noch eine Unendlichkeit tragen, daher geben diese `nonFinite` an (`NaN`, `+Inf`, `-Inf`) und `value` ist null. Dieses Format wird nur um Felder erweitert, nie geändert. Header: `hotloop-type: reading` und `content-type: application/json`. Der Zeitstempel des Datensatzes selbst ist der Zeitpunkt, an dem er erzeugt wurde; die Zeit der Messung ist `ts`.

**Was im Topic für Ereignisse landet.** Ein JSON-Objekt pro Zeile des Systemprotokolls, mit seinem Betreff als Schlüssel (oder seiner Kategorie, wenn es keinen hat), `hotloop-type: event`:

```json
{"at":"2026-10-31T12:00:00.456Z","severity":"warning","category":"alarm","subject":"press-01/Zone1_Temp",
 "actor":"system","message":"Zone 1 is over 250","detail":{"limit":250,"value":251.5}}
```

`detail` ist das JSON, das die Zeile trug, als JSON, oder Text, wenn es kein JSON war. Zeilen über die Historian-Ziele selbst bleiben draußen, sonst würde ein ausgefallener Broker seinen Ausfall an sich selbst melden.

**Es ist mindestens einmal, und Ereignisse sind nach bestem Bemühen.**
- Messungen: Die Zustellung wird von jedem synchronen Replikat bestätigt, und das Nachholen nach einem Ausfall überlappt absichtlich mit dem, was schon hinausgegangen ist, daher kann eine Messung zweimal ankommen. `deviceId`, `tag` und `ts` bezeichnen ein Duplikat; ein Verbraucher, dem das wichtig ist, verwirft die Wiederholung. Eine Messung, die den Broker nie erreicht, ist geschuldet und wird aus der eigenen Historie von HotLoop gesendet, wie bei einer Datenbank.
- Ereignisse sind der Live-Strom. Es gibt keine Historie, aus der man sie nachholen könnte, daher geht ein Ereignis verloren, das erzeugt wird, während der Broker weg ist oder ein voller Puffer überschritten wird, und der Status des Ziels zählt es (`eventsLost`) und die Karte in den Einstellungen zeigt es.
- Ein Broker, der mitten in einem Schreibvorgang verschwindet, macht das Ziel innerhalb von 25 Sekunden **nicht erreichbar**, und die Messungen dieses Schreibvorgangs sind geschuldet. (franz-go würde sonst ewig auf einen Schreibvorgang warten, von dem es nicht beweisen kann, dass er nicht angekommen ist; HotLoop lässt es aufgeben, weshalb ein Duplikat möglich ist.)
- Eine Messung, die der Broker nie annehmen wird (größer, als eine Nachricht sein darf), wird für sich abgelehnt, gezählt und im Systemprotokoll genannt, und der Rest ihres Stapels geht trotzdem hinaus.

HotLoop spricht die Kafka-API über [franz-go](https://github.com/twmb/franz-go) (BSD-3-Clause), genannt in `NOTICE`. Es hat die Binärdatei um etwa 5 MiB größer gemacht.

## So wird getestet

Jede Art von Ziel wurde gegen die echte Datenbank oder den echten Broker ausgeführt, durch einen Ausfall, der wirklich getrennt und wiederhergestellt wurde: Das Ziel enthält am Ende genau das, was HotLoop enthält, ein Neustart während des Ausfalls holt beim nächsten Start nach, und ein Ziel, das hängt, hält weder das Abfragen noch den eingebauten Historian auf.
