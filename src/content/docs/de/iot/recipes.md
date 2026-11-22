---
title: "Rezepte"
description: "Die Sollwerte einer Produktsorte auf einmal angewendet: als Ganzes geprüft, als Ganzes abgelehnt, der Reihe nach geschrieben und vom Gerät zurückgelesen."
---

Ein Rezept ist ein Satz von Werten, die gemeinsam ans Werk gehen. Die Zonentemperaturen, die Liniengeschwindigkeit und der Düsenspalt von Sorte A. Der Wechsel auf die 500-ml-Flasche. Die Nachtabsenkung. Jedes Werk hat das, und jedes Werk hat irgendwo ein laminiertes Blatt mit den Zahlen darauf und einen Bediener, der sie einzeln eintippt, und jedes Werk kennt die Geschichte von der Nacht, in der eine davon falsch eingetippt wurde.

Also leben die Zahlen stattdessen hier, und sie gehen auf einmal raus: zuerst als Ganzes geprüft, der Reihe nach gesendet, danach vom Gerät zurückgelesen, jede einzelne festgehalten. Jedes Rezept ist außerdem eine Entität, `scene.<id>`. Es ist für Anlagen gebaut, die jemanden verletzen können, und deshalb handelt der größte Teil dieser Seite davon, was passiert, wenn etwas schiefgeht.

## Wie eines aussieht

```json
{
  "id": "grade_a",
  "name": "Grade A",
  "description": "The 2pm run. Die at 210, line at whatever the order says.",
  "equipment_id": 7,
  "apply_permission": "recipes.apply",
  "params": [
    {"name": "speed", "label": "Line speed", "type": "number", "min": 0, "max": 400, "step": 10, "unit": "rpm", "required": true}
  ],
  "precondition": "states['input_boolean.line_ready'] == 'on'",
  "targets": [
    {"entity_id": "loop.line_02_die_tic", "service": "set_mode", "data": {"mode": "auto"}},
    {"entity_id": "loop.line_02_die_tic", "service": "set_setpoint", "data": {"value": 210}},
    {"entity_id": "number.line_02_speed", "service": "set_value", "data_expressions": {"value": "vars.speed"}},
    {"entity_id": "switch.line_02_heater", "service": "turn_on"},
    {"entity_id": "input_select.product", "service": "select_option", "data": {"option": "Grade A"}}
  ],
  "verify_sec": 10
}
```

- **`id`** besteht aus Kleinbuchstaben, Ziffern und Unterstrichen und beginnt mit einem Buchstaben. Es ist die Objekt-ID seiner Entität, `scene.grade_a`, und ändert sich nie.
- **`equipment_id`** ist der Knoten des Anlagenbaums, zu dem das Rezept gehört, damit man es findet. Der Bildschirm Rezepte gruppiert danach. Lassen Sie es für ein Rezept des ganzen Werks weg.
- **`params`** sind das, was eine Anwendung entgegennimmt: dieselben typisierten Felder wie bei einem Skript (`model.Field`: `number` mit `min`, `max`, `step` und `unit`, `text`, `boolean`, `select`, `entity`, `duration`, `alarm`, `tag`). Ein Ziel liest eines als `vars.<name>` in einem Eintrag von `data_expressions`.
- **`precondition`** ist ein Ausdruck in der Sprache der Automatisierung, der wahr sein muss, damit das Rezept startet. Lassen Sie ihn weg, gibt es keine.
- **`targets`** sind die Werte, **in der Reihenfolge, in der sie hinausgehen**. Jedes ist eine Entität, der Dienst, der sie setzt, und die Daten dieses Dienstes, als Wert (`data`) oder aus den Parametern berechnet (`data_expressions`). Bis zu 200.
- **`verify_sec`** ist die Zeit, die jedem geschriebenen Wert gegeben wird, um in einer Messung vom Gerät aufzutauchen. 1 bis 600, standardmäßig 10.

### Was ein Ziel sein kann

Ein Rezept **setzt Werte**. Die Dienste, die es annimmt, sind die, nach denen die Anlage einen Wert hält:

| Domain | Dienste |
|---|---|
| `switch`, `input_boolean` | `turn_on`, `turn_off` |
| `number`, `input_number`, `input_counter` | `set_value` |
| `text`, `input_text` | `set_value` |
| `select`, `input_select` | `select_option` |
| `valve` | `set_position` |
| `motor` | `set_speed` |
| `loop` | `set_setpoint`, `set_mode` |

Ein Tastendruck, ein Motorstart, ein Zählerrücksetzen, ein Ventilstopp: beim Speichern abgelehnt. Das sind Aktionen, keine Werte, und sie gehören in ein [Skript](/de/iot/scripts/). „Sorte A anwenden“, das jedes Mal eine Rücksetztaste drückt, wenn jemand es anwendet, ist nicht das, was irgendjemand unter einem Rezept versteht, und der Tag, an dem das mitten in einem Lauf passiert, ist der Tag, an dem Sie es merken. Auch Toggle wird abgelehnt: Ein Rezept, das einen Schalter umlegt, tut jedes zweite Mal das Gegenteil.

Die Entität eines Ziels muss beim Speichern existieren, seine Ausdrücke müssen kompilieren, und dieselbe Entität darf nicht zweimal vom selben Dienst gesetzt werden (zwei Werte für eine Einstellung, und welcher gewinnt, hinge von einer Reihenfolge ab, die niemand liest). Der Modus und der Sollwert eines Regelkreises sind zwei Einstellungen, und beide können gesetzt werden; setzen Sie zuerst den Modus, denn ein Sollwert für Automatik bedeutet einem Regelkreis in Handbetrieb nichts.

## Eines anwenden

Vom Bildschirm Rezepte, von der Kachel des Rezepts auf dem Bildschirm Entitäten, von einem `apply_recipe`-Schritt einer Regel oder eines Skripts, vom `apply_recipe` über MCP oder per `POST /api/services/scene/turn_on`. Jeder davon tut genau das:

### 1. Als Ganzes geprüft, als Ganzes abgelehnt

Bevor auch nur ein Wert irgendwohin geht:

- Die Parameter werden gegen ihre Felder geprüft. **Ein Wert wird nie zurechtgebogen.** 450 in einem Feld mit dem Maximum 400 wird abgelehnt, nicht gekürzt auf
  400. `"250"` für eine Zahl wird abgelehnt, nicht umgedeutet. 255 bei einer Schrittweite von 10 wird abgelehnt, nicht gerundet. Die Zahl, die zum Werk geht, ist genau die, die jemand eingegeben hat, oder es geht nichts.
- Das eigene Recht des Rezepts, wenn es eines nennt (unten), und die MCP-Schreibschalter, für einen Agenten.
- Die Vorbedingung wird gegen das Werk ausgewertet, wie es jetzt ist.
- Jeder Datenausdruck wird ausgewertet. Einer, der fehlschlägt, lehnt das Rezept ab; ein Ziel wird nie ohne den Wert gesendet, den es haben sollte.
- Nichts anderes in diesem Prozess darf auf eine seiner Entitäten schreiben (unten).
- **Jedes Ziel wird den eigenen Prüfungen des Schreib-Gates vorgelegt**, denselben, auf die sein Schreibzugriff treffen wird: Schreiben an, das Tag beschreibbar, der Wert im Bereich des Tags, die Entität aktiviert und mit dem Wert einverstanden (ihre Schrittweite, ihre Optionen, ein Regelkreis in Handbetrieb für seinen Ausgang), das Gerät verbunden. `Services.Check`, was für ein Tag `runtime.Manager.CheckWrite` ist. Es wird nichts geschrieben oder protokolliert.

**Schlägt irgendetwas fehl, wird das ganze Rezept abgelehnt und nichts geschrieben.** Nicht die ersten zehn Ziele und dann eine Ablehnung. Nichts. Und Sie bekommen jeden Grund, nicht nur den ersten: Ein Bediener, dem ein Problem genannt wird, behebt es und bekommt das nächste genannt, und ein Rezept mit vierzig Zielen sollte in einem Zug repariert werden. Jedes Ziel sagt, was es war: `would_write`, `refused` mit den Worten des Gates oder `not_sent`.

