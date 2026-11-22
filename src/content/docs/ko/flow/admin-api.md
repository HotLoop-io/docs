---
title: "관리 API"
description: "편집기와 명령줄이 사용하는 HTTP 및 웹소켓 호출, 각 호출이 필요로 하는 것과 반환하는 것."
---

| 메서드와 경로 | 권한 | 비고 |
|---|---|---|
| `GET /health` | 없음 | 생존 확인. kubelet은 토큰을 가지고 있지 않으며, 이 경로에 인증을 걸면 파드가 영원히 재시작 루프에 빠집니다. |
| `GET /ready` | 없음 | 준비 상태를 따로 보고하므로, 시작에 실패한 런타임은 kubelet이 파드를 죽이지 않고도 Service에서 빠집니다. |
| `POST /auth/token` | 없음 | 로그인. 잠금 중에는 `Retry-After`가 있는 429가 반환됩니다. |
| `POST /auth/revoke` | 없음 | 로그아웃. |
| `GET /auth/mode` | 로그인 불필요 | 이 런타임이 EmberCORE 대시보드에서 열리는지 여부: `{"dashboard": bool, "hideLogin": bool}`. 편집기는 아무도 로그인하기 전에 이를 묻습니다. |
| `GET /auth/mfa`, `POST /auth/mfa/setup`, `/confirm`, `/disable` | 로그인한 사용자 | 본인의 2단계 로그인. Setup은 키, `otpauth://` 링크, QR 코드를 반환합니다. Confirm과 disable은 `{"code": ...}`를 받습니다. |
| `POST /auth/mfa/reset` | `auth.admin` | 다른 사람의 2단계 로그인을 끕니다: `{"username": ...}`. |
| `GET /metrics` | 없음 | Prometheus. 개수와 노드 id만 있고, 메시지 내용이나 설정은 절대 포함되지 않습니다. |
| `GET /settings` | `settings.read` | |
| `GET /nodes` | `nodes.read` | 편집기의 팔레트와 대화상자를 구동하는 레지스트리입니다. |
| `GET /plugins` | `nodes.read` | 로드된 플러그인, 각각이 요청한 것과 부여받은 것, 그리고 이유와 함께 거부된 것입니다. |
| `GET /flows` | `flows.read` | |
| `GET /flows/export` | `flows.read` | git용으로, 디스크에 있는 그대로의 플로 파일입니다. |
| `POST /flows` | `flows.write` | 배포. 배포 로그에 남길 선택적 메모를 받습니다. |
| `GET /deployments` | `flows.read` | 페이로드를 뺀 배포 로그이며 최신순입니다. `?limit=N`으로 개수를 제한합니다. |
| `GET /audit` | `audit.read` | 누가 어디서 무엇을 했는지, 최신순입니다. `?event=`, `?user=`, `?since=`, `?limit=`. |
| `GET /deployments/{seq}` | `flows.read` | 플로를 파싱한 레코드 하나입니다. 자격 증명은 절대 포함하지 않습니다. |
| `GET /deployments/{seq}/flows` | `flows.read` | 해당 배포의 플로 파일이며 바이트 단위로 같습니다. |
| `GET /deployments/{from}/diff/{to}` | `flows.read` | 두 배포 사이의 노드별 차이로, 구조화된 형태와 텍스트로 제공됩니다. |
| `POST /flows/diff` | `flows.read` | 현재 실행 중인 것과 본문의 문서 사이의 차이입니다. 아무것도 배포하지 않습니다. |
| `POST /flows/types` | `flows.read` | 배포가 수행하는 타입 와이어 검사를 본문의 문서에 대해 실행합니다: `{"wires": [...]}`, 문제가 없으면 비어 있습니다. 편집기가 응답을 그립니다. 아무것도 배포하지 않습니다. |
| `POST /deployments/{seq}/rollback` | `flows.write` | 해당 레코드의 플로와 자격 증명을 새 배포로 다시 배포합니다. rev 헤더와 선택적 `{"note": ...}`를 받습니다. |
| `GET /tests` | `flows.read` | 플로 파일 옆에 보관된 플로 테스트 스위트, 그 파일 이름, 배포가 이를 통과해야 하는지 여부입니다. |
| `PUT /tests` | `flows.write` | 스위트를 교체합니다. 본문은 YAML이며, 파싱되지 않으면 이유와 함께 400이 반환됩니다. |
| `POST /tests/run` | `flows.read` | 스위트 또는 본문의 `"tests"`를, 본문의 `"flows"` 또는 실행 중인 것에 대해 실행합니다. 보고서를 반환합니다. 아무것도 배포하지 않습니다. |
| `POST /tests/from-debug` | `flows.read` | Debug 노드가 보여 준 메시지 `{"node", "msgId"}`로 테스트 초안을 만듭니다. 아무것도 저장하지 않습니다. |
| `POST /tests/cases` | `flows.write` | 본문의 테스트들, 즉 별도의 테스트 파일을 스위트의 끝에 추가합니다. |
| `GET /traces` | `flows.read` | 보관된 추적을 최신순으로, 버퍼가 담고 있는 것과 한도와 함께 반환합니다. `?limit=N`. `trace.enabled: false`이면 404입니다. |
| `GET /traces/find` | `flows.read` | `?msgId=`와 `?node=`, 즉 사이드바가 보여 주는 id와 Debug 노드로 메시지가 속한 추적을 찾습니다. 모든 홉과 요청한 홉까지의 경로를 반환합니다. |
| `GET /traces/{id}` | `flows.read` | 추적 하나이며, 각 홉의 소요 시간과 노드가 받은 그대로의 메시지를 포함합니다. |
| `POST /traces/{id}/test` | `flows.read` | 추적에서 플로 테스트 초안을 만듭니다. 아무것도 저장하지 않습니다. |
| `POST /traces/{id}/replay` | `flows.read` | 추적을 시작한 메시지를 본문의 `"flows"` 또는 실행 중인 것에 자식 프로세스로 넣고, 이전에 끝난 위치와 비교해 어디에 도착하는지 반환합니다. 아무것도 배포하지 않습니다. |
| `GET /runtime/stats` | `status.read` | |
| `POST /inject/{id}` | `inject.write` | Inject 노드를 실행합니다. |
| `GET /comms` | `status.read` | 편집기의 상태 및 디버그 웹소켓입니다. 토큰을 `hotloop-flow` 옆에 제시하는 서브프로토콜 `hotloop-flow.bearer.<token>`으로 보내세요. 편집기가 하는 방식입니다. URL의 `?access_token=<token>`은 이미 사용하는 스크립트에서 여전히 동작하며, URL은 프록시와 접근 로그에 남기 때문에 그렇게 연결할 때마다 경고를 기록합니다. |
| `POST /mcp` (그리고 이전 프로토콜 개정판용 `GET`과 `DELETE`) | `mcp.call` | 플로가 도구로 제공되는 [MCP 엔드포인트](/ko/flow/mcp/)입니다. 다른 것과 마찬가지로 세션 또는 API 토큰을 사용합니다. 호출자에게 제공되고 호출할 수 있는 도구는 그 권한이 미치는 것들입니다. 인증을 끄면 403입니다. |

