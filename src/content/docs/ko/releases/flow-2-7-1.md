---
title: "Flow 2.7.1 릴리스 노트"
description: "HotLoop Flow 2.7.1에 담긴 내용, 업그레이드 시 달라지는 점, 가동 중인 플랜트를 건드리기 전에 읽어야 할 것."
sidebar:
  label: "2.7.1"
---

HotLoop Flow 2.7.1은 2.7.0에 arm64 이미지를 더했을 뿐, 다른 것은 없습니다. 2.7.0은 먼저 운영에 올라가 stable로 표시되도록 amd64로만 나왔고, 이번 릴리스는 둘 다 빌드하는 작은 후속입니다. 코드, 차트, 설정, 그리고 여러분의 플로 모두 바뀌지 않습니다.

## 바뀐 내용

- 이미지가 다시 linux/amd64와 linux/arm64용으로 빌드됩니다. `2.7.1`, `2.7`, `2` 태그가 둘 다 담고 있습니다.
- README와 설치 페이지가 2.7.1을 가리키며, 2.7.0 이전처럼 amd64와 arm64를 함께 안내합니다.

## 새 설정

없습니다.

## 업그레이드

2.7.1 이미지와 차트로 `helm upgrade`만 하거나 Quadlet 유닛의 새 태그를 쓰면 됩니다. arm64를 쓰면서 2.7.0이 amd64 전용인 동안 2.6.0에 머물렀다면, 지금이 FlowLab으로 옮겨 갈 때입니다. 2.7.0 노트에서 FlowLab이 무엇이고 아직 무엇이 아닌지 읽어 보세요. 처음 시작할 때 일어나는 일은 없고 마이그레이션도 필요 없습니다.

이미지: `ghcr.io/hotloop-io/hotloop-flow:2.7.1`, linux/amd64 및 linux/arm64. Chart: `https://hotloop.io/hotloop-flow/`. 이 태그의 README에 나머지가 그림과 함께 있습니다: https://github.com/HotLoop-io/hotloop-flow/blob/v2.7.1/README.md