### 2. In Reihenfolge geschrieben, eine Aufruf-ID, nie zurückgerollt

Dann gehen die Ziele der Reihe nach hinaus, jedes über `Services.Call` und damit über `runtime.Manager.Write`, das eine Schreib-Gate. Es gibt keine Seitentür. Jeder Schreibzugriff trägt die **Aufruf-ID** der Anwendung, sodass die ganze Anwendung `GET /api/writes?call=<id>` ist, im Prüfpfad, neben jedem anderen Schreibzugriff, den das Werk je angenommen hat.

Eine Prüfung kann bestehen, und der Schreibzugriff schlägt einen Moment später trotzdem fehl. Eine SPS beantwortet einen Schreibzugriff mit einer Ausnahme. Ein Kabel wird herausgetreten. Jemand entschärft ein Tag zwischen Prüfung und Schreibzugriff. **Das erste Ziel, das nicht durchgeht, stoppt die Anwendung.** Die danach werden nicht gesendet und tragen `skipped`.

**Nichts bereits Geschriebenes wird rückgängig gemacht.** Das ist Absicht, und es ist die Regel, der jeder HotLoop-Schreibzugriff folgt. Das Rückgängigmachen ist selbst ein Schreibzugriff: ausgeführt, ohne dass jemand darum bittet, auf Anlagen, die sich schon bewegt haben, auf Grundlage dessen, was wir für den früheren Wert halten, genau in dem Moment, in dem etwas gerade bewiesen hat, dass sich das Werk nicht so verhält, wie wir es erwartet haben. So wird aus einem halb angewendeten Rezept eine völlig verwirrte Linie. Zu entscheiden, was mit einem halb angewendeten Rezept zu tun ist, ist Sache des Bedieners, und er bekommt genau die Informationen dafür:

```text
PARTIAL v3: 2 of 5 written before one failed, nothing undone
  1. set_mode loop.line_02_die_tic: written, verified
  2. set_setpoint loop.line_02_die_tic: written, verified
  3. set_value number.line_02_speed: failed: the device answered the write with an exception
  4. turn_on switch.line_02_heater: skipped
  5. select_option input_select.product: skipped
```

Ein Ziel ist `written`, `failed` (es ging hinaus, und das Gerät sagte nein oder nichts, sodass nicht bekannt ist, ob es übernommen wurde), `not_sent` (das Gate hat es im letzten Moment abgewiesen) oder `skipped`. Die Anwendung ist `applied` (jedes Ziel geschrieben), `partial` (einige waren es) oder `failed` (das erste nicht).

Der Bildschirm Rezepte bietet dann **Verbleibende Ziele anwenden** an. Das ist eine neue Anwendung der Ziele, die nicht geschrieben wurden, mit derselben Version und denselben Parametern, zuerst wieder als Ganzes geprüft, unter einer eigenen Aufruf-ID protokolliert, mit `application:<id>` als Elternteil, damit die beiden zusammen gefunden werden. Sie ist nie automatisch. Jemand schaut sich an, was passiert ist, behebt, was es gestoppt hat, und drückt die Taste.

### 3. Zurückgelesen

Geschrieben ist nicht dasselbe wie übernommen. Eine SPS kann einen Schreibzugriff annehmen, und ihre eigene Logik überschreibt ihn im nächsten Zyklus. Ein skaliertes Register kann 12,34 annehmen und 12,3 halten. Deshalb wird nach dem letzten Schreibzugriff jeder geschriebene Wert zurückgelesen:

