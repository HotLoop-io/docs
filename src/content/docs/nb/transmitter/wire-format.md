---
title: "Hva som går på ledningen"
description: "NetworkMessage og DataSetMessage som HotLoop Transmitter sender, byte for byte, med delene av OPC 10000-14 og 10000-6 som definerer hver av dem."
---

Hver byte nedenfor kommer fra OPC 10000-14 (del 14, PubSub) versjon 1.05 og OPC 10000-6 (del 6, mappinger), lest på reference.opcfoundation.org 2026-10-31. Delnumrene er de du åpner når en byte ser feil ut. Ingenting her er lært ved å se på en annen leverandørs pakker.

Én publisher-blokk sender én NetworkMessage per publiseringsintervall. En NetworkMessage bærer én DataSetMessage, en Data Key Frame, så hver melding inneholder alle feltene. Siden 1.1.0 har hver melding et tidsstempel fra PLS-ens klokke, både i NetworkMessage og i DataSetMessage, med mindre `bTimestamp` er FALSE, og da er bytene nøyaktig de fra 1.0.0. Tabellene viser begge: radene merket stemplet finnes bare når tidsstempelet er på.

Alle verdier på flere byte er little endian, slik OPC UA binary er definert; blokken skriver dem byte for byte, så vertens byterekkefølge spiller ingen rolle.

## NetworkMessage (del 14, 7.2.4.4.2)

| Byte | Verdi | Betydning |
|---|---|---|
| 1 | `F1` | UADPVersion 1 i bit 0 til 3. UADPFlags i bit 4 til 7: PublisherId (bit 4), GroupHeader (bit 5), PayloadHeader (bit 6) og ExtendedFlags1 (bit 7), alle til stede |
| 1 | `21` stemplet, `01` ustemplet | ExtendedFlags1: PublisherId-type 001 = UInt16 i bit 0 til 2, Timestamp (bit 5) når stemplet. Ingen DataSetClassId, ingen sikkerhetsheader, ingen PicoSeconds, ingen ExtendedFlags2 |
| 2 | PublisherId | `uiPublisherId` |
| 1 | `0F` | GroupFlags: WriterGroupId, GroupVersion, NetworkMessageNumber og SequenceNumber til stede |
| 2 | WriterGroupId | `uiWriterGroupId` |
| 4 | GroupVersion | `udiGroupVersion` |
| 2 | NetworkMessageNumber | alltid 1, fordi 0 er ugyldig |
| 2 | SequenceNumber | teller sendte meldinger, begynner på nytt etter 65535 |
| 1 | Count | alltid 1 (nyttelastheader, 7.2.4.5.2) |
| 2 | DataSetWriterId | `uiDataSetWriterId` |
| 8 | Timestamp, bare stemplet | NetworkMessage-Timestamp (7.2.4.4.2), en DateTime (del 6, 5.2.2.5): 100 ns-tikk siden 1601-01-01 00:00:00 UTC som Int64. Den kommer etter nyttelastheaderen og før DataSetMessage |

Fordi Count er 1, har nyttelasten ingen Sizes-matrise. Blokken sender ikke oppdelte meldinger, discovery-meldinger, promoterte felt eller sikkerhetsheader, og en mottaker som krever noe av dette får ikke dekket behovet av denne versjonen.

## DataSetMessage (del 14, 7.2.4.5.4 og 7.2.4.5.5)

| Byte | Verdi | Betydning |
|---|---|---|
| 1 | `69` Variant, `6B` RawData; stemplet `E9` og `EB` | DataSetFlags1: gyldig (bit 0), feltkoding (bit 1 og 2: 00 Variant, 01 RawData), sekvensnummer (bit 3), ConfigurationVersion major (bit 5) og minor (bit 6), og DataSetFlags2 (bit 7) når stemplet. Status er fraværende. Ustemplet er DataSetFlags2 også fraværende og typen er standard, en Data Key Frame |
| 1 | `10`, bare stemplet | DataSetFlags2: meldingstype 0 (Data Key Frame) i bit 0 til 3, Timestamp (bit 4) |
| 2 | DataSetMessage-sekvensnummer | teller sendte meldinger, begynner på nytt etter 65535 |
| 8 | Timestamp, bare stemplet | DataSetMessage-Timestamp (7.2.4.5.4), den samme DateTime som i NetworkMessage, etter sekvensnummeret |
| 4 | ConfigurationVersion major | `udiConfigMajor` |
| 4 | ConfigurationVersion minor | `udiConfigMinor` |
| 2 | FieldCount | bare Variant. Utelatt for RawData (7.2.4.5.5) |
| ... | feltene | i den rekkefølgen de ble lagt til |

## Tidsstempelet

