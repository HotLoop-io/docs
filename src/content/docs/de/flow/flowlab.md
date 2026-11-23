---
title: "FlowLab: Prüfstände"
description: "Führen Sie einen Tab als Diagramm für Prüfstände und Datenlogger aus: Knoten mit Schleifen, Fehlerleitung, serielle Schnittstelle, Panel und Debugger."
---

FlowLab ist der Teil von Flow für Prüfstände und Datenlogger, und seine Einheit ist das Diagramm: die andere Art, wie Flow einen Tab ausführt. In einem Flow läuft eine Nachricht durch einen Knoten, und jeder Eingang weckt ihn. In einem Diagramm läuft jeder Knoten einmal pro Ausführung, wenn jeder Eingang mit einer Leitung einen Wert hat. Zwei Knoten ohne Leitung dazwischen laufen gleichzeitig. So bauen Sie einen Prüfstand oder einen Datenlogger: ein Gerät lesen, den Wert auswerten, entscheiden, ob er stabil ist, anzeigen, aufschreiben.

Flows bleiben von alldem unberührt. Ein Tab mit `ew_diagram` bleibt außerhalb der Nachrichten-Runtime, und jeder andere Tab läuft genau wie bisher.

Was das für Sie bedeutet: Sie zeichnen die Logik einmal, drücken Ausführen und sehen die Werte über die Leitungen wandern. Jeder mit der Panel-Adresse kann dieselbe Ausführung auf einem Telefon verfolgen.

## Die Datei

Ein Diagramm ist ein Tab mit einem `ew_diagram`-Objekt. Seine Knoten sind gewöhnliche Einträge der Flow-Datei. `wires` nennt den Knoten, zu dem eine Leitung führt, wie immer, und `ew_in` am Quellknoten gibt an, an welchem Eingang des Ziels jede Leitung ankommt, in derselben Form:

```json
{ "id": "a", "type": "dia-const", "z": "d", "value": "1", "x": 100, "y": 80,
  "ew_in": [["a"], []], "wires": [["sum"], []] }
```

Die Datei wird mit diesen Schlüsseln Byte für Byte geladen und gespeichert. Einstellungen des Tabs:

| Schlüssel | Was er bewirkt |
|---|---|
| `autostart` | `true` startet die Ausführung, wenn Flow startet und nach jedem Deployment, ohne dass ein Browser offen ist. |
| `role` | `"body"` für ein Diagramm, das eine Schleife ausführt. Ein Rumpf läuft nicht von selbst. |

Jeder Knoten hat außerdem einen optionalen Eingang `after` und einen Ausgang `done`. Verbinden Sie das `done` eines Knotens mit dem `after` eines anderen, und der zweite wartet auf den ersten, ohne dass etwas dazwischen liegt. Die Reihenfolge ist eine Leitung, die man sieht und per Diff vergleichen kann.

## Ausführung

Ein Diagramm läuft aus dem, was bereitgestellt ist. Öffnen Sie im Editor einen Diagramm-Tab und drücken Sie Ausführen. Die Leiste über der Zeichenfläche bietet:

- **Ausführung hervorheben**: Jeder Knoten wartet einen Moment, bevor er läuft, damit Sie folgen können, und die Leitung, über die ein Wert ging, leuchtet auf. Die Funktion schaltet sich nach zehn Minuten von selbst aus.
- **Pausieren, Fortsetzen, Hineingehen, Überspringen, Herausgehen**: Das Einzelschritt-Verfahren geht Knoten für Knoten. Überspringen führt den ganzen Rumpf einer Schleife aus. Hineingehen hält am ersten Knoten darin an.
- **Bei Auswahl unterbrechen**: ein Haltepunkt auf dem ausgewählten Knoten. Drücken Sie doppelt auf eine Leitung, um sie abzugreifen, was ihre letzten 100 Werte behält, oder um anzuhalten, wenn ein Wert darauf gelegt wird. Eine Sonde ändert nie eine Ausführung.
- **Panel öffnen**: die Seite des Bedieners.

Fahren Sie nach einer Ausführung über eine beliebige Leitung, um den letzten Wert zu sehen, den sie getragen hat. Die Schaltfläche für Probleme listet jeden Grund auf, warum ein Diagramm nicht laufen kann, jeweils mit Knoten und Eingang.

| Aufruf | Was er bewirkt |
|---|---|
| `GET /diagrams`, `GET /diagrams/{id}` | Was bereitgestellt ist, das Panel und der letzte Wert auf jeder Leitung. |
| `GET /diagrams/{id}/trace` | Was die letzte Ausführung getan hat, der Reihe nach: jeder Knoten, der gestartet oder beendet wurde, und jeder Wert, der über eine Leitung ging, mit den Millisekunden seit Beginn der Ausführung. Ein Diagramm, das seit der Bereitstellung nicht gelaufen ist, antwortet mit 404. |
| `POST /diagrams/{id}/run`, `/stop`, `/debug` | Braucht `diagram.run`. Jeder Aufruf steht mit dem Urheber im Audit-Protokoll. |
| `POST /diagrams/{id}/sub` | Senden Sie `{flows, nodes, name}` und erhalten Sie die Flow-Datei zurück, in der diese Knoten zu einem Unterdiagramm gemacht wurden. Liest und rechnet nur; nichts wird gespeichert oder bereitgestellt. |
| `PUT /diagrams/{id}/controls/{node}` | Setzt ein Bedienelement. Geprüft gegen Art, Bereich und Auswahl. |
| `PUT /diagrams/{id}/breakpoints`, `/probes` | Schlüssel sind eine Knoten-ID, `wire:<wire key>` oder `diagram:<tab>`. |

Ereignisse einer Ausführung gehen über denselben Socket wie die des Editors hinaus, als `diagram/<id>/node`, `token`, `run`, `paused` und `values`.

## Knoten

