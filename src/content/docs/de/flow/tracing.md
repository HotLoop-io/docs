---
title: "Tracing und Replay"
description: "Klicken Sie auf eine Debug-Meldung und sehen Sie ihren Weg, spielen Sie sie im Entwurf ab, machen Sie einen Test daraus und senden Sie Spans an OpenTelemetry."
---

Ein Wert läuft um 2 Uhr nachts aus dem Ruder, und die Debug-Leiste nennt Ihnen den Wert. Sie sagt Ihnen nicht, welcher der neun durchlaufenen Knoten ihn verändert hat, wie lange der langsame ihn festhielt oder wie er beim Eingang aussah. Das finden Sie heraus, indem Sie Debug-Knoten über den Flow verstreuen, deployen, warten, bis es wieder passiert, und sie wieder entfernen.

Darum bekommt jede Nachricht, die in den Flow eintritt, einen Trace. Jede Debug-Meldung in der Leiste hat eine Schaltfläche **Trace**, und ein Klick bringt den Weg dieser Nachricht auf der Zeichenfläche zum Leuchten: die durchlaufenen Knoten, die genutzten Leitungen, und alles, was sie nie berührt hat, abgedunkelt. Jeder Knoten auf dem Weg zeigt, wie lange er die Nachricht hatte (`8.3 µs`, oder `8.3 µs ×3`, wenn er drei Teile davon verarbeitet hat), und das Trace-Panel daneben listet jeden Hop der Reihe nach auf, mit der Nachricht, wie dieser Knoten sie erhalten hat. Klicken Sie auf eine Zeile, und Sie sind am Knoten. Ein fehlgeschlagener Hop ist rot, mit dem Fehler darunter.

Er folgt der Nachricht, wohin sie tatsächlich geht:

- **Durch einen Split.** Aus einem Messwert werden drei, und alle drei stehen im Trace, jeder als eigener Hop an jedem Knoten nach dem Split.
- **Durch einen Join.** Der Hop nach einem Join hat alle Nachrichten als Eltern, die der Join für ihn aufgenommen hat, nicht nur die, die zufällig zuletzt ankam. Die drei Zweige, die ihn gespeist haben, leuchten alle.
- **Durch einen Subflow.** Die Knoten darin laufen als Kopien mit eigenen IDs, und die Hops werden unter diesen IDs festgehalten. Die Zeichenfläche bringt die Subflow-Instanz zum Leuchten, weil sie der Knoten auf dem Tab ist, den Sie ansehen.
- **In einen Catch.** Der Knoten, der fehlschlug, trägt den Fehler an seinem Hop, und der Catch, der ihn bekam, ist der nächste Hop, markiert als durch einen Fehler erreicht.

Der Trace reist mit der Nachricht, steckt aber nicht in ihr. Kein Flow kann ihn lesen oder mit `msg = {...}` zerstören, und er taucht nie in einem Debug-Knoten, einem Test oder einem Payload auf der Leitung auf.

## Er kann nicht wachsen

Das läuft auf der Linie, die es überwacht, also ist jede Richtung begrenzt, und die Grenzen stehen unter `trace:` in der [Konfiguration](/de/flow/configuration/):

| Grenze | Standard |
|---|---|
| Gespeicherte Traces, die neuesten | 256 |
| Hops, die ein Trace behält, damit eine Schleife sich nicht endlos aufschreiben kann | 512 |
| Größte Nachricht, von der ein Hop eine Kopie behält | 16 KiB |
| Alles zusammen, grob gezählt, das Älteste wird zuerst vergessen | 16 MiB |
| Neue Traces pro Sekunde | 1,000 |

Eine Nachricht über 16 KiB behält ihre Zeiten und wird als zu groß zur Anzeige markiert, und sie kann weder abgespielt noch zu einem Test gemacht werden. Ab 1,000 neuen Traces pro Sekunde bleiben die übrigen Nachrichten dieser Sekunde ohne Trace, weil ein Sensor, der hunderttausendmal pro Sekunde spricht, sonst für jede einzelne einen Trace bezahlen würde. Eine Nachricht, die übersprungen wurde oder deren Trace verdrängt wurde, als sie noch unterwegs war, bleibt für den Rest ihrer Reise ohne Trace; mittendrin einen neuen Trace zu beginnen, würde den Puffer nur mit den Enden von Reisen füllen, deren Anfänge fehlen. Alles wird auf `/metrics` gezählt, sodass Sie sehen, wann es passiert.

