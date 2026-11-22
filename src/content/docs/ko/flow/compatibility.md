---
title: "Node-RED 호환성"
description: "Node-RED와 의도적으로 다른 모든 부분을 노드별로 이유와 함께 정리해, 가져온 플로가 이전과 같은 결과를 내도록 돕습니다."
---

<!-- Generated from the node registry. Do not edit by hand, change the `Compatibility` field on the node's descriptor and regenerate: -->

부분적으로만 호환되면서 어떻게 그런지 말하지 않는 노드는 눈에 띄게 없는 노드보다 나쁩니다. 플로는 동작하는 것처럼 보이지만 조용히 엉뚱한 일을 하기 때문입니다. 아래의 모든 항목은 무엇이 빠졌는지 밝혀야 하며, 밝히지 않은 항목이 있으면 테스트가 빌드를 실패시킵니다.

## 수준의 의미

| 수준 | 의미 |
|---|---|
| **완전** | 같은 유형의 Node-RED 노드와 똑같이 동작합니다. |
| **부분** | 일부만 지원합니다. 비고에 빠진 부분이 정확히 무엇인지 적혀 있습니다. |
| **차이 있음** | 의도적으로 다르게 동작합니다. 비고에 이유가 적혀 있습니다. |
| **HotLoop Flow 전용** | Node-RED에 대응하는 노드가 없습니다. |

## 전혀 지원하지 않는 것

**대부분의 Node-RED 커뮤니티 노드.** 이들은 Node.js가 필요한 npm 패키지입니다. Node가 필요한 패키지가 여기서 동작하게 만들 방법은 없습니다. 공장이 실제로 의존하는 Modbus, 대시보드, PostgreSQL, 이메일은 각자의 유형 이름으로 네이티브 실행됩니다. node-red-types.md를 참고하십시오. 그 밖의 노드는 유형 이름을 밝히며 스스로 실패하고, 플로의 나머지는 시작됩니다.

## JSONata

`jsonata` 유형의 모든 속성은 순수 Go로 구현한 JSONata 2.x인 gnata가 평가하며, Node-RED 자체 함수인 `$flowContext`, `$globalContext`, `$env`, `$clone`과 `msg`를 지정하는 레거시 형식이 연결되어 있습니다. 공개된 jsonata-js 2.2.2 테스트 스위트의 1686개 사례 중 1673개를 통과합니다.

Node-RED와 다른 점이 세 가지 있습니다. moment.js는 여기서 다시 구현하지 않으므로 `$moment`는 `$fromMillis`와 `$toMillis`를 알려 주는 오류와 함께 거부됩니다. 메시지 객체에는 키 순서가 없으므로 `$keys()`와 객체를 순회하는 모든 것은 정렬된 키를 봅니다. 그리고 10초가 지나도 끝나지 않는 평가는 노드의 큐 전체를 멈추게 하는 대신 D1012로 중단됩니다.

## 요약

등록된 노드 유형은 117개입니다.

| 수준 | 개수 |
|---|---|
| 완전 | 12 |
| 부분 | 50 |
| 차이 있음 | 14 |
| HotLoop Flow 전용 | 41 |

## 공통

| 유형 | 수준 | 비고 |
|---|---|---|
| `catch` | 완전 | 해당 없음 |
| `comment` | 완전 | 해당 없음 |
| `complete` | 완전 | Node-RED와 마찬가지로 자신의 범위에서 명시적으로 선택된 노드만 감시합니다. |
| `debug` | 완전 | 해당 없음 |
| `inject` | 부분 | 간격, 시작 시, cron 일정에 따른 주입을 지원합니다. crontab은 Node-RED 자체 스케줄러인 cronosjs가 읽는 방식 그대로, 프로세스의 현지 시간으로 읽으며, 시계가 바뀔 때 사라지거나 반복되는 시간 처리도 같습니다. 관리 API로 하는 수동 주입은 항상 설정된 속성을 보냅니다. Node-RED의 이 값으로 주입(msg.__user_inject_props__)은 구현되어 있지 않습니다. |
| `junction` | 완전 | 해당 없음 |
| `link call` | 완전 | Link In을 호출하고, 반환 모드의 Link Out이 돌려보내는 것을 그대로 보냅니다. 호출 안에서 한 호출도 포함합니다. 정적 대상은 id로 선택합니다. 동적 모드에서 msg.target은 id 또는 이름이며, 호출하는 플로에서 먼저 찾고 그다음 모든 플로에서 찾되 서브플로 인스턴스 안은 절대 찾지 않습니다. 제한 시간 안에 반환이 없는 호출은 원래 메시지와 함께 오류를 일으키며, 그 뒤에 도착한 반환도 Node-RED처럼 그대로 나갑니다. |
| `link in` | 완전 | 해당 없음 |
| `link out` | 차이 있음 | 두 모드를 모두 지원합니다. Link In 노드로 보내기, 그리고 메시지를 보낸 Link Call로 되돌리기입니다. 의도적인 차이가 하나 있습니다. 실행 중이 아닌 Link In, 그리고 돌아갈 Link Call이 없는 반환은 Catch 노드가 볼 수 있는 오류를 일으킵니다. Node-RED는 전자를 조용히 버리고 후자는 경고만 기록하므로, 삭제되었거나 잘못 입력된 링크를 찾기가 매우 어렵습니다. |
| `status` | 완전 | 해당 없음 |

## 설정

