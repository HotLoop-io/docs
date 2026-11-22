---
title: "Eine Cascade-Instanz steuern"
description: "Variablen, Ordner, kommentierte Läufe, Schwärzung, Insights, externe Secrets und Log-Weiterleitung für ein Werk mit immer mehr Workflows."
---

Wie ein Werk einen wachsenden Berg an Workflows im Griff behält: gemeinsame Einstellungen, Ordner, kommentierte Läufe, Schwärzung, Zahlen im Zeitverlauf, externe Secrets, Log-Weiterleitung und wo große Daten liegen. All das ist kostenlos und in jedem Build enthalten.

Jeder unten genannte Endpoint steht im OpenAPI-Dokument unter `/api/v1/openapi.json`, und zu jedem gibt es einen Test, der ihn aufruft, auf SQLite und auf Postgres.

## Variablen

Im Editor: Variablen, in der oberen Leiste. Instanzweite stehen oben, die eines Projekts unter seinem Namen. Angeboten wird nur, was Ihre Rolle erlaubt.

Eine Variable ist ein benannter Wert, den ein Workflow als `vars.NAME` liest: eine Obergrenze für einen Sollwert, der Name eines Werks, eine Basis-URL, die sich zwischen der Pilotlinie und der echten unterscheidet.

```yaml
- name: Check limit
  type: core.if
  version: 1
  params:
    condition: "{{ item.json.temp > toNumber(vars.TEMP_LIMIT) }}"
```

- Eine Variable ist **instanzweit** oder gehört zu **einem Projekt**. Haben beide einen Namen, gewinnt die des Projekts, und zwar nur für die Workflows dieses Projekts.
- Ein Wert ist Text, bis zu 8 KiB. Verwenden Sie `toNumber(vars.X)`, wenn Sie eine Zahl brauchen.
- Ein Name besteht aus Buchstaben, Ziffern und Unterstrichen, beginnt mit einem Buchstaben oder Unterstrich und ist bis zu 64 Zeichen lang, weil er sich als `vars.NAME` lesen lassen muss.
- **Variablen sind keine Secrets.** Wer das Projekt lesen kann, liest seine Variablen, und der Wert wird nicht aus den Laufdaten entfernt. Ein Passwort, ein Token oder ein Schlüssel gehört in den Zugangsdaten-Tresor oder in einen externen Secret-Speicher (siehe unten).
- Ein Lauf liest seine Variablen beim Start und noch einmal, wenn er nach einer Wartezeit oder einem Neustart fortgesetzt wird. Eine Änderung erreicht den nächsten Lauf, nicht einen, der schon mitten in einem Schritt ist. Ein Name, den es nicht gibt, liest sich als nichts, nicht als Fehler.

| Aufruf | Was er bewirkt |
|---|---|
| `GET /api/v1/variables` | Instanzvariablen und die in Projekten, die Sie lesen können; `?project=` begrenzt auf ein Projekt. |
| `POST /api/v1/variables` | Legt eine an. Mit `projectId` gehört sie dem Projekt, ohne ist sie instanzweit. |
| `PUT /api/v1/variables/{variable}` | Ändert ihren Namen und Wert. |
| `DELETE /api/v1/variables/{variable}` | Löscht sie. |

Wer darf: In einem Projekt listet die Berechtigung `variable.read` sie auf, und `variable.create`, `variable.update` und `variable.delete` ändern sie. Viewer und Operatoren lesen, Editoren und Admins ändern. Instanzweite Variablen kann jede angemeldete Person lesen, weil der Workflow jedes Projekts sie lesen kann, und nur ein Instanz-Eigentümer oder -Administrator ändert sie. Eine eigene Rolle kann jede dieser vier Berechtigungen tragen. Änderungen stehen im Audit-Protokoll als `variable.created`, `variable.updated` und `variable.deleted`, mit dem Namen und nie dem Wert.

## Ordner

Im Editor: Die Workflow-Liste sind die Ordner. Legen Sie mit Neuer Ordner einen an, verschachteln Sie ihn mit Unterordner hinzufügen und verschieben Sie einen Workflow in seiner eigenen Zeile der Liste. Wählen Sie beim Anlegen eines Workflows einen Ordner, landet er dort.

Ordner gruppieren die Workflows eines Projekts und verschachteln sich, so wie ein Werk aufgebaut ist: Bereich, Linie, Zelle.

- Ein Ordner liegt in einem Projekt. Namen sind unter nebeneinanderliegenden Ordnern eindeutig, und ein Name ist bis zu 100 Zeichen lang.
- Ordner lassen sich bis zu 10 Ebenen tief verschachteln.
- Ein Workflow liegt in einem Ordner oder oben in seinem Projekt. Das Speichern einer neuen Version verschiebt ihn nicht.
- Ein Ordner, in dem Workflows oder Ordner liegen, kann nicht gelöscht werden (409), das Löschen eines Ordners ist also nie der Grund, warum ein Workflow verschwindet. Ein Ordner kann nicht in sich selbst oder in einen seiner eigenen Unterordner verschoben werden, und nicht in ein anderes Projekt.

