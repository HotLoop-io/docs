---
title: "HotLoop 제품: 5개 라인의 8개 제품"
description: "다섯 개 릴리스 라인에 나오는 여덟 제품과 코어 제품별 구성, 사용하는 데이터베이스, 설치 방법, 사이트를 상위 제품으로 올리는 방법을 안내합니다."
---

HotLoop은 현장을 위한 여덟 가지 제품입니다. 사이트와 함께 성장하는 네 가지(IoT, Edge, Gateway, Edge Relay)에, 로직 연결을 맡는 Flow, 워크플로를 맡는 Cascade, PLC 자체 화면을 위한 HotLoop for CODESYS, PLC 값을 네트워크로 내보내는 Transmitter가 더해집니다.

제품은 다섯 개의 릴리스 라인으로 나옵니다. **HotLoop core**는 IoT, Edge, Gateway, Edge Relay로, 네 제품이 하나의 코드와 하나의 태그를 씁니다. 코어 릴리스는 네 제품을 같은 버전으로 동시에 내며, 제품마다 이미지, Helm 차트, Podman Quadlet 유닛이 따로 있습니다. 장비에 맞는 제품을 고르시면 됩니다. 모든 제품이 HotLoop의 모든 프로토콜을 지원하므로, 책상 위의 PLC를 읽으려고 상위 제품으로 올릴 필요가 없습니다. 제품을 가르는 것은 기능이지 프로토콜이 아닙니다.

**Flow**, **Cascade**, **HotLoop for CODESYS**, **Transmitter**는 각자의 라인과 버전이 있어서, Flow 릴리스가 코어를 바꾸는 일은 없고 그 반대도 마찬가지입니다. 표 아래의 내용은 모두 코어에 관한 것입니다. 여덟 제품 각각의 시작점은 다음과 같습니다.

| 제품 | 릴리스 라인 | 문서 | 설치 | 릴리스 노트 | 로드맵 |
|---|---|---|---|---|---|
| **HotLoop IoT** | HotLoop core | <a href="/ko/iot/overview/">문서</a> | <a href="/ko/iot/install/">설치</a> | <a href="/ko/releases/#hotloop-core">노트</a> | <a href="/ko/roadmap/">로드맵</a> |
| **HotLoop Edge** | HotLoop core | <a href="/ko/edge/overview/">문서</a> | <a href="/ko/edge/install/">설치</a> | <a href="/ko/releases/#hotloop-core">노트</a> | <a href="/ko/roadmap/">로드맵</a> |
| **HotLoop Gateway** | HotLoop core | <a href="/ko/gateway/overview/">문서</a> | <a href="/ko/gateway/install/">설치</a> | <a href="/ko/releases/#hotloop-core">노트</a> | <a href="/ko/roadmap/">로드맵</a> |
| **HotLoop Edge Relay** | HotLoop core | <a href="/ko/edge-relay/overview/">문서</a> | <a href="/ko/edge-relay/install/">설치</a> | <a href="/ko/releases/#hotloop-core">노트</a> | <a href="/ko/roadmap/">로드맵</a> |
| **HotLoop Flow** | Flow | <a href="/ko/flow/overview/">문서</a> | <a href="/ko/flow/install/">설치</a> | <a href="/ko/releases/#hotloop-flow">노트</a> | <a href="/ko/flow/roadmap/">로드맵</a> |
| **HotLoop Cascade** | Cascade | <a href="/ko/cascade/overview/">문서</a> | <a href="/ko/cascade/running/">설치</a> | <a href="/ko/releases/#hotloop-cascade">노트</a> | <a href="/ko/cascade/roadmap/">로드맵</a> |
| **HotLoop for CODESYS** | HotLoop for CODESYS | <a href="/ko/codesys/overview/">문서</a> | <a href="/ko/codesys/install/">설치</a> | <a href="/ko/releases/codesys-0-3-10/">노트</a> | <a href="/ko/codesys/roadmap/">로드맵</a> |
| **HotLoop Transmitter** | Transmitter | <a href="/ko/transmitter/overview/">문서</a> | <a href="/ko/transmitter/install/">설치</a> | <a href="/ko/releases/transmitter-1-3-0/">노트</a> | <a href="/ko/transmitter/roadmap/">로드맵</a> |

다음 표는 코어 네 제품을 비교합니다.

