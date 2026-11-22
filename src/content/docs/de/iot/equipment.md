---
title: "Der Anlagenbaum und die Bezeichnungen"
description: "Ein ISA-95-Baum vom Unternehmen bis zur Anlage, dazu Bezeichnungen, damit Regeln und Agenten von der Pumpe reden statt von Register 40001."
---

Ein Werk hat schon eine Art, sich zu ordnen, und jedes SCADA, MES und jeder Historian, den es besitzt, benutzt sie: ISA-95. Unternehmen, Standort, Bereich, Linie, Zelle, Einheit, Anlage. Genau das verwendet HotLoop, einen einzigen Baum, und nicht eine Liste für Hallen, eine zweite für Bereiche und eine dritte für Geräte. Was daran hängt, steht unter [Entitäten](/de/iot/entities/).

## Ebenen

| Ebene | Was es meist ist |
|---|---|
| `enterprise` | Das Unternehmen |
| `site` | Ein Werk |
| `area` | Eine Abteilung oder ein Gebäude: Verpackung, Betriebsmittel, Tanklager |
| `line` | Eine Produktionslinie |
| `cell` | Eine Arbeitszelle an einer Linie oder eine Prozesszelle in einer Chargenanlage |
| `unit` | Eine Produktionseinheit: ein Reaktor, ein Kühler, ein Ofen |
| `equipment` | Eine Maschine oder ein Teil davon: eine Pumpe, ein Skid, ein Motor |

Ein Kind steht immer auf einer niedrigeren Ebene als sein Elternknoten, ein Standort kommt also nie unter eine Linie. Es kann Ebenen überspringen: eine Einheit direkt unter einem Bereich ist in Ordnung, ebenso eine Linie direkt unter einem Standort in einem Werk ohne Bereiche. Die einzige Ausnahme ist `equipment` in `equipment`, denn ein Skid enthält Pumpen und eine Pumpe enthält einen Motor, und ISA-95 hört lange auf, Ebenen zu benennen, bevor ein Werk aufhört, Dinge zu verschachteln. Ein Knoten kann auf jeder Ebene an der Wurzel stehen; die meisten Werke beginnen bei `site`.

Zwei Geschwister mit gleicher Ebene und gleichem Namen sind derselbe Ort, deshalb lehnt der Baum das zweite ab.

Ein Knoten kann nie sein eigener Vorfahr werden: Einen Knoten unter sich selbst oder unter irgendeinen seiner Nachfahren zu verschieben, wird abgelehnt. Eine Schleife entsteht nur, wenn jemand die Tabelle `equipment` von Hand bearbeitet. Tut das jemand, bleibt nichts hängen, was den Baum durchläuft, und die Änderung eines Knotens in der Schleife wird mit einer Meldung abgelehnt, die die Knoten nennt und sagt, dass Sie bei einem von ihnen `parent_id` auf NULL setzen sollen.

## Der Text für Standort, Bereich und Linie funktioniert weiter

Jedes Gerät hat Freitextfelder `site`, `area` und `line`, seit es den Baum noch nicht gab. Sie verschwinden nicht. Der Geräteeditor der 4.15 schreibt sie, `list_devices` und `describe_device` lesen sie, und ebenso jeder Agent und jedes Skript, das jemand dagegen geschrieben hat. Deshalb werden Text und Baum in beiden Richtungen und in derselben Transaktion wie die Änderung im Gleichschritt gehalten:

**Ein Gerät mit Text und ohne `equipmentId` zu speichern** findet den Standort, den Bereich und die Linie, die der Text nennt, oder legt sie an, jeden unter dem vorigen, und setzt das Gerät auf den tiefsten. Zwei Geräte mit demselben Text landen auf demselben Knoten; nichts wird je doppelt angelegt. Der Text, den Sie gesendet haben, wird genau so gespeichert: Ein Client, der nichts vom Baum weiß, bekommt zurück, was er immer bekommen hat, plus eine `equipmentId`, die er ignorieren kann.

**Ein Gerät mit einer `equipmentId` zu speichern, die es verschiebt**, übernimmt den Text aus dem Pfad des Knotens, egal welcher Text mitgekommen ist. Setzen Sie ein Gerät auf eine Zelle unter `Plant A / Packing / Line 2`, und sein Text wird zu `Plant A`, `Packing`, `Line 2`.

