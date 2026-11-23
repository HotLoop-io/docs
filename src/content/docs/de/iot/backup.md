---
title: "Sicherungen und Wiederherstellung"
description: "Logische Momentaufnahmen der Datenbank, Wiederherstellungen, die ein neueres Schema ablehnen, und warum der Gerätepasswort-Schlüssel getrennt gesichert wird."
---

HotLoop erstellt seit 4.12.0 logische Momentaufnahmen des Historians, die nur Tabellendaten enthalten, und stellt sie wieder her. Standardmäßig aus (`HOTLOOP_BACKUP_ENABLED`): Ein Deployment, das kein Sicherungsvolume eingerichtet hat, soll diesen Prozess nicht still in das flüchtige Dateisystem eines Containers schreiben lassen.

## Was das ist

Eine Sicherung ist ein Verzeichnis: eine Datei pro Tabelle plus eine kleine `manifest.json` (HotLoop-Version, die auf die Datenbank angewendeten Schema-Migrationen, Zeitstempel sowie Zeilenzahl und Spalten mit ihren Typen jeder Tabelle).

## Was das nicht ist

- **Nicht `pg_dump`/`pg_restore`.** Das Laufzeit-Image des Gateways (`gcr.io/distroless/static-debian12:nonroot`) ist bewusst eine statische Binärdatei und sonst nichts: keine Shell, kein Paketmanager, keine externen Binärdateien irgendeiner Art. Alles hier läuft über dieselbe Datenbankverbindung, die die Anwendung ohnehin hält.
- **Keine Schema-Sicherung.** Das Schema wird bei jedem Start automatisch neu aufgebaut (`HOTLOOP_DB_MIGRATE`, standardmäßig an). Eine Sicherung erfasst nur die *Daten* der Tabellen, und eine Wiederherstellung setzt immer voraus, dass das Schema zuvor durch diese Migrationen aufgebaut wurde.
- **Keine Wiederherstellung zu einem beliebigen Zeitpunkt.** Hier gibt es weder WAL-Archivierung noch kontinuierliche Replikation. Eine Sicherung ist eine Momentaufnahme zum Zeitpunkt ihres Laufs; was danach und vor der nächsten Sicherung geschrieben wird, ist nicht abgedeckt.
- **Keine Ablage außerhalb des Geräts.** Das Sicherungsverzeichnis (`HOTLOOP_BACKUP_DIR`, gedacht für das PVC `backup.persistence`, das dieses Chart bereitstellt) ist weiterhin ein einzelnes Volume im selben Cluster. Sicherungen auf wirklich dauerhaften, replizierten oder Offline-Speicher zu bringen (das Volume in Objektspeicher kopieren, das PVC als Snapshot sichern, was auch immer die tatsächliche Infrastruktur des Betreibers bietet), ist Aufgabe des Betreibers, so wie dieses Projekt dauerhaften Speicher schon jetzt als Verantwortung der Infrastruktur behandelt und nicht als etwas, wofür die Anwendung einen Multi-Cloud-Sicherungsadapter neu erfindet.

## Sicherungsdateien schützen

Sicherungsdateien sind sensibel. Die Datei `users.copy` enthält bcrypt-Hashes von Passwörtern und Kiosk-PINs, und `sessions.copy` und `write_audit.copy` enthalten Sitzungsdatensätze und das Audit-Protokoll der Schreibvorgänge. Dateien werden mit dem Modus `0640` angelegt (das Sicherungsverzeichnis mit `0750`), und eine bereits vorhandene Datei ist ein Fehler und wird nicht überschrieben, aber das ist nur ein Mindestschutz und kein Ersatz für den Schutz des Volumes: Legen Sie das Sicherungsvolume auf im Ruhezustand verschlüsselten Speicher, beschränken Sie, wer und was es lesen kann, und gehen Sie mit jeder Kopie außerhalb des Geräts, die ein Betreiber anlegt, genauso sorgfältig um.

