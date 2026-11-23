---
title: "CODESYS 0.3.8 릴리스 노트"
description: "HotLoop for CODESYS 차트 0.3.8: 실행하는 provisioner 이미지는 amd64와 arm64용으로 빌드한 0.3.3입니다."
sidebar:
  label: "0.3.8"
---

## 바뀐 내용

0.3.8는 2026-11-19에 `{{codesysChartRepo}}` 인덱스에 게시되었습니다.

- **provisioner 0.3.3을 실행합니다.** amd64와 arm64용으로 빌드한 첫 provisioner 이미지이므로, 차트가 arm64 노드에도 설치됩니다.
- **그 외에는 바뀐 것이 없습니다.** 템플릿, 값, 감싸는 HotLoop(4.22.0)은 [0.3.7](/ko/releases/codesys-0-3-7/)와 같습니다.

이것이 의미하는 바: 이것을 설치하십시오. amd64 노드에서는 달라지는 것이 없습니다.

## 확인한 것

게시된 차트의 값은 provisioner 0.3.3과 HotLoop 4.22.0을 읽고, 0.3.3 이미지 인덱스에는 amd64와 arm64가 나열됩니다. 이미지 태그만 움직였으므로 이번 릴리스를 위해 클러스터에 차트를 다시 설치하지는 않았습니다.
