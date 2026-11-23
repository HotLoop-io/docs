---
title: "자동화 규칙"
description: "트리거 10종, 조건, 시퀀스를 갖춘 규칙입니다. 저장할 때 컴파일되고, 모든 쓰기는 쓰기 게이트를 거칩니다."
---

규칙은 세 가지로 이루어집니다. 무언가 일어나고, 조건이 참이며, 작업이 실행됩니다.

규칙은 설비를 제어할 수 있으므로 두 가지 속성은 타협할 수 없습니다.

**조건은 규칙이 발동할 때가 아니라 저장할 때 컴파일됩니다.** 구문 오류는 작성자가 아직 편집기를 보고 있을 때 눈에 띕니다. 조용히 한 번도 실행되지 않는 규칙이나, 더 나쁘게는 이미 반쯤 실행된 시퀀스 한가운데에서 새벽 3시에 오류가 나는 규칙이 생기지 않습니다. 편집기는 입력하는 동안 검증하며, 컴파일되지 않는 규칙은 저장할 때 거부됩니다.

**조건은 샌드박스에서 평가됩니다.** [expr-lang](https://expr-lang.org)에는 I/O가 없고, 파일 시스템이나 네트워크에 접근할 수 없으며, 컴파일 시점에 타입을 검사하고, 반드시 종료됨이 보장됩니다. 마지막 속성이 가장 중요합니다. 조건은 쓰기로 이어지는 경로에서 평가되는데, 무한히 반복할 수 있는 표현식 언어는 쓰기 잠금을 쥔 엔진을 멈추게 할 수 있기 때문입니다.

## 트리거

트리거 하나만 발동해도 규칙이 실행됩니다.

| 유형 | 발동 시점 | 주요 필드 |
|---|---|---|
| `tag_change` | 태그의 값이 바뀔 때 | `deviceId`, `tagName` |
| `threshold` | 값이 한계를 **넘을** 때 | `deviceId`, `tagName`, `threshold`, `direction`, `hysteresis` |
| `state` | 엔티티의 상태가 바뀌거나, 일정 시간 동안 한 상태를 유지할 때 | `entityId`, `from`, `to`, `forSec` |
| `schedule` | cron 표현식의 시각이 될 때 | `cron` |
| `interval` | N초마다 | `intervalSec` |
| `alarm` | 알람이 어떤 상태로 들어갈 때 | `alarmId`, `alarmState` |
| `device_state` | 장치가 연결되거나 끊길 때 | `deviceId`, `toState` |
| `webhook` | 들어오는 POST가 도착할 때 | `webhookPath` |
| `mqtt` | 토픽에 메시지가 도착할 때 | `topic` |
| `startup` | 프로세스가 시작될 때 | n/a |
| `sun` | 현장의 새벽, 일출, 정오, 일몰 또는 황혼 시각, 필요하면 오프셋 적용 | `event`, `offsetSec` |

### 임계값은 넘는 순간 발동합니다

`threshold`는 값이 한계를 *넘을* 때 발동하며, 한계 위에 머무는 동안에는 발동하지 않습니다. "값이 200보다 크다"로 발동하면 값이 높게 유지되는 스캔마다 규칙이 발동하므로, 무언가를 제어하는 규칙에서는 명령 폭주가 됩니다.

`hysteresis`는 한계 근처에서 흔들리는 값이 흔들릴 때마다 규칙을 다시 무장시키는 것을 막습니다. 한 번 위로 올라간 값은 `threshold - hysteresis` 아래로 내려가야 트리거가 다시 발동할 수 있습니다.

```json
{
  "type": "threshold",
  "deviceId": "press-01", "tagName": "Zone1_Temp",
  "threshold": 200, "direction": "rising", "hysteresis": 5
}
```

`direction`은 `rising`, `falling`, `either` 중 하나입니다. 시작 후 첫 번째 값은 기준선을 정할 뿐 발동하지 않습니다. 그렇지 않으면 값이 무엇이든 모든 임계값 규칙이 부팅 때 한 번씩 발동합니다.

### 상태 트리거는 엔티티를 따릅니다

`state`는 엔티티의 상태 문자열이 바뀔 때 발동합니다. `off`에서 `on`, `212.5`에서 `213`, `on`에서 `unavailable`로 바뀔 때입니다. `from`과 `to`로 범위를 좁힙니다. 둘 다 생략하면 `unavailable`로 가거나 거기서 돌아오는 변화를 포함해 모든 변화에 발동합니다. "누군가에게 알려라"에는 보통 그것이 맞고, "무언가를 제어하라"에는 절대 맞지 않습니다. `to`를 지정하세요.

```json
{
  "type": "state",
  "entityId": "binary_sensor.press_01_run",
  "from": "off", "to": "on"
}
```

상태에만 발동하고 다른 것에는 발동하지 않습니다. 속성이 바뀌거나, 상태가 마지막 정상 값을 유지한 채 품질만 나빠지는 것은 상태 변화가 아닙니다.

설비를 제어하는 규칙은 알 자격이 있으므로, 정확히 언제 발동하는지 적습니다. 트리거는 태그 버스가 아니라 엔티티 엔진 자체의 변경 기록을 따릅니다. 엔진은 값이 도착하는 대로 엔티티의 상태를 계산하고, 제때 처리하지 못한 묶음에 대비한 안전장치로 1초에 한 번 모든 것을 다시 계산합니다. 계산한 변화는 하나씩 순서대로 한 번만 보고하고, 트리거는 그 모두를 봅니다. 따라서 다음과 같습니다.

- **변화당 한 번 발동합니다.** 1초마다 하는 재계산은 엔진이 마지막으로 본 뒤 움직인 것만 보고하므로 같은 변화를 두 번 보고할 수 없고, 규칙을 다시 불러와도 상태 트리거가 의존하는 것은 아무것도 초기화되지 않습니다.
- **엔진이 본 변화는 놓치지 않습니다.** 느린 버스는 1초의 지연을 낳을 뿐 변화를 잃게 하지 않습니다.
- **아무도 보지 못한 변화는 볼 수 없습니다.** 두 번의 폴링 사이에 off, on, off로 움직인 코일은 플랜트 입장에서는 변한 적이 없습니다. 상태 트리거는 그 뒤의 스캔만큼만 정확하고 그보다 낫지 않습니다. 빠른 신호의 모든 에지가 필요하다면 PLC에서 래치하세요.
- **시작은 기준선입니다.** Gateway가 시작될 때, 또는 엔티티 하나가 활성화될 때 나타나는 모든 엔티티는 변화가 아니며 발동하지 않습니다.

규칙이 10,000건의 변화만큼 뒤처지면(규칙이 시작하는 실행을 데이터베이스가 기록하기에 너무 느릴 때) 가장 오래된 것부터 버려지고, 집계되고, 기록되며, `GET /api/diagnostics`가 `automations` 아래에 `stateChangesPending`과 `stateChangesDropped`를 보여 줍니다.

엔티티의 이름을 바꾸면 이전 `entity_id`를 지정한 모든 규칙이 발동을 멈춥니다. 의미 있는 이름의 대가입니다. 이름은 의도를 갖고 바꾸고, 먼저 규칙을 검색하세요.

### 상태 유지: forSec

"펌프가 5분째 돌고 있다"는 `forSec`을 쓰는 상태 트리거입니다. 변화는 규칙을 발동시키는 대신 타이머를 시작하고, 바뀐 상태가 그 초만큼 유지되면 규칙이 발동합니다.

```json
{
  "type": "state",
  "entityId": "binary_sensor.press_01_run",
  "from": "off", "to": "on",
  "forSec": 300
}
```

- **어떤 상태 변화든 유지를 취소합니다.** 5분 안에 on에서 off로, 다시 on으로 바뀌면 변화가 두 번입니다. 첫 번째가 유지를 끝내고, 두 번째가 0부터 새 유지를 시작합니다. 시간이 합산되지 않습니다. `unavailable`로 떨어지는 것도 상태 변화이므로, 유지 도중 응답이 없어진 장치는 유지를 취소합니다.
- **상태만 셉니다.** 속성이 바뀌거나, 상태가 유지되는 동안 품질이 나빠지는 것은 일반 상태 트리거를 발동시키지 않는 것과 마찬가지로 유지를 취소하지 않습니다. 나쁜 값이 들어오면 유지가 이어지지 않아야 한다면, 규칙의 조건에 `qualities`로 보호 장치를 두세요.
- **유지당 한 번 발동합니다.** 한 시간을 유지해도 5분짜리 규칙은 5분 시점에 한 번 발동하며, 5분마다 발동하지 않습니다.
- **규칙마다 자기 타이머가 있습니다.** 트리거당 하나입니다. 같은 엔티티에 `forSec`이 다른 규칙 두 개가 있으면 각각 자기 시각에 발동합니다.
- **추적에 나옵니다.** 유지가 발동시킨 실행은 `binary_sensor.press_01_run changed from off to on and held for 300s`로 표시되고, `fromState`, `toState`, `entity`는 유지를 시작한 변화의 것입니다.
- **유지는 재시작을 넘기지 못합니다.** 메모리에 보관되며 아무도 다시 무장시키지 않습니다. 재시작 전에 프레스가 유지한 시간은 이후에 아무 의미가 없습니다. 프로세스가 돌아오면 모든 엔티티가 나타나고(기준선이며 변화가 아닙니다), 보통 `unknown`이다가 장치의 첫 값이 읽은 값으로 옮깁니다. `"from": "off"`이면 이는 일치하지 않으므로, 재시작 전에 돌던 프레스는 유지를 시작하지 않고, 규칙은 프레스가 다음에 off에서 on으로 가서 5분을 돌 때 발동합니다. `from`이 없으면 통제할 수 없는 경합에 달려 있습니다. 첫 값이 규칙이 수신을 시작한 뒤에 도착하면 `unknown`에서 `on`으로의 변화이며 0부터 유지가 시작됩니다. 규칙은 그로부터 5분 뒤에 발동하고, 추적에는 `changed from unknown to on`이 표시됩니다. 장치가 Gateway가 올라오기보다 빨리 응답하면 프레스는 처음부터 그냥 `on`이고, 바뀐 것이 없으므로 다음에 바뀔 때까지 아무것도 발동하지 않습니다. 재시작이 시작으로 세어지면 안 될 때는 `from`을 지정하고, 그것이 필요한 규칙은 쓰지 마세요. 규칙을 편집, 비활성화, 삭제하면 그 유지도 함께 버려지며, 다른 규칙을 저장해도 그렇지 않습니다.
- **유지 도중 사라지는 엔티티**(비활성화되었거나 장치와 함께 삭제됨)는 절대 발동하지 않습니다.

`forSec`은 최대 하루(86400)이고, `state` 트리거만 받습니다. 다른 모든 것과 마찬가지로 저장할 때 검사됩니다.

### 태양 트리거

마당 조명, 열선, 주차장 등 밖이 어두운지가 중요한 모든 것입니다. `sun`은 이 현장의 `dawn`, `sunrise`, `noon`, `sunset`, `dusk`에 발동하며 `offsetSec`만큼 옮겨집니다. 음수는 이전이므로 이것은 일몰 30분 전입니다.

```json
{"type": "sun", "event": "sunset", "offsetSec": -1800}
```

- **장비 안에서 계산합니다.** 현장의 위도와 경도(`HOTLOOP_SITE_LATITUDE`, `HOTLOOP_SITE_LONGITUDE`)에서 NOAA의 태양 방정식으로 계산하며, 서비스도 인터넷도 필요 없습니다. 업링크를 잃은 플랜트도 해질녘에 조명을 켭니다. [태양](/ko/iot/sun/)을 참고하세요.
- **위치가 없으면 무장하지 않습니다.** 위도와 경도가 없는 현장에서 태양 트리거를 쓰는 규칙은 무장되지 않으며, 시스템 로그가 설정할 두 변수를 알려 줍니다. 예전에는 무장된 채 영원히 조용히 있다가 마당이 어두워져서야 누군가 알아채는 종류의 일이었습니다.
- **그날의 이벤트마다 한 번 발동합니다.** 그날의 시각에 발동합니다. 10월의 일몰은 저녁마다 1분쯤 빨라지고, 트리거가 그것을 따라갑니다.
- **새벽과 황혼은 시민 박명입니다.** 태양 중심이 지평선 아래 6도입니다. 야외 조명이 기준으로 삼는 "조명이 필요할 만큼 어둡다"는 선입니다.
- **백야에는 발동할 일몰이 없으므로** 일몰 트리거는 몇 주가 걸리더라도 다음 일몰을 기다렸다가 그때 발동합니다.
- `offsetSec`은 양쪽으로 최대 6시간(21600)입니다. 그보다 멀면 `schedule`입니다.

추적에 무엇이 언제 발동시켰는지 나옵니다. `30m before sunset at 2026-10-01T22:38:00Z`이며, 조건에서 `trigger`는 `sun`입니다.

## 조건

불리언을 반환하는 표현식입니다. 비어 있으면 무조건입니다.

표현식이 볼 수 있는 것은 다음과 같습니다.

| 이름 | 의미 |
|---|---|
| `value`, `string`, `quality` | 규칙을 발동시킨 값 |
| `previous` | 그 이전의 값 |
| `tag`, `device` | 발동시킨 대상 |
| `tags["device/tag"]` | 현재의 모든 숫자 값 |
| `strings["device/tag"]` | 현재의 모든 텍스트 값 |
| `qualities["device/tag"]` | 현재의 모든 품질 |
| `states["sensor.x"]` | 활성화된 모든 엔티티의 상태, 문자열로 |
| `attrs["sensor.x"]["unit_of_measurement"]` | 활성화된 모든 엔티티의 속성 |
| `qualities["sensor.x"]` | 태그의 품질과 나란히, 모든 엔티티의 품질(태그 키에는 `/`가 있고 entity_id에는 절대 없습니다) |
| `entity`, `fromState`, `toState` | 규칙을 발동시킨 상태 변화 |
| `alarm`, `alarmState` | 규칙을 발동시킨 알람 |
| `deviceState` | 발동시킨 장치 상태 |
| `now`, `hour`, `minute`, `weekday` | 시계. weekday 0은 일요일 |
| `trigger` | 어느 트리거가 발동했는지 |
| `vars` | 앞선 단계가 바인딩한 값 |

```
value > 200
value > 200 and quality == 'good'
tags['press-01/Zone1_Temp'] > 200 and tags['press-01/Pressure'] < 50
hour >= 6 and hour < 18 and weekday != 0 and weekday != 6
qualities['press-01/Zone1_Temp'] == 'good'
strings['cnc-01/Program'] == 'PART_4471.NC'
value > previous
states['switch.press_01_pump'] == 'off' and toState == 'on'
float(states['sensor.press_01_zone1_temp']) > 200 and qualities['sensor.press_01_zone1_temp'] == 'good'
attrs['switch.press_01_pump']['armed'] == true
```

**품질로 보호하세요.** `value > 200`은 250이라는 나쁜 값에도 참이며, 나쁜 값은 시스템이 모른다고 알려 주는 값입니다. 설비를 제어하는 모든 곳에서는 `value > 200 and quality == 'good'`이라고 쓰세요. 엔티티도 마찬가지입니다. 나쁜 엔티티는 마지막 정상 값을 계속 보여 주며, 규칙이 그것을 알아내는 방법이 `qualities['sensor.x']`입니다.

**상태는 문자열입니다.** `"212.5"`, `"on"`, `"unavailable"`처럼 쓰이며 숫자가 아닙니다. 그래서 `states['sensor.x'] > 200`은 조용히 항상 거짓인 비교로 저장되는 대신 저장할 때 타입 오류로 거부됩니다. `float(states['sensor.x']) > 200`으로 쓰고 보호하세요. `float('unavailable')`은 오류이고, 오류가 나는 조건은 실행을 실패시킵니다.

`string`은 규칙을 발동시킨 값이므로 expr-lang의 `string()` 함수이기도 한 것은 아닙니다. 숫자를 문자열에 넣으려면 `toJSON(value)`를 쓰세요.

조건은 불리언을 반환해야 합니다. 숫자나 문자열을 반환하는 조건은 아무도 의도하지 않은 참/거짓으로 억지 변환되는 대신 저장할 때 거부됩니다.

## 작업

작업은 순서대로 실행됩니다. 실패한 단계는 `continueOnError`를 설정하지 않는 한 규칙을 멈춥니다. 밸브를 닫아야 했는데 닫지 못한 단계 뒤에, 밸브가 닫혀 있다고 가정하는 단계가 이어져서는 안 됩니다.

### write_tag

```json
{
  "type": "write_tag",
  "params": {
    "deviceId": "press-01", "tagName": "Cooling",
    "value": true
  }
}
```

또는 계산식으로:

```json
{
  "type": "write_tag",
  "params": {
    "deviceId": "press-01", "tagName": "Setpoint",
    "expression": "tags['press-01/Zone1_Temp'] - 10"
  }
}
```

**다른 모든 것과 같은 게이트를 거칩니다.** 자동화는 사람보다 더 많은 권한을 얻지 못합니다. 쓰기가 활성화되어 있어야 하고, 태그가 쓰기 가능으로 표시되어 있어야 하며, 값이 범위 안에 있어야 하고, 시도는 `automation:<rule-id>`로 감사 기록됩니다.

### call_service

`POST /api/services/...`와 MCP `call_service` 도구처럼 엔티티를 그 서비스로 제어합니다. 각 도메인이 받는 것은 [엔티티](/ko/iot/entities/#services)를 참고하세요.

```json
{
  "type": "call_service",
  "params": {
    "entityId": "switch.press_01_pump",
    "service": "switch.turn_on"
  }
}
```

데이터를 리터럴이나 계산식으로 지정할 수 있습니다.

```json
{
  "type": "call_service",
  "params": {
    "entityId": "number.press_01_zone1_sp",
    "service": "number.set_value",
    "dataExpressions": {"value": "float(states['sensor.press_01_zone1_temp']) - 10"}
  }
}
```

`service`는 `domain.service`이며 그 도메인이 엔티티의 도메인이어야 하므로, 숫자 엔티티에 스위치의 서비스를 지정한 규칙은 저장할 때 거부됩니다. 도메인이 받지 않는 서비스도 마찬가지이며, 각 도메인이 받는 서비스 목록은 엔티티 계층 자체에서 가져옵니다. 도메인에 서비스가 추가되면 여기서 아무것도 바꾸지 않아도 규칙이 쓸 수 있습니다. `data`는 서비스 데이터 리터럴이고, `dataExpressions`는 실행 시 평가되어 그 위에 병합됩니다.

이름이 붙은 `write_tag`입니다. 호출은 같은 게이트를 거치는 태그 쓰기가 되며, 모든 행에 엔티티, 서비스, 호출 id가 붙어 `automation:<rule-id>`로 감사 기록됩니다. 거부(쓰기 꺼짐, 태그 무장 해제, 엔티티의 단계에서 벗어난 값)는 단계와 실행을 실패시키고 추적에 거부 사유가 남으며, 거부된 `write_tag`와 똑같습니다. 호출이 수행했거나 거부당한 모든 쓰기는 단계의 출력에 있습니다. 호출은 결코 롤백되지 않습니다. 세 개 중 두 개의 쓰기를 마친 복합 호출은 거기서 멈추고 그렇게 알립니다.

### condition

시퀀스 중간의 조건입니다. 거짓이면 시퀀스가 거기서 끝나며 실행은 **성공**입니다. 규칙은 쓰인 대로 멈추는 일을 한 것입니다. 단계의 출력은 `false; the steps after this one did not run`이라고 말합니다.

```json
{
  "type": "condition",
  "params": {
    "expression": "states['binary_sensor.press_01_run'] == 'on' and qualities['binary_sensor.press_01_run'] == 'good'"
  }
}
```

규칙의 `condition`이 아닙니다. 그것은 아무것도 실행되기 전에, 트리거가 발동했을 때의 플랜트를 기준으로 한 번 검사되며, 거짓이면 실행은 건너뜀으로 기록됩니다. 조건 단계는 **단계가 실행될 때의** 플랜트를 읽습니다. 이것이 `delay`나 `wait` 뒤에 두는 이유입니다. "30초 뒤에도 프레스가 돌고 있는가?" `entity`, `toState`, `value`와 규칙을 발동시킨 나머지는 그대로이며 `vars`도 그렇습니다.

평가할 수 없는 조건(`float('unavailable')`)은 규칙의 조건과 마찬가지로 단계와 실행을 실패시킵니다. `continueOnError`는 조건에서는 저장할 때 거부됩니다. 조건을 지나쳐 계속하면 조건이 아무것도 멈추지 못하게 되기 때문입니다.

### wait

표현식이 참이 될 때까지 시퀀스를 붙잡아 두며, 최대 `timeoutSec`입니다.

```json
{
  "type": "wait",
  "params": {
    "expression": "states['binary_sensor.press_01_valve_closed'] == 'on'",
    "timeoutSec": 30
  }
}
```

즉시 한 번 보고, **표현식에 지정된 엔티티가 바뀔 때마다**(상태, 품질, 속성) 다시 보며, 어떤 경우에도 1초에 한 번 봅니다. 지켜보는 엔티티는 `states['...']`, `attrs['...']`, `qualities['...']`에 리터럴로 쓰인 것들이고, 태그 값, 시계, 다른 방식으로 지정한 엔티티는 1초마다 보는 것이 잡아냅니다. 따라서 Modbus 코일에 대한 wait는 그 뒤의 폴링만큼 빠르며 1초 늦지 않습니다.

참이 되면 다음 단계가 실행되고, 이후 단계는 wait가 마지막으로 본 플랜트를 봅니다. 시간 제한이 먼저 끝나면 단계가 **실패**하고 실행도 함께 실패하며 `still false after 30s`라고 하지만, wait가 계속하라고 하면 달라집니다.

```json
{
  "type": "wait",
  "params": {
    "expression": "float(states['sensor.press_01_zone1_temp']) < 60",
    "timeoutSec": 240,
    "continueOnTimeout": true
  }
}
```

어느 쪽이든 이후 `vars.wait.completed`는 참 또는 거짓이고 `vars.wait.waitedSec`은 기다린 시간이므로, 계속하는 wait 뒤의 조건 단계가 `vars.wait.completed == true`로 판단할 수 있습니다.

`timeoutSec`은 필수이며 최대 한 시간입니다. 끝이 없는 wait는 실행의 예산이 빼앗을 때까지 실행 슬롯을 붙잡으며, `skip`에서는 규칙이 더 이상 발동하지 않는다는 뜻입니다. 실행의 예산(`maxRuntimeSec`, 기본 5분)에도 들어가야 합니다. 10분짜리 wait에는 규칙에 `"maxRuntimeSec": 900` 정도가 필요하며, 없으면 실행으로 시간 초과되는 대신 규칙이 저장할 때 거부됩니다. 기다리는 동안 오류가 나는 표현식은 단계를 실패시킵니다.

### stop

시퀀스를 끝냅니다. `reason`은 필수이고 `{{ expression }}` 치환을 받으며, 추적에 표시됩니다.

```json
{
  "type": "stop",
  "params": {"reason": "pump already running, nothing to do"}
}
```

`error`가 없으면 실행은 성공입니다. `"error": true`이면 실행은 실패하고 이유가 오류로 기록되며, 다른 실패와 똑같이 로그에 남고 집계됩니다.

```json
{
  "type": "stop",
  "params": {"reason": "valve did not close in time", "error": true}
}
```

`continueOnError`는 stop에서는 저장할 때 거부됩니다.

### call_script

[스크립트](/ko/iot/scripts/)를 실행합니다. CIP 사이클이나 라인 퍼지가 필요한 모든 규칙이 각자 사본을 들고 있는 대신 같은 것을 호출하도록 누군가 한 번 작성해 둔 이름 있는 시퀀스입니다. `fields`는 그 입력이고, `fieldExpressions`는 단계가 실행될 때 평가되어 그 위에 병합되며, 스크립트는 화면에서 실행할 때와 똑같이 전체를 자기 필드에 비추어 검사합니다. 스크립트가 거부하는 값은 이 단계를 실패시키며, 맞추려고 바꾸는 일은 결코 없습니다.

```json
{
  "type": "call_script",
  "params": {
    "scriptId": "cip_cycle",
    "fields": {"circuit": "tank_2"},
    "fieldExpressions": {"minutes": "states['input_number.cip_minutes']"},
    "wait": true
  }
}
```

`"wait": true`이면 단계는 스크립트의 실행이 끝날 때까지 붙잡고 그 결과를 받습니다. 실패한 스크립트는 단계를 실패시키고, 단계에 `continueOnError`가 없으면 규칙은 거기서 멈춥니다. 스크립트의 실행은 이 실행의 일부입니다. 이 실행이 취소되거나 예산을 소진하면 스크립트도 그렇게 됩니다. `wait`가 없으면 스크립트가 시작되고 규칙은 계속되며, 스크립트는 혼자 끝납니다.

스크립트는 `script:<id>`로 실행되고, 하는 모든 쓰기에 이 규칙의 출처 `automation`이 붙으며, 그 실행에는 `automation_run:<id>`가 부모라고 표시됩니다. 바쁜 상태이고 그 모드가 다른 실행을 거부하는 스크립트는 기다리는 단계를 실패시키고(`script busy`), 기다리지 않는 단계에서는 실패가 아니라 기록으로 남습니다. 스크립트가 스크립트를 부르는 것은 최대 다섯 단계 깊이이며, 자기 자신을 부를 스크립트는 저장할 때 거부됩니다.

### apply_recipe

[레시피](/ko/iot/recipes/)를 적용합니다. 함께 나가는 설정값의 묶음, 제품 등급이나 교체 작업입니다. `params`는 그 매개변수이고 `paramExpressions`는 단계가 실행될 때 평가되어 그 위에 병합됩니다. `version`은 일부러 이전 버전을 적용하며, 생략하면 현재 버전입니다.

```json
{
  "type": "apply_recipe",
  "params": {
    "recipeId": "grade_a",
    "params": {"line_speed": 120},
    "paramExpressions": {"batch": "states['input_number.next_batch']"}
  }
}
```

레시피는 레시피 화면에서와 같은 일을 하며, 적용하는 주체는 이 규칙입니다. 먼저 전체를 검사해서, 어떤 대상이라도 거부될 것이면 아무것도 쓰지 않고 모든 이유와 함께 단계가 실패합니다. 그다음 대상들이 하나의 호출 id 아래 순서대로 나가며, `automation:<id>`로 출처 `automation`이 붙습니다. 처음 실패한 것이 나머지를 멈추고 단계를 실패시키며, 이미 쓴 것은 쓴 채로 남습니다. 단계는 모든 대상이 쓰였을 때만 성공합니다. 나갔지만 장치에서 다시 읽혀 오지 않은 값은 실제로 나갔으므로 실패가 아니지만, 추적에 `NOT confirmed by read-back`이라고 나오고 적용 기록에도 그렇게 나옵니다. 적용의 부모는 이 실행인 `automation_run:<id>`입니다.

### 나머지

| 작업 | 하는 일 |
|---|---|
| `mqtt_publish` | MQTT 장치의 기존 연결로 게시합니다 |
| `http_request` | 엔드포인트를 호출합니다. `bindTo`는 본문을 `vars`에 저장합니다 |
| `raise_alarm` / `clear_alarm` | 엔진이 스스로 볼 수 없는 알람을 구동합니다 |
| `log_event` | 시스템 로그에 기록합니다 |
| `set_variable` | 이후 단계를 위해 값을 바인딩합니다 |
| `delay` | 일시 정지합니다. 최대 한 시간 |
| `mcp_call` | 설정된 MCP 서버의 도구를 호출합니다 |

`mqtt_publish`, `http_request`, `log_event`, `stop`은 문자열에서 `{{ expression }}` 치환을 지원합니다.

```json
{
  "type": "mcp_call",
  "params": {
    "server": "maintenance",
    "tool": "create_work_order",
    "args": {"priority": "high"},
    "argExpressions": {"note": "'Zone 1 reached ' + toJSON(value)"},
    "bindTo": "workOrder"
  }
}
```

## 실행 모드

이전 실행이 아직 진행 중일 때 규칙이 발동하면 어떻게 되는지입니다.

| 모드 | 동작 |
|---|---|
| `skip` | 새 트리거를 버립니다. **기본값**이며 장치 가까이에서는 맞는 답입니다 |
| `queue` | 이후에 실행합니다. 대기는 최대 하나입니다 |
| `restart` | 현재 실행을 버리고 처음부터 다시 시작합니다 |
| `parallel` | 둘 다 실행합니다 |

`queue`는 일부러 대기 실행 하나로 제한됩니다. 따라가지 못하는 규칙은 그렇지 않으면 상태가 이미 달라진 플랜트에 한꺼번에 쏟아질 명령의 적체를 쌓게 됩니다.

`minIntervalSec`은 트리거 빈도와 무관하게 속도를 제한하며, 떨리는 태그가 장치를 혹사하는 것을 막는 안전장치입니다. UI나 MCP에서의 수동 실행은 속도 제한을 우회하지만(누군가 의도한 것입니다) 실행 모드는 우회하지 못합니다(누가 시작했든 동시에 두 번 실행되는 것은 똑같이 위험합니다).

`maxRuntimeSec`은 실행 전체를 제한하며 기본값은 5분입니다. 이것이 없으면 닿지 않는 엔드포인트에 걸린 규칙이 실행 슬롯을 영원히 붙잡고, `skip`에서는 다시는 발동하지 않는다는 뜻이 됩니다. 이것을 소진한 실행은 단계 사이에 있었든 `delay`나 `wait` 한가운데에 있었든 시간 초과로 기록됩니다.

### wait, delay, 실행 모드

`wait`나 `delay`에 있는 실행은 진행 중인 실행이며, 실행 모드가 트리거가 그것에 무엇을 하는지 정합니다.

| 모드 | 실행이 기다리는 동안의 트리거 |
|---|---|
| `skip` | 버려지고 건너뜀으로 기록됩니다. 기다리는 실행은 계속됩니다. |
| `queue` | 기다리는 실행이 어떻게 끝났든 끝난 뒤에 실행됩니다. |
| `restart` | 기다리는 실행을 그 자리에서 취소하고 새로 시작합니다. 이전 실행은 **취소**로 기록되며 `a newer trigger restarted the rule`입니다. "모션 조명" 패턴입니다. 트리거가 올 때마다 끝이 뒤로 밀립니다. |
| `parallel` | 다른 실행을 시작하며, 그것은 따로 기다립니다. |

실행은 wait나 delay 중이어도 그 자리에서 취소되고, 이유와 함께 **취소**로 기록됩니다. 다음의 경우입니다.

- **규칙이 무장 해제되거나 삭제될 때**: `the rule was disarmed or deleted`. 대기열의 실행과 `forSec` 유지도 버려집니다.
- **규칙이 편집될 때**: `the rule was edited`. 작성자가 방금 바꾼 조건을 기다리던 실행은 아무 일 없었다는 듯 이어지지 않으며, 편집된 규칙은 깨끗하게 시작합니다. *다른* 규칙을 저장해도 아무것도 건드리지 않습니다. 바뀌지 않은 모든 규칙의 실행, 유지, 대기열 실행, 실행 슬롯, 간격 타이머는 그대로 이어집니다.
- **프로세스가 멈출 때**: `the process is stopping`. 종료는 wait가 끝나기를 기다리지 않습니다. 다음 시작에서 실행을 재개하는 것은 없으며, 프로세스가 취소로 기록하지 못한 실행(충돌, 정전)은 다음 시작에서 취소로 표시됩니다.

취소되었거나 예산을 소진한 단계는 `continueOnError`가 있어도 실행을 멈춥니다. 그 플래그는 실패한 단계를 위한 것이며 누군가 멈춘 실행을 위한 것이 아닙니다. 단계가 이미 한 일은 한 대로 남습니다. 취소 전에 나간 쓰기는 되돌려지지 않으며 추적에 있습니다.

## 실행 기록

모든 실행은 단계별 추적과 함께 기록됩니다. **해석된** 입력, 출력, 소요 시간, 오류입니다. 템플릿이 아닙니다. 규칙이 새벽 3시에 오작동할 때 알아야 할 것은 `wrote 212.5 to press-01/Setpoint`이지 `wrote {{expression}}`이 아닙니다.

자동화 화면에서 실행을 펼치면 단계를 볼 수 있습니다. 프로세스가 멈출 때 아직 진행 중이던 실행은 멈추면서 취소되고, 프로세스가 기록하지 못한 실행(충돌)은 다음 시작에서 취소로 표시되므로, 지난주 화요일부터 실행 중인 것처럼 보이지 않습니다.

## 실제 예시

근무 중 구역이 뜨거워지면 냉각을 시작하되 최대 10분에 한 번만 하고, 누군가에게 알립니다.

```json
{
  "id": "cool-zone-1",
  "name": "Cool zone 1 when hot",
  "enabled": true,
  "mode": "skip",
  "minIntervalSec": 600,
  "triggers": [{
    "type": "threshold",
    "deviceId": "press-01", "tagName": "Zone1_Temp",
    "threshold": 200, "direction": "rising", "hysteresis": 5
  }],
  "condition": "quality == 'good' and hour >= 6 and hour < 18",
  "actions": [
    {"type": "write_tag", "params": {
      "deviceId": "press-01", "tagName": "Cooling", "value": true}},
    {"type": "delay", "params": {"seconds": 30}},
    {"type": "log_event", "params": {
      "severity": "warning",
      "message": "Cooling started, zone 1 at {{ value }}"}}
  ]
}
```

보호 장치를 순서대로 읽어 보세요. 연속이 아니라 넘는 순간에 발동합니다. 히스테리시스가 흔들릴 때 다시 무장되는 것을 막습니다. 조건은 믿을 수 없는 값에 대해서는 행동하기를 거부하고 근무 시간에만 실행됩니다. 속도 제한 덕분에 나머지가 모두 잘못되어도 10분에 한 번보다 자주 플랜트를 제어할 수 없습니다.

엔티티로 같은 발상입니다. 프레스가 돌기 시작하면 배기 팬을 켜되, 누군가 팬을 무장 해제하지 않았을 때만 합니다.

```json
{
  "id": "fan-with-press",
  "name": "Extraction fan follows the press",
  "enabled": true,
  "mode": "skip",
  "triggers": [{
    "type": "state",
    "entityId": "binary_sensor.press_01_run",
    "from": "off", "to": "on"
  }],
  "condition": "qualities['binary_sensor.press_01_run'] == 'good' and attrs['switch.press_01_fan']['armed'] == true",
  "actions": [
    {"type": "call_service", "params": {
      "entityId": "switch.press_01_fan", "service": "switch.turn_on"}},
    {"type": "log_event", "params": {
      "message": "{{ entity }} went {{ toState }}, fan started"}}
  ]
}
```

`from`과 `to` 덕분에 재연결(`unavailable`에서 `on`)이 팬을 저절로 켜지 않습니다. 조건 덕분에 무장 해제된 팬은 프레스가 시작할 때마다 감사 기록에 거부된 쓰기가 남는 대신 건너뛴 실행이 됩니다.

시퀀스 단계를 쓰는 예입니다. 프레스가 10분 동안 돌면 냉각 밸브가 이미 열려 있지 않은 경우 열고, 리밋 스위치를 기다리고, 끝내 닿지 않으면 크게 실패시킵니다.

```json
{
  "id": "cool-after-warmup",
  "name": "Open cooling after ten minutes of running",
  "enabled": true,
  "mode": "restart",
  "maxRuntimeSec": 120,
  "triggers": [{
    "type": "state",
    "entityId": "binary_sensor.press_01_run",
    "from": "off", "to": "on",
    "forSec": 600
  }],
  "actions": [
    {"type": "condition", "params": {
      "expression": "states['valve.press_01_cooling'] != 'open'"}},
    {"type": "call_service", "params": {
      "entityId": "valve.press_01_cooling", "service": "valve.open"}},
    {"type": "wait", "params": {
      "expression": "states['valve.press_01_cooling'] == 'open'",
      "timeoutSec": 60, "continueOnTimeout": true}},
    {"type": "condition", "params": {
      "expression": "vars.wait.completed == false"}},
    {"type": "stop", "params": {
      "reason": "cooling valve did not open within 60s, it is {{ states['valve.press_01_cooling'] }}",
      "error": true}}
  ]
}
```

위에서 아래로 읽어 보세요. 유지 덕분에 2분 만에 트립하는 프레스는 밸브를 열지 않고, `from` 덕분에 Gateway 재시작은 프레스 시작이 아닙니다. 첫 번째 조건은 이미 열린 밸브를 아무것도 제어하지 않는 성공한 실행으로 만듭니다. wait는 밸브 엔티티가 바뀌는 순간 깨어납니다. 끝내 열리지 않으면 두 번째 조건이 실행을 stop까지 가게 하여 실패시키고, 이유에 밸브의 실제 상태가, 시스템 로그에 경고가 남습니다. 밸브가 열리면 같은 조건이 거짓이므로 실행은 거기서 성공으로 끝납니다.

## 웹훅

`webhook` 트리거는 `POST /api/webhook/<path>`를 등록합니다. 본문은 `vars.body`로 쓸 수 있습니다. 어떤 규칙도 요구하지 않은 경로는 조용히 받아들이는 대신 404를 반환합니다. 아무 데도 닿지 않는 곳에 게시하는 웹훅은 작동하는 웹훅과 똑같아 보이기 때문입니다.

두 규칙이 같은 경로를 요구할 수 없으며, 두 번째는 로드할 때 둘을 모두 지목하는 로그 한 줄과 함께 거부됩니다.

## 규칙이 무장되지 않을 때

활성화되어 있지만 컴파일되지 않은 규칙은 자동화 화면에 빨간 점과 설명과 함께 **NOT ARMED**로 표시되고, 시스템 로그에 오류가 남습니다. 가장 크게 알려야 하는 상태입니다. 작성자는 규칙이 돌고 있다고 믿습니다.

나쁜 규칙 하나가 다른 규칙을 무장 해제하지 않습니다. 다시 불러오면 실패한 규칙은 버려지고 나머지는 모두 무장됩니다.
