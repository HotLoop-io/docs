---
title: "Edge Relay 참조"
description: "폴링 후 전달하는 헤드리스 Sparkplug B 노드: 하는 일, 모든 설정, 디스크 기반 큐, 플릿 구성, 배포 방법을 설명합니다."
---

Edge Relay는 4.6.0부터 별도의 두 번째 바이너리로 단독 실행됩니다. 데이터베이스, 웹 UI, 인증, 쓰기 경로가 없는 폴링 후 전달 방식의 Sparkplug B 엣지 노드입니다. Pi나 엣지의 소형 산업용 PC에서 실행하도록 만들어졌으며, 읽은 모든 데이터를 4.5.0에서 추가된 것과 같은 Sparkplug B 퍼블리셔를 통해, 실제 데이터베이스가 있는 곳에서 실행되는 전체 Gateway로 전달합니다.

4.5.0의 릴리스 노트에도 이렇게 적혀 있었습니다. Edge Publish는 전체 Gateway 프로세스 안에서 켤 수 있는 기능으로 존재했으며, "독립 실행형의 더 가벼운 Edge Relay 에디션은 아직 아니었습니다." 이것이 바로 그 에디션입니다.

## 아닌 것

**더 적은 옵션을 가진 작은 Gateway가 아닙니다.** 의존성이 훨씬 적은 별개의 바이너리입니다. 데이터베이스, 웹 UI, 인증, MCP 서버나 클라이언트, 자동화 엔진, 엔티티 레지스트리가 없습니다.

**UI 제공, 쓰기 수락, MCP 도구 호출 응답은 할 수 없습니다.** 세 가지 모두 이 바이너리가 의도적으로 갖지 않는 것, 즉 작업의 주체로 기록할 인증된 신원이 필요합니다. Edge Relay는 아무것도 결정하지 않고 사람에게 아무것도 확인해 주지 않으며, 읽고 전달만 합니다.

