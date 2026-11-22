---
title: "Flow를 Podman·Helm으로 설치"
description: "Podman이나 Quadlet, Helm을 쓰는 Kubernetes, 또는 소스로 HotLoop Flow {{flow}}를 실행합니다. 잠긴 채로 시작하므로 관리자 비밀번호를 먼저 설정하세요."
sidebar:
  label: "설치"
---

HotLoop Flow {{flow}}가 현재 버전입니다. `ghcr.io/hotloop-io/hotloop-flow:{{flow}}`로 제공되며 amd64와 arm64용 이미지(amd64 이미지는 2.8.0에서 Podman 기준 45.64 MB였습니다), 그리고 Helm 차트와 직접 빌드할 수 있는 소스가 함께 제공됩니다. 2.9.0, 2.9.1, 2.10.0, 2.11.0, 2.12.0, 2.13.0, 2.14.0, 2.15.0, 2.16.0, 2.16.2, 2.16.3, 2.16.4, 2.16.5, {{flow}}는 amd64 전용이고, 2.10.2, 2.11.1, 2.12.1, 2.13.1, 2.14.1, 2.15.1, 2.16.1은 amd64와 arm64용으로 빌드됩니다(2.10.1은 차트만 있고 이미지가 없으므로 절대 고정하지 마십시오). 따라서 2.13.1에 머물러 있던 Pi나 arm64 장비는 2.16.1로 옮길 수 있습니다. 이미지는 distroless이고 루트가 아닌 사용자로 실행되며 안에 셸이 없으므로, 본인에게도 들어와서는 안 되는 누구에게도 들어갈 곳이 없습니다. 이 페이지에는 Docker나 Compose 경로가 없습니다. 장비 한 대에는 Podman, 서비스로 만들려면 Quadlet, 클러스터에는 Helm을 씁니다.

Flow는 잠긴 채로 시작합니다. 플로가 명령을 실행할 수 있으므로 관리자 계정 없이는 실행을 거부합니다. 그리고 플로와 함께 저장되는 모든 브로커와 데이터베이스 비밀번호를 암호화하는 자격 증명 시크릿 없이도 실행을 거부합니다. 아래 모든 경로에서 둘 다 설정합니다.

2.2.0부터 컨텍스트와 지속형 연결은 데이터 볼륨의 SQLite 파일 `state.db`에 저장되므로, 재시작해도 더 이상 지워지지 않습니다. 그 볼륨을 보존하십시오. 차트에서 `persistence.enabled`가 false이면 컨테이너 재시작에는 살아남지만 파드 교체에는 살아남지 못합니다.

## Podman

먼저 비밀번호 해시를 만드십시오. 이미지에는 셸이 없으므로 해시는 바이너리 자체의 하위 명령이며, 8자 미만은 거부합니다.

```bash
podman run --rm ghcr.io/hotloop-io/hotloop-flow:{{flow}} hash-password -password 'something-long'
```

그다음 자격 증명 시크릿을 만들고, 1년 뒤에도 찾을 수 있는 곳에 저장하십시오.

```bash
openssl rand -hex 32
```

그런 다음 실행합니다. bcrypt 해시에는 달러 기호가 가득해서 셸이 먹어 버리므로 두 값 모두 작은따옴표 안에 넣습니다.

```bash
podman run -d --name hotloop-flow -p 1880:1880 -v hotloop-flow-data:/data \
  -e HOTLOOP_FLOW_ADMIN_USER=admin \
  -e HOTLOOP_FLOW_ADMIN_PASSWORD_HASH='<the hash>' \
  -e HOTLOOP_FLOW_CREDENTIAL_SECRET='<the secret>' \
  ghcr.io/hotloop-io/hotloop-flow:{{flow}}
```

`http://localhost:1880/`을 열고 `admin`으로 로그인합니다. `/health`는 프로세스가 올라오면 버전으로 응답하고, `/ready`는 런타임이 실제로 시작되었는지 알려 줍니다.

