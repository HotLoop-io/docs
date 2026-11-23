---
title: "Edge Publish und Store-and-Forward"
description: "Alles, was ein Gerät liest, als Sparkplug-B-Edge-Knoten an ein zentrales Gateway veröffentlichen, bei Abbruch puffern und der Reihe nach nachliefern."
---

Edge Publish macht HotLoop seit 4.5.0 zu einem Sparkplug-B-**Edge-Knoten**, der alles, was er liest, per MQTT an ein zentrales Gateway veröffentlicht, in die entgegengesetzte Richtung wie der bestehende MQTT-Treiber, der Sparkplug als primärer Host verbraucht. Das bedeutet es, ihn zu betreiben.

Eingeschaltet läuft er im selben Gateway-Prozess und bleibt mit TimescaleDB verbunden. Das ist nützlich, wenn ein Standort die Oberfläche und die Historie des vollständigen Gateways lokal haben will und zusätzlich eine Uplink-Verbindung zu einem zentralen. Die Flottenverwaltung für viele Edge Relays kam mit 4.7.0 (Verfolgung anhand ihrer Births und Deaths) und 4.8.0 (Konfigurations-Push); siehe die Seite zur Flottenverwaltung.

## Einschalten

```sh
export HOTLOOP_EDGE_PUBLISH_ENABLED=true
export HOTLOOP_EDGE_PUBLISH_BROKER=mqtt.example.local:1883
export HOTLOOP_EDGE_PUBLISH_GROUP=Plant1
export HOTLOOP_EDGE_PUBLISH_NODE=press-line-3   # defaults to the pod hostname
export HOTLOOP_EDGE_PUBLISH_QUEUE_PATH=/data/forward.db
```

Jeder Messwert, der den Tag-Bus erreicht (derselbe Strom, den die Live-Oberfläche und der Alarmauswerter lesen), wird als Sparkplug-B-`NDATA` veröffentlicht. Solange der Broker erreichbar ist und bestätigt, geschieht das direkt aus dem Arbeitsspeicher, und die Platte wird nicht berührt. Wenn der Broker aufhört zu bestätigen, gehen die Messwerte in die Weiterleitungswarteschlange auf der Platte und kommen daraus, in Reihenfolge, wieder heraus, sobald er zurück ist.

## Was er tatsächlich tut

**Abonniert, bevor er geboren wird.** Bei jeder Verbindung, der ersten und jeder Wiederverbindung, abonniert der Knoten sein `NCMD`-Topic (und sein Konfigurations-Push-Topic) und wartet, bis der Broker beides bestätigt hat, bevor er irgendetwas veröffentlicht. Sparkplug B 3.0 verlangt das ("Vor dem Senden einer NBIRTH-Nachricht muss der dem Edge-Knoten zugeordnete MQTT-Client NCMD-Nachrichten abonnieren"), und das aus gutem Grund: Ein Host darf auf ein Birth mit einer sofortigen Rebirth- oder Neustartanforderung antworten, und ein Knoten, der zuerst sein Birth sendet, kann sie verpassen. `Start()` kehrt erst zurück, wenn die Abonnements stehen. Lehnt der Broker eines ab (eine ACL, die diesem Knoten nicht erlaubt, sein eigenes `NCMD`-Topic zu lesen), scheitert `Start()` mit einem Fehler, der das sagt; ein Knoten, den niemand steuern kann, sollte nicht hochkommen und so tun, als wäre es anders. Eine Wiederverbindung, die nicht erneut abonnieren kann, sendet in dieser Sitzung kein Birth; die Messwerte gehen weiter in die Weiterleitungswarteschlange.

