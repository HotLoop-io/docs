---
title: "Cấu hình"
description: "Mọi cài đặt mà Flow đọc, giá trị mặc định, biến môi trường ghi đè và việc một giá trị sai gây ra khi khởi động."
---

YAML khai báo với phần ghi đè bằng biến môi trường. Bạn có thể kiểm tra tính hợp lệ, so sánh, tạo nó từ một ConfigMap và suy xét về nó mà không cần chạy, đó là tất cả những gì một tệp cấu hình nên cho phép và không hơn. Mọi trường bên dưới đều là tùy chọn và được hiển thị ở giá trị mặc định.

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

Một lỗi chính tả trong tệp đó là lỗi khi khởi động chứ không phải một cài đặt lặng lẽ không làm gì, vì các trường không xác định bị từ chối. Người vận hành viết sai `credentialSecret` sẽ biết ngay, chứ không phải sáu tháng sau khi nhận ra tệp thông tin xác thực là văn bản thuần.

## Biến môi trường ghi đè

Môi trường được ưu tiên hơn tệp, đây là cách chia duy nhất dùng được trên Kubernetes: một chart Helm đặt các cài đặt thông thường vào ConfigMap và đưa các bí mật vào từ một Secret.

| Biến | Đặt |
|---|---|
| `HOTLOOP_FLOW_CONFIG` | Đường dẫn tới tệp YAML. |
| `HOTLOOP_FLOW_HOST`, `HOTLOOP_FLOW_PORT` | Listener. |
| `HOTLOOP_FLOW_ADMIN_ROOT`, `HOTLOOP_FLOW_HTTP_ROOT` | Tiền tố đường dẫn. |
| `HOTLOOP_FLOW_DATA_DIR`, `HOTLOOP_FLOW_FLOW_FILE` | Nơi lưu trạng thái. |
| `HOTLOOP_FLOW_CREDENTIAL_SECRET` | Bí mật mã hóa thông tin xác thực. |
| `HOTLOOP_FLOW_ADMIN_USER`, `HOTLOOP_FLOW_ADMIN_PASSWORD_HASH` | Một tài khoản quản trị duy nhất với đầy đủ quyền, giúp một container chạy lần đầu dùng được mà không cần gắn tệp. Cả hai đều phải được đặt. |
| `HOTLOOP_FLOW_DEPLOY_TOKEN_HASH` | Một token triển khai tên `deploy`, cho CI/CD: `flows.read` và `flows.write`, không gì khác. Là mã băm, không bao giờ là token. Một token cũng đẩy tới các trạm ([Đẩy tới các trạm của một tenant](/vi/flow/stations/)) cần thêm `status.read`, nên hãy tạo nó trong tệp cấu hình. |
| `HOTLOOP_FLOW_ASSERTION_PUBLIC_KEY_FILE`, `HOTLOOP_FLOW_ASSERTION_AUDIENCE` | Đăng nhập từ bảng điều khiển EmberCORE. Khóa là khóa công khai ES256 của bảng điều khiển (một tệp PEM), audience là `<tenant>/<release>`. Không có tệp khóa thì tắt, và mặc định là tắt. |
| `HOTLOOP_FLOW_ASSERTION_ISSUER`, `HOTLOOP_FLOW_ASSERTION_HEADER`, `HOTLOOP_FLOW_ASSERTION_HIDE_LOGIN` | Bên phát hành (`embernet-dashboard`), tiêu đề (`X-Embernet-Assertion`) và việc trình soạn thảo có bỏ biểu mẫu đăng nhập riêng của nó hay không (`true`). |
| `HOTLOOP_FLOW_GIT_URL`, `HOTLOOP_FLOW_GIT_USERNAME`, `HOTLOOP_FLOW_GIT_PASSWORD` | Bản sao git. Mật khẩu (một token truy cập) chỉ đặt qua biến môi trường. |
| `HOTLOOP_FLOW_INBOX_CAPACITY`, `HOTLOOP_FLOW_OVERFLOW` | Mặc định của bộ lập lịch. |
| `HOTLOOP_FLOW_STORE_PATH`, `HOTLOOP_FLOW_STORE_SYNCHRONOUS` | Cơ sở dữ liệu trạng thái: nằm ở đâu và có fsync mỗi commit hay không. |
| `HOTLOOP_FLOW_CONTEXT_PERSIST`, `HOTLOOP_FLOW_CONTEXT_FLUSH_INTERVAL` | Ngữ cảnh bền vững. `false` tắt nó; khoảng thời gian là một khoảng như `30s`. |
| `HOTLOOP_FLOW_TRACE_OTLP_HEADERS` | Tiêu đề cho bộ thu thập, các cặp `Name=value` ngăn cách bằng dấu phẩy, thêm vào những cái có trong tệp. Dành cho khóa API không nên nằm trong ConfigMap. |
| `HOTLOOP_FLOW_DURABLE_MAX_BYTES`, `HOTLOOP_FLOW_DURABLE_ACK_FLUSH` | Hạn mức đĩa cho các dây bền vững, và thời gian một thông điệp đã giao chờ để được đánh dấu là xong. |
| `HOTLOOP_FLOW_TESTS_GATE` | `true` bật [cổng triển khai](/vi/flow/tests/#cổng-chặn-triển-khai). |
| `HOTLOOP_FLOW_LOG_LEVEL`, `HOTLOOP_FLOW_LOG_FORMAT` | Ghi nhật ký. |
| `HOTLOOP_FLOW_DISCOVERY_ENABLED`, `HOTLOOP_FLOW_DISCOVERY_CIDRS` | Các nút khám phá. CIDR ngăn cách bằng dấu phẩy. |
| `HOTLOOP_FLOW_EXEC_ENABLED`, `HOTLOOP_FLOW_EXEC_ALLOWED_COMMANDS` | Nút exec. Các lệnh ngăn cách bằng dấu phẩy. |
| `HOTLOOP_FLOW_PLUGINS_DIR`, `HOTLOOP_FLOW_PLUGIN_TRUSTED_KEYS` | Nơi đặt plugin và các khóa nhà phát hành được tin cậy. Các khóa ngăn cách bằng dấu phẩy. |
| `HOTLOOP_FLOW_PLUGIN_GRANTS` | Những gì plugin được dùng: `name=cap,cap;name=cap`. |
| `HOTLOOP_FLOW_PLUGIN_MAX_MEMORY_MIB`, `HOTLOOP_FLOW_PLUGIN_MAX_TIMEOUT` | Mức trần về bộ nhớ và thời gian cho mỗi thông điệp của một nút plugin. |
| `HOTLOOP_FLOW_FILE_ALLOWED_PATHS` | Các gốc bổ sung cho nút file. Ngăn cách bằng dấu phẩy. |
| `HOTLOOP_FLOW_SECRET_ALLOWED_PATHS` | Các gốc bổ sung mà tệp bí mật có thể được đọc từ đó. Ngăn cách bằng dấu phẩy. |
| `HOTLOOP_FLOW_INSECURE` | `true` chạy với xác thực tắt, và không giá trị nào khác làm vậy. Chỉ `1`, `true`, `yes` và `on` được tính, nên `false` hoặc `0` không thể vô tình tắt nó. Dành cho mạng cô lập mà bạn đã quyết định tự chịu trách nhiệm. Nó không miễn trừ bí mật thông tin xác thực. |
| `HOTLOOP_FLOW_ALLOW_PLAINTEXT_CREDENTIALS` | Cho phép thông tin xác thực không mã hóa khi lưu trữ. |

Các biến bật/tắt chỉ chấp nhận `1`, `true`, `yes` và `on`, viết hoa hay thường đều được. Mọi giá trị khác là tắt, nên `HOTLOOP_FLOW_ALLOW_PLAINTEXT_CREDENTIALS=0` nghĩa là không, chứ không phải "đã đặt, vậy là có". Một công tắc an toàn bật lên vì ai đó gõ `=false` chính là loại chuyện kết thúc trong một báo cáo sự cố.

Mọi thứ không có trong bảng đó chỉ có trong tệp, và đó là cố ý: TTL phiên, số thế hệ bản sao lưu, giới hạn kích thước yêu cầu và thời gian chờ của máy chủ là những quyết định cần được ai đó xem xét trong ConfigMap, chứ không phải gõ vào shell lúc 3 giờ sáng khi một dây chuyền đang dừng.
