---
title: "Qué va por el cable"
description: "El NetworkMessage y el DataSetMessage que envía HotLoop Transmitter, byte a byte, con las secciones de OPC 10000-14 y 10000-6 que definen cada uno."
---

Cada byte de abajo proviene de OPC 10000-14 (Parte 14, PubSub) versión 1.05 y de OPC 10000-6 (Parte 6, mapeos), leídas en reference.opcfoundation.org el 2026-10-31. Los números de sección son los que hay que abrir cuando un byte parece incorrecto. Nada de esto se aprendió mirando paquetes de otro fabricante.

Un bloque publicador envía un NetworkMessage por intervalo de publicación. Un NetworkMessage lleva un DataSetMessage, un Data Key Frame, así que cada mensaje contiene todos los campos. Desde 1.1.0 cada mensaje lleva una marca de tiempo del reloj del PLC, tanto en el NetworkMessage como en el DataSetMessage, salvo que `bTimestamp` sea FALSE, en cuyo caso los bytes son exactamente los de 1.0.0. Las tablas muestran ambos casos: las filas marcadas como con marca solo están cuando la marca de tiempo está activada.

Todos los valores de varios bytes son little endian, que es como se define el binario de OPC UA; el bloque los escribe byte a byte, así que el orden de bytes del host no importa.

## NetworkMessage (Parte 14, 7.2.4.4.2)

| Bytes | Valor | Significado |
|---|---|---|
| 1 | `F1` | UADPVersion 1 en los bits 0 a 3. UADPFlags en los bits 4 a 7: PublisherId (bit 4), GroupHeader (bit 5), PayloadHeader (bit 6) y ExtendedFlags1 (bit 7), todos presentes |
| 1 | `21` con marca, `01` sin marca | ExtendedFlags1: tipo de PublisherId 001 = UInt16 en los bits 0 a 2, Timestamp (bit 5) cuando hay marca. Sin DataSetClassId, sin cabecera de seguridad, sin PicoSeconds, sin ExtendedFlags2 |
| 2 | PublisherId | `uiPublisherId` |
| 1 | `0F` | GroupFlags: WriterGroupId, GroupVersion, NetworkMessageNumber y SequenceNumber presentes |
| 2 | WriterGroupId | `uiWriterGroupId` |
| 4 | GroupVersion | `udiGroupVersion` |
| 2 | NetworkMessageNumber | siempre 1, porque 0 no es válido |
| 2 | SequenceNumber | cuenta los mensajes enviados, vuelve a 0 tras 65535 |
| 1 | Count | siempre 1 (cabecera de carga útil, 7.2.4.5.2) |
| 2 | DataSetWriterId | `uiDataSetWriterId` |
| 8 | Timestamp, solo con marca | el Timestamp del NetworkMessage (7.2.4.4.2), un DateTime (Parte 6, 5.2.2.5): ticks de 100 ns desde 1601-01-01 00:00:00 UTC como Int64. Va después de la cabecera de carga útil y antes del DataSetMessage |

Como Count es 1, la carga útil no tiene array Sizes. El bloque no envía mensajes fragmentados, mensajes de descubrimiento, campos promovidos ni cabecera de seguridad, y un receptor que exija alguno de ellos no queda atendido por esta versión.

## DataSetMessage (Parte 14, 7.2.4.5.4 y 7.2.4.5.5)

| Bytes | Valor | Significado |
|---|---|---|
| 1 | `69` Variant, `6B` RawData; con marca `E9` y `EB` | DataSetFlags1: válido (bit 0), codificación de campo (bits 1 y 2: 00 Variant, 01 RawData), número de secuencia (bit 3), ConfigurationVersion major (bit 5) y minor (bit 6), y DataSetFlags2 (bit 7) cuando hay marca. El estado está ausente. Sin marca, DataSetFlags2 también está ausente y el tipo es el predeterminado, un Data Key Frame |
| 1 | `10`, solo con marca | DataSetFlags2: tipo de mensaje 0 (Data Key Frame) en los bits 0 a 3, Timestamp (bit 4) |
| 2 | Número de secuencia del DataSetMessage | cuenta los mensajes enviados, vuelve a 0 tras 65535 |
| 8 | Timestamp, solo con marca | el Timestamp del DataSetMessage (7.2.4.5.4), el mismo DateTime que el del NetworkMessage, después del número de secuencia |
| 4 | ConfigurationVersion major | `udiConfigMajor` |
| 4 | ConfigurationVersion minor | `udiConfigMinor` |
| 2 | FieldCount | solo Variant. Se omite en RawData (7.2.4.5.5) |
| ... | los campos | en el orden en que se añadieron |

