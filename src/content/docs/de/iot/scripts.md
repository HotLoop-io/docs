---
title: "Skripte"
description: "Einen Ablauf einmal schreiben, benennen und aus Regel, Bildschirm oder MCP starten. Der Probelauf geht durchs echte Schreib-Gate, bevor sich etwas bewegt."
---

Ein Skript ist eine Folge von Schritten mit einem Namen. Der CIP-Zyklus. Das Spülen der Linie. Der Wechsel auf Produkt B. Jedes Werk hat eine Handvoll Abläufe, die es jedes Mal genau gleich fährt, und der Tag, an dem jemand einen in eine vierte Automatisierung kopiert und einen Schritt nur in dreien davon korrigiert, ist der Tag, an dem es Sie erwischt. Also schreiben Sie ihn einmal, geben ihm einen Namen, und alles, was ihn braucht, ruft ihn unter diesem Namen auf: ein Bediener vom Bildschirm Skripte aus, eine Regel mit einem `call_script`-Schritt, ein Agent mit `run_script`, alles Mögliche über `POST /api/services/script/turn_on`.

Ein Skript spricht die Sprache der Automatisierung, läuft auf demselben Ablaufwerk wie die Aktionen einer Regel, und jeder Schreibzugriff, den es macht, geht durch das eine Schreib-Gate. Keine Seitentür. Es hatte nie eine.

## Wie eines aussieht

```json
{
  "id": "cip_cycle",
  "name": "CIP cycle",
  "description": "Caustic wash, rinse, done. Tank must be empty.",
  "fields": [
    {"name": "minutes", "label": "Wash time", "type": "number", "min": 5, "max": 60, "step": 5, "unit": "min", "required": true},
    {"name": "circuit", "type": "select", "options": ["tank_1", "tank_2"], "default": "tank_1"}
  ],
  "sequence": [
    {"type": "condition", "params": {"expression": "float(states['sensor.cip_tank_level']) < 5"}},
    {"type": "call_service", "params": {"entityId": "switch.cip_pump", "service": "switch.turn_on"}},
    {"type": "delay", "params": {"seconds": 5}},
    {"type": "wait", "params": {"expression": "float(states['sensor.cip_return_temp']) > 70", "timeoutSec": 900}},
    {"type": "log_event", "params": {"message": "CIP on {{ vars.circuit }} for {{ vars.minutes }} minutes"}},
    {"type": "call_service", "params": {"entityId": "switch.cip_pump", "service": "switch.turn_off"}}
  ],
  "mode": "skip",
  "maxRuntimeSec": 1800
}
```

- **`id`** besteht aus Kleinbuchstaben, Ziffern und Unterstrichen und beginnt mit einem Buchstaben. Es ist auch die Objekt-ID seiner Entität, dieses hier ist also `script.cip_cycle`, und es ändert sich nie.
- **`fields`** sind das, was ein Lauf entgegennimmt. Dieselben typisierten Eingaben wie überall in HotLoop (`model.Field`): `number` mit `min`, `max`, `step` und `unit`, `text` mit `max_length` und `pattern`, `boolean`, `select` mit `options`, `entity` mit den `domain`-Werten, die es annimmt, `duration` (Sekunden oder `90s`, `1h30m`), `alarm` und `tag`. Jedes kann `required` sein oder einen `default` haben, und ein Standardwert, den sein eigenes Feld ablehnen würde, wird beim Speichern abgelehnt. Ein Schritt liest ein Feld als `vars.<name>`.
- **`sequence`** ist die Sprache der Automatisierung, vollständig: `call_service`, `write_tag`, `condition`, `wait`, `stop`, `call_script`, `set_variable`, `delay`, `log_event` und der Rest. [Automatisierungen](/de/iot/automations/) hat jeden Schritt.
- **`mode`** und **`maxRuntimeSec`** stehen weiter unten.

Ein Skript wird beim Speichern kompiliert, wie eine Regel: ein Schritt, der sich nicht dekodieren lässt, ein Ausdruck, der nicht kompiliert, eine Wartezeit, die länger ist, als ein Lauf dauern darf, ein Feld, das keinen Sinn ergibt, alles wird beim Speichern abgelehnt. Sie erfahren es im Editor, nicht um 3 Uhr nachts, wenn die Pumpe mitten in der Reinigung steht.

## Felder werden geprüft, nie korrigiert