| 유형 | 수준 | 비고 |
|---|---|---|
| `hotloop-flow-discord-bot` | HotLoop Flow 전용 | HotLoop Flow 자체 Discord 봇으로, HotLoop core의 봇이 쓰는 것과 같은 봇 토큰을 사용합니다. |
| `hotloop-flow-ethernetip` | HotLoop Flow 전용 | HotLoop Flow 자체 EtherNet/IP 연결로, ControlLogix, CompactLogix, Micro800 컨트롤러의 태그에 접근합니다. 첫 요청에서 연결하고, 신뢰할 수 없게 만드는 실패가 생기면 연결을 끊고, 다음 요청에서 다시 연결합니다. |
| `hotloop-flow-gotify` | HotLoop Flow 전용 | HotLoop Flow 자체 Gotify 서버로, HotLoop core가 알람을 게시할 때 쓰는 것과 같은 설정을 사용합니다. |
| `hotloop-flow-hotloop` | HotLoop Flow 전용 | HotLoop Flow 자체의 HotLoop 연결입니다. 계정으로 로그인하고 HotLoop이 돌려주는 베어러 토큰을 보내며, 만료되면 다시 로그인합니다. |
| `hotloop-flow-influxdb` | HotLoop Flow 전용 | HotLoop Flow 자체 InfluxDB 연결로, App Store의 influxdb-app을 대상으로 합니다. |
| `hotloop-flow-kafka` | HotLoop Flow 전용 | HotLoop Flow 자체 Kafka 연결로, HotLoop core의 Kafka 출력이 쓰는 것과 같은 설정을 사용합니다. |
| `hotloop-flow-mcp-server` | HotLoop Flow 전용 | HotLoop Flow 자체의 Model Context Protocol 서버 연결로, Streamable HTTP를 사용합니다. 베어러 토큰이 있으면 보내고, 첫 호출에서 연결하며, 실패 뒤의 호출에서 다시 연결합니다. |
| `hotloop-flow-modbus` | HotLoop Flow 전용 | HotLoop Flow 자체 Modbus TCP 연결입니다. 첫 요청에서 연결하고, 신뢰할 수 없게 만드는 실패가 생기면 연결을 끊고, 다음 요청에서 다시 연결합니다. |
| `hotloop-flow-ntfy` | HotLoop Flow 전용 | HotLoop Flow 자체 ntfy 서버로, HotLoop core가 알람을 게시할 때 쓰는 것과 같은 설정을 사용합니다. |
| `hotloop-flow-opcua` | HotLoop Flow 전용 | HotLoop Flow 자체 OPC UA 연결입니다. 처음 사용할 때 연결하고, 서버가 사라지면 이를 알아채며, 다음 요청에서 새 세션을 열거나 구독인 경우 시도 사이의 대기 시간을 늘려 가며 스스로 다시 엽니다. |
| `hotloop-flow-postgres` | HotLoop Flow 전용 | HotLoop Flow 자체 PostgreSQL 연결입니다. 같은 와이어 프로토콜을 쓰는 App Store의 postgresql-app과 timescale-db-pod를 대상으로 합니다. |
| `hotloop-flow-s7` | HotLoop Flow 전용 | HotLoop Flow 자체 Siemens S7 연결로, TCP 위의 ISO를 사용합니다. 첫 요청에서 연결하고, 신뢰할 수 없게 만드는 실패가 생기면 연결을 끊고, 다음 요청에서 다시 연결합니다. |
| `hotloop-flow-sparkplug` | HotLoop Flow 전용 | HotLoop Flow 자체 Sparkplug B 연결로, MQTT 3.1.1 위에서 엣지 노드 또는 호스트 애플리케이션으로 동작합니다. 엣지 노드는 생성되기 전에 기본 호스트 애플리케이션의 STATE를 기다릴 수 있고 브로커 목록을 차례로 거칠 수 있습니다. 호스트 애플리케이션은 브로커 하나에 연결합니다. 메트릭은 배열과 DataSet, Template, PropertySet 값을 담습니다. 메트릭의 MetaData(파일과 여러 부분으로 된 바이트)는 담지 않습니다. |
| `modbus-client` | 부분 | TCP, TCP 위 RTU, 시리얼 RTU 클라이언트입니다. 첫 요청에서 연결하고, 신뢰할 수 없게 만드는 실패가 생기면 연결을 끊고, 다음 요청에서 다시 연결하므로 reconnectOnTimeout과 reconnectTimeout은 기다릴 대상이 없습니다. 요청은 하나의 연결을 차례로 사용하므로 commandDelay, bufferCommands, 큐 및 상태 로그 스위치는 효과가 없습니다. 시리얼 ASCII(RTU-BUFFERD는 허용되고 ASCII는 허용되지 않음)는 지원하지 않습니다. networkInterface(Node-RED에는 없음)는 TCP 소켓을 네트워크 인터페이스 하나에 바인딩하며, 포트 하나가 같은 서브넷의 여러 VLAN을 전달하는 장비에 쓰입니다. 무시되는 속성: `bufferCommands`, `stateLogEnabled`, `queueLogEnabled`, `failureLogEnabled`, `commandDelay`, `reconnectOnTimeout`, `reconnectTimeout`, `parallelUnitIdsAllowed`, `serialConnectionDelay`, `serialAsciiResponseStartDelimiter`. |
| `modbustcp-server` | 부분 | 이것을 가진 플로가 그대로 불러와지고 저장되도록 허용합니다. 이 노드에서 읽는 노드 유형(modbustcp-read와 modbustcp-write)은 제공되지 않으므로 아무 곳에도 연결되지 않습니다. modbus-client와 getter, write 노드를 사용하십시오. |
| `mqtt-broker` | 부분 | MQTT 3.1, 3.1.1, 5. 연결, 자격 증명, TLS, 클린 세션, keepalive, 그리고 QoS와 retain 플래그, 버전 5에서는 속성과 will 지연을 포함한 birth, close, will 메시지를 지원합니다. 버전 5에서는 세션 만료 간격과 연결 사용자 속성도 지원합니다. 수신 최대값, 최대 패킷 크기, 토픽 별칭 최대값 설정은 구현되어 있지 않아 브로커의 기본값이 적용됩니다. TLS는 CA, 클라이언트 인증서, 서버 이름을 위한 tls-config와 함께 쓰는 Node-RED의 usetls입니다. 이전 HotLoop Flow가 tls: true로 저장한 브로커도 시스템 루트로 계속 TLS 연결을 합니다. 무시되는 속성: `receiveMaximum`, `maximumPacketSize`, `topicAliasMaximum`. |
| `postgreSQLConfig` | 부분 | Flow 자체 드라이버 위의 PostgreSQL 또는 TimescaleDB 연결 풀입니다. 각 설정은 ...FieldType 짝을 통해 문자열, 숫자, 불리언, 환경 변수 중 하나일 수 있습니다. 그 밖의 유형(msg, flow, global)은 설정 노드에서 읽을 메시지가 없어 노드를 멈춥니다. ssl true는 node-postgres처럼 서버 인증서를 검증하며, ssl은 disable, prefer, require, verify-full, no-verify 중 하나일 수도 있습니다. 비밀번호는 노드의 자격 증명이 있으면 거기서, 없으면 커뮤니티 노드가 보관하는 방식대로 플로 파일의 password 속성에서 읽습니다. 연결은 배포 시점이 아니라 첫 쿼리에서 열리고, 유휴 연결은 유휴 설정과 상관없이 최소 1분 유지되므로 초당 한 번 읽는 공장이 읽을 때마다 다시 연결하지 않습니다. networkInterface(Node-RED에는 없음)는 연결을 네트워크 인터페이스 하나에 바인딩하며, 노드가 요청하는 인터페이스마다 풀이 하나씩 생깁니다. |
| `tls-config` | 차이 있음 | 파일, 환경 변수, 업로드한 PEM 텍스트 또는 PKCS#12 번들에서 가져오는 인증서, 키, CA를 지원하며, 암호화된 키나 번들을 위한 암호 문구, 서버 이름, ALPN 프로토콜, 검증 스위치도 있습니다. 두 가지가 다릅니다. 경로는 시크릿 범위, 즉 데이터 디렉터리와 secrets.allowedPaths를 통해서만 읽습니다. 어떤 경로든 읽는 TLS 설정은 편집기에서 파일 시스템을 탐색하는 수단이 되기 때문입니다. 그리고 키가 없는 인증서나 없는 파일처럼 잘못된 설정은 배포되지 않습니다. Node-RED는 이를 기록만 하고 계속 진행하므로, 연결이 설정해 둔 클라이언트 인증서 없이 조용히 나가 버립니다. |
| `ui-base` | 부분 | Dashboard 2(FlowFuse) 설정으로, 이것을 가진 플로가 그대로 불러와지고 저장되도록 허용합니다. Dashboard 2의 위젯(ui-text, ui-button 등)은 제공되지 않으므로 화면에 그려지는 것은 없습니다. ui_ 노드를 사용하십시오. |
| `ui-group` | 부분 | Dashboard 2(FlowFuse) 설정으로, 이것을 가진 플로가 그대로 불러와지고 저장되도록 허용합니다. Dashboard 2의 위젯(ui-text, ui-button 등)은 제공되지 않으므로 화면에 그려지는 것은 없습니다. ui_ 노드를 사용하십시오. |
| `ui-page` | 부분 | Dashboard 2(FlowFuse) 설정으로, 이것을 가진 플로가 그대로 불러와지고 저장되도록 허용합니다. Dashboard 2의 위젯(ui-text, ui-button 등)은 제공되지 않으므로 화면에 그려지는 것은 없습니다. ui_ 노드를 사용하십시오. |
| `ui-theme` | 부분 | Dashboard 2(FlowFuse) 설정으로, 이것을 가진 플로가 그대로 불러와지고 저장되도록 허용합니다. Dashboard 2의 위젯(ui-text, ui-button 등)은 제공되지 않으므로 화면에 그려지는 것은 없습니다. ui_ 노드를 사용하십시오. |
| `ui_base` | 부분 | 대시보드의 테마입니다. 이름(어두움 또는 밝음)과 기본 색상이 사용됩니다. 사용자 지정 글꼴, 크기, 위젯 색상, 사이트 제목은 허용되지만 적용되지 않습니다. |
| `ui_group` | 부분 | 탭 위의 카드로, 너비는 width열이며 탭의 순서를 따릅니다. 위젯은 그 열 수의 그리드에 배치됩니다. |
| `ui_link` | 부분 | 다른 주소를 여는 메뉴 항목으로, http 또는 https만 가능합니다. 아이콘은 허용되지만 그려지지 않습니다. |
| `ui_spacer` | 부분 | 그룹 그리드의 빈 셀로, width열 곱하기 height행입니다. 아무것도 표시하지 않고 아무것도 보내지 않습니다. |
| `ui_tab` | 부분 | 대시보드의 한 페이지로, 순서에 따라 메뉴에 나타납니다. 아이콘은 허용되지만 그려지지 않습니다. 비활성화되었거나 숨겨진 탭은 제외됩니다. |
| `websocket-client` | 부분 | 밖으로 연결하며 연결이 끊기면 스스로 다시 연결합니다. 페이로드 모드와 전체 메시지 모드를 지원합니다. wss:// URL은 Node-RED와 마찬가지로 시스템 루트 또는 tls-config의 CA, 클라이언트 인증서, 서버 이름으로 서버를 검증합니다. |
| `websocket-listener` | 부분 | websocket 경로를 제공하며, 페이로드 모드와 전체 메시지 모드를 지원합니다. 이 경로는 플로의 라우트 테이블을 HTTP In 노드와 공유하므로 편집기나 관리 API를 가릴 수 없고 다른 노드의 경로와 충돌할 수도 없습니다. 읽기를 멈춘 클라이언트는 제한 없이 큐에 쌓지 않고 연결을 끊으며, 이는 Node-RED에는 없는 동작입니다. |

