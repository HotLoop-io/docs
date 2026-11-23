---
title: "core 4.16.0 릴리스 노트"
description: "HotLoop core 4.16.0에 담긴 내용, 업그레이드할 때 달라지는 점, 가동 중인 플랜트를 건드리기 전에 읽어야 할 내용입니다."
sidebar:
  label: "4.16.0"
---

8월의 4.3.1 이후 처음으로 공개되는 릴리스입니다. 4.4.0부터 4.15.3까지는 병합만 되고 공개된 적이 없으므로, 4.3.1을 쓰고 계시다면 새 이름, 새 이미지, 새 차트, 새 라이선스와 함께 모든 변경을 한꺼번에 받게 됩니다. **4.3.1에서 올라오는 경우 단순한 `helm upgrade`로는 끝나지 않습니다.** 가동 중인 플랜트를 건드리기 전에 아래의 「4.3.1에서 업그레이드」를 읽어 주세요.

전체 노트는 README에 있습니다. 4.16.0의 변경 사항이 먼저 나오고, 그 아래에 4.4.0까지의 모든 버전이 이어집니다.

## 요약

- **HotLoop Core: 엔티티.** 모든 tag는 고정된 id를 가진 엔티티이며 ISA-95 설비 트리에 놓입니다. 모터, 밸브, PID 루프 같은 것은 각자의 tag로 만든 복합 엔티티이고, 모든 알람도 엔티티이며, 엔티티에 내리는 모든 명령은 tag 쓰기와 같은 쓰기 게이트를 지납니다. 에이전트(MCP), 자동화, 새 Entities 및 Plant 화면이 모두 이를 사용합니다. 서비스 호출은 `?dry_run=true`로 먼저 물어볼 수 있고, 명령 프롬프트는 확인하기 전에 「Would be refused: ...」라고 알려 줍니다.
- **휴대폰에 도착하는 알림:** Acknowledge 버튼이 있는 ntfy와 Discord 봇, Gotify, Discord webhook을 지원하며, 알림이 몰릴 때는 속도 제한이 한 건의 요약으로 묶어 줍니다.
- **가동 중인 플랜트에 중요한 수정:** 보류 해제(unshelve)가 미확인 알람을 지울 수 있었습니다. OPC UA 구독이 세션에는 연결됨으로 표시된 채 영영 조용해질 수 있었습니다. 응답 없는 Modbus 장치가 다운으로 판정되기까지 최대 15분이 걸렸습니다. 실패한 webhook이 URL을 로그에 남겼는데, Discord와 ntfy에서는 이 URL이 곧 비밀번호입니다. 복원이 컬럼을 위치 순서로 읽어 들였습니다. 재배포할 때마다 OPC UA 서버 인증서가 바뀌어 Ignition이 더 이상 신뢰하지 않았습니다. Discover tags가 모든 OPC UA 노드를 float로 가져왔습니다. Settings 화면이 아무도 읽지 않는 폴링 변수를 표시했습니다.
- **Ignition 8.3.9가 우리 OPC UA 서버를 읽습니다.** 처음부터 끝까지 검증했으며, 서버는 이제 제조사를 `HotLoop`으로 보고합니다.
- **Edge Relay가 출시됩니다.** 자체 이미지와 차트를 갖추고 Gateway와 보조를 맞춥니다. TimescaleDB 2.30.1이며 확장은 이제 스스로 업데이트됩니다.

### API 변경 사항

- 빈 목록은 스트림을 포함해 어디서나 `null`이 아니라 `[]`입니다.
- 유효한 값이 없는 `/api/history` 구간은 `null`(빈 칸)이며, 불량 값은 평균에서 제외됩니다.
- API가 원인을 분류하지 못하는 오류는 400이 아니라 로그 참조가 붙은 500입니다. 쓰기나 탐색에서 오류가 나는 장치는 502입니다.
- 알람 엔티티가 받지 않는 서비스(`alarm.turn_on`)는 400입니다. 전에는 성공이라고 답하고 아무것도 하지 않았습니다.
- 보류 상태가 아닌 알람의 보류를 해제하면 409입니다.
- tag JSON에는 항상 `minValue`, `maxValue`, `hasRange`가 들어 있습니다.
- 신규: `POST /api/services/{domain}/{service}`의 `?dry_run=true`. `true` 또는 `false`만 허용되며 그 외에는 400입니다.

### 4.3.1에서 업그레이드

- 이미지 `ghcr.io/hotloop-io/hotloop`(이전 `ghcr.io/embernet-ai/industrial-iot`), 차트 저장소 `https://hotloop.io/hotloop`, 차트 `hotloop`(이전 `industrial-iot`)이며, 모든 `IIOT_` 변수는 `HOTLOOP_`가 됩니다.
- 차트 이름이 워크로드 selector에 들어 있어서 Kubernetes가 제자리에서 바꾸지 못합니다. 릴리스 이름과 네임스페이스는 그대로 두고 다음을 진행하세요. 데이터베이스를 `pg_dump`합니다. 이전 Deployment(`<release>`)와 StatefulSet(`<release>-postgresql`)을 삭제하면 데이터베이스 볼륨은 그대로 남습니다. `helm upgrade <release> hotloop/hotloop -f your-4.3.1-values.yaml`을 실행합니다. `--reuse-values`는 쓰지 않습니다. `extraEnv`의 `IIOT_`를 모두 새 이름으로 바꾸고 `image.repository` 재정의는 지웁니다. 새 데이터베이스 pod가 이전 볼륨을 마운트하고, Gateway가 시작할 때 이를 앞으로 마이그레이션합니다.
- 라이선스: 4.3.1에 들어 있던 조건이 아니라 HotLoop 자체 라이선스 조건입니다. 가정과 랩에서는 무료이고, 기업은 EmberNet을 통해 무료로 가입합니다. 현재 조건은 LICENSE에 있습니다.
- 로그인이 생겼고, 쓰기는 기본적으로 꺼져 있으며, 시간대를 불러오지 못하면 UTC로 계속 실행하지 않고 시작을 중단합니다.