| <span class="sr-only">세부 정보</span> | HotLoop IoT | HotLoop Edge | HotLoop Gateway | HotLoop Edge Relay |
|---|---|---|---|---|
| 용도 | 자동화의 기반. Pi, NUC, 캐비닛 속 박스 | 기계 옆 박스. 상위 연결이 끊겨도 계속 동작합니다 | 사이트의 두뇌 | 폴링하고, 전달하고, 살아남습니다. 데이터베이스도 UI도 없습니다 |
| 엔티티, 자동화, 헬퍼, 스크립트, 레시피, 블루프린트, 대시보드, 로그북, 알림, MCP, 디스커버리를 지원하는 MQTT, ISA-18.2 알람, 백업, 모든 드라이버 | 예 | 예 | 예 | 드라이버만 |
| OPC UA 서버, 저장 후 전달을 갖춘 Sparkplug 엣지 퍼블리싱 | | 예 | 예 | 퍼블리싱만 |
| 플릿, 멀티 사이트, 예약 보고서 | | | 예 | |
| 이미지 | `ghcr.io/hotloop-io/hotloop-iot` | `ghcr.io/hotloop-io/hotloop-edge` | `ghcr.io/hotloop-io/hotloop` | `ghcr.io/hotloop-io/hotloop-edge-relay` |
| 차트 | `hotloop-iot` | `hotloop-edge` | `hotloop` | `hotloop-edge-relay` |
| Quadlet 유닛 | `deploy/quadlet/iot/` | `deploy/quadlet/edge/` | `deploy/quadlet/gateway/` | `deploy/quadlet/edge-relay.container` |
| SQLite용 Quadlet 유닛 | `deploy/quadlet/iot/sqlite/` | `deploy/quadlet/edge/sqlite/` | `deploy/quadlet/gateway/sqlite/` | 없음 |
| 차트의 `database.type` | `postgresql` (기본값), `sqlite` | `timescaledb` (기본값), `postgresql`, `sqlite` | `timescaledb` (기본값), `postgresql`, `sqlite` | 없음 |
| 아키텍처 | amd64, arm64, arm/v7 | amd64, arm64, arm/v7 | amd64, arm64 | amd64, arm64, arm/v7 |
| 차트와 Quadlet이 실행하는 데이터베이스 | PostgreSQL 17 | TimescaleDB | TimescaleDB | 없음 |
| 기본으로 보관하는 이력 | 30일 | 90일 | 90일 | 없음 |
| 바이너리가 실행되는 데이터베이스 | SQLite 또는 Postgres | SQLite, Postgres 또는 TimescaleDB | SQLite, Postgres 또는 TimescaleDB | 없음 |

데이터베이스는 이미지가 아니라 설정입니다. `HOTLOOP_DB_TYPE=sqlite`와 `HOTLOOP_DB_PATH`를 지정하면 세 제품 모두 데이터베이스 컨테이너 없이 SQLite 파일 하나로 동작합니다(DEPLOYMENT.md, "SQLite"). 차트는 같은 선택을 `database.type`으로, Quadlet 유닛은 `sqlite/` 디렉터리로 받으며, 각 제품은 위 표의 데이터베이스만 제공합니다. IoT 차트에 `timescaledb`를 요청하면 설치가 실패합니다. 데이터베이스를 바꾸려면 백업을 만들고 복원합니다(BACKUP.md).

Gateway는 4.17.0까지 출시된 이름을 그대로 씁니다. 이미지는 `ghcr.io/hotloop-io/hotloop`, 차트는 `hotloop`입니다. 이미 쓰고 계신 분은 아무것도 바꿀 필요가 없습니다.

## 제품에 들어 있는 것은 바이너리에 들어 있는 것입니다

제품은 설정이 아니라 빌드입니다. `-tags hotloop_iot`는 IoT를, `-tags hotloop_edge`는 Edge를 빌드하고, 태그가 없으면 Gateway가 빌드됩니다. 제품에 없는 기능은 꺼져 있는 것이 아니라 아예 없습니다. IoT 이미지에는 OPC UA 서버가 아예 들어 있지 않으므로 어떤 환경 변수나 values 파일, 어떤 실수로도 켤 수 없습니다.

그래서 작은 제품은 없는 기능을 있는 척하지 않고 분명히 답합니다.

