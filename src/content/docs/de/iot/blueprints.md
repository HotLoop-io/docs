---
title: "Regel-Blueprints"
description: "Schreiben Sie eine Regel einmal mit Lücken und füllen Sie sie je Pumpe aus. Jede Regel behält ihre Blueprint-Version, eine Änderung betrifft nie vierzig Regeln."
---

Ein Blueprint ist eine Regel, die einmal mit Lücken geschrieben wird. „Wenn *dieser Motor* länger als *diese Zeit* gelaufen ist, melde es, und halte ihn an, wenn *ich es verlange*.“ Wer weiß, was die Regel tun soll, schreibt sie ein einziges Mal. Alle anderen füllen die Lücken aus, je Pumpe, je Tank, je Linie, und bekommen am Ende eine ganz gewöhnliche Automatisierung.

Die Alternative kennt jedes Werk schon: dieselbe Regel auf vierzig Pumpen kopiert, dann an siebenunddreißig davon korrigiert, sobald jemand den Fehler findet. Kopien laufen auseinander. Ein Blueprint mit vierzig Eingabesätzen nicht.

Was dabei herauskommt, ist eine normale Regel. Sie steht auf dem Bildschirm Automatisierungen neben den von Hand geschriebenen, wird von derselben Engine scharf geschaltet, und jeder Schreibzugriff, den sie macht, läuft als `automation:<id>` durch das Schreib-Gate, protokolliert, Ablehnungen eingeschlossen. Es gibt keine Blueprint-Laufzeit und keine Seitentür. Es gibt ein Formular, und es gibt eine Regel.

## Die eine Regel zu Blueprints

**Eine Regel behält die Version des Blueprints, aus dem sie erstellt wurde.**

Ändern Sie einen Blueprint, steigt seine Version. Keine Regel, die daraus erstellt wurde, ändert sich. Die Regel an Pumpe 7, die am Dienstag richtig war, wird nicht stillschweigend zu einer anderen Regel, weil jemand am Mittwoch ihren Blueprint bearbeitet hat und dabei an Pumpe 12 dachte, obwohl Pumpe 7 diejenige ist, die den Keller flutet.

Eine Regel auf die neue Version zu bringen, ist ein **Upgrade**, und ein Upgrade ist etwas, das eine Person anfordert:

1. Der Bildschirm Automatisierungen zeigt es an der Regel: *Aus Blueprint Motor läuft zu lange, Version 1* und *Version 2 verfügbar*.
2. **Upgrade prüfen** zeigt genau, was sich ändert, Teil für Teil, vorher und nachher, und was die Regel tun würde, wenn sie jetzt auslöste, wobei jeder Schreibzugriff den Prüfungen des Gates unterzogen wird. Noch hat sich nichts geändert.
3. **Upgrade** übernimmt genau das, was geprüft wurde. Ist der Blueprint inzwischen weitergegangen oder hat jemand anderes die Regel in der Zwischenzeit aktualisiert, wird es abgelehnt, und Sie sehen noch einmal hin. Was Sie geprüft haben, wird übernommen, oder es wird nichts übernommen.

Es wird mit dem Namen dessen protokolliert, der es getan hat: *Automatisierung von Blueprint pump_watch Version 1 auf 2 aktualisiert*.

Hat jemand die Regel seit ihrer Erstellung von Hand bearbeitet, zeigt die Prüfung diese Änderung als ersetzt an. Keine Änderung verschwindet, ohne vorher auf dem Bildschirm gestanden zu haben.

## Wie einer aussieht

```json
{
  "id": "pump_watch",
  "name": "Pump start watch",
  "description": "Says when a pump starts, with the limit it runs to.",
  "inputs": [
    {"name": "pump", "label": "Pump", "type": "entity", "domain": ["switch"], "required": true},
    {"name": "limit", "label": "Limit", "type": "number", "min": 0, "max": 100, "step": 5, "unit": "%", "required": true}
  ],
  "template": {
    "triggers": [{"type": "state", "entityId": {"!input": "pump"}, "to": "on"}],
    "condition": "float(states['sensor.tank_level']) < ${limit}",
    "actions": [
      {"type": "log_event", "params": {"message": "${pump} started, running to ${limit}%"}}
    ],
    "mode": "skip"
  }
}
```