그 시크릿을 보관하십시오. Flow가 볼륨에 암호화해 둔 모든 것은 그 시크릿으로만 읽을 수 있습니다. 다른 시크릿으로 컨테이너를 다시 만들면 저장된 모든 브로커 비밀번호가 사라지며, MQTT 인증이 멈추기 전까지는 깨끗한 시작과 똑같아 보입니다.

## Quadlet

부팅할 때 시작하고 스스로 재시작하는 서비스를 위한 방법입니다. Podman 4.4 이상이 필요합니다. 시크릿은 본인만 읽을 수 있는 파일에 두십시오.

```bash
mkdir -p ~/.config/hotloop-flow ~/.config/containers/systemd
umask 077
cat > ~/.config/hotloop-flow/hotloop-flow.env <<'EOF'
HOTLOOP_FLOW_ADMIN_USER=admin
HOTLOOP_FLOW_ADMIN_PASSWORD_HASH=<the hash>
HOTLOOP_FLOW_CREDENTIAL_SECRET=<the secret>
EOF
```

그다음 systemd에 컨테이너를 기술합니다. 다음을 `~/.config/containers/systemd/hotloop-flow.container`로 저장하십시오.

```ini
[Unit]
Description=HotLoop Flow
After=network-online.target
Wants=network-online.target

[Container]
Image=ghcr.io/hotloop-io/hotloop-flow:{{flow}}
ContainerName=hotloop-flow
PublishPort=1880:1880
Volume=hotloop-flow-data:/data
EnvironmentFile=%h/.config/hotloop-flow/hotloop-flow.env

[Service]
Restart=always

[Install]
WantedBy=default.target
```

```bash
systemctl --user daemon-reload
systemctl --user start hotloop-flow
```

사용자 서비스는 계정에 lingering이 켜져 있어야만 부팅 때 시작하고 로그아웃 이후에도 유지됩니다. `loginctl enable-linger`입니다. 이것을 건너뛰면 로그아웃하거나 장비가 재부팅될 때까지는 잘 돌아갑니다.

## Helm

이 차트는 k3s를 포함한 모든 Kubernetes에서 동작합니다.

```bash
helm repo add hotloop-flow https://hotloop.io/hotloop-flow/
helm install line3-flows hotloop-flow/hotloop-flow
```

차트는 처음 설치할 때 관리자 비밀번호와 자격 증명 시크릿을 생성하고, 업그레이드할 때마다 기존 Secret에서 둘 다 다시 읽으므로 업그레이드가 저장된 자격 증명 밑에서 시크릿을 바꿔 버리는 일이 없습니다. 설치 안내문에 비밀번호를 읽는 방법이 출력됩니다. 위의 릴리스라면 다음과 같습니다.

```bash
kubectl get secret line3-flows-auth -o jsonpath='{.data.admin-password}' | base64 -d
kubectl port-forward svc/line3-flows 1880:8080
```

사용자는 `admin`입니다. 2.0.2 이전에는 생성된 그 비밀번호가 전혀 동작하지 않았는데, 앱이 확인하는 해시가 차트가 저장한 것과 다른 무작위 비밀번호로 만들어졌기 때문입니다. 그렇게 설치된 릴리스를 업그레이드하면 그 자리에서 고쳐지며, 비밀번호와 자격 증명 시크릿은 바뀌지 않습니다.

릴리스 하나는 인스턴스 하나이며, 차트는 일부러 `replicaCount: 1`로 고정합니다. 인스턴스마다 플로 상태와 브로커 및 PLC에 대한 실시간 연결을 갖습니다. 하나의 Service 뒤에 파드가 둘이면 둘 다 구독하고 둘 다 기록하므로, InfluxDB가 모든 측정값을 조용히 두 번 저장하게 됩니다. 더 돌리려면 자체 플로를 가진 다른 릴리스를 설치하십시오. 두 릴리스가 하나의 작업을 나눠 맡을 수도 있으며, 리스를 통해 한 번에 하나만 장비에 쓰게 합니다. [리스를 쓰는 웜 스탠바이](/ko/flow/failover/)입니다.

작게 만든 것도 의도입니다. 기본 `resources.preset`은 `small`이며 CPU 10m와 메모리 64Mi를 요청합니다. Flow 프로세스는 유휴 시 상주 메모리 16.6 MiB로 측정되었으므로, 64Mi의 여유가 있는 엣지 노드에도 스케줄되지만, node-red 차트의 기본 요청 512Mi는 Pending에 머물 것입니다.

