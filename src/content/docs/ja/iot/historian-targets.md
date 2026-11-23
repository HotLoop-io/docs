---
title: "ヒストリアンのターゲット"
description: "HotLoopが保持するすべての測定値を、工場のPostgreSQL、TimescaleDB、SQL Server、InfluxDB、MySQL、MariaDBにも書き出せます。"
---

HotLoopは自前の履歴を保持しており、それは変わりません。ただ、工場にはすでにデータベースがあります。ITがバックアップし、パッチを当て、Power BIをつなぎ、監査で責任を負っているデータベースです。トレンドを見るためだけに当社のものへ乗り換える人はいません。だからHotLoopは履歴を相手側のデータベースにも書き出します。

内蔵ヒストリアンが保持するすべての測定値は、すべてのターゲットに送られます。同じ測定値が、同じ不感帯を通り、同じ品質で届きます。多くも少なくもありません。ターゲットから描いたトレンドとHotLoopで描いたトレンドは同じ行なので一致します。

ターゲットはHotLoop IoT、Edge、Gatewayにあります。Edge Relayにはありません。Edge Relayにはターゲットに追いつかせるための自前の履歴がなく、リレーの役目は測定値をどこにでも書き出せるGatewayへ届けることだからです。

HotLoopが書き込めるデータベース:

| 種類 | 動作確認したバージョン | <span class="sr-only">詳細</span> |
|---|---|---|
| PostgreSQLとTimescaleDB | PostgreSQL 16とTimescaleDB 2.30 | [下記](#postgresqlとtimescaledb) |
| Microsoft SQL Server | SQL Server 2025 CU9 | [下記](#microsoft-sql-server) |
| InfluxDB 2と3 | InfluxDB 2.9.1とInfluxDB 3 Core 3.12.0 | [下記](#influxdb-2と3) |
| MySQLとMariaDB | MySQL 26.7.0とMariaDB 13.0.2 | [下記](#mysqlとmariadb) |
| Kafka API(イベントストリーム) | Apache Kafka 4.4.0とRedpanda 26.2.6 | [下記](#kafka-apiイベントストリーム) |

## ターゲットを追加する

**設定、ヒストリアンのターゲット、ターゲットを追加**から、または`POST /api/historian/targets`で追加します([HTTP API](/ja/iot/api/#ヒストリアンターゲット)を参照)。ターゲットは工場のデータの行き先であり、行き先を決めるのは管理者の仕事なので、管理者のみが行えます。設定を読める人なら誰でも、ターゲットと各ターゲットの状態を確認できます。

ターゲットは、種類、アドレス(`host`または`host:port`)、データベース、テーブル、ログインで構成されます。パスワードはデバイスの認証情報と同じキーで封印され(`HOTLOOP_SECRET_KEY_FILE`、[バックアップと復元](/ja/iot/backup/)を参照)、APIから取り出されることはありません。キーがない場合、パスワード付きのターゲットは拒否されます。データベースのログインが平文でバックアップに残るのを防ぐために、このキーがあるからです。

テーブルがなければHotLoopが作成します。テーブルがあってもHotLoopが作ったものでない場合(下記の6列がない場合)、ターゲットは停止状態になり、測定値を1件ずつ拒否する代わりに、どの列が足りないかを知らせます。

## テーブルに入る内容

HotLoop自身の履歴と同じ6列なので、一方向けに書いたクエリがもう一方でもそのまま読めます。

| 列 | <span class="sr-only">詳細</span> |
|---|---|
| `ts` | 測定値を取得した時刻、UTC、マイクロ秒単位 |
| `device_id` | デバイス |
| `tag_name` | タグ |
| `value` | 数値、テキストの測定値の場合は空 |
| `string_val` | テキスト、数値の場合は空 |
| `quality` | `good`、`bad`、`uncertain` |

主キーは`(device_id, tag_name, ts)`で、トレンドは1つのタグを時間順に求めるため、デバイスとタグが先頭に来ます。この主キーのおかげで、同じ測定値を2回送っても1行になるだけで問題ありません。下記の追いつき処理は、これを意図的に利用しています。

## ターゲットが停止しているとき

ここが肝心な部分なので、何が起きるかを正確に説明します。

**ポーリングはターゲットを待ちません。** 測定値はメモリ内のキューを通ってターゲットに送られ、そのサイズは内蔵ヒストリアンのキューと同じです(`HOTLOOP_HISTORIAN_QUEUE_SIZE`)。測定値を渡す処理がブロックされることはありません。キューが満杯になると最も古い測定値を捨てて空きを作ります。内蔵ヒストリアンと同じルールで、理由も同じです。メモリ上限のあるpodで無制限のキューを持つとOOM killになり、滞留分、ライブデータ、プロセスのすべてを失うからです。パケットをすべて飲み込むファイアウォールの向こうのターゲットでも、ポーリング、内蔵ヒストリアン、シャットダウンのいずれも妨げないことが試験されています。

**復旧したら追いつきます。** キューで待っていたものが先に送られます。キューが捨てざるを得なかった分は、その後でHotLoop自身の履歴から送られます。そこにはそれらの測定値がすべて残っています。サイズを決めたり埋めたりする2つ目のディスクコピーはなく、追いつきはバッファが持つ間ではなく、HotLoopが履歴を保持する間(`HOTLOOP_HISTORIAN_RETENTION_DAYS`、変更しなければ90日)は機能します。

**途中で再起動しても忘れません。** ターゲットに送るべき分は、メモリ上の測定値の山ではなく、その行に書かれた時間範囲です。正常に停止した場合は、送るべき分を正確に書き留めます。クラッシュではそれができないため、ターゲットが停止したり捨て始めたりした瞬間に、HotLoopは始まった位置を終端なしで書き留めます。次の起動で、そこからすべてを送ります。

**送れないものははっきり知らせます。** 追いつけないものは2つあり、どちらも件数と取得時刻とともにシステムログに記録されます。

- ターゲットが復旧した時点で、すでにHotLoop自身の保持期間を過ぎている測定値。HotLoopからも消えています。ログには正確な範囲が記されます。
- ターゲットのデータベースが完全に拒否する測定値。列に収まらない値や、誰かがテーブルに付けたcheck制約などが原因です。バッチは、拒否される測定値が見つかるまで分割されるため、1件の不正な測定値が残りを止めることはなく、それらは拒否としてカウントされます。データベースが受け付けないタグはポーリングのたびに拒否されるため、通知は最大でも1分に1回です。

HotLoopをまったく受け入れないデータベース(パスワードの誤り、挿入権限なし、テーブルに列が不足)は**停止**であり、「拒否」にはなりません。測定値は待機し、誰かが直した瞬間に書き込まれます。測定値そのものに対する拒否だけが、あきらめの対象になります。

各ステップは、`historian/<id>`という件名でシステムログに記録されます。

```
warning  Historian target plant-pg (Plant historian) is down: dial tcp 10.20.0.9:5432: connect: connection refused.
         Readings wait in memory, up to 50000 of them; past that they're sent from HotLoop's own history when it's back.
info     Historian target plant-pg is back after 41m12s down. What waited in memory goes first.
warning  Historian target plant-pg couldn't keep up, and its queue dropped readings taken between
         2026-10-03T10:12:40Z and 2026-10-03T10:43:19Z (182211 readings dropped since HotLoop started).
         They go out from HotLoop's own history next.
info     Historian target plant-pg caught up: 182211 readings taken between 2026-10-03T10:12:40Z and
         2026-10-03T10:43:19Z went out from HotLoop's own history.
```

設定カードにも同じ内容がリアルタイムで表示されます。状態(`writing`、`catching up`、`down`、`off`)、停止している理由、待機中の量、まだ送るべき分です。

追いつき処理は、送るべき最新の測定値より1分遅れて進み、内蔵ヒストリアンが追いつくのを待ちます。そのキューにまだある測定値は、まだデータベースにないからです。それより先を読むと、その測定値を永久に飛ばしてしまいます。

## オフにする、変更する、削除する

オフにしたターゲットには何も送られず、オフの間の分も送るべき対象になりません。すでに送るべきだった分はそのまま残ります。変更(新しいパスワード、新しいアドレス)すると新しい設定で最初から始まり、送るべきだった分は引き続き残ります。削除すると、送るべきだった分の記録は消えます。すでに入っているデータは、ターゲットのデータベースに残ります。

ターゲットに書き込むのは、UIを提供しているHotLoopだけです。その隣で動く`--mcp-stdio`ヘルパーは書き込みません。そうしないと、すべてが2回送られてしまいます。

## PostgreSQLとTimescaleDB

```json
{"id":"plant-pg","name":"Plant historian","kind":"postgres","address":"db.plant.local","database":"plant",
 "username":"hotloop","password":"...","useTls":true}
```

- ポートの既定値は5432です。テーブルの既定値は`hotloop_history`で、スキーマを付けられます(`history.hotloop`)。スキーマは存在している必要があります。
- データベースにTimescaleDB拡張がある場合、HotLoopが作るテーブルは`ts`のhypertableになります。変換に失敗しても、テーブルは通常のテーブルのまま、すべての測定値を受け付け、理由はシステムログに記録されます。
- ログインには、接続すること、初回にテーブルを作成すること(または上記の6列で自分で作成すること)、そこへ挿入することが必要です。それ以外は不要です。テーブルを読めても挿入できないログインは、測定値を拒否するターゲットではなく、停止したターゲットです。
- `useTls`はサーバー証明書を検証します(`sslmode=verify-full`)。`insecureSkipVerify`は検証せずに暗号化します(`sslmode=require`)。`useTls`がなければ接続は暗号化されません(`sslmode=disable`)。
- NaNと無限大はそのまま入ります。`double precision`が保持できます。
- ステートメントはプリペアされないため、データベースの前にトランザクションモードのPgBouncerを置いても問題ありません。

テーブルを自分で作成する場合は次のとおりです。

```sql
CREATE TABLE hotloop_history (
    ts         timestamptz      NOT NULL,
    device_id  text             NOT NULL,
    tag_name   text             NOT NULL,
    value      double precision,
    string_val text,
    quality    text             NOT NULL,
    PRIMARY KEY (device_id, tag_name, ts)
);
```

## Microsoft SQL Server

```json
{"id":"plant-sql","name":"Plant historian","kind":"sqlserver","address":"sql.plant.local","database":"plant",
 "username":"hotloop","password":"...","useTls":true}
```

- ポートの既定値は1433、テーブルは`dbo`スキーマの`hotloop_history`です。前に付けたスキーマ(`history.hotloop`)は指定どおりに使われ、存在している必要があります。
- データベースは存在している必要があります。HotLoopが作るのはテーブルであり、データベースではありません。
- HotLoopが作るテーブルでは、`ts`は`datetime2(6)`、名前は`nvarchar`、`value`は`float`、`string_val`は`nvarchar(max)`で、主キーは`(device_id, tag_name, ts)`です。この主キーのため、タグ名は最大380文字で、それより長い名前は測定値として拒否され、その旨が通知されます。クラスター化キーは900バイトまでだからです。
- ログインには、接続すること、初回にテーブルを作成すること(またはこの6列で自分で作成すること)、そこへ挿入することが必要です。テーブルを読めても挿入できないログインは、測定値を拒否するターゲットではなく、停止したターゲットです。
- **NaNと無限大は、時刻と品質はそのままに、数値なしで入ります。** SQL Serverの`float`はこれらを保持できません。測定値は残り、`value`はNULLです。
- SQL Serverはログイン自体を暗号化するため、パスワードが平文で流れることはありません。`useTls`は測定値も暗号化し、サーバー証明書を検証します。`insecureSkipVerify`は検証せずに暗号化します。
- すでにある測定値はスキップされるため、2回送っても1行です。

テーブルを自分で作成する場合は次のとおりです。

```sql
CREATE TABLE dbo.hotloop_history (
    ts         datetime2(6)  NOT NULL,
    device_id  nvarchar(64)  NOT NULL,
    tag_name   nvarchar(380) NOT NULL,
    value      float         NULL,
    string_val nvarchar(max) NULL,
    quality    varchar(16)   NOT NULL,
    CONSTRAINT PK_hotloop_history PRIMARY KEY CLUSTERED (device_id, tag_name, ts)
);
```

## MySQLとMariaDB

```json
{"id":"plant-mysql","name":"Plant historian","kind":"mysql","address":"mysql.plant.local","database":"plant",
 "username":"hotloop","password":"...","useTls":true}
```

両方で1つの種類です。同じプロトコルを話し、ここでは同じステートメントを受け付け、どちらもテストスイートで実行されています。

- ポートの既定値は3306、テーブルは`hotloop_history`です。前にデータベースを付けた名前(`other.hotloop`)は指定どおりに使われます。データベースは存在している必要があります。HotLoopが作るのはテーブルであり、データベースではありません。
- HotLoopが作るテーブルはInnoDBで、`ts`はUTCの`DATETIME(6)`、`value`は`DOUBLE`、`string_val`は`LONGTEXT`、主キーは`(device_id, tag_name, ts)`です。名前は`utf8mb4_bin`です。HotLoopのタグ名は大文字と小文字を区別しますが、サーバーの既定のcollationは区別せず、`Temp`と`TEMP`が同じキーになってしまうためです。この主キーのため、タグ名は最大512文字で、それより長い名前は測定値として拒否され、その旨が通知されます。
- **テーブルがあれば必要な権限はINSERTだけです。** HotLoopに作成させる場合は、初回のみCREATEも必要です。テーブルは読み取らず、UPDATEも要求することになる`ON DUPLICATE KEY UPDATE`も使いません。すでにある測定値は主キーの重複となり、スキップされます。
- **NaNと無限大は、時刻と品質はそのままに、数値なしで入ります。** `DOUBLE`はこれらを保持できません。`value`はNULLです。
- 誰かが追加した別の一意インデックスでの重複は、同じ測定値ではありません。check制約と同じく、拒否され、その旨が通知されます。
- `useTls`は暗号化し、サーバー証明書を検証します。`insecureSkipVerify`は検証せずに暗号化します。`useTls`がなくてもパスワードは平文では流れませんが(MySQL 8の既定のログインはサーバーのキーで暗号化して送ります)、途中にいる誰かがそのキーを差し替えられるため、工場の自前の回線以外では`useTls`を指定してください。

テーブルを自分で作成する場合は次のとおりです。

```sql
CREATE TABLE hotloop_history (
    ts         DATETIME(6)  NOT NULL,
    device_id  VARCHAR(64)  CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
    tag_name   VARCHAR(512) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
    value      DOUBLE       NULL,
    string_val LONGTEXT     CHARACTER SET utf8mb4 NULL,
    quality    VARCHAR(16)  NOT NULL,
    PRIMARY KEY (device_id, tag_name, ts)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

## InfluxDB 2と3

```json
{"id":"plant-influx","name":"Plant historian","kind":"influxdb","address":"influx.plant.local:8086",
 "org":"plant","database":"hotloop","password":"<an API token>","useTls":true}
```

同じターゲットが、通常のHTTP(`/api/v2/write`、line protocol、マイクロ秒のタイムスタンプ)でInfluxDB 2ともInfluxDB 3とも通信します。どちらも応答するため、固定するドライバーも選ぶものもありません。

- ポートの既定値はInfluxDB 2の8086です。InfluxDB 3は変更していなければ8181で待ち受けるため、ポートを指定してください。
- `database`はbucketです。`org`はInfluxDB 2の組織で、InfluxDB 2では必須です。ないとすべての書き込みがその旨の400になり、ターゲットはそのメッセージとともに停止します。InfluxDB 3には組織がないため、省略してください。
- `password`はAPIトークンです。bucket(InfluxDB 2)またはデータベース(InfluxDB 3)への書き込み権限が必要です。HotLoopはbucketを作成しません。bucketがなければ404となり、これは測定値の拒否ではなくターゲットの停止です。InfluxDB 3は、書き込まれるとデータベースを作成します。
- `table`はmeasurementで、指定しなければ`hotloop_history`です。
- 測定値は1つのポイントです。デバイスとタグはtagなので、HotLoopのタグ1つが1つのseriesになります。数値(`value`)またはテキスト(`string_val`)と品質(`quality`)はfieldです。同じ測定値を2回送ると上書きされます。
- **NaNと無限大は、時刻と品質はそのままに、`value`フィールドなしで入ります。** Line protocolではこれらを書く方法がありません。
- InfluxDBはフィールドの型を恒久的に固定します(2ではshardごと、3では列ごと)。ほかのものがすでに`string_val`に数値、`value`にテキストを書いていた場合、もう一方の種類のHotLoopの測定値は拒否され、カウントされ、システムログに名前が記録され、残りは書き込まれます。
- 401または403(認識できないトークン、または書き込めないトークン)は拒否ではなくターゲットの停止です。何も捨てられず、トークンが正しくなった瞬間に測定値が書き込まれます。
- `useTls`は`https`に切り替えて証明書を検証します。`insecureSkipVerify`は検証しません。

## Kafka API(イベントストリーム)

データベースではなくストリームです。ヒストリアンが保持するすべての測定値がKafkaのトピックに送られ、2つ目のトピックを指定すれば、HotLoopが自身のシステムログに書くすべての行(アラーム、デバイスの接続と切断、構成の変更)も送られます。Kafka APIを話すので、Apache Kafka、Redpanda、そのプロトコルに応答するほかのものも受け取れます。キューも、HotLoop自身の履歴からの追いつきも、「停止したブローカーは何も遅らせない」という点も、ほかのすべてのターゲットと同じです。

```json
{"id":"plant-stream","name":"Plant event stream","kind":"kafka","address":"kafka1.plant.local:9093,kafka2.plant.local:9093",
 "table":"hotloop.tags","username":"hotloop","password":"...","useTls":true,
 "options":{"sasl":"scram-sha-512","caCert":"-----BEGIN CERTIFICATE-----...","eventsTopic":"hotloop.events"}}
```

- `address`はカンマ区切りのブローカーの一覧で、指定がなければポート9092です。開始には1つで十分です。残りがどこにあるかはブローカーが教えてくれます。
- `table`は測定値用のトピックです(指定しなければ`hotloop.tags`)。`options.eventsTopic`はイベント用のトピックで、フォームからターゲットを追加した場合やAPI呼び出しで省略した場合は`hotloop.events`、空にするとイベントなしです。2つを同じトピックにすることはできません。
- トピックがなければ、HotLoopがブローカー自身の既定のパーティションとレプリケーションで作成します。トピックを作れないログインは、ブローカーが示す理由とともに停止したターゲットになるため、そのログインで作れない場合は先に作成しておいてください。
- `options.sasl`は`scram-sha-512`、`scram-sha-256`、`plain`のいずれかで、`username`と`password`を使います。PLAINはパスワードをそのまま送るため、HotLoopは`useTls`なしでは拒否します。ブローカーが断ったログインは**停止**で、状態に「the broker refused the login」と表示され、「測定値の拒否」と表示されることはありません。
- `useTls`はブローカーの証明書を検証します。自前のCAで署名された場合は、そのCAをPEMとして`options.caCert`に指定してください。`insecureSkipVerify`は検証せずに暗号化します。
- クライアント証明書(相互TLS)、Kerberos、OAuthのログインには対応していません。

**測定値のトピックに入る内容。** 測定値1件につきJSONオブジェクト1つで、キーは`deviceId/tag`です。これにより1つのタグの測定値が1つのパーティション内で順序を保ちます。

```json
{"ts":"2026-10-31T12:00:00.123456Z","deviceId":"press-01","tag":"Zone1_Temp","value":21.5,"quality":"good","unit":"°C"}
{"ts":"2026-10-31T12:00:00Z","deviceId":"press-01","tag":"Program","value":null,"text":"Grade A","quality":"good"}
{"ts":"2026-10-31T12:00:00Z","deviceId":"press-01","tag":"Speed","value":null,"nonFinite":"NaN","quality":"bad"}
```

数値は`value`、テキストは`text`で`value`はnullです。JSONはNaNや無限大を表せないため、それらは`nonFinite`(`NaN`、`+Inf`、`-Inf`)で示され、`value`はnullです。この形式には項目が追加されるだけで、変更されることはありません。ヘッダーは`hotloop-type: reading`と`content-type: application/json`です。レコード自体のタイムスタンプは生成された時刻で、測定値の時刻は`ts`です。

**イベントのトピックに入る内容。** システムログ1行につきJSONオブジェクト1つで、キーはその件名(件名がなければカテゴリ)、`hotloop-type: event`です。

```json
{"at":"2026-10-31T12:00:00.456Z","severity":"warning","category":"alarm","subject":"press-01/Zone1_Temp",
 "actor":"system","message":"Zone 1 is over 250","detail":{"limit":250,"value":251.5}}
```

`detail`は、その行が持っていたJSONをそのままJSONとして、JSONでなかった場合はテキストとして入れたものです。ヒストリアンのターゲット自体に関する行は除外されます。そうしないと、停止したブローカーが自分自身の停止を自分に報告することになるからです。

**少なくとも1回の配信であり、イベントはベストエフォートです。**
- 測定値: 配信は同期済みのすべてのレプリカが確認し、停止後の追いつきは意図的にすでに送った分と重なるため、測定値が2回届くことがあります。`deviceId`、`tag`、`ts`で重複を特定でき、気になるコンシューマーは繰り返しを捨てます。ブローカーに届かなかった測定値は送るべき分として残り、データベースの場合と同様に、HotLoop自身の履歴から送られます。
- イベントはライブのフィードです。追いつくための履歴はないため、ブローカーが不在の間や、バッファが満杯になった後に生成されたイベントは失われ、ターゲットの状態がそれをカウントし(`eventsLost`)、設定カードに表示されます。
- 書き込みの途中でブローカーが消えると、25秒以内にターゲットが**停止**となり、その書き込みに含まれていた測定値は送るべき分として残ります。(franz-goは、届かなかったことを証明できない書き込みを永遠に待つことになるため、HotLoopはあきらめさせています。そのため重複が起こりえます。)
- ブローカーが決して受け付けない測定値(メッセージの上限を超える大きさ)は単独で拒否され、カウントされ、システムログに名前が記録され、同じバッチの残りはそのまま送られます。

HotLoopは[franz-go](https://github.com/twmb/franz-go)(BSD-3-Clause)を通してKafka APIを話し、`NOTICE`に明記されています。バイナリは約5 MiB増えました。

## テストの方法

すべての種類のターゲットが、実際のデータベースまたはブローカーに対して、実際に切断して復旧した停止を経て実行されています。ターゲットは最終的にHotLoopが保持するものと完全に同じ内容を持ち、停止中の再起動は次の起動で追いつき、ハングしたターゲットはポーリングも内蔵ヒストリアンも止めません。