- **`id`** besteht aus Kleinbuchstaben, Ziffern und Unterstrichen und beginnt mit einem Buchstaben.
- **`inputs`** sind die Lücken, mit Typ. Dieselben Felder wie überall in HotLoop: `number` mit `min`, `max`, `step` und `unit`, `text` mit `max_length` und `pattern`, `boolean`, `select` mit `options`, `entity` mit den `domain`-Werten, die es annimmt, `duration` (Sekunden oder `90s`, `1h30m`), `alarm` und `tag`. Jedes kann `required` sein oder einen `default` haben.
- **`template`** ist die Regel: `description`, `triggers`, `condition`, `actions`, `mode`, `minIntervalSec`, `maxRuntimeSec`, in der Sprache der Automatisierung ([Automatisierungen](/de/iot/automations/)). Nicht ihre `id`, `name` oder `enabled`. Die gehören zu jeder daraus erstellten Regel.

### Die Lücken

**`{"!input": "pump"}`** als Wert wird durch den Wert der Eingabe ersetzt, mit ihrem Typ: Eine entity_id landet in `entityId` als Zeichenfolge, eine Dauer landet in `forSec` als Zahl. Eine optionale Eingabe, die niemand ausgefüllt hat, ist `null`.

**`${pump}`** innerhalb einer Zeichenfolge wird ebenfalls ersetzt, und wie, hängt davon ab, wo es steht:

- In einem Ausdruck (der `condition` einer Regel, der `expression` einer Aktion, einem Wert in `dataExpressions`, `argExpressions`, `fieldExpressions` oder `paramExpressions` und allem zwischen `{{` und `}}` in einer Nachricht) wird es als **Literal** eingesetzt. Eine Zeichenfolge steht in Anführungszeichen, eine Zahl ist eine Zahl, `true`, `false`, `nil`. Die Bedingung oben ist also mit einem Grenzwert von 40 `float(states['sensor.tank_level']) < 40`.
- Überall sonst ist es einfacher Text: `switch.pump_1 started, running to 40%`.

**`${counter.domain}`** ist die Domain einer Entitäten-Eingabe, für einen Dienstnamen, der zu der gewählten Art von Entität passen muss: `"${counter.domain}.reset"` ist `counter.reset` für den Zähler einer SPS und `input_counter.reset` für einen Hilfszähler.

Dieses Anführen ist der ganze Grund, warum eine Texteingabe in einem Ausdruck sicher ist. Geben Sie `' || true || '` in eine Texteingabe ein, und die Bedingung vergleicht mit genau dieser Zeichenfolge, so wie getippt. Sie wird nie Teil des Ausdrucks. Und eine Texteingabe darf `{{` überhaupt nicht enthalten: Jede Nachricht, die eine Regel sendet, führt beim Senden das, was zwischen `{{` und `}}` steht, als Ausdruck aus, und ein Wert, den jemand in ein Formular getippt hat, wird nie zu einem.

### Beim Speichern geprüft

Ein Blueprint wird geprüft, bevor er gespeichert wird, nicht erst, wenn jemand ihn ausprobiert:

- jede Lücke nennt eine Eingabe, und `.domain` folgt nur auf eine Entitäten-Eingabe;
- jede Eingabe wird irgendwo verwendet. Eine Eingabe, die die Vorlage ignoriert, ist ein Formularfeld, das nichts tut, und jemand verliert damit einen Nachmittag;
- mit Beispielwerten vom Typ jeder Eingabe befüllt (ihrem Standardwert, wenn sie einen hat), ergibt die Vorlage eine Regel, die kompiliert. Eine Texteingabe, die zu einer URL wird, braucht ein `pattern`, das das sagt, `https?://\S+`, sonst lehnt die URL-Prüfung das Beispiel ab.

## Einen ausfüllen

Auf dem Bildschirm **Blueprints** öffnet **Verwenden** das Formular: die ID und den Namen der Regel und jede Eingabe als das passende Bedienelement, eine Zahl mit ihrem Bereich, eine Liste, eine Entitätenauswahl. Dann:

- **Zuerst prüfen** antwortet mit der Regel, die entstehen würde, und damit, was diese Regel tun würde, wenn sie jetzt auslöste: die ausgewertete Bedingung, jeder Schreibzugriff und Dienstaufruf, vorgelegt den eigenen Prüfungen des Schreib-Gates als `automation:<id>`, und die erste Ablehnung in den Worten des Gates. Nichts wird gespeichert, geschrieben oder protokolliert.
- **Regel erstellen** erstellt sie, scharf geschaltet, es sei denn, Sie entfernen das Häkchen, und sie erscheint auf dem Bildschirm Automatisierungen mit dem Hinweis, woher sie kommt.