## 탐색

| 유형 | 수준 | 비고 |
|---|---|---|
| `netinfo` | HotLoop Flow 전용 | HotLoop Flow 자체 노드입니다. 런타임이 볼 수 있는 인터페이스를 보고하며, macvlan 모드에서는 플로가 OT VLAN에서의 자기 주소를 알아내는 방법입니다. |
| `scan` | HotLoop Flow 전용 | HotLoop Flow 자체 노드입니다. CIDR 범위를 훑어 OT 장치를 찾고 Modbus와 EtherNet/IP 엔드포인트를 식별합니다. 이 대화 상자가 아니라 런타임 설정의 탐색 허용 목록으로 제한됩니다. |

## 함수

| 유형 | 수준 | 비고 |
|---|---|---|
| `change` | 부분 | msg, flow, global 대상에 대해 set, change, delete, move를 지원하며 JSONata 유형 값도 포함합니다. 깊은 복사 옵션은 무시됩니다. 다른 속성에서 설정한 값은 Node-RED에서 옵션을 끈 경우처럼 그 속성과 공유됩니다. 무시되는 속성: `dc`. |
| `delay` | 차이 있음 | 고정, 가변, 무작위, 속도 제한, 토픽별 큐, 시간 지정 해제의 여섯 모드를 모두 구현하며, msg.reset, msg.flush, 버려진 메시지를 위한 두 번째 출력도 있습니다. 의도적인 차이가 둘 있습니다. 큐에 한도가 있고, 한도를 넘으면 메시지를 붙잡지 않고 Catch 노드로 거부합니다. Node-RED의 무제한 큐는 배출보다 빠른 소스를 설명 없는 OOM-kill로 바꾸기 때문입니다. 그리고 플로가 멈출 때 아직 붙잡혀 있는 메시지는 버려지지 않고 방출됩니다. |
| `exec` | 차이 있음 | 세 개의 출력, 버퍼 모드와 스트리밍 모드, 타임아웃, 덧붙이는 메시지 속성은 Node-RED와 똑같이 동작합니다. 그렇지 않은 것이 둘 있으며 둘 다 협상할 수 없습니다. 셸이 없습니다. 명령줄은 따옴표 규칙으로만 나뉘고, 따옴표 없는 셸 메타문자는 실행되지 않고 거부되므로 허용된 명령 하나가 임의의 명령이 될 수 없습니다. 그리고 운영자가 플로가 실행할 수 있는 명령을 지정하기 전까지 노드는 비활성화되어 있습니다. Node-RED의 exec 노드는 무엇이든 실행하며 Node-RED는 기본적으로 인증 없이 시작합니다. 그 기본값을 출하한 한 벤더는 CVE-2025-41656(Pilz IndustrialPI 4, VDE-2025-045), 즉 장치에서의 인증 없는 명령 실행이 되었습니다. 출력은 스트림마다 상한이 있으며, 상한을 넘는 명령은 힙을 가득 채우게 두지 않고 종료되고 보고됩니다. 자체 자식 프로세스를 띄우는 명령은 종료될 때 그 자식을 남겨 둘 수 있습니다. |
| `function` | 부분 | Node의 vm 모듈 대신 Go로 작성된 JavaScript 인터프리터에서 실행됩니다. 언어는 ES2023이며 Node 표준 라이브러리는 없습니다. require()와 npm 모듈은 동작하지 않으며, Node를 내장하지 않고는 동작하게 만들 수 없습니다. CPU 시간 제한은 항상 있으며, Node-RED가 선택 사항이자 꺼 둔 상태로 두는 것과 달리 모든 타이머 콜백에도 적용됩니다. setTimeout, setInterval과 그 해제 함수는 노드의 시계를 기준으로 동작하며, 플로가 멈추거나 다시 배포되면 모두 해제됩니다. Buffer는 있습니다(alloc, from, concat, 두 바이트 순서의 정수와 부동소수점 읽기 및 쓰기 메서드, slice, toString, toJSON). 메시지 안의 바이트 슬라이스는 바이트 배열로 도착하므로 Buffer.from으로 감싸십시오. 무시되는 속성: `libs`, `require`. |
| `range` | 완전 | 해당 없음 |
| `rbe` | 부분 | 변경되지 않는 한 차단 모드와 데드밴드 모드를 지원합니다. 협대역 모드는 이 빌드에 구현되어 있지 않습니다. |
| `switch` | 부분 | JSONata 표현식 규칙을 포함한 모든 비교 규칙을 지원하며, 시퀀스에 속한 메시지에 대해서는 $I와 $N을 볼 수 있습니다. 시퀀스 규칙 head, tail, index는 구현되어 있지 않으며, 이를 쓰는 규칙은 모든 메시지를 알 수 없는 연산자 오류로 실패시킵니다. 무시되는 속성: `head`, `tail`, `index`. |
| `template` | 부분 | Mustache 템플릿은 mustache.js의 방언에 맞춰 구현되어 있으며, HTML 이스케이프 집합과 독립 줄 처리도 포함하므로 Node-RED에서 옮긴 템플릿은 같은 바이트를 만들어 냅니다. 부분 템플릿({{>name}})과 사용자 지정 구분자는 플로 파일에 둘 중 어느 것도 제공할 수단이 없으므로 무시하지 않고 거부합니다. |
| `trigger` | 차이 있음 | 두 메시지, 재트리거 시 연장, 리셋 대기, msg.reset, msg.delay 재정의, 토픽별 그룹화, 두 번째 출력을 구현합니다. 차이는 Delay 노드와 같습니다. 동시에 작동 중인 타이머 수에 한도가 있으며, 한도를 넘은 메시지는 조용히 또 하나를 작동시키는 대신 Catch 노드로 거부됩니다. 플로가 멈출 때 아직 작동 중인 기한 있는 타이머는 버려지지 않고 즉시 발동합니다. 리셋을 기다리는 타이머는 버려집니다. 발동하면 실제로 일어나지 않은 이벤트를 만들어 내게 되기 때문입니다. |
| `ui_button` | 부분 | 누르면 페이로드와 토픽을 보내며, 각각 자신의 유형(리터럴, flow 또는 global 값, 마지막 메시지의 속성, 시간)에 따릅니다. 아이콘은 허용되지만 그려지지 않습니다. 무시되는 속성: `icon`. |
| `ui_chart` | 부분 | 시간에 따른 숫자의 꺾은선 및 막대 차트로, msg.topic마다 선 하나이며 removeOlder 곱하기 그 단위만큼, 선마다 최대 removeOlderPoints개의 점을 유지합니다. 페이로드 []는 차트를 지웁니다. 원형, 극좌표, 레이더, 가로 막대 차트는 꺾은선으로 그려집니다. 계열 객체 배열로 만든 차트와 점 클릭 시의 출력은 제공되지 않습니다. 무시되는 속성: `cutout`, `useDifferentColor`, `outputs`. |
| `ui_gauge` | 부분 | 게이지, 도넛, 나침반, 웨이브를 캔버스에 세 가지 구간 색상으로 그립니다. 도넛의 차이 모드는 허용되며 일반 도넛으로 그려집니다. |
| `ui_led` | 부분 | colorForValue에서 msg.payload와 같은 첫 항목(불리언, 숫자 또는 텍스트로 비교)의 색상으로, 허용된 경우에는 msg.color로 표시등을 그립니다. |
| `ui_numeric` | 부분 | 숫자 페이로드가 있는 메시지는 값을 설정하며, passthru가 켜져 있으면 변경 없이 그대로 전달됩니다. 운영자가 바꾸면 min과 max 안에서 {payload, topic}을 보냅니다. wrap은 허용되지만 무시되며, 값은 한계에서 멈춥니다. |
| `ui_switch` | 부분 | 클릭하면 켜짐 값 또는 꺼짐 값을 보냅니다. decouple이 꺼져 있으면 스위치가 즉시 움직이고, 켜져 있으면 그 값을 가진 메시지가 도착할 때만 움직입니다. 페이로드가 켜짐 값 또는 꺼짐 값과 같은 메시지는 스위치를 설정합니다. 아이콘과 animate는 허용되지만 그려지지 않습니다. 무시되는 속성: `onicon`, `officon`, `animate`. |
| `ui_template` | 부분 | 작은 AngularJS 스타일 계층을 가진 HTML입니다: {{ }}, ng-click, ng-class, ng-init, ng-show, ng-hide, ng-if, ng-bind, scope.msg, scope.$watch, scope.send, scope.$eval. 이 밖의 지시문(ng-repeat, ng-model, ng-switch, 컨트롤러, Angular Material 컴포넌트)은 제공되지 않습니다. 템플릿은 운영자의 브라우저에서 페이지 자체 권한으로 실행되므로 플로 작성자만큼만 신뢰할 수 있습니다. 전역 범위는 지역 범위로 취급됩니다. |
| `ui_text` | 부분 | 값 형식을 통해 msg.payload를 표시하며, {{msg.x}}, {{value}}, 숫자 필터({{msg.payload \| number:1}})를 지원합니다. 레이블에는 <br>은 쓸 수 있지만 다른 마크업은 쓸 수 없습니다. Angular의 다른 필터는 지원하지 않습니다. |
| `ui_text_input` | 부분 | 입력 없이 delay 밀리초가 지나면, Enter를 누르면, 또는 sendOnBlur가 켜져 있을 때 입력란을 벗어나면 텍스트(숫자 모드에서는 숫자)를 보냅니다. 메시지는 텍스트를 설정합니다. |