- bei einem Ziel auf einem Gerät nur aus einer Messung, die **nach seinem Schreibzugriff genommen** wurde, damit der Zwischenspeicher, der sich merkt, was das Gerät zuvor gesagt hat, nichts bestätigen kann;
- aus dem Zustand der Entität oder, bei einem Ventil, einem Motor und einem Regelkreis, aus dem Attribut, das der Dienst setzt (`current_position`, `speed`, `setpoint`, `mode`);
- eine Zahl bis auf ein Millionstel ihrer selbst (ein Gleitkommaregister gibt 0,1 als 0,10000000149 zurück, was derselbe Sollwert ist), alles andere exakt.

Jedes geschriebene Ziel ist **`verified`**, sobald es zurückgelesen wurde, oder **`unconfirmed`**, wenn das innerhalb von `verify_sec` nicht geschehen ist, mit dem, was stattdessen gelesen wurde:

```text
  3. set_value number.line_02_speed: written, unconfirmed (not confirmed within 10s: read back 240, not 250)
```

Unbestätigt wird auf dem Bildschirm Rezepte **bernsteinfarben** angezeigt, nie grün, und ist eine Warnung im Logbuch und im Systemprotokoll. Es ist kein Fehler: Der Wert ging hinaus, das Gerät hat ihn angenommen, und die Anwendung ist weiterhin `applied`. Es ist ein Hinweis, der sagt: Schauen Sie nach, denn es kann sein, dass er nicht übernommen wurde. Ein Helfer hält seinen eigenen Wert, deshalb wird ein Helfer-Ziel direkt aus ihm verifiziert.

Die Antwort kommt, sobald das Zurücklesen fertig ist, sodass das Anwenden eines Rezepts bis zu `verify_sec` dauert.

## Überschneidung

Zwei Rezepte, die ihre Schreibzugriffe auf denselben Sollwert verschränken, lassen ihn bei dem, der zuletzt ankam, und das ist niemandes Rezept. Deshalb hält eine Anwendung, solange sie schreibt und zurückliest, jede Entität fest, die sie anspricht, und eine andere Anwendung, die eine davon anspricht, wird abgelehnt, `409`, mit dem Rezept, das im Weg ist. Warten Sie darauf, dann wenden Sie an.

Das wird im Prozess gehalten: Eine Anwendung vom Gateway und eine von einem `--mcp-stdio`-Prozess daneben halten sich nicht gegenseitig auf. Fahren Sie einen Schreiber, oder halten Sie die Rezepte des Agenten und die der Bediener auf verschiedenen Anlagen.

## Versionen

Name, Beschreibung, Anlagenknoten und Recht eines Rezepts gehören dem Rezept und ändern sich an Ort und Stelle. **Was es schreibt, ist eine Version, und eine Version wird nie geändert.** Das Speichern anderer Ziele, anderer Parameter, einer anderen Vorbedingung oder eines anderen `verify_sec` legt die nächste Version ab und macht sie zur aktuellen. Version 3 ist für immer genau das, was sie an dem Tag war, an dem sie gespeichert wurde, und jede Anwendung hält die Version und die Parameter fest, mit denen sie lief. Was letzten Dienstag ans Werk ging, lässt sich immer beantworten.

- Nur den Namen oder nur die Notiz zu ändern, erzeugt keine Version.
- Ein Speichern auf eine Version, die jemand anderes inzwischen ersetzt hat, wird abgelehnt, `409`, statt seine Änderung stillschweigend wegzuwerfen. Der Editor sendet die Version, die er bearbeitet hat.
- Eine ältere Version kann absichtlich angewendet werden: Wählen Sie sie in der Anwenden-Schublade, oder `"version": 2`. Die Anwendung gibt an, dass es Version 2 war.
- Die Schublade Versionen zeigt jede Version mit dem, der sie gespeichert hat, seiner Notiz und dem, was sich gegenüber der vorherigen geändert hat, Ziel für Ziel.

Das Löschen eines Rezepts löscht seine Versionen. Seine Anwendungen bleiben erhalten: Sie sind das, was ans Werk gesendet wurde, und dieser Verlauf überlebt das Rezept.

## Eines erfassen

