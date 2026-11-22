---
title: "HotLoop for CODESYS 현황"
description: "HotLoop for CODESYS를 실제 하드웨어에서 무엇을 상대로 실행했는지, 그리고 무엇이 게시되어 있는지."
sidebar:
  label: "현황"
editUrl: false
---

이 페이지는 게시된 것과 HotLoop for CODESYS를 어디까지 실행해 봤는지를 정리합니다.

## 출시된 것

- **차트.** `hotloop-codesys` 0.3.8이 `https://hotloop.io/hotloop-codesys/`의 인덱스에 2026-11-19에 게시되어 있으며, 이전 버전도 모두 그대로 있습니다. HotLoop 4.22.0을 감쌉니다. 0.3.8 설치: 각 차트가 무엇을 바꿨는지는 [릴리스 노트](/ko/releases/codesys-0-3-5/)에 있습니다.
- **프로비저너 이미지.** 0.3.3의 `ghcr.io/hotloop-io/hotloop-provision`은 amd64와 arm64 모두 로그인 없이 받을 수 있으며 차트가 이를 실행합니다.
- **App Store 등록.** EmberCORE App Store에 있으며 EmberNet이 테넌트에 설치합니다.

## 어디까지 실행했나

Store 형태의 값을 쓴 k3s 노드의 차트, 같은 노드에서 데모 프로그램을 실행하는 실제 CODESYS Control for Linux SL 4.22.0.0 런타임, 그리고 HotLoop Edge 이미지.

- 장치, 그 태그(쓰기 가능한 것은 없음), 알람, 화면이 수작업 없이 나타났습니다.
- 모든 값이 정상으로 읽히고 움직였습니다.
- 파드를 삭제한 뒤에도 파드가 돌아왔습니다.
- 런타임 재시작 중에는 설치가 "the PLC's runtime is not answering"이라는 이유와 함께 불량으로 읽혔고, 약 88초 뒤 스스로 돌아왔습니다.
- 대시보드에서 서명된 로그인으로 운영자나 관리자로 사람이 로그인되었고, 잘못된 앱, 잘못된 테넌트, 만료된 것, 잘못된 발급자, 변조된 것은 각각 거부되었습니다.
- 게시된 차트가 라이브 인덱스에서 Helm으로 렌더링됩니다.

그 아래의 커넥터, 곧 HotLoop core의 CODESYS 드라이버는 CODESYS Control for Linux SL 4.22.0.0 런타임을 상대로 읽기와 쓰기를 실시간으로 검증했고, 베어메탈에서도 검증했습니다(2026-11-17). 쓰기는 커넥터에 있지만 이 제품은 이를 켜지 않습니다.

이 모두를 베어메탈에서도 실행했습니다(2026-11-17).

## 프로필이 아직 못 하는 것

프로필은 화면 하나를 만듭니다. `device`로 장치 하나를, `devices`로 어떤 프로토콜이든 여러 개를 만들며, 프로필에서 변수를 쓰기 가능으로 표시하는 방법은 의도적으로 없습니다.
