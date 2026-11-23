---
title: "core 4.17.0 릴리스 노트"
description: "HotLoop core 4.17.0에 담긴 내용, 업그레이드할 때 달라지는 점, 가동 중인 플랜트를 건드리기 전에 읽어야 할 내용입니다."
sidebar:
  label: "4.17.0"
---

자동화 기반의 2단계, 읽기 전용 UniFi, 그리고 저장된 장치 비밀번호의 암호화입니다. 4.16.0에서 올라오면 평범한 `helm upgrade`지만, 장치 비밀번호가 첫 시작 때 암호화되고 그 뒤로는 키가 데이터의 일부가 됩니다. 가동 중인 플랜트를 건드리기 전에 아래의 「4.16.0에서 업그레이드」를 읽어 주세요.

전체 노트는 README에 있습니다. 4.17.0의 변경 사항을 확인하세요.

## 요약

- **자동화 기반, 2단계.** Helper(플랜트 담당자가 소유하는 값으로, 거부되며 절대 잘라내지 않음), logbook(상태 변경, 쓰기, 알람, 실행, 설정을 하나로 묶은 타임라인), 조건·대기·중지 단계와 상태 트리거의 `forSec`, 스크립트(CIP 사이클을 한 번 쓰고 어디서든 실행), 레시피(한 품종의 모든 setpoint가 함께 나가거나 하나도 나가지 않으며 장치에서 다시 읽어 확인), blueprint(한 번 쓴 규칙을 펌프마다 채워 넣고, 누군가 업그레이드를 검토할 때까지 해당 버전에 고정)가 들어옵니다. MCP 도구는 16개에서 25개로 늘어납니다.
- **UniFi Network, 읽기 전용.** 스위치, 포트, PoE, WAN, 클라이언트를 tag로 가져오며, 콘솔마다 로그인 하나, 인증서는 고정합니다. 조용한 PLC의 서랍에는 어느 스위치 포트에 연결되어 있고 링크가 올라와 있는지 표시되며, OT로 표시한 네트워크에 낯선 기기가 나타나면 알람이 울립니다. 실제 콘솔에서 읽기 전용으로 검증했습니다. **아직 검증되지 않은 것:** 감시 중인 장치의 케이블을 실제로 뽑는 경우와, 휴대폰이 OT로 표시한 네트워크에 들어오는 경우입니다. 이 두 알람은 테스트에서만 검증되었으며, 누군가 랙에서 둘 다 해 보기 전까지는 다른 곳에서 검증되지 않았습니다.
- **장치 비밀번호가 암호화됩니다.** 데이터베이스와 백업 모두에서 암호화되며, 키는 차트가 `<release>-secret-key`에 생성해 보관합니다.
- **4.16.0 플랜트가 걸릴 수 있는 수정:** 차트나 Quadlet 유닛의 Edge Relay가 푸시된 설정을 전부 무시했고, 영속성을 끈 Edge Relay는 부팅되지 않았습니다. 규칙 편집기에서 손으로 수정하면 규칙의 실행 예산이 초기화되었습니다. 명령 프롬프트의 판정이 클릭하는 순간 Set 버튼을 밀어낼 수 있었습니다. 늦게 도착한 업데이트가 Entities 화면을 과거로 되돌릴 수 있었습니다. 한 번도 실행되지 않은 규칙이 739887일 전에 실행되었다고 표시했습니다. App Store 배포에 tenant가 붙지 않았습니다.

### API 변경 사항

- 아직 일어나지 않은 시각은 `0001-01-01T00:00:00Z`로 보내지 않고 생략합니다. `lastRun`, `lastPoll`, `lastGood`, `clearedAt`, `ackedAt`, `shelvedUntil`, `raisedAt` 등이 모두 해당하며 라이브 피드도 마찬가지입니다.
- 새 라우트: `/api/helpers`, `/api/logbook`, `/api/scripts`, `/api/recipes`, `/api/blueprints`, `POST /api/automations/{id}/blueprint-upgrade`, `/api/devices/{id}/network`, `/api/unifi/{id}/...`, `DELETE /api/fleet/{id}/config`. 모두 docs/API.md에 있습니다.
- 새 권한이며 operator 역할이 가지고 있습니다: `helpers.write`, `scripts.run`, `recipes.apply`, `blueprints.apply`. 스크립트, 레시피, blueprint를 작성하는 일은 관리자 몫입니다.
- tag에는 `deviceClass`가, 규칙에는 `blueprintId`, `blueprintVersion`, `blueprintInputs`가 붙습니다.

### 4.16.0에서 업그레이드

- `helm upgrade <release> hotloop/hotloop --version 4.17.0 --reset-then-reuse-values`. `--reuse-values`는 쓰지 않습니다. 새 기본값이 빠지고 렌더링에 실패합니다. selector와 volume claim은 그대로이며, 새로 생기는 오브젝트는 키의 Secret 하나뿐입니다.
- 마이그레이션 0009부터 0015까지가 시작할 때 실행됩니다(helper, logbook, 스크립트, tag 장치 클래스, 레시피, blueprint, UniFi). 모두 추가형입니다. 먼저 `pg_dump`를 하세요.
- `HOTLOOP_SECRET_KEY_FILE`: 이번 업그레이드에서 차트가 키를 생성하고, Gateway는 그 시작 때 저장된 모든 장치 비밀번호를 암호화합니다. 이후에 키가 없으면 해당 장치는 키를 지목하는 오류와 함께 다운 상태로 남습니다. 업그레이드 후에 만든 백업은 그 키가 있어야만, 또는 `--restore-keep-unreadable-credentials`로만 복원되며, 이 옵션은 누군가 비밀번호를 다시 입력할 때까지 해당 장치를 다운 상태로 둡니다. Secret은 백업과 따로 보관하세요. 4.16.0으로 되돌리려면 업그레이드 전에 받아 둔 dump를 복원해야 합니다.
- 차트를 설치하지 않고 `helm template`으로 렌더링하시나요? `secretKey.existingSecret`에 직접 만든 키를 넣으세요. 그렇지 않으면 렌더링할 때마다 새 키가 만들어집니다.
- Edge Relay: 푸시된 장치 파일은 `/data/pushed-devices.json`에 있고, 존재하는 동안은 차트의 `devices`보다 우선합니다. `DELETE /api/fleet/{id}/config`로 지울 수 있습니다. 4.16.0에서 실패한 푸시는 브로커에 계속 보관되어 4.17.0의 첫 부팅 때 도착합니다. Quadlet 사용자는 새 유닛을 받으세요. `persistence.enabled=false`에서도 이제 부팅되지만, pod가 교체될 때마다 포워드 큐, 푸시된 파일, OPC UA 인증서를 잃습니다.
