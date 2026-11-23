---
title: "Podman Quadlet 설치"
description: "Docker, Compose, 클러스터 없이 Podman Quadlet으로 Pi나 소형 산업용 PC에서 HotLoop을 실제 systemd 서비스로 실행하세요."
---

k3s 클러스터에 속하지 **않은** Pi나 소형 산업용 PC용입니다. 속해 있다면 제품의 차트를 사용하세요. 이 디렉터리와 차트가 HotLoop을 실행하는 두 가지 지원 방식입니다.

Docker도 없고, 세션과 함께 죽는 셸에서 실행하는 단발성 `podman run`도 없습니다. Quadlet은 컨테이너를 실제 systemd 서비스로 바꿉니다. 로그인한 사용자가 없어도 부팅 시 시작하고, 실패하면 다시 시작하며, journald에 로그를 남깁니다.

| 디렉터리 | 제품 | 이미지 |
|---|---|---|
| `iot/` | HotLoop IoT, PostgreSQL 17 포함 | `ghcr.io/hotloop-io/hotloop-iot` |
| `edge/` | HotLoop Edge, TimescaleDB 포함 | `ghcr.io/hotloop-io/hotloop-edge` |
| `gateway/` | HotLoop Gateway, TimescaleDB 포함 | `ghcr.io/hotloop-io/hotloop` |
| 이 디렉터리 | HotLoop Edge Relay, 데이터베이스 없음 | `ghcr.io/hotloop-io/hotloop-edge-relay` |

[제품 페이지](/ko/products/)에서 어느 것이 필요한지 알 수 있습니다.

