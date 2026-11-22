---
title: "HotLoop for CODESYS 설치"
description: "EmberCORE App Store 또는 Helm으로 HotLoop for CODESYS를 설치합니다. 노드에 필요한 것, 프로필 Secret, 스스로 하는 일, 확인 방법을 설명합니다."
sidebar:
  label: "설치"
---

HotLoop for CODESYS는 CODESYS 런타임과 같은 노드에 HotLoop Edge와 프로비저너를 설치하는 Helm 차트 `hotloop-codesys`입니다. 차트는 `{{codesysChartRepo}}`에 게시되며 최신 버전은 {{codesys}}이고, 프로비저너 이미지는 로그인 없이 받을 수 있습니다. EmberNet에서는 App Store 앱입니다. EmberNet이 없으면 k3s의 Helm입니다.

## 노드에 먼저 필요한 것

- **같은 노드에서 포트 4840으로 OPC UA 서버를 게시하는 CODESYS 런타임.** 프로비저너는 Kubernetes에서 노드 자신의 주소를 알아내 `<node address>:4840`을 읽습니다. 런타임 자체의 차트가 그 포트를 호스트에 게시합니다.
- **PLC 프로그램의 Symbol Configuration.** *Support OPC UA features*를 켜고 보려는 변수를 나열하거나, 선언에서 해당 변수에 `{attribute 'symbol' := 'read'}`를 붙입니다. Symbol Configuration이 없는 PLC는 설정 요청에 추가하라는 메시지로 응답합니다. PLC 프로젝트에서 바꾸는 것은 이것뿐입니다.
- **HotLoop {{codesysNeeds}}**, 차트가 감싸는 대상입니다. CODESYS 커넥터는 HotLoop 4.19.4와 함께 들어왔습니다. 차트는 `~{{codesysNeeds}}` 라인의 `hotloop-edge` 차트에 의존합니다.
- **프로필.** 키가 하나인 Secret 하나입니다. [프로필 페이지](/ko/codesys/profile/)에 형식이 있습니다.

## EmberCORE App Store에서

차트는 직원용으로 표시되어 있으므로 Store는 EmberNet 직원에게만 이를 보여 주고, 직원이 고객의 테넌트에 설치합니다. 테넌트가 직접 누르는 버튼이 아니므로 테넌트를 담당하는 사람에게 문의하세요. Store는 프로필을 테넌트의 네임스페이스에 `<release>-profile`로 쓰고, 선택된 노드와 테넌트의 레이블을 차트에 전달하며, 로그인을 위한 대시보드의 공개 키를 전달합니다. 그 뒤에는 할 일이 없습니다.

## Helm으로

```bash
kubectl -n <namespace> create secret generic <release>-profile --from-file=profile.json
helm repo add hotloop-codesys {{codesysChartRepo}}
helm repo update
helm install <release> hotloop-codesys/hotloop-codesys --version {{codesys}} -n <namespace>
```

Secret의 이름을 `<release>-profile`로 하거나, 차트가 찾는 이름을 `profile.existingSecret`(Secret)과 `profile.key`(키, 기본값 `profile.json`)로 바꿉니다. 설치를 런타임의 노드에 고정하려면 `nodeSelector`를 설정합니다. 프로필 없이 HotLoop만 설치해 직접 설정하려면 `--set provisioner.enabled=false`로 설치합니다.

## 노드의 네트워크에서 런타임을 쓸 때

`network.hostNetwork=true`로 자체 차트에서 설치한 런타임은 WebVisu를 위해 호스트 포트 8080을 점유하므로, HotLoop 페이지는 그곳에서 8080으로 함께 수신할 수 없습니다. 차트는 HotLoop 페이지가 파드 안에서 8090으로 수신하게 하고 Service는 8080으로 유지하므로, App Store 타일과 프로비저너는 이전처럼 접속합니다. 둘 다 호스트 네트워크를 켜고 설치합니다.

```bash
helm install <release> hotloop-codesys/hotloop-codesys --version {{codesys}} -n <namespace> \
  --set hotloop-edge.hostNetwork=true --set hotloop-edge.service.targetPort=8090
```

HotLoop의 OPC UA PubSub 리스너는 UDP 포트를 독점적으로 바인드하므로, 한 포트의 리스너 두 개는 함께 연결할 수 없습니다. 프로비저너는 그것을 요청하는 프로필을 거부하고 이유를 알려 줍니다.

## 설치가 하는 일

1. HotLoop Edge가 그 노드에서 노드의 local-path 스토리지의 SQLite로 시작합니다. 데이터베이스 파드는 없고, 레플리카는 하나이며, 업데이트 전략은 `Recreate`입니다.
2. 프로비저너가 같은 노드에서 시작합니다. 매 패스마다 마운트된 프로필을 읽으므로 더 새로운 프로필이 실행 중인 설치에 반영됩니다. HotLoop과 노드 자체의 CODESYS 런타임을 기다린 다음, 프로필의 장치, 변수, 알람, 화면을 설정합니다.
3. 5분마다 다시 확인하며 PLC 프로그램이 바뀌는 대로 장치를 올바르게 유지합니다. 프로필이 나열하고 PLC가 이제 가진 변수는 추가되고, PLC에 더 이상 없는 변수는 서버가 알려 주는 이유와 함께 불량으로 읽힙니다.
4. 두 파드 모두 `tolerationSeconds` 없이 `node.kubernetes.io/unreachable`과 `not-ready`를 허용하므로, 컨트롤 플레인을 잃은 노드도 파드를 유지합니다. 차트가 이를 스스로 가지고 있으며 클러스터 설정에 의존하지 않습니다.

OPC UA 서버, 내장 브로커, 엣지 게시, 백업은 꺼져 있습니다. 런타임 곁에서는 어느 것도 필요하지 않기 때문입니다. 원하면 `hotloop-edge`의 values로 하나를 켜세요.

## 확인하기

```bash
kubectl -n <namespace> logs deploy/<release>-provision
```

정상적으로 시작되면 장치가 변수와 함께 설정되었고 쓰기 가능한 변수는 없으며 알람과 화면이 만들어졌다고 표시됩니다. HotLoop 서비스를 열고 `admin`으로 로그인한 뒤 장치와 대시보드를 확인하세요. 관리자 비밀번호는 다른 HotLoop 차트와 마찬가지로 릴리스 Secret에 있습니다.

## 대시보드에서 로그인

HotLoop 4.19부터 Edge 차트는 EmberCORE 대시보드가 서명한 어서션으로 사용자를 로그인시킵니다(`embernetSignin` values, 네 개의 `HOTLOOP_AUTH_ASSERTION_*` 변수, Service 어노테이션 `embernet.ai/signin: assertion`). 이 차트는 이 모든 것을 `hotloop-edge` 서브차트에서 물려받고, Store가 공개 키를 전달합니다. 프로비저너는 로컬 로그인이 여전히 허용하는 차트의 관리자 계정을 사용합니다. 테스트 클러스터에서 올바른 어서션은 사용자를 operator 또는 admin으로 로그인시켰고, 잘못된 앱, 잘못된 테넌트, 만료된 것, 잘못된 발급자, 변조된 어서션은 각각 거부되었습니다.

## 어디까지 실행해 보았는가

실제 하드웨어에서 실행했고(2026-11-17), 차트는 Helm으로 실시간 인덱스에서 렌더링됩니다. [현재 상태](/ko/codesys/where-it-stands/).

