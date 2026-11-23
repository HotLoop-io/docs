---
title: "Flow 2.2.0 릴리스 노트"
description: "HotLoop Flow 2.2.0에 담긴 내용, 업그레이드 시 달라지는 점, 가동 중인 플랜트를 건드리기 전에 읽어야 할 것."
sidebar:
  label: "2.2.0"
---

HotLoop Flow 2.2.0은 Flow가 PLC와 통신하고, 재시작해도 알던 것을 기억하며, 메시지가 어디로 갔는지 보여 주는 릴리스입니다. 또한 HotLoop의 Business Source License 아래 나오는 첫 릴리스이기도 하며, 꼭 읽어야 할 부분이라 가장 먼저 적습니다.

## 라이선스가 바뀌었습니다

2.2.0과 그 이후의 모든 릴리스는 HotLoop 나머지 제품과 같은 HotLoop의 Business Source License 1.1을 따릅니다. 오픈 소스 라이선스가 아니며, 그런 척하지 않겠습니다. Flow의 소스는 그대로 공개되어 있으므로 실행하는 모든 줄을 읽어 볼 수 있습니다.

- 가정과 실험실에서의 사용은 무료입니다.
- 인가받은 학교와 교육 기관, 비영리 단체, 정부 기관은 자체 운영과 설립 목적을 위해 무료로 쓸 수 있습니다.
- 비즈니스 용도는 [EmberNet](https://embernet.ai)을 통해 실행할 때 무료입니다. 비즈니스에서 쓸 수 있는 유일한 경로입니다.
- Flow를 서비스로 호스팅하거나, 재판매하거나, 판매하는 제품에 내장하는 것은 허용되지 않습니다.
- 각 버전은 처음 공개된 지 4년 뒤에 GPL-3.0 이상으로 전환됩니다.

`LICENSE`는 법적 문서로, HotLoop-io/HotLoop-io에 있는 것과 바이트 단위로 같습니다. 2.1.0과 그 이전 버전은 출시 당시의 라이선스를 그대로 따릅니다. 그 릴리스들은 아무것도 바뀌지 않습니다. 이식한 Node-RED 파일은 원래의 라이선스 헤더와 크레딧을 유지하므로, 이제 그 라이선스 전문이 `NOTICE` 옆의 `LICENSES/`에 함께 배포되고, 이미지는 둘 다 `/usr/share/doc/hotloop-flow/`에 담고 있습니다. `NOTICE`는 Flow가 이제 포함하는 패치된 gos7 사본도 다룹니다(아래).

## 새 기능

**추적과 리플레이**
- 모든 메시지에 제한된 추적이 붙습니다. 디버그 메시지를 클릭하면 에디터가 그 메시지가 지나간 경로를 밝혀 주며, 분할, 결합, 서브플로를 거치는 각 구간의 시간과 페이로드를 보여 줍니다.
- 추적은 플로 테스트가 되거나 초안으로 리플레이되므로, 문제를 일으킨 메시지로 수정을 시험해 볼 수 있습니다.
- 모든 구간을 스팬으로 OpenTelemetry 컬렉터에 보낼 수 있습니다(`trace.otlp.endpoint`).

**재시작 후에도 남는 상태**
- 플로, 전역, 노드 컨텍스트는 데이터 볼륨의 SQLite 파일 `state.db`에 저장됩니다. 이제 재시작해도 지워지지 않습니다.
- 내구성 와이어. 와이어를 내구성으로 표시하면, 반대편 노드가 따라오는 동안에는 일반 와이어로서 아무것도 기록하지 않습니다. 그 노드가 메시지를 받지 못하게 되면 와이어는 순서대로 같은 파일에 쌓아 두었다가 대상이 돌아오면 비웁니다. 실제 InfluxDB를 10분 동안 죽여 놓고, 장애 도중과 비우는 도중에 런타임을 `kill -9`로 종료해 증명했습니다. 누락도 중복도 없었습니다.

**플랜트 노드**
- Modbus TCP 읽기와 쓰기, OPC UA 읽기, 쓰기, 구독, S7 읽기와 쓰기, EtherNet/IP 읽기와 쓰기, 그리고 엣지 노드와 호스트로서의 Sparkplug B. 이제 Flow는 `scan`이 찾은 것과 직접 통신할 수 있습니다.
- Sparkplug는 사양이 요구하는 탄생, 유언, `bdSeq`, 재탄생 요청, 명령을 수행합니다. 독립적인 Sparkplug 구현과 엣지 노드와 호스트 양방향으로 대조해 확인했습니다.
- 응답 없는 장치는 타임아웃 안에 요청을 실패시키고, 다음 메시지가 다시 연결합니다. OPC UA 구독은 끊긴 것을 알아채고 한 번만 알린 뒤 스스로 복구합니다.

**에디터**
- 복사와 붙여넣기, 선택 영역 가져오기와 내보내기, 자체 캔버스를 가진 서브플로, 중첩 그룹, 모든 플로에 걸친 검색, 디버그 필터, Alt+클릭으로 와이어 삭제. 브라우저 테스트가 런타임이 제공하는 목록의 모든 노드 대화 상자를 직접 눌러 보므로, 새 노드는 출시되는 날부터 검증됩니다.
- 와이어를 노드 위로 끄는 동작은 Chromium에서 한 번도 동작한 적이 없었습니다. 이제 동작합니다.

**점검**
- 설정 노드가 파일에 없는 노드(서브플로가 여전히 가리키는 삭제된 브로커, 또는 탭이나 잘못된 종류의 설정 노드에 대한 참조)는 가져올 때, 불러올 때, 배포할 때 보고되며 시작되지 않습니다. 이전에는 조용히 동작하지 않았습니다.
- 플로나 노드를 삭제하면 그것을 가리키던 Catch, Status, Complete 범위에서 해당 id가 빠집니다.

## 바뀐 내용

- 컨텍스트는 기본적으로 유지됩니다. `store.context.persist`가 켜져 있어서 재시작 전에 설정한 값이 재시작 후에도 있습니다. 이전에는 재시작할 때마다 비어 있었습니다. 시작 시 컨텍스트가 비어 있으리라 가정하던 플로는 이제 비어 있기를 기대하는 값을 직접 비워야 합니다. 이전 동작을 원하면 `persist`를 `false`로 설정하세요.
- 추적은 기본으로 켜져 있고 모든 면에서 제한됩니다. 256개 여정, 여정당 512개 구간, 합계 16 MiB, 초당 신규 여정 1000개. 메모리에만 있으므로 재시작하면 목록이 새로 시작됩니다. `trace.enabled: false`로 끌 수 있습니다.
- gos7은 S7 타임아웃마다 Go의 전역 로거에 원시 줄을 출력했고, 노드에서는 이를 끌 방법이 없었습니다.
- 내구성 큐는 메시지가 디스크에 기록된 뒤에 대기 중으로 셉니다. 그 전에는 세지 않습니다.
- 이미지는 Docker가 아니라 Podman으로 빌드하고 푸시합니다. 같은 이미지, 같은 태그(`2.2.0`, `2.2`, `2`), 여전히 linux/amd64와 linux/arm64입니다.

## 업그레이드 노트

2.1.0에서는 이미지만 바꾸면 됩니다(`helm upgrade`, 또는 Quadlet 유닛의 새 태그). 마이그레이션도 플래그도 없습니다. 2.1.0에서 돌던 `flows.json`과 설정 파일은 2.2.0에서도 돌고, 플로 파일의 바이트 단위 왕복은 그대로입니다.

- 처음 시작하면 볼륨의 `data.dir`에 `state.db`가 만들어집니다. 차트에서 `persistence.enabled`가 false이면 컨테이너 재시작은 견디지만 파드 교체는 견디지 못합니다.
- 2.1.0으로 돌아가도 `state.db`는 그대로 남습니다. 2.1.0에는 이를 읽는 코드가 없습니다.
- `state.db`에 쓰는 모든 기록은 SD 카드나 SSD에 쓰는 것이므로 기본값은 모아서 씁니다. 컨텍스트 변경은 `flushInterval`(30초) 동안 기다렸다가 함께 기록되며, 이미 같은 값으로 설정하면 아무것도 쓰지 않습니다. `kill -9`로 그 정도는 잃을 수 있습니다. `docs/durable/README.md`에 수치와 카드에 드는 비용이 있습니다.

## 새 설정

| YAML | 환경 변수 | 기본값 |
|---|---|---|
| `store.path` | `HOTLOOP_FLOW_STORE_PATH` | 비어 있음, 즉 `data.dir`의 `state.db` |
| `store.synchronous` | `HOTLOOP_FLOW_STORE_SYNCHRONOUS` | `normal`. `full`은 커밋마다 fsync하며 그만큼 카드를 소모합니다. |
| `store.context.persist` | `HOTLOOP_FLOW_CONTEXT_PERSIST` | `true` |
| `store.context.flushInterval` | `HOTLOOP_FLOW_CONTEXT_FLUSH_INTERVAL` | `30s`. `0s`는 플로가 넘어가기 전에 모든 변경을 기록합니다. |
| `store.durable.maxBytes` | `HOTLOOP_FLOW_DURABLE_MAX_BYTES` | 모든 내구성 와이어를 합쳐 256 MiB |
| `store.durable.ackFlush` | `HOTLOOP_FLOW_DURABLE_ACK_FLUSH` | `100ms`. `0s`는 다음 메시지를 보내기 전에 각 메시지를 표시합니다. |
| `trace.enabled`, `trace.traces`, `trace.maxHops`, `trace.maxMessageBytes`, `trace.maxBytes`, `trace.perSecond` | | `true`, 256, 512, 16384, 16 MiB, 1000. `perSecond: 0`은 모든 메시지를 추적합니다. |
| `trace.otlp.endpoint`, `trace.otlp.serviceName`, `trace.otlp.interval` | `HOTLOOP_FLOW_TRACE_OTLP_ENDPOINT` | 비어 있음(내보내기 없음), `hotloop-flow`, `2s` |
| `trace.otlp.headersSecret` (차트) | `HOTLOOP_FLOW_TRACE_OTLP_HEADERS` | 없음. 쉼표로 구분한 `Name=value` 쌍을 담은 Secret 키로, 호스팅 컬렉터의 API 키용입니다. |

차트에는 이 모든 항목이 `values.yaml`의 `store`와 `trace` 아래에 있습니다.

이미지: `ghcr.io/hotloop-io/hotloop-flow:2.2.0`, linux/amd64와 linux/arm64. 차트: `https://hotloop.io/hotloop-flow/`. 이 태그의 README에 나머지가 있습니다: https://github.com/HotLoop-io/hotloop-flow/blob/v2.2.0/README.md
