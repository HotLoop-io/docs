---
title: "Flow 2.9.0 릴리스 노트"
description: "HotLoop Flow 2.9.0에 담긴 내용, 업그레이드 시 달라지는 점, 가동 중인 플랜트를 건드리기 전에 읽어야 할 것."
sidebar:
  label: "2.9.0"
---

HotLoop Flow 2.9.0은 실제 공장 이전을 위한 기본 내장 커넥터 노드를 추가합니다. 공장의 플로가 의존하는 Node-RED 노드인 Modbus, 대시보드, PostgreSQL, 이메일을 실행하고, 그 주변의 함수 노드가 호출하는 `Buffer`와 `setInterval`도 지원합니다. 이를 쓰는 Node-RED 장비에서 가져온 플로는 그대로 불러오고, 실행하고, 저장합니다. 또한 포트 하나가 기계마다 VLAN 하나씩을 나르는 장비에서, 모든 VLAN의 서브넷과 장치 주소가 같더라도 하나의 Flow가 기계마다 탭을 하나씩 둘 수 있습니다.

## 새 기능

- **Node-RED Modbus.** `modbus-client`, `modbus-read`, `modbus-getter`, `modbus-flex-getter`, `modbus-write`, `modbus-flex-write`, `modbus-server`, 그리고 수동형 `modbustcp-server`. 출력은 커뮤니티 노드가 보내는 것과 같습니다. `msg.payload`는 값 목록, `msg.responseBuffer`는 `{data, buffer}`, `msg.input`이고, 오류는 두 번째 출력으로 나갑니다.
- **대시보드.** `ui_base`, `ui_tab`, `ui_group`, `ui_link`, `ui_spacer`, `ui_text`, `ui_numeric`, `ui_button`, `ui_switch`, `ui_text_input`, `ui_led`, `ui_gauge`, `ui_chart`, `ui_template`를 실행 파일에서 `/ui`로 제공하며, 공장 밖에서 가져오는 것은 없습니다. 운전원이 페이지에서 하는 일은 노드에서 메시지로 나옵니다. `ui_template`은 공장에서 쓰는 AngularJS 방식의 부분 집합을 실행합니다. `{{ }}`, `ng-click`, `ng-class`, `ng-init`, `ng-show`, `ng-hide`, `ng-if`, `ng-bind`, `scope.$watch`, `scope.send`.
- **PostgreSQL.** `postgreSQLConfig`와 `postgresql`. 연결은 첫 쿼리에서 열리므로, 아직 올라오지 않은 데이터베이스가 플로를 멈추게 하지 않습니다.
- **이메일.** SMTP로 보내는 `e-mail` 출력 노드이며, STARTTLS, 인증서 스위치, XOAUTH2를 지원합니다.
- **함수 노드의 `Buffer`, `setInterval`, `setTimeout`.** 타이머는 노드의 시계로 돌고, 모든 콜백의 CPU 제한은 메시지와 같으며, 플로가 멈추거나 다시 배포되면 모든 타이머가 정리됩니다.
- **모든 클라이언트의 네트워크 인터페이스.** 노드, 탭, 클라이언트 설정이 연결을 바인딩할 인터페이스(`SO_BINDTODEVICE`)를 지정할 수 있어서, 건조기 14용 탭은 VLAN 14의 `192.168.1.5`에만 닿습니다. 탭에서는 탭의 환경 변수 `FLOW_NETWORK_INTERFACE`로 지정하며, 그 탭의 모든 클라이언트 노드가 이를 이어받습니다. Modbus, PostgreSQL, 이메일, TCP 요청, UDP 출력, HTTP 요청 노드에 있습니다.

README에 새 섹션이 생겼고, `docs/node-red-types.md`는 무엇이 실행되고 어떻게 다른지 설명하며, `docs/compatibility.md`는 레지스트리에서 다시 생성됩니다.

## 바뀐 내용

- 함수 노드에는 `Buffer`, `setTimeout`, `setInterval`이 일부러 빠져 있었고 테스트 두 개가 그것을 고정하고 있었습니다. 공장의 함수가 이를 쓰기 때문에 이제 들어 있습니다. 샌드박스의 나머지는 바뀌지 않았습니다. 여전히 `require`도, `process`도, Node 표준 라이브러리도 없습니다.
- 훅을 설정하지 않으면 업스트림과 똑같이 동작합니다. 무엇이 바뀌었는지는 NOTICE와 `HOTLOOP_PATCH.txt`에 있습니다.
- 이유는 실제 공장 이전을 위한 Node-RED 기본 내장 커넥터 노드입니다.

## 새 설정

- `HOTLOOP_FLOW_UI_PATH`, 기본값 `/ui`: 대시보드를 제공하는 경로.
- `FLOW_NETWORK_INTERFACE`, 탭, 서브플로 또는 프로세스 환경 변수: 그 탭의 클라이언트가 바인딩하는 인터페이스. 기본값은 비어 있으며, 이전처럼 호스트가 고르게 둡니다.
- 각 클라이언트 노드와 설정에 **네트워크 인터페이스** 필드.
- 차트 값 `bindToInterface.netRaw`, 기본값 `false`. Linux 5.7 이상에서는 소켓을 인터페이스에 바인딩하는 데 권한(capability)이 필요 없습니다. 더 오래된 커널에서는 `CAP_NET_RAW`가 필요하며, 이를 `true`로 설정하면 그 권한 하나만 파드에 추가되고 다른 것은 없습니다. VLAN 인터페이스를 보려면 파드에 호스트 네트워크(`network.mode: host`)도 필요합니다.

## 업그레이드

이미지와 차트 2.9.0으로 `helm upgrade`를 한 번 실행하거나, Quadlet 유닛의 태그를 새 것으로 바꾸면 됩니다. 첫 시작에서는 아무 일도 일어나지 않고, 이전할 것도 없으며, 새 타입을 쓰지 않던 플로는 예전처럼 동작합니다. 이 타입들이 이미 들어 있는 플로(가져온 Node-RED 파일)는 이제 이를 시작하며, 이전에는 각각을 알 수 없는 노드 타입으로 보고했습니다.

## NOTICE와 라이선스 변경

NOTICE에 Modbus 라이브러리 항목이 추가되었으며, 이제 수정된 사본입니다. 이미지에 새 서드파티 모듈은 없습니다.

이미지: `ghcr.io/hotloop-io/hotloop-flow:2.9.0`, linux/amd64가 먼저이고 arm64는 2.9.1에서 이어집니다. 차트: `https://hotloop.io/hotloop-flow/`. 이 태그의 README에 나머지가 사진과 함께 있습니다: https://github.com/HotLoop-io/hotloop-flow/blob/v2.9.0/README.md
