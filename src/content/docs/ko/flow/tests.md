---
title: "플로 옆에 두는 테스트"
description: "플로 옆에 테스트 파일을 쓰고, 모의 시계에서 실행하고, 배포를 그 결과에 묶으세요. 테스트 밖으로는 아무것도 나가지 않습니다."
---

"내 변경이 라인을 망가뜨렸나?"라는 물음은 새벽 3시에 당직자가 아니라, 배포 전에 변경한 사람이 답을 얻어야 합니다. 그래서 플로에는 테스트를 둘 수 있습니다. 테스트는 플로 파일 옆에 놓이는 YAML이며 같은 검토 절차를 거칩니다.

```yaml
# line3.test.yaml
flows: line3.json            # relative to this file; flows.json if you leave it out
tests:
  - name: a high reading raises the alarm and nothing else
    inject:
      - node: reading                  # by name or by id
        msg: {topic: line3/temp, payload: 92.5}
    expect:
      - node: over limit?              # the Switch
        port: 1
        msg: {payload: 92.5}
        within: 500ms
      - node: over limit?
        port: 2
        nothing: true
      - node: alarm out                # a Debug: checked on what it received
        msg: {payload: HIGH}

  - name: a negative reading is caught, not alarmed on
    inject:
      - node: reading
        msg: {payload: -4}
    expect:
      - node: errors                   # a Catch node
        error: "out of range"
```

```bash
hotloop-flow test -junit report.xml line3.test.yaml
```

```
--- PASS: a high reading raises the alarm and nothing else (0.00s)
--- PASS: a negative reading is caught, not alarmed on (0.00s)
ok	line3.test.yaml	2 passed, 0 failed, 0 errors (0.00s)
```

실제 런타임과 실제 노드가 프로세스 안에서 그대로 돌아가며, 서버도 편집기도 필요 없습니다. 테스트마다 자기만의 런타임을 쓰므로, 한 테스트가 Delay나 컨텍스트에 남긴 것이 다음 테스트로 새어 들어갈 수 없습니다.

- **`inject`**는 메시지를 순서대로 넣으며, 각 메시지는 다음 것이 들어가기 전에 처리됩니다. 입력이 있는 노드는 그 입력으로 받습니다. Inject나 MQTT In 같은 소스는 스스로 만든 것처럼 첫 번째 출력으로 내보내며, 메시지를 지정하지 않은 Inject 노드는 버튼을 누른 것으로 처리됩니다.
- **`expect`**는 노드의 출력을 지켜보며, 포트는 편집기처럼 1부터 셉니다. Debug처럼 출력이 없는 노드는 받은 내용으로 확인합니다. 서브플로 인스턴스는 안쪽 어디서 나오든 자기 출력에서 지켜봅니다.
- **`msg`**는 메시지에 들어 있어야 하는 내용입니다. 지정한 속성은 모두 그 값으로 끝까지 있어야 하고, 메시지의 나머지는 무시되므로 누군가 `msg.topic`을 설정하기 시작해도 페이로드 테스트는 깨지지 않습니다. **`assert`**는 리터럴로는 할 수 없는 확인을 위한 JSONata 식이며 참이어야 합니다. **`error`**는 Catch 노드가 잡은 오류에 들어 있어야 하는 텍스트입니다.
- **`within`**은 기한입니다. 늦게 도착한 메시지는 실패하고, 실패 내용에 얼마나 늦었는지가 나옵니다. **`nothing: true`**와 **`count: N`**은 플로가 잠잠해진 뒤에 확인하며, "아무것도 나오지 않았다"가 의미를 갖는 때는 그때뿐입니다. 한 포트의 기대 두 개는 그 순서대로 메시지 두 개입니다.

테스트는 기다리던 모든 일이 일어나고 플로가 더 할 일이 없으면 바로 끝납니다. `timeout`은 따로 지정하지 않으면 5초이며, 다음 절에서 설명하는 테스트 자신의 시계를 기준으로 합니다.

실패하면 대신 무엇이 나왔는지, 어디가 다른지 알려 줍니다.

```
--- FAIL: the alarm says LOW (0.00s)
    expect 1: debug "alarm out" (alarm-out): 1 message(s) received and none matched; the first one differs at msg.payload: wanted "LOW", got "HIGH"
      at 0s: {"payload":"HIGH","topic":"line3/temp"}
```

