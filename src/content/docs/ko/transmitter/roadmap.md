---
title: "Transmitter 로드맵"
description: "HotLoop Transmitter가 이미 만든 것, 다음에 올 것, 그리고 의도적으로 계획하지 않은 것."
---

오늘 패키지에 들어 있는 것, 다음에 올 것, 의도적으로 계획하지 않은 것입니다. 한 항목은 실제 4.22.0.0 런타임에서 실행되고 수신기가 읽어 본 뒤에야 "출시됨"으로 옮겨집니다.

## 1.2.0에서 출시

* HotLoop Alarms, CODESYS 알람 관리자의 활성, 대기, 확인된 알람을 일반 변수로 읽고 HotLoop이 되써 주는 확인 응답을 수행하는 라이브러리입니다. 실제 4.22.0.0 런타임에서 실행했고 HotLoop의 알람 목록이 이를 읽었습니다.

## 1.1.0에서 출시

* DataSetMessage와 NetworkMessage 타임스탬프를 PLC의 실시간 시계에서 가져옵니다. 기본값은 켜짐이며 `bTimestamp`로 끕니다.
* 라이브러리를 CODESYS `.package`로 제공하며, CODESYS Installer로 설치합니다.

## 1.0.0에서 출시

* 퍼블리셔 블록 하나, `FB_HLTX_Publisher`: 발행 주기마다 NetworkMessage 하나, DataSetMessage 하나, Data Key Frame, UDP 위의 UADP를 SysSocket 위의 Structured Text로 구현.
* Variant와 RawData 필드 인코딩.
* BOOL, SINT, USINT, INT, UINT, DINT, UDINT, LINT, ULINT, REAL, LREAL, STRING, TIME 필드와 STRING을 뺀 모든 타입의 배열, 두 인코딩 모두.
* 유니캐스트와 멀티캐스트 대상, publisher id, writer group id, dataset writer id, 발행 주기, 그룹 버전, 구성 버전. 모두 블록의 입력으로 설정합니다.
* 논블로킹 전송, 호출당 제한된 비용, 전송, 거부, 건너뜀 카운터, 그리고 애플리케이션을 폴트시키지 않는 오류 상태.

## 다음

* 1초 미만 타임스탬프. 1.1.0의 타임스탬프는 실시간 시계의 정수 초입니다.
* 하나의 NetworkMessage에 여러 DataSetMessage(Sizes 배열)를 담아 데이터그램 하나가 writer를 둘 이상 실을 수 있게 합니다.
* 거의 변하지 않는 데이터셋의 바이트 수를 줄이는 Data Delta Frame과 KeepAlive 메시지.
* WSTRING 필드.
* 필드별 상태. Bad 값을 Bad로 보낼 수 있습니다.

## 계획 없음

* 메시지 보안(서명과 암호화). 이 블록은 공장이 이미 신뢰하는 네트워크에서 평문으로 보냅니다.
* 분할된 NetworkMessage. 1500바이트 프레임 하나에 들어가지 않는 메시지는 나누지 않고 거부합니다.
* 구독자 쪽. HotLoop core가 UADP를 구독하고, 이 라이브러리는 발행합니다.
* MQTT 전송. UDP는 CODESYS 런타임이 다른 라이브러리 없이 닿는 방식입니다.