Bevor der erste Schritt läuft, wird das, was dem Lauf übergeben wurde, gegen die Felder geprüft: Jeder Wert muss einer sein, den sein Feld annimmt, jeder Pflichtwert muss vorhanden sein, und ein Feld, das das Skript nicht hat, ist ein Fehler und nichts, was stillschweigend ignoriert wird. **Ein Wert wird nie zurechtgebogen.** 70 Minuten in einem Feld mit dem Maximum 60 werden abgelehnt, nicht auf 60 gekürzt; `"12"` für eine Zahl wird abgelehnt, nicht umgedeutet; 12,5 bei einer Schrittweite von 5 wird abgelehnt, nicht gerundet. Der Wert, der weiter zur Ansteuerung der Anlagen geht, ist genau der, den jemand eingegeben hat, oder es läuft gar nichts. Ein abgelehnter Lauf hinterlässt keinen Lauf: Nichts wurde gestartet.

## Eines starten

| Von | Wie | Benötigt |
|---|---|---|
| Der Bildschirm Skripte | **Ausführen** auf der Karte, das Formular ausfüllen | `scripts.run` |
| Seine Entität | **Ausführen** auf der Kachel oder `POST /api/services/script/turn_on` mit den Feldern als Daten | `scripts.run` |
| Die API | `POST /api/scripts/{id}/run` mit `{"fields": {...}, "reason": "..."}` | `scripts.run` |
| Eine Regel | ein `call_script`-Schritt | das Recht der Regel selbst |
| Ein Agent | `run_script` über MCP | MCP-Schreibzugriffe an |

Bediener führen Skripte aus. Administratoren schreiben sie. Den CIP-Zyklus zu fahren, dafür ist der Knopf da; zu entscheiden, welche Ventile der CIP-Zyklus öffnet, ist eine Entscheidung des Ingenieurs und bleibt es.

Ein Lauf antwortet, sobald er gestartet ist, mit seiner ID. Bitten Sie ihn zu warten (`wait`), und er antwortet, wenn er endet, mit seinem Ergebnis und dem Ablaufprotokoll jedes Schritts. **Stopp** (`POST /api/scripts/{id}/stop` oder `script.turn_off`) bricht jeden Lauf davon dort ab, wo er steht, in jedem Prozess, eine Wartezeit oder Verzögerung eingeschlossen. Was ein Schritt schon geschrieben hatte, bleibt geschrieben. Das Rückgängigmachen ist ebenfalls ein Schreibzugriff, ausgeführt, ohne dass es jemand verlangt hat, auf Anlagen, die sich schon bewegt haben, und das ist die Entscheidung des Bedieners, nicht unsere.

## Jeder Schreibzugriff geht durch das Gate

Ein Skript läuft als **`script:<id>`**. Jeder Schreibzugriff, jeder Dienstaufruf, jede Protokollzeile trägt das als Akteur, und jeder Schreibzugriff wird darauf in `GET /api/writes` protokolliert, abgelehnt oder nicht. Die **Quelle** ist, wer es gestartet hat: `ui` vom Bildschirm, `automation` von einer Regel, `mcp` von einem Agenten. Das ist wichtig, weil das Gate nach der Quelle entscheidet. Ein Skript, das ein Agent startet, schreibt als `mcp`, und bei ausgeschaltetem `HOTLOOP_ALLOW_WRITES` wird jeder seiner Schreibzugriffe abgelehnt, genau wie das `write_tag` des Agenten selbst. `run_script` und das `script.turn_on` eines Agenten lehnen in diesem Fall gleich zu Beginn ab, statt ein Skript zu starten, dessen Schreibzugriffe alle abprallen werden.

Der Lauf hält fest, wer ihn angefordert hat (`actor`), wie (`source`) und was ihn aufgerufen hat (`parent`: `automation_run:812`, `script_run:77`), sodass Sie von einem Schreibzugriff zurück zur Regel, zum Skript und zu der Person oder dem Agenten dahinter gehen können.

## Erst fragen: der Probelauf

`POST /api/scripts/{id}/run?dry_run=true`, **Zuerst prüfen** in der Lauf-Schublade oder `run_script` mit `dryRun`. Die Felder werden genauso geprüft, dann wird jeder Schritt gegen das Werk durchlaufen, wie es gerade jetzt ist:

