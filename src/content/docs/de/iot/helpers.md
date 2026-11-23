---
title: "Helfer"
description: "Die Werte, die den Leuten im Werk gehören, etwa das Chargenziel oder welche Schicht läuft: Schalter, Zahlen, Auswahllisten, Texte, Zähler, Timer und Zeitpläne."
---

Ein Helfer ist ein Wert, der den Leuten im Werk gehört und nicht einer SPS. „Linie 2 ist im Umrüsten.“ „Das Chargenziel für heute sind 1.250 kg.“ „Schicht B läuft.“ „Zwölf Teile Ausschuss seit dem letzten Zurücksetzen.“ „Die Spülung hat noch neun Minuten.“ Nichts davon steht in einem Register, und alles davon ist genau das, was Regeln und Bildschirme wissen müssen.

HotLoop kennt sieben Arten davon. Ein Helfer ist eine Entität wie jede andere: Er hat eine `entity_id`, einen Zustand, Attribute und Dienste, er sitzt im Anlagenbaum, er erscheint in `/api/states`, auf dem Bildschirm Entitäten, in `list_entities` über MCP und im Zustandsauslöser einer Automatisierung. Anders ist, wo sein Wert liegt: HotLoop hält ihn in der Datenbank, und **kein Dienst eines Helfers schreibt jemals ein Tag**.

## Die sieben

| Domäne | Zustand | Optionen | Dienste |
|---|---|---|---|
| `input_boolean` | `on` / `off` | `initial` (true/false), `restore` | `turn_on`, `turn_off`, `toggle` |
| `input_number` | die Zahl, `"1250"` | `min`, `max` (beide Pflicht), `step` (Standard 1), `mode` (`slider` oder `box`), `initial`, `restore` und eine `unit_of_measurement` | `set_value {value}`, `increment`, `decrement` |
| `input_select` | die Auswahl | `choices` (Pflicht, bis zu 100), `initial`, `restore` | `select_option {option}`, `select_next {cycle}`, `select_previous {cycle}` |
| `input_text` | der Text | `max_length` (Standard und Obergrenze 255), `pattern`, `initial`, `restore` | `set_value {value}` |
| `input_counter` | eine ganze Zahl | `initial` (Standard 0), `step` (Standard 1), `min`, `max`, `restore` | `increment`, `decrement`, `reset`, `set_value {value}` |
| `timer` | `idle` / `active` / `paused` | `duration_sec` (Pflicht, 1 Sekunde bis 7 Tage), `restore` | `start {duration}`, `pause`, `cancel`, `finish` |
| `schedule` | `on` / `off` | `schedule` (Pflicht) | keine: Er folgt der Uhr |

Der Zähler heißt `input_counter`, nicht `counter`. `counter` ist schon das SPS-Verbundobjekt, dessen Zurücksetzen ein Tag schreibt, und es bleibt genau das, was es ist.

Jede Option wird beim Speichern des Helfers geprüft, und `initial` gegen alle anderen: Ein `input_number` von 0 bis 100, der bei 150 beginnt, wird abgelehnt und nicht bei 100 gestartet. Eine Option, die eine Domäne nicht kennt, ist ein Fehler und keine stillschweigend ignorierte Einstellung. Die Helferoptionen (`initial`, `restore`, `choices`, `duration_sec`, `mode`, `schedule`) werden aus demselben Grund in jeder anderen Domäne abgelehnt.

## Einen anlegen

Ein Administrator legt Helfer an (`entities.write`). Auf dem Bildschirm Entitäten: **Neuer Helfer**, neben Neue Anlage. Über die API:

```
POST /api/helpers
{"name": "Batch target", "domain": "input_number", "unit_of_measurement": "kg",
 "options": {"min": 0, "max": 5000, "step": 50, "initial": 1000}}
```

