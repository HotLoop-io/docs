---
title: "내장 MQTT 브로커"
description: "같은 프로세스 안의 브로커로, 작은 장비 하나가 설치 전체가 될 수 있습니다. 리스너, 계정, 켜는 설정을 설명합니다."
---

HotLoop는 4.11.0부터 자체 MQTT 브로커를 프로세스 안에서 실행할 수 있으므로, 장비 한 대로 구성하는 작은 HotLoop 설치에는 따로 배포할 것이 없습니다. 기본값은 꺼짐(`HOTLOOP_BROKER_ENABLED`)입니다. 이미 Mosquitto나 EMQX를 실행하는 배포에는 이것을 연결할 대상이 없으며, 이미 있는 브로커 옆에 두 번째 브로커를 시작하는 것은 함부로 가정할 만한 안전한 기본값이 아니기 때문입니다.

## 존재하는 이유

엣지 퍼블리시(Gateway가 Sparkplug 엣지 노드로 동작)와 플릿 관리(등록된 엣지 릴레이 추적)는 둘 다 `BrokerAddress`를 통해 MQTT 브로커에 *바깥으로* 연결하며, 스스로 브로커를 실행한 적은 없습니다. 배포에 이미 브로커가 있다면, 기존 Mosquitto 인스턴스이든 다른 이유로 HotLoop 옆에서 실행되는 것이든 괜찮습니다. 하지만 *유일한* 선택지로는 괜찮지 않습니다. 이 프로젝트는 공장이 의존하는 움직이는 부품의 수를 줄이기 위해 존재하는데, Gateway 하나를 위한 Sparkplug 허브를 얻으려고 두 번째 인프라를 요구하면 뒷문으로 움직이는 부품을 다시 들이는 셈이기 때문입니다.

`HOTLOOP_BROKER_ENABLED=true`로 설정하면 같은 프로세스가 자신의 주소에서 MQTT 연결을 수신합니다. 엣지 퍼블리시, 플릿 관리, 또는 외부 엣지 릴레이의 `HOTLOOP_EDGE_PUBLISH_BROKER`를 모두 `localhost:1883`(클러스터 안에서는 Gateway 자체의 Service 주소)으로 지정할 수 있습니다.

## 사용할 때와 사용하지 말아야 할 때

**다음에는 사용하십시오.** Gateway 한 대, 엣지 릴레이 몇 대, 그리고 히스토리안, 알람 엔진, HTTP API와 프로세스를 공유하는 내장 브로커가 무리 없이 처리할 수 있는 트래픽 양, 즉 이 프로젝트 전체가 목표로 하는 일반적인 경우입니다. 공장 하나, 장비 한 대, 최소한의 인프라입니다.

**다음에는 사용하지 마십시오.** 실제 규모의 프로덕션급 브로커를 대체하는 용도로는 사용하지 마십시오. 서로 독립된 여러 Sparkplug 호스트 애플리케이션, 매우 높은 팬아웃, 사이트 간 브리징, 또는 클러스터링, 수평 확장, 브로커 자체의 전용 운영 도구(상세 지표, 동적 ACL, 플러그인 생태계)가 필요한 워크로드는 모두 Mosquitto, EMQX 또는 다른 전용 브로커를 실행해야 하는 타당한 이유이며, 이미 다른 배포에서 할 수 있듯이 Gateway의 `EdgePublishConfig`/`FleetConfig`를 그쪽으로 지정하면 됩니다. 이 패키지는 그런 사용 사례와 경쟁하지 않습니다. 브로커가 전혀 없었을 배포를 위해 존재합니다.

## 로그인과 각 로그인이 접근할 수 있는 범위

세 종류의 로그인이 접속할 수 있으며, 이들은 동등하지 않습니다.

**HotLoop에서 만든 로그인**(Settings, MQTT 또는 [HTTP API](/ko/iot/api/)의 `/api/broker/logins`)에는 규칙이 있습니다. 로그인이 발행할 수 있는 토픽과 구독할 수 있는 토픽입니다. 규칙의 `%u`는 로그인 자신의 이름이고 `%p`는 디스커버리 접두사입니다. 프로필에서 시작하며 이후에 직접 편집할 수 있습니다.

