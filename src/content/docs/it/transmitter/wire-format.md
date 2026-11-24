---
title: "Cosa va sul cavo"
description: "Il NetworkMessage e il DataSetMessage che HotLoop Transmitter invia, byte per byte, con le sezioni di OPC 10000-14 e 10000-6 che definiscono ciascuno."
---

Ogni byte qui sotto viene da OPC 10000-14 (Parte 14, PubSub) versione 1.05 e da OPC 10000-6 (Parte 6, mappature), lette su reference.opcfoundation.org il 2026-10-31. I numeri di sezione sono quelli da aprire quando un byte sembra sbagliato. Nulla di tutto questo è stato imparato guardando i pacchetti di un altro fornitore.

Un blocco publisher invia un NetworkMessage per intervallo di pubblicazione. Un NetworkMessage porta un DataSetMessage, un Data Key Frame, quindi ogni messaggio contiene tutti i campi. Dalla 1.1.0 ogni messaggio porta un timestamp dall'orologio del PLC, sia nel NetworkMessage sia nel DataSetMessage, a meno che `bTimestamp` sia FALSE, nel qual caso i byte sono esattamente quelli della 1.0.0. Le tabelle mostrano entrambi: le righe marcate come con timestamp ci sono solo quando il timestamp è attivo.

Tutti i valori di più byte sono little endian, come definisce il binario OPC UA; il blocco li scrive byte per byte, quindi l'ordine dei byte dell'host non conta.

## NetworkMessage (Parte 14, 7.2.4.4.2)

| Byte | Valore | Significato |
|---|---|---|
| 1 | `F1` | UADPVersion 1 nei bit da 0 a 3. UADPFlags nei bit da 4 a 7: PublisherId (bit 4), GroupHeader (bit 5), PayloadHeader (bit 6) ed ExtendedFlags1 (bit 7), tutti presenti |
| 1 | `21` con timestamp, `01` senza | ExtendedFlags1: tipo di PublisherId 001 = UInt16 nei bit da 0 a 2, Timestamp (bit 5) quando c'è il timestamp. Nessun DataSetClassId, nessuna intestazione di sicurezza, nessun PicoSeconds, nessun ExtendedFlags2 |
| 2 | PublisherId | `uiPublisherId` |
| 1 | `0F` | GroupFlags: WriterGroupId, GroupVersion, NetworkMessageNumber e SequenceNumber presenti |
| 2 | WriterGroupId | `uiWriterGroupId` |
| 4 | GroupVersion | `udiGroupVersion` |
| 2 | NetworkMessageNumber | sempre 1, perché 0 non è valido |
| 2 | SequenceNumber | conta i messaggi inviati, riparte da 0 dopo 65535 |
| 1 | Count | sempre 1 (intestazione del payload, 7.2.4.5.2) |
| 2 | DataSetWriterId | `uiDataSetWriterId` |
| 8 | Timestamp, solo con timestamp | il Timestamp del NetworkMessage (7.2.4.4.2), un DateTime (Parte 6, 5.2.2.5): tick da 100 ns dal 1601-01-01 00:00:00 UTC come Int64. Viene dopo l'intestazione del payload e prima del DataSetMessage |

Poiché Count è 1, il payload non ha l'array Sizes. Il blocco non invia messaggi frammentati, messaggi di discovery, campi promossi né intestazione di sicurezza, e un ricevitore che ne richiede uno non è servito da questa versione.

## DataSetMessage (Parte 14, 7.2.4.5.4 e 7.2.4.5.5)

