---
title: "Was ausgeführt wurde"
description: "Womit die Bibliothek gebaut, worauf sie ausgeführt und wodurch sie zurückgelesen wurde, und die eine Stelle, an der zwei Leser abweichen."
---

Diese Seite beschreibt den Lauf von 1.0.0. Der Lauf von 1.1.0 mit Zeitstempeln und dem `.package` steht in den [Versionshinweisen zu 1.1.0](/de/releases/transmitter-1-1-0/). Die Bibliothek ist seitdem auf Bare Metal gelaufen (2026-11-17).

## Der Build

* Bibliothek: lässt sich im ScriptEngine von CODESYS 3.5.22.30 (SP22 Patch 3) mit 0 Fehlern und 0 Warnungen kompilieren.
* Beispielanwendung, gegen die installierte Bibliothek gebaut, für das Gerät CODESYS Control for Linux SL (4102, 0000 0005, 4.20.0.0): 0 Fehler, 0 Warnungen, bereit zum Download.

## Die Runtime

CODESYS Control for Linux SL 4.22.0.0 lädt die Anwendung als Bootprojekt und meldet `Application started`, `CODESYS Control ready`. Sie läuft im Demomodus, weil es keine Runtime-Lizenz gibt.

## Was über die Leitung ging und wer es gelesen hat

Die Beispielanwendung hat zwei Publisher: Writer Group 1 und Dataset Writer 1 in der Variant-Kodierung (1142 Byte) sowie Writer Group 2 und Dataset Writer 2 in der RawData-Kodierung (1144 Byte). Je siebzehn Felder: eines von jedem Typ, den die Bibliothek unterstützt, ein REAL-Array mit 250 Elementen, ein INT-Array mit 4 Elementen und zwei Zähler.

Vier unabhängige Leser haben es gelesen.

| Leser | Was es ist | Variant | RawData |
|---|---|---|---|
| Ein Decoder, aus der Spezifikation geschrieben | allein aus OPC 10000-14 und 10000-6 geschrieben, der dieselben Variablen auch vom OPC-UA-Server der Runtime liest und vergleicht | jedes Feld gleich dem der SPS, keine Lücke in den Sequenznummern von NetworkMessage und DataSetMessage über den Mitschnitt | dasselbe |
| Ein unabhängiger OPC-UA-PubSub-Stack | ein Subscriber mit DataSet-Metadaten der 17 Felder | alle 15 geprüften Werte gleich, einschließlich String, beider Arrays und TIME | die 11 numerischen Skalare gleich. Dieser Stack liest weder RawData-Strings beliebiger Länge noch RawData-Arrays |
| Der UADP-Subscriber von HotLoop core | der Treiber in HotLoop core 4.19.4 und jedem späteren Release, gegen eine laufende Runtime ausgeführt, mit dem RawData-Layout in seinen DataSet-Typen | 21 Werte als gleich geprüft, einschließlich String, TIME und der Elemente 0, 1, 124 und 249 des 250-elementigen REAL-Arrays sowie aller vier des INT-Arrays, und beide Zähler laufen zwischen zwei Lesungen im Abstand von 3 Sekunden weiter | dieselben 21 Werte und dieselben zwei Zähler. 62 Key Frames empfangen, keiner abgelehnt |
| Ein zweiter Decoder | der UADP-Decoder in unserem eigenen Empfängercode, auf 222 mitgeschnittenen Datagrammen mit dem Layout der 17 Felder ausgeführt | alle 111 Nachrichten dekodiert, jeder geprüfte Wert korrekt | alle 111 Nachrichten dekodiert, jeder geprüfte Wert korrekt, die Arrays mit ihrer Int32-Länge und dem Padding |

## RawData-Arrays und -Strings

Diese Bibliothek schreibt vor jedes RawData-Array eine Int32-Elementzahl und einen String als Int32-Länge, seine Bytes und danach Nullbytes bis MaxStringLength. Das macht der Referenzstack der OPC Foundation, und es folgt dem Text der Spezifikation: OPC 10000-14 7.2.4.5.11 ("handled like a Structure DataType", Padding "to the maximum size indicated by ArrayDimensions or MaxStringLength") mit OPC 10000-6 5.2.5 ("One dimensional Arrays are encoded as a sequence of elements preceded by the number of elements encoded as an Int32 value").

Der Subscriber von HotLoop core und der zweite Decoder lesen die RawData-Arrays beide auf diese Weise, mit Länge und Padding, und beide dekodieren das RawData dieser Bibliothek.

Ein Unterschied zum Referenzstack: Wo dieser eine Ausnahme wirft, wenn ein String länger als MaxStringLength ist, schneidet diese Bibliothek ihn an einer Zeichengrenze ab, weil eine SPS-Task nichts hat, wohin sie werfen könnte.

## Was Sie wissen sollten

* Der Lauf fand auf CODESYS Control for Linux SL 4.22.0.0 unter x86-64 statt. Die Bibliothek ist Structured Text, und die Behandlung der Byte-Reihenfolge für ein Big-Endian-Ziel ist geschrieben, Sie prüfen sie aber auf Ihrer eigenen Steuerung.
* Multicast: Der Baustein setzt TTL, Loopback und Sendeschnittstelle für eine Multicast-Gruppe. Prüfen Sie die Gruppe in Ihrem eigenen Netz.
* Der Baustein zählt Sendefehler und wartet ab, wenn das Netz wegfällt oder eine Adresse nicht da ist, und das Programm scannt weiter.
* Im Demomodus hält die Runtime am Ende ihres Zwei-Stunden-Fensters an, wie CODESYS es angibt.
