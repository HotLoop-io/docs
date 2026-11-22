---
title: "Cascade와 Podman Quadlet"
description: "Podman Quadlet으로 Cascade를 systemd 서비스로 실행합니다. SQLite 또는 Postgres와 별도 워커를 쓰고, 업데이트 시간대는 직접 정합니다."
---

실행 방법은 두 가지입니다. 둘 다 Podman 5.0 이상과 root 설치가 필요하며, 아무도 로그인하지 않아도 부팅할 때 시작됩니다. 둘 다 `ghcr.io/hotloop-io/hotloop-cascade:stable`을 따라가고, 읽기 전용에 비root 권한으로, 모든 capability를 제거한 채 실행하며, 재시작은 systemd에 맡깁니다. 업데이트와 롤백 방식은 마지막에 있습니다.

## 한 대, SQLite

`hotloop-cascade.container`와 `hotloop-cascade-data.volume`. 데이터베이스는 볼륨 안의 파일이며, 저장된 자격 증명을 암호화하는 키 옆에 있습니다.

```sh
sudo cp hotloop-cascade.container hotloop-cascade-data.volume /etc/containers/systemd/
sudo install -D -m 600 /dev/null /etc/hotloop-cascade/cascade.env
sudo systemctl daemon-reload
sudo systemctl start hotloop-cascade
```

`http://this-box:8080`을 여세요. 가장 먼저 여는 사람이 첫 계정을 만들게 되므로, 주소를 공유하기 전에 직접 만드세요.

## PostgreSQL, 서버 하나와 워커

`postgres/`. 데이터베이스, 서버, 그리고 원하면 워커를 더 둘 수 있습니다. Postgres가 대기열이므로 워커들은 같은 곳에서 작업을 가져갑니다. 데이터베이스는 전용 네트워크에 있으며 포트를 공개하지 않습니다.

먼저 시크릿 세 개를 한 번만 만듭니다. 명령은 `postgres/hotloop-cascade.container` 맨 위에 있습니다. 가장 중요한 것은 키입니다. 잃어버리면 저장된 모든 자격 증명을 읽을 수 없게 됩니다. 이 장비가 아닌 다른 곳에 사본을 보관하세요.

```sh
cd postgres
sudo cp hotloop-cascade.network hotloop-cascade-db.container hotloop-cascade-db.volume \
  hotloop-cascade-data.volume hotloop-cascade.container /etc/containers/systemd/
sudo install -D -m 600 /dev/null /etc/hotloop-cascade/cascade.env
sudo systemctl daemon-reload
sudo systemctl start hotloop-cascade
```

워커 추가: `hotloop-cascade-worker.container`. 워커는 데이터 볼륨을 공유하므로 같은 장비에 있어야 합니다. 장비 한 대를 넘어서면 Helm 차트를 사용하세요.

## 설정

`/etc/hotloop-cascade/cascade.env`에 한 줄에 `NAME=value` 하나씩 적으며, 비어 있어도 파일은 있어야 합니다(`install` 줄이 만들어 줍니다). 주로 쓰게 될 설정은 다음과 같습니다.

| 설정 | 하는 일 |
|---|---|
| `HOTLOOP_CASCADE_PUBLIC_URL` | 사람들이 Cascade에 접속하는 주소입니다. 웹훅과 OAuth 콜백 링크가 이 주소로 만들어집니다. 설정하기 전에는 `http://localhost:8080`이며, 장비 자체에서만 동작합니다. |
| `HOTLOOP_CASCADE_METRICS_TOKEN` | `/metrics`에 `Authorization: Bearer`를 요구합니다. |
| `HOTLOOP_CASCADE_FILES_DIR` | 이 디렉터리에서 파일 단계를 켭니다. 컨테이너에도 마운트하세요. |

유닛은 데이터 디렉터리, 포트, 키만 지정하며, 유닛에 지정한 값은 env 파일의 값보다 우선하므로 이 항목들은 건드리지 마세요. 변경한 뒤에는 `sudo systemctl restart hotloop-cascade`를 실행하세요.

## 확인

```sh
sudo podman healthcheck run hotloop-cascade
curl -s http://127.0.0.1:8081/readyz
sudo podman exec hotloop-cascade /usr/local/bin/hotloop-cascade workflows import - < workflow.yaml
```

상태와 메트릭은 루프백에만 공개된 8081 포트에 있습니다. 8080이나 8081을 이미 다른 것이 쓰고 있다면 `PublishPort=` 줄의 왼쪽 값을 바꾸세요.

## 업그레이드

앱 유닛은 `:stable`을 따라가며 `AutoUpdate=registry`를 가집니다. Podman의 타이머를 장비당 한 번 켜세요.

```sh
sudo systemctl enable --now podman-auto-update.timer
```

