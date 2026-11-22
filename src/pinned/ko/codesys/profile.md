---
title: "프로필 파일"
description: "HotLoop for CODESYS의 유일한 입력입니다. 리비전, 장치와 변수, 알람, 화면 하나가 담긴 JSON 파일과 프로비저너가 이를 적용하는 방식을 설명합니다."
sidebar:
  label: "프로필"
---

프로필은 설치의 네임스페이스에 있는 Secret의 `profile.json` 키 아래에 있는 JSON 파일 하나입니다. 차트나 프로비저너 이미지에는 들어 있지 않으므로 둘 다 범용이고 공개되어 있으며, 어느 쪽에도 누구의 변수 이름도 들어 있지 않습니다. 앱을 설치하는 사람이 제공합니다. EmberNet에서는 Store가 `<release>-profile`로 씁니다.

프로비저너는 매 패스마다 프로필을 다시 읽으므로, 더 새로운 프로필은 재시작 없이 실행 중인 설치에 반영됩니다.

## 형식

| 키 | 담고 있는 것 |
|---|---|
| `revision` | 1부터 시작하는 정수. 화면과 알람은 이 값이 그것들을 만든 리비전보다 높을 때만 교체됩니다. |
| `device` | `id`, `name`, `options`(`browseRoot`, `arrayElements`, `browseMaxNodes` 같은 커넥터 옵션), 그리고 HotLoop이 PLC에서 유지할 변수 이름인 `points`. |
| `alarms` | `id`가 각각 있는 HotLoop 알람 정의. |
| `dashboard` | `id`가 있는 HotLoop 화면 하나. [대시보드](/ko/iot/dashboards/)는 카드의 목록입니다. |

프로필 하나는 화면 하나를 만듭니다. `device`로 장치 하나를, 또는 아래에서 설명하는 `devices`로 여러 개를 만듭니다.

## 장치 목록

프로필은 `device`와 함께, 또는 그 대신 `devices`를 가질 수 있습니다. 각 항목은 HotLoop의 `POST /api/devices` 본문(`id`, `name`, `protocol`, `address`, `enabled`, `pollIntervalMs`, `timeoutMs`, 그리고 프로토콜 자체의 블록인 `config`)에, HotLoop이 장치용으로 가져오는 디스크립터인 `tags`를 더한 것입니다. 디스크립터에는 `name`, `address`, `dataType`이 있고 선택적으로 `unit`, `description`, `deviceClass`가 있습니다. 이로써 RawData `dataSets`가 있는 OPC UA PubSub(UADP) 리스너, OPC UA 클라이언트, 한 프로필 안의 여러 장치를 다룰 수 있습니다. 매 패스마다 다음과 같이 합니다.

- HotLoop에 없는 장치는 만들고, 이미 있는 장치는 그대로 둡니다. 따라서 사람이 한 편집은 프로필의 `revision`이 그 장치를 만든 것보다 높아질 때까지 유지됩니다.
- 장치에 없는 프로필의 모든 태그를 읽기 전용으로 가져옵니다.
- 이 중 어느 것도 노드의 OPC UA 서버를 기다리지 않으므로 리스너는 수신만 하고, 런타임이 다운되었거나 재시작 중이어도 다른 것은 멈추지 않습니다(단일 `device`는 여전히 런타임을 읽으며, 런타임이 다운된 패스는 그렇다고 알리고 다시 시도합니다).
- `devices`가 없으면 프로필은 이전과 똑같이 작동하고, 둘 다 있으면 둘 다 적용됩니다.

사용자에게 의미하는 바: [HotLoop Transmitter](/ko/transmitter/overview/)가 공급하는 것 같은 PubSub 리스너는 읽어 올 PLC 없이도 스스로 구성된 채로 돌아옵니다.

## 예시

[개요](/ko/codesys/overview/)의 스크린샷 뒤에 있는 프로필로, HotLoop의 데모 프로그램을 대상으로 합니다. `GVL_Demo`는 데모 프로그램의 변수 목록이고 레이블은 지어낸 것입니다.

```json
{
  "revision": 2,
  "device": {
    "id": "line-2",
    "name": "Line 2 PLC",
    "options": {"browseRoot": "Application.GVL_Demo", "arrayElements": 4, "browseMaxNodes": 500},
    "points": ["GVL_Demo.bRun", "GVL_Demo.rTemp", "GVL_Demo.udiCycles", "GVL_Demo.nEcho", "GVL_Demo.rEcho", "GVL_Demo.rReadOnly"]
  },
  "alarms": [
    {"id": "line-2-mixer-hot", "name": "Mixer temperature high", "tagName": "GVL_Demo.rTemp", "condition": "hi", "limit": 20, "deadband": 0.5, "priority": 2, "message": "{device}/{tag} at {value}, limit {limit}"}
  ],
  "dashboard": {
    "id": "line-2-screen", "name": "Line 2", "description": "The Line 2 screen.", "kind": "cards", "roles": [], "homeFor": [], "screens": [],
    "cards": [
      {"id": "t", "type": "value", "title": "Mixer temperature", "w": 3, "h": 2, "config": {"tag": "line-2/GVL_Demo.rTemp", "decimals": 1}},
      {"id": "tr", "type": "trend", "title": "Mixer temperature, last 15 minutes", "w": 6, "h": 3, "config": {"tags": ["line-2/GVL_Demo.rTemp"], "minutes": 15}},
      {"id": "al", "type": "alarms", "title": "Line 2 alarms", "w": 6, "h": 3, "config": {"outstanding": true, "limit": 8}}
    ]
  }
}
```

카드의 `tag`는 장치 id, 슬래시, 포인트 이름입니다. 카드 유형, 알람 조건, 화면의 나머지 키는 HotLoop의 [대시보드](/ko/iot/dashboards/) 및 [HTTP API](/ko/iot/api/)와 같습니다.

## 프로비저너가 프로필로 하는 일

- **장치가 없으면 만들고**, PLC에는 있지만 장치에는 없는 `points`의 변수를 추가합니다.
- **PLC에 절대 쓰지 않습니다.** 만드는 모든 태그는 읽기 전용이며, 프로필에는 어떤 태그도 쓰기 가능으로 표시할 방법이 없습니다.
- **알람과 화면이 없으면 만들고**, `revision`이 그것들을 만든 것보다 높을 때만 교체합니다. 그래서 사람이 HotLoop에서 화면에 한 변경은 더 새로운 프로필이 의도적으로 배포될 때까지 유지됩니다.
- **계속 확인합니다.** 5분마다, 그리고 런타임이나 HotLoop이 아직 응답하지 않아 끝내지 못한 패스 뒤에는 더 일찍 확인합니다.
