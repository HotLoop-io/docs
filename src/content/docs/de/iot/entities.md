---
title: "Entitäten"
description: "Das Entitätenregister, auf dem alle Automatisierungen, Helfer, Skripte und Bildschirme aufbauen: feste IDs, Domänen, Dienste und die API, die sie liest."
---

Das Entitätenregister und die Engine, die den Zustand der Entitäten berechnet, sind das Fundament, auf dem jede Automatisierung, jeder Helfer, jedes Skript und jeder Bildschirm in HotLoop aufbaut.

## Warum Entitäten, wenn wir schon Tags haben

Ein Tag ist das, wovon ein Treiber spricht: ein Halteregister, eine NodeId, ein S7-DB-Offset. Er wird über Gerät und Tag-Namen angesprochen, lässt sich nicht umbenennen und bedeutet genau einen Punkt an einer Leitung.

Eine Entität ist das, wovon Menschen und Regeln sprechen: "die Temperatur der Zone 1", "der Betriebsschalter des Förderbands". Sie hat einen eigenen, stabilen Namen (`sensor.zone_1_temperature`), einen Typ, der sagt, wie sie angezeigt wird und was man mit ihr tun kann, und eine Reihe von Bindungen an die Tags, aus denen sie besteht.

Entitäten umhüllen Tags. Sie ersetzen sie nicht, und an den Tags hat sich nichts geändert, um ihnen Platz zu machen. Es gibt keine zweite Wertepipeline und keinen zweiten Historian: Der Zustand einer Entität wird aus demselben Live-Cache berechnet, den `/api/values`, die Alarm-Engine und der OPC-UA-Server schon lesen. Jeder bestehende Tag-Endpunkt, das Board, `/api/write`, die MCP-Werkzeuge und die Automatisierungsregeln, die es vor den Entitäten gab, verhalten sich genau wie vorher; Entitäten kommen neben sie, nicht an ihre Stelle.

## Was Sie ohne Handgriff bekommen

Jeder Tag erhält automatisch eine **Lese-Entität**:

| Datentyp des Tags | Domäne der Lese-Entität |
|---|---|
| `bool`, `boolean`, `bit`, `coil`, `discrete` | `binary_sensor` |
| alles andere | `sensor` |

Sobald ein Tag zum ersten Mal beschreibbar gemacht wird, erhält er außerdem eine **Steuer-Entität**:

| Datentyp des Tags | Domäne der Steuer-Entität |
|---|---|
| bool-Familie | `switch` |
| int- und float-Familien | `number` |
| `string`, `text`, `char` | `text` |

Eine Steuer-Entität wird nie entfernt, weil ihr Tag entschärft wurde. Das Schreibtor lehnt Schreibzugriffe auf einen entschärften Tag ab wie bisher, und das Attribut `armed` der Entität wird `false`, damit ein Bildschirm die Steuerung ausgrauen kann. Die Entität zu behalten ist der Sinn der Sache: Eine Automatisierung oder ein Dashboard, die `switch.press_01_pump` nennen, sollen nicht brechen, nur weil jemand die Pumpe für eine Schicht entschärft hat.

Bestehende Tags bekommen ihre Entitäten im Upgrade selbst: Die Migration `0005_entities.sql` legt für jeden Tag eine Lese-Entität und für jeden bereits beschreibbaren Tag eine Steuer-Entität an, in derselben Transaktion, die die Tabellen erstellt. Entweder hat jeder Tag seine Entität, wenn die neue Version ihre erste Anfrage bedient, oder es hat sich nichts geändert.