- **API**는 모든 제품에서 모든 경로를 유지합니다. 이 제품에 없는 기능의 경로는 `404`로 응답하고 그 기능을 가진 제품을 알려 줍니다. `{"error":"scheduled reports are part of HotLoop Gateway; this is HotLoop IoT","product":"iot","feature":"reports"}`. `GET /api/status`는 `product`와 `features`를 알려 주므로, 스크립트는 더듬어 보지 않고 물어보면 됩니다.
- **Gateway 전용 설정**이 IoT나 Edge에 남아 있으면(예를 들어 옛 values 파일에서 가져온 `HOTLOOP_REPORTS_ENABLED=true`) 시작할 때와 설정 화면에서 경고하고 HotLoop은 계속 실행됩니다. 만들 수 없는 보고서 때문에 공장 가동을 멈추지 않으며, 경고는 누군가 그것을 보게 해 줍니다.
- **차트**에는 그 설정 자체가 없습니다. `charts/hotloop-iot`에는 `reports`, `opcuaServer`, `edgePublish` 블록이 없고, `hotloop-edge`에는 `reports`가 없습니다. 그래도 설정하면 아무것도 만들어지지 않습니다.
- **`hotloop --product`**는 `iot`, `edge`, `gateway` 중 하나를 출력합니다. 스크립트가 파싱하므로 `--version`은 여전히 버전만 출력합니다.

## 어떤 제품을 고를까

- **Pi, 스마트 플러그, 센서 몇 개, Tasmota와 Zigbee2MQTT가 가득한 MQTT 브로커, 또는 책상 위의 PLC 한 대:** IoT. 이미지가 가장 작고(arm에서 약 29 MB) 일반 PostgreSQL 이미지는 TimescaleDB의 6분의 1이어서, SD 카드에서는 이 숫자가 중요합니다.
- **라인 옆에 고정한 박스로, OPC UA로 SCADA에 데이터를 주거나 Sparkplug로 상위에 게시하며 상위 연결이 끊겨도 버티는 경우:** Edge.
- **사이트 전체: 모든 라인, 일정에 따라 메일로 보내는 보고서, 보고를 올리는 엣지 릴레이, 한 화면에서 보는 여러 사이트:** Gateway.
- **폴링하고 전달만 하면 되고 관리할 데이터베이스가 없어야 하는 박스:** Edge Relay. [Edge Relay 레퍼런스](/ko/edge-relay/reference/)를 참조하세요.

## 크기

이미지는 바이너리에 기본 구성 약 3 MB를 더한 크기입니다.

| <span class="sr-only">세부 정보</span> | amd64 이미지 / 바이너리 | arm64 이미지 / 바이너리 | arm/v7 이미지 / 바이너리 |
|---|---|---|---|
| IoT | 31.2 / 28.0 MB | 29.1 / 26.0 MB | 29.2 / 26.0 MB |
| Edge | 36.5 / 33.3 MB | 34.2 / 31.0 MB | 34.3 / 31.1 MB |
| Gateway | 37.1 / 33.9 MB | 34.8 / 31.6 MB | 빌드 안 함 |
| Edge Relay | 15.7 / 12.5 MB | 14.9 / 11.7 MB | 15.1 / 11.9 MB |

디스크에 놓인 크기입니다. 장치가 없으면 HotLoop은 RSS 약 10 MB, PostgreSQL은 약 12 MB를 쓰는데, 이것은 하한선이지 실제 값이 아닙니다. 장치를 폴링할 때 제품이 쓰는 양은 장치에 따라 달라집니다.

## 설치

### Helm

저장소 하나에 차트 네 개가 모두 있습니다.

```sh
helm repo add hotloop https://hotloop.io/hotloop/

helm install hotloop hotloop/hotloop-iot  --namespace hotloop --create-namespace
helm install hotloop hotloop/hotloop-edge --namespace hotloop --create-namespace
helm install hotloop hotloop/hotloop      --namespace hotloop --create-namespace
```

제품이 무엇이든 릴리스 이름은 `hotloop`으로 하세요. 데이터베이스 볼륨, Secret, Service의 이름이 릴리스 이름을 따르며, 이 이름을 유지해야 나중에 사이트를 상위 제품으로 올릴 수 있습니다(아래 참조).

