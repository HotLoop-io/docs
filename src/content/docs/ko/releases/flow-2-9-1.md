---
title: "Flow 2.9.1 릴리스 노트"
description: "HotLoop Flow 2.9.1에 담긴 내용, 업그레이드 시 달라지는 점, 가동 중인 플랜트를 건드리기 전에 읽어야 할 것."
sidebar:
  label: "2.9.1"
---

HotLoop Flow 2.9.1은 `modbus-server` 노드가 VLAN 하나의 인터페이스에서 수신하게 해 주므로, 하나의 Flow가 한 포트의 VLAN마다 같은 주소와 같은 포트로 서버를 하나씩 실행할 수 있습니다.

## 새 기능

- **`modbus-server`가 네트워크 인터페이스를 받습니다.** 수신 소켓은 수신을 시작하기 전에 인터페이스에 바인딩되므로(`SO_BINDTODEVICE`), 두 VLAN의 `192.168.1.9:10502`에 있는 서버 두 개가 더 이상 충돌하지 않습니다. 설정은 모든 클라이언트와 같습니다. 노드 자체의 **네트워크 인터페이스**, 없으면 그 탭 환경 변수의 `FLOW_NETWORK_INTERFACE`입니다. 둘 다 없으면 이전처럼 수신하며, 같은 주소와 포트의 서버 두 개는 여전히 충돌하되, 이제 각각 인터페이스가 필요하다는 오류가 나옵니다.

## 바뀐 내용

- 설정하지 않으면 업스트림과 똑같이 동작합니다. 무엇이 바뀌었는지는 NOTICE와 `HOTLOOP_PATCH.txt`에 있습니다.

## 새 설정

`modbus-server`의 **네트워크 인터페이스** 필드 외에는 없습니다. 차트 값 `bindToInterface.netRaw`와 2.9.0의 호스트 네트워크 요건은 클라이언트와 마찬가지로 여기에도 적용됩니다.

## 업그레이드

이미지와 차트 2.9.1로 `helm upgrade`를 한 번 실행하거나, Quadlet 유닛의 태그를 새 것으로 바꾸면 됩니다. 첫 시작에서는 아무 일도 일어나지 않고 이전할 것도 없습니다. 인터페이스를 지정하지 않는 플로는 2.9.0에서와 똑같이 동작합니다.

이미지: `ghcr.io/hotloop-io/hotloop-flow:2.9.1`, linux/amd64가 먼저이고 arm64는 2.9.2에서 이어집니다. 차트: `https://hotloop.io/hotloop-flow/`. 이 태그의 README에 나머지가 사진과 함께 있습니다: https://github.com/HotLoop-io/hotloop-flow/blob/v2.9.1/README.md