앞의 세 제품에는 각각 `sqlite/` 디렉터리도 있습니다. 같은 제품이지만 데이터베이스가 파일이고 데이터베이스 컨테이너가 없습니다. [PostgreSQL 대신 SQLite](#postgresql-대신-sqlite)를 참조하세요.

## IoT, Edge, 그리고 Gateway

각 디렉터리에는 같은 유닛과 스크립트 하나가 있습니다.

- **`hotloop.network`**: 앱과 데이터베이스가 공유하는 네트워크입니다. 앱은 이름(`hotloop-db:5432`)으로 데이터베이스에 접근하고, 데이터베이스가 포트를 게시하지 않으므로 장비의 다른 어떤 것도 접근할 수 없습니다. 앱의 8080만 게시됩니다.
- **`hotloop.container`**: 앱입니다. 파일 머리말에 설치 단계가 있으니 무엇이든 복사하기 전에 읽으세요.
- **`hotloop-db.container`**: 데이터베이스이며, 해당 제품의 차트가 실행하는 것과 같은 이미지와 버전입니다. 응답하는 순간 시작됨으로 보고하므로 앱은 사용할 수 있는 데이터베이스를 기다립니다.
- **`hotloop-db-upgrade.container`**와 **`hotloop-db-upgrade.sh`**: 데이터베이스를 PostgreSQL 16에서 17로 옮기는 단계이며 한 번만 실행됩니다. 데이터베이스 유닛보다 먼저, 볼륨에 아직 16 데이터가 있을 때만 실행됩니다. 새 볼륨이거나 이미 17인 볼륨이면 systemd가 건너뜁니다. [PostgreSQL 16에서 17로](#postgresql-16에서-17로)를 참조하세요.
- **`hotloop-db.volume`**과 **`hotloop-data.volume`**: 데이터베이스와 앱이 `/data` 아래에 쓰는 모든 것(백업, 인증서, 전달 대기열, 보고서)입니다. 이름이 있는 Podman 볼륨이라 `podman system prune`이 건드리지 않습니다.

세 개의 Podman 시크릿이 파일에 두면 안 되는 것을 보관합니다. `hotloop-db-password`, `hotloop-secret-key`(데이터베이스의 장치 비밀번호를 암호화합니다. 사본을 장비 밖에 보관하세요), `hotloop-admin-password-hash`(첫 관리자 비밀번호의 bcrypt 해시이며 비밀번호 자체는 아닙니다)입니다.

**Podman 5.0 이상.** Raspberry Pi OS Bookworm에는 Quadlet이 전혀 없는 Podman 4.3이 들어 있습니다. Raspberry Pi OS Trixie(Podman 5.4) 이상을 사용하세요. 아래 업데이트는 Podman 6.1.3에서 실행했고, 같은 키를 쓰는 Edge Relay 유닛은 4.9.3에서 실행했습니다. 그리고 데이터베이스 볼륨은 SD 카드가 아니라 USB SSD에 두세요. 이력은 하루 종일 기록되고, SD 카드는 바로 그것 때문에 죽습니다.

### 모든 제품이 같은 이름을 쓰는 이유

유닛, 볼륨, 시크릿의 이름은 `iot/`, `edge/`, `gateway/`에서 의도적으로 똑같습니다. 장비를 상위 제품으로 올리는 일은 상위 제품의 `hotloop.container`와 `hotloop-db.container`를 기존 파일 위에 복사하는 것입니다.

```sh
sudo cp gateway/hotloop.container gateway/hotloop-db.container \
  gateway/hotloop-db-upgrade.container gateway/hotloop-db-upgrade.sh /etc/containers/systemd/
sudo systemctl daemon-reload
sudo systemctl restart hotloop.service hotloop-db.service
```

볼륨과 시크릿은 그대로 남고, 모든 장치, 태그, 알람, 사용자, 그리고 이력도 그대로입니다. 그래도 먼저 백업하세요(`POST /api/backup`). 이 이동은 같은 볼륨 세트에서 IoT에서 Edge로, 다시 Gateway로 실제로 실행해 봤습니다. 하위 제품으로 내려가는 것은 소중한 장비에서 할 일이 아닙니다.

또한 장비 하나에 HotLoop 하나라는 뜻입니다. 둘이면 어차피 8080 포트를 두고 충돌합니다.

### 검증

배포된 IoT, Edge, Gateway 파일은 수정 없이 Podman 6.1.3의 `quadlet` 생성기로 같은 구조로 생성됩니다. 앱은 데이터베이스와 네트워크를 요구하고, 자체 포트를 게시하며, 자동 업데이트 레이블을 달고 있고, 데이터베이스는 레이블이 없고 아무것도 게시하지 않습니다.

이어서 Gateway 유닛을 실제로 실행했습니다. 루트 없이, systemd 아래에서, ghcr.io 대신 로컬 레지스트리와 제품 자체의 `podman auto-update`로 했습니다. 데이터베이스가 정상이고 그 뒤에 앱이 정상인 첫 시작, 앱이 이미 쓰는 테이블에 마이그레이션을 추가하는 릴리스로의 업데이트(기존 장치와 데이터가 그대로이고 데이터베이스 컨테이너는 한 번도 재시작되지 않음), 그리고 데이터베이스를 마이그레이션한 뒤 시작하지 못하는 릴리스로의 업데이트(Podman이 롤백했고, 이전 릴리스가 실패한 릴리스가 이미 마이그레이션한 데이터베이스 위에서 정상 시작)를 확인했습니다. Edge와 IoT는 같은 유닛으로 실행되며, 실제 Pi의 베어메탈에서 systemd로 실행했습니다(2026-11-17).

## PostgreSQL 16에서 17로

이 릴리스부터 HotLoop의 데이터베이스는 PostgreSQL 17입니다. 이전 릴리스를 실행하던 장비에는 PostgreSQL 17이 열 수 없는 PostgreSQL 16 데이터가 있으므로, 데이터베이스보다 먼저 실행되는 유닛이 이를 옮깁니다. 새 파일을 제자리에 두고 데이터베이스를 재시작하면 끝입니다.

```sh
sudo cp hotloop-db.container hotloop-db-upgrade.container hotloop-db-upgrade.sh \
  /etc/containers/systemd/
sudo systemctl daemon-reload
sudo systemctl restart hotloop-db.service
journalctl -u hotloop-db-upgrade.service      # what it did
```

`hotloop-db.container`는 업그레이드 유닛을 요구하므로, 새 데이터베이스 유닛만 복사한 장비는 16 데이터 위에서 시작하지 않고 journal이 이유를 알려 줍니다. 업그레이드 유닛은 기존 디렉터리 옆의 새 디렉터리로 복사 모드의 `pg_upgrade`를 실행하고, 새 서버를 한 번 시작해 열리는지 확인한 뒤에야 이름을 교체합니다. 이전 데이터는 `pgdata.pg16`으로 볼륨에 남습니다. 볼륨이 필요로 할 때만 PostgreSQL 16 이미지를 가져옵니다. 실패해도 16 데이터는 그대로이고 데이터베이스는 시작되지 않은 상태로 남습니다. 전체 설명, 되돌리는 방법, `pgdata.pg16`을 삭제하는 방법은 [k3s와 Helm](/ko/install/helm/#postgresql-17)에 있습니다. 루트 없는 설치에서 유닛 안의 스크립트 경로는 `%E`에서 나온 `~/.config/containers/systemd`입니다.

## PostgreSQL 대신 SQLite

데이터베이스는 이미지가 아니라 설정입니다(k3s와 Helm 페이지의 "SQLite"). Quadlet에서는 두 번째 이미지가 아니라 두 번째 파일 세트를 뜻합니다. 각 제품의 `sqlite/` 디렉터리에는 두 개가 있습니다.

- **`sqlite/hotloop.container`**: 앱만 있습니다. 데이터베이스에 대한 `Requires=`도, 네트워크도, 데이터베이스 비밀번호도 없고, `HOTLOOP_DB_TYPE=sqlite`와 `HOTLOOP_DB_PATH=/data/hotloop.db`의 파일을 씁니다. `:stable`을 따르고 PostgreSQL 유닛과 똑같이 잘못된 업데이트를 롤백합니다. 같은 상태 점검, 같은 `--sdnotify=healthy`입니다.
- **`sqlite/hotloop-data.volume`**: 데이터베이스 파일과 그 `-wal`, `-shm`이 있는 `hotloop-data` 볼륨입니다. PostgreSQL 파일과 같은 볼륨 이름이므로 나중에 바꿔도 같은 데이터 볼륨입니다.

| 디렉터리 | 설치 | 시크릿 |
|---|---|---|
| `iot/`, `edge/`, `gateway/` | `hotloop.network`, `hotloop.container`, `hotloop-db.container`, `hotloop-db.volume`, `hotloop-data.volume` | 세 개 |
| `iot/sqlite/`, `edge/sqlite/`, `gateway/sqlite/` | `hotloop.container`, `hotloop-data.volume` | 두 개: `hotloop-secret-key`와 `hotloop-admin-password-hash` |

한 세트만 설치하고 둘 다 설치하지 마세요. 같은 유닛 이름을 씁니다. `sqlite/hotloop.container`의 머리말에 정확한 단계가 있습니다. 요약하면 다음과 같습니다.

```sh
cd iot/sqlite        # or edge/sqlite, gateway/sqlite
sudo cp hotloop.container hotloop-data.volume /etc/containers/systemd/
# make hotloop-secret-key and hotloop-admin-password-hash as the header says
sudo systemctl daemon-reload
sudo systemctl start hotloop.service
curl -s localhost:8080/api/status
```

선택하기 전에 알아 둘 점이 있습니다. SQLite는 로컬 디스크 하나에 쓰는 기록자 하나입니다. Pi에서는 볼륨을 USB SSD에 두며, SQLite는 네트워크 스토리지에서 손상되므로 네트워크 스토리지는 선택지가 아닙니다. 이력은 인덱스가 있는 테이블 하나이며 파티션이나 하이퍼테이블이 아니므로, 1초 간격으로 수년간의 이력을 쌓는 현장은 PostgreSQL 파일이 필요합니다. 그리고 장비를 SQLite와 PostgreSQL 사이에서 옮기는 일은 유닛 교체가 아니라 백업과 복원([백업과 복원](/ko/iot/backup/))입니다. 새 데이터베이스는 비어 있는 상태로 시작합니다. "전환"하려고 `sqlite/hotloop.container`를 실행 중인 PostgreSQL 설치 위에 복사하지 마세요. PostgreSQL 볼륨의 데이터를 읽지 않습니다.

Edge나 Gateway에서 일반 PostgreSQL은 `hotloop.container`에 `Environment=HOTLOOP_HISTORIAN_TIMESCALE=false`를 추가한 TimescaleDB 유닛입니다. IoT의 유닛은 이미 일반 PostgreSQL이며, IoT에는 TimescaleDB 유닛이 아예 없습니다.

### 검증 (SQLite)

`iot/sqlite/hotloop.container`와 그 볼륨을 커밋된 파일 그대로 Podman 4.9.3의 systemd(`systemctl --user`) 아래에서 루트 없이 실행했으며, 바꾼 것은 이름, 포트, 이미지(같은 트리에서 빌드), 사용자 매니저에 필요한 런타임 디렉터리뿐입니다. 유닛은 정상으로 올라왔고, `/healthz`와 `/readyz`는 200으로 응답했으며, 관리자는 해시 시크릿으로 로그인했고, `/api/status`가 응답했으며, `hotloop.db`, `hotloop.db-wal`, `hotloop.db-shm`이 볼륨에 나타났고, 재시작은 마이그레이션을 적용하지 않고 관리자를 다시 로그인시켰습니다. Edge와 Gateway의 `sqlite/` 유닛은 이미지와 보존 기본값을 빼면 같은 파일이며, 실제 Pi의 베어메탈에서 루트로 systemd 아래 실행했습니다(2026-11-17).

## Edge Relay

- **`edge-relay-hold.conf`**: 선택 사항입니다. 운영자가 승인할 때까지 이미지 업데이트를 보류합니다. systemd 드롭인이며 기본 설치에는 포함되지 않습니다.
- **`edge-relay.container`**: 서비스 자체입니다. 전체 설치 단계는 자체 머리말의 주석에 있으니 무엇이든 복사하기 전에 읽으세요.
- **`edge-relay-data.volume`**: 전달 대기열을 위한 이름 있는 Podman 볼륨이며, 버퍼에 쌓인 측정값이 컨테이너 재시작 뒤에도 남게 합니다. 서비스가 처음 시작될 때 Podman이 자동으로 만듭니다.
- **`devices.example.json`**: 장치 파일의 출발점입니다. `/etc/edge-relay/devices.json`에 복사해 이 현장의 실제 장치에 맞게 편집하세요. 전체 형식은 [Edge Relay 레퍼런스](/ko/edge-relay/reference/)에 있습니다.

### 빠른 시작

```sh
sudo mkdir -p /etc/containers/systemd /etc/edge-relay
sudo cp edge-relay.container edge-relay-data.volume /etc/containers/systemd/
sudo cp devices.example.json /etc/edge-relay/devices.json   # then edit it
sudo "$EDITOR" /etc/containers/systemd/edge-relay.container  # broker, group, node

# Skip this if the broker takes anonymous connections.
printf '%s' 'your-broker-password' | sudo podman secret create edge-relay-broker-password -

sudo systemctl daemon-reload
sudo systemctl start edge-relay.service
sudo systemctl status edge-relay.service
curl localhost:8081/status
```

**업데이트.** 유닛은 `:stable`을 따르고 Podman의 타이머가 켜지면 스스로 업데이트합니다.

```sh
sudo systemctl enable --now podman-auto-update.timer
```

새 이미지가 상태 점검을 통과하지 못하면 Podman이 이전 이미지를 되돌려 놓습니다. Gateway의 장비 목록에는 각 릴레이의 버전과 이미지 다이제스트가 표시되고 모든 변경이 기록됩니다. 관리자가 Gateway에서 승인할 때까지 업데이트를 보류하려면, 그 파일 맨 위 주석의 안내대로 `edge-relay-hold.conf`를 설치하고 타이머를 끄세요. 이것이 하는 모든 일과 하지 못하는 일은 [Edge Relay 레퍼런스](/ko/edge-relay/reference/#relay-업데이트)에 있습니다.

로컬 파일의 변경을 반영하려면 파일을 편집한 뒤 `sudo systemctl restart edge-relay.service`를 실행하세요. 릴레이는 부팅할 때 그 파일을 읽고 변화를 감시하지 않습니다.

Gateway가 푸시한 장치 파일에는 이것이 필요 없습니다. 재시작 없이 즉시 적용됩니다. 읽기 전용 루트에 `:ro`로 마운트되어 있어 `/etc/edge-relay/devices.json`에는 쓸 수 없으므로 데이터 볼륨의 `/data/pushed-devices.json`에 저장되고, 그 파일이 있는 동안 릴레이는 그것으로 실행하고 부팅합니다. 푸시를 지우기 전까지는 로컬 파일 편집이 사용되지 않습니다. 릴레이가 실행 중일 때 Gateway에서 `DELETE /api/fleet/{id}/config`를 실행하면 즉시 로컬 파일로 돌아갑니다. 어느 파일을 쓰는지는 journal에 나오므로 JSON을 의심하기 전에 거기를 확인하세요.

실제 `quadlet` 바이너리(`podman-5.8.6`의 `/usr/libexec/podman/quadlet -dryrun`)로 검증했습니다. 두 유닛 모두 오류 없이 파싱되고 기대한 `podman run` 호출을 생성하며, 볼륨 의존성과 시크릿이 자동으로 연결됩니다.