## 네트워크

| 유형 | 수준 | 비고 |
|---|---|---|
| `discord bot out` | HotLoop Flow 전용 | HotLoop Flow 자체 노드입니다. |
| `discord out` | HotLoop Flow 전용 | HotLoop Flow 자체 노드입니다. |
| `e-mail` | 부분 | msg.payload를 본문으로, msg.topic을 제목으로 하여 노드의 To(name 속성)로, 비어 있으면 msg.to로 보냅니다. msg.cc, msg.bcc, msg.from, msg.html, msg.attachments([{filename, content, contentType}])를 따르며, Buffer 페이로드는 첨부 파일로 나갑니다. secure는 첫 바이트부터 암호화된 연결(포트 465)입니다. 그렇지 않으면 서버가 제공할 때 노드가 STARTTLS를 요청합니다. tls는 유효한 인증서를 가진 서버에만 연결한다는 뜻입니다. 인증은 BASIC(PLAIN, 대체로 LOGIN), token에 지정한 메시지 속성에서 읽은 액세스 토큰을 쓰는 XOAUTH2, 또는 NONE입니다. 서버가 이 호스트가 아닌 한, 암호화되지 않은 연결에서는 비밀번호가 거부됩니다. 보내기 전용입니다. 사서함을 읽는 e-mail in 노드는 제공되지 않습니다. msg.header와 saslformat 스위치는 무시됩니다. networkInterface(Node-RED에는 없음)는 연결을 네트워크 인터페이스 하나로 보냅니다. 무시되는 속성: `saslformat`. |
| `ethernetip read` | HotLoop Flow 전용 | HotLoop Flow 자체 EtherNet/IP 태그 읽기입니다. 여기서 동작하지 않는 커뮤니티 노드 node-red-contrib-cip-ethernet-ip와 설정이 같지 않습니다. |
| `ethernetip write` | HotLoop Flow 전용 | HotLoop Flow 자체 EtherNet/IP 태그 쓰기입니다. 여기서 동작하지 않는 커뮤니티 노드 node-red-contrib-cip-ethernet-ip와 설정이 같지 않습니다. |
| `gotify out` | HotLoop Flow 전용 | HotLoop Flow 자체 노드입니다. |
| `hotloop in` | HotLoop Flow 전용 | HotLoop Flow 자체 노드입니다. Node-RED에 대응하는 것이 없는 HotLoop의 라이브 피드(GET /api/stream)를 따라갑니다. |
| `hotloop recipe` | HotLoop Flow 전용 | HotLoop Flow 자체 노드입니다. HotLoop 레시피를 적용합니다(POST /api/recipes/{id}/apply). |
| `hotloop script` | HotLoop Flow 전용 | HotLoop Flow 자체 노드입니다. HotLoop 스크립트를 실행합니다(POST /api/scripts/{id}/run). |
| `hotloop state` | HotLoop Flow 전용 | HotLoop Flow 자체 노드입니다. HotLoop에서 엔티티 하나의 상태를 읽습니다(GET /api/states/{entity_id}). |
| `http in` | 차이 있음 | Express 방식의 :params와 끝의 *를 가진 경로를 제공하며, JSON, 폼 인코딩, 원시 본문을 포함해 Node-RED와 같은 msg.req / msg.res / msg.payload 형태를 만듭니다. 의도적인 차이가 셋 있습니다. 어떤 HTTP Response 노드도 응답하지 않은 요청은 영원히 열어 두지 않고 타임아웃 후 504로 닫습니다. Node-RED 버전은 프로세스의 소켓이 바닥나 로그에 아무것도 남기지 않고 응답을 멈출 때까지 요청마다 연결 하나를 누수시키기 때문입니다. 같은 메서드와 경로를 주장하는 두 노드는, 둘 중 하나가 조용히 한 번도 실행되지 않는 대신 배포 시점에 거부됩니다. 그리고 편집기나 관리 API를 가리게 될 경로도 같은 이유로 거부됩니다. 업로드는 Node-RED의 multer와 같은 방식으로 파싱합니다. 텍스트 필드는 msg.payload로, 파일은 msg.req.files로 들어가며, 깨진 업로드에는 500으로 응답합니다. multer에 없는 한도가 하나 있습니다. 필드 이름에 든 10,000을 넘는 배열 인덱스 a[99999999]는 그만큼 긴 희소 배열을 만드는 대신 거부됩니다. msg.req.cookies는 j: 값을 포함해 cookie-parser의 것입니다. 무시되는 속성: `swaggerDoc`. |
| `http request` | 부분 | 메서드, URL, 헤더, 기본 인증, 리디렉션, 세 가지 반환 유형을 지원하며, msg.url, msg.method, msg.headers가 노드 설정을 덮어씁니다. 응답 본문은 크기에 상한이 있고 호출은 타임아웃으로 제한되는데, 둘 다 Node-RED에는 없습니다. TLS는 tls-config에서 오며, 없으면 msg.rejectUnauthorized = false가 Node-RED처럼 그 메시지 하나에 대해서만 인증서 검사를 건너뜁니다. msg.cookies와 cookie 헤더는 쿠키 저장소를 거쳐 나가고, 리디렉션이 설정한 쿠키는 리디렉션을 따라가며, msg.responseCookies와 msg.redirectList가 돌아오는데, 모두 Node-RED와 같습니다. 객체 페이로드를 가진 multipart/form-data 콘텐츠 유형은 폼으로 보냅니다. 프록시 설정과 연결 유지는 이 빌드에 구현되어 있지 않습니다. 송신 허용 목록은 없습니다. 이 노드는 Node-RED의 것과 똑같이 파드가 닿을 수 있는 모든 곳에 닿을 수 있으며, 이를 제한할 곳은 클러스터 밖의 누구도 신뢰할 수 없는 편집 대화 상자가 아니라 NetworkPolicy입니다. networkInterface(Node-RED에는 없음)는 연결을 네트워크 인터페이스 하나에 바인딩합니다. 무시되는 속성: `proxy`, `persist`. |
| `http response` | 부분 | 상태 코드와 헤더를 노드 또는 msg.statusCode와 msg.headers에서 가져오며, 페이로드가 본문입니다. msg.cookies는 Express가 Node-RED에서 하는 것과 똑같이 옵션까지 포함해 쿠키를 설정하고 지웁니다. 둘 이상이면 객체가 만들어진 순서가 아니라 이름 순서로 나갑니다. |
| `kafka out` | HotLoop Flow 전용 | HotLoop Flow 자체 노드입니다. |
| `mcp client` | HotLoop Flow 전용 | HotLoop Flow 자체 노드입니다. Model Context Protocol 서버의 도구를 호출하거나 그 서버가 가진 도구를 나열합니다. |
| `mcp result` | HotLoop Flow 전용 | HotLoop Flow 자체 노드입니다. mcp tool 노드가 시작한 호출에 응답합니다. |
| `mcp tool` | HotLoop Flow 전용 | HotLoop Flow 자체 노드입니다. 관리 API와 같은 방식으로 인증된 호출자를 위해 플로를 /mcp의 Model Context Protocol 도구로 제공하며, Node-RED에 대응하는 노드가 없습니다. |
| `modbus read` | HotLoop Flow 전용 | HotLoop Flow 자체 Modbus TCP 읽기입니다. 여기서 동작하지 않는 커뮤니티 노드 node-red-contrib-modbus와 설정이 같지 않습니다. |
| `modbus write` | HotLoop Flow 전용 | HotLoop Flow 자체 Modbus TCP 쓰기입니다. 여기서 동작하지 않는 커뮤니티 노드 node-red-contrib-modbus와 설정이 같지 않습니다. |
| `modbus-flex-getter` | 부분 | msg.payload에서 {fc, unitid, address, quantity}를 가져옵니다. 출력과 실패는 Getter와 같습니다. I/O 파일(useIOFile)은 지원하지 않으며, 이를 요구하는 노드는 시작하지 않습니다. networkInterface(Node-RED에는 없음)는 이 노드의 연결을 네트워크 인터페이스 하나에 바인딩합니다. 없으면 노드가 속한 탭의 FLOW_NETWORK_INTERFACE, 그다음 클라이언트의 인터페이스, 그다음 호스트의 선택을 따릅니다. 무시되는 속성: `useIOFile`, `ioFile`, `useIOForPayload`, `logIOActivities`. |
| `modbus-flex-write` | 부분 | msg.payload에서 {value, fc, unitid, address, quantity}를 가져옵니다. 출력과 실패는 Write 노드와 같습니다. networkInterface(Node-RED에는 없음)는 이 노드의 연결을 네트워크 인터페이스 하나에 바인딩합니다. 없으면 노드가 속한 탭의 FLOW_NETWORK_INTERFACE, 그다음 클라이언트의 인터페이스, 그다음 호스트의 선택을 따릅니다. |
| `modbus-getter` | 부분 | 메시지가 오면 노드 자체의 주소와 수량으로 읽습니다. 출력은 msg.payload, msg.responseBuffer({data, buffer}), msg.input, msg.modbusRequest를 담습니다. 실패는 msg.error와 함께 두 번째 출력으로 나가고, emptyMsgOnFail이 설정되어 있으면 첫 번째 출력으로 빈 메시지가 나갑니다. I/O 파일(useIOFile)은 지원하지 않으며, 이를 요구하는 노드는 시작하지 않습니다. networkInterface(Node-RED에는 없음)는 이 노드의 연결을 네트워크 인터페이스 하나에 바인딩합니다. 없으면 노드가 속한 탭의 FLOW_NETWORK_INTERFACE, 그다음 클라이언트의 인터페이스, 그다음 호스트의 선택을 따릅니다. 무시되는 속성: `useIOFile`, `ioFile`, `useIOForPayload`, `logIOActivities`. |
| `modbus-read` | 부분 | 플로가 시작되면(delayOnStart가 설정되어 있으면 startDelayTime 이후) rate rateUnit마다 폴링하고, 메시지가 도착하면 읽습니다. 출력은 Getter와 같으며 msg.topic은 노드에서 설정합니다. I/O 파일(useIOFile)은 지원하지 않으며, 이를 요구하는 노드는 시작하지 않습니다. networkInterface(Node-RED에는 없음)는 이 노드의 연결을 네트워크 인터페이스 하나에 바인딩합니다. 없으면 노드가 속한 탭의 FLOW_NETWORK_INTERFACE, 그다음 클라이언트의 인터페이스, 그다음 호스트의 선택을 따릅니다. 무시되는 속성: `useIOFile`, `ioFile`, `useIOForPayload`, `logIOActivities`. |
| `modbus-server` | 부분 | 노드가 정한 크기의 버퍼 네 개(coils, holding registers, input registers, discrete inputs) 위에서 동작하는 Modbus TCP 서버입니다. msg.payload = {register, address, value}인 메시지는 값을 설정하며, register는 holding, coils, input 또는 discrete이고 value는 값 하나 또는 목록입니다. 클라이언트의 쓰기는 첫 번째 출력(holding registers) 또는 두 번째 출력(coils)으로 나옵니다. 세 번째와 네 번째 출력은 클라이언트가 쓸 수 없는 input registers와 discrete inputs에 속하므로 아무것도 보내지 않으며, 다섯 번째는 오류를 담습니다. 모든 unit id의 요청은 같은 버퍼에서 응답합니다. 시리얼은 지원하지 않습니다. networkInterface(Node-RED에는 없음)는 수신 소켓을 수신 시작 전에 네트워크 인터페이스 하나에 바인딩하므로, 기계마다 VLAN이 있는 장비가 같은 주소와 포트로 VLAN마다 서버 하나를 실행할 수 있습니다. 노드 자체 설정이 우선하고, 그다음이 탭의 FLOW_NETWORK_INTERFACE입니다. 무시되는 속성: `logEnabled`, `showStatusActivities`. |
| `modbus-write` | 부분 | 함수 코드 5, 6, 15, 16 중 맞는 것으로 msg.payload(값 하나 또는 quantity 길이의 목록)를 씁니다. 출력은 msg.responseBuffer가 붙은 입력 메시지이며, 실패는 두 번째 출력으로 나갑니다. networkInterface(Node-RED에는 없음)는 이 노드의 연결을 네트워크 인터페이스 하나에 바인딩합니다. 없으면 노드가 속한 탭의 FLOW_NETWORK_INTERFACE, 그다음 클라이언트의 인터페이스, 그다음 호스트의 선택을 따릅니다. 무시되는 속성: `logIOActivities`. |
| `mqtt in` | 부분 | QoS와 페이로드 디코딩을 포함한 토픽 구독을 지원하며, MQTT 5에서는 no local, retain as published, retain handling 옵션과 msg.userProperties, msg.contentType, msg.responseTopic, msg.correlationData, msg.messageExpiryInterval에 담기는 메시지 속성을 지원하고, 콘텐츠 유형이 Node-RED처럼 자동 감지 디코딩을 이끕니다. 제어 메시지를 통한 동적 구독은 구현되어 있지 않습니다. |
| `mqtt out` | 부분 | 노드 또는 메시지에서 가져오는 토픽, QoS, retain으로 게시하며, MQTT 5에서는 콘텐츠 유형, 응답 토픽, 상관 데이터, 메시지 만료, 사용자 속성을 노드 또는 msg.contentType, msg.responseTopic, msg.correlationData, msg.messageExpiryInterval, msg.userProperties에서 가져옵니다. 다른 토픽이 없으면 msg.responseTopic을 토픽으로 씁니다. 토픽 별칭은 쓰지 않으며 항상 전체 토픽이 나갑니다. 연결 및 연결 해제 제어 메시지는 구현되어 있지 않습니다. 무시되는 속성: `topicAlias`. |
| `ntfy out` | HotLoop Flow 전용 | HotLoop Flow 자체 노드입니다. |
| `opcua read` | HotLoop Flow 전용 | HotLoop Flow 자체 OPC UA 읽기입니다. 여기서 동작하지 않는 커뮤니티 노드 node-red-contrib-opcua와 설정이 같지 않습니다. |
| `opcua subscribe` | HotLoop Flow 전용 | HotLoop Flow 자체 OPC UA 구독입니다. 여기서 동작하지 않는 커뮤니티 노드 node-red-contrib-opcua와 설정이 같지 않습니다. |
| `opcua write` | HotLoop Flow 전용 | HotLoop Flow 자체 OPC UA 쓰기입니다. 여기서 동작하지 않는 커뮤니티 노드 node-red-contrib-opcua와 설정이 같지 않습니다. |
| `s7 read` | HotLoop Flow 전용 | HotLoop Flow 자체 Siemens S7 읽기입니다. 여기서 동작하지 않는 커뮤니티 노드 node-red-contrib-s7과 설정이 같지 않습니다. |
| `s7 write` | HotLoop Flow 전용 | HotLoop Flow 자체 Siemens S7 쓰기입니다. 여기서 동작하지 않는 커뮤니티 노드 node-red-contrib-s7과 설정이 같지 않습니다. |
| `sparkplug command` | HotLoop Flow 전용 | HotLoop Flow 자체 Sparkplug B 명령 전송기로, 호스트 애플리케이션으로 동작합니다. |
| `sparkplug in` | HotLoop Flow 전용 | HotLoop Flow 자체 Sparkplug B 리스너입니다. 호스트 연결에서는 볼 수 있는 모든 엣지 노드를 따라갑니다. 엣지 연결에서는 자신에게 보낸 명령을 전달합니다. |
| `sparkplug out` | HotLoop Flow 전용 | HotLoop Flow 자체 Sparkplug B 퍼블리셔로, 엣지 노드 또는 그 장치용입니다. |
| `tcp in` | 차이 있음 | 구분자를 쓰는 스트림 모드 또는 상대가 닫을 때까지 모으는 단일 모드로, buffer, 문자열, base64 페이로드를 사용하여 수신하거나 밖으로 연결합니다. 모든 메시지가 msg._session을 담으므로 TCP Out 노드가 같은 연결로 응답할 수 있습니다. Node-RED에는 없는 한도가 셋 있습니다. 허용하는 연결 수, 구분된 메시지 하나의 크기, 단일 모드 읽기의 총량입니다. 연결을 열고 닫지 않거나 구분자를 보내지 않고 계속 보내는 상대가 있으면 파드가 죽을 때까지 힙이 커집니다. tls-config를 통한 TLS는 양방향으로 동작합니다. 수신 측은 설정의 인증서를 제시하고 클라이언트는 서버의 인증서를 확인합니다. |
| `tcp out` | 부분 | 호스트에 연결해서 보내거나, TCP In 노드가 수락한 연결에 msg._session으로 찾아 응답합니다. Node-RED의 세 번째 모드처럼 쓰기만을 위해 들어오는 연결을 수신하는 것은 구현되어 있지 않습니다. 수신하는 쪽에는 TCP In 노드를, 응답 모드의 이 노드와 함께 쓰십시오. tls-config를 통한 TLS는 클라이언트 모드에 적용되며, 응답은 TLS 여부와 관계없이 TCP In 노드가 수락한 연결로 되돌아갑니다. |
| `tcp request` | 부분 | Node-RED의 네 가지 대기 모드(고정 시간, 구분자, 바이트 수, 상대가 닫을 때까지) 중 어느 것으로든 연결하고, 페이로드를 보내고, 응답을 기다립니다. msg.host와 msg.port가 노드 설정을 덮어씁니다. 요청마다 자체 연결을 열며 Node-RED의 연결 재사용 모드는 구현되어 있지 않습니다. 연결을 재사용하면 모두 연결 경계에서 끝나는 대기 모드의 의미가 달라지기 때문입니다. tls-config가 있으면 설정이 검사하지 말라고 하지 않는 한 서버 인증서를 검사합니다. Node-RED의 TCP Request는 설정이 뭐라고 하든 이를 검사하지 않으므로 그 TLS는 문에 그려 놓은 자물쇠와 같습니다. networkInterface(Node-RED에는 없음)는 연결을 네트워크 인터페이스 하나에 바인딩합니다. |
| `udp in` | 부분 | 멀티캐스트 그룹에 선택적으로 가입하여 데이터그램을 받으며, buffer, 문자열, base64 페이로드를 지원하고 보낸 쪽의 주소는 msg.ip와 msg.port에 담깁니다. IPv6와 노드별 인터페이스 선택은 이 빌드에 구현되어 있지 않습니다. 무시되는 속성: `ipv6`. |
| `udp out` | 부분 | 호스트, 브로드캐스트 주소 또는 멀티캐스트 그룹으로 데이터그램을 보내며, msg.ip와 msg.port가 노드 설정을 덮어씁니다. IPv6는 이 빌드에 구현되어 있지 않습니다. networkInterface(Node-RED에는 없음)는 소켓을 네트워크 인터페이스 하나에 바인딩합니다. 무시되는 속성: `ipv6`. |
| `websocket in` | 완전 | 프레임마다 메시지 하나를 내보내며 msg._session을 담으므로 WebSocket Out 노드가 그 메시지가 온 연결에 응답할 수 있습니다. |
| `websocket out` | 차이 있음 | msg._session이 지정한 연결에 응답하며, 지정된 것이 없으면 Node-RED처럼 열려 있는 모든 연결로 브로드캐스트합니다. 차이는 연결이 따라오지 못할 때 일어나는 일입니다. 프레임은 제한 없이 큐에 쌓이지 않고 Catch 노드로 거부되며 연결은 닫힙니다. 대신 차단하면 느린 브라우저의 배압이 플로의 스케줄러로 밀려 들어오는데, 이는 이미 읽기를 멈춘 연결 하나를 잃는 것보다 나쁜 실패입니다. |

