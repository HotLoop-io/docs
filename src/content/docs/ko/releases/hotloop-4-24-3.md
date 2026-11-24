---
title: "core 4.24.3 릴리스 노트"
description: "HotLoop core 4.24.3에 담긴 내용, 업그레이드할 때 달라지는 점, 가동 중인 플랜트를 건드리기 전에 읽어야 할 내용입니다."
sidebar:
  label: "4.24.3"
---

4.24.3은 [4.24.2](/ko/releases/hotloop-4-24-2/)의 모든 것을 우리가 빌드하는 모든 보드로 가져옵니다. 모든 세대의 Shelly, ONVIF 카메라, Firmata를 통한 Arduino, 어떤 길이의 OPC UA 비밀번호든, 느린 링크 뒤에서 비워지는 전달 큐, 커밋을 알려 주는 `--version`, 시작되는 기본 HotLoop Edge 설치입니다.

Gateway는 amd64와 arm64에서, Edge, IoT, Edge Relay는 amd64, arm64, arm/v7에서 동작하므로 같은 릴리스가 서버, Pi, 오래된 ARM 게이트웨이를 모두 다룹니다. 4.24.0 이후의 새 내용은 [4.24.2 노트](/ko/releases/hotloop-4-24-2/)를 읽어 보세요.

- 네 개의 차트(`hotloop`, `hotloop-iot`, `hotloop-edge`, `hotloop-edge-relay`)가 모두 4.24.3이며, 이전 버전도 모두 인덱스에 남아 있습니다.
- 늘 하던 대로 업그레이드하세요. 4.24.3 차트로 `helm upgrade`를 실행하거나 Quadlet 유닛의 새 태그를 쓰면 됩니다. 이전할 것은 없습니다.