실행할 수 없는 테스트는 통과가 아니라 오류입니다. 플로에 없는 노드를 지정한 경우, 두 노드가 같은 이름을 쓰는 경우, 노드에 없는 포트를 쓴 경우, 시작하지 않는 노드가 플로에 있는 경우가 그렇습니다. 철자가 틀린 키도 마찬가지입니다. `expcet:`는 파일을 읽을 때 거부되는데, 조용히 넘어간 오타는 확인할 것이 없는 테스트를 남기고, 확인할 것이 없는 테스트는 통과하기 때문입니다. 모두 통과하지 않으면 종료 상태는 1이고, `-junit`은 모든 CI 시스템이 읽는 보고서를 씁니다.

## 테스트의 시계 위에서

5분짜리 Delay를 기다리는 테스트 모음을 돌리는 사람은 없으므로, 테스트는 기다리지 않습니다. 테스트는 자기 시계를 갖고, 플로의 무언가가 기다리는 다음 시점으로 시계를 곧바로 옮깁니다. Delay가 풀리는 때, Trigger의 두 번째 메시지, 간격이나 crontab의 Inject, 시간이 다 된 Join이나 Batch, 포기하는 Link Call이 그런 시점입니다. 타이머가 울리면 플로가 보낸 것을 처리하고, 그다음에야 시계가 다음 기한을 찾으며, 순서는 실제 시간이 흘렀을 때와 같습니다. Delay 5분은 한 단계이고 약 1밀리초입니다.

```yaml
  - name: a reading at 4m pushes the watchdog's off out to 9m
    clock: 2026-10-05T06:00:00Z     # when the test starts; the real time if you leave it out
    timeout: 20m
    inject:
      - {node: watchdog, msg: {payload: reading}}
      - {node: watchdog, msg: {payload: reading}, at: 4m}   # at: on the test's clock
    expect:
      - {node: watchdog, msg: {payload: "on"}}
      - {node: watchdog, msg: {payload: "off"}, within: 9m}

  - name: and not a moment before
    timeout: 8m59s
    inject:
      - {node: watchdog, msg: {payload: reading}}
      - {node: watchdog, msg: {payload: reading}, at: 4m}
    expect:
      - {node: watchdog, count: 1}  # the "on", and nothing else yet
```

**`at`**은 테스트 시계의 한 시점에 주입을 두며, 그보다 앞선 기한의 일은 먼저 일어납니다. **`within`**과 **`timeout`**도 이 시계를 따르므로, 10분마다 Inject가 있는 플로에서 `timeout: 1h`는 틱 여섯 번과 몇 밀리초입니다. **`clock`**은 시각이 중요한 플로를 위해 테스트가 시작하는 시각을 정하며, 6시 30분에 발동하는 crontab은 테스트 시계가 6시 30분을 가리킬 때 발동합니다. Function 노드의 `Date`, Inject의 타임스탬프, 날짜를 설정하는 Change 노드, 쿠키의 `Expires`는 모두 같은 시계를 읽으므로, 시각을 찍고 비교하는 플로는 테스트 안에서도 스스로 일관됩니다.

테스트 모음은 이 시계로 팔레트의 모든 타이밍 노드를 밀리초 단위로 증명합니다. 고정, 무작위, 속도, 시각 모드의 Delay, extend가 있는 Trigger, 간격·시작 시 한 번·crontab의 Inject, Join과 Batch의 시간 초과, 응답을 끝내 받지 못하는 Link Call이 그 대상입니다. 공장 시간으로 한 시간이 걸리는 것까지 모두 1초가 훨씬 안 되게 끝납니다. 테스트가 옮길 수 없는 것은 CPU입니다. 실제 시간으로 1분이 지나도 바쁜 플로는 테스트 모음을 멈춰 세우지 않고 테스트를 실패시킵니다. JSONata의 `$now()`와 `$millis()`는 여전히 실제 벽시계를 읽습니다.

## 편집기에서 만드는 테스트

잘 돌아가는 플로를 위해 테스트를 쓰는 사람은 없습니다. 멈추는 날 쓰게 되고, 그건 하루 늦은 것입니다. 그래서 편집기는 플로가 방금 한 일로 클릭 두 번에 테스트를 만들어 줍니다.

디버그 사이드바의 모든 메시지에는 **Test** 버튼이 있습니다. 누르면 편집기가 바로 그 메시지로 테스트 초안을 만듭니다. 소스로 들어온 것을 그 소스로 다시 넣고, 이 Debug 노드가 보여 준 것을 여기서 기대하는 값으로 둡니다. 원하는 대로 고치세요. 타임스탬프가 있는 값은 밀리초에 못 박는 것보다 `assert`로 확인하는 편이 낫습니다. **Add to tests**를 누르면 플로 파일 옆 테스트 모음의 끝에 들어가며, 이미 적혀 있던 내용은 주석까지 그대로 남습니다. 이미 있는 이름은 덮어쓰지 않고 끝에 번호가 붙습니다.