## 파서

| 유형 | 수준 | 비고 |
|---|---|---|
| `csv` | 부분 | 객체로의 파싱과 객체로부터의 렌더링을 지원하며 구분자와 헤더 처리를 설정할 수 있습니다. 서로 다른 메시지에 걸친 여러 줄의 따옴표 필드는 다시 조립되지 않습니다. |
| `html` | 부분 | CSS 선택자로 요소를 추출하여 내부 HTML, 텍스트 또는 속성을 반환하며, 일치마다 메시지 하나 또는 배열을 담은 메시지 하나로 내보냅니다. 선택자 엔진은 유형, id, 클래스, 속성, 자손, 자식, 쉼표로 구분한 그룹을 지원합니다. 의사 클래스, 의사 요소, 형제 결합자, 속성 연산자 ~=와 \|=는 무시하지 않고 배포 시점에 거부됩니다. :nth-child를 조용히 버리는 선택자는 엉뚱한 요소와 일치하면서도 계속 동작하기 때문입니다. 반환되는 HTML은 파싱 트리에서 다시 렌더링되므로 원래 바이트가 아니라 정규화된 마크업입니다. |
| `json` | 부분 | 양방향 변환을 지원합니다. 스키마 검증을 지원하며, Node-RED처럼 msg.schema에 대해, 그리고 노드 설정의 스키마에 대해 검증합니다. 검증기는 Ajv가 아닙니다. 스키마가 다른 초안을 지정하지 않으면 초안 2020-12를 읽고, 스키마 밖의 무엇이든 가리키는 $ref는 거부하며, 알지 못하는 format 키워드는 무시합니다. |
| `xml` | 부분 | xml2js의 객체 규칙을 사용한 양방향 변환입니다. 속성은 "attr"이 지정한 키(기본값 $) 아래에, 요소 텍스트는 "chr"(기본값 _) 아래에 들어가며, 모든 자식 요소는 xml2js 자체의 explicitArray 기본값대로 배열이 됩니다. 자식이 하나인 경우를 풀려면 ew_explicitArray를 false로 설정하십시오. Node-RED가 xml2js에 넘기는 메시지별 msg.options는 따르지 않습니다. 다른 xml2js 옵션은 출력 형태를 바꾸는데, 하나를 조용히 무시하면 플로가 기대하지 않는 객체를 만들면서도 동작한 것처럼 보이기 때문입니다. 네임스페이스는 해석하지 않고 요소 이름의 일부로 유지됩니다. 무시되는 속성: `options`. |
| `yaml` | 완전 | 양방향 변환이며, 동작이 설정되지 않은 경우 Node-RED처럼 값의 유형에 따라 전환합니다. |