Zwei Einzelheiten machen das für Clients sicher, die den Baum nicht kennen:

- Ein Text, der noch sagt, was der aktuelle Knoten des Geräts sagt, lässt das Gerät, wo es ist. Der Text hat nur drei Spalten, ein Gerät auf einer Zelle oder einer Maschine unterhalb seiner Linie kann also nur die Linie nennen. Es mit demselben Text zu speichern, schiebt es nicht auf die Linie hinauf.
- Ein Client, der ein Gerät liest und es komplett zurückschickt, mit `equipmentId` und allem, aber mit geändertem Text, bekommt die Textänderung. Die `equipmentId`, die er zurückgeschickt hat, ist die, die das Gerät schon hatte, also ist es kein Verschieben, und der Text entscheidet.

Ein Standort wird überall gefunden, nicht nur an der Wurzel, deshalb legt das Setzen von `Plant A` unter ein Unternehmen nicht bei dem nächsten Gerät, das `Plant A` sagt, einen zweiten an.

**Einen Knoten umzubenennen oder zu verschieben** schreibt den Text jedes Geräts an oder unter diesem Knoten um, in derselben Transaktion. Schlägt irgendetwas davon fehl, ist nichts davon geschehen: Ein Baum, der das eine sagt, und ein Gerätetext, der etwas anderes sagt, ist genau das, was das Gleichhalten beider verhindern sollte. Die Antwort und das Systemprotokoll listen jedes Gerät auf, dessen Text sich geändert hat.

### Das Upgrade

Die Migration `0006_hierarchy.sql` baut den Baum aus dem Text, den jedes vorhandene Gerät schon trägt: ein Standort pro verschiedenem Standortnamen, ein Bereich pro verschiedenem Bereichsnamen unter seinem Standort, eine Linie pro verschiedener Linie unter ihrem Bereich, und jedes Gerät auf dem tiefsten Knoten, den sein Text nennt. Ein Gerät mit Bereich und ohne Standort bekommt einen Bereich an der Wurzel; eines mit Linie und ohne Bereich bekommt eine Linie direkt unter seinem Standort. Ein Text, der nur aus Leerzeichen besteht, nennt nichts. Der Text wird genau so verwendet, wie er gespeichert ist, mit Leerzeichen und Groß- und Kleinschreibung, denn die Namen des Baums sind das, woraus der Text später neu geschrieben wird, und Kürzen beim Upgrade wäre eine stille Umbenennung jedes Geräts, das ein überzähliges Leerzeichen hatte. Beim Upgrade ändert sich kein Gerätetext.

Die Go-Seite ordnet ein Gerät nach denselben Regeln ein, und ein Test hält beide zusammen: Jedes Gerät, das das Upgrade eingeordnet hat, bleibt beim erneuten, unberührten Speichern, wo es ist, und lässt den Baum um nichts wachsen.

## Einen Knoten löschen

**Ein Knoten, unter dem irgendetwas hängt, wird abgelehnt**: Kindknoten oder darauf platzierte Geräte. Verschieben Sie sie zuerst. Die Ablehnung nennt, was im Weg ist.

Die Alternative war, die Kinder an den Elternknoten des gelöschten Knotens zu hängen. Das verschiebt jedes Gerät darunter und schreibt deren Text um, unter einem Knoten, den niemand angefasst hat, und kann eine Linie direkt unter einen Standort setzen, ohne Bereich dazwischen, einen Baum, den niemand gezeichnet hat. Die Geräte stattdessen zu lösen, ließe ihren Text einen Ort nennen, den es nicht mehr gibt, und das nächste Speichern eines von ihnen würde den Knoten stillschweigend neu anlegen. Beides überrascht. Eine Ablehnung, die sagt, was zu verschieben ist, nicht.

Entitäten, die auf einem gelöschten Knoten platziert waren, verlieren die Platzierung und folgen wieder ihrem Gerät.

## Entitäten im Baum

Jede Entitätsantwort trägt jetzt drei weitere Felder:

| Feld | Was |
|---|---|
| `equipment_id` | Wo die Entität selbst platziert ist, oder null, wenn sie einfach dahin geht, wohin ihr Gerät geht |
| `area_id` | Der nächste `area` am Knoten der Entität oder darüber, oder der Knoten ihres Geräts, wenn sie keinen hat. Alles, was nach Bereich gruppiert, liest dieses Feld. Null, wenn darüber kein Bereich liegt |
| `labels` | Die label_ids der Entität |

Der eigene Platz einer Entität geht vor dem ihres Geräts. Das ist wichtig bei einem Gerät, das eine ganze SPS ist: Ihr Temperatur-Tag gehört in den Ofen, ihr Kühler-Tag zu den Betriebsmitteln. Eine Entität platzieren Sie mit `PUT /api/entities/{entity_id}`:

```json
{ "equipment_id": 42, "labels": ["critical"] }
```

`"equipment_id": null` geht zurück zum Folgen des Geräts. `labels` ersetzt die gesamte Menge. Beides braucht `entities.write`, wie jedes andere Registerfeld.

## Bezeichnungen

Eine Bezeichnung ist ein Etikett im alltäglichen Sinn: `critical`, `line 1 utilities`, `calibrate quarterly`. Geräte und Entitäten tragen beliebig viele davon.

Eine Bezeichnung hat eine `label_id` und einen `name`. Die `label_id` wird beim ersten Mal aus dem Namen gebildet (Kleinbuchstaben, Ziffern und Unterstriche, `_2`, `_3` bei einer Kollision) und ändert sich nie, denn darauf beziehen sich Automatisierungen und Bildschirme. Der Name kann sich jederzeit ändern. Beim Anlegen können Sie die `label_id` auch selbst wählen.

Das Löschen einer Bezeichnung nimmt sie von allem, was sie trägt.

Gerätebezeichnungen werden mit `PUT /api/devices/{id}/labels` gesetzt, nicht über `POST /api/devices`. Jeder Client, der heute ein Gerät speichert, sendet das ganze Gerät ohne Bezeichnungen und würde sie bei jedem Speichern löschen.

## API

Die Endpunkte für Anlagen und Bezeichnungen verwenden Feldnamen in snake_case, wie die Entitäts-Endpunkte, weil der Baum das Bereichsregister des Entitätsmodells ist und für dieselben Verbraucher geformt wurde. Das neue Feld des Geräts heißt `equipmentId`, in camelCase, wie der Rest der Geräte-API.

| Endpunkt | Berechtigung | Was |
|---|---|---|
| `GET /api/equipment` | `equipment.read` | Jeder Knoten, mit seinem `path` aus Namen von der Wurzel. Filter: `?level=` |
| `GET /api/equipment/{id}` | `equipment.read` | `{"equipment", "children", "devices", "entities"}`: der Knoten, die Knoten direkt darunter und das, was direkt darauf platziert ist |
| `POST /api/equipment` | `equipment.write` | `{"parent_id", "level", "name", "description"}` |
| `PUT /api/equipment/{id}` | `equipment.write` | Jedes von `name`, `description`, `level`, `parent_id` (null für die Wurzel). Antwortet `{"equipment", "devices_rewritten"}` |
| `DELETE /api/equipment/{id}` | `equipment.write` | Wird mit 409 abgelehnt, solange etwas darunter hängt |
| `GET /api/labels` | `equipment.read` | Jede Bezeichnung |
| `GET /api/labels/{label_id}` | `equipment.read` | `{"label", "devices", "entities"}`, die sie tragen |
| `POST /api/labels` | `equipment.write` | `{"label_id"?, "name", "color", "icon", "description"}` |
| `PUT /api/labels/{label_id}` | `equipment.write` | Name, Farbe, Symbol, Beschreibung. Nie die label_id |
| `DELETE /api/labels/{label_id}` | `equipment.write` | Entfernt sie von allem |
| `PUT /api/devices/{id}/labels` | `equipment.write` | `{"labels": [...]}`, die ganze Menge |
| `POST /api/devices` | `devices.write` | Bekommt die optionale `equipmentId`, wie oben |
| `GET /api/devices/{id}` | `devices.read` | Bekommt `labels` neben `device` und `tags` |