| Knoten | Was er tut |
|---|---|
| `dia-const`, `dia-math`, `dia-compare`, `dia-logic` | Werte und Arithmetik. Rechenoperationen arbeiten bei Arrays Element für Element. |
| `dia-wait` | Wartet und gibt dann seinen Eingang weiter. |
| `dia-bundle`, `dia-field`, `dia-array` | Datensätze und Arrays. |
| `dia-while`, `dia-for` | Schleifen. Der Rumpf ist ein eigenes Diagramm, benannt nach seinem Tab. Mitgeführte Werte starten an einer Leitung oder bei Start values und kommen so heraus, wie sie im letzten Durchlauf waren. Eine for-Schleife nimmt eine Anzahl oder ein Array. Eine while-Schleife läuft mindestens einmal. |
| `dia-case` | Fallstruktur. Der Wert an `selector` wählt einen Rumpf, der läuft, und nur dieser Rumpf läuft. Ein Boolean wählt `true` oder `false`, eine Zahl wählt den Fall dieses Werts, wie auch immer sie geschrieben ist, und ein String oder ein Enum wählt den Fall mit diesem Namen. Die Fälle sind ein JSON-Objekt aus Fallname und Diagramm, und ein Wert, den kein Fall nennt, führt den Standardfall aus. Ohne Standardfall legt der Knoten einen Fehler auf seine Fehlerleitung, und das Deployment warnt, dass es keinen Standardfall gibt (ein Boolean mit beiden Fällen ist ausgenommen). Jeder Rumpf muss jedes Ergebnis unter demselben Namen ausgeben, und ein Rumpf, der das nicht tut, ist beim Deployment ein Problem. Der Ausgang `case` sagt, welcher Fall lief. |
| `dia-body-in`, `dia-body-out` | Die beiden Enden eines Rumpfs. `iter` ist die Nummer des Durchlaufs. `stop` beendet eine while-Schleife. Der Name eines mitgeführten Werts schickt ihn in die nächste Runde. |
| `dia-serial-open`, `dia-serial-read`, `dia-serial-write` | Eine serielle Schnittstelle. Lesevorgänge enden an einem Endezeichen oder nach einer Bytezahl. |
| `dia-instr-open`, `dia-instr-query`, `dia-scpi-parse` | Ein Prüfgerät, per Adresse. Siehe Messgeräte weiter unten. |
| `dia-parse-reading`, `dia-stable` | Ziehen eine Zahl und eine Einheit aus einer Zeile und sagen, ob die letzten Messwerte übereinstimmen. |
| `dia-log-text` | Hängt einen Datensatz als Zeile an eine Textdatei an, mit einer Zeitspalte. |
| `dia-daq-read` | Liest Samples aus einer Messdatenerfassungs-Task auf NI-Hardware über den gRPC Device Server von NI. Siehe Datenerfassung weiter unten. |
| `dia-mqtt-out` | Veröffentlicht seinen Wert über einen MQTT-Server, den die Flow-Datei konfiguriert, dieselbe Verbindung, die die MQTT-Knoten nutzen. Markieren Sie ihn als dauerhaft, und eine Nachricht, die der Broker verpasst, wird auf die Platte geschrieben und der Reihe nach gesendet, wenn der Broker wieder da ist, auch über einen Neustart hinweg. |
| `dia-postgres-out` | Schreibt einen Datensatz als eine Zeile einer Tabelle in PostgreSQL oder TimescaleDB, über den Server, den die Flow-Datei konfiguriert, dieselbe Verbindung, die der postgres-Knoten nutzt. Markieren Sie ihn als dauerhaft, und eine Zeile, die die Datenbank verpasst, bleibt auf der Platte und wird der Reihe nach geschrieben, wenn sie wieder da ist. Siehe Eine Datenbank, die ausfällt weiter unten. |
| `dia-log-tdms` | Hängt einen Datensatz an eine TDMS-Datei an, ein Kanal pro Feld. Siehe weiter unten. |
| `dia-control`, `dia-indicator`, `dia-chart` | Das Panel. |
| `dia-stats` | Mittelwert, Effektivwert, Minimum, Maximum und Standardabweichung eines Arrays. Die Standardabweichung teilt durch n minus eins und braucht daher zwei Messwerte. |
| `dia-integral` | Die Fläche unter einem Array nach der Trapezregel, als eine Zahl oder als laufende Fläche an jedem Sample. |
| `dia-derivative` | Die Steigung an jedem Sample eines Arrays. |
| `dia-filter` | Ein Butterworth-Tiefpass, -Hochpass, -Bandpass oder -Bandsperre der Ordnung 1 bis 10 mit einer Grenzfrequenz in Hertz. |

### Filter

Der Filterknoten ist ein Butterworth-Filter: flach im Durchlassbereich, ohne Welligkeit und bei der Grenzfrequenz 3 dB tiefer. Er wird aus dem analogen Filter mit der bilinearen Transformation entworfen, wobei die Grenzfrequenz vorverzerrt wird, damit der 3-dB-Punkt auf der eingegebenen Frequenz liegt, und er läuft als Kette von Abschnitten zweiter Ordnung, damit eine hohe Ordnung genau bleibt. Ein Bandpass oder eine Bandsperre der Ordnung n hat 2n Pole. Eine Grenzfrequenz muss über null und unter der halben Abtastrate liegen, und ein Entwurf, der sich nicht bauen lässt, steht vor der Ausführung in den Problemen. Die Abtastrate ist eine Eigenschaft oder ein Eingang, der sie übersteuert. Der Filter behält sein Gedächtnis von Aufruf zu Aufruf innerhalb einer Ausführung, sodass ein von einer Schleife in Stücke geschnittenes Array herauskommt, als wäre es am Stück gefiltert worden, und jede neue Ausführung beginnt im Ruhezustand.

Was er nicht kann: Er ist kein linearphasiger Filter, verzögert also verschiedene Frequenzen unterschiedlich stark, und er hat keinen nullphasigen Modus, der vorwärts und rückwärts filtert. Wo das Timing zwischen zwei Signalen stimmen muss oder die Form einer Welle erhalten bleiben soll, ist das der falsche Filter. Integral und Ableitung nehmen die Zeit zwischen den Samples aus einem Eingang `dt` in Sekunden, einem Eingang `rate` in Hertz oder der Eigenschaft Samples per second.

### Protokoll in TDMS

`dia-log-tdms` schreibt die Messungen eines Prüfstands in eine TDMS-Datei, das Format, das Werkzeuge für Datenerfassung und Analyse öffnen. Verbinden Sie einen Datensatz mit `row`. Jedes Feld des Datensatzes ist ein Kanal in einer Gruppe, ein Datensatz aus `pressure`, `ok` und `operator` ergibt also drei Kanäle. Eine Zahl wird als 64-Bit-Float gespeichert, wahr oder falsch als Bool und alles andere als Text. Ein Feld mit einer Liste von Zahlen hängt die ganze Liste an, so kommt ein Block von Samples hinein. Einstellungen:

| Einstellung | Bedeutung |
|---|---|
| `path` | Die Datei. An eine vorhandene Datei wird angehängt, sodass Ausführung nach Ausführung eine einzige Datei aufbaut. |
| `group` | Die Gruppe, in die die Kanäle kommen. |
| `columns` | Die zu protokollierenden Felder, der Reihe nach. Leer protokolliert jedes Feld, nach Namen. |
| `properties` | Ein JSON-Objekt mit Eigenschaften für die Datei, etwa `{"title": "bench 4", "station": 4}`, geschrieben beim Start der Ausführung. |
| `sync` | Standardmäßig an: Jede Zeile erreicht die Platte, bevor der Knoten fertig ist. |