EmberNet에서는 제품마다 App Store에 별도의 카드가 있습니다. "HotLoop IoT", "HotLoop Edge", "HotLoop Gateway", "HotLoop Edge Relay"입니다. 스토어에서 배포하면 대시보드의 테넌트 레이블이 차트가 만드는 모든 리소스에 들어가고, Running Apps에는 `HotLoop-IoT`, `HotLoop-Edge`, `HotLoop-Gateway`, `HotLoop-Edge-Relay`로 표시됩니다.

### Podman Quadlet

클러스터에 속하지 않은 장비용입니다. `deploy/quadlet/` 아래의 제품 디렉터리마다 유닛이 다섯 개 있습니다. `hotloop.network`, `hotloop.container`(앱), `hotloop-db.container`(차트가 실행하는 것과 같은 이미지와 버전의 데이터베이스), `hotloop-db.volume`, `hotloop-data.volume`입니다. 설치 절차는 각 `hotloop.container`의 머리말에 있고, 나머지는 [Podman Quadlet](/ko/install/quadlet/)에 있습니다.

Podman 5.0 이상이 필요합니다. Raspberry Pi OS Bookworm에는 Quadlet이 아예 없는 4.3이 들어 있으므로, Pi에는 Raspberry Pi OS Trixie 이상이 필요합니다. 앱은 `:stable`을 따르고 Podman의 자동 업데이트가 앱을 옮기며 데이터베이스는 고정됩니다. 방법과 이유는 [Quadlet README](/ko/install/auto-update/)에 있습니다. 어떤 방식으로 설치하든 데이터베이스는 SD 카드가 아니라 USB SSD에 두세요. 이력은 매일 온종일 기록되며, SD 카드는 바로 그 때문에 죽습니다.

## 사이트를 상위 제품으로 올리기

IoT에서 Edge, Gateway로 올려도 모든 장치, 태그, 엔티티, 자동화, 알람, 사용자, 이력이 그대로 남습니다. 모든 제품이 모든 마이그레이션을 실행하므로 세 제품의 데이터베이스 구조가 같고, 상위 제품은 추가 기능이 빈 상태로 시작합니다.

- **Quadlet:** 유닛 이름, 볼륨, 시크릿은 모든 제품 디렉터리에서 같습니다. 상위 제품의 `hotloop.container`와 `hotloop-db.container`를 기존 파일 위에 복사하고 `systemctl daemon-reload`를 실행한 뒤 다시 시작하세요.
- **Helm:** 같은 릴리스에서 `helm upgrade hotloop hotloop/hotloop-edge`(또는 `hotloop/hotloop`)를 실행합니다. 세 차트는 같은 레이블로 파드를 고르고 데이터베이스의 StatefulSet과 볼륨 이름도 같게 짓기 때문에, 업그레이드가 허용되고 볼륨도 그대로 연결됩니다.

먼저 백업을 만들고(`POST /api/backup`, [백업과 복원](/ko/iot/backup/) 참조) 장비 밖으로 복사해 두세요. 이 전환은 Quadlet에서 IoT, Edge, Gateway 순으로 하나의 데이터베이스 볼륨 위에서 각 단계마다 같은 장치를 두고 실행해 보았고, IoT의 PostgreSQL 디렉터리를 Gateway의 TimescaleDB 이미지 아래에서 시작하는 경우와 실제 클러스터의 `helm upgrade`로도 실행해 보았습니다. IoT의 일반 디렉터리에 TimescaleDB 확장이 없으면 전환 후에도 이력은 기본 파티션에 남으며, 하이퍼테이블로 만들려면 백업한 뒤 새 TimescaleDB에 복원해야 합니다. 하위 제품으로 되돌리는 것은 소중한 장비에서 할 일이 아닙니다.

## 릴리스 방식

`v` 태그 하나로 네 제품이 모두 릴리스되므로 IoT, Edge, Gateway, Edge Relay는 항상 같은 버전을 씁니다. 무엇이든 빌드하기 전에 모든 차트의 버전과 이미지가 태그와 일치하는지, 모든 Quadlet 앱 유닛이 헬스체크와 함께 `:stable`을 따르는지, 모든 데이터베이스 유닛이 해당 차트와 일치하며 자동 업데이트되지 않는지 확인합니다. IoT와 Edge 차트는 Gateway 차트에서 생성되므로 한쪽을 고치면 세 곳 모두에 반영됩니다.
