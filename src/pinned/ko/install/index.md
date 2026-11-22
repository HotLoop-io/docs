---
title: "HotLoop 설치"
description: "모든 HotLoop 제품의 설치 방법: k3s 또는 모든 Kubernetes의 Helm, 또는 장비의 Podman Quadlet. stable 태그를 따라 스스로 업데이트하는 장비."
sidebar:
  label: "설치"
---

HotLoop 제품을 제대로 운영하는 방법은 두 가지입니다. k3s 또는 모든 Kubernetes에서 Helm을 쓰거나, 클러스터가 없는 장비에서 Podman과 Quadlet을 쓰는 것입니다. Docker도, Compose도 안 되고, 세션이 끝나면 죽는 셸에서 띄운 `podman run`도 안 됩니다. 간단히 써 보는 데는 `podman run`도 괜찮고 Flow 페이지에도 그렇게 적혀 있지만, 설치는 아닙니다.

## 방법 선택

| 환경 | 사용 | 페이지 |
|---|---|---|
| k3s 또는 Kubernetes 클러스터 | Helm | [k3s와 Helm](/ko/install/helm/) |
| 클러스터 없는 Pi, NUC 또는 소형 산업용 PC | Podman Quadlet | [Podman Quadlet](/ko/install/quadlet/) |
| 둘 중 어느 쪽이든, 업데이트가 어떻게 동작하는지 알고 싶을 때 | | [:stable 자동 업데이트](/ko/install/auto-update/) |

## 오늘 설치할 수 있는 것

| 제품 | 최신 릴리스 | Helm | Quadlet | 시작하기 |
|---|---|---|---|---|
| [HotLoop IoT](/ko/iot/overview/) | {{hotloop}} | 예 | 예 | [IoT 설치](/ko/iot/install/) |
| [HotLoop Edge](/ko/edge/overview/) | {{hotloop}} | 예 | 예 | [Edge 설치](/ko/edge/install/) |
| [HotLoop Gateway](/ko/gateway/overview/) | {{hotloop}} | 예 | 예 | [Gateway 설치](/ko/gateway/install/) |
| [HotLoop Edge Relay](/ko/edge-relay/overview/) | {{hotloop}} | 예 | 예 | [Edge Relay 설치](/ko/edge-relay/install/) |
| [HotLoop Flow](/ko/flow/overview/) | {{flow}} | 예 | 예 | [Flow 설치](/ko/flow/install/) |
| [HotLoop Cascade](/ko/cascade/overview/) | {{cascade}} | 예, 로그인 불필요 | 예, 로그인 불필요, 참고: [Podman Quadlet로 Cascade 실행](/ko/cascade/quadlet/) | [Cascade 실행](/ko/cascade/running/) |
| [HotLoop for CODESYS](/ko/codesys/overview/) | {{codesys}} | 예, 또는 EmberCORE App Store | 아니요 | [HotLoop for CODESYS 설치](/ko/codesys/install/) |
| [HotLoop Transmitter](/ko/transmitter/overview/) | 1.1.0 | 아니요, CODESYS 라이브러리입니다 | 아니요, CODESYS 라이브러리입니다 | [Transmitter 설치](/ko/transmitter/install/) |

HotLoop IoT, Edge, Gateway, Edge Relay는 하나의 태그에서 함께 나오므로 같은 버전 번호를 씁니다. Flow, Cascade, HotLoop for CODESYS, Transmitter는 각자의 버전이 있습니다. IoT, Edge, Gateway의 Quadlet 유닛에는 Podman 5.0 이상이 필요하고, 릴레이 유닛은 Podman 4.9.3에서 실행해 보았습니다. Raspberry Pi OS Bookworm에는 Quadlet이 아예 없는 4.3이 들어 있으므로, Pi에는 Trixie 이상이 필요합니다.

## 실제 공장에 올리기 전에

- [쓰기 관문](/ko/gateway/write-gate/)을 읽어 보세요. 모든 제품에서 같으며, 허용하지 않은 설비는 어떤 것도 움직이지 못하는 이유입니다.
- Pi라면 데이터베이스를 SD 카드가 아닌 USB SSD에 두세요. 이력은 매일 종일 기록되고, SD 카드는 바로 그것 때문에 죽습니다.
- 장치 비밀번호 키를 백업하세요. 데이터베이스에도 백업에도 들어 있지 않으므로 데이터의 일부입니다. 방법은 [백업](/ko/iot/backup/)에 있습니다.
- 사이트를 상위 제품으로 올리거나 릴리스를 넘어 업그레이드하기 전에 백업을 만들고, 장비 밖으로 복사해 두세요.
