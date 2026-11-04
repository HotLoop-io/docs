---
title: "What goes on the wire"
description: "The NetworkMessage and DataSetMessage HotLoop Transmitter sends, byte by byte, with the OPC 10000-14 and 10000-6 sections that define each one."
---

Every byte below comes from OPC 10000-14 (Part 14, PubSub) version 1.05 and OPC 10000-6 (Part 6, mappings),
read at reference.opcfoundation.org on 2026-10-31. The section numbers are the ones to open when a byte looks wrong.
Nothing here was learned by looking at another vendor's packets.

One publisher block sends one NetworkMessage per publishing interval. A NetworkMessage carries one DataSetMessage,
a Data Key Frame, so every message holds every field. All multi-byte values are little endian, which is how OPC UA
binary is defined; the block writes them byte by byte, so the host's byte order does not matter.

## NetworkMessage (Part 14, 7.2.4.4.2)

| Bytes | Value | Meaning |
|---|---|---|
| 1 | `F1` | UADPVersion 1 in bits 0 to 3. UADPFlags in bits 4 to 7: PublisherId (bit 4), GroupHeader (bit 5), PayloadHeader (bit 6) and ExtendedFlags1 (bit 7) all present |
| 1 | `01` | ExtendedFlags1: PublisherId type 001 = UInt16. No DataSetClassId, no security header, no timestamp, no ExtendedFlags2 |
| 2 | PublisherId | `uiPublisherId` |
| 1 | `0F` | GroupFlags: WriterGroupId, GroupVersion, NetworkMessageNumber and SequenceNumber present |
| 2 | WriterGroupId | `uiWriterGroupId` |
| 4 | GroupVersion | `udiGroupVersion` |
| 2 | NetworkMessageNumber | always 1, because 0 is invalid |
| 2 | SequenceNumber | counts messages sent, wraps at 65535 |
| 1 | Count | always 1 (payload header, 7.2.4.5.2) |
| 2 | DataSetWriterId | `uiDataSetWriterId` |

Because Count is 1, the payload has no Sizes array. The block does not send chunked messages, discovery messages,
promoted fields or a security header, and a receiver that requires one of those is not served by this version.

## DataSetMessage (Part 14, 7.2.4.5.4 and 7.2.4.5.5)

| Bytes | Value | Meaning |
|---|---|---|
| 1 | `69` Variant, `6B` RawData | DataSetFlags1: valid (bit 0), field encoding (bits 1 and 2: 00 Variant, 01 RawData), sequence number (bit 3), ConfigurationVersion major (bit 5) and minor (bit 6). Status, DataSetFlags2 and timestamps are absent, so the type is the default, a Data Key Frame |
| 2 | DataSetMessage sequence number | counts messages sent, wraps at 65535 |
| 4 | ConfigurationVersion major | `udiConfigMajor` |
| 4 | ConfigurationVersion minor | `udiConfigMinor` |
| 2 | FieldCount | Variant only. Omitted for RawData (7.2.4.5.5) |
| ... | the fields | in the order they were added |

Bump `udiConfigMajor` whenever the field list changes. A receiver that keeps a layout keyed on the version can then
refuse a message built for a different list instead of decoding it wrong.

## Fields, Variant encoding (Part 6, 5.2.2.16)

Each field is an EncodingMask byte, then the value. Bits 0 to 5 of the mask are the built-in type id (Part 6, 5.1.2,
table 1), and bit 7 says the value is an array, in which case an Int32 element count comes before the elements.

| PLC type | Type id | Value bytes |
|---|---|---|
| BOOL | 1 Boolean | 1, `00` or `01` |
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
| STRING | 12 String | Int32 length in bytes, then UTF-8 (5.2.2.4) |
| TIME | 7 UInt32 | milliseconds, which is how a CODESYS TIME is held |

A CODESYS STRING holds one byte per character. Bytes up to `7F` are ASCII and go out unchanged. Bytes above `7F` are
read as ISO 8859-1 and written as their two byte UTF-8 form. That is an assumption about the PLC's code page, and it
is the one place the block interprets text.

## Fields, RawData encoding (Part 14, 7.2.4.5.11)

No mask and no count: each field is just its value, in order, so the receiver must know the layout. Part 14 says the
fields are "handled like a Structure DataType", so each value is encoded as a Structure field is in Part 6.

* **Scalars** are their value bytes, as in the Variant table, with no mask.
* **Arrays** are an Int32 element count and then the elements (Part 6, 5.2.5: "One dimensional Arrays are encoded as
  a sequence of elements preceded by the number of elements encoded as an Int32 value"). The block always sends
  every element it was given, so the count equals the array's declared size and there is no padding after it.
* **Strings** are an Int32 length in bytes and the UTF-8 bytes, then zero bytes up to MaxStringLength, so the field is
  always 4 + MaxStringLength bytes (7.2.4.5.11: "the field shall be padded with bytes with value zero"). The block
  uses the N of `STRING(N)` as MaxStringLength, in bytes. Text longer than that is cut at a character boundary,
  because the field cannot grow. A receiver's field metadata must carry the same MaxStringLength and an
  ArrayDimensions entry for each array.

This is the reading of the OPC Foundation's own reference stack. In UA-.NETStandard (commit `fcfc84eab5c105780d7268474a47d344d100aca1`), `src/Opc.Ua.PubSub/Encoding/Uadp/UadpBinaryReader.cs` lines 389 to 403 say a string is "read like a Structure field (Int32 length prefix and value) from a fixed-size 4 + MaxStringLength byte block whose remainder is zero padding", and that for an array "the array's Part 6 length (or dimensions) prefix gives the actual element count and the block is padded to product(arrayDimensions) elements". `TryReadPaddedArray` at lines 593 to 648 implements it, and `tests/Opc.Ua.PubSub.Tests/Encoding/Uadp/UadpRawDataPaddingTests.cs` asserts it. `docs/PROOF.md` has the rest.

## Size

The block builds the message in a 1472 byte buffer: 1500 bytes of Ethernet payload less 20 of IP and 8 of UDP, so a
message never fragments. A field list that does not fit puts the block in `ConfigError` with error `TooBig`; it does
not truncate. A 250 element REAL array in Variant encoding is 1005 bytes, so a message of that array plus the header
fits, and two of them do not.
