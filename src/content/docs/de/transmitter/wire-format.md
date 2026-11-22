---
title: "Was auf der Leitung steht"
description: "Die NetworkMessage und DataSetMessage, die HotLoop Transmitter sendet, Byte für Byte, mit den Abschnitten aus OPC 10000-14 und 10000-6, die jede definieren."
---

Jedes Byte unten stammt aus OPC 10000-14 (Teil 14, PubSub) Version 1.05 und OPC 10000-6 (Teil 6, Mappings), gelesen auf reference.opcfoundation.org am 2026-10-31. Die Abschnittsnummern sind die, die Sie aufschlagen, wenn ein Byte falsch aussieht. Nichts hiervon wurde durch den Blick auf die Pakete eines anderen Herstellers gelernt.

Ein Publisher-Baustein sendet pro Veröffentlichungsintervall eine NetworkMessage. Eine NetworkMessage trägt eine DataSetMessage, einen Data Key Frame, jede Nachricht enthält also jedes Feld. Seit 1.1.0 trägt jede Nachricht einen Zeitstempel der SPS-Uhr, sowohl in der NetworkMessage als auch in der DataSetMessage, es sei denn `bTimestamp` ist FALSE, dann sind die Bytes genau die von 1.0.0. Die Tabellen zeigen beides: Die als gestempelt markierten Zeilen gibt es nur, wenn der Zeitstempel an ist.

Alle Mehrbytewerte sind Little Endian, so wie das OPC-UA-Binärformat es definiert; der Baustein schreibt sie Byte für Byte, die Byte-Reihenfolge des Hosts spielt also keine Rolle.

## NetworkMessage (Teil 14, 7.2.4.4.2)

| Bytes | Wert | Bedeutung |
|---|---|---|
| 1 | `F1` | UADPVersion 1 in den Bits 0 bis 3. UADPFlags in den Bits 4 bis 7: PublisherId (Bit 4), GroupHeader (Bit 5), PayloadHeader (Bit 6) und ExtendedFlags1 (Bit 7), alle vorhanden |
| 1 | `21` gestempelt, `01` ungestempelt | ExtendedFlags1: PublisherId-Typ 001 = UInt16 in den Bits 0 bis 2, Timestamp (Bit 5), wenn gestempelt. Keine DataSetClassId, kein Security-Header, keine PicoSeconds, keine ExtendedFlags2 |
| 2 | PublisherId | `uiPublisherId` |
| 1 | `0F` | GroupFlags: WriterGroupId, GroupVersion, NetworkMessageNumber und SequenceNumber vorhanden |
| 2 | WriterGroupId | `uiWriterGroupId` |
| 4 | GroupVersion | `udiGroupVersion` |
| 2 | NetworkMessageNumber | immer 1, weil 0 ungültig ist |
| 2 | SequenceNumber | zählt die gesendeten Nachrichten, läuft bei 65535 über |
| 1 | Count | immer 1 (Payload-Header, 7.2.4.5.2) |
| 2 | DataSetWriterId | `uiDataSetWriterId` |
| 8 | Timestamp, nur gestempelt | der NetworkMessage-Timestamp (7.2.4.4.2), ein DateTime (Teil 6, 5.2.2.5): 100-ns-Ticks seit 1601-01-01 00:00:00 UTC als Int64. Er steht nach dem Payload-Header und vor der DataSetMessage |

Weil Count 1 ist, hat die Nutzlast kein Sizes-Array. Der Baustein sendet keine segmentierten Nachrichten, keine Discovery-Nachrichten, keine hochgestuften Felder und keinen Security-Header, und ein Empfänger, der eines davon verlangt, wird von dieser Version nicht bedient.

## DataSetMessage (Teil 14, 7.2.4.5.4 und 7.2.4.5.5)

| Bytes | Wert | Bedeutung |
|---|---|---|
| 1 | `69` Variant, `6B` RawData; gestempelt `E9` und `EB` | DataSetFlags1: gültig (Bit 0), Feldkodierung (Bits 1 und 2: 00 Variant, 01 RawData), Sequenznummer (Bit 3), ConfigurationVersion Major (Bit 5) und Minor (Bit 6) und DataSetFlags2 (Bit 7), wenn gestempelt. Status fehlt. Ungestempelt fehlt auch DataSetFlags2 und der Typ ist der Standard, ein Data Key Frame |
| 1 | `10`, nur gestempelt | DataSetFlags2: Nachrichtentyp 0 (Data Key Frame) in den Bits 0 bis 3, Timestamp (Bit 4) |
| 2 | Sequenznummer der DataSetMessage | zählt die gesendeten Nachrichten, läuft bei 65535 über |
| 8 | Timestamp, nur gestempelt | der DataSetMessage-Timestamp (7.2.4.5.4), derselbe DateTime wie der der NetworkMessage, nach der Sequenznummer |
| 4 | ConfigurationVersion Major | `udiConfigMajor` |
| 4 | ConfigurationVersion Minor | `udiConfigMinor` |
| 2 | FieldCount | nur Variant. Bei RawData ausgelassen (7.2.4.5.5) |
| ... | die Felder | in der Reihenfolge, in der sie hinzugefügt wurden |

## Der Zeitstempel

Der Baustein liest die Echtzeituhr der SPS einmal pro Nachricht mit `SysTimeRtcGet` (die Systembibliothek SysTimeRtc, die die Runtime bereitstellt), das ganze Sekunden seit 1970-01-01 UTC liefert, und schreibt `(seconds + 11644473600) * 10000000` als DateTime. Beide Zeitstempel in einer Nachricht sind dieser eine Wert. Daraus folgen zwei Dinge:

