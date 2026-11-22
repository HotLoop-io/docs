---
title: "Gegendruck, sichtbar gemacht"
description: "Eine Obergrenze für jede Warteschlange, eine Regel für den Fall an der Grenze und ein Diagramm jeder Nachricht, die nicht mehr passte, vor dem OOM-Kill."
---

Das ist das ganze Projekt. Der typische Fehler einer Flow-Engine auf einer Edge-Box ist ein Pod, der still anschwillt, bis der Kubelet ihn beendet, und das Protokoll, das er hinterlässt, erklärt demjenigen mit dem Pager in der Hand nichts. Deshalb hat jede Stelle, an der sich eine Nachricht oder ein Byte aufstauen kann, eine Obergrenze, und jede Obergrenze ist eine aufgeschriebene, dokumentierte Entscheidung in der [Node-RED-Kompatibilität](/de/flow/compatibility/), kein Limit, das wir gesetzt und nie erwähnt haben.

| Was sich aufstauen kann | Was es stoppt |
|---|---|
| Der Eingang eines Knotens | Eine Obergrenze (standardmäßig 1024) und eine von vier Überlaufrichtlinien |
| Verzögerungs- und Ratenbegrenzungswarteschlangen | Eine Obergrenze; darüber wird an einen Catch-Knoten abgewiesen |
| Trigger-Timer | Eine Obergrenze |
| Ausgabe von `exec` | Pro Stream begrenzt; Abschneiden löst einen Fehler aus |
| `exec`-Prozesse | Ein Nebenläufigkeitslimit; darüber wird abgewiesen |
| Dateilesevorgänge | Begrenzt, mit zeilenweisem und blockweisem Modus |
| HTTP-Anfragekörper | Begrenzt |
| Warten auf eine HTTP-Antwort | Ein 504 nach einem Timeout |
| TCP-Verbindungen und Frames | Beschränkt |
| WebSocket-Sendewarteschlangen | Beschränkt; ein langsamer Client wird getrennt |

Die Überlaufrichtlinien, global festgelegt und je Knoten überschreibbar:

| Richtlinie | Was passiert |
|---|---|
| `block` | Der Sender wartet auf Platz, bis zu `blockTimeout`. Der Gegendruck wandert stromaufwärts, was fast immer die richtige Antwort ist. |
| `drop-newest` | Die eintreffende Nachricht wird verworfen. Gezählt und gemeldet. |
| `drop-oldest` | Der Kopf der Warteschlange fliegt raus, um Platz zu schaffen. Gezählt und gemeldet. Für "nur der letzte Messwert zählt". |
| `error` | Das Senden wird abgelehnt und an einen Catch-Knoten gemeldet, damit der Flow entscheidet. |

Nichts wird still weggeworfen. Jedes Verwerfen wird gezählt, als Ereignis an den Editor gesendet und als Metrik exportiert, auf die Sie Alarme setzen können. Wenn ein Limit greift, erfahren Sie es aus einem Diagramm, nicht von einem Bediener.

## Eine Goroutine pro Knoten

Jede Knoteninstanz hat ihre eigene Goroutine und ihren eigenen Eingang. Innerhalb eines Knotens geordnet, zwischen Knoten parallel. Ein Function-Knoten, der echte Arbeit leistet, belegt einen Kern, während der Editor, die API, der Websocket und jeder andere Flow weiterlaufen.

## Jeder Empfänger bekommt seine eigene Kopie

Wenn sich eine Verbindung verzweigt, bekommt jeder Knoten am anderen Ende seine eigene Kopie der Nachricht, sodass zwei Zweige, die beide glauben, sie gehöre ihnen, einander nicht beschädigen können, und ein Zweig sich nie anders verhält als seine gleich aussehenden Geschwister, nur wegen der Reihenfolge, in der Sie sie verdrahtet haben. Das ist ein Fehler, der dienstags auftritt, und den gibt es hier nicht.

Es ist nicht umsonst. Eine kleine Nachricht (ein Messwert und ein Topic) zu kopieren kostet 411 bis 453 ns und 680 Bytes, und eine Kette aus fünf Knoten bewegt alle 1,14 bis 1,40 µs eine Nachricht, Kopien eingerechnet. Wehtun tut das Kopieren bei einer großen binären Nutzlast: Ein 1-MiB-Puffer kostet 128 bis 156 µs und ein weiteres Megabyte auf dem Heap für jeden Empfänger. Deshalb reisen große binäre Nutzlasten als `ImmutableBytes`, das den Puffer teilt, statt ihn zu kopieren: **250 bis 279 ns und 360 Bytes für dieselbe 1-MiB-Nachricht.** Die Datei- und HTTP-Knoten geben binäre Nutzlasten bereits so aus, Sie bekommen es also, ohne darum zu bitten.

## Kontext, der zählen kann

Flow- und globaler Kontext haben `get` und `set`, und außerdem `CompareAndSwap`, `Increment` und `Update`. Zwei Zweige, die auf einem Zähler Get-Modify-Set ausführen, konkurrieren und verlieren Aktualisierungen, und mit Get und Set allein lässt sich dagegen nichts tun. Mit `Increment` gibt es nichts, worum man konkurrieren müsste.

Und er übersteht einen Neustart. Flow-, globaler und Knotenkontext liegen in einer SQLite-Datei auf dem Volume, werden beim ersten Gebrauch eines Bereichs geladen und verzögert geschrieben, sodass ein Zähler oder eine Sperre in einem Flow dort steht, wo Sie sie verlassen haben, wenn der Pod zurückkommt. Die atomaren Operationen sind derselbe Code wie vorher. Änderungen werden alle dreißig Sekunden zu einem Schreibvorgang gebündelt, und ein Wert, der auf den bereits vorhandenen gesetzt wird, schreibt nichts, denn uns ist wichtiger, was das mit einer SD-Karte macht, als clever zu sein. Ein sauberes Beenden schreibt alles; ein `kill -9` verliert bis zu diesen dreißig Sekunden, und `store.context.flushInterval` ist der Regler. Details und was es eine Karte kostet, stehen unter [docs/durable](/de/flow/durable-state/).
