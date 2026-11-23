---
title: "Versionshinweise: HotLoop Transmitter 1.1.0"
description: "Jede Nachricht trägt einen Zeitstempel der SPS-Uhr, und die Bibliothek wird aus einem CODESYS-Paket installiert: was sich änderte, was lief und was nicht."
---

Jede Nachricht trägt jetzt einen Zeitstempel der SPS-Uhr, und die Bibliothek wird jetzt aus einem CODESYS-`.package` installiert.

Was das für Sie bedeutet: Ein Abonnent, der wissen will, wann ein Wert abgetastet wurde, bekommt es aus dem Paket, statt es aus dem Eintreffen zu raten, und Sie können die Bibliothek wie jedes andere Add-on mit dem CODESYS Installer installieren.

## Was sich für ein Projekt mit 1.0.0 ändert

* **Zeitstempel, standardmäßig an.** NetworkMessage und DataSetMessage tragen je einen Timestamp (Teil 14, 7.2.4.4.2 und 7.2.4.5.4), denselben DateTime, einmal pro Nachricht von der Echtzeituhr der SPS gelesen. ExtendedFlags1 geht von `01` auf `21`, DataSetFlags1 von `69` oder `6B` auf `E9` oder `EB`, und ein DataSetFlags2-Byte `10` kommt hinzu. Eine Nachricht ist 17 Byte länger. Die Feldliste und die Werte haben sich nicht verändert, und `udiConfigMajor` ist dasselbe.
* **`bTimestamp := FALSE` sendet genau die Bytes von 1.0.0.** Setzen Sie das fest, wenn einer Ihrer Empfänger Zeitstempel ablehnt. Es wurde geprüft: Nachrichten mit 1142 und 1144 Byte, keine mit Zeitstempel, die Größen, die 1.0.0 sendete.
* **Die Auflösung ist eine Sekunde.** Die Uhr wird mit `SysTimeRtcGet` gelesen, das ganze Sekunden liefert, daher sieht ein Empfänger innerhalb einer Sekunde auf jeder Nachricht denselben Zeitstempel, und er kann bis zu einer Sekunde hinter dem Augenblick liegen, in dem die Nachricht gebaut wurde. Zeitstempel unterhalb einer Sekunde stehen auf der Roadmap.
* **Ein neuer Ausgang, `diLastClockResult`.** Kann die Uhr nicht gelesen werden, geht die Nachricht ohne Zeitstempel hinaus, was Teil 14 erlaubt, und dieser Ausgang sagt warum.
* **Eine neue Systembibliothek, SysTimeRtc.** Die Bibliothek nennt sie als Platzhalter, wie SysSocket, und die Runtime stellt sie bereit. Control for Linux SL 4.22.0.0 tut das. Ein Ziel ohne sie kann 1.1.0 nicht mit Zeitstempeln nutzen; bleiben Sie bei 1.0.0.
* **Das `.package`.** `HotLoopTransmitter-1.1.0.package` wurde vom eigenen PackageManagerCLI von CODESYS erzeugt und legt dieselbe Bibliothek über den Installer in das Bibliotheks-Repository. Siehe die [Installationsseite](/de/transmitter/install/).

## Was wir ausgeführt haben und was es zeigte

Alles gegen CODESYS Control for Linux SL 4.22.0.0, mit den Dateien unten.