**Ein Broker, der nicht da ist, stoppt den Start nicht.** Abgelehnt ist ein Konfigurationsproblem und lässt `Start()` scheitern. Nicht erreichbar ist ein Ausfall: `Start()` protokolliert ihn und kehrt zurück, und der Knoten versucht es im Hintergrund weiter (eine Sekunde, verdoppelt bis zu einer Minute), während jeder Messwert in die Weiterleitungswarteschlange geht. Früher scheiterte er auch hier, und das Gateway und der Edge beenden sich, wenn Edge Publish nicht startet, sodass ein während eines WAN-Ausfalls neu gestartetes Gerät in einer Absturzschleife hing, ohne Bildschirme, Alarme, Automatisierungen und ohne irgendetwas gepuffert, bis das WAN zurückkam.

**Ein NBIRTH pro Verbindung.** Jeder bekannte Tag, mit Namen und stabilem Alias angekündigt, und sein aktueller Wert. Ein Birth erfolgt bei der ersten Verbindung, bei jeder Wiederverbindung (eine Sparkplug-Sitzung beginnt von vorn, ihre Sequenznummerierung hat über eine Wiederverbindung hinweg keine Bedeutung), wenn ein Tag, den niemand zuvor gesehen hat, in einem Stapel auftaucht, und auf Anforderung, siehe unten.

**NDATA für alles danach**, nur per Alias, ohne Namen. `seq` beginnt mit dem Birth bei 0 und steigt (mod 256) mit jeder Nachricht bis zum nächsten.

**NDEATH** auf zwei Wegen: geordnet bei `Stop()` und über das Last-Will der MQTT-Verbindung selbst, wenn der Prozess stirbt, ohne die Gelegenheit zu haben. Beide tragen denselben `bdSeq`-Wert, passend zum Birth, das sie beenden. Ein Host unterscheidet ein altes Todeszertifikat, das von einer früheren Sitzung übrig ist, anhand dieser Nummer vom aktuellen.

**`bdSeq` zählt Sitzungen, und die Zählung übersteht einen Neustart.** Jedes MQTT-CONNECT erhält die nächste Nummer: 0 bei der ersten Sitzung einer Warteschlange, jedes Mal eine mehr, nach 255 wieder 0 (Sparkplug B 3.0, Operational Behavior, Edge Node Session Establishment: `tck-id-message-flow-edge-node-birth-publish-will-message-payload-bdSeq`), und das NBIRTH dieser Verbindung trägt dieselbe Nummer wie das Will, das sie registriert hat (`tck-id-message-flow-edge-node-birth-publish-nbirth-payload-bdSeq`). Sie liegt in der Datei der Weiterleitungswarteschlange, sodass ein neu gestarteter Knoten weiterzählt, statt wieder bei 1 anzufangen und dem Host ein Will zu liefern, das er schon gesehen hat und das ein Host als veraltet ignorieren darf. Eine Wiederverbindung ist eine neue Sitzung und bekommt daher auch eine neue Nummer; der alte Code behielt eine für die Lebensdauer des Prozesses, weil die MQTT-Client-Bibliothek das Will wiederverwendet, mit dem sie erstellt wurde, und der Knoten baut jetzt für jeden Verbindungsversuch einen neuen Client und damit ein neues Will. Die Metrik ist INT64, wie es die Spezifikation verlangt (sie ging früher als UInt64 hinaus; der Wert liegt im selben Feld, ein Host, der ihn nach Wert liest, merkt es nicht).

**`NCMD` → `Node Control/Rebirth`.** Ein Host, der ein Rebirth anfordert, erhält ein frisches NBIRTH mit demselben `bdSeq`. Ein Rebirth ist keine neue Sitzung und bekommt deshalb keine neue Nummer (`tck-id-operational-behavior-data-commands-rebirth-action-3`).

## Wenn die Uplink-Verbindung unterbrochen ist

