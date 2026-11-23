---
title: "Automatisierungen"
description: "Regeln mit zehn Auslösertypen, Bedingungen und Abläufen, beim Speichern kompiliert, jeder Schreibzugriff läuft durch das Schreib-Gate."
---

Eine Regel besteht aus drei Dingen: Etwas passiert, eine Bedingung trifft zu, Aktionen laufen.

Regeln können Anlagen steuern, deshalb sind zwei Eigenschaften nicht verhandelbar.

**Bedingungen werden beim Speichern der Regel kompiliert, nicht wenn sie auslöst.** Einen Syntaxfehler sieht der Autor, solange er noch auf den Editor schaut, statt einer Regel, die still nie läuft oder, schlimmer, nachts um 3 Uhr mitten in einem Ablauf abbricht, der schon halb ausgeführt ist. Der Editor prüft beim Tippen; eine Regel, die nicht kompiliert, wird beim Speichern abgelehnt.

**Bedingungen werden in einer Sandbox ausgewertet.** [expr-lang](https://expr-lang.org) hat keine E/A, kann weder das Dateisystem noch das Netzwerk erreichen, prüft Typen beim Kompilieren und endet garantiert. Diese letzte Eigenschaft zählt am meisten: Eine Bedingung wird auf dem Weg ausgewertet, der zu einem Schreibzugriff führt, und eine Ausdruckssprache, die endlos laufen kann, kann die Engine blockieren, die die Schreibsperre hält.

## Auslöser

Es genügt, dass ein einziger Auslöser feuert, damit die Regel läuft.

| Typ | Löst aus, wenn | Schlüsselfelder |
|---|---|---|
| `tag_change` | sich der Wert eines Tags ändert | `deviceId`, `tagName` |
| `threshold` | ein Wert eine Grenze **überschreitet** | `deviceId`, `tagName`, `threshold`, `direction`, `hysteresis` |
| `state` | sich der Zustand einer Entität ändert oder eine Zeit lang gehalten wird | `entityId`, `from`, `to`, `forSec` |
| `schedule` | ein Cron-Ausdruck fällig wird | `cron` |
| `interval` | alle N Sekunden | `intervalSec` |
| `alarm` | ein Alarm in einen Zustand wechselt | `alarmId`, `alarmState` |
| `device_state` | ein Gerät sich verbindet oder abbricht | `deviceId`, `toState` |
| `webhook` | ein eingehender POST ankommt | `webhookPath` |
| `mqtt` | eine Nachricht auf einem Topic eintrifft | `topic` |
| `startup` | der Prozess startet | n/a |
| `sun` | Morgendämmerung, Sonnenaufgang, Sonnenmittag, Sonnenuntergang oder Abenddämmerung am Standort, auf Wunsch mit Versatz | `event`, `offsetSec` |

### Schwellwerte lösen beim Überschreiten aus

`threshold` löst aus, wenn ein Wert die Grenze *überschreitet*, nicht solange er darüber liegt. Bei "Wert liegt über 200" auszulösen hieße, dass die Regel bei jedem Zyklus feuert, in dem der Wert hoch bleibt, was bei einer Regel, die etwas steuert, ein Befehlssturm ist.

`hysteresis` verhindert, dass ein Wert, der an der Grenze schwankt, die Regel bei jedem Wackeln neu scharf stellt: Liegt er einmal darüber, muss er unter `threshold - hysteresis` fallen, bevor der Auslöser wieder feuern kann.

```json
{
  "type": "threshold",
  "deviceId": "press-01", "tagName": "Zone1_Temp",
  "threshold": 200, "direction": "rising", "hysteresis": 5
}
```

`direction` ist `rising`, `falling` oder `either`. Der erste Messwert nach dem Start legt eine Ausgangsbasis fest und löst nicht aus, sonst würde jede Schwellwertregel beim Hochfahren einmal feuern, egal welchen Wert sie hat.

### Zustandsauslöser folgen Entitäten

`state` löst aus, wenn sich die Zustandszeichenkette einer Entität ändert: `off` zu `on`, `212.5` zu `213`, `on` zu `unavailable`. `from` und `to` grenzen es ein. Lässt man beide weg, löst es bei jeder Änderung aus, auch von und nach `unavailable`, was meist das ist, was man für "jemandem Bescheid sagen" will, und nie das, was man für "etwas steuern" will. Geben Sie `to` an.

```json
{
  "type": "state",
  "entityId": "binary_sensor.press_01_run",
  "from": "off", "to": "on"
}
```

Es löst auf den Zustand aus und auf nichts sonst. Ein Attribut, das sich ändert, oder die Qualität, die schlecht wird, während der Zustand seinen letzten guten Wert hält, ist keine Zustandsänderung.

Hier steht genau, wann es auslöst, denn eine Regel, die Anlagen steuert, hat ein Recht darauf. Der Auslöser folgt der eigenen Aufzeichnung der Entitäten-Engine darüber, was sich geändert hat, nicht dem Tag-Bus. Die Engine berechnet den Zustand einer Entität, sobald Messwerte eintreffen, und berechnet einmal pro Sekunde alles neu, als Rückfallebene für einen Schwung, den sie nicht rechtzeitig schaffte. Jede Änderung, die sie berechnet, meldet sie einmal, der Reihe nach, und der Auslöser sieht jede davon. Also:

- **Er löst einmal pro Änderung aus.** Die Neuberechnung im Sekundentakt meldet nur, was sich seit dem letzten Blick der Engine bewegt hat, kann also keine Änderung doppelt melden, und ein Neuladen der Regeln setzt nichts zurück, wovon ein Zustandsauslöser abhängt.
- **Er verpasst keine Änderung, die die Engine gesehen hat.** Ein langsamer Bus kostet eine Sekunde Latenz, nicht die Änderung.
- **Er kann keine Änderung sehen, die niemand gesehen hat.** Eine Spule, die zwischen zwei Abfragen auf off, on, off geht, hat sich für die Anlage nie geändert. Ein Zustandsauslöser ist so gut wie der Scan dahinter und nicht besser. Wenn Sie jede Flanke eines schnellen Signals brauchen, speichern Sie sie in der SPS.
- **Der Start ist eine Ausgangsbasis.** Jede Entität, die erscheint, wenn das Gateway startet oder eine aktiviert wird, ist keine Änderung und löst nicht aus.

Falls Regeln je 10.000 Änderungen zurückliegen (die Datenbank ist zu langsam, die Läufe zu erfassen, die sie starten), werden die ältesten verworfen, gezählt und protokolliert, und `GET /api/diagnostics` zeigt `stateChangesPending` und `stateChangesDropped` unter `automations`.

Benennen Sie eine Entität um, und jede Regel, die ihre alte `entity_id` nennt, löst nicht mehr aus. Das ist der Preis für Namen, die etwas bedeuten; benennen Sie bewusst um und durchsuchen Sie vorher die Regeln.

### Einen Zustand halten: forSec

"Die Pumpe läuft seit fünf Minuten" ist ein Zustandsauslöser mit `forSec`. Die Änderung startet einen Timer, statt die Regel auszulösen; die Regel löst aus, wenn der Zustand, zu dem gewechselt wurde, so viele Sekunden gehalten hat.

```json
{
  "type": "state",
  "entityId": "binary_sensor.press_01_run",
  "from": "off", "to": "on",
  "forSec": 300
}
```

- **Jede Zustandsänderung bricht es ab.** On zu off und zurück zu on innerhalb der fünf Minuten sind zwei Änderungen: Die erste beendet das Halten, die zweite startet ein neues bei null. Es addiert keine Zeit. Ein Wechsel zu `unavailable` ist ebenfalls eine Zustandsänderung, ein Gerät, das mitten im Halten verstummt, bricht es also ab.
- **Nur der Zustand zählt.** Ein Attribut, das sich ändert, oder die Qualität, die schlecht wird, während der Zustand hält, bricht es nicht ab, genau wie es einen einfachen Zustandsauslöser nicht auslöst. Soll ein Halten einen schlechten Messwert nicht überleben, sichern Sie die Bedingung der Regel mit `qualities` ab.
- **Es löst einmal pro Halten aus.** Eine Stunde zu halten löst eine Fünf-Minuten-Regel einmal aus, nach fünf Minuten, nicht alle fünf Minuten.
- **Jede Regel hat ihren eigenen Timer**, einen pro Auslöser. Zwei Regeln auf derselben Entität mit unterschiedlichem `forSec` lösen jeweils zu ihrer eigenen Zeit aus.
- **Die Ablaufverfolgung sagt es.** Ein Lauf, den ein Halten ausgelöst hat, lautet `binary_sensor.press_01_run changed from off to on and held for 300s`, und `fromState`, `toState` und `entity` sind die der Änderung, die das Halten gestartet hat.
- **Ein Halten übersteht keinen Neustart.** Es liegt im Speicher, und nichts stellt es wieder scharf: Die Minuten, die eine Presse vor dem Neustart schon gehalten hatte, zählen danach nicht. Was der Prozess beim Zurückkommen sieht, ist, dass jede Entität erscheint (eine Ausgangsbasis, keine Änderung), meist als `unknown`, und dann der erste Messwert des Geräts, der sie auf den gelesenen Wert bringt. Mit `"from": "off"` passt das nicht, eine Presse, die vor dem Neustart lief, startet also kein Halten, und die Regel löst das nächste Mal aus, wenn die Presse von off auf on geht und fünf Minuten läuft. Ohne `from` hängt es von einem Wettlauf ab, den Sie nicht kontrollieren. Trifft der erste Messwert ein, nachdem die Regeln zuhören, ist es eine Änderung, `unknown` zu `on`, und sie startet ein Halten bei null: Die Regel löst fünf Minuten danach aus, und ihre Ablaufverfolgung lautet `changed from unknown to on`. Antwortet das Gerät schneller, als das Gateway hochkommt, ist die Presse einfach von Anfang an `on`, nichts hat sich geändert, und nichts löst aus, bis sie das nächste Mal wechselt. Geben Sie `from` an, wenn ein Neustart nicht als Start zählen soll, und schreiben Sie keine Regel, die darauf angewiesen ist. Das Bearbeiten, Deaktivieren oder Löschen der Regel verwirft auch ihre Haltephasen; das Speichern einer anderen Regel nicht.
- **Eine Entität, die mitten im Halten verschwindet** (deaktiviert oder mit ihrem Gerät gelöscht), löst es nie aus.

`forSec` beträgt höchstens einen Tag (86400), und nur ein `state`-Auslöser nimmt es an. Es wird beim Speichern geprüft wie alles andere.

### Sonnenauslöser

Hofbeleuchtung, Heizband, ein Parkplatz, alles, was interessiert, ob es draußen dunkel ist. `sun` löst an diesem Standort bei `dawn`, `sunrise`, `noon`, `sunset` oder `dusk` aus, verschoben um `offsetSec`: Negativ heißt davor, das hier ist also eine halbe Stunde vor Sonnenuntergang.

```json
{"type": "sun", "event": "sunset", "offsetSec": -1800}
```

- **Es wird auf der Box berechnet.** Aus Breiten- und Längengrad des Standorts (`HOTLOOP_SITE_LATITUDE`, `HOTLOOP_SITE_LONGITUDE`), mit den Sonnengleichungen der NOAA, ohne Dienst und ohne Internet. Ein Werk, das seine Anbindung verloren hat, schaltet die Lampen trotzdem in der Dämmerung ein. Siehe [die Sonne](/de/iot/sun/).
- **Kein Standort, nicht scharf.** Eine Regel mit Sonnenauslöser an einem Standort ohne Breiten- und Längengrad ist nicht scharf, und das Systemprotokoll nennt die zwei Variablen, die zu setzen sind. Früher war das die Art Sache, die ewig scharf und stumm herumsteht, und niemand merkt es, bis der Hof dunkel ist.
- **Es löst einmal pro Tagesereignis aus,** zur Zeit dieses Tages. Die Sonnenuntergänge im Oktober kommen jeden Abend etwa eine Minute früher, und der Auslöser folgt ihnen.
- **Morgen- und Abenddämmerung sind bürgerliche Dämmerung**, der Sonnenmittelpunkt 6 Grad unter dem Horizont. Das ist die Linie "dunkel genug für Licht", auf die Außenbeleuchtung ausgelegt wird.
- **Unter der Mitternachtssonne gibt es keinen Sonnenuntergang zum Auslösen**, ein Sonnenuntergangs-Auslöser wartet also auf den nächsten, egal wie viele Wochen entfernt, und löst dann aus.
- `offsetSec` beträgt höchstens sechs Stunden in jede Richtung (21600). Alles darüber ist ein `schedule`.

Die Ablaufverfolgung sagt, was ausgelöst hat und wann: `30m before sunset at 2026-10-01T22:38:00Z`, und `trigger` ist `sun` in der Bedingung.

## Bedingungen

Ein Ausdruck, der einen Boolean liefert. Leer heißt unbedingt.

Was ein Ausdruck sehen kann:

| Name | Bedeutung |
|---|---|
| `value`, `string`, `quality` | der Messwert, der die Regel ausgelöst hat |
| `previous` | der Messwert davor |
| `tag`, `device` | was sie ausgelöst hat |
| `tags["device/tag"]` | jeder aktuelle numerische Messwert |
| `strings["device/tag"]` | jeder aktuelle Textmesswert |
| `qualities["device/tag"]` | jede aktuelle Qualität |
| `states["sensor.x"]` | der Zustand jeder aktivierten Entität als Zeichenkette |
| `attrs["sensor.x"]["unit_of_measurement"]` | die Attribute jeder aktivierten Entität |
| `qualities["sensor.x"]` | die Qualität jeder Entität neben der der Tags (ein Tag-Schlüssel hat ein `/`, eine entity_id nie) |
| `entity`, `fromState`, `toState` | die Zustandsänderung, die die Regel ausgelöst hat |
| `alarm`, `alarmState` | der Alarm, der die Regel ausgelöst hat |
| `deviceState` | der Gerätezustand, der sie ausgelöst hat |
| `now`, `hour`, `minute`, `weekday` | die Uhr; weekday 0 ist Sonntag |
| `trigger` | welcher Auslöser gefeuert hat |
| `vars` | von früheren Schritten gebundene Werte |

```
value > 200
value > 200 and quality == 'good'
tags['press-01/Zone1_Temp'] > 200 and tags['press-01/Pressure'] < 50
hour >= 6 and hour < 18 and weekday != 0 and weekday != 6
qualities['press-01/Zone1_Temp'] == 'good'
strings['cnc-01/Program'] == 'PART_4471.NC'
value > previous
states['switch.press_01_pump'] == 'off' and toState == 'on'
float(states['sensor.press_01_zone1_temp']) > 200 and qualities['sensor.press_01_zone1_temp'] == 'good'
attrs['switch.press_01_pump']['armed'] == true
```

**Sichern Sie über die Qualität ab.** `value > 200` ist wahr für einen schlechten Messwert von 250, und ein schlechter Messwert ist einer, bei dem das System Ihnen sagt, dass es ihn nicht kennt. Schreiben Sie bei allem, was Anlagen steuert, `value > 200 and quality == 'good'`. Dasselbe gilt für Entitäten: Eine schlechte Entität zeigt weiter ihren letzten guten Wert, und `qualities['sensor.x']` ist der Weg, wie eine Regel das erkennt.

**Ein Zustand ist eine Zeichenkette.** Er ist `"212.5"`, `"on"` oder `"unavailable"`, nie eine Zahl, deshalb wird `states['sensor.x'] > 200` beim Speichern als Typfehler abgelehnt, statt als Vergleich gespeichert zu werden, der still immer falsch ist. Schreiben Sie `float(states['sensor.x']) > 200` und sichern Sie es ab: `float('unavailable')` ist ein Fehler, und eine Bedingung, die einen Fehler wirft, lässt den Lauf scheitern.

`string` ist der Messwert, der die Regel ausgelöst hat, also ist es nicht zugleich die `string()`-Funktion von expr-lang. Um eine Zahl in eine Zeichenkette zu setzen, nehmen Sie `toJSON(value)`.

Eine Bedingung muss einen Boolean liefern. Eine, die eine Zahl oder eine Zeichenkette liefert, wird beim Speichern abgelehnt, statt in eine Wahrheitsauslegung gezwungen zu werden, die niemand beabsichtigt hat.

## Aktionen

Aktionen laufen der Reihe nach. Ein fehlgeschlagener Schritt stoppt die Regel, es sei denn, er setzt `continueOnError`: Auf einen Schritt, der ein Ventil schließen sollte und es nicht tat, dürfen keine Schritte folgen, die ein geschlossenes Ventil voraussetzen.

### write_tag

```json
{
  "type": "write_tag",
  "params": {
    "deviceId": "press-01", "tagName": "Cooling",
    "value": true
  }
}
```

Oder berechnet:

```json
{
  "type": "write_tag",
  "params": {
    "deviceId": "press-01", "tagName": "Setpoint",
    "expression": "tags['press-01/Zone1_Temp'] - 10"
  }
}
```

**Das läuft durch dasselbe Gate wie alles andere.** Eine Automatisierung bekommt nicht mehr Rechte als ein Mensch: Schreibzugriffe müssen aktiviert sein, der Tag muss als beschreibbar markiert sein, der Wert muss im Bereich liegen, und der Versuch wird als `automation:<rule-id>` protokolliert.

### call_service

Steuert eine Entität über ihren Dienst, so wie es `POST /api/services/...` und das MCP-Werkzeug `call_service` tun. Siehe [Entitäten](/de/iot/entities/#services), was jede Domäne annimmt.

```json
{
  "type": "call_service",
  "params": {
    "entityId": "switch.press_01_pump",
    "service": "switch.turn_on"
  }
}
```

Mit Daten, literal oder berechnet:

```json
{
  "type": "call_service",
  "params": {
    "entityId": "number.press_01_zone1_sp",
    "service": "number.set_value",
    "dataExpressions": {"value": "float(states['sensor.press_01_zone1_temp']) - 10"}
  }
}
```

`service` ist `domain.service`, und seine Domäne muss die der Entität sein, eine Regel, die eine Zahl mit dem Dienst eines Schalters benennt, wird also beim Speichern abgelehnt. Ebenso ein Dienst, den die Domäne nicht annimmt, und die Liste dessen, was jede Domäne annimmt, kommt aus der Entitätsschicht selbst: Bekommt eine Domäne dort einen Dienst, können Regeln ihn ohne Änderung hier nutzen. `data` sind die literalen Dienstdaten; `dataExpressions` werden zur Laufzeit ausgewertet und darübergelegt.

Es ist `write_tag` mit einem Namen darauf. Der Aufruf wird zu Tag-Schreibzugriffen durch dasselbe Gate, protokolliert als `automation:<rule-id>` mit Entität, Dienst und Aufruf-ID in jeder Zeile. Eine Ablehnung (Schreiben aus, der Tag entschärft, ein Wert neben der Schrittweite der Entität) lässt den Schritt und den Lauf scheitern, mit der Ablehnung in der Ablaufverfolgung, genau wie ein abgelehntes `write_tag`, und jeder Schreibzugriff, den der Aufruf gemacht hat oder der ihm abgelehnt wurde, steht in der Ausgabe des Schritts. Ein Aufruf wird nie zurückgerollt: Ein zusammengesetzter, der zwei von drei Schreibzugriffen geschafft hat, bleibt dort stehen und sagt es.

### condition

Eine Bedingung mitten in einem Ablauf. Ist sie falsch, endet der Ablauf dort, und der Lauf war **erfolgreich**: Die Regel hat getan, wofür sie geschrieben wurde, nämlich anzuhalten. Die Ausgabe des Schritts lautet `false; the steps after this one did not run`.

```json
{
  "type": "condition",
  "params": {
    "expression": "states['binary_sensor.press_01_run'] == 'on' and qualities['binary_sensor.press_01_run'] == 'good'"
  }
}
```

Es ist nicht die `condition` der Regel. Jene wird einmal geprüft, bevor irgendetwas läuft, gegen die Anlage, wie sie war, als der Auslöser feuerte, und eine falsche verbucht den Lauf als übersprungen. Ein Bedingungsschritt liest die Anlage **so, wie sie ist, wenn der Schritt läuft**, was der Sinn von einem nach einem `delay` oder einem `wait` ist: "Läuft die Presse dreißig Sekunden später noch?" `entity`, `toState`, `value` und der Rest dessen, was die Regel ausgelöst hat, bleiben, wie sie waren, ebenso `vars`.

Eine Bedingung, die nicht ausgewertet werden kann (`float('unavailable')`), lässt den Schritt und den Lauf scheitern, wie die Bedingung der Regel. `continueOnError` wird bei einer Bedingung beim Speichern abgelehnt: Über eine hinweg weiterzumachen hieße, dass sie nie etwas anhält.

### wait

Hält den Ablauf an, bis ein Ausdruck wahr ist, höchstens `timeoutSec` lang.

```json
{
  "type": "wait",
  "params": {
    "expression": "states['binary_sensor.press_01_valve_closed'] == 'on'",
    "timeoutSec": 30
  }
}
```

Er schaut sofort, erneut **sobald sich eine vom Ausdruck genannte Entität ändert** (ihr Zustand, ihre Qualität oder ein Attribut), und in jedem Fall einmal pro Sekunde. Die Entitäten, die er beobachtet, sind die, die als Literale in `states['...']`, `attrs['...']` und `qualities['...']` stehen; ein Tag-Messwert, die Uhr oder eine anders benannte Entität wird vom Sekundenblick erfasst. Ein Warten auf eine Modbus-Spule ist also so schnell wie die Abfrage dahinter, nicht eine Sekunde zu spät.

Wird er wahr, läuft der nächste Schritt, und die Schritte danach sehen die Anlage so, wie das Warten sie zuletzt sah. Läuft zuerst die Zeit ab, **scheitert** der Schritt und der Lauf mit ihm, mit der Meldung `still false after 30s`, es sei denn, das Warten sagt, dass es weitergehen soll:

```json
{
  "type": "wait",
  "params": {
    "expression": "float(states['sensor.press_01_zone1_temp']) < 60",
    "timeoutSec": 240,
    "continueOnTimeout": true
  }
}
```

In beiden Fällen ist `vars.wait.completed` danach wahr oder falsch, und `vars.wait.waitedSec` ist die Wartedauer, sodass ein Bedingungsschritt nach einem Warten mit Weitermachen entscheiden kann: `vars.wait.completed == true`.

`timeoutSec` ist Pflicht und höchstens eine Stunde. Ein Warten ohne Ende hält seinen Laufplatz, bis das Budget des Laufs ihn nimmt, was unter `skip` heißt, dass die Regel nicht mehr auslöst. Es muss auch ins Budget des Laufs passen (`maxRuntimeSec`, standardmäßig fünf Minuten): Ein Warten von zehn Minuten braucht `"maxRuntimeSec": 900` oder so an seiner Regel, und ohne das wird die Regel beim Speichern abgelehnt, statt als Lauf in die Zeitüberschreitung zu laufen. Ein Ausdruck, der beim Warten einen Fehler wirft, lässt den Schritt scheitern.

### stop

Beendet den Ablauf. `reason` ist Pflicht und nimmt die Ersetzung `{{ expression }}` an; die Ablaufverfolgung zeigt ihn.

```json
{
  "type": "stop",
  "params": {"reason": "pump already running, nothing to do"}
}
```

Ohne `error` war der Lauf erfolgreich. Mit `"error": true` ist der Lauf gescheitert, mit dem Grund als Fehler, und er wird wie jeder andere als Fehlschlag protokolliert und gezählt:

```json
{
  "type": "stop",
  "params": {"reason": "valve did not close in time", "error": true}
}
```

`continueOnError` wird bei einem stop beim Speichern abgelehnt.

### call_script

Führt ein [Skript](/de/iot/scripts/) aus: einen benannten Ablauf, den jemand einmal geschrieben hat, damit jede Regel, die einen CIP-Zyklus oder eine Leitungsspülung braucht, denselben aufruft, statt eine eigene Kopie mitzuführen. `fields` sind seine Eingaben, `fieldExpressions` werden ausgewertet, wenn der Schritt läuft, und darübergelegt, und das Skript prüft alles gegen seine eigenen Felder genau wie bei einem Lauf vom Bildschirm. Ein Wert, den es ablehnt, lässt diesen Schritt scheitern; er wird nie zurechtgerückt.

```json
{
  "type": "call_script",
  "params": {
    "scriptId": "cip_cycle",
    "fields": {"circuit": "tank_2"},
    "fieldExpressions": {"minutes": "states['input_number.cip_minutes']"},
    "wait": true
  }
}
```

Mit `"wait": true` hält der Schritt, bis der Lauf des Skripts beendet ist, und übernimmt dessen Ergebnis: Ein Skript, das scheitert, lässt den Schritt scheitern, und die Regel stoppt dort, es sei denn, der Schritt sagt `continueOnError`. Der Lauf des Skripts ist Teil dieses Laufs: Wird dieser Lauf abgebrochen oder sprengt sein Budget, gilt das auch für das Skript. Ohne `wait` wird das Skript gestartet und die Regel macht weiter; das Skript endet von selbst.

Das Skript läuft als `script:<id>`, mit der Quelle dieser Regel, `automation`, bei jedem Schreibzugriff, den es macht, und sein Lauf nennt `automation_run:<id>` als Eltern. Ein beschäftigtes Skript, dessen Modus einen weiteren Lauf ablehnt, lässt einen wartenden Schritt scheitern (`script busy`) und wird bei einem, der nicht wartet, vermerkt, nicht als Fehler gewertet. Skripte, die Skripte aufrufen, gehen höchstens fünf tief, und ein Skript, das sich selbst aufrufen würde, wird beim Speichern abgelehnt.

### apply_recipe

Wendet ein [Rezept](/de/iot/recipes/) an: eine Gruppe von Sollwerten, die zusammen hinausgehen, eine Produktsorte oder ein Umrüsten. `params` sind seine Parameter, und `paramExpressions` werden ausgewertet, wenn der Schritt läuft, und darübergelegt; `version` wendet absichtlich eine ältere Version an, und weggelassen heißt die aktuelle.

```json
{
  "type": "apply_recipe",
  "params": {
    "recipeId": "grade_a",
    "params": {"line_speed": 120},
    "paramExpressions": {"batch": "states['input_number.next_batch']"}
  }
}
```

Das Rezept tut, was es vom Rezepte-Bildschirm aus tut, mit dieser Regel als der, die es anwendet. Es wird zuerst als Ganzes geprüft, und würde irgendein Ziel abgelehnt, wird nichts geschrieben und der Schritt scheitert mit allen Gründen. Dann gehen seine Ziele der Reihe nach unter einer Aufruf-ID hinaus, als `automation:<id>` mit der Quelle `automation`, und das erste, das scheitert, stoppt den Rest und lässt den Schritt scheitern; was geschrieben wurde, bleibt geschrieben. Der Schritt gelingt nur, wenn jedes Ziel geschrieben wurde. Ein Wert, der hinausging und nicht vom Gerät zurückgelesen wurde, ist kein Fehlschlag, denn er ging hinaus, aber die Ablaufverfolgung sagt `NOT confirmed by read-back`, und die Anwendung auch. Der Elternteil der Anwendung ist dieser Lauf, `automation_run:<id>`.

### Der Rest

| Aktion | Macht |
|---|---|
| `mqtt_publish` | veröffentlicht auf der bestehenden Verbindung eines MQTT-Geräts |
| `http_request` | ruft einen Endpunkt auf; `bindTo` speichert den Body in `vars` |
| `raise_alarm` / `clear_alarm` | steuert einen Alarm, den die Engine selbst nicht sehen kann |
| `log_event` | schreibt ins Systemprotokoll |
| `set_variable` | bindet einen Wert für spätere Schritte |
| `delay` | pausiert, bis zu einer Stunde |
| `mcp_call` | ruft ein Werkzeug auf einem konfigurierten MCP-Server auf |

`mqtt_publish`, `http_request`, `log_event` und `stop` unterstützen die Ersetzung `{{ expression }}` in ihren Zeichenketten.

```json
{
  "type": "mcp_call",
  "params": {
    "server": "maintenance",
    "tool": "create_work_order",
    "args": {"priority": "high"},
    "argExpressions": {"note": "'Zone 1 reached ' + toJSON(value)"},
    "bindTo": "workOrder"
  }
}
```

## Laufmodi

Was passiert, wenn eine Regel auslöst, während ein vorheriger Lauf noch läuft.

| Modus | Verhalten |
|---|---|
| `skip` | verwirft den neuen Auslöser, **der Standard**, und die richtige Antwort in der Nähe eines Geräts |
| `queue` | führt ihn danach aus, höchstens einen tief |
| `restart` | verwirft den aktuellen Lauf und beginnt neu |
| `parallel` | führt beide aus |

`queue` ist absichtlich auf einen wartenden Lauf begrenzt. Eine Regel, die nicht mithalten kann, würde sonst einen Rückstau an Befehlen aufbauen, die alle gegen eine Anlage feuern, deren Zustand sich weiterbewegt hat.

`minIntervalSec` begrenzt die Rate unabhängig von der Auslöserate, eine Absicherung gegen einen flatternden Tag, der ein Gerät kaputt treibt. Ein manueller Lauf aus der Oberfläche oder über MCP umgeht das Ratenlimit (jemand hat es so gemeint), aber nicht den Laufmodus (zwei gleichzeitige Läufe sind gleich gefährlich, wer sie auch startet).

`maxRuntimeSec` begrenzt einen ganzen Lauf; der Standard ist fünf Minuten. Ohne ihn hält eine Regel, die an einem unerreichbaren Endpunkt hängt, ihren Laufplatz für immer, und unter `skip` heißt das, dass sie nie wieder auslöst. Ein Lauf, der es aufbraucht, wird als abgelaufen verbucht, egal ob zwischen Schritten oder mitten in einem `delay` oder einem `wait`.

### Warten, Verzögerungen und Laufmodi

Ein Lauf, der in einem `wait` oder `delay` steht, ist ein laufender Lauf, und der Laufmodus entscheidet, was ein Auslöser mit ihm macht:

| Modus | Ein Auslöser, während ein Lauf wartet |
|---|---|
| `skip` | wird verworfen und als übersprungen verbucht. Der wartende Lauf geht weiter. |
| `queue` | läuft, sobald der wartende Lauf beendet ist, wie auch immer er endete. |
| `restart` | bricht den wartenden Lauf dort ab, wo er ist, und startet einen neuen. Der alte Lauf wird als **abgebrochen** verbucht, `a newer trigger restarted the rule`. Das ist das Muster "Bewegungsmelder-Licht": Jeder Auslöser schiebt das Ende hinaus. |
| `parallel` | startet einen weiteren Lauf, der für sich wartet. |

Ein Lauf wird dort abgebrochen, wo er ist, ein Warten oder eine Verzögerung eingeschlossen, und mit dem Grund als **abgebrochen** verbucht, wenn:

- **seine Regel deaktiviert oder gelöscht wird**: `the rule was disarmed or deleted`. Sein Lauf in der Warteschlange und seine `forSec`-Haltephasen werden ebenfalls verworfen.
- **seine Regel bearbeitet wird**: `the rule was edited`. Ein Lauf, der auf eine Bedingung wartet, die der Autor gerade geändert hat, macht nicht weiter, als wäre nichts geschehen; die bearbeitete Regel startet sauber. Das Speichern einer *anderen* Regel berührt nichts: Läufe, Haltephasen, Läufe in der Warteschlange, der Laufplatz und die Intervall-Timer jeder unveränderten Regel gehen weiter wie bisher.
- **der Prozess stoppt**: `the process is stopping`. Das Herunterfahren wartet kein Warten ab. Nichts setzt den Lauf beim nächsten Start fort; ein Lauf, den der Prozess nicht als abgebrochen verbuchen konnte (ein Absturz, ein Stromausfall), wird beim nächsten Start als abgebrochen markiert.

Ein Schritt, der abgebrochen wurde oder sein Budget aufgebraucht hat, stoppt den Lauf auch mit `continueOnError`: Dieses Flag ist für einen Schritt, der gescheitert ist, nicht für einen Lauf, den jemand gestoppt hat. Was der Schritt schon getan hatte, bleibt getan: Ein Schreibzugriff, der vor dem Abbruch hinausging, wird nicht rückgängig gemacht, und er steht in der Ablaufverfolgung.

## Laufverlauf

Jeder Lauf wird mit einer Ablaufverfolgung pro Schritt aufgezeichnet: den **aufgelösten** Eingaben, den Ausgaben, Dauern und Fehlern. Nicht die Vorlagen: Wenn eine Regel um 3 Uhr nachts danebengeht, ist `wrote 212.5 to press-01/Setpoint` das, was man wissen will, und `wrote {{expression}}` nicht.

Klappen Sie einen Lauf im Bildschirm Automatisierungen auf, um seine Schritte zu sehen. Ein Lauf, der noch lief, als der Prozess stoppte, wird beim Stoppen abgebrochen, und einer, den der Prozess nicht mehr verbuchen konnte (ein Absturz), wird beim nächsten Start als abgebrochen markiert, statt so auszusehen, als liefe er seit letztem Dienstag.

## Ein durchgespieltes Beispiel

Die Kühlung starten, wenn eine Zone während einer Schicht heiß läuft, höchstens einmal alle zehn Minuten, und jemandem Bescheid sagen.

```json
{
  "id": "cool-zone-1",
  "name": "Cool zone 1 when hot",
  "enabled": true,
  "mode": "skip",
  "minIntervalSec": 600,
  "triggers": [{
    "type": "threshold",
    "deviceId": "press-01", "tagName": "Zone1_Temp",
    "threshold": 200, "direction": "rising", "hysteresis": 5
  }],
  "condition": "quality == 'good' and hour >= 6 and hour < 18",
  "actions": [
    {"type": "write_tag", "params": {
      "deviceId": "press-01", "tagName": "Cooling", "value": true}},
    {"type": "delay", "params": {"seconds": 30}},
    {"type": "log_event", "params": {
      "severity": "warning",
      "message": "Cooling started, zone 1 at {{ value }}"}}
  ]
}
```

Lesen Sie die Absicherungen der Reihe nach: Sie löst beim Überschreiten aus statt dauernd; die Hysterese verhindert, dass sie bei einem Wackeln neu scharf wird; die Bedingung weigert sich, auf einen Messwert zu reagieren, dem sie nicht trauen kann, und läuft nur während der Schicht; und das Ratenlimit sorgt dafür, dass sie die Anlage selbst dann, wenn alles andere falsch ist, nicht öfter als einmal alle zehn Minuten steuern kann.

Dieselbe Idee mit Entitäten: den Absauglüfter starten, wenn die Presse zu laufen beginnt, aber nur, wenn niemand den Lüfter deaktiviert hat.

```json
{
  "id": "fan-with-press",
  "name": "Extraction fan follows the press",
  "enabled": true,
  "mode": "skip",
  "triggers": [{
    "type": "state",
    "entityId": "binary_sensor.press_01_run",
    "from": "off", "to": "on"
  }],
  "condition": "qualities['binary_sensor.press_01_run'] == 'good' and attrs['switch.press_01_fan']['armed'] == true",
  "actions": [
    {"type": "call_service", "params": {
      "entityId": "switch.press_01_fan", "service": "switch.turn_on"}},
    {"type": "log_event", "params": {
      "message": "{{ entity }} went {{ toState }}, fan started"}}
  ]
}
```

`from` und `to` sorgen dafür, dass ein Wiederverbinden (`unavailable` zu `on`) den Lüfter nicht von selbst startet; die Bedingung sorgt dafür, dass ein deaktivierter Lüfter ein übersprungener Lauf ist und kein abgelehnter Schreibzugriff im Audit-Protokoll bei jedem Start der Presse.

Und eine, die die Ablaufschritte nutzt: Wenn die Presse zehn Minuten gelaufen ist, das Kühlventil öffnen, falls es nicht schon offen ist, auf seinen Endschalter warten und laut scheitern, wenn er nie anspricht.

```json
{
  "id": "cool-after-warmup",
  "name": "Open cooling after ten minutes of running",
  "enabled": true,
  "mode": "restart",
  "maxRuntimeSec": 120,
  "triggers": [{
    "type": "state",
    "entityId": "binary_sensor.press_01_run",
    "from": "off", "to": "on",
    "forSec": 600
  }],
  "actions": [
    {"type": "condition", "params": {
      "expression": "states['valve.press_01_cooling'] != 'open'"}},
    {"type": "call_service", "params": {
      "entityId": "valve.press_01_cooling", "service": "valve.open"}},
    {"type": "wait", "params": {
      "expression": "states['valve.press_01_cooling'] == 'open'",
      "timeoutSec": 60, "continueOnTimeout": true}},
    {"type": "condition", "params": {
      "expression": "vars.wait.completed == false"}},
    {"type": "stop", "params": {
      "reason": "cooling valve did not open within 60s, it is {{ states['valve.press_01_cooling'] }}",
      "error": true}}
  ]
}
```

Lesen Sie es von oben nach unten: Das Halten sorgt dafür, dass eine Presse, die nach zwei Minuten abschaltet, das Ventil nie öffnet, und `from` sorgt dafür, dass ein Neustart des Gateways kein Pressenstart ist; die erste Bedingung macht ein schon offenes Ventil zu einem erfolgreichen Lauf, der nichts steuert; das Warten wacht in dem Moment auf, in dem sich die Ventil-Entität ändert; und öffnet es nie, lässt die zweite Bedingung den Lauf zu einem stop weitergehen, der ihn scheitern lässt, mit dem tatsächlichen Zustand des Ventils im Grund und einer Warnung im Systemprotokoll. Öffnet das Ventil, ist dieselbe Bedingung falsch, und der Lauf endet dort, erfolgreich.

## Webhooks

Ein `webhook`-Auslöser registriert `POST /api/webhook/<path>`. Der Body steht als `vars.body` bereit. Ein Pfad, den keine Regel beansprucht, liefert 404, statt still zu akzeptieren: Ein Webhook, der ins Leere postet, sieht genau aus wie einer, der funktioniert.

Zwei Regeln können nicht denselben Pfad beanspruchen; die zweite wird beim Laden abgelehnt, mit einer Protokollzeile, die beide nennt.

## Wenn eine Regel nicht scharf wird

Eine Regel, die aktiviert ist, aber nicht kompiliert hat, erscheint im Bildschirm Automatisierungen als **NOT ARMED**, mit rotem Punkt und einer Erklärung, und einem Fehler im Systemprotokoll. Das ist der Zustand, über den man am lautesten werden muss: Der Autor glaubt, sie laufe.

Eine schlechte Regel entschärft die anderen nicht. Das Neuladen verwirft die, die gescheitert ist, und stellt alles andere scharf.
