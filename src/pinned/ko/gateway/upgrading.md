---
title: "Gateway를 {{hotloop}}로 업그레이드"
description: "4.22.1부터는 마이그레이션 3개가 추가된 helm upgrade 한 번이면 됩니다. 4.18.11부터 에이전트가 쓸 수 있고, 4.18.10부터 DB가 PostgreSQL 17로 바뀝니다."
sidebar:
  label: "업그레이드"
---

{{hotloop}}로 가는 길은 여섯 가지이고 서로 전혀 다릅니다. 4.22.1에서는 테이블과 열 세 개를 추가하고 장비 상태를 위해 호스트를 읽기 전용으로 마운트하는 단순한 `helm upgrade`이므로 Pod Security 프로파일을 확인하십시오. 4.18.11에서는 단순한 `helm upgrade`이지만 가동 중인 공장의 동작을 바꾸는 것이 두 가지 있으니 먼저 읽으십시오. 4.18.10에서는 데이터베이스 엔진이 바뀌므로 그 일이 일어나기 전에 알아 두어야 합니다. 4.17.0에서는 몇몇 기본값이 바뀐 단순한 `helm upgrade`입니다. 4.16.0에서는 먼저 4.17.0을 거치며, 그 뒤에는 새 Secret이 데이터베이스만큼이나 공장 데이터의 일부가 됩니다. 4.3.1에서는 이름이 바뀐 차트라서 단순한 `helm upgrade`로는 건드릴 수 없고, 도중에 4.16.0과 4.17.0을 거칩니다. 릴리스 노트는 한 번에 한 단계만 다루며 릴리스를 건너뛰는 경우는 어디에도 없으므로, 이 페이지는 그것이 된다고 약속하지 않습니다. 자신에게 해당하는 경로를 찾아 가동 중인 공장에 손대기 전에 끝까지 읽으십시오.

:::caution[4.20.2 이하에서 올라오는 경우: Basic256을 쓰는 OPC UA 클라이언트가 연결되지 않습니다]
4.21.0부터 `Basic128Rsa15`와 `Basic256`은 업그레이드와 새 설치 모두에서 기본적으로 꺼집니다. 서버는 더 이상 이 둘을 목록에 올리지 않고, 이름으로 요청하는 클라이언트를 거부합니다. 사용 중인 OPC UA 클라이언트 중 `Basic256`보다 새로운 것을 지원하지 않는 것이 있는지(Ignition의 연결에서 볼 수 있습니다) 확인하고, 그 클라이언트를 `Basic256Sha256`으로 옮기십시오. 옮길 수 없다면 `HOTLOOP_OPCUA_SERVER_ALLOW_DEPRECATED_POLICIES=true`(차트에서는 `opcuaServer.allowDeprecatedPolicies: true`)로 두 정책을 되살릴 수 있고, 서버는 시작할 때 이를 알립니다. 4.21.0은 새 테이블인 마이그레이션 0027도 추가하므로, 그 밖에는 단순한 `helm upgrade`입니다. 릴리스 점검에서 4.20.2를 마이그레이션된 스키마에서 시작해 보았고 정상 동작했으므로, 이 테이블이 롤백이 안전하지 않은 이유는 아닙니다.
:::

:::note[이전 차트는 URL로 가져옵니다]
차트 저장소 색인에는 Gateway 차트가 4.16.0까지 남아 있으므로 `hotloop/hotloop --version 4.17.0`이 해석되며, 패키지는 URL로도 제공됩니다. 아래의 4.16.0과 4.17.0 명령은 `https://hotloop.io/hotloop/hotloop-4.17.0.tgz`처럼 차트를 URL로 지정하며, 어느 쪽이든 동작합니다. IoT와 Edge는 4.18.10부터 시작합니다.
:::

## 4.22.1에서 업그레이드

단순한 `helm upgrade`이며, 장비에 이미 있는 것은 아무것도 바뀌지 않습니다. 첫 시작에서 마이그레이션 세 개가 실행되고 각각 추가만 합니다. `0028_unifi_port_cycles`, `0029_energy`, `0030_energy_demand`입니다. 4.22.1에서 만든 백업은 여기에서 복원되지만, 여기에서 만든 백업은 이전 릴리스에 복원되지 않으므로 되돌아갈 가능성이 있다면 먼저 백업하십시오.

