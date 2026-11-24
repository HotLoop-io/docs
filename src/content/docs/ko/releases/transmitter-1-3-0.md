---
title: "Transmitter 1.3.0 릴리스 노트"
description: "밀리초 타임스탬프, WSTRING 필드, 필드별 상태, 하나의 NetworkMessage에 여러 DataSet, KeepAlive가 있는 델타 프레임(기본값 꺼짐)."
---

HotLoop Transmitter는 CODESYS 프로젝트에 넣는 라이브러리로 PLC의 값을 OPC UA PubSub로 네트워크에 내보냅니다. 1.3.0은 밀리초 단위 타임스탬프, WSTRING 필드, 나쁜 값이 나쁜 값으로 나가도록 하는 필드별 상태, 하나의 NetworkMessage에 담긴 여러 DataSet, 그리고 KeepAlive 메시지가 있는 Data Delta Frame을 추가합니다. 라이브러리 버전은 1.3.0.0이며, HotLoop Alarms 1.0.0.0이 변경 없이 함께 제공됩니다.

이것이 의미하는 바: 이미 1.2.0을 쓰는 PLC 프로젝트는 이전과 같은 바이트를 보냅니다. 눈에 보이는 차이는 하나, 이제 타임스탬프에 밀리초가 있다는 것입니다. 나머지는 모두 호출이나 입력으로 켜는 것입니다.

## 새 기능

* **밀리초 단위 타임스탬프.** NetworkMessage와 DataSetMessage 모두 클록의 밀리초를 싣기 때문에, 구독자는 각 메시지가 속한 초가 아니라 만들어진 시점을 봅니다. `bStampHighRes`는 마지막 메시지가 어느 클록을 썼는지 알려 줍니다.
* **WSTRING 필드.** `AddWString(ADR(wName), N)`은 `WSTRING(N)`을 OPC UA String으로 Variant와 RawData에서 게시합니다. 텍스트는 UTF-8로 나갑니다. PLC에서 서로게이트 쌍인 U+FFFF 위의 문자는 4바이트 문자 하나로 나가고, 짝 없는 서로게이트는 U+FFFD로 나가므로 구독자가 읽는 것은 항상 유효한 텍스트입니다. RawData에서 필드의 MaxStringLength는 `3 * N` 바이트입니다.
* **필드별 상태.** 필드를 추가한 뒤 `SetStatus(ADR(udiStatus))`로 OPC UA StatusCode를 담은 UDINT에 묶습니다. 그 변수가 0이 아닌 동안 필드는 값 대신 StatusCode로 나가고 구독자는 나쁜 품질로 읽습니다. 0으로 되돌리면 다시 값이 나갑니다. RawData에는 상태를 실을 방법이 없으므로 RawData 퍼블리셔는 계속 값을 보냅니다.
* **하나의 NetworkMessage에 담긴 여러 DataSet.** `AddDataSet(uiWriterId, udiConfigMajor)`는 같은 블록 안에 DataSet을 하나 더 시작합니다. 이후 추가하는 필드는 그 DataSet에 속합니다. 게시 주기마다 NetworkMessage 하나가 DataSet당 DataSetMessage 하나를 Part 14가 요구하는 Sizes 배열과 함께 실어, 둘 이상의 writer가 데이터그램 하나를 공유합니다. 최대 8개의 DataSet입니다. 한 번도 호출하지 않으면 메시지는 1.2.0이 보내던 그대로입니다.
* **Data Delta Frame과 KeepAlive.** 안정적인 데이터셋은 이제 매 주기마다 모든 필드를 보낼 필요가 없습니다. 델타 프레임을 켜면 퍼블리셔는 먼저 전체 키 프레임을 보내고 이후 `uiKeyFrameEvery` 메시지마다 키 프레임을 보내며, 그 사이에는 변경된 필드만 담은 Data Delta Frame을, 아무것도 바뀌지 않았으면 KeepAlive를 보냅니다. `bDeltaActive`, `udiDeltaSent`, `udiKeepAliveSent`로 동작을 볼 수 있습니다.

## 1.2.0을 쓰는 프로젝트에서 달라지는 점

* 필드 목록과 전송 형식은 바뀌지 않았습니다. 전송 상의 유일한 차이는 타임스탬프의 밀리초 부분입니다.
* HotLoop Alarms 1.0.0.0이 변경 없이 릴리스에 들어 있습니다.

## 설정과 기본값

* `bHighResTimestamp`는 `TRUE`입니다. 클록의 밀리초로 타임스탬프를 찍습니다. `FALSE`로 두면 1.2.0과 똑같이 정수 초로 찍습니다. 런타임이 밀리초를 줄 수 없으면 블록이 스스로 정수 초로 찍습니다.
* `bDeltaFrames`는 `FALSE`입니다. 델타 프레임은 퍼블리셔에서 켜는 설정이지 블록이 알아서 하는 일이 아니므로, 가진 모든 구독자는 계속 전체 키 프레임을 읽습니다. writer 하나에 켜려면 그 퍼블리셔에 `bDeltaFrames := TRUE`를 설정하고, 키 프레임 간격을 바꾸려면 `uiKeyFrameEvery`(설정하지 않으면 10)를 설정합니다. 각 퍼블리셔가 스스로 정하므로 한 writer는 델타를 보내고 나머지는 보내지 않을 수 있습니다. 델타 프레임을 버리는 구독자는 다음 키 프레임에서 변경을 보게 되므로, 델타 프레임을 읽는 구독자에게 켜세요. DataSet이 하나인 Variant 퍼블리셔에 적용되며, RawData 퍼블리셔나 DataSet이 둘 이상인 블록은 키 프레임을 보냅니다.
* `AddDataSet`, `AddWString`, `SetStatus`는 다른 `Add` 호출처럼 시작할 때 한 번 하는 호출입니다. 이것들이 없으면 아무것도 바뀌지 않습니다.

## 업그레이드

`HotLoopTransmitter-1.3.0.library`를 설치하고(또는 CODESYS Installer로 `.package`를 열고), 프로젝트의 Library Manager에서 라이브러리 버전을 1.3.0.0으로 바꾼 뒤 컴파일하세요. 코드는 바꿀 필요가 없습니다. 새 호출이 하는 일이 필요할 때 추가하세요.

## 되돌리기

1.2.0에 고정된 프로젝트는 계속 동작하며 이전과 같은 바이트를 정수 초 타임스탬프와 함께 보냅니다. HotLoop Alarms는 별도의 라이브러리이므로 영향을 받지 않습니다.

## 이 릴리스에 없는 것

메시지 보안, 분할된 NetworkMessage, 구독자 측, MQTT 전송.

## 파일

```
e68cfc88e599ddcf278eb208ff500f4f78d3faf74edf12e38f308a009f478594  HotLoopAlarms-1.0.0.0.compiled-library
68f704fc5662bbc67ec097016a741065d705af01913a2746296c17f9e6991118  HotLoopAlarms-1.0.0.0.library
5be90a88e9e0aae1de421628fb6ca8e810dda96b4562566df345d451ecd859cf  HotLoopTransmitter-1.3.0.compiled-library
0410b98578fd55775a97b27023a0b5f30111cac0587120894354d9edca1248fc  HotLoopTransmitter-1.3.0.library
3e791358e6dc628a2d2aae760e0c49c89f1c4490f0637b65864c335fcbb3e9a0  HotLoopTransmitter-1.3.0.package
```