| Aufruf | Was er bewirkt |
|---|---|
| `GET /api/v1/folders` | Ordner in Projekten, die Sie lesen können, flach, jeder mit seinem `parentId`; `?project=` begrenzt. |
| `POST /api/v1/folders` | Legt einen in `projectId` an, innerhalb von `parentId` oder oben. |
| `PATCH /api/v1/folders/{folder}` | Benennt ihn um oder verschiebt ihn mit `parentId` (leerer String für oben). |
| `DELETE /api/v1/folders/{folder}` | Löscht einen leeren Ordner. |
| `PUT /api/v1/workflows/{workflow}/folder` | Legt einen Workflow in einen Ordner oder mit leerem `folderId` nach oben. |
| `GET /api/v1/workflows?folder=` | Die Workflows eines Ordners oder `folder=none` für das Oberste jedes Projekts. |

Jeder Workflow, den die API zurückgibt, nennt seinen `folderId`. Die Berechtigungen `folder.read`, `folder.create`, `folder.update` und `folder.delete` funktionieren wie die der Variablen, und das Verschieben eines Workflows braucht `workflow.update`. Ordneränderungen stehen im Audit-Protokoll, Verschiebungen als `workflow.moved`.

## Lauf-Anmerkungen

Im Editor: Die Seite jedes Laufs hat ein Feld Anmerkung mit einem Daumen hoch oder runter, einer Notiz und Tags, und die Laufliste filtert nach Tag und nach Stimme.

Eine Person kann zu einem Lauf etwas sagen, nachdem er stattgefunden hat: einen Daumen hoch oder runter, eine Notiz und Tags, um ihn wiederzufinden. „Erste gute Charge nach dem Werkzeugwechsel“ und `scrap` sind die Art von Dingen, die hierher gehören.

```sh
curl -X PUT $CASCADE/api/v1/executions/$RUN/annotation -H "Authorization: Bearer $KEY" \
  -d '{"vote":"up","note":"first good batch after the die change","tags":["die-change","first-shift"]}'
```

- Eine Stimme ist `up`, `down` oder leer. Eine Notiz ist bis zu 2000 Zeichen lang. Ein Lauf hat bis zu 20 Tags, jeder 1 bis 40 Zeichen ohne Steuerzeichen, einmal aufgeführt.
- `PUT` ersetzt die gesamte Anmerkung, senden Sie also alles, was bleiben soll. Eine Anmerkung, die nichts sagt, ist dasselbe wie keine. `DELETE /api/v1/executions/{execution}/annotation` löscht sie.
- Jeder Lauf, den die API zurückgibt, trägt seine Anmerkung, und die Liste trägt sie in jeder Zeile. `GET /api/v1/executions?tag=scrap` und `?vote=down` filtern und lassen sich mit den anderen Filtern kombinieren.
- Die Anmerkung hält fest, wer sie hinterlassen hat und wann, aus derselben Identität, die das Audit-Protokoll verwendet.
- Das Anmerken braucht die Berechtigung `execution.annotate`, die Operatoren, Editoren und Admins haben und Viewer nicht. Viewer lesen Anmerkungen.
- Eine Anmerkung verschwindet, wenn ihr Lauf gelöscht wird. Das Audit-Protokoll behält `execution.annotated` und `execution.annotation_cleared` mit Stimme und Tags und hält nur fest, dass eine Notiz hinterlassen wurde, nicht was sie sagte.

## Abgeschlossene Läufe aufbewahren

Im Editor: Einstellungen, Abgeschlossene Läufe aufbewahren für (Tage). Über die API: `PATCH /api/v1/settings` mit `{"retentionDays": 90}`, was wie die übrigen Einstellungen die Berechtigung `instance.settings` braucht.

Standardmäßig wird jeder abgeschlossene Lauf für immer aufbewahrt, wie es immer war. Setzen Sie eine Anzahl von Tagen, und ein Main löscht einmal pro Stunde die abgeschlossenen Läufe (erfolgreich, fehlgeschlagen oder abgebrochen), die länger her beendet wurden, samt ihren Schrittdaten. 0 schaltet es wieder aus.

- Ein Lauf, der in der Warteschlange steht, läuft oder wartet, wird nie angefasst, und auch kein Lauf, dessen Elternlauf noch läuft, denn der Elternlauf wird fragen, was er getan hat.
- Jeder Stapel von bis zu 500 Läufen ist eine eigene Transaktion und schreibt eine Zeile `execution.pruned` ins Audit-Protokoll, mit der Zahl der gelöschten und dem Stichtag. Das Ändern der Einstellung schreibt `instance.retention`.
- Jeder Main führt den Durchlauf aus, und zwei gleichzeitig finden nur weniger zu tun.
- Die Blob-Bereinigung folgt demselben Durchlauf und läuft einmal pro Stunde, ob die Aufbewahrung an ist oder nicht, sodass auch ein von Hand gelöschter Lauf bereinigt wird. Siehe „Blob-Bereinigung“ unten.