Jede Zeile ist ein Segment und wird in einem Stück geschrieben. Fällt mitten in einer der Strom aus, zeigt die Datei, wo sie abgeschnitten wurde, ein Leser gibt jede Zeile davor zurück, und die nächste Ausführung repariert das Dateiende und macht weiter. Der Typ eines Felds wird von der ersten Zeile einer Ausführung festgelegt. Eine spätere Zeile, die nicht passt, etwa Text in einer Zahlenspalte, geht als fehlerhafte Eingabe auf die Fehlerleitung, und die Datei bleibt unverändert. Eine fehlende Zahl wird als Not-a-Number geschrieben.

Zum Öffnen der Datei genügt jeder TDMS-Leser. Kanaleigenschaften wie `unit_string` und die Wellenform-Eigenschaften `wf_start_time`, `wf_increment` und `wf_samples` werden von der Bibliothek unterstützt; der Knoten setzt sie noch nicht.

Was der Leser akzeptiert: Little-Endian- und Big-Endian-Segmente, verschachtelte und zusammenhängende Daten, Metadaten, die in einem Segment fehlen, wenn sie sich nicht geändert haben, eine neue Objektliste, 8-, 16-, 32- und 64-Bit-Ganzzahlen, 32- und 64-Bit-Floats, Bools, Text und Zeitstempel. Was er ablehnt, mit Namen und ohne die Datei halb zu lesen: Rohdaten, die ein Datenerfassungstreiber geschrieben hat, skalierte oder komprimierte Daten, Floats mit erweiterter Genauigkeit, Festkomma- und komplexe Zahlen. Was der Schreiber schreibt: Little Endian, zusammenhängende Daten und dieselben Typen. Big Endian schreibt er nicht.

### Die Fehlerleitung

Knoten, die mit der Außenwelt sprechen, haben `err` als Eingang und `err` als Ausgang. Ein Fehler ist ein Datensatz: ein Flag, ein numerischer Code, der Quelltext und der Knoten, von dem er kommt. Ein Knoten mit einem eingehenden Fehler tut keine Arbeit und gibt den Fehler weiter, ein Fehler am Anfang einer Kette überspringt also alles danach und erscheint nur einmal am Ende. Verbinden Sie einen Fehler mit dem Rumpf-Ausgang `err` einer Schleife, und die Schleife hält daran an, mit dem Fehler am Fehlerausgang der Schleife. Eine Fehleranzeige im Panel wird bei einem Fehler rot und erlischt, wenn der nächste Wert ohne Fehler eintrifft.

### Ein Ziel, das ausfällt

Ein dauerhaftes `dia-mqtt-out` sendet direkt an den Broker, solange er antwortet. Antwortet er nicht, wird die Nachricht im dauerhaften Speicher von Flow festgeschrieben, bevor der Knoten fertig ist, und eine Pumpe liefert die Warteschlange, die älteste zuerst, wenn die Verbindung zurück ist. Was hineinkommt, während andere warten, reiht sich dahinter ein, nichts überholt also etwas. Die Zustellung aus der Warteschlange erfolgt mindestens einmal: Eine Nachricht, deren Senden abgelaufen ist, weil der Client den Verbindungsverlust nicht bemerkt hatte, kann trotzdem zugestellt werden, wenn sich der Client wieder verbindet, sie kann also zweimal ankommen, einmal für jedes abgelaufene Senden. Die Warteschlange liegt im selben Speicher und unter derselben Plattenquote wie eine dauerhafte Leitung und leert sich nach einem Neustart ohne Ausführung und ohne Browser. Ohne dauerhaft ist eine Nachricht, die der Broker verpasst, ein Fehler auf der Fehlerleitung.

### Eine Datenbank, die ausfällt

`dia-postgres-out` schreibt jeden Datensatz, den es erhält, als eine Zeile in die Tabelle, die Sie nennen, über einen `hotloop-flow-postgres`-Server. Die Felder eines Datensatzes gehen in die Spalten gleichen Namens, ein Datensatz mit `n` und `sensor` füllt also die Spalten `n` und `sensor`. Listen Sie die Spalten, durch Komma getrennt, um nur einige zu schreiben oder ihre Reihenfolge festzulegen; lassen Sie die Liste leer, und der Knoten nutzt die Felder des Datensatzes. Der Knoten läuft bei jedem Durchlauf einer Schleife, eine Schleife schreibt also eine Zeile pro Durchlauf. Eine Tabelle oder Spalte, die kein schlichter Name ist, ist beim Deployment ein Problem, nie eine Anweisung mitten in einer Ausführung. Eine ganze Zahl geht gleichermaßen in eine integer-, float- oder numeric-Spalte, und ein Datensatz oder ein Array geht unverändert hinein, was eine json- oder jsonb-Spalte annimmt.

Nennen Sie eine **Zeitspalte**, und jede Zeile erhält die Zeit, zu der sie am Knoten ankam. Das ist die Zeit, zu der der Messwert entstand, nicht die, zu der er geschrieben wurde: Eine Zeile, die fünf Minuten auf der Platte gewartet hat, trägt weiter die Minute, in der sie entstand.

Ohne **Behalten, was die Datenbank verpasst** ist eine Zeile, die die Datenbank nicht annimmt, ein Fehler auf der Fehlerleitung des Knotens und geht verloren. Mit der Option geht die Zeile direkt hinein, solange die Datenbank antwortet. Antwortet die Datenbank nicht, wird die Zeile im dauerhaften Speicher von Flow festgeschrieben, bevor der Knoten fertig ist, und der Ausgang `sent` des Knotens meldet `false`. Die Zeilen warten auf der Platte, überstehen einen Neustart und werden der Reihe nach geschrieben, sobald die Datenbank zurück ist, ohne dass etwas, das danach hineinkommt, sie überholt. Ein Rückstau wird mit vielen Zeilen pro Anweisung geschrieben, bis zu 256, sodass einer, der sich während der Abwesenheit der Datenbank aufgebaut hat, in Sekunden aufgeholt ist und nicht im Tempo eines Roundtrips pro Zeile. Der Test lässt 30.000 Zeilen auf der Platte warten, die Menge von fünf Minuten bei 100 pro Sekunde, und alle werden binnen Sekunden nach der Rückkehr der Datenbank der Reihe nach geschrieben.