| Byte | Valore | Significato |
|---|---|---|
| 1 | `69` Variant, `6B` RawData; con timestamp `E9` e `EB` | DataSetFlags1: valido (bit 0), codifica dei campi (bit 1 e 2: 00 Variant, 01 RawData), numero di sequenza (bit 3), ConfigurationVersion major (bit 5) e minor (bit 6), e DataSetFlags2 (bit 7) con timestamp. Lo stato è assente. Senza timestamp anche DataSetFlags2 è assente e il tipo è quello predefinito, un Data Key Frame |
| 1 | `10`, solo con timestamp | DataSetFlags2: tipo di messaggio 0 (Data Key Frame) nei bit da 0 a 3, Timestamp (bit 4) |
| 2 | Numero di sequenza del DataSetMessage | conta i messaggi inviati, riparte da 0 dopo 65535 |
| 8 | Timestamp, solo con timestamp | il Timestamp del DataSetMessage (7.2.4.5.4), lo stesso DateTime di quello del NetworkMessage, dopo il numero di sequenza |
| 4 | ConfigurationVersion major | `udiConfigMajor` |
| 4 | ConfigurationVersion minor | `udiConfigMinor` |
| 2 | FieldCount | solo Variant. Omesso per RawData (7.2.4.5.5) |
| ... | i campi | nell'ordine in cui sono stati aggiunti |

## Più DataSetMessage in un NetworkMessage

Dopo `AddDataSet`, il Count del PayloadHeader è il numero di DataSet ed elenca ogni DataSetWriterId, e il payload inizia con l’array Sizes, una dimensione in byte UInt16 per DataSetMessage (7.2.4.5.3), poi i DataSetMessage uno dopo l’altro. Il DataSet 1 usa writer id, numero di sequenza e ConfigurationVersion propri del blocco; ogni altro DataSet ha il proprio writer id, versione maggiore e numero di sequenza del DataSetMessage. Il Timestamp del NetworkMessage e quello di ogni DataSetMessage sono lo stesso istante. Senza `AddDataSet` il messaggio è esattamente quello di prima, Count 1 e nessun Sizes.

## Frame delta e KeepAlive

Con `bDeltaFrames`, il tipo di DataSetMessage in DataSetFlags2 (bit da 0 a 3) è 0 per un frame chiave, 1 per un Data Delta Frame e 3 per un KeepAlive, e il bit Timestamp resta com’era. Un frame chiave parte per primo e poi ogni `uiKeyFrameEvery` messaggi. Tra l’uno e l’altro il blocco confronta la variabile di ogni campo (e il suo stato) con ciò che portava l’ultimo messaggio: un frame delta è `FieldCount` dei campi cambiati (UInt16), poi per ciascuno il suo `FieldIndex` a base zero (UInt16) e il suo Variant; quando nulla è cambiato il messaggio è un KeepAlive, l’intestazione del DataSetMessage senza payload. Un KeepAlive porta il numero di sequenza del prossimo DataSetMessage e non lo consuma, mentre il numero di sequenza del NetworkMessage lo conta. I DataSet RawData inviano sempre frame chiave.

## Il timestamp

Il blocco legge l’orologio in tempo reale del PLC una volta per messaggio con `SysTimeRtcHighResGet` (la libreria di sistema SysTimeRtc, fornita dal runtime), cioè millisecondi dal 1970-01-01 UTC, e scrive `milliseconds * 10000 + 11644473600 * 10000000` come DateTime. Entrambe le marche di un messaggio sono quell’unico valore. Se il runtime non può rispondere alla chiamata ad alta risoluzione, o `bHighResTimestamp` è FALSE, legge `SysTimeRtcGet` (secondi interi) e scrive `(seconds + 11644473600) * 10000000`, come la 1.1.0. Ne seguono due cose:

* La risoluzione è di un millisecondo (`bStampHighRes` indica quale orologio ha usato l’ultimo messaggio). Con il ripiego sui secondi interi un ricevitore vede la stessa marca su tutti i messaggi entro un secondo.
* L'ora è esatta quanto l'orologio del PLC. Un controllore con l'orologio non impostato marca il proprio messaggio 1970. Quando l'orologio non può essere letto (`diLastClockResult` non è 0) il messaggio parte senza timestamp, cosa che la Parte 14 consente, invece di non partire affatto.

Incrementi `udiConfigMajor` ogni volta che cambia la lista dei campi. Un ricevitore che conserva un layout indicizzato per versione può così rifiutare un messaggio costruito per un'altra lista invece di decodificarlo male.

## Campi, codifica Variant (Parte 6, 5.2.2.16)

Ogni campo è un byte EncodingMask, poi il valore. I bit da 0 a 5 della maschera sono l'id del tipo built-in (Parte 6, 5.1.2, tabella 1), e il bit 7 indica che il valore è un array, nel qual caso un conteggio di elementi Int32 precede gli elementi.