**Die Platte ist für Ausfälle da, nicht für jede Abfrage.** Solange der Uplink steht und der Broker bestätigt, liegen Messwerte nur im Arbeitsspeicher, bis der Entleerer sie gesendet und der Broker sie bestätigt hat, und es wird nichts auf die Platte geschrieben. In dem Moment, in dem es keine Sitzung gibt, eine Bestätigung ausbleibt oder der Speicher über 100.000 Messwerte hinausginge, geht alles im Speicher der Reihe nach in die Plattenwarteschlange, alles danach reiht sich dahinter ein, und der Entleerer liest von der Platte, den ältesten zuerst, und nimmt einen Messwert erst heraus, wenn der Broker ihn bestätigt hat. Der Knoten kehrt nur zum Speicher zurück, wenn die Platte leer ist, sodass es nie einen Moment gibt, in dem neuere Messwerte ältere überholen.

Wir haben das zweimal gebaut, und die erste Version war für die Hardware falsch. Sie schrieb jeden Messwert vor dem Senden auf die Platte, sodass ein harter Abbruch nichts verlor, was der Knoten angenommen hatte. Sie schrieb aber auch etwa 5 MB pro Sekunde bei 2.000 Messwerten pro Sekunde, das sind 450 GB pro Tag, aus etwa 160 Warteschlangen-Commits pro Sekunde mit je acht Seiten. Das tötet eine SD-Karte und ist für jeden Flash-Speicher ein unsinniger Verschleiß. Die Plattenkosten im stationären Betrieb sind jetzt null (die Zahlen stehen unten), und was wir dafür aufgegeben haben, steht im nächsten Abschnitt offen.

**Ein harter Abbruch bei stehendem Uplink verliert, was im Speicher war.** Ein SIGKILL, ein Stromausfall oder ein Kernel-Panic nimmt, solange die Verbindung steht und der Broker bestätigt, die Messwerte mit, die noch nicht bestätigt waren. Das ist etwa eine Abfrage: bei 2.000 Messwerten pro Sekunde und einer Bestätigungs-Hin-und-Rück-Zeit von wenigen Millisekunden höchstens ein paar hundert Messwerte, und genauso viele Abfragen, wie der Host einen Moment später gesehen hätte. Sie werden nicht als verworfen gezählt, weil nichts weiß, dass es sie gab. Ein geordnetes Anhalten (`Stop`, ein SIGTERM, ein Neustart) schreibt zuerst den Speicherinhalt auf die Platte und verliert nichts. Eine unterbrochene Verbindung verliert in beiden Fällen nichts, weil der Knoten als Erstes den Speicher auf die Platte verschiebt, sobald die Verbindung nicht mehr bestätigt. Der eine Fall, den dieser Entwurf nicht abdeckt, ist der Tod des Prozesses bei stehender Verbindung, und er ist absichtlich nicht abgedeckt.

`HOTLOOP_EDGE_PUBLISH_QUEUE_MAX_BYTES` begrenzt die Ausfallwarteschlange, und der Standard ist 64 MiB, etwa zwei Minuten Ausfall bei 2.000 Messwerten pro Sekunde (der Prüfstand unten fährt sie dort: etwa 248.000 Messwerte passen hinein, gemessen mit 4.21.1). Darüber hinaus gehen die ältesten Messwerte zuerst und werden gezählt. Setzen Sie ihn auf 0, und die Warteschlange ist unbegrenzt: Der Prozess warnt beim Start davor, weil ein sehr langer Ausfall bei einer unbegrenzten Warteschlange das Volume füllt, statt alte Messwerte zu verwerfen, wie es die speicherinterne Warteschlange des Historians schon tut.

Ein Messwert, den der Entleerer innerhalb weniger Sekunden nach dem Einreihen herausholt, geht als aktueller Wert des Tags hinaus, in einem `NDATA` mit dem Rest seiner Abfrage. Einer, der länger gewartet hat oder den ein gestorbener Prozess zurückgelassen hat, geht mit `is_historical` markiert hinaus, damit ein Host ihn nicht überschreiben lässt, was der Tag gerade tut. Bei der Wiederverbindung wird die Warteschlange **vor** allem Neueren geleert, den ältesten zuerst, weil es nur einen Weg heraus gibt.

