---
title: "OPC UA 서버"
description: "설정한 장치와 태그를 읽기 전용 OPC UA 주소 공간으로 게시합니다. 이미 쓰고 있는 SCADA가 새 드라이버 없이 모든 태그를 봅니다."
---

:::note[앞으로 나올 내용 포함]
이 페이지에는 최신 릴리스인 HotLoop core 4.24.0보다 새로운 내용도 일부 들어 있습니다. 설치하신 버전에는 없는 부분이 있을 수 있습니다. 무엇이 바뀌었는지는 [릴리스 노트](/ko/releases/)에 나와 있습니다.
:::

HotLoop의 OPC UA 서버는 4.13.0부터 Gateway에 설정된 장치와 태그를 OPC UA 주소 공간으로 게시합니다. 그래서 타사 OPC UA 클라이언트, SCADA 패키지, HMI, 히스토리안, UaExpert 같은 테스트 도구가 상대편을 위한 HotLoop 드라이버를 따로 만들 필요 없이 Gateway의 실시간 태그를 읽을 수 있습니다.

기본값은 켜짐입니다(`HOTLOOP_OPCUA_SERVER_ENABLED`). 바이너리와 Helm 차트 모두 그렇습니다. HotLoop 인증이 켜진 상태로 시작하며 전용 로그인 `opcua-reader`를 갖습니다. HotLoop는 생성된 비밀번호로 이 로그인을 만들고, 설정 화면이 관리자에게 그 비밀번호를 보여 줍니다(`GET /api/opcua/server`). 이 로그인은 태그와 값을 읽을 수 있을 뿐 그 밖의 일은 하지 못합니다. HotLoop 인증이 꺼져 있으면 로그인할 사용자가 없으므로 서버는 대기하며 그 사실을 알립니다(시작을 거부하지는 않습니다). 장비의 다른 OPC UA 서버가 이미 4840을 쓰고 있으면 대기하며 알리고, 직접 고른 포트를 열 수 없으면 오류입니다. 공장 네트워크에서 리스너를 여는 일은 배포가 의도해서 하는 일이기 때문입니다. 기본 포트는 4840입니다.

