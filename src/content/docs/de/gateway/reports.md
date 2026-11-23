---
title: "Geplante Berichte"
description: "Historian-Zahlen nach Zeitplan als CSV oder HTML, gespeichert und verschickt: Nur gute Messwerte zählen, und jede Zeile nennt die Zahl der verworfenen."
---

Geplante Berichte, seit 4.14.0, führen vom Bediener definierte Berichte nach Zeitplan aus: Sie fragen den Historian ab, rendern das Ergebnis als CSV und HTML, speichern es auf einem Volume und senden es auf Wunsch per E-Mail. Das ist das Gegenstück zum Reporting-Modul von Ignition für den Teil dieses Moduls, den ein Werk am häufigsten braucht, eine Tabelle mit Zahlen, pünktlich geliefert. Standardmäßig an (`HOTLOOP_REPORTS_ENABLED`), in der Binärdatei und im Helm-Chart. Berichte liegen unter `HOTLOOP_REPORTS_DIR`, standardmäßig `reports` im Datenverzeichnis von HotLoop: `HOTLOOP_DATA_DIR`, wenn gesetzt, `/data`, wenn es existiert und beschreibbar ist (ein Container-Volume), und sonst `~/.local/share/hotloop` (oder `$XDG_DATA_HOME/hotloop`), sodass eine nackte Binärdatei nichts Eingehängtes braucht.

## Was es ist und was nicht

- **Nur API.** In dieser Version gibt es dafür keinen Bildschirm. Berichte werden über `/api/reports` definiert, ausgeführt, aufgelistet und heruntergeladen. Eine Oberfläche ist eine eigene Arbeit.
- **Nur CSV und HTML.** Kein PDF. Ein gutes PDF in reinem Go ohne externes Binary zu erzeugen (das Runtime-Image hat absichtlich keines) bedeutet, eine PDF-Bibliothek und eine Layout-Engine zu wählen, und das ist eine eigene Entscheidung. Die HTML-Datei ist in sich geschlossen und druckt sauber aus jedem Browser, was vorerst das "Ich brauche ein PDF" abdeckt.
- **Tabellen aus Aggregaten, keine freien Layouts.** Ein Bericht ist eine Liste von Tags, ein Fenster, eine Bucket-Größe und eine Menge von Aggregationen. Er ist kein Seitendesigner.
- **Eine Gateway-Instanz.** Der Scheduler geht davon aus, dass er der Einzige ist, der Berichte gegen diese Datenbank ausführt. Zwei Replikate würden jeweils jeden Bericht auslösen. Dieses Chart betreibt ein Replikat, und das Berichte-Volume ist `ReadWriteOnce`.
- **Kein Alarm-Feature.** Alarm-E-Mail ist ein eigenes Feature, die [Alarmbenachrichtigungen](/de/iot/notifications/). Berichte teilen mit ihr die SMTP-Relay-Einstellungen und sonst nichts.

## Eine Berichtsdefinition

Definitionen sind vom Bediener bearbeitete Daten, in der Datenbank gespeichert wie Geräte, Tags, Alarmdefinitionen und Flottenmitglieder, und werden über die API verwaltet. Beispiel:

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

| Feld | Bedeutung |
|---|---|
| `id` | 1 bis 64 Zeichen aus Buchstaben, Ziffern, Punkt, Bindestrich oder Unterstrich, beginnend mit einem Buchstaben oder einer Ziffer. Sie benennt das Verzeichnis des Berichts auf dem Volume und wird deshalb wie jede andere ID in dieser Anwendung validiert. |
| `name` | Wird im HTML-Titel und im E-Mail-Betreff angezeigt. Keine Steuerzeichen. |
| `enabled` | Ob der Scheduler ihn ausführt. Ein deaktivierter Bericht kann weiterhin von Hand ausgeführt werden. |
| `tags` | 1 bis 50 Paare aus Gerät und Tag. Jedes muss beim Speichern der Definition existieren und darf kein String-Tag sein. |
| `window` | Der Verlaufszeitraum, den jeder Lauf abdeckt. Siehe unten. |
| `bucket` | `window` (eine Zeile pro Tag), `hour` oder `day`. Standard ist `window`. |
| `aggregations` | Eine oder mehrere aus `min`, `max`, `avg`, `first`, `last` oder `count`, jede höchstens einmal. |
| `schedule` | Siehe unten. |
| `format` | `csv`, `html` oder `both`. Standard ist `csv`. |
| `recipients` | Optional. Nur einfache Adressen (`ops@example.com`, nicht `Ops <ops@example.com>`). Höchstens 20. |
| `retain` | Wie viele Läufe aufbewahrt werden. 1 bis 1000. Standard ist 30. |

