---
title: "Versionshinweise: HotLoop core 4.22.0"
description: "Was HotLoop core 4.22.0 bringt, was sich beim Update ändert und was Sie lesen sollten, bevor Sie eine laufende Anlage anfassen."
sidebar:
  label: "4.22.0"
---

Ein als Panel geöffneter Bildschirm (`/?screen=<name>`) füllt seine Anzeige jetzt in jeder Größe von Rand zu Rand, der Bildschirm Alarms kann eine CODESYS-Alarmdatei importieren, und eine Handvoll Korrekturen. Nur für amd64 gebaut; der Multi-Arch-Build folgt als nächste Version.

## Was sich geändert hat

- **Eine Panel-Seite füllt ihren Bildschirm.** Bei 1920x1080, 1366x768 und 3840x2160 deckt sie die Anzeige ohne toten Raum ab. Sie hat eine Kopfzeile mit dem Namen der Anlage, einen Live-Status mit der Zahl der Geräte online und eine 24-Stunden-Uhr mit Datum. Zahlen und Anzeigen wachsen mit dem Bildschirm, ebenso die Achse und die Legende des Trends. Nur die Panel-Seite ändert sich; die Dashboards sind wie sie waren, und die Karten, Größen und Namen eines Kunden gehören ihm.
- **Der Bildschirm Alarms importiert eine CODESYS-Export-Alarms-Datei.** Nur für Admins: Gerät wählen, Anwendung benennen, Datei wählen, die Vorschau lesen, was übernommen wird und was nicht, dann importieren. Die API-Route gab es schon.
- **OPC-UA-PubSub-Geräte auf derselben Adresse und demselben Port teilen sich einen Socket.** Das zweite Gerät konnte nie binden, und die Wiederverwendungsoptionen verteilten die Datagramme eines Publishers auf beide.
- **Langsame Antworten stauen sich nicht mehr.** Eine Kamerakarte, die langsamer ist als ihre Aktualisierung, zeigt jetzt ihr Bild, die Karten und der UniFi-Bildschirm fragen erst nach der letzten Antwort erneut, ein Discovery-Batch, der einmal fehlschlug, wird wiederholt, und ein SNMP-Gerät mit Hostnamen behält sein eigenes Warten auf die Antwort.
- **Die Core-Produkte stehen unter der HotLoop Free Use License 1.0.** Frühere Versionen behalten die Bedingungen, unter denen sie veröffentlicht wurden. Siehe NOTICE.
- **Das App-Store-Icon** auf den Chart-Seiten ist das HotLoop-Markenzeichen.

## API-Änderungen

Keine.

## Update von 4.21.1

Ein normales `helm upgrade`. Keine Migration, kein neues Secret, nichts, was sich nicht zurückrollen lässt.

## Getestet

Die Panel-Seite wurde im Test in den drei obigen Größen geprüft, mit Emberburn, das ein Gateway speiste.
