---
title: "Transmitter API 안내"
description: "HotLoop Transmitter 퍼블리셔 펑션 블록의 모든 입력, 출력, 메서드."
---

모든 것은 `HLTX` 네임스페이스에 있습니다. 블록은 `HLTX.FB_HLTX_Publisher`입니다.

## 입력

| 입력 | 타입 | 기본값 | 의미 |
|---|---|---|---|
| `bEnable` | BOOL | FALSE | TRUE이면 소켓을 열고 발행을 시작합니다. FALSE이면 소켓을 닫고 블록을 `Disabled`로 되돌리며, `ConfigError`도 해제됩니다 |
| `sDestination` | STRING(15) | `127.0.0.1` | 점으로 구분한 IPv4 주소: 유니캐스트 호스트, 또는 224.0.0.0에서 239.255.255.255 사이의 멀티캐스트 그룹 |
| `uiPort` | UINT | 4840 | 대상 UDP 포트. 4840은 OPC UA가 등록한 포트입니다 |
| `sLocalAddress` | STRING(15) | 비어 있음 | 멀티캐스트 전용: 전송에 사용할 인터페이스의 주소. 비워 두면 OS가 선택합니다 |
| `usiMulticastTTL` | USINT | 1 | 멀티캐스트 time to live |
| `uiPublisherId` | UINT | 1 | PublisherId, UInt16으로 전송 |
| `uiWriterGroupId` | UINT | 1 | WriterGroupId |
| `uiDataSetWriterId` | UINT | 1 | DataSetWriterId |
| `tPublishingInterval` | TIME | T#100MS | 메시지 간격. 최소 T#1MS. 블록은 사이클에서만 전송할 수 있으므로 실제 주기는 이 값을 호출하는 태스크 사이클의 정수 배로 올림한 값입니다 |
| `eEncoding` | `E_HLTX_Encoding` | `Variant` | `Variant` 또는 `RawData`. 비활성 상태에서 변경하세요 |
| `udiGroupVersion` | UDINT | 1 | 그룹 헤더의 GroupVersion |
| `udiConfigMajor`, `udiConfigMinor` | UDINT | 1, 0 | DataSet ConfigurationVersion. 필드 목록이 바뀔 때마다 major를 올리세요 |
| `bTimestamp` | BOOL | TRUE | 모든 메시지에 PLC 시계의 타임스탬프를 NetworkMessage와 DataSetMessage에 찍습니다(정수 초, [선로에 실리는 내용](/ko/transmitter/wire-format/) 참조). FALSE이면 1.0.0과 같은 바이트를 보내며 17바이트 더 짧습니다 |
| `tRetry` | TIME | T#2S | 연속 열 번 전송에 실패한 뒤 소켓을 다시 열기까지 기다리는 시간 |

## 출력

| 출력 | 타입 | 의미 |
|---|---|---|
| `eState` | `E_HLTX_State` | `Disabled`, `Running`, `Backoff`(소켓 재오픈 대기), `ConfigError`(`eError` 참조, 아무것도 전송하지 않음) |
| `eError` | `E_HLTX_Error` | `None`, `NoFields`, `BadInterval`, `BadAddress`, `SocketCreate`, `SocketOption`, `TooBig`, `BadField` |
| `bActive` | BOOL | 메시지가 나가는 동안 TRUE |
| `udiSent` | UDINT | 네트워크에 넘긴 메시지 수 |
| `udiSendErrors` | UDINT | OS가 거부했거나 중간에 끊은 전송 수 |
| `udiSkipped` | UDINT | 태스크가 늦어 놓친 발행 슬롯 수 |
| `uiMessageSize` | UINT | 마지막 메시지의 바이트 수 |
| `diLastSocketResult` | UDINT | 소켓 호출에서 받은 마지막 런타임 오류 코드, 0이면 정상 |
| `diLastClockResult` | UDINT | 타임스탬프를 위해 PLC 시계를 읽은 마지막 결과, 0이면 정상. 0이 아니면 메시지는 타임스탬프 없이 나갑니다 |
| `udiLastCallUs`, `udiMaxCallUs` | UDINT | 블록의 마지막 호출에 쓴 마이크로초와, 활성화 또는 `Clear()` 이후 가장 긴 값 |
| `udiMaxEncodeUs`, `udiMaxSendUs` | UDINT | 활성화 또는 `Clear()` 이후, 메시지 하나를 만드는 데 걸린 가장 긴 시간과 전송 호출 자체에 걸린 가장 긴 시간 |

## 메서드

필드는 첫 호출 전에 한 번, 수신자가 읽어야 하는 순서대로 추가합니다. 각 메서드는 필드가 받아들여지면 TRUE를 반환합니다. 최대 128개 필드입니다.

| 메서드 | 추가하는 것 |
|---|---|
| `AddBool(pValue)`, `AddSInt`, `AddUSInt`, `AddInt`, `AddUInt`, `AddDInt`, `AddUDInt`, `AddLInt`, `AddULInt`, `AddReal`, `AddLReal`, `AddTime` | 스칼라 하나. `pValue`는 `ADR(variable)` |
| `AddString(pValue, uiMaxLen)` | STRING 하나. `uiMaxLen`은 `STRING(N)`의 N |
| `AddArray(pFirst, eType, uiCount)` | STRING을 제외한 임의 타입의 `uiCount`개 요소 배열. `pFirst`는 `ADR(array[first])` |
| `AddField(pData, eType, uiCount, uiMaxLen)` | 다른 메서드들이 호출하는 일반 형태 |
| `Clear()` | 필드 목록과 최대 호출 시간을 지움 |

블록은 사용자가 준 주소를 그대로 보관하므로, 변수를 옮기는 온라인 변경 후에는 `Clear()`를 호출하고 필드를 다시 추가하세요. WORD, DWORD, LWORD는 같은 크기의 메서드를 통해 UINT, UDINT, ULINT로 들어갑니다.

## 호출 방법

인스턴스는 한 태스크에서 사이클마다 한 번 호출하세요. 하나의 인스턴스를 두 태스크에서 호출하지 마세요. 한 프로그램에 퍼블리셔가 여러 개 있어도 괜찮고 각각 자신의 소켓을 가집니다. 각각에 고유한 writer group id와 dataset writer id를 주세요.
