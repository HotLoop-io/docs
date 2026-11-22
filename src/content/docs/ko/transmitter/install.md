---
title: "HotLoop Transmitter 설치"
description: "CODESYS 라이브러리 저장소에 라이브러리를 설치하고 프로젝트에 추가하는 방법, 블록이 오류를 보고할 때 해야 할 일."
---

CODESYS 개발 시스템 3.5 SP22 이상과, 대상에 SysSocket 및 SysTimeRtc 컴포넌트가 있는 런타임이 필요합니다. CODESYS Control for Linux SL 런타임에는 둘 다 들어 있습니다(두 번째는 타임스탬프를 위해 1.1.0에서 새로 추가되었습니다).

## CODESYS Installer로 설치

1.1.0부터 릴리스에는 `HotLoopTransmitter-1.1.0.package`도 있습니다. 주소는 https://hotloop.io/hotloop-transmitter/1.1.0/HotLoopTransmitter-1.1.0.package 입니다. CODESYS Installer(IDE에서 Tools, CODESYS Installer)로 설치하거나, 창 없이 명령줄 `PackageManagerCLI.exe --profile="<your profile>" --install=<file>.package --targetProfiles="<your profile>"`로 설치합니다. Installer가 해당 프로필의 라이브러리 저장소에 HotLoop 회사 아래로 라이브러리를 넣으면 아래 3단계로 넘어가면 됩니다. 패키지는 `.library` 파일과 같은 라이브러리를 Installer가 읽는 ZIP에 담은 것이므로, 두 방법의 결과는 같습니다.

## 라이브러리 파일로 설치

1. https://hotloop.io/hotloop-transmitter/1.1.0/HotLoopTransmitter-1.1.0.library 에서 `HotLoopTransmitter-1.1.0.library`를 내려받고, 같은 폴더의 `SHA256SUMS`로 확인합니다(`sha256sum -c SHA256SUMS`).
2. CODESYS IDE에서 Tools, Library Repository, Install을 열어 파일을 고릅니다. 이제 저장소에 HotLoop 회사 아래로 들어갑니다.
3. 프로젝트에서 애플리케이션의 Library Manager를 열고 Add Library에서 HotLoop Transmitter를 고릅니다. SysSocket, SysTimeRtc와 그 인터페이스 라이브러리는 종속성으로 함께 들어오므로 따로 할 일이 없습니다.
4. `HLTX.FB_HLTX_Publisher`를 선언하고 필드를 추가한 뒤 사이클마다 호출합니다(예제는 README에 있습니다).
5. 컨트롤러에 다운로드합니다. 대상은 컨트롤러의 네트워크에서 닿을 수 있어야 하며, 멀티캐스트라면 네트워크의 스위치가 해당 그룹을 전달해야 합니다.

`.compiled-library` 파일은 소스가 빠진 같은 라이브러리입니다. Library Manager에 Structured Text가 보이지 않기를 원하면 이쪽을 설치하세요. 같은 폴더에 `HotLoopTransmitter-1.1.0.compiled-library`로 있습니다.

무엇이 도착하는지 확인하려면 대상 포트의 어떤 UDP 리스너든 쓸 수 있습니다. 포트에서 수신하거나 멀티캐스트 그룹에 가입해 각 데이터그램을 헥사 값과 함께 JSON 한 줄로 출력하는 작은 Go 프로그램이면 충분합니다.

## 블록이 오류를 보고할 때

| `eError` | 의미 | 조치 |
|---|---|---|
| `NoFields` | 추가된 필드가 없음 | 활성화하기 전에 `Add` 메서드를 호출 |
| `BadInterval` | `tPublishingInterval`이 1 ms 미만 | 값을 설정 |
| `BadAddress` | `sDestination`이 점으로 구분한 IPv4 주소가 아님 | 주소를 수정 |
| `SocketCreate`, `SocketOption` | 런타임이 소켓 호출을 거부함. 코드는 `diLastSocketResult`에 있음 | `tRetry` 후 블록이 스스로 다시 시도 |
| `TooBig` | 필드가 1472바이트에 들어가지 않음 | 발행할 필드를 줄이거나, writer id가 다른 퍼블리셔 두 개를 사용 |
| `BadField` | 저장된 주소가 지워짐 | `Clear()` 후 필드를 다시 추가 |