Jede Alarmdefinition bekommt ebenfalls eine **Alarm-Entität**, auf dieselbe Weise: siehe [Alarm-Entitäten](#alarm-entitäten).

Eine Steuer-Entität zu bedienen (einen Schalter einschalten, eine Zahl setzen) ist ein Dienstaufruf, und ein Dienstaufruf besteht aus Tag-Schreibzugriffen über `runtime.Manager.Write` und das Schreibtor, wie jeder andere Schreibzugriff. Es gibt keine andere Tür. Siehe [Dienste](#dienste).

Ein Betriebsmittel, das aus mehr als einem Tag besteht (eine Pumpe mit Einschaltbefehl, Rückmeldekontakt und Störung; ein Ventil mit Endschaltern; ein PID-Regelkreis), ist ein **Komposit**, das Sie gezielt aus den Tags aufbauen, aus denen es besteht. Siehe [Zusammengesetzte Anlagen](#zusammengesetzte-anlagen).

## Entitäts-IDs

Eine `entity_id` hat die Form `<domain>.<object_id>`: Kleinbuchstaben, Ziffern und Unterstriche, höchstens 255 Zeichen. Die automatische ID eines Tags ist `<domain>.<device>_<tag>`, wobei beide Hälften in Kleinbuchstaben umgewandelt werden und jede Folge von Zeichen, die kein ASCII-Buchstabe oder keine Ziffer ist, zu einem einzigen Unterstrich wird:

| Gerät | Tag | Lese-Entität |
|---|---|---|
| `press-01` | `Zone1_Temp` | `sensor.press_01_zone1_temp` |
| `Line.A-2` | `Motor/Speed.PV` | `sensor.line_a_2_motor_speed_pv` |
| `press-01` | `温度` | `sensor.press_01_tag` |

Zwei Tags, die auf dasselbe Ergebnis kommen, bekommen `_2`, `_3` und so weiter, in der Reihenfolge ihrer Registrierung. Ein Name, der für 255 Zeichen zu lang ist, wird vor dem Suffix gekürzt, nie durch es hindurch.

**Eine `entity_id` wird einmal erzeugt, gespeichert und nie neu erzeugt.** Die Beschreibung eines Tags ändern, seinen Datentyp ändern, ihn auf ein anderes Register verlegen: Nichts davon berührt die entity_id. Das Einzige, was sie ändert, ist eine ausdrückliche Umbenennung über `PUT /api/entities/{entity_id}`, die eine Administratoraktion ist und im Systemprotokoll landet (Kategorie `config`, Betreff die neue ID, die alte ID in Meldung und Detail).

Eine Umbenennung behält die Domäne. Die Identität einer Entität ist ihre Datenbank-`id` und ihre `unique_id`, und keine von beiden ändert sich je:

| Entität | `unique_id` |
|---|---|
| die Lese-Entität eines Tags | `tag:<device>/<tag>` |
| die Steuer-Entität eines Tags | `tag-control:<device>/<tag>` |
| eine Alarm-Entität | `alarm:<definition id>` |
| ein Komposit | `composite:<32 random hex digits>` |

Die ersten drei leiten sich von dem ab, was die Entität umhüllt, und genau das lässt einen gelöschten Tag oder eine gelöschte Alarmdefinition, die zurückkommt, ihre Entität wieder übernehmen. Ein Komposit hat nichts Vergleichbares, wovon sich eine ID ableiten ließe: Zwei identische Pumpen an einer SPS sind an verschiedene Tags gebunden, und dieselben Tags können absichtlich zwei Komposite tragen. Seine `unique_id` ist daher zufällig, einmal bei der Erstellung vergeben. Sie kann nie mit der einer anderen Entität kollidieren, auch nicht mit der eines gelöschten und neu aufgebauten Komposits, das eine neue Entität ist und es auch sein soll.

## Gelöschte Tags, verwaiste Entitäten und Wiederübernahme

Wird ein Tag gelöscht, werden seine Entitäten **verwaist**, nicht gelöscht: `orphaned_at` wird gesetzt und der Zustand wird `unavailable`. Kommt derselbe Tag zurück, über den Tag-Editor oder einen erneuten Import per Browse, findet das Register die verwaiste Entität über `unique_id` und übernimmt sie wieder. Ihre entity_id, ihr Name, ihre Geräteklasse, ihr Symbol und jede andere Anpassung kommen mit ihr zurück.

Das ist Absicht. In einem Werk wird ein Tag viel öfter gelöscht und neu importiert, als jemand "vergiss alles über diesen Punkt" meint, und eine Automatisierung, die `sensor.oven_temperature` nennt, soll dabei weiterlaufen.

Ein ganzes Gerät zu löschen ist etwas anderes: Seine Entitäten gehen mit ihm, genau wie seine Tags. Das schließt ein Komposit ein, dessen Tags alle auf diesem Gerät liegen. Ein Komposit, das mehrere Geräte umspannt, gehört zu keinem und verliert nur seinen Zustand, wenn eines davon geht.

Alarm-Entitäten folgen ihren Alarmdefinitionen nach denselben Regeln: Löschen Sie die Definition, wird ihre Entität verwaist; speichern Sie eine Definition mit derselben ID, wird sie wieder übernommen.

Ein Komposit wird nie verwaist. Es wurde absichtlich gebaut und bleibt deshalb, bis jemand es löscht; solange einer seiner Tags fehlt, ist es `unavailable`.

`DELETE /api/entities/{entity_id}` löscht ein Komposit oder eine verwaiste Entität. Es lehnt (409) die Entität eines Tags oder einer Alarmdefinition ab, die noch hat, was sie umhüllt, und sagt, wie sie verschwindet: erst den Tag oder die Definition löschen, dann die verwaiste Entität. Eine lebendige zu löschen würde nur dazu führen, dass der nächste Abgleich sie unter einer neuen ID wieder anlegt und bis dahin alles bricht, was sie nennt. Um sie von Bildschirmen zu nehmen, blenden Sie sie aus oder deaktivieren Sie sie.

## Wie das Register auf dem Laufenden bleibt

Das Register hängt sich nicht an jede Stelle, an der sich ein Tag ändern kann. Es gleicht ab: Es liest jeden Tag und jede Entität, legt an, was fehlt, verwaist, was seinen Tag verloren hat, und übernimmt wieder, was ihn zurückbekommen hat. Ein Abgleich kann keinen Weg übersehen, den jemand nächstes Jahr hinzufügt, und ihn zweimal auszuführen ist dasselbe wie einmal. Er läuft:

- beim Start, was ein Upgrade und eine Wiederherstellung aus einer Sicherung abdeckt;
- nach jedem Neuladen der Runtime, das jede Tag- und Geräteänderung ohnehin auslöst;
- synchron in den API-Handlern, die Tags ändern (`POST /api/tags`, `DELETE /api/tags/...`, `POST /api/devices/{id}/import`, `DELETE /api/devices/{id}`) und Alarmdefinitionen (`POST /api/alarms`, `DELETE /api/alarms/{id}`), sodass ein Client, der einen Tag oder eine Definition anlegt und sofort nach der Entität fragt, sie findet.

Die Registrierung wird über die Replikate mit einer Advisory-Sperre der Datenbank serialisiert, sodass zwei Replikate, die dasselbe Gerät importieren, nicht dasselbe `_2` vergeben können. Jeder Abgleich, der etwas ändert, schreibt eine Zeile ins Systemprotokoll, nicht eine je Entität: Der Import von fünftausend Punkten ist ein einziges Ereignis.

## Zustand

`GET /api/states/{entity_id}`:

```json
{
  "entity_id": "sensor.press_01_zone1_temp",
  "state": "212.5",
  "attributes": {
    "friendly_name": "Zone1_Temp",
    "unit_of_measurement": "F",
    "device_class": "temperature",
    "source": ["press-01/Zone1_Temp"]
  },
  "quality": "good",
  "last_changed": "2026-09-26T14:02:11.482Z",
  "last_updated": "2026-09-26T14:02:11.482Z",
  "last_reported": "2026-09-26T14:07:40.100Z"
}
```

`state` ist der Wert ohne seine Einheit: eine Zahl, wie `/api/values` sie anzeigt, `on` oder `off` für `binary_sensor` und `switch`, der Text selbst bei einer Zeichenkette. Die Einheit ist ein Attribut. Ein Zustand, der manchmal `212.5` und manchmal `212.5 F` lautet, ist ein Zustand, den nichts vergleichen kann.

Die Regeln, in der Reihenfolge, in der sie angewendet werden. Es sind dieselben Regeln, die der OPC-UA-Server für seine Statuscodes verwendet, aus demselben Grund: **Ein Zustand ist nie besser als der Beleg dafür.**

| Bedingung | `state` | `quality` |
|---|---|---|
| Entität verwaist, oder ihr Tag ist weg | `unavailable` | `bad` |
| Gerät deaktiviert, gelöscht oder seine Verbindung nicht aktiv | `unavailable` | `bad` |
| Verbindung aktiv, in dieser Sitzung noch nichts gelesen | `unknown` | `bad` |
| Schlechter Messwert | der **letzte gute Wert**, oder `unknown`, wenn es nie einen gab | `bad` |
| Guter Messwert, aber andere Punkte am Gerät schlagen fehl (eingeschränkt) | der Wert | `uncertain` |
| Guter Messwert | der Wert | `good` |

Die Regel zum schlechten Messwert ist wichtiger, als sie aussieht. Ein Treiber meldet einen Punkt, den er nicht lesen konnte, als schlechten Messwert mit dem Wert null, und diese Null als Zustand anzuzeigen macht aus "der Füllstandsgeber antwortet nicht mehr" ein "der Tank ist leer". Die Entität zeigt weiter den letzten Wert, dem man trauen konnte, und sagt in `quality`, dass sie dafür nicht mehr einstehen kann.

Beachten Sie den Unterschied zwischen einem ausfallenden Punkt und einem ausfallenden Gerät. Ein Modbus-Gerät, bei dem jeder Block fehlschlägt, verwirft seine Sitzung und verbindet sich neu, seine Entitäten werden also `unavailable`. Ein Gerät, das für manche Punkte antwortet und für andere nicht, bleibt verbunden (eingeschränkt), und nur die Entitäten der ausfallenden Punkte zeigen `bad`.

**Wie schnell ein totes Modbus-Gerät sichtbar wird.** Eines, das die Verbindung verweigert oder schließt, ist bei seiner nächsten Abfrage `unavailable`. Eines, das einfach nicht mehr antwortet (ein gezogenes Kabel, eine hängende SPS, ein Switch, der neu gestartet ist), hält seinen Socket offen und wird nach seinem Abfrage-Timeout beurteilt: Seine Entitäten sind innerhalb eines Abfrageintervalls plus dem doppelten Timeout des Geräts `unavailable`, plus höchstens eine Sekunde für die Rückfall-Neuberechnung der Engine. Meist ist es ein Timeout; zwei, wenn das Gerät mitten in einer Abfrage stirbt, weil die Anfrage, die schon auf der Leitung ist, ihr volles Timeout bekommt. Bis dahin wurde nichts Neues gelesen, die Entität zeigt also noch ihren letzten Messwert, wie er war. Ein hängendes Gerät, das noch Verbindungen annimmt, wird sofort neu verbunden, danach wechseln seine Entitäten also zwischen `unavailable` und `unknown` (verbunden, nichts gelesen), bis es wieder antwortet; keines von beiden wird je mit einem Wert verwechselt. Das Timeout ist der Regler: Ein Gerät mit 20 Sekunden Timeout kann nach seinem Ausfall 20 bis 40 Sekunden lang in Ordnung aussehen, stellen Sie es also nicht länger ein, als das Gerät zum Antworten braucht.

Diese Tabelle gilt für Entitäten eines einzelnen Tags. Ein Komposit ist strenger (ein schlechter Messwert behält nie seinen letzten Wert, siehe [Wie der Zustand eines Komposits bestimmt wird](#wie-der-zustand-eines-komposits-bestimmt-wird)), und der Zustand einer Alarm-Entität ist der der Alarm-Engine (siehe [Alarm-Entitäten](#alarm-entitäten)).

### Zeitstempel

- `last_changed` bewegt sich nur, wenn sich `state` ändert.
- `last_updated` bewegt sich, wenn sich `state`, `quality` oder ein Attribut ändert.
- `last_reported` ist der Zeitstempel des Messwerts, aus dem der Zustand stammt. Er fehlt, bis es einen gibt.

Der Zustand wird berechnet, nicht gespeichert, aber das Logbuch hält den neuesten Zustand jeder Entität und wann er sich zuletzt geändert hat (`entity_last_state`, siehe [Das Logbuch](/de/iot/logbook/)). Nach einem Neustart **behält** eine Entität, deren Zustand gleich zurückkommt, ihr `last_changed`: Eine Pumpe, die seit Dienstag läuft, sagt weiter Dienstag. Die Zustände unavailable und unknown, die der Tag einer Entität durchläuft, während sein Gerät sich neu verbindet, zählen nicht als Änderung. Ein Zustand, der sich geändert hat, während das Gateway stand, bekommt ein neues `last_changed` und eine Zeile im Logbuch. Numerische Entitäten (Sensoren, Zahlen, Regelkreise, Zähler) und Tasten werden nicht verfolgt, ihr Wert beginnt, wie das `last_updated` jeder Entität, nach dem Neustart von vorn.

### Attribute

Jede Entität trägt `friendly_name` und `source` (die Tag-Schlüssel, an die sie gebunden ist). Dann, wenn sie zutreffen:

| Attribut | Wann |
|---|---|
| `unit_of_measurement` | `sensor` und `number`: die eigene Einheit der Entität oder die ihres Tags |
| `device_class`, `state_class`, `icon` | wenn an der Entität gesetzt |
| `armed` | Steuer-Entitäten: ob der Tag gerade beschreibbar ist |
| `min`, `max` | `number`: die Optionen der Entität, sonst der Bereich des Tags, falls er einen hat |
| `step` | `number`: die Option der Entität, sonst 1 bei einem Ganzzahl-Tag |
| `max_length`, `pattern` | `text`: die Optionen der Entität, `max_length` standardmäßig 255 |
| `quality_reason` | Tag-Entitäten, solange der Messwert nicht gut ist und der Treiber den Grund kennt: `no field at ENERGY.Power`, `payload is not JSON`. Verschwindet mit dem nächsten guten Messwert |

### Deaktiviert und ausgeblendet

Eine **deaktivierte** Entität hat gar keinen Zustand: Sie fehlt in `/api/states`, und wer sie per ID abfragt, erfährt, dass sie deaktiviert ist, statt dass sie fehlt. Eine **ausgeblendete** Entität hat ihren Zustand wie gewohnt; das Flag dient dazu, dass Bildschirme sie aus den Standardansichten lassen.

### Wie die Engine läuft

Die Engine abonniert den Tag-Bus als `entities` mit einer Warteschlange von 256 Stapeln, demselben verlustbehafteten Vertrag wie die Alarm- und Automatisierungs-Engine: Ein langsamer Verbraucher verliert Stapel, er blockiert nie eine Abfrage. Ein hier verlorener Stapel kostet höchstens eine Sekunde, weil die Engine außerdem alle Entitäten einmal pro Sekunde aus dem Cache neu berechnet. Dieser Takt fängt auch Änderungen auf, die nichts ankündigt, etwa das Eintreffen der ersten Abfrage eines Geräts.

Abonnenten im Prozess registrieren sich mit `Engine.OnStateChanged`. Sie werden in der eigenen Goroutine der Engine aufgerufen, in der Reihenfolge, in der die Änderungen geschahen, was eine Regel braucht, die sich für "von X auf Y" interessiert. Sie müssen schnell sein. Die Engine wartet nie auf sie; geraten sie mehr als 10.000 Änderungen in Rückstand, werden die ältesten verworfen und gezählt.

`GET /api/diagnostics` meldet es unter `entities`:

| Feld | Bedeutung |
|---|---|
| `entities` | wie viele Entitäten einen Zustand haben |
| `droppedBatches` | Bus-Stapel, die die Engine zu langsam angenommen hat (auch unter `bus.droppedPerSubscriber.entities`) |
| `pendingChanges`, `droppedChanges` | die Warteschlange des Zustandsänderungs-Hooks. Ein wachsender Rückstand oder jeder Verlust heißt, dass ein Hook zu langsam ist |

## Geräteklassen und Einheiten

Eine Geräteklasse sagt, was ein Wert ist (`temperature`, `pressure`, `volume_flow_rate`, `running`, `problem`), damit ein Bildschirm ein Symbol wählen kann und ein Statistikverbraucher weiß, was er damit tun soll. Jede Klasse hat die Einheiten, in denen sie üblicherweise vorkommt. Die vollständige Tabelle ist `model.DeviceClasses`.

- Eine für die Domäne unbekannte Geräteklasse wird abgelehnt.
- Eine Einheit, die die Klasse üblicherweise nicht hat, wird **gespeichert, mit einer Warnung** in der Antwort. Werke beschriften Dinge, wie Werke Dinge beschriften, und `degF` an einer Temperatur ist kein Speicherverbot wert. Einfaches `F` und `C` werden für die Temperatur ohne Warnung akzeptiert, weil das die meisten SPS-Tag-Datenbanken tatsächlich führen.
- `state_class` (`measurement`, `total`, `total_increasing`) gibt es nur für Sensoren.
- **Es gibt keine Einheitenumrechnung.** Die Einheit ist eine Beschriftung.

## API

Die Entitäts-Endpunkte verwenden Feldnamen in snake_case (`entity_id`, `last_changed`) statt des sonst in dieser API üblichen camelCase. Das ist Absicht: Die Entitäts-API gibt es, damit alles, was diese Form schon versteht, auch diese versteht.

| Endpunkt | Berechtigung | Zweck |
|---|---|---|
| `GET /api/entities` | `entities.read` | Jede Entität, verwaiste eingeschlossen. Filter: `?domain=`, `?device=`, `?orphaned=true\|false` |
| `GET /api/entities/{entity_id}` | `entities.read` | `{"entity": ..., "state": ...}`; `state` ist null bei einer deaktivierten Entität |
| `GET /api/entities/{entity_id}/image` | `entities.read` | das neueste Bild einer Kamera oder eines Bildes |
| `PUT /api/entities/{entity_id}` | `entities.write` | Ändert Registerfelder, auch eine Umbenennung. Antwortet mit `{"entity": ..., "warnings": [...]}` |
| `POST /api/entities` | `entities.write` | Legt ein Komposit an. Antwortet mit 201 `{"entity": ..., "warnings": [...]}`. Siehe [Zusammengesetzte Anlagen](#zusammengesetzte-anlagen) |
| `DELETE /api/entities/{entity_id}` | `entities.write` | Löscht ein Komposit oder eine verwaiste Entität. Alles andere ist 409 |
| `GET /api/states` | `entities.read` | Der Zustand jeder aktivierten Entität, nach entity_id sortiert. Filter: `?domain=` |
| `GET /api/states/{entity_id}` | `entities.read` | Ein Zustand |
| `POST /api/services/{domain}/{service}` | `values.write` (`alarms.ack` für `alarm`) | Ruft einen Dienst auf einer Entität auf. Siehe [Dienste](#dienste). `?dry_run=true` fragt, was er tun würde, statt es zu tun; siehe [Erst fragen](#erst-fragen-der-probelauf) |
| `GET /api/writes?entity={entity_id}` | `values.read` | Jeder Schreibzugriff, den Dienstaufrufe auf einer Entität gemacht haben oder der abgelehnt wurde, neueste zuerst |

Jede Rolle hat `entities.read`: Der Zustand einer Entität ist der Wert eines Tags unter anderem Namen, den ein Betrachter schon lesen kann. Nur der Administrator hat `entities.write`: Die entity_id ist der Name, unter dem jede Automatisierung, jedes Dashboard und jeder Agent die Entität anspricht, und ihn zu ändern ist Konfiguration, nicht Betrieb.

Ein `PUT`-Body ändert nur die Felder, die er nennt. Unbekannte Felder werden abgelehnt, ebenso die Identitätsfelder (`unique_id`, `domain`, `platform`, das Gerät und die Bindungen):

```json
{
  "entity_id": "sensor.zone_1_temperature",
  "name": "Zone 1 temperature",
  "device_class": "temperature",
  "state_class": "measurement",
  "unit_of_measurement": "°F",
  "icon": "mdi:thermometer",
  "entity_category": "",
  "options": {},
  "disabled": false,
  "hidden": false
}
```

`options` nimmt `min`, `max` und `step` bei einer `number` (sie engen ein, was ein Bildschirm anbietet; das Schreibtor prüft trotzdem den eigenen Bereich des Tags) und `max_length` und `pattern` bei einem `text`. Die Optionen eines Komposits gehören ihm selbst (siehe jede Domäne weiter unten), und ein `PUT`, das sie ändert, wird gegen seine Tags geprüft, genau wie die Erstellung. `sensor`, `binary_sensor`, `switch` und `alarm` nehmen keine.

Eine Entität hat außerdem einen Platz im Anlagenbaum und eine Reihe von Bezeichnungen: `equipment_id` (null, um ihrem Gerät zu folgen), die schreibgeschützte `area_id`, nach der Clients gruppieren, und `labels`. `PUT` nimmt `equipment_id` und `labels` wie jedes andere Feld. Siehe [den Anlagenbaum und die Bezeichnungen](/de/iot/equipment/).

## Dienste

Ein Dienst ist das, was man mit einer Entität tun kann: `switch.turn_on`, `number.set_value`. Er benennt, was mit der Entität geschehen soll, und darunter sind es nichts als Tag-Schreibzugriffe.

```
POST /api/services/switch/turn_on
{"entity_id": "switch.press_01_pump", "reason": "start of shift"}

POST /api/services/number/set_value
{"entity_id": "number.press_01_zone1_sp", "value": 212.5}
```

Der Body besteht aus `entity_id`, einem optionalen `reason` und den Dienstdaten. Eine Entität pro Aufruf, nie eine Liste, weil die Antwort auf "was ist rausgegangen" sich auf eine Entität beziehen soll.

### Was jede Domäne annimmt

| Dienst | Daten | Schreibt |
|---|---|---|
| `switch.turn_on`, `switch.turn_off` | keine | `true` oder `false` in den Befehls-Tag |
| `switch.toggle` | keine | das Gegenteil des aktuellen Zustands, aus dem Live-Cache nach denselben Regeln gelesen wie der Zustand selbst. Ist der Zustand `unknown`, `unavailable` oder von schlechter Qualität, wird der Aufruf abgelehnt: Etwas umzuschalten, dessen Zustand man nicht kennt, heißt zu raten, in welche Richtung man es bewegt. Sagen Sie `turn_on` oder `turn_off` |
| `number.set_value` | `value`, eine Zahl | den Wert, in den Befehls-Tag |
| `text.set_value` | `value`, eine Zeichenkette | die Zeichenkette, in den Befehls-Tag |
| `select.select_option` | `option` | den Rohwert der Option, in den Befehls-Tag |
| `button.press` | keine | `press_value`, dann, `pulse_ms` später, `release_value`, in den Befehls-Tag; eine `single_shot`-Taste schreibt `press_value` einmal und danach nichts |
| `motor.start`, `motor.stop` | keine | `true` oder `false` in `run_command` |
| `motor.reset` | keine | ein Impuls auf `reset_command`: `true`, dann, `pulse_ms` später, `false` |
| `motor.set_speed` | `value`, eine Zahl | den Wert, in `speed_command` |
| `valve.open`, `valve.close` | keine | `true` oder `false` in `command`; bei einem stetigen Ventil 100 oder 0 in `position_command` |
| `valve.stop` | keine | ein Impuls auf `stop_command`; ein `single_shot`-Ventil schreibt `true` einmal |
| `valve.set_position` | `position`, 0 bis 100 | die Position, in `position_command` |
| `loop.set_setpoint` | `value`, eine Zahl | den Wert, in `setpoint` |
| `loop.set_mode` | `mode`: `auto`, `manual` oder `cascade` | den Rohwert des Modus, in `mode` |
| `loop.set_output` | `value`, eine Zahl | den Wert, in `output`, **nur solange der Regelkreis manuell liest** |
| `counter.reset` | keine | 0 in ein numerisches `reset_command`, oder ein Impuls auf ein bool-Register |
| `alarm.acknowledge` | `note`, optional | kein Tag: das Quittieren der Alarm-Engine |
| `alarm.shelve` | `minutes`, 1 bis 1440 | kein Tag: das Ausblenden der Alarm-Engine |
| `alarm.unshelve` | keine | kein Tag: das Wiedereinblenden der Alarm-Engine, nur bei einem ausgeblendeten Alarm |
| `script.turn_on` | die Felder des Skripts | kein Tag direkt: führt das [Skript](/de/iot/scripts/) aus, dessen Schritte durch das Tor als `script:<id>` schreiben |
| `script.turn_off` | keine | kein Tag: stoppt jeden Lauf des Skripts |
| `scene.turn_on` | `params`, die Parameter des Rezepts, und `version`, beide optional | kein Tag direkt: wendet das [Rezept](/de/iot/recipes/) an, dessen Ziele unter einer einzigen Aufruf-ID durch das Tor schreiben |
| `light.turn_on` | `brightness`, 0 bis 100, optional | `true` in `command`, dann die Helligkeit in `brightness_command` |
| `light.turn_off` | keine | `false` in `command` |
| `light.toggle` | keine | das Gegenteil dessen, was die Zustandsrückmeldung des Lichts sagt; abgelehnt, wenn sie sich nicht lesen lässt |
| `cover.open`, `cover.close`, `cover.stop` | keine | `open`, `close` oder `stop` in `command` |
| `cover.set_position` | `position`, 0 bis 100 | die Position, in `position_command` |
| `lock.lock`, `lock.unlock`, `lock.open` | keine | `lock`, `unlock` oder `open` in `state` |
| `fan.turn_on` | `percentage`, `preset_mode`, beide optional | `true` in `state`, dann jeden der angegebenen |
| `fan.turn_off`, `fan.toggle` | keine | `false`, oder das Gegenteil dessen, was seine Rückmeldung sagt, in `state` |
| `fan.set_percentage` | `percentage`, 0 bis 100 | in `percentage` |
| `fan.set_preset_mode`, `fan.set_direction` | `preset_mode`, `direction` | in `preset_mode`, `direction` |
| `fan.oscillate` | `oscillating`, true oder false | in `oscillating` |
| `siren.turn_on`, `siren.turn_off`, `siren.toggle` | keine | wie ein Schalter, in `state` |
| `notify.send_message` | `message` | die Nachricht, in `message` |

Ein Komposit-Dienst, dessen Rolle nicht gebunden ist (`set_speed` an einem Motor ohne `speed_command`), wird abgelehnt, bevor irgendetwas geplant wird, als unbekannter Dienst.

`sensor` und `binary_sensor` sind schreibgeschützt und nehmen keine Dienste an. Dienstdaten mit einem Feld, das der Dienst nicht annimmt, werden abgelehnt, wie ein falsch geschriebenes Feld in jedem anderen Body: Ein Aufruf, der stillschweigend ohne das gemeinte Feld weiterläuft, ist schlimmer als einer, der Nein sagt.

Eine Zahl, die ganzzahlig ist, kommt bei einem Ganzzahl-Tag als Ganzzahl an: `42.0` ist `42`.

### Jeder Aufruf geht durch das Schreibtor

Ein Dienstaufruf wird zu einer geordneten Liste von Schreibzugriffen, und jeder geht durch `runtime.Manager.Write`. Alles, was das Tor bei einem Schreibzugriff auf einen Tag durchsetzt, setzt es also bei einem Dienstaufruf durch, in derselben Reihenfolge:

1. Schreiben aktiviert (`safety.allowWrites`), und bei einem Agenten Agenten-Schreiben aktiviert;
2. der Tag scharf (`writable`);
3. der Wert im Bereich des Tags, abgelehnt, nie begrenzt;
4. dann das, was nur die Entität weiß, im Tor gegen die Entität und den Tag geprüft, wie sie in diesem Moment sind:
   - die Entität ist nicht deaktiviert (etwas zu bedienen, das keinen Zustand hat, ist nicht erlaubt);
   - das eigene `min` und `max` einer `number`, die den Bereich des Tags nur einengen können;
   - der `step` einer `number`, vom Minimum aus gezählt (dem eigenen, sonst dem Minimum des Tag-Bereichs, sonst null). Ein Ganzzahl-Tag hat die Schrittweite 1, sofern die Entität nichts anderes sagt, sodass `1.5` auf ein Halteregister abgelehnt wird, statt dass ein Treiber es stillschweigend auf `1` kürzt;
   - das `max_length` eines `text` (Zeichen, 255, wenn nicht gesetzt) und sein `pattern`, auf das der ganze Wert passen muss;
   - eine `select`-Option oder ein Regelkreis-Modus, der nicht zur Entität gehört. Er wird dem Tor als die gewünschte Option oder der gewünschte Modus geschickt und dort abgelehnt, sodass aktenkundig bleibt, wer nicht vorhandene Optionen ausprobiert;
   - eine Ventilposition außerhalb von 0 bis 100;
   - ein `set_output` eines Regelkreises, solange sein Modus-Tag, in diesem Moment aus dem Live-Cache gelesen, etwas anderes als manuell ist (auto, cascade, ein Wert, der keiner der Modi ist, oder nicht lesbar).

Jede Ablehnung, bei jedem dieser Schritte, wird **protokolliert**: eine `write_audit`-Zeile mit Entität, Dienst und Aufruf-ID, `succeeded` false und dem Grund, der mit `refused:` beginnt. Das schließt einen Benutzer ohne `values.write` ein. Die API antwortet nicht nur 403 und vergisst es: Sie schickt den Aufruf als verweigert markiert an das Tor, das Tor lehnt ihn ab, bevor etwas geschrieben wird, und die Ablehnung steht in der Akte der Entität mit dem angefragten Wert.

Es greift auf die Form eines Geräte-Schreibzugriffs, nicht auf einen Namen, sodass auch ein Umweg über einen neuen Wrapper oder eine auf der Stelle deklarierte Schnittstelle erwischt wird.

### Was ein Aufruf antwortet

```json
{
  "call_id": "9f2c4e1a7b3d5c60",
  "entity_id": "switch.press_01_pump",
  "service": "switch.turn_on",
  "writes": [
    {"tag": "press-01/pump", "value": "true", "status": "written"}
  ]
}
```

Jeder Schreibzugriff hat einen Status:

| Status | Bedeutung |
|---|---|
| `written` | das Gerät hat ihn angenommen |
| `not_sent` | das Tor hat ihn abgewiesen, bevor er das Gerät erreichte: eine Ablehnung, keine Sitzung, eine Audit-Zeile, die sich nicht öffnen ließ |
| `failed` | er ist hinausgegangen und das Gerät oder die Verbindung meldete einen Fehler. Ob er wirkte, ist nicht bekannt |
| `skipped` | nie versucht, weil ein früherer Schreibzugriff im selben Aufruf nicht erfolgreich war |

Ein fehlgeschlagener Aufruf antwortet mit dem Statuscode des Fehlers (403 durch Richtlinie oder Berechtigung abgelehnt, 422 ein Wert abgelehnt, 409 ein Umschalten ohne bekannten Zustand oder ein Betriebsmittel im falschen Zustand für den Dienst, 503 Gerät nicht verbunden, 502 das Gerät hat den Schreibzugriff angenommen und einen Fehler gemeldet, 404 keine solche Entität, 400 ein fehlerhafter Aufruf, 500 ein Tastendruck, dessen Loslassen nicht durchging, oder ein Fehler im Gateway, dessen `error` nur ein Verweis auf das Serverprotokoll ist) und demselben Body mit hinzugefügtem `error`.

Die Schreibzugriffe eines Aufrufs gehen der Reihe nach hinaus, der erste, der nicht erfolgreich ist, beendet den Aufruf, und **nichts bereits Geschriebenes wird zurückgenommen**. Das Rückgängigmachen ist selbst ein Schreibzugriff, gemacht, ohne dass jemand darum bat, an ein Betriebsmittel, das sich schon bewegt hat. Das zu entscheiden ist Sache des Bedieners, und die Antwort sagt ihm genau, wo der Aufruf stehen blieb. Alle Schreibzugriffe eines Aufrufs teilen sich seine `call_id`, im Audit-Protokoll und in der Antwort.

Es gibt eine Ausnahme, und das ist der kurzzeitige Befehl: der Druck einer Taste, das Zurücksetzen eines Motors, der Stopp eines Ventils, das Zurücksetzen eines Zählers an einem Bit. Das sind zwei Schreibzugriffe, der Druck und, pulse_ms später, das Loslassen, und das Loslassen lässt man nicht leichtfertig aus, weil sonst ein Taster gedrückt bleibt. Deshalb:

- Das Loslassen wird trotzdem gesendet, wenn der Druck hinausging und einen Fehler meldete (`failed`): Er kann gewirkt haben. Es wird nur übersprungen, wenn der Druck `not_sent` war, denn dann wird nichts gehalten.
- Das Loslassen wird auch gesendet, wenn der Aufrufer während des Impulses auflegt. Der Aufruf läuft ohne ihn weiter.
- Wurde der Druck geschrieben und das Loslassen abgelehnt oder ist fehlgeschlagen, schlägt der Aufruf mit 500 fehl und sagt es: Der Tag **hält womöglich noch den Druckwert**, prüfen Sie ihn und lassen Sie ihn von Hand los. Die Ablehnung oder der Fehler des Loslassens steht im Audit-Protokoll unter derselben Aufruf-ID, und der Aufruf wird unter der Entität mit der Schwere Fehler, nicht Warnung, protokolliert.

Ein Impuls dauert `pulse_ms`, standardmäßig 500, höchstens 10.000. Der Aufruf antwortet, wenn das Loslassen erledigt ist, der Aufrufer wartet also auf den Impuls.

Jeder Aufruf ist außerdem eine Zeile im Systemprotokoll, unter der entity_id, Kategorie `write`, mit dem Grund und, im Detail, der Aufruf-ID, der Quelle und jedem Schreibzugriff mit seinem Status. Die einzelnen Tag-Schreibzugriffe behalten ihre eigenen Zeilen unter ihren Tags, wie immer.

`GET /api/writes?entity=switch.press_01_pump` ist das Audit-Protokoll dieser Entität, Ablehnungen eingeschlossen, neueste zuerst. Die Zeilen haben `entityId`, `service` und `callId`; ein Schreibzugriff direkt auf einen Tag lässt sie weg, sodass jeder bestehende Leser von `/api/writes` genau das sieht, was er vorher sah. Die Migration `0007_service_audit.sql` fügt die drei Spalten hinzu, leer für jede bestehende Zeile.

### Erst fragen: der Probelauf

`POST /api/services/{domain}/{service}?dry_run=true` fragt das Tor, was es mit einem Aufruf tun würde, und tut nichts davon. Derselbe Body, dieselbe Berechtigung.

```json
{"dry_run":true,"entity_id":"number.press_01_zone1_sp","service":"number.set_value","writes":[{"tag":"press-01/zone1_sp","value":"212.5","status":"would_write"}]}
```

```json
{"dry_run":true,"error":"press-01/zone1_sp: this tag is not marked writable","entity_id":"number.press_01_zone1_sp","service":"number.set_value","writes":[{"tag":"press-01/zone1_sp","value":"212.5","status":"not_sent","error":"press-01/zone1_sp: this tag is not marked writable"}]}
```

Der Aufruf wird genau wie der echte geplant, und jeder Schreibzugriff, den er machen würde, wird den eigenen Prüfungen des Tors unterzogen, in derselben Reihenfolge, gegen die Tags, die Entität und das Gerät, wie sie jetzt gerade sind: Schreiben an, der Agentenschalter, der Tag scharf, sein Bereich, alles, was nur die Entität weiß (Schrittweite, Muster, ein Regelkreis im Handbetrieb, eine deaktivierte Entität) und eine Sitzung zum Gerät. Der erste Schreibzugriff, der abgelehnt würde, ist `not_sent` mit dem Grund, die übrigen `skipped`, und `error` ist der Fehler, mit dem der echte Aufruf fehlschlagen würde, **Wort für Wort**. Ein Schreibzugriff, der hinausginge, ist `would_write`. Es ist eine einzige Funktion im Tor (`precheck`), die beides beantwortet, sodass ein Probelauf keine Prüfungen übergehen kann, die der echte Schreibzugriff macht. Eine `alarm`-Entität schreibt keinen Tag, ihr Probelauf macht also die Alarmprüfungen (die Engine läuft, die Definition ist noch da, die Entität ist aktiviert, nur ein ausgeblendeter Alarm wird wieder eingeblendet) und antwortet ohne Schreibzugriffe; der Alarm wird nicht berührt und das Alarmprotokoll erhält nichts.

Es ist eine Frage, also antwortet ein Urteil, abgelehnt oder nicht, mit 200. Eine Anfrage, die der echte Aufruf vor jeder Prüfung abweisen würde (keine solche Entität, ein Dienst, den die Domäne nicht annimmt, Daten, die sie nicht akzeptiert, ein Umschalten ohne bekannten Zustand, die falsche Domäne im Pfad), antwortet mit demselben Status und demselben Fehler wie der echte Aufruf. Ein Benutzer ohne die Berechtigung bekommt dasselbe 403.

Ein Probelauf schreibt nichts, öffnet keine Audit-Zeile, trägt nichts ins Systemprotokoll ein und verbraucht keine Aufruf-ID: Es wurde nichts versucht, also ist nichts zu verantworten.

Er sagt, was **jetzt gerade** passieren würde. Zwischen dem Probelauf und dem echten Aufruf kann das Gerät ausfallen und jemand den Tag entschärfen; der echte Aufruf wird im Moment des Schreibens erneut vollständig geprüft. Ein Fall wird genauer beantwortet als durch die eigenen Prüfungen des echten Aufrufs: ein Gerät, dessen Sitzung abgerissen ist, während sein Worker sich neu verbindet. Der echte Schreibzugriff kommt bis zum Treiber und scheitert dort (`failed`, 503, und eine Audit-Zeile für den Versuch); der Probelauf sagt gleich `not_sent`, mit demselben Fehler.

Die Befehlsabfrage auf dem Bildschirm Entitäten und im Entitätsfenster nutzt ihn: Wenn die Abfrage sich öffnet und während ein Wert getippt wird, fragt sie, und eine Ablehnung erscheint in der Abfrage, in den Worten des Tors, bevor jemand auf Bestätigen drückt. Es ist ein Rat, kein Schloss: Bestätigen geht weiterhin zum Tor, das neu entscheidet.

## Zusammengesetzte Anlagen

Ein Tag entspricht einer Entität. Eine Pumpe entspricht nicht einem Tag: Sie hat einen Einschaltbefehl, einen Rückmeldekontakt, eine Störung, ein Reset und vielleicht eine Drehzahl, und der Bediener sieht sie als ein Ding. Ein Komposit ist dieses eine Ding, an jeden seiner Tags in einer benannten **Rolle** gebunden.

Ein Administrator baut eines mit `POST /api/entities`:

```json
{
  "domain": "motor",
  "name": "Infeed pump",
  "device_class": "pump",
  "options": {"pulse_ms": 500},
  "bindings": [
    {"role": "running",       "device_id": "press-01", "tag_name": "P101_Running"},
    {"role": "run_command",   "device_id": "press-01", "tag_name": "P101_RunCmd"},
    {"role": "fault",         "device_id": "press-01", "tag_name": "P101_Fault"},
    {"role": "reset_command", "device_id": "press-01", "tag_name": "P101_Reset"}
  ]
}
```

`entity_id` ist optional. Lassen Sie sie weg, wird aus dem Namen eine gebildet (`motor.infeed_pump`, dann `_2` und so weiter). Geben Sie sie an, wird sie genau so verwendet, und eine vergebene ist ein 409, kein stilles `_2`: Sie haben nach diesem Namen gefragt. `name`, `device_class`, `unit_of_measurement`, `icon`, `entity_category` und `options` sind dieselben Registerfelder, die jede Entität hat. Setzen Sie es danach per `PUT` in den Anlagenbaum und versehen Sie es mit Bezeichnungen.

Die Erstellung prüft alles, was sie kann, gegen die Tags, wie sie jetzt sind, und lehnt (400, mit dem Hinweis, was zu korrigieren ist) alles ab, was nicht stimmt:

- die Domäne ist eine von `select`, `button`, `motor`, `valve`, `loop`, `counter`, `weather` (`GET /api/entities/composites` sagt welche, und die Rollen jeder). Die Tag-Domänen werden für Sie aus Tags gebildet, und `alarm` aus Alarmdefinitionen;
- jede erforderliche Rolle ist gebunden, und keine Rolle, die die Domäne nicht hat;
- **jeder gebundene Tag existiert**;
- **der Typ jedes Tags passt zu seiner Rolle**: das `running` eines Motors ist ein bool, die `position` eines Ventils eine Zahl, der Zählerstand eines Zählers eine Ganzzahl;
- **jeder Tag, den ein Dienst beschreibt, ist bereits scharf** (`writable`). Ein Komposit schärft nie etwas. Einen Punkt scharf zu schalten bleibt eine Entscheidung, die jemand über den Tag trifft, einzeln, wie es immer war;
- jeder Rohwert in den Optionen (der Wert einer Select-Option, die Druck- und Loslass-Werte einer Taste, die Modi eines Regelkreises) ist einer, den sein Tag annehmen kann. `1.5` wird jetzt für ein Ganzzahl-Register abgelehnt, nicht erst, wenn jemand die Taste drückt.

Ein Komposit geht mit seinem Gerät, wenn alle seine Tags auf einem Gerät liegen, und gehört zu keinem, wenn sie mehrere umspannen. Seine Bindungen sind fest: Ein anderer Satz von Tags ist eine andere Entität, löschen Sie es also und bauen Sie ein neues.

Jede Erstellung und jede Löschung ist eine Zeile im Systemprotokoll unter der entity_id, Kategorie `config`, mit den Bindungen.

### Rollen

| Domäne | Rolle | Tag-Typ | <span class="sr-only">Details</span> |
|---|---|---|---|
| `select` | `state` | beliebig | erforderlich. Rückmeldung: wird zurückgelesen, um die Option zu finden |
| | `command` | beliebig | erforderlich, scharf. Wird mit dem Rohwert der Option geschrieben. Darf derselbe Tag wie `state` sein |
| `button` | `command` | beliebig | erforderlich, scharf. Wird gepulst |
| `motor` | `running` | bool | erforderlich. Rückmeldung: der Rückmeldekontakt |
| | `run_command` | bool | erforderlich, scharf. `start` schreibt true, `stop` false |
| | `fault` | bool | Rückmeldung |
| | `reset_command` | bool | scharf. Wird von `reset` gepulst |
| | `speed` | Zahl | Rückmeldung, das Attribut `speed` |
| | `speed_command` | Zahl | scharf. Wird von `set_speed` geschrieben |
| `valve` | `state` | beliebig | Rückmeldung: wo ein Ventil, das sich selbst angemeldet hat, in Worten sagt, dass es ist |
| | `opened`, `closed` | bool | Rückmeldung: die Endschalter |
| | `position` | Zahl | Rückmeldung, 0 bis 100 Prozent |
| | `fault` | bool | Rückmeldung |
| | `command` | bool | scharf. Ein Auf/Zu-Ventil: `open` schreibt true, `close` false |
| | `position_command` | Zahl | scharf. Ein stetiges Ventil: `set_position`, und `open`/`close` als 100/0 |
| | `stop_command` | bool | scharf. Wird von `stop` gepulst |
| `loop` | `pv` | Zahl | erforderlich. Der Zustand |
| | `setpoint` | Zahl | erforderlich, scharf. Für das Attribut gelesen, von `set_setpoint` geschrieben |
| | `output` | Zahl | erforderlich, scharf. Für das Attribut gelesen, von `set_output` geschrieben |
| | `mode` | beliebig | erforderlich, scharf. Gelesen, um den Modus zu kennen, von `set_mode` geschrieben |
| `counter` | `state` | Ganzzahl | erforderlich. Der Zählerstand |
| | `reset_command` | bool oder Zahl | scharf. Gepulst, wenn bool, mit 0 geschrieben, wenn Zahl (kann das Zählregister selbst sein) |
| `weather` | `temperature` | Zahl | erforderlich. Der Zustand |
| | `humidity`, `pressure`, `wind_speed`, `wind_gust`, `wind_bearing`, `rain_rate`, `rain_today`, `solar_radiation`, `uv_index` | Zahl | Rückmeldung, jeweils ein Attribut. Keines ist scharf: Eine Station wird gelesen, nie bedient |

Ein Ventil braucht mindestens eines von `state`, `opened`, `closed` und `position` (etwas muss sagen, wo es ist) und genau eines von `command` und `position_command`. Beide zugleich wären zwei Antworten auf "wohin wurde es geschickt", und der Zustand zwischen den Endlagen hängt von dieser Antwort ab. Hat die SPS wirklich beides, bauen Sie zwei Entitäten.

### Optionen

| Option | Domäne | <span class="sr-only">Details</span> |
|---|---|---|
| `select_options` | `select` | erforderlich: `[{"option": "low", "value": 1}, ...]`, in der Reihenfolge, in der ein Bildschirm sie anbietet. Namen eindeutig, Werte eindeutig (zwei Optionen mit einem Wert würden den Zustand zum Ratespiel machen), jeder Wert eine Zahl, ein bool oder eine Zeichenkette |
| `press_value`, `release_value` | `button` | zusammen oder gar nicht. Bei einem bool-Tag weggelassen, sind sie `true` und `false`, in die Optionen geschrieben, damit aktenkundig ist, was die Taste tut. Jeder andere Tag-Typ braucht beide |
| `pulse_ms` | `button`, `motor`, `valve`, `counter` | wie lange ein kurzzeitiger Befehl gehalten wird. 1 bis 10.000, 500, wenn nicht gesetzt |
| `single_shot` | `button`, `valve` | `true` schreibt `press_value` einmal und lässt nie los: Der Druck ist der ganze Befehl. Eine entdeckte MQTT-Taste ist eine, weil ihr "Loslassen" ein zweiter Befehl wäre, den das Gerät nie verlangt hat. Nimmt `press_value` und weder `release_value` noch `pulse_ms`. Bei einem Ventil schreibt sein `stop` einmal `true` statt eines Impulses: Der Stopp eines entdeckten Ventils ist ein eigener Befehl |
| `event_types` | `event` | die Ereignistypen, die es auslösen kann, wenn es sie nennt |
| `role_choices` | `lock`, `fan`, `siren`, `notify`, `update`, `device_tracker`, `climate`, `humidifier`, `water_heater` | die Wörter, die jede bedienbare Rolle anbietet, je Rolle, 1 bis 64 verschiedene: die Modi eines Thermostats. Die Erkennung setzt es aus der Konfiguration |
| `modes` | `loop` | erforderlich: der Rohwert des Modus-Tags für jeden Modus, mindestens `{"auto": 1, "manual": 0}`, `cascade`, wenn der Regler ihn hat |

### Wie der Zustand eines Komposits bestimmt wird

Der Zustand eines Komposits kommt aus seiner **Rückmeldung**. Er wird nie daraus berechnet, dass HotLoop einen Befehl gesendet hat. Ein Motor, dem gesagt wurde, er solle starten, und dessen Rückmeldekontakt nicht geschlossen hat, läuft nicht, er startet, und wenn der Kontakt nie schließt, bleibt er im Start, bis jemand nachsieht. Das Zurücklesen eines Befehls-Tags zählt als Rückmeldung: Das ist die SPS, die sagt, was sie hält, nicht HotLoop, das sich erinnert, was es geschrieben hat.

Ein Komposit ist **nie optimistisch**. Ein einzelner Sensor zeigt durch einen schlechten Messwert hindurch weiter seinen letzten guten Wert; ein Komposit nicht. Jede Rückmelde-Rolle, die den Zustand bestimmt, muss einen guten Messwert haben, sonst:

| Bedingung | `state` | `quality` |
|---|---|---|
| ein bestimmender Tag ist weg, oder sein Gerät ist ausgefallen | `unavailable` | `bad` |
| ein bestimmender Tag hat noch keinen Messwert oder einen schlechten | `unknown` | `bad` |
| jeder bestimmende Tag gut, einer davon unsicher oder an einem eingeschränkten Gerät | der Zustand | `uncertain` |
| jeder bestimmende Tag gut | der Zustand | `good` |

Ein Motor, dessen Störungseingang nicht mehr antwortet, ist `unknown`, nicht das `running`, das er vor einer Sekunde war. Welche Rollen bestimmen, steht weiter unten; die anderen füllen nur Attribute, und eine nicht lesbare wird einfach weggelassen.

Das Attribut `armed` eines Komposits ist nur dann true, wenn jeder Tag, den einer seiner Dienste beschreibt, gerade scharf ist. Ein Motor, der von hier aus gestartet, aber nicht gestoppt werden kann, ist keiner, den ein Bildschirm anbieten sollte.

### `motor`

Bestimmende Rollen: `running` und `fault`, falls gebunden. Zustand, die erste Regel, die zutrifft:

1. `fault` an: **`fault`**, was sonst auch gilt. Lauf und Störung zugleich sind widersprüchlich, und was einen Menschen braucht, ist die Störung; das Attribut `running` sagt weiterhin, dass er sich dreht.
2. läuft, und der zurückgelesene Einschaltbefehl ist aus: **`stopping`**.
3. läuft: **`running`**.
4. läuft nicht, und der zurückgelesene Einschaltbefehl ist an: **`starting`**.
5. sonst: **`stopped`**.

Ist das Zurücklesen des Einschaltbefehls nicht lesbar, bestimmt es nichts: Der Motor ist dann allein nach seinem Kontakt `running` oder `stopped`. HotLoop setzt keine Zeitgrenze für einen Start, der nicht zustande kommt: Das ist ein Startfehler, und er gehört in die SPS oder in eine Alarmdefinition auf den Rückmeldekontakt.

Attribute: `running`, `fault` (falls gebunden), `command` (das Zurückgelesene), `speed` (falls gebunden und lesbar), `device_class` (`pump`, `fan`, `conveyor`, `compressor`, `agitator`).

### `valve`

Ein Ventil, das sich selbst angemeldet hat (MQTT-Erkennung), sagt in Worten, wo es ist, auf seiner Rolle `state`: `open`, `closed`, `opening`, `closing` oder `stopped`, und das ist sein Zustand, mit `current_position` aus `position`, wenn es eine meldet. Ein Wort, das keines davon ist, ergibt `unknown`, mit dem, was es sagte, in `raw_value`. Der Rest dieses Abschnitts betrifft ein Ventil, das aus SPS-Tags gebaut ist.

Bestimmende Rollen: jede gebundene von `opened`, `closed`, `position`, `fault`. Zustand, die erste Regel, die zutrifft:

1. `fault` an: **`fault`**.
2. beide Endschalter erreicht: **`fault`**, mit `limit_conflict: true`. Ein Ventil kann nicht offen und geschlossen sein, also lügt ein Schalter, und welcher, ist nichts zum Raten.
3. Offen-Endlage erreicht: **`open`**. Zu-Endlage erreicht: **`closed`**.
4. keine Endschalter, nur eine Position: bei 1 % oder darunter **`closed`**, bei 99 % oder darüber **`open`**.
5. zwischen den Enden, fahrend oder stehend je nachdem, was befohlen ist: ein Positionsbefehl, der um mehr als 1 % über der Position zurückgelesen wird, ist **`opening`**, um mehr als 1 % darunter **`closing`**, innerhalb von 1 % **`stopped`**; ein zurückgelesener Auf/Zu-Befehl an ist **`opening`**, aus ist **`closing`**; ohne Anhaltspunkt **`stopped`**.

Ein Auf/Zu-Ventil, das zwischen seinen Endlagen steht, während es weiter auf Öffnen befohlen ist, liest sich als `opening`. Wenn Sie es dort stehend sehen müssen, binden Sie `position`.

`current_position` ist die Positionsrückmeldung, wenn gebunden, sonst 100 an der Offen-Endlage und 0 an der Zu-Endlage, und dazwischen nicht vorhanden. Weitere Attribute: `open_limit`, `closed_limit`, `fault`, `device_class` (`water`, `gas`, `steam`, `air`).

### `loop`

Der Zustand ist die Prozessgröße, wie bei einem Sensor dargestellt, allein aus `pv`. Die Attribute sind `setpoint` und `output` (vorhanden, wenn lesbar), `mode` (der Name des Modus, den der Modus-Tag liest, oder `unknown`, wenn er sich nicht lesen lässt oder einen Wert enthält, der keiner der Modi ist), `modes` (die konfigurierten Namen) und `unit_of_measurement` (die der Entität, sonst die des PV-Tags). Ein Regelkreis übernimmt die Geräteklassen der Sensoren: ein Temperaturregelkreis, ein Druckregelkreis.

`set_output` wird im Tor abgelehnt, sofern der Regelkreis nicht **im Moment des Schreibens** manuell liest. Ein Ausgang, der auf einen Regelkreis in auto geschrieben wird, kämpft gegen den Regler, und in cascade gegen zwei. Ein Modus, der sich nicht lesen lässt, ist nicht manuell. Die Ablehnung ist eine `write_audit`-Zeile wie jede andere, mit Entität, Dienst, Aufruf-ID und dem angefragten Wert, und der Aufruf antwortet 409. Setzen Sie den Regelkreis zuerst mit `set_mode` auf manuell.

### `counter`

Der Zustand ist der Zählerstand, ein Ganzzahl-Tag. `reset` schreibt 0 in ein numerisches `reset_command` (binden Sie das Zählregister selbst, wenn die SPS es so zurücksetzt) oder pulst ein bool-Register. Ein Zähler ohne `reset_command` ist schreibgeschützt. `unit_of_measurement` ist die der Entität, sonst die des Tags.

### `weather`

Eine Dachstation als eine Entität: siehe [Wetter](/de/iot/weather/). Der Zustand ist die Temperatur; jeder andere Messwert ist ein Attribut, nur vorhanden, wenn sein Sensor gelesen werden kann, mit Taupunkt, Hitzeindex und Windchill, aus ihnen errechnet. Ein Messwert, der gebunden ist und nicht gelesen werden kann, wird in `unavailable` genannt, nie als null angezeigt. Er nimmt keinen Dienst an.

### `select`

Der Zustand ist die Option, deren Rohwert der Tag `state` liest. Ein Wert, der keine der Optionen ist, ergibt `unknown`, mit dem Rohwert in `raw_value`, statt der nächsten Option oder der letzten. Das Attribut `options` listet die Optionsnamen der Reihe nach. Eine Option, die nicht zum Select gehört, wird im Tor abgelehnt und mit der angefragten Option protokolliert.

### `button`

Eine Taste hat keine Rückmeldung. Ihr Zustand ist der Zeitpunkt ihres letzten Drucks über dieses Gateway, oder `unknown`, wenn sie seit dem Start des Gateways nicht gedrückt wurde. Sie ist `unavailable`, wenn ihr Befehls-Tag weg ist oder ihr Gerät ausgefallen, weil Drücken dann nicht funktionieren kann. Der letzte Druck wird im Speicher gehalten und beginnt bei einem Neustart von vorn; das Audit-Protokoll hat jeden Druck trotzdem, und deshalb schreibt das Logbuch den Zustand einer Taste nicht mit.

## Lichter, Rollläden und Ereignisse

Von der [MQTT-Erkennung](/de/iot/mqtt-discovery/) für ein Gerät erzeugt, das sich angemeldet hat, gebunden an die Tags, die die Erkennung dafür angelegt hat. Niemand baut diese aus SPS-Tags, deshalb nimmt `POST /api/entities` sie nicht an. Dieselben Regeln wie bei jedem Komposit: Der Zustand ist das, was die Rückmeldung sagt, nie das, was HotLoop zuletzt gesendet hat, und jeder Dienst besteht aus Schreibzugriffen durch das Tor, jeder Tag vorher von einem Menschen scharf geschaltet.

| Domäne | Rolle | Tag-Typ | <span class="sr-only">Details</span> |
|---|---|---|---|
| `light` | `state` | bool | Rückmeldung: an oder aus |
| | `command` | bool | scharf. `turn_on` schreibt true, `turn_off` false. Derselbe Tag wie `state` |
| | `brightness` | Zahl | Rückmeldung, 0 bis 100 Prozent, das Attribut `brightness` |
| | `brightness_command` | Zahl | scharf. `turn_on` mit einer `brightness`. Derselbe Tag wie `brightness` |
| `cover` | `state` | beliebig | Rückmeldung: `open`, `closed`, `opening`, `closing` oder `stopped` |
| | `command` | beliebig | scharf. `open`, `close` oder `stop`. Derselbe Tag wie `state` |
| | `position` | Zahl | Rückmeldung, 0 (geschlossen) bis 100 (offen), `current_position` |
| | `position_command` | Zahl | scharf. `set_position`. Derselbe Tag wie `position` |
| `event` | `state` | beliebig | der Ereignistyp, den es zuletzt ausgelöst hat |
| `lock` | `state` | beliebig | gelesen und geschrieben: `locked`, `unlocked`, `locking`, `unlocking`, `jammed`, `open`, `opening`; nimmt `lock`, `unlock`, `open` |
| `fan` | `state` | bool | gelesen und geschrieben: an oder aus |
| | `percentage` | Zahl | gelesen und geschrieben, 0 bis 100 |
| | `preset_mode`, `direction` | beliebig | gelesen und geschrieben |
| | `oscillating` | bool | gelesen und geschrieben |
| `siren` | `state` | bool | gelesen und geschrieben: an oder aus |
| `notify` | `message` | beliebig | geschrieben: die Nachricht. Nichts zu lesen |
| `update` | `installed_version`, `latest_version` | beliebig | gelesen |
| `device_tracker` | `state` | beliebig | gelesen: `home`, `not_home` oder die Zone, die er nennt |
| `climate` | `mode` | beliebig | gelesen und geschrieben: der Zustand. `set_hvac_mode` mit `hvac_mode` |
| | `temperature`, `target_temp_low`, `target_temp_high` | Zahl | gelesen und geschrieben. `set_temperature` mit einem davon |
| | `target_humidity` | Zahl | gelesen und geschrieben. `set_humidity` mit `humidity` |
| | `fan_mode`, `swing_mode`, `swing_horizontal_mode`, `preset_mode` | beliebig | gelesen und geschrieben, jeweils über den eigenen `set_`-Dienst |
| | `current_temperature`, `current_humidity`, `action` | Zahl, Zahl, beliebig | gelesen |
| | `power` | bool | geschrieben: `turn_on` true, `turn_off` false. Nichts zu lesen |
| `humidifier` | `state` | bool | gelesen und geschrieben: an oder aus |
| | `target_humidity` | Zahl | gelesen und geschrieben. `set_humidity` mit `humidity` |
| | `mode` | beliebig | gelesen und geschrieben. `set_mode` mit `mode` |
| | `current_humidity`, `action` | Zahl, beliebig | gelesen |
| `water_heater` | `mode` | beliebig | gelesen und geschrieben: der Zustand. `set_operation_mode` mit `operation_mode` |
| | `temperature` | Zahl | gelesen und geschrieben. `set_temperature` |
| | `current_temperature` | Zahl | gelesen |
| | `power` | bool | geschrieben: `turn_on`, `turn_off` |
| `alarm_control_panel` | `state` | beliebig | gelesen: `disarmed`, `armed_home`, `armed_away`, `armed_night`, `armed_vacation`, `armed_custom_bypass`, `pending`, `triggered`, `arming`, `disarming`; geschrieben von `alarm_arm_home`, `alarm_arm_away`, `alarm_arm_night`, `alarm_arm_vacation`, `alarm_arm_custom_bypass`, `alarm_disarm`, `alarm_trigger` |
| `vacuum` | `state` | beliebig | gelesen: `cleaning`, `docked`, `paused`, `idle`, `returning`, `error`; geschrieben von `start`, `pause`, `stop`, `return_to_base`, `clean_spot`, `locate` |
| | `battery_level` | Zahl | gelesen |
| | `fan_speed` | beliebig | gelesen und geschrieben. `set_fan_speed` mit `fan_speed` |
| `lawn_mower` | `activity` | beliebig | gelesen: `mowing`, `paused`, `docked`, `error`, `returning` |
| `camera` | `image` | beliebig | gelesen: ein Hash des neuesten Bildes. Der Zustand ist, wann es sich geändert hat; `entity_picture` ist, wo man es bekommt |
| `image` | `image` oder `url` | beliebig | gelesen: ein gehaltenes Bild wie bei einer Kamera, oder ein Link (`url`, nur http oder https, nie abgerufen) |
| | `start_mowing`, `pause`, `dock` | bool | geschrieben: je ein Druck, über den gleichnamigen Dienst |

Der Zustand ist der Messwert der Zustandsrolle (an oder aus bei einem bool), `unknown`, wenn er sich nicht lesen lässt, und jede andere lesbare Rolle ist ein Attribut unter ihrem eigenen Namen: `percentage`, `preset_mode`, `oscillating` und `direction` eines Lüfters. `toggle` richtet sich nach der Rückmeldung und wird abgelehnt, wenn es keine gibt. Ein Benachrichtiger hat nichts zu lesen: Sein Zustand ist `unknown` mit `feedback: none`. Ein Update ist `on`, wenn das Installierte nicht das Neueste ist, und nimmt keine Dienste an: HotLoop installiert nie Firmware, denn ein fehlgeschlagenes Flashen ist ein Ausfall. Eine entdeckte Szene ist eine Einmal-Taste, ihr Druck ist die Nutzlast der Szene.

Was an ein Ding gesendet werden kann, steht in seinen Attributen, je nach Konfiguration: die `hvac_modes`, `fan_modes`, `preset_modes` und `swing_modes` eines Thermostats, die `available_modes` eines Luftbefeuchters, die `operation_list` eines Warmwasserbereiters, die `preset_modes` eines Lüfters, die `fan_speed_list` eines Saugroboters (aus der Option `role_choices` der Entität, die die Erkennung im Gleichschritt mit der Konfiguration hält), und `min_temp`/`max_temp` und `min_humidity`/`max_humidity` des Sollwerts (aus dem Bereich des Tags). Das bieten die Bildschirme an. Es ist nicht das, was die Regel macht: Das Tor hält den Sollwert im Bereich des Tags, und der Treiber lehnt ein Wort ab, das die Konfiguration nicht aufführt, was auch immer ein Attribut sagt. `set_temperature` mit keinem seiner drei Schlüssel wird abgelehnt, es ist kein Aufruf, der nichts tut. `turn_on` an einem Thermostat ohne Power-Topic wird ebenfalls abgelehnt, statt zu raten, welcher Modus "an" bedeutet.

### `light`

An oder aus nach ihrer `state`-Rückmeldung; `unknown`, wenn sie sich nicht lesen lässt, und ganz ohne Zustands-Topic für immer `unknown` mit `feedback: none`. Die Helligkeit ist ein Attribut, und `color_mode`, `color`, `color_temp` und `effect` eines Lichts mit JSON-Schema sind ebenfalls Attribute: angezeigt, nicht bedient. `toggle` richtet sich nach der Rückmeldung und wird abgelehnt, wenn es keine gibt.

### `cover`

Ihre `state`-Rückmeldung, wenn sie eine hat. Mit nur einer Position: bei 1 % oder darunter `closed`, alles darüber `open`. Ein Wort, das keines der fünf ist, ergibt `unknown`, mit `raw_value`. `current_position` ist die Position, wenn es eine gibt.

### `event`

Der Zustand eines Ereignisses ist, **wann** es zuletzt ausgelöst wurde (RFC 3339), und `event_type`, was es war; `event_types` listet auf, was es auslösen kann. `unknown`, bis es ausgelöst hat, seit HotLoop es zu lesen begann. Es nimmt keine Dienste an: Nichts bedient ein Ereignis. Zwei Ereignisse in einer Abfrage erscheinen als das spätere; das Logbuch und der Verlauf haben jeden Messwert, wie er kam.

## Alarm-Entitäten

Jede Alarmdefinition ist eine Entität: `alarm.<definition id>` (auf dieselbe Weise zum Slug gemacht wie bei einem Tag, `oven-temp-hi` wird also `alarm.oven_temp_hi`), Plattform `alarm`, `unique_id` `alarm:<definition id>`, benannt nach der Definition. Sie hat keine Bindungen und kein Gerät: Ihr Zustand ist der der Alarm-Engine, nicht der eines Tags, und eine Definition gehört nicht wie ein Tag zu ihrem Gerät (das Löschen eines Geräts lässt seine Alarmdefinitionen bestehen). Der Tag, den sie überwacht, ist ihr Attribut `source`.

Der Zustand ist der ISA-18.2-Zustand, den die Alarm-Engine hält, so geschrieben, wie ein Entitätszustand geschrieben wird:

| Alarm-Engine | Entitätszustand | <span class="sr-only">Details</span> |
|---|---|---|
| `normal` | `normal` | Bedingung weg, nichts offen |
| `unack-active` | `active_unack` | Bedingung wahr, niemand hat quittiert |
| `ack-active` | `active_ack` | Bedingung wahr, quittiert |
| `rtn-unack` | `rtn_unack` | zurückgegangen, bevor jemand quittiert hat |
| `shelved` | `shelved` | von einem Bediener für begrenzte Zeit stummgeschaltet |
| `suppressed` | `suppressed` | konstruktionsbedingt stummgeschaltet |

Die Qualität ist `good`: Der Zustand der Engine ist kein Messwert. Die Entität ist `unavailable`, wenn sie verwaist ist oder das Gateway keine Alarm-Engine hat. Sie folgt jedem Übergang, während er geschieht, Quittierungen eingeschlossen.

Attribute: `definition_id`, `source`, `condition`, `limit`, `priority` (1 bis 4), `priority_label`, `enabled`, `message`, `count`, `active`, `needs_ack`, `trip_value`, `raised_at`, `cleared_at`, `acked_at`, `acked_by`, `shelved_until`, `shelved_by`, die letzten vorhanden, wenn sie zutreffen.

Ihre Dienste `acknowledge`, `shelve` und `unshelve` schreiben keinen Tag und gehen deshalb nicht durch das Schreibtor. Sie rufen `Ack`, `Shelve` und `Unshelve` der Alarm-Engine selbst auf, dieselben, die der Alarmbildschirm und `POST /api/alarms/{id}/ack` aufrufen, sodass sie im Alarmprotokoll (`alarm_events`) und im Systemprotokoll genau wie diese landen. Sie brauchen **`alarms.ack`**, nicht `values.write`: Ein Bediener quittiert Alarme, ein Betrachter nicht. Ein abgelehnter Aufruf antwortet 403 und wird unter der Entität mit dem Namen dessen, der es versucht hat, protokolliert. Der Aufruf ist außerdem eine Zeile im Systemprotokoll unter der Entität, mit dem Grund.

`unshelve` wird (409) bei einem Alarm abgelehnt, der nicht ausgeblendet ist. Auch die Alarm-Engine lehnt es ab und bringt einen ausgeblendeten Alarm in den Zustand zurück, in dem seine Bedingung tatsächlich ist, nicht blind auf normal. Ein Dienst, den Alarme nicht annehmen (`turn_on`), wird als unbekannter Dienst (400) abgelehnt, bevor er in die Nähe der Engine kommt.

### Plattformen mit Provider

Alarm-Entitäten sind die erste **Provider**-Plattform: Entitäten, deren Wahrheitsquelle woanders liegt als in einem Tag. Ein Provider sagt, welche Entitäten seine Plattform gerade hat, stellt ihren Zustand dar, führt ihre Dienste aus und beantwortet ihre Probeläufe; das Register leitet seine Entitäten über `unique_id` genau so ab, verwaist und übernimmt sie wieder, wie es bei einem Tag tut, die Zustands-Engine berechnet sie bei den eigenen Ereignissen des Providers und in ihrem Sekundentakt neu, und ein Dienstaufruf auf eine geht an den Provider, statt in Tag-Schreibzugriffe geplant zu werden. Ein Provider, der einen Tag schreibt, schreibt ihn weiterhin durch das Tor.

Helfer sind die zweite: `input_boolean`, `input_number`, `input_select`, `input_text`, `input_counter`, `timer` und `schedule`, Werte, die den Menschen im Werk gehören statt einer SPS, von HotLoop gehalten und mit `helpers.write` gesetzt. Sie schreiben keinen Tag. Siehe [Helfer](/de/iot/helpers/).

Skripte sind die dritte: Jedes Skript ist eine `script`-Entität, `script.<id>`, an, solange ein Lauf davon in irgendeinem Prozess läuft, und aus, wenn keiner läuft. `turn_on` führt es mit den Dienstdaten als seinen Feldern aus, `turn_off` stoppt es, beide mit `scripts.run`. Das Löschen eines Skripts verwaist seine Entität, wie das Löschen einer Alarmdefinition. Siehe [Skripte](/de/iot/scripts/).

Rezepte sind die vierte: Jedes Rezept ist eine `scene`-Entität, `scene.<id>`, deren Zustand ist, wann sie zuletzt in die Anlage geschrieben hat, und deren Attribute sagen, wie ihre neueste Anwendung verlief. `turn_on` wendet es an, mit `recipes.apply` und der eigenen Berechtigung des Rezepts, wenn es eine nennt. Das Löschen eines Rezepts verwaist seine Entität. Siehe [Rezepte](/de/iot/recipes/).

Die Sonne ist die fünfte: `binary_sensor.sun_up`, `sensor.sun_elevation` und `sensor.sun_azimuth`, jede Sekunde aus Breiten- und Längengrad des Standorts berechnet, auf dem Gerät. Sie werden gelesen und nehmen keine Dienste an. Ein Standort ohne Ortsangabe hat keine, und solche, die noch aus der Zeit übrig sind, als er eine hatte, lesen sich als nicht verfügbar und sagen, welche Variablen zu setzen sind. Siehe [die Sonne](/de/iot/sun/).

## Entitäten überall sonst

### Der Live-Feed

`GET /api/stream` führt neben `values` ein `entities`-Ereignis. Es wird auf dieselbe Weise zusammengefasst, höchstens viermal pro Sekunde, der neueste Zustand je Entität:

```
event: entities
data: {"changed":[{"entity_id":"sensor.press_01_zone1_temp","state":"212.5",...}],"removed":[]}
```

`changed` ist der vollständige Zustand jeder Entität, die sich seit dem letzten Ereignis geändert hat, in derselben Form wie `GET /api/states/{entity_id}`. `removed` sind die entity_ids, die gar keinen Zustand mehr haben: deaktiviert, mit ihrem Gerät gelöscht oder umbenannt (der neue Name kommt in `changed`). Das erste `entities`-Ereignis einer neuen Verbindung trägt jeden Zustand, wie `snapshot` jeden Messwert trägt, sodass ein Bildschirm gefüllt ist, bevor sich etwas ändert. Die Ereignisse `values`, `snapshot`, `alarm` und `device` sind genau das, was sie waren.

### MCP

Agenten bekommen `list_entities`, `get_states` und `call_service`. `call_service` läuft über denselben Dienst-Runner wie `POST /api/services/...`, sodass der Aufruf eines Agenten vom MCP-Schalter wie `write_tag` begrenzt und gegen die Entität mit der Quelle `mcp` protokolliert wird. Siehe [MCP](/de/iot/mcp/#entitäten).

### Automatisierungen

Ein `state`-Trigger löst eine Regel aus, wenn sich der Zustand einer Entität ändert, Bedingungen können `states`, `attrs` und die `qualities` der Entitäten lesen, und eine `call_service`-Aktion bedient eine Entität durch das Tor, protokolliert als `automation:<rule-id>`. Siehe [Automatisierungen](/de/iot/automations/#zustandsauslöser-folgen-entitäten).

Beide folgen dem Hook `OnStateChanged` der Engine, weshalb die Regeln in [Wie die Engine läuft](#wie-die-engine-läuft) wichtig sind: Ein Zustands-Trigger sieht jede Änderung, die die Engine berechnet, einmal, der Reihe nach, und nichts, was die Engine nie gesehen hat.

## Bildschirme

**Entitäten** listet jede Entität unter ihrem Platz im Anlagenbaum (ihrem eigenen, sonst dem ihres Geräts), mit dem Baum an der Seite, und filtert nach Platz, Domäne, Bezeichnung, Text und Qualität. Innerhalb eines Platzes kommen zuerst die Anlagen (Alarme, Motoren, Ventile, Regelkreise, Selects, Tasten, Zähler), dann das, was bedient werden kann, dann die Rohmesswerte.

Standardmäßig zeigt der Bildschirm jedes Signal einmal. Das Entitätsmodell gibt einem Punkt absichtlich mehrere Entitäten, und jede behält ihre ID, aber als Kacheln gezeichnet ist das dasselbe Signal zwei- oder dreimal: Ein scharfer Tag ist ein Sensor und ein Schalter, und ein in einen Motor gebundener Tag ist immer noch sein eigener Sensor. An einer echten Linie verdoppelte das ungefähr die Kacheln und begrub die Anlagen. Also faltet der Bildschirm:

- Die Lese-Entität eines Tags sitzt hinter seiner Steuer-Entität. Der Schalter oder die Zahl ist die Kachel, da sie schon den Live-Zustand zeigt, und ihr Fenster sagt "auch verfügbar als" mit der entity_id des Sensors, für jeden, der eine Automatisierung oder einen Agenten daran anschließt.
- Ein in ein Komposit gebundener Tag sitzt im Komposit, beide seiner Entitäten. Das Fenster des Komposits listet seine Signale: die Rollen, den Tag, was er jetzt liest, und seine Lese- und Steuer-entity_ids. Ein Tag in zwei Kompositen kommt nach Namen in das erste.
- Nur eine Steuerung oder ein Komposit, das weder ausgeblendet noch deaktiviert ist, nimmt etwas auf. Blenden Sie den Schalter aus oder deaktivieren Sie ihn, und sein Sensor bekommt seine Kachel zurück.
- Ein Alarm auf einem gefalteten Signal markiert die Kachel, in die es gefaltet ist, mit dem Namen des Alarms, und öffnet den Alarm von dort. Das Falten räumt den Bildschirm auf; es verbirgt nie einen Alarm.
- Die Zahl neben der Qualitätsleiste lautet "13 angezeigt · 25 eingefaltet", und eine Kachel, die andere enthält, sagt es in ihrem Fuß ("5 Signale", "+ sensor"). Die Domänen-Chips, die Baumzahlen und die Qualitätsleiste zählen die angezeigten Kacheln.
- Suche und Bezeichnungsfilter schauen in die Kacheln hinein. Suchen Sie eine entity_id oder einen Tag, der gefaltet ist, bekommen Sie die Kachel, die ihn enthält, umrandet, mit "Hier gefunden:" und der entity_id. Das haben wir dem vorgezogen, den ganzen Bildschirm auf jede Entität umzuschalten: Sie landen bei der Pumpe, die Sie suchten, nicht an einer Wand aus Kacheln.

"Jede Entität anzeigen" schaltet das Falten ab und gibt jeder Entität ihre eigene Kachel, für einen Ingenieur, der das rohe Register will. Es ist standardmäßig aus, und dieser Browser merkt es sich (lokaler Speicher; ein privates Fenster vergisst es). Der Bildschirm von niemand anderem ändert sich.

Zustände kommen über das `entities`-Ereignis des Live-Feeds; der Bildschirm fragt sie nie ab. Eine Kachel wird neu gezeichnet, wenn sich ihr Zustand ändert, und auch dann, wenn eine Taste darin den Fokus hat, weil eine Kachel, die aus diesem Grund einen alten Zustand behielte, die Vergangenheit als Gegenwart zeigen würde. Die Qualität wird vor dem Wert gezeichnet:

| Qualität | Auf dem Bildschirm |
|---|---|
| gut | der Wert, keine Markierung |
| unsicher | der Wert, ein bernsteinfarbener Rand und ein Abzeichen "unsicher" |
| schlecht | der letzte gute Wert, ausgegraut auf Schraffur, "schlecht", und "letzter guter Wert, Messwert schlecht", mit dem Grund dahinter, wenn der Treiber einen gab |
| noch kein Messwert | "Unbekannt", kursiv, und "Messwert schlecht" mit dem Grund, wenn es einen gibt |
| nicht verfügbar | "Nicht verfügbar", die ganze Kachel schraffiert |

Die Bedienelemente folgen Domäne und Rolle. Ein Betrachter sieht keine. Ein Bediener sieht die hinter `values.write` (und die eines Alarms hinter `alarms.ack`), deaktiviert und mit dem Grund darauf, wenn Schreiben in dieser Installation aus ist oder ein Tag, den die Entität beschreibt, nicht scharf ist. Der Ausgang eines Regelkreises wird nur angeboten, solange er manuell liest, weil das der einzige Moment ist, in dem das Tor es erlaubt. Jeder Befehl öffnet eine Abfrage, die sagt, welcher Dienst, welche Tags und was die Entität gerade liest, und einen Grund für das Audit-Protokoll aufnimmt. Eine Ablehnung hält die Abfrage offen mit den Worten des Tors und jedem Schreibzugriff, der hinausging oder nicht. Der neue Zustand wird nie aus dem Befehl angenommen: Er kommt über den Feed zurück, wenn das Gerät zurückliest, oder er kommt nicht.

Das Fenster zeigt den Zustand und seine Zeitstempel, die Bedienelemente, eine Stunde, sechs Stunden oder einen Tag Verlauf des gebundenen Tags (eine Stufenkurve, der letzte Wert bis jetzt fortgeführt, schlechte Messwerte markiert), die anderen Entitäten desselben Signals, die Bindungen (bei einem Komposit seine Signale), die Attribute und jeden über die Entität gegebenen oder abgelehnten Befehl. Ein Administrator bekommt außerdem die entity_id, den Namen, den Platz im Baum, die Bezeichnungen, ausgeblendet und deaktiviert, und Löschen für ein Komposit oder eine verwaiste Entität.

**Neue Anlage** (Administrator) baut ein Komposit: Wählen Sie die Domäne, benennen Sie es und wählen Sie für jede Rolle einen Tag. Jeder Rolle werden nur Tags eines passenden Typs angeboten, und eine Befehlsrolle zeigt die nicht scharfen Tags deaktiviert, statt sie zu verbergen. Was erforderlich ist, ist markiert, wird aber vom Formular nicht durchgesetzt: Das Register entscheidet, und seine Ablehnung wird so gezeigt, wie es sie geschrieben hat.

**Werk** ist der Anlagenbaum und die Bezeichnungen. Siehe [Der Anlagenbaum und die Bezeichnungen](/de/iot/equipment/).

## Sicherung und Wiederherstellung

`entities` und `entity_bindings` sind in der Sicherung, entity_id, Anpassungen und alles. Das schließt Komposite ein, jede Rolle und jede Option, was für sie mehr zählt als für alles andere: Die Entität eines Tags ließe sich aus ihrem Tag neu aufbauen, aber nichts kann ein Komposit neu aufbauen außer der Sicherung. Alarm-Entitäten kommen mit ihren Definitionen zurück, und eine wiederhergestellte Definition ohne Entität bekommt beim ersten Abgleich eine. Eine Sicherung, die vor dieser Version erstellt wurde, hat keine der beiden Tabellen; stellen Sie sie wieder her, starten Sie das Gateway, und der erste Abgleich des Registers gibt jedem wiederhergestellten Tag seine Entität. `entity_labels` ist ebenfalls in der Sicherung, und die Wiederherstellung einer Sicherung aus der Zeit vor dem Anlagenbaum wird in [Der Anlagenbaum und die Bezeichnungen](/de/iot/equipment/) behandelt.

Die Migration 0007 fügt `write_audit` drei Spalten hinzu. Eine Sicherung, die davor erstellt wurde, lässt sich weiterhin wiederherstellen: Die Wiederherstellung lädt eine Datei mit weniger Spalten als die heutige Tabelle in die vorderen Spalten und lässt die neuen ihre Standardwerte nehmen, weil eine Migration, die eine Spalte hinzufügt, sie immer hinten anhängt. Eine Sicherung aus einer neueren Version wird weiterhin abgelehnt. Siehe [Sicherungen und Wiederherstellung](/de/iot/backup/).

## Was noch nicht da ist

Der Kern, der Anlagenbaum, das Bedienen von Entitäten durch das Schreibtor, zusammengesetzte Anlagen, Alarm-Entitäten, Entitäten in MCP, Automatisierungen und der Live-Feed sowie die Bildschirme sind alle da. Siehe die [HotLoop-Roadmap](/de/roadmap/). Das `forSec` eines Zustands-Triggers ("fünf Minuten lang an") steht in [Automatisierungen](/de/iot/automations/#einen-zustand-halten-forsec).