Eine Wiedergabe ist gepackt: bis zu 200 historische Messwerte teilen sich ein `NDATA`, jede Metrik trägt ihren eigenen Zeitstempel und `is_historical`. Die Spezifikation erlaubt das ("Mehrere Wertänderungen derselben Metrik KÖNNEN in derselben Sparkplug-NDATA-Nachricht enthalten sein ... solange sie unterschiedliche Zeitstempel haben", Sparkplug B 3.0, Operational Behavior, Data Publish), sodass eine Nachricht nie einen Tag zweimal in derselben Millisekunde enthält und die nächste beginnt. Wir haben sie gepackt, weil ein Messwert pro Nachricht der Engpass war, und die Profilerstellung bestätigte das: 57 % der CPU der Wiedergabe waren der write-Systemaufruf, den die MQTT-Client-Bibliothek einmal pro Paket macht, und 200.000 eingereihte Messwerte brauchten 58,5 Sekunden, 3.418 pro Sekunde, bei einer Anlage, die 2.000 pro Sekunde erzeugt. Eine Wiedergabe, die langsamer ist als die Anlage, ist ein Rückstau, der nie endet. Gepackt brauchen dieselben 200.000 Messwerte 2,9 Sekunden, 68.237 pro Sekunde, gemessen, als der Knoten noch auf QoS 1 war. Live-Messwerte gehen weiterhin eine Abfrage pro `NDATA` hinaus.

**QoS 0, wie es die Spezifikation sagt, und ein Hin und Zurück, um zu wissen, dass es angekommen ist.** NBIRTH und NDATA gehen mit QoS 0 und ohne Retained hinaus (`tck-id-topics-nbirth-mqtt`, `tck-id-topics-ndata-mqtt`, Sparkplug B 3.0, Topics and Messages, Edge Node). Das NDEATH-Will ist QoS 1 und ohne Retained (`tck-id-payloads-ndeath-will-message-qos`, Payloads), ebenso das geordnete NDEATH, das `Stop` veröffentlicht. Der Haken bei QoS 0 ist, dass es keine Quittung gibt: Eine Veröffentlichung "ist abgeschlossen", wenn die Bytes den lokalen Socket erreichen, und das funktioniert auch in eine tote Verbindung hinein bestens, sodass es als Zustellung zu behandeln Messwerte genau dann von der Platte nehmen würde, wenn sie zählen. Stattdessen sendet der Knoten hinter jedem Block eine Anfrage (ein SUBSCRIBE auf sein eigenes NCMD-Topic, das er ohnehin dürfen muss) und behält den Block, bis der Broker sie beantwortet. Eine Verbindung ist ein geordneter Bytestrom, und ein Broker verarbeitet die Pakete eines Clients in der Reihenfolge, in der er sie liest, die Antwort bedeutet also, dass er alles davor gelesen hat. Das ist die Zusicherung, die ein PUBACK gab, ein Hin und Zurück pro Block statt einer Quittung pro Nachricht. Ein Test schreibt in eine stumme Verbindung und prüft, dass nichts die Warteschlange verlässt, weder aus dem Speicher noch von der Platte; ohne das Hin und Zurück gingen alle 30 darin enthaltenen Messwerte hinaus.