| 프로필 | 발행 | 구독 | 용도 |
|---|---|---|---|
| `shelly` | `%u/#`, `shellies/announce` | `%u/#`, `shellies/command`, `%p/status` | Shelly Gen2 이상, 로그인 이름을 MQTT 토픽 접두사와 같게 지정 |
| `esphome` | `%u/#`, `%p/+/%u/+/config`, `esphome/discover/%u` | `%u/#`, `%p/status`, `esphome/discover` | ESPHome 노드, 로그인 이름을 노드 이름과 같게 지정 |
| `tasmota` | `tele/%u/#`, `stat/%u/#`, `tasmota/discovery/+/config`, `tasmota/discovery/+/sensors` | `cmnd/%u/#`, `cmnd/tasmotas/#` | Tasmota 장치, 로그인 이름을 토픽과 같게 지정 |
| `zigbee2mqtt` | `%u/#`, `%p/#` | `%u/#`, `%p/status` | Zigbee2MQTT 브리지, 로그인 이름을 기본 토픽과 같게 지정 |
| `integration` | 없음 | `#` | 대시보드, 히스토리안, MQTT Explorer를 쓰는 사용자 |
| `full` | `#` | `#` | 무엇이든, 공장 전체 |

Shelly의 로그인 이름을 토픽 접두사와 같게 하면 자신을 알리고 자기 이름으로 보고할 수 있으며, 그것이 전부입니다. `cmnd/boiler/POWER`에 발행할 수 없고, 다른 장치의 이름으로 장치를 알릴 수 없으며, `#`을 구독해 공장을 읽을 수 없습니다. 브로커는 모든 발행, 모든 구독, 그리고 구독자에게 나가는 모든 메시지를 검사하므로 영리한 와일드카드로 규칙을 늘릴 수 없습니다. 클라이언트가 연결할 때 last will도 검사합니다. 브로커 라이브러리는 will을 아무에게도 묻지 않고 발행하므로, will이 발행할 수 없는 곳을 가리키는 로그인은 접속할 수 없습니다. 그렇지 않으면 값싼 플러그가 보일러에 유지된 `ON`을 남기고 스스로 전원을 뽑을 수 있습니다.

로그인의 변경은 해당 클라이언트의 다음 패킷부터 적용됩니다. 로그인을 좁히면 연결된 장치는 그 즉시 토픽을 잃고, 로그인을 삭제하면 아직 연결되어 있는 클라이언트는 아무것도 할 수 없고 다시 연결할 수도 없습니다. 비밀번호는 모든 백업에 포함되는 `broker_logins`에 bcrypt 해시로 저장되며, API는 둘 중 어느 것도 응답하지 않습니다.

Zigbee2MQTT는 예외입니다. 브리지 하나가 무선에 연결된 모든 장치를 알리므로, 해당 프로필은 접두사 아래 어디에나 발행할 수 있습니다. 그것이 브리지의 역할이며, Discovered 화면에 누가 무엇을 알렸는지 표시되는 이유입니다.

**`HOTLOOP_BROKER_USERS`**는 `user:password` 쌍의 예전 목록입니다(첫 번째 콜론만 구분하므로 비밀번호에 콜론이 들어갈 수 있습니다). 이 로그인은 4.16과 4.17과 똑같이 모든 토픽에서 무엇이든 할 수 있습니다. 의도된 것입니다. 작성한 적 없는 ACL에 갑자기 Sparkplug 트래픽이 막히는 공장으로 업그레이드하는 사람은 없습니다. 또한 이 로그인 하나하나가 공장 전체의 열쇠라는 뜻이기도 합니다. 장치는 HotLoop에서 만든 로그인으로 옮기고, 환경 변수 로그인은 정말 모든 권한이 필요한 것(플릿, 엣지 릴레이, 엣지 퍼블리셔)에만 두십시오. 상수 시간으로 검사하며, 비밀번호가 틀린 사용자 이름은 거부됩니다.

**익명**(`HOTLOOP_BROKER_ALLOW_ANONYMOUS`, 기본값 `false`)은 포트에 접근할 수 있는 누구에게나 무엇이든 허용합니다. 신뢰할 수 있는 LAN이나 테스트 장비를 위해 배포마다 선택하는 옵션이며, 이 프로세스가 스스로 괜찮다고 판단하는 일은 절대 없고, 켜져 있는 동안 Discovered 화면에 빨간색으로 표시됩니다. 사용자 이름을 보내는 클라이언트에게는 아무것도 완화되지 않습니다. 틀린 비밀번호는 여전히 틀린 비밀번호입니다.

`HOTLOOP_BROKER_USERS`가 없고 익명이 꺼져 있는 브로커도 문제없이 시작됩니다. 누군가 HotLoop에서 로그인을 만들기 전까지는 HotLoop만 연결할 수 있습니다.

다른 브로커는 각자의 몫입니다. Mosquitto나 EMQX에서는 ACL을 그 브로커가 적용하며, 이는 [플릿 관리](/ko/gateway/fleet/)가 긋는 것과 같은 경계이고, [MQTT 디스커버리](/ko/iot/mqtt-discovery/)에는 그곳에서 HotLoop 자체 로그인을 위한 ACL이 있습니다.

## 디스커버리와 HotLoop 자체 로그인

