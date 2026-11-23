---
title: "HotLoop Edge {{hotloop}} 설치"
description: "HotLoop Edge {{hotloop}}을 Helm으로 k3s에, 또는 Podman Quadlet으로 산업용 PC에 설치한 다음 OPC UA 서버와 Sparkplug 게시를 켭니다."
sidebar:
  label: "설치"
---

HotLoop Edge는 4.18.10에서 처음 출시되었습니다. 이미지는 amd64, arm64, arm/v7용으로 빌드된 `ghcr.io/hotloop-io/hotloop-edge:{{hotloop}}`이고, 차트는 나머지 제품군과 같은 Helm 저장소에 있는 `hotloop-edge`입니다. 둘 다 로그인 없이 받을 수 있습니다. Docker나 Compose 경로는 의도적으로 없으며, 세션과 함께 사라지는 셸에서 실행한 단순한 `podman run`은 설치가 아닙니다.

클러스터에는 Helm을 씁니다. 클러스터가 없는 산업용 PC나 Pi에는 Podman Quadlet을 씁니다. 데이터베이스는 한 번만 고르면 됩니다. TimescaleDB(기본값), 일반 PostgreSQL, 또는 데이터베이스 컨테이너가 전혀 없는 SQLite 파일입니다.

## Helm

```bash
helm repo add hotloop https://hotloop.io/hotloop
helm repo update
helm install hotloop hotloop/hotloop-edge --version {{hotloop}} \
  --namespace hotloop --create-namespace
```

어떤 제품이든 릴리스 이름은 `hotloop`으로 합니다. 데이터베이스 볼륨, Secret, Service의 이름이 릴리스 이름을 따르며, 이름을 유지해야 나중에 사이트를 상위 제품으로 옮길 수 있습니다.

