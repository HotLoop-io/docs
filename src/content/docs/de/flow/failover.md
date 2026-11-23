---
title: "Warmer Standby mit Lease"
description: "Zwei Flow-Installationen teilen sich eine Aufgabe: ein Lease in PostgreSQL und eine Sperre bei jedem Schreiben auf Anlagen, damit nur eine schreibt."
---

Zwei Installationen von Flow können sich die Aufgabe einer teilen. Eine davon ist der Schreiber: Sie ist die einzige, die irgendetwas an Anlagen sendet. Die andere ist der Standby: Sie führt dieselben Flows aus, liest, abonniert und hält ihren Kontext warm, hält aber jedes Schreiben auf Anlagen zurück, bis sie den Platz des Schreibers einnimmt. Wenn der Schreiber ausfällt, hängt oder seine Verbindung verliert, übernimmt der Standby in etwa der Länge eines Leases, und die bisherige Schreiberin darf erst wieder schreiben, wenn sie das Lease zurückgewonnen hat.

Das ist für den Fall, dass ein Neustart nicht schnell genug ist und ein zweiter Schreiber schlimmer ist als eine kurze Wartezeit. Ist ein Neustart schnell genug, ist eine einzelne Installation mit einer Kubernetes-Neuplanung einfacher und genau das, was das Chart standardmäßig tut.

## So funktioniert es

Das Lease ist eine Zeile in einem PostgreSQL, das beide Installationen erreichen können. Der Schreiber erneuert es alle paar Sekunden. Der Standby versucht es im selben Takt zu bekommen und erhält es erst, nachdem es abgelaufen ist. Jedes Mal, wenn der Inhaber wechselt, steigt die Fencing-Nummer in der Zeile, und Flow meldet sie.

Jedes Schreiben auf eine Anlage stellt unmittelbar vor dem Senden dieselbe Frage: Halte ich das Lease, mit mehr Restzeit, als ein Schreiben braucht? Wenn nicht, wird das Schreiben mit einem gezählten Fehler abgelehnt, der den Catch-Knoten des Flows erreicht, und es wird nichts gesendet, nicht einmal eine Verbindung. Diese Prüfung, die im Moment jedes Schreibens erfolgt, verhindert, dass zwei Installationen gleichzeitig schreiben:

- Der Inhaber zählt sein Lease ab dem Moment, in dem er es angefordert hat, nie ab dem Moment, in dem die Antwort zurückkam, und glaubt daher nie, mehr Zeit zu haben als die Datenbank.
- Der Inhaber hört auf zu schreiben, wenn ihm weniger Lease bleibt, als ein Schreiben braucht (`writeMargin`), und das ist vor Ablauf des Leases. Der Standby kann das Lease erst übernehmen, nachdem es abgelaufen ist. Es gibt also eine Lücke und keine Überlappung.
- Ein Inhaber, der eingefroren und wieder aufgetaut wird oder abgeschnitten und wieder verbunden wird, findet sein Lease verloren vor, verweigert seine Schreibvorgänge und fragt das Lease an wie jeder andere.
- Die Uhr der Datenbank entscheidet, wann das Lease endet, sodass zwei Rechner mit abweichenden Uhren sich trotzdem einig sind, wer es hält.

Die Schreibvorgänge, die fragen, sind die, die Anlagen ansteuern können: `modbus write`, `s7 write`, `opcua write` und `ethernetip write`, ob direkt oder über das Write-Gate von HotLoop, die Knoten `hotloop script` und `hotloop recipe`, und in einem FlowLab-Diagramm das serielle Schreiben, ein Instrumentenbefehl, der schreibt (zusätzlich zum eigenen Schreibschalter dieses Instruments) und das HotLoop-Schreiben. Das Senden einer Nachricht an einen MQTT-Broker, eine Datenbank oder eine Benachrichtigung wird nicht gesperrt: Es ist kein Befehl an eine Anlage, und eine Wiederholung ist harmlos, wo ein wiederholter Sollwert es vielleicht nicht ist. Ein Flow-Test ersetzt die Außenwelt und wird nie zurückgehalten.

## Was es kostet und was es Ihnen nicht gibt

- **Die Übernahmezeit** entspricht etwa der Lease-Dauer. Mit den Standardwerten (15 Sekunden Lease, alle 5 Sekunden erneuert, 5 Sekunden Marge) übernahm ein Standby 14,7 Sekunden, nachdem der Schreiber beendet wurde. Mit 6 Sekunden Lease waren es 5,7 Sekunden. Ein Schreiber, der sauber stoppt, gibt das Lease ab, und der Standby übernahm in 0,35 Sekunden.
- **Ein Schreiben, das länger als `writeMargin` dauert,** kann das Lease überleben. Halten Sie die Protokoll-Timeouts der schreibenden Knoten darunter. Ein Schreiben, das schon unterwegs ist, wenn ein Prozess eingefroren wird, hat seine Prüfung schon bestanden und kann trotzdem noch ankommen.
- **Mindestens einmal.** Eine SPS, die ein Schreiben angenommen hat, dessen Bestätigung verloren ging, kann erleben, dass der neue Schreiber es erneut sendet. Für einen Sollwert ist das unbedenklich, für einen Impuls oder ein Inkrement nicht, also schreiben Sie Sollwerte, keine Deltas.
- **Warteschlangen bleiben lokal.** Dauerhafte Leitungen und Kontext liegen auf dem eigenen Datenträger jeder Installation. Was bei einem ausgefallenen Schreiber in der Warteschlange stand, ist nicht beim Standby.
- **Die Datenbank ist eine Abhängigkeit.** Ein Schreiber, der sie nicht erreicht, kann nicht erneuern und hört auf zu schreiben, wenn sein Lease knapp wird. Legen Sie das Lease auf eine Datenbank, die mindestens so verfügbar ist wie die Anlagen, die sie schützt.

