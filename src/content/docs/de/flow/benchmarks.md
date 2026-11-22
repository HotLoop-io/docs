---
title: "Leistungs-Benchmarks"
description: "Gemessene Startzeit, Speicher, Durchsatz und Latenz von Flow auf Desktop und Raspberry Pi 5, was die Zahlen nicht sind und wie Sie den Test selbst wiederholen."
---

Nur absolute Zahlen. Eine Gegenüberstellung verschiebt sich jedes Mal, wenn sich die Box ändert, und beschreibt am Ende mehr das andere Produkt als dieses.

Flow beantwortet etwa 15.000 Anfragen pro Sekunde auf einem Desktop und etwa 13.000 pro Sekunde auf einem Raspberry Pi 5, mit unter 30 MiB Speicher auf dem Desktop und 42 MiB auf dem Pi. Das ist der ganze Sinn einer Flow-Engine, die klein genug für die Box in der Anlage ist.

## Der Flow

Fünf Knoten: ein HTTP-Endpunkt, drei Eigenschaftsänderungen, eine Antwort. Nichts darin ist absichtlich schnell. Es ist die Form eines kleinen echten Flows, und darum sollte es bei einem Benchmark einer Flow-Engine gehen. Der Lastgenerator arbeitet im geschlossenen Regelkreis: Jeder Client sendet die nächste Anfrage, wenn die letzte zurückkam, er misst also, was die Gegenseite aufnehmen kann, und kann nicht die irreführende Latenz erzeugen, die ein Generator mit offenem Kreis meldet, wenn das Ziel zurückfällt.

## Selbst ausführen

`hotloop-flow bench` steckt im Binary. `-launch` startet das Binary, misst, wie lange es dauert, bis der Flow antwortet (Kaltstart), liest den residenten Speicher des Prozesses zwei Sekunden später (Leerlauf), tastet ihn dann während der Last ab und behält den Spitzenwert. `-target` ohne `-launch` steuert über HTTP eine bereits laufende Instanz an, einen Container oder einen Pod, für Durchsatz und Latenz.

```bash
hotloop-flow bench -mode http -launch ./hotloop-flow -target http://127.0.0.1:18897 -path /bench -duration 30s -warmup 5s -connections 8
hotloop-flow bench -mode engine -chain 5 -messages 200000
```

## Ergebnisse

Gemessen auf einem x86-Desktop (24 CPUs) mit dem nativen statischen Binary, je drei Läufe.

| <span class="sr-only">Details</span> | Lauf 1 | Lauf 2 | Lauf 3 |
|---|---|---|---|
| Kaltstart | 0.05 s | 0.05 s | 0.05 s |
| RSS, Leerlauf | 16.7 MiB | 16.7 MiB | 16.4 MiB |
| RSS, Spitze unter Last | 26.4 MiB | 26.4 MiB | 28.5 MiB |
| HTTP-Durchsatz | 15.0k req/s | 15.3k req/s | 13.0k req/s |
| HTTP-Latenz p50 / p95 / p99 | 0.39 / 1.22 / 1.82 ms | 0.39 / 1.20 / 1.78 ms | 0.41 / 1.49 / 4.03 ms |
| Engine, pro Nachricht | 2.61 µs | 3.11 µs | 2.20 µs |
| Engine, zugewiesener Speicher pro Nachricht | 3,868 bytes | 3,869 bytes | 3,868 bytes |

## Ergebnisse auf einem Raspberry Pi 5

Gemessen auf einem Raspberry Pi 5 mit 8 GB, Takt auf 2.0 GHz begrenzt, als Pod auf k3s, ohne sonst etwas auf dem Knoten. Derselbe Flow, drei Läufe, jeder in einem frischen Pod.

| <span class="sr-only">Details</span> | Lauf 1 | Lauf 2 | Lauf 3 |
|---|---|---|---|
| Kaltstart | 0.46 s | 0.15 s | 0.10 s |
| RSS, Spitze unter Last | 40.3 MiB | 40.5 MiB | 40.3 MiB |
| HTTP-Durchsatz | 13.2k req/s | 13.4k req/s | 13.3k req/s |
| HTTP-Latenz p50 / p95 / p99 | 0.48 / 1.45 / 2.78 ms | 0.48 / 1.42 / 2.72 ms | 0.48 / 1.44 / 2.74 ms |
| Engine, pro Nachricht | 8.15 µs | 7.74 µs | 7.89 µs |

Über 600 Sekunden gehalten, pendelt sich derselbe Befehl auf demselben Board bei 11.4k req/s ein, mit p50 bei 0.58 ms und p99 bei 3.00 ms. Das Board läuft mit einem bloßen Kühlkörper ohne aktive Kühlung und drosselt bei so viel Last, das ist also die ehrliche Zahl für eine Box, die ausgelastet bleibt.

### Was diese Zahlen nicht sind

**Der HTTP-Durchsatz schließt den HTTP-Stack ein.** Mit Absicht: Das erlebt ein Client Ihres Flows. Es ist keine Messung des Schedulers. Die Engine-Zeilen sind es, ganz ohne E/A im Pfad.

**Eine Flow-Form, eine Nutzlastgröße, eine Parallelität.** Ein Flow mit echter E/A, einer MQTT-Veröffentlichung oder einem Datenbankschreibvorgang, wird von dieser E/A dominiert. Diese Zahlen sind der Eigenaufwand der Laufzeit, kein Versprechen für jede Last.

**Das Ende der Verteilung bewegt sich stärker als der Median.** Unter Sättigung stauen sich alle Anfragen, und der Stau bestimmt p99. Der Median zeigt, was die Bearbeitung einer Anfrage kostet.

**Das ist der Benchmark-Flow, keine dauerhaften Verbindungen.** Nichts hier misst den Speicher hinter einer dauerhaften Verbindung oder Schreibvorgänge auf SD-Karten.

## Speicher

RSS ist der residente Speicher des Prozesses selbst, aus `/proc` gelesen. Es ist nicht das, was `podman stats` meldet, das zeigt, was der Kernel dem Container anrechnet, und viel weniger anzeigen kann, als der Prozess tatsächlich hält.