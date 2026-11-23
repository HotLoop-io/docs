---
title: "k3s와 Helm"
description: "k3s나 모든 Kubernetes에 HotLoop 차트를 배포하세요. 설정할 만한 값, 데이터베이스 선택, 업그레이드와 롤백, 정상 설치의 모습을 다룹니다."
---

차트는 두 가지 워크로드를 배포합니다. 게이트웨이(자체로는 지속 상태를 갖지 않는 Deployment)와 TimescaleDB(볼륨이 있는 StatefulSet)입니다. 이것이 기본값입니다. `database.type`으로 다른 데이터베이스를 고를 수 있습니다. 일반 PostgreSQL, 또는 두 번째 워크로드가 전혀 필요 없는 SQLite입니다([SQLite](#sqlite), 아래).

## 설치

EmberNet 대시보드의 App Store를 통하거나 직접 설치합니다.

```bash
helm install hotloop ./charts/hotloop \
  --namespace hotloop --create-namespace
```

또는 App Store가 가리키는 URL이기도 한 차트 저장소에서 설치합니다.

```bash
helm repo add hotloop https://hotloop.io/hotloop
helm install hotloop hotloop/hotloop \
  --namespace hotloop --create-namespace
```

이 두 번째 방식은 `hotloop`이라는 이름으로 처음 게시된 4.16.0부터 동작합니다. 그 이전 마지막 버전은 이전 이름의 `industrial-iot` 4.3.1이며, 거기서 올리는 일은 별도의 절차입니다. README의 4.16.0 노트에 있는 "Upgrading from 4.3.1"을 참조하세요. 이전 저장소 주소 `https://embernet-ai.github.io/industrial-iot/`는 404를 반환합니다.

기본 설치만으로 동작합니다. 차트는 데이터베이스 비밀번호와 MCP 토큰을 릴리스 Secret에 생성하고 업그레이드할 때 재사용하므로 아무것도 제공할 필요가 없고, 업그레이드가 실행 중인 데이터베이스 아래에서 비밀번호를 바꾸지도 않습니다.

접속에는 ingress도 서브도메인도 필요 없습니다. 대시보드가 스토어 레이블로 앱을 찾아 클러스터 내부 주소로 프록시합니다.

```
<release>.<namespace>.svc.cluster.local:8080
```

직접 확인하려면 다음과 같이 합니다.

```bash
kubectl -n hotloop port-forward svc/hotloop 8080:8080
```

## 설정할 만한 값

### 인증

4.4.0부터입니다. 전체 모델은 [인증과 사용자](/ko/iot/authentication/)를 참조하세요. 여기서는 차트 쪽을 다룹니다.

```yaml
auth:
  enabled: true    # the default; requires a login
  insecure: false  # set true only for a deployment truly isolated behind the
                    # dashboard's own NetworkPolicy -- see AUTH.md
```

`enabled: true`(기본값)이면 차트는 첫 설치 때 데이터베이스 비밀번호와 MCP 토큰을 만드는 것과 같은 방식으로 릴리스 Secret에 관리자 계정을 생성하고 업그레이드할 때 재사용합니다.

```bash
kubectl get secret hotloop -n hotloop \
  -o jsonpath='{.data.admin-password}' | base64 -d
```

`auth.admin.password`를 명시적으로 설정하면 생성된 값보다 우선합니다.

### 안전

이 파드가 기계를 움직일 수 있는지를 정하는 값들입니다.

```yaml
safety:
  allowWrites: false      # the master switch -- off by default since 4.4.0
  allowMcpWrites: true    # agents (MCP) write wherever an operator could, once writes are on
  confirmWrites: true     # the UI asks before writing
```

쓰기는 기본적으로 꺼져 있습니다. 태그는 자체 `writable` 플래그가 설정되기 전까지 읽기 전용이고, 태그에 설정된 범위를 벗어난 값은 거부되며(절대 잘라내지 않습니다. 누군가 500을 입력했는데 250을 보내는 것은 조용히 다른 일을 하는 것입니다), 모든 시도는 **모든 거부를 포함해** 주체와 출처와 함께 기록됩니다. 하지만 새 설치가 안전하기 위해 세 가지가 모두 맞아야 해서는 안 되므로, 마스터 스위치 자체가 닫힌 채로 시작합니다.

배포를 검토한 뒤 쓰기를 켜려면 다음과 같이 합니다.

```yaml
safety:
  allowWrites: true
```

이것으로 충분합니다. MCP 클라이언트는 운영자와 같이, 같은 권한과 쓰기 가능한 태그와 범위 아래에서 읽고 씁니다. `allowMcpWrites`는 모든 차트에 켜진 채로 제공됩니다. 다르게 결정하는 배포를 위해 존재할 뿐 어디에서도 기본값이 아닙니다.

### 히스토리안

```yaml
historian:
  retentionDays: 90     # 0 keeps everything until the volume fills
  useTimescale: true

logbook:
  retentionDays: 90     # entity state changes; 0 keeps everything (see LOGBOOK.md)

database:
  postgresql:
    persistence:
      size: 20Gi
      storageClass: longhorn
```

규모는 태그 수, 스캔 속도, 데드밴드로 정해집니다. 데드밴드 없이 1초마다 읽는 태그 1,000개는 하루 약 8,600만 행입니다. 같은 공장에 적절한 데드밴드를 두면 보통 한 자릿수 크기만큼 줄어듭니다. 스토리지를 사기 전에 데드밴드를 설정하세요.

`useTimescale: false`는 네이티브 파티셔닝 경로를 강제하며, 일반 PostgreSQL에서 실행할 때의 모습입니다. 엣지 배포를 재현하는 데 유용합니다.

**TimescaleDB 이미지가 바뀔 때.** 이미지는 모든 이전 버전의 라이브러리를 담고 있으므로, 이전 이미지로 만든 데이터베이스는 새 이미지에서 계속 실행되지만 확장 기능은 이전 버전으로 남고, 누군가 `ALTER EXTENSION timescaledb UPDATE`를 실행하기 전까지 그대로입니다. 게이트웨이는 시작할 때 이를 수행합니다. 설치된 버전과 서버가 제공하는 버전을 비교해 다르면 새 연결의 첫 문장으로 업데이트를 실행합니다(TimescaleDB는 이미 이전 버전을 로드한 세션에서는 이를 거부합니다). 로그에는 `timescaledb extension updated from=... to=...`가 나타납니다. 이를 위해서는 슈퍼유저가 필요하며, 번들 데이터베이스의 사용자가 그렇습니다. 그렇지 않은 외부 또는 관리형 데이터베이스에서는 실행할 명령이 담긴 경고가 나타나고, 그동안 히스토리는 이전 버전으로 계속 동작합니다. `useTimescale`이 켜져 있고 시작 시 마이그레이션이 실행될 때만 일어납니다(`HOTLOOP_DB_MIGRATE`, 기본값 켜짐).

### 폴링

```yaml
runtime:
  defaultPollIntervalMs: 1000
  minPollIntervalMs: 100      # a floor applied to every device
  timeoutMs: 10000
  maxConcurrentPolls: 32
```

`minPollIntervalMs`는 신뢰하는 것이 아니라 강제됩니다. 시리얼 게이트웨이에 대한 10 ms 폴링은 단계가 조금 더 붙은 서비스 거부입니다.

### OPC UA 클라이언트

```yaml
opcuaClient:
  persistence:
    enabled: true      # off by default
    size: 64Mi
```

보안이 설정된 OPC UA 서버에 연결하거나, 서버가 암호화를 요구하는 사용자 이름과 비밀번호로 로그인하는 장치는 인증서와 승인된 서버 인증서의 신뢰 저장소를 보관합니다(`HOTLOOP_OPCUA_CLIENT_PKI_DIR`, `/data/opcua-client-pki`). 이런 장치를 추가하기 전에 이것을 켜세요. 루트 파일시스템은 읽기 전용이므로 볼륨이 없으면 장치는 다음 재시작에 사라질 인증서로 연결하는 대신 그 사실을 알리는 오류를 보고합니다. 기존 설치에 PersistentVolumeClaim을 추가하고, 기본 StorageClass가 없는 클러스터에서는 Pending으로 남기 때문에 기본적으로 꺼져 있습니다. 보안되지 않은 채널의 익명 장치는 사용하지 않습니다. 서버 인증서 승인과 이 장치들에 관한 나머지 모든 내용은 [프로토콜과 드라이버](/ko/iot/protocols/#opc-ua-security-and-credentials)에 있습니다.

### 네트워킹

```yaml
networkPolicy:
  enabled: true
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: dashboard-system
      ports:
        - protocol: TCP
          port: 8080
```

대시보드의 네임스페이스를 알게 되면 ingress를 그곳으로 좁히세요. egress는 의도적으로 제한하지 않습니다. 이 앱은 미리 열거할 수 없는 주소의 장비에 닿기 위해 존재하며, 폴링을 조용히 막는 egress 정책은 방화벽 규칙이 아니라 고장 난 드라이버처럼 보입니다.

### 하드웨어: USB 무선 장치, 시리얼 어댑터, Bluetooth

4.19.7부터 모든 HotLoop 차트(Gateway, IoT, Edge, Edge Relay)는 하드웨어에 필요한 접근을 켠 채로 제공되므로, App Store나 helm의 기본 설치가 직접 편집 없이 파드 네트워크에서 노드에 연결된 것을 봅니다. `values.yaml`의 `hardware:` 블록이며, 기본으로 켜진 스위치 세 개와 기본으로 꺼진 선택 항목 하나가 있습니다.

| 값 | 기본값 | 하는 일 |
|---|---|---|
| `hardware.privileged` | `true` | 앱 컨테이너가 특권 모드(`privileged: true`, `allowPrivilegeEscalation: true`)와 root(`runAsUser: 0`, `runAsNonRoot: false`, capability 제거 없음)로 실행됩니다. USB 시리얼 노드가 `root:dialout 0660`이고 BlueZ의 D-Bus 정책이 root와 `bluetooth` 그룹을 들여보내므로 root입니다. 둘 중 어디에도 속하지 않는 컨테이너 사용자는 아무것도 열지 못합니다. 루트 파일시스템은 읽기 전용으로 유지되고, init 컨테이너와 번들 데이터베이스는 root가 아니고 모든 capability가 제거된 자체 컨텍스트를 유지합니다. |
| `hardware.usbDevices.enabled` | `true` | 노드의 `/dev`(`hardware.usbDevices.hostPath`)가 `/dev`에 마운트됩니다. 파드가 시작된 뒤에 꽂은 것을 포함해 USB 시리얼 어댑터(`/dev/ttyUSB*`, `/dev/ttyACM*`, `/dev/serial/by-id/*`)가 보입니다. 특권 컨테이너는 시작할 때 존재한 장치만 받으며, 다시 꽂은 장치가 나타나게 하는 것이 마운트입니다. |
| `hardware.bluetooth.enabled` | `true` | 노드의 D-Bus 디렉터리(`hardware.bluetooth.dbusPath`, `system_bus_socket`이 있는 `/run/dbus`)가 같은 경로에 마운트되어 클라이언트가 노드의 BlueZ에 닿습니다. D-Bus가 없는 노드에서는 빈 디렉터리로 만들어지므로 파드는 그곳에서도 시작됩니다. |
| `hardware.bluetooth.hostNetwork` | `false` | 노드의 네트워크가 필요한 경우를 위한, 기본으로 꺼진 선택 항목입니다. 커널 Bluetooth 소켓(HCI, L2CAP)은 노드의 네트워크 네임스페이스에만 있으므로 직접 여는 클라이언트와, 노드 자체의 네트워크에서 수신하는 검색(mDNS, SSDP, 무선 장치의 멀티캐스트)에 필요합니다. BlueZ의 D-Bus API를 쓰는 클라이언트는 마운트된 소켓만 있으면 되고 파드 네트워크에서 동작합니다. 켜면 파드가 [네트워킹](#네트워킹)에 설명된 결과와 함께 노드의 네트워크에서 실행됩니다. |

오늘 HotLoop이 이것으로 하는 일은 아직 없습니다. HotLoop에는 Bluetooth, Z-Wave, USB 시리얼용 자체 코드가 없습니다(Zigbee는 MQTT 위의 Zigbee2MQTT 브리지를 통해 들어옵니다. [내장 MQTT 브로커](/ko/iot/broker/) 참조). 기능이나 무선 장치를 읽는 사이드카가 필요로 할 접근을, 요청받기 전에 미리 갖춰 둔 것입니다.

그 대가는 의도적이고 결정된 것입니다. 파드는 노드에서 root이고(특권, 노드의 `/dev` 포함), 차트의 NetworkPolicy 기본값은 그것이 다루는 범위에 대해 켜진 채로 유지됩니다. 파드는 파드 네트워크에 남습니다. `--set hardware.privileged=false --set hardware.usbDevices.enabled=false --set hardware.bluetooth.enabled=false`로 어느 부분이든 끌 수 있으며, 셋 다 끄면 결과는 한 줄 한 줄 4.19.6이 렌더링한 파드(root 아님, 모든 capability 제거, 읽기 전용 루트, 파드 네트워크)와 같습니다. 노드의 네트워크가 필요한 경우에는 `hardware.bluetooth.hostNetwork=true`(또는 `hostNetwork=true`)를 설정하세요. 그러면 페이지가 노드의 모든 주소에서 `service.targetPort`로 응답하고, 노드당 포트당 HotLoop 하나만 가능하며, NetworkPolicy는 파드에 적용되지 않고, `nodeSelector`가 무선 장치를 봐야 하는 노드에 파드를 고정합니다.

### 엣지 배포

앱 이미지는 amd64와 arm64용으로 빌드되고 TimescaleDB 2.30.1-pg17은 멀티 아키텍처이므로, 엣지 설치를 막는 것은 히스토리안이 아닙니다.

```yaml
resources:
  requests: {cpu: 100m, memory: 128Mi}
  limits:   {cpu: 500m, memory: 256Mi}

database:
  postgresql:
    persistence: {size: 5Gi}
    resources:
      requests: {cpu: 100m, memory: 256Mi}
      limits:   {cpu: 500m, memory: 512Mi}

historian:
  retentionDays: 30

nodeSelector:
  kubernetes.io/arch: arm64
```

### Sparkplug로 상위에 게시

엣지 게이트웨이는 읽은 모든 것을 Sparkplug B 엣지 노드로서 중앙 게이트웨이에 게시할 수도 있습니다. 게시하는 내용과 전달 큐의 동작은 [엣지 게시와 저장 후 전달](/ko/edge/edge-publish/)을 참조하세요. 여기서는 차트 쪽을 다룹니다.

```yaml
edgePublish:
  enabled: true
  broker: tcp://central.example.local:1883
  group: Plant1
  node: press-line-3          # empty uses the release name
  username: press-line-3
  existingSecret: central-mqtt # key "password", or set secretKey
  tls: false
  queueMaxBytes: 536870912     # 512 MiB; the default is 64 MiB, and 0 is unbounded
  persistence:
    size: 1Gi
```

켜면 무엇이 바뀌는지, 그리고 이유입니다.

- **전달 큐를 위한 1Gi PVC**가 `/data/edge-publish`에 마운트됩니다. 업링크가 끊긴 동안 측정값이 쌓이는 곳이므로 파드보다 오래 남아야 합니다. `persistence.enabled: false`는 이를 emptyDir에 두며, 컨테이너 재시작에는 살아남지만 그 외에는 아닙니다.
- **Deployment는 `Recreate`로 롤링됩니다.** 큐는 잠금이 걸린 파일 하나입니다. 롤링 업데이트는 새 파드를 먼저 시작하고, 새 파드는 큐를 열 수 없어 준비 상태가 되지 못하며, 롤아웃은 영원히 멈춥니다. Recreate는 이전 파드를 먼저 멈춥니다. 업그레이드마다 몇 초의 폴링을 잃습니다.
- **`replicaCount`는 1이어야 하며**, 그렇지 않으면 차트가 렌더링을 거부합니다. 복제본 두 개는 하나의 Sparkplug 노드를 주장하는 게시자 두 개가 됩니다.
- **노드 id의 기본값은 릴리스 이름**이며 파드의 호스트 이름이 아닙니다. 호스트 이름은 롤아웃마다 바뀌므로 Sparkplug 호스트는 매번 완전히 새로운 엣지 노드를 보게 됩니다.

비밀번호는 평문 기본값에 들어가지 않습니다. 익명 브로커라면 `password`와 `existingSecret`을 비워 두면 Secret이 만들어지지 않습니다. `password`를 설정하면 차트가 `<release>-edge-publish`에 넣고, `existingSecret`을 설정하면 직접 관리하는 것을 사용합니다.

### 외부 데이터베이스

```yaml
database:
  postgresql:
    enabled: false
    auth:
      existingSecret: my-db-credentials
      secretKey: password
  external:
    host: timescale.plant.local
    port: 5432
    database: industrial
    username: industrial
  sslMode: require
```

앱은 TimescaleDB를 감지하고 확장이 있으면 `tag_history`를 하이퍼테이블로 승격합니다. 일반 PostgreSQL에서는 실패하는 대신 네이티브 범위 파티셔닝으로 대체합니다.

이 결정은 기록되며 **고정**됩니다. 하이퍼테이블로 만든 데이터베이스는 확장이 없는 서버에 대해서는 조용히 다른 곳에 쓰는 대신 시작을 거부합니다. 이 오류가 보이면 앱이 만들어진 것과 다른 데이터베이스를 가리키고 있는 것입니다.

### SQLite

데이터베이스는 이미지가 아니라 설정입니다. 모든 제품은 같은 바이너리로 SQLite, Postgres, TimescaleDB에서 실행됩니다(IoT는 TimescaleDB를 건너뜁니다. 아래 참조).

| 변수 | 기본값 | 하는 일 |
|---|---|---|
| `HOTLOOP_DB_TYPE` | `postgres` | `postgres` 또는 `sqlite`. TimescaleDB는 서버에 확장이 있는 `postgres`입니다 |
| `HOTLOOP_DB_PATH` | `/data/hotloop.db` | SQLite 파일입니다. SQLite만 읽습니다 |

SQLite는 순수 Go 버전(`modernc.org/sqlite`)이며 모든 이미지에 컴파일되어 있으므로 두 번째 컨테이너도, SD 카드 위의 300 MB Postgres 이미지도 없고, arm 빌드는 정적으로 유지됩니다. 파일은 컨테이너보다 오래 남는 볼륨에 두고, Pi에서는 그 볼륨을 USB SSD에 두세요. 히스토리안이 하루 종일 SD 카드에 쓰는 것은 SD 카드를 많이 사게 되는 방법입니다.

같은 점: 모든 테이블, 모든 열, 모든 기능. 다른 점:

- 히스토리는 파티션이나 하이퍼테이블이 아니라 인덱스가 있는 테이블 하나이며, 보존 정책은 달 단위로 버리는 대신 오래된 행을 삭제합니다. 1초 간격으로 수년간의 이력을 쌓는 현장은 Postgres나 TimescaleDB가 필요하며, 거기로 옮기는 일은 백업과 복원입니다(BACKUP.md).
- 한 번에 쓰는 쪽은 하나입니다. SQLite는 쓰기를 번갈아 처리하고 그 옆에서 읽습니다(WAL). HotLoop 하나와 같은 파일을 쓰는 `--mcp-stdio` 헬퍼 하나에는 충분합니다. 네트워크 스토리지 위의 복제본 둘을 위한 것이 아닙니다. NFS 위의 SQLite는 손상되므로 SQLite 배포는 로컬 볼륨이 있는 파드 하나입니다.
- 커밋은 `synchronous=FULL`입니다. API가 저장했다고 하면 정전이 나도 디스크에 있습니다.

**HotLoop IoT**는 기본적으로 30일의 이력을 두며(`HOTLOOP_HISTORIAN_RETENTION_DAYS`가 설정되면 여전히 그것이 우선합니다) 하이퍼테이블을 만들지 않습니다. TimescaleDB는 Edge와 Gateway의 일부입니다. IoT에 `HOTLOOP_HISTORIAN_TIMESCALE=true`를 설정하면 시작할 때 그렇다고 알리고 일반 파티션으로 실행됩니다. Edge나 Gateway에서 내려온, 이미 하이퍼테이블이 있는 데이터베이스는 그것을 유지하고 계속 동작합니다.

#### 차트에서 데이터베이스 고르기

값은 `database.type` 하나이고, 각 제품은 자신이 실행되는 값만 받습니다.

| `database.type` | 배포되는 것 | IoT | Edge | Gateway |
|---|---|---|---|---|
| `timescaledb` | 앱과 TimescaleDB(StatefulSet과 볼륨). 이력은 하이퍼테이블 | 거부 | 기본 | 기본 |
| `postgresql` | 앱과 일반 PostgreSQL 17(StatefulSet과 볼륨). 이력은 네이티브 파티션 | 기본 | 예 | 예 |
| `sqlite` | 앱만, 데이터베이스 파일은 자체 볼륨에 | 예 | 예 | 예 |

```bash
helm install hotloop hotloop/hotloop-iot --namespace hotloop --create-namespace   --set database.type=sqlite
```

IoT에 `timescaledb`를 요청하면 설치가 실패하고 IoT가 무엇으로 실행되는지 알려 주며(`database.type is "timescaledb", and HotLoop IoT runs on sqlite, postgresql`), App Store의 양식은 이를 제공하지 않습니다. `helm lint`는 이를 잡지 못하므로(helm 3.22는 깨끗하다고 판정합니다) 렌더링이 거부합니다. `database.type`을 생략하면 제품 자체의 기본값이 되므로, 키가 생기기 전 버전에서 `--reuse-values`로 올리면 원래 쓰던 데이터베이스가 유지됩니다.

`sqlite`는 다음을 렌더링합니다.

- `HOTLOOP_DB_TYPE=sqlite`와 `HOTLOOP_DB_PATH=/data/db/hotloop.db`, 그리고 Postgres 연결 설정은 하나도 없습니다. 데이터베이스 파드도, Secret의 데이터베이스 비밀번호도, 그것을 기다리는 init 컨테이너도 없습니다.
- `<release>-db`라는 PersistentVolumeClaim(`database.sqlite.persistence`: `size`, `storageClass`, `accessMode`, 처음에는 10Gi와 클러스터 기본값)이 `/data/db`에 마운트됩니다. 파일이 아니라 디렉터리입니다. SQLite는 데이터베이스 옆에 `-wal`과 `-shm`을 둡니다. 로컬 스토리지에 두세요. NFS 위의 SQLite는 손상됩니다.
- 볼륨이 `ReadWriteOnce`이고 파일의 쓰기 주체가 하나이므로 롤링 업데이트가 아니라 `Recreate`인 Deployment. `replicaCount`가 1을 넘으면 설치가 실패합니다.

NetworkPolicy는 바뀌지 않고 켜져 있습니다. 앱 자체의 정책은 여전히 적용되고, 데이터베이스 정책은 보호할 데이터베이스 파드가 있을 때만 렌더링됩니다.

이미 데이터가 있는 릴리스에서 `database.type`을 바꿔도 데이터는 옮겨지지 않습니다. 새 데이터베이스는 비어 있는 상태로 시작하므로, 공장을 한 데이터베이스에서 다른 데이터베이스로 옮기는 일은 변수를 쓸 때와 마찬가지로 백업과 복원입니다(BACKUP.md). 특히 TimescaleDB 하이퍼테이블로 만든 데이터베이스는 일반 PostgreSQL에서 시작을 거부하므로, 기존 Edge나 Gateway를 `timescaledb`에서 `postgresql`로 바꾸고 올라오기를 기대하지 마세요.

#### Quadlet에서 데이터베이스 고르기

`deploy/quadlet/` 아래 각 제품의 디렉터리에는 기존 PostgreSQL 또는 TimescaleDB 파일과 그 옆의 `sqlite/` 디렉터리가 있습니다. `hotloop.container`와 `hotloop-data.volume`이며, 앱만 있고 파일은 `hotloop-data` 볼륨의 `/data/hotloop.db`에 있습니다. `:stable`을 따르고 잘못된 업데이트를 같은 방식으로 롤백합니다. 다른 파일 대신 이 두 파일을 설치하고(같은 유닛 이름을 씁니다), 시크릿은 세 개가 아니라 두 개를 만드세요. 데이터베이스 비밀번호가 없습니다. 단계는 [`deploy/quadlet/README.md`](/ko/install/quadlet/)에 있습니다.

Quadlet에서 Edge나 Gateway에 일반 Postgres 파티션을 쓰려면 TimescaleDB 유닛을 유지하고 `hotloop.container`에 `Environment=HOTLOOP_HISTORIAN_TIMESCALE=false`를 추가하세요. IoT의 유닛은 이미 일반 PostgreSQL을 실행합니다.

### 장치 자격 증명 키

```yaml
secretKey:
  enabled: true
  existingSecret: ""     # or a Secret you manage, with the key under secret.key
```

장치 비밀번호(UniFi 콘솔 로그인, OPC UA나 MQTT 비밀번호, HTTP API 키)는 이 키로 데이터베이스에서 암호화되므로 덤프나 백업에는 암호문이 들어 있습니다. 기본적으로 차트는 첫 설치 때 `<release>-secret-key`에 키를 생성하고, 업그레이드 때도 유지하며, `helm uninstall`에서도 유지합니다(`helm.sh/resource-policy: keep`). 볼륨에 남은 데이터베이스는 키 없이는 자격 증명에 쓸모가 없기 때문입니다. 파일로 마운트되어 `HOTLOOP_SECRET_KEY_FILE`로 전달되며, 환경 변수로는 전달되지 않습니다.

Secret은 데이터베이스 백업과 따로 백업하세요. 보호하는 백업 옆에 있는 키는 아무것도 보호하지 못합니다. 직접 가져오려면 `hotloop gen-secret-key`가 하나를 출력합니다. Kubernetes 밖에서는 HotLoop만 읽을 수 있는 파일에 쓰고 `HOTLOOP_SECRET_KEY_FILE`이 그것을 가리키게 하세요. 키가 없어도 HotLoop은 실행되며, 시작 로그에 장치 비밀번호가 입력한 그대로 저장된다고 알리고 UniFi 콘솔 저장을 거부합니다. 이미 저장된 자격 증명은 키와 함께 처음 시작할 때 암호화됩니다. 복원에 어떤 의미인지는 [백업과 복원](/ko/iot/backup/#장치-자격-증명과-비밀-키)을 참조하세요.

## 구성, 그리고 설정 화면이 바꿀 수 있는 것

거의 모든 설정은 차트가 Helm 값으로 설정하는 환경 변수에서 옵니다. 그것이 맞는 자리입니다. 이 프로세스가 기계를 명령할 수 있는지를 정하는 구성은 웹 페이지의 양식이 아니라 검토를 거친 배포에 속합니다.

**설정** 화면은 모든 설정, 각각의 유효 값, 그것이 데이터베이스, 환경 변수, 내장 기본값 중 어디서 왔는지, 그리고 그것을 바꾸는 변수를 보여 줍니다. 대부분은 읽기 전용이며, 그것이 요점입니다. 이 화면이 답하는 질문은 "왜 이렇게 동작하며 무엇을 바꿔야 하는가"입니다.

네 가지 설정은 동작이 아니라 공장의 신원이며 그곳에서 편집할 수 있습니다. 데이터베이스에 저장되고 즉시 적용됩니다. 공장 이름은 다시 배포하는 것보다 훨씬 자주 바뀌기 때문입니다.

| 설정 | 덮어쓰는 변수 |
|---|---|
| 공장 이름 | `HOTLOOP_PLANT_NAME` |
| 사이트 ID | `HOTLOOP_SITE_ID` |
| 시간대 | `HOTLOOP_TIMEZONE` |
| 쓰기 전 확인 | `HOTLOOP_CONFIRM_WRITES` |

설정 아래에는 구성이 아니라 데이터인 카드가 있으며, 같은 이유로 편집할 수 있습니다. **사용자**([인증과 사용자](/ko/iot/authentication/)), 아무도 알람을 확인하지 않을 때 누구에게 다음으로 알릴지와 시기를 정하는 **알람 에스컬레이션**([알람 알림](/ko/iot/notifications/#에스컬레이션)), 히스토리안 대상과 MQTT 로그인입니다. 에스컬레이션이 쓸 수 있는 채널은 여전히 배포의 것이며 `HOTLOOP_NOTIFY_*`로 설정합니다.

저장된 값이 환경 변수보다 우선하므로 차트의 값은 마지막 결정이 아니라 출발점이 됩니다. 장비가 해석할 수 없는 시간대는 받아들여졌다가 조용히 무시되는 대신 거부되는데, 그렇지 않으면 모든 타임스탬프가 이유도 알리지 않은 채 UTC로 돌아가게 됩니다.

배포 자체의 값도 마찬가지입니다. `HOTLOOP_TIMEZONE`(또는 그것이 설정되지 않았을 때 `TZ`)이 로드되지 않는 시간대를 가리키면 HotLoop은 시작을 거부하고 오류에 변수와 값이 나옵니다. 예전에는 어깨를 으쓱하고 UTC로 실행했습니다. 보고서, 일정, 교대 시간은 모두 공장의 시계로 돌아가며, 몇 시간씩 틀린 추측은 왜 올라오지 않는지 알려 주는 파드보다 나쁩니다.

사이트의 위치는 `HOTLOOP_SITE_LATITUDE`와 `HOTLOOP_SITE_LONGITUDE`(차트: `plant.latitude`, `plant.longitude`)이며, 십진 도, 북쪽과 동쪽이 양수입니다. 일출, 일몰, 태양 엔터티와 트리거는 이 값에서 장비 위에서 계산됩니다([태양](/ko/iot/sun/)). 둘 다 설정하거나 둘 다 설정하지 않아야 하며, 잘못된 값은 변수를 알리며 시작을 멈춥니다. 설정 화면은 이를 읽기 전용으로 보여 줍니다. 규칙은 일출에 발동하므로 이를 옮기는 것은 배포입니다.

**안전 스위치는 편집할 수 없으며 앞으로도 그렇습니다.** `HOTLOOP_ALLOW_WRITES`는 이 프로세스가 장비를 명령할 수 있는지에 대한 마스터 제어이며, 쓰기를 내보내는 같은 브라우저 세션에서 다시 켤 수 있는 제어는 제어가 아닙니다. `HOTLOOP_HISTORIAN_RETENTION_DAYS`도 마찬가지로 배포 전용입니다. 보존 정책은 시작할 때 데이터베이스에 적용되므로 화면의 필드는 동작하는 것처럼 보이면서 어떤 데이터도 옮기지 않을 것입니다. 엔드포인트는 편집 가능한 집합 밖의 모든 키를 무시하는 대신 **이름으로** 거부합니다.

한 가지 제한이 있으며, 화면도 이를 알리므로 적어 둡니다. MCP 서버는 시작할 때 지침을 만들기 때문에 파드가 재시작될 때까지 시작 당시의 공장 이름을 알립니다. 그 밖의 모든 것은 이름 변경을 다음 요청에서 반영합니다.

## PostgreSQL 17

HotLoop의 데이터베이스는 PostgreSQL 17입니다(Edge와 Gateway는 그 위에 TimescaleDB 2.30.1, IoT와 `database.type: postgresql`은 일반 PostgreSQL 17.11). 이전 릴리스는 PostgreSQL 16을 실행했고, PostgreSQL은 다른 주 버전의 데이터 디렉터리를 열지 않습니다. 그래서 이동은 업그레이드 때 대신 이루어지며 실행할 것은 없습니다.

**차트에서는** 데이터베이스 파드에 init 컨테이너 두 개가 붙습니다. 첫 번째는 PostgreSQL 16 이미지를 실행하고, 볼륨에 16 데이터가 있을 때만 그 설치를 임시 볼륨에 복사합니다. 두 번째는 새 이미지를 실행하고 옛 디렉터리 옆의 새 디렉터리로 `pg_upgrade`합니다. 둘 다 새 볼륨이나 이미 17인 볼륨은 건드리지 않습니다. 업그레이드는 `helm upgrade`일 뿐 다른 것은 없습니다. 데이터 복사에 걸리는 시간만큼 데이터베이스 파드가 `Init`에 머물고 앱이 그것을 기다릴 것으로 예상하세요. `kubectl logs <release>-postgresql-0 -c pg-upgrade`가 그 로그입니다.

**Quadlet에서는** `hotloop-db-upgrade.container`가 `hotloop-db.service` 앞에서 실행되어 oneshot 유닛으로 같은 일을 합니다. 제품 디렉터리의 새 `hotloop-db.container`, `hotloop-db-upgrade.container`, `hotloop-db-upgrade.sh`를 유닛 디렉터리에 복사하고 데이터베이스 유닛을 재시작하세요. 명령은 [Quadlet README](/ko/install/quadlet/)에 있습니다. 데이터베이스 유닛은 업그레이드 유닛을 요구하므로 새 데이터베이스 유닛만 받은 장비는 16 데이터에서 시작하지 않고 이유를 알립니다. 추측하지 않고 실패합니다. `journalctl -u hotloop-db-upgrade`가 그 로그입니다. 이 유닛은 볼륨에 16 데이터가 있을 때만 실행됩니다. 새 장비와 업그레이드 이후의 모든 시작에서 systemd는 이를 건너뛰며(실패가 아니라 비활성으로 표시됩니다) PostgreSQL 16 이미지는 가져오지 않습니다. 볼륨에 16 데이터가 있으면 유닛이 먼저 그 이미지를 가져옵니다.

수행하는 일을 순서대로 보면, 모두 `hotloop-pg-upgrade.sh`(차트와 유닛이 실행하는 같은 파일 하나)에 있습니다.

1. 데이터 디렉터리가 없거나 이미 17이면 아무것도 하지 않고 그렇다고 알립니다. 그 밖의 주 버전은 아무것도 바꾸지 않고 거부됩니다.
2. 옛 서버를 비공개 소켓에서 한 번 시작하고 깔끔하게 멈추며, 이는 정전 뒤의 로그를 재생하고 새 클러스터가 맞춰야 할 인코딩과 로케일을 읽습니다.
3. 그 설정으로 옛 디렉터리 옆에 새 디렉터리를 `initdb`하고, 복사 모드(옛 디렉터리는 읽기만 합니다)로 `pg_upgrade`를 실행하고, `postgresql.conf`, `postgresql.auto.conf`, `pg_hba.conf`, `pg_ident.conf`를 옮깁니다.
4. 새 서버를 한 번 시작해 최종 설정으로 열리는지 증명하고 `pg_upgrade`가 옮기지 않는 플래너 통계를 수집합니다.
5. 그런 다음에야 이름을 바꿉니다. 옛 디렉터리는 `pgdata.pg16`, 새 디렉터리는 `pgdata`가 됩니다.

데이터 옆에 데이터가 차지하는 만큼의 여유 공간이 필요하며 시작 전에 확인합니다. 5단계 전에 무언가 실패하면 업그레이드는 0이 아닌 값으로 종료되고, 16 데이터는 그대로이며, 데이터베이스는 반쯤 만들어진 디렉터리에서 시작하지 않습니다. 차트에서는 파드가 `Init:Error`에 머물고, Quadlet에서는 업그레이드 유닛이 실패해 그 뒤의 데이터베이스 유닛은 시작하지 않습니다. 로그가 말하는 문제를 고치고 다시 시작하세요. 끝나지 않은 시도는 제거되고 다시 수행됩니다. TimescaleDB 확장은 있던 버전 그대로 넘어오고, 앱이 다음 시작 때 항상 그랬듯이 제공된 버전으로 업데이트합니다. PostgreSQL 제자리 업그레이드에 대한 TimescaleDB 자체의 안내는 이전과 새 바이너리를 쓰는 `pg_upgrade`입니다([Tiger Data, "Upgrade PostgreSQL"](https://www.tigerdata.com/docs/deploy/self-hosted/upgrades/upgrade-pg)).

백업은 옛 디렉터리 그 자체입니다. 복사 모드의 `pg_upgrade`는 그곳에 쓰지 않으므로 `pgdata.pg16`은 그때 그대로의 PostgreSQL 16 데이터베이스 전체이며, 덤프보다 나은 백업이고 아래의 되돌리는 길을 가능하게 하는 유일한 것입니다. HotLoop 자체의 백업([백업과 복원](/ko/iot/backup/))은 실행 중인 앱이 실행 중인 데이터베이스를 통해 만들므로 데이터베이스가 시작되기 전에 실행되는 단계에서는 만들 수 없습니다. 그래도 업그레이드 전에 옛 릴리스에서 하나 만들고 장비 밖으로 복사하세요.

### 되돌리기

`helm rollback`이나 이전 `hotloop-db.container`를 되돌려 놓는 것은 데이터베이스를 PostgreSQL 16 이미지로 되돌립니다(Podman의 자동 업데이트는 그렇지 않습니다. 앱만 움직입니다). 그리고 PostgreSQL 16은 17 디렉터리를 열지 못합니다(`database files are incompatible with server`, 로그에는 디렉터리가 버전 16으로 초기화되었다고 나옵니다). 잃는 것도 반쯤 바뀐 것도 없습니다. 데이터베이스가 시작하지 않을 뿐입니다. 이전 릴리스에 필요한 것은 자체 16 디렉터리이며 그것이 `pgdata.pg16`입니다. 데이터베이스를 멈추고 이름을 되돌려 놓으세요.

```sh
# chart: after the rollback, stop the database, swap in a one-off pod, start it
kubectl -n hotloop scale statefulset/hotloop-postgresql --replicas=0
kubectl -n hotloop run pgswap --rm -it --restart=Never --image=busybox \
  --overrides='{"spec":{"securityContext":{"runAsUser":999,"fsGroup":999},"containers":[{"name":"pgswap","image":"busybox","command":["sh","-c","cd /d && mv pgdata pgdata.pg17 && mv pgdata.pg16 pgdata"],"volumeMounts":[{"name":"d","mountPath":"/d"}]}],"volumes":[{"name":"d","persistentVolumeClaim":{"claimName":"data-hotloop-postgresql-0"}}]}}'
kubectl -n hotloop scale statefulset/hotloop-postgresql --replicas=1

# Quadlet: the volume is named hotloop-db
sudo systemctl stop hotloop.service hotloop-db.service
d=$(sudo podman volume inspect hotloop-db --format '{{.Mountpoint}}')
sudo mv "$d/pgdata" "$d/pgdata.pg17" && sudo mv "$d/pgdata.pg16" "$d/pgdata"
```

이것은 업그레이드 시점의 데이터베이스이며 그 이후에 쓴 것은 없습니다. 되돌려 놓기는 한 번만 동작합니다. 업그레이드는 `pgdata.pg16`이 길을 막고 있는 동안 실행을 거부하므로, 다음 업그레이드 시도에는 먼저 `pgdata.pg17`과 옛 디렉터리 처리가 필요합니다. 앞으로 가는 것이 길이고, 롤백은 17을 아예 실행할 수 없는 장비를 위한 것입니다. 앱 자체의 롤백 규칙은 바뀌지 않았습니다. 16 디렉터리의 스키마는 업그레이드 전 릴리스가 남긴 것이며, 모르는 마이그레이션을 발견한 릴리스는 그렇다고 알립니다. [마이그레이션은 추가만 합니다](/ko/iot/migrations/)를 참조하세요.

### 만족했을 때

`pgdata.pg16`은 삭제할 때까지 남습니다. 삭제하는 것은 되돌아갈 유일한 길을 삭제하는 것이기 때문입니다. 크기는 데이터베이스만큼입니다. 장비를 원하는 만큼 17에서 실행했다면:

```sh
# chart
kubectl -n hotloop exec hotloop-postgresql-0 -c postgresql -- rm -rf /var/lib/postgresql/data/pgdata.pg16
# Quadlet
sudo rm -rf "$(sudo podman volume inspect hotloop-db --format '{{.Mountpoint}}')/pgdata.pg16"
```

### 끄기

`database.postgresql.upgrade.enabled: false`는 init 컨테이너를 없앱니다. 그러면 아직 16인 볼륨이 데이터베이스 시작을 막고 이동은 직접 해야 합니다. 켜 두세요. 켜 두면 init 컨테이너의 이미지는 실행 전에 가져오므로 새 설치도 노드당 한 번 PostgreSQL 16 이미지를 가져오지만, 그것을 실행하지는 않습니다.

## 3.x에서 업그레이드

**이것은 업그레이드가 아니라 교체입니다.** 3.x는 다른 제품이었습니다. 태그 히스토리안과 데이터 모델을 공유하지 않으므로 그 데이터의 이전 경로는 없습니다.

```bash
helm uninstall hotloop -n hotloop
# keep or delete the old PVCs deliberately, they hold the HA recorder database
helm install hotloop ./charts/hotloop -n hotloop
```

더 이상 존재하지 않으며 설정하면 거부되는 것: `sidecarProxy`, `homeassistant`, `mqtt`/`nodered`/`esphome`/`zigbee2mqtt` 애드온, `devices`, `cameras`, `customConfig`, `network.hostNetwork`.

## 업데이트 롤백

`helm rollback hotloop -n hotloop`은 이전 릴리스의 이미지를 되돌려 놓습니다. 데이터베이스는 되돌리지 않습니다. 릴리스는 시작할 때 마이그레이션하고 그것은 이미 끝난 일로 남습니다. 규칙과 점검은 [마이그레이션은 추가만 합니다](/ko/iot/migrations/)에 있습니다.

PostgreSQL 17 릴리스를 가로지르는 롤백이 되돌려 놓는 단 하나는 데이터베이스 엔진입니다. 차트의 데이터베이스 이미지가 16으로 돌아가며, 업그레이드된 디렉터리를 열지 못합니다. [되돌리기](#되돌리기)가 그 출구입니다.

한 릴리스 전까지는 안전합니다. 데이터베이스는 각 마이그레이션을 어느 릴리스가 적용했는지 기록하며, 자신보다 두 릴리스 이상 새로운 릴리스의 마이그레이션을 발견한 릴리스는 시작을 거부합니다.

```
refusing to start: this database's schema is more than one release ahead of
HotLoop 4.18.10. ...
```

이것은 우회해야 할 결함이 아닙니다. 데이터베이스가 이 릴리스가 실행해 본 적 있는 곳보다 더 앞으로 갔다는 뜻입니다. 스키마를 아는 릴리스, 즉 가장 새로운 릴리스로 앞으로 가거나, 현재 릴리스가 만든 백업을 복원하세요([백업과 복원](/ko/iot/backup/)). 정확히 한 릴리스 전은 두 버전을 알리는 경고가 로그에 남으며 시작됩니다. 업그레이드 전에 백업하세요. 롤백은 새 릴리스가 쓴 데이터를 되돌릴 수 없습니다.

## 설치 확인

```bash
kubectl -n hotloop get pods
kubectl -n hotloop logs deploy/hotloop | head -20
```

정상 시작은 사용하는 프로토콜을 알리고, 마이그레이션을 적용하고, 히스토리 모드를 보고하고, 알아 둘 만한 것을 경고합니다.

```
msg=starting version=4.0.0 protocols="[ethernet-ip http modbus mqtt mtconnect opcua s7comm]"
msg="writes are ENABLED: the UI, API, automations and MCP can all command devices"
msg="tag_history promoted to a hypertable" timescale=2.30.1
msg="history schema ready" mode=timescale
msg=listening addr=:8080 mcp=/mcp writes=true
```

그런 다음 대시보드에 필요한 레이블을 확인하세요. 이것이 편차를 잡아내는 점검입니다. 개수가 아니라 **집합**을 검증하세요. 집합이 틀려도 개수 점검은 통과하기 때문입니다.

```bash
kubectl -n hotloop get svc <release> -o json \
  | jq -r '.metadata.labels | keys[] | select(startswith("embernet.ai/"))'
```

Service와 파드에 정확히 네 개입니다.

```
embernet.ai/app-name
embernet.ai/gui-port
embernet.ai/gui-type
embernet.ai/store-app
```

앱이 실행 중인데 실행 중인 앱에 보이지 않으면 Service 레이블이 가장 먼저 볼 곳입니다. 대시보드는 `embernet.ai/store-app`으로 Service를 조회합니다.

App Store 배포는 대시보드가 전달하는 `tenantLabels`에서 다섯 개를 더 추가합니다. `embernet.ai/tenant`, `app-id`, `source`, `deployed-by`, `deployment-id`입니다. 이는 차트가 렌더링하는 모든 리소스와 게이트웨이 파드에 붙습니다. 대시보드는 테넌트를 Service에서만 읽으므로, Service에 `embernet.ai/tenant`가 없는 스토어 배포 Gateway는 누구의 것도 아닙니다. 일반 `helm install`은 다섯 개 중 어느 것도 렌더링하지 않습니다.

## 프로브

- `/healthz`, liveness. 프로세스가 살아 있는 동안 응답합니다.
- `/readyz`, readiness. 추가로 데이터베이스가 필요하므로, 히스토리안을 잃은 파드는 아무것도 답하지 못하는 UI를 제공하는 대신 트래픽 수신을 멈춥니다.

스타트업 프로브는 2분을 허용합니다. 첫 설치는 마이그레이션을 실행하며, liveness 프로브가 마이그레이션 도중에 이를 죽이면 안 되기 때문입니다.

## 종료

`terminationGracePeriodSeconds: 45`. SIGTERM을 받으면 앱은 요청 수락을 멈추고 히스토리안 큐를 비워, 이미 읽은 측정값이 버려지지 않고 기록되게 합니다. 유예 시간을 너무 짧게 자르면 진행 중이던 것을 잃습니다.

## 문제 해결

**장치가 `connecting`에 머뭅니다.** 장치 카드의 `lastError`를 보세요. 대개 파드와 장비 사이의 방화벽이거나 잘못된 포트입니다. 차트는 egress를 제한하지 않으므로, 이를 막는 NetworkPolicy는 클러스터의 다른 무언가입니다.

**태그의 품질이 나쁨으로 읽힙니다.** 장치는 응답했지만 해당 포인트는 응답하지 않았습니다. Modbus라면 주소 기준을 확인하세요. 도면이 40001 번호 체계를 쓴다면 `oneBased`입니다. OPC UA라면 노드 id가 해석되었는지 확인하고 `nsu=` 형식을 선호하세요.

**값이 그럴듯해 보이지만 틀렸습니다.** Modbus에서는 워드 순서입니다. `CDAB`를 시도하세요. 숫자가 분명히 틀려 보이지 않으므로 스스로 드러나지 않는 장애입니다.

**아무것도 히스토리에 기록되지 않습니다.** 프로토콜 화면의 진단을 확인하세요. `filtered`는 데드밴드가 억제한 측정값을 세며 의도대로 동작하는 것입니다. `dropped`는 데이터베이스가 따라가지 못해 잃은 측정값을 세며 그렇지 않습니다.

**MCP가 401을 반환합니다.** 베어러 토큰입니다. 릴리스 Secret에서 읽으세요.

**모든 `/api/` 요청이 401을 반환합니다.** `auth.enabled`가 true이고 아직 아무도 로그인하지 않았다면 예상된 동작이며 4.4.0의 요점입니다. 릴리스 Secret에서 생성된 관리자 비밀번호를 읽고([인증](#인증) 참조) UI로 로그인하거나 `POST /api/auth/login`을 직접 호출하세요. [인증과 사용자](/ko/iot/authentication/)를 참조하세요.

**관리자 비밀번호를 잃었고 다른 관리자 계정이 없습니다.** 새 해시를 생성해 Secret을 패치한 다음 파드를 재시작해 환경을 다시 읽게 하세요. `EnsureAdminUser`는 이미 있는 계정을 건드리지 않으므로, 이는 차트를 거치지 않고 행을 직접 교체합니다.

```bash
hotloop hash-password -password 'a-new-one'
kubectl exec -n hotloop deploy/hotloop -- \
  psql "$DATABASE_URL" -c \
  "UPDATE users SET password_hash = '<the hash>' WHERE username = 'admin'"
```

**자동화가 활성화되어 있지만 실행되지 않습니다.** 컴파일에 실패했습니다. 자동화 화면이 이유와 함께 NOT ARMED로 표시하고, 시스템 로그에 오류가 있습니다.
