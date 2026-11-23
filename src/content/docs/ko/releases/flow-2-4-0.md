---
title: "Flow 2.4.0 릴리스 노트"
description: "HotLoop Flow 2.4.0에 담긴 내용, 업그레이드 시 달라지는 점, 가동 중인 플랜트를 건드리기 전에 읽어야 할 것."
sidebar:
  label: "2.4.0"
---

HotLoop Flow 2.4.0은 EmberCORE 대시보드가 사람들을 Flow에 로그인시킬 수 있게 합니다. 대시보드에서 Flow를 여는 사람은 테넌트가 부여한 역할, 즉 전체 접근 또는 읽기 전용으로 두 번째 로그인 없이 들어갑니다. 대시보드 키를 설정하지 않으면 꺼져 있으며, 이전에 동작하던 것은 아무것도 바뀌지 않습니다.

## 새 기능

**EmberCORE 대시보드에서 로그인**
- 대시보드는 Flow로 프록시하는 모든 요청, 에디터의 웹소켓을 포함해, 자신이 서명한 토큰을 `X-Embernet-Assertion`에 담아 보냅니다. Flow는 대시보드의 공개 키로 서명(ES256), 발급자(`embernet-dashboard`), 이 테넌트의 이 Flow용으로 만들어졌는지(audience는 `<tenant>/<release>`이므로 다른 앱용 토큰은 여기서 아무것도 열지 못합니다), 그리고 약 1분인 만료를 확인합니다. 이 중 하나라도 틀린 토큰은 거부되며, 요청의 다른 어떤 것도 그것을 구제하지 못합니다.
- 역할은 대시보드의 테넌트 역할 맵에서 옵니다. `*`는 모든 권한입니다. `read`는 플로, 팔레트, 설정, 상태이며 그것을 바꾸는 것은 없습니다. 배포도, inject도, 배포 로그도 없습니다. 운영자와 뷰어는 기본적으로 `read`를 받습니다. 둘 다 아니거나 없는 역할은 접근 권한이 없습니다. 이렇게 로그인한 사람은 배포 로그와 감사 기록에 `dashboard:<email>`로 나타납니다.
- 세션은 없습니다. 대시보드가 요청마다 새 토큰을 보내므로, 거기서 바꾼 역할은 다음 요청에 반영되고 철회할 것이 없습니다.
- 에디터는 자체 로그인 양식을 제공하는 대신 "EmberCORE 대시보드에서 여세요"라고 안내하며, 대시보드가 로그인시킨 경우 로그아웃 버튼을 없앱니다. 아직 아무도 로그인하지 않았을 때 에디터가 이를 묻는 방법이 `GET /auth/mode`입니다.
- 차트는 이를 `embernetSignin` 아래에서 받습니다. App Store가 대시보드의 공개 키를 전달하면, 차트가 이를 마운트하고, 설정을 쓰고, 파드를 롤링하고, 대시보드가 사람들을 로그인시켜야 한다는 것을 알도록 Service에 어노테이션을 붙입니다.

## 바뀐 내용

키를 설정하지 않으면 아무 일도 없습니다. 키 파일이 없으면 Flow는 헤더를 아예 읽지 않으며, 기본값의 `helm template`은 이전과 같습니다.

## 업그레이드

2.4.0 이미지와 차트로 `helm upgrade`만 하면 됩니다. 처음 시작할 때 일어나는 일은 없습니다.

직접 쓰려면 대시보드의 공개 키(PEM 파일)를 마운트하고 `auth.assertion.publicKeyFile`과 `auth.assertion.audience`, 또는 `HOTLOOP_FLOW_ASSERTION_PUBLIC_KEY_FILE`과 `HOTLOOP_FLOW_ASSERTION_AUDIENCE`를 설정하세요. 읽을 수 없는 키이거나 audience가 없으면 Flow는 시작을 거부합니다. 나머지 설정은 `auth.assertion.issuer`(`embernet-dashboard`), `header`(`X-Embernet-Assertion`), `hideLogin`(`true`)입니다.

관리자 로그인과 API 토큰은 그 옆에서 계속 동작합니다. 이는 직원과 자동화를 위한 비상 수단이며, 에디터의 양식이 사라져도 영향을 받지 않습니다.

이미지: `ghcr.io/hotloop-io/hotloop-flow:2.4.0`, linux/amd64와 linux/arm64. 차트: `https://hotloop.io/hotloop-flow/`. 이 태그의 README에 나머지가 있습니다: https://github.com/HotLoop-io/hotloop-flow/blob/v2.4.0/README.md