Niemand schreibt ein Rezept mit vierzig Zielen von Hand, wenn die Linie schon Sorte A fährt. **Erfassen** nimmt die Entitäten, die Sie auswählen, und entwirft ein Rezept, das jede davon auf das zurücksetzt, was sie gerade enthält, in der Reihenfolge, in der Sie sie ausgewählt haben: den Wert einer Zahl, das Ein oder Aus eines Schalters, die Option einer Auswahl, die Stellung eines Ventils, die Drehzahl eines Motors, den Modus eines Regelkreises und dann seinen Sollwert. Sie benennen es, stutzen es, machen die Zahlen, die sich pro Auftrag ändern, zu Parametern und speichern.

Eine Entität, deren Wert nicht bekannt ist oder dem nicht zu trauen ist, wird **abgelehnt, nicht erfasst**: ein Messwert mit einer anderen Qualität als gut, `unknown`, `unavailable`, eine deaktivierte Entität. Ein Rezept, das aus einem schlechten Messwert gebaut wurde, schreibt diesen schlechten Messwert jedes Mal ins Werk zurück, wenn jemand es anwendet.

## Wer eines anwenden darf

Bediener wenden Rezepte an (`recipes.apply`); Administratoren schreiben sie (`recipes.write`); alle lesen sie (`recipes.read`). Sorte A zu laden, dafür ist der Bediener da. Zu entscheiden, was Sorte A ist, ist Sache des Ingenieurs.

Ein Rezept kann ein engeres eigenes Recht nennen: `"apply_permission": "recipes.apply.night_setback"`. Dann erfordert das Anwenden auch dieses, das die Rolle Bediener nicht hat. Geben Sie es den Personen, die dieses Rezept anwenden dürfen, über ihre eigene Rechteliste:

```json
["recipes.read", "recipes.apply", "recipes.apply.night_setback"]
```

`recipes.apply.*` gewährt das jedes Rezepts, und ein Administrator hat alles. Ein Benutzer ohne es wird abgelehnt, und **die Ablehnung ist aktenkundig**: eine abgelehnte Anwendung im Verlauf des Rezepts, mit seinem Namen, wie jede andere. Dasselbe gilt über die scene-Entität.

Ein Agent hat die Rechte keines Benutzers, deshalb **wendet ein Agent nie ein Rezept an, das ein eigenes Recht nennt**. Er kann es lesen und fragen, ob es angewendet würde; die Antwort sagt, warum nicht.

## Die Vorbedingung

```json
"precondition": "states['input_boolean.line_ready'] == 'on' and float(states['sensor.line_02_die_temp']) < 250"
```

Die Sprache der Automatisierung, ausgewertet gegen das Werk, wie es ist, wenn jemand Anwenden drückt, mit den Parametern als `vars`. Falsch lehnt das Rezept ab und sagt es. Es ist ein Schutz davor, die richtigen Zahlen im falschen Moment anzuwenden, keine Verriegelung: Eine Verriegelung lebt in der SPS, wo sie noch funktioniert, wenn das Netzwerk es nicht mehr tut.

## Aus einer Regel, einem Skript oder von einem Agenten

Eine Regel oder ein Skript wendet eines mit einem `apply_recipe`-Schritt an (siehe [Automatisierungen](/de/iot/automations/)):

```json
{"type": "apply_recipe", "params": {"recipeId": "grade_a", "params": {"speed": 250}}}
```

Es wendet es als die Regel, `automation:<id>`, oder das Skript, `script:<id>`, an, mit der Quelle dieses Laufs bei jedem Schreibzugriff, und das Elternteil der Anwendung ist der Lauf. Der Schritt schlägt fehl, sofern nicht jedes Ziel geschrieben wurde; ein unbestätigter Wert lässt ihn nicht fehlschlagen, und das Ablaufprotokoll sagt `NOT confirmed by read-back`. Der Probelauf eines Skripts prüft das Rezept ebenfalls.

