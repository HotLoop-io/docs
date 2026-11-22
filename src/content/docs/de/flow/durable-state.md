---
title: "Dauerhafter Zustand, gemessen"
description: "Kontext, der einen Neustart übersteht, und dauerhafte Verbindungen, die nur auf die Platte schreiben, wenn das Ziel nicht antwortet, mit den Messwerten."
---

Ein Historian, der eine Stunde ausfällt, sollte Sie keine Stunde Messwerte kosten, solange der Ausfall in das Plattenkontingent passt (standardmäßig 256 MiB: etwa eine Stunde bei 100 Messwerten pro Sekunde mit 120 Byte pro Messwert, gemessen auf 2.13.1), und ein Zähler in einem Flow sollte nicht von vorn anfangen, weil der Pod umgezogen ist. Beides ist eine SQLite-Datei auf dem Volume, und diese Seite beschreibt, was darin steht, was sie garantiert, was nicht und was sie eine Flash-Karte kostet.

Eine Datei, `state.db`, im Datenverzeichnis. Der persistente Kontext und die Warteschlangen hinter dauerhaften Verbindungen teilen sie sich, weil zwei Speicher zwei Dinge wären, die man dimensionieren, sichern und synchron halten müsste.

## Kontext, der einen Neustart übersteht

Flow-, globaler und Knotenkontext werden aus der Datei geladen, wenn ein Geltungsbereich zum ersten Mal benutzt wird, und leben danach im Speicher. Lesezugriffe berühren also nie die Platte, und `CompareAndSwap`, `Increment` und `Update` sind derselbe Code wie vorher, atomar unter derselben Sperre. Nach einem Neustart ist Ihr Zähler wieder da und läuft von dort weiter, und ein `CompareAndSwap` gegen einen Wert, der von der Platte zurückkam, funktioniert weiterhin, auch für die ganze Zahl, die ein Function-Knoten abgelegt hat.

Worauf Sie verzichten, ist Absicht: Schreibvorgänge hinken nach. Ein geänderter Wert wartet `store.context.flushInterval` (30 Sekunden), und alles, was sich in diesem Fenster geändert hat, geht in einer Transaktion in die Datei. Zehntausend Inkremente eines Zählers in einem Fenster sind eine geschriebene Zeile. Ein Wert, der auf das gesetzt wird, was er schon war, ist gar kein Schreibvorgang, und das ist der Flow, der jede Sekunde dieselbe Temperatur ablegt, und die SD-Karte, die das sonst übelnähme. Ein sauberes Beenden schreibt vorher alles. Ein `kill -9` oder ein Stromausfall verliert bis zu einem Intervall. Setzen Sie es auf `0s`, und jede Änderung wird geschrieben, bevor der Aufruf zurückkehrt, und die Karte zahlt dafür.

Nur was JSON übersteht, übersteht einen Neustart: Zahlen, Zeichenketten, Boolesche Werte, Zeitangaben, Byte-Puffer, Listen und Objekte. Legen Sie eine Funktion oder einen Socket im Kontext ab, schlägt das `set` fehl und nennt den Schlüssel, statt die Hälfte davon zu speichern. Der Kontext eines Knotens verschwindet, wenn der Knoten gelöscht wird, und der eines Flows, wenn der Tab gelöscht wird, beim Deploy, mit demselben Aufräumlauf wie in Node-RED.

## Dauerhafte Verbindungen

Markieren Sie eine Verbindung an dem Knoten als dauerhaft, von dem sie ausgeht. Der Schlüssel ist `ew_durable`, eine Liste der Knoten-IDs, zu denen diese Verbindung führt, und die Flow-Datei wird weiterhin Byte für Byte geladen und gespeichert, weil andere Werkzeuge ihn ignorieren:

```json
{
  "id": "count", "type": "function", "z": "line3", "x": 290, "y": 100,
  "ew_durable": ["influx"],
  "wires": [["influx", "reply"]]
}
```

Jede Verbindung von `count` zu `influx` ist jetzt dauerhaft. Die Verbindung zu `reply` bleibt eine gewöhnliche.

