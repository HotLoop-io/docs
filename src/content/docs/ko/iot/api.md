---
title: "HTTP API 안내"
description: "HotLoop이 HTTP로 응답하는 모든 호출과 필요한 것, 받는 것, 돌려주는 것을 담았습니다. 웹 UI는 이것 외에는 아무것도 쓰지 않습니다."
---

:::note[앞으로 나올 내용 포함]
이 페이지에는 최신 릴리스인 HotLoop core 4.24.0보다 새로운 내용도 일부 들어 있습니다. 설치하신 버전에는 없는 부분이 있을 수 있습니다. 무엇이 바뀌었는지는 [릴리스 노트](/ko/releases/)에 나와 있습니다.
:::

Gateway가 HTTP로 응답하는 모든 호출과 각 호출에 필요한 것, 받는 것, 돌려주는 것을 정리한 문서입니다. 웹 UI는 이것만 사용합니다. 화면 뒤에 숨은 비공개 API는 없으므로, UI에서 할 수 있는 일은 스크립트가 같은 호출과 같은 권한으로 모두 할 수 있습니다.

이 페이지는 코드와 대조해 검사합니다. 따라서 경로 목록과 호출 가능한 사용자는 예전 API를 설명한 것이 아닙니다. 아래의 요청과 응답 형식은 실행 중인 Gateway에서 가져온 것이며 테스트는 이를 검사하지 않으므로, 핸들러를 바꾸면 이 페이지의 해당 섹션도 함께 바꾸십시오.

각 기능의 배경은 해당 기능 페이지에 있습니다. [인증과 사용자](/ko/iot/authentication/), [엔티티](/ko/iot/entities/), [설비 트리와 레이블](/ko/iot/equipment/), [자동화](/ko/iot/automations/), [예약 보고서](/ko/gateway/reports/), [플릿 관리](/ko/gateway/fleet/), [알람 알림](/ko/iot/notifications/), [백업과 복원](/ko/iot/backup/), [MCP](/ko/iot/mcp/). 이 페이지는 목록이고, 그 페이지들은 이유를 설명합니다.

## 규칙

### 위치

모든 것은 앱의 HTTP 포트 하나(`HOTLOOP_LISTEN_ADDR`, 기본값 `:8080`)에서 동작합니다. 앱을 특정 경로 아래에서 제공하는 프록시 뒤에서는 `HOTLOOP_BASE_PATH`를 설정하면 Gateway가 그 경로를 제거하므로, `/hotloop/api/devices`와 `/api/devices`는 같은 호출입니다. 아래 경로는 그 경로를 뺀 형태로 적었습니다.

### 로그인: 쿠키 또는 bearer 토큰

모든 `/api/` 경로에는 세션이 필요합니다. 예외는 로그인(비밀번호, 또는 키오스크 패널의 PIN이나 배지), 수신 웹훅, 알람 확인 링크이며, 이들은 각각 요청 안에 자체 증명을 담고 있습니다. `POST /api/auth/login`은 토큰을 응답하고 같은 값을 `iiot_session` 쿠키로도 설정합니다(HttpOnly, SameSite=Lax, 요청이 TLS 또는 `X-Forwarded-Proto: https`로 들어온 경우 Secure). 브라우저는 쿠키를 사용하며 토큰을 직접 보지 않습니다. 스크립트는 대신 토큰을 보냅니다.

```
Authorization: Bearer 3f9c...e1
```

둘은 같은 세션이며 같은 방식으로 검사합니다. 세션은 `HOTLOOP_AUTH_SESSION_TTL`(기본값 12시간) 동안 유지됩니다. 세션이 없으면 모든 `/api/` 경로가 다음과 같이 응답합니다.

```
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="hotloop"

{"error":"not logged in"}
```

폐기되었거나 만료된 토큰에는 `"the session is invalid or has expired"`, 비활성화된 계정에는 `"this account no longer has access"`로 응답합니다.