## Einen API-Schlüssel begrenzen

Im Editor: Einstellungen, API-Anfragen pro Schlüssel und Minute. Über die API: `PATCH /api/v1/settings` mit `{"apiRateLimit": 120}`, mit der Berechtigung `instance.settings`.

Standardmäßig darf ein Schlüssel so oft aufrufen, wie er will. Setzen Sie eine Zahl, und jeder API-Schlüssel sowie jeder über MCP mit einem Schlüssel angemeldete Agent darf so viele Anfragen pro Minute stellen. Ein Aufruf über der Grenze wird mit `429` beantwortet, mit einem `Retry-After`-Header, der sagt, wie viele Sekunden zu warten sind. Jeder Schlüssel hat seinen eigenen Zähler, sodass ein durchgedrehtes Skript den eines anderen nicht aufbrauchen kann. Personen, die im Editor angemeldet sind, unterliegen ihr nicht.

Der Zähler gehört zu jedem Prozess einzeln, weil das den Prozess schützt: Bei drei Mains kann ein Schlüssel bis zum Dreifachen der Zahl nutzen, verteilt auf sie. Eine Änderung der Einstellung erreicht jeden Main innerhalb von fünf Sekunden. Sie zu ändern schreibt `instance.api_rate_limit` ins Audit-Protokoll, mit der alten und der neuen Zahl.

Ein Webhook hat sein eigenes Limit, am Trigger gesetzt, und ein Konto sperrt sich nach wiederholt falschen Passwörtern; keines von beiden ändert sich.

## Sicherung und Wiederherstellung

```
hotloop-cascade backup /backups/2026-11-20
hotloop-cascade restore /backups/2026-11-20
```

`backup` schreibt ein neues Verzeichnis mit einer konsistenten Kopie der SQLite-Datenbank (erstellt, während der Server läuft, mit `VACUUM INTO`), der Schlüsseldatei, die jede gespeicherte Zugangsdaten versiegelt, den Blob-Dateien und `manifest.json` mit dem SHA-256 jeder Datei. Es nimmt dieselben Einstellungen `--database`, `--key-file` und `--blob-dir` wie der Server, aus denselben Umgebungsvariablen. Das Verzeichnis darf noch nicht existieren oder muss leer sein; eine Sicherung wird nie mit einer alten vermischt. Ohne Schlüsseldatei gibt es keine Sicherung, denn eine Datenbank ohne ihren Schlüssel enthält Zugangsdaten, die niemand lesen kann.

`restore` spielt sie zurück, und der Server muss vorher gestoppt sein. Es prüft jede Datei gegen das Manifest, bevor es etwas schreibt, sodass eine beschädigte oder unvollständige Sicherung nichts ändert. Es weigert sich, eine Datenbank oder eine abweichende Schlüsseldatei zu überschreiben, die schon vorhanden ist; `--replace` sagt, dass Sie es wirklich wollen. Starten Sie danach den Server: Er bringt das Schema auf den neuesten Stand und lehnt eine Sicherung ab, die von einem neueren Release stammt als er selbst.

PostgreSQL: `backup` schreibt den Schlüssel, die Blobs und das Manifest und gibt den Befehl `pg_dump --format=custom` aus, der die Hälfte der Datenbank erzeugt, weil dieses Programm von PostgreSQL selbst ist und das Cascade-Image es nicht enthält. `restore` spielt den Schlüssel und die Blobs zurück und gibt den Befehl `pg_restore` aus. Blobs in S3 oder Azure werden nicht kopiert; sichern Sie den Bucket dort.

Bevor Sie ein Release aktualisieren, das migriert, machen Sie eine: Migrationen gehen nur vorwärts, und die Rückkehr zum alten Image braucht die Sicherung.

## Schwärzungsrichtlinien für Läufe

Im Editor: Einstellungen, Schwärzung legt die Richtlinien an. Ein Workflow wählt eine im Seitenbereich des Editors, wenn nichts ausgewählt ist, unter Workflow-Einstellungen.

Der Zugangsdaten-Tresor hält Secrets bereits aus allem heraus, was ein Lauf speichert. Eine Schwärzungsrichtlinie ist für Daten, die keine Zugangsdaten sind, aber ebenfalls nicht in den Laufverlauf gehören: eine Ausweisnummer, der Name eines Bedieners, eine Kartennummer, die über einen Webhook hereinkam.

Eine Richtlinie besteht aus einem Namen und Regeln:

- **fields**: Schlüsselnamen von Items. Bei einem Schlüssel, den eine Richtlinie nennt, wird der gesamte Wert durch `[redacted]` ersetzt, in jeder Tiefe, gleich welchen Typs der Wert ist. Der Abgleich ignoriert Groß- und Kleinschreibung, und `*` und `?` funktionieren als Platzhalter, sodass `*secret*` `plant_secret` und `SecretKey` erfasst.
- **patterns**: reguläre Ausdrücke in der RE2-Syntax von Go. Jeder Treffer in beliebigem Text wird durch `[redacted]` ersetzt. Ein Muster, das auf den leeren Text passt, wird abgelehnt.
- **steps**: optional. Die Richtlinie deckt nur die aufgeführten Schritte ab. Leer bedeutet jeden Schritt.
- **appliesToAll**: optional. Die Richtlinie deckt jeden Workflow ab, ob er sie nennt oder nicht.

Ein Workflow wählt eine in seinen Einstellungen mit ihrem Namen:

```yaml
settings:
  redaction: Badges
```

Was sie bewirkt und wann:

- Sie läuft **wenn der Lauf endet**, in derselben Transaktion, die ihn als abgeschlossen markiert: erfolgreich, fehlgeschlagen oder gestoppt. Bis dahin hat der Lauf seine echten Daten, weil der nächste Schritt sie braucht und ein Neustart von ihnen aus fortsetzt. Ein wartender Lauf hält weiterhin seine echten Daten.
- Sie bereinigt die gespeicherte Ausgabe jedes Schritts, die gespeicherte Fehlermeldung jedes Schritts, den eigenen Fehler des Laufs und eine gespeicherte Webhook-Antwort. Sie berührt keine Dateiinhalte: Eine Richtlinie liest Item-Daten, und eine Datei ist ein Verweis auf Bytes.
- Was gespeichert wurde, ist der Ausgangspunkt für eine Wiederholung oder einen Neuversuch aus der Mitte dieses Laufs, eine Wiederholung sieht also die bereinigten Werte. Die Trigger-Items des Workflows stehen in der Ausgabe des ersten Schritts, und auch sie werden bereinigt.
- Sie liest den Workflow so, wie dieser Lauf ihn hatte, sodass das Bearbeiten eines Workflows oder der Richtlinie nie einen Lauf ändert, der schon vorbei ist.
- Ein Workflow, der eine Richtlinie nennt, die es nicht gibt, **schlägt geschlossen fehl**: Seine Läufe behalten gar keine Item-Daten, so wie die Speichereinstellung `metadata` funktioniert, und die `problems` des Workflows sagen es. Eine fehlende Richtlinie darf nie bedeuten, dass Daten behalten werden, die jemand bereinigen wollte.
- Eine Richtlinie, die Workflows nennen, kann nicht gelöscht werden (409), und ihr Name kann sich nicht ändern. Die Regeln schon.

| Aufruf | Was er bewirkt |
|---|---|
| `GET /api/v1/redaction-policies` | Jede Richtlinie. Jede angemeldete Person kann sie lesen, weil die Leute, die Workflows schreiben, die Namen brauchen. |
| `POST /api/v1/redaction-policies` | Legt eine an. |
| `PUT /api/v1/redaction-policies/{policy}` | Ersetzt ihre Beschreibung und Regeln. |
| `DELETE /api/v1/redaction-policies/{policy}` | Löscht eine, die kein Workflow nennt. |

Eine Richtlinie anzulegen, zu ändern und zu löschen braucht die Instanzberechtigung `redaction.manage`, die Eigentümer und Administratoren haben. Jedes steht im Audit-Protokoll als `redaction.created`, `redaction.updated` und `redaction.deleted`.

## Insights

Im Editor: Insights, in der oberen Leiste. Wählen Sie ein Zeitfenster, ein Projekt und einen Workflow; es zeigt die Summen, ein Diagramm und eine Tabelle pro Tag sowie eine Tabelle pro Workflow.

`GET /api/v1/insights` summiert die Läufe in einem Zeitfenster: wie sie endeten, wie lange sie dauerten, pro Tag und pro Workflow.

```sh
curl "$CASCADE/api/v1/insights?from=2026-10-10&to=2026-10-14&project=$PROJECT" -H "Authorization: Bearer $KEY"
```

- `from` und `to` sind eine RFC-3339-Zeit oder ein Datum (Mitternacht UTC). Ohne beides sind es die letzten sieben Tage bis jetzt. Mehr als 366 Tage beantwortet es nicht.
- `project` und `workflow` grenzen es ein. Ohne sie zählt es jedes Projekt, in dem der Aufrufer Läufe lesen darf, sodass die Zahlen jeder Person ihre eigenen sind.
- Ein Lauf zählt an dem UTC-Tag, an dem er angelegt wurde.
- `totals` und jede Zeile in `days` und `workflows` tragen `total`, `succeeded`, `failed`, `canceled` und `unfinished` (in der Warteschlange, laufend oder wartend), die durchschnittliche und die längste Laufzeit in Millisekunden über Läufe, die Start und Ende haben, und `failureRate`.
- `failureRate` ist fehlgeschlagen geteilt durch erfolgreich plus fehlgeschlagen. Ein abgebrochener Lauf ist kein Fehlschlag, und ein unfertiger hat sich noch nicht entschieden, also zählt keiner mit. Sie ist 0, wenn nichts so oder so beendet ist.
- `days` listet jeden UTC-Tag im Zeitfenster auf, mit Nullen für einen Tag, an dem nichts lief, sodass ein Diagramm keine Lücken zum Erraten hat. `workflows` sind die 50 aktivsten, der aktivste zuerst.