`PUT` ersetzt die gesamte Definition. Ein Client kann einen Bericht lesen, ein Feld ändern und ihn unverändert zurückschicken: Die schreibgeschützten Felder, die der Server ergänzt (`nextRunAt`, `lastRun`, `lastRunAt`, `createdAt` und `updatedAt`), werden akzeptiert und ignoriert.

Eine Definition, die mehr als 1000 Buckets erzeugen würde, wird beim Speichern abgelehnt (zum Beispiel stündliche Buckets über mehr als etwa 41 Tage).

## Fenster

Ein Fenster ist relativ zum Zeitpunkt des Laufs.

| Was Sie wollen | `count` | `unit` | `end` |
|---|---|---|---|
| Die vorherigen 24 Stunden | 24 | `hours` | `run_time` |
| Der vorherige Kalendertag | 1 | `days` | `local_midnight` |
| Die vorherigen 7 ganzen Tage | 7 | `days` | `local_midnight` |
| Eine gleitende Woche | 7 | `days` | `run_time` |

- `end` ist der Moment, in dem der Lauf startet, oder, bei `local_midnight`, die jüngste lokale Mitternacht zu oder vor diesem Moment. Ein Lauf um 03:00, der um lokale Mitternacht endet, deckt ganze Kalendertage ab.
- **Stunden sind verstrichene Zeit. Tage sind Kalendertage** in der Zeitzone der Anlage. Ein Ein-Tages-Fenster, das um lokale Mitternacht endet, ist ein ganzer lokaler Tag, der am Tag der Vorstellung der Uhren 23 Stunden lang ist und am Tag der Rückstellung 25. "Die vorherigen 24 Stunden" sind immer genau 24 Stunden.
- **Ein Fenster ist halboffen**: Es schließt seinen Anfang ein und sein Ende aus. Ein Messwert mit Zeitstempel genau um Mitternacht gehört zu dem Tag, der dort beginnt. Zwei aufeinanderfolgende Tagesberichte zählen nie beide einen Messwert und verpassen ihn nie beide.
- Ein manueller Lauf und ein Nachholauf berechnen das Fenster zum Zeitpunkt, an dem sie laufen.

## Buckets

- `window`: eine Zeile pro Tag über das ganze Fenster.
- `hour`: eine Zeile pro Tag pro lokaler Uhrstunde. Ein Fenster, das nicht zur vollen Stunde beginnt, startet mit einem kürzeren Teil-Bucket, und eines, das nicht zur vollen Stunde endet, endet mit einem. Die Stunden bleiben bei einer Zeitumstellung und in Zonen, deren Versatz keine ganze Stundenzahl ist, auf der vollen Stunde.
- `day`: eine Zeile pro Tag pro lokalem Kalendertag.

Jedes Tag hat eine Zeile für jeden Bucket, auch für Buckets ohne Inhalt. Der Bericht lässt nie die Stunde aus, in der ein Sensor stumm war, denn ein Bericht, der die Zeile stillschweigend wegließe, sähe aus wie der eines Sensors, der nichts zu sagen hatte. Jede Zeile nennt genau den Zeitraum, den sie abdeckt (`period_start` und `period_end`, mit ihren UTC-Versätzen), sodass ein 23-Stunden-Tag auch als solcher erscheint.

## Aggregationen und die Qualitätsregel

Die Aggregationen sind `min`, `max`, `avg`, `first` (der früheste Messwert des Zeitraums nach Zeitstempel), `last` (der späteste) und `count`.