Jede Eingabe wird zuerst geprüft und **nie zurechtgebogen**. 150 für eine Eingabe mit dem Maximum 100 wird abgelehnt, nicht stillschweigend auf 100 gesetzt. `"12"` für eine Zahl wird abgelehnt, nicht umgedeutet. Alle falschen Eingaben werden auf einmal gemeldet, sodass das Formular mit der ganzen Liste zurückkommt. Ein Wert, den die Regel selbst ablehnt (eine Dauer von zwei Tagen für eine Haltezeit, die höchstens einen Tag betragen darf), wird in den Worten der Regel abgelehnt. Es wird nichts erstellt, bevor alles stimmt.

Eine Regel zu erstellen **ersetzt nie eine bestehende**. Eine ID, die schon vergeben ist, von einer von Hand geschriebenen oder aus einem Blueprint erstellten Regel, wird abgelehnt.

Über die API ist es `POST /api/blueprints/{id}/instantiate`, mit `?dry_run=true` für die Prüfung. Siehe [die HTTP-API](/de/iot/api/#blueprints).

## Die eingebauten

Sie sind in der Binärdatei enthalten. Sie sind schreibgeschützt; **Kopieren** erstellt eine eigene unter einer neuen ID, ab Version 1, die Sie beliebig ändern können.

| Blueprint | Eingaben | Was die Regel tut |
|---|---|---|
| `motor_running_too_long` | ein Motor, wie lange er laufen darf (standardmäßig eine Stunde), ob er angehalten werden soll | Wenn der Motor so lange am Stück `running` war, wird eine Warnung protokolliert. Auf Wunsch wird er mit `motor.stop` angehalten. |
| `tank_high_level_stop_pump` | ein Füllstandssensor, der Grenzwert, die Pumpe (ein Motor) | Wenn der Füllstand am Grenzwert oder darüber liegt, die Qualität des Messwerts gut ist und die Pumpe nicht schon steht, wird die Pumpe angehalten und das protokolliert. |
| `alarm_to_notify` | ein Alarm, der Zustand, auf den reagiert wird (standardmäßig `unack-active`), eine Webhook-URL | Wenn der Alarm in diesen Zustand geht, wird `{"text": "Alarm temp-hi is unack-active"}` per POST an die URL gesendet. |
| `device_silent_cycle_its_port` | der Online-Sensor eines Geräts, wie lange es stumm sein darf (standardmäßig 5 Minuten), das Tag für das Aus- und Einschalten des UniFi-Geräts und seines Ports, wie lange danach gewartet wird (standardmäßig 3 Minuten), ein Alarm, der kürzeste Abstand zwischen Läufen (standardmäßig eine Stunde) | Wenn das Gerät so lange aus ist, schaltet es die Stromversorgung des Switch-Ports einmal über das Schreib-Gate aus und wieder ein, wartet, bis es zurückkommt, und löst den Alarm aus, wenn es das nicht tut. Der Treiber lehnt einen zweiten Zyklus desselben Ports innerhalb von 15 Minuten ab und schaltet nie einen Port, der das Netzwerk trägt. |
| `shift_schedule_counter_reset` | ein Zeitplan-Helfer, ein Zähler (SPS oder Helfer) | Wenn der Zeitplan einschaltet, wird der Zähler zurückgesetzt und das protokolliert. |

Ein paar ehrliche Anmerkungen dazu:

- **`tank_high_level_stop_pump` ist eine Erleichterung, keine Verriegelung.** Eine Abschaltung, die Menschen oder das Werk schützt, gehört in die SPS, fest verdrahtet, wo sie sein muss, nicht in irgendetwas, das in einem Netzwerk läuft. Diese hier erspart jemandem, einen Füllstand zu beobachten. Sie ersetzt nicht den Hochstandsschalter.
- Sie handelt nicht auf einen Messwert, dem sie nicht trauen kann. Ein Füllstand mit schlechter Qualität hält nichts an, denn ein Stopp auf Grundlage einer Unsinnszahl ist trotzdem ein Stopp.
- **`shift_schedule_counter_reset` löst aus, wenn der Zeitplan einschaltet**, und zwei Zeitplanblöcke, die aneinanderstoßen, sind eine einzige Strecke „ein“. Geben Sie also jeder Schicht ihren eigenen Block mit ausgeschaltetem Zeitplan dazwischen, und sei es nur für eine Minute (06:00 bis 13:59, 14:00 bis 21:59), sonst setzt nur die erste Schicht der Reihe den Zähler zurück.
- **`alarm_to_notify`** ist für einen Chatraum oder ein Ticketsystem. Um ein Telefon anzurufen, mit Ratenbegrenzung, Wiederholungen und Quittierungslinks, verwenden Sie die Benachrichtigungen, die HotLoop selbst sendet ([Alarmbenachrichtigungen](/de/iot/notifications/)).

## Wer was darf

| <span class="sr-only">Details</span> | Betrachter | Bediener | Administrator |
|---|---|---|---|
| Blueprints ansehen (`blueprints.read`) | ja | ja | ja |
| Eine Regel daraus erstellen, ein Upgrade ausführen (`blueprints.apply`) | nein | ja | ja |
| Einen schreiben, bearbeiten, kopieren, löschen (`blueprints.write`) | nein | nein | ja |

Warum Bediener Regeln erstellen dürfen: Im Blueprint hat ein Ingenieur entschieden, was die Regel tut, und zu wählen, welche Pumpe sie überwacht, ist genau die Entscheidung, die ein Bediener den ganzen Tag trifft. Der gefährliche Teil, was die Regel ansteuert, wurde beim Schreiben des Blueprints entschieden, von jemandem mit `blueprints.write`. Die Regel danach zu löschen oder von Hand zu bearbeiten, bleibt `automations.write`, Administrator.

Das Löschen eines Blueprints, aus dem eine Regel erstellt wurde, wird abgelehnt, unter Nennung der Regeln. Löschen Sie diese zuerst. Ein eingebauter Blueprint kann weder bearbeitet noch gelöscht werden.

## Agenten

Ein Agent erhält `list_blueprints`, `preview_blueprint` und `instantiate_blueprint` (und `upgrade_blueprint_automation`, `create_blueprint`, `update_blueprint` und `delete_blueprint`): Er findet den richtigen Blueprint, ermittelt die Eingaben, zeigt, was die Regel tun würde, und erstellt sie, über denselben Weg wie der Bildschirm, mit denselben Eingabeprüfungen und dem Namen des Agenten im Logbuch. Eine Regel ist ein Dauerauftrag, Anlagen jedes Mal anzusteuern, wenn ihr Auslöser feuert, deshalb kommt die Vorschau zuerst, und jeder Schreibzugriff, den die Regel danach macht, trifft auf das Schreib-Gate. Siehe [MCP](/de/iot/mcp/#blueprints).

## Wo alles landet

- **Blueprints**, die das Werk geschrieben hat, stehen in der Tabelle `blueprints`. Die eingebauten sind in der Binärdatei und werden nie gespeichert.
- **Eine daraus erstellte Regel** ist eine Zeile in `automations` wie jede andere, mit `blueprint_id`, `blueprint_version` und `blueprint_inputs`, die angeben, woher sie kommt. `GET /api/automations` liefert sie als `blueprintId`, `blueprintVersion` und `blueprintInputs`.
- **Jede Änderung** steht im Systemprotokoll und im Logbuch, mit dem Namen dessen, der sie gemacht hat: *Blueprint erstellt*, *Blueprint gespeichert, jetzt Version 2*, *Automatisierung aus Blueprint motor_running_too_long Version 1 erstellt*, *Automatisierung von Blueprint pump_watch Version 1 auf 2 aktualisiert*, *Blueprint gelöscht*.
- **Backups** enthalten sowohl die Blueprints als auch die festgelegte Version jeder Regel, sodass ein wiederhergestelltes Werk genau die Upgrades anbietet, die es vorher angeboten hat. Ein Backup aus der Zeit vor den Blueprints stellt jede Regel als von Hand geschrieben wieder her.
- Eine Regel, deren Blueprint nicht mehr existiert (etwa ein eingebauter, den eine spätere Version entfernt hat), läuft genau so weiter, wie sie ist. Es gibt nur nichts, worauf man sie aktualisieren könnte.