Die Zustellung von der Platte erfolgt mindestens einmal. Eine Zeile, deren Insert beim Abbruch der Verbindung gesendet wurde, kann mit verlorener Antwort festgeschrieben worden sein und wird erneut gesendet, kann also zweimal geschrieben werden, höchstens einen Stapel lang. Wenn das wichtig ist, geben Sie der Tabelle einen eindeutigen Schlüssel und wählen Sie bei Bei Konflikt **Die Zeile überspringen**: Die zweite verwirft dann die Datenbank.

Eine Zeile, die die Datenbank wegen ihres Inhalts ablehnt, etwa ein Wert, der für seine Spalte zu groß ist, oder ein Schlüssel, der schon da ist, wenn Bei Konflikt auf Einen Fehler auslösen steht, würde jedes Mal abgelehnt. Sie wird mit einem Audit-Ereignis, `diagram.row_rejected`, das die Zeile enthält, fallen gelassen, und die Zeilen dahinter werden geschrieben. Ohne das würde eine einzige schlechte Zeile das Protokoll aufhalten. Eine ausgefallene Datenbank, eine Tabelle, die noch nicht existiert, und ein falsches Passwort gehören nicht dazu: Diese Zeilen warten.

### Messgeräte

`dia-instr-open` nimmt eine Adresse: `10.0.0.5:5025` für ein LAN-Gerät an einem rohen Socket, `serial:///dev/ttyUSB0?baud=19200&data=8&parity=E&stop=1` für ein serielles oder ein einfaches `/dev/ttyUSB0` oder `COM3` für 9600 8N1. Die Ausführung schließt die Sitzung, wenn sie endet. Bricht die Verbindung ab, öffnet die nächste Abfrage sie erneut, und der Abbruch wird an der Sitzung mitgezählt.

`dia-instr-query` schreibt einen Befehl und das Endezeichen und liest dann die Antwort. Wählen Sie Text (eine Zeile, aus `reply`), none (ein einfaches Schreiben) oder block, das einen binären Block `#41024...` liest und die Samples aus `samples` als Array ausgibt, als int8, uint8, int16, uint16, int32, float32 oder float64, Big oder Little Endian. Ein unbestimmter Block `#0` endet am ersten Zeilenende. Eine Antwort, die nicht rechtzeitig kommt, ist ein Timeout auf der Fehlerleitung mit der Adresse.

`dia-scpi-parse` liest eine Textantwort als Zahlenliste, als eine Zahl, als Identität (`*IDN?` in Hersteller, Modell, Seriennummer und Firmware) oder als Statusbyte (`*STB?` oder `*ESR?`) in die Namen seiner gesetzten Bits.

### Seriell

Ein Port, der verschwindet, etwa durch ein gezogenes Kabel oder einen abgezogenen Adapter, ist ein Fehler auf der Fehlerleitung des Lesens. Der nächste Lesevorgang versucht ihn einmal pro Sekunde erneut zu öffnen und zählt den Verlust und die Rückkehr. Ein Port hat Flusskontrolle, keine, per Hardware (RTS und CTS) oder per Software (XON und XOFF), unter Linux am Terminal selbst eingestellt; ein Pseudoterminal zeigt, dass die Einstellung angekommen ist, und was die Leitungen an einem echten Adapter tun, ist nicht gezeigt worden.

### Datenerfassung

`dia-daq-read` liest eine Task von NI-Hardware, etwa einem CompactDAQ-Chassis, über NIs eigenen offenen gRPC Device Server. Flow spricht mit diesem Server über das Netzwerk, die Hardware kann also an einem anderen Rechner hängen als Flow, und Flow braucht keinen NI-Treiber und keine eigene Herstellerbibliothek. Es bleibt eine einzige statische Binärdatei.