Was eine dauerhafte Verbindung tut:

- **Schreibt nichts, solange das Ziel mithält.** Nachrichten gehen aus dem Speicher direkt in den Eingang des Ziels, wie bei einer gewöhnlichen Verbindung, und die Zustandsdatenbank wird nicht berührt. Diese Regel haben wir gesetzt, nachdem ein Entwurf, der zuerst alles schrieb, auf einer Flash-Karte Hunderte Gigabyte am Tag gemessen hat, für einen Fehler, der ein paar Stunden im Jahr vorkommt.
- **Läuft auf die Platte über, wenn es nicht mithält.** Die Verbindung beginnt zu überlaufen, sobald der Handler des Ziels einen Fehler zurückgibt, sein Eingang voll ist oder es nicht läuft. Von da an wird jede Nachricht in die Datei geschrieben, bevor das `Send` des sendenden Knotens zurückkehrt. Sobald der Sender weitergemacht hat, kann ein `kill -9` sie also nicht mehr mitnehmen. Die Nachrichten, die schon zum Ziel unterwegs sind, werden hinter der fehlgeschlagenen in der Reihenfolge auf die Platte umgeleitet. Im Beispiel oben steht `reply` in der Verdrahtung an zweiter Stelle, solange die Verbindung überläuft, bedeutet ein HTTP 200 also, dass der Messwert auf der Platte liegt.
- **Leert sich der Reihe nach, in Stapeln, wo das Ziel sie nimmt.** Eine Pumpe reicht dem Ziel die ältesten Nachrichten von der Platte und wartet, bis sie angenommen sind. Nichts hinter einer Nachricht überholt sie. Ein Ziel, das in eine Datenbank schreibt, kann bis zu 256 Nachrichten als einen Schreibvorgang annehmen, und `influxdb out` tut das: Bei einem Historian, der einen Schreibvorgang in 8 ms beantwortet, leerte sich ein Rückstau einzeln mit etwa 110 Messwerten pro Sekunde, wovon ein Werk, das 100 pro Sekunde sendet, kaum etwas abbaute, und er leert sich mit der Geschwindigkeit, die die Schreibvorgänge erlauben, wenn jeder ein paar Hundert trägt. Jedes andere Ziel bekommt weiterhin eine Nachricht nach der anderen. Wird ein Stapel nicht angenommen, werden die Nachrichten vor der ersten fehlgeschlagenen als erledigt markiert, diese wird allein mit dem unten beschriebenen Wiederholen erneut versucht, und der Rest wird als Stapel erneut gesendet. Ist die Warteschlange leer, geht die Verbindung zurück in den Speicher und hört auf zu schreiben.
- **Wiederholt, was das Ziel ablehnt.** Dieselbe Nachricht geht nach 250 ms noch einmal, dann nach 500 ms, bis auf 5 Sekunden verdoppelt, so lange es dauert. Die Catch-Knoten des Flows erfahren vom ersten Fehler und nicht von jeder Wiederholung. Auf ein Ziel, das gestoppt ist, durch einen Deploy ersetzt wurde oder nicht starten konnte, wird gewartet, es wird nicht übersprungen.
- **Übersteht einen Neustart.** Was noch auf der Platte liegt, wenn der Prozess zurückkommt, wird zuerst zugestellt.
- **Hält ein Plattenkontingent ein.** `store.durable.maxBytes` (256 MiB) gilt für alle dauerhaften Verbindungen zusammen und zählt den Rumpf jeder Nachricht plus 64 Byte. Ist es voll, entscheidet der Knoten, zu dem die Verbindung führt, nach der Überlaufrichtlinie, die er schon hat: `block` wartet bis zu `blockTimeout` auf Platz und gibt dann einen Fehler aus, `drop-newest` weist die ankommende Nachricht ab, `drop-oldest` verdrängt die älteste Nachricht, die nicht gerade zugestellt wird, `error` löst einen Fehler an einem Catch-Knoten aus. Jeder Fall wird gezählt und als Verwerfungsereignis gemeldet. Eine Ausnahme: Eine Nachricht, die schon im Speicher angenommen wurde und die die Verbindung auf die Platte verlagern muss, kommt über das Kontingent hinaus hinein, weil ihre Ablehnung bedeuten würde, eine ältere zu verwerfen und neuere zu behalten. Die Überschreitung beträgt höchstens das, was das Ziel hält, sein Eingang plus die eine Nachricht, die seine Goroutine genommen und noch nicht begonnen hat, das Kontingent kann also einen Moment lang ein paar Nachrichten darüber anzeigen. Die Datei ist etwas größer als das Kontingent, um den Seiten-Overhead von SQLite und das Write-Ahead-Log, und ein Test füllt sie, leert sie und füllt sie sechsmal wieder, um zu beweisen, dass sie nicht weiter wächst.
- **Zeigt ihre Tiefe.** `hotloop_flow_durable_wire_depth{wire="..."}` ist die Zahl der wartenden Nachrichten, mit `_bytes`, `_delivered_total`, `_retries_total` und `_dropped_total` daneben, und `hotloop_flow_durable_bytes` gegen `hotloop_flow_durable_max_bytes` ist das Kontingent.
- **Startet den Knoten nicht neu.** Eine Verbindung in einem laufenden Flow als dauerhaft zu markieren ist eine Verdrahtungsänderung, wie das Verschieben einer Verbindung.