Berichte folgen der Qualitätsregel, derselben wie das Trenddiagramm, sodass ein Bericht und ein Trend über dieselbe Stunde übereinstimmen. Auch ein Messwert ohne numerischen Wert (ein String-Messwert) bleibt außen vor. Dafür gibt es keinen Schalter: Ein Durchschnitt, der stillschweigend Messwerte einmischt, die der Historian selbst als nicht vertrauenswürdig markiert hat, ist schlimmer als ein Bericht, der sagt, wie viele er nicht verwendet hat.

Jede Zeile trägt deshalb eine Spalte `excluded`: wie viele Messwerte dieses Zeitraums weggelassen wurden. `count` ist, wie viele verwendet wurden. Der Laufeintrag und die E-Mail tragen die Summen.

**Nichts wird erfunden.** Ein Tag ohne verwendbaren Messwert in einem Zeitraum hat kein Minimum, und der Bericht sagt das: Die Zellen sind im CSV leer und lauten im HTML `no data`. Sie sind nie null. Null ist ein Messwert (ein geschlossenes Ventil, ein Durchfluss von nichts) und wird wie jeder andere Wert aggregiert. `count` ist die einzige Spalte, die ohne Daten eine Zahl ist, denn null ist eine wahre Zählung von nichts.

## Zeitpläne und Zeit

Ein Zeitplan ist einer von diesen:

```json
{"kind": "interval", "every": "6h"}
{"kind": "daily",    "at": "03:00"}
{"kind": "weekly",   "weekday": "monday", "at": "06:30"}
```

- Ein **Intervall** ist verstrichene Zeit (mindestens eine Minute) und ignoriert die Wanduhr.
- **Tägliche und wöchentliche** Zeiten sind Wanduhrzeiten in der Zeitzone der Anlage, also `HOTLOOP_TIMEZONE` (das `global.timezone` des Charts). Sie muss ein echter Zonenname sein, etwa `America/Chicago`. Ein unbrauchbarer Name ist ein abgelehnter Start, mit oder ohne Berichte, kein stiller Rückfall auf UTC, denn ein Bericht für 03:00 Ortszeit, der um 03:00 UTC feuert, ist ein Fehler, den niemand sieht, bis die Zahlen falsch sind.

### Sommerzeit

Der nächste Lauf wird berechnet, indem mit `time.Date` eine Wanduhrzeit am Standort der Anlage gebildet wird. Er wird nie berechnet, indem 24 Stunden zum vorherigen Lauf addiert werden, was von einer Zeitumstellung zur nächsten eine Stunde zu früh oder zu spät feuert. Zwei Wanduhrzeiten sind am Umstellungstag heikel, und die Regel für jede ist im Code festgelegt, statt `time.Date` überlassen zu werden, dessen Verhalten für beide als unspezifiziert dokumentiert ist:

- **Eine Zeit, die nicht existiert** (02:30 am Tag der Vorstellung, wenn die Uhr von 02:00 auf 03:00 springt) feuert im ersten Moment nach der Lücke, um 03:00. Sie läuft höchstens um die Größe der Lücke zu spät und überspringt den Tag nicht.
- **Eine Zeit, die zweimal vorkommt** (01:30 am Tag der Rückstellung) feuert einmal, bei ihrem ersten Auftreten.

### last_run_at, der nächste Lauf und das Nachholen

`last_run_at` ist der Zeitpunkt, an dem der Scheduler den Bericht zuletzt **gestartet** hat, ob dieser Lauf danach gelang oder scheiterte. Ein manueller Lauf verschiebt ihn nicht, sodass ein Bericht, den Sie um 02:00 von Hand ausführen, den Lauf von heute Nacht um 03:00 nicht aufhebt.

Der nächste Lauf ist die erste geplante Zeit nach dem jüngsten von Erstellung der Definition, ihrer letzten Änderung und ihrem `last_run_at`. Das Messen ab der letzten Änderung bedeutet: Wird ein Bericht um 10:00 von 03:00 auf 09:00 verschoben, wartet er bis morgen, statt sofort für eine Zeit zu feuern, die schon vorbei war.

