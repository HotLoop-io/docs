---
title: "소스에서 Flow 빌드하기"
description: "Flow 바이너리를 소스에서 빌드합니다. 편집기가 안에 들어 있고 아래에 C 라이브러리가 없는 정적 바이너리 하나입니다."
---

HotLoop Flow는 편집기가 안에 들어 있는 정적 바이너리 하나이므로, 대부분은 게시된 이미지를 받아 쓰고 직접 빌드할 일이 없습니다. 직접 빌드하고 싶으시면 소스가 공개되어 있으며, 빌드에는 Go와 Node가 필요합니다.

```bash
cd web && npm install && npm run build && cd ..
CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o hotloop-flow ./cmd/hotloop-flow
```

결과물은 정적이고 아래에 C 라이브러리가 없어서, 다른 것이 아무것도 설치되지 않은 distroless 이미지에서 실행됩니다. 모든 Flow 릴리스는 버전 태그에서만 빌드되므로, 생산 현장의 이미지는 언제나 이름을 댈 수 있고 릴리스까지 추적할 수 있는 것입니다.