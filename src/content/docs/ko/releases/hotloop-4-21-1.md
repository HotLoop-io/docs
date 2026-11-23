---
title: "core 4.21.1 릴리스 노트"
description: "HotLoop core 4.21.1에 담긴 내용, 업그레이드할 때 달라지는 점, 가동 중인 플랜트를 건드리기 전에 읽어야 할 내용입니다."
sidebar:
  label: "4.21.1"
---

[4.21.0](/ko/releases/hotloop-4-21-0/)의 멀티 아키텍처 빌드입니다. 제품 코드는 4.21.0과 같습니다. OPC UA 서버의 X.509 로그인, 72바이트 비밀번호, 기본으로 꺼진 폐기 보안 정책, 넓어진 CODESYS 알람 가져오기입니다. 4.21.0이 amd64 빌드였고 `stable`은 이미 가지고 있던 arm 이미지를 유지했습니다.

4.21.1이 전체 세트를 빌드합니다. Gateway는 amd64와 arm64, Edge, IoT, Edge Relay는 amd64, arm64, arm/v7입니다. `Basic128Rsa15`와 `Basic256`이 업그레이드에서도 꺼진다는 점을 포함해 4.20.2 이후 바뀐 모든 것은 [4.21.0 노트](/ko/releases/hotloop-4-21-0/)를 읽어 주세요.

- 네 차트(`hotloop`, `hotloop-iot`, `hotloop-edge`, `hotloop-edge-relay`) 모두 4.21.1이며, 이전의 모든 버전이 여전히 인덱스에 있습니다.
