---
title: "core 4.24.2 릴리스 노트"
description: "HotLoop core 4.24.2에 담긴 내용, 업그레이드할 때 달라지는 점, 가동 중인 플랜트를 건드리기 전에 읽어야 할 내용입니다."
sidebar:
  label: "4.24.2"
---

HotLoop은 모든 세대의 Shelly 장치를 직접 읽고 제어하고, ONVIF 카메라를 찾아 그 스트림과 스냅샷, 팬·틸트·줌을 제공하며, Firmata로 Arduino와 통신하고, 사양이 요구하는 방식으로 길이에 상관없이 OPC UA 비밀번호를 보냅니다. 느린 링크가 더 이상 엣지 노드를 디스크에 붙잡아 두지 않고, `--version`은 이미지를 빌드한 커밋을 알려 줍니다. HotLoop Edge의 기본 설치가 시작됩니다. amd64 전용으로 빌드했으며, 멀티 아키텍처 빌드는 다음 버전으로 이어집니다.

## 바뀐 내용

- **모든 세대의 Shelly.** Gen2 이상은 실시간 웹소켓을 쓰는 RPC로, 변경과 버튼 누름이 일어나는 순간 도착하며, Gen1은 자체 HTTP 인터페이스로 읽습니다. 버튼 누름은 장치 아래 로그북에 기록됩니다. SHELLY.md를 참고하세요.
- **ONVIF 카메라.** 네트워크에서 카메라를 찾고(WS-Discovery), 각 장치의 정보, 모든 미디어 프로필의 스트림과 스냅샷 주소(Media와 Media2), 팬·틸트·줌, 카메라 자체 이벤트를 태그와 로그북 줄로 읽습니다. 프로필의 현재 화면은 라우트 하나면 가져옵니다. ONVIF.md를 참고하세요.
- **Firmata로 연결하는 Arduino.** USB 시리얼 또는 TCP로, 디지털·아날로그 핀, PWM, 서보, I2C 장치를 태그로 다룹니다. FIRMATA.md를 참고하세요.
- **길이에 상관없는 OPC UA 비밀번호.** 64바이트를 넘는 비밀번호가 이제 사양이 요구하는 방식(RsaEncryptedSecret, 파트 4, 7.40.4)으로 클라이언트에서 서버로 OPC UA를 통해 전달되며, 이전 서버도 계속 로그인됩니다. OPC Foundation의 자체 스택을 상대로 검증했습니다. [OPC UA 서버](/ko/edge/opc-ua-server/)를 참고하세요.
- **느린 링크가 더 이상 노드를 디스크에 묶어 두지 않습니다.** 디스크의 마지막 부분을 가져오는 패스가 이제 그 뒤에 들어오는 것을 메모리에서 보내므로, 느린 링크 뒤의 전달 큐가 비고 노드는 폴링마다 fsync하는 대신 디스크를 벗어납니다.
- **`--version`이 커밋을 알려 줍니다.** 모든 이미지가 버전과 함께 빌드한 커밋을 알려 줍니다.
- **WebVisu 옆에 나란히 놓은 CODESYS 화면.** CODESYS 비주얼라이제이션의 가져오기를 실제 WebVisu를 상대로 같은 PLC 변수로 구동해 실행하고, 둘을 브라우저에서 비교합니다.
- **docs/legacy 로드맵 항목에 체크 표시를 했습니다.**
- **HotLoop Edge의 기본 설치가 시작됩니다.** 파드가 더 이상 존재하지 않는 Secret에서 Gotify 토큰, Discord 웹훅 URL, Discord 봇 토큰을 읽지 않습니다. 각각은 자격 증명이 설정되었을 때만 전달되며, 차트 검사는 렌더가 만들지 않는 해당 Secret에 대한 모든 참조를 실패로 처리합니다. 대상이 설정되었거나 기존 Secret이 지정된 차트는 이전처럼 렌더됩니다.
- **양방향으로 돌리는 Ignition 랩.** HotLoop의 Ignition 검증이 이제 반대 방향으로도 실행되고, 라우터를 건너는 멀티캐스트 UADP 검증이 추가되었으며, 가장 큰 보고서의 크기를 측정했습니다. [예약 보고서](/ko/gateway/reports/)를 참고하세요.
- **테스트가 기다리는 것을 기다립니다.** 휴대폰 앱의 워밍업은 로그인된 페이지를 기다리고, 에너지 양식은 필드를 한 번에 채웁니다.

## 마이그레이션

없습니다.

## API 변경 사항

라우트 두 개, 둘 다 새것입니다. `POST /api/onvif/discover`(`devices.write`)는 네트워크에서 ONVIF 카메라를 탐색하며 아무것도 추가하지 않습니다. `GET /api/onvif/{id}/profiles/{profile}/snapshot`(`devices.read`)은 카메라 프로필의 현재 JPEG를 반환합니다. 기존 라우트는 바뀌지 않았습니다. [HTTP API](/ko/iot/api/)를 참고하세요.

## 4.24.0에서 업그레이드

평범한 `helm upgrade`입니다. 마이그레이션도 새 secret도 없습니다.

## 검증되지 않은 것

- Shelly, ONVIF, Firmata는 실제 장치의 녹화본, ONVIF 자체가 생성한 스택, 시뮬레이션한 Uno 위의 Arduino 프로젝트 자체 StandardFirmata를 상대로 실행했습니다. 실물 Shelly, 카메라, Arduino는 아직 벤치에 올라가지 않았습니다.
- WebVisu와의 나란히 비교는 CODESYS Control for Linux SL 4.22.0.0 런타임을 상대로 테스트에서 실행됩니다.
