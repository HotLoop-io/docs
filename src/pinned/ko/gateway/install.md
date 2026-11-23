---
title: "Gateway {{hotloop}} Helm 설치"
description: "게시된 Helm 차트로 k3s 또는 모든 Kubernetes에 HotLoop Gateway {{hotloop}}를 설치하고, 로그인한 뒤 실제 공장에 보이기 전에 꼭 필요한 값을 설정합니다."
sidebar:
  label: "설치"
---

HotLoop Gateway {{hotloop}}는 amd64와 arm64용 컨테이너 이미지(amd64에서 약 37MB, arm64에서 약 35MB)와 Helm 차트로 제공됩니다. 둘 다 로그인 없이 받을 수 있습니다. 4.17.0까지 사용하던 이름, 이미지 `ghcr.io/hotloop-io/hotloop`와 차트 `hotloop`를 그대로 유지하므로 이미 운영 중인 분은 아무것도 바꿀 필요가 없습니다. 이전 릴리스가 이미 실행 중인가요? 그 위에 설치하지 마세요. [업그레이드](/ko/gateway/upgrading/)에 4.17.0에서 올라가는 길(단순한 `helm upgrade`)과 4.16.0 및 4.3.1에서 단계별로 올라가는 길이 있습니다.

실제로 운영하는 방법은 두 가지입니다. k3s를 포함한 모든 Kubernetes에서 쓰는 Helm 차트, 그리고 클러스터가 없는 박스에서 쓰는 Podman Quadlet(아래)입니다. Docker나 Compose 경로는 일부러 없으며, 세션과 함께 사라지는 셸에서 실행한 단순한 `podman run`은 설치가 아닙니다.

## Helm

```bash
helm repo add hotloop https://hotloop.io/hotloop
helm repo update
helm install hotloop hotloop/hotloop --version {{hotloop}} \
  --namespace hotloop --create-namespace
```