## Varios DataSetMessages en un NetworkMessage

Tras `AddDataSet`, el Count del PayloadHeader es el número de DataSets y lista cada DataSetWriterId, y la carga útil empieza con el array Sizes, un tamaño en bytes UInt16 por DataSetMessage (7.2.4.5.3), seguido de los DataSetMessages uno tras otro. El DataSet 1 usa el writer id, el número de secuencia y la ConfigurationVersion propios del bloque; cada uno de los demás DataSets tiene su propio writer id, versión mayor y número de secuencia de DataSetMessage. El Timestamp del NetworkMessage y el de cada DataSetMessage son el mismo instante. Sin `AddDataSet` el mensaje es exactamente el de siempre, Count 1 y sin Sizes.

## Tramas delta y KeepAlives

Con `bDeltaFrames`, el tipo de DataSetMessage en DataSetFlags2 (bits 0 a 3) es 0 para una trama clave, 1 para un Data Delta Frame y 3 para un KeepAlive, y el bit de Timestamp sigue igual. Una trama clave sale primero y cada `uiKeyFrameEvery` mensajes. Entre ellas, el bloque compara la variable de cada campo (y su estado) con lo que llevó el último mensaje: una trama delta es `FieldCount` de los campos cambiados (UInt16), luego, para cada uno, su `FieldIndex` desde cero (UInt16) y su Variant; si nada cambió, el mensaje es un KeepAlive, la cabecera del DataSetMessage sin carga útil. Un KeepAlive lleva el número de secuencia del siguiente DataSetMessage y no lo consume, mientras que el número de secuencia del NetworkMessage sí lo cuenta. Los DataSets RawData envían siempre tramas clave.

## La marca de tiempo

El bloque lee el reloj de tiempo real del PLC una vez por mensaje con `SysTimeRtcHighResGet` (la biblioteca de sistema SysTimeRtc, que aporta el runtime), que son milisegundos desde 1970-01-01 UTC, y escribe `milliseconds * 10000 + 11644473600 * 10000000` como DateTime. Ambas marcas de un mensaje son ese único valor. Si el runtime no puede responder a la llamada de alta resolución, o `bHighResTimestamp` es FALSE, lee `SysTimeRtcGet` (segundos completos) y escribe `(seconds + 11644473600) * 10000000`, como hacía 1.1.0. De ahí se siguen dos cosas:

* La resolución es de un milisegundo (`bStampHighRes` indica qué reloj usó el último mensaje). Con el recurso a segundos completos, un receptor ve la misma marca en todos los mensajes dentro de un segundo.
* La hora es tan correcta como el reloj del PLC. Un controlador con el reloj sin configurar marca su mensaje con 1970. Cuando no se puede leer el reloj (`diLastClockResult` no es 0) el mensaje sale sin marca, lo que permite la Parte 14, en lugar de no salir.

Incremente `udiConfigMajor` siempre que cambie la lista de campos. Así, un receptor que guarde un diseño indexado por versión puede rechazar un mensaje construido para otra lista en lugar de decodificarlo mal.

## Campos, codificación Variant (Parte 6, 5.2.2.16)

Cada campo es un byte EncodingMask y después el valor. Los bits 0 a 5 de la máscara son el id de tipo integrado (Parte 6, 5.1.2, tabla 1), y el bit 7 indica que el valor es un array, en cuyo caso un recuento de elementos Int32 va antes de los elementos.