Der Dauertest: **eine Million Nachrichten durch fünf Knoten, 2026-10-18**, auf derselben Maschine wie [die Zahlen oben](/de/flow/overview/#die-zahlen). Heap nach erzwungener GC, gemessen alle hunderttausend Nachrichten:

| Tracing | Heap, an jedem Prüfpunkt | Nachrichten pro Sekunde |
|---|---|---|
| Tracing aus | **1.3 MiB** | 192,596 |
| Tracing jeder Nachricht (`perSecond: 0`) | **2.7 MiB** | 115,770 |
| Standardgrenzen | **4.0 MiB** | 195,199 |

Es ist an allen zehn Prüfpunkten dieselbe Zahl. Der Tracer hielt vom ersten bis zum letzten Prüfpunkt 808,448 Bytes in 256 Traces, vergaß unterwegs 999,744 der Million und kam nie in die Nähe seiner 16 MiB. Jede Nachricht zu tracen kostet: Es brachte diese Kette von 192k pro Sekunde auf 116k. Deshalb gibt es die Standardgrenze. Bei 1,000 Traces pro Sekunde geht der Aufwand im Rauschen unter, und darunter ist ein Trace etwa 3 KB groß. Wenn Sie trotzdem jede Nachricht wollen, setzen Sie `perSecond: 0` und lesen Sie die erste Zeile dieser Tabelle, bevor Sie sich entscheiden. Reproduzieren Sie es mit:

Wenn der Heap nicht mehr flach bleibt, schlägt der Test fehl.

## In einen Entwurf abspielen

Sie haben den falschen Wert gefunden, glauben die Lösung zu kennen und haben einen Knoten auf der Zeichenfläche geändert. Deployen Sie nicht, um es herauszufinden. **Replay into draft** nimmt die Nachricht, die den Trace gestartet hat, speist sie in den Flow ein, so wie er jetzt auf Ihrer Zeichenfläche steht, deployt oder nicht, und sagt Ihnen, wo sie landet, verglichen mit dem, wo sie beim ersten Mal gelandet ist.

„Landet“ meint die Stellen, an denen die Nachricht endete: ein Debug-Knoten, ein MQTT Out, ein Switch ohne Treffer, ein Join, der noch wartet. Für jede Stelle sagt der Vergleich, dass sie gleich ist, oder welche Eigenschaften sich geändert haben (`payload: "HIGH" -> "CRITICAL"`), oder dass das Original dort endete und das Replay nicht, oder umgekehrt. Der Weg des Replays selbst leuchtet auf der Zeichenfläche, sodass Sie sehen, wohin der Entwurf sie geschickt hat. **Back to the original trace** stellt den ersten wieder her.

Es läuft so, wie ein [Flow-Test](/de/flow/tests/) läuft, in einem Kindprozess mit der echten Runtime und den echten Knoten, und aus demselben Grund: Ihr Entwurf startet jeden seiner Knoten, und nichts darin kann die Anlage berühren. Das heißt, ein Knoten, der einen Webdienst aufgerufen hätte, antwortet mit nichts, sodass ein Flow, dessen Ausgabe von einer Antwort abhängt, als Unterschied erscheint. Das ist das ehrliche Ergebnis. Er wird nicht so tun, als hätte er mit einer SPS gesprochen, mit der er nie gesprochen hat.

## Ein Trace wird zum Test

**Make test** im Trace-Panel entwirft aus dem ganzen Trace einen [Flow-Test](/de/flow/tests/#tests-aus-dem-editor): die Nachricht, die ihn gestartet hat, eingespeist an der Quelle, über die sie hereinkam, und jede Stelle, an der sie endete und die ein Test beobachten kann, mit dem, was dieser Knoten erhalten hat, als Erwartung dort. Es sind dieselben zwei Klicks wie bei einem Test aus einer Debug-Meldung, und für die kniffligen Flows ist es besser, weil ein Trace jedes Ende kennt, das eine Nachricht erreicht hat. Ein Split auf drei Debug-Knoten sind drei Erwartungen, wo eine Debug-Meldung eine war.

Er sagt, warum, wenn es nicht geht. Ein Trace, der in einem Subflow begann, vom zweiten Ausgang einer Quelle oder von einer zu großen Nachricht, lässt sich nicht so zurückspeisen, wie ein Test es braucht. Und eine Nachricht, die ein Switch verworfen hat, endet nirgends, wo ein Test hinsehen kann, deshalb wird sie abgelehnt, statt als Test ohne Inhalt geschrieben zu werden, denn ein Test ohne etwas zu prüfen besteht.

## OpenTelemetry

Richten Sie ihn auf einen Collector, und jeder Hop geht als Span hinaus:

```yaml
trace:
  otlp:
    endpoint: http://collector:4318   # OTLP over HTTP; /v1/traces is added
    headers: {x-api-key: ...}         # if the collector wants one
    serviceName: hotloop-flow
```

Ein Trace ist ein OpenTelemetry-Trace und ein Hop ist ein Span, mit dem Hop, der die Nachricht gesendet hat, als Parent. Der Span eines Join hat den ersten als Parent und die übrigen als Links. Jeder Span trägt die Knoten-ID, den Knotentyp, die Nachrichten-ID, wie viele Nachrichten der Knoten weitergeschickt hat und den Ausgangsport, über den er erreicht wurde, und ein Fehler ist ein Span mit Fehlerstatus. **Die Nachrichten verlassen nie das Haus.** Ein Payload sind die Daten einer Anlage und ein Collector ist der Server von jemand anderem, also geht nur die Form der Reise und ihr Timing hinaus.

Er spricht OTLP/HTTP mit der in der Spezifikation definierten JSON-Kodierung, von Hand in einer Datei geschrieben, statt das OpenTelemetry-SDK mit seinem Protobuf und gRPC einzubinden, um denselben einen POST zu machen. Die Binärdatei hat ein Größenbudget, und das geben wir dafür nicht aus. Jede Span-ID, jeder Parent, Link, Name, jedes Attribut und jeder Fehlerstatus muss übereinstimmen. In diesem Test gibt es nirgends ein Mock. Wenn der Collector ausfällt, verwirft der Export Spans und zählt sie, und der Flow merkt nichts davon; dass `hotloop_flow_otlp_spans_failed_total` über null steigt, ist Ihr Hinweis.
