---
title: "Versionshinweise: HotLoop Flow 2.8.0"
description: "Was HotLoop Flow 2.8.0 bringt, was sich beim Update ändert und was Sie lesen sollten, bevor Sie eine laufende Anlage anfassen."
sidebar:
  label: "2.8.0"
---

HotLoop Flow 2.8.0 fügt FlowLab, dem Diagramm-Tab für Prüfstände und Datenlogger, vier Dinge hinzu: Analyseknoten, einen Datenerfassungsknoten für NI-Hardware, eine MQTT-Ausgabe, die behält, was der Broker verpasst, und ein TDMS-Log. Flows laufen genau wie bisher, eine Flow-Datei, die Sie heute haben, wird Byte für Byte geladen und gespeichert, und ein Tab, der kein Diagramm ist, sieht davon nichts.

## Neu

**Analyse.** Vier Nodes arbeiten auf einem Array von Messwerten: Statistik (Mittelwert, RMS, kleinster, größter Wert und Standardabweichung), Integral (die Fläche unter dem Array nach der Trapezregel, als eine Zahl oder als laufende Fläche), Ableitung (die Steigung an jedem Messpunkt) und ein Butterworth-Filter der Ordnung 1 bis 10 als Tiefpass, Hochpass, Bandpass oder Bandsperre, mit der Grenzfrequenz in Hertz.

**Ein Messdatenerfassungs-Node.** `read DAQ task` liest Messwerte von NI-Hardware, etwa einem CompactDAQ-Chassis, über NIs gRPC Device Server. Der Client ist so klein wie möglich: Gos eigenes HTTP/2 mit handgeschriebenen Nachrichten, sodass das Binary keine gRPC-Bibliothek aufgenommen hat.

**Eine MQTT-Ausgabe, die nichts verliert.** `mqtt out` veröffentlicht über den Broker, den die Flow-Datei konfiguriert, dieselbe Verbindung, die die MQTT-Knoten nutzen. Markieren Sie sie als dauerhaft, und eine Nachricht, die der Broker verpasst, wird auf die Platte geschrieben, bevor der Knoten fertig ist, und gesendet, die älteste zuerst, sobald der Broker wieder da ist, auch über einen Neustart hinweg. Nichts überholt etwas, das vor ihm wartet. Ihre Ausgabe für Gesendetes sagt, ob die Nachricht direkt hinausging.

**Ein TDMS-Log.** `log to TDMS file` hängt einen Datensatz an eine TDMS-Datei an, ein Kanal pro Feld, und die Datei öffnet sich in den Werkzeugen, die ein Labor schon hat. Eine Datei, deren letzter Schreibvorgang durch einen Stromausfall abgebrochen wurde, lässt sich weiterhin bis zum letzten vollständigen Wert lesen.

## Was sich geändert hat

- Es gibt jetzt 28 Knotentypen im FlowLab-Bereich der Palette, vorher 21, und das README sagt es.
- Ein Schritt, der im Lauf von 2.7.1 einmal fehlschlug, druckte nichts, und die Ursache war der Collector-Test, der eine Zeitspanne verglich, bevor das Log, das er liest, sie vollständig enthielt; er wartet jetzt auf die ganze Spanne. Zwei weitere Tests wurden dazu gebracht, auf das zu warten, was sie prüfen. Nichts davon wird ausgeliefert.
- Die Bilder im README wurden neu aufgenommen, damit die obere Leiste v2.8.0 zeigt.
- Die Größen von Binärdatei und Image im README wurden für diese Version neu ermittelt.

## Neue Einstellungen

Keine.

## Upgrade

Auf amd64 ein einfaches `helm upgrade` auf das Image und Chart 2.8.0, oder das neue Tag in Ihrer Quadlet-Unit. Auf arm64 bleiben Sie, wo Sie sind, bis 2.8.1, das diese Version mit arm64 und sonst nichts ist. Beim ersten Start passiert nichts, und es muss nichts migriert werden.

Image: `ghcr.io/hotloop-io/hotloop-flow:2.8.0`, nur linux/amd64. Wir bauen zuerst amd64, lassen es in der Produktion als stabil gelten, und dann fügt eine kleine 2.8.1 ohne sonst etwas arm64 hinzu. Bis dahin hält das Tag `2` das neue amd64-Image und das arm64-Image von 2.7.1, sodass eine Maschine auf arm64, die `2` oder `2.7` folgt, behält, was sie hat, und eine auf `2.8.0` festgelegte Maschine amd64 braucht. Chart: `https://hotloop.io/hotloop-flow/`. Die README zu diesem Tag hat den Rest, mit Bildern: https://github.com/HotLoop-io/hotloop-flow/blob/v2.8.0/README.md