`/metrics`와 `/health`에 인증이 없는 것은 실수가 아니라 결정입니다. Prometheus 스크레이퍼는 bearer 토큰을 가지고 있지 않으므로, 이를 요구하면 모니터링 스택에 자격 증명을 건네거나 모니터링을 포기해야 합니다.

2단계 로그인이 켜진 사용자는 사용자 이름과 비밀번호와 함께 `"code"`를 `POST /auth/token`으로 보냅니다. 없으면 `"mfa": "required"`가 담긴 401이 응답됩니다.

권한은 모든 것을 뜻하는 `"*"`, `flows.read` 같은 정확한 문자열, 또는 `flows.*` 같은 접두사 권한입니다. 플로를 MCP 도구로 호출하는 에이전트에는 `mcp.call`이 필요합니다. 플로 상태만 보여 주려는 대시보드용 읽기 전용 계정은 `["flows.read", "status.read"]`이며 그 이상은 필요 없습니다.

배포는 선택적 `HotLoop-Flow-Deployment-Rev` 헤더를 받습니다. 마지막으로 읽은 리비전을 보내면, 다른 편집기와 경쟁하는 배포가 누군가의 작업을 조용히 덮어쓰는 대신 409로 거부됩니다. 이는 오후를 날린 사람에게서만 알게 되는 종류의 실패입니다.

배포는 바꾼 것만 재시작합니다. 노드가 의존하는 것, 즉 설정, 탭, 그룹, 환경, 자격 증명, 그리고 노드가 이름으로 가리키는 모든 설정 노드 중 아무것도 움직이지 않았다면 노드는 계속 실행됩니다. 캔버스에서 끌거나 다시 연결하는 것은 변경으로 치지 않습니다. 새 와이어는 실행 중인 노드에 연결되기 때문입니다. 그래서 함수 노드 하나의 오타를 고쳐도 박스의 모든 MQTT 세션이 끊기지 않고, 10분어치 측정값을 쥐고 있는 Delay 노드는 계속 쥐고 있습니다. 이것이 존재하는 이유의 전부입니다. 저장할 때마다 공장이 흔들리면 운영자는 교대 근무 중에 저장하지 않게 되고, 수정은 토요일까지 기다리게 됩니다.

`HotLoop-Flow-Deployment-Type` 헤더로 재시작 범위를 고르세요. Node-RED의 `Node-RED-Deployment-Type`도 동작하므로, 이미 가진 배포 스크립트도 요청한 재시작을 받습니다.

| 유형 | 재시작되는 것 |
|---|---|
| `nodes` (기본값) | 바꾼 노드와, 바꾼 설정 노드를 이름으로 가리키는 모든 것. |
| `flows` | 변경이 있는 플로에 속한 모든 노드. |
| `full` | 전부. 프로세스를 재시작하는 것과 같습니다. |

응답에는 수행한 내용이 `type`, `started`, `restarted`, `stopped`, `unchanged`로 담깁니다. 처리 중인 것은 도중에 사라지지 않습니다. 교체되는 노드에 이미 대기 중인 작업은 이전 인스턴스에서 끝나고, 교체 중에 들어오는 것은 새 인스턴스를 기다리며, 삭제한 노드로 향하던 메시지는 사라지는 대신 집계되어 드롭으로 나타납니다.
