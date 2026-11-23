---
title: "Flow 설정"
description: "Flow가 읽는 모든 설정과 기본값, 환경 변수 재정의, 잘못된 값이 시작 시 일으키는 동작을 정리했습니다."
---

환경 변수로 재정의할 수 있는 선언형 YAML입니다. 실행하지 않고도 검증하고, 비교하고, ConfigMap으로 만들어 내고, 내용을 따져 볼 수 있으며, 설정 파일이 해야 할 일은 이것이 전부입니다. 아래의 모든 필드는 선택 사항이며 기본값으로 표시했습니다.

```yaml
server:
  host: 0.0.0.0
  port: 1880
  adminRoot: /              # where the editor and admin API live
  httpRoot: /               # where a flow's HTTP In nodes live
  readTimeout: 60s          # generous: a big deploy over a slow edge link is legitimate
  writeTimeout: 0s          # zero on purpose, the comms websocket is long-lived
  shutdownTimeout: 20s
  maxRequestBytes: 33554432 # 32 MiB, bounds a flow deploy

data:
  dir: /data                # the PVC. Flows, credentials, the deployment log and state.db live here
  flowFile: flows.json
  credentialsFile: credentials.json
  credentialSecret: ""      # empty means plaintext, which is refused by default
  allowPlaintextCredentials: false
  backupGenerations: 3

history:
  retain: 100               # deployment records kept under data.dir/deployments; 0 keeps all
  git:
    url: ""                 # empty is off; see "A git mirror"
    branch: main
    path: flows.json
    emailDomain: flow.invalid

auth:
  enabled: true             # off refuses to start unless HOTLOOP_FLOW_INSECURE=true
  sessionTTL: 168h          # sessions live in data.dir/sessions.json, hashed, and survive restarts
  lockout:
    attempts: 5             # failures for one account from one address before it locks there
    perAddress: 20          # failures from one address, any account, before the address locks
    window: 15m
    duration: 15m
  users:
    - username: admin
      passwordHash: "$2a$10$..."   # bcrypt only, never plaintext
      permissions: ["*"]
  tokens:                   # API tokens for machines; the hash only, from: hotloop-flow token
    - name: ci
      hash: "sha256:..."
      permissions: ["flows.read", "flows.write"]   # add "status.read" for a token that pushes to stations
      # rateLimit: {calls: 60, per: 1m}   # MCP tool calls per window; unset is no limit

runtime:
  inboxCapacity: 1024
  overflow: block           # block | drop-newest | drop-oldest | error
  blockTimeout: 30s
  closeTimeout: 15s

store:
  path: ""                  # empty is state.db in data.dir: persistent context and durable wires
  synchronous: normal       # normal | full. full fsyncs every commit, and wears the card
  context:
    persist: true           # false is memory only
    flushInterval: 30s      # a changed value waits this long; a kill -9 loses it. 0s writes at once
  durable:
    maxBytes: 268435456     # disk quota for every durable wire together
    ackFlush: 100ms         # how long a delivered message waits to be marked done; 0s marks each one first

discovery:
  enabled: false
  allowedCIDRs: []          # enabled with this empty is a startup error

exec:
  enabled: false
  allowedCommands: []       # enabled with this empty is a startup error

files:
  allowedPaths: []          # extra trees on top of data.dir, which is always allowed

plugins:
  dir: ""                   # empty means plugins/ inside data.dir
  trustedKeys: []           # publisher keys: ed25519:<base64>, a PEM public key, or a file holding one. Empty refuses every plugin
  grants: {}                # plugin name to the host access it may have: clock, random, context.flow, context.global
  maxMemoryMiB: 64          # the most memory any one plugin node can be given
  maxTimeout: 5s            # the longest any one plugin node can be given for a message

secrets:
  allowedPaths: []          # where a tls-config may read a certificate or key, on top of data.dir

logging:
  level: info               # error | warn | info | debug | trace
  format: text              # text for a terminal, json for a cluster

metrics:
  enabled: true
  path: /metrics

audit:
  maxBytes: 16777216        # data.dir/audit.log rotates at 16 MiB
  keep: 4                   # rotated files kept beside it

tests:
  gate: false               # refuse a deploy that fails data.dir/flows.test.yaml
  timeout: 2m               # wall clock for one run of the flow tests

trace:                      # where every message went, kept in memory, bounded
  enabled: true
  traces: 256               # journeys kept, newest
  maxHops: 512              # hops one journey keeps
  maxMessageBytes: 16384    # the biggest message a hop keeps a copy of
  maxBytes: 16777216        # everything together, oldest forgotten first
  perSecond: 1000           # new traces a second; 0 traces every message
  otlp:
    endpoint: ""            # http://collector:4318 sends every hop as a span
    serviceName: hotloop-flow
    interval: 2s            # the longest a finished hop waits to be sent
```