타이머가 작동하면 Podman이 `:stable`을 받아 오고, 다이제스트가 바뀌었으면 새 이미지로 유닛을 재시작합니다. 컨테이너가 상태 확인을 통과해야 유닛이 시작된 것으로 칩니다(`Notify=healthy`. 확인은 바이너리가 자기 `/readyz`를 직접 묻는 방식이며, 이미지에 셸이 없어서 JSON 배열로 지정합니다). 새 이미지가 끝내 통과하지 못하면 Podman이 이전 이미지를 `:stable`로 되돌리고 시작합니다. 새 이미지는 올라오는 중에 데이터베이스를 마이그레이션하므로 최대 15분까지 기다립니다.

말씀하실 때까지 업데이트를 보류하려면 타이머를 끈 채로 두고, 준비되었을 때 `sudo podman auto-update`를 실행하세요. 정해진 시간대에만 업데이트되게 하려면 `update-window.conf`를 설치하세요(사용법은 파일 머리말에 있습니다).

롤백으로 되돌릴 수 없는 것이 둘 있습니다. 마이그레이션은 앞으로만 진행되므로 업데이트를 켜기 전에 백업을 받으세요. 이전 버전이 읽을 수 없는 방식으로 테이블을 바꾸는 릴리스는 릴리스 노트에 그렇게 적혀 있습니다. 그리고 데이터베이스입니다. 데이터베이스 이미지는 정확한 태그로 고정되어 있고 업데이트 라벨이 없으며, 의도한 것입니다. 시작되지 않는 새 서버는 이전 이미지를 되돌려 놓으면 취소되지만, 새 데이터베이스 이미지는 시작되어 데이터 디렉터리를 바꾼 뒤에야 실수였음이 드러날 수 있습니다. PostgreSQL 18 안에서는 릴리스 노트를 읽고 백업한 뒤 태그를 수정하면 됩니다.

PostgreSQL 방식에서는 서버와 각 워커가 별도 유닛이므로, 시작되지 않는 업데이트는 그 유닛만 롤백하고 옆의 유닛은 건드리지 않습니다.

## 확인한 내용

유닛을 Podman 6.1.3에서 systemd 아래 rootless로 실제로 실행했습니다. ghcr.io 대신 로컬 레지스트리를 쓰고, 호스트 포트만 빼고 제공된 유닛을 수정 없이 사용했습니다. 단독 방식과 PostgreSQL 방식 모두 다음을 확인했습니다. 정상 컨테이너를 기다리는 첫 시작, 새 다이제스트로의 업데이트(데이터가 그대로인 채 정상으로 돌아왔고 PostgreSQL 방식에서는 데이터베이스 컨테이너가 그대로였습니다), 시작 시 종료되는 이미지로의 업데이트(`podman auto-update`가 `rolled back`으로 보고했고, 이전 다이제스트가 다시 정상으로 동작했으며 이전 워크플로도 계속 실행 중이었습니다). Podman 4.9.3의 root 설치에서는 이전 버전의 유닛이 systemd 아래에서 시작되고 재시작되었습니다. 또한 Quadlet 4.9는 `Notify=healthy`를 지원하지 않으므로 유닛에는 `--sdnotify=healthy`도 들어 있습니다.

그다음 두 방식을 다시 root 설치로, 즉 유닛이 안내하는 방식 그대로, Podman 5.8.7에서 systemd 아래 일회용 권한 컨테이너 안에서 실행했습니다. ghcr.io의 미러 역할을 하는 같은 로컬 레지스트리를 쓰고 유닛은 수정하지 않았습니다. 단독 방식: 시작이 정상 컨테이너를 기다렸고, 강제 종료한 컨테이너가 정상으로 돌아왔으며, 정상 이미지로의 업데이트가 새 다이제스트에서 정상으로 올라왔고, 시작 시 종료되는 이미지로의 업데이트는 `rolled back`으로 보고되며 정상 이미지가 다시 실행되었고, 매 단계 뒤에 워크플로가 실행되었습니다. PostgreSQL 방식(서버와 추가 워커 하나): 서버에서 `systemctl start`가 데이터베이스, 그다음 서버가 정상이 될 때까지 기다렸고, 강제 종료한 서버가 돌아왔고, 정상 이미지로의 업데이트가 서버와 워커를 옮기면서 데이터베이스 컨테이너는 건드리지 않았으며, 시작 시 종료되는 이미지로의 업데이트는 `rolled back`으로 돌아와 둘 다 정상 이미지로 복귀하고 데이터베이스는 그대로였고, 워크플로가 그 전, 사이, 그 후에 실행되었습니다. 출력을 읽을 때 알아 둘 점이 하나 있습니다. 서버와 워커는 이미지 하나를 공유하며, 둘 중 먼저 롤백된 쪽이 있으면 다른 쪽은 재시작과 함께 대신 `true`로 표시되었고 결국 정상 이미지에 올라갔습니다. 어느 쪽이 먼저 롤백되는지는 실행마다 달랐습니다.

베어메탈에서 실행했습니다(2026-11-17). 실제 Raspberry Pi에서, ghcr.io 자체를 대상으로 Quadlet 자동 업데이트를 수행했습니다.