Es liest dieselben Laufzeilen wie die Laufliste, braucht also die Berechtigung `execution.read` und einen Schlüssel mit diesem Geltungsbereich.

## Externe Secrets

Im Editor: Einstellungen, Externe Secrets. Fügen Sie einen Anbieter hinzu, probieren Sie ihn auf der gleichen Karte an einem Pfad aus und sehen Sie, wie die Referenz dafür aussieht.

Das Secret-Feld einer Zugangsdaten kann auf ein Secret in HashiCorp Vault oder OpenBao zeigen, statt das Secret selbst zu halten. Rotieren Sie das Passwort im Speicher, und jeder Workflow nutzt beim nächsten Lauf das neue, ohne dass jemand Zugangsdaten bearbeitet, und eine Kopie Ihrer Datenbank enthält das Passwort nie.

Eine Referenz sieht so aus, in jedem Secret-Feld einer Zugangsdaten:

```
secret://bao/plant/line-3/db#password
```

Das ist der Anbieter namens `bao`, das Secret unter `plant/line-3/db` und sein Schlüssel `password`. Die Zugangsdaten speichern diesen Text, versiegelt wie jedes Secret. Nichts, worauf er zeigt, wird je hier gespeichert: Der Wert wird gelesen, wenn ein Lauf die Zugangsdaten öffnet, für die Cache-Zeit des Anbieters im Speicher gehalten und aus allem bereinigt, was der Lauf speichert, genau wie ein Passwort aus dem Tresor. Nur Secret-Felder nehmen Referenzen an. Eine Referenz in einem Feld, das kein Secret ist, ist nur Text.

### Einen Anbieter einrichten

Ein Anbieter ist der Server, die Art, wie Cascade sich dort anmeldet, und wo es lesen darf. Einen anzulegen, zu ändern und zu entfernen ist Sache eines Instanz-Eigentümers oder -Administrators, die Berechtigung `secrets.manage`, und muss von einer angemeldeten Person erfolgen, nicht von einem API-Schlüssel.

```sh
curl -X POST $CASCADE/api/v1/secret-providers -H "X-CSRF-Token: ..." -d '{
  "name": "bao",
  "address": "https://bao.plant.example:8200",
  "authMethod": "approle", "roleId": "...", "secretId": "...",
  "allowedPaths": ["plant"]
}'
```

| Feld | Was es bewirkt |
|---|---|
| `name` | 1 bis 40 Kleinbuchstaben, Ziffern und Bindestriche. Er steht in jeder Referenz und kann sich deshalb später nicht ändern. |
| `address` | Die URL des Servers. |
| `mount`, `kvVersion` | Wo die KV-Engine eingehängt ist (standardmäßig `secret`) und ob sie Version 1 oder 2 ist (standardmäßig 2). |
| `namespace` | Wird als `X-Vault-Namespace` gesendet, für einen Namespace des Servers. |
| `authMethod` | `token` mit `token` oder `approle` mit `roleId` und `secretId`. `authMount` ist, wo AppRole eingehängt ist (standardmäßig `approle`). AppRole meldet sich selbst an und noch einmal, wenn sein Token abläuft. |
| `caCert` | Eine PEM-Zertifizierungsstelle, der für den Server vertraut wird, wenn sein Zertifikat nicht von einer stammt, der das System vertraut. |
| `allowedPaths` | **Pflicht.** Die einzigen Orte, von denen eine Referenz lesen darf. `plant` erlaubt `plant` und alles darunter, und nicht `plantation`. |
| `projects` | Optional. Die einzigen Projekte, die den Anbieter nutzen dürfen. Bleibt es leer, darf jedes Projekt. |
| `cacheSeconds` | Wie lange ein gelesenes Secret im Speicher bleibt, 0 bis 3600. Standardmäßig 30. 0 liest jedes Mal. |

Wie Cascade sich anmeldet (das Token oder die AppRole-ID und das Secret), wird unter dem Instanzschlüssel versiegelt, bei einer Schlüsselrotation wie alles andere neu verpackt und von keinem Aufruf je angezeigt. Lassen Sie es bei einer Änderung weg, bleibt das gespeicherte bestehen.

`POST /api/v1/secret-providers/{provider}/test` meldet sich an, liest mit einem `path` diesen Pfad und sagt, ob es funktioniert hat. Es gibt nie einen Wert zurück. `GET /api/v1/secret-providers` listet Anbieter für jede angemeldete Person, weil die Leute, die Zugangsdaten anlegen, die Namen brauchen. Die Aufrufe stehen im Audit-Protokoll als `secrets.provider_created`, `_updated` und `_deleted`.

### Was es nicht tut