- **차트가 이제 장비 상태를 위해 호스트를 읽기 전용으로 마운트합니다.** Gateway와 Edge 차트는 EmberNet 대시보드가 장비의 디스크, CPU, 메모리를 읽을 수 있도록 호스트의 루트와 `/proc`을 마운트합니다. 권한은 추가되지 않습니다. restricted Pod Security 프로파일의 클러스터는 hostPath를 거부하므로, 그런 곳에서는 업그레이드 전에 `opcuaServer.dashboard.boxHealth.enabled: false`로 설정하십시오. 값은 [Gateway 설치](/ko/gateway/install/#박스-상태와-호스트-마운트)에 있습니다.
- **완성된 기능은 이제 켜진 채로 제공됩니다.** 차트에 해당 기능이 있는 곳에서는 `broker.enabled`, `opcuaServer.enabled`, `reports.enabled`, `backup.enabled`(매일, `backup.interval: 24h`), 모든 알람 채널을 포함한 `notify.enabled`, `edgePublish.enabled`, `monitoring.serviceMonitor.enabled`(Prometheus 오퍼레이터의 CRD가 설치된 곳에서만 생성됩니다), `ingress.enabled`가 모두 true입니다. Ingress에는 호스트 이름이 없으므로 ingress 클래스가 처리하는 모든 호스트에 응답합니다. 한 이름에 고정하려면 `ingress.hosts[0].host`를 설정하십시오. 보낼 곳이 없는 알람 채널이나 edge 퍼블리셔는 대기하며 그렇게 알리고, 관리자가 설정의 "알람과 측정값이 가는 곳"에서 목적지를 지정합니다. 사용자의 파일이 설정한 값이 계속 우선하며, `false`로 설정한 항목은 리스너, Service, 볼륨, Ingress를 만들지 않습니다.
- **읽기만 할 수 있는 새 로그인이 하나 생깁니다.** 차트는 이 버전을 처음 설치할 때 `embernet-dashboard-read`와 Secret `<release>-opcua-dashboard`를 만들며, 이를 교체하지 않습니다.
- **UniFi 명령이 있지만 꺼져 있습니다.** 포인트 다섯 종류가 콘솔에 명령을 내릴 수 있고, 사람이 해당 태그를 활성화하기 전까지는 각각 읽기 전용으로 남습니다. 동작하려면 콘솔 계정이 로컬 관리자여야 합니다.
- **Quadlet 업그레이드 유닛은 스스로 건너뜁니다.** `hotloop-db-upgrade`는 볼륨에 아직 PostgreSQL 16 데이터가 있을 때만 실행되므로, 이미 17인 장비에서는 실패가 아니라 비활성으로 표시됩니다. 새 유닛 파일은 `deploy/quadlet/`에서 가져오십시오.
- **차트는 제거할 때 자격 증명 Secret을 남깁니다.** 데이터베이스 볼륨과 마찬가지입니다. 처음부터 다시 시작하려면 볼륨과 함께 Secret을 직접 삭제하십시오.

## 4.18.11에서 업그레이드

업그레이드할 이유: MCP를 통한 에이전트가 이제 쓸 수 있고, 스케일이 있는 태그에 쓴 값이 의도한 대로 레지스터에 들어가며, CODESYS 런타임을 프로그래머가 변수에 붙인 이름으로 읽을 수 있고, HotLoop이 측정값과 시스템 로그를 Kafka 브로커로 보낼 수 있으며, UADP 기반 OPC UA PubSub이 양방향으로 동작하고, 스토어에서 설치하면 본인 계정으로 로그인됩니다. [4.19.4 릴리스 노트](/ko/releases/hotloop-4-19-4/)에 전체 목록이 있고, [4.19.5](/ko/releases/hotloop-4-19-5/)는 그 멀티 아키텍처 빌드이며, [4.19.8](/ko/releases/hotloop-4-19-8/)은 로그북 수정과 공장 전체를 검색하는 태그 선택기를 더합니다. 4.19.0부터 4.19.3, 4.19.6, 4.19.7은 태그만 붙고 게시되지 않았으므로 업그레이드의 출발점으로 존재하지 않습니다.

```bash
helm repo update
helm upgrade hotloop hotloop/hotloop --version {{hotloop}} \
  --namespace hotloop --reset-then-reuse-values
```

`hotloop-edge`, `hotloop-iot`, `hotloop-edge-relay`도 같습니다. 데이터베이스는 4.18.11부터 이미 PostgreSQL 17이고 여기서 바뀌는 것은 없으므로, 4.18.11로의 `helm rollback`은 문제가 없습니다.

- **에이전트가 쓸 수 있습니다.** `allowMcpWrites`는 코드와 세 차트 모두에서 기본으로 켜져 있습니다. `allowWrites`가 켜져 있고 `allowMcpWrites`를 설정한 적이 없는 배포는 이번 업그레이드에서 화면과 같은 게이트를 거쳐 에이전트 쓰기를 받게 됩니다. `allowMcpWrites: false`를 저장해 둔 배포는 꺼진 채로 유지됩니다. 에이전트를 읽기 전용으로 두려면 업그레이드 전에 `false`로 설정하십시오.
- **MCP 엔드포인트에는 항상 토큰이 있습니다.** 토큰을 설정한 적 없는 단독 바이너리나 Quadlet 유닛은 첫 시작에서 자체 토큰을 만들어 데이터베이스에 보관합니다. `hotloop mcp-token`으로 출력할 수 있으며, 토큰 없이 `/mcp`를 가리키던 에이전트는 이 토큰을 줄 때까지 동작하지 않습니다.
- **스케일이 있는 태그.** 스케일 0.1인 태그에 55.5를 쓰면 레지스터에는 555가 들어갑니다. 예전에는 55가 들어갔습니다. 이를 피하려고 누군가 원시 카운트를 입력해 왔다면 이제는 10배를 보내게 됩니다. 자동화나 레시피에서 사람이 직접 쓰는, 스케일이나 오프셋이 있는 모든 태그를 확인하고, 그 숫자를 업그레이드와 같은 단계에서 공학 단위 값으로 바꾸십시오.
- **시간은 `Z`입니다.** API가 쓰는 모든 시간은 UTC입니다. 로컬 오프셋을 파싱하던 스크립트는 이제 `Z`를 받습니다.
- **마이그레이션 하나,** `0026`이 히스토리안 대상에 `options` 열을 추가하며, 기존 모든 대상에서는 비어 있습니다.

## 4.18.10에서 업그레이드

업그레이드할 이유: 데이터베이스가 이제 PostgreSQL 17이고 장비가 스스로 이동합니다. 또한 SNMP와 BACnet/IP [통합](/ko/iot/integrations/), 키오스크 로그인, 알람 에스컬레이션, 휴대폰에 설치되는 UI를 얻습니다. 목록은 [4.18.11 릴리스 노트](/ko/releases/hotloop-4-18-11/)에 있습니다. 아래는 주의해야 할 부분입니다.

PostgreSQL은 다른 메이저 버전의 데이터 디렉터리를 열지 못하므로, 이미지만 바꾸면 기존의 모든 장비에 시작할 수 없는 데이터베이스가 남았을 것입니다. HotLoop은 덤프 후 다시 로드하라고 요구하지 않습니다. 업그레이드 뒤 첫 시작에서 데이터베이스보다 먼저 스크립트가 실행되고, 그 스크립트가 이동을 처리합니다.

```bash
helm repo update hotloop
helm upgrade <release> hotloop/hotloop --version {{hotloop}} --reset-then-reuse-values
```

`hotloop-edge`와 `hotloop-iot`도 같습니다. 먼저 4.18.10에서 백업을 만들어 장비 밖으로 복사하십시오. HotLoop 자체 백업은 실행 중인 앱이 실행 중인 데이터베이스를 통해 만들기 때문에, 데이터베이스가 시작되기 전에 실행되는 단계에서는 만들 수 없습니다.

### 4.18.10에서 첫 시작할 때 일어나는 일

- **데이터베이스 파드가 `Init`에 머물고 앱은 그것을 기다립니다.** 차트에서는 데이터베이스 파드의 init 컨테이너 두 개입니다. 이전 이미지가 PostgreSQL 16 설치를 넘겨주고, 새 이미지가 이전 디렉터리 옆의 새 디렉터리로 복사 모드의 `pg_upgrade`를 실행합니다. 새 서버를 한 번 시작해 열리는지 확인하고, 그 뒤에야 이름을 바꿉니다. 걸리는 시간은 데이터 양에 비례하므로 큰 데이터는 처음에 로그를 지켜보십시오. `kubectl logs <release>-postgresql-0 -c pg-upgrade`. Quadlet에서는 `hotloop-db-upgrade.container`이며, 데이터베이스 유닛이 요구하는 oneshot 유닛입니다. `journalctl -u hotloop-db-upgrade`.
- **데이터 크기만큼의 여유 공간이 필요하며, 시작하기 전에 확인합니다.** 공간이 없으면 16 데이터를 있던 그대로 두고 데이터베이스를 시작하지 않은 채 멈춥니다. 디스크를 비우고 다시 시작하십시오.
- **`pgdata.pg16`은 볼륨에 남으며, 삭제는 사용자의 몫입니다.** 이전 디렉터리는 이름이 바뀐 채 그대로 남습니다. 업그레이드 시점의 PostgreSQL 16 데이터베이스 전체이며, 백업이자 되돌아가는 길이고, 데이터베이스만큼 큽니다. 장비를 원하는 만큼 17로 운영한 뒤에는:

  ```bash
  # chart
  kubectl -n hotloop exec hotloop-postgresql-0 -c postgresql -- rm -rf /var/lib/postgresql/data/pgdata.pg16
  # Quadlet
  sudo rm -rf "$(sudo podman volume inspect hotloop-db --format '{{.Mountpoint}}')/pgdata.pg16"
  ```

- **실패해도 있던 자리에 그대로 있습니다.** 교체 전에 무언가 실패하면 16 데이터는 손대지 않은 상태이고, 데이터베이스는 반쯤 만든 디렉터리로 시작하지 않습니다. 차트에서는 파드가 `Init:Error`에 머뭅니다. Quadlet에서는 업그레이드 유닛이 실패하고 그 뒤의 데이터베이스 유닛은 시작되지 않습니다. 로그가 말하는 것을 고치고 다시 시작하십시오.
- **4.18.10으로의 `helm rollback`은 데이터베이스를 시작하지 못합니다.** 이것이 주의할 점입니다. 롤백하면 데이터베이스 이미지가 PostgreSQL 16으로 돌아가는데, 16은 17 디렉터리를 열지 못합니다. 잃는 것도 반쯤 바뀐 것도 없고, 데이터베이스가 시작되지 않을 뿐입니다. 되살리려면 k3s와 Helm 페이지의 [되돌리기](/ko/install/helm/#되돌리기)에 있는 교체가 필요합니다. 데이터베이스를 멈추고 `pgdata`를 `pgdata.pg17`로, `pgdata.pg16`을 `pgdata`로 옮기십시오. **이렇게 하면 업그레이드 이후 17에서 쓴 모든 기록이 사라집니다.** `pgdata.pg16`은 그 시점의 데이터베이스이기 때문입니다. 가능하면 앞으로 나아가십시오. 되돌리는 교체는 한 번만 동작하며, 다음 업그레이드는 `pgdata.pg16`이 남아 있는 동안 실행을 거부합니다. 문서로 설명되어 있을 뿐 테스트로 실행하지는 않습니다.
- **Quadlet 장비는 이 영향을 받지 않습니다.** Podman의 자동 업데이트는 앱만 롤백하고 데이터베이스는 결코 롤백하지 않으며, 마이그레이션은 추가만 하므로 4.18.10 앱은 PostgreSQL 17 데이터베이스를 문제없이 읽습니다. 업데이트를 롤백한 Quadlet 장비는 계속 실행됩니다.
- **새 마이그레이션 하나, `0025_kiosk_pin`.** 열만 추가하며 모두 기본값이 있으므로 4.18.10은 이 마이그레이션이 남긴 스키마에서 실행됩니다.
- **이제 모든 설치에 잠금이 켜져 있습니다.** 비밀번호나 PIN을 연속 10번 틀리면 해당 계정이 5분 동안 잠기며, 관리자가 해제할 수 있습니다. 틀린 비밀번호를 10번 넘게 재시도하는 스크립트는 `429`를 받기 시작합니다. `HOTLOOP_AUTH_LOCKOUT_ATTEMPTS=0`으로 끌 수 있습니다.
- **업그레이드 끄기.** `database.postgresql.upgrade.enabled: false`는 init 컨테이너를 없애며, 그러면 아직 16인 볼륨이 데이터베이스 시작을 막습니다. 켜 두십시오. 켜 둔 상태에서도 init 컨테이너의 이미지는 실행 전에 가져오기 때문에, 새 설치는 노드마다 한 번 PostgreSQL 16 이미지를 가져옵니다.

### Quadlet과 Edge Relay

제품의 `deploy/quadlet/` 디렉터리에서 새 `hotloop-db.container`, `hotloop-db-upgrade.container`, `hotloop-db-upgrade.sh`를 유닛 디렉터리로 복사하고 `systemctl daemon-reload`를 실행한 뒤 `hotloop-db.service`를 다시 시작하십시오. 데이터베이스 유닛이 업그레이드 유닛을 요구하므로, 새 데이터베이스 유닛만 받은 장비는 16 데이터에서 시작하지 않고 그 이유를 알려 줍니다. Edge Relay에는 데이터베이스가 없으므로 할 일이 없습니다. 모든 제품이 같은 버전으로 함께 나가므로 {{hotloop}}으로 배포됩니다.

### 4.18.10부터의 API 변경

- **새 경로:** `GET`과 `PUT /api/notify/escalation`, `GET /manifest.webmanifest`와 `GET /sw.js`(휴대폰이 아무도 로그인하기 전에 요청하므로 세션 없음), `GET /api/integrations`와 `POST /api/integrations/{id}/probe`, `/setup`, `POST /api/auth/kiosk`, `POST /api/auth/activity`, `PUT`과 `DELETE /api/users/{username}/pin`, `DELETE /api/users/{username}/lockout`.
- **새 권한 `notify.escalation`은** 관리자 전용입니다. 조회자와 운전원 역할에는 부여되지 않았습니다.
- **새 프로토콜 두 개,** `snmp`와 `bacnet`이 `GET /api/protocols`에 있습니다. 알람 이력에는 새 이벤트 유형 `escalated`와 `escalation-ended`가 생겼으며, 이전 목록을 가정하는 스크립트는 이를 만나게 됩니다.
- **시간은 UTC로 돌아옵니다.** 이력이 돌려주는 모든 시간이 그렇습니다. 문자열을 비교하던 스크립트는 오프셋이 `Z`로 바뀌는 것을 보게 됩니다. 시각을 비교하는 스크립트는 아무 변화도 보지 못합니다.

## 4.17.0에서 업그레이드

업그레이드할 이유: Gateway가 유일한 이미지가 아니게 됩니다. IoT와 Edge가 새로 나왔고, 데이터베이스는 설정이 되었으며, MQTT로 스스로 알리는 장치가 저절로 나타나고, 이력을 공장 자체 데이터베이스에 쓸 수 있으며, `:stable`을 따르는 장비는 잘못된 업데이트를 스스로 롤백합니다. 마지막 것은 마이그레이션이 추가만 하기 때문에 가능합니다. 목록은 [4.18.10 릴리스 노트](/ko/releases/hotloop-4-18-10/)에 있습니다.

단순한 `helm upgrade`입니다. 4.17.0과 {{hotloop}} Gateway 차트를 같은 값으로 나란히 렌더링해 보았고, 객체 여덟 개, 셀렉터, 볼륨 클레임이 모두 같았습니다.

```bash
helm repo update hotloop
helm upgrade <release> hotloop/hotloop --version {{hotloop}} --reset-then-reuse-values
```

`--reset-then-reuse-values`를 쓰거나 `-f`로 값 파일을 지정하십시오. 단순한 `--reuse-values`는 이번에는 우연히 렌더링되지만 4.17.0의 값을 그대로 다시 적용하여 이 릴리스가 추가한 모든 기본값을 잃게 되며, 그래서 의도하지 않게 아래의 이전 큐 제한에 머물게 됩니다.

### 4.17.0에서 첫 시작할 때 일어나는 일

- **마이그레이션 0016부터 0025까지 실행됩니다.** `0016_mqtt_discovery`, `0017_broker_logins`, `0018_mqtt_sources`, `0019_historian_targets`, `0020_net_finds`, `0021_mqtt_source_dialects`, `0022_mqtt_source_shelly`, `0023_dashboards`(직접 만든 대시보드가 저장되는 테이블), `0024_tag_no_data`(태그의 `no_data` 열로, 이미 있는 모든 태그에서는 비어 있으며 이 태그들이 이미 하던 동작과 같습니다), `0025_kiosk_pin`(PIN 해시, 세션 유휴 제한, 잠금 카운터를 위한 열)입니다. 모두 추가만 합니다. 늘 그렇듯 먼저 `pg_dump`를 하십시오.
- **`edgePublish.queueMaxBytes`의 기본값은 무제한이 아니라 64 MiB입니다.** Sparkplug로 상위에 게시할 때만 해당됩니다. 한도를 넘으면 가장 오래된 측정값이 버려지고 개수가 집계됩니다. 무제한 큐는 장애가 충분히 길면 볼륨을 가득 채우므로 더 나쁘지만, 기본값이 바뀐 것은 사실입니다. 64 MiB는 약 248,000개 측정값이며, 초당 2,000개일 때 약 2분이므로 자체 속도(측정값당 약 240바이트)로 크기를 정하거나, 예전 동작을 원하면 `0`으로 설정하십시오. 그렇게 하면 HotLoop은 시작할 때 경고합니다. `--reuse-values`로 업그레이드한 릴리스는 가지고 있던 값을 유지합니다.
- **브로커 로그인.** `HOTLOOP_BROKER_USERS`의 로그인은 이전처럼 계속 모든 것을 할 수 있습니다. 직접 쓰지 않은 규칙에 Sparkplug 트래픽이 막히는 공장으로 업그레이드하는 일이 없어야 하기 때문입니다. 설정, MQTT에서 만든 로그인은 프로파일의 토픽 규칙을 가집니다. `HOTLOOP_BROKER_USERS`가 없는 브로커도 이제 시작되며, HotLoop과 그 안에서 만든 로그인만 접속할 수 있습니다.
- **데이터베이스는 이 첫 시작에서 PostgreSQL 16에서 17로 이동합니다.** 스스로 이동하며 여유 디스크가 필요합니다. 어떻게 진행되는지는 [4.18.10 절](#41810에서-업그레이드)에 있으며, 먼저 읽어야 할 부분입니다.
- **4.17.0으로 되돌아가는 것은 이제 `helm rollback`이 아니라 데이터베이스 교체입니다.** 스키마는 늘어나기만 했고 4.17.0은 그 위에서 실행되지만, 4.17.0의 데이터베이스는 PostgreSQL 16이라 업그레이드가 남긴 17 디렉터리를 열지 못합니다. 되돌리는 교체는 4.18.10 절에 있습니다. 그래도 업그레이드 전에 백업을 만드십시오. 이제 앱은 데이터베이스가 자신보다 얼마나 앞서 있는지도 세며, 데이터베이스가 두 릴리스 앞서면 두 버전을 밝히고 시작을 거부합니다.
- **다른 제품을 원하십니까?** IoT에서 Edge, Gateway로 옮겨도 모든 장치, 태그, 엔티티, 자동화, 알람, 사용자, 그리고 이력의 모든 시간이 유지됩니다. 백업한 뒤 같은 릴리스에서 `helm upgrade hotloop hotloop/hotloop-edge`를 실행하십시오. 방법은 [제품 라인업](/ko/products/)에 있습니다. 제품을 낮추는 일은 소중한 장비에서는 하지 마십시오.

### Edge Relay와 Quadlet

릴레이의 차트도 `--reset-then-reuse-values`로 업그레이드하십시오. Quadlet 사용자는 새 `edge-relay.container`를 받으십시오. 4.17.0에 고정하는 대신 `:stable`을 따르며, 잘못된 업데이트를 롤백시키는 healthcheck와 `--sdnotify=healthy`를 갖추고 있습니다. 이 둘이 없으면 실패한 업데이트도 성공으로 보고됩니다. Gateway에서 푸시한 장치 파일은 이제 다시 시작 없이 바로 적용되며, 4.17.0에서는 다시 시작을 기다렸습니다. 유닛 전체는 [Edge Relay 설치 페이지](/ko/edge-relay/install/)에 있습니다.

Gateway에는 이제 Quadlet 유닛이 있으며 4.17.0에는 없었습니다. [Podman Quadlet](/ko/install/quadlet/)의 `gateway/` 디렉터리에 있고, 절차는 [Gateway 설치 페이지](/ko/gateway/install/#podman-quadlet)에 있습니다.

### 4.17.0부터의 API 변경

- **새 경로:** `/api/discovery`와 그 동작 `accept`, `ignore`, `unignore`, `review`, `/api/network-discovery`와 그 `probe`, `accept`, `ignore`, `unignore`, `/api/mqtt/brokers`, `/api/broker/logins`, `/api/historian/targets`, `GET /api/entities/{entity_id}/image`, 그리고 릴레이가 보류 중인 이미지 업데이트를 승인하는 `POST /api/fleet/{id}/update`. 제거된 것은 없습니다.
- **`GET /api/status`는 `product`와 `features`,** 그리고 이미지 다이제스트를 알려 줍니다. 스크립트는 더듬어 보는 대신 물어보면 됩니다. 제품에 없는 기능의 경로는 `404`와 `{"error":...,"product":...,"feature":...}`로 응답합니다.
- **새 권한:** `fleet.update`, 관리자 전용입니다. 운전원 역할은 바뀌지 않았습니다.

## 4.16.0에서 업그레이드

4.17.0으로 가는 단계이며, 4.17.0에서는 [위의 절](#4170에서-업그레이드)로 {{hotloop}}까지 이어 갑니다. 아래 내용은 모두 4.17.0을 대상으로 검증되었습니다.

업그레이드할 이유: 4.16.0에는 가동 중인 공장이 걸릴 수 있는 버그가 있고 4.17.0이 이를 고칩니다. 명령 프롬프트가 Set을 삼킬 수 있어서, 운전원은 프롬프트가 닫히는 것을 보고 설정값이 나갔다고 생각하지만 아무것도 쓰이지 않았습니다. 편집기에서 규칙을 저장하면, 이름만 바꾸더라도 실행 예산이 조용히 5분으로 초기화됩니다. Edge Relay로 푸시한 장치 파일은 Gateway가 `config pushed`라고 해도 끝내 도착하지 않습니다. EmberNet App Store 배포는 테넌트를 잃습니다. 수정 외에도 [레시피](/ko/iot/recipes/), [스크립트](/ko/iot/scripts/), [블루프린트](/ko/iot/blueprints/), [헬퍼](/ko/iot/helpers/), [로그북](/ko/iot/logbook/), 새 [자동화](/ko/iot/automations/) 단계, 읽기 전용 [UniFi](/ko/iot/unifi/), 그리고 도구가 16개에서 25개로 늘어난 [MCP](/ko/iot/mcp/)를 얻습니다.

단순한 `helm upgrade`입니다. 두 버전의 두 차트를 모두 렌더링해 보았고, 모든 셀렉터와 볼륨 클레임이 같으며 새로 생기는 객체는 키의 Secret뿐입니다.

```bash
helm upgrade <release> https://hotloop.io/hotloop/hotloop-4.17.0.tgz --reset-then-reuse-values
```

`--reset-then-reuse-values`를 쓰거나 `-f`로 값 파일을 지정하십시오. **`--reuse-values`는 안 됩니다.** 4.16.0의 값을 그대로 다시 적용해 이 차트가 추가한 모든 기본값을 잃게 되고, 렌더링은 처음 필요한 값에서 실패합니다(`secretKey`에서 오는 `nil pointer evaluating interface {}.enabled`). 이때 클러스터에는 아무것도 바뀌지 않으므로 올바른 방식으로 다시 실행하면 됩니다.

### 첫 시작에서 일어나는 일

릴리스된 4.16.0 이미지를 데이터베이스에서 실행한 뒤 같은 데이터베이스에서 4.17.0을 실행하여 확인했습니다.

- **마이그레이션 0009부터 0015까지 실행됩니다.** `0009_helpers`, `0010_logbook`, `0011_scripts`, `0012_tag_device_class`, `0013_recipes`, `0014_blueprints`, `0015_unifi`입니다. 모두 추가만 합니다. 빈 공장에서는 0.2초가 걸렸습니다. 사용자의 환경에서는 데이터베이스 크기만큼 걸립니다. 늘 그렇듯 먼저 `pg_dump`를 하십시오.
- **장치 비밀번호가 암호화됩니다.** 차트가 이번 업그레이드에서 `<release>-secret-key`를 만들고(4.16.0에는 없었습니다), Gateway는 그 시작에서 저장된 모든 자격 증명을 봉인하고 로그에 `encrypted stored device credentials devices=N`이라고 남깁니다. 장치는 계속 연결되며, 아무도 다시 입력할 필요가 없습니다.
- **그때부터 이 키는 데이터의 일부입니다.** 키 없이 Gateway를 시작하면 봉인된 비밀번호가 있는 모든 장치는 필요한 키의 이름을 밝히는 오류와 함께 재시도하며 중단된 상태로 남습니다. 업그레이드 뒤에 만든 백업은 이 키가 마운트된 곳에서만 복원되며, 다른 곳에서는 `--restore-from`이 이름을 대며 거부합니다. 키를 영영 잃었다면 `--restore-keep-unreadable-credentials`로 나머지는 모두 복원되지만, 그 장치들은 누군가 비밀번호를 다시 입력할 때까지 중단된 채 남습니다. 4.16.0의 백업은 어디서나 복원되며, 복원이 끝나는 즉시 자격 증명이 봉인됩니다.
- **4.16.0으로 되돌아가기**는 같은 데이터베이스에서 시작은 됩니다(시험해 보았습니다). 하지만 4.16.0은 봉인을 전혀 모릅니다. 각 장치에 봉인된 텍스트를 비밀번호로 건네므로 비밀번호를 확인하는 것은 모두 이를 거부합니다. 되돌아가야 한다면 업그레이드 전에 받아 둔 `pg_dump`를 복원하십시오. 그것이 백업을 받아 두는 이유 전부입니다.
- **차트를 설치하는 대신 렌더링하십니까?** 키는 실제 `helm install`이나 `helm upgrade`만 할 수 있는 `lookup`으로 생성됩니다. `helm template`을 실행해 결과를 적용하는 것은 렌더링할 때마다 새 키를 받으며, 다음 동기화가 봉인된 모든 비밀번호를 잠가 버립니다. `hotloop gen-secret-key`로 자체 키를 만들어 직접 관리하는 Secret에 넣고 `secretKey.existingSecret`을 설정하십시오. Helm, Fleet, EmberNet App Store는 실제로 설치하므로 이것이 필요하지 않습니다.

그래서 이번 업그레이드 뒤의 새 일은, `<release>-secret-key`를 클러스터의 다른 시크릿을 백업하는 방식으로 백업하되 백업 옆이 아닌 다른 곳에 보관하는 것입니다. 보호하는 백업 옆에 놓인 키는 아무것도 보호하지 못합니다. 키가 다루는 나머지는 [설치](/ko/gateway/install/#필요해지기-전에-키를-백업하세요)에 있습니다.

### Edge Relay

릴레이도 같은 태그에서 릴리스된 4.17.0입니다. 차트를 같은 종류의 URL인 `https://hotloop.io/hotloop/hotloop-edge-relay-4.17.0.tgz`로 4.17.0까지 업그레이드하고, 플래그 규칙도 같습니다. `--reset-then-reuse-values`이거나 값 파일입니다. 릴레이에서 `--reuse-values`는 실패조차 하지 않습니다. 차트의 새 `pushedDevicesFile` 기본값을 잃고 변수를 빈 값으로 렌더링하여, 푸시가 다시 읽기 전용 마운트에서 실패합니다. 그러면 네 가지를 알아 두십시오.

- **푸시된 장치 파일은 `/data/pushed-devices.json`에 있습니다**(`HOTLOOP_EDGE_RELAY_PUSHED_FILE`, 차트의 `pushedDevicesFile`). 릴레이의 볼륨 위에 있습니다. 존재하는 동안에는 재시작, 파드 재배치, `devices`를 바꾸는 `helm upgrade`를 거쳐도 차트의 `devices`보다 우선합니다. 릴레이는 어느 파일로 시작했는지 로그에 남깁니다. 로컬 파일로 돌아가려면 릴레이가 연결된 동안 Gateway에서 `DELETE /api/fleet/{id}/config`(`fleet.config`)를 실행한 뒤 릴레이를 다시 시작하십시오. 이 재시작은 4.17.0의 동작입니다. 4.18.10부터는 연결된 릴레이가 즉시 되돌아갑니다.
- **오래된 푸시가 돌아올 수 있습니다.** 4.16.0 릴레이에 한 푸시는 도착하지 않았지만 브로커가 retained 상태로 여전히 가지고 있으며, 4.17.0 릴레이는 첫 부팅에서 이를 받아 실행합니다. 오래된 것이라면 업그레이드 직후 같은 `DELETE`로 지우고 릴레이를 다시 시작하십시오. 4.18.10부터는 삭제가 즉시 적용되어 다시 시작이 필요 없습니다.
- **Quadlet: 새 `edge-relay.container`를 받으십시오.** 4.17.0의 유닛은 4.17.0에 고정하고 `HOTLOOP_EDGE_RELAY_PUSHED_FILE`을 설정했으며, 현재 유닛도 이를 설정하지만 `:stable`을 따릅니다. 이 줄이 없으면 읽기 전용 루트에서 푸시가 여전히 실패합니다. 유닛 전체는 [Edge Relay 설치 페이지](/ko/edge-relay/install/#quadlet)에 있습니다.
- **`persistence.enabled=false`가 이제 부팅됩니다.** `persistence.size`로 제한된 emptyDir 위에서 동작합니다. 선택하기 전에 대가를 알아 두십시오. 파드가 교체될 때마다 전달 큐, 푸시된 장치 파일, OPC UA 클라이언트 인증서를 잃습니다. 중요한 것은 PVC를 쓰며, 이것이 기본값입니다.

### API를 사용하는 스크립트가 알아챌 변화

- **일어나지 않은 시간은 생략됩니다.** `null`이 아니라 생략입니다. 4.16.0은 한 번도 실행되지 않은 규칙이나 스크립트의 `lastRun`, 한 번도 폴링되지 않은 장치의 `lastPoll`과 `lastGood`, 지속 중인 알람의 `clearedAt`, `ackedAt`, `shelvedUntil`, 한 번도 발생하지 않은 알람의 `raisedAt`, 라이브 피드의 `alarm` 이벤트에 있는 같은 필드 등에 `0001-01-01T00:00:00Z`를 보냈습니다. 그래서 한 번도 실행되지 않은 규칙이 "마지막 실행 739887일 전"이라고 말했습니다. 코드가 1년을 검사한다면 대신 필드가 있는지를 검사하십시오.
- **운전원은 업그레이드하는 순간 새 권한을 받습니다.** `helpers.write`, `scripts.run`, `recipes.apply`, `blueprints.apply`입니다. 그래서 운전원은 즉시 헬퍼를 설정하고, 스크립트를 실행하고, 레시피를 적용하고, 블루프린트로 규칙을 만들 수 있습니다. 스크립트, 레시피, 블루프린트를 작성하는 것(`scripts.write`, `recipes.write`, `blueprints.write`)은 관리자 권한입니다. 읽기는 모두 가능합니다. 레시피는 자체 `recipes.apply.<name>`을 지정할 수도 있습니다.
- **새 경로:** `/api/helpers`, `/api/logbook`, `/api/scripts`, `/api/recipes`, `/api/blueprints`, `POST /api/automations/{id}/blueprint-upgrade`, UniFi 경로(`/api/devices/{id}/network`와 `/api/unifi/{id}/...`), `DELETE /api/fleet/{id}/config`.
- **태그가 `deviceClass`를 가지며,** 이는 해당 엔티티로 전달됩니다.
- **규칙이 `blueprintId`, `blueprintVersion`, `blueprintInputs`를 가집니다.** 직접 작성한 규칙에는 없습니다. 규칙을 저장하면 여전히 통째로 교체되며, 요청 본문으로 규칙을 다른 블루프린트나 버전으로 옮길 수는 없습니다.

## 4.3.1에서 업그레이드

4.3.1은 8월에 게시되었고, 4.16.0까지 그 이후에는 아무것도 게시되지 않았습니다. 4.4.0부터 4.15.3까지는 병합만 되고 게시되지 않았으므로, 4.3.1을 떠나면 새 이름, 새 이미지, 새 차트, 새 라이선스 아래에서 이 모두를 한 번에 받게 됩니다. 이 절은 이 절차를 검증한 릴리스인 4.16.0까지 안내합니다. 그 뒤에는 위의 [4.16.0에서 업그레이드](#4160에서-업그레이드)가 4.17.0으로 가는 단순한 업그레이드이고, [4.17.0에서 업그레이드](#4170에서-업그레이드)가 그다음입니다. 가동 중인 공장에 손대기 전에 세 개를 모두 읽으십시오. 짧으며, 히스토리안이 왜 비었는지 공장장에게 설명하는 것보다 훨씬 짧습니다.

### 모든 것의 새 이름

| 항목 | 4.3.1 | 4.16.0 이후 |
|---|---|---|
| 이미지 | `ghcr.io/embernet-ai/industrial-iot` | `ghcr.io/hotloop-io/hotloop` |
| 차트 저장소 | 이전 주소, 지금은 404 | `https://hotloop.io/hotloop` |
| 차트 | `industrial-iot` | `hotloop` |
| 환경 변수 | `IIOT_*` | `HOTLOOP_*`(4.9.0부터) |

### 단순한 helm upgrade가 아닙니다

차트 이름이 Deployment와 StatefulSet의 셀렉터에 박혀 있으며, Kubernetes는 셀렉터를 제자리에서 바꾸는 것을 단호히 거부합니다. 이전 릴리스를 새 차트로 가리키면 그대로 실패합니다. 릴리스 이름과 네임스페이스는 그대로 두고 다음을 하십시오.

1. 데이터베이스를 `pg_dump`하십시오. 이중으로 안전하게. 해 두길 잘했다고 생각하게 될 것입니다.
2. 이전 Deployment(`<release>`)와 StatefulSet(`<release>-postgresql`)을 삭제하십시오. 데이터베이스 볼륨은 별도의 클레임이므로 그대로 남습니다.
3. 저장소를 추가하고 4.3.1을 실행할 때 쓰던 값 파일로 업그레이드하십시오.

   ```bash
   helm upgrade <release> https://hotloop.io/hotloop/hotloop-4.16.0.tgz \
     -n <namespace> -f your-4.3.1-values.yaml
   ```

   이것은 URL로 지정한 4.16.0 차트이며, 저장소를 추가하기 전에도 동작합니다. 4.16.0에 오르면 그다음 단계를 위해 저장소를 추가하십시오(`helm repo add hotloop https://hotloop.io/hotloop`).

   그 파일의 어떤 값도 차트에서 제거되지 않았습니다. `extraEnv`의 `IIOT_`를 모두 `HOTLOOP_`로 바꾸고, `image.repository` 재정의가 있었다면 지우십시오. `--reuse-values`는 쓰지 마십시오. 4.3.1 이후 이 차트가 추가한 모든 기본값, 즉 키의 절반 넘는 것을 건너뛰어 구멍투성이인 차트를 실행하게 됩니다.

이름, Secret의 데이터베이스 비밀번호, 볼륨 클레임은 4.3.1과 동일하게 렌더링되므로 새 데이터베이스 파드가 이전 데이터를 마운트합니다. Gateway는 시작할 때 스키마를 앞으로 마이그레이션하며, 그 김에 TimescaleDB를 2.29.1에서 2.30.1로 올립니다.

두 차트를 나란히 렌더링하여 확인했습니다. 1단계가 되돌아가는 길입니다. 업그레이드가 예상 밖이면 5분 전의 덤프가 있는 것이며, 그 일은 [info@hotloop.ai](mailto:info@hotloop.ai)로 알려 주십시오.

### 동작이 달라지는 것

- **로그인이 있습니다.** 4.4.0 이전에는 아예 없었습니다. 차트는 첫 설치에서 `admin` 계정을 만들며, 비밀번호를 읽는 명령은 [설치](/ko/gateway/install/#로그인)에 있습니다.
- **쓰기는 기본적으로 꺼져 있으며** 4.4.0부터 에이전트도 포함됩니다. 4.3.1 값 파일이 `safety.allowWrites`를 설정한 적이 없다면, 운전원과 규칙이 하던 모든 쓰기는 설정할 때까지 업그레이드 후 거부됩니다. 의도된 동작이며, 다시 켜기 전에 무엇이 활성화되어 있는지 검토하라는 신호입니다.
- **로드되지 않는 시간대는 시작을 멈춥니다.** 엉터리 값으로 설정한 `HOTLOOP_TIMEZONE`이나 `TZ`는 예전에는 아무 말 없이 UTC로 동작했고, 이는 모든 보고서, 일정, 교대 전환을 조용히 몇 시간씩 어긋나게 합니다.
- **장치 자격 증명은 모든 역할에서 `[redacted]`로 읽힙니다.** 관리자도 포함입니다(4.15.1). 자리 표시자로 장치를 저장하면 저장된 비밀번호가 유지됩니다.
- **폴링 설정은 `HOTLOOP_POLL_INTERVAL`, `HOTLOOP_MIN_POLL_INTERVAL`, `HOTLOOP_POLL_TIMEOUT`입니다.** 이전 설정 화면은 `HOTLOOP_POLL_INTERVAL_MS`, `HOTLOOP_MIN_POLL_INTERVAL_MS`, `HOTLOOP_TIMEOUT_MS`를 설정하라고 했지만 이를 읽는 것은 없었습니다. 설정했다면 아무 효과가 없었습니다. 이름을 바꾸십시오.
- **가져온 OPC UA 태그는 가져올 때의 타입을 유지합니다.** 태그 검색은 예전에 모든 노드를 float로 처리했습니다. 이제는 각 노드의 실제 타입을 읽지만, 이전에 가져온 태그는 `float`를 유지하며, HotLoop 자체 OPC UA 서버는 태그를 선언된 타입으로 게시하므로 텍스트 태그는 Ignition에 `Bad_TypeMismatch`로 도착합니다. 텍스트 태그는 `string`으로 선언하십시오.
- **Edge 게시에 이제 값 블록이 있습니다.** `extraEnv`로 설정했다면 `edgePublish:`로 옮기고 변수를 지우십시오. 그렇지 않으면 두 번 설정됩니다.
- **OPC UA 서버는 제조사를 `HotLoop`이라고 밝힙니다.** 이전 버전은 다른 제조사 이름을 썼습니다. 클라이언트나 인벤토리 스크립트가 그 문자열로 일치를 검사한다면 일치하지 않게 되기 전에 바꾸십시오.
- **라이선스.** 4.3.1 이후 조건이 바뀌었습니다. 현재 조건은 [라이선스 페이지]({{LICENSE_URL}})에 있습니다.

### 4.3.1부터의 API 변경

API를 쓰는 스크립트나 통합이 있다면 이것이 목록입니다. 나머지는 모두 추가입니다. [위의](#api를-사용하는-스크립트가-알아챌-변화) 4.16.0에서 4.17.0까지의 변경이 그 위에 더해지고, [그 위의](#4170부터의-api-변경) 4.17.0에서 {{hotloop}}까지의 변경도 마찬가지입니다.

- **빈 목록은 `[]`이며 `null`이 아닙니다.** 모든 응답과 모든 스트림 이벤트에서, 어느 깊이에서든 그렇습니다. `GET /api/runs`, 자동화, 장치의 태그, 쓰기 감사, 사용자, 알람 이벤트, 스파크라인, 빈 이력 구간은 예전에 모두 `null`로 응답했습니다. 여전히 보이는 `null`은 목록이 아니라 문서화된 null 허용 필드이며, 엔티티의 `equipment_id`가 그렇습니다.
- **정상 측정값이 없는 `/api/history` 버킷은 `null`이며** 공백으로 그려지고, 불량 측정값은 추세 평균에서 제외됩니다. 같은 시간의 추세와 보고서가 이제 같은 내용을 말합니다.
- **API가 원인을 특정할 수 없는 오류는 400이 아니라 500이며** 서버 로그를 가리키는 참조가 붙습니다. 쓰기나 탐색에서 오류를 내는 장치는 502입니다. [쓰기 게이트](/ko/gateway/write-gate/#거부별-응답)에 쓰기가 받을 수 있는 모든 상태가 있습니다.
- **`alarm.turn_on`과 알람 엔티티가 받지 않는 다른 모든 서비스는 400입니다**("unknown service"). 예전에는 성공으로 응답하고 아무것도 하지 않았으며, 이는 가능한 최악의 응답입니다.
- **보류되지 않은 알람의 보류 해제는 409입니다.** 예전에는 알람이 어떤 상태든 정상으로 바꿔서, 해제되었지만 확인되지 않은 알람을 목록에서 지울 수 있었고, 이는 ISA-18.2가 목록에 남기려는 바로 그 알람입니다.
- **태그 JSON에는 항상 `minValue`, `maxValue`, `hasRange`가 있으며,** 범위가 있는지는 `hasRange`만으로 알 수 있습니다. 0에서 시작하는 범위는 예전에 최솟값이 없는 것처럼 보였습니다.
- **새 기능: `POST /api/services/{domain}/{service}`의 `?dry_run=true`.** 게이트의 점검을 실행하고, 아무것도 쓰지 않고 감사 기록도 남기지 않으며, 실제 호출이 줄 거부 응답을 돌려줍니다. `dry_run`은 `true`나 `false`만 받으며 `yes`는 400입니다. 잘못된 방향으로 추측하면 질문이 명령이 되기 때문입니다.
- **`GET /api/settings`는** 값이 실제로 어디서 왔는지를 `envVar`에 변수 이름으로 알려 주며 대체 변수도 포함하고, 빈 문자열로 설정된 변수는 설정되지 않은 것으로 칩니다.

[릴리스 노트](https://hotloop.io/releases/core/)에 4.4.0까지 버전별로 바뀐 나머지가 있습니다. 4.16.0에 올랐는데도 히스토리안이 여전히 차 있다면 [4.16.0에서 업그레이드](#4160에서-업그레이드)를 하고, 그다음 [4.17.0에서 업그레이드](#4170에서-업그레이드)를 하십시오.