## 시퀀스

| 유형 | 수준 | 비고 |
|---|---|---|
| `batch` | 차이 있음 | Node-RED처럼 겹침을 지원하고 들어오는 시퀀스의 끝을 존중하는 개수별 그룹화, 빈 시퀀스 포함 여부를 고르는 시간 간격별 그룹화, msg.reset을 이용한 토픽별 시퀀스 연결을 지원합니다. Node-RED가 받아들이는 두 가지 설정은 거부됩니다. 1 미만의 개수(조용히 1로 읽음)와 0인 간격(모든 메시지를 영원히 붙잡음)입니다. |
| `join` | 차이 있음 | Node-RED가 가진 자동, 수동, reduce 모드를 지원합니다. msg.parts.index에 의한 배치, Split이 기록한 구분자, 중첩 시퀀스, 배열, 문자열, 버퍼, 메시지 속성을 키로 하는 객체, 병합된 객체, accumulate, msg.complete, msg.reset, msg.restartTimeout, 타임아웃, $A, $I, $N과 선택적 fixup을 쓰는 reduce 표현식입니다. 의도적인 차이가 하나 있습니다. msg.parts가 없는 메시지를 받은 자동 join은 경고를 기록하는 대신 오류를 일으킵니다. |
| `sort` | 완전 | 배열 속성을 요소 자체 또는 각 요소에 대해 평가한 JSONata 키로 정렬하고, 메시지 시퀀스를 속성 또는 각 메시지에 대해 평가한 JSONata 키로 정렬합니다. |
| `split` | 차이 있음 | 구분자, 바이트 시퀀스 또는 길이로 배열, 객체, 문자열, 버퍼를 나누며, 끝나지 않은 조각을 다음 메시지로 넘기는 스트리밍 모드도 포함합니다. msg.parts는 구분자와 중첩 시퀀스를 포함해 Node-RED와 일치합니다. 의도적인 차이가 셋 있습니다. Go의 맵에는 순서가 없으므로 객체는 정렬된 키 순서로 나뉩니다. 문자열은 UTF-16 코드 단위가 아니라 문자 수 길이로 나뉘므로 문자가 반으로 잘리지 않습니다. 그리고 나눌 수 없는 페이로드는 사라지지 않고 오류를 일으킵니다. |

