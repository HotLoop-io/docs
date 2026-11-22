---
title: "Store and Forward in HotLoop Flow"
description: "Als dauerhaft markierte Verbindung: Nachrichten gehen der Reihe nach auf die Platte, wenn der Knoten dahinter nicht mehr antwortet, und überstehen ein kill -9."
---

Markieren Sie eine Verbindung als dauerhaft: Solange der Knoten am anderen Ende mithält, ist sie eine gewöhnliche Verbindung und schreibt nichts auf die Platte. In dem Moment, in dem dieser Knoten keine Nachrichten mehr annimmt, läuft die Verbindung in dieselbe SQLite-Datei über, bevor der Sender weitermacht, und eine Pumpe liefert sie, die älteste zuerst, aus, bis das Ziel jede annimmt, in Stapeln von bis zu 256 für ein Ziel, das in eine Datenbank in einem Rutsch schreibt (InfluxDB tut das), und einzeln bei allen anderen. Fällt also der Historian aus, stauen sich die Messwerte auf der Platte, statt den Flow zu blockieren oder verworfen zu werden, und gehen der Reihe nach hinein, wenn er zurückkommt. Der Preis dafür, dass im gesunden Zustand nichts geschrieben wird, ist, dass ein `kill -9` dann verliert, was im Speicher war, ungefähr einen Abfragezyklus, und wir sagen das lieber hier, als es Sie selbst herausfinden zu lassen.

```json
{ "id": "count", "type": "function", "ew_durable": ["influx"], "wires": [["influx", "reply"]] }
```

Sie müssen den Schlüssel nicht von Hand schreiben. Doppelklicken Sie im Editor auf die Verbindung und haken Sie *Durable* an.

Sie übersteht einen Neustart, behält die Reihenfolge, hält ein Plattenkontingent ein (standardmäßig 256 MiB, und die Überlaufrichtlinie des Knotens am anderen Ende entscheidet, was nachgibt, wenn es voll ist) und zeigt ihre Tiefe als `hotloop_flow_durable_wire_depth`. Sie liefert mindestens einmal, nicht genau einmal, und wir sagen das lieber hier, als es Sie in einer Nachbesprechung herausfinden zu lassen: Der genaue Wortlaut und wie `influxdb out` trotzdem korrekt bleibt, stehen in [docs/durable](/de/flow/durable-state/).

Der Beleg ist `docs/durable/store-and-forward.sh`: ein echter InfluxDB 2.9.1 in Podman unter zwanzig Messwerten pro Sekunde, zehn Minuten lang angehalten, wieder hochgebracht, wobei die Runtime einmal mitten im Ausfall und einmal mitten im Abarbeiten mit `kill -9` beendet wurde. 15,982 Messwerte angenommen, 15,982 Zeilen gespeichert, keine fehlt, keine doppelt. Eine gesunde dauerhafte Verbindung schreibt von sich aus nichts, und bei alle dreißig Sekunden geschriebenem Kontext schrieb der gesamte Prozess bei zwanzig Nachrichten pro Sekunde 1.7 MiB pro Stunde (0.04 GB pro Tag). Die Tabellen und die Befehle stehen in [docs/durable](/de/flow/durable-state/).

## Eine Nachricht, die das Ziel für immer ablehnt

Standardmäßig versucht eine Verbindung eine Nachricht, an der ihr Ziel scheitert, immer wieder, mit einer Pause, die bis auf fünf Sekunden wächst, und nichts hinter dieser Nachricht bewegt sich. Für einen ausgefallenen Historian ist das genau richtig. Für einen einzigen fehlerhaften Messwert, den der Historian nie annehmen wird, ist es eine für immer festgefahrene Verbindung, also gibt es einen Ausweg, und er ist aus, bis Sie ihn verlangen.

```json
{ "id": "count", "type": "function", "ew_durable": ["influx"], "ew_durable_attempts": { "influx": 20 }, "wires": [["influx", "reply"]] }
```

Geben Sie der Verbindung eine Anzahl Versuche, im Verbindungsdialog des Editors oder wie oben, und nachdem das Ziel eine Nachricht aus der Warteschlange so oft abgelehnt hat, meldet die Verbindung sie dem Flow als Fehler des Knotens, der sie abgelehnt hat, mit angehängter Nachricht, so wie jeder Knotenfehler sie trägt, und macht mit der nächsten weiter. Ein Catch-Knoten in diesem Flow bekommt sie und kann sie parken, darauf alarmieren oder sie irgendwohin schreiben. Ohne Catch erscheint der Fehler trotzdem in der Debug-Seitenleiste, und die Nachricht ist weg, also verdrahten Sie einen. Die erste Ablehnung im Speicher erreicht den Catch wie immer, sodass ein Catch dieselbe Nachricht zweimal sieht: einmal beim ersten Fehlschlag und einmal, als die Verbindung aufgab. Die Zählung gilt pro Nachricht und liegt im Speicher, ein Neustart beginnt sie also von vorn. `hotloop_flow_durable_wire_given_up_total` zählt sie, neben der Tiefe. Ein Limit, das keine ganze Zahl von 1 oder mehr ist, wird gemeldet, und die Verbindung versucht es weiter, denn es stillschweigend zu ignorieren, ließe eine Verbindung festhängen, der jemand gesagt hatte, sie solle aufhören.
