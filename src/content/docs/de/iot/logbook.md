---
title: "Das Logbuch"
description: "Zustandsänderungen, Schreibvorgänge, Alarme, Regelläufe und Konfigurationsänderungen auf einer Zeitleiste, für das Werk, einen Bereich oder eine Entität."
---

Eine einzige Zeitleiste dessen, was im Werk passiert ist, das Neueste zuerst: Die Pumpe ging an, jemand hat 180 in den Sollwert der Zone 1 geschrieben, der Alarm für hohe Temperatur wurde ausgelöst und quittiert, die Automatisierung zum Abkühlen lief, ein Gerät wurde umkonfiguriert. Für das ganze Werk, eine Stelle im Anlagenbaum samt allem darunter oder eine einzelne Entität. Es ist der Reiter Logbuch, ein Abschnitt in der Schublade jeder Entität, `GET /api/logbook` (siehe [die HTTP-API](/de/iot/api/#logbook)) und das MCP-Werkzeug `get_logbook` (siehe [MCP](/de/iot/mcp/)).

Die erste Frage, wenn etwas schiefgeht, lautet „Was ist kurz davor passiert?“, und bisher lag die Antwort an fünf Stellen: im Schreibprotokoll, in der Alarmhistorie, in den Läufen der Automatisierungen, im Systemprotokoll und in niemandes Erinnerung daran, was die Anlage selbst getan hat. Das Logbuch sind diese fünf in einer Liste.

## Was drinsteht

| Art | Herkunft | Was eine Zeile sagt |
|---|---|---|
| `state` | `entity_state_log` | der Zustand einer Entität hat sich geändert: `changed to on (was off)` |
| `write` | `write_audit` | ein Schreibvorgang auf ein Tag, erfolgt, abgelehnt oder fehlgeschlagen, von wem und durch welche Tür |
| `alarm` | `alarm_events` | ein Alarm ausgelöst, quittiert, zurückgesetzt, zurückgestellt, mit der angegebenen Notiz |
| `automation` | `automation_runs` | eine Regel lief, wie sie endete, was sie ausgelöst hat |
| `event` | `events` | Konfigurationsänderungen, Zusammenfassungen von Dienstaufrufen und die angegebenen Gründe für Schreibvorgänge sowie das, was eine UniFi-Konsole im Moment des Geschehens meldet, abgelegt unter dem Switch oder Access Point, um den es geht (ein Switch, der den Kontakt verliert, ist eine Warnung) |
| `script` | `script_runs` | ein [Skript](/de/iot/scripts/) lief, wie es endete, wer es gestartet hat und was es aufgerufen hat |
| `recipe` | `recipe_applications` | ein [Rezept](/de/iot/recipes/) wurde angewendet oder abgelehnt: welche Version, von wem, wie viele Ziele den Wert bekamen und zurückgelesen wurden |

Nur `state` ist neu. Die anderen werden dort gelesen, wo sie schon liegen, zum Zeitpunkt der Abfrage, und zusammengeführt. Nichts wird zweimal geschrieben, also kann nichts der Spur widersprechen, aus der es stammt, und jede Spur behält ihre eigene Aufbewahrung (unten).

Aus dem Systemprotokoll übernimmt das Logbuch die Kategorie `config` und die eigenen Zeilen der Kategorie `write`: die Zusammenfassung eines Dienstaufrufs, eines Alarm-Dienstaufrufs, den für einen Schreibvorgang angegebenen Grund. Die Zeilen „wrote ...“ und „write of ... refused“ des Schreibtors selbst bleiben draußen, denn sie sagen genau das, was das Schreibprotokoll schon enthält, und jeder Schreibvorgang würde sonst doppelt erscheinen.

### Was bewusst nicht drinsteht

**Zahlenmesswerte.** Ein Sensor, eine Zahl, ein Regelkreis oder ein SPS-Zähler ändert sich bei jeder Abfrage, und jeder Messwert steht schon im Historian. Sie noch einmal zu protokollieren, würde jede Zeile, die jemand lesen will, unter einer Million am Tag begraben, die niemand lesen will. Zeigen Sie sie stattdessen als Trend.

**Taster.** Der Zustand eines Tasters ist der Zeitpunkt seines letzten Drückens, und jedes Drücken ist schon ein Schreibvorgang im Protokoll. Außerdem fällt er bei jedem Neustart auf unbekannt zurück, was pro Taster und Neustart eine Zeile wäre, die nichts sagt.

**Die Zustände von Alarmentitäten.** Die eigene Historie des Alarms steht im Logbuch als `alarm`-Zeilen, mit mehr darin (dem Wert, der Notiz, wer quittiert hat).

Alles andere wird aufgezeichnet: binäre Sensoren, Schalter, Text, Auswahlen, Motoren, Ventile, Helfer und Skripte, sobald sie eintreffen.

**Helfer werden von dem protokolliert, der sie geändert hat.** Die Änderung eines Helfers wird in derselben Transaktion wie sein Wert ins Logbuch geschrieben, von dem Prozess, der die Änderung vorgenommen hat, mit wer es getan hat, woher und unter welcher Aufruf-ID, und nie in der Häufigkeit begrenzt. Der Rekorder lässt Helfer in Ruhe: Er läuft nur im Gateway, die Änderung eines Agenten über `--mcp-stdio` würde ihm also entgehen, und jeder Prozess, der den Helfer hält, sieht die Änderung, sie würde also einmal pro Prozess protokolliert. Der Zeitplan ist die Ausnahme, denn ihn stellt niemand, die Uhr bewegt ihn: Der Rekorder protokolliert ihn wie jede andere Entität.

## Prellen

Ein Kontakt, der mit 10 Hz prellt, ist eine einzige Tatsache („er hat so und so oft geprellt“) und nicht sechsunddreißigtausend Zeilen pro Stunde. Jede Entität bekommt zehn Änderungen am Stück, danach eine alle zwei Sekunden. Eine Änderung darüber hinaus wird nicht protokolliert und stattdessen in der nächsten Zeile der Entität mitgezählt:

```
changed to closed (was open); 14 changes before this not logged, it was changing faster than the logbook records
```

Die Zählung ist exakt: Die Zeilen plus ihre Zählungen sind jede Änderung, die die Entität gemacht hat. Wenn das Prellen aufhört, wird der Endzustand der Entität immer protokolliert, innerhalb von zwei Sekunden, das Logbuch endet also nie auf einem Zustand, den die Anlage schon verlassen hat. Die Zahl der seit dem Start unterdrückten Änderungen steht als `suppressed` in `/api/diagnostics` unter `logbook`.

## last_changed überlebt einen Neustart

Der Zustand einer Entität wird aus den Live-Tags berechnet und nie gespeichert, daher ließ vor dem Logbuch jeder Neustart jede Entität so aussehen, als hätte sie sich gerade erst geändert. Das Logbuch behält von jeder verfolgten Entität den neuesten Zustand und wann er sich zuletzt geändert hat (`entity_last_state`), und die Entitäts-Engine liest ihn beim Start. Eine Entität, deren Zustand gleich zurückkommt, behält ihr `last_changed`.

Ein Neustart sieht von innen so aus: Ein Gerät ist noch nicht verbunden, seine Entitäten werden also nicht verfügbar, dann unbekannt, und zeigen dann ihren Messwert. Diese Schritte sind dieser Prozess, der aufholt, nicht das Werk, das sich ändert, also wird sie abgewartet. Ein Zustand, der sich wirklich geändert hat, während das Gateway aus war, bekommt ein frisches `last_changed` und eine Zeile, die sagt, was er vorher war. Aus demselben Grund hält das Logbuch eine Änderung auf nicht verfügbar oder unbekannt in der ersten Minute nach einem Start zurück: Ein Gerät, das danach noch aus ist, wird dann protokolliert, mit dem Zeitpunkt, zu dem es zuerst aus gesehen wurde.

## Filter

- **Wo:** ein Knoten des Anlagenbaums und alles darunter. Ein Ort wird in alle Namen übersetzt, unter denen die Spuren ihn kennen: die Entitäten dort (nach ihrem eigenen Ort, sonst dem ihres Geräts, dieselbe Regel wie auf dem Bildschirm Entitäten), die Geräte dort und jedes Tag darauf, die Alarme auf diesen Tags, die Automatisierungen mit einem Auslöser auf eines davon und der Knoten selbst für seine Konfigurationsänderungen. Der Lauf einer Automatisierung gehört auch zu einem Ort, wenn sie während des Laufs dort geschrieben hat, was auch immer sie ausgelöst hat. Die Ereignisse einer UniFi-Konsole werden über das Netzwerk gefunden, nicht über etwas, das ein Mensch im Baum platziert hat: den Switch, an dem ein verknüpftes Gerät hängt, und jeden Switch zwischen ihm und dem Gateway, sodass ein ausfallender Switch unter jeder Zeile erscheint, die er speist. Eine im Baum platzierte Konsole findet die Ereignisse zu allem, was sie übernommen hat. Siehe [UniFi Network](/de/iot/unifi/#ereignisse).
- **Entität:** dasselbe für eine Entität: ihre Zustandsänderungen, Schreibvorgänge darauf und auf ihre Tags, ihre Alarme, die Regeln, die sie auslöst oder die darauf geschrieben haben, und Konfigurationsänderungen daran oder an ihren Tags. Eine Entität, die inzwischen gelöscht wurde, wird weiterhin unter dem Namen gefunden, den sie hatte.
- **Wer:** ein Teil des Akteurs, ohne Beachtung der Groß- und Kleinschreibung: `alice`, `automation:cooldown` (die Läufe der Regel und jeder Schreibvorgang, den sie gemacht hat), `mcp:` (alles, was irgendein Agent getan hat). Eine Zustandsänderung, die die Anlage von selbst gemacht hat, hat keinen Akteur.
- **Arten:** beliebige der fünf.
- **Wann:** `from` und `to`.

Das Blättern erfolgt über einen Cursor, die Zeit, die Art und die ID der letzten Zeile, sodass sich eine Seite nie durch Zeilen verschiebt, die seit der vorigen hinzugekommen sind.

Der Bildschirm aktualisiert sich live. Der Live-Feed schaut einmal pro Sekunde auf die Spuren, solange jemand zusieht, und sendet ein `logbook`-Ereignis mit den Arten, die etwas Neues haben; der Bildschirm fragt dann seine Seite erneut an. Er beobachtet die Tabellen, nicht diesen Prozess, ein Schreibvorgang, den ein Agent über `--mcp-stdio` macht, also einen anderen Prozess, taucht trotzdem auf.

## Wie lange es aufbewahrt

`entity_state_log` ist nach Monaten partitioniert, in beiden Verlaufsmodi (es ist eine gewöhnliche partitionierte PostgreSQL-Tabelle, ob `tag_history` nun eine Hypertable ist oder nicht), und ein Monat wird ganz gelöscht, sobald jede Zeile darin älter ist als `HOTLOOP_LOGBOOK_RETENTION_DAYS`. Standard **90**. Einen Monat zu löschen geht sofort; seine Zeilen einzeln zu löschen nicht, und deshalb ist sie partitioniert. Eine Zeile wird also zwischen 90 Tagen und 90 Tagen plus einem Monat aufbewahrt. `0` bewahrt alles auf, und das Gateway sagt das beim Start, denn die Tabelle wächst dann, bis das Volume voll ist.

Die eigene Wartung des Logbuchs macht das, einmal beim Start und danach täglich. Sie legt die Partition des letzten Monats und die der nächsten drei Monate im Voraus an, sodass eine Zeile immer eine zum Landen hat; eine Zeile für einen Monat ohne Partition landet in der Standardpartition, und die Wartung verschiebt sie in ihren Monat, wenn sie ihn anlegt (das passiert nach einer Wiederherstellung, siehe [Sicherung und Wiederherstellung](/de/iot/backup/)) oder löscht sie, sobald sie die Aufbewahrung überschritten haben.

Die anderen Spuren behalten, was sie immer behalten haben:

| Spur | Aufbewahrt |
|---|---|
| `write_audit` | alles, bis jemand es kürzt |
| `alarm_events` | alles, bis jemand es kürzt |
| `automation_runs` | die neuesten 500 Läufe jeder Automatisierung |
| `events` | die neuesten 100.000 Zeilen |

In einem Werk mit viel Betrieb können also die Schreibvorgänge und Alarme des Logbuchs weiter zurückreichen als seine Zustandsänderungen, und seine Automatisierungsläufe und Konfigurationsänderungen weniger weit. Das Logbuch zeigt, was die Spuren haben.

## Ein Prozess zeichnet auf

Das Gateway zeichnet auf. Ein zweiter, mit `--mcp-stdio` gestarteter Prozess (der Helfer eines Agenten neben dem Gateway) liest das Logbuch und seine Basislinie, sodass das, was er über `last_changed` sagt, mit dem des Gateways übereinstimmt, aber er schreibt nichts und pflegt nichts: Zwei Rekorder würden jede Änderung doppelt protokollieren.

Der Rekorder ist ein Hook an der Entitäts-Engine, der nur einreiht. Einmal pro Sekunde macht eine Goroutine aus dem Eingereihten Zeilen, wendet das Ratenlimit an und schreibt sie mit einem `COPY` und einem Upsert der neuesten Zustände in einer Transaktion. Die Warteschlange fasst 50.000 Änderungen; darüber hinaus werden die ältesten verworfen und gezählt. Eine ausgefallene Datenbank hält die Zeilen bis zur selben Grenze in der Warteschlange, und sie gehen hinein, wenn sie wieder da ist. `/api/diagnostics` zeigt alles unter `logbook`:

```json
{"recording":true,"retentionDays":90,"queued":0,"dropped":0,"written":212,"suppressed":36,"writeErrors":0}
```

`dropped` über null bedeutet, dass Änderungen im Logbuch fehlen; `queued`, das immer weiter wächst, bedeutet, dass die Datenbank nicht mithält; `lastError` sagt, warum der letzte Schreibvorgang fehlgeschlagen ist.

## Sicherungen

Beide Tabellen sind in jeder Sicherung: `entity_last_state` nach den Entitätstabellen, `entity_state_log` direkt vor `tag_history`. Siehe [Sicherung und Wiederherstellung](/de/iot/backup/).