* Die Auflösung beträgt eine Sekunde. Ein Empfänger sieht innerhalb einer Sekunde auf jeder Nachricht denselben Zeitstempel, und er liegt bis zu eine Sekunde hinter dem Augenblick zurück, in dem die Nachricht gebaut wurde. Zeitstempel unterhalb einer Sekunde stehen auf der Roadmap.
* Die Zeit ist nur so richtig wie die Uhr der SPS. Eine Steuerung mit ungesetzter Uhr stempelt ihre Nachricht mit 1970. Lässt sich die Uhr nicht lesen (`diLastClockResult` ist nicht 0), geht die Nachricht ungestempelt hinaus, was Teil 14 erlaubt, statt gar nicht.

Erhöhen Sie `udiConfigMajor`, sobald sich die Feldliste ändert. Ein Empfänger, der ein nach Version geordnetes Layout vorhält, kann dann eine für eine andere Liste gebaute Nachricht ablehnen, statt sie falsch zu dekodieren.

## Felder, Variant-Kodierung (Teil 6, 5.2.2.16)

Jedes Feld ist ein EncodingMask-Byte, dann der Wert. Die Bits 0 bis 5 der Maske sind die ID des eingebauten Typs (Teil 6, 5.1.2, Tabelle 1), und Bit 7 sagt, dass der Wert ein Array ist, in welchem Fall eine Int32-Elementzahl vor den Elementen steht.

| SPS-Typ | Typ-ID | Wertbytes |
|---|---|---|
| BOOL | 1 Boolean | 1, `00` oder `01` |
| SINT | 2 SByte | 1 |
| USINT, BYTE | 3 Byte | 1 |
| INT | 4 Int16 | 2 |
| UINT, WORD | 5 UInt16 | 2 |
| DINT | 6 Int32 | 4 |
| UDINT, DWORD | 7 UInt32 | 4 |
| LINT | 8 Int64 | 8 |
| ULINT, LWORD | 9 UInt64 | 8 |
| REAL | 10 Float | 4, IEEE 754 |
| LREAL | 11 Double | 8, IEEE 754 |
| STRING | 12 String | Int32-Länge in Bytes, dann UTF-8 (5.2.2.4) |
| TIME | 7 UInt32 | Millisekunden, so wird ein CODESYS-TIME gehalten |

Ein CODESYS-STRING hält ein Byte pro Zeichen. Bytes bis `7F` sind ASCII und gehen unverändert hinaus. Bytes über `7F` werden als ISO 8859-1 gelesen und in ihrer zweibyteigen UTF-8-Form geschrieben. Das ist eine Annahme über die Codepage der SPS und die einzige Stelle, an der der Baustein Text interpretiert.

## Felder, RawData-Kodierung (Teil 14, 7.2.4.5.11)

Keine Maske und keine Zahl: Jedes Feld ist einfach sein Wert, der Reihe nach, der Empfänger muss das Layout also kennen. Teil 14 sagt, die Felder werden "handled like a Structure DataType", jeder Wert wird also so kodiert wie ein Structure-Feld in Teil 6.

* **Skalare** sind ihre Wertbytes wie in der Variant-Tabelle, ohne Maske.
* **Arrays** sind eine Int32-Elementzahl und dann die Elemente (Teil 6, 5.2.5: "One dimensional Arrays are encoded as a sequence of elements preceded by the number of elements encoded as an Int32 value"). Der Baustein sendet immer jedes Element, das ihm gegeben wurde, die Zahl entspricht also der deklarierten Größe des Arrays und danach gibt es kein Padding.
* **Strings** sind eine Int32-Länge in Bytes und die UTF-8-Bytes, dann Nullbytes bis MaxStringLength, das Feld ist also immer 4 + MaxStringLength Bytes lang (7.2.4.5.11: "the field shall be padded with bytes with value zero"). Der Baustein nimmt das N aus `STRING(N)` als MaxStringLength, in Bytes. Längerer Text wird an einer Zeichengrenze abgeschnitten, weil das Feld nicht wachsen kann. Die Feldmetadaten eines Empfängers müssen dasselbe MaxStringLength und für jedes Array einen ArrayDimensions-Eintrag tragen.

Das ist die Lesart des Referenzstacks der OPC Foundation selbst. In UA-.NETStandard (Commit `fcfc84eab5c105780d7268474a47d344d100aca1`) sagen `src/Opc.Ua.PubSub/Encoding/Uadp/UadpBinaryReader.cs` Zeilen 389 bis 403, ein String wird "read like a Structure field (Int32 length prefix and value) from a fixed-size 4 + MaxStringLength byte block whose remainder is zero padding", und für ein Array "the array's Part 6 length (or dimensions) prefix gives the actual element count and the block is padded to product(arrayDimensions) elements". `TryReadPaddedArray` in den Zeilen 593 bis 648 setzt das um, und `tests/Opc.Ua.PubSub.Tests/Encoding/Uadp/UadpRawDataPaddingTests.cs` prüft es. Die [Nachweisseite](/de/transmitter/proof/) hat den Rest.

## Größe

Der Baustein baut die Nachricht in einem 1472-Byte-Puffer: 1500 Byte Ethernet-Nutzlast abzüglich 20 für IP und 8 für UDP, eine Nachricht fragmentiert also nie. Eine Feldliste, die nicht passt, setzt den Baustein mit dem Fehler `TooBig` in `ConfigError`; er schneidet nichts ab. Ein REAL-Array mit 250 Elementen in Variant-Kodierung hat 1005 Byte, eine Nachricht aus diesem Array plus Header passt also, zwei davon nicht.