이렇게 하면 Gateway와 함께 20 Gi 볼륨의 TimescaleDB 2.30.1이 옆에 배포되고 90일치 이력을 보관합니다. 데이터베이스는 설정 `database.type`으로 정합니다. `timescaledb`가 기본값이고, `postgresql`은 일반 PostgreSQL 17을, `sqlite`는 데이터베이스 파드 없이 파일 하나로 Gateway를 실행하며 복제본 하나와 로컬 스토리지만 쓰고 NFS는 절대 쓰지 않습니다. 나중에 서로 바꾸는 것은 백업과 복원입니다. 새 데이터베이스는 비어 있는 상태로 시작하기 때문입니다. 이미 PostgreSQL 16 데이터가 있는 박스는 아무것도 하지 않아도 다음 업그레이드 때 17로 올라가므로, 가동 중인 공장을 건드리기 전에 [그 과정을 읽어 보세요](/ko/gateway/upgrading/#upgrading-from-41810). 차트는 데이터베이스 비밀번호, MCP 토큰, 관리자 비밀번호를 만들어 릴리스 Secret에 넣고 업그레이드마다 다시 사용하므로, `helm upgrade`가 모르는 사이에 비밀번호를 바꾸거나 여러분을 자기 공장에서 로그아웃시키는 일은 없습니다.

## 필요해지기 전에 키를 백업하세요

차트는 두 번째 Secret `<release>-secret-key`(위 명령에서는 `hotloop-secret-key`)도 만듭니다. 여기에는 HotLoop이 장치별로 보관하는 모든 비밀번호를 암호화하는 키가 들어 있습니다. OPC UA, MQTT, HTTP, MTConnect, UniFi 장치의 `password`, API 키 같은 HTTP와 MTConnect 헤더 값, 디스커버리가 듣는 다른 MQTT 브로커 각각의 비밀번호, 각 히스토리언 대상의 비밀번호입니다. 키는 데이터베이스에도 백업에도 들어 있지 않으므로, 노트북에 담겨 밖으로 나간 덤프에는 공장의 열쇠가 아니라 암호문만 있습니다.

차트는 이 Secret을 업그레이드 사이에도, `helm uninstall` 뒤에도 유지합니다. 볼륨에 남은 데이터베이스는 이 키가 없으면 자격 증명을 쓸 수 없기 때문입니다. 그래서 **키는 여러분의 데이터의 일부입니다.** 키 없이 Gateway를 시작하면 봉인된 비밀번호가 있는 모든 장치는 필요한 키의 이름을 알려 주는 오류와 함께 다운된 채 재시도만 합니다. 백업은 그 키가 마운트된 곳에서만 복원되며, 다른 곳에서는 `--restore-from`이 키 이름을 들어 거부합니다.

따라서 클러스터의 다른 비밀을 백업하듯 이 Secret도 백업하고, 백업 옆이 아닌 다른 곳에 보관하세요. 지키려는 백업 옆에 놓인 키는 아무것도 지키지 못합니다.

**설치하지 않고 차트를 렌더링만 하시나요? 직접 만든 키를 가져오세요.** 키는 실제 `helm install`이나 `helm upgrade`만 할 수 있는 `lookup`으로 생성됩니다. `helm template`을 실행하고 그 결과를 적용하는 방식은 렌더링할 때마다 새 키를 받고, 다음 동기화 때 봉인된 모든 비밀번호가 잠겨 버립니다. `hotloop gen-secret-key`로 키를 만들어 직접 관리하는 Secret의 `secret.key` 항목에 넣고, 그 Secret을 `secretKey.existingSecret`에 지정하세요. Helm, Fleet, EmberNet App Store는 모두 실제로 설치하므로 이 작업이 필요 없습니다.

URL(`mqtt://user:pass@host`)이나 자유 텍스트에 적은 자격 증명은 평문으로 남습니다. `password`에 넣으세요. 무엇이 암호화되는지는 [장치 자격 증명](/ko/iot/protocols/#device-credentials)에 전체 목록이 있습니다.

## 로그인

사용자는 `admin`입니다. 설치 안내가 비밀번호를 다시 읽는 명령을 출력합니다.

```bash
kubectl -n hotloop get secret hotloop \
  -o jsonpath='{.data.admin-password}' | base64 -d
kubectl -n hotloop port-forward svc/hotloop 8080:8080
```

`http://localhost:8080`을 여세요. 그 admin 계정은 초기 설정용이며 재설정 스위치가 아닙니다. 한 번 만들어진 뒤에는 `auth.admin.password`를 바꾸고 업그레이드해도 아무 일도 일어나지 않으므로, UI에서 누군가 정한 비밀번호가 다음 배포로 덮어써지는 일은 없습니다.

이제 장치를 추가하고 태그를 검색한 다음 그중 하나에 쓰기를 시도해 보세요. 되지 않습니다. 일부러 그렇게 했습니다. 모든 태그는 읽기 전용으로 시작해 하나씩 활성화하며, `safety.allowWrites`는 이 파드가 기계를 움직여도 된다고 여러분이 결정할 때까지 꺼져 있습니다. HotLoop을 처음 쓰는 날이 프레스가 아무도 요청하지 않은 동작을 하는 것으로 끝나서는 안 됩니다.

## 박스 상태와 호스트 마운트

차트의 OPC UA 서버는 이 박스 자신의 상태(CPU, 메모리, 디스크, 에이전트가 파일을 쓸 때의 실시간 지터)도 EmberNet 대시보드에 제공하며, 태그와 값만 읽을 수 있는 대시보드용 로그인을 만들고 그 비밀번호는 업그레이드 사이에 Secret `<release>-opcua-dashboard`에 보관합니다. 마운트는 기본으로 켜져 있습니다. 차트는 호스트의 루트를 `/host`에, `/proc`을 `/host/proc`에 모두 읽기 전용으로 마운트하며 권한을 더하지 않습니다. 제한된 Pod Security 프로필을 적용하는 클러스터는 hostPath를 거부하므로, 그런 곳에서는 장치와 마운트를 모두 없애려면 `opcuaServer.dashboard.boxHealth.enabled: false`를, 장치는 유지하되 디스크와 CPU를 유효하지 않음으로 표시하고 무엇을 마운트해야 하는지 알려 주게 하려면 `opcuaServer.dashboard.boxHealth.hostMount: false`를 설정하세요. Quadlet 드롭인은 `deploy/quadlet/opcua-dashboard.conf`입니다.

## 실제 공장에 보이기 전에 설정할 것

이 값들을 values 파일에 넣고 `-f`로 설치하세요. 다음 업그레이드 때 다시 필요한 것은 `--set`에 의존하지 마세요. 여러분도 기억하지 못하고 업그레이드도 기억하지 못합니다.

| 값 | 기본값 | 바꾸는 이유 |
|---|---|---|
| `plant.name`, `plant.siteId` | `HotLoop`, 비어 있음 | 화면, 페이지, 다른 사이트에서 공장이 불리는 이름입니다. |
| `global.timezone` | `America/New_York` | 일정, 보고서, 교대 전환이 이 값을 따릅니다. 실제 영역 이름이어야 하며(`CST`가 아니라 `America/Chicago`), 로드되지 않는 시간대는 조용히 UTC로 돌아가는 대신 시작을 멈추게 합니다. |
| `publicUrl` | 비어 있음 | 공장 Wi-Fi의 휴대폰이 HotLoop에 접속하는 주소입니다. 없으면 알림에 돌아올 링크가 없고 ntfy에 확인 버튼이 생기지 않습니다. |
| `safety.allowWrites` | `false` | 마스터 스위치입니다. 꺼져 있으면 어디에서도 기계에 아무것도 쓰지 않습니다. 배포를 검토한 뒤에 켜세요. |
| `safety.allowMcpWrites` | `true` | 에이전트가 같은 관문을 통해 쓰도록 허용하며, 4.19.4부터 켜져 있습니다. 마스터 스위치를 따릅니다. `safety.allowWrites`가 꺼져 있으면 에이전트를 포함해 아무것도 쓰지 않습니다. `false`로 설정하면 에이전트는 공장 전체를 읽을 수는 있지만 쓰지는 못합니다. 차트는 항상 MCP 토큰을 설정하므로 `/mcp`는 절대 열려 있지 않습니다. |
| `database.postgresql.persistence.size` | `20Gi` | 이력이 저장되는 곳입니다. 태그 수와 `historian.retentionDays`(90)에 맞춰 크기를 정하세요. |
| `logbook.retentionDays` | `90` | [로그북](/ko/iot/logbook/)이 보관하는 엔티티 상태 변경의 일수입니다. `0`은 볼륨이 찰 때까지 모두 보관하며, Gateway는 시작할 때 이를 경고합니다. |
| `secretKey.existingSecret` | 비어 있음 | 장치 비밀번호 키를 담아 직접 관리하는 Secret입니다. 비워 두면 차트가 만듭니다. `helm template`으로 차트를 렌더링한다면 설정하세요. |
| `database.type` | `timescaledb` | 앱이 사용하는 데이터베이스: `timescaledb`, `postgresql`, `sqlite`. 다른 이미지가 아니라 설정입니다. |
| `plant.latitude`, `plant.longitude` | 비어 있음 | 공장의 위치(십진 도). [태양](/ko/iot/sun/) 위치를 박스에서 계산하기 위한 값입니다. 둘 다 넣거나 둘 다 비웁니다. |
| `edgePublish.queueMaxBytes` | `67108864` | Sparkplug로 상위에 게시할 때 중단 대기열의 한도로 64 MiB입니다. 넘으면 가장 오래된 측정값부터 버려지고 집계됩니다. `0`은 제한이 없으며, 중단이 충분히 길면 볼륨이 가득 찹니다. |
| `database.postgresql.enabled` | `true` | `false`로 설정하고 `database.external`을 채우면 직접 운영하는 PostgreSQL을 씁니다. TimescaleDB 확장이 있으면 하이퍼테이블, 없으면 기본 파티셔닝을 사용합니다. |
| `opcuaClient.persistence.enabled` | `false` | 보안이 적용된 OPC UA 장치를 추가하기 전에 켜세요. 켜지 않으면 클라이언트 인증서가 재시작 뒤에 남을 곳이 없고, 장치는 재배포할 때마다 양쪽에서 신뢰를 다시 승인하게 하는 대신 연결을 거부합니다. |
| `ingress` | 켜짐, 모든 호스트 | Ingress는 사용 중인 ingress 클래스가 처리하는 모든 호스트에 응답합니다. 하나의 이름으로 고정하려면 `ingress.hosts[0].host`를 설정하고, 쓰지 않으려면 `ingress.enabled: false`로 설정합니다. |

쓰기는 꺼진 채 제공되며, 그것이 핵심입니다. `safety.allowWrites`가 켜져 있어도 태그는 따로 활성화하기 전까지 읽기 전용이고, 모든 값은 태그의 범위와 대조해 검사하여 거부하며 절대 잘라내지 않습니다. [쓰기 관문](/ko/gateway/write-gate/)에 모든 검사가 순서대로 나와 있습니다.

## Podman Quadlet

클러스터에 속하지 않은 박스용입니다. Quadlet은 컨테이너를 진짜 systemd 서비스로 만듭니다. 아무도 로그인하지 않아도 부팅 때 시작하고, 죽으면 다시 시작하며, 저널에 로그를 남깁니다. **Podman 5.0 이상**이 필요합니다. Raspberry Pi OS Bookworm은 Quadlet이 전혀 없는 4.3을 제공하므로, Pi에는 Trixie 이상이 필요합니다. 데이터베이스 볼륨은 SD 카드가 아닌 USB SSD에 두세요.

유닛은 HotLoop 저장소의 `gateway/` 디렉터리, `deploy/quadlet/` 아래에 있습니다. [Podman Quadlet](/ko/install/quadlet/)에서 각 파일을 설명합니다.

```bash
sudo cp hotloop.network hotloop.container hotloop-db.container \
  hotloop-db.volume hotloop-data.volume /etc/containers/systemd/

openssl rand -hex 24 | sudo podman secret create hotloop-db-password -
sudo podman run --rm ghcr.io/hotloop-io/hotloop:stable gen-secret-key \
  | sudo podman secret create hotloop-secret-key -
printf '%s' 'a long admin password' \
  | sudo podman run --rm -i ghcr.io/hotloop-io/hotloop:stable hash-password \
  | sudo podman secret create hotloop-admin-password-hash -

sudo systemctl daemon-reload
sudo systemctl start hotloop.service
sudo systemctl status hotloop.service hotloop-db.service
curl -s localhost:8080/api/status
```

그런 다음 `http://<this box>:8080`을 열고 `admin`으로 로그인하세요. 세 가지 시크릿은 데이터베이스 비밀번호, 장치 비밀번호 키(위와 같은 이유로 이 박스가 아닌 곳에 백업하세요), 그리고 관리자 비밀번호의 bcrypt 해시이며 비밀번호 자체는 절대 아닙니다. 유닛은 90일치 이력을 보관하고 `:stable`을 따릅니다.

TimescaleDB 대신 일반 PostgreSQL을 쓰려면 같은 유닛의 `hotloop.container`에 `Environment=HOTLOOP_HISTORIAN_TIMESCALE=false`를 추가합니다. SQLite 파일은 `gateway/sqlite/`의 파일만 쓰고 위 디렉터리의 파일은 쓰지 않습니다. 유닛 이름이 같기 때문입니다. `hotloop.container`와 `hotloop-data.volume`, 그리고 두 시크릿 `hotloop-secret-key`와 `hotloop-admin-password-hash`가 그것입니다.

박스마다 한 번 Podman의 타이머를 켜면 Gateway가 스스로 업데이트합니다.

```bash
sudo systemctl enable --now podman-auto-update.timer
```

데이터베이스 컨테이너는 일부러 `:stable`을 따르지 않으며, 시작하지 못하는 업데이트는 롤백됩니다. [:stable 자동 업데이트](/ko/install/auto-update/)에 업데이트가 하는 일, 롤백이 되돌리지 못하는 것, 여러분이 말할 때까지 업데이트를 보류하는 방법이 나와 있습니다. 이 유닛들은 실제로 실행해 본 것입니다. systemd 아래에서 루트리스로, 마이그레이션한 뒤 시작하지 못해 롤백되는 업데이트까지 포함해서입니다. 이후 베어메탈에서도 실행했습니다(2026-11-17).

## 그다음

장치를 추가하고 태그를 검색한 뒤 값이 들어오는 것을 확인하세요. [프로토콜](/ko/iot/protocols/)에서 각 드라이버가 어디까지 검증되었는지 알 수 있으며, 2026-11-17에 베어메탈에서 실행한 두 가지, S7comm과 EtherNet/IP도 포함됩니다. EmberCORE 아래에서 실행하면 EmberCORE가 알아서 찾아 클러스터 내부 주소로 프록시하므로 인그레스가 필요 없습니다.

## 라이선스

HotLoop Gateway는 HotLoop Source License Agreement 1.0을 따릅니다. 무료로 사용할 수 있고 소스가 공개되어 있지만 OSI 오픈 소스는 아닙니다. 가정과 실험실에서의 사용은 무료이며, 학교, 비영리 단체, 정부 기관이 자체 운영에 쓰는 것도 무료입니다. [라이선스 페이지](/ko/license/)와 [기업에서 HotLoop 사용하기](/ko/business/)를 보세요.