**Nachholen.** Liegt der nächste Lauf nach `last_run_at` beim Start des Gateways schon in der Vergangenheit, war das Gateway nicht da, um ihn auszuführen, und der Bericht läuft **einmal**, sofort, mit der Kennzeichnung `catchup`. Er läuft nicht einmal pro verpasster Zeit: Ein Tagesbericht, der drei Tage verpasst hat, läuft einmal, an dem Tag, an dem das Gateway zurückkommt, mit dem Fenster, das das ab jetzt bedeutet. Die verpassten Tage werden nicht nachgefüllt. Danach ist der Bericht wieder auf seinem Zeitplan.

`last_run_at` wird **vor** dem Start des Laufs geschrieben, sodass ein Gateway, das mitten im Lauf stirbt, den Lauf beim Neustart nicht zusätzlich zu einer E-Mail wiederholt, die schon hinausgegangen sein könnte. Der unterbrochene Lauf wird stattdessen als fehlgeschlagen festgehalten. Ein fehlgeschlagener geplanter Lauf wird nicht wiederholt; die nächste geplante Zeit läuft normal, und `POST /api/reports/{id}/run` ist da, wenn jemand ihn noch einmal will.

## Ausgabe

Jeder Lauf schreibt seine Dateien unter `HOTLOOP_REPORTS_DIR` (`/data/reports`, ein PVC im Chart):

```
/data/reports/<report id>/<UTC timestamp>-<run id>.csv
/data/reports/<report id>/<UTC timestamp>-<run id>.html
```

- **Dateinamen werden nur aus einer validierten ID, einem UTC-Zeitstempel und der ganzzahligen ID des Laufs gebildet.** Path Traversal ist konstruktionsbedingt ausgeschlossen: Die Berichts-ID muss dieselbe Bezeichnerregel erfüllen wie überall sonst, und ein aus einem Laufeintrag zurückgelesener Dateiname wird vor dem Öffnen mit dem genauen Muster oben abgeglichen. Das `{run}` in einer Download-URL wird als Ganzzahl geparst und nur dazu benutzt, den Laufeintrag zusammen mit der Berichts-ID nachzuschlagen. Die geöffnete Datei ist die, die dieser Eintrag nennt. Nichts aus der URL wird Teil eines Pfades.
- Dateien werden mit `O_EXCL` und Modus `0640` angelegt, Verzeichnisse mit `0750`. Eine bereits vorhandene Datei ist ein Fehler und wird nie überschrieben. Die Ausgabe enthält Anlagendaten und Tag-Namen, der Modus ist also eine Untergrenze und kein Ersatz für den Schutz des Volumes.
- **Aufbewahrung.** Nach jedem Lauf werden die neuesten `retain` Läufe behalten, die Dateien gespeichert haben, und ältere werden mit ihren Dateien gelöscht. Fehlgeschlagene Läufe, die keine Dateien haben, werden getrennt behalten (die neuesten `retain` davon), sodass eine Serie von Fehlschlägen den letzten guten Bericht nicht verdrängen kann. Auch jede Datei im Verzeichnis des Berichts, die dem Namensmuster entspricht, aber von keinem verbleibenden Laufeintrag referenziert wird (die Teildatei eines gestorbenen Laufs), wird entfernt. Eine Datei, die nicht dem Muster entspricht, etwa eine, die ein Bediener dort abgelegt hat, bleibt unberührt.

### CSV

RFC 4180, aus `encoding/csv`, mit CRLF-Zeilenenden. Die Spalten sind `device_id`, `tag_name`, `unit`, `period_start`, `period_end`, eine Spalte pro Aggregation in der Reihenfolge, in der die Definition sie auflistet, und `excluded`. Zeitstempel sind RFC 3339 in der Zeitzone der Anlage mit ihrem Versatz. Zahlen werden mit voller Genauigkeit geschrieben.

**Formelinjektion in Tabellenkalkulationen.** Ein Tag-Name oder eine Einheit ist Text, den jemand getippt hat, und eine Tabellenkalkulation liest eine Zelle, die mit `=`, `+`, `-` oder `@` beginnt, als Formel. Jeder Textzelle, die mit einem davon beginnt (oder mit einem Tabulator oder Wagenrücklauf, oder einem Leerzeichen gefolgt von einem davon), wird ein Apostroph vorangestellt, den Tabellenkalkulationen als "das ist Text" behandeln und nicht anzeigen. Die numerischen Spalten werden aus Zahlen geschrieben, sodass ein negativer Messwert unangetastet bleibt und weiterhin als Zahl gelesen wird.

