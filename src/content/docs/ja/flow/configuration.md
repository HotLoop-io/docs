---
title: "Flow の設定"
description: "Flow が読み込むすべての設定、既定値、環境変数による上書き、不正な値が起動時に何を起こすかを示します。"
---

環境変数で上書きできる宣言型の YAML です。実行しなくても検証し、差分を取り、ConfigMap から生成し、内容を検討できます。設定ファイルに求められるのはそれがすべてで、それ以上は不要です。以下のフィールドはすべて任意で、既定値で示しています。

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

このファイルのタイプミスは、黙って何もしない設定ではなく、起動時の失敗になります。未知のフィールドは拒否されるからです。`credentialSecret` のつづりを間違えた運用担当者は、半年後に資格情報ファイルが平文だと気づくのではなく、すぐに気づくべきです。

## 環境変数による上書き

環境変数はファイルより優先されます。これは Kubernetes で唯一うまくいく分け方で、Helm チャートは通常の設定を ConfigMap に置き、シークレットを Secret から注入します。

| 変数 | 設定内容 |
|---|---|
| `HOTLOOP_FLOW_CONFIG` | YAML ファイルへのパス。 |
| `HOTLOOP_FLOW_HOST`, `HOTLOOP_FLOW_PORT` | リスナー。 |
| `HOTLOOP_FLOW_ADMIN_ROOT`, `HOTLOOP_FLOW_HTTP_ROOT` | パスのプレフィックス。 |
| `HOTLOOP_FLOW_DATA_DIR`, `HOTLOOP_FLOW_FLOW_FILE` | 状態の保存場所。 |
| `HOTLOOP_FLOW_CREDENTIAL_SECRET` | 資格情報の暗号化シークレット。 |
| `HOTLOOP_FLOW_ADMIN_USER`, `HOTLOOP_FLOW_ADMIN_PASSWORD_HASH` | すべての権限を持つ管理者アカウント 1 つで、ファイルをマウントしなくても初回起動のコンテナを使えるようにします。両方を設定する必要があります。 |
| `HOTLOOP_FLOW_DEPLOY_TOKEN_HASH` | CI 用の `deploy` という名前のデプロイトークン。`flows.read` と `flows.write` だけで、ほかには何もありません。使うのはハッシュで、トークンではありません。ステーションにもプッシュするトークン([テナントのステーションへのプッシュ](/ja/flow/stations/))には `status.read` も必要なので、設定ファイルで作成してください。 |
| `HOTLOOP_FLOW_ASSERTION_PUBLIC_KEY_FILE`, `HOTLOOP_FLOW_ASSERTION_AUDIENCE` | EmberCORE ダッシュボードからのサインイン。キーはダッシュボードの公開 ES256 キー(PEM ファイル)で、audience は `<tenant>/<release>` です。キーファイルがなければオフで、既定もオフです。 |
| `HOTLOOP_FLOW_ASSERTION_ISSUER`, `HOTLOOP_FLOW_ASSERTION_HEADER`, `HOTLOOP_FLOW_ASSERTION_HIDE_LOGIN` | 発行者(`embernet-dashboard`)、ヘッダー(`X-Embernet-Assertion`)、およびエディターが独自のサインインフォームを省くかどうか(`true`)。 |
| `HOTLOOP_FLOW_GIT_URL`, `HOTLOOP_FLOW_GIT_USERNAME`, `HOTLOOP_FLOW_GIT_PASSWORD` | git ミラー。パスワード(アクセストークン)は環境変数でのみ設定します。 |
| `HOTLOOP_FLOW_INBOX_CAPACITY`, `HOTLOOP_FLOW_OVERFLOW` | スケジューラーの既定値。 |
| `HOTLOOP_FLOW_STORE_PATH`, `HOTLOOP_FLOW_STORE_SYNCHRONOUS` | 状態データベース: 場所と、すべてのコミットを fsync するかどうか。 |
| `HOTLOOP_FLOW_CONTEXT_PERSIST`, `HOTLOOP_FLOW_CONTEXT_FLUSH_INTERVAL` | 永続コンテキスト。`false` でオフになります。間隔は `30s` のような期間です。 |
| `HOTLOOP_FLOW_TRACE_OTLP_HEADERS` | コレクター用のヘッダー。カンマ区切りの `Name=value` の組で、ファイルにあるものに追加されます。ConfigMap に置くべきではない API キー向けです。 |
| `HOTLOOP_FLOW_DURABLE_MAX_BYTES`, `HOTLOOP_FLOW_DURABLE_ACK_FLUSH` | 耐久ワイヤーのディスククォータと、配信済みメッセージが完了としてマークされるまで待つ時間。 |
| `HOTLOOP_FLOW_TESTS_GATE` | `true` で[デプロイゲート](/ja/flow/tests/#デプロイゲート)をオンにします。 |
| `HOTLOOP_FLOW_LOG_LEVEL`, `HOTLOOP_FLOW_LOG_FORMAT` | ログ出力。 |
| `HOTLOOP_FLOW_DISCOVERY_ENABLED`, `HOTLOOP_FLOW_DISCOVERY_CIDRS` | ディスカバリーノード。カンマ区切りの CIDR。 |
| `HOTLOOP_FLOW_EXEC_ENABLED`, `HOTLOOP_FLOW_EXEC_ALLOWED_COMMANDS` | exec ノード。カンマ区切りのコマンド。 |
| `HOTLOOP_FLOW_PLUGINS_DIR`, `HOTLOOP_FLOW_PLUGIN_TRUSTED_KEYS` | プラグインの置き場所と、信頼する発行者キー。カンマ区切りのキー。 |
| `HOTLOOP_FLOW_PLUGIN_GRANTS` | プラグインが使えるもの: `name=cap,cap;name=cap`。 |
| `HOTLOOP_FLOW_PLUGIN_MAX_MEMORY_MIB`, `HOTLOOP_FLOW_PLUGIN_MAX_TIMEOUT` | プラグインノードのメモリとメッセージあたりの時間の上限。 |
| `HOTLOOP_FLOW_FILE_ALLOWED_PATHS` | file ノードの追加ルート。カンマ区切り。 |
| `HOTLOOP_FLOW_SECRET_ALLOWED_PATHS` | シークレットファイルを読み込める追加ルート。カンマ区切り。 |
| `HOTLOOP_FLOW_INSECURE` | `true` は認証をオフにして実行し、ほかの値ではそうなりません。有効なのは `1`、`true`、`yes`、`on` だけなので、`false` や `0` で誤ってオフになることはありません。自分で責任を持つと決めた隔離ネットワーク向けです。資格情報シークレットは免除されません。 |
| `HOTLOOP_FLOW_ALLOW_PLAINTEXT_CREDENTIALS` | 保存時の暗号化されていない資格情報を許可します。 |

オン/オフの変数が受け付けるのは、大文字小文字を問わず `1`、`true`、`yes`、`on` だけです。それ以外はすべてオフなので、`HOTLOOP_FLOW_ALLOW_PLAINTEXT_CREDENTIALS=0` は「設定されているから有効」ではなく「無効」を意味します。誰かが `=false` と入力したために入ってしまう安全スイッチは、まさにインシデント報告書に載るたぐいの話です。

その表にないものはファイル専用で、これは意図したものです。セッション TTL、バックアップの世代数、リクエストサイズの上限、サーバーのタイムアウトは、ラインが止まっている午前 3 時にシェルへ入力するものではなく、ConfigMap で誰かがレビューすべき決定です。
