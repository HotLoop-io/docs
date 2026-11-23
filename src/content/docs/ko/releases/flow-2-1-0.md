---
title: "Flow 2.1.0 릴리스 노트"
description: "HotLoop Flow 2.1.0에 담긴 내용, 업그레이드 시 달라지는 점, 가동 중인 플랜트를 건드리기 전에 읽어야 할 것."
sidebar:
  label: "2.1.0"
---

HotLoop Flow 2.1.0은 [로드맵](/ko/flow/roadmap/)의 0~2단계에 더해, 실제 플로를 올리지 못하게 막던 일상적인 빈틈을 메운 릴리스입니다. 이제 모든 배포는 비교하고, 테스트하고, 검토하고, 되돌릴 수 있는 기록입니다. 플로에 테스트를 두면 나쁜 배포가 일어나기 전에 실행됩니다. 저장하면 바꾼 노드만 다시 시작하고 나머지 플랜트는 그대로 둡니다.

이 릴리스는 플로 파일을 읽고 쓰는 방식을 전혀 바꾸지 않습니다. 바이트 단위 왕복은 그대로여서, 2.0.5에서 돌던 `flows.json`은 2.1.0에서도 그대로 돕니다.

## 새 기능

**배포**
- 모든 배포는 기록입니다. 누가, 어디서, 언제, 메모, 대체된 리비전, 바이트 단위의 플로 파일, 당시 상태 그대로 암호화된 자격 증명이 남습니다. `GET /deployments`로 읽습니다. `history.retain`은 기본적으로 최근 100개를 보관합니다.
- 리뷰처럼 읽히는 diff: 노드별, 속성별로 보여 주고, 레이아웃은 로직과 분리하며, 자격 증명은 절대 표시하지 않습니다. API, 명령줄(`hotloop-flow diff`), 그리고 git 자체의 diff 드라이버로 쓸 수 있습니다.
- 롤백은 이전 기록을 새 배포로 되돌려 놓습니다. 플로와 자격 증명이 함께 돌아오므로, 삭제한 노드가 브로커 비밀번호와 함께 복원됩니다.
- 부분 배포: 저장하면 바뀐 노드만 다시 시작합니다. 나머지 노드의 MQTT 세션, 리스너, Delay 큐는 계속 실행됩니다. `HotLoop-Flow-Deployment-Type`(또는 Node-RED의 헤더)으로 노드, 플로, 전체 중에서 고릅니다.
- 에디터는 배포 전에 캔버스에 diff를 그려 보여 주고 메모를 받아 검토하며, 롤백 버튼이 있는 기록을 보여 줍니다.
- 코드로서의 플로: `hotloop-flow deploy`는 실행 중인 것과의 diff를 출력하고 출발한 리비전을 기준으로 배포하므로, 경합이 생기면 파이프라인이 빨갛게 실패합니다. `hotloop-flow export`는 실행 중인 파일을 바이트 단위로 돌려줍니다. `hotloop-flow token`은 API 토큰과 그 토큰에 설정할 해시를 만듭니다.
- 선택 사항인 git 미러: `history.git`를 설정하면 모든 배포가 배포한 사람을 작성자로 한 커밋이 됩니다.

**테스트**
- 플로 테스트: `flows.json` 옆의 `flows.test.yaml`을 `hotloop-flow test`(`-junit`을 주면 JUnit)가 실제 런타임과 실제 노드에서 실행합니다. Delay, Trigger, Inject, Join, Batch는 테스트가 움직이는 시계에서 돌기 때문에 Delay 5분이 한 단계입니다. MQTT, HTTP, PostgreSQL, InfluxDB, TCP, UDP, WebSocket, 파일, exec처럼 외부와 통신하는 것은 모두 대역으로 바뀌고, 테스트는 나갔을 내용을 확인합니다.
- 배포 게이트: `tests.gate`를 켜면 플로가 테스트 모음을 통과하지 못한 배포는 전체 보고서와 함께 422가 됩니다. 롤백은 탈출구이므로 게이트를 거치지 않습니다.
- 에디터는 디버그 메시지로 테스트를 만들고 실행합니다.

**노드와 프로토콜**
- JSONata는 공개된 jsonata-js 2.2.2 테스트 모음으로 검증했습니다. 1686건 중 1673건이 통과하며, 통과하지 못하는 13건은 이름과 이유까지 명시해 두었습니다.
- Inject는 crontab으로 실행되며, Node-RED와 같은 분에 동작합니다. 여섯 개 시간대의 시간 변경도 확인했습니다.
- MQTT 5(속성, 구독 옵션, 세션 만료)와 유언(last will). MQTT 3.1.1도 계속 동작합니다.
- TCP, HTTP 요청, MQTT에서 `tls-config` 노드로 TLS를 씁니다. WebSocket 리스너와 클라이언트가 시작되고, 클라이언트는 TLS를 지원합니다.
- HTTP의 쿠키와 multipart는 Node-RED가 쓰는 라이브러리와 대조해 확인했습니다.
- Split, Join, Batch는 Node-RED와 같은 방식으로 동작합니다. 스트리밍, 타임아웃, reduce, 간격을 지원하고, Link Call과 Link Out의 반환 모드도 있습니다.
- 비밀번호를 플로 안이 아니라 마운트된 Secret에 둘 수 있습니다. Helm 차트에 `secrets.mounts`가 추가됩니다.

