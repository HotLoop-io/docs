---
title: "선로에 실리는 내용"
description: "HotLoop Transmitter가 보내는 NetworkMessage와 DataSetMessage를 바이트 단위로, 각각을 정의하는 OPC 10000-14와 10000-6의 절과 함께 설명합니다."
---

아래의 모든 바이트는 2026-10-31에 reference.opcfoundation.org에서 읽은 OPC 10000-14(14부, PubSub) 1.05판과 OPC 10000-6(6부, 매핑)에서 나온 것입니다. 바이트가 이상해 보일 때 열어 볼 곳이 절 번호입니다. 다른 업체의 패킷을 들여다보고 알아낸 것은 하나도 없습니다.

퍼블리셔 블록 하나는 발행 주기마다 NetworkMessage 하나를 보냅니다. NetworkMessage는 DataSetMessage 하나, 즉 Data Key Frame을 담으므로 모든 메시지가 모든 필드를 가집니다. 1.1.0부터 `bTimestamp`가 FALSE가 아니면 모든 메시지가 NetworkMessage와 DataSetMessage 모두에 PLC 시계의 타임스탬프를 담으며, FALSE이면 바이트는 1.0.0과 완전히 같습니다. 표는 둘 다 보여 주며, 타임스탬프 있음으로 표시한 행은 타임스탬프가 켜져 있을 때만 존재합니다.

여러 바이트 값은 모두 리틀 엔디언이며, OPC UA 바이너리가 그렇게 정의되어 있습니다. 블록이 바이트 단위로 쓰므로 호스트의 바이트 순서는 상관없습니다.

## NetworkMessage (14부, 7.2.4.4.2)

| 바이트 | 값 | 의미 |
|---|---|---|
| 1 | `F1` | 비트 0에서 3에 UADPVersion 1. 비트 4에서 7에 UADPFlags: PublisherId(비트 4), GroupHeader(비트 5), PayloadHeader(비트 6), ExtendedFlags1(비트 7)이 모두 존재 |
| 1 | 타임스탬프 있음 `21`, 없음 `01` | ExtendedFlags1: 비트 0에서 2에 PublisherId 타입 001 = UInt16, 타임스탬프가 있으면 Timestamp(비트 5). DataSetClassId, 보안 헤더, PicoSeconds, ExtendedFlags2 없음 |
| 2 | PublisherId | `uiPublisherId` |
| 1 | `0F` | GroupFlags: WriterGroupId, GroupVersion, NetworkMessageNumber, SequenceNumber 존재 |
| 2 | WriterGroupId | `uiWriterGroupId` |
| 4 | GroupVersion | `udiGroupVersion` |
| 2 | NetworkMessageNumber | 항상 1. 0은 유효하지 않기 때문 |
| 2 | SequenceNumber | 보낸 메시지를 세며 65535 다음에 0으로 돌아감 |
| 1 | Count | 항상 1(페이로드 헤더, 7.2.4.5.2) |
| 2 | DataSetWriterId | `uiDataSetWriterId` |
| 8 | Timestamp, 타임스탬프 있을 때만 | NetworkMessage Timestamp(7.2.4.4.2), DateTime(6부, 5.2.2.5): 1601-01-01 00:00:00 UTC 이후 100 ns 틱을 Int64로. 페이로드 헤더 뒤, DataSetMessage 앞에 옴 |

Count가 1이므로 페이로드에는 Sizes 배열이 없습니다. 블록은 분할 메시지, 디스커버리 메시지, 승격 필드, 보안 헤더를 보내지 않으며, 이 중 하나를 요구하는 수신자는 이 버전으로는 지원되지 않습니다.

## DataSetMessage (14부, 7.2.4.5.4와 7.2.4.5.5)

| 바이트 | 값 | 의미 |
|---|---|---|
| 1 | `69` Variant, `6B` RawData. 타임스탬프 있으면 `E9`와 `EB` | DataSetFlags1: 유효(비트 0), 필드 인코딩(비트 1과 2: 00 Variant, 01 RawData), 시퀀스 번호(비트 3), ConfigurationVersion major(비트 5)와 minor(비트 6), 타임스탬프가 있으면 DataSetFlags2(비트 7). Status는 없음. 타임스탬프가 없으면 DataSetFlags2도 없고 타입은 기본값인 Data Key Frame |
| 1 | `10`, 타임스탬프 있을 때만 | DataSetFlags2: 비트 0에서 3에 메시지 타입 0(Data Key Frame), 비트 4에 Timestamp |
| 2 | DataSetMessage 시퀀스 번호 | 보낸 메시지를 세며 65535 다음에 0으로 돌아감 |
| 8 | Timestamp, 타임스탬프 있을 때만 | DataSetMessage Timestamp(7.2.4.5.4), NetworkMessage와 같은 DateTime이며 시퀀스 번호 뒤에 옴 |
| 4 | ConfigurationVersion major | `udiConfigMajor` |
| 4 | ConfigurationVersion minor | `udiConfigMinor` |
| 2 | FieldCount | Variant에서만. RawData에서는 생략(7.2.4.5.5) |
| ... | 필드들 | 추가한 순서대로 |

## 타임스탬프

