---
title: "Roadmap von Transmitter"
description: "Was HotLoop Transmitter schon kann, was als Nächstes kommt und was bewusst nicht geplant ist."
---

Was heute im Paket steckt, was als Nächstes kommt und was bewusst nicht geplant ist. Eine Zeile rückt erst unter „Ausgeliefert“, wenn sie auf der echten Runtime 4.22.0.0 gelaufen ist und ein Empfänger sie gelesen hat.

## Ausgeliefert in 1.3.0

* Zeitstempel auf die Millisekunde genau, aus der hochauflösenden Zeit der Uhr. `bHighResTimestamp` schaltet auf ganze Sekunden zurück.
* WSTRING-Felder, als UTF-8 in Variant und RawData gesendet (`AddWString`).
* Ein Status je Feld, damit ein ungültiger Wert als Bad gesendet wird (`SetStatus`).
* Mehrere DataSetMessages in einer NetworkMessage, mit dem Sizes-Array, sodass ein Datagramm mehr als einen Writer tragen kann (`AddDataSet`).
* Data Delta Frames und KeepAlive-Nachrichten, um die Bytes eines weitgehend gleichbleibenden Datensatzes zu senken. Eine Einstellung, `bDeltaFrames`, standardmäßig aus.

## Ausgeliefert in 1.2.0

* HotLoop Alarms (`alarms/`), eine Bibliothek, die die aktiven, wartenden und quittierten Alarme des CODESYS-Alarmmanagers in einfache Variablen liest und die Quittierung ausführt, die HotLoop zurückschreibt. Sie lief auf der echten Runtime 4.22.0.0, und die Alarmliste von HotLoop hat sie gelesen.

## Ausgeliefert in 1.1.0

* Zeitstempel in DataSetMessage und NetworkMessage aus der Echtzeituhr der SPS, standardmäßig an; `bTimestamp` schaltet sie ab.
* Die Bibliothek als CODESYS-`.package`, installiert über den CODESYS Installer.

## Ausgeliefert in 1.0.0

* Ein Publisher-Baustein, `FB_HLTX_Publisher`: eine NetworkMessage pro Veröffentlichungsintervall, eine DataSetMessage, ein Data Key Frame, UADP über UDP, aus Structured Text über SysSocket.
* Die Feldkodierungen Variant und RawData.
* Felder vom Typ BOOL, SINT, USINT, INT, UINT, DINT, UDINT, LINT, ULINT, REAL, LREAL, STRING und TIME sowie Arrays von allen außer STRING, in beiden Kodierungen.
* Unicast- und Multicast-Ziele, Publisher-ID, Writer-Group-ID, DataSetWriter-ID, Veröffentlichungsintervall, Gruppenversion und Konfigurationsversion, alle als Eingänge des Bausteins einstellbar.
* Ein nicht blockierendes Senden, begrenzte Kosten pro Aufruf, Zähler für gesendet, abgelehnt und übersprungen und ein Fehlerzustand, der die Anwendung nie ausfallen lässt.

## Nicht geplant

* Nachrichtensicherheit (Signieren und Verschlüsseln). Der Baustein sendet im Klartext, in einem Netz, dem das Werk bereits vertraut.
* Segmentierte NetworkMessages. Eine Nachricht, die nicht in einen 1500-Byte-Frame passt, wird abgelehnt, nicht zerteilt.
* Die Subscriber-Seite. HotLoop core abonniert UADP; diese Bibliothek veröffentlicht.
* MQTT-Transport. UDP ist das, was eine CODESYS-Runtime ohne weitere Bibliotheken erreicht.
