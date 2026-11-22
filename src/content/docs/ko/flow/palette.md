---
title: "노드 팔레트"
description: "Flow가 제공하는 모든 노드 유형을 완전, 부분, 차이 있음, Flow 전용으로 분류하고, Node-RED와의 차이를 글로 적어 둡니다."
---

**메시지용 노드 유형 117개와 FlowLab 다이어그램용 39개가 더 있습니다.**

| 범주 | 노드 |
|---|---|
| 공통 | inject, debug, complete, catch, status, link in, link out, comment, junction |
| 함수 | function, switch, change, range, template, delay, trigger, exec, rbe |
| 네트워크 | ntfy out, gotify out, discord out, discord bot out, kafka out, mqtt in/out, http in, http response, http request, websocket in/out, tcp in/out, tcp request, udp in/out, modbus read/write, s7 read/write, ethernetip read/write, opcua read/write/subscribe, sparkplug in/out/command, hotloop in/state/script/recipe, mcp tool/result/client, e-mail, 그리고 Node-RED의 modbus-read/getter/flex-getter/write/flex-write/server 노드 |
| 시퀀스 | split, join, sort, batch |
| 파서 | csv, html, json, xml, yaml |
| 저장소 | file, file in, watch, influxdb out, postgres, postgresql |
| 대시보드 | ui_text, ui_numeric, ui_button, ui_switch, ui_text_input, ui_led, ui_gauge, ui_chart, ui_template, 그리고 페이지를 구성하는 ui_base, ui_tab, ui_group, ui_link, ui_spacer |
| 탐색 | scan, netinfo, OT 세그먼트의 인벤토리 작성용 |
| 설정 | hotloop-flow-ntfy, hotloop-flow-gotify, hotloop-flow-discord-bot, hotloop-flow-kafka, mqtt-broker, websocket-listener, websocket-client, influxdb, postgres, modbus, s7, ethernetip, opcua, sparkplug, hotloop, mcp-server, modbus-client, postgreSQLConfig |
| FlowLab | constant, math, compare, logic, wait, bundle, field, build array, while loop, for loop, body in, body out, serial port, serial read, serial write, parse reading, stable value, log to text file, log to TDMS file, statistics, integral, derivative, filter, read DAQ task, mqtt out, postgres out, control, indicator, chart |

FlowLab 행은 다른 종류의 노드입니다. 다이어그램인 탭에서 실행되며, 노드는 모든 입력에 값이 있을 때 한 번 실행되고 메시지를 받지 않습니다. FlowLab이 무엇인지, 그리고 루프, 오류 와이어, 패널, 디버거가 어떻게 동작하는지는 [FlowLab](/ko/flow/flowlab/)에 있습니다. 플로 파일 하나, 즉 다이어그램 한 세트는 테넌트가 EmberNet에서 실행하는 모든 Flow 설치에 푸시할 수 있으며, 각각 검사되고 실패한 것은 되돌려집니다. [테넌트의 스테이션으로 푸시하기](/ko/flow/stations/)를 보세요. 두 설치가 임대(lease)와 장비에 쓰는 모든 쓰기의 펜스로 한 설치의 일을 나눠 맡아 한쪽만 쓰게 할 수 있습니다. [임대를 사용하는 웜 스탠바이](/ko/flow/failover/)를 보세요.

## 사람에게 알리기와 Kafka

다섯 노드는 메시지가 담은 내용을 다른 곳으로 보내고 메시지를 그대로 넘깁니다. **ntfy out**, **gotify out**, **discord out**(웹훅), **discord bot out**, **kafka out**입니다. HotLoop 코어가 알람과 이벤트를 보낼 때 쓰는 것과 같은 설정을 받으므로, 이미 ntfy 토픽, Gotify 애플리케이션, Discord 웹훅, Kafka 클러스터가 있는 공장은 Flow를 같은 곳으로 지정하면 됩니다.

- **ntfy.** 서버 설정 노드(주소, 그다음 액세스 토큰 또는 사용자 이름과 비밀번호, 누구나 게시할 수 있는 서버라면 없음), 그리고 노드마다 토픽, 제목, 우선순위(min에서 max까지, 또는 `msg.priority`), 태그, 클릭 주소가 있습니다. 비어 있는 토픽이나 제목은 `msg.topic` 또는 `msg.title`을 사용합니다. 공개 서버에서는 토픽이 유일한 비밀이므로 모든 오류와 상태에서 제외됩니다.
- **Gotify.** 애플리케이션 토큰이 있는 서버 설정 노드, 그리고 노드마다 제목과 0에서 10까지의 우선순위가 있습니다.
- **Discord 웹훅.** 웹훅 URL이 자격 증명의 전부이며 노드에 있고, 주소를 언급하는 네트워크 오류를 포함해 상태, 로그, 오류 어디에도 표시되지 않습니다. 제목이나 색을 지정하면 메시지가 임베드가 됩니다. 내용은 2,000자, 임베드의 설명은 4,096자에서 잘리며, Discord가 세는 방식으로 셉니다. 메시지에 포함된 어떤 것도 누구도 호출하지 않습니다.
- **Discord 봇.** 토큰이 있는 봇 설정 노드, 그리고 노드마다 채널 ID(또는 `msg.channel`)가 있습니다. 봇으로서 게시하며, 봇이 채널에 있고 전송 권한이 있어야 합니다.
- **Kafka out.** 클러스터 설정 노드(브로커, SASL PLAIN 또는 SCRAM-SHA-256 또는 SCRAM-SHA-512, TLS), 그리고 노드마다 토픽과 선택적 키가 있습니다. 값은 `msg.payload`이며 텍스트로, 텍스트가 아니면 JSON으로 보내고, 클러스터가 모든 동기화된 복제본에서 확인한 뒤에 메시지가 다음으로 넘어갑니다. 코어의 Kafka 출력이 사용하는 클라이언트인 franz-go를 사용합니다.

서버가 거부하면 노드의 오류에 이유가 표시되며 보낸 내용은 들어 있지 않습니다. 속도 제한은 서버가 알려 준 시간(최대 1분)만큼 한 번 기다리고, 그 뒤에는 메시지가 실패합니다. Slack 노드와 Teams 노드는 없고 UADP 노드도 없습니다. HotLoop이 UADP를 받아들이고 Flow는 그 값을 HotLoop 노드를 통해 읽습니다.

실제 ntfy, 실제 Gotify, 실제 Redpanda를 대상으로 검증했습니다. 노드가 게시한 뒤 서버에 무엇을 갖고 있는지 물어봅니다. Discord 노드는 웹훅과 봇에 대한 Discord의 공개 API를 따릅니다.

`scan`은 CIDR 범위를 훑어 Modbus와 EtherNet/IP 엔드포인트를 식별하고, `netinfo`는 런타임이 실제로 볼 수 있는 인터페이스를 보고합니다. macvlan 모드에서는 플로가 OT VLAN에서 자기 주소를 찾는 방법입니다. Modbus TCP, S7, EtherNet/IP, OPC UA, Sparkplug B 노드는 이제 `scan`이 찾은 대상과 통신할 수 있으며, 다음 섹션이 그 내용입니다.

노드 유형마다 Go 디스크립터 하나가 속성, 포트, 기본값, 도움말 텍스트를 선언하고, 편집기가 그것으로 대화상자를 그리므로 노드가 런타임과 어긋나는 대화상자를 가진 채 출시될 수 없습니다.