- **Ein Anbieter braucht erlaubte Pfade.** Ein Token für Vault kann meist weit mehr lesen, als wer Zugangsdaten bearbeitet benennen können sollte, und ohne Liste könnte jeder, der Zugangsdaten anlegen kann, eine auf ein beliebiges Secret richten, das das Token erreicht, und einen Workflow es irgendwohin senden lassen. Geben Sie dem Anbieter die Pfade, die seine Zugangsdaten brauchen, und seiner Richtlinie dasselbe.
- **Eine Referenz wird beim Speichern der Zugangsdaten geprüft**, nicht nur wenn ein Lauf sie nutzt: Der Anbieter muss existieren, für das Projekt der Zugangsdaten offen sein und den Pfad erlauben. Ein Pfad mit einem leeren Teil, einem Punkt oder einem `..` wird abgelehnt.
- **Ein Lauf, der das Secret nicht lesen kann, schlägt fehl und sagt warum**, mit Anbieter, Pfad und Schlüssel und nie einem Wert: kein solcher Anbieter, ein Pfad, den der Anbieter nicht erlaubt, dort kein Secret, kein solcher Schlüssel oder die eigene Ablehnung des Servers (eine Richtlinie, die das Lesen nicht erlaubt, ist „permission denied“).
- **Das Löschen eines Anbieters bearbeitet keine Zugangsdaten.** Die, die auf ihn zeigen, schlagen fehl, wenn ein Lauf sie öffnet, und sagen, dass der Anbieter fort ist.
- Ein Secret-Wert, der wirklich mit `secret://` beginnt, kann nicht als Secret gespeichert werden, weil er sich wie eine Referenz liest.
- Werte, die Zahlen oder wahr oder falsch sind, werden als Text gelesen. Ein Wert, der ein ganzes Objekt oder eine Liste ist, wird abgelehnt.
## Log-Weiterleitung

Im Editor: Einstellungen, Log-Weiterleitung (Eigentümer und Administratoren). Jedes Ziel zeigt, wie viel es gesendet hat, wann es zuletzt geliefert hat und seinen letzten Fehler, mit einer Schaltfläche, die ein Testereignis sendet.

Senden Sie das Audit-Protokoll und eine Zeile für jeden Lauf, der endet, dorthin, wo ein Werk seine Logs ohnehin hält: ein Syslog-Server oder alles, was OTLP-Logs über HTTP annimmt (ein OpenTelemetry-Collector, Loki, eine Log-Plattform). Ereignisse gehen raus, sobald sie passieren, sodass ein SIEM eine fehlgeschlagene Anmeldung in Sekunden sieht und die Audit-Spur irgendwo existiert, wo ein Administrator dieser Instanz sie nicht umschreiben kann.

Ein Ziel ist ein Ort. Legen Sie so viele an, wie Sie brauchen:

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

Ziele anzulegen, zu ändern und zu entfernen ist Sache der Instanz-Eigentümer und -Administratoren (`logstream.manage`), durch eine angemeldete Person und nicht durch einen API-Schlüssel, weil ein Ziel der Ort ist, wohin das Audit-Protokoll geht. Die Aufrufe stehen im Audit-Protokoll als `logstream.destination_created`, `_updated` und `_deleted`.

### Was gesendet wird

- **Audit-Ereignisse**: jede Zeile des Audit-Protokolls mit ihrer Sequenznummer und ihrem Hash. Sequenznummer und Hash sind, woran ein Empfänger eine Wiederholung erkennt, und der Hash ist der eigene der Zeile, sodass sich die Kette aus dem prüfen lässt, was ankam. Eine fehlgeschlagene oder abgelehnte Anmeldung ist eine Warnung, alles andere ein Hinweis.
- **Lauf-Ereignisse**: eines für jeden Lauf, der endet, wie auch immer er endet: die ID des Laufs, ID und Name des Workflows, sein Projekt, Status, Modus, wann er angelegt, gestartet und beendet wurde, wie lange er lief, und sein Fehler und der Schritt, an dem er scheiterte. Ein fehlgeschlagener Lauf ist ein Fehler, ein gestoppter ein Hinweis, ein guter informativ. Sie werden ein paar Sekunden nach dem Ende des Laufs gesendet.
- **Nie Item-Daten.** Was die Schritte eines Laufs gesehen und erzeugt haben, bleibt im Lauf, wo es die Schwärzungsrichtlinien schützen. Das Audit-Protokoll enthält nie ein Secret.

`events` wählt eines oder beide (`["audit"]`, `["execution"]`, standardmäßig beide). `start` sagt, wo ein neues Ziel beginnt: `now`, der Standard, sendet, was nach seiner Anlage passiert, und `beginning` sendet zuerst das ganze Audit-Protokoll und jeden abgeschlossenen Lauf.

### Syslog

Eine Nachricht ist RFC 5424: `<priority>1 time host hotloop-cascade pid msgid - {json}`, mit dem Ereignis als einer Zeile JSON. Die Priorität ist die Facility mal acht plus der Schweregrad. Die msgid ist die Audit-Aktion (`workflow.saved`) oder der Status des Laufs.