* Die Bibliothek baut mit 0 Fehlern und 0 Warnungen in CODESYS 3.5.22.30. Die Beispielanwendung baut dagegen mit 0 Fehlern und 0 Warnungen.
* Zwei Publisher, Variant und RawData, mit Zeitstempeln. Ein unabhängiger, nach der Spezifikation geschriebener Dekoder dekodiert jede Nachricht, und jeder Wert entspricht dem, was die SPS über ihren eigenen OPC-UA-Server meldet. Jede Nachricht hat beide Zeitstempel, sie sind derselbe Zeitpunkt, laufen nie rückwärts, liegen innerhalb der Ganzsekunden-Toleranz der Uhr, auf der die Aufzeichnung lief, und über eine 11-Sekunden-Aufzeichnung wanderte der Stempel um 11 Sekunden. Der Container teilt die Uhr des Hosts, das zeigt also, dass der Stempel die Ablesung der SPS-Uhr ist und kein erfundener; es testet keine Steuerung mit falscher Uhr.
* Ein unabhängiger PubSub-Stack liest den Timestamp von NetworkMessage und DataSetMessage aller 113 Nachrichten jedes Writers mit eigenen Header-Dekodern und dekodiert die Werte wie bei 1.0.0.
* Der Subscriber von HotLoop core (aus seinem main-Zweig zur Zeit dieses Laufs, und in HotLoop core 4.19.4 und jeder Version danach) liest beide Publisher gegen eine laufende Runtime: je 21 Werte, beide Zähler laufen, nichts abgewiesen. Jede Lesung trägt den Ganzsekunden-Zeitstempel des Publishers als ihre Zeit, und der Stempel wanderte bei einer Wartezeit von 3 Sekunden mit der SPS-Uhr.
* Das `.package` installiert sich mit `PackageManagerCLI --install`, die Bibliothek erscheint im System-Repository (vorher war sie nicht da), und das Beispiel baut gegen die Bibliothek, wie der Installer sie dort ablegte, mit 0 Fehlern und 0 Warnungen.
* Kosten bei einem 20-ms-Task mit zwei Publishern: im Mittel etwa 9,6 us zusätzlich pro Zyklus, 10 bis 100 us in den Zyklen, die senden, und der längste Zyklus des Laufs 81 us. In diesem Lauf wurden drei Veröffentlichungsslots übersprungen, und kein Senden wurde abgewiesen. Der Zeitstempel selbst ist in den Zahlen nicht sichtbar. Die [Zeitseite](/de/transmitter/timing/) hat die Tabelle.

## Was Sie auf Ihrer Steuerung prüfen sollten

* Die Behandlung der Byte-Reihenfolge für ein Big-Endian-Ziel ist geschrieben, prüfen Sie sie also auf Ihrer eigenen Steuerung.
* Multicast: Der Baustein setzt TTL, Loopback und Sendeschnittstelle für die Gruppe, prüfen Sie die Gruppe also in Ihrem eigenen Netz.
* Wenn das Netz wegfällt oder eine Adresse fehlt, zählt der Baustein den Fehler und wartet länger, und das Programm läuft weiter im Scan.
* Im Demomodus hält die Runtime am Ende ihres Zwei-Stunden-Fensters an, wie CODESYS es sagt.
* Eine Steuerung, deren Echtzeituhr nicht gestellt oder falsch ist, stempelt, was die Uhr sagt.

## Nicht in dieser Version

KeepAlive und Delta Frames, mehr als eine DataSetMessage pro NetworkMessage, WSTRING, ein Status pro Feld, Zeitstempel unterhalb einer Sekunde, Nachrichtensicherheit und die Subscriber-Seite. Die [Roadmap](/de/transmitter/roadmap/) sagt, was als Nächstes kommt.

## Zurückgehen

Ein SPS-Projekt, das an 1.0.0 gebunden ist, läuft weiter und sendet weiter die Bytes von 1.0.0. In 1.1.0 liefert `bTimestamp := FALSE` dieselben Bytes.

## Dateien

Laden Sie sie von https://hotloop.io/hotloop-transmitter/1.1.0/ herunter und prüfen Sie sie mit `SHA256SUMS` im selben Ordner.

```
5ec021b23f5d57460016834a03b2b196d6dbc83aeb5d0ad60ace8d7b4fbbb4a7  HotLoopTransmitter-1.1.0.library
e172f4674f6cbfce2aeaf017d5a6c733245b1b9aa3e527369c753bf07b6ce0c2  HotLoopTransmitter-1.1.0.compiled-library
b3686bdebd052f1ddea46d1f1ff409f3b6c9a016ca5f3e8f4cd6f7922ccb479c  HotLoopTransmitter-1.1.0.package
```