Eine Verbindung, die nicht mehr dauerhaft ist oder gelöscht wird, bekommt ihre Warteschlange geleert, als verworfen gezählt und gemeldet. Diese Nachrichten haben kein Ziel mehr, und sie zu behalten würde das Kontingent mit einer Warteschlange füllen, die niemand sieht.

### Was sie verspricht und was nicht

**Solange die Verbindung gesund ist, gibt es ein Verlustfenster.** Im Speicher liegen der Eingang des Ziels und der Aufruf, den es gerade macht, und ein `kill -9` oder ein Stromausfall nimmt sie mit. Das ist der Preis dafür, nichts zu schreiben, und wir haben ihn mit Absicht akzeptiert: Bei einem Eingang von 1024 und einem schnellen Ziel sind es die Nachrichten von etwa einer Abfrage. Sobald die Verbindung überläuft, also wenn das Ziel ausgefallen ist und die Daten gefährdet sind, gibt es kein Fenster. Der kill -9-Test unten wird aus diesem Grund mitten im Ausfall gemacht, mit der Warteschlange auf der Platte. Wir haben die Runtime nicht beendet, solange die Verbindung gesund war, um zu zählen, denn die Antwort lautet „ein paar sind weg“, und das ist der Entwurf.

**Die Zustellung ist mindestens einmal.** Das Ziel hat eine Nachricht genommen, wenn sein Handler ohne Fehler zurückkehrt, und die Verbindung markiert sie danach auf der Platte als erledigt. Ein `kill -9` zwischen beidem bedeutet, dass die Nachricht nach dem Neustart noch einmal geht. Wie viele, hängt von `store.durable.ackFlush` ab: Die Markierungen werden gemeinsam geschrieben, mit dem Standardwert `100ms` sind es also die in den letzten 100 ms fertig gewordenen Nachrichten, und mit `0s` wird jede Markierung geschrieben, bevor die nächste Nachricht gesendet wird, also höchstens die eine in Bearbeitung oder der Stapel in Bearbeitung, bis zu 256 Nachrichten, bei einem Ziel, das Stapel nimmt.

Das klingt nach einer Lücke, hier ist also, was sie für das Ziel schließt, für das dies gebaut wurde. Eine Nachricht, die eine dauerhafte Verbindung durchläuft, erhält den Stempel `msg._queuedAt` mit der Zeit, zu der sie in die Verbindung kam, und `influxdb out` ohne konfigurierten Zeitstempel schreibt den Punkt mit dieser Zeit. Eine Wiederholung ist dieselbe Serie zur selben Zeit, was InfluxDB als Überschreiben behandelt, die Zeilenzahl bleibt also gleich. Es behebt auch das andere, was bei Store-and-Forward schiefgeht: Ohne das wird jeder während eines Ausfalls gehaltene Messwert gestempelt, wenn InfluxDB zurückkommt, und eine Stunde Verlauf landet in einer Minute. Eine Senke, die bei Ankunft stempelt, etwa ein `now()` in einem Postgres-Insert, würde eine Wiederholung doppelt speichern und die wiedergegebene Stunde außerdem an die falsche Stelle setzen. Verwenden Sie `msg._queuedAt`.