Jede Rolle hat `equipment.read`: Wo etwas steht, sagten Standort und Bereich eines Geräts einem Betrachter schon. Nur der Administrator hat `equipment.write`, denn das Umbenennen oder Verschieben eines Knotens schreibt Standort, Bereich und Linie jedes Geräts darunter um, und das ist Konfiguration.

Jede Änderung landet im Systemprotokoll, Kategorie `config`, Betreff `equipment:<id>` oder `label:<label_id>`.

## MCP

`list_devices` und `describe_device` antworten wie immer aus dem Text, und ihre Ausgabe ändert sich nicht. Ein Test hält sie Byte für Byte auf dem, was die Version vor dem Baum geantwortet hat, ordnet dann den Baum um das Gerät herum um (ein Unternehmen über seinem Standort, eine Zelle unter seiner Linie, eine Bezeichnung) und prüft, dass sich nichts bewegt hat, was ein Agent sieht. Ändert der Baum den Text doch, etwa durch eine Umbenennung, sieht der Agent den neuen Text, genau als hätte ihn jemand in das Gerät getippt. `list_entities` ist der Ort, an dem Agenten den Baum sehen: Es filtert nach einem Knoten und allem darunter und gibt den Platz jeder Entität an. Siehe [MCP](/de/iot/mcp/#entities).

## Sicherung und Wiederherstellung

`equipment`, `labels`, `entity_labels` und `device_labels` sind in der Sicherung, ebenso die neuen Spalten `equipment_id`. `equipment` verweist auf sich selbst (`parent_id`), was eine Wiederherstellung nicht ordnen kann: Nach dem Verschieben eines Knotens kann ein Elternknoten leicht nach seinem Kind gespeichert sein. Die Bedingung ist `DEFERRABLE INITIALLY DEFERRED`, sie wird also geprüft, wenn die Wiederherstellung festschreibt, sobald alle Zeilen drin sind, und dasselbe gilt für alles andere, was den Baum in mehr als einer Anweisung umschreibt. Der Schutztest der Sicherung erlaubt einer Tabelle den Selbstverweis nur, wenn diese Bedingung aufgeschoben ist, und der Hin-und-zurück-Test speichert absichtlich ein Kind vor seinem Elternknoten.

Eine Sicherung, die vor dieser Version erstellt wurde, lässt sich weiterhin wiederherstellen. Ihre Dateien `devices` und `entities` haben eine Spalte weniger; die Wiederherstellung lädt sie in die ersten Spalten der Tabelle (eine neue Spalte wird immer am Ende angefügt), und die neue bekommt ihren Standardwert. Danach ordnet sie in derselben Transaktion jedes wiederhergestellte Gerät anhand seines Textes in den Baum ein, so wie es das Upgrade getan hätte.

## Der Bildschirm Werk

Der Baum, seitlich, mit einer Karte für den gewählten Knoten: sein Pfad, die Geräte darauf, die darauf platzierten Entitäten und was darunter liegt. Ein Administrator kann einen Knoten an der Wurzel oder unter dem gewählten hinzufügen, umbenennen, seine Ebene ändern, ihn verschieben, löschen, ein Gerät darauf platzieren oder eines davon wegnehmen und die Bezeichnungen eines Geräts setzen. Die Ebenenliste bietet nur die Ebenen an, die die Regeln erlauben, sowohl gegenüber dem Elternknoten als auch gegenüber den Kindern, die schon darunter liegen, und ein Verschieben bietet nur die Elternknoten an, unter die ein Knoten dieser Ebene passt, nie den Knoten selbst oder etwas darunter. Der Server prüft alles noch einmal, und eine Ablehnung (etwa beim Löschen, wenn noch etwas darunter liegt) wird genau so angezeigt, wie er sie geschrieben hat. Ein Gerät zu verschieben ist dasselbe Speichern wie im Geräteeditor, mit einer `equipmentId`, der Text folgt also dem Baum wie oben beschrieben.

Bezeichnungen werden unten auf dem Bildschirm verwaltet: ein Name, eine Farbe und eine Beschreibung, mit einer `label_id`, die einmal gewählt wird und dann feststeht. Entitäten bekommen ihren Platz und ihre Bezeichnungen aus ihrer Schublade auf dem Bildschirm Entitäten.

Alle anderen sehen denselben Bildschirm, ohne etwas, das sie drücken könnten.