| Tipo de PLC | Id de tipo | Bytes del valor |
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
| STRING | 12 String | longitud Int32 en bytes, después UTF-8 (5.2.2.4) |
| un campo con estado Bad o Uncertain (`SetStatus`) | 19 StatusCode | 4, el estado UInt32, en lugar del valor (solo Variant) |
| WSTRING | 12 String | Longitud Int32 en bytes y luego UTF-8 (5.2.2.4) |
| TIME | 7 UInt32 | milisegundos, que es como se guarda un TIME de CODESYS |

Una STRING de CODESYS guarda un byte por carácter. Los bytes hasta `7F` son ASCII y salen sin cambios. Los bytes por encima de `7F` se leen como ISO 8859-1 y se escriben en su forma UTF-8 de dos bytes. Eso es una suposición sobre la página de códigos del PLC, y es el único punto en que el bloque interpreta texto.

Un WSTRING de CODESYS es UTF-16 y no necesita suposición alguna: cada unidad de 16 bits se escribe como UTF-8 (uno, dos o tres bytes), un par sustituto bien formado se convierte en el único carácter de cuatro bytes, y un sustituto suelto se convierte en U+FFFD, de modo que el texto es siempre UTF-8 válido. En RawData el MaxStringLength de un `WSTRING(N)` es `3 * N` bytes, lo máximo que puede ocupar.

## Campos, codificación RawData (Parte 14, 7.2.4.5.11)

Sin máscara y sin recuento: cada campo es solo su valor, en orden, así que el receptor debe conocer el diseño. La Parte 14 dice que los campos se "handled like a Structure DataType", de modo que cada valor se codifica como un campo de Structure en la Parte 6.

* **Los escalares** son sus bytes de valor, como en la tabla Variant, sin máscara.
* **Los arrays** son un recuento de elementos Int32 y después los elementos (Parte 6, 5.2.5: "One dimensional Arrays are encoded as a sequence of elements preceded by the number of elements encoded as an Int32 value"). El bloque siempre envía todos los elementos que se le dieron, así que el recuento es igual al tamaño declarado del array y no hay relleno después.
* **Las cadenas** son una longitud Int32 en bytes y los bytes UTF-8, y después bytes cero hasta MaxStringLength, así que el campo siempre ocupa 4 + MaxStringLength bytes (7.2.4.5.11: "the field shall be padded with bytes with value zero"). El bloque usa la N de `STRING(N)` como MaxStringLength, en bytes. El texto más largo se corta en un límite de carácter, porque el campo no puede crecer. Los metadatos de campo del receptor deben llevar el mismo MaxStringLength y una entrada ArrayDimensions por cada array.

Esta es la lectura de la pila de referencia de la propia OPC Foundation. En UA-.NETStandard (commit `fcfc84eab5c105780d7268474a47d344d100aca1`), `src/Opc.Ua.PubSub/Encoding/Uadp/UadpBinaryReader.cs`, líneas 389 a 403, dicen que una cadena se "read like a Structure field (Int32 length prefix and value) from a fixed-size 4 + MaxStringLength byte block whose remainder is zero padding", y que para un array "the array's Part 6 length (or dimensions) prefix gives the actual element count and the block is padded to product(arrayDimensions) elements". `TryReadPaddedArray`, en las líneas 593 a 648, lo implementa, y `tests/Opc.Ua.PubSub.Tests/Encoding/Uadp/UadpRawDataPaddingTests.cs` lo comprueba. `docs/PROOF.md` tiene el resto.

## Tamaño

El bloque construye el mensaje en un búfer de 1472 bytes: 1500 bytes de carga útil Ethernet menos 20 de IP y 8 de UDP, de modo que un mensaje nunca se fragmenta. Una lista de campos que no cabe deja el bloque en `ConfigError` con el error `TooBig`; no trunca. Un array REAL de 250 elementos en codificación Variant ocupa 1005 bytes, así que cabe un mensaje con ese array más la cabecera, y dos no caben.