**„Genommen“ ist nur so stark wie der Knoten.** `influxdb out` schreibt innerhalb des Handlers, genommen heißt also geschrieben. Ein Knoten, der die Arbeit an eine andere Goroutine übergibt und zurückkehrt, hat weniger versprochen, und die Verbindung kann nicht dauerhafter sein als das, womit sie verbunden ist.

**Manche Eigenschaften machen die Reise nicht mit.** Ein lebendiges Handle kann einen Neustart nicht überqueren und nachträglich nicht beantwortet werden, daher werden `msg.req` und `msg.res` (die des HTTP-In-Knotens) und alles, was sich nicht serialisieren lässt, aus Nachrichten auf einer dauerhaften Verbindung weggelassen, und beim ersten Mal auf einer Verbindung wird das mit dem Namen der Eigenschaft protokolliert. Die Nutzlast wird nie weggelassen: Lässt es sich nicht speichern, wird die Nachricht mit einem Fehler abgewiesen, der den Pfad nennt.

**Eine fehlerhafte Nachricht kann eine Verbindung aufhalten.** Ein Ziel, das dieselbe Nachricht immer wieder ablehnt, bekommt sie immer wieder, mit der Pause von 5 Sekunden zwischen den Versuchen, und die Nachrichten dahinter warten. Der Wiederholungszähler und die Tiefe zeigen es Ihnen. Das ist die richtige Entscheidung bei einem ausgefallenen Historian. Bei einer fehlerhaft aufgebauten Nachricht ist es die falsche, daher kann eine Verbindung ein Limit bekommen: `"ew_durable_attempts": {"influx": 20}` an dem Knoten, von dem sie ausgeht, oder den Verbindungsdialog im Editor. Hat das Ziel eine Nachricht so oft aus der Warteschlange abgelehnt, geht sie als Fehler des ablehnenden Knotens mit angehängter Nachricht an den Flow, ein Catch-Knoten kann sie beiseitelegen, und die Verbindung geht weiter. Ohne den Schlüssel ändert sich nichts. Eine Dead-Letter-Queue gibt es weiterhin nicht: Ein Catch-Knoten ist der Ort, sie zu bauen, und `hotloop_flow_durable_wire_given_up_total` zählt, was dorthin ging.

## Einstellungen

```yaml
store:
  path: ""              # empty is state.db in data.dir
  synchronous: normal   # normal | full
  context:
    persist: true
    flushInterval: 30s  # 0s writes every change at once
  durable:
    maxBytes: 268435456
    ackFlush: 100ms     # 0s marks each message before the next is sent
```

Umgebung: `HOTLOOP_FLOW_STORE_PATH`, `HOTLOOP_FLOW_STORE_SYNCHRONOUS`, `HOTLOOP_FLOW_CONTEXT_PERSIST`, `HOTLOOP_FLOW_CONTEXT_FLUSH_INTERVAL`, `HOTLOOP_FLOW_DURABLE_MAX_BYTES`, `HOTLOOP_FLOW_DURABLE_ACK_FLUSH`. Das Chart hat dieselben Namen unter `store:` in `values.yaml`.

`synchronous: normal` betreibt die Datei im Write-Ahead-Modus ohne fsync bei jedem Commit. Ein Commit übersteht das Beenden des Prozesses, das ist der `kill -9`-Test unten. Einen Stromausfall übersteht er nicht auf jedem Dateisystem. `full` tut es, und `full` ist das, was die Karte abnutzt.

## Der Nachweis

Gemessen mit einem echten InfluxDB 2.9.1 in Podman. Nichts ist simuliert.