이 파일의 오타는 아무 일도 하지 않고 조용히 넘어가는 설정이 아니라 시작 실패가 됩니다. 알 수 없는 필드는 거부되기 때문입니다. `credentialSecret`의 철자를 틀린 운영자는 6개월 뒤 자격 증명 파일이 평문이라는 것을 알게 되는 것이 아니라 즉시 알아야 합니다.

## 환경 변수 재정의

환경 변수가 파일보다 우선하며, 이는 Kubernetes에서 유일하게 쓸 만한 구분입니다. Helm 차트는 평범한 설정을 ConfigMap에 넣고 시크릿은 Secret에서 주입합니다.

| 변수 | 설정 대상 |
|---|---|
| `HOTLOOP_FLOW_CONFIG` | YAML 파일의 경로. |
| `HOTLOOP_FLOW_HOST`, `HOTLOOP_FLOW_PORT` | 리스너. |
| `HOTLOOP_FLOW_ADMIN_ROOT`, `HOTLOOP_FLOW_HTTP_ROOT` | 경로 접두사. |
| `HOTLOOP_FLOW_DATA_DIR`, `HOTLOOP_FLOW_FLOW_FILE` | 상태를 저장하는 위치. |
| `HOTLOOP_FLOW_CREDENTIAL_SECRET` | 자격 증명 암호화 시크릿. |
| `HOTLOOP_FLOW_ADMIN_USER`, `HOTLOOP_FLOW_ADMIN_PASSWORD_HASH` | 모든 권한을 가진 관리자 계정 하나로, 파일을 마운트하지 않아도 첫 실행 컨테이너를 쓸 수 있게 해 줍니다. 둘 다 설정해야 합니다. |
| `HOTLOOP_FLOW_DEPLOY_TOKEN_HASH` | CI/CD용으로 `deploy`라는 이름의 배포 토큰: `flows.read`와 `flows.write`만 있고 다른 것은 없습니다. 토큰이 아니라 해시를 씁니다. 스테이션으로도 푸시하는 토큰([테넌트의 스테이션으로 푸시하기](/ko/flow/stations/))에는 `status.read`도 필요하므로 설정 파일에서 만드십시오. |
| `HOTLOOP_FLOW_ASSERTION_PUBLIC_KEY_FILE`, `HOTLOOP_FLOW_ASSERTION_AUDIENCE` | EmberCORE 대시보드에서의 로그인. 키는 대시보드의 공개 ES256 키(PEM 파일)이고 audience는 `<tenant>/<release>`입니다. 키 파일이 없으면 꺼지며, 기본값은 꺼짐입니다. |
| `HOTLOOP_FLOW_ASSERTION_ISSUER`, `HOTLOOP_FLOW_ASSERTION_HEADER`, `HOTLOOP_FLOW_ASSERTION_HIDE_LOGIN` | 발급자(`embernet-dashboard`), 헤더(`X-Embernet-Assertion`), 그리고 에디터가 자체 로그인 양식을 생략할지 여부(`true`). |
| `HOTLOOP_FLOW_GIT_URL`, `HOTLOOP_FLOW_GIT_USERNAME`, `HOTLOOP_FLOW_GIT_PASSWORD` | git 미러. 비밀번호(액세스 토큰)는 환경 변수로만 설정합니다. |
| `HOTLOOP_FLOW_INBOX_CAPACITY`, `HOTLOOP_FLOW_OVERFLOW` | 스케줄러 기본값. |
| `HOTLOOP_FLOW_STORE_PATH`, `HOTLOOP_FLOW_STORE_SYNCHRONOUS` | 상태 데이터베이스: 위치와 모든 커밋을 fsync할지 여부. |
| `HOTLOOP_FLOW_CONTEXT_PERSIST`, `HOTLOOP_FLOW_CONTEXT_FLUSH_INTERVAL` | 영속 컨텍스트. `false`는 이를 끕니다. 간격은 `30s` 같은 기간입니다. |
| `HOTLOOP_FLOW_TRACE_OTLP_HEADERS` | 수집기용 헤더로, 쉼표로 구분한 `Name=value` 쌍이며 파일에 있는 것에 추가됩니다. ConfigMap에 둘 이유가 없는 API 키를 위한 것입니다. |
| `HOTLOOP_FLOW_DURABLE_MAX_BYTES`, `HOTLOOP_FLOW_DURABLE_ACK_FLUSH` | 내구성 와이어의 디스크 할당량과, 전달된 메시지가 완료로 표시되기를 기다리는 시간. |
| `HOTLOOP_FLOW_TESTS_GATE` | `true`는 [배포 게이트](/ko/flow/tests/#배포-게이트)를 켭니다. |
| `HOTLOOP_FLOW_LOG_LEVEL`, `HOTLOOP_FLOW_LOG_FORMAT` | 로깅. |
| `HOTLOOP_FLOW_DISCOVERY_ENABLED`, `HOTLOOP_FLOW_DISCOVERY_CIDRS` | 디스커버리 노드. 쉼표로 구분한 CIDR. |
| `HOTLOOP_FLOW_EXEC_ENABLED`, `HOTLOOP_FLOW_EXEC_ALLOWED_COMMANDS` | exec 노드. 쉼표로 구분한 명령. |
| `HOTLOOP_FLOW_PLUGINS_DIR`, `HOTLOOP_FLOW_PLUGIN_TRUSTED_KEYS` | 플러그인이 있는 위치와 신뢰할 게시자 키. 쉼표로 구분한 키. |
| `HOTLOOP_FLOW_PLUGIN_GRANTS` | 플러그인이 쓸 수 있는 것: `name=cap,cap;name=cap`. |
| `HOTLOOP_FLOW_PLUGIN_MAX_MEMORY_MIB`, `HOTLOOP_FLOW_PLUGIN_MAX_TIMEOUT` | 플러그인 노드의 메모리와 메시지당 시간의 상한. |
| `HOTLOOP_FLOW_FILE_ALLOWED_PATHS` | file 노드의 추가 루트. 쉼표로 구분. |
| `HOTLOOP_FLOW_SECRET_ALLOWED_PATHS` | 시크릿 파일을 읽을 수 있는 추가 루트. 쉼표로 구분. |
| `HOTLOOP_FLOW_INSECURE` | `true`는 인증을 끈 채 실행하며, 다른 어떤 값도 그렇게 하지 않습니다. `1`, `true`, `yes`, `on`만 인정되므로 `false`나 `0`으로 실수로 끌 수는 없습니다. 직접 책임지기로 한 격리된 네트워크를 위한 것입니다. 자격 증명 시크릿은 면제하지 않습니다. |
| `HOTLOOP_FLOW_ALLOW_PLAINTEXT_CREDENTIALS` | 저장 상태의 암호화되지 않은 자격 증명을 허용합니다. |

켜기와 끄기 변수는 대소문자와 관계없이 `1`, `true`, `yes`, `on`만 받습니다. 그 밖의 값은 모두 꺼짐이므로 `HOTLOOP_FLOW_ALLOW_PLAINTEXT_CREDENTIALS=0`은 "설정되어 있으니 예"가 아니라 아니요를 뜻합니다. 누군가 `=false`를 입력했다는 이유로 켜지는 안전 스위치는 사고 보고서에 오르기 딱 좋은 일입니다.

그 표에 없는 것은 파일 전용이며 의도적인 것입니다. 세션 TTL, 백업 세대 수, 요청 크기 제한, 서버 시간 제한은 라인이 멈춘 새벽 3시에 셸에 입력할 것이 아니라 ConfigMap에서 누군가 검토해야 하는 결정입니다.
