---
title: "core 4.20.1 릴리스 노트"
description: "HotLoop core 4.20.1에 담긴 내용, 업그레이드할 때 달라지는 점, 가동 중인 플랜트를 건드리기 전에 읽어야 할 내용입니다."
sidebar:
  label: "4.20.1"
---

[4.20.0](/ko/releases/hotloop-4-20-0/)의 멀티 아키텍처 빌드입니다. 제품 코드는 4.20.0과 같습니다. `/`의 새 웹 UI와 설정을 바꾸는 MCP 도구입니다. 4.20.0이 amd64 빌드였고 `stable`은 이미 가지고 있던 arm 이미지를 유지했습니다.

4.20.1이 전체 세트를 빌드합니다. Gateway는 amd64와 arm64, Edge, IoT, Edge Relay는 amd64, arm64, arm/v7입니다. 4.19.11 이후 바뀐 모든 것은 [4.20.0 노트](/ko/releases/hotloop-4-20-0/)를 읽어 주세요.

- 네 차트(`hotloop`, `hotloop-iot`, `hotloop-edge`, `hotloop-edge-relay`) 모두 4.20.1이며, 이전의 모든 버전이 여전히 인덱스에 있습니다.
