---
title: "Versionshinweise: HotLoop Transmitter 1.2.0"
description: "HotLoop Alarms kommt zur Version dazu: eine Bibliothek, die die eigenen Alarme einer SPS dorthin bringt, wo HotLoop sie liest. Der Publisher bleibt gleich."
---

Diese Version fügt HotLoop Alarms hinzu, eine zweite Bibliothek, die die eigenen Alarme Ihrer SPS dorthin bringt, wo HotLoop sie liest, und liefert den Transmitter als 1.2.0.0 mit demselben Publisher wie in 1.1.0.

Was das für Sie bedeutet: Die Alarme, die Ihr CODESYS-Projekt schon auslöst, erscheinen in der Alarmliste von HotLoop, und eine Quittierung in HotLoop quittiert sie in der SPS. Wenn Sie nur den Publisher nutzen, gibt es nichts zu ändern.

## Was sich für ein Projekt mit 1.1.0 ändert

* **HotLoop Alarms 1.0.0.0, neu.** `HotLoopAlarms-1.0.0.0.library` und `.compiled-library` liegen der Version bei. Der Baustein `HLAL.FB_HLAL_Alarms` ist ein Client des CODESYS-Alarmmanagers. Einmal pro Zyklus aufgerufen, kopiert er die aktiven, wartenden und quittierten Alarme in eine Tabelle einfacher Variablen (`aAlarms`, 64 Zeilen), die der OPC-UA-Server der Runtime wie jede andere Variable exportiert. `udiChanges` zählt hoch, wenn sich die Tabelle geändert hat, und `uiDropped` zählt die aktiven Alarme, die nicht hineinpassten, statt sie stillschweigend zu verlieren. Er braucht keine generierte Alarm-Connector-Bibliothek, nur die eigene Alarm Configuration des Projekts.
* **Die Quittierung kommt zurück.** Ein Schreiben der Befehlsvariablen (`uiAckGroupId`, `uiAckAlarmId`, `udiAckInternalId` oder `bAckAll`, dann eine neue Zahl in `udiAckRequest`) lässt den Baustein diesen Alarm oder alle über den Alarmmanager quittieren. HotLoop 4.23.6 und später findet den Baustein an dem, was er enthält, und erledigt all das für Sie.
* **Der Transmitter-Publisher hat sich nicht geändert.** Die Feldliste und das Leitungsformat haben sich nicht bewegt, und `bTimestamp` funktioniert wie zuvor. Die Bibliothek wird als 1.2.0.0 neu gebaut, und das `.package` enthält sie.
* **Die Lizenz ist die HotLoop Source License Agreement 1.0,** dieselbe wie bei jedem HotLoop-Produkt.

## Was ich ausgeführt habe und was es zeigte

Alles im Labor, gegen CODESYS Control for Linux SL 4.22.0.0 in einem Container.

* Die Transmitter-Bibliothek baut mit 0 Fehlern und 0 Warnungen in CODESYS 3.5.22.30, und ebenso die dagegen gebauten Beispielanwendungen.
* Das Labor: zwei Publisher, Variant und RawData, je 114 Nachrichten dekodiert, jeder Wert gleich dem, was die SPS über ihren eigenen OPC-UA-Server meldet, keine Lücke in den Sequenznummern, beide Zeitstempel in jeder Nachricht, und die Bytes von 1.0.0 mit `bTimestamp := FALSE`. Eine unabhängige OPC-UA-PubSub-Implementierung liest die Werte und die Zeitstempel jeder Nachricht. 128 Prüfungen bestanden, keine schlug fehl.
* Der UADP-Subscriber von HotLoop core liest beide Publisher gegen eine laufende Runtime: jeder Wert gleich, beide Zähler laufen, 62 Key Frames empfangen und keiner abgewiesen.
* Das `.package` installiert sich mit `PackageManagerCLI --install`, die Bibliothek erscheint im System-Repository, und das Beispiel baut dagegen mit 0 Fehlern und 0 Warnungen.
* HotLoop Alarms: gegen eine echte Runtime mit einer Alarm Configuration aus zwei Alarmen: Ein Auslösen in der SPS zeigt sich in HotLoop, eine Quittierung in HotLoop setzt die Tabelle der SPS auf quittiert mit der Zeit, ein Zurücksetzen setzt sie auf wartet auf Bestätigung, und eine Bestätigung in HotLoop leert die Tabelle der SPS. Der zweite Alarm geht in der anderen Reihenfolge, und Alle quittieren quittierte beide aktiven Alarme.
* Kosten des Publishers bei einem 20-ms-Task, zwei Publisher, an vier Kerne gebunden: im Mittel etwa 15 us zusätzlich pro Zyklus und der längste Zyklus 144 us, ohne übersprungenen Veröffentlichungsslot und ohne abgewiesenes Senden. Eine in derselben Stunde neu gebaute 1.1.0-Bibliothek maß 15,2 us und 261 us.

## Was ich nicht ausgeführt habe

* Keine physische Steuerung, keine CODESYS-Runtime außer Control for Linux SL 4.22.0.0 und keine andere CPU als x86-64.
* HotLoop Alarms mit einer anderen Alarmklasse als der, die quittiert und eine Bestätigung verlangt, oder mit mehr als 64 gleichzeitig aktiven Alarmen.
* Das `.package` im Fenster des CODESYS Installers. Es wurde ohne Oberfläche mit PackageManagerCLI installiert.
* Eine Steuerung, deren Echtzeituhr nicht gestellt oder falsch ist, Multicast, eine Runtime, die ihr Netz verliert und wiedererlangt, und das Ende des Zwei-Stunden-Demofensters.

## Nicht in dieser Version

KeepAlive und Delta Frames, mehr als eine DataSetMessage pro NetworkMessage, WSTRING, ein Status pro Feld, Zeitstempel unterhalb einer Sekunde, Nachrichtensicherheit und die Subscriber-Seite. Die [Roadmap](/de/transmitter/roadmap/) sagt, was als Nächstes kommt.

## Zurückgehen

Ein SPS-Projekt, das an 1.1.0 gebunden ist, läuft weiter und sendet dieselben Bytes. HotLoop Alarms ist eine eigene Bibliothek: Ein Projekt, das sie nicht hinzufügt, bleibt unberührt.

## Dateien

Laden Sie sie von https://hotloop.io/hotloop-transmitter/1.2.0/HotLoopTransmitter-1.2.0.library herunter und prüfen Sie sie mit `SHA256SUMS` im selben Ordner.

```
e68cfc88e599ddcf278eb208ff500f4f78d3faf74edf12e38f308a009f478594  HotLoopAlarms-1.0.0.0.compiled-library
68f704fc5662bbc67ec097016a741065d705af01913a2746296c17f9e6991118  HotLoopAlarms-1.0.0.0.library
a404f20fc35c4a3d804aa194f29def3f8193e26e696357899d3ae5b3d44948c1  HotLoopTransmitter-1.2.0.compiled-library
05200d0279ac120fd69d2dc3eeba99d9b40cb76eba2d15d1431b94c5e8f3fc32  HotLoopTransmitter-1.2.0.library
d6b6606a5919e18d2d6d31a5529af4d76bc7058003fb26032ec1a578f78ea57d  HotLoopTransmitter-1.2.0.package
```
