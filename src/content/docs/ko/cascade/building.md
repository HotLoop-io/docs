---
title: "Cascade 빌드하기"
description: "Cascade 바이너리와 이미지를 빌드하고, Cascade가 사용할 데이터베이스를 선택합니다."
---

Go와 Podman이 필요합니다. `make build`는 Cascade 바이너리를 빌드하고, `make image`는 Podman으로 컨테이너 이미지를 빌드합니다. 편집기가 바이너리에 포함되어 있어 따로 설치할 것이 없습니다.

데이터베이스는 설정으로 정합니다. `HOTLOOP_CASCADE_DATABASE`는 `sqlite:<path>`(기본값이며 `HOTLOOP_CASCADE_DATA_DIR` 아래에 저장됩니다) 또는 `postgres://` URL입니다.

Docker도 Compose도 사용하지 않습니다. Cascade는 Podman(Quadlet 포함)과 k3s(Helm 포함)용으로 제공됩니다.