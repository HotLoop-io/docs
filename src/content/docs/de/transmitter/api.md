---
title: "HotLoop Transmitter API: Referenz"
description: "Jeder Eingang, Ausgang und jede Methode des Publisher-Funktionsbausteins von HotLoop Transmitter."
---

Alles liegt im Namensraum `HLTX`. Der Baustein ist `HLTX.FB_HLTX_Publisher`.

## Eingänge

| Eingang | Typ | Standard | Bedeutung |
|---|---|---|---|
| `bEnable` | BOOL | FALSE | TRUE öffnet den Socket und beginnt zu veröffentlichen. FALSE schließt ihn und setzt den Baustein auf `Disabled` zurück, was auch einen `ConfigError` löscht |
| `sDestination` | STRING(15) | `127.0.0.1` | IPv4-Adresse in Punktschreibweise: ein Unicast-Host oder eine Multicast-Gruppe von 224.0.0.0 bis 239.255.255.255 |
| `uiPort` | UINT | 4840 | UDP-Zielport. 4840 ist der von OPC UA registrierte |
| `sLocalAddress` | STRING(15) | leer | nur Multicast: die Adresse der Schnittstelle, über die gesendet wird. Leer lässt das Betriebssystem wählen |
| `usiMulticastTTL` | USINT | 1 | Multicast-Time-to-live |
| `uiPublisherId` | UINT | 1 | PublisherId, als UInt16 gesendet |
| `uiWriterGroupId` | UINT | 1 | WriterGroupId |
| `uiDataSetWriterId` | UINT | 1 | DataSetWriterId |
| `tPublishingInterval` | TIME | T#100MS | Zeit zwischen Nachrichten. Minimum T#1MS. Der Baustein kann nur in einem Zyklus senden, die tatsächliche Rate ist also das Intervall, aufgerundet auf ein ganzzahliges Vielfaches der Zykluszeit der aufrufenden Task |
| `eEncoding` | `E_HLTX_Encoding` | `Variant` | `Variant` oder `RawData`. Im deaktivierten Zustand ändern |
| `udiGroupVersion` | UDINT | 1 | GroupVersion im Gruppen-Header |
| `udiConfigMajor`, `udiConfigMinor` | UDINT | 1, 0 | ConfigurationVersion des DataSets. Erhöhen Sie das Major, sobald sich die Feldliste ändert |
| `bTimestamp` | BOOL | TRUE | versieht jede Nachricht mit der SPS-Uhr, in der NetworkMessage und in der DataSetMessage (ganze Sekunden, siehe [Was auf der Leitung steht](/de/transmitter/wire-format/)). FALSE sendet die Bytes von 1.0.0, 17 Byte kürzer |
| `tRetry` | TIME | T#2S | wie lange gewartet wird, bevor der Socket nach zehn fehlgeschlagenen Sendungen in Folge neu geöffnet wird |

## Ausgänge

| Ausgang | Typ | Bedeutung |
|---|---|---|
| `eState` | `E_HLTX_State` | `Disabled`, `Running`, `Backoff` (wartet auf das Neuöffnen des Sockets) oder `ConfigError` (siehe `eError`; nichts wird gesendet) |
| `eError` | `E_HLTX_Error` | `None`, `NoFields`, `BadInterval`, `BadAddress`, `SocketCreate`, `SocketOption`, `TooBig`, `BadField` |
| `bActive` | BOOL | TRUE, solange Nachrichten hinausgehen |
| `udiSent` | UDINT | an das Netz übergebene Nachrichten |
| `udiSendErrors` | UDINT | Sendungen, die das Betriebssystem abgelehnt oder gekürzt hat |
| `udiSkipped` | UDINT | verpasste Veröffentlichungs-Slots, weil die Task zu spät lief |
| `uiMessageSize` | UINT | Bytes der letzten Nachricht |
| `diLastSocketResult` | UDINT | der letzte Runtime-Fehlercode eines Socket-Aufrufs, 0 ist in Ordnung |
| `diLastClockResult` | UDINT | das letzte Ergebnis beim Lesen der SPS-Uhr für einen Zeitstempel, 0 ist in Ordnung. Ist es nicht 0, geht die Nachricht ohne Zeitstempel hinaus |
| `diLastClockResult` | UDINT | das letzte Ergebnis beim Lesen der SPS-Uhr für einen Zeitstempel, 0 ist in Ordnung. Ist es nicht 0, geht die Nachricht ohne Zeitstempel hinaus |
| `udiLastCallUs`, `udiMaxCallUs` | UDINT | Mikrosekunden im letzten Aufruf des Bausteins und der längste seit Aktivierung oder `Clear()` |
| `udiMaxEncodeUs`, `udiMaxSendUs` | UDINT | die längste Zeit für den Aufbau einer Nachricht und im Sendeaufruf selbst, seit Aktivierung oder `Clear()` |

## Methoden

Fügen Sie die Felder einmal vor dem ersten Aufruf hinzu, in der Reihenfolge, in der ein Empfänger sie lesen soll. Jede Methode liefert TRUE, wenn das Feld angenommen wurde. Bis zu 128 Felder.

| Methode | Fügt hinzu |
|---|---|
| `AddBool(pValue)`, `AddSInt`, `AddUSInt`, `AddInt`, `AddUInt`, `AddDInt`, `AddUDInt`, `AddLInt`, `AddULInt`, `AddReal`, `AddLReal`, `AddTime` | einen Skalar. `pValue` ist `ADR(variable)` |
| `AddString(pValue, uiMaxLen)` | einen STRING. `uiMaxLen` ist das N in `STRING(N)` |
| `AddArray(pFirst, eType, uiCount)` | ein Array mit `uiCount` Elementen eines beliebigen Typs außer STRING. `pFirst` ist `ADR(array[first])` |
| `AddField(pData, eType, uiCount, uiMaxLen)` | die allgemeine Form, die die anderen aufrufen |
| `Clear()` | vergisst die Feldliste und die maximale Aufrufzeit |

Der Baustein behält die Adressen, die Sie ihm geben. Rufen Sie nach einer Online-Änderung, die Variablen verschiebt, also `Clear()` auf und fügen Sie die Felder neu hinzu. WORD, DWORD und LWORD gehen über die gleich große Methode als UINT, UDINT und ULINT hinein.

## Aufruf

Rufen Sie die Instanz einmal pro Zyklus aus einer einzigen Task auf. Rufen Sie eine Instanz nicht aus zwei Tasks auf. Mehrere Publisher in einem Programm sind in Ordnung, und jeder hat seinen eigenen Socket; geben Sie jedem seine eigene Writer-Group-ID und DataSetWriter-ID.