블록은 메시지마다 `SysTimeRtcGet`(런타임이 제공하는 SysTimeRtc 시스템 라이브러리)으로 PLC의 실시간 시계를 한 번 읽습니다. 이 값은 1970-01-01 UTC 이후의 정수 초이며, 블록은 `(seconds + 11644473600) * 10000000`을 DateTime으로 씁니다. 메시지 안의 두 타임스탬프는 이 하나의 값입니다. 여기서 두 가지가 따라옵니다.

* 해상도는 1초입니다. 수신자는 같은 1초 안의 모든 메시지에서 같은 타임스탬프를 보며, 메시지를 만든 순간보다 최대 1초 뒤처집니다. 1초 미만 타임스탬프는 로드맵에 있습니다.
* 시간은 PLC 시계만큼만 정확합니다. 시계를 설정하지 않은 컨트롤러는 메시지에 1970년을 찍습니다. 시계를 읽을 수 없으면(`diLastClockResult`가 0이 아님) 메시지를 아예 안 보내지 않고 타임스탬프 없이 보내며, 14부가 이를 허용합니다.

필드 목록이 바뀔 때마다 `udiConfigMajor`를 올리세요. 그러면 버전별로 레이아웃을 보관하는 수신자가 다른 목록용으로 만든 메시지를 잘못 디코드하는 대신 거부할 수 있습니다.

## 필드, Variant 인코딩 (6부, 5.2.2.16)

각 필드는 EncodingMask 바이트 하나와 값입니다. 마스크의 비트 0에서 5는 내장 타입 id(6부, 5.1.2, 표 1)이고, 비트 7은 값이 배열임을 뜻하며 이때는 요소 앞에 Int32 요소 개수가 옵니다.

| PLC 타입 | 타입 id | 값 바이트 |
|---|---|---|
| BOOL | 1 Boolean | 1, `00` 또는 `01` |
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
| STRING | 12 String | 바이트 단위 Int32 길이, 그다음 UTF-8(5.2.2.4) |
| TIME | 7 UInt32 | 밀리초. CODESYS TIME이 저장되는 방식 |

CODESYS STRING은 문자당 한 바이트를 가집니다. `7F`까지의 바이트는 ASCII이며 그대로 나갑니다. `7F`를 넘는 바이트는 ISO 8859-1로 읽어 두 바이트 UTF-8 형태로 씁니다. 이것은 PLC 코드 페이지에 대한 가정이며, 블록이 텍스트를 해석하는 유일한 곳입니다.

## 필드, RawData 인코딩 (14부, 7.2.4.5.11)

마스크도 개수도 없습니다. 각 필드는 순서대로 값 그 자체이므로 수신자가 레이아웃을 알아야 합니다. 14부는 필드가 "handled like a Structure DataType"이라고 하므로, 각 값은 6부에서 Structure 필드를 인코딩하는 방식으로 인코딩됩니다.

* **스칼라**는 Variant 표와 같은 값 바이트이며 마스크가 없습니다.
* **배열**은 Int32 요소 개수와 그다음 요소들입니다(6부, 5.2.5: "One dimensional Arrays are encoded as a sequence of elements preceded by the number of elements encoded as an Int32 value"). 블록은 받은 모든 요소를 항상 보내므로 개수는 배열의 선언된 크기와 같고 뒤에 패딩이 없습니다.
* **문자열**은 바이트 단위 Int32 길이와 UTF-8 바이트, 그다음 MaxStringLength까지 0 바이트이므로 필드는 항상 4 + MaxStringLength바이트입니다(7.2.4.5.11: "the field shall be padded with bytes with value zero"). 블록은 `STRING(N)`의 N을 바이트 단위 MaxStringLength로 씁니다. 더 긴 텍스트는 필드가 커질 수 없으므로 문자 경계에서 잘립니다. 수신자의 필드 메타데이터에는 같은 MaxStringLength와 배열마다 ArrayDimensions 항목이 있어야 합니다.

이것은 OPC Foundation 자체 참조 스택의 해석입니다. UA-.NETStandard(커밋 `fcfc84eab5c105780d7268474a47d344d100aca1`)의 `src/Opc.Ua.PubSub/Encoding/Uadp/UadpBinaryReader.cs` 389행에서 403행은 문자열을 "read like a Structure field (Int32 length prefix and value) from a fixed-size 4 + MaxStringLength byte block whose remainder is zero padding"이라고, 배열은 "the array's Part 6 length (or dimensions) prefix gives the actual element count and the block is padded to product(arrayDimensions) elements"라고 합니다. 593행에서 648행의 `TryReadPaddedArray`가 이를 구현하고 `tests/Opc.Ua.PubSub.Tests/Encoding/Uadp/UadpRawDataPaddingTests.cs`가 검증합니다. 나머지는 [검증 페이지](/ko/transmitter/proof/)에 있습니다.

## 크기

블록은 1472바이트 버퍼에 메시지를 만듭니다. 이더넷 페이로드 1500바이트에서 IP 20바이트와 UDP 8바이트를 뺀 값이라 메시지는 절대 단편화되지 않습니다. 들어가지 않는 필드 목록은 블록을 오류 `TooBig`와 함께 `ConfigError`로 만들며, 잘라 내지 않습니다. Variant 인코딩의 250개 요소 REAL 배열은 1005바이트이므로 그 배열과 헤더를 합친 메시지는 들어가고, 두 개는 들어가지 않습니다.