**읽기 전용입니다.** [읽기 전용인 이유](#읽기-전용인-이유)를 참조하세요. 모든 태그의 이력도 제공합니다. [이력](#이력)을 참조하세요.

## 공개되는 내용

사용하도록 설정한 장치마다 표준 *Objects* 폴더 바로 아래에 **Object** 노드 하나, 사용하도록 설정한 태그마다 해당 장치 아래에 **Variable** 노드 하나가 만들어집니다. 꺼져 있는 장치와 태그는 게시되지 않습니다. 워커도 읽은 값도 없어서 게시하면 클라이언트 앞에 영구적으로 Bad인 노드만 놓이게 되기 때문입니다. 주소 공간은 런타임이 폴링하는 내용과 정확히 일치합니다.

모든 것은 하나의 네임스페이스 `urn:hotloop:ua:gateway`에 들어 있습니다. 네임스페이스 URI는 상수이며 호스트 이름이나 애플리케이션 URI에서 만들어지지 않습니다. 클라이언트는 노드를 URI와 식별자의 조합으로 저장하고 연결할 때마다 네임스페이스 인덱스를 다시 찾는데, 파드 이름에 따라 바뀌는 URI라면 SCADA 프로젝트에 설정된 모든 구독이 고아가 되기 때문입니다. 실제 클라이언트처럼 서버의 네임스페이스 배열에서 URI로 인덱스를 찾으세요. `ns=2`라고 가정하지 마세요.

### NodeIds

식별자는 문자열이며 안정적입니다.

| 노드 | NodeId 식별자 |
|---|---|
| 장치 | `<deviceId>` |
| 태그 | `<deviceId>/<tagName>` |
| 태그의 `EngineeringUnits` / `EURange` 속성 | `~EngineeringUnits/<deviceId>/<tagName>` 및 `~EURange/…` |

태그 형식은 `model.TagKey.String()`이며, 나머지 코드가 이미 쓰는 `device/tag` 표기입니다. 그래서 NodeId와 태그 키는 `model.ParseTagKey`로 서로 변환됩니다. `.` 구분자는 통하지 않았을 것입니다. 장치 ID에 점이 들어갈 수 있어서 `a.b.c`가 장치 `a`의 태그 `b.c`일 수도, 장치 `a.b`의 태그 `c`일 수도 있기 때문입니다. 장치 ID에는 슬래시를 넣을 수 없으므로 첫 번째 슬래시가 항상 경계이고, 슬래시가 들어 있는 태그 이름(OPC UA 탐색 경로와 MQTT 토픽에는 있습니다)도 올바른 장치로 해석됩니다. 속성 ID는 장치 ID가 쓸 수 없는 `~`로 시작하므로, 태그 이름이 무엇이든 속성이 태그와 충돌하는 일은 없습니다.

### 속성

| 속성 | 값 |
|---|---|
| `BrowseName` | 장치 ID / 태그 이름, HotLoop 네임스페이스 안에서 |
| `DisplayName` | 장치 이름 / 태그 이름 |
| `Description` | 장치 또는 태그의 설명 |
| `DataType` | 아래 참조 |
| `ValueRank` | 스칼라(-1) |
| `AccessLevel`, `UserAccessLevel` | `CurrentRead`만(0x01) |
| `MinimumSamplingInterval` | 장치의 실제 폴링 간격(ms). 값은 런타임이 폴링하는 속도보다 빨리 바뀔 수 없으므로, 더 빠른 샘플링 속도를 요청한 클라이언트는 이 간격으로 올려서 적용됩니다 |
| `Historizing` | false |

단위가 있는 태그에는 `EngineeringUnits` 속성(`EUInformation`, 단위 ID -1 = "UNECE 코드 아님", 단위 텍스트는 `DisplayName`에)이 붙고, 범위가 있는 태그에는 `EURange` 속성이 붙습니다. 둘 다 없는 태그에는 어느 쪽도 없습니다.

### 데이터 형식

런타임은 모든 숫자 읽기 값을 공학 단위의 float64로 줄이므로, 선언되는 형식은 `kindForTag`에서 정하는 표시상의 선택이며, 값을 항상 표현할 수 있는 형식이어야 합니다.

| 태그 `dataType` | OPC UA 형식 |
|---|---|
| `bool`, `boolean`, `bit`, `coil`, `discrete` | Boolean |
| `string`, `text`, `char` | String |
| `int16` | Int16 |
| `uint16`, `word` | UInt16 |
| `int32`, `dint` | Int32 |
| `uint32`, `dword` | UInt32 |
| `uint64` | UInt64 |
| `int`, `int64` | Int64(가장 넓은 부호 있는 형식이라 넘치지 않습니다) |
| 그 밖의 모든 형식, `float` 포함 | Double |
| **스케일이나 오프셋이 있는 모든 정수 형식** | **Double** |

마지막 행이 중요합니다. 0.1 스케일의 `int16` 레지스터는 23.4를 읽는데, 이를 Int16으로 잘라 버리면 클라이언트는 Good 상태의 23을 받게 됩니다. 선언된 형식에 맞지 않는 값, 예를 들어 70000을 전달하는 `int16` 태그는 값 없이 `BadOutOfRange`로 보고되며, 그럴듯해 보이는 값으로 감기거나 잘려서 나가는 일은 없습니다. 읽은 값에 텍스트가 들어 있는 숫자 태그는 `BadTypeMismatch`입니다.

### 값, 품질, 타임스탬프

모든 읽기(그리고 모든 구독 샘플)는 런타임의 실시간 캐시에서 응답하며, `/api/values`가 제공하는 것과 같은 출처이고 데이터베이스에서 읽지 않습니다. 상태 코드는 그 읽기 값**과 그 뒤에 있는 장치 링크의 상태**로 정해집니다. 캐시만으로는 충분하지 않기 때문입니다. 캐시는 장치가 마지막으로 돌려준 읽기 값을 그대로 가지고 있으므로, 그 뒤 네트워크에서 사라진 장치도 겉보기에 멀쩡한 마지막 읽기 값을 계속 가지고 있습니다.

| 장치 링크 | 읽기 값 | 상태 | 값 |
|---|---|---|---|
| 연결됨, 이번 세션에서 폴링이 한 번 이상 전달됨 | 양호 | **Good** | 전송됨 |
| | 불확실 | Uncertain | 전송됨 |
| | 불량 또는 인식할 수 없는 품질 | Bad | 없음 |
| 연결됨, 이번 세션에서 아직 폴링이 전달되지 않음 | 모두 | BadWaitingForInitialData | 없음 |
| 연결됨, 캐시에 아무것도 없음 | n/a | BadWaitingForInitialData | 없음 |
| 성능 저하(세션은 살아 있고 폴링이 실패하거나 일부만 성공) | 양호 | **UncertainLastUsableValue** | 전송됨 |
| | 불확실 | Uncertain | 전송됨 |
| | 불량 | Bad | 없음 |
| 연결 끊김, 연결 중, 사용 안 함 | 모두 | **BadNoCommunication** | 없음 |
| 장치에 워커가 없음 | 모두 | BadOutOfService | 없음 |
| 태그 또는 장치가 제거됨 | n/a | BadNodeIdUnknown | 없음 |

Good은 연결된 장치에서, 현재 세션의 폴링으로, 읽기 값이 양호할 때만 보고됩니다. 연결이 끊긴 장치의 태그는 마지막 값에 Good 상태를 붙이지 않고 Bad로 읽힙니다.

경과 시간은 일부러 포함하지 않습니다. 이벤트 기반 소스(MQTT/Sparkplug 태그, OPC UA 구독)는 아무것도 바뀌지 않았기 때문에 몇 시간씩 같은 값을 갖는 것이 정상이며, 시계만 보고 오래됐다고 판단하면 틀립니다. 장치가 아직 데이터를 보내고 있는지는 링크가 판단할 일입니다.

**소스 타임스탬프**는 읽기 값 자체의 타임스탬프이자 장치에서 마지막으로 소식이 온 시각이며, Bad 상태에서도 보고됩니다. **서버 타임스탬프**는 읽기에 응답한 시각입니다. 둘 다 UTC입니다.

## 구독

클라이언트는 태그 변수에 구독과 모니터링 항목을 만들고 데이터 변경 알림을 받을 수 있으며, SCADA 클라이언트가 실제로 태그를 가져가는 방식이 이것입니다. 이 라이브러리의 모니터링은 샘플링 방식입니다. 서버가 모니터링 항목마다 샘플링 간격(최소 100 ms, 그리고 최소한 장치의 폴링 간격)으로 읽기와 같은 핸들러를 통해 읽고, 값이나 상태가 바뀌면 알립니다. 그래서 *품질*의 변화, 즉 장치가 끊기는 일도 값이 바뀌는 것과 같은 방식으로 알려집니다.

제거된 태그의 모니터링 항목은 매달려 남지 않고 `BadNodeIdUnknown`을 받습니다.

## 구성이 바뀌는 동안 클라이언트에게 보이는 것

태그가 제거되면 그 태그에 대한 읽기와 모니터링 항목은 즉시 `BadNodeIdUnknown`을 받고, 장치 탐색에서도 즉시 사라집니다. 노드 자체는 그 뒤 약 5초 동안 서버의 노드 테이블에 접근할 수 없는 상태로 남았다가 삭제됩니다. 제거된 장치도 Objects 폴더 아래에서 같은 방식으로 동작합니다.

편집은 빈틈을 남기지 않습니다. 편집된 태그나 장치는 같은 NodeId 아래에서 한 번에 새 버전으로 교체되므로, 그 순간의 읽기나 탐색은 이전 버전 또는 새 버전을 보게 되고 "알 수 없음"은 절대 보지 않습니다. 그 위의 구독도 계속됩니다.

삭제 전의 지연은 장식이 아닙니다. 라이브러리의 Browse는 노드의 참조 목록을 읽고 두 단계 사이에 잠금을 잡지 않은 채 각 대상을 조회하는데, 그 사이에 대상 하나가 사라지면 장치나 Objects 폴더가 없는 것처럼 *부모* 탐색이 `BadNodeIdUnknown`으로 실패합니다. 예전에는 노드를 바로 삭제했고, 태그가 제거되는 동안 장치를 탐색하거나 장치가 편집되는 동안 태그를 읽던 클라이언트가 실제로 있는 노드가 없다는 응답을 받을 수 있었습니다.

## 읽기 전용인 이유

이번 증분은 쓰기를 구현하지 않으며, 어떤 단일 변경도 조용히 쓰기를 추가할 수 없도록 세 곳에서 동시에 그렇게 밝힙니다.

- 게시된 모든 노드의 `AccessLevel = CurrentRead | HistoryRead`이고 쓰기 핸들러는 설치되어 있지 않으므로, 쓰기는 `BadNotWritable`로 거부되며 클라이언트는 시도하기 전에 노드에 쓸 수 없음을 알 수 있습니다.
- 테스트는 viewer, operator, admin으로 태그에 쓰기를 시도하고, 응답이 `BadNotWritable`**이며 태그 뒤 장치의 레지스터가 바뀌지 않았음**을 확인합니다.

OPC UA 쓰기 경로라면 그 게이트를 거치고, 주체를 감사 추적에 남기고, 마스터 스위치를 따라야 합니다. 이는 태그를 게시하는 일의 부산물로 생기는 것이 아니라 자체 검토를 거쳐야 하는 변경이며, 이 버전에는 이를 켜는 설정이 의도적으로 없습니다.

## 이력

모든 태그 노드는 이력화되며 HistoryRead 접근 수준을 가집니다. 서버는 OPC UA HistoryRead 서비스에 HotLoop 자체의 이력, 즉 `/api/history`가 제공하는 것과 같은 읽기 값으로 응답하므로, OPC UA 연결 반대편의 클라이언트는 두 번째 데이터베이스 없이 Gateway가 보관한 내용을 읽습니다. 사용자에게는 값 읽기와 같은 권한(`tags.read`와 `values.read`)이 필요하며, 값 읽기와 같은 방식으로, 로그인할 때 한 번이 아니라 세션의 사용자에 대해 확인됩니다.

- **Raw**(`ReadRawModifiedDetails`): 구간 안의 읽기 값으로, 각각 고유한 품질을 상태로, 고유한 타임스탬프를 가집니다. 시작이 끝보다 앞이면 정방향으로, 뒤이면 역방향으로 최신 값부터 읽습니다. 시작은 포함하고 끝은 제외하며(OPC UA 10000-11, 4.6절), 클라이언트가 경계를 요청하면 시작 시점 또는 그 직전의 읽기 값과 끝에서 구간 밖의 첫 읽기 값이 추가됩니다. `NumValuesPerNode`는 한 번의 호출이 노드 하나에 대해 돌려주는 개수이며, 그보다 많거나 10,000개를 넘으면 페이지로 나뉘어 오고 각 페이지에는 5분 동안 한 번만 쓸 수 있는 연속 지점이 붙습니다(동시에 최대 1,000개 유지). 아무것도 없는 구간은 `Good_NoData`입니다. 수정된 이력은 거부됩니다(`BadHistoryOperationUnsupported`). 여기서는 어떤 것도 수정되거나 삭제되지 않습니다.
- **Processed**(`ReadProcessedDetails`): 시작 시각부터 `ProcessingInterval` 간격으로 Average, Minimum, Maximum, Count, Start, End, Total을 계산하며, 품질 규칙(README, "The quality rule")에 따라 유한한 숫자를 가진 양호한 읽기 값만 셉니다. 읽기 값이 하나도 없는 간격은 `Good_NoData`(Count는 0)이고, 일부 읽기 값이 빠진 간격은 `Uncertain_DataSubNormal`로 읽혀서 숫자가 그 안에 있던 내용보다 좋게 보이는 일은 없습니다. 다른 집계는 그 노드에 대해 거부되고(`BadAggregateNotSupported`), 문자열 태그에는 집계가 없으며, 10,000개를 넘는 간격이나 500,000개를 넘는 읽기 값의 구간은 잘라내지 않고 거부됩니다(`BadTooManyOperations`). 양 끝이 있는 정방향 구간에만 응답합니다.
- **At time**(`ReadAtTimeDetails`): 각 시각에 태그가 가지고 있던 값, 즉 그 시각 또는 그 이전의 마지막 읽기 값에 요청한 시각을 타임스탬프로 붙여 돌려줍니다. 읽기 값은 누군가 실제로 측정한 값이므로 보간하지 않으며, 태그의 첫 읽기 값보다 앞선 시각은 `Bad_NoData`입니다.
- **이벤트**는 제공되지 않으며 `BadHistoryOperationUnsupported`입니다. 장치나 그 밖의 객체에도 이력이 없고, 속성 노드(`EngineeringUnits`, `EURange`)에는 HistoryRead가 없습니다.

히스토리안은 폴링마다가 아니라 읽기 값이 데드밴드를 벗어날 때 저장하므로 조용한 태그는 행이 적습니다. 값이 언제 바뀌었는지만이 아니라 그 시점에 무엇을 가졌는지가 필요하면 At time이나 태그의 마지막 읽기 값 주변의 Processed 구간으로 읽으세요. `HistoryServerCapabilities`는 이력을 읽을 수 있고 한 번의 호출이 최대 10,000개의 값을 돌려준다고 알려줍니다.

## EmberNet 대시보드를 위한 장비 상태

대시보드의 작업 관리자는 장비의 CPU, 메모리, 디스크, 실시간 지터를 장비 자체에서 읽습니다. HotLoop이 이를 장치로 게시하고 서버가 그 이력([이력](#이력))을 제공하므로, 대시보드는 이를 위해 자체 데이터베이스를 읽지 않습니다. 무엇이 구현되어 있고 어떻게 켜는지는 다음과 같습니다.

* **장치.** `HOTLOOP_BOX_HEALTH_NODE`를 설정하면(차트가 Kubernetes 노드 이름으로 설정합니다) HotLoop이 정확히 그 이름을 ID로 가진 장치를 `boxhealth` 프로토콜([프로토콜과 드라이버](/ko/iot/protocols/#박스-상태))로 만듭니다. 태그는 `cpu_util_pct`, `mem_util_pct`, `disk_util_pct`(장비 자체의 디스크), `data_util_pct`(HotLoop이 데이터를 두는 볼륨)이며, `HOTLOOP_BOX_HEALTH_JITTER_FILE`이 실시간 에이전트가 쓰는 JSON 파일을 가리킬 때만 `rtos_jitter_core1_us`, `rtos_jitter_core2_us`, `rtos_jitter_core3_us`가 추가됩니다. 이들의 OPC UA 노드 ID는 네임스페이스 `urn:hotloop:ua:gateway`에서 문자열 식별자 `<device id>/<tag>`를 가집니다.
* **장비의 수치.** 차트는 호스트의 루트를 `/host`에, 호스트의 `/proc`를 `/host/proc`에 둘 다 읽기 전용으로 마운트하고 노드 이름을 **기본으로** 설정합니다(`opcuaServer.dashboard.boxHealth.enabled: true`). 그래서 HotLoop을 설치하는 즉시 대시보드의 작업 관리자가 동작합니다. `/host`의 statfs와 CPU, 메모리 카운터만 읽고 추가 권한은 주지 않습니다. 제한된 Pod Security 프로필을 적용하는 클러스터는 hostPath를 거부합니다. 그런 곳에서는 `enabled: false`(장치도 마운트도 없음) 또는 `hostMount: false`(장치는 있지만 장비의 디스크와 CPU가 Bad로 읽히고 무엇을 마운트해야 하는지 알려 줌)로 설정하세요. 이 장치에는 OPC UA 서버가 필요하지 않습니다.
* **읽기만 되는 로그인.** 차트는 첫 설치 때 정확히 `tags.read`와 `values.read`(역할이 아니라 명시적 권한 목록)를 가진 사용자 `embernet-dashboard-read`를 만들고, 생성된 비밀번호를 Secret `<release>-opcua-dashboard`(키 `username`, `password`, `password-hash`)에 보관합니다. 업그레이드해도 비밀번호는 바뀌지 않습니다. 이미 있는 계정은 재시작으로 바뀌지 않습니다.
* **대시보드의 인증서.** 대시보드는 인증서마다 키 하나, 이름은 `<sha1 thumbprint>.crt`인 Secret `<release>-opcua-trust`를 만듭니다. 차트는 이를 선택 사항으로 `/etc/hotloop/opcua-trust`에 마운트하고, 서버는 그 파일들을 `trusted/`(`HOTLOOP_OPCUA_SERVER_TRUST_DIR`)에 유지합니다. 시작할 때와 30초마다 새 파일은 추가하고, 바뀐 파일은 다시 쓰고, Secret에서 빠진 파일은 다시 제거합니다. 운영자가 `trusted/`에 직접 넣은 파일은 건드리지 않으며, 같은 이름의 Secret 키보다 우선합니다.
* **포트.** 릴리스 자체의 Service(대시보드가 찾는 것)는 서버가 켜져 있으면 OPC UA 서버 자체의 Service와 함께 OPC UA 포트 4840을 나열합니다.

서버는 이전과 같습니다. Basic256Sha256 SignAndEncrypt를 쓰고, 익명 세션이 없으며, 모든 것을 신뢰하는 설정도 없습니다.

## 보안 모델

### 전송

보안 채널은 라이브러리의 정책을 Sign과 SignAndEncrypt로 사용합니다. **`Basic256Sha256`은 두 모드 모두에서 제공되며**, 클라이언트가 선택해야 하는 것이 이것입니다.

**SecurityPolicy None은 명시적으로 켜야 합니다**(`HOTLOOP_OPCUA_SERVER_ALLOW_INSECURE`, 기본값 false). 켜면 시작할 때 경고가 나옵니다. 꺼져 있으면 None 엔드포인트가 알려지지 않으며, 그래도 None 채널을 여는 클라이언트는 검색만 할 수 있고 그 밖의 모든 서비스는 거부됩니다. 켜 두더라도 사용자 이름과 비밀번호는 암호화된 토큰 안에서 전달됩니다(토큰 정책은 `Basic256Sha256`이며 None이 아닙니다). 다만 그 뒤 클라이언트가 읽는 모든 값은 보호되지 않습니다.

**더 이상 권장되지 않는 정책은 기본적으로 꺼져 있습니다.** OPC Foundation은 `Basic128Rsa15`(PKCS#1 v1.5 패딩의 RSA)와 `Basic256`(SHA-1)을 더 이상 권장하지 않습니다. 이전 릴리스에서는 두 정책이 모든 엔드포인트 목록에 제공되었고 제거할 방법이 없었습니다. `HOTLOOP_OPCUA_SERVER_ALLOW_DEPRECATED_POLICIES`(차트: `opcuaServer.allowDeprecatedPolicies`, 기본값 `false`)가 이를 결정합니다.

- **꺼짐(기본값, 새 설치와 업그레이드 모두).** 두 정책 중 어느 것도 클라이언트에 알려지는 엔드포인트에 없고, 그중 하나로 보안 채널을 여는 클라이언트는 어떤 세션이나 로그인보다 먼저 채널을 열 때 거부됩니다. `Basic256Sha256`, `Aes128_Sha256_RsaOaep`, `Aes256_Sha256_RsaPss`를 쓰는 클라이언트는 영향을 받지 않습니다.
- **켜짐.** 더 새로운 정책을 지원하지 못하는 오래된 클라이언트를 위해 두 정책이 Sign과 SignAndEncrypt로 다시 제공되며, 시작할 때 경고가 나옵니다. 그 클라이언트를 업데이트할 때까지만 켜 두세요.

업그레이드 후 연결이 끊긴 클라이언트가 이 두 정책 중 하나를 쓰고 있다면 채널이 거부되는 것으로 나타납니다. 설정을 켜거나, 클라이언트를 `Basic256Sha256`으로 옮기세요.

### 서버 인증서

`HOTLOOP_OPCUA_SERVER_CERT_FILE`과 `_KEY_FILE`을 설정하면 그 RSA 쌍이 그대로 사용됩니다. 설정하지 않으면 **처음 시작할 때 자체 서명 애플리케이션 인스턴스 인증서가 생성되어 저장됩니다.** 위치는 `HOTLOOP_OPCUA_SERVER_PKI_DIR`(`own/cert.pem`, `own/key.pem`, 키 모드 0600)이며, 다음 시작 때도 같은 인증서를 제시하므로 한 번 신뢰하라고 안내받은 클라이언트가 다시 안내받지 않습니다. 인증서가 자체 서명인 동안에는 시작할 때마다 경고가 기록되며 SHA-1 지문이 함께 남는데, OPC UA 도구가 보여 주는 형식이라 운영자가 클라이언트가 표시하는 값과 비교할 수 있습니다.

이 인증서는 일반 TLS 인증서와 달리 OPC UA 클라이언트가 확인하는 내용을 담습니다. URI 주체 대체 이름에 **애플리케이션 URI**(`HOTLOOP_OPCUA_SERVER_APPLICATION_URI`, 기본값 `urn:hotloop:gateway`, 설정된 경우 `:<siteId>` 추가), DNS 및 IP SAN으로 클라이언트가 쓰는 호스트 이름과 주소(엔드포인트 호스트, `HOTLOOP_OPCUA_SERVER_CERT_HOSTS`, `localhost`, 루프백, 이 장비의 호스트 이름), 그리고 애플리케이션 인스턴스에 대해 Part 6이 나열하는 키 용도가 들어갑니다. RSA-2048, 5년입니다.

저장된 인증서는 더 이상 제 역할을 할 수 없을 때만 교체되며 클라이언트가 새 인증서를 신뢰해야 한다는 경고가 남습니다. 남은 기간이 30일 미만이거나, 애플리케이션 URI가 설정과 더 이상 맞지 않거나, 설정된 호스트를 포함하지 못하거나, 키를 읽을 수 없는 경우입니다.

**장비의 호스트 이름은 설정된 호스트가 아닙니다.** 새 인증서에는 들어가지만, 호스트 이름이 바뀌어도 저장된 인증서는 유지됩니다. 컨테이너에서 호스트 이름은 컨테이너 ID이고 Kubernetes에서는 파드 이름이어서 재배포할 때마다 바뀝니다. 이것이 수정되기 전에는 호스트 이름도 계산에 들어가서, 컨테이너로 운영하는 Gateway를 업그레이드할 때마다 새 인증서가 만들어졌습니다. 이전 인증서를 신뢰하도록 설정된 Ignition은 누군가 다시 신뢰할 때까지 `Bad_SecurityChecksFailed`로 서버를 거부했고, 이는 모든 클라이언트에서 배포할 때마다 일어났습니다. 클라이언트는 `HOTLOOP_OPCUA_SERVER_ENDPOINT_HOST`와 `_CERT_HOSTS`로 서버에 접속하므로 이를 설정하면 인증서는 만료가 가까워질 때까지 유지됩니다. (엔드포인트 호스트가 설정되지 않은 Gateway는 장비의 호스트 이름을 엔드포인트 호스트로 쓰며, 이 경우에는 클라이언트에 알려지는 값이므로 계산에 들어갑니다. 설정해야 할 또 하나의 이유입니다.)

**쓸 수 없는 키가 있을 수 있으며 서버는 이를 거부합니다.** RSA 키 스무 개 중 하나쯤은 암호화된 OPC UA 로그인을 전달하지 못하고, 그 키로 하는 모든 암호화 로그인은 매번 실패하며 클라이언트에는 "보안 채널이 닫혔습니다"라고만 보입니다. 익명 세션과 암호화하지 않은 세션은 영향을 받지 않아서 원인을 잘못 짚기 쉽습니다. 생성된 키는 이런 키가 아닐 때까지 다시 만들고, 운영자가 제공한 키가 이런 키이면 시작할 때 이유를 알려 주는 오류와 함께 거부됩니다.

### 클라이언트 애플리케이션 인증서

OPC UA는 사용자뿐 아니라 애플리케이션도 인증합니다. 서버는 `<PKI_DIR>/trusted/`에 신뢰 목록을 두며, 인증서가 거기에 없는 클라이언트는 보안 채널에서 거부되고 그 인증서는 `<PKI_DIR>/rejected/`에 기록됩니다. **클라이언트를 승인하려면 그 인증서를 `rejected/`에서 `trusted/`로 옮기세요.** 재시작은 필요 없고 디렉터리는 연결할 때마다 읽습니다. `<PKI_DIR>/issuers/`와 `<PKI_DIR>/crl`은 CA가 발급한 클라이언트 인증서를 위해 그대로 전달됩니다.

`HOTLOOP_OPCUA_SERVER_TRUST_ALL_CLIENT_CERTS`(기본값 false, 시작할 때 경고)는 이 단계를 건너뜁니다. 애플리케이션 인증만 없애며, 사용자는 여전히 HotLoop 사용자 이름과 비밀번호로 인증해야 합니다.

### 로그인할 수 있는 사용자

**사용자 이름과 비밀번호, HotLoop 자체 사용자 기준.** 사용자 데이터베이스는 하나이며 별도의 자격 증명 저장소는 없습니다. 인증기는 HTTP 로그인이 쓰는 것과 같은 `store.User`로 사용자를 찾고, 같은 bcrypt 해시(`auth.CheckPassword`)로 비교하며, 사용자 이름을 같은 방식(소문자, 앞뒤 공백 제거)으로 정규화하고, 응답 시간으로 실제 이름을 알 수 없도록 사용자가 있든 없든 bcrypt 비교를 한 번 실행하며, 사용 안 함 계정은 거부합니다. 알 수 없는 사용자, 틀린 비밀번호, 사용 안 함 사용자, 권한이 없는 사용자는 모두 같은 응답 `BadUserAccessDenied`를 받습니다.

**사용자는 역할이 `tags.read`와 `values.read`를 부여할 때만 태그를 읽을 수 있습니다.** HTTP API가 `/api/tags`와 `/api/values`를 보호하는 것과 같은 쌍이며, 같은 `auth.Permissions`와 `auth.Allows`로 확인하므로 기본 제공 역할과 명시적 권한 목록은 그곳과 똑같이 동작합니다. OPC UA 클라이언트는 하나의 연결로 태그 목록을 탐색하고 값을 읽기 때문에 둘 다 필요하며, 하나만 가진 사용자가 나머지를 덤으로 얻지 않도록 하기 위해서입니다. `values.read`가 있는 모든 기본 제공 역할에는 `tags.read`도 있으므로 이 규칙은 명시적 권한 목록을 가진 사용자에게만 적용됩니다.

**권한은 로그인할 때만이 아니라 사용할 때도 확인합니다.** 라이브러리는 탐색, 읽기, 구독 샘플마다 세션의 역할을 요청하며, 그 응답은 사용자 데이터베이스의 짧은 캐시(10초)에서 나옵니다. 사용 안 함으로 바뀌거나 삭제되거나 권한을 잃은 사용자는 클라이언트가 다시 연결할 때가 아니라 그 간격 안에 활성 세션에서 접근 권한을 잃고, 모니터링 항목은 Bad로 바뀝니다. 조회에 실패하면 "아니오"로 취급합니다.

**익명 세션은 꺼져 있고**(`HOTLOOP_OPCUA_SERVER_ALLOW_ANONYMOUS`) 직접 켜지 않으면 익명 토큰은 제공되지 않으며, 켜면 시작할 때 경고가 나옵니다. X.509 사용자 ID 토큰도 꺼져 있으며 `HOTLOOP_OPCUA_SERVER_ALLOW_X509`를 설정하면 제공됩니다([X.509 사용자 인증서](#x509-사용자-인증서) 참조). HotLoop 자체 인증이 꺼져 있으면(`HOTLOOP_AUTH_INSECURE`) 로그인할 사용자가 없으므로, 익명 접근을 직접 켜지 않는 한 서버는 시작을 거부합니다.

로그인에 성공하면 HTTP 로그인과 같은 방식으로 시스템 로그에 기록됩니다. 로그인 실패는 인증되지 않은 호출자가 감사 추적을 채울 수 없도록 이유와 함께 프로세스 로그에만 기록됩니다. 비밀번호 확인은 한 번에 최대 4건만 실행됩니다. 각각이 일부러 느리게 만든 bcrypt 비교이고, OPC UA에는 HTTP 앞단에 있는 것 같은 속도 제한기가 없기 때문입니다. 그 밖에는 HTTP 로그인과 마찬가지로 잠금이나 속도 제한이 없습니다.

라이브러리는 복호화된 사용자 ID를 비밀번호까지 포함해 세션이 살아 있는 동안 세션 객체에 보관합니다. 메모리에만 있고 기록되지 않지만, 실행 중인 Gateway의 힙 덤프에는 그 시점에 연결된 사용자의 비밀번호가 들어 있을 수 있습니다.

**HotLoop이 허용하는 모든 길이의 비밀번호, 최대 72바이트(bcrypt의 한도)까지 로그인할 수 있습니다.** 이전 릴리스에서는 65~72바이트 비밀번호가 웹 UI에는 로그인되었지만 여기서는 되지 않았습니다(`BadIdentityTokenRejected`). 길이에 비밀번호와 32바이트 서버 nonce가 함께 계산되어 비밀번호는 64바이트까지였습니다. RSA나 사양 어디에도 이를 요구하는 내용이 없습니다. 토큰은 필요한 만큼의 블록으로 암호화되고 디코더는 이미 모든 블록을 읽습니다. 이제 검사는 길이가 32 이상이고 실제로 복호화된 바이트 수를 넘지 않는지를 확인하며, 이는 다음에 만들어지는 버퍼의 크기를 정하므로 원래 이 검사가 보장하려던 것입니다. 도착한 것보다 많다고 주장하는 길이는 여전히 거부되므로, 클라이언트가 서버에게 보내지 않은 만큼을 할당하게 만들 수 없습니다. 업스트림 `main`(2026-11-16 확인)에는 아직 그 제한이 있으며, 이 변경은 HotLoop-io/opcua의 풀 리퀘스트로 업스트림에 제안되어 있습니다.

### X.509 사용자 인증서

클라이언트는 비밀번호 대신 인증서로 로그인할 수 있습니다. 기본값은 꺼짐입니다. `HOTLOOP_OPCUA_SERVER_ALLOW_X509=true`(차트 `opcuaServer.allowX509`)를 설정하면 서버가 보안 엔드포인트에서 Certificate 사용자 토큰을 제공하고 시작할 때 이를 알립니다. 설정하지 않으면 어떤 엔드포인트도 이를 제공하지 않으며 인증서 로그인은 거부됩니다.

**인증서가 사용자에 대응되는 방식.** 관리자가 인증서를 HotLoop 사용자에게 연결합니다. 설정, OPC UA 인증서, 인증서 연결에서 하며(또는 API `POST /api/users/{username}/certificates`, 또는 MCP 도구 `add_user_certificate`) 레지스트리는 공개 인증서, SHA-256 지문, 연결한 사람과 시각, 취소 여부, 마지막 로그인 시각을 보관합니다. 그 인증서를 제시하고 개인 키를 가지고 있음을 증명하는 클라이언트는 **그 사용자로** 로그인합니다. 다른 설정은 필요 없고 인증서 자체의 어떤 것도 신뢰하지 않습니다. 일반 이름은 보지 않고, 운영할 CA도 없으며, 아무도 연결하지 않은 인증서는 아무 일도 하지 않습니다.

**토큰이 담는 것.** 클라이언트는 자신의 인증서와 그것을 발급한 인증서들을 이어서 보낼 수 있으며, 첫 번째가 연결된 인증서이고 나머지는 무시됩니다.

**키 증명.** 라이브러리는 서버 인증서와 세션 nonce에 대한 토큰의 서명을 확인하며, 이는 개인 키를 가진 쪽만 만들 수 있습니다. 다른 키의 서명과 함께 제시된 인증서는 거부됩니다.

**할 수 있는 일.** 그 사용자가 할 수 있는 일과 정확히 같습니다. 로그인하려면 사용자가 사용하도록 설정되어 있고 비밀번호 로그인과 같은 쌍인 `tags.read`와 `values.read`를 가져야 하며, 세션은 비밀번호 세션처럼 10초마다 확인됩니다. 사용 안 함으로 바뀌거나 권한을 잃은 사용자는 그 간격 안에 활성 인증서 세션을 잃습니다. 여기의 모든 세션과 마찬가지로 읽기 전용이며, 사용자의 역할과 관계없이 인증서 세션은 쓸 수 없습니다.

**거부되며 이유는 로그에 남습니다.** 등록되지 않았거나, 취소되었거나, 만료되었거나, 아직 유효하지 않거나, 사용자가 없어졌거나, 사용 안 함이거나, 권한이 없는 인증서는 모두 같은 응답 `BadUserAccessDenied`를 받으므로 클라이언트는 어느 경우인지 알 수 없습니다. 이유는 프로세스 로그와 감사 추적에 남습니다.

**취소.** 같은 화면에서 취소하세요(또는 `POST .../{thumbprint}/revoke`). 즉시 로그인이 중단되고, 그 인증서로 열린 세션은 10초 안에 종료됩니다. 취소된 인증서는 취소한 사람과 시각과 함께 목록에 남으므로, 거부된 로그인은 "알 수 없음"이 아니라 "취소됨"으로 읽힙니다. 잊으려면 삭제하세요. 백업에는 취소 내역을 포함한 레지스트리가 담깁니다.

**감사.** 인증서 로그인은 모두 사용자, 인증서의 지문과 주체, 클라이언트 애플리케이션을 적은 로그북 항목(카테고리 auth)입니다. 거부도 이유와 함께 항목으로 남습니다. 같은 거부를 되풀이하는 클라이언트는 시도마다가 아니라 그 인증서와 이유에 대해 1분에 한 항목만 쓰며, 모든 거부는 그래도 프로세스 로그에 남습니다. 인증서의 연결, 취소, 삭제도 수행한 사람과 함께 항목이 됩니다. 개인 키는 어느 항목에도 없고 HotLoop은 개인 키를 가지지 않습니다. 공개 인증서만 전송되거나 저장됩니다.

**애플리케이션 신뢰 목록과 다릅니다.** `<PKI_DIR>/trusted/`에 있는 클라이언트 애플리케이션 인증서는 클라이언트가 보안 채널을 열 수 있게 할 뿐 로그인이 아닙니다. 사용자 인증서는 다른 객체로, 사람의 것이며 사용자에게 연결됩니다. 클라이언트 쪽에서는 하나의 인증서가 둘 다에 쓰일 수 있지만, 서버는 이를 두 가지 행위로 다룹니다.

**HotLoop 자체 클라이언트**도 이 방식으로 로그인합니다. [프로토콜과 드라이버](/ko/iot/protocols/#opc-ua)의 `userCertificate`와 `userPrivateKey`를 참조하세요.

구현되지 않은 것: 클라이언트 인증서를 보증하도록 신뢰되는 인증 기관, 그리고 이를 사용자에 대응시키는 이름 규칙. 레지스트리는 클라이언트 인증서를 하나씩 연결하는 공장을 다루며, CA는 이를 대체하는 것이 아니라 보태는 기능이 될 것입니다.

### 서버 진단은 제거되었습니다

라이브러리의 세션별 진단 노드를 쓰면 로그인한 모든 사용자가 다른 모든 세션의 사용자 이름과 클라이언트 주소를 탐색할 수 있어서 꺼 두었고, `Server/ServerDiagnostics` 객체는 주소 공간에서 제거되었습니다(라이브러리가 카운터를 잠금 없이 쓰기도 합니다).

## 실행 중 주소 공간의 변경

장치와 태그는 Gateway가 실행되는 동안 추가, 편집, 제거되며, 주소 공간은 재시작 없이 이를 따라갑니다. **방식: 런타임 콜백에 안전망으로 타이머를 더했습니다.**

- `runtime.Manager.OnReload`는 `Reload`가 성공할 때마다 콜백을 호출합니다. API가 하는 모든 장치와 태그 변경은 `Reload`로 끝나므로 UI나 API에서 한 변경은 곧바로 게시됩니다. 콜백은 조정 고루틴에 신호만 보내고 작업은 직접 하지 않으므로, 느린 조정이 그것을 일으킨 API 요청을 막을 수 없습니다.
- 주기적 조정(`HOTLOOP_OPCUA_SERVER_RECONCILE_INTERVAL`, 기본값 30초)은 `Reload` 없이 구성이 바뀐 경우를 잡아냅니다.

둘 다 데이터베이스의 사용 설정된 장치와 태그에 대해 같은 멱등 비교를 실행합니다. 다른 부분만 건드립니다. 편집된 태그는 교체되고, 제거된 태그는 삭제되며, 클라이언트가 그 위에 건 모니터링 항목을 포함한 나머지는 그대로 유지됩니다. 새 장치의 노드는 한 번의 호출로 공간에 들어가므로, 조정 도중에 탐색하는 클라이언트는 모든 태그가 있는 장치를 보거나 아무것도 보지 못합니다.

폴링만 쓰는 것보다 콜백을 택한 이유는 런타임에 이미 깔끔한 신호(`Reload`)가 있고 변경이 최대 한 간격이 아니라 몇 밀리초 안에 보이게 되기 때문입니다. 타이머를 남겨 둔 것은 앞으로 구성을 쓰는 모든 쪽이 다시 로드하는 것을 기억하는지에 주소 공간이 달려 있어서는 안 되기 때문입니다.

## 클라이언트 연결

엔드포인트는 `opc.tcp://<HOTLOOP_OPCUA_SERVER_ENDPOINT_HOST>:<port>`입니다. 클러스터 안에서는 차트가 호스트를 릴리스의 Service DNS 이름으로 기본 설정하며, 클러스터 밖에서는 클라이언트가 실제로 쓸 이름이나 주소(LoadBalancer 주소, DNS 레코드)로 설정하세요. 이 값은 모든 엔드포인트 URL로 알려지고 생성되는 인증서에 기록됩니다. 서버가 바인딩하는 곳이 **아닙니다**. 라이브러리는 모든 인터페이스에서 수신하며 포트만 받습니다.

UaExpert나 다른 클라이언트에서는 다음과 같이 합니다.

1. 그 URL로 서버를 추가하고 `Basic256Sha256` / `Sign & Encrypt`를 선택합니다.
2. *Username*을 선택하고 `tags.read`와 `values.read`가 있는 HotLoop 사용자로 로그인합니다. 또는 `HOTLOOP_OPCUA_SERVER_ALLOW_X509`가 켜져 있으면 *Certificate*를 선택하고 관리자가 사용자에게 연결한 사용자 인증서와 키를 지정합니다.
3. 서버가 아직 클라이언트의 인증서를 신뢰하지 않으므로 첫 연결은 거부됩니다. `<PKI_DIR>/rejected/`(클러스터에서는 PKI 볼륨)에서 찾아 `trusted/`로 옮기고 다시 연결합니다.
4. 처음에는 클라이언트가 서버 인증서를 신뢰할지 묻습니다. 지문을 시작 로그의 지문과 비교하세요.
5. *Objects* → 장치 → 그 태그를 탐색하고 태그를 데이터 접근 보기로 끌어다 놓으면 구독됩니다.

## 클라이언트로서의 Ignition 8.3

**2026-09-27에 현재 안정 버전인 Ignition 8.3.9로 검증했습니다.** Inductive Automation의 공식 컨테이너 이미지(`inductiveautomation/ignition:8.3.9`, 체험판 상태의 표준 에디션)를 사용했고, 데모 장치 `extruder-1`을 시뮬레이터가 채우는 HotLoop Gateway를 대상으로 했습니다. 처음부터 끝까지 확인한 내용은 다음과 같습니다.

- HotLoop **viewer**로 로그인한, `Basic256Sha256`과 `SignAndEncrypt`를 쓰는 `opc.tcp://<gateway>:4840`으로의 Ignition OPC UA 연결
- 아래와 같은 양방향 인증서 신뢰
- Ignition의 `[default]` 프로바이더에서 HotLoop 노드를 가리키는 OPC 태그가 Good 품질로 읽히고 시뮬레이터가 움직이는 대로 바뀜. Ignition이 보여 준 모든 값은 HotLoop 자체의 `/api/values`가 가지고 있던 값이었습니다. 같은 double이 변경 없이 전송되므로 근사가 아니라 동일 여부로 비교됩니다. HotLoop에서 `string`으로 선언된 텍스트 태그는 Ignition의 String 태그에서 "RUNNING"으로 읽혔습니다.
- Ignition에서의 쓰기가 거부됨: Ignition이 쓰기를 보냈고 HotLoop이 `Bad_NotWritable`로 응답했으며(응답은 서명되지만 암호화되지 않는 Sign 전용 채널에서 선 위로 확인), HotLoop의 값은 움직이지 않았습니다.
- Ignition이 제공하는 모든 보안 정책과 모드(아래)

### 설정하기

HotLoop 쪽에서 Ignition보다 먼저 할 일입니다.

1. 서버를 켜고 `HOTLOOP_OPCUA_SERVER_ENDPOINT_HOST`를 Ignition이 Gateway에 접속할 때 쓰는 이름으로 설정합니다. 그 이름은 서버가 알리는 모든 엔드포인트 URL과 인증서에 들어갑니다.
2. Ignition용 HotLoop 사용자를 **viewer** 역할로 만듭니다(관리자가 `POST /api/users`로 합니다. [인증과 사용자](/ko/iot/authentication/) 참조). `tags.read`와 `values.read`가 있는 어떤 역할이든 로그인할 수 있으며, 서버가 읽기 전용이므로 그 이상은 제공되지 않습니다.

Ignition Gateway(포트 8088의 웹 UI)에서는 다음과 같이 합니다.

3. Connections 아래의 **OPC Connections** 페이지(`/app/connections/opc-client-connections`)에서 **OPC UA** 연결을 만듭니다. 엔드포인트 URL은 `opc.tcp://<gateway>:4840`이고 `Basic256Sha256` / `SignAndEncrypt` 엔드포인트를 선택하며, 인증은 **Username**으로 HotLoop 사용자와 비밀번호를 씁니다. 연결은 곧바로 Faulted가 되는데 정상입니다. 4단계가 이어집니다.
4. **HotLoop에서 Ignition을 승인합니다.** Ignition의 클라이언트 인증서는 이제 Gateway의 `<PKI_DIR>/rejected/`(컨테이너와 차트에서는 `/data/opcua-pki/rejected`)에 SHA-1 지문 `<thumbprint>.crt`라는 이름으로 있습니다. 지문을 OPC 인증서 페이지(`/app/connections/opc/security/certificates`)에 표시되는 Ignition 자체의 OPC UA 클라이언트 인증서와 비교하세요. 그런 다음 파일을 `trusted/`로 옮깁니다. 양쪽 모두 재시작은 필요 없습니다. HotLoop은 거부를 기록하지 않으며 그 파일이 유일한 흔적입니다.
5. **Ignition에서 HotLoop을 승인합니다.** 이제 연결은 반대 방향에서 실패합니다. 상태에 `Bad_SecurityChecksFailed ... unable to find valid certification path`라고 나옵니다. HotLoop의 인증서는 같은 페이지의 Ignition 거부된 **클라이언트** 인증서에 있습니다. 지문을 HotLoop이 시작할 때 기록하는 지문(`generated a self-signed OPC UA application certificate ... thumbprint=`)과 대조한 뒤 신뢰하세요. 재시작은 필요 없고 연결은 몇 초 안에 올라옵니다.
6. **태그.** 연결을 OPC 서버로 지정하고, Ignition이 그대로 받아들이는 네임스페이스 URI 형식의 항목 경로로 OPC 태그를 만듭니다.

   ```
   nsu=urn:hotloop:ua:gateway;s=extruder-1/Emberburn_Temperature
   ```

   각각을 HotLoop이 게시하는 형식으로 선언하세요([데이터 형식](#데이터-형식) 참조). float는 Float8, Boolean, String, `int16`은 Int2, `uint16`이나 `int32`는 Int4, 더 넓은 정수는 Int8입니다. 태그 그룹의 속도로 구독되며, HotLoop은 더 빠른 샘플링 속도를 장치의 폴링 간격으로 올려서 적용합니다.

같은 일을 파일이나 REST API로도 할 수 있습니다.

- 연결은 리소스 `data/config/resources/core/ignition/opc-connection/<name>/config.json`이며 프로필 형식은 `com.inductiveautomation.OpcUaServerType`입니다. 또는 `POST /data/api/v1/resources/ignition/opc-connection`을 씁니다. 직관적이지 않은 점이 둘 있습니다. 비밀번호는 내장 시크릿, 즉 `POST /data/api/v1/encryption/encrypt`가 평문으로 만들어 주는 JWE이며 일반 문자열은 받지 않습니다. 그리고 `security` 블록에는 게이트웨이의 클라이언트 키 저장소 별칭과 그 비밀번호가 필요합니다. 빼면 연결이 NullPointerException으로 실패하고, 별칭이 비어 있으면 `Unable to retrieve KeyPair for alias 'client'`로 실패합니다. 둘 다 들어 있는 기본 `Ignition OPC UA Server` 루프백 연결에서 블록을 복사하세요.
- 인증서는 `data/config/local/com.inductiveautomation.opcua/client/security/pki/`(`rejected/certs`, `trusted/certs`)에 있으며, API로는 `GET /data/opc-ua/api/v1/client/pki/certificates/rejected`와 `POST .../trusted/<sha1>`을 씁니다. **Ignition은 파일 이름을 지문으로 짓지 않습니다.** API의 `signature` 필드가 SHA-1 지문이며 HotLoop이 기록하는 값과 일치합니다.
- 태그는 `POST /data/api/v1/tags/import?provider=default&type=json`으로 가져옵니다.
- 모든 API 호출에는 API 키(API Keys 페이지, `/app/platform/security/api-keys`)가 필요하며, 키의 보안 수준 중 하나가 게이트웨이의 읽기 또는 쓰기 권한(`security-properties` 리소스)에 있어야 통과합니다.

### 예상되는 동작

- **`Bad_SecurityChecksFailed`는 두 가지 다른 뜻입니다.** Ignition은 HotLoop이 Ignition의 인증서를 거부할 때(4단계, 메시지에 이유가 없음)와 Ignition이 HotLoop의 인증서를 거부할 때(5단계, 메시지에 *unable to find valid certification path*가 나옴) 같은 상태를 보여 줍니다. 먼저 HotLoop의 `rejected/`를 보세요.
- **HotLoop을 다시 배포해도 인증서가 유지됩니다.** 4.15.3까지는 그렇지 않았습니다. 인증서가 컨테이너를 다시 만들 때마다 바뀌는 컨테이너 호스트 이름을 포함해야 해서, 업그레이드할 때마다 새 인증서가 만들어졌고 누군가 다시 신뢰할 때까지 Ignition이 서버를 거부했습니다. [서버 인증서](#서버-인증서)를 참조하세요. PKI 볼륨을 잃으면 인증서는 여전히 바뀝니다.
- **숫자로 선언된 텍스트 태그는 `Bad_TypeMismatch`로 읽힙니다.** HotLoop은 태그를 선언된 형식으로 게시하며, "RUNNING"을 담은 `float` 태그는 Double일 수 없습니다. 4.15.3까지 Discover tags가 만든 태그는 모두 `float`로 선언되었습니다. [프로토콜과 드라이버](/ko/iot/protocols/#opc-ua)를 참조하세요. `string`으로 선언하세요.
- **쓰기는 거부되며 Ignition은 이유를 흐립니다.** HotLoop은 `Bad_NotWritable`로 응답합니다. Ignition 자체의 OPC UA 서버는 같은 태그에 쓰도록 하면 일반적인 `Bad`(0x80000000)만 전달합니다. Ignition 태그의 값은 바뀌지 않습니다.
- **더 이상 권장되지 않는 정책은 켜 둔 경우에만 동작합니다.** Ignition은 `Basic128Rsa15`와 `Basic256`을 제공합니다. 연결에서 `Basic256Sha256` 또는 `Aes` 정책 중 하나를 선택하세요.
- **체험 기간.** 라이선스가 없는 8.3 게이트웨이는 두 시간 동안 실행된 뒤 Gateway 웹 UI에서 체험을 초기화할 때까지 실행을 멈춥니다. 만료되면 태그가 오래된 값이 되는데, 이는 연결이 아니라 Ignition의 동작입니다.

### 정책 매트릭스

각 행은 해당 정책과 모드로 만든 새 세션이며 실시간 값을 읽습니다. 권장되지 않는 두 행은 `HOTLOOP_OPCUA_SERVER_ALLOW_DEPRECATED_POLICIES`를 켠 상태에서 측정했으며, 기본값처럼 꺼져 있으면 그 두 정책은 제공되지 않고 이를 요청하는 채널은 거부됩니다.

| 정책 | SignAndEncrypt | Sign |
|---|---|---|
| `Basic256Sha256` | 동작 | 동작 |
| `Aes128_Sha256_RsaOaep` | 동작 | 동작 |
| `Aes256_Sha256_RsaPss` | 동작 | 동작 |
| `Basic256`(권장되지 않음) | 동작 | 동작 |
| `Basic128Rsa15`(권장되지 않음) | 동작 | 동작 |

`None`은 `HOTLOOP_OPCUA_SERVER_ALLOW_INSECURE`를 설정하지 않으면 제공되지 않으며, 시험하지 않았습니다.

## 구성

| 변수 | 기본값 | <span class="sr-only">Details</span> |
|---|---|---|
| `HOTLOOP_OPCUA_SERVER_ENABLED` | `true` | 바이너리와 차트에서 켜짐. `false`로 서버를 끕니다 |
| `HOTLOOP_OPCUA_SERVER_PORT` | `4840` | TCP 포트, 모든 인터페이스에서 |
| `HOTLOOP_OPCUA_SERVER_ENDPOINT_HOST` | 이 장비의 호스트 이름 | 클라이언트에 연결하라고 알려 주는 대상이며 생성된 인증서에도 기록됩니다. **반드시 설정하세요.** |
| `HOTLOOP_OPCUA_SERVER_APPLICATION_URI` | `urn:hotloop:gateway[:<siteId>]` | 재시작해도 안정적이어야 하며 URI여야 합니다 |
| `HOTLOOP_OPCUA_SERVER_PKI_DIR` | `/data/opcua-pki` | 인증서, 키, `trusted/`, `rejected/`. 볼륨으로 뒷받침하세요 |
| `HOTLOOP_OPCUA_SERVER_CERT_FILE` / `_KEY_FILE` | n/a | 새로 생성하는 대신 이 RSA 쌍을 사용합니다. 둘 다 설정하거나 둘 다 설정하지 않습니다 |
| `HOTLOOP_OPCUA_SERVER_CERT_HOSTS` | n/a | 생성되는 인증서에 넣을 추가 DNS 이름 / IP |
| `HOTLOOP_OPCUA_SERVER_ALLOW_INSECURE` | `false` | SecurityPolicy None을 제공합니다. 시작할 때 경고합니다 |
| `HOTLOOP_OPCUA_SERVER_ALLOW_ANONYMOUS` | `false` | ID가 없는 세션을 받습니다. 시작할 때 경고합니다 |
| `HOTLOOP_OPCUA_SERVER_TRUST_ALL_CLIENT_CERTS` | `false` | 클라이언트 인증서 승인을 건너뜁니다. 시작할 때 경고합니다 |
| `HOTLOOP_OPCUA_SERVER_ALLOW_X509` | `false` | Certificate 사용자 토큰을 제공합니다. 클라이언트가 사용자에게 연결된 인증서로 로그인합니다([X.509 사용자 인증서](#x509-사용자-인증서)). 시작할 때 알립니다 |
| `HOTLOOP_OPCUA_SERVER_ALLOW_DEPRECATED_POLICIES` | `false` | 오래된 클라이언트를 위해 권장되지 않는 `Basic128Rsa15`와 `Basic256` 정책을 제공합니다([전송](#전송)). 시작할 때 경고합니다 |
| `HOTLOOP_OPCUA_SERVER_MAX_SESSIONS` | `20` | 0 = 제한 없음 |
| `HOTLOOP_OPCUA_SERVER_MAX_SUBSCRIPTIONS` | `200` | 0 = 제한 없음 |
| `HOTLOOP_OPCUA_SERVER_RECONCILE_INTERVAL` | `30s` | 안전망 조정 주기 |

서버는 `--mcp-stdio` 모드에서는 시작되지 않습니다. 그 모드는 에이전트가 이 바이너리를 도우미로 띄우는 것이어서, 두 번째 프로세스가 실제 Gateway와 포트 4840을 놓고 경쟁하는 일이 생기면 안 되기 때문입니다.

### Helm

`charts/hotloop/values.yaml`의 `opcuaServer.*`입니다. 이를 켜면 Service(`<release>-opcua`, 기본은 ClusterIP이며 클러스터 밖 클라이언트를 위한 LoadBalancer나 NodePort는 의도적인 선택), PKI 디렉터리용 PVC(`opcuaServer.persistence`, 잃으면 모든 클라이언트가 새 인증서를 신뢰해야 함), 컨테이너 포트가 추가되며, `networkPolicy.enabled`와 `opcuaServer.enabled`를 함께 켰을 때 아무도 닿을 수 없는 서버가 조용히 수신 대기하는 일이 없도록 기본 NetworkPolicy의 ingress 규칙에 이 포트가 들어갑니다. 사용자 지정 `networkPolicy.ingress`는 브로커와 마찬가지로 그 규칙을 대체하므로 이때는 포트를 직접 나열해야 합니다. `opcuaServer.tls.existingSecret`은 생성된 인증서 대신 `kubernetes.io/tls` Secret을 제공합니다.

## 검증된 것과 그렇지 않은 것

HotLoop는 실제 장비와 실제 서버를 대상으로 실행했으며, 2026-11-17에는 실제 장비에서도 실행했습니다.
