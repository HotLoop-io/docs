---
title: "core 4.21.0 릴리스 노트"
description: "HotLoop core 4.21.0에 담긴 내용, 업그레이드할 때 달라지는 점, 가동 중인 플랜트를 건드리기 전에 읽어야 할 내용입니다."
sidebar:
  label: "4.21.0"
---

이번 릴리스는 OPC UA 서버에 X.509 로그인을 더하고, 64바이트 비밀번호 제한을 없애며, 폐기된 보안 정책을 기본으로 끕니다. CODESYS 알람 가져오기도 넓힙니다. [4.20.2](/ko/releases/hotloop-4-20-2/) 위에 만들어졌습니다.

## 바뀐 내용

- **클라이언트가 X.509 인증서로 OPC UA 서버에 로그인할 수 있습니다.** 관리자가 클라이언트의 공개 인증서를 HotLoop 사용자에 연결하면(Settings, OPC UA certificates, API 또는 MCP 도구), 개인 키를 가진 클라이언트가 그 사용자의 권한으로 그 사용자로 로그인합니다. 인증서를 폐기하면 진행 중인 세션이 10초 안에 끝나며, 모든 인증서 로그인과 모든 거부가 logbook에 남습니다. `HOTLOOP_OPCUA_SERVER_ALLOW_X509=true`(차트 `opcuaServer.allowX509`)를 설정하기 전에는 꺼져 있습니다. 장치 드라이버도 `userCertificate`와 `userPrivateKey`(RSA, 키는 비밀번호처럼 봉인됨)로 같은 방식으로 로그인할 수 있습니다. 이름 규칙이 있는 신뢰 CA는 구현되지 않았습니다.
- **65바이트에서 72바이트 비밀번호가 이제 OPC UA로 로그인됩니다.** 웹 UI에서는 항상 동작했습니다. 서버가 기반하는 라이브러리가 비밀번호가 64바이트를 넘는 모든 사용자 이름 토큰을 거부했습니다.
- **폐기된 보안 정책 `Basic128Rsa15`와 `Basic256`은 기본으로 꺼져 있습니다.** 서버는 더 이상 이를 나열하지 않으며, 이름으로 요청하는 클라이언트는 채널이 열릴 때 거부됩니다. 새 설치와 업그레이드 모두에 적용됩니다. 더 새로운 것을 쓰지 못하는 레거시 클라이언트는 `HOTLOOP_OPCUA_SERVER_ALLOW_DEPRECATED_POLICIES=true`(차트 `opcuaServer.allowDeprecatedPolicies: true`)로 다시 연결되며, 서버는 시작할 때 그렇게 알립니다. 이를 끄는 옵션은 업스트림에서도 열려 있습니다(pull request 66).
- **CODESYS 알람 가져오기가 Outside range 알람을 읽습니다.** IDE의 Export Alarms는 이것을 `OutOfArea`로 쓰며, 하한의 `lo`와 상한의 `hi` 두 알람으로 넘어옵니다. Inside the range, Change, Event, Alarm (API)는 이유와 함께 건너뜀으로 나열됩니다. 여기에는 그것을 정직하게 말해 주는 것이 없기 때문입니다. 가져오기 기능은 IDE가 제공하는 모든 관측 유형을 내보낸 파일을 기준으로 넓혔고, 그 파일은 테스트 fixture로 보관합니다.

## API 변경 사항

- 신규: `GET /api/opcua/certificates`, `GET`과 `POST /api/users/{username}/certificates`, `POST /api/users/{username}/certificates/{thumbprint}/revoke`, `DELETE /api/users/{username}/certificates/{thumbprint}`이며 모두 `users.manage`입니다. 새 MCP 도구가 다섯 개이며 모두 133개입니다.
- 마이그레이션 하나, 0027: `user_certificates` 테이블(공개 인증서만)입니다. 백업에 포함됩니다.

## 업그레이드

평범한 `helm upgrade` 또는 Quadlet 자동 업데이트입니다. 먼저 OPC UA 클라이언트 중에 `Basic256`이나 `Basic128Rsa15`를 쓰는 것이 있는지 확인하세요(Ignition의 연결에서 확인됩니다). 그런 클라이언트는 업그레이드 후 `Basic256Sha256`으로 옮기거나 위의 레거시 스위치를 켜기 전까지 연결되지 않습니다. 새 테이블이 있는 상태에서 이전 릴리스로의 롤백은 시험하지 않았습니다.

- 네 차트(`hotloop`, `hotloop-iot`, `hotloop-edge`, `hotloop-edge-relay`) 모두 4.21.0이며, 이전의 모든 버전이 여전히 인덱스에 있습니다.

- 이 빌드는 amd64 전용이며 `stable`은 가지고 있는 arm 이미지를 유지합니다. 다음 릴리스는 arm 이미지를 빌드하는 작은 버전 올림입니다.
