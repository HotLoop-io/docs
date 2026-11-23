---
title: "k3s と Helm"
description: "k3s や任意の Kubernetes に HotLoop のチャートをデプロイします。設定しておきたい値、データベースの選び方、アップグレードとロールバックを説明します。"
---

チャートは 2 つのワークロードをデプロイします。ゲートウェイ(自身では永続的な状態を持たない Deployment)と、TimescaleDB(ボリューム付きの StatefulSet)です。これが既定です。`database.type` で別のデータベースを選べます。素の PostgreSQL、または 2 つ目のワークロードがまったく要らない SQLite です([SQLite](#sqlite)、後述)。

## インストール

EmberNet ダッシュボードの App Store から、または直接インストールします。

```bash
helm install hotloop ./charts/hotloop \
  --namespace hotloop --create-namespace
```

または、App Store が指す URL でもあるチャートリポジトリからインストールします。

```bash
helm repo add hotloop https://hotloop.io/hotloop
helm install hotloop hotloop/hotloop \
  --namespace hotloop --create-namespace
```

この 2 つ目の形式は、`hotloop` として最初に公開された 4.16.0 から使えます。その前の最後のバージョンは旧名の `industrial-iot` 4.3.1 で、そこからのアップグレードは別の手順です。README の 4.16.0 のノートにある "Upgrading from 4.3.1" を参照してください。旧リポジトリのアドレス `https://embernet-ai.github.io/industrial-iot/` は 404 を返します。

素のインストールで動きます。チャートはデータベースのパスワードと MCP トークンをリリースの Secret に生成してアップグレードをまたいで再利用するため、何も用意する必要はなく、アップグレードが稼働中のデータベースの下でパスワードを入れ替えることもありません。

到達するのに ingress もサブドメインも要りません。ダッシュボードはストアのラベルでアプリを見つけ、クラスター内のアドレスでプロキシします。

```
<release>.<namespace>.svc.cluster.local:8080
```

直接見るには次のようにします。

```bash
kubectl -n hotloop port-forward svc/hotloop 8080:8080
```

## 設定しておきたい値

### 認証

4.4.0 以降です。モデルの全体は[認証とユーザー](/ja/iot/authentication/)を参照してください。ここではチャート側を説明します。

```yaml
auth:
  enabled: true    # the default; requires a login
  insecure: false  # set true only for a deployment truly isolated behind the
                    # dashboard's own NetworkPolicy -- see AUTH.md
```

`enabled: true`(既定)のとき、チャートは初回インストールでデータベースのパスワードや MCP トークンと同じ方法で管理者アカウントをリリースの Secret に生成し、アップグレードをまたいで再利用します。

```bash
kubectl get secret hotloop -n hotloop \
  -o jsonpath='{.data.admin-password}' | base64 -d
```

`auth.admin.password` を明示的に設定すると、生成されたものより優先されます。

### 安全

このポッドが機械を動かせるかどうかを決める値です。

```yaml
safety:
  allowWrites: false      # the master switch -- off by default since 4.4.0
  allowMcpWrites: true    # agents (MCP) write wherever an operator could, once writes are on
  confirmWrites: true     # the UI asks before writing
```

書き込みは既定でオフです。タグは、そのタグ自身の `writable` フラグが設定されるまで読み取り専用で、タグに設定された範囲外の値は拒否され(丸めることはしません。誰かが 500 と入力したのに 250 を送るのは、黙って別のことをしているのです)、すべての試行は、**すべての拒否を含めて**、実行者と送信元とともに記録されます。それでも、新規インストールが安全であるために 3 つがすべてそろう必要があってはならないので、マスタースイッチ自体が閉じた状態で始まります。

デプロイを確認したうえで書き込みをオンにするには次のようにします。

```yaml
safety:
  allowWrites: true
```

これだけで済みます。MCP クライアントはオペレーターと同じように、同じ権限、書き込み可能なタグ、範囲のもとで読み書きします。`allowMcpWrites` はすべてのチャートでオンで出荷されます。別の判断をするデプロイのためにあるもので、どこでも既定ではありません。

### ヒストリアン

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

容量はタグ数、スキャン速度、デッドバンドで決まります。デッドバンドなしで 1 秒ごとの 1,000 タグは 1 日約 8,600 万行になり、同じ工場でも妥当なデッドバンドを設ければ通常は桁が 1 つ小さくなります。ストレージを買う前にデッドバンドを設定してください。

`useTimescale: false` はネイティブのパーティショニングの経路を強制します。素の PostgreSQL で動かしたときの姿です。エッジのデプロイを再現するのに便利です。

**TimescaleDB のイメージが変わるとき。** イメージにはすべての旧バージョンのライブラリが入っているので、古いイメージで作られたデータベースは新しいイメージでも動き続けますが、拡張機能は古いバージョンのままで、誰かが `ALTER EXTENSION timescaledb UPDATE` を実行するまでそこに留まります。ゲートウェイは起動時にそれを行います。インストール済みのバージョンとサーバーが同梱するバージョンを比べ、違っていれば、新しい接続の最初の文としてアップデートを実行します(TimescaleDB は、古いバージョンをすでに読み込んだセッションではこれを拒否します)。ログには `timescaledb extension updated from=... to=...` と出ます。これにはスーパーユーザーが必要で、同梱データベースのユーザーがそうです。そうでない外部またはマネージドのデータベースでは、実行すべきコマンド付きの警告が出て、その間も履歴は古いバージョンで動き続けます。`useTimescale` がオンで、起動時にマイグレーションが実行されるとき(`HOTLOOP_DB_MIGRATE`、既定でオン)にだけ起こります。

### ポーリング

```yaml
runtime:
  defaultPollIntervalMs: 1000
  minPollIntervalMs: 100      # a floor applied to every device
  timeoutMs: 10000
  maxConcurrentPolls: 32
```

`minPollIntervalMs` は信頼されるのではなく、強制されます。シリアルゲートウェイへの 10 ms のポーリングは、手順が少し増えただけのサービス拒否です。

### OPC UA クライアント

```yaml
opcuaClient:
  persistence:
    enabled: true      # off by default
    size: 64Mi
```

セキュリティ設定された OPC UA サーバーに接続するデバイス、またはサーバーが暗号化を求めるユーザー名とパスワードでログインするデバイスは、証明書と、承認済みサーバー証明書の信頼ストアを保持します(`HOTLOOP_OPCUA_CLIENT_PKI_DIR`、`/data/opcua-client-pki`)。そのようなデバイスを追加する前にこれをオンにしてください。ルートファイルシステムは読み取り専用なので、ボリュームがないと、デバイスは次の再起動で失われる証明書で接続する代わりに、そのことを伝えるエラーを報告します。既存のインストールに PersistentVolumeClaim を追加し、既定の StorageClass がないクラスターでは Pending のままになるため、既定ではオフです。セキュリティのないチャネルの匿名デバイスはこれを使いません。サーバー証明書の承認と、これらのデバイスに関するそれ以外のすべては[プロトコルとドライバー](/ja/iot/protocols/#opc-ua-セキュリティと認証情報)にあります。

### ネットワーク

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

ダッシュボードの名前空間が分かったら、ingress をそこに絞ってください。egress は意図的に無制限です。このアプリは、事前に列挙できないアドレスにある機器に届くために存在し、ポーリングを黙って塞ぐ egress ポリシーは、ファイアウォールのルールではなく壊れたドライバーのように見えます。

### ハードウェア: USB 無線機、シリアルアダプター、Bluetooth

4.19.7 から、すべての HotLoop チャート(Gateway、IoT、Edge、Edge Relay)は、ハードウェアが必要とするアクセスをオンにして出荷されるため、App Store や helm からの素のインストールで、手作業の編集なしに、ポッドネットワーク上でノードにつながっているものが見えます。`values.yaml` の `hardware:` ブロックで、既定でオンの 3 つのスイッチと、既定でオフの 1 つのオプトインがあります。

| 値 | 既定 | 内容 |
|---|---|---|
| `hardware.privileged` | `true` | アプリのコンテナーは特権(`privileged: true`、`allowPrivilegeEscalation: true`)かつ root(`runAsUser: 0`、`runAsNonRoot: false`、capability の削除なし)で動きます。USB シリアルのノードは `root:dialout 0660` で、BlueZ の D-Bus ポリシーは root と `bluetooth` グループを通すため root です。どちらでもないコンテナーユーザーは何も開けません。ルートファイルシステムは読み取り専用のままで、init コンテナーと同梱データベースは、root でなく、すべての capability を削除した独自のコンテキストを保ちます。 |
| `hardware.usbDevices.enabled` | `true` | ノードの `/dev`(`hardware.usbDevices.hostPath`)が `/dev` にマウントされます。ポッドの起動後に挿したものも含め、USB シリアルアダプター(`/dev/ttyUSB*`、`/dev/ttyACM*`、`/dev/serial/by-id/*`)が見えます。特権コンテナーには起動時に存在したデバイスだけが渡されるので、挿し直したスティックを現れさせるのがこのマウントです。 |
| `hardware.bluetooth.enabled` | `true` | ノードの D-Bus ディレクトリ(`hardware.bluetooth.dbusPath`、`system_bus_socket` を含む `/run/dbus`)が同じパスにマウントされ、クライアントがノードの BlueZ に届きます。D-Bus のないノードでは空で作られるため、そこでもポッドは起動します。 |
| `hardware.bluetooth.hostNetwork` | `false` | ノードのネットワークが必要なものに向けた、既定でオフのオプトインです。カーネルの Bluetooth ソケット(HCI、L2CAP)はノードのネットワーク名前空間にしかないので、それを直接開くクライアントや、ノード自身のネットワークで待ち受ける検出(mDNS、SSDP、無線機のマルチキャスト)に必要です。BlueZ の D-Bus API を通るクライアントは、マウントされたソケットだけで足り、ポッドネットワークから動きます。オンにすると、ポッドは[ネットワーク](#ネットワーク)に書かれた結果とともにノードのネットワークで動きます。 |

現時点で HotLoop がこれで行うことは、まだ何もありません。HotLoop には Bluetooth、Z-Wave、USB シリアル用の独自のコードがありません(Zigbee は MQTT 上の Zigbee2MQTT ブリッジ経由で入ります。[組み込みの MQTT ブローカー](/ja/iot/broker/)を参照)。これは、機能や無線機を読むサイドカーが必要とするアクセスを、求められる前に用意しておくものです。

その代償は、意図したもので、決定済みです。ポッドはノード上で root(特権、ノードの `/dev` 付き)で、チャートの NetworkPolicy の既定は、それが対象とする範囲についてオンのままです。ポッドはポッドネットワークに留まります。`--set hardware.privileged=false --set hardware.usbDevices.enabled=false --set hardware.bluetooth.enabled=false` でどの部分もオフにでき、3 つともオフにすると、出力は 1 行ずつ 4.19.6 が出力したポッド(root でなく、すべての capability を削除、読み取り専用ルート、ポッドネットワーク)と同じです。ノードのネットワークが必要なものには、`hardware.bluetooth.hostNetwork=true`(または `hostNetwork=true`)を設定してください。すると、ページはノードのすべてのアドレスの `service.targetPort` で応答し、HotLoop はノードごと、ポートごとに 1 つになり、NetworkPolicy はポッドに適用されず、`nodeSelector` が、その無線機を見るべきノードにポッドを固定します。

### エッジのデプロイ

アプリのイメージは amd64 と arm64 向けにビルドされ、TimescaleDB 2.30.1-pg17 はマルチアーキテクチャなので、エッジへのインストールを妨げるのはヒストリアンではありません。

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

### Sparkplug で上位に公開する

エッジのゲートウェイは、読み取ったすべてを Sparkplug B のエッジノードとして中央のゲートウェイに公開することもできます。公開する内容と転送キューの動作は[エッジ公開とストアアンドフォワード](/ja/edge/edge-publish/)を参照してください。ここではチャート側を説明します。

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

オンにすると何が変わるか、そしてその理由です。

- **転送キュー用の 1Gi の PVC**が `/data/edge-publish` にマウントされます。アップリンクが落ちている間に読み取り値が溜まる場所なので、ポッドより長く残る必要があります。`persistence.enabled: false` はこれを emptyDir に置き、コンテナーの再起動には耐えますが、それ以外には耐えません。
- **Deployment は `Recreate` でロールします。** キューはロックのかかった 1 つのファイルです。ローリングアップデートは新しいポッドを先に起動し、新しいポッドはキューを開けず、準備完了にならず、ロールアウトは永遠に止まります。Recreate は古いほうを先に止めます。アップグレードごとに数秒のポーリングを失います。
- **`replicaCount` は 1 でなければならず**、そうでなければチャートはレンダリングを拒否します。レプリカが 2 つあると、1 つの Sparkplug ノードを名乗るパブリッシャーが 2 つになります。
- **ノード id の既定はリリース名**で、ポッドのホスト名ではありません。ホスト名はロールアウトのたびに変わり、Sparkplug ホストは毎回まったく新しいエッジノードを見ることになります。

パスワードが平文の既定値に入ることはありません。匿名のブローカーなら `password` と `existingSecret` を空にしておけば Secret は作られません。`password` を設定するとチャートは `<release>-edge-publish` に入れ、`existingSecret` を設定すると自分で管理しているものを使います。

### 外部データベース

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

アプリは TimescaleDB を検出し、拡張機能があれば `tag_history` をハイパーテーブルに昇格させます。素の PostgreSQL では、失敗する代わりにネイティブの範囲パーティショニングに切り替えます。

この判断は記録され、**固定**されます。ハイパーテーブルとして作られたデータベースは、拡張機能のないサーバーに対しては、黙って別の場所に書く代わりに起動を拒否します。このエラーが出たなら、アプリが作られたときとは別のデータベースを指しています。

### SQLite

データベースはイメージではなく設定です。すべての製品は、同じバイナリで SQLite、Postgres、TimescaleDB のいずれでも動きます(IoT は TimescaleDB を使いません。後述)。

| 変数 | 既定 | 内容 |
|---|---|---|
| `HOTLOOP_DB_TYPE` | `postgres` | `postgres` または `sqlite`。TimescaleDB は、サーバーに拡張機能がある `postgres` です |
| `HOTLOOP_DB_PATH` | `/data/hotloop.db` | SQLite のファイルです。SQLite だけが読みます |

SQLite は純粋な Go 版(`modernc.org/sqlite`)で、すべてのイメージにコンパイルされているため、2 つ目のコンテナーも、SD カード上の 300 MB の Postgres イメージも要らず、arm のビルドは静的なままです。ファイルはコンテナーより長く残るボリュームに置き、Pi ではそのボリュームを USB SSD に置いてください。ヒストリアンが一日中 SD カードに書き込むのは、SD カードをたくさん買うための方法です。

同じもの: すべてのテーブル、すべての列、すべての機能。違うもの:

- 履歴はパーティションやハイパーテーブルではなく、インデックス付きの 1 つのテーブルで、保持は月単位で捨てる代わりに古い行を削除します。1 秒間隔で何年分もの履歴を持つ現場には Postgres か TimescaleDB が向いており、そこへ移るのはバックアップと復元です(BACKUP.md)。
- 書き込み手は一度に 1 つです。SQLite は書き込みを順番に行い、その横で読み取ります(WAL)。1 つの HotLoop と、同じファイルを使う隣の `--mcp-stdio` ヘルパーには十分です。ネットワークストレージ上の 2 つのレプリカ向けではありません。NFS 上の SQLite は壊れるので、SQLite のデプロイはローカルボリュームを持つ 1 つのポッドです。
- コミットは `synchronous=FULL` です。API が保存したと言うなら、停電があってもなくてもディスク上にあります。

**HotLoop IoT** は既定で 30 日分の履歴を持ち(`HOTLOOP_HISTORIAN_RETENTION_DAYS` が設定されていればそれが優先されます)、ハイパーテーブルを作りません。TimescaleDB は Edge と Gateway の一部です。IoT で `HOTLOOP_HISTORIAN_TIMESCALE=true` を設定すると、起動時にそう伝え、通常のパーティションで動きます。Edge や Gateway から移されて、すでにハイパーテーブルを持つデータベースは、それを保持して動き続けます。

#### チャートでデータベースを選ぶ

値は `database.type` の 1 つで、各製品は自分が動作する値を受け付けます。

| `database.type` | デプロイされるもの | IoT | Edge | Gateway |
|---|---|---|---|---|
| `timescaledb` | アプリと TimescaleDB(StatefulSet とそのボリューム)。履歴はハイパーテーブル | 拒否 | 既定 | 既定 |
| `postgresql` | アプリと素の PostgreSQL 17(StatefulSet とそのボリューム)。履歴はネイティブのパーティション | 既定 | はい | はい |
| `sqlite` | アプリのみ。データベースファイルは専用のボリューム上 | はい | はい | はい |

```bash
helm install hotloop hotloop/hotloop-iot --namespace hotloop --create-namespace   --set database.type=sqlite
```

IoT に `timescaledb` を求めるとインストールが失敗し、IoT が何で動くかを伝えます(`database.type is "timescaledb", and HotLoop IoT runs on sqlite, postgresql`)。App Store のフォームもこれを提示しません。`helm lint` はこれを捕まえない(helm 3.22 は問題なしと判定する)ので、拒否するのはレンダリングです。`database.type` を省略すると製品自身の既定になるため、キーが存在する前のバージョンから `--reuse-values` でアップグレードすると、それまでのデータベースが維持されます。

`sqlite` は次をレンダリングします。

- `HOTLOOP_DB_TYPE=sqlite` と `HOTLOOP_DB_PATH=/data/db/hotloop.db`、そして Postgres の接続設定は一切ありません。データベースのポッドも、Secret 内のデータベースパスワードも、それを待つ init コンテナーもありません。
- `<release>-db` という名前の PersistentVolumeClaim(`database.sqlite.persistence`: `size`、`storageClass`、`accessMode`、最初は 10Gi とクラスターの既定)が `/data/db` にマウントされます。ファイルではなくディレクトリです。SQLite はデータベースの横に `-wal` と `-shm` を持ちます。ローカルストレージに置いてください。NFS 上の SQLite は壊れます。
- ボリュームが `ReadWriteOnce` でファイルの書き込み手が 1 つなので、ローリングアップデートではなく `Recreate` の Deployment。`replicaCount` が 1 を超えるとインストールは失敗します。

NetworkPolicy は変わらず、オンのままです。アプリ自身のポリシーは引き続き適用され、データベースのポリシーは、守るべきデータベースのポッドがあるときだけレンダリングされます。

すでにデータがあるリリースで `database.type` を変えても、データは移りません。新しいデータベースは空で始まるので、工場をデータベース間で移すのは、変数の場合と同じくバックアップと復元です(BACKUP.md)。特に、TimescaleDB のハイパーテーブルとして作られたデータベースは素の PostgreSQL に対して起動を拒否するので、既存の Edge や Gateway を `timescaledb` から `postgresql` に切り替えて、立ち上がることを期待しないでください。

#### Quadlet でデータベースを選ぶ

`deploy/quadlet/` 配下の各製品のディレクトリには、従来どおりの PostgreSQL または TimescaleDB のファイルと、その横の `sqlite/` ディレクトリがあります。`hotloop.container` と `hotloop-data.volume` で、アプリのみ、ファイルは `hotloop-data` ボリュームの `/data/hotloop.db` です。`:stable` に従い、問題のある更新を同じ方法でロールバックします。他のファイルの代わりにこの 2 つをインストールし(同じユニット名を使います)、シークレットは 3 つではなく 2 つ作ってください。データベースのパスワードはありません。手順は [`deploy/quadlet/README.md`](/ja/install/quadlet/) にあります。

Quadlet で Edge や Gateway に素の Postgres パーティションを使うには、TimescaleDB のユニットを保ち、`hotloop.container` に `Environment=HOTLOOP_HISTORIAN_TIMESCALE=false` を追加します。IoT のユニットはすでに素の PostgreSQL で動いています。

### デバイス認証情報のキー

```yaml
secretKey:
  enabled: true
  existingSecret: ""     # or a Secret you manage, with the key under secret.key
```

デバイスのパスワード(UniFi コンソールのログイン、OPC UA や MQTT のパスワード、HTTP API キー)は、このキーでデータベース内で暗号化されるため、ダンプやバックアップには暗号文が入ります。標準では、チャートが初回インストールで `<release>-secret-key` にキーを生成し、アップグレードをまたいで保持し、`helm uninstall` でも保持します(`helm.sh/resource-policy: keep`)。ボリュームに残ったデータベースは、キーがなければ認証情報の役に立たないからです。ファイルとしてマウントされ、`HOTLOOP_SECRET_KEY_FILE` として渡され、環境変数にはなりません。

Secret はデータベースのバックアップとは別にバックアップしてください。守っているバックアップの隣にあるキーは、何も守りません。自分のキーを使うには、`hotloop gen-secret-key` が 1 つ出力します。Kubernetes の外では、HotLoop だけが読めるファイルに書き込み、`HOTLOOP_SECRET_KEY_FILE` をそれに向けてください。キーがなくても HotLoop は動き、起動ログにデバイスのパスワードが入力どおりに保存されると表示し、UniFi コンソールの保存を拒否します。すでに保存されている認証情報は、キーを付けて最初に起動したときに暗号化されます。復元にとってそれが何を意味するかは、[バックアップと復元](/ja/iot/backup/#デバイスの認証情報と秘密鍵)を参照してください。

## 構成と、設定画面で変更できるもの

ほぼすべての設定は、チャートが Helm の値から設定する環境変数に由来します。それが正しい場所です。このプロセスが機械に指令を出せるかを決める構成は、Web ページのフォームではなく、レビューを経たデプロイに属します。

**設定**画面はそのすべてを表示します。すべての設定、その有効な値、それがデータベース、環境変数、組み込みの既定のどれに由来するか、そしてそれを変える変数です。大半は読み取り専用で、それが要点です。この画面が答える問いは「なぜそう動いているのか、何を変えればよいのか」です。

4 つの設定は、動作ではなく工場の識別情報で、そこで編集できます。データベースに保存されてすぐに有効になります。工場の名前は、再デプロイされるよりもはるかに頻繁に変わるからです。

| 設定 | 上書きする変数 |
|---|---|
| 工場名 | `HOTLOOP_PLANT_NAME` |
| サイト ID | `HOTLOOP_SITE_ID` |
| タイムゾーン | `HOTLOOP_TIMEZONE` |
| 書き込み前に確認 | `HOTLOOP_CONFIRM_WRITES` |

設定の下には、構成ではなくデータであるカードがあり、同じ理由で編集できます。**ユーザー**([認証とユーザー](/ja/iot/authentication/))、誰もアラームを確認しないときに、次に誰へいつ通知するかを決める**アラームのエスカレーション**([アラーム通知](/ja/iot/notifications/#エスカレーション))、そしてヒストリアンの送信先と MQTT ログインです。エスカレーションが使えるチャネルは引き続きデプロイのもので、`HOTLOOP_NOTIFY_*` で設定します。

保存された値は環境変数より優先されるので、チャートの値は最終決定ではなく出発点になります。マシンが解決できないタイムゾーンは、受け入れられて黙って無視される代わりに拒否されます。そうでなければ、すべてのタイムスタンプが理由も示されないまま UTC に戻ってしまいます。

デプロイ自身の値にも同じことが言えます。`HOTLOOP_TIMEZONE`(それが未設定のときは `TZ`)が読み込めないゾーンを指していると、HotLoop は起動を拒否し、エラーには変数と値が示されます。以前は肩をすくめて UTC で動いていました。レポート、スケジュール、シフト時刻はすべて工場の時計で動くので、何時間もずれた推測は、起動しない理由を伝えるポッドより悪いのです。

サイトの位置は `HOTLOOP_SITE_LATITUDE` と `HOTLOOP_SITE_LONGITUDE`(チャート: `plant.latitude`、`plant.longitude`)で、10 進の度、北と東が正です。日の出、日の入り、太陽のエンティティとトリガーは、これらから機器上で計算されます([太陽](/ja/iot/sun/))。両方設定するか、どちらも設定しないかで、誤った値は変数名を示して起動を止めます。設定画面は読み取り専用で表示します。ルールは日の出で発火するので、それを動かすのはデプロイです。

**安全スイッチは編集できず、今後もできません。** `HOTLOOP_ALLOW_WRITES` は、このプロセスが機器に指令を出せるかを決めるマスターの制御です。書き込みを出す同じブラウザーセッションから再びオンにできる制御は、制御ではありません。`HOTLOOP_HISTORIAN_RETENTION_DAYS` も同様にデプロイ専用です。保持ポリシーは起動時にデータベースへ適用されるので、画面のフィールドは動くように見えてもデータは何も動かしません。エンドポイントは、編集可能な集合の外のキーを無視する代わりに、**名前で**拒否します。

1 つ制限があり、画面もそれを示すので書いておきます。MCP サーバーは起動時に指示を組み立てるため、ポッドが再起動されるまで、起動時の工場名を通知し続けます。それ以外はすべて、名前の変更を次のリクエストで反映します。

## PostgreSQL 17

HotLoop のデータベースは PostgreSQL 17 です(Edge と Gateway はその上の TimescaleDB 2.30.1、IoT と `database.type: postgresql` は素の PostgreSQL 17.11)。それ以前のリリースは PostgreSQL 16 で動いており、PostgreSQL は別のメジャーバージョンのデータディレクトリを開きません。そのため移行はアップグレード時に代わりに行われ、実行するものはありません。

**チャートでは**、データベースのポッドに 2 つの init コンテナーが付きます。1 つ目は PostgreSQL 16 のイメージを実行し、ボリュームに 16 のデータがあるときだけ、その環境を一時ボリュームにコピーします。2 つ目は新しいイメージを実行し、古いディレクトリの隣の新しいディレクトリへ `pg_upgrade` します。どちらも、新しいボリュームや、すでに 17 のボリュームには手を触れません。アップグレードは `helm upgrade` だけです。データのコピーにかかる時間だけデータベースのポッドが `Init` に留まり、アプリがそれを待つことを想定してください。`kubectl logs <release>-postgresql-0 -c pg-upgrade` がそのログです。

**Quadlet では**、`hotloop-db-upgrade.container` が `hotloop-db.service` の前に実行され、oneshot ユニットで同じことをします。製品のディレクトリにある新しい `hotloop-db.container`、`hotloop-db-upgrade.container`、`hotloop-db-upgrade.sh` をユニットのディレクトリにコピーし、データベースのユニットを再起動してください。コマンドは [Quadlet の README](/ja/install/quadlet/) にあります。データベースのユニットはアップグレードのユニットを必要とするので、新しいデータベースのユニットだけを受け取った機器は 16 のデータの上では起動せず、理由を伝えます。推測せずに失敗します。`journalctl -u hotloop-db-upgrade` がそのログです。このユニットは、ボリュームに 16 のデータがあるときだけ実行されます。新しい機器や、アップグレード後のすべての起動では、systemd がこれを飛ばし(失敗ではなく非アクティブと表示されます)、PostgreSQL 16 のイメージは取得されません。ボリュームに 16 のデータがあるときは、ユニットが先にそのイメージを取得します。

行うことを順に挙げます。すべて `hotloop-pg-upgrade.sh`(チャートとユニットが実行するのと同じ 1 つのファイル)の中にあります。

1. データディレクトリがない、またはすでに 17 なら、何もせず、そう伝えます。それ以外のメジャーバージョンは、何も変更せずに拒否されます。
2. 古いサーバーを専用のソケットで一度起動してきれいに停止します。これにより停電後のログが再生され、新しいクラスターが合わせるべきエンコーディングとロケールが読み取られます。
3. その設定で古いディレクトリの隣の新しいディレクトリを `initdb` し、コピーモード(古いディレクトリは読み取りのみ)で `pg_upgrade` を実行し、`postgresql.conf`、`postgresql.auto.conf`、`pg_hba.conf`、`pg_ident.conf` を引き継ぎます。
4. 新しいサーバーを一度起動して、最終的な設定で開くことを確かめ、`pg_upgrade` が引き継がないプランナー統計を集めます。
5. そのあとで初めて名前を入れ替えます。古いディレクトリが `pgdata.pg16`、新しいものが `pgdata` になります。

データの隣に、データが占める分とほぼ同じ空き容量が必要で、開始前に確認します。手順 5 の前に何かが失敗すると、アップグレードは 0 以外で終了し、16 のデータはそのままで、データベースは作りかけのディレクトリでは起動しません。チャートではポッドが `Init:Error` に留まり、Quadlet ではアップグレードのユニットが失敗して、その後ろのデータベースのユニットは起動しません。ログの指摘を直して再開してください。未完了の試行は削除されてやり直されます。TimescaleDB の拡張機能は元のバージョンのまま引き継がれ、アプリが次の起動時に、いつもどおり同梱版へ更新します。PostgreSQL をその場でアップグレードするための TimescaleDB 自身の案内は、旧と新のバイナリを使った `pg_upgrade` です([Tiger Data、"Upgrade PostgreSQL"](https://www.tigerdata.com/docs/deploy/self-hosted/upgrades/upgrade-pg))。

バックアップは古いディレクトリそのものです。コピーモードの `pg_upgrade` はそこに書き込まないので、`pgdata.pg16` はそのときのままの PostgreSQL 16 のデータベース全体で、ダンプよりよいバックアップであり、以下の戻る道を可能にする唯一のものです。HotLoop 自身のバックアップ([バックアップと復元](/ja/iot/backup/))は、稼働中のアプリが稼働中のデータベースを通して取るので、データベースが起動する前に走る手順では取れません。それでもアップグレード前に旧リリースで 1 つ取り、機器の外にコピーしてください。

### 元に戻す

`helm rollback`、または以前の `hotloop-db.container` を戻すと、データベースは PostgreSQL 16 のイメージに戻ります(Podman の自動更新はそうしません。動かすのはアプリだけです)。そして PostgreSQL 16 は 17 のディレクトリを開けません(`database files are incompatible with server`、ログにはディレクトリがバージョン 16 で初期化されたと出ます)。失われるものも、中途半端に変わるものもありません。データベースが起動しないだけです。以前のリリースが必要とするのは、自身の 16 のディレクトリ、つまり `pgdata.pg16` です。データベースを止めてから、名前を戻します。

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

これはアップグレード時点のデータベースで、それ以降に書かれたものはありません。入れ替えを戻せるのは一度だけです。アップグレードは `pgdata.pg16` が邪魔をしている間は実行を拒否するので、次のアップグレードの試行にはまず `pgdata.pg17` と古いディレクトリの処理が必要です。進むのが道で、ロールバックは 17 をそもそも動かせない機器のためのものです。アプリ自身のロールバックの規則は変わりません。16 のディレクトリのスキーマは、アップグレード前のリリースが残したもので、知らないマイグレーションを見つけたリリースはそう伝えます。[マイグレーションは追加のみ](/ja/iot/migrations/)を参照してください。

### 納得したら

`pgdata.pg16` は削除するまで残ります。削除は、戻るための唯一の道を削除することだからです。大きさはデータベースと同じです。機器を好きなだけ 17 で動かしたら:

```sh
# chart
kubectl -n hotloop exec hotloop-postgresql-0 -c postgresql -- rm -rf /var/lib/postgresql/data/pgdata.pg16
# Quadlet
sudo rm -rf "$(sudo podman volume inspect hotloop-db --format '{{.Mountpoint}}')/pgdata.pg16"
```

### オフにする

`database.postgresql.upgrade.enabled: false` は init コンテナーを取り除きます。すると、まだ 16 のボリュームがデータベースの起動を妨げ、移行は自分で行うことになります。オンのままにしてください。オンなら、init コンテナーのイメージは実行前に取得されるので、新規インストールでもノードごとに 1 回 PostgreSQL 16 のイメージを取得しますが、それを実行することはありません。

## 3.x からのアップグレード

**これはアップグレードではなく置き換えです。** 3.x は別の製品でした。タグヒストリアンとデータモデルを共有しないので、そのデータの移行経路はありません。

```bash
helm uninstall hotloop -n hotloop
# keep or delete the old PVCs deliberately, they hold the HA recorder database
helm install hotloop ./charts/hotloop -n hotloop
```

もう存在せず、設定すると拒否されるもの: `sidecarProxy`、`homeassistant`、`mqtt`/`nodered`/`esphome`/`zigbee2mqtt` のアドオン、`devices`、`cameras`、`customConfig`、`network.hostNetwork`。

## アップデートのロールバック

`helm rollback hotloop -n hotloop` は、以前のリリースのイメージを戻します。データベースは戻しません。リリースは起動時にマイグレーションし、それは済んだままです。規則と確認は[マイグレーションは追加のみ](/ja/iot/migrations/)にあります。

PostgreSQL 17 のリリースをまたぐロールバックが戻す唯一のものは、データベースエンジンです。チャートのデータベースのイメージが 16 に戻り、アップグレード済みのディレクトリを開けません。[元に戻す](#元に戻す)が出口です。

1 つ前のリリースまでは安全です。データベースは各マイグレーションをどのリリースが適用したかを記録し、自分より 2 つ以上新しいリリースのマイグレーションを見つけたリリースは起動を拒否します。

```
refusing to start: this database's schema is more than one release ahead of
HotLoop 4.18.10. ...
```

これは回避すべき不具合ではありません。データベースが、このリリースがこれまで動いたことのある範囲より先に進んでいるという意味です。スキーマを知っているリリース、つまり最新のものへ進むか、今のリリースが取ったバックアップを復元してください([バックアップと復元](/ja/iot/backup/))。ちょうど 1 つ前のリリースは、両方のバージョンを示す警告がログに出たうえで起動します。アップグレード前にバックアップを取ってください。ロールバックは、新しいリリースが書いたデータを取り消せません。

## インストールの確認

```bash
kubectl -n hotloop get pods
kubectl -n hotloop logs deploy/hotloop | head -20
```

正常な起動は、話すプロトコルを示し、マイグレーションを適用し、履歴モードを報告し、知っておく価値のあることを警告します。

```
msg=starting version=4.0.0 protocols="[ethernet-ip http modbus mqtt mtconnect opcua s7comm]"
msg="writes are ENABLED: the UI, API, automations and MCP can all command devices"
msg="tag_history promoted to a hypertable" timescale=2.30.1
msg="history schema ready" mode=timescale
msg=listening addr=:8080 mcp=/mcp writes=true
```

次に、ダッシュボードが必要とするラベルを確認します。これがずれを捕まえる確認です。数ではなく**集合**を検証してください。集合が間違っていても、数の確認は通るからです。

```bash
kubectl -n hotloop get svc <release> -o json \
  | jq -r '.metadata.labels | keys[] | select(startswith("embernet.ai/"))'
```

Service とポッドに、ちょうど 4 つです。

```
embernet.ai/app-name
embernet.ai/gui-port
embernet.ai/gui-type
embernet.ai/store-app
```

アプリが動いているのに「実行中のアプリ」に出ない場合は、Service のラベルが最初に見る場所です。ダッシュボードは `embernet.ai/store-app` で Service を問い合わせます。

App Store からのデプロイは、ダッシュボードが渡す `tenantLabels` からさらに 5 つを追加します。`embernet.ai/tenant`、`app-id`、`source`、`deployed-by`、`deployment-id` です。これらはチャートがレンダリングするすべてのリソースとゲートウェイのポッドに付きます。ダッシュボードはテナントを Service からだけ読むので、Service に `embernet.ai/tenant` がないストアからデプロイされた Gateway は誰のものでもありません。素の `helm install` は、この 5 つを 1 つもレンダリングしません。

## プローブ

- `/healthz`、liveness。プロセスが動いている間は応答します。
- `/readyz`、readiness。さらにデータベースを必要とするので、ヒストリアンを失ったポッドは、何にも答えられない UI を提供する代わりに、トラフィックの受け付けをやめます。

スタートアッププローブは 2 分を許容します。初回インストールはマイグレーションを実行し、liveness プローブがその途中で終了させてはならないからです。

## シャットダウン

`terminationGracePeriodSeconds: 45`。SIGTERM を受けると、アプリはリクエストの受け付けをやめ、ヒストリアンのキューを空にして、すでに取得した読み取り値が捨てられず書き込まれるようにします。猶予期間を短くしすぎると、処理中だったものが失われます。

## トラブルシューティング

**デバイスが `connecting` のままです。** デバイスカードの `lastError` を見てください。多くはポッドと機器の間のファイアウォールか、誤ったポートです。チャートは egress を制限しないので、それを塞いでいる NetworkPolicy はクラスター上の別のものです。

**タグの品質が不良と読まれます。** デバイスは応答したが、そのポイントは応答していません。Modbus では、アドレスの基準を確認してください。図面が 40001 の番号付けを使うなら `oneBased` です。OPC UA では、ノード id が解決されたかを確認し、`nsu=` 形式を優先してください。

**値がもっともらしく見えるのに間違っています。** Modbus では、ワードの順序です。`CDAB` を試してください。数字が明らかにおかしいわけではないので、自分から知らせない故障です。

**何も履歴に記録されません。** プロトコル画面の診断を確認してください。`filtered` はデッドバンドで抑えられた読み取り値を数え、意図どおりの動作です。`dropped` はデータベースが追いつけず失われた読み取り値を数え、そうではありません。

**MCP が 401 を返します。** ベアラートークンです。リリースの Secret から読み取ってください。

**すべての `/api/` リクエストが 401 を返します。** `auth.enabled` が true で、まだ誰もログインしていなければ想定どおりで、4.4.0 の要点です。生成された管理者パスワードをリリースの Secret から読み取り([認証](#認証)を参照)、UI からログインするか、`POST /api/auth/login` を直接呼んでください。[認証とユーザー](/ja/iot/authentication/)を参照してください。

**管理者パスワードを失い、ほかに管理者アカウントがありません。** 新しいハッシュを生成して Secret にパッチし、ポッドを再起動して環境を読み直させてください。`EnsureAdminUser` はすでにあるアカウントには触れないので、これはチャートを通さず行を直接置き換えます。

```bash
hotloop hash-password -password 'a-new-one'
kubectl exec -n hotloop deploy/hotloop -- \
  psql "$DATABASE_URL" -c \
  "UPDATE users SET password_hash = '<the hash>' WHERE username = 'admin'"
```

**オートメーションは有効なのに動いていません。** コンパイルに失敗しました。オートメーション画面は理由とともに NOT ARMED と表示し、システムログにエラーがあります。