- jedes `write_tag` und `call_service` wird den eigenen Prüfungen des Schreib-Gates vorgelegt (`CheckWrite`, `Services.Check`), demselben Code, den der echte Schreibzugriff ausführt, sodass ein Probelauf nicht Ja zu etwas sagen kann, das der echte Schreibzugriff aus einem Grund ablehnen würde, den der Probelauf nicht geprüft hat. Es wird nichts geschrieben, nichts protokolliert;
- eine `condition` wird jetzt ausgewertet, und eine falsche beendet den Durchlauf dort, wo sie den Lauf beenden würde;
- ein `set_variable` wird gebunden, sodass die Schritte danach sehen, was sie sehen würden;
- ein `call_script` durchläuft das Skript, das es aufruft, seine Schritte unter dem Aufruf nummeriert (`3.1`, `3.2`);
- ein `wait`, ein `delay` und alles, was in keine Anlage schreibt (eine Nachricht, ein HTTP-Aufruf, ein ausgelöster Alarm), ist `not_checked`. Ein Probelauf wartet keine fünfzehn Minuten, um Ihnen zu sagen, was der Tank dann anzeigen wird.

Der erste Schreibzugriff, der abgelehnt würde, beendet den Durchlauf, weil er den Lauf beenden würde, und die Antwort sagt das in den Worten des Gates: `step 2 (call_service): cip/pump: this tag is not marked writable`. Ein Probelauf, der sauber zurückkommt, ist ein Rat, kein Versprechen. Ein Gerät kann ausfallen, jemand kann ein Tag entschärfen, und eine Wartezeit gibt dem Werk alle Zeit, die es braucht, um es sich zwischen Ihrer Prüfung und dem Schritt anders zu überlegen.

## Betriebsarten eines Laufs

Was ein Lauf bewirkt, der angefordert wird, während ein anderer Lauf desselben Skripts läuft. Dieselben Worte wie bei einer Regel, mit einem Unterschied.

| Modus | Ein zweiter Lauf |
|---|---|
| `skip` | abgelehnt, `409`, und ein Lauf `skipped` im Verlauf, der sagt, warum. **Der Standard**, und die richtige Antwort für alles, was Anlagen ansteuert |
| `queue` | wartet, bis er dran ist, und startet, wenn der vor ihm beendet ist. Nur eine Stelle tief: Ein dritter wird abgelehnt |
| `restart` | bricht den laufenden dort ab, wo er steht, und startet, sobald er gestoppt ist. Zwei Läufe überlappen sich nie |
| `parallel` | läuft nebenher |

Der Unterschied: Die Warteschlange einer Regel verwirft den älteren wartenden Lauf stillschweigend, und die Warteschlange eines Skripts lehnt den neueren laut ab. Eine Regel wird von einem Auslöser gefeuert, dem das egal ist. Ein Skript wird von jemandem oder etwas angefordert, der oder das auf die Antwort warten kann, und „Ihr Lauf hat einfach nie stattgefunden“ ist keine Antwort.

Ein `call_script`-Schritt, der auf ein beschäftigtes Skript wartet, schlägt fehl (`script busy`); einer, der nicht wartet, vermerkt es im Ablaufprotokoll und macht weiter, denn alles, was er je tun sollte, war, es zu starten.

`maxRuntimeSec` begrenzt einen Lauf, fünf Minuten, wenn es null ist. Ein Lauf, der es aufbraucht, wird `timed_out`, ob er zwischen zwei Schritten war oder mitten in einer Wartezeit.

## Skripte, die Skripte aufrufen

Ein `call_script`-Schritt führt ein Skript aus einer Regel oder aus einem anderen Skript aus. Mit `wait` übernimmt der Schritt das Ergebnis des Skripts als sein eigenes, und das Skript ist Teil des Laufs, der es aufgerufen hat: Brechen Sie den Aufrufer ab oder lassen Sie ihm die Zeit ablaufen, und das Skript, auf das er wartet, stoppt ebenfalls. Ohne `wait` wird das Skript gestartet und sich selbst überlassen, bis es fertig ist.

Zwei Grenzen, beide da, weil die Alternative ein Skript ist, das in einer Schleife läuft:

- **Ein Skript, das sich selbst aufrufen würde, wird beim Speichern abgelehnt**, direkt oder über eine beliebige Kette anderer Skripte: `script b would call itself: b calls a calls b`. Dasselbe gilt für eine Änderung, die eine Schleife schließt.
- **Fünf Ebenen tief, zur Laufzeit.** Ein sechstes Skript in einer Kette lässt den Schritt fehlschlagen, der es aufgerufen hätte, und die Kette mit ihm. Und sollte eine Schleife je am Speichern vorbeikommen (zwei Prozesse, die zwei Hälften im selben Moment speichern), fängt der Lauf sie ab: Ein Skript, das in seiner eigenen Kette schon läuft, wird abgelehnt und nicht ein zweites Mal ausgeführt.

