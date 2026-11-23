---
title: "Flow-Roadmap"
description: "Die Phasen von Flow, was fertig ist und was als Nächstes kommt, einschließlich der Neufassung des Editors in Astro."
---

Was HotLoop Flow werden soll, in der Reihenfolge, in der es gebaut wird. Was nicht auf dieser Liste steht, wird nicht gemacht, also setzen Sie es auf die Liste.

Flow wird neben HotLoop gebaut und bleibt ein eigenes Produkt. FlowLab und seine Diagramme, Phase 9, sind ein eigenes Paket, das neben der Nachrichten-Laufzeit steht.

## Wofür Flow da ist

Eine visuelle Flow-Engine für die Fertigung. Jedes Deployment wird verglichen, getestet und ist einen Klick vom Rollback entfernt. Wenn nachts um 3 Uhr etwas schiefgeht, sehen Sie genau, welchen Weg eine Nachricht genommen hat und wie sie an jeder Station aussah. Sie läuft in einer einzigen statischen Binärdatei, klein genug für einen Pi, und kippt nicht um, wenn ein Sensor gesprächig wird.

Sie liest auch Ihre vorhandenen `flows.json` unverändert. Das ist ein Plus, nicht der Zweck.

Die Regeln, unter denen jeder Punkt unten ausgeliefert wird:

- Keine Attrappen. Was nicht gebaut, gegen das Echte getestet und funktionsfähig ist, wird nicht abgehakt.
- Alles, was Anlagen steuern kann, läuft durch ein Tor, das Nein sagen kann, und sagt, warum.
- Nichts wird stillschweigend weggeworfen. Jedes Verwerfen, jede Ablehnung und jeder Überlauf wird gezählt und erscheint in den Metriken.
- Die Flow-Datei wird weiterhin Byte für Byte geladen und gespeichert. Neue Daten kommen in Schlüssel, die andere Werkzeuge ignorieren, und der Hin-und-zurück-Test deckt Dateien ab, die sie tragen.

---

### Phase 0: die Wahrheit sagen

Das README behauptet Dinge, die der Code nicht belegt. Das wird korrigiert, bevor etwas Neues versprochen wird, denn ein README, das einmal lügt, wird danach gelesen, als würde es immer lügen.

- [x] Die WASM-Sandbox ist echt und getestet, aber kein Knoten nutzt sie, und sie steckt nicht in der Binärdatei. Das wird so gesagt, bis Phase 6 es wahr macht
- [x] Zwei Code-Kommentare verweisen auf einen eingebetteten Kontextspeicher, den es nicht gibt. Sie werden gelöscht
- [x] Den Speicherbedarf im Leerlauf und unter Last auf dieselbe Weise auf demselben Gerät neu messen, den Befehl mit der Zahl veröffentlichen und jede Zahl streichen, die niemand reproduzieren kann
- [x] CVE-2025-41656 ist ein Hersteller, der eine andere Flow-Engine mit abgeschalteter Authentifizierung ausliefert, keine CVE in dieser Engine. Die Zuordnung wird im README und in der `exec`-Zeile von `docs/compatibility.md` korrigiert
- [x] Den Anfang des README um das herum neu schreiben, was Flow tut. Der Import vorhandener Flows zieht weiter unten in einen eigenen Abschnitt, mit dem byte-genauen Hin-und-zurück und `hotloop-flow import` als Beleg
- [x] Die Deployment-Dokumentation spricht von Kubernetes, Podman und Quadlet, nicht vom App Store eines einzelnen Unternehmens
- [x] Tests für die Pakete, die keine haben: `api` (Anmeldung, Berechtigungen, die 409 bei einem veralteten Deployment), `config` (jede Ablehnung beim Start, die das README auflistet) und `cmd` (das Deployment schreibt die Flow-Datei, bevor es die alte Laufzeit stoppt), dazu `js`, die Sandbox des Function-Knotens, die ebenfalls keine hatte

### Phase 1: Verlauf, Diff, Rollback