Ein Producer schickt zwanzigmal pro Sekunde einen nummerierten Messwert an den Flow in flow.json. Der Flow zählt ihn im Flow-Kontext und schickt ihn über eine dauerhafte Verbindung an `influxdb out`. Der Messwert trägt keinen Zeitstempel, eine zweimal zugestellte Nachricht wären also zwei Zeilen. Ein kleiner Durchreicher zwischen Flow und InfluxDB protokolliert jeden Schreibvorgang, den InfluxDB akzeptiert hat, denn InfluxDB behandelt einen zur selben Zeit zweimal geschriebenen Punkt als einen Punkt, und Zeilen allein können eine Wiederholung nicht zeigen.

| Zeit | Was passierte |
|---|---|
| 00:13:53 | Flow gestartet, 20 Messwerte pro Sekunde. |
| 00:14:53 | `podman kill` auf InfluxDB. Es bleibt zehn Minuten tot. Die Verbindung läuft auf die Platte über. |
| 00:19:54 | Fünf Minuten später, Warteschlangentiefe 5,989 auf der Platte. `kill -9` auf die Runtime. |
| 00:19:59 | Runtime wieder gestartet, InfluxDB noch unten. Sie findet 5,992 Nachrichten auf der Platte und nimmt weiter neue an. |
| 00:24:59 | InfluxDB gestartet. Warteschlangentiefe 11,989. |
| 00:25:25 | Leerlauf läuft, Warteschlangentiefe 5,987. Wieder `kill -9` auf die Runtime, mitten in der Warteschlange. |
| 00:25:30 | Runtime wieder gestartet mit 5,948 auf der Platte. |
| 00:25:53 | Rückstau geleert. Noch neunzig Sekunden stetiger Eingang, dann eine Zählung. |

```
deliveries      15987 writes InfluxDB answered 204 to
delivered twice 5 [7829, 7830, 7831, 7832, 7833]
sent            16185
accepted (200)  15982
failed          203
rows stored     15982
distinct seqs   15982
missing         0 []
doubled         0 []
unacked stored  0 []
```

Jeder Messwert, den der Flow mit 200 beantwortet hat, ist in InfluxDB, einmal. **Keiner fehlt, keiner doppelt.** Die 203, die fehlschlugen, waren Anfragen, die ankamen, während die Runtime tot war, also der Producer, dem Nein gesagt wird, und keine davon wurde gespeichert.

