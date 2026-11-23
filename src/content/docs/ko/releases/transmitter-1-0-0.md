---
title: "Transmitter 1.0.0 릴리스 노트"
description: "HotLoop Transmitter의 첫 릴리스. PLC 값을 OPC UA PubSub으로 게시하는 CODESYS 라이브러리의 구성, 실행한 것, 실행하지 않은 것."
---

첫 릴리스입니다. SysSocket UDP 위에서 Structured Text로 작성한 CODESYS 라이브러리로, PLC의 값을 OPC UA PubSub(파트 14, UADP)로 네트워크에 내보냅니다. 라이브러리를 추가하고, 펑션 블록 하나를 선언하고, 내보낼 변수를 추가한 뒤, 사이클마다 한 번 호출하면 됩니다. OPC UA PubSub을 구독하는 것이면 무엇이든 읽을 수 있으며, 4.19.4부터는 HotLoop core도 읽습니다.

이것이 의미하는 바: PubSub 라이브러리가 없는 PLC도 약 열다섯 줄의 Structured Text만으로 PubSub 구독자에게 값을 공급할 수 있으며, 컨트롤러에는 다른 것을 설치하지 않습니다.

## 구성

* 블록 하나, `HLTX.FB_HLTX_Publisher`. 게시 간격마다 NetworkMessage 하나, DataSetMessage 하나, Data Key Frame 하나이므로 모든 메시지가 모든 필드를 담습니다.
* 게시자마다 고르는 Variant와 RawData 필드 인코딩. Variant는 자체 타입을 담습니다. RawData는 아무것도 담지 않으므로 수신 측에 레이아웃을 알려 주어야 하며, [와이어 포맷 페이지](/ko/transmitter/wire-format/)가 바이트 단위로 설명합니다.
* BOOL, SINT, USINT, INT, UINT, DINT, UDINT, LINT, ULINT, REAL, LREAL, STRING, TIME 필드와, STRING을 제외한 모든 타입의 배열을 메시지당 최대 128개 필드, 1472바이트까지 지원합니다. 메시지는 절대 분할되지 않습니다.
* 유니캐스트 또는 멀티캐스트. 입력은 게시자 ID, 라이터 그룹 ID, 데이터셋 라이터 ID, 게시 간격, 그룹 버전, 설정 버전입니다.
* 논블로킹 전송. 잘못된 주소, 끊어진 소켓, 너무 큰 필드 목록은 블록을 읽을 수 있는 오류 상태로 만들 뿐, 애플리케이션을 결함 상태로 만들지 않습니다.

## 실행한 것과 그 결과

모두 CODESYS Control for Linux SL 4.22.0.0에서, 아래 파일로 실행했습니다.

* 라이브러리는 CODESYS 3.5.22.30에서 오류 0, 경고 0으로 빌드됩니다. 예제 애플리케이션도 이를 기반으로 오류 0, 경고 0으로 빌드됩니다.
* 게시자 둘, Variant 하나와 RawData 하나, 각각 필드 열일곱 개. 네트워크상의 모든 값이 PLC가 자체 OPC UA 서버로 보고하는 값과 같았고, 시퀀스 번호에 빈틈이 없었습니다.
* 독립된 PubSub 스택이 Variant 메시지 전체와 RawData 스칼라를 디코딩합니다. RawData 배열과 긴 RawData 문자열은 전혀 읽지 못하는데, 이는 라이브러리가 아니라 그 스택의 한계입니다.
* HotLoop core의 구독자(이 시험 때는 main 브랜치, 그리고 HotLoop core 4.19.4와 이후 모든 릴리스)는 문자열, TIME, 배열 둘, 읽는 사이에 값이 바뀌는 카운터 둘을 포함해 두 게시자를 모두 읽고, 거부하는 것이 없습니다.
* 두 번째 디코더가 캡처한 데이터그램 222개를 모두 읽습니다.
* 20 ms 태스크에서 게시자 둘일 때의 비용: 사이클당 평균 약 10.6 us 추가. 전송이 일어나는 사이클은 10에서 100 us가 듭니다. 꼬리는 `sendto` 호출이며, 바쁜 공유 호스트에서는 12 000사이클 중 한 번 14.3 ms에 이르렀습니다. 제어 로직에 중요하다면 게시자를 우선순위가 낮은 자체 태스크에 두십시오. [타이밍 페이지](/ko/transmitter/timing/)에 표가 있습니다.

## 컨트롤러에서 확인할 것

* 빅 엔디언 타깃의 바이트 순서 처리는 작성되어 있으니, 사용하는 컨트롤러에서 확인하십시오.
* 멀티캐스트: 블록이 그룹의 TTL, 루프백, 송신 인터페이스를 설정하므로, 사용하는 네트워크에서 그룹을 확인하십시오.
* 네트워크가 사라지거나 주소가 없으면 블록은 실패를 세고 재시도 간격을 늘리며, 프로그램은 계속 스캔합니다.
* 데모 모드에서는 CODESYS가 안내하는 대로 런타임이 두 시간 창이 끝나면 멈춥니다.

## 이 릴리스에 없는 것

DataSetMessage와 NetworkMessage 타임스탬프, KeepAlive와 Delta Frame, NetworkMessage당 둘 이상의 DataSetMessage, WSTRING, 필드별 상태, 메시지 보안, 구독자 측. [로드맵](/ko/transmitter/roadmap/)에 다음 순서가 있습니다.

## 다른 게시자에서 옮겨 오는 경우

타임스탬프, KeepAlive, Delta Frame을 요구하는 수신 측은 이 버전에 만족하지 못합니다. 셋 다 전송하지 않기 때문입니다. 모든 메시지는 Key Frame이며, 어떤 수신 측도 사전 정보 없이 읽을 수 있습니다. 여기서 RawData 배열은 Int32 길이, 요소들, 선언된 크기까지의 0 패딩이며, OPC Foundation 레퍼런스 스택이 쓰는 방식입니다. 배열을 길이 없이 요소가 이어진 것으로 기대하는 수신 측에는 필드가 개별 스칼라라고 알려 주어야 합니다.

## 이미 사용 중인 프로젝트의 경우

이전 버전은 없습니다. 와이어 포맷은 `udiConfigMajor`가 바뀔 때만 바뀌며, 이 라이브러리 버전에 고정된 PLC 프로젝트는 같은 필드와 같은 바이트를 유지합니다.

## 파일

https://hotloop.io/hotloop-transmitter/1.0.0/ 에서 두 파일과 `SHA256SUMS`를 내려받은 뒤, CODESYS 3.5 SP22 이상에서 Tools, Library Repository, Install로 `HotLoopTransmitter-1.0.0.library`를 설치하십시오. `.compiled-library`는 소스 없이 같은 라이브러리입니다.

```
91b8023a73870925082c170588feb43d363e6d07ce008e1471fa8f5ff8db2c0d  HotLoopTransmitter-1.0.0.library
b02b0b40e434f35e4af1def20d6cc38688463537c4800354931b8c6094a66686  HotLoopTransmitter-1.0.0.compiled-library
```