**Auf dem Rechner, an dem die Hardware hängt**, installieren Sie NIs DAQmx-Treiber und NIs gRPC Device Server (https://github.com/ni/grpc-device, MIT-lizenziert). Der Server lauscht nur auf diesem Rechner (`localhost`, Port 31763), bis seine Konfigurationsdatei etwas anderes sagt. Um ihn von Flow auf einem anderen Rechner zu erreichen, setzen Sie `address` in seiner `server_config.json` auf `[::]` oder die gewünschte Schnittstelle und schalten Sie TLS ein, indem Sie `server_cert`, `server_key` und, für gegenseitiges TLS, `root_cert` setzen, mit den Dateien im Ordner `certs` neben der Konfiguration. Die README von NI nennt die Einzelheiten für Ihre Version. Lassen Sie den ungesicherten Standardport des Servers nicht in einem Werksnetz offen: Jeder, der ihn erreicht, kann die Hardware bedienen.

**Im Knoten** stellen Sie ein:

* `address` auf `host:port` des Servers.
* `tls` auf `off` (nur für einen Server auf demselben Rechner), `on` (Flow prüft das Zertifikat des Servers gegen `caFile` oder, wenn das leer ist, gegen die Zertifizierungsstellen des Systems) oder `mutual` (Flow legt zusätzlich `certFile` und `keyFile` vor, die der Server gegen sein `root_cert` prüft). `serverName` ist der Name, nach dem im Zertifikat des Servers gesucht wird, wenn er nicht der Host in `address` ist.
* `device` und `channels`, um die Hardware zu benennen, etwa `cDAQ1Mod1` und `ai0:3`, oder eine Liste wie `ai0, ai2`. `kind` ist `voltage`, `current` oder `thermocouple`, mit `min` und `max` für den erwarteten Bereich und `terminal` für die Verdrahtung. Thermoelemente nehmen einen `tcType` und eine `unit` und nutzen die Vergleichsstellenkompensation des Moduls selbst.
* `mode`, `rate` und `samples`. Der endliche Modus nimmt bei jedem Aufruf eine Erfassung von `samples` pro Kanal mit `rate` auf und startet sie jedes Mal neu. Der kontinuierliche Modus startet die Task beim ersten Aufruf, und jeder Aufruf liest die nächsten `samples`, sodass ein Knoten im Rumpf einer Schleife einen Strom Block für Block liest. `trigger` startet die Task an einer digitalen Flanke an einem Anschluss wie `/cDAQ1/PFI0`.

`y` sind die Samples als Array für einen Kanal oder ein Array aus Arrays, eines pro Kanal in der Reihenfolge, in der Sie sie genannt haben. `dt` sind die Sekunden zwischen den Samples, eins durch die Rate, die Länge eines Blocks in Sekunden ist also seine Samplezahl mal `dt`: 1.000 Samples bei 1.000 Samples pro Sekunde decken 1,000 s ab. Die Uhr des Geräts selbst gibt den Samples ihre Zeit, wie immer. Flow bewegt nur die Daten. Eine Ablehnung des Servers oder des Treibers kommt auf `err` mit dem eigenen Code und Text des Treibers heraus, und ein Server, der nicht innerhalb von `callTimeoutSec` antwortet, ist ein Timeout. Die Task lebt für die Ausführung und wird auf dem Server gelöscht, wenn die Ausführung endet, sodass die Hardware wieder frei ist.

Was fertig ist: analoger Spannungseingang, analoger Stromeingang und Thermoelement-Temperatur, endlich oder kontinuierlich, mit Abtasttakt und einem optionalen digitalen Starttrigger. Was nicht: Digitalein- und -ausgänge und Zähler nutzen andere Leseaufrufe und sind nicht gebaut, ebenso wenig Schreibvorgänge, andere Triggertypen oder Skalierung über das hinaus, was das Modul selbst tut.

Der Knoten ist gegen einen Ersatzserver gelaufen, der dieselben Aufrufe spricht und mit einer Sinuswelle antwortet, und auf echter Hardware (2026-11-17).

## Das Panel

`/panel/<diagram id>` auf einer Runtime öffnet eine Seite mit den Bedienelementen, Anzeigen und Diagrammen des Diagramms, angemeldet wie der Editor. Sie ist für den Daumen gebaut: Nichts darauf ist kleiner als ein Finger. Ein Chart behält seine letzten 1.024 Punkte, wenn Sie das nicht ändern, und sagt, wie viele es verworfen hat. Ein Graph ersetzt seine Daten mit jedem Array. Ein XY-Chart zeichnet x gegen y und behält ebenfalls einen Verlauf. Ein Intensitäts-Chart nimmt ein Raster, ein Array aus Zeilen von Zahlen, die alle gleich lang sind (bis 512 mal 512), und zeichnet jeden Wert als Farbe vom kleinsten bis zum größten darin, wobei er das Bild mit jedem Raster ersetzt; ein flaches Array oder ein unregelmäßiges Raster ist ein Fehler auf der Fehlerleitung des Knotens.

Mehrere Personen können eine Ausführung beobachten. Das Setzen eines Bedienelements im Browser braucht `diagram.run`, wird auf dem Server geprüft und ins Audit-Protokoll geschrieben.

## Bedienelemente

Ein `dia-control` hat eine **Art** (was es hält) und ein **Aussehen** (wie das Panel es zeichnet). Der Server prüft jeden Wert gegen die Art, egal welches Aussehen, sodass ein Skript, das `PUT /diagrams/{id}/controls/{node}` aufruft, denselben Regeln unterliegt wie ein Finger. Was ein Bediener einstellt, steht im Panel, sobald das Diagramm bereitgestellt ist, vor der ersten Ausführung, und der Bedienelement-Knoten gibt dem Diagramm bei jeder Ausführung diesen Wert.

| Art | Aussehen | Was das Diagramm liest |
|---|---|---|
| `number` | `entry` (getippt), `spin` (getippt, mit einer Minus- und einer Plus-Taste, die in Schritten von `step` gehen und am Bereichsende anhalten), `slider`, `knob` | eine Zahl, auf `min` und `max` begrenzt, wenn sie gesetzt sind |
| `bool` | `switch`, `button` (ein Druck setzt ihn auf true, und `latch` setzt ihn zurück, wenn das Diagramm ihn liest), `led` (eine LED, die man drückt) | wahr oder falsch |
| `string` | ein Textfeld | Text |
| `enum` | ein Dropdown aus `options` | eine der Optionen |
| `array` | eine Liste, der der Bediener Einträge hinzufügt und aus der er sie entfernt | eine Liste aus Zahlen, Schaltern oder Text, je nach `elem`; `min` und `max` begrenzen jede Zahl, und `maxlen` begrenzt die Länge |
| `record` | ein Eingabefeld pro Feld | ein Objekt mit genau den `fields` (`rate:number, on:bool, note:string`), jedes Feld immer vorhanden |

Ein slider und ein knob brauchen einen kleinsten und einen größten Wert. Ein knob ohne beide ist beim Deployment eine Warnung und wird als getippte Eingabe gezeichnet, bis er sie hat (ein slider tat das schon). Der knob ist ein Drehregler, der 270 Grad überstreicht: Ziehen Sie mit Maus oder Finger um ihn herum, drücken Sie darauf, um ihn dorthin zu setzen, oder nutzen Sie die Pfeiltasten (ein `step`), Bild auf und Bild ab (zehn Schritte), Pos1 und Ende. Er schreibt, wenn Sie loslassen. Der Startwert eines Arrays ist JSON (`[1, 2, 3]`) oder eine schlichte Liste mit Kommas (`1, 2, 3`), und der Startwert eines Datensatzes ist ein JSON-Objekt (`{"rate": 3}`); ein weggelassenes Feld startet leer. Ein Datensatz ohne Felder, ein unbekannter Feldname oder ein Startwert, der nicht passt, ist beim Deployment ein Problem.

Jede Schaltfläche, jedes Eingabefeld, jeder Schalter und jeder Regler im Panel ist in beiden Richtungen mindestens 44 Pixel groß, und die Seite scrollt auf einem Telefon mit 390 Pixeln nicht zur Seite.

Ein Bedienelement wird geschrieben, wenn es geändert wird, und das Diagramm liest es, wenn der Bedienelement-Knoten läuft; kein Bedienelement startet von sich aus eine Ausführung oder löst einen Knoten aus, wenn es sich ändert. Das wäre die Ereignisstruktur, und sie ist nicht gebaut.

## Was das nicht ist

Ein Diagramm läuft in einem Go-Prozess auf einem Allzweck-Betriebssystem. Garbage Collection und Scheduler können einen Knoten um Millisekunden verzögern, ein Knoten kann also keine Frist zusichern. Arbeit, die eine Frist einhalten muss, gehört in eine SPS oder eine dafür gebaute Runtime. Das Timing der Samples eines Datenerfassungsgeräts ist von alldem nicht betroffen: Das erledigt die Uhr des Geräts, und Flow bewegt nur die Daten.

## Tests eines Diagramms

Eine Flow-Testdatei kann neben den Nachrichtentests einen Test eines Diagramms enthalten. Er setzt die Bedienelemente des Diagramms, führt es einmal mit der echten Diagramm-Engine aus und sagt, was seine Anzeigen enthalten:

```yaml
tests:
  - name: weighs and flags a heavy load
    diagram:
      name: Scale logger          # the diagram's name or id
      controls: {Limit: 10}       # by label or id, checked like an operator's entry
      expect:
        Weight: 12.5              # a number matches to within a millionth
        Heavy: true
        Reading: {min: 12, max: 13}
```

Ein Bedienelement, das das Diagramm nicht hat, ein Wert, den es ablehnt, eine Anzeige, die keine ist, ein Name, den zwei Dinge teilen, und ein Diagramm, das nicht laufen kann, sind Fehler mit Begründung. Ein Diagramm mit einem Knoten, der aus dem Test hinausreichen würde (eine serielle Schnittstelle, ein Messgerät, ein Datenerfassungsgerät, MQTT out, ein HotLoop-Schreibvorgang, eine Protokolldatei), wird abgelehnt, weil ein Diagrammtest dafür keinen Ersatz hat. Ein geskriptetes serielles Gerät, um einen gezogenen Stecker oder eine Folge von Müllframes zu testen, ist nicht gebaut.

## Die Fehlerliste in CI/CD

`hotloop-flow test` und das Deploy-Gate führen die Prüfung des Editors für jedes Diagramm in der Flow-Datei aus. Ein Diagramm, das nicht laufen kann, steht als `--- DIAGRAM: <diagram>: <node> input <port>: <reason>` in der Liste und lässt die Datei fehlschlagen, auch wenn jeder Test besteht; der JUnit-Bericht führt jeden als Fehler vom Typ `diagram`. Eine Warnung, etwa eine Fallstruktur ohne Standardfall, steht in der Liste und lässt nichts fehlschlagen.

## Wellenformen

Eine Wellenform ist ein Block gleichmäßig verteilter Samples, der weiß, wann er begann und wie weit sie auseinanderliegen, als Datensatz auf der Leitung: `{"type": "waveform", "t0": "2026-11-14T12:00:00Z", "dt": 0.001, "y": [...], "attrs": {"unit_string": "V"}}`. `dia-wave` baut eine aus einem Array (den Schritt aus `dt`, sonst `rate`, sonst seiner Einstellung; den Start aus `t0`, sonst dem Moment, in dem es läuft) und `dia-wave-parts` zerlegt eine, einschließlich der Zeitspanne, die sie umfasst. Eine Wellenform enthält höchstens `maxSamples` Samples (standardmäßig 1.048.576); der Rest wird abgeschnitten und in `dropped` gezählt. Die Analyseknoten akzeptieren eine Wellenform dort, wo sie ein Array nehmen, und nutzen ihren Schritt. `dia-log-tdms` schreibt eine Wellenform-Spalte als Kanal mit `wf_start_time`, `wf_increment`, `wf_samples` und den Attributen als Kanaleigenschaften.

## Unterdiagramme

`dia-sub` ist ein Diagramm, das als Knoten dient: Seine Eingänge und Ausgänge sind der Anschluss, jeder Eingang ein `dia-body-in` dieses Namens in seinem Rumpf und jeder Ausgang ein `dia-body-out`. Ein Eingang ist erforderlich, es sei denn, sein Name endet auf `?` (optional) oder `~` (empfohlen: Es läuft auch ohne, und das Deployment warnt, wenn er nicht verdrahtet ist). Wählen Sie Knoten aus und machen Sie daraus ein Unterdiagramm (`POST /diagrams/{id}/sub`), und die Knoten wandern in einen neuen Rumpf-Tab, ein `dia-sub` nimmt ihren Platz ein, und der Anschluss wird aus den Leitungen abgeleitet, die den Rand der Auswahl kreuzen: ein Eingang für jeden Quellausgang, der die Auswahl speist, ein Ausgang für jeden ausgewählten Ausgang, der die Knoten außerhalb speist. Die Leitungen außerhalb werden neu verbunden, sodass eine Ausführung dieselben Antworten gibt wie vorher.

## Gemeinsame Datensatztypen

Ein Datensatztyp wird einmal benannt, in den Einstellungen eines Diagramm-Tabs unter `types`, und jedes `dia-bundle` oder `dia-field`, das `shape` auf seinen Namen setzt, wird gegen diese eine Definition geprüft:

```json
{"types": {"Reading": {"fields": {"pressure": "number", "ok": "boolean", "state": {"enum": ["idle", "run"]}}}}}
```

Ein Feld ist `number`, `integer`, `boolean`, `string`, `timestamp`, `array`, `waveform`, `record:Name` (ein anderer gemeinsamer Typ) oder ein Enum. Benennen Sie ein Feld in der Definition um, und jedes Bundle, das noch den alten Namen nutzt, ist beim nächsten Deployment ein Problem, in derselben Fehlerliste wie ein nicht verdrahteter Eingang, mit Knoten und Feld. Ein Bundle hält jeden Wert beim Lauf an die Art seines Felds, und die Fehlerleitung trägt einen Wert, der nicht passt. `Set.Schema` gibt denselben Typ als JSON Schema, was typisierte Leitungen prüfen.

## Rotation und Aufbewahrung

`dia-log-text` und `dia-log-tdms` können eine neue Datei beginnen, wenn die aktive `rotateMB` Megabyte oder `rotateHours` Stunden erreicht, und nur die neuesten `keep` fertigen Dateien behalten. Die fertige Datei trägt den Namen des Protokolls mit der Zeit des Schließens vor der Endung (`bench.csv` wird zu `bench-20261114T120000Z.csv`), und das Protokoll geht in `bench.csv` weiter, mit neuer Kopfzeile oder, bei TDMS, mit erneut geschriebenen Dateieigenschaften. Die Aufbewahrung löscht nur Dateien, die zu diesem Muster passen, nie das aktive Protokoll und nie eine Datei, die bloß daneben liegt. Das Alter zählt ab dem ersten Schreiben einer Ausführung in die Datei. Das Textprotokoll öffnet sich in einer Tabellenkalkulation, und das TDMS-Protokoll ist das Binärformat für große Daten.

## Eine Fallstruktur bearbeiten und ein Diagramm auswählen

Die Fälle einer Fallstruktur sind Zeilen aus einem Fallnamen und einer Diagrammauswahl, mit einer zweiten Auswahl für den Standardfall, und die Eigenschaft, die das Diagramm nennt, das eine Schleife oder ein Unterdiagramm ausführt, ist ebenfalls eine Auswahl. Die Auswahlen listen die FlowLab-Diagramme der Flow-Datei und speichern die ID des Tabs; ein von Hand geschriebener Name in einer älteren Flow-Datei wird als dieser Tab angezeigt und als seine ID gespeichert, die die Runtime genauso liest. Die gespeicherten Werte sind dasselbe JSON wie vorher (`cases` ist ein Objekt aus Fallname und Diagramm), eine im Dialog bearbeitete Flow-Datei und eine von Hand bearbeitete sind also dieselbe Datei.

## Ein Unterdiagramm an Ort und Stelle öffnen

Ein Unterdiagramm-Knoten hat ein kleines Kästchen an seiner oberen rechten Ecke. Drücken Sie darauf oder wählen Sie den Knoten und drücken Sie in der Diagrammleiste **An Ort und Stelle öffnen**, und der Knoten wird geöffnet dort gezeichnet, wo er war: ein Rahmen mit dem Namen des Unterdiagramms, sein Anschluss an den beiden Rändern benannt (die Eingänge links, die Ausgänge rechts, mit den Ports `after` und `done` und der Fehlerleitung wie bei jedem Knoten) und darin die Knoten und Leitungen seines Rumpfs. Nichts öffnet sich in einem zweiten Fenster, und der Tab, in dem Sie sind, ändert sich nicht. Leitungen, die zum Knoten führten, führen zum Anschluss des Rahmens, und eine blasse gestrichelte Linie läuft von jedem Anschlussnamen zum body-in- oder body-out-Knoten dieses Namens. Das Kästchen in der Titelleiste des Rahmens (oder **An Ort und Stelle schließen**) schließt ihn wieder.

Was im Rahmen gezeichnet ist, sind die eigenen Knoten des Rumpfs, keine Kopie. Wählen Sie einen aus, ziehen Sie ihn, doppelklicken Sie ihn für seine Eigenschaften, ändern Sie seinen Wert oder löschen Sie ihn, und Sie haben den Rumpf bearbeitet, als einen rückgängig zu machenden Schritt, und ein Deployment speichert es. Das Verschieben des Rahmens an seiner Titelleiste verschiebt den Unterdiagramm-Knoten, und der Rumpf geht mit. Eine Leitung verbindet zwei Knoten desselben Diagramms, eine Leitung von einem Knoten außerhalb zu einem Knoten innerhalb wird daher in Worten abgelehnt; verdrahten Sie zum Anschluss am Rahmen. Zoomen, Verschieben, Einpassen und der Auswahlrahmen funktionieren wie überall sonst.

Welche Unterdiagramme offen sind, ist die Art, wie Sie das Diagramm ansehen. Es steht nicht in der Flow-Datei, ist kein Rückgängig-Schritt, und ein Neuladen schließt alle, ein Öffnen ändert also nie, was ein Deployment sendet. Ein Unterdiagramm in einem offenen hat sein eigenes Kästchen und lässt sich ebenfalls öffnen, bis zu drei Ebenen tief. Ein Rumpf, der schon irgendwo offen ist, wird nicht ein zweites Mal geöffnet, und ein Unterdiagramm, dessen Rumpf zu einem bereits offenen Diagramm führt, wird geschlossen gezeichnet, sodass ein Diagramm, das sich selbst enthält, den Editor nicht in eine Schleife schicken kann. Ein Rumpf, der von nichts oder von einem Namen benannt wird, den zwei Diagramme teilen, hat kein Kästchen, weil auch die Runtime ihn nicht finden kann. Schleifen und Fallstrukturen besitzen ebenfalls Rümpfe und werden noch nicht an Ort und Stelle geöffnet.

## Ein Unterdiagramm im Editor erstellen

Mit ausgewählten Knoten in einem Diagramm fragt **Auswahl in Unterdiagramm** in der Leiste nach einem Namen, ruft `POST /diagrams/{id}/sub` mit der Flow-Datei auf, die der Editor hält, und lädt die Antwort als eine rückgängig zu machende Änderung: Die Knoten wandern in einen eigenen Tab, und ein Unterdiagramm-Knoten nimmt ihren Platz ein, mit Eingängen und Ausgängen, die aus den Leitungen abgeleitet werden, die die Auswahl kreuzen. Nichts wird gespeichert, bis bereitgestellt wird.

## Eine Ausführung wiedergeben

Ausführung hervorheben verlangsamt eine Ausführung, während sie läuft. **Letzte Ausführung wiedergeben**, unten an der Zeichenfläche, spielt eine bereits beendete Ausführung aus dem ab, was sie aufgezeichnet hat, damit Sie ihr im Nachhinein folgen können. Es lässt die Leitungen leuchten und markiert die Knoten wie die Live-Ausführung, ein Ereignis nach dem anderen, in der gewählten Geschwindigkeit (Langsam, Normal, Schnell oder Sehr schnell), und am Ende zeigt die Zeichenfläche, was die Ausführung hinterlassen hat. **Wiedergabe stoppen** beendet sie früher. Es ändert nichts in der Runtime und startet nichts: Die Schaltfläche ist aus, solange eine Ausführung läuft, und eine Wiedergabe endet, wenn Sie zu einem anderen Tab wechseln.

Jede Ausführung zeichnet die Starts und Enden ihrer Knoten und jeden Wert auf, der über eine Leitung ging, bis zu 20.000 Ereignisse. Eine längere Ausführung behält ihre ersten 20.000, sagt das bei der Wiedergabe, und die Wiedergabe zeigt diesen Anfang, denn eine Wiedergabe, die in der Mitte begänne, hätte nichts, womit sie anfangen könnte. Werte werden als die kurzen Vorschauen gespeichert, die die Leitungen zeigen, ein Array aus Tausenden Samples ist also seine Länge und seine ersten Werte. Die Aufzeichnung ist die der letzten Ausführung, und eine neue Ausführung ersetzt sie; sie wird über einen Neustart nicht gespeichert. `GET /diagrams/{id}/trace` ist dieselbe Aufzeichnung für ein Skript.

## Aufgeräumtes Layout

**Layout aufräumen** in der Tab-Leiste ordnet die sichtbaren Knoten so an, dass Daten von links nach rechts lesbar sind und keine Leitung durch einen Knoten läuft. Die Spalte eines Knotens ist die längste Kette von Leitungen, die zu ihm führt. Eine Leitung, die Spalten überspringt, bekommt eine Bahn durch sie, die Knoten innerhalb einer Spalte werden geordnet, um die Kreuzungen zu entwirren, und dann wird jede lange Leitung entlang der Kurve, mit der sie tatsächlich gezeichnet wird, gegen die Knoten der Spalten geprüft, die sie kreuzt, und ein im Weg stehender Knoten wird beiseite geschoben. Der Block behält seine obere linke Ecke, und das Ganze ist eine einzige rückgängig zu machende Änderung. Bei einer Schleife in der Verdrahtung bleibt die schließende Leitung aus der Rangfolge heraus, sie läuft also rückwärts, statt das Layout in eine Schleife zu schicken.

## Leitungsnamen

Eine Leitung eines Diagramms wird in ihrer Mitte benannt, nach dem Ausgang, von dem sie kommt (`sum`, `result`, `iterations`), neben ihrem Typ, wenn eines der Enden einen angibt, und beim Darüberfahren zeigt sie weiterhin den letzten Wert, den sie getragen hat.

## Zoom

Die Zeichenfläche zoomt von 5 Prozent bis 400 Prozent um den Zeiger und liest ihren Zoom als `data-zoom` an der Zeichenfläche.

## Ein Panel-Objekt nach Namen setzen

`dia-panel-set` ändert eine Eigenschaft eines Bedienelements oder einer Anzeige, während das Diagramm läuft, über die Beschriftung des Objekts (oder seine ID): `visible` und `enabled` nehmen true oder false, `color` nimmt red, amber, green, blue, gray oder default, `label` nimmt Text, und `min` und `max` nehmen eine Zahl für ein Zahlen-Bedienelement. Ein deaktiviertes Bedienelement lehnt ab, was ein Bediener setzt, ein verstecktes Objekt wird nicht gezeichnet, und das Panel, das ein Bediener offen hat, folgt. Ein Name, der auf kein Objekt oder auf mehr als eines passt, ist beim Deployment ein Problem, wenn er am Knoten eingetippt ist, und ein Fehler auf der Leitung, wenn er hereinverdrahtet wird, und eine Ausführung startet mit dem Panel, wie es entworfen wurde.

## Symbole

Jeder FlowLab-Knotentyp wird mit einem eigenen Symbol in der Mitte seines Körpers gezeichnet (ein Plus für Mathematik, ein Sigma für Statistik, eine Sinuskurve für eine Wellenform, ein Stecker für eine serielle Schnittstelle), neben seiner Textbeschriftung. Es sind schlichte Striche, gezeichnet in `web/src/lib/symbols.ts`, keine Icon-Schrift und niemandes Grafik, und ein Test schlägt fehl, wenn ein Diagramm-Knotentyp ein Icon nennt, das nicht gezeichnet ist.

## An Anlagen schreiben: das Schreib-Gate

Ein Diagramm steuert eine Anlage auf einem einzigen Weg: `dia-hotloop-write`. Es sendet seinen Wert an ein Tag in HotLoop (`device/tag`, am Knoten gesetzt oder hereinverdrahtet) durch das Schreib-Gate von HotLoop, das in seiner eigenen Reihenfolge entscheidet, dass Schreibvorgänge eingeschaltet sind, dass das Tag scharf ist und dass der Wert im Bereich liegt. Flow schreibt nie selbst an eine Maschine. HotLoop zeichnet jeden Versuch auf, abgelehnt oder nicht, mit dem Grund `flow:<diagram>/<node id>`, sein Audit-Protokoll nennt also das Diagramm und den Knoten. Eine Ablehnung ist ein Fehler auf der Fehlerleitung des Knotens mit dem eigenen Grund des Gates (Code 5006), und das gilt auch für ein HotLoop, das nicht erreichbar ist; in beiden Fällen findet der Schreibvorgang nicht statt, und der Knoten weigert sich, ohne ausgewähltes HotLoop bereitgestellt zu werden. Die rohen seriellen Knoten und Messgeräteknoten sprechen mit Messgeräten am Prüfplatz (Multimeter, Netzteile, Lasten), die kein Tag in HotLoop haben, also haben sie einen eigenen Schalter (unten).

## Der Schreibschalter für Messgeräte

Das Lesen eines Messgeräts ändert nichts und ist immer offen. Das Schreiben kann etwas ändern: den Ausgang eines Netzteils, die Hochspannung eines Hipot, den Strom einer Last. Deshalb startet jedes Messgerät mit **ausgeschalteten** Schreibvorgängen, und ein Schreibvorgang aus einem Diagramm wird abgelehnt, bis jemand mit der Berechtigung `instrument.write` die Schreibvorgänge dieses Messgeräts einschaltet, ein Messgerät nach dem anderen.

- **Was als Schreibvorgang zählt.** `dia-serial-write` ist immer ein Schreibvorgang. `dia-instr-query` ist ein Lesevorgang, wenn sein Befehl eine Abfrage ist (jede SCPI-Anweisung darin endet auf `?`, wie `*IDN?` oder `MEAS:VOLT?;MEAS:CURR?`), und sonst ein Schreibvorgang (`OUTP ON`, `VOLT 5`, `*RST` oder `VOLT 5;MEAS:VOLT?`). Ein hereinverdrahteter Befehl zählt als einer, der schreiben kann.
- **Welches Messgerät.** Das Messgerät ist seine Adresse: `tcp://host:port` oder `serial:///dev/ttyUSB0`, ohne die seriellen Einstellungen, sodass ein auf zwei Arten geöffnetes Messgerät ein einziger Schalter ist.
- **Eine Ablehnung** ist ein Fehler auf der Fehlerleitung des Knotens (Code 5007), der sagt, dass Schreibvorgänge zu diesem Messgerät ausgeschaltet sind, und das Messgerät hört den Befehl nie.
- **Einschalten.** `PUT /instruments/writes` mit `{"instrument": "tcp://10.0.0.5:5025", "allowed": true, "note": "bench 2"}`, das `instrument.write` braucht (ein Administrator hat es) und in `instrument-writes.json` im Datenverzeichnis gehalten wird, sodass ein Neustart nichts ändert. `GET /instruments` listet jedes Messgerät mit einem Schalter oder einem bereitgestellten Diagramm, das darauf schreiben würde, mit dem, der ihn gesetzt hat, und den beteiligten Diagrammen und Knoten.
- **Audit.** Jede Schalteränderung ist `instrument.switch`, und jeder Schreibvorgang eines Diagramms ist `instrument.write` oder, wenn abgelehnt, `instrument.refused`, mit Diagramm, Knoten, Messgerät und Befehl.
- **Das Deployment sagt es.** Ein Knoten, der auf ein Messgerät schreiben würde, ist ein Hinweis am Diagramm (die **Hinweise** der Leiste und die Liste, die `hotloop-flow test` ausgibt), der das Messgerät nennt und sagt, dass seine Schreibvorgänge ausgeschaltet sind, bis jemand sie einschaltet. Flow-Dateien, die nur lesen, bleiben unverändert.

## Ein LabVIEW-VI übernehmen

Importieren Sie ein `.vi` im Import-Dialog des Editors (oder `import_vi` über MCP oder `POST /flows/import-vi`), und FlowLab liest, was es kann, und listet, bevor etwas hinzugefügt wird, was es nicht konnte. Lesen Sie docs/labview-import.md: Dort steht genau, was übernommen wird und was nicht. Die Kurzfassung: Der Name des VI, seine Beschreibung, seine Version, die Namen des Frontpanels und die VIs, die es aufruft, kommen mit, als Hinweis an einem eigenen Flow. Die Leitungen und Primitiven des Blockdiagramms kommen nicht mit, das Diagramm zeichnen also Sie, mit diesen Namen daneben.