Die Datei hat keine Byte-Order-Mark. Excel öffnet eine UTF-8-CSV ohne sie, als wäre sie in einer alten Codepage, daher muss ein Tag-Name mit Nicht-ASCII-Zeichen unter Umständen als UTF-8 importiert werden.

### HTML

Eine in sich geschlossene Datei, erzeugt mit `html/template`, sodass Tag-Namen und Werte je nach Einsatzort escaped werden: Ein Tag namens `<script>` wird als Text geschrieben. Das Stylesheet ist inline, und es gibt kein Skript, keine Schrift, kein Bild und keinen Link irgendwohin, weil Installationen vom Netz getrennt sein können. Sie trägt außerdem ein `Content-Security-Policy`-Meta-Tag, das das Laden von allem verbietet, und die API liefert sie mit einer Richtlinie aus, die `sandbox` ergänzt, als Anhang.

## Zustellung per E-Mail

Hat ein Bericht `recipients`, verschickt jeder Lauf die Dateien als Anhänge per E-Mail, über das SMTP-Relay, das unter `HOTLOOP_NOTIFY_SMTP_*` konfiguriert ist (Host, Port, Benutzername, Passwort, Absender, TLS). Nur das Relay wird mit dem Alarmkanal geteilt: Ob dieser Kanal aktiviert ist und an wen Alarme gehen, hat keinen Einfluss auf Berichte, sodass eine Installation Berichte per E-Mail verschicken kann, ohne jemanden zu alarmieren. Das Chart schreibt die Relay-Variablen allein für Berichte, wenn der Alarmkanal aus ist.

