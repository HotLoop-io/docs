---
title: "HotLoop Flow, die visuelle Flow-Engine"
description: "Eine visuelle Flow-Engine für die Fertigung in einem Go-Binary, mit Obergrenze je Warteschlange, prüfbaren Deployments und Ihren Node-RED-Flows unverändert."
---

**Verdrahten Sie die Anlage. Prüfen Sie sie wie Code.**

HotLoop Flow ist eine visuelle Flow-Engine für die Fertigung, geschrieben in Go. Sie verdrahten Sensoren, Broker, SPS und Datenbanken auf einer Zeichenfläche, und die Engine führt diese Verbindungen in einem einzigen statischen Binary aus, klein genug für einen Pi, mit einem Scheduler, der nicht umfällt, wenn ein Sensor schneller redet, als das Gegenstück ihn lesen kann.

Was das in einer schlechten Nacht bedeutet:

- **Jede Warteschlange hat eine Obergrenze, und jede Nachricht, die nicht hineinpasst, wird gezählt.** Ein schneller Sensor vor einem langsamen Historian staut sich, blockiert oder verwirft nach der Richtlinie, die Sie gewählt haben, und das zeigt sich in einem Diagramm, bevor es sich als OOM-Kill ohne Eintrag im Log zeigt.
- **Ein Historian, der eine Stunde ausfällt, kostet Sie keine Stunde.** Markieren Sie eine Verbindung als dauerhaft: Nimmt der Knoten dahinter keine Nachrichten mehr an, gehen sie der Reihe nach auf die Platte und sind nach einem `kill -9` noch da. Solange alles gesund ist, wird nichts geschrieben. [Store and Forward](/de/flow/store-and-forward/) wurde gegen einen echten InfluxDB geprüft, der zehn Minuten lang angehalten war.
- **Jeder Knoten läuft für sich.** Eine Goroutine pro Knoten, sodass ein Function-Knoten, der eine große Nutzlast durchkaut, Sie einen Kern kostet, nicht den Editor und alle anderen Flows auf der Maschine.
- **Die Flow-Datei lässt sich prüfen.** Sie wird Byte für Byte geladen und gespeichert, die Änderung einer Eigenschaft ist ein Diff von einer Zeile, und jedes Speichern ist atomar mit drei Sicherungen dahinter. Jedes Deployment ist [ein Datensatz](/de/flow/deploys/): wer, wann, warum und die genauen Bytes, und zwei beliebige davon lassen sich [Knoten für Knoten vergleichen](/de/flow/deploys/#the-diff-reads-like-a-review), in der API, auf der Kommandozeile und in `git diff`. Jedes davon lässt sich [zurückrollen](/de/flow/deploys/#put-it-back), samt Zugangsdaten.
- **Er startet nicht ungeschützt.** Keine Authentifizierung ist ein Startfehler, kein Standardwert. Der Knoten `exec` wird ausgeschaltet ausgeliefert, die Datei-Knoten sind auf das Datenverzeichnis begrenzt, und Zugangsdaten sind mit AES-256-GCM unter einem Argon2id-Schlüssel verschlüsselt.

Er führt auch Ihre bestehenden Flows unverändert aus. Das steht [weiter unten](/de/flow/migrating-from-node-red/), weil es eine Funktion ist, nicht der Kern.

Die aktuelle Version ist `{{flow}}`. Das Image ist `ghcr.io/hotloop-io/hotloop-flow:{{flow}}` für amd64 (arm64 folgt mit dem nächsten Patch-Release), das Helm-Repository ist `https://hotloop.io/hotloop-flow/`, und [Flow bereitstellen](/de/flow/deploying/) behandelt Kubernetes, Podman und Quadlet. Es hat 117 Knotentypen für Nachrichten und 39 für FlowLab-Diagramme. Die private und Labornutzung ist kostenlos, ebenso die Nutzung durch Schulen, gemeinnützige Organisationen und Behörden, und die Nutzung über EmberNet, eine Partnerplattform, auch geschäftlich, ist uneingeschränkt, unter dem HotLoop Source License Agreement.

## Die Zahlen

Nur absolute Zahlen, damit Sie sie auf Ihrer eigenen Hardware nachprüfen können. Je drei Läufe, gedruckt wird der Bereich.

| Messwert | Ergebnis |
|---|---|
| Binary, linux/amd64, statisch | **41.7 MB** |
| Image, amd64 | **45.64 MB** |
| Vom Start bis zur ersten beantworteten Anfrage | **0.05 s** |
| RSS, im Leerlauf | **16.4 bis 16.7 MiB** |
| RSS, Spitze unter der HTTP-Last unten | **26.4 bis 28.5 MiB** |
| HTTP, Flow mit fünf Knoten, 8 Verbindungen | **13.0k bis 15.3k req/s** |
| HTTP-Latenz p50 / p99 | **0.39 bis 0.41 ms / 1.78 bis 4.03 ms** |
| Engine, Kette aus fünf Knoten, ohne E/A | **2.20 bis 3.11 µs pro Nachricht**, 3.9 KB zugewiesen |

Wissen Sie, was diese Zahlen nicht sind. Die HTTP-Zahl läuft absichtlich durch den ganzen HTTP-Stack, denn das sieht ein Client Ihres Flows. Und unter Sättigung reiht jede Laufzeit ein, und das Einreihen bestimmt das Ende der Verteilung, weshalb p99 zwischen den Läufen stärker schwankt als p50.

### Auf einem Raspberry Pi 5

Derselbe Flow und dieselben Befehle, am 2026-10-22, auf einem Raspberry Pi 5 Model B (8 GB, vier Cortex-A76-Kerne) mit auf 2.0 GHz begrenztem Takt, mit dem veröffentlichten arm64-Image `2.2.0` als Pod und sonst nichts auf dem Knoten außer den DaemonSets des Clusters. Drei Läufe, gedruckt wird der Bereich.

| Messwert | Ergebnis |
|---|---|
| Vom Start bis zur ersten beantworteten Anfrage | **0.10 bis 0.46 s** |
| RSS, im Leerlauf | **88.0 bis 88.3 MiB** |
| RSS, Spitze unter der HTTP-Last | **40.3 bis 40.5 MiB** |
| HTTP, Flow mit fünf Knoten, 8 Verbindungen, 30 s | **13.2k bis 13.4k req/s** |
| HTTP-Latenz p50 / p99 | **0.48 ms / 2.72 bis 2.78 ms** |
| Engine, Kette aus fünf Knoten, ohne E/A | **7.74 bis 8.15 µs pro Nachricht**, 4.0 KB zugewiesen |
| HTTP, derselbe Befehl 600 s lang gehalten | **11.4k req/s**, p50 0.58 ms, p99 3.00 ms |

Die letzte Zeile ist die ehrliche für eine Maschine, die dauerhaft unter Last bleibt. Die Platine erreichte ihre weiche Temperaturgrenze nach weniger als einer Minute, drosselte ab etwa der zweiten Minute und blieb den Rest der Zeit bei 83 bis 86 C mit einem Takt von 1.5 bis 1.7 GHz. Die [Benchmark-Seite](/de/flow/benchmarks/#ergebnisse-auf-einem-raspberry-pi-5) hat den Pi-Lauf vollständig.

Die [Benchmark-Seite](/de/flow/benchmarks/) hat die Methode und die Einschränkungen.

Setzen Sie es in einem Werk ein? [HotLoop im Unternehmen nutzen](/de/business/) behandelt die Lizenz und wie Sie uns erreichen.