Jedes Deployment ist ein Datensatz: wer, wann, eine Notiz, die exakten Bytes und was sich geändert hat. „Was hat sich geändert, wer hat es geändert, setzt es zurück“ ist das Erste, was jeder fragt, wenn eine Linie steht, und heute sind die Antwort drei `.bak`-Dateien.

- [x] Deployment-Protokoll: Jedes Deployment ist ein unveränderlicher Datensatz mit Benutzer, Zeit, einer optionalen Notiz, den Flow-Bytes und den verschlüsselten Zugangsdaten, wie sie waren. Die Aufbewahrung ist eine Einstellung. `GET /deployments`
- [x] Semantischer Diff: Knoten für Knoten, Eigenschaft für Eigenschaft. Hinzugefügt, entfernt, geändert, neu verdrahtet. Einen Knoten zu verschieben erscheint als Layout, nie als Logikänderung. Über die API und als `hotloop-flow diff a.json b.json`
- [x] Der Diff funktioniert als git-Difftool, sodass ein Pull Request auf einen Flow „Schwellwert von Regel 2 von 7,5 auf 8,0“ sagt statt eines JSON-Blocks
- [x] Rollback: stellt einen alten Datensatz als neuen wieder her, Zugangsdaten eingeschlossen, sodass ein gelöschter Knoten mit dem Passwort seines Brokers zurückkommt. Der Verlauf bleibt nur anfügbar
- [x] Editor: Verlaufsbereich, der Diff auf der Zeichenfläche, „prüfen und deployen“ mit einer Notiz, ein Rollback-Button. Ein Deployment-Konflikt zeigt, was die andere Person geändert hat, statt eines Ja/Nein-Fensters
- [x] Flows als Code: `hotloop-flow deploy` und `hotloop-flow export` für CI/CD, mit einem reinen Deploy-Token, damit eine Pipeline nie ein Administratorpasswort hält
- [x] Optionaler git-Spiegel: jedes Deployment als Commit gepusht, verfasst von dem, der deployt hat. Reines Go, und die Prüfung der Binärgröße besteht weiterhin
- [x] Audit-Protokoll: Anmeldungen, fehlgeschlagene Anmeldungen, Deployments, Rollbacks und Injects, jeweils mit wer und von wo. Das Deployment-Protokoll ist seine erste Tabelle
- [x] MFA (TOTP), kostenlos und für jeden zuschaltbar, der sie will. Nichts, was mit sicherer Anmeldung zu tun hat, wird je kostenpflichtig
- [x] Begrenzung der Anmeldeversuche und Sperre, Sitzungen, die einen Neustart überstehen, und das Websocket-Token als Subprotokoll statt in der URL gesendet. Ein Token in der URL funktioniert für bestehende Skripte weiterhin und protokolliert eine Warnung, weil sie bei einem Upgrade zu brechen schlimmer war als das Leck; das Entfernen wartet auf eine Hauptversion

### Phase 2: Flow-Tests

„Hat meine Änderung die Linie kaputt gemacht?“ wird vor dem Deployment beantwortet, nicht danach. Tests sind YAML neben den Flows, also werden sie auf dieselbe Weise verglichen und geprüft.

- [x] `hotloop-flow test`: die echte Laufzeit und die echten Knoten, im selben Prozess. Eine Nachricht einspeisen, erwarten, was innerhalb einer Frist aus einem Port kommt, nichts erwarten, erwarten, dass ein Fehler bei einem Catch ankommt. JUnit-Ausgabe für CI/CD
- [x] Virtualisierte I/O: Ein MQTT out, ein Datenbankschreibvorgang oder eine HTTP-Anfrage in einem Test zeichnet auf, was gesendet worden wäre, und berührt nie das Netzwerk
- [x] Virtuelle Uhr: Ein Delay von fünf Minuten läuft in Millisekunden, und jeder Zeitknoten ist dagegen belegt
- [x] Kontext- und Zugangsdaten-Fixtures und Assertions auf den Kontext danach. Ein Test kann sich nicht auf das stützen, was ein anderer hinterlassen hat
- [x] Deploy-Gate: Wenn es an ist, wird ein Deployment, dessen Tests scheitern, mit den fehlschlagenden Assertions abgelehnt, und die bereits laufenden Flows merken nichts
- [x] Editor: Eine aufgezeichnete Debug-Meldung mit zwei Klicks in einen Test verwandeln, die Suite aus dem Editor ausführen, Bestanden und Fehlgeschlagen auf den Knoten

