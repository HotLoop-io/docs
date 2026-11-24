---
title: "HotLoop Transmitter 개요"
description: "SysSocket UDP 위에서 Structured Text로 작성된 CODESYS 라이브러리로, 다른 라이브러리나 구성 도구 없이 PLC 값을 OPC UA PubSub(UADP)로 발행합니다."
---

HotLoop Transmitter는 CODESYS 프로젝트에 넣는 라이브러리로, OPC UA 사양 14부가 정한 방식 그대로 PLC 값을 OPC UA PubSub으로 네트워크에 내보냅니다. 계측 루프에서 말하는 트랜스미터와 같습니다. 공정 값을 선로에 실어 다른 장치가 읽게 하는 부분입니다.

`SysSocket` UDP 위에서 Structured Text로 작성되어 다른 라이브러리도, 추가 라이선스도, 구성 도구도 필요 없습니다. 라이브러리를 추가하고 사이클마다 펑션 블록을 한 번 호출하면, 발행 주기마다 UADP NetworkMessage가 유니캐스트 주소나 멀티캐스트 그룹으로 나갑니다.

이것이 의미하는 바: PubSub 라이브러리가 없는 PLC도 Structured Text 몇 줄이면 OPC UA PubSub을 구독하는 모든 것, HotLoop 자체를 포함해 데이터를 공급할 수 있습니다. 모든 메시지에는 PLC 시계의 타임스탬프가 들어가며, `bTimestamp`로 끌 수 있습니다.

## Go가 아니라 Structured Text인 이유

HotLoop의 새 도구는 실질적인 이유가 없는 한 모두 Go로 작성합니다. 여기가 그 실질적인 이유입니다. 이 라이브러리는 PLC 자신의 스캔 안에서, IEC 61131-3 런타임 안에서, 프로그래머가 프로젝트에서 참조하는 라이브러리로 실행되어야 합니다. CODESYS 런타임은 Go가 아니라 Structured Text를 실행합니다. 라이브러리 주변의 테스트와 도구(캡처 도구, 검증기)는 Go입니다.

## 사용 방법

1. `HotLoopTransmitter-1.3.0.library`를 CODESYS 라이브러리 저장소에 설치하거나(Tools, Library Repository, Install), CODESYS Installer로 `HotLoopTransmitter-1.3.0.package`를 설치한 뒤 프로젝트의 Library Manager에 추가합니다. [설치 페이지](/ko/transmitter/install/)에 다운로드와 자세한 내용이 있습니다.
2. 퍼블리셔를 선언하고, 발행할 변수를 시작할 때 한 번 추가한 다음, 사이클마다 호출합니다.

```iecst
PROGRAM PLC_PRG
VAR
    pub : HLTX.FB_HLTX_Publisher;
    bInit : BOOL;
END_VAR

IF NOT bInit THEN
    bInit := TRUE;
    pub.sDestination := '239.0.0.22';        // a unicast host or a multicast group
    pub.uiPort := 4840;
    pub.uiPublisherId := 1;
    pub.uiWriterGroupId := 1;
    pub.uiDataSetWriterId := 1;
    pub.tPublishingInterval := T#100MS;
    pub.AddReal(ADR(GVL.rTemperature));
    pub.AddBool(ADR(GVL.bRunning));
    pub.AddArray(ADR(GVL.aValues), HLTX.E_HLTX_Type.REAL_T, 250);
END_IF
pub.bEnable := TRUE;
pub();
```

[API 페이지](/ko/transmitter/api/)에 모든 입력, 출력, 메서드가 나와 있습니다. [와이어 포맷 페이지](/ko/transmitter/wire-format/)는 패킷을 바이트 단위로 보여 주며, 각 바이트를 정의하는 사양의 절을 함께 안내합니다.

## 스캔에 하는 일과 하지 않는 일

* 절대 블로킹하지 않습니다. 소켓은 논블로킹이고 메시지는 고정 버퍼에서 만듭니다.
* 호출 비용은 메시지 하나를 만드는 비용이며, 메시지가 나가는 사이클에서만 발생합니다. 퍼블리셔 두 개와 타임스탬프를 켠 20 ms 태스크에서 측정한 결과, 사이클당 평균 약 9.6 us가 더해졌고, 전송하는 사이클에서는 10에서 100 us, 실행 중 가장 긴 사이클은 81 us였습니다. 바쁜 호스트에서는 전송 한 번이 수 밀리초로 늘어난 적이 있습니다. 측정값과 그 한계는 [타이밍 페이지](/ko/transmitter/timing/)에 있습니다.
* 소켓 오류, 잘못된 주소, 너무 큰 필드 목록 때문에 애플리케이션이 폴트 나는 일은 없습니다. 블록이 `eState`와 `eError`를 보고하고 실패 횟수를 센 뒤, 프로그램은 계속 스캔합니다.
* 단편화하지 않습니다. 메시지는 최대 1472바이트입니다. 필드 목록이 들어가지 않으면 블록은 `ConfigError`가 되고 아무것도 보내지 않습니다.

## 테스트 환경

CODESYS Control for Linux SL 4.22.0.0 런타임과 베어메탈(2026-11-17). 무엇을 실행하고 무엇을 다시 읽어 확인했는지는 [타이밍 페이지](/ko/transmitter/timing/)와 [검증 페이지](/ko/transmitter/proof/)를 보세요.

공장에서 쓰시나요? [업무에서 HotLoop 사용하기](/ko/business/)에서 라이선스와 문의 방법을 안내합니다.

## 라이선스

모든 HotLoop 제품과 같은 HotLoop Source License Agreement 1.0입니다. 무료로 사용할 수 있고 소스가 공개되어 있지만 OSI 기준의 오픈 소스는 아니며, 5절에 따라 라이브러리를 자체 PLC 프로젝트에 넣고 컴파일된 결과물을 납품하거나 판매할 수 있습니다. 라이브러리 자체는 안 됩니다. [라이선스 페이지](https://hotloop.io/license/)에 전문이 있습니다.