이렇게 하면 Edge와 그 옆의 PostgreSQL 17 위에서 도는 TimescaleDB 2.30.1이 20 Gi 볼륨에 배포되고, 이력은 90일 보관됩니다. 차트는 데이터베이스 비밀번호, MCP 토큰, 관리자 비밀번호를 릴리스 Secret에 생성하고 업그레이드할 때마다 재사용합니다. 또한 HotLoop이 보관하는 모든 장치 비밀번호를 암호화하는 키인 `<release>-secret-key`도 생성합니다. 이 키는 데이터의 일부이며, 이유와 백업 방법은 [Gateway 설치 페이지](/ko/gateway/install/#필요해지기-전에-키를-백업하세요)에 있습니다. 같은 키입니다.

일반 PostgreSQL이나 SQLite 파일을 쓰려면 설치할 때 `database.type`을 `postgresql` 또는 `sqlite`로 설정합니다. SQLite 파일은 로컬 디스크 하나에 쓰는 쪽이 하나뿐이므로 복제본은 하나이며 NFS는 절대 안 됩니다. 나중에 데이터베이스를 바꾸려면 백업과 복원을 해야 합니다. 새 데이터베이스는 비어 있는 채로 시작하기 때문입니다. 복원 방법은 [백업](/ko/iot/backup/)에 있습니다.

### 로그인

사용자는 `admin`입니다. 설치 안내가 비밀번호를 다시 읽는 명령을 출력합니다.

```bash
kubectl -n hotloop get secret hotloop \
  -o jsonpath='{.data.admin-password}' | base64 -d
kubectl -n hotloop port-forward svc/hotloop 8080:8080
```

`http://localhost:8080`을 엽니다. 쓰기는 꺼진 채로 제공됩니다. 누군가 활성화하기 전까지 모든 태그는 읽기 전용이며, 이 박스가 기계를 움직여도 된다고 결정하기 전까지 `safety.allowWrites`는 `false`로 남습니다. [쓰기 게이트](/ko/gateway/write-gate/)에 모든 검사가 순서대로 있습니다.

### Edge가 추가하는 것과 연결할 곳

둘 다 처음 설치할 때부터 켜져 있으며, 각각 필요한 것이 생길 때까지 대기하므로 어느 쪽도 설치나 시작을 막지 않습니다. 둘 중 하나를 `false`로 설정하면 리스너, Service, 볼륨, Ingress를 만들지 않습니다.

**OPC UA 서버**는 켜져 있으며(`opcuaServer.enabled`), 포트 4840에서 인증이 켜진 채 동작하고, 관리자가 설정에서 볼 수 있는 `opcua-reader` 로그인이 자동 생성됩니다. 인증서가 맞도록 `opcuaServer.endpointHost`를 클라이언트가 장비에 접속하는 이름으로 설정하십시오. [OPC UA 서버](/ko/edge/opc-ua-server/)에 보안 모델이 있으며, 읽기 전용입니다.

**박스 상태와 호스트 마운트.** 차트의 OPC UA 서버는 EmberNet 대시보드를 위해 이 박스 자체의 상태(CPU, 메모리, 디스크, 에이전트가 파일을 쓸 때의 실시간 지터)도 제공하며, 대시보드용으로 태그와 값만 읽을 수 있는 로그인을 만듭니다. 기본으로 켜져 있습니다. 차트는 호스트의 루트를 `/host`에, `/proc`을 `/host/proc`에 모두 읽기 전용으로 마운트하며 권한은 추가하지 않습니다. 제한된 Pod Security 프로파일을 적용하는 클러스터는 hostPath를 거부하므로, 그곳에서는 장치도 마운트도 없도록 `opcuaServer.dashboard.boxHealth.enabled: false`로 두거나, 장치는 유지하되 디스크와 CPU 값을 불량으로 표시하고 무엇을 마운트해야 하는지 알려 주도록 `opcuaServer.dashboard.boxHealth.hostMount: false`로 둡니다. 나머지는 [OPC UA 서버](/ko/edge/opc-ua-server/#embernet-대시보드를-위한-장비-상태)에 있습니다.

**Sparkplug 퍼블리시**는 켜져 있으며(`edgePublish.enabled`) 대상이 지정되기를 기다립니다. `edgePublish.broker`와 `edgePublish.group`을 설정하거나 관리자가 설정의 "알람과 측정값이 가는 곳"에 입력하게 하십시오(거기에 저장한 값이 차트 값보다 우선하며, 엣지 퍼블리셔는 다음 재시작 때 반영합니다). `edgePublish.node`도 설정하십시오. 설정하지 않으면 노드 ID는 릴리스 이름이 됩니다. 전달 큐는 1 Gi 볼륨에 있고, `edgePublish.queueMaxBytes`의 기본값은 64 MiB(측정값 약 248,000개: 초당 2,000개일 때 약 2분, 측정값당 약 240바이트)이며, 그것을 넘으면 가장 오래된 측정값부터 버려지고 집계됩니다. `0`은 무제한이며, 장애가 충분히 길면 볼륨이 가득 찹니다. 엣지 퍼블리시에는 `replicaCount` 1이 필요하며, 그렇지 않으면 차트가 렌더링을 거부합니다. [엣지 퍼블리시와 store-and-forward](/ko/edge/edge-publish/)에서 업링크가 끊겼을 때의 동작을 설명합니다.

### 실제 공장에 보이기 전에 설정할 것

| 값 | 기본값 | 바꾸는 이유 |
|---|---|---|
| `plant.name`, `plant.siteId` | `HotLoop`, 비어 있음 | 화면, 페이지, 다른 사이트에서 공장이 불리는 이름입니다. |
| `global.timezone` | `America/New_York` | 일정과 교대 변경이 이 값을 따릅니다. 실제 시간대 이름이어야 합니다. |
| `publicUrl` | 비어 있음 | 공장 Wi-Fi의 휴대폰이 HotLoop에 접속하는 주소입니다. 없으면 알림에 돌아올 링크가 없습니다. |
| `safety.allowWrites` | `false` | 마스터 스위치입니다. 꺼져 있으면 어디서도 기계에 쓰지 않습니다. |
| `historian.retentionDays` | `90` | 이력을 보관하는 일수입니다. |
| `database.postgresql.persistence.size` | `20Gi` | 이력이 저장되는 곳입니다. 태그 수와 위의 보관 기간에 맞춰 크기를 정하세요. |
| `opcuaClient.persistence.enabled` | `false` | 보안이 적용된 OPC UA 장치를 추가하기 전에 켜서, 재시작 후에도 클라이언트 인증서가 유지되게 합니다. |
| `secretKey.existingSecret` | 비어 있음 | 직접 관리하며 장치 비밀번호 키를 담은 Secret입니다. `helm template`으로 차트를 렌더링한다면 설정하세요. |

## Podman Quadlet

Quadlet은 컨테이너를 진짜 systemd 서비스로 바꿔 줍니다. 아무도 로그인하지 않아도 부팅 때 시작하고, 죽으면 다시 시작하며, 저널에 로그를 남깁니다. **Podman 5.0 이상**이 필요합니다. Raspberry Pi OS Bookworm은 Quadlet이 전혀 없는 4.3을 제공하므로 Pi에는 Trixie 이상이 필요합니다. 데이터베이스 볼륨은 SD 카드가 아니라 USB SSD에 두세요.

유닛은 HotLoop 저장소의 `deploy/quadlet/` 아래 `edge/` 디렉터리에 있으며, IoT와 Gateway의 유닛과 이름이 같습니다. 각 파일의 설명은 [Podman Quadlet](/ko/install/quadlet/)에 있습니다.

```bash
sudo cp hotloop.network hotloop.container hotloop-db.container \
  hotloop-db.volume hotloop-data.volume /etc/containers/systemd/

openssl rand -hex 24 | sudo podman secret create hotloop-db-password -
sudo podman run --rm ghcr.io/hotloop-io/hotloop-edge:stable gen-secret-key \
  | sudo podman secret create hotloop-secret-key -
printf '%s' 'a long admin password' \
  | sudo podman run --rm -i ghcr.io/hotloop-io/hotloop-edge:stable hash-password \
  | sudo podman secret create hotloop-admin-password-hash -

sudo systemctl daemon-reload
sudo systemctl start hotloop.service
sudo systemctl status hotloop.service hotloop-db.service
curl -s localhost:8080/api/status
```

그런 다음 `http://<this box>:8080`을 열고 `admin`으로 로그인합니다. 키는 이 박스가 아닌 다른 곳에 사본을 보관하세요. 잃어버리면 모든 장치 비밀번호를 다시 입력해야 합니다.

유닛은 8080 포트만 공개합니다. OPC UA 서버(4840)와 내장 MQTT 브로커(1883)는 컨테이너 안에서 켜져 있습니다. 장비 밖에서 둘 중 하나에 접속하려면 `hotloop.container`에 해당 포트의 `PublishPort=` 줄을 추가하십시오. Quadlet 유닛은 차트와 마찬가지로 기본으로 90일치 이력을 보관합니다.

Edge에서 일반 PostgreSQL을 쓰려면 TimescaleDB 유닛의 `hotloop.container`에 `Environment=HOTLOOP_HISTORIAN_TIMESCALE=false`를 추가하면 됩니다. SQLite 파일을 쓰려면 `edge/sqlite/`의 파일만 쓰고 위 디렉터리의 파일은 쓰지 마세요. 유닛 이름이 같기 때문입니다. `hotloop.container`와 `hotloop-data.volume`, 그리고 두 개의 시크릿 `hotloop-secret-key`와 `hotloop-admin-password-hash`입니다.

유닛은 `:stable`을 따라가며, 타이머를 켜면 Podman이 갱신합니다.

```bash
sudo systemctl enable --now podman-auto-update.timer
```

새 이미지는 올라오면서 데이터베이스를 마이그레이션하고, 시작하지 못하면 Podman이 이전 이미지로 되돌립니다. 데이터베이스 컨테이너는 의도적으로 `:stable`을 따르지 않습니다. 업데이트가 하는 일, 롤백이 되돌릴 수 없는 것, 지시할 때까지 업데이트를 보류하는 방법은 [:stable 자동 업데이트](/ko/install/auto-update/)에 있습니다. 업데이트를 켜기 전에 백업을 받으세요.

## 상위 제품으로 옮기기

IoT에서 Edge로, 다시 Gateway로 옮겨도 모든 장치, 태그, 엔티티, 자동화, 알람, 사용자와 모든 이력이 유지됩니다. Quadlet에서는 상위 제품의 `hotloop.container`와 `hotloop-db.container`를 기존 파일 위에 복사하면 되고, Helm 방식은 [제품 라인업](/ko/products/)에 있습니다. 이 이동은 하나의 데이터베이스 볼륨에서 IoT, Edge, Gateway 순으로 Quadlet에서 실행해 보았고, 실제 클러스터에서 `helm upgrade`로도 실행해 보았습니다. 하위 제품으로 되돌리는 것은 소중한 박스에서 할 이동이 아니므로, 먼저 백업을 받으세요.

## 어디까지 실행해 보았나

Edge Quadlet 유닛은 루트 없이 systemd에서 실행해 보았으며, 마이그레이션하고 시작에 실패해 롤백되는 업데이트도 포함합니다. 실제 Pi를 루트 권한 systemd로 실행한 것과 32비트 arm 이미지는 실제 하드웨어에서, 베어메탈로 실행해 보았습니다(2026-11-17).

## 라이선스

HotLoop Edge는 HotLoop Source License Agreement 1.0을 따릅니다. 무료로 쓸 수 있고 소스를 볼 수 있지만 OSI 오픈 소스는 아닙니다. 가정과 실험실 사용은 무료이고, 학교, 비영리 단체, 정부 기관이 자체 운영에 쓰는 것도 무료입니다. [라이선스 페이지](/ko/license/)와 [기업에서 HotLoop 사용하기](/ko/business/)를 보세요.
