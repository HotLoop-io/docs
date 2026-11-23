---
title: "Versionshinweise: HotLoop Flow 2.7.0"
description: "Was HotLoop Flow 2.7.0 bringt, was sich beim Update ändert und was Sie lesen sollten, bevor Sie eine laufende Anlage anfassen."
sidebar:
  label: "2.7.0"
---

HotLoop Flow 2.7.0 ist der erste Schnitt von FlowLab, eine zweite Art, einen Tab für Prüfstände und Datenlogger auszuführen. Flows laufen genau wie vorher, und eine Flow-Datei, die Sie heute haben, wird Byte für Byte geladen und gespeichert. FlowLab startet nur, wenn Sie ihm einen Tab hinzufügen. Wenn Sie das nicht tun, ändert sich für Sie nur die Sitzungskorrektur, der letzte Punkt unten.

## Neu

**FlowLab-Diagramme.** Ein Diagramm ist ein Tab, in dem jeder Node einmal läuft, wenn jeder verbundene Eingang einen Wert hat, und zwei Nodes ohne Verbindung dazwischen gleichzeitig laufen. Fügen Sie eines mit dem neuen FlowLab-Button neben dem Subflow-Button hinzu. Es bekommt eine Leiste über der Zeichenfläche mit Ausführen und Stopp, und alles, was es zeichnet, liegt auf den Verbindungen: der letzte Wert auf jeder Verbindung nach einem Lauf, eine Sonde auf jeder Verbindung, die die letzten 100 Werte behält, und ein Haltepunkt auf einem Node oder einer Verbindung. Pause, Einzelschritt hinein, darüber und heraus arbeiten Node für Node, und Ausführung hervorheben verlangsamt einen Lauf genug, um ihm zu folgen, und schaltet sich nach zehn Minuten selbst aus. Nichts am Debugging ändert, was ein Lauf tut, und ein Test prüft, dass ein Lauf mit Sonde auf jeder Verbindung mit demselben Wert endet wie einer ohne.

**Was in der Box steckt.** While- und For-Schleifen mit Werten, die von einem Durchlauf zum nächsten getragen werden, eine For-Schleife über eine Anzahl oder ein Array und eine Fehlerverbindung: Ein Node, der einen Fehler bekommt, tut nichts und reicht ihn weiter, und ein an eine Schleife angeschlossener Fehler stoppt sie mit der Quelle und einem Code am Fehlerausgang der Schleife. Eine `after`-Verbindung legt die Reihenfolge zweier Nodes fest, die keine Daten teilen. Es gibt 21 Node-Typen im neuen FlowLab-Bereich der Palette: Konstante, Mathematik, Vergleich, Logik, Warten, Bündeln, Feld, Array bauen, die beiden Schleifen mit ihrem Körper-Ein und Körper-Aus, ein serieller Port mit Lesen und Schreiben, ein Messwert-Parser, ein Detektor für stabile Werte, ein Log in eine Textdatei und ein Bedienelement, eine Anzeige und ein Diagramm für das Panel. docs/diagrams.md beschreibt jeden.

**Ein Panel, das ein Bediener auf dem Telefon öffnen kann.** `/panel/<diagram id>` meldet sich so an wie der Editor und zeigt die Bedienelemente, Anzeigen und Diagramme des Diagramms, solange ein Lauf aktiv ist. Ein Diagramm behält die letzten 1.024 Punkte, sofern Sie das nicht ändern, und zählt, was es hat fallen lassen. Ein Bedienelement wird serverseitig gegen seine Art, seinen Bereich und seine Auswahl geprüft, und wer es gesetzt hat, kommt in das Audit-Log.

**Ein serieller Port, der ein gezogenes Kabel übersteht.** Ein Lesevorgang, der nichts bekommt, oder ein Port, der verschwindet, ist ein Fehler auf der Fehlerverbindung. Der nächste Lesevorgang versucht einmal pro Sekunde, den Port neu zu öffnen, und zählt den Verlust und die Rückkehr. Das Beispiel in `examples/diagram-scale-logger` liest eine Waage, parst Gewicht und Einheit, meldet, wann die letzten fünf Messwerte übereinstimmen, zeigt alles auf dem Panel mit einem Trenddiagramm und hängt es an eine CSV-Datei an. Setzen Sie `autostart` am Tab, und es läuft ohne geöffneten Browser und nach jedem Deploy erneut.