| Tipo PLC | Id del tipo | Byte del valore |
|---|---|---|
| BOOL | 1 Boolean | 1, `00` o `01` |
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
| STRING | 12 String | lunghezza Int32 in byte, poi UTF-8 (5.2.2.4) |
| un campo con stato Bad o Uncertain (`SetStatus`) | 19 StatusCode | 4, lo stato UInt32, al posto del valore (solo Variant) |
| WSTRING | 12 String | Lunghezza Int32 in byte, poi UTF-8 (5.2.2.4) |
| TIME | 7 UInt32 | millisecondi, che è come viene conservato un TIME di CODESYS |

Una STRING di CODESYS conserva un byte per carattere. I byte fino a `7F` sono ASCII e escono invariati. I byte sopra `7F` sono letti come ISO 8859-1 e scritti nella loro forma UTF-8 a due byte. È un'ipotesi sulla code page del PLC, ed è l'unico punto in cui il blocco interpreta testo.

Un WSTRING di CODESYS è UTF-16 e non richiede alcuna ipotesi: ogni unità a 16 bit viene scritta come UTF-8 (uno, due o tre byte), una coppia surrogata ben formata diventa l’unico carattere di quattro byte, e un surrogato isolato diventa U+FFFD, così il testo è sempre UTF-8 valido. In RawData il MaxStringLength di un `WSTRING(N)` è `3 * N` byte, il massimo che può occupare.

## Campi, codifica RawData (Parte 14, 7.2.4.5.11)

Nessuna maschera e nessun conteggio: ogni campo è solo il suo valore, in ordine, quindi il ricevitore deve conoscere il layout. La Parte 14 dice che i campi sono "handled like a Structure DataType", quindi ogni valore è codificato come un campo di Structure nella Parte 6.

* **Gli scalari** sono i loro byte di valore, come nella tabella Variant, senza maschera.
* **Gli array** sono un conteggio di elementi Int32 e poi gli elementi (Parte 6, 5.2.5: "One dimensional Arrays are encoded as a sequence of elements preceded by the number of elements encoded as an Int32 value"). Il blocco invia sempre tutti gli elementi che gli sono stati dati, quindi il conteggio è uguale alla dimensione dichiarata dell'array e non c'è padding dopo.
* **Le stringhe** sono una lunghezza Int32 in byte e i byte UTF-8, poi byte a zero fino a MaxStringLength, quindi il campo è sempre di 4 + MaxStringLength byte (7.2.4.5.11: "the field shall be padded with bytes with value zero"). Il blocco usa la N di `STRING(N)` come MaxStringLength, in byte. Il testo più lungo viene tagliato al limite di un carattere, perché il campo non può crescere. I metadati dei campi del ricevitore devono riportare lo stesso MaxStringLength e una voce ArrayDimensions per ogni array.

Questa è la lettura dello stack di riferimento della stessa OPC Foundation. In UA-.NETStandard (commit `fcfc84eab5c105780d7268474a47d344d100aca1`), `src/Opc.Ua.PubSub/Encoding/Uadp/UadpBinaryReader.cs`, righe da 389 a 403, dice che una stringa viene "read like a Structure field (Int32 length prefix and value) from a fixed-size 4 + MaxStringLength byte block whose remainder is zero padding", e che per un array "the array's Part 6 length (or dimensions) prefix gives the actual element count and the block is padded to product(arrayDimensions) elements". `TryReadPaddedArray`, alle righe da 593 a 648, lo implementa, e `tests/Opc.Ua.PubSub.Tests/Encoding/Uadp/UadpRawDataPaddingTests.cs` lo verifica. `docs/PROOF.md` ha il resto.

## Dimensione

Il blocco costruisce il messaggio in un buffer da 1472 byte: 1500 byte di payload Ethernet meno 20 di IP e 8 di UDP, quindi un messaggio non si frammenta mai. Una lista di campi che non ci sta mette il blocco in `ConfigError` con l'errore `TooBig`; non tronca. Un array REAL da 250 elementi in codifica Variant è di 1005 byte, quindi un messaggio con quell'array più l'intestazione ci sta, e due no.
