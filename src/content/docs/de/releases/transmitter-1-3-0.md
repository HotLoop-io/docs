---
title: "Versionshinweise: HotLoop Transmitter 1.3.0"
description: "Zeitstempel auf die Millisekunde, WSTRING-Felder, Status je Feld, mehrere DataSets in einer NetworkMessage und Delta Frames mit KeepAlive, standardmäßig aus."
---

HotLoop Transmitter bringt die Werte Ihrer SPS als OPC UA PubSub ins Netzwerk, aus einer Bibliothek, die Sie in das CODESYS-Projekt einbinden. 1.3.0 bringt Zeitstempel auf die Millisekunde, WSTRING-Felder, einen Status je Feld, damit ein schlechter Wert als schlecht hinausgeht, mehrere DataSets in einer NetworkMessage und Data Delta Frames mit KeepAlive-Nachrichten. Es ist die Bibliothek 1.3.0.0, und HotLoop Alarms 1.0.0.0 liegt unverändert bei.

Was das für Sie bedeutet: Ein SPS-Projekt, das bereits 1.2.0 nutzt, sendet dieselben Bytes wie zuvor, mit einem sichtbaren Unterschied, der Zeitstempel hat jetzt Millisekunden. Alles andere schalten Sie mit einem Aufruf oder einem Eingang ein.

## Neu

* **Zeitstempel auf die Millisekunde.** NetworkMessage und DataSetMessage tragen die Millisekunden der Uhr, sodass ein Subscriber sieht, wann jede Nachricht gebaut wurde, statt der Sekunde, in die sie fiel. `bStampHighRes` sagt, welche Uhr die letzte Nachricht benutzte.
* **WSTRING-Felder.** `AddWString(ADR(wName), N)` veröffentlicht einen `WSTRING(N)` als OPC-UA-String, in Variant und in RawData. Der Text geht als UTF-8 hinaus: Ein Zeichen oberhalb von U+FFFF, in der SPS ein Ersatzpaar, geht als ein Vier-Byte-Zeichen hinaus, und ein einzelnes Ersatzzeichen als U+FFFD, sodass ein Subscriber stets gültigen Text liest. In RawData ist das MaxStringLength des Felds `3 * N` Bytes.
* **Ein Status je Feld.** Nach dem Hinzufügen eines Felds bindet `SetStatus(ADR(udiStatus))` es an einen UDINT mit einem OPC-UA-StatusCode. Solange diese Variable nicht 0 ist, geht das Feld als StatusCode statt seines Werts hinaus, und ein Subscriber liest es als schlechte Qualität. Setzen Sie sie auf 0 zurück, geht wieder der Wert hinaus. Ein RawData-Publisher sendet weiter den Wert, weil RawData keinen Status tragen kann.
* **Mehrere DataSets in einer NetworkMessage.** `AddDataSet(uiWriterId, udiConfigMajor)` beginnt ein weiteres DataSet im selben Baustein: Die danach hinzugefügten Felder gehören dazu. In jedem Veröffentlichungsintervall trägt eine NetworkMessage eine DataSetMessage je DataSet, mit dem Sizes-Array, das Teil 14 verlangt, sodass mehr als ein Writer ein Datagramm teilt. Bis zu 8 DataSets. Rufen Sie es nie auf, ist die Nachricht die, die 1.2.0 sendete.
* **Data Delta Frames und KeepAlive.** Ein gleichbleibender Datensatz muss nicht mehr jedes Feld in jedem Intervall senden. Bei eingeschalteten Delta Frames sendet ein Publisher zuerst einen vollständigen Key Frame und danach alle `uiKeyFrameEvery` Nachrichten, dazwischen einen Data Delta Frame mit nur den geänderten Feldern und einen KeepAlive, wenn sich nichts geändert hat. `bDeltaActive`, `udiDeltaSent` und `udiKeepAliveSent` zeigen, was er tut.

## Was sich für ein Projekt mit 1.2.0 ändert

* Ihre Feldliste und Ihr Leitungsformat haben sich nicht geändert. Der einzige Unterschied auf der Leitung ist der Millisekundenanteil des Zeitstempels.
* HotLoop Alarms 1.0.0.0 ist im Release enthalten, unverändert.

## Einstellungen und Standardwerte

* `bHighResTimestamp` ist `TRUE`: Es wird mit den Millisekunden der Uhr gestempelt. Setzen Sie es auf `FALSE`, um ganze Sekunden zu stempeln, genau wie 1.2.0. Kann die Runtime keine Millisekunden liefern, stempelt der Baustein von selbst ganze Sekunden.
* `bDeltaFrames` ist `FALSE`. Delta Frames sind eine Einstellung, die Sie an einem Publisher einschalten, nichts, was der Baustein ungefragt tut, sodass alle Ihre Subscriber weiter vollständige Key Frames lesen. Um es für einen Writer einzuschalten, setzen Sie an diesem Publisher `bDeltaFrames := TRUE` und, wenn Sie einen anderen Key-Frame-Abstand wollen, `uiKeyFrameEvery` (10, wenn Sie es nicht setzen). Jeder Publisher entscheidet für sich, ein Writer kann also Deltas senden, während die anderen es nicht tun. Ein Subscriber, der Delta Frames verwirft, zeigt eine Änderung erst beim nächsten Key Frame, schalten Sie es also für Subscriber ein, die sie lesen. Es gilt für Variant-Publisher mit einem DataSet; ein RawData-Publisher oder ein Baustein mit mehr als einem DataSet sendet Key Frames.
* `AddDataSet`, `AddWString` und `SetStatus` sind Aufrufe, die Sie einmal beim Start machen, wie die anderen `Add`-Aufrufe. Ohne sie ändert sich nichts.

## Upgrade

Installieren Sie `HotLoopTransmitter-1.3.0.library` (oder öffnen Sie das `.package` mit dem CODESYS Installer), ändern Sie die Bibliotheksversion im Library Manager Ihres Projekts auf 1.3.0.0 und kompilieren Sie. An Ihrem Code muss nichts geändert werden. Fügen Sie die neuen Aufrufe hinzu, wenn Sie wollen, was sie tun.

## Zurückgehen

Ein auf 1.2.0 festgelegtes Projekt funktioniert weiter und sendet dieselben Bytes wie zuvor, mit Zeitstempeln in ganzen Sekunden. HotLoop Alarms ist eine eigene Bibliothek und nicht betroffen.

## Nicht in dieser Version

Nachrichtensicherheit, aufgeteilte NetworkMessages, die Subscriber-Seite und MQTT-Transport.

## Dateien

```
e68cfc88e599ddcf278eb208ff500f4f78d3faf74edf12e38f308a009f478594  HotLoopAlarms-1.0.0.0.compiled-library
68f704fc5662bbc67ec097016a741065d705af01913a2746296c17f9e6991118  HotLoopAlarms-1.0.0.0.library
5be90a88e9e0aae1de421628fb6ca8e810dda96b4562566df345d451ecd859cf  HotLoopTransmitter-1.3.0.compiled-library
0410b98578fd55775a97b27023a0b5f30111cac0587120894354d9edca1248fc  HotLoopTransmitter-1.3.0.library
3e791358e6dc628a2d2aae760e0c49c89f1c4490f0637b65864c335fcbb3e9a0  HotLoopTransmitter-1.3.0.package
```
