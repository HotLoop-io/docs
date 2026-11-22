---
title: "워크플로 가져오기"
description: "기존 워크플로를 Cascade로 가져옵니다. 옮겨지는 것과, 가져오기 도구가 옮기지 못했다고 알려 주는 것을 설명합니다."
---

`hotloop-cascade workflows convert export.json -o workflow.yaml --report report.json`은 다른 도구에서 JSON으로 내보낸 워크플로를 변환합니다. 확실하게 옮길 수 있는 것, 즉 알고 있는 단계와 그 설정 안의 필드 읽기만 가져옵니다. 나머지는 모두 꺼진 상태로 들어오며 원래 설정은 메모에 남고, 보고서에 각 항목과 그 이유가 나열됩니다. JavaScript 표현식의 의미를 짐작해 바꾸는 일은 절대 없고, 내보내기 파일에는 자격 증명이 없으므로 자격 증명도 가져오지 않습니다. 어느 슬롯에 어떤 자격 증명이 필요한지는 보고서에 나옵니다. 그다음 `workflows import workflow.yaml`로 가져옵니다.