Über MCP zeigt `list_recipes` jedes Rezept mit seinen Zielen und Parametern, `validate_recipe` fragt, ob eines jetzt angewendet würde, und `apply_recipe` wendet es an, mit einem **erforderlichen** Grund. Die Schreibzugriffe eines Agenten tragen die Quelle `mcp`, sodass das Gate für jeden davon gilt, und bei ausgeschalteten Schreibzugriffen (`HOTLOOP_ALLOW_WRITES`) wird `apply_recipe` abgelehnt, bevor irgendetwas geprüft wird. Siehe [MCP](/de/iot/mcp/#recipes).

## Seine Entität

Jedes Rezept ist eine `scene`-Entität, `scene.<id>`. Ihr Zustand ist, wann es zuletzt angewendet wurde (eine Anwendung, die etwas geschrieben hat), als Zeitstempel, und `unknown`, bis es je angewendet wurde. Ihre Attribute sagen, wie die neueste Anwendung verlief: `last_result`, `last_version`, `last_applied_by`, `last_application` und `unconfirmed`, wenn so viele Werte einer angewendeten nicht zurückgelesen wurden. Ihre Kachel hat eine Taste Anwenden. `scene.turn_on` wendet es an, mit `params` und `version` in den Daten. Eine Regel kann auf seinen Zustand auslösen, der sich einmal pro Anwendung bewegt, die etwas geschrieben hat.

Das Löschen eines Rezepts macht seine Entität zur Waise, so wie das Löschen eines Skripts.

## Das Protokoll

Jede Anwendung, abgelehnte eingeschlossen, ist eine Zeile in `recipe_applications`: das Rezept, die Version, die Parameter, wer, woher, warum, die Aufruf-ID, was aus jedem Ziel wurde und ob es zurückgelesen wurde. Sie wird vor dem ersten Schreibzugriff geöffnet und nach dem Zurücklesen abgeschlossen, sodass eine, bei der der Prozess mittendrin stirbt, trotzdem sagt, dass sie begonnen hat. Der nächste Start des Gateways markiert sie als `failed`, `interrupted by restart`, mit Verweis auf ihre Aufruf-ID im Schreibprotokoll. Nichts setzt sie fort.

Jede Anwendung ist eine Zeile im Systemprotokoll unter der Szene und ein Eintrag im [Logbuch](/de/iot/logbook/), Art `recipe`, neben den Schreibzugriffen, die sie gemacht hat. Der Verlauf eines Rezepts behält seine neuesten 5000 Anwendungen.

## Mehr als ein Prozess

Jede Änderung an einem Rezept und jede Anwendung wird jedem Prozess an der Datenbank angekündigt, sodass ein auf einem Pod gespeichertes Rezept das ist, das der andere anwendet, und eine Anwendung, die ein `--mcp-stdio`-Prozess macht, die scene-Entität des Gateways bewegt.

## Backups

Rezepte, jede Version und jede Anwendung sind in den Backups und kommen genau so zurück, wie sie waren. Eine Anwendung, die das Backup mittendrin erwischt hat, kommt als `applying` zurück und wird beim ersten Start als `failed` markiert, wie nach einem Absturz. Siehe [Backup und Wiederherstellung](/de/iot/backup/).

## Die API

[Die HTTP-API](/de/iot/api/#recipes) hat jede Route. Kurz:

| <span class="sr-only">Details</span> | <span class="sr-only">Details</span> |
|---|---|
| `GET /api/recipes` | jedes Rezept, sein aktueller Inhalt und seine letzte Anwendung |
| `POST /api/recipes` | eines anlegen, als Version 1 |
| `POST /api/recipes/capture` | ein Entwurf aus dem, was Entitäten jetzt halten |
| `PUT /api/recipes/{id}` | speichern; neuer Inhalt ist eine neue Version |
| `GET /api/recipes/{id}/versions` | jede Version, wie gespeichert |
| `POST /api/recipes/{id}/validate` | würde es jetzt angewendet? nichts wird geschrieben |
| `POST /api/recipes/{id}/apply` | anwenden: `200` angewendet, `409` abgelehnt, `502` teilweise oder fehlgeschlagen |
| `GET /api/recipes/{id}/applications` | jede Anwendung, Ablehnungen eingeschlossen |
