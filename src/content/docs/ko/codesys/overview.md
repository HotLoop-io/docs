---
title: "HotLoop for CODESYS 개요"
description: "CODESYS 런타임 옆에서 동작하는 HotLoop: 런타임 자체의 OPC UA 서버로 읽은 CODESYS PLC의 화면과 알람. CODESYS에는 아무것도 설치하지 않습니다."
sidebar:
  label: "개요"
editUrl: false
---

HotLoop for CODESYS는 CODESYS 런타임과 같은 노드에서 실행되는 HotLoop입니다. 런타임 자체의 OPC UA 서버로 PLC의 변수를 읽어 패널 PC, 휴대폰, 벽걸이 화면에서 동작하는 화면에 보여 주고, 그 값에 알람을 걸고, 이력을 보관합니다. CODESYS에는 아무것도 설치하지 않으며 PLC에 쓰는 것도 없습니다. CODESYS WebVisu에서 따로 만들었을 화면을 런타임 밖에서 그리는 셈입니다. 얻는 것: 운영자는 PLC에 다운로드하지 않고도 화면을 쓸 수 있고, PLC는 노드의 다른 어떤 것에도 의존하지 않는 두 번째 눈을 얻습니다.

HotLoop 제품 여덟 가지 중 하나이며 자체 릴리스 라인이 있습니다. 가장 최신 차트는 2026-11-16에 게시된 0.3.8입니다. 그 아래에는 HotLoop Edge가 있으므로 [Edge 페이지](/ko/edge/overview/)의 내용은 여기에도 모두 해당합니다.

![Line 2 화면: 값 카드 네 개, 게이지 하나, 15분 추세, 알람 목록](/codesys/screen.png)
![같은 화면, 어두운 모드](/codesys/screen-dark.png)

실제 실행 화면입니다. HotLoop의 기본 인터페이스가 CODESYS Control for Linux SL 4.22.0.0 런타임을 읽고 있습니다. PLC 프로그램은 HotLoop의 데모 프로그램이므로 숫자는 데모의 값입니다. 레이블(Line 2, Mixer temperature, Riverside Bottling)은 지어낸 것이며 [프로필](/ko/codesys/profile/)이 넣은 것입니다.

## 세 부분

| 부분 | 무엇인가 | 위치 |
|---|---|---|
| 차트 `hotloop-codesys` | 노드의 런타임을 위한 기본값을 갖춘 `hotloop-edge` 래퍼: SQLite, 레플리카 하나, PLC 옆에서 필요 없는 것은 끔. HotLoop 차트의 모든 수정이 여기에도 반영됩니다. | `https://hotloop.io/hotloop-codesys/` |
| 프로비저너 | 프로필을 HotLoop에 적용하고 올바르게 유지하는 정적 Go 바이너리 하나. 프로필은 보관하지 않습니다. | `ghcr.io/hotloop-io/hotloop-provision` |
| 프로필 | JSON 파일 하나: 장치, 보관할 변수, 알람, 화면 하나. 사용자가 주는 유일한 입력. | 설치의 네임스페이스에 있는 Secret, [여기에 설명](/ko/codesys/profile/) |

## PLC를 읽는 방법

CODESYS가 제3자에게 컨트롤러의 변수 읽기를 문서화한 방법은 하나뿐이며, 런타임 자체의 OPC UA 서버입니다. PLC는 IDE의 Symbol Configuration으로 보고 싶은 것을 게시하고, HotLoop은 그 변수를 노드 id가 아니라 프로그래머가 붙인 이름, 예를 들어 `Application.GVL_Line.rTemp`로 읽습니다. Symbol Configuration이 PLC 프로젝트에서 바뀌는 유일한 부분입니다. CODESYS Gateway의 채널 프로토콜은 제3자용으로 문서화되어 있지 않으며, 이 제품은 그것을 사용하지 않습니다.

읽기는 HotLoop core의 CODESYS 커넥터가 맡습니다. OPC UA 드라이버에 CODESYS PLC에 필요한 기능을 더한 것으로, 애플리케이션이 내보내는 항목과 가진 타입의 탐색, 필드당 포인트 하나가 되도록 풀어 낸 배열과 구조체, 재시작이나 다운로드 후 사람 손 없이 이뤄지는 재연결, 런타임이 공개한 한도에 맞춘 모든 요청을 포함합니다. [프로토콜 페이지](/ko/iot/protocols/)에 HotLoop 4.19.4 이후의 커넥터 참조가 있으며, 무엇에 대해 검증했고 무엇은 검증하지 않았는지도 나와 있습니다.

## 스스로 하는 일

HotLoop과 노드의 런타임이 모두 응답하면 프로비저너가 프로필의 장치, 변수, 알람, 화면을 설정합니다. 이후 5분마다 다시 확인합니다. 그 사이 PLC에 생긴 프로필의 변수는 추가되고, PLC에서 사라진 변수는 서버가 알려 준 이유와 함께 불량으로 읽힙니다. 화면과 알람은 없을 때 만들어지고, 프로필의 `revision`이 만든 쪽보다 높을 때만 교체되므로 사람이 한 변경은 의도적으로 더 새로운 프로필이 배포될 때까지 유지됩니다.

## 하지 않는 일

- **PLC에 쓰지 않습니다.** 프로비저너가 설정하는 모든 태그는 읽기 전용이며 프로필은 쓰기 가능으로 표시하는 항목이 없습니다. 나중에 사람이 태그를 활성화할 수 있으며, 그때는 [쓰기 게이트](/ko/gateway/write-gate/)와 PLC 자체의 심볼 권한이 모두 관여합니다.
- **런타임에 아무것도 넣지 않습니다.** 라이브러리도, 태스크도, 에이전트도 없습니다.
- **데이터베이스 파드가 필요 없습니다.** 노드 자체 스토리지의 SQLite, 레플리카 하나.
- **연결이 끊겨도 화면을 유지하도록 만들어졌습니다.** 두 파드 모두 도달할 수 없거나 준비되지 않은 노드를 시간 제한 없이 견디며, 톨러레이션은 차트에 들어 있습니다. [현황](/ko/codesys/where-it-stands/)에서 실제 노드에서 무엇을 실행했는지 알 수 있습니다.

## 다음으로

[설치](/ko/codesys/install/)하거나, [프로필](/ko/codesys/profile/)에 무엇이 들어가는지 읽거나, [현황](/ko/codesys/where-it-stands/)과 [로드맵](/ko/codesys/roadmap/)을 보세요. 공장에서 쓰시나요? [업무에서 HotLoop 사용하기](/ko/business/)에서 라이선스와 문의 방법을 안내합니다.
