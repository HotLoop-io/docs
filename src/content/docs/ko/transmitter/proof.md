---
title: "실행한 내용"
description: "라이브러리를 무엇으로 빌드하고 어디서 실행하고 누가 다시 읽었는지, 그리고 두 판독기가 어긋나는 한 곳."
---

이 페이지는 1.0.0 실행 기록입니다. 타임스탬프와 `.package`가 있는 1.1.0 실행은 [1.1.0 릴리스 노트](/ko/releases/transmitter-1-1-0/)에 있습니다. 이후 라이브러리는 베어메탈에서도 실행했습니다(2026-11-17).

## 빌드

* 라이브러리: CODESYS 3.5.22.30(SP22 Patch 3) ScriptEngine에서 오류 0, 경고 0으로 컴파일됩니다.
* 설치된 라이브러리로 빌드한 예제 애플리케이션, 대상은 CODESYS Control for Linux SL 장치(4102, 0000 0005, 4.20.0.0): 오류 0, 경고 0, 다운로드 준비 완료.

## 런타임

CODESYS Control for Linux SL 4.22.0.0은 애플리케이션을 부트 프로젝트로 불러와 `Application started`, `CODESYS Control ready`를 보고합니다. 런타임 라이선스가 없으므로 데모 모드로 동작합니다.

## 선로에 흐른 것과 읽은 쪽

예제 애플리케이션에는 퍼블리셔가 둘 있습니다. writer group 1과 dataset writer 1은 Variant 인코딩(1142바이트), writer group 2와 dataset writer 2는 RawData 인코딩(1144바이트)입니다. 각각 필드 열일곱 개로, 라이브러리가 지원하는 타입별로 하나씩, 250개 요소의 REAL 배열, 4개 요소의 INT 배열, 카운터 둘입니다.

서로 독립된 판독기 넷이 읽었습니다.

| 판독기 | 정체 | Variant | RawData |
|---|---|---|---|
| 사양에서 직접 작성한 디코더 | OPC 10000-14와 10000-6만으로 작성했고, 런타임의 OPC UA 서버에서 같은 변수를 읽어 비교하기도 함 | 모든 필드가 PLC 값과 같고, 캡처 동안 NetworkMessage와 DataSetMessage 시퀀스 번호에 빈틈 없음 | 동일 |
| 독립된 OPC UA PubSub 스택 | 17개 필드의 DataSet 메타데이터를 가진 구독자 | 확인한 15개 값이 모두 같음(문자열, 두 배열, TIME 포함) | 숫자 스칼라 11개가 같음. 그 스택은 어떤 길이의 RawData 문자열도, RawData 배열도 전혀 읽지 못함 |
| HotLoop core의 UADP 구독자 | HotLoop core 4.19.4와 이후 모든 릴리스의 드라이버. 실행 중인 런타임을 대상으로, DataSet 타입에 RawData 레이아웃을 알려 준 상태로 실행 | 21개 값이 같음(문자열, TIME, 250개 REAL 배열의 0, 1, 124, 249번 요소, INT 배열 네 개 전부 포함), 3초 간격의 두 번 읽기 사이에 두 카운터가 모두 증가 | 같은 21개 값과 같은 두 카운터. key frame 62개 수신, 거부 없음 |
| 두 번째 디코더 | 자체 수신기 코드의 UADP 디코더. 17개 필드 레이아웃으로 캡처한 데이터그램 222개에 실행 | 메시지 111개 모두 디코드, 확인한 모든 값이 정확 | 메시지 111개 모두 디코드, 확인한 모든 값이 정확, 배열은 Int32 길이와 패딩 포함 |

## RawData 배열과 문자열

이 라이브러리는 RawData 배열마다 앞에 Int32 요소 개수를 쓰고, 문자열은 Int32 길이, 그 바이트, 그리고 MaxStringLength까지 0 패딩 순으로 씁니다. OPC Foundation의 참조 스택이 하는 방식이며 사양 본문을 따릅니다. OPC 10000-14 7.2.4.5.11("handled like a Structure DataType", 패딩 "to the maximum size indicated by ArrayDimensions or MaxStringLength")과 OPC 10000-6 5.2.5("One dimensional Arrays are encoded as a sequence of elements preceded by the number of elements encoded as an Int32 value")입니다.

HotLoop core의 구독자와 두 번째 디코더는 모두 RawData 배열을 이 방식, 곧 길이와 패딩으로 읽으며, 둘 다 이 라이브러리의 RawData를 디코드합니다.

참조 스택과 다른 점이 하나 있습니다. 참조 스택은 문자열이 MaxStringLength보다 길면 예외를 던지지만, PLC 태스크에는 예외를 던질 곳이 없으므로 이 라이브러리는 문자 경계에서 자릅니다.

## 알아 두기

* 실행은 x86-64의 CODESYS Control for Linux SL 4.22.0.0에서 했습니다. 라이브러리는 Structured Text이며, 빅 엔디안 대상을 위한 바이트 순서 처리는 작성되어 있지만 직접 사용하는 컨트롤러에서 확인해야 합니다.
* 멀티캐스트: 블록은 멀티캐스트 그룹에 대해 TTL, 루프백, 송신 인터페이스를 설정합니다. 자신의 네트워크에서 그룹을 확인하세요.
* 블록은 전송 실패를 세고, 네트워크가 사라지거나 주소가 없으면 물러서며, 프로그램은 계속 스캔합니다.
* 데모 모드에서는 CODESYS가 밝힌 대로 런타임이 두 시간 구간이 끝나면 멈춥니다.
