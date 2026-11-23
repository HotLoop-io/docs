---
title: "k3s và Helm"
description: "Triển khai bất kỳ chart HotLoop nào trên k3s hoặc Kubernetes: các giá trị nên đặt, lựa chọn cơ sở dữ liệu, nâng cấp, hoàn tác và một bản cài tốt trông ra sao."
---

Chart triển khai hai khối lượng công việc: gateway (một Deployment, không giữ trạng thái bền vững nào của riêng nó) và TimescaleDB (một StatefulSet có volume). Đó là mặc định. `database.type` chọn một cơ sở dữ liệu khác: PostgreSQL thuần, hoặc SQLite, vốn hoàn toàn không phải khối lượng công việc thứ hai ([SQLite](#sqlite), bên dưới).

## Cài đặt

Qua App Store của bảng điều khiển EmberNet, hoặc trực tiếp:

```bash
helm install hotloop ./charts/hotloop \
  --namespace hotloop --create-namespace
```

Hoặc từ kho chart, cũng là URL mà App Store trỏ tới:

```bash
helm repo add hotloop https://hotloop.io/hotloop
helm install hotloop hotloop/hotloop \
  --namespace hotloop --create-namespace
```

Dạng thứ hai này chạy được từ 4.16.0, bản đầu tiên được phát hành dưới tên `hotloop`. Bản cuối cùng trước đó là `industrial-iot` 4.3.1, dưới tên cũ, và nâng cấp từ đó là một quy trình riêng: xem "Upgrading from 4.3.1" trong ghi chú 4.16.0 của README. Địa chỉ kho cũ, `https://embernet-ai.github.io/industrial-iot/`, trả về 404.

Một bản cài trần vẫn chạy. Chart tạo mật khẩu cơ sở dữ liệu và token MCP trong Secret của bản phát hành và dùng lại qua các lần nâng cấp, nên không cần cung cấp gì và một lần nâng cấp không đổi mật khẩu dưới chân một cơ sở dữ liệu đang chạy.

Truy cập không cần ingress hay tên miền phụ. Bảng điều khiển phát hiện ứng dụng bằng nhãn cửa hàng và chuyển tiếp qua proxy ở địa chỉ trong cụm:

```
<release>.<namespace>.svc.cluster.local:8080
```

Để xem trực tiếp:

```bash
kubectl -n hotloop port-forward svc/hotloop 8080:8080
```

## Các giá trị nên đặt

### Xác thực

Từ 4.4.0. Xem [Xác thực và người dùng](/vi/iot/authentication/) để biết mô hình đầy đủ; đây là phần phía chart.

```yaml
auth:
  enabled: true    # the default; requires a login
  insecure: false  # set true only for a deployment truly isolated behind the
                    # dashboard's own NetworkPolicy -- see AUTH.md
```

Với `enabled: true` (mặc định), chart tạo một tài khoản quản trị viên vào Secret của bản phát hành ở lần cài đầu, giống cách nó tạo mật khẩu cơ sở dữ liệu và token MCP, và dùng lại qua các lần nâng cấp:

```bash
kubectl get secret hotloop -n hotloop \
  -o jsonpath='{.data.admin-password}' | base64 -d
```

Đặt `auth.admin.password` một cách tường minh sẽ ghi đè giá trị được tạo.

### An toàn

Các giá trị quyết định liệu pod này có thể điều khiển máy móc hay không.

```yaml
safety:
  allowWrites: false      # the master switch -- off by default since 4.4.0
  allowMcpWrites: true    # agents (MCP) write wherever an operator could, once writes are on
  confirmWrites: true     # the UI asks before writing
```

Ghi bị tắt theo mặc định. Một tag chỉ đọc cho đến khi cờ `writable` của chính nó được đặt, giá trị ngoài dải đã cấu hình của tag bị từ chối (không bao giờ bị cắt: gửi 250 khi ai đó đã gõ 500 là âm thầm làm một việc khác), và mọi lần thử, **kể cả mọi lần bị từ chối**, đều được ghi lại cùng người thực hiện và nguồn. Nhưng một bản cài mới không nên cần cả ba điều kiện khớp nhau mới an toàn, nên chính công tắc tổng bắt đầu ở trạng thái đóng.

Để bật ghi sau khi bản triển khai đã được xem xét:

```yaml
safety:
  allowWrites: true
```

Chỉ cần vậy: các client MCP đọc và ghi như một người vận hành, dưới cùng quyền, cùng các tag ghi được và dải giá trị. `allowMcpWrites` được giao ở trạng thái bật trong mọi chart; nó tồn tại cho một bản triển khai quyết định khác đi, và không phải mặc định ở đâu cả.

### Historian

```yaml
historian:
  retentionDays: 90     # 0 keeps everything until the volume fills
  useTimescale: true

logbook:
  retentionDays: 90     # entity state changes; 0 keeps everything (see LOGBOOK.md)

database:
  postgresql:
    persistence:
      size: 20Gi
      storageClass: longhorn
```

Kích thước phụ thuộc vào số tag, tốc độ quét và vùng chết. Một nghìn tag mỗi giây không có vùng chết là khoảng 86 triệu dòng mỗi ngày; cùng nhà máy đó với vùng chết hợp lý thường ít hơn một bậc. Hãy đặt vùng chết trước khi mua dung lượng lưu trữ.

`useTimescale: false` buộc đi theo đường phân vùng gốc, tức là dáng vẻ khi chạy trên PostgreSQL thuần. Hữu ích để tái hiện một bản triển khai tại biên.

**Khi image TimescaleDB thay đổi.** Image mang thư viện của mọi phiên bản cũ hơn, nên một cơ sở dữ liệu tạo bằng image cũ vẫn chạy trên image mới, nhưng với phiên bản tiện ích mở rộng cũ, và ở lại đó cho đến khi có người chạy `ALTER EXTENSION timescaledb UPDATE`. Gateway làm việc đó khi khởi động: nó so sánh phiên bản đã cài với phiên bản máy chủ đi kèm và, nếu khác, chạy bản cập nhật như câu lệnh đầu tiên của một kết nối mới (TimescaleDB từ chối nó trong một phiên đã nạp phiên bản cũ). Log ghi `timescaledb extension updated from=... to=...`. Việc này cần một superuser, mà người dùng của cơ sở dữ liệu đi kèm là như vậy. Với cơ sở dữ liệu bên ngoài hoặc được quản lý mà không phải vậy, bạn nhận một cảnh báo kèm lệnh cần chạy, và lịch sử vẫn hoạt động trên phiên bản cũ trong lúc đó. Chỉ xảy ra khi `useTimescale` bật và các migration chạy lúc khởi động (`HOTLOOP_DB_MIGRATE`, bật theo mặc định).

### Thăm dò

```yaml
runtime:
  defaultPollIntervalMs: 1000
  minPollIntervalMs: 100      # a floor applied to every device
  timeoutMs: 10000
  maxConcurrentPolls: 32
```

`minPollIntervalMs` được cưỡng chế chứ không chỉ tin cậy. Thăm dò 10 ms vào một gateway nối tiếp là một cuộc tấn công từ chối dịch vụ có thêm vài bước.

### Client OPC UA

```yaml
opcuaClient:
  persistence:
    enabled: true      # off by default
    size: 64Mi
```

Một thiết bị kết nối tới máy chủ OPC UA bảo mật, hoặc đăng nhập bằng tên người dùng và mật khẩu mà máy chủ yêu cầu mã hóa, giữ một chứng chỉ và một kho tin cậy các chứng chỉ máy chủ đã duyệt (`HOTLOOP_OPCUA_CLIENT_PKI_DIR`, `/data/opcua-client-pki`). Hãy bật tính năng này trước khi thêm thiết bị như vậy: hệ thống tệp gốc chỉ đọc, nên nếu không có volume, thiết bị báo một lỗi nói rõ điều đó thay vì kết nối bằng chứng chỉ sẽ mất ở lần khởi động lại tiếp theo. Nó tắt theo mặc định vì thêm một PersistentVolumeClaim vào bản cài sẵn có, sẽ nằm ở Pending trên cụm không có StorageClass mặc định. Các thiết bị ẩn danh trên kênh không bảo mật không dùng nó. Việc duyệt chứng chỉ của một máy chủ, và mọi điều khác về các thiết bị này, nằm ở [Giao thức và driver](/vi/iot/protocols/#opc-ua-security-and-credentials).

### Mạng

```yaml
networkPolicy:
  enabled: true
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: dashboard-system
      ports:
        - protocol: TCP
          port: 8080
```

Hãy thu hẹp ingress vào namespace của bảng điều khiển khi đã biết. Egress được cố ý để không hạn chế: ứng dụng này tồn tại để chạm tới thiết bị ở những địa chỉ không ai liệt kê trước được, và một chính sách egress âm thầm chặn một lần thăm dò trông giống một driver hỏng hơn là một quy tắc tường lửa.

### Phần cứng: radio USB, bộ chuyển đổi nối tiếp và Bluetooth

Từ 4.19.7, mọi chart HotLoop (Gateway, IoT, Edge và Edge Relay) được giao với quyền truy cập mà phần cứng cần ở trạng thái bật, nên một bản cài trần từ App Store hoặc từ helm thấy được những gì cắm vào node mà không cần sửa tay, trên mạng pod. Đó là khối `hardware:` trong `values.yaml`: ba công tắc mặc định bật, và một tùy chọn mặc định tắt:

| Giá trị | Mặc định | Tác dụng |
|---|---|---|
| `hardware.privileged` | `true` | Container ứng dụng chạy ở chế độ đặc quyền (`privileged: true`, `allowPrivilegeEscalation: true`) và với quyền root (`runAsUser: 0`, `runAsNonRoot: false`, không bỏ capability). Root vì một node nối tiếp USB là `root:dialout 0660` và chính sách D-Bus của BlueZ cho root và nhóm `bluetooth` vào; một người dùng container không thuộc nhóm nào thì không mở được gì. Hệ thống tệp gốc vẫn chỉ đọc, còn init container và cơ sở dữ liệu đi kèm giữ ngữ cảnh riêng của chúng, không root và bỏ hết capability. |
| `hardware.usbDevices.enabled` | `true` | `/dev` của node (`hardware.usbDevices.hostPath`) được gắn vào `/dev`: các bộ chuyển đổi nối tiếp USB (`/dev/ttyUSB*`, `/dev/ttyACM*`, `/dev/serial/by-id/*`), kể cả cái cắm sau khi pod đã khởi động. Một container đặc quyền chỉ được giao các thiết bị tồn tại lúc nó khởi động; việc gắn là thứ làm một thiết bị cắm lại xuất hiện. |
| `hardware.bluetooth.enabled` | `true` | Thư mục D-Bus của node (`hardware.bluetooth.dbusPath`, `/run/dbus`, chứa `system_bus_socket`) được gắn vào cùng đường dẫn, để một client tới được BlueZ của node. Nó được tạo rỗng trên node không có D-Bus, nên pod vẫn khởi động ở đó. |
| `hardware.bluetooth.hostNetwork` | `false` | Tùy chọn tự bật, mặc định tắt, cho những gì cần mạng của node: socket Bluetooth của nhân (HCI, L2CAP) chỉ tồn tại trong network namespace của node, nên một client mở trực tiếp một cái, và việc khám phá lắng nghe trên mạng riêng của node (mDNS, SSDP, multicast của một radio), cần nó. Một client đi qua API D-Bus của BlueZ chỉ cần socket đã gắn và chạy được từ mạng pod. Khi bật, pod chạy trên mạng của node với các hệ quả nêu ở [Mạng](#mạng). |

Hôm nay HotLoop làm gì với nó: chưa gì cả. HotLoop không có mã Bluetooth, Z-Wave hay USB nối tiếp của riêng mình (Zigbee đến qua cầu Zigbee2MQTT trên MQTT, xem [MQTT broker nhúng](/vi/iot/broker/)); đây là quyền truy cập mà một tính năng, hoặc một sidecar đọc radio, cần, được chuẩn bị sẵn trước khi được yêu cầu.

Cái giá, có chủ ý và đã quyết định: pod là root trên node (đặc quyền, với `/dev` của node), và NetworkPolicy mặc định của chart vẫn bật cho phạm vi nó bao phủ. Pod ở lại trên mạng pod. Tắt bất kỳ phần nào bằng `--set hardware.privileged=false --set hardware.usbDevices.enabled=false --set hardware.bluetooth.enabled=false`; khi cả ba đều tắt, kết quả là, từng dòng một, pod mà 4.19.6 đã tạo ra (không root, bỏ mọi capability, gốc chỉ đọc, mạng pod). Với những gì cần mạng của node, đặt `hardware.bluetooth.hostNetwork=true` (hoặc `hostNetwork=true`): trang khi đó trả lời trên mọi địa chỉ của node tại `service.targetPort`, mỗi node mỗi cổng một HotLoop, NetworkPolicy không áp dụng cho pod, và `nodeSelector` ghim nó vào node có radio nó cần thấy.

### Triển khai tại biên

Image ứng dụng được build cho amd64 và arm64, còn TimescaleDB 2.30.1-pg17 là multi-arch, nên historian không phải thứ chặn một bản cài tại biên.

```yaml
resources:
  requests: {cpu: 100m, memory: 128Mi}
  limits:   {cpu: 500m, memory: 256Mi}

database:
  postgresql:
    persistence: {size: 5Gi}
    resources:
      requests: {cpu: 100m, memory: 256Mi}
      limits:   {cpu: 500m, memory: 512Mi}

historian:
  retentionDays: 30

nodeSelector:
  kubernetes.io/arch: arm64
```

### Phát hành lên trên qua Sparkplug

Một Gateway tại biên cũng có thể phát hành mọi thứ nó đọc lên một Gateway trung tâm, như một node biên Sparkplug B. Xem [Phát hành tại biên và lưu rồi chuyển tiếp](/vi/edge/edge-publish/) để biết nó phát hành gì và hàng đợi chuyển tiếp hoạt động ra sao; đây là phần phía chart.

```yaml
edgePublish:
  enabled: true
  broker: tcp://central.example.local:1883
  group: Plant1
  node: press-line-3          # empty uses the release name
  username: press-line-3
  existingSecret: central-mqtt # key "password", or set secretKey
  tls: false
  queueMaxBytes: 536870912     # 512 MiB; the default is 64 MiB, and 0 is unbounded
  persistence:
    size: 1Gi
```

Bật nó thì thay đổi gì, và vì sao:

- **Một PVC 1Gi cho hàng đợi chuyển tiếp**, gắn tại `/data/edge-publish`. Đó là nơi các số đọc dồn lại khi đường lên bị đứt, nên nó phải sống lâu hơn pod. `persistence.enabled: false` đặt nó vào một emptyDir, vốn sống qua lần khởi động lại container và không gì khác.
- **Deployment cuốn chiếu bằng `Recreate`.** Hàng đợi là một tệp có khóa. Một bản cập nhật cuốn chiếu khởi động pod mới trước, pod mới không mở được hàng đợi, không bao giờ sẵn sàng, và đợt triển khai treo mãi. Recreate dừng pod cũ trước; bạn mất vài giây thăm dò mỗi lần nâng cấp.
- **`replicaCount` phải là 1**, và chart từ chối kết xuất nếu không. Hai bản sao sẽ là hai nhà phát hành cùng nhận một node Sparkplug.
- **ID node mặc định là tên bản phát hành**, không phải tên máy chủ của pod. Tên máy chủ đổi mỗi lần triển khai, và một host Sparkplug sẽ thấy một node biên hoàn toàn mới mỗi lần.

Mật khẩu không bao giờ nằm trong một giá trị mặc định dạng văn bản thuần. Để trống `password` và `existingSecret` cho một broker ẩn danh thì không tạo Secret nào; đặt `password` thì chart đưa nó vào `<release>-edge-publish`; đặt `existingSecret` để dùng một cái bạn tự quản lý.

### Cơ sở dữ liệu bên ngoài

```yaml
database:
  postgresql:
    enabled: false
    auth:
      existingSecret: my-db-credentials
      secretKey: password
  external:
    host: timescale.plant.local
    port: 5432
    database: industrial
    username: industrial
  sslMode: require
```

Ứng dụng phát hiện TimescaleDB và nâng `tag_history` thành hypertable khi có tiện ích mở rộng. Với PostgreSQL thuần, nó chuyển sang phân vùng theo dải gốc thay vì thất bại.

Quyết định được ghi lại và **cố định**. Một cơ sở dữ liệu được tạo dưới dạng hypertable từ chối khởi động trên máy chủ không có tiện ích mở rộng thay vì âm thầm ghi vào nơi khác; nếu bạn thấy lỗi đó, bạn đã trỏ ứng dụng vào một cơ sở dữ liệu khác với cái nó được xây dựng trên đó.

### SQLite

Cơ sở dữ liệu là một thiết lập, không phải một image. Mọi sản phẩm chạy trên SQLite, Postgres hoặc TimescaleDB từ cùng một tệp nhị phân (IoT bỏ qua TimescaleDB, xem bên dưới):

| Biến | Mặc định | Tác dụng |
|---|---|---|
| `HOTLOOP_DB_TYPE` | `postgres` | `postgres` hoặc `sqlite`. TimescaleDB là `postgres` với tiện ích mở rộng trên máy chủ |
| `HOTLOOP_DB_PATH` | `/data/hotloop.db` | Tệp SQLite. Chỉ SQLite đọc nó |

SQLite là bản Go thuần (`modernc.org/sqlite`), được biên dịch vào mọi image, nên không có container thứ hai, không có image Postgres 300 MB trên thẻ SD, và các bản build arm vẫn tĩnh. Đặt tệp trên một volume sống lâu hơn container, và trên Pi hãy đặt volume đó trên SSD USB. Một historian ghi vào thẻ SD cả ngày là cách để mua rất nhiều thẻ SD.

Điều giống nhau: mọi bảng, mọi cột, mọi tính năng. Điều khác:

- Lịch sử là một bảng có một chỉ mục, không phải phân vùng hay hypertable, và chính sách lưu giữ xóa các dòng cũ thay vì bỏ cả tháng. Một nhà máy có nhiều năm lịch sử mỗi giây muốn Postgres hoặc TimescaleDB, và chuyển sang đó là sao lưu rồi khôi phục (BACKUP.md).
- Mỗi lúc chỉ một bộ ghi. SQLite lần lượt ghi và đọc song song với việc ghi (WAL), thừa đủ cho một HotLoop và một trình trợ giúp `--mcp-stdio` bên cạnh trên cùng tệp. Nó không dành cho hai bản sao trên lưu trữ mạng: SQLite trên NFS bị hỏng, nên một bản triển khai SQLite là một pod với volume cục bộ.
- Các lần commit là `synchronous=FULL`: khi API nói đã lưu, nó đã nằm trên đĩa, dù có mất điện hay không.

**HotLoop IoT** mặc định giữ 30 ngày lịch sử (`HOTLOOP_HISTORIAN_RETENTION_DAYS` vẫn thắng khi được đặt) và không bao giờ tạo hypertable: TimescaleDB là một phần của Edge và Gateway. Đặt `HOTLOOP_HISTORIAN_TIMESCALE=true` trên IoT thì nó báo điều đó lúc khởi động và chạy trên các phân vùng thường. Một cơ sở dữ liệu chuyển xuống từ Edge hoặc Gateway đã có hypertable thì giữ nó và tiếp tục hoạt động.

#### Chọn cơ sở dữ liệu trong chart

Một giá trị, `database.type`, và mỗi sản phẩm nhận những giá trị nó chạy được:

| `database.type` | Cái được triển khai | IoT | Edge | Gateway |
|---|---|---|---|---|
| `timescaledb` | Ứng dụng và TimescaleDB (một StatefulSet và volume của nó). Lịch sử trong hypertable | bị từ chối | mặc định | mặc định |
| `postgresql` | Ứng dụng và PostgreSQL 17 thuần (một StatefulSet và volume của nó). Lịch sử trong phân vùng gốc | mặc định | có | có |
| `sqlite` | Chỉ ứng dụng, với tệp cơ sở dữ liệu trên volume riêng | có | có | có |

```bash
helm install hotloop hotloop/hotloop-iot --namespace hotloop --create-namespace   --set database.type=sqlite
```

Yêu cầu `timescaledb` cho IoT làm bản cài thất bại và nói IoT chạy trên gì (`database.type is "timescaledb", and HotLoop IoT runs on sqlite, postgresql`), và biểu mẫu trong App Store không đưa ra lựa chọn đó. `helm lint` không bắt được (helm 3.22 lint sạch), nên chính việc kết xuất từ chối. Bỏ `database.type` là dùng mặc định của chính sản phẩm, nên một lần nâng cấp với `--reuse-values` từ trước khi khóa tồn tại vẫn giữ cơ sở dữ liệu nó có.

`sqlite` kết xuất:

- `HOTLOOP_DB_TYPE=sqlite` và `HOTLOOP_DB_PATH=/data/db/hotloop.db`, và không có thiết lập kết nối Postgres nào. Không có pod cơ sở dữ liệu, không có mật khẩu cơ sở dữ liệu trong Secret, không có init container chờ một cái.
- Một PersistentVolumeClaim tên `<release>-db` (`database.sqlite.persistence`: `size`, `storageClass`, `accessMode`, lúc đầu là 10Gi và mặc định của cụm), gắn tại `/data/db`. Thư mục, không phải tệp: SQLite giữ một `-wal` và một `-shm` bên cạnh cơ sở dữ liệu. Đặt nó trên lưu trữ cục bộ; SQLite trên NFS bị hỏng.
- Deployment ở `Recreate`, không phải cập nhật cuốn chiếu, vì volume là `ReadWriteOnce` và tệp có một bộ ghi. `replicaCount` trên 1 làm bản cài thất bại.

NetworkPolicy không đổi và vẫn bật: chính sách riêng của ứng dụng vẫn áp dụng, và chính sách của cơ sở dữ liệu chỉ được kết xuất khi có pod cơ sở dữ liệu để bảo vệ.

Đổi `database.type` trên một bản phát hành đã có dữ liệu không di chuyển dữ liệu. Cơ sở dữ liệu mới bắt đầu trống, nên chuyển một nhà máy giữa các cơ sở dữ liệu là sao lưu rồi khôi phục (BACKUP.md), giống như với biến. Đặc biệt, một cơ sở dữ liệu được tạo dưới dạng hypertable TimescaleDB từ chối khởi động trên PostgreSQL thuần, nên đừng chuyển một Edge hoặc Gateway sẵn có từ `timescaledb` sang `postgresql` rồi mong nó lên.

#### Chọn cơ sở dữ liệu trong Quadlet

Thư mục của mỗi sản phẩm dưới `deploy/quadlet/` có các tệp PostgreSQL hoặc TimescaleDB như cũ, và một thư mục `sqlite/` bên cạnh: `hotloop.container` và `hotloop-data.volume`, chỉ ứng dụng với tệp ở `/data/hotloop.db` trên volume `hotloop-data`. Nó theo `:stable` và hoàn tác bản cập nhật lỗi theo cùng cách. Hãy cài hai tệp đó thay cho các tệp kia (chúng dùng cùng tên unit), và tạo hai secret thay vì ba: không có mật khẩu cơ sở dữ liệu. [`deploy/quadlet/README.md`](/vi/install/quadlet/) có các bước.

Để dùng phân vùng Postgres thuần trên Edge hoặc Gateway dưới Quadlet, giữ unit TimescaleDB và thêm `Environment=HOTLOOP_HISTORIAN_TIMESCALE=false` vào `hotloop.container`. Unit của IoT vốn đã chạy PostgreSQL thuần.

### Khóa thông tin xác thực của thiết bị

```yaml
secretKey:
  enabled: true
  existingSecret: ""     # or a Secret you manage, with the key under secret.key
```

Mật khẩu thiết bị (đăng nhập bảng điều khiển UniFi, mật khẩu OPC UA hoặc MQTT, khóa HTTP API) được mã hóa trong cơ sở dữ liệu bằng khóa này, nên một bản dump hoặc bản sao lưu chỉ chứa văn bản mã hóa. Mặc định, chart tạo một khóa trong `<release>-secret-key` ở lần cài đầu, giữ nó qua các lần nâng cấp, và giữ cả khi `helm uninstall` (`helm.sh/resource-policy: keep`), vì một cơ sở dữ liệu giữ lại trên volume của nó vô dụng cho thông tin xác thực của nó nếu thiếu khóa. Nó được gắn như một tệp và truyền qua `HOTLOOP_SECRET_KEY_FILE`, không bao giờ là biến môi trường.

Hãy sao lưu Secret tách khỏi các bản sao lưu cơ sở dữ liệu: một khóa nằm cạnh các bản sao lưu nó bảo vệ thì không bảo vệ gì cả. Để dùng khóa của riêng bạn, `hotloop gen-secret-key` in ra một khóa. Ngoài Kubernetes, hãy ghi nó vào tệp chỉ HotLoop đọc được và trỏ `HOTLOOP_SECRET_KEY_FILE` tới đó. Không có khóa, HotLoop vẫn chạy, nói trong log khởi động rằng mật khẩu thiết bị được lưu như đã gõ, và từ chối lưu một bảng điều khiển UniFi. Thông tin xác thực đã lưu được mã hóa lần đầu nó khởi động với khóa. Xem [Sao lưu và khôi phục](/vi/iot/backup/#thông-tin-xác-thực-thiết-bị-và-khóa-bí-mật) để biết điều đó nghĩa là gì với việc khôi phục.

## Cấu hình, và những gì màn hình Cài đặt có thể thay đổi

Gần như mọi thiết lập đến từ một biến môi trường mà chart đặt từ một giá trị Helm. Đó là chỗ đúng: cấu hình quyết định liệu tiến trình này có thể điều khiển máy móc hay không thuộc về bản triển khai, đã được xem xét, không thuộc về một biểu mẫu trên trang web.

Màn hình **Cài đặt** cho thấy tất cả, mọi thiết lập, giá trị hiệu lực của nó, nó đến từ cơ sở dữ liệu, biến môi trường hay mặc định tích hợp, và biến làm thay đổi nó. Phần lớn chỉ đọc, và đó là chủ ý: câu hỏi nó trả lời là "vì sao nó làm vậy, và tôi đổi cái gì?"

Bốn thiết lập là danh tính của nhà máy chứ không phải hành vi, và được sửa ở đó. Chúng được lưu trong cơ sở dữ liệu và có hiệu lực ngay, vì một nhà máy được đổi tên thường xuyên hơn nhiều so với việc triển khai lại:

| thiết lập | biến mà nó ghi đè |
|---|---|
| Tên nhà máy | `HOTLOOP_PLANT_NAME` |
| ID địa điểm | `HOTLOOP_SITE_ID` |
| Múi giờ | `HOTLOOP_TIMEZONE` |
| Xác nhận trước khi ghi | `HOTLOOP_CONFIRM_WRITES` |

Dưới các thiết lập có những thẻ là dữ liệu chứ không phải cấu hình, và được sửa vì cùng lý do: **Người dùng** ([Xác thực và người dùng](/vi/iot/authentication/)), **Leo thang cảnh báo**, cho biết ai được báo tiếp theo khi không ai xác nhận một cảnh báo và khi nào ([Thông báo cảnh báo](/vi/iot/notifications/#escalation)), cùng các đích của historian và đăng nhập MQTT. Các kênh mà một leo thang có thể dùng vẫn thuộc về bản triển khai, đặt bởi `HOTLOOP_NOTIFY_*`.

Giá trị đã lưu thắng biến môi trường, nên giá trị của chart trở thành điểm xuất phát chứ không phải lời cuối. Một múi giờ mà máy không phân giải được sẽ bị từ chối thay vì được chấp nhận rồi âm thầm bỏ qua, điều sẽ khiến mọi dấu thời gian rơi về UTC mà không có gì nói vì sao.

Điều tương tự áp dụng cho chính giá trị của bản triển khai. Nếu `HOTLOOP_TIMEZONE` (hoặc `TZ`, khi biến kia chưa đặt) nêu một múi giờ không nạp được, HotLoop từ chối khởi động và lỗi nêu tên biến và giá trị. Trước đây nó nhún vai và chạy trên UTC. Báo cáo, lịch trình và giờ ca đều chạy theo đồng hồ của nhà máy, và một phỏng đoán lệch nhiều giờ còn tệ hơn một pod nói vì sao nó không lên.

Vị trí địa điểm là `HOTLOOP_SITE_LATITUDE` và `HOTLOOP_SITE_LONGITUDE` (chart: `plant.latitude`, `plant.longitude`), độ thập phân, bắc và đông là dương. Bình minh, hoàng hôn và các thực thể cùng trigger của mặt trời được tính từ chúng ngay trên thiết bị ([Mặt trời](/vi/iot/sun/)). Cả hai hoặc không cái nào, và một giá trị sai dừng khởi động với tên biến. Màn hình Cài đặt hiển thị chúng chỉ đọc: các quy tắc kích hoạt theo bình minh, nên di chuyển nó là một lần triển khai.

**Các công tắc an toàn không sửa được và sẽ không bao giờ.** `HOTLOOP_ALLOW_WRITES` là điều khiển chủ về việc tiến trình này có thể ra lệnh cho thiết bị hay không; một điều khiển có thể bật lại từ chính phiên trình duyệt đang phát lệnh ghi thì không phải điều khiển. `HOTLOOP_HISTORIAN_RETENTION_DAYS` cũng chỉ thuộc bản triển khai: chính sách lưu giữ được áp dụng vào cơ sở dữ liệu lúc khởi động, nên một ô trên màn hình trông như có tác dụng mà không di chuyển dữ liệu nào. Endpoint từ chối mọi khóa ngoài tập có thể sửa **theo tên**, thay vì bỏ qua nó.

Một hạn chế, nêu ra vì màn hình cũng nêu: máy chủ MCP dựng hướng dẫn của nó lúc khởi động, nên nó quảng bá tên nhà máy lúc nó khởi động cho đến khi pod được khởi động lại. Mọi thứ khác nhận việc đổi tên ở yêu cầu tiếp theo.

## PostgreSQL 17

Cơ sở dữ liệu của HotLoop là PostgreSQL 17 (TimescaleDB 2.30.1 trên đó cho Edge và Gateway, PostgreSQL 17.11 thuần cho IoT và cho `database.type: postgresql`). Các bản phát hành trước chạy PostgreSQL 16, và PostgreSQL không mở thư mục dữ liệu của phiên bản chính khác. Vì vậy việc chuyển được làm thay bạn, khi nâng cấp, và không có gì để chạy.

**Trên chart,** pod cơ sở dữ liệu nhận hai init container. Cái đầu chạy image PostgreSQL 16 và, chỉ khi volume chứa dữ liệu 16, sao chép bản cài đó vào một volume tạm. Cái thứ hai chạy image mới và `pg_upgrade` vào một thư mục mới bên cạnh thư mục cũ. Cả hai để yên một volume mới, hoặc một volume đã ở 17. Nâng cấp là `helm upgrade`, không gì hơn. Hãy chờ pod cơ sở dữ liệu nằm ở `Init` lâu bằng thời gian sao chép dữ liệu, và ứng dụng chờ nó; `kubectl logs <release>-postgresql-0 -c pg-upgrade` là log.

**Trên Quadlet,** `hotloop-db-upgrade.container` chạy trước `hotloop-db.service` và làm điều tương tự trong một unit oneshot. Sao chép `hotloop-db.container`, `hotloop-db-upgrade.container` và `hotloop-db-upgrade.sh` mới từ thư mục sản phẩm của bạn vào thư mục unit và khởi động lại unit cơ sở dữ liệu; [README của Quadlet](/vi/install/quadlet/) có các lệnh. Unit cơ sở dữ liệu đòi unit nâng cấp, nên một máy chỉ nhận unit cơ sở dữ liệu mới không khởi động trên dữ liệu 16 và nói vì sao: nó thất bại, không đoán mò. `journalctl -u hotloop-db-upgrade` là log. Unit chỉ chạy khi volume chứa dữ liệu 16: trên máy mới, và ở mọi lần khởi động sau nâng cấp, systemd bỏ qua nó (nó hiện là không hoạt động, không phải thất bại) và image PostgreSQL 16 không bao giờ được kéo về. Khi volume chứa dữ liệu 16, unit kéo image đó trước.

Nó làm gì, theo thứ tự, tất cả trong `hotloop-pg-upgrade.sh` (một tệp, chính tệp mà chart và các unit chạy):

1. Không có thư mục dữ liệu, hoặc có một thư mục đã ở 17: không làm gì, và nói vậy. Mọi phiên bản chính khác bị từ chối, không đổi gì.
2. Khởi động máy chủ cũ một lần trên một socket riêng và dừng nó sạch sẽ, việc này phát lại log sau khi mất điện và đọc bảng mã và locale mà cụm mới phải khớp.
3. Chạy `initdb` một thư mục mới bên cạnh thư mục cũ với các thiết lập đó, chạy `pg_upgrade` ở chế độ sao chép (thư mục cũ chỉ được đọc) và chuyển `postgresql.conf`, `postgresql.auto.conf`, `pg_hba.conf` và `pg_ident.conf` sang.
4. Khởi động máy chủ mới một lần để chứng minh nó mở được với các thiết lập cuối và thu thập thống kê của bộ lập kế hoạch mà `pg_upgrade` không chuyển.
5. Chỉ khi đó mới hoán đổi tên: thư mục cũ thành `pgdata.pg16`, thư mục mới thành `pgdata`.

Nó cần dung lượng trống cạnh dữ liệu xấp xỉ bằng dữ liệu chiếm, và kiểm tra trước khi bắt đầu. Nếu có gì thất bại trước bước 5, nâng cấp thoát với mã khác không, dữ liệu 16 đúng như trước, và cơ sở dữ liệu không khởi động trên một thư mục dựng dở: trên chart pod nằm ở `Init:Error`, trên Quadlet unit nâng cấp thất bại và unit cơ sở dữ liệu phía sau nó không bao giờ khởi động. Hãy sửa điều log nói và chạy lại; một lần thử dở dang bị xóa và làm lại. Tiện ích mở rộng TimescaleDB được chuyển sang ở phiên bản nó đang dùng, và ứng dụng cập nhật nó lên phiên bản được giao ở lần khởi động tiếp theo, như vẫn luôn thế. Hướng dẫn của chính TimescaleDB cho nâng cấp PostgreSQL tại chỗ là `pg_upgrade` với các tệp nhị phân cũ và mới ([Tiger Data, "Upgrade PostgreSQL"](https://www.tigerdata.com/docs/deploy/self-hosted/upgrades/upgrade-pg)).

Bản sao lưu chính là thư mục cũ. `pg_upgrade` ở chế độ sao chép không bao giờ ghi vào nó, nên `pgdata.pg16` là toàn bộ cơ sở dữ liệu PostgreSQL 16 như lúc đó, là bản sao lưu tốt hơn một bản dump và là thứ duy nhất làm cho đường quay lại bên dưới khả thi. Bản sao lưu riêng của HotLoop ([Sao lưu và khôi phục](/vi/iot/backup/)) do ứng dụng đang chạy thực hiện qua cơ sở dữ liệu đang chạy, nên không thể thực hiện ở bước chạy trước khi cơ sở dữ liệu khởi động. Dù vậy hãy tạo một bản trên bản phát hành cũ trước khi nâng cấp và sao chép nó ra khỏi thiết bị.

### Quay lại

`helm rollback`, hoặc đặt lại `hotloop-db.container` trước đó, đưa cơ sở dữ liệu về image PostgreSQL 16 (cập nhật tự động của Podman thì không: nó chỉ chuyển ứng dụng), và PostgreSQL 16 không mở thư mục 17 (`database files are incompatible with server`, log nói thư mục được khởi tạo bởi phiên bản 16). Không mất gì và không có gì bị đổi dở; cơ sở dữ liệu chỉ không khởi động. Thứ bản phát hành trước cần là thư mục 16 của chính nó, tức `pgdata.pg16`. Hãy dừng cơ sở dữ liệu, rồi đặt lại các tên:

```sh
# chart: after the rollback, stop the database, swap in a one-off pod, start it
kubectl -n hotloop scale statefulset/hotloop-postgresql --replicas=0
kubectl -n hotloop run pgswap --rm -it --restart=Never --image=busybox \
  --overrides='{"spec":{"securityContext":{"runAsUser":999,"fsGroup":999},"containers":[{"name":"pgswap","image":"busybox","command":["sh","-c","cd /d && mv pgdata pgdata.pg17 && mv pgdata.pg16 pgdata"],"volumeMounts":[{"name":"d","mountPath":"/d"}]}],"volumes":[{"name":"d","persistentVolumeClaim":{"claimName":"data-hotloop-postgresql-0"}}]}}'
kubectl -n hotloop scale statefulset/hotloop-postgresql --replicas=1

# Quadlet: the volume is named hotloop-db
sudo systemctl stop hotloop.service hotloop-db.service
d=$(sudo podman volume inspect hotloop-db --format '{{.Mountpoint}}')
sudo mv "$d/pgdata" "$d/pgdata.pg17" && sudo mv "$d/pgdata.pg16" "$d/pgdata"
```

Đó là cơ sở dữ liệu như lúc nâng cấp, và không có gì được ghi từ đó. Việc hoán đổi ngược chỉ dùng được một lần: nâng cấp từ chối chạy khi `pgdata.pg16` còn chắn đường, nên lần thử nâng cấp tiếp theo cần `pgdata.pg17` và xử lý thư mục cũ trước. Tiến lên là con đường, còn hoàn tác là cho một máy không chạy được 17 chút nào. Quy tắc hoàn tác của chính ứng dụng không đổi: lược đồ của thư mục 16 là cái bản phát hành trước nâng cấp để lại, và một bản phát hành gặp migration nó không biết sẽ nói ra, xem [Migration chỉ thêm](/vi/iot/migrations/).

### Khi bạn đã hài lòng

`pgdata.pg16` ở lại cho đến khi bạn xóa nó, vì xóa nó là xóa con đường quay lại duy nhất. Nó lớn bằng cơ sở dữ liệu. Khi máy đã chạy trên 17 lâu như bạn muốn:

```sh
# chart
kubectl -n hotloop exec hotloop-postgresql-0 -c postgresql -- rm -rf /var/lib/postgresql/data/pgdata.pg16
# Quadlet
sudo rm -rf "$(sudo podman volume inspect hotloop-db --format '{{.Mountpoint}}')/pgdata.pg16"
```

### Tắt nó

`database.postgresql.upgrade.enabled: false` bỏ các init container. Một volume còn ở 16 khi đó chặn cơ sở dữ liệu khởi động, và việc chuyển là của bạn. Hãy để bật: khi bật, một bản cài mới vẫn kéo image PostgreSQL 16 một lần mỗi node vì image của init container được kéo trước khi nó chạy, rồi không bao giờ chạy nó.

## Nâng cấp từ 3.x

**Đây là một sự thay thế, không phải nâng cấp.** 3.x là một sản phẩm khác. Không có đường migration cho dữ liệu của nó, vì nó không chia sẻ mô hình dữ liệu nào với một historian tag.

```bash
helm uninstall hotloop -n hotloop
# keep or delete the old PVCs deliberately, they hold the HA recorder database
helm install hotloop ./charts/hotloop -n hotloop
```

Những thứ không còn tồn tại và sẽ bị từ chối nếu đặt: `sidecarProxy`, `homeassistant`, các add-on `mqtt`/`nodered`/`esphome`/`zigbee2mqtt`, `devices`, `cameras`, `customConfig`, `network.hostNetwork`.

## Hoàn tác một bản cập nhật

`helm rollback hotloop -n hotloop` đặt lại image của bản phát hành trước. Nó không đặt lại cơ sở dữ liệu: một bản phát hành migrate lúc khởi động, và việc đó đã xong. Quy tắc và cách kiểm tra nằm ở [Migration chỉ thêm](/vi/iot/migrations/).

Điều duy nhất mà một lần hoàn tác xuyên qua bản phát hành PostgreSQL 17 đặt lại là engine cơ sở dữ liệu: image cơ sở dữ liệu của chart quay về 16, không mở được thư mục đã nâng cấp. [Quay lại](#quay-lại) là lối thoát.

Nó an toàn cho một bản phát hành trở về trước. Cơ sở dữ liệu ghi lại bản phát hành nào đã áp dụng từng migration, và một bản phát hành gặp migration từ hai bản phát hành trở lên mới hơn nó sẽ từ chối khởi động:

```
refusing to start: this database's schema is more than one release ahead of
HotLoop 4.18.10. ...
```

Đó không phải lỗi để lách. Nó nghĩa là cơ sở dữ liệu đã đi xa hơn mức bản phát hành này từng chạy. Hãy tiến lên một bản phát hành biết lược đồ, tức bản mới nhất, hoặc khôi phục một bản sao lưu do bản phát hành bạn đang dùng tạo ra ([Sao lưu và khôi phục](/vi/iot/backup/)). Đúng một bản phát hành về trước thì khởi động, với một cảnh báo trong log nêu tên cả hai phiên bản. Hãy sao lưu trước khi nâng cấp; hoàn tác không thể xóa dữ liệu mà bản phát hành mới hơn đã ghi.

## Kiểm tra một bản cài đặt

```bash
kubectl -n hotloop get pods
kubectl -n hotloop logs deploy/hotloop | head -20
```

Một lần khởi động khỏe mạnh nói các giao thức nó dùng, áp dụng các migration, báo chế độ lịch sử và cảnh báo về mọi thứ đáng biết:

```
msg=starting version=4.0.0 protocols="[ethernet-ip http modbus mqtt mtconnect opcua s7comm]"
msg="writes are ENABLED: the UI, API, automations and MCP can all command devices"
msg="tag_history promoted to a hypertable" timescale=2.30.1
msg="history schema ready" mode=timescale
msg=listening addr=:8080 mcp=/mcp writes=true
```

Sau đó kiểm tra các nhãn mà bảng điều khiển cần. Đây là phép kiểm tra bắt được sự lệch, hãy xác nhận **tập hợp**, không phải số lượng, vì kiểm tra số lượng vẫn qua khi tập hợp sai:

```bash
kubectl -n hotloop get svc <release> -o json \
  | jq -r '.metadata.labels | keys[] | select(startswith("embernet.ai/"))'
```

Chính xác bốn, trên Service và trên pod:

```
embernet.ai/app-name
embernet.ai/gui-port
embernet.ai/gui-type
embernet.ai/store-app
```

Nếu ứng dụng đang chạy nhưng thiếu trong Ứng dụng đang chạy, nhãn của Service là nơi đầu tiên cần xem: bảng điều khiển truy vấn các Service theo `embernet.ai/store-app`.

Một bản triển khai từ App Store thêm năm nhãn nữa, từ `tenantLabels` mà bảng điều khiển truyền: `embernet.ai/tenant`, `app-id`, `source`, `deployed-by` và `deployment-id`. Chúng đi vào mọi tài nguyên chart kết xuất và pod gateway. Bảng điều khiển đọc tenant từ Service và không từ đâu khác, nên một Gateway triển khai từ cửa hàng mà không có `embernet.ai/tenant` trên Service của nó thì không thuộc về ai. Một `helm install` thường không kết xuất cái nào trong năm nhãn đó.

## Probe

- `/healthz`, liveness. Trả lời khi tiến trình còn chạy.
- `/readyz`, readiness. Còn yêu cầu cơ sở dữ liệu, nên một pod đã mất historian thôi nhận lưu lượng thay vì phục vụ một giao diện không trả lời được gì.

Probe khởi động cho phép hai phút, vì lần cài đầu chạy các migration và probe liveness không được giết nó giữa chừng một migration.

## Tắt máy

`terminationGracePeriodSeconds: 45`. Khi nhận SIGTERM, ứng dụng ngừng nhận yêu cầu, rồi xả hàng đợi historian để các số đọc đã lấy được ghi thay vì bị bỏ. Cắt thời gian ân hạn quá ngắn sẽ mất những gì đang bay.

## Xử lý sự cố

**Một thiết bị nằm ở `connecting`.** Xem `lastError` trên thẻ thiết bị. Thường là tường lửa giữa pod và thiết bị, hoặc sai cổng. Chart không hạn chế egress, nên một NetworkPolicy chặn nó là thứ khác trong cụm.

**Tag đọc ra chất lượng xấu.** Thiết bị đã trả lời nhưng điểm thì không. Với Modbus, kiểm tra cơ sở địa chỉ, `oneBased` nếu bản vẽ của bạn dùng đánh số 40001. Với OPC UA, kiểm tra node id đã được phân giải; ưu tiên dạng `nsu=`.

**Giá trị trông hợp lý nhưng sai.** Với Modbus, đó là thứ tự từ, hãy thử `CDAB`. Đây là lỗi không tự báo, vì con số không sai một cách hiển nhiên.

**Không có gì được ghi vào lịch sử.** Kiểm tra chẩn đoán trên màn hình Giao thức. `filtered` đếm các số đọc bị vùng chết chặn, điều đang hoạt động đúng như dự định; `dropped` đếm các số đọc mất vì cơ sở dữ liệu không theo kịp, điều không phải vậy.

**MCP trả về 401.** Bearer token. Đọc nó từ Secret của bản phát hành.

**Mọi yêu cầu `/api/` đều trả về 401.** Đúng như dự kiến khi `auth.enabled` là true và chưa ai đăng nhập, đó là ý nghĩa của 4.4.0. Đọc mật khẩu quản trị viên được tạo từ Secret của bản phát hành (xem [Xác thực](#xác-thực)) và đăng nhập qua giao diện, hoặc gọi trực tiếp `POST /api/auth/login`. Xem [Xác thực và người dùng](/vi/iot/authentication/).

**Mất mật khẩu quản trị viên và không có tài khoản quản trị nào khác.** Tạo một hash mới và vá Secret, rồi khởi động lại pod để nó đọc lại môi trường; `EnsureAdminUser` sẽ không động vào một tài khoản đã tồn tại, nên cách này thay thẳng dòng đó thay vì đi qua chart:

```bash
hotloop hash-password -password 'a-new-one'
kubectl exec -n hotloop deploy/hotloop -- \
  psql "$DATABASE_URL" -c \
  "UPDATE users SET password_hash = '<the hash>' WHERE username = 'admin'"
```

**Một tự động hóa được bật nhưng không chạy.** Nó biên dịch thất bại. Màn hình Tự động hóa hiển thị nó là NOT ARMED kèm lý do, và log hệ thống có lỗi.