## 저장소

| 유형 | 수준 | 비고 |
|---|---|---|
| `file` | 차이 있음 | 리터럴, 메시지 속성, 컨텍스트 또는 환경에서 파일 이름을 가져와 추가, 덮어쓰기, 삭제를 지원하며 utf8, base64, hex, raw 인코딩을 지원합니다. 차이는 경로 범위입니다. 파일 노드는 데이터 디렉터리와 운영자가 추가로 나열한 곳에만 닿을 수 있으며, PVC에 심어 둔 링크가 밖을 가리킬 수 없도록 심볼릭 링크를 해석해 확인합니다. Node-RED의 파일 노드는 어떤 경로든 받으므로 플로를 편집하는 것이 프로세스가 읽을 수 있는 모든 파일을 읽는 것과 같아집니다. 쓰기는 기본적으로 fsync되며, Node-RED는 그렇지 않습니다. |
| `file in` | 차이 있음 | 전체 파일, 줄 단위, 청크 단위 읽기를 지원하며 출력은 utf8, base64, hex, raw입니다. 경로 범위는 File 노드와 같고 이유도 같습니다. 읽기에도 크기 상한이 있습니다. Node-RED는 한도 없이 파일 전체를 메모리로 읽으므로 노드를 잘못된 경로로 가리키면 오류가 아니라 OOM-kill이 됩니다. 상한을 넘으면 노드가 어느 한도에 걸렸는지, 그리고 줄 단위 또는 청크 모드라면 동작했으리라는 것을 알려 줍니다. |
| `influxdb out` | HotLoop Flow 전용 | HotLoop Flow 자체 노드입니다. 가져온 플로가 찾을 수 있도록 유형 이름은 커뮤니티 노드 node-red-contrib-influxdb와 같지만 설정은 같지 않으므로, 가져온 뒤 필드를 확인하십시오. |
| `postgres` | HotLoop Flow 전용 | HotLoop Flow 자체 노드입니다. PostgreSQL 또는 TimescaleDB에 쓰고 읽으며, 메시지 시퀀스에는 일괄 삽입을 지원합니다. |
| `postgresql` | 부분 | 쿼리를 메시지에 대한 Mustache 템플릿으로 실행합니다({{{msg.topic}}}와 {{{topic}}}가 모두 동작하며 값을 텍스트로 넣으므로, 데이터베이스에 매개변수로 전달되는 msg.params와 함께 $1, $2를 쓰는 편이 낫습니다). msg.payload는 행 목록이고 msg.pgsql은 {command, rowCount}입니다. split이 켜져 있으면 행이 rowsPerMsg개씩(1이면 행 객체, 아니면 목록) msg.parts와 함께 나가고, 두 번째 출력이 있으면 마지막 그룹이 나간 뒤 메시지 하나를 보냅니다. msg.queryParameters(이름 있는 매개변수)는 지원하지 않습니다. 실패한 쿼리는 Catch 노드를 위한 오류를 일으킵니다. networkInterface(Node-RED에는 없음)는 이 노드의 쿼리를 네트워크 인터페이스 하나로 보냅니다. |
| `watch` | 차이 있음 | 나타나고, 바뀌고, 제거되는 파일과 디렉터리를 Node-RED가 만드는 것과 같은 메시지 형태로 보고합니다. 커널의 알림 인터페이스를 쓰지 않고 폴링하므로 변경은 즉시가 아니라 폴링 간격 안에 감지되며, 한 간격 안의 두 변경은 한 번만 보고됩니다. 의도적인 절충입니다. fsnotify는 플랫폼별 코드와 빌드 제약인 파일 이름 접미사를 뜻하며, 이는 이미 이 코드베이스에 하루를 허비하게 했습니다. 경로 범위는 다른 파일 노드와 같고, 큰 트리에 대한 재귀 감시가 런타임을 멈추게 하지 못하도록 감시하는 항목 수에 상한이 있습니다. |