**Eine Verbindung, die nicht mehr antwortet, wird aufgegeben, nicht ausgesessen.** Bestätigt der Broker einen Block nicht oder kann die MQTT-Client-Bibliothek eine Nachricht nicht annehmen, schließt der Knoten diese Verbindung selbst und startet eine neue Sitzung (nächster `bdSeq`, neues Birth) mit allem Unbestätigten behalten (auf die Platte verschoben, wenn es im Speicher war). Er muss das tun, denn eine Verbindung, die ohne Reset stirbt, nimmt Schreibvorgänge an, bis der Sendepuffer des Kernels voll ist, und dann hängt die einzige Schreib-Goroutine der MQTT-Client-Bibliothek in einem write. Das ist auch die Goroutine, die den Keepalive-PING sendet, sodass der Keepalive nie auslöst und der Knoten so lange in der toten Verbindung sitzt, wie der Ausfall dauert: Ein sechsminütiger Testabbruch ergab, dass er es nicht bemerkt hatte, bis die Verbindung zurückkam. Schlimmer noch: Der Durchlauf, der gerade schrieb, wachte auf der neuen Verbindung auf und sendete den Rest seines alten Blocks vor dem NBIRTH der neuen Sitzung weiter, mit den Sequenznummern der alten Sitzung. Jetzt gehört jeder Durchlauf zu der Sitzung, in der er begann, und bekommt einen Fehler statt der Leitung, sobald diese Sitzung beendet ist.

Die Zustellung ist **mindestens einmal**. Ein Block, den der Broker genommen, aber nie bestätigt hat, wird erneut gesendet, als Historie, und ein Abbruch zwischen Zustellung und Vermerk durch den Knoten bewirkt dasselbe. Ein Host, der das verarbeitet, muss ein Duplikat vertragen; er darf nie annehmen, dass diese Warteschlange schon für ihn dedupliziert hat.

### Was er verspricht, und die Zahlen dahinter

- **Exakte Reihenfolge.** Jeder Messwert jedes Tags erreicht den Host in der Reihenfolge, in der er gelesen wurde, live und wiedergegeben zusammen, über einen SIGKILL und einen Neustart hinweg.
- **Eine begrenzte Datei.** Die Grenze gilt für die Datei der Warteschlange, also das, was das Volume füllt, nicht für die Daten darin. Die Datei der Warteschlange besteht aus den Daten plus Seitenköpfen, Verzweigungsseiten, einer Freiliste und Wachstumsreserve; mit der alten Grenze (die eigene Zählung der Warteschlange von Blattbytes) kam die Datei auf das Doppelte der Daten. Alles unter 1 MiB läuft mit 1 MiB, mit einer Warnung beim Start.
- **Bei einem Ausfall geht nichts verloren.** Sobald die Verbindung nicht mehr bestätigt, liegt jeder Messwert auf der Platte und bleibt dort, bis der Broker ihn bestätigt hat, sodass jeder Messwert durch einen Ausfall, eine tote Verbindung, ein geordnetes Anhalten und einen SIGKILL oder Stromausfall mitten im Ausfall wieder herauskommt. Die Ausnahme ist die oben genannte: Ein harter Abbruch oder Stromausfall bei stehender Verbindung verliert etwa eine Abfrage, die Messwerte, die noch im Speicher waren.
- **Laute, gezählte Verluste über der Grenze.** Die ältesten Messwerte gehen zuerst, und jeder geht in einen Verlustzähler, der in der Warteschlangendatei lebt, sodass ein Neustart den Beleg nicht löscht. Er steht in `GET /api/diagnostics` unter `edgePublish` (und im `/status` des Relays unter `uplink`), neben dem, was in der Warteschlange liegt, der Dateigröße und ob eine Wiedergabe läuft. Das Protokoll meldet es einmal pro Minute, solange es geschieht, nie einmal pro Abfrage. Die Zählung kann dem Verlust etwas vorauslaufen und nie hinterherhinken: Messwerte, die der Host kurz vor einem Abbruch bekam und deren Bestätigung nie kam, liegen noch auf der Platte, wenn die Grenze sie nimmt, und werden gezählt, obwohl der Host sie hat.
- **Ein Messwert, der nur abgefragt wurde, kann bei einem harten Abbruch mit stehender Verbindung verloren gehen.** Zwischen dem Moment, in dem der Treiber einen Messwert übergibt, und der Bestätigung des Brokers existiert er nur im Prozess, und ein SIGKILL oder Stromausfall nimmt ihn mit. Das ist der Preis dafür, nicht jede Abfrage auf die Platte zu schreiben, und wir haben ihn gegenüber 450 GB pro Tag gewählt. Beenden Sie den Prozess, wenn nichts unterwegs ist, und die Antwort ist exakt: Jeder Messwert, den die Anlage geliefert hat, wurde zugestellt oder gezählt.

