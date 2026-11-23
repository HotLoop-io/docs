---
title: "Flow 配置"
description: "Flow 读取的每项设置、默认值、环境变量覆盖方式，以及错误的值在启动时会造成什么后果。"
---

声明式 YAML，可用环境变量覆盖。您无需运行它，就可以验证、比较、用 ConfigMap 生成它并对其进行推演，这就是配置文件该做到的一切，别无其他。下面的每个字段都是可选的，并按默认值显示。

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

该文件中的拼写错误会导致启动失败，而不是一项悄悄不起作用的设置，因为未知字段会被拒绝。把 `credentialSecret` 拼错的运维人员应当立即发现，而不是六个月后才注意到凭据文件是明文的。

## 环境变量覆盖

环境变量优先于文件，这是在 Kubernetes 上唯一可行的划分：Helm chart 把普通设置放进 ConfigMap，再从 Secret 注入密钥。

| 变量 | 设置 |
|---|---|
| `HOTLOOP_FLOW_CONFIG` | YAML 文件的路径。 |
| `HOTLOOP_FLOW_HOST`, `HOTLOOP_FLOW_PORT` | 监听器。 |
| `HOTLOOP_FLOW_ADMIN_ROOT`, `HOTLOOP_FLOW_HTTP_ROOT` | 路径前缀。 |
| `HOTLOOP_FLOW_DATA_DIR`, `HOTLOOP_FLOW_FLOW_FILE` | 状态存放的位置。 |
| `HOTLOOP_FLOW_CREDENTIAL_SECRET` | 凭据加密密钥。 |
| `HOTLOOP_FLOW_ADMIN_USER`, `HOTLOOP_FLOW_ADMIN_PASSWORD_HASH` | 一个拥有全部权限的管理员账户，使首次运行的容器无需挂载文件即可使用。两者必须同时设置。 |
| `HOTLOOP_FLOW_DEPLOY_TOKEN_HASH` | 一个名为 `deploy` 的部署令牌，供 CI/CD 使用：只有 `flows.read` 和 `flows.write`，没有别的。用的是哈希，绝不是令牌本身。同时要推送到工作站的令牌（[推送到租户的工作站](/zh-hans/flow/stations/)）还需要 `status.read`，所以请在配置文件中创建。 |
| `HOTLOOP_FLOW_ASSERTION_PUBLIC_KEY_FILE`, `HOTLOOP_FLOW_ASSERTION_AUDIENCE` | 从 EmberCORE 仪表板登录。密钥是仪表板的 ES256 公钥（一个 PEM 文件），audience 是 `<tenant>/<release>`。没有密钥文件则为关闭，默认也是关闭。 |
| `HOTLOOP_FLOW_ASSERTION_ISSUER`, `HOTLOOP_FLOW_ASSERTION_HEADER`, `HOTLOOP_FLOW_ASSERTION_HIDE_LOGIN` | 签发者（`embernet-dashboard`）、请求头（`X-Embernet-Assertion`），以及编辑器是否省略自己的登录表单（`true`）。 |
| `HOTLOOP_FLOW_GIT_URL`, `HOTLOOP_FLOW_GIT_USERNAME`, `HOTLOOP_FLOW_GIT_PASSWORD` | git 镜像。密码（访问令牌）只能通过环境变量设置。 |
| `HOTLOOP_FLOW_INBOX_CAPACITY`, `HOTLOOP_FLOW_OVERFLOW` | 调度器默认值。 |
| `HOTLOOP_FLOW_STORE_PATH`, `HOTLOOP_FLOW_STORE_SYNCHRONOUS` | 状态数据库：位置，以及是否对每次提交执行 fsync。 |
| `HOTLOOP_FLOW_CONTEXT_PERSIST`, `HOTLOOP_FLOW_CONTEXT_FLUSH_INTERVAL` | 持久上下文。`false` 将其关闭；间隔是类似 `30s` 的时长。 |
| `HOTLOOP_FLOW_TRACE_OTLP_HEADERS` | 收集器的请求头，以逗号分隔的 `Name=value` 对，追加到文件中已有的之上。适用于不该放进 ConfigMap 的 API 密钥。 |
| `HOTLOOP_FLOW_DURABLE_MAX_BYTES`, `HOTLOOP_FLOW_DURABLE_ACK_FLUSH` | 持久连线的磁盘配额，以及已送达的消息等待被标记为完成的时间。 |
| `HOTLOOP_FLOW_TESTS_GATE` | `true` 开启[部署门禁](/zh-hans/flow/tests/#部署关卡)。 |
| `HOTLOOP_FLOW_LOG_LEVEL`, `HOTLOOP_FLOW_LOG_FORMAT` | 日志。 |
| `HOTLOOP_FLOW_DISCOVERY_ENABLED`, `HOTLOOP_FLOW_DISCOVERY_CIDRS` | 发现节点。以逗号分隔的 CIDR。 |
| `HOTLOOP_FLOW_EXEC_ENABLED`, `HOTLOOP_FLOW_EXEC_ALLOWED_COMMANDS` | exec 节点。以逗号分隔的命令。 |
| `HOTLOOP_FLOW_PLUGINS_DIR`, `HOTLOOP_FLOW_PLUGIN_TRUSTED_KEYS` | 插件所在位置，以及受信任的发布者密钥。以逗号分隔的密钥。 |
| `HOTLOOP_FLOW_PLUGIN_GRANTS` | 插件可以使用的内容：`name=cap,cap;name=cap`。 |
| `HOTLOOP_FLOW_PLUGIN_MAX_MEMORY_MIB`, `HOTLOOP_FLOW_PLUGIN_MAX_TIMEOUT` | 插件节点的内存上限和每条消息的时间上限。 |
| `HOTLOOP_FLOW_FILE_ALLOWED_PATHS` | file 节点的额外根目录。以逗号分隔。 |
| `HOTLOOP_FLOW_SECRET_ALLOWED_PATHS` | 可读取密钥文件的额外根目录。以逗号分隔。 |
| `HOTLOOP_FLOW_INSECURE` | `true` 会在关闭认证的情况下运行，其他任何值都不会。只有 `1`、`true`、`yes` 和 `on` 有效，所以 `false` 或 `0` 不会意外将其关闭。适用于您已决定自行负责的隔离网络。它并不免除凭据密钥。 |
| `HOTLOOP_FLOW_ALLOW_PLAINTEXT_CREDENTIALS` | 允许静态存放未加密的凭据。 |

开关类变量只接受 `1`、`true`、`yes` 和 `on`，不区分大小写。其他一切都是关闭，所以 `HOTLOOP_FLOW_ALLOW_PLAINTEXT_CREDENTIALS=0` 表示否，而不是“已设置，所以是”。一个因为有人输入了 `=false` 就打开的安全开关，正是会出现在事故报告里的那类事情。

不在该表中的内容只能在文件中设置，这是有意为之：会话 TTL、备份代数、请求大小限制和服务器超时，都是应该有人在 ConfigMap 中审阅的决定，而不是在产线停机的凌晨 3 点往 shell 里敲的东西。
