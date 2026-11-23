---
title: "core 4.20.2 릴리스 노트"
description: "HotLoop core 4.20.2에 담긴 내용, 업그레이드할 때 달라지는 점, 가동 중인 플랜트를 건드리기 전에 읽어야 할 내용입니다."
sidebar:
  label: "4.20.2"
---

[4.20.1](/ko/releases/hotloop-4-20-1/) 위의 수정 두 가지와 라이선스입니다. 이것은 EmberNet Source License 1.0(`LicenseRef-EmberNet-Source-1.0`) 아래의 첫 코어 릴리스이며, LICENSE, NOTICE, README, 차트 어노테이션, 이미지 레이블에 모두 그렇게 적혀 있습니다.

- **배치에 tag가 둘 이상인 EtherNet/IP.** 드라이버는 라이브러리의 `ReadMulti`에 배치를 요청했는데, 이 함수는 태그가 붙은 필드의 struct나 map을 받으며, 평범한 tag 이름을 주면 단 1바이트도 나가기 전에 reflect에서 panic이 납니다. 그래서 배치에 tag가 둘 이상인 모든 EtherNet/IP 장치는 폴링에서 panic이 났습니다(배치는 기본 스무 개). 어떤 테스트도 서버를 상대로 배치를 둔 적이 없어서 테스트에서는 아무도 보지 못했습니다. 이제 테스트가 프로세스 안에서 EtherNet/IP 서버와 S7 서버를 실행하고, 드라이버가 TCP로 그것을 읽으며, 배치는 `ReadList`를 거칩니다. 소켓은 열려 있는데 말이 없는 컨트롤러는 의도대로 폴링 한 번에 그 timeout을 더한 안에 다운되며, tag마다 다시 묻지 않으므로 tag당 timeout 하나씩 폴링을 붙잡던 일이 없어집니다. S7comm과 EtherNet/IP는 아직 실제 PLC에서 검증되지 않았습니다.
- **`version`은 하나의 단어입니다.** `podman run ghcr.io/hotloop-io/hotloop:4.20.1 version`은 설정을 읽기 전에 `--version`만 처리했기 때문에 「database password is not set」으로 죽었습니다. 이제 `version`은 빈 환경에서도 버전을 출력합니다. Gateway, Edge, IoT와 Edge Relay 모두 해당합니다.

- 마이그레이션, 새 secret, API 변경은 없습니다. 평범한 `helm upgrade`나 Quadlet 자동 업데이트로 적용됩니다.
- 네 차트(`hotloop`, `hotloop-iot`, `hotloop-edge`, `hotloop-edge-relay`) 모두 4.20.2이며, 이전의 모든 버전이 여전히 인덱스에 있습니다.
- 이 빌드는 amd64 전용이며 `stable`은 가지고 있는 arm 이미지를 유지합니다. 다음 릴리스는 arm 이미지를 빌드하는 작은 버전 올림입니다.