All das ist gemessen mit einem echten HotLoop Edge, der 20 HTTP-Geräte mit je 25 Tags alle 250 ms abfragt (2000 Messwerte pro Sekunde) und an einen echten Mosquitto veröffentlicht. Jedes Gerät antwortet auf jede Abfrage mit einem Zähler, der um eins höher ist als der letzte, sodass ein hostseitiger Prüfer genau weiß, welcher Messwert fehlte, welcher doppelt zurückkam und welcher außer der Reihe kam. Der Uplink wird unterbrochen, indem man den Broker vom Netz trennt: Der Socket des Edge wird stumm, ohne Reset, ohne Auflegen. Um mit nichts unterwegs abzubrechen, pausiert die Anlage vor dem SIGKILL einige Sekunden ("quiesced"); die anderen Abbrüche fallen, wohin die Abfrage gerade gerät ("instant"). Die Läufe vom 2026-10-12, mit einer Grenze von 64 MiB. "Before" ist `15419f1`, der Build vor dieser Arbeit. "Write-ahead" ist `165411f`, der jeden Messwert zuerst auf die Platte schrieb und den wir wieder herausgenommen haben. "Now" ist der Speicher, solange die Verbindung steht, und die Platte während eines Ausfalls:

| <span class="sr-only">Details</span> | Vorher | Write-ahead | Jetzt |
|---|---|---|---|
| Stationärer Betrieb, Uplink aktiv, 2.000 readings/s | 2.018 readings/s, 0 bytes/s auf die Platte, 9 % einer CPU | 2.031 readings/s, 5,4 MB/s auf die Platte (450 GB pro Tag), 14 % einer CPU | 10 Minuten: 2.002 readings/s, 0 bytes auf die Platte geschrieben (0 bytes pro Tag), 0 geschriebene Seiten des eingebetteten Warteschlangenspeichers, Warteschlangendatei vorher und nachher 32.768 bytes, 9 % einer CPU |
| Wiedergabe eines 5-Minuten-Ausfalls, bei weiter eintreffenden 2.000 readings/s | 829.745 Messwerte in 4 m 11 s, 3.308 pro Sekunde | 194.247 bis 308.582 pro Sekunde | 244.335 Messwerte in 824 ms, 296.523 pro Sekunde |
| Abrechnung nach einem 5-Minuten-Ausfall | verloren 441.255, gezählt 441.255 | verloren 474.978, gezählt 474.978 | verloren 599.165, gezählt 599.165, alle die ältesten, alle von der Grenze |
| Reihenfolge, Aliase, Sequenzlücken, live innerhalb einer Wiedergabe | 0, 0, 0, 0 | 0, 0, 0, 0 | 0, 0, 0, 0 |
| SIGKILL ohne etwas unterwegs, Uplink aktiv | verloren 0 | verloren 0 | verloren 0 |
| SIGKILL ohne etwas unterwegs 90 s nach Beginn einer stummen 5-Minuten-Unterbrechung, über der Grenze | nicht ausgeführt | verloren 528.167, gezählt 528.667 | verloren 520.661, gezählt 521.161 (die 500 zusätzlichen wurden zugestellt, nie bestätigt) |
| Zehn sofortige SIGKILLs, Uplink aktiv | verloren 0 (ein früherer Lauf: 50 in vier) | verloren 0 (ein früherer Lauf: 250) | verloren 0 in diesem Lauf; ein Abbruch kann etwa eine Abfrage mitnehmen, siehe oben |

