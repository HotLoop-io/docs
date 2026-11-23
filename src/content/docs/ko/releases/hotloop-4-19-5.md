---
title: "core 4.19.5 릴리스 노트"
description: "HotLoop core 4.19.5에 담긴 내용, 업그레이드할 때 달라지는 점, 가동 중인 플랜트를 건드리기 전에 읽어야 할 내용입니다."
sidebar:
  label: "4.19.5"
---

[4.19.4](/ko/releases/hotloop-4-19-4/)의 멀티 아키텍처 빌드이며 그 밖에는 없습니다. 코드는 같은 커밋의 코드이고 버전만 올렸습니다. 수정도, 기능도, 동작 변경도 없습니다.

4.19.4는 arm 이미지가 만들어지기 전에 프로덕션에 도달해 stable로 읽힐 수 있도록 amd64만 빌드했습니다. 4.19.5가 전체 세트를 빌드합니다. Gateway는 amd64와 arm64, Edge, IoT, Edge Relay는 amd64, arm64, arm/v7입니다. arm 박스는 `stable`을 받으면 돌리던 이미지에서 4.19.4의 코드로 옮겨 갑니다.

마지막으로 공개된 릴리스 이후 바뀐 모든 것은 [4.19.4 노트](/ko/releases/hotloop-4-19-4/)를 읽어 주세요.

- 네 차트(`hotloop`, `hotloop-iot`, `hotloop-edge`, `hotloop-edge-relay`) 모두 4.19.5이며, 이전의 모든 버전이 여전히 인덱스에 있습니다.
- 변경 사항이 들어 있는 다음 릴리스에서 `linux/amd64`로 되돌립니다.
