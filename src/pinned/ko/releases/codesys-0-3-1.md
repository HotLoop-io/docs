---
title: "CODESYS 0.3.1 릴리스 노트"
description: "HotLoop for CODESYS 차트 0.3.1: provisioner가 릴리스 이름으로 HotLoop의 Service와 Secret을 찾으므로 어떤 릴리스 이름으로도 설치됩니다."
sidebar:
  label: "0.3.1"
---

## 바뀐 내용

0.3.1은 2026-11-05에 `{{codesysChartRepo}}` 인덱스에 게시되었으며, [0.3.2](/ko/releases/codesys-0-3-2/)까지 설치할 차트였습니다. 여전히 HotLoop 4.19.4를 감싸고, 로그인 없이 받을 수 있는 provisioner 0.3.0을 실행합니다.

- **어떤 릴리스 이름으로도 설치됩니다.** provisioner는 이제 HotLoop 자체 차트가 쓰는 이름 규칙, 즉 릴리스 이름으로 HotLoop의 Service와 자격 증명 Secret을 찾습니다. 이전 규칙은 이름에 `hotloop-codesys`가 없는 릴리스에 다른 이름을 추측했고, HotLoop 파드에는 그 이름이 없었습니다.
- **예제 프로필이 올바릅니다.** `example-devices.json`은 더 이상 Variant를 RawData 타입으로 나열하지 않습니다. 그렇지 않기 때문입니다.
- **[0.3.0](/ko/releases/codesys-0-3-0/)의 모든 것이 그대로 있고**, PLC에는 아무것도 쓰지 않으며, 이전 차트는 모두 인덱스에 남아 있습니다.

이것이 의미하는 바: 릴리스에 원하는 이름을 붙이면 provisioner가 대화해야 할 대상을 찾습니다.

## 확인한 것

차트는 라이브 인덱스에서 Helm으로 렌더링되며, 베어메탈에서 실행했습니다(2026-11-17). [현재 상태](/ko/codesys/where-it-stands/)에 무엇을 상대로 실행했는지 적혀 있습니다.
