---
title: "Versionshinweise: HotLoop Transmitter 1.0.0"
description: "Die erste Version von HotLoop Transmitter: eine CODESYS-Bibliothek, die SPS-Werte als OPC UA PubSub veröffentlicht, was sie enthält, was lief und was nicht."
---

Erste Version. Eine CODESYS-Bibliothek, in Structured Text über das UDP von SysSocket geschrieben, die die Werte Ihrer SPS als OPC UA PubSub (Teil 14, UADP) ins Netz bringt. Sie fügen die Bibliothek hinzu, deklarieren einen Funktionsbaustein, fügen die Variablen hinzu, die hinaus sollen, und rufen ihn einmal pro Zyklus auf. Alles, was OPC UA PubSub abonniert, kann es lesen, HotLoop core eingeschlossen, ab 4.19.4.

Was das für Sie bedeutet: Eine SPS ohne PubSub-Bibliothek kann jetzt mit etwa fünfzehn Zeilen Structured Text einen PubSub-Abonnenten versorgen, und auf der Steuerung wird nichts weiter installiert.

## Was enthalten ist

* Ein Baustein, `HLTX.FB_HLTX_Publisher`. Eine NetworkMessage pro Veröffentlichungsintervall, eine DataSetMessage, ein Data Key Frame, sodass jede Nachricht alle Felder enthält.
* Variant- und RawData-Feldkodierungen, pro Publisher gewählt. Variant trägt seine eigenen Typen. RawData trägt keine, deshalb muss dem Empfänger das Layout mitgeteilt werden, das die [Seite zum Leitungsformat](/de/transmitter/wire-format/) Byte für Byte beschreibt.
* Felder vom Typ BOOL, SINT, USINT, INT, UINT, DINT, UDINT, LINT, ULINT, REAL, LREAL, STRING und TIME sowie Arrays all dieser Typen außer STRING, bis zu 128 Felder und 1472 Byte pro Nachricht. Eine Nachricht wird nie fragmentiert.
* Unicast oder Multicast, mit Publisher-ID, Writer-Group-ID, Dataset-Writer-ID, Veröffentlichungsintervall, Gruppenversion und Konfigurationsversion als Eingängen.
* Ein nicht blockierendes Senden. Eine falsche Adresse, ein toter Socket oder eine zu große Feldliste versetzen den Baustein in einen Fehlerzustand, den Sie auslesen können, und lassen Ihre Anwendung nie ausfallen.

## Was wir ausgeführt haben und was es zeigte

Alles gegen CODESYS Control for Linux SL 4.22.0.0, mit den Dateien unten.

* Die Bibliothek baut mit 0 Fehlern und 0 Warnungen in CODESYS 3.5.22.30. Die Beispielanwendung baut dagegen mit 0 Fehlern und 0 Warnungen.
* Zwei Publisher, einer mit Variant und einer mit RawData, mit je siebzehn Feldern. Jeder Wert auf der Leitung entspricht dem, was die SPS über ihren eigenen OPC-UA-Server meldet, ohne Lücke in den Sequenznummern.
* Ein unabhängiger PubSub-Stack dekodiert die Variant-Nachricht vollständig und die RawData-Skalare. Ein RawData-Array oder einen langen RawData-String kann er gar nicht lesen, was seine Grenze ist und nicht die der Bibliothek.
* Der Subscriber von HotLoop core (aus seinem main-Zweig zur Zeit dieses Laufs, und in HotLoop core 4.19.4 und jeder Version danach) liest beide Publisher, darunter den String, den TIME, beide Arrays und zwei Zähler, die sich zwischen den Lesevorgängen ändern, und weist nichts zurück.
* Ein zweiter Dekoder liest alle 222 aufgezeichneten Datagramme.
* Kosten bei einem 20-ms-Task mit zwei Publishern: im Mittel etwa 10,6 us zusätzlich pro Zyklus. Ein Zyklus, der sendet, kostet 10 bis 100 us. Der Ausreißer ist der `sendto`-Aufruf, und auf einem ausgelasteten gemeinsamen Host erreichte er einmal in 12 000 Zyklen 14,3 ms. Legen Sie den Publisher in einen eigenen Task mit niedrigerer Priorität, wenn das für Ihre Steuerlogik zählt. Die [Zeitseite](/de/transmitter/timing/) hat die Tabelle.

## Was Sie auf Ihrer Steuerung prüfen sollten

* Die Behandlung der Byte-Reihenfolge für ein Big-Endian-Ziel ist geschrieben, prüfen Sie sie also auf Ihrer eigenen Steuerung.
* Multicast: Der Baustein setzt TTL, Loopback und Sendeschnittstelle für die Gruppe, prüfen Sie die Gruppe also in Ihrem eigenen Netz.
* Wenn das Netz wegfällt oder eine Adresse fehlt, zählt der Baustein den Fehler und wartet länger, und das Programm läuft weiter im Scan.
* Im Demomodus hält die Runtime am Ende ihres Zwei-Stunden-Fensters an, wie CODESYS es sagt.

## Nicht in dieser Version

Zeitstempel in DataSetMessage und NetworkMessage, KeepAlive und Delta Frames, mehr als eine DataSetMessage pro NetworkMessage, WSTRING, ein Status pro Feld, Nachrichtensicherheit und die Subscriber-Seite. Die [Roadmap](/de/transmitter/roadmap/) sagt, was als Nächstes kommt.

## Wenn Sie von einem anderen Publisher kommen

Ein Empfänger, der auf einem Zeitstempel, einem KeepAlive oder einem Delta Frame besteht, wird mit dieser Version nicht zufrieden sein, denn keines davon wird gesendet. Jede Nachricht ist ein Key Frame, den jeder Empfänger ohne Vorwissen lesen kann. Ein RawData-Array besteht hier aus einer Int32-Länge, den Elementen und Nullen als Auffüllung bis zur deklarierten Größe, so wie es der Referenz-Stack der OPC Foundation schreibt. Einem Empfänger, der ein Array als lückenlos aneinandergereihte Elemente ohne Länge erwartet, muss gesagt werden, dass die Felder einzelne Skalare sind.

## Für ein Projekt, das sie schon nutzt

Es gibt keine frühere Version. Das Leitungsformat ändert sich nur, wenn sich `udiConfigMajor` ändert, und ein SPS-Projekt, das an diese Bibliotheksversion gebunden ist, behält dieselben Felder und Bytes.

## Dateien

Laden Sie beide Dateien und `SHA256SUMS` von https://hotloop.io/hotloop-transmitter/1.0.0/HotLoopTransmitter-1.0.0.library herunter und installieren Sie dann `HotLoopTransmitter-1.0.0.library` über Extras, Bibliotheksverwaltung, Installieren in CODESYS 3.5 SP22 oder neuer. Die `.compiled-library` ist dieselbe Bibliothek ohne ihren Quelltext.

```
91b8023a73870925082c170588feb43d363e6d07ce008e1471fa8f5ff8db2c0d  HotLoopTransmitter-1.0.0.library
b02b0b40e434f35e4af1def20d6cc38688463537c4800354931b8c6094a66686  HotLoopTransmitter-1.0.0.compiled-library
```