파드는 읽기 전용 루트 파일 시스템에서 uid 65532로 실행되고, 권한 상승이 없으며, `RuntimeDefault` seccomp가 적용되고, 디스커버리를 포함해 모든 Linux 기능이 제거됩니다. 2.0.4까지는 디스커버리가 켜지면 차트가 `NET_RAW`와 `NET_ADMIN`을 추가했는데, 아무도 작성한 적 없는 ARP 스윕을 위한 것이었습니다. 2.0.5에서 이를 중단했으며, 설정해 둔 값은 바꿀 필요가 없습니다.

차트에는 세 가지 네트워크 모드가 있습니다.

| 모드 | 얻는 것 | 노드당 인스턴스 |
|---|---|---|
| `cluster` | ClusterIP와 클러스터가 라우팅하는 모든 것. 기본값이며 2계층이 필요하지 않다면 맞는 선택입니다. | 제한 없음 |
| `host` | 호스트의 인터페이스, ARP 테이블, 브로드캐스트 도메인. | 하나. 포트가 노드의 것이기 때문입니다 |
| `macvlan` | 대상 VLAN의 자체 MAC과 IP로, PLC가 있는 세그먼트에 바로 놓입니다. Multus가 필요합니다. | 제한 없음 |

`macvlan`이 모드가 존재하는 이유입니다. 클러스터가 라우팅해 주는 것만 보이는 파드에서 PLC 네트워크를 스캔하는 것은 의미가 없기 때문입니다. 여러 인스턴스에 안전하고 그 세그먼트에 바로 위치하며, 인스턴스마다 자기 주소를 가지므로 포트 충돌이 없습니다. [Flow README](https://github.com/HotLoop-io/hotloop-flow#deploying-on-kubernetes)에 모드와 리소스 프리셋이 모두 나와 있습니다.

:::note[차트를 실행해 본 곳]
차트는 노드 네 개짜리 k3s 클러스터에서 기본 `cluster` 네트워크 모드로 설치해 확인했습니다. 로그인, API를 통해 배포한 플로, 파드를 재시작해도 유지되는 그 플로, 업그레이드, 그리고 Fleet을 통한 EmberNet App Store 배포까지 확인했습니다. `host`와 `macvlan` 모드는 렌더링되고 lint를 통과하며 잘못 구성하면 거부되고, 실제 장비에서 실행했습니다(2026-11-17).
:::

## 탭당 VLAN 하나

2.9.0부터 탭, 서브플로, 또는 노드 하나가 연결을 네트워크 인터페이스에 묶을 수 있으므로, 장비마다 VLAN 하나씩을 한 포트로 나르는 박스에서 Flow 하나가 장비마다 탭 하나를 둘 수 있습니다. 모든 VLAN이 같은 서브넷과 같은 장치 주소를 가져도 마찬가지입니다. 탭 방식은 탭에 `FLOW_NETWORK_INTERFACE` 환경 변수를 두는 것이며, 그 안의 모든 클라이언트 노드가 이를 상속합니다. 2.9.1은 같은 필드를 `modbus-server` 노드에 추가하여, 서버 두 대가 같은 주소와 포트에서 VLAN마다 하나씩 수신할 수 있게 했습니다.

파드가 VLAN 인터페이스를 볼 수 있어야 하므로 호스트 네트워크로 실행하십시오. 차트에서는 `network.mode: host`, Quadlet 유닛에서는 `Network=host`입니다. 소켓을 인터페이스에 바인딩하는 데는 Linux 5.7 이상에서 어떤 기능도 필요하지 않습니다. 더 오래된 커널에서는 `CAP_NET_RAW`가 필요하며, 차트 값 `bindToInterface.netRaw`(기본값 `false`)가 그 기능 하나만 추가합니다. `192.168.1.0/24`를 공유하는 네트워크 네임스페이스 두 개로 이루어진 실험실에서 검증했으며, 생산 현장의 실제 네트워크에서는 아무것도 실행하지 않았습니다.

## EmberNet App Store에서

이것은 필요하지 않으며, Flow를 실행하는 데 EmberNet 단계는 어디에도 없습니다. 다만 차트에는 EmberNet App Store가 찾는 레이블이 달려 있어서, 이미 EmberCORE를 운영하신다면 Flow가 카탈로그에 있고 타일로 표시됩니다.

자체 클러스터를 쓰는 테넌트의 경우 EmberCORE가 Fleet을 통해 배포하며, EmberCORE 4.9.37 이상이 필요합니다. 이전 버전은 아무것도 설치하지 않는 Fleet 번들을 만들었습니다. Flow 2.0.3부터 차트는 만드는 모든 것에 EmberCORE의 테넌트 레이블을 붙입니다.

2.0.4부터 배포된 타일에 이름과 아이콘이 제대로 표시됩니다. 파드와 Service에 `embernet.ai/app-icon` 어노테이션이 달려 있고 기본값은 차트 자체의 아이콘이므로, EmberCORE가 릴리스 이름으로 아이콘을 추측하지 않습니다. 추측은 한 번도 맞은 적이 없었습니다. 직접 쓰려면 `embernet.appIcon`을 설정하고 `Access-Control-Allow-Origin`과 함께 제공하십시오. 그러지 않으면 타일이 비어 나옵니다. `embernet.ai/app-name` 레이블은 이제 릴리스 이름이 아니라 차트 이름입니다. 인스턴스는 여전히 `app.kubernetes.io/instance`와 Service 이름에 있고 셀렉터는 바뀌지 않았으므로 제자리 업그레이드는 문제없습니다.

[릴리스 노트](https://hotloop.io/releases/flow/)에 0.1.0까지의 모든 버전이 있습니다.

## 소스에서

Go와 Node가 필요합니다. 편집기를 먼저 빌드해 `go:embed`로 바이너리에 포함하므로, 이것 없이 Go 빌드를 하면 편집기 없는 바이너리를 내놓는 대신 패턴을 찾지 못해 실패합니다.

```bash
git clone https://github.com/HotLoop-io/hotloop-flow.git
cd hotloop-flow
(cd web && npm ci && npm run build)
go build -o hotloop-flow ./cmd/hotloop-flow
```

기본 데이터 디렉터리는 `/data`로, 컨테이너에서는 맞지만 노트북에서는 원하는 값이 아닐 것이므로 다른 곳을 가리키게 하십시오.

```bash
export HOTLOOP_FLOW_DATA_DIR=./data
export HOTLOOP_FLOW_ADMIN_USER=admin
export HOTLOOP_FLOW_ADMIN_PASSWORD_HASH="$(./hotloop-flow hash-password -password 'something-long')"
export HOTLOOP_FLOW_CREDENTIAL_SECRET='<the secret>'
./hotloop-flow
```

## Emberwire 0.1.0에서 오시는 경우

2.x는 의도한 깔끔한 단절입니다. 0.1.0에는 깨뜨릴 사용자가 없었고, 사용자가 없는 호환 계층은 버그가 자리 잡을 곳일 뿐입니다. `EMBERWIRE_*` 변수는 이제 `HOTLOOP_FLOW_*`이고, 데이터베이스 구성 노드 유형 두 개는 `hotloop-flow-influxdb`와 `hotloop-flow-postgres`이며, WASM 모듈은 `hotloop_flow_*`를 내보내고, 지표는 `hotloop_flow_*`이고, 배포 헤더는 `HotLoop-Flow-Deployment-Rev`입니다.

0.1.0의 자격 증명 파일은 읽을 수 없습니다. 2.0.1부터 Flow는 시작할 때 이를 알려 줍니다. 파일 이름을 밝히고, Emberwire가 쓴 파일임을 말하며, 옆으로 치워 두고 자격 증명을 다시 입력하라고 안내합니다. 0.1.0 이미지는 여전히 `ghcr.io/embernet-ai/emberwire:0.1.0`에 있으며, [릴리스 노트](https://hotloop.io/releases/flow/)에 모든 단절이 나열되어 있습니다.