Die Datei `devices.copy` enthält die Adresse und die Protokollkonfiguration jedes Geräts so, wie sie gespeichert sind, einschließlich der Zugangsdaten, mit denen sich die Treiber anmelden. Wie lesbar sie sind, hängt vom Schlüssel ab, siehe unten. Seit 4.15.1 verbirgt die API jede Gerätezugangsdaten vor jeder Rolle, auch vor dem Administrator; eine Sicherungsdatei liegt nicht hinter der API. Siehe [Authentifizierung und Benutzer](/de/iot/authentication/#wo-zugangsdaten-noch-im-klartext-liegen).

## Gerätezugangsdaten und der geheime Schlüssel

Eine Sicherung ist die Datei, die auf einen Laptop, eine Freigabe und in ein Ticket kopiert wird. Deshalb sind die Zugangsdaten darin verschlüsselt, mit einem Schlüssel, der nie in der Datenbank und nie in einer Sicherung liegt.

- **Mit gesetztem `HOTLOOP_SECRET_KEY_FILE`** (das Chart setzt es, mit einem Schlüssel, den es bei der Installation erzeugt und über Upgrades und Deinstallationen hinweg behält) wird jede geschützte Zugangsdate (das `password` der OPC-UA-, CODESYS-, MQTT-, HTTP-, MTConnect- und UniFi-Geräte, die `community` und Passphrasen der SNMP-Geräte, HTTP- und MTConnect-Header-Werte wie API-Schlüssel, das Passwort jedes weiteren MQTT-Brokers, den die Erkennung abhört, und das Passwort jedes Historian-Ziels) in der Datenbank verschlüsselt, und `devices.copy`, `mqtt_sources.copy` und `historian_targets.copy` enthalten den Chiffretext. Das Manifest nennt den verwendeten Schlüssel als `secretKeyIds`: eine ID, nie den Schlüssel.
- **Ohne ihn** liegen diese Zugangsdaten im Klartext in der Datenbank und in `devices.copy`, und HotLoop sagt das in seinem Startprotokoll. UniFi-Konsolen, MQTT-Broker mit Passwort und Historian-Ziele mit Passwort lassen sich ohne Schlüssel gar nicht speichern. Setzen Sie einen und starten Sie neu: Alles bereits Gespeicherte wird bei diesem Start verschlüsselt.
- **Auch eine Zugangsdate in einer URL oder in einem Text wird versiegelt** (`mqtt://user:pass@host`, ein Abfragewert `?token=` oder `?api_key=`, ein HTTP-`body`, der ein Passwort erwähnt). Die Adresse oder Option eines Geräts, die eines enthält, wird als Ganzes versiegelt, und die Treiber erhalten sie genau so zurück, wie sie eingegeben wurde. Eine URL ohne Geheimes bleibt lesbar. Ohne Schlüssel liegen diese wie der Rest im Klartext, und das Startprotokoll sagt es; mit einem Schlüssel wird alles bereits Gespeicherte bei diesem Start versiegelt. Die Passwort-Option bleibt der bessere Ort dafür.

**Die Wiederherstellung braucht denselben Schlüssel.** `--restore-from` prüft das Manifest, bevor es eine Zeile lädt: Eine Sicherung, die mit einem Schlüssel verschlüsselt wurde, den das wiederherstellende HotLoop nicht hat, wird abgelehnt, und der Fehler nennt den benötigten Schlüssel. Stellen Sie mit eingehängter Schlüsseldatei wieder her. Ist der Schlüssel endgültig weg, fügen Sie `--restore-keep-unreadable-credentials` hinzu: Alles andere kommt zurück, und jedes Gerät, dessen Zugangsdaten sich nicht öffnen lassen, bleibt nicht erreichbar und nennt den Schlüssel, den es braucht, bis jemand die Zugangsdaten neu eingibt. Eine Sicherung aus der Zeit vor dem Schlüssel lässt sich überall wiederherstellen, und ihre Zugangsdaten werden verschlüsselt, sobald die Wiederherstellung fertig ist.

**Bewahren Sie den Schlüssel dort auf, wo die Sicherung nicht liegt.** Ein Schlüssel neben seinen Sicherungen schützt nichts. Beim Chart ist es das Secret `<release>-secret-key`; sichern Sie es so, wie Sie die übrigen Secrets des Clusters sichern, getrennt.

## Was gesichert wird und in welcher Reihenfolge

Jede Tabelle mit Benutzerdaten, in der Reihenfolge der Fremdschlüssel-Abhängigkeiten (eine Tabelle kommt immer nach allen Tabellen, auf die ihre eigenen Fremdschlüssel zeigen):

```
devices → tags → tag_latest → alarm_definitions → alarm_state →
alarm_events → automations → automation_runs → blueprints → scripts → script_runs →
recipes → recipe_versions → recipe_applications → events → write_audit →
settings → users → sessions → user_certificates → energy_meters → energy_meter_state →
energy_buckets → fleet_members → report_definitions →
report_runs → entity_state_log → tag_history
```

(Gekürzt; `backup.Tables` ist die vollständige Liste, einschließlich der Entitäts- und Anlagentabellen und `entity_last_state`.) Das `entity_state_log` des Logbuchs ist in beiden Historienmodi nach Monaten partitioniert und kommt direkt vor `tag_history`, der einzigen größeren Tabelle. Eine Wiederherstellung lädt seine Zeilen, bevor eine seiner Monatspartitionen existiert, sodass sie in seiner Standardpartition landen. Die Wartung des Logbuchs legt beim Start eines aufzeichnenden Gateways die Partitionen des letzten und des aktuellen Monats um die Zeilen an, die in sie gehören, und löscht ältere Zeilen aus der Standardpartition, sobald sie die Aufbewahrung überschreiten, sodass die Aufbewahrung jede wiederhergestellte Zeile erreicht. Siehe [das Logbuch](/de/iot/logbook/).

Skripte kommen mit ihrer Historie zurück. Ein Lauf, den die Sicherung mittendrin erwischt hat, kommt als `running` zurück, und der erste Start des Gateways markiert ihn als abgebrochen, `interrupted by restart`, genau wie einen Lauf, den ein Absturz abgeschnitten hat: Nichts setzt einen Lauf fort. Siehe [Skripte](/de/iot/scripts/).

Rezepte kommen mit jeder Version und jeder Anwendung zurück. Eine Anwendung, die die Sicherung halb erwischt hat, kommt als `applying` zurück, und der erste Start des Gateways markiert sie als `failed` und verweist auf ihre Aufruf-ID im Schreib-Audit: Nichts setzt eine fort, und nichts macht eine rückgängig. Siehe [Rezepte](/de/iot/recipes/).

`schema_migrations` ist bewusst ausgenommen: `store.Migrate` baut sie samt dem DDL jeder Tabelle aus den eingebetteten Migrationen neu auf. Sie ist der einzige Eintrag in `backup.ExcludedTables`, das festhält, warum jede ausgenommene Tabelle ausgenommen ist.

Die Liste wird von Hand gepflegt, und so kann eine Migration eine Tabelle hinzufügen, die danach unbemerkt in jeder Sicherung fehlt. Zwei Tests schützen davor, und beide laufen gegen eine echte Datenbank in beiden Speichermodi. Die Tabellen der geplanten Berichte (`report_definitions`, `report_runs`) sind die ersten Tabellen, die unter diesen Schutzmaßnahmen hinzugekommen sind. Die Ausgabedateien der Berichte liegen auf dem Berichte-Volume und sind nicht Teil einer Datenbanksicherung. `tag_history` wird bei der Wiederherstellung zuletzt geladen: Sie hat keinen eigenen Fremdschlüssel und ist mit Abstand die größte Tabelle, sodass jede kleine Konfigurationstabelle früh scheitert, falls sie scheitern soll, bevor dieser lange Schritt überhaupt beginnt.

**`settings` hat eine bewusste Ausnahme.** Die Zeile `history_mode` schreibt `store.ensureHistorySchema` selbst, einmalig, in dem Moment, in dem `Migrate` ein Schema aus dem Nichts aufbaut: Sie hält fest, ob *dieser Server* `tag_history` als TimescaleDB-Hypertable oder als nativ partitionierte Tabelle angelegt hat, was eine Tatsache über die Datenbank ist, gegen die `Migrate` gerade lief, und nicht über das Werk. Sie ist sowohl von der Sicherung als auch von der Wiederherstellung von `settings` ausgenommen: Die historische Entscheidung einer Quellinstallation auf ein Ziel mit anderen Fähigkeiten zu übertragen (oder auch nur auf einen frischen `Migrate`-Lauf gegen dieselbe Art Server) könnte diese Zeile so umschreiben, dass sie eine Form beschreibt, die das Ziel gar nicht hat. Das `Migrate` des Ziels hat die richtige Entscheidung bereits getroffen, bevor `Restore` überhaupt auf `settings` schaut, und diese Entscheidung bleibt unangetastet.

## Sicherungen auf Abruf

- `POST /api/backup` (`backup.run`, nur Administratoren) erstellt sofort eine Sicherung und gibt das Manifest zurück.
- `GET /api/backup` (`backup.read`, nur Administratoren) listet auf, was auf dem Sicherungsvolume liegt: Name, Größe auf dem Datenträger und das Manifest (Tabellenliste, Zeilenzahlen, HotLoop-Version, Zeitstempel) jeder einzelnen.

Beide sind nur für Administratoren, weil sie in der Rolle Bediener fehlen, dieselbe Einschränkung, die `fleet.restart`/`fleet.config`/`notify.test` bereits auf andere betriebliche Aktionen vom Typ „jetzt ausführen“ oder mit administrativem Umfang anwenden. Die Zeilenzahlen einer Sicherungsliste, darunter `users` und `sessions`, ähneln eher einer administrativen Diagnose als den Lesezugriffen der Anlagenebene (Geräte, Tags, Alarme), die die Rolle Bediener sehen soll, daher wurde `backup.read` nicht wie manche Lesezugriffe in eine niedrigere Berechtigung abgespalten; das ist eine Ermessensfrage, keine technische Einschränkung, und könnte überprüft werden, wenn ein echter Bedienerablauf es braucht.

## Zeitplan und Aufbewahrung

`HOTLOOP_BACKUP_INTERVAL` (z. B. `24h`) führt in festem Takt eine Sicherung aus. Das ist bewusst ein einfaches Intervall und kein Cron-Ausdrucks-Parser: Der realistische Bedarf ist „sichere das hin und wieder“, und die Konvention dieses Projekts ist, nicht für einen Bedarf zu bauen, den noch niemand hat. Wird es nicht gesetzt (oder auf `0`), ist der Planer aus; der Endpunkt auf Abruf funktioniert weiterhin, für einen Bediener oder einen externen Cron, der sie lieber selbst auslöst.

`HOTLOOP_BACKUP_RETAIN` (Standard `7`) behält die neuesten N Sicherungsverzeichnisse und löscht nach jeder erfolgreichen Sicherung ältere. `0` oder weniger behält alles, eine Entscheidung, die ein Betreiber auf einem kleinen Volume bewusst treffen muss.

## Eine Sicherung wiederherstellen

**Die Wiederherstellung ist bewusst kein API-Endpunkt.** „Jetzt wiederherstellen“ als Live-Aktion, die sich über das Netzwerk auslösen lässt, gegen eine Datenbank zu automatisieren, die Produktionsverkehr bedienen kann, ist eine echte Gefahr: Ein falscher Klick oder eine kompromittierte Administratorsitzung überschreibt Produktionsdaten, und dieses Projekt baut das nicht, ohne ausdrücklich darum gebeten zu werden. Die Wiederherstellung ist eine Option der Binärdatei selbst, die einmal, von Hand, von einem Betreiber ausgeführt wird, der bereits entschieden hat, dass die Zieldatenbank sie erhalten soll:

```sh
hotloop --restore-from=/data/backups/20260918T220000Z
```

Was dabei in welcher Reihenfolge geschieht:

1. Lädt die Konfiguration und verbindet sich genau wie bei einem gewöhnlichen Start mit der Datenbank: `store.Open` führt dieselben Migrationen aus und baut das Schema auf, in das die Wiederherstellung gleich Daten lädt.
2. **Lehnt eine Sicherung ab, die sie nicht laden kann, ohne etwas zu verlieren**: eine mit einem neueren Schema als dem dieser Datenbank oder eine mit einer Tabelle oder Spalte, die diese Version nicht mehr hat. Beides wird geprüft, bevor eine einzige Zeile geladen wird. Siehe „Auf eine andere Version wiederherstellen“ weiter unten.
3. **Lehnt ab, wenn eine Zieltabelle bereits Daten enthält**, über das hinaus, was `Migrate` selbst gerade angelegt hat (die eine Zeile `history_mode` in `settings`): Die Wiederherstellung läuft nur gegen eine Datenbank, in der noch nichts ist. Das ist die Sicherheitsprüfung: Eine Tabelle mit auch nur einer vorhandenen Zeile stoppt die gesamte Wiederherstellung, bevor ein `COPY FROM STDIN` läuft.
4. Lädt jede Tabelle in Abhängigkeitsreihenfolge in einer einzigen Transaktion in die Spalten, die das Manifest nennt.
5. Setzt die zugrunde liegende Sequenz jeder Tabelle mit `bigserial`-Primärschlüssel (`tags`, `alarm_events`, `automation_runs`, `events`, `write_audit`, `sessions`) auf einen Wert über der höchsten wiederhergestellten ID zurück: `COPY FROM STDIN` lädt explizite ID-Werte, ohne die Sequenz anzufassen, sodass ein Auslassen dazu führen würde, dass das allernächste gewöhnliche Einfügen mit einer wiederhergestellten Zeile kollidiert.
6. Zählt jede Tabelle neu und vergleicht mit den Zeilenzahlen des Manifests, innerhalb derselben noch offenen Transaktion.
7. Bestätigt nur, wenn jede Zählung übereinstimmte. Eine Abweichung oder ein Fehler in einem früheren Schritt macht die gesamte Transaktion rückgängig und lässt die Zieldatenbank genau so leer, wie sie vorgefunden wurde, nie teilweise geladen.
8. Beendet sich. Sonst startet im Prozess nichts: kein Abfrage-Planer, keine Alarm-Engine, kein API-Server. Eine Wiederherstellung braucht keines davon, und die Laufzeit gegen eine Datenbank mitten in der Wiederherstellung zu starten wäre eine eigene Gefahr.

### Umzug auf PostgreSQL 17

Diese Sicherung erstellt die laufende Anwendung über ihre Verbindung zur laufenden Datenbank, sie kann also nicht die Sicherung für den Wechsel von PostgreSQL 16 auf 17 sein: Dieser Wechsel läuft, bevor die Datenbank startet. Die Sicherheit des Upgrades selbst besteht darin, dass es nie in das PostgreSQL-16-Verzeichnis schreibt, das es unversehrt als `pgdata.pg16` behält (die Seite zu k3s und Helm, „PostgreSQL 17“). Erstellen Sie diese Sicherung trotzdem vor dem Upgrade auf dem alten Release, denn sie ist die Kopie, die außerhalb des Geräts liegt. Sie in die neue Datenbank einzuspielen ist die gewöhnliche Wiederherstellung weiter unten: Sie überträgt Zeilen, nicht die Engine, und es ist ihr gleich, welche Hauptversion sie geschrieben hat.

### Auf eine andere Version wiederherstellen

Das Release, mit dem Sie wiederherstellen, ist selten das, das die Sicherung erstellt hat. Die Sicherung entstand vor Monaten mit dem, was damals lief, und das Gerät, das Sie neu aufbauen, führt das heutige aus. Hier ist also, was worauf wiederhergestellt wird.

**Eine ältere Sicherung auf einem neueren HotLoop: ja.** Das ist der Fall, auf den es ankommt, und er ist von jeder Schemastufe aus getestet, die es gab, von `0001_core` bis heute, auf TimescaleDB und auf reinem PostgreSQL, mit anschließend gestarteter Anwendung.

- Jedes Manifest hält die Spalten jeder Tabelle fest, Namen und Typen. Die Wiederherstellung lädt jede Datei genau in diese Spalten, nach Namen. Eine seit der Sicherung hinzugekommene Spalte erhält ihren Standardwert. `entity_id`, `service` und `call_id` von `write_audit` kommen bei jeder Audit-Zeile aus der Zeit vor den Entitätsdiensten leer zurück, was diese Zeilen waren: reine Tag-Schreibvorgänge.
- Eine seit der Sicherung hinzugekommene Tabelle bleibt leer, und die Anwendung füllt beim Start, was sie kann. Die erste Synchronisierung des Entitätsregisters gibt jedem wiederhergestellten Tag seine Lese-Entität, jedem scharfgeschalteten Tag seine Steuer-Entität und jeder Alarmdefinition ihre Alarm-Entität, mit den Namen, die das Register ihnen gegeben hätte. Geräte aus einer Sicherung, die älter ist als der Anlagenbaum, werden bei der Wiederherstellung selbst anhand ihres Standort-, Bereichs- und Linientexts darin eingeordnet, so wie das Upgrade sie eingeordnet hat. Was nie in der Sicherung war, kann nicht zurückkommen: Labels, zusammengesetzte Entitäten und Entitätsnamen, die ein Bediener nach der Sicherung angepasst hat.

**Eine neuere Sicherung auf einem älteren HotLoop: nein, abgelehnt.** Das Manifest hält jede Migration fest, die die Datenbank der Sicherung angewendet hatte. Hat sie eine, die diese Datenbank nie ausgeführt hat, stoppt die Wiederherstellung, bevor sie eine Zeile lädt, und sagt es:

```
refusing to restore: this backup was taken by HotLoop <its version> with the
database schema at <its newest migration>, which is newer than this database's
schema at <this database's newest migration> (HotLoop <this version>). ...
Restore it with HotLoop <its version> or a later release
```

„Neuer“ bedeutet Migrationen, nicht Versionszeichenfolgen. Eine Versionszeichenfolge sagt, welche Binärdatei die Sicherung erstellt hat, und Entwicklungs-Builds, Release-Kandidaten und Hotfix-Zweige machen ihren Vergleich zu einer Vermutung. Die Migrationen sagen, wie das Schema tatsächlich war, und sie werden als Menge verglichen, sodass eine fehlende Migration an jeder Stelle der Reihenfolge erkannt wird. Die Versionen stehen in der Meldung, weil die Version das ist, womit Sie etwas anfangen können: mit welchem Release wiederherzustellen ist.

**Eine Sicherung mit einer Spalte, die diese Version nicht mehr hat: abgelehnt, mit Namen.** An dem Tag, an dem eine Migration eine Spalte löscht, umbenennt oder ihren Typ ändert, enthält eine Sicherung davor Daten, für die die neue Tabelle keinen Platz hat. Die Wiederherstellung rät nicht. Sie nennt jede solche Spalte, über alle Tabellen hinweg, bevor sie irgendetwas lädt:

- eine Spalte, die die laufende Tabelle nicht hat, wird abgelehnt, es sei denn `backup.columnRenames` ordnet sie ihrem neuen Namen zu. Eine Migration, die eine Spalte umbenennt, fügt diesen Eintrag hinzu, und einen Test, der eine Sicherung aus der Zeit davor wiederherstellt, in derselben Änderung. Heute gibt es keine Umbenennungen, die Zuordnung ist also leer;
- eine Spalte, deren Typ sich geändert hat, wird abgelehnt. Binäres COPY trägt keine Typen, die Bytes würden also als der neue Typ gelesen oder auf halbem Weg abgewiesen;
- eine Spalte, die die laufende Tabelle als `NOT NULL` ohne Standardwert hinzugefügt hat, wird abgelehnt, weil nichts sie füllen könnte.

Der Ausweg ist für alle drei derselbe: mit dem Release wiederherstellen, das die Sicherung erstellt hat, und diese Datenbank dann an Ort und Stelle aktualisieren, so wie die Migration diesen Daten begegnen sollte.

Das Laden nach Namen deckt auch die Änderung ab, die niemand bemerkt: eine gelöschte und neu hinzugefügte Spalte oder eine neu aufgebaute Tabelle, sodass die Spalten in anderer Reihenfolge stehen. Das Laden nach Position würde die Werte einer Spalte in eine andere schreiben, ohne Fehler, sobald die Typen passen. Nach Namen landet jede dort, wo sie hingehört.

**Sicherungen, die erstellt wurden, bevor Manifeste das alles festhielten** (jede Sicherung vor diesem Release), haben weder Spaltenlisten noch ein Schema. Sie lassen sich trotzdem wiederherstellen:

- Ohne Spaltenlisten fällt die Wiederherstellung auf die Position zurück. Eine Datei mit weniger Spalten als die Tabelle geht in die ersten Spalten der Tabelle, und der Rest erhält seine Standardwerte. Das stimmt für jedes Schema bisher, weil jede Migration bis heute nur Spalten hinzugefügt hat und `ALTER TABLE ADD COLUMN` immer hinten anfügt. Eine Datei mit mehr Spalten als die Tabelle lehnt PostgreSQL selbst ab.
- Ohne Schema nimmt die Wiederherstellung an, die Sicherung sei so neu wie überhaupt möglich: `0007_service_audit.sql`, die neueste Migration, die es gab, als Manifeste begannen, sie festzuhalten. Diese Annahme kann nur eine Wiederherstellung ablehnen, die funktioniert hätte, nie eine durchlassen, die nicht funktioniert hätte. In der Praxis lehnt sie nichts ab, denn jedes HotLoop mit dieser Prüfung hat bereits jede Migration bis zu dieser ausgeführt.

Die erste Sicherung, die dieses Release erstellt, hält alles fest, sodass die Rückfallregel nur für Sicherungen zählt, die bereits auf einem Sicherungsvolume liegen.

### Wiederherstellung, Schritt für Schritt

1. Bringen Sie das Sicherungsverzeichnis auf den Rechner oder das Volume, das die `hotloop`-Binärdatei des Ziel-Deployments lesen kann: Hier kommt die Kopie des Sicherungsvolumes außerhalb des Geräts, die ein Betreiber angelegt hat, wieder ins Spiel.
2. Richten Sie `HOTLOOP_DB_*` auf die **Ziel**datenbank. Sie muss erreichbar sein und in keiner der gesicherten Tabellen schon Daten haben (eine ganz neue, leere Datenbank ist der Normalfall; das Schema wird in Schritt 3 aufgebaut).
3. Führen Sie `hotloop --restore-from=<path to the backup directory>` aus.
4. Lesen Sie die letzte Protokollzeile: `restore complete` mit den Tabellen- und Zeilenzahlen oder einen Fehler, der genau erklärt, was abgelehnt wurde und warum.
5. Starten Sie `hotloop` normal gegen dieselbe Datenbank.

## Umzug zwischen Datenbanken

Eine Sicherung ist dasselbe, egal welche Datenbank sie erstellt hat: binäre COPY-Dateien von PostgreSQL und ein Manifest, das den Postgres-Typ jeder Spalte nennt. Ein Werk von einer Datenbank in eine andere zu bringen ist also eine Sicherung auf der alten und eine Wiederherstellung in der neuen. Sonst nichts.

- **SQLite nach Postgres oder TimescaleDB.** Der Pi, der seiner Datei entwachsen ist. Sicherung erstellen, `HOTLOOP_DB_*` auf den neuen Server richten (`HOTLOOP_DB_TYPE=postgres`), wiederherstellen. Auf einem TimescaleDB-Server landet die Historie in einer Hypertable.
- **Postgres oder TimescaleDB nach SQLite.** Ein Werk, das auf ein kleines Gerät umzieht. Dasselbe in die andere Richtung, mit `HOTLOOP_DB_TYPE=sqlite`.
- **Reines Postgres nach TimescaleDB und zurück.** Der Historienmodus ist festgelegt, wenn man also ein Gateway auf das reine Postgres eines IoT-Geräts richtet, behält es seine Partitionen. Für eine Hypertable stellen Sie in ein frisches TimescaleDB wieder her. In die andere Richtung erhalten Sie Partitionen.

Was beim Einspielen geprüft wird, ist das, was bei jeder Wiederherstellung geprüft wird: jede Spalte nach Namen und Typ gegen das Ziel, wobei die Spalten von SQLite als ihre Postgres-Typen gelesen werden, sodass eine Sicherung des einen in das andere wiederhergestellt wird oder aus demselben Grund abgelehnt wird wie überall. `history_mode` wird nie kopiert: Das Ziel behält, was seine eigenen Migrationen entschieden haben. Die Sequenzen stimmen auf beiden: Bei Postgres verschiebt sie `fixSequences`, und das AUTOINCREMENT von SQLite rückt von selbst über jede darin wiederhergestellte ID hinaus.

## Konfiguration

| Variable | Standard | <span class="sr-only">Details</span> |
|---|---|---|
| `HOTLOOP_BACKUP_ENABLED` | `false` | Die Funktion ist aus, einschließlich der API-Routen, bis dies gesetzt ist |
| `HOTLOOP_BACKUP_DIR` | `/data/backups` | Wohin Sicherungen geschrieben werden; gedacht als PVC (`backup.persistence` im Chart) |
| `HOTLOOP_BACKUP_RETAIN` | `7` | Die neuesten N Sicherungen werden behalten; `0` oder weniger behält alles |
| `HOTLOOP_BACKUP_INTERVAL` | nicht gesetzt | z. B. `24h`; nicht gesetzt bedeutet nur auf Abruf |

`--restore-from=<dir>` ist eine Befehlszeilenoption der `hotloop`-Binärdatei, keine Umgebungsvariable, siehe „Eine Sicherung wiederherstellen“ oben.

## Was geprüft wurde und was nicht

HotLoop wurde gegen echte Anlagen und echte Server betrieben, und am 2026-11-17 auf Bare Metal.