| Feld | Was es bewirkt |
|---|---|
| `address` | `host:port`. |
| `network` | `tcp` (der Standard), `udp` oder `tls`. |
| `framing` | Für `tcp` und `tls`: `octet` (Oktettzählung nach RFC 6587, der Standard) oder `newline`. UDP ist je ein Datagramm. |
| `facility` | Standardmäßig `local0`; jeder Syslog-Facility-Name. |
| `appName` | Der APP-NAME des Headers, standardmäßig `hotloop-cascade`. |
| `caCert`, `serverName` | Für `tls`: die Stelle, der vertraut wird, und der Name, auf den das Zertifikat ausgestellt sein muss, wenn er nicht der Host ist. Es gibt keine Einstellung, die die Prüfung überspringt. |

### OTLP

Logs gehen als OTLP über HTTP mit einem JSON-Body an `endpoint`: ein Log-Datensatz für jedes Ereignis, sein Body das Ereignis als JSON und seine Teile als Attribute (`cascade.event`, `cascade.action`, `cascade.status`, `cascade.project`, `cascade.actor.name` und so weiter), damit ein Empfänger filtern kann, ohne zu parsen. Die Ressource nennt `service.name=hotloop-cascade`, seine Version und den Host. `headers` werden mit jeder Anfrage gesendet, für ein Token oder einen Tenant. Sie werden unter dem Instanzschlüssel versiegelt, bei einer Schlüsselrotation neu verpackt und nie angezeigt: Die Liste nennt nur ihre Namen. `caCert` und `serverName` funktionieren wie bei Syslog.

### Wie sich die Zustellung verhält

- **Mindestens einmal, der Reihe nach.** Ein Ziel merkt sich die letzte Audit-Zeile und den letzten abgeschlossenen Lauf, die es gesendet hat. Eines, das ausgefallen ist, bekommt alles, was es verpasst hat, wenn es zurückkommt, der Reihe nach, und ein Neustart macht dort weiter, wo es aufgehört hat. Wird der Sender zwischen Senden und Notieren abgeschnitten, werden diese Ereignisse erneut gesendet, wofür die Sequenznummern da sind.
- **Ein fehlschlagendes Ziel weicht zurück**, eine Sekunde und verdoppelnd bis fünf Minuten, und sein Status sagt, was schiefging und wann: `lastError`, `lastErrorAt`. Ein Erfolg löscht ihn. Nichts wird verworfen, solange es ausgefallen ist, die Grenze ist also das Audit-Protokoll, nicht eine Warteschlange.
- **Immer nur ein Sender.** Bei mehreren Mains sendet derjenige, der das Lease eines Ziels hält, daran; die anderen warten und übernehmen, wenn er aufhört.
- **Das Ändern eines Ziels behält seinen Platz.** Es auf eine andere Adresse zu verlegen, sendet nie etwas erneut und lässt nie etwas aus. Header, die bei einer Änderung fehlen, bleiben erhalten, und ein leeres Objekt löscht sie. Name und Art können sich nicht ändern.
- `POST /api/v1/log-destinations/{destination}/test` sendet ein ausgedachtes Ereignis über denselben Weg und sagt, ob es angekommen ist, mit dem Grund, wenn nicht. Es bewegt nichts.
- `GET /api/v1/log-destinations` zeigt den Status jedes Ziels: wie viele Ereignisse es gesendet hat, die letzte zugestellte Audit-Sequenznummer, wann es zuletzt erfolgreich war und seinen letzten Fehler.

## Wo große Daten liegen

Dateien und große Nutzlasten, die ein Lauf mitführt (ein heruntergeladenes PDF, ein Kamerabild, eine Tabelle), werden als Blobs getrennt von der Datenbank gespeichert. Standardmäßig liegen sie auf dem Datenträger der Instanz. Setzen Sie `HOTLOOP_CASCADE_BLOB_STORE`, um sie stattdessen in einen S3-Bucket oder einen Azure-Blob-Container zu legen, damit der Main neu aufgebaut werden kann, ohne sie mitzuschleppen, und mehrere Mains eine Kopie teilen.