편집기가 무엇이 들어왔는지 아는 방법은 이렇습니다. 런타임은 소스에서 플로로 들어온 마지막 메시지 64개와 Debug 노드에 닿은 마지막 메시지 64개를, 메시지가 노드에서 노드로 지니고 다니는 id로 보관합니다. 크기 상한이 있는 링이고 64 KB를 넘는 메시지는 아예 보관하지 않으므로, 파드를 키우는 원인이 될 수 없습니다. 밀려난 메시지나 도중에 노드가 새 메시지로 바꿔 버린 메시지는 초안을 만들 수 없으며, 편집기는 무엇이 들어왔는지 추측하지 않고 그렇다고 알려 줍니다.

**Tests** 패널은 배포했든 아니든 작업 사본에 대해 테스트 모음을 실행하며, 바로 그 점이 핵심입니다. 배포 전에 알 수 있습니다. 통과한 테스트가 지나간 노드마다 체크가 붙고, 실패와 관련된 노드마다 가리키면 이유가 나오는 X가 붙으며, 실패를 클릭하면 그 노드로 이동합니다. 무엇이든 고치면 표시는 사라지는데, 이미 없는 플로를 설명하는 표시이기 때문입니다. **Edit**은 테스트 모음 전체를 YAML로 엽니다. [게이트](#배포-게이트)가 거부한 배포도 같은 패널에, 실패가 노드에 표시되어 나타납니다.

이 모두가 풀 리퀘스트마다 실제 브라우저에서 실제 바이너리를 상대로 실행됩니다.

## 배포 게이트

누군가의 노트북에서 한 테스트는 그 사람이 노트북에 갖고 있던 플로를 증명합니다. 게이트는 배포되는 플로를 증명합니다. 테스트 모음을 인스턴스에, 테스트 대상 플로 파일 옆에 두고(`data/flows.json` 옆의 `data/flows.test.yaml`, `PUT /tests` 또는 편집기 사용), `tests.gate`를 켜면, 모든 배포가 적용하려는 플로에 대해 이를 실행합니다. 통과하지 못하면 거부되며 422와 전체 보고서가 돌아옵니다.

```
$ hotloop-flow deploy -file flows.json -note "raise the alarm at 95"
1 changed

Tab "Line 3" (t1)
  ~ switch "over limit?" (chk)
      rules[0].v: "80" -> "95"
hotloop-flow: the deploy was refused: 1 of 2 flow tests didn't pass, and the flows already running are untouched; "a high reading raises the alarm and nothing else": expect 1: switch "over limit?" (chk): nothing sent from port 1

--- FAIL: a high reading raises the alarm and nothing else (0.00s)
    expect 1: switch "over limit?" (chk): nothing sent from port 1
    expect 2: switch "over limit?" (chk): expected nothing, and 1 message(s) sent from port 2
      at 0s: {"payload":92.5,"topic":"line3/temp"}
    expect 3: debug "alarm out" (alarm-out): nothing received
--- PASS: a negative reading is caught, not alarmed on (0.00s)
FAIL	flows.test.yaml	1 passed, 1 failed, 0 errors (0.00s)
```

실제 실행입니다. 게이트를 켠 바이너리, 이 절 앞부분의 테스트 모음을 플로 파일 옆에 둔 상태, 그리고 배포 토큰으로 돌렸습니다.

**이미 돌고 있는 플로는 알아채지 못합니다.** 게이트는 한 바이트도 쓰기 전에 실행됩니다. 플로 파일도, 자격 증명도, 배포 기록도, 재시작도 없습니다. 거부는 테스트가 실패했다고 적힌 `deploy.refused`로 감사 추적에 남습니다. 그리고 테스트는 서버 프로세스에서 아예 실행되지 않습니다. 같은 바이너리를 `hotloop-flow test -stdin`으로 띄운 자식 프로세스에서 실행되며, 후보 플로와 테스트 모음은 stdin으로 넘깁니다. 테스트는 플로의 모든 노드를 시작하는데, 일부는 프로세스 전체가 공유하는 곳에 등록하기 때문입니다. Link In은 id로, HTTP 경로는 경로로 등록합니다. 서버 안에서 실행하면 후보의 Link In이 시작하는 순간 실행 중인 플로의 Link In을 대신해 응답하게 됩니다. 자식 프로세스에서는 라인이 쓰는 어떤 것도 건드릴 수 없고, 자체 고루틴에서 패닉이 난 노드는 공장이 아니라 테스트를 무너뜨리며, 메모리는 종료할 때 돌아옵니다. 테스트는 이를 어려운 방식으로 증명합니다. 거부된 후보가 같은 Link In을 갖고 있는데도, 거부 뒤 실행 중인 플로의 링크로 보낸 메시지는 여전히 도착합니다.

알아 둘 결정이 세 가지 있습니다. **기본값은 꺼짐**입니다. 운영자가 요청하지 않은 게이트는 근무자 누구도 들어 본 적 없는 이유로 새벽 3시에 실패하는 배포이기 때문입니다. **실행할 수 없는 테스트는 통과하지 않습니다.** 시작하지 않는 자식 프로세스나 `tests.timeout`보다 오래 걸리는 실행은 배포를 거부하고 어느 쪽인지 알려 줍니다. 그리고 **롤백은 게이트를 거치지 않습니다.** 롤백은 나쁜 상태에서 이미 돌았던 상태로 빠져나오는 길이며, 오늘의 테스트 때문에 막으면 장애만 길어집니다. 게이트를 켰는데 테스트 모음이 없으면 실패할 것이 없으므로 배포는 진행되고, 로그에 확인하지 않은 이유가 남습니다.

## 컨텍스트와 자격 증명

모든 테스트는 앞 테스트가 무엇을 남겼든 빈 컨텍스트로 시작합니다. 한 테스트가 카운터를 42까지 올렸다고 다음 테스트가 거기서 시작하지 않습니다. 첫 테스트가 먼저 돌아야만 두 번째가 통과하는 테스트 모음은, 누군가 테스트 하나만 돌리는 날 거짓말을 하는 모음이기 때문입니다. 그래서 카운터가 41이어야 하는 테스트는 그렇다고 적고, 끝났을 때 컨텍스트에 무엇이 있어야 하는지도 적습니다.

```yaml
  - name: picks up where the line left off
    context:                        # what the test starts with
      global: {limit: 90}
      flow: {Line 3: {count: 41}}   # flow context, by tab label or id
    credentials:                    # by node name or id; never the real ones
      historian: {token: test-token}
      plc api: {password: s3cret}
    inject: [{node: count, msg: {payload: 95}}]
    expect:
      - {node: out, msg: {count: 42}}
      - context:                    # what it holds at the end
          global: {alarm: true}
          flow: {Line 3: {count: 42}}
          node: {count: {last: 95}} # node context, by node name or id
```

기대 안의 `context`는 `msg`처럼 비교되며, `null`은 그 키가 설정되어 있지 않아야 한다는 뜻입니다. 실패하면 스코프에 실제로 무엇이 들어 있는지 알려 주는데, 흔한 원인이 오타이기 때문입니다. `flow context of "Line 3" (t1): cuont: not set; it holds count`

테스트는 실제 자격 증명을 절대 보지 못합니다. 테스트가 지정한 자격 증명으로 실행되므로 안심하고 커밋할 수 있으며, 그 자격 증명은 실제 것과 똑같이 노드에 도달합니다. HTTP 요청의 비밀번호는 보내려던 `Authorization` 헤더에 나타나고, 토큰 없이는 시작하지 않는 InfluxDB 설정은 테스트의 토큰으로 시작합니다. `ew_credentialFiles`로 마운트된 파일에서 비밀번호를 읽는 노드는 그 필드에 대해 테스트의 자격 증명을 받는데, 테스트는 디스크에서 아무것도 읽지 않기 때문이며, 테스트가 지정하지 않으면 빈 값을 받습니다.

컨텍스트는 테스트 동안 메모리에만 있고 상태 데이터베이스에는 절대 없으므로, 테스트는 실행 중인 플로가 남긴 것을 읽을 수 없고 그들에게 무엇도 남길 수 없습니다. 픽스처는 테스트 안의 YAML이지, 데이터베이스인 척하는 파일이 아닙니다.

## 테스트 밖으로는 나가지 않습니다

테스트가 MQTT Out을 실제로 실행하면 공장의 브로커에 발행하게 되고, 그러면 테스트가 아니라 배포입니다. 그래서 테스트 중에는 프로세스 밖 세계와 통신하는 모든 노드가 대역으로 바뀝니다. MQTT 입력과 출력, HTTP in·response·request, PostgreSQL, InfluxDB, TCP와 UDP의 입력·출력·request, WebSocket 입력과 출력 및 그 뒤의 리스너와 클라이언트, 파일 노드, `exec`, `scan`, `netinfo`가 해당합니다.

노드는 전선 바로 앞까지 자기 일을 모두 합니다. MQTT Out은 여전히 토픽, QoS, 바이트를 계산하고, HTTP Request는 URL을 만들고 본문을 구성하며 리디렉션을 따라가고, PostgreSQL 노드는 SQL과 매개변수를 만듭니다. 그런 다음 그것을 대역에 넘기면, 대역은 이를 기록하고 테스트가 정해 둔 응답을 돌려줍니다. 정해 두지 않으면 응답은 아무것도 없음과 성공입니다. 행이 없고, 빈 200이며, 0으로 끝난 명령입니다. 소스(MQTT In, HTTP In, TCP와 UDP In, WebSocket In, Watch)는 구독하거나 수신 대기하거나 폴링하지 않으므로, 도착하는 것은 테스트가 주입한 것입니다.

```yaml
  - name: the limit comes from the database and the alarm goes to the broker
    inject:
      - node: reading
        msg: {topic: "3", payload: 92.5}
    replies:
      - node: lookup limit                   # a PostgreSQL query
        reply: {rows: [{limit_c: 90}]}
      - node: maintenance api                # an HTTP Request
        reply: {statusCode: 503, payload: {error: down for maintenance}}
      - node: historian                      # InfluxDB, and it's down
        error: connection refused
    expect:
      - node: lookup limit
        sent: {query: "select limit_c from limits where line = $1", params: ["3"]}
      - node: to the plant                   # an MQTT Out
        sent: {topic: line3/alarm, payload: HIGH, qos: 1, retain: true}
      - node: errors
        error: connection refused
```

**`sent`**는 노드가 보냈을 내용이며 `msg`처럼 비교됩니다. **`replies`**는 돌아오는 응답을 정합니다. 노드에 나열한 첫 응답이 첫 호출에, 다음이 두 번째 호출에 답하고 마지막 것이 계속 답하므로, "응답하다가 멈췄다"는 두 줄이면 됩니다. **`error`**는 실제처럼 호출을 실패시키므로, 히스토리언이 멈췄을 때 플로가 택하는 경로를 히스토리언이 멈추기 전에 테스트할 수 있습니다.

| 노드 | `sent` | `reply` |
|---|---|---|
| MQTT Out | `topic`, `payload`, `qos`, `retain` | |
| HTTP Request | `method`, `url`, `headers`, `payload` | `statusCode` (200), `headers`, `payload` |
| HTTP Response | `statusCode`, `headers`, `payload` | |
| PostgreSQL | `query`, `params` | 쿼리는 `rows`, insert는 `rowCount` |
| InfluxDB | `line`, 라인 프로토콜 | |
| TCP Out, UDP Out | `host`, `port`, `payload` (응답할 때는 `session`) | |
| TCP Request | `host`, `port`, `payload` | `payload`, 노드가 실제 응답을 읽는 방식대로 읽음 |
| WebSocket Out | `payload` (응답할 때는 `session`) | |
| File | `filename`, `action`, `payload` | |
| File In | `filename` | `payload`, 내용 |
| exec | `command`, `args` | `stdout`, `stderr`, `code` (0) |
| scan | `range`, `ports` | `devices` |
| netinfo | | `interfaces` |

테스트가 일부러 확인하지 않는 것이 몇 가지 있는데, 플로가 아니라 장비에 속하기 때문입니다. `exec`의 허용 목록, 경로와 디스커버리 범위, `tls-config`의 인증서입니다. 테스트 중에는 아무것도 실행하거나 열거나 탐색하거나 걸지 않으므로 가두거나 암호화할 대상이 없고, 배포가 도착하는 장비에서는 배포가 이 모두에 대해 여전히 책임을 집니다.

증거는 이런 테스트입니다. 이 노드들을 모두 테스트가 쥔 TCP 포트, UDP 포트, 디렉터리로 향하게 하고, 판독값을 모든 노드에 통과시키고, 각 노드가 보냈을 내용을 바이트 단위로 확인한 다음 셉니다. 연결 0, 데이터그램 0, 쓰인 파일 없음, 실행된 것 없음입니다. 바깥으로 나가는데 대역이 없는 노드는 아무것도 실행되기 전에 이름으로 거부되며, 누군가 하나라도 추가하면 팔레트 테스트가 실패합니다.
