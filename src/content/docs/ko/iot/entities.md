---
title: "HotLoop 엔티티"
description: "모든 자동화, 헬퍼, 스크립트, 화면의 바탕이 되는 엔티티 레지스트리입니다. 바뀌지 않는 ID, 도메인, 서비스, 이를 읽는 API를 설명합니다."
---

엔티티 레지스트리와 엔티티 상태를 계산하는 엔진은 HotLoop의 모든 자동화, 헬퍼, 스크립트, 화면의 바탕입니다.

## 태그가 있는데 왜 엔티티인가

태그는 드라이버가 다루는 대상입니다. 홀딩 레지스터, NodeId, S7 DB 오프셋이 그 예입니다. 태그는 장치와 태그 이름으로 구분되고, 이름을 바꿀 수 없으며, 전선 위의 정확히 한 지점만을 뜻합니다.

엔티티는 사람과 규칙이 다루는 대상입니다. "1구역 온도", "컨베이어 운전 스위치" 같은 것입니다. 엔티티에는 고유한 안정 이름(`sensor.zone_1_temperature`)이 있고, 어떻게 표시하고 무엇을 할 수 있는지 알려 주는 유형이 있으며, 엔티티를 이루는 태그에 대한 바인딩이 있습니다.

엔티티는 태그를 감쌉니다. 태그를 대체하지 않으며, 엔티티를 넣기 위해 태그에서 바뀐 것은 아무것도 없습니다. 두 번째 값 파이프라인도, 두 번째 히스토리안도 없습니다. 엔티티의 상태는 `/api/values`, 알람 엔진, OPC UA 서버가 이미 읽는 것과 같은 실시간 캐시에서 계산됩니다. 엔티티가 생기기 전부터 있던 모든 태그 엔드포인트, 보드, `/api/write`, MCP 도구, 자동화 규칙은 전과 똑같이 동작합니다. 엔티티는 기존 기능을 대체하지 않고 그 옆에 추가됩니다.

## 아무것도 하지 않아도 얻는 것

모든 태그는 **읽기 엔티티**를 자동으로 얻습니다.

| 태그 데이터 유형 | 읽기 엔티티 도메인 |
|---|---|
| `bool`, `boolean`, `bit`, `coil`, `discrete` | `binary_sensor` |
| 그 밖의 모든 유형 | `sensor` |

태그가 처음 쓰기 가능으로 바뀌면 **제어 엔티티**도 얻습니다.

| 태그 데이터 유형 | 제어 엔티티 도메인 |
|---|---|
| bool 계열 | `switch` |
| int와 float 계열 | `number` |
| `string`, `text`, `char` | `text` |

제어 엔티티는 태그가 활성화 해제되어도 삭제되지 않습니다. 쓰기 게이트는 지금까지처럼 활성화 해제된 태그에 대한 쓰기를 거부하고, 엔티티의 `armed` 속성이 `false`가 되어 화면이 제어 항목을 회색으로 표시할 수 있습니다. 엔티티를 남겨 두는 것이 핵심입니다. `switch.press_01_pump`를 이름으로 쓰는 자동화나 대시보드가 근무 교대 동안 누군가 펌프를 활성화 해제했다고 멈추면 안 됩니다.

기존 태그의 엔티티는 업그레이드 안에서 바로 만들어집니다. 마이그레이션 `0005_entities.sql`이 테이블을 만드는 같은 트랜잭션 안에서 모든 태그의 읽기 엔티티와, 이미 쓰기 가능한 모든 태그의 제어 엔티티를 채워 넣습니다. 새 버전이 첫 요청을 처리할 때 모든 태그에 엔티티가 있거나, 아니면 아무것도 바뀌지 않거나 둘 중 하나입니다.