| Einstellung | Bedeutung |
| --- | --- |
| `HOTLOOP_CASCADE_BLOB_STORE` | `fs` (der Standard), `s3` oder `azure`. |
| `HOTLOOP_CASCADE_BLOB_SPOOL_DIR` | Wo ein Blob wartet, während er vor dem Upload gehasht wird. Standardmäßig `blob-spool` im Datenverzeichnis. |
| `HOTLOOP_CASCADE_BLOB_S3_BUCKET`, `_ACCESS_KEY`, `_SECRET_KEY` | Pflicht für `s3`. Das Secret liest auch `_SECRET_KEY_FILE`. |
| `HOTLOOP_CASCADE_BLOB_S3_ENDPOINT`, `_REGION` | Lassen Sie den Endpoint für AWS weg. Setzen Sie ihn für Garage, MinIO oder Ceph. |
| `HOTLOOP_CASCADE_BLOB_S3_PATH_STYLE` | `true` oder `false`. Path-Style ist der Standard, sobald ein Endpoint gesetzt ist. |
| `HOTLOOP_CASCADE_BLOB_S3_CA_FILE` | Ein CA-Bundle für einen Endpoint mit privatem Zertifikat. |
| `HOTLOOP_CASCADE_BLOB_S3_PREFIX` | Ein Ordner im Bucket, sodass ein Bucket mehr als eine Instanz halten kann. |
| `HOTLOOP_CASCADE_BLOB_AZURE_CONTAINER` | Pflicht für `azure`. |
| `HOTLOOP_CASCADE_BLOB_AZURE_CONNECTION_STRING`, oder `_ACCOUNT` mit `_KEY`, oder `_SAS` | Eine Art der Anmeldung. Secrets lesen auch eine `_FILE`-Form. |
| `HOTLOOP_CASCADE_BLOB_AZURE_ENDPOINT`, `_PREFIX` | Ein Endpoint für Azurite oder eine private Cloud und ein Ordner im Container. |

Beim Chart setzen Sie diese über `env` und `extraEnv`, wobei die Secrets aus einem Kubernetes-Secret kommen.

- **Nach Inhalt adressiert.** Ein Blob wird unter seinem SHA-256 gespeichert (`sha256/ab/cdef...`), sodass dieselbe Datei nur einmal gespeichert wird, wie viele Läufe sie auch mitführen. Sie erneut zu schreiben bewirkt nichts, auch wenn zwei Läufe es im selben Moment tun.
- **Vor dem Upload gehasht.** Die Daten werden einmal in die Spool-Datei gelesen, gehasht und dann gesendet, sodass der Speicher bei jeder Größe flach bleibt. Ein Blob über dem Größenlimit wird abgelehnt, und ein abgebrochener Upload hinterlässt nichts im Bucket.
- **Beim Herausgehen geprüft.** Ein Lesevorgang wird beim Streamen gegen seinen Hash geprüft, sodass ein beschädigtes Objekt laut fehlschlägt, statt einem Lauf falsche Daten zu liefern.
- **Größe.** Ein einzelner Upload geht bei S3 als Multipart-Übertragung und bei Azure in Blöcken hoch, sodass das übliche 5-GiB-Limit pro Anfrage nicht gilt.
- **Blob-Bereinigung.** Einmal pro Stunde entfernt ein Durchlauf die Blobs, auf die keine Zeile mehr zeigt: eine Schrittausgabe, die als Datei gespeichert wurde, weil sie für die Datenbank zu groß war, und die Anhänge, die Items tragen. Ein Blob bleibt erhalten, solange ein Schrittlauf, eine Teilausgabe, eine gespeicherte Antwort oder ein Workflow ihn noch nennt, direkt oder über eine gespeicherte Ausgabe, die den Anhang enthält, sodass eine Datei, die zwei Läufe mit identischer Ausgabe teilen, bis zum Verschwinden des letzten bleibt. Es werden nur Blobs angesehen, die zuletzt vor mehr als 24 Stunden geschrieben wurden, und das Ablegen von Bytes, die schon gespeichert sind, zählt nach der ersten Stunde als erneutes Schreiben, sodass eine Datei, die ein Schritt gerade gespeichert und noch nicht verzeichnet hat, nie entfernt wird. Ein Durchlauf, der eine gespeicherte Ausgabe nicht lesen kann, entfernt nichts. Er schreibt eine Zeile `blobs.collected` ins Audit-Protokoll mit der Zahl der Dateien und Bytes, die entfernt wurden. Der Durchlauf nimmt an, dass der Blob-Speicher zu einer Instanz gehört (die Worker und der Main einer Installation teilen ihn); zwei Installationen, die auf denselben Bucket oder Ordner zeigen, würden jeweils die Dateien der anderen entfernen, geben Sie also jeder ihren eigenen (`HOTLOOP_CASCADE_BLOB_S3_PREFIX` gibt es dafür).
- **Den Speicher später wechseln.** Vorhandene Blobs bleiben dort, wo sie geschrieben wurden. Verschieben Sie sie in den neuen Speicher, bevor Sie umschalten, denn ein Verweis auf einen Blob, den der neue Speicher nicht hat, ist eine fehlende Datei.

Diese beiden Backends werden in der Test-Umgebung gegen Garage und Azurite geprüft, mit derselben Konformitäts-Suite wie der Datenträgerspeicher: Schreiben und Lesen, leere Blobs, Deduplizierung unter Nebenläufigkeit, Beschädigung, das Limit, ungültige IDs, Löschen, Auflisten, ein abgebrochener Upload und ein gestreamter 192-MiB-Upload mit einer Heap-Prüfung.

Was es für Sie bedeutet: Ein neu aufgebauter oder ersetzter Main findet jede Datei, die seine Läufe mitführten, ohne Kopieren.