Die Kosten stehen in der ersten Zeile. Write-ahead machte etwa 160 Commits pro Sekunde (einen pro Abfrage, um es auf die Platte zu bringen, einen pro Block, um es herunterzunehmen) mit je etwa acht 4-KB-Seiten, das sind 5 MB/s und 450 GB pro Tag, und eine SD-Karte überlebt das nicht. Im stationären Betrieb schreibt der Knoten jetzt gar nicht mehr in die Warteschlange: Der `write_bytes`-Zähler des Edge in `/proc` rührte sich zehn Minuten lang nicht. Die zehn sofortigen Abbrüche verloren in diesem Lauf nichts, und das ist Glück, kein Versprechen: Das Fenster sind die Messwerte im Speicher, wenn der Prozess stirbt, etwa eine Abfrage.

Ein früherer Build fand die andere Hälfte dessen, wofür diese Arbeit gemacht wurde: QoS 0 und eine Verbindung, die nicht mehr antwortet. Siehe "Eine Verbindung, die nicht mehr antwortet, wird aufgegeben" oben. Der Fünf-Minuten-Abbruch vor dieser Korrektur ließ den Knoten den ganzen Ausfall über in einer toten Verbindung sitzen und dann einen veralteten Block vor dem Birth der neuen Sitzung senden; 100 Messwerte kamen außer der Reihe an.

Ein früherer Build fand die andere Hälfte dessen, wofür diese Arbeit gemacht wurde: QoS 0 und eine Verbindung, die nicht mehr antwortet. Siehe "Eine Verbindung, die nicht mehr antwortet, wird aufgegeben" oben. Der Fünf-Minuten-Abbruch vor dieser Korrektur ließ den Knoten den ganzen Ausfall über in einer toten Verbindung sitzen und dann einen veralteten Block vor dem Birth der neuen Sitzung senden; 100 Messwerte kamen außer der Reihe an.

Bei dieser Last fasst eine 64-MiB-Warteschlange etwa zwei Minuten Ausfall: etwa 248.000 Messwerte, das sind etwa 236 Bytes pro Messwert bei Tag-Namen mit neun Zeichen (gemessen mit 4.21.1, Warteschlangendatei 61,7 MB), und ein längerer Tag-Name kostet mehr. Bemessen Sie die Grenze nach Ihrer eigenen Rate und Ihren eigenen Tag-Namen. Die Zeilen vom 2026-10-12 oben stimmen überein: Der 5-Minuten-Ausfall gab 244.335 Messwerte wieder, das sind dieselben zwei Minuten. Die Wiedergabe ist keine Grenze mehr: Sie läuft mit mehr als dem Hundertfachen der Rate, mit der Messwerte eintreffen.

Der Prüfer meldete in einem Lauf ohne Ausfall 4.000 bis 6.000 Duplikate. Wir haben den Verkehr mitgeschnitten, um herauszufinden, wessen sie waren: Jedes war ein NBIRTH, der den letzten Wert eines Tags wiederholte, den eine frühere Nachricht schon getragen hatte, mit dem eigenen Zeitstempel des Messwerts, und nicht eines war ein doppelt gesendetes NDATA. Ein Birth muss den aktuellen Wert jeder Metrik tragen, die der Knoten hat (dafür ist ein Birth da), und der Knoten sendet jedes Mal ein neues Birth, wenn ein neuer Tag auftaucht, sodass spätere Births frühere wiederholen. Der Publisher hatte recht und der Prüfer unrecht. Er zählt diese jetzt getrennt als Schnappschüsse und reserviert "Duplikat" für einen Messwert, der erneut als Daten veröffentlicht wurde, die einzige Art, die ein Host für neu halten könnte. Im stationären Lauf und im Lauf mit zehn Abbrüchen ist das Empfangene jetzt genau gleich dem Gelieferten: 1.296.275 und 916.350.

## Was verifiziert ist und was nicht