Die `entity_id` wird aus dem Namen gebildet (`input_number.batch_target`), sofern Sie keine angeben. `PUT /api/helpers/{entity_id}` ändert Namen, Symbol, Einheit oder Optionen; `DELETE /api/helpers/{entity_id}` löscht ihn samt seinem Wert. Die ganze API steht in [der HTTP-API](/de/iot/api/#helfer).

Eine Änderung der Optionen, die den aktuellen Wert des Helfers außerhalb von ihnen ließe, wird abgelehnt: einen Bereich unter den Wert einzuengen oder die ausgewählte Auswahl zu entfernen. Setzen Sie zuerst den Wert oder wählen Sie Optionen, die ihn einschließen. Ein Wert wird nie verschoben, damit er passt.

## Einen setzen

Jeder mit `helpers.write` setzt Helfer. Bediener haben es: den Schichtwähler zu bedienen und den Ausschuss zu zählen ist Betrieb, nicht Konfiguration. Betrachter haben es nicht. Es ist nicht `values.write`, denn ein Helfer schreibt kein Tag.

Einen Helfer zu setzen ist ein Entitätsdienst-Aufruf, derselbe Aufruf, den jede andere Entität annimmt:

```
POST /api/services/input_counter/increment   {"entity_id": "input_counter.scrap", "reason": "short shot"}
POST /api/services/timer/start               {"entity_id": "timer.purge", "duration": "0:15:00"}
```

Die Antwort sagt, was der Helfer jetzt ist: `{"call_id": "...", "state": "13", "writes": []}`. `?dry_run=true` funktioniert auch und antwortet mit denselben Worten wie der echte Aufruf, ohne etwas zu ändern.

Auf dem Bildschirm Entitäten bekommt ein Helfer eine eigene Kachel, nie in eine andere eingefaltet (er hat keine Tags, nach denen man falten könnte), mit seinen Bedienelementen für jeden, der `helpers.write` hat. Jede Änderung wird zuerst bestätigt, mit einer Begründung, wie jeder andere Befehl.

Über MCP gibt es kein neues Werkzeug: `list_entities` findet Helfer, `get_states` liest sie, `call_service` setzt sie. Ein Agent ändert einen Helfer nur in einer Installation mit eingeschaltetem `HOTLOOP_ALLOW_WRITES`, demselben Schalter, den ein Schreibzugriff auf ein Tag braucht. Ein Helfer bewegt keine Anlage, aber er ist das, worauf Regeln reagieren, und ein Agent, der den Umrüstschalter umlegt, ist ein Agent, der startet, was die Umrüstregel tut.

## Abgelehnt, nie begrenzt

Ein Wert, den ein Helfer nicht annimmt, wird abgelehnt, und nichts ändert sich:

- eine Zahl außerhalb von `min`..`max` oder neben ihrem `step` (von `min` aus gezählt);
- ein `increment`, das `max` überschreiten würde, ein `decrement`, das `min` unterschreiten würde (abgelehnt, nicht an der Grenze angehalten: „an der Grenze angehalten“ ist ein Wert, den niemand verlangt hat);
- eine Option, die nicht zu den möglichen Auswahlwerten gehört; `select_next` hinter dem letzten Auswahlwert mit `cycle: false`;
- ein Text, der länger als `max_length` ist oder nicht zu `pattern` passt (der ganze Text muss passen);
- ein Zählwert, der keine ganze Zahl ist oder `min` oder `max` des Zählers überschreitet;
- ein Timer, der angehalten wird, wenn er nicht läuft, abgebrochen oder beendet wird, wenn er inaktiv ist, oder für weniger als eine Sekunde oder mehr als sieben Tage gestartet wird;
- ein deaktivierter Helfer; ein Aufrufer ohne `helpers.write`; ein Agent mit ausgeschalteten MCP-Schreibzugriffen.

Jede Ablehnung ist eine Warnung im Systemprotokoll (`GET /api/events`) zum Helfer, mit dem, der gefragt hat, und dem Grund der Ablehnung, genau wie die Ablehnung einer Alarmquittierung. Ein Fehler in der Anfrage selbst (ein Feld, das der Dienst nicht annimmt, `"50"` dort, wo eine Zahl hingehört) ist ein Fehler des Aufrufers, wird mit 400 beantwortet und ändert und protokolliert nichts.

## Wo Änderungen festgehalten werden

Jede Änderung ist eine Zeile im Systemprotokoll zum Helfer: wer, von was, zu was, die Aufruf-ID, woher sie kam und die Begründung, falls eine angegeben wurde.

```
otto   input_counter.increment: 12 -> 13; reason: short shot
system timer finished: active -> idle, due at 2026-09-27T21:10:00Z
```

Die Zeile wird in derselben Transaktion wie der Wert geschrieben, es gibt also nie eine Änderung ohne ihre Zeile oder eine Zeile ohne ihre Änderung.

Eine Zustandsänderung ist außerdem eine Zeile im [Logbuch](/de/iot/logbook/), in derselben Transaktion, mit demselben Wer, derselben Quelle und derselben Aufruf-ID. Sie wird von dem Prozess geschrieben, der die Änderung vorgenommen hat, egal welcher, deshalb wird auch die Änderung eines Agenten über `--mcp-stdio` protokolliert, und zwar einmal. Helferzeilen werden nie in der Häufigkeit begrenzt: Jede ist jemand, der etwas entscheidet. Ein Aufruf, der den Zustand so lässt, wie er war (eine Zahl, die auf den Wert gesetzt wird, den sie schon hat), steht im Systemprotokoll, aber nicht im Logbuch, weil sich nichts geändert hat.

## Neustarts

Ein Helfer behält seinen Wert über einen Neustart: Das Gateway kommt zurück, die Schicht ist immer noch B und der Zähler immer noch 13. Setzen Sie `restore: false` bei einem, der jedes Mal frisch beginnen soll (ein Zähler „seit dem letzten Neustart“): Das Gateway setzt ihn beim Start auf seinen Anfangswert zurück und sagt das im Protokoll. Das tut nur das Gateway selbst. Ein `--mcp-stdio`-Prozess, den ein Agent neben einem laufenden Gateway startet, hält dieselben Helfer und hört jede Änderung, setzt aber nie etwas zurück, denn die Werte des Werks zurückzusetzen, weil sich ein Agent verbunden hat, wäre absurd.

## Timer

Ein Timer läuft nach der Wanduhr. Für zehn Minuten gestartet, endet er zehn Minuten später, was auch dazwischen passiert: Ein Neustart, der zwei Minuten gedauert hat, lässt ihm acht zu laufen. Ein angehaltener Timer bleibt angehalten, mit der Zeit, die ihm blieb, über beliebig viele Neustarts, und `start` setzt ihn fort.

Ein Timer, der abgelaufen ist, **während HotLoop nicht lief**, wird beim nächsten Start von HotLoop auf `idle` zurückgesetzt, mit `finished_late_at` auf dem Zeitpunkt, zu dem er fällig war, und einer Warnung im Protokoll. **Dafür wird nichts ausgelöst.** Eine Regel, die darauf wartet, dass dieser Timer inaktiv wird, läuft nicht, denn der erste Blick der Engine darauf nach einem Start ist eine Basislinie, keine Änderung. Was er zeitgesteuert hat (eine Spülung, eine Aushärtung), ist lange her oder nie passiert, und es jetzt zu tun, zu spät und ungefragt, ist schlimmer, als zu sagen, dass es verpasst wurde. Suchen Sie nach `finished_late_at` und entscheiden Sie.

Ein Timer ist keine Verriegelung. Er läuft nach der Uhr eines Prozesses, über eine Datenbank und ein Netzwerk, auf die Sekunde und meist auf die Millisekunde. Alles, was rechtzeitig stoppen muss, gehört in die SPS.

## Zeitpläne

Ein Zeitplan ist innerhalb seiner Blöcke an und außerhalb aus:

```json
{"schedule": {
  "mon": [{"from": "06:00", "to": "14:00", "data": {"crew": "A"}},
          {"from": "14:00", "to": "22:00", "data": {"crew": "B"}}],
  "fri": [{"from": "22:00", "to": "06:00", "data": {"crew": "C"}}]
}}
```

- Die Tage sind `mon` bis `sun`. Eine Zeit ist `HH:MM` oder `HH:MM:SS`; `24:00` ist das Ende eines Tages.
- Ein Block, dessen `to` vor seinem `from` liegt, läuft über Mitternacht: Freitag 22:00 bis 06:00 ist bis Samstag 06:00 an.
- Blöcke, die sich berühren, sind eine einzige Strecke „an“; Blöcke, die sich überlappen, werden abgelehnt, denn welche Daten gelten, wäre geraten.
- Solange ein Block an ist, stehen seine `data` in den Attributen der Entität (`crew: "B"`), und `next_event` sagt immer, wann sich der Zeitplan das nächste Mal ändert.
- Er wird nach der Wanduhr in der Zeitzone des Standorts gelesen (`HOTLOOP_SITE_TIMEZONE`), denn eine Schicht, die um 06:00 beginnt, beginnt auch an dem Tag der Zeitumstellung um 06:00. In der Nacht, in der die Uhren vorgestellt werden, ist die Stunde, die nicht stattfindet, nicht an; in der Nacht, in der sie zurückgestellt werden, ist die Stunde, die zweimal stattfindet, beide Male an.

## Mehr als ein Prozess

Jede Änderung wird mit Postgres `NOTIFY` angekündigt, und jeder Prozess, der die Helfer hält, hört zu. Ein in einem Prozess gesetzter Helfer zeigt seinen neuen Wert in jedem anderen innerhalb eines Hin und Zurück, ein in einem angelegter oder gelöschter Helfer erscheint oder verschwindet in den anderen, und eine Änderung über `PUT /api/helpers/{entity_id}` wird genauso übernommen (eine über `PUT /api/entities/{entity_id}` erreicht die anderen bei deren nächstem Registerabgleich, wie bei jeder Entität). Jeder Schreibvorgang ist an die Revision der Zeile geknüpft, deshalb verlieren zwei Prozesse, die gleichzeitig denselben Zähler hochzählen, nie eine Zählung, und einen Timer, den beide halten, beendet genau einer von ihnen.

## Sicherungen

Helfer sind in jeder Sicherung: ihre Konfiguration bei den Entitäten und ihre Werte in `helper_state`, Revisionen eingeschlossen. Ein wiederhergestelltes Werk kommt mit der Schicht, den Zielen und den Zählungen zurück, die es hatte, und ein Timer, der lief, läuft nach der Wanduhr weiter (oder, wenn er inzwischen abgelaufen ist, inaktiv und als verspätet markiert, wie oben).

## In Automatisierungen

Ein Helfer ist das, worauf Regeln reagieren und was sie setzen:

```json
{"triggers": [{"type": "state", "entityId": "input_boolean.changeover", "to": "on"}],
 "actions": [{"type": "call_service", "params": {"entityId": "number.line_2_speed_sp",
   "service": "number.set_value", "data": {"value": 0}}}]}
```

Der Schreibzugriff der Regel auf das Tag geht wie jeder andere durch das Schreibtor, mit der Regel als Akteur. `states['input_select.shift'] == 'B'` funktioniert in einer Bedingung, und eine Regel kann einen Helfer mit `call_service` genauso setzen, wie sie einen Schalter betätigt.