### Phase 3: Tracing und Replay

- [x] Klicken Sie auf eine Debug-Meldung, und die Zeichenfläche leuchtet den Weg aus, den sie genommen hat, mit Zeit und Payload an jeder Station, durch Aufteilungen, Zusammenführungen und Subflows
- [x] Begrenzter Trace-Puffer. Der Speicher bleibt in einem Dauertest mit einer Million Nachrichten flach, und die Zahl wird veröffentlicht
- [x] Eine aufgezeichnete Nachricht in einen Entwurf des Flows einspielen und die Ausgabe vergleichen
- [x] Ein aufgezeichneter Trace wird zu einem Test aus Phase 2
- [x] OpenTelemetry-Export, gegen einen echten Collector belegt

### Phase 4: dauerhafter Zustand

Ein Historian, der eine Stunde ausfällt, sollte Sie keine Stunde Messwerte kosten.

- [x] Persistenter Kontext in SQLite, reines Go ohne cgo, mit den atomaren Operationen (Compare-and-Swap, Inkrement, Update). Ein Speicher für den Kontext jetzt und die dauerhaften Warteschlangen danach, nicht zwei. Heute sind Flow- und globaler Kontext bei jedem Neustart weg, die Lücke, die am ehesten zuerst jemanden beißt. Verzögert geschrieben, in einer Transaktion alle dreißig Sekunden, und ein Wert, der auf das gesetzt wird, was er schon war, schreibt nichts
- [x] Dauerhafte Verbindungen: Markieren Sie eine Verbindung als dauerhaft, und ihre Warteschlange läuft in denselben Speicher über, statt zu blockieren oder zu verwerfen. Sie übersteht einen Neustart, behält die Reihenfolge, hält eine Plattenquote ein, und die Tiefe ist eine Metrik. In der Flow-Datei mit `ew_durable` markiert, sodass das Hin-und-zurück byte-genau bleibt. Doppelklicken Sie im Editor auf eine Verbindung, um sie zu markieren
- [x] Store-and-Forward auf die harte Tour belegt: das echte InfluxDB zehn Minuten lang unter gleichmäßiger Eingabe abschießen, wieder hochholen, Zeilen zählen. Keine fehlt, keine doppelt. Dann kill -9 auf die Laufzeit mitten in der Warteschlange und noch einmal zählen. Das Skript, die Zahlen und die Plattenschreibvorgänge pro Stunde stehen in [durable/](/de/flow/durable-state/)
- [x] Auf einem echten Pi 5 belegt: Speicher, Startzeit und anhaltender Durchsatz, in [docs/bench](/de/flow/benchmarks/#ergebnisse-auf-einem-raspberry-pi-5), mit der Drosselung, die er zeigte
- [ ] Belegt auf einem Pi 4 und einem Zero 2 W, und die Schreibvorgänge pro Stunde auf einer SD-Karte, weil ein Kontextspeicher, der eine SD-Karte auffrisst, ein Fehler ist. Offen, weil es die Boards braucht. Der Pi 5 ist gemessen; eine Zahl von einem anderen Gerät wäre erfunden

### Phase 5: die Fertigung

`scan` findet heute eine SPS, und nichts in der Palette kann mit ihr sprechen. Das ist das größte Loch in einem Produkt, das für Werke gebaut ist.

- [x] Modbus TCP lesen und schreiben
- [x] OPC UA lesen, abonnieren und schreiben
- [x] S7 lesen und schreiben
- [x] Sparkplug B, als Edge Node und als Host
- [x] EtherNet/IP lesen und schreiben
- Alles mit Simulatoren. Keine Siemens-CPU und keine Logix-Steuerung hat je etwas davon vor sich gehabt
- [x] HotLoop-Knoten: Entitätsänderungen als Eingang, Entitätszustand, ein Skript aufrufen, ein Rezept anwenden. Jeder Befehl läuft durch das Schreib-Gate von HotLoop und landet in dessen Logbuch als `flow:<node id>`, und ein Schreibvorgang, den das Gate ablehnt, kommt mit dem Grund des Gates bei einem Catch-Knoten an
- [x] Wenn HotLoop da ist, laufen die Geräteschreibvorgänge von Flow durch das Gate von HotLoop statt direkt zur SPS. Beides kam mit 2.3.0. Ein Schreibvorgang durch das echte Gate ist für Modbus gegen ein veröffentlichtes HotLoop-Image belegt; die Schreibknoten für OPC UA, S7 und EtherNet/IP senden über denselben Code, und ein Test prüft, dass jeder das Gate anbietet.

### Phase 6: Plugins ohne npm

- [x] Ein `wasm`-Knoten auf dem Host, den es schon gibt: harte Speichergrenze, ein Timeout, und ein Gast, der eines von beiden überschreitet, bricht ab, ohne etwas anderes mitzureißen
- [x] Plugin-Format: das Modul, ein Deskriptor, damit der Editor seinen Dialog zeichnet, und eine Signatur. Unsignierte oder manipulierte Plugins weigern sich zu laden und sagen, warum
- [x] Fähigkeiten: Ein Plugin hat keinen Hostzugriff, es sei denn, sein Manifest fragt danach und der Betreiber gewährt es. Etwas nicht Gewährtes anzufordern lässt das Deployment scheitern

### Phase 7: typisierte Verbindungen und MCP

- [x] Schemavalidierung am `json`-Knoten, der erste Teil
- [x] Optionale Schemas an Ports. Eine Abweichung, die der Editor sieht, wird beim Deployment abgelehnt; eine, die er nicht sieht, geht an einen Catch-Knoten mit dem Pfad des fehlerhaften Felds und an eine Metrik
- [x] Typen im Editor auf die Verbindungen gezeichnet
- [x] Flows als MCP-Werkzeuge: Ein Werkzeugknoten deklariert einen Namen, eine Beschreibung und ein Eingabeschema, und Flow stellt `/mcp` bereit. Ein Agent, der einen Flow aufruft, bekommt dieselben Berechtigungen und dasselbe Audit-Protokoll wie ein Mensch
- [x] Ein MCP-Client-Knoten, damit ein Flow Werkzeuge anderer Server aufrufen kann, auch die von HotLoop
- [x] Flows eigene MCP-Werkzeuge: Flows auflisten, lesen, deployen und zurückrollen, die Deployments auflisten und einen Inject-Knoten auslösen, über die eigenen Handler der Admin-API mit denselben Berechtigungen, Deploy-Prüfungen und Audit-Spuren, denn ein MCP, das nur aufrufen könnte, was ein Flow-Autor verdrahtet hat, könnte Flow selbst weder lesen noch schreiben
- [x] Flows eigene MCP-Werkzeuge für Diagramme und Messgeräte: Diagramme auflisten und lesen, eines ausführen und stoppen, seinen Debugger bedienen, ein Bedienelement auf seinem Panel setzen, Haltepunkte und Messpunkte setzen, ein Unterdiagramm anlegen, und die Schreibvorgänge eines Messgeräts lesen und umschalten, jedes als Admin-Route, die von ihrem eigenen Handler mit der Berechtigung ausgeführt wird, die diese Route verlangt (`status.read`, `diagram.run`, `instrument.write`). Bisher hatten die Diagramm-Routen kein Werkzeug, sodass ein Agent ein Diagramm deployen, aber nicht ausführen konnte. Jede Admin-Route ist jetzt ein Werkzeug oder wird in einem Test als eine benannt, die ein Mensch erledigen muss, und der Test scheitert, wenn eine neue Route ohne eines hinzukommt. Jetzt sind es 44 Werkzeuge, mit denen für Stationen, Failover und Traces

### Phase 8: der Editor, neu in Astro

Fertig, und vorgezogen. Er sollte zuletzt kommen, und wir haben ihn vor die ersten Screenshots von Flow gezogen, weil niemand die ersten in einem Editor sehen sollte, der aussieht, als käme er von einer anderen Firma.

Jedes HotLoop-Projekt bekommt eine moderne Oberfläche, und dieser Editor war der, der nicht passte. Er war von Hand gebautes Vanilla-TypeScript auf nativem SVG, was die richtige Entscheidung war, als das Ziel eine kleine statische Binärdatei ohne etwas zum Prüfen war. Jetzt ist er Astro mit Svelte-Inseln, derselbe Stack wie der Editor von Cascade, auf denselben HotLoop-Tokens, hell und dunkel.

- [x] Zuerst ein Designdurchgang, vor einer einzigen Zeile Astro. Wie der Editor neben dem Rest von HotLoop aussehen und sich anfühlen soll, auf Papier und in den gemeinsamen Tokens festgelegt, damit die Neufassung etwas baut, was schon jemand entschieden hat, statt unterwegs zu entscheiden
- [x] Der Editor in Astro neu aufgebaut, mit Zeichenfläche, Dialogen, Verlauf, Prüfung, Tests, Tracing, Suche und Gruppen übernommen, und keines davon darf schlechter werden. Die Browser-Tests in `web/e2e` sind die Messlatte: Sie laufen unverändert gegen den neuen Editor durch
- [x] Weiterhin in die eine statische Binärdatei eingebettet, weiterhin ohne Netzwerk auf einer Edge-Box, weiterhin innerhalb des Größenbudgets der Binärdatei, und das Lizenz-Gate deckt weiterhin alles ab, was im Bundle ausgeliefert wird

Die Zeichenfläche und der Graph darunter wurden nicht neu geschrieben. Sie zogen als das TypeScript, das sie waren, nach `web/src/lib` um, mit neuer Oberfläche, sodass Verdrahtung, Ziehen, Rückgängig und das byte-genaue Hin-und-zurück der Flow-Datei der bereits getestete Code sind. Alles drumherum ist Svelte.

Flow bleibt dabei ein eigenes Produkt. Es teilt das Aussehen mit HotLoop, nicht den Code, und ist nie in HotLoop eingebettet.

### Phase 9: FlowLab, Diagramme

Eine zweite Art, einen Tab auszuführen, neben den Nachrichten und nie an ihrer Stelle. In einem Diagramm läuft jeder Knoten einmal, wenn jeder seiner verdrahteten Eingänge einen Wert hat, und Zweige ohne Verbindung zwischen ihnen laufen gleichzeitig. Das braucht ein Prüfstand oder ein Datenlogger: Schleifen, die einen Wert von einem Durchlauf zum nächsten tragen, ein Fehler, der auf einer eigenen Verbindung reist, ein Panel, das ein Bediener auf dem Telefon öffnen kann, und ein Debugger, der einen Lauf anhalten und zeigen kann, was auf jeder Verbindung liegt. Bestehende Flows ändern sich nicht, und die Flow-Datei wird weiterhin Byte für Byte geladen und gespeichert: Ein Diagramm ist ein Tab mit einem `ew_diagram`-Schlüssel, und welcher Eingang eine Verbindung aufnimmt, steht in `ew_in` an dem Knoten, den sie verlässt. [FlowLab](/de/flow/flowlab/) hat den Rest.

- [x] Der Scheduler: alle verdrahteten Eingänge bereit, unabhängige Zweige parallel, und eine `after`-Verbindung für die Reihenfolge, wo keine Daten fließen
- [x] While- und For-Schleifen mit mitgeführten Werten, und eine Fehlerverbindung, die die Knoten nach einem Fehler überspringt, eine Schleife stoppt und ihre Quelle und ihren Code trägt
- [x] Ein serieller Port, mit Lesen bis zu einem Terminator oder einer Bytezahl, einem Timeout auf der Fehlerverbindung und einem Port, der nach einem gezogenen Kabel neu geöffnet und gezählt wird
- [x] Ein Messwert-Parser, Erkennung stabiler Werte und ein Textprotokoll mit Zeitspalte
- [x] Ein von Flow bereitgestelltes Panel: Bedienelemente, Anzeigen und ein Diagramm oder eine Kurve, auf einem Telefon offen, während ein Lauf live ist, mit einem zweiten Beobachter auf dem Desktop, jeder folgt dem Lauf innerhalb einer Sekunde
- [x] Ausführen, Stoppen, Ausführung hervorheben, Messpunkte auf jeder Verbindung, Haltepunkte auf Knoten, Verbindungen und Durchläufen, und Einzelschritt hinein, darüber und heraus
- [x] Der Editor zeichnet benannte Ports und Verbindungen zu dem, auf dem Sie loslassen, und dieselbe Seite führt aus und debuggt
- [x] Case-Struktur, Records und gemeinsame Typen, Wellenformen
- [x] TDMS- und Binär-Logging sowie Datenbank- und MQTT-Ausgang
- [x] Messgerät-Sitzungen, über rohen Socket und seriell, gegen einen Simulator und ein pty belegt
- [ ] Ein Datenerfassungs-Client, belegt gegen den eigenen Server von NI. Er ist gebaut und ausgeliefert und nur gegen einen Ersatzserver getestet, bleibt also offen, bis er gegen den Server von NI und ein Gerät gelaufen ist
- [x] Analyse: Statistik und Filter
- [x] Unterdiagramme, eine Fehlerliste in CI/CD, und die Zoom- und Layout-Arbeit des Editors
- [x] Wiedergabe eines beendeten Laufs: Jeder Knotenstart und -ende und jeder Verbindungswert wird aufgezeichnet, und die Diagrammleiste spielt den letzten Lauf auf der Zeichenfläche ab. `GET /diagrams/{id}/trace`, das Werkzeug `get_diagram_trace`
- [x] Eine Datenbank-Senke, die behält, was eine Datenbank verpasst: `postgres out`, dauerhaft, in Reihenfolge und in Stapeln geschrieben, sobald die Datenbank zurück ist, belegt auf einer echten TimescaleDB
- [x] Eine Flow-Datei und damit einen Satz Diagramme an jede Flow-Installation schicken, die ein Tenant in EmberNet betreibt, mit einer Prüfung nach jeder und einer gescheiterten, die zurückgesetzt wird ([Senden an die Stationen eines Tenants](/de/flow/stations/)), belegt auf drei echten Flow-Prozessen
- [ ] Einen Tag lang auf einem Pi belegt, was das Board und einen langen Lauf braucht

---

## Alltägliche Lücken

Diese laufen neben den Phasen her. Niemand wählt eine Flow-Engine, weil sie sie hat, aber viele lassen eine fallen, die sie nicht hat.

- [x] Teil-Deployment: Nur geänderte Knoten und ihre Verbindungen starten neu. Heute wirft jedes Speichern alle MQTT-Sitzungen und alle Nachrichten im Flug weg, was Bedienern beibringt, während einer Schicht nicht zu deployen
- [x] JSONata, gegen die veröffentlichten Beispiele belegt, weil ein importierter Flow daran am häufigsten stolpert
- [x] Inject nach Cron-Art
- [x] Rückgabemodus von Link Call und Link Out
- [x] Join per Timeout und Reduce, Batch nach Zeit, Split als Stream
- [x] MQTT v5 und Last Will
- [x] TLS über TCP, Cookies und Multipart bei HTTP
- [x] Editor: Kopieren und Einfügen, Import und Export einer Auswahl, Bearbeiten von Subflows und Gruppen, Suche über Flows hinweg, Debug-Filterung
- [x] Editor-Lücken, die der erste Durchgang ließ: einen Konfigurationsknoten aus der Palette hinzufügen (der Dialog sagte es, und man konnte es nicht), eine Auswahl in einen Subflow umwandeln, einen Flow umbenennen und löschen, und eine Verbindung per Doppelklick als dauerhaft markieren
- [x] Ein Ausweg für eine Nachricht, die das Ziel einer dauerhaften Verbindung für immer ablehnt: ein optionales Versuchslimit pro Verbindung. Nach so vielen Ablehnungen geht die Nachricht als Fehler mit angehängter Nachricht an den Catch des Flows, und die Verbindung läuft weiter. Standardmäßig aus, sodass eine Verbindung genau wie vorher festhält und es erneut versucht
- `store.*` war durch die Arbeit an der Dauerhaftigkeit schon da und hat jetzt dieselbe Prüfung
- [x] Ein Knoten, der auf einen Konfigurationsknoten zeigt, der nicht in der Datei ist (ein Flow, der mit seinem eigenen Broker gelöscht wurde, während ein Subflow, eine Handbearbeitung oder ein Import ihn noch nennt), wird von `hotloop-flow import`, im Editor beim Laden und beim Deployment und in der Deployment-Antwort gemeldet, und der Knoten ist ein Startfehler statt eines Knotens, der stillschweigend nie funktioniert
- [x] Die Lücken, die dieser ließ: Eine Konfigurationsreferenz, die einen Tab, einen Subflow, eine Gruppe, einen normalen Knoten oder den falschen Typ Konfigurationsknoten nennt, wird gemeldet und scheitert beim Start wie eine, die nichts nennt, ein Rollback legt die Warnungen der Datei einmal und nicht zweimal ins Editor-Protokoll, und `hotloop-flow import` schreibt seinen Bericht wie `deploy` in einen Writer, sodass seine Tests aufhören, die Standardausgabe auszutauschen
- Das ursprüngliche Projekt hat die Zeile noch; wir haben nicht darum gebeten, die Änderung zu übernehmen
- [x] Der Purge-Test der dauerhaften Verbindung konnte einen Verworfenen mehr zählen, als er als eingereiht abgetastet hatte. Der Test war falsch, nicht die Warteschlange: Er wartete auf 28 von 30 Nachrichten auf der Platte und hielt den Purge dann auf genau das, was er gesehen hatte, während der Spool die letzten noch zählte. Wie viele der 30 auf der Platte sind, wenn die Verbindung geht, hängt vom Timing ab, also hält er den Purge jetzt auf das Gesehene als Untergrenze und auf die 30 gesendeten als Obergrenze
- [x] Der Kill-Test der dauerhaften Verbindung bestand lokal und scheiterte auf einem langsameren Runner. Die Warteschlange zählte eine Nachricht als wartend, bevor sie auf der Platte war, sodass eine Kopie, die genau dann gezogen wurde, als der Zähler 100 erreichte, um eine zu kurz sein konnte. Jetzt zählt sie nach dem Commit
- [x] Der Editor, der Knotentext und die Dashboard-Seite in 13 Sprachen außer Englisch, mit einem gemeinsamen Glossar
- [x] Kafka out sowie ntfy, gotify und discord out, mit den Benachrichtigungseinstellungen, die der Kern schon hat
- [x] Eine dauerhafte Verbindung zu InfluxDB holt in Stapeln von bis zu 256 auf, sodass ein Rückstau von einer Stunde in Sekunden statt Minuten abgebaut wird
- [x] Die Node-RED-Konnektorknoten, die eine Werksmigration braucht (Modbus-Server an einer Netzwerkschnittstelle, E-Mail, postgres und die Dashboard-Knoten), nativ ausgeführt
- [x] Chart-Werte und eine Render-Prüfung für das Senden an Stationen
- [x] Secrets per Referenz: Ein Knoten liest ein Passwort aus einem eingebundenen Kubernetes-Secret oder einer Datei, sodass es nie in der Flow-Datei steht
- [x] Bringen Sie Ihre Flows mit: `hotloop-flow import` meldet weiterhin genau, was laufen wird und was nicht, bevor irgendetwas deployt wird. Es listet die Knotentypen, die laufen, die, die mit einem Unterschied laufen, und welcher es ist, die, die nicht starten werden, und einen Knoten, der auf einen Konfigurationsknoten zeigt, der nicht in der Datei ist

## Später

- [x] Aktiv/Standby: ein Lease in einem PostgreSQL mit einer Fencing-Nummer, ein Fence auf jedem Schreibvorgang an Anlagen, und ein Standby, der seine Schreibvorgänge zurückhält, bis er den Lease übernimmt ([Warmer Standby mit Lease](/de/flow/failover/)). Belegt auf zwei echten Flow-Prozessen gegen ein echtes PostgreSQL und einen Modbus-Server, der jeden Schreibvorgang protokolliert: mitten im Strom abgeschossen, eingefroren und aufgetaut und sauber gestoppt, ohne einen Schreibvorgang von beiden. Der Kontext bleibt auf der Platte jeder Installation und nicht in Postgres, was die erste Skizze war und nicht nötig ist, um zwei Schreiber auseinanderzuhalten

## Entschieden

Jede Frage, die diese Liste früher trug, ist beantwortet. Sie bleiben hier mit den Antworten, denn die Gründe sind es, die verhindern, dass jemand sie wieder aufmacht.

Entschieden am 2026-10-03:

- **Industrielle Knoten werden in Flow gebaut,** auf denselben Open-Source-Bibliotheken, die die HotLoop-Treiber nutzen. Die Treiber von HotLoop bleiben die von HotLoop. Flow behält seine eigene Lizenz, die zum Zeitpunkt der Entscheidung eine andere war und jetzt die HotLoop Source License Agreement 1.0 ist, die die EmberNet Source License 1.0 und davor die Business Source License 1.1 ersetzt hat, die es seit 2.2.0 trug.
- **Flow bleibt ein eigenes Produkt und wird nie in HotLoop eingebettet.** Es läuft neben HotLoop und spricht von außen mit der API von HotLoop, was die HotLoop-Knoten aus Phase 5 tun, und das ist die ganze Beziehung.
- **Das README beginnt mit dem, was Flow tut.** „Die Fertigung verdrahten. Wie Code prüfen.“ Der Import vorhandener Flows steht weiter unten in „Bringen Sie Ihre Flows mit“, und nichts am Anfang vergleicht Flow mit irgendetwas. Flow steht für sich.
- **Persistenter Kontext ist von Anfang an SQLite,** reines Go ohne cgo. Ein Speicher für den Kontext jetzt und die dauerhaften Warteschlangen später, nicht erst ein Dateispeicher und danach ein zweiter.
- **Das Produkt für Workflow-Automatisierung ist eine eigene Sache** und teilt sich Flows Engine nicht. Verlauf, Diff und der Rest bleiben hier Engine-Pakete, weil API, CLI, Editor und git alle dieselbe Antwort bekommen müssen.

Entschieden, bevor Phase 1 begann:

- **MFA und das Audit-Protokoll kommen in Phase 1,** vor dem Spaßigen. Beides ist gekommen.
- **Das byte-genaue Hin-und-zurück vorhandener Flow-Dateien bleibt eine harte Regel,** auch mit Typen und Tests in der Datei. Neue Daten kommen in Schlüssel, die andere Werkzeuge ignorieren, und der Hin-und-zurück-Test deckt Dateien ab, die sie tragen.
- **Benchmarks sind nur absolute Zahlen,** jede mit dem Befehl, der sie erzeugt hat. Eine Tabelle zum Nebeneinanderstellen verschiebt sich jedes Mal, wenn sich das Gerät ändert, und beschreibt am Ende mehr die andere Engine als diese.