Blokken leser PLS-ens sanntidsklokke én gang per melding med `SysTimeRtcGet` (systembiblioteket SysTimeRtc, som kjøretiden leverer), som gir hele sekunder siden 1970-01-01 UTC, og skriver `(seconds + 11644473600) * 10000000` som DateTime. Begge tidsstemplene i en melding er denne ene verdien. To ting følger av det:

* Oppløsningen er ett sekund. En mottaker ser samme tidsstempel på hver melding innenfor et sekund, og det ligger opptil et sekund bak øyeblikket meldingen ble bygget. Tidsstempler under ett sekund står på veikartet.
* Tiden er bare så riktig som PLS-ens klokke. En kontroller med uinnstilt klokke stempler meldingen sin 1970. Når klokken ikke kan leses (`diLastClockResult` er ikke 0), går meldingen ut ustemplet, noe del 14 tillater, i stedet for ikke å gå ut i det hele tatt.

Øk `udiConfigMajor` hver gang feltlisten endres. En mottaker som har et oppsett knyttet til versjonen, kan da avvise en melding bygget for en annen liste i stedet for å dekode den feil.

## Felt, Variant-koding (del 6, 5.2.2.16)

Hvert felt er en EncodingMask-byte, så verdien. Bit 0 til 5 i masken er den innebygde typens id (del 6, 5.1.2, tabell 1), og bit 7 sier at verdien er en matrise, og da kommer et Int32-elementantall før elementene.

| PLS-type | Type-id | Verdibyte |
|---|---|---|
| BOOL | 1 Boolean | 1, `00` eller `01` |
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
| STRING | 12 String | Int32-lengde i byte, så UTF-8 (5.2.2.4) |
| TIME | 7 UInt32 | millisekunder, slik en CODESYS TIME lagres |

En CODESYS STRING har én byte per tegn. Byte opp til `7F` er ASCII og går ut uendret. Byte over `7F` leses som ISO 8859-1 og skrives i sin to-byte UTF-8-form. Det er en antakelse om PLS-ens kodeside, og det er det eneste stedet blokken tolker tekst.

## Felt, RawData-koding (del 14, 7.2.4.5.11)

Ingen maske og ingen telling: hvert felt er bare verdien sin, i rekkefølge, så mottakeren må kjenne oppsettet. Del 14 sier at feltene "handled like a Structure DataType", så hver verdi kodes slik et Structure-felt kodes i del 6.

* **Skalarer** er verdibytene sine, som i Variant-tabellen, uten maske.
* **Matriser** er et Int32-elementantall og så elementene (del 6, 5.2.5: "One dimensional Arrays are encoded as a sequence of elements preceded by the number of elements encoded as an Int32 value"). Blokken sender alltid alle elementene den ble gitt, så antallet er lik matrisens deklarerte størrelse, og det er ingen utfylling etter den.
* **Strenger** er en Int32-lengde i byte og UTF-8-bytene, så nullbyte opp til MaxStringLength, slik at feltet alltid er 4 + MaxStringLength byte (7.2.4.5.11: "the field shall be padded with bytes with value zero"). Blokken bruker N fra `STRING(N)` som MaxStringLength, i byte. Lengre tekst kuttes ved en tegngrense, fordi feltet ikke kan vokse. Mottakerens feltmetadata må ha samme MaxStringLength og en ArrayDimensions-oppføring for hver matrise.

Dette er lesemåten til OPC Foundations egen referansestack. I UA-.NETStandard (commit `fcfc84eab5c105780d7268474a47d344d100aca1`) sier `src/Opc.Ua.PubSub/Encoding/Uadp/UadpBinaryReader.cs` linje 389 til 403 at en streng blir "read like a Structure field (Int32 length prefix and value) from a fixed-size 4 + MaxStringLength byte block whose remainder is zero padding", og at for en matrise "the array's Part 6 length (or dimensions) prefix gives the actual element count and the block is padded to product(arrayDimensions) elements". `TryReadPaddedArray` på linje 593 til 648 implementerer det, og `tests/Opc.Ua.PubSub.Tests/Encoding/Uadp/UadpRawDataPaddingTests.cs` hevder det. [Bevissiden](/nb/transmitter/proof/) har resten.

## Størrelse

Blokken bygger meldingen i en buffer på 1472 byte: 1500 byte Ethernet-nyttelast minus 20 for IP og 8 for UDP, så en melding fragmenteres aldri. En feltliste som ikke får plass setter blokken i `ConfigError` med feilen `TooBig`; den kutter ikke. En REAL-matrise med 250 elementer i Variant-koding er 1005 byte, så en melding med den matrisen pluss headeren får plass, og to får ikke.
