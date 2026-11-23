---
title: "Versionshinweise: HotLoop Flow 2.2.0"
description: "Was HotLoop Flow 2.2.0 bringt, was sich beim Update ändert und was Sie lesen sollten, bevor Sie eine laufende Anlage anfassen."
sidebar:
  label: "2.2.0"
---

HotLoop Flow 2.2.0 ist die Version, in der Flow mit den SPSen spricht, sich beim Neustart merkt, was es wusste, und Ihnen zeigt, wohin eine Nachricht gegangen ist. Es ist auch die erste Version unter der Business Source License von HotLoop, und ich stelle das an den Anfang, weil Sie genau das lesen müssen.

## Die Lizenz hat sich geändert

2.2.0 und jede Version danach stehen unter der Business Source License 1.1 von HotLoop, derselben Lizenz wie der Rest von HotLoop. Das ist keine Open-Source-Lizenz, und ich werde nicht so tun. Der Quellcode von Flow bleibt öffentlich, Sie können also jede Zeile lesen, die Sie ausführen.

- Die Nutzung zu Hause und im Labor ist kostenlos.
- Akkreditierte Schulen und Bildungseinrichtungen, gemeinnützige Organisationen und Behörden nutzen es kostenlos für ihren eigenen Betrieb und ihren Auftrag.
- Die geschäftliche Nutzung ist kostenlos, wenn sie über [EmberNet](https://embernet.ai) läuft. Das ist der einzige geschäftliche Weg.
- Flow als Dienst zu hosten, weiterzuverkaufen und in ein Produkt einzubetten, das Sie verkaufen, ist nicht gestattet.
- Jede Version wird vier Jahre nach ihrer ersten Veröffentlichung zu GPL-3.0 oder später.

`LICENSE` ist der Rechtstext, Byte für Byte der aus HotLoop-io/HotLoop-io. 2.1.0 und alles davor bleiben unter der Lizenz, mit der sie erschienen sind. An diesen Versionen ändert sich nichts. Die portierten Node-RED-Dateien behalten ihre ursprünglichen Lizenzkopfzeilen und Nennungen, deshalb liegt ihr Lizenztext jetzt in `LICENSES/` neben `NOTICE`, und das Image trägt beides in `/usr/share/doc/hotloop-flow/`. `NOTICE` deckt auch die gepatchte Kopie von gos7 ab, die Flow jetzt mitbringt (unten).

## Neu

**Tracing und Replay**
- Jede Nachricht bekommt einen begrenzten Trace. Klicken Sie auf eine Debug-Meldung, und der Editor leuchtet den Weg aus, den sie genommen hat, mit Zeit und Payload an jeder Station, durch Splits, Joins und Subflows.
- Ein Trace wird zu einem Flow-Test oder wird in einen Entwurf abgespielt, sodass Sie eine Korrektur an der Nachricht ausprobieren können, die den Fehler ausgelöst hat.
- Jede Station kann als Span an einen OpenTelemetry-Collector gehen (`trace.otlp.endpoint`).

**Zustand, der einen Neustart überlebt**
- Flow-, globaler und Node-Kontext liegen in einer SQLite-Datei, `state.db`, auf dem Datenvolume. Ein Neustart löscht sie nicht mehr.
- Dauerhafte Verbindungen. Markieren Sie eine Verbindung als dauerhaft: Solange der Node am anderen Ende mithält, ist sie eine gewöhnliche Verbindung und schreibt nichts. Nimmt dieser Node keine Nachrichten mehr an, läuft die Verbindung der Reihe nach in dieselbe Datei über und leert sich, wenn das Ziel zurückkommt. Wir haben es gegen ein echtes InfluxDB belegt, das zehn Minuten lang beendet war, mit einem per `kill -9` getöteten Runtime mitten im Ausfall und mitten im Leeren: keine fehlt, keine doppelt.

**Anlagen-Nodes**
- Modbus TCP lesen und schreiben, OPC UA lesen, schreiben und abonnieren, S7 lesen und schreiben, EtherNet/IP lesen und schreiben, und Sparkplug B als Edge-Node und als Host. Flow kann jetzt mit allem sprechen, was `scan` findet.
- Sparkplug erledigt die Births, das Will, `bdSeq`, Rebirth-Anfragen und Befehle, die die Spezifikation verlangt. Wir haben es in beide Richtungen gegen eine unabhängige Sparkplug-Implementierung geprüft, Edge-Node und Host.
- Ein stilles Gerät lässt die Anfrage innerhalb des Timeouts fehlschlagen, und die nächste Nachricht verbindet neu. Ein OPC-UA-Abonnement bemerkt, dass es abgerissen ist, meldet es einmal und fängt sich selbst wieder.

**Der Editor**
- Kopieren und Einfügen, Import und Export einer Auswahl, Subflows mit eigener Zeichenfläche, verschachtelte Gruppen, Suche über alle Flows, Debug-Filter, Alt-Klick zum Löschen einer Verbindung. Ein Browsertest klickt jeden Node-Dialog aus der Liste durch, die die Runtime ausliefert, sodass ein neuer Node am Tag seines Erscheinens abgedeckt ist.
- Eine Verbindung auf einen Node zu ziehen funktionierte in Chromium nie. Jetzt funktioniert es.

**Prüfungen**
- Ein Node, dessen Konfigurations-Node nicht in der Datei steht (ein gelöschter Broker, den ein Subflow noch nennt, oder ein Verweis auf einen Tab oder den falschen Typ Konfigurations-Node), wird beim Import, beim Laden und beim Deploy gemeldet und startet nicht. Vorher funktionierte er stillschweigend nie.
- Das Löschen eines Flows oder Nodes nimmt seine ID aus den Catch-, Status- und Complete-Bereichen, die ihn nannten.

## Was sich geändert hat

- Der Kontext bleibt standardmäßig erhalten. `store.context.persist` ist an, ein vor einem Neustart gesetzter Wert ist also danach noch da, während vorher jeder Neustart leer begann. Ein Flow, der beim Start auf einen leeren Kontext gezählt hat, muss jetzt selbst leeren, was er leer erwartet. Setzen Sie `persist` auf `false` für das alte Verhalten.
- Tracing ist standardmäßig an und in jeder Hinsicht begrenzt: 256 Verläufe, je 512 Stationen, insgesamt 16 MiB, 1000 neue Verläufe pro Sekunde. Es liegt nur im Speicher, ein Neustart beginnt die Liste also neu. `trace.enabled: false` schaltet es aus.
- gos7 schrieb bei jedem S7-Timeout eine Rohzeile in den globalen Logger von Go, und nichts am Node konnte das abschalten.
- Die dauerhafte Warteschlange zählt eine Nachricht als wartend, nachdem sie auf der Platte ist, nicht davor.
- Das Image wird mit Podman gebaut und gepusht, nicht mit Docker. Dasselbe Image, dieselben Tags (`2.2.0`, `2.2`, `2`), weiterhin linux/amd64 und linux/arm64.

## Hinweise zum Update

Ab 2.1.0 genügt es, das Image zu wechseln (`helm upgrade` oder das neue Tag in Ihrer Quadlet-Unit). Keine Migration, kein Flag. Eine `flows.json` und eine Konfigurationsdatei, die auf 2.1.0 liefen, laufen auf 2.2.0, und der byteexakte Rundlauf der Flow-Datei bleibt unangetastet.

- Der erste Start legt `state.db` in `data.dir` an, auf dem Volume. Mit `persistence.enabled` auf false im Chart übersteht sie einen Container-Neustart, aber keinen Pod-Austausch.
- Ein Zurückgehen auf 2.1.0 lässt `state.db` liegen. 2.1.0 hat keinen Code, der sie liest.
- Jeder Schreibvorgang in `state.db` ist ein Schreibvorgang auf eine SD-Karte oder SSD, deshalb bündeln die Standardwerte. Kontextänderungen warten `flushInterval` (30 Sekunden) und werden zusammen geschrieben, und ein Wert, der auf das gesetzt wird, was er schon war, schreibt nichts. Ein `kill -9` kann so viel verlieren. `docs/durable/README.md` hat die Zahlen und was es eine Karte kostet.

## Neue Einstellungen

| YAML | Umgebung | Standard |
|---|---|---|
| `store.path` | `HOTLOOP_FLOW_STORE_PATH` | leer, das ist `state.db` in `data.dir` |
| `store.synchronous` | `HOTLOOP_FLOW_STORE_SYNCHRONOUS` | `normal`. `full` führt bei jedem Commit fsync aus und nutzt die Karte dafür ab. |
| `store.context.persist` | `HOTLOOP_FLOW_CONTEXT_PERSIST` | `true` |
| `store.context.flushInterval` | `HOTLOOP_FLOW_CONTEXT_FLUSH_INTERVAL` | `30s`. `0s` schreibt jede Änderung, bevor der Flow weitergeht. |
| `store.durable.maxBytes` | `HOTLOOP_FLOW_DURABLE_MAX_BYTES` | 256 MiB für alle dauerhaften Verbindungen zusammen |
| `store.durable.ackFlush` | `HOTLOOP_FLOW_DURABLE_ACK_FLUSH` | `100ms`. `0s` markiert jede Nachricht, bevor die nächste gesendet wird. |
| `trace.enabled`, `trace.traces`, `trace.maxHops`, `trace.maxMessageBytes`, `trace.maxBytes`, `trace.perSecond` | | `true`, 256, 512, 16384, 16 MiB, 1000. `perSecond: 0` verfolgt jede Nachricht. |
| `trace.otlp.endpoint`, `trace.otlp.serviceName`, `trace.otlp.interval` | `HOTLOOP_FLOW_TRACE_OTLP_ENDPOINT` | leer (kein Export), `hotloop-flow`, `2s` |
| `trace.otlp.headersSecret` (Chart) | `HOTLOOP_FLOW_TRACE_OTLP_HEADERS` | keiner. Ein Secret-Schlüssel mit `Name=value`-Paaren, durch Kommas getrennt, für den API-Schlüssel eines gehosteten Collectors. |

Das Chart hat all das unter `store` und `trace` in `values.yaml`.

Image: `ghcr.io/hotloop-io/hotloop-flow:2.2.0`, linux/amd64 und linux/arm64. Chart: `https://hotloop.io/hotloop-flow/`. Die README zu diesem Tag enthält den Rest: https://github.com/HotLoop-io/hotloop-flow/blob/v2.2.0/README.md