Fünf Nachrichten wurden InfluxDB zweimal übergeben. Es sind die, die der zweite Kill zwischen der Annahme durch InfluxDB und dem Eintreffen der „erledigt“-Markierung auf der Platte erwischt hat, innerhalb des `ackFlush`-Fensters. Jede trug dasselbe `_queuedAt`, der zweite Schreibvorgang überschrieb also den ersten, und die Zeilenzahl bewegte sich nicht. So sieht [mindestens einmal](#was-sie-verspricht-und-was-nicht) aus, wenn es funktioniert. Es ist auch das, was eine Senke, die bei Ankunft stempelt, doppelt gespeichert hätte.

Was das nicht abdeckt: ein `kill -9`, während die Verbindung gesund ist. Die Messwerte im Speicher in diesem Moment sind weg, so gewollt, und wir haben sie nicht gezählt.

## Was auf die Platte geschrieben wird

`write_bytes` aus `/proc/<pid>/io` ist das, was der Kernel für den Prozess zum Speicher schicken sollte, abzüglich abgebrochener Schreibvorgänge. Das ist die Zahl, die eine Flash-Karte interessiert. Jede Zeile sind 300 Sekunden eines Szenarios, nach 30 Sekunden zum Einschwingen, mit disk-writes.sh. Der Flow ist der Nachweis-Flow mit InfluxDB dahinter, die Last ist also echt.

```bash
BIN=./hotloop-flow SECS=300 bash docs/durable/disk-writes.sh
```

| Szenario | Rate | Kontext-Flush | Geschrieben pro Stunde | Pro Tag |
|---|---|---|---|---|
| Leerlauf, eine dauerhafte Verbindung im Flow | keine | 5 s | 0 Byte | 0 |
| Gesunde dauerhafte Verbindung, stetige Last | 20 msg/s | 30 s | 1.7 MiB | 0.04 GB |
| Gesunde dauerhafte Verbindung, stetige Last | 50 msg/s | 30 s | 1.2 MiB | 0.03 GB |
| Dasselbe, Kontext alle 5 s geflusht | 20 msg/s | 5 s | 5.1 MiB | 0.12 GB |
| Dasselbe, Kontext alle 5 s geflusht | 50 msg/s | 5 s | 4.2 MiB | 0.10 GB |
| Nur Kontext, gewöhnliche Verbindung | 20 msg/s | 30 s | 1.2 MiB | 0.03 GB |
| Verbindung läuft über, InfluxDB unten | 20 msg/s | 5 s | 728 MiB | 17 GB |
| Verbindung läuft über, `synchronous: full` | 20 msg/s | 5 s | 1,011 MiB | 24 GB |

Lesen Sie es in drei Teilen.

**Leerlauf schreibt nichts.** Null Byte in fünf Minuten.

**Eine gesunde Verbindung schreibt nichts von sich aus.** Die gesunden Zeilen sind persistenter Kontext, ein Zähler, der bei jeder Nachricht hochgezählt wird, und sonst nichts. Die Zeile nur mit Kontext und gewöhnlicher Verbindung liegt im Rauschen dazu. Der Kontext-Flush stand bis zu dieser Tabelle auf fünf Sekunden: Bei zwanzig Nachrichten pro Sekunde waren das 5.1 MiB pro Stunde, 0.12 GB pro Tag, und dreißig Sekunden bringen es auf 1.7 MiB, deshalb ist der Standard dreißig. Ein kill -9 verliert dann bis zu dreißig Sekunden Kontext.

**Eine überlaufende Verbindung ist teuer, und nur solange sie überläuft.** Jede Nachricht ist ein eigener Commit, etwa 10 KB Schreibvorgänge je Nachricht, weil der Sender auf die Platte wartet. Zehn Minuten Ausfall bei zwanzig pro Sekunde sind etwa 120 MiB, ein ganztägiger Ausfall etwa 17 GB. Das ist der Preis für „auf der Platte, bevor der Sender weitermacht“, nur gezahlt, solange der Historian ausfällt. Group Commit teilt eine Transaktion zwischen gleichzeitigen Sendern, aber ein Sender macht einen Commit.

Noch eine Zahl, weil sie mich überrascht hat. Bei 100 Nachrichten pro Sekunde hielt dieser Aufbau die Verbindung nicht gesund: Das Ziel kam nicht mehr mit, die Verbindung lief über und blieb für den ganzen Lauf überlaufend, 3,548 MiB pro Stunde. Wir sind nicht der Frage nachgegangen, ob der Durchreicher oder InfluxDB der langsamere Teil war. Es ist der Entwurf, der wie geschrieben arbeitet, denn „zurückgestaut“ zählt als nicht mithalten, und es heißt, dass ein Ziel, das langsamer ist als sein Eingang, eine dauerhafte Verbindung auf die Platte bringt. Bei 50 Nachrichten pro Sekunde blieb sie gesund.

Der Entwurf davor schrieb jede Nachricht zuerst auf die Platte. Beim ersten Schema (4-KiB-Seiten, eine Tabelle und ein Index) maß das 632 MiB pro Stunde bei 20 Nachrichten pro Sekunde, selbst mit gesundem InfluxDB, und 1,163 MiB, wenn jede „erledigt“-Markierung sofort geschrieben wurde. Daher kommt „Platte nur während eines Ausfalls“.

### Auf Bare Metal

Diese Zahlen wurden auf einer x86-Maschine unter WSL2 gemessen, und der dauerhafte Speicher ist seitdem auf Bare Metal gelaufen (2026-11-17). Geschriebene Bytes sind eine Eigenschaft des Codes und der Seitengröße, die Werte oben gelten also weiter. Was eine Karte damit macht (Schreibverstärkung, Verschleiß), gilt nicht, und ebenso wenig Speicher, Startzeit und anhaltende Nachrichten pro Sekunde, deshalb bleiben diese Zahlen mit dem Ort beschriftet, an dem sie gemessen wurden.