**데이터베이스로 구성하지 않으며, 자체 구성 API도 없습니다.** 장치와 태그는 시작할 때 읽는 로컬 JSON 파일에서 오거나, Gateway가 브로커를 통해 푸시하는 파일에서 오며, 푸시한 파일은 즉시 적용됩니다([구성 푸시](#구성-푸시-480) 참조). 새 구성을 받으려고 Relay에서 대기하는 것은 없습니다. 유일한 경로는 Relay가 이미 밖으로 연결해 둔 브로커 연결입니다.

## 구조

내부적으로는 Gateway의 실제 폴링 엔진을 다시 구현하지 않고 그대로 재사용합니다. Gateway의 일부로 운영 환경에서 실행되어 온 워커, 재연결과 백오프, 폴링 루프 코드가 여기서도 그대로 실행됩니다. 다른 점은 *구성과 이력이 어디로 가는가*입니다.

폴링 이후의 모든 단계, 즉 드라이버, 태그 버스, Sparkplug 퍼블리셔, 디스크의 전달 큐는 `HOTLOOP_EDGE_PUBLISH_ENABLED`가 설정되었을 때 Gateway가 쓰는 코드와 완전히 같습니다. 이 퍼블리셔가 실제로 하는 일, 즉 Birth, 시퀀스 번호, 장애 중 버퍼링, 재연결 시 재전송은 Edge Publish 페이지를 참조하십시오. 여기서는 그중 어느 것도 바뀌지 않았으며, 이 바이너리는 같은 `Offer()` 호출에 도달하는 다른 길일 뿐입니다.

## 장치 파일

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

태그는 Gateway의 태그가 지원하는 모든 것을 지원하며 `noData`도 포함됩니다. 이는 "측정값 없음"을 뜻하는 원시 값의 목록(레코더의 0x8005 등)으로, 각각 이유가 붙어 있어서 죽은 채널이 숫자로 보이지 않고 Relay와 Sparkplug 스트림에서 불량으로 읽힙니다. [데이터 없음 값](/ko/iot/protocols/#no-data-values)을 참조하십시오.

Gateway의 프로토콜 드라이버 일곱 가지가 모두 포함되어 있습니다. OPC UA, Modbus, MQTT/Sparkplug B, EtherNet/IP, S7comm, MTConnect, HTTP입니다. 장치 파일 형식에는 Edge Relay 전용인 부분이 없습니다.

### 디스커버리 (4.18.10)

Relay는 Gateway처럼 MQTT 브로커에서 스스로 알리는 장치를 수신하고([MQTT 디스커버리](/ko/iot/mqtt-discovery/) 참조), 들리는 것을 읽어 전달할 수 있습니다. 장치 파일에 브로커를 지정하십시오.

```json
{
  "devices": [],
  "tags": [],
  "discovery": [
    {
      "id": "yard",
      "broker": "10.0.0.5:1883",
      "username": "hotloop",
      "password": "...",
      "prefix": "homeassistant",
      "listenOnly": true,
      "tasmota": true,
      "shelly": true
    }
  ]
}
```

`id`는 소문자, 숫자, `-`로 이루어진 1자에서 63자이며 `embedded`는 안 됩니다. `broker`, `username`, `password`, `useTls`, `insecureSkipVerify`는 Gateway의 설정, MQTT에서 받는 값과 같고 같은 코드로 검증됩니다. `prefix`의 기본값은 `homeassistant`이며 `tasmota`와 `shelly`는 기본적으로 켜져 있습니다. 브로커를 지정하지 않은 파일은 Relay의 동작을 전혀 바꾸지 않습니다.

들은 내용은 장치와 태그가 되며, Gateway가 실행하는 것과 같은 코드(`homeassistant/` 형식, Tasmota 자체 형식, Shelly 상태)로 만들어지고, 다른 장치와 똑같이 폴링되어 Sparkplug로 전달됩니다. 장치 id는 브로커의 id와 장치가 밝히는 신원으로 만들어지며 항상 같은 값(`disc-<identity>-<hash>`)이므로, 재시작한 Relay도 메트릭 이름이 같습니다. 장치는 알린 뒤 몇 초 만에 나타나고, 철회된 장치는 Rebirth 때 노드의 Birth에서 빠지며, 어느 쪽도 Sparkplug 세션이나 전달 큐에 영향을 주지 않습니다. 브로커를 추가하거나 제거하는 푸시 파일도 즉시 적용됩니다.

**디스커버리로 찾은 것은 어느 것도 쓰기 가능 상태로 만들 수 없습니다.** 점검이 그렇게 말해서가 아닙니다. 디스커버리가 만드는 모든 태그는 Gateway와 마찬가지로 읽기 전용이고, 만들어진 모든 장치는 수락되지 않은 상태이며, Relay에는 수락할 사람이 없고, Relay에는 쓰기 경로 자체가 없으므로 발견된 지점이든 다른 어떤 지점이든 명령은 장치에 닿기 전에 거부됩니다. 이를 검증하는 테스트는 쓰기가 허용된 Relay에 발견된 펌프를 켜도록 요청하고 펌프의 명령 토픽이 조용했는지 확인합니다.

명령할 수 있는 장치는 반대 방향으로 Relay에 도달합니다. Gateway에서 장치를 수락하고, 의도한 지점을 무장한 다음 파일을 푸시합니다. 파일에 Relay도 듣고 있는 장치(같은 브로커 id 또는 같은 주소와 같은 신원)가 있으면 파일의 것이 우선하고 발견된 사본은 만들어지지 않으므로, 한 장치가 두 번 전달되는 일은 없습니다.

`listenOnly`는 끄지 않는 한 켜져 있으며, 켜져 있으면 Relay는 그 브로커에 아무것도 게시하지 않습니다. 퍼블리셔가 다시 자신을 알리게 하는 Birth 메시지도, Shelly의 `status_update`도, Tasmota의 전원 조회도 보내지 않습니다. 변할 때만 말하는 장치는 말할 때까지 알 수 없음으로 읽힙니다. 끄면 이것들만 DISCOVERY.md에 적힌 토픽으로 전송됩니다.

Relay는 들은 내용을 아무것도 보관하지 않습니다. `homeassistant/`와 Tasmota 구성은 브로커에 retained로 남아 있어 Relay가 시작할 때 돌아오며, Shelly는 무언가 바뀔 때마다 상태를 알리므로 Relay 시작 후 조용했던 장치는 말을 할 때까지 나타나지 않습니다. 이 점과, 수락한 장치를 기억할 데이터베이스가 없다는 점이 Gateway와의 차이입니다.

`/status`는 `discovery` 아래에 브로커별로 수신 중이고 연결되어 있는지, 받은 메시지, 버린 메시지, 거부한 메시지 수, 문제의 수, 그리고 디스커버리가 만든 장치와 태그의 수를 알려 줍니다. 브로커가 어디에 있는지, 문제가 어느 토픽에서 났는지는 알려 주지 않습니다.

### 장치 파일의 자격 증명 (4.15.0)

Relay의 OPC UA 드라이버는 Gateway의 것이므로 장치는 `config` 블록에 OPC UA `username`과 `password`(그리고 [프로토콜과 드라이버](/ko/iot/protocols/#opc-ua-security-and-credentials)의 보안 옵션)를 담을 수 있고, 다른 프로토콜의 장치도 마찬가지입니다(MQTT와 HTTP 비밀번호, HTTP 헤더, 주소 안의 자격 증명). 이 값들은 장치 파일에 평문으로 들어 있고 Relay에는 이를 가려 줄 API가 없으므로(4.15.1에서 Gateway에 추가된 API 가림 처리는 Relay에 적용되지 않습니다. [인증과 사용자](/ko/iot/authentication/#자격-증명이-여전히-평문인-곳) 참조), 파일을 어디에 두는지가 중요합니다.

- **Helm 차트에서는 `devicesSecret`을 사용하십시오.** 차트의 `devices`와 `tags` 값에 설정한 장치는 ConfigMap으로 렌더링되며, 네임스페이스에서 ConfigMap을 읽을 수 있는 누구나 읽을 수 있고 Helm 릴리스 기록에도 남습니다. 자격 증명이 있는 장치라면 장치 파일 전체를 `devices.json` 키로 Secret에 넣고 `devicesSecret`에 그 이름을 지정하십시오. 그러면 ConfigMap 대신 Secret이 마운트되고 ConfigMap은 만들어지지 않습니다.
- **푸시한 장치 파일에도 들어 있습니다.** `POST /api/fleet/{id}/config`로 푸시한 파일은 MQTT 토픽에 retained로 게시되므로, 브로커는 TLS를 사용해야 하고 `hotloop/edge-relay-config/#`를 읽을 수 있는 대상을 제한해야 합니다. 그렇지 않으면 이 토픽을 구독할 수 있는 누구나 그 안의 모든 자격 증명을 읽을 수 있습니다. Relay는 푸시된 파일을 데이터 볼륨의 `0600` 모드로 기록합니다(차트와 Quadlet 유닛 모두 `/data/pushed-devices.json`). 따라서 Secret이 아니라 PVC에도 남습니다.
- **보안이 적용된 OPC UA 장치는 인증서와 신뢰 저장소를 유지합니다.** 이들은 전달 큐와 같은 영속 볼륨의 `/data/opcua-client-pki`(`HOTLOOP_OPCUA_CLIENT_PKI_DIR`)에 있습니다. 차트의 영속성을 끄면 emptyDir이 되어 새 Pod가 생길 때마다 새 인증서가 만들어지고 보안이 적용된 모든 서버가 다시 신뢰해야 합니다(아래 "영속성 끄기" 참조). 보안이 없는 채널의 익명 장치는 상관이 없습니다. 서버의 인증서를 승인하는 방법은 Gateway와 같으며, Relay의 볼륨에서 `rejected/`를 `trusted/`로 옮기면 됩니다.

## 원격 명령 (4.7.0)

두 가지 Sparkplug NCMD 명령이 있으며, 둘 다 이 Relay가 이미 밖으로 연결해 둔 같은 연결을 사용하므로 인바운드 연결이 필요 없습니다.

- **재시작**(`Node Control/Reboot`), 4.7.0부터: Relay가 스스로 정상적인 NDEATH를 게시하고 종료하며, 감독자(Quadlet 유닛의 `Restart=always` 또는 Deployment의 기본 `restartPolicy: Always`)가 다시 시작해 줍니다.

- **업데이트**(`Node Control/Update`): 업데이트를 보류 중인 Relay에 대해 운영자가 이미지 업데이트를 승인하는 명령입니다. 업데이트를 보류하도록 설정된 Relay에만 효과가 있습니다. [Relay 업데이트](#relay-업데이트)를 참조하십시오.

Relay 쪽에는 누가 이 명령을 보낼 수 있는지 결정하는 장치가 없습니다. 이를 보내는 Gateway 측 플릿 관리자와, 실제 인가 경계인 브로커 ACL 요구 사항은 플릿 관리 페이지를 참조하십시오.

## Relay 업데이트

Relay는 Gateway가 업데이트하지 않습니다. 할 수 없습니다. Gateway는 해당 장비에 접근할 방법이 없고 Relay는 자기 컨테이너를 교체할 수 없으므로, "원격 업데이트"는 설치 방식 두 가지에서 서로 다른 의미를 가지며, 이 페이지는 각각을 밝힙니다. 플랫폼이 지킬 수 없는 약속은 없는 것보다 나쁘기 때문입니다.

**규칙은 모든 HotLoop 장비가 따르는 것과 같습니다. `:stable`을 따라가고, 절대 고정하지 않습니다.** `4.17.0`에 고정된 Relay는 누군가 설치한 날 그대로의 버전이며, 현장에 다시 가서 올려 줄 사람은 없습니다. 그래서 Relay가 따르는 이미지는 `ghcr.io/hotloop-io/hotloop-edge-relay:stable`이고, 릴리스마다 이 태그가 이동합니다. 다른 점은 누가 Relay를 재시작해 그 이미지로 옮기는가입니다.

### Quadlet(Pi 또는 소형 산업용 PC): 스스로 업데이트합니다

[`deploy/quadlet`](/ko/install/quadlet/)의 유닛은 `:stable`을 따르며 Podman의 자동 업데이트가 찾는 레이블을 갖고 있습니다. 장비마다 한 번 타이머를 켜십시오.

```sh
sudo systemctl enable --now podman-auto-update.timer
```

타이머가 작동하면 Podman이 `:stable`을 가져오고 다이제스트가 바뀌었으면 새 이미지로 유닛을 재시작합니다. 세 가지 덕분에 그대로 두어도 안전하며, 세 가지 모두 읽어서 아니라 실제로 실행해서 확인했습니다.

- **돌아오지 못하는 Relay는 원상 복구됩니다.** 유닛에는 헬스체크(`/edge-relay --healthcheck`, 이미지에 셸이나 curl이 없기 때문)가 있고, 이것이 통과할 때까지 systemd에 아직 올라오지 않았다고 알립니다. 새 이미지가 끝내 통과하지 못하면 Podman은 이전 이미지를 `:stable` 아래로 되돌리고 그것을 시작합니다. 시작할 수 없는 릴리스는 한 장비에서 몇 분이 걸릴 뿐이며, 계속 멈춰 있는 Relay로 이어지지 않습니다. Podman 4.9(Ubuntu 24.04)에서는 `Notify=healthy`만으로는 이렇게 되지 않습니다. 단순한 `true`로 읽혀서 컨테이너가 시작되는 즉시 Relay가 올라온 것으로 처리되고, Relay가 죽어 있는데도 Podman은 업데이트가 성공했다고 보고합니다. 그래서 유닛은 `--sdnotify=healthy`를 명시적으로 설정합니다.
- **Gateway는 모든 업데이트를 봅니다.** Relay는 모든 Birth에 자신의 버전과 이미지 다이제스트를 담습니다. Gateway의 플릿 목록에는 Relay별로 둘 다 표시되며, 바뀌면 시스템 로그에 이전 값, 현재 값, 두 다이제스트를 기록합니다. 이것이 감사 기록이며, 장비에서 작업한 운영자를 포함해 어떤 원인의 업데이트든 포함합니다.
- **업데이트는 데이터를 건드리지 않습니다.** 전달 큐와 푸시된 장치 파일은 새 이미지가 건드리지 않는 데이터 볼륨에 있습니다. 잃는 것은 Relay가 재시작하는 동안의 폴링뿐이며 길어야 몇 초입니다.

Relay가 보고하는 다이제스트는 해당 장비에서 `podman image inspect --format '{{.Digest}}'`가 출력하는 값이며, 자동 업데이트가 따르는 것도 이 값입니다. 레지스트리가 Podman이 다루는 것과 다른 매니페스트 형식을 저장하면 Podman은 이미지 하나를 여러 다이제스트로 알 수 있으므로(`RepoDigests` 아래에 나열됨), 레지스트리 헤더와 비교하지 말고 모든 Relay에서 같은 방법으로 비교하십시오.

### Quadlet, 운영자가 승인할 때까지 업데이트 보류(선택 사항)

어떤 현장에서는 시점을 직접 정하고 싶어 합니다. 교대 근무 중에 끊길 수 없는 라인의 Relay가 그렇습니다. 이를 위한 것이 systemd 드롭인 `edge-relay-hold.conf`이며, 기본값이 되는 일은 없습니다. 이를 적용하면 Relay는 `"updateMode": "approve"`를 보고하고, 타이머는 꺼지며, 관리자가 Gateway에서 `POST /api/fleet/{id}/update`를 보내기 전에는 아무것도 업데이트되지 않습니다. 그러면 Relay는 종료 상태 75로 나가고, systemd가 현재 가진 이미지로 다시 시작하며, 별도의 작업이 Relay가 정상이 될 때까지 기다렸다가 `podman auto-update`를 실행합니다. 새 이미지가 있으면 같은 롤백이 적용된 채 새 이미지로 가고, 없으면 쓸데없이 한 번 끊긴 Relay가 됩니다. 실제 업데이트를 30초 동안 보류하면서 Relay는 영향 없이 실행되었고, 이후 승인에 따라 적용되는 것으로 검증했습니다.

비용을 알아 두십시오. Podman의 자동 업데이트는 레이블이 붙은 모든 컨테이너에 작용하며 하나만 건너뛰게 할 수 없으므로, 타이머는 장비 전체에서 꺼져 있어야 합니다. 다른 용도로 타이머를 돌려야 하는 장비에서는 이 Relay를 보류할 수 없습니다. 또한 Gateway는 업데이트가 대기 중이라는 사실은 알려 줄 수 없고 각 Relay가 지금 실행 중인 것만 알려 주므로, 승인하기 전에 플릿 목록을 `:stable`의 현재 내용과 비교하십시오. 승인에는 이미지가 담기지 않습니다. Relay는 자신의 유닛이 따르는 것으로만 업데이트하도록 지시받을 수 있습니다.

### Helm: `helm upgrade`를 직접 실행합니다

Pod는 스스로를 교체할 수 없고 Deployment는 Helm이 바꾸는 것이므로, 차트에는 원격 업데이트가 없습니다. 차트의 `image.tag` 기본값은 릴리스인 `appVersion`이므로 다음과 같이 합니다.

```sh
helm repo update
helm upgrade edge-relay hotloop/hotloop-edge-relay --reuse-values
```

이렇게 하면 Pod가 새 릴리스로 롤링됩니다. 차트의 전략은 새 Pod를 시작하기 전에 이전 Pod를 멈추므로(`maxSurge: 0`, 전달 큐가 한 볼륨의 단일 쓰기 파일이기 때문입니다) 올라오는 동안 공백이 있습니다. Gateway는 Relay의 다음 Birth에서 새 버전을 확인하고 변경을 기록합니다. Helm에서는 Relay가 이미지 다이제스트를 보고하지 않으며(컨테이너는 자기 다이제스트를 볼 수 없고 Kubernetes도 전달해 주지 않습니다), 버전만 보고합니다. `Node Control/Update`는 여기서 아무 일도 하지 않으며 Relay가 로그에 그렇게 남깁니다. Helm이 곧 승인입니다.

### 여기에 없는 것과 그 이유

- **서명된 이미지와 다이제스트 허용 목록.** Gateway는 접근할 방법이 없는 장비에서 이를 강제할 수 없고, Relay가 스스로에게 하는 검사는 침해된 Relay가 건너뛰는 검사입니다. Podman은 가져올 때 서명을 검증할 수 있으며(`policy.json`), 그곳이 실제로 작동하는 자리입니다. 여기서는 그 정책을 설정해 주지 않으며, `:stable`은 다른 모든 태그와 같은 수준으로 신뢰됩니다.
- **단계적 롤아웃.** 한 장비의 모든 Relay는 각자의 타이머로 같은 태그를 따르므로, 플릿은 단계적이 아니라 타이머의 분산 범위 안에서 업데이트되며, 위의 롤백이 문제 있는 릴리스의 영향을 제한합니다. 의도적으로 단계를 나누려면 기다려야 하는 현장을 보류 드롭인으로 잡아 두고 원하는 순서로 승인하십시오.

## 구성 푸시 (4.8.0)

새 장치 파일은 별도의 일반(Sparkplug가 아닌) retained MQTT 토픽으로 푸시할 수 있습니다. Gateway 쪽은 플릿 관리 페이지의 "구성 푸시" 절을 참조하십시오. 4.17까지는 푸시가 파일을 준비만 했고, Relay는 무언가 재시작할 때까지 이전 목록을 계속 폴링했습니다. 그래서 Relay가 폴링하는 대상이 바뀔 때마다 Relay, 브로커 세션, 그리고 보유한 모든 장치 세션이 재시작되었으며, 몇 달씩 손대지 않고 두어야 할 장비에서는 부담이었습니다. 이제 푸시는 도착하는 즉시 적용됩니다.

- 이 Relay가 **실행 중일 때** 푸시된 경우: 부팅 시 `LoadDeviceFile`이 적용하는 것과 같은 규칙으로 바이트를 검증하고, `HOTLOOP_EDGE_RELAY_PUSHED_FILE`(설정되지 않았다면 `HOTLOOP_EDGE_RELAY_DEVICES_FILE`을 덮어씀, 아래 참조)에 저장한 뒤 즉시 적용합니다. 저장을 먼저 하는 것은 의도적입니다. 실행은 되었지만 저장되지 않은 목록은 다음 부팅에서 조용히 되돌아가기 때문입니다.
- **잘못된 푸시는 거부되며 이전 목록이 계속 실행됩니다.** 파싱되지 않거나, 검증을 통과하지 못하거나(중복 장치, 선언되지 않은 장치의 태그, 알 수 없는 프로토콜), 저장할 수 없는 푸시는 아무것도 바꾸지 않습니다. 실행 중인 장치도, 디스크의 파일도 그대로입니다. 로그에 이유가 남고, Gateway의 플릿 화면이 가져가는 `/status`의 `config.rejected`에도 남습니다.
- 이 Relay가 **오프라인일 때** 푸시된 경우: 다음 부팅까지 받을 대상이 없습니다. 부팅 시 Relay는 로컬 장치 파일을 불러오기 *전에* retained 푸시가 도착하도록 몇 초 기다리므로, 곧바로 그 파일로 부팅합니다. 그 몇 초가 지나 도착한 푸시는 다른 푸시와 같이 즉시 적용됩니다.
- 브로커는 재연결할 때마다 retained 푸시를 다시 전달합니다. Relay는 실행 중인 파일을 sha256으로 알고 있으므로, 같은 바이트가 다시 도착해도 아무것도 바뀌지 않습니다.

### 즉시 적용이 유지하는 것과 바꾸는 것

Relay는 실행 중인 파일과 새 파일의 차이를 장치별로 계산하고, 바뀐 것만 건드립니다.

- **바뀌지 않은 장치는 세션을 유지합니다.** PLC와의 같은 TCP 연결, 같은 OPC UA 구독이며 읽기에 공백이 없습니다.
- **바뀐 장치**(주소, 프로토콜, 폴링 간격, 타임아웃, config 블록 또는 태그)는 새 정의로 다시 연결됩니다.
- **새 장치**는 연결되어 폴링을 시작합니다.
- **제거된 장치**(또는 `"enabled": false`가 된 장치)는 연결이 끊어집니다.
- **Sparkplug 세션은 유지됩니다.** NDEATH도 재연결도 없고, bdSeq도 같으며, 전달 큐는 건드리지 않습니다. 브로커 장애 중에 다시 불러와도 버퍼링된 모든 읽기값은 큐에 남아 있고, 브로커가 돌아오면 다시 불러오지 않았을 때와 똑같이 빠져나갑니다.

전송 단계에서는 Sparkplug B를 따릅니다. Relay는 하나의 엣지 노드이고 모든 태그는 `device/tag`라는 이름의 노드 메트릭이므로 바뀌는 것은 노드의 메트릭 집합이며, Sparkplug는 노드에 이를 바꾸는 방법을 정확히 하나만 줍니다. 마지막 NBIRTH를 통째로 대체하는 새 NBIRTH입니다. 그래서 다음과 같습니다.

- **사라진 메트릭**(제거된 장치, 제거되거나 비활성화된 태그)은 NDATA로 한 번 더 null로 전송되고, 이후 노드는 그것들 없이 Rebirth합니다. 같은 세션, 같은 bdSeq, seq는 0으로 돌아가며, `Node Control/Rebirth`를 받았을 때와 같은 Rebirth입니다. null을 보내는 이유는, 호스트가 새 Birth에서 빠진 메트릭의 마지막 값을 유지해도 되며 Gateway 자신의 Sparkplug 호스트가 실제로 그렇게 하기 때문입니다. null이 없으면 Relay에서 떼어 낸 밸브가 마지막 정상 읽기값에 영원히 남아 정상인 것처럼 보일 것입니다.
- **새 메트릭**은 해당 장치의 첫 폴링 때 Birth에 포함되며, 부팅 시 모든 메트릭이 포함되는 방식과 같습니다. Birth는 읽기값이 뒷받침되기 전에는 메트릭을 이름으로 올리지 않습니다.
- **제거된 태그의 읽기값 중 전달 큐에 남은 것**은 큐가 비워질 때 버려지며, 그 개수를 세는 로그 한 줄이 남습니다. 노드의 Birth에는 더 이상 그 메트릭이 없고 Sparkplug에는 없는 메트릭을 보낼 합법적인 방법이 없으므로, 보내면 어떤 호스트도 들은 적 없는 별칭을 보내는 셈이 됩니다.

로컬 장치 파일을 직접 편집하면 여전히 재시작이 필요합니다. Relay는 이 파일을 부팅할 때와 푸시가 해제될 때 읽으며 감시하지 않습니다. 차트에서는 `devices`를 바꾸는 `helm upgrade`가 어차피 그 역할을 합니다.

### 푸시된 파일의 위치와 우선하는 파일

지원되는 두 설치 방식 모두 로컬 장치 파일을 읽기 전용으로 마운트합니다. 차트는 ConfigMap(또는 Secret)에서, Quadlet 유닛은 `:ro` 바인드로 마운트하며, 둘 다 읽기 전용 루트 파일시스템 위에 있습니다. 4.16.0까지는 Relay가 푸시를 그 파일 바로 옆에 기록했기 때문에, 두 설치 방식 모두에서 모든 푸시가 다음 오류로 실패했습니다.

```
a pushed config was rejected; keeping the current one and continuing to run
error="write /etc/edge-relay/devices.json.tmp: open /etc/edge-relay/devices.json.tmp: read-only file system"
```

그리고 Relay는 이전 목록을 계속 폴링했습니다. Gateway는 `config pushed`라고 했고 재시작도 이루어졌지만 아무것도 바뀌지 않았습니다. 푸시에 자체 위치를 주는 것으로 해결되었습니다.

- **`HOTLOOP_EDGE_RELAY_PUSHED_FILE`**은 푸시가 기록되는 위치입니다. 차트는 이를 PVC의 `/data/pushed-devices.json`으로 설정하며(values.yaml의 `pushedDevicesFile`), Quadlet 유닛도 이름 있는 데이터 볼륨에 같은 경로로 설정합니다. 둘 다 컨테이너보다 오래 가며 PVC는 재스케줄링 후에도 유지됩니다. 이는 의도된 것입니다. emptyDir도 쓰기는 가능하지만 Pod가 이동하는 순간 사라지며, 노드 드레인 뒤에 Relay가 조용히 이전 장치 목록으로 돌아가는 것은 같은 버그가 모양만 바뀐 것입니다.
- **푸시된 파일이 우선합니다.** 부팅 시 Relay는 푸시된 파일이 있으면 그것을 불러오고, 없을 때만 로컬 파일을 불러옵니다. 이는 재시작 후에도, 재스케줄링 후에도, 브로커가 retained 푸시를 잃은 뒤(영속성 없는 Mosquitto 재시작)에도, `devices`나 `tags`를 바꾸는 `helm upgrade` 후에도 유지됩니다. 푸시는 더 새롭고 의도적인 변경이며, 어차피 브로커가 다음 부팅 때 retained 사본을 그대로 돌려줄 것이므로 로컬 파일을 우선하면 한 번의 재시작 동안만 유지될 것입니다. 로그의 첫 줄들은 어느 파일로 부팅했는지 알려 줍니다. `booting from the pushed device file; the local one is ignored until the push is cleared`
- **로컬 파일로 돌아가기**(차트의 `devices` 또는 Quadlet의 `/etc/edge-relay/devices.json`)는 Gateway에서 `DELETE /api/fleet/{id}/config`를 실행하는 것입니다. 삭제하면 브로커의 retained 푸시가 지워져 이후 부팅에서는 적용되지 않으며, 그 시점에 연결되어 있는 Relay는 로컬 파일을 불러오고 푸시된 파일을 삭제하고 `the config push was cleared; the local device file takes over`를 로그에 남기며, 푸시가 적용되는 것과 같은 방식으로 로컬 파일을 즉시 적용합니다. 로컬 파일을 불러올 수 없으면 Relay는 푸시된 파일을 실행 상태와 디스크에 그대로 두고 로그와 `/status`에 그렇게 알립니다. 먼저 지우면 다음 재시작에서 손상된 파일로 부팅하는 Relay가 되기 때문입니다. 로컬 파일을 고치고 삭제를 다시 보내십시오. Relay가 **온라인일 때** 하십시오. 해제는 retained되지 않으므로, 그동안 오프라인이던 Relay는 해제를 듣지 못하고 푸시된 파일을 유지합니다. Relay를 올리고 삭제를 다시 보내십시오. 반복해도 안전합니다.
- 푸시된 파일이 있지만 불러올 수 없는 경우(디스크 오류, 또는 더 엄격한 규칙을 가진 이후 릴리스)는 오류로 기록되며, Relay는 멈춰 있지 않고 로컬 파일로 부팅합니다.
- `HOTLOOP_EDGE_RELAY_PUSHED_FILE`이 설정되지 않으면 푸시는 `HOTLOOP_EDGE_RELAY_DEVICES_FILE` 자체를 덮어쓰며, 이는 4.8.0의 동작입니다. 쓰기 가능한 장치 파일이 있는 바이너리 단독 실행에서만 쓸 만하며, 이 경우 해제 시 버릴 별도의 사본이 없습니다.

푸시가 "적용되지 않았다면" 무엇보다 먼저 Relay의 로그를 보십시오. 어느 파일로 부팅했는지 나와 있거나, 푸시가 왜 거부되었는지 나와 있습니다.

## HTTP 인터페이스

엔드포인트는 두 개이며 둘 다 인증이 없고 둘 다 읽기 전용입니다.

- `GET /healthz`, 프로세스가 살아 있음을 뜻합니다. 그 이상은 아닙니다. 장치의 연결이 끊어진 것이 이 프로세스가 비정상이라는 뜻은 아닙니다.
- `GET /status`, 스냅샷입니다. 연결 상태별 장치 수, 태그 수, 전달 큐의 현재 깊이, 포함된 프로토콜 목록, 그리고 `uplink`가 있습니다. 이 항목은 브로커 연결 여부, 재전송 진행 여부, 전달 큐가 보유한 양과 디스크 크기, 한도에서 버린 양을 알려 줍니다(Edge Publish 페이지의 "업링크가 끊겼을 때" 참조). 태그 값도, 장치 주소도, 구성도 없습니다. 이것은 모니터링용이며 Gateway 대시보드의 축소판이 아닙니다. `version`, `imageDigest`, `updateMode`는 어떤 빌드인지, 업데이트를 보류하는지를 알려 줍니다. 또한 어느 장치 파일이 실행 중인지를 `config` 아래에 알려 줍니다. `source`(`local` 또는 `pushed`), `path`, sha256 `digest`, `appliedAt`, 그리고 Relay가 마지막으로 거부한 파일과 그 이유인 `rejected`이며, 이후 푸시가 적용되면 사라집니다. 파일이 아니라 다이제스트를 알려 주므로, 인증이 없는 포트로 파일의 주소와 자격 증명이 나가지 않고도 Gateway는 푸시한 것과 대조할 수 있습니다. 파일에 `discovery` 브로커가 있으면 `discovery` 아래에 각 브로커의 상태와 찾은 장치 수도 알려 줍니다([디스커버리](#디스커버리-41810) 참조).

두 엔드포인트 앞에 의도적으로 인증을 두지 않았습니다. Edge Relay에는 사용자 데이터베이스도, 세션 저장소도, 인증 체계를 만들 신원 시스템도 없으며, 민감한 것을 전혀 노출하지 않는 엔드포인트 두 개에 공유 토큰 하나를 붙이는 것은 보안이 아니라 연극이 되기 때문입니다. 장치 자체가 속한 네트워크 경계 뒤에서 실행하십시오. 신뢰할 수 있는 프록시 뒤에 배포할 때 Gateway의 `auth.insecure` 모드가 이미 문서화하고 있는 것과 같은 전제입니다.

## 구성

| 변수 | 기본값 | <span class="sr-only">Details</span> |
|---|---|---|
| `HOTLOOP_EDGE_RELAY_DEVICES_FILE` | 해당 없음 | 필수입니다. 위 장치 파일의 경로 |
| `HOTLOOP_EDGE_RELAY_PUSHED_FILE` | 설정 안 함 | 푸시된 장치 파일이 보관되는 위치이며, 존재하는 동안은 위의 파일보다 우선합니다. 쓰기가 가능하고 영속적이어야 합니다. 차트와 Quadlet 유닛은 `/data/pushed-devices.json`을 사용합니다. [푸시된 파일의 위치](#푸시된-파일의-위치와-우선하는-파일) 참조 |
| `HOTLOOP_EDGE_RELAY_LISTEN_ADDR` | `:8081` | `/healthz`와 `/status` 서버 |
| `HOTLOOP_EDGE_RELAY_UPDATE_MODE` | `auto` | `auto`는 업데이트를 감독자에게 맡기고 Gateway의 승인을 무시합니다. `approve`는 승인이 올 때까지 업데이트를 보류합니다. [Relay 업데이트](#relay-업데이트) 참조 |
| `HOTLOOP_IMAGE_DIGEST` | 설정 안 함 | 이 Relay가 실행되는 이미지의 다이제스트이며, 감독자가 아는 값입니다. Quadlet 유닛이 매번 시작하기 전에 설정합니다. `/status`와 모든 Birth에 보고되며, 비어 있어도 괜찮습니다 |
| `HOTLOOP_LOG_LEVEL` | `info` | |
| `HOTLOOP_POLL_INTERVAL` | `5s` | 기본 폴링 간격. 장치 자체의 `pollIntervalMs`가 우선합니다 |
| `HOTLOOP_MIN_POLL_INTERVAL` | `100ms` | 장치 자체의 설정과 관계없이 모든 장치에 적용되는 하한 |
| `HOTLOOP_POLL_TIMEOUT` | `10s` | 기본 폴링별 타임아웃. 장치 자체의 `timeoutMs`가 우선합니다 |
| `HOTLOOP_MAX_CONCURRENT_POLLS` | `32` | 동시에 폴링 중일 수 있는 장치 수 |
| `HOTLOOP_RECONNECT_MIN` / `HOTLOOP_RECONNECT_MAX` | `1s` / `60s` | 재연결 시도 사이의 백오프 한계이며 지터가 적용됩니다 |
| `HOTLOOP_RING_SIZE` | `120` | `/status` 인근 진단용으로 태그별로 보관하는 샘플 수 |
| `HOTLOOP_OPCUA_CLIENT_PKI_DIR` | `/data/opcua-client-pki` | OPC UA 드라이버의 인증서와 `trusted/`, `rejected/` 저장소입니다. 장치 자체의 `pkiDir`이 우선합니다. 보안이 적용된 OPC UA 장치만 사용합니다 |

변수 이름과 기본값은 Gateway 자체의 `RuntimeConfig`와 같습니다. 같은 설정을 Helm 값으로 표현한 것은 k3s와 Helm 페이지의 "폴링" 절을 참조하십시오. 두 바이너리가 이 구성을 같은 `config.LoadRuntimeConfig()` 함수로 불러오기 때문이며, 어긋날 수 있는 두 개의 사본이 아닙니다.

그리고 Edge Publish 페이지에 문서화된 모든 `HOTLOOP_EDGE_PUBLISH_*` 변수가 있으며, 한 가지 차이가 있습니다. `HOTLOOP_EDGE_PUBLISH_ENABLED`는 무시되고 전달은 항상 켜져 있습니다. 읽은 것을 게시하는 것이 이 바이너리의 존재 이유이므로, Gateway에서처럼 선택 사항인 기능이 아닙니다.

## 검증된 것과 그렇지 않은 것

HotLoop는 실제 장비와 실제 서버를 대상으로 실행했으며, 2026-11-17에는 실제 장비에서도 실행했습니다.

## 배포

지원되는 경로는 두 가지이며 둘 다 컨테이너입니다. 세션이 끝나면 죽는 셸에서 실행하는 맨 `podman run`은 없고 Docker도 없습니다.

- **`charts/hotloop-edge-relay`**, k3s Helm 차트이며 Gateway 자체의 차트(`charts/hotloop`)와 별개입니다. Edge Relay는 전달 대상인 Gateway보다 작은 별도의 클러스터에서 실행되는 경우가 많은, 본질적으로 다른 산출물이기 때문입니다. 장치와 태그는 `values.yaml`에 선언되어 ConfigMap으로 렌더링되며, 전달 큐는 작은 PVC에 있습니다(끄기 전에 아래 "영속성 끄기"를 참조하십시오).
- **`deploy/quadlet`**, k3s 클러스터에 전혀 속하지 않는 Pi나 소형 산업용 PC를 위한 Podman Quadlet 유닛입니다. Quadlet은 컨테이너를 진짜 systemd 서비스로 만들어서 부팅 시 시작하고, 실패하면 재시작하며, journald에 로그를 남깁니다. 설치 절차는 해당 디렉터리의 README를 참조하십시오.

둘 다 같은 이미지와 위에 문서화된 같은 환경 변수를 사용합니다.

모든 릴리스는 4.16.0부터 둘 다 게시합니다. 이미지는 `ghcr.io/hotloop-io/hotloop-edge-relay`이며 릴리스 버전으로 태그되고(`major.minor`, `major`, `latest`, `stable`도 함께, Quadlet 유닛은 `stable`을 따릅니다. [Relay 업데이트](#relay-업데이트) 참조) amd64와 arm64를 지원하고, 4.17.0 이후 첫 릴리스부터는 32비트 arm(arm/v7)도 지원합니다. Pi 3나 32비트 Pi OS 설치가 바로 Relay가 놓이게 되는 장비이기 때문입니다. 차트는 Gateway의 차트와 같은 Helm 저장소에 있습니다.

```sh
helm repo add hotloop https://hotloop.io/hotloop/
helm install edge-relay hotloop/hotloop-edge-relay \
  --namespace hotloop --create-namespace \
  --set edgePublish.broker=tcp://gateway.example.local:1883 \
  --set edgePublish.group=Plant1
```

### 영속성 끄기

`persistence.enabled=false`는 PVC 없이 실행되는 Relay를 만들며, 정확히 그것뿐입니다. 4.16.0에서는 실행조차 되지 않았습니다. `/data`에 아무것도 마운트되지 않았고 루트는 읽기 전용이어서, Relay가 부팅 시 `open forward queue at /data/forward.db: no such file or directory`로 죽었습니다. 이제 `/data`는 `persistence.size`로 용량이 제한된 emptyDir이며, Relay가 기록하는 모든 것이 거기에 쌓입니다.

emptyDir은 Pod가 존재하는 동안만 유지됩니다. 같은 Pod 안에서 컨테이너가 재시작해도 유지됩니다. 새 Pod는 유지하지 못하며, 노드 드레인, 노드 장애, 축출, `kubectl delete pod`, 그리고 Deployment를 롤링하는 모든 `helm upgrade`에서 새 Pod가 생깁니다. 그때마다 다음을 잃습니다.

- **전달 큐.** 브로커가 끊겨 있는 동안 버퍼링된 모든 읽기값이 사라지며, Gateway 쪽에서는 아무도 빠진 것을 알지 못합니다.
- **푸시된 장치 파일.** Relay는 불평 없이 차트의 `devices`로 다시 부팅하며, Gateway가 다시 푸시하거나 브로커가 retained 푸시를 재전송할 때까지 그대로입니다. PVC가 막으려는 바로 그 장애이며, 끄면 다시 그 장애를 감수하게 됩니다.
- **OPC UA 클라이언트 인증서와 신뢰 저장소.** 보안이 적용된 모든 서버가 새 인증서를 신뢰해야 하며, 운영자는 모든 서버의 인증서를 다시 승인해야 합니다.

상한을 채우는 일은, 제한 없이 설정된 큐(`queueMaxBytes: 0`이며 기본값은 64 MiB)가 충분히 긴 장애 동안 일으킬 수 있는데, Pod가 축출되어 세 가지를 한꺼번에 잃게 합니다. 그래도 노드에 있는 다른 모든 것 아래에서 노드의 디스크를 채우는 것보다는 낫습니다. 설치 안내는 영속성이 꺼져 있으면 경고를 출력합니다. 시험용으로는 괜찮습니다. 읽기값이 중요한 Relay에는 PVC를 주십시오.

### EmberNet App Store에서

스토어에는 Relay가 노드당 하나씩 HotLoop Edge Relay로 올라 있습니다. 스토어 배포는 차트에 세 가지를 전달합니다. 표시 이름(릴리스 이름), 노드 셀렉터, 테넌트 레이블입니다. 그 외에는 물어볼 폼이 없으며, Relay는 브로커와 Sparkplug 그룹 없이는 실행될 수 없습니다. 그래서 Relay의 스토어 배포는 의도적으로 렌더링 단계에서 멈추고, helm-install 작업 로그에 무엇이 빠졌는지와 고치는 정확한 명령을 담은 오류를 남깁니다.

기본 브로커는 주지 않았습니다. 누구의 공장에도 맞는 브로커는 없으며, 만들어 낸 주소를 가리키는 Relay는 아무것도 전달하지 않는데도 배포된 것처럼 보일 것이기 때문입니다. 푸시된 장치 파일을 기다릴 수도 없습니다. 푸시는 아직 존재하지 않는 브로커 연결로 도착하기 때문입니다.

해결 방법은 스토어가 기록한 내용에 두 값을 넣는 것이며, 설치는 스스로 다시 시도합니다.

```sh
# a node on the local cluster: add them under spec.valuesContent
kubectl -n default edit helmchart hotloop-edge-relay-<node>

# a tenant on its own cluster (Fleet): add them under spec.helm.values
kubectl -n fleet-default edit helmop hotloop-edge-relay-<node>
```

```yaml
edgePublish:
  broker: tcp://<gateway-or-broker>:1883
  group: <sparkplug group id>
```

올라오면 Running Apps에 스토어가 부여한 이름으로 HotLoop 아이콘과 함께 표시되며, 배포한 테넌트로 범위가 한정되고 LAUNCH 버튼은 없습니다. 이 마지막 부분은 의도적입니다. 차트가 `embernet.ai/gui-type: none` 레이블을 붙이는 이유는 `/healthz`와 `/status`가 프로브와 운영자의 curl을 위한 것이지 iframe에 들어갈 페이지가 아니기 때문입니다.

Relay와 Gateway는 버전 번호를 공유합니다. 두 차트가 태그의 버전을 갖고 Relay의 Quadlet 유닛이 `:stable`을 따르지 않으면 릴리스가 시작되지 않으므로, Relay 자체 코드가 바뀌었는지와 관계없이 매 릴리스마다 새 버전을 받습니다. 의도된 것입니다. 물어볼 숫자가 하나이고, 아무도 푸시하지 않은 Relay 이미지를 가리키는 Relay 차트가 없습니다. Quadlet 유닛은 예전에 릴리스 번호를 고정했는데, 스스로 업데이트하는 장비의 방식과는 반대입니다.