`HOTLOOP_AUTH_INSECURE=true`이면 로그인이 전혀 없습니다. 아무것도 검사하지 않고, 아래의 모든 권한이 모든 사람에게 부여되며, 쓰기에 기록되는 이름은 프록시의 `X-EmberNET-User`, `X-Forwarded-User`, `X-Auth-Request-User`, `X-Remote-User`, `X-Forwarded-Email` 헤더에서 가져오고, 설정된 것이 없으면 `operator`입니다. 대시보드 프록시만 파드에 접근하게 하는 NetworkPolicy 뒤에서만 합리적인 설정입니다. [인증과 사용자](/ko/iot/authentication/#로그인-없이-실행하기)를 참고하십시오.

MCP는 별개입니다. 자체 bearer 토큰(`HOTLOOP_MCP_TOKEN`)이 있으며 세션은 전혀 보지 않습니다. [MCP](#mcp)를 참고하십시오.

### 권한

로그인한 사용자는 역할에서 오거나 계정에 직접 지정된 권한 목록을 가집니다. 사용자에게 없는 권한을 요구하는 경로는 다음과 같이 응답합니다.

```
HTTP/1.1 403 Forbidden

{"error":"viewer1 does not have the \"values.write\" permission"}
```

어느 역할이 어떤 권한을 가지는지는 [권한 표](#권한)에 있습니다.

### 오류

API 자체가 만드는 모든 실패는 한 가지 형태의 JSON입니다.

```json
{"error": "value is outside the tag's configured range: 120 is outside 0..95"}
```

`/readyz`는 `detail`을 추가하고, 실패한 서비스 호출은 이미 수행한 쓰기를 추가합니다. 메시지는 읽는 사람을 위해 작성되어 있습니다. 무엇이 잘못되었는지, 그리고 있다면 대신 무엇을 해야 하는지 알려 줍니다. 그대로 표시하십시오.

| 상태 | 발생 조건 |
|---|---|
| 400 | 요청이 잘못되었습니다. 형식이 잘못된 본문, 검증에 실패한 필드, 알 수 없는 필드, 누락된 매개변수, 알 수 없는 서비스 |
| 401 | 세션이 없거나 만료되었거나, 로그인 시 비밀번호가 틀렸습니다 |
| 403 | 사용자에게 권한이 없거나, 쓰기 게이트가 정책상 쓰기를 거부했습니다. 쓰기가 꺼져 있거나, 태그가 활성화되지 않았거나, 엔티티가 비활성화된 경우입니다 |
| 404 | 경로나 본문에서 지정한 대상이 존재하지 않습니다 |
| 409 | 이미 존재하거나, 이 작업을 할 수 없는 상태입니다. 보류 상태가 아닌 알람, 하위 노드가 남아 있는 노드, 전환할 상태를 알 수 없는 엔티티, 이미 실행 중인 스크립트, 거부되었거나 이미 적용 중인 레시피 |
| 422 | 쓰기 게이트가 값 자체를 이유로 거부했습니다. 태그의 범위를 벗어났거나 엔티티의 단계에 맞지 않는 값입니다 |
| 502 | 장치가 자체 오류로 응답했으며 본문이 그 내용입니다. 또는 레시피가 시작되었으나 모든 대상에 도달하지 못했고, 본문에 전송된 대상과 그렇지 못한 대상이 나옵니다 |
| 503 | 장치가 연결되어 있지 않거나, 알람 엔진이 실행 중이 아닙니다 |
| 500 | 서버 내부 오류입니다. 본문은 `internal error (ref …); the server log has the detail under that ref`뿐이며, 전체 오류는 해당 참조 번호로 로그에 있습니다. 실제 메시지가 있는 유일한 500은 버튼을 뗀 신호가 전송되지 않은 경우이며, 그 메시지가 무엇을 확인할지 정확히 알려 주기 때문입니다 |

API가 분류할 수 없는 것은 모두 500이며 400이 아닙니다. 데이터베이스 장애를 400으로 응답하면 운영자는 자신이 잘못 입력했다고 생각하고 존재하지 않는 오타를 찾아다니게 됩니다.

두 가지 실패는 API에서 오는 것이 아니며 JSON이 아닌 일반 텍스트입니다. 어떤 경로와도 맞지 않으면 `404 page not found`, 알려진 경로를 잘못된 메서드로 호출하면 `405 method not allowed`로 응답합니다.

거부된 쓰기는 절대 500이 아닙니다. 정책 거부를 서버 오류처럼 보여 주는 현장 화면은 운영자에게 오류를 무시하라고 가르치는 셈입니다.

### 본문

요청 본문은 JSON이며 최대 4 MiB입니다(수신 웹훅은 1 MiB). **알 수 없는 필드는 무시하지 않고 거부합니다.**

```json
{"error":"request body: json: unknown field \"x\""}
```

철자가 틀려 조용히 버려진 설정은 제대로 적용된 설정과 똑같이 보이므로, 디코더는 대신 거부합니다.

장치, 태그, 알람, 자동화, 플릿 구성원, 보고서의 `POST`와 `PUT`은 객체 전체를 바꿉니다. 생략한 필드는 0 값이 되고, 생략한 불리언은 `false`입니다. 읽고, 바꾸고, 다시 보내십시오. 예외는 엔티티와 설비의 `PUT`으로, 보낸 필드만 바꿉니다. 그리고 장치 자격 증명은 생략하면 그대로 유지됩니다(아래 참고).

### 비밀 값은 쓰기 전용입니다

장치에 저장된 자격 증명(브로커 비밀번호, HTTP 헤더, 주소에 포함된 비밀번호)은 관리자를 포함해 어떤 역할에도 돌려주지 않습니다. `[redacted]`로 표시됩니다.

```json
"config": {"clientId": "docs-api-tankfarm", "password": "[redacted]", "username": "tank"}
```

장치를 저장할 때 저장된 값을 유지하려면 자리 표시자를 보내거나 키를 생략하고, 교체하려면 새 값을 보내며, 지우려면 `""` 또는 `null`을 보냅니다. 새 장치는 자리 표시자로 저장할 수 없고, 유지된 자격 증명을 가진 채 장치를 다른 호스트로 옮기는 저장은 거부됩니다. 저장된 비밀번호가 남의 리스너로 넘어가지 못하게 하기 위해서입니다. 전체 규칙은 [인증과 사용자](/ko/iot/authentication/#장치-자격-증명은-쓰기-전용입니다)에 있습니다. Gateway가 가진 다른 모든 자격 증명도 마찬가지입니다. 설정에는 `set` 또는 `not set`이 표시되고, 진단 정보는 나가는 MCP 대상에서 자격 증명을 제거하며, 로그인이 건네주는 토큰 하나를 제외하면 이 API는 비밀번호 해시나 세션 토큰을 돌려주지 않습니다.

### camelCase, 단 snake_case인 곳은 예외

API 대부분은 camelCase(`deviceId`, `pollIntervalMs`, `createdAt`)이며, 첫 버전부터 그랬고 EmberNet 대시보드의 `TagValue` 계약도 그렇게 요구합니다.

엔티티, 상태, 서비스, 설비, 레이블 엔드포인트는 snake_case(`entity_id`, `last_changed`, `parent_id`, `label_id`)입니다. 의도된 것입니다. 엔티티 API는 일반적인 엔티티, 상태, 서비스 형태를 쓰므로 그 형태를 이미 쓰는 것은 이 API도 그대로 쓰며, 설비 트리는 엔티티 모델의 영역 레지스트리로서 같은 소비자에 맞춰져 있습니다. 둘이 만나는 곳에서는 각자 자기 표기를 유지합니다. 장치에는 `equipmentId`가, 엔티티에는 `equipment_id`가 있습니다.

### 시각, 지속 시간, 태그 키

- **타임스탬프**는 UTC 기준 RFC 3339이며, 있으면 소수 초를 포함합니다. 예: `2026-09-27T20:21:58.255869Z`. 표시 시간대 설정은 UI에 보이는 값만 바꾸고 API가 돌려주는 값은 바꾸지 않습니다.
- **아직 일어나지 않은 시각은 생략됩니다.** 한 번도 실행되지 않은 규칙에는 `lastRun`이 없고, 한 번도 폴링하지 않은 장치에는 `lastPoll`과 `lastGood`이 없으며, 아무도 확인하지 않은 알람에는 `ackedAt`이 없고, 한 번도 보이지 않은 플릿 구성원에는 `lastSeen`이 없습니다. 시각 필드가 없으면 한 번도 없었다는 뜻입니다. 응답이나 스트림 이벤트에서 Go의 영(zero) 시각 `0001-01-01T00:00:00Z`를 볼 일은 없습니다. 예전에는 열두 개쯤의 필드가 이 값을 보냈고, 자동화 화면에는 한 번도 실행되지 않은 규칙이 마지막 실행 739887일 전으로 표시되었습니다. 이 상태를 유지하기 위해 테스트가 코드의 모든 경로와 모든 시각 필드를 읽습니다.
- **스파크라인**은 예외입니다. 여기서 `timestamps`는 차트에 바로 들어가므로 Unix 밀리초입니다.
- **지속 시간**은 이름에 단위를 적습니다. `pollIntervalMs`, `onDelaySec`, `minutes`, `durationMs`. 상태의 `uptime`은 Go 지속 시간 문자열(`11m13s`)입니다.
- **태그 키**는 `device/tag`이며, 모든 `?tag=` 매개변수와 `tag` 필드가 받는 형식입니다. 태그 이름에는 슬래시(OPC UA 경로, MQTT 토픽)가 들어갈 수 있으므로 첫 슬래시만 구분자입니다. `plc-1/Line/Zone 1`은 장치 `plc-1`의 태그 `Line/Zone 1`입니다.
- **숫자가 아닌 숫자형 쿼리 매개변수**는 무시되고 기본값이 쓰이므로, `?limit=abc`는 `?limit`을 지정하지 않은 것과 같습니다.
- **빈 목록**은 모든 응답과 스트림 이벤트에서, 어느 깊이에서든 `null`이 아니라 `[]`입니다. `.length` 앞에서 null 검사를 할 필요가 없습니다. 보이는 `null`은 목록이 아니라, 엔티티의 `equipment_id`나 루트 노드의 `parent_id`처럼 문서에 명시된 null 허용 필드 중 하나입니다. 선택 사항으로 표시된 목록 필드는 여전히 통째로 생략될 수 있습니다.

### 선택 기능

플릿, 알림, 백업, 예약 보고서는 해당 `HOTLOOP_*_ENABLED` 변수를 설정하지 않으면 꺼져 있습니다. 기능이 꺼져 있어도 목록 경로는 200으로 응답하며 `"configured": false`와 빈 목록을 돌려주므로, 화면은 "여기에 아무것도 없음" 대신 "사용 안 함"이라고 표시할 수 있습니다. 그 기능의 나머지 모든 경로는 변수 이름을 밝힌 오류와 함께 400으로 응답합니다.

```json
{"error":"backups are not enabled (HOTLOOP_BACKUP_ENABLED)"}
```

나가는 MCP 서버가 구성되어 있지 않을 때 `GET /api/sites`도 같게 동작합니다.

### 이 제품에 없는 기능

HotLoop은 하나의 코드베이스에서 IoT, Edge, Gateway, Edge Relay로 제공되며, 제품에 없는 기능은 꺼진 것이 아니라 바이너리에 들어 있지 않은 것입니다. IoT, Edge, Gateway에서도 그 기능의 경로는 같은 권한 검사를 거친 뒤 404로 응답하며, 이 응답은 양쪽 끝을 모두 밝히므로 스크립트가 "잘못된 장비"와 "잘못된 URL"을 구분할 수 있습니다.

```json
{"error":"scheduled reports are part of HotLoop Gateway; this is HotLoop IoT","product":"iot","feature":"reports"}
```

400이 아닌 이유는 이를 해결할 변수가 없기 때문이고, 5xx가 아닌 이유는 잘못된 것이 없기 때문입니다. `GET /api/status`는 어느 제품이 응답했고 어떤 기능이 있는지 처음부터 알려 주므로 클라이언트는 더듬어 보지 않고 물어볼 수 있습니다.

### 무언가를 바꾸는 모든 것은 기록됩니다

모든 생성, 변경, 삭제, 쓰기, 확인, 로그인은 사용자 이름과 함께 시스템 로그(`GET /api/events`)에 남고, 거부되었든 아니든 태그에 대한 모든 쓰기는 쓰기 감사(`GET /api/writes`)에 남습니다. 이 API에는 조용한 경로가 없습니다.

## 권한

누가 무엇을 가지는지 정리합니다. 권한 목록이 명시된 계정은 자신의 역할이 가진 집합 대신 그 목록에 적힌 권한만 가집니다. `*`는 모든 권한을, `resource.*`는 한 리소스 아래의 모든 권한을 부여합니다(`reports.*`). admin 역할은 `*`입니다.

| 권한 | viewer | operator | admin |
|---|---|---|---|
| `status.read` | 예 | 예 | 예 |
| `devices.read` | 예 | 예 | 예 |
| `devices.write` | 아니요 | 아니요 | 예 |
| `tags.read` | 예 | 예 | 예 |
| `tags.write` | 아니요 | 아니요 | 예 |
| `values.read` | 예 | 예 | 예 |
| `values.write` | 아니요 | 예 | 예 |
| `board.write` | 아니요 | 예 | 예 |
| `entities.read` | 예 | 예 | 예 |
| `entities.write` | 아니요 | 아니요 | 예 |
| `helpers.write` | 아니요 | 예 | 예 |
| `equipment.read` | 예 | 예 | 예 |
| `equipment.write` | 아니요 | 아니요 | 예 |
| `alarms.read` | 예 | 예 | 예 |
| `alarms.write` | 아니요 | 아니요 | 예 |
| `alarms.ack` | 아니요 | 예 | 예 |
| `automations.read` | 예 | 예 | 예 |
| `automations.write` | 아니요 | 아니요 | 예 |
| `automations.trigger` | 아니요 | 예 | 예 |
| `scripts.read` | 예 | 예 | 예 |
| `scripts.run` | 아니요 | 예 | 예 |
| `scripts.write` | 아니요 | 아니요 | 예 |
| `recipes.read` | 예 | 예 | 예 |
| `recipes.apply` | 아니요 | 예 | 예 |
| `recipes.write` | 아니요 | 아니요 | 예 |
| `blueprints.read` | 예 | 예 | 예 |
| `blueprints.apply` | 아니요 | 예 | 예 |
| `blueprints.write` | 아니요 | 아니요 | 예 |
| `dashboards.read` | 예 | 예 | 예 |
| `dashboards.write` | 아니요 | 아니요 | 예 |
| `energy.read` | 예 | 예 | 예 |
| `energy.write` | 아니요 | 아니요 | 예 |
| `fleet.read` | 예 | 예 | 예 |
| `fleet.write` | 아니요 | 예 | 예 |
| `fleet.rebirth` | 아니요 | 예 | 예 |
| `fleet.restart` | 아니요 | 아니요 | 예 |
| `fleet.update` | 아니요 | 아니요 | 예 |
| `fleet.config` | 아니요 | 아니요 | 예 |
| `notify.test` | 아니요 | 아니요 | 예 |
| `notify.escalation` | 아니요 | 아니요 | 예 |
| `backup.read` | 아니요 | 아니요 | 예 |
| `backup.run` | 아니요 | 아니요 | 예 |
| `reports.read` | 예 | 예 | 예 |
| `reports.run` | 아니요 | 예 | 예 |
| `reports.write` | 아니요 | 아니요 | 예 |
| `sites.read` | 예 | 예 | 예 |
| `settings.read` | 예 | 예 | 예 |
| `settings.write` | 아니요 | 아니요 | 예 |
| `events.read` | 예 | 예 | 예 |
| `logbook.read` | 예 | 예 | 예 |
| `users.manage` | 아니요 | 아니요 | 예 |

기준은 어디서나 같습니다. operator는 공장을 운영하고(값 쓰기, 알람 확인, 자동화 실행, 릴레이 살짝 건드리기), admin만 공장이 어떻게 구성되는지를 바꾸거나 Gateway를 대신해 바깥 세계에 무언가를 합니다(릴레이 재시작, 구성 푸시, 테스트 페이지 전송, 공장 데이터를 어딘가로 이메일로 보내는 보고서 정의).

## 엔드포인트 색인

권한 열은 경로가 무엇을 검사하는지 알려 줍니다. `session`은 추가 권한 없이 로그인한 모든 사용자를 뜻합니다. `none`은 세션도 필요 없다는 뜻이며, 이유는 해당 섹션에 나옵니다. `(in handler)`는 검사가 핸들러 앞이 아니라 핸들러 안에서 이루어진다는 뜻이며, 이유는 해당 섹션에 나옵니다.

제품 열은 그 경로를 가진 가장 작은 HotLoop을 나타냅니다. `all`은 IoT, Edge, Gateway, `edge`는 Edge와 Gateway, `gateway`는 Gateway뿐입니다. 모든 제품이 모든 경로를 등록하고 같은 권한을 검사합니다. 그 경로가 없는 제품에서는 404로 응답하며 그 경로가 어디에 있는지 알려 줍니다. [이 제품에 없는 기능](#이-제품에-없는-기능)을 참고하십시오.

| 메서드 | 경로 | 권한 | 제품 |
|---|---|---|---|
| `GET` | `/healthz` | none | all |
| `GET` | `/readyz` | none | all |
| `POST` | `/api/auth/login` | none | all |
| `POST` | `/api/auth/kiosk` | none | all |
| `POST` | `/api/auth/logout` | session | all |
| `POST` | `/api/auth/activity` | session | all |
| `GET` | `/api/auth/session` | session | all |
| `POST` | `/api/auth/password` | session | all |
| `GET` | `/api/users` | `users.manage` | all |
| `POST` | `/api/users` | `users.manage` | all |
| `PUT` | `/api/users/{username}` | `users.manage` | all |
| `DELETE` | `/api/users/{username}` | `users.manage` | all |
| `POST` | `/api/users/{username}/password` | `users.manage` | all |
| `DELETE` | `/api/users/{username}/lockout` | `users.manage` | all |
| `PUT` | `/api/users/{username}/pin` | `users.manage` | all |
| `DELETE` | `/api/users/{username}/pin` | `users.manage` | all |
| `GET` | `/api/opcua/certificates` | `users.manage` | all |
| `GET` | `/api/users/{username}/certificates` | `users.manage` | all |
| `POST` | `/api/users/{username}/certificates` | `users.manage` | all |
| `POST` | `/api/users/{username}/certificates/{thumbprint}/revoke` | `users.manage` | all |
| `DELETE` | `/api/users/{username}/certificates/{thumbprint}` | `users.manage` | all |
| `GET` | `/api/status` | `status.read` | all |
| `GET` | `/api/protocols` | `status.read` | all |
| `GET` | `/api/diagnostics` | `status.read` | all |
| `GET` | `/api/devices` | `devices.read` | all |
| `POST` | `/api/devices` | `devices.write` | all |
| `GET` | `/api/devices/{id}` | `devices.read` | all |
| `DELETE` | `/api/devices/{id}` | `devices.write` | all |
| `POST` | `/api/devices/{id}/enabled` | `devices.write` | all |
| `POST` | `/api/devices/{id}/browse` | `devices.read` | all |
| `POST` | `/api/devices/{id}/import` | `tags.write` | all |
| `GET` | `/api/devices/{id}/network` | `devices.read` | all |
| `PUT` | `/api/devices/{id}/network` | `devices.write` | all |
| `DELETE` | `/api/devices/{id}/network` | `devices.write` | all |
| `GET` | `/api/unifi/{id}/networks` | `devices.read` | all |
| `PUT` | `/api/unifi/{id}/networks/{network}` | `devices.write` | all |
| `POST` | `/api/unifi/{id}/networks/{network}/accept-all` | `devices.write` | all |
| `GET` | `/api/unifi/{id}/known` | `devices.read` | all |
| `PUT` | `/api/unifi/{id}/networks/{network}/known/{mac}` | `devices.write` | all |
| `DELETE` | `/api/unifi/{id}/networks/{network}/known/{mac}` | `devices.write` | all |
| `GET` | `/api/unifi/{id}/clients` | `devices.read` | all |
| `GET` | `/api/unifi/consoles` | `devices.read` | all |
| `GET` | `/api/unifi/{id}/overview` | `devices.read` | all |
| `GET` | `/api/unifi/{id}/topology` | `devices.read` | all |
| `GET` | `/api/unifi/{id}/devices` | `devices.read` | all |
| `GET` | `/api/unifi/{id}/wifi` | `devices.read` | all |
| `GET` | `/api/unifi/{id}/events` | `devices.read` | all |
| `POST` | `/api/unifi/{id}/starter-alarms` | `alarms.write` | all |
| `GET` | `/api/unifi-protect/{id}/cameras/{camera}/snapshot` | `devices.read` | all |
| `GET` | `/api/onvif/{id}/profiles/{profile}/snapshot` | `devices.read` | all |
| `POST` | `/api/onvif/discover` | `devices.write` | all |
| `GET` | `/api/discovery` | `devices.read` | all |
| `GET` | `/api/discovery/{source}/{key}` | `devices.read` | all |
| `POST` | `/api/discovery/{source}/{key}/accept` | `devices.write` | all |
| `POST` | `/api/discovery/{source}/{key}/ignore` | `devices.write` | all |
| `POST` | `/api/discovery/{source}/{key}/unignore` | `devices.write` | all |
| `POST` | `/api/discovery/{source}/{key}/review/apply` | `devices.write` | all |
| `POST` | `/api/discovery/{source}/{key}/review/reject` | `devices.write` | all |
| `GET` | `/api/network-discovery` | `devices.read` | all |
| `GET` | `/api/network-discovery/{key}` | `devices.read` | all |
| `POST` | `/api/network-discovery/{key}/accept` | `devices.write` | all |
| `POST` | `/api/network-discovery/{key}/ignore` | `devices.write` | all |
| `POST` | `/api/network-discovery/{key}/unignore` | `devices.write` | all |
| `POST` | `/api/network-discovery/probe` | `devices.write` | all |
| `GET` | `/api/integrations` | `devices.read` | all |
| `POST` | `/api/integrations/{id}/probe` | `devices.write` | all |
| `POST` | `/api/integrations/{id}/setup` | `devices.write` | all |
| `GET` | `/api/broker/logins` | `users.manage` | all |
| `POST` | `/api/broker/logins` | `users.manage` | all |
| `PUT` | `/api/broker/logins/{name}` | `users.manage` | all |
| `DELETE` | `/api/broker/logins/{name}` | `users.manage` | all |
| `GET` | `/api/mqtt/brokers` | `devices.read` | all |
| `POST` | `/api/mqtt/brokers` | `devices.write` | all |
| `PUT` | `/api/mqtt/brokers/{id}` | `devices.write` | all |
| `DELETE` | `/api/mqtt/brokers/{id}` | `devices.write` | all |
| `GET` | `/api/tags` | `tags.read` | all |
| `POST` | `/api/tags` | `tags.write` | all |
| `DELETE` | `/api/tags/{device}/{name}` | `tags.write` | all |
| `GET` | `/api/values` | `values.read` | all |
| `GET` | `/api/sparkline` | `values.read` | all |
| `GET` | `/api/board` | `values.read` | all |
| `PUT` | `/api/board` | `board.write` | all |
| `POST` | `/api/write` | `values.write` | all |
| `GET` | `/api/history` | `values.read` | all |
| `GET` | `/api/writes` | `values.read` | all |
| `GET` | `/api/entities` | `entities.read` | all |
| `GET` | `/api/entities/composites` | `entities.read` | all |
| `GET` | `/api/entities/{entity_id}` | `entities.read` | all |
| `GET` | `/api/entities/{entity_id}/image` | `entities.read` | all |
| `PUT` | `/api/entities/{entity_id}` | `entities.write` | all |
| `POST` | `/api/entities` | `entities.write` | all |
| `DELETE` | `/api/entities/{entity_id}` | `entities.write` | all |
| `GET` | `/api/states` | `entities.read` | all |
| `GET` | `/api/states/{entity_id}` | `entities.read` | all |
| `GET` | `/api/energy/meters` | `energy.read` | all |
| `POST` | `/api/energy/meters` | `energy.write` | all |
| `GET` | `/api/energy/meters/{id}` | `energy.read` | all |
| `PUT` | `/api/energy/meters/{id}` | `energy.write` | all |
| `DELETE` | `/api/energy/meters/{id}` | `energy.write` | all |
| `GET` | `/api/energy/summary` | `energy.read` | all |
| `GET` | `/api/energy/summary/{period}` | `energy.read` | all |
| `GET` | `/api/energy/series` | `energy.read` | all |
| `GET` | `/api/energy/series/{meter}/{period}/{step}` | `energy.read` | all |
| `POST` | `/api/services/{domain}/{service}` | `values.write`, `alarms.ack`, `helpers.write`, `scripts.run`, `recipes.apply` (in handler) | all |
| `GET` | `/api/helpers` | `entities.read` | all |
| `POST` | `/api/helpers` | `entities.write` | all |
| `GET` | `/api/helpers/{entity_id}` | `entities.read` | all |
| `PUT` | `/api/helpers/{entity_id}` | `entities.write` | all |
| `DELETE` | `/api/helpers/{entity_id}` | `entities.write` | all |
| `GET` | `/api/equipment` | `equipment.read` | all |
| `POST` | `/api/equipment` | `equipment.write` | all |
| `GET` | `/api/equipment/{id}` | `equipment.read` | all |
| `PUT` | `/api/equipment/{id}` | `equipment.write` | all |
| `DELETE` | `/api/equipment/{id}` | `equipment.write` | all |
| `GET` | `/api/labels` | `equipment.read` | all |
| `POST` | `/api/labels` | `equipment.write` | all |
| `GET` | `/api/labels/{label_id}` | `equipment.read` | all |
| `PUT` | `/api/labels/{label_id}` | `equipment.write` | all |
| `DELETE` | `/api/labels/{label_id}` | `equipment.write` | all |
| `PUT` | `/api/devices/{id}/labels` | `equipment.write` | all |
| `GET` | `/api/alarms` | `alarms.read` | all |
| `POST` | `/api/alarms` | `alarms.write` | all |
| `POST` | `/api/alarms/import/codesys` | `alarms.write` | all |
| `DELETE` | `/api/alarms/{id}` | `alarms.write` | all |
| `POST` | `/api/alarms/{id}/ack` | `alarms.ack` | all |
| `POST` | `/api/alarms/{id}/shelve` | `alarms.ack` | all |
| `POST` | `/api/alarms/{id}/unshelve` | `alarms.ack` | all |
| `GET` | `/api/alarms/events` | `alarms.read` | all |
| `GET` | `/api/automations` | `automations.read` | all |
| `POST` | `/api/automations` | `automations.write` | all |
| `POST` | `/api/automations/validate` | `automations.write` | all |
| `DELETE` | `/api/automations/{id}` | `automations.write` | all |
| `POST` | `/api/automations/{id}/enabled` | `automations.write` | all |
| `POST` | `/api/automations/{id}/trigger` | `automations.trigger` | all |
| `GET` | `/api/runs` | `automations.read` | all |
| `POST` | `/api/automations/{id}/blueprint-upgrade` | `blueprints.apply` | all |
| `GET` | `/api/blueprints` | `blueprints.read` | all |
| `POST` | `/api/blueprints` | `blueprints.write` | all |
| `GET` | `/api/blueprints/{id}` | `blueprints.read` | all |
| `PUT` | `/api/blueprints/{id}` | `blueprints.write` | all |
| `DELETE` | `/api/blueprints/{id}` | `blueprints.write` | all |
| `POST` | `/api/blueprints/{id}/instantiate` | `blueprints.apply` | all |
| `GET` | `/api/dashboards` | `dashboards.read` | all |
| `POST` | `/api/dashboards` | `dashboards.write` | all |
| `GET` | `/api/dashboards/{id}` | `dashboards.read` | all |
| `PUT` | `/api/dashboards/{id}` | `dashboards.write` | all |
| `DELETE` | `/api/dashboards/{id}` | `dashboards.write` | all |
| `GET` | `/api/dashboards/{id}/export` | `dashboards.read` | all |
| `POST` | `/api/dashboards/import` | `dashboards.write` | all |
| `GET` | `/api/scripts` | `scripts.read` | all |
| `POST` | `/api/scripts` | `scripts.write` | all |
| `POST` | `/api/scripts/validate` | `scripts.write` | all |
| `GET` | `/api/scripts/{id}` | `scripts.read` | all |
| `PUT` | `/api/scripts/{id}` | `scripts.write` | all |
| `DELETE` | `/api/scripts/{id}` | `scripts.write` | all |
| `POST` | `/api/scripts/{id}/run` | `scripts.run` | all |
| `POST` | `/api/scripts/{id}/stop` | `scripts.run` | all |
| `GET` | `/api/scripts/{id}/runs` | `scripts.read` | all |
| `GET` | `/api/recipes` | `recipes.read` | all |
| `POST` | `/api/recipes` | `recipes.write` | all |
| `POST` | `/api/recipes/capture` | `recipes.write` | all |
| `GET` | `/api/recipes/{id}` | `recipes.read` | all |
| `PUT` | `/api/recipes/{id}` | `recipes.write` | all |
| `DELETE` | `/api/recipes/{id}` | `recipes.write` | all |
| `GET` | `/api/recipes/{id}/versions` | `recipes.read` | all |
| `GET` | `/api/recipes/{id}/versions/{version}` | `recipes.read` | all |
| `POST` | `/api/recipes/{id}/validate` | `recipes.apply` | all |
| `POST` | `/api/recipes/{id}/apply` | `recipes.apply` | all |
| `GET` | `/api/recipes/{id}/applications` | `recipes.read` | all |
| `POST` | `/api/webhook/{path}` | none | all |
| `GET` | `/api/fleet` | `fleet.read` | gateway |
| `POST` | `/api/fleet` | `fleet.write` | gateway |
| `DELETE` | `/api/fleet/{id}` | `fleet.write` | gateway |
| `POST` | `/api/fleet/{id}/rebirth` | `fleet.rebirth` | gateway |
| `POST` | `/api/fleet/{id}/restart` | `fleet.restart` | gateway |
| `POST` | `/api/fleet/{id}/update` | `fleet.update` | gateway |
| `POST` | `/api/fleet/{id}/config` | `fleet.config` | gateway |
| `DELETE` | `/api/fleet/{id}/config` | `fleet.config` | gateway |
| `POST` | `/api/notify/test` | `notify.test` | all |
| `GET` | `/api/notify/escalation` | `notify.escalation` | all |
| `PUT` | `/api/notify/escalation` | `notify.escalation` | all |
| `POST` | `/api/notify/ack/{token}` | none | all |
| `GET` | `/api/backup` | `backup.read` | all |
| `POST` | `/api/backup` | `backup.run` | all |
| `GET` | `/api/reports` | `reports.read` | gateway |
| `POST` | `/api/reports` | `reports.write` | gateway |
| `GET` | `/api/reports/{id}` | `reports.read` | gateway |
| `PUT` | `/api/reports/{id}` | `reports.write` | gateway |
| `DELETE` | `/api/reports/{id}` | `reports.write` | gateway |
| `POST` | `/api/reports/{id}/run` | `reports.run` | gateway |
| `GET` | `/api/reports/{id}/runs` | `reports.read` | gateway |
| `GET` | `/api/reports/{id}/runs/{run}/download` | `reports.read` | gateway |
| `GET` | `/api/sites` | `sites.read` | gateway |
| `GET` | `/api/settings` | `settings.read` | all |
| `PUT` | `/api/settings` | `settings.write` | all |
| `GET` | `/api/destinations` | `settings.read` | all |
| `GET` | `/api/opcua/server` | `users.manage` | all |
| `PUT` | `/api/destinations/{kind}` | `settings.write` | all |
| `GET` | `/api/historian/targets` | `settings.read` | all |
| `POST` | `/api/historian/targets` | `settings.write` | all |
| `PUT` | `/api/historian/targets/{id}` | `settings.write` | all |
| `DELETE` | `/api/historian/targets/{id}` | `settings.write` | all |
| `GET` | `/api/events` | `events.read` | all |
| `GET` | `/api/logbook` | `logbook.read` | all |
| `GET` | `/api/stream` | `status.read` | all |
| 모두 | `/mcp` | MCP 토큰 | all |
| 모두 | `/mcp/` | MCP 토큰 | all |
| `GET` | `/manifest.webmanifest` | none | all |
| `GET` | `/sw.js` | none | all |
| `GET` | `/next` | none | all |
| `GET` | `/next/` | none | all |
| 모두 | `/` | none | all |

## 상태

kubelet과 로드 밸런서를 위한 경로입니다. 둘 다 세션이 필요 없습니다. 프로브에는 계정이 없고, 어느 쪽도 공장에 관해 아무것도 알려 주지 않기 때문입니다.

### `GET /healthz`

Liveness입니다. 프로세스가 HTTP를 처리하는 동안 텍스트 `ok`와 함께 `200`을 응답합니다. 일부러 데이터베이스를 건드리지 않습니다. 데이터베이스 장애는 파드를 순환에서 빼야 하며, 파드를 반복해서 재시작하게 해서는 안 되기 때문입니다.

### `GET /readyz`

Readiness입니다. 5초의 시간 제한으로 데이터베이스에 핑을 보냅니다.

```json
{"status":"ready"}
```

데이터베이스에 닿지 못하면 `503`을 응답하며, 이유는 `detail`에 들어 있습니다(형태는 핸들러가 정하고, 이유 문구는 데이터베이스 드라이버가 한 말 그대로입니다).

```json
{"error":"not ready","detail":"<why the database did not answer>"}
```

히스토리안에 닿지 못하는 애플리케이션은 트래픽을 받아서는 안 됩니다.

## 인증

계정, 역할, 첫 관리자에 관해서는 [인증과 사용자](/ko/iot/authentication/)를 참고하십시오.

### `POST /api/auth/login`

설계상 세션이 필요 없습니다.

| 필드 | 유형 | <span class="sr-only">상세</span> |
|---|---|---|
| `username` | string | 필수. 대소문자와 앞뒤 공백은 무시합니다 |
| `password` | string | 필수 |

```json
{"expiresAt":"2026-09-28T08:21:00.571794Z","permissions":["*"],"role":"admin","token":"<token>","username":"admin"}
```

같은 토큰을 `iiot_session` 쿠키로도 설정합니다. 이름이 틀렸든, 비밀번호가 틀렸든, 계정이 비활성화되었든 똑같이 `401` `"invalid username or password"`를 응답하고 걸리는 시간도 같습니다. 셋 중 어느 쪽인지는 낯선 사람에게 알려 줄 일이 아니기 때문입니다. 계정에 잘못된 비밀번호나 PIN이 연달아 너무 많았다면, 무엇을 보내든 `Retry-After` 헤더와 함께 `429`를 응답합니다. [인증과 사용자](/ko/iot/authentication/#비밀번호와-pin을-틀렸을-때의-잠금)를 참고하십시오.

### `POST /api/auth/kiosk`

[인증과 사용자](/ko/iot/authentication/#키오스크-패널-pin-또는-배지-그리고-유휴-로그아웃)에서 설명하는 방식으로, 공용 패널에서 PIN이나 배지로 로그인합니다. 설계상 세션이 필요 없습니다.

| 필드 | 유형 | <span class="sr-only">상세</span> |
|---|---|---|
| `code` | string | 필수. PIN, 또는 키보드 웨지 배지 리더가 입력한 값입니다. 앞뒤 공백은 무시합니다 |
| `username` | string | 선택. 지정하면 해당 계정의 PIN만 검사하고, 틀리면 그 계정의 잠금 횟수에 들어갑니다. 지정하지 않으면 모든 계정의 코드 중에서 찾습니다 |

```json
{"expiresAt":"2026-10-21T08:21:00.571794Z","idleSec":300,"permissions":["status.read","tags.read"],"role":"operator","username":"olga"}
```

`iiot_session` 쿠키를 설정하며, `POST /api/auth/login`과 달리 토큰을 응답하지 않습니다. 키오스크 세션은 패널의 브라우저에 속하기 때문입니다. `idleSec`은 아무도 만지지 않아도 세션이 유지되는 시간입니다. 코드가 틀렸든, 너무 짧든, 비활성화된 계정의 코드이든 똑같이 `401` `"that PIN or badge isn't recognized"`를 응답하고 걸리는 시간도 같습니다. 계정이 잠겼으면 `Retry-After` 헤더와 함께 `429`를 응답합니다([잠금](/ko/iot/authentication/#비밀번호와-pin을-틀렸을-때의-잠금) 참고). `username` 없이 보낸 코드가 누구와도 일치하지 않으면 어느 계정에도 집계되지 않습니다. 그 코드를 보낸 패널은 클라이언트 주소 기준으로 다음 같은 시도를 검사하기 전에 0.5초씩 더 기다리며 최대 `ui.panelDelaySeconds`까지 늘어나고, 올바른 코드가 들어오면 처음부터 다시 시작합니다. 패널은 잠기지 않습니다. 배포가 로그인 없이 실행 중이면(`HOTLOOP_AUTH_INSECURE`) 로그인할 대상이 없으므로 `400`을 응답합니다.

### `POST /api/auth/activity`

누군가 패널을 만졌다는 신호입니다. 본문은 없습니다. `{"status":"ok"}`. 키오스크 세션에서는 이 호출이 유휴 한도를 뒤로 밀며, 읽기가 아닌 다른 모든 요청(쓰기, 확인)도 마찬가지입니다. `GET`, 라이브 피드, 페이지 자체의 백그라운드 로드는 그렇지 않습니다. 그렇게 하면 마지막 사람이 영원히 로그인된 상태로 남기 때문입니다. 비밀번호로 만든 세션에는 유휴 한도가 없으므로 밀 것도 없습니다.

### `POST /api/auth/logout`

요청이 가져온 세션(쿠키 또는 bearer)을 종료하고 쿠키를 지웁니다. 본문은 없습니다. `{"status":"logged out"}`.

### `GET /api/auth/session`

내가 누구인지 알려 줍니다. UI의 시작 과정에서 사용합니다.

```json
{"authenticated":true,"permissions":["*"],"role":"admin","username":"admin"}
```

키오스크 패널에서 만든 세션에는 유휴 한도(초)인 `"idleSec"`이 추가되며, 페이지는 이것으로 스스로 로그아웃해야 함을 압니다.

인증을 끈 경우(`HOTLOOP_AUTH_INSECURE`)에는 401 대신 `{"authenticated":false,"insecure":true}`를 응답하므로, UI가 추측하지 않고 로그인이 없는 이유를 말할 수 있습니다.

### `POST /api/auth/password`

자신의 비밀번호를 바꿉니다. 권한은 필요 없습니다. 현재 비밀번호를 아는 것이 곧 자격입니다.

| 필드 | 유형 | <span class="sr-only">상세</span> |
|---|---|---|
| `currentPassword` | string | 필수 |
| `newPassword` | string | 필수, 8자 이상 |

`{"status":"password changed; log in again"}`. **이 세션을 포함해 계정의 모든 세션이 종료되고** 쿠키가 지워집니다. 예전 세션이 계속 동작하는 비밀번호 변경은 이름뿐인 변경입니다. 현재 비밀번호가 틀리면 `401`, 새 비밀번호가 너무 짧으면 `400`입니다.

## 사용자

모두 관리자 전용입니다(`users.manage`). 비밀번호 해시는 응답에 절대 나타나지 않으며, 해당 필드에는 JSON 이름이 없습니다.

### `GET /api/users`

```json
[{"username":"admin","role":"admin","disabled":false,"hasPin":false,"locked":false,"createdAt":"2026-09-27T20:19:28.036228Z","updatedAt":"2026-09-27T20:19:28.036228Z","lastLogin":"2026-09-27T20:21:00.575455Z"}]
```

`permissions`는 명시적인 목록이 있는 계정에만 나타납니다. `hasPin`은 계정에 키오스크 PIN이나 배지가 있는지를 알려 주며, 값과 그 해시는 나타나지 않습니다.

### `POST /api/users`

| 필드 | 유형 | <span class="sr-only">상세</span> |
|---|---|---|
| `username` | string | 필수. 소문자, 숫자, 점, 밑줄, 하이픈을 쓰며 글자나 숫자로 시작하고 2자에서 64자까지입니다 |
| `password` | string | 필수, 8자 이상 |
| `role` | string | `admin`, `operator`, `viewer` 중 하나. 기본값은 `viewer`입니다 |
| `permissions` | string[] | 선택. 역할의 권한 집합을 완전히 대체합니다 |

새 사용자를 응답합니다. 이름, 역할, 비밀번호가 잘못되면 `400`, 이름이 이미 쓰이고 있으면 `409`입니다.

### `PUT /api/users/{username}`

| 필드 | 유형 | <span class="sr-only">상세</span> |
|---|---|---|
| `role` | string | `permissions`를 지정하지 않으면 필수 |
| `permissions` | string[] | 선택. 비어 있으면 "역할을 사용"한다는 뜻입니다 |
| `disabled` | bool | `true`이면 계정을 비활성화하고 그 계정의 모든 세션을 종료합니다 |

갱신된 사용자를 응답합니다. 알 수 없는 역할이거나 활성화된 마지막 관리자를 비활성화하려 하면 `400`입니다. 되돌릴 사람이 아무도 남지 않는 잠금이 되기 때문입니다. 알 수 없는 사용자는 `404`입니다.

### `DELETE /api/users/{username}`

`{"status":"deleted"}`. 자기 계정이나 활성화된 마지막 관리자는 `400`, 알 수 없는 사용자는 `404`입니다.

### `POST /api/users/{username}/password`

관리자가 이전 비밀번호를 모르고도 다른 사람의 비밀번호를 설정합니다. `{"password": "..."}`, 8자 이상. `{"status":"password reset"}`을 응답하고 그 계정의 모든 세션을 종료합니다.

### `PUT /api/users/{username}/pin`

관리자가 계정에 키오스크 패널 로그인용 PIN이나 배지 값을 지정하거나, 이미 있는 값을 바꿉니다. `{"code": "482913"}`: 6자에서 72자까지, 공백이나 제어 문자는 안 되고 숫자나 배지 리더가 입력하는 그 밖의 문자를 쓸 수 있습니다. `{"status":"PIN set","username":"olga","hasPin":true}`를 응답합니다. 값은 비밀번호처럼 bcrypt로 해시되며 로그에 남기거나 돌려보내지 않습니다. 코드가 너무 짧거나 길거나 공백이 있거나 다른 계정이 이미 쓰는 코드이면 `400`입니다. 패널은 코드만으로 계정을 찾으므로 코드 하나는 계정 하나만 엽니다. 알 수 없는 사용자는 `404`입니다. 비밀번호나 세션은 건드리지 않습니다.

### `DELETE /api/users/{username}/lockout`

잠긴 계정을 잠금이 풀리기 전에 다시 들어올 수 있게 하고, 잘못된 비밀번호와 PIN의 횟수를 0부터 다시 셉니다. `{"status":"unlocked","username":"olga","locked":false}`. 알 수 없는 사용자는 `404`입니다. 잠긴 계정은 `GET /api/users`에 `"locked":true`와 `"lockedUntil"`이 표시됩니다.

### `DELETE /api/users/{username}/pin`

PIN이나 배지를 없애고, 그 계정이 로그인해 있는 모든 키오스크 패널에서 로그아웃시킵니다. 비밀번호와 자기 컴퓨터에서의 세션은 그대로입니다. `{"status":"PIN cleared","username":"olga","hasPin":false}`. 알 수 없는 사용자는 `404`입니다.

### `GET /api/opcua/certificates`

OPC UA 서버 로그인을 위해 사용자에 연결된 모든 X.509 인증서를 최신순으로 보여 줍니다([OPC UA 서버](/ko/edge/opc-ua-server/#x509-사용자-인증서) 참고). `{"serverAcceptsCertificates":false,"certificates":[...]}`. 각 항목에는 `thumbprint`(DER 형식의 SHA-256, 소문자 16진수), `username`, `label`, `subject`, `notBefore`, `notAfter`, `addedBy`, `addedAt`, 폐기되면 `revokedAt`과 `revokedBy`, 사용되면 `lastUsed`, 그리고 `state`(`active`, `revoked`, `expired`, `not yet valid`)가 있습니다. 활성 인증서만 로그인할 수 있습니다. `serverAcceptsCertificates`는 OPC UA 서버가 켜져 있고 `HOTLOOP_OPCUA_SERVER_ALLOW_X509`가 설정되어 있는지를 나타내며, 인증서는 어느 쪽이든 보관됩니다. 공개 인증서만 저장하거나 전송합니다.

### `GET /api/users/{username}/certificates`

사용자 한 명에 대한 같은 목록입니다. 알 수 없는 사용자는 `404`입니다.

### `POST /api/users/{username}/certificates`

사용자에게 인증서를 연결합니다. `{"certificate": "<PEM text or base64 of the DER bytes>", "label": "Olga's laptop"}`이며 레이블은 선택입니다. 목록에 나오는 형태의 인증서와 함께 `201`을 응답합니다. 인증서는 2048비트 이상의 키를 가진 RSA여야 하고 만료되지 않아야 합니다. `400`은 그중 어느 쪽인지 알려 주며, 인증서가 아닌 것에도 해당합니다. 개인 키는 이름을 들어 거부하며 보관하거나 되돌려주지 않고, 체인도 마찬가지입니다. 알 수 없는 사용자는 `404`입니다. 인증서가 이 사용자든 다른 사용자든 이미 연결되어 있으면 `409`입니다. 인증서 하나는 사람 한 명입니다. 변경은 누가 했는지와 함께 업무 일지에 남습니다.

### `POST /api/users/{username}/certificates/{thumbprint}/revoke`

인증서를 폐기합니다. 더 이상 로그인할 수 없고, 그 인증서로 열린 세션은 권한 캐시의 10초 안에 종료되며, 이후의 시도는 거부되고 폐기됨으로 기록됩니다. 누가 언제 했는지와 함께 `revoked`로 목록에 남으며, 다시 폐기해도 첫 기록이 유지됩니다. `{thumbprint}`는 목록에 나온 SHA-256이며 콜론, 공백, 대문자도 받습니다. 인증서가 이 사용자의 것이 아니면 `404`입니다.

### `DELETE /api/users/{username}/certificates/{thumbprint}`

인증서를 잊습니다. 다시 연결하면 다시 동작합니다. 이 사용자의 것이 아니면 `404`입니다. 사용자를 삭제하면 그 인증서도 삭제됩니다.

## 상태와 진단

### `GET /api/status`

헤더 막대입니다. 런타임 카운터, 알람 요약, 공장 이름, 그리고 이 제품이 무엇인지를 담습니다. `product`는 `iot`, `edge`, `gateway` 중 하나이며 `hotloop --product`와 같습니다. `features`는 제품마다 다른 기능 중 이 제품이 가진 것으로, Gateway는 `edge-publish`, `fleet`, `opcua-server`, `reports`, `sites`, Edge는 첫 번째와 세 번째, IoT는 없음입니다. `version`은 빌드이고, `imageDigest`는 시작한 이미지의 다이제스트로, `:stable`을 따르는 장비에서는 버전 번호로 알 수 없는 정보입니다. 슈퍼바이저가 알려 준 경우에만 있으며(Quadlet 유닛은 매번 시작 전에 알려 주지만, 단독 바이너리와 Helm 설치는 알려 줄 수 없습니다) 그렇지 않으면 생략됩니다.

```json
{
  "alarms": {"critical":0,"high":1,"medium":0,"low":0,"unacked":0,"total":1},
  "features": ["edge-publish","fleet","opcua-server","reports","sites"],
  "plantName": "Demo Plant",
  "product": "gateway",
  "runtime": {
    "startedAt": "2026-09-27T20:19:28.06635851Z", "uptime": "11m13s",
    "devices": 2, "connected": 2, "degraded": 0, "disconnected": 0,
    "tags": 5, "cachedTags": 5, "writesOk": 4, "writesRefused": 3,
    "bus": {"subscribers":4,"published":653,"dropped":0},
    "historian": {"queued":1085,"written":1085,"filtered":329,"dropped":0,"failed":0,"queueLen":0,"queueCap":50000},
    "writePolicy": {"allowWrites":true,"allowMcpWrites":true,"confirmWrites":true},
    "protocols": ["codesys","ethernet-ip","http","modbus","mqtt","mtconnect","opcua","s7comm","snmp","unifi"]
  },
  "siteId": "docs",
  "version": "4.24.0"
}
```

### `GET /api/protocols`

Gateway가 아는 모든 프로토콜과, 이 빌드에 그 드라이버가 있는지를 알려 줍니다.

```json
[{"id":"opcua","name":"OPC UA","description":"The universal one. ...","transport":"opc.tcp binary","defaultPort":4840,"writable":true,"browsable":true,"deviceTypes":["plc","cnc","robot","ipc","hmi","historian","gateway"],"library":"...","available":true}]
```

### `GET /api/diagnostics`

진단 화면이 보여 주는 내용입니다. 데이터베이스 풀, 히스토리안 큐와 이력 크기, 태그 버스, 엔티티 엔진, 업무 일지의 기록기, 런타임, MCP(서버와 나가는 연결), 그리고 자동화 엔진의 활성화된 규칙, 웹훅 경로, 상태 변경 큐입니다.

```json
{
  "automations": {"armed":[],"stateChangesDropped":0,"stateChangesPending":0,"webhooks":[]},
  "bus": {"subscribers":4,"published":654,"dropped":0},
  "database": {"type":"postgres","totalConns":3,"idleConns":3,"acquiredConns":0,"maxConns":10,"historyMode":"timescale","timescaleVersion":"2.30.1"},
  "entities": {"entities":8,"droppedBatches":0,"pendingChanges":0,"droppedChanges":0},
  "historian": {"queued":1087,"written":1085,"filtered":329,"dropped":0,"failed":0,"queueLen":0,"queueCap":50000},
  "historyStats": {"mode":"timescale","rows":996,"distinctTags":5,"oldest":"2026-09-27T20:21:38.609853Z","newest":"2026-09-27T20:30:39.507987Z","sizeBytes":73728},
  "logbook": {"recording":true,"retentionDays":90,"queued":0,"dropped":0,"written":212,"suppressed":36,"writeErrors":0},
  "mcp": {"outbound":[],"path":"/mcp","serverEnabled":true,"tokenSet":true},
  "runtime": {"...": "the same block as /api/status"}
}
```

나가는 MCP 서버가 구성되어 있으면 `outbound`가 각각을 나열합니다.

```json
{"name":"plant-a","target":"http://localhost:8080/mcp","connected":true,"tools":["ack_alarm","call_service","...","write_tag"],"connectedSince":"2026-09-27T20:45:50Z"}
```

나가는 서버의 `target`이나 `lastError`에 있는 자격 증명은 모두 지워집니다. URL이나 명령줄에 토큰이 들어 있을 수 있고 모든 역할이 이것을 읽을 수 있기 때문입니다. MCP 토큰 자체는 항상 `tokenSet`으로만 나옵니다.

## 장치

장치는 하나의 프로토콜로 맺는 하나의 연결입니다. `config`와 `address`에 들어가는 내용은 프로토콜에 따라 다릅니다. [프로토콜과 드라이버](/ko/iot/protocols/)를 참고하십시오.

### `GET /api/devices`

모든 장치와 실시간 연결 상태를 반환합니다. 자격 증명은 `[redacted]`로 표시됩니다. `?q=`는 id, 이름, 주소, 프로토콜에 해당 텍스트가 들어 있는 장치만 남기고(대소문자 구분 없음), `?limit=`(1에서 5000까지, 그 밖의 값은 `400`)는 그중 앞쪽 일부만 남깁니다. 둘 중 하나를 쓰면 `X-Total-Count`가 일치한 개수를 알려 줍니다.

```json
[{"id":"tank-farm","name":"Tank farm","protocol":"mqtt","address":"base-mqtt:1883","enabled":true,
  "site":"Demo Plant","area":"Utilities","equipmentId":4,
  "config":{"clientId":"docs-api-tankfarm","password":"[redacted]","topics":["docs-api-example/#"],"username":"tank","writeTopic":"docs-api-example/{tag}/set"},
  "createdAt":"2026-09-27T20:21:01.637319Z","updatedAt":"2026-09-27T20:21:01.637319Z",
  "state":"connected","lastPoll":"2026-09-27T20:21:39.412Z",
  "latencyMs":0.002,"tagCount":3,"pollCount":1}]
```

`state`는 `connected`, `connecting`, `degraded`(연결은 되어 있으나 폴링이 실패함), `disconnected`, `disabled` 중 하나입니다. `lastError`, `errorCount` 등은 할 말이 있을 때 나타납니다.

### `POST /api/devices`

`id`가 새것이면 장치를 만들고, 아니면 대체합니다. `PUT`은 없습니다.

| 필드 | 유형 | <span class="sr-only">상세</span> |
|---|---|---|
| `id` | string | 필수. 영문자, 숫자, `.`, `_`, `-` 1자에서 64자이며 영문자나 숫자로 시작합니다. URL, MQTT 토픽, MCP 인수에 그대로 들어갑니다 |
| `name` | string | 필수 |
| `protocol` | string | 필수. 이 빌드에 드라이버가 있는 프로토콜(`GET /api/protocols`) |
| `address` | string | 필수. 호스트와 포트, 또는 `opc.tcp://`나 `http://` URL입니다. 프로토콜이 정합니다 |
| `enabled` | bool | 생략하면 `false`입니다 |
| `description` | string | |
| `pollIntervalMs`, `timeoutMs` | int | 0이면 런타임 기본값을 씁니다. 폴링 간격의 하한은 `HOTLOOP_MIN_POLL_INTERVAL`입니다 |
| `site`, `area`, `line` | string | 이름으로 장치를 설비 트리에 배치하며 필요하면 노드를 만듭니다 |
| `equipmentId` | int | 대신 트리의 노드에 배치합니다. 그러면 `site`, `area`, `line`은 노드에서 가져옵니다. [설비 트리와 레이블](/ko/iot/equipment/)을 참고하십시오 |
| `config` | object | 프로토콜 고유의 옵션입니다. 자격 증명은 [쓰기 전용 규칙](#비밀-값은-쓰기-전용입니다)을 따릅니다 |

런타임 필드(`state`, `lastPoll`, `tagCount` 등)는 읽기 전용이며 다시 보내면 무시됩니다. 저장된 장치를 비밀 값을 가려서 응답합니다. 드라이버가 없는 프로토콜, 검증 실패, 자격 증명 규칙 위반이면 `400`입니다. 런타임은 즉시 그 장치로 다시 로드됩니다.

```json
{"error":"no driver for protocol \"profibus\"; this build speaks: ethernet-ip, http, modbus, mqtt, mtconnect, opcua, s7comm, snmp, unifi"}
```

### `GET /api/devices/{id}`

장치와 그 태그, 레이블을 반환합니다.

```json
{"device":{"id":"tank-farm","name":"Tank farm","...":"..."},"labels":["critical"],"tags":[{"id":3,"deviceId":"tank-farm","name":"level","...":"..."}]}
```

태그가 없는 장치의 `tags`는 `[]`입니다. 알 수 없는 id는 `404`입니다.

### `DELETE /api/devices/{id}`

장치와 그 태그, 태그의 엔티티를 삭제합니다. **이력은 보존됩니다.** `{"deleted":"tank-farm"}` 또는 `404`.

### `POST /api/devices/{id}/enabled`

`{"enabled": false}`는 아무것도 삭제하지 않고 폴링만 멈춥니다. `{"enabled":false,"id":"tank-farm"}`를 응답합니다. 알 수 없는 id는 `404`입니다.

### `POST /api/devices/{id}/browse`

장치에 어떤 포인트가 있는지 묻습니다. 읽기만 하므로 `devices.read`만 필요합니다. 본문은 없습니다.

```json
{"supported":true,"tags":[{"name":"Plant_Boiler_Temperature","address":"nsu=http://plant/;s=Temperature","dataType":"float","description":"Temperature","writable":true}]}
```

포인트를 나열할 수 없는 프로토콜(Modbus, S7comm, HTTP)은 `200`과 `{"supported":false,"reason":"..."}`로 응답합니다. 이는 프로토콜에 관한 사실이며 오류가 아닙니다. 장치가 연결되어 있지 않으면 `503`입니다. 여기서 `writable`은 포인트에 대해 장치가 말하는 내용이며, Gateway가 쓸지 여부가 아닙니다.

### `POST /api/devices/{id}/import`

탐색 결과를 구성된 태그로 바꿉니다. 태그를 만들므로 `tags.write`가 필요합니다.

```json
{"tags":[{"name":"Temperature","address":"nsu=http://emberburn/;s=Temperature","dataType":"float","unit":"C"}]}
```

각 항목은 `name`, `address`, `dataType`, `unit`, `description`, `deviceClass`, `writable`(탐색 결과 그대로)을 받습니다. `{"inserted":2,"updated":0}`를 응답합니다. **가져온 태그는 장치가 무엇이라고 했든 모두 읽기 전용입니다.** 발견된 포인트는 누군가 명령해도 된다고 정한 포인트가 아니며, 기본값을 반대로 하면 수천 개가 한꺼번에 활성화되기 때문입니다. 필요한 것만 `POST /api/tags`로 활성화하십시오. 알 수 없는 장치는 `404`입니다.

## UniFi: OT 네트워크, 클라이언트, 그리고 장치가 네트워크의 어디에 있는지

UniFi 사이트에 대한 HotLoop 자체 기록입니다. [UniFi Network](/ko/iot/unifi/)를 참고하십시오. `/api/unifi` 아래의 `{id}`는 UniFi 장치(콘솔 하나의 사이트 하나)입니다. `{network}`는 `GET .../networks`가 주는 그대로의, 콘솔이 네트워크에 붙인 자체 ID입니다. `{mac}`은 일반적인 표기를 모두 받으며 소문자와 콜론 형태로 보관합니다.

**이 호출은 어느 것도 콘솔에 아무것도 묻지 않습니다.** 드라이버가 콘솔에서 마지막으로 읽은 내용을 읽으므로, 화면을 열어 두어도 콘솔에는 부담이 없습니다. 그래서 장치를 한 번 읽기 전에는 `503`으로 응답하고, 콘솔에 로그인하지 않는 `--mcp-stdio` 도우미에서는 항상 그렇게 응답합니다. 이 호출들은 콘솔에 쓰기도 하지 않습니다.

알람을 만들거나 제거하는 변경은 `change`에 그 사실을 알립니다. `{"alarmsCreated":["unifi-unknown-3f2a9c01b7de"]}`. 이는 `/api/alarms` 아래의 일반 알람 정의입니다.

### `GET /api/devices/{id}/network`

HotLoop 장치(PLC, 계량기)가 네트워크의 어디에 있는지 알려 줍니다. 연결된 경우:

```json
{"deviceId":"plc-07","link":{"deviceId":"plc-07","consoleId":"plant-net","mac":"02:48:4c:00:00:07","confirmedBy":"hana","confirmedAt":"2026-09-28T18:02:05Z"},
 "consoleName":"Plant network","client":{"mac":"02:48:4c:00:00:07","ip":"10.77.0.7","switchMac":"00:27:22:e2:1d:6f","switchName":"USW Lite 8 PoE","port":5,"portUp":false,"online":false,"lastSeen":"2026-09-28T18:01:40Z","lastSeenSec":25,"why":"its switch port 5 has no link","...":"..."},
 "readAt":"2026-09-28T18:02:05Z","summary":"on USW Lite 8 PoE port 5, link down; the console last saw it 25s ago; off the network: its switch port 5 has no link","proposals":[]}
```

연결되지 않았으면 `link`는 `null`이고, `proposals`는 HotLoop이 읽는 어느 콘솔이든 그 장치의 IP에 가진 클라이언트를 최신순으로 나열합니다. 제안은 제안일 뿐입니다. 콘솔의 IP는 뒤처지므로, 관리자가 하나를 확인하기 전에는 아무것도 연결되지 않습니다.

### `PUT /api/devices/{id}/network`

`{"consoleId":"plant-net","mac":"02:48:4c:00:00:07"}`은 장치가 어느 클라이언트인지 확인합니다. 그때부터는 MAC이 키이고 IP는 더 이상 신뢰하지 않습니다. 클라이언트에는 태그(콘솔의 `c.<mac>.*`)와 알람 "PLC-07 네트워크 이탈"이 생기며, 우선순위 1에 온 딜레이 120초라서 재부팅으로는 누구도 호출되지 않습니다. `{"link":{...},"change":{...}}`를 응답합니다. `consoleId`가 UniFi 장치가 아니거나 MAC이 MAC이 아니면 `400`, 알 수 없는 장치는 `404`입니다.

### `DELETE /api/devices/{id}/network`

연결과, 그 연결을 위해 HotLoop이 만든 알람을 제거합니다. 단, 클라이언트가 알려진 목록으로 계속 감시되는 경우 알람은 남습니다. 연결이 없었으면 `404`입니다.

### `GET /api/unifi/{id}/networks`

콘솔이 가진 사이트의 네트워크를 HotLoop의 기록과 함께 반환합니다. `ot`, `known`(목록에 있는 장치 수), `clients`(지금 그 네트워크에 있는 수), `unknown`(지금 있지만 목록에 없는 수)입니다. HotLoop에는 기록이 있지만 콘솔에는 더 이상 없는 네트워크는 `"onConsole":false`로 돌아옵니다.

```json
[{"networkId":"6abb23d25a95f2636a5df29c","name":"SCADA","purpose":"corporate","vlan":122,"subnet":"10.122.0.1/24","onConsole":true,"ot":true,"clients":2,"known":1,"unknown":[{"mac":"02:9b:b1:69:88:f2","ip":"10.122.0.66","switchName":"USW Lite 8 PoE","port":6,"...":"..."}],"changedBy":"hana"}]
```

### `PUT /api/unifi/{id}/networks/{network}`

`{"ot": true}`는 네트워크를 OT로 표시합니다. 그 네트워크에 있으면서 알려진 목록에 없는 모든 것은 `n.<network>.unknown`에 집계되고 `.unknown_last`에 자기 이름을 밝히며, HotLoop이 알람 "SCADA의 알 수 없는 장치"를 우선순위 1로 만듭니다. `{"ot": false}`는 표시를 해제하고 그 알람을 제거하며, 알려진 목록은 유지됩니다. WAN이거나 콘솔에 없는 네트워크는 `400`입니다.

### `POST /api/unifi/{id}/networks/{network}/accept-all`

지금 네트워크에 있는 모든 것을 있는 그대로 수락합니다. 네트워크를 표시한 뒤 한 번만 누르면 됩니다. 이미 목록에 있는 장치는 이름과 감시 설정을 유지합니다. 본문은 없습니다. 추가된 장치들인 `{"accepted":[{known device}...]}`를 응답합니다.

### `GET /api/unifi/{id}/known`

사이트 네트워크의 알려진 모든 장치입니다. `[{"deviceId":"plant-net","networkId":"...","mac":"...","name":"PLC-07","watch":true,"acceptedBy":"hana","acceptedAt":"..."}]`.

### `PUT /api/unifi/{id}/networks/{network}/known/{mac}`

`{"name":"PLC-07","watch":true}`는 장치를 네트워크에 수락하거나 이름 또는 감시 설정을 바꿉니다. `watch`는 장치에 태그와 오프라인 알람을 줍니다. 허용은 되지만 오가는 장치(유지보수용 노트북)는 이를 끄고 수락합니다. 네트워크를 OT로 표시한 적이 없으면 `400`입니다.

### `DELETE /api/unifi/{id}/networks/{network}/known/{mac}`

장치를 목록에서 제거합니다. 그 장치가 네트워크에 있으면 다음 읽기에서 다시 알 수 없는 장치가 됩니다.

### `GET /api/unifi/{id}/clients`

콘솔이 나열하는 모든 클라이언트와, 콘솔은 나열하지 않지만 감시 중인 모든 클라이언트를 반환하며, 각각 위치, 온라인 여부, `ot`, `known`, `watched`, `linkedTo`, 한 줄짜리 `summary`를 포함합니다. `?q=`는 MAC, IP, 이름으로 좁힙니다.

### `GET /api/unifi/consoles`

UniFi 화면의 선택기를 위해 HotLoop이 가진 모든 UniFi 장치를 실행 중이든 아니든 반환합니다. `[{"id":"plant-net","name":"Plant network","address":"https://...","enabled":true,"running":true,"site":"default","version":"10.6.106","readAt":"...","devices":4,"online":4,"clients":12,"failover":false,"eventsLive":true}]`. 이 프로세스가 읽지 않은 콘솔은 `why`에 이유를 알려 줍니다.

### `GET /api/unifi/{id}/overview`

개요 카드입니다. 장치 수와 클라이언트 수(클라이언트는 콘솔이 나열할 때가 아니라 HotLoop이 네트워크에 있다고 판단할 때 집계되며, `n.<id>.clients` 태그가 쓰는 기준입니다), 네트워크별 클라이언트, 콘솔의 서브시스템 `health`, 그리고 각 게이트웨이의 WAN 띠인 `gateways[]`를 담습니다. 이는 WAN마다 `wans[]` 항목 하나이며 `alive`(게이트웨이 자체의 상태 점검이며 WAN 블록의 `up`이 아님), `known`, `active`, `backup`, 지연 시간, 가용성을 가집니다. `failover`는 첫 번째가 아닌 WAN에서 트래픽이 흐르는 상태, `down`은 살아 있는 WAN이 없는 상태이고, `since`는 HotLoop이 지금 쓰는 WAN에서 처음 트래픽을 본 읽기 시점으로, 게이트웨이가 전환한 때가 아니라 HotLoop이 알아차린 때입니다. `events`는 이벤트 웹소켓의 상태(`live`, `error`, `reconnects`)와 최신 이벤트 열 개입니다.

### `GET /api/unifi/{id}/topology`

지도입니다. `nodes[]`는 채택된 장치와 그리드상의 위치(`x`, `y`, `layer`: 게이트웨이에서 왼쪽에서 오른쪽으로, 같은 읽기에는 같은 방식으로 배치), `edges[]`는 콘솔 자체의 `downlink_table`에서 가져온 장치 간 케이블, `wired[]`와 `wifi[]`는 각 스위치 포트와 각 AP, SSID에 매달린 클라이언트입니다. 어디에도 연결된 것으로 나열되지 않은 장치는 추측으로 게이트웨이에 매달지 않고 `noUplink`를 설정해 따로 그립니다. HotLoop이 읽는 다른 UniFi 콘솔의 장치를 이 콘솔이 클라이언트로 나열하면 `external`을 설정한 노드와 `stitched`가 있는 간선으로 이어 붙입니다. `feeds`는 장치 MAC별로, 그 장치 아래쪽의 클라이언트에 연결된 HotLoop 장치와 설비 트리용 `equipmentId`이며, `links`는 같은 장치를 클라이언트 MAC별로 나타낸 것입니다.

### `GET /api/unifi/{id}/devices`

채택된 모든 장치를 수치와 전면 패널용 `ports[]`와 함께 반환합니다. 링크, 속도, PoE 모드와 사용량, 포트에서 학습한 클라이언트, 포트에 연결된 장치, 그리고 이전 읽기에서는 올라와 있었지만 지금은 내려간 포트의 `dropped`가 들어 있습니다. 콘솔이 놓친 장치는 마지막으로 보고한 내용이 최신이 아니므로 수치와 포트 링크를 보고하지 않습니다.

### `GET /api/unifi/{id}/wifi`

사이트의 SSID를 `enabled`, 속한 네트워크, 각 SSID의 클라이언트 수와 함께 반환합니다. 콘솔이 이 계정에 무선 네트워크를 보여 주지 않으면 `error`가 이유를 알려 주고 `wlans`는 비어 있습니다.

### `GET /api/unifi/{id}/events`

HotLoop이 연결된 이후 콘솔이 보고한 최신 이벤트를 최신순으로(`?limit=` 최대 200, 기본값 50), 그리고 이벤트 웹소켓의 상태를 반환합니다. 각 이벤트에는 컨트롤러의 `key`(`EVT_SW_Lost_Contact`), 자체 `message`, `severity`(컨트롤러가 문제 발생으로 표시하면 `warning`), 그리고 관련된 장치, 클라이언트, 포트가 있습니다. 이 이벤트는 업무 일지에도 해당 스위치나 액세스 포인트 아래로 분류되어 남습니다([UniFi Network](/ko/iot/unifi/#이벤트) 참고).

### `POST /api/unifi/{id}/starter-alarms`

콘솔이 지금 가진 정보로 사이트의 일반적인 알람을 `/api/alarms` 아래의 일반 알람 정의로 만듭니다. 오프라인인 모든 채택 장치(우선순위 2, 온 딜레이 60초), 내려간 모든 업링크 포트(우선순위 1, 10초), WAN이 둘 이상인데 예비 WAN으로 동작하는 게이트웨이(우선순위 2, 30초)입니다. 본문은 선택입니다. `{"poeLimitW": 25}`는 모든 PoE 포트의 `poe_w` 사용량이 해당 와트를 넘는 경우에 대한 우선순위 3 알람을 온 딜레이 30초로 추가합니다. 콘솔은 포트의 허용량을 알려 주지 않으므로 HotLoop은 추측하지 않습니다. 음수 한도는 `400`입니다.

```json
{"created":[{"id":"unifi-devoffline-9c1e2a77b3d0","name":"USW Lite 8 PoE offline","kind":"offline","tag":"d.002722e2e633.online","priority":2}],
 "kept":[]}
```

`kept`는 이 기능이 요구하는 알람 중 이미 있던 것입니다. 이전에 눌렀을 때 자신이 만든 것이거나, 같은 태그에 누군가 만든 알람입니다. 그래서 장비를 더 채택한 뒤 다시 눌러도 안전하며, 새 장비에 대한 것만 추가됩니다. OT 네트워크 알람과 네트워크 이탈 알람은 여기에 포함되지 않습니다. 이들은 네트워크를 OT로 표시하고 장치를 감시할 때 함께 생깁니다. 콘솔을 한 번 읽기 전에는 `503`입니다.

### `GET /api/unifi-protect/{id}/cameras/{camera}/snapshot`

Protect 카메라의 현재 이미지이며 JPEG입니다(`Content-Type: image/jpeg`, `Cache-Control: no-store`). 요청할 때 콘솔에서 가져오며, 스스로 요청을 보내는 유일한 UniFi 라우트입니다. `{id}`는 프로토콜이 `unifi-protect`인 장치이고 `{camera}`는 콘솔이 카메라에 붙인 ID입니다(`cam.<id>.online` 태그의 `<id>`). 장치가 연결된 Protect 장치가 아니면 `404`, 카메라가 오프라인이거나 콘솔이 키를 거부하면 콘솔이 알려 준 사유와 함께 `502`를 반환합니다. [프로토콜과 드라이버](/ko/iot/protocols/#unifi-protect)를 참조하십시오.

### `GET /api/onvif/{id}/profiles/{profile}/snapshot`

ONVIF 카메라 프로필의 현재 이미지이며 JPEG입니다(`Content-Type`은 카메라가 보낸 그대로, `Cache-Control: no-store`). 요청할 때 카메라에서 가져오며, 카메라 자체의 로그인을 사용합니다. `{id}`는 프로토콜이 `onvif`인 장치이고 `{profile}`은 카메라가 미디어 프로필에 붙인 토큰입니다(`profile.<token>.snapshot_uri` 태그의 `<token>`). 장치가 연결된 ONVIF 장치가 아니면 `404`, 카메라가 이미지를 주지 않으면 카메라가 알려 준 사유와 함께 `502`를 반환합니다. ONVIF.md를 참조하십시오.

### `POST /api/onvif/discover`

네트워크에서 ONVIF 카메라를 탐색하고(WS-Discovery, 모든 인터페이스에서 멀티캐스트 탐색) 응답한 카메라마다 `endpoint`, `xaddrs`, 추가할 때 쓸 `address`, 카메라의 scopes가 알려 주는 `name`, `hardware`, `location`, `profiles`를 담아 `{"cameras":[...]}`로 응답합니다. `?wait=`는 대기할 초이며 1에서 15, 기본값은 3입니다. 아무것도 추가하지 않으며, 사람이 프로토콜 `onvif` 장치로 카메라를 추가합니다.

## MQTT 디스커버리

MQTT로 스스로를 알린 장치와, 각 장치에 대해 사람이 내린 결정입니다. [MQTT 디스커버리](/ko/iot/mqtt-discovery/)를 참고하십시오. 디스커버리는 내장 브로커가 실행 중이면 거기서, 그리고 `/api/mqtt/brokers` 아래에 설정된 모든 브로커에서 수신합니다. 둘 다 없으면 `sources`는 비어 있습니다. 수신하지 않는 `--mcp-stdio` 도우미에서는 `GET /api/discovery`가 `{"running":false,"sources":[],"devices":[]}`로 응답하고 다른 모든 경로는 `503`입니다.

`{source}`는 장치가 알림을 보낸 브로커입니다(HotLoop 자체 브로커는 `embedded`, 그 외에는 브로커의 id). `{key}`는 그 장치의 알림을 하나로 묶는 값으로, 첫 번째 식별자, `mac:aa:bb:cc:dd:ee:ff` 형태의 MAC, 또는 노드 id입니다. URL 인코딩하십시오. 식별자에는 경로가 허용하지 않는 문자가 들어 있습니다.

**이 호출은 어느 것도 활성화하지 않습니다.** 장치를 수락하면 그 포인트를 다른 포인트와 마찬가지로 `POST /api/tags`로 하나씩 활성화할 수 있게 됩니다.

### `GET /api/discovery`

모든 소스와 그 소스가 보고 거부한 것, 그리고 발견된 모든 장치를 반환합니다.

```json
{"running":true,"sources":[{"id":"embedded","name":"the embedded broker","prefix":"homeassistant","listening":true,"connected":true,
  "received":42,"dropped":0,"refused":0,"problems":[],"autoCreate":true,"anonymousAllowed":false,
  "external":false,"listenOnly":false,"enabled":true}],
 "devices":[{"source":"embedded","deviceKey":"plug-0001","deviceId":"kitchen-plug","status":"discovered",
  "device":{"identifiers":["plug-0001"],"name":"Kitchen Plug","manufacturer":"Acme","model":"P1","swVersion":"1.0.0"},
  "origin":{"name":"test-publisher","swVersion":"0.1"},"firstSeen":"2026-10-02T09:12:04Z","lastSeen":"2026-10-02T09:12:04Z",
  "components":[{"key":"plug-0001-relay","component":"switch","name":"Relay","configTopic":"homeassistant/switch/plug-0001/relay/config",
   "stateTopic":"plug/relay","commandTopic":"plug/relay/set","commandTopics":["plug/relay/set"],"tag":"relay",
   "unsupported":[],"unknownKeys":[],"flags":[]}]}]}
```

`external`이 true인 소스는 `/api/mqtt/brokers` 아래에 설정된 브로커이며, `broker`가 그 위치를 알려 줍니다. `autoCreate`가 false인 소스는 장치가 수신함에서 기다립니다. `deviceId` 없이 `discovered`로 나열되며, 누군가 하나를 수락하기 전에는 아무것도 만들어지지 않고 읽히지도 않습니다. `listenOnly`는 HotLoop이 절대 발행하지 않는 브로커입니다. `lastError`는 소스가 연결되지 않은 이유를 알려 주며, 열 수 없는 비밀번호도 포함합니다.

`status`는 `discovered`, `accepted`, `ignored` 중 하나입니다. 컴포넌트별로 `unsupported`는 HotLoop이 쓸 수 없는 것과 그 이유("value template not supported: filter `regex_findall_index` is not supported at column 12"), `unknownKeys`는 형식이 정의하지 않는 구성 키, `commandTopics`는 명령이 갈 수 있는 모든 토픽(팬의 속도 토픽과 주 토픽), `flags`는 수락하기 전에 사람이 살펴봐야 할 것을 나열합니다. 컴포넌트가 읽는 토픽 밖에 있거나, 디스커버리 접두사 안에 있거나, 다른 장치가 점유한 명령 토픽, 그리고 retained 명령을 요구하는 구성입니다. `withdrawnAt`은 게시자가 철회한 컴포넌트에 설정됩니다. `suggestedEquipmentId`는 정확히 한 노드만 그 이름을 가질 때, 장치의 `suggested_area`가 가리키는 트리 노드이며, 수락 대화상자를 미리 채우기만 합니다. 내장 브로커에서 `announcedBy`와 `announcedVia`는 최신 구성을 발행한 브로커 로그인과 클라이언트 id이고, `acceptedLogin`은 수락된 로그인입니다. 수락된 장치의 알림이 바뀌었거나 다른 로그인이 알린 경우 `review`가 있습니다.

```json
{"hash":"9a1c...","summary":["plug-0001-power: unit changed"],
 "changes":[{"key":"plug-0001-power","kind":"changed","fields":[{"field":"unit","running":"W","announced":"kW"}]}]}
```

### `GET /api/discovery/{source}/{key}`

같은 형태로 장치 하나를 반환합니다. HotLoop이 본 적 없는 장치는 `404`입니다.

### `POST /api/discovery/{source}/{key}/accept`

장치를 수락합니다. 선택 본문 `{"equipmentId": 12}`는 같은 단계에서 장치를 트리에 배치합니다. 아무것도 활성화하지 않습니다. 장치를 응답합니다. 무시된 장치는 `400`입니다.

### `POST /api/discovery/{source}/{key}/ignore`

장치를 버립니다. HotLoop 장치와 태그, 엔티티가 사라지고(이력은 남음), 다시 알려도 무시된 상태로 남습니다. 장치를 응답합니다. 발견된 장치에 대한 `DELETE /api/devices/{id}`도 같은 일을 합니다. 계속 알리는 장치는 그냥 돌아오기 때문입니다.

### `POST /api/discovery/{source}/{key}/unignore`

무시된 장치를 마지막으로 알린 내용으로 발견된 상태로 되돌립니다. 무시된 상태가 아니면 `400`입니다.

### `POST /api/discovery/{source}/{key}/review/apply`

수락된 장치가 알린 내용대로 동작하게 합니다. 각 포인트의 활성화 여부는 그대로입니다. 검토를 기다리는 것이 없으면 `400`입니다.

### `POST /api/discovery/{source}/{key}/review/reject`

수락된 구성을 계속 실행하고 이 변경을 더 이상 제안하지 않습니다. 이후의 다른 변경은 다시 제안됩니다. 기다리는 것이 없으면 `400`입니다.

검토는 누가 알렸는지에 관한 것일 수도 있습니다. `"kind":"publisher"`인 변경과 요약 줄 "announced by login garage-node; accepted from kitchen-node"가 그 예입니다. 이를 적용하면 그 로그인이 장치를 수락한 로그인이 됩니다.

## 브로커 로그인

HotLoop에서 만든 내장 브로커의 로그인으로, 각각 발행하고 구독할 수 있는 토픽이 지정됩니다. [내장 MQTT 브로커](/ko/iot/broker/)를 참고하십시오. 로그인은 공장 전체 브로커의 열쇠이므로 이 호출은 관리자의 `users.manage`입니다. 여기서는 비밀번호나 그 해시를 절대 응답하지 않습니다. 모든 변경은 로그에 남고 클라이언트의 다음 발행부터 적용되며, 다시 연결할 필요는 없습니다.

### `GET /api/broker/logins`

```json
{"running":true,"anonymous":false,"prefix":"homeassistant","envLogins":["plant"],
 "profiles":[{"name":"shelly","about":"a Shelly Gen2 or later; name the login after its MQTT topic prefix",
   "publish":["%u/#","shellies/announce"],"subscribe":["%u/#","shellies/command","%p/status"]}],
 "logins":[{"name":"kitchen-node","profile":"esphome","publish":["%u/#","%p/+/%u/+/config","esphome/discover/%u"],
   "subscribe":["%u/#","%p/status","esphome/discover"],"createdBy":"admin","createdAt":"2026-10-02T09:12:04Z",
   "updatedAt":"2026-10-02T09:12:04Z","resolvedPublish":["kitchen-node/#","homeassistant/+/kitchen-node/+/config",
   "esphome/discover/kitchen-node"],"resolvedSubscribe":["kitchen-node/#","homeassistant/status","esphome/discover"]}]}
```

이 프로세스가 브로커를 실행하지 않으면 `running`은 false입니다. 로그인은 그래도 보관되며 브로커가 시작할 때 읽습니다. `envLogins`는 `HOTLOOP_BROKER_USERS`의 이름으로, 무엇이든 할 수 있습니다. 규칙의 `%u`는 로그인 자신의 이름, `%p`는 디스커버리 접두사이며, `resolved*`는 둘을 채운 규칙입니다.

### `POST /api/broker/logins`

```json
{"name":"kitchen-node","password":"a-long-random-password","profile":"esphome"}
```

`name`은 영문자, 숫자, `-`, `_` 1자에서 64자입니다(토픽의 `%u`를 대신합니다). `password`는 12자 이상입니다. `profile`이 규칙을 채우고, `publish`와 `subscribe`를 주면 규칙을 대체합니다. 둘 중 하나는 필요합니다. 규칙은 MQTT 토픽 필터입니다. `+`와 `#`은 레벨 전체로만, `#`은 맨 끝에만 쓸 수 있고 `$` 토픽은 안 됩니다. 로그인을 담아 `201`로 응답하며, 위의 문제나 `HOTLOOP_BROKER_USERS`에 이미 있는 이름이면 `400`, 이미 쓰는 이름이면 `409`입니다.

### `PUT /api/broker/logins/{name}`

`profile`, `publish`, `subscribe`, `password` 중 어느 것이든 보낼 수 있으며, 보내지 않은 것은 유지됩니다. 로그인을 담아 `200`, 없는 로그인은 `404`입니다.

### `DELETE /api/broker/logins/{name}`

`200` `{"deleted":"kitchen-node"}`. 그 로그인으로 아직 연결된 클라이언트는 이후 아무것도 할 수 없고 다시 연결할 수도 없습니다. 없는 로그인은 `404`입니다.

## 네트워크 디스커버리

mDNS, SSDP, DHCP로 공장 네트워크에서 들린 장치와, 각 장치에 대해 사람이 내린 결정입니다. [네트워크 디스커버리](/ko/iot/network-discovery/)를 참고하십시오. 수신하지 않는 `--mcp-stdio` 도우미에서는 `GET /api/network-discovery`가 `{"running":false,"finds":[]}`로 응답하고 다른 모든 경로는 `503`입니다.

`{key}`는 발견물이 어떻게, 누구에게 들렸는지를 나타냅니다. `mdns:`와 mDNS 호스트 이름, `ssdp:`와 UPnP uuid, `dhcp:`와 MAC입니다. URL 인코딩하십시오.

**이 호출은 어느 것도 활성화하지 않으며**, 누군가 수락하기 전에는 아무것도 추가되지 않습니다.

### `GET /api/network-discovery`

리스너, 프로빙, 리스너가 있는 인터페이스, 그리고 모든 발견물을 반환합니다.

```json
{"running":true,
 "status":{"leading":true,"interfaces":["eth0 10.20.0.15/24"],
  "listeners":[{"name":"mdns","enabled":true,"listening":true,"heard":120,"dropped":0,"refused":0},
   {"name":"ssdp","enabled":true,"listening":true,"heard":14,"dropped":0,"refused":0},
   {"name":"dhcp","enabled":false,"listening":false,"heard":0,"dropped":0,"refused":0}],
  "probe":{"networks":[]}},
 "finds":[{"key":"mdns:line3-ua.local","via":"mdns","kind":"opcua","name":"line3-ua","status":"discovered",
  "firstSeen":"2026-10-11T14:02:11Z","lastSeen":"2026-10-11T14:07:40Z",
  "find":{"key":"mdns:line3-ua.local","via":"mdns","kind":"opcua","name":"line3-ua",
   "summary":"OPC UA server, capabilities DA","host":"line3-ua.local","addresses":["10.20.0.31"],
   "services":[{"type":"_opcua-tcp._tcp.local","instance":"line3-ua._opcua-tcp._tcp.local","port":50000,
    "txt":{"caps":"DA","path":"/"}}],
   "proposal":{"protocol":"opcua","address":"opc.tcp://10.20.0.31:50000/","how":"Accepting makes an OPC UA device..."},
   "heard":"2026-10-11T14:07:40Z"}}]}
```

`kind`는 `esphome`, `shelly`, `opcua`, `mqtt-broker`, `web`, `mdns`(HotLoop이 이름을 모르는 무언가를 알림), `upnp`, `dhcp` 중 하나입니다. `proposal`에 `protocol`이 있는 발견물은 수락하면 `address`의 해당 프로토콜 장치가 되고, 없는 발견물은 `how`에서 무엇이 들여오게 하는지 알려 줍니다. `also`는 같은 장비인 다른 발견물과 MQTT로 발견된 장치를 MAC이나 주소로 나열합니다. `status`는 `discovered`, `accepted`, `ignored` 중 하나이며 `deviceId`는 수락으로 만들어진 장치입니다. 리스너의 `error`는 수신하지 않는 이유를 알려 줍니다(67번 포트가 사용 중이거나 허용되지 않음, 멀티캐스트 인터페이스 없음). `refused`는 기록이 가득 차서 버려진 새 발견물의 수입니다.

### `GET /api/network-discovery/{key}`

같은 형태로 발견물 하나를 반환합니다. HotLoop이 듣지 못한 것은 `404`입니다.

### `POST /api/network-discovery/{key}/accept`

발견물을 수락합니다. 선택 본문 `{"equipmentId": 12}`는 만들어진 장치를 트리에 배치합니다. HotLoop에 드라이버가 있는 발견물은 제안된 주소의 장치가 되며, 활성화되고 태그는 없고 아무것도 활성화되지 않은 상태입니다. 그 밖의 발견물은 알려진 것으로 기록될 뿐 아무것도 만들지 않습니다. 발견물을 응답합니다. 이미 수락되었거나 무시된 것은 `400`입니다.

### `POST /api/network-discovery/{key}/ignore`

아무도 결정하지 않은 발견물을 숨기고, 다시 들려도 숨겨 둡니다. 이미 결정된 것은 `400`입니다.

### `POST /api/network-discovery/{key}/unignore`

무시된 발견물을 다시 결정 대상으로 되돌립니다. 무시된 상태가 아니면 `400`입니다.

### `POST /api/network-discovery/probe`

지금 프로브합니다. `HOTLOOP_NETDISC_PROBE_NETWORKS`에 나열된 네트워크의 모든 인터페이스에서 mDNS 쿼리와 SSDP 검색을 보내며, 다른 곳에는 보내지 않습니다. `{"status": ...}`를 응답하고 나가지 않은 것은 `status.probe.lastError`에 나옵니다. 프로빙이 켜진 네트워크가 없으면 `400`입니다. 이 버튼은 프로빙을 켤 수 없고, 배포만 켤 수 있습니다.

## 통합

사람이 HotLoop을 향하게 하는 장치 종류의 구성 흐름입니다. 통합에 필요한 것을 묻고, 답으로 실제 장치를 살펴보고, 발견한 내용으로 장치와 태그를 만듭니다. [통합](/ko/iot/integrations/)을 참고하십시오.

**여기서는 어느 것도 활성화하지 않습니다.** 설정이 만드는 모든 태그는 읽기 전용입니다. 활성화는 다른 포인트와 마찬가지로 `POST /api/tags`입니다.

### `GET /api/integrations`

이 빌드에 있는 모든 통합과 그 통합이 묻는 질문을 반환합니다.

```json
[{"id":"opcua","name":"OPC UA server","description":"A PLC, CNC, gateway or SCADA server ...",
  "protocol":"opcua","addressLabel":"Endpoint","addressPlaceholder":"opc.tcp://192.168.1.20:4840","writable":true,
  "fields":[{"key":"securityMode","label":"Security","kind":"choice","required":false,"default":"None",
             "choices":[{"value":"None","label":"None"},{"value":"Sign","label":"Sign"}]},
            {"key":"password","label":"Password","kind":"secret","required":false}]}]
```

`kind`는 `text`, `number`, `bool`, `choice`, `secret` 중 하나입니다. `showWhen`이 있는 필드(`{"version":["3"]}`)는 다른 답이 그 값 중 하나일 때만 묻고, 표시되지 않는 질문에 대한 답은 무시됩니다.

### `POST /api/integrations/{id}/probe`

답을 확인하고 실제 장치를 살펴보러 갑니다. 아무것도 저장하지 않습니다.

```json
{"address":"opc.tcp://192.168.1.20:4840","options":{"securityMode":"None"}}
```

`{"integration":"opcua","address":"opc.tcp://192.168.1.20:4840","found":{...}}`를 응답합니다. `address`는 통합이 해석한 주소입니다. `found`에는 `name`(장치가 스스로 부르는 이름), `identity`(장치가 자신이라고 말하는 것), `notes`(수락하기 전에 알아야 할 것), `points`가 있으며, 각 포인트는 태그 형태 `{name, address, dataType, unit, description, writable, deviceClass}`에 `group`, `sample`(발견 시 읽은 값), `suggested`가 더해진 것입니다.

질문에 맞지 않는 답은 모든 문제를 한꺼번에 담아 `400`이며, 통합이 묻지 않는 질문에 대한 답도 무시되지 않고 `400`입니다. 장치가 응답하지 않았거나 자기 프로토콜이 아닌 것으로 응답했으면 무엇이 잘못되었는지와 함께 `502`입니다. 이 빌드에 없는 통합은 `404`입니다. 비밀 값은 응답이나 오류에 절대 들어 있지 않습니다.

### `POST /api/integrations/{id}/setup`

장치를 다시 살펴본 뒤 장치와 태그를 만듭니다. 본문은 probe의 본문에 다음을 더한 것입니다.

| 필드 | 의미 |
|---|---|
| `deviceId` | 새 장치의 id입니다. 비워 두면 이름에서 만듭니다. 이미 가진 장치가 있으면 `400`입니다 |
| `name` | 장치의 이름입니다. 비워 두면 장치가 스스로 부르는 이름을 씁니다 |
| `points` | 설정할 `found.points`의 이름입니다. 비워 두면 `suggested`로 표시된 것을 씁니다. 장치에 없는 이름은 `400`입니다 |
| `site`, `area`, `line` | `POST /api/devices`와 같이 설비 트리에서 놓일 위치입니다 |

포인트는 클라이언트가 1분 전에 찾았다고 말한 내용이 아니라 지금 장치의 상태와 대조해 검사합니다. `{"device":{...},"tags":3,"entities":["sensor.plc_sim_..."],"notes":[]}`를 응답합니다. 장치는 활성화되어 폴링 중이고, 모든 태그는 읽기 전용이며, 각 태그에는 읽기 엔티티가 있습니다. 도중에 실패한 설정은 장치를 남기지 않습니다.

## MQTT 브로커

HotLoop 자체 브로커가 아닌, 디스커버리가 수신하는 브로커입니다. 공장의 Mosquitto나 Zigbee2MQTT 장비가 가져온 브로커 등입니다. [MQTT 디스커버리](/ko/iot/mqtt-discovery/#다른-브로커)를 참고하십시오. 비밀번호는 장치 자격 증명 키(`HOTLOOP_SECRET_KEY_FILE`)로 봉인되며 응답으로 돌려주지 않습니다. `passwordSet`은 저장된 것이 있는지, `passwordProblem`은 저장된 것을 열 수 없는 이유를 알려 줍니다. 모든 변경은 로그에 남고 즉시 적용되며, 그 브로커의 리스너와 장치가 다시 연결됩니다.

### `GET /api/mqtt/brokers`

```json
{"secretKey":true,
 "brokers":[{"id":"plant-uns","name":"Plant UNS","broker":"tcp://10.20.0.5:1883","username":"hotloop","useTls":false,
   "insecureSkipVerify":false,"prefix":"homeassistant","listenOnly":true,"autoCreate":false,"tasmota":true,"shelly":true,"enabled":true,
   "createdBy":"admin","passwordSet":true,"createdAt":"2026-10-03T09:12:04Z","updatedAt":"2026-10-03T09:12:04Z"}]}
```

`secretKey`는 이 HotLoop에 비밀번호를 봉인할 키가 있는지를 나타냅니다.

### `POST /api/mqtt/brokers`

```json
{"id":"plant-uns","name":"Plant UNS","broker":"tcp://10.20.0.5:1883","username":"hotloop",
 "password":"...","listenOnly":true}
```

`id`는 소문자, 숫자, `-` 1자에서 63자이며 `embedded`는 안 됩니다. 이 브로커에서 온 모든 장치에서 브로커를 가리키는 이름이므로 바꿀 수 없습니다. `broker`는 `host:port` 또는 `tcp://`, `ssl://`, `tls://`, `mqtt://`, `mqtts://` URL이며 로그인은 포함하지 않습니다. `prefix`의 기본값은 `homeassistant`, `autoCreate`는 false(장치가 수신함에서 기다림), `listenOnly`는 false, `tasmota`(Tasmota 자체의 디스커버리 `tasmota/discovery/#`도 수신)는 true, `shelly`(Shelly Gen2 이후 장치가 발행하는 `<prefix>/status/<component>` 토픽에서 학습)는 true, `enabled`는 true입니다. 비밀번호에는 사용자 이름과 키가 필요합니다. `HOTLOOP_SECRET_KEY_FILE`이 없으면 `400`이며 평문으로는 절대 저장하지 않습니다. 브로커를 담아 `201`, 이미 쓰는 id는 `409`입니다.

### `PUT /api/mqtt/brokers/{id}`

`id`를 제외한 위 필드 중 어느 것이든 보낼 수 있으며, 보내지 않은 것은 유지됩니다. `"password":""`는 비밀번호를 지웁니다. 브로커를 담아 `200`입니다.

### `DELETE /api/mqtt/brokers/{id}`

브로커와, 그 브로커가 알렸지만 아무도 수락하지 않은 것(수신함과 브로커가 스스로 만든 장치)을 제거합니다. 그 브로커에서 수락된 장치가 아직 있으면 그 장치들을 밝히며 `409`입니다. 먼저 그 장치를 무시하거나 삭제하거나, 대신 `"enabled":false`로 브로커를 끄십시오. `200` `{"deleted":"plant-uns"}`.

## 태그

### `GET /api/tags`

| 쿼리 | <span class="sr-only">상세</span> |
|---|---|
| `device` | 이 장치의 태그만 반환합니다. `limit`이 없으면 모두 응답합니다 |
| `q` | 검색입니다. 장치 id, 태그 이름, 설명에 대소문자 구분 없이 포함된 부분 문자열입니다. `device`와 함께 쓸 수 있습니다 |
| `limit` | 1에서 5000 사이의 정수입니다. `device`가 없으면 기본값은 500입니다. 5001을 포함한 그 밖의 값은 `400`입니다. 거부하며, 더 적게 응답하는 일은 없습니다(4.19.5까지는 1000을 넘는 한도가 조용히 200으로 바뀌었습니다) |
| `writable` | `true`이면 쓰기 가능으로 표시된 태그만 반환합니다(쓰기 선택기가 보여 주는 것) |
| `offset` | 페이지가 시작하는 위치이며 0 이상입니다. 태그는 장치, 이름 순으로 정렬됩니다 |

응답의 `X-Total-Count` 헤더는 전체 일치 태그 수를 알려 주므로, 클라이언트는 `offset`으로 모두 가져올 때까지 페이지를 넘기며 다 가져왔음을 알 수 있습니다. 빈 응답은 `[]`입니다.

```json
[{"id":5,"deviceId":"tank-farm","name":"level_sp","address":"mqtt:docs-api-example/level_sp","dataType":"float","unit":"%","enabled":true,"writable":true,"maxValue":95,"hasRange":true,"scale":1,"createdAt":"2026-09-27T20:21:39.405164Z","updatedAt":"2026-09-27T20:21:39.405164Z"}]
```

### `POST /api/tags`

`deviceId`와 `name`이 새것이면 태그를 만들고, 아니면 대체합니다.

| 필드 | 유형 | <span class="sr-only">상세</span> |
|---|---|---|
| `deviceId` | string | 필수. 장치가 있어야 합니다(없으면 `404`) |
| `name` | string | 필수. 제어 문자는 안 됩니다 |
| `address` | string | 필수. 프로토콜 고유의 주소입니다 |
| `dataType` | string | `bool`, `int`, `float`, `string`(그리고 일반적인 별칭 `int16`, `word`, `coil` 등)입니다. 쓰기를 어떻게 인코딩할지 정합니다 |
| `unit`, `description` | string | |
| `enabled` | bool | 생략하면 `false`입니다 |
| `writable` | bool | **UI, 자동화, 엔티티, MCP 등 모든 경로에서 이 태그를 쓰기용으로 활성화합니다.** 생략하면 `false`입니다 |
| `hasRange`, `minValue`, `maxValue` | bool, number, number | `hasRange`가 있으면 범위를 벗어난 쓰기는 거부됩니다(절대 잘라 내지 않음) |
| `scale`, `offset` | number | 공학값 = 원시값 x 스케일 + 오프셋. 스케일 0은 1로 취급합니다 |
| `noData` | list | "측정 없음"을 뜻하는 원시값 목록이며 각 항목은 `{"raw", "reason"}`입니다. `raw`는 문자열(`"0x8005"`, `"-32763"`) 또는 숫자 그대로이며 문자열로 돌아옵니다. 원시값이 목록에 있는 읽기값은 그 `reason`과 함께 불량 품질이 되며, `scale`과 `offset`보다 먼저 검사합니다. 최대 32개의 코드입니다. 정수가 아니거나, 두 번 나열되었거나, 포인트의 타입이 될 수 없는 코드는 `400`입니다. 타입별로 무엇을 써야 하는지와 Yokogawa DX 예시는 [프로토콜과 드라이버](/ko/iot/protocols/#no-data-values)를 참고하십시오 |
| `deadband`, `deadbandPercent` | number | 이보다 작은 변화는 이력에 기록하지 않습니다 |
| `deviceClass` | string | 태그의 엔티티가 처음에 가지는 클래스(`power`, `connectivity`, `temperature` 등)이며, 해당 도메인에서 의미가 있을 때 씁니다. 태그를 만들 때 적용되고 대체할 때는 무시됩니다. 그 뒤로는 엔티티가 클래스를 소유하므로 거기서 바꾸십시오 |

저장된 태그를 응답합니다. `writable: true`로 저장하면 그대로 로그에 남습니다. 태그를 활성화하는 것은 안전에 관한 결정이므로 이름이 함께 기록됩니다. 태그의 엔티티는 응답 전에 만들거나 갱신되므로, 클라이언트는 바로 요청할 수 있습니다.

아무도 수락하지 않은 발견된 장치의 태그는 활성화할 수 없습니다. `400`, "accept the device first"입니다. [MQTT 디스커버리](/ko/iot/mqtt-discovery/#명령)를 참고하십시오.

### `DELETE /api/tags/{device}/{name}`

`{"deleted":"tank-farm/level"}` 또는 `404`. 이력은 남습니다. 태그의 엔티티는 고아가 됩니다([엔티티](/ko/iot/entities/#삭제된-태그-고아-엔티티-재연결) 참고).

## 값, 보드, 쓰기

### `GET /api/values`

모든 태그의 최신 읽기값을 메모리에서 반환합니다. `?device=`로 장치 하나로 좁힙니다.

```json
[{"deviceId":"extruder-1","protocol":"opcua","tagName":"Temperature","tagValue":20.645294745260895,"unit":"C","quality":"good","timestamp":"2026-09-27T20:21:58.255722Z"}]
```

이 형태는 EmberNet 대시보드의 `TagValue`이며 계약입니다. `quality`는 `good`, `uncertain`, `bad` 중 하나입니다. **불량 읽기값은 값을 알 수 없다는 뜻이지 0이라는 뜻이 아닙니다.** 문자열 읽기값은 `stringVal`을 가지며 그 `tagValue`는 의미가 없습니다.

좋지 않은 읽기값은 드라이버가 이유를 알면 `reason`을 가지므로, 화면이 "불량" 이상의 정보를 보여 줄 수 있습니다.

```json
{"deviceId":"meter-01","protocol":"http","tagName":"power","tagValue":0,"quality":"bad","timestamp":"2026-09-30T09:12:04.51Z","reason":"no field at ENERGY.Power"}
```

좋은 읽기값에는 절대 없으므로 위의 계약은 바이트 단위로 예전과 같습니다. 히스토리안은 이를 보관하지 않습니다. `/api/history`에는 품질이 있고 이유는 없습니다.

### `GET /api/sparkline`

작은 차트용으로 메모리에 보관된 한 태그의 최근 읽기값입니다(`HOTLOOP_RING_SIZE`, 기본값 30). `?tag=device/tag`는 필수입니다.

```json
{"tag":"extruder-1/Temperature","timestamps":[1790540498609,1790540499246,1790540500246],"values":[0,20.06524581530632,19.933308705395785]}
```

`timestamps`는 Unix 밀리초입니다. 읽기값이 없는 태그에서는 둘 다 `[]`입니다. 형식이 잘못된 키는 `400`입니다.

### `GET /api/board`

보드에 고정된 태그와 열 수를 반환합니다. 보드는 공장의 것이므로 브라우저가 아니라 데이터베이스에 저장됩니다. 현장의 패널 PC와 사무실의 노트북이 같은 보드를 보여 줍니다.

```json
{"columns":2,"tags":["extruder-1/Temperature","tank-farm/level"],"rev":"9f2c41b07a6d3e58"}
```

`rev`는 저장된 보드를 가리킵니다. 저장할 때 이를 돌려보내면, 그 사이 보드가 바뀌었을 경우 저장이 거부됩니다(아래).

### `PUT /api/board`

같은 형태입니다. 1에서 4 밖의 `columns`는 3이 되고 중복은 제거됩니다. `rev`는 선택입니다. 읽어 온 보드의 `rev`를 함께 보내면, 그 사이 바뀐 보드에 대한 저장은 `409`이며 아무것도 바꾸지 않습니다. 따라서 보드를 읽은 적이 없거나 오래된 보드를 읽은 페이지가 자기 사본으로 공장의 보드를 덮어쓸 수 없습니다. 생략하면 저장을 검사하지 않으며, 매번 보드 전체를 설정하는 클라이언트에 적합합니다. 웹 UI는 시작할 때 보드를 읽고 저장할 때마다 `rev`를 보냅니다. 모든 태그가 존재해야 합니다(없는 태그를 밝히며 `404`). 낡은 항목은 움직이지 않는 게이지이기 때문입니다. 저장된 보드를 응답합니다. operator는 `board.write`를 가집니다. 보드를 정리하는 것은 공장을 운영하는 일이지 구성하는 일이 아닙니다.

### `POST /api/write`

쓰기 게이트를 거쳐 한 태그에 값 하나를 씁니다.

| 필드 | 유형 | <span class="sr-only">상세</span> |
|---|---|---|
| `tag` | string | 필수. `device/tag` |
| `value` | bool, number or string | 필수. `true`는 bool, `42`는 정수, `42.5`는 실수, `"42"`는 문자열입니다. JSON 타입이 곧 쓰는 타입입니다. 코일, 워드, 실수는 선로상에서 서로 다른 세 가지이기 때문입니다 |
| `reason` | string | 선택. 쓰기와 함께 로그에 남습니다 |

```json
{"tag":"tank-farm/level_sp","written":"72.5"}
```

**값은 읽기값처럼 태그의 단위로 지정합니다.** 스케일이나 오프셋이 있는 태그에서는 보내는 값이 태그가 다시 읽었을 때의 값이며, HotLoop은 그 값이 되는 카운트를 장치에 보냅니다. 0.1 스케일이 적용된 레지스터에 55.5를 쓰면 레지스터에는 555가 들어갑니다. (4.18까지는 숫자가 그대로 장치에 갔기 때문에 55.5가 55가 되어 5.5로 읽혔습니다.) 범위 검사와 감사 행은 태그 단위의 사용자 숫자를 씁니다. 그 뒤에 레지스터에 들어가지 않는 카운트, 예를 들어 0.1 스케일의 `uint16`에 7000은 카운트와 레지스터를 밝히며 거부되고 아무것도 전송되지 않습니다. 카운트의 소수 부분은 정수 카운트 레지스터가 늘 그래 왔듯이 버려집니다. 10분의 1 스케일 레지스터에 12.34를 쓰면 12.3이 저장됩니다.

게이트는 쓰기가 켜져 있는지(`HOTLOOP_ALLOW_WRITES`), 태그가 활성화되어 있는지, 값이 범위 안인지를 순서대로 검사합니다. 거부되었든 아니든 모든 시도는 `GET /api/writes`에 있습니다.

| 상태 | 발생 조건 |
|---|---|
| 400 | 값이 없음, `null` 값, 잘못된 형식의 키 |
| 403 | 쓰기가 꺼져 있음, 또는 `"tank-farm/level: this tag is not marked writable"` |
| 404 | 그런 태그가 없음 |
| 422 | `"value is outside the tag's configured range: 120 is outside 0..95"` |
| 503 | 장치가 연결되어 있지 않음 |

## 이력과 감사

### `GET /api/history`

| 쿼리 | <span class="sr-only">상세</span> |
|---|---|
| `tag` | 필수, 반복 가능, 최대 50개: `?tag=a/x&tag=b/y` |
| `minutes` | 지금부터 얼마나 거슬러 올라갈지입니다. 기본값 60 |
| `bucket` | 버킷 크기(초)입니다. 기본값은 창이 약 400개의 버킷이 되도록 1초에서 1일까지의 단계에서 고릅니다 |
| `raw` | `true`이면 버킷 대신 읽기값 자체를 반환합니다 |
| `limit` | 기본값 5000, 최대 100000 |
| `carry` | `true`이면 창이 시작될 때 각 태그가 가지고 있던 값도 알려 줍니다(버킷만) |

버킷 단위이며 태그별로 오래된 것부터입니다. `badCount`는 버킷에서 품질이 좋지 않았던 읽기값의 수이며, 평균에 넣지 않고 따로 셉니다. `from`과 `to`는 응답이 해당하는 창으로, 정확히 `minutes`만큼 떨어져 있고 질문한 시각에 끝납니다.

```json
{"buckets":[{"deviceId":"extruder-1","tagName":"Temperature","bucket":"2026-09-27T20:21:00Z","avg":18.986210570239944,"min":0,"max":20.83008050535897,"first":0,"last":20.83008050535897,"count":22,"badCount":1}],"from":"2026-09-27T19:22:00Z","raw":false,"to":"2026-09-27T20:22:00Z"}
```

히스토리안은 값이 데드밴드를 넘어 움직일 때 읽기값을 보관하며 폴링할 때마다 보관하지 않으므로, 가만히 있던 태그는 창 안에 그릴 것이 없습니다. `carry=true`이면 응답에 `"carry":[{"deviceId":"extruder-1","tagName":"Temperature","ts":"2026-09-27T16:40:12Z","value":21.4}]`도 들어 있습니다. `from` 이전의 마지막 읽기값이 좋았고 숫자가 있었던 각 태그의 그 읽기값입니다. 마지막 읽기값이 불량이거나 불확실했거나, 이전 읽기값이 없거나, 텍스트인 태그는 항목이 없습니다. 무엇을 가지고 있었는지 알 수 없고 차트에 추측을 넘기지 않기 때문입니다. 트렌드 카드는 이것으로 그립니다.

원시 데이터는 최신순입니다.

```json
{"raw":true,"readings":[{"deviceId":"extruder-1","protocol":"","tagName":"Temperature","tagValue":21.021559879601448,"quality":"good","timestamp":"2026-09-27T20:22:00.267463Z"}]}
```

`tag`가 없거나, 50개를 넘거나, 형식이 잘못된 키이면 `400`입니다.

### `GET /api/writes`

최신순의 쓰기 감사입니다. 거부된 것을 포함해 모든 시도가 여기 있습니다. "그 명령이 나갔는지 모른다"는 공장이 들을 수 있는 가장 나쁜 대답이기 때문입니다.

| 쿼리 | <span class="sr-only">상세</span> |
|---|---|
| `tag` | 태그 하나, `device/tag` |
| `device` | 장치 하나의 모든 태그(`tag`를 지정하면 무시) |
| `entity` | 이 엔티티에 대한 서비스 호출이 수행했거나 거부당한 모든 쓰기이며, 위의 조건 대신 사용합니다 |
| `call` | 하나의 호출이 수행한 모든 쓰기이며, 위의 모든 조건 대신 사용합니다. 버튼의 누름과 뗌, 또는 레시피 적용의 모든 대상이며 `call_id`를 공유합니다 |
| `limit` | 기본값 100, 최대 5000 |

```json
[{"id":2,"at":"2026-09-27T20:22:01.04226Z","deviceId":"tank-farm","tagName":"level_sp","value":"120","prior":"0 %","actor":"admin","source":"ui","succeeded":false,"error":"refused: value is outside the tag's configured range: 120 is outside 0..95"},
 {"id":4,"at":"2026-09-27T20:23:03.276962Z","deviceId":"tank-farm","tagName":"pump","value":"true","prior":"0","actor":"admin","source":"ui","succeeded":true,"latencyMs":0.317,"entityId":"switch.tank_farm_pump","service":"switch.turn_on","callId":"5c9f8545a93b5443"}]
```

`source`는 `ui`, `api`, `automation`, `mcp` 중 하나입니다. `entityId`, `service`, `callId`는 서비스 호출이 수행한 쓰기에만 있습니다.

## 엔티티와 상태

모든 태그는 아무도 요청하지 않아도 엔티티를 얻습니다. 복합 엔티티(모터, 밸브, 루프, 카운터, 선택기, 버튼, 기상 관측소)는 관리자가 태그로 만듭니다. 모든 엔티티 엔드포인트처럼 snake_case입니다. 전체 모델은 [엔티티](/ko/iot/entities/)에 있습니다.

### `GET /api/entities`

고아 엔티티를 포함한 모든 엔티티를 반환합니다.

| 쿼리 | <span class="sr-only">상세</span> |
|---|---|
| `domain` | `sensor`, `switch`, `motor`... |
| `device` | 한 장치의 엔티티 |
| `orphaned` | `true`이면 고아만, `false`이면 고아 제외 |
| `q`, `limit` | 검색입니다. 엔티티 id, 이름, 장치 id에 대소문자 구분 없이 포함된 부분 문자열이며, 엔티티 id 순으로 정렬해 최대 `limit`개(1에서 5000, 그 밖의 값은 `400`이며 조용히 잘라 내지 않음)를 반환합니다. `X-Total-Count`는 일치한 개수입니다. 생략하면 목록 전체입니다 |

```json
[{"id":5,"entity_id":"switch.tank_farm_pump","unique_id":"tag-control:tank-farm/pump","domain":"switch","platform":"tag","name":"pump","device_id":"tank-farm","options":{},"disabled":false,"hidden":false,"created_at":"2026-09-27T20:21:39.153197Z","updated_at":"2026-09-27T20:21:39.153197Z","bindings":[{"role":"command","device_id":"tank-farm","tag_name":"pump"},{"role":"state","device_id":"tank-farm","tag_name":"pump"}],"equipment_id":null,"area_id":4,"labels":[]}]
```

### `GET /api/entities/composites`

`POST /api/entities`가 만들 수 있는 것, 즉 각 도메인, 그 태그가 연결되는 역할, 받는 서비스를 반환합니다. 역할에는 태그의 `kind`, `required` 여부, 서비스가 쓰는지(`command`), 상태를 그 역할에서 읽는지(`feedback`)가 나옵니다. 기상 관측소는 서비스를 받지 않습니다.

```json
{"domains":[{"domain":"weather","roles":[{"role":"temperature","kind":"number","required":true,"command":false,"feedback":true},{"role":"humidity","kind":"number","required":false,"command":false,"feedback":true}],"services":[]}]}
```

### `GET /api/entities/{entity_id}`

`{"entity": {...}, "state": {...}}`. 비활성화된 엔티티의 `state`는 `null`입니다. 알 수 없는 엔티티는 `404`입니다.

### `GET /api/entities/{entity_id}/image`

카메라나 이미지의 최신 사진을 HotLoop이 가진 바이트 그대로 반환합니다. `Content-Type`은 실제 형식(`image/jpeg`, `image/png`, `image/gif`, `image/webp`)이며, `X-Content-Type-Options: nosniff`, 샌드박스용 `Content-Security-Policy`, `ETag`가 함께 옵니다(`If-None-Match`에는 `304`). 해당하지 않는 엔티티이거나 사진이 도착하기 전이면 `404`입니다. 상태의 `entity_picture` 속성은 이 경로에 사진의 해시를 붙인 것입니다.

### `PUT /api/entities/{entity_id}`

보낸 필드만 변경합니다. 관리자 전용입니다. entity_id는 모든 자동화, 대시보드, 에이전트가 엔티티를 가리키는 이름이므로 이를 바꾸는 것은 구성 변경입니다.

| 필드 | 유형 | <span class="sr-only">상세</span> |
|---|---|---|
| `entity_id` | string | 이름 변경입니다. `unique_id`는 바뀌지 않습니다 |
| `name`, `icon`, `device_class`, `state_class`, `unit_of_measurement`, `entity_category` | string | |
| `options` | object | 도메인별입니다. [엔티티](/ko/iot/entities/#api)를 참고하십시오 |
| `disabled`, `hidden` | bool | 비활성화된 엔티티는 상태가 없고 명령할 수 없습니다 |
| `equipment_id` | int or null | 트리에 배치합니다. `null`이면 다시 장치를 따릅니다 |
| `labels` | string[] | 전체 집합입니다 |

`unique_id`, `domain`, `platform`, 장치, 바인딩은 여기서 바꿀 수 없으며, 보내면 400입니다.

```json
{"entity":{"id":3,"entity_id":"sensor.tank_1_level","name":"Tank 1 level","device_class":"moisture","icon":"mdi:water-percent","...":"..."},"warnings":[]}
```

`warnings`는 유효하지만 이상한 경우(장치 클래스에 보통 없는 단위)를 알려 줍니다. 본문이 비어 있으면(`"the update names no field to change"`) 또는 값이 잘못되면 `400`, 알 수 없는 엔티티는 `404`, 이미 쓰는 entity_id는 `409`입니다.

### `POST /api/entities`

복합 엔티티를 만듭니다. 본문은 도메인을 지정하고 태그를 그 역할에 연결합니다.

```json
{"name":"Transfer pump","domain":"motor","bindings":[{"role":"run_command","device_id":"tank-farm","tag_name":"pump"},{"role":"running","device_id":"tank-farm","tag_name":"pump"}]}
```

`entity_id`(없으면 이름에서 생성), `device_class`, `unit_of_measurement`, `icon`, `entity_category`, `options`도 쓸 수 있습니다. 도메인마다 받는 역할과 옵션은 [엔티티](/ko/iot/entities/#복합-설비)에 있습니다. `201` `{"entity": {...}, "warnings": [...]}`을 응답합니다. 여기서 만들지 않는 도메인(`sensor`는 태그에서, `alarm`은 정의에서 생김), 빠진 역할이나 그 역할을 채울 수 없는 태그는 `400`, 이미 쓰는 entity_id는 `409`입니다.

### `DELETE /api/entities/{entity_id}`

복합 엔티티, 또는 태그나 알람 정의가 사라진 고아 엔티티를 삭제합니다. `{"deleted":"motor.transfer_pump","entity":{...}}`. 그 밖의 것은 어떻게 하면 사라지는지 알려 주며 `409`로 응답합니다.

```json
{"error":"this entity cannot be deleted: sensor.tank_1_level is kept in step with its tag; delete the tag, and then this orphan, or hide or disable it: already exists"}
```

### `GET /api/states`

활성화된 모든 엔티티의 상태를 entity_id 순으로 반환합니다. `?domain=`으로 거릅니다.

```json
[{"entity_id":"number.tank_farm_level_sp","state":"unknown","attributes":{"armed":true,"friendly_name":"level_sp","max":95,"min":0,"source":["tank-farm/level_sp"],"unit_of_measurement":"%"},"quality":"bad","last_changed":"2026-09-27T20:21:39.417193755Z","last_updated":"2026-09-27T20:21:39.417193755Z","last_reported":"2026-09-27T20:22:04.423849496Z"}]
```

`state`는 숫자라도 항상 문자열입니다. `unknown`과 `unavailable`은 말 그대로의 뜻입니다. `last_reported`는 그 상태의 바탕이 된 읽기값에 대한 장치의 타임스탬프입니다.

### `GET /api/states/{entity_id}`

상태 하나를 반환합니다. 알 수 없는 엔티티는 `404`이고, 비활성화된 엔티티는 활성화하는 방법을 알려 주는 다른 `404`입니다. 비활성화된 엔티티는 없는 것이 아니며, 없다고 알리면 누군가 있지도 않은 오타를 찾아다니게 됩니다.

## 에너지

공장이 쓰는 것과 그 비용입니다. 킬로와트시, 가스, 물, 압축 공기, 그리고 생산 단위당 비용입니다. 계량기는 사용량으로 읽는 태그입니다. 전체 모델, 요금제, 화면의 동작은 [에너지](/ko/iot/energy/)에 있습니다. 읽기는 모든 역할이 가진 `energy.read`이고, 계량기나 요금제를 만들거나 바꾸는 것은 관리자의 `energy.write`입니다.

### `GET /api/energy/meters`

모든 계량기를 종류, 이름 순으로 반환하며, 각각 어떻게 읽는지와 오늘 사용한 양이 들어 있습니다.

```json
[{"id":"main","name":"Main panel","kind":"electricity","mode":"counter","source":{"device_id":"pm-01","tag_name":"kWh"},"unit":"kWh","factor":0.001,"tariff":{"currency":"USD","price":0.12,"bands":[{"from":"22:00","to":"06:00","price":0.07}]},"enabled":true,"status":{"state":"ok","last_read_at":"2026-11-19T21:15:00Z","resets":0,"gap_seconds":0},"today":{"value":412.6,"cost":49.51,"covered_seconds":43200,"estimated":false}}]
```

`status.state`는 `ok`, `waiting`(태그에서 아직 아무것도 읽지 못함), `bad`(태그의 읽기값이 좋지 않으며 `reason`이 이유를 알려 줌), `disabled` 중 하나입니다.

### `POST /api/energy/meters`

계량기를 만듭니다. `id`는 소문자, 숫자, `-`, `_`입니다. `kind`는 `electricity`, `gas`, `water`, `air`, `heat`, `production` 중 하나입니다. `mode`는 `counter`(누적 태그로, 사용량은 움직인 만큼에 `factor`를 곱한 값) 또는 `power`(비율로, 사용량은 그 비율이 유지된 시간 동안의 양이며 `power_unit`은 `W`, `kW`, `MW`, `unit`은 `Wh`, `kWh`, `MWh`)입니다. `source`는 태그입니다. `tariff`는 단위당 고정 `price`와 선택 사항인 `currency`, 시간대별 요금을 위한 선택 사항인 `bands`(15분 단위의 `from`과 `to`, `days`, `price`)로 이루어지며, 생산 계량기에는 없습니다. `Wh`, `kWh`, `MWh` 단위의 전기 계량기는 요금제에 `demand_price`도 둘 수 있습니다. 기간 중 가장 높은 15분의 1킬로와트당 비용입니다. `enabled`를 생략하면 `true`입니다. `{"meter": {...}, "warnings": []}`와 함께 `201`을 응답합니다. 태그가 없거나 숫자가 아니거나, 밴드가 15분 단위가 아니거나, 전력 계량기에 factor가 있으면 무엇이 잘못되었는지 알려 주며 `400`입니다. 이미 쓰는 id는 `409`입니다.

### `GET /api/energy/meters/{id}`

목록에 보이는 대로 계량기 하나를 반환합니다. 알 수 없는 것은 `404`입니다.

### `PUT /api/energy/meters/{id}`

계량기의 정의를 대체합니다. 이미 센 값은 그대로 남고, 그때의 가격을 유지합니다. 다른 태그나 모드로 가리키게 하면 다음 읽기값이 다른 것이므로 마지막 읽기가 어디까지였는지 잊습니다.

### `DELETE /api/energy/meters/{id}`

계량기와 그것이 센 모든 값을 제거합니다. 알 수 없는 것은 `404`입니다.

### `GET /api/energy/summary`

기간 동안 각 계량기의 사용량과 비용, 그리고 생산 단위당 비용을 반환합니다. 기간은 `?period=`(`today`, `yesterday`, `this_week`, `last_week`, `this_month`, `last_month`, `last_7_days`, `last_30_days`, 또는 시작된 가장 최근 교대는 `shift:06:00-14:00`, 그 전 교대는 `last_shift:06:00-14:00`으로 씁니다. 일, 월, 교대는 사이트 기준입니다) 또는 RFC 3339의 `?from=&to=`이며 from은 포함, to는 제외, 최대 400일입니다. `meters`는 단위당 비용에 비용이 들어가는 계량기의 쉼표 구분 목록이고, `per`는 나눌 생산 계량기 하나를 지정합니다.

```json
{"period":"today","from":"2026-11-19T05:00:00Z","to":"2026-11-20T05:00:00Z",
 "meters":[{"id":"main","name":"Main panel","kind":"electricity","unit":"kWh","currency":"USD","value":412.6,"cost":49.51,"covered_seconds":43200,"coverage":1,"estimated":false}],
 "costs":[{"currency":"USD","cost":49.51}],
 "per_unit":[{"production":"parts","units":9800,"currency":"USD","cost":49.51,"cost_per_unit":0.00505}]}
```

`coverage`는 지금까지의 기간 중 읽기값이 뒷받침하는 비율입니다. 서로 다른 두 통화의 비용은 절대 더하지 않으므로 각 통화마다 `per_unit` 행이 있습니다. `cost_per_unit`은 아무것도 생산하지 않았을 때(`reason`은 `nothing_made`), 또는 생산은 했지만 가격이 있는 계량기가 아직 사용량을 세지 않았을 때(`nothing_counted`) `null`입니다. 이는 답이 없다는 뜻이며 0이 아닙니다.

`demand_price`가 있는 계량기는 행에 `demand`를 가집니다. `peak_kw`(기간 중 가장 높은 15분의 평균 킬로와트), `peak_at`(시작 시각), `peak_covered_seconds`(그 15분 중 읽은 양이며 900 미만이면 피크가 낮게 나옴), `cost`(피크에 가격을 곱한 값)입니다. 행의 `cost`는 에너지 비용 그대로이고, `costs`와 `per_unit`에는 수요 요금이 포함됩니다.

### `GET /api/energy/summary/{period}`

경로에 지정한 이름 있는 기간(또는 교대) 하나에 대한 같은 요약입니다. `meters`와 `per`는 여전히 쿼리에 넣습니다.

### `GET /api/energy/series`

한 계량기의 기간별 사용량으로, `?meter=<id>`, 위와 같은 기간, 그리고 `step`(`quarter` 최대 8일, `hour` 기본값, `day`, `month`)을 씁니다. 읽기값이 없는 구간은 목록에 없습니다.

```json
{"meter":"main","unit":"kWh","currency":"USD","step":"day","points":[{"start":"2026-11-19T05:00:00Z","value":412.6,"cost":49.51,"estimated":false}]}
```

### `GET /api/energy/series/{meter}/{period}/{step}`

계량기, 이름 있는 기간, 구간을 모두 경로에 담은 같은 시리즈로, 경로만 줄 수 있는 호출자를 위한 것입니다.

## 서비스

### `POST /api/services/{domain}/{service}`

엔티티 하나에 명령합니다. `switch/turn_on`, `number/set_value`, `motor/start`, `alarm/acknowledge`. 엔티티 하나, 서비스 하나, 호출 하나입니다. 그 아래는 `POST /api/write`와 같은 쓰기 게이트를 거치는 태그 쓰기일 뿐입니다.

```json
{"entity_id":"switch.tank_farm_pump","reason":"start of shift"}
```

`entity_id`는 필수이며 목록이 아니라 엔티티 하나입니다. `reason`은 선택이고, 나머지는 모두 서비스의 데이터입니다(`value`, `option`, `position`, `mode`, `minutes`, `note`). 숫자는 입력한 타입을 유지합니다. 경로의 도메인은 엔티티의 도메인이어야 합니다. 모든 서비스와 그 데이터는 [엔티티](/ko/iot/entities/#도메인별로-받는-것)에 있습니다.

```json
{"call_id":"5c9f8545a93b5443","entity_id":"switch.tank_farm_pump","service":"switch.turn_on","writes":[{"tag":"tank-farm/pump","value":"true","status":"written"}]}
```

각 쓰기는 `written`, `not_sent`(장치에 닿기 전에 거부됨), `failed`(나갔으나 장치가 오류를 보고하여 반영되었는지 알 수 없음), `skipped`(호출의 앞선 쓰기가 성공하지 못함) 중 하나입니다. 이미 수행한 쓰기는 되돌리지 않습니다. 알람 엔티티의 서비스는 태그를 쓰지 않고 엔진이 남긴 상태의 `alarm`으로 응답합니다. 헬퍼의 서비스도 태그를 쓰지 않고 헬퍼를 남긴 `state`로 응답합니다.

```json
{"call_id":"0f3c2a1b9d8e7f60","entity_id":"input_number.batch_target","service":"input_number.set_value","writes":[],"state":"1250"}
```

스크립트의 `turn_on`은 데이터를 필드로 하여 스크립트를 실행하고 시작한 `script_run`으로 응답합니다. 그 단계의 쓰기는 여기가 아니라 `script:<id>`로 하나씩 감사됩니다. `turn_off`는 그 스크립트의 모든 실행을 멈춥니다. [스크립트](#스크립트)를 참고하십시오.

씬의 `turn_on`은 데이터의 `params`와 `version`으로 그 레시피를 적용하고, 전체 `recipe_application`과 `writes`에 대상들이 수행한 모든 쓰기를 순서대로 담아 응답합니다. 모든 대상에 쓰지 못하면 실패합니다. [레시피](#레시피)를 참고하십시오.

실패한 호출은 오류의 상태와 같은 본문에 `error`를 더해 응답하므로 정확히 어디서 멈췄는지 볼 수 있습니다.

```json
{"error":"value is outside the tag's configured range: 150 is outside 0..95","call_id":"3cd42f8275e5765e","entity_id":"number.tank_farm_level_sp","service":"number.set_value","writes":[{"tag":"tank-farm/level_sp","value":"150","status":"not_sent","error":"value is outside the tag's configured range: 150 is outside 0..95"}]}
```

| 상태 | 발생 조건 |
|---|---|
| 400 | `entity_id`가 없음, 잘못된 도메인, 알 수 없는 서비스, 서비스가 받지 않는 데이터 |
| 403 | 권한이 없거나, 게이트가 정책상 거부함 |
| 404 | 그런 엔티티가 없음 |
| 409 | 알려진 상태가 없는 토글, 서비스에 맞지 않는 상태의 설비 |
| 422 | 값 자체를 이유로 거부됨 |
| 503 | 장치가 연결되어 있지 않음, 알람 엔진이 실행 중이 아님 |
| 500 | 버튼을 누른 신호는 나갔으나 뗀 신호는 나가지 않음. **태그가 아직 누름 값을 가지고 있을 수 있습니다.** 확인하고 직접 해제하십시오 |

**`?dry_run=true`**는 호출이 무엇을 할지 묻기만 하고 아무것도 하지 않습니다. 쓰기, 감사, 로그 모두 없습니다. 호출은 실제와 똑같이 계획되고, 모든 쓰기가 게이트 자체의 검사를 같은 순서로 지금 바로 거칩니다. 판정은 거부되었든 아니든 200으로 응답합니다. 각 쓰기는 `would_write`이거나, 거부될 첫 쓰기는 이유와 함께 `not_sent`이고 나머지는 `skipped`이며, `error`는 실제 호출이 실패할 때의 오류를 글자 그대로 담습니다.

```json
{"dry_run":true,"error":"value is outside the tag's configured range: 150 is outside 0..95","entity_id":"number.tank_farm_level_sp","service":"number.set_value","writes":[{"tag":"tank-farm/level_sp","value":"150","status":"not_sent","error":"value is outside the tag's configured range: 150 is outside 0..95"}]}
```

실제 호출이 어떤 검사보다 먼저 돌려보낼 요청(없는 엔티티, 알 수 없는 서비스, 서비스가 받지 않는 데이터, 알려진 상태가 없는 토글)은 실제 호출의 상태와 오류로 응답하며, 권한이 없을 때도 같습니다. `dry_run`은 `true` 또는 `false`만 가능하며 `yes`는 추측하지 않고 400입니다. 잘못 추측하면 질문이 명령이 되기 때문입니다. [엔티티](/ko/iot/entities/#먼저-묻기-드라이런)를 참고하십시오.

**권한을 핸들러에서 검사하는 이유.** 이 호출에는 태그를 직접 쓰는 것과 같은 `values.write`가 필요합니다. 그것이 이 호출의 전부이기 때문입니다. `alarm` 엔티티의 서비스는 대신 알람 화면과 같은 `alarms.ack`가 필요하고, 헬퍼의 서비스는 operator가 가진 `helpers.write`, 스크립트의 서비스는 `POST /api/scripts/{id}/run`과 같은 `scripts.run`, 씬의 서비스는 `POST /api/recipes/{id}/apply`와 같은 `recipes.apply`와 레시피가 지정한 경우 그 레시피 자체의 권한이 필요합니다. 검사를 핸들러 앞이 아니라 안에서 하는 이유는, 권한이 없어 거부될 때도 그 거부가 쓰기 게이트로 가서 요청한 값과 함께 다른 모든 거부처럼 **엔티티를 기준으로 감사**되게 하기 위해서입니다. 권한 없는 사용자는 403과 `GET /api/writes?entity=...`의 한 줄을 받으며, 403만 받고 아무 기록이 없는 일은 없습니다. 헬퍼는 태그를 쓰지 않으므로 이번 경우를 포함한 헬퍼의 거부는 대신 헬퍼에 대한 시스템 로그(`GET /api/events`)의 경고이며, 스크립트도 마찬가지입니다. 씬의 거부는 레시피 이력에 사용자와 함께 남는 거부된 적용입니다.

## 헬퍼

PLC가 아니라 현장 사람들이 관리하는 값입니다: `input_boolean`, `input_number`, `input_select`, `input_text`, `input_counter`, `timer`, `schedule`. 헬퍼는 하나의 엔티티(플랫폼 `helper`)이며 다른 엔티티와 똑같이 `/api/entities`와 `/api/states`에 나타납니다. 이 라우트들은 헬퍼의 구성을 다룹니다. 헬퍼의 값은 위의 서비스로, `helpers.write` 권한으로 설정합니다. 모든 도메인, 옵션, 서비스는 [헬퍼](/ko/iot/helpers/)에 있습니다.

### `GET /api/helpers`

모든 헬퍼를 각 엔티티의 필드와 그 헬퍼에 저장된 행인 `value`와 함께 반환합니다.

```json
[{"id":41,"entity_id":"timer.purge","unique_id":"helper:6f1d...","domain":"timer","platform":"helper","name":"Purge","options":{"duration_sec":600},"...":"...","value":{"state":"active","finishes_at":"2026-09-27T21:10:00Z","duration_ms":600000,"changed_at":"2026-09-27T21:00:00Z","changed_by":"otto","source":"ui","call_id":"9a1b...","rev":4}}]
```

### `POST /api/helpers`

초기값으로 헬퍼를 만듭니다. 관리자 전용입니다.

```json
{"name":"Batch target","domain":"input_number","unit_of_measurement":"kg","options":{"min":0,"max":5000,"step":50,"initial":1000}}
```

`entity_id`(없으면 이름에서 생성)와 `icon`도 받을 수 있습니다. `201` `{"helper": {...}}`로 응답합니다. 헬퍼의 도메인이 아니거나, 도메인이 받지 않는 옵션이거나, 자체 옵션이 거부할 `initial`이면 `400`, 이미 쓰는 entity_id이면 `409`입니다.

### `GET /api/helpers/{entity_id}`

목록과 같은 형태로 헬퍼 하나를 반환합니다. 알 수 없는 엔티티이거나 헬퍼가 아닌 엔티티는 `404`입니다.

### `PUT /api/helpers/{entity_id}`

`name`, `icon`, `unit_of_measurement`, `options`, `disabled`, `hidden`, `entity_id`, `equipment_id`, `labels`를 변경합니다. `PUT /api/entities/{entity_id}`와 같은 필드입니다. 관리자 전용입니다. 지금 가진 값을 허용하지 않게 되는 새 옵션(값 아래로 좁힌 범위, 선택된 항목을 뺀 목록)은 `400`입니다. 값은 옵션에 맞추려고 옮겨지는 일이 없습니다. `{"helper": {...}, "warnings": []}`로 응답합니다.

### `DELETE /api/helpers/{entity_id}`

헬퍼와 그 값을 삭제합니다. 관리자 전용입니다. `{"deleted":"timer.purge"}`. `DELETE /api/entities/{entity_id}`는 헬퍼를 거부하고 이곳을 가리키는 `409`를 반환합니다.

## 설비와 레이블

ISA-95 트리(기업, 사이트, 구역, 라인, 셀, 유닛, 설비)와 자유 형식 레이블입니다. snake_case를 씁니다. 모든 역할이 읽을 수 있고 변경은 관리자만 할 수 있습니다. 노드의 이름을 바꾸거나 옮기면 그 아래 모든 장치의 사이트, 구역, 라인이 다시 쓰이기 때문입니다. [설비 트리와 레이블](/ko/iot/equipment/)을 참고하세요.

### `GET /api/equipment`

모든 노드를 id 순으로, 각각 루트부터의 이름 경로인 `path`와 함께 반환합니다. `?level=area`로 거릅니다. `?q=`는 경로에 해당 텍스트가 들어 있는 노드만 남기고(대소문자 구분 없음), `?limit=`(1에서 5000, 그 밖의 값은 `400`)는 그중 앞쪽 노드만 남깁니다. 둘 중 하나를 쓰면 `X-Total-Count`가 일치한 개수입니다.

```json
[{"id":4,"parent_id":1,"level":"area","name":"Utilities","created_at":"2026-09-27T20:21:01.637319Z","updated_at":"2026-09-27T20:21:01.637319Z","path":["Demo Plant","Utilities"]}]
```

### `POST /api/equipment`

```json
{"parent_id":3,"level":"cell","name":"Die head","description":"Die and screen changer"}
```

`parent_id`가 null이거나 없으면 루트가 됩니다. 자식은 부모보다 낮은 레벨이어야 합니다(설비는 설비 안에 둘 수 있습니다). `{"equipment": {...}, "devices_rewritten": []}`로 응답합니다. 레벨이나 위치가 잘못되면 `400`, 같은 레벨과 이름의 형제가 있으면 `409`입니다.

### `GET /api/equipment/{id}`

노드, 그 바로 아래 노드, 그 노드에 직접 배치된 장치와 엔티티를 반환합니다.

```json
{"children":[],"devices":["extruder-1"],"entities":[],"equipment":{"id":3,"parent_id":2,"level":"line","name":"Line 1","...":"...","path":["Demo Plant","Extrusion","Line 1"]}}
```

양의 숫자가 아닌 id는 `400`, 알 수 없는 id는 `404`입니다.

### `PUT /api/equipment/{id}`

`name`, `description`, `level`, `parent_id`(`null`이면 루트로 이동) 중 원하는 것을 보냅니다. 보낸 필드만 바뀌며 빈 본문은 400입니다. 노드와, **그 결과 사이트, 구역, 라인 텍스트가 바뀐 모든 장치**를 응답합니다. 오래된 클라이언트와 MCP 도구가 읽는 것이 바로 그 텍스트이기 때문입니다.

```json
{"devices_rewritten":["tank-farm"],"equipment":{"id":4,"parent_id":1,"level":"area","name":"Utilities East","...":"..."}}
```

### `DELETE /api/equipment/{id}`

`{"deleted":5}`. 그 아래나 위에 무언가 있는 동안은 `409`이며 무엇이 있는지 알려 줍니다. 장치 밑에서 노드를 지우는 것은 실수로 내릴 결정이 아닙니다.

### `GET /api/labels`

```json
[{"label_id":"critical","name":"Critical","color":"red","icon":"mdi:alert","description":"Stops the line if it fails","created_at":"2026-09-27T20:24:29.659126Z","updated_at":"2026-09-27T20:24:29.659126Z"}]
```

### `POST /api/labels`

`name`은 필수입니다. `label_id`(소문자, 숫자, 밑줄 1~64자)는 생략하면 이름에서 생성되며 이후 바뀌지 않습니다. `color`, `icon`(`mdi:...`), `description`은 선택입니다. 레이블을 응답합니다. 이미 쓰는 이름이나 id는 `409`입니다.

### `GET /api/labels/{label_id}`

`{"label": {...}, "devices": ["tank-farm"], "entities": []}`: 레이블과 그것을 가진 대상입니다. 알 수 없는 레이블은 `404`입니다.

### `PUT /api/labels/{label_id}`

`name`, `color`, `icon`, `description`을 교체하며, 생략한 필드는 지워집니다. 본문의 `label_id`는 경로와 같아야 하며 다르면 `400`입니다. label_id는 바뀌지 않기 때문입니다.

### `DELETE /api/labels/{label_id}`

그 레이블을 가진 모든 대상에서 제거합니다. `{"deleted":"critical"}` 또는 `404`.

### `PUT /api/devices/{id}/labels`

`{"labels": ["critical"]}`는 장치의 레이블 집합 전체를 교체합니다. `{"id":"tank-farm","labels":["critical"]}`로 응답합니다. 모든 레이블이 존재해야 하며(없는 레이블 이름과 함께 `400`) 장치도 존재해야 합니다(`404`). 레이블을 `POST /api/devices`에 넣지 않은 것은 의도입니다. 장치를 저장하는 모든 클라이언트는 레이블 없이 장치 전체를 보내므로, 저장할 때마다 레이블이 지워지기 때문입니다.

## 알람

ISA-18.2: 발생, 확인, 정상 복귀는 서로 다른 일이며, 로그는 그중 무엇이 일어났는지 구분해 보여 줍니다.

### `GET /api/alarms`

모든 정의, 현재 알람, 요약을 반환합니다. `?outstanding=true`는 정상 상태와 억제된 알람을 뺍니다.

```json
{
  "alarms": [{"definitionId":"extruder-temp-hi","name":"Extruder temperature high","deviceId":"extruder-1","tagName":"Temperature","priority":2,"state":"unack-active","message":"extruder-1/Temperature at 22.80197037650447 C, limit 5","tripValue":22.80197037650447,"raisedAt":"2026-09-27T20:25:19.67042816Z","count":1,"updatedAt":"2026-09-27T20:25:19.67042816Z"}],
  "definitions": [{"id":"extruder-temp-hi","name":"Extruder temperature high","deviceId":"extruder-1","tagName":"Temperature","condition":"hi","limit":5,"priority":2,"enabled":true,"deadband":0.5,"message":"{device}/{tag} at {value}, limit {limit}","createdAt":"2026-09-27T20:25:19.055658Z","updatedAt":"2026-09-27T20:25:19.055658Z"}],
  "summary": {"critical":0,"high":1,"medium":0,"low":0,"unacked":1,"total":1}
}
```

`state`는 `normal`, `unack-active`, `ack-active`, `rtn-unack`(아무도 확인하기 전에 해제되었지만, 새벽 3시의 트립이 아침 근무자가 보기 전에 사라지지 않도록 목록에 남깁니다), `shelved`, `suppressed` 중 하나입니다. `tripValue`는 알람을 발생시킨 값이며 현재 값이 아닙니다.

### `POST /api/alarms`

정의를 만들거나 교체합니다.

| 필드 | 유형 | <span class="sr-only">상세</span> |
|---|---|---|
| `id`, `name` | string | 필수. `id`는 장치 id 규칙을 따릅니다 |
| `deviceId`, `tagName` | string | 필수 |
| `condition` | string | `hihi`, `hi`, `lo`, `lolo`, `eq`, `ne`, `true`, `false`, `bad-quality`, `stale`(`limit`초 동안 값이 없음), `roc`(초당 `limit`을 넘는 변화율) |
| `limit` | number | |
| `priority` | int | 1(긴급)에서 4(낮음)까지 |
| `enabled` | bool | 생략하면 `false` |
| `deadband` | number | 알람이 해제되기 전에 값이 얼마나 물러나야 하는지입니다. 불감대가 없으면 한계값에 걸쳐 있는 값이 계속 깜박입니다 |
| `onDelaySec`, `offDelaySec` | int | 알람이 발생하기 전에 조건이 얼마나 유지되어야 하는지, 또는 정상으로 돌아가기 전에 얼마나 해제되어 있어야 하는지 |
| `message`, `description` | string | `message`는 `{value}`, `{limit}`, `{tag}`, `{device}`, `{unit}`, `{condition}`, `{reason}`(값이 나쁜 이유이며 정상이면 비어 있음)을 받습니다 |

`{value}`는 값 카드가 쓰는 방식 그대로 단위까지 포함해 기록됩니다. 정수는 그대로, 1 이상은 소수 둘째 자리, 100 이상은 소수 첫째 자리, 1 미만은 소수 넷째 자리, 천만을 넘거나 0.01 미만이면 과학 표기법입니다(`8.20 pH`, `212.5 F`, `1.235e+7`). 스케일이 0.1인 태그에 원시값 82가 들어오면 float로 8.200000000000001이 되고 배너가 그대로 보여 주었기 때문에 이렇게 했습니다. 텍스트 값은 있는 그대로 표시합니다. 태그, 쓰기, 자동화는 여전히 정확한 숫자를 봅니다. 반올림되는 것은 문장뿐입니다. `{limit}`는 입력한 그대로의 한계값입니다.

정의를 응답하며, 응답 전에 엔진이 다시 로드되고 알람 엔티티가 만들어집니다. 검증에 실패하면 `400`입니다(`"alarm x: priority must be 1-4, got 9"`).

### `POST /api/alarms/import/codesys`

CODESYS IDE의 Export Alarms가 쓰는 파일(알람 그룹 내보내기, `.csv`)을 요청 본문에서 읽습니다. IDE가 쓴 그대로(바이트 순서 표시가 있는 UTF-16)이거나 UTF-8이어도 됩니다. `?deviceId=`는 PLC 장치이며 필수입니다. `?application=`은 태그가 속한 애플리케이션 이름이며 생략하면 `Application`입니다. 내보내기 파일은 변수를 GVL 이름으로 적고(`GVL_Alarm.bPumpFault`) 태그는 `Application.GVL_Alarm.bPumpFault`입니다. `?defaultPriority=`(1~4)는 클래스가 Error, Warning, Info 중 하나가 아닌 알람의 우선순위입니다. `?apply=true`가 없으면 아무것도 저장되지 않고, 응답이 가져올 내용을 알려 줍니다.

알람 화면에서는 CODESYS에서 가져오기(관리자 전용)로 제공됩니다. 장치를 고르고, 애플리케이션 이름을 입력하고, 파일을 선택하고, 미리보기를 확인한 다음 가져옵니다.

`= TRUE` 또는 `= FALSE`와 비교하는 디지털 알람은 `true`와 `false`가 되고, `>`를 쓰는 UpperLimit은 `hi`, `<`를 쓰는 LowerLimit은 `lo`가 됩니다. Outside range 알람(`OutOfArea`, 두 연산자 모두 `<`)은 알람 두 개, 즉 하한의 `lo`와 상한의 `hi`가 됩니다. 메시지와 켜짐, 꺼짐 지연(`T#5s` 같은 IEC 시간)은 그대로 옮겨지고, Error는 우선순위 2, Warning은 3, Info는 4입니다. IDE가 쓸 수 있는 그 밖의 것은 읽지 않으며 해당 행과 이유와 함께 `skipped`로 돌아옵니다. CODESYS가 형식을 문서화하지 않았기 때문에 실제 내보내기에서 확인된 것만 읽습니다. IDE가 제공하는 나머지도 여기에 해당합니다. Inside the range(`ForbiddenArea`)는 두 한계 사이에서만 참인데 여기서 알람의 한계는 하나뿐이고, Change는 문서화된 지속 시간이 없으며, Event와 Alarm (API)은 PLC 프로그램이 발생시키므로 감시할 변수가 없습니다. `warnings`는 일부만 옮겨진 것(알 수 없는 클래스, 래치, 우선순위가 더 높은 알람)을 나열합니다.

```json
{"applied": false, "version": "2.0.0.0",
 "alarms": [{"id":"codesys-GVL_Alarm.rTemp-hi","name":"Temperature high","deviceId":"plc1","tagName":"Application.GVL_Alarm.rTemp","condition":"hi","limit":90,"priority":3,"enabled":true,"message":"Temperature high"}],
 "skipped": [{"row":5,"id":"3","reason":"the observation type \"Deviation\" has not been seen in an export, so it is not read"}],
 "warnings": []}
```

`404`는 알 수 없는 장치, `400`은 알람 그룹 내보내기 파일이 아닌 파일입니다.

### `DELETE /api/alarms/{id}`

`{"deleted":"extruder-temp-hi"}` 또는 `404`.

### `POST /api/alarms/{id}/ack`

선택 본문 `{"note": "checking the heater bands"}`. 알람의 현재 상태를 `ackedBy`와 `ackNote`와 함께 돌려줍니다. 알 수 없는 알람은 `404`.

### `POST /api/alarms/{id}/shelve`

`{"minutes": 30}`, 필수이며 양수여야 합니다. 기한 없는 무음은 억제이고, 억제는 다른 일이며 운전원이 할 일이 아닙니다. `state`가 `shelved`인 알람을 `shelvedUntil`, `shelvedBy`와 함께 돌려줍니다.

### `POST /api/alarms/{id}/unshelve`

본문 없음. 알람을 조건이 정하는 상태로 되돌려 돌려줍니다. 보류 상태가 아니었다면 `409`.

### `GET /api/alarms/events`

알람 감사 기록, 최신순. `?alarm=` 하나의 정의, `?limit=` (기본 200, 최대 5000).

```json
[{"id":2,"definitionId":"extruder-temp-hi","type":"acked","fromState":"unack-active","toState":"ack-active","value":23.192472931395088,"message":"extruder-1/Temperature at 22.80197037650447 C, limit 5","actor":"admin","note":"checking the heater bands","at":"2026-09-27T20:25:22.920251Z"}]
```

`type`은 `raised`, `acked`, `cleared`, `shelved`, `unshelved`, `suppressed`, `unsuppressed`, `escalated` 또는 `escalation-ended`입니다. 마지막 두 개는 알람 에스컬레이션이 기록하며(`actor`는 `escalation`), `note`에 누구에게 알렸고 체인이 왜 멈췄는지 적힙니다. [알람 알림](/ko/iot/notifications/#에스컬레이션)을 참고하세요.

## 자동화

트리거, 조건, 작업. 규칙 언어는 [자동화](/ko/iot/automations/)에 있습니다.

### `GET /api/automations`

```json
{"armed":{"fill-tank":true},"automations":[{"id":"fill-tank","name":"Fill the tank","enabled":true,"triggers":[{"type":"threshold","deviceId":"tank-farm","tagName":"level","threshold":20,"direction":"falling","hysteresis":5},{"type":"webhook","webhookPath":"fill-now"}],"actions":[{"type":"call_service","name":"start the pump","params":{"service":"switch.turn_on","entityId":"switch.tank_farm_pump"}}],"mode":"skip","minIntervalSec":60,"createdAt":"2026-09-27T20:26:49.770826Z","updatedAt":"2026-09-27T20:26:49.770826Z"}],"webhooks":["fill-now"]}
```

`armed`는 실제로 실행 중인 규칙을 나타내며, `enabled`와는 다릅니다. 컴파일이 되지 않게 된 사용 중 규칙은 무장되지 않은 상태이고, 이를 확인하는 곳이 여기입니다.

### `POST /api/automations`

규칙을 만들거나 교체합니다. `id`, `name`, `description`, `enabled`, `triggers`(하나 이상), `condition`, `actions`(하나 이상), `mode`(`skip`이 기본, `queue`, `restart` 또는 `parallel`), `minIntervalSec`, `maxRuntimeSec`. 규칙은 저장하기 전에 컴파일되며, 컴파일되지 않는 규칙은 400이 되어 데이터베이스에 들어가지 않습니다. 무장할 수 없는 저장된 규칙은 작성자가 실행 중이라고 믿는 규칙이기 때문입니다.

```json
{"error":"automation fill-tank action 1 (call_service): params: json: unknown field \"entity_id\""}
```

### `POST /api/automations/validate`

규칙을 저장하지 않고 컴파일합니다. 편집기의 실시간 확인용입니다. 항상 `200`이며, 응답에 컴파일 여부가 담깁니다.

```json
{"valid":true}
{"error":"automation bad: at least one trigger is required","valid":false}
```

규칙 작성을 돕기 위한 것이므로 `automations.write`가 필요합니다.

### `DELETE /api/automations/{id}`

`{"deleted":"fill-tank"}` 또는 `404`.

### `POST /api/automations/{id}/enabled`

`{"enabled": false}`는 규칙을 삭제하지 않고 무장 해제합니다. `{"enabled":false,"id":"fill-tank"}` 또는 `404`를 돌려줍니다.

### `POST /api/automations/{id}/trigger`

트리거가 발생한 것처럼 규칙을 지금 실행합니다. 조건은 그대로 적용되고(거짓이면 `skipped` 실행이 기록됩니다) 실행 모드도 적용됩니다. `minIntervalSec`는 적용되지 않습니다. 실행을 요청한 사람은 떨리는 태그가 아니기 때문입니다. 본문 없음. `202` `{"triggered":"fill-tank"}`: 실행은 백그라운드에서 이루어지며 결과는 `GET /api/runs`에 있습니다. 규칙이 무장되지 않았다면 `400`. 운전원은 `automations.trigger` 권한이 있습니다. 다른 사람이 만든 규칙을 실행하는 것은 운전이고, 규칙을 작성하는 것은 운전이 아닙니다.

### `GET /api/runs`

실행 이력, 최신순. `?automation=` 하나의 규칙, `?limit=` (기본 100, 최대 1000). 없으면 `[]`.

```json
[{"id":1,"automationId":"fill-tank","status":"succeeded","triggerType":"manual","triggerDesc":"triggered by admin","actor":"admin","startedAt":"2026-09-27T20:26:50.269792Z","finishedAt":"2026-09-27T20:26:50.282129Z","durationMs":12.337,"steps":[{"index":1,"type":"call_service","name":"start the pump","input":"switch.turn_on switch.tank_farm_pump {}","output":"true to tank-farm/pump: written; call 8fb9538c82d532be","startedAt":"2026-09-27T20:26:50.272532641Z","durationMs":9.595}]}]
```

`status`는 `running`, `succeeded`, `failed`, `skipped`, `timed_out` 또는 `cancelled`입니다. 단계에는 템플릿이 아니라 확정된 입력이 남습니다. 새벽 3시에 읽어야 하는 것이 바로 그것이기 때문입니다.

블루프린트로 만든 규칙은 `GET /api/automations`에 필드가 세 개 더 있습니다. `blueprintId`, `blueprintVersion`(규칙을 만든 버전이며 그대로 유지되는 버전), `blueprintInputs`입니다. 직접 작성한 규칙에는 이 필드가 없습니다. 이 필드는 서버의 것입니다. `POST /api/automations`는 받아서 무시하고, 직접 편집해도 규칙이 가진 값은 유지됩니다.

### `POST /api/automations/{id}/blueprint-upgrade`

블루프린트로 만든 규칙을 블루프린트의 최신 버전으로 옮기며, id와 이름, 무장 여부는 그대로 둡니다. 자동으로 이루어지는 일은 없습니다. 운전원은 규칙을 만들 때와 같이 `blueprints.apply` 권한이 있습니다. 먼저 확인하세요. **`?dry_run=true`**는 아무것도 바꾸지 않고, 무엇이 부분별로 바뀌는지와 규칙이 지금 실행되면 무엇을 하는지를 응답하며, 모든 쓰기는 쓰기 게이트의 검사를 거칩니다.

```json
{"dry_run":true,"id":"pump_1_watch","blueprint":"pump_watch","from":1,"to":2,"changes":[{"field":"actions","before":[{"params":{"message":"switch.pump_1 started, v1"},"type":"log_event"}],"after":[{"params":{"message":"switch.pump_1 started, v2"},"type":"log_event"}]}],"automation":{"id":"pump_1_watch","...":"..."},"check":{"automation_id":"pump_1_watch","steps":[{"step":"1","type":"log_event","verdict":"not_checked","detail":"a dry run checks writes to equipment; this step writes to none and runs only for real"}]}}
```

규칙을 만든 뒤 직접 한 편집은 `changes`에 교체되는 것으로 표시됩니다. 새 버전에 규칙이 값을 갖고 있지 않은 입력이 필요하거나, 규칙을 만들 때 쓴 값을 새 버전이 거부하면 드라이 런은 `error`에 그것만 알려 줍니다.

실제 실행은 드라이 런이 보여 준 버전인 `{"version": 2}`와 새 버전에 필요한 `inputs`를 받습니다. 그 사이 블루프린트가 새 버전으로 넘어갔거나 다른 사람이 규칙을 업그레이드했다면 `409`입니다. 검토한 것이 그대로 들어가거나, 아무것도 들어가지 않습니다. 입력이 없으면 `400`. 같은 형태로 `200`이며, `automation`은 저장된 규칙입니다. `automation upgraded from blueprint pump_watch version 1 to 2`로 기록됩니다. 같은 버전에 새 `inputs`를 주면 규칙의 입력을 바꾸는 방법이 됩니다. 직접 작성한 규칙은 `400`, 규칙의 원본 블루프린트가 없어졌다면 `404`.

## 스크립트

이름이 붙은 작업 시퀀스로, 필요할 때 실행됩니다. 여기서, 규칙의 `call_script` 단계에서, MCP의 `run_script`에서, 또는 스크립트의 엔티티(`script.turn_on`)를 통해 실행합니다. 시퀀스는 자동화 언어입니다. 단계가 하는 모든 쓰기는 시작한 사람의 출처와 함께 `script:<id>`로 쓰기 게이트를 거칩니다. 모든 내용은 [스크립트](/ko/iot/scripts/)에 있습니다.

### `GET /api/scripts`

모든 스크립트를 실행 횟수 카운터와 지금 진행 중인 실행 수와 함께 보여 줍니다. 모든 프로세스 기준입니다.

```json
[{"id":"cip_cycle","name":"CIP cycle","fields":[{"name":"minutes","type":"number","required":true,"min":1,"max":60,"unit":"min"}],"sequence":[{"type":"call_service","params":{"entityId":"switch.cip_pump","service":"switch.turn_on"}}],"mode":"skip","createdAt":"2026-09-28T10:00:00Z","updatedAt":"2026-09-28T10:00:00Z","lastRun":"2026-09-28T10:05:00Z","lastStatus":"succeeded","runCount":3,"running":0}]
```

### `POST /api/scripts`

스크립트를 만듭니다. 관리자 전용. `id`(소문자, 숫자, 밑줄이며 문자로 시작합니다. 엔티티의 오브젝트 id인 `script.<id>`입니다), `name`, `description`, `icon`, `fields`(타입이 있는 입력), `sequence`(작업 하나 이상), `mode`(`skip`이 기본, `queue`, `restart` 또는 `parallel`), `maxRuntimeSec`. 규칙처럼 저장하기 전에 컴파일되며, 직접 또는 다른 스크립트를 거쳐 스스로를 호출하는 스크립트는 거부됩니다. `201`과 함께 스크립트를 돌려줍니다. 컴파일되지 않으면 `400`, 이미 쓰는 id면 `409`.

### `POST /api/scripts/validate`

스크립트를 저장하지 않고 검사합니다. 편집기의 실시간 확인용입니다. `200` `{"valid":true}` 또는 `{"valid":false,"error":"..."}`이며, 저장이 거부될 때와 같은 말로 알려 줍니다.

### `GET /api/scripts/{id}`

목록에 나온 것과 같은 스크립트 하나. 없으면 `404`.

### `PUT /api/scripts/{id}`

정의를 교체합니다. 본문은 만들 때와 같고 `id`는 생략할 수 있습니다. 관리자 전용. 단계, 필드 또는 모드가 바뀌면 진행 중인 실행은 취소됩니다. 이전 정의로 시작된 것이기 때문입니다.

### `DELETE /api/scripts/{id}`

스크립트와 실행 이력을 삭제하고 진행 중인 실행을 취소합니다. 관리자 전용. `{"deleted":"cip_cycle"}`. 엔티티는 삭제되지 않고 고아가 됩니다.

### `POST /api/scripts/{id}/run`

실행합니다. 운전원은 `scripts.run` 권한이 있습니다.

```json
{"fields":{"minutes":20},"reason":"end of shift clean","wait":false}
```

본문의 모든 필드는 선택이며, 본문 자체도 선택입니다. 무엇이든 실행되기 전에 필드를 스크립트의 필드와 대조합니다. 범위를 벗어났거나, 단계에 맞지 않거나, 옵션에 없거나, 타입이 틀린 값은 `400`이며 맞추려고 옮기지 않습니다. 실행이 시작되는 즉시 `202`와 실행 정보를 돌려주고, `"wait":true`이면 실행이 끝난 뒤 트레이스를 포함해 `200`으로 돌려줍니다.

```json
{"run":{"id":77,"scriptId":"cip_cycle","status":"running","actor":"otto","source":"ui","fields":{"minutes":20},"startedAt":"2026-09-28T10:05:00Z","durationMs":0}}
```

사용 중일 때 `409`: 이미 실행 중이고 모드가 `skip`이거나, 하나가 대기 중인 상태로 실행 중이고 모드가 `queue`인 경우입니다. 아무것도 실행되지 않았고, 이유를 알려 주는 `skipped` 실행이 이력에 남습니다.

```json
{"error":"script busy: script cip_cycle was not started: it is already running, and its mode is skip","run":{"id":78,"scriptId":"cip_cycle","status":"skipped","...":"..."}}
```

**`?dry_run=true`**는 지금 실행하면 무엇을 하는지 묻고, 그중 아무것도 하지 않습니다. 필드는 같은 방식으로 검사하고, 이어서 각 단계를 있는 그대로의 플랜트에 대해 따라가 봅니다. 모든 쓰기와 서비스 호출은 게이트 자체의 검사를 거치고, 조건은 평가되며, 변수는 바인딩됩니다. 대기, 지연, 어떤 설비에도 쓰지 않는 모든 것은 `not_checked`입니다. 거부될 첫 번째 쓰기가 실행을 끝냈을 것처럼 여기서도 끝내며, `error`가 게이트의 말로 알려 줍니다. 거부되든 아니든 `200`과 판정을 돌려줍니다.

```json
{"dry_run":true,"check":{"script_id":"cip_cycle","fields":{"minutes":20},"steps":[{"step":"1","type":"call_service","input":"switch.turn_on switch.cip_pump {}","verdict":"refused","detail":"cip/pump: this tag is not marked writable"}],"error":"step 1 (call_service): cip/pump: this tag is not marked writable"}}
```

각 단계의 `verdict`는 `would_write`, `refused`, `ends_here`(지금 거짓인 조건 또는 중지), `not_checked` 또는 `ok`입니다. 호출하는 스크립트의 단계는 호출 아래에 번호가 붙습니다. `3.1`.

### `POST /api/scripts/{id}/stop`

진행 중인 모든 실행을 모든 프로세스에서 어디에 있든 취소합니다. `{"cancelled":1,"stopped":"cip_cycle"}`이며, `cancelled`는 이 프로세스가 가진 실행 수입니다. 운전원은 `scripts.run` 권한이 있습니다. 시작할 수 있는 것을 멈추는 것도 시작의 일부입니다.

### `GET /api/scripts/{id}/runs`

실행 목록, 최신순, 트레이스 포함. `?limit=` (기본 50, 최대 1000). `parent`는 실행을 호출한 대상으로, 있는 경우에 표시됩니다. `automation_run:812`, `script_run:77`.

```json
[{"id":77,"scriptId":"cip_cycle","status":"succeeded","actor":"automation:shift-end","source":"automation","parent":"automation_run:812","fields":{"minutes":20},"startedAt":"2026-09-28T10:05:00Z","finishedAt":"2026-09-28T10:25:00Z","durationMs":1200012,"steps":[{"index":1,"type":"call_service","input":"switch.turn_on switch.cip_pump {}","output":"true to cip/pump: written; call 8fb9538c82d532be","startedAt":"2026-09-28T10:05:00Z","durationMs":9.6}]}]
```

## 레시피

함께 적용되는 값의 묶음입니다. 제품 등급의 설정값이나 품종 전환 같은 것입니다. 각 묶음은 엔티티이기도 하며 `scene.<id>`입니다. 레시피는 무엇이든 나가기 전에 전체를 점검하고, 어떤 이유로든 전체가 거부됩니다. 이후 대상은 하나의 호출 id 아래에서 순서대로 나가며, 처음 실패한 것이 나머지를 멈추고, 아무것도 되돌려지지 않습니다. 기록된 모든 값은 장치에서 다시 읽습니다. 모든 내용은 [레시피](/ko/iot/recipes/)에 있습니다.

레시피의 이름, 설명, 설비 노드, 권한은 그 자리에서 바뀝니다. 레시피가 쓰는 내용(`targets`, `params`, `precondition`, `verify_sec`)은 버전이며, 버전은 절대 바뀌지 않습니다. 새 내용을 저장하면 다음 버전이 저장됩니다.

### `GET /api/recipes`

모든 레시피를 현재 버전의 내용과 가장 최근 적용과 함께 보여 줍니다.

```json
[{"id":"grade_a","name":"Grade A","equipment_id":7,"apply_permission":"recipes.apply","current_version":3,"params":[{"name":"speed","type":"number","min":0,"max":400,"step":10,"unit":"rpm","required":true}],"precondition":"states['input_boolean.line_ready'] == 'on'","targets":[{"entity_id":"number.line_02_zone1_sp","service":"set_value","data":{"value":210}},{"entity_id":"number.line_02_speed","service":"set_value","data_expressions":{"value":"vars.speed"}}],"verify_sec":10,"note":"zone 1 up 5","created_at":"2026-09-28T10:00:00Z","updated_at":"2026-09-28T11:00:00Z","last_application":{"id":41,"recipe_id":"grade_a","version":3,"call_id":"7c1f0e2d9a8b6c54","actor":"otto","source":"ui","params":{"speed":250},"status":"applied","targets":[],"started_at":"2026-09-28T11:05:00Z","finished_at":"2026-09-28T11:05:01Z"}}]
```

`equipment_id`는 공장 전체 레시피이면 `null`입니다.

### `POST /api/recipes`

버전 1로 하나를 만듭니다. 관리자 전용. `id`(소문자, 숫자, 밑줄이며 문자로 시작합니다. 엔티티의 오브젝트 id인 `scene.<id>`입니다), `name`, `description`, `equipment_id`, `apply_permission`(기본은 `recipes.apply`, 또는 `recipes.apply.<name>`), `params`(타입이 있는 입력), `precondition`(시작하려면 참이어야 하는 식), `targets`(하나 이상, 최대 200개, 각각 `entity_id`, `service`, `data` 또는 `data_expressions`), `verify_sec`(1에서 600, 기본 10), `note`. 대상은 값을 설정합니다. 이를 받는 도메인에서 `set_value`, `select_option`, `set_position`, `set_speed`, `set_setpoint`, `set_mode`, `turn_on`, `turn_off`를 씁니다. 펄스나 시작은 거부됩니다. 그것은 스크립트의 몫입니다. 모든 대상의 엔티티가 존재해야 하고 모든 식이 컴파일되어야 합니다. `201`과 함께 레시피를 돌려줍니다. 잘못된 것이 있으면 `400`, 이미 쓰는 id면 `409`.

### `POST /api/recipes/capture`

엔티티가 지금 가진 값으로 레시피 초안을 만듭니다. 관리자 전용이며 아무것도 저장하지 않습니다.

```json
{"entity_ids":["number.line_02_zone1_sp","switch.line_02_heater","loop.line_02_tic"]}
```

각각 현재 값으로 되돌리는 대상이 되며, 주어진 순서를 따릅니다. 루프는 모드가 되고 그다음 설정값이 됩니다. 응답은 id와 이름이 없는 레시피이며 편집기용입니다. 존재하지 않거나, 비활성화되었거나, 품질이 양호가 아닌 상태로 읽히거나, `unknown` 또는 `unavailable`이거나, 레시피가 설정하는 대상이 아닌 엔티티는 해당하는 것을 모두 짚어 `400`이 됩니다. 잘못된 읽기값으로 만든 레시피는 그 잘못된 값을 다시 씁니다.

### `GET /api/recipes/{id}`

목록에 나온 것과 같은 레시피 하나. 없으면 `404`.

### `PUT /api/recipes/{id}`

저장합니다. 관리자 전용. 본문은 `GET`이 돌려준 레시피를 편집한 것이며 `id`는 생략할 수 있습니다. `current_version`은 편집의 기준이 된 버전입니다. 그 뒤에 다른 사람이 다른 버전을 저장했다면 조용히 덮어쓰지 않고 `409`가 됩니다(`0`은 확인을 건너뜁니다). 새 내용은 다음 버전이 되고 `note`에 이유를 적습니다. 이름, 설명, 설비, 권한만 바꾸면 새 버전이 생기지 않습니다.

### `DELETE /api/recipes/{id}`

레시피와 그 버전을 삭제합니다. 관리자 전용. `{"deleted":"grade_a"}`. 적용 기록은 공장에 보낸 내용이므로 유지되고, 엔티티는 고아가 됩니다.

### `GET /api/recipes/{id}/versions`

모든 버전을 최신순으로, 저장된 그대로, 저장한 사람과 메모와 함께 보여 줍니다.

```json
[{"recipe_id":"grade_a","version":3,"params":[],"targets":[{"entity_id":"number.line_02_zone1_sp","service":"set_value","data":{"value":210}}],"verify_sec":10,"note":"zone 1 up 5","created_by":"ada","created_at":"2026-09-28T11:00:00Z"}]
```

### `GET /api/recipes/{id}/versions/{version}`

버전 하나. 레시피에 그 버전이 없으면 `404`, `{version}`이 숫자가 아니면 `400`.

### `POST /api/recipes/{id}/validate`

지금 적용하면 되는지 확인합니다. 운전원은 `recipes.apply` 권한이 있습니다. 본문은 적용과 같으며 아무것도 기록되거나 로그에 남지 않습니다. 적용이 쓰기 전에 하는 모든 점검을 수행합니다. 파라미터, 레시피 자체의 권한, 선행 조건, 데이터 식, 다른 적용이 그 엔티티 중 하나에 쓰고 있는지, 그리고 모든 대상에 대한 쓰기 게이트의 점검입니다. `200`과 함께 판정(`would_apply` 또는 `refused`)과 각 대상의 판정(`would_write`, 이유가 붙은 `refused`, `not_sent`)을 돌려줍니다.

```json
{"dry_run":true,"application":{"recipe_id":"grade_a","version":3,"params":{"speed":250},"status":"refused","targets":[{"index":1,"entity_id":"number.line_02_zone1_sp","service":"set_value","data":{"value":210},"status":"would_write"},{"index":2,"entity_id":"number.line_02_speed","service":"set_value","data":{"value":250},"status":"refused","error":"line-02/Speed: this tag is not marked writable"}],"started_at":"2026-09-28T11:04:00Z","error":"target 2 (set_value number.line_02_speed): line-02/Speed: this tag is not marked writable"}}
```

받지 않는 파라미터는 실제 적용과 마찬가지로 `400`입니다.

### `POST /api/recipes/{id}/apply`

적용합니다. 운전원은 `recipes.apply` 권한이 있습니다. 자체 권한 `recipes.apply.<name>`을 지정한 레시피는 그 권한도 필요하며, 여기서 레시피에 대해 확인합니다. 권한이 없는 사용자는 `403`을 받고, 이력에 그 사용자 이름이 붙은 거부된 적용이 남습니다.

```json
{"params":{"speed":250},"reason":"grade A for the 2pm run","version":0,"resume":0}
```

모든 것이 선택이며 본문도 선택입니다. `version`은 일부러 이전 버전을 적용하며, 생략하면 현재 버전입니다. `resume`은 이 레시피의 이전 적용 중 도중에 멈춘 것의 id입니다. 쓰이지 않은 대상이 그 버전과 파라미터로 새 적용으로 나가고, `parent`가 어느 것을 마무리하는지 알려 줍니다.

모든 값이 기록되고 다시 읽힌 뒤에 응답하며, 최대 레시피의 `verify_sec`까지 걸립니다.

```json
{"application":{"id":42,"recipe_id":"grade_a","version":3,"call_id":"9d2e4f6a8b0c1e3f","actor":"otto","source":"ui","reason":"grade A for the 2pm run","params":{"speed":250},"status":"applied","targets":[{"index":1,"entity_id":"number.line_02_zone1_sp","service":"set_value","data":{"value":210},"status":"written","writes":[{"tag":"line-02/Zone1_SP","value":"210","status":"written"}],"verification":"verified","verify_detail":"read back 210"},{"index":2,"entity_id":"number.line_02_speed","service":"set_value","data":{"value":250},"status":"written","writes":[{"tag":"line-02/Speed","value":"250","status":"written"}],"verification":"unconfirmed","verify_detail":"not confirmed within 10s: read back 240, not 250"}],"started_at":"2026-09-28T11:05:00Z","finished_at":"2026-09-28T11:05:10Z"}}
```

대상은 `written`, `failed`(나갔는데 장치가 거절했거나 아무 말도 없음), `not_sent`, `skipped`(앞의 대상이 통과하지 못함), `refused`(사전 검증)입니다. 기록된 대상은 전송 후 장치가 보낸 값을 다시 읽으면 `verified`, `verify_sec` 안에 읽지 못하면 `unconfirmed`입니다. 나가기는 했지만 반영되지 않았을 수 있습니다. 모든 쓰기에는 적용의 `call_id`가 붙으므로 `GET /api/writes?call=<call_id>`가 전부입니다.

| 상태 | 시점 |
|---|---|
| 200 | `applied`: 모든 대상이 기록됨. 각 대상의 `verification`을 확인하세요 |
| 400 | 레시피가 받지 않는 파라미터, 범위를 벗어났거나 타입이 틀림. 적용할 것이 남지 않은 `resume` |
| 403 | 레시피 자체의 권한. 거부된 적용으로 기록됨 |
| 404 | 그런 레시피가 없거나 그런 버전이 없음 |
| 409 | `refused`: 시작하지 않는 모든 이유가 `error`와 해당 대상에 표시됨. 또는 다른 적용이 지금 그 엔티티 중 하나에 쓰는 중. 아무것도 기록되지 않음 |
| 502 | `partial` 또는 `failed`: 시작되었지만 모든 대상이 나가지는 않음. `targets`가 정확히 어느 것인지 알려 줌. 아무것도 되돌려지지 않음 |

잘못된 본문에 대한 `400`이나 `404`를 제외한 모든 응답은 적용을 담고 있으며, 드라이 런을 제외한 모든 적용은 거부를 포함해 `GET /api/recipes/{id}/applications`에 있습니다.

### `GET /api/recipes/{id}/applications`

적용 기록, 최신순, 거부된 것 포함. `?limit=`(기본 50, 최대 1000). `parent`는 적용한 대상이 있는 경우 그 대상입니다. `automation_run:812`, `script_run:77`, `application:41`. 삭제된 레시피의 적용 기록도 계속 응답합니다.

## 블루프린트

한 번 작성하고 타입이 있는 빈칸을 채워 일반 규칙을 만드는 자동화입니다. 규칙은 만든 버전을 유지합니다. 블루프린트를 편집해도 어떤 규칙도 바뀌지 않으며, 규칙을 새 버전으로 옮기는 것은 누군가 요청하는 [업그레이드](#post-apiautomationsidblueprint-upgrade)입니다. 규칙이 하는 모든 쓰기는 `automation:<id>`로 쓰기 게이트를 거칩니다. 모든 내용은 [블루프린트](/ko/iot/blueprints/)에 있습니다.

### `GET /api/blueprints`

모든 블루프린트를 내장된 것부터 보여 주며, 각각 그것으로 만든 규칙 수를 함께 표시합니다.

```json
[{"id":"motor_running_too_long","name":"Motor running too long","description":"Says so when a motor has been running longer than it should...","source":"builtin","version":1,"inputs":[{"name":"motor","label":"Motor","type":"entity","required":true,"domain":["motor"]},{"name":"max_run","label":"Longest it may run","type":"duration","default":3600},{"name":"stop_it","label":"Stop it as well","type":"boolean","default":false}],"template":{"triggers":[{"type":"state","entityId":{"!input":"motor"},"to":"running","forSec":{"!input":"max_run"}}],"...":"..."},"instances":2}]
```

`source`는 `builtin`(바이너리에 포함, 읽기 전용) 또는 `user`입니다.

### `POST /api/blueprints`

하나를 작성합니다. 관리자 전용. `id`(소문자, 숫자, 밑줄이며 문자로 시작), `name`, `description`, `inputs`(스크립트의 필드와 같은 타입 지정 입력), `template`: 규칙 자체로, `description`, `triggers`, `condition`, `actions`, `mode`, `minIntervalSec`, `maxRuntimeSec`와 그 안의 빈칸을 가집니다. 값으로 쓴 `{"!input": "motor"}`는 입력으로 대체되며, 문자열 안의 `${motor}`도 마찬가지입니다. 문자열이 식인 곳에서는 리터럴로 들어갑니다. 저장하기 전에 점검합니다. 모든 빈칸은 입력을 가리키고, 모든 입력이 사용되며, 샘플 값으로 채웠을 때 컴파일되는 규칙이 되어야 합니다. `version` 1로 `201`. 잘못된 것이 있으면 `400`, 이미 쓰는 id면 `409`이며 내장 블루프린트의 id도 포함합니다.

### `GET /api/blueprints/{id}`

목록에 나온 것과 같은 블루프린트 하나. 없으면 `404`.

### `PUT /api/blueprints/{id}`

정의를 교체합니다. 본문은 작성할 때와 같고 `id`는 생략할 수 있습니다. 관리자 전용. `inputs`나 `template`이 바뀌면 `version`이 1 올라가며, 이름이나 설명만 바뀌면 올라가지 않습니다. **그것으로 만든 어떤 규칙도 바뀌지 않습니다.** 각 규칙은 만든 버전을 유지하며 `GET /api/automations`에서 어느 버전인지 볼 수 있습니다. 내장 블루프린트는 `400`입니다. 자신의 id로 복사하세요.

### `DELETE /api/blueprints/{id}`

관리자 전용. `{"deleted":"pump_watch"}`. 그것으로 만든 규칙이 하나라도 있는 동안은 해당 규칙을 짚어 `409`입니다. 그 규칙을 먼저 삭제하세요. 내장 블루프린트는 `400`.

### `POST /api/blueprints/{id}/instantiate`

블루프린트로 규칙을 만들고 무장합니다. 운전원은 `blueprints.apply` 권한이 있습니다. 어느 펌프를 얼마나 오래 쓸지는 운전원이 고르고, 규칙이 무엇을 하는지는 블루프린트를 작성할 때 정해졌습니다.

```json
{"automationId":"infeed_too_long","name":"Infeed pump ran too long","enabled":true,"inputs":{"motor":"motor.infeed_pump","max_run":"90m","stop_it":true}}
```

`name`의 기본값은 블루프린트의 이름이고 `enabled`의 기본값은 `true`입니다. 무엇이든 만들기 전에 모든 입력을 점검합니다. 범위를 벗어났거나, 단계에 맞지 않거나, 옵션에 없거나, 다른 도메인의 엔티티이거나, 타입이 틀린 값은 틀린 것을 모두 짚어 `400`이 되며, 맞추려고 옮기지 않습니다. 이미 쓰는 `automationId`는 `409`입니다. 규칙을 만들어 기존 규칙을 교체하는 일은 없습니다. 규칙과 함께 `201`을 돌려주며 `blueprintId`, `blueprintVersion`, `blueprintInputs`가 설정됩니다. `automation made from blueprint motor_running_too_long version 1`로 기록됩니다.

**`?dry_run=true`**는 아무것도 만들지 않습니다. 만들게 될 규칙과 그 규칙이 지금 발동하면 무엇을 하는지를 응답합니다. 조건이 평가되고, 모든 쓰기와 서비스 호출은 `automation:<id>`로 게이트의 점검을 거치며, 첫 거부는 게이트의 말로 `check.error`에 담깁니다. 아무것도 저장, 기록, 감사되지 않습니다.

```json
{"dry_run":true,"automation":{"id":"infeed_too_long","...":"..."},"check":{"automation_id":"infeed_too_long","steps":[{"step":"1","type":"log_event","verdict":"not_checked"},{"step":"2","type":"condition","input":"true","verdict":"ok","detail":"true now"},{"step":"3","type":"call_service","input":"motor.stop motor.infeed_pump {}","verdict":"would_write","detail":"would write false to line-02/M1_Run"}]}}
```

## 대시보드

이를 필요로 하는 역할과 화면을 위한 카드 페이지입니다. 대시보드는 아무것도 명령하지 않습니다. 카드는 태그, 엔티티, 스크립트 또는 레시피를 가리키고, 카드의 버튼은 누른 사람의 이름으로 [`POST /api/write`](#post-apiwrite)를 통해 씁니다. 월 보드도 그중 하나입니다. 모든 내용은 [대시보드](/ko/iot/dashboards/)에 있습니다.

### `GET /api/dashboards`

호출자에게 제공되는 대시보드를 전환기가 보여 주는 순서대로, 월 보드를 포함해 돌려줍니다. `dashboards.write` 권한이 있으면 모두 제공됩니다.

```json
[{"id":"wall","name":"Wall board","description":"The tags pinned on the Board screen, as gauges.","kind":"wall","roles":[],"homeFor":[],"screens":["wall-tv"],"position":0,"cards":[],"version":2,"updatedBy":"ada"},
 {"id":"line-2","name":"Line 2","kind":"cards","roles":["operator","admin"],"homeFor":["operator"],"screens":["line-2-panel"],"position":1,"version":3,"updatedBy":"ada","cards":[{"id":"temp","type":"gauge","title":"Zone 1","w":3,"h":3,"config":{"tag":"press-01/Zone1_Temp"}}]}]
```

### `POST /api/dashboards`

하나를 만듭니다. 관리자 전용. `id`(소문자, 숫자, 하이픈, 밑줄이며 문자로 시작), `name`, 그리고 선택으로 `description`, `roles`, `homeFor`, `screens`, `position`, `cards`. `version` 1로 `201`이며, 모든 카드의 크기와 설정이 저장된 형태로 들어 있습니다.

카드는 `id`, `type`, `title`, `w`(1에서 12열), `h`(1에서 8행), `config`입니다. 유형과 그 설정은 [대시보드](/ko/iot/dashboards/#카드)에 있습니다. 저장하기 전에 점검합니다.

- 유형에 없는 설정 키, 범위를 벗어난 숫자, 로그인이나 토큰이 들어 있는 카메라 또는 평면도 주소, 또는 60개를 넘는 카드는 `400`입니다.
- 존재하지 않는 태그, 엔티티, 스크립트 또는 레시피를 가리키는 카드는 그것을 짚어 `400`입니다.
- 쓸 수 없는 태그에 대한 `button`, 또는 태그의 범위를 벗어난 숫자는 `400`입니다. 게이트가 모든 누름을 거부할 것이기 때문입니다.
- 존재하지 않는 역할은 `400`입니다.
- 이미 쓰는 `id`, 다른 대시보드가 이미 가진 화면, 또는 다른 대시보드가 이미 홈인 역할의 홈은 `409`입니다.

### `GET /api/dashboards/{id}`

목록에 나온 것과 같은 대시보드 하나. 없거나 호출자에게 제공되지 않으면 `404`.

### `PUT /api/dashboards/{id}`

교체합니다. 관리자 전용. 본문은 `GET`이 돌려준 대시보드이며, `version`은 읽은 시점의 버전으로 설정합니다. **필수입니다.** 더는 현재가 아닌 버전을 지정한 저장은 현재 버전이 무엇인지 알려 주는 `409`가 됩니다. 그렇지 않으면 마지막으로 저장한 사람이 방금 만든 것이 조용히 지워지기 때문입니다. 본문에서 `id`는 생략할 수 있고, `kind`는 바꿀 수 없으며, `createdAt`, `updatedAt`, `updatedBy`는 서버의 것이므로 무시됩니다. 다음 버전의 대시보드와 함께 `200`.

월 보드는 할당(`roles`, `homeFor`, `screens`, `position`)에 대해서만 `PUT`을 받고 그 밖에는 받지 않습니다. 카드가 없으므로 카드가 있는 것은 `400`입니다. 게이지는 보드의 태그이며 `GET`과 `PUT /api/board`입니다.

### `DELETE /api/dashboards/{id}`

관리자 전용. `{"deleted":"line-2"}`. 카드는 대상을 가리킬 뿐 아무것도 소유하지 않으므로 다른 것은 건드리지 않습니다. 월 보드는 `400`입니다. 항상 존재하기 때문입니다.

생성, 저장, 삭제는 주체 `dashboard:<id>`에 대한 `config` 이벤트로 기록됩니다.

### `GET /api/dashboards/{id}/export`

화면 파일로 된 대시보드입니다. 버전이 있는 JSON 문서이며 [`POST /api/dashboards/import`](#post-apidashboardsimport)가 다른 설치로 불러옵니다. `<id>.hotloop-screen.json`이라는 첨부 파일로 응답합니다. 호출자는 `dashboards.read`가 필요하고 해당 대시보드가 제공되어야 하며, 하나를 `GET`할 때와 같습니다. 월 보드는 `400`입니다. 레이아웃이 아니라 설치에 고정된 게이지이기 때문입니다. 형식은 [화면 파일](/ko/iot/screen-file/)에 있습니다.

### `POST /api/dashboards/import`

화면 파일을 읽어 이 설치에 맞는지 점검하고 새 대시보드로 저장합니다. 관리자 전용이며, `POST /api/dashboards`가 거부할 것은 저장할 수 없습니다. 본문은 파일 자체이거나, 옵션을 옆에 둔 `{"file": {...}}`입니다.

| 옵션 | <span class="sr-only">세부 정보</span> |
|---|---|
| `id`, `name` | 다른 id나 이름으로 저장합니다. |
| `replace` | id가 이미 쓰이면 그 대시보드를 현재 버전에서 덮어씁니다. 이것이 없으면 이미 쓰는 id는 `409`입니다. |
| `skipAssignments` | 파일을 만든 설치에 속하는 `screens`와 `homeFor`를 제외합니다. `roles`는 유지됩니다. |
| `remap` | 여기서 무엇이라 부를지입니다. `tags`(파일이 태그를 가리키는 그대로, 또는 `devices`가 옮긴 뒤에 읽히는 그대로의 전체 키에서 전체 키로), `devices`(id에서 id로, `tags`에 없는 모든 태그의 장치 부분도 함께 옮깁니다), `entities`, `scripts`, `recipes`, `equipment`(id에서 id로). 화면에서 아무것도 쓰지 않은 항목은 경고입니다. |
| `dryRun` | 보고서를 응답하고 아무것도 저장하지 않습니다. 항상 `200`입니다. |
| `codesys`, `visualization` | `file` 대신: CODESYS 네이티브 내보내기의 텍스트와, 여러 개가 있을 때 사용할 시각화입니다. 이때 보고서에는 각 요소가 무엇이 되었고 무엇이 빠졌는지를 담은 `conversion`이 있습니다. [CODESYS 화면 가져오기](/ko/iot/codesys-screen-import/)를 참고하세요. |

응답은 저장 여부와 관계없이 보고서입니다.

```json
{"ok":false,"dryRun":true,"id":"line-2","name":"Line 2","cards":6,"replaces":false,
 "problems":[{"kind":"tag","ref":"press-01/Zone1_Temp","message":"tag press-01/Zone1_Temp does not exist here; map it to one that does, or add it on the Tags screen first"}],
 "warnings":[],"remapped":[],
 "requires":{"tags":[{"key":"press-01/Zone1_Temp","writable":false}],"entities":[],"scripts":[],"recipes":[],"devices":[],"equipment":[]}}
```

빠진 참조는 첫 번째만이 아니라 모두 나열됩니다. `kind`는 `file`(화면 파일이 아님, 잘못된 형식, 이 빌드가 읽는 것보다 새로운 형식 버전, 또는 모르는 필드), `screen`(대시보드 자체의 규칙: 잘못된 카드, 존재하지 않는 역할, 너무 큼), `tag`, `entity`, `script`, `recipe`, `device`, `equipment`, `writable`(쓸 수 없는 태그의 버튼 또는 설정값), `assignment`(다른 대시보드가 가진 화면 이름 또는 역할의 홈), `exists`(id가 이미 쓰임) 중 하나입니다. 문제가 하나라도 있는 가져오기는 아무것도 저장하지 않습니다. `400`이며, 문제가 `exists`나 `assignment`뿐이면 같은 보고서와 함께 `409`입니다. 성공은 `201`이고, 기존 것을 교체하면 `200`이며 보고서와 저장된 `dashboard`가 함께 옵니다. 주체 `dashboard:<id>`에 대한 `config` 이벤트로 기록됩니다.

## 웹훅

### `POST /api/webhook/{path}`

해당 경로에 `webhook` 트리거가 있는 모든 자동화를 발동합니다. **세션도 권한도 없습니다.** 경로가 제3자에게 주어진 비밀이며, 이 엔드포인트가 늘 가져온 같은 신뢰 모델입니다. SCADA 시스템이나 SaaS 콜백에는 로그인할 계정이 없습니다. 아무도 추측할 수 없는 경로를 고르세요.

최대 1 MiB의 본문이 규칙에 전달됩니다. `202` `{"accepted":"fill-now"}`. 수신하는 것이 없으면 `404` `"no automation is listening on this webhook path"`입니다. 아무것도 없는 곳에 보내는 웹훅은 잘 작동하는 웹훅과 똑같아 보이므로 그렇게 알려 줍니다.

## 플릿

등록된 엣지 릴레이, Sparkplug를 통한 실시간 상태, 그리고 릴레이로 보내는 명령입니다. `HOTLOOP_FLEET_ENABLED`가 필요합니다. [플릿 관리](/ko/gateway/fleet/)를 참고하세요.

### `GET /api/fleet`

```json
{"configured":true,"members":[{"id":"press-relay-01","name":"Press line relay","group":"plant-a","nodeId":"press-relay-01","statusUrl":"http://press-relay-01:8081","enabled":true,"createdAt":"2026-09-27T20:28:49.448323Z","updatedAt":"2026-09-27T20:28:49.448323Z","online":false,"polled":true,"error":"Get \"http://press-relay-01:8081/status\": dial tcp: lookup press-relay-01 on 10.89.0.1:53: no such host"}]}
```

`online`은 NBIRTH와 NDEATH에서 옵니다. `release`는 릴레이가 마지막 birth에서 실행 중이라고 알린 빌드입니다. `version`, `imageDigest`(감독자가 알려 줄 때. Helm 차트는 알리지 않습니다), `since`(Gateway가 그 빌드를 처음 들은 시점)입니다. 보고하기에 너무 오래된 릴레이는 없습니다. `statusUrl`이 있는 멤버는 `polled`가 true이고, `reachable`, `forwardQueueLen`, `devices`, `connected`, `config`, `updateMode`(`auto` 또는 `approve`)가 그 `/status`에서 옵니다. 닿지 않았을 때는 아무 의미가 없습니다. 기능이 꺼져 있으면 `{"members":[],"configured":false}`.

### `POST /api/fleet`

멤버를 만들거나 교체합니다. `id`, `name`, `group`, `nodeId`(Sparkplug 신원)는 필수이고 `description`, `statusUrl`(`http://` 또는 `https://`), `enabled`는 선택입니다. 멤버를 돌려줍니다. 이 호출은 기능이 꺼져 있어도 작동하므로, 켜기 전에 플릿을 선언해 둘 수 있습니다.

### `DELETE /api/fleet/{id}`

`{"deleted":"press-relay-01"}`, 또는 `404`.

### `POST /api/fleet/{id}/rebirth`

릴레이에 `Node Control/Rebirth`를 게시합니다. 본문 없음. `{"status":"rebirth requested"}`. 알 수 없는 멤버는 `404`.

### `POST /api/fleet/{id}/restart`

`Node Control/Reboot`를 게시합니다. `{"status":"restart requested"}`. 관리자 전용입니다. 릴레이를 재시작하면 돌아올 때까지 데이터가 끊깁니다.

### `POST /api/fleet/{id}/update`

릴레이가 보류 중인 이미지 업데이트를 승인합니다. `Node Control/Update`를 게시합니다. `{"status":"update approved"}`. 관리자 전용입니다. 릴레이가 종료되고 감독자가 따르는 이미지를 시작하므로, 그동안 데이터가 끊깁니다. `HOTLOOP_EDGE_RELAY_UPDATE_MODE=approve`로 설정된 릴레이에서만 작동하며, 다른 릴레이는 무시했다고 기록합니다. 요청은 이미지를 지정하지 않습니다. 이미지를 넣을 곳이 없으며, 그것이 요점입니다. [Edge Relay 참조](/ko/edge-relay/reference/#relay-업데이트)를 참고하세요.

### `POST /api/fleet/{id}/config`

릴레이에 새 장치 파일을 푸시하면 릴레이가 이를 실시간으로 적용합니다. 재시작이 없고, 브로커 세션과 전달 큐가 유지되며, 파일이 바꾸지 않은 모든 장치는 연결된 채로 남습니다. 본문은 **장치 파일 자체**이며 아무것에도 감싸지 않은 원시 JSON입니다. 무엇이든 게시하기 전에 검증됩니다(아니면 `400` `"invalid device file: ..."`). `{"status":"config pushed"}`는 브로커가 받았다는 뜻입니다. 릴레이가 실행 중인지는 `GET /api/fleet`에서 해당 멤버의 `config.digest`가 알려 주고, 릴레이가 거부한 파일은 거기에 `config.rejected`로 표시됩니다. 관리자 전용입니다. 릴레이가 폴링하는 대상을 바꿉니다. [플릿 관리](/ko/gateway/fleet/#설정-푸시)를 참고하세요.

### `DELETE /api/fleet/{id}/config`

푸시를 취소합니다. 브로커에 보관된 설정을 지워서 이후 어떤 부팅에서도 적용되지 않게 하며, 지금 연결된 릴레이는 푸시된 파일을 버리고 실시간으로 로컬 장치 파일로 돌아갑니다. 본문 없음. `{"status":"config push cleared"}`, 알 수 없는 멤버는 `404`, Gateway가 브로커에 연결되지 않았으면 `503`. 푸시와 같이 관리자 전용입니다. 아무것도 재시작하지 않습니다. 릴레이가 온라인인 동안 보내세요. 오프라인 릴레이는 이를 듣지 못합니다. [Edge Relay 참조](/ko/edge-relay/reference/#푸시된-파일의-위치와-우선하는-파일)를 참고하세요.

## 알림

알람이 발생하면 웹훅, SMTP, ntfy 또는 Gotify로 휴대폰을 호출하고, 아무도 확인하지 않으면 다음 사람에게 알립니다. `HOTLOOP_NOTIFY_ENABLED`가 필요합니다.

### `POST /api/notify/test`

구성된 모든 채널로 지금 합성 알람 알림을 보내, 실제 알람보다 먼저 SMTP 릴레이가 거부한다는 것을 알 수 있게 합니다. 본문 없음. `HOTLOOP_NOTIFY_ENABLED`가 필요합니다. 관리자 전용입니다. 실제 메시지를 보내며 공급자가 허용하는 할당량을 소모합니다.

```json
{"results":[{"channel":"smtp","success":true}]}
```

각 채널이 작동했는지와 관계없이 `200`이며, 각 결과가 알려 줍니다. 실패한 것에는 `error`가 있습니다. 실패한 웹훅은 스킴과 호스트만 밝히고 그 밖에는 아무것도 밝히지 않습니다. 대부분의 호출 서비스에서 URL이 자격 증명이기 때문입니다. [알람 알림](/ko/iot/notifications/)을 참고하세요.

### `GET /api/notify/escalation`

알람 에스컬레이션 정책, 단계가 지정할 수 있는 채널, 지금 열려 있는 체인입니다. `HOTLOOP_NOTIFY_ENABLED`가 설정되지 않았으면 `available`은 `false`이고 정책은 꺼져 있으며 채널은 없습니다. 이때도 응답은 `200`입니다. 읽기와 쓰기 모두 관리자 전용입니다. 정책에는 사람들의 ntfy 토픽이 들어 있고, 누구나 접근할 수 있는 서버에서 이는 비밀번호와 같기 때문입니다.

```json
{"available":true,"policy":{"enabled":true,"minPriority":"high","contacts":[{"name":"Ana","ntfyTopic":"ana-phone-3f9c","emails":["ana@plant.test"]}],"steps":[{"afterMinutes":5,"contacts":["Ana"]},{"afterMinutes":10,"channels":["gotify"]}],"repeatEveryMinutes":15,"repeatTimes":2},"channels":["smtp","ntfy","gotify"],"active":[{"alarmId":"boiler-hi","name":"Boiler Trip","raisedAt":"2026-10-21T03:00:00Z","sent":1,"total":4,"nextAt":"2026-10-21T03:15:00Z"}],"limits":{"steps":10,"contacts":50,"repeats":20,"minutes":1440}}
```

`channels`는 이 HotLoop에 구성된 것이며, 단계가 지정할 수 있는 전부입니다. `active`는 체인을 따라 진행 중인 모든 알람입니다. 정책이 가진 전송 횟수(단계, 그다음 반복) 중 몇 번이 나갔는지, 다음은 언제인지를 보여 줍니다. 아직 저장된 것이 없으면 `{"policy":{"enabled":false},...}`입니다. 꺼져 있고 아무것도 들어 있지 않습니다.

### `PUT /api/notify/escalation`

정책 전체를 교체합니다. 패치가 아니며 `GET`이 응답할 것을 응답합니다. 지금부터 발생하는 알람에 적용됩니다. 알림이 활성화되지 않았으면 `400`.

```json
{"enabled":true,"minPriority":"high",
 "contacts":[{"name":"Ana","ntfyTopic":"ana-phone-3f9c","emails":["ana@plant.test"]}],
 "steps":[{"afterMinutes":5,"contacts":["Ana"]},{"afterMinutes":10,"channels":["gotify"]}],
 "repeatEveryMinutes":15,"repeatTimes":2}
```

`minPriority`는 `critical`, `high`(기본), `medium`, `low`입니다. 단계는 앞 단계 후 `afterMinutes`(1에서 1440)에 예정되며(첫 단계는 알람 발생 후), 목록의 `contacts`, 배포에 있는 `channels`, 또는 둘 다를 지정합니다. 단계는 최대 10개, 연락처는 50개, 반복은 20회입니다. 알 수 없는 필드는 거부됩니다.

정책이 작동할 수 없을 때 이유와 함께 `400`이 되며, 조치할 수 있는 말로 알려 줍니다. 아무도 지정하지 않은 단계, 목록에 없는 연락처, 이 HotLoop에 구성되지 않은 채널(응답에 있는 채널이 나열됨), ntfy가 구성되지 않은 ntfy 토픽이나 이메일이 구성되지 않은 주소, 단순하지 않은 주소, 간격이 없는 반복입니다. 거부되면 아무것도 저장되지 않습니다. 저장은 토픽을 뺀 채 시스템 로그에 남습니다. [알람 알림](/ko/iot/notifications/#에스컬레이션)을 참고하세요.

### `POST /api/notify/ack/{token}`

ntfy 알림의 **확인** 버튼입니다. 이를 누르는 휴대폰에는 보낼 세션이 없으므로 **세션도 권한도 없습니다.** 경로의 서명된 토큰이 인가이며, 이 토큰이 인가하는 것은 만료되기 전에(`HOTLOOP_NOTIFY_ACK_TTL`, 기본 12시간) 하나의 알람의 한 번의 발생을 한 번 확인하는 것뿐입니다. 어제 출동 때의 버튼으로 오늘의 알람을 확인할 수 없습니다. 일부러 `POST`입니다. 링크 미리보기와 보안 스캐너는 링크를 스스로 열며, 알람이 로봇에 의해 확인되어서는 안 되기 때문입니다. 본문 없음. 확인된 알람으로 응답합니다(형태는 핸들러에서 가져온 것입니다. 이 문서의 다른 예시는 실행 중인 Gateway에서 캡처했지만, 이것은 그 Gateway에 ntfy가 없어서 캡처하지 못했습니다).

```json
{"acknowledged":true,"alarmId":"extruder-temp-hi","name":"Extruder temperature high","state":"ack-active","ackedBy":"notify:ntfy"}
```

확인 링크를 끈 경우:

```json
{"error":"acknowledge links are not enabled on this HotLoop (they need HOTLOOP_PUBLIC_URL and a channel that carries a button)"}
```

알람 엔진을 거치는 일반 확인이며 `notify:<channel>`로 감사됩니다. 모든 거부는 응답되고 기록됩니다. 아무 말 없이 아무것도 하지 않는 버튼은 아무도 누르지 않은 버튼과 똑같아 보이기 때문입니다.

| 상태 | 시점 |
|---|---|
| 403 | 위조되었거나, 변경되었거나, 다른 비밀로 서명됨 |
| 404 | 알람이 더 이상 없거나 확인 링크가 꺼져 있음(`HOTLOOP_PUBLIC_URL`과 버튼이 있는 채널이 필요) |
| 409 | 이미 사용되었거나, 그 뒤에 알람이 다시 발생했거나, 확인할 것이 남아 있지 않음 |
| 410 | 진짜이지만 만료됨 |
| 503 | 확인을 저장하지 못했습니다. 두 번째 누름이 여전히 작동할 수 있도록 링크가 반환됩니다 |

응답에는 `Access-Control-Allow-Origin: *`가 있어 ntfy 웹 앱이 자신의 출처에서 이를 누를 수 있습니다. 이 경로에서는 쿠키를 읽지 않습니다. 토큰은 어디에도 기록되거나 반환되지 않습니다. [알람 알림](/ko/iot/notifications/#확인-링크)을 참고하세요.

## 백업

테이블 데이터만 담은 논리적 데이터베이스 스냅샷입니다. `HOTLOOP_BACKUP_ENABLED`가 필요합니다. 둘 다 관리자 전용입니다. 목록에는 사용자와 세션을 포함해 모든 테이블의 행 수가 표시됩니다. **복원 엔드포인트는 없습니다.** 일부러 그렇게 했습니다. 복원은 바이너리의 플래그이며, 데이터베이스가 이를 받아야 한다는 것을 아는 사람이 한 번 실행하는 것이지, 운영 중인 데이터베이스에 대한 네트워크 호출이 아닙니다. [백업과 복원](/ko/iot/backup/#백업-복원)을 참고하세요.

### `GET /api/backup`

볼륨에 있는 백업을 각각의 매니페스트와 함께 보여 줍니다.

```json
{"backups":[{"name":"20260927T202912Z","bytes":98567,"manifest":{"hotloopVersion":"4.16.0","schemaMigrations":["0001_core.sql","...","0007_service_audit.sql"],"createdAt":"2026-09-27T20:29:12.970721945Z","tables":[{"name":"devices","rows":2,"columns":[{"name":"id","type":"text"},{"name":"...","type":"..."}]}]}}],"configured":true}
```

### `POST /api/backup`

지금 하나를 만들고 완료될 때까지 기다립니다(최대 30분. 큰 `tag_history`는 시간이 걸립니다). 본문 없음. 매니페스트로 응답합니다. 버전, 마이그레이션, 모든 테이블의 행과 열입니다.

## 예약 보고서

히스토리안 요약을 CSV와 HTML로, 일정에 따라 이메일 또는 다운로드로 제공합니다. `HOTLOOP_REPORTS_ENABLED`가 필요합니다. 뷰어는 읽고, 운전원은 실행하고, 관리자는 정의합니다. 정의에는 공장 데이터를 이메일로 보낼 곳이 들어 있습니다. 정의의 필드는 [예약 보고서](/ko/gateway/reports/)를 참고하세요.

### `GET /api/reports`

```json
{"configured":true,"reports":[{"id":"line1-hourly","name":"Line 1 hourly","enabled":true,"tags":[{"deviceId":"extruder-1","tagName":"Temperature"},{"deviceId":"extruder-1","tagName":"Pressure"}],"window":{"count":1,"unit":"hours","end":"run_time"},"bucket":"window","aggregations":["min","max","avg"],"schedule":{"kind":"daily","at":"06:00"},"format":"both","recipients":["shift-lead@example.com"],"retain":10,"createdAt":"2026-09-27T20:29:23.300978Z","updatedAt":"2026-09-27T20:29:23.300978Z","nextRunAt":"2026-09-28T06:00:00Z"}],"smtpConfigured":true,"timezone":"UTC"}
```

각 정의에는 `nextRunAt`과 가장 최근 실행이 `lastRun`으로 들어 있습니다.

### `POST /api/reports`

정의를 만듭니다. 본문은 위와 같은 정의입니다. `201`. 검증에 실패하면 `400`(`"report line1-hourly: window end \"now\" must be run_time or local_midnight"`), id가 있으면 `409`.

### `GET /api/reports/{id}`

목록에 나온 것과 같은 정의 하나. 알 수 없는 것은 `404`.

### `PUT /api/reports/{id}`

정의 전체를 교체합니다. id는 바꿀 수 없습니다(본문의 것이 다르면 `400`). `nextRunAt`과 `lastRun`은 받아들여 무시하므로, 읽은 것을 그대로 다시 보내도 됩니다.

### `DELETE /api/reports/{id}`

실행과 파일을 포함해 삭제하고, 진행 중인 실행을 취소합니다. `{"deleted":"line1-hourly"}`, 또는 `404`.

### `POST /api/reports/{id}/run`

지금 실행하고 기다립니다. `?deliver=false`는 아무에게도 이메일을 보내지 않고 생성해 저장하며, 정의를 시험해 볼 때 씁니다. `200`은 실행이 이루어졌다는 뜻이고, 보고서가 잘 만들어졌는지는 그 자체의 `status`가 알려 줍니다. 실패한 실행은 잘못된 요청이 아니라 결과이며, 어느 쪽이든 기록됩니다.

```json
{"id":1,"reportId":"line1-hourly","trigger":"manual","actor":"admin","status":"succeeded","startedAt":"2026-09-27T20:29:54.06926Z","finishedAt":"2026-09-27T20:29:54.092456655Z","windowStart":"2026-09-27T19:29:54.06926Z","windowEnd":"2026-09-27T20:29:54.06926Z","tags":2,"rows":2,"readings":984,"excluded":2,"files":[{"format":"csv","name":"20260927T202954Z-1.csv","bytes":338},{"format":"html","name":"20260927T202954Z-1.html","bytes":2430}],"emailStatus":"skipped","emailTo":["shift-lead@example.com"]}
```

true나 false가 아닌 `deliver`는 `400`, 알 수 없는 보고서는 `404`.

### `GET /api/reports/{id}/runs`

`{"runs": [...]}`, 최신순, `?limit=` 기본 50, 최대 500. 알 수 없는 보고서는 빈 목록이 아니라 `404`.

### `GET /api/reports/{id}/runs/{run}/download`

저장된 파일 하나를 첨부 파일로 스트리밍합니다. `?format=csv` 또는 `html`.

```
HTTP/1.1 200 OK
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="20260927T202954Z-1.csv"
Cache-Control: private, no-store

device_id,tag_name,unit,period_start,period_end,min,max,avg,excluded
extruder-1,Temperature,C,2026-09-27T19:29:54+00:00,2026-09-27T20:29:54+00:00,19.50001230192043,23.499980145373126,21.508905654397623,1
```

HTML은 `sandbox` Content-Security-Policy와 함께 제공됩니다. 보고서는 읽는 문서이지 무엇이든 실행할 수 있는 페이지가 아닙니다. 열리는 파일은 실행 기록이 가리키는 파일이며, URL의 어떤 것도 경로의 일부가 되지 않습니다. 실행 번호가 숫자가 아니거나 형식이 둘 중 어느 것도 아니면 `400`, 존재하지 않는 실행이나 파일은 `404`.

## 사이트

### `GET /api/sites`

Gateway가 연합하는 모든 사이트에 MCP로 공장 상태를 병렬로 요청합니다. 사이트당 6초이므로 죽은 사이트 하나가 나머지를 붙잡지 못합니다. 사이트는 설정의 아웃바운드 MCP 서버입니다. [MCP](/ko/iot/mcp/#사이트-연합)를 참고하세요.

```json
{"configured":true,
 "rollup":{"sites":2,"reachable":1,"devices":2,"connected":2,"tags":5,"outstandingAlarms":1,"unacknowledgedAlarms":1,"criticalAlarms":0},
 "sites":[{"name":"plant-a","reachable":true,"latencyMs":14,"plant":"Demo Plant","uptime":"1m25s","devices":2,"connected":2,"degraded":0,"disconnected":0,"tags":5,"outstandingAlarms":1,"unacknowledgedAlarms":1,"criticalAlarms":0,"writesEnabled":true},
          {"name":"plant-c","reachable":false,"error":"connect to MCP server \"plant-c\": calling \"initialize\": ... no such host","latencyMs":49,"devices":0,"connected":0,"degraded":0,"disconnected":0,"tags":0,"outstandingAlarms":0,"unacknowledgedAlarms":0,"criticalAlarms":0,"writesEnabled":false}]}
```

연결할 수 없는 사이트의 수치는 의미가 없으므로 합계에서 제외합니다. 닿지 않는 사이트를 알람 0건으로 세는 것은 이 화면이 할 수 있는 가장 위험한 일일 것입니다. 구성된 사이트가 없으면 `{"configured":false,"sites":[]}`.

## 설정

### `GET /api/destinations`

알람과 엣지 측정값이 가는 곳이며, 종류마다 항목이 하나씩 있습니다: `webhook`, `smtp`, `ntfy`, `gotify`, `discord_webhook`, `discord_bot`, `edge_publish`. 각 항목에는 `fields`(키, 레이블, 유형, 시크릿 여부와 필수 여부), `enabled`, `state`(`active`: 전송 중, `needs`: 켜져 있으며 대상을 기다리는 중이고 `missing`이 기다리는 것을 알려 줌, `off`, `needs-restart`: 저장되었으며 엣지 퍼블리셔는 HotLoop이 재시작될 때 반영), 일반 `values`, 그리고 어떤 시크릿 필드에 값이 있는지 알려 주는 `set`이 있습니다. 시크릿의 값은 절대 반환되지 않습니다. `source`는 관리자가 설정에서 저장했으면 `saved`, 차트나 환경이 지정했으면 `environment`입니다. 모든 종류가 기본으로 켜져 있고 보낼 곳이 생길 때까지 대기하며, 어느 것도 시작을 막지 않습니다.

```json
{"destinations":[{"id":"webhook","name":"Webhook","enabled":true,"state":"needs",
  "missing":["url"],"values":{"min_priority":"high"},"set":{"url":false},
  "fields":[{"key":"url","label":"URL","type":"password","secret":true,"required":true}]}]}
```

### `GET /api/opcua/server`

OPC UA 서버가 무엇을 하고 있으며 클라이언트가 어떻게 로그인하는지 알려 줍니다. `state`는 `active`, `idle`(HotLoop 인증이 꺼져 있어 로그인할 사용자가 없음, `reason`이 그렇게 알려 줌), `off`, `unavailable`(이 제품에는 서버가 없음) 중 하나입니다. 켜져 있으면 `endpoint`는 클라이언트가 접속하는 URL이고, 인증이 켜져 있으면 `username`과 `password`는 HotLoop이 OPC UA 클라이언트용으로 만든 로그인입니다(`opcua-reader`, 태그와 값만 읽을 수 있고 다른 것은 할 수 없으며 비밀번호는 자동 생성). 비밀번호가 들어 있으므로 `users.manage`가 필요합니다. 서버는 기본으로 켜져 있으며, 비밀번호는 다른 사용자와 마찬가지로 바꿀 수 있고, 다음에 시작하면 여기 표시된 비밀번호가 다시 작동합니다.

### `PUT /api/destinations/{kind}`

대상 하나를 저장하고, `GET`이 주는 형태의 목록으로 응답합니다. 본문은 `{"enabled": true, "values": {"url": "https://..."}, "clear": ["token"]}`이며 각 부분은 모두 선택 사항입니다. 비워 둔 시크릿은 저장된 값을 유지하고, `clear`는 시크릿을 지웁니다. 저장하기 전에 시작할 때 환경을 검사하는 것과 같은 방식으로 결과를 검사하므로, 잘못된 대상은 무엇이 잘못되었는지(값은 절대 아님) 알려 주는 `400`이 되며 아무것도 바뀌지 않습니다. 알람 채널은 즉시 적용되고, 엣지 퍼블리셔의 대상은 HotLoop이 재시작될 때 적용됩니다. HotLoop에 비밀 키가 있으면 시크릿은 데이터베이스에 봉인되어 저장됩니다. `settings.write`가 필요합니다.

### `GET /api/settings`

모든 설정, 그 유효 값, 값이 어디서 왔는지, 값을 정하는 변수입니다.

```json
{"groups":["Plant","Safety","Polling","Historian","Database","MCP","Server"],
 "settings":[{"key":"ui.plantName","group":"Plant","label":"Plant name","help":"...","value":"Demo Plant East","kind":"string","source":"stored","envVar":"HOTLOOP_PLANT_NAME","editable":true},
             {"key":"safety.allowWrites","group":"Safety","label":"Writes allowed","help":"...","value":true,"kind":"bool","source":"environment","envVar":"HOTLOOP_ALLOW_WRITES","editable":false},
             {"key":"database.password","group":"Database","label":"Password","help":"Never shown. It comes from the release Secret.","value":"set","kind":"secret","source":"environment","envVar":"HOTLOOP_DB_PASSWORD","editable":false}]}
```

`source`는 `stored`, `environment`, `default` 중 하나입니다. `secret`은 `set` 또는 `not set`일 뿐입니다. `envVar`는 값이 온 변수입니다. 일부 설정은 `HOTLOOP_` 변수가 비어 있을 때 두 번째 변수로 대체됩니다(시간대는 `TZ`, 데이터베이스는 `POSTGRES_HOST`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`). 대체 변수가 적용 중이면 `envVar`가 그것을 가리킵니다. 빈 문자열로 설정된 변수는 설정에서 처리하는 것과 같이 설정되지 않은 것으로 칩니다. 폴링 설정은 밀리초로 표시되지만, 그 변수는 기간(`5s`, `500ms`)이나 초 단위의 숫자만 받습니다.

`Server` 그룹의 `product`는 이것이 어느 HotLoop인지 알려 줍니다. 이 제품에 없는 기능을 배포에서 그래도 켠 경우(예를 들어 IoT에서 `HOTLOOP_REPORTS_ENABLED=true`) 시작이 막히지는 않습니다. 시작할 때 경고로 기록되고, 변수와 그 기능이 있는 곳을 알려 주는 한 줄과 함께 추가 그룹 `Not in this product`에 나열됩니다. 설정은 그대로 두므로, 그 기능이 있는 제품에서 같은 구성을 쓰면 켜집니다. 그런 설정이 없으면 그룹은 나타나지 않습니다.

### `PUT /api/settings`

공장 식별 설정만 변경합니다.

| 키 | 타입 |
|---|---|
| `ui.plantName` | 문자열, 최대 200자 |
| `ui.siteId` | 문자열, 최대 200자 |
| `ui.timezone` | 이 장비가 아는 IANA 이름(`America/Chicago`) |
| `ui.confirmWrites` | bool |
| `ui.kioskIdleSeconds` | 초 단위 정수, 10에서 43200: 아무도 패널을 건드리지 않을 때 키오스크 로그인이 유지되는 시간. 기본 900 |
| `ui.lockoutAttempts` | 정수, 0에서 100: 한 계정을 잠그는 연속된 잘못된 비밀번호 또는 PIN 횟수. 기본 10이며 0은 잠금 없음 |
| `ui.panelDelaySeconds` | 초 단위 정수, 0에서 30: 잘못된 입력 뒤에 사용자 이름 없이 입력한 다음 PIN을 확인하기 전에 키오스크 패널이 기다리는 최대 시간. 기본 3이며 0은 대기 없음 |
| `ui.lockoutSeconds` | 초 단위 정수, 10에서 86400: 잠긴 계정이 잠긴 채로 유지되는 시간. 기본 300 |

```json
{"ui.plantName":"Demo Plant East","ui.timezone":"America/Chicago"}
```

`GET`과 같이 전체 설정으로 응답합니다. 그 밖의 키는 그것을 짚어 400입니다.

```json
{"error":"safety.allowWrites is set by the deployment and cannot be changed here"}
```

의도된 동작입니다. 쓰기 스위치는 이 프로세스가 기계를 움직일 수 있는지를 정하며, 쓰기를 내보내는 같은 브라우저에서 켤 수 있는 제어는 제어가 아닙니다. 이를 바꾸는 것은 배포입니다.

## 히스토리안 대상

HotLoop이 자체 데이터베이스에 더해 이력을 기록하는 공장 자체의 데이터베이스입니다. [히스토리안 대상](/ko/iot/historian-targets/)을 참고하세요. 설정을 읽는 모든 역할이 이를 보고 각각의 상태를 봅니다. 대상은 공장 데이터가 가는 곳이므로 변경은 관리자 전용입니다. 비밀번호는 장치 자격 증명 키(`HOTLOOP_SECRET_KEY_FILE`)로 봉인되며 응답에 나오지 않습니다. `passwordSet`은 저장된 것이 있는지, `passwordProblem`은 저장된 것을 열 수 없는 이유를 알려 줍니다. 모든 변경은 로그에 남고 즉시 적용됩니다.

### `GET /api/historian/targets`

```json
{"secretKey":true,
 "kinds":[{"id":"postgres","title":"PostgreSQL or TimescaleDB","defaultPort":5432,"defaultTable":"hotloop_history",
    "databaseLabel":"Database","tableLabel":"Table","passwordLabel":"Password","usesUsername":true,"usesOrg":false},
   {"id":"sqlserver","title":"Microsoft SQL Server","defaultPort":1433,"defaultTable":"hotloop_history",
    "databaseLabel":"Database","tableLabel":"Table","passwordLabel":"Password","usesUsername":true,"usesOrg":false},
   {"id":"mysql","title":"MySQL or MariaDB","defaultPort":3306,"defaultTable":"hotloop_history",
    "databaseLabel":"Database","tableLabel":"Table","passwordLabel":"Password","usesUsername":true,"usesOrg":false},
   {"id":"influxdb","title":"InfluxDB 2 or 3","defaultPort":8086,"defaultTable":"hotloop_history",
    "databaseLabel":"Bucket (InfluxDB 3: database)","tableLabel":"Measurement","passwordLabel":"API token",
    "usesUsername":false,"usesOrg":true}],
 "targets":[{"id":"plant-pg","name":"Plant historian","kind":"postgres","address":"db.plant.local:5432",
   "database":"plant","username":"hotloop","table":"hotloop_history","useTls":true,"insecureSkipVerify":false,
   "enabled":true,"createdBy":"admin","passwordSet":true,"createdAt":"2026-10-03T09:12:04Z","updatedAt":"2026-10-03T09:12:04Z",
   "status":{"state":"down","since":"2026-10-03T10:02:11Z","queued":50000,"queueCap":50000,"written":182340,
     "backfilled":0,"dropped":1210,"refused":0,"lastWrite":"2026-10-03T10:02:10Z",
     "lastError":"failed to connect to `user=hotloop database=plant`: dial tcp 10.20.0.9:5432: connect: connection refused",
     "owedFrom":"2026-10-03T10:02:09Z"}}]}
```

`kinds`는 이 HotLoop이 기록하는 데이터베이스와 각각이 필드를 부르는 이름입니다. InfluxDB는 다른 것들이 비밀번호를 갖는 자리에 토큰이 있고(`password`가 이를 담음), 데이터베이스 대신 버킷(`database`), 테이블 대신 측정(`table`)이 있으며, 다른 어느 것에도 없는 조직(`org`)이 있습니다. `status.state`는 `up`, `catching-up`(작동 중이며 HotLoop 자체 이력에서 받아야 할 것을 아직 보내는 중), `down`, `starting`, `off`(꺼짐)입니다. `queued`는 `queueCap` 중 메모리에서 대기 중인 양입니다. `written`은 실시간으로 보낸 읽기값, `backfilled`는 HotLoop 자체 이력에서 보낸 것을 셉니다. `dropped`는 대상이 따라가지 못하는 동안 큐가 놓은 읽기값을 셉니다. 받아야 할 것이지 유실된 것이 아닙니다. `refused`는 데이터베이스 자체가 받지 않은 읽기값을 세며 이유는 `lastRefusal`에 있습니다. `owedFrom`과 `owedTo`는 아직 받아야 할 구간입니다. 끝이 아직 열려 있는 동안, 즉 대상이 내려가 있는 동안은 `owedTo`가 없습니다.

### `POST /api/historian/targets`

```json
{"id":"plant-pg","name":"Plant historian","kind":"postgres","address":"db.plant.local","database":"plant",
 "username":"hotloop","password":"...","useTls":true}
```

`id`는 소문자, 숫자, `-` 1자에서 63자이며 시스템 로그에서 대상을 가리킵니다. `address`는 `host` 또는 `host:port`이며 로그인 정보를 넣지 않습니다. 포트가 없으면 종류의 기본 포트가 채워집니다. `table`의 기본값은 종류의 `defaultTable`이며 스키마를 붙일 수 있습니다(`history.hotloop`). `org`는 InfluxDB 2의 조직입니다. `enabled`의 기본값은 true입니다. 비밀번호에는 키가 필요합니다. `HOTLOOP_SECRET_KEY_FILE`이 없으면 `400`이며 평문으로 저장되지 않습니다. 대상과 상태와 함께 `201`. 이미 쓰는 id면 `409`.

### `PUT /api/historian/targets/{id}`

`id`를 제외한 위의 모든 필드를 쓸 수 있으며, 보내지 않은 것은 그대로 남습니다. `"password":""`는 비밀번호를 지웁니다. 변경하면 새 설정으로 대상이 다시 시작되며, 받아야 할 것은 여전히 받아야 합니다. 대상과 함께 `200`.

### `DELETE /api/historian/targets/{id}`

그곳에 쓰기를 멈추고 받아야 했던 것을 잊습니다. 이미 가진 것은 그 데이터베이스에 남습니다. 설정을 유지하려면 대신 `"enabled":false`로 끄세요. `200` `{"deleted":"plant-pg"}`.

## 시스템 로그

### `GET /api/events`

모든 변경, 쓰기, 로그인, 연결 전환을 최신순으로 보여 줍니다.

| 쿼리 | <span class="sr-only">세부 정보</span> |
|---|---|
| `category` | 반복 가능: `system`, `device`, `tag`, `write`, `alarm`, `automation`, `mcp`, `config`, `auth` |
| `severity` | 반복 가능: `debug`, `info`, `warning`, `error` |
| `subject` | 정확히 일치: 장치 id, 태그 키, entity_id, `equipment:4`, `label:critical` |
| `q` | 대소문자 구분 없는 검색 |
| `minutes` | 최근 N분만 |
| `limit` | 기본 200, 최대 5000 |

```json
[{"id":61,"at":"2026-09-27T20:29:23.303795Z","severity":"info","category":"config","subject":"line1-hourly","actor":"admin","message":"report created"}]
```

`actor`는 사용자, `system`, `automation:<id>` 또는 `mcp:<client>`입니다. `detail`이 있으면 문자열로 된 추가 JSON입니다.

## 로그북

### `GET /api/logbook`

일어난 일의 하나의 타임라인을 최신순으로 보여 줍니다. 엔티티 상태 변경, 쓰기, 알람 전환, 자동화와 스크립트 실행, 그리고 시스템 로그의 설정 변경과 서비스 호출입니다. 기록은 있는 곳에서 읽어 병합하므로 각각 자체 보존 기간을 유지합니다. 숫자 읽기값은 들어 있지 않습니다. 그것은 `GET /api/history`의 역할입니다. [로그북](/ko/iot/logbook/)을 참고하세요.

| 쿼리 | <span class="sr-only">세부 정보</span> |
|---|---|
| `entity` | 이 엔티티와 관련된 것만: 상태 변경, 엔티티와 그 태그에 대한 쓰기, 알람, 엔티티가 트리거하거나 엔티티에 쓴 자동화 실행, 엔티티에 대한 설정 변경 |
| `equipment_id` | 같은 규칙에 따라 설비 트리의 이 노드 또는 그 아래에서 일어난 것만. `entity`와 함께 쓸 수 없음 |
| `actor` | 누가 했는지의 대소문자 구분 없는 일부: 사용자, `automation:<id>`, `mcp:<client>` |
| `kinds` | 쉼표로 구분하거나 반복: `state`, `write`, `alarm`, `automation`, `event`, `script`, `recipe` |
| `from`, `to` | RFC 3339 시각. `from`은 포함, `to`는 제외 |
| `limit` | 기본 100, 최대 1000 |
| `before` | 이전 페이지의 `next` |

```json
{"entries":[
  {"at":"2026-09-28T09:14:02.51Z","kind":"state","id":41,"severity":"info","message":"changed to on (was off)","entity_id":"switch.tank_farm_pump","old_state":"off","state":"on","quality":"good"},
  {"at":"2026-09-28T09:14:02.18Z","kind":"write","id":88,"severity":"info","message":"wrote true to tank-farm/pump (switch.turn_on on switch.tank_farm_pump) (was 0)","actor":"admin","source":"ui","entity_id":"switch.tank_farm_pump","device_id":"tank-farm","tag":"tank-farm/pump","call_id":"5c9f8545a93b5443"},
  {"at":"2026-09-28T09:13:40.02Z","kind":"state","id":37,"severity":"info","message":"changed to closed (was open); 14 changes before this not logged, it was changing faster than the logbook records","entity_id":"valve.infeed","old_state":"open","state":"closed","quality":"good","suppressed":14}
 ],
 "next":"MjAyNi0wOS0yOFQwOToxMzo0MC4wMlp8c3RhdGV8Mzc"}
```

`id`는 해당 기록 안에서의 행의 id이며(상태 변경이면 엔티티의 불변 id), `at`, `kind`와 함께 `next`가 인코딩하는 값입니다. 이 페이지 다음 페이지는 그동안 무엇이 추가되었든 그 순서에서 엄격하게 더 오래된 모든 것입니다. `next`는 마지막 페이지에서는 빠집니다. `suppressed`는 그 엔티티가 한 번에 열 개보다 빠르게, 그다음에는 2초에 하나씩 바뀌어서 이 변경 이전에 기록되지 않은 변경의 수입니다.

알 수 없는 종류, 잘못된 형식의 시각, `to`보다 앞서지 않는 `from`, 1000을 넘는 limit, 지어낸 커서, 또는 `entity`와 `equipment_id`를 함께 쓴 경우는 `400`, 존재하지 않는 노드는 `404`입니다. 응답하는 프로세스에서 로그북이 실행 중이 아니면 `503`.

## 실시간 피드

### `GET /api/stream`

서버 전송 이벤트이며 열어 두는 동안 한 방향입니다. 트래픽이 한 방향으로만 가기 때문에 WebSocket이 아니라 SSE를 쓰며, 이벤트 스트림은 열린 대시보드 아래에서 파드가 재시작될 때 스스로 다시 연결됩니다. `EventSource`는 세션 쿠키를 보내고, 스크립트는 베어러 토큰을 보냅니다.

연결하면 `retry: 3000`과 현재 상태를 받으므로, 무엇이 바뀌기 전에 화면이 채워집니다.

```
retry: 3000

event: snapshot
data: [{"deviceId":"extruder-1","protocol":"opcua","tagName":"Temperature","tagValue":19.553128777917983,"unit":"C","quality":"good","timestamp":"2026-09-27T20:34:23.619589Z"}]

event: alarms
data: {"alarms":[...outstanding alarms...],"summary":{"critical":0,"high":1,"medium":0,"low":0,"unacked":0,"total":1}}

event: entities
data: {"changed":[...every entity state...],"removed":[]}
```

그다음에는 일이 일어나는 대로 받습니다.

| 이벤트 | 데이터 | 시점 |
|---|---|---|
| `values` | 읽기값 배열, `GET /api/values` 형태, 태그별 최신, **읽기값이 바뀐 태그만** | 바뀐 것이 있으면 250 ms마다. 값, 텍스트, 단위, 품질, 사유가 마지막으로 보낸 것과 같은 태그는 빠지며, 30초 동안 보내지 않으면 다시 보내므로 안정된 값의 `timestamp`가 그보다 오래되는 일은 없습니다. 드라이버는 폴링마다 모든 태그를 읽습니다. 4.19.5는 매번 전부 보냈고(테스터의 2232개 태그에 대해 초당 네 번, 약 150 KB), 느린 회선의 페이지는 몇 분씩 뒤처졌습니다 |
| `entities` | `{"changed": [states], "removed": [entity_ids]}` | 엔티티 상태가 바뀐 것이 있으면 250 ms마다. `removed`는 비활성화, 삭제 또는 이름이 바뀌어 사라진 엔티티입니다 |
| `alarm` | `{"alarm": {...}, "event": "shelved"}`, 알람과 그에 일어난 일(`raised`, `acked`, `cleared`, `shelved`, `unshelved`, `suppressed`, `unsuppressed`) | 즉시: 알람 전환은 드물고 하나하나가 중요합니다 |
| `device` | `{"deviceId":"tank-farm","state":"connected"}` | 즉시: 장치가 끊기면 다음 플러시가 아니라 바로 화면이 빨갛게 되어야 합니다 |
| `logbook` | `{"kinds":["state","write"]}`, 로그북 항목 중 새로운 것이 있는 종류 | 최대 초당 한 번. 항목은 들어 있지 않습니다. 화면이 보여 줄 것은 필터에 달려 있으므로 `GET /api/logbook`에 자기 페이지를 요청합니다 |

```
event: alarm
data: {"alarm":{"definitionId":"extruder-temp-hi","state":"shelved","shelvedUntil":"2026-09-27T20:39:45.839983854Z","shelvedBy":"admin","...":"..."},"event":"shelved"}

event: device
data: {"deviceId":"tank-farm","state":"connected"}
```

20초마다 주석 줄(`: heartbeat 2026-09-27T20:35:00Z`)이 프록시가 유휴 연결을 닫지 않게 합니다. 열린 페이지마다 자체 속도로 전송됩니다. 쓰는 쪽은 마지막 전송에 걸린 시간만큼(최대 5초) 쉬고, 그동안 도착한 것은 태그별, 엔티티별로 최신 것만 보관되므로, 느린 회선의 페이지는 공장보다 한두 번 전송만큼 뒤에 있을 뿐 몇 분씩 뒤처지지 않고, 아무것도 잃지 않으며, 다른 페이지의 것을 가져가지도 않습니다. 요청에 `Accept-Encoding: gzip`이 있으면(브라우저는 그렇습니다) 스트림이 gzip으로 압축되며, 테스터의 첫 화면이 회선에서 약 326 KB에서 약 11 KB로 줄어듭니다. 응답은 `X-Accel-Buffering: no`를 설정합니다. 버퍼링하는 프록시는 실시간 피드를 매우 느린 다운로드로 바꾸어 버리기 때문입니다.

스트림은 5초마다 세션을 다시 확인하고 세션이 사라지면 닫힙니다. 로그아웃, 만료, 폐기, 계정 비활성화 또는 더는 `status.read`가 허용되지 않는 경우입니다. 먼저 이벤트를 보내지는 않습니다. 브라우저의 `EventSource`는 다시 연결해 위의 `401`을 받고 멈춥니다. `HOTLOOP_AUTH_INSECURE=true`이면 세션이 없고 확인할 것도 없습니다. 이 확인은 세션 사용으로 치지 않으므로, 열어 둔 화면이 세션을 계속 유지하지는 않습니다.

## MCP

### `/mcp` 및 `/mcp/`

에이전트를 위한 Model Context Protocol, 스트리머블 HTTP 전송입니다. 모든 메서드를 받습니다. 전송은 호출에 `POST`, 서버 자체 스트림에 `GET`, 세션 종료에 `DELETE`를 씁니다. 경로는 `HOTLOOP_MCP_PATH`(기본 `/mcp`)이며 엔드포인트는 `HOTLOOP_MCP_ENABLED`가 켜져 있을 때만 있습니다.

세션 로그인 뒤에 있지 **않습니다.** 자체 베어러 토큰 `HOTLOOP_MCP_TOKEN`이 있으며 핸들러 앞에서 확인하므로, 토큰이 없는 호출자는 도구를 나열조차 할 수 없습니다.

```
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="hotloop"

unauthorized
```

토큰이 구성되지 않았으면 HotLoop이 처음 시작할 때 하나를 만들어 데이터베이스에 보관하므로(`hotloop mcp-token`이 출력합니다) 엔드포인트가 열려 있는 일은 없습니다. 에이전트는 다른 호출자와 똑같은 호출자입니다. 읽고 쓰며, 쓰기는 모든 사람과 같은 쓰기 게이트를 거치고 `mcp:<client name>`으로 감사됩니다. 도구와 리소스는 [MCP](/ko/iot/mcp/)에 있습니다.

```
POST /mcp
Authorization: Bearer <token>
Accept: application/json, text/event-stream

{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"1"}}}
```

`Mcp-Session-Id` 헤더와 서버의 기능 및 지침으로 응답합니다.

## UI

### `GET /manifest.webmanifest`

휴대폰이 UI를 앱으로 설치할 수 있게 하는 웹 앱 매니페스트입니다. 제품과 공장 이름, `display` `standalone`, 테마 색상, 아이콘(192와 512 픽셀 PNG, 마스크 가능한 512와 SVG), 알람과 대시보드로 가는 바로 가기가 들어 있습니다. 그 안의 모든 URL은 매니페스트 자체를 기준으로 한 상대 경로이므로 HotLoop이 어디에 마운트되어 있든 맞습니다. 이름은 설정에서 정한 공장 이름을 따르며, 응답은 `Cache-Control: no-cache`이므로 이름을 바꾸면 다음 조회에서 보입니다. 세션 없음: 휴대폰은 아무도 로그인하기 전에 요청합니다. [대시보드](/ko/iot/dashboards/#휴대폰에서)를 참고하세요.

### `GET /sw.js`

HotLoop이 마운트된 곳의 루트에 있는 서비스 워커로, 범위가 앱 전체를 덮습니다. 페이지와 사람이 보는 읽기에 대한 마지막 응답을 보관하며, HotLoop에 닿을 수 없을 때는 오래된 것으로 표시하여 응답합니다. 쓰기는 절대 응답, 보관, 큐잉하지 않습니다. 실행 중인 버전이 그 안에 있으므로 릴리스마다 자체 페이지 캐시를 가집니다. `Cache-Control: no-cache`. 세션 없음. 보안 컨텍스트(https 또는 `localhost`)의 브라우저만 이를 실행합니다.

### `GET /next` 및 `GET /next/`

이전 UI가 기본이던 시절 UI가 있던 곳입니다. 둘 다 루트로 가는 `301`이므로 그때 만든 북마크도 여전히 도착합니다.

### `/`

`web/`에서 바이너리로 빌드된 웹 UI입니다. 페이지와 그 스크립트, 스타일, 글꼴, 서비스 워커, 설치형 앱의 아이콘으로 이루어져 있으며, 그 안의 모든 URL은 페이지를 기준으로 한 상대 경로이므로 호스트의 루트, 경로 아래, 프록시 뒤, EmberNet 대시보드의 iframe 안에서도 실행됩니다. 서버는 제목과 하나의 데이터 블록 `<script type="application/json" id="iiot">`을 채우는데, 서버만 아는 것들입니다. 공장, 사이트, 제품, 기능, 쓰기 정책, 시간대입니다. `GET`과 `HEAD`만 가능하며 다른 메서드는 `405`입니다. 자신의 파일이 아닌 경로는 `404`입니다. 오타에 대해 페이지를 제공하면 작동하는 화면처럼 보이기 때문이며, UI 없이 빌드된 바이너리는 그 사실과 빌드 방법을 일반 텍스트로 알려 줍니다. 세션 없음: 로그인하기 전까지 페이지는 로그인 양식입니다.