Es ist derselbe SMTP-Code wie beim Alarmkanal, keine zweite Kopie. Der Alarmkanal sendet jetzt ebenfalls darüber. Die Verbindungsbehandlung ist unverändert (Port 465 spricht jetzt ab dem ersten Byte TLS, siehe [Alarmbenachrichtigungen](/de/iot/notifications/#implizites-tls-port-465)): STARTTLS, wann immer das Relay es anbietet, `AUTH`, wenn Zugangsdaten gesetzt sind, und ein harter Fehler vor `AUTH`, wenn `HOTLOOP_NOTIFY_SMTP_TLS` gesetzt ist und das Relay kein STARTTLS anbietet. Bei einem ASCII-Alarm hat die Nachricht dieselben Bytes wie zuvor, bis auf den Header `Date`, und ein Test hält das fest. Ein Nicht-ASCII-Alarmbetreff wird jetzt als RFC-2047-kodiertes Wort statt als rohes UTF-8 gesendet.

Die Nachricht ist `multipart/mixed`: ein Quoted-Printable-Textteil, dann jede Datei Base64-kodiert. **Header-Injection wird abgelehnt, nicht bereinigt.** Empfänger, Absender, Betreff und die Dateinamen der Anhänge werden validiert: Ein Wert mit CR, LF oder einem anderen Steuerzeichen, ein Empfänger in der Form eines Anzeigenamens oder mit einer Liste oder ein Dateiname mit einem Anführungszeichen oder einem Pfad lässt die Nachricht scheitern, bevor etwas an das Relay gesendet wird. Der eigene Betreff des Alarmkanals ist die einzige Ausnahme, weil eine Meldung hinausgehen muss, wie auch immer ein Alarm heißt: Er wandelt Steuerzeichen zuvor in Leerzeichen um.

- **Kein Relay konfiguriert.** Ein Bericht mit Empfängern läuft trotzdem und speichert seine Dateien, und der Lauf wird als `failed` festgehalten, mit `emailStatus` `failed` und einem Fehler, der sagt, dass das Relay nicht konfiguriert ist. Er gelingt nicht stillschweigend.
- **Zu groß.** `HOTLOOP_REPORTS_MAX_EMAIL_BYTES` (10 MiB) begrenzt die Anhangsdaten in einer E-Mail. Ein Bericht darüber wird gespeichert und ist herunterladbar, und sein Lauf hält fest, warum er nicht per E-Mail verschickt wurde.
- Ein von Hand gestarteter Lauf kann die E-Mail mit `?deliver=false` überspringen.

## Laufeinträge und der Audit-Pfad

Jeder Lauf wird ab dem Moment seines Starts in `report_runs` festgehalten: wann er begann und endete, der Auslöser (`schedule`, `catchup` oder `manual`), wer ihn angefordert hat, das Fenster, das Ergebnis und der Fehlertext, die Anzahl der Tags, Zeilen, aggregierten Messwerte und ausgeschlossenen Messwerte, die gespeicherten Dateien, das E-Mail-Ergebnis und seine Empfänger sowie Hinweise (zum Beispiel, dass ein Tag inzwischen gelöscht wurde und aus seinem aufgezeichneten Verlauf berichtet wird). Erfolg und Misserfolg werden außerdem über `rt.Event` geschrieben, denselben Audit-Pfad, den Alarme und Flottenaktionen nutzen, mit der Berichts-ID als Betreff.

Ein Lauf, der durch das Herunterfahren, durch sein Zeitlimit (`HOTLOOP_REPORTS_RUN_TIMEOUT`) oder durch das Löschen des Berichts abgebrochen wird, wird mit diesem Grund als fehlgeschlagen festgehalten. Ein Lauf, den ein gestorbener Prozess auf `running` hinterlassen hat, wird beim nächsten Start des Gateways als fehlgeschlagen markiert. Es läuft immer nur ein Lauf eines Berichts; eine zweite Anfrage, während einer läuft, ergibt ein `409`.

## API

| Route | Berechtigung | <span class="sr-only">Details</span> |
|---|---|---|
| `GET /api/reports` | `reports.read` | Jede Definition, jeweils mit ihrem `nextRunAt` und dem jüngsten Lauf |
| `POST /api/reports` | `reports.write` | Erstellen. `409`, wenn die ID existiert |
| `GET /api/reports/{id}` | `reports.read` | Eine Definition |
| `PUT /api/reports/{id}` | `reports.write` | Ersetzen. Die ID kann sich nicht ändern |
| `DELETE /api/reports/{id}` | `reports.write` | Löschen, mit seinen Läufen und Dateien. Ein laufender Lauf wird zuerst abgebrochen |
| `POST /api/reports/{id}/run` | `reports.run` | Jetzt ausführen und warten. `?deliver=false` überspringt die E-Mail |
| `GET /api/reports/{id}/runs` | `reports.read` | Laufeinträge, neueste zuerst (`?limit=`, bis zu 500) |
| `GET /api/reports/{id}/runs/{run}/download?format=csv\|html` | `reports.read` | Eine gespeicherte Datei als Anhang streamen |

`POST .../run` gibt den Laufeintrag mit `200` zurück, ob der Lauf funktioniert hat oder nicht. Der Status sagt, ob die Anfrage ausgeführt wurde, und der eigene `status` des Eintrags sagt, ob der Bericht es wurde. Ein Lauf, der scheitert, ist ein Ergebnis und wird in jedem Fall festgehalten. Der Lauf ist nicht an die Verbindung des Clients gebunden: Auflegen bricht keinen Bericht ab, der vielleicht schon eine E-Mail begonnen hat.

Ist das Feature aus, antwortet die Liste mit `{"reports": [], "configured": false}`, und jede andere Route antwortet mit einem Fehler, der `HOTLOOP_REPORTS_ENABLED` nennt.

### Wer was darf

| Rolle | `reports.read` | `reports.run` | `reports.write` |
|---|---|---|---|
| Betrachter | ja | nein | nein |
| Bediener | ja | ja | nein |
| Administrator | ja | ja | ja |

- **Lesen** ist für Betrachter, weil ein gespeicherter Bericht aus Aggregaten eines Verlaufs besteht, den ein Betrachter bereits über `values.read` lesen kann, sodass Lesen oder Herunterladen nichts Neues gewährt.
- **Ausführen** ist für Bediener, weil das Ausführen eines Berichts immer nur an die Empfänger liefert, die ein Administrator bereits gewählt hat, und er sich ohne Zustellung ausführen lässt.
- **Schreiben ist nur für Administratoren.** Eine Definition nennt die Adressen, an die ihre Ausgabe gemailt wird, und eine definieren zu können heißt, nach Zeitplan Anlagendaten an eine beliebige Adresse senden zu können. Das steht in seiner Art `notify.test` und `fleet.config` (ebenfalls nur für Administratoren, ebenfalls "der Außenwelt etwas antun") näher als einem Lesezugriff. Das ist eine Ermessensentscheidung und könnte überprüft werden, wenn ein echter Arbeitsablauf verlangt, dass Bediener Berichte erstellen.
- Ein Bediener kann durch das Ausführen immer noch eine E-Mail an die Empfänger eines Berichts auslösen, und zwar wiederholt. Es gibt eine Ein-Lauf-gleichzeitig-Sperre und `?deliver=false`, aber kein Ratenlimit.
- Ein Benutzer mit einer expliziten Berechtigungsliste hält genau das, was sie nennt; der Platzhalter `reports.*` deckt alle drei ab.

## Konfiguration

| Variable | Standard | <span class="sr-only">Details</span> |
|---|---|---|
| `HOTLOOP_REPORTS_ENABLED` | `false` | Das Feature ist aus, einschließlich des Schedulers, bis dies gesetzt ist |
| `HOTLOOP_REPORTS_DIR` | `/data/reports` | Wohin die Dateien jedes Laufs geschrieben werden. Gedacht als PVC (`reports.persistence` im Chart) |
| `HOTLOOP_REPORTS_RUN_TIMEOUT` | `5m` | Begrenzt einen Lauf: Abfrage, Rendern, Schreiben und E-Mail |
| `HOTLOOP_REPORTS_MAX_EMAIL_BYTES` | `10485760` | Die größte Menge an Anhangsdaten in einer E-Mail |
| `HOTLOOP_TIMEZONE` | `UTC` | Die Zeitzone der Anlage. Muss ein echter Zonenname sein, sonst startet HotLoop nicht |
| `HOTLOOP_NOTIFY_SMTP_HOST`, `_PORT`, `_USERNAME`, `_PASSWORD`, `_FROM`, `_TLS`, `_TLS_SKIP_VERIFY` | | Das Relay, über das Berichte E-Mails verschicken. Siehe [Alarmbenachrichtigungen](/de/iot/notifications/) |

Der `reports`-Block des Charts hat `enabled`, `runTimeout`, `maxEmailBytes` und `persistence` (Größe, Speicherklasse, Zugriffsmodus). `notify.smtp` liefert das Relay. Berichte werden im Modus `--mcp-stdio` nicht gestartet, in dem ein Agent das Binary als Helfer startet, und ein zweiter Scheduler neben dem echten Gateway würde jeden fälligen Bericht doppelt ausführen.

## Backups

Berichtsdefinitionen und Laufeinträge sind Benutzerdaten und Teil des Datenbank-Backups. Die Ausgabedateien nicht: Sie liegen auf dem Berichte-Volume, und das Wiederherstellen eines Backups in einem neuen Deployment bringt die Einträge zurück, aber nicht die Dateien, sodass das Herunterladen eines alten Laufs dort antwortet, dass die Datei nicht mehr auf dem Datenträger ist. Kopieren Sie das Berichte-Volume, wenn die Dateien zählen.

Diese beiden Tabellen zur Backup-Liste hinzuzufügen ist die Art von Änderung, die man leicht vergisst, deshalb hat das Backup-Paket jetzt Schutzvorrichtungen dafür. Ein Test listet jede Tabelle des Schemas auf und schlägt fehl, wenn eine weder in `backup.Tables` noch in einer expliziten Ausschlussliste mit Begründung steht. Ein weiterer prüft, dass `Tables` in Fremdschlüsselreihenfolge steht, und liest die Fremdschlüssel aus der Datenbank. Der Round-Trip-Test legt eine Berichtsdefinition und einen Lauf an und prüft die wiederhergestellten Werte und die Sequenz.

## Was geprüft wurde und was nicht

HotLoop wurde gegen echte Anlagen und echte Server ausgeführt, und am 2026-11-17 auf echter Hardware.
