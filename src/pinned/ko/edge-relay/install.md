---
title: "Edge Relay Helm·Quadlet"
description: "HotLoop Edge Relay {{hotloop}}를 클러스터에서는 Helm으로, Pi나 산업용 PC에서는 Podman Quadlet systemd 서비스로 실행합니다. 유닛 파일 전체 수록."
sidebar:
  label: "설치"
---

지원하는 방법은 두 가지이며 둘 다 컨테이너이고, 부팅 시 시작하고 죽으면 다시 시작합니다. 클러스터에서는 Helm 차트, 클러스터가 없는 장비에서는 Podman Quadlet 유닛입니다. SSH 세션에서 그냥 실행하는 `podman run`은 이에 해당하지 않습니다. 누군가 로그아웃하면서 컨테이너가 함께 사라지는 순간 엣지 장비가 조용히 전달을 멈추고, 히스토리언에 빈 구간이 생길 때까지 아무도 모르게 되는 것이 바로 그런 경우입니다. Docker 경로도 없습니다.

어느 쪽을 택하든 릴레이에는 두 가지가 필요합니다. 게시할 브로커와 Sparkplug 그룹 id입니다. 이미지는 로그인 없이 가져옵니다.

:::note[4.17.0 또는 4.16.0에서 오시는 경우]
4.17.0부터는 `--reset-then-reuse-values`로 차트를 업그레이드하고, Quadlet 사용자는 4.17.0을 고정하는 대신 `:stable`을 따르는 새 `edge-relay.container`를 받으세요. 릴레이에 관한 부분은 [4.17.0에서 업그레이드](/ko/gateway/upgrading/#the-edge-relay-and-quadlet)에 있습니다. 4.16.0의 릴레이는 아래 두 설치 어느 쪽에서도 푸시된 장치 파일을 받을 수 없었습니다. Gateway는 `config pushed`라고 표시하는데 푸시는 읽기 전용 마운트에서 실패했고, `persistence.enabled=false`는 부팅조차 되지 않았습니다. 4.17.0이 둘 다 고쳤으며, 첫 부팅 때 브로커가 돌려줄 수 있는 오래된 푸시를 포함한 그 부분은 [4.16.0에서 업그레이드](/ko/gateway/upgrading/#the-edge-relay)에 있습니다.
:::

## 장치 파일

두 방법 모두 같은 문서를 읽습니다. 폴링할 장치와 그 장치에서 읽을 태그입니다.

```json
{
  "devices": [
    {
      "id": "press-01",
      "name": "Press 1",
      "protocol": "opcua",
      "address": "opc.tcp://press-01.local:4840",
      "enabled": true,
      "pollIntervalMs": 1000
    }
  ],
  "tags": [
    {
      "deviceId": "press-01",
      "name": "Zone1_Temp",
      "address": "ns=2;s=Zone1.Temp",
      "dataType": "float",
      "enabled": true
    }
  ]
}
```

Gateway의 API가 받는 것과 같은 장치 및 태그 형식이며 같은 규칙으로 검사합니다. 장치에는 HotLoop이 아는 프로토콜이 필요하고, 태그에는 존재하는 장치가 필요합니다. 거기에 더해 릴레이는 두 번 선언된 장치 id와, 한 번도 선언되지 않은 장치를 가리키는 태그를 거부합니다. 손으로 편집한 파일에서 생기는 이 두 가지 실수는 데이터베이스였다면 대신 잡아 주었을 것입니다.

로컬 파일은 시작할 때, 그리고 푸시가 지워질 때 다시 읽습니다. 바꾸고 릴레이를 다시 시작하세요. 일부러 감시하지 않습니다. Gateway에서 푸시된 장치 파일이 실시간으로 적용되는 파일이며, 존재하는 동안은 이 파일보다 우선합니다.

이 파일은 스스로 알리는 장치를 찾기 위해 릴레이가 수신하는 MQTT 브로커의 `discovery` 목록도 담을 수 있으며, 읽기 전용입니다. 형식은 [레퍼런스](/ko/edge-relay/reference/)에 있습니다.

장치의 `config` 블록에는 OPC UA의 `username`과 `password` 같은 자격 증명이 들어갈 수 있습니다. 이것들은 그 파일에 평문으로 있고, 릴레이에는 이를 가려 줄 API가 없으므로 파일을 어디에 두는지가 중요합니다. 아래의 두 경로 모두 이를 다룹니다.

## Helm

```bash
helm repo add hotloop https://hotloop.io/hotloop
helm repo update
helm install press-line-3 hotloop/hotloop-edge-relay \
  --version {{hotloop}} --namespace hotloop --create-namespace \
  --set edgePublish.broker=tcp://gateway.plant.local:1883 \
  --set edgePublish.group=Plant1 \
  --set edgePublish.node=press-line-3 \
  -f devices.yaml
```

`edgePublish.broker`와 `edgePublish.group`은 필수이며, 이 둘이 없으면 차트가 렌더링을 거부합니다. `edgePublish.node`도 설정하세요. 비워 두면 파드의 호스트 이름이 되는데, Deployment의 파드는 교체될 때마다 새 이름을 받습니다. 다음 노드 드레인 뒤에는 Gateway의 플릿과 상위의 모든 Sparkplug 호스트가 완전히 새로운 엣지 노드를 보게 되고, 등록해 둔 노드는 오프라인으로 표시됩니다.

브로커 비밀번호는 `edgePublish.password`에 넣거나, `edgePublish.existingSecret`에 `password` 키가 있는 Secret의 이름을 지정하세요. 브로커가 TLS를 쓰면 `edgePublish.tls`를 켜세요.

`devices.yaml`에는 장치 파일과 같은 두 목록이 `devices:`와 `tags:` 아래에 들어갑니다.

```yaml
devices:
  - id: press-01
    name: Press 1
    protocol: opcua
    address: "opc.tcp://press-01.local:4840"
    enabled: true
    pollIntervalMs: 1000
tags:
  - deviceId: press-01
    name: Zone1_Temp
    address: "ns=2;s=Zone1.Temp"
    dataType: float
    enabled: true
```

이 값들은 ConfigMap과 Helm 릴리스 기록에 남으며, 네임스페이스에서 ConfigMap을 읽을 수 있는 누구나 읽을 수 있습니다. 장치에 비밀번호가 있다면 장치 파일 전체를 `devices.json` 키의 Secret에 넣고 대신 그것을 지정하세요. Secret이 ConfigMap 대신 마운트되며 `devices`와 `tags`는 무시됩니다.

```bash
kubectl -n hotloop create secret generic press-devices --from-file=devices.json
helm upgrade press-line-3 hotloop/hotloop-edge-relay --version {{hotloop}} \
  --reset-then-reuse-values --set devicesSecret=press-devices
```

`--reuse-values`가 아니라 `--reset-then-reuse-values`입니다. 일반 옵션은 릴리스가 이미 가진 값을 그대로 다시 적용하고 새 차트가 추가한 기본값을 건너뜁니다. 4.16.0에 설치된 릴레이에서 실행하면 `pushedDevicesFile`이 빠지고, 푸시가 다시 읽기 전용 마운트에서 실패하는데 아무것도 실패하지 않아 알려 주지 않습니다.

설치 안내문은 그러면 장치가 구성되지 않았다고 경고합니다. 일부러 비워 둔 차트의 `devices` 목록을 세기 때문입니다. 대신 `/status`를 확인하세요.

```bash
kubectl -n hotloop logs deploy/press-line-3
kubectl -n hotloop port-forward svc/press-line-3 8081:8081
curl localhost:8081/status
```

### 전달 큐와 그 볼륨

전달 큐는 자체 PVC에 있으며 기본 크기는 256Mi(`persistence.size`)이므로, 파드가 옮겨 가도 버퍼링된 값이 살아남습니다. 같은 볼륨이 `/data/opcua-client-pki`에 OPC UA 클라이언트 인증서와 그 신뢰 저장소도 보관하므로, 보안 서버가 릴레이를 재시작할 때마다가 아니라 한 번만 신뢰하면 됩니다.

`edgePublish.queueMaxBytes`의 기본값은 64 MiB(`67108864`)이며, 예전에는 제한 없는 `0`이었습니다. 상한을 넘으면 가장 오래된 값이 버려지고 집계됩니다. 이는 약 248,000개의 값, 초당 2,000개일 때 약 2분에 해당하므로 직접 측정한 속도를 바탕으로 크기를 정하세요. 짧은 태그 이름 기준으로 값 하나에 약 240바이트이며(Edge 4.21.1의 같은 큐에서 측정), `persistence.size`보다 넉넉히 작게 두세요. `0`으로 설정하면 다시 제한이 없어지고, 브로커 장애가 충분히 길면 오래된 값을 버리는 대신 볼륨이 가득 차며, 가득 찬 볼륨은 첫 번째 장애 위에 쌓이는 두 번째 장애이고, 설치 안내문도 그렇게 말합니다. `--reuse-values`로 업그레이드한 릴레이는 가지고 있던 값을 유지합니다.

`persistence.enabled=false`는 4.17.0부터 부팅됩니다(4.16.0에서는 부팅 시 릴레이를 죽였습니다). `/data`에 `persistence.size`로 용량이 제한된 emptyDir이 생깁니다. 선택하기 전에 그 비용을 알아 두세요. 파드가 교체될 때마다(노드 드레인, 축출, `kubectl delete pod`, 파드를 롤링하는 `helm upgrade`) 전달 큐와 그 안에 버퍼링된 모든 값, 푸시된 장치 파일(릴레이가 조용히 차트의 `devices`로 돌아갑니다), OPC UA 클라이언트 인증서를 잃으며, 그래서 모든 보안 서버가 릴레이를 다시 신뢰해야 합니다. 설치 안내문이 그 경고를 출력합니다. 시험용으로는 괜찮습니다. 값이 중요한 릴레이라면 PVC를 유지하세요.

푸시된 장치 파일은 같은 볼륨의 `/data/pushed-devices.json`(차트 값의 `pushedDevicesFile`)에 있으며, 존재하는 동안은 재시작, 재스케줄, `devices`를 바꾸는 `helm upgrade`를 거쳐도 차트의 `devices`보다 우선합니다. 릴레이는 어느 파일로 부팅했는지 로그에 남깁니다. 차트의 목록으로 돌아가려면 릴레이가 연결된 동안 Gateway에서 `DELETE /api/fleet/{id}/config`로 푸시를 지우세요. 그러면 즉시 차트의 목록으로 전환됩니다. 푸시는 재시작 없이 실시간으로도 적용됩니다.

## Quadlet

클러스터 밖의 Pi나 산업용 PC용입니다. Quadlet은 컨테이너를 진짜 systemd 서비스로 만듭니다. 아무도 로그인하지 않아도 부팅 시 시작하고, 죽으면 다시 시작하며, 저널에 로그를 남깁니다. 이 유닛은 Podman 4.9.3에서 실행해 보았고, 키는 Podman 5.8.6의 `quadlet` 바이너리로 확인했습니다. Raspberry Pi OS Bookworm은 Quadlet이 아예 없는 4.3을 제공하므로 Trixie 이상을 쓰세요.

유닛과 그 데이터 볼륨은 HotLoop 저장소의 `deploy/quadlet/`에 `devices.example.json`과 함께 있습니다. 먼저 디렉터리를 만드세요.

```bash
sudo mkdir -p /etc/containers/systemd /etc/edge-relay
```

이것을 `/etc/containers/systemd/edge-relay.container`로 저장하고, 이 장비에 맞게 브로커, 그룹, 노드를 바꾸세요.

```ini
[Unit]
Description=HotLoop Edge Relay
Documentation=https://docs.hotloop.io/edge-relay/reference/
After=network-online.target
Wants=network-online.target

[Container]
# Every box tracks :stable, so this line never needs editing.
Image=ghcr.io/hotloop-io/hotloop-edge-relay:stable
AutoUpdate=registry
ContainerName=edge-relay

# The image has no shell or curl, so the binary asks itself. A JSON array,
# not a string, because a string runs through /bin/sh -c and there isn't one.
HealthCmd=["/edge-relay", "--healthcheck"]
HealthInterval=10s
HealthRetries=3
HealthStartPeriod=20s
Notify=healthy
# Podman 4.9 reads Notify=healthy as plain true. Without this line a broken
# release is not rolled back there.
PodmanArgs=--sdnotify=healthy

# The image digest, written by the ExecStartPre below, for the Gateway's fleet list.
EnvironmentFile=/run/edge-relay/relay.env

Environment=HOTLOOP_EDGE_PUBLISH_BROKER=tcp://gateway.example.local:1883
Environment=HOTLOOP_EDGE_PUBLISH_GROUP=Plant1
Environment=HOTLOOP_EDGE_PUBLISH_NODE=press-line-3
# The outage queue's limit, 64 MiB.
Environment=HOTLOOP_EDGE_PUBLISH_QUEUE_MAX_BYTES=67108864
Environment=HOTLOOP_EDGE_RELAY_DEVICES_FILE=/etc/edge-relay/devices.json
# Where a pushed device file lands, instead of failing on the read-only
# mount below. It wins over the file above for as long as it exists.
Environment=HOTLOOP_EDGE_RELAY_PUSHED_FILE=/data/pushed-devices.json
Environment=HOTLOOP_LOG_LEVEL=info

# Delete this line if the broker takes anonymous connections.
Secret=edge-relay-broker-password,type=env,target=HOTLOOP_EDGE_PUBLISH_PASSWORD

Volume=/etc/edge-relay/devices.json:/etc/edge-relay/devices.json:ro,Z
Volume=edge-relay-data.volume:/data

# Only reachable from this host. /status has no auth, on purpose.
PublishPort=127.0.0.1:8081:8081

User=65532:65532
ReadOnly=true
Tmpfs=/tmp
NoNewPrivileges=true
DropCapability=all

[Service]
Restart=always
RestartSec=5
# Exit status 75 is a relay stopping because an operator approved an update.
SuccessExitStatus=75

RuntimeDirectory=edge-relay
ExecStartPre=/bin/sh -c '/usr/bin/podman image exists ghcr.io/hotloop-io/hotloop-edge-relay:stable || /usr/bin/podman pull ghcr.io/hotloop-io/hotloop-edge-relay:stable'
ExecStartPre=/bin/sh -c 'echo HOTLOOP_IMAGE_DIGEST=$$(/usr/bin/podman image inspect --format "{{.Digest}}" ghcr.io/hotloop-io/hotloop-edge-relay:stable) > /run/edge-relay/relay.env'

# A bad image fails three healthchecks in about a minute, and then it is rolled back.
TimeoutStartSec=120

[Install]
WantedBy=multi-user.target
```

그리고 이것을 `/etc/containers/systemd/edge-relay-data.volume`으로 저장하세요. 전달 큐와 푸시된 장치 파일을 보관합니다. `podman system prune`을 견디도록, 그리고 chown 없이 소유권이 컨테이너의 비 root 사용자와 맞도록 이름 있는 볼륨으로 만들었습니다.

```ini
[Volume]
```

장치 파일을 `/etc/edge-relay/devices.json`에 두고 다음을 실행하세요.

```bash
printf '%s' 'your-broker-password' | \
  sudo podman secret create edge-relay-broker-password -
sudo systemctl daemon-reload
sudo systemctl start edge-relay.service
sudo systemctl status edge-relay.service
curl localhost:8081/status
```

브로커가 익명 연결을 받나요? 시크릿을 건너뛰고 `Secret=` 줄을 지우세요. 격리된 OT 네트워크에서는 이것이 우회해야 할 실수가 아니라 실제 구성입니다. 장치 파일 마운트의 `:Z`는 SELinux용이며 SELinux가 없는 배포판에서는 무해합니다.

장비에서 장치를 바꾸려면 파일을 편집한 뒤 `sudo systemctl restart edge-relay.service`를 실행하세요. Gateway에서 푸시한 장치 파일은 실시간으로 적용되므로 그럴 필요가 없습니다. 푸시가 적용되어 있는 동안에는 그것이 릴레이가 실행하고 부팅하는 기준이므로, Gateway에서 `DELETE /api/fleet/{id}/config`로 푸시를 지우기 전까지는 로컬 파일을 편집해도 아무 일도 일어나지 않습니다. 뭔가 이상해 보이면 무엇보다 먼저 `sudo journalctl -u edge-relay.service`를 보세요. 릴레이가 어느 파일을 쓰고 있는지, 왜 장치 파일이나 푸시를 거부했는지 알려 주며, 그것을 읽는 편이 JSON을 의심하는 것보다 빠릅니다.

### 업데이트

유닛은 `:stable`을 따르며, Podman은 타이머가 켜져 있으면 이를 갱신합니다.

```bash
sudo systemctl enable --now podman-auto-update.timer
```

타이머가 울리면 Podman이 `:stable`을 가져오고, 다이제스트가 바뀌었으면 새 이미지로 유닛을 다시 시작합니다. 릴레이 자체의 헬스체크를 통과하기 전까지는 유닛이 올라온 것으로 보지 않으므로, 새 이미지가 끝내 통과하지 못하면 Podman이 이전 이미지로 되돌려 시작합니다. 시작되지 않는 릴리스는 한 장비에서 몇 분을 잃게 할 뿐, 꺼진 채로 남는 릴레이가 되지 않습니다. 전달 큐와 푸시된 장치 파일은 새 이미지가 건드리지 않는 데이터 볼륨에 있습니다. Gateway의 플릿 목록은 각 릴레이의 버전과 이미지 다이제스트를 보여 주고, 하나가 바뀌면 한 줄을 로그에 남깁니다.

Podman은 실행될 때 장비의 라벨이 붙은 모든 컨테이너를 갱신하며, 이것만이 아닙니다. 사람이 시점을 정하기를 원하는 사이트에는 둘 다 `deploy/quadlet/`에 있는 두 가지 선택 사항이 있습니다. `edge-relay-hold.conf`는 Gateway의 관리자가 `POST /api/fleet/{id}/update`로 승인할 때까지 업데이트를 보류하며, 장비 전체에서 타이머를 꺼야 합니다. `update-window.conf`는 일요일 03:00 같은 창에서만 타이머가 울리게 합니다. Gateway는 업데이트가 대기 중이라는 것은 알려 주지 못하고, 각 릴레이가 지금 무엇을 실행 중인지만 알려 줍니다. 보류는 실제 업데이트를 30초 동안 붙잡았다가 승인에 따라 적용하는 방식으로 실행해 보았고, 할 수 있는 일과 할 수 없는 일은 레퍼런스 페이지 [릴레이 업데이트](/ko/edge-relay/reference/#updating-a-relay)에 모두 있습니다.

## 그다음: Gateway에서 관리하기

플릿 관리는 켜기 전까지 Gateway에서 꺼져 있습니다. 릴레이가 없는 Gateway에는 가리킬 브로커가 없기 때문입니다. `HOTLOOP_FLEET_ENABLED`를 `true`로 설정하고, 릴레이가 게시하는 것과 같은 브로커를 `HOTLOOP_FLEET_BROKER`로 지정하세요. 필요하면 `HOTLOOP_FLEET_USER`, `HOTLOOP_FLEET_PASSWORD`, `HOTLOOP_FLEET_TLS`도 지정합니다. Gateway 차트에는 플릿 전용 값이 없으므로 `extraEnv`에 넣습니다.

```yaml
extraEnv:
  - name: HOTLOOP_FLEET_ENABLED
    value: "true"
  - name: HOTLOOP_FLEET_BROKER
    value: tcp://gateway.plant.local:1883
```

그다음 각 릴레이를 그룹과 노드로 등록하세요. 등록은 의도된 절차입니다. 브로커에 그냥 나타난 릴레이는 누군가 그렇다고 말하기 전까지 플릿 구성원이 아닙니다. `fleet.write` 권한이 있는 사용자로 이것을 `/api/fleet`에 `POST`하세요.

```json
{
  "id": "press-line-3",
  "name": "Press line 3",
  "group": "Plant1",
  "nodeId": "press-line-3",
  "statusUrl": "http://press-line-3.hotloop.svc:8081"
}
```

`statusUrl`은 선택 사항입니다. 없으면 Gateway는 탄생과 죽음 메시지로 온라인과 오프라인을 압니다. 있으면 Gateway가 릴레이의 `/status`도 폴링해 큐 깊이와 장치 수를 확인하며, 닿지 않는 릴레이는 정상적인 0이 아니라 도달 불가로 표시됩니다. 위의 Quadlet 유닛은 8081을 `127.0.0.1`에만 게시하므로, 다른 장비의 Gateway는 `PublishPort=`를 바꾸기 전까지 `/status`에 닿을 수 없고, 바꾸면 그 네트워크의 누구나 닿을 수 있게 됩니다.

그때부터 Gateway는 릴레이를 추적하며 `POST /api/fleet/{id}/rebirth`, `POST /api/fleet/{id}/restart`, `POST /api/fleet/{id}/update`, `POST /api/fleet/{id}/config`를 보낼 수 있습니다. 마지막 것이 푸시이며 4.17.0부터 도착하고 4.16.0에서는 한 번도 도착하지 않았으며, 4.18.10부터 실시간으로 적용됩니다. `DELETE /api/fleet/{id}/config`는 푸시를 지우며, 릴레이는 즉시 로컬 파일로 돌아갑니다. 이 모든 것은 API 전용이며 Gateway UI에 플릿 화면은 없습니다. 이 중 어느 것이든 의존하기 전에, Gateway만 명령과 장치 파일을 게시할 수 있도록 브로커의 ACL을 잠그세요. 이유는 [개요](/ko/edge-relay/overview/#누가-명령할-수-있는가)에 있습니다.