브로커를 켜면 HotLoop는 그 브로커에서 스스로를 알리는 장치를 수신합니다([MQTT 디스커버리](/ko/iot/mqtt-discovery/) 참조). 브로커는 각 디스커버리 구성을 어떤 로그인과 클라이언트가 발행했는지 기록합니다. Discovered 화면에 이것이 표시되며, 한 로그인에서 수락한 장치가 다른 로그인에서 알려지면 로그에 경고("Kitchen re-announced by login garage-node; it was accepted from kitchen-node")와 함께 사람이 판단하도록 보류됩니다. 누군가 장치를 새 로그인으로 옮겼거나, 로그인이 자신이 아닌 장치를 사칭하고 있는 것입니다. 어느 쪽인지는 사람이 결정합니다.

이 브로커에서 HotLoop 자체 클라이언트(디스커버리 리스너와 발견된 장치의 드라이버)는 브로커가 시작할 때마다 만들어 메모리에만 보관하는 로그인으로 접속합니다. 무엇이든 할 수 있습니다. 이것을 위해 구성할 것도, 디스크에 있는 것도, 백업에 들어가는 것도 없으며, 재시작할 때마다 다른 로그인이 됩니다.

## TLS

브로커를 켜면 일반 TCP 리스너(`HOTLOOP_BROKER_LISTEN_ADDR`, 기본값 `:1883`)가 항상 제공됩니다. `HOTLOOP_BROKER_TLS_ENABLED=true`와 `HOTLOOP_BROKER_TLS_CERT_FILE`, `HOTLOOP_BROKER_TLS_KEY_FILE`을 설정하면 해당 인증서로 종단하는 두 번째 독립 리스너(`HOTLOOP_BROKER_TLS_LISTEN_ADDR`, 기본값 `:8883`)가 추가됩니다. TLS를 켜면 두 리스너가 동시에 실행되며, 평문 리스너를 닫는 것은 없으므로, TLS로만 접근하게 하려는 운영자는 네트워크 계층(NetworkPolicy, 방화벽 규칙)에서 이를 강제합니다. 이 차트가 더 넓은 네트워크 노출 결정을, 애플리케이션이 스스로 어느 포트에 접근할 수 있는지 정하는 대신 `networkPolicy.ingress`에 맡기는 것과 같은 방식입니다.

SMTP 채널이 단일 연결 안에서 STARTTLS로 업그레이드하는 것과 달리, 브로커의 TLS 리스너는 별도의 두 번째 소켓입니다. 이는 Mosquitto, EMQX, 대부분의 MQTT 브로커가 평문 포트 옆에 TLS 포트를 두는 것과 같은 형태이며, (SMTP와 달리) 널리 구현된 연결 내 업그레이드가 없는 MQTT에 더 자연스럽습니다.

이 패키지는 자체 서명이든 다른 방식이든 자체 인증서를 생성하지 않습니다. 하류의 어떤 것도 스스로 만든 인증서를 신뢰하지 않을 것이므로, 실제 인증서(내부 CA, `cert-manager`, 또는 다른 출처)는 항상 운영자가 제공해야 합니다.

## 구성

| 변수 | 기본값 | <span class="sr-only">Details</span> |
|---|---|---|
| `HOTLOOP_BROKER_ENABLED` | `false` | 이 값을 설정하기 전까지 기능이 꺼져 있음 |
| `HOTLOOP_BROKER_LISTEN_ADDR` | `:1883` | 평문 TCP 리스너 |
| `HOTLOOP_BROKER_TLS_ENABLED` | `false` | 두 번째 독립 TLS 리스너를 추가 |
| `HOTLOOP_BROKER_TLS_LISTEN_ADDR` | `:8883` | TLS를 켠 경우에만 사용 |
| `HOTLOOP_BROKER_TLS_CERT_FILE` / `_KEY_FILE` | n/a | TLS를 켠 경우 필수 |
| `HOTLOOP_BROKER_ALLOW_ANONYMOUS` | `false` | 배포마다 선택하는 옵션이며, 기본으로 켜지 마십시오 |
| `HOTLOOP_BROKER_USERS` | 없음 | `user:password,user2:password2`. 각각 무엇이든 할 수 있음. 위를 참조. 규칙이 있는 로그인은 HotLoop에서 만듭니다 |
| `HOTLOOP_BROKER_DISCOVERY` | `true` | 스스로를 알리는 장치를 수신, [MQTT 디스커버리](/ko/iot/mqtt-discovery/) 참조 |
| `HOTLOOP_BROKER_DISCOVERY_PREFIX` | `homeassistant` | 알림이 도착하는 토픽 접두사 |

## 검증된 것과 그렇지 않은 것

HotLoop는 실제 장비와 실제 서버를 대상으로 실행했으며, 2026-11-17에는 실제 장비에서도 실행했습니다.