**로그인**
- 2단계 인증 로그인(TOTP). 무료이며, 에디터에서 켜는 누구나 쓸 수 있습니다.
- 잠금, 재시작 후에도 유지되는 세션, 누가 어디서 무엇을 했는지 남기는 감사 로그(`GET /audit`, `audit.read`).

## 바뀐 내용

- 잠금은 기본으로 켜져 있습니다. 한 주소에서 한 계정에 5번 실패하거나 한 주소에서 20번 실패하면 15분 동안 잠기고 429를 반환합니다. 숫자는 `auth.lockout`으로 바꿉니다.
- 세션은 해시로 `data/sessions.json`에 저장되며 요청마다 설정을 따르므로, 설정에서 권한이나 사용자를 빼면 다음 요청부터 바로 적용됩니다.
- 롤백은 더 적게 요청하지 않는 한 전체 재시작입니다.
- 이미지에는 `/usr/share/doc/hotloop-flow/`에 `LICENSE`, `NOTICE`, `THIRD_PARTY_LICENSES`가 들어 있습니다. `THIRD_PARTY_LICENSES`는 바이너리에 들어간 모든 Go 모듈과 npm 패키지를 버전과 라이선스 전문과 함께 빌드 시점에 생성해 나열합니다. GPL, AGPL, LGPL 의존성이나 아무도 식별할 수 없는 의존성이 있으면 빌드가 실패합니다.
- `NOTICE`가 틀렸습니다. 여기에는 Node-RED 코드가 없다고 적혀 있었습니다. Cron, Split, Join, Batch, Link Call, tls-config, 그리고 HTTP 쿠키와 multipart 작업은 이식한 것이며, 이제 이식한 모든 파일을 출처, 저작권자, 라이선스와 함께 나열하고, cronosjs는 ISC 전문, 나머지는 MIT 전문을 싣습니다. 이식한 파일 맨 위에도 같은 내용이 적혀 있습니다.
- 거부된 배포가 더 이상 메모리의 자격 증명을 지우지 않으며, Chromium에서 노드를 더블클릭하면 대화 상자가 열립니다. 둘 다 이 작업을 하다가 찾았습니다.

## 업그레이드 노트

2.0.5에서는 이미지만 바꾸면 됩니다(`helm upgrade`, 또는 Quadlet 유닛의 새 태그). 마이그레이션도 플래그도 없습니다.

- 처음 시작하면 `data.dir` 아래에 `sessions.json`, `audit.log`, `deployments` 디렉터리가 만들어집니다. 이전에는 세션이 메모리에 있었으므로, 업그레이드 후 모두 한 번씩 다시 로그인합니다.
- 설정의 새 항목은 모두 선택 사항이며 기본값은 꺼져 있거나 해가 없습니다. 지금 쓰는 것은 아무것도 멈추지 않습니다.
- WebSocket 토큰: 이제 에디터는 토큰을 `hotloop-flow`와 함께 제시하는 서브프로토콜 `hotloop-flow.bearer.<token>`으로 보냅니다. `/comms`에 접속하는 모든 것에 권장하는 방식입니다. URL에 `?access_token=`을 보내는 스크립트도 계속 동작하며, 서버는 그런 연결마다 토큰이 프록시와 접근 로그에 새어 나간다는 점과 대신 무엇을 보내야 하는지를 알리는 경고를 남깁니다. URL 자체는 Flow의 로그나 감사 기록에 절대 쓰지 않습니다. URL 방식의 제거는 이후의 메이저 릴리스로 미룹니다.

## 새 설정

| YAML | 환경 변수 | 기본값 |
|---|---|---|
| `tests.gate` | `HOTLOOP_FLOW_TESTS_GATE` | `false`. `true`면 플로가 `flows.test.yaml`을 통과하지 못한 배포를 거부합니다. |
| `tests.timeout` | | `2m`, 테스트 한 번을 실행하는 실제 시간 한도. 끝나지 못하는 실행은 배포를 거부합니다. |
| `secrets.allowedPaths` | `HOTLOOP_FLOW_SECRET_ALLOWED_PATHS` | 비어 있음. `data.dir` 외에 `tls-config`나 자격 증명 파일을 읽을 수 있는 추가 경로. 파일 노드의 범위는 아니므로, File In 노드는 여전히 읽을 수 없습니다. |
| `secrets.mounts` (차트) | | 비어 있음. 읽기 전용으로 마운트한 Kubernetes Secret이며, 각각 시크릿 범위에 추가됩니다. |
| `auth.tokens` | `HOTLOOP_FLOW_DEPLOY_TOKEN_HASH` | 없음. 머신용 API 토큰으로, 해시로 저장됩니다. 환경 변수는 읽기와 배포만 할 수 있는 `deploy` 토큰을 만듭니다. `hotloop-flow token`으로 하나 만드세요. |
| `auth.lockout` | | `attempts: 5`, `perAddress: 20`, `window: 15m`, `duration: 15m` |
| `history.retain` | | `100`. `0`은 모든 기록을 보관합니다. |
| `history.git` | `HOTLOOP_FLOW_GIT_URL`, `HOTLOOP_FLOW_GIT_USERNAME`, `HOTLOOP_FLOW_GIT_PASSWORD` | 꺼짐. |
| `audit.maxBytes`, `audit.keep` | | 16 MiB, 파일 4개. |

이미지: `ghcr.io/hotloop-io/hotloop-flow:2.1.0`, linux/amd64와 linux/arm64. 차트: `https://hotloop.io/hotloop-flow/`. 이 태그의 README에 나머지가 있습니다: https://github.com/HotLoop-io/hotloop-flow/blob/v2.1.0/README.md