## Einrichtung

Installieren Sie Flow zweimal, als zwei Helm-Releases oder zwei Quadlet-Units, jede mit eigenem Volume, und richten Sie beide auf dasselbe Lease. Geben Sie der zweiten dieselbe Flow-Datei wie der ersten und halten Sie sie dort mit einem Senden an Stationen ([Senden an die Stationen eines Tenants](/de/flow/stations/)) aktuell, denn Flow kopiert keine Flows zwischen den beiden.

| Einstellung | Umgebung | Was es ist |
|---|---|---|
| `failover.urlFile` | `HOTLOOP_FLOW_FAILOVER_URL_FILE` | Eine Datei mit der PostgreSQL-URL der Lease-Datenbank. Wird sie gesetzt, ist Failover eingeschaltet. |
| `failover.name` | `HOTLOOP_FLOW_FAILOVER_NAME` | Das Lease. Auf beiden dasselbe. Standard `flow`. |
| `failover.holder` | `HOTLOOP_FLOW_FAILOVER_HOLDER` | Der eigene Name dieser Installation. Er muss sich zwischen den beiden unterscheiden und ist standardmäßig der Hostname. |
| `failover.ttl` | `HOTLOOP_FLOW_FAILOVER_TTL` | Wie lange eine Vergabe gilt, und damit etwa die Übernahmezeit. Standard `15s`. |
| `failover.renewEvery` | `HOTLOOP_FLOW_FAILOVER_RENEW_EVERY` | Wie oft der Inhaber erneut fragt. Standard ein Drittel der ttl. |
| `failover.writeMargin` | `HOTLOOP_FLOW_FAILOVER_WRITE_MARGIN` | Wie viel Lease ein Schreiben noch übrig haben muss. Standard `5s`. |

Flow verweigert den Start, wenn die Einstellungen den Inhaber zwischen zwei Erneuerungen unter seine Marge fallen ließen, zum Beispiel eine Marge, die so lang ist wie die ttl.

Im Chart sind das `failover.urlSecret` (ein Secret, dessen Schlüssel die URL enthält, als Datei eingehängt und nie in die ConfigMap gelegt), `failover.name`, `failover.ttl`, `failover.renewEvery` und `failover.writeMargin`. Mit Quadlet sind es die obigen Umgebungsvariablen, und die URL ist ein als Datei eingehängtes Podman-Secret:

```ini
Environment=HOTLOOP_FLOW_FAILOVER_URL_FILE=/run/secrets/flow-lease-url
Environment=HOTLOOP_FLOW_FAILOVER_NAME=line3
Secret=hotloop-flow-lease-url,type=mount,target=flow-lease-url
```

## Es sehen

- `GET /failover` (und das MCP-Tool `get_failover`) sagt, ob diese Installation `active`, `standby` oder `lost` ist, wer das Lease hält, welche Fencing-Nummer sie hält und wie viele Schreibvorgänge sie zurückgehalten hat, aufgeschlüsselt danach, was geschrieben hat. Es braucht `status.read` und ist nur da, wenn Failover eingerichtet ist.
- Der Editor zeigt ein Banner auf einem Standby und auf einem Inhaber, der sein Lease verloren hat.
- Der Metrik-Endpunkt hat `hotloop_flow_failover_active`, `hotloop_flow_failover_epoch`, `hotloop_flow_failover_takeovers_total` und `hotloop_flow_failover_refused_total{op}`.
- Beide Installationen protokollieren, wann sie das Lease übernehmen und wann es ihnen genommen wird.

## Was belegt ist und was nicht

Belegt auf zwei echten Flow-Prozessen gegen ein echtes PostgreSQL und einen Modbus-TCP-Server, der jedes Schreiben protokolliert, wobei jede Installation alle 200 ms einen markierten Wert schrieb: Mit dem mitten im Strom beendeten Schreiber übernahm der Standby nach einem Lease, und kein Schreiben des Standbys kam vor dem letzten Schreiben des Schreibers oder nach ihm (0 und 0); mit dem Schreiber, der länger als das Lease eingefroren und wieder aufgetaut wurde, schrieb dieser nicht erneut; mit dem sauber gestoppten Schreiber übernahm der Standby in 0,35 Sekunden. Ein Test für jeden der obigen Schreibwege zeigt, dass das Schreiben eines Standbys oder eines veralteten Inhabers abgelehnt wird, bevor etwas gesendet wird, und dass dasselbe Schreiben gesendet wird, wenn das Gate offen ist.

Nicht belegt: das Verhalten einer echten SPS bei einem wiederholten Schreiben, ein Datenbank-Failover unter dem Lease und ein Netz, das nur in einer Richtung unterbrochen ist. Der Modbus-Server ist ein Simulator, der das Protokoll spricht. Failover ist nicht auf einem Cluster erprobt, und die Chart-Werte und Quadlet-Zeilen sind gerendert und geprüft, nicht installiert. Die Texte im Editor-Banner wurden nicht von Muttersprachlern geprüft.