**Neue API.** `GET /diagrams`, `GET /diagrams/{id}` und `POST` für `run`, `stop` und `debug`, `PUT` für `controls/{node}`, `breakpoints` und `probes`. Lesen braucht `status.read`. Ausführen, Stoppen, Setzen eines Bedienelements und Debuggen brauchen eine neue Berechtigung, `diagram.run`, und jedes steht mit dem Ausführenden im Audit-Log.

**Sitzungen werden von einem fehlgeschlagenen Lesen nicht überschrieben.** Eine Sitzungsdatei, die existiert, aber nicht gelesen werden kann, ein E/A-Fehler oder ein Volume, das spät hochkam, wird von der nächsten Anmeldung nicht mehr ersetzt, und eine Datei mit unlesbarem JSON wird neben dem Original aufbewahrt, statt verloren zu gehen.

## Was sich geändert hat

- Ein Tab, der `ew_diagram` trägt, bleibt aus der Nachrichten-Runtime heraus. Jeder andere Tab läuft wie bisher. Die neuen Schlüssel sind `ew_diagram` am Tab und `ew_in` an einem Node, und beide überstehen den Rundlauf, den zwei neue Tests und der alte prüfen.
- Die README zählte 79 Node-Typen und „rund 36.000 Zeilen Go“, und beides war veraltet. Jetzt steht dort 79 Node-Typen für Nachrichten und 21 für FlowLab.
- Der Test des HotLoop-MCP-Client-Nodes schreibt jetzt durch HotLoops Gate, weil HotLoop seine MCP-Schreibvorgänge eingeschaltet ausliefert.
- Ein Deploy startet den Lauf jedes Diagramms neu, auch eines, das er nicht geändert hat.
- FlowLab hat das Binary um etwa 370 KB vergrößert, auf einer Maschine vorher und nachher gemessen. Das Binary ist 41,4 MB groß und das amd64-Image 45,34 MB.
- Die Bilder der README wurden für den neuen Button und den neuen Palettenabschnitt neu aufgenommen.

## Neue Einstellungen

Keine. Die Berechtigung `diagram.run` ist neu. Ein Benutzer, dessen Berechtigungsliste `["*"]` ist, hat sie. Wer eine ausdrückliche Liste hat, kann ein Diagramm und sein Panel mit `status.read` lesen und keines ausführen, bis Sie `diagram.run` hinzufügen.

## Upgrade

Auf amd64 ein schlichtes `helm upgrade` auf das Image und Chart von 2.7.0; auf arm64 bleiben Sie, wo Sie sind, bis 2.7.1, oder nehmen das neue Tag in Ihrer Quadlet-Unit. Beim ersten Start passiert nichts, es gibt nichts zu migrieren, und Ihre Flows, Deploy-Datensätze und Zugangsdaten werden nicht angefasst. Wenn Sie zurückgehen, nachdem Sie eine Flow-Datei mit einem Diagramm gespeichert haben, behält der ältere Build die Datei Byte für Byte und meldet für jeden FlowLab-Node `unknown node type`, die dann nicht laufen. Wir haben das gegen den Build vor diesem geprüft.

Image: `ghcr.io/hotloop-io/hotloop-flow:2.7.0`, nur linux/amd64. Wir bauen zuerst amd64, lassen es in der Produktion als stabil gelten, und dann fügt eine kleine 2.7.1 ohne sonst etwas arm64 hinzu. Bis dahin hält das Tag `2` das neue amd64-Image und das arm64-Image von 2.6.0, sodass eine Maschine auf arm64, die `2` oder `2.6` folgt, behält, was sie hat, und eine auf `2.7.0` festgelegte Maschine amd64 braucht. Chart: `https://hotloop.io/hotloop-flow/`. Die README zu diesem Tag hat den Rest, mit Bildern: https://github.com/HotLoop-io/hotloop-flow/blob/v2.7.0/README.md