HotLoop wurde mit echten Geräten und echten Servern betrieben, und am 2026-11-17 auf echter Hardware.

## Konfiguration

| Variable | Standard | <span class="sr-only">Details</span> |
|---|---|---|
| `HOTLOOP_EDGE_PUBLISH_ENABLED` | `false` | Die Funktion ist aus, bis dies gesetzt wird |
| `HOTLOOP_EDGE_PUBLISH_BROKER` | k. A. | Nur Host, `host:port` oder eine vollständige URL |
| `HOTLOOP_EDGE_PUBLISH_GROUP` | k. A. | Sparkplug-Gruppen-ID |
| `HOTLOOP_EDGE_PUBLISH_NODE` | Pod-Hostname | Sparkplug-Knoten-ID |
| `HOTLOOP_EDGE_PUBLISH_USER` / `_PASSWORD` | k. A. | Zugangsdaten für den Broker |
| `HOTLOOP_EDGE_PUBLISH_TLS` | `false` | |
| `HOTLOOP_EDGE_PUBLISH_TLS_SKIP_VERIFY` | `false` | Pro Bereitstellung zu wählen; nie standardmäßig setzen |
| `HOTLOOP_EDGE_PUBLISH_QUEUE_PATH` | `/data/forward.db` | Die Datei der Weiterleitungswarteschlange |
| `HOTLOOP_EDGE_PUBLISH_QUEUE_MAX_BYTES` | `67108864` (64 MiB) | Die Warteschlangendatei wächst nie darüber hinaus; die ältesten Messwerte werden verdrängt und gezählt, um darunter zu bleiben. `0` ist unbegrenzt, mit einer Warnung. Alles andere unter 1 MiB läuft mit 1 MiB, mit einer Warnung |

## Im Helm-Chart

Das Gateway-Chart hat einen `edgePublish:`-Block, der all das setzt. Er ist standardmäßig aus, und aus erzeugt er genau das, was das Chart vor dem Block erzeugte. Setzen Sie diese Werte nicht mehr über `extraEnv`.

```yaml
edgePublish:
  enabled: true
  broker: tcp://central.example.local:1883
  group: Plant1
  node: ""               # empty uses the release name
  username: ""
  password: ""           # goes into a chart-managed Secret
  existingSecret: ""     # or name your own Secret (key: secretKey)
  tls: false
  tlsSkipVerify: false
  queueMaxBytes: 67108864   # 64 MiB; 0 is unbounded
  persistence:
    enabled: true
    size: 1Gi
```

Einige Dinge entscheidet das Chart für Sie:

- Die Warteschlangendatei ist `/data/edge-publish/forward.db`, auf einem eigenen PVC. Das ist kein Wert, weil überall sonst im Pod das Root-Dateisystem schreibgeschützt ist. Mit `persistence.enabled: false` liegt sie auf einem emptyDir, der die Messwerte eines Ausfalls über einen Container-Neustart hinweg behält, aber nicht über einen neu eingeplanten Pod.
- Die Knoten-ID ist standardmäßig der Release-Name, nicht der Pod-Hostname. Ein Deployment-Pod bekommt bei jedem Rollout einen neuen Hostnamen, und der Host sähe jedes Mal einen neuen Edge-Knoten, mit den gepufferten Messwerten unter ihm wiedergegeben.
- Das Deployment wechselt auf `Recreate`, und `replicaCount` muss 1 sein. Die Warteschlangendatei nimmt eine Sperre: Bei einem fortlaufenden Update kann der neue Pod sie nicht öffnen, wird nie bereit, und das Rollout hängt. Und zwei Replikate wären zwei Publisher auf einer Knoten-ID.

Das Edge-Relay-Chart (`charts/hotloop-edge-relay`) hat einen eigenen `edgePublish:`-Block nach demselben Muster, ohne `enabled`: Das Relay veröffentlicht immer.