## Seine Entität

Jedes Skript ist eine Entität, `script.<id>`, Plattform `script`. Ihr Zustand ist `on`, solange ein Lauf davon läuft, in irgendeinem Prozess, und `off`, wenn keiner läuft; ihre Attribute tragen ihren `mode`, wie viele Läufe laufen (`current`), ihre `fields` sowie wann es zuletzt gestartet wurde und wie es endete. Sie steht auf dem Bildschirm Entitäten mit einem Knopf **Ausführen**, in `list_entities` über MCP, in `/api/states`, und eine Regel kann einen Zustandsauslöser darauf haben: „wenn der CIP-Zyklus ausgeht, protokolliere die Charge“. Das Löschen eines Skripts macht seine Entität zur Waise, so wie das Löschen einer Alarmdefinition: Ein Administrator löscht die Waise, wenn nichts mehr auf sie verweist.

## Der Laufverlauf

Jeder Lauf ist eine Zeile in `script_runs`: wer, wie, die Felder, die er nach der Prüfung erhalten hat, das Ablaufprotokoll jedes Schritts (aufgelöste Eingaben, keine Vorlagen), wie er endete und warum. `GET /api/scripts/{id}/runs`, die Lauf-Schublade und das [Logbuch](/de/iot/logbook/), wo Skriptläufe die Art `script` haben und über die Entität des Skripts oder über alles gefunden werden, worin ein Lauf geschrieben hat. Der Verlauf behält die neuesten 500 Läufe jedes Skripts, dieselbe Grenze wie bei Läufen von Automatisierungen.

Die Zeile eines Laufs wird vor seinem ersten Schritt geöffnet und nach seinem letzten abgeschlossen. Wird der Prozess beendet, bricht er jeden laufenden Lauf dort ab, wo er steht, und hält ihn als `cancelled: interrupted by restart` fest. Ein Lauf, den ein Absturz abgeschnitten hat und für den niemand mehr seine Zeile abschließt, wird beim nächsten Start des Gateways genauso markiert. **Nichts setzt einen Lauf fort.** Eine Stunde später ungefragt bei Schritt vier eines CIP-Zyklus weiterzumachen, bei einem Werk, das sich weiterentwickelt hat, ist schlimmer, als zu sagen, dass er angehalten hat.

## Mehr als ein Prozess

Das Gateway und ein `--mcp-stdio`-Prozess daneben (oder zwei Pods mitten in einem Rollout) führen beide Skripte aus. Der Zustand eines Laufs liegt in der Datenbank, und jeder Prozess hört auf Änderungen an `hotloop_script`, daher:

- ein in einem Prozess gestartetes Skript zeigt `on` in der Entität jedes Prozesses;
- ein auf einem Pod gespeichertes Skript ist das Skript auf dem anderen, und seine Läufe dort werden abgebrochen, wenn sich seine Schritte geändert haben;
- **Stopp** stoppt jeden Lauf davon, in jedem Prozess.

Die Betriebsart eines Laufs wird je Prozess geführt. Zwei Prozesse können im selben Augenblick je einen Lauf eines `skip`-Skripts starten. Ein Werk, das in derselben Sekunde denselben Ablauf aus dem Hilfsprozess eines Agenten und vom Bildschirm des Bedieners fährt, hat ein Gespräch zu führen, das keine Sperre von uns klären würde.

## Backups

`scripts` und `script_runs` sind in jedem Backup und kommen bei einer Wiederherstellung zurück, mit dem Verlauf. Ein Lauf, den das Backup mittendrin erwischt hat, kommt als `running` zurück und wird beim ersten Start als `interrupted by restart` markiert, wie jeder andere. Siehe [Backup und Wiederherstellung](/de/iot/backup/).

## Die API

Jede Route, ihr Recht und ihre Antworten stehen in [der HTTP-API](/de/iot/api/#scripts).

| Recht | Betrachter | Bediener | Administrator |
|---|---|---|---|
| `scripts.read`: sie auflisten, ihre Läufe | ja | ja | ja |
| `scripts.run`: ausführen, Probelauf, stoppen, `script.turn_on`/`turn_off` | nein | ja | ja |
| `scripts.write`: erstellen, bearbeiten, löschen | nein | nein | ja |