모든 알람 정의도 같은 방식으로 **알람 엔티티**를 얻습니다. [알람 엔티티](#알람-엔티티)를 참고하십시오.

제어 엔티티에 명령을 내리는 일(스위치 켜기, 숫자 설정)은 서비스 호출이며, 서비스 호출은 다른 모든 쓰기와 마찬가지로 `runtime.Manager.Write`와 쓰기 게이트를 거치는 태그 쓰기입니다. 다른 문은 없습니다. [서비스](#서비스)를 참고하십시오.

태그 하나로 끝나지 않는 설비(기동 명령, 운전 접점, 고장이 있는 펌프, 리미트 스위치가 있는 밸브, PID 루프)는 구성하는 태그로 직접 만드는 **복합 엔티티**입니다. [복합 설비](#복합-설비)를 참고하십시오.

## 엔티티 ID

`entity_id`는 `<domain>.<object_id>` 형식이며 소문자, 숫자, 밑줄로 이루어지고 최대 255자입니다. 태그의 자동 ID는 `<domain>.<device>_<tag>`이며, 두 부분 모두 소문자로 바뀌고 ASCII 문자나 숫자가 아닌 문자의 연속은 밑줄 하나로 바뀝니다.

| 장치 | 태그 | 읽기 엔티티 |
|---|---|---|
| `press-01` | `Zone1_Temp` | `sensor.press_01_zone1_temp` |
| `Line.A-2` | `Motor/Speed.PV` | `sensor.line_a_2_motor_speed_pv` |
| `press-01` | `温度` | `sensor.press_01_tag` |

같은 ID가 나오는 태그가 둘 이상이면 등록된 순서대로 `_2`, `_3`이 붙습니다. 255자를 넘는 이름은 접미사 앞에서 잘리며, 접미사가 잘리는 일은 없습니다.

**`entity_id`는 한 번 만들어져 저장되고 다시 만들어지지 않습니다.** 태그의 설명을 바꾸거나, 데이터 유형을 바꾸거나, 다른 레지스터로 옮겨도 entity_id는 바뀌지 않습니다. 바꾸는 방법은 `PUT /api/entities/{entity_id}`를 통한 명시적 이름 변경뿐이며, 관리자 작업이고 시스템 로그에 남습니다(범주 `config`, 대상은 새 ID, 이전 ID는 메시지와 상세에 기록).

이름을 바꿔도 도메인은 유지됩니다. 엔티티의 정체성은 데이터베이스 `id`와 `unique_id`이며, 둘 다 절대 바뀌지 않습니다.

| 엔티티 | `unique_id` |
|---|---|
| 태그의 읽기 엔티티 | `tag:<device>/<tag>` |
| 태그의 제어 엔티티 | `tag-control:<device>/<tag>` |
| 알람 엔티티 | `alarm:<definition id>` |
| 복합 엔티티 | `composite:<32 random hex digits>` |

앞의 셋은 엔티티가 감싸는 대상에서 만들어집니다. 그래서 삭제된 태그나 알람 정의가 다시 생기면 같은 엔티티를 다시 이어받습니다. 복합 엔티티에는 그렇게 만들어 낼 기준이 없습니다. 같은 PLC의 똑같은 펌프 두 대는 서로 다른 태그에 바인딩되고, 같은 태그가 일부러 두 복합 엔티티를 받칠 수도 있습니다. 그래서 복합 엔티티의 `unique_id`는 만들 때 한 번 무작위로 생성됩니다. 삭제했다가 다시 만든 복합 엔티티를 포함해 다른 어떤 것과도 겹칠 수 없고, 다시 만든 것은 새 엔티티이므로 그래야 합니다.

## 삭제된 태그, 고아 엔티티, 재연결

태그를 삭제하면 그 엔티티는 삭제되지 않고 **고아 상태**가 됩니다. `orphaned_at`이 설정되고 상태는 `unavailable`이 됩니다. 태그 편집기나 탐색 다시 가져오기로 같은 태그를 되살리면 레지스트리가 `unique_id`로 고아 엔티티를 찾아 다시 이어받습니다. entity_id, 이름, 장치 클래스, 아이콘, 그 밖의 모든 사용자 설정이 함께 돌아옵니다.

이것은 의도된 동작입니다. 현장에서는 태그를 삭제하고 다시 가져오는 일이 "이 지점에 관한 모든 것을 잊자"는 뜻일 때보다 훨씬 자주 있고, `sensor.oven_temperature`를 이름으로 쓰는 자동화는 그 과정에서도 계속 동작해야 합니다.

장치 전체를 삭제하는 것은 다릅니다. 태그가 함께 지워지듯 그 장치의 엔티티도 함께 지워집니다. 태그가 모두 그 장치에 있는 복합 엔티티도 포함됩니다. 여러 장치에 걸친 복합 엔티티는 어느 장치에도 속하지 않으며, 장치 하나가 삭제되어도 잃는 것은 상태뿐입니다.

알람 엔티티는 같은 규칙으로 알람 정의를 따릅니다. 정의를 삭제하면 엔티티는 고아 상태가 되고, 같은 id로 정의를 저장하면 다시 이어받습니다.

복합 엔티티는 고아 상태가 되지 않습니다. 일부러 만든 것이므로 누군가 삭제할 때까지 남아 있고, 태그 하나가 없는 동안에는 `unavailable`입니다.

`DELETE /api/entities/{entity_id}`는 복합 엔티티나 고아 엔티티를 삭제합니다. 감싸는 대상이 아직 있는 태그나 알람 정의의 엔티티는 거부(409)하고, 없애는 방법을 알려 줍니다. 태그나 정의를 삭제한 다음 고아 엔티티를 삭제하는 것입니다. 살아 있는 엔티티를 삭제하면 다음 동기화가 새 ID로 다시 만들 뿐이고, 그 사이 그 이름을 쓰던 모든 것이 깨집니다. 화면에서 빼려면 숨기거나 사용 안 함으로 바꾸십시오.

## 레지스트리가 따라가는 방식

레지스트리는 태그가 바뀔 수 있는 모든 곳에 훅을 걸지 않고 조정합니다. 모든 태그와 모든 엔티티를 읽어서, 없는 것은 만들고, 태그를 잃은 것은 고아로 만들고, 태그가 돌아온 것은 다시 이어받습니다. 조정은 내년에 누군가 추가하는 경로도 놓치지 않고, 두 번 실행해도 한 번 실행한 것과 같습니다. 조정은 다음 시점에 실행됩니다.

- 시작할 때. 업그레이드와 백업 복원을 포함합니다.
- 런타임이 다시 로드될 때마다. 태그와 장치가 바뀔 때마다 이미 일어나는 일입니다.
- 태그(`POST /api/tags`, `DELETE /api/tags/...`, `POST /api/devices/{id}/import`, `DELETE /api/devices/{id}`)와 알람 정의(`POST /api/alarms`, `DELETE /api/alarms/{id}`)를 바꾸는 API 핸들러 안에서 동기적으로. 그래서 태그나 정의를 만들고 곧바로 엔티티를 요청하는 클라이언트도 엔티티를 찾습니다.

등록은 데이터베이스 어드바이저리 락으로 레플리카 간에 직렬화되므로, 같은 장치를 가져오는 레플리카 둘이 같은 `_2`를 나눠 주는 일은 없습니다. 무언가를 바꾼 조정은 엔티티마다가 아니라 한 줄만 시스템 로그에 씁니다. 5천 개 지점을 가져와도 이벤트는 하나입니다.

## 상태

`GET /api/states/{entity_id}`:

```json
{
  "entity_id": "sensor.press_01_zone1_temp",
  "state": "212.5",
  "attributes": {
    "friendly_name": "Zone1_Temp",
    "unit_of_measurement": "F",
    "device_class": "temperature",
    "source": ["press-01/Zone1_Temp"]
  },
  "quality": "good",
  "last_changed": "2026-09-26T14:02:11.482Z",
  "last_updated": "2026-09-26T14:02:11.482Z",
  "last_reported": "2026-09-26T14:07:40.100Z"
}
```

`state`는 단위를 뺀 값입니다. 숫자는 `/api/values`가 표시하는 방식 그대로, `binary_sensor`와 `switch`는 `on` 또는 `off`, 문자열은 그 텍스트 자체입니다. 단위는 속성입니다. 어떨 때는 `212.5`이고 어떨 때는 `212.5 F`인 상태는 아무것도 비교할 수 없습니다.

적용되는 순서대로의 규칙입니다. OPC UA 서버가 상태 코드에 쓰는 규칙과 같고 이유도 같습니다. **상태는 그 근거보다 좋을 수 없습니다.**

| 조건 | `state` | `quality` |
|---|---|---|
| 엔티티가 고아 상태이거나 태그가 없음 | `unavailable` | `bad` |
| 장치가 사용 안 함, 삭제됨 또는 링크가 끊김 | `unavailable` | `bad` |
| 링크는 연결됨, 이 세션에서 아직 읽은 값 없음 | `unknown` | `bad` |
| 불량 읽기 | **마지막 정상 값**, 한 번도 없었다면 `unknown` | `bad` |
| 읽기는 정상이지만 장치의 다른 지점이 실패 중(성능 저하) | 값 | `uncertain` |
| 정상 읽기 | 값 | `good` |

불량 읽기 규칙은 보기보다 중요합니다. 드라이버는 읽지 못한 지점을 값이 0인 불량 읽기로 보고하는데, 그 0을 상태로 보여 주면 "레벨 트랜스미터가 응답하지 않는다"가 "탱크가 비었다"로 바뀝니다. 엔티티는 신뢰할 수 있었던 마지막 값을 계속 보여 주고, `quality`로 더는 그 값을 보증할 수 없다고 알려 줍니다.

지점 하나의 실패와 장치의 실패는 다르다는 점에 유의하십시오. 모든 블록이 실패하는 Modbus 장치는 세션을 끊고 다시 연결하므로 그 엔티티는 `unavailable`이 됩니다. 일부 지점에는 응답하고 나머지에는 응답하지 않는 장치는 연결을 유지하며(성능 저하), 실패하는 지점의 엔티티만 `bad`로 표시됩니다.

**응답하지 않는 Modbus 장치가 표시되는 속도.** 연결을 거부하거나 닫는 장치는 다음 폴링에서 `unavailable`이 됩니다. 그냥 응답을 멈춘 장치(뽑힌 케이블, 멈춘 PLC, 재부팅된 스위치)는 소켓을 연 채로 있으므로 폴링 타임아웃으로 판단합니다. 엔티티는 폴링 주기에 장치 타임아웃의 두 배를 더한 시간 안에, 엔진의 백업 재계산 최대 1초를 더해 `unavailable`이 됩니다. 보통은 타임아웃 한 번이고, 두 배가 되는 경우는 폴링이 진행되는 중에 장치가 죽을 때입니다. 이미 전선에 나간 요청에도 타임아웃 전체가 주어지기 때문입니다. 그때까지는 새로 읽은 것이 없으므로 엔티티는 마지막 읽기를 그대로 보여 줍니다. 아직 연결을 받아 주는 멈춘 장치는 곧바로 다시 연결되므로, 그 뒤로 엔티티는 장치가 다시 응답할 때까지 `unavailable`과 `unknown`(연결됨, 읽은 것 없음)을 오갑니다. 둘 다 값으로 오해될 일은 없습니다. 조절할 수 있는 것은 타임아웃입니다. 타임아웃이 20초인 장치는 죽은 뒤 20초에서 40초 동안 정상처럼 보일 수 있으므로, 장치가 응답하는 데 필요한 시간보다 길게 설정하지 마십시오.

이 표는 태그 하나의 엔티티에 대한 것입니다. 복합 엔티티는 더 엄격하고(불량 읽기는 마지막 값을 유지하지 않음, [복합 엔티티의 상태가 정해지는 방식](#복합-엔티티의-상태가-정해지는-방식) 참고), 알람 엔티티의 상태는 알람 엔진의 것입니다([알람 엔티티](#알람-엔티티) 참고).

### 타임스탬프

- `last_changed`는 `state`가 바뀔 때만 움직입니다.
- `last_updated`는 `state`, `quality` 또는 속성이 바뀔 때 움직입니다.
- `last_reported`는 상태의 근거가 된 읽기의 타임스탬프입니다. 읽기가 생기기 전까지는 없습니다.

상태는 저장되지 않고 계산되지만, 로그북은 모든 엔티티의 최신 상태와 마지막으로 바뀐 시각을 보관합니다(`entity_last_state`, [로그북](/ko/iot/logbook/) 참고). 재시작 후 상태가 같게 돌아온 엔티티는 **`last_changed`를 유지합니다**. 화요일부터 돌고 있는 펌프는 계속 화요일이라고 표시합니다. 장치가 다시 연결되는 동안 태그 엔티티가 거치는 unavailable과 unknown은 변경으로 세지 않습니다. Gateway가 멈춰 있는 동안 실제로 바뀐 상태는 새 `last_changed`를 받고 로그북에 한 줄이 남습니다. 숫자 엔티티(센서, 숫자, 루프, 카운터)와 버튼은 추적하지 않으므로, 이들의 `last_updated`와 마찬가지로 재시작부터 다시 시작합니다.

### 속성

모든 엔티티에는 `friendly_name`과 `source`(바인딩된 태그 키)가 있습니다. 그 밖에 해당하는 경우 다음이 있습니다.

| 속성 | 시점 |
|---|---|
| `unit_of_measurement` | `sensor`와 `number`: 엔티티 자체의 단위, 없으면 태그의 단위 |
| `device_class`, `state_class`, `icon` | 엔티티에 설정된 경우 |
| `armed` | 제어 엔티티: 지금 태그가 쓰기 가능한지 여부 |
| `min`, `max` | `number`: 엔티티의 옵션, 없으면 태그에 범위가 있을 때 그 범위 |
| `step` | `number`: 엔티티의 옵션, 없으면 정수 태그의 경우 1 |
| `max_length`, `pattern` | `text`: 엔티티의 옵션, `max_length`의 기본값은 255 |
| `quality_reason` | 태그 엔티티: 읽기가 정상이 아니고 드라이버가 이유를 알 때. `no field at ENERGY.Power`, `payload is not JSON` 같은 값. 다음 정상 읽기에서 사라집니다 |

### 사용 안 함과 숨김

**사용 안 함** 엔티티는 상태가 아예 없습니다. `/api/states`에 나타나지 않으며, ID로 요청하면 없다고 하지 않고 사용 안 함이라고 알려 줍니다. **숨김** 엔티티는 상태가 평소와 같고, 이 플래그는 화면이 기본 보기에서 빼도록 하기 위한 것입니다.

### 엔진이 동작하는 방식

엔진은 `entities`라는 이름으로 태그 버스를 구독하며 큐는 256개 배치입니다. 알람 엔진과 자동화 엔진과 같은 손실 허용 규약이어서, 느린 소비자는 배치를 잃을 뿐 폴링을 멈추게 하지는 않습니다. 엔진이 캐시에서 모든 엔티티를 초당 한 번 다시 계산하므로, 여기서 배치가 유실되어도 손해는 길어야 1초입니다. 이 틱은 장치의 첫 폴링이 도착하는 것처럼 아무도 알리지 않는 변화도 잡아냅니다.

프로세스 안의 구독자는 `Engine.OnStateChanged`로 등록합니다. 엔진 자신의 고루틴에서 변화가 일어난 순서대로 호출되며, "X에서 Y로"를 따지는 규칙에 필요한 것이 이 점입니다. 빨라야 합니다. 엔진은 이들을 기다리지 않으며, 1만 건 넘게 뒤처지면 가장 오래된 것부터 버리고 그 수를 셉니다.

`GET /api/diagnostics`는 이를 `entities` 아래에 보고합니다.

| 필드 | 의미 |
|---|---|
| `entities` | 상태가 있는 엔티티의 수 |
| `droppedBatches` | 엔진이 너무 느려 받지 못한 버스 배치(`bus.droppedPerSubscriber.entities`에도 있음) |
| `pendingChanges`, `droppedChanges` | 상태 변경 훅 큐. 백로그가 계속 늘거나 하나라도 버려지면 훅이 너무 느리다는 뜻입니다 |

## 장치 클래스와 단위

장치 클래스는 값이 무엇인지(`temperature`, `pressure`, `volume_flow_rate`, `running`, `problem`) 알려 주어, 화면이 아이콘을 고르고 통계 소비자가 어떻게 다룰지 알게 합니다. 각 클래스에는 보통 쓰이는 단위가 있습니다. 전체 표는 `model.DeviceClasses`입니다.

- 도메인에 없는 장치 클래스는 거부됩니다.
- 클래스에 보통 쓰이지 않는 단위는 **응답에 경고와 함께 저장됩니다**. 현장은 현장 방식대로 표기하며, 온도에 `degF`를 썼다고 저장을 막을 이유는 없습니다. 온도에는 `F`와 `C`가 경고 없이 받아들여집니다. 대부분의 PLC 태그 데이터베이스가 실제로 쓰는 표기이기 때문입니다.
- `state_class`(`measurement`, `total`, `total_increasing`)는 센서에만 씁니다.
- **단위 변환은 없습니다.** 단위는 레이블일 뿐입니다.

## API

엔티티 엔드포인트는 이 API의 평소 camelCase가 아니라 snake_case 필드 이름(`entity_id`, `last_changed`)을 씁니다. 의도된 것입니다. 그 형태를 이미 이해하는 모든 것이 이 API도 이해하도록 엔티티 API가 존재하기 때문입니다.

| 엔드포인트 | 권한 | 내용 |
|---|---|---|
| `GET /api/entities` | `entities.read` | 고아 엔티티를 포함한 모든 엔티티. 필터: `?domain=`, `?device=`, `?orphaned=true\|false` |
| `GET /api/entities/{entity_id}` | `entities.read` | `{"entity": ..., "state": ...}`. 사용 안 함 엔티티는 `state`가 null |
| `GET /api/entities/{entity_id}/image` | `entities.read` | 카메라나 이미지의 최신 사진 |
| `PUT /api/entities/{entity_id}` | `entities.write` | 이름 변경을 포함해 레지스트리 필드를 바꿈. `{"entity": ..., "warnings": [...]}`로 응답 |
| `POST /api/entities` | `entities.write` | 복합 엔티티 생성. 201 `{"entity": ..., "warnings": [...]}`로 응답. [복합 설비](#복합-설비) 참고 |
| `DELETE /api/entities/{entity_id}` | `entities.write` | 복합 엔티티나 고아 엔티티 삭제. 그 밖에는 409 |
| `GET /api/states` | `entities.read` | 사용 중인 모든 엔티티의 상태를 entity_id 순으로. 필터: `?domain=` |
| `GET /api/states/{entity_id}` | `entities.read` | 상태 하나 |
| `POST /api/services/{domain}/{service}` | `values.write`(`alarm`은 `alarms.ack`) | 엔티티 하나에 서비스를 호출. [서비스](#서비스) 참고. `?dry_run=true`는 실행하지 않고 무엇을 할지 묻습니다. [먼저 묻기](#먼저-묻기-드라이런) 참고 |
| `GET /api/writes?entity={entity_id}` | `values.read` | 한 엔티티에 서비스 호출이 수행했거나 거부당한 모든 쓰기, 최신순 |

모든 역할이 `entities.read`를 가집니다. 엔티티의 상태는 이름만 다른 태그 값이고, 조회자는 이미 그것을 읽을 수 있습니다. `entities.write`는 관리자만 가집니다. entity_id는 모든 자동화, 대시보드, 에이전트가 엔티티를 가리키는 이름이므로 이를 바꾸는 일은 운영이 아니라 구성입니다.

`PUT` 본문은 이름을 적은 필드만 바꿉니다. 알 수 없는 필드와 정체성 필드(`unique_id`, `domain`, `platform`, 장치, 바인딩)는 거부됩니다.

```json
{
  "entity_id": "sensor.zone_1_temperature",
  "name": "Zone 1 temperature",
  "device_class": "temperature",
  "state_class": "measurement",
  "unit_of_measurement": "°F",
  "icon": "mdi:thermometer",
  "entity_category": "",
  "options": {},
  "disabled": false,
  "hidden": false
}
```

`options`는 `number`에서 `min`, `max`, `step`(화면이 제공하는 범위를 좁힙니다. 쓰기 게이트는 어느 경우에나 태그 자체의 범위를 확인합니다)을, `text`에서 `max_length`와 `pattern`을 받습니다. 복합 엔티티의 옵션은 도메인별로 다르며(아래 각 도메인 참고), 옵션을 바꾸는 `PUT`은 생성할 때와 똑같이 태그에 대해 검사됩니다. `sensor`, `binary_sensor`, `switch`, `alarm`은 옵션을 받지 않습니다.

엔티티에는 설비 트리의 위치와 레이블 집합도 있습니다. `equipment_id`(null이면 장치를 따름), 클라이언트가 그룹화에 쓰는 읽기 전용 `area_id`, `labels`입니다. `PUT`은 `equipment_id`와 `labels`를 다른 필드처럼 받습니다. [설비 트리와 레이블](/ko/iot/equipment/)을 참고하십시오.

## 서비스

서비스는 엔티티에 할 수 있는 일입니다. `switch.turn_on`, `number.set_value` 같은 것입니다. 엔티티에 원하는 일을 이름으로 지정하며, 그 밑에 있는 것은 태그 쓰기뿐입니다.

```
POST /api/services/switch/turn_on
{"entity_id": "switch.press_01_pump", "reason": "start of shift"}

POST /api/services/number/set_value
{"entity_id": "number.press_01_zone1_sp", "value": 212.5}
```

본문은 `entity_id`, 선택 사항인 `reason`, 서비스 데이터입니다. 호출 하나에 엔티티 하나이며 목록은 받지 않습니다. "무엇이 나갔는가"에 대한 답은 엔티티 하나에 대한 것이어야 하기 때문입니다.

### 도메인별로 받는 것

| 서비스 | 데이터 | 쓰는 값 |
|---|---|---|
| `switch.turn_on`, `switch.turn_off` | 없음 | 명령 태그에 `true` 또는 `false` |
| `switch.toggle` | 없음 | 상태 자체와 같은 규칙으로 실시간 캐시에서 읽은 현재 상태의 반대. 상태가 `unknown`, `unavailable`이거나 품질이 불량이면 호출이 거부됩니다. 상태를 모르는 것을 토글하는 것은 어느 쪽으로 움직일지 추측하는 일입니다. `turn_on` 또는 `turn_off`로 지정하십시오 |
| `number.set_value` | `value`, 숫자 | 명령 태그에 그 값 |
| `text.set_value` | `value`, 문자열 | 명령 태그에 그 문자열 |
| `select.select_option` | `option` | 명령 태그에 옵션의 원시 값 |
| `button.press` | 없음 | 명령 태그에 `press_value`, `pulse_ms` 후에 `release_value`. `single_shot` 버튼은 `press_value`를 한 번만 쓰고 그 뒤에는 쓰지 않음 |
| `motor.start`, `motor.stop` | 없음 | `run_command`에 `true` 또는 `false` |
| `motor.reset` | 없음 | `reset_command`에 펄스: `true`, `pulse_ms` 후에 `false` |
| `motor.set_speed` | `value`, 숫자 | `speed_command`에 그 값 |
| `valve.open`, `valve.close` | 없음 | `command`에 `true` 또는 `false`. 조절 밸브는 `position_command`에 100 또는 0 |
| `valve.stop` | 없음 | `stop_command`에 펄스. `single_shot` 밸브는 `true`를 한 번 씀 |
| `valve.set_position` | `position`, 0에서 100 | `position_command`에 그 위치 |
| `loop.set_setpoint` | `value`, 숫자 | `setpoint`에 그 값 |
| `loop.set_mode` | `mode`: `auto`, `manual`, `cascade` 중 하나 | `mode`에 해당 모드의 원시 값 |
| `loop.set_output` | `value`, 숫자 | `output`에 그 값. **루프가 수동일 때만** |
| `counter.reset` | 없음 | 숫자형 `reset_command`에 0, bool형이면 펄스 |
| `alarm.acknowledge` | `note`, 선택 | 태그 없음: 알람 엔진의 확인 |
| `alarm.shelve` | `minutes`, 1에서 1440 | 태그 없음: 알람 엔진의 보류 |
| `alarm.unshelve` | 없음 | 태그 없음: 알람 엔진의 보류 해제. 보류된 알람에만 |
| `script.turn_on` | 스크립트의 필드 | 태그 자체는 없음: [스크립트](/ko/iot/scripts/)를 실행하며, 그 단계는 `script:<id>`로 게이트를 거쳐 씀 |
| `script.turn_off` | 없음 | 태그 없음: 그 스크립트의 모든 실행을 중지 |
| `scene.turn_on` | `params`(레시피의 매개변수)와 `version`, 둘 다 선택 | 태그 자체는 없음: [레시피](/ko/iot/recipes/)를 적용하며, 그 대상은 하나의 호출 ID로 게이트를 거쳐 씀 |
| `light.turn_on` | `brightness`, 0에서 100, 선택 | `command`에 `true`, 그다음 `brightness_command`에 밝기 |
| `light.turn_off` | 없음 | `command`에 `false` |
| `light.toggle` | 없음 | 조명의 상태 피드백이 말하는 것의 반대. 읽을 수 없으면 거부 |
| `cover.open`, `cover.close`, `cover.stop` | 없음 | `command`에 `open`, `close` 또는 `stop` |
| `cover.set_position` | `position`, 0에서 100 | `position_command`에 그 위치 |
| `lock.lock`, `lock.unlock`, `lock.open` | 없음 | `state`에 `lock`, `unlock` 또는 `open` |
| `fan.turn_on` | `percentage`, `preset_mode`, 둘 다 선택 | `state`에 `true`, 그다음 지정된 각 값 |
| `fan.turn_off`, `fan.toggle` | 없음 | `state`에 `false`, 또는 피드백이 말하는 것의 반대 |
| `fan.set_percentage` | `percentage`, 0에서 100 | `percentage`에 |
| `fan.set_preset_mode`, `fan.set_direction` | `preset_mode`, `direction` | `preset_mode`, `direction`에 |
| `fan.oscillate` | `oscillating`, true 또는 false | `oscillating`에 |
| `siren.turn_on`, `siren.turn_off`, `siren.toggle` | 없음 | 스위치처럼 `state`에 |
| `notify.send_message` | `message` | `message`에 그 메시지 |

역할이 바인딩되지 않은 복합 서비스(`speed_command`가 없는 모터의 `set_speed`)는 무엇이든 계획하기 전에 알 수 없는 서비스로 거부됩니다.

`sensor`와 `binary_sensor`는 읽기 전용이며 서비스를 받지 않습니다. 서비스가 받지 않는 필드가 서비스 데이터에 있으면, 다른 본문에서 철자가 틀린 필드를 거부하는 것과 같은 방식으로 거부됩니다. 의도한 필드를 조용히 빼고 진행하는 호출은 안 된다고 말해 주는 호출보다 나쁩니다.

정수인 숫자는 정수 태그에 정수로 전달됩니다. `42.0`은 `42`입니다.

### 모든 호출은 쓰기 게이트를 거칩니다

서비스 호출은 순서가 있는 쓰기 목록이 되고, 모든 쓰기는 `runtime.Manager.Write`를 거칩니다. 그래서 게이트가 태그 쓰기에 적용하는 모든 것을 서비스 호출에도 같은 순서로 적용합니다.

1. 쓰기가 켜져 있을 것(`safety.allowWrites`), 에이전트라면 에이전트 쓰기도 켜져 있을 것
2. 태그가 활성화되어 있을 것(`writable`)
3. 값이 태그의 범위 안에 있을 것. 거부하며, 절대 잘라 맞추지 않음
4. 그다음 엔티티만 아는 것을, 그 시점의 엔티티와 태그에 대해 게이트 안에서 검사
   - 엔티티가 사용 안 함이 아닐 것(상태가 없는 것에 명령하는 것은 허용되지 않음)
   - `number`의 `min`과 `max`. 태그의 범위를 좁히기만 할 수 있음
   - `number`의 `step`. 최솟값(엔티티의 최솟값, 없으면 태그 범위의 최솟값, 없으면 0)에서부터 셈. 정수 태그는 엔티티가 달리 정하지 않으면 step이 1이므로, 홀딩 레지스터에 `1.5`를 쓰면 드라이버가 조용히 `1`로 잘라 버리는 대신 거부됨
   - `text`의 `max_length`(문자 수, 설정이 없으면 255)와 값 전체가 일치해야 하는 `pattern`
   - 엔티티의 것이 아닌 `select` 옵션이나 루프 모드. 요청된 옵션이나 모드 그대로 게이트에 보내져 거기서 거부되므로, 없는 옵션을 시도하는 사람이 기록에 남음
   - 0에서 100을 벗어난 밸브 위치
   - 모드 태그를 그 순간 실시간 캐시에서 읽었을 때 수동이 아닌(자동, 캐스케이드, 어느 모드도 아닌 값, 읽을 수 없음) 루프의 `set_output`

이 단계 어디에서든 거부된 모든 호출은 **감사**됩니다. 엔티티, 서비스, 호출 ID가 담기고 `succeeded`가 false이며 이유가 `refused:`로 시작하는 `write_audit` 행이 남습니다. `values.write`가 없는 사용자도 포함됩니다. API는 403만 응답하고 잊지 않습니다. 호출을 거부됨으로 표시해 게이트에 보내고, 게이트는 아무것도 쓰기 전에 거부하며, 거부는 요청된 값과 함께 엔티티의 기록에 남습니다.

이 검사는 이름이 아니라 장치 쓰기의 형태에 맞춰져 있으므로, 새 래퍼나 그 자리에서 선언한 인터페이스를 통한 우회도 잡아냅니다.

### 호출이 응답하는 것

```json
{
  "call_id": "9f2c4e1a7b3d5c60",
  "entity_id": "switch.press_01_pump",
  "service": "switch.turn_on",
  "writes": [
    {"tag": "press-01/pump", "value": "true", "status": "written"}
  ]
}
```

각 쓰기에는 상태가 있습니다.

| 상태 | 의미 |
|---|---|
| `written` | 장치가 받아들였음 |
| `not_sent` | 장치에 닿기 전에 게이트가 돌려보냄: 거부, 세션 없음, 열 수 없었던 감사 행 |
| `failed` | 나갔으나 장치나 연결이 오류를 보고함. 반영되었는지는 알 수 없음 |
| `skipped` | 같은 호출의 앞선 쓰기가 성공하지 못해서 시도하지 않음 |

실패한 호출은 오류의 상태 코드로 응답합니다(403은 정책이나 권한 때문에 거부, 422는 값 거부, 409는 상태를 알 수 없는 토글이거나 서비스에 맞지 않는 상태의 설비, 503은 장치가 연결되지 않음, 502는 장치가 쓰기를 받고 오류를 보고함, 404는 해당 엔티티 없음, 400은 형식이 잘못된 호출, 500은 해제가 처리되지 않은 누름이거나 Gateway 내부 오류이며 이때 `error`는 서버 로그에 대한 참조일 뿐). 본문은 같고 `error`가 추가됩니다.

한 호출의 쓰기는 순서대로 나가고, 성공하지 못한 첫 쓰기에서 호출이 끝나며, **이미 쓴 것은 되돌리지 않습니다**. 되돌리는 것 자체가 이미 움직인 설비에 누가 요청하지도 않은 쓰기를 하는 일이기 때문입니다. 그 판단은 운전원의 몫이고, 응답은 호출이 어디서 멈췄는지 정확히 알려 줍니다. 한 호출의 모든 쓰기는 감사 기록과 응답에서 같은 `call_id`를 공유합니다.

예외가 하나 있으며 순간 명령입니다. 버튼 누름, 모터 리셋, 밸브 정지, 비트 카운터 리셋입니다. 이들은 쓰기가 둘입니다. 누름과 pulse_ms 후의 해제이며, 해제를 건너뛰면 누름 버튼이 눌린 채로 남으므로 가볍게 건너뛸 수 없습니다. 그래서 다음과 같이 처리합니다.

- 누름이 나갔고 오류를 보고했더라도(`failed`) 해제는 여전히 보냅니다. 반영되었을 수 있기 때문입니다. 누름이 `not_sent`일 때만 건너뜁니다. 그때는 눌려 있는 것이 없습니다.
- 펄스 도중에 호출자가 연결을 끊어도 해제는 보냅니다. 호출자 없이 호출이 계속 진행됩니다.
- 누름은 써졌는데 해제가 거부되었거나 실패하면 호출은 500으로 실패하고 그렇게 알립니다. 태그가 **아직 누름 값을 가지고 있을 수 있으니** 확인하고 직접 해제하십시오. 해제의 거부나 실패는 같은 호출 ID로 감사 기록에 남고, 호출은 경고가 아니라 오류 심각도로 엔티티 아래에 기록됩니다.

펄스는 `pulse_ms` 길이이며 기본 500, 최대 10,000입니다. 호출은 해제가 끝났을 때 응답하므로 호출자는 펄스 동안 기다립니다.

각 호출은 시스템 로그에도 한 줄로 남습니다. entity_id 아래, 범주 `write`, 이유와 함께, 상세에는 호출 ID, 출처, 상태가 붙은 모든 쓰기가 있습니다. 개별 태그 쓰기는 지금까지처럼 각 태그 아래에 자신의 줄을 유지합니다.

`GET /api/writes?entity=switch.press_01_pump`는 거부를 포함해 최신순으로 정렬된 그 엔티티의 감사 기록입니다. 행에는 `entityId`, `service`, `callId`가 있고, 태그에 직접 쓴 것은 이를 비워 두므로 `/api/writes`를 읽는 기존 모든 코드는 전과 똑같은 것을 봅니다. 마이그레이션 `0007_service_audit.sql`이 세 열을 추가하며, 기존의 모든 행은 비어 있습니다.

### 먼저 묻기: 드라이런

`POST /api/services/{domain}/{service}?dry_run=true`는 호출로 무엇을 할지 게이트에 묻고, 아무것도 실행하지 않습니다. 본문도 권한도 같습니다.

```json
{"dry_run":true,"entity_id":"number.press_01_zone1_sp","service":"number.set_value","writes":[{"tag":"press-01/zone1_sp","value":"212.5","status":"would_write"}]}
```

```json
{"dry_run":true,"error":"press-01/zone1_sp: this tag is not marked writable","entity_id":"number.press_01_zone1_sp","service":"number.set_value","writes":[{"tag":"press-01/zone1_sp","value":"212.5","status":"not_sent","error":"press-01/zone1_sp: this tag is not marked writable"}]}
```

호출은 실제와 똑같이 계획되고, 호출이 할 모든 쓰기는 게이트 자체의 검사를 같은 순서로, 지금 이 순간의 태그, 엔티티, 장치에 대해 통과해야 합니다. 쓰기 켜짐, 에이전트 스위치, 태그 활성화, 범위, 엔티티만 아는 모든 것(step, pattern, 수동인 루프, 사용 안 함 엔티티), 장치 세션입니다. 거부될 첫 쓰기는 이유와 함께 `not_sent`이고 나머지는 `skipped`이며, `error`는 실제 호출이 실패할 오류와 **한 글자도 다르지 않습니다**. 나갈 쓰기는 `would_write`입니다. 둘 다에 답하는 것은 게이트의 함수 하나(`precheck`)이므로, 드라이런이 실제 쓰기가 하지 않는 검사로 통과할 수는 없습니다. `alarm` 엔티티는 태그를 쓰지 않으므로 드라이런은 대신 알람 검사를 하고(엔진 실행 중, 정의가 아직 있음, 엔티티 사용 중, 보류된 알람만 보류 해제) 쓰기 없이 응답합니다. 알람은 건드리지 않으며 알람 기록에는 아무것도 남지 않습니다.

이것은 질문이므로 거부든 아니든 판정은 200으로 응답합니다. 실제 호출이라면 어떤 검사 이전에 돌려보냈을 요청(해당 엔티티 없음, 도메인이 받지 않는 서비스, 받지 않는 데이터, 상태를 알 수 없는 토글, 경로의 도메인 불일치)은 실제 호출과 같은 상태와 오류로 응답합니다. 권한이 없는 사용자는 똑같은 403을 받습니다.

드라이런은 아무것도 쓰지 않고, 감사 행을 열지 않으며, 시스템 로그에 아무것도 남기지 않고, 호출 ID도 쓰지 않습니다. 시도된 것이 없으므로 설명할 것도 없습니다.

이것은 **지금 이 순간** 무슨 일이 일어날지를 알려 줍니다. 드라이런과 실제 호출 사이에 장치가 끊어지거나 누군가 태그를 활성화 해제할 수 있으며, 실제 호출은 쓰는 순간에 처음부터 다시 검사됩니다. 한 경우는 실제 호출 자체의 검사보다 더 정확하게 알려 줍니다. 워커가 다시 연결하는 동안 세션이 끊어진 장치입니다. 실제 쓰기는 드라이버까지 가서 거기서 실패하고(`failed`, 503, 시도에 대한 감사 행), 드라이런은 같은 오류로 처음부터 `not_sent`라고 말합니다.

엔티티 화면의 명령 프롬프트와 엔티티 서랍이 이를 씁니다. 프롬프트가 열릴 때와 값을 입력할 때 묻고, 거부는 확인을 누르기 전에 게이트의 말 그대로 프롬프트에 표시됩니다. 조언이지 잠금은 아닙니다. 확인은 여전히 게이트로 가고, 게이트가 다시 결정합니다.

## 복합 설비

태그 하나는 엔티티 하나에 대응합니다. 펌프는 태그 하나에 대응하지 않습니다. 기동 명령, 운전 접점, 고장, 리셋, 어쩌면 속도까지 있고, 운전원은 이것을 하나로 생각합니다. 복합 엔티티가 그 하나이며, 이름 붙은 **역할**마다 태그에 바인딩됩니다.

관리자가 `POST /api/entities`로 만듭니다.

```json
{
  "domain": "motor",
  "name": "Infeed pump",
  "device_class": "pump",
  "options": {"pulse_ms": 500},
  "bindings": [
    {"role": "running",       "device_id": "press-01", "tag_name": "P101_Running"},
    {"role": "run_command",   "device_id": "press-01", "tag_name": "P101_RunCmd"},
    {"role": "fault",         "device_id": "press-01", "tag_name": "P101_Fault"},
    {"role": "reset_command", "device_id": "press-01", "tag_name": "P101_Reset"}
  ]
}
```

`entity_id`는 선택 사항입니다. 생략하면 이름에서 만들어집니다(`motor.infeed_pump`, 겹치면 `_2` 등). 지정하면 정확히 그대로 쓰이고, 이미 쓰는 ID는 조용히 `_2`가 되지 않고 409입니다. 그 이름을 요청했기 때문입니다. `name`, `device_class`, `unit_of_measurement`, `icon`, `entity_category`, `options`는 모든 엔티티가 가진 레지스트리 필드와 같습니다. 설비 트리에 배치하고 레이블을 붙이는 일은 나중에 `PUT`으로 합니다.

생성은 지금의 태그에 대해 확인할 수 있는 모든 것을 확인하고, 맞지 않는 것은 무엇이든 거부(400, 고칠 것을 알려 줌)합니다.

- 도메인이 `select`, `button`, `motor`, `valve`, `loop`, `counter`, `weather` 중 하나일 것(`GET /api/entities/composites`가 어느 것인지와 각 도메인의 역할을 알려 줌). 태그 도메인은 태그에서, `alarm`은 알람 정의에서 만들어집니다.
- 필수 역할이 모두 바인딩되어 있고, 도메인에 없는 역할은 없을 것
- **바인딩된 모든 태그가 존재할 것**
- **모든 태그의 유형이 역할에 맞을 것**: 모터의 `running`은 bool, 밸브의 `position`은 숫자, 카운터의 카운트는 정수
- **서비스가 쓰는 모든 태그가 이미 활성화되어 있을 것**(`writable`). 복합 엔티티는 아무것도 활성화하지 않습니다. 지점을 활성화하는 일은 지금까지처럼 태그를 하나씩 보고 사람이 내리는 결정입니다.
- 옵션의 모든 원시 값(select 옵션의 값, 버튼의 누름과 해제 값, 루프의 모드)이 그 태그가 가질 수 있는 값일 것. 정수 레지스터에 `1.5`는 누군가 버튼을 누를 때가 아니라 지금 거부됩니다.

복합 엔티티는 태그가 모두 한 장치에 있으면 그 장치와 함께 삭제되고, 여러 장치에 걸쳐 있으면 어느 장치에도 속하지 않습니다. 바인딩은 고정입니다. 태그 구성이 다르면 다른 엔티티이므로, 삭제하고 새로 만드십시오.

모든 생성과 삭제는 entity_id 아래에 범주 `config`로, 바인딩과 함께 시스템 로그에 한 줄로 남습니다.

### 역할

| 도메인 | 역할 | 태그 유형 | <span class="sr-only">상세</span> |
|---|---|---|---|
| `select` | `state` | any | 필수. 피드백: 읽어서 옵션을 찾음 |
| | `command` | any | 필수, 활성화. 옵션의 원시 값으로 씀. `state`와 같은 태그일 수 있음 |
| `button` | `command` | any | 필수, 활성화. 펄스 |
| `motor` | `running` | bool | 필수. 피드백: 운전 접점 |
| | `run_command` | bool | 필수, 활성화. `start`는 true, `stop`은 false를 씀 |
| | `fault` | bool | 피드백 |
| | `reset_command` | bool | 활성화. `reset`이 펄스를 줌 |
| | `speed` | number | 피드백, `speed` 속성 |
| | `speed_command` | number | 활성화. `set_speed`가 씀 |
| `valve` | `state` | any | 피드백: 스스로 알린 밸브가 자신의 위치를 말로 알려 줌 |
| | `opened`, `closed` | bool | 피드백: 리미트 스위치 |
| | `position` | number | 피드백, 0에서 100퍼센트 |
| | `fault` | bool | 피드백 |
| | `command` | bool | 활성화. 온오프 밸브: `open`은 true, `close`는 false를 씀 |
| | `position_command` | number | 활성화. 조절 밸브: `set_position`, 그리고 `open`/`close`는 100/0 |
| | `stop_command` | bool | 활성화. `stop`이 펄스를 줌 |
| `loop` | `pv` | number | 필수. 상태 |
| | `setpoint` | number | 필수, 활성화. 속성을 위해 읽고 `set_setpoint`가 씀 |
| | `output` | number | 필수, 활성화. 속성을 위해 읽고 `set_output`이 씀 |
| | `mode` | any | 필수, 활성화. 모드를 알기 위해 읽고 `set_mode`가 씀 |
| `counter` | `state` | integer | 필수. 카운트 |
| | `reset_command` | bool 또는 number | 활성화. bool이면 펄스, number이면 0을 씀(카운트 레지스터 자체일 수 있음) |
| `weather` | `temperature` | number | 필수. 상태 |
| | `humidity`, `pressure`, `wind_speed`, `wind_gust`, `wind_bearing`, `rain_rate`, `rain_today`, `solar_radiation`, `uv_index` | number | 피드백, 각각 속성. 활성화된 것은 없음: 기상 관측소는 읽기만 하고 명령하지 않음 |

밸브에는 `state`, `opened`, `closed`, `position` 중 적어도 하나(어딘가에서 위치를 알려 줘야 함)와 `command`, `position_command` 중 정확히 하나가 필요합니다. 둘 다 있으면 "어디로 가라고 지시받았는가"에 대한 답이 둘이 되고, 리미트 사이의 상태는 그 답에 달려 있습니다. PLC에 정말 둘 다 있다면 엔티티를 둘 만드십시오.

### 옵션

| 옵션 | 도메인 | <span class="sr-only">상세</span> |
|---|---|---|
| `select_options` | `select` | 필수: `[{"option": "low", "value": 1}, ...]`, 화면이 제공하는 순서대로. 이름은 고유, 값도 고유(한 값에 옵션이 둘이면 상태가 추측이 됨), 각 값은 숫자, bool 또는 문자열 |
| `press_value`, `release_value` | `button` | 함께 쓰거나 둘 다 쓰지 않음. bool 태그에서 생략하면 `true`와 `false`이며, 버튼이 하는 일이 기록에 남도록 옵션에 기록됨. 다른 태그 유형에서는 둘 다 필요 |
| `pulse_ms` | `button`, `motor`, `valve`, `counter` | 순간 명령을 유지하는 시간. 1에서 10,000, 설정이 없으면 500 |
| `single_shot` | `button`, `valve` | `true`이면 `press_value`를 한 번 쓰고 해제하지 않음. 누름이 명령의 전부임. 검색으로 찾은 MQTT 버튼이 이에 해당하며, 그 "해제"는 장치가 요청한 적 없는 두 번째 명령이기 때문. `press_value`를 받고 `release_value`나 `pulse_ms`는 받지 않음. 밸브에서는 `stop`이 펄스 대신 `true`를 한 번 씀. 검색으로 찾은 밸브의 정지는 그 자체로 하나의 명령이기 때문 |
| `event_types` | `event` | 알려 줄 때, 이벤트가 발생시킬 수 있는 이벤트 유형 |
| `role_choices` | `lock`, `fan`, `siren`, `notify`, `update`, `device_tracker`, `climate`, `humidifier`, `water_heater` | 명령 가능한 각 역할이 제공하는 단어를 역할별로, 각각 서로 다른 1개에서 64개: 서모스탯의 모드. 검색이 구성에서 설정함 |
| `modes` | `loop` | 필수: 각 모드에 대한 모드 태그의 원시 값, 적어도 `{"auto": 1, "manual": 0}`, 컨트롤러에 있으면 `cascade` |

### 복합 엔티티의 상태가 정해지는 방식

복합 엔티티의 상태는 **피드백**에서 나옵니다. HotLoop이 명령을 보냈다는 사실로 계산하는 일은 절대 없습니다. 기동 명령을 받았지만 운전 접점이 닫히지 않은 모터는 운전 중이 아니라 기동 중이며, 접점이 끝내 닫히지 않으면 누군가 살펴볼 때까지 기동 중으로 남습니다. 명령 태그를 다시 읽은 값은 피드백으로 인정합니다. HotLoop이 쓴 것을 기억하는 것이 아니라 PLC가 자신이 가진 값을 말하는 것이기 때문입니다.

복합 엔티티는 **낙관적이지 않습니다**. 센서 하나는 불량 읽기 중에도 마지막 정상 값을 보여 주지만 복합 엔티티는 그렇지 않습니다. 상태를 결정하는 모든 피드백 역할이 정상 읽기를 가져야 하며, 그렇지 않으면 다음과 같습니다.

| 조건 | `state` | `quality` |
|---|---|---|
| 결정하는 태그가 없거나 그 장치가 다운됨 | `unavailable` | `bad` |
| 결정하는 태그에 아직 읽은 값이 없거나 불량 읽기 | `unknown` | `bad` |
| 결정하는 모든 태그가 정상이고 그중 하나가 불확실하거나 성능 저하 장치에 있음 | 그 상태 | `uncertain` |
| 결정하는 모든 태그가 정상 | 그 상태 | `good` |

고장 입력이 응답을 멈춘 모터는 1초 전에 `running`이었더라도 `unknown`입니다. 어느 역할이 결정하는지는 아래에 있고, 나머지는 속성만 채우며, 읽을 수 없는 것은 그냥 빠집니다.

복합 엔티티의 `armed` 속성은 서비스가 쓰는 모든 태그가 지금 활성화되어 있을 때만 true입니다. 여기서 기동은 되지만 정지가 안 되는 모터는 화면이 제공할 것이 아닙니다.

### `motor`

결정 역할은 `running`과, 바인딩된 경우 `fault`입니다. 상태는 처음 일치하는 규칙으로 정해집니다.

1. `fault`가 켜짐: 다른 무엇이 참이든 **`fault`**. 운전과 고장이 함께인 것은 모순이고, 사람이 필요한 쪽이 고장입니다. `running` 속성은 여전히 돌고 있다고 알려 줍니다.
2. 운전 중이고 기동 명령의 읽기 값이 꺼짐: **`stopping`**.
3. 운전 중: **`running`**.
4. 운전 중이 아니고 기동 명령의 읽기 값이 켜짐: **`starting`**.
5. 그 밖: **`stopped`**.

기동 명령의 읽기 값을 읽을 수 없으면 그것은 아무것도 결정하지 않으며, 모터는 접점만으로 `running` 또는 `stopped`가 됩니다. HotLoop은 성사되지 않는 기동에 타임아웃을 두지 않습니다. 그것은 기동 실패이며 PLC나 운전 접점의 알람 정의에 속합니다.

속성: `running`, `fault`(바인딩된 경우), `command`(읽은 값), `speed`(바인딩되어 있고 읽을 수 있는 경우), `device_class`(`pump`, `fan`, `conveyor`, `compressor`, `agitator`).

### `valve`

스스로 알린 밸브(MQTT 검색)는 `state` 역할에서 자신의 위치를 말로 알려 줍니다. `open`, `closed`, `opening`, `closing`, `stopped`이며 그것이 상태이고, 위치를 보고하면 `position`에서 `current_position`이 옵니다. 이 중 어느 것도 아닌 말은 `unknown`이며 말한 내용은 `raw_value`에 남습니다. 이 절의 나머지는 PLC 태그로 만든 밸브에 대한 것입니다.

결정 역할은 바인딩된 `opened`, `closed`, `position`, `fault` 전부입니다. 상태는 처음 일치하는 규칙으로 정해집니다.

1. `fault`가 켜짐: **`fault`**.
2. 두 리미트 스위치가 모두 닫힘: **`fault`**, `limit_conflict: true`와 함께. 밸브는 열려 있으면서 닫혀 있을 수 없으므로 스위치 하나가 거짓말을 하고 있으며, 어느 쪽인지는 추측할 일이 아닙니다.
3. 열림 리미트가 닫힘: **`open`**. 닫힘 리미트가 닫힘: **`closed`**.
4. 리미트 스위치는 없고 위치만 있음: 1% 이하는 **`closed`**, 99% 이상은 **`open`**.
5. 양 끝 사이에서 이동 중이거나 명령받은 대로 정지: 위치 명령의 읽은 값이 위치보다 1% 넘게 크면 **`opening`**, 1% 넘게 작으면 **`closing`**, 1% 이내면 **`stopped`**. 온오프 명령의 읽은 값이 켜짐이면 **`opening`**, 꺼짐이면 **`closing`**. 판단할 근거가 없으면 **`stopped`**.

리미트 사이에서 멈췄지만 여전히 열림 명령을 받고 있는 온오프 밸브는 `opening`으로 읽힙니다. 그 자리에서 멈춘 것을 보려면 `position`을 바인딩하십시오.

`current_position`은 바인딩된 경우 위치 피드백이고, 아니면 열림 리미트에서 100, 닫힘 리미트에서 0이며, 그 사이에서는 없습니다. 다른 속성: `open_limit`, `closed_limit`, `fault`, `device_class`(`water`, `gas`, `steam`, `air`).

### `loop`

상태는 프로세스 변수이며 `pv`만으로 센서와 같은 방식으로 표시됩니다. 속성은 `setpoint`와 `output`(읽을 수 있을 때 있음), `mode`(모드 태그가 읽은 모드의 이름이며, 읽을 수 없거나 어느 모드도 아닌 값이면 `unknown`), `modes`(구성된 이름), `unit_of_measurement`(엔티티의 단위, 없으면 PV 태그의 단위)입니다. 루프는 센서 장치 클래스를 받습니다. 온도 루프, 압력 루프가 그 예입니다.

`set_output`은 **쓰는 순간** 루프가 수동으로 읽히지 않으면 게이트 안에서 거부됩니다. 자동 상태의 루프에 출력을 쓰면 컨트롤러와 싸우고, 캐스케이드에서는 둘과 싸웁니다. 읽을 수 없는 모드는 수동이 아닙니다. 거부는 다른 것과 똑같이 엔티티, 서비스, 호출 ID, 요청된 값이 담긴 `write_audit` 행이며, 호출은 409로 응답합니다. 먼저 `set_mode`로 루프를 수동으로 바꾸십시오.

### `counter`

상태는 카운트이며 정수 태그입니다. `reset`은 숫자형 `reset_command`에 0을 쓰거나(PLC가 그렇게 리셋한다면 카운트 레지스터 자체를 바인딩) bool형에 펄스를 줍니다. `reset_command`가 없는 카운터는 읽기 전용입니다. `unit_of_measurement`는 엔티티의 단위, 없으면 태그의 단위입니다.

### `weather`

옥상 관측소를 엔티티 하나로: [날씨](/ko/iot/weather/)를 참고하십시오. 상태는 온도이고, 다른 모든 읽기는 속성이며 센서를 읽을 수 있을 때만 있고, 이슬점, 열지수, 체감 온도는 이로부터 계산됩니다. 바인딩되어 있으나 읽을 수 없는 값은 `unavailable`에 이름이 올라가며 0으로 표시되는 일은 없습니다. 서비스는 받지 않습니다.

### `select`

상태는 `state` 태그가 읽은 원시 값에 해당하는 옵션입니다. 어느 옵션도 아닌 값은 가장 가까운 옵션이나 마지막 옵션이 아니라 `unknown`이며, 원시 값은 `raw_value`에 있습니다. `options` 속성은 옵션 이름을 순서대로 나열합니다. select의 것이 아닌 옵션은 게이트에서 거부되고, 요청된 옵션과 함께 감사됩니다.

### `button`

버튼에는 피드백이 없습니다. 상태는 이 Gateway를 통해 마지막으로 누른 시각이며, Gateway가 시작된 뒤 누른 적이 없으면 `unknown`입니다. 명령 태그가 없거나 장치가 다운되면 `unavailable`입니다. 그때는 눌러도 동작할 수 없기 때문입니다. 마지막 누름은 메모리에 있으므로 재시작하면 초기화됩니다. 감사 기록에는 모든 누름이 남으며, 로그북이 버튼의 상태를 기록하지 않는 이유이기도 합니다.

## 조명, 커버, 이벤트

알린 장치에 대해 [MQTT 검색](/ko/iot/mqtt-discovery/)이 만들며, 검색이 그 장치를 위해 만든 태그에 바인딩됩니다. PLC 태그로 이것들을 만드는 사람은 없으므로 `POST /api/entities`는 받지 않습니다. 모든 복합 엔티티와 같은 규칙입니다. 상태는 HotLoop이 마지막에 보낸 것이 아니라 피드백이 말하는 것이고, 모든 서비스는 게이트를 거치는 쓰기이며, 각 태그는 먼저 사람이 활성화합니다.

| 도메인 | 역할 | 태그 유형 | <span class="sr-only">상세</span> |
|---|---|---|---|
| `light` | `state` | bool | 피드백: 켜짐 또는 꺼짐 |
| | `command` | bool | 활성화. `turn_on`은 true, `turn_off`는 false를 씀. `state`와 같은 태그 |
| | `brightness` | number | 피드백, 0에서 100퍼센트, `brightness` 속성 |
| | `brightness_command` | number | 활성화. `brightness`가 있는 `turn_on`. `brightness`와 같은 태그 |
| `cover` | `state` | any | 피드백: `open`, `closed`, `opening`, `closing` 또는 `stopped` |
| | `command` | any | 활성화. `open`, `close` 또는 `stop`. `state`와 같은 태그 |
| | `position` | number | 피드백, 0(닫힘)에서 100(열림), `current_position` |
| | `position_command` | number | 활성화. `set_position`. `position`과 같은 태그 |
| `event` | `state` | any | 마지막으로 발생시킨 이벤트 유형 |
| `lock` | `state` | any | 읽고 씀: `locked`, `unlocked`, `locking`, `unlocking`, `jammed`, `open`, `opening`. `lock`, `unlock`, `open`을 받음 |
| `fan` | `state` | bool | 읽고 씀: 켜짐 또는 꺼짐 |
| | `percentage` | number | 읽고 씀, 0에서 100 |
| | `preset_mode`, `direction` | any | 읽고 씀 |
| | `oscillating` | bool | 읽고 씀 |
| `siren` | `state` | bool | 읽고 씀: 켜짐 또는 꺼짐 |
| `notify` | `message` | any | 씀: 메시지. 읽을 것 없음 |
| `update` | `installed_version`, `latest_version` | any | 읽음 |
| `device_tracker` | `state` | any | 읽음: `home`, `not_home` 또는 그것이 가리키는 존 |
| `climate` | `mode` | any | 읽고 씀: 상태. `hvac_mode`가 있는 `set_hvac_mode` |
| | `temperature`, `target_temp_low`, `target_temp_high` | number | 읽고 씀. 이 중 아무것이나 있는 `set_temperature` |
| | `target_humidity` | number | 읽고 씀. `humidity`가 있는 `set_humidity` |
| | `fan_mode`, `swing_mode`, `swing_horizontal_mode`, `preset_mode` | any | 읽고 씀, 각각 자신의 `set_` 서비스로 |
| | `current_temperature`, `current_humidity`, `action` | number, number, any | 읽음 |
| | `power` | bool | 씀: `turn_on`은 true, `turn_off`는 false. 읽을 것 없음 |
| `humidifier` | `state` | bool | 읽고 씀: 켜짐 또는 꺼짐 |
| | `target_humidity` | number | 읽고 씀. `humidity`가 있는 `set_humidity` |
| | `mode` | any | 읽고 씀. `mode`가 있는 `set_mode` |
| | `current_humidity`, `action` | number, any | 읽음 |
| `water_heater` | `mode` | any | 읽고 씀: 상태. `operation_mode`가 있는 `set_operation_mode` |
| | `temperature` | number | 읽고 씀. `set_temperature` |
| | `current_temperature` | number | 읽음 |
| | `power` | bool | 씀: `turn_on`, `turn_off` |
| `alarm_control_panel` | `state` | any | 읽음: `disarmed`, `armed_home`, `armed_away`, `armed_night`, `armed_vacation`, `armed_custom_bypass`, `pending`, `triggered`, `arming`, `disarming`. `alarm_arm_home`, `alarm_arm_away`, `alarm_arm_night`, `alarm_arm_vacation`, `alarm_arm_custom_bypass`, `alarm_disarm`, `alarm_trigger`로 씀 |
| `vacuum` | `state` | any | 읽음: `cleaning`, `docked`, `paused`, `idle`, `returning`, `error`. `start`, `pause`, `stop`, `return_to_base`, `clean_spot`, `locate`로 씀 |
| | `battery_level` | number | 읽음 |
| | `fan_speed` | any | 읽고 씀. `fan_speed`가 있는 `set_fan_speed` |
| `lawn_mower` | `activity` | any | 읽음: `mowing`, `paused`, `docked`, `error`, `returning` |
| `camera` | `image` | any | 읽음: 최신 사진의 해시. 상태는 바뀐 시각이며, `entity_picture`는 사진을 가져올 곳 |
| `image` | `image` 또는 `url` | any | 읽음: 카메라와 같은 보관된 사진, 또는 링크(`url`, http나 https만 가능하며 가져오지 않음) |
| | `start_mowing`, `pause`, `dock` | bool | 씀: 같은 이름의 서비스로 각각 한 번의 누름 |

상태는 state 역할이 읽은 값(bool이면 켜짐 또는 꺼짐)이고, 읽을 수 없으면 `unknown`이며, 읽을 수 있는 다른 모든 역할은 자신의 이름으로 속성이 됩니다. 팬의 `percentage`, `preset_mode`, `oscillating`, `direction`이 그 예입니다. `toggle`은 피드백을 따르며 피드백이 없으면 거부됩니다. 알림 장치는 읽을 것이 없으며 상태는 `unknown`이고 `feedback: none`입니다. 업데이트는 설치된 것이 최신이 아닐 때 `on`이며 서비스를 받지 않습니다. HotLoop은 펌웨어를 설치하지 않습니다. 플래시 실패는 곧 가동 중단이기 때문입니다. 검색으로 찾은 장면은 단일 실행 버튼이며, 그 누름이 장면의 페이로드입니다.

무엇을 보낼 수 있는지는 구성에 따라 속성에 있습니다. 서모스탯의 `hvac_modes`, `fan_modes`, `preset_modes`, `swing_modes`, 가습기의 `available_modes`, 온수기의 `operation_list`, 팬의 `preset_modes`, 청소기의 `fan_speed_list`(엔티티의 `role_choices` 옵션에서 오며, 검색이 구성과 보조를 맞춰 유지), 설정값의 `min_temp`/`max_temp`와 `min_humidity`/`max_humidity`(태그의 범위에서)입니다. 이것은 화면이 제공하는 것입니다. 규칙을 정하는 것은 아닙니다. 속성이 무엇을 말하든, 게이트는 설정값을 태그의 범위 안에 두고 드라이버는 구성에 없는 단어를 거부합니다. 세 키가 모두 없는 `set_temperature`는 아무 일도 하지 않는 호출이 아니라 거부됩니다. 전원 토픽이 없는 서모스탯의 `turn_on`도 "켜짐"이 어느 모드인지 추측하지 않고 거부됩니다.

### `light`

`state` 피드백에 따라 켜짐 또는 꺼짐이며, 읽을 수 없으면 `unknown`이고, 상태 토픽이 아예 없으면 영원히 `unknown`이며 `feedback: none`입니다. 밝기는 속성이고, JSON 스키마 조명의 `color_mode`, `color`, `color_temp`, `effect`도 속성입니다. 표시만 하고 명령하지는 않습니다. `toggle`은 피드백을 따르며 판단할 피드백이 없으면 거부됩니다.

### `cover`

있으면 `state` 피드백입니다. 위치만 있으면 1% 이하는 `closed`, 그보다 크면 `open`입니다. 다섯 가지 중 어느 것도 아닌 값은 `raw_value`와 함께 `unknown`입니다. `current_position`은 위치가 있을 때 그 위치입니다.

### `event`

이벤트의 상태는 마지막으로 발생한 **시각**(RFC 3339)이고 `event_type`은 그것이 무엇이었는지이며, `event_types`는 발생시킬 수 있는 것을 나열합니다. HotLoop이 읽기 시작한 뒤 발생한 적이 없으면 `unknown`입니다. 서비스는 받지 않습니다. 이벤트에 명령하는 것은 없습니다. 한 번의 폴링에 이벤트가 둘이면 나중 것으로 보이며, 로그북과 이력에는 도착한 대로 각 읽기가 남습니다.

## 알람 엔티티

모든 알람 정의는 엔티티입니다. `alarm.<definition id>`(태그와 같은 방식으로 슬러그화되므로 `oven-temp-hi`는 `alarm.oven_temp_hi`), 플랫폼 `alarm`, `unique_id` `alarm:<definition id>`이며 정의의 이름을 따릅니다. 바인딩도 장치도 없습니다. 상태는 태그가 아니라 알람 엔진의 것이며, 정의는 태그처럼 장치에 속하지 않습니다(장치를 삭제해도 알람 정의는 남음). 감시하는 태그는 `source` 속성입니다.

상태는 알람 엔진이 가진 ISA-18.2 상태이며, 엔티티 상태의 표기 방식으로 쓰입니다.

| 알람 엔진 | 엔티티 상태 | <span class="sr-only">상세</span> |
|---|---|---|
| `normal` | `normal` | 조건 해소, 남은 것 없음 |
| `unack-active` | `active_unack` | 조건 참, 아무도 확인하지 않음 |
| `ack-active` | `active_ack` | 조건 참, 확인됨 |
| `rtn-unack` | `rtn_unack` | 아무도 확인하기 전에 해소됨 |
| `shelved` | `shelved` | 운전원이 정해진 시간 동안 소음 처리 |
| `suppressed` | `suppressed` | 설계상 소음 처리 |

품질은 `good`입니다. 엔진의 상태는 읽기가 아닙니다. 엔티티가 고아 상태이거나 Gateway에 알람 엔진이 없으면 `unavailable`입니다. 확인을 포함해 모든 전이를 일어나는 대로 따라갑니다.

속성: `definition_id`, `source`, `condition`, `limit`, `priority`(1에서 4), `priority_label`, `enabled`, `message`, `count`, `active`, `needs_ack`, `trip_value`, `raised_at`, `cleared_at`, `acked_at`, `acked_by`, `shelved_until`, `shelved_by`. 마지막 것들은 해당할 때만 있습니다.

서비스 `acknowledge`, `shelve`, `unshelve`는 태그를 쓰지 않으므로 쓰기 게이트를 거치지 않습니다. 알람 화면과 `POST /api/alarms/{id}/ack`가 호출하는 것과 같은 알람 엔진의 `Ack`, `Shelve`, `Unshelve`를 호출하므로, 그것들과 똑같이 알람 기록(`alarm_events`)과 시스템 로그에 남습니다. `values.write`가 아니라 **`alarms.ack`**가 필요합니다. 알람을 확인하는 것은 운전원이고 조회자가 아닙니다. 거부된 호출은 403으로 응답하고 시도한 사람과 함께 엔티티 아래에 기록됩니다. 호출은 이유와 함께 엔티티 아래 시스템 로그에도 한 줄로 남습니다.

`unshelve`는 보류되지 않은 알람에 대해서는 거부(409)됩니다. 알람 엔진도 거부하며, 보류된 알람을 무작정 normal로 돌리지 않고 조건이 실제로 있는 상태로 되돌립니다. 알람이 받지 않는 서비스(`turn_on`)는 엔진에 닿기 전에 알 수 없는 서비스(400)로 거부됩니다.

### 공급자가 있는 플랫폼

알람 엔티티는 첫 번째 **공급자** 플랫폼입니다. 진실의 원천이 태그가 아닌 다른 곳에 있는 엔티티입니다. 공급자는 자신의 플랫폼에 지금 어떤 엔티티가 있는지 알려 주고, 그 상태를 만들고, 서비스를 실행하고, 드라이런에 답합니다. 레지스트리는 태그의 엔티티와 똑같이 `unique_id`로 이들을 도출하고, 고아로 만들고, 다시 이어받습니다. 상태 엔진은 공급자 자신의 이벤트와 초당 한 번의 틱에서 이들을 다시 계산하고, 이들에 대한 서비스 호출은 태그 쓰기로 계획되지 않고 공급자에게 갑니다. 태그를 쓰는 공급자도 게이트를 거쳐 씁니다.

헬퍼는 두 번째입니다. `input_boolean`, `input_number`, `input_select`, `input_text`, `input_counter`, `timer`, `schedule`이며, PLC가 아니라 공장 사람들이 소유하는 값으로 HotLoop이 보관하고 `helpers.write`로 설정합니다. 태그는 쓰지 않습니다. [헬퍼](/ko/iot/helpers/)를 참고하십시오.

스크립트는 세 번째입니다. 모든 스크립트는 `script` 엔티티 `script.<id>`이며, 어느 프로세스에서든 실행이 진행 중이면 켜짐이고 없으면 꺼짐입니다. `turn_on`은 서비스 데이터를 필드로 삼아 실행하고, `turn_off`는 중지하며, 둘 다 `scripts.run`이 필요합니다. 스크립트를 삭제하면 알람 정의를 삭제할 때처럼 그 엔티티가 고아 상태가 됩니다. [스크립트](/ko/iot/scripts/)를 참고하십시오.

레시피는 네 번째입니다. 모든 레시피는 `scene` 엔티티 `scene.<id>`이며, 상태는 공장에 마지막으로 쓴 시각이고 속성은 가장 최근 적용이 어떻게 끝났는지 알려 줍니다. `turn_on`은 `recipes.apply`와, 레시피가 지정하면 그 자체의 권한으로 레시피를 적용합니다. 레시피를 삭제하면 그 엔티티는 고아 상태가 됩니다. [레시피](/ko/iot/recipes/)를 참고하십시오.

태양은 다섯 번째입니다. `binary_sensor.sun_up`, `sensor.sun_elevation`, `sensor.sun_azimuth`이며, 현장의 위도와 경도로 장비 안에서 매초 계산됩니다. 읽기만 하며 서비스는 받지 않습니다. 위치가 없는 현장에는 없고, 위치가 있던 때부터 남은 것은 unavailable로 읽히며 어떤 변수를 설정해야 하는지 알려 줍니다. [태양](/ko/iot/sun/)을 참고하십시오.

## 다른 모든 곳의 엔티티

### 라이브 피드

`GET /api/stream`은 `values` 옆에 `entities` 이벤트를 싣습니다. 같은 방식으로 병합되며, 초당 최대 네 번, 엔티티별 최신 상태입니다.

```
event: entities
data: {"changed":[{"entity_id":"sensor.press_01_zone1_temp","state":"212.5",...}],"removed":[]}
```

`changed`는 마지막 이벤트 이후 바뀐 모든 엔티티의 전체 상태이며 `GET /api/states/{entity_id}`와 같은 형태입니다. `removed`는 더는 상태가 전혀 없는 entity_id입니다. 사용 안 함, 장치와 함께 삭제됨, 또는 이름이 바뀌어 떠난 것입니다(새 이름은 `changed`로 옴). 새 연결의 첫 `entities` 이벤트는 `snapshot`이 모든 읽기를 싣는 것처럼 모든 상태를 싣습니다. 그래서 화면은 무언가 바뀌기 전에 채워집니다. `values`, `snapshot`, `alarm`, `device` 이벤트는 전과 똑같습니다.

### MCP

에이전트는 `list_entities`, `get_states`, `call_service`를 얻습니다. `call_service`는 `POST /api/services/...`와 같은 서비스 러너를 거치므로, 에이전트의 호출은 `write_tag`처럼 MCP 스위치로 제어되고 출처 `mcp`로 엔티티에 대해 감사됩니다. [MCP](/ko/iot/mcp/#엔티티)를 참고하십시오.

### 자동화

`state` 트리거는 엔티티의 상태가 바뀔 때 규칙을 실행하고, 조건은 `states`, `attrs`, 엔티티 `qualities`를 읽을 수 있으며, `call_service` 액션은 게이트를 거쳐 `automation:<rule-id>`로 감사되면서 엔티티에 명령합니다. [자동화](/ko/iot/automations/#상태-트리거는-엔티티를-따릅니다)를 참고하십시오.

둘 다 엔진의 `OnStateChanged` 훅을 따르며, [엔진이 동작하는 방식](#엔진이-동작하는-방식)의 규칙이 중요한 이유입니다. state 트리거는 엔진이 계산한 모든 변화를 한 번, 순서대로 보고, 엔진이 보지 못한 것은 보지 않습니다.

## 화면

**엔티티**는 설비 트리에서의 위치(자신의 위치, 없으면 장치의 위치) 아래에 모든 엔티티를 나열하고, 옆에 트리가 있으며, 위치, 도메인, 레이블, 텍스트, 품질로 필터링합니다. 한 위치 안에서는 설비가 먼저(알람, 모터, 밸브, 루프, select, 버튼, 카운터), 그다음 명령할 수 있는 것, 그다음 원시 읽기 순입니다.

기본적으로 화면은 각 신호를 한 번만 보여 줍니다. 엔티티 모델은 한 지점에 일부러 엔티티 여러 개를 줍니다. 모두 자신의 ID를 유지하지만, 타일로 그리면 같은 신호가 두세 번 나옵니다. 활성화된 태그는 센서이자 스위치이고, 모터에 바인딩된 태그도 여전히 자신의 센서입니다. 실제 라인에서는 타일이 거의 두 배가 되어 설비가 묻혔습니다. 그래서 화면은 합칩니다.

- 태그의 읽기 엔티티는 제어 엔티티 뒤에 있습니다. 스위치나 숫자가 타일이며, 이미 실시간 상태를 보여 주기 때문입니다. 그 서랍에는 자동화나 에이전트를 연결하는 사람을 위해 센서의 entity_id와 함께 "also available as"가 나옵니다.
- 복합 엔티티에 바인딩된 태그는 복합 엔티티 안에, 두 엔티티 모두 들어갑니다. 복합 엔티티의 서랍에는 신호가 나열됩니다. 역할, 태그, 지금 읽은 값, 읽기와 제어 entity_id입니다. 복합 엔티티 둘에 있는 태그는 이름순으로 첫 번째에 들어갑니다.
- 숨김도 사용 안 함도 아닌 제어 엔티티나 복합 엔티티만 다른 것을 받아들입니다. 스위치를 숨기거나 사용 안 함으로 바꾸면 그 센서가 타일을 되찾습니다.
- 합쳐진 신호의 알람은 그것이 들어간 타일에 알람 이름과 함께 표시되고, 거기서 알람을 엽니다. 합치기는 화면을 정리할 뿐 알람을 숨기는 일은 없습니다.
- 품질 막대 옆의 개수는 "13개 표시됨 · 25개 합쳐짐"이라고 말하고, 다른 것을 담은 타일은 아래쪽에 그렇게 말합니다("신호 5개", "+ 센서"). 도메인 칩, 트리 개수, 품질 막대는 표시된 타일을 셉니다.
- 검색과 레이블 필터는 타일 안까지 봅니다. 합쳐진 entity_id나 태그를 검색하면 그것을 담은 타일이 윤곽선과 함께 "여기서 찾은 항목:"과 entity_id를 달고 나타납니다. 화면 전체를 모든 엔티티로 바꾸는 대신 이 방식을 택했습니다. 벽 같은 타일이 아니라 찾던 펌프에 도착합니다.

"모든 엔티티 표시"는 합치기를 끄고 모든 엔티티에 자신의 타일을 줍니다. 원시 레지스트리를 원하는 엔지니어를 위한 것입니다. 기본은 꺼짐이며 이 브라우저가 기억합니다(로컬 저장소이며 시크릿 창은 잊음). 다른 사람의 화면은 바뀌지 않습니다.

상태는 라이브 피드의 `entities` 이벤트로 도착하며, 화면이 폴링하는 일은 없습니다. 타일은 상태가 바뀌면 다시 그려지고, 그 안의 버튼에 포커스가 있어도 다시 그려집니다. 그런 이유로 낡은 상태를 유지하는 타일은 과거를 현재로 보여 주기 때문입니다. 품질은 값보다 먼저 그려집니다.

| 품질 | 화면 표시 |
|---|---|
| 양호 | 값, 표시 없음 |
| 불확실 | 값, 주황색 가장자리와 "불확실" 배지 |
| 불량 | 마지막 정상 값이 빗금 위에 회색으로, "불량", "마지막 정상 값, 읽기 불량", 드라이버가 알려 줬다면 그 뒤에 이유 |
| 아직 읽은 값 없음 | 기울임꼴 "알 수 없음", 이유가 있으면 이유와 함께 "읽기 불량" |
| 사용 불가 | "사용 불가", 타일 전체에 빗금 |

컨트롤은 도메인과 역할을 따릅니다. 조회자에게는 보이지 않습니다. 운전원은 `values.write` 뒤에 있는 것(알람은 `alarms.ack` 뒤)을 보며, 이 배포에서 쓰기가 꺼져 있거나 엔티티가 쓰는 태그가 활성화되어 있지 않으면 이유와 함께 비활성화됩니다. 루프의 출력은 수동으로 읽힐 때만 제공됩니다. 게이트가 허용하는 때가 그때뿐이기 때문입니다. 모든 명령은 어느 서비스인지, 어느 태그인지, 엔티티가 지금 무엇을 읽는지 알려 주는 프롬프트를 열고, 감사 기록에 남을 이유를 받습니다. 거부되면 프롬프트가 열린 채로 게이트의 말과 나갔거나 나가지 않은 모든 쓰기를 보여 줍니다. 새 상태는 명령으로부터 가정하지 않습니다. 장치가 다시 읽을 때 피드로 돌아오거나, 돌아오지 않습니다.

서랍에는 상태와 타임스탬프, 컨트롤, 바인딩된 태그의 1시간, 6시간 또는 하루 이력(계단형 추세선, 마지막 값을 지금까지 이어 그림, 불량 읽기 표시), 같은 신호의 다른 엔티티, 바인딩(복합 엔티티는 신호), 속성, 이 엔티티를 통해 내려지거나 거부된 모든 명령이 있습니다. 관리자는 entity_id, 이름, 트리에서의 위치, 레이블, 숨김과 사용 안 함, 복합 엔티티나 고아 엔티티의 삭제도 얻습니다.

**새 설비**(관리자)는 복합 엔티티를 만듭니다. 도메인을 고르고, 이름을 붙이고, 각 역할에 태그를 고릅니다. 각 역할에는 유형이 맞는 태그만 제공되며, 명령 역할은 활성화되지 않은 태그를 숨기지 않고 비활성으로 보여 줍니다. 필수 항목은 표시되지만 양식이 강제하지는 않습니다. 결정은 레지스트리가 하며, 레지스트리의 거부는 쓴 그대로 표시됩니다.

**공장**은 설비 트리와 레이블입니다. [설비 트리와 레이블](/ko/iot/equipment/)을 참고하십시오.

## 백업과 복원

`entities`와 `entity_bindings`는 entity_id와 사용자 설정을 포함해 백업에 들어 있습니다. 복합 엔티티, 모든 역할, 모든 옵션도 포함되며, 이는 다른 어떤 것보다 복합 엔티티에 더 중요합니다. 태그의 엔티티는 태그로 다시 만들 수 있지만 복합 엔티티는 백업 말고는 무엇으로도 다시 만들 수 없습니다. 알람 엔티티는 정의와 함께 돌아오고, 엔티티가 없는 복원된 정의는 첫 동기화에서 엔티티를 얻습니다. 이 버전 이전에 만든 백업에는 두 테이블이 모두 없습니다. 복원하고 Gateway를 시작하면 레지스트리의 첫 동기화가 복원된 모든 태그에 엔티티를 줍니다. `entity_labels`도 백업에 들어 있으며, 설비 트리 이전의 백업을 복원하는 방법은 [설비 트리와 레이블](/ko/iot/equipment/)에 있습니다.

마이그레이션 0007은 `write_audit`에 열 세 개를 추가합니다. 그 이전에 만든 백업도 복원됩니다. 복원은 오늘의 테이블보다 열이 적은 파일을 앞쪽 열에 불러오고 새 열은 기본값을 받게 하며, 열을 추가하는 마이그레이션은 항상 끝에 추가하기 때문입니다. 더 새로운 버전의 백업은 여전히 거부됩니다. [백업과 복원](/ko/iot/backup/)을 참고하십시오.

## 아직 없는 것

핵심, 설비 트리, 쓰기 게이트를 거친 엔티티 명령, 복합 설비, 알람 엔티티, MCP의 엔티티, 자동화, 라이브 피드, 화면이 모두 갖춰져 있습니다. [HotLoop 로드맵](/ko/roadmap/)을 참고하십시오. 상태 트리거의 `forSec`("5분 동안 켜짐")은 [자동화](/ko/iot/automations/#상태-유지-forsec)에 있습니다.
